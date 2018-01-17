/* global atom:true */

import { resolve as resolvePath } from 'path';
import { CompositeDisposable } from 'atom'; // eslint-disable-line
import globby from 'globby';
import { name } from '../../package.json';
import config from '../config';
import spawnCargoCommands from './spawnCargoCommands';
import messageConverter from './messageConverter';

export default class {
  constructor() {
    // Subscribe to Atom to receive user configured config.
    this.config = {};
    this.subscriptions = new CompositeDisposable();
    Object.keys(config).forEach((
      (key) => {
        this.subscriptions.add((
          atom.config.observe(
            `${name}.${key}`,
            (value) => {
              this.config[key] = value;
            },
          )
        ));
      }
    ));
  }

  // Stop subscribing to Atom for config when Linter object is destroyed.
  destroy = () => this.subscriptions.dispose();

  // Map of `cargo` command child processes.
  runningProcesses = new Map();

  lint = async () => {
    // Kill any running `cargo` command child processes, before re-running.
    this.runningProcesses.forEach((id, runningProcess, runningProcesses) => {
      if (runningProcess && runningProcess.kill) runningProcess.kill();
      if (runningProcesses.has(id)) runningProcesses.delete(id);
    });

    // Get all `Cargo.toml` manifests in the project.
    const cargoManifests = await globby((
      atom.project.getDirectories().map((
        ({ realPath = '' }) => resolvePath(
          realPath,
          this.config.cargoManifestGlob,
        )
      ))
    ));

    // Returns an array of arrays with JSON returned by `cargo` commands.
    const messageGroups = await Promise.all((
      spawnCargoCommands({ cargoManifests, config: this.config })
    ));

    // Flatten array of arrays of JSON objects to a single array of JSON
    // objects.
    const messages = messageGroups.reduce(
      (allMessages, messageGroup) => [...allMessages, ...messageGroup],
      [],
    );

    // Convert JSON objects returned by `cargo` commands into Atom `linter`
    // message objects.
    return messageConverter({ messages, config: this.config });
  };
}
