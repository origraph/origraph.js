import PouchDB from 'pouchdb';
console.log(PouchDB);
import PouchDBAuthentication from 'pouchdb-authentication';
PouchDB.plugin(PouchDBAuthentication);
export default PouchDB;
