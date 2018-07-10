'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var jsonPath = _interopDefault(require('jsonpath'));
var uki = require('uki');
var md5 = _interopDefault(require('blueimp-md5'));
var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var D3Node = _interopDefault(require('d3-node'));

const glompLists = listList => {
  return listList.reduce((agg, list) => {
    list.forEach(value => {
      if (agg.indexOf(value) === -1) {
        agg.push(value);
      }
    });
    return agg;
  }, []);
};

class OutputSpec {
  constructor({ newSelectors = null, pollutedDocs = [] } = {}) {
    this.newSelectors = newSelectors;
    this.pollutedDocs = pollutedDocs;
  }
}
OutputSpec.glomp = specList => {
  const newSelectors = specList.reduce((agg, spec) => {
    if (agg === null) {
      return spec.newSelectors;
    } else if (spec.newSelectors === null) {
      return agg;
    } else {
      return glompLists([agg, spec.newSelectors]);
    }
  }, null);
  const pollutedDocs = specList.reduce((agg, spec) => {
    return glompLists([agg, spec.pollutedDocs]);
  }, []);
  return new OutputSpec({
    newSelectors,
    pollutedDocs
  });
};

const DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

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

    // TODO: optimize and sort this.selectors for better hash equivalence

    this.mure = mure;
    this.selectSingle = selectSingle;

    this.pendingOperations = [];

    Selection.ALL.push(this);
  }
  get hash() {
    if (!this._hash) {
      this._hash = md5(JSON.stringify(this.selectorList));
    }
    return this._hash;
  }
  get selectorList() {
    return this.selectors.map(selector => {
      return '@' + selector.docQuery + selector.objQuery + Array.from(Array(selector.parentShift)).map(d => '↑').join('') + (selector.followLinks ? '→' : '');
    });
  }
  get isCached() {
    return !!this._cachedConstructs;
  }
  invalidateCache() {
    delete this._cachedDocLists;
    delete this._cachedConstructs;
    delete this._summaryCaches;
  }
  async docLists() {
    if (this._cachedDocLists) {
      return this._cachedDocLists;
    }
    this._cachedDocLists = await Promise.all(this.selectors.map(d => this.mure.queryDocs({ selector: d.parsedDocQuery })));
    // We want all selections to operate from exactly the same document object,
    // so it's easy / straightforward for Constructs to just mutate their own value
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
  async items(docLists) {
    if (this._cachedConstructs) {
      return this._cachedConstructs;
    }

    // Note: we should only pass in docLists in rare situations (such as the
    // one-off case in followRelativeLink() where we already have the document
    // available, and creating the new selection will result in an unnnecessary
    // query of the database). Usually, we should rely on the cache.
    docLists = docLists || (await this.docLists());

    return uki.queueAsync(async () => {
      // Collect the results of objQuery
      this._cachedConstructs = {};
      let addedConstruct = false;

      const addConstruct = item => {
        addedConstruct = true;
        if (!this._cachedConstructs[item.uniqueSelector]) {
          this._cachedConstructs[item.uniqueSelector] = item;
        }
      };

      for (let index = 0; index < this.selectors.length; index++) {
        const selector = this.selectors[index];
        const docList = docLists[index];

        if (selector.objQuery === '') {
          // No objQuery means that we want a view of multiple documents (other
          // shenanigans mean we shouldn't select anything)
          if (selector.parentShift === 0 && !selector.followLinks) {
            addConstruct(new this.mure.CONSTRUCTS.RootConstruct({
              mure: this.mure,
              docList,
              selectSingle: this.selectSingle
            }));
          }
        } else if (selector.objQuery === '$') {
          // Selecting the documents themselves
          if (selector.parentShift === 0 && !selector.followLinks) {
            docList.some(doc => {
              addConstruct(new this.mure.CONSTRUCTS.DocumentConstruct({
                mure: this.mure,
                doc
              }));
              return this.selectSingle;
            });
          } else if (selector.parentShift === 1) {
            addConstruct(new this.mure.CONSTRUCTS.RootConstruct({
              mure: this.mure,
              docList,
              selectSingle: this.selectSingle
            }));
          }
        } else {
          // Okay, we need to evaluate the jsonPath
          for (let docIndex = 0; docIndex < docList.length; docIndex++) {
            let doc = docList[docIndex];
            let matchingConstructs = jsonPath.nodes(doc, selector.objQuery);
            for (let itemIndex = 0; itemIndex < matchingConstructs.length; itemIndex++) {
              let { path, value } = matchingConstructs[itemIndex];
              let localPath = path;
              if (this.mure.RESERVED_OBJ_KEYS[localPath.slice(-1)[0]]) {
                // Don't create items under reserved keys
                continue;
              } else if (selector.parentShift === localPath.length) {
                // we parent shifted up to the root level
                if (!selector.followLinks) {
                  addConstruct(new this.mure.CONSTRUCTS.RootConstruct({
                    mure: this.mure,
                    docList,
                    selectSingle: this.selectSingle
                  }));
                }
              } else if (selector.parentShift === localPath.length - 1) {
                // we parent shifted to the document level
                if (!selector.followLinks) {
                  addConstruct(new this.mure.CONSTRUCTS.DocumentConstruct({
                    mure: this.mure,
                    doc
                  }));
                }
              } else {
                if (selector.parentShift > 0 && selector.parentShift < localPath.length - 1) {
                  // normal parentShift
                  localPath.splice(localPath.length - selector.parentShift);
                  value = jsonPath.query(doc, jsonPath.stringify(localPath))[0];
                }
                if (selector.followLinks) {
                  // We (potentially) selected a link that we need to follow
                  Object.values((await this.mure.followRelativeLink(value, doc, this.selectSingle))).forEach(addConstruct);
                } else {
                  const ConstructType = this.mure.inferType(value);
                  addConstruct(new ConstructType({
                    mure: this.mure,
                    value,
                    path: [`{"_id":"${doc._id}"}`].concat(localPath),
                    doc
                  }));
                }
              }
              if (this.selectSingle && addedConstruct) {
                break;
              }
            }
            if (this.selectSingle && addedConstruct) {
              break;
            }
          }
        }

        if (this.selectSingle && addedConstruct) {
          break;
        }
      }
      return this._cachedConstructs;
    });
  }
  get chainable() {
    if (this.pendingOperations.length === 0) {
      return true;
    } else {
      const lastOp = this.pendingOperations[this.pendingOperations.length - 1].operation;
      return lastOp.terminatesChain === false;
    }
  }
  chain(operation, inputOptions) {
    if (!this.chainable) {
      throw new Error(`A terminating operation (\
${this.pendingOperations[this.pendingOperations.length].operation.humanReadableName}\
) has already been chained; please await executeChain() or cancelChain() before \
chaining additional operations.`);
    }
    this.pendingOperations.push({ operation, inputOptions });
    return this;
  }
  async executeChain() {
    // Evaluate all the pending operations that we've accrued; as each function
    // manipulates Constructs' .value property, those changes will automatically be
    // reflected in the document (as every .value is a pointer, or BaseConstruct's
    // .value setter ensures that primitives are propagated)
    let outputSpec = new OutputSpec();
    for (let f = 0; f < this.pendingOperations.length; f++) {
      let { operation, inputOptions } = this.pendingOperations[f];
      outputSpec = await operation.executeOnSelection(this, inputOptions);
    }
    this.pendingOperations = [];

    // Any selection that has cached any of the documents that we altered
    // needs to have its cache invalidated
    outputSpec.pollutedDocs.forEach(doc => {
      Selection.INVALIDATE_DOC_CACHE(doc._id);
    });
    // We need to save all the documents that the operations have altered
    await this.mure.putDocs(outputSpec.pollutedDocs);

    if (outputSpec.newSelectors !== null) {
      return new Selection(this.mure, outputSpec.newSelectors);
    } else {
      return this;
    }
  }
  get chainPending() {
    return this.pendingOperations.length > 0;
  }
  cancelChain() {
    this.pendingOperations = [];
    return this;
  }
  async execute(operation, inputOptions) {
    if (this.chainPending) {
      throw new Error(`The selection currently has a pending chain of \
operations; please await executeChain() or cancelChain() before executing \
one-off operations.`);
    }
    this.pendingOperations.push({ operation, inputOptions });
    return this.executeChain();
  }

  /*
   These functions provide statistics / summaries of the selection:
   */
  async inferInputs(operation) {
    if (this._summaryCaches && this._summaryCaches.opInputs && this._summaryCaches.opInputs[operation.name]) {
      return this._summaryCaches.opInputs[operation.name];
    }

    const inputSpec = await operation.inferSelectionInputs(this);

    this._summaryCaches = this._summaryCaches || {};
    this._summaryCaches.opInputs = this._summaryCaches.opInputs || {};
    this._summaryCaches.opInputs[operation.name] = inputSpec;
    return inputSpec;
  }
  async histograms(numBins = 20) {
    if (this._summaryCaches && this._summaryCaches.histograms) {
      return this._summaryCaches.histograms;
    }

    const items = await this.items();
    const itemList = Object.values(items);

    let result = {
      raw: {
        typeBins: {},
        categoricalBins: {},
        quantitativeBins: []
      },
      attributes: {}
    };

    const countPrimitive = (counters, item) => {
      // Attempt to count the value categorically
      if (counters.categoricalBins !== null) {
        counters.categoricalBins[item.value] = (counters.categoricalBins[item.value] || 0) + 1;
        if (Object.keys(counters.categoricalBins).length > numBins) {
          // We've encountered too many categorical bins; this likely isn't a categorical attribute
          counters.categoricalBins = null;
        }
      }
      // Attempt to bin the value quantitatively
      if (counters.quantitativeBins !== null) {
        if (counters.quantitativeBins.length === 0) {
          // Init the counters with some temporary placeholders
          counters.quantitativeConstructs = [];
          counters.quantitativeType = item.type;
          if (item instanceof this.mure.CONSTRUCTS.NumberConstruct) {
            counters.quantitativeScale = this.mure.d3.scaleLinear().domain([item.value, item.value]);
          } else if (item instanceof this.mure.CONSTRUCTS.DateConstruct) {
            counters.quantitativeScale = this.mure.d3.scaleTime().domain([item.value, item.value]);
          } else {
            // The first value is non-quantitative; this likely isn't a quantitative attribute
            counters.quantitativeBins = null;
            delete counters.quantitativeConstructs;
            delete counters.quantitativeType;
            delete counters.quantitativeScale;
          }
        } else if (counters.quantitativeType !== item.type) {
          // Encountered an item of a different type; this likely isn't a quantitative attribute
          counters.quantitativeBins = null;
          delete counters.quantitativeConstructs;
          delete counters.quantitativeType;
          delete counters.quantitativeScale;
        } else {
          // Update the scale's domain (we'll determine bins later)
          let domain = counters.quantitativeScale.domain();
          if (item.value < domain[0]) {
            domain[0] = item.value;
          }
          if (item.value > domain[1]) {
            domain[1] = item.value;
          }
          counters.quantitativeScale.domain(domain);
        }
      }
    };

    for (let i = 0; i < itemList.length; i++) {
      const item = itemList[i];
      result.raw.typeBins[item.type] = (result.raw.typeBins[item.type] || 0) + 1;
      if (item instanceof this.mure.CONSTRUCTS.PrimitiveConstruct) {
        countPrimitive(result.raw, item);
      } else {
        if (item.contentConstructs) {
          (await item.contentConstructs()).forEach(childConstruct => {
            const counters = result.attributes[childConstruct.label] = result.attributes[childConstruct.label] || {
              typeBins: {},
              categoricalBins: {},
              quantitativeBins: []
            };
            counters.typeBins[childConstruct.type] = (counters.typeBins[childConstruct.type] || 0) + 1;
            if (childConstruct instanceof this.mure.CONSTRUCTS.PrimitiveConstruct) {
              countPrimitive(counters, childConstruct);
            }
          });
        }
        // TODO: collect more statistics, such as node degree, set size
        // (and a set's members' attributes, similar to contentConstructs?)
      }
    }

    const finalizeBins = counters => {
      // Clear out anything that didn't see any values
      if (counters.typeBins && Object.keys(counters.typeBins).length === 0) {
        counters.typeBins = null;
      }
      if (counters.categoricalBins && Object.keys(counters.categoricalBins).length === 0) {
        counters.categoricalBins = null;
      }
      if (counters.quantitativeBins) {
        if (!counters.quantitativeConstructs || counters.quantitativeConstructs.length === 0) {
          counters.quantitativeBins = null;
          delete counters.quantitativeConstructs;
          delete counters.quantitativeType;
          delete counters.quantitativeScale;
        } else {
          // Calculate quantitative bin sizes and their counts
          // Clean up the scale a bit
          counters.quantitativeScale.nice();
          // Histogram generator
          const histogramGenerator = this.mure.d3.histogram().domain(counters.quantitativeScale.domain()).thresholds(counters.quantitativeScale.ticks(numBins)).value(d => d.value);
          counters.quantitativeBins = histogramGenerator(counters.quantitativeConstructs);
          // Clean up some of the temporary placeholders
          delete counters.quantitativeConstructs;
          delete counters.quantitativeType;
        }
      }
    };
    finalizeBins(result.raw);
    Object.values(result.attributes).forEach(finalizeBins);

    this._summaryCaches = this._summaryCaches || {};
    this._summaryCaches.histograms = result;
    return result;
  }
  async getFlatGraphSchema() {
    if (this._summaryCaches && this._summaryCaches.flatGraphSchema) {
      return this._summaryCaches.flatGraphSchema;
    }

    const items = await this.items();
    let result = {
      nodeClasses: {},
      edgeClasses: {},
      missingNodes: false,
      missingEdges: false
    };

    // First pass: identify items by class, and generate pseudo-items that
    // point to classes instead of selectors
    Object.entries(items).forEach(([uniqueSelector, item]) => {
      if (item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
        // This is an edge; create / add to a pseudo-item for each class
        let classList = item.getClasses();
        if (classList.length === 0) {
          classList.push('(no class)');
        }
        classList.forEach(edgeClassName => {
          let pseudoEdge = result.edgeClasses[edgeClassName] = result.edgeClasses[edgeClassName] || { $nodes: {} };
          // Add our direction counts for each of the node's classes to the pseudo-item
          Object.entries(item.value.$nodes).forEach(([nodeSelector, directions]) => {
            let nodeConstruct = items[nodeSelector];
            if (!nodeConstruct) {
              // This edge refers to a node outside the selection
              result.missingNodes = true;
            } else {
              nodeConstruct.getClasses().forEach(nodeClassName => {
                Object.entries(directions).forEach(([direction, count]) => {
                  pseudoEdge.$nodes[nodeClassName] = pseudoEdge.$nodes[nodeClassName] || {};
                  pseudoEdge.$nodes[nodeClassName][direction] = pseudoEdge.$nodes[nodeClassName][direction] || 0;
                  pseudoEdge.$nodes[nodeClassName][direction] += count;
                });
              });
            }
          });
        });
      } else if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
        // This is a node; create / add to a pseudo-item for each class
        let classList = item.getClasses();
        if (classList.length === 0) {
          classList.push('(no class)');
        }
        classList.forEach(nodeClassName => {
          let pseudoNode = result.nodeClasses[nodeClassName] = result.nodeClasses[nodeClassName] || { count: 0, $edges: {} };
          pseudoNode.count += 1;
          // Ensure that the edge class is referenced (directions' counts are kept on the edges)
          Object.keys(item.value.$edges).forEach(edgeSelector => {
            let edgeConstruct = items[edgeSelector];
            if (!edgeConstruct) {
              // This node refers to an edge outside the selection
              result.missingEdges = true;
            } else {
              edgeConstruct.getClasses().forEach(edgeClassName => {
                pseudoNode.$edges[edgeClassName] = true;
              });
            }
          });
        });
      }
    });

    this._summaryCaches = this._summaryCaches || {};
    this._summaryCaches.flatGraphSchema = result;
    return result;
  }
  async getIntersectedGraphSchema() {
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
            linkedId = this.mure.idToUniqueSelector(linkedId, item.doc._id);
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

  /*
   These functions are useful for deriving additional selections based
   on selectors (when there's no direct need to access items)
  */
  deriveSelection(selectorList, options = { mode: this.mure.DERIVE_MODES.REPLACE }) {
    if (options.mode === this.mure.DERIVE_MODES.UNION) {
      selectorList = selectorList.concat(this.selectorList);
    } else if (options.mode === this.mure.DERIVE_MODES.XOR) {
      selectorList = selectorList.filter(selector => this.selectorList.indexOf(selector) === -1).concat(this.selectorList.filter(selector => selectorList.indexOf(selector) === -1));
    } // else if (options.mode === DERIVE_MODES.REPLACE) { // do nothing }
    return new Selection(this.mure, selectorList, options);
  }
  merge(otherSelection, options = {}) {
    Object.assign(options, { mode: this.mure.DERIVE_MODES.UNION });
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
}
// TODO: this way of dealing with cache invalidation causes a memory leak, as
// old selections are going to pile up in CACHED_DOCS and ALL after they've lost
// all other references, preventing their garbage collection. Unfortunately
// things like WeakMap aren't enumerable...
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
Selection.ALL = [];
Selection.INVALIDATE_ALL_CACHES = () => {
  Selection.ALL.forEach(selection => {
    selection.invalidateCache();
  });
};

class BaseConstruct {
  constructor({ mure, path, value, parent, doc, label, uniqueSelector }) {
    this.mure = mure;
    this.path = path;
    this._value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.uniqueSelector = uniqueSelector;
  }
  get type() {
    return (/(.*)Construct/.exec(this.constructor.name)[1]
    );
  }
  get value() {
    return this._value;
  }
  set value(newValue) {
    if (this.parent) {
      // In the event that this is a primitive boolean, number, string, etc,
      // setting the value on the Construct wrapper object *won't* naturally update
      // it in its containing document...
      this.parent[this.label] = newValue;
    }
    this._value = newValue;
  }
  remove() {
    // this.parent is a pointer to the raw element, so we want to delete its
    // reference to this item
    delete this.parent[this.label];
  }
  equals(other) {
    return this.uniqueSelector === other.uniqueSelector;
  }
}
BaseConstruct.getHumanReadableType = function () {
  return (/(.*)Construct/.exec(this.name)[1]
  );
};
BaseConstruct.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};
BaseConstruct.standardize = ({ value }) => {
  // Default action: do nothing
  return value;
};

class RootConstruct extends BaseConstruct {
  constructor({ mure, docList, selectSingle }) {
    super({
      mure,
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      uniqueSelector: '@'
    });
    docList.some(doc => {
      this.value[doc._id] = doc;
      return selectSingle;
    });
  }
  remove() {
    throw new Error(`Can't remove the root item`);
  }
}

class TypedConstruct extends BaseConstruct {
  constructor({ mure, value, path, doc }) {
    let parent;
    if (path.length < 2) {
      throw new Error(`Can't create a non-Root or non-Doc Construct with a path length less than 2`);
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(1, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = path[0];
    const uniqueJsonPath = jsonPath.stringify(path.slice(1));
    super({
      mure,
      path,
      value,
      parent,
      doc,
      label: path[path.length - 1],
      uniqueSelector: '@' + docPathQuery + uniqueJsonPath
    });
    if (typeof value !== this.constructor.JSTYPE) {
      // eslint-disable-line valid-typeof
      throw new TypeError(`typeof ${value} is ${typeof value}, which does not match required ${this.constructor.JSTYPE}`);
    }
  }
}
TypedConstruct.JSTYPE = 'object';

var ItemConstructMixin = (superclass => class extends superclass {
  async getValueContents() {
    return Object.entries(this.value).reduce((agg, [label, value]) => {
      if (!this.mure.RESERVED_OBJ_KEYS[label]) {
        let ConstructType = this.mure.inferType(value);
        agg.push(new ConstructType({
          mure: this.mure,
          value,
          path: this.path.concat([label]),
          doc: this.doc
        }));
      }
      return agg;
    }, []);
  }
  async getValueContentCount() {
    return Object.keys(this.value).filter(label => !this.mure.RESERVED_OBJ_KEYS[label]).length;
  }
});

class ItemConstruct extends ItemConstructMixin(TypedConstruct) {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    this.nextLabel = Object.keys(this.value).reduce((max, key) => {
      key = parseInt(key);
      if (!isNaN(key) && key > max) {
        return key;
      } else {
        return max;
      }
    }, 0) + 1;
  }
  createNewConstruct(value, label, ConstructType) {
    ConstructType = ConstructType || this.mure.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item = new ConstructType({
      mure: this.mure,
      value: ConstructType.getBoilerplateValue(),
      path,
      doc: this.doc
    });
    this.addConstruct(item, label);
    return item;
  }
  addConstruct(item, label) {
    if (item instanceof ItemConstruct) {
      if (item.value._id) {
        throw new Error('Construct has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.slice(1).concat([label]))}`;
    }
    this.value[label] = item.value;
  }
  async contentSelectors() {
    return (await this.contentConstructs()).map(item => item.uniqueSelector);
  }
  async contentConstructs() {
    return this.getValueContents();
  }
  async contentConstructCount() {
    return this.getValueContentCount();
  }
}
ItemConstruct.getBoilerplateValue = () => {
  return {};
};
ItemConstruct.convertArray = value => {
  if (value instanceof Array) {
    let temp = {};
    value.forEach((element, index) => {
      temp[index] = element;
    });
    value = temp;
    value.$wasArray = true;
  }
  return value;
};
ItemConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Assign the object's id if a path is supplied
  if (path) {
    value._id = '@' + jsonPath.stringify(path.slice(1));
  }
  // Recursively standardize contents if a path and doc are supplied
  if (path && doc) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (!mure.RESERVED_OBJ_KEYS[key]) {
        let temp = Array.from(path);
        temp.push(key);
        // Alayws convert arrays to objects
        nestedValue = ItemConstruct.convertArray(nestedValue);
        // What kind of value are we dealing with?
        let ConstructType = mure.inferType(nestedValue, aggressive);
        // Apply that class's standardization function
        value[key] = ConstructType.standardize({
          mure,
          value: nestedValue,
          path: temp,
          doc,
          aggressive
        });
      }
    });
  }
  return value;
};

// extensions that we want datalib to handle
const DATALIB_FORMATS = ['json', 'csv', 'tsv', 'topojson', 'treejson'];

class DocumentConstruct extends ItemConstructMixin(BaseConstruct) {
  constructor({ mure, doc }) {
    const docPathQuery = `{"_id":"${doc._id}"}`;
    super({
      mure,
      path: [docPathQuery, '$'],
      value: doc,
      parent: null,
      doc: doc,
      label: doc['filename'],
      uniqueSelector: '@' + docPathQuery + '$'
    });
    this._contentConstruct = new ItemConstruct({
      mure: this.mure,
      value: this.value.contents,
      path: this.path.concat(['contents']),
      doc: this.doc
    });
  }
  remove() {
    // TODO: remove everything in this.value except _id, _rev, and add _deleted?
    // There's probably some funkiness in the timing of save() I still need to
    // think through...
    throw new Error(`Deleting files via Selections not yet implemented`);
  }
  async contentSelectors() {
    return this._contentConstruct.contentSelectors();
  }
  async contentConstructs() {
    return this._contentConstruct.contentConstructs();
  }
  async contentConstructCount() {
    return this._contentConstruct.contentConstructCount();
  }
  async metaConstructSelectors() {
    return (await this.metaConstructs()).map(item => item.uniqueSelector);
  }
  async metaConstructs() {
    return this.getValueContents();
  }
  async metaConstructCount() {
    return this.getValueContentCount();
  }
}
DocumentConstruct.isValidId = docId => {
  if (docId[0].toLowerCase() !== docId[0]) {
    return false;
  }
  let parts = docId.split(';');
  if (parts.length !== 2) {
    return false;
  }
  return !!mime.extension(parts[0]);
};
DocumentConstruct.parse = async (text, extension) => {
  let contents;
  if (DATALIB_FORMATS.indexOf(extension) !== -1) {
    contents = datalib.read(text, { type: extension });
  } else if (extension === 'xml') {
    throw new Error('unimplemented');
  } else if (extension === 'txt') {
    throw new Error('unimplemented');
  }
  if (!contents.contents) {
    contents = { contents: contents };
  }
  return contents;
};
DocumentConstruct.launchStandardization = async ({ mure, doc }) => {
  let existingUntitleds = await mure.db.allDocs({
    startkey: doc.mimeType + ';Untitled ',
    endkey: doc.mimeType + ';Untitled \uffff'
  });
  return DocumentConstruct.standardize({
    mure,
    doc,
    existingUntitleds,
    aggressive: true
  });
};
DocumentConstruct.standardize = ({
  mure,
  doc,
  existingUntitleds = { rows: [] },
  aggressive
}) => {
  if (!doc._id || !DocumentConstruct.isValidId(doc._id)) {
    if (!doc.mimeType && !doc.filename) {
      // Without an id, filename, or mimeType, just assume it's application/json
      doc.mimeType = 'application/json';
    }
    if (!doc.filename) {
      if (doc._id) {
        // We were given an invalid id; use it as the filename instead
        doc.filename = doc._id;
      } else {
        // Without anything to go on, use "Untitled 1", etc
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
    doc.mimeType = doc.mimeType.toLowerCase();
    doc._id = doc.mimeType + ';' + doc.filename;
  }
  if (doc._id[0] === '_' || doc._id[0] === '$') {
    throw new Error('Document _ids may not start with ' + doc._id[0] + ': ' + doc._id);
  }
  doc.mimeType = doc.mimeType || doc._id.split(';')[0];
  if (!mime.extension(doc.mimeType)) {
    throw new Error('Unknown mimeType: ' + doc.mimeType);
  }
  doc.filename = doc.filename || doc._id.split(';')[1];
  doc.charset = (doc.charset || 'UTF-8').toUpperCase();

  doc.orphans = doc.orphans || {};
  doc.orphans._id = '@$.orphans';

  doc.classes = doc.classes || {};
  doc.classes._id = '@$.classes';

  doc.contents = doc.contents || {};
  // In case doc.contents is an array, prep it for ItemConstruct.standardize
  doc.contents = ItemConstruct.convertArray(doc.contents);
  doc.contents = ItemConstruct.standardize({
    mure,
    value: doc.contents,
    path: [`{"_id":"${doc._id}"}`, '$', 'contents'],
    doc,
    aggressive
  });

  return doc;
};

class PrimitiveConstruct extends TypedConstruct {
  stringValue() {
    return String(this.value);
  }
}

class InvalidConstruct extends BaseConstruct {
  constructor({ mure, value, path, doc }) {
    let parent;
    if (path.length < 2) {
      parent = null;
    } else if (path.length === 2) {
      parent = doc;
    } else {
      let temp = jsonPath.stringify(path.slice(1, path.length - 1));
      parent = jsonPath.value(doc, temp);
    }
    const docPathQuery = path[0] || '';
    const uniqueJsonPath = jsonPath.stringify(path.slice(1));
    super({
      mure,
      path,
      value,
      parent,
      doc,
      label: path[path.length - 1],
      uniqueSelector: '@' + docPathQuery + uniqueJsonPath
    });
  }
  stringValue() {
    return 'Invalid: ' + String(this.value);
  }
}
InvalidConstruct.JSTYPE = 'object';

class NullConstruct extends PrimitiveConstruct {}
NullConstruct.JSTYPE = 'null';
NullConstruct.getBoilerplateValue = () => null;
NullConstruct.standardize = () => null;

class BooleanConstruct extends PrimitiveConstruct {}
BooleanConstruct.JSTYPE = 'boolean';
BooleanConstruct.getBoilerplateValue = () => false;
BooleanConstruct.standardize = ({ value }) => !!value;

class NumberConstruct extends PrimitiveConstruct {}
NumberConstruct.JSTYPE = 'number';
NumberConstruct.getBoilerplateValue = () => 0;
NumberConstruct.standardize = ({ value }) => Number(value);

class StringConstruct extends PrimitiveConstruct {}
StringConstruct.JSTYPE = 'string';
StringConstruct.getBoilerplateValue = () => '';
StringConstruct.standardize = ({ value }) => String(value);

class DateConstruct extends PrimitiveConstruct {
  constructor({ mure, value, path, doc }) {
    super({ mure, value: DateConstruct.standardize(value), path, doc });
  }
  get value() {
    return new Date(this._value.str);
  }
  set value(newValue) {
    super.value = DateConstruct.standardize(newValue);
  }
  stringValue() {
    return String(this.value);
  }
}
DateConstruct.getBoilerplateValue = () => new Date();
DateConstruct.standardize = ({ value }) => {
  if (typeof value === 'string') {
    value = new Date(value);
  }
  if (value instanceof Date) {
    value = {
      $isDate: true,
      str: value.toString()
    };
  }
  if (!value.$isDate) {
    throw new Error(`Failed to wrap Date object`);
  }
  return value;
};

class ReferenceConstruct extends StringConstruct {}
ReferenceConstruct.getBoilerplateValue = () => '@$';

class TaggableConstruct extends ItemConstruct {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$tags) {
      throw new TypeError(`TaggableConstruct requires a $tags object`);
    }
  }
  addToSetObj(setObj, setFileId) {
    // Convenience function for tagging an item without having to wrap the set
    // object as a SetConstruct
    const itemTag = this.doc._id === setFileId ? this.value._id : this.mure.idToUniqueSelector(this.value._id, this.doc._id);
    const setTag = this.doc._id === setFileId ? setObj._id : this.mure.idToUniqueSelector(setObj._id, setFileId);
    setObj.$members[itemTag] = true;
    this.value.$tags[setTag] = true;
  }
  addClass(className) {
    this.doc.classes[className] = this.doc.classes[className] || {
      _id: '@' + jsonPath.stringify(['$', 'classes', className]),
      $members: {}
    };
    this.addToSetObj(this.doc.classes[className], this.doc._id);
  }
  getClasses() {
    if (!this.value || !this.value.$tags) {
      return [];
    }
    return Object.keys(this.value.$tags).reduce((agg, setId) => {
      const temp = this.mure.extractClassInfoFromId(setId);
      if (temp) {
        agg.push(temp.className);
      }
      return agg;
    }, []).sort();
  }
}
TaggableConstruct.getBoilerplateValue = () => {
  return { $tags: {} };
};
TaggableConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular ItemConstruct standardization
  value = ItemConstruct.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $tags object
  value.$tags = value.$tags || {};
  // Move any existing class definitions to this document
  Object.keys(value.$tags).forEach(setId => {
    const temp = mure.extractClassInfoFromId(setId);
    if (temp) {
      delete value.$tags[setId];

      setId = doc.classes._id + temp.classPathChunk;
      value.$tags[setId] = true;

      doc.classes[temp.className] = doc.classes[temp.className] || { _id: setId, $members: {} };
      doc.classes[temp.className].$members[value._id] = true;
    }
  });
  return value;
};

var SetConstructMixin = (superclass => class extends superclass {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$members) {
      throw new TypeError(`SetConstruct requires a $members object`);
    }
  }
  addConstruct(item) {
    const itemTag = item.value._id;
    const setTag = this.value._id;
    this.value.$members[itemTag] = true;
    item.value.$tags[setTag] = true;
  }
});

class SetConstruct extends SetConstructMixin(TypedConstruct) {
  memberSelectors() {
    return Object.keys(this.value.$members);
  }
  async memberConstructs() {
    return this.mure.selectAll(this.memberSelectors()).items();
  }
}
SetConstruct.getBoilerplateValue = () => {
  return { $members: {} };
};
SetConstruct.standardize = ({ value }) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

class EdgeConstruct extends TaggableConstruct {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$nodes) {
      throw new TypeError(`EdgeConstruct requires a $nodes object`);
    }
  }
  async nodeSelectors(direction = null) {
    return Object.entries(this.value.$nodes).filter(([selector, directions]) => {
      // null indicates that we allow all movement
      return direction === null || directions[direction];
    }).map(([selector, directions]) => selector);
  }
  async nodeConstructs(forward = null) {
    return this.mure.selectAll((await this.nodeSelectors(forward))).items();
  }
  async nodeConstructCount(forward = null) {
    return (await this.nodeSelectors(forward)).length;
  }
}
EdgeConstruct.oppositeDirection = direction => {
  return direction === 'source' ? 'target' : direction === 'target' ? 'source' : 'undirected';
};
EdgeConstruct.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableConstruct standardization
  value = TaggableConstruct.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};
EdgeConstruct.glompValue = edgeList => {
  let temp = TaggableConstruct.glomp(edgeList);
  temp.value.$nodes = {};
  edgeList.forEach(edgeConstruct => {
    Object.entries(edgeConstruct.value.$nodes).forEach(([selector, directions]) => {
      temp.$nodes[selector] = temp.value.$nodes[selector] || {};
      Object.keys(directions).forEach(direction => {
        temp.value.$nodes[selector][direction] = temp.value.$nodes[selector][direction] || 0;
        temp.value.$nodes[selector][direction] += directions[direction];
      });
    });
  });
  return temp;
};

class NodeConstruct extends TaggableConstruct {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$edges) {
      throw new TypeError(`NodeConstruct requires an $edges object`);
    }
  }
  linkTo(otherNode, container, direction = 'undirected') {
    let newEdge = container.createNewConstruct({}, undefined, EdgeConstruct);

    const helper = (node, direction) => {
      node.value.$edges[newEdge.uniqueSelector] = true;
      let nodeId = node.uniqueSelector;
      newEdge.value.$nodes[nodeId] = newEdge.value.$nodes[nodeId] || {};
      newEdge.value.$nodes[nodeId][direction] = newEdge.value.$nodes[nodeId][direction] || 0;
      newEdge.value.$nodes[nodeId][direction] += 1;
    };

    helper(this, direction);
    helper(otherNode, EdgeConstruct.oppositeDirection(direction));
    return newEdge;
  }
  async edgeSelectors(direction = null) {
    if (direction === null) {
      return Object.keys(this.value.$edges);
    } else {
      return (await this.edgeConstructs(direction)).map(item => item.uniqueSelector);
    }
  }
  async edgeConstructs(direction = null) {
    return (await this.mure.selectAll(Object.keys(this.value.$egdes))).items().filter(item => {
      // null indicates that we allow all edges. If direction isn't null,
      // only include edges where we are the OPPOSITE direction (we are
      // at the beginning of the traversal)
      return direction === null || item.$nodes[this.uniqueSelector][EdgeConstruct.oppositeDirection(direction)];
    });
  }
  async edgeConstructCount(forward = null) {
    return (await this.edgeSelectors(forward)).length;
  }
}
NodeConstruct.getBoilerplateValue = () => {
  return { $tags: {}, $edges: {} };
};
NodeConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular TaggableConstruct standardization
  value = TaggableConstruct.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of an $edges object
  value.$edges = value.$edges || {};
  return value;
};

class SupernodeConstruct extends SetConstructMixin(NodeConstruct) {}
SupernodeConstruct.getBoilerplateValue = () => {
  return { $tags: {}, $members: {}, $edges: {} };
};
SupernodeConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular NodeConstruct standardization
  value = NodeConstruct.standardize({ mure, value, path, doc, aggressive });
  // ... and the SetConstruct standardization
  value = SetConstruct.standardize({ value });
  return value;
};

class InputOption {
  constructor({ name, defaultValue }) {
    this.name = name;
    this.defaultValue = defaultValue;
  }
}

class ValueInputOption extends InputOption {
  constructor({ name, defaultValue, suggestions = [] }) {
    super({ name, defaultValue });
    this.suggestions = suggestions;
  }
}
ValueInputOption.glomp = optionList => {
  const suggestions = glompLists(optionList.map(option => option.suggestions));
  return new ValueInputOption({
    name: optionList.some(option => option.name),
    defaultValue: suggestions[0],
    suggestions
  });
};

class ToggleInputOption extends InputOption {
  constructor({ name, defaultValue, choices }) {
    super({ name, defaultValue });
    this.choices = choices;
  }
}
ToggleInputOption.glomp = optionList => {
  const choices = glompLists(optionList.map(option => option.choices));
  return new ToggleInputOption({
    name: optionList.some(option => option.name),
    defaultValue: choices[0],
    choices
  });
};

class ConstructRequirement extends InputOption {
  constructor({ name, defaultValue, itemTypes, suggestions = [] }) {
    super({ name, defaultValue });
    this.itemTypes = itemTypes;
    this.suggestions = suggestions;
  }
}
ConstructRequirement.glomp = optionList => {
  const suggestions = glompLists(optionList.map(option => option.suggestions));
  return new ConstructRequirement({
    name: optionList.some(option => option.name),
    defaultValue: suggestions[0],
    itemTypes: glompLists(optionList.map(option => option.itemTypes)),
    suggestions
  });
};

class InputSpec {
  constructor() {
    this.options = {};
  }
  addValueOption(optionDetails) {
    this.options[optionDetails.name] = new ValueInputOption(optionDetails);
  }
  addToggleOption(optionDetails) {
    this.options[optionDetails.name] = new ToggleInputOption(optionDetails);
  }
  addConstructRequirement(optionDetails) {
    this.options[optionDetails.name] = new ConstructRequirement(optionDetails);
  }
  addMiscOption(optionDetails) {
    this.options[optionDetails.name] = new InputOption(optionDetails);
  }
}
InputSpec.glomp = specList => {
  if (specList.length === 0 || specList.indexOf(null) !== -1) {
    return null;
  }
  let result = new InputSpec();

  specList.reduce((agg, spec) => {
    return agg.concat(Object.keys(spec.options));
  }, []).forEach(optionName => {
    const inputSpecWOption = specList.find(spec => spec.options[optionName]);
    const glompFunc = inputSpecWOption.options[optionName].constructor.glomp;
    const glompedOption = glompFunc(specList.map(spec => spec.options[optionName]));
    result.options[optionName] = glompedOption;
  });

  return result;
};

class BaseOperation {
  constructor(mure) {
    this.mure = mure;
    this.terminatesChain = false;
    this.acceptsInputOptions = true;
  }
  get name() {
    const temp = /(.*)Operation/.exec(this.constructor.name);
    return temp ? temp[1] : this.constructor.name;
  }
  get lowerCamelCaseName() {
    const temp = this.name;
    return temp.replace(/./, temp[0].toLowerCase());
  }
  get humanReadableName() {
    // CamelCase to Sentence Case
    return this.name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  checkConstructInputs(item, inputOptions) {
    return true;
  }
  inferConstructInputs(item) {
    if (!this.checkConstructInputs(item)) {
      return null;
    } else {
      return new InputSpec();
    }
  }
  async executeOnConstruct(item, inputOptions) {
    throw new Error('unimplemented');
  }
  async checkSelectionInputs(selection, inputOptions) {
    return true;
  }
  async inferSelectionInputs(selection) {
    const items = await selection.items();
    const inputSpecPromises = Object.values(items).map(item => this.inferConstructInputs(item));
    return InputSpec.glomp((await Promise.all(inputSpecPromises)));
  }
  async executeOnSelection(selection, inputOptions) {
    const items = await selection.items();
    const outputSpecPromises = Object.values(items).map(item => this.executeOnConstruct(item, inputOptions));
    return OutputSpec.glomp((await Promise.all(outputSpecPromises)));
  }
}

class ContextualOperation extends BaseOperation {
  constructor(mure, subOperations) {
    super(mure);
    this.subOperations = {};
    subOperations.forEach(OperationClass => {
      this.subOperations[OperationClass.name] = new OperationClass(this.mure);
      this.subOperations[OperationClass.name].parentOperation = this;
    });
  }
  checkConstructInputs(item, inputOptions) {
    return inputOptions.context && this.subOperations[inputOptions.context];
  }
  inferConstructInputs(item) {
    const itemInputs = {};
    Object.entries(this.subOperations).map(([subOpName, subOp]) => {
      itemInputs[subOpName] = subOp.inferConstructInputs(item);
    });
    return itemInputs;
  }
  async executeOnConstruct(item, inputOptions) {
    throw new Error('unimplemented');
  }
  async checkSelectionInputs(selection, inputOptions) {
    return inputOptions.context && this.subOperations[inputOptions.context];
  }
  async inferSelectionInputs(selection) {
    const selectionInputs = {};
    const subOpList = Object.entries(this.subOperations);
    for (let i = 0; i < subOpList.length; i++) {
      let [subOpName, subOp] = subOpList[i];
      selectionInputs[subOpName] = await subOp.inferSelectionInputs(selection);
    }
    return selectionInputs;
  }
  async executeOnSelection(selection, inputOptions) {
    if (!(await this.checkSelectionInputs(selection, inputOptions))) {
      throw new Error(`Unknown operation context: ${inputOptions.context}`);
    }
    return this.subOperations[inputOptions.context].executeOnSelection(selection, inputOptions);
  }
}

var ChainTerminatingMixin = (superclass => class extends superclass {
  constructor(mure) {
    super(mure);
    this.terminatesChain = true;
  }
});

var ParameterlessMixin = (superclass => class extends superclass {
  constructor(mure) {
    super(mure);
    this.acceptsInputOptions = false;
  }
});

class NavigateToContents extends ParameterlessMixin(ChainTerminatingMixin(BaseOperation)) {
  checkConstructInputs(item) {
    return item instanceof this.mure.CONSTRUCTS.ItemConstruct || item instanceof this.mure.CONSTRUCTS.DocumentConstruct;
  }
  async executeOnConstruct(item) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Must be a ItemConstruct or a DocumentConstruct to \
NavigateToContents`);
    }
    return new OutputSpec({
      newSelectors: (await item.contentConstructs()).map(childConstruct => childConstruct.uniqueSelector)
    });
  }
}

class NavigateToMembers extends ParameterlessMixin(ChainTerminatingMixin(BaseOperation)) {
  checkConstructInputs(item) {
    return item instanceof this.mure.CONSTRUCTS.SetConstruct;
  }
  async executeOnConstruct(item) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Must be a SetConstruct to NavigateToMembers`);
    }
    return new OutputSpec({
      newSelectors: await item.memberSelectors()
    });
  }
}

class DirectedNavigate extends ChainTerminatingMixin(BaseOperation) {
  checkConstructInputs(item, inputOptions) {
    return item instanceof this.mure.CONSTRUCTS.EdgeConstruct || item instanceof this.mure.CONSTRUCTS.NodeConstruct;
  }
  inferConstructInputs(item) {
    if (!this.checkConstructInputs(item)) {
      return null;
    }
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['Ignore Edge Direction', 'Follow Edge Direction', 'Follow Reversed Direction'],
      defaultValue: 'Ignore Edge Direction'
    });
    return inputs;
  }
  getForward(inputOptions) {
    if (!inputOptions.direction) {
      return null;
    } else if (inputOptions.direction === 'Follow Edge Direction') {
      return true;
    } else if (inputOptions.direction === 'Follow Reversed Direction') {
      return false;
    } else {
      // if (inputOptions.direction === 'Ignore Edge Direction')
      return null;
    }
  }
  async executeOnSelection(selection, inputOptions) {
    this._forward = this.getForward(inputOptions);
    const temp = await super.executeOnSelection(selection, inputOptions);
    delete this._forward;
    return temp;
  }
}

class NavigateToNodes extends DirectedNavigate {
  async executeOnConstruct(item, inputOptions) {
    if (!this.checkInputs(item, inputOptions)) {
      throw new Error(`Must be an EdgeConstruct or NodeConstruct to NavigateToNodes`);
    }
    let forward = this._forward === undefined ? this.getForward(inputOptions) : this._forward;

    if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
      return new OutputSpec({
        newSelectors: await item.edgeSelectors(forward)
      });
    } else {
      // if (item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
      let temp = await item.nodeConstructs(forward);
      temp = temp.map(edgeConstruct => edgeConstruct.edgeSelectors(forward));
      return new OutputSpec({
        newSelectors: glompLists((await Promise.all(temp)))
      });
    }
  }
}

class NavigateToEdges extends DirectedNavigate {
  async executeOnConstruct(item, inputOptions) {
    if (!this.checkInputs(item, inputOptions)) {
      throw new Error(`Must be an EdgeConstruct or NodeConstruct to NavigateToEdges`);
    }
    let forward = this._forward === undefined ? this.getForward(inputOptions) : this._forward;

    if (item instanceof this.mure.CONSTRUCTS.EdgeConstruct) {
      return new OutputSpec({
        newSelectors: await item.nodeSelectors(forward)
      });
    } else {
      // if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
      let temp = await item.edgeConstructs(forward);
      temp = temp.map(edgeConstruct => edgeConstruct.nodeSelectors(forward));
      return new OutputSpec({
        newSelectors: glompLists((await Promise.all(temp)))
      });
    }
  }
}

class NavigateOperation extends ContextualOperation {
  constructor(mure) {
    super(mure, [NavigateToContents, NavigateToMembers, NavigateToNodes, NavigateToEdges]);
  }
}

class ConvertContainerToNode extends ParameterlessMixin(BaseOperation) {
  checkConstructInputs(item) {
    return item instanceof this.mure.CONSTRUCTS.ItemConstruct;
  }
  async executeOnConstruct(item) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Construct must be a ItemConstruct`);
    }
    item.value.$tags = item.value.$tags || {};
    item.value.$edges = item.value.$edges || {};
    return new OutputSpec({
      pollutedDocs: [item.doc]
    });
  }
  async executeOnSelection(selection) {
    const temp = await super.executeOnSelection(selection);
    // Invalidate the selection's cache of items so they're properly wrapped
    // for the next chained operation
    delete selection._cachedConstructs;
    return temp;
  }
}

class ConvertOperation extends ContextualOperation {
  constructor(mure) {
    super(mure, [ConvertContainerToNode]);
  }
}

var ConnectNodesMixin = (superclass => class extends superclass {
  async inferSelectionInputs(selection) {
    const containers = await this.pollSelection(selection);

    const inputs = await super.inferSelectionInputs(selection);
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'target'
    });
    inputs.addMiscOption({
      name: 'targetSelection',
      defaultValue: selection
    });
    inputs.addConstructRequirement({
      name: 'saveEdgesIn',
      itemTypes: [this.mure.CONSTRUCTS.ItemConstruct],
      defaultValue: containers[0],
      suggestions: containers
    });
    return inputs;
  }
  async extractNodes(selection) {
    const nodeList = [];
    const containers = await this.pollSelection(selection, item => {
      if (item instanceof this.mure.CONSTRUCTS.NodeConstruct) {
        nodeList.push(item);
      }
    });
    return { nodeList, containers };
  }
  async getSelectionExecutionLists(selection, inputOptions) {
    let [source, target] = await Promise.all([this.extractNodes(selection), inputOptions.targetSelection && this.extractNodes(inputOptions.targetSelection)]);
    let sourceList = source.nodeList;
    let containers = source.containers;
    let targetList;
    if (target) {
      targetList = target.nodeList;
      containers = glompLists([containers, target.containers]);
    } else {
      targetList = sourceList;
    }

    return { sourceList, targetList, containers };
  }
});

var ConnectSetsMixin = (superclass => class extends superclass {
  async inferSelectionInputs(selection) {
    let setA = null;
    let setB = null;
    let containers = await this.pollSelection(selection, item => {
      if (item.value && item.value.$members) {
        if (!setA) {
          setA = item;
        } else if (!setB) {
          setB = item;
        }
      }
    });
    if (!setA) {
      return null;
    }
    let setSuggestions = [setA];
    if (setB) {
      setSuggestions.push(setB);
    }

    const inputs = await super.inferSelectionInputs(selection);
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'target'
    });
    inputs.addConstructRequirement({
      name: 'sourceSet',
      defaultValue: setA,
      itemTypes: [this.mure.CONSTRUCTS.SetConstruct, this.mure.CONSTRUCTS.SupernodeConstruct],
      suggestions: setSuggestions
    });
    inputs.addConstructRequirement({
      name: 'targetSet',
      defaultValue: setB,
      itemTypes: [this.mure.CONSTRUCTS.SetConstruct, this.mure.CONSTRUCTS.SupernodeConstruct],
      suggestions: setSuggestions
    });
    inputs.addConstructRequirement({
      name: 'saveEdgesIn',
      defaultValue: containers[0],
      itemTypes: [this.mure.CONSTRUCTS.ItemConstruct],
      suggestions: containers
    });
    return inputs;
  }
  async executeOnSelection(selection, inputOptions) {
    let [sourceList, targetList, containers] = await Promise.all([inputOptions.sourceSet.memberConstructs(), inputOptions.targetSet ? inputOptions.targetSet.memberConstructs() : null, this.pollSelection(selection)]);
    sourceList = Object.values(sourceList).filter(item => item instanceof this.mure.CONSTRUCTS.NodeConstruct);
    if (targetList) {
      targetList = Object.values(targetList).filter(item => item instanceof this.mure.CONSTRUCTS.NodeConstruct);
    } else {
      targetList = sourceList;
    }

    const outputPromises = [];
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = 0; j < targetList.length; j++) {
        outputPromises.push(this.executeOnConstruct(sourceList[i], {
          otherConstruct: targetList[j],
          saveEdgesIn: inputOptions.saveEdgesIn || containers[0],
          connectWhen: (source, target) => {
            const sourceVal = inputOptions.sourceAttribute ? source.value[inputOptions.sourceAttribute] : source.label;
            const targetVal = inputOptions.targetAttribute ? target.value[inputOptions.targetAttribute] : target.label;
            return sourceVal === targetVal;
          },
          direction: inputOptions.direction || 'target'
        }));
      }
    }
    return OutputSpec.glomp((await Promise.all(outputPromises)));
  }
});

class ConnectSubOp extends ChainTerminatingMixin(BaseOperation) {
  inferConstructInputs(item) {
    const inputs = new InputSpec();
    inputs.addToggleOption({
      name: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'undirected'
    });
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    inputs.addConstructRequirement({
      name: 'otherConstruct',
      itemTypes: [this.mure.CONSTRUCTS.NodeConstruct]
    });
    inputs.addConstructRequirement({
      name: 'saveEdgesIn',
      itemTypes: [this.mure.CONSTRUCTS.ItemConstruct]
    });
    return inputs;
  }
  async executeOnConstruct(item, inputOptions) {
    const match = inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN;
    if (match(item, inputOptions.otherConstruct)) {
      const newEdge = item.linkTo(inputOptions.otherConstruct, inputOptions.saveEdgesIn, inputOptions.direction);

      return new OutputSpec({
        newSelectors: [newEdge.uniqueSelector],
        pollutedDocs: glompLists([[item.doc, inputOptions.otherConstruct.doc, newEdge.doc]])
      });
    } else {
      return new OutputSpec();
    }
  }
  async pollSelection(selection, callback = () => {}) {
    const items = await selection.items();
    let containers = [];
    const docs = {};
    Object.values(items).forEach(item => {
      if (item.constructor.name === 'ItemConstruct') {
        containers.push(item);
      }
      docs[item.doc._id] = item.doc;

      callback(item);
    });
    containers = containers.concat(Object.values(docs).map(doc => {
      return new this.mure.CONSTRUCTS.ItemConstruct({
        mure: this.mure,
        value: doc.orphans,
        path: [`{"_id":"${doc._id}"}`, 'orphans'],
        doc: doc
      });
    }));
    return containers;
  }
}
ConnectSubOp.DEFAULT_CONNECT_WHEN = (a, b) => {
  return a.label === b.label;
};

var ConnectOnFunctionMixin = (superclass => class extends superclass {
  async inferSelectionInputs(selection) {
    const inputs = new InputSpec();
    inputs.addValueOption({
      name: 'connectWhen',
      defaultValue: ConnectSubOp.DEFAULT_CONNECT_WHEN
    });
    return inputs;
  }
  async executeOnSelection(selection, inputOptions) {
    const { sourceList, targetList, containers } = await this.getSelectionExecutionLists(selection, inputOptions);
    const outputPromises = [];
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = 0; j < targetList.length; j++) {
        outputPromises.push(this.executeOnConstruct(sourceList[i], {
          otherConstruct: targetList[j],
          saveEdgesIn: inputOptions.saveEdgesIn || containers[0],
          connectWhen: inputOptions.connectWhen || ConnectSubOp.DEFAULT_CONNECT_WHEN,
          direction: inputOptions.direction || 'target'
        }));
      }
    }
    return OutputSpec.glomp((await Promise.all(outputPromises)));
  }
});

var ConnectOnAttributeMixin = (superclass => class extends superclass {
  async inferSelectionInputs(selection) {
    const inputs = new InputSpec();
    inputs.addValueOption({
      name: 'sourceAttribute',
      defaultValue: null // indicates that the label should be used
    });
    inputs.addValueOption({
      name: 'targetAttribute',
      defaultValue: null // indicates that the label should be used
    });
    return inputs;
  }
  async executeOnSelection(selection, inputOptions) {
    const { sourceList, targetList, containers } = await this.getSelectionExecutionLists(selection, inputOptions);

    const outputPromises = [];
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = 0; j < targetList.length; j++) {
        outputPromises.push(this.executeOnConstruct(sourceList[i], {
          otherConstruct: targetList[j],
          saveEdgesIn: inputOptions.saveEdgesIn || containers[0],
          connectWhen: (source, target) => {
            const sourceVal = inputOptions.sourceAttribute ? source.value[inputOptions.sourceAttribute] : source.label;
            const targetVal = inputOptions.targetAttribute ? target.value[inputOptions.targetAttribute] : target.label;
            return sourceVal === targetVal;
          },
          direction: inputOptions.direction || 'target'
        }));
      }
    }
    return OutputSpec.glomp((await Promise.all(outputPromises)));
  }
});

class ConnectNodesOnFunction extends ConnectNodesMixin(ConnectOnFunctionMixin(ConnectSubOp)) {}
class ConnectNodesOnAttribute extends ConnectNodesMixin(ConnectOnAttributeMixin(ConnectSubOp)) {}
class ConnectSetsOnFunction extends ConnectSetsMixin(ConnectOnFunctionMixin(ConnectSubOp)) {}
class ConnectSetsOnAttribute extends ConnectSetsMixin(ConnectOnAttributeMixin(ConnectSubOp)) {}

class ConnectOperation extends ContextualOperation {
  constructor(mure) {
    super(mure, [ConnectNodesOnFunction, ConnectNodesOnAttribute, ConnectSetsOnFunction, ConnectSetsOnAttribute]);
  }
}

class AssignClassOperation extends BaseOperation {
  checkConstructInputs(item, inputOptions) {
    return item instanceof this.mure.CONSTRUCTS.TaggableConstruct;
  }
  inferConstructInputs(item) {
    if (!this.checkConstructInputs(item)) {
      return null;
    } else {
      const temp = new InputSpec();
      temp.addValueOption({
        name: 'className',
        defaultValue: 'none',
        suggestions: Object.keys(item.doc.classes || {}).filter(c => !this.mure.RESERVED_OBJ_KEYS[c])
      });
      return temp;
    }
  }
  async executeOnConstruct(item, inputOptions) {
    if (!this.checkConstructInputs(item)) {
      throw new Error(`Must be a TaggableConstruct to assign a class`);
    }
    item.addClass(inputOptions.className || 'none');
    return new OutputSpec({
      pollutedDocs: [item.doc]
    });
  }
}

class Mure extends uki.Model {
  constructor(PouchDB, d3, d3n) {
    super();
    this.PouchDB = PouchDB; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3; // for Node.js, this will be from d3-node, not the regular one
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

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
    this.CONSTRUCTS = {
      RootConstruct,
      DocumentConstruct,
      PrimitiveConstruct,
      InvalidConstruct,
      NullConstruct,
      BooleanConstruct,
      NumberConstruct,
      StringConstruct,
      DateConstruct,
      ReferenceConstruct,
      ItemConstruct,
      TaggableConstruct,
      SetConstruct,
      EdgeConstruct,
      NodeConstruct,
      SupernodeConstruct
    };

    // Special keys that should be skipped in various operations
    this.RESERVED_OBJ_KEYS = {
      '_id': true,
      '_rev': true,
      '$wasArray': true,
      '$tags': true,
      '$members': true,
      '$edges': true,
      '$nodes': true,
      '$nextLabel': true,
      '$isDate': true
    };

    // Modes for deriving selections
    this.DERIVE_MODES = {
      REPLACE: 'REPLACE',
      UNION: 'UNION',
      XOR: 'XOR'
    };

    // Auto-mappings from native javascript types to Constructs
    this.JSTYPES = {
      'null': NullConstruct,
      'boolean': BooleanConstruct,
      'number': NumberConstruct
    };

    // All the supported operations
    let operationClasses = [NavigateOperation, ConvertOperation, ConnectOperation, AssignClassOperation];
    this.OPERATIONS = {};

    // Unlike CONSTRUCTS, we actually want to instantiate all the operations
    // with a reference to this. While we're at it, monkey patch them onto
    // the Selection class
    operationClasses.forEach(Operation => {
      const temp = new Operation(this);
      this.OPERATIONS[temp.name] = temp;
      Selection.prototype[temp.lowerCamelCaseName] = async function (inputOptions) {
        return this.execute(temp, inputOptions);
      };
    });

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
        let couchDbUrl = this.window.localStorage.getConstruct('couchDbUrl');
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
        status.linkedUserSelection = !!(await this.db.put({
          _id: '$linkedUserSelection',
          selectorList: []
        }).catch(() => false));
        status.linkedViewSettings = !!(await this.db.put({
          _id: '$linkedViewSettings',
          settings: {}
        }).catch(() => false));
        this.db.changes({
          since: (await this.db.info()).update_seq - 1,
          live: true,
          include_docs: true
        }).on('change', change => {
          if (change.id > '_\uffff') {
            // A regular document changed; invalidate all selection caches
            // corresponding to this document
            Selection.INVALIDATE_DOC_CACHE(change.id);
            if (change.doc._rev.search(/^1-/) !== -1) {
              // TODO: this is a hack to see if it's a newly-added doc (we want
              // to invalidate all selection caches, because we have no way to
              // know if they'd select this new document or not). This won't
              // work once we start dealing with replication, if a file gets
              // added remotely. See "How can I distinguish between added and
              // modified documents" in the PouchDB documentation:
              // https://pouchdb.com/guides/changes.html
              Selection.INVALIDATE_ALL_CACHES();
            }
            this.trigger('docChange', change.doc);
          } else if (change.id === '$linkedUserSelection') {
            // The linked user selection changed
            this.stickyTrigger('linkedViewChange', {
              userSelection: this.selectAll(change.doc.selectorList)
            });
          } else if (change.id === '$linkedViewSettings') {
            // The linked view settings changed
            this.stickyTrigger('linkedViewChange', {
              settings: change.doc.settings
            });
          }
        }).on('error', err => {
          this.warn(err);
        });
        resolve(status);
      })();
    });
  }
  async allDocs(options = {}) {
    await this.dbStatus;
    Object.assign(options, {
      startkey: '_\uffff',
      include_docs: true
    });
    let results = await this.db.allDocs(options);
    return results.rows.map(row => row.doc);
  }
  async allDocConstructs() {
    return (await this.allDocs()).map(doc => new this.CONSTRUCTS.DocumentConstruct({ mure: this, doc }));
  }
  async queryDocs(queryObj) {
    await this.dbStatus;
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
    await this.dbStatus;
    let doc;
    if (!docQuery) {
      return this.CONSTRUCTS.DocumentConstruct.launchStandardization({ doc: {}, mure: this });
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
          doc = await this.CONSTRUCTS.DocumentConstruct.launchStandardization({ doc: docQuery, mure: this });
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
    await this.dbStatus;
    try {
      return this.db.put(doc);
    } catch (err) {
      this.warn(err.message);
      err.ok = false;
      return err;
    }
  }
  async putDocs(docList) {
    await this.dbStatus;
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
      let contents = this.CONSTRUCTS.DocumentConstruct.formatDoc(doc, { mimeType });

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
  async uploadString(filename, mimeType, encoding, string, extensionOverride = null) {
    if (!mimeType) {
      let temp = mime.lookup(filename);
      if (temp) {
        mimeType = temp;
      }
    }
    // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly
    const extension = extensionOverride || mime.extension(mimeType) || 'txt';
    let doc = await this.CONSTRUCTS.DocumentConstruct.parse(string, extension);
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc(filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await this.CONSTRUCTS.DocumentConstruct.launchStandardization({ doc, mure: this });
    if (!(await this.putDoc(doc)).ok) {
      return null;
    } else {
      return this.select(`@{"_id":"${doc._id}"}$`);
    }
  }
  async deleteDoc(docQuery) {
    let doc = await this.getDoc(docQuery);
    return this.putDoc({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true
    });
  }
  selectDoc(docId) {
    return this.select('@{"_id":"' + docId + '"}$');
  }
  select(selectorList) {
    return new Selection(this, selectorList, { selectSingle: true });
  }
  selectAll(selectorList) {
    return new Selection(this, selectorList);
  }
  async setLinkedViews({ userSelection, settings } = {}) {
    await this.dbStatus;
    let docs = [];
    if (userSelection) {
      const linkedUserSelection = await this.db.get('$linkedUserSelection');
      linkedUserSelection.selectorList = userSelection.selectorList;
      docs.push(linkedUserSelection);
    }
    if (settings) {
      const linkedViewSettings = await this.db.get('$linkedViewSettings');
      Object.assign(linkedViewSettings.settings, settings);
      docs.push(linkedViewSettings);
    }
    return this.putDocs(docs);
  }
  async getLinkedViews() {
    await this.dbStatus;
    const temp = await Promise.all([this.db.get('$linkedUserSelection'), this.db.get('$linkedViewSettings')]);
    return {
      userSelection: this.selectAll(temp[0].selectorList),
      settings: temp[1].settings
    };
  }
  pathToSelector(path = [Selection.DEFAULT_DOC_QUERY]) {
    let docQuery = path[0];
    let objQuery = path.slice(1);
    objQuery = objQuery.length > 0 ? jsonPath.stringify(objQuery) : '';
    return '@' + docQuery + objQuery;
  }
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
  inferType(value, aggressive = false) {
    const jsType = typeof value;
    if (this.JSTYPES[jsType]) {
      return this.JSTYPES[jsType];
    } else if (jsType === 'string') {
      if (value[0] === '@') {
        // Attempt to parse as a reference
        try {
          new Selection(null, value); // eslint-disable-line no-new
          return this.CONSTRUCTS.ReferenceConstruct;
        } catch (err) {
          if (!err.INVALID_SELECTOR) {
            throw err;
          }
        }
      }
      // Not a reference...
      if (aggressive) {
        // Aggressively attempt to identify something more specific than string
        if (!isNaN(Number(value))) {
          return this.CONSTRUCTS.NumberConstruct;
          /*
           For now, we don't attempt to identify dates, even in aggressive mode,
           because things like new Date('Player 1') will successfully parse as a
           date. If we can find smarter ways to auto-infer dates (e.g. does the
           value fall suspiciously near the unix epoch, y2k, or more than +/-500
           years from now? Do sibling container items parse this as a date?), then
           maybe we'll add this back...
          */
          // } else if (!isNaN(new Date(value))) {
          //  return CONSTRUCTS.DateConstruct;
        } else {
          const temp = value.toLowerCase();
          if (temp === 'true') {
            return this.CONSTRUCTS.BooleanConstruct;
          } else if (temp === 'false') {
            return this.CONSTRUCTS.BooleanConstruct;
          } else if (temp === 'null') {
            return this.CONSTRUCTS.NullConstruct;
          }
        }
      }
      // Okay, it's just a string
      return this.CONSTRUCTS.StringConstruct;
    } else if (jsType === 'function' || jsType === 'symbol' || jsType === 'undefined' || value instanceof Array) {
      return this.CONSTRUCTS.InvalidConstruct;
    } else if (value === null) {
      return this.CONSTRUCTS.NullConstruct;
    } else if (value instanceof Date || value.$isDate === true) {
      return this.CONSTRUCTS.DateConstruct;
    } else if (value.$nodes) {
      return this.CONSTRUCTS.EdgeConstruct;
    } else if (value.$edges) {
      if (value.$members) {
        return this.CONSTRUCTS.SupernodeConstruct;
      } else {
        return this.CONSTRUCTS.NodeConstruct;
      }
    } else if (value.$members) {
      return this.CONSTRUCTS.SetConstruct;
    } else if (value.$tags) {
      return this.CONSTRUCTS.TaggableConstruct;
    } else {
      return this.CONSTRUCTS.ItemConstruct;
    }
  }
  async followRelativeLink(selector, doc, selectSingle = false) {
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
      tempSelection = new Selection(this, selector, { selectSingle });
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
}

var name = "mure";
var version = "0.4.0";
var description = "An integration library for the mure ecosystem of apps";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "node test/test.js",
	pretest: "rollup -c --environment TARGET:cjs && rm -rf mure mure-mrview*",
	posttest: "rm -rf mure mure-mrview*",
	debug: "rm -rf mure mure-mrview* && node --inspect-brk test/test.js"
};
var files = ["dist"];
var repository = {
	type: "git",
	url: "git+https://github.com/mure-apps/mure-library.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/mure-apps/mure-library/issues"
};
var homepage = "https://github.com/mure-apps/mure-library#readme";
var devDependencies = {
	"babel-core": "^6.26.3",
	"babel-plugin-external-helpers": "^6.22.0",
	"babel-preset-env": "^1.7.0",
	chalk: "^2.4.1",
	"d3-node": "^2.0.1",
	diff: "^3.5.0",
	"pouchdb-node": "^7.0.0",
	rollup: "^0.61.2",
	"rollup-plugin-babel": "^3.0.5",
	"rollup-plugin-commonjs": "^9.1.3",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	"blueimp-md5": "^2.10.0",
	datalib: "^1.8.0",
	jsonpath: "^1.0.0",
	"mime-types": "^2.1.18",
	"pouchdb-authentication": "^1.1.3",
	"pouchdb-browser": "^7.0.0",
	"pouchdb-find": "^7.0.0",
	uki: "^0.2.4"
};
var peerDependencies = {
	d3: "^5.4.0"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	"jsnext:main": "dist/mure.esm.js",
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
	peerDependencies: peerDependencies
};

let d3n = new D3Node();
// Attach a few extra shims for testing
d3n.window.localStorage = { getConstruct: () => null };

let PouchDB = require('pouchdb-node').plugin(require('pouchdb-find')).plugin(require('pouchdb-authentication'));

let mure = new Mure(PouchDB, d3n.d3, d3n);
mure.version = pkg.version;

module.exports = mure;
