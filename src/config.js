export default {
  cargoCommandPath: {
    title: 'Cargo Command Path',
    description: 'Path to Rust\'s package manager `cargo`.',
    type: 'string',
    default: 'cargo',
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
      type: 'string',
    },
    default: ['check', '--all', '--jobs', '2', '--message-format', 'JSON'],
  },
  cargoTargetDirectory: {
    title: 'Cargo Target Directory',
    description: 'Directory to target when running the `cargo` command, relative to the Cargo manifest file.',
    type: 'string',
    default: './target',
  },
  cargoManifestGlobs: {
    title: 'Cargo Manifest Filename Globs',
    description: `\
Globs to find Cargo manifest files; separated by commas (\`,\`)
.

Used to find and run Cargo on all crates in a project.
`,
    type: 'array',
    items: {
      type: 'string',
    },
    default: ['**/Cargo.toml'],
  },
  cargoManifestGlobsGitIgnore: {
    title: 'Cargo Manifest Filename Globs - Respect `.gitignore` Patterns',
    description: 'Respect ignore patterns in `.gitignore` files that apply to the globbed files.',
    type: 'boolean',
    default: true,
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
      type: 'string',
    },
    default: [],
  },
  execTimeout: {
    title: 'Execution Timeout (milliseconds)',
    description: 'Processes running longer than the timeout will be automatically terminated.',
    type: 'integer',
    default: 60000,
  },
};
