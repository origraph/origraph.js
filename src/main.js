import Mure from './Mure/index.js';
import D3Node from 'd3-node';
import pkg from '../package.json';
let d3n = new D3Node();
let PouchDB = require('pouchdb-node')
  .plugin(require('pouchdb-find'))
  .plugin(require('pouchdb-authentication'));

let mure = new Mure(PouchDB, d3n.d3, d3n);
mure.version = pkg.version;

export default mure;
