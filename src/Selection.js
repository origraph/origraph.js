import { Model } from 'uki';
import jsonPath from 'jsonpath';

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
  async slices ({ docs, items } = {}) {
    // TODO: there isn't a direct need for async yet, but this is potentially
    // expensive / blocking for larger datasets; in the future, maybe it would
    // be best to offload bits to a web worker?
    docs = docs || await this.docs();
    items = items || await this.items(docs);

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
