import autoExternal from 'rollup-plugin-auto-external';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import string from 'rollup-plugin-string';
import json from 'rollup-plugin-json';
import pkg from './package.json';

// const external = Object.keys(pkg.dependencies);

const commonPlugins = [
  autoExternal(),
  string({ include: '**/*.text.*' }), // allow us to import files as strings
  json() // import json files as modules
];

const filterWarnings = warning => {
  // Let rollup auto-configure globals based on our code
  if (warning.code === 'MISSING_GLOBAL_NAME') {
    return;
  }
  // Ignore eval warnings if we've disabled the eslint warning
  if (warning.code === 'EVAL' &&
        /eslint-disable-line no-eval/.test(warning.frame)) {
    return;
  }
  console.warn(warning.code, warning.message);
};

export default [
  // browser-friendly UMD build
  {
    input: 'src/module.js',
    output: {
      name: 'mure',
      file: pkg.browser,
      format: 'umd'
    },
    plugins: commonPlugins.concat([
      resolve(), // so Rollup can find dependencies
      commonjs() // so Rollup can convert dependencies to ES modules
    ]),
    onwarn: filterWarnings
  },
  // CommonJS build for Node.js
  {
    input: 'src/main.js',
    output: {
      file: pkg.main,
      format: 'cjs'
    },
    external: ['d3-node', 'pouchdb-node'],
    plugins: commonPlugins,
    onwarn: filterWarnings
  },
  // ES Module build for bundlers
  {
    input: 'src/module.js',
    output: {
      file: pkg.module,
      format: 'es'
    },
    plugins: commonPlugins,
    onwarn: filterWarnings
  }
];
