'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var jsonPath = _interopDefault(require('jsonpath'));
var uki = require('uki');
var md5 = _interopDefault(require('blueimp-md5'));
var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var D3Node = _interopDefault(require('d3-node'));

const DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

class Selection {
  constructor(mure, selectorList = ['@' + DEFAULT_DOC_QUERY]) {
    if (!(selectorList instanceof Array)) {
      selectorList = [selectorList];
    }
    this.selectors = selectorList.map(selectorString => {
      const selector = mure.parseSelector(selectorString);
      if (selector === null) {
        let err = new Error('Invalid selector: ' + selectorString);
        err.INVALID_SELECTOR = true;
        throw err;
      }
      return selector;
    });

    // TODO: optimize and sort this.selectors for better hash equivalence

    this.mure = mure;
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
    return !!this._cachedWrappers;
  }
  invalidateCache() {
    delete this._cachedDocLists;
    delete this._cachedWrappers;
    delete this._summaryCaches;
  }
  async docLists() {
    if (this._cachedDocLists) {
      return this._cachedDocLists;
    }
    this._cachedDocLists = await Promise.all(this.selectors.map(d => this.mure.queryDocs({ selector: d.parsedDocQuery })));
    // We want all selections to operate from exactly the same document object,
    // so it's easy / straightforward for Wrappers to just mutate their own value
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
    if (this._cachedWrappers) {
      return this._cachedWrappers;
    }

    // Note: we should only pass in docLists in rare situations (such as the
    // one-off case in followRelativeLink() where we already have the document
    // available, and creating the new selection will result in an unnnecessary
    // query of the database). Usually, we should rely on the cache.
    docLists = docLists || (await this.docLists());

    return uki.queueAsync(async () => {
      // Collect the results of objQuery
      this._cachedWrappers = {};
      const addWrapper = item => {
        if (!this._cachedWrappers[item.uniqueSelector]) {
          this._cachedWrappers[item.uniqueSelector] = item;
        }
      };

      for (let index = 0; index < this.selectors.length; index++) {
        const selector = this.selectors[index];
        const docList = docLists[index];

        if (selector.objQuery === '') {
          // No objQuery means that we want a view of multiple documents (other
          // shenanigans mean we shouldn't select anything)
          if (selector.parentShift === 0 && !selector.followLinks) {
            addWrapper(new this.mure.WRAPPERS.RootWrapper({
              mure: this.mure,
              docList
            }));
          }
        } else if (selector.objQuery === '$') {
          // Selecting the documents themselves
          if (selector.parentShift === 0 && !selector.followLinks) {
            docList.forEach(doc => {
              addWrapper(new this.mure.WRAPPERS.DocumentWrapper({
                mure: this.mure,
                doc
              }));
            });
          } else if (selector.parentShift === 1) {
            addWrapper(new this.mure.WRAPPERS.RootWrapper({
              mure: this.mure,
              docList
            }));
          }
        } else {
          // Okay, we need to evaluate the jsonPath
          for (let docIndex = 0; docIndex < docList.length; docIndex++) {
            let doc = docList[docIndex];
            let matchingWrappers = jsonPath.nodes(doc, selector.objQuery);
            for (let itemIndex = 0; itemIndex < matchingWrappers.length; itemIndex++) {
              let { path, value } = matchingWrappers[itemIndex];
              let localPath = path;
              if (this.mure.RESERVED_OBJ_KEYS[localPath.slice(-1)[0]]) {
                // Don't create items under reserved keys
                continue;
              } else if (selector.parentShift === localPath.length) {
                // we parent shifted up to the root level
                if (!selector.followLinks) {
                  addWrapper(new this.mure.WRAPPERS.RootWrapper({
                    mure: this.mure,
                    docList
                  }));
                }
              } else if (selector.parentShift === localPath.length - 1) {
                // we parent shifted to the document level
                if (!selector.followLinks) {
                  addWrapper(new this.mure.WRAPPERS.DocumentWrapper({
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
                  Object.values((await this.mure.followRelativeLink(value, doc))).forEach(addWrapper);
                } else {
                  const WrapperType = this.mure.inferType(value);
                  addWrapper(new WrapperType({
                    mure: this.mure,
                    value,
                    path: [`{"_id":"${doc._id}"}`].concat(localPath),
                    doc
                  }));
                }
              }
            }
          }
        }
      }
      return this._cachedWrappers;
    });
  }
  async execute(operation, inputOptions) {
    let outputSpec = await operation.executeOnSelection(this, inputOptions);

    const pollutedDocs = Object.values(outputSpec.pollutedDocs);

    // Write any warnings, and, depending on the user's settings, skip or save
    // the results
    let skipSave = false;
    if (Object.keys(outputSpec.warnings).length > 0) {
      let warningString;
      if (outputSpec.ignoreErrors === 'Stop on Error') {
        skipSave = true;
        warningString = `${operation.humanReadableType} operation failed.\n`;
      } else {
        warningString = `${operation.humanReadableType} operation finished with warnings:\n`;
      }
      warningString += Object.entries(outputSpec.warnings).map(([warning, count]) => {
        if (count > 1) {
          return `${warning} (x${count})`;
        } else {
          return `${warning}`;
        }
      });
      this.mure.warn(warningString);
    }
    let saveSuccessful = false;
    if (!skipSave) {
      // Save the results
      const saveResult = await this.mure.putDocs(pollutedDocs);
      saveSuccessful = saveResult.error !== true;
      if (!saveSuccessful) {
        // There was a problem saving the result
        this.mure.warn(saveResult.message);
      }
    }

    // Any selection that has cached any of the documents that we altered
    // needs to have its cache invalidated
    pollutedDocs.forEach(doc => {
      Selection.INVALIDATE_DOC_CACHE(doc._id);
    });

    // Finally, return this selection, or a new selection, depending on the
    // operation
    if (saveSuccessful && outputSpec.newSelectors !== null) {
      return new Selection(this.mure, outputSpec.newSelectors);
    } else {
      return this;
    }
  }

  /*
   Shortcuts for selection manipulation
   */
  async subSelect(append, mode = 'Replace') {
    return this.selectAll({ context: 'Selector', append, mode });
  }
  async mergeSelection(otherSelection) {
    return this.selectAll({ context: 'Selection', otherSelection, mode: 'Union' });
  }

  /*
   These functions provide statistics / summaries of the selection:
   */
  async getPopulatedInputSpec(operation) {
    if (this._summaryCaches && this._summaryCaches.inputSpecs && this._summaryCaches.inputSpecs[operation.type]) {
      return this._summaryCaches.inputSpecs[operation.type];
    }

    const inputSpec = operation.getInputSpec();
    await inputSpec.populateChoicesFromSelection(this);

    this._summaryCaches = this._summaryCaches || {};
    this._summaryCaches.inputSpecs = this._summaryCaches.inputSpecs || {};
    this._summaryCaches.inputSpecs[operation.type] = inputSpec;
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
          counters.quantitativeWrappers = [];
          counters.quantitativeType = item.type;
          if (item instanceof this.mure.WRAPPERS.NumberWrapper) {
            counters.quantitativeScale = this.mure.d3.scaleLinear().domain([item.value, item.value]);
          } else if (item instanceof this.mure.WRAPPERS.DateWrapper) {
            counters.quantitativeScale = this.mure.d3.scaleTime().domain([item.value, item.value]);
          } else {
            // The first value is non-quantitative; this likely isn't a quantitative attribute
            counters.quantitativeBins = null;
            delete counters.quantitativeWrappers;
            delete counters.quantitativeType;
            delete counters.quantitativeScale;
          }
        } else if (counters.quantitativeType !== item.type) {
          // Encountered an item of a different type; this likely isn't a quantitative attribute
          counters.quantitativeBins = null;
          delete counters.quantitativeWrappers;
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
      if (item instanceof this.mure.WRAPPERS.PrimitiveWrapper) {
        countPrimitive(result.raw, item);
      } else {
        if (item.getContents) {
          Object.values(item.getContents()).forEach(childWrapper => {
            const counters = result.attributes[childWrapper.label] = result.attributes[childWrapper.label] || {
              typeBins: {},
              categoricalBins: {},
              quantitativeBins: []
            };
            counters.typeBins[childWrapper.type] = (counters.typeBins[childWrapper.type] || 0) + 1;
            if (childWrapper instanceof this.mure.WRAPPERS.PrimitiveWrapper) {
              countPrimitive(counters, childWrapper);
            }
          });
        }
        // TODO: collect more statistics, such as node degree, set size
        // (and a set's members' attributes, similar to getContents?)
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
        if (!counters.quantitativeWrappers || counters.quantitativeWrappers.length === 0) {
          counters.quantitativeBins = null;
          delete counters.quantitativeWrappers;
          delete counters.quantitativeType;
          delete counters.quantitativeScale;
        } else {
          // Calculate quantitative bin sizes and their counts
          // Clean up the scale a bit
          counters.quantitativeScale.nice();
          // Histogram generator
          const histogramGenerator = this.mure.d3.histogram().domain(counters.quantitativeScale.domain()).thresholds(counters.quantitativeScale.ticks(numBins)).value(d => d.value);
          counters.quantitativeBins = histogramGenerator(counters.quantitativeWrappers);
          // Clean up some of the temporary placeholders
          delete counters.quantitativeWrappers;
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
      if (item instanceof this.mure.WRAPPERS.EdgeWrapper) {
        // This is an edge; create / add to a pseudo-item for each class
        let classList = item.getClasses();
        if (classList.length === 0) {
          classList.push('(no class)');
        }
        classList.forEach(edgeClassName => {
          let pseudoEdge = result.edgeClasses[edgeClassName] = result.edgeClasses[edgeClassName] || { $nodes: {} };
          // Add our direction counts for each of the node's classes to the pseudo-item
          Object.entries(item.value.$nodes).forEach(([nodeSelector, directions]) => {
            let nodeWrapper = items[nodeSelector];
            if (!nodeWrapper) {
              // This edge refers to a node outside the selection
              result.missingNodes = true;
            } else {
              nodeWrapper.getClasses().forEach(nodeClassName => {
                Object.entries(directions).forEach(([direction, count]) => {
                  pseudoEdge.$nodes[nodeClassName] = pseudoEdge.$nodes[nodeClassName] || {};
                  pseudoEdge.$nodes[nodeClassName][direction] = pseudoEdge.$nodes[nodeClassName][direction] || 0;
                  pseudoEdge.$nodes[nodeClassName][direction] += count;
                });
              });
            }
          });
        });
      } else if (item instanceof this.mure.WRAPPERS.NodeWrapper) {
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
            let edgeWrapper = items[edgeSelector];
            if (!edgeWrapper) {
              // This node refers to an edge outside the selection
              result.missingEdges = true;
            } else {
              edgeWrapper.getClasses().forEach(edgeClassName => {
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
}
// TODO: this way of dealing with cache invalidation causes a memory leak, as
// old selections are going to pile up in CACHED_DOCS after they've lost all
// other references, preventing their garbage collection. Unfortunately things
// like WeakMap aren't enumerable... a good idea would probably be to just
// purge the cache every n minutes or so...?
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
Selection.INVALIDATE_ALL_CACHES = () => {
  Object.values(Selection.CACHED_DOCS).forEach(({ cachedDoc, selections }) => {
    selections.forEach(selection => {
      selection.invalidateCache();
    });
    delete Selection.CACHED_DOCS[cachedDoc._id];
  });
};

class Introspectable {
  get type() {
    return this.constructor.type;
  }
  get lowerCamelCaseType() {
    return this.constructor.lowerCamelCaseType;
  }
  get humanReadableType() {
    return this.constructor.humanReadableType;
  }
}
Object.defineProperty(Introspectable, 'type', {
  // This can / should be overridden by subclasses
  configurable: true,
  get() {
    return this.type;
  }
});
Object.defineProperty(Introspectable, 'lowerCamelCaseType', {
  get() {
    const temp = this.type;
    return temp.replace(/./, temp[0].toLocaleLowerCase());
  }
});
Object.defineProperty(Introspectable, 'humanReadableType', {
  get() {
    // CamelCase to Sentence Case
    return this.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
});

class BaseWrapper extends Introspectable {
  constructor({ mure, path, value, parent, doc, label, uniqueSelector }) {
    super();
    this.mure = mure;
    this.path = path;
    this._value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.uniqueSelector = uniqueSelector;
  }
  get value() {
    return this._value;
  }
  set value(newValue) {
    if (this.parent) {
      // In the event that this is a primitive boolean, number, string, etc,
      // setting the value on the Wrapper wrapper object *won't* naturally update
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
    return other instanceof BaseWrapper && this.uniqueSelector === other.uniqueSelector;
  }
}
Object.defineProperty(BaseWrapper, 'type', {
  get() {
    return (/(.*)Wrapper/.exec(this.name)[1]
    );
  }
});
BaseWrapper.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};
BaseWrapper.standardize = ({ value }) => {
  // Default action: do nothing
  return value;
};
BaseWrapper.isBadValue = value => false;

class RootWrapper extends BaseWrapper {
  constructor({ mure, docList }) {
    super({
      mure,
      path: [],
      value: {},
      parent: null,
      doc: null,
      label: null,
      uniqueSelector: '@'
    });
    docList.forEach(doc => {
      this.value[doc._id] = doc;
    });
  }
  remove() {
    throw new Error(`Can't remove the root item`);
  }
}

class TypedWrapper extends BaseWrapper {
  constructor({ mure, value, path, doc }) {
    let parent;
    if (path.length < 2) {
      throw new Error(`Can't create a non-Root or non-Doc Wrapper with a path length less than 2`);
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
    if (this.constructor.isBadValue(value)) {
      throw new TypeError(`typeof ${value} is ${typeof value}, which does not match required ${this.constructor.JSTYPE}`);
    }
  }
  get parentWrapper() {
    const ParentType = this.mure.inferType(this.parent);
    return new ParentType({
      mure: this.mure,
      value: this.parent,
      path: this.path.slice(0, this.path.length - 1),
      doc: this.doc
    });
  }
}
TypedWrapper.JSTYPE = 'object';
TypedWrapper.isBadValue = function (value) {
  return typeof value !== this.JSTYPE; // eslint-disable-line valid-typeof
};

var ContainerWrapperMixin = (superclass => class extends superclass {
  getValue(attribute, target = this._contentWrapper || this) {
    return target.value[attribute];
  }
  getAttributes(target = this._contentWrapper || this) {
    return Object.keys(target.value).filter(d => !this.mure.RESERVED_OBJ_KEYS[d]);
  }
  getContents(target = this._contentWrapper || this) {
    const result = {};
    Object.entries(target.value).forEach(([label, value]) => {
      if (!this.mure.RESERVED_OBJ_KEYS[label]) {
        let WrapperType = this.mure.inferType(value);
        const temp = new WrapperType({
          mure: this.mure,
          value,
          path: target.path.concat([label]),
          doc: target.doc
        });
        result[temp.uniqueSelector] = temp;
      }
    });
    return result;
  }
  getContentSelectors(target = this._contentWrapper || this) {
    return Object.keys(this.getContents(target));
  }
  getContentCount(target = this._contentWrapper || this) {
    return Object.keys(target.value).filter(label => !this.mure.RESERVED_OBJ_KEYS[label]).length;
  }
});

class ContainerWrapper extends ContainerWrapperMixin(TypedWrapper) {
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
  createNewWrapper(value, label, WrapperType) {
    WrapperType = WrapperType || this.mure.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item = new WrapperType({
      mure: this.mure,
      value: WrapperType.getBoilerplateValue(),
      path,
      doc: this.doc
    });
    this.addWrapper(item, label);
    return item;
  }
  addWrapper(item, label) {
    if (item instanceof ContainerWrapper) {
      if (item.value._id) {
        throw new Error('Wrapper has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.slice(1).concat([label]))}`;
    }
    this.value[label] = item.value;
  }
}
ContainerWrapper.getBoilerplateValue = () => {
  return {};
};
ContainerWrapper.convertArray = value => {
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
ContainerWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
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
        nestedValue = ContainerWrapper.convertArray(nestedValue);
        // What kind of value are we dealing with?
        let WrapperType = mure.inferType(nestedValue, aggressive);
        // Apply that class's standardization function
        value[key] = WrapperType.standardize({
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

class DocumentWrapper extends ContainerWrapperMixin(BaseWrapper) {
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
    this._contentWrapper = new ContainerWrapper({
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
}
DocumentWrapper.isValidId = docId => {
  if (docId[0].toLowerCase() !== docId[0]) {
    return false;
  }
  let parts = docId.split(';');
  if (parts.length !== 2) {
    return false;
  }
  return !!mime.extension(parts[0]);
};
DocumentWrapper.parse = async (text, extension) => {
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
DocumentWrapper.launchStandardization = async ({ mure, doc }) => {
  let existingUntitleds = await mure.db.allDocs({
    startkey: doc.mimeType + ';Untitled ',
    endkey: doc.mimeType + ';Untitled \uffff'
  });
  return DocumentWrapper.standardize({
    mure,
    doc,
    existingUntitleds,
    aggressive: true
  });
};
DocumentWrapper.standardize = ({
  mure,
  doc,
  existingUntitleds = { rows: [] },
  aggressive
}) => {
  if (!doc._id || !DocumentWrapper.isValidId(doc._id)) {
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
  // In case doc.contents is an array, prep it for ContainerWrapper.standardize
  doc.contents = ContainerWrapper.convertArray(doc.contents);
  doc.contents = ContainerWrapper.standardize({
    mure,
    value: doc.contents,
    path: [`{"_id":"${doc._id}"}`, '$', 'contents'],
    doc,
    aggressive
  });

  return doc;
};

class PrimitiveWrapper extends TypedWrapper {
  stringValue() {
    return String(this.value);
  }
}

class InvalidWrapper extends BaseWrapper {
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
InvalidWrapper.JSTYPE = 'object';
InvalidWrapper.isBadValue = value => true;

class NullWrapper extends PrimitiveWrapper {}
NullWrapper.JSTYPE = 'null';
NullWrapper.getBoilerplateValue = () => null;
NullWrapper.standardize = () => null;

class BooleanWrapper extends PrimitiveWrapper {}
BooleanWrapper.JSTYPE = 'boolean';
BooleanWrapper.getBoilerplateValue = () => false;
BooleanWrapper.standardize = ({ value }) => !!value;

class NumberWrapper extends PrimitiveWrapper {}
NumberWrapper.JSTYPE = 'number';
NumberWrapper.getBoilerplateValue = () => 0;
NumberWrapper.standardize = ({ value }) => Number(value);
NumberWrapper.isBadValue = isNaN;

class StringWrapper extends PrimitiveWrapper {}
StringWrapper.JSTYPE = 'string';
StringWrapper.getBoilerplateValue = () => '';
StringWrapper.standardize = ({ value }) => {
  if (isNaN(value) || value === undefined) {
    return String(value);
  } else {
    JSON.stringify(value);
  }
};

class DateWrapper extends PrimitiveWrapper {
  constructor({ mure, value, path, doc }) {
    super({ mure, value: DateWrapper.standardize(value), path, doc });
  }
  get value() {
    return new Date(this._value.str);
  }
  set value(newValue) {
    super.value = DateWrapper.standardize(newValue);
  }
  stringValue() {
    return String(this.value);
  }
}
DateWrapper.getBoilerplateValue = () => new Date();
DateWrapper.standardize = ({ value }) => {
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
DateWrapper.isBadValue = value => value.toString() !== 'Invalid Date';

class ReferenceWrapper extends StringWrapper {}
ReferenceWrapper.getBoilerplateValue = () => '@$';

class GenericWrapper extends ContainerWrapper {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$tags) {
      throw new TypeError(`GenericWrapper requires a $tags object`);
    }
  }
  addClass(className) {
    if (!this.doc.classes[className]) {
      this.doc.classes[className] = this.mure.WRAPPERS.SetWrapper.getBoilerplateValue();
      this.doc.classes[className]._id = '@' + jsonPath.stringify(['$', 'classes', className]);
    }
    const classItem = new this.mure.WRAPPERS.SetWrapper({
      mure: this.mure,
      path: [this.path[0], '$', 'classes', className],
      value: this.doc.classes[className],
      doc: this.doc
    });
    classItem.addWrapper(this);
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
GenericWrapper.getBoilerplateValue = () => {
  return { $tags: {} };
};
GenericWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular ContainerWrapper standardization
  value = ContainerWrapper.standardize({ mure, value, path, doc, aggressive });
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

var SetWrapperMixin = (superclass => class extends superclass {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$members) {
      throw new TypeError(`SetWrapper requires a $members object`);
    }
  }
  addWrapper(item) {
    const itemTag = item.value._id;
    const setTag = this.value._id;
    this.value.$members[itemTag] = true;
    item.value.$tags[setTag] = true;
  }
  getMemberSelectors() {
    return Object.keys(this.value.$members);
  }
  async getMembers() {
    return this.mure.selectAll(this.getMemberSelectors()).items();
  }
});

class SetWrapper extends SetWrapperMixin(TypedWrapper) {}
SetWrapper.getBoilerplateValue = () => {
  return { $members: {} };
};
SetWrapper.standardize = ({ value }) => {
  // Ensure the existence of a $members object
  value.$members = value.$members || {};
  return value;
};

class EdgeWrapper extends GenericWrapper {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$nodes) {
      throw new TypeError(`EdgeWrapper requires a $nodes object`);
    }
  }
  attachTo(node, direction = 'undirected') {
    node.value.$edges[this.uniqueSelector] = true;
    let nodeId = node.uniqueSelector;
    this.value.$nodes[nodeId] = this.value.$nodes[nodeId] || {};
    this.value.$nodes[nodeId][direction] = this.value.$nodes[nodeId][direction] || 0;
    this.value.$nodes[nodeId][direction] += 1;
  }
  async nodeSelectors(direction = null) {
    return Object.entries(this.value.$nodes).filter(([selector, directions]) => {
      // null indicates that we allow all movement
      return direction === null || directions[direction];
    }).map(([selector, directions]) => selector);
  }
  async nodeWrappers(forward = null) {
    return this.mure.selectAll((await this.nodeSelectors(forward))).items();
  }
  async nodeWrapperCount(forward = null) {
    return (await this.nodeSelectors(forward)).length;
  }
}
EdgeWrapper.oppositeDirection = direction => {
  return direction === 'source' ? 'target' : direction === 'target' ? 'source' : 'undirected';
};
EdgeWrapper.getBoilerplateValue = () => {
  return { $tags: {}, $nodes: {} };
};
EdgeWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular GenericWrapper standardization
  value = GenericWrapper.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of a $nodes object
  value.$nodes = value.$nodes || {};
  return value;
};
EdgeWrapper.glompValue = edgeList => {
  let temp = GenericWrapper.glomp(edgeList);
  temp.value.$nodes = {};
  edgeList.forEach(edgeWrapper => {
    Object.entries(edgeWrapper.value.$nodes).forEach(([selector, directions]) => {
      temp.$nodes[selector] = temp.value.$nodes[selector] || {};
      Object.keys(directions).forEach(direction => {
        temp.value.$nodes[selector][direction] = temp.value.$nodes[selector][direction] || 0;
        temp.value.$nodes[selector][direction] += directions[direction];
      });
    });
  });
  return temp;
};

class NodeWrapper extends GenericWrapper {
  constructor({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$edges) {
      throw new TypeError(`NodeWrapper requires an $edges object`);
    }
  }
  connectTo(otherNode, container, direction = 'undirected') {
    let newEdge = container.createNewWrapper({}, undefined, EdgeWrapper);
    newEdge.attachTo(this, direction);
    newEdge.attachTo(otherNode, EdgeWrapper.oppositeDirection(direction));
    return newEdge;
  }
  async edgeSelectors(direction = null) {
    if (direction === null) {
      return Object.keys(this.value.$edges);
    } else {
      return (await this.edgeWrappers(direction)).map(item => item.uniqueSelector);
    }
  }
  async edgeWrappers(direction = null) {
    return (await this.mure.selectAll(Object.keys(this.value.$egdes))).items().filter(item => {
      // null indicates that we allow all edges. If direction isn't null,
      // only include edges where we are the OPPOSITE direction (we are
      // at the beginning of the traversal)
      return direction === null || item.$nodes[this.uniqueSelector][EdgeWrapper.oppositeDirection(direction)];
    });
  }
  async edgeWrapperCount(forward = null) {
    return (await this.edgeSelectors(forward)).length;
  }
}
NodeWrapper.getBoilerplateValue = () => {
  return { $tags: {}, $edges: {} };
};
NodeWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular GenericWrapper standardization
  value = GenericWrapper.standardize({ mure, value, path, doc, aggressive });
  // Ensure the existence of an $edges object
  value.$edges = value.$edges || {};
  return value;
};

class SupernodeWrapper extends SetWrapperMixin(NodeWrapper) {}
SupernodeWrapper.getBoilerplateValue = () => {
  return { $tags: {}, $members: {}, $edges: {} };
};
SupernodeWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Do the regular NodeWrapper standardization
  value = NodeWrapper.standardize({ mure, value, path, doc, aggressive });
  // ... and the SetWrapper standardization
  value = SetWrapper.standardize({ value });
  return value;
};

class InputSpec {
  constructor() {
    this.options = {};
  }
  addOption(option) {
    this.options[option.parameterName] = option;
  }
  async updateChoices(params) {
    return Promise.all(Object.values(this.options).map(option => {
      if (option.specs) {
        return Promise.all(Object.values(option.specs).map(spec => spec.updateChoices(params)));
      } else if (option.updateChoices) {
        return option.updateChoices(params);
      }
    }));
  }
}

class InputOption extends Introspectable {
  constructor({
    parameterName,
    defaultValue = null,
    choices = [],
    openEnded = false
  }) {
    super();
    this.parameterName = parameterName;
    this._defaultValue = defaultValue;
    this.choices = choices;
    this.openEnded = openEnded;
  }
  get humanReadableParameterName() {
    return this.parameterName.replace(/./, this.parameterName[0].toLocaleUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  get defaultValue() {
    if (this._defaultValue !== null) {
      return this._defaultValue;
    } else if (this.choices.length > 0) {
      return this.choices[0];
    } else {
      return null;
    }
  }
  set defaultValue(value) {
    this._defaultValue = value;
  }
}
Object.defineProperty(InputOption, 'type', {
  get() {
    return (/(.*)Option/.exec(this.name)[1]
    );
  }
});

class OutputSpec {
  constructor({ newSelectors = null, pollutedDocs = {}, warnings = {} } = {}) {
    this.newSelectors = newSelectors;
    this.pollutedDocs = pollutedDocs;
    this.warnings = warnings;
  }
  addSelectors(selectors) {
    this.newSelectors = (this.newSelectors || []).concat(selectors);
  }
  flagPollutedDoc(doc) {
    this.pollutedDocs[doc._id] = doc;
  }
  warn(warning) {
    this.warnings[warning] = this.warnings[warning] || 0;
    this.warnings[warning] += 1;
  }
}
OutputSpec.glomp = specList => {
  let newSelectors = {};
  let pollutedDocs = {};
  let warnings = {};
  specList.forEach(spec => {
    if (spec.newSelectors) {
      spec.newSelectors.forEach(selector => {
        newSelectors[selector] = true;
      });
    }
    Object.values(spec.pollutedDocs).forEach(doc => {
      pollutedDocs[doc._id] = doc;
    });
    Object.entries(spec.warnings).forEach(([warning, count]) => {
      warnings[warning] = warnings[warning] || 0;
      warnings[warning] += count;
    });
  });
  newSelectors = Object.keys(newSelectors);
  return new OutputSpec({
    newSelectors: newSelectors.length > 0 ? newSelectors : null,
    pollutedDocs,
    warnings
  });
};

class BaseOperation extends Introspectable {
  constructor(mure) {
    super();
    this.mure = mure;
  }
  getInputSpec() {
    const result = new InputSpec();
    result.addOption(new InputOption({
      parameterName: 'ignoreErrors',
      choices: ['Stop on Error', 'Ignore'],
      defaultValue: 'Stop on Error'
    }));
    return result;
  }
  potentiallyExecutableOnItem(item) {
    return true;
  }
  async canExecuteOnInstance(item, inputOptions) {
    return item && inputOptions.ignoreErrors !== 'Stop on Error';
  }
  async executeOnInstance(item, inputOptions) {
    throw new Error('unimplemented');
  }
  getItemsInUse(inputOptions) {
    const itemsInUse = {};
    Object.values(inputOptions).forEach(argument => {
      if (argument && argument.uniqueSelector) {
        itemsInUse[argument.uniqueSelector] = true;
      }
    });
    return itemsInUse;
  }
  async potentiallyExecutableOnSelection(selection) {
    const items = await selection.items();
    return Object.values(items).some(item => this.potentiallyExecutableOnItem(item));
  }
  async canExecuteOnSelection(selection, inputOptions) {
    const itemsInUse = this.getItemsInUse(inputOptions);
    const items = await selection.items();
    const canExecuteInstances = await Promise.all(Object.values(items).map(item => {
      return itemsInUse[item.uniqueSelector] || this.canExecuteOnInstance(item, inputOptions);
    }));
    if (canExecuteInstances.length === 0) {
      return false;
    }if (inputOptions.ignoreErrors === 'Stop on Error') {
      return canExecuteInstances.every(canExecute => canExecute);
    } else {
      return canExecuteInstances.some(canExecute => canExecute);
    }
  }
  async executeOnSelection(selection, inputOptions) {
    const itemsInUse = this.getItemsInUse(inputOptions);
    const items = await selection.items();
    const outputSpecPromises = Object.values(items).map(item => {
      if (itemsInUse[item.uniqueSelector]) {
        return new OutputSpec(); // Ignore items that are inputOptions
      } else {
        return this.executeOnInstance(item, inputOptions);
      }
    });
    return OutputSpec.glomp((await Promise.all(outputSpecPromises)));
  }
}
Object.defineProperty(BaseOperation, 'type', {
  get() {
    return (/(.*)Operation/.exec(this.name)[1]
    );
  }
});

class ContextualOption extends InputOption {
  constructor({ parameterName, defaultValue, choices = [], hiddenChoices = [] }) {
    if (choices.length < 2) {
      throw new Error('Contextual options must specify at least two choices a priori');
    }
    super({ parameterName, defaultValue, choices, openEnded: false });
    this.specs = {};
    choices.concat(hiddenChoices).forEach(choice => {
      this.specs[choice] = new InputSpec();
    });
  }
}

class SelectAllOperation extends BaseOperation {
  getInputSpec() {
    const result = super.getInputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Children', 'Parents', 'Nodes', 'Edges', 'Members'],
      hiddenChoices: ['Selector', 'Selector List', 'Selection'],
      defaultValue: 'Children'
    });
    result.addOption(context);

    const direction = new InputOption({
      parameterName: 'direction',
      choices: ['Ignore', 'Forward', 'Backward'],
      defaultValue: 'Ignore'
    });
    context.specs['Nodes'].addOption(direction);
    context.specs['Edges'].addOption(direction);

    // Extra settings for hidden modes:
    context.specs['Selector'].addOption(new InputOption({
      parameterName: 'append',
      defaultValue: '[*]',
      openEnded: true
    }));
    context.specs['Selector List'].addOption(new InputOption({
      paramterName: 'selectorList',
      defaultValue: []
    }));
    context.specs['Selection'].addOption(new InputOption({
      parameterName: 'otherSelection'
    }));

    const mode = new InputOption({
      parameterName: 'mode',
      choices: ['Replace', 'Union', 'XOR'],
      defaultValue: 'Replace'
    });
    context.specs['Selector'].addOption(mode);
    context.specs['Selector List'].addOption(mode);
    context.specs['Selection'].addOption(mode);

    return result;
  }
  async canExecuteOnInstance(item, inputOptions) {
    if (await super.canExecuteOnInstance(item, inputOptions)) {
      return true;
    }
    if (inputOptions.context === 'Children') {
      return item instanceof this.mure.WRAPPERS.ContainerWrapper || item instanceof this.mure.WRAPPERS.DocumentWrapper;
    } else if (inputOptions.context === 'Parents') {
      return !(item instanceof this.mure.WRAPPERS.DocumentWrapper || item instanceof this.mure.WRAPPERS.RootWrapper);
    } else if (inputOptions.context === 'Nodes') {
      return item instanceof this.mure.WRAPPERS.NodeWrapper || item instanceof this.mure.WRAPPERS.EdgeWrapper;
    } else if (inputOptions.context === 'Edges') {
      return item instanceof this.mure.WRAPPERS.NodeWrapper || item instanceof this.mure.WRAPPERS.EdgeWrapper;
    } else if (inputOptions.context === 'Members') {
      return item instanceof this.mure.WRAPPERS.SetWrapper || item instanceof this.mure.WRAPPERS.SupernodeWrapper;
    } else if (inputOptions.context === 'Selector') {
      return this.mure.parseSelector(item.uniqueSelector + inputOptions.append) !== null;
    } else {
      return false;
    }
  }
  async executeOnInstance(item, inputOptions) {
    const output = new OutputSpec();
    const direction = inputOptions.direction || 'Ignore';
    const forward = direction === 'Forward' ? true : direction === 'Backward' ? false : null;
    if (inputOptions.context === 'Children' && (item instanceof this.mure.WRAPPERS.ContainerWrapper || item instanceof this.mure.WRAPPERS.DocumentWrapper)) {
      output.addSelectors(Object.values(item.getContents()).map(childWrapper => childWrapper.uniqueSelector));
    } else if (inputOptions.context === 'Parents' && !(item instanceof this.mure.WRAPPERS.DocumentWrapper || item instanceof this.mure.WRAPPERS.RootWrapper)) {
      output.addSelectors([item.parentWrapper.uniqueSelector]);
    } else if (inputOptions.context === 'Nodes' && item instanceof this.mure.WRAPPERS.EdgeWrapper) {
      output.addSelectors((await item.nodeSelectors(forward)));
    } else if (inputOptions.context === 'Nodes' && item instanceof this.mure.WRAPPERS.NodeWrapper) {
      output.addSelectors((await Promise.all((await item.edgeWrappers(forward)).map(edge => edge.nodeSelectors(forward)))));
    } else if (inputOptions.context === 'Edges' && item instanceof this.mure.WRAPPERS.NodeWrapper) {
      output.addSelectors((await item.edgeSelectors(forward)));
    } else if (inputOptions.context === 'Edges' && item instanceof this.mure.WRAPPERS.EdgeWrapper) {
      output.addSelectors((await Promise.all((await item.nodeWrappers(forward)).map(node => node.edgeSelectors(forward)))));
    } else if (inputOptions.context === 'Members' && (item instanceof this.mure.WRAPPERS.SetWrapper || item instanceof this.mure.WRAPPERS.SupernodeWrapper)) {
      output.addSelectors((await item.getMemberSelectors()));
    } else if (inputOptions.context === 'Selector') {
      const newString = item.uniqueSelector + inputOptions.append;
      const newSelector = this.mure.parseSelector(newString);
      if (newSelector === null) {
        output.warn(`Invalid selector: ${newString}`);
      } else {
        output.addSelectors([newString]);
      }
    } else {
      output.warn(`Can't select ${inputOptions.context} from ${item.type}`);
    }
    return output;
  }
  async canExecuteOnSelection(selection, inputOptions) {
    if (inputOptions.context === 'Selector List') {
      return inputOptions.selectorList instanceof Array;
    } else if (inputOptions.context === 'Selection') {
      return inputOptions.otherSelection instanceof Selection;
    } else {
      return super.canExecuteOnSelection(selection, inputOptions);
    }
  }
  async executeOnSelection(selection, inputOptions) {
    let otherSelectorList = inputOptions.selectorList || inputOptions.otherSelection && inputOptions.otherSelection.selectorList;
    if (otherSelectorList) {
      const output = new OutputSpec();
      if (inputOptions.mode === 'Union') {
        output.addSelectors(selection.selectorList.concat(otherSelectorList));
      } else if (inputOptions.mode === 'XOR') {
        output.addSelectors(otherSelectorList.filter(selector => selection.selectorList.indexOf(selector) === -1).concat(selection.selectorList.filter(selector => otherSelectorList.indexOf(selector) === -1)));
      } else {
        // if (inputOptions.mode === 'Replace') {
        output.addSelectors(otherSelectorList);
      }
      return output;
    } else {
      return super.executeOnSelection(selection, inputOptions);
    }
  }
}

class StringOption extends InputOption {
  populateExistingChoiceStrings(choiceDict) {
    this.choices.forEach(choice => {
      if (choice !== null) {
        choiceDict[choice] = true;
      }
    });
  }
}

class ClassOption extends StringOption {
  async updateChoices({ items, reset = false }) {
    let classes = {};
    if (!reset) {
      this.populateExistingChoiceStrings(classes);
    }
    Object.values(items).map(item => {
      return item.getClasses ? item.getClasses() : [];
    }).forEach(classList => {
      classList.forEach(className => {
        classes[className] = true;
      });
    });
    this.choices = Object.keys(classes);
  }
}

const DEFAULT_FILTER_FUNC = 'return item.value === true';

class FilterOperation extends BaseOperation {
  getInputSpec() {
    const result = super.getInputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Class', 'Function'],
      defaultValue: 'Class'
    });
    result.addOption(context);

    context.specs['Class'].addOption(new ClassOption({
      parameterName: 'className'
    }));
    context.specs['Function'].addOption(new InputOption({
      parameterName: 'filterFunction',
      defaultValue: DEFAULT_FILTER_FUNC,
      openEnded: true
    }));

    return result;
  }
  async canExecuteOnInstance(item, inputOptions) {
    return false;
  }
  async executeOnInstance(item, inputOptions) {
    throw new Error(`The Filter operation is not yet supported at the instance level`);
  }
  async canExecuteOnSelection(selection, inputOptions) {
    if (inputOptions.context === 'Function') {
      if (typeof inputOptions.filterFunction === 'function') {
        return true;
      }
      try {
        Function('item', // eslint-disable-line no-new-func
        inputOptions.connectWhen || DEFAULT_FILTER_FUNC);
        return true;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    } else {
      return inputOptions.className;
    }
  }
  async executeOnSelection(selection, inputOptions) {
    const output = new OutputSpec();
    let filterFunction;
    if (inputOptions.context === 'Function') {
      filterFunction = inputOptions.filterFunction;
      if (typeof filterFunction !== 'function') {
        try {
          filterFunction = new Function('item', // eslint-disable-line no-new-func
          inputOptions.connectWhen || DEFAULT_FILTER_FUNC);
        } catch (err) {
          if (err instanceof SyntaxError) {
            output.warn(`filterFunction SyntaxError: ${err.message}`);
            return output;
          } else {
            throw err;
          }
        }
      }
    } else {
      // if (inputOptions.context === 'Class')
      filterFunction = item => {
        return item.getClasses && item.getClasses().indexOf(inputOptions.className) !== -1;
      };
    }
    Object.values((await selection.items())).forEach(item => {
      if (filterFunction(item)) {
        output.addSelectors([item.uniqueSelector]);
      }
    });
    return output;
  }
}

class BaseConversion extends Introspectable {
  constructor({ mure, TargetType, standardTypes = [], specialTypes = [] }) {
    super();
    this.mure = mure;
    this.TargetType = TargetType;
    this.standardTypes = {};
    standardTypes.forEach(Type => {
      this.standardTypes[Type.type] = Type;
    });
    this.specialTypes = {};
    specialTypes.forEach(Type => {
      this.specialTypes[Type.type] = Type;
    });
  }
  canExecuteOnInstance(item) {
    return this.standardTypes[item.type] || this.specialTypes[item.type];
  }
  convertItem(item, inputOptions, outputSpec) {
    if (item.constructor === this.TargetType) {
      // skip conversion if the type is already the same
      return;
    }if (this.standardTypes[item.type]) {
      this.standardConversion(item, inputOptions, outputSpec);
    } else if (this.specialTypes[item.type]) {
      this.specialConversion(item, inputOptions, outputSpec);
    } else {
      outputSpec.warn(`Conversion from ${item.type} to ${this.TargetType.type} is not supported`);
    }
  }
  addOptionsToSpec(inputSpec) {}
  standardConversion(item, inputOptions, outputSpec) {
    // Because of BaseWrapper's setter, this will actually apply to the
    // item's document as well as to the item wrapper
    item.value = this.TargetType.standardize({
      mure: this.mure,
      value: item.value,
      path: item.path,
      doc: item.doc
    });
    if (this.TargetType.isBadValue(item.value)) {
      outputSpec.warn(`Converted ${item.type} to ${item.value}`);
    }
  }
  specialConversion(item, inputOptions, outputSpec) {
    throw new Error('unimiplemented');
  }
}
Object.defineProperty(BaseConversion, 'type', {
  get() {
    return (/(.*)Conversion/.exec(this.name)[1]
    );
  }
});

class NullConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.NullWrapper,
      standardTypes: [mure.WRAPPERS.BooleanWrapper, mure.WRAPPERS.NumberWrapper, mure.WRAPPERS.StringWrapper, mure.WRAPPERS.DateWrapper, mure.WRAPPERS.ReferenceWrapper, mure.WRAPPERS.ContainerWrapper, mure.WRAPPERS.NodeWrapper, mure.WRAPPERS.EdgeWrapper, mure.WRAPPERS.SetWrapper, mure.WRAPPERS.SupernodeWrapper],
      specialTypes: []
    });
  }
}

class BooleanConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.BooleanWrapper,
      standardTypes: [mure.WRAPPERS.NullWrapper, mure.WRAPPERS.NumberWrapper, mure.WRAPPERS.DateWrapper, mure.WRAPPERS.ReferenceWrapper, mure.WRAPPERS.ContainerWrapper, mure.WRAPPERS.NodeWrapper, mure.WRAPPERS.EdgeWrapper, mure.WRAPPERS.SetWrapper, mure.WRAPPERS.SupernodeWrapper],
      specialTypes: [mure.WRAPPERS.StringWrapper]
    });
  }
  specialConversion(item, inputOptions, outputSpec) {
    // TODO: smarter conversion from strings than javascript's default
    item.value = !!item.value;
  }
}

class NumberConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.NumberWrapper,
      standardTypes: [mure.WRAPPERS.NullWrapper, mure.WRAPPERS.BooleanWrapper, mure.WRAPPERS.StringWrapper]
    });
  }
}

class StringConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.StringWrapper,
      standardTypes: [mure.WRAPPERS.NullWrapper, mure.WRAPPERS.BooleanWrapper, mure.WRAPPERS.NumberWrapper, mure.WRAPPERS.DateWrapper]
    });
  }
}

class GenericConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.GenericWrapper,
      standardTypes: [mure.WRAPPERS.ContainerWrapper],
      specialTypes: []
    });
  }
}

class NodeConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.NodeWrapper,
      standardTypes: [mure.WRAPPERS.ContainerWrapper],
      specialTypes: []
    });
  }
}

class EdgeConversion extends BaseConversion {
  constructor(mure) {
    super({
      mure,
      TargetType: mure.WRAPPERS.EdgeWrapper,
      standardTypes: [mure.WRAPPERS.ContainerWrapper],
      specialTypes: []
    });
  }
}

class ConvertOperation extends BaseOperation {
  constructor(mure) {
    super(mure);

    const conversionList = [new BooleanConversion(mure), new NumberConversion(mure), new StringConversion(mure), new NullConversion(mure), new GenericConversion(mure), new NodeConversion(mure), new EdgeConversion(mure)];
    this.CONVERSIONS = {};
    conversionList.forEach(conversion => {
      this.CONVERSIONS[conversion.type] = conversion;
    });
  }
  getInputSpec() {
    const result = new InputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: Object.keys(this.CONVERSIONS),
      defaultValue: 'String'
    });
    result.addOption(context);

    context.choices.forEach(choice => {
      this.CONVERSIONS[choice].addOptionsToSpec(context.specs[choice]);
    });

    return result;
  }
  potentiallyExecutableOnItem(item) {
    return Object.values(this.CONVERSIONS).some(conversion => {
      return conversion.canExecuteOnInstance(item);
    });
  }
  async canExecuteOnInstance(item, inputOptions) {
    if (await super.canExecuteOnInstance(item, inputOptions)) {
      return true;
    }
    const conversion = this.CONVERSIONS[inputOptions.context];
    return conversion && conversion.canExecuteOnInstance(item, inputOptions);
  }
  async executeOnInstance(item, inputOptions) {
    const output = new OutputSpec();
    const conversion = this.CONVERSIONS[inputOptions.context];
    if (!conversion) {
      output.warn(`Unknown context for conversion: ${inputOptions.context}`);
    } else {
      conversion.convertItem(item, inputOptions, output);
      output.flagPollutedDoc(item.doc);
    }
    return output;
  }
}

class TypedOption extends InputOption {
  constructor({
    parameterName,
    defaultValue,
    choices,
    validTypes = [],
    suggestOrphans = false
  }) {
    super({
      parameterName,
      defaultValue,
      choices,
      openEnded: false
    });
    this.validTypes = validTypes;
    this.suggestOrphans = suggestOrphans;
  }
  async updateChoices({ items, inputOptions, reset = false }) {
    const itemLookup = {};
    const orphanLookup = {};
    if (!reset) {
      this.choices.forEach(choice => {
        itemLookup[choice.uniqueSelector] = choice;
      });
    }
    Object.values(items).forEach(item => {
      if (this.validTypes.indexOf(item.constructor) !== -1) {
        itemLookup[item.uniqueSelector] = item;
      }
      if (this.suggestOrphans && item.doc && !orphanLookup[item.doc._id]) {
        orphanLookup[item.doc._id] = new ContainerWrapper({
          mure: this.mure,
          value: item.doc.orphans,
          path: [item.path[0], 'orphans'],
          doc: item.doc
        });
      }
    });
    this.choices = Object.values(itemLookup).concat(Object.values(orphanLookup));
  }
}

class AttributeOption extends StringOption {
  async populateFromItem(item, attributes) {
    if (item.getAttributes) {
      (await item.getAttributes()).forEach(attr => {
        attributes[attr] = true;
      });
    }
  }
  async populateFromItems(items, attributes) {
    return Promise.all(Object.values(items).map(item => {
      return this.populateFromItem(item, attributes);
    }));
  }
  async updateChoices({ items, inputOptions, reset = false }) {
    let attributes = {};
    if (!reset) {
      this.populateExistingChoiceStrings(attributes);
    }
    await this.populateFromItems(items, attributes);
    this.choices = Object.keys(attributes);
    this.choices.unshift(null); // null indicates that the item's label should be used
  }
}

class NestedAttributeOption extends AttributeOption {
  constructor({ parameterName, defaultValue, choices, openEnded, getItemChoiceRole }) {
    super({ parameterName, defaultValue, choices, openEnded });
    this.getItemChoiceRole = getItemChoiceRole;
  }
  async updateChoices({ items, inputOptions, reset = false }) {
    let attributes = {};
    if (!reset) {
      this.populateExistingChoiceStrings(attributes);
    }
    const itemList = Object.values(items);
    for (let i = 0; i < itemList.length; i++) {
      const item = itemList[i];
      const itemRole = this.getItemChoiceRole(item, inputOptions);
      if (itemRole === 'standard') {
        await this.populateFromItem(item, attributes);
      } else if (itemRole === 'deep') {
        const children = item.getMembers ? await item.getMembers() : item.getContents ? item.getContents() : {};
        await this.populateFromItems(children, attributes);
      } // else if (itemRole === 'ignore')
    }
    this.choices = Object.keys(attributes);
    this.choices.unshift(null); // null indicates that the item's label should be used
  }
}

const DEFAULT_CONNECT_WHEN = 'return source.label === target.label;';

class ConnectOperation extends BaseOperation {
  getInputSpec() {
    const result = super.getInputSpec();

    // Do we connect nodes in the current selection, or to the nodes inside some
    // set-like construct?
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Within Selection', 'Bipartite'],
      hiddenChoices: ['Target Container'],
      defaultValue: 'Within Selection'
    });
    result.addOption(context);

    // For some contexts, we need to specify source and/or target documents,
    // items, or sets (classes or groups)
    context.specs['Bipartite'].addOption(new TypedOption({
      parameterName: 'sources',
      validTypes: [this.mure.WRAPPERS.DocumentWrapper, this.mure.WRAPPERS.ContainerWrapper, this.mure.WRAPPERS.SetWrapper, this.mure.WRAPPERS.SupernodeWrapper, Selection]
    }));
    const targets = new TypedOption({
      parameterName: 'targets',
      validTypes: [this.mure.WRAPPERS.DocumentWrapper, this.mure.WRAPPERS.ContainerWrapper, this.mure.WRAPPERS.SetWrapper, this.mure.WRAPPERS.SupernodeWrapper, Selection]
    });
    context.specs['Bipartite'].addOption(targets);
    context.specs['Target Container'].addOption(targets);

    // Edge direction
    const direction = new InputOption({
      parameterName: 'directed',
      choices: ['Undirected', 'Directed'],
      defaultValue: 'Undirected'
    });
    context.specs['Bipartite'].addOption(direction);
    context.specs['Target Container'].addOption(direction);

    // All contexts can be executed by matching attributes or evaluating
    // a function
    const mode = new ContextualOption({
      parameterName: 'mode',
      choices: ['Attribute', 'Function'],
      defaultValue: 'Attribute'
    });
    result.addOption(mode);

    // Attribute mode needs source and target attributes
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'sourceAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (item.equals(inputOptions.saveEdgesIn)) {
          return 'ignore';
        } else if (inputOptions.context === 'Bipartite') {
          if (inputOptions.sources && item.equals(inputOptions.sources)) {
            return 'deep';
          } else {
            return 'ignore';
          }
        } else if (inputOptions.targets && item.equals(inputOptions.targets)) {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'targetAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (item.equals(inputOptions.saveEdgesIn)) {
          return 'ignore';
        } else if (inputOptions.targets && item.equals(inputOptions.targets)) {
          return 'deep';
        } else if (inputOptions.context === 'Bipartite') {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));

    // Function mode needs the function
    mode.specs['Function'].addOption(new InputOption({
      parameterName: 'connectWhen',
      defaultValue: DEFAULT_CONNECT_WHEN,
      openEnded: true
    }));

    // Final option added to all context / modes: where to store the created
    // edges?
    result.addOption(new TypedOption({
      parameterName: 'saveEdgesIn',
      validTypes: [this.mure.WRAPPERS.ContainerWrapper],
      suggestOrphans: true
    }));

    return result;
  }
  async canExecuteOnInstance(item, inputOptions) {
    return false;
  }
  async executeOnInstance(item, inputOptions) {
    throw new Error(`Running the Connect operation on an instance is not supported.`);
  }
  async canExecuteOnSelection(selection, inputOptions) {
    if (inputOptions.ignoreErrors !== 'Stop on Error') {
      return true;
    }
    if (!(inputOptions.saveEdgesIn instanceof this.mure.WRAPPERS.ContainerWrapper)) {
      return false;
    }
    if (inputOptions.context === 'Bipartite') {
      if (!((inputOptions.sources instanceof this.mure.WRAPPERS.DocumentWrapper || inputOptions.sources instanceof this.mure.WRAPPERS.ContainerWrapper || inputOptions.sources instanceof this.mure.WRAPPERS.SetWrapper) && (inputOptions.targets instanceof this.mure.WRAPPERS.DocumentWrapper || inputOptions.targets instanceof this.mure.WRAPPERS.ContainerWrapper || inputOptions.targets instanceof this.mure.WRAPPERS.SetWrapper))) {
        return false;
      }
    } else if (inputOptions.context === 'Target Container') {
      if (!inputOptions.targets || !inputOptions.targets.items) {
        return false;
      }
      let items = await selection.items();
      let targetItems = await inputOptions.targets.items();
      return Object.values(items).some(item => item instanceof this.mure.WRAPPERS.NodeWrapper) && Object.values(targetItems).some(item => item instanceof this.mure.WRAPPERS.NodeWrapper);
    } else {
      // inputOptions.context === 'Within Selection'
      const items = await selection.items();
      let count = 0;
      const atLeastTwoNodes = Object.values(items).some(item => {
        if (item instanceof this.mure.WRAPPERS.NodeWrapper) {
          count += 1;
          if (count >= 2) {
            return true;
          }
        }
      });
      if (!atLeastTwoNodes) {
        return false;
      }
    }
    if (inputOptions.mode === 'Function') {
      if (typeof inputOptions.connectWhen === 'function') {
        return true;
      }
      try {
        Function('source', 'target', // eslint-disable-line no-new-func
        inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
        return true;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    } else {
      return inputOptions.sourceAttribute && inputOptions.targetAttribute;
    }
  }
  async executeWithinSelection(items, connectWhen, saveEdgesIn, output) {
    // We're only creating edges within the selection; we don't have to worry
    // about direction or the other set of nodes, but we do need to iterate in
    // a way that guarantees that we don't duplicate edges
    const sourceList = Object.values(items);
    for (let i = 0; i < sourceList.length; i++) {
      for (let j = i + 1; j < sourceList.length; j++) {
        if (connectWhen(sourceList[i], sourceList[j])) {
          const newEdge = sourceList[i].connectTo(sourceList[j], saveEdgesIn);
          output.addSelectors([newEdge.uniqueSelector]);
          output.flagPollutedDoc(sourceList[i].doc);
          output.flagPollutedDoc(sourceList[j].doc);
          output.flagPollutedDoc(newEdge.doc);
        }
      }
    }
    return output;
  }
  async executeOnSelection(selection, inputOptions) {
    const output = new OutputSpec();

    // Make sure we have a place to save the edges
    if (!(inputOptions.saveEdgesIn instanceof this.mure.WRAPPERS.ContainerWrapper)) {
      output.warn(`saveEdgesIn is not an Item`);
      return output;
    }

    // Figure out the criteria for matching nodes
    let connectWhen;
    if (inputOptions.mode === 'Function') {
      connectWhen = inputOptions.connectWhen;
      if (typeof connectWhen !== 'function') {
        try {
          connectWhen = new Function('source', 'target', // eslint-disable-line no-new-func
          inputOptions.connectWhen || DEFAULT_CONNECT_WHEN);
        } catch (err) {
          if (err instanceof SyntaxError) {
            output.warn(`connectWhen SyntaxError: ${err.message}`);
            return output;
          } else {
            throw err;
          }
        }
      }
    } else {
      // if (inputOptions.mode === 'Attribute')
      const getSourceValue = inputOptions.sourceAttribute === null ? source => source.label : source => source.value[inputOptions.sourceAttribute];
      const getTargetValue = inputOptions.targetAttribute === null ? target => target.label : target => target.value[inputOptions.targetAttribute];
      connectWhen = (source, target) => getSourceValue(source) === getTargetValue(target);
    }

    let sources;
    if (inputOptions.context === 'Bipartite') {
      if (inputOptions.sources instanceof Selection) {
        sources = await inputOptions.sources.items();
      } else if (inputOptions.sources instanceof this.mure.WRAPPERS.SetWrapper || inputOptions.sources instanceof this.mure.WRAPPERS.SupernodeWrapper) {
        sources = await inputOptions.sources.getMembers();
      } else if (inputOptions.sources instanceof this.mure.WRAPPERS.DocumentWrapper || inputOptions.sources instanceof this.mure.WRAPPERS.ContainerWrapper) {
        sources = inputOptions.sources.getContents();
      } else {
        output.warn(`inputOptions.sources is of unexpected type ${inputOptions.sources && inputOptions.sources.type}`);
        return output;
      }
    } else {
      sources = await selection.items();
    }

    const sourceList = Object.values(sources);
    if (sourceList.length === 0) {
      output.warn(`No sources supplied to connect operation`);
      return output;
    }

    // At this point we know enough to deal with 'Within Selection' mode:
    if (inputOptions.context === 'Within Selection') {
      return this.executeWithinSelection(sources, connectWhen, inputOptions.saveEdgesIn, output);
    }

    // What role are the source nodes playing ('undirected' vs 'source')?
    const direction = inputOptions.directed === 'Directed' ? 'source' : 'undirected';

    let targets;
    if (inputOptions.targets instanceof Selection) {
      targets = await inputOptions.targets.items();
    } else if (inputOptions.targets instanceof this.mure.WRAPPERS.SetWrapper || inputOptions.targets instanceof this.mure.WRAPPERS.SupernodeWrapper) {
      targets = await inputOptions.targets.getMembers();
    } else if (inputOptions.targets instanceof this.mure.WRAPPERS.ContainerWrapper || inputOptions.targets instanceof this.mure.WRAPPERS.DocumentWrapper) {
      targets = inputOptions.targets.getContents();
    } else {
      output.warn(`inputOptions.targets is of unexpected type ${inputOptions.targets && inputOptions.targets.type}`);
      return output;
    }

    const targetList = Object.values(targets);
    if (targetList.length === 0) {
      output.warn('No targets supplied to connect operation');
    }

    // Create the edges!
    sourceList.forEach(source => {
      targetList.forEach(target => {
        if (source instanceof this.mure.WRAPPERS.NodeWrapper && target instanceof this.mure.WRAPPERS.NodeWrapper && connectWhen(source, target)) {
          const newEdge = source.connectTo(target, inputOptions.saveEdgesIn, direction);
          output.addSelectors([newEdge.uniqueSelector]);
          output.flagPollutedDoc(source.doc);
          output.flagPollutedDoc(target.doc);
          output.flagPollutedDoc(newEdge.doc);
        }
      });
    });
    return output;
  }
}

const DEFAULT_CONNECT_WHEN$1 = 'return edge.label === node.label;';

class AttachOperation extends BaseOperation {
  getInputSpec() {
    const result = super.getInputSpec();

    // Do we connect nodes in the current selection, or to the nodes inside some
    // set-like construct?
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['Within Selection', 'Bipartite'],
      hiddenChoices: ['Target Container'],
      defaultValue: 'Within Selection'
    });
    result.addOption(context);

    // For some contexts, we need to specify edge and/or node documents,
    // items, or sets (classes or groups)
    context.specs['Bipartite'].addOption(new TypedOption({
      parameterName: 'edges',
      validTypes: [this.mure.WRAPPERS.DocumentWrapper, this.mure.WRAPPERS.ContainerWrapper, this.mure.WRAPPERS.SetWrapper, this.mure.WRAPPERS.SupernodeWrapper, Selection]
    }));
    const nodes = new TypedOption({
      parameterName: 'nodes',
      validTypes: [this.mure.WRAPPERS.DocumentWrapper, this.mure.WRAPPERS.ContainerWrapper, this.mure.WRAPPERS.SetWrapper, this.mure.WRAPPERS.SupernodeWrapper, Selection]
    });
    context.specs['Bipartite'].addOption(nodes);
    context.specs['Target Container'].addOption(nodes);

    // Edge direction
    result.addOption(new InputOption({
      parameterName: 'direction',
      choices: ['undirected', 'source', 'target'],
      defaultValue: 'undirected'
    }));

    // All contexts can be executed by matching attributes or evaluating
    // a function
    const mode = new ContextualOption({
      parameterName: 'mode',
      choices: ['Attribute', 'Function'],
      defaultValue: 'Attribute'
    });
    result.addOption(mode);

    // Attribute mode needs edge and node attributes
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'edgeAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (inputOptions.context === 'Bipartite') {
          if (inputOptions.edges && item.equals(inputOptions.edges)) {
            return 'deep';
          } else {
            return 'ignore';
          }
        } else if (inputOptions.nodes && item.equals(inputOptions.nodes)) {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));
    mode.specs['Attribute'].addOption(new NestedAttributeOption({
      parameterName: 'nodeAttribute',
      defaultValue: null, // null indicates that the label should be used
      getItemChoiceRole: (item, inputOptions) => {
        if (inputOptions.nodes && item.equals(inputOptions.nodes)) {
          return 'deep';
        } else if (inputOptions.context === 'Bipartite') {
          return 'ignore';
        } else {
          return 'standard';
        }
      }
    }));

    // Function mode needs the function
    mode.specs['Function'].addOption(new InputOption({
      parameterName: 'connectWhen',
      defaultValue: DEFAULT_CONNECT_WHEN$1,
      openEnded: true
    }));

    return result;
  }
  async canExecuteOnInstance(item, inputOptions) {
    return false;
  }
  async executeOnInstance(item, inputOptions) {
    throw new Error(`Running the Attach operation on an instance is not supported.`);
  }
  async canExecuteOnSelection(selection, inputOptions) {
    if (inputOptions.ignoreErrors !== 'Stop on Error') {
      return true;
    }
    if (inputOptions.context === 'Bipartite') {
      if (!((inputOptions.edges instanceof this.mure.WRAPPERS.DocumentWrapper || inputOptions.edges instanceof this.mure.WRAPPERS.ContainerWrapper || inputOptions.edges instanceof this.mure.WRAPPERS.SetWrapper) && (inputOptions.nodes instanceof this.mure.WRAPPERS.DocumentWrapper || inputOptions.nodes instanceof this.mure.WRAPPERS.ContainerWrapper || inputOptions.nodes instanceof this.mure.WRAPPERS.SetWrapper))) {
        return false;
      }
    } else if (inputOptions.context === 'Target Container') {
      if (!inputOptions.nodes || !inputOptions.nodes.items) {
        return false;
      }
      let edgeItems = await selection.items();
      let nodeItems = await inputOptions.nodes.items();
      return Object.values(edgeItems).some(item => item instanceof this.mure.WRAPPERS.EdgeWrapper) && Object.values(nodeItems).some(item => item instanceof this.mure.WRAPPERS.NodeWrapper);
    } else {
      // inputOptions.context === 'Within Selection'
      const edgeItems = await selection.items();
      let oneNode = false;
      let oneEdge = false;
      return Object.values(edgeItems).some(item => {
        if (item instanceof this.mure.WRAPPERS.NodeWrapper) {
          oneNode = true;
        } else if (item instanceof this.mure.WRAPPERS.EdgeWrapper) {
          oneEdge = true;
        }
        return oneNode && oneEdge;
      });
    }
    if (inputOptions.mode === 'Function') {
      if (typeof inputOptions.connectWhen === 'function') {
        return true;
      }
      try {
        Function('edge', 'node', // eslint-disable-line no-new-func
        inputOptions.connectWhen || DEFAULT_CONNECT_WHEN$1);
        return true;
      } catch (err) {
        if (err instanceof SyntaxError) {
          return false;
        } else {
          throw err;
        }
      }
    } else {
      return inputOptions.edgeAttribute && inputOptions.nodeAttribute;
    }
  }
  async executeWithinSelection(items, connectWhen, direction, output) {
    // Within the selection, we only know which ones are edges and which ones
    // are nodes on the fly
    const itemList = Object.values(items);
    for (let i = 0; i < itemList.length; i++) {
      for (let j = i + 1; j < itemList.length; j++) {
        let edge = itemList[i] instanceof this.mure.WRAPPERS.EdgeWrapper && itemList[i] || itemList[j] instanceof this.mure.WRAPPERS.EdgeWrapper && itemList[j];
        let node = itemList[i] instanceof this.mure.WRAPPERS.NodeWrapper && itemList[i] || itemList[j] instanceof this.mure.WRAPPERS.NodeWrapper && itemList[j];
        if (edge && node && connectWhen(edge, node)) {
          edge.attachTo(node, direction);
          output.flagPollutedDoc(edge.doc);
          output.flagPollutedDoc(node.doc);
        }
      }
    }
    return output;
  }
  async executeOnSelection(selection, inputOptions) {
    const output = new OutputSpec();

    // Figure out the criteria for matching nodes
    let connectWhen;
    if (inputOptions.mode === 'Function') {
      connectWhen = inputOptions.connectWhen;
      if (typeof connectWhen !== 'function') {
        try {
          connectWhen = new Function('edge', 'node', // eslint-disable-line no-new-func
          inputOptions.connectWhen || DEFAULT_CONNECT_WHEN$1);
        } catch (err) {
          if (err instanceof SyntaxError) {
            output.warn(`connectWhen SyntaxError: ${err.message}`);
            return output;
          } else {
            throw err;
          }
        }
      }
    } else {
      // if (inputOptions.mode === 'Attribute')
      const getEdgeValue = inputOptions.edgeAttribute === null ? edge => edge.label : edge => edge.value[inputOptions.edgeAttribute];
      const getNodeValue = inputOptions.nodeAttribute === null ? node => node.label : node => node.value[inputOptions.nodeAttribute];
      connectWhen = (edge, node) => getEdgeValue(edge) === getNodeValue(node);
    }

    let edges;
    if (inputOptions.context === 'Bipartite') {
      if (inputOptions.edges instanceof this.mure.WRAPPERS.SetWrapper || inputOptions.edges instanceof this.mure.WRAPPERS.SupernodeWrapper) {
        edges = await inputOptions.edges.getMembers();
      } else if (inputOptions.edges instanceof this.mure.WRAPPERS.DocumentWrapper || inputOptions.edges instanceof this.mure.WRAPPERS.ContainerWrapper) {
        edges = inputOptions.edges.getContents();
      } else {
        output.warn(`inputOptions.edges is of unexpected type ${inputOptions.edges && inputOptions.edges.type}`);
        return output;
      }
    } else {
      edges = await selection.items();
    }

    let edgeList = Object.values(edges);
    if (edgeList.length === 0) {
      output.warn(`No edges supplied to attach operation`);
      return output;
    }

    // At this point we know enough to deal with 'Within Selection' mode:
    if (inputOptions.context === 'Within Selection') {
      return this.executeWithinSelection(edges, connectWhen, inputOptions.direction, output);
    }

    let nodes;
    if (inputOptions.nodes instanceof Selection) {
      nodes = await inputOptions.nodes.items();
    } else if (inputOptions.nodes instanceof this.mure.WRAPPERS.SetWrapper || inputOptions.nodes instanceof this.mure.WRAPPERS.SupernodeWrapper) {
      nodes = await inputOptions.nodes.getMembers();
    } else if (inputOptions.nodes instanceof this.mure.WRAPPERS.ContainerWrapper || inputOptions.nodes instanceof this.mure.WRAPPERS.DocumentWrapper) {
      nodes = inputOptions.nodes.getContents();
    } else {
      output.warn(`inputOptions.nodes is of unexpected type ${inputOptions.nodes && inputOptions.nodes.type}`);
      return output;
    }

    const nodeList = Object.values(nodes);
    if (nodeList.length === 0) {
      output.warn('No nodes supplied to attach operation');
    }

    // Attach the edges!
    edgeList.forEach(edge => {
      nodeList.forEach(node => {
        if (edge instanceof this.mure.WRAPPERS.EdgeWrapper && node instanceof this.mure.WRAPPERS.NodeWrapper && connectWhen(edge, node)) {
          edge.attachTo(node, inputOptions.direction);
          output.flagPollutedDoc(edge.doc);
          output.flagPollutedDoc(node.doc);
        }
      });
    });
    return output;
  }
}

class AssignClassOperation extends BaseOperation {
  getInputSpec() {
    const result = super.getInputSpec();
    const context = new ContextualOption({
      parameterName: 'context',
      choices: ['String', 'Attribute'],
      defaultValue: 'String'
    });
    result.addOption(context);
    context.specs['String'].addOption(new ClassOption({
      parameterName: 'className',
      openEnded: true
    }));
    context.specs['Attribute'].addOption(new AttributeOption({
      parameterName: 'attribute'
    }));

    return result;
  }
  potentiallyExecutableOnItem(item) {
    return item instanceof this.mure.WRAPPERS.GenericWrapper;
  }
  async canExecuteOnInstance(item, inputOptions) {
    return (await super.canExecuteOnInstance(item, inputOptions)) || item instanceof this.mure.WRAPPERS.GenericWrapper;
  }
  async executeOnInstance(item, inputOptions) {
    const output = new OutputSpec();
    let className = inputOptions.className;
    if (!inputOptions.className) {
      if (!inputOptions.attribute) {
        output.warn(`No className or attribute option supplied`);
        return output;
      }
      if (item.getValue) {
        className = await item.getValue(inputOptions.attribute);
      } else {
        output.warn(`Can't get attributes from ${item.type} instance`);
        return output;
      }
      if (!className) {
        output.warn(`${item.type} instance missing attribute ${inputOptions.attribute}`);
        return output;
      }
    }
    if (!item.addClass) {
      output.warn(`Can't assign class to non-taggable ${item.type}`);
    } else {
      item.addClass(className);
      output.flagPollutedDoc(item.doc);
    }
    return output;
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
    this.WRAPPERS = {
      RootWrapper,
      DocumentWrapper,
      PrimitiveWrapper,
      InvalidWrapper,
      NullWrapper,
      BooleanWrapper,
      NumberWrapper,
      StringWrapper,
      DateWrapper,
      ReferenceWrapper,
      ContainerWrapper,
      GenericWrapper,
      SetWrapper,
      EdgeWrapper,
      NodeWrapper,
      SupernodeWrapper
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

    // Auto-mappings from native javascript types to Wrappers
    this.JSTYPES = {
      'null': NullWrapper,
      'boolean': BooleanWrapper,
      'number': NumberWrapper
    };

    // All the supported operations
    let operationClasses = [SelectAllOperation, FilterOperation, ConvertOperation, ConnectOperation, AttachOperation, AssignClassOperation];
    this.OPERATIONS = {};

    // Unlike WRAPPERS, we actually want to instantiate all the operations
    // with a reference to this. While we're at it, monkey patch them onto
    // the Selection class
    operationClasses.forEach(Operation => {
      const temp = new Operation(this);
      this.OPERATIONS[temp.type] = temp;
      Selection.prototype[temp.lowerCamelCaseType] = async function (inputOptions) {
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
  async allDocWrappers() {
    return (await this.allDocs()).map(doc => new this.WRAPPERS.DocumentWrapper({ mure: this, doc }));
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
      return this.WRAPPERS.DocumentWrapper.launchStandardization({ doc: {}, mure: this });
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
          doc = await this.WRAPPERS.DocumentWrapper.launchStandardization({ doc: docQuery, mure: this });
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
      return err;
    }
  }
  async putDocs(docList) {
    await this.dbStatus;
    // PouchDB doesn't support transactions, so we want to be able to roll back
    // any changes in the event that our update fails
    const previousDocs = (await this.db.find({
      selector: { '$or': docList.map(doc => {
          return { _id: doc._id };
        }) }
    })).docs;
    const result = await this.db.bulkDocs(docList);
    let newRevs = {};
    let errorMessages = {};
    let errorSeen = false;
    result.forEach(resultObj => {
      if (resultObj.error) {
        errorSeen = true;
        errorMessages[resultObj.message] = errorMessages[resultObj.message] || [];
        errorMessages[resultObj.message].push(resultObj.id);
      } else {
        newRevs[resultObj.id] = resultObj.rev;
      }
    });
    if (errorSeen) {
      // We need to revert any documents that were successful
      const revertedDocs = previousDocs.filter(doc => {
        if (newRevs[doc._id]) {
          doc._rev = newRevs[doc._id];
          return true;
        } else {
          return false;
        }
      });
      // TODO: what if THIS fails?
      await this.db.bulkDocs(revertedDocs);
      const error = new Error(Object.entries(errorMessages).map(([message, ids]) => {
        return `${message}\nAffected Documents:\n  ${ids.join('\n  ')}`;
      }).join('\n\n'));
      error.error = true;
      return error;
    }
    return result;
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
      let contents = this.WRAPPERS.DocumentWrapper.formatDoc(doc, { mimeType });

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
    let doc = await this.WRAPPERS.DocumentWrapper.parse(string, extension);
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc(filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType;
    doc.charset = encoding || doc.charset;
    doc = await this.WRAPPERS.DocumentWrapper.launchStandardization({ doc, mure: this });
    if (!(await this.putDoc(doc)).ok) {
      return null;
    } else {
      return this.selectAll(`@{"_id":"${doc._id}"}$`);
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
    return this.selectAll('@{"_id":"' + docId + '"}$');
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
  parseSelector(selectorString) {
    let chunks = /@\s*({.*})?\s*(\$[^↑→]*)?\s*(↑*)\s*(→)?(.*)/.exec(selectorString);
    if (!chunks || chunks[5]) {
      return null;
    }
    let parsedDocQuery = chunks[1] ? JSON.parse(chunks[1].trim()) : JSON.parse(Selection.DEFAULT_DOC_QUERY);
    return {
      docQuery: chunks[1] ? chunks[1].trim() : Selection.DEFAULT_DOC_QUERY,
      parsedDocQuery,
      objQuery: chunks[2] ? chunks[2].trim() : '',
      parentShift: chunks[3] ? chunks[3].length : 0,
      followLinks: !!chunks[4]
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
      // Attempt to parse as a reference
      if (value[0] === '@' && this.parseSelector(value) !== null) {
        return this.WRAPPERS.ReferenceWrapper;
      }
      // Not a reference...
      if (aggressive) {
        // Aggressively attempt to identify something more specific than string
        if (!isNaN(Number(value))) {
          return this.WRAPPERS.NumberWrapper;
          /*
           For now, we don't attempt to identify dates, even in aggressive mode,
           because things like new Date('Player 1') will successfully parse as a
           date. If we can find smarter ways to auto-infer dates (e.g. does the
           value fall suspiciously near the unix epoch, y2k, or more than +/-500
           years from now? Do sibling container items parse this as a date?), then
           maybe we'll add this back...
          */
          // } else if (!isNaN(new Date(value))) {
          //  return WRAPPERS.DateWrapper;
        } else {
          const temp = value.toLowerCase();
          if (temp === 'true') {
            return this.WRAPPERS.BooleanWrapper;
          } else if (temp === 'false') {
            return this.WRAPPERS.BooleanWrapper;
          } else if (temp === 'null') {
            return this.WRAPPERS.NullWrapper;
          }
        }
      }
      // Okay, it's just a string
      return this.WRAPPERS.StringWrapper;
    } else if (jsType === 'function' || jsType === 'symbol' || jsType === 'undefined' || value instanceof Array) {
      return this.WRAPPERS.InvalidWrapper;
    } else if (value === null) {
      return this.WRAPPERS.NullWrapper;
    } else if (value instanceof Date || value.$isDate === true) {
      return this.WRAPPERS.DateWrapper;
    } else if (value.$nodes) {
      return this.WRAPPERS.EdgeWrapper;
    } else if (value.$edges) {
      if (value.$members) {
        return this.WRAPPERS.SupernodeWrapper;
      } else {
        return this.WRAPPERS.NodeWrapper;
      }
    } else if (value.$members) {
      return this.WRAPPERS.SetWrapper;
    } else if (value.$tags) {
      return this.WRAPPERS.GenericWrapper;
    } else {
      return this.WRAPPERS.ContainerWrapper;
    }
  }
  async followRelativeLink(selector, doc) {
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
      tempSelection = new Selection(this, selector);
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
var version = "0.4.1";
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
	test: "jest",
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
	"d3-node": "^2.0.1",
	jest: "^23.4.1",
	"pouchdb-node": "^7.0.0",
	rollup: "^0.63.4",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.3",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	"blueimp-md5": "^2.10.0",
	datalib: "^1.9.1",
	jsonpath: "^1.0.0",
	"mime-types": "^2.1.19",
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
d3n.window.localStorage = { getItem: () => null };

let PouchDB = require('pouchdb-node').plugin(require('pouchdb-find')).plugin(require('pouchdb-authentication'));

let mure = new Mure(PouchDB, d3n.d3, d3n);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TZWxlY3Rpb24uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0Jhc2VXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1Jvb3RXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1R5cGVkV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Db250YWluZXJXcmFwcGVyTWl4aW4uanMiLCIuLi9zcmMvV3JhcHBlcnMvQ29udGFpbmVyV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Eb2N1bWVudFdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvUHJpbWl0aXZlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9JbnZhbGlkV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9OdWxsV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Cb29sZWFuV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9OdW1iZXJXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1N0cmluZ1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRGF0ZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvUmVmZXJlbmNlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9TZXRXcmFwcGVyTWl4aW4uanMiLCIuLi9zcmMvV3JhcHBlcnMvU2V0V3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9TdXBlcm5vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL0lucHV0U3BlYy5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9JbnB1dE9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9PdXRwdXRTcGVjLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL1NlbGVjdEFsbE9wZXJhdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9TdHJpbmdPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQ2xhc3NPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9GaWx0ZXJPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9CYXNlQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnNpb25zL051bGxDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvQm9vbGVhbkNvbnZlcnNpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9OdW1iZXJDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvU3RyaW5nQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnNpb25zL0dlbmVyaWNDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvTm9kZUNvbnZlcnNpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9FZGdlQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnRPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vVHlwZWRPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQXR0cmlidXRlT3B0aW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL05lc3RlZEF0dHJpYnV0ZU9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0Nvbm5lY3RPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9BdHRhY2hPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Bc3NpZ25DbGFzc09wZXJhdGlvbi5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGpzb25QYXRoIGZyb20gJ2pzb25wYXRoJztcbmltcG9ydCB7IHF1ZXVlQXN5bmMgfSBmcm9tICd1a2knO1xuaW1wb3J0IG1kNSBmcm9tICdibHVlaW1wLW1kNSc7XG5cbmNvbnN0IERFRkFVTFRfRE9DX1FVRVJZID0gJ3tcIl9pZFwiOntcIiRndFwiOlwiX1xcdWZmZmZcIn19JztcblxuY2xhc3MgU2VsZWN0aW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUsIHNlbGVjdG9yTGlzdCA9IFsnQCcgKyBERUZBVUxUX0RPQ19RVUVSWV0pIHtcbiAgICBpZiAoIShzZWxlY3Rvckxpc3QgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHNlbGVjdG9yTGlzdCA9IFsgc2VsZWN0b3JMaXN0IF07XG4gICAgfVxuICAgIHRoaXMuc2VsZWN0b3JzID0gc2VsZWN0b3JMaXN0Lm1hcChzZWxlY3RvclN0cmluZyA9PiB7XG4gICAgICBjb25zdCBzZWxlY3RvciA9IG11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvclN0cmluZyk7XG4gICAgICBpZiAoc2VsZWN0b3IgPT09IG51bGwpIHtcbiAgICAgICAgbGV0IGVyciA9IG5ldyBFcnJvcignSW52YWxpZCBzZWxlY3RvcjogJyArIHNlbGVjdG9yU3RyaW5nKTtcbiAgICAgICAgZXJyLklOVkFMSURfU0VMRUNUT1IgPSB0cnVlO1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgfSk7XG5cbiAgICAvLyBUT0RPOiBvcHRpbWl6ZSBhbmQgc29ydCB0aGlzLnNlbGVjdG9ycyBmb3IgYmV0dGVyIGhhc2ggZXF1aXZhbGVuY2VcblxuICAgIHRoaXMubXVyZSA9IG11cmU7XG4gIH1cbiAgZ2V0IGhhc2ggKCkge1xuICAgIGlmICghdGhpcy5faGFzaCkge1xuICAgICAgdGhpcy5faGFzaCA9IG1kNShKU09OLnN0cmluZ2lmeSh0aGlzLnNlbGVjdG9yTGlzdCkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5faGFzaDtcbiAgfVxuICBnZXQgc2VsZWN0b3JMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RvcnMubWFwKHNlbGVjdG9yID0+IHtcbiAgICAgIHJldHVybiAnQCcgKyBzZWxlY3Rvci5kb2NRdWVyeSArIHNlbGVjdG9yLm9ialF1ZXJ5ICtcbiAgICAgICAgQXJyYXkuZnJvbShBcnJheShzZWxlY3Rvci5wYXJlbnRTaGlmdCkpLm1hcChkID0+ICfihpEnKS5qb2luKCcnKSArXG4gICAgICAgIChzZWxlY3Rvci5mb2xsb3dMaW5rcyA/ICfihpInIDogJycpO1xuICAgIH0pO1xuICB9XG4gIGdldCBpc0NhY2hlZCAoKSB7XG4gICAgcmV0dXJuICEhdGhpcy5fY2FjaGVkV3JhcHBlcnM7XG4gIH1cbiAgaW52YWxpZGF0ZUNhY2hlICgpIHtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkRG9jTGlzdHM7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlZFdyYXBwZXJzO1xuICAgIGRlbGV0ZSB0aGlzLl9zdW1tYXJ5Q2FjaGVzO1xuICB9XG4gIGFzeW5jIGRvY0xpc3RzICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkRG9jTGlzdHMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWREb2NMaXN0cztcbiAgICB9XG4gICAgdGhpcy5fY2FjaGVkRG9jTGlzdHMgPSBhd2FpdCBQcm9taXNlLmFsbCh0aGlzLnNlbGVjdG9yc1xuICAgICAgLm1hcChkID0+IHRoaXMubXVyZS5xdWVyeURvY3MoeyBzZWxlY3RvcjogZC5wYXJzZWREb2NRdWVyeSB9KSkpO1xuICAgIC8vIFdlIHdhbnQgYWxsIHNlbGVjdGlvbnMgdG8gb3BlcmF0ZSBmcm9tIGV4YWN0bHkgdGhlIHNhbWUgZG9jdW1lbnQgb2JqZWN0LFxuICAgIC8vIHNvIGl0J3MgZWFzeSAvIHN0cmFpZ2h0Zm9yd2FyZCBmb3IgV3JhcHBlcnMgdG8ganVzdCBtdXRhdGUgdGhlaXIgb3duIHZhbHVlXG4gICAgLy8gcmVmZXJlbmNlcywgYW5kIGhhdmUgdGhvc2UgY2hhbmdlcyBhdXRvbWF0aWNhbGx5IGFwcGVhciBpbiBkb2N1bWVudHNcbiAgICAvLyB3aGVuIHRoZXkncmUgc2F2ZWQuLi4gc28gd2UgYWN0dWFsbHkgd2FudCB0byAqc3dhcCBvdXQqIG1hdGNoaW5nIGRvY3VtZW50c1xuICAgIC8vIGZvciB0aGVpciBjYWNoZWQgdmVyc2lvbnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NhY2hlZERvY0xpc3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuX2NhY2hlZERvY0xpc3RzW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGNvbnN0IGRvYyA9IHRoaXMuX2NhY2hlZERvY0xpc3RzW2ldW2pdO1xuICAgICAgICBpZiAoU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdKSB7XG4gICAgICAgICAgaWYgKFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2MuX2lkXS5zZWxlY3Rpb25zLmluZGV4T2YodGhpcykgPT09IC0xKSB7XG4gICAgICAgICAgICAvLyBSZWdpc3RlciBhcyBhIHNlbGVjdGlvbiB0aGF0J3MgdXNpbmcgdGhpcyBjYWNoZSwgc28gd2UncmVcbiAgICAgICAgICAgIC8vIG5vdGlmaWVkIGluIHRoZSBldmVudCB0aGF0IGl0IGdldHMgaW52YWxpZGF0ZWRcbiAgICAgICAgICAgIFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2MuX2lkXS5zZWxlY3Rpb25zLnB1c2godGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFZlcmlmeSB0aGF0IHRoZSBkb2MgaGFzIG5vdCBjaGFuZ2VkICh3ZSB3YXRjaCBmb3IgY2hhbmdlcyBhbmRcbiAgICAgICAgICAvLyBpbnZhbGlkYXRlIGNhY2hlcyBpbiBtdXJlLmdldE9ySW5pdERiLCBzbyB0aGlzIHNob3VsZCBuZXZlciBoYXBwZW4pXG4gICAgICAgICAgaWYgKGRvYy5fcmV2ICE9PSBTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jLl9pZF0uY2FjaGVkRG9jLl9yZXYpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2FjaGVkIGRvY3VtZW50IF9yZXYgY2hhbmdlZCB3aXRob3V0IG5vdGlmaWNhdGlvbicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTd2FwIGZvciB0aGUgY2FjaGVkIHZlcnNpb25cbiAgICAgICAgICB0aGlzLl9jYWNoZWREb2NMaXN0c1tpXVtqXSA9IFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2MuX2lkXS5jYWNoZWREb2M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gV2UncmUgdGhlIGZpcnN0IG9uZSB0byBjYWNoZSB0aGlzIGRvY3VtZW50LCBzbyB1c2Ugb3Vyc1xuICAgICAgICAgIFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2MuX2lkXSA9IHtcbiAgICAgICAgICAgIHNlbGVjdGlvbnM6IFt0aGlzXSxcbiAgICAgICAgICAgIGNhY2hlZERvYzogZG9jXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVkRG9jTGlzdHM7XG4gIH1cbiAgYXN5bmMgaXRlbXMgKGRvY0xpc3RzKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlZFdyYXBwZXJzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVkV3JhcHBlcnM7XG4gICAgfVxuXG4gICAgLy8gTm90ZTogd2Ugc2hvdWxkIG9ubHkgcGFzcyBpbiBkb2NMaXN0cyBpbiByYXJlIHNpdHVhdGlvbnMgKHN1Y2ggYXMgdGhlXG4gICAgLy8gb25lLW9mZiBjYXNlIGluIGZvbGxvd1JlbGF0aXZlTGluaygpIHdoZXJlIHdlIGFscmVhZHkgaGF2ZSB0aGUgZG9jdW1lbnRcbiAgICAvLyBhdmFpbGFibGUsIGFuZCBjcmVhdGluZyB0aGUgbmV3IHNlbGVjdGlvbiB3aWxsIHJlc3VsdCBpbiBhbiB1bm5uZWNlc3NhcnlcbiAgICAvLyBxdWVyeSBvZiB0aGUgZGF0YWJhc2UpLiBVc3VhbGx5LCB3ZSBzaG91bGQgcmVseSBvbiB0aGUgY2FjaGUuXG4gICAgZG9jTGlzdHMgPSBkb2NMaXN0cyB8fCBhd2FpdCB0aGlzLmRvY0xpc3RzKCk7XG5cbiAgICByZXR1cm4gcXVldWVBc3luYyhhc3luYyAoKSA9PiB7XG4gICAgICAvLyBDb2xsZWN0IHRoZSByZXN1bHRzIG9mIG9ialF1ZXJ5XG4gICAgICB0aGlzLl9jYWNoZWRXcmFwcGVycyA9IHt9O1xuICAgICAgY29uc3QgYWRkV3JhcHBlciA9IGl0ZW0gPT4ge1xuICAgICAgICBpZiAoIXRoaXMuX2NhY2hlZFdyYXBwZXJzW2l0ZW0udW5pcXVlU2VsZWN0b3JdKSB7XG4gICAgICAgICAgdGhpcy5fY2FjaGVkV3JhcHBlcnNbaXRlbS51bmlxdWVTZWxlY3Rvcl0gPSBpdGVtO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5zZWxlY3RvcnMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcnNbaW5kZXhdO1xuICAgICAgICBjb25zdCBkb2NMaXN0ID0gZG9jTGlzdHNbaW5kZXhdO1xuXG4gICAgICAgIGlmIChzZWxlY3Rvci5vYmpRdWVyeSA9PT0gJycpIHtcbiAgICAgICAgICAvLyBObyBvYmpRdWVyeSBtZWFucyB0aGF0IHdlIHdhbnQgYSB2aWV3IG9mIG11bHRpcGxlIGRvY3VtZW50cyAob3RoZXJcbiAgICAgICAgICAvLyBzaGVuYW5pZ2FucyBtZWFuIHdlIHNob3VsZG4ndCBzZWxlY3QgYW55dGhpbmcpXG4gICAgICAgICAgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSAwICYmICFzZWxlY3Rvci5mb2xsb3dMaW5rcykge1xuICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLlJvb3RXcmFwcGVyKHtcbiAgICAgICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgICAgICBkb2NMaXN0XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdG9yLm9ialF1ZXJ5ID09PSAnJCcpIHtcbiAgICAgICAgICAvLyBTZWxlY3RpbmcgdGhlIGRvY3VtZW50cyB0aGVtc2VsdmVzXG4gICAgICAgICAgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSAwICYmICFzZWxlY3Rvci5mb2xsb3dMaW5rcykge1xuICAgICAgICAgICAgZG9jTGlzdC5mb3JFYWNoKGRvYyA9PiB7XG4gICAgICAgICAgICAgIGFkZFdyYXBwZXIobmV3IHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIoe1xuICAgICAgICAgICAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgICAgICAgICAgICBkb2NcbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChzZWxlY3Rvci5wYXJlbnRTaGlmdCA9PT0gMSkge1xuICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLlJvb3RXcmFwcGVyKHtcbiAgICAgICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgICAgICBkb2NMaXN0XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE9rYXksIHdlIG5lZWQgdG8gZXZhbHVhdGUgdGhlIGpzb25QYXRoXG4gICAgICAgICAgZm9yIChsZXQgZG9jSW5kZXggPSAwOyBkb2NJbmRleCA8IGRvY0xpc3QubGVuZ3RoOyBkb2NJbmRleCsrKSB7XG4gICAgICAgICAgICBsZXQgZG9jID0gZG9jTGlzdFtkb2NJbmRleF07XG4gICAgICAgICAgICBsZXQgbWF0Y2hpbmdXcmFwcGVycyA9IGpzb25QYXRoLm5vZGVzKGRvYywgc2VsZWN0b3Iub2JqUXVlcnkpO1xuICAgICAgICAgICAgZm9yIChsZXQgaXRlbUluZGV4ID0gMDsgaXRlbUluZGV4IDwgbWF0Y2hpbmdXcmFwcGVycy5sZW5ndGg7IGl0ZW1JbmRleCsrKSB7XG4gICAgICAgICAgICAgIGxldCB7IHBhdGgsIHZhbHVlIH0gPSBtYXRjaGluZ1dyYXBwZXJzW2l0ZW1JbmRleF07XG4gICAgICAgICAgICAgIGxldCBsb2NhbFBhdGggPSBwYXRoO1xuICAgICAgICAgICAgICBpZiAodGhpcy5tdXJlLlJFU0VSVkVEX09CSl9LRVlTW2xvY2FsUGF0aC5zbGljZSgtMSlbMF1dKSB7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgY3JlYXRlIGl0ZW1zIHVuZGVyIHJlc2VydmVkIGtleXNcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZWxlY3Rvci5wYXJlbnRTaGlmdCA9PT0gbG9jYWxQYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIHdlIHBhcmVudCBzaGlmdGVkIHVwIHRvIHRoZSByb290IGxldmVsXG4gICAgICAgICAgICAgICAgaWYgKCFzZWxlY3Rvci5mb2xsb3dMaW5rcykge1xuICAgICAgICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLlJvb3RXcmFwcGVyKHtcbiAgICAgICAgICAgICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgICAgICAgICAgICBkb2NMaXN0XG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSBsb2NhbFBhdGgubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIC8vIHdlIHBhcmVudCBzaGlmdGVkIHRvIHRoZSBkb2N1bWVudCBsZXZlbFxuICAgICAgICAgICAgICAgIGlmICghc2VsZWN0b3IuZm9sbG93TGlua3MpIHtcbiAgICAgICAgICAgICAgICAgIGFkZFdyYXBwZXIobmV3IHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIoe1xuICAgICAgICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPiAwICYmIHNlbGVjdG9yLnBhcmVudFNoaWZ0IDwgbG9jYWxQYXRoLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgIC8vIG5vcm1hbCBwYXJlbnRTaGlmdFxuICAgICAgICAgICAgICAgICAgbG9jYWxQYXRoLnNwbGljZShsb2NhbFBhdGgubGVuZ3RoIC0gc2VsZWN0b3IucGFyZW50U2hpZnQpO1xuICAgICAgICAgICAgICAgICAgdmFsdWUgPSBqc29uUGF0aC5xdWVyeShkb2MsIGpzb25QYXRoLnN0cmluZ2lmeShsb2NhbFBhdGgpKVswXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICAgICAgICAvLyBXZSAocG90ZW50aWFsbHkpIHNlbGVjdGVkIGEgbGluayB0aGF0IHdlIG5lZWQgdG8gZm9sbG93XG4gICAgICAgICAgICAgICAgICBPYmplY3QudmFsdWVzKGF3YWl0IHRoaXMubXVyZS5mb2xsb3dSZWxhdGl2ZUxpbmsodmFsdWUsIGRvYykpXG4gICAgICAgICAgICAgICAgICAgIC5mb3JFYWNoKGFkZFdyYXBwZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBXcmFwcGVyVHlwZSA9IHRoaXMubXVyZS5pbmZlclR5cGUodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgV3JhcHBlclR5cGUoe1xuICAgICAgICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBbYHtcIl9pZFwiOlwiJHtkb2MuX2lkfVwifWBdLmNvbmNhdChsb2NhbFBhdGgpLFxuICAgICAgICAgICAgICAgICAgICBkb2NcbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRXcmFwcGVycztcbiAgICB9KTtcbiAgfVxuICBhc3luYyBleGVjdXRlIChvcGVyYXRpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGxldCBvdXRwdXRTcGVjID0gYXdhaXQgb3BlcmF0aW9uLmV4ZWN1dGVPblNlbGVjdGlvbih0aGlzLCBpbnB1dE9wdGlvbnMpO1xuXG4gICAgY29uc3QgcG9sbHV0ZWREb2NzID0gT2JqZWN0LnZhbHVlcyhvdXRwdXRTcGVjLnBvbGx1dGVkRG9jcyk7XG5cbiAgICAvLyBXcml0ZSBhbnkgd2FybmluZ3MsIGFuZCwgZGVwZW5kaW5nIG9uIHRoZSB1c2VyJ3Mgc2V0dGluZ3MsIHNraXAgb3Igc2F2ZVxuICAgIC8vIHRoZSByZXN1bHRzXG4gICAgbGV0IHNraXBTYXZlID0gZmFsc2U7XG4gICAgaWYgKE9iamVjdC5rZXlzKG91dHB1dFNwZWMud2FybmluZ3MpLmxlbmd0aCA+IDApIHtcbiAgICAgIGxldCB3YXJuaW5nU3RyaW5nO1xuICAgICAgaWYgKG91dHB1dFNwZWMuaWdub3JlRXJyb3JzID09PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgICAgc2tpcFNhdmUgPSB0cnVlO1xuICAgICAgICB3YXJuaW5nU3RyaW5nID0gYCR7b3BlcmF0aW9uLmh1bWFuUmVhZGFibGVUeXBlfSBvcGVyYXRpb24gZmFpbGVkLlxcbmA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB3YXJuaW5nU3RyaW5nID0gYCR7b3BlcmF0aW9uLmh1bWFuUmVhZGFibGVUeXBlfSBvcGVyYXRpb24gZmluaXNoZWQgd2l0aCB3YXJuaW5nczpcXG5gO1xuICAgICAgfVxuICAgICAgd2FybmluZ1N0cmluZyArPSBPYmplY3QuZW50cmllcyhvdXRwdXRTcGVjLndhcm5pbmdzKS5tYXAoKFt3YXJuaW5nLCBjb3VudF0pID0+IHtcbiAgICAgICAgaWYgKGNvdW50ID4gMSkge1xuICAgICAgICAgIHJldHVybiBgJHt3YXJuaW5nfSAoeCR7Y291bnR9KWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGAke3dhcm5pbmd9YDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLm11cmUud2Fybih3YXJuaW5nU3RyaW5nKTtcbiAgICB9XG4gICAgbGV0IHNhdmVTdWNjZXNzZnVsID0gZmFsc2U7XG4gICAgaWYgKCFza2lwU2F2ZSkge1xuICAgICAgLy8gU2F2ZSB0aGUgcmVzdWx0c1xuICAgICAgY29uc3Qgc2F2ZVJlc3VsdCA9IGF3YWl0IHRoaXMubXVyZS5wdXREb2NzKHBvbGx1dGVkRG9jcyk7XG4gICAgICBzYXZlU3VjY2Vzc2Z1bCA9IHNhdmVSZXN1bHQuZXJyb3IgIT09IHRydWU7XG4gICAgICBpZiAoIXNhdmVTdWNjZXNzZnVsKSB7XG4gICAgICAgIC8vIFRoZXJlIHdhcyBhIHByb2JsZW0gc2F2aW5nIHRoZSByZXN1bHRcbiAgICAgICAgdGhpcy5tdXJlLndhcm4oc2F2ZVJlc3VsdC5tZXNzYWdlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBbnkgc2VsZWN0aW9uIHRoYXQgaGFzIGNhY2hlZCBhbnkgb2YgdGhlIGRvY3VtZW50cyB0aGF0IHdlIGFsdGVyZWRcbiAgICAvLyBuZWVkcyB0byBoYXZlIGl0cyBjYWNoZSBpbnZhbGlkYXRlZFxuICAgIHBvbGx1dGVkRG9jcy5mb3JFYWNoKGRvYyA9PiB7XG4gICAgICBTZWxlY3Rpb24uSU5WQUxJREFURV9ET0NfQ0FDSEUoZG9jLl9pZCk7XG4gICAgfSk7XG5cbiAgICAvLyBGaW5hbGx5LCByZXR1cm4gdGhpcyBzZWxlY3Rpb24sIG9yIGEgbmV3IHNlbGVjdGlvbiwgZGVwZW5kaW5nIG9uIHRoZVxuICAgIC8vIG9wZXJhdGlvblxuICAgIGlmIChzYXZlU3VjY2Vzc2Z1bCAmJiBvdXRwdXRTcGVjLm5ld1NlbGVjdG9ycyAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5ldyBTZWxlY3Rpb24odGhpcy5tdXJlLCBvdXRwdXRTcGVjLm5ld1NlbGVjdG9ycyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICBTaG9ydGN1dHMgZm9yIHNlbGVjdGlvbiBtYW5pcHVsYXRpb25cbiAgICovXG4gIGFzeW5jIHN1YlNlbGVjdCAoYXBwZW5kLCBtb2RlID0gJ1JlcGxhY2UnKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0QWxsKHsgY29udGV4dDogJ1NlbGVjdG9yJywgYXBwZW5kLCBtb2RlIH0pO1xuICB9XG4gIGFzeW5jIG1lcmdlU2VsZWN0aW9uIChvdGhlclNlbGVjdGlvbikge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdEFsbCh7IGNvbnRleHQ6ICdTZWxlY3Rpb24nLCBvdGhlclNlbGVjdGlvbiwgbW9kZTogJ1VuaW9uJyB9KTtcbiAgfVxuXG4gIC8qXG4gICBUaGVzZSBmdW5jdGlvbnMgcHJvdmlkZSBzdGF0aXN0aWNzIC8gc3VtbWFyaWVzIG9mIHRoZSBzZWxlY3Rpb246XG4gICAqL1xuICBhc3luYyBnZXRQb3B1bGF0ZWRJbnB1dFNwZWMgKG9wZXJhdGlvbikge1xuICAgIGlmICh0aGlzLl9zdW1tYXJ5Q2FjaGVzICYmIHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjcyAmJlxuICAgICAgICB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3Nbb3BlcmF0aW9uLnR5cGVdKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3VtbWFyeUNhY2hlcy5pbnB1dFNwZWNzW29wZXJhdGlvbi50eXBlXTtcbiAgICB9XG5cbiAgICBjb25zdCBpbnB1dFNwZWMgPSBvcGVyYXRpb24uZ2V0SW5wdXRTcGVjKCk7XG4gICAgYXdhaXQgaW5wdXRTcGVjLnBvcHVsYXRlQ2hvaWNlc0Zyb21TZWxlY3Rpb24odGhpcyk7XG5cbiAgICB0aGlzLl9zdW1tYXJ5Q2FjaGVzID0gdGhpcy5fc3VtbWFyeUNhY2hlcyB8fCB7fTtcbiAgICB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3MgPSB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3MgfHwge307XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcy5pbnB1dFNwZWNzW29wZXJhdGlvbi50eXBlXSA9IGlucHV0U3BlYztcbiAgICByZXR1cm4gaW5wdXRTcGVjO1xuICB9XG4gIGFzeW5jIGhpc3RvZ3JhbXMgKG51bUJpbnMgPSAyMCkge1xuICAgIGlmICh0aGlzLl9zdW1tYXJ5Q2FjaGVzICYmIHRoaXMuX3N1bW1hcnlDYWNoZXMuaGlzdG9ncmFtcykge1xuICAgICAgcmV0dXJuIHRoaXMuX3N1bW1hcnlDYWNoZXMuaGlzdG9ncmFtcztcbiAgICB9XG5cbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuaXRlbXMoKTtcbiAgICBjb25zdCBpdGVtTGlzdCA9IE9iamVjdC52YWx1ZXMoaXRlbXMpO1xuXG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIHJhdzoge1xuICAgICAgICB0eXBlQmluczoge30sXG4gICAgICAgIGNhdGVnb3JpY2FsQmluczoge30sXG4gICAgICAgIHF1YW50aXRhdGl2ZUJpbnM6IFtdXG4gICAgICB9LFxuICAgICAgYXR0cmlidXRlczoge31cbiAgICB9O1xuXG4gICAgY29uc3QgY291bnRQcmltaXRpdmUgPSAoY291bnRlcnMsIGl0ZW0pID0+IHtcbiAgICAgIC8vIEF0dGVtcHQgdG8gY291bnQgdGhlIHZhbHVlIGNhdGVnb3JpY2FsbHlcbiAgICAgIGlmIChjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMgIT09IG51bGwpIHtcbiAgICAgICAgY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zW2l0ZW0udmFsdWVdID0gKGNvdW50ZXJzLmNhdGVnb3JpY2FsQmluc1tpdGVtLnZhbHVlXSB8fCAwKSArIDE7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMpLmxlbmd0aCA+IG51bUJpbnMpIHtcbiAgICAgICAgICAvLyBXZSd2ZSBlbmNvdW50ZXJlZCB0b28gbWFueSBjYXRlZ29yaWNhbCBiaW5zOyB0aGlzIGxpa2VseSBpc24ndCBhIGNhdGVnb3JpY2FsIGF0dHJpYnV0ZVxuICAgICAgICAgIGNvdW50ZXJzLmNhdGVnb3JpY2FsQmlucyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIEF0dGVtcHQgdG8gYmluIHRoZSB2YWx1ZSBxdWFudGl0YXRpdmVseVxuICAgICAgaWYgKGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMgIT09IG51bGwpIHtcbiAgICAgICAgaWYgKGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gSW5pdCB0aGUgY291bnRlcnMgd2l0aCBzb21lIHRlbXBvcmFyeSBwbGFjZWhvbGRlcnNcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycyA9IFtdO1xuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVR5cGUgPSBpdGVtLnR5cGU7XG4gICAgICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcikge1xuICAgICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGUgPSB0aGlzLm11cmUuZDMuc2NhbGVMaW5lYXIoKVxuICAgICAgICAgICAgICAuZG9tYWluKFtpdGVtLnZhbHVlLCBpdGVtLnZhbHVlXSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRhdGVXcmFwcGVyKSB7XG4gICAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZSA9IHRoaXMubXVyZS5kMy5zY2FsZVRpbWUoKVxuICAgICAgICAgICAgICAuZG9tYWluKFtpdGVtLnZhbHVlLCBpdGVtLnZhbHVlXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRoZSBmaXJzdCB2YWx1ZSBpcyBub24tcXVhbnRpdGF0aXZlOyB0aGlzIGxpa2VseSBpc24ndCBhIHF1YW50aXRhdGl2ZSBhdHRyaWJ1dGVcbiAgICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMgPSBudWxsO1xuICAgICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzO1xuICAgICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVR5cGU7XG4gICAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNvdW50ZXJzLnF1YW50aXRhdGl2ZVR5cGUgIT09IGl0ZW0udHlwZSkge1xuICAgICAgICAgIC8vIEVuY291bnRlcmVkIGFuIGl0ZW0gb2YgYSBkaWZmZXJlbnQgdHlwZTsgdGhpcyBsaWtlbHkgaXNuJ3QgYSBxdWFudGl0YXRpdmUgYXR0cmlidXRlXG4gICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlQmlucyA9IG51bGw7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzO1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVUeXBlO1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBVcGRhdGUgdGhlIHNjYWxlJ3MgZG9tYWluICh3ZSdsbCBkZXRlcm1pbmUgYmlucyBsYXRlcilcbiAgICAgICAgICBsZXQgZG9tYWluID0gY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGUuZG9tYWluKCk7XG4gICAgICAgICAgaWYgKGl0ZW0udmFsdWUgPCBkb21haW5bMF0pIHtcbiAgICAgICAgICAgIGRvbWFpblswXSA9IGl0ZW0udmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpdGVtLnZhbHVlID4gZG9tYWluWzFdKSB7XG4gICAgICAgICAgICBkb21haW5bMV0gPSBpdGVtLnZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZS5kb21haW4oZG9tYWluKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1MaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gaXRlbUxpc3RbaV07XG4gICAgICByZXN1bHQucmF3LnR5cGVCaW5zW2l0ZW0udHlwZV0gPSAocmVzdWx0LnJhdy50eXBlQmluc1tpdGVtLnR5cGVdIHx8IDApICsgMTtcbiAgICAgIGlmIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlByaW1pdGl2ZVdyYXBwZXIpIHtcbiAgICAgICAgY291bnRQcmltaXRpdmUocmVzdWx0LnJhdywgaXRlbSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXRlbS5nZXRDb250ZW50cykge1xuICAgICAgICAgIE9iamVjdC52YWx1ZXMoaXRlbS5nZXRDb250ZW50cygpKS5mb3JFYWNoKGNoaWxkV3JhcHBlciA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb3VudGVycyA9IHJlc3VsdC5hdHRyaWJ1dGVzW2NoaWxkV3JhcHBlci5sYWJlbF0gPSByZXN1bHQuYXR0cmlidXRlc1tjaGlsZFdyYXBwZXIubGFiZWxdIHx8IHtcbiAgICAgICAgICAgICAgdHlwZUJpbnM6IHt9LFxuICAgICAgICAgICAgICBjYXRlZ29yaWNhbEJpbnM6IHt9LFxuICAgICAgICAgICAgICBxdWFudGl0YXRpdmVCaW5zOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGNvdW50ZXJzLnR5cGVCaW5zW2NoaWxkV3JhcHBlci50eXBlXSA9IChjb3VudGVycy50eXBlQmluc1tjaGlsZFdyYXBwZXIudHlwZV0gfHwgMCkgKyAxO1xuICAgICAgICAgICAgaWYgKGNoaWxkV3JhcHBlciBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5QcmltaXRpdmVXcmFwcGVyKSB7XG4gICAgICAgICAgICAgIGNvdW50UHJpbWl0aXZlKGNvdW50ZXJzLCBjaGlsZFdyYXBwZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRPRE86IGNvbGxlY3QgbW9yZSBzdGF0aXN0aWNzLCBzdWNoIGFzIG5vZGUgZGVncmVlLCBzZXQgc2l6ZVxuICAgICAgICAvLyAoYW5kIGEgc2V0J3MgbWVtYmVycycgYXR0cmlidXRlcywgc2ltaWxhciB0byBnZXRDb250ZW50cz8pXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmluYWxpemVCaW5zID0gY291bnRlcnMgPT4ge1xuICAgICAgLy8gQ2xlYXIgb3V0IGFueXRoaW5nIHRoYXQgZGlkbid0IHNlZSBhbnkgdmFsdWVzXG4gICAgICBpZiAoY291bnRlcnMudHlwZUJpbnMgJiYgT2JqZWN0LmtleXMoY291bnRlcnMudHlwZUJpbnMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb3VudGVycy50eXBlQmlucyA9IG51bGw7XG4gICAgICB9XG4gICAgICBpZiAoY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zICYmXG4gICAgICAgICAgT2JqZWN0LmtleXMoY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmIChjb3VudGVycy5xdWFudGl0YXRpdmVCaW5zKSB7XG4gICAgICAgIGlmICghY291bnRlcnMucXVhbnRpdGF0aXZlV3JhcHBlcnMgfHxcbiAgICAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVCaW5zID0gbnVsbDtcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlV3JhcHBlcnM7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVR5cGU7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIENhbGN1bGF0ZSBxdWFudGl0YXRpdmUgYmluIHNpemVzIGFuZCB0aGVpciBjb3VudHNcbiAgICAgICAgICAvLyBDbGVhbiB1cCB0aGUgc2NhbGUgYSBiaXRcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZS5uaWNlKCk7XG4gICAgICAgICAgLy8gSGlzdG9ncmFtIGdlbmVyYXRvclxuICAgICAgICAgIGNvbnN0IGhpc3RvZ3JhbUdlbmVyYXRvciA9IHRoaXMubXVyZS5kMy5oaXN0b2dyYW0oKVxuICAgICAgICAgICAgLmRvbWFpbihjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZS5kb21haW4oKSlcbiAgICAgICAgICAgIC50aHJlc2hvbGRzKGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLnRpY2tzKG51bUJpbnMpKVxuICAgICAgICAgICAgLnZhbHVlKGQgPT4gZC52YWx1ZSk7XG4gICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlQmlucyA9IGhpc3RvZ3JhbUdlbmVyYXRvcihjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycyk7XG4gICAgICAgICAgLy8gQ2xlYW4gdXAgc29tZSBvZiB0aGUgdGVtcG9yYXJ5IHBsYWNlaG9sZGVyc1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycztcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gICAgZmluYWxpemVCaW5zKHJlc3VsdC5yYXcpO1xuICAgIE9iamVjdC52YWx1ZXMocmVzdWx0LmF0dHJpYnV0ZXMpLmZvckVhY2goZmluYWxpemVCaW5zKTtcblxuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMgPSB0aGlzLl9zdW1tYXJ5Q2FjaGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMuaGlzdG9ncmFtcyA9IHJlc3VsdDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGdldEZsYXRHcmFwaFNjaGVtYSAoKSB7XG4gICAgaWYgKHRoaXMuX3N1bW1hcnlDYWNoZXMgJiYgdGhpcy5fc3VtbWFyeUNhY2hlcy5mbGF0R3JhcGhTY2hlbWEpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmZsYXRHcmFwaFNjaGVtYTtcbiAgICB9XG5cbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuaXRlbXMoKTtcbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZUNsYXNzZXM6IHt9LFxuICAgICAgZWRnZUNsYXNzZXM6IHt9LFxuICAgICAgbWlzc2luZ05vZGVzOiBmYWxzZSxcbiAgICAgIG1pc3NpbmdFZGdlczogZmFsc2VcbiAgICB9O1xuXG4gICAgLy8gRmlyc3QgcGFzczogaWRlbnRpZnkgaXRlbXMgYnkgY2xhc3MsIGFuZCBnZW5lcmF0ZSBwc2V1ZG8taXRlbXMgdGhhdFxuICAgIC8vIHBvaW50IHRvIGNsYXNzZXMgaW5zdGVhZCBvZiBzZWxlY3RvcnNcbiAgICBPYmplY3QuZW50cmllcyhpdGVtcykuZm9yRWFjaCgoW3VuaXF1ZVNlbGVjdG9yLCBpdGVtXSkgPT4ge1xuICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBhbiBlZGdlOyBjcmVhdGUgLyBhZGQgdG8gYSBwc2V1ZG8taXRlbSBmb3IgZWFjaCBjbGFzc1xuICAgICAgICBsZXQgY2xhc3NMaXN0ID0gaXRlbS5nZXRDbGFzc2VzKCk7XG4gICAgICAgIGlmIChjbGFzc0xpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgY2xhc3NMaXN0LnB1c2goJyhubyBjbGFzcyknKTtcbiAgICAgICAgfVxuICAgICAgICBjbGFzc0xpc3QuZm9yRWFjaChlZGdlQ2xhc3NOYW1lID0+IHtcbiAgICAgICAgICBsZXQgcHNldWRvRWRnZSA9IHJlc3VsdC5lZGdlQ2xhc3Nlc1tlZGdlQ2xhc3NOYW1lXSA9XG4gICAgICAgICAgICByZXN1bHQuZWRnZUNsYXNzZXNbZWRnZUNsYXNzTmFtZV0gfHwgeyAkbm9kZXM6IHt9IH07XG4gICAgICAgICAgLy8gQWRkIG91ciBkaXJlY3Rpb24gY291bnRzIGZvciBlYWNoIG9mIHRoZSBub2RlJ3MgY2xhc3NlcyB0byB0aGUgcHNldWRvLWl0ZW1cbiAgICAgICAgICBPYmplY3QuZW50cmllcyhpdGVtLnZhbHVlLiRub2RlcykuZm9yRWFjaCgoW25vZGVTZWxlY3RvciwgZGlyZWN0aW9uc10pID0+IHtcbiAgICAgICAgICAgIGxldCBub2RlV3JhcHBlciA9IGl0ZW1zW25vZGVTZWxlY3Rvcl07XG4gICAgICAgICAgICBpZiAoIW5vZGVXcmFwcGVyKSB7XG4gICAgICAgICAgICAgIC8vIFRoaXMgZWRnZSByZWZlcnMgdG8gYSBub2RlIG91dHNpZGUgdGhlIHNlbGVjdGlvblxuICAgICAgICAgICAgICByZXN1bHQubWlzc2luZ05vZGVzID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5vZGVXcmFwcGVyLmdldENsYXNzZXMoKS5mb3JFYWNoKG5vZGVDbGFzc05hbWUgPT4ge1xuICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGRpcmVjdGlvbnMpLmZvckVhY2goKFtkaXJlY3Rpb24sIGNvdW50XSkgPT4ge1xuICAgICAgICAgICAgICAgICAgcHNldWRvRWRnZS4kbm9kZXNbbm9kZUNsYXNzTmFtZV0gPSBwc2V1ZG9FZGdlLiRub2Rlc1tub2RlQ2xhc3NOYW1lXSB8fCB7fTtcbiAgICAgICAgICAgICAgICAgIHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdW2RpcmVjdGlvbl0gPSBwc2V1ZG9FZGdlLiRub2Rlc1tub2RlQ2xhc3NOYW1lXVtkaXJlY3Rpb25dIHx8IDA7XG4gICAgICAgICAgICAgICAgICBwc2V1ZG9FZGdlLiRub2Rlc1tub2RlQ2xhc3NOYW1lXVtkaXJlY3Rpb25dICs9IGNvdW50O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBhIG5vZGU7IGNyZWF0ZSAvIGFkZCB0byBhIHBzZXVkby1pdGVtIGZvciBlYWNoIGNsYXNzXG4gICAgICAgIGxldCBjbGFzc0xpc3QgPSBpdGVtLmdldENsYXNzZXMoKTtcbiAgICAgICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjbGFzc0xpc3QucHVzaCgnKG5vIGNsYXNzKScpO1xuICAgICAgICB9XG4gICAgICAgIGNsYXNzTGlzdC5mb3JFYWNoKG5vZGVDbGFzc05hbWUgPT4ge1xuICAgICAgICAgIGxldCBwc2V1ZG9Ob2RlID0gcmVzdWx0Lm5vZGVDbGFzc2VzW25vZGVDbGFzc05hbWVdID1cbiAgICAgICAgICAgIHJlc3VsdC5ub2RlQ2xhc3Nlc1tub2RlQ2xhc3NOYW1lXSB8fCB7IGNvdW50OiAwLCAkZWRnZXM6IHt9IH07XG4gICAgICAgICAgcHNldWRvTm9kZS5jb3VudCArPSAxO1xuICAgICAgICAgIC8vIEVuc3VyZSB0aGF0IHRoZSBlZGdlIGNsYXNzIGlzIHJlZmVyZW5jZWQgKGRpcmVjdGlvbnMnIGNvdW50cyBhcmUga2VwdCBvbiB0aGUgZWRnZXMpXG4gICAgICAgICAgT2JqZWN0LmtleXMoaXRlbS52YWx1ZS4kZWRnZXMpLmZvckVhY2goZWRnZVNlbGVjdG9yID0+IHtcbiAgICAgICAgICAgIGxldCBlZGdlV3JhcHBlciA9IGl0ZW1zW2VkZ2VTZWxlY3Rvcl07XG4gICAgICAgICAgICBpZiAoIWVkZ2VXcmFwcGVyKSB7XG4gICAgICAgICAgICAgIC8vIFRoaXMgbm9kZSByZWZlcnMgdG8gYW4gZWRnZSBvdXRzaWRlIHRoZSBzZWxlY3Rpb25cbiAgICAgICAgICAgICAgcmVzdWx0Lm1pc3NpbmdFZGdlcyA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBlZGdlV3JhcHBlci5nZXRDbGFzc2VzKCkuZm9yRWFjaChlZGdlQ2xhc3NOYW1lID0+IHtcbiAgICAgICAgICAgICAgICBwc2V1ZG9Ob2RlLiRlZGdlc1tlZGdlQ2xhc3NOYW1lXSA9IHRydWU7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMgPSB0aGlzLl9zdW1tYXJ5Q2FjaGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMuZmxhdEdyYXBoU2NoZW1hID0gcmVzdWx0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgZ2V0SW50ZXJzZWN0ZWRHcmFwaFNjaGVtYSAoKSB7XG4gICAgLy8gY29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLml0ZW1zKCk7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gIH1cbiAgYXN5bmMgYWxsTWV0YU9iakludGVyc2VjdGlvbnMgKG1ldGFPYmpzKSB7XG4gICAgY29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLml0ZW1zKCk7XG4gICAgbGV0IGxpbmtlZElkcyA9IHt9O1xuICAgIGl0ZW1zLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICBtZXRhT2Jqcy5mb3JFYWNoKG1ldGFPYmogPT4ge1xuICAgICAgICBpZiAoaXRlbS52YWx1ZVttZXRhT2JqXSkge1xuICAgICAgICAgIE9iamVjdC5rZXlzKGl0ZW0udmFsdWVbbWV0YU9ial0pLmZvckVhY2gobGlua2VkSWQgPT4ge1xuICAgICAgICAgICAgbGlua2VkSWQgPSB0aGlzLm11cmUuaWRUb1VuaXF1ZVNlbGVjdG9yKGxpbmtlZElkLCBpdGVtLmRvYy5faWQpO1xuICAgICAgICAgICAgbGlua2VkSWRzW2xpbmtlZElkXSA9IGxpbmtlZElkc1tsaW5rZWRJZF0gfHwge307XG4gICAgICAgICAgICBsaW5rZWRJZHNbbGlua2VkSWRdW2l0ZW0udW5pcXVlU2VsZWN0b3JdID0gdHJ1ZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgbGV0IHNldHMgPSBbXTtcbiAgICBsZXQgc2V0TG9va3VwID0ge307XG4gICAgT2JqZWN0LmtleXMobGlua2VkSWRzKS5mb3JFYWNoKGxpbmtlZElkID0+IHtcbiAgICAgIGxldCBpdGVtSWRzID0gT2JqZWN0LmtleXMobGlua2VkSWRzW2xpbmtlZElkXSkuc29ydCgpO1xuICAgICAgbGV0IHNldEtleSA9IGl0ZW1JZHMuam9pbignLCcpO1xuICAgICAgaWYgKHNldExvb2t1cFtzZXRLZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2V0TG9va3VwW3NldEtleV0gPSBzZXRzLmxlbmd0aDtcbiAgICAgICAgc2V0cy5wdXNoKHsgaXRlbUlkcywgbGlua2VkSWRzOiB7fSB9KTtcbiAgICAgIH1cbiAgICAgIHNldExvb2t1cFtzZXRLZXldLmxpbmtlZElkc1tsaW5rZWRJZF0gPSB0cnVlO1xuICAgIH0pO1xuICAgIHJldHVybiBzZXRzO1xuICB9XG59XG4vLyBUT0RPOiB0aGlzIHdheSBvZiBkZWFsaW5nIHdpdGggY2FjaGUgaW52YWxpZGF0aW9uIGNhdXNlcyBhIG1lbW9yeSBsZWFrLCBhc1xuLy8gb2xkIHNlbGVjdGlvbnMgYXJlIGdvaW5nIHRvIHBpbGUgdXAgaW4gQ0FDSEVEX0RPQ1MgYWZ0ZXIgdGhleSd2ZSBsb3N0IGFsbFxuLy8gb3RoZXIgcmVmZXJlbmNlcywgcHJldmVudGluZyB0aGVpciBnYXJiYWdlIGNvbGxlY3Rpb24uIFVuZm9ydHVuYXRlbHkgdGhpbmdzXG4vLyBsaWtlIFdlYWtNYXAgYXJlbid0IGVudW1lcmFibGUuLi4gYSBnb29kIGlkZWEgd291bGQgcHJvYmFibHkgYmUgdG8ganVzdFxuLy8gcHVyZ2UgdGhlIGNhY2hlIGV2ZXJ5IG4gbWludXRlcyBvciBzby4uLj9cblNlbGVjdGlvbi5ERUZBVUxUX0RPQ19RVUVSWSA9IERFRkFVTFRfRE9DX1FVRVJZO1xuU2VsZWN0aW9uLkNBQ0hFRF9ET0NTID0ge307XG5TZWxlY3Rpb24uSU5WQUxJREFURV9ET0NfQ0FDSEUgPSBkb2NJZCA9PiB7XG4gIGlmIChTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jSWRdKSB7XG4gICAgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvY0lkXS5zZWxlY3Rpb25zLmZvckVhY2goc2VsZWN0aW9uID0+IHtcbiAgICAgIHNlbGVjdGlvbi5pbnZhbGlkYXRlQ2FjaGUoKTtcbiAgICB9KTtcbiAgICBkZWxldGUgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvY0lkXTtcbiAgfVxufTtcblNlbGVjdGlvbi5JTlZBTElEQVRFX0FMTF9DQUNIRVMgPSAoKSA9PiB7XG4gIE9iamVjdC52YWx1ZXMoU2VsZWN0aW9uLkNBQ0hFRF9ET0NTKS5mb3JFYWNoKCh7IGNhY2hlZERvYywgc2VsZWN0aW9ucyB9KSA9PiB7XG4gICAgc2VsZWN0aW9ucy5mb3JFYWNoKHNlbGVjdGlvbiA9PiB7XG4gICAgICBzZWxlY3Rpb24uaW52YWxpZGF0ZUNhY2hlKCk7XG4gICAgfSk7XG4gICAgZGVsZXRlIFNlbGVjdGlvbi5DQUNIRURfRE9DU1tjYWNoZWREb2MuX2lkXTtcbiAgfSk7XG59O1xuZXhwb3J0IGRlZmF1bHQgU2VsZWN0aW9uO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVdyYXBwZXIgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHBhdGgsIHZhbHVlLCBwYXJlbnQsIGRvYywgbGFiZWwsIHVuaXF1ZVNlbGVjdG9yIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG4gICAgdGhpcy5wYXRoID0gcGF0aDtcbiAgICB0aGlzLl92YWx1ZSA9IHZhbHVlO1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgIHRoaXMuZG9jID0gZG9jO1xuICAgIHRoaXMubGFiZWwgPSBsYWJlbDtcbiAgICB0aGlzLnVuaXF1ZVNlbGVjdG9yID0gdW5pcXVlU2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHZhbHVlICgpIHsgcmV0dXJuIHRoaXMuX3ZhbHVlOyB9XG4gIHNldCB2YWx1ZSAobmV3VmFsdWUpIHtcbiAgICBpZiAodGhpcy5wYXJlbnQpIHtcbiAgICAgIC8vIEluIHRoZSBldmVudCB0aGF0IHRoaXMgaXMgYSBwcmltaXRpdmUgYm9vbGVhbiwgbnVtYmVyLCBzdHJpbmcsIGV0YyxcbiAgICAgIC8vIHNldHRpbmcgdGhlIHZhbHVlIG9uIHRoZSBXcmFwcGVyIHdyYXBwZXIgb2JqZWN0ICp3b24ndCogbmF0dXJhbGx5IHVwZGF0ZVxuICAgICAgLy8gaXQgaW4gaXRzIGNvbnRhaW5pbmcgZG9jdW1lbnQuLi5cbiAgICAgIHRoaXMucGFyZW50W3RoaXMubGFiZWxdID0gbmV3VmFsdWU7XG4gICAgfVxuICAgIHRoaXMuX3ZhbHVlID0gbmV3VmFsdWU7XG4gIH1cbiAgcmVtb3ZlICgpIHtcbiAgICAvLyB0aGlzLnBhcmVudCBpcyBhIHBvaW50ZXIgdG8gdGhlIHJhdyBlbGVtZW50LCBzbyB3ZSB3YW50IHRvIGRlbGV0ZSBpdHNcbiAgICAvLyByZWZlcmVuY2UgdG8gdGhpcyBpdGVtXG4gICAgZGVsZXRlIHRoaXMucGFyZW50W3RoaXMubGFiZWxdO1xuICB9XG4gIGVxdWFscyAob3RoZXIpIHtcbiAgICByZXR1cm4gb3RoZXIgaW5zdGFuY2VvZiBCYXNlV3JhcHBlciAmJlxuICAgICAgdGhpcy51bmlxdWVTZWxlY3RvciA9PT0gb3RoZXIudW5pcXVlU2VsZWN0b3I7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbkJhc2VXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiB7XG4gIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xufTtcbkJhc2VXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4ge1xuICAvLyBEZWZhdWx0IGFjdGlvbjogZG8gbm90aGluZ1xuICByZXR1cm4gdmFsdWU7XG59O1xuQmFzZVdyYXBwZXIuaXNCYWRWYWx1ZSA9IHZhbHVlID0+IGZhbHNlO1xuXG5leHBvcnQgZGVmYXVsdCBCYXNlV3JhcHBlcjtcbiIsImltcG9ydCBCYXNlV3JhcHBlciBmcm9tICcuL0Jhc2VXcmFwcGVyLmpzJztcblxuY2xhc3MgUm9vdFdyYXBwZXIgZXh0ZW5kcyBCYXNlV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIGRvY0xpc3QgfSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBwYXRoOiBbXSxcbiAgICAgIHZhbHVlOiB7fSxcbiAgICAgIHBhcmVudDogbnVsbCxcbiAgICAgIGRvYzogbnVsbCxcbiAgICAgIGxhYmVsOiBudWxsLFxuICAgICAgdW5pcXVlU2VsZWN0b3I6ICdAJ1xuICAgIH0pO1xuICAgIGRvY0xpc3QuZm9yRWFjaChkb2MgPT4ge1xuICAgICAgdGhpcy52YWx1ZVtkb2MuX2lkXSA9IGRvYztcbiAgICB9KTtcbiAgfVxuICByZW1vdmUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgcmVtb3ZlIHRoZSByb290IGl0ZW1gKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFdyYXBwZXI7XG4iLCJpbXBvcnQganNvblBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IEJhc2VXcmFwcGVyIGZyb20gJy4vQmFzZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBUeXBlZFdyYXBwZXIgZXh0ZW5kcyBCYXNlV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIGxldCBwYXJlbnQ7XG4gICAgaWYgKHBhdGgubGVuZ3RoIDwgMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBjcmVhdGUgYSBub24tUm9vdCBvciBub24tRG9jIFdyYXBwZXIgd2l0aCBhIHBhdGggbGVuZ3RoIGxlc3MgdGhhbiAyYCk7XG4gICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCA9PT0gMikge1xuICAgICAgcGFyZW50ID0gZG9jO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdGVtcCA9IGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEsIHBhdGgubGVuZ3RoIC0gMSkpO1xuICAgICAgcGFyZW50ID0ganNvblBhdGgudmFsdWUoZG9jLCB0ZW1wKTtcbiAgICB9XG4gICAgY29uc3QgZG9jUGF0aFF1ZXJ5ID0gcGF0aFswXTtcbiAgICBjb25zdCB1bmlxdWVKc29uUGF0aCA9IGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEpKTtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgcGF0aCxcbiAgICAgIHZhbHVlLFxuICAgICAgcGFyZW50LFxuICAgICAgZG9jLFxuICAgICAgbGFiZWw6IHBhdGhbcGF0aC5sZW5ndGggLSAxXSxcbiAgICAgIHVuaXF1ZVNlbGVjdG9yOiAnQCcgKyBkb2NQYXRoUXVlcnkgKyB1bmlxdWVKc29uUGF0aFxuICAgIH0pO1xuICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLmlzQmFkVmFsdWUodmFsdWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGB0eXBlb2YgJHt2YWx1ZX0gaXMgJHt0eXBlb2YgdmFsdWV9LCB3aGljaCBkb2VzIG5vdCBtYXRjaCByZXF1aXJlZCAke3RoaXMuY29uc3RydWN0b3IuSlNUWVBFfWApO1xuICAgIH1cbiAgfVxuICBnZXQgcGFyZW50V3JhcHBlciAoKSB7XG4gICAgY29uc3QgUGFyZW50VHlwZSA9IHRoaXMubXVyZS5pbmZlclR5cGUodGhpcy5wYXJlbnQpO1xuICAgIHJldHVybiBuZXcgUGFyZW50VHlwZSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICB2YWx1ZTogdGhpcy5wYXJlbnQsXG4gICAgICBwYXRoOiB0aGlzLnBhdGguc2xpY2UoMCwgdGhpcy5wYXRoLmxlbmd0aCAtIDEpLFxuICAgICAgZG9jOiB0aGlzLmRvY1xuICAgIH0pO1xuICB9XG59XG5UeXBlZFdyYXBwZXIuSlNUWVBFID0gJ29iamVjdCc7XG5UeXBlZFdyYXBwZXIuaXNCYWRWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICByZXR1cm4gKHR5cGVvZiB2YWx1ZSkgIT09IHRoaXMuSlNUWVBFOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHZhbGlkLXR5cGVvZlxufTtcblxuZXhwb3J0IGRlZmF1bHQgVHlwZWRXcmFwcGVyO1xuIiwiZXhwb3J0IGRlZmF1bHQgKHN1cGVyY2xhc3MpID0+IGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gIGdldFZhbHVlIChhdHRyaWJ1dGUsIHRhcmdldCA9IHRoaXMuX2NvbnRlbnRXcmFwcGVyIHx8IHRoaXMpIHtcbiAgICByZXR1cm4gdGFyZ2V0LnZhbHVlW2F0dHJpYnV0ZV07XG4gIH1cbiAgZ2V0QXR0cmlidXRlcyAodGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0YXJnZXQudmFsdWUpXG4gICAgICAuZmlsdGVyKGQgPT4gIXRoaXMubXVyZS5SRVNFUlZFRF9PQkpfS0VZU1tkXSk7XG4gIH1cbiAgZ2V0Q29udGVudHMgKHRhcmdldCA9IHRoaXMuX2NvbnRlbnRXcmFwcGVyIHx8IHRoaXMpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBPYmplY3QuZW50cmllcyh0YXJnZXQudmFsdWUpLmZvckVhY2goKFtsYWJlbCwgdmFsdWVdKSA9PiB7XG4gICAgICBpZiAoIXRoaXMubXVyZS5SRVNFUlZFRF9PQkpfS0VZU1tsYWJlbF0pIHtcbiAgICAgICAgbGV0IFdyYXBwZXJUeXBlID0gdGhpcy5tdXJlLmluZmVyVHlwZSh2YWx1ZSk7XG4gICAgICAgIGNvbnN0IHRlbXAgPSBuZXcgV3JhcHBlclR5cGUoe1xuICAgICAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBwYXRoOiB0YXJnZXQucGF0aC5jb25jYXQoW2xhYmVsXSksXG4gICAgICAgICAgZG9jOiB0YXJnZXQuZG9jXG4gICAgICAgIH0pO1xuICAgICAgICByZXN1bHRbdGVtcC51bmlxdWVTZWxlY3Rvcl0gPSB0ZW1wO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0Q29udGVudFNlbGVjdG9ycyAodGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldENvbnRlbnRzKHRhcmdldCkpO1xuICB9XG4gIGdldENvbnRlbnRDb3VudCAodGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0YXJnZXQudmFsdWUpXG4gICAgICAuZmlsdGVyKGxhYmVsID0+ICF0aGlzLm11cmUuUkVTRVJWRURfT0JKX0tFWVNbbGFiZWxdKVxuICAgICAgLmxlbmd0aDtcbiAgfVxufTtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgVHlwZWRXcmFwcGVyIGZyb20gJy4vVHlwZWRXcmFwcGVyLmpzJztcbmltcG9ydCBDb250YWluZXJXcmFwcGVyTWl4aW4gZnJvbSAnLi9Db250YWluZXJXcmFwcGVyTWl4aW4uanMnO1xuXG5jbGFzcyBDb250YWluZXJXcmFwcGVyIGV4dGVuZHMgQ29udGFpbmVyV3JhcHBlck1peGluKFR5cGVkV3JhcHBlcikge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBzdXBlcih7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSk7XG4gICAgdGhpcy5uZXh0TGFiZWwgPSBPYmplY3Qua2V5cyh0aGlzLnZhbHVlKVxuICAgICAgLnJlZHVjZSgobWF4LCBrZXkpID0+IHtcbiAgICAgICAga2V5ID0gcGFyc2VJbnQoa2V5KTtcbiAgICAgICAgaWYgKCFpc05hTihrZXkpICYmIGtleSA+IG1heCkge1xuICAgICAgICAgIHJldHVybiBrZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG1heDtcbiAgICAgICAgfVxuICAgICAgfSwgMCkgKyAxO1xuICB9XG4gIGNyZWF0ZU5ld1dyYXBwZXIgKHZhbHVlLCBsYWJlbCwgV3JhcHBlclR5cGUpIHtcbiAgICBXcmFwcGVyVHlwZSA9IFdyYXBwZXJUeXBlIHx8IHRoaXMubXVyZS5pbmZlclR5cGUodmFsdWUpO1xuICAgIGlmIChsYWJlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBsYWJlbCA9IFN0cmluZyh0aGlzLm5leHRMYWJlbCk7XG4gICAgICB0aGlzLm5leHRMYWJlbCArPSAxO1xuICAgIH1cbiAgICBsZXQgcGF0aCA9IHRoaXMucGF0aC5jb25jYXQobGFiZWwpO1xuICAgIGxldCBpdGVtID0gbmV3IFdyYXBwZXJUeXBlKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIHZhbHVlOiBXcmFwcGVyVHlwZS5nZXRCb2lsZXJwbGF0ZVZhbHVlKCksXG4gICAgICBwYXRoLFxuICAgICAgZG9jOiB0aGlzLmRvY1xuICAgIH0pO1xuICAgIHRoaXMuYWRkV3JhcHBlcihpdGVtLCBsYWJlbCk7XG4gICAgcmV0dXJuIGl0ZW07XG4gIH1cbiAgYWRkV3JhcHBlciAoaXRlbSwgbGFiZWwpIHtcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIENvbnRhaW5lcldyYXBwZXIpIHtcbiAgICAgIGlmIChpdGVtLnZhbHVlLl9pZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1dyYXBwZXIgaGFzIGFscmVhZHkgYmVlbiBhc3NpZ25lZCBhbiBfaWQnKTtcbiAgICAgIH1cbiAgICAgIGlmIChsYWJlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxhYmVsID0gdGhpcy5uZXh0TGFiZWw7XG4gICAgICAgIHRoaXMubmV4dExhYmVsICs9IDE7XG4gICAgICB9XG4gICAgICBpdGVtLnZhbHVlLl9pZCA9IGBAJHtqc29uUGF0aC5zdHJpbmdpZnkodGhpcy5wYXRoLnNsaWNlKDEpLmNvbmNhdChbbGFiZWxdKSl9YDtcbiAgICB9XG4gICAgdGhpcy52YWx1ZVtsYWJlbF0gPSBpdGVtLnZhbHVlO1xuICB9XG59XG5Db250YWluZXJXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiB7IHJldHVybiB7fTsgfTtcbkNvbnRhaW5lcldyYXBwZXIuY29udmVydEFycmF5ID0gdmFsdWUgPT4ge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIGxldCB0ZW1wID0ge307XG4gICAgdmFsdWUuZm9yRWFjaCgoZWxlbWVudCwgaW5kZXgpID0+IHtcbiAgICAgIHRlbXBbaW5kZXhdID0gZWxlbWVudDtcbiAgICB9KTtcbiAgICB2YWx1ZSA9IHRlbXA7XG4gICAgdmFsdWUuJHdhc0FycmF5ID0gdHJ1ZTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59O1xuQ29udGFpbmVyV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBBc3NpZ24gdGhlIG9iamVjdCdzIGlkIGlmIGEgcGF0aCBpcyBzdXBwbGllZFxuICBpZiAocGF0aCkge1xuICAgIHZhbHVlLl9pZCA9ICdAJyArIGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEpKTtcbiAgfVxuICAvLyBSZWN1cnNpdmVseSBzdGFuZGFyZGl6ZSBjb250ZW50cyBpZiBhIHBhdGggYW5kIGRvYyBhcmUgc3VwcGxpZWRcbiAgaWYgKHBhdGggJiYgZG9jKSB7XG4gICAgT2JqZWN0LmVudHJpZXModmFsdWUpLmZvckVhY2goKFtrZXksIG5lc3RlZFZhbHVlXSkgPT4ge1xuICAgICAgaWYgKCFtdXJlLlJFU0VSVkVEX09CSl9LRVlTW2tleV0pIHtcbiAgICAgICAgbGV0IHRlbXAgPSBBcnJheS5mcm9tKHBhdGgpO1xuICAgICAgICB0ZW1wLnB1c2goa2V5KTtcbiAgICAgICAgLy8gQWxheXdzIGNvbnZlcnQgYXJyYXlzIHRvIG9iamVjdHNcbiAgICAgICAgbmVzdGVkVmFsdWUgPSBDb250YWluZXJXcmFwcGVyLmNvbnZlcnRBcnJheShuZXN0ZWRWYWx1ZSk7XG4gICAgICAgIC8vIFdoYXQga2luZCBvZiB2YWx1ZSBhcmUgd2UgZGVhbGluZyB3aXRoP1xuICAgICAgICBsZXQgV3JhcHBlclR5cGUgPSBtdXJlLmluZmVyVHlwZShuZXN0ZWRWYWx1ZSwgYWdncmVzc2l2ZSk7XG4gICAgICAgIC8vIEFwcGx5IHRoYXQgY2xhc3MncyBzdGFuZGFyZGl6YXRpb24gZnVuY3Rpb25cbiAgICAgICAgdmFsdWVba2V5XSA9IFdyYXBwZXJUeXBlLnN0YW5kYXJkaXplKHtcbiAgICAgICAgICBtdXJlLFxuICAgICAgICAgIHZhbHVlOiBuZXN0ZWRWYWx1ZSxcbiAgICAgICAgICBwYXRoOiB0ZW1wLFxuICAgICAgICAgIGRvYyxcbiAgICAgICAgICBhZ2dyZXNzaXZlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IENvbnRhaW5lcldyYXBwZXI7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IEJhc2VXcmFwcGVyIGZyb20gJy4vQmFzZVdyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXIgZnJvbSAnLi9Db250YWluZXJXcmFwcGVyLmpzJztcbmltcG9ydCBDb250YWluZXJXcmFwcGVyTWl4aW4gZnJvbSAnLi9Db250YWluZXJXcmFwcGVyTWl4aW4uanMnO1xuXG4vLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0gW1xuICAnanNvbicsXG4gICdjc3YnLFxuICAndHN2JyxcbiAgJ3RvcG9qc29uJyxcbiAgJ3RyZWVqc29uJ1xuXTtcblxuY2xhc3MgRG9jdW1lbnRXcmFwcGVyIGV4dGVuZHMgQ29udGFpbmVyV3JhcHBlck1peGluKEJhc2VXcmFwcGVyKSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIGRvYyB9KSB7XG4gICAgY29uc3QgZG9jUGF0aFF1ZXJ5ID0gYHtcIl9pZFwiOlwiJHtkb2MuX2lkfVwifWA7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIHBhdGg6IFtkb2NQYXRoUXVlcnksICckJ10sXG4gICAgICB2YWx1ZTogZG9jLFxuICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgZG9jOiBkb2MsXG4gICAgICBsYWJlbDogZG9jWydmaWxlbmFtZSddLFxuICAgICAgdW5pcXVlU2VsZWN0b3I6ICdAJyArIGRvY1BhdGhRdWVyeSArICckJ1xuICAgIH0pO1xuICAgIHRoaXMuX2NvbnRlbnRXcmFwcGVyID0gbmV3IENvbnRhaW5lcldyYXBwZXIoe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgdmFsdWU6IHRoaXMudmFsdWUuY29udGVudHMsXG4gICAgICBwYXRoOiB0aGlzLnBhdGguY29uY2F0KFsnY29udGVudHMnXSksXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gIH1cbiAgcmVtb3ZlICgpIHtcbiAgICAvLyBUT0RPOiByZW1vdmUgZXZlcnl0aGluZyBpbiB0aGlzLnZhbHVlIGV4Y2VwdCBfaWQsIF9yZXYsIGFuZCBhZGQgX2RlbGV0ZWQ/XG4gICAgLy8gVGhlcmUncyBwcm9iYWJseSBzb21lIGZ1bmtpbmVzcyBpbiB0aGUgdGltaW5nIG9mIHNhdmUoKSBJIHN0aWxsIG5lZWQgdG9cbiAgICAvLyB0aGluayB0aHJvdWdoLi4uXG4gICAgdGhyb3cgbmV3IEVycm9yKGBEZWxldGluZyBmaWxlcyB2aWEgU2VsZWN0aW9ucyBub3QgeWV0IGltcGxlbWVudGVkYCk7XG4gIH1cbn1cbkRvY3VtZW50V3JhcHBlci5pc1ZhbGlkSWQgPSAoZG9jSWQpID0+IHtcbiAgaWYgKGRvY0lkWzBdLnRvTG93ZXJDYXNlKCkgIT09IGRvY0lkWzBdKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGxldCBwYXJ0cyA9IGRvY0lkLnNwbGl0KCc7Jyk7XG4gIGlmIChwYXJ0cy5sZW5ndGggIT09IDIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuICEhbWltZS5leHRlbnNpb24ocGFydHNbMF0pO1xufTtcbkRvY3VtZW50V3JhcHBlci5wYXJzZSA9IGFzeW5jICh0ZXh0LCBleHRlbnNpb24pID0+IHtcbiAgbGV0IGNvbnRlbnRzO1xuICBpZiAoREFUQUxJQl9GT1JNQVRTLmluZGV4T2YoZXh0ZW5zaW9uKSAhPT0gLTEpIHtcbiAgICBjb250ZW50cyA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICB9XG4gIGlmICghY29udGVudHMuY29udGVudHMpIHtcbiAgICBjb250ZW50cyA9IHsgY29udGVudHM6IGNvbnRlbnRzIH07XG4gIH1cbiAgcmV0dXJuIGNvbnRlbnRzO1xufTtcbkRvY3VtZW50V3JhcHBlci5sYXVuY2hTdGFuZGFyZGl6YXRpb24gPSBhc3luYyAoeyBtdXJlLCBkb2MgfSkgPT4ge1xuICBsZXQgZXhpc3RpbmdVbnRpdGxlZHMgPSBhd2FpdCBtdXJlLmRiLmFsbERvY3Moe1xuICAgIHN0YXJ0a2V5OiBkb2MubWltZVR5cGUgKyAnO1VudGl0bGVkICcsXG4gICAgZW5ka2V5OiBkb2MubWltZVR5cGUgKyAnO1VudGl0bGVkIFxcdWZmZmYnXG4gIH0pO1xuICByZXR1cm4gRG9jdW1lbnRXcmFwcGVyLnN0YW5kYXJkaXplKHtcbiAgICBtdXJlLFxuICAgIGRvYyxcbiAgICBleGlzdGluZ1VudGl0bGVkcyxcbiAgICBhZ2dyZXNzaXZlOiB0cnVlXG4gIH0pO1xufTtcbkRvY3VtZW50V3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7XG4gIG11cmUsXG4gIGRvYyxcbiAgZXhpc3RpbmdVbnRpdGxlZHMgPSB7IHJvd3M6IFtdIH0sXG4gIGFnZ3Jlc3NpdmVcbn0pID0+IHtcbiAgaWYgKCFkb2MuX2lkIHx8ICFEb2N1bWVudFdyYXBwZXIuaXNWYWxpZElkKGRvYy5faWQpKSB7XG4gICAgaWYgKCFkb2MubWltZVR5cGUgJiYgIWRvYy5maWxlbmFtZSkge1xuICAgICAgLy8gV2l0aG91dCBhbiBpZCwgZmlsZW5hbWUsIG9yIG1pbWVUeXBlLCBqdXN0IGFzc3VtZSBpdCdzIGFwcGxpY2F0aW9uL2pzb25cbiAgICAgIGRvYy5taW1lVHlwZSA9ICdhcHBsaWNhdGlvbi9qc29uJztcbiAgICB9XG4gICAgaWYgKCFkb2MuZmlsZW5hbWUpIHtcbiAgICAgIGlmIChkb2MuX2lkKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgZ2l2ZW4gYW4gaW52YWxpZCBpZDsgdXNlIGl0IGFzIHRoZSBmaWxlbmFtZSBpbnN0ZWFkXG4gICAgICAgIGRvYy5maWxlbmFtZSA9IGRvYy5faWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBXaXRob3V0IGFueXRoaW5nIHRvIGdvIG9uLCB1c2UgXCJVbnRpdGxlZCAxXCIsIGV0Y1xuICAgICAgICBsZXQgbWluSW5kZXggPSBleGlzdGluZ1VudGl0bGVkcy5yb3dzLnJlZHVjZSgobWluSW5kZXgsIHVEb2MpID0+IHtcbiAgICAgICAgICBsZXQgaW5kZXggPSAvVW50aXRsZWQgKFxcZCspL2cuZXhlYyh1RG9jLl9pZCk7XG4gICAgICAgICAgaW5kZXggPSBpbmRleCA/IGluZGV4WzFdIHx8IEluZmluaXR5IDogSW5maW5pdHk7XG4gICAgICAgICAgcmV0dXJuIGluZGV4IDwgbWluSW5kZXggPyBpbmRleCA6IG1pbkluZGV4O1xuICAgICAgICB9LCBJbmZpbml0eSk7XG4gICAgICAgIG1pbkluZGV4ID0gaXNGaW5pdGUobWluSW5kZXgpID8gbWluSW5kZXggKyAxIDogMTtcbiAgICAgICAgZG9jLmZpbGVuYW1lID0gJ1VudGl0bGVkICcgKyBtaW5JbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFkb2MubWltZVR5cGUpIHtcbiAgICAgIC8vIFdlIHdlcmUgZ2l2ZW4gYSBiaXQgb2YgaW5mbyB3aXRoIHRoZSBmaWxlbmFtZSAvIGJhZCBfaWQ7XG4gICAgICAvLyB0cnkgdG8gaW5mZXIgdGhlIG1pbWVUeXBlIGZyb20gdGhhdCAoYWdhaW4gdXNlIGFwcGxpY2F0aW9uL2pzb25cbiAgICAgIC8vIGlmIHRoYXQgZmFpbHMpXG4gICAgICBkb2MubWltZVR5cGUgPSBtaW1lLmxvb2t1cChkb2MuZmlsZW5hbWUpIHx8ICdhcHBsaWNhdGlvbi9qc29uJztcbiAgICB9XG4gICAgZG9jLm1pbWVUeXBlID0gZG9jLm1pbWVUeXBlLnRvTG93ZXJDYXNlKCk7XG4gICAgZG9jLl9pZCA9IGRvYy5taW1lVHlwZSArICc7JyArIGRvYy5maWxlbmFtZTtcbiAgfVxuICBpZiAoZG9jLl9pZFswXSA9PT0gJ18nIHx8IGRvYy5faWRbMF0gPT09ICckJykge1xuICAgIHRocm93IG5ldyBFcnJvcignRG9jdW1lbnQgX2lkcyBtYXkgbm90IHN0YXJ0IHdpdGggJyArIGRvYy5faWRbMF0gKyAnOiAnICsgZG9jLl9pZCk7XG4gIH1cbiAgZG9jLm1pbWVUeXBlID0gZG9jLm1pbWVUeXBlIHx8IGRvYy5faWQuc3BsaXQoJzsnKVswXTtcbiAgaWYgKCFtaW1lLmV4dGVuc2lvbihkb2MubWltZVR5cGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1pbWVUeXBlOiAnICsgZG9jLm1pbWVUeXBlKTtcbiAgfVxuICBkb2MuZmlsZW5hbWUgPSBkb2MuZmlsZW5hbWUgfHwgZG9jLl9pZC5zcGxpdCgnOycpWzFdO1xuICBkb2MuY2hhcnNldCA9IChkb2MuY2hhcnNldCB8fCAnVVRGLTgnKS50b1VwcGVyQ2FzZSgpO1xuXG4gIGRvYy5vcnBoYW5zID0gZG9jLm9ycGhhbnMgfHwge307XG4gIGRvYy5vcnBoYW5zLl9pZCA9ICdAJC5vcnBoYW5zJztcblxuICBkb2MuY2xhc3NlcyA9IGRvYy5jbGFzc2VzIHx8IHt9O1xuICBkb2MuY2xhc3Nlcy5faWQgPSAnQCQuY2xhc3Nlcyc7XG5cbiAgZG9jLmNvbnRlbnRzID0gZG9jLmNvbnRlbnRzIHx8IHt9O1xuICAvLyBJbiBjYXNlIGRvYy5jb250ZW50cyBpcyBhbiBhcnJheSwgcHJlcCBpdCBmb3IgQ29udGFpbmVyV3JhcHBlci5zdGFuZGFyZGl6ZVxuICBkb2MuY29udGVudHMgPSBDb250YWluZXJXcmFwcGVyLmNvbnZlcnRBcnJheShkb2MuY29udGVudHMpO1xuICBkb2MuY29udGVudHMgPSBDb250YWluZXJXcmFwcGVyLnN0YW5kYXJkaXplKHtcbiAgICBtdXJlLFxuICAgIHZhbHVlOiBkb2MuY29udGVudHMsXG4gICAgcGF0aDogW2B7XCJfaWRcIjpcIiR7ZG9jLl9pZH1cIn1gLCAnJCcsICdjb250ZW50cyddLFxuICAgIGRvYyxcbiAgICBhZ2dyZXNzaXZlXG4gIH0pO1xuXG4gIHJldHVybiBkb2M7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBEb2N1bWVudFdyYXBwZXI7XG4iLCJpbXBvcnQgVHlwZWRXcmFwcGVyIGZyb20gJy4vVHlwZWRXcmFwcGVyLmpzJztcblxuY2xhc3MgUHJpbWl0aXZlV3JhcHBlciBleHRlbmRzIFR5cGVkV3JhcHBlciB7XG4gIHN0cmluZ1ZhbHVlICgpIHtcbiAgICByZXR1cm4gU3RyaW5nKHRoaXMudmFsdWUpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByaW1pdGl2ZVdyYXBwZXI7XG4iLCJpbXBvcnQganNvblBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IEJhc2VXcmFwcGVyIGZyb20gJy4vQmFzZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBJbnZhbGlkV3JhcHBlciBleHRlbmRzIEJhc2VXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgbGV0IHBhcmVudDtcbiAgICBpZiAocGF0aC5sZW5ndGggPCAyKSB7XG4gICAgICBwYXJlbnQgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAocGF0aC5sZW5ndGggPT09IDIpIHtcbiAgICAgIHBhcmVudCA9IGRvYztcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHRlbXAgPSBqc29uUGF0aC5zdHJpbmdpZnkocGF0aC5zbGljZSgxLCBwYXRoLmxlbmd0aCAtIDEpKTtcbiAgICAgIHBhcmVudCA9IGpzb25QYXRoLnZhbHVlKGRvYywgdGVtcCk7XG4gICAgfVxuICAgIGNvbnN0IGRvY1BhdGhRdWVyeSA9IHBhdGhbMF0gfHwgJyc7XG4gICAgY29uc3QgdW5pcXVlSnNvblBhdGggPSBqc29uUGF0aC5zdHJpbmdpZnkocGF0aC5zbGljZSgxKSk7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIHBhdGgsXG4gICAgICB2YWx1ZSxcbiAgICAgIHBhcmVudCxcbiAgICAgIGRvYyxcbiAgICAgIGxhYmVsOiBwYXRoW3BhdGgubGVuZ3RoIC0gMV0sXG4gICAgICB1bmlxdWVTZWxlY3RvcjogJ0AnICsgZG9jUGF0aFF1ZXJ5ICsgdW5pcXVlSnNvblBhdGhcbiAgICB9KTtcbiAgfVxuICBzdHJpbmdWYWx1ZSAoKSB7XG4gICAgcmV0dXJuICdJbnZhbGlkOiAnICsgU3RyaW5nKHRoaXMudmFsdWUpO1xuICB9XG59XG5JbnZhbGlkV3JhcHBlci5KU1RZUEUgPSAnb2JqZWN0JztcbkludmFsaWRXcmFwcGVyLmlzQmFkVmFsdWUgPSB2YWx1ZSA9PiB0cnVlO1xuXG5leHBvcnQgZGVmYXVsdCBJbnZhbGlkV3JhcHBlcjtcbiIsImltcG9ydCBQcmltaXRpdmVXcmFwcGVyIGZyb20gJy4vUHJpbWl0aXZlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE51bGxXcmFwcGVyIGV4dGVuZHMgUHJpbWl0aXZlV3JhcHBlciB7fVxuTnVsbFdyYXBwZXIuSlNUWVBFID0gJ251bGwnO1xuTnVsbFdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IG51bGw7XG5OdWxsV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICgpID0+IG51bGw7XG5cbmV4cG9ydCBkZWZhdWx0IE51bGxXcmFwcGVyO1xuIiwiaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9QcmltaXRpdmVXcmFwcGVyLmpzJztcblxuY2xhc3MgQm9vbGVhbldyYXBwZXIgZXh0ZW5kcyBQcmltaXRpdmVXcmFwcGVyIHt9XG5Cb29sZWFuV3JhcHBlci5KU1RZUEUgPSAnYm9vbGVhbic7XG5Cb29sZWFuV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4gZmFsc2U7XG5Cb29sZWFuV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IHZhbHVlIH0pID0+ICEhdmFsdWU7XG5cbmV4cG9ydCBkZWZhdWx0IEJvb2xlYW5XcmFwcGVyO1xuIiwiaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9QcmltaXRpdmVXcmFwcGVyLmpzJztcblxuY2xhc3MgTnVtYmVyV3JhcHBlciBleHRlbmRzIFByaW1pdGl2ZVdyYXBwZXIge31cbk51bWJlcldyYXBwZXIuSlNUWVBFID0gJ251bWJlcic7XG5OdW1iZXJXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiAwO1xuTnVtYmVyV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IHZhbHVlIH0pID0+IE51bWJlcih2YWx1ZSk7XG5OdW1iZXJXcmFwcGVyLmlzQmFkVmFsdWUgPSBpc05hTjtcblxuZXhwb3J0IGRlZmF1bHQgTnVtYmVyV3JhcHBlcjtcbiIsImltcG9ydCBQcmltaXRpdmVXcmFwcGVyIGZyb20gJy4vUHJpbWl0aXZlV3JhcHBlci5qcyc7XG5cbmNsYXNzIFN0cmluZ1dyYXBwZXIgZXh0ZW5kcyBQcmltaXRpdmVXcmFwcGVyIHt9XG5TdHJpbmdXcmFwcGVyLkpTVFlQRSA9ICdzdHJpbmcnO1xuU3RyaW5nV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4gJyc7XG5TdHJpbmdXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4ge1xuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gIH1cbn07XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ1dyYXBwZXI7XG4iLCJpbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBEYXRlV3JhcHBlciBleHRlbmRzIFByaW1pdGl2ZVdyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBzdXBlcih7IG11cmUsIHZhbHVlOiBEYXRlV3JhcHBlci5zdGFuZGFyZGl6ZSh2YWx1ZSksIHBhdGgsIGRvYyB9KTtcbiAgfVxuICBnZXQgdmFsdWUgKCkgeyByZXR1cm4gbmV3IERhdGUodGhpcy5fdmFsdWUuc3RyKTsgfVxuICBzZXQgdmFsdWUgKG5ld1ZhbHVlKSB7XG4gICAgc3VwZXIudmFsdWUgPSBEYXRlV3JhcHBlci5zdGFuZGFyZGl6ZShuZXdWYWx1ZSk7XG4gIH1cbiAgc3RyaW5nVmFsdWUgKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy52YWx1ZSk7XG4gIH1cbn1cbkRhdGVXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiBuZXcgRGF0ZSgpO1xuRGF0ZVdyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyB2YWx1ZSB9KSA9PiB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsdWUgPSBuZXcgRGF0ZSh2YWx1ZSk7XG4gIH1cbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHZhbHVlID0ge1xuICAgICAgJGlzRGF0ZTogdHJ1ZSxcbiAgICAgIHN0cjogdmFsdWUudG9TdHJpbmcoKVxuICAgIH07XG4gIH1cbiAgaWYgKCF2YWx1ZS4kaXNEYXRlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gd3JhcCBEYXRlIG9iamVjdGApO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5EYXRlV3JhcHBlci5pc0JhZFZhbHVlID0gdmFsdWUgPT4gdmFsdWUudG9TdHJpbmcoKSAhPT0gJ0ludmFsaWQgRGF0ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IERhdGVXcmFwcGVyO1xuIiwiaW1wb3J0IFN0cmluZ1dyYXBwZXIgZnJvbSAnLi9TdHJpbmdXcmFwcGVyLmpzJztcblxuY2xhc3MgUmVmZXJlbmNlV3JhcHBlciBleHRlbmRzIFN0cmluZ1dyYXBwZXIge31cblJlZmVyZW5jZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+ICdAJCc7XG5cbmV4cG9ydCBkZWZhdWx0IFJlZmVyZW5jZVdyYXBwZXI7XG4iLCJpbXBvcnQganNvblBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXIgZnJvbSAnLi9Db250YWluZXJXcmFwcGVyLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBDb250YWluZXJXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgc3VwZXIoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pO1xuICAgIGlmICghdmFsdWUuJHRhZ3MpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdlbmVyaWNXcmFwcGVyIHJlcXVpcmVzIGEgJHRhZ3Mgb2JqZWN0YCk7XG4gICAgfVxuICB9XG4gIGFkZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICBpZiAoIXRoaXMuZG9jLmNsYXNzZXNbY2xhc3NOYW1lXSkge1xuICAgICAgdGhpcy5kb2MuY2xhc3Nlc1tjbGFzc05hbWVdID0gdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSgpO1xuICAgICAgdGhpcy5kb2MuY2xhc3Nlc1tjbGFzc05hbWVdLl9pZCA9ICdAJyArIGpzb25QYXRoLnN0cmluZ2lmeShbJyQnLCAnY2xhc3NlcycsIGNsYXNzTmFtZV0pO1xuICAgIH1cbiAgICBjb25zdCBjbGFzc0l0ZW0gPSBuZXcgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIoe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgcGF0aDogW3RoaXMucGF0aFswXSwgJyQnLCAnY2xhc3NlcycsIGNsYXNzTmFtZV0sXG4gICAgICB2YWx1ZTogdGhpcy5kb2MuY2xhc3Nlc1tjbGFzc05hbWVdLFxuICAgICAgZG9jOiB0aGlzLmRvY1xuICAgIH0pO1xuICAgIGNsYXNzSXRlbS5hZGRXcmFwcGVyKHRoaXMpO1xuICB9XG4gIGdldENsYXNzZXMgKCkge1xuICAgIGlmICghdGhpcy52YWx1ZSB8fCAhdGhpcy52YWx1ZS4kdGFncykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy52YWx1ZS4kdGFncykucmVkdWNlKChhZ2csIHNldElkKSA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gdGhpcy5tdXJlLmV4dHJhY3RDbGFzc0luZm9Gcm9tSWQoc2V0SWQpO1xuICAgICAgaWYgKHRlbXApIHtcbiAgICAgICAgYWdnLnB1c2godGVtcC5jbGFzc05hbWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSkuc29ydCgpO1xuICB9XG59XG5HZW5lcmljV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkdGFnczoge30gfTtcbn07XG5HZW5lcmljV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBEbyB0aGUgcmVndWxhciBDb250YWluZXJXcmFwcGVyIHN0YW5kYXJkaXphdGlvblxuICB2YWx1ZSA9IENvbnRhaW5lcldyYXBwZXIuc3RhbmRhcmRpemUoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jLCBhZ2dyZXNzaXZlIH0pO1xuICAvLyBFbnN1cmUgdGhlIGV4aXN0ZW5jZSBvZiBhICR0YWdzIG9iamVjdFxuICB2YWx1ZS4kdGFncyA9IHZhbHVlLiR0YWdzIHx8IHt9O1xuICAvLyBNb3ZlIGFueSBleGlzdGluZyBjbGFzcyBkZWZpbml0aW9ucyB0byB0aGlzIGRvY3VtZW50XG4gIE9iamVjdC5rZXlzKHZhbHVlLiR0YWdzKS5mb3JFYWNoKHNldElkID0+IHtcbiAgICBjb25zdCB0ZW1wID0gbXVyZS5leHRyYWN0Q2xhc3NJbmZvRnJvbUlkKHNldElkKTtcbiAgICBpZiAodGVtcCkge1xuICAgICAgZGVsZXRlIHZhbHVlLiR0YWdzW3NldElkXTtcblxuICAgICAgc2V0SWQgPSBkb2MuY2xhc3Nlcy5faWQgKyB0ZW1wLmNsYXNzUGF0aENodW5rO1xuICAgICAgdmFsdWUuJHRhZ3Nbc2V0SWRdID0gdHJ1ZTtcblxuICAgICAgZG9jLmNsYXNzZXNbdGVtcC5jbGFzc05hbWVdID0gZG9jLmNsYXNzZXNbdGVtcC5jbGFzc05hbWVdIHx8IHsgX2lkOiBzZXRJZCwgJG1lbWJlcnM6IHt9IH07XG4gICAgICBkb2MuY2xhc3Nlc1t0ZW1wLmNsYXNzTmFtZV0uJG1lbWJlcnNbdmFsdWUuX2lkXSA9IHRydWU7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJleHBvcnQgZGVmYXVsdCAoc3VwZXJjbGFzcykgPT4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgc3VwZXIoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pO1xuICAgIGlmICghdmFsdWUuJG1lbWJlcnMpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFNldFdyYXBwZXIgcmVxdWlyZXMgYSAkbWVtYmVycyBvYmplY3RgKTtcbiAgICB9XG4gIH1cbiAgYWRkV3JhcHBlciAoaXRlbSkge1xuICAgIGNvbnN0IGl0ZW1UYWcgPSBpdGVtLnZhbHVlLl9pZDtcbiAgICBjb25zdCBzZXRUYWcgPSB0aGlzLnZhbHVlLl9pZDtcbiAgICB0aGlzLnZhbHVlLiRtZW1iZXJzW2l0ZW1UYWddID0gdHJ1ZTtcbiAgICBpdGVtLnZhbHVlLiR0YWdzW3NldFRhZ10gPSB0cnVlO1xuICB9XG4gIGdldE1lbWJlclNlbGVjdG9ycyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMudmFsdWUuJG1lbWJlcnMpO1xuICB9XG4gIGFzeW5jIGdldE1lbWJlcnMgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUuc2VsZWN0QWxsKHRoaXMuZ2V0TWVtYmVyU2VsZWN0b3JzKCkpLml0ZW1zKCk7XG4gIH1cbn07XG4iLCJpbXBvcnQgVHlwZWRXcmFwcGVyIGZyb20gJy4vVHlwZWRXcmFwcGVyLmpzJztcbmltcG9ydCBTZXRXcmFwcGVyTWl4aW4gZnJvbSAnLi9TZXRXcmFwcGVyTWl4aW4uanMnO1xuXG5jbGFzcyBTZXRXcmFwcGVyIGV4dGVuZHMgU2V0V3JhcHBlck1peGluKFR5cGVkV3JhcHBlcikge31cblNldFdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgcmV0dXJuIHsgJG1lbWJlcnM6IHt9IH07XG59O1xuU2V0V3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IHZhbHVlIH0pID0+IHtcbiAgLy8gRW5zdXJlIHRoZSBleGlzdGVuY2Ugb2YgYSAkbWVtYmVycyBvYmplY3RcbiAgdmFsdWUuJG1lbWJlcnMgPSB2YWx1ZS4kbWVtYmVycyB8fCB7fTtcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgU2V0V3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIHN1cGVyKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KTtcbiAgICBpZiAoIXZhbHVlLiRub2Rlcykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgRWRnZVdyYXBwZXIgcmVxdWlyZXMgYSAkbm9kZXMgb2JqZWN0YCk7XG4gICAgfVxuICB9XG4gIGF0dGFjaFRvIChub2RlLCBkaXJlY3Rpb24gPSAndW5kaXJlY3RlZCcpIHtcbiAgICBub2RlLnZhbHVlLiRlZGdlc1t0aGlzLnVuaXF1ZVNlbGVjdG9yXSA9IHRydWU7XG4gICAgbGV0IG5vZGVJZCA9IG5vZGUudW5pcXVlU2VsZWN0b3I7XG4gICAgdGhpcy52YWx1ZS4kbm9kZXNbbm9kZUlkXSA9IHRoaXMudmFsdWUuJG5vZGVzW25vZGVJZF0gfHwge307XG4gICAgdGhpcy52YWx1ZS4kbm9kZXNbbm9kZUlkXVtkaXJlY3Rpb25dID0gdGhpcy52YWx1ZS4kbm9kZXNbbm9kZUlkXVtkaXJlY3Rpb25dIHx8IDA7XG4gICAgdGhpcy52YWx1ZS4kbm9kZXNbbm9kZUlkXVtkaXJlY3Rpb25dICs9IDE7XG4gIH1cbiAgYXN5bmMgbm9kZVNlbGVjdG9ycyAoZGlyZWN0aW9uID0gbnVsbCkge1xuICAgIHJldHVybiBPYmplY3QuZW50cmllcyh0aGlzLnZhbHVlLiRub2RlcylcbiAgICAgIC5maWx0ZXIoKFtzZWxlY3RvciwgZGlyZWN0aW9uc10pID0+IHtcbiAgICAgICAgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB3ZSBhbGxvdyBhbGwgbW92ZW1lbnRcbiAgICAgICAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gbnVsbCB8fCBkaXJlY3Rpb25zW2RpcmVjdGlvbl07XG4gICAgICB9KS5tYXAoKFtzZWxlY3RvciwgZGlyZWN0aW9uc10pID0+IHNlbGVjdG9yKTtcbiAgfVxuICBhc3luYyBub2RlV3JhcHBlcnMgKGZvcndhcmQgPSBudWxsKSB7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5zZWxlY3RBbGwoKGF3YWl0IHRoaXMubm9kZVNlbGVjdG9ycyhmb3J3YXJkKSkpLml0ZW1zKCk7XG4gIH1cbiAgYXN5bmMgbm9kZVdyYXBwZXJDb3VudCAoZm9yd2FyZCA9IG51bGwpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMubm9kZVNlbGVjdG9ycyhmb3J3YXJkKSkubGVuZ3RoO1xuICB9XG59XG5FZGdlV3JhcHBlci5vcHBvc2l0ZURpcmVjdGlvbiA9IGRpcmVjdGlvbiA9PiB7XG4gIHJldHVybiBkaXJlY3Rpb24gPT09ICdzb3VyY2UnID8gJ3RhcmdldCdcbiAgICA6IGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcgPyAnc291cmNlJ1xuICAgICAgOiAndW5kaXJlY3RlZCc7XG59O1xuRWRnZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgcmV0dXJuIHsgJHRhZ3M6IHt9LCAkbm9kZXM6IHt9IH07XG59O1xuRWRnZVdyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jLCBhZ2dyZXNzaXZlIH0pID0+IHtcbiAgLy8gRG8gdGhlIHJlZ3VsYXIgR2VuZXJpY1dyYXBwZXIgc3RhbmRhcmRpemF0aW9uXG4gIHZhbHVlID0gR2VuZXJpY1dyYXBwZXIuc3RhbmRhcmRpemUoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jLCBhZ2dyZXNzaXZlIH0pO1xuICAvLyBFbnN1cmUgdGhlIGV4aXN0ZW5jZSBvZiBhICRub2RlcyBvYmplY3RcbiAgdmFsdWUuJG5vZGVzID0gdmFsdWUuJG5vZGVzIHx8IHt9O1xuICByZXR1cm4gdmFsdWU7XG59O1xuRWRnZVdyYXBwZXIuZ2xvbXBWYWx1ZSA9IGVkZ2VMaXN0ID0+IHtcbiAgbGV0IHRlbXAgPSBHZW5lcmljV3JhcHBlci5nbG9tcChlZGdlTGlzdCk7XG4gIHRlbXAudmFsdWUuJG5vZGVzID0ge307XG4gIGVkZ2VMaXN0LmZvckVhY2goZWRnZVdyYXBwZXIgPT4ge1xuICAgIE9iamVjdC5lbnRyaWVzKGVkZ2VXcmFwcGVyLnZhbHVlLiRub2RlcykuZm9yRWFjaCgoW3NlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4ge1xuICAgICAgdGVtcC4kbm9kZXNbc2VsZWN0b3JdID0gdGVtcC52YWx1ZS4kbm9kZXNbc2VsZWN0b3JdIHx8IHt9O1xuICAgICAgT2JqZWN0LmtleXMoZGlyZWN0aW9ucykuZm9yRWFjaChkaXJlY3Rpb24gPT4ge1xuICAgICAgICB0ZW1wLnZhbHVlLiRub2Rlc1tzZWxlY3Rvcl1bZGlyZWN0aW9uXSA9IHRlbXAudmFsdWUuJG5vZGVzW3NlbGVjdG9yXVtkaXJlY3Rpb25dIHx8IDA7XG4gICAgICAgIHRlbXAudmFsdWUuJG5vZGVzW3NlbGVjdG9yXVtkaXJlY3Rpb25dICs9IGRpcmVjdGlvbnNbZGlyZWN0aW9uXTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHRlbXA7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuL0VkZ2VXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIHN1cGVyKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KTtcbiAgICBpZiAoIXZhbHVlLiRlZGdlcykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgTm9kZVdyYXBwZXIgcmVxdWlyZXMgYW4gJGVkZ2VzIG9iamVjdGApO1xuICAgIH1cbiAgfVxuICBjb25uZWN0VG8gKG90aGVyTm9kZSwgY29udGFpbmVyLCBkaXJlY3Rpb24gPSAndW5kaXJlY3RlZCcpIHtcbiAgICBsZXQgbmV3RWRnZSA9IGNvbnRhaW5lci5jcmVhdGVOZXdXcmFwcGVyKHt9LCB1bmRlZmluZWQsIEVkZ2VXcmFwcGVyKTtcbiAgICBuZXdFZGdlLmF0dGFjaFRvKHRoaXMsIGRpcmVjdGlvbik7XG4gICAgbmV3RWRnZS5hdHRhY2hUbyhvdGhlck5vZGUsIEVkZ2VXcmFwcGVyLm9wcG9zaXRlRGlyZWN0aW9uKGRpcmVjdGlvbikpO1xuICAgIHJldHVybiBuZXdFZGdlO1xuICB9XG4gIGFzeW5jIGVkZ2VTZWxlY3RvcnMgKGRpcmVjdGlvbiA9IG51bGwpIHtcbiAgICBpZiAoZGlyZWN0aW9uID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy52YWx1ZS4kZWRnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gKGF3YWl0IHRoaXMuZWRnZVdyYXBwZXJzKGRpcmVjdGlvbikpLm1hcChpdGVtID0+IGl0ZW0udW5pcXVlU2VsZWN0b3IpO1xuICAgIH1cbiAgfVxuICBhc3luYyBlZGdlV3JhcHBlcnMgKGRpcmVjdGlvbiA9IG51bGwpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMubXVyZS5zZWxlY3RBbGwoT2JqZWN0LmtleXModGhpcy52YWx1ZS4kZWdkZXMpKSkuaXRlbXMoKVxuICAgICAgLmZpbHRlcihpdGVtID0+IHtcbiAgICAgICAgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB3ZSBhbGxvdyBhbGwgZWRnZXMuIElmIGRpcmVjdGlvbiBpc24ndCBudWxsLFxuICAgICAgICAvLyBvbmx5IGluY2x1ZGUgZWRnZXMgd2hlcmUgd2UgYXJlIHRoZSBPUFBPU0lURSBkaXJlY3Rpb24gKHdlIGFyZVxuICAgICAgICAvLyBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSB0cmF2ZXJzYWwpXG4gICAgICAgIHJldHVybiBkaXJlY3Rpb24gPT09IG51bGwgfHxcbiAgICAgICAgICBpdGVtLiRub2Rlc1t0aGlzLnVuaXF1ZVNlbGVjdG9yXVtFZGdlV3JhcHBlci5vcHBvc2l0ZURpcmVjdGlvbihkaXJlY3Rpb24pXTtcbiAgICAgIH0pO1xuICB9XG4gIGFzeW5jIGVkZ2VXcmFwcGVyQ291bnQgKGZvcndhcmQgPSBudWxsKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmVkZ2VTZWxlY3RvcnMoZm9yd2FyZCkpLmxlbmd0aDtcbiAgfVxufVxuTm9kZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgcmV0dXJuIHsgJHRhZ3M6IHt9LCAkZWRnZXM6IHt9IH07XG59O1xuTm9kZVdyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jLCBhZ2dyZXNzaXZlIH0pID0+IHtcbiAgLy8gRG8gdGhlIHJlZ3VsYXIgR2VuZXJpY1dyYXBwZXIgc3RhbmRhcmRpemF0aW9uXG4gIHZhbHVlID0gR2VuZXJpY1dyYXBwZXIuc3RhbmRhcmRpemUoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jLCBhZ2dyZXNzaXZlIH0pO1xuICAvLyBFbnN1cmUgdGhlIGV4aXN0ZW5jZSBvZiBhbiAkZWRnZXMgb2JqZWN0XG4gIHZhbHVlLiRlZGdlcyA9IHZhbHVlLiRlZGdlcyB8fCB7fTtcbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgU2V0V3JhcHBlciBmcm9tICcuL1NldFdyYXBwZXIuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4vTm9kZVdyYXBwZXIuanMnO1xuaW1wb3J0IFNldFdyYXBwZXJNaXhpbiBmcm9tICcuL1NldFdyYXBwZXJNaXhpbi5qcyc7XG5cbmNsYXNzIFN1cGVybm9kZVdyYXBwZXIgZXh0ZW5kcyBTZXRXcmFwcGVyTWl4aW4oTm9kZVdyYXBwZXIpIHt9XG5TdXBlcm5vZGVXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiB7XG4gIHJldHVybiB7ICR0YWdzOiB7fSwgJG1lbWJlcnM6IHt9LCAkZWRnZXM6IHt9IH07XG59O1xuU3VwZXJub2RlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBEbyB0aGUgcmVndWxhciBOb2RlV3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBOb2RlV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIC4uLiBhbmQgdGhlIFNldFdyYXBwZXIgc3RhbmRhcmRpemF0aW9uXG4gIHZhbHVlID0gU2V0V3JhcHBlci5zdGFuZGFyZGl6ZSh7IHZhbHVlIH0pO1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTdXBlcm5vZGVXcmFwcGVyO1xuIiwiY2xhc3MgSW5wdXRTcGVjIHtcbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHRoaXMub3B0aW9ucyA9IHt9O1xuICB9XG4gIGFkZE9wdGlvbiAob3B0aW9uKSB7XG4gICAgdGhpcy5vcHRpb25zW29wdGlvbi5wYXJhbWV0ZXJOYW1lXSA9IG9wdGlvbjtcbiAgfVxuICBhc3luYyB1cGRhdGVDaG9pY2VzIChwYXJhbXMpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoT2JqZWN0LnZhbHVlcyh0aGlzLm9wdGlvbnMpLm1hcChvcHRpb24gPT4ge1xuICAgICAgaWYgKG9wdGlvbi5zcGVjcykge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoT2JqZWN0LnZhbHVlcyhvcHRpb24uc3BlY3MpXG4gICAgICAgICAgLm1hcChzcGVjID0+IHNwZWMudXBkYXRlQ2hvaWNlcyhwYXJhbXMpKSk7XG4gICAgICB9IGVsc2UgaWYgKG9wdGlvbi51cGRhdGVDaG9pY2VzKSB7XG4gICAgICAgIHJldHVybiBvcHRpb24udXBkYXRlQ2hvaWNlcyhwYXJhbXMpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBJbnB1dFNwZWM7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgSW5wdXRPcHRpb24gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgcGFyYW1ldGVyTmFtZSxcbiAgICBkZWZhdWx0VmFsdWUgPSBudWxsLFxuICAgIGNob2ljZXMgPSBbXSxcbiAgICBvcGVuRW5kZWQgPSBmYWxzZVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnBhcmFtZXRlck5hbWUgPSBwYXJhbWV0ZXJOYW1lO1xuICAgIHRoaXMuX2RlZmF1bHRWYWx1ZSA9IGRlZmF1bHRWYWx1ZTtcbiAgICB0aGlzLmNob2ljZXMgPSBjaG9pY2VzO1xuICAgIHRoaXMub3BlbkVuZGVkID0gb3BlbkVuZGVkO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlUGFyYW1ldGVyTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyYW1ldGVyTmFtZVxuICAgICAgLnJlcGxhY2UoLy4vLCB0aGlzLnBhcmFtZXRlck5hbWVbMF0udG9Mb2NhbGVVcHBlckNhc2UoKSlcbiAgICAgIC5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxuICBnZXQgZGVmYXVsdFZhbHVlICgpIHtcbiAgICBpZiAodGhpcy5fZGVmYXVsdFZhbHVlICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdFZhbHVlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jaG9pY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0aGlzLmNob2ljZXNbMF07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICBzZXQgZGVmYXVsdFZhbHVlICh2YWx1ZSkge1xuICAgIHRoaXMuX2RlZmF1bHRWYWx1ZSA9IHZhbHVlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW5wdXRPcHRpb24sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKU9wdGlvbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IElucHV0T3B0aW9uO1xuIiwiY2xhc3MgT3V0cHV0U3BlYyB7XG4gIGNvbnN0cnVjdG9yICh7IG5ld1NlbGVjdG9ycyA9IG51bGwsIHBvbGx1dGVkRG9jcyA9IHt9LCB3YXJuaW5ncyA9IHt9IH0gPSB7fSkge1xuICAgIHRoaXMubmV3U2VsZWN0b3JzID0gbmV3U2VsZWN0b3JzO1xuICAgIHRoaXMucG9sbHV0ZWREb2NzID0gcG9sbHV0ZWREb2NzO1xuICAgIHRoaXMud2FybmluZ3MgPSB3YXJuaW5ncztcbiAgfVxuICBhZGRTZWxlY3RvcnMgKHNlbGVjdG9ycykge1xuICAgIHRoaXMubmV3U2VsZWN0b3JzID0gKHRoaXMubmV3U2VsZWN0b3JzIHx8IFtdKS5jb25jYXQoc2VsZWN0b3JzKTtcbiAgfVxuICBmbGFnUG9sbHV0ZWREb2MgKGRvYykge1xuICAgIHRoaXMucG9sbHV0ZWREb2NzW2RvYy5faWRdID0gZG9jO1xuICB9XG4gIHdhcm4gKHdhcm5pbmcpIHtcbiAgICB0aGlzLndhcm5pbmdzW3dhcm5pbmddID0gdGhpcy53YXJuaW5nc1t3YXJuaW5nXSB8fCAwO1xuICAgIHRoaXMud2FybmluZ3Nbd2FybmluZ10gKz0gMTtcbiAgfVxufVxuT3V0cHV0U3BlYy5nbG9tcCA9IHNwZWNMaXN0ID0+IHtcbiAgbGV0IG5ld1NlbGVjdG9ycyA9IHt9O1xuICBsZXQgcG9sbHV0ZWREb2NzID0ge307XG4gIGxldCB3YXJuaW5ncyA9IHt9O1xuICBzcGVjTGlzdC5mb3JFYWNoKHNwZWMgPT4ge1xuICAgIGlmIChzcGVjLm5ld1NlbGVjdG9ycykge1xuICAgICAgc3BlYy5uZXdTZWxlY3RvcnMuZm9yRWFjaChzZWxlY3RvciA9PiB7XG4gICAgICAgIG5ld1NlbGVjdG9yc1tzZWxlY3Rvcl0gPSB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICAgIE9iamVjdC52YWx1ZXMoc3BlYy5wb2xsdXRlZERvY3MpLmZvckVhY2goZG9jID0+IHtcbiAgICAgIHBvbGx1dGVkRG9jc1tkb2MuX2lkXSA9IGRvYztcbiAgICB9KTtcbiAgICBPYmplY3QuZW50cmllcyhzcGVjLndhcm5pbmdzKS5mb3JFYWNoKChbd2FybmluZywgY291bnRdKSA9PiB7XG4gICAgICB3YXJuaW5nc1t3YXJuaW5nXSA9IHdhcm5pbmdzW3dhcm5pbmddIHx8IDA7XG4gICAgICB3YXJuaW5nc1t3YXJuaW5nXSArPSBjb3VudDtcbiAgICB9KTtcbiAgfSk7XG4gIG5ld1NlbGVjdG9ycyA9IE9iamVjdC5rZXlzKG5ld1NlbGVjdG9ycyk7XG4gIHJldHVybiBuZXcgT3V0cHV0U3BlYyh7XG4gICAgbmV3U2VsZWN0b3JzOiBuZXdTZWxlY3RvcnMubGVuZ3RoID4gMCA/IG5ld1NlbGVjdG9ycyA6IG51bGwsXG4gICAgcG9sbHV0ZWREb2NzLFxuICAgIHdhcm5pbmdzXG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgT3V0cHV0U3BlYztcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi8uLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IElucHV0U3BlYyBmcm9tICcuL0lucHV0U3BlYy5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9JbnB1dE9wdGlvbi5qcyc7XG5pbXBvcnQgT3V0cHV0U3BlYyBmcm9tICcuL091dHB1dFNwZWMuanMnO1xuXG5jbGFzcyBCYXNlT3BlcmF0aW9uIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgfVxuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBJbnB1dFNwZWMoKTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnaWdub3JlRXJyb3JzJyxcbiAgICAgIGNob2ljZXM6IFsnU3RvcCBvbiBFcnJvcicsICdJZ25vcmUnXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1N0b3Agb24gRXJyb3InXG4gICAgfSkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgcG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHJldHVybiBpdGVtICYmIGlucHV0T3B0aW9ucy5pZ25vcmVFcnJvcnMgIT09ICdTdG9wIG9uIEVycm9yJztcbiAgfVxuICBhc3luYyBleGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gIH1cbiAgZ2V0SXRlbXNJblVzZSAoaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3QgaXRlbXNJblVzZSA9IHt9O1xuICAgIE9iamVjdC52YWx1ZXMoaW5wdXRPcHRpb25zKS5mb3JFYWNoKGFyZ3VtZW50ID0+IHtcbiAgICAgIGlmIChhcmd1bWVudCAmJiBhcmd1bWVudC51bmlxdWVTZWxlY3Rvcikge1xuICAgICAgICBpdGVtc0luVXNlW2FyZ3VtZW50LnVuaXF1ZVNlbGVjdG9yXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGl0ZW1zSW5Vc2U7XG4gIH1cbiAgYXN5bmMgcG90ZW50aWFsbHlFeGVjdXRhYmxlT25TZWxlY3Rpb24gKHNlbGVjdGlvbikge1xuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoaXRlbXMpLnNvbWUoaXRlbSA9PiB0aGlzLnBvdGVudGlhbGx5RXhlY3V0YWJsZU9uSXRlbShpdGVtKSk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IGl0ZW1zSW5Vc2UgPSB0aGlzLmdldEl0ZW1zSW5Vc2UoaW5wdXRPcHRpb25zKTtcbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgIGNvbnN0IGNhbkV4ZWN1dGVJbnN0YW5jZXMgPSAoYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LnZhbHVlcyhpdGVtcylcbiAgICAgIC5tYXAoaXRlbSA9PiB7XG4gICAgICAgIHJldHVybiBpdGVtc0luVXNlW2l0ZW0udW5pcXVlU2VsZWN0b3JdIHx8IHRoaXMuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKTtcbiAgICAgIH0pKSk7XG4gICAgaWYgKGNhbkV4ZWN1dGVJbnN0YW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBpZiAoaW5wdXRPcHRpb25zLmlnbm9yZUVycm9ycyA9PT0gJ1N0b3Agb24gRXJyb3InKSB7XG4gICAgICByZXR1cm4gY2FuRXhlY3V0ZUluc3RhbmNlcy5ldmVyeShjYW5FeGVjdXRlID0+IGNhbkV4ZWN1dGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY2FuRXhlY3V0ZUluc3RhbmNlcy5zb21lKGNhbkV4ZWN1dGUgPT4gY2FuRXhlY3V0ZSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBpdGVtc0luVXNlID0gdGhpcy5nZXRJdGVtc0luVXNlKGlucHV0T3B0aW9ucyk7XG4gICAgY29uc3QgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICBjb25zdCBvdXRwdXRTcGVjUHJvbWlzZXMgPSBPYmplY3QudmFsdWVzKGl0ZW1zKS5tYXAoaXRlbSA9PiB7XG4gICAgICBpZiAoaXRlbXNJblVzZVtpdGVtLnVuaXF1ZVNlbGVjdG9yXSkge1xuICAgICAgICByZXR1cm4gbmV3IE91dHB1dFNwZWMoKTsgLy8gSWdub3JlIGl0ZW1zIHRoYXQgYXJlIGlucHV0T3B0aW9uc1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gT3V0cHV0U3BlYy5nbG9tcChhd2FpdCBQcm9taXNlLmFsbChvdXRwdXRTcGVjUHJvbWlzZXMpKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VPcGVyYXRpb24sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKU9wZXJhdGlvbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcblxuZXhwb3J0IGRlZmF1bHQgQmFzZU9wZXJhdGlvbjtcbiIsImltcG9ydCBJbnB1dFNwZWMgZnJvbSAnLi9JbnB1dFNwZWMuanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vSW5wdXRPcHRpb24uanMnO1xuXG5jbGFzcyBDb250ZXh0dWFsT3B0aW9uIGV4dGVuZHMgSW5wdXRPcHRpb24ge1xuICBjb25zdHJ1Y3RvciAoeyBwYXJhbWV0ZXJOYW1lLCBkZWZhdWx0VmFsdWUsIGNob2ljZXMgPSBbXSwgaGlkZGVuQ2hvaWNlcyA9IFtdIH0pIHtcbiAgICBpZiAoY2hvaWNlcy5sZW5ndGggPCAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbnRleHR1YWwgb3B0aW9ucyBtdXN0IHNwZWNpZnkgYXQgbGVhc3QgdHdvIGNob2ljZXMgYSBwcmlvcmknKTtcbiAgICB9XG4gICAgc3VwZXIoeyBwYXJhbWV0ZXJOYW1lLCBkZWZhdWx0VmFsdWUsIGNob2ljZXMsIG9wZW5FbmRlZDogZmFsc2UgfSk7XG4gICAgdGhpcy5zcGVjcyA9IHt9O1xuICAgIGNob2ljZXMuY29uY2F0KGhpZGRlbkNob2ljZXMpLmZvckVhY2goY2hvaWNlID0+IHtcbiAgICAgIHRoaXMuc3BlY3NbY2hvaWNlXSA9IG5ldyBJbnB1dFNwZWMoKTtcbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29udGV4dHVhbE9wdGlvbjtcbiIsImltcG9ydCBTZWxlY3Rpb24gZnJvbSAnLi4vU2VsZWN0aW9uLmpzJztcbmltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBJbnB1dE9wdGlvbiBmcm9tICcuL0NvbW1vbi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNsYXNzIFNlbGVjdEFsbE9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLmdldElucHV0U3BlYygpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29udGV4dCcsXG4gICAgICBjaG9pY2VzOiBbJ0NoaWxkcmVuJywgJ1BhcmVudHMnLCAnTm9kZXMnLCAnRWRnZXMnLCAnTWVtYmVycyddLFxuICAgICAgaGlkZGVuQ2hvaWNlczogWydTZWxlY3RvcicsICdTZWxlY3RvciBMaXN0JywgJ1NlbGVjdGlvbiddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnQ2hpbGRyZW4nXG4gICAgfSk7XG4gICAgcmVzdWx0LmFkZE9wdGlvbihjb250ZXh0KTtcblxuICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZGlyZWN0aW9uJyxcbiAgICAgIGNob2ljZXM6IFsnSWdub3JlJywgJ0ZvcndhcmQnLCAnQmFja3dhcmQnXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ0lnbm9yZSdcbiAgICB9KTtcbiAgICBjb250ZXh0LnNwZWNzWydOb2RlcyddLmFkZE9wdGlvbihkaXJlY3Rpb24pO1xuICAgIGNvbnRleHQuc3BlY3NbJ0VkZ2VzJ10uYWRkT3B0aW9uKGRpcmVjdGlvbik7XG5cbiAgICAvLyBFeHRyYSBzZXR0aW5ncyBmb3IgaGlkZGVuIG1vZGVzOlxuICAgIGNvbnRleHQuc3BlY3NbJ1NlbGVjdG9yJ10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnYXBwZW5kJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1sqXScsXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3IgTGlzdCddLmFkZE9wdGlvbihuZXcgSW5wdXRPcHRpb24oe1xuICAgICAgcGFyYW10ZXJOYW1lOiAnc2VsZWN0b3JMaXN0JyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogW11cbiAgICB9KSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0aW9uJ10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnb3RoZXJTZWxlY3Rpb24nXG4gICAgfSkpO1xuXG4gICAgY29uc3QgbW9kZSA9IG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnbW9kZScsXG4gICAgICBjaG9pY2VzOiBbJ1JlcGxhY2UnLCAnVW5pb24nLCAnWE9SJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdSZXBsYWNlJ1xuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ1NlbGVjdG9yJ10uYWRkT3B0aW9uKG1vZGUpO1xuICAgIGNvbnRleHQuc3BlY3NbJ1NlbGVjdG9yIExpc3QnXS5hZGRPcHRpb24obW9kZSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0aW9uJ10uYWRkT3B0aW9uKG1vZGUpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgaWYgKGF3YWl0IHN1cGVyLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0sIGlucHV0T3B0aW9ucykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdDaGlsZHJlbicpIHtcbiAgICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIgfHxcbiAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXI7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1BhcmVudHMnKSB7XG4gICAgICByZXR1cm4gIShpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlciB8fFxuICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlJvb3RXcmFwcGVyKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnTm9kZXMnKSB7XG4gICAgICByZXR1cm4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciB8fFxuICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdFZGdlcycpIHtcbiAgICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ01lbWJlcnMnKSB7XG4gICAgICByZXR1cm4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnU2VsZWN0b3InKSB7XG4gICAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IoaXRlbS51bmlxdWVTZWxlY3RvciArIGlucHV0T3B0aW9ucy5hcHBlbmQpICE9PSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgT3V0cHV0U3BlYygpO1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IGlucHV0T3B0aW9ucy5kaXJlY3Rpb24gfHwgJ0lnbm9yZSc7XG4gICAgY29uc3QgZm9yd2FyZCA9IGRpcmVjdGlvbiA9PT0gJ0ZvcndhcmQnID8gdHJ1ZVxuICAgICAgOiBkaXJlY3Rpb24gPT09ICdCYWNrd2FyZCcgPyBmYWxzZVxuICAgICAgICA6IG51bGw7XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQ2hpbGRyZW4nICYmXG4gICAgICAgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoT2JqZWN0LnZhbHVlcyhpdGVtLmdldENvbnRlbnRzKCkpXG4gICAgICAgIC5tYXAoY2hpbGRXcmFwcGVyID0+IGNoaWxkV3JhcHBlci51bmlxdWVTZWxlY3RvcikpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdQYXJlbnRzJyAmJlxuICAgICAgICAgICAgICEoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIpKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtpdGVtLnBhcmVudFdyYXBwZXIudW5pcXVlU2VsZWN0b3JdKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnTm9kZXMnICYmXG4gICAgICAgICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKGF3YWl0IGl0ZW0ubm9kZVNlbGVjdG9ycyhmb3J3YXJkKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ05vZGVzJyAmJlxuICAgICAgICAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikge1xuICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhhd2FpdCBQcm9taXNlLmFsbCgoYXdhaXQgaXRlbS5lZGdlV3JhcHBlcnMoZm9yd2FyZCkpXG4gICAgICAgIC5tYXAoZWRnZSA9PiBlZGdlLm5vZGVTZWxlY3RvcnMoZm9yd2FyZCkpKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0VkZ2VzJyAmJlxuICAgICAgICAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikge1xuICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhhd2FpdCBpdGVtLmVkZ2VTZWxlY3RvcnMoZm9yd2FyZCkpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdFZGdlcycgJiZcbiAgICAgICAgICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoYXdhaXQgUHJvbWlzZS5hbGwoKGF3YWl0IGl0ZW0ubm9kZVdyYXBwZXJzKGZvcndhcmQpKVxuICAgICAgICAubWFwKG5vZGUgPT4gbm9kZS5lZGdlU2VsZWN0b3JzKGZvcndhcmQpKSkpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdNZW1iZXJzJyAmJlxuICAgICAgICAgICAgICAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyIHx8XG4gICAgICAgICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIpKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKGF3YWl0IGl0ZW0uZ2V0TWVtYmVyU2VsZWN0b3JzKCkpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdTZWxlY3RvcicpIHtcbiAgICAgIGNvbnN0IG5ld1N0cmluZyA9IGl0ZW0udW5pcXVlU2VsZWN0b3IgKyBpbnB1dE9wdGlvbnMuYXBwZW5kO1xuICAgICAgY29uc3QgbmV3U2VsZWN0b3IgPSB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihuZXdTdHJpbmcpO1xuICAgICAgaWYgKG5ld1NlbGVjdG9yID09PSBudWxsKSB7XG4gICAgICAgIG91dHB1dC53YXJuKGBJbnZhbGlkIHNlbGVjdG9yOiAke25ld1N0cmluZ31gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoW25ld1N0cmluZ10pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQud2FybihgQ2FuJ3Qgc2VsZWN0ICR7aW5wdXRPcHRpb25zLmNvbnRleHR9IGZyb20gJHtpdGVtLnR5cGV9YCk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1NlbGVjdG9yIExpc3QnKSB7XG4gICAgICByZXR1cm4gaW5wdXRPcHRpb25zLnNlbGVjdG9yTGlzdCBpbnN0YW5jZW9mIEFycmF5O1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdTZWxlY3Rpb24nKSB7XG4gICAgICByZXR1cm4gaW5wdXRPcHRpb25zLm90aGVyU2VsZWN0aW9uIGluc3RhbmNlb2YgU2VsZWN0aW9uO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3VwZXIuY2FuRXhlY3V0ZU9uU2VsZWN0aW9uKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGxldCBvdGhlclNlbGVjdG9yTGlzdCA9IGlucHV0T3B0aW9ucy5zZWxlY3Rvckxpc3QgfHxcbiAgICAgIChpbnB1dE9wdGlvbnMub3RoZXJTZWxlY3Rpb24gJiYgaW5wdXRPcHRpb25zLm90aGVyU2VsZWN0aW9uLnNlbGVjdG9yTGlzdCk7XG4gICAgaWYgKG90aGVyU2VsZWN0b3JMaXN0KSB7XG4gICAgICBjb25zdCBvdXRwdXQgPSBuZXcgT3V0cHV0U3BlYygpO1xuICAgICAgaWYgKGlucHV0T3B0aW9ucy5tb2RlID09PSAnVW5pb24nKSB7XG4gICAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoc2VsZWN0aW9uLnNlbGVjdG9yTGlzdC5jb25jYXQob3RoZXJTZWxlY3Rvckxpc3QpKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdYT1InKSB7XG4gICAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMob3RoZXJTZWxlY3Rvckxpc3RcbiAgICAgICAgICAuZmlsdGVyKHNlbGVjdG9yID0+IHNlbGVjdGlvbi5zZWxlY3Rvckxpc3QuaW5kZXhPZihzZWxlY3RvcikgPT09IC0xKVxuICAgICAgICAgIC5jb25jYXQoc2VsZWN0aW9uLnNlbGVjdG9yTGlzdFxuICAgICAgICAgICAgLmZpbHRlcihzZWxlY3RvciA9PiBvdGhlclNlbGVjdG9yTGlzdC5pbmRleE9mKHNlbGVjdG9yKSA9PT0gLTEpKSk7XG4gICAgICB9IGVsc2UgeyAvLyBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdSZXBsYWNlJykge1xuICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKG90aGVyU2VsZWN0b3JMaXN0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdXBlci5leGVjdXRlT25TZWxlY3Rpb24oc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBTZWxlY3RBbGxPcGVyYXRpb247XG4iLCJpbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNsYXNzIFN0cmluZ09wdGlvbiBleHRlbmRzIElucHV0T3B0aW9uIHtcbiAgcG9wdWxhdGVFeGlzdGluZ0Nob2ljZVN0cmluZ3MgKGNob2ljZURpY3QpIHtcbiAgICB0aGlzLmNob2ljZXMuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgaWYgKGNob2ljZSAhPT0gbnVsbCkge1xuICAgICAgICBjaG9pY2VEaWN0W2Nob2ljZV0gPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJpbmdPcHRpb247XG4iLCJpbXBvcnQgU3RyaW5nT3B0aW9uIGZyb20gJy4vU3RyaW5nT3B0aW9uLmpzJztcblxuY2xhc3MgQ2xhc3NPcHRpb24gZXh0ZW5kcyBTdHJpbmdPcHRpb24ge1xuICBhc3luYyB1cGRhdGVDaG9pY2VzICh7IGl0ZW1zLCByZXNldCA9IGZhbHNlIH0pIHtcbiAgICBsZXQgY2xhc3NlcyA9IHt9O1xuICAgIGlmICghcmVzZXQpIHtcbiAgICAgIHRoaXMucG9wdWxhdGVFeGlzdGluZ0Nob2ljZVN0cmluZ3MoY2xhc3Nlcyk7XG4gICAgfVxuICAgIE9iamVjdC52YWx1ZXMoaXRlbXMpLm1hcChpdGVtID0+IHtcbiAgICAgIHJldHVybiBpdGVtLmdldENsYXNzZXMgPyBpdGVtLmdldENsYXNzZXMoKSA6IFtdO1xuICAgIH0pLmZvckVhY2goY2xhc3NMaXN0ID0+IHtcbiAgICAgIGNsYXNzTGlzdC5mb3JFYWNoKGNsYXNzTmFtZSA9PiB7XG4gICAgICAgIGNsYXNzZXNbY2xhc3NOYW1lXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICB0aGlzLmNob2ljZXMgPSBPYmplY3Qua2V5cyhjbGFzc2VzKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ2xhc3NPcHRpb247XG4iLCJpbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgQ2xhc3NPcHRpb24gZnJvbSAnLi9Db21tb24vQ2xhc3NPcHRpb24uanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vQ29tbW9uL0lucHV0T3B0aW9uLmpzJztcblxuY29uc3QgREVGQVVMVF9GSUxURVJfRlVOQyA9ICdyZXR1cm4gaXRlbS52YWx1ZSA9PT0gdHJ1ZSc7XG5cbmNsYXNzIEZpbHRlck9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLmdldElucHV0U3BlYygpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29udGV4dCcsXG4gICAgICBjaG9pY2VzOiBbJ0NsYXNzJywgJ0Z1bmN0aW9uJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdDbGFzcydcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKGNvbnRleHQpO1xuXG4gICAgY29udGV4dC5zcGVjc1snQ2xhc3MnXS5hZGRPcHRpb24obmV3IENsYXNzT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjbGFzc05hbWUnXG4gICAgfSkpO1xuICAgIGNvbnRleHQuc3BlY3NbJ0Z1bmN0aW9uJ10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZmlsdGVyRnVuY3Rpb24nLFxuICAgICAgZGVmYXVsdFZhbHVlOiBERUZBVUxUX0ZJTFRFUl9GVU5DLFxuICAgICAgb3BlbkVuZGVkOiB0cnVlXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoZSBGaWx0ZXIgb3BlcmF0aW9uIGlzIG5vdCB5ZXQgc3VwcG9ydGVkIGF0IHRoZSBpbnN0YW5jZSBsZXZlbGApO1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGlmICh0eXBlb2YgaW5wdXRPcHRpb25zLmZpbHRlckZ1bmN0aW9uID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgRnVuY3Rpb24oJ2l0ZW0nLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuIHx8IERFRkFVTFRfRklMVEVSX0ZVTkMpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuY2xhc3NOYW1lO1xuICAgIH1cbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3Qgb3V0cHV0ID0gbmV3IE91dHB1dFNwZWMoKTtcbiAgICBsZXQgZmlsdGVyRnVuY3Rpb247XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnRnVuY3Rpb24nKSB7XG4gICAgICBmaWx0ZXJGdW5jdGlvbiA9IGlucHV0T3B0aW9ucy5maWx0ZXJGdW5jdGlvbjtcbiAgICAgIGlmICh0eXBlb2YgZmlsdGVyRnVuY3Rpb24gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBmaWx0ZXJGdW5jdGlvbiA9IG5ldyBGdW5jdGlvbignaXRlbScsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICAgIGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbiB8fCBERUZBVUxUX0ZJTFRFUl9GVU5DKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICAgICAgICBvdXRwdXQud2FybihgZmlsdGVyRnVuY3Rpb24gU3ludGF4RXJyb3I6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHsgLy8gaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQ2xhc3MnKVxuICAgICAgZmlsdGVyRnVuY3Rpb24gPSBpdGVtID0+IHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uZ2V0Q2xhc3NlcyAmJiBpdGVtLmdldENsYXNzZXMoKS5pbmRleE9mKGlucHV0T3B0aW9ucy5jbGFzc05hbWUpICE9PSAtMTtcbiAgICAgIH07XG4gICAgfVxuICAgIE9iamVjdC52YWx1ZXMoYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCkpLmZvckVhY2goaXRlbSA9PiB7XG4gICAgICBpZiAoZmlsdGVyRnVuY3Rpb24oaXRlbSkpIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhbaXRlbS51bmlxdWVTZWxlY3Rvcl0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRmlsdGVyT3BlcmF0aW9uO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uLy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VDb252ZXJzaW9uIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCBUYXJnZXRUeXBlLCBzdGFuZGFyZFR5cGVzID0gW10sIHNwZWNpYWxUeXBlcyA9IFtdIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG11cmU7XG4gICAgdGhpcy5UYXJnZXRUeXBlID0gVGFyZ2V0VHlwZTtcbiAgICB0aGlzLnN0YW5kYXJkVHlwZXMgPSB7fTtcbiAgICBzdGFuZGFyZFR5cGVzLmZvckVhY2goVHlwZSA9PiB7IHRoaXMuc3RhbmRhcmRUeXBlc1tUeXBlLnR5cGVdID0gVHlwZTsgfSk7XG4gICAgdGhpcy5zcGVjaWFsVHlwZXMgPSB7fTtcbiAgICBzcGVjaWFsVHlwZXMuZm9yRWFjaChUeXBlID0+IHsgdGhpcy5zcGVjaWFsVHlwZXNbVHlwZS50eXBlXSA9IFR5cGU7IH0pO1xuICB9XG4gIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuc3RhbmRhcmRUeXBlc1tpdGVtLnR5cGVdIHx8IHRoaXMuc3BlY2lhbFR5cGVzW2l0ZW0udHlwZV07XG4gIH1cbiAgY29udmVydEl0ZW0gKGl0ZW0sIGlucHV0T3B0aW9ucywgb3V0cHV0U3BlYykge1xuICAgIGlmIChpdGVtLmNvbnN0cnVjdG9yID09PSB0aGlzLlRhcmdldFR5cGUpIHtcbiAgICAgIC8vIHNraXAgY29udmVyc2lvbiBpZiB0aGUgdHlwZSBpcyBhbHJlYWR5IHRoZSBzYW1lXG4gICAgICByZXR1cm47XG4gICAgfSBpZiAodGhpcy5zdGFuZGFyZFR5cGVzW2l0ZW0udHlwZV0pIHtcbiAgICAgIHRoaXMuc3RhbmRhcmRDb252ZXJzaW9uKGl0ZW0sIGlucHV0T3B0aW9ucywgb3V0cHV0U3BlYyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNwZWNpYWxUeXBlc1tpdGVtLnR5cGVdKSB7XG4gICAgICB0aGlzLnNwZWNpYWxDb252ZXJzaW9uKGl0ZW0sIGlucHV0T3B0aW9ucywgb3V0cHV0U3BlYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dFNwZWMud2FybihgQ29udmVyc2lvbiBmcm9tICR7aXRlbS50eXBlfSB0byAke3RoaXMuVGFyZ2V0VHlwZS50eXBlfSBpcyBub3Qgc3VwcG9ydGVkYCk7XG4gICAgfVxuICB9XG4gIGFkZE9wdGlvbnNUb1NwZWMgKGlucHV0U3BlYykge31cbiAgc3RhbmRhcmRDb252ZXJzaW9uIChpdGVtLCBpbnB1dE9wdGlvbnMsIG91dHB1dFNwZWMpIHtcbiAgICAvLyBCZWNhdXNlIG9mIEJhc2VXcmFwcGVyJ3Mgc2V0dGVyLCB0aGlzIHdpbGwgYWN0dWFsbHkgYXBwbHkgdG8gdGhlXG4gICAgLy8gaXRlbSdzIGRvY3VtZW50IGFzIHdlbGwgYXMgdG8gdGhlIGl0ZW0gd3JhcHBlclxuICAgIGl0ZW0udmFsdWUgPSB0aGlzLlRhcmdldFR5cGUuc3RhbmRhcmRpemUoe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgdmFsdWU6IGl0ZW0udmFsdWUsXG4gICAgICBwYXRoOiBpdGVtLnBhdGgsXG4gICAgICBkb2M6IGl0ZW0uZG9jXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuVGFyZ2V0VHlwZS5pc0JhZFZhbHVlKGl0ZW0udmFsdWUpKSB7XG4gICAgICBvdXRwdXRTcGVjLndhcm4oYENvbnZlcnRlZCAke2l0ZW0udHlwZX0gdG8gJHtpdGVtLnZhbHVlfWApO1xuICAgIH1cbiAgfVxuICBzcGVjaWFsQ29udmVyc2lvbiAoaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmltaXBsZW1lbnRlZCcpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZUNvbnZlcnNpb24sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNvbnZlcnNpb24vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlQ29udmVyc2lvbjtcbiIsImltcG9ydCBCYXNlQ29udmVyc2lvbiBmcm9tICcuL0Jhc2VDb252ZXJzaW9uLmpzJztcblxuY2xhc3MgTnVsbENvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuTnVsbFdyYXBwZXIsXG4gICAgICBzdGFuZGFyZFR5cGVzOiBbXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQm9vbGVhbldyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5TdHJpbmdXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkRhdGVXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlJlZmVyZW5jZVdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXJcbiAgICAgIF0sXG4gICAgICBzcGVjaWFsVHlwZXM6IFtdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE51bGxDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBCb29sZWFuQ29udmVyc2lvbiBleHRlbmRzIEJhc2VDb252ZXJzaW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgVGFyZ2V0VHlwZTogbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkRhdGVXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlJlZmVyZW5jZVdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXJcbiAgICAgIF0sXG4gICAgICBzcGVjaWFsVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5TdHJpbmdXcmFwcGVyXG4gICAgICBdXG4gICAgfSk7XG4gIH1cbiAgc3BlY2lhbENvbnZlcnNpb24gKGl0ZW0sIGlucHV0T3B0aW9ucywgb3V0cHV0U3BlYykge1xuICAgIC8vIFRPRE86IHNtYXJ0ZXIgY29udmVyc2lvbiBmcm9tIHN0cmluZ3MgdGhhbiBqYXZhc2NyaXB0J3MgZGVmYXVsdFxuICAgIGl0ZW0udmFsdWUgPSAhIWl0ZW0udmFsdWU7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEJvb2xlYW5Db252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBOdW1iZXJDb252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLk51bWJlcldyYXBwZXIsXG4gICAgICBzdGFuZGFyZFR5cGVzOiBbXG4gICAgICAgIG11cmUuV1JBUFBFUlMuTnVsbFdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQm9vbGVhbldyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuU3RyaW5nV3JhcHBlclxuICAgICAgXVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOdW1iZXJDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBTdHJpbmdDb252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLlN0cmluZ1dyYXBwZXIsXG4gICAgICBzdGFuZGFyZFR5cGVzOiBbXG4gICAgICAgIG11cmUuV1JBUFBFUlMuTnVsbFdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQm9vbGVhbldyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5EYXRlV3JhcHBlclxuICAgICAgXVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJpbmdDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBHZW5lcmljQ29udmVyc2lvbiBleHRlbmRzIEJhc2VDb252ZXJzaW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgVGFyZ2V0VHlwZTogbXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyXG4gICAgICBdLFxuICAgICAgc3BlY2lhbFR5cGVzOiBbXVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ29udmVyc2lvbjtcbiIsImltcG9ydCBCYXNlQ29udmVyc2lvbiBmcm9tICcuL0Jhc2VDb252ZXJzaW9uLmpzJztcblxuY2xhc3MgTm9kZUNvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIsXG4gICAgICBzdGFuZGFyZFR5cGVzOiBbXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW11cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTm9kZUNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIEVkZ2VDb252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyLFxuICAgICAgc3RhbmRhcmRUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXJcbiAgICAgIF0sXG4gICAgICBzcGVjaWFsVHlwZXM6IFtdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VPcGVyYXRpb24gZnJvbSAnLi9Db21tb24vQmFzZU9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgSW5wdXRTcGVjIGZyb20gJy4vQ29tbW9uL0lucHV0U3BlYy5qcyc7XG5pbXBvcnQgT3V0cHV0U3BlYyBmcm9tICcuL0NvbW1vbi9PdXRwdXRTcGVjLmpzJztcbmltcG9ydCBDb250ZXh0dWFsT3B0aW9uIGZyb20gJy4vQ29tbW9uL0NvbnRleHR1YWxPcHRpb24uanMnO1xuaW1wb3J0IE51bGxDb252ZXJzaW9uIGZyb20gJy4vQ29udmVyc2lvbnMvTnVsbENvbnZlcnNpb24uanMnO1xuaW1wb3J0IEJvb2xlYW5Db252ZXJzaW9uIGZyb20gJy4vQ29udmVyc2lvbnMvQm9vbGVhbkNvbnZlcnNpb24uanMnO1xuaW1wb3J0IE51bWJlckNvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9OdW1iZXJDb252ZXJzaW9uLmpzJztcbmltcG9ydCBTdHJpbmdDb252ZXJzaW9uIGZyb20gJy4vQ29udmVyc2lvbnMvU3RyaW5nQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgR2VuZXJpY0NvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9HZW5lcmljQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgTm9kZUNvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9Ob2RlQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgRWRnZUNvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9FZGdlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIENvbnZlcnRPcGVyYXRpb24gZXh0ZW5kcyBCYXNlT3BlcmF0aW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcihtdXJlKTtcblxuICAgIGNvbnN0IGNvbnZlcnNpb25MaXN0ID0gW1xuICAgICAgbmV3IEJvb2xlYW5Db252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IE51bWJlckNvbnZlcnNpb24obXVyZSksXG4gICAgICBuZXcgU3RyaW5nQ29udmVyc2lvbihtdXJlKSxcbiAgICAgIG5ldyBOdWxsQ29udmVyc2lvbihtdXJlKSxcbiAgICAgIG5ldyBHZW5lcmljQ29udmVyc2lvbihtdXJlKSxcbiAgICAgIG5ldyBOb2RlQ29udmVyc2lvbihtdXJlKSxcbiAgICAgIG5ldyBFZGdlQ29udmVyc2lvbihtdXJlKVxuICAgIF07XG4gICAgdGhpcy5DT05WRVJTSU9OUyA9IHt9O1xuICAgIGNvbnZlcnNpb25MaXN0LmZvckVhY2goY29udmVyc2lvbiA9PiB7XG4gICAgICB0aGlzLkNPTlZFUlNJT05TW2NvbnZlcnNpb24udHlwZV0gPSBjb252ZXJzaW9uO1xuICAgIH0pO1xuICB9XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IElucHV0U3BlYygpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29udGV4dCcsXG4gICAgICBjaG9pY2VzOiBPYmplY3Qua2V5cyh0aGlzLkNPTlZFUlNJT05TKSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1N0cmluZydcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKGNvbnRleHQpO1xuXG4gICAgY29udGV4dC5jaG9pY2VzLmZvckVhY2goY2hvaWNlID0+IHtcbiAgICAgIHRoaXMuQ09OVkVSU0lPTlNbY2hvaWNlXS5hZGRPcHRpb25zVG9TcGVjKGNvbnRleHQuc3BlY3NbY2hvaWNlXSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHBvdGVudGlhbGx5RXhlY3V0YWJsZU9uSXRlbSAoaXRlbSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuQ09OVkVSU0lPTlMpLnNvbWUoY29udmVyc2lvbiA9PiB7XG4gICAgICByZXR1cm4gY29udmVyc2lvbi5jYW5FeGVjdXRlT25JbnN0YW5jZShpdGVtKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgaWYgKGF3YWl0IHN1cGVyLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0sIGlucHV0T3B0aW9ucykpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjb25zdCBjb252ZXJzaW9uID0gdGhpcy5DT05WRVJTSU9OU1tpbnB1dE9wdGlvbnMuY29udGV4dF07XG4gICAgcmV0dXJuIGNvbnZlcnNpb24gJiYgY29udmVyc2lvbi5jYW5FeGVjdXRlT25JbnN0YW5jZShpdGVtLCBpbnB1dE9wdGlvbnMpO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgT3V0cHV0U3BlYygpO1xuICAgIGNvbnN0IGNvbnZlcnNpb24gPSB0aGlzLkNPTlZFUlNJT05TW2lucHV0T3B0aW9ucy5jb250ZXh0XTtcbiAgICBpZiAoIWNvbnZlcnNpb24pIHtcbiAgICAgIG91dHB1dC53YXJuKGBVbmtub3duIGNvbnRleHQgZm9yIGNvbnZlcnNpb246ICR7aW5wdXRPcHRpb25zLmNvbnRleHR9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnZlcnNpb24uY29udmVydEl0ZW0oaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXQpO1xuICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhpdGVtLmRvYyk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29udmVydE9wZXJhdGlvbjtcbiIsImltcG9ydCBDb250YWluZXJXcmFwcGVyIGZyb20gJy4uLy4uL1dyYXBwZXJzL0NvbnRhaW5lcldyYXBwZXIuanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vSW5wdXRPcHRpb24uanMnO1xuXG5jbGFzcyBUeXBlZE9wdGlvbiBleHRlbmRzIElucHV0T3B0aW9uIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBwYXJhbWV0ZXJOYW1lLFxuICAgIGRlZmF1bHRWYWx1ZSxcbiAgICBjaG9pY2VzLFxuICAgIHZhbGlkVHlwZXMgPSBbXSxcbiAgICBzdWdnZXN0T3JwaGFucyA9IGZhbHNlXG4gIH0pIHtcbiAgICBzdXBlcih7XG4gICAgICBwYXJhbWV0ZXJOYW1lLFxuICAgICAgZGVmYXVsdFZhbHVlLFxuICAgICAgY2hvaWNlcyxcbiAgICAgIG9wZW5FbmRlZDogZmFsc2VcbiAgICB9KTtcbiAgICB0aGlzLnZhbGlkVHlwZXMgPSB2YWxpZFR5cGVzO1xuICAgIHRoaXMuc3VnZ2VzdE9ycGhhbnMgPSBzdWdnZXN0T3JwaGFucztcbiAgfVxuICBhc3luYyB1cGRhdGVDaG9pY2VzICh7IGl0ZW1zLCBpbnB1dE9wdGlvbnMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGNvbnN0IGl0ZW1Mb29rdXAgPSB7fTtcbiAgICBjb25zdCBvcnBoYW5Mb29rdXAgPSB7fTtcbiAgICBpZiAoIXJlc2V0KSB7XG4gICAgICB0aGlzLmNob2ljZXMuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgICBpdGVtTG9va3VwW2Nob2ljZS51bmlxdWVTZWxlY3Rvcl0gPSBjaG9pY2U7XG4gICAgICB9KTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhpdGVtcykuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGlmICh0aGlzLnZhbGlkVHlwZXMuaW5kZXhPZihpdGVtLmNvbnN0cnVjdG9yKSAhPT0gLTEpIHtcbiAgICAgICAgaXRlbUxvb2t1cFtpdGVtLnVuaXF1ZVNlbGVjdG9yXSA9IGl0ZW07XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5zdWdnZXN0T3JwaGFucyAmJiBpdGVtLmRvYyAmJiAhb3JwaGFuTG9va3VwW2l0ZW0uZG9jLl9pZF0pIHtcbiAgICAgICAgb3JwaGFuTG9va3VwW2l0ZW0uZG9jLl9pZF0gPSBuZXcgQ29udGFpbmVyV3JhcHBlcih7XG4gICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgIHZhbHVlOiBpdGVtLmRvYy5vcnBoYW5zLFxuICAgICAgICAgIHBhdGg6IFtpdGVtLnBhdGhbMF0sICdvcnBoYW5zJ10sXG4gICAgICAgICAgZG9jOiBpdGVtLmRvY1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLmNob2ljZXMgPSBPYmplY3QudmFsdWVzKGl0ZW1Mb29rdXApLmNvbmNhdChPYmplY3QudmFsdWVzKG9ycGhhbkxvb2t1cCkpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUeXBlZE9wdGlvbjtcbiIsImltcG9ydCBTdHJpbmdPcHRpb24gZnJvbSAnLi9TdHJpbmdPcHRpb24uanMnO1xuXG5jbGFzcyBBdHRyaWJ1dGVPcHRpb24gZXh0ZW5kcyBTdHJpbmdPcHRpb24ge1xuICBhc3luYyBwb3B1bGF0ZUZyb21JdGVtIChpdGVtLCBhdHRyaWJ1dGVzKSB7XG4gICAgaWYgKGl0ZW0uZ2V0QXR0cmlidXRlcykge1xuICAgICAgKGF3YWl0IGl0ZW0uZ2V0QXR0cmlidXRlcygpKS5mb3JFYWNoKGF0dHIgPT4ge1xuICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBhc3luYyBwb3B1bGF0ZUZyb21JdGVtcyAoaXRlbXMsIGF0dHJpYnV0ZXMpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoT2JqZWN0LnZhbHVlcyhpdGVtcykubWFwKGl0ZW0gPT4ge1xuICAgICAgcmV0dXJuIHRoaXMucG9wdWxhdGVGcm9tSXRlbShpdGVtLCBhdHRyaWJ1dGVzKTtcbiAgICB9KSk7XG4gIH1cbiAgYXN5bmMgdXBkYXRlQ2hvaWNlcyAoeyBpdGVtcywgaW5wdXRPcHRpb25zLCByZXNldCA9IGZhbHNlIH0pIHtcbiAgICBsZXQgYXR0cmlidXRlcyA9IHt9O1xuICAgIGlmICghcmVzZXQpIHtcbiAgICAgIHRoaXMucG9wdWxhdGVFeGlzdGluZ0Nob2ljZVN0cmluZ3MoYXR0cmlidXRlcyk7XG4gICAgfVxuICAgIGF3YWl0IHRoaXMucG9wdWxhdGVGcm9tSXRlbXMoaXRlbXMsIGF0dHJpYnV0ZXMpO1xuICAgIHRoaXMuY2hvaWNlcyA9IE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpO1xuICAgIHRoaXMuY2hvaWNlcy51bnNoaWZ0KG51bGwpOyAvLyBudWxsIGluZGljYXRlcyB0aGF0IHRoZSBpdGVtJ3MgbGFiZWwgc2hvdWxkIGJlIHVzZWRcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQXR0cmlidXRlT3B0aW9uO1xuIiwiaW1wb3J0IEF0dHJpYnV0ZU9wdGlvbiBmcm9tICcuL0F0dHJpYnV0ZU9wdGlvbi5qcyc7XG5cbmNsYXNzIE5lc3RlZEF0dHJpYnV0ZU9wdGlvbiBleHRlbmRzIEF0dHJpYnV0ZU9wdGlvbiB7XG4gIGNvbnN0cnVjdG9yICh7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcywgb3BlbkVuZGVkLCBnZXRJdGVtQ2hvaWNlUm9sZSB9KSB7XG4gICAgc3VwZXIoeyBwYXJhbWV0ZXJOYW1lLCBkZWZhdWx0VmFsdWUsIGNob2ljZXMsIG9wZW5FbmRlZCB9KTtcbiAgICB0aGlzLmdldEl0ZW1DaG9pY2VSb2xlID0gZ2V0SXRlbUNob2ljZVJvbGU7XG4gIH1cbiAgYXN5bmMgdXBkYXRlQ2hvaWNlcyAoeyBpdGVtcywgaW5wdXRPcHRpb25zLCByZXNldCA9IGZhbHNlIH0pIHtcbiAgICBsZXQgYXR0cmlidXRlcyA9IHt9O1xuICAgIGlmICghcmVzZXQpIHtcbiAgICAgIHRoaXMucG9wdWxhdGVFeGlzdGluZ0Nob2ljZVN0cmluZ3MoYXR0cmlidXRlcyk7XG4gICAgfVxuICAgIGNvbnN0IGl0ZW1MaXN0ID0gT2JqZWN0LnZhbHVlcyhpdGVtcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaXRlbSA9IGl0ZW1MaXN0W2ldO1xuICAgICAgY29uc3QgaXRlbVJvbGUgPSB0aGlzLmdldEl0ZW1DaG9pY2VSb2xlKGl0ZW0sIGlucHV0T3B0aW9ucyk7XG4gICAgICBpZiAoaXRlbVJvbGUgPT09ICdzdGFuZGFyZCcpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZUZyb21JdGVtKGl0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgICAgfSBlbHNlIGlmIChpdGVtUm9sZSA9PT0gJ2RlZXAnKSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gaXRlbS5nZXRNZW1iZXJzID8gYXdhaXQgaXRlbS5nZXRNZW1iZXJzKClcbiAgICAgICAgICA6IGl0ZW0uZ2V0Q29udGVudHMgPyBpdGVtLmdldENvbnRlbnRzKCkgOiB7fTtcbiAgICAgICAgYXdhaXQgdGhpcy5wb3B1bGF0ZUZyb21JdGVtcyhjaGlsZHJlbiwgYXR0cmlidXRlcyk7XG4gICAgICB9IC8vIGVsc2UgaWYgKGl0ZW1Sb2xlID09PSAnaWdub3JlJylcbiAgICB9XG4gICAgdGhpcy5jaG9pY2VzID0gT2JqZWN0LmtleXMoYXR0cmlidXRlcyk7XG4gICAgdGhpcy5jaG9pY2VzLnVuc2hpZnQobnVsbCk7IC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGl0ZW0ncyBsYWJlbCBzaG91bGQgYmUgdXNlZFxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXN0ZWRBdHRyaWJ1dGVPcHRpb247XG4iLCJpbXBvcnQgU2VsZWN0aW9uIGZyb20gJy4uL1NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgVHlwZWRPcHRpb24gZnJvbSAnLi9Db21tb24vVHlwZWRPcHRpb24uanMnO1xuaW1wb3J0IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbiBmcm9tICcuL0NvbW1vbi9OZXN0ZWRBdHRyaWJ1dGVPcHRpb24uanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vQ29tbW9uL0lucHV0T3B0aW9uLmpzJztcblxuY29uc3QgREVGQVVMVF9DT05ORUNUX1dIRU4gPSAncmV0dXJuIHNvdXJjZS5sYWJlbCA9PT0gdGFyZ2V0LmxhYmVsOyc7XG5cbmNsYXNzIENvbm5lY3RPcGVyYXRpb24gZXh0ZW5kcyBCYXNlT3BlcmF0aW9uIHtcbiAgZ2V0SW5wdXRTcGVjICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5nZXRJbnB1dFNwZWMoKTtcblxuICAgIC8vIERvIHdlIGNvbm5lY3Qgbm9kZXMgaW4gdGhlIGN1cnJlbnQgc2VsZWN0aW9uLCBvciB0byB0aGUgbm9kZXMgaW5zaWRlIHNvbWVcbiAgICAvLyBzZXQtbGlrZSBjb25zdHJ1Y3Q/XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnV2l0aGluIFNlbGVjdGlvbicsICdCaXBhcnRpdGUnXSxcbiAgICAgIGhpZGRlbkNob2ljZXM6IFsnVGFyZ2V0IENvbnRhaW5lciddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnV2l0aGluIFNlbGVjdGlvbidcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKGNvbnRleHQpO1xuXG4gICAgLy8gRm9yIHNvbWUgY29udGV4dHMsIHdlIG5lZWQgdG8gc3BlY2lmeSBzb3VyY2UgYW5kL29yIHRhcmdldCBkb2N1bWVudHMsXG4gICAgLy8gaXRlbXMsIG9yIHNldHMgKGNsYXNzZXMgb3IgZ3JvdXBzKVxuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihuZXcgVHlwZWRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ3NvdXJjZXMnLFxuICAgICAgdmFsaWRUeXBlczogW1xuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyLFxuICAgICAgICBTZWxlY3Rpb25cbiAgICAgIF1cbiAgICB9KSk7XG4gICAgY29uc3QgdGFyZ2V0cyA9IG5ldyBUeXBlZE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAndGFyZ2V0cycsXG4gICAgICB2YWxpZFR5cGVzOiBbXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIsXG4gICAgICAgIFNlbGVjdGlvblxuICAgICAgXVxuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbih0YXJnZXRzKTtcbiAgICBjb250ZXh0LnNwZWNzWydUYXJnZXQgQ29udGFpbmVyJ10uYWRkT3B0aW9uKHRhcmdldHMpO1xuXG4gICAgLy8gRWRnZSBkaXJlY3Rpb25cbiAgICBjb25zdCBkaXJlY3Rpb24gPSBuZXcgSW5wdXRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2RpcmVjdGVkJyxcbiAgICAgIGNob2ljZXM6IFsnVW5kaXJlY3RlZCcsICdEaXJlY3RlZCddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnVW5kaXJlY3RlZCdcbiAgICB9KTtcbiAgICBjb250ZXh0LnNwZWNzWydCaXBhcnRpdGUnXS5hZGRPcHRpb24oZGlyZWN0aW9uKTtcbiAgICBjb250ZXh0LnNwZWNzWydUYXJnZXQgQ29udGFpbmVyJ10uYWRkT3B0aW9uKGRpcmVjdGlvbik7XG5cbiAgICAvLyBBbGwgY29udGV4dHMgY2FuIGJlIGV4ZWN1dGVkIGJ5IG1hdGNoaW5nIGF0dHJpYnV0ZXMgb3IgZXZhbHVhdGluZ1xuICAgIC8vIGEgZnVuY3Rpb25cbiAgICBjb25zdCBtb2RlID0gbmV3IENvbnRleHR1YWxPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ21vZGUnLFxuICAgICAgY2hvaWNlczogWydBdHRyaWJ1dGUnLCAnRnVuY3Rpb24nXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ0F0dHJpYnV0ZSdcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKG1vZGUpO1xuXG4gICAgLy8gQXR0cmlidXRlIG1vZGUgbmVlZHMgc291cmNlIGFuZCB0YXJnZXQgYXR0cmlidXRlc1xuICAgIG1vZGUuc3BlY3NbJ0F0dHJpYnV0ZSddLmFkZE9wdGlvbihuZXcgTmVzdGVkQXR0cmlidXRlT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdzb3VyY2VBdHRyaWJ1dGUnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLCAvLyBudWxsIGluZGljYXRlcyB0aGF0IHRoZSBsYWJlbCBzaG91bGQgYmUgdXNlZFxuICAgICAgZ2V0SXRlbUNob2ljZVJvbGU6IChpdGVtLCBpbnB1dE9wdGlvbnMpID0+IHtcbiAgICAgICAgaWYgKGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy5zYXZlRWRnZXNJbikpIHtcbiAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICAgICAgaWYgKGlucHV0T3B0aW9ucy5zb3VyY2VzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy5zb3VyY2VzKSkge1xuICAgICAgICAgICAgcmV0dXJuICdkZWVwJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMudGFyZ2V0cyAmJiBpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMudGFyZ2V0cykpIHtcbiAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICdzdGFuZGFyZCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG4gICAgbW9kZS5zcGVjc1snQXR0cmlidXRlJ10uYWRkT3B0aW9uKG5ldyBOZXN0ZWRBdHRyaWJ1dGVPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ3RhcmdldEF0dHJpYnV0ZScsXG4gICAgICBkZWZhdWx0VmFsdWU6IG51bGwsIC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGxhYmVsIHNob3VsZCBiZSB1c2VkXG4gICAgICBnZXRJdGVtQ2hvaWNlUm9sZTogKGl0ZW0sIGlucHV0T3B0aW9ucykgPT4ge1xuICAgICAgICBpZiAoaXRlbS5lcXVhbHMoaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luKSkge1xuICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMudGFyZ2V0cyAmJiBpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMudGFyZ2V0cykpIHtcbiAgICAgICAgICByZXR1cm4gJ2RlZXAnO1xuICAgICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQmlwYXJ0aXRlJykge1xuICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gJ3N0YW5kYXJkJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcblxuICAgIC8vIEZ1bmN0aW9uIG1vZGUgbmVlZHMgdGhlIGZ1bmN0aW9uXG4gICAgbW9kZS5zcGVjc1snRnVuY3Rpb24nXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb25uZWN0V2hlbicsXG4gICAgICBkZWZhdWx0VmFsdWU6IERFRkFVTFRfQ09OTkVDVF9XSEVOLFxuICAgICAgb3BlbkVuZGVkOiB0cnVlXG4gICAgfSkpO1xuXG4gICAgLy8gRmluYWwgb3B0aW9uIGFkZGVkIHRvIGFsbCBjb250ZXh0IC8gbW9kZXM6IHdoZXJlIHRvIHN0b3JlIHRoZSBjcmVhdGVkXG4gICAgLy8gZWRnZXM/XG4gICAgcmVzdWx0LmFkZE9wdGlvbihuZXcgVHlwZWRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ3NhdmVFZGdlc0luJyxcbiAgICAgIHZhbGlkVHlwZXM6IFt0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcl0sXG4gICAgICBzdWdnZXN0T3JwaGFuczogdHJ1ZVxuICAgIH0pKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBhc3luYyBleGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBSdW5uaW5nIHRoZSBDb25uZWN0IG9wZXJhdGlvbiBvbiBhbiBpbnN0YW5jZSBpcyBub3Qgc3VwcG9ydGVkLmApO1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmlnbm9yZUVycm9ycyAhPT0gJ1N0b3Agb24gRXJyb3InKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCEoaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgIGlmICghKFxuICAgICAgICAoaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyKSAmJlxuICAgICAgICAoaW5wdXRPcHRpb25zLnRhcmdldHMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyKSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdUYXJnZXQgQ29udGFpbmVyJykge1xuICAgICAgaWYgKCFpbnB1dE9wdGlvbnMudGFyZ2V0cyB8fCAhaW5wdXRPcHRpb25zLnRhcmdldHMuaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgbGV0IGl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgICBsZXQgdGFyZ2V0SXRlbXMgPSBhd2FpdCBpbnB1dE9wdGlvbnMudGFyZ2V0cy5pdGVtcygpO1xuICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoaXRlbXMpXG4gICAgICAgIC5zb21lKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikgJiZcbiAgICAgICAgT2JqZWN0LnZhbHVlcyh0YXJnZXRJdGVtcylcbiAgICAgICAgICAuc29tZShpdGVtID0+IGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIpO1xuICAgIH0gZWxzZSB7IC8vIGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnV2l0aGluIFNlbGVjdGlvbidcbiAgICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgICBsZXQgY291bnQgPSAwO1xuICAgICAgY29uc3QgYXRMZWFzdFR3b05vZGVzID0gT2JqZWN0LnZhbHVlcyhpdGVtcykuc29tZShpdGVtID0+IHtcbiAgICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIpIHtcbiAgICAgICAgICBjb3VudCArPSAxO1xuICAgICAgICAgIGlmIChjb3VudCA+PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCFhdExlYXN0VHdvTm9kZXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGlmICh0eXBlb2YgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgRnVuY3Rpb24oJ3NvdXJjZScsICd0YXJnZXQnLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuIHx8IERFRkFVTFRfQ09OTkVDVF9XSEVOKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaW5wdXRPcHRpb25zLnNvdXJjZUF0dHJpYnV0ZSAmJiBpbnB1dE9wdGlvbnMudGFyZ2V0QXR0cmlidXRlO1xuICAgIH1cbiAgfVxuICBhc3luYyBleGVjdXRlV2l0aGluU2VsZWN0aW9uIChpdGVtcywgY29ubmVjdFdoZW4sIHNhdmVFZGdlc0luLCBvdXRwdXQpIHtcbiAgICAvLyBXZSdyZSBvbmx5IGNyZWF0aW5nIGVkZ2VzIHdpdGhpbiB0aGUgc2VsZWN0aW9uOyB3ZSBkb24ndCBoYXZlIHRvIHdvcnJ5XG4gICAgLy8gYWJvdXQgZGlyZWN0aW9uIG9yIHRoZSBvdGhlciBzZXQgb2Ygbm9kZXMsIGJ1dCB3ZSBkbyBuZWVkIHRvIGl0ZXJhdGUgaW5cbiAgICAvLyBhIHdheSB0aGF0IGd1YXJhbnRlZXMgdGhhdCB3ZSBkb24ndCBkdXBsaWNhdGUgZWRnZXNcbiAgICBjb25zdCBzb3VyY2VMaXN0ID0gT2JqZWN0LnZhbHVlcyhpdGVtcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBzb3VyY2VMaXN0Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChjb25uZWN0V2hlbihzb3VyY2VMaXN0W2ldLCBzb3VyY2VMaXN0W2pdKSkge1xuICAgICAgICAgIGNvbnN0IG5ld0VkZ2UgPSBzb3VyY2VMaXN0W2ldLmNvbm5lY3RUbyhzb3VyY2VMaXN0W2pdLCBzYXZlRWRnZXNJbik7XG4gICAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhbbmV3RWRnZS51bmlxdWVTZWxlY3Rvcl0pO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2Moc291cmNlTGlzdFtpXS5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2Moc291cmNlTGlzdFtqXS5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MobmV3RWRnZS5kb2MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG5cbiAgICAvLyBNYWtlIHN1cmUgd2UgaGF2ZSBhIHBsYWNlIHRvIHNhdmUgdGhlIGVkZ2VzXG4gICAgaWYgKCEoaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIpKSB7XG4gICAgICBvdXRwdXQud2Fybihgc2F2ZUVkZ2VzSW4gaXMgbm90IGFuIEl0ZW1gKTtcbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgLy8gRmlndXJlIG91dCB0aGUgY3JpdGVyaWEgZm9yIG1hdGNoaW5nIG5vZGVzXG4gICAgbGV0IGNvbm5lY3RXaGVuO1xuICAgIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ0Z1bmN0aW9uJykge1xuICAgICAgY29ubmVjdFdoZW4gPSBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW47XG4gICAgICBpZiAodHlwZW9mIGNvbm5lY3RXaGVuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29ubmVjdFdoZW4gPSBuZXcgRnVuY3Rpb24oJ3NvdXJjZScsICd0YXJnZXQnLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICAgIG91dHB1dC53YXJuKGBjb25uZWN0V2hlbiBTeW50YXhFcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgeyAvLyBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdBdHRyaWJ1dGUnKVxuICAgICAgY29uc3QgZ2V0U291cmNlVmFsdWUgPSBpbnB1dE9wdGlvbnMuc291cmNlQXR0cmlidXRlID09PSBudWxsXG4gICAgICAgID8gc291cmNlID0+IHNvdXJjZS5sYWJlbFxuICAgICAgICA6IHNvdXJjZSA9PiBzb3VyY2UudmFsdWVbaW5wdXRPcHRpb25zLnNvdXJjZUF0dHJpYnV0ZV07XG4gICAgICBjb25zdCBnZXRUYXJnZXRWYWx1ZSA9IGlucHV0T3B0aW9ucy50YXJnZXRBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyB0YXJnZXQgPT4gdGFyZ2V0LmxhYmVsXG4gICAgICAgIDogdGFyZ2V0ID0+IHRhcmdldC52YWx1ZVtpbnB1dE9wdGlvbnMudGFyZ2V0QXR0cmlidXRlXTtcbiAgICAgIGNvbm5lY3RXaGVuID0gKHNvdXJjZSwgdGFyZ2V0KSA9PiBnZXRTb3VyY2VWYWx1ZShzb3VyY2UpID09PSBnZXRUYXJnZXRWYWx1ZSh0YXJnZXQpO1xuICAgIH1cblxuICAgIGxldCBzb3VyY2VzO1xuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgIGlmIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIFNlbGVjdGlvbikge1xuICAgICAgICBzb3VyY2VzID0gYXdhaXQgaW5wdXRPcHRpb25zLnNvdXJjZXMuaXRlbXMoKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlciB8fFxuICAgICAgICAgIGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIpIHtcbiAgICAgICAgc291cmNlcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5zb3VyY2VzLmdldE1lbWJlcnMoKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgICAgICAgICAgIGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIpIHtcbiAgICAgICAgc291cmNlcyA9IGlucHV0T3B0aW9ucy5zb3VyY2VzLmdldENvbnRlbnRzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQud2FybihgaW5wdXRPcHRpb25zLnNvdXJjZXMgaXMgb2YgdW5leHBlY3RlZCB0eXBlICR7aW5wdXRPcHRpb25zLnNvdXJjZXMgJiYgaW5wdXRPcHRpb25zLnNvdXJjZXMudHlwZX1gKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc291cmNlcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgIH1cblxuICAgIGNvbnN0IHNvdXJjZUxpc3QgPSBPYmplY3QudmFsdWVzKHNvdXJjZXMpO1xuICAgIGlmIChzb3VyY2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgb3V0cHV0Lndhcm4oYE5vIHNvdXJjZXMgc3VwcGxpZWQgdG8gY29ubmVjdCBvcGVyYXRpb25gKTtcbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSBrbm93IGVub3VnaCB0byBkZWFsIHdpdGggJ1dpdGhpbiBTZWxlY3Rpb24nIG1vZGU6XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnV2l0aGluIFNlbGVjdGlvbicpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24oc291cmNlcywgY29ubmVjdFdoZW4sIGlucHV0T3B0aW9ucy5zYXZlRWRnZXNJbiwgb3V0cHV0KTtcbiAgICB9XG5cbiAgICAvLyBXaGF0IHJvbGUgYXJlIHRoZSBzb3VyY2Ugbm9kZXMgcGxheWluZyAoJ3VuZGlyZWN0ZWQnIHZzICdzb3VyY2UnKT9cbiAgICBjb25zdCBkaXJlY3Rpb24gPSBpbnB1dE9wdGlvbnMuZGlyZWN0ZWQgPT09ICdEaXJlY3RlZCcgPyAnc291cmNlJyA6ICd1bmRpcmVjdGVkJztcblxuICAgIGxldCB0YXJnZXRzO1xuICAgIGlmIChpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIFNlbGVjdGlvbikge1xuICAgICAgdGFyZ2V0cyA9IGF3YWl0IGlucHV0T3B0aW9ucy50YXJnZXRzLml0ZW1zKCk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyIHx8XG4gICAgICAgICAgICAgICBpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyKSB7XG4gICAgICB0YXJnZXRzID0gYXdhaXQgaW5wdXRPcHRpb25zLnRhcmdldHMuZ2V0TWVtYmVycygpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLnRhcmdldHMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICAgICAgICAgaW5wdXRPcHRpb25zLnRhcmdldHMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyKSB7XG4gICAgICB0YXJnZXRzID0gaW5wdXRPcHRpb25zLnRhcmdldHMuZ2V0Q29udGVudHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0Lndhcm4oYGlucHV0T3B0aW9ucy50YXJnZXRzIGlzIG9mIHVuZXhwZWN0ZWQgdHlwZSAke2lucHV0T3B0aW9ucy50YXJnZXRzICYmIGlucHV0T3B0aW9ucy50YXJnZXRzLnR5cGV9YCk7XG4gICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldExpc3QgPSBPYmplY3QudmFsdWVzKHRhcmdldHMpO1xuICAgIGlmICh0YXJnZXRMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgb3V0cHV0Lndhcm4oJ05vIHRhcmdldHMgc3VwcGxpZWQgdG8gY29ubmVjdCBvcGVyYXRpb24nKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgdGhlIGVkZ2VzIVxuICAgIHNvdXJjZUxpc3QuZm9yRWFjaChzb3VyY2UgPT4ge1xuICAgICAgdGFyZ2V0TGlzdC5mb3JFYWNoKHRhcmdldCA9PiB7XG4gICAgICAgIGlmIChzb3VyY2UgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIgJiZcbiAgICAgICAgICAgIHRhcmdldCBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJlxuICAgICAgICAgICAgY29ubmVjdFdoZW4oc291cmNlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgY29uc3QgbmV3RWRnZSA9IHNvdXJjZS5jb25uZWN0VG8odGFyZ2V0LCBpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4sIGRpcmVjdGlvbik7XG4gICAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhbbmV3RWRnZS51bmlxdWVTZWxlY3Rvcl0pO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2Moc291cmNlLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyh0YXJnZXQuZG9jKTtcbiAgICAgICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKG5ld0VkZ2UuZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDb25uZWN0T3BlcmF0aW9uO1xuIiwiaW1wb3J0IFNlbGVjdGlvbiBmcm9tICcuLi9TZWxlY3Rpb24uanMnO1xuaW1wb3J0IEJhc2VPcGVyYXRpb24gZnJvbSAnLi9Db21tb24vQmFzZU9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgT3V0cHV0U3BlYyBmcm9tICcuL0NvbW1vbi9PdXRwdXRTcGVjLmpzJztcbmltcG9ydCBDb250ZXh0dWFsT3B0aW9uIGZyb20gJy4vQ29tbW9uL0NvbnRleHR1YWxPcHRpb24uanMnO1xuaW1wb3J0IFR5cGVkT3B0aW9uIGZyb20gJy4vQ29tbW9uL1R5cGVkT3B0aW9uLmpzJztcbmltcG9ydCBOZXN0ZWRBdHRyaWJ1dGVPcHRpb24gZnJvbSAnLi9Db21tb24vTmVzdGVkQXR0cmlidXRlT3B0aW9uLmpzJztcbmltcG9ydCBJbnB1dE9wdGlvbiBmcm9tICcuL0NvbW1vbi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNvbnN0IERFRkFVTFRfQ09OTkVDVF9XSEVOID0gJ3JldHVybiBlZGdlLmxhYmVsID09PSBub2RlLmxhYmVsOyc7XG5cbmNsYXNzIEF0dGFjaE9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLmdldElucHV0U3BlYygpO1xuXG4gICAgLy8gRG8gd2UgY29ubmVjdCBub2RlcyBpbiB0aGUgY3VycmVudCBzZWxlY3Rpb24sIG9yIHRvIHRoZSBub2RlcyBpbnNpZGUgc29tZVxuICAgIC8vIHNldC1saWtlIGNvbnN0cnVjdD9cbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IENvbnRleHR1YWxPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2NvbnRleHQnLFxuICAgICAgY2hvaWNlczogWydXaXRoaW4gU2VsZWN0aW9uJywgJ0JpcGFydGl0ZSddLFxuICAgICAgaGlkZGVuQ2hvaWNlczogWydUYXJnZXQgQ29udGFpbmVyJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICAvLyBGb3Igc29tZSBjb250ZXh0cywgd2UgbmVlZCB0byBzcGVjaWZ5IGVkZ2UgYW5kL29yIG5vZGUgZG9jdW1lbnRzLFxuICAgIC8vIGl0ZW1zLCBvciBzZXRzIChjbGFzc2VzIG9yIGdyb3VwcylcbiAgICBjb250ZXh0LnNwZWNzWydCaXBhcnRpdGUnXS5hZGRPcHRpb24obmV3IFR5cGVkT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdlZGdlcycsXG4gICAgICB2YWxpZFR5cGVzOiBbXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIsXG4gICAgICAgIFNlbGVjdGlvblxuICAgICAgXVxuICAgIH0pKTtcbiAgICBjb25zdCBub2RlcyA9IG5ldyBUeXBlZE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnbm9kZXMnLFxuICAgICAgdmFsaWRUeXBlczogW1xuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyLFxuICAgICAgICBTZWxlY3Rpb25cbiAgICAgIF1cbiAgICB9KTtcbiAgICBjb250ZXh0LnNwZWNzWydCaXBhcnRpdGUnXS5hZGRPcHRpb24obm9kZXMpO1xuICAgIGNvbnRleHQuc3BlY3NbJ1RhcmdldCBDb250YWluZXInXS5hZGRPcHRpb24obm9kZXMpO1xuXG4gICAgLy8gRWRnZSBkaXJlY3Rpb25cbiAgICByZXN1bHQuYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZGlyZWN0aW9uJyxcbiAgICAgIGNob2ljZXM6IFsndW5kaXJlY3RlZCcsICdzb3VyY2UnLCAndGFyZ2V0J10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICd1bmRpcmVjdGVkJ1xuICAgIH0pKTtcblxuICAgIC8vIEFsbCBjb250ZXh0cyBjYW4gYmUgZXhlY3V0ZWQgYnkgbWF0Y2hpbmcgYXR0cmlidXRlcyBvciBldmFsdWF0aW5nXG4gICAgLy8gYSBmdW5jdGlvblxuICAgIGNvbnN0IG1vZGUgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnbW9kZScsXG4gICAgICBjaG9pY2VzOiBbJ0F0dHJpYnV0ZScsICdGdW5jdGlvbiddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnQXR0cmlidXRlJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24obW9kZSk7XG5cbiAgICAvLyBBdHRyaWJ1dGUgbW9kZSBuZWVkcyBlZGdlIGFuZCBub2RlIGF0dHJpYnV0ZXNcbiAgICBtb2RlLnNwZWNzWydBdHRyaWJ1dGUnXS5hZGRPcHRpb24obmV3IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZWRnZUF0dHJpYnV0ZScsXG4gICAgICBkZWZhdWx0VmFsdWU6IG51bGwsIC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGxhYmVsIHNob3VsZCBiZSB1c2VkXG4gICAgICBnZXRJdGVtQ2hvaWNlUm9sZTogKGl0ZW0sIGlucHV0T3B0aW9ucykgPT4ge1xuICAgICAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICAgICAgaWYgKGlucHV0T3B0aW9ucy5lZGdlcyAmJiBpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMuZWRnZXMpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2RlZXAnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5ub2RlcyAmJiBpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMubm9kZXMpKSB7XG4gICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiAnc3RhbmRhcmQnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuICAgIG1vZGUuc3BlY3NbJ0F0dHJpYnV0ZSddLmFkZE9wdGlvbihuZXcgTmVzdGVkQXR0cmlidXRlT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdub2RlQXR0cmlidXRlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCwgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgbGFiZWwgc2hvdWxkIGJlIHVzZWRcbiAgICAgIGdldEl0ZW1DaG9pY2VSb2xlOiAoaXRlbSwgaW5wdXRPcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChpbnB1dE9wdGlvbnMubm9kZXMgJiYgaXRlbS5lcXVhbHMoaW5wdXRPcHRpb25zLm5vZGVzKSkge1xuICAgICAgICAgIHJldHVybiAnZGVlcCc7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiAnc3RhbmRhcmQnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuXG4gICAgLy8gRnVuY3Rpb24gbW9kZSBuZWVkcyB0aGUgZnVuY3Rpb25cbiAgICBtb2RlLnNwZWNzWydGdW5jdGlvbiddLmFkZE9wdGlvbihuZXcgSW5wdXRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2Nvbm5lY3RXaGVuJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogREVGQVVMVF9DT05ORUNUX1dIRU4sXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgUnVubmluZyB0aGUgQXR0YWNoIG9wZXJhdGlvbiBvbiBhbiBpbnN0YW5jZSBpcyBub3Qgc3VwcG9ydGVkLmApO1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmlnbm9yZUVycm9ycyAhPT0gJ1N0b3Agb24gRXJyb3InKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQmlwYXJ0aXRlJykge1xuICAgICAgaWYgKCEoXG4gICAgICAgIChpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICAgaW5wdXRPcHRpb25zLmVkZ2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIpICYmXG4gICAgICAgIChpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICAgaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1RhcmdldCBDb250YWluZXInKSB7XG4gICAgICBpZiAoIWlucHV0T3B0aW9ucy5ub2RlcyB8fCAhaW5wdXRPcHRpb25zLm5vZGVzLml0ZW1zKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGxldCBlZGdlSXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICAgIGxldCBub2RlSXRlbXMgPSBhd2FpdCBpbnB1dE9wdGlvbnMubm9kZXMuaXRlbXMoKTtcbiAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKGVkZ2VJdGVtcylcbiAgICAgICAgLnNvbWUoaXRlbSA9PiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyKSAmJlxuICAgICAgICBPYmplY3QudmFsdWVzKG5vZGVJdGVtcylcbiAgICAgICAgICAuc29tZShpdGVtID0+IGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIpO1xuICAgIH0gZWxzZSB7IC8vIGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnV2l0aGluIFNlbGVjdGlvbidcbiAgICAgIGNvbnN0IGVkZ2VJdGVtcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgICAgbGV0IG9uZU5vZGUgPSBmYWxzZTtcbiAgICAgIGxldCBvbmVFZGdlID0gZmFsc2U7XG4gICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhlZGdlSXRlbXMpLnNvbWUoaXRlbSA9PiB7XG4gICAgICAgIGlmIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSB7XG4gICAgICAgICAgb25lTm9kZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcikge1xuICAgICAgICAgIG9uZUVkZ2UgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvbmVOb2RlICYmIG9uZUVkZ2U7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGlucHV0T3B0aW9ucy5tb2RlID09PSAnRnVuY3Rpb24nKSB7XG4gICAgICBpZiAodHlwZW9mIGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIEZ1bmN0aW9uKCdlZGdlJywgJ25vZGUnLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuIHx8IERFRkFVTFRfQ09OTkVDVF9XSEVOKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaW5wdXRPcHRpb25zLmVkZ2VBdHRyaWJ1dGUgJiYgaW5wdXRPcHRpb25zLm5vZGVBdHRyaWJ1dGU7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24gKGl0ZW1zLCBjb25uZWN0V2hlbiwgZGlyZWN0aW9uLCBvdXRwdXQpIHtcbiAgICAvLyBXaXRoaW4gdGhlIHNlbGVjdGlvbiwgd2Ugb25seSBrbm93IHdoaWNoIG9uZXMgYXJlIGVkZ2VzIGFuZCB3aGljaCBvbmVzXG4gICAgLy8gYXJlIG5vZGVzIG9uIHRoZSBmbHlcbiAgICBjb25zdCBpdGVtTGlzdCA9IE9iamVjdC52YWx1ZXMoaXRlbXMpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IGl0ZW1MaXN0Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGxldCBlZGdlID1cbiAgICAgICAgICAoaXRlbUxpc3RbaV0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIgJiYgaXRlbUxpc3RbaV0pIHx8XG4gICAgICAgICAgKGl0ZW1MaXN0W2pdIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyICYmIGl0ZW1MaXN0W2pdKTtcbiAgICAgICAgbGV0IG5vZGUgPVxuICAgICAgICAgIChpdGVtTGlzdFtpXSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJiBpdGVtTGlzdFtpXSkgfHxcbiAgICAgICAgICAoaXRlbUxpc3Rbal0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIgJiYgaXRlbUxpc3Rbal0pO1xuICAgICAgICBpZiAoZWRnZSAmJiBub2RlICYmIGNvbm5lY3RXaGVuKGVkZ2UsIG5vZGUpKSB7XG4gICAgICAgICAgZWRnZS5hdHRhY2hUbyhub2RlLCBkaXJlY3Rpb24pO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MoZWRnZS5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2Mobm9kZS5kb2MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG5cbiAgICAvLyBGaWd1cmUgb3V0IHRoZSBjcml0ZXJpYSBmb3IgbWF0Y2hpbmcgbm9kZXNcbiAgICBsZXQgY29ubmVjdFdoZW47XG4gICAgaWYgKGlucHV0T3B0aW9ucy5tb2RlID09PSAnRnVuY3Rpb24nKSB7XG4gICAgICBjb25uZWN0V2hlbiA9IGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbjtcbiAgICAgIGlmICh0eXBlb2YgY29ubmVjdFdoZW4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25uZWN0V2hlbiA9IG5ldyBGdW5jdGlvbignZWRnZScsICdub2RlJywgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgICAgICAgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuIHx8IERFRkFVTFRfQ09OTkVDVF9XSEVOKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICAgICAgICBvdXRwdXQud2FybihgY29ubmVjdFdoZW4gU3ludGF4RXJyb3I6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHsgLy8gaWYgKGlucHV0T3B0aW9ucy5tb2RlID09PSAnQXR0cmlidXRlJylcbiAgICAgIGNvbnN0IGdldEVkZ2VWYWx1ZSA9IGlucHV0T3B0aW9ucy5lZGdlQXR0cmlidXRlID09PSBudWxsXG4gICAgICAgID8gZWRnZSA9PiBlZGdlLmxhYmVsXG4gICAgICAgIDogZWRnZSA9PiBlZGdlLnZhbHVlW2lucHV0T3B0aW9ucy5lZGdlQXR0cmlidXRlXTtcbiAgICAgIGNvbnN0IGdldE5vZGVWYWx1ZSA9IGlucHV0T3B0aW9ucy5ub2RlQXR0cmlidXRlID09PSBudWxsXG4gICAgICAgID8gbm9kZSA9PiBub2RlLmxhYmVsXG4gICAgICAgIDogbm9kZSA9PiBub2RlLnZhbHVlW2lucHV0T3B0aW9ucy5ub2RlQXR0cmlidXRlXTtcbiAgICAgIGNvbm5lY3RXaGVuID0gKGVkZ2UsIG5vZGUpID0+IGdldEVkZ2VWYWx1ZShlZGdlKSA9PT0gZ2V0Tm9kZVZhbHVlKG5vZGUpO1xuICAgIH1cblxuICAgIGxldCBlZGdlcztcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICBpZiAoaW5wdXRPcHRpb25zLmVkZ2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcikge1xuICAgICAgICBlZGdlcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5lZGdlcy5nZXRNZW1iZXJzKCk7XG4gICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgICAgaW5wdXRPcHRpb25zLmVkZ2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIpIHtcbiAgICAgICAgZWRnZXMgPSBpbnB1dE9wdGlvbnMuZWRnZXMuZ2V0Q29udGVudHMoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC53YXJuKGBpbnB1dE9wdGlvbnMuZWRnZXMgaXMgb2YgdW5leHBlY3RlZCB0eXBlICR7aW5wdXRPcHRpb25zLmVkZ2VzICYmIGlucHV0T3B0aW9ucy5lZGdlcy50eXBlfWApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlZGdlcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgIH1cblxuICAgIGxldCBlZGdlTGlzdCA9IE9iamVjdC52YWx1ZXMoZWRnZXMpO1xuICAgIGlmIChlZGdlTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIG91dHB1dC53YXJuKGBObyBlZGdlcyBzdXBwbGllZCB0byBhdHRhY2ggb3BlcmF0aW9uYCk7XG4gICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIC8vIEF0IHRoaXMgcG9pbnQgd2Uga25vdyBlbm91Z2ggdG8gZGVhbCB3aXRoICdXaXRoaW4gU2VsZWN0aW9uJyBtb2RlOlxuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1dpdGhpbiBTZWxlY3Rpb24nKSB7XG4gICAgICByZXR1cm4gdGhpcy5leGVjdXRlV2l0aGluU2VsZWN0aW9uKGVkZ2VzLCBjb25uZWN0V2hlbiwgaW5wdXRPcHRpb25zLmRpcmVjdGlvbiwgb3V0cHV0KTtcbiAgICB9XG5cbiAgICBsZXQgbm9kZXM7XG4gICAgaWYgKGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIFNlbGVjdGlvbikge1xuICAgICAgbm9kZXMgPSBhd2FpdCBpbnB1dE9wdGlvbnMubm9kZXMuaXRlbXMoKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyIHx8XG4gICAgICAgICAgICAgICBpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcikge1xuICAgICAgbm9kZXMgPSBhd2FpdCBpbnB1dE9wdGlvbnMubm9kZXMuZ2V0TWVtYmVycygpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIpIHtcbiAgICAgIG5vZGVzID0gaW5wdXRPcHRpb25zLm5vZGVzLmdldENvbnRlbnRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC53YXJuKGBpbnB1dE9wdGlvbnMubm9kZXMgaXMgb2YgdW5leHBlY3RlZCB0eXBlICR7aW5wdXRPcHRpb25zLm5vZGVzICYmIGlucHV0T3B0aW9ucy5ub2Rlcy50eXBlfWApO1xuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlTGlzdCA9IE9iamVjdC52YWx1ZXMobm9kZXMpO1xuICAgIGlmIChub2RlTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIG91dHB1dC53YXJuKCdObyBub2RlcyBzdXBwbGllZCB0byBhdHRhY2ggb3BlcmF0aW9uJyk7XG4gICAgfVxuXG4gICAgLy8gQXR0YWNoIHRoZSBlZGdlcyFcbiAgICBlZGdlTGlzdC5mb3JFYWNoKGVkZ2UgPT4ge1xuICAgICAgbm9kZUxpc3QuZm9yRWFjaChub2RlID0+IHtcbiAgICAgICAgaWYgKGVkZ2UgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIgJiZcbiAgICAgICAgICAgIG5vZGUgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIgJiZcbiAgICAgICAgICAgIGNvbm5lY3RXaGVuKGVkZ2UsIG5vZGUpKSB7XG4gICAgICAgICAgZWRnZS5hdHRhY2hUbyhub2RlLCBpbnB1dE9wdGlvbnMuZGlyZWN0aW9uKTtcbiAgICAgICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKGVkZ2UuZG9jKTtcbiAgICAgICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKG5vZGUuZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBdHRhY2hPcGVyYXRpb247XG4iLCJpbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgQXR0cmlidXRlT3B0aW9uIGZyb20gJy4vQ29tbW9uL0F0dHJpYnV0ZU9wdGlvbi5qcyc7XG5pbXBvcnQgQ2xhc3NPcHRpb24gZnJvbSAnLi9Db21tb24vQ2xhc3NPcHRpb24uanMnO1xuXG5jbGFzcyBBc3NpZ25DbGFzc09wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLmdldElucHV0U3BlYygpO1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29udGV4dCcsXG4gICAgICBjaG9pY2VzOiBbJ1N0cmluZycsICdBdHRyaWJ1dGUnXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1N0cmluZydcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKGNvbnRleHQpO1xuICAgIGNvbnRleHQuc3BlY3NbJ1N0cmluZyddLmFkZE9wdGlvbihuZXcgQ2xhc3NPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2NsYXNzTmFtZScsXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG4gICAgY29udGV4dC5zcGVjc1snQXR0cmlidXRlJ10uYWRkT3B0aW9uKG5ldyBBdHRyaWJ1dGVPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2F0dHJpYnV0ZSdcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHBvdGVudGlhbGx5RXhlY3V0YWJsZU9uSXRlbSAoaXRlbSkge1xuICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICByZXR1cm4gKGF3YWl0IHN1cGVyLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0sIGlucHV0T3B0aW9ucykpIHx8XG4gICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgT3V0cHV0U3BlYygpO1xuICAgIGxldCBjbGFzc05hbWUgPSBpbnB1dE9wdGlvbnMuY2xhc3NOYW1lO1xuICAgIGlmICghaW5wdXRPcHRpb25zLmNsYXNzTmFtZSkge1xuICAgICAgaWYgKCFpbnB1dE9wdGlvbnMuYXR0cmlidXRlKSB7XG4gICAgICAgIG91dHB1dC53YXJuKGBObyBjbGFzc05hbWUgb3IgYXR0cmlidXRlIG9wdGlvbiBzdXBwbGllZGApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgICAgaWYgKGl0ZW0uZ2V0VmFsdWUpIHtcbiAgICAgICAgY2xhc3NOYW1lID0gYXdhaXQgaXRlbS5nZXRWYWx1ZShpbnB1dE9wdGlvbnMuYXR0cmlidXRlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC53YXJuKGBDYW4ndCBnZXQgYXR0cmlidXRlcyBmcm9tICR7aXRlbS50eXBlfSBpbnN0YW5jZWApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgICAgaWYgKCFjbGFzc05hbWUpIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYCR7aXRlbS50eXBlfSBpbnN0YW5jZSBtaXNzaW5nIGF0dHJpYnV0ZSAke2lucHV0T3B0aW9ucy5hdHRyaWJ1dGV9YCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghaXRlbS5hZGRDbGFzcykge1xuICAgICAgb3V0cHV0Lndhcm4oYENhbid0IGFzc2lnbiBjbGFzcyB0byBub24tdGFnZ2FibGUgJHtpdGVtLnR5cGV9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZW0uYWRkQ2xhc3MoY2xhc3NOYW1lKTtcbiAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MoaXRlbS5kb2MpO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFzc2lnbkNsYXNzT3BlcmF0aW9uO1xuIiwiaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQganNvblBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICd1a2knO1xuaW1wb3J0IFNlbGVjdGlvbiBmcm9tICcuL1NlbGVjdGlvbi5qcyc7XG5cbmltcG9ydCBSb290V3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1Jvb3RXcmFwcGVyLmpzJztcbmltcG9ydCBEb2N1bWVudFdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9Eb2N1bWVudFdyYXBwZXIuanMnO1xuaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9QcmltaXRpdmVXcmFwcGVyLmpzJztcbmltcG9ydCBJbnZhbGlkV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL0ludmFsaWRXcmFwcGVyLmpzJztcbmltcG9ydCBOdWxsV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL051bGxXcmFwcGVyLmpzJztcbmltcG9ydCBCb29sZWFuV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL0Jvb2xlYW5XcmFwcGVyLmpzJztcbmltcG9ydCBOdW1iZXJXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvTnVtYmVyV3JhcHBlci5qcyc7XG5pbXBvcnQgU3RyaW5nV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1N0cmluZ1dyYXBwZXIuanMnO1xuaW1wb3J0IERhdGVXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvRGF0ZVdyYXBwZXIuanMnO1xuaW1wb3J0IFJlZmVyZW5jZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9SZWZlcmVuY2VXcmFwcGVyLmpzJztcbmltcG9ydCBDb250YWluZXJXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvQ29udGFpbmVyV3JhcHBlci5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5pbXBvcnQgU2V0V3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1NldFdyYXBwZXIuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuaW1wb3J0IFN1cGVybm9kZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9TdXBlcm5vZGVXcmFwcGVyLmpzJztcblxuaW1wb3J0IFNlbGVjdEFsbE9wZXJhdGlvbiBmcm9tICcuL09wZXJhdGlvbnMvU2VsZWN0QWxsT3BlcmF0aW9uLmpzJztcbmltcG9ydCBGaWx0ZXJPcGVyYXRpb24gZnJvbSAnLi9PcGVyYXRpb25zL0ZpbHRlck9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgQ29udmVydE9wZXJhdGlvbiBmcm9tICcuL09wZXJhdGlvbnMvQ29udmVydE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgQ29ubmVjdE9wZXJhdGlvbiBmcm9tICcuL09wZXJhdGlvbnMvQ29ubmVjdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgQXR0YWNoT3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9BdHRhY2hPcGVyYXRpb24uanMnO1xuaW1wb3J0IEFzc2lnbkNsYXNzT3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9Bc3NpZ25DbGFzc09wZXJhdGlvbi5qcyc7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBNb2RlbCB7XG4gIGNvbnN0cnVjdG9yIChQb3VjaERCLCBkMywgZDNuKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLlBvdWNoREIgPSBQb3VjaERCOyAvLyBjb3VsZCBiZSBwb3VjaGRiLW5vZGUgb3IgcG91Y2hkYi1icm93c2VyXG4gICAgdGhpcy5kMyA9IGQzOyAvLyBmb3IgTm9kZS5qcywgdGhpcyB3aWxsIGJlIGZyb20gZDMtbm9kZSwgbm90IHRoZSByZWd1bGFyIG9uZVxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIGlmIChkM24pIHtcbiAgICAgIC8vIHRvIHJ1biB0ZXN0cywgd2UgYWxzbyBuZWVkIGFjY2VzcyB0byB0aGUgZDMtbm9kZSB3cmFwcGVyICh3ZSBkb24ndFxuICAgICAgLy8gaW1wb3J0IGl0IGRpcmVjdGx5IGludG8gdGhlIHRlc3RzIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSBuYW1lc3BhY2VcbiAgICAgIC8vIGFkZGl0aW9uIGJlbG93IHdvcmtzKVxuICAgICAgdGhpcy5kM24gPSBkM247XG4gICAgICB0aGlzLndpbmRvdyA9IHRoaXMuZDNuLndpbmRvdztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy53aW5kb3cgPSB3aW5kb3c7XG4gICAgfVxuXG4gICAgLy8gVGhlIG5hbWVzcGFjZSBzdHJpbmcgZm9yIG91ciBjdXN0b20gWE1MXG4gICAgdGhpcy5OU1N0cmluZyA9ICdodHRwOi8vbXVyZS1hcHBzLmdpdGh1Yi5pbyc7XG4gICAgdGhpcy5kMy5uYW1lc3BhY2VzLm11cmUgPSB0aGlzLk5TU3RyaW5nO1xuXG4gICAgLy8gT3VyIGN1c3RvbSB0eXBlIGRlZmluaXRpb25zXG4gICAgdGhpcy5XUkFQUEVSUyA9IHtcbiAgICAgIFJvb3RXcmFwcGVyLFxuICAgICAgRG9jdW1lbnRXcmFwcGVyLFxuICAgICAgUHJpbWl0aXZlV3JhcHBlcixcbiAgICAgIEludmFsaWRXcmFwcGVyLFxuICAgICAgTnVsbFdyYXBwZXIsXG4gICAgICBCb29sZWFuV3JhcHBlcixcbiAgICAgIE51bWJlcldyYXBwZXIsXG4gICAgICBTdHJpbmdXcmFwcGVyLFxuICAgICAgRGF0ZVdyYXBwZXIsXG4gICAgICBSZWZlcmVuY2VXcmFwcGVyLFxuICAgICAgQ29udGFpbmVyV3JhcHBlcixcbiAgICAgIEdlbmVyaWNXcmFwcGVyLFxuICAgICAgU2V0V3JhcHBlcixcbiAgICAgIEVkZ2VXcmFwcGVyLFxuICAgICAgTm9kZVdyYXBwZXIsXG4gICAgICBTdXBlcm5vZGVXcmFwcGVyXG4gICAgfTtcblxuICAgIC8vIFNwZWNpYWwga2V5cyB0aGF0IHNob3VsZCBiZSBza2lwcGVkIGluIHZhcmlvdXMgb3BlcmF0aW9uc1xuICAgIHRoaXMuUkVTRVJWRURfT0JKX0tFWVMgPSB7XG4gICAgICAnX2lkJzogdHJ1ZSxcbiAgICAgICdfcmV2JzogdHJ1ZSxcbiAgICAgICckd2FzQXJyYXknOiB0cnVlLFxuICAgICAgJyR0YWdzJzogdHJ1ZSxcbiAgICAgICckbWVtYmVycyc6IHRydWUsXG4gICAgICAnJGVkZ2VzJzogdHJ1ZSxcbiAgICAgICckbm9kZXMnOiB0cnVlLFxuICAgICAgJyRuZXh0TGFiZWwnOiB0cnVlLFxuICAgICAgJyRpc0RhdGUnOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIE1vZGVzIGZvciBkZXJpdmluZyBzZWxlY3Rpb25zXG4gICAgdGhpcy5ERVJJVkVfTU9ERVMgPSB7XG4gICAgICBSRVBMQUNFOiAnUkVQTEFDRScsXG4gICAgICBVTklPTjogJ1VOSU9OJyxcbiAgICAgIFhPUjogJ1hPUidcbiAgICB9O1xuXG4gICAgLy8gQXV0by1tYXBwaW5ncyBmcm9tIG5hdGl2ZSBqYXZhc2NyaXB0IHR5cGVzIHRvIFdyYXBwZXJzXG4gICAgdGhpcy5KU1RZUEVTID0ge1xuICAgICAgJ251bGwnOiBOdWxsV3JhcHBlcixcbiAgICAgICdib29sZWFuJzogQm9vbGVhbldyYXBwZXIsXG4gICAgICAnbnVtYmVyJzogTnVtYmVyV3JhcHBlclxuICAgIH07XG5cbiAgICAvLyBBbGwgdGhlIHN1cHBvcnRlZCBvcGVyYXRpb25zXG4gICAgbGV0IG9wZXJhdGlvbkNsYXNzZXMgPSBbXG4gICAgICBTZWxlY3RBbGxPcGVyYXRpb24sXG4gICAgICBGaWx0ZXJPcGVyYXRpb24sXG4gICAgICBDb252ZXJ0T3BlcmF0aW9uLFxuICAgICAgQ29ubmVjdE9wZXJhdGlvbixcbiAgICAgIEF0dGFjaE9wZXJhdGlvbixcbiAgICAgIEFzc2lnbkNsYXNzT3BlcmF0aW9uXG4gICAgXTtcbiAgICB0aGlzLk9QRVJBVElPTlMgPSB7fTtcblxuICAgIC8vIFVubGlrZSBXUkFQUEVSUywgd2UgYWN0dWFsbHkgd2FudCB0byBpbnN0YW50aWF0ZSBhbGwgdGhlIG9wZXJhdGlvbnNcbiAgICAvLyB3aXRoIGEgcmVmZXJlbmNlIHRvIHRoaXMuIFdoaWxlIHdlJ3JlIGF0IGl0LCBtb25rZXkgcGF0Y2ggdGhlbSBvbnRvXG4gICAgLy8gdGhlIFNlbGVjdGlvbiBjbGFzc1xuICAgIG9wZXJhdGlvbkNsYXNzZXMuZm9yRWFjaChPcGVyYXRpb24gPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IG5ldyBPcGVyYXRpb24odGhpcyk7XG4gICAgICB0aGlzLk9QRVJBVElPTlNbdGVtcC50eXBlXSA9IHRlbXA7XG4gICAgICBTZWxlY3Rpb24ucHJvdG90eXBlW3RlbXAubG93ZXJDYW1lbENhc2VUeXBlXSA9IGFzeW5jIGZ1bmN0aW9uIChpbnB1dE9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXhlY3V0ZSh0ZW1wLCBpbnB1dE9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSAvIGxvYWQgdGhlIGxvY2FsIGRhdGFiYXNlIG9mIGZpbGVzXG4gICAgdGhpcy5nZXRPckluaXREYigpO1xuXG4gICAgLy8gaW4gdGhlIGFic2VuY2Ugb2YgYSBjdXN0b20gZGlhbG9ncywganVzdCB1c2Ugd2luZG93LmFsZXJ0LFxuICAgIC8vIHdpbmRvdy5jb25maXJtLCB3aW5kb3cucHJvbXB0LCBjb25zb2xlLndhcm4sIGFuZCBjb25zb2xlLmxvZzpcbiAgICB0aGlzLmFsZXJ0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMud2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xuICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLmNvbmZpcm0gPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLndpbmRvdy5jb25maXJtKG1lc3NhZ2UpKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy5wcm9tcHQgPSAobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHRoaXMud2luZG93LnByb21wdChtZXNzYWdlLCBkZWZhdWx0VmFsdWUpKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy53YXJuID0gZnVuY3Rpb24gKCkge1xuICAgICAgY29uc29sZS53YXJuKC4uLmFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICB0aGlzLmxvZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNvbnNvbGUubG9nKC4uLmFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuICBjdXN0b21pemVBbGVydERpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5hbGVydCA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVDb25maXJtRGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmNvbmZpcm0gPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgY3VzdG9taXplUHJvbXB0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLnByb21wdCA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBnZXRPckluaXREYiAoKSB7XG4gICAgdGhpcy5kYiA9IG5ldyB0aGlzLlBvdWNoREIoJ211cmUnKTtcbiAgICB0aGlzLmRiU3RhdHVzID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgbGV0IHN0YXR1cyA9IHsgc3luY2VkOiBmYWxzZSB9O1xuICAgICAgICBsZXQgY291Y2hEYlVybCA9IHRoaXMud2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjb3VjaERiVXJsJyk7XG4gICAgICAgIGlmIChjb3VjaERiVXJsKSB7XG4gICAgICAgICAgbGV0IGNvdWNoRGIgPSBuZXcgdGhpcy5Qb3VjaERCKGNvdWNoRGJVcmwsIHtza2lwX3NldHVwOiB0cnVlfSk7XG4gICAgICAgICAgc3RhdHVzLnN5bmNlZCA9ICEhKGF3YWl0IHRoaXMuZGIuc3luYyhjb3VjaERiLCB7bGl2ZTogdHJ1ZSwgcmV0cnk6IHRydWV9KVxuICAgICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgIHRoaXMuYWxlcnQoJ0Vycm9yIHN5bmNpbmcgd2l0aCAnICsgY291Y2hEYlVybCArICc6ICcgK1xuICAgICAgICAgICAgICAgIGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXR1cy5pbmRleGVkID0gISEoYXdhaXQgdGhpcy5kYi5jcmVhdGVJbmRleCh7XG4gICAgICAgICAgaW5kZXg6IHtcbiAgICAgICAgICAgIGZpZWxkczogWydmaWxlbmFtZSddXG4gICAgICAgICAgfVxuICAgICAgICB9KS5jYXRjaCgoKSA9PiBmYWxzZSkpO1xuICAgICAgICBzdGF0dXMubGlua2VkVXNlclNlbGVjdGlvbiA9ICEhKGF3YWl0IHRoaXMuZGIucHV0KHtcbiAgICAgICAgICBfaWQ6ICckbGlua2VkVXNlclNlbGVjdGlvbicsXG4gICAgICAgICAgc2VsZWN0b3JMaXN0OiBbXVxuICAgICAgICB9KS5jYXRjaCgoKSA9PiBmYWxzZSkpO1xuICAgICAgICBzdGF0dXMubGlua2VkVmlld1NldHRpbmdzID0gISEoYXdhaXQgdGhpcy5kYi5wdXQoe1xuICAgICAgICAgIF9pZDogJyRsaW5rZWRWaWV3U2V0dGluZ3MnLFxuICAgICAgICAgIHNldHRpbmdzOiB7fVxuICAgICAgICB9KS5jYXRjaCgoKSA9PiBmYWxzZSkpO1xuICAgICAgICB0aGlzLmRiLmNoYW5nZXMoe1xuICAgICAgICAgIHNpbmNlOiAoYXdhaXQgdGhpcy5kYi5pbmZvKCkpLnVwZGF0ZV9zZXEgLSAxLFxuICAgICAgICAgIGxpdmU6IHRydWUsXG4gICAgICAgICAgaW5jbHVkZV9kb2NzOiB0cnVlXG4gICAgICAgIH0pLm9uKCdjaGFuZ2UnLCBjaGFuZ2UgPT4ge1xuICAgICAgICAgIGlmIChjaGFuZ2UuaWQgPiAnX1xcdWZmZmYnKSB7XG4gICAgICAgICAgICAvLyBBIHJlZ3VsYXIgZG9jdW1lbnQgY2hhbmdlZDsgaW52YWxpZGF0ZSBhbGwgc2VsZWN0aW9uIGNhY2hlc1xuICAgICAgICAgICAgLy8gY29ycmVzcG9uZGluZyB0byB0aGlzIGRvY3VtZW50XG4gICAgICAgICAgICBTZWxlY3Rpb24uSU5WQUxJREFURV9ET0NfQ0FDSEUoY2hhbmdlLmlkKTtcbiAgICAgICAgICAgIGlmIChjaGFuZ2UuZG9jLl9yZXYuc2VhcmNoKC9eMS0vKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgLy8gVE9ETzogdGhpcyBpcyBhIGhhY2sgdG8gc2VlIGlmIGl0J3MgYSBuZXdseS1hZGRlZCBkb2MgKHdlIHdhbnRcbiAgICAgICAgICAgICAgLy8gdG8gaW52YWxpZGF0ZSBhbGwgc2VsZWN0aW9uIGNhY2hlcywgYmVjYXVzZSB3ZSBoYXZlIG5vIHdheSB0b1xuICAgICAgICAgICAgICAvLyBrbm93IGlmIHRoZXknZCBzZWxlY3QgdGhpcyBuZXcgZG9jdW1lbnQgb3Igbm90KS4gVGhpcyB3b24ndFxuICAgICAgICAgICAgICAvLyB3b3JrIG9uY2Ugd2Ugc3RhcnQgZGVhbGluZyB3aXRoIHJlcGxpY2F0aW9uLCBpZiBhIGZpbGUgZ2V0c1xuICAgICAgICAgICAgICAvLyBhZGRlZCByZW1vdGVseS4gU2VlIFwiSG93IGNhbiBJIGRpc3Rpbmd1aXNoIGJldHdlZW4gYWRkZWQgYW5kXG4gICAgICAgICAgICAgIC8vIG1vZGlmaWVkIGRvY3VtZW50c1wiIGluIHRoZSBQb3VjaERCIGRvY3VtZW50YXRpb246XG4gICAgICAgICAgICAgIC8vIGh0dHBzOi8vcG91Y2hkYi5jb20vZ3VpZGVzL2NoYW5nZXMuaHRtbFxuICAgICAgICAgICAgICBTZWxlY3Rpb24uSU5WQUxJREFURV9BTExfQ0FDSEVTKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2RvY0NoYW5nZScsIGNoYW5nZS5kb2MpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhbmdlLmlkID09PSAnJGxpbmtlZFVzZXJTZWxlY3Rpb24nKSB7XG4gICAgICAgICAgICAvLyBUaGUgbGlua2VkIHVzZXIgc2VsZWN0aW9uIGNoYW5nZWRcbiAgICAgICAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcignbGlua2VkVmlld0NoYW5nZScsIHtcbiAgICAgICAgICAgICAgdXNlclNlbGVjdGlvbjogdGhpcy5zZWxlY3RBbGwoY2hhbmdlLmRvYy5zZWxlY3Rvckxpc3QpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoYW5nZS5pZCA9PT0gJyRsaW5rZWRWaWV3U2V0dGluZ3MnKSB7XG4gICAgICAgICAgICAvLyBUaGUgbGlua2VkIHZpZXcgc2V0dGluZ3MgY2hhbmdlZFxuICAgICAgICAgICAgdGhpcy5zdGlja3lUcmlnZ2VyKCdsaW5rZWRWaWV3Q2hhbmdlJywge1xuICAgICAgICAgICAgICBzZXR0aW5nczogY2hhbmdlLmRvYy5zZXR0aW5nc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KS5vbignZXJyb3InLCBlcnIgPT4ge1xuICAgICAgICAgIHRoaXMud2FybihlcnIpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVzb2x2ZShzdGF0dXMpO1xuICAgICAgfSkoKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyBhbGxEb2NzIChvcHRpb25zID0ge30pIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIE9iamVjdC5hc3NpZ24ob3B0aW9ucywge1xuICAgICAgc3RhcnRrZXk6ICdfXFx1ZmZmZicsXG4gICAgICBpbmNsdWRlX2RvY3M6IHRydWVcbiAgICB9KTtcbiAgICBsZXQgcmVzdWx0cyA9IGF3YWl0IHRoaXMuZGIuYWxsRG9jcyhvcHRpb25zKTtcbiAgICByZXR1cm4gcmVzdWx0cy5yb3dzLm1hcChyb3cgPT4gcm93LmRvYyk7XG4gIH1cbiAgYXN5bmMgYWxsRG9jV3JhcHBlcnMgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5hbGxEb2NzKCkpXG4gICAgICAubWFwKGRvYyA9PiBuZXcgdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIoeyBtdXJlOiB0aGlzLCBkb2MgfSkpO1xuICB9XG4gIGFzeW5jIHF1ZXJ5RG9jcyAocXVlcnlPYmopIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIGxldCBxdWVyeVJlc3VsdCA9IGF3YWl0IHRoaXMuZGIuZmluZChxdWVyeU9iaik7XG4gICAgaWYgKHF1ZXJ5UmVzdWx0Lndhcm5pbmcpIHsgdGhpcy53YXJuKHF1ZXJ5UmVzdWx0Lndhcm5pbmcpOyB9XG4gICAgcmV0dXJuIHF1ZXJ5UmVzdWx0LmRvY3M7XG4gIH1cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBhcm91bmQgUG91Y2hEQi5nZXQoKSB0aGF0IGVuc3VyZXMgdGhhdCB0aGUgZmlyc3QgbWF0Y2hlZFxuICAgKiBkb2N1bWVudCBleGlzdHMgKG9wdGlvbmFsbHkgY3JlYXRlcyBhbiBlbXB0eSBkb2N1bWVudCB3aGVuIGl0IGRvZXNuJ3QpLCBhbmRcbiAgICogdGhhdCBpdCBjb25mb3JtcyB0byB0aGUgc3BlY2lmaWNhdGlvbnMgb3V0bGluZWQgaW4gZG9jdW1lbnRhdGlvbi9zY2hlbWEubWRcbiAgICogQHBhcmFtICB7T2JqZWN0fHN0cmluZ30gIFtkb2NRdWVyeV1cbiAgICogVGhlIGBzZWxlY3RvcmAgY29tcG9uZW50IG9mIGEgTWFuZ28gcXVlcnksIG9yLCBpZiBhIHN0cmluZywgdGhlIHByZWNpc2VcbiAgICogZG9jdW1lbnQgX2lkXG4gICAqIEBwYXJhbSAge3tib29sZWFufX0gIFtpbml0PXRydWVdXG4gICAqIElmIHRydWUgKGRlZmF1bHQpLCB0aGUgZG9jdW1lbnQgd2lsbCBiZSBjcmVhdGVkIChidXQgbm90IHNhdmVkKSBpZiBpdCBkb2VzXG4gICAqIG5vdCBleGlzdC4gSWYgZmFsc2UsIHRoZSByZXR1cm5lZCBQcm9taXNlIHdpbGwgcmVzb2x2ZSB0byBudWxsXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqIFJlc29sdmVzIHRoZSBkb2N1bWVudFxuICAgKi9cbiAgYXN5bmMgZ2V0RG9jIChkb2NRdWVyeSwgeyBpbml0ID0gdHJ1ZSB9ID0ge30pIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIGxldCBkb2M7XG4gICAgaWYgKCFkb2NRdWVyeSkge1xuICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyLmxhdW5jaFN0YW5kYXJkaXphdGlvbih7IGRvYzoge30sIG11cmU6IHRoaXMgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgZG9jUXVlcnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmIChkb2NRdWVyeVswXSA9PT0gJ0AnKSB7XG4gICAgICAgICAgZG9jUXVlcnkgPSBKU09OLnBhcnNlKGRvY1F1ZXJ5LnNsaWNlKDEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkb2NRdWVyeSA9IHsgJ19pZCc6IGRvY1F1ZXJ5IH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBtYXRjaGluZ0RvY3MgPSBhd2FpdCB0aGlzLnF1ZXJ5RG9jcyh7IHNlbGVjdG9yOiBkb2NRdWVyeSwgbGltaXQ6IDEgfSk7XG4gICAgICBpZiAobWF0Y2hpbmdEb2NzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBpZiAoaW5pdCkge1xuICAgICAgICAgIC8vIElmIG1pc3NpbmcsIHVzZSB0aGUgZG9jUXVlcnkgaXRzZWxmIGFzIHRoZSB0ZW1wbGF0ZSBmb3IgYSBuZXcgZG9jXG4gICAgICAgICAgZG9jID0gYXdhaXQgdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIubGF1bmNoU3RhbmRhcmRpemF0aW9uKHsgZG9jOiBkb2NRdWVyeSwgbXVyZTogdGhpcyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jID0gbWF0Y2hpbmdEb2NzWzBdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRvYztcbiAgICB9XG4gIH1cbiAgYXN5bmMgcHV0RG9jIChkb2MpIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gdGhpcy5kYi5wdXQoZG9jKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRoaXMud2FybihlcnIubWVzc2FnZSk7XG4gICAgICByZXR1cm4gZXJyO1xuICAgIH1cbiAgfVxuICBhc3luYyBwdXREb2NzIChkb2NMaXN0KSB7XG4gICAgYXdhaXQgdGhpcy5kYlN0YXR1cztcbiAgICAvLyBQb3VjaERCIGRvZXNuJ3Qgc3VwcG9ydCB0cmFuc2FjdGlvbnMsIHNvIHdlIHdhbnQgdG8gYmUgYWJsZSB0byByb2xsIGJhY2tcbiAgICAvLyBhbnkgY2hhbmdlcyBpbiB0aGUgZXZlbnQgdGhhdCBvdXIgdXBkYXRlIGZhaWxzXG4gICAgY29uc3QgcHJldmlvdXNEb2NzID0gKGF3YWl0IHRoaXMuZGIuZmluZCh7XG4gICAgICBzZWxlY3Rvcjogeyckb3InOiBkb2NMaXN0Lm1hcChkb2MgPT4ge1xuICAgICAgICByZXR1cm4geyBfaWQ6IGRvYy5faWQgfTtcbiAgICAgIH0pfVxuICAgIH0pKS5kb2NzO1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZGIuYnVsa0RvY3MoZG9jTGlzdCk7XG4gICAgbGV0IG5ld1JldnMgPSB7fTtcbiAgICBsZXQgZXJyb3JNZXNzYWdlcyA9IHt9O1xuICAgIGxldCBlcnJvclNlZW4gPSBmYWxzZTtcbiAgICByZXN1bHQuZm9yRWFjaChyZXN1bHRPYmogPT4ge1xuICAgICAgaWYgKHJlc3VsdE9iai5lcnJvcikge1xuICAgICAgICBlcnJvclNlZW4gPSB0cnVlO1xuICAgICAgICBlcnJvck1lc3NhZ2VzW3Jlc3VsdE9iai5tZXNzYWdlXSA9IGVycm9yTWVzc2FnZXNbcmVzdWx0T2JqLm1lc3NhZ2VdIHx8IFtdO1xuICAgICAgICBlcnJvck1lc3NhZ2VzW3Jlc3VsdE9iai5tZXNzYWdlXS5wdXNoKHJlc3VsdE9iai5pZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSZXZzW3Jlc3VsdE9iai5pZF0gPSByZXN1bHRPYmoucmV2O1xuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChlcnJvclNlZW4pIHtcbiAgICAgIC8vIFdlIG5lZWQgdG8gcmV2ZXJ0IGFueSBkb2N1bWVudHMgdGhhdCB3ZXJlIHN1Y2Nlc3NmdWxcbiAgICAgIGNvbnN0IHJldmVydGVkRG9jcyA9IHByZXZpb3VzRG9jcy5maWx0ZXIoZG9jID0+IHtcbiAgICAgICAgaWYgKG5ld1JldnNbZG9jLl9pZF0pIHtcbiAgICAgICAgICBkb2MuX3JldiA9IG5ld1JldnNbZG9jLl9pZF07XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIC8vIFRPRE86IHdoYXQgaWYgVEhJUyBmYWlscz9cbiAgICAgIGF3YWl0IHRoaXMuZGIuYnVsa0RvY3MocmV2ZXJ0ZWREb2NzKTtcbiAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKE9iamVjdC5lbnRyaWVzKGVycm9yTWVzc2FnZXMpLm1hcCgoW21lc3NhZ2UsIGlkc10pID0+IHtcbiAgICAgICAgcmV0dXJuIGAke21lc3NhZ2V9XFxuQWZmZWN0ZWQgRG9jdW1lbnRzOlxcbiAgJHtpZHMuam9pbignXFxuICAnKX1gO1xuICAgICAgfSkuam9pbignXFxuXFxuJykpO1xuICAgICAgZXJyb3IuZXJyb3IgPSB0cnVlO1xuICAgICAgcmV0dXJuIGVycm9yO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIC8qKlxuICAgKiBEb3dubG9hZHMgYSBnaXZlbiBmaWxlLCBvcHRpb25hbGx5IHNwZWNpZnlpbmcgYSBwYXJ0aWN1bGFyIGZvcm1hdFxuICAgKiBAcGFyYW0gIHtPYmplY3R8c3RyaW5nfSAgZG9jUXVlcnlcbiAgICogVGhlIGBzZWxlY3RvcmAgY29tcG9uZW50IG9mIGEgTWFuZ28gcXVlcnksIG9yLCBpZiBhIHN0cmluZywgdGhlIHByZWNpc2VcbiAgICogZG9jdW1lbnQgX2lkXG4gICAqIEBwYXJhbSAge3tzdHJpbmd8bnVsbH19ICBbbWltZVR5cGU9bnVsbF1cbiAgICogT3ZlcnJpZGVzIHRoZSBkb2N1bWVudCdzIG1pbWVUeXBlIGluIGZvcm1hdHRpbmcgdGhlIGRvd25sb2FkXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqIFJlc29sdmVzIGFzIGB0cnVlYCBvbmNlIHRoZSBkb3dubG9hZCBpcyBpbml0aWF0ZWRcbiAgICovXG4gIGFzeW5jIGRvd25sb2FkRG9jIChkb2NRdWVyeSwgeyBtaW1lVHlwZSA9IG51bGwgfSA9IHt9KSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0RG9jKGRvY1F1ZXJ5KVxuICAgICAgLnRoZW4oZG9jID0+IHtcbiAgICAgICAgbWltZVR5cGUgPSBtaW1lVHlwZSB8fCBkb2MubWltZVR5cGU7XG4gICAgICAgIGxldCBjb250ZW50cyA9IHRoaXMuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyLmZvcm1hdERvYyhkb2MsIHsgbWltZVR5cGUgfSk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rIHRvIGluaXRpYXRlIHRoZSBkb3dubG9hZFxuICAgICAgICBsZXQgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgYS5zdHlsZSA9ICdkaXNwbGF5Om5vbmUnO1xuICAgICAgICBsZXQgdXJsID0gdGhpcy53aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgd2luZG93LkJsb2IoW2NvbnRlbnRzXSwgeyB0eXBlOiBtaW1lVHlwZSB9KSk7XG4gICAgICAgIGEuaHJlZiA9IHVybDtcbiAgICAgICAgYS5kb3dubG9hZCA9IGRvYy5faWQ7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG4gICAgICAgIGEuY2xpY2soKTtcbiAgICAgICAgdGhpcy53aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgICAgICBhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgfVxuICBhc3luYyB1cGxvYWRGaWxlT2JqIChmaWxlT2JqLCB7IGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSkgfSA9IHt9KSB7XG4gICAgbGV0IHN0cmluZyA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgd2luZG93LkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLnVwbG9hZFN0cmluZyhmaWxlT2JqLm5hbWUsIGZpbGVPYmoudHlwZSwgZW5jb2RpbmcsIHN0cmluZyk7XG4gIH1cbiAgYXN5bmMgdXBsb2FkU3RyaW5nIChmaWxlbmFtZSwgbWltZVR5cGUsIGVuY29kaW5nLCBzdHJpbmcsIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCkge1xuICAgIGlmICghbWltZVR5cGUpIHtcbiAgICAgIGxldCB0ZW1wID0gbWltZS5sb29rdXAoZmlsZW5hbWUpO1xuICAgICAgaWYgKHRlbXApIHtcbiAgICAgICAgbWltZVR5cGUgPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBjb25zdCBleHRlbnNpb24gPSBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihtaW1lVHlwZSkgfHwgJ3R4dCc7XG4gICAgbGV0IGRvYyA9IGF3YWl0IHRoaXMuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyLnBhcnNlKHN0cmluZywgZXh0ZW5zaW9uKTtcbiAgICByZXR1cm4gdGhpcy51cGxvYWREb2MoZmlsZW5hbWUsIG1pbWVUeXBlLCBlbmNvZGluZywgZG9jKTtcbiAgfVxuICBhc3luYyB1cGxvYWREb2MgKGZpbGVuYW1lLCBtaW1lVHlwZSwgZW5jb2RpbmcsIGRvYykge1xuICAgIGRvYy5maWxlbmFtZSA9IGZpbGVuYW1lIHx8IGRvYy5maWxlbmFtZTtcbiAgICBkb2MubWltZVR5cGUgPSBtaW1lVHlwZSB8fCBkb2MubWltZVR5cGU7XG4gICAgZG9jLmNoYXJzZXQgPSBlbmNvZGluZyB8fCBkb2MuY2hhcnNldDtcbiAgICBkb2MgPSBhd2FpdCB0aGlzLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlci5sYXVuY2hTdGFuZGFyZGl6YXRpb24oeyBkb2MsIG11cmU6IHRoaXMgfSk7XG4gICAgaWYgKCEoYXdhaXQgdGhpcy5wdXREb2MoZG9jKSkub2spIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5zZWxlY3RBbGwoYEB7XCJfaWRcIjpcIiR7ZG9jLl9pZH1cIn0kYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGRlbGV0ZURvYyAoZG9jUXVlcnkpIHtcbiAgICBsZXQgZG9jID0gYXdhaXQgdGhpcy5nZXREb2MoZG9jUXVlcnkpO1xuICAgIHJldHVybiB0aGlzLnB1dERvYyh7XG4gICAgICBfaWQ6IGRvYy5faWQsXG4gICAgICBfcmV2OiBkb2MuX3JldixcbiAgICAgIF9kZWxldGVkOiB0cnVlXG4gICAgfSk7XG4gIH1cbiAgc2VsZWN0RG9jIChkb2NJZCkge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdEFsbCgnQHtcIl9pZFwiOlwiJyArIGRvY0lkICsgJ1wifSQnKTtcbiAgfVxuICBzZWxlY3RBbGwgKHNlbGVjdG9yTGlzdCkge1xuICAgIHJldHVybiBuZXcgU2VsZWN0aW9uKHRoaXMsIHNlbGVjdG9yTGlzdCk7XG4gIH1cbiAgYXN5bmMgc2V0TGlua2VkVmlld3MgKHsgdXNlclNlbGVjdGlvbiwgc2V0dGluZ3MgfSA9IHt9KSB7XG4gICAgYXdhaXQgdGhpcy5kYlN0YXR1cztcbiAgICBsZXQgZG9jcyA9IFtdO1xuICAgIGlmICh1c2VyU2VsZWN0aW9uKSB7XG4gICAgICBjb25zdCBsaW5rZWRVc2VyU2VsZWN0aW9uID0gYXdhaXQgdGhpcy5kYi5nZXQoJyRsaW5rZWRVc2VyU2VsZWN0aW9uJyk7XG4gICAgICBsaW5rZWRVc2VyU2VsZWN0aW9uLnNlbGVjdG9yTGlzdCA9IHVzZXJTZWxlY3Rpb24uc2VsZWN0b3JMaXN0O1xuICAgICAgZG9jcy5wdXNoKGxpbmtlZFVzZXJTZWxlY3Rpb24pO1xuICAgIH1cbiAgICBpZiAoc2V0dGluZ3MpIHtcbiAgICAgIGNvbnN0IGxpbmtlZFZpZXdTZXR0aW5ncyA9IGF3YWl0IHRoaXMuZGIuZ2V0KCckbGlua2VkVmlld1NldHRpbmdzJyk7XG4gICAgICBPYmplY3QuYXNzaWduKGxpbmtlZFZpZXdTZXR0aW5ncy5zZXR0aW5ncywgc2V0dGluZ3MpO1xuICAgICAgZG9jcy5wdXNoKGxpbmtlZFZpZXdTZXR0aW5ncyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnB1dERvY3MoZG9jcyk7XG4gIH1cbiAgYXN5bmMgZ2V0TGlua2VkVmlld3MgKCkge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuZGIuZ2V0KCckbGlua2VkVXNlclNlbGVjdGlvbicpLFxuICAgICAgdGhpcy5kYi5nZXQoJyRsaW5rZWRWaWV3U2V0dGluZ3MnKVxuICAgIF0pO1xuICAgIHJldHVybiB7XG4gICAgICB1c2VyU2VsZWN0aW9uOiB0aGlzLnNlbGVjdEFsbCh0ZW1wWzBdLnNlbGVjdG9yTGlzdCksXG4gICAgICBzZXR0aW5nczogdGVtcFsxXS5zZXR0aW5nc1xuICAgIH07XG4gIH1cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBsZXQgY2h1bmtzID0gL0BcXHMqKHsuKn0pP1xccyooXFwkW17ihpHihpJdKik/XFxzKijihpEqKVxccyoo4oaSKT8oLiopLy5leGVjKHNlbGVjdG9yU3RyaW5nKTtcbiAgICBpZiAoIWNodW5rcyB8fCBjaHVua3NbNV0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgcGFyc2VkRG9jUXVlcnkgPSBjaHVua3NbMV0gPyBKU09OLnBhcnNlKGNodW5rc1sxXS50cmltKCkpIDogSlNPTi5wYXJzZShTZWxlY3Rpb24uREVGQVVMVF9ET0NfUVVFUlkpO1xuICAgIHJldHVybiB7XG4gICAgICBkb2NRdWVyeTogY2h1bmtzWzFdID8gY2h1bmtzWzFdLnRyaW0oKSA6IFNlbGVjdGlvbi5ERUZBVUxUX0RPQ19RVUVSWSxcbiAgICAgIHBhcnNlZERvY1F1ZXJ5LFxuICAgICAgb2JqUXVlcnk6IGNodW5rc1syXSA/IGNodW5rc1syXS50cmltKCkgOiAnJyxcbiAgICAgIHBhcmVudFNoaWZ0OiBjaHVua3NbM10gPyBjaHVua3NbM10ubGVuZ3RoIDogMCxcbiAgICAgIGZvbGxvd0xpbmtzOiAhIWNodW5rc1s0XVxuICAgIH07XG4gIH1cbiAgcGF0aFRvU2VsZWN0b3IgKHBhdGggPSBbU2VsZWN0aW9uLkRFRkFVTFRfRE9DX1FVRVJZXSkge1xuICAgIGxldCBkb2NRdWVyeSA9IHBhdGhbMF07XG4gICAgbGV0IG9ialF1ZXJ5ID0gcGF0aC5zbGljZSgxKTtcbiAgICBvYmpRdWVyeSA9IG9ialF1ZXJ5Lmxlbmd0aCA+IDAgPyBqc29uUGF0aC5zdHJpbmdpZnkob2JqUXVlcnkpIDogJyc7XG4gICAgcmV0dXJuICdAJyArIGRvY1F1ZXJ5ICsgb2JqUXVlcnk7XG4gIH1cbiAgaWRUb1VuaXF1ZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZywgZG9jSWQpIHtcbiAgICBjb25zdCBjaHVua3MgPSAvQFteJF0qKFxcJC4qKS8uZXhlYyhzZWxlY3RvclN0cmluZyk7XG4gICAgcmV0dXJuIGBAe1wiX2lkXCI6XCIke2RvY0lkfVwifSR7Y2h1bmtzWzFdfWA7XG4gIH1cbiAgZXh0cmFjdERvY1F1ZXJ5IChzZWxlY3RvclN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IC9AXFxzKih7Lip9KS8uZXhlYyhzZWxlY3RvclN0cmluZyk7XG4gICAgaWYgKHJlc3VsdCAmJiByZXN1bHRbMV0pIHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHJlc3VsdFsxXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICBleHRyYWN0Q2xhc3NJbmZvRnJvbUlkIChpZCkge1xuICAgIGNvbnN0IHRlbXAgPSAvQFteJF0qXFwkXFwuY2xhc3NlcyhcXC5bXlxcc+KGkeKGki5dKyk/KFxcW1wiW15cIl0rXCJdKT8vLmV4ZWMoaWQpO1xuICAgIGlmICh0ZW1wICYmICh0ZW1wWzFdIHx8IHRlbXBbMl0pKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjbGFzc1BhdGhDaHVuazogdGVtcFsxXSB8fCB0ZW1wWzJdLFxuICAgICAgICBjbGFzc05hbWU6IHRlbXBbMV0gPyB0ZW1wWzFdLnNsaWNlKDEpIDogdGVtcFsyXS5zbGljZSgyLCB0ZW1wWzJdLmxlbmd0aCAtIDIpXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbiAgaW5mZXJUeXBlICh2YWx1ZSwgYWdncmVzc2l2ZSA9IGZhbHNlKSB7XG4gICAgY29uc3QganNUeXBlID0gdHlwZW9mIHZhbHVlO1xuICAgIGlmICh0aGlzLkpTVFlQRVNbanNUeXBlXSkge1xuICAgICAgcmV0dXJuIHRoaXMuSlNUWVBFU1tqc1R5cGVdO1xuICAgIH0gZWxzZSBpZiAoanNUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gQXR0ZW1wdCB0byBwYXJzZSBhcyBhIHJlZmVyZW5jZVxuICAgICAgaWYgKHZhbHVlWzBdID09PSAnQCcgJiYgdGhpcy5wYXJzZVNlbGVjdG9yKHZhbHVlKSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5SZWZlcmVuY2VXcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gTm90IGEgcmVmZXJlbmNlLi4uXG4gICAgICBpZiAoYWdncmVzc2l2ZSkge1xuICAgICAgICAvLyBBZ2dyZXNzaXZlbHkgYXR0ZW1wdCB0byBpZGVudGlmeSBzb21ldGhpbmcgbW9yZSBzcGVjaWZpYyB0aGFuIHN0cmluZ1xuICAgICAgICBpZiAoIWlzTmFOKE51bWJlcih2YWx1ZSkpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcjtcbiAgICAgICAgLypcbiAgICAgICAgIEZvciBub3csIHdlIGRvbid0IGF0dGVtcHQgdG8gaWRlbnRpZnkgZGF0ZXMsIGV2ZW4gaW4gYWdncmVzc2l2ZSBtb2RlLFxuICAgICAgICAgYmVjYXVzZSB0aGluZ3MgbGlrZSBuZXcgRGF0ZSgnUGxheWVyIDEnKSB3aWxsIHN1Y2Nlc3NmdWxseSBwYXJzZSBhcyBhXG4gICAgICAgICBkYXRlLiBJZiB3ZSBjYW4gZmluZCBzbWFydGVyIHdheXMgdG8gYXV0by1pbmZlciBkYXRlcyAoZS5nLiBkb2VzIHRoZVxuICAgICAgICAgdmFsdWUgZmFsbCBzdXNwaWNpb3VzbHkgbmVhciB0aGUgdW5peCBlcG9jaCwgeTJrLCBvciBtb3JlIHRoYW4gKy8tNTAwXG4gICAgICAgICB5ZWFycyBmcm9tIG5vdz8gRG8gc2libGluZyBjb250YWluZXIgaXRlbXMgcGFyc2UgdGhpcyBhcyBhIGRhdGU/KSwgdGhlblxuICAgICAgICAgbWF5YmUgd2UnbGwgYWRkIHRoaXMgYmFjay4uLlxuICAgICAgICAqL1xuICAgICAgICAvLyB9IGVsc2UgaWYgKCFpc05hTihuZXcgRGF0ZSh2YWx1ZSkpKSB7XG4gICAgICAgIC8vICByZXR1cm4gV1JBUFBFUlMuRGF0ZVdyYXBwZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IHZhbHVlLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgaWYgKHRlbXAgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuQm9vbGVhbldyYXBwZXI7XG4gICAgICAgICAgfSBlbHNlIGlmICh0ZW1wID09PSAnZmFsc2UnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcjtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRlbXAgPT09ICdudWxsJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuTnVsbFdyYXBwZXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBpdCdzIGp1c3QgYSBzdHJpbmdcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLlN0cmluZ1dyYXBwZXI7XG4gICAgfSBlbHNlIGlmIChqc1R5cGUgPT09ICdmdW5jdGlvbicgfHwganNUeXBlID09PSAnc3ltYm9sJyB8fCBqc1R5cGUgPT09ICd1bmRlZmluZWQnIHx8IHZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkludmFsaWRXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLk51bGxXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlIHx8IHZhbHVlLiRpc0RhdGUgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkRhdGVXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuJG5vZGVzKSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKHZhbHVlLiRlZGdlcykge1xuICAgICAgaWYgKHZhbHVlLiRtZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHZhbHVlLiRtZW1iZXJzKSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5TZXRXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuJHRhZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyO1xuICAgIH1cbiAgfVxuICBhc3luYyBmb2xsb3dSZWxhdGl2ZUxpbmsgKHNlbGVjdG9yLCBkb2MpIHtcbiAgICAvLyBUaGlzIHNlbGVjdG9yIHNwZWNpZmllcyB0byBmb2xsb3cgdGhlIGxpbmtcbiAgICBpZiAodHlwZW9mIHNlbGVjdG9yICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBsZXQgZG9jUXVlcnkgPSB0aGlzLmV4dHJhY3REb2NRdWVyeShzZWxlY3Rvcik7XG4gICAgbGV0IGNyb3NzRG9jO1xuICAgIGlmICghZG9jUXVlcnkpIHtcbiAgICAgIHNlbGVjdG9yID0gYEB7XCJfaWRcIjpcIiR7ZG9jLl9pZH1cIn0ke3NlbGVjdG9yLnNsaWNlKDEpfWA7XG4gICAgICBjcm9zc0RvYyA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc0RvYyA9IGRvY1F1ZXJ5Ll9pZCAhPT0gZG9jLl9pZDtcbiAgICB9XG4gICAgbGV0IHRlbXBTZWxlY3Rpb247XG4gICAgdHJ5IHtcbiAgICAgIHRlbXBTZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKHRoaXMsIHNlbGVjdG9yKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIuSU5WQUxJRF9TRUxFQ1RPUikge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBkb2NMaXN0cyA9IGNyb3NzRG9jID8gYXdhaXQgdGVtcFNlbGVjdGlvbi5kb2NMaXN0cygpIDogW1sgZG9jIF1dO1xuICAgIHJldHVybiB0ZW1wU2VsZWN0aW9uLml0ZW1zKGRvY0xpc3RzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBEM05vZGUgZnJvbSAnZDMtbm9kZSc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5sZXQgZDNuID0gbmV3IEQzTm9kZSgpO1xuLy8gQXR0YWNoIGEgZmV3IGV4dHJhIHNoaW1zIGZvciB0ZXN0aW5nXG5kM24ud2luZG93LmxvY2FsU3RvcmFnZSA9IHsgZ2V0SXRlbTogKCkgPT4gbnVsbCB9O1xuXG5sZXQgUG91Y2hEQiA9IHJlcXVpcmUoJ3BvdWNoZGItbm9kZScpXG4gIC5wbHVnaW4ocmVxdWlyZSgncG91Y2hkYi1maW5kJykpXG4gIC5wbHVnaW4ocmVxdWlyZSgncG91Y2hkYi1hdXRoZW50aWNhdGlvbicpKTtcblxubGV0IG11cmUgPSBuZXcgTXVyZShQb3VjaERCLCBkM24uZDMsIGQzbik7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJERUZBVUxUX0RPQ19RVUVSWSIsIlNlbGVjdGlvbiIsIm11cmUiLCJzZWxlY3Rvckxpc3QiLCJBcnJheSIsInNlbGVjdG9ycyIsIm1hcCIsInNlbGVjdG9yU3RyaW5nIiwic2VsZWN0b3IiLCJwYXJzZVNlbGVjdG9yIiwiZXJyIiwiRXJyb3IiLCJJTlZBTElEX1NFTEVDVE9SIiwiaGFzaCIsIl9oYXNoIiwibWQ1IiwiSlNPTiIsInN0cmluZ2lmeSIsImRvY1F1ZXJ5Iiwib2JqUXVlcnkiLCJmcm9tIiwicGFyZW50U2hpZnQiLCJkIiwiam9pbiIsImZvbGxvd0xpbmtzIiwiaXNDYWNoZWQiLCJfY2FjaGVkV3JhcHBlcnMiLCJfY2FjaGVkRG9jTGlzdHMiLCJfc3VtbWFyeUNhY2hlcyIsImRvY0xpc3RzIiwiUHJvbWlzZSIsImFsbCIsInF1ZXJ5RG9jcyIsInBhcnNlZERvY1F1ZXJ5IiwiaSIsImxlbmd0aCIsImoiLCJkb2MiLCJDQUNIRURfRE9DUyIsIl9pZCIsInNlbGVjdGlvbnMiLCJpbmRleE9mIiwicHVzaCIsIl9yZXYiLCJjYWNoZWREb2MiLCJpdGVtcyIsInF1ZXVlQXN5bmMiLCJhZGRXcmFwcGVyIiwiaXRlbSIsInVuaXF1ZVNlbGVjdG9yIiwiaW5kZXgiLCJkb2NMaXN0IiwiV1JBUFBFUlMiLCJSb290V3JhcHBlciIsImZvckVhY2giLCJEb2N1bWVudFdyYXBwZXIiLCJkb2NJbmRleCIsIm1hdGNoaW5nV3JhcHBlcnMiLCJqc29uUGF0aCIsIm5vZGVzIiwiaXRlbUluZGV4IiwicGF0aCIsInZhbHVlIiwibG9jYWxQYXRoIiwiUkVTRVJWRURfT0JKX0tFWVMiLCJzbGljZSIsInNwbGljZSIsInF1ZXJ5IiwidmFsdWVzIiwiZm9sbG93UmVsYXRpdmVMaW5rIiwiV3JhcHBlclR5cGUiLCJpbmZlclR5cGUiLCJjb25jYXQiLCJleGVjdXRlIiwib3BlcmF0aW9uIiwiaW5wdXRPcHRpb25zIiwib3V0cHV0U3BlYyIsImV4ZWN1dGVPblNlbGVjdGlvbiIsInBvbGx1dGVkRG9jcyIsIk9iamVjdCIsInNraXBTYXZlIiwia2V5cyIsIndhcm5pbmdzIiwid2FybmluZ1N0cmluZyIsImlnbm9yZUVycm9ycyIsImh1bWFuUmVhZGFibGVUeXBlIiwiZW50cmllcyIsIndhcm5pbmciLCJjb3VudCIsIndhcm4iLCJzYXZlU3VjY2Vzc2Z1bCIsInNhdmVSZXN1bHQiLCJwdXREb2NzIiwiZXJyb3IiLCJtZXNzYWdlIiwiSU5WQUxJREFURV9ET0NfQ0FDSEUiLCJuZXdTZWxlY3RvcnMiLCJzdWJTZWxlY3QiLCJhcHBlbmQiLCJtb2RlIiwic2VsZWN0QWxsIiwiY29udGV4dCIsIm1lcmdlU2VsZWN0aW9uIiwib3RoZXJTZWxlY3Rpb24iLCJnZXRQb3B1bGF0ZWRJbnB1dFNwZWMiLCJpbnB1dFNwZWNzIiwidHlwZSIsImlucHV0U3BlYyIsImdldElucHV0U3BlYyIsInBvcHVsYXRlQ2hvaWNlc0Zyb21TZWxlY3Rpb24iLCJoaXN0b2dyYW1zIiwibnVtQmlucyIsIml0ZW1MaXN0IiwicmVzdWx0IiwiY291bnRQcmltaXRpdmUiLCJjb3VudGVycyIsImNhdGVnb3JpY2FsQmlucyIsInF1YW50aXRhdGl2ZUJpbnMiLCJxdWFudGl0YXRpdmVXcmFwcGVycyIsInF1YW50aXRhdGl2ZVR5cGUiLCJOdW1iZXJXcmFwcGVyIiwicXVhbnRpdGF0aXZlU2NhbGUiLCJkMyIsInNjYWxlTGluZWFyIiwiZG9tYWluIiwiRGF0ZVdyYXBwZXIiLCJzY2FsZVRpbWUiLCJyYXciLCJ0eXBlQmlucyIsIlByaW1pdGl2ZVdyYXBwZXIiLCJnZXRDb250ZW50cyIsImNoaWxkV3JhcHBlciIsImF0dHJpYnV0ZXMiLCJsYWJlbCIsImZpbmFsaXplQmlucyIsIm5pY2UiLCJoaXN0b2dyYW1HZW5lcmF0b3IiLCJoaXN0b2dyYW0iLCJ0aHJlc2hvbGRzIiwidGlja3MiLCJnZXRGbGF0R3JhcGhTY2hlbWEiLCJmbGF0R3JhcGhTY2hlbWEiLCJFZGdlV3JhcHBlciIsImNsYXNzTGlzdCIsImdldENsYXNzZXMiLCJlZGdlQ2xhc3NOYW1lIiwicHNldWRvRWRnZSIsImVkZ2VDbGFzc2VzIiwiJG5vZGVzIiwibm9kZVNlbGVjdG9yIiwiZGlyZWN0aW9ucyIsIm5vZGVXcmFwcGVyIiwibWlzc2luZ05vZGVzIiwibm9kZUNsYXNzTmFtZSIsImRpcmVjdGlvbiIsIk5vZGVXcmFwcGVyIiwicHNldWRvTm9kZSIsIm5vZGVDbGFzc2VzIiwiJGVkZ2VzIiwiZWRnZVNlbGVjdG9yIiwiZWRnZVdyYXBwZXIiLCJtaXNzaW5nRWRnZXMiLCJnZXRJbnRlcnNlY3RlZEdyYXBoU2NoZW1hIiwiYWxsTWV0YU9iakludGVyc2VjdGlvbnMiLCJtZXRhT2JqcyIsImxpbmtlZElkcyIsIm1ldGFPYmoiLCJsaW5rZWRJZCIsImlkVG9VbmlxdWVTZWxlY3RvciIsInNldHMiLCJzZXRMb29rdXAiLCJpdGVtSWRzIiwic29ydCIsInNldEtleSIsInVuZGVmaW5lZCIsImRvY0lkIiwic2VsZWN0aW9uIiwiaW52YWxpZGF0ZUNhY2hlIiwiSU5WQUxJREFURV9BTExfQ0FDSEVTIiwiSW50cm9zcGVjdGFibGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImRlZmluZVByb3BlcnR5IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VXcmFwcGVyIiwicGFyZW50IiwiX3ZhbHVlIiwibmV3VmFsdWUiLCJvdGhlciIsImV4ZWMiLCJuYW1lIiwiZ2V0Qm9pbGVycGxhdGVWYWx1ZSIsInN0YW5kYXJkaXplIiwiaXNCYWRWYWx1ZSIsIlR5cGVkV3JhcHBlciIsImRvY1BhdGhRdWVyeSIsInVuaXF1ZUpzb25QYXRoIiwiVHlwZUVycm9yIiwiSlNUWVBFIiwicGFyZW50V3JhcHBlciIsIlBhcmVudFR5cGUiLCJzdXBlcmNsYXNzIiwiYXR0cmlidXRlIiwidGFyZ2V0IiwiX2NvbnRlbnRXcmFwcGVyIiwiZmlsdGVyIiwiQ29udGFpbmVyV3JhcHBlciIsIkNvbnRhaW5lcldyYXBwZXJNaXhpbiIsIm5leHRMYWJlbCIsInJlZHVjZSIsIm1heCIsImtleSIsInBhcnNlSW50IiwiaXNOYU4iLCJTdHJpbmciLCJjb252ZXJ0QXJyYXkiLCJlbGVtZW50IiwiJHdhc0FycmF5IiwiYWdncmVzc2l2ZSIsIm5lc3RlZFZhbHVlIiwiREFUQUxJQl9GT1JNQVRTIiwiY29udGVudHMiLCJpc1ZhbGlkSWQiLCJ0b0xvd2VyQ2FzZSIsInBhcnRzIiwic3BsaXQiLCJtaW1lIiwiZXh0ZW5zaW9uIiwicGFyc2UiLCJ0ZXh0IiwiZGF0YWxpYiIsInJlYWQiLCJsYXVuY2hTdGFuZGFyZGl6YXRpb24iLCJleGlzdGluZ1VudGl0bGVkcyIsImRiIiwiYWxsRG9jcyIsIm1pbWVUeXBlIiwicm93cyIsImZpbGVuYW1lIiwibWluSW5kZXgiLCJ1RG9jIiwiSW5maW5pdHkiLCJpc0Zpbml0ZSIsImxvb2t1cCIsImNoYXJzZXQiLCJ0b1VwcGVyQ2FzZSIsIm9ycGhhbnMiLCJjbGFzc2VzIiwiSW52YWxpZFdyYXBwZXIiLCJOdWxsV3JhcHBlciIsIkJvb2xlYW5XcmFwcGVyIiwiTnVtYmVyIiwiU3RyaW5nV3JhcHBlciIsIkRhdGUiLCJzdHIiLCJ0b1N0cmluZyIsIiRpc0RhdGUiLCJSZWZlcmVuY2VXcmFwcGVyIiwiR2VuZXJpY1dyYXBwZXIiLCIkdGFncyIsImNsYXNzTmFtZSIsIlNldFdyYXBwZXIiLCJjbGFzc0l0ZW0iLCJhZ2ciLCJzZXRJZCIsImV4dHJhY3RDbGFzc0luZm9Gcm9tSWQiLCJjbGFzc1BhdGhDaHVuayIsIiRtZW1iZXJzIiwiaXRlbVRhZyIsInNldFRhZyIsImdldE1lbWJlcnMiLCJnZXRNZW1iZXJTZWxlY3RvcnMiLCJTZXRXcmFwcGVyTWl4aW4iLCJub2RlIiwibm9kZUlkIiwibm9kZVNlbGVjdG9ycyIsIm5vZGVXcmFwcGVycyIsImZvcndhcmQiLCJub2RlV3JhcHBlckNvdW50Iiwib3Bwb3NpdGVEaXJlY3Rpb24iLCJnbG9tcFZhbHVlIiwiZWRnZUxpc3QiLCJnbG9tcCIsIm90aGVyTm9kZSIsImNvbnRhaW5lciIsIm5ld0VkZ2UiLCJjcmVhdGVOZXdXcmFwcGVyIiwiYXR0YWNoVG8iLCJlZGdlU2VsZWN0b3JzIiwiZWRnZVdyYXBwZXJzIiwiJGVnZGVzIiwiZWRnZVdyYXBwZXJDb3VudCIsIlN1cGVybm9kZVdyYXBwZXIiLCJJbnB1dFNwZWMiLCJvcHRpb25zIiwib3B0aW9uIiwicGFyYW1ldGVyTmFtZSIsInVwZGF0ZUNob2ljZXMiLCJwYXJhbXMiLCJzcGVjcyIsInNwZWMiLCJJbnB1dE9wdGlvbiIsIl9kZWZhdWx0VmFsdWUiLCJkZWZhdWx0VmFsdWUiLCJjaG9pY2VzIiwib3BlbkVuZGVkIiwiaHVtYW5SZWFkYWJsZVBhcmFtZXRlck5hbWUiLCJ0b0xvY2FsZVVwcGVyQ2FzZSIsIk91dHB1dFNwZWMiLCJzcGVjTGlzdCIsIkJhc2VPcGVyYXRpb24iLCJhZGRPcHRpb24iLCJjYW5FeGVjdXRlT25JbnN0YW5jZSIsImV4ZWN1dGVPbkluc3RhbmNlIiwiaXRlbXNJblVzZSIsImFyZ3VtZW50IiwicG90ZW50aWFsbHlFeGVjdXRhYmxlT25TZWxlY3Rpb24iLCJzb21lIiwicG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIiwiY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIiwiZ2V0SXRlbXNJblVzZSIsImNhbkV4ZWN1dGVJbnN0YW5jZXMiLCJldmVyeSIsImNhbkV4ZWN1dGUiLCJvdXRwdXRTcGVjUHJvbWlzZXMiLCJDb250ZXh0dWFsT3B0aW9uIiwiaGlkZGVuQ2hvaWNlcyIsImNob2ljZSIsIlNlbGVjdEFsbE9wZXJhdGlvbiIsIm91dHB1dCIsImFkZFNlbGVjdG9ycyIsImVkZ2UiLCJuZXdTdHJpbmciLCJuZXdTZWxlY3RvciIsIm90aGVyU2VsZWN0b3JMaXN0IiwiU3RyaW5nT3B0aW9uIiwiY2hvaWNlRGljdCIsIkNsYXNzT3B0aW9uIiwicmVzZXQiLCJwb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyIsIkRFRkFVTFRfRklMVEVSX0ZVTkMiLCJGaWx0ZXJPcGVyYXRpb24iLCJmaWx0ZXJGdW5jdGlvbiIsImNvbm5lY3RXaGVuIiwiU3ludGF4RXJyb3IiLCJGdW5jdGlvbiIsIkJhc2VDb252ZXJzaW9uIiwiVGFyZ2V0VHlwZSIsInN0YW5kYXJkVHlwZXMiLCJzcGVjaWFsVHlwZXMiLCJUeXBlIiwic3RhbmRhcmRDb252ZXJzaW9uIiwic3BlY2lhbENvbnZlcnNpb24iLCJOdWxsQ29udmVyc2lvbiIsIkJvb2xlYW5Db252ZXJzaW9uIiwiTnVtYmVyQ29udmVyc2lvbiIsIlN0cmluZ0NvbnZlcnNpb24iLCJHZW5lcmljQ29udmVyc2lvbiIsIk5vZGVDb252ZXJzaW9uIiwiRWRnZUNvbnZlcnNpb24iLCJDb252ZXJ0T3BlcmF0aW9uIiwiY29udmVyc2lvbkxpc3QiLCJDT05WRVJTSU9OUyIsImNvbnZlcnNpb24iLCJhZGRPcHRpb25zVG9TcGVjIiwiY29udmVydEl0ZW0iLCJmbGFnUG9sbHV0ZWREb2MiLCJUeXBlZE9wdGlvbiIsInZhbGlkVHlwZXMiLCJzdWdnZXN0T3JwaGFucyIsIml0ZW1Mb29rdXAiLCJvcnBoYW5Mb29rdXAiLCJBdHRyaWJ1dGVPcHRpb24iLCJwb3B1bGF0ZUZyb21JdGVtIiwiZ2V0QXR0cmlidXRlcyIsImF0dHIiLCJwb3B1bGF0ZUZyb21JdGVtcyIsInVuc2hpZnQiLCJOZXN0ZWRBdHRyaWJ1dGVPcHRpb24iLCJnZXRJdGVtQ2hvaWNlUm9sZSIsIml0ZW1Sb2xlIiwiY2hpbGRyZW4iLCJERUZBVUxUX0NPTk5FQ1RfV0hFTiIsIkNvbm5lY3RPcGVyYXRpb24iLCJ0YXJnZXRzIiwiZXF1YWxzIiwic2F2ZUVkZ2VzSW4iLCJzb3VyY2VzIiwidGFyZ2V0SXRlbXMiLCJhdExlYXN0VHdvTm9kZXMiLCJzb3VyY2VBdHRyaWJ1dGUiLCJ0YXJnZXRBdHRyaWJ1dGUiLCJleGVjdXRlV2l0aGluU2VsZWN0aW9uIiwic291cmNlTGlzdCIsImNvbm5lY3RUbyIsImdldFNvdXJjZVZhbHVlIiwic291cmNlIiwiZ2V0VGFyZ2V0VmFsdWUiLCJkaXJlY3RlZCIsInRhcmdldExpc3QiLCJBdHRhY2hPcGVyYXRpb24iLCJlZGdlcyIsImVkZ2VJdGVtcyIsIm5vZGVJdGVtcyIsIm9uZU5vZGUiLCJvbmVFZGdlIiwiZWRnZUF0dHJpYnV0ZSIsIm5vZGVBdHRyaWJ1dGUiLCJnZXRFZGdlVmFsdWUiLCJnZXROb2RlVmFsdWUiLCJub2RlTGlzdCIsIkFzc2lnbkNsYXNzT3BlcmF0aW9uIiwiZ2V0VmFsdWUiLCJhZGRDbGFzcyIsIk11cmUiLCJNb2RlbCIsIlBvdWNoREIiLCJkM24iLCJ3aW5kb3ciLCJOU1N0cmluZyIsIm5hbWVzcGFjZXMiLCJERVJJVkVfTU9ERVMiLCJKU1RZUEVTIiwib3BlcmF0aW9uQ2xhc3NlcyIsIk9QRVJBVElPTlMiLCJPcGVyYXRpb24iLCJwcm90b3R5cGUiLCJnZXRPckluaXREYiIsImFsZXJ0IiwicmVzb2x2ZSIsInJlamVjdCIsImNvbmZpcm0iLCJwcm9tcHQiLCJhcmd1bWVudHMiLCJsb2ciLCJzaG93RGlhbG9nRnVuY3Rpb24iLCJkYlN0YXR1cyIsInN0YXR1cyIsInN5bmNlZCIsImNvdWNoRGJVcmwiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiY291Y2hEYiIsInNraXBfc2V0dXAiLCJzeW5jIiwibGl2ZSIsInJldHJ5IiwiY2F0Y2giLCJpbmRleGVkIiwiY3JlYXRlSW5kZXgiLCJsaW5rZWRVc2VyU2VsZWN0aW9uIiwicHV0IiwibGlua2VkVmlld1NldHRpbmdzIiwiY2hhbmdlcyIsImluZm8iLCJ1cGRhdGVfc2VxIiwib24iLCJjaGFuZ2UiLCJpZCIsInNlYXJjaCIsInRyaWdnZXIiLCJzdGlja3lUcmlnZ2VyIiwic2V0dGluZ3MiLCJhc3NpZ24iLCJyZXN1bHRzIiwicm93IiwiYWxsRG9jV3JhcHBlcnMiLCJxdWVyeU9iaiIsInF1ZXJ5UmVzdWx0IiwiZmluZCIsImRvY3MiLCJnZXREb2MiLCJpbml0IiwibWF0Y2hpbmdEb2NzIiwibGltaXQiLCJwdXREb2MiLCJwcmV2aW91c0RvY3MiLCJidWxrRG9jcyIsIm5ld1JldnMiLCJlcnJvck1lc3NhZ2VzIiwiZXJyb3JTZWVuIiwicmVzdWx0T2JqIiwicmV2IiwicmV2ZXJ0ZWREb2NzIiwiaWRzIiwiZG93bmxvYWREb2MiLCJ0aGVuIiwiZm9ybWF0RG9jIiwiYSIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwidXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiQmxvYiIsImhyZWYiLCJkb3dubG9hZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmV2b2tlT2JqZWN0VVJMIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwidXBsb2FkRmlsZU9iaiIsImZpbGVPYmoiLCJlbmNvZGluZyIsInN0cmluZyIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwidXBsb2FkU3RyaW5nIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJ1cGxvYWREb2MiLCJvayIsImRlbGV0ZURvYyIsInNldExpbmtlZFZpZXdzIiwidXNlclNlbGVjdGlvbiIsImdldCIsImdldExpbmtlZFZpZXdzIiwiY2h1bmtzIiwidHJpbSIsImpzVHlwZSIsImV4dHJhY3REb2NRdWVyeSIsImNyb3NzRG9jIiwidGVtcFNlbGVjdGlvbiIsIkQzTm9kZSIsInJlcXVpcmUiLCJwbHVnaW4iLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUlBLE1BQU1BLG9CQUFvQiwyQkFBMUI7O0FBRUEsTUFBTUMsU0FBTixDQUFnQjtjQUNEQyxJQUFiLEVBQW1CQyxlQUFlLENBQUMsTUFBTUgsaUJBQVAsQ0FBbEMsRUFBNkQ7UUFDdkQs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
