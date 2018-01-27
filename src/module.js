import Mure from './Mure/index.js';
import * as d3 from 'd3';
var PouchDB = require('pouchdb-browser')
  .plugin(require('pouchdb-authentication'));

export default new Mure(PouchDB, d3);
