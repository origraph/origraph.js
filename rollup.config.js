import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import string from 'rollup-plugin-string';
import json from 'rollup-plugin-json';
import pkg from './package.json';

const dependencies = Object.keys(pkg.dependencies);
const devDependencies = Object.keys(pkg.devDependencies);
const peerDependencies = Object.keys(pkg.peerDependencies);

const commonPlugins = [
  string({ include: '**/*.text.*' }), // allow us to import files as strings
  json(), // import json files as modules
  babel({ exclude: ['node_modules/**'] }) // let us use fancy new things like async in our code
];

export default [
  // browser-friendly UMD build
  {
    input: 'src/module.js',
    output: {
      sourcemap: 'inline',
      name: 'mure',
      file: pkg.browser,
      format: 'umd',
      globals: { 'd3': 'd3' }
    },
    plugins: commonPlugins.concat([
      builtins(),
      globals(),
      resolve(), // so Rollup can find dependencies
      commonjs() // so Rollup can convert dependencies to ES modules
    ]),
    external: peerDependencies
  },
  // CommonJS build for Node.js
  {
    input: 'src/main.js',
    output: {
      file: pkg.main,
      format: 'cjs'
    },
    external: dependencies.concat(devDependencies).concat(peerDependencies),
    plugins: commonPlugins
  },
  // ES Module build for bundlers
  {
    input: 'src/module.js',
    output: {
      file: pkg.module,
      format: 'es'
    },
    external: dependencies.concat(devDependencies).concat(peerDependencies),
    plugins: commonPlugins
  }
];
