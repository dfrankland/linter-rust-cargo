/* global atom:true */

import { CompositeDisposable } from 'atom'; // eslint-disable-line
import { name } from '../../package.json';
import config from '../config';
import getCargoManifests from './getCargoManifests';
import spawnCargoCommands from './spawnCargoCommands';
import messageConverter from './messageConverter';

export default class {
  constructor() {
    // Subscribe to Atom to receive user configured config.
    this.subscriptions = new CompositeDisposable();

    this.config = {};
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

    (async () => {
      this.cargoManifests = await getCargoManifests({
        config: this.config,
        projectPaths: atom.project.getPaths(),
      });
    })();
    this.subscriptions.add((
      atom.project.onDidChangePaths((
        async (projectPaths) => {
          this.cargoManifests = await getCargoManifests({
            config: this.config,
            projectPaths,
          });
        }
      ))
    ));
  }

  // Stop subscribing to Atom for config when Linter object is destroyed.
  destroy = () => this.subscriptions.dispose();

  // Map of `cargo` command child processes.
  runningProcesses = new Map();

  lint = async () => {

    // Returns an array of arrays with JSON returned by `cargo` commands.
    const messageGroups = await Promise.all((
      spawnCargoCommands({
        cargoManifests: this.cargoManifests,
        runningProcesses: this.runningProcesses,
        config: this.config,
      })
    ));

    if (messageGroups.every(messageGroup => !messageGroup)) return null;

    // Flatten array of arrays of JSON objects to a single array of JSON
    // objects.
    const messages = messageGroups.reduce(
      (allMessages, messageGroup) => {
        if (!messageGroup) return allMessages;
        return [...allMessages, ...messageGroup];
      },
      [],
    );

    // Convert JSON objects returned by `cargo` commands into Atom `linter`
    // message objects.
    return messageConverter({ messages, config: this.config });
  };
}
