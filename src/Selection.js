import jsonPath from 'jsonpath';
import hash from 'object-hash';
import queueAsync from './queueAsync.js';
import { ItemHandler, RootItem, DocItem, ContainerItem, Item } from './Item.js';
import { TYPES, INTERPRETATIONS, RESERVED_OBJ_KEYS } from './Types.js';

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
    this.pollutedSelections = [];
  }
  invalidateCache () {
    delete this._cachedDocLists;
    delete this._cachedItems;
  }
  async docLists () {
    if (this._cachedDocLists) {
      return this._cachedDocLists;
    }
    this._cachedDocLists = await Promise.all(this.selectors
      .map(d => this.mure.queryDocs({ selector: d.parsedDocQuery })));
    // We want all selections to operate from exactly the same document object,
    // so it's easy / straightforward for Items to just mutate their own value
    // references, and have those changes automatically appear in documents
    // when they're saved... so we actually want to *swap out* matching documents
    // for their cached versions
    for (let i = 0; i < this._cachedDocLists.length; i++) {
      for (let j = 0; j < this._cachedDocLists[i].length; j++) {
        const doc = this._cachedDocLists[i][j];
        if (Selection.CACHED_DOCS[doc._id]) {
          if (Selection.CACHED_DOCS[doc._id].selections.indexOf(this) === -1) {
            // Register as a selection that's using this cache, so we're
            // notified in the event that it gets invalidated
            Selection.CACHED_DOCS[doc._id].selections.push(this);
          }
          // Verify that the doc has not changed (we watch for changes and
          // invalidate caches in mure.getOrInitDb, so this should never happen)
          if (doc._rev !== Selection.CACHED_DOCS[doc._id].cachedDoc._rev) {
            throw new Error('Cached document _rev changed without notification');
          }
          // Swap for the cached version
          this._cachedDocLists[i][j] = Selection.CACHED_DOCS[doc._id].cachedDoc;
        } else {
          // We're the first one to cache this document, so use ours
          Selection.CACHED_DOCS[doc._id] = {
            selections: [this],
            cachedDoc: doc
          };
        }
      }
    }
    return this._cachedDocLists;
  }
  async followRelativeLink (selector, doc, selectSingle = this.selectSingle) {
    // This selector specifies to follow the link
    if (typeof selector !== 'string') {
      return [];
    }
    let docQuery = ItemHandler.extractDocQuery(selector);
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
        { selectSingle: selectSingle });
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    let docLists = crossDoc ? await tempSelection.docLists() : [[ doc ]];
    return tempSelection.items(docLists);
  }
  async items (docLists) {
    // Note: we should only pass in docLists in rare situations (such as the
    // one-off case in followRelativeLink() where we already have the document
    // available, and creating the new selection will result in an unnnecessary
    // query of the database). Usually, we should rely on the cache.
    docLists = docLists || await this.docLists();
    if (this._cachedItems) {
      return this._cachedItems;
    }

    return queueAsync(async () => {
      // Collect the results of objQuery
      this._cachedItems = {};
      let addedItem = false;

      const addItem = item => {
        addedItem = true;
        if (!this._cachedItems[item.uniqueSelector]) {
          this._cachedItems[item.uniqueSelector] = item;
        }
      };

      for (let index = 0; index < this.selectors.length; index++) {
        const selector = this.selectors[index];
        const docList = docLists[index];

        if (selector.objQuery === '') {
          // No objQuery means that we want a view of multiple documents (other
          // shenanigans mean we shouldn't select anything)
          if (selector.parentShift === 0 && !selector.followLinks) {
            addItem(new RootItem(docList, this.selectSingle));
          }
        } else if (selector.objQuery === '$') {
          // Selecting the documents themselves
          if (selector.parentShift === 0 && !selector.followLinks) {
            docList.some(doc => {
              addItem(new DocItem(doc, `{"_id":"${doc._id}"}`));
              return this.selectSingle;
            });
          } else if (selector.parentShift === 1) {
            addItem(new RootItem(docList, this.selectSingle));
          }
        } else {
          // Okay, we need to evaluate the jsonPath
          for (let docIndex = 0; docIndex < docList.length; docIndex++) {
            let doc = docList[docIndex];
            let matchingItems = jsonPath.nodes(doc, selector.objQuery);
            for (let itemIndex = 0; itemIndex < matchingItems.length; itemIndex++) {
              let { path, value } = matchingItems[itemIndex];
              if (RESERVED_OBJ_KEYS[path.slice(-1)[0]]) {
                // Don't create items under reserved keys
                continue;
              } else if (selector.parentShift === path.length) {
                // we parent shifted up to the root level
                if (!selector.followLinks) {
                  addItem(new RootItem(docList, this.selectSingle));
                }
              } else if (selector.parentShift === path.length - 1) {
                // we parent shifted to the document level
                if (!selector.followLinks) {
                  addItem(new DocItem(doc));
                }
              } else {
                if (selector.parentShift > 0 && selector.parentShift < path.length - 1) {
                  // normal parentShift
                  path.splice(path.length - selector.parentShift);
                  value = jsonPath.query(doc, jsonPath.stringify(path))[0];
                }
                if (selector.followLinks) {
                  // We (potentially) selected a link that we need to follow
                  Object.values(await this.followRelativeLink(value, doc))
                    .forEach(addItem);
                } else {
                  const type = ItemHandler.inferType(value);
                  if (type === TYPES.container) {
                    // We selected an item that is a container
                    addItem(new ContainerItem(path, value, doc));
                  } else {
                    // We selected something else
                    addItem(new Item(path, value, doc, type));
                  }
                }
              }
              if (this.selectSingle && addedItem) { break; }
            }
            if (this.selectSingle && addedItem) { break; }
          }
        }

        if (this.selectSingle && addedItem) { break; }
      }
      return this._cachedItems;
    });
  }
  async save () {
    // Evaluate all the pending operations that we've accrued; as each function
    // manipulates Items' .value property, those changes will automatically be
    // reflected in the document (as every .value is a pointer, or BaseItem's
    // .value setter ensures that primitives are propagated)
    const items = await this.items();
    let itemList = Object.values(await this.items());
    for (let f = 0; f < this.pendingOperations.length; f++) {
      const func = this.pendingOperations[f];
      for (let i = 0; i < itemList.length; i++) {
        const item = itemList[i];
        await func.apply(this, [item, items]);
      }
    }
    this.pendingOperations = [];

    // We need to save all the documents that we refer to, in addition to
    // any documents belonging to other selections that we've polluted (each of
    // the pendingOperations should have added to this array if they change
    // values in other selections)
    const changedSelections = this.pollutedSelections.concat([this]);
    const changedDocs = [];
    const docIds = {};
    for (let s = 0; s < changedSelections.length; s++) {
      const docLists = await changedSelections[s].docLists();
      docLists.forEach(docList => {
        docList.forEach(doc => {
          if (!docIds[doc._id]) {
            docIds[doc._id] = true;
            changedDocs.push(doc);
          }
        });
      });
    }
    this.pollutedSelections = [];
    // Any selection that has cached any of these documents needs to have its
    // cache invalidated, even if we didn't pollute the selection directly
    changedDocs.forEach(doc => {
      Selection.INVALIDATE_DOC_CACHE(doc._id);
    });

    await this.mure.putDocs(changedDocs);
    return this;
  }
  /*
   These are mutator functions that don't actually do anything
   */
  each (func) {
    this.pendingOperations.push(func);
    return this;
  }
  attr (key, value) {
    let isFunction = typeof value === 'function';
    return this.each(item => {
      if (item.type === TYPES.root) {
        throw new Error(`Renaming files with .attr() is not yet supported`);
      } else if (item.type === TYPES.container ||
          item.type === TYPES.document) {
        let temp = isFunction ? value.apply(this, item) : value;
        // item.value is just a pointer to the object in the document, so
        // we can just change it directly and it will still be saved
        item.value[key] = ItemHandler
          .standardize(temp, item.path.slice(1), item.doc.classes);
      } else {
        throw new Error(`Can't set .attr(${key}) on value of type ${item.type}`);
      }
    });
  }
  connect (otherSelection, connectWhen, {
    directed = false,
    className = 'none',
    skipHyperEdges = false,
    saveInSelection = null
  } = {}) {
    return this.each(async item => {
      if (item.type === TYPES.container) {
        let container;
        if (saveInSelection) {
          container = await Object.values(saveInSelection.items())[0];
          if (this.pollutedSelections.indexOf(saveInSelection) === -1) {
            this.pollutedSelections.push(container);
          }
        } else {
          container = Object.values(
            await this.followRelativeLink('@$.orphanEdges', item.doc, true))[0];
        }
        const otherItems = await otherSelection.items();
        Object.values(otherItems).forEach(otherItem => {
          if (otherItem.type === TYPES.container &&
              connectWhen.apply(this, [item, otherItem])) {
            if (item.value.$edges && otherItem.value.$edges) {
              const newEdge = item.createEdge(otherItem, container, directed);
              newEdge.addClass(className);
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
        if (this.pollutedSelections.indexOf(otherSelection) === -1) {
          this.pollutedSelections.push(otherSelection);
        }
      }
    });
  }
  remove () {
    return this.each(item => {
      if (item.type === TYPES.root) {
        throw new Error(`Can't remove() the root element`);
      } else if (item.type === TYPES.document) {
        throw new Error(`Deleting files with .remove() is not yet supported`);
      } else {
        // item.parent is just a pointer to the parent item's value, so we can
        // just change it directly and it will still be saved
        delete item.parent[item.label];
      }
    });
  }
  group () {
    throw new Error('unimplemented');
  }
  addClass (className) {
    return this.each(item => {
      if (item.type !== TYPES.container) {
        throw new Error(`Can't add a class to element of type ${item.type.toString()}`);
      } else {
        item.addClass(className);
      }
    });
  }
  removeClass (className) {
    throw new Error('unimplemented');
  }
  setInterpretation (interpretation, saveInSelection = null) {
    return this.each(async item => {
      if (item.type !== TYPES.container) {
        throw new Error(`Can't interpret an element of type ${item.type.toString()} as a ${interpretation.toString()}`);
      } else if (interpretation === INTERPRETATIONS.node) {
        item.value.$edges = {};
        if (item.value.$nodes) {
          let container;
          if (saveInSelection) {
            container = await Object.values(saveInSelection.items())[0];
            if (this.pollutedSelections.indexOf(saveInSelection) === -1) {
              this.pollutedSelections.push(container);
            }
          } else {
            container = Object.values(
              await this.followRelativeLink('@$.orphanNodes', item.doc, true))[0];
          }
          const nodes = Object.entries(item.value.$nodes);
          delete item.value.$nodes;
          for (let n = 0; n < nodes.length; n++) {
            const link = nodes[n][0];
            const linkDirection = nodes[n][1];
            const otherItem = Object.values(
              await this.followRelativeLink(link, item.doc))[0];
            if (otherItem.doc === item.doc) {
              delete otherItem.value.$edges[item.value._id];
            } else {
              delete otherItem.value.$edges[item.uniqueSelector];
            }
            if (linkDirection === 'source') {
              otherItem.createEdge(item, container, true);
            } else if (linkDirection === 'target') {
              item.createEdge(otherItem, container, true);
            } else {
              item.createEdge(otherItem, container, false);
            }
          }
        }
      } else if (interpretation === INTERPRETATIONS.edge) {
        item.value.$nodes = {};
        throw new Error('unimplemented');
      } else if (interpretation === INTERPRETATIONS.ignore) {
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

  /*
   These functions provide statistics / summaries of the selection:
   */
  async getFlatGraphSchema () {
    const items = await this.items();
    let result = {
      nodeClasses: [],
      nodeClassLookup: {},
      edgeSets: [],
      edgeSetLookup: {}
    };

    // First pass: collect and count which node classes exist, and create a
    // temporary edge sublist for the second pass
    const edges = {};
    Object.entries(items).forEach(([uniqueSelector, item]) => {
      if (item.value.$edges) {
        item.classes.forEach(className => {
          if (result.nodeClassLookup[className] === undefined) {
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
    });

    // Second pass: find and count which distinct
    // node class -> edge class -> node class
    // sets exist
    Object.values(edges).forEach(edgeItem => {
      let temp = {
        edgeClasses: Array.from(edgeItem.classes),
        sourceClasses: [],
        targetClasses: [],
        undirectedClasses: [],
        count: 0
      };
      Object.entries(edgeItem.value.$nodes).forEach(([nodeId, relativeNodeDirection]) => {
        let nodeItem = items[nodeId] ||
          items[ItemHandler.idToUniqueSelector(nodeId, edgeItem.doc._id)];
        if (!nodeItem) {
          this.mure.warn('Edge refers to Node that is outside the selection; skipping...');
          return;
        }
        // todo: in the intersected schema, use nodeItem.classes.join(',') instead of concat
        if (relativeNodeDirection === 'source') {
          temp.sourceClasses = temp.sourceClasses.concat(nodeItem.classes);
        } else if (relativeNodeDirection === 'target') {
          temp.targetClasses = temp.targetClasses.concat(nodeItem.classes);
        } else {
          temp.undirectedClasses = temp.undirectedClasses.concat(nodeItem.classes);
        }
      });
      const edgeKey = hash(temp);
      if (result.edgeSetLookup[edgeKey] === undefined) {
        result.edgeSetLookup[edgeKey] = result.edgeSets.length;
        result.edgeSets.push(temp);
      }
      result.edgeSets[result.edgeSetLookup[edgeKey]].count += 1;
    });

    return result;
  }
  async getIntersectedGraphSchema () {
    // const items = await this.items();
    throw new Error('unimplemented');
  }
  async getContainerSchema () {
    // const items = await this.items();
    throw new Error('unimplemented');
  }
  async allMetaObjIntersections (metaObjs) {
    const items = await this.items();
    let linkedIds = {};
    items.forEach(item => {
      metaObjs.forEach(metaObj => {
        if (item.value[metaObj]) {
          Object.keys(item.value[metaObj]).forEach(linkedId => {
            linkedId = ItemHandler.idToUniqueSelector(linkedId, item.doc._id);
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
  async metaObjUnion (metaObjs) {
    const items = await this.items();
    let linkedIds = {};
    Object.values(items).forEach(item => {
      metaObjs.forEach(metaObj => {
        if (item.value[metaObj]) {
          Object.keys(item.value[metaObj]).forEach(linkedId => {
            linkedIds[ItemHandler.idToUniqueSelector(linkedId, item.doc._id)] = true;
          });
        }
      });
    });
    return Object.keys(linkedIds);
  }

  /*
   These functions are useful for deriving additional selections
   */
  get selectorList () {
    return this.selectors.map(selector => {
      return '@' + selector.docQuery + selector.objQuery +
        Array.from(Array(selector.parentShift)).map(d => '↑').join('') +
        (selector.followLinks ? '→' : '');
    });
  }
  deriveSelection (selectorList, options = { merge: false }) {
    if (options.merge) {
      selectorList = selectorList.concat(this.selectorList);
    }
    return new Selection(this.mure, selectorList, options);
  }
  merge (otherSelection, options = {}) {
    Object.assign(options, { merge: true });
    return this.deriveSelection(otherSelection.selectorList, options);
  }
  select (selectorList, options = {}) {
    Object.assign(options, { selectSingle: true, parentSelection: this });
    return this.deriveSelection(selectorList, options);
  }
  selectAll (selectorList, options = {}) {
    Object.assign(options, { parentSelection: this });
    return this.deriveSelection(selectorList, options);
  }
  async selectAllSetMembers (options) {
    return this.deriveSelection(await this.metaObjUnion(['$members']), options);
  }
  async selectAllContainingSets (options) {
    return this.deriveSelection(await this.metaObjUnion(['$tags']), options);
  }
  async selectAllEdges (options) {
    return this.deriveSelection(await this.metaObjUnion(['$edges']), options);
  }
  async selectAllNodes (options = false) {
    return this.deriveSelection(await this.metaObjUnion(['$nodes']), options);
  }
}
Selection.DEFAULT_DOC_QUERY = DEFAULT_DOC_QUERY;
Selection.CACHED_DOCS = {};
Selection.INVALIDATE_DOC_CACHE = docId => {
  if (Selection.CACHED_DOCS[docId]) {
    Selection.CACHED_DOCS[docId].selections.forEach(selection => {
      selection.invalidateCache();
    });
    delete Selection.CACHED_DOCS[docId];
  }
};
export default Selection;
