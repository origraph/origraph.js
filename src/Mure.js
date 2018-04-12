import mime from 'mime-types';
import jsonPath from 'jsonpath';
import { Model } from 'uki';
import Selection from './Selection.js';
import DocHandler from './DocHandler.js';
import ItemHandler from './ItemHandler.js';

class Mure extends Model {
  constructor (PouchDB, d3, d3n) {
    super();
    this.PouchDB = PouchDB; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3; // for Node.js, this will be from d3-node, not the regular one

    if (d3n) {
      // to run tests, we also need access to the d3-node wrapper (we don't
      // import it directly into the tests to make sure that the namespace
      // addition below works)
      this.d3n = d3n;
      this.window = this.d3n.window;
    } else {
      this.window = window;
    }

    // The namespace string for our custom XML
    this.NSString = 'http://mure-apps.github.io';
    this.d3.namespaces.mure = this.NSString;

    this.docHandler = new DocHandler(this);
    this.itemHandler = new ItemHandler(this);

    // Create / load the local database of files
    this.getOrInitDb();

    // in the absence of a custom dialogs, just use window.alert,
    // window.confirm, window.prompt, console.warn, and console.log:
    this.alert = (message) => {
      return new Promise((resolve, reject) => {
        this.window.alert(message);
        resolve(true);
      });
    };
    this.confirm = (message) => {
      return new Promise((resolve, reject) => {
        resolve(this.window.confirm(message));
      });
    };
    this.prompt = (message, defaultValue) => {
      return new Promise((resolve, reject) => {
        resolve(this.window.prompt(message, defaultValue));
      });
    };
    this.warn = function () {
      console.warn(...arguments);
    };
    this.log = function () {
      console.log(...arguments);
    };
  }
  customizeAlertDialog (showDialogFunction) {
    this.alert = showDialogFunction;
  }
  customizeConfirmDialog (showDialogFunction) {
    this.confirm = showDialogFunction;
  }
  customizePromptDialog (showDialogFunction) {
    this.prompt = showDialogFunction;
  }
  getOrInitDb () {
    this.db = new this.PouchDB('mure');
    this.dbStatus = new Promise((resolve, reject) => {
      (async () => {
        let status = { synced: false };
        let couchDbUrl = this.window.localStorage.getItem('couchDbUrl');
        if (couchDbUrl) {
          let couchDb = new this.PouchDB(couchDbUrl, {skip_setup: true});
          status.synced = !!(await this.db.sync(couchDb, {live: true, retry: true})
            .catch(err => {
              this.alert('Error syncing with ' + couchDbUrl + ': ' +
                err.message);
              return false;
            }));
        }
        status.indexed = !!(await this.db.createIndex({
          index: {
            fields: ['filename']
          }
        }).catch(() => false));
        status.linkedViewSpec = !!(await this.db.put({
          _id: '$linkedViewSpec',
          selector: '@$.classes[*]',
          settings: {}
        }).catch(() => false));
        this.db.changes({
          since: 'now',
          live: true
        }).on('change', change => {
          if (change.id > '_\uffff') {
            // A regular document changed
            this.trigger('docChange', change);
          } else if (change.id === '$linkedViewSpec') {
            // The linked views changed
            this.trigger('linkedViewChange', this.formatLinkedViewSpec(change));
          }
        }).on('error', err => {
          this.warn(err);
        });
        resolve(status);
      })();
    });
  }
  async query (queryObj) {
    let queryResult = await this.db.find(queryObj);
    if (queryResult.warning) { this.warn(queryResult.warning); }
    return queryResult.docs;
  }
  /**
   * A wrapper around PouchDB.get() that ensures that the first matched
   * document exists (optionally creates an empty document when it doesn't), and
   * that it conforms to the specifications outlined in documentation/schema.md
   * @param  {Object|string}  [docQuery]
   * The `selector` component of a Mango query, or, if a string, the precise
   * document _id
   * @param  {{boolean}}  [init=true]
   * If true (default), the document will be created (but not saved) if it does
   * not exist. If false, the returned Promise will resolve to null
   * @return {Promise}
   * Resolves the document
   */
  async getDoc (docQuery, { init = true } = {}) {
    let doc;
    if (!docQuery) {
      return this.docHandler.standardize({});
    } else {
      if (typeof docQuery === 'string') {
        if (docQuery[0] === '@') {
          docQuery = JSON.parse(docQuery.slice(1));
        } else {
          docQuery = { '_id': docQuery };
        }
      }
      let matchingDocs = await this.query({ selector: docQuery, limit: 1 });
      if (matchingDocs.length === 0) {
        if (init) {
          // If missing, use the docQuery itself as the template for a new doc
          doc = await this.docHandler.standardize(docQuery);
        } else {
          return null;
        }
      } else {
        doc = matchingDocs[0];
      }
      return doc;
    }
  }
  async putDoc (doc) {
    try {
      return this.db.put(doc);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  async putDocs (docList) {
    try {
      return this.db.bulkDocs(docList);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  /**
   * Downloads a given file, optionally specifying a particular format
   * @param  {Object|string}  docQuery
   * The `selector` component of a Mango query, or, if a string, the precise
   * document _id
   * @param  {{string|null}}  [mimeType=null]
   * Overrides the document's mimeType in formatting the download
   * @return {Promise}
   * Resolves as `true` once the download is initiated
   */
  async downloadDoc (docQuery, { mimeType = null } = {}) {
    return this.getDoc(docQuery)
      .then(doc => {
        mimeType = mimeType || doc.mimeType;
        let contents = this.docHandler.formatDoc(doc, { mimeType });

        // create a fake link to initiate the download
        let a = document.createElement('a');
        a.style = 'display:none';
        let url = this.window.URL.createObjectURL(new window.Blob([contents], { type: mimeType }));
        a.href = url;
        a.download = doc._id;
        document.body.appendChild(a);
        a.click();
        this.window.URL.revokeObjectURL(url);
        a.parentNode.removeChild(a);

        return true;
      });
  }
  async uploadFileObj (fileObj, { encoding = mime.charset(fileObj.type) } = {}) {
    let string = await new Promise((resolve, reject) => {
      let reader = new window.FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsText(fileObj, encoding);
    });
    return this.uploadString(fileObj.name, fileObj.type, encoding, string);
  }
  async uploadString (filename, mimeType, encoding, string) {
    let doc = await this.docHandler.parse(string, { mimeType });
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc (filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await this.docHandler.standardize(doc);
    return this.putDoc(doc);
  }
  async deleteDoc (docQuery) {
    let doc = await this.getDoc(docQuery);
    return this.putDoc({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true
    });
  }
  mergeSelectors (selectorList) {
    throw new Error('unimplemented');
  }
  pathsToSelector (paths = [[Selection.DEFAULT_DOC_QUERY]]) {
    throw new Error('unimplemented');
  }
  pathToSelector (path = [Selection.DEFAULT_DOC_QUERY]) {
    let docQuery = path[0];
    let objQuery = path.slice(1);
    objQuery = objQuery.length > 0 ? jsonPath.stringify(objQuery) : '';
    return '@' + docQuery + objQuery;
  }
  selectDoc (docId) {
    return this.select('@{"_id":"' + docId + '"}');
  }
  select (selector) {
    if (selector instanceof Array) {
      selector = selector[0];
    }
    return new Selection(this, selector, { selectSingle: true });
  }
  selectAll (selector) {
    if (selector instanceof Array) {
      selector = this.mergeSelectors(selector);
    }
    return new Selection(this, selector);
  }
  async setLinkedViews ({ selector, settings } = {}) {
    let linkedViewSpec = await this.db.get('$linkedViewSpec');
    linkedViewSpec.selector = selector || linkedViewSpec.selector;
    linkedViewSpec.settings = settings || linkedViewSpec.settings;
    return this.putDoc(linkedViewSpec);
  }
  async getLinkedViews () {
    return this.db.get('$linkedViewSpec');
  }
}

export default Mure;
