import { Model } from 'uki';
import jsonPath from 'jsonpath';
import TYPES from './Types.js';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection extends Model {
  constructor (mure, selector = '@' + DEFAULT_DOC_QUERY, { selectSingle = false, parentSelection = null } = {}) {
    super();
    let chunks = /@\s*({.*})?\s*(\$[^^]*)?\s*(\^*)?/.exec(selector);
    if (!chunks) {
      let err = new Error('Invalid selector: ' + selector);
      err.INVALID_SELECTOR = true;
      throw err;
    }
    this.docQuery = chunks[1]
      ? chunks[1].trim() : parentSelection
        ? parentSelection.docQuery : DEFAULT_DOC_QUERY;
    this.parsedDocQuery = this.docQuery
      ? JSON.parse(this.docQuery) : {};
    this.objQuery = parentSelection
      ? parentSelection.objQuery : '';
    this.objQuery += !chunks[2]
      ? '' : this.objQuery
        ? chunks[2].trim().slice(1) : chunks[2].trim();
    this.parentShift = chunks[3] ? chunks[3].length : 0;
    this.followLinks = chunks[4] === '@';

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.pendingOperations = [];
  }
  get headless () {
    return this.docQuery === DEFAULT_DOC_QUERY;
  }
  get selector () {
    return '@' + this.docQuery + this.objQuery +
      Array.from(Array(this.parentShift)).map(d => '^').join('');
  }
  select (selector) {
    return new Selection(this.mure, selector, { selectSingle: true, parentSelection: this });
  }
  selectAll (selector) {
    return new Selection(this.mure, selector, { parentSelection: this });
  }
  inferType (value) {
    const jsType = typeof value;
    if (TYPES[jsType]) {
      if (jsType === 'string' && value[0] === '@') {
        try {
          new Selection(this.mure, value); // eslint-disable-line no-new
        } catch (err) {
          if (err.INVALID_SELECTOR) {
            return TYPES.string;
          } else {
            throw err;
          }
        }
        return TYPES.reference;
      } else {
        return TYPES[jsType];
      }
    } else if (value === null) {
      return TYPES.null;
    } else if (value instanceof Date) {
      return TYPES.date;
    } else if (jsType === 'function' || jsType === 'symbol' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else {
      return TYPES.container;
    }
  }
  async docs () {
    let docs = {};
    let result = await this.mure.query({
      selector: this.parsedDocQuery
    });
    result.forEach(doc => { docs[doc._id] = doc; });
    return docs;
  }
  async items ({ docs } = {}) {
    // TODO: there isn't a direct need for async yet, but this is potentially
    // expensive / blocking for larger datasets; in the future, maybe it would
    // be best to offload bits to a web worker?
    docs = docs || await this.docs();

    // Collect the results of objQuery
    let items = [];
    if (this.parentShift > 0 &&
       (this.objQuery === '' || this.objQuery === '$')) {
      // Do nothing; the query reaches beyond the document level
    } else if (this.objQuery === '') {
      // No objQuery means that we want a view of multiple documents
      let rootItem = {
        path: [],
        value: {},
        parent: null,
        doc: null,
        label: null,
        type: TYPES.root,
        uniqueSelector: '@',
        isSet: false
      };
      Object.keys(docs).some(docId => {
        rootItem.value[docId] = docs[docId];
        return this.selectSingle;
      });
      items.push(rootItem);
    } else if (this.objQuery === '$') {
      // Selecting the documents themselves
      Object.keys(docs).some(docId => {
        let item = {
          path: ['{"_id":"' + docId + '"}'],
          value: docs[docId],
          parent: '@',
          doc: docs[docId],
          label: docs[docId]['filename'],
          type: TYPES.document,
          isSet: false
        };
        item.uniqueSelector = item.path[0];
        items.push(item);
        return this.selectSingle;
      });
    } else {
      // Selecting document contents
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
          item.type = this.inferType(item.value);
          item.isSet = item.type === TYPES.container && item.value.$members;
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
  async save ({ docs, items }) {
    items = items || await this.items({ docs });
    this.pendingOperations.forEach(func => {
      items.forEach(item => {
        func.apply(this, [item]);
      });
    });
    this.pendingOperations = [];
    await this.mure.putDocs(docs);
    return this;
  }
  each (func) {
    this.pendingOperations.push(func);
    return this;
  }
  attr (key, value) {
    if (this.docQuery === '') {
      throw new Error(`Can't set attributes at the root level; here you would need to call mure.putDoc()`);
    }
    return this.each(item => {
      item.value[key] = value;
    });
  }
  remove () {
    return this.each(item => {
      if (!item.parent) {
        throw new Error(`Can't remove without a parent object; to remove documents, call mure.removeDoc()`);
      }
      delete item.parent[item.label];
    });
  }
  group () {
    throw new Error('unimplemented');
  }
  connect () {
    throw new Error('unimplemented');
  }
  toggleEdge () {
    throw new Error('unimplemented');
  }
  toggleDirection () {
    throw new Error('unimplemented');
  }
  copy (newParentId) {
    throw new Error('unimplemented');
  }
  move (newParentId) {
    throw new Error('unimplemented');
  }
  dissolve () {
    throw new Error('unimplemented');
  }
}
Selection.DEFAULT_DOC_QUERY = DEFAULT_DOC_QUERY;
export default Selection;
