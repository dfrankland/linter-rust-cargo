/* global atom:true */

import { resolve as resolvePath } from 'path';

const INCLUDED_REASONS = ['compiler-message'];

// The `cargo` message JSON objects use `null` values which makes destructuring
// difficult.
const cargoMessageToNormalizedObject = ({ cargoMessage = {}, cwd }) => {
  const {
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
        suggested_replacement: suggestedReplacement,
      } = {},
    ] = [],
    children,
  } = cargoMessage;

  const { code, explanation } = possiblyNullCode || {};

  return {
    message: message || '',
    level: level || 'error',
    position: [
      [(rowStart || 1) - 1, (columnStart || 1) - 1],
      [(rowEnd || 1) - 1, (columnEnd || 1) - 1],
    ],
    file: cwd && fileName ? resolvePath(cwd, fileName) : '',
    children: children || [],
    code: code || '',
    explanation: explanation || '',
    suggestedReplacement,
  };
};

const getUrl = ({ code, children, cargoMessage }) => {
  if (/^E\d\d\d\d$/.test(code)) {
    return `https://doc.rust-lang.org/error-index.html#${code}`;
  }

  const [url] = children.reduce(
    (allUrls, { message }) => {
      if (!message) return allUrls;

      const matches = message.match(/\bhttps?:\/\/\S+/);
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
    console.log('`code` is not provided', cargoMessage); // eslint-disable-line no-console
  }

  return null;
};

const getDescription = ({ children }) => (
  children.reduce(
    (
      allDescriptions,
      nextChild,
    ) => {
      const { level, message } = cargoMessageToNormalizedObject({ cargoMessage: nextChild });
      if (level !== 'note') return allDescriptions;
      return `${allDescriptions}\n\n**${level}:** ${message}`;
    },
    '',
  )
);

const getSolutions = ({ children }) => (
  children.reduce(
    (
      allSolutions,
      nextChild,
    ) => {
      const {
        level,
        message,
        position,
        suggestedReplacement,
      } = cargoMessageToNormalizedObject({ cargoMessage: nextChild });

      if (level !== 'help' || !suggestedReplacement) return allSolutions;

      return [
        ...allSolutions,
        {
          title: message,
          position,
          replaceWith: suggestedReplacement,
        },
      ];
    },
    [],
  )
);

export default ({
  messages = [],
  config: {
    disabledLints = [],
  } = {},
}) => (
  messages.reduce(
    (allResults, nextMessage) => {
      const {
        reason,
        cwd,
        message: cargoMessage,
      } = nextMessage;

      const {
        message,
        code,
        file,
        level,
        position,
        children,
      } = cargoMessageToNormalizedObject({ cargoMessage, cwd });

      if (
        INCLUDED_REASONS.indexOf(reason) === -1 ||
        disabledLints.indexOf(code) > -1 ||
        !file
      ) {
        return allResults;
      }

      return [
        ...allResults,
        {
          excerpt: `${code ? `[${code}] ` : ''}${message}`,
          description: getDescription({ children }),
          url: getUrl({ code, children, cargoMessage: nextMessage }),
          severity: level,
          location: {
            file,
            position,
          },
          solutions: getSolutions({ children }),
        },
      ];
    },
    [],
  )
);
