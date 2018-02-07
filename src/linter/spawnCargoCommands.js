/* global atom:true */

import { dirname, resolve as resolvePath } from 'path';
import execa from 'execa';
import uuidv4 from 'uuid/v4';
import { name } from '../../package.json';

// Takes an array of paths to `Cargo.toml` manifests, and returns an array of
// promises that resolve to an array of JSON objects returned by each `cargo`
// command run for each `Cargo.toml` manifest.
export default ({
  cargoManifests = [],
  runningProcesses = new Map(),
  config: {
    cargoCommandPath = '',
    cargoCommandArguments = [],
    execTimeout = 0,
    cargoTargetDirectory = './target',
  } = {},
}) => {
  // Kill any running `cargo` command child processes, before re-running.
  runningProcesses.forEach((runningProcess, id, map) => {
    if (runningProcess && runningProcess.kill) runningProcess.kill();
    map.delete(id);
  });

  return cargoManifests.map((
    async (manifestPath) => {
      // Get directory of `Cargo.toml` manifest file. This directory is where
      // the `cargo` command child process will be run from.
      const cwd = dirname(manifestPath);

      // Create new `cargo` command child process.
      const spawn = execa(
        cargoCommandPath,
        cargoCommandArguments,
        {
          timeout: execTimeout,
          cwd,
          env: {
            CARGO_TARGET_DIR: resolvePath(cwd, cargoTargetDirectory),
          },
        },
      );

      // Add new child process to `runningProcesses`.
      const id = uuidv4();
      runningProcesses.set(id, spawn);

      // Await for the result of the newly spawned child process.
      const result = await (async () => {
        try {
          // No errors! Files passed all lints and compiled properly.
          return await spawn.then(x => x.stdout);
        } catch (err) {
          // Inspect why the process is killed in dev mode.
          if (atom.inDevMode()) console.info(`${name} process ended`, id, { ...err }); // eslint-disable-line no-console

          // Some errors, either lints or compilation problems.
          if (err.code === 101) return err;

          // Linting took too long and the process was killed.
          if (err.timedOut) console.warn('Linting timedout.'); // eslint-disable-line no-console

          // The process was not killed intentionally and another, unknown,
          // error occured.
          if (!err.killed) console.error(err); // eslint-disable-line no-console
        }

        return { stdout: '' };
      })();

      // Job completed remove it from the the `runningProcesses`.
      runningProcesses.delete(id);

      // The result of `cargo` commands will always be a large string with JSON
      // objects seperated by newline characters.
      return (result.stdout || '').split('\n').reduce(
        (allMessages, jsonString) => {
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
        },
        [],
      );
    }
  ));
};
