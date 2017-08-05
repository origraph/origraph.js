import PouchDB from 'pouchdb';
import appList from './appList.json';
import { Model } from 'uki';

class Mure extends Model {
  constructor () {
    super();
    this.appList = appList;
    // Funky stuff to figure out if we're debugging (if that's the case, we want to use
    // localhost instead of the github link for all links)
    let windowTitle = document.getElementsByTagName('title')[0];
    windowTitle = windowTitle ? windowTitle.textContent : '';
    this.debugMode = window.location.hostname === 'localhost' && windowTitle.startsWith('Mure');

    // Figure out which app we are (or null if the mure library is being used somewhere else)
    this.currentApp = window.location.pathname.replace(/\//g, '');
    if (!this.appList[this.currentApp]) {
      this.currentApp = null;
    }

    // Create / load the local database of files
    this.lastFile = null;
    this.db = this.getOrInitDb();

    this.loadUserLibraries = false;
    this.runUserScripts = false;

    // default error handling (apps can listen for / display error messages in addition to this):
    this.on('error', errorMessage => { console.warn(errorMessage); });
    this.catchDbError = errorObj => { this.trigger('error', 'Unexpected error reading PouchDB:\n' + errorObj.stack); };

    // in the absence of a custom dialogs, just use window.prompt:
    this.prompt = window.prompt;
    this.confirm = window.confirm;
  }
  getOrInitDb () {
    let db = new PouchDB('mure');
    db.get('userPrefs').then(prefs => {
      this.lastFile = prefs.currentFile;
    }).catch(errorObj => {
      if (errorObj.message === 'missing') {
        return db.put({
          _id: 'userPrefs',
          currentFile: null
        });
      } else {
        this.catchDbError(errorObj);
      }
    });
    db.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', change => {
      if (change.id === 'userPrefs') {
        if (this.lastFile !== change.doc.currentFile) {
          // Different filename... a new one was opened, or the current file was deleted
          this.lastFile = change.doc.currentFile;
          // This will have changed the current file list
          this.getFileList().then(fileList => {
            this.trigger('fileListChange', fileList);
          });
        }
        // Whether we have a new file, or the current one was updated, fire a fileChange event
        this.getFile(change.doc.currentFile).then(fileBlob => {
          this.trigger('fileChange', fileBlob);
        });
      } else if (change.deleted && change.id !== this.lastFile) {
        // If a file is deleted that wasn't opened, it won't ever cause a change
        // to userPrefs. So we need to fire fileListChange immediately.
        this.getFileList().then(fileList => {
          this.trigger('fileListChange', fileList);
        });
      }
    }).on('error', errorObj => {
      this.catchDbError(errorObj);
    });
    return db;
  }
  setCurrentFile (filename) {
    return this.db.get('userPrefs').then(prefs => {
      prefs.currentFile = filename;
      return this.db.put(prefs);
    }).catch(this.catchDbError);
  }
  getCurrentFilename () {
    return this.db.get('userPrefs').then(prefs => {
      return prefs.currentFile;
    });
  }
  getFile (filename) {
    if (filename) {
      return this.db.getAttachment(filename, filename);
    } else {
      return Promise.resolve(null);
    }
  }
  signalSvgLoaded (loadUserLibrariesFunc, runUserScriptsFunc) {
    // Only load the SVG's linked libraries + embedded scripts if we've been told to
    let callback = this.runUserScripts ? runUserScriptsFunc : () => {};
    if (this.loadUserLibraries) {
      loadUserLibrariesFunc(callback);
    }
    this.trigger('svgLoaded');
  }
  on (eventName, callback) {
    if (!Mure.VALID_EVENTS[eventName]) {
      throw new Error('Unknown event name: ' + eventName);
    } else {
      super.on(eventName, callback);
    }
  }
  customizeConfirmDialog (showDialogFunction) {
    this.confirm = showDialogFunction;
  }
  customizePromptDialog (showDialogFunction) {
    this.prompt = showDialogFunction;
  }
  openApp (appName) {
    window.open('/' + appName, '_blank');
  }
  getSvgBlob (filename) {
    return this.db.getAttachment(filename, filename)
      .catch(this.catchDbError);
  }
  saveSvgBlob (filename, blob) {
    let dbEntry = {
      _id: filename,
      _attachments: {}
    };
    dbEntry._attachments[filename] = {
      content_type: blob.type,
      data: blob
    };
    return this.db.get(filename).then(existingDoc => {
      // the file exists... overwrite the document
      dbEntry._rev = existingDoc._rev;
      return this.db.put(dbEntry);
    }).catch(errorObj => {
      if (errorObj.message === 'missing') {
        // the file doesn't exist yet...
        return this.db.put(dbEntry);
      } else {
        this.catchDbError(errorObj);
      }
    });
  }
  getFileList () {
    return this.db.allDocs()
      .then(response => {
        let result = [];
        response.rows.forEach(d => {
          if (d.id !== 'userPrefs') {
            result.push(d.id);
          }
        });
        return result;
      }).catch(this.catchDbError);
  }
  getFileRevisions () {
    return this.db.allDocs()
      .then(response => {
        let result = {};
        response.rows.forEach(d => {
          if (d.id !== 'userPrefs') {
            result[d.id] = d.value.rev;
          }
        });
        return result;
      }).catch(this.catchDbError);
  }
  uploadSvg (fileObj) {
    let filename = fileObj.name;
    return this.getFileRevisions().then(revisionDict => {
      // Ask multiple times if the user happens to enter another filename that already exists
      while (revisionDict[filename]) {
        let newName = this.prompt.call(window,
          fileObj.name + ' already exists. Pick a new name, or leave it the same to overwrite:',
          fileObj.name);
        if (!newName) {
          return null;
        } else if (newName === filename) {
          return filename;
        } else {
          filename = newName;
        }
      }
      return filename;
    }).then(filename => {
      if (filename) {
        return this.saveSvgBlob(filename, fileObj).then(() => {
          return this.setCurrentFile(filename);
        });
      }
    }).catch(this.catchDbError);
  }
  deleteSvg (filename) {
    if (this.confirm.call(window, 'Are you sure you want to delete ' + filename + '?')) {
      return Promise.all([this.db.get(filename), this.getCurrentFilename()]).then(promiseResults => {
        let existingDoc = promiseResults[0];
        let currentFile = promiseResults[1];
        return this.db.remove(existingDoc._id, existingDoc._rev)
          .then(removeResponse => {
            if (filename === currentFile) {
              this.setCurrentFile(null).catch(this.catchDbError);
            }
            return removeResponse;
          });
      }).catch(this.catchDbError);
    }
  }
  downloadSvg (filename) {
    this.getSvgBlob(filename).then(blob => {
      // create a fake link...
      let a = document.createElement('a');
      a.style = 'display:none';
      let url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.parentNode.removeChild(a);
    }).catch(this.catchDbError);
  }
}

Mure.VALID_EVENTS = {
  fileListChange: true,
  fileChange: true,
  error: true,
  svgLoaded: true
};

let mure = new Mure();
window.mure = mure;
export default mure;
