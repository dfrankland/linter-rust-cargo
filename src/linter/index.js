/* global atom:true */

import { resolve as resolvePath } from 'path';
import { CompositeDisposable } from 'atom'; // eslint-disable-line
import globby from 'globby';
import commondir from 'commondir';
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
    // Get all `Cargo.toml` manifests in the project.
    const atomProjectDirectories = atom.project.getDirectories().map((
      ({ realPath = '' }) => realPath
    ));
    const globPatterns = this.config.cargoManifestGlobs.reduce(
      (allPatterns, nextGlob) => [
        ...allPatterns,
        ...atomProjectDirectories.map((
          atomProjectDirectory => (
            resolvePath(atomProjectDirectory, nextGlob)
          )
        )),
      ],
      [],
    );
    const cargoManifests = await globby(
      globPatterns,
      {
        cwd: commondir(atomProjectDirectories),
        gitignore: this.config.cargoManifestGlobsGitIgnore,
      },
    );

    // Returns an array of arrays with JSON returned by `cargo` commands.
    const messageGroups = await Promise.all((
      spawnCargoCommands({
        cargoManifests,
        runningProcesses: this.runningProcesses,
        config: this.config,
      })
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
