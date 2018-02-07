import { resolve as resolvePath } from 'path';
import globby from 'globby';
import commondir from 'commondir';
import config from '../config';

// Get all `Cargo.toml` manifests in the project.
export default () => async ({
  projectPaths,
  config: {
    cargoManifestGlobs = config.cargoManifestGlobs,
    cargoManifestGlobsGitIgnore = config.cargoManifestGlobsGitIgnore,
  } = {},
}) => {
  const globPatterns = cargoManifestGlobs.reduce(
    (allPatterns, nextGlob) => [
      ...allPatterns,
      ...projectPaths.map((
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
      cwd: commondir(projectPaths),
      gitignore: cargoManifestGlobsGitIgnore,
    },
  );

  return cargoManifests;
};
