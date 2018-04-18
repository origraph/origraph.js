import jsonPath from 'jsonpath';
import mime from 'mime-types';
import datalib from 'datalib';
import { Model } from 'uki';
import * as d3 from 'd3';
import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';
import PouchAuthentication from 'pouchdb-authentication';

var createEnum = (values => {
  let result = {};
  values.forEach(value => {
    result[value] = Symbol(value);
  });
  return Object.freeze(result);
});

var TYPES = createEnum(['boolean', 'number', 'string', 'date', 'undefined', 'null', 'reference', 'container', 'document', 'root']);

var queueAsync = (func => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(func());
    });
  });
});

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection {
  constructor(mure, selectorList = ['@' + DEFAULT_DOC_QUERY], { selectSingle = false, parentSelection = null } = {}) {
    if (!(selectorList instanceof Array)) {
      selectorList = [selectorList];
    }
    this.selectors = selectorList.reduce((agg, selectorString) => {
      let chunks = /@\s*({.*})?\s*(\$[^↑→]*)?\s*(↑*)\s*(→)?(.*)/.exec(selectorString);
      if (!chunks || chunks[5]) {
        let err = new Error('Invalid selector: ' + selectorString);
        err.INVALID_SELECTOR = true;
        throw err;
      }
      let parsedDocQuery = chunks[1] ? JSON.parse(chunks[1].trim()) : JSON.parse(DEFAULT_DOC_QUERY);
      if (parentSelection) {
        parentSelection.selectors.forEach(parentSelector => {
          let mergedDocQuery = Object.assign({}, parsedDocQuery, parentSelector.parsedDocQuery);
          let selector = {
            docQuery: JSON.stringify(mergedDocQuery),
            parsedDocQuery: mergedDocQuery,
            parentShift: parentSelector.parentShift + (chunks[3] ? chunks[3].length : 0),
            followLinks: !!chunks[4]
          };
          if (parentSelector.objQuery) {
            selector.objQuery = parentSelector.objQuery + (chunks[2] ? chunks[2].trim().slice(1) : '');
          } else {
            selector.objQuery = chunks[2] ? chunks[2].trim() : '';
          }
          agg.push(selector);
        });
      } else {
        let selector = {
          docQuery: chunks[1] ? chunks[1].trim() : DEFAULT_DOC_QUERY,
          parsedDocQuery,
          objQuery: chunks[2] ? chunks[2].trim() : '',
          parentShift: chunks[3] ? chunks[3].length : 0,
          followLinks: !!chunks[4]
        };
        agg.push(selector);
      }
      return agg;
    }, []);

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.pendingOperations = [];
  }
  get selectorList() {
    return this.selectors.map(selector => {
      return '@' + selector.docQuery + selector.objQuery + Array.from(Array(selector.parentShift)).map(d => '↑').join('') + selector.followLinks ? '→' : '';
    });
  }
  select(selectorList) {
    return new Selection(this.mure, selectorList, { selectSingle: true, parentSelection: this });
  }
  selectAll(selectorList) {
    return new Selection(this.mure, selectorList, { parentSelection: this });
  }
  async docLists() {
    return Promise.all(this.selectors.map(d => this.mure.queryDocs({ selector: d.parsedDocQuery })));
  }
  extractDocQuery(selectorString) {
    let result = /@\s*({.*})/.exec(selectorString);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    } else {
      return null;
    }
  }
  objIdToSelectorString(selectorString, docId) {
    let chunks = /@[^$]*(\$.*)/.exec(selectorString);
    return `@{"_id":"${docId}"}${chunks[1]}`;
  }
  selectorStringToObjId(selectorString) {
    let chunks = /@[^$]*(\$.*)/.exec(selectorString);
    return '@' + chunks[1];
  }
  inferType(value) {
    const jsType = typeof value;
    if (this.mure.TYPES[jsType]) {
      if (jsType === 'string' && value[0] === '@') {
        try {
          new Selection(this.mure, value); // eslint-disable-line no-new
        } catch (err) {
          if (err.INVALID_SELECTOR) {
            return this.mure.TYPES.string;
          } else {
            throw err;
          }
        }
        return this.mure.TYPES.reference;
      } else {
        return this.mure.TYPES[jsType];
      }
    } else if (value === null) {
      return this.mure.TYPES.null;
    } else if (value instanceof Date) {
      return this.mure.TYPES.date;
    } else if (jsType === 'function' || jsType === 'symbol' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else {
      return this.mure.TYPES.container;
    }
  }
  createRootItem(docList) {
    const rootItem = {
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      type: this.mure.TYPES.root,
      uniqueSelector: '@',
      isSet: false
    };
    docList.some(doc => {
      rootItem.value[doc._id] = doc;
      return this.selectSingle;
    });
    return rootItem;
  }
  createDocItem(doc, docPathQuery) {
    let item = {
      path: [docPathQuery],
      value: doc,
      parentId: '@',
      doc: doc,
      label: doc['filename'],
      type: this.mure.TYPES.document,
      uniqueSelector: docPathQuery,
      isSet: false
    };
    return item;
  }
  applyParentShift(item, doc, parentShift) {
    item.path.splice(item.path.length - parentShift);
    let temp = jsonPath.stringify(item.path);
    item.value = jsonPath.query(doc, temp)[0];
    return item;
  }
  async followItemLink(item, doc) {
    // This selector specifies to follow the link
    let selector = item.value;
    if (typeof selector !== 'string') {
      return [];
    }
    let docQuery = this.extractDocQuery(selector);
    let crossDoc;
    if (!docQuery) {
      selector = `@{"_id":"${doc._id}"}${selector.slice(1)}`;
      crossDoc = false;
    } else {
      crossDoc = docQuery._id !== doc._id;
    }
    let tempSelection;
    try {
      tempSelection = new Selection(this.mure, selector, { selectSingle: this.selectSingle });
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    let docLists = crossDoc ? await tempSelection.docLists() : [[doc]];
    return tempSelection.items({ docLists });
  }
  createRegularItem(item, doc, docPathQuery) {
    if (item.path.length === 2) {
      // this function shouldn't be called if less than 2
      item.parent = doc;
    } else {
      let temp = jsonPath.stringify(item.path.slice(0, item.path.length - 1));
      item.parent = jsonPath.value(doc, temp);
    }
    item.doc = doc;
    item.label = item.path[item.path.length - 1];
    item.type = this.inferType(item.value);
    item.isSet = item.type === this.mure.TYPES.container && !!item.value.$members;
    let uniqueJsonPath = jsonPath.stringify(item.path);
    item.uniqueSelector = '@' + docPathQuery + uniqueJsonPath;
    item.path.unshift(docPathQuery);
    return item;
  }
  async items({ docLists } = {}) {
    docLists = docLists || (await this.docLists());

    return queueAsync(async () => {
      // Collect the results of objQuery
      const items = [];
      const itemLookup = {};

      const addItem = item => {
        if (!itemLookup[item.uniqueSelector]) {
          itemLookup[item.uniqueSelector] = items.length;
          items.push(item);
        }
      };

      for (let index = 0; index < this.selectors.length; index++) {
        const selector = this.selectors[index];
        const docList = docLists[index];

        if (selector.objQuery === '') {
          // No objQuery means that we want a view of multiple documents (other
          // shenanigans mean we shouldn't select anything)
          if (selector.parentShift === 0 && !selector.followLinks) {
            addItem(this.createRootItem(docList));
          }
        } else if (selector.objQuery === '$') {
          // Selecting the documents themselves
          if (selector.parentShift === 0 && !selector.followLinks) {
            docList.some(doc => {
              addItem(this.createDocItem(doc, `{"_id":"${doc._id}"}`));
              return this.selectSingle;
            });
          } else if (selector.parentShift === 1) {
            addItem(this.createRootItem(docList));
          }
        } else {
          // Okay, we need to evaluate the jsonPath
          for (let docIndex = 0; docIndex < docList.length; docIndex++) {
            let doc = docList[docIndex];
            let docPathQuery = `{"_id":"${doc._id}"}`;
            let matchingItems = jsonPath.nodes(doc, selector.objQuery);
            for (let itemIndex = 0; itemIndex < matchingItems.length; itemIndex++) {
              let item = matchingItems[itemIndex];
              if (selector.parentShift === item.path.length) {
                // we parent shifted up to the root level
                if (!selector.followLinks) {
                  addItem(this.createRootItem(docList));
                }
              } else if (selector.parentShift === item.path.length - 1) {
                // we parent shifted to the document level
                if (!selector.followLinks) {
                  addItem(this.createDocItem(doc, docPathQuery));
                }
              } else if (selector.parentShift < item.path.length - 1) {
                item = this.applyParentShift(item, doc, selector.parentShift);
                if (selector.followLinks) {
                  // We (potentially) selected a link that we need to follow
                  (await this.followItemLink(item, doc)).forEach(addItem);
                } else {
                  // We selected a normal item
                  addItem(this.createRegularItem(item, doc, docPathQuery));
                }
              }
              if (this.selectSingle && items.length > 0) {
                break;
              }
            }
            if (this.selectSingle && items.length > 0) {
              break;
            }
          }
        }

        if (this.selectSingle && items.length > 0) {
          break;
        }
      }
      return items;
    });
  }
  allMetaObjIntersections(metaObj, items) {
    let linkedIds = {};
    items.forEach(item => {
      if (item[metaObj]) {
        Object.keys(item[metaObj]).forEach(linkedId => {
          linkedId = this.objIdToSelectorString(linkedId, item.doc._id);
          linkedIds[linkedId] = linkedIds[linkedId] || {};
          linkedIds[linkedId][item._id] = true;
        });
      }
    });
    let sets = [];
    let setLookup = {};
    Object.keys(linkedIds).forEach(linkedId => {
      let itemIds = Object.keys(linkedIds[linkedId]).sort();
      let setKey = itemIds.join(',');
      if (setLookup[setKey] === undefined) {
        setLookup[setKey] = sets.length;
        sets.push({ itemIds, linkedIds: {} });
      }
      setLookup[setKey].linkedIds[linkedId] = true;
    });
    return sets;
  }
  metaObjUnion(metaObj, items) {
    let linkedIds = {};
    items.forEach(item => {
      if (item[metaObj]) {
        Object.keys(item[metaObj]).forEach(linkedId => {
          linkedIds[this.objIdToSelectorString(linkedId, item.doc._id)] = true;
        });
      }
    });
    return linkedIds;
  }
  selectAllSetMembers(items) {
    return new Selection(this.mure, Object.keys(this.metaObjUnion('$members', items)));
  }
  selectAllContainingSets(items) {
    return new Selection(this.mure, Object.keys(this.metaObjUnion('$tags', items)));
  }
  selectAllEdges(items) {
    return new Selection(this.mure, Object.keys(this.metaObjUnion('$edges', items)));
  }
  selectAllNodes(items) {
    return new Selection(this.mure, Object.keys(this.metaObjUnion('$nodes', items)));
  }
  async save({ docLists, items }) {
    docLists = docLists || (await this.docLists());
    items = items || (await this.items({ docLists }));
    this.pendingOperations.forEach(func => {
      items.forEach(item => {
        func.apply(this, [item]);
      });
    });
    this.pendingOperations = [];
    let docIds = {};
    await this.mure.putDocs(docLists.reduce((agg, docList) => {
      docList.forEach(doc => {
        if (!docIds[doc._id]) {
          agg.push(doc);
          docIds[doc._id] = true;
        }
      });
      return agg;
    }, []));
    return this;
  }
  /*
   The following functions don't actually do anything immediately;
   instead, they are only applied once save() is called:
   */
  each(func) {
    this.pendingOperations.push(func);
    return this;
  }
  attr(key, value) {
    return this.each(item => {
      if (item.parent === null) {
        throw new Error(`Renaming files with .attr() is not yet supported`);
      }
      item.value[key] = value;
    });
  }
  remove() {
    return this.each(item => {
      if (item.parent === null) {
        throw new Error(`Deleting files with .remove() is not yet supported`);
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
    format.type = format.type ? format.type.toLowerCase() : 'json';
    if (this.datalibFormats.indexOf(format.type) !== -1) {
      contents = datalib.read(text, format);
    } else if (format.type === 'xml') {
      contents = this.parseXml(text, format);
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
    doc.orphanLinks._id = '@$.orphanLinks';

    doc.orphanNodes = doc.orphanNodes || {};
    doc.orphanNodes._id = '@$.orphanNodes';

    doc.classes = doc.classes || {};
    doc.classes._id = '@$.classes';

    let noneId = '@$.classes.none';
    doc.classes.none = doc.classes.none || { _id: noneId, $members: {} };

    doc.groups = doc.groups || {};
    doc.groups._id = '@$.groups';

    doc.contents = doc.contents || {};
    this.mure.itemHandler.standardize(doc.contents, ['$', 'contents'], doc.classes);

    return doc;
  }
}

let RESERVED_OBJ_KEYS = ['$tags', '$members', '$links', '$nodes'];

class ItemHandler {
  constructor(mure) {
    this.mure = mure;
  }
  standardize(obj, path, classes, noneId) {
    if (typeof obj !== 'object') {
      return obj;
    }

    // Convert arrays to objects
    if (obj instanceof Array) {
      let temp = {};
      obj.forEach((element, index) => {
        temp[index] = element;
      });
      obj = temp;
      obj.$wasArray = true;
    }

    // Assign the object's id
    obj._id = '@' + jsonPath.stringify(path);

    // Make sure the object has at least one class (move any class definitions
    // to this document), or assign it the 'none' class
    obj.$tags = obj.$tags || {};
    Object.keys(obj.$tags).forEach(setId => {
      let temp = /@[^$]*\$\.classes(\.[^\s↑→.]+)?(\["[^"]+"])?/.exec(setId);
      if (temp && (temp[1] || temp[2])) {
        delete obj.$tags[setId];

        let classPathChunk = temp[1] || temp[2];
        setId = classes._id + classPathChunk;
        obj.$tags[setId] = true;

        let className = temp[1] ? temp[1].slice(1) : temp[2].slice(2, temp[2].length - 2);
        classes[className] = classes[className] || { _id: setId, $members: {} };
        classes[className].$members[obj._id] = true;
      }
    });

    // Recursively standardize the object's contents
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object' && RESERVED_OBJ_KEYS.indexOf(key) === -1) {
        let temp = Array.from(path);
        temp.push(key);
        obj[key] = this.standardize(obj[key], temp, classes, noneId);
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

    // Our custom type definitions
    this.TYPES = TYPES;

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
        status.linkedView = !!(await this.db.put({
          _id: '$linkedView',
          selectorList: ['@$.classes[*]']
        }).catch(() => false));
        status.linkedUserSelection = !!(await this.db.put({
          _id: '$linkedUserSelection',
          selectorList: []
        }).catch(() => false));
        status.linkedViewSettings = !!(await this.db.put({
          _id: '$linkedViewSettings',
          settings: {}
        }).catch(() => false));
        this.db.changes({
          since: 'now',
          live: true
        }).on('change', change => {
          if (change.id > '_\uffff') {
            // A regular document changed
            this.trigger('docChange', change);
          } else if (change.id === '$linkedView') {
            // The linked views changed
            this.stickyTrigger('linkedViewChange', {
              view: this.selectAll(change.selectorList)
            });
          } else if (change.id === '$linkedUserSelection') {
            // The linked user selection changed
            this.stickyTrigger('linkedViewChange', {
              userSelection: this.selectAll(change.selectorList)
            });
          } else if (change.id === '$linkedViewSettings') {
            // The linked view settings changed
            this.stickyTrigger('linkedViewChange', {
              settings: change.settings
            });
          }
        }).on('error', err => {
          this.warn(err);
        });
        resolve(status);
      })();
    });
  }
  async queryDocs(queryObj) {
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
      let matchingDocs = await this.queryDocs({ selector: docQuery, limit: 1 });
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
  pathToSelector(path = [Selection.DEFAULT_DOC_QUERY]) {
    let docQuery = path[0];
    let objQuery = path.slice(1);
    objQuery = objQuery.length > 0 ? jsonPath.stringify(objQuery) : '';
    return '@' + docQuery + objQuery;
  }
  selectDoc(docId) {
    return this.select('@{"_id":"' + docId + '"}');
  }
  select(selectorList) {
    return new Selection(this, selectorList, { selectSingle: true });
  }
  selectAll(selectorList) {
    return new Selection(this, selectorList);
  }
  async setLinkedViews({ viewSelection, userSelection, settings } = {}) {
    let docs = [];
    if (viewSelection) {
      const linkedView = await this.db.get('$linkedView');
      linkedView.selectorList = viewSelection.selectorList;
      docs.push(linkedView);
    }
    if (userSelection) {
      const linkedUserSelection = await this.db.get('$linkedUserSelection');
      linkedUserSelection.selectorList = userSelection.selectorList;
      docs.push(linkedUserSelection);
    }
    if (settings) {
      const linkedViewSettings = await this.db.get('$linkedViewSettings');
      linkedViewSettings.settings = settings;
      docs.push(linkedViewSettings);
    }
    return this.putDocs(docs);
  }
  async getLinkedViews() {
    const temp = await Promise.all([this.db.get('$linkedView'), this.db.get('$linkedUserSelection'), this.db.get('$linkedViewSettings')]);
    return {
      view: this.selectAll(temp[0].selectorList),
      userSelection: this.selectAll(temp[1].selectorList),
      settings: temp[2].settings
    };
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
var devDependencies = { "babel-core": "^6.26.0", "babel-plugin-external-helpers": "^6.22.0", "babel-preset-env": "^1.6.1", "chalk": "^2.4.0", "d3-node": "^1.1.3", "diff": "^3.4.0", "pouchdb-node": "^6.4.3", "randombytes": "^2.0.6", "rollup": "^0.58.0", "rollup-plugin-babel": "^3.0.3", "rollup-plugin-commonjs": "^9.1.0", "rollup-plugin-json": "^2.3.0", "rollup-plugin-node-builtins": "^2.1.2", "rollup-plugin-node-globals": "^1.1.0", "rollup-plugin-node-resolve": "^3.0.2", "rollup-plugin-replace": "^2.0.0", "rollup-plugin-string": "^2.0.2", "rollup-plugin-uglify": "^3.0.0", "uglify-es": "^3.3.10" };
var dependencies = { "datalib": "^1.8.0", "jsonpath": "^1.0.0", "mime-types": "^2.1.18", "pouchdb-authentication": "^1.1.1", "pouchdb-browser": "^6.4.3", "pouchdb-find": "^6.4.3", "uki": "^0.2.1" };
var peerDependencies = { "d3": "^5.0.0" };
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
