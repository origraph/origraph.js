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
    this.parsedDocQuery = this.docQuery ? JSON.parse(this.docQuery) : {};
    this.objQuery = parentSelection
      ? parentSelection.objQuery : '';
    this.objQuery += !chunks[2]
      ? '' : this.objQuery
        ? chunks[2].trim().slice(1) : chunks[2].trim();
    this.parentShift = chunks[3] ? chunks[3].length : 0;

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.mure.db.changes({
      since: 'now',
      live: true,
      selector: this.parsedDocQuery
    }).on('change', change => {
      delete this._docs;
      delete this._nodes;
      this.trigger('change');
    });
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
      if (this.objQuery === '') {
        // With no explicit objQuery, we only want one root node with each
        // documents' contents as the child nodes ($ will collect the contents
        // of each document)
        let rootNode = {};
        Object.keys(docs).some(docId => {
          let docPathQuery = '{"_id":"' + docId + '"}';
          rootNode[docId] = {
            path: [docPathQuery],
            value: docs[docId].contents,
            docId,
            uniqueJsonPath: '',
            uniqueSelector: '@' + docPathQuery
          };
          return this.selectSingle;
        });
        this._nodes.push(rootNode);
      } else {
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
            node.docId = docId;
            node.uniqueJsonPath = jsonPath.stringify(node.path);
            node.uniqueSelector = '@' + docPathQuery + node.uniqueJsonPath;
            node.path.unshift(docPathQuery);
            this._nodes.push(node);
            return this.selectSingle; // when true, exits both loops after the first match is found
          });
          return selectedSingle;
        });
      }
    }

    let nodes = Array.from(this._nodes);
    // Add requested metadata to a copy of the cached result
    if (includeMetadata.length > 0) {
      nodes.forEach(node => {
        node.metadata = {};
        let doc = docs[node.docId];
        includeMetadata.forEach(metadataLabel => {
          let metaTree = doc[metadataLabel];
          if (metaTree && node.uniqueJsonPath) {
            node.metadata[metadataLabel] = jsonPath.value(metaTree, node.uniqueJsonPath);
          }
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
