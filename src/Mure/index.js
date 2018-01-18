import { Model } from 'uki';
import docH from '../DocHandler/index.js';

class Mure extends Model {
  constructor (PouchDB, d3, d3n) {
    super();

    this.PouchDB = PouchDB; // for Node.js, this will be pouchdb-node, not the regular one
    this.d3 = d3; // for Node.js, this will be from d3-node, not the regular one
    this.d3n = d3n; // in Node, we also need access to the higher-level stuff from d3-node

    // Enumerations...
    this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

    // The namespace string for our custom XML
    this.NSString = 'http://mure-apps.github.io';
    this.d3.namespaces.mure = this.NSString;

    // Create / load the local database of files
    this.db = new this.PouchDB('mure');

    // default error handling (apps can listen for / display error messages in addition to this):
    this.on('error', errorMessage => {
      console.warn(errorMessage);
    });
    this.catchDbError = errorObj => {
      this.trigger('error', 'Unexpected error reading PouchDB: ' + errorObj.message + '\n' + errorObj.stack);
    };

    // in the absence of a custom dialogs, just use window.alert, window.confirm and window.prompt:
    this.alert = (message) => {
      return new Promise((resolve, reject) => {
        window.alert(message);
        resolve(true);
      });
    };
    this.confirm = (message) => {
      return new Promise((resolve, reject) => {
        resolve(window.confirm(message));
      });
    };
    this.prompt = (message, defaultValue) => {
      return new Promise((resolve, reject) => {
        resolve(window.prompt(message, defaultValue));
      });
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
      window.open('/' + appName, '_blank');
    } else {
      window.location.pathname = '/' + appName;
    }
  }
  getOrInitDb () {
    let db = new this.PouchDB('mure');
    let couchDbUrl = window.localStorage.getItem('couchDbUrl');
    if (couchDbUrl) {
      (async () => {
        let couchDb = new this.PouchDB(couchDbUrl, {skip_setup: true});
        return db.sync(couchDb, {live: true, retry: true});
      })().catch(err => {
        this.alert('Error syncing with ' + couchDbUrl + ': ' +
          err.message);
      });
    }
    return db;
  }
  /**
   * A wrapper around PouchDB.get() that ensures that the returned document
   * exists (uses default.text.svg when it doesn't), and has at least the
   * elements specified by minimum.text.svg
   * @return {object} A PouchDB document
   */
  getStandardizedDoc (docId) {
    return this.db.get(docId)
      .catch(err => {
        if (err.name === 'not_found') {
          return {
            _id: docId,
            currentSelection: null,
            contents: JSON.parse(docH.defaultJsonDoc)
          };
        } else {
          throw err;
        }
      }).then(doc => {
        return docH.standardize(doc);
      });
  }
  /**
   *
   */
  async downloadDoc (docId) {
    return this.db.get(docId)
      .then(doc => {
        let xmlText = docH.js2xml(doc.contents);

        // create a fake link to initiate the download
        let a = document.createElement('a');
        a.style = 'display:none';
        let url = window.URL.createObjectURL(new window.Blob([xmlText], { type: 'image/svg+xml' }));
        a.href = url;
        a.download = doc._id;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.parentNode.removeChild(a);
      });
  }
}

export default Mure;
