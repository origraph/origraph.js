import Mure from './Mure.js';
import D3Node from 'd3-node';
import pkg from '../package.json';
let d3n = new D3Node();
// Attach a few extra shims for testing
d3n.window.localStorage = { getConstruct: () => null };

let PouchDB = require('pouchdb-node')
  .plugin(require('pouchdb-find'))
  .plugin(require('pouchdb-authentication'));

let mure = new Mure(PouchDB, d3n.d3, d3n);
mure.version = pkg.version;

export default mure;
