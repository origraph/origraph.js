/* eslint no-useless-escape: 0 */
import 'babel-polyfill';
import * as d3 from 'd3';
import datalib from 'datalib';
import md5 from 'md5';
import * as jsonpath from 'jsonpath';
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
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    // Enumerations...
    this.VALID_EVENTS = {
      fileListChange: {},
      fileChange: {},
      domChange: {},
      metadataChange: {},
      error: {}
    };

    this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

    this.SIGNALS = {
      cancelled: {}
    };

    this.ENCODING_TYPES = {
      constant: 0
    };

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
  on (eventName, callback) {
    if (!this.VALID_EVENTS[eventName]) {
      throw new Error('Unknown event name: ' + eventName);
    } else {
      super.on(eventName, callback);
    }
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
    let db = new PouchDB('mure');
    (async () => {
      this.lastFile = null;
      try {
        let prefs = await db.get('userPrefs');
        if (prefs.currentFile) {
          this.lastFile = await this.getFile(prefs.currentFile);
        }
      } catch (errorObj) {
        if (errorObj.message === 'missing') {
          db.put({
            _id: 'userPrefs',
            currentFile: null
          });
        } else {
          this.catchDbError(errorObj);
        }
      }
    })();

    db.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', change => {
      let fileChanged;
      let fileListChanged;
      let domChanged;
      let metadataChanged;

      if (change.deleted) {
        if (change.doc._id !== this.lastFile._id) {
          // Weird corner case: if we just deleted a file that wasn't the current one,
          // we won't ever get a change event on the userPrefs object; in that case,
          // we need to trigger the fileListChanged event immediately
          (async () => {
            let fileList = await this.getFileList();
            this.trigger('fileListChange', fileList);
          })().catch(this.catchDbError);
        }
        // Whether or not the deleted file was the currently open one, don't
        // trigger any other events; we want events to fire in context of the
        // new stuff getting loaded below
        return;
      }

      let currentFile;
      if (change.doc._id === 'userPrefs') {
        // We just changed the currently open file; trigger all the events
        fileChanged = fileListChanged = domChanged = metadataChanged = true;
        currentFile = this.lastFile;
      } else {
        if (this.lastFile === null || this.lastFile._id !== change.doc._id) {
          // The file itself is changing; DON'T actually trigger any of the events
          // because userPrefs is about to be changed as well... and things listening
          // to changes that care about checking userPrefs will want to do it with
          // its value updated
          fileChanged = fileListChanged = domChanged = metadataChanged = false;
        } else {
          fileChanged = false;
          domChanged = this.lastFile._attachments[this.lastFile._id].digest !==
            change.doc._attachments[change.doc._id].digest;
          metadataChanged = this.lastFile.metadataDigest !== change.doc.metadataDigest;
        }
        this.lastFile = currentFile = change.doc;
      }

      if (fileChanged) {
        this.trigger('fileChange', currentFile);
      }
      if (fileListChanged) {
        (async () => {
          let fileList = await this.getFileList();
          this.trigger('fileListChange', fileList);
        })().catch(this.catchDbError);
      }
      if (domChanged) {
        (async () => {
          let doc = currentFile ? await this.getFile(currentFile._id, this.CONTENT_FORMATS.blob) : null;
          this.trigger('domChange', doc ? doc._attachments[doc._id].data : null);
        })();
      }
      if (metadataChanged) {
        this.trigger('metadataChange', currentFile ? currentFile.metadata : null);
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
  async getFile (filename, contentFormat) {
    if (!filename) {
      filename = await this.getCurrentFilename();
    }

    let pouchdbOptions = {};
    if (contentFormat !== this.CONTENT_FORMATS.exclude) {
      pouchdbOptions.attachments = true;
      if (contentFormat === this.CONTENT_FORMATS.blob) {
        pouchdbOptions.binary = true;
      }
    }

    if (filename !== null) {
      return this.db.get(filename, pouchdbOptions || {})
        .then(fileObj => {
          if (contentFormat === this.CONTENT_FORMATS.dom) {
            let xmlText = window.atob(fileObj._attachments[fileObj._id].data);
            let dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
            fileObj._attachments[fileObj._id].dom = dom;
          }
          return fileObj;
        });
    } else {
      return Promise.resolve(null);
    }
  }
  async saveFile (options) {
    try {
      let existingDoc;
      if (!options.blobOrBase64string) {
        existingDoc = await this.getFile(options.filename, this.CONTENT_FORMATS.exclude);
      } else {
        existingDoc = await this.getFile(options.filename, this.CONTENT_FORMATS.blob);
        existingDoc._attachments[options.filename].data = options.blobOrBase64string;
        if ((!options.metadata || Object.keys(options.metadata).length === 0) &&
          Object.keys(existingDoc.metadata) > 0) {
          let userConfirmation = await this.confirm(
            'It appears that the file you\'re uploading has lost its Mure metadata. ' +
            'This is fairly common when you\'ve edited it with an external program.\n\n' +
            'Restore the most recent metadata?');
          if (!userConfirmation) {
            existingDoc.metadata = {};
            existingDoc.metadataDigest = md5('{}');
          }
        }
      }
      if (options.metadata) {
        existingDoc.metadata = options.metadata;
        existingDoc.metadataDigest = md5(JSON.stringify(options.metadata));
      }
      return this.db.put(existingDoc);
    } catch (errorObj) {
      if (errorObj.message === 'missing') {
        // The file doesn't exist yet...
        let newDoc = {
          _id: options.filename,
          _attachments: {},
          metadata: options.metadata || {},
          metadataDigest: options.metadata ? md5(JSON.stringify(options.metadata)) : md5('{}')
        };
        if (!options.blobOrBase64string) {
          this.trigger('error', 'Attempted to save a file without contents!');
        }
        newDoc._attachments[options.filename] = {
          content_type: 'image/svg+xml',
          data: options.blobOrBase64string
        };
        return this.db.put(newDoc);
      } else {
        this.catchDbError(errorObj);
        return Promise.reject(errorObj);
      }
    }
  }
  async getMetadata (filename) {
    let currentFile = await this.getFile(filename, this.CONTENT_FORMATS.exclude);
    return currentFile !== null ? currentFile.metadata : null;
  }
  async getCurrentFilename () {
    return this.db.get('userPrefs').then(prefs => {
      return prefs.currentFile;
    });
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
  async readFile (reader, fileObj) {
    return new Promise((resolve, reject) => {
      reader.onloadend = xmlText => {
        resolve(xmlText.target.result);
      };
      reader.onerror = error => {
        reject(error);
      };
      reader.onabort = () => {
        reject(this.SIGNALS.cancelled);
      };
      reader.readAsText(fileObj);
    });
  }
  async validateFileName (originalName, takenNames, abortFunction) {
    // Ask multiple times if the user happens to enter another filename that already exists
    let filename = originalName;
    while (takenNames[filename]) {
      filename = await this.prompt(
        filename + ' already exists. Pick a new name, or leave it the same to overwrite:',
        filename);
      if (filename === null) {
        if (abortFunction) {
          abortFunction();
        }
        return Promise.reject(this.SIGNALS.cancelled);
      } else if (filename === '') {
        filename = await this.prompt('You must enter a file name (or click cancel to cancel the upload)');
      } else if (filename === originalName) {
        // They left it the same... overwrite!
        return filename;
      }
    }
    return filename;
  }
  inferParser (fileObj) {
    let ext = fileObj.type.split('/')[1];
    if (ext === 'csv') {
      return (contents) => { return datalib.read(contents, {type: 'csv', parse: 'auto'}); };
    } else if (ext === 'tsv') {
      return (contents) => { return datalib.read(contents, {type: 'tsv', parse: 'auto'}); };
    } else if (ext === 'dsv') {
      return (contents) => { return datalib.read(contents, {type: 'dsv', parse: 'auto'}); };
    } else if (ext === 'json') {
      // TODO: attempt to auto-discover topojson or treejson?
      return (contents) => { return datalib.read(contents, {type: 'json', parse: 'auto'}); };
    } else {
      return null;
    }
  }
  async uploadDataset (fileObj) {
    let parser = this.inferParser(fileObj);
    if (!parser) {
      let errorObj = new Error('Unknown data file type: ' + fileObj.type);
      this.trigger('error', errorObj);
      return Promise.reject(errorObj);
    }

    let metadata = await this.getMetadata();
    if (metadata === null) {
      let errorObj = new Error('Can\'t embed a data file without an SVG file already open');
      this.trigger('error', errorObj);
      return Promise.reject(errorObj);
    }
    metadata.datasets = metadata.datasets || {};

    let reader = new window.FileReader();
    let dataFileName = await this.validateFileName(fileObj.name, metadata.datasets, reader.abort);
    let fileText = await this.readFile(reader, fileObj);

    metadata.datasets[dataFileName] = parser(fileText);
    return this.saveFile({ metadata });
  }
  async uploadSvg (fileObj) {
    let reader = new window.FileReader();
    let contentsPromise = this.readFile(reader, fileObj)
      .then(xmlText => {
        let dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
        let contents = { metadata: this.extractMetadata(dom) };
        contents.base64data = window.btoa(new window.XMLSerializer().serializeToString(dom));
        return contents;
      });

    let filenamePromise = this.getFileRevisions()
      .catch(this.catchDbError)
      .then(revisionDict => {
        return this.validateFileName(fileObj.name, revisionDict, reader.abort);
      });

    return Promise.all([filenamePromise, contentsPromise]).then(([filename, contents]) => {
      return this.saveFile({
        filename,
        blobOrBase64string: contents.base64data,
        metadata: contents.metadata
      }).then(() => {
        return this.setCurrentFile(filename);
      });
    }).catch((errList) => {
      if (errList[0] !== this.SIGNALS.cancelled || errList[1] !== this.SIGNALS.cancelled) {
        // cancelling is not a problem; only reject if something else happened
        return Promise.reject(errList);
      }
    });
  }
  async deleteSvg (filename) {
    let userConfirmation = await this.confirm('Are you sure you want to delete ' + filename + '?');
    if (userConfirmation) {
      let currentFile = await this.getFile(filename, this.CONTENT_FORMATS.exclude);
      return this.db.remove(currentFile._id, currentFile._rev)
        .then(removeResponse => {
          if (this.lastFile && filename === this.lastFile._id) {
            return this.setCurrentFile(null).then(() => removeResponse);
          }
          return removeResponse;
        });
    } else {
      return Promise.resolve(false);
    }
  }
  extractMetadata (dom) {
    let self = this;
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
        text: self.extractCDATA(el.text())
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

    // Any datasets?
    nsElement.selectAll('datasets').each(function (d) {
      let el = d3.select(this);
      if (!metadata.datasets) {
        metadata.datasets = {};
      }
      metadata.datasets[el.attr('name')] = JSON.parse(self.extractCDATA(el.text()));
    });

    // Any data bindings?
    nsElement.selectAll('binding').each(function (d) {
      let el = d3.select(this);
      let binding = {
        id: el.attr('id'),
        dataRoot: el.attr('dataroot'),
        svgRoot: el.attr('svgroot'),
        keyFunction: JSON.parse(self.extractCDATA(el.text()))
      };

      if (!metadata.bindings) {
        metadata.bindings = {};
      }
      metadata.bindings[binding.id] = binding;
    });

    // Any encodings?
    nsElement.selectAll('encoding').each(function (d) {
      let el = d3.select(this);
      let encoding = {
        id: el.attr('id'),
        bindingId: el.attr('for'),
        spec: JSON.parse(self.extractCDATA(el.text()))
      };

      if (!metadata.encodings) {
        metadata.encodings = {};
      }
      metadata.encodings[encoding.id] = encoding;
    });

    return metadata;
  }
  extractCDATA (str) {
    return str.replace(/(<!\[CDATA\[)/g, '').replace(/]]>/g, '');
  }
  getEmptyBinding (metadata, add) {
    let id = 1;
    /* eslint-disable no-unmodified-loop-condition */
    while (metadata.bindings && metadata.bindings['Binding Set ' + id]) {
      id++;
    }
    /* eslint-enable no-unmodified-loop-condition */
    let newBinding = {
      id: 'Binding Set ' + id,
      svgRoot: ':root',
      dataRoot: metadata.datasets && Object.keys(metadata.datasets).length > 0
        ? '$["' + Object.keys(metadata.datasets)[0] + '"]' : '',
      keyFunction: {
        expression: '(d, e) => d.key === e.index'
      }
    };
    if (add) {
      if (!metadata.bindings) {
        metadata.bindings = {};
      }
      metadata.bindings[newBinding.id] = newBinding;
    }
    return newBinding;
  }
  getEmptyEncoding (metadata, add) {
    let id = 1;
    /* eslint-disable no-unmodified-loop-condition */
    while (metadata.encodings && metadata.encodings['Encoding ' + id]) {
      id++;
    }
    /* eslint-enable no-unmodified-loop-condition */
    let newEncoding = {
      id: 'Encoding ' + id,
      bindingId: '',
      spec: {}
    };
    if (add) {
      if (!metadata.encodings) {
        metadata.encodings = {};
      }
      metadata.encodings[newEncoding.id] = newEncoding;
    }
    return newEncoding;
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

    // Let's deal with any user scripts
    let scriptList = metadata.scripts || [];
    let scripts = nsElement.selectAll('script').data(scriptList);
    scripts.exit().remove();
    let scriptsEnter = scripts.enter().append('script');
    scripts = scriptsEnter.merge(scripts);
    scripts.attr('id', d => d.id || null);
    scripts.each(function (d) {
      this.innerHTML = '<![CDATA[' + d.text + ']]>';
    });

    // Remove mureInteractivityRunner by default to ensure it always comes after the
    // metadata tag (of course, only bother adding it if we have any libraries or scripts)
    d3dom.select('#mureInteractivityRunner').remove();
    if (libraryList.length > 0 || scriptList.length > 0) {
      d3dom.append('script')
        .attr('id', 'mureInteractivityRunner')
        .attr('type', 'text/javascript')
        .text('<![CDATA[' + mureInteractivityRunnerText + ']]');
    }

    // We always store datasets as JSON
    let datasets = nsElement.selectAll('dataset').data(d3.entries(metadata.datasets || {}));
    datasets.exit().remove();
    let datasetsEnter = datasets.enter().append('dataset');
    datasets = datasetsEnter.merge(datasets);
    datasets.attr('name', d => d.key)
      .html(d => '<![CDATA[' + JSON.stringify(d.value) + ']]>');

    // Store data bindings
    let bindings = nsElement.selectAll('binding').data(d3.values(metadata.bindings || {}));
    bindings.exit().remove();
    let bindingsEnter = bindings.enter().append('binding');
    bindings = bindingsEnter.merge(bindings);
    bindings
      .attr('id', d => d.id)
      .attr('dataroot', d => d.dataRoot)
      .attr('svgroot', d => d.svgRoot)
      .html(d => '<![CDATA[' + JSON.stringify(d.keyFunction) + ']]>');

    // Store encoding metadata
    let encodings = nsElement.selectAll('encoding').data(d3.values(metadata.encodings || {}));
    encodings.exit().remove();
    let encodingsEnter = encodings.enter().append('encoding');
    encodings = encodingsEnter.merge(encodings);
    encodings
      .attr('id', d => d.id)
      .attr('bindingid', d => d.bindingId)
      .html(d => '<![CDATA[' + JSON.stringify(d.spec) + ']]>');

    return dom;
  }
  async downloadSvg (filename) {
    let fileEntry = await this.getFile(filename, this.CONTENT_FORMATS.dom);
    if (!fileEntry) {
      throw new Error('Can\'t download non-existent file: ' + filename);
    }
    let dom = this.embedMetadata(fileEntry._attachments[fileEntry._id].dom, fileEntry.metadata);
    let xmlText = new window.XMLSerializer().serializeToString(dom)
      .replace(/&lt;!\[CDATA\[/g, '<!\[CDATA\[').replace(/]]&gt;/g, ']]>');

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
  matchDataPaths (path1, path2, metadata) {
    if (!metadata || !metadata.datasets || !path1 || !path2) {
      return false;
    }
    let result1 = jsonpath.query(metadata.datasets, path1);
    let result2 = jsonpath.query(metadata.datasets, path2);
    if (result1.length !== 1 || result2.length !== 1) {
      return false;
    }
    return result1[0] === result2[0];
  }
  matchDomSelectors (selector1, selector2, dom) {
    if (!selector1 || !selector2) {
      return false;
    }
    let result1 = dom.querySelector(selector1);
    let result2 = dom.querySelector(selector2);
    return result1 === result2;
  }
  getMatches (metadata, dom) {
    let mapping = [];
    if (metadata && metadata.bindings && metadata.datasets && dom) {
      d3.values(metadata.bindings).forEach(binding => {
        mapping.push(...this.getMatchesForBinding(binding, metadata, dom));
      });
    }
    return mapping;
  }
  getMatchesForBinding (binding, metadata, dom) {
    if (!binding.dataRoot || !binding.svgRoot || !binding.keyFunction) {
      return [];
    }

    if (binding.keyFunction.customMapping) {
      return binding.keyFunction.customMapping;
    }

    /* eslint-disable no-eval */
    let expression = (0, eval)(binding.keyFunction.expression);
    /* eslint-enable no-eval */

    // Need to evaluate the expression for each n^2 possible pairing, and assign
    // mapping the first time the expression is true (but not after!
    // mapping can only be one-to-one!)
    let dataRoot = jsonpath.query(metadata.datasets, binding.dataRoot)[0];
    let dataEntries;
    if (dataRoot instanceof Array) {
      dataEntries = dataRoot.map((d, i) => {
        return {
          key: i,
          value: d
        };
      });
    } else if (typeof dataRoot === 'object') {
      dataEntries = d3.entries(dataRoot);
    } else {
      return; // a leaf was picked as a root... no mapping possible
    }

    let svgRoot = dom.querySelector(binding.svgRoot);
    let svgItems = Array.from(svgRoot.children);

    let mapping = {
      links: [],
      svgLookup: {},
      dataLookup: {}
    };

    dataEntries.forEach(dataEntry => {
      for (let itemIndex = 0; itemIndex < svgItems.length; itemIndex += 1) {
        if (mapping.svgLookup[itemIndex] !== undefined) {
          // this svg element has already been matched with a different dataEntry
          continue;
        }
        let svgEntry = {
          index: itemIndex,
          element: svgItems[itemIndex]
        };
        let expressionResult = null;
        try {
          expressionResult = expression(dataEntry, svgEntry);
        } catch (errorObj) {
          // todo: add interface helpers for debugging the expression
          throw errorObj;
        }
        if (expressionResult === true) {
          mapping.svgLookup[svgEntry.index] = mapping.links.length;
          mapping.dataLookup[dataEntry.key] = mapping.links.length;
          mapping.links.push({
            dataEntry,
            svgEntry
          });
          break;
        } else if (expressionResult !== false) {
          throw new Error('The expression must evaluate to true or false');
        }
      }
    });
    return mapping;
  }
  purgeEncodings (binding, metadata) {
    if (metadata && metadata.encodings) {
      Object.keys(metadata.encodings).forEach(encodingId => {
        if (metadata.encodings[encodingId].bindingId === binding.id) {
          delete metadata.encodings[encodingId];
        }
      });
      return this.saveFile({ metadata });
    }
    return null;
  }
  renameBinding (binding, newId, metadata) {
    if (metadata.encodings) {
      Object.keys(metadata.encodings).forEach(encodingId => {
        if (metadata.encodings[encodingId].bindingId === binding.id) {
          metadata.encodings[encodingId].bindingId = newId;
        }
      });
    }
    binding.id = newId;
    return this.saveFile({ metadata });
  }
  async inferAllEncodings (binding, metadata, dom) {
    let mapping = this.getMatchesForBinding(binding, metadata, dom);

    // Trash all previous encodings associated with this binding
    if (metadata.encodings) {
      await this.purgeEncodings(binding, metadata);
    } else {
      metadata.encodings = {};
    }

    // Create / get cached distribution of values
    let dataDistributions = {};
    let svgDistributions = {};
    mapping.links.forEach(link => {
      Object.keys(link.dataEntry.value).forEach(attr => {
        let value = link.dataEntry.value[attr];
        if (typeof value === 'string' || typeof value === 'number') {
          dataDistributions[attr] = dataDistributions[attr] || {};
          dataDistributions[attr][value] =
            (dataDistributions[attr][value] || 0) + 1;
        }
      });

      svgDistributions._tagName = svgDistributions._tagName || {};
      svgDistributions._tagName[link.svgEntry.element.tagName] =
        (svgDistributions._tagName[link.svgEntry.element.tagName] || 0) + 1;

      Array.from(link.svgEntry.element.attributes).forEach(attrObj => {
        let attr = attrObj.name;
        let value = link.svgEntry.element.getAttribute(attr);
        if (typeof value === 'string' || typeof value === 'number') {
          svgDistributions[attr] = svgDistributions[attr] || {};
          svgDistributions[attr][value] =
            (svgDistributions[attr][value] || 0) + 1;
        }
      });
    });

    // Generate all potential svg constant rules
    // TODO: infer data constants as well if we ever get around to
    // supporting the data cleaning use case
    Object.keys(svgDistributions).forEach(attr => {
      let encoding = this.getEmptyEncoding(metadata, true);
      encoding.bindingId = binding.id;
      encoding.spec.type = this.ENCODING_TYPES.constant;
      encoding.spec.attribute = attr;

      // Figure out the bin with the highest count, while calculating the error
      let value = null;
      let maxBinCount = 0;
      let totalCount = 0;
      Object.keys(svgDistributions[attr]).forEach(binLabel => {
        let binCount = svgDistributions[attr][binLabel];
        totalCount += binCount;
        if (binCount > maxBinCount) {
          value = binLabel;
          maxBinCount = binCount;
        }
      });
      if (totalCount < mapping.links.length) {
        // Corner case: undefined is never going to be counted; we have to figure
        // it out from the difference
        let binCount = mapping.links.length - totalCount;
        svgDistributions[attr].undefined = binCount;
        totalCount += binCount;
        if (binCount > maxBinCount) {
          maxBinCount = binCount;
          value = 'undefined';
        }
      }
      encoding.spec.value = value;
      encoding.spec.error = (totalCount - maxBinCount) / totalCount;

      // Don't initially enable constants unless they're 100% accurate
      encoding.spec.enabled = encoding.spec.error === 0;
    });

    // TODO: generate linear, log, other model rules
    this.saveFile({ metadata });
  }
}

let mure = new Mure();
export default mure;
