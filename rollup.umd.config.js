import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-babel';

export default {
  input: 'src/mure.js',
  name: 'mure',
  sourcemap: 'inline',
  output: {
    file: 'build/mure.umd.js',
    format: 'umd'
  },
  plugins: [
    json(),
    babel({
      exclude: 'node_modules/**'
    })
  ],
  globals: {
    pouchdb: 'PouchDB',
    uki: 'uki',
    d3: 'd3',
    datalib: 'datalib',
    jsonpath: 'jsonpath',
    md5: 'md5',
    jquery: 'jQuery'
  },
  external: [
    'pouchdb',
    'uki',
    'd3',
    'datalib',
    'jsonpath',
    'md5',
    'jquery',
    'babel-polyfill'
  ]
};
