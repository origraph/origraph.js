import { Model } from 'uki';
import jsonPath from 'jsonpath';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection extends Model {
  constructor (mure, selector = '@' + DEFAULT_DOC_QUERY + '$', { selectSingle = false, parentSelection = null } = {}) {
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
    this.parsedDocQuery = this.docQuery ? JSON.parse(this.docQuery) : {};
    this.isIdBasedQuery = this.parsedDocQuery._id && Object.keys(this.parsedDocQuery).length === 1;
    this.objQuery = parentSelection
      ? parentSelection.objQuery : '$';
    this.objQuery += chunks[2] ? chunks[2].trim().slice(1) : '';
    this.parentShift = chunks[3] ? chunks[3].length : 0;

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.mure.db.changes({ since: 'now', live: true })
      .on('change', change => { this.handleDbChange(change); });
  }
  get headless () {
    return this.docQuery === DEFAULT_DOC_QUERY;
  }
  select (selector) {
    return new Selection(this.mure, selector, { selectSingle: true, parentSelection: this });
  }
  selectAll (selector) {
    return new Selection(this.mure, selector, { parentSelection: this });
  }
  async handleDbChange (change) {
    if (this._docs) {
      let cacheInvalidated = false;
      if (!this.isIdBasedQuery ||
          (change.deleted === true && change._id === this.parsedDocQuery._id)) {
        // As this isn't a standard id-based query, it's possible that the
        // changed or new document happens to fit this.docQuery, so we need
        // to update this part of the cache
        let temp = this._docs;
        delete this._docs;
        let temp2 = await this.docs();
        if (Object.keys(temp).length !== Object.keys(temp2)) {
          cacheInvalidated = true;
        }
      }
      if (this._docs[change._id]) {
        // Only need to trash this part of the cache if the change affects
        // one of our matching documents (this._nodes will be re-evaluated
        // lazily the next time this.nodes() is called)
        delete this._nodes;
        cacheInvalidated = true;
      }
      if (cacheInvalidated) {
        this.trigger('change');
      }
    }
  }
  async nodes ({ includeMetadata = [] } = {}) {
    let docs;
    if (!this._nodes || includeMetadata.length > 0) {
      // Don't need to get documents if we're only asking for a copy of the
      // basic cached this._nodes
      docs = await this.docs();
    }

    // Collect and cache the results of the jsonPath queries
    if (!this._nodes) {
      this._nodes = [];
      Object.keys(docs).some(docId => {
        let doc = docs[docId];
        let docPathQuery = '{"_id":"' + docId + '"}';
        let selectedSingle = jsonPath.nodes(doc.contents, this.objQuery).some(node => {
          if (this.parentShift) {
            // Now that we have unique, normalized paths for each node, we can
            // apply the parentShift option to select parents based on child
            // attributes
            node.path.splice(node.path.length - this.parentShift);
            let temp = jsonPath.stringify(node.path);
            node.value = jsonPath.query(doc.contents, temp)[0];
          }
          node.uniqueJsonPath = jsonPath.stringify(node.path);
          node.uniqueSelector = '@' + docPathQuery + node.uniqueJsonPath;
          node.path.unshift(docPathQuery);
          this._nodes.push(node);
          return this.selectSingle; // when true, exits both loops after the first match is found
        });
        return selectedSingle;
      });
    }

    let nodes = Array.from(this._nodes);
    // Add requested metadata to a copy of the cached result
    if (includeMetadata.length > 0) {
      nodes.forEach(node => {
        node.metadata = {};
        let doc = docs[node.path[0]];
        includeMetadata.forEach(metadataLabel => {
          node.metadata[metadataLabel] = jsonPath.value(doc[metadataLabel], node.uniqueSelector);
        });
      });
    }
    return nodes;
  }
  async docs () {
    if (this._docs) {
      return Object.assign({}, this._docs);
    }
    let query = { selector: this.parsedDocQuery };
    let queryResult = await this.mure.db.find(query);
    if (queryResult.warning) { this.mure.warn(queryResult.warning); }
    this._docs = {};
    queryResult.docs.forEach(doc => { this._docs[doc._id] = doc; });
    return Object.assign({}, this._docs);
  }
}
Selection.DEFAULT_DOC_QUERY = DEFAULT_DOC_QUERY;
export default Selection;
