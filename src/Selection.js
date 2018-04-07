import { Model } from 'uki';
import jsonPath from 'jsonpath';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection extends Model {
  constructor (mure, selector = '@' + DEFAULT_DOC_QUERY, { selectSingle = false, parentSelection = null } = {}) {
    super();
    let chunks = /@\s*({.*})?\s*(#[^$]*)?\s*(\$[^^]*)?\s*(\^*)?/.exec(selector);
    if (!chunks) {
      let err = new Error('Invalid selector: ' + selector);
      err.INVALID_SELECTOR = true;
      throw err;
    }
    this.docQuery = chunks[1]
      ? chunks[1].trim() : parentSelection
        ? parentSelection.docQuery : DEFAULT_DOC_QUERY;
    this.parsedDocQuery = this.docQuery ? JSON.parse(this.docQuery) : {};
    this.flagQuery = chunks[2] ? chunks[2].trim().split('#').slice(1) : null;
    this.objQuery = parentSelection
      ? parentSelection.objQuery : '';
    this.objQuery += !chunks[3]
      ? '' : this.objQuery
        ? chunks[3].trim().slice(1) : chunks[3].trim();
    this.parentShift = chunks[4] ? chunks[4].length : 0;

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
  async nodes ({ includeMetadata = [] } = {}) {
    let docs = await this.docs();

    // Collect the results of objQuery and flagQuery
    let nodes = [];
    if (this.objQuery === '') {
      if (this.flagQuery) {
        // Flag-based selections with no objQuery to evaluate are pretty straightforward...
        docs.forEach(doc => {
          // Find the intersection of cached docQueries that ALL have the associated flagName
          let objQueries = this.flagQuery.reduce((agg, flagName) => {
            if (agg === null) {
              return new Set(Object.keys(doc.flags[flagName] || {}));
            } else {
              return new Set(Object.keys(doc.flags[flagName] || {})
                .filter(objQuery => agg.has(objQuery)));
            }
          }, null);
          objQueries.forEach(objQuery => {
            
          });
        });
      } else {
        // No objQuery and no flagQuery means that we want to select the documents
        // themselves (objQuery === '$' would collect the contents of each document)
        let rootNode = {
          path: [],
          value: {},
          uniqueSelector: '@'
        };
        Object.keys(docs).some(docId => {
          rootNode.value[docId] = docs[docId].contents;
          return this.selectSingle;
        });
        nodes.push(rootNode);
      }
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
          nodes.push(node);
          return this.selectSingle; // when true, exits both loops after the first match is found
        });
        return selectedSingle;
      });
    }

    // Apply the parentShift, if applicable

    // Add requested metadata to the result
    if (includeMetadata.length > 0) {
      nodes.forEach(node => {
        node.metadata = {};
        if (node.docId) {
          let doc = docs[node.docId];
          includeMetadata.forEach(metadataLabel => {
            let metaTree = doc[metadataLabel];
            if (metaTree && node.uniqueJsonPath) {
              node.metadata[metadataLabel] = jsonPath.value(metaTree, node.uniqueJsonPath);
            }
          });
        }
      });
    }
    return nodes;
  }
  async docs () {
    let docs = {};
    let result;
    if (this.flagQuery && this.headless) {
      // We can get the documents faster, because their ids are cached...
      let docFlags = (await this.mure.query({
        selector: { _id: '$docFlags' }
      }))[0];
      // Find the intersection of documents that have all the queried flags
      let docIds = this.flagQuery.reduce((agg, flagName) => {
        if (agg === null) {
          return new Set(Object.keys(docFlags[flagName] || {}));
        } else {
          return new Set(Object.keys(docFlags[flagName] || {})
            .filter(docId => agg.has(docId)));
        }
      }, null);
      result = await this.mure.query({
        selector: { _id: { '$in': Array.from(docIds) } }
      });
    } else {
      // Default behavior
      result = await this.mure.query({
        selector: this.parsedDocQuery
      });
    }
    result.forEach(doc => { docs[doc._id] = doc; });
    return docs;
  }
  async jsonPathsByDocId () {
    let nodes = await this.nodes();
    let docs = {};
    nodes.forEach(node => {
      if (node.path.length > 0) {
        docs[node.docId] = docs[node.docId] || {};
        let nodeSelector = jsonPath.stringify(node.path.slice(1));
        docs[node.docId][nodeSelector] = true;
      }
    });
    return docs;
  }
  async addFlag (flagName) {
    let paths = await this.jsonPathsByDocId();

    let docsToGet = Object.keys(paths);
    docsToGet.push('$docFlags');
    let relevantDocs = await this.mure.query({
      selector: { _id: { '$in': docsToGet } }
    });
    relevantDocs.forEach(doc => {
      if (doc._id === '$docFlags') {
        doc[flagName] = Object.assign(doc[flagName] || {}, paths);
      } else {
        doc.flags[flagName] = Object.assign(doc.flags[flagName] || {}, paths[doc._id]);
      }
    });
    return this.mure.db.bulkDocs(relevantDocs);
  }
  async removeFlag (flagName) {
    let paths = await this.jsonPathsByDocId();

    let docsToGet = Object.keys(paths);
    docsToGet.push('$docFlags');
    let relevantDocs = await this.mure.query({
      selector: { _id: { '$in': docsToGet } }
    });
    relevantDocs.forEach(doc => {
      if (doc._id === '$docFlags') {
        if (doc[flagName]) {
          Object.keys(paths).forEach(docId => {
            if (doc[flagName][docId]) {
              delete doc[flagName][docId][paths[docId]];
              if (Object.keys(doc[flagName][docId]).length === 0) {
                delete doc[flagName][docId];
              }
            }
          });
          if (Object.keys(doc[flagName]).length === 0) {
            delete doc[flagName];
          }
        }
      } else {
        if (doc.flags[flagName]) {
          Object.keys(paths[doc._id]).forEach(objQuery => {
            delete doc.flags[flagName][objQuery];
          });
          if (Object.keys(doc.flags[flagName]).length === 0) {
            delete doc.flags[flagName];
          }
        }
      }
    });
    return this.mure.db.bulkDocs(relevantDocs);
  }
}
Selection.DEFAULT_DOC_QUERY = DEFAULT_DOC_QUERY;
export default Selection;
