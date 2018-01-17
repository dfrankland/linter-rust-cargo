/* global atom:true */

import { resolve as resolvePath, dirname } from 'path';
import { CompositeDisposable } from 'atom'; // eslint-disable-line
import globby from 'globby';
import execa from 'execa';
import uuidv4 from 'uuid/v4';
import config from './config';

const linter = 'linter-rust-cargo';

export default class {
  constructor() {
    this.subscriptions = new CompositeDisposable();

    this.config = {};

    Object.keys(config).forEach((
      (key) => {
        this.subscriptions.add((
          atom.config.observe(
            `${linter}.${key}`,
            (value) => {
              this.config[key] = value;
            },
          )
        ));
      }
    ));
  }

  destroy = () => this.subscriptions.dispose();

  runningProcesses = new Map();

  lint = async () => {
    this.runningProcesses.forEach((id, runningProcess, runningProcesses) => {
      if (runningProcess && runningProcess.kill) runningProcess.kill();
      if (runningProcesses.has(id)) runningProcesses.delete(id);
    });

    const {
      cargoPath,
      cargoCommand,
      cargoManifestGlob,
      execTimeout,
      disabledLints,
    } = this.config;

    const cargoManifests = await globby((
      atom.project.getDirectories().map((
        ({ realPath = '' }) => resolvePath(
          realPath,
          cargoManifestGlob,
        )
      ))
    ));

    const spawns = cargoManifests.map((
      async (manifestPath) => {
        const cwd = dirname(manifestPath);

        const spawn = execa.stdout(
          cargoPath,
          cargoCommand,
          { timeout: execTimeout, cwd },
        );

        const id = uuidv4();

        this.runningProcesses.set(id, spawn);

        const result = await (async () => {
          try {
            return await spawn;
          } catch (err) {
            if (err.code === 101) return err;
            if (err.timedOut) console.warn('Linting timedout.'); // eslint-disable-line no-console
            if (!err.killed) console.error(err); // eslint-disable-line no-console
          }

          return { stdout: '' };
        })();

        if (this.runningProcesses.has(id)) {
          this.runningProcesses.delete(id, spawn);
        }

        return (result.stdout || '').split('\n').reduce(
          (allMessages, jsonString) => {
            try {
              const json = JSON.parse(jsonString);
              json.cwd = cwd;
              return [...allMessages, json];
            } catch (err) {
              return allMessages;
            }
          },
          [],
        );
      }
    ));

    const messages = await Promise.all(spawns);

    return messages.reduce(
      (allMessages, messageGroup) => [...allMessages, ...messageGroup],
      [],
    ).reduce(
      (
        allResults,
        nextMessage,
      ) => {
        const {
          cwd,
          reason,
          message: {
            message,
            level,
            code: possiblyNullCode,
            spans: [
              {
                line_start: rowStart,
                column_start: columnStart,
                line_end: rowEnd,
                column_end: columnEnd,
                file_name: fileName,
              } = {},
            ] = [],
            children,
          } = {},
        } = nextMessage;

        const { code, explanation } = possiblyNullCode || {};

        if (
          reason !== 'compiler-message' ||
          disabledLints.indexOf(code) > -1 ||
          !fileName
        ) {
          return allResults;
        }

        return [
          ...allResults,
          {
            excerpt: `[${code}] ${message}`,
            description: children.reduce(
              (
                allDescriptions,
                {
                  level: childLevel,
                  message: childMessage,
                } = {},
              ) => (
                childLevel !== 'note' ?
                  allDescriptions :
                  `${allDescriptions}\n${childLevel}: ${childMessage}`
              ),
              explanation,
            ),
            url: (() => {
              if (/^E\d\d\d\d$/.test(code)) {
                return `https://doc.rust-lang.org/error-index.html#${code}`;
              }

              const [url] = children.reduce(
                (allUrls, { message: childMessage }) => {
                  if (!childMessage) return allUrls;

                  const matches = childMessage.match(/\bhttps?:\/\/\S+/);
                  if (!matches) return allUrls;

                  return [...allUrls, matches[0]];
                },
                [],
              );

              if (url) return url;

              if (code) {
                return `https://manishearth.github.io/rust-internals-docs/rustc/lint/builtin/static.${code.toUpperCase()}.html`;
              }

              if (atom.inDevMode()) {
                console.log('`code` is `null`?', nextMessage); // eslint-disable-line no-console
              }

              return null;
            })(),
            severity: level,
            location: {
              file: resolvePath(cwd, fileName || ''),
              position: [
                [rowStart - 1, columnStart - 1],
                [rowEnd - 1, columnEnd - 1],
              ],
            },
            solutions: children.reduce(
              (
                allSolutions,
                {
                  level: childLevel,
                  message: childMessage,
                  spans: [
                    {
                      line_start: childRowStart,
                      column_start: childColumnStart,
                      line_end: childRowEnd,
                      column_end: childColumnEnd,
                      suggested_replacement: suggestedReplacement,
                    } = {},
                  ] = [],
                },
              ) => (
                childLevel !== 'help' && suggestedReplacement ? allSolutions : [
                  ...allSolutions,
                  {
                    title: childMessage,
                    position: [
                      [childRowStart - 1, childColumnStart - 1],
                      [childRowEnd - 1, childColumnEnd - 1],
                    ],
                    replaceWith: suggestedReplacement,
                  },
                ]
              ),
              [],
            ),
          },
        ];
      },
      [],
    );
  };
}
