import jsonPath from 'jsonpath';
import queueAsync from './queueAsync.js';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection {
  constructor (mure, selectorList = ['@' + DEFAULT_DOC_QUERY], { selectSingle = false, parentSelection = null, chainedDocId = null } = {}) {
    if (!(selectorList instanceof Array)) {
      selectorList = [ selectorList ];
    }
    this.selectors = selectorList.reduce((agg, selectorString) => {
      let chunks = /@\s*({.*})?\s*(\$[^↑→]*)?\s*(↑*)\s*(→)?/.exec(selectorString);
      if (!chunks) {
        let err = new Error('Invalid selector: ' + selectorString);
        err.INVALID_SELECTOR = true;
        throw err;
      }
      let parsedDocQuery = chunks[1] ? JSON.parse(chunks[1].trim()) : JSON.parse(DEFAULT_DOC_QUERY);
      if (parentSelection) {
        parentSelection.selectors.forEach(parentSelector => {
          let mergedDocQuery = Object.assign({}, parsedDocQuery, parentSelector.parsedDocQuery);
          let selector = {
            docQuery: JSON.stringify(mergedDocQuery),
            parsedDocQuery: mergedDocQuery,
            parentShift: parentSelector.parentShift + (chunks[3] ? chunks[3].length : 0),
            followLinks: !!chunks[4]
          };
          if (parentSelector.objQuery) {
            selector.objQuery = parentSelector.objQuery + (chunks[2] ? chunks[2].trim().slice(1) : '');
          } else {
            selector.objQuery = chunks[2] ? chunks[2].trim() : '';
          }
          agg.push(selector);
        });
      } else if (chainedDocId) {
        let selector = {
          docQuery: chunks[1] ? chunks[1].trim() : `{"_id":"${chainedDocId}"}`,
          parsedDocQuery: chunks[1] ? parsedDocQuery : { _id: chainedDocId },
          objQuery: chunks[2] ? chunks[2].trim() : '',
          parentShift: chunks[3] ? chunks[3].length : 0,
          followLinks: !!chunks[4]
        };
        agg.push(selector);
      } else {
        let selector = {
          docQuery: chunks[1] ? chunks[1].trim() : DEFAULT_DOC_QUERY,
          parsedDocQuery,
          objQuery: chunks[2] ? chunks[2].trim() : '',
          parentShift: chunks[3] ? chunks[3].length : 0,
          followLinks: !!chunks[4]
        };
        agg.push(selector);
      }
      return agg;
    }, []);

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.pendingOperations = [];
  }
  get selectorList () {
    return this.selectors.map(selector => {
      return '@' + selector.docQuery + selector.objQuery +
        Array.from(Array(selector.parentShift)).map(d => '↑').join('') +
        selector.followLinks ? '→' : '';
    });
  }
  select (selectorList) {
    return new Selection(this.mure, selectorList, { selectSingle: true, parentSelection: this });
  }
  selectAll (selectorList) {
    return new Selection(this.mure, selectorList, { parentSelection: this });
  }
  async docLists () {
    return Promise.all(this.selectors
      .map(d => this.mure.queryDocs({ selector: d.parsedDocQuery })));
  }
  normalizeUniqueSelector (selector, contextDocQuery) {
    if (/@\s*{.*}/.exec(selector)) {
      return selector;
    } else {
      return contextDocQuery + selector;
    }
  }
  inferType (value) {
    const jsType = typeof value;
    if (this.mure.TYPES[jsType]) {
      if (jsType === 'string' && value[0] === '@') {
        try {
          new Selection(this.mure, value); // eslint-disable-line no-new
        } catch (err) {
          if (err.INVALID_SELECTOR) {
            return this.mure.TYPES.string;
          } else {
            throw err;
          }
        }
        return this.mure.TYPES.reference;
      } else {
        return this.mure.TYPES[jsType];
      }
    } else if (value === null) {
      return this.mure.TYPES.null;
    } else if (value instanceof Date) {
      return this.mure.TYPES.date;
    } else if (jsType === 'function' || jsType === 'symbol' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else {
      return this.mure.TYPES.container;
    }
  }
  createRootItem (docList) {
    const rootItem = {
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      type: this.mure.TYPES.root,
      uniqueSelector: '@',
      isSet: false
    };
    docList.some(doc => {
      rootItem.value[doc._id] = doc;
      return this.selectSingle;
    });
    return rootItem;
  }
  createDocItem (doc, docPathQuery) {
    let item = {
      path: [docPathQuery],
      value: doc,
      parentId: '@',
      doc: doc,
      label: doc['filename'],
      type: this.mure.TYPES.document,
      uniqueSelector: docPathQuery,
      isSet: false
    };
    return item;
  }
  applyParentShift (item, doc, parentShift) {
    item.path.splice(item.path.length - parentShift);
    let temp = jsonPath.stringify(item.path);
    item.value = jsonPath.query(doc, temp)[0];
    return item;
  }
  async followItemLink (item, doc) {
    // This selector specifies to follow the link
    let tempSelection;
    try {
      tempSelection = new Selection(this.mure, item.value,
        { selectSingle: this.selectSingle, chainedDocId: doc._id });
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    if (tempSelection.selectors.reduce((agg, selector) => agg &&
        (selector.parsedDocQuery._id !== doc._id), true)) {
      console.warn('Auto-following cross-document references is not yet supported');
      return [];
    }
    return tempSelection.items({ docLists: [[doc]] });
  }
  createRegularItem (item, doc, docPathQuery) {
    if (item.path.length === 2) { // this function shouldn't be called if less than 2
      item.parent = doc;
    } else {
      let temp = jsonPath.stringify(item.path.slice(0, item.path.length - 1));
      item.parent = jsonPath.value(doc, temp);
    }
    item.doc = doc;
    item.label = item.path[item.path.length - 1];
    item.type = this.inferType(item.value);
    item.isSet = item.type === this.mure.TYPES.container && !!item.value.$members;
    let uniqueJsonPath = jsonPath.stringify(item.path);
    item.uniqueSelector = '@' + docPathQuery + uniqueJsonPath;
    item.path.unshift(docPathQuery);
    return item;
  }
  async items ({ docLists } = {}) {
    docLists = docLists || await this.docLists();

    return queueAsync(async () => {
      // Collect the results of objQuery
      const items = [];
      const itemLookup = {};

      const addItem = item => {
        if (!itemLookup[item.uniqueSelector]) {
          itemLookup[item.uniqueSelector] = items.length;
          items.push(item);
        }
      };

      for (let index = 0; index < this.selectors.length; index++) {
        const selector = this.selectors[index];
        const docList = docLists[index];

        if (selector.objQuery === '') {
          // No objQuery means that we want a view of multiple documents (other
          // shenanigans mean we shouldn't select anything)
          if (selector.parentShift === 0 && !selector.followLinks) {
            addItem(this.createRootItem(docList));
          }
        } else if (selector.objQuery === '$') {
          // Selecting the documents themselves
          if (selector.parentShift === 0 && !selector.followLinks) {
            docList.some(doc => {
              addItem(this.createDocItem(doc, `{"_id":"${doc._id}"}`));
              return this.selectSingle;
            });
          } else if (selector.parentShift === 1) {
            addItem(this.createRootItem(docList));
          }
        } else {
          // Okay, we need to evaluate the jsonPath
          for (let docIndex = 0; docIndex < docList.length; docIndex++) {
            let doc = docList[docIndex];
            let docPathQuery = `{"_id":"${doc._id}"}`;
            let matchingItems = jsonPath.nodes(doc, selector.objQuery);
            for (let itemIndex = 0; itemIndex < matchingItems.length; itemIndex++) {
              let item = matchingItems[itemIndex];
              if (selector.parentShift === item.path.length) {
                // we parent shifted up to the root level
                if (!selector.followLinks) {
                  addItem(this.createRootItem(docList));
                }
              } else if (selector.parentShift === item.path.length - 1) {
                // we parent shifted to the document level
                if (!selector.followLinks) {
                  addItem(this.createDocItem(doc, docPathQuery));
                }
              } else if (selector.parentShift < item.path.length - 1) {
                item = this.applyParentShift(item, doc, selector.parentShift);
                if (selector.followLinks) {
                  // We (potentially) selected a link that we need to follow
                  (await this.followItemLink(item, doc))
                    .forEach(addItem);
                } else {
                  // We selected a normal item
                  addItem(this.createRegularItem(item, doc, docPathQuery));
                }
              }
              if (this.selectSingle && items.length > 0) { break; }
            }
            if (this.selectSingle && items.length > 0) { break; }
          }
        }

        if (this.selectSingle && items.length > 0) { break; }
      }
      return items;
    });
  }
  async useCacheOrAwait ({ docLists, items }) {
    docLists = docLists || await this.docLists();
    items = items || await this.items({ docLists });
    return { docLists, items };
  }
  async getLinkedSelections (metaObj, cache) {
    cache = await this.useCacheOrAwait(cache);
    return cache.items.map(item => {
      if (!item[metaObj]) {
        return null;
      } else {
        return new Selection(this.mure, Object.keys(item[metaObj]), { chainedDocId: item.doc._id });
      }
    });
  }
  async selectLinked (metaObj, cache) {
    cache = await this.useCacheOrAwait(cache);
    let linkedIds = {};
    cache.items.forEach(item => {
      if (item.$members) {
        let docQuery = `@{"_id":"${item.doc._id}"}`;
        Object.keys(item.$members).forEach(memberId => {
          linkedIds[this.normalizeUniqueSelector(memberId, docQuery)] = true;
        });
      }
    });
    return new Selection(this.mure, Object.keys(linkedIds));
  }
  async getSetContentSelections (cache) {
    return this.getLinkedSelections('$members', cache);
  }
  async selectSetContents (cache) {
    return this.selectLinked('$members', cache);
  }
  async getTaggedSetSelections (cache) {
    return this.getLinkedSelections('$tags', cache);
  }
  async selectTaggedSets (cache) {
    return this.selectLinked('$tags', cache);
  }
  async getEdgeSelections (cache) {
    return this.getLinkedSelections('$edges', cache);
  }
  async selectEdges (cache) {
    return this.selectLinked('$edges', cache);
  }
  async getNodeSelections (cache) {
    return this.getLinkedSelections('$edges', cache);
  }
  async selectNodes (cache) {
    return this.selectLinked('$nodes', cache);
  }
  async save (cache) {
    cache = await this.useCacheOrAwait(cache);
    this.pendingOperations.forEach(func => {
      cache.items.forEach(item => {
        func.apply(this, [item]);
      });
    });
    this.pendingOperations = [];
    let docIds = {};
    await this.mure.putDocs(cache.docLists.reduce((agg, docList) => {
      docList.forEach(doc => {
        if (!docIds[doc._id]) {
          agg.push(doc);
          docIds[doc._id] = true;
        }
      });
      return agg;
    }, []));
    return this;
  }
  each (func) {
    this.pendingOperations.push(func);
    return this;
  }
  attr (key, value) {
    return this.each(item => {
      if (item.parent === null) {
        throw new Error(`Renaming files with .attr() is not yet supported`);
      }
      item.value[key] = value;
    });
  }
  remove () {
    return this.each(item => {
      if (item.parent === null) {
        throw new Error(`Deleting files with .remove() is not yet supported`);
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
