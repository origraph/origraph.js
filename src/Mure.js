import mime from 'mime-types';
import jsonPath from 'jsonpath';
import { Model } from 'uki';
import Selection from './Selection.js';

import RootItem from './Items/RootItem.js';
import DocumentItem from './Items/DocumentItem.js';
import PrimitiveItem from './Items/PrimitiveItem.js';
import NullItem from './Items/NullItem.js';
import BooleanItem from './Items/BooleanItem.js';
import NumberItem from './Items/NumberItem.js';
import StringItem from './Items/StringItem.js';
import DateItem from './Items/DateItem.js';
import ReferenceItem from './Items/ReferenceItem.js';
import ContainerItem from './Items/ContainerItem.js';
import TaggableItem from './Items/TaggableItem.js';
import SetItem from './Items/SetItem.js';
import EdgeItem from './Items/EdgeItem.js';
import NodeItem from './Items/NodeItem.js';
import SupernodeItem from './Items/SupernodeItem.js';

import PivotToContents from './Operations/Pivot/PivotToContents.js';
import PivotToMembers from './Operations/Pivot/PivotToMembers.js';
import PivotToNodes from './Operations/Pivot/PivotToNodes.js';
import PivotToEdges from './Operations/Pivot/PivotToEdges.js';

import ConvertContainerToNode from './Operations/Convert/ConvertContainerToNode.js';

import ConnectNodesOnFunction from './Operations/Connect/ConnectNodesOnFunction.js';

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

    // Our custom type definitions
    this.ITEM_TYPES = {
      RootItem,
      DocumentItem,
      PrimitiveItem,
      NullItem,
      BooleanItem,
      NumberItem,
      StringItem,
      DateItem,
      ReferenceItem,
      ContainerItem,
      TaggableItem,
      SetItem,
      EdgeItem,
      NodeItem,
      SupernodeItem
    };

    // Special keys that should be skipped in various operations
    this.RESERVED_OBJ_KEYS = {
      '_id': true,
      '_rev': true,
      '$wasArray': true,
      '$tags': true,
      '$members': true,
      '$edges': true,
      '$nodes': true,
      '$nextLabel': true,
      '$isDate': true
    };

    // Modes for deriving selections
    this.DERIVE_MODES = {
      REPLACE: 'REPLACE',
      UNION: 'UNION',
      XOR: 'XOR'
    };

    // Auto-mappings from native javascript types to Items
    this.JSTYPES = {
      'null': NullItem,
      'boolean': BooleanItem,
      'number': NumberItem
    };

    // All the supported operations
    this.OPERATIONS = {
      'Pivot': {
        PivotToContents,
        PivotToMembers,
        PivotToNodes,
        PivotToEdges
      },
      'Filter': {},
      'Edit': {},
      'Convert': {
        ConvertContainerToNode
      },
      'Connect': {
        ConnectNodesOnFunction
      },
      'Derive': {}
    };

    // Unlike ITEM_TYPES, we actually want to instantiate all the operations
    // with a reference to this. While we're at it, make them available as
    // functions on the Selection class
    Object.entries(this.OPERATIONS).forEach(([opFamilyName, ops]) => {
      // UpperCamelCase to lowerCamelCase
      let opFamilyNameLower = opFamilyName.replace(/./, opFamilyName[0].toLowerCase());
      Selection.prototype[opFamilyNameLower] = {};
      Object.entries(ops).forEach(([opName, Operation]) => {
        this.OPERATIONS[opFamilyName][opName] = new Operation(this);
        // UpperCamelCase to lowerCamelCase
        let opNameLower = opName.replace(/./, opName[0].toLowerCase());
        Selection.prototype[opFamilyNameLower][opNameLower] = function (inputOptions) {
          return this.execute(this.OPERATIONS[opFamilyName][opName], inputOptions);
        };
      });
    });

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
        status.linkedUserSelection = !!(await this.db.put({
          _id: '$linkedUserSelection',
          selectorList: []
        }).catch(() => false));
        status.linkedViewSettings = !!(await this.db.put({
          _id: '$linkedViewSettings',
          settings: {}
        }).catch(() => false));
        this.db.changes({
          since: (await this.db.info()).update_seq - 1,
          live: true,
          include_docs: true
        }).on('change', change => {
          if (change.id > '_\uffff') {
            // A regular document changed; invalidate all selection caches
            // corresponding to this document
            Selection.INVALIDATE_DOC_CACHE(change.id);
            this.trigger('docChange', change.doc);
          } else if (change.id === '$linkedUserSelection') {
            // The linked user selection changed
            this.stickyTrigger('linkedViewChange', {
              userSelection: this.selectAll(change.doc.selectorList)
            });
          } else if (change.id === '$linkedViewSettings') {
            // The linked view settings changed
            this.stickyTrigger('linkedViewChange', {
              settings: change.doc.settings
            });
          }
        }).on('error', err => {
          this.warn(err);
        });
        resolve(status);
      })();
    });
  }
  async allDocs (options = {}) {
    await this.dbStatus;
    Object.assign(options, {
      startkey: '_\uffff',
      include_docs: true
    });
    let results = await this.db.allDocs(options);
    return results.rows.map(row => row.doc);
  }
  async allDocItems () {
    return (await this.allDocs())
      .map(doc => new this.ITEM_TYPES.DocumentItem({ mure: this, doc }));
  }
  async queryDocs (queryObj) {
    await this.dbStatus;
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
    await this.dbStatus;
    let doc;
    if (!docQuery) {
      return this.ITEM_TYPES.DocumentItem.launchStandardization({ doc: {}, mure: this });
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
          doc = await this.ITEM_TYPES.DocumentItem.launchStandardization({ doc: docQuery, mure: this });
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
    await this.dbStatus;
    try {
      return this.db.put(doc);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  async putDocs (docList) {
    await this.dbStatus;
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
        let contents = this.ITEM_TYPES.DocumentItem.formatDoc(doc, { mimeType });

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
  async uploadString (filename, mimeType, encoding, string, extensionOverride = null) {
    if (!mimeType) {
      let temp = mime.lookup(filename);
      if (temp) {
        mimeType = temp;
      }
    }
    // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly
    const extension = extensionOverride || mime.extension(mimeType) || 'txt';
    let doc = await this.ITEM_TYPES.DocumentItem.parse(string, extension);
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc (filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await this.ITEM_TYPES.DocumentItem.launchStandardization({ doc, mure: this });
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
  selectDoc (docId) {
    return this.select('@{"_id":"' + docId + '"}');
  }
  select (selectorList) {
    return new Selection(this, selectorList, { selectSingle: true });
  }
  selectAll (selectorList) {
    return new Selection(this, selectorList);
  }
  async setLinkedViews ({ userSelection, settings } = {}) {
    await this.dbStatus;
    let docs = [];
    if (userSelection) {
      const linkedUserSelection = await this.db.get('$linkedUserSelection');
      linkedUserSelection.selectorList = userSelection.selectorList;
      docs.push(linkedUserSelection);
    }
    if (settings) {
      const linkedViewSettings = await this.db.get('$linkedViewSettings');
      Object.assign(linkedViewSettings.settings, settings);
      docs.push(linkedViewSettings);
    }
    return this.putDocs(docs);
  }
  async getLinkedViews () {
    await this.dbStatus;
    const temp = await Promise.all([
      this.db.get('$linkedUserSelection'),
      this.db.get('$linkedViewSettings')
    ]);
    return {
      userSelection: this.selectAll(temp[0].selectorList),
      settings: temp[1].settings
    };
  }
  pathToSelector (path = [Selection.DEFAULT_DOC_QUERY]) {
    let docQuery = path[0];
    let objQuery = path.slice(1);
    objQuery = objQuery.length > 0 ? jsonPath.stringify(objQuery) : '';
    return '@' + docQuery + objQuery;
  }
  idToUniqueSelector (selectorString, docId) {
    const chunks = /@[^$]*(\$.*)/.exec(selectorString);
    return `@{"_id":"${docId}"}${chunks[1]}`;
  }
  extractDocQuery (selectorString) {
    const result = /@\s*({.*})/.exec(selectorString);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    } else {
      return null;
    }
  }
  extractClassInfoFromId (id) {
    const temp = /@[^$]*\$\.classes(\.[^\s↑→.]+)?(\["[^"]+"])?/.exec(id);
    if (temp && (temp[1] || temp[2])) {
      return {
        classPathChunk: temp[1] || temp[2],
        className: temp[1] ? temp[1].slice(1) : temp[2].slice(2, temp[2].length - 2)
      };
    } else {
      return null;
    }
  }
  inferType (value, aggressive = false) {
    const jsType = typeof value;
    if (this.JSTYPES[jsType]) {
      return this.JSTYPES[jsType];
    } else if (jsType === 'string') {
      if (value[0] === '@') {
        // Attempt to parse as a reference
        try {
          new Selection(null, value); // eslint-disable-line no-new
          return this.ITEM_TYPES.ReferenceItem;
        } catch (err) {
          if (!err.INVALID_SELECTOR) {
            throw err;
          }
        }
      }
      // Not a reference...
      if (aggressive) {
        // Aggressively attempt to identify something more specific than string
        if (!isNaN(Number(value))) {
          return this.ITEM_TYPES.NumberItem;
        /*
         For now, we don't attempt to identify dates, even in aggressive mode,
         because things like new Date('Player 1') will successfully parse as a
         date. If we can find smarter ways to auto-infer dates (e.g. does the
         value fall suspiciously near the unix epoch, y2k, or more than +/-500
         years from now? Do sibling container items parse this as a date?), then
         maybe we'll add this back...
        */
        // } else if (!isNaN(new Date(value))) {
        //  return ITEM_TYPES.DateItem;
        } else {
          const temp = value.toLowerCase();
          if (temp === 'true') {
            return this.ITEM_TYPES.BooleanItem;
          } else if (temp === 'false') {
            return this.ITEM_TYPES.BooleanItem;
          } else if (temp === 'null') {
            return this.ITEM_TYPES.NullItem;
          }
        }
      }
      // Okay, it's just a string
      return this.ITEM_TYPES.StringItem;
    } else if (jsType === 'function' || jsType === 'symbol' || jsType === 'undefined' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else if (value === null) {
      return this.ITEM_TYPES.NullItem;
    } else if (value instanceof Date || value.$isDate === true) {
      return this.ITEM_TYPES.DateItem;
    } else if (value.$nodes) {
      return this.ITEM_TYPES.EdgeItem;
    } else if (value.$edges) {
      if (value.$members) {
        return this.ITEM_TYPES.SupernodeItem;
      } else {
        return this.ITEM_TYPES.NodeItem;
      }
    } else if (value.$members) {
      return this.ITEM_TYPES.SetItem;
    } else if (value.$tags) {
      return this.ITEM_TYPES.TaggableItem;
    } else {
      return this.ITEM_TYPES.ContainerItem;
    }
  }
  async followRelativeLink (selector, doc, selectSingle = false) {
    // This selector specifies to follow the link
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
      tempSelection = new Selection(this.mure, selector, { selectSingle });
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    let docLists = crossDoc ? await tempSelection.docLists() : [[ doc ]];
    return tempSelection.items(docLists);
  }
}

export default Mure;
