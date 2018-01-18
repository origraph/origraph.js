import Mure from './Mure/index.js';
import * as d3 from 'd3';
import PouchDB from 'pouchdb';
import PouchDBAuthentication from 'pouchdb-authentication';
PouchDB.plugin(PouchDBAuthentication);

export default new Mure(PouchDB, d3);
