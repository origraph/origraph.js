import jsonPath from 'jsonpath';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection {
  constructor (mure, selector = '@' + DEFAULT_DOC_QUERY + '$', { selectSingle = false, parentSelection = null } = {}) {
    let chunks = /@\s*({.*})?\s*(\$[^^]*)?\s*(\^*)?/.exec(selector);
    if (!chunks) {
      let err = new Error('Invalid selector: ' + selector);
      err.INVALID_SELECTOR = true;
      throw err;
    }
    this.docQuery = chunks[1]
      ? chunks[1].trim() : parentSelection
        ? parentSelection.docQuery : DEFAULT_DOC_QUERY;
    this.objQuery = parentSelection
      ? parentSelection.objQuery : '$';
    this.objQuery += chunks[2] ? chunks[2].trim().slice(1) : '';
    this.parentShift = chunks[3] ? chunks[3].length : 0;

    this.mure = mure;
    this.selectSingle = selectSingle;
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
  async nodes ({ includeMetadata = [], docQueryAdditions = null } = {}) {
    let docs = await this.docs({ docQueryAdditions });
    let nodes = [];
    docs.some(doc => {
      let docPathQuery = '{"_id":"' + doc._id + '"}';
      let dataResults = jsonPath.nodes(doc.contents, this.objQuery).some(node => {
        if (this.parentShift) {
          node.path.splice(node.path.length - this.parentShift);
          let temp = jsonPath.stringify(node.path);
          node.value = jsonPath.query(doc.contents, temp)[0];
        }
        node.uniqueJsonPath = jsonPath.stringify(node.path);
        node.uniqueSelector = '@' + docPathQuery + node.uniqueJsonPath;
        node.path.unshift(docPathQuery);
        if (includeMetadata.length > 0) {
          node.metadata = {};
        }
        nodes.push(node);
        return this.selectSingle; // when true, exits both loops after the first match is found
      });
      includeMetadata.forEach(metadataLabel => {
        if (doc[metadataLabel]) {
          dataResults.forEach(node => {
            node.metadata[metadataLabel] = jsonPath.value(doc[metadataLabel], node.uniqueSelector);
          });
        }
      });
      return dataResults;
    });
    return nodes;
  }
  async docs ({ docQueryAdditions = null } = {}) {
    let docQuery = this.docQuery ? JSON.parse(this.docQuery) : {}; // TODO: can't JSON.parse queries...
    if (docQueryAdditions) {
      docQuery = Object.assign(docQuery, docQueryAdditions);
    }
    let query = { selector: docQuery };
    let queryResult = await this.mure.db.find(query);
    if (queryResult.warning) { this.mure.warn(queryResult.warning); }
    return queryResult.docs;
  }
}
export default Selection;
