import Mure from './Mure/index.js';
import * as d3 from 'd3';
import pkg from '../package.json';
import PouchDB from 'pouchdb-browser';
import PouchAuthentication from 'pouchdb-authentication';
PouchDB.plugin(PouchAuthentication);

let mure = new Mure(PouchDB, d3);
mure.version = pkg.version;

export default mure;
