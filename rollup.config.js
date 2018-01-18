import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
// import replace from 'rollup-plugin-replace';
import globals from 'rollup-plugin-node-globals';
import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-babel';
import string from 'rollup-plugin-string';

const packageJson = require('./package.json');
const external = Object.keys(packageJson.dependencies);

export default {
  input: 'src/mure.js',
  output: {
    name: 'mure',
    sourcemap: 'inline',
    globals: {
      d3: 'd3',
      pouchdb: 'PouchDB',
      'pouchdb-authentication': 'PouchDBAuthentication',
      'xml-js': 'xmlJs',
      uki: 'uki',
      scalpel: 'scalpel'
    }
  },
  plugins: [
    nodeResolve({
      module: true,
      jsnext: true,
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    globals(),
    json(),
    string({
      include: '**/*.text.*'
    }),
    babel({
      exclude: 'node_modules/**',
      externalHelpers: true
    })
  ],
  external: external,
  onwarn: warning => {
    if (warning.code !== 'EVAL' ||
          !(/eslint-disable-line no-eval/.test(warning.frame))) {
      console.warn(warning.message);
    }
  }
};
