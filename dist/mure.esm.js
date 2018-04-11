import { Model } from 'uki';
import jsonPath from 'jsonpath';
import mime from 'mime-types';
import datalib from 'datalib';
import * as d3 from 'd3';
import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';
import PouchAuthentication from 'pouchdb-authentication';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection extends Model {
  constructor(mure, selector = '@' + DEFAULT_DOC_QUERY, { selectSingle = false, parentSelection = null } = {}) {
    super();
    let chunks = /@\s*({.*})?\s*(\$[^^]*)?\s*(\^*)?/.exec(selector);
    if (!chunks) {
      let err = new Error('Invalid selector: ' + selector);
      err.INVALID_SELECTOR = true;
      throw err;
    }
    this.docQuery = chunks[1] ? chunks[1].trim() : parentSelection ? parentSelection.docQuery : DEFAULT_DOC_QUERY;
    this.parsedDocQuery = this.docQuery ? JSON.parse(this.docQuery) : {};
    this.objQuery = parentSelection ? parentSelection.objQuery : '';
    this.objQuery += !chunks[2] ? '' : this.objQuery ? chunks[2].trim().slice(1) : chunks[2].trim();
    this.parentShift = chunks[3] ? chunks[3].length : 0;

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.pendingOperations = [];
  }
  get headless() {
    return this.docQuery === DEFAULT_DOC_QUERY;
  }
  get selector() {
    return '@' + this.docQuery + this.objQuery + Array.from(Array(this.parentShift)).map(d => '^').join('');
  }
  select(selector) {
    return new Selection(this.mure, selector, { selectSingle: true, parentSelection: this });
  }
  selectAll(selector) {
    return new Selection(this.mure, selector, { parentSelection: this });
  }
  async docs() {
    let docs = {};
    let result = await this.mure.query({
      selector: this.parsedDocQuery
    });
    result.forEach(doc => {
      docs[doc._id] = doc;
    });
    return docs;
  }
  async items({ docs } = {}) {
    // TODO: there isn't a direct need for async yet, but this is potentially
    // expensive / blocking for larger datasets; in the future, maybe it would
    // be best to offload bits to a web worker?
    docs = docs || (await this.docs());

    // Collect the results of objQuery
    let items = [];
    if (this.objQuery === '') {
      // No objQuery means that we want to select the documents themselves
      let rootItem = {
        path: [],
        value: {},
        parent: null,
        doc: null,
        label: null,
        uniqueSelector: '@'
      };
      Object.keys(docs).some(docId => {
        rootItem.value[docId] = docs[docId];
        return this.selectSingle;
      });
      items.push(rootItem);
    } else {
      Object.keys(docs).some(docId => {
        let doc = docs[docId];
        let docPathQuery = '{"_id":"' + docId + '"}';
        return jsonPath.nodes(doc, this.objQuery).some(item => {
          if (this.parentShift) {
            // Now that we have unique, normalized paths for each node, we can
            // apply the parentShift option to select parents based on child
            // attributes
            if (this.parentShift >= item.path.length - 1) {
              // We selected above the root of the document; as there's nothing
              // to select, don't even append a result
              return false;
            } else {
              item.path.splice(item.path.length - this.parentShift);
              let temp = jsonPath.stringify(item.path);
              item.value = jsonPath.query(doc, temp)[0];
            }
          }
          if (item.path.length === 1) {
            item.parent = null;
            item.label = doc.filename;
          } else {
            let temp = jsonPath.stringify(item.path.slice(0, item.path.length - 1));
            item.parent = jsonPath.query(doc, temp)[0];
            item.label = item.path[item.path.length - 1];
          }
          item.doc = doc;
          let uniqueJsonPath = jsonPath.stringify(item.path);
          item.uniqueSelector = '@' + docPathQuery + uniqueJsonPath;
          item.path.unshift(docPathQuery);
          items.push(item);
          return this.selectSingle; // when true, exits both loops after the first match is found
        });
      });
    }
    return items;
  }
  async slices({ docs, items } = {}) {
    // TODO: there isn't a direct need for async yet, but this is potentially
    // expensive / blocking for larger datasets; in the future, maybe it would
    // be best to offload bits to a web worker?
    docs = docs || (await this.docs());
    items = items || (await this.items(docs));

    const slices = {};
    const members = {};
    items.forEach(item => {
      if (item.$members) {
        // This is a set; we already have its member ids
        slices[item._id] = {
          label: item.label,
          members: Object.assign({}, item.$members)
        };
        Object.keys(item.$members).forEach(memberId => {
          members[memberId] = members[memberId] || {};
          members[memberId][item._id] = true;
        });
      } else {
        // The item is a container; its contents are its members, and
        // the item and all its ancestors are the "sets"
        if (item.path.length > 0) {
          const docId = '@{"_id":"' + item.path[0] + '"}';
          let ancestorIds = [docId];
          slices[docId] = slices[docId] || {
            label: item.doc.filename,
            memberIds: {}
          };
          for (let i = 1; i < item.path.length; i++) {
            let ancestorId = docId + jsonPath.stringify(item.path.slice(1, i + 1));
            slices[ancestorId] = slices[ancestorId] || {
              label: item.path[i],
              memberIds: {}
            };
            ancestorIds.push(ancestorId);
          }

          Object.keys(item).forEach(memberLabel => {
            const memberPath = item.path.concat([memberLabel]);
            const memberId = docId + jsonPath.stringify(memberPath);
            members[memberId] = members[memberId] || {};
            ancestorIds.forEach(ancestorId => {
              slices[ancestorId][memberId] = true;
              members[memberId][ancestorId] = true;
            });
          });
        }
      }
    });
    return { slices, members };
  }
  async save({ docs, items }) {
    items = items || (await this.items({ docs }));
    this.pendingOperations.forEach(func => {
      items.forEach(item => {
        func.apply(this, [item]);
      });
    });
    this.pendingOperations = [];
    await this.mure.putDocs(docs);
    return this;
  }
  each(func) {
    this.pendingOperations.push(func);
    return this;
  }
  attr(key, value) {
    if (this.docQuery === '') {
      throw new Error(`Can't set attributes at the root level; here you would need to call mure.putDoc()`);
    }
    return this.each(item => {
      item.value[key] = value;
    });
  }
  remove() {
    return this.each(item => {
      if (!item.parent) {
        throw new Error(`Can't remove without a parent object; to remove documents, call mure.removeDoc()`);
      }
      delete item.parent[item.label];
    });
  }
  group() {
    throw new Error('unimplemented');
  }
  connect() {
    throw new Error('unimplemented');
  }
  toggleEdge() {
    throw new Error('unimplemented');
  }
  toggleDirection() {
    throw new Error('unimplemented');
  }
  copy(newParentId) {
    throw new Error('unimplemented');
  }
  move(newParentId) {
    throw new Error('unimplemented');
  }
  dissolve() {
    throw new Error('unimplemented');
  }
}
Selection.DEFAULT_DOC_QUERY = DEFAULT_DOC_QUERY;

class DocHandler {
  constructor(mure) {
    this.mure = mure;
    this.keyNames = {};
    this.datalibFormats = ['json', 'csv', 'tsv', 'dsv', 'topojson', 'treejson'];
  }
  async parse(text, { format = {}, mimeType } = {}) {
    if (mimeType && (!format || !format.type)) {
      format.type = mime.extension(mimeType);
    }
    let contents;
    if (format.type) {
      format.type = format.type.toLowerCase();
      if (this.datalibFormats.indexOf(format.type) !== -1) {
        contents = datalib.read(text, format);
      } else if (format.type === 'xml') {
        contents = this.parseXml(text, format);
      }
    }
    if (!contents.contents) {
      contents = { contents: contents };
    }
    return contents;
  }
  parseXml(text, { format = {} } = {}) {
    throw new Error('unimplemented');
  }
  formatDoc(doc, { mimeType = doc.mimeType } = {}) {
    this.mure.itemHandler.format(doc.contents);
    throw new Error('unimplemented');
  }
  isValidId(docId) {
    if (docId[0].toLowerCase() !== docId[0]) {
      return false;
    }
    let parts = docId.split(';');
    if (parts.length !== 2) {
      return false;
    }
    return !!mime.extension(parts[0]);
  }
  async standardize(doc) {
    if (!doc._id || !this.isValidId(doc._id)) {
      if (!doc.mimeType && !doc.filename) {
        // Without an id, filename, or mimeType, just assume it's application/json
        doc.mimeType = 'application/json';
      }
      doc.mimeType = doc.mimeType.toLowerCase();
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
    if (doc._id[0] === '_' || doc._id[0] === '$') {
      throw new Error('Document _ids may not start with ' + doc._id[0] + ': ' + doc._id);
    }
    doc.mimeType = doc.mimeType || doc._id.split(';')[0];
    if (!mime.extension(doc.mimeType)) {
      this.mure.warn('Unknown mimeType: ' + doc.mimeType);
    }
    doc.filename = doc.filename || doc._id.split(';')[1];
    doc.charset = (doc.charset || 'UTF-8').toUpperCase();

    doc.orphanLinks = doc.orphanLinks || {};
    doc.orphanLinks._id = `@{_id:'${doc._id}'}$.orphanLinks`;

    doc.orphanNodes = doc.orphanNodes || {};
    doc.orphanNodes._id = `@{_id:'${doc._id}'}$.orphanNodes`;

    doc.classes = doc.classes || {};
    doc.classes._id = `@{_id:'${doc._id}'}$.classes`;
    doc.classes.$members = doc.classes.$members || {};

    doc.groups = doc.groups || {};
    doc.groups._id = `@{_id:'${doc._id}'}$.groups`;
    doc.groups.$members = doc.classes.$members || {};

    doc.contents = doc.contents || {};
    this.mure.itemHandler.standardize(doc.contents, ['$', 'contents']);

    return doc;
  }
}

let RESERVED_OBJ_KEYS = ['$tags', '$members', '$links', '$nodes'];

class ItemHandler {
  constructor(mure) {
    this.mure = mure;
  }
  standardize(obj, path) {
    if (typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Array) {
      let temp = {};
      obj.forEach((element, index) => {
        temp[index] = element;
      });
      obj = temp;
      obj.$wasArray = true;
    }
    obj._id = jsonPath.stringify(path);
    obj.$tags = obj.$tags || {};
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && RESERVED_OBJ_KEYS.indexOf(key) === -1) {
        let temp = Array.from(path);
        temp.push(key);
        obj[key] = this.standardize(obj[key], temp);
      }
    });
    return obj;
  }
  format(obj) {
    // TODO: if $wasArray, attempt to restore array status,
    // remove _ids
    throw new Error('unimplemented');
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
    this.itemHandler = new ItemHandler(this);

    // Create / load the local database of files
    this.getOrInitDb();

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
  getOrInitDb() {
    this.db = new this.PouchDB('mure');
    this.dbStatus = new Promise((resolve, reject) => {
      (async () => {
        let status = { synced: false };
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
        status.linkedViewSpec = !!(await this.db.put({
          _id: '$linkedViewSpec',
          setSelector: '@$.classes[*]',
          sliceViewSettings: {},
          userSelector: null
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
  async query(queryObj) {
    let queryResult = await this.db.find(queryObj);
    if (queryResult.warning) {
      this.warn(queryResult.warning);
    }
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
  async getDoc(docQuery, { init = true } = {}) {
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
  async putDoc(doc) {
    try {
      return this.db.put(doc);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  async putDocs(docList) {
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
    return this.uploadString(fileObj.name, fileObj.type, encoding, string);
  }
  async uploadString(filename, mimeType, encoding, string) {
    let doc = await this.docHandler.parse(string, { mimeType });
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc(filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await this.docHandler.standardize(doc);
    return this.putDoc(doc);
  }
  async deleteDoc(docQuery) {
    let doc = await this.getDoc(docQuery);
    return this.putDoc({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true
    });
  }
  mergeSelectors(selectorList) {
    throw new Error('unimplemented');
  }
  pathsToSelector(paths = [[Selection.DEFAULT_DOC_QUERY]]) {
    throw new Error('unimplemented');
  }
  pathToSelector(path = [Selection.DEFAULT_DOC_QUERY]) {
    let docQuery = path[0];
    let objQuery = path.slice(1);
    objQuery = objQuery.length > 0 ? jsonPath.stringify(objQuery) : '';
    return '@' + docQuery + objQuery;
  }
  selectDoc(docId) {
    return this.select('@{"_id":"' + docId + '"}');
  }
  select(selector) {
    if (selector instanceof Array) {
      selector = selector[0];
    }
    return new Selection(this, selector, { selectSingle: true });
  }
  selectAll(selector) {
    if (selector instanceof Array) {
      selector = this.mergeSelectors(selector);
    }
    return new Selection(this, selector);
  }
  async setLinkedViews({ setSelection, sliceViewSettings, userSelection } = {}) {
    let linkedViewSpec = await this.db.get('$linkedViewSpec');
    linkedViewSpec.setSelector = setSelection ? setSelection.selector : linkedViewSpec.setSelector;
    linkedViewSpec.sliceViewSettings = sliceViewSettings || linkedViewSpec.sliceViewSettings;
    linkedViewSpec.userSelector = userSelection === undefined ? userSelection.selector : userSelection === null ? null : linkedViewSpec.userSelector;
    return this.putDoc(linkedViewSpec);
  }
  formatLinkedViewSpec(specObj) {
    return {
      setSelection: this.selectAll(specObj.selector),
      sliceViewSettings: specObj.sliceViewSettings,
      userSelector: specObj.userSelector ? this.selectAll(specObj.userSelector) : null
    };
  }
  async getLinkedViews() {
    return this.formatLinkedViewSpec((await this.db.get('$linkedViewSpec')));
  }
}

var name = "mure";
var version = "0.3.0";
var description = "An integration library for the mure ecosystem of apps";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.min.js";
var scripts = { "build": "rollup -c --environment TARGET:all", "watch": "rollup -c -w", "watchcjs": "rollup -c -w --environment TARGET:cjs", "watchumd": "rollup -c -w --environment TARGET:umd", "watchesm": "rollup -c -w --environment TARGET:esm", "test": "node test/test.js", "pretest": "rollup -c --environment TARGET:cjs && rm -rf mure mure-mrview*", "posttest": "rm -rf mure mure-mrview*", "debug": "rm -rf mure mure-mrview* && node --inspect-brk test/test.js" };
var files = ["dist"];
var repository = { "type": "git", "url": "git+https://github.com/mure-apps/mure-library.git" };
var author = "Alex Bigelow";
var license = "MIT";
var bugs = { "url": "https://github.com/mure-apps/mure-library/issues" };
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = { "babel-core": "^6.26.0", "babel-plugin-external-helpers": "^6.22.0", "babel-preset-env": "^1.6.1", "chalk": "^2.3.0", "d3-node": "^1.1.3", "diff": "^3.4.0", "pouchdb-node": "^6.4.3", "randombytes": "^2.0.6", "rollup": "^0.55.3", "rollup-plugin-babel": "^3.0.3", "rollup-plugin-commonjs": "^8.3.0", "rollup-plugin-json": "^2.3.0", "rollup-plugin-node-builtins": "^2.1.2", "rollup-plugin-node-globals": "^1.1.0", "rollup-plugin-node-resolve": "^3.0.2", "rollup-plugin-replace": "^2.0.0", "rollup-plugin-string": "^2.0.2", "rollup-plugin-uglify": "^3.0.0", "uglify-es": "^3.3.9" };
var dependencies = { "datalib": "^1.8.0", "jsonpath": "^1.0.0", "mime-types": "^2.1.18", "pouchdb-authentication": "^1.1.1", "pouchdb-browser": "^6.4.3", "pouchdb-find": "^6.4.3", "uki": "^0.1.0" };
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
