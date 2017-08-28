/* eslint no-useless-escape: 0 */
import * as d3 from 'd3';
import PouchDB from 'pouchdb';
import { Model } from 'uki';
import appList from './appList.json';
import mureInteractivityRunnerText from './mureInteractivityRunner.js';

class Mure extends Model {
  constructor () {
    super();
    this.appList = appList;
    // Check if we're even being used in the browser (mostly useful for getting
    // access to the applist in all-apps-dev-server.js)
    if (typeof document === 'undefined' || typeof window === undefined) {
      return;
    }

    // The namespace string for our custom XML
    this.NSString = 'http://mure-apps.github.io';
    d3.namespaces.mure = this.NSString;

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
    this.on('error', errorMessage => {
      console.warn(errorMessage);
    });
    this.catchDbError = errorObj => { this.trigger('error', 'Unexpected error reading PouchDB:\n' + errorObj.stack); };

    // in the absence of a custom dialogs, just use window.prompt and window.confirm:
    this.prompt = (message, defaultValue) => {
      return new Promise((resolve, reject) => {
        resolve(window.prompt(message, defaultValue));
      });
    };
    this.confirm = (message) => {
      return new Promise((resolve, reject) => {
        resolve(window.confirm(message));
      });
    };
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
    }).on('change', async change => {
      if (change.id === 'userPrefs') {
        if (this.lastFile !== change.doc.currentFile) {
          // Different filename... a new one was opened, or the current file was deleted
          this.lastFile = change.doc.currentFile;
          // This will have changed the current file list
          this.trigger('fileListChange', await this.getFileList());
        }
        // Whether we have a new file, or the current one was updated, fire a fileChange event
        this.trigger('fileChange', await this.getFile(change.doc.currentFile));
      } else if (change.deleted && change.id !== this.lastFile) {
        // If a file is deleted that wasn't opened, it won't ever cause a change
        // to userPrefs. So we need to fire fileListChange immediately.
        this.trigger('fileListChange', await this.getFileList());
      }
    }).on('error', errorObj => {
      this.catchDbError(errorObj);
    });
    return db;
  }
  async setCurrentFile (filename) {
    return this.db.get('userPrefs').then(prefs => {
      prefs.currentFile = filename;
      return this.db.put(prefs);
    }).catch(this.catchDbError);
  }
  async getCurrentFilename () {
    return this.db.get('userPrefs').then(prefs => {
      return prefs.currentFile;
    });
  }
  async getFile (filename) {
    if (filename) {
      return this.db.get(filename, { attachments: true })
        .then(dbEntry => {
          return {
            base64string: dbEntry._attachments[filename].data,
            metadata: dbEntry.metadata
          };
        }).catch(this.catchDbError);
    } else {
      return Promise.resolve(null);
    }
  }
  async getFileBlob (filename) {
    if (filename) {
      return this.db.getAttachment(filename, filename)
        .catch(this.catchDbError);
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
  async saveFile (filename, options) {
    try {
      let existingDoc;
      if (!options.blobOrBase64string) {
        existingDoc = await this.db.get(filename);
      } else {
        existingDoc = await this.db.get(filename, { attachments: true });
        existingDoc._attachments[filename].data = options.blobOrBase64string;
        if ((!options.metadata || Object.keys(options.metadata).length === 0) &&
          Object.keys(existingDoc.metadata) > 0) {
          let userConfirmation = await this.confirm(
            'It appears that the file you\'re uploading has lost its Mure metadata. ' +
            'This is fairly common when you\'ve edited it with an external program.\n\n' +
            'Restore the most recent metadata?');
          if (!userConfirmation) {
            existingDoc.metadata = {};
          }
        }
      }
      if (options.metadata) {
        existingDoc.metadata = options.metadata;
      }
      return await this.db.put(existingDoc);
    } catch (errorObj) {
      if (errorObj.message === 'missing') {
        // The file doesn't exist yet...
        let newDoc = {
          _id: filename,
          _attachments: {},
          metadata: options.metadata || {}
        };
        if (!options.blobOrBase64string) {
          this.trigger('error', 'Attempted to save a file without contents!');
        }
        newDoc._attachments[filename] = {
          content_type: 'image/svg+xml',
          data: options.blobOrBase64string
        };
        return await this.db.put(newDoc);
      } else {
        this.catchDbError(errorObj);
        return Promise.resolve(null);
      }
    }
  }
  async getFileList () {
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
  async getFileRevisions () {
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
  async uploadSvg (fileObj) {
    let reader = new window.FileReader();
    let contentsPromise = new Promise((resolve, reject) => {
      reader.onloadend = xmlText => {
        resolve(xmlText.target.result);
      };
      reader.onerror = error => {
        reject(error);
      };
      reader.onabort = () => {
        reject(Mure.SIGNALS.cancelled);
      };
      reader.readAsText(fileObj);
    }).then(xmlText => {
      let dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
      let contents = { metadata: this.extractMetadata(dom, true) };
      contents.base64data = window.btoa(new window.XMLSerializer().serializeToString(dom));
      return contents;
    });

    let filenamePromise = this.getFileRevisions()
      .catch(this.catchDbError)
      .then(async revisionDict => {
        // Ask multiple times if the user happens to enter another filename that already exists
        let filename = fileObj.name;
        while (revisionDict[filename]) {
          let filename = await this.prompt(
            fileObj.name + ' already exists. Pick a new name, or leave it the same to overwrite:',
            fileObj.name);
          if (filename === null) {
            reader.abort();
            return Promise.reject(Mure.SIGNALS.cancelled);
          } else if (filename === '') {
            filename = await this.prompt('You must enter a file name (or hit cancel to cancel the upload)');
          } else if (filename === fileObj.name) {
            // They left it the same... overwrite!
            return filename;
          }
        }
        return filename;
      });

    return Promise.all([filenamePromise, contentsPromise]).then(([filename, contents]) => {
      return this.saveFile(filename, {
        blobOrBase64string: contents.base64data,
        metadata: contents.metadata
      }).then(() => {
        return this.setCurrentFile(filename);
      });
    }).catch(([fileErr, nameErr]) => {
      if (fileErr === Mure.SIGNALS.cancelled && nameErr === Mure.SIGNALS.cancelled) {
        return; // cancelling is not a problem
      } else {
        return Promise.reject([fileErr, nameErr]);
      }
    });
  }
  async deleteSvg (filename) {
    let userConfirmation = await this.confirm('Are you sure you want to delete ' + filename + '?');
    if (userConfirmation) {
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
    } else {
      return Promise.resolve(false);
    }
  }
  extractMetadata (dom, remove) {
    let metadata = {};
    let d3dom = d3.select(dom.rootElement);

    // Extract the container for our metadata, if it exists
    let root = d3dom.select('#mure');
    if (root.size() === 0) {
      return metadata;
    }
    let nsElement = root.select('mure');
    if (nsElement.size() === 0) {
      return metadata;
    }

    // Any libraries?
    nsElement.selectAll('library').each(function (d) {
      if (!metadata.libraries) {
        metadata.libraries = [];
      }
      metadata.libraries.push(d3.select(this).attr('src'));
    });

    // Any scripts?
    nsElement.selectAll('script').each(function (d) {
      let el = d3.select(this);
      let script = {
        text: el.text().replace(/(<!\[CDATA\[)/g, '').replace(/]]>/g, '')
      };
      let id = el.attr('id');
      if (id) {
        if (id === 'mureInteractivityRunner') {
          // Don't store our interactivity runner script
          return;
        }
        script.id = id;
      }
      if (!metadata.scripts) {
        metadata.scripts = [];
      }
      metadata.scripts.push(script);
    });

    // Any data bindings?
    nsElement.selectAll('binding').each(function (d) {
      let el = d3.select(this);
      let binding = {
        dataRoot: el.attr('dataroot'),
        svgRoot: el.attr('svgroot')
      };
      let keyFunction = el.attr('keyfunction');
      if (keyFunction) {
        binding.keyFunction = keyFunction;
      } else {
        let customMatching = el.text().replace(/(<!\[CDATA\[)/g, '').replace(/]]>/g, '');
        binding.customMatching = JSON.parse(customMatching);
      }

      if (!metadata.bindings) {
        metadata.bindings = [];
      }
      metadata.bindings.push(binding);
    });

    // TODO: Any encodings?

    if (remove) {
      root.remove();
    }

    return metadata;
  }
  embedMetadata (dom, metadata) {
    let d3dom = d3.select(dom.rootElement);

    // Top: need a metadata tag
    let root = d3dom.selectAll('#mure').data([0]);
    root.exit().remove();
    root = root.enter().append('metadata').attr('id', 'mure').merge(root);

    // Next down: a tag to define the namespace
    let nsElement = root.selectAll('mure').data([0]);
    nsElement.exit().remove();
    nsElement = nsElement.enter().append('mure').attr('xmlns', this.NSString).merge(nsElement);

    // Okay, we're in our custom namespace... let's figure out the libraries
    let libraryList = metadata.libraries || [];
    let libraries = nsElement.selectAll('library').data(libraryList);
    libraries.exit().remove();
    libraries = libraries.enter().append('library').merge(libraries);
    libraries.attr('src', d => d);

    // Let's deal with any user scripts; and include the mureInteractivityRunner script if necessary
    let scriptList = metadata.scripts || [];
    if (scriptList.length > 0 || libraryList.length > 0) {
      scriptList.push({
        id: 'mureInteractivityRunner',
        text: mureInteractivityRunnerText
      });
    }
    let scripts = nsElement.selectAll('script').data(scriptList);
    scripts.exit().remove();
    let scriptsEnter = scripts.enter().append('script');
    scripts = scriptsEnter.merge(scripts);
    scripts.attr('id', d => d.id || null);
    scripts.each(function (d) {
      this.innerHTML = '<![CDATA[' + d.text + ']]>';
    });

    // Store data bindings
    let bindings = nsElement.selectAll('binding').data(metadata.bindings || []);
    bindings.exit().remove();
    let bindingsEnter = bindings.enter().append('binding');
    bindings = bindingsEnter.merge(bindings);
    bindings
      .attr('dataroot', d => d.dataRoot)
      .attr('svgroot', d => d.svgRoot)
      .attr('keyfunction', d => d.keyFunction || null)
      .each(function (d) {
        if (d.customMatching) {
          this.innerHTML = '<![CDATA[' + JSON.stringify(d.customMatching) + ']]>';
        } else {
          this.innerHTML = '';
        }
      });

    // TODO: Store encoding metadata
  }
  async downloadSvg (filename) {
    let mureFile;
    try {
      // Embed mureFile.metadata as XML inside mureFile.base64data
      mureFile = await this.getFile(filename);
    } catch (error) {
      this.catchDbError(error);
      return;
    }
    let xmlText = window.atob(mureFile.base64string);
    let dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
    this.embedMetadata(dom, mureFile.metadata);
    xmlText = new window.XMLSerializer().serializeToString(dom);
    xmlText = xmlText.replace(/&lt;!\[CDATA\[/g, '<!\[CDATA\[').replace(/]]&gt;/g, ']]>');

    // create a fake link to initiate the download
    let a = document.createElement('a');
    a.style = 'display:none';
    let url = window.URL.createObjectURL(new window.Blob([xmlText], { type: 'image/svg+xml' }));
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.parentNode.removeChild(a);
  }
}

Mure.VALID_EVENTS = {
  fileListChange: true,
  fileChange: true,
  error: true,
  svgLoaded: true
};

Mure.SIGNALS = {
  cancelled: true
};

let mure = new Mure();
export default mure;
