import mime from 'mime-types';
import { Model } from 'uki';
import Selection from '../Selection/index.js';
import DocHandler from '../DocHandler/index.js';

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

    // Create / load the local database of files
    this.getOrInitDb();

    // default error handling (apps can listen for / display error messages in addition to this):
    this.on('error', errorMessage => {
      console.warn(errorMessage);
    });
    this.catchDbError = errorObj => {
      this.trigger('error', 'Unexpected error reading PouchDB: ' + errorObj.message + '\n' + errorObj.stack);
    };

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
  openApp (appName, newTab) {
    if (newTab) {
      this.window.open('/' + appName, '_blank');
    } else {
      this.window.location.pathname = '/' + appName;
    }
  }
  async getOrInitDb () {
    this.db = new this.PouchDB('mure');
    let status = {
      synced: false,
      indexed: false
    };
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
    return status;
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
      doc = {};
    } else {
      if (typeof docQuery === 'string') {
        docQuery = { '_id': docQuery };
      }
      let matchingDocs = await this.db.find({ selector: docQuery, limit: 1 });
      if (matchingDocs.docs.length === 0) {
        if (init) {
          // If missing, use the docQuery itself as the template for a new doc
          doc = docQuery;
        } else {
          return null;
        }
      } else {
        doc = matchingDocs.docs[0];
      }
    }
    return this.docHandler.standardize(doc);
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
    return this.uploadString(fileObj.name, fileObj.type, string);
  }
  async uploadString (filename, mimeType, string) {
    let doc = await this.docHandler.parse(string, { mimeType });
    return this.uploadDoc(filename, mimeType, doc);
  }
  async uploadDoc (filename, mimeType, doc) {
    doc = await this.docHandler.standardize(doc, { purgeArrays: true });
    return this.db.put(doc);
  }
  async saveDoc (doc) {
    return this.db.put(await this.docHandler.standardize(doc));
  }
  async deleteDoc (docQuery) {
    let doc = await this.getDoc(docQuery);
    return this.db.put({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true
    });
  }
  /**
   * Evaluate a reference string
   *
   * A context object must be provided, either directly via the `context`
   * parameter, or a document can be specified as part of the selector
   *
   * @param  {string}  selector
   * A selector string, as outlined in documentation/schema.md
   * @param  {{Object}}  [context=null]
   * The context in which the selector should be evaluated (will be
   * overridden if the selector specifies a document)
   * @return {Selection}
   * A wrapper object for interacting / rehaping the selected object(s) / value(s)
   */
  selectAll (selector, { context = null } = {}) {
    let docSelector = /@\s*({.*})/g.exec(selector);
    if (docSelector && docSelector.length > 1) {
      docSelector = docSelector[1];
      selector = selector.replace(docSelector, '');
      docSelector = JSON.parse(docSelector);
      context = this.getDoc(docSelector, false);
    }
    if (!context) {
      this.error('Could not find context for selection');
    }
    return new Selection(selector, context);
  }
}

export default Mure;
