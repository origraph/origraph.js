import mime from 'mime-types';
import jsonPath from 'jsonpath';
import { Model } from 'uki';
import Selection from './Selection.js';

import RootConstruct from './Constructs/RootConstruct.js';
import DocumentConstruct from './Constructs/DocumentConstruct.js';
import PrimitiveConstruct from './Constructs/PrimitiveConstruct.js';
import InvalidConstruct from './Constructs/InvalidConstruct.js';
import NullConstruct from './Constructs/NullConstruct.js';
import BooleanConstruct from './Constructs/BooleanConstruct.js';
import NumberConstruct from './Constructs/NumberConstruct.js';
import StringConstruct from './Constructs/StringConstruct.js';
import DateConstruct from './Constructs/DateConstruct.js';
import ReferenceConstruct from './Constructs/ReferenceConstruct.js';
import ItemConstruct from './Constructs/ItemConstruct.js';
import TaggableConstruct from './Constructs/TaggableConstruct.js';
import SetConstruct from './Constructs/SetConstruct.js';
import EdgeConstruct from './Constructs/EdgeConstruct.js';
import NodeConstruct from './Constructs/NodeConstruct.js';
import SupernodeConstruct from './Constructs/SupernodeConstruct.js';

import SelectOperation from './Operations/SelectOperation.js';
import ConvertOperation from './Operations/ConvertOperation.js';
import ConnectOperation from './Operations/ConnectOperation.js';
import AssignClassOperation from './Operations/AssignClassOperation.js';

class Mure extends Model {
  constructor (PouchDB, d3, d3n) {
    super();
    this.PouchDB = PouchDB; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3; // for Node.js, this will be from d3-node, not the regular one
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

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
    this.CONSTRUCTS = {
      RootConstruct,
      DocumentConstruct,
      PrimitiveConstruct,
      InvalidConstruct,
      NullConstruct,
      BooleanConstruct,
      NumberConstruct,
      StringConstruct,
      DateConstruct,
      ReferenceConstruct,
      ItemConstruct,
      TaggableConstruct,
      SetConstruct,
      EdgeConstruct,
      NodeConstruct,
      SupernodeConstruct
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

    // Auto-mappings from native javascript types to Constructs
    this.JSTYPES = {
      'null': NullConstruct,
      'boolean': BooleanConstruct,
      'number': NumberConstruct
    };

    // All the supported operations
    let operationClasses = [
      SelectOperation,
      ConvertOperation,
      ConnectOperation,
      AssignClassOperation
    ];
    this.OPERATIONS = {};

    // Unlike CONSTRUCTS, we actually want to instantiate all the operations
    // with a reference to this. While we're at it, monkey patch them onto
    // the Selection class
    operationClasses.forEach(Operation => {
      const temp = new Operation(this);
      this.OPERATIONS[temp.type] = temp;
      Selection.prototype[temp.lowerCamelCaseType] = async function (inputOptions) {
        return this.execute(temp, inputOptions);
      };
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
            if (change.doc._rev.search(/^1-/) !== -1) {
              // TODO: this is a hack to see if it's a newly-added doc (we want
              // to invalidate all selection caches, because we have no way to
              // know if they'd select this new document or not). This won't
              // work once we start dealing with replication, if a file gets
              // added remotely. See "How can I distinguish between added and
              // modified documents" in the PouchDB documentation:
              // https://pouchdb.com/guides/changes.html
              Selection.INVALIDATE_ALL_CACHES();
            }
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
  async allDocConstructs () {
    return (await this.allDocs())
      .map(doc => new this.CONSTRUCTS.DocumentConstruct({ mure: this, doc }));
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
      return this.CONSTRUCTS.DocumentConstruct.launchStandardization({ doc: {}, mure: this });
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
          doc = await this.CONSTRUCTS.DocumentConstruct.launchStandardization({ doc: docQuery, mure: this });
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
        let contents = this.CONSTRUCTS.DocumentConstruct.formatDoc(doc, { mimeType });

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
    let doc = await this.CONSTRUCTS.DocumentConstruct.parse(string, extension);
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc (filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await this.CONSTRUCTS.DocumentConstruct.launchStandardization({ doc, mure: this });
    if (!(await this.putDoc(doc)).ok) {
      return null;
    } else {
      return this.select(`@{"_id":"${doc._id}"}$`);
    }
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
    return this.selectAll('@{"_id":"' + docId + '"}$');
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
  parseSelector (selectorString) {
    let chunks = /@\s*({.*})?\s*(\$[^↑→]*)?\s*(↑*)\s*(→)?(.*)/.exec(selectorString);
    if (!chunks || chunks[5]) {
      return null;
    }
    let parsedDocQuery = chunks[1] ? JSON.parse(chunks[1].trim()) : JSON.parse(Selection.DEFAULT_DOC_QUERY);
    return {
      docQuery: chunks[1] ? chunks[1].trim() : Selection.DEFAULT_DOC_QUERY,
      parsedDocQuery,
      objQuery: chunks[2] ? chunks[2].trim() : '',
      parentShift: chunks[3] ? chunks[3].length : 0,
      followLinks: !!chunks[4]
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
      // Attempt to parse as a reference
      if (value[0] === '@' && this.parseSelector(value) !== null) {
        return this.CONSTRUCTS.ReferenceConstruct;
      }
      // Not a reference...
      if (aggressive) {
        // Aggressively attempt to identify something more specific than string
        if (!isNaN(Number(value))) {
          return this.CONSTRUCTS.NumberConstruct;
        /*
         For now, we don't attempt to identify dates, even in aggressive mode,
         because things like new Date('Player 1') will successfully parse as a
         date. If we can find smarter ways to auto-infer dates (e.g. does the
         value fall suspiciously near the unix epoch, y2k, or more than +/-500
         years from now? Do sibling container items parse this as a date?), then
         maybe we'll add this back...
        */
        // } else if (!isNaN(new Date(value))) {
        //  return CONSTRUCTS.DateConstruct;
        } else {
          const temp = value.toLowerCase();
          if (temp === 'true') {
            return this.CONSTRUCTS.BooleanConstruct;
          } else if (temp === 'false') {
            return this.CONSTRUCTS.BooleanConstruct;
          } else if (temp === 'null') {
            return this.CONSTRUCTS.NullConstruct;
          }
        }
      }
      // Okay, it's just a string
      return this.CONSTRUCTS.StringConstruct;
    } else if (jsType === 'function' || jsType === 'symbol' || jsType === 'undefined' || value instanceof Array) {
      return this.CONSTRUCTS.InvalidConstruct;
    } else if (value === null) {
      return this.CONSTRUCTS.NullConstruct;
    } else if (value instanceof Date || value.$isDate === true) {
      return this.CONSTRUCTS.DateConstruct;
    } else if (value.$nodes) {
      return this.CONSTRUCTS.EdgeConstruct;
    } else if (value.$edges) {
      if (value.$members) {
        return this.CONSTRUCTS.SupernodeConstruct;
      } else {
        return this.CONSTRUCTS.NodeConstruct;
      }
    } else if (value.$members) {
      return this.CONSTRUCTS.SetConstruct;
    } else if (value.$tags) {
      return this.CONSTRUCTS.TaggableConstruct;
    } else {
      return this.CONSTRUCTS.ItemConstruct;
    }
  }
  async followRelativeLink (selector, doc) {
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
      tempSelection = new Selection(this, selector);
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
