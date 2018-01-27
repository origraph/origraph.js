import Mure from './Mure/index.js';
import D3Node from 'd3-node';
var d3n = new D3Node();
var PouchDB = require('pouchdb-node')
  .plugin(require('pouchdb-authentication'));

export default new Mure(PouchDB, d3n.d3, d3n);
