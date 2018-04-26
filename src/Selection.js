import jsonPath from 'jsonpath';
import hash from 'object-hash';
import queueAsync from './queueAsync.js';

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection {
  constructor (mure, selectorList = ['@' + DEFAULT_DOC_QUERY], { selectSingle = false, parentSelection = null } = {}) {
    if (!(selectorList instanceof Array)) {
      selectorList = [ selectorList ];
    }
    this.selectors = selectorList.reduce((agg, selectorString) => {
      let chunks = /@\s*({.*})?\s*(\$[^↑→]*)?\s*(↑*)\s*(→)?(.*)/.exec(selectorString);
      if (!chunks || chunks[5]) {
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
  createRootItem (docList) {
    const rootItem = {
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      type: this.mure.TYPES.root,
      uniqueSelector: '@',
      classes: []
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
      classes: []
    };
    return item;
  }
  applyParentShift (item, doc, parentShift) {
    item.path.splice(item.path.length - parentShift);
    let temp = jsonPath.stringify(item.path);
    item.value = jsonPath.query(doc, temp)[0];
    return item;
  }
  extractDocQuery (selectorString) {
    let result = /@\s*({.*})/.exec(selectorString);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    } else {
      return null;
    }
  }
  async followItemLink (selector, doc) {
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
      tempSelection = new Selection(this.mure, selector,
        { selectSingle: this.selectSingle });
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    let docLists = crossDoc ? await tempSelection.docLists() : [[ doc ]];
    return tempSelection.items({ docLists });
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
  getItemClasses (item) {
    return Object.keys(item.value.$tags).reduce((agg, setId) => {
      let temp = this.mure.itemHandler.extractClassInfoFromId(setId);
      if (temp) {
        agg.push(temp.className);
      }
      return agg;
    }, []).sort();
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
    item.classes = item.path[1] === 'contents' &&
      item.type === this.mure.TYPES.container ? this.getItemClasses(item) : [];
    let uniqueJsonPath = jsonPath.stringify(item.path);
    item.uniqueSelector = '@' + docPathQuery + uniqueJsonPath;
    item.path.unshift(docPathQuery);
    return item;
  }
  async items ({ docLists } = {}) {
    docLists = docLists || await this.docLists();

    return queueAsync(async () => {
      // Collect the results of objQuery
      const items = {};
      let addedItem = false;

      const addItem = item => {
        addedItem = true;
        if (!items[item.uniqueSelector]) {
          items[item.uniqueSelector] = item;
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
              if (this.mure.RESERVED_OBJ_KEYS[item.path.slice(-1)[0]]) {
                continue;
              } else if (selector.parentShift === item.path.length) {
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
                  Object.values(await this.followItemLink(item.value, doc))
                    .forEach(addItem);
                } else {
                  // We selected a normal item
                  addItem(this.createRegularItem(item, doc, docPathQuery));
                }
              }
              if (this.selectSingle && addedItem) { break; }
            }
            if (this.selectSingle && addedItem) { break; }
          }
        }

        if (this.selectSingle && addedItem) { break; }
      }
      return items;
    });
  }
  objIdToUniqueSelector (selectorString, docId) {
    let chunks = /@[^$]*(\$.*)/.exec(selectorString);
    return `@{"_id":"${docId}"}${chunks[1]}`;
  }
  addItemToContainer (itemToAdd, container, containerPath, label) {
    if (itemToAdd.type === this.mure.TYPES.container) {
      if (itemToAdd.value._id) {
        throw new Error('Item has already been assigned an _id');
      }
      if (label === undefined) {
        if (container.$nextLabel !== undefined) {
          label = container.$nextLabel;
          container.$nextLabel += 1;
        } else {
          label = Object.keys(container)
            .reduce((max, key) => typeof key === 'number' && key > max ? key : max, 0);
        }
      }
      itemToAdd.value._id = `@${jsonPath.stringify(containerPath.concat([label]))}`;
    }
    container[label] = itemToAdd.value;
    return itemToAdd;
  }
  addItemToSet (itemToAdd, setObj, { itemFileId, setFileId } = {}) {
    const itemId = itemFileId ? this.objIdToUniqueSelector(itemToAdd.value._id, itemFileId) : itemToAdd.value._id;
    const setId = setFileId ? this.objIdToUniqueSelector(setObj._id, setFileId) : setObj._id;
    setObj.$members[itemId] = true;
    itemToAdd.value.$tags[setId] = true;
    return itemToAdd;
  }
  createEdge (item, otherItem, container, directed) {
    let newEdge = this.addItemToContainer(
      {
        type: this.mure.TYPES.container,
        value: { $nodes: {}, $tags: {} },
        doc: container.doc
      },
      container.value,
      container.path);

    if (item.doc === container.doc) {
      newEdge.value.$nodes[item.value._id] = directed ? 'source' : true;
      item.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[item.uniqueSelector] = directed ? 'source' : true;
      item.value.$edges[this.objIdToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }

    if (otherItem.doc === container.doc) {
      newEdge.value.$nodes[otherItem.value._id] = directed ? 'target' : true;
      otherItem.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[otherItem.uniqueSelector] = directed ? 'target' : true;
      otherItem.value.$edges[this.objIdToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }
    return newEdge;
  }
  getFlatGraphSchema (items) {
    let result = {
      nodeClasses: [],
      nodeClassLookup: {},
      edgeClasses: [],
      edgeClassLookup: {}
    };

    // First pass: collect and count which node classes exist, and create a
    // temporary edge sublist for the second pass
    let edges = {};
    for (let [uniqueSelector, item] in Object.entries(items)) {
      if (item.value.$edges) {
        item.classes.forEach(className => {
          if (!result.nodeClassLookup[className]) {
            result.nodeClassLookup[className] = result.nodeClasses.length;
            result.nodeClasses.push({
              name: className,
              count: 0
            });
          }
          result.nodeClasses[result.nodeClassLookup[className]].count += 1;
        });
      } else if (item.value.$nodes) {
        edges[uniqueSelector] = item;
      }
    }

    // Second pass: find and count which distinct
    // node class -> edge class -> node class
    // sets exist
    for (let edgeItem in Object.values(edges)) {
      let temp = {
        edgeClasses: edgeItem.classes,
        sourceClasses: [],
        targetClasses: [],
        undirectedClasses: [],
        count: 0
      };
      for (let [nodeId, relativeNodeDirection] in Object.entries(edgeItem.value.$nodes)) {
        let uniqueNodeSelector = this.objIdToUniqueSelector(nodeId);
        let nodeItem = items[uniqueNodeSelector];
        // todo: in the intersected schema, use nodeItem.classes.join(',') instead of concat
        if (relativeNodeDirection === 'source') {
          temp.sourceClasses = temp.sourceClasses.concat(nodeItem.classes);
        } else if (relativeNodeDirection === 'target') {
          temp.targetClasses = temp.targetClasses.concat(nodeItem.classes);
        } else {
          temp.undirectedClasses = temp.undirectedClasses.concat(nodeItem.classes);
        }
      }
      let edgeKey = hash(temp);
      if (!result.edgeClassLookup[edgeKey]) {
        result.edgeClassLookup[edgeKey] = result.edgeClasses.length;
        result.edgeClasses.push(temp);
      }
      result.edgeClasses[result.edgeClassLookup[edgeKey]].count += 1;
    }

    return result;
  }
  getIntersectedGraphSchema (items) {
    throw new Error('unimplemented');
  }
  getContainerSchema (items) {
    throw new Error('unimplemented');
  }
  allMetaObjIntersections (metaObjs, items) {
    let linkedIds = {};
    items.forEach(item => {
      metaObjs.forEach(metaObj => {
        if (item.value[metaObj]) {
          Object.keys(item.value[metaObj]).forEach(linkedId => {
            linkedId = this.objIdToUniqueSelector(linkedId, item.doc._id);
            linkedIds[linkedId] = linkedIds[linkedId] || {};
            linkedIds[linkedId][item.uniqueSelector] = true;
          });
        }
      });
    });
    let sets = [];
    let setLookup = {};
    Object.keys(linkedIds).forEach(linkedId => {
      let itemIds = Object.keys(linkedIds[linkedId]).sort();
      let setKey = itemIds.join(',');
      if (setLookup[setKey] === undefined) {
        setLookup[setKey] = sets.length;
        sets.push({ itemIds, linkedIds: {} });
      }
      setLookup[setKey].linkedIds[linkedId] = true;
    });
    return sets;
  }
  metaObjUnion (metaObjs, items) {
    let linkedIds = {};
    Object.values(items).forEach(item => {
      metaObjs.forEach(metaObj => {
        if (item.value[metaObj]) {
          Object.keys(item.value[metaObj]).forEach(linkedId => {
            linkedIds[this.objIdToUniqueSelector(linkedId, item.doc._id)] = true;
          });
        }
      });
    });
    return Object.keys(linkedIds);
  }
  selectAllSetMembers (items) {
    return new Selection(this.mure, this.metaObjUnion(['$members'], items));
  }
  selectAllContainingSets (items) {
    return new Selection(this.mure, this.metaObjUnion(['$tags'], items));
  }
  selectAllEdges (items) {
    return new Selection(this.mure, this.metaObjUnion(['$edges'], items));
  }
  selectAllNodes (items) {
    return new Selection(this.mure, this.metaObjUnion(['$nodes'], items));
  }
  async save ({ docLists, items } = {}) {
    docLists = docLists || await this.docLists();
    items = items || await this.items({ docLists });

    let itemList = Object.values(items);
    for (let f = 0; f < this.pendingOperations.length; f++) {
      const func = this.pendingOperations[f];
      for (let i = 0; i < itemList.length; i++) {
        const item = itemList[i];
        await func.apply(this, [item, items]);
      }
    }
    this.pendingOperations = [];
    let docIds = {};
    await this.mure.putDocs(docLists.reduce((agg, docList) => {
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
    let isFunction = typeof value === 'function';
    return this.each(item => {
      if (item.type === this.mure.TYPES.root) {
        throw new Error(`Renaming files with .attr() is not yet supported`);
      } else if (item.type === this.mure.TYPES.container ||
          item.type === this.mure.TYPES.document) {
        let temp = isFunction ? value.apply(this, item) : value;
        // item.value is just a pointer to the object in the document, so
        // we can just change it directly and it will still be saved
        item.value[key] = this.mure.itemHandler
          .standardize(temp, item.path.slice(1), item.doc.classes);
      } else {
        throw new Error(`Can't set .attr(${key}) on value of type ${item.type}`);
      }
    });
  }
  connect (otherItems, connectWhen, {
    directed = false,
    className = 'none',
    skipHyperEdges = false,
    saveInItem = null
  }) {
    otherItems = Object.values(otherItems)
      .filter(d => d.type === this.mure.TYPES.container);
    return this.each(item => {
      if (item.type === this.mure.TYPES.container) {
        let container = saveInItem || {
          path: [item.path[0], '$', 'orphanEdges'],
          value: item.doc.orphanEdges,
          doc: item.doc
        };
        otherItems.forEach(otherItem => {
          if (connectWhen.apply(this, [item, otherItem])) {
            if (item.value.$edges && otherItem.value.$edges) {
              const newEdge = this.createEdge(item, otherItem, container, directed);
              this.addClassToItem(className, newEdge);
            } else if (!skipHyperEdges) {
              if (item.value.$edges && otherItem.value.$nodes) {
                // TODO: add a link to/from item to otherItem's $nodes
                throw new Error('unimplemented');
              } else if (item.value.$nodes && otherItem.value.$edges) {
                // TODO: add a link to/from otherItem to item's $nodes
                throw new Error('unimplemented');
              } else if (item.value.$edges && otherItem.value.$edges) {
                // TODO: merge the two hyperedges
                throw new Error('unimplemented');
              }
            }
          }
        });
      }
    });
  }
  remove () {
    return this.each(item => {
      if (item.type === this.mure.TYPES.root) {
        throw new Error(`Can't remove() the root element`);
      } else if (item.type === this.mure.TYPES.document) {
        throw new Error(`Deleting files with .remove() is not yet supported`);
      } else {
        // item.parent is just a pointer to the parent object, so we can just
        // change it directly and it will still be saved
        delete item.parent[item.label];
      }
    });
  }
  group () {
    throw new Error('unimplemented');
  }
  addClassToItem (className, item) {
    item.doc.classes[className] = item.doc.classes[className] || {
      _id: '@' + jsonPath.stringify(['$', 'classes', className]),
      $members: {}
    };
    this.addItemToSet(item, item.doc.classes[className]);
  }
  addClass (className) {
    return this.each(item => {
      if (item.type !== this.mure.TYPES.container) {
        throw new Error(`Can't add a class to element of type ${item.type.toString()}`);
      } else {
        this.addClassToItem(className, item);
      }
    });
  }
  removeClass (className) {
    throw new Error('unimplemented');
  }
  setInterpretation (interpretation, saveInItem = null) {
    return this.each(async item => {
      if (item.type !== this.mure.TYPES.container) {
        throw new Error(`Can't interpret an element of type ${item.type.toString()} as a ${interpretation.toString()}`);
      } else if (interpretation === this.mure.INTERPRETATIONS.node) {
        item.value.$edges = {};
        if (item.value.$nodes) {
          let container = saveInItem || {
            path: [item.path[0], '$', 'orphanEdges'],
            value: item.doc.orphanEdges,
            doc: item.doc
          };
          const nodes = Object.entries(item.value.$nodes);
          delete item.value.$nodes;
          for (let n = 0; n < nodes.length; n++) {
            const link = nodes[n][0];
            const linkDirection = nodes[n][1];
            const otherItem = await this.followItemLink(link, item.doc);
            if (otherItem.doc === item.doc) {
              delete otherItem.value.$edges[item.value._id];
            } else {
              delete otherItem.value.$edges[item.uniqueSelector];
            }
            if (linkDirection === 'source') {
              this.createEdge(otherItem, item, container, true);
            } else if (linkDirection === 'target') {
              this.createEdge(item, otherItem, container, true);
            } else {
              this.createEdge(item, otherItem, container, false);
            }
          }
        }
      } else if (interpretation === this.mure.INTERPRETATIONS.edge) {
        item.value.$nodes = {};
        throw new Error('unimplemented');
      } else if (interpretation === this.mure.INTERPRETATIONS.ignore) {
        throw new Error('unimplemented');
      }
    });
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
