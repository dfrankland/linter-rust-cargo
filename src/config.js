export default {
  cargoPath: {
    title: 'Cargo Path',
    description: 'Path to Rust\'s package manager `cargo`',
    type: 'string',
    default: 'cargo',
  },
  cargoCommand: {
    title: 'Cargo Command',
    description: 'Use `cargo --help` to see all available commands and options; separated by commas (`,`).',
    type: 'array',
    items: {
      type: 'string',
    },
    default: ['test', '--all', '--jobs', '2'],
  },
  cargoManifestGlob: {
    title: 'Cargo Manifest Filename Glob',
    description: 'Used to find and run Cargo on all crates in a project.',
    type: 'string',
    default: '**/Cargo.toml',
  },
  disabledLints: {
    title: 'Disabled Lints',
    description: 'Lint codes to be ignored; separated by commas (`,`).',
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
