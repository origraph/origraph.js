import { createParser } from 'scalpel';
import mime from 'mime-types';
import datalib from 'datalib';
import { Model } from 'uki';
import * as d3 from 'd3';
import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';
import PouchAuthentication from 'pouchdb-authentication';

class Selection {
  constructor(selector, context) {
    let parser = createParser();
    this.queryTokens = parser.parse(selector);
    this.context = context;
  }
  iterate(callback) {
    /*
    if (selector instanceof Selection)
    const queryTokens = this.selectorParser.parse(selector);
    const elements = [];
    this.iterateObj(root, obj => {
      if (this.matchObject(obj, queryTokens)) {
        elements.push(obj);
      }
    });
    return elements;
    */
  }
  iterateObj(obj, callback) {
    /*
    const nodes = [];
    nodes.push(obj);
    do {
      obj = nodes.shift();
      callback(obj);
      if (obj.elements) {
        nodes.unshift(...obj.elements);
      }
    } while (nodes.length > 0);
    */
  }
  matchObject(obj, queryTokens) {
    // TODO
  }
}

var mureInteractivityRunnerText = "/* globals XMLHttpRequest, ActiveXObject, Node */\n/* eslint no-eval: 0 */\n(function () {\n  var nonAsyncScriptTexts = [];\n\n  function load (url, callback) {\n    var xhr;\n\n    if (typeof XMLHttpRequest !== 'undefined') {\n      xhr = new XMLHttpRequest();\n    } else {\n      var versions = [\n        'MSXML2.XmlHttp.5.0',\n        'MSXML2.XmlHttp.4.0',\n        'MSXML2.XmlHttp.3.0',\n        'MSXML2.XmlHttp.2.0',\n        'Microsoft.XmlHttp'\n      ];\n      for (var i = 0, len = versions.length; i < len; i++) {\n        try {\n          xhr = new ActiveXObject(versions[i]);\n          break;\n        } catch (e) {}\n      }\n    }\n\n    xhr.onreadystatechange = ensureReadiness;\n\n    function ensureReadiness () {\n      if (xhr.readyState < 4) {\n        return;\n      }\n\n      if (xhr.status !== 200) {\n        return;\n      }\n\n      // all is well\n      if (xhr.readyState === 4) {\n        callback(xhr.responseText);\n      }\n    }\n\n    xhr.open('GET', url, true);\n    xhr.send('');\n  }\n\n  function documentPositionComparator (a, b) {\n    // function shamelessly adapted from https://stackoverflow.com/questions/31991235/sort-elements-by-document-order-in-javascript/31992057\n    a = a.element;\n    b = b.element;\n    if (a === b) { return 0; }\n    var position = a.compareDocumentPosition(b);\n    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {\n      return -1;\n    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {\n      return 1;\n    } else { return 0; }\n  }\n\n  function loadUserLibraries (callback) {\n    // Grab all the mure:library tags, and load the referenced library (script src attributes\n    // in SVG don't work, so we have to manually load remote libraries)\n    var libraries = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'library'))\n      .map(element => {\n        return {\n          src: element.getAttribute('src'),\n          async: (element.getAttribute('async') || 'true').toLocaleLowerCase() !== 'false',\n          element: element\n        };\n      });\n\n    var loadedLibraries = {};\n    var onloadFired = false;\n\n    libraries.forEach(function (library) {\n      load(library.src, function (scriptText) {\n        if (library.async) {\n          window.eval(scriptText);\n        } else {\n          library.scriptText = scriptText;\n          nonAsyncScriptTexts.push(library);\n        }\n        loadedLibraries[library.src] = true;\n        attemptStart();\n      });\n    });\n\n    window.onload = function () {\n      onloadFired = true;\n      attemptStart();\n    };\n\n    function attemptStart () {\n      if (!onloadFired) {\n        return;\n      }\n      var allLoaded = libraries.every(library => {\n        return loadedLibraries[library.src];\n      });\n      if (allLoaded) {\n        callback();\n      }\n    }\n  }\n\n  function runUserScripts () {\n    var userScripts = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'script'))\n      .map(element => {\n        return {\n          element: element,\n          scriptText: element.textContent\n        };\n      });\n    var allScripts = nonAsyncScriptTexts.concat(userScripts)\n      .sort(documentPositionComparator);\n    allScripts.forEach(scriptOrLibrary => {\n      window.eval(scriptOrLibrary.scriptText);\n    });\n  }\n\n  // Where we actually start executing stuff:\n  if (!window.frameElement ||\n      !window.frameElement.__suppressMureInteractivity__) {\n    // We've been loaded directly into a browser, or embedded in a normal page;\n    // load all the libraries, and then run all the scripts\n    loadUserLibraries(runUserScripts);\n  }\n})();\n";

var defaultSvgContentTemplate = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" width=\"500\" height=\"500\">\n  <metadata id=\"mure\" xmlns=\"http://mure-apps.github.io\">\n  </metadata>\n  <script id=\"mureInteractivityRunner\" type=\"text/javascript\">\n    <![CDATA[\n      ${mureInteractivityRunnerText}\n    ]]>\n  </script>\n</svg>\n";

var minimumSvgContent = "<svg>\n  <metadata id=\"mure\" xmlns=\"http://mure-apps.github.io\">\n  </metadata>\n</svg>\n";

// sneakily embed the interactivity-running script
const defaultSvgContent = defaultSvgContentTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

class DocHandler {
  constructor(mure) {
    this.mure = mure;
    this.selectorParser = createParser();
    this.keyNames = {};
    this.datalibFormats = ['json', 'csv', 'tsv', 'dsv', 'topojson', 'treejson'];
    this.defaultSvgContent = this.parseXml(defaultSvgContent);
    this.minimumSvgContent = this.parseXml(minimumSvgContent);
  }
  async parse(text, { format = {}, mimeType } = {}) {
    if (mimeType && (!format || !format.type)) {
      format.type = mime.extension(mimeType);
    }
    if (format.type) {
      format.type = format.type.toLowerCase();
      if (this.datalibFormats.indexOf(format.type) !== -1) {
        return new Promise((resolve, reject) => {
          resolve(datalib.read(text, format));
        });
      } else if (format.type === 'xml') {
        return this.parseXml(text, format);
      }
    }
  }
  async parseXml(text, { format = {} } = {}) {
    return Promise.resolve({ todo: true });
  }
  formatDoc(doc) {
    // TODO
    return 'todo';
  }
  isValidId(docId) {
    let parts = docId.split(';');
    if (parts.length !== 2) {
      return false;
    }
    return !!mime.extension(parts[0]);
  }
  async standardize(doc, { purgeArrays = false } = {}) {
    if (!doc._id || !this.isValidId(doc._id)) {
      if (!doc.mimeType && !doc.filename) {
        // Without an id, filename, or mimeType, just assume it's application/json
        doc.mimeType = 'application/json';
      }
      if (!doc.filename) {
        if (doc._id) {
          // We were given an invalid id; use it as the filename instead
          doc.filename = doc._id;
        } else {
          // Without anything to go on, use "Untitled 1", etc
          let existingUntitleds = await this.mure.db.allDocs({
            startkey: doc.mimeType + ';Untitled ',
            endkey: doc.mimeType + ';Untitled \uffff'
          });
          let minIndex = existingUntitleds.rows.reduce((minIndex, uDoc) => {
            let index = /Untitled (\d+)/g.exec(uDoc._id);
            index = index ? index[1] || Infinity : Infinity;
            return index < minIndex ? index : minIndex;
          }, Infinity);
          minIndex = isFinite(minIndex) ? minIndex + 1 : 1;
          doc.filename = 'Untitled ' + minIndex;
        }
      }
      if (!doc.mimeType) {
        // We were given a bit of info with the filename / bad _id;
        // try to infer the mimeType from that (again use application/json
        // if that fails)
        doc.mimeType = mime.lookup(doc.filename) || 'application/json';
      }
      doc._id = doc.mimeType + ';' + doc.filename;
    }
    if (!doc.mimeType) {
      doc.mimeType = doc._id.split(';')[0];
    }
    if (!mime.extension(doc.mimeType)) {
      this.mure.warn('Unknown mimeType: ' + doc.mimeType);
    }
    if (!doc.filename) {
      doc.filename = doc._id.split(';')[1];
    }
    if (!doc.contents) {
      doc.contents = {};
    }
    if (purgeArrays) {
      [doc.contents, doc.purgedArrays] = this.purgeArrays(doc.contents);
    }
    return doc;
  }
  purgeArrays(obj) {
    if (typeof obj !== 'object') {
      return [obj, false];
    }
    let foundArray = false;
    if (obj instanceof Array) {
      obj.forEach((element, index) => {
        
      });
      foundArray = true;
    }
    Object.keys(obj).forEach(key => {
      let foundChildArray, childObj;
      [childObj, foundChildArray] = this.purgeArrays(obj[key]);
      obj[key] = childObj;
      foundArray = foundArray || foundChildArray;
    });
    return [obj, foundArray];
  }
  restoreArrays(obj) {
    // todo
  }
}

class Mure extends Model {
  constructor(PouchDB$$1, d3$$1, d3n) {
    super();

    this.PouchDB = PouchDB$$1; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3$$1; // for Node.js, this will be from d3-node, not the regular one

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
    this.alert = message => {
      return new Promise((resolve, reject) => {
        this.window.alert(message);
        resolve(true);
      });
    };
    this.confirm = message => {
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
  customizeAlertDialog(showDialogFunction) {
    this.alert = showDialogFunction;
  }
  customizeConfirmDialog(showDialogFunction) {
    this.confirm = showDialogFunction;
  }
  customizePromptDialog(showDialogFunction) {
    this.prompt = showDialogFunction;
  }
  openApp(appName, newTab) {
    if (newTab) {
      this.window.open('/' + appName, '_blank');
    } else {
      this.window.location.pathname = '/' + appName;
    }
  }
  async getOrInitDb() {
    this.db = new this.PouchDB('mure');
    let status = {
      synced: false,
      indexed: false
    };
    let couchDbUrl = this.window.localStorage.getItem('couchDbUrl');
    if (couchDbUrl) {
      let couchDb = new this.PouchDB(couchDbUrl, { skip_setup: true });
      status.synced = !!(await this.db.sync(couchDb, { live: true, retry: true }).catch(err => {
        this.alert('Error syncing with ' + couchDbUrl + ': ' + err.message);
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
  async getDoc(docQuery, { init = true } = {}) {
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
  async downloadDoc(docQuery, { mimeType = null } = {}) {
    return this.getDoc(docQuery).then(doc => {
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
  async uploadFileObj(fileObj, { encoding = mime.charset(fileObj.type) } = {}) {
    let string = await new Promise((resolve, reject) => {
      let reader = new window.FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsText(fileObj, encoding);
    });
    return this.uploadString(fileObj.name, fileObj.type, string);
  }
  async uploadString(filename, mimeType, string) {
    let doc = await this.docHandler.parse(string, { mimeType });
    return this.uploadDoc(filename, mimeType, doc);
  }
  async uploadDoc(filename, mimeType, doc) {
    doc = await this.docHandler.standardize(doc, { purgeArrays: true });
    return this.db.put(doc);
  }
  async saveDoc(doc) {
    return this.db.put((await this.docHandler.standardize(doc)));
  }
  async deleteDoc(docQuery) {
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
  selectAll(selector, { context = null } = {}) {
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

var name = "mure";
var version = "0.2.4";
var description = "An integration library for the mure ecosystem of apps";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.min.js";
var scripts = { "build": "rollup -c", "dev": "rollup -c -w", "test": "node test/test.js", "pretest": "npm run build && rm -rf mure mure-mrview*", "posttest": "rm -rf mure mure-mrview*", "debug": "rm -rf mure mure-mrview* && node --inspect-brk test/test.js" };
var files = ["dist"];
var repository = { "type": "git", "url": "git+https://github.com/mure-apps/mure-library.git" };
var author = "Alex Bigelow";
var license = "MIT";
var bugs = { "url": "https://github.com/mure-apps/mure-library/issues" };
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = { "babel-core": "^6.26.0", "babel-plugin-external-helpers": "^6.22.0", "babel-preset-env": "^1.6.1", "chalk": "^2.3.0", "d3-node": "^1.1.3", "diff": "^3.4.0", "pouchdb-node": "^6.4.3", "randombytes": "^2.0.6", "rollup": "^0.55.3", "rollup-plugin-babel": "^3.0.3", "rollup-plugin-commonjs": "^8.3.0", "rollup-plugin-json": "^2.3.0", "rollup-plugin-node-builtins": "^2.1.2", "rollup-plugin-node-globals": "^1.1.0", "rollup-plugin-node-resolve": "^3.0.2", "rollup-plugin-replace": "^2.0.0", "rollup-plugin-string": "^2.0.2", "rollup-plugin-uglify": "^3.0.0", "uglify-es": "^3.3.9" };
var dependencies = { "datalib": "^1.8.0", "mime-types": "^2.1.18", "pouchdb-authentication": "^1.1.1", "pouchdb-browser": "^6.4.3", "pouchdb-find": "^6.4.3", "scalpel": "^2.1.0", "uki": "^0.1.0" };
var peerDependencies = { "d3": "^4.13.0" };
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	browser: browser,
	scripts: scripts,
	files: files,
	repository: repository,
	author: author,
	license: license,
	bugs: bugs,
	homepage: homepage,
	devDependencies: devDependencies,
	dependencies: dependencies,
	peerDependencies: peerDependencies,
	"jsnext:main": "dist/mure.esm.js"
};

PouchDB.plugin(PouchAuthentication);
PouchDB.plugin(PouchFind);

let mure = new Mure(PouchDB, d3);
mure.version = pkg.version;

export default mure;
