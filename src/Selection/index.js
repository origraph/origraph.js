import jsonPath from 'jsonpath';

class Selection {
  constructor (selector, mure, { selectSingle = false, parentSelection = null } = {}) {
    let chunks = /@\s*({.*})?\s*(\$[^^]*)?\s*(\^*)?/.exec(selector);
    if (!chunks) {
      throw new Error('Invalid selector: ' + selector);
    }
    if (parentSelection) {
      this.docQuery = parentSelection.docQuery;
      this.objQuery = parentSelection.objQuery;
      if (chunks[2]) {
        this.objQuery += chunks[2].slice(1); // strip off the subquery's '$' character
      }
    } else if (!chunks[1]) {
      throw new Error('Selection has no context; you must specify a document selector');
    } else {
      this.docQuery = chunks[1];
      this.objQuery = chunks[2] || '$';
    }
    this.parentShift = chunks[3] ? chunks[3].length : 0;
    this.mure = mure;
    this.selectSingle = selectSingle;
  }
  select (selector) {
    return new Selection(selector, this.mure, { selectSingle: true, parentSelection: this });
  }
  selectAll (selector) {
    return new Selection(selector, this.mure, { parentSelection: this });
  }
  async nodes (docQueryAdditions = null) {
    let docs = await this.docs(docQueryAdditions);
    let nodes = [];
    docs.some(doc => {
      let docPathQuery = '{"_id":"' + doc._id + '"}';
      return jsonPath.nodes(doc.contents, this.objQuery).some(node => {
        if (this.parentShift) {
          node.path.splice(node.path.length - this.parentShift);
          let temp = jsonPath.stringify(node.path);
          node.value = jsonPath.query(temp);
        }
        node.path.unshift(docPathQuery);
        nodes.push(node);
        return this.selectSingle; // when true, exits both loops after the first match is found
      });
    });
    return nodes;
  }
  async docs (docQueryAdditions = null) {
    let docQuery = JSON.parse(this.docQuery); // TODO: can't JSON.parse queries...
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
