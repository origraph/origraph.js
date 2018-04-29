import jsonPath from 'jsonpath';
import hash from 'object-hash';
import mime from 'mime-types';
import datalib from 'datalib';
import { Model } from 'uki';
import * as d3 from 'd3';
import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';
import PouchAuthentication from 'pouchdb-authentication';

var createEnum = (values => {
  let result = {};
  values.forEach(value => {
    result[value] = Symbol(value);
  });
  return Object.freeze(result);
});

const TYPES = createEnum(['boolean', 'number', 'string', 'date', 'undefined', 'null', 'reference', 'container', 'document', 'root']);

const INTERPRETATIONS = createEnum(['ignore', 'node', 'edge']);

const RESERVED_OBJ_KEYS = {
  '_id': true,
  '$wasArray': true,
  '$tags': true,
  '$members': true,
  '$edges': true,
  '$nodes': true,
  '$nextLabel': true
};

var queueAsync = (func => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(func());
    });
  });
});

class Handler {
  idToUniqueSelector(selectorString, docId) {
    const chunks = /@[^$]*(\$.*)/.exec(selectorString);
    return `@{"_id":"${docId}"}${chunks[1]}`;
  }
  extractDocQuery(selectorString) {
    const result = /@\s*({.*})/.exec(selectorString);
    if (result && result[1]) {
      return JSON.parse(result[1]);
    } else {
      return null;
    }
  }
  extractClassInfoFromId(id) {
    const temp = /@[^$]*\$\.classes(\.[^\s↑→.]+)?(\["[^"]+"])?/.exec(id);
    if (temp && (temp[1] || temp[2])) {
      return {
        classPathChunk: temp[1] || temp[2],
        className: temp[1] ? temp[1].slice(1) : temp[2].slice(2, temp[2].length - 2)
      };
    } else {
      return null;
    }
  }
  getItemClasses(item) {
    if (!item.value || !item.value.$tags) {
      return [];
    }
    return Object.keys(item.value.$tags).reduce((agg, setId) => {
      const temp = this.extractClassInfoFromId(setId);
      if (temp) {
        agg.push(temp.className);
      }
      return agg;
    }, []).sort();
  }
  inferType(value) {
    const jsType = typeof value;
    if (TYPES[jsType]) {
      if (jsType === 'string' && value[0] === '@') {
        try {
          new Selection(null, value); // eslint-disable-line no-new
        } catch (err) {
          if (err.INVALID_SELECTOR) {
            return TYPES.string;
          } else {
            throw err;
          }
        }
        return TYPES.reference;
      } else {
        return TYPES[jsType];
      }
    } else if (value === null) {
      return TYPES.null;
    } else if (value instanceof Date) {
      return TYPES.date;
    } else if (jsType === 'function' || jsType === 'symbol' || value instanceof Array) {
      throw new Error('invalid value: ' + value);
    } else {
      return TYPES.container;
    }
  }
  standardize(obj, path, classes) {
    if (typeof obj !== 'object') {
      return obj;
    }

    // Convert arrays to objects
    if (obj instanceof Array) {
      let temp = {};
      obj.forEach((element, index) => {
        temp[index] = element;
      });
      obj = temp;
      obj.$wasArray = true;
    }

    // Assign the object's id
    obj._id = '@' + jsonPath.stringify(path);

    // Move any class definitions to this document
    obj.$tags = obj.$tags || {};
    Object.keys(obj.$tags).forEach(setId => {
      const temp = this.extractClassInfoFromId(setId);
      if (temp) {
        delete obj.$tags[setId];

        setId = classes._id + temp.classPathChunk;
        obj.$tags[setId] = true;

        classes[temp.className] = classes[temp.className] || { _id: setId, $members: {} };
        classes[temp.className].$members[obj._id] = true;
      }
    });

    // Recursively standardize the object's contents
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && !RESERVED_OBJ_KEYS[key]) {
        let temp = Array.from(path);
        temp.push(key);
        obj[key] = this.standardize(value, temp, classes);
      }
    });
    return obj;
  }
  format(obj) {
    // TODO: if $wasArray, attempt to restore array status,
    // remove _ids
    throw new Error('unimplemented');
  }
}
const ItemHandler = new Handler();

class BaseItem {
  constructor({ path, value, parent, doc, label, type, uniqueSelector, classes }) {
    this.path = path;
    this._value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.type = type;
    this.uniqueSelector = uniqueSelector;
    this.classes = classes;
  }
  get value() {
    return this._value;
  }
  set value(newValue) {
    if (this.parent) {
      // In the event that this is a primitive boolean, number, string, etc,
      // setting the value on the Item wrapper object *won't* naturally update
      // it in its containing document...
      this.parent[this.label] = newValue;
    }
    this._value = newValue;
  }
}
class RootItem extends BaseItem {
  constructor(docList, selectSingle) {
    super({
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      type: TYPES.root,
      uniqueSelector: '@',
      classes: []
    });
    docList.some(doc => {
      this.value[doc._id] = doc;
      return selectSingle;
    });
  }
}
class DocItem extends BaseItem {
  constructor(doc) {
    const docPathQuery = `{"_id":"${doc._id}"}`;
    super({
      path: [docPathQuery],
      value: doc,
      parent: null,
      doc: doc,
      label: doc['filename'],
      type: TYPES.document,
      uniqueSelector: docPathQuery,
      classes: []
    });
  }
}
class Item extends BaseItem {
  constructor(path, value, doc, type) {
    let parent;
    if (path.length < 2) {
      throw new Error(`Can't create a non-Root or non-Doc Item with a path length less than 2`);
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(0, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = `{"_id":"${doc._id}"}`;
    const uniqueJsonPath = jsonPath.stringify(path);
    path.unshift(docPathQuery);
    super({
      path,
      value,
      parent,
      doc,
      label: path[path.length - 1],
      type,
      classes: [],
      uniqueSelector: '@' + docPathQuery + uniqueJsonPath
    });
    this.classes = ItemHandler.getItemClasses(this);
  }
}
class ContainerItem extends Item {
  constructor(path, value, doc) {
    super(path, value, doc, TYPES.container);
    this.nextLabel = Object.keys(this.value).reduce((max, key) => {
      key = parseInt(key);
      if (!isNaN(key) && key > max) {
        return key;
      } else {
        return max;
      }
    }, 0) + 1;
  }
  createNewItem(value, label, type) {
    type = type || ItemHandler.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item;
    if (type === TYPES.container) {
      item = new ContainerItem(path, value, this.doc);
    } else {
      item = new Item(path, value, this.doc, type);
    }
    this.addItem(item, label);
    return item;
  }
  addItem(item, label) {
    if (item.type === TYPES.container) {
      if (item.value._id) {
        throw new Error('Item has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.slice(1).concat([label]))}`;
    }
    this.value[label] = item.value;
  }
  addToSet(setObj, setFileId) {
    const itemTag = this.doc._id === setFileId ? this.value._id : ItemHandler.idToUniqueSelector(this.value._id, this.doc._id);
    const setTag = this.doc._id === setFileId ? setObj._id : ItemHandler.idToUniqueSelector(setObj._id, setFileId);
    setObj.$members[itemTag] = true;
    this.value.$tags[setTag] = true;
  }
  addClass(className) {
    this.doc.classes[className] = this.doc.classes[className] || {
      _id: '@' + jsonPath.stringify(['$', 'classes', className]),
      $members: {}
    };
    this.addToSet(this.doc.classes[className], this.doc._id);
  }
  createEdge(otherItem, container, directed) {
    let newEdge = container.createNewItem({ $nodes: {}, $tags: {} }, undefined, TYPES.container);

    if (this.doc === container.doc) {
      newEdge.value.$nodes[this.value._id] = directed ? 'source' : true;
      this.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[this.uniqueSelector] = directed ? 'source' : true;
      this.value.$edges[ItemHandler.idToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }

    if (otherItem.doc === container.doc) {
      newEdge.value.$nodes[otherItem.value._id] = directed ? 'target' : true;
      otherItem.value.$edges[newEdge.value._id] = true;
    } else {
      newEdge.value.$nodes[otherItem.uniqueSelector] = directed ? 'target' : true;
      otherItem.value.$edges[ItemHandler.idToUniqueSelector(newEdge.value._id, container.doc._id)] = true;
    }
    return newEdge;
  }
}

let DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection {
  constructor(mure, selectorList = ['@' + DEFAULT_DOC_QUERY], { selectSingle = false, parentSelection = null } = {}) {
    if (!(selectorList instanceof Array)) {
      selectorList = [selectorList];
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
  invalidateCache() {
    delete this._cachedDocLists;
    delete this._cachedItems;
  }
  async docLists() {
    if (this._cachedDocLists) {
      return this._cachedDocLists;
    }
    this._cachedDocLists = await Promise.all(this.selectors.map(d => this.mure.queryDocs({ selector: d.parsedDocQuery })));
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
  async followRelativeLink(selector, doc, selectSingle = this.selectSingle) {
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
      tempSelection = new Selection(this.mure, selector, { selectSingle: selectSingle });
    } catch (err) {
      if (err.INVALID_SELECTOR) {
        return [];
      } else {
        throw err;
      }
    }
    let docLists = crossDoc ? await tempSelection.docLists() : [[doc]];
    return tempSelection.items(docLists);
  }
  async items(docLists) {
    // Note: we should only pass in docLists in rare situations (such as the
    // one-off case in followRelativeLink() where we already have the document
    // available, and creating the new selection will result in an unnnecessary
    // query of the database). Usually, we should rely on the cache.
    docLists = docLists || (await this.docLists());
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
                  Object.values((await this.followRelativeLink(value, doc))).forEach(addItem);
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
              if (this.selectSingle && addedItem) {
                break;
              }
            }
            if (this.selectSingle && addedItem) {
              break;
            }
          }
        }

        if (this.selectSingle && addedItem) {
          break;
        }
      }
      return this._cachedItems;
    });
  }
  async save() {
    // Evaluate all the pending operations that we've accrued; as each function
    // manipulates Items' .value property, those changes will automatically be
    // reflected in the document (as every .value is a pointer, or BaseItem's
    // .value setter ensures that primitives are propagated)
    const items = await this.items();
    let itemList = Object.values((await this.items()));
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
  each(func) {
    this.pendingOperations.push(func);
    return this;
  }
  attr(key, value) {
    let isFunction = typeof value === 'function';
    return this.each(item => {
      if (item.type === TYPES.root) {
        throw new Error(`Renaming files with .attr() is not yet supported`);
      } else if (item.type === TYPES.container || item.type === TYPES.document) {
        let temp = isFunction ? value.apply(this, item) : value;
        // item.value is just a pointer to the object in the document, so
        // we can just change it directly and it will still be saved
        item.value[key] = ItemHandler.standardize(temp, item.path.slice(1), item.doc.classes);
      } else {
        throw new Error(`Can't set .attr(${key}) on value of type ${item.type}`);
      }
    });
  }
  connect(otherSelection, connectWhen, {
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
          container = Object.values((await this.followRelativeLink('@$.orphanEdges', item.doc, true)))[0];
        }
        const otherItems = await otherSelection.items();
        Object.values(otherItems).forEach(otherItem => {
          if (otherItem.type === TYPES.container && connectWhen.apply(this, [item, otherItem])) {
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
  remove() {
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
  group() {
    throw new Error('unimplemented');
  }
  addClass(className) {
    return this.each(item => {
      if (item.type !== TYPES.container) {
        throw new Error(`Can't add a class to element of type ${item.type.toString()}`);
      } else {
        item.addClass(className);
      }
    });
  }
  removeClass(className) {
    throw new Error('unimplemented');
  }
  setInterpretation(interpretation, saveInSelection = null) {
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
            container = Object.values((await this.followRelativeLink('@$.orphanNodes', item.doc, true)))[0];
          }
          const nodes = Object.entries(item.value.$nodes);
          delete item.value.$nodes;
          for (let n = 0; n < nodes.length; n++) {
            const link = nodes[n][0];
            const linkDirection = nodes[n][1];
            const otherItem = Object.values((await this.followRelativeLink(link, item.doc)))[0];
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
  toggleDirection() {
    throw new Error('unimplemented');
  }
  copy(newParentId) {
    throw new Error('unimplemented');
  }
  move(newParentId) {
    throw new Error('unimplemented');
  }
  dissolve() {
    throw new Error('unimplemented');
  }

  /*
   These functions provide statistics / summaries of the selection:
   */
  async getFlatGraphSchema() {
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
        let nodeItem = items[nodeId] || items[ItemHandler.idToUniqueSelector(nodeId, edgeItem.doc._id)];
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
  async getIntersectedGraphSchema() {
    // const items = await this.items();
    throw new Error('unimplemented');
  }
  async getContainerSchema() {
    // const items = await this.items();
    throw new Error('unimplemented');
  }
  async allMetaObjIntersections(metaObjs) {
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
  async metaObjUnion(metaObjs) {
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
  get selectorList() {
    return this.selectors.map(selector => {
      return '@' + selector.docQuery + selector.objQuery + Array.from(Array(selector.parentShift)).map(d => '↑').join('') + (selector.followLinks ? '→' : '');
    });
  }
  deriveSelection(selectorList, options = { merge: false }) {
    if (options.merge) {
      selectorList = selectorList.concat(this.selectorList);
    }
    return new Selection(this.mure, selectorList, options);
  }
  merge(otherSelection, options = {}) {
    Object.assign(options, { merge: true });
    return this.deriveSelection(otherSelection.selectorList, options);
  }
  select(selectorList, options = {}) {
    Object.assign(options, { selectSingle: true, parentSelection: this });
    return this.deriveSelection(selectorList, options);
  }
  selectAll(selectorList, options = {}) {
    Object.assign(options, { parentSelection: this });
    return this.deriveSelection(selectorList, options);
  }
  async selectAllSetMembers(options) {
    return this.deriveSelection((await this.metaObjUnion(['$members'])), options);
  }
  async selectAllContainingSets(options) {
    return this.deriveSelection((await this.metaObjUnion(['$tags'])), options);
  }
  async selectAllEdges(options) {
    return this.deriveSelection((await this.metaObjUnion(['$edges'])), options);
  }
  async selectAllNodes(options = false) {
    return this.deriveSelection((await this.metaObjUnion(['$nodes'])), options);
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

class DocHandler {
  constructor(mure) {
    this.keyNames = {};
    this.datalibFormats = ['json', 'csv', 'tsv', 'dsv', 'topojson', 'treejson'];
  }
  async parse(text, { format = {}, mimeType } = {}) {
    if (mimeType && (!format || !format.type)) {
      format.type = mime.extension(mimeType);
    }
    let contents;
    format.type = format.type ? format.type.toLowerCase() : 'json';
    if (this.datalibFormats.indexOf(format.type) !== -1) {
      contents = datalib.read(text, format);
    } else if (format.type === 'xml') {
      contents = this.parseXml(text, format);
    }
    if (!contents.contents) {
      contents = { contents: contents };
    }
    return contents;
  }
  parseXml(text, { format = {} } = {}) {
    throw new Error('unimplemented');
  }
  formatDoc(doc, { mimeType = doc.mimeType } = {}) {
    ItemHandler.format(doc.contents);
    throw new Error('unimplemented');
  }
  isValidId(docId) {
    if (docId[0].toLowerCase() !== docId[0]) {
      return false;
    }
    let parts = docId.split(';');
    if (parts.length !== 2) {
      return false;
    }
    return !!mime.extension(parts[0]);
  }
  async standardize(doc, mure) {
    if (!doc._id || !this.isValidId(doc._id)) {
      if (!doc.mimeType && !doc.filename) {
        // Without an id, filename, or mimeType, just assume it's application/json
        doc.mimeType = 'application/json';
      }
      doc.mimeType = doc.mimeType.toLowerCase();
      if (!doc.filename) {
        if (doc._id) {
          // We were given an invalid id; use it as the filename instead
          doc.filename = doc._id;
        } else {
          // Without anything to go on, use "Untitled 1", etc
          let existingUntitleds = await mure.db.allDocs({
            startkey: doc.mimeType + ';Untitled ',
            endkey: doc.mimeType + ';Untitled \uffff'
          });
          let minIndex = existingUntitleds.rows.reduce((minIndex, uDoc) => {
            let index = /Untitled (\d+)/g.exec(uDoc._id);
            index = index ? index[1] || Infinity : Infinity;
            return index < minIndex ? index : minIndex;
          }, Infinity);
          minIndex = isFinite(minIndex) ? minIndex + 1 : 1;
          doc.filename = 'Untitled ' + minIndex;
        }
      }
      if (!doc.mimeType) {
        // We were given a bit of info with the filename / bad _id;
        // try to infer the mimeType from that (again use application/json
        // if that fails)
        doc.mimeType = mime.lookup(doc.filename) || 'application/json';
      }
      doc._id = doc.mimeType + ';' + doc.filename;
    }
    if (doc._id[0] === '_' || doc._id[0] === '$') {
      throw new Error('Document _ids may not start with ' + doc._id[0] + ': ' + doc._id);
    }
    doc.mimeType = doc.mimeType || doc._id.split(';')[0];
    if (!mime.extension(doc.mimeType)) {
      mure.warn('Unknown mimeType: ' + doc.mimeType);
    }
    doc.filename = doc.filename || doc._id.split(';')[1];
    doc.charset = (doc.charset || 'UTF-8').toUpperCase();

    doc.orphanEdges = doc.orphanEdges || {};
    doc.orphanEdges._id = '@$.orphanEdges';

    doc.orphanNodes = doc.orphanNodes || {};
    doc.orphanNodes._id = '@$.orphanNodes';

    doc.classes = doc.classes || {};
    doc.classes._id = '@$.classes';

    let noneId = '@$.classes.none';
    doc.classes.none = doc.classes.none || { _id: noneId, $members: {} };

    doc.contents = doc.contents || {};
    ItemHandler.standardize(doc.contents, ['$', 'contents'], doc.classes);

    return doc;
  }
}

var DocHandler$1 = new DocHandler();

class Mure extends Model {
  constructor(PouchDB$$1, d3$$1, d3n) {
    super();
    this.PouchDB = PouchDB$$1; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3$$1; // for Node.js, this will be from d3-node, not the regular one

    if (d3n) {
      // to run tests, we also need access to the d3-node wrapper (we don't
      // import it directly into the tests to make sure that the namespace
      // addition below works)
      this.d3n = d3n;
      this.window = this.d3n.window;
    } else {
      this.window = window;
    }

    // The namespace string for our custom XML
    this.NSString = 'http://mure-apps.github.io';
    this.d3.namespaces.mure = this.NSString;

    // Our custom type definitions
    this.TYPES = TYPES;

    // Interpretations
    this.INTERPRETATIONS = INTERPRETATIONS;

    // Special keys that should be skipped in various operations
    this.RESERVED_OBJ_KEYS = RESERVED_OBJ_KEYS;

    // Create / load the local database of files
    this.getOrInitDb();

    // in the absence of a custom dialogs, just use window.alert,
    // window.confirm, window.prompt, console.warn, and console.log:
    this.alert = message => {
      return new Promise((resolve, reject) => {
        this.window.alert(message);
        resolve(true);
      });
    };
    this.confirm = message => {
      return new Promise((resolve, reject) => {
        resolve(this.window.confirm(message));
      });
    };
    this.prompt = (message, defaultValue) => {
      return new Promise((resolve, reject) => {
        resolve(this.window.prompt(message, defaultValue));
      });
    };
    this.warn = function () {
      console.warn(...arguments);
    };
    this.log = function () {
      console.log(...arguments);
    };
  }
  customizeAlertDialog(showDialogFunction) {
    this.alert = showDialogFunction;
  }
  customizeConfirmDialog(showDialogFunction) {
    this.confirm = showDialogFunction;
  }
  customizePromptDialog(showDialogFunction) {
    this.prompt = showDialogFunction;
  }
  getOrInitDb() {
    this.db = new this.PouchDB('mure');
    this.dbStatus = new Promise((resolve, reject) => {
      (async () => {
        let status = { synced: false };
        let couchDbUrl = this.window.localStorage.getItem('couchDbUrl');
        if (couchDbUrl) {
          let couchDb = new this.PouchDB(couchDbUrl, { skip_setup: true });
          status.synced = !!(await this.db.sync(couchDb, { live: true, retry: true }).catch(err => {
            this.alert('Error syncing with ' + couchDbUrl + ': ' + err.message);
            return false;
          }));
        }
        status.indexed = !!(await this.db.createIndex({
          index: {
            fields: ['filename']
          }
        }).catch(() => false));
        status.linkedView = !!(await this.db.put({
          _id: '$linkedView',
          selectorList: ['@$.classes[*]']
        }).catch(() => false));
        status.linkedUserSelection = !!(await this.db.put({
          _id: '$linkedUserSelection',
          selectorList: []
        }).catch(() => false));
        status.linkedViewSettings = !!(await this.db.put({
          _id: '$linkedViewSettings',
          settings: {}
        }).catch(() => false));
        this.db.changes({
          since: 'now',
          live: true
        }).on('change', change => {
          if (change.id > '_\uffff') {
            // A regular document changed; invalidate all selection caches
            // corresponding to this document
            Selection.INVALIDATE_DOC_CACHE(change.id);
            this.trigger('docChange', change);
          } else if (change.id === '$linkedView') {
            // The linked views changed
            this.stickyTrigger('linkedViewChange', {
              view: this.selectAll(change.selectorList)
            });
          } else if (change.id === '$linkedUserSelection') {
            // The linked user selection changed
            this.stickyTrigger('linkedViewChange', {
              userSelection: this.selectAll(change.selectorList)
            });
          } else if (change.id === '$linkedViewSettings') {
            // The linked view settings changed
            this.stickyTrigger('linkedViewChange', {
              settings: change.settings
            });
          }
        }).on('error', err => {
          this.warn(err);
        });
        resolve(status);
      })();
    });
  }
  async queryDocs(queryObj) {
    let queryResult = await this.db.find(queryObj);
    if (queryResult.warning) {
      this.warn(queryResult.warning);
    }
    return queryResult.docs;
  }
  /**
   * A wrapper around PouchDB.get() that ensures that the first matched
   * document exists (optionally creates an empty document when it doesn't), and
   * that it conforms to the specifications outlined in documentation/schema.md
   * @param  {Object|string}  [docQuery]
   * The `selector` component of a Mango query, or, if a string, the precise
   * document _id
   * @param  {{boolean}}  [init=true]
   * If true (default), the document will be created (but not saved) if it does
   * not exist. If false, the returned Promise will resolve to null
   * @return {Promise}
   * Resolves the document
   */
  async getDoc(docQuery, { init = true } = {}) {
    let doc;
    if (!docQuery) {
      return DocHandler$1.standardize({}, this);
    } else {
      if (typeof docQuery === 'string') {
        if (docQuery[0] === '@') {
          docQuery = JSON.parse(docQuery.slice(1));
        } else {
          docQuery = { '_id': docQuery };
        }
      }
      let matchingDocs = await this.queryDocs({ selector: docQuery, limit: 1 });
      if (matchingDocs.length === 0) {
        if (init) {
          // If missing, use the docQuery itself as the template for a new doc
          doc = await DocHandler$1.standardize(docQuery, this);
        } else {
          return null;
        }
      } else {
        doc = matchingDocs[0];
      }
      return doc;
    }
  }
  async putDoc(doc) {
    try {
      return this.db.put(doc);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  async putDocs(docList) {
    try {
      return this.db.bulkDocs(docList);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  /**
   * Downloads a given file, optionally specifying a particular format
   * @param  {Object|string}  docQuery
   * The `selector` component of a Mango query, or, if a string, the precise
   * document _id
   * @param  {{string|null}}  [mimeType=null]
   * Overrides the document's mimeType in formatting the download
   * @return {Promise}
   * Resolves as `true` once the download is initiated
   */
  async downloadDoc(docQuery, { mimeType = null } = {}) {
    return this.getDoc(docQuery).then(doc => {
      mimeType = mimeType || doc.mimeType;
      let contents = DocHandler$1.formatDoc(doc, { mimeType });

      // create a fake link to initiate the download
      let a = document.createElement('a');
      a.style = 'display:none';
      let url = this.window.URL.createObjectURL(new window.Blob([contents], { type: mimeType }));
      a.href = url;
      a.download = doc._id;
      document.body.appendChild(a);
      a.click();
      this.window.URL.revokeObjectURL(url);
      a.parentNode.removeChild(a);

      return true;
    });
  }
  async uploadFileObj(fileObj, { encoding = mime.charset(fileObj.type) } = {}) {
    let string = await new Promise((resolve, reject) => {
      let reader = new window.FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsText(fileObj, encoding);
    });
    return this.uploadString(fileObj.name, fileObj.type, encoding, string);
  }
  async uploadString(filename, mimeType, encoding, string) {
    let doc = await DocHandler$1.parse(string, { mimeType });
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc(filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await DocHandler$1.standardize(doc, this);
    return this.putDoc(doc);
  }
  async deleteDoc(docQuery) {
    let doc = await this.getDoc(docQuery);
    return this.putDoc({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true
    });
  }
  pathToSelector(path = [Selection.DEFAULT_DOC_QUERY]) {
    let docQuery = path[0];
    let objQuery = path.slice(1);
    objQuery = objQuery.length > 0 ? jsonPath.stringify(objQuery) : '';
    return '@' + docQuery + objQuery;
  }
  selectDoc(docId) {
    return this.select('@{"_id":"' + docId + '"}');
  }
  select(selectorList) {
    return new Selection(this, selectorList, { selectSingle: true });
  }
  selectAll(selectorList) {
    return new Selection(this, selectorList);
  }
  async setLinkedViews({ viewSelection, userSelection, settings } = {}) {
    let docs = [];
    if (viewSelection) {
      const linkedView = await this.db.get('$linkedView');
      linkedView.selectorList = viewSelection.selectorList;
      docs.push(linkedView);
    }
    if (userSelection) {
      const linkedUserSelection = await this.db.get('$linkedUserSelection');
      linkedUserSelection.selectorList = userSelection.selectorList;
      docs.push(linkedUserSelection);
    }
    if (settings) {
      const linkedViewSettings = await this.db.get('$linkedViewSettings');
      linkedViewSettings.settings = settings;
      docs.push(linkedViewSettings);
    }
    return this.putDocs(docs);
  }
  async getLinkedViews() {
    const temp = await Promise.all([this.db.get('$linkedView'), this.db.get('$linkedUserSelection'), this.db.get('$linkedViewSettings')]);
    return {
      view: this.selectAll(temp[0].selectorList),
      userSelection: this.selectAll(temp[1].selectorList),
      settings: temp[2].settings
    };
  }
}

var name = "mure";
var version = "0.3.0";
var description = "An integration library for the mure ecosystem of apps";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.min.js";
var scripts = { "build": "rollup -c --environment TARGET:all", "watch": "rollup -c -w", "watchcjs": "rollup -c -w --environment TARGET:cjs", "watchumd": "rollup -c -w --environment TARGET:umd", "watchesm": "rollup -c -w --environment TARGET:esm", "test": "node test/test.js", "pretest": "rollup -c --environment TARGET:cjs && rm -rf mure mure-mrview*", "posttest": "rm -rf mure mure-mrview*", "debug": "rm -rf mure mure-mrview* && node --inspect-brk test/test.js" };
var files = ["dist"];
var repository = { "type": "git", "url": "git+https://github.com/mure-apps/mure-library.git" };
var author = "Alex Bigelow";
var license = "MIT";
var bugs = { "url": "https://github.com/mure-apps/mure-library/issues" };
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = { "babel-core": "^6.26.0", "babel-plugin-external-helpers": "^6.22.0", "babel-preset-env": "^1.6.1", "chalk": "^2.4.0", "d3-node": "^1.1.3", "diff": "^3.4.0", "pouchdb-node": "^6.4.3", "randombytes": "^2.0.6", "rollup": "^0.58.0", "rollup-plugin-babel": "^3.0.3", "rollup-plugin-commonjs": "^9.1.0", "rollup-plugin-json": "^2.3.0", "rollup-plugin-node-builtins": "^2.1.2", "rollup-plugin-node-globals": "^1.1.0", "rollup-plugin-node-resolve": "^3.0.2", "rollup-plugin-replace": "^2.0.0", "rollup-plugin-string": "^2.0.2", "rollup-plugin-uglify": "^3.0.0", "uglify-es": "^3.3.10" };
var dependencies = { "datalib": "^1.8.0", "jsonpath": "^1.0.0", "mime-types": "^2.1.18", "object-hash": "^1.3.0", "pouchdb-authentication": "^1.1.1", "pouchdb-browser": "^6.4.3", "pouchdb-find": "^6.4.3", "uki": "^0.2.2" };
var peerDependencies = { "d3": "^5.0.0" };
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	browser: browser,
	scripts: scripts,
	files: files,
	repository: repository,
	author: author,
	license: license,
	bugs: bugs,
	homepage: homepage,
	devDependencies: devDependencies,
	dependencies: dependencies,
	peerDependencies: peerDependencies,
	"jsnext:main": "dist/mure.esm.js"
};

PouchDB.plugin(PouchAuthentication);
PouchDB.plugin(PouchFind);

let mure = new Mure(PouchDB, d3);
mure.version = pkg.version;

export default mure;
