import json from 'rollup-plugin-json';
import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/mure.js',
  dest: 'build/mure.umd.js',
  format: 'umd',
  moduleName: 'mure',
  sourceMap: 'inline',
  plugins: [
    json(),
    babel({
      exclude: 'node_modules/**'
    })
  ],
  globals: {
    pouchdb: 'PouchDB',
    uki: 'uki'
  },
  external: [
    'pouchdb',
    'uki'
  ]
};
