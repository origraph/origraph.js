import Mure from './Mure/index.js';
import D3Node from 'd3-node';
import PouchDB from 'pouchdb-node';
const d3n = new D3Node();

export default new Mure(PouchDB, d3n.d3, d3n);
