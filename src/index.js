/* global atom:true */

import Linter from './linter';
import config from './config';

export { config };

let activated = false;

export const activate = () => {
  activated = true;
};

export const deactivate = () => {
  activated = false;
};

export const provideLinter = () => {
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
    },
  };
};
