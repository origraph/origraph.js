import jsonPath from 'jsonpath';

class Selection {
  constructor (selector, mure, { selectSingle = false, parentSelection = null } = {}) {
    if (!selector) {
      this.isRootSelection = true;
      this.docQuery = null;
      this.objQuery = '$';
      this.parentShift = 0;
    } else {
      let chunks = /@\s*({.*})?\s*(\$[^^]*)?\s*(\^*)?/.exec(selector);
      if (!chunks) {
        let err = new Error('Invalid selector: ' + selector);
        err.INVALID_SELECTOR = true;
        throw err;
      }
      if (parentSelection) {
        this.docQuery = parentSelection.docQuery;
        this.objQuery = parentSelection.objQuery;
        if (chunks[2]) {
          this.objQuery += chunks[2].trim().slice(1); // strip off the subquery's '$' character
        }
      } else if (!chunks[1]) {
        throw new Error('Selection has no context; you must specify a document selector');
      } else {
        this.docQuery = chunks[1];
        this.objQuery = chunks[2] ? chunks[2].trim() : '$';
      }
      this.parentShift = chunks[3] ? chunks[3].length : 0;
    }

    this.mure = mure;
    this.selectSingle = selectSingle;
  }
  select (selector) {
    let parentSelection = this.isRootSelection ? null : this;
    return new Selection(selector, this.mure, { selectSingle: true, parentSelection });
  }
  selectAll (selector) {
    let parentSelection = this.isRootSelection ? null : this;
    return new Selection(selector, this.mure, { parentSelection });
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
    if (!this.docQuery && !docQueryAdditions) {
      let queryResult = await this.mure.db.allDocs({
        include_docs: true,
        startkey: '_design\uffff'
      });
      return queryResult.rows;
    }
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
