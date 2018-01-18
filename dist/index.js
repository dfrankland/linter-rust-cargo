'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = require('path');
var atom$1 = require('atom');
var globby = _interopDefault(require('globby'));
var execa = _interopDefault(require('execa'));
var uuidv4 = _interopDefault(require('uuid/v4'));

var name = "linter-rust-cargo";

var config = {
  cargoCommandPath: {
    title: 'Cargo Command Path',
    description: 'Path to Rust\'s package manager `cargo`.',
    type: 'string',
    default: 'cargo'
  },
  cargoCommandArguments: {
    title: 'Cargo Command Arguments',
    description: `
Use \`cargo --help\` to see all available commands and options; separated by commas (\`,\`)
.

**Must use \`--message-format, JSON\` somewhere, otherwise this will break
.**

Example of \`clippy\` command arguments: \`clippy, --all, --jobs, 2, --message-format, JSON, --, -D, clippy\`
`,
    type: 'array',
    items: {
      type: 'string'
    },
    default: ['check', '--all', '--jobs', '2', '--message-format', 'JSON']
  },
  cargoManifestGlob: {
    title: 'Cargo Manifest Filename Glob',
    description: 'Used to find and run Cargo on all crates in a project.',
    type: 'string',
    default: '**/Cargo.toml'
  },
  disabledLints: {
    title: 'Disabled Lints',
    description: `\
Lint codes to be ignored; separated by commas (\`,\`)
.

Example of ignoring compiler lints, clippy lints, and compiler errors: \`unused_imports, match_ref_pats, E0463\`
`,
    type: 'array',
    items: {
      type: 'string'
    },
    default: []
  },
  execTimeout: {
    title: 'Execution Timeout (milliseconds)',
    description: 'Processes running longer than the timeout will be automatically terminated.',
    type: 'integer',
    default: 60000
  }
};

// promises that resolve to an array of JSON objects returned by each `cargo`
// command run for each `Cargo.toml` manifest.

var spawnCargoCommands = (({
  cargoManifests = [],
  runningProcesses = new Map(),
  config: {
    cargoCommandPath = '',
    cargoCommandArguments = [],
    execTimeout = 0
  } = {}
}) => cargoManifests.map(async manifestPath => {
  // Get directory of `Cargo.toml` manifest file. This directory is where
  // the `cargo` command child process will be run from.
  const cwd = path.dirname(manifestPath); // Create new `cargo` command child process.

  const spawn = execa.stdout(cargoCommandPath, cargoCommandArguments, {
    timeout: execTimeout,
    cwd
  }); // Add new child process to `runningProcesses`.

  const id = uuidv4();
  runningProcesses.set(id, spawn); // Await for the result of the newly spawned child process.

  const result = await (async () => {
    try {
      // No errors! Files passed all lints and compiled properly.
      return await spawn;
    } catch (err) {
      // Some errors, either lints or compilation problems.
      if (err.code === 101) return err; // Linting took too long and the process was killed.

      if (err.timedOut) console.warn('Linting timedout.'); // eslint-disable-line no-console
      // The process was not killed intentionally and another, unknown,
      // error occured.

      if (!err.killed) console.error(err); // eslint-disable-line no-console
    }

    return {
      stdout: ''
    };
  })(); // Job completed remove it from the the `runningProcesses`.

  if (runningProcesses.has(id)) runningProcesses.delete(id, spawn); // The result of `cargo` commands will always be a large string with JSON
  // objects seperated by newline characters.

  return (result.stdout || '').split('\n').reduce((allMessages, jsonString) => {
    // Some commands, like `clippy`, give a line at the begging like
    // "lib: crate_name" before printing the JSON. This causes the
    // `JSON.parse` to throw. This way we safely filter those lines out.
    try {
      const json = JSON.parse(jsonString);
      json.cwd = cwd;
      return [...allMessages, json];
    } catch (err) {
      return allMessages;
    }
  }, []);
}));

/* global atom:true */
const INCLUDED_REASONS = ['compiler-message']; // The `cargo` message JSON objects use `null` values which makes destructuring
// difficult.

const cargoMessageToNormalizedObject = ({
  cargoMessage = {},
  cwd
}) => {
  const {
    message,
    level,
    code: possiblyNullCode,
    spans: [{
      line_start: rowStart,
      column_start: columnStart,
      line_end: rowEnd,
      column_end: columnEnd,
      file_name: fileName,
      suggested_replacement: suggestedReplacement
    } = {}] = [],
    children
  } = cargoMessage;
  const {
    code,
    explanation
  } = possiblyNullCode || {};
  return {
    message: message || '',
    level: level || 'error',
    position: [[(rowStart || 1) - 1, (columnStart || 1) - 1], [(rowEnd || 1) - 1, (columnEnd || 1) - 1]],
    file: cwd && fileName ? path.resolve(cwd, fileName) : '',
    children: children || [],
    code: code || '',
    explanation: explanation || '',
    suggestedReplacement
  };
};

const getUrl = ({
  code,
  children,
  cargoMessage
}) => {
  if (/^E\d\d\d\d$/.test(code)) {
    return `https://doc.rust-lang.org/error-index.html#${code}`;
  }

  const [url] = children.reduce((allUrls, {
    message
  }) => {
    if (!message) return allUrls;
    const matches = message.match(/\bhttps?:\/\/\S+/);
    if (!matches) return allUrls;
    return [...allUrls, matches[0]];
  }, []);
  if (url) return url;

  if (code) {
    return `https://manishearth.github.io/rust-internals-docs/rustc/lint/builtin/static.${code.toUpperCase()}.html`;
  }

  if (atom.inDevMode()) {
    console.log('`code` is not provided', cargoMessage); // eslint-disable-line no-console
  }

  return null;
};

const getDescription = ({
  children
}) => children.reduce((allDescriptions, nextChild) => {
  const {
    level,
    message
  } = cargoMessageToNormalizedObject({
    cargoMessage: nextChild
  });
  if (level !== 'note') return allDescriptions;
  return `${allDescriptions}\n\n**${level}:** ${message}`;
}, '');

const getSolutions = ({
  children
}) => children.reduce((allSolutions, nextChild) => {
  const {
    level,
    message,
    position,
    suggestedReplacement
  } = cargoMessageToNormalizedObject({
    cargoMessage: nextChild
  });
  if (level !== 'help' || !suggestedReplacement) return allSolutions;
  return [...allSolutions, {
    title: message,
    position,
    replaceWith: suggestedReplacement
  }];
}, []);

var messageConverter = (({
  messages = [],
  config: {
    disabledLints = []
  } = {}
}) => messages.reduce((allResults, nextMessage) => {
  const {
    reason,
    cwd,
    message: cargoMessage
  } = nextMessage;
  const {
    message,
    code,
    file,
    level,
    position,
    children
  } = cargoMessageToNormalizedObject({
    cargoMessage,
    cwd
  });

  if (INCLUDED_REASONS.indexOf(reason) === -1 || disabledLints.indexOf(code) > -1 || !file) {
    return allResults;
  }

  return [...allResults, {
    excerpt: `${code ? `[${code}] ` : ''}${message}`,
    description: getDescription({
      children
    }),
    url: getUrl({
      code,
      children,
      cargoMessage: nextMessage
    }),
    severity: level,
    location: {
      file,
      position
    },
    solutions: getSolutions({
      children
    })
  }];
}, []));

/* global atom:true */
class Linter {
  constructor() {
    Object.defineProperty(this, "destroy", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: () => this.subscriptions.dispose()
    });
    Object.defineProperty(this, "runningProcesses", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: new Map()
    });
    Object.defineProperty(this, "lint", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: async () => {
        // Kill any running `cargo` command child processes, before re-running.
        this.runningProcesses.forEach((id, runningProcess, runningProcesses) => {
          if (runningProcess && runningProcess.kill) runningProcess.kill();
          if (runningProcesses.has(id)) runningProcesses.delete(id);
        }); // Get all `Cargo.toml` manifests in the project.

        const cargoManifests = await globby(atom.project.getDirectories().map(({
          realPath = ''
        }) => path.resolve(realPath, this.config.cargoManifestGlob))); // Returns an array of arrays with JSON returned by `cargo` commands.

        const messageGroups = await Promise.all(spawnCargoCommands({
          cargoManifests,
          config: this.config
        })); // Flatten array of arrays of JSON objects to a single array of JSON
        // objects.

        const messages = messageGroups.reduce((allMessages, messageGroup) => [...allMessages, ...messageGroup], []); // Convert JSON objects returned by `cargo` commands into Atom `linter`
        // message objects.

        return messageConverter({
          messages,
          config: this.config
        });
      }
    });
    // Subscribe to Atom to receive user configured config.
    this.config = {};
    this.subscriptions = new atom$1.CompositeDisposable();
    Object.keys(config).forEach(key => {
      this.subscriptions.add(atom.config.observe(`${name}.${key}`, value => {
        this.config[key] = value;
      }));
    });
  } // Stop subscribing to Atom for config when Linter object is destroyed.


}

/* global atom:true */
let activated = false;
const activate = () => {
  activated = true;
};
const deactivate = () => {
  activated = false;
};
const provideLinter = () => {
  const linter = new Linter(config);
  return {
    name: 'Rust Cargo',
    scope: 'project',
    lintsOnChange: false,
    grammarScopes: ['source.rust'],
    lint: () => {
      if (!activated) return [];
      if (atom.inDevMode()) console.time('lint-rust-cargo'); // eslint-disable-line no-console

      const results = linter.lint();
      if (atom.inDevMode()) console.timeEnd('lint-rust-cargo'); // eslint-disable-line no-console

      return results;
    }
  };
};

exports.config = config;
exports.activate = activate;
exports.deactivate = deactivate;
exports.provideLinter = provideLinter;
//# sourceMappingURL=index.js.map
