import babel from 'rollup-plugin-babel';
import { dependencies } from './package.json';

export default {
  input: './src/index.js',
  output: {
    file: './dist/index.js',
    format: 'cjs',
    sourcemap: true,
  },
  plugins: [
    babel({
      babelrc: false,
      presets: [
        [
          '@babel/preset-env',
          {
            modules: false,
            targets: {
              node: '8',
            },
          },
        ],
        '@babel/preset-stage-0',
      ],
    }),
  ],
  external: [
    'atom',
    'path',
    'uuid/v4',
    ...Object.keys(dependencies),
  ],
};
