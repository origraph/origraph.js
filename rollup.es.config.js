import json from 'rollup-plugin-json';

export default {
  entry: 'src/mure.js',
  dest: 'build/mure.es.js',
  format: 'es',
  sourceMap: 'inline',
  plugins: [
    json()
  ],
  external: [
    'pouchdb',
    'uki'
  ]
};
