import Mure from './Mure/index.js';
import * as d3 from 'd3';
import PouchDB from 'pouchdb';
import PouchAuthentication from 'pouchdb-authentication';
PouchDB.plugin(PouchAuthentication);

export default new Mure(PouchDB, d3);
