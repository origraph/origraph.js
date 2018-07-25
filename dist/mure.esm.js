import jsonPath from 'jsonpath';
import { queueAsync, Model } from 'uki';
import md5 from 'blueimp-md5';
import mime from 'mime-types';
import datalib from 'datalib';
import * as d3 from 'd3';
import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';
import PouchAuthentication from 'pouchdb-authentication';

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

    return queueAsync(async () => {
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

class Mure extends Model {
  constructor(PouchDB$$1, d3$$1, d3n) {
    super();
    this.PouchDB = PouchDB$$1; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3$$1; // for Node.js, this will be from d3-node, not the regular one
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
  async uploadFileObj(fileObj, { encoding = mime.charset(fileObj.type), extensionOverride = null } = {}) {
    let string = await new Promise((resolve, reject) => {
      let reader = new window.FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsText(fileObj, encoding);
    });
    return this.uploadString(fileObj.name, fileObj.type, encoding, string, extensionOverride);
  }
  async uploadString(filename, mimeType, encoding, string, extensionOverride = null) {
    const extension = extensionOverride || mime.extension(mimeType || mime.lookup(filename)) || 'txt';
    // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly
    let doc = await this.WRAPPERS.DocumentWrapper.parse(string, extension);
    return this.uploadDoc(filename, mimeType, encoding, doc);
  }
  async uploadDoc(filename, mimeType, encoding, doc) {
    doc.filename = filename || doc.filename;
    doc.mimeType = mimeType || doc.mimeType || mime.lookup(filename);
    doc.charset = encoding || doc.charset || mime.charset(doc.mimeType);
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
	debug: "rm -rf mure mure-mrview* && node --inspect-brk node_modules/.bin/jest --runInBand -t",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
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
	coveralls: "^3.0.2",
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

PouchDB.plugin(PouchAuthentication);
PouchDB.plugin(PouchFind);

let mure = new Mure(PouchDB, d3);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TZWxlY3Rpb24uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0Jhc2VXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1Jvb3RXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1R5cGVkV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Db250YWluZXJXcmFwcGVyTWl4aW4uanMiLCIuLi9zcmMvV3JhcHBlcnMvQ29udGFpbmVyV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Eb2N1bWVudFdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvUHJpbWl0aXZlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9JbnZhbGlkV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9OdWxsV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Cb29sZWFuV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9OdW1iZXJXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1N0cmluZ1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRGF0ZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvUmVmZXJlbmNlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9TZXRXcmFwcGVyTWl4aW4uanMiLCIuLi9zcmMvV3JhcHBlcnMvU2V0V3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9TdXBlcm5vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL0lucHV0U3BlYy5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9JbnB1dE9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9PdXRwdXRTcGVjLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL1NlbGVjdEFsbE9wZXJhdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9TdHJpbmdPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQ2xhc3NPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9GaWx0ZXJPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9CYXNlQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnNpb25zL051bGxDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvQm9vbGVhbkNvbnZlcnNpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9OdW1iZXJDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvU3RyaW5nQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnNpb25zL0dlbmVyaWNDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvTm9kZUNvbnZlcnNpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9FZGdlQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnRPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vVHlwZWRPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQXR0cmlidXRlT3B0aW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL05lc3RlZEF0dHJpYnV0ZU9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0Nvbm5lY3RPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9BdHRhY2hPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Bc3NpZ25DbGFzc09wZXJhdGlvbi5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQganNvblBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IHsgcXVldWVBc3luYyB9IGZyb20gJ3VraSc7XG5pbXBvcnQgbWQ1IGZyb20gJ2JsdWVpbXAtbWQ1JztcblxuY29uc3QgREVGQVVMVF9ET0NfUVVFUlkgPSAne1wiX2lkXCI6e1wiJGd0XCI6XCJfXFx1ZmZmZlwifX0nO1xuXG5jbGFzcyBTZWxlY3Rpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSwgc2VsZWN0b3JMaXN0ID0gWydAJyArIERFRkFVTFRfRE9DX1FVRVJZXSkge1xuICAgIGlmICghKHNlbGVjdG9yTGlzdCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgc2VsZWN0b3JMaXN0ID0gWyBzZWxlY3Rvckxpc3QgXTtcbiAgICB9XG4gICAgdGhpcy5zZWxlY3RvcnMgPSBzZWxlY3Rvckxpc3QubWFwKHNlbGVjdG9yU3RyaW5nID0+IHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gbXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yU3RyaW5nKTtcbiAgICAgIGlmIChzZWxlY3RvciA9PT0gbnVsbCkge1xuICAgICAgICBsZXQgZXJyID0gbmV3IEVycm9yKCdJbnZhbGlkIHNlbGVjdG9yOiAnICsgc2VsZWN0b3JTdHJpbmcpO1xuICAgICAgICBlcnIuSU5WQUxJRF9TRUxFQ1RPUiA9IHRydWU7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICB9KTtcblxuICAgIC8vIFRPRE86IG9wdGltaXplIGFuZCBzb3J0IHRoaXMuc2VsZWN0b3JzIGZvciBiZXR0ZXIgaGFzaCBlcXVpdmFsZW5jZVxuXG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgfVxuICBnZXQgaGFzaCAoKSB7XG4gICAgaWYgKCF0aGlzLl9oYXNoKSB7XG4gICAgICB0aGlzLl9oYXNoID0gbWQ1KEpTT04uc3RyaW5naWZ5KHRoaXMuc2VsZWN0b3JMaXN0KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9oYXNoO1xuICB9XG4gIGdldCBzZWxlY3Rvckxpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdG9ycy5tYXAoc2VsZWN0b3IgPT4ge1xuICAgICAgcmV0dXJuICdAJyArIHNlbGVjdG9yLmRvY1F1ZXJ5ICsgc2VsZWN0b3Iub2JqUXVlcnkgK1xuICAgICAgICBBcnJheS5mcm9tKEFycmF5KHNlbGVjdG9yLnBhcmVudFNoaWZ0KSkubWFwKGQgPT4gJ+KGkScpLmpvaW4oJycpICtcbiAgICAgICAgKHNlbGVjdG9yLmZvbGxvd0xpbmtzID8gJ+KGkicgOiAnJyk7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGlzQ2FjaGVkICgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9jYWNoZWRXcmFwcGVycztcbiAgfVxuICBpbnZhbGlkYXRlQ2FjaGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWREb2NMaXN0cztcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkV3JhcHBlcnM7XG4gICAgZGVsZXRlIHRoaXMuX3N1bW1hcnlDYWNoZXM7XG4gIH1cbiAgYXN5bmMgZG9jTGlzdHMgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWREb2NMaXN0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZERvY0xpc3RzO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZWREb2NMaXN0cyA9IGF3YWl0IFByb21pc2UuYWxsKHRoaXMuc2VsZWN0b3JzXG4gICAgICAubWFwKGQgPT4gdGhpcy5tdXJlLnF1ZXJ5RG9jcyh7IHNlbGVjdG9yOiBkLnBhcnNlZERvY1F1ZXJ5IH0pKSk7XG4gICAgLy8gV2Ugd2FudCBhbGwgc2VsZWN0aW9ucyB0byBvcGVyYXRlIGZyb20gZXhhY3RseSB0aGUgc2FtZSBkb2N1bWVudCBvYmplY3QsXG4gICAgLy8gc28gaXQncyBlYXN5IC8gc3RyYWlnaHRmb3J3YXJkIGZvciBXcmFwcGVycyB0byBqdXN0IG11dGF0ZSB0aGVpciBvd24gdmFsdWVcbiAgICAvLyByZWZlcmVuY2VzLCBhbmQgaGF2ZSB0aG9zZSBjaGFuZ2VzIGF1dG9tYXRpY2FsbHkgYXBwZWFyIGluIGRvY3VtZW50c1xuICAgIC8vIHdoZW4gdGhleSdyZSBzYXZlZC4uLiBzbyB3ZSBhY3R1YWxseSB3YW50IHRvICpzd2FwIG91dCogbWF0Y2hpbmcgZG9jdW1lbnRzXG4gICAgLy8gZm9yIHRoZWlyIGNhY2hlZCB2ZXJzaW9uc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2FjaGVkRG9jTGlzdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fY2FjaGVkRG9jTGlzdHNbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgY29uc3QgZG9jID0gdGhpcy5fY2FjaGVkRG9jTGlzdHNbaV1bal07XG4gICAgICAgIGlmIChTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jLl9pZF0pIHtcbiAgICAgICAgICBpZiAoU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdLnNlbGVjdGlvbnMuaW5kZXhPZih0aGlzKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIC8vIFJlZ2lzdGVyIGFzIGEgc2VsZWN0aW9uIHRoYXQncyB1c2luZyB0aGlzIGNhY2hlLCBzbyB3ZSdyZVxuICAgICAgICAgICAgLy8gbm90aWZpZWQgaW4gdGhlIGV2ZW50IHRoYXQgaXQgZ2V0cyBpbnZhbGlkYXRlZFxuICAgICAgICAgICAgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdLnNlbGVjdGlvbnMucHVzaCh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gVmVyaWZ5IHRoYXQgdGhlIGRvYyBoYXMgbm90IGNoYW5nZWQgKHdlIHdhdGNoIGZvciBjaGFuZ2VzIGFuZFxuICAgICAgICAgIC8vIGludmFsaWRhdGUgY2FjaGVzIGluIG11cmUuZ2V0T3JJbml0RGIsIHNvIHRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbilcbiAgICAgICAgICBpZiAoZG9jLl9yZXYgIT09IFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2MuX2lkXS5jYWNoZWREb2MuX3Jldikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWNoZWQgZG9jdW1lbnQgX3JldiBjaGFuZ2VkIHdpdGhvdXQgbm90aWZpY2F0aW9uJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFN3YXAgZm9yIHRoZSBjYWNoZWQgdmVyc2lvblxuICAgICAgICAgIHRoaXMuX2NhY2hlZERvY0xpc3RzW2ldW2pdID0gU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdLmNhY2hlZERvYztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBXZSdyZSB0aGUgZmlyc3Qgb25lIHRvIGNhY2hlIHRoaXMgZG9jdW1lbnQsIHNvIHVzZSBvdXJzXG4gICAgICAgICAgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdID0ge1xuICAgICAgICAgICAgc2VsZWN0aW9uczogW3RoaXNdLFxuICAgICAgICAgICAgY2FjaGVkRG9jOiBkb2NcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZWREb2NMaXN0cztcbiAgfVxuICBhc3luYyBpdGVtcyAoZG9jTGlzdHMpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkV3JhcHBlcnMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRXcmFwcGVycztcbiAgICB9XG5cbiAgICAvLyBOb3RlOiB3ZSBzaG91bGQgb25seSBwYXNzIGluIGRvY0xpc3RzIGluIHJhcmUgc2l0dWF0aW9ucyAoc3VjaCBhcyB0aGVcbiAgICAvLyBvbmUtb2ZmIGNhc2UgaW4gZm9sbG93UmVsYXRpdmVMaW5rKCkgd2hlcmUgd2UgYWxyZWFkeSBoYXZlIHRoZSBkb2N1bWVudFxuICAgIC8vIGF2YWlsYWJsZSwgYW5kIGNyZWF0aW5nIHRoZSBuZXcgc2VsZWN0aW9uIHdpbGwgcmVzdWx0IGluIGFuIHVubm5lY2Vzc2FyeVxuICAgIC8vIHF1ZXJ5IG9mIHRoZSBkYXRhYmFzZSkuIFVzdWFsbHksIHdlIHNob3VsZCByZWx5IG9uIHRoZSBjYWNoZS5cbiAgICBkb2NMaXN0cyA9IGRvY0xpc3RzIHx8IGF3YWl0IHRoaXMuZG9jTGlzdHMoKTtcblxuICAgIHJldHVybiBxdWV1ZUFzeW5jKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIENvbGxlY3QgdGhlIHJlc3VsdHMgb2Ygb2JqUXVlcnlcbiAgICAgIHRoaXMuX2NhY2hlZFdyYXBwZXJzID0ge307XG4gICAgICBjb25zdCBhZGRXcmFwcGVyID0gaXRlbSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5fY2FjaGVkV3JhcHBlcnNbaXRlbS51bmlxdWVTZWxlY3Rvcl0pIHtcbiAgICAgICAgICB0aGlzLl9jYWNoZWRXcmFwcGVyc1tpdGVtLnVuaXF1ZVNlbGVjdG9yXSA9IGl0ZW07XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLnNlbGVjdG9ycy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yc1tpbmRleF07XG4gICAgICAgIGNvbnN0IGRvY0xpc3QgPSBkb2NMaXN0c1tpbmRleF07XG5cbiAgICAgICAgaWYgKHNlbGVjdG9yLm9ialF1ZXJ5ID09PSAnJykge1xuICAgICAgICAgIC8vIE5vIG9ialF1ZXJ5IG1lYW5zIHRoYXQgd2Ugd2FudCBhIHZpZXcgb2YgbXVsdGlwbGUgZG9jdW1lbnRzIChvdGhlclxuICAgICAgICAgIC8vIHNoZW5hbmlnYW5zIG1lYW4gd2Ugc2hvdWxkbid0IHNlbGVjdCBhbnl0aGluZylcbiAgICAgICAgICBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPT09IDAgJiYgIXNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIoe1xuICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgIGRvY0xpc3RcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsZWN0b3Iub2JqUXVlcnkgPT09ICckJykge1xuICAgICAgICAgIC8vIFNlbGVjdGluZyB0aGUgZG9jdW1lbnRzIHRoZW1zZWx2ZXNcbiAgICAgICAgICBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPT09IDAgJiYgIXNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICBkb2NMaXN0LmZvckVhY2goZG9jID0+IHtcbiAgICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcih7XG4gICAgICAgICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSAxKSB7XG4gICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIoe1xuICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgIGRvY0xpc3RcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT2theSwgd2UgbmVlZCB0byBldmFsdWF0ZSB0aGUganNvblBhdGhcbiAgICAgICAgICBmb3IgKGxldCBkb2NJbmRleCA9IDA7IGRvY0luZGV4IDwgZG9jTGlzdC5sZW5ndGg7IGRvY0luZGV4KyspIHtcbiAgICAgICAgICAgIGxldCBkb2MgPSBkb2NMaXN0W2RvY0luZGV4XTtcbiAgICAgICAgICAgIGxldCBtYXRjaGluZ1dyYXBwZXJzID0ganNvblBhdGgubm9kZXMoZG9jLCBzZWxlY3Rvci5vYmpRdWVyeSk7XG4gICAgICAgICAgICBmb3IgKGxldCBpdGVtSW5kZXggPSAwOyBpdGVtSW5kZXggPCBtYXRjaGluZ1dyYXBwZXJzLmxlbmd0aDsgaXRlbUluZGV4KyspIHtcbiAgICAgICAgICAgICAgbGV0IHsgcGF0aCwgdmFsdWUgfSA9IG1hdGNoaW5nV3JhcHBlcnNbaXRlbUluZGV4XTtcbiAgICAgICAgICAgICAgbGV0IGxvY2FsUGF0aCA9IHBhdGg7XG4gICAgICAgICAgICAgIGlmICh0aGlzLm11cmUuUkVTRVJWRURfT0JKX0tFWVNbbG9jYWxQYXRoLnNsaWNlKC0xKVswXV0pIHtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCBjcmVhdGUgaXRlbXMgdW5kZXIgcmVzZXJ2ZWQga2V5c1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSBsb2NhbFBhdGgubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgcGFyZW50IHNoaWZ0ZWQgdXAgdG8gdGhlIHJvb3QgbGV2ZWxcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIoe1xuICAgICAgICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgICAgICAgIGRvY0xpc3RcbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPT09IGxvY2FsUGF0aC5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgcGFyZW50IHNoaWZ0ZWQgdG8gdGhlIGRvY3VtZW50IGxldmVsXG4gICAgICAgICAgICAgICAgaWYgKCFzZWxlY3Rvci5mb2xsb3dMaW5rcykge1xuICAgICAgICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcih7XG4gICAgICAgICAgICAgICAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgICAgICAgICAgICAgICAgZG9jXG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzZWxlY3Rvci5wYXJlbnRTaGlmdCA+IDAgJiYgc2VsZWN0b3IucGFyZW50U2hpZnQgPCBsb2NhbFBhdGgubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsIHBhcmVudFNoaWZ0XG4gICAgICAgICAgICAgICAgICBsb2NhbFBhdGguc3BsaWNlKGxvY2FsUGF0aC5sZW5ndGggLSBzZWxlY3Rvci5wYXJlbnRTaGlmdCk7XG4gICAgICAgICAgICAgICAgICB2YWx1ZSA9IGpzb25QYXRoLnF1ZXJ5KGRvYywganNvblBhdGguc3RyaW5naWZ5KGxvY2FsUGF0aCkpWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0b3IuZm9sbG93TGlua3MpIHtcbiAgICAgICAgICAgICAgICAgIC8vIFdlIChwb3RlbnRpYWxseSkgc2VsZWN0ZWQgYSBsaW5rIHRoYXQgd2UgbmVlZCB0byBmb2xsb3dcbiAgICAgICAgICAgICAgICAgIE9iamVjdC52YWx1ZXMoYXdhaXQgdGhpcy5tdXJlLmZvbGxvd1JlbGF0aXZlTGluayh2YWx1ZSwgZG9jKSlcbiAgICAgICAgICAgICAgICAgICAgLmZvckVhY2goYWRkV3JhcHBlcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IFdyYXBwZXJUeXBlID0gdGhpcy5tdXJlLmluZmVyVHlwZSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyBXcmFwcGVyVHlwZSh7XG4gICAgICAgICAgICAgICAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IFtge1wiX2lkXCI6XCIke2RvYy5faWR9XCJ9YF0uY29uY2F0KGxvY2FsUGF0aCksXG4gICAgICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFdyYXBwZXJzO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGUgKG9wZXJhdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgbGV0IG91dHB1dFNwZWMgPSBhd2FpdCBvcGVyYXRpb24uZXhlY3V0ZU9uU2VsZWN0aW9uKHRoaXMsIGlucHV0T3B0aW9ucyk7XG5cbiAgICBjb25zdCBwb2xsdXRlZERvY3MgPSBPYmplY3QudmFsdWVzKG91dHB1dFNwZWMucG9sbHV0ZWREb2NzKTtcblxuICAgIC8vIFdyaXRlIGFueSB3YXJuaW5ncywgYW5kLCBkZXBlbmRpbmcgb24gdGhlIHVzZXIncyBzZXR0aW5ncywgc2tpcCBvciBzYXZlXG4gICAgLy8gdGhlIHJlc3VsdHNcbiAgICBsZXQgc2tpcFNhdmUgPSBmYWxzZTtcbiAgICBpZiAoT2JqZWN0LmtleXMob3V0cHV0U3BlYy53YXJuaW5ncykubGVuZ3RoID4gMCkge1xuICAgICAgbGV0IHdhcm5pbmdTdHJpbmc7XG4gICAgICBpZiAob3V0cHV0U3BlYy5pZ25vcmVFcnJvcnMgPT09ICdTdG9wIG9uIEVycm9yJykge1xuICAgICAgICBza2lwU2F2ZSA9IHRydWU7XG4gICAgICAgIHdhcm5pbmdTdHJpbmcgPSBgJHtvcGVyYXRpb24uaHVtYW5SZWFkYWJsZVR5cGV9IG9wZXJhdGlvbiBmYWlsZWQuXFxuYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdhcm5pbmdTdHJpbmcgPSBgJHtvcGVyYXRpb24uaHVtYW5SZWFkYWJsZVR5cGV9IG9wZXJhdGlvbiBmaW5pc2hlZCB3aXRoIHdhcm5pbmdzOlxcbmA7XG4gICAgICB9XG4gICAgICB3YXJuaW5nU3RyaW5nICs9IE9iamVjdC5lbnRyaWVzKG91dHB1dFNwZWMud2FybmluZ3MpLm1hcCgoW3dhcm5pbmcsIGNvdW50XSkgPT4ge1xuICAgICAgICBpZiAoY291bnQgPiAxKSB7XG4gICAgICAgICAgcmV0dXJuIGAke3dhcm5pbmd9ICh4JHtjb3VudH0pYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gYCR7d2FybmluZ31gO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMubXVyZS53YXJuKHdhcm5pbmdTdHJpbmcpO1xuICAgIH1cbiAgICBsZXQgc2F2ZVN1Y2Nlc3NmdWwgPSBmYWxzZTtcbiAgICBpZiAoIXNraXBTYXZlKSB7XG4gICAgICAvLyBTYXZlIHRoZSByZXN1bHRzXG4gICAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgdGhpcy5tdXJlLnB1dERvY3MocG9sbHV0ZWREb2NzKTtcbiAgICAgIHNhdmVTdWNjZXNzZnVsID0gc2F2ZVJlc3VsdC5lcnJvciAhPT0gdHJ1ZTtcbiAgICAgIGlmICghc2F2ZVN1Y2Nlc3NmdWwpIHtcbiAgICAgICAgLy8gVGhlcmUgd2FzIGEgcHJvYmxlbSBzYXZpbmcgdGhlIHJlc3VsdFxuICAgICAgICB0aGlzLm11cmUud2FybihzYXZlUmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFueSBzZWxlY3Rpb24gdGhhdCBoYXMgY2FjaGVkIGFueSBvZiB0aGUgZG9jdW1lbnRzIHRoYXQgd2UgYWx0ZXJlZFxuICAgIC8vIG5lZWRzIHRvIGhhdmUgaXRzIGNhY2hlIGludmFsaWRhdGVkXG4gICAgcG9sbHV0ZWREb2NzLmZvckVhY2goZG9jID0+IHtcbiAgICAgIFNlbGVjdGlvbi5JTlZBTElEQVRFX0RPQ19DQUNIRShkb2MuX2lkKTtcbiAgICB9KTtcblxuICAgIC8vIEZpbmFsbHksIHJldHVybiB0aGlzIHNlbGVjdGlvbiwgb3IgYSBuZXcgc2VsZWN0aW9uLCBkZXBlbmRpbmcgb24gdGhlXG4gICAgLy8gb3BlcmF0aW9uXG4gICAgaWYgKHNhdmVTdWNjZXNzZnVsICYmIG91dHB1dFNwZWMubmV3U2VsZWN0b3JzICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbmV3IFNlbGVjdGlvbih0aGlzLm11cmUsIG91dHB1dFNwZWMubmV3U2VsZWN0b3JzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgIFNob3J0Y3V0cyBmb3Igc2VsZWN0aW9uIG1hbmlwdWxhdGlvblxuICAgKi9cbiAgYXN5bmMgc3ViU2VsZWN0IChhcHBlbmQsIG1vZGUgPSAnUmVwbGFjZScpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RBbGwoeyBjb250ZXh0OiAnU2VsZWN0b3InLCBhcHBlbmQsIG1vZGUgfSk7XG4gIH1cbiAgYXN5bmMgbWVyZ2VTZWxlY3Rpb24gKG90aGVyU2VsZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0QWxsKHsgY29udGV4dDogJ1NlbGVjdGlvbicsIG90aGVyU2VsZWN0aW9uLCBtb2RlOiAnVW5pb24nIH0pO1xuICB9XG5cbiAgLypcbiAgIFRoZXNlIGZ1bmN0aW9ucyBwcm92aWRlIHN0YXRpc3RpY3MgLyBzdW1tYXJpZXMgb2YgdGhlIHNlbGVjdGlvbjpcbiAgICovXG4gIGFzeW5jIGdldFBvcHVsYXRlZElucHV0U3BlYyAob3BlcmF0aW9uKSB7XG4gICAgaWYgKHRoaXMuX3N1bW1hcnlDYWNoZXMgJiYgdGhpcy5fc3VtbWFyeUNhY2hlcy5pbnB1dFNwZWNzICYmXG4gICAgICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjc1tvcGVyYXRpb24udHlwZV0pIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3Nbb3BlcmF0aW9uLnR5cGVdO1xuICAgIH1cblxuICAgIGNvbnN0IGlucHV0U3BlYyA9IG9wZXJhdGlvbi5nZXRJbnB1dFNwZWMoKTtcbiAgICBhd2FpdCBpbnB1dFNwZWMucG9wdWxhdGVDaG9pY2VzRnJvbVNlbGVjdGlvbih0aGlzKTtcblxuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMgPSB0aGlzLl9zdW1tYXJ5Q2FjaGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjcyA9IHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjcyB8fCB7fTtcbiAgICB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3Nbb3BlcmF0aW9uLnR5cGVdID0gaW5wdXRTcGVjO1xuICAgIHJldHVybiBpbnB1dFNwZWM7XG4gIH1cbiAgYXN5bmMgaGlzdG9ncmFtcyAobnVtQmlucyA9IDIwKSB7XG4gICAgaWYgKHRoaXMuX3N1bW1hcnlDYWNoZXMgJiYgdGhpcy5fc3VtbWFyeUNhY2hlcy5oaXN0b2dyYW1zKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3VtbWFyeUNhY2hlcy5oaXN0b2dyYW1zO1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgdGhpcy5pdGVtcygpO1xuICAgIGNvbnN0IGl0ZW1MaXN0ID0gT2JqZWN0LnZhbHVlcyhpdGVtcyk7XG5cbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgcmF3OiB7XG4gICAgICAgIHR5cGVCaW5zOiB7fSxcbiAgICAgICAgY2F0ZWdvcmljYWxCaW5zOiB7fSxcbiAgICAgICAgcXVhbnRpdGF0aXZlQmluczogW11cbiAgICAgIH0sXG4gICAgICBhdHRyaWJ1dGVzOiB7fVxuICAgIH07XG5cbiAgICBjb25zdCBjb3VudFByaW1pdGl2ZSA9IChjb3VudGVycywgaXRlbSkgPT4ge1xuICAgICAgLy8gQXR0ZW1wdCB0byBjb3VudCB0aGUgdmFsdWUgY2F0ZWdvcmljYWxseVxuICAgICAgaWYgKGNvdW50ZXJzLmNhdGVnb3JpY2FsQmlucyAhPT0gbnVsbCkge1xuICAgICAgICBjb3VudGVycy5jYXRlZ29yaWNhbEJpbnNbaXRlbS52YWx1ZV0gPSAoY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zW2l0ZW0udmFsdWVdIHx8IDApICsgMTtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKGNvdW50ZXJzLmNhdGVnb3JpY2FsQmlucykubGVuZ3RoID4gbnVtQmlucykge1xuICAgICAgICAgIC8vIFdlJ3ZlIGVuY291bnRlcmVkIHRvbyBtYW55IGNhdGVnb3JpY2FsIGJpbnM7IHRoaXMgbGlrZWx5IGlzbid0IGEgY2F0ZWdvcmljYWwgYXR0cmlidXRlXG4gICAgICAgICAgY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gQXR0ZW1wdCB0byBiaW4gdGhlIHZhbHVlIHF1YW50aXRhdGl2ZWx5XG4gICAgICBpZiAoY291bnRlcnMucXVhbnRpdGF0aXZlQmlucyAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoY291bnRlcnMucXVhbnRpdGF0aXZlQmlucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBJbml0IHRoZSBjb3VudGVycyB3aXRoIHNvbWUgdGVtcG9yYXJ5IHBsYWNlaG9sZGVyc1xuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzID0gW107XG4gICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZSA9IGl0ZW0udHlwZTtcbiAgICAgICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyKSB7XG4gICAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZSA9IHRoaXMubXVyZS5kMy5zY2FsZUxpbmVhcigpXG4gICAgICAgICAgICAgIC5kb21haW4oW2l0ZW0udmFsdWUsIGl0ZW0udmFsdWVdKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRGF0ZVdyYXBwZXIpIHtcbiAgICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlID0gdGhpcy5tdXJlLmQzLnNjYWxlVGltZSgpXG4gICAgICAgICAgICAgIC5kb21haW4oW2l0ZW0udmFsdWUsIGl0ZW0udmFsdWVdKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhlIGZpcnN0IHZhbHVlIGlzIG5vbi1xdWFudGl0YXRpdmU7IHRoaXMgbGlrZWx5IGlzbid0IGEgcXVhbnRpdGF0aXZlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlQmlucyA9IG51bGw7XG4gICAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlV3JhcHBlcnM7XG4gICAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZTtcbiAgICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZSAhPT0gaXRlbS50eXBlKSB7XG4gICAgICAgICAgLy8gRW5jb3VudGVyZWQgYW4gaXRlbSBvZiBhIGRpZmZlcmVudCB0eXBlOyB0aGlzIGxpa2VseSBpc24ndCBhIHF1YW50aXRhdGl2ZSBhdHRyaWJ1dGVcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVCaW5zID0gbnVsbDtcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlV3JhcHBlcnM7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVR5cGU7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc2NhbGUncyBkb21haW4gKHdlJ2xsIGRldGVybWluZSBiaW5zIGxhdGVyKVxuICAgICAgICAgIGxldCBkb21haW4gPSBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZS5kb21haW4oKTtcbiAgICAgICAgICBpZiAoaXRlbS52YWx1ZSA8IGRvbWFpblswXSkge1xuICAgICAgICAgICAgZG9tYWluWzBdID0gaXRlbS52YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGl0ZW0udmFsdWUgPiBkb21haW5bMV0pIHtcbiAgICAgICAgICAgIGRvbWFpblsxXSA9IGl0ZW0udmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLmRvbWFpbihkb21haW4pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBpdGVtTGlzdFtpXTtcbiAgICAgIHJlc3VsdC5yYXcudHlwZUJpbnNbaXRlbS50eXBlXSA9IChyZXN1bHQucmF3LnR5cGVCaW5zW2l0ZW0udHlwZV0gfHwgMCkgKyAxO1xuICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuUHJpbWl0aXZlV3JhcHBlcikge1xuICAgICAgICBjb3VudFByaW1pdGl2ZShyZXN1bHQucmF3LCBpdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpdGVtLmdldENvbnRlbnRzKSB7XG4gICAgICAgICAgT2JqZWN0LnZhbHVlcyhpdGVtLmdldENvbnRlbnRzKCkpLmZvckVhY2goY2hpbGRXcmFwcGVyID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ZXJzID0gcmVzdWx0LmF0dHJpYnV0ZXNbY2hpbGRXcmFwcGVyLmxhYmVsXSA9IHJlc3VsdC5hdHRyaWJ1dGVzW2NoaWxkV3JhcHBlci5sYWJlbF0gfHwge1xuICAgICAgICAgICAgICB0eXBlQmluczoge30sXG4gICAgICAgICAgICAgIGNhdGVnb3JpY2FsQmluczoge30sXG4gICAgICAgICAgICAgIHF1YW50aXRhdGl2ZUJpbnM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY291bnRlcnMudHlwZUJpbnNbY2hpbGRXcmFwcGVyLnR5cGVdID0gKGNvdW50ZXJzLnR5cGVCaW5zW2NoaWxkV3JhcHBlci50eXBlXSB8fCAwKSArIDE7XG4gICAgICAgICAgICBpZiAoY2hpbGRXcmFwcGVyIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlByaW1pdGl2ZVdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgY291bnRQcmltaXRpdmUoY291bnRlcnMsIGNoaWxkV3JhcHBlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVE9ETzogY29sbGVjdCBtb3JlIHN0YXRpc3RpY3MsIHN1Y2ggYXMgbm9kZSBkZWdyZWUsIHNldCBzaXplXG4gICAgICAgIC8vIChhbmQgYSBzZXQncyBtZW1iZXJzJyBhdHRyaWJ1dGVzLCBzaW1pbGFyIHRvIGdldENvbnRlbnRzPylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBmaW5hbGl6ZUJpbnMgPSBjb3VudGVycyA9PiB7XG4gICAgICAvLyBDbGVhciBvdXQgYW55dGhpbmcgdGhhdCBkaWRuJ3Qgc2VlIGFueSB2YWx1ZXNcbiAgICAgIGlmIChjb3VudGVycy50eXBlQmlucyAmJiBPYmplY3Qua2V5cyhjb3VudGVycy50eXBlQmlucykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvdW50ZXJzLnR5cGVCaW5zID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmIChjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMgJiZcbiAgICAgICAgICBPYmplY3Qua2V5cyhjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMpIHtcbiAgICAgICAgaWYgKCFjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycyB8fFxuICAgICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMgPSBudWxsO1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycztcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZTtcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ2FsY3VsYXRlIHF1YW50aXRhdGl2ZSBiaW4gc2l6ZXMgYW5kIHRoZWlyIGNvdW50c1xuICAgICAgICAgIC8vIENsZWFuIHVwIHRoZSBzY2FsZSBhIGJpdFxuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLm5pY2UoKTtcbiAgICAgICAgICAvLyBIaXN0b2dyYW0gZ2VuZXJhdG9yXG4gICAgICAgICAgY29uc3QgaGlzdG9ncmFtR2VuZXJhdG9yID0gdGhpcy5tdXJlLmQzLmhpc3RvZ3JhbSgpXG4gICAgICAgICAgICAuZG9tYWluKGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLmRvbWFpbigpKVxuICAgICAgICAgICAgLnRocmVzaG9sZHMoY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGUudGlja3MobnVtQmlucykpXG4gICAgICAgICAgICAudmFsdWUoZCA9PiBkLnZhbHVlKTtcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVCaW5zID0gaGlzdG9ncmFtR2VuZXJhdG9yKGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzKTtcbiAgICAgICAgICAvLyBDbGVhbiB1cCBzb21lIG9mIHRoZSB0ZW1wb3JhcnkgcGxhY2Vob2xkZXJzXG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzO1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVUeXBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICBmaW5hbGl6ZUJpbnMocmVzdWx0LnJhdyk7XG4gICAgT2JqZWN0LnZhbHVlcyhyZXN1bHQuYXR0cmlidXRlcykuZm9yRWFjaChmaW5hbGl6ZUJpbnMpO1xuXG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcyA9IHRoaXMuX3N1bW1hcnlDYWNoZXMgfHwge307XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcy5oaXN0b2dyYW1zID0gcmVzdWx0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgZ2V0RmxhdEdyYXBoU2NoZW1hICgpIHtcbiAgICBpZiAodGhpcy5fc3VtbWFyeUNhY2hlcyAmJiB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmZsYXRHcmFwaFNjaGVtYSkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N1bW1hcnlDYWNoZXMuZmxhdEdyYXBoU2NoZW1hO1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgdGhpcy5pdGVtcygpO1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlQ2xhc3Nlczoge30sXG4gICAgICBlZGdlQ2xhc3Nlczoge30sXG4gICAgICBtaXNzaW5nTm9kZXM6IGZhbHNlLFxuICAgICAgbWlzc2luZ0VkZ2VzOiBmYWxzZVxuICAgIH07XG5cbiAgICAvLyBGaXJzdCBwYXNzOiBpZGVudGlmeSBpdGVtcyBieSBjbGFzcywgYW5kIGdlbmVyYXRlIHBzZXVkby1pdGVtcyB0aGF0XG4gICAgLy8gcG9pbnQgdG8gY2xhc3NlcyBpbnN0ZWFkIG9mIHNlbGVjdG9yc1xuICAgIE9iamVjdC5lbnRyaWVzKGl0ZW1zKS5mb3JFYWNoKChbdW5pcXVlU2VsZWN0b3IsIGl0ZW1dKSA9PiB7XG4gICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcikge1xuICAgICAgICAvLyBUaGlzIGlzIGFuIGVkZ2U7IGNyZWF0ZSAvIGFkZCB0byBhIHBzZXVkby1pdGVtIGZvciBlYWNoIGNsYXNzXG4gICAgICAgIGxldCBjbGFzc0xpc3QgPSBpdGVtLmdldENsYXNzZXMoKTtcbiAgICAgICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjbGFzc0xpc3QucHVzaCgnKG5vIGNsYXNzKScpO1xuICAgICAgICB9XG4gICAgICAgIGNsYXNzTGlzdC5mb3JFYWNoKGVkZ2VDbGFzc05hbWUgPT4ge1xuICAgICAgICAgIGxldCBwc2V1ZG9FZGdlID0gcmVzdWx0LmVkZ2VDbGFzc2VzW2VkZ2VDbGFzc05hbWVdID1cbiAgICAgICAgICAgIHJlc3VsdC5lZGdlQ2xhc3Nlc1tlZGdlQ2xhc3NOYW1lXSB8fCB7ICRub2Rlczoge30gfTtcbiAgICAgICAgICAvLyBBZGQgb3VyIGRpcmVjdGlvbiBjb3VudHMgZm9yIGVhY2ggb2YgdGhlIG5vZGUncyBjbGFzc2VzIHRvIHRoZSBwc2V1ZG8taXRlbVxuICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGl0ZW0udmFsdWUuJG5vZGVzKS5mb3JFYWNoKChbbm9kZVNlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4ge1xuICAgICAgICAgICAgbGV0IG5vZGVXcmFwcGVyID0gaXRlbXNbbm9kZVNlbGVjdG9yXTtcbiAgICAgICAgICAgIGlmICghbm9kZVdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgLy8gVGhpcyBlZGdlIHJlZmVycyB0byBhIG5vZGUgb3V0c2lkZSB0aGUgc2VsZWN0aW9uXG4gICAgICAgICAgICAgIHJlc3VsdC5taXNzaW5nTm9kZXMgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbm9kZVdyYXBwZXIuZ2V0Q2xhc3NlcygpLmZvckVhY2gobm9kZUNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoZGlyZWN0aW9ucykuZm9yRWFjaCgoW2RpcmVjdGlvbiwgY291bnRdKSA9PiB7XG4gICAgICAgICAgICAgICAgICBwc2V1ZG9FZGdlLiRub2Rlc1tub2RlQ2xhc3NOYW1lXSA9IHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgcHNldWRvRWRnZS4kbm9kZXNbbm9kZUNsYXNzTmFtZV1bZGlyZWN0aW9uXSA9IHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdW2RpcmVjdGlvbl0gfHwgMDtcbiAgICAgICAgICAgICAgICAgIHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdW2RpcmVjdGlvbl0gKz0gY291bnQ7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikge1xuICAgICAgICAvLyBUaGlzIGlzIGEgbm9kZTsgY3JlYXRlIC8gYWRkIHRvIGEgcHNldWRvLWl0ZW0gZm9yIGVhY2ggY2xhc3NcbiAgICAgICAgbGV0IGNsYXNzTGlzdCA9IGl0ZW0uZ2V0Q2xhc3NlcygpO1xuICAgICAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNsYXNzTGlzdC5wdXNoKCcobm8gY2xhc3MpJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2xhc3NMaXN0LmZvckVhY2gobm9kZUNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgbGV0IHBzZXVkb05vZGUgPSByZXN1bHQubm9kZUNsYXNzZXNbbm9kZUNsYXNzTmFtZV0gPVxuICAgICAgICAgICAgcmVzdWx0Lm5vZGVDbGFzc2VzW25vZGVDbGFzc05hbWVdIHx8IHsgY291bnQ6IDAsICRlZGdlczoge30gfTtcbiAgICAgICAgICBwc2V1ZG9Ob2RlLmNvdW50ICs9IDE7XG4gICAgICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIGVkZ2UgY2xhc3MgaXMgcmVmZXJlbmNlZCAoZGlyZWN0aW9ucycgY291bnRzIGFyZSBrZXB0IG9uIHRoZSBlZGdlcylcbiAgICAgICAgICBPYmplY3Qua2V5cyhpdGVtLnZhbHVlLiRlZGdlcykuZm9yRWFjaChlZGdlU2VsZWN0b3IgPT4ge1xuICAgICAgICAgICAgbGV0IGVkZ2VXcmFwcGVyID0gaXRlbXNbZWRnZVNlbGVjdG9yXTtcbiAgICAgICAgICAgIGlmICghZWRnZVdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgLy8gVGhpcyBub2RlIHJlZmVycyB0byBhbiBlZGdlIG91dHNpZGUgdGhlIHNlbGVjdGlvblxuICAgICAgICAgICAgICByZXN1bHQubWlzc2luZ0VkZ2VzID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGVkZ2VXcmFwcGVyLmdldENsYXNzZXMoKS5mb3JFYWNoKGVkZ2VDbGFzc05hbWUgPT4ge1xuICAgICAgICAgICAgICAgIHBzZXVkb05vZGUuJGVkZ2VzW2VkZ2VDbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcyA9IHRoaXMuX3N1bW1hcnlDYWNoZXMgfHwge307XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcy5mbGF0R3JhcGhTY2hlbWEgPSByZXN1bHQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBnZXRJbnRlcnNlY3RlZEdyYXBoU2NoZW1hICgpIHtcbiAgICAvLyBjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuaXRlbXMoKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgfVxuICBhc3luYyBhbGxNZXRhT2JqSW50ZXJzZWN0aW9ucyAobWV0YU9ianMpIHtcbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuaXRlbXMoKTtcbiAgICBsZXQgbGlua2VkSWRzID0ge307XG4gICAgaXRlbXMuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIG1ldGFPYmpzLmZvckVhY2gobWV0YU9iaiA9PiB7XG4gICAgICAgIGlmIChpdGVtLnZhbHVlW21ldGFPYmpdKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoaXRlbS52YWx1ZVttZXRhT2JqXSkuZm9yRWFjaChsaW5rZWRJZCA9PiB7XG4gICAgICAgICAgICBsaW5rZWRJZCA9IHRoaXMubXVyZS5pZFRvVW5pcXVlU2VsZWN0b3IobGlua2VkSWQsIGl0ZW0uZG9jLl9pZCk7XG4gICAgICAgICAgICBsaW5rZWRJZHNbbGlua2VkSWRdID0gbGlua2VkSWRzW2xpbmtlZElkXSB8fCB7fTtcbiAgICAgICAgICAgIGxpbmtlZElkc1tsaW5rZWRJZF1baXRlbS51bmlxdWVTZWxlY3Rvcl0gPSB0cnVlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBsZXQgc2V0cyA9IFtdO1xuICAgIGxldCBzZXRMb29rdXAgPSB7fTtcbiAgICBPYmplY3Qua2V5cyhsaW5rZWRJZHMpLmZvckVhY2gobGlua2VkSWQgPT4ge1xuICAgICAgbGV0IGl0ZW1JZHMgPSBPYmplY3Qua2V5cyhsaW5rZWRJZHNbbGlua2VkSWRdKS5zb3J0KCk7XG4gICAgICBsZXQgc2V0S2V5ID0gaXRlbUlkcy5qb2luKCcsJyk7XG4gICAgICBpZiAoc2V0TG9va3VwW3NldEtleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzZXRMb29rdXBbc2V0S2V5XSA9IHNldHMubGVuZ3RoO1xuICAgICAgICBzZXRzLnB1c2goeyBpdGVtSWRzLCBsaW5rZWRJZHM6IHt9IH0pO1xuICAgICAgfVxuICAgICAgc2V0TG9va3VwW3NldEtleV0ubGlua2VkSWRzW2xpbmtlZElkXSA9IHRydWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIHNldHM7XG4gIH1cbn1cbi8vIFRPRE86IHRoaXMgd2F5IG9mIGRlYWxpbmcgd2l0aCBjYWNoZSBpbnZhbGlkYXRpb24gY2F1c2VzIGEgbWVtb3J5IGxlYWssIGFzXG4vLyBvbGQgc2VsZWN0aW9ucyBhcmUgZ29pbmcgdG8gcGlsZSB1cCBpbiBDQUNIRURfRE9DUyBhZnRlciB0aGV5J3ZlIGxvc3QgYWxsXG4vLyBvdGhlciByZWZlcmVuY2VzLCBwcmV2ZW50aW5nIHRoZWlyIGdhcmJhZ2UgY29sbGVjdGlvbi4gVW5mb3J0dW5hdGVseSB0aGluZ3Ncbi8vIGxpa2UgV2Vha01hcCBhcmVuJ3QgZW51bWVyYWJsZS4uLiBhIGdvb2QgaWRlYSB3b3VsZCBwcm9iYWJseSBiZSB0byBqdXN0XG4vLyBwdXJnZSB0aGUgY2FjaGUgZXZlcnkgbiBtaW51dGVzIG9yIHNvLi4uP1xuU2VsZWN0aW9uLkRFRkFVTFRfRE9DX1FVRVJZID0gREVGQVVMVF9ET0NfUVVFUlk7XG5TZWxlY3Rpb24uQ0FDSEVEX0RPQ1MgPSB7fTtcblNlbGVjdGlvbi5JTlZBTElEQVRFX0RPQ19DQUNIRSA9IGRvY0lkID0+IHtcbiAgaWYgKFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2NJZF0pIHtcbiAgICBTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jSWRdLnNlbGVjdGlvbnMuZm9yRWFjaChzZWxlY3Rpb24gPT4ge1xuICAgICAgc2VsZWN0aW9uLmludmFsaWRhdGVDYWNoZSgpO1xuICAgIH0pO1xuICAgIGRlbGV0ZSBTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jSWRdO1xuICB9XG59O1xuU2VsZWN0aW9uLklOVkFMSURBVEVfQUxMX0NBQ0hFUyA9ICgpID0+IHtcbiAgT2JqZWN0LnZhbHVlcyhTZWxlY3Rpb24uQ0FDSEVEX0RPQ1MpLmZvckVhY2goKHsgY2FjaGVkRG9jLCBzZWxlY3Rpb25zIH0pID0+IHtcbiAgICBzZWxlY3Rpb25zLmZvckVhY2goc2VsZWN0aW9uID0+IHtcbiAgICAgIHNlbGVjdGlvbi5pbnZhbGlkYXRlQ2FjaGUoKTtcbiAgICB9KTtcbiAgICBkZWxldGUgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2NhY2hlZERvYy5faWRdO1xuICB9KTtcbn07XG5leHBvcnQgZGVmYXVsdCBTZWxlY3Rpb247XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXNcbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlV3JhcHBlciBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgcGF0aCwgdmFsdWUsIHBhcmVudCwgZG9jLCBsYWJlbCwgdW5pcXVlU2VsZWN0b3IgfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgICB0aGlzLnBhdGggPSBwYXRoO1xuICAgIHRoaXMuX3ZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgdGhpcy5kb2MgPSBkb2M7XG4gICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgIHRoaXMudW5pcXVlU2VsZWN0b3IgPSB1bmlxdWVTZWxlY3RvcjtcbiAgfVxuICBnZXQgdmFsdWUgKCkgeyByZXR1cm4gdGhpcy5fdmFsdWU7IH1cbiAgc2V0IHZhbHVlIChuZXdWYWx1ZSkge1xuICAgIGlmICh0aGlzLnBhcmVudCkge1xuICAgICAgLy8gSW4gdGhlIGV2ZW50IHRoYXQgdGhpcyBpcyBhIHByaW1pdGl2ZSBib29sZWFuLCBudW1iZXIsIHN0cmluZywgZXRjLFxuICAgICAgLy8gc2V0dGluZyB0aGUgdmFsdWUgb24gdGhlIFdyYXBwZXIgd3JhcHBlciBvYmplY3QgKndvbid0KiBuYXR1cmFsbHkgdXBkYXRlXG4gICAgICAvLyBpdCBpbiBpdHMgY29udGFpbmluZyBkb2N1bWVudC4uLlxuICAgICAgdGhpcy5wYXJlbnRbdGhpcy5sYWJlbF0gPSBuZXdWYWx1ZTtcbiAgICB9XG4gICAgdGhpcy5fdmFsdWUgPSBuZXdWYWx1ZTtcbiAgfVxuICByZW1vdmUgKCkge1xuICAgIC8vIHRoaXMucGFyZW50IGlzIGEgcG9pbnRlciB0byB0aGUgcmF3IGVsZW1lbnQsIHNvIHdlIHdhbnQgdG8gZGVsZXRlIGl0c1xuICAgIC8vIHJlZmVyZW5jZSB0byB0aGlzIGl0ZW1cbiAgICBkZWxldGUgdGhpcy5wYXJlbnRbdGhpcy5sYWJlbF07XG4gIH1cbiAgZXF1YWxzIChvdGhlcikge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIEJhc2VXcmFwcGVyICYmXG4gICAgICB0aGlzLnVuaXF1ZVNlbGVjdG9yID09PSBvdGhlci51bmlxdWVTZWxlY3RvcjtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuQmFzZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG59O1xuQmFzZVdyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyB2YWx1ZSB9KSA9PiB7XG4gIC8vIERlZmF1bHQgYWN0aW9uOiBkbyBub3RoaW5nXG4gIHJldHVybiB2YWx1ZTtcbn07XG5CYXNlV3JhcHBlci5pc0JhZFZhbHVlID0gdmFsdWUgPT4gZmFsc2U7XG5cbmV4cG9ydCBkZWZhdWx0IEJhc2VXcmFwcGVyO1xuIiwiaW1wb3J0IEJhc2VXcmFwcGVyIGZyb20gJy4vQmFzZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBSb290V3JhcHBlciBleHRlbmRzIEJhc2VXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgZG9jTGlzdCB9KSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIHBhdGg6IFtdLFxuICAgICAgdmFsdWU6IHt9LFxuICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgZG9jOiBudWxsLFxuICAgICAgbGFiZWw6IG51bGwsXG4gICAgICB1bmlxdWVTZWxlY3RvcjogJ0AnXG4gICAgfSk7XG4gICAgZG9jTGlzdC5mb3JFYWNoKGRvYyA9PiB7XG4gICAgICB0aGlzLnZhbHVlW2RvYy5faWRdID0gZG9jO1xuICAgIH0pO1xuICB9XG4gIHJlbW92ZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCByZW1vdmUgdGhlIHJvb3QgaXRlbWApO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290V3JhcHBlcjtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgQmFzZVdyYXBwZXIgZnJvbSAnLi9CYXNlV3JhcHBlci5qcyc7XG5cbmNsYXNzIFR5cGVkV3JhcHBlciBleHRlbmRzIEJhc2VXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgbGV0IHBhcmVudDtcbiAgICBpZiAocGF0aC5sZW5ndGggPCAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNyZWF0ZSBhIG5vbi1Sb290IG9yIG5vbi1Eb2MgV3JhcHBlciB3aXRoIGEgcGF0aCBsZW5ndGggbGVzcyB0aGFuIDJgKTtcbiAgICB9IGVsc2UgaWYgKHBhdGgubGVuZ3RoID09PSAyKSB7XG4gICAgICBwYXJlbnQgPSBkb2M7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB0ZW1wID0ganNvblBhdGguc3RyaW5naWZ5KHBhdGguc2xpY2UoMSwgcGF0aC5sZW5ndGggLSAxKSk7XG4gICAgICBwYXJlbnQgPSBqc29uUGF0aC52YWx1ZShkb2MsIHRlbXApO1xuICAgIH1cbiAgICBjb25zdCBkb2NQYXRoUXVlcnkgPSBwYXRoWzBdO1xuICAgIGNvbnN0IHVuaXF1ZUpzb25QYXRoID0ganNvblBhdGguc3RyaW5naWZ5KHBhdGguc2xpY2UoMSkpO1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBwYXRoLFxuICAgICAgdmFsdWUsXG4gICAgICBwYXJlbnQsXG4gICAgICBkb2MsXG4gICAgICBsYWJlbDogcGF0aFtwYXRoLmxlbmd0aCAtIDFdLFxuICAgICAgdW5pcXVlU2VsZWN0b3I6ICdAJyArIGRvY1BhdGhRdWVyeSArIHVuaXF1ZUpzb25QYXRoXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IuaXNCYWRWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYHR5cGVvZiAke3ZhbHVlfSBpcyAke3R5cGVvZiB2YWx1ZX0sIHdoaWNoIGRvZXMgbm90IG1hdGNoIHJlcXVpcmVkICR7dGhpcy5jb25zdHJ1Y3Rvci5KU1RZUEV9YCk7XG4gICAgfVxuICB9XG4gIGdldCBwYXJlbnRXcmFwcGVyICgpIHtcbiAgICBjb25zdCBQYXJlbnRUeXBlID0gdGhpcy5tdXJlLmluZmVyVHlwZSh0aGlzLnBhcmVudCk7XG4gICAgcmV0dXJuIG5ldyBQYXJlbnRUeXBlKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIHZhbHVlOiB0aGlzLnBhcmVudCxcbiAgICAgIHBhdGg6IHRoaXMucGF0aC5zbGljZSgwLCB0aGlzLnBhdGgubGVuZ3RoIC0gMSksXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gIH1cbn1cblR5cGVkV3JhcHBlci5KU1RZUEUgPSAnb2JqZWN0JztcblR5cGVkV3JhcHBlci5pc0JhZFZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiAodHlwZW9mIHZhbHVlKSAhPT0gdGhpcy5KU1RZUEU7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgdmFsaWQtdHlwZW9mXG59O1xuXG5leHBvcnQgZGVmYXVsdCBUeXBlZFdyYXBwZXI7XG4iLCJleHBvcnQgZGVmYXVsdCAoc3VwZXJjbGFzcykgPT4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgZ2V0VmFsdWUgKGF0dHJpYnV0ZSwgdGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIHJldHVybiB0YXJnZXQudmFsdWVbYXR0cmlidXRlXTtcbiAgfVxuICBnZXRBdHRyaWJ1dGVzICh0YXJnZXQgPSB0aGlzLl9jb250ZW50V3JhcHBlciB8fCB0aGlzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRhcmdldC52YWx1ZSlcbiAgICAgIC5maWx0ZXIoZCA9PiAhdGhpcy5tdXJlLlJFU0VSVkVEX09CSl9LRVlTW2RdKTtcbiAgfVxuICBnZXRDb250ZW50cyAodGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKHRhcmdldC52YWx1ZSkuZm9yRWFjaCgoW2xhYmVsLCB2YWx1ZV0pID0+IHtcbiAgICAgIGlmICghdGhpcy5tdXJlLlJFU0VSVkVEX09CSl9LRVlTW2xhYmVsXSkge1xuICAgICAgICBsZXQgV3JhcHBlclR5cGUgPSB0aGlzLm11cmUuaW5mZXJUeXBlKHZhbHVlKTtcbiAgICAgICAgY29uc3QgdGVtcCA9IG5ldyBXcmFwcGVyVHlwZSh7XG4gICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIHBhdGg6IHRhcmdldC5wYXRoLmNvbmNhdChbbGFiZWxdKSxcbiAgICAgICAgICBkb2M6IHRhcmdldC5kb2NcbiAgICAgICAgfSk7XG4gICAgICAgIHJlc3VsdFt0ZW1wLnVuaXF1ZVNlbGVjdG9yXSA9IHRlbXA7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRDb250ZW50U2VsZWN0b3JzICh0YXJnZXQgPSB0aGlzLl9jb250ZW50V3JhcHBlciB8fCB0aGlzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0Q29udGVudHModGFyZ2V0KSk7XG4gIH1cbiAgZ2V0Q29udGVudENvdW50ICh0YXJnZXQgPSB0aGlzLl9jb250ZW50V3JhcHBlciB8fCB0aGlzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRhcmdldC52YWx1ZSlcbiAgICAgIC5maWx0ZXIobGFiZWwgPT4gIXRoaXMubXVyZS5SRVNFUlZFRF9PQkpfS0VZU1tsYWJlbF0pXG4gICAgICAubGVuZ3RoO1xuICB9XG59O1xuIiwiaW1wb3J0IGpzb25QYXRoIGZyb20gJ2pzb25wYXRoJztcbmltcG9ydCBUeXBlZFdyYXBwZXIgZnJvbSAnLi9UeXBlZFdyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXJNaXhpbiBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXJNaXhpbi5qcyc7XG5cbmNsYXNzIENvbnRhaW5lcldyYXBwZXIgZXh0ZW5kcyBDb250YWluZXJXcmFwcGVyTWl4aW4oVHlwZWRXcmFwcGVyKSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIHN1cGVyKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KTtcbiAgICB0aGlzLm5leHRMYWJlbCA9IE9iamVjdC5rZXlzKHRoaXMudmFsdWUpXG4gICAgICAucmVkdWNlKChtYXgsIGtleSkgPT4ge1xuICAgICAgICBrZXkgPSBwYXJzZUludChrZXkpO1xuICAgICAgICBpZiAoIWlzTmFOKGtleSkgJiYga2V5ID4gbWF4KSB7XG4gICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbWF4O1xuICAgICAgICB9XG4gICAgICB9LCAwKSArIDE7XG4gIH1cbiAgY3JlYXRlTmV3V3JhcHBlciAodmFsdWUsIGxhYmVsLCBXcmFwcGVyVHlwZSkge1xuICAgIFdyYXBwZXJUeXBlID0gV3JhcHBlclR5cGUgfHwgdGhpcy5tdXJlLmluZmVyVHlwZSh2YWx1ZSk7XG4gICAgaWYgKGxhYmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGxhYmVsID0gU3RyaW5nKHRoaXMubmV4dExhYmVsKTtcbiAgICAgIHRoaXMubmV4dExhYmVsICs9IDE7XG4gICAgfVxuICAgIGxldCBwYXRoID0gdGhpcy5wYXRoLmNvbmNhdChsYWJlbCk7XG4gICAgbGV0IGl0ZW0gPSBuZXcgV3JhcHBlclR5cGUoe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgdmFsdWU6IFdyYXBwZXJUeXBlLmdldEJvaWxlcnBsYXRlVmFsdWUoKSxcbiAgICAgIHBhdGgsXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gICAgdGhpcy5hZGRXcmFwcGVyKGl0ZW0sIGxhYmVsKTtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBhZGRXcmFwcGVyIChpdGVtLCBsYWJlbCkge1xuICAgIGlmIChpdGVtIGluc3RhbmNlb2YgQ29udGFpbmVyV3JhcHBlcikge1xuICAgICAgaWYgKGl0ZW0udmFsdWUuX2lkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignV3JhcHBlciBoYXMgYWxyZWFkeSBiZWVuIGFzc2lnbmVkIGFuIF9pZCcpO1xuICAgICAgfVxuICAgICAgaWYgKGxhYmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGFiZWwgPSB0aGlzLm5leHRMYWJlbDtcbiAgICAgICAgdGhpcy5uZXh0TGFiZWwgKz0gMTtcbiAgICAgIH1cbiAgICAgIGl0ZW0udmFsdWUuX2lkID0gYEAke2pzb25QYXRoLnN0cmluZ2lmeSh0aGlzLnBhdGguc2xpY2UoMSkuY29uY2F0KFtsYWJlbF0pKX1gO1xuICAgIH1cbiAgICB0aGlzLnZhbHVlW2xhYmVsXSA9IGl0ZW0udmFsdWU7XG4gIH1cbn1cbkNvbnRhaW5lcldyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHsgcmV0dXJuIHt9OyB9O1xuQ29udGFpbmVyV3JhcHBlci5jb252ZXJ0QXJyYXkgPSB2YWx1ZSA9PiB7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgbGV0IHRlbXAgPSB7fTtcbiAgICB2YWx1ZS5mb3JFYWNoKChlbGVtZW50LCBpbmRleCkgPT4ge1xuICAgICAgdGVtcFtpbmRleF0gPSBlbGVtZW50O1xuICAgIH0pO1xuICAgIHZhbHVlID0gdGVtcDtcbiAgICB2YWx1ZS4kd2FzQXJyYXkgPSB0cnVlO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5Db250YWluZXJXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KSA9PiB7XG4gIC8vIEFzc2lnbiB0aGUgb2JqZWN0J3MgaWQgaWYgYSBwYXRoIGlzIHN1cHBsaWVkXG4gIGlmIChwYXRoKSB7XG4gICAgdmFsdWUuX2lkID0gJ0AnICsganNvblBhdGguc3RyaW5naWZ5KHBhdGguc2xpY2UoMSkpO1xuICB9XG4gIC8vIFJlY3Vyc2l2ZWx5IHN0YW5kYXJkaXplIGNvbnRlbnRzIGlmIGEgcGF0aCBhbmQgZG9jIGFyZSBzdXBwbGllZFxuICBpZiAocGF0aCAmJiBkb2MpIHtcbiAgICBPYmplY3QuZW50cmllcyh2YWx1ZSkuZm9yRWFjaCgoW2tleSwgbmVzdGVkVmFsdWVdKSA9PiB7XG4gICAgICBpZiAoIW11cmUuUkVTRVJWRURfT0JKX0tFWVNba2V5XSkge1xuICAgICAgICBsZXQgdGVtcCA9IEFycmF5LmZyb20ocGF0aCk7XG4gICAgICAgIHRlbXAucHVzaChrZXkpO1xuICAgICAgICAvLyBBbGF5d3MgY29udmVydCBhcnJheXMgdG8gb2JqZWN0c1xuICAgICAgICBuZXN0ZWRWYWx1ZSA9IENvbnRhaW5lcldyYXBwZXIuY29udmVydEFycmF5KG5lc3RlZFZhbHVlKTtcbiAgICAgICAgLy8gV2hhdCBraW5kIG9mIHZhbHVlIGFyZSB3ZSBkZWFsaW5nIHdpdGg/XG4gICAgICAgIGxldCBXcmFwcGVyVHlwZSA9IG11cmUuaW5mZXJUeXBlKG5lc3RlZFZhbHVlLCBhZ2dyZXNzaXZlKTtcbiAgICAgICAgLy8gQXBwbHkgdGhhdCBjbGFzcydzIHN0YW5kYXJkaXphdGlvbiBmdW5jdGlvblxuICAgICAgICB2YWx1ZVtrZXldID0gV3JhcHBlclR5cGUuc3RhbmRhcmRpemUoe1xuICAgICAgICAgIG11cmUsXG4gICAgICAgICAgdmFsdWU6IG5lc3RlZFZhbHVlLFxuICAgICAgICAgIHBhdGg6IHRlbXAsXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIGFnZ3Jlc3NpdmVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgQ29udGFpbmVyV3JhcHBlcjtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgQmFzZVdyYXBwZXIgZnJvbSAnLi9CYXNlV3JhcHBlci5qcyc7XG5pbXBvcnQgQ29udGFpbmVyV3JhcHBlciBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXJNaXhpbiBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXJNaXhpbi5qcyc7XG5cbi8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSBbXG4gICdqc29uJyxcbiAgJ2NzdicsXG4gICd0c3YnLFxuICAndG9wb2pzb24nLFxuICAndHJlZWpzb24nXG5dO1xuXG5jbGFzcyBEb2N1bWVudFdyYXBwZXIgZXh0ZW5kcyBDb250YWluZXJXcmFwcGVyTWl4aW4oQmFzZVdyYXBwZXIpIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgZG9jIH0pIHtcbiAgICBjb25zdCBkb2NQYXRoUXVlcnkgPSBge1wiX2lkXCI6XCIke2RvYy5faWR9XCJ9YDtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgcGF0aDogW2RvY1BhdGhRdWVyeSwgJyQnXSxcbiAgICAgIHZhbHVlOiBkb2MsXG4gICAgICBwYXJlbnQ6IG51bGwsXG4gICAgICBkb2M6IGRvYyxcbiAgICAgIGxhYmVsOiBkb2NbJ2ZpbGVuYW1lJ10sXG4gICAgICB1bmlxdWVTZWxlY3RvcjogJ0AnICsgZG9jUGF0aFF1ZXJ5ICsgJyQnXG4gICAgfSk7XG4gICAgdGhpcy5fY29udGVudFdyYXBwZXIgPSBuZXcgQ29udGFpbmVyV3JhcHBlcih7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICB2YWx1ZTogdGhpcy52YWx1ZS5jb250ZW50cyxcbiAgICAgIHBhdGg6IHRoaXMucGF0aC5jb25jYXQoWydjb250ZW50cyddKSxcbiAgICAgIGRvYzogdGhpcy5kb2NcbiAgICB9KTtcbiAgfVxuICByZW1vdmUgKCkge1xuICAgIC8vIFRPRE86IHJlbW92ZSBldmVyeXRoaW5nIGluIHRoaXMudmFsdWUgZXhjZXB0IF9pZCwgX3JldiwgYW5kIGFkZCBfZGVsZXRlZD9cbiAgICAvLyBUaGVyZSdzIHByb2JhYmx5IHNvbWUgZnVua2luZXNzIGluIHRoZSB0aW1pbmcgb2Ygc2F2ZSgpIEkgc3RpbGwgbmVlZCB0b1xuICAgIC8vIHRoaW5rIHRocm91Z2guLi5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYERlbGV0aW5nIGZpbGVzIHZpYSBTZWxlY3Rpb25zIG5vdCB5ZXQgaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuRG9jdW1lbnRXcmFwcGVyLmlzVmFsaWRJZCA9IChkb2NJZCkgPT4ge1xuICBpZiAoZG9jSWRbMF0udG9Mb3dlckNhc2UoKSAhPT0gZG9jSWRbMF0pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgbGV0IHBhcnRzID0gZG9jSWQuc3BsaXQoJzsnKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gISFtaW1lLmV4dGVuc2lvbihwYXJ0c1swXSk7XG59O1xuRG9jdW1lbnRXcmFwcGVyLnBhcnNlID0gYXN5bmMgKHRleHQsIGV4dGVuc2lvbikgPT4ge1xuICBsZXQgY29udGVudHM7XG4gIGlmIChEQVRBTElCX0ZPUk1BVFMuaW5kZXhPZihleHRlbnNpb24pICE9PSAtMSkge1xuICAgIGNvbnRlbnRzID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gIH1cbiAgaWYgKCFjb250ZW50cy5jb250ZW50cykge1xuICAgIGNvbnRlbnRzID0geyBjb250ZW50czogY29udGVudHMgfTtcbiAgfVxuICByZXR1cm4gY29udGVudHM7XG59O1xuRG9jdW1lbnRXcmFwcGVyLmxhdW5jaFN0YW5kYXJkaXphdGlvbiA9IGFzeW5jICh7IG11cmUsIGRvYyB9KSA9PiB7XG4gIGxldCBleGlzdGluZ1VudGl0bGVkcyA9IGF3YWl0IG11cmUuZGIuYWxsRG9jcyh7XG4gICAgc3RhcnRrZXk6IGRvYy5taW1lVHlwZSArICc7VW50aXRsZWQgJyxcbiAgICBlbmRrZXk6IGRvYy5taW1lVHlwZSArICc7VW50aXRsZWQgXFx1ZmZmZidcbiAgfSk7XG4gIHJldHVybiBEb2N1bWVudFdyYXBwZXIuc3RhbmRhcmRpemUoe1xuICAgIG11cmUsXG4gICAgZG9jLFxuICAgIGV4aXN0aW5nVW50aXRsZWRzLFxuICAgIGFnZ3Jlc3NpdmU6IHRydWVcbiAgfSk7XG59O1xuRG9jdW1lbnRXcmFwcGVyLnN0YW5kYXJkaXplID0gKHtcbiAgbXVyZSxcbiAgZG9jLFxuICBleGlzdGluZ1VudGl0bGVkcyA9IHsgcm93czogW10gfSxcbiAgYWdncmVzc2l2ZVxufSkgPT4ge1xuICBpZiAoIWRvYy5faWQgfHwgIURvY3VtZW50V3JhcHBlci5pc1ZhbGlkSWQoZG9jLl9pZCkpIHtcbiAgICBpZiAoIWRvYy5taW1lVHlwZSAmJiAhZG9jLmZpbGVuYW1lKSB7XG4gICAgICAvLyBXaXRob3V0IGFuIGlkLCBmaWxlbmFtZSwgb3IgbWltZVR5cGUsIGp1c3QgYXNzdW1lIGl0J3MgYXBwbGljYXRpb24vanNvblxuICAgICAgZG9jLm1pbWVUeXBlID0gJ2FwcGxpY2F0aW9uL2pzb24nO1xuICAgIH1cbiAgICBpZiAoIWRvYy5maWxlbmFtZSkge1xuICAgICAgaWYgKGRvYy5faWQpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSBnaXZlbiBhbiBpbnZhbGlkIGlkOyB1c2UgaXQgYXMgdGhlIGZpbGVuYW1lIGluc3RlYWRcbiAgICAgICAgZG9jLmZpbGVuYW1lID0gZG9jLl9pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdpdGhvdXQgYW55dGhpbmcgdG8gZ28gb24sIHVzZSBcIlVudGl0bGVkIDFcIiwgZXRjXG4gICAgICAgIGxldCBtaW5JbmRleCA9IGV4aXN0aW5nVW50aXRsZWRzLnJvd3MucmVkdWNlKChtaW5JbmRleCwgdURvYykgPT4ge1xuICAgICAgICAgIGxldCBpbmRleCA9IC9VbnRpdGxlZCAoXFxkKykvZy5leGVjKHVEb2MuX2lkKTtcbiAgICAgICAgICBpbmRleCA9IGluZGV4ID8gaW5kZXhbMV0gfHwgSW5maW5pdHkgOiBJbmZpbml0eTtcbiAgICAgICAgICByZXR1cm4gaW5kZXggPCBtaW5JbmRleCA/IGluZGV4IDogbWluSW5kZXg7XG4gICAgICAgIH0sIEluZmluaXR5KTtcbiAgICAgICAgbWluSW5kZXggPSBpc0Zpbml0ZShtaW5JbmRleCkgPyBtaW5JbmRleCArIDEgOiAxO1xuICAgICAgICBkb2MuZmlsZW5hbWUgPSAnVW50aXRsZWQgJyArIG1pbkluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWRvYy5taW1lVHlwZSkge1xuICAgICAgLy8gV2Ugd2VyZSBnaXZlbiBhIGJpdCBvZiBpbmZvIHdpdGggdGhlIGZpbGVuYW1lIC8gYmFkIF9pZDtcbiAgICAgIC8vIHRyeSB0byBpbmZlciB0aGUgbWltZVR5cGUgZnJvbSB0aGF0IChhZ2FpbiB1c2UgYXBwbGljYXRpb24vanNvblxuICAgICAgLy8gaWYgdGhhdCBmYWlscylcbiAgICAgIGRvYy5taW1lVHlwZSA9IG1pbWUubG9va3VwKGRvYy5maWxlbmFtZSkgfHwgJ2FwcGxpY2F0aW9uL2pzb24nO1xuICAgIH1cbiAgICBkb2MubWltZVR5cGUgPSBkb2MubWltZVR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICBkb2MuX2lkID0gZG9jLm1pbWVUeXBlICsgJzsnICsgZG9jLmZpbGVuYW1lO1xuICB9XG4gIGlmIChkb2MuX2lkWzBdID09PSAnXycgfHwgZG9jLl9pZFswXSA9PT0gJyQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBfaWRzIG1heSBub3Qgc3RhcnQgd2l0aCAnICsgZG9jLl9pZFswXSArICc6ICcgKyBkb2MuX2lkKTtcbiAgfVxuICBkb2MubWltZVR5cGUgPSBkb2MubWltZVR5cGUgfHwgZG9jLl9pZC5zcGxpdCgnOycpWzBdO1xuICBpZiAoIW1pbWUuZXh0ZW5zaW9uKGRvYy5taW1lVHlwZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWltZVR5cGU6ICcgKyBkb2MubWltZVR5cGUpO1xuICB9XG4gIGRvYy5maWxlbmFtZSA9IGRvYy5maWxlbmFtZSB8fCBkb2MuX2lkLnNwbGl0KCc7JylbMV07XG4gIGRvYy5jaGFyc2V0ID0gKGRvYy5jaGFyc2V0IHx8ICdVVEYtOCcpLnRvVXBwZXJDYXNlKCk7XG5cbiAgZG9jLm9ycGhhbnMgPSBkb2Mub3JwaGFucyB8fCB7fTtcbiAgZG9jLm9ycGhhbnMuX2lkID0gJ0AkLm9ycGhhbnMnO1xuXG4gIGRvYy5jbGFzc2VzID0gZG9jLmNsYXNzZXMgfHwge307XG4gIGRvYy5jbGFzc2VzLl9pZCA9ICdAJC5jbGFzc2VzJztcblxuICBkb2MuY29udGVudHMgPSBkb2MuY29udGVudHMgfHwge307XG4gIC8vIEluIGNhc2UgZG9jLmNvbnRlbnRzIGlzIGFuIGFycmF5LCBwcmVwIGl0IGZvciBDb250YWluZXJXcmFwcGVyLnN0YW5kYXJkaXplXG4gIGRvYy5jb250ZW50cyA9IENvbnRhaW5lcldyYXBwZXIuY29udmVydEFycmF5KGRvYy5jb250ZW50cyk7XG4gIGRvYy5jb250ZW50cyA9IENvbnRhaW5lcldyYXBwZXIuc3RhbmRhcmRpemUoe1xuICAgIG11cmUsXG4gICAgdmFsdWU6IGRvYy5jb250ZW50cyxcbiAgICBwYXRoOiBbYHtcIl9pZFwiOlwiJHtkb2MuX2lkfVwifWAsICckJywgJ2NvbnRlbnRzJ10sXG4gICAgZG9jLFxuICAgIGFnZ3Jlc3NpdmVcbiAgfSk7XG5cbiAgcmV0dXJuIGRvYztcbn07XG5cbmV4cG9ydCBkZWZhdWx0IERvY3VtZW50V3JhcHBlcjtcbiIsImltcG9ydCBUeXBlZFdyYXBwZXIgZnJvbSAnLi9UeXBlZFdyYXBwZXIuanMnO1xuXG5jbGFzcyBQcmltaXRpdmVXcmFwcGVyIGV4dGVuZHMgVHlwZWRXcmFwcGVyIHtcbiAgc3RyaW5nVmFsdWUgKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy52YWx1ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJpbWl0aXZlV3JhcHBlcjtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgQmFzZVdyYXBwZXIgZnJvbSAnLi9CYXNlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEludmFsaWRXcmFwcGVyIGV4dGVuZHMgQmFzZVdyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBsZXQgcGFyZW50O1xuICAgIGlmIChwYXRoLmxlbmd0aCA8IDIpIHtcbiAgICAgIHBhcmVudCA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCA9PT0gMikge1xuICAgICAgcGFyZW50ID0gZG9jO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdGVtcCA9IGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEsIHBhdGgubGVuZ3RoIC0gMSkpO1xuICAgICAgcGFyZW50ID0ganNvblBhdGgudmFsdWUoZG9jLCB0ZW1wKTtcbiAgICB9XG4gICAgY29uc3QgZG9jUGF0aFF1ZXJ5ID0gcGF0aFswXSB8fCAnJztcbiAgICBjb25zdCB1bmlxdWVKc29uUGF0aCA9IGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEpKTtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgcGF0aCxcbiAgICAgIHZhbHVlLFxuICAgICAgcGFyZW50LFxuICAgICAgZG9jLFxuICAgICAgbGFiZWw6IHBhdGhbcGF0aC5sZW5ndGggLSAxXSxcbiAgICAgIHVuaXF1ZVNlbGVjdG9yOiAnQCcgKyBkb2NQYXRoUXVlcnkgKyB1bmlxdWVKc29uUGF0aFxuICAgIH0pO1xuICB9XG4gIHN0cmluZ1ZhbHVlICgpIHtcbiAgICByZXR1cm4gJ0ludmFsaWQ6ICcgKyBTdHJpbmcodGhpcy52YWx1ZSk7XG4gIH1cbn1cbkludmFsaWRXcmFwcGVyLkpTVFlQRSA9ICdvYmplY3QnO1xuSW52YWxpZFdyYXBwZXIuaXNCYWRWYWx1ZSA9IHZhbHVlID0+IHRydWU7XG5cbmV4cG9ydCBkZWZhdWx0IEludmFsaWRXcmFwcGVyO1xuIiwiaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9QcmltaXRpdmVXcmFwcGVyLmpzJztcblxuY2xhc3MgTnVsbFdyYXBwZXIgZXh0ZW5kcyBQcmltaXRpdmVXcmFwcGVyIHt9XG5OdWxsV3JhcHBlci5KU1RZUEUgPSAnbnVsbCc7XG5OdWxsV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4gbnVsbDtcbk51bGxXcmFwcGVyLnN0YW5kYXJkaXplID0gKCkgPT4gbnVsbDtcblxuZXhwb3J0IGRlZmF1bHQgTnVsbFdyYXBwZXI7XG4iLCJpbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBCb29sZWFuV3JhcHBlciBleHRlbmRzIFByaW1pdGl2ZVdyYXBwZXIge31cbkJvb2xlYW5XcmFwcGVyLkpTVFlQRSA9ICdib29sZWFuJztcbkJvb2xlYW5XcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiBmYWxzZTtcbkJvb2xlYW5XcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4gISF2YWx1ZTtcblxuZXhwb3J0IGRlZmF1bHQgQm9vbGVhbldyYXBwZXI7XG4iLCJpbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOdW1iZXJXcmFwcGVyIGV4dGVuZHMgUHJpbWl0aXZlV3JhcHBlciB7fVxuTnVtYmVyV3JhcHBlci5KU1RZUEUgPSAnbnVtYmVyJztcbk51bWJlcldyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IDA7XG5OdW1iZXJXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4gTnVtYmVyKHZhbHVlKTtcbk51bWJlcldyYXBwZXIuaXNCYWRWYWx1ZSA9IGlzTmFOO1xuXG5leHBvcnQgZGVmYXVsdCBOdW1iZXJXcmFwcGVyO1xuIiwiaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9QcmltaXRpdmVXcmFwcGVyLmpzJztcblxuY2xhc3MgU3RyaW5nV3JhcHBlciBleHRlbmRzIFByaW1pdGl2ZVdyYXBwZXIge31cblN0cmluZ1dyYXBwZXIuSlNUWVBFID0gJ3N0cmluZyc7XG5TdHJpbmdXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiAnJztcblN0cmluZ1dyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyB2YWx1ZSB9KSA9PiB7XG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICB9IGVsc2Uge1xuICAgIEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgU3RyaW5nV3JhcHBlcjtcbiIsImltcG9ydCBQcmltaXRpdmVXcmFwcGVyIGZyb20gJy4vUHJpbWl0aXZlV3JhcHBlci5qcyc7XG5cbmNsYXNzIERhdGVXcmFwcGVyIGV4dGVuZHMgUHJpbWl0aXZlV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIHN1cGVyKHsgbXVyZSwgdmFsdWU6IERhdGVXcmFwcGVyLnN0YW5kYXJkaXplKHZhbHVlKSwgcGF0aCwgZG9jIH0pO1xuICB9XG4gIGdldCB2YWx1ZSAoKSB7IHJldHVybiBuZXcgRGF0ZSh0aGlzLl92YWx1ZS5zdHIpOyB9XG4gIHNldCB2YWx1ZSAobmV3VmFsdWUpIHtcbiAgICBzdXBlci52YWx1ZSA9IERhdGVXcmFwcGVyLnN0YW5kYXJkaXplKG5ld1ZhbHVlKTtcbiAgfVxuICBzdHJpbmdWYWx1ZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLnZhbHVlKTtcbiAgfVxufVxuRGF0ZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IG5ldyBEYXRlKCk7XG5EYXRlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IHZhbHVlIH0pID0+IHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IG5ldyBEYXRlKHZhbHVlKTtcbiAgfVxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgdmFsdWUgPSB7XG4gICAgICAkaXNEYXRlOiB0cnVlLFxuICAgICAgc3RyOiB2YWx1ZS50b1N0cmluZygpXG4gICAgfTtcbiAgfVxuICBpZiAoIXZhbHVlLiRpc0RhdGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byB3cmFwIERhdGUgb2JqZWN0YCk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcbkRhdGVXcmFwcGVyLmlzQmFkVmFsdWUgPSB2YWx1ZSA9PiB2YWx1ZS50b1N0cmluZygpICE9PSAnSW52YWxpZCBEYXRlJztcblxuZXhwb3J0IGRlZmF1bHQgRGF0ZVdyYXBwZXI7XG4iLCJpbXBvcnQgU3RyaW5nV3JhcHBlciBmcm9tICcuL1N0cmluZ1dyYXBwZXIuanMnO1xuXG5jbGFzcyBSZWZlcmVuY2VXcmFwcGVyIGV4dGVuZHMgU3RyaW5nV3JhcHBlciB7fVxuUmVmZXJlbmNlV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4gJ0AkJztcblxuZXhwb3J0IGRlZmF1bHQgUmVmZXJlbmNlV3JhcHBlcjtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgQ29udGFpbmVyV3JhcHBlciBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIENvbnRhaW5lcldyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBzdXBlcih7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSk7XG4gICAgaWYgKCF2YWx1ZS4kdGFncykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR2VuZXJpY1dyYXBwZXIgcmVxdWlyZXMgYSAkdGFncyBvYmplY3RgKTtcbiAgICB9XG4gIH1cbiAgYWRkQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgIGlmICghdGhpcy5kb2MuY2xhc3Nlc1tjbGFzc05hbWVdKSB7XG4gICAgICB0aGlzLmRvYy5jbGFzc2VzW2NsYXNzTmFtZV0gPSB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlKCk7XG4gICAgICB0aGlzLmRvYy5jbGFzc2VzW2NsYXNzTmFtZV0uX2lkID0gJ0AnICsganNvblBhdGguc3RyaW5naWZ5KFsnJCcsICdjbGFzc2VzJywgY2xhc3NOYW1lXSk7XG4gICAgfVxuICAgIGNvbnN0IGNsYXNzSXRlbSA9IG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcih7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBwYXRoOiBbdGhpcy5wYXRoWzBdLCAnJCcsICdjbGFzc2VzJywgY2xhc3NOYW1lXSxcbiAgICAgIHZhbHVlOiB0aGlzLmRvYy5jbGFzc2VzW2NsYXNzTmFtZV0sXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gICAgY2xhc3NJdGVtLmFkZFdyYXBwZXIodGhpcyk7XG4gIH1cbiAgZ2V0Q2xhc3NlcyAoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlIHx8ICF0aGlzLnZhbHVlLiR0YWdzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnZhbHVlLiR0YWdzKS5yZWR1Y2UoKGFnZywgc2V0SWQpID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSB0aGlzLm11cmUuZXh0cmFjdENsYXNzSW5mb0Zyb21JZChzZXRJZCk7XG4gICAgICBpZiAodGVtcCkge1xuICAgICAgICBhZ2cucHVzaCh0ZW1wLmNsYXNzTmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKS5zb3J0KCk7XG4gIH1cbn1cbkdlbmVyaWNXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiB7XG4gIHJldHVybiB7ICR0YWdzOiB7fSB9O1xufTtcbkdlbmVyaWNXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KSA9PiB7XG4gIC8vIERvIHRoZSByZWd1bGFyIENvbnRhaW5lcldyYXBwZXIgc3RhbmRhcmRpemF0aW9uXG4gIHZhbHVlID0gQ29udGFpbmVyV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIEVuc3VyZSB0aGUgZXhpc3RlbmNlIG9mIGEgJHRhZ3Mgb2JqZWN0XG4gIHZhbHVlLiR0YWdzID0gdmFsdWUuJHRhZ3MgfHwge307XG4gIC8vIE1vdmUgYW55IGV4aXN0aW5nIGNsYXNzIGRlZmluaXRpb25zIHRvIHRoaXMgZG9jdW1lbnRcbiAgT2JqZWN0LmtleXModmFsdWUuJHRhZ3MpLmZvckVhY2goc2V0SWQgPT4ge1xuICAgIGNvbnN0IHRlbXAgPSBtdXJlLmV4dHJhY3RDbGFzc0luZm9Gcm9tSWQoc2V0SWQpO1xuICAgIGlmICh0ZW1wKSB7XG4gICAgICBkZWxldGUgdmFsdWUuJHRhZ3Nbc2V0SWRdO1xuXG4gICAgICBzZXRJZCA9IGRvYy5jbGFzc2VzLl9pZCArIHRlbXAuY2xhc3NQYXRoQ2h1bms7XG4gICAgICB2YWx1ZS4kdGFnc1tzZXRJZF0gPSB0cnVlO1xuXG4gICAgICBkb2MuY2xhc3Nlc1t0ZW1wLmNsYXNzTmFtZV0gPSBkb2MuY2xhc3Nlc1t0ZW1wLmNsYXNzTmFtZV0gfHwgeyBfaWQ6IHNldElkLCAkbWVtYmVyczoge30gfTtcbiAgICAgIGRvYy5jbGFzc2VzW3RlbXAuY2xhc3NOYW1lXS4kbWVtYmVyc1t2YWx1ZS5faWRdID0gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImV4cG9ydCBkZWZhdWx0IChzdXBlcmNsYXNzKSA9PiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBzdXBlcih7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSk7XG4gICAgaWYgKCF2YWx1ZS4kbWVtYmVycykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgU2V0V3JhcHBlciByZXF1aXJlcyBhICRtZW1iZXJzIG9iamVjdGApO1xuICAgIH1cbiAgfVxuICBhZGRXcmFwcGVyIChpdGVtKSB7XG4gICAgY29uc3QgaXRlbVRhZyA9IGl0ZW0udmFsdWUuX2lkO1xuICAgIGNvbnN0IHNldFRhZyA9IHRoaXMudmFsdWUuX2lkO1xuICAgIHRoaXMudmFsdWUuJG1lbWJlcnNbaXRlbVRhZ10gPSB0cnVlO1xuICAgIGl0ZW0udmFsdWUuJHRhZ3Nbc2V0VGFnXSA9IHRydWU7XG4gIH1cbiAgZ2V0TWVtYmVyU2VsZWN0b3JzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy52YWx1ZS4kbWVtYmVycyk7XG4gIH1cbiAgYXN5bmMgZ2V0TWVtYmVycyAoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5zZWxlY3RBbGwodGhpcy5nZXRNZW1iZXJTZWxlY3RvcnMoKSkuaXRlbXMoKTtcbiAgfVxufTtcbiIsImltcG9ydCBUeXBlZFdyYXBwZXIgZnJvbSAnLi9UeXBlZFdyYXBwZXIuanMnO1xuaW1wb3J0IFNldFdyYXBwZXJNaXhpbiBmcm9tICcuL1NldFdyYXBwZXJNaXhpbi5qcyc7XG5cbmNsYXNzIFNldFdyYXBwZXIgZXh0ZW5kcyBTZXRXcmFwcGVyTWl4aW4oVHlwZWRXcmFwcGVyKSB7fVxuU2V0V3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkbWVtYmVyczoge30gfTtcbn07XG5TZXRXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4ge1xuICAvLyBFbnN1cmUgdGhlIGV4aXN0ZW5jZSBvZiBhICRtZW1iZXJzIG9iamVjdFxuICB2YWx1ZS4kbWVtYmVycyA9IHZhbHVlLiRtZW1iZXJzIHx8IHt9O1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTZXRXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgc3VwZXIoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pO1xuICAgIGlmICghdmFsdWUuJG5vZGVzKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBFZGdlV3JhcHBlciByZXF1aXJlcyBhICRub2RlcyBvYmplY3RgKTtcbiAgICB9XG4gIH1cbiAgYXR0YWNoVG8gKG5vZGUsIGRpcmVjdGlvbiA9ICd1bmRpcmVjdGVkJykge1xuICAgIG5vZGUudmFsdWUuJGVkZ2VzW3RoaXMudW5pcXVlU2VsZWN0b3JdID0gdHJ1ZTtcbiAgICBsZXQgbm9kZUlkID0gbm9kZS51bmlxdWVTZWxlY3RvcjtcbiAgICB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdID0gdGhpcy52YWx1ZS4kbm9kZXNbbm9kZUlkXSB8fCB7fTtcbiAgICB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdW2RpcmVjdGlvbl0gPSB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdW2RpcmVjdGlvbl0gfHwgMDtcbiAgICB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdW2RpcmVjdGlvbl0gKz0gMTtcbiAgfVxuICBhc3luYyBub2RlU2VsZWN0b3JzIChkaXJlY3Rpb24gPSBudWxsKSB7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHRoaXMudmFsdWUuJG5vZGVzKVxuICAgICAgLmZpbHRlcigoW3NlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4ge1xuICAgICAgICAvLyBudWxsIGluZGljYXRlcyB0aGF0IHdlIGFsbG93IGFsbCBtb3ZlbWVudFxuICAgICAgICByZXR1cm4gZGlyZWN0aW9uID09PSBudWxsIHx8IGRpcmVjdGlvbnNbZGlyZWN0aW9uXTtcbiAgICAgIH0pLm1hcCgoW3NlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4gc2VsZWN0b3IpO1xuICB9XG4gIGFzeW5jIG5vZGVXcmFwcGVycyAoZm9yd2FyZCA9IG51bGwpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnNlbGVjdEFsbCgoYXdhaXQgdGhpcy5ub2RlU2VsZWN0b3JzKGZvcndhcmQpKSkuaXRlbXMoKTtcbiAgfVxuICBhc3luYyBub2RlV3JhcHBlckNvdW50IChmb3J3YXJkID0gbnVsbCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5ub2RlU2VsZWN0b3JzKGZvcndhcmQpKS5sZW5ndGg7XG4gIH1cbn1cbkVkZ2VXcmFwcGVyLm9wcG9zaXRlRGlyZWN0aW9uID0gZGlyZWN0aW9uID0+IHtcbiAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScgPyAndGFyZ2V0J1xuICAgIDogZGlyZWN0aW9uID09PSAndGFyZ2V0JyA/ICdzb3VyY2UnXG4gICAgICA6ICd1bmRpcmVjdGVkJztcbn07XG5FZGdlV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkdGFnczoge30sICRub2Rlczoge30gfTtcbn07XG5FZGdlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBEbyB0aGUgcmVndWxhciBHZW5lcmljV3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBHZW5lcmljV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIEVuc3VyZSB0aGUgZXhpc3RlbmNlIG9mIGEgJG5vZGVzIG9iamVjdFxuICB2YWx1ZS4kbm9kZXMgPSB2YWx1ZS4kbm9kZXMgfHwge307XG4gIHJldHVybiB2YWx1ZTtcbn07XG5FZGdlV3JhcHBlci5nbG9tcFZhbHVlID0gZWRnZUxpc3QgPT4ge1xuICBsZXQgdGVtcCA9IEdlbmVyaWNXcmFwcGVyLmdsb21wKGVkZ2VMaXN0KTtcbiAgdGVtcC52YWx1ZS4kbm9kZXMgPSB7fTtcbiAgZWRnZUxpc3QuZm9yRWFjaChlZGdlV3JhcHBlciA9PiB7XG4gICAgT2JqZWN0LmVudHJpZXMoZWRnZVdyYXBwZXIudmFsdWUuJG5vZGVzKS5mb3JFYWNoKChbc2VsZWN0b3IsIGRpcmVjdGlvbnNdKSA9PiB7XG4gICAgICB0ZW1wLiRub2Rlc1tzZWxlY3Rvcl0gPSB0ZW1wLnZhbHVlLiRub2Rlc1tzZWxlY3Rvcl0gfHwge307XG4gICAgICBPYmplY3Qua2V5cyhkaXJlY3Rpb25zKS5mb3JFYWNoKGRpcmVjdGlvbiA9PiB7XG4gICAgICAgIHRlbXAudmFsdWUuJG5vZGVzW3NlbGVjdG9yXVtkaXJlY3Rpb25dID0gdGVtcC52YWx1ZS4kbm9kZXNbc2VsZWN0b3JdW2RpcmVjdGlvbl0gfHwgMDtcbiAgICAgICAgdGVtcC52YWx1ZS4kbm9kZXNbc2VsZWN0b3JdW2RpcmVjdGlvbl0gKz0gZGlyZWN0aW9uc1tkaXJlY3Rpb25dO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gdGVtcDtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4vRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgc3VwZXIoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pO1xuICAgIGlmICghdmFsdWUuJGVkZ2VzKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBOb2RlV3JhcHBlciByZXF1aXJlcyBhbiAkZWRnZXMgb2JqZWN0YCk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RUbyAob3RoZXJOb2RlLCBjb250YWluZXIsIGRpcmVjdGlvbiA9ICd1bmRpcmVjdGVkJykge1xuICAgIGxldCBuZXdFZGdlID0gY29udGFpbmVyLmNyZWF0ZU5ld1dyYXBwZXIoe30sIHVuZGVmaW5lZCwgRWRnZVdyYXBwZXIpO1xuICAgIG5ld0VkZ2UuYXR0YWNoVG8odGhpcywgZGlyZWN0aW9uKTtcbiAgICBuZXdFZGdlLmF0dGFjaFRvKG90aGVyTm9kZSwgRWRnZVdyYXBwZXIub3Bwb3NpdGVEaXJlY3Rpb24oZGlyZWN0aW9uKSk7XG4gICAgcmV0dXJuIG5ld0VkZ2U7XG4gIH1cbiAgYXN5bmMgZWRnZVNlbGVjdG9ycyAoZGlyZWN0aW9uID0gbnVsbCkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnZhbHVlLiRlZGdlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAoYXdhaXQgdGhpcy5lZGdlV3JhcHBlcnMoZGlyZWN0aW9uKSkubWFwKGl0ZW0gPT4gaXRlbS51bmlxdWVTZWxlY3Rvcik7XG4gICAgfVxuICB9XG4gIGFzeW5jIGVkZ2VXcmFwcGVycyAoZGlyZWN0aW9uID0gbnVsbCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5tdXJlLnNlbGVjdEFsbChPYmplY3Qua2V5cyh0aGlzLnZhbHVlLiRlZ2RlcykpKS5pdGVtcygpXG4gICAgICAuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgICAvLyBudWxsIGluZGljYXRlcyB0aGF0IHdlIGFsbG93IGFsbCBlZGdlcy4gSWYgZGlyZWN0aW9uIGlzbid0IG51bGwsXG4gICAgICAgIC8vIG9ubHkgaW5jbHVkZSBlZGdlcyB3aGVyZSB3ZSBhcmUgdGhlIE9QUE9TSVRFIGRpcmVjdGlvbiAod2UgYXJlXG4gICAgICAgIC8vIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHRyYXZlcnNhbClcbiAgICAgICAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gbnVsbCB8fFxuICAgICAgICAgIGl0ZW0uJG5vZGVzW3RoaXMudW5pcXVlU2VsZWN0b3JdW0VkZ2VXcmFwcGVyLm9wcG9zaXRlRGlyZWN0aW9uKGRpcmVjdGlvbildO1xuICAgICAgfSk7XG4gIH1cbiAgYXN5bmMgZWRnZVdyYXBwZXJDb3VudCAoZm9yd2FyZCA9IG51bGwpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuZWRnZVNlbGVjdG9ycyhmb3J3YXJkKSkubGVuZ3RoO1xuICB9XG59XG5Ob2RlV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkdGFnczoge30sICRlZGdlczoge30gfTtcbn07XG5Ob2RlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBEbyB0aGUgcmVndWxhciBHZW5lcmljV3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBHZW5lcmljV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIEVuc3VyZSB0aGUgZXhpc3RlbmNlIG9mIGFuICRlZGdlcyBvYmplY3RcbiAgdmFsdWUuJGVkZ2VzID0gdmFsdWUuJGVkZ2VzIHx8IHt9O1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBTZXRXcmFwcGVyIGZyb20gJy4vU2V0V3JhcHBlci5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi9Ob2RlV3JhcHBlci5qcyc7XG5pbXBvcnQgU2V0V3JhcHBlck1peGluIGZyb20gJy4vU2V0V3JhcHBlck1peGluLmpzJztcblxuY2xhc3MgU3VwZXJub2RlV3JhcHBlciBleHRlbmRzIFNldFdyYXBwZXJNaXhpbihOb2RlV3JhcHBlcikge31cblN1cGVybm9kZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgcmV0dXJuIHsgJHRhZ3M6IHt9LCAkbWVtYmVyczoge30sICRlZGdlczoge30gfTtcbn07XG5TdXBlcm5vZGVXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KSA9PiB7XG4gIC8vIERvIHRoZSByZWd1bGFyIE5vZGVXcmFwcGVyIHN0YW5kYXJkaXphdGlvblxuICB2YWx1ZSA9IE5vZGVXcmFwcGVyLnN0YW5kYXJkaXplKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KTtcbiAgLy8gLi4uIGFuZCB0aGUgU2V0V3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBTZXRXcmFwcGVyLnN0YW5kYXJkaXplKHsgdmFsdWUgfSk7XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IFN1cGVybm9kZVdyYXBwZXI7XG4iLCJjbGFzcyBJbnB1dFNwZWMge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgdGhpcy5vcHRpb25zID0ge307XG4gIH1cbiAgYWRkT3B0aW9uIChvcHRpb24pIHtcbiAgICB0aGlzLm9wdGlvbnNbb3B0aW9uLnBhcmFtZXRlck5hbWVdID0gb3B0aW9uO1xuICB9XG4gIGFzeW5jIHVwZGF0ZUNob2ljZXMgKHBhcmFtcykge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKHRoaXMub3B0aW9ucykubWFwKG9wdGlvbiA9PiB7XG4gICAgICBpZiAob3B0aW9uLnNwZWNzKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKG9wdGlvbi5zcGVjcylcbiAgICAgICAgICAubWFwKHNwZWMgPT4gc3BlYy51cGRhdGVDaG9pY2VzKHBhcmFtcykpKTtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9uLnVwZGF0ZUNob2ljZXMpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbi51cGRhdGVDaG9pY2VzKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfSkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IElucHV0U3BlYztcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi8uLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBJbnB1dE9wdGlvbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBwYXJhbWV0ZXJOYW1lLFxuICAgIGRlZmF1bHRWYWx1ZSA9IG51bGwsXG4gICAgY2hvaWNlcyA9IFtdLFxuICAgIG9wZW5FbmRlZCA9IGZhbHNlXG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMucGFyYW1ldGVyTmFtZSA9IHBhcmFtZXRlck5hbWU7XG4gICAgdGhpcy5fZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlO1xuICAgIHRoaXMuY2hvaWNlcyA9IGNob2ljZXM7XG4gICAgdGhpcy5vcGVuRW5kZWQgPSBvcGVuRW5kZWQ7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVQYXJhbWV0ZXJOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJOYW1lXG4gICAgICAucmVwbGFjZSgvLi8sIHRoaXMucGFyYW1ldGVyTmFtZVswXS50b0xvY2FsZVVwcGVyQ2FzZSgpKVxuICAgICAgLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG4gIGdldCBkZWZhdWx0VmFsdWUgKCkge1xuICAgIGlmICh0aGlzLl9kZWZhdWx0VmFsdWUgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0VmFsdWU7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNob2ljZXMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hvaWNlc1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIHNldCBkZWZhdWx0VmFsdWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fZGVmYXVsdFZhbHVlID0gdmFsdWU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnB1dE9wdGlvbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopT3B0aW9uLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW5wdXRPcHRpb247XG4iLCJjbGFzcyBPdXRwdXRTcGVjIHtcbiAgY29uc3RydWN0b3IgKHsgbmV3U2VsZWN0b3JzID0gbnVsbCwgcG9sbHV0ZWREb2NzID0ge30sIHdhcm5pbmdzID0ge30gfSA9IHt9KSB7XG4gICAgdGhpcy5uZXdTZWxlY3RvcnMgPSBuZXdTZWxlY3RvcnM7XG4gICAgdGhpcy5wb2xsdXRlZERvY3MgPSBwb2xsdXRlZERvY3M7XG4gICAgdGhpcy53YXJuaW5ncyA9IHdhcm5pbmdzO1xuICB9XG4gIGFkZFNlbGVjdG9ycyAoc2VsZWN0b3JzKSB7XG4gICAgdGhpcy5uZXdTZWxlY3RvcnMgPSAodGhpcy5uZXdTZWxlY3RvcnMgfHwgW10pLmNvbmNhdChzZWxlY3RvcnMpO1xuICB9XG4gIGZsYWdQb2xsdXRlZERvYyAoZG9jKSB7XG4gICAgdGhpcy5wb2xsdXRlZERvY3NbZG9jLl9pZF0gPSBkb2M7XG4gIH1cbiAgd2FybiAod2FybmluZykge1xuICAgIHRoaXMud2FybmluZ3Nbd2FybmluZ10gPSB0aGlzLndhcm5pbmdzW3dhcm5pbmddIHx8IDA7XG4gICAgdGhpcy53YXJuaW5nc1t3YXJuaW5nXSArPSAxO1xuICB9XG59XG5PdXRwdXRTcGVjLmdsb21wID0gc3BlY0xpc3QgPT4ge1xuICBsZXQgbmV3U2VsZWN0b3JzID0ge307XG4gIGxldCBwb2xsdXRlZERvY3MgPSB7fTtcbiAgbGV0IHdhcm5pbmdzID0ge307XG4gIHNwZWNMaXN0LmZvckVhY2goc3BlYyA9PiB7XG4gICAgaWYgKHNwZWMubmV3U2VsZWN0b3JzKSB7XG4gICAgICBzcGVjLm5ld1NlbGVjdG9ycy5mb3JFYWNoKHNlbGVjdG9yID0+IHtcbiAgICAgICAgbmV3U2VsZWN0b3JzW3NlbGVjdG9yXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhzcGVjLnBvbGx1dGVkRG9jcykuZm9yRWFjaChkb2MgPT4ge1xuICAgICAgcG9sbHV0ZWREb2NzW2RvYy5faWRdID0gZG9jO1xuICAgIH0pO1xuICAgIE9iamVjdC5lbnRyaWVzKHNwZWMud2FybmluZ3MpLmZvckVhY2goKFt3YXJuaW5nLCBjb3VudF0pID0+IHtcbiAgICAgIHdhcm5pbmdzW3dhcm5pbmddID0gd2FybmluZ3Nbd2FybmluZ10gfHwgMDtcbiAgICAgIHdhcm5pbmdzW3dhcm5pbmddICs9IGNvdW50O1xuICAgIH0pO1xuICB9KTtcbiAgbmV3U2VsZWN0b3JzID0gT2JqZWN0LmtleXMobmV3U2VsZWN0b3JzKTtcbiAgcmV0dXJuIG5ldyBPdXRwdXRTcGVjKHtcbiAgICBuZXdTZWxlY3RvcnM6IG5ld1NlbGVjdG9ycy5sZW5ndGggPiAwID8gbmV3U2VsZWN0b3JzIDogbnVsbCxcbiAgICBwb2xsdXRlZERvY3MsXG4gICAgd2FybmluZ3NcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBPdXRwdXRTcGVjO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uLy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgSW5wdXRTcGVjIGZyb20gJy4vSW5wdXRTcGVjLmpzJztcbmltcG9ydCBJbnB1dE9wdGlvbiBmcm9tICcuL0lucHV0T3B0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vT3V0cHV0U3BlYy5qcyc7XG5cbmNsYXNzIEJhc2VPcGVyYXRpb24gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICB9XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IElucHV0U3BlYygpO1xuICAgIHJlc3VsdC5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdpZ25vcmVFcnJvcnMnLFxuICAgICAgY2hvaWNlczogWydTdG9wIG9uIEVycm9yJywgJ0lnbm9yZSddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnU3RvcCBvbiBFcnJvcidcbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBwb3RlbnRpYWxseUV4ZWN1dGFibGVPbkl0ZW0gKGl0ZW0pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgcmV0dXJuIGl0ZW0gJiYgaW5wdXRPcHRpb25zLmlnbm9yZUVycm9ycyAhPT0gJ1N0b3Agb24gRXJyb3InO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgfVxuICBnZXRJdGVtc0luVXNlIChpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBpdGVtc0luVXNlID0ge307XG4gICAgT2JqZWN0LnZhbHVlcyhpbnB1dE9wdGlvbnMpLmZvckVhY2goYXJndW1lbnQgPT4ge1xuICAgICAgaWYgKGFyZ3VtZW50ICYmIGFyZ3VtZW50LnVuaXF1ZVNlbGVjdG9yKSB7XG4gICAgICAgIGl0ZW1zSW5Vc2VbYXJndW1lbnQudW5pcXVlU2VsZWN0b3JdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gaXRlbXNJblVzZTtcbiAgfVxuICBhc3luYyBwb3RlbnRpYWxseUV4ZWN1dGFibGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uKSB7XG4gICAgY29uc3QgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhpdGVtcykuc29tZShpdGVtID0+IHRoaXMucG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtKGl0ZW0pKTtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3QgaXRlbXNJblVzZSA9IHRoaXMuZ2V0SXRlbXNJblVzZShpbnB1dE9wdGlvbnMpO1xuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgY29uc3QgY2FuRXhlY3V0ZUluc3RhbmNlcyA9IChhd2FpdCBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKGl0ZW1zKVxuICAgICAgLm1hcChpdGVtID0+IHtcbiAgICAgICAgcmV0dXJuIGl0ZW1zSW5Vc2VbaXRlbS51bmlxdWVTZWxlY3Rvcl0gfHwgdGhpcy5jYW5FeGVjdXRlT25JbnN0YW5jZShpdGVtLCBpbnB1dE9wdGlvbnMpO1xuICAgICAgfSkpKTtcbiAgICBpZiAoY2FuRXhlY3V0ZUluc3RhbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGlmIChpbnB1dE9wdGlvbnMuaWdub3JlRXJyb3JzID09PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgIHJldHVybiBjYW5FeGVjdXRlSW5zdGFuY2VzLmV2ZXJ5KGNhbkV4ZWN1dGUgPT4gY2FuRXhlY3V0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjYW5FeGVjdXRlSW5zdGFuY2VzLnNvbWUoY2FuRXhlY3V0ZSA9PiBjYW5FeGVjdXRlKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IGl0ZW1zSW5Vc2UgPSB0aGlzLmdldEl0ZW1zSW5Vc2UoaW5wdXRPcHRpb25zKTtcbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgIGNvbnN0IG91dHB1dFNwZWNQcm9taXNlcyA9IE9iamVjdC52YWx1ZXMoaXRlbXMpLm1hcChpdGVtID0+IHtcbiAgICAgIGlmIChpdGVtc0luVXNlW2l0ZW0udW5pcXVlU2VsZWN0b3JdKSB7XG4gICAgICAgIHJldHVybiBuZXcgT3V0cHV0U3BlYygpOyAvLyBJZ25vcmUgaXRlbXMgdGhhdCBhcmUgaW5wdXRPcHRpb25zXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5leGVjdXRlT25JbnN0YW5jZShpdGVtLCBpbnB1dE9wdGlvbnMpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBPdXRwdXRTcGVjLmdsb21wKGF3YWl0IFByb21pc2UuYWxsKG91dHB1dFNwZWNQcm9taXNlcykpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZU9wZXJhdGlvbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopT3BlcmF0aW9uLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBCYXNlT3BlcmF0aW9uO1xuIiwiaW1wb3J0IElucHV0U3BlYyBmcm9tICcuL0lucHV0U3BlYy5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNsYXNzIENvbnRleHR1YWxPcHRpb24gZXh0ZW5kcyBJbnB1dE9wdGlvbiB7XG4gIGNvbnN0cnVjdG9yICh7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcyA9IFtdLCBoaWRkZW5DaG9pY2VzID0gW10gfSkge1xuICAgIGlmIChjaG9pY2VzLmxlbmd0aCA8IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ29udGV4dHVhbCBvcHRpb25zIG11c3Qgc3BlY2lmeSBhdCBsZWFzdCB0d28gY2hvaWNlcyBhIHByaW9yaScpO1xuICAgIH1cbiAgICBzdXBlcih7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcywgb3BlbkVuZGVkOiBmYWxzZSB9KTtcbiAgICB0aGlzLnNwZWNzID0ge307XG4gICAgY2hvaWNlcy5jb25jYXQoaGlkZGVuQ2hvaWNlcykuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgdGhpcy5zcGVjc1tjaG9pY2VdID0gbmV3IElucHV0U3BlYygpO1xuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb250ZXh0dWFsT3B0aW9uO1xuIiwiaW1wb3J0IFNlbGVjdGlvbiBmcm9tICcuLi9TZWxlY3Rpb24uanMnO1xuaW1wb3J0IEJhc2VPcGVyYXRpb24gZnJvbSAnLi9Db21tb24vQmFzZU9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgT3V0cHV0U3BlYyBmcm9tICcuL0NvbW1vbi9PdXRwdXRTcGVjLmpzJztcbmltcG9ydCBDb250ZXh0dWFsT3B0aW9uIGZyb20gJy4vQ29tbW9uL0NvbnRleHR1YWxPcHRpb24uanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vQ29tbW9uL0lucHV0T3B0aW9uLmpzJztcblxuY2xhc3MgU2VsZWN0QWxsT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnQ2hpbGRyZW4nLCAnUGFyZW50cycsICdOb2RlcycsICdFZGdlcycsICdNZW1iZXJzJ10sXG4gICAgICBoaWRkZW5DaG9pY2VzOiBbJ1NlbGVjdG9yJywgJ1NlbGVjdG9yIExpc3QnLCAnU2VsZWN0aW9uJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdDaGlsZHJlbidcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKGNvbnRleHQpO1xuXG4gICAgY29uc3QgZGlyZWN0aW9uID0gbmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdkaXJlY3Rpb24nLFxuICAgICAgY2hvaWNlczogWydJZ25vcmUnLCAnRm9yd2FyZCcsICdCYWNrd2FyZCddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnSWdub3JlJ1xuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ05vZGVzJ10uYWRkT3B0aW9uKGRpcmVjdGlvbik7XG4gICAgY29udGV4dC5zcGVjc1snRWRnZXMnXS5hZGRPcHRpb24oZGlyZWN0aW9uKTtcblxuICAgIC8vIEV4dHJhIHNldHRpbmdzIGZvciBoaWRkZW4gbW9kZXM6XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3InXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdhcHBlbmQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnWypdJyxcbiAgICAgIG9wZW5FbmRlZDogdHJ1ZVxuICAgIH0pKTtcbiAgICBjb250ZXh0LnNwZWNzWydTZWxlY3RvciBMaXN0J10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbXRlck5hbWU6ICdzZWxlY3Rvckxpc3QnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBbXVxuICAgIH0pKTtcbiAgICBjb250ZXh0LnNwZWNzWydTZWxlY3Rpb24nXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdvdGhlclNlbGVjdGlvbidcbiAgICB9KSk7XG5cbiAgICBjb25zdCBtb2RlID0gbmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdtb2RlJyxcbiAgICAgIGNob2ljZXM6IFsnUmVwbGFjZScsICdVbmlvbicsICdYT1InXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1JlcGxhY2UnXG4gICAgfSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3InXS5hZGRPcHRpb24obW9kZSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3IgTGlzdCddLmFkZE9wdGlvbihtb2RlKTtcbiAgICBjb250ZXh0LnNwZWNzWydTZWxlY3Rpb24nXS5hZGRPcHRpb24obW9kZSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoYXdhaXQgc3VwZXIuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0NoaWxkcmVuJykge1xuICAgICAgcmV0dXJuIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnUGFyZW50cycpIHtcbiAgICAgIHJldHVybiAhKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdOb2RlcycpIHtcbiAgICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0VkZ2VzJykge1xuICAgICAgcmV0dXJuIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIgfHxcbiAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnTWVtYmVycycpIHtcbiAgICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdTZWxlY3RvcicpIHtcbiAgICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihpdGVtLnVuaXF1ZVNlbGVjdG9yICsgaW5wdXRPcHRpb25zLmFwcGVuZCkgIT09IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgY29uc3QgZGlyZWN0aW9uID0gaW5wdXRPcHRpb25zLmRpcmVjdGlvbiB8fCAnSWdub3JlJztcbiAgICBjb25zdCBmb3J3YXJkID0gZGlyZWN0aW9uID09PSAnRm9yd2FyZCcgPyB0cnVlXG4gICAgICA6IGRpcmVjdGlvbiA9PT0gJ0JhY2t3YXJkJyA/IGZhbHNlXG4gICAgICAgIDogbnVsbDtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdDaGlsZHJlbicgJiZcbiAgICAgICAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyKSkge1xuICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhPYmplY3QudmFsdWVzKGl0ZW0uZ2V0Q29udGVudHMoKSlcbiAgICAgICAgLm1hcChjaGlsZFdyYXBwZXIgPT4gY2hpbGRXcmFwcGVyLnVuaXF1ZVNlbGVjdG9yKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1BhcmVudHMnICYmXG4gICAgICAgICAgICAgIShpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlciB8fFxuICAgICAgICAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Sb290V3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoW2l0ZW0ucGFyZW50V3JhcHBlci51bmlxdWVTZWxlY3Rvcl0pO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdOb2RlcycgJiZcbiAgICAgICAgICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoYXdhaXQgaXRlbS5ub2RlU2VsZWN0b3JzKGZvcndhcmQpKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnTm9kZXMnICYmXG4gICAgICAgICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKGF3YWl0IFByb21pc2UuYWxsKChhd2FpdCBpdGVtLmVkZ2VXcmFwcGVycyhmb3J3YXJkKSlcbiAgICAgICAgLm1hcChlZGdlID0+IGVkZ2Uubm9kZVNlbGVjdG9ycyhmb3J3YXJkKSkpKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnRWRnZXMnICYmXG4gICAgICAgICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKGF3YWl0IGl0ZW0uZWRnZVNlbGVjdG9ycyhmb3J3YXJkKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0VkZ2VzJyAmJlxuICAgICAgICAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcikge1xuICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhhd2FpdCBQcm9taXNlLmFsbCgoYXdhaXQgaXRlbS5ub2RlV3JhcHBlcnMoZm9yd2FyZCkpXG4gICAgICAgIC5tYXAobm9kZSA9PiBub2RlLmVkZ2VTZWxlY3RvcnMoZm9yd2FyZCkpKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ01lbWJlcnMnICYmXG4gICAgICAgICAgICAgIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoYXdhaXQgaXRlbS5nZXRNZW1iZXJTZWxlY3RvcnMoKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1NlbGVjdG9yJykge1xuICAgICAgY29uc3QgbmV3U3RyaW5nID0gaXRlbS51bmlxdWVTZWxlY3RvciArIGlucHV0T3B0aW9ucy5hcHBlbmQ7XG4gICAgICBjb25zdCBuZXdTZWxlY3RvciA9IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKG5ld1N0cmluZyk7XG4gICAgICBpZiAobmV3U2VsZWN0b3IgPT09IG51bGwpIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYEludmFsaWQgc2VsZWN0b3I6ICR7bmV3U3RyaW5nfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhbbmV3U3RyaW5nXSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC53YXJuKGBDYW4ndCBzZWxlY3QgJHtpbnB1dE9wdGlvbnMuY29udGV4dH0gZnJvbSAke2l0ZW0udHlwZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnU2VsZWN0b3IgTGlzdCcpIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuc2VsZWN0b3JMaXN0IGluc3RhbmNlb2YgQXJyYXk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1NlbGVjdGlvbicpIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMub3RoZXJTZWxlY3Rpb24gaW5zdGFuY2VvZiBTZWxlY3Rpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5FeGVjdXRlT25TZWxlY3Rpb24oc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgbGV0IG90aGVyU2VsZWN0b3JMaXN0ID0gaW5wdXRPcHRpb25zLnNlbGVjdG9yTGlzdCB8fFxuICAgICAgKGlucHV0T3B0aW9ucy5vdGhlclNlbGVjdGlvbiAmJiBpbnB1dE9wdGlvbnMub3RoZXJTZWxlY3Rpb24uc2VsZWN0b3JMaXN0KTtcbiAgICBpZiAob3RoZXJTZWxlY3Rvckxpc3QpIHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdVbmlvbicpIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhzZWxlY3Rpb24uc2VsZWN0b3JMaXN0LmNvbmNhdChvdGhlclNlbGVjdG9yTGlzdCkpO1xuICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ1hPUicpIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhvdGhlclNlbGVjdG9yTGlzdFxuICAgICAgICAgIC5maWx0ZXIoc2VsZWN0b3IgPT4gc2VsZWN0aW9uLnNlbGVjdG9yTGlzdC5pbmRleE9mKHNlbGVjdG9yKSA9PT0gLTEpXG4gICAgICAgICAgLmNvbmNhdChzZWxlY3Rpb24uc2VsZWN0b3JMaXN0XG4gICAgICAgICAgICAuZmlsdGVyKHNlbGVjdG9yID0+IG90aGVyU2VsZWN0b3JMaXN0LmluZGV4T2Yoc2VsZWN0b3IpID09PSAtMSkpKTtcbiAgICAgIH0gZWxzZSB7IC8vIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ1JlcGxhY2UnKSB7XG4gICAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMob3RoZXJTZWxlY3Rvckxpc3QpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHN1cGVyLmV4ZWN1dGVPblNlbGVjdGlvbihzZWxlY3Rpb24sIGlucHV0T3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlbGVjdEFsbE9wZXJhdGlvbjtcbiIsImltcG9ydCBJbnB1dE9wdGlvbiBmcm9tICcuL0lucHV0T3B0aW9uLmpzJztcblxuY2xhc3MgU3RyaW5nT3B0aW9uIGV4dGVuZHMgSW5wdXRPcHRpb24ge1xuICBwb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyAoY2hvaWNlRGljdCkge1xuICAgIHRoaXMuY2hvaWNlcy5mb3JFYWNoKGNob2ljZSA9PiB7XG4gICAgICBpZiAoY2hvaWNlICE9PSBudWxsKSB7XG4gICAgICAgIGNob2ljZURpY3RbY2hvaWNlXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ09wdGlvbjtcbiIsImltcG9ydCBTdHJpbmdPcHRpb24gZnJvbSAnLi9TdHJpbmdPcHRpb24uanMnO1xuXG5jbGFzcyBDbGFzc09wdGlvbiBleHRlbmRzIFN0cmluZ09wdGlvbiB7XG4gIGFzeW5jIHVwZGF0ZUNob2ljZXMgKHsgaXRlbXMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGxldCBjbGFzc2VzID0ge307XG4gICAgaWYgKCFyZXNldCkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyhjbGFzc2VzKTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhpdGVtcykubWFwKGl0ZW0gPT4ge1xuICAgICAgcmV0dXJuIGl0ZW0uZ2V0Q2xhc3NlcyA/IGl0ZW0uZ2V0Q2xhc3NlcygpIDogW107XG4gICAgfSkuZm9yRWFjaChjbGFzc0xpc3QgPT4ge1xuICAgICAgY2xhc3NMaXN0LmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgY2xhc3Nlc1tjbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHRoaXMuY2hvaWNlcyA9IE9iamVjdC5rZXlzKGNsYXNzZXMpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDbGFzc09wdGlvbjtcbiIsImltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBDbGFzc09wdGlvbiBmcm9tICcuL0NvbW1vbi9DbGFzc09wdGlvbi5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9Db21tb24vSW5wdXRPcHRpb24uanMnO1xuXG5jb25zdCBERUZBVUxUX0ZJTFRFUl9GVU5DID0gJ3JldHVybiBpdGVtLnZhbHVlID09PSB0cnVlJztcblxuY2xhc3MgRmlsdGVyT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnQ2xhc3MnLCAnRnVuY3Rpb24nXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ0NsYXNzJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICBjb250ZXh0LnNwZWNzWydDbGFzcyddLmFkZE9wdGlvbihuZXcgQ2xhc3NPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2NsYXNzTmFtZSdcbiAgICB9KSk7XG4gICAgY29udGV4dC5zcGVjc1snRnVuY3Rpb24nXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdmaWx0ZXJGdW5jdGlvbicsXG4gICAgICBkZWZhdWx0VmFsdWU6IERFRkFVTFRfRklMVEVSX0ZVTkMsXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlIEZpbHRlciBvcGVyYXRpb24gaXMgbm90IHlldCBzdXBwb3J0ZWQgYXQgdGhlIGluc3RhbmNlIGxldmVsYCk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0Z1bmN0aW9uJykge1xuICAgICAgaWYgKHR5cGVvZiBpbnB1dE9wdGlvbnMuZmlsdGVyRnVuY3Rpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBGdW5jdGlvbignaXRlbScsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9GSUxURVJfRlVOQyk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGlucHV0T3B0aW9ucy5jbGFzc05hbWU7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgT3V0cHV0U3BlYygpO1xuICAgIGxldCBmaWx0ZXJGdW5jdGlvbjtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGZpbHRlckZ1bmN0aW9uID0gaW5wdXRPcHRpb25zLmZpbHRlckZ1bmN0aW9uO1xuICAgICAgaWYgKHR5cGVvZiBmaWx0ZXJGdW5jdGlvbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZpbHRlckZ1bmN0aW9uID0gbmV3IEZ1bmN0aW9uKCdpdGVtJywgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgICAgICAgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuIHx8IERFRkFVTFRfRklMVEVSX0ZVTkMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICAgIG91dHB1dC53YXJuKGBmaWx0ZXJGdW5jdGlvbiBTeW50YXhFcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgeyAvLyBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdDbGFzcycpXG4gICAgICBmaWx0ZXJGdW5jdGlvbiA9IGl0ZW0gPT4ge1xuICAgICAgICByZXR1cm4gaXRlbS5nZXRDbGFzc2VzICYmIGl0ZW0uZ2V0Q2xhc3NlcygpLmluZGV4T2YoaW5wdXRPcHRpb25zLmNsYXNzTmFtZSkgIT09IC0xO1xuICAgICAgfTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKSkuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGlmIChmaWx0ZXJGdW5jdGlvbihpdGVtKSkge1xuICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtpdGVtLnVuaXF1ZVNlbGVjdG9yXSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGaWx0ZXJPcGVyYXRpb247XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZUNvbnZlcnNpb24gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIFRhcmdldFR5cGUsIHN0YW5kYXJkVHlwZXMgPSBbXSwgc3BlY2lhbFR5cGVzID0gW10gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgICB0aGlzLlRhcmdldFR5cGUgPSBUYXJnZXRUeXBlO1xuICAgIHRoaXMuc3RhbmRhcmRUeXBlcyA9IHt9O1xuICAgIHN0YW5kYXJkVHlwZXMuZm9yRWFjaChUeXBlID0+IHsgdGhpcy5zdGFuZGFyZFR5cGVzW1R5cGUudHlwZV0gPSBUeXBlOyB9KTtcbiAgICB0aGlzLnNwZWNpYWxUeXBlcyA9IHt9O1xuICAgIHNwZWNpYWxUeXBlcy5mb3JFYWNoKFR5cGUgPT4geyB0aGlzLnNwZWNpYWxUeXBlc1tUeXBlLnR5cGVdID0gVHlwZTsgfSk7XG4gIH1cbiAgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5zdGFuZGFyZFR5cGVzW2l0ZW0udHlwZV0gfHwgdGhpcy5zcGVjaWFsVHlwZXNbaXRlbS50eXBlXTtcbiAgfVxuICBjb252ZXJ0SXRlbSAoaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKSB7XG4gICAgaWYgKGl0ZW0uY29uc3RydWN0b3IgPT09IHRoaXMuVGFyZ2V0VHlwZSkge1xuICAgICAgLy8gc2tpcCBjb252ZXJzaW9uIGlmIHRoZSB0eXBlIGlzIGFscmVhZHkgdGhlIHNhbWVcbiAgICAgIHJldHVybjtcbiAgICB9IGlmICh0aGlzLnN0YW5kYXJkVHlwZXNbaXRlbS50eXBlXSkge1xuICAgICAgdGhpcy5zdGFuZGFyZENvbnZlcnNpb24oaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc3BlY2lhbFR5cGVzW2l0ZW0udHlwZV0pIHtcbiAgICAgIHRoaXMuc3BlY2lhbENvbnZlcnNpb24oaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0U3BlYy53YXJuKGBDb252ZXJzaW9uIGZyb20gJHtpdGVtLnR5cGV9IHRvICR7dGhpcy5UYXJnZXRUeXBlLnR5cGV9IGlzIG5vdCBzdXBwb3J0ZWRgKTtcbiAgICB9XG4gIH1cbiAgYWRkT3B0aW9uc1RvU3BlYyAoaW5wdXRTcGVjKSB7fVxuICBzdGFuZGFyZENvbnZlcnNpb24gKGl0ZW0sIGlucHV0T3B0aW9ucywgb3V0cHV0U3BlYykge1xuICAgIC8vIEJlY2F1c2Ugb2YgQmFzZVdyYXBwZXIncyBzZXR0ZXIsIHRoaXMgd2lsbCBhY3R1YWxseSBhcHBseSB0byB0aGVcbiAgICAvLyBpdGVtJ3MgZG9jdW1lbnQgYXMgd2VsbCBhcyB0byB0aGUgaXRlbSB3cmFwcGVyXG4gICAgaXRlbS52YWx1ZSA9IHRoaXMuVGFyZ2V0VHlwZS5zdGFuZGFyZGl6ZSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcbiAgICAgIHBhdGg6IGl0ZW0ucGF0aCxcbiAgICAgIGRvYzogaXRlbS5kb2NcbiAgICB9KTtcbiAgICBpZiAodGhpcy5UYXJnZXRUeXBlLmlzQmFkVmFsdWUoaXRlbS52YWx1ZSkpIHtcbiAgICAgIG91dHB1dFNwZWMud2FybihgQ29udmVydGVkICR7aXRlbS50eXBlfSB0byAke2l0ZW0udmFsdWV9YCk7XG4gICAgfVxuICB9XG4gIHNwZWNpYWxDb252ZXJzaW9uIChpdGVtLCBpbnB1dE9wdGlvbnMsIG91dHB1dFNwZWMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1pcGxlbWVudGVkJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlQ29udmVyc2lvbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ29udmVyc2lvbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBOdWxsQ29udmVyc2lvbiBleHRlbmRzIEJhc2VDb252ZXJzaW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgVGFyZ2V0VHlwZTogbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlN0cmluZ1dyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuRGF0ZVdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuUmVmZXJlbmNlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlNldFdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW11cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTnVsbENvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIEJvb2xlYW5Db252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLkJvb2xlYW5XcmFwcGVyLFxuICAgICAgc3RhbmRhcmRUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLk51bGxXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLk51bWJlcldyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuRGF0ZVdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuUmVmZXJlbmNlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlNldFdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLlN0cmluZ1dyYXBwZXJcbiAgICAgIF1cbiAgICB9KTtcbiAgfVxuICBzcGVjaWFsQ29udmVyc2lvbiAoaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKSB7XG4gICAgLy8gVE9ETzogc21hcnRlciBjb252ZXJzaW9uIGZyb20gc3RyaW5ncyB0aGFuIGphdmFzY3JpcHQncyBkZWZhdWx0XG4gICAgaXRlbS52YWx1ZSA9ICEhaXRlbS52YWx1ZTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQm9vbGVhbkNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIE51bWJlckNvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5TdHJpbmdXcmFwcGVyXG4gICAgICBdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE51bWJlckNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIFN0cmluZ0NvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuU3RyaW5nV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkRhdGVXcmFwcGVyXG4gICAgICBdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ0NvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDb252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyLFxuICAgICAgc3RhbmRhcmRUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXJcbiAgICAgIF0sXG4gICAgICBzcGVjaWFsVHlwZXM6IFtdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBOb2RlQ29udmVyc2lvbiBleHRlbmRzIEJhc2VDb252ZXJzaW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgVGFyZ2V0VHlwZTogbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyXG4gICAgICBdLFxuICAgICAgc3BlY2lhbFR5cGVzOiBbXVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOb2RlQ29udmVyc2lvbjtcbiIsImltcG9ydCBCYXNlQ29udmVyc2lvbiBmcm9tICcuL0Jhc2VDb252ZXJzaW9uLmpzJztcblxuY2xhc3MgRWRnZUNvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIsXG4gICAgICBzdGFuZGFyZFR5cGVzOiBbXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW11cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRWRnZUNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBJbnB1dFNwZWMgZnJvbSAnLi9Db21tb24vSW5wdXRTcGVjLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgTnVsbENvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9OdWxsQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgQm9vbGVhbkNvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9Cb29sZWFuQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgTnVtYmVyQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL051bWJlckNvbnZlcnNpb24uanMnO1xuaW1wb3J0IFN0cmluZ0NvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9TdHJpbmdDb252ZXJzaW9uLmpzJztcbmltcG9ydCBHZW5lcmljQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL0dlbmVyaWNDb252ZXJzaW9uLmpzJztcbmltcG9ydCBOb2RlQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL05vZGVDb252ZXJzaW9uLmpzJztcbmltcG9ydCBFZGdlQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL0VkZ2VDb252ZXJzaW9uLmpzJztcblxuY2xhc3MgQ29udmVydE9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKG11cmUpO1xuXG4gICAgY29uc3QgY29udmVyc2lvbkxpc3QgPSBbXG4gICAgICBuZXcgQm9vbGVhbkNvbnZlcnNpb24obXVyZSksXG4gICAgICBuZXcgTnVtYmVyQ29udmVyc2lvbihtdXJlKSxcbiAgICAgIG5ldyBTdHJpbmdDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IE51bGxDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IEdlbmVyaWNDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IE5vZGVDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IEVkZ2VDb252ZXJzaW9uKG11cmUpXG4gICAgXTtcbiAgICB0aGlzLkNPTlZFUlNJT05TID0ge307XG4gICAgY29udmVyc2lvbkxpc3QuZm9yRWFjaChjb252ZXJzaW9uID0+IHtcbiAgICAgIHRoaXMuQ09OVkVSU0lPTlNbY29udmVyc2lvbi50eXBlXSA9IGNvbnZlcnNpb247XG4gICAgfSk7XG4gIH1cbiAgZ2V0SW5wdXRTcGVjICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgSW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IE9iamVjdC5rZXlzKHRoaXMuQ09OVkVSU0lPTlMpLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnU3RyaW5nJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICBjb250ZXh0LmNob2ljZXMuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgdGhpcy5DT05WRVJTSU9OU1tjaG9pY2VdLmFkZE9wdGlvbnNUb1NwZWMoY29udGV4dC5zcGVjc1tjaG9pY2VdKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgcG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5DT05WRVJTSU9OUykuc29tZShjb252ZXJzaW9uID0+IHtcbiAgICAgIHJldHVybiBjb252ZXJzaW9uLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0pO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoYXdhaXQgc3VwZXIuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNvbnN0IGNvbnZlcnNpb24gPSB0aGlzLkNPTlZFUlNJT05TW2lucHV0T3B0aW9ucy5jb250ZXh0XTtcbiAgICByZXR1cm4gY29udmVyc2lvbiAmJiBjb252ZXJzaW9uLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0sIGlucHV0T3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgY29uc3QgY29udmVyc2lvbiA9IHRoaXMuQ09OVkVSU0lPTlNbaW5wdXRPcHRpb25zLmNvbnRleHRdO1xuICAgIGlmICghY29udmVyc2lvbikge1xuICAgICAgb3V0cHV0Lndhcm4oYFVua25vd24gY29udGV4dCBmb3IgY29udmVyc2lvbjogJHtpbnB1dE9wdGlvbnMuY29udGV4dH1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udmVyc2lvbi5jb252ZXJ0SXRlbShpdGVtLCBpbnB1dE9wdGlvbnMsIG91dHB1dCk7XG4gICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKGl0ZW0uZG9jKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDb252ZXJ0T3BlcmF0aW9uO1xuIiwiaW1wb3J0IENvbnRhaW5lcldyYXBwZXIgZnJvbSAnLi4vLi4vV3JhcHBlcnMvQ29udGFpbmVyV3JhcHBlci5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNsYXNzIFR5cGVkT3B0aW9uIGV4dGVuZHMgSW5wdXRPcHRpb24ge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIHBhcmFtZXRlck5hbWUsXG4gICAgZGVmYXVsdFZhbHVlLFxuICAgIGNob2ljZXMsXG4gICAgdmFsaWRUeXBlcyA9IFtdLFxuICAgIHN1Z2dlc3RPcnBoYW5zID0gZmFsc2VcbiAgfSkge1xuICAgIHN1cGVyKHtcbiAgICAgIHBhcmFtZXRlck5hbWUsXG4gICAgICBkZWZhdWx0VmFsdWUsXG4gICAgICBjaG9pY2VzLFxuICAgICAgb3BlbkVuZGVkOiBmYWxzZVxuICAgIH0pO1xuICAgIHRoaXMudmFsaWRUeXBlcyA9IHZhbGlkVHlwZXM7XG4gICAgdGhpcy5zdWdnZXN0T3JwaGFucyA9IHN1Z2dlc3RPcnBoYW5zO1xuICB9XG4gIGFzeW5jIHVwZGF0ZUNob2ljZXMgKHsgaXRlbXMsIGlucHV0T3B0aW9ucywgcmVzZXQgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgaXRlbUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IG9ycGhhbkxvb2t1cCA9IHt9O1xuICAgIGlmICghcmVzZXQpIHtcbiAgICAgIHRoaXMuY2hvaWNlcy5mb3JFYWNoKGNob2ljZSA9PiB7XG4gICAgICAgIGl0ZW1Mb29rdXBbY2hvaWNlLnVuaXF1ZVNlbGVjdG9yXSA9IGNob2ljZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBPYmplY3QudmFsdWVzKGl0ZW1zKS5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgaWYgKHRoaXMudmFsaWRUeXBlcy5pbmRleE9mKGl0ZW0uY29uc3RydWN0b3IpICE9PSAtMSkge1xuICAgICAgICBpdGVtTG9va3VwW2l0ZW0udW5pcXVlU2VsZWN0b3JdID0gaXRlbTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnN1Z2dlc3RPcnBoYW5zICYmIGl0ZW0uZG9jICYmICFvcnBoYW5Mb29rdXBbaXRlbS5kb2MuX2lkXSkge1xuICAgICAgICBvcnBoYW5Mb29rdXBbaXRlbS5kb2MuX2lkXSA9IG5ldyBDb250YWluZXJXcmFwcGVyKHtcbiAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgdmFsdWU6IGl0ZW0uZG9jLm9ycGhhbnMsXG4gICAgICAgICAgcGF0aDogW2l0ZW0ucGF0aFswXSwgJ29ycGhhbnMnXSxcbiAgICAgICAgICBkb2M6IGl0ZW0uZG9jXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuY2hvaWNlcyA9IE9iamVjdC52YWx1ZXMoaXRlbUxvb2t1cCkuY29uY2F0KE9iamVjdC52YWx1ZXMob3JwaGFuTG9va3VwKSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFR5cGVkT3B0aW9uO1xuIiwiaW1wb3J0IFN0cmluZ09wdGlvbiBmcm9tICcuL1N0cmluZ09wdGlvbi5qcyc7XG5cbmNsYXNzIEF0dHJpYnV0ZU9wdGlvbiBleHRlbmRzIFN0cmluZ09wdGlvbiB7XG4gIGFzeW5jIHBvcHVsYXRlRnJvbUl0ZW0gKGl0ZW0sIGF0dHJpYnV0ZXMpIHtcbiAgICBpZiAoaXRlbS5nZXRBdHRyaWJ1dGVzKSB7XG4gICAgICAoYXdhaXQgaXRlbS5nZXRBdHRyaWJ1dGVzKCkpLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIHBvcHVsYXRlRnJvbUl0ZW1zIChpdGVtcywgYXR0cmlidXRlcykge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKGl0ZW1zKS5tYXAoaXRlbSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5wb3B1bGF0ZUZyb21JdGVtKGl0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIH0pKTtcbiAgfVxuICBhc3luYyB1cGRhdGVDaG9pY2VzICh7IGl0ZW1zLCBpbnB1dE9wdGlvbnMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0ge307XG4gICAgaWYgKCFyZXNldCkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyhhdHRyaWJ1dGVzKTtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5wb3B1bGF0ZUZyb21JdGVtcyhpdGVtcywgYXR0cmlidXRlcyk7XG4gICAgdGhpcy5jaG9pY2VzID0gT2JqZWN0LmtleXMoYXR0cmlidXRlcyk7XG4gICAgdGhpcy5jaG9pY2VzLnVuc2hpZnQobnVsbCk7IC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGl0ZW0ncyBsYWJlbCBzaG91bGQgYmUgdXNlZFxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBdHRyaWJ1dGVPcHRpb247XG4iLCJpbXBvcnQgQXR0cmlidXRlT3B0aW9uIGZyb20gJy4vQXR0cmlidXRlT3B0aW9uLmpzJztcblxuY2xhc3MgTmVzdGVkQXR0cmlidXRlT3B0aW9uIGV4dGVuZHMgQXR0cmlidXRlT3B0aW9uIHtcbiAgY29uc3RydWN0b3IgKHsgcGFyYW1ldGVyTmFtZSwgZGVmYXVsdFZhbHVlLCBjaG9pY2VzLCBvcGVuRW5kZWQsIGdldEl0ZW1DaG9pY2VSb2xlIH0pIHtcbiAgICBzdXBlcih7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcywgb3BlbkVuZGVkIH0pO1xuICAgIHRoaXMuZ2V0SXRlbUNob2ljZVJvbGUgPSBnZXRJdGVtQ2hvaWNlUm9sZTtcbiAgfVxuICBhc3luYyB1cGRhdGVDaG9pY2VzICh7IGl0ZW1zLCBpbnB1dE9wdGlvbnMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0ge307XG4gICAgaWYgKCFyZXNldCkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyhhdHRyaWJ1dGVzKTtcbiAgICB9XG4gICAgY29uc3QgaXRlbUxpc3QgPSBPYmplY3QudmFsdWVzKGl0ZW1zKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1MaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gaXRlbUxpc3RbaV07XG4gICAgICBjb25zdCBpdGVtUm9sZSA9IHRoaXMuZ2V0SXRlbUNob2ljZVJvbGUoaXRlbSwgaW5wdXRPcHRpb25zKTtcbiAgICAgIGlmIChpdGVtUm9sZSA9PT0gJ3N0YW5kYXJkJykge1xuICAgICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlRnJvbUl0ZW0oaXRlbSwgYXR0cmlidXRlcyk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW1Sb2xlID09PSAnZGVlcCcpIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBpdGVtLmdldE1lbWJlcnMgPyBhd2FpdCBpdGVtLmdldE1lbWJlcnMoKVxuICAgICAgICAgIDogaXRlbS5nZXRDb250ZW50cyA/IGl0ZW0uZ2V0Q29udGVudHMoKSA6IHt9O1xuICAgICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlRnJvbUl0ZW1zKGNoaWxkcmVuLCBhdHRyaWJ1dGVzKTtcbiAgICAgIH0gLy8gZWxzZSBpZiAoaXRlbVJvbGUgPT09ICdpZ25vcmUnKVxuICAgIH1cbiAgICB0aGlzLmNob2ljZXMgPSBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKTtcbiAgICB0aGlzLmNob2ljZXMudW5zaGlmdChudWxsKTsgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgaXRlbSdzIGxhYmVsIHNob3VsZCBiZSB1c2VkXG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbjtcbiIsImltcG9ydCBTZWxlY3Rpb24gZnJvbSAnLi4vU2VsZWN0aW9uLmpzJztcbmltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBUeXBlZE9wdGlvbiBmcm9tICcuL0NvbW1vbi9UeXBlZE9wdGlvbi5qcyc7XG5pbXBvcnQgTmVzdGVkQXR0cmlidXRlT3B0aW9uIGZyb20gJy4vQ29tbW9uL05lc3RlZEF0dHJpYnV0ZU9wdGlvbi5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9Db21tb24vSW5wdXRPcHRpb24uanMnO1xuXG5jb25zdCBERUZBVUxUX0NPTk5FQ1RfV0hFTiA9ICdyZXR1cm4gc291cmNlLmxhYmVsID09PSB0YXJnZXQubGFiZWw7JztcblxuY2xhc3MgQ29ubmVjdE9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLmdldElucHV0U3BlYygpO1xuXG4gICAgLy8gRG8gd2UgY29ubmVjdCBub2RlcyBpbiB0aGUgY3VycmVudCBzZWxlY3Rpb24sIG9yIHRvIHRoZSBub2RlcyBpbnNpZGUgc29tZVxuICAgIC8vIHNldC1saWtlIGNvbnN0cnVjdD9cbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IENvbnRleHR1YWxPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2NvbnRleHQnLFxuICAgICAgY2hvaWNlczogWydXaXRoaW4gU2VsZWN0aW9uJywgJ0JpcGFydGl0ZSddLFxuICAgICAgaGlkZGVuQ2hvaWNlczogWydUYXJnZXQgQ29udGFpbmVyJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICAvLyBGb3Igc29tZSBjb250ZXh0cywgd2UgbmVlZCB0byBzcGVjaWZ5IHNvdXJjZSBhbmQvb3IgdGFyZ2V0IGRvY3VtZW50cyxcbiAgICAvLyBpdGVtcywgb3Igc2V0cyAoY2xhc3NlcyBvciBncm91cHMpXG4gICAgY29udGV4dC5zcGVjc1snQmlwYXJ0aXRlJ10uYWRkT3B0aW9uKG5ldyBUeXBlZE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnc291cmNlcycsXG4gICAgICB2YWxpZFR5cGVzOiBbXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIsXG4gICAgICAgIFNlbGVjdGlvblxuICAgICAgXVxuICAgIH0pKTtcbiAgICBjb25zdCB0YXJnZXRzID0gbmV3IFR5cGVkT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICd0YXJnZXRzJyxcbiAgICAgIHZhbGlkVHlwZXM6IFtcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcixcbiAgICAgICAgU2VsZWN0aW9uXG4gICAgICBdXG4gICAgfSk7XG4gICAgY29udGV4dC5zcGVjc1snQmlwYXJ0aXRlJ10uYWRkT3B0aW9uKHRhcmdldHMpO1xuICAgIGNvbnRleHQuc3BlY3NbJ1RhcmdldCBDb250YWluZXInXS5hZGRPcHRpb24odGFyZ2V0cyk7XG5cbiAgICAvLyBFZGdlIGRpcmVjdGlvblxuICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZGlyZWN0ZWQnLFxuICAgICAgY2hvaWNlczogWydVbmRpcmVjdGVkJywgJ0RpcmVjdGVkJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdVbmRpcmVjdGVkJ1xuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihkaXJlY3Rpb24pO1xuICAgIGNvbnRleHQuc3BlY3NbJ1RhcmdldCBDb250YWluZXInXS5hZGRPcHRpb24oZGlyZWN0aW9uKTtcblxuICAgIC8vIEFsbCBjb250ZXh0cyBjYW4gYmUgZXhlY3V0ZWQgYnkgbWF0Y2hpbmcgYXR0cmlidXRlcyBvciBldmFsdWF0aW5nXG4gICAgLy8gYSBmdW5jdGlvblxuICAgIGNvbnN0IG1vZGUgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnbW9kZScsXG4gICAgICBjaG9pY2VzOiBbJ0F0dHJpYnV0ZScsICdGdW5jdGlvbiddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnQXR0cmlidXRlJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24obW9kZSk7XG5cbiAgICAvLyBBdHRyaWJ1dGUgbW9kZSBuZWVkcyBzb3VyY2UgYW5kIHRhcmdldCBhdHRyaWJ1dGVzXG4gICAgbW9kZS5zcGVjc1snQXR0cmlidXRlJ10uYWRkT3B0aW9uKG5ldyBOZXN0ZWRBdHRyaWJ1dGVPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ3NvdXJjZUF0dHJpYnV0ZScsXG4gICAgICBkZWZhdWx0VmFsdWU6IG51bGwsIC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGxhYmVsIHNob3VsZCBiZSB1c2VkXG4gICAgICBnZXRJdGVtQ2hvaWNlUm9sZTogKGl0ZW0sIGlucHV0T3B0aW9ucykgPT4ge1xuICAgICAgICBpZiAoaXRlbS5lcXVhbHMoaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luKSkge1xuICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgICAgICBpZiAoaW5wdXRPcHRpb25zLnNvdXJjZXMgJiYgaXRlbS5lcXVhbHMoaW5wdXRPcHRpb25zLnNvdXJjZXMpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2RlZXAnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy50YXJnZXRzKSkge1xuICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gJ3N0YW5kYXJkJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcbiAgICBtb2RlLnNwZWNzWydBdHRyaWJ1dGUnXS5hZGRPcHRpb24obmV3IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAndGFyZ2V0QXR0cmlidXRlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCwgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgbGFiZWwgc2hvdWxkIGJlIHVzZWRcbiAgICAgIGdldEl0ZW1DaG9pY2VSb2xlOiAoaXRlbSwgaW5wdXRPcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4pKSB7XG4gICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy50YXJnZXRzKSkge1xuICAgICAgICAgIHJldHVybiAnZGVlcCc7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiAnc3RhbmRhcmQnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuXG4gICAgLy8gRnVuY3Rpb24gbW9kZSBuZWVkcyB0aGUgZnVuY3Rpb25cbiAgICBtb2RlLnNwZWNzWydGdW5jdGlvbiddLmFkZE9wdGlvbihuZXcgSW5wdXRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2Nvbm5lY3RXaGVuJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogREVGQVVMVF9DT05ORUNUX1dIRU4sXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG5cbiAgICAvLyBGaW5hbCBvcHRpb24gYWRkZWQgdG8gYWxsIGNvbnRleHQgLyBtb2Rlczogd2hlcmUgdG8gc3RvcmUgdGhlIGNyZWF0ZWRcbiAgICAvLyBlZGdlcz9cbiAgICByZXN1bHQuYWRkT3B0aW9uKG5ldyBUeXBlZE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnc2F2ZUVkZ2VzSW4nLFxuICAgICAgdmFsaWRUeXBlczogW3RoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyXSxcbiAgICAgIHN1Z2dlc3RPcnBoYW5zOiB0cnVlXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFJ1bm5pbmcgdGhlIENvbm5lY3Qgb3BlcmF0aW9uIG9uIGFuIGluc3RhbmNlIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuaWdub3JlRXJyb3JzICE9PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoIShpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQmlwYXJ0aXRlJykge1xuICAgICAgaWYgKCEoXG4gICAgICAgIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIpICYmXG4gICAgICAgIChpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1RhcmdldCBDb250YWluZXInKSB7XG4gICAgICBpZiAoIWlucHV0T3B0aW9ucy50YXJnZXRzIHx8ICFpbnB1dE9wdGlvbnMudGFyZ2V0cy5pdGVtcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBsZXQgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICAgIGxldCB0YXJnZXRJdGVtcyA9IGF3YWl0IGlucHV0T3B0aW9ucy50YXJnZXRzLml0ZW1zKCk7XG4gICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhpdGVtcylcbiAgICAgICAgLnNvbWUoaXRlbSA9PiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSAmJlxuICAgICAgICBPYmplY3QudmFsdWVzKHRhcmdldEl0ZW1zKVxuICAgICAgICAgIC5zb21lKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcik7XG4gICAgfSBlbHNlIHsgLy8gaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgICAgY29uc3QgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICBjb25zdCBhdExlYXN0VHdvTm9kZXMgPSBPYmplY3QudmFsdWVzKGl0ZW1zKS5zb21lKGl0ZW0gPT4ge1xuICAgICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikge1xuICAgICAgICAgIGNvdW50ICs9IDE7XG4gICAgICAgICAgaWYgKGNvdW50ID49IDIpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIWF0TGVhc3RUd29Ob2Rlcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ0Z1bmN0aW9uJykge1xuICAgICAgaWYgKHR5cGVvZiBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBGdW5jdGlvbignc291cmNlJywgJ3RhcmdldCcsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuc291cmNlQXR0cmlidXRlICYmIGlucHV0T3B0aW9ucy50YXJnZXRBdHRyaWJ1dGU7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24gKGl0ZW1zLCBjb25uZWN0V2hlbiwgc2F2ZUVkZ2VzSW4sIG91dHB1dCkge1xuICAgIC8vIFdlJ3JlIG9ubHkgY3JlYXRpbmcgZWRnZXMgd2l0aGluIHRoZSBzZWxlY3Rpb247IHdlIGRvbid0IGhhdmUgdG8gd29ycnlcbiAgICAvLyBhYm91dCBkaXJlY3Rpb24gb3IgdGhlIG90aGVyIHNldCBvZiBub2RlcywgYnV0IHdlIGRvIG5lZWQgdG8gaXRlcmF0ZSBpblxuICAgIC8vIGEgd2F5IHRoYXQgZ3VhcmFudGVlcyB0aGF0IHdlIGRvbid0IGR1cGxpY2F0ZSBlZGdlc1xuICAgIGNvbnN0IHNvdXJjZUxpc3QgPSBPYmplY3QudmFsdWVzKGl0ZW1zKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHNvdXJjZUxpc3QubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKGNvbm5lY3RXaGVuKHNvdXJjZUxpc3RbaV0sIHNvdXJjZUxpc3Rbal0pKSB7XG4gICAgICAgICAgY29uc3QgbmV3RWRnZSA9IHNvdXJjZUxpc3RbaV0uY29ubmVjdFRvKHNvdXJjZUxpc3Rbal0sIHNhdmVFZGdlc0luKTtcbiAgICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtuZXdFZGdlLnVuaXF1ZVNlbGVjdG9yXSk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhzb3VyY2VMaXN0W2ldLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhzb3VyY2VMaXN0W2pdLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhuZXdFZGdlLmRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3Qgb3V0cHV0ID0gbmV3IE91dHB1dFNwZWMoKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlIGEgcGxhY2UgdG8gc2F2ZSB0aGUgZWRnZXNcbiAgICBpZiAoIShpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC53YXJuKGBzYXZlRWRnZXNJbiBpcyBub3QgYW4gSXRlbWApO1xuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICAvLyBGaWd1cmUgb3V0IHRoZSBjcml0ZXJpYSBmb3IgbWF0Y2hpbmcgbm9kZXNcbiAgICBsZXQgY29ubmVjdFdoZW47XG4gICAgaWYgKGlucHV0T3B0aW9ucy5tb2RlID09PSAnRnVuY3Rpb24nKSB7XG4gICAgICBjb25uZWN0V2hlbiA9IGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbjtcbiAgICAgIGlmICh0eXBlb2YgY29ubmVjdFdoZW4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25uZWN0V2hlbiA9IG5ldyBGdW5jdGlvbignc291cmNlJywgJ3RhcmdldCcsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICAgIGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbiB8fCBERUZBVUxUX0NPTk5FQ1RfV0hFTik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgICAgICAgb3V0cHV0Lndhcm4oYGNvbm5lY3RXaGVuIFN5bnRheEVycm9yOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ0F0dHJpYnV0ZScpXG4gICAgICBjb25zdCBnZXRTb3VyY2VWYWx1ZSA9IGlucHV0T3B0aW9ucy5zb3VyY2VBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyBzb3VyY2UgPT4gc291cmNlLmxhYmVsXG4gICAgICAgIDogc291cmNlID0+IHNvdXJjZS52YWx1ZVtpbnB1dE9wdGlvbnMuc291cmNlQXR0cmlidXRlXTtcbiAgICAgIGNvbnN0IGdldFRhcmdldFZhbHVlID0gaW5wdXRPcHRpb25zLnRhcmdldEF0dHJpYnV0ZSA9PT0gbnVsbFxuICAgICAgICA/IHRhcmdldCA9PiB0YXJnZXQubGFiZWxcbiAgICAgICAgOiB0YXJnZXQgPT4gdGFyZ2V0LnZhbHVlW2lucHV0T3B0aW9ucy50YXJnZXRBdHRyaWJ1dGVdO1xuICAgICAgY29ubmVjdFdoZW4gPSAoc291cmNlLCB0YXJnZXQpID0+IGdldFNvdXJjZVZhbHVlKHNvdXJjZSkgPT09IGdldFRhcmdldFZhbHVlKHRhcmdldCk7XG4gICAgfVxuXG4gICAgbGV0IHNvdXJjZXM7XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQmlwYXJ0aXRlJykge1xuICAgICAgaWYgKGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgU2VsZWN0aW9uKSB7XG4gICAgICAgIHNvdXJjZXMgPSBhd2FpdCBpbnB1dE9wdGlvbnMuc291cmNlcy5pdGVtcygpO1xuICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyIHx8XG4gICAgICAgICAgaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcikge1xuICAgICAgICBzb3VyY2VzID0gYXdhaXQgaW5wdXRPcHRpb25zLnNvdXJjZXMuZ2V0TWVtYmVycygpO1xuICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgICAgaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikge1xuICAgICAgICBzb3VyY2VzID0gaW5wdXRPcHRpb25zLnNvdXJjZXMuZ2V0Q29udGVudHMoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC53YXJuKGBpbnB1dE9wdGlvbnMuc291cmNlcyBpcyBvZiB1bmV4cGVjdGVkIHR5cGUgJHtpbnB1dE9wdGlvbnMuc291cmNlcyAmJiBpbnB1dE9wdGlvbnMuc291cmNlcy50eXBlfWApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzb3VyY2VzID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc291cmNlTGlzdCA9IE9iamVjdC52YWx1ZXMoc291cmNlcyk7XG4gICAgaWYgKHNvdXJjZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBvdXRwdXQud2FybihgTm8gc291cmNlcyBzdXBwbGllZCB0byBjb25uZWN0IG9wZXJhdGlvbmApO1xuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlIGtub3cgZW5vdWdoIHRvIGRlYWwgd2l0aCAnV2l0aGluIFNlbGVjdGlvbicgbW9kZTpcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdXaXRoaW4gU2VsZWN0aW9uJykge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY3V0ZVdpdGhpblNlbGVjdGlvbihzb3VyY2VzLCBjb25uZWN0V2hlbiwgaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luLCBvdXRwdXQpO1xuICAgIH1cblxuICAgIC8vIFdoYXQgcm9sZSBhcmUgdGhlIHNvdXJjZSBub2RlcyBwbGF5aW5nICgndW5kaXJlY3RlZCcgdnMgJ3NvdXJjZScpP1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IGlucHV0T3B0aW9ucy5kaXJlY3RlZCA9PT0gJ0RpcmVjdGVkJyA/ICdzb3VyY2UnIDogJ3VuZGlyZWN0ZWQnO1xuXG4gICAgbGV0IHRhcmdldHM7XG4gICAgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgU2VsZWN0aW9uKSB7XG4gICAgICB0YXJnZXRzID0gYXdhaXQgaW5wdXRPcHRpb25zLnRhcmdldHMuaXRlbXMoKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIpIHtcbiAgICAgIHRhcmdldHMgPSBhd2FpdCBpbnB1dE9wdGlvbnMudGFyZ2V0cy5nZXRNZW1iZXJzKCk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICAgICAgICBpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIpIHtcbiAgICAgIHRhcmdldHMgPSBpbnB1dE9wdGlvbnMudGFyZ2V0cy5nZXRDb250ZW50cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQud2FybihgaW5wdXRPcHRpb25zLnRhcmdldHMgaXMgb2YgdW5leHBlY3RlZCB0eXBlICR7aW5wdXRPcHRpb25zLnRhcmdldHMgJiYgaW5wdXRPcHRpb25zLnRhcmdldHMudHlwZX1gKTtcbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0TGlzdCA9IE9iamVjdC52YWx1ZXModGFyZ2V0cyk7XG4gICAgaWYgKHRhcmdldExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBvdXRwdXQud2FybignTm8gdGFyZ2V0cyBzdXBwbGllZCB0byBjb25uZWN0IG9wZXJhdGlvbicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgZWRnZXMhXG4gICAgc291cmNlTGlzdC5mb3JFYWNoKHNvdXJjZSA9PiB7XG4gICAgICB0YXJnZXRMaXN0LmZvckVhY2godGFyZ2V0ID0+IHtcbiAgICAgICAgaWYgKHNvdXJjZSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJlxuICAgICAgICAgICAgdGFyZ2V0IGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyICYmXG4gICAgICAgICAgICBjb25uZWN0V2hlbihzb3VyY2UsIHRhcmdldCkpIHtcbiAgICAgICAgICBjb25zdCBuZXdFZGdlID0gc291cmNlLmNvbm5lY3RUbyh0YXJnZXQsIGlucHV0T3B0aW9ucy5zYXZlRWRnZXNJbiwgZGlyZWN0aW9uKTtcbiAgICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtuZXdFZGdlLnVuaXF1ZVNlbGVjdG9yXSk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhzb3VyY2UuZG9jKTtcbiAgICAgICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKHRhcmdldC5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MobmV3RWRnZS5kb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RPcGVyYXRpb247XG4iLCJpbXBvcnQgU2VsZWN0aW9uIGZyb20gJy4uL1NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgVHlwZWRPcHRpb24gZnJvbSAnLi9Db21tb24vVHlwZWRPcHRpb24uanMnO1xuaW1wb3J0IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbiBmcm9tICcuL0NvbW1vbi9OZXN0ZWRBdHRyaWJ1dGVPcHRpb24uanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vQ29tbW9uL0lucHV0T3B0aW9uLmpzJztcblxuY29uc3QgREVGQVVMVF9DT05ORUNUX1dIRU4gPSAncmV0dXJuIGVkZ2UubGFiZWwgPT09IG5vZGUubGFiZWw7JztcblxuY2xhc3MgQXR0YWNoT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG5cbiAgICAvLyBEbyB3ZSBjb25uZWN0IG5vZGVzIGluIHRoZSBjdXJyZW50IHNlbGVjdGlvbiwgb3IgdG8gdGhlIG5vZGVzIGluc2lkZSBzb21lXG4gICAgLy8gc2V0LWxpa2UgY29uc3RydWN0P1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29udGV4dCcsXG4gICAgICBjaG9pY2VzOiBbJ1dpdGhpbiBTZWxlY3Rpb24nLCAnQmlwYXJ0aXRlJ10sXG4gICAgICBoaWRkZW5DaG9pY2VzOiBbJ1RhcmdldCBDb250YWluZXInXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1dpdGhpbiBTZWxlY3Rpb24nXG4gICAgfSk7XG4gICAgcmVzdWx0LmFkZE9wdGlvbihjb250ZXh0KTtcblxuICAgIC8vIEZvciBzb21lIGNvbnRleHRzLCB3ZSBuZWVkIHRvIHNwZWNpZnkgZWRnZSBhbmQvb3Igbm9kZSBkb2N1bWVudHMsXG4gICAgLy8gaXRlbXMsIG9yIHNldHMgKGNsYXNzZXMgb3IgZ3JvdXBzKVxuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihuZXcgVHlwZWRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2VkZ2VzJyxcbiAgICAgIHZhbGlkVHlwZXM6IFtcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcixcbiAgICAgICAgU2VsZWN0aW9uXG4gICAgICBdXG4gICAgfSkpO1xuICAgIGNvbnN0IG5vZGVzID0gbmV3IFR5cGVkT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdub2RlcycsXG4gICAgICB2YWxpZFR5cGVzOiBbXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIsXG4gICAgICAgIFNlbGVjdGlvblxuICAgICAgXVxuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihub2Rlcyk7XG4gICAgY29udGV4dC5zcGVjc1snVGFyZ2V0IENvbnRhaW5lciddLmFkZE9wdGlvbihub2Rlcyk7XG5cbiAgICAvLyBFZGdlIGRpcmVjdGlvblxuICAgIHJlc3VsdC5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdkaXJlY3Rpb24nLFxuICAgICAgY2hvaWNlczogWyd1bmRpcmVjdGVkJywgJ3NvdXJjZScsICd0YXJnZXQnXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ3VuZGlyZWN0ZWQnXG4gICAgfSkpO1xuXG4gICAgLy8gQWxsIGNvbnRleHRzIGNhbiBiZSBleGVjdXRlZCBieSBtYXRjaGluZyBhdHRyaWJ1dGVzIG9yIGV2YWx1YXRpbmdcbiAgICAvLyBhIGZ1bmN0aW9uXG4gICAgY29uc3QgbW9kZSA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdtb2RlJyxcbiAgICAgIGNob2ljZXM6IFsnQXR0cmlidXRlJywgJ0Z1bmN0aW9uJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdBdHRyaWJ1dGUnXG4gICAgfSk7XG4gICAgcmVzdWx0LmFkZE9wdGlvbihtb2RlKTtcblxuICAgIC8vIEF0dHJpYnV0ZSBtb2RlIG5lZWRzIGVkZ2UgYW5kIG5vZGUgYXR0cmlidXRlc1xuICAgIG1vZGUuc3BlY3NbJ0F0dHJpYnV0ZSddLmFkZE9wdGlvbihuZXcgTmVzdGVkQXR0cmlidXRlT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdlZGdlQXR0cmlidXRlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCwgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgbGFiZWwgc2hvdWxkIGJlIHVzZWRcbiAgICAgIGdldEl0ZW1DaG9pY2VSb2xlOiAoaXRlbSwgaW5wdXRPcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgICAgICBpZiAoaW5wdXRPcHRpb25zLmVkZ2VzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy5lZGdlcykpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGVlcCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLm5vZGVzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy5ub2RlcykpIHtcbiAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICdzdGFuZGFyZCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG4gICAgbW9kZS5zcGVjc1snQXR0cmlidXRlJ10uYWRkT3B0aW9uKG5ldyBOZXN0ZWRBdHRyaWJ1dGVPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ25vZGVBdHRyaWJ1dGUnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLCAvLyBudWxsIGluZGljYXRlcyB0aGF0IHRoZSBsYWJlbCBzaG91bGQgYmUgdXNlZFxuICAgICAgZ2V0SXRlbUNob2ljZVJvbGU6IChpdGVtLCBpbnB1dE9wdGlvbnMpID0+IHtcbiAgICAgICAgaWYgKGlucHV0T3B0aW9ucy5ub2RlcyAmJiBpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMubm9kZXMpKSB7XG4gICAgICAgICAgcmV0dXJuICdkZWVwJztcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICdzdGFuZGFyZCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG5cbiAgICAvLyBGdW5jdGlvbiBtb2RlIG5lZWRzIHRoZSBmdW5jdGlvblxuICAgIG1vZGUuc3BlY3NbJ0Z1bmN0aW9uJ10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29ubmVjdFdoZW4nLFxuICAgICAgZGVmYXVsdFZhbHVlOiBERUZBVUxUX0NPTk5FQ1RfV0hFTixcbiAgICAgIG9wZW5FbmRlZDogdHJ1ZVxuICAgIH0pKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBhc3luYyBleGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBSdW5uaW5nIHRoZSBBdHRhY2ggb3BlcmF0aW9uIG9uIGFuIGluc3RhbmNlIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuaWdub3JlRXJyb3JzICE9PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICBpZiAoIShcbiAgICAgICAgKGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcikgJiZcbiAgICAgICAgKGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcikpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnVGFyZ2V0IENvbnRhaW5lcicpIHtcbiAgICAgIGlmICghaW5wdXRPcHRpb25zLm5vZGVzIHx8ICFpbnB1dE9wdGlvbnMubm9kZXMuaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgbGV0IGVkZ2VJdGVtcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgICAgbGV0IG5vZGVJdGVtcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5ub2Rlcy5pdGVtcygpO1xuICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoZWRnZUl0ZW1zKVxuICAgICAgICAuc29tZShpdGVtID0+IGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIpICYmXG4gICAgICAgIE9iamVjdC52YWx1ZXMobm9kZUl0ZW1zKVxuICAgICAgICAgIC5zb21lKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcik7XG4gICAgfSBlbHNlIHsgLy8gaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgICAgY29uc3QgZWRnZUl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgICBsZXQgb25lTm9kZSA9IGZhbHNlO1xuICAgICAgbGV0IG9uZUVkZ2UgPSBmYWxzZTtcbiAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKGVkZ2VJdGVtcykuc29tZShpdGVtID0+IHtcbiAgICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIpIHtcbiAgICAgICAgICBvbmVOb2RlID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyKSB7XG4gICAgICAgICAgb25lRWRnZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9uZU5vZGUgJiYgb25lRWRnZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGlmICh0eXBlb2YgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgRnVuY3Rpb24oJ2VkZ2UnLCAnbm9kZScsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuZWRnZUF0dHJpYnV0ZSAmJiBpbnB1dE9wdGlvbnMubm9kZUF0dHJpYnV0ZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZVdpdGhpblNlbGVjdGlvbiAoaXRlbXMsIGNvbm5lY3RXaGVuLCBkaXJlY3Rpb24sIG91dHB1dCkge1xuICAgIC8vIFdpdGhpbiB0aGUgc2VsZWN0aW9uLCB3ZSBvbmx5IGtub3cgd2hpY2ggb25lcyBhcmUgZWRnZXMgYW5kIHdoaWNoIG9uZXNcbiAgICAvLyBhcmUgbm9kZXMgb24gdGhlIGZseVxuICAgIGNvbnN0IGl0ZW1MaXN0ID0gT2JqZWN0LnZhbHVlcyhpdGVtcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgaXRlbUxpc3QubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgbGV0IGVkZ2UgPVxuICAgICAgICAgIChpdGVtTGlzdFtpXSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlciAmJiBpdGVtTGlzdFtpXSkgfHxcbiAgICAgICAgICAoaXRlbUxpc3Rbal0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIgJiYgaXRlbUxpc3Rbal0pO1xuICAgICAgICBsZXQgbm9kZSA9XG4gICAgICAgICAgKGl0ZW1MaXN0W2ldIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyICYmIGl0ZW1MaXN0W2ldKSB8fFxuICAgICAgICAgIChpdGVtTGlzdFtqXSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJiBpdGVtTGlzdFtqXSk7XG4gICAgICAgIGlmIChlZGdlICYmIG5vZGUgJiYgY29ubmVjdFdoZW4oZWRnZSwgbm9kZSkpIHtcbiAgICAgICAgICBlZGdlLmF0dGFjaFRvKG5vZGUsIGRpcmVjdGlvbik7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhlZGdlLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhub2RlLmRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3Qgb3V0cHV0ID0gbmV3IE91dHB1dFNwZWMoKTtcblxuICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGNyaXRlcmlhIGZvciBtYXRjaGluZyBub2Rlc1xuICAgIGxldCBjb25uZWN0V2hlbjtcbiAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGNvbm5lY3RXaGVuID0gaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuO1xuICAgICAgaWYgKHR5cGVvZiBjb25uZWN0V2hlbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbm5lY3RXaGVuID0gbmV3IEZ1bmN0aW9uKCdlZGdlJywgJ25vZGUnLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICAgIG91dHB1dC53YXJuKGBjb25uZWN0V2hlbiBTeW50YXhFcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgeyAvLyBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdBdHRyaWJ1dGUnKVxuICAgICAgY29uc3QgZ2V0RWRnZVZhbHVlID0gaW5wdXRPcHRpb25zLmVkZ2VBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyBlZGdlID0+IGVkZ2UubGFiZWxcbiAgICAgICAgOiBlZGdlID0+IGVkZ2UudmFsdWVbaW5wdXRPcHRpb25zLmVkZ2VBdHRyaWJ1dGVdO1xuICAgICAgY29uc3QgZ2V0Tm9kZVZhbHVlID0gaW5wdXRPcHRpb25zLm5vZGVBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyBub2RlID0+IG5vZGUubGFiZWxcbiAgICAgICAgOiBub2RlID0+IG5vZGUudmFsdWVbaW5wdXRPcHRpb25zLm5vZGVBdHRyaWJ1dGVdO1xuICAgICAgY29ubmVjdFdoZW4gPSAoZWRnZSwgbm9kZSkgPT4gZ2V0RWRnZVZhbHVlKGVkZ2UpID09PSBnZXROb2RlVmFsdWUobm9kZSk7XG4gICAgfVxuXG4gICAgbGV0IGVkZ2VzO1xuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgIGlmIChpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlciB8fFxuICAgICAgICAgIGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyKSB7XG4gICAgICAgIGVkZ2VzID0gYXdhaXQgaW5wdXRPcHRpb25zLmVkZ2VzLmdldE1lbWJlcnMoKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmVkZ2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlciB8fFxuICAgICAgICAgICAgICAgICBpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikge1xuICAgICAgICBlZGdlcyA9IGlucHV0T3B0aW9ucy5lZGdlcy5nZXRDb250ZW50cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYGlucHV0T3B0aW9ucy5lZGdlcyBpcyBvZiB1bmV4cGVjdGVkIHR5cGUgJHtpbnB1dE9wdGlvbnMuZWRnZXMgJiYgaW5wdXRPcHRpb25zLmVkZ2VzLnR5cGV9YCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVkZ2VzID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgfVxuXG4gICAgbGV0IGVkZ2VMaXN0ID0gT2JqZWN0LnZhbHVlcyhlZGdlcyk7XG4gICAgaWYgKGVkZ2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgb3V0cHV0Lndhcm4oYE5vIGVkZ2VzIHN1cHBsaWVkIHRvIGF0dGFjaCBvcGVyYXRpb25gKTtcbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSBrbm93IGVub3VnaCB0byBkZWFsIHdpdGggJ1dpdGhpbiBTZWxlY3Rpb24nIG1vZGU6XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnV2l0aGluIFNlbGVjdGlvbicpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24oZWRnZXMsIGNvbm5lY3RXaGVuLCBpbnB1dE9wdGlvbnMuZGlyZWN0aW9uLCBvdXRwdXQpO1xuICAgIH1cblxuICAgIGxldCBub2RlcztcbiAgICBpZiAoaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgU2VsZWN0aW9uKSB7XG4gICAgICBub2RlcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5ub2Rlcy5pdGVtcygpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyKSB7XG4gICAgICBub2RlcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5ub2Rlcy5nZXRNZW1iZXJzKCk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICAgICAgICAgaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcikge1xuICAgICAgbm9kZXMgPSBpbnB1dE9wdGlvbnMubm9kZXMuZ2V0Q29udGVudHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0Lndhcm4oYGlucHV0T3B0aW9ucy5ub2RlcyBpcyBvZiB1bmV4cGVjdGVkIHR5cGUgJHtpbnB1dE9wdGlvbnMubm9kZXMgJiYgaW5wdXRPcHRpb25zLm5vZGVzLnR5cGV9YCk7XG4gICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVMaXN0ID0gT2JqZWN0LnZhbHVlcyhub2Rlcyk7XG4gICAgaWYgKG5vZGVMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgb3V0cHV0Lndhcm4oJ05vIG5vZGVzIHN1cHBsaWVkIHRvIGF0dGFjaCBvcGVyYXRpb24nKTtcbiAgICB9XG5cbiAgICAvLyBBdHRhY2ggdGhlIGVkZ2VzIVxuICAgIGVkZ2VMaXN0LmZvckVhY2goZWRnZSA9PiB7XG4gICAgICBub2RlTGlzdC5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgICBpZiAoZWRnZSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlciAmJlxuICAgICAgICAgICAgbm9kZSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJlxuICAgICAgICAgICAgY29ubmVjdFdoZW4oZWRnZSwgbm9kZSkpIHtcbiAgICAgICAgICBlZGdlLmF0dGFjaFRvKG5vZGUsIGlucHV0T3B0aW9ucy5kaXJlY3Rpb24pO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MoZWRnZS5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2Mobm9kZS5kb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dGFjaE9wZXJhdGlvbjtcbiIsImltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBBdHRyaWJ1dGVPcHRpb24gZnJvbSAnLi9Db21tb24vQXR0cmlidXRlT3B0aW9uLmpzJztcbmltcG9ydCBDbGFzc09wdGlvbiBmcm9tICcuL0NvbW1vbi9DbGFzc09wdGlvbi5qcyc7XG5cbmNsYXNzIEFzc2lnbkNsYXNzT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnU3RyaW5nJywgJ0F0dHJpYnV0ZSddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnU3RyaW5nJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG4gICAgY29udGV4dC5zcGVjc1snU3RyaW5nJ10uYWRkT3B0aW9uKG5ldyBDbGFzc09wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY2xhc3NOYW1lJyxcbiAgICAgIG9wZW5FbmRlZDogdHJ1ZVxuICAgIH0pKTtcbiAgICBjb250ZXh0LnNwZWNzWydBdHRyaWJ1dGUnXS5hZGRPcHRpb24obmV3IEF0dHJpYnV0ZU9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnYXR0cmlidXRlJ1xuICAgIH0pKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgcG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHJldHVybiAoYXdhaXQgc3VwZXIuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKSkgfHxcbiAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgbGV0IGNsYXNzTmFtZSA9IGlucHV0T3B0aW9ucy5jbGFzc05hbWU7XG4gICAgaWYgKCFpbnB1dE9wdGlvbnMuY2xhc3NOYW1lKSB7XG4gICAgICBpZiAoIWlucHV0T3B0aW9ucy5hdHRyaWJ1dGUpIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYE5vIGNsYXNzTmFtZSBvciBhdHRyaWJ1dGUgb3B0aW9uIHN1cHBsaWVkYCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgICBpZiAoaXRlbS5nZXRWYWx1ZSkge1xuICAgICAgICBjbGFzc05hbWUgPSBhd2FpdCBpdGVtLmdldFZhbHVlKGlucHV0T3B0aW9ucy5hdHRyaWJ1dGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYENhbid0IGdldCBhdHRyaWJ1dGVzIGZyb20gJHtpdGVtLnR5cGV9IGluc3RhbmNlYCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgICBpZiAoIWNsYXNzTmFtZSkge1xuICAgICAgICBvdXRwdXQud2FybihgJHtpdGVtLnR5cGV9IGluc3RhbmNlIG1pc3NpbmcgYXR0cmlidXRlICR7aW5wdXRPcHRpb25zLmF0dHJpYnV0ZX1gKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpdGVtLmFkZENsYXNzKSB7XG4gICAgICBvdXRwdXQud2FybihgQ2FuJ3QgYXNzaWduIGNsYXNzIHRvIG5vbi10YWdnYWJsZSAke2l0ZW0udHlwZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXRlbS5hZGRDbGFzcyhjbGFzc05hbWUpO1xuICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhpdGVtLmRvYyk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXNzaWduQ2xhc3NPcGVyYXRpb247XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJ3VraSc7XG5pbXBvcnQgU2VsZWN0aW9uIGZyb20gJy4vU2VsZWN0aW9uLmpzJztcblxuaW1wb3J0IFJvb3RXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvUm9vdFdyYXBwZXIuanMnO1xuaW1wb3J0IERvY3VtZW50V3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL0RvY3VtZW50V3JhcHBlci5qcyc7XG5pbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuaW1wb3J0IEludmFsaWRXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvSW52YWxpZFdyYXBwZXIuanMnO1xuaW1wb3J0IE51bGxXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvTnVsbFdyYXBwZXIuanMnO1xuaW1wb3J0IEJvb2xlYW5XcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvQm9vbGVhbldyYXBwZXIuanMnO1xuaW1wb3J0IE51bWJlcldyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9OdW1iZXJXcmFwcGVyLmpzJztcbmltcG9ydCBTdHJpbmdXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvU3RyaW5nV3JhcHBlci5qcyc7XG5pbXBvcnQgRGF0ZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9EYXRlV3JhcHBlci5qcyc7XG5pbXBvcnQgUmVmZXJlbmNlV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1JlZmVyZW5jZVdyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9Db250YWluZXJXcmFwcGVyLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcbmltcG9ydCBTZXRXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvU2V0V3JhcHBlci5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5pbXBvcnQgU3VwZXJub2RlV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1N1cGVybm9kZVdyYXBwZXIuanMnO1xuXG5pbXBvcnQgU2VsZWN0QWxsT3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9TZWxlY3RBbGxPcGVyYXRpb24uanMnO1xuaW1wb3J0IEZpbHRlck9wZXJhdGlvbiBmcm9tICcuL09wZXJhdGlvbnMvRmlsdGVyT3BlcmF0aW9uLmpzJztcbmltcG9ydCBDb252ZXJ0T3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9Db252ZXJ0T3BlcmF0aW9uLmpzJztcbmltcG9ydCBDb25uZWN0T3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9Db25uZWN0T3BlcmF0aW9uLmpzJztcbmltcG9ydCBBdHRhY2hPcGVyYXRpb24gZnJvbSAnLi9PcGVyYXRpb25zL0F0dGFjaE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgQXNzaWduQ2xhc3NPcGVyYXRpb24gZnJvbSAnLi9PcGVyYXRpb25zL0Fzc2lnbkNsYXNzT3BlcmF0aW9uLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIE1vZGVsIHtcbiAgY29uc3RydWN0b3IgKFBvdWNoREIsIGQzLCBkM24pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuUG91Y2hEQiA9IFBvdWNoREI7IC8vIGNvdWxkIGJlIHBvdWNoZGItbm9kZSBvciBwb3VjaGRiLWJyb3dzZXJcbiAgICB0aGlzLmQzID0gZDM7IC8vIGZvciBOb2RlLmpzLCB0aGlzIHdpbGwgYmUgZnJvbSBkMy1ub2RlLCBub3QgdGhlIHJlZ3VsYXIgb25lXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgaWYgKGQzbikge1xuICAgICAgLy8gdG8gcnVuIHRlc3RzLCB3ZSBhbHNvIG5lZWQgYWNjZXNzIHRvIHRoZSBkMy1ub2RlIHdyYXBwZXIgKHdlIGRvbid0XG4gICAgICAvLyBpbXBvcnQgaXQgZGlyZWN0bHkgaW50byB0aGUgdGVzdHMgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIG5hbWVzcGFjZVxuICAgICAgLy8gYWRkaXRpb24gYmVsb3cgd29ya3MpXG4gICAgICB0aGlzLmQzbiA9IGQzbjtcbiAgICAgIHRoaXMud2luZG93ID0gdGhpcy5kM24ud2luZG93O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLndpbmRvdyA9IHdpbmRvdztcbiAgICB9XG5cbiAgICAvLyBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3Igb3VyIGN1c3RvbSBYTUxcbiAgICB0aGlzLk5TU3RyaW5nID0gJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJztcbiAgICB0aGlzLmQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBPdXIgY3VzdG9tIHR5cGUgZGVmaW5pdGlvbnNcbiAgICB0aGlzLldSQVBQRVJTID0ge1xuICAgICAgUm9vdFdyYXBwZXIsXG4gICAgICBEb2N1bWVudFdyYXBwZXIsXG4gICAgICBQcmltaXRpdmVXcmFwcGVyLFxuICAgICAgSW52YWxpZFdyYXBwZXIsXG4gICAgICBOdWxsV3JhcHBlcixcbiAgICAgIEJvb2xlYW5XcmFwcGVyLFxuICAgICAgTnVtYmVyV3JhcHBlcixcbiAgICAgIFN0cmluZ1dyYXBwZXIsXG4gICAgICBEYXRlV3JhcHBlcixcbiAgICAgIFJlZmVyZW5jZVdyYXBwZXIsXG4gICAgICBDb250YWluZXJXcmFwcGVyLFxuICAgICAgR2VuZXJpY1dyYXBwZXIsXG4gICAgICBTZXRXcmFwcGVyLFxuICAgICAgRWRnZVdyYXBwZXIsXG4gICAgICBOb2RlV3JhcHBlcixcbiAgICAgIFN1cGVybm9kZVdyYXBwZXJcbiAgICB9O1xuXG4gICAgLy8gU3BlY2lhbCBrZXlzIHRoYXQgc2hvdWxkIGJlIHNraXBwZWQgaW4gdmFyaW91cyBvcGVyYXRpb25zXG4gICAgdGhpcy5SRVNFUlZFRF9PQkpfS0VZUyA9IHtcbiAgICAgICdfaWQnOiB0cnVlLFxuICAgICAgJ19yZXYnOiB0cnVlLFxuICAgICAgJyR3YXNBcnJheSc6IHRydWUsXG4gICAgICAnJHRhZ3MnOiB0cnVlLFxuICAgICAgJyRtZW1iZXJzJzogdHJ1ZSxcbiAgICAgICckZWRnZXMnOiB0cnVlLFxuICAgICAgJyRub2Rlcyc6IHRydWUsXG4gICAgICAnJG5leHRMYWJlbCc6IHRydWUsXG4gICAgICAnJGlzRGF0ZSc6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gTW9kZXMgZm9yIGRlcml2aW5nIHNlbGVjdGlvbnNcbiAgICB0aGlzLkRFUklWRV9NT0RFUyA9IHtcbiAgICAgIFJFUExBQ0U6ICdSRVBMQUNFJyxcbiAgICAgIFVOSU9OOiAnVU5JT04nLFxuICAgICAgWE9SOiAnWE9SJ1xuICAgIH07XG5cbiAgICAvLyBBdXRvLW1hcHBpbmdzIGZyb20gbmF0aXZlIGphdmFzY3JpcHQgdHlwZXMgdG8gV3JhcHBlcnNcbiAgICB0aGlzLkpTVFlQRVMgPSB7XG4gICAgICAnbnVsbCc6IE51bGxXcmFwcGVyLFxuICAgICAgJ2Jvb2xlYW4nOiBCb29sZWFuV3JhcHBlcixcbiAgICAgICdudW1iZXInOiBOdW1iZXJXcmFwcGVyXG4gICAgfTtcblxuICAgIC8vIEFsbCB0aGUgc3VwcG9ydGVkIG9wZXJhdGlvbnNcbiAgICBsZXQgb3BlcmF0aW9uQ2xhc3NlcyA9IFtcbiAgICAgIFNlbGVjdEFsbE9wZXJhdGlvbixcbiAgICAgIEZpbHRlck9wZXJhdGlvbixcbiAgICAgIENvbnZlcnRPcGVyYXRpb24sXG4gICAgICBDb25uZWN0T3BlcmF0aW9uLFxuICAgICAgQXR0YWNoT3BlcmF0aW9uLFxuICAgICAgQXNzaWduQ2xhc3NPcGVyYXRpb25cbiAgICBdO1xuICAgIHRoaXMuT1BFUkFUSU9OUyA9IHt9O1xuXG4gICAgLy8gVW5saWtlIFdSQVBQRVJTLCB3ZSBhY3R1YWxseSB3YW50IHRvIGluc3RhbnRpYXRlIGFsbCB0aGUgb3BlcmF0aW9uc1xuICAgIC8vIHdpdGggYSByZWZlcmVuY2UgdG8gdGhpcy4gV2hpbGUgd2UncmUgYXQgaXQsIG1vbmtleSBwYXRjaCB0aGVtIG9udG9cbiAgICAvLyB0aGUgU2VsZWN0aW9uIGNsYXNzXG4gICAgb3BlcmF0aW9uQ2xhc3Nlcy5mb3JFYWNoKE9wZXJhdGlvbiA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gbmV3IE9wZXJhdGlvbih0aGlzKTtcbiAgICAgIHRoaXMuT1BFUkFUSU9OU1t0ZW1wLnR5cGVdID0gdGVtcDtcbiAgICAgIFNlbGVjdGlvbi5wcm90b3R5cGVbdGVtcC5sb3dlckNhbWVsQ2FzZVR5cGVdID0gYXN5bmMgZnVuY3Rpb24gKGlucHV0T3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leGVjdXRlKHRlbXAsIGlucHV0T3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIC8gbG9hZCB0aGUgbG9jYWwgZGF0YWJhc2Ugb2YgZmlsZXNcbiAgICB0aGlzLmdldE9ySW5pdERiKCk7XG5cbiAgICAvLyBpbiB0aGUgYWJzZW5jZSBvZiBhIGN1c3RvbSBkaWFsb2dzLCBqdXN0IHVzZSB3aW5kb3cuYWxlcnQsXG4gICAgLy8gd2luZG93LmNvbmZpcm0sIHdpbmRvdy5wcm9tcHQsIGNvbnNvbGUud2FybiwgYW5kIGNvbnNvbGUubG9nOlxuICAgIHRoaXMuYWxlcnQgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy53aW5kb3cuYWxlcnQobWVzc2FnZSk7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMuY29uZmlybSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHRoaXMud2luZG93LmNvbmZpcm0obWVzc2FnZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLnByb21wdCA9IChtZXNzYWdlLCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUodGhpcy53aW5kb3cucHJvbXB0KG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLndhcm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zb2xlLndhcm4oLi4uYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIHRoaXMubG9nID0gZnVuY3Rpb24gKCkge1xuICAgICAgY29uc29sZS5sb2coLi4uYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG4gIGN1c3RvbWl6ZUFsZXJ0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmFsZXJ0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZUNvbmZpcm1EaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuY29uZmlybSA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVQcm9tcHREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMucHJvbXB0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGdldE9ySW5pdERiICgpIHtcbiAgICB0aGlzLmRiID0gbmV3IHRoaXMuUG91Y2hEQignbXVyZScpO1xuICAgIHRoaXMuZGJTdGF0dXMgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgc3RhdHVzID0geyBzeW5jZWQ6IGZhbHNlIH07XG4gICAgICAgIGxldCBjb3VjaERiVXJsID0gdGhpcy53aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NvdWNoRGJVcmwnKTtcbiAgICAgICAgaWYgKGNvdWNoRGJVcmwpIHtcbiAgICAgICAgICBsZXQgY291Y2hEYiA9IG5ldyB0aGlzLlBvdWNoREIoY291Y2hEYlVybCwge3NraXBfc2V0dXA6IHRydWV9KTtcbiAgICAgICAgICBzdGF0dXMuc3luY2VkID0gISEoYXdhaXQgdGhpcy5kYi5zeW5jKGNvdWNoRGIsIHtsaXZlOiB0cnVlLCByZXRyeTogdHJ1ZX0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5hbGVydCgnRXJyb3Igc3luY2luZyB3aXRoICcgKyBjb3VjaERiVXJsICsgJzogJyArXG4gICAgICAgICAgICAgICAgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdHVzLmluZGV4ZWQgPSAhIShhd2FpdCB0aGlzLmRiLmNyZWF0ZUluZGV4KHtcbiAgICAgICAgICBpbmRleDoge1xuICAgICAgICAgICAgZmllbGRzOiBbJ2ZpbGVuYW1lJ11cbiAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGZhbHNlKSk7XG4gICAgICAgIHN0YXR1cy5saW5rZWRVc2VyU2VsZWN0aW9uID0gISEoYXdhaXQgdGhpcy5kYi5wdXQoe1xuICAgICAgICAgIF9pZDogJyRsaW5rZWRVc2VyU2VsZWN0aW9uJyxcbiAgICAgICAgICBzZWxlY3Rvckxpc3Q6IFtdXG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGZhbHNlKSk7XG4gICAgICAgIHN0YXR1cy5saW5rZWRWaWV3U2V0dGluZ3MgPSAhIShhd2FpdCB0aGlzLmRiLnB1dCh7XG4gICAgICAgICAgX2lkOiAnJGxpbmtlZFZpZXdTZXR0aW5ncycsXG4gICAgICAgICAgc2V0dGluZ3M6IHt9XG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGZhbHNlKSk7XG4gICAgICAgIHRoaXMuZGIuY2hhbmdlcyh7XG4gICAgICAgICAgc2luY2U6IChhd2FpdCB0aGlzLmRiLmluZm8oKSkudXBkYXRlX3NlcSAtIDEsXG4gICAgICAgICAgbGl2ZTogdHJ1ZSxcbiAgICAgICAgICBpbmNsdWRlX2RvY3M6IHRydWVcbiAgICAgICAgfSkub24oJ2NoYW5nZScsIGNoYW5nZSA9PiB7XG4gICAgICAgICAgaWYgKGNoYW5nZS5pZCA+ICdfXFx1ZmZmZicpIHtcbiAgICAgICAgICAgIC8vIEEgcmVndWxhciBkb2N1bWVudCBjaGFuZ2VkOyBpbnZhbGlkYXRlIGFsbCBzZWxlY3Rpb24gY2FjaGVzXG4gICAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRvIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICAgIFNlbGVjdGlvbi5JTlZBTElEQVRFX0RPQ19DQUNIRShjaGFuZ2UuaWQpO1xuICAgICAgICAgICAgaWYgKGNoYW5nZS5kb2MuX3Jldi5zZWFyY2goL14xLS8pICE9PSAtMSkge1xuICAgICAgICAgICAgICAvLyBUT0RPOiB0aGlzIGlzIGEgaGFjayB0byBzZWUgaWYgaXQncyBhIG5ld2x5LWFkZGVkIGRvYyAod2Ugd2FudFxuICAgICAgICAgICAgICAvLyB0byBpbnZhbGlkYXRlIGFsbCBzZWxlY3Rpb24gY2FjaGVzLCBiZWNhdXNlIHdlIGhhdmUgbm8gd2F5IHRvXG4gICAgICAgICAgICAgIC8vIGtub3cgaWYgdGhleSdkIHNlbGVjdCB0aGlzIG5ldyBkb2N1bWVudCBvciBub3QpLiBUaGlzIHdvbid0XG4gICAgICAgICAgICAgIC8vIHdvcmsgb25jZSB3ZSBzdGFydCBkZWFsaW5nIHdpdGggcmVwbGljYXRpb24sIGlmIGEgZmlsZSBnZXRzXG4gICAgICAgICAgICAgIC8vIGFkZGVkIHJlbW90ZWx5LiBTZWUgXCJIb3cgY2FuIEkgZGlzdGluZ3Vpc2ggYmV0d2VlbiBhZGRlZCBhbmRcbiAgICAgICAgICAgICAgLy8gbW9kaWZpZWQgZG9jdW1lbnRzXCIgaW4gdGhlIFBvdWNoREIgZG9jdW1lbnRhdGlvbjpcbiAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9wb3VjaGRiLmNvbS9ndWlkZXMvY2hhbmdlcy5odG1sXG4gICAgICAgICAgICAgIFNlbGVjdGlvbi5JTlZBTElEQVRFX0FMTF9DQUNIRVMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZG9jQ2hhbmdlJywgY2hhbmdlLmRvYyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFuZ2UuaWQgPT09ICckbGlua2VkVXNlclNlbGVjdGlvbicpIHtcbiAgICAgICAgICAgIC8vIFRoZSBsaW5rZWQgdXNlciBzZWxlY3Rpb24gY2hhbmdlZFxuICAgICAgICAgICAgdGhpcy5zdGlja3lUcmlnZ2VyKCdsaW5rZWRWaWV3Q2hhbmdlJywge1xuICAgICAgICAgICAgICB1c2VyU2VsZWN0aW9uOiB0aGlzLnNlbGVjdEFsbChjaGFuZ2UuZG9jLnNlbGVjdG9yTGlzdClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhbmdlLmlkID09PSAnJGxpbmtlZFZpZXdTZXR0aW5ncycpIHtcbiAgICAgICAgICAgIC8vIFRoZSBsaW5rZWQgdmlldyBzZXR0aW5ncyBjaGFuZ2VkXG4gICAgICAgICAgICB0aGlzLnN0aWNreVRyaWdnZXIoJ2xpbmtlZFZpZXdDaGFuZ2UnLCB7XG4gICAgICAgICAgICAgIHNldHRpbmdzOiBjaGFuZ2UuZG9jLnNldHRpbmdzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLm9uKCdlcnJvcicsIGVyciA9PiB7XG4gICAgICAgICAgdGhpcy53YXJuKGVycik7XG4gICAgICAgIH0pO1xuICAgICAgICByZXNvbHZlKHN0YXR1cyk7XG4gICAgICB9KSgpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFsbERvY3MgKG9wdGlvbnMgPSB7fSkge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgT2JqZWN0LmFzc2lnbihvcHRpb25zLCB7XG4gICAgICBzdGFydGtleTogJ19cXHVmZmZmJyxcbiAgICAgIGluY2x1ZGVfZG9jczogdHJ1ZVxuICAgIH0pO1xuICAgIGxldCByZXN1bHRzID0gYXdhaXQgdGhpcy5kYi5hbGxEb2NzKG9wdGlvbnMpO1xuICAgIHJldHVybiByZXN1bHRzLnJvd3MubWFwKHJvdyA9PiByb3cuZG9jKTtcbiAgfVxuICBhc3luYyBhbGxEb2NXcmFwcGVycyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmFsbERvY3MoKSlcbiAgICAgIC5tYXAoZG9jID0+IG5ldyB0aGlzLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcih7IG11cmU6IHRoaXMsIGRvYyB9KSk7XG4gIH1cbiAgYXN5bmMgcXVlcnlEb2NzIChxdWVyeU9iaikge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgbGV0IHF1ZXJ5UmVzdWx0ID0gYXdhaXQgdGhpcy5kYi5maW5kKHF1ZXJ5T2JqKTtcbiAgICBpZiAocXVlcnlSZXN1bHQud2FybmluZykgeyB0aGlzLndhcm4ocXVlcnlSZXN1bHQud2FybmluZyk7IH1cbiAgICByZXR1cm4gcXVlcnlSZXN1bHQuZG9jcztcbiAgfVxuICAvKipcbiAgICogQSB3cmFwcGVyIGFyb3VuZCBQb3VjaERCLmdldCgpIHRoYXQgZW5zdXJlcyB0aGF0IHRoZSBmaXJzdCBtYXRjaGVkXG4gICAqIGRvY3VtZW50IGV4aXN0cyAob3B0aW9uYWxseSBjcmVhdGVzIGFuIGVtcHR5IGRvY3VtZW50IHdoZW4gaXQgZG9lc24ndCksIGFuZFxuICAgKiB0aGF0IGl0IGNvbmZvcm1zIHRvIHRoZSBzcGVjaWZpY2F0aW9ucyBvdXRsaW5lZCBpbiBkb2N1bWVudGF0aW9uL3NjaGVtYS5tZFxuICAgKiBAcGFyYW0gIHtPYmplY3R8c3RyaW5nfSAgW2RvY1F1ZXJ5XVxuICAgKiBUaGUgYHNlbGVjdG9yYCBjb21wb25lbnQgb2YgYSBNYW5nbyBxdWVyeSwgb3IsIGlmIGEgc3RyaW5nLCB0aGUgcHJlY2lzZVxuICAgKiBkb2N1bWVudCBfaWRcbiAgICogQHBhcmFtICB7e2Jvb2xlYW59fSAgW2luaXQ9dHJ1ZV1cbiAgICogSWYgdHJ1ZSAoZGVmYXVsdCksIHRoZSBkb2N1bWVudCB3aWxsIGJlIGNyZWF0ZWQgKGJ1dCBub3Qgc2F2ZWQpIGlmIGl0IGRvZXNcbiAgICogbm90IGV4aXN0LiBJZiBmYWxzZSwgdGhlIHJldHVybmVkIFByb21pc2Ugd2lsbCByZXNvbHZlIHRvIG51bGxcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICogUmVzb2x2ZXMgdGhlIGRvY3VtZW50XG4gICAqL1xuICBhc3luYyBnZXREb2MgKGRvY1F1ZXJ5LCB7IGluaXQgPSB0cnVlIH0gPSB7fSkge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgbGV0IGRvYztcbiAgICBpZiAoIWRvY1F1ZXJ5KSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIubGF1bmNoU3RhbmRhcmRpemF0aW9uKHsgZG9jOiB7fSwgbXVyZTogdGhpcyB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBkb2NRdWVyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGRvY1F1ZXJ5WzBdID09PSAnQCcpIHtcbiAgICAgICAgICBkb2NRdWVyeSA9IEpTT04ucGFyc2UoZG9jUXVlcnkuc2xpY2UoMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRvY1F1ZXJ5ID0geyAnX2lkJzogZG9jUXVlcnkgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG1hdGNoaW5nRG9jcyA9IGF3YWl0IHRoaXMucXVlcnlEb2NzKHsgc2VsZWN0b3I6IGRvY1F1ZXJ5LCBsaW1pdDogMSB9KTtcbiAgICAgIGlmIChtYXRjaGluZ0RvY3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgLy8gSWYgbWlzc2luZywgdXNlIHRoZSBkb2NRdWVyeSBpdHNlbGYgYXMgdGhlIHRlbXBsYXRlIGZvciBhIG5ldyBkb2NcbiAgICAgICAgICBkb2MgPSBhd2FpdCB0aGlzLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlci5sYXVuY2hTdGFuZGFyZGl6YXRpb24oeyBkb2M6IGRvY1F1ZXJ5LCBtdXJlOiB0aGlzIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb2MgPSBtYXRjaGluZ0RvY3NbMF07XG4gICAgICB9XG4gICAgICByZXR1cm4gZG9jO1xuICAgIH1cbiAgfVxuICBhc3luYyBwdXREb2MgKGRvYykge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLmRiLnB1dChkb2MpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy53YXJuKGVyci5tZXNzYWdlKTtcbiAgICAgIHJldHVybiBlcnI7XG4gICAgfVxuICB9XG4gIGFzeW5jIHB1dERvY3MgKGRvY0xpc3QpIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIC8vIFBvdWNoREIgZG9lc24ndCBzdXBwb3J0IHRyYW5zYWN0aW9ucywgc28gd2Ugd2FudCB0byBiZSBhYmxlIHRvIHJvbGwgYmFja1xuICAgIC8vIGFueSBjaGFuZ2VzIGluIHRoZSBldmVudCB0aGF0IG91ciB1cGRhdGUgZmFpbHNcbiAgICBjb25zdCBwcmV2aW91c0RvY3MgPSAoYXdhaXQgdGhpcy5kYi5maW5kKHtcbiAgICAgIHNlbGVjdG9yOiB7JyRvcic6IGRvY0xpc3QubWFwKGRvYyA9PiB7XG4gICAgICAgIHJldHVybiB7IF9pZDogZG9jLl9pZCB9O1xuICAgICAgfSl9XG4gICAgfSkpLmRvY3M7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kYi5idWxrRG9jcyhkb2NMaXN0KTtcbiAgICBsZXQgbmV3UmV2cyA9IHt9O1xuICAgIGxldCBlcnJvck1lc3NhZ2VzID0ge307XG4gICAgbGV0IGVycm9yU2VlbiA9IGZhbHNlO1xuICAgIHJlc3VsdC5mb3JFYWNoKHJlc3VsdE9iaiA9PiB7XG4gICAgICBpZiAocmVzdWx0T2JqLmVycm9yKSB7XG4gICAgICAgIGVycm9yU2VlbiA9IHRydWU7XG4gICAgICAgIGVycm9yTWVzc2FnZXNbcmVzdWx0T2JqLm1lc3NhZ2VdID0gZXJyb3JNZXNzYWdlc1tyZXN1bHRPYmoubWVzc2FnZV0gfHwgW107XG4gICAgICAgIGVycm9yTWVzc2FnZXNbcmVzdWx0T2JqLm1lc3NhZ2VdLnB1c2gocmVzdWx0T2JqLmlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1JldnNbcmVzdWx0T2JqLmlkXSA9IHJlc3VsdE9iai5yZXY7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGVycm9yU2Vlbikge1xuICAgICAgLy8gV2UgbmVlZCB0byByZXZlcnQgYW55IGRvY3VtZW50cyB0aGF0IHdlcmUgc3VjY2Vzc2Z1bFxuICAgICAgY29uc3QgcmV2ZXJ0ZWREb2NzID0gcHJldmlvdXNEb2NzLmZpbHRlcihkb2MgPT4ge1xuICAgICAgICBpZiAobmV3UmV2c1tkb2MuX2lkXSkge1xuICAgICAgICAgIGRvYy5fcmV2ID0gbmV3UmV2c1tkb2MuX2lkXTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gVE9ETzogd2hhdCBpZiBUSElTIGZhaWxzP1xuICAgICAgYXdhaXQgdGhpcy5kYi5idWxrRG9jcyhyZXZlcnRlZERvY3MpO1xuICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoT2JqZWN0LmVudHJpZXMoZXJyb3JNZXNzYWdlcykubWFwKChbbWVzc2FnZSwgaWRzXSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7bWVzc2FnZX1cXG5BZmZlY3RlZCBEb2N1bWVudHM6XFxuICAke2lkcy5qb2luKCdcXG4gICcpfWA7XG4gICAgICB9KS5qb2luKCdcXG5cXG4nKSk7XG4gICAgICBlcnJvci5lcnJvciA9IHRydWU7XG4gICAgICByZXR1cm4gZXJyb3I7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgLyoqXG4gICAqIERvd25sb2FkcyBhIGdpdmVuIGZpbGUsIG9wdGlvbmFsbHkgc3BlY2lmeWluZyBhIHBhcnRpY3VsYXIgZm9ybWF0XG4gICAqIEBwYXJhbSAge09iamVjdHxzdHJpbmd9ICBkb2NRdWVyeVxuICAgKiBUaGUgYHNlbGVjdG9yYCBjb21wb25lbnQgb2YgYSBNYW5nbyBxdWVyeSwgb3IsIGlmIGEgc3RyaW5nLCB0aGUgcHJlY2lzZVxuICAgKiBkb2N1bWVudCBfaWRcbiAgICogQHBhcmFtICB7e3N0cmluZ3xudWxsfX0gIFttaW1lVHlwZT1udWxsXVxuICAgKiBPdmVycmlkZXMgdGhlIGRvY3VtZW50J3MgbWltZVR5cGUgaW4gZm9ybWF0dGluZyB0aGUgZG93bmxvYWRcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICogUmVzb2x2ZXMgYXMgYHRydWVgIG9uY2UgdGhlIGRvd25sb2FkIGlzIGluaXRpYXRlZFxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWREb2MgKGRvY1F1ZXJ5LCB7IG1pbWVUeXBlID0gbnVsbCB9ID0ge30pIHtcbiAgICByZXR1cm4gdGhpcy5nZXREb2MoZG9jUXVlcnkpXG4gICAgICAudGhlbihkb2MgPT4ge1xuICAgICAgICBtaW1lVHlwZSA9IG1pbWVUeXBlIHx8IGRvYy5taW1lVHlwZTtcbiAgICAgICAgbGV0IGNvbnRlbnRzID0gdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIuZm9ybWF0RG9jKGRvYywgeyBtaW1lVHlwZSB9KTtcblxuICAgICAgICAvLyBjcmVhdGUgYSBmYWtlIGxpbmsgdG8gaW5pdGlhdGUgdGhlIGRvd25sb2FkXG4gICAgICAgIGxldCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBhLnN0eWxlID0gJ2Rpc3BsYXk6bm9uZSc7XG4gICAgICAgIGxldCB1cmwgPSB0aGlzLndpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyB3aW5kb3cuQmxvYihbY29udGVudHNdLCB7IHR5cGU6IG1pbWVUeXBlIH0pKTtcbiAgICAgICAgYS5ocmVmID0gdXJsO1xuICAgICAgICBhLmRvd25sb2FkID0gZG9jLl9pZDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICAgICAgYS5jbGljaygpO1xuICAgICAgICB0aGlzLndpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgIGEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICB9XG4gIGFzeW5jIHVwbG9hZEZpbGVPYmogKGZpbGVPYmosIHsgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSwgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsIH0gPSB7fSkge1xuICAgIGxldCBzdHJpbmcgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHdpbmRvdy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy51cGxvYWRTdHJpbmcoZmlsZU9iai5uYW1lLCBmaWxlT2JqLnR5cGUsIGVuY29kaW5nLCBzdHJpbmcsIGV4dGVuc2lvbk92ZXJyaWRlKTtcbiAgfVxuICBhc3luYyB1cGxvYWRTdHJpbmcgKGZpbGVuYW1lLCBtaW1lVHlwZSwgZW5jb2RpbmcsIHN0cmluZywgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsKSB7XG4gICAgY29uc3QgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24obWltZVR5cGUgfHwgbWltZS5sb29rdXAoZmlsZW5hbWUpKSB8fCAndHh0JztcbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgZG9jID0gYXdhaXQgdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIucGFyc2Uoc3RyaW5nLCBleHRlbnNpb24pO1xuICAgIHJldHVybiB0aGlzLnVwbG9hZERvYyhmaWxlbmFtZSwgbWltZVR5cGUsIGVuY29kaW5nLCBkb2MpO1xuICB9XG4gIGFzeW5jIHVwbG9hZERvYyAoZmlsZW5hbWUsIG1pbWVUeXBlLCBlbmNvZGluZywgZG9jKSB7XG4gICAgZG9jLmZpbGVuYW1lID0gZmlsZW5hbWUgfHwgZG9jLmZpbGVuYW1lO1xuICAgIGRvYy5taW1lVHlwZSA9IG1pbWVUeXBlIHx8IGRvYy5taW1lVHlwZSB8fCBtaW1lLmxvb2t1cChmaWxlbmFtZSk7XG4gICAgZG9jLmNoYXJzZXQgPSBlbmNvZGluZyB8fCBkb2MuY2hhcnNldCB8fCBtaW1lLmNoYXJzZXQoZG9jLm1pbWVUeXBlKTtcbiAgICBkb2MgPSBhd2FpdCB0aGlzLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlci5sYXVuY2hTdGFuZGFyZGl6YXRpb24oeyBkb2MsIG11cmU6IHRoaXMgfSk7XG4gICAgaWYgKCEoYXdhaXQgdGhpcy5wdXREb2MoZG9jKSkub2spIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5zZWxlY3RBbGwoYEB7XCJfaWRcIjpcIiR7ZG9jLl9pZH1cIn0kYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGRlbGV0ZURvYyAoZG9jUXVlcnkpIHtcbiAgICBsZXQgZG9jID0gYXdhaXQgdGhpcy5nZXREb2MoZG9jUXVlcnkpO1xuICAgIHJldHVybiB0aGlzLnB1dERvYyh7XG4gICAgICBfaWQ6IGRvYy5faWQsXG4gICAgICBfcmV2OiBkb2MuX3JldixcbiAgICAgIF9kZWxldGVkOiB0cnVlXG4gICAgfSk7XG4gIH1cbiAgc2VsZWN0RG9jIChkb2NJZCkge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdEFsbCgnQHtcIl9pZFwiOlwiJyArIGRvY0lkICsgJ1wifSQnKTtcbiAgfVxuICBzZWxlY3RBbGwgKHNlbGVjdG9yTGlzdCkge1xuICAgIHJldHVybiBuZXcgU2VsZWN0aW9uKHRoaXMsIHNlbGVjdG9yTGlzdCk7XG4gIH1cbiAgYXN5bmMgc2V0TGlua2VkVmlld3MgKHsgdXNlclNlbGVjdGlvbiwgc2V0dGluZ3MgfSA9IHt9KSB7XG4gICAgYXdhaXQgdGhpcy5kYlN0YXR1cztcbiAgICBsZXQgZG9jcyA9IFtdO1xuICAgIGlmICh1c2VyU2VsZWN0aW9uKSB7XG4gICAgICBjb25zdCBsaW5rZWRVc2VyU2VsZWN0aW9uID0gYXdhaXQgdGhpcy5kYi5nZXQoJyRsaW5rZWRVc2VyU2VsZWN0aW9uJyk7XG4gICAgICBsaW5rZWRVc2VyU2VsZWN0aW9uLnNlbGVjdG9yTGlzdCA9IHVzZXJTZWxlY3Rpb24uc2VsZWN0b3JMaXN0O1xuICAgICAgZG9jcy5wdXNoKGxpbmtlZFVzZXJTZWxlY3Rpb24pO1xuICAgIH1cbiAgICBpZiAoc2V0dGluZ3MpIHtcbiAgICAgIGNvbnN0IGxpbmtlZFZpZXdTZXR0aW5ncyA9IGF3YWl0IHRoaXMuZGIuZ2V0KCckbGlua2VkVmlld1NldHRpbmdzJyk7XG4gICAgICBPYmplY3QuYXNzaWduKGxpbmtlZFZpZXdTZXR0aW5ncy5zZXR0aW5ncywgc2V0dGluZ3MpO1xuICAgICAgZG9jcy5wdXNoKGxpbmtlZFZpZXdTZXR0aW5ncyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnB1dERvY3MoZG9jcyk7XG4gIH1cbiAgYXN5bmMgZ2V0TGlua2VkVmlld3MgKCkge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuZGIuZ2V0KCckbGlua2VkVXNlclNlbGVjdGlvbicpLFxuICAgICAgdGhpcy5kYi5nZXQoJyRsaW5rZWRWaWV3U2V0dGluZ3MnKVxuICAgIF0pO1xuICAgIHJldHVybiB7XG4gICAgICB1c2VyU2VsZWN0aW9uOiB0aGlzLnNlbGVjdEFsbCh0ZW1wWzBdLnNlbGVjdG9yTGlzdCksXG4gICAgICBzZXR0aW5nczogdGVtcFsxXS5zZXR0aW5nc1xuICAgIH07XG4gIH1cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBsZXQgY2h1bmtzID0gL0BcXHMqKHsuKn0pP1xccyooXFwkW17ihpHihpJdKik/XFxzKijihpEqKVxccyoo4oaSKT8oLiopLy5leGVjKHNlbGVjdG9yU3RyaW5nKTtcbiAgICBpZiAoIWNodW5rcyB8fCBjaHVua3NbNV0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBsZXQgcGFyc2VkRG9jUXVlcnkgPSBjaHVua3NbMV0gPyBKU09OLnBhcnNlKGNodW5rc1sxXS50cmltKCkpIDogSlNPTi5wYXJzZShTZWxlY3Rpb24uREVGQVVMVF9ET0NfUVVFUlkpO1xuICAgIHJldHVybiB7XG4gICAgICBkb2NRdWVyeTogY2h1bmtzWzFdID8gY2h1bmtzWzFdLnRyaW0oKSA6IFNlbGVjdGlvbi5ERUZBVUxUX0RPQ19RVUVSWSxcbiAgICAgIHBhcnNlZERvY1F1ZXJ5LFxuICAgICAgb2JqUXVlcnk6IGNodW5rc1syXSA/IGNodW5rc1syXS50cmltKCkgOiAnJyxcbiAgICAgIHBhcmVudFNoaWZ0OiBjaHVua3NbM10gPyBjaHVua3NbM10ubGVuZ3RoIDogMCxcbiAgICAgIGZvbGxvd0xpbmtzOiAhIWNodW5rc1s0XVxuICAgIH07XG4gIH1cbiAgcGF0aFRvU2VsZWN0b3IgKHBhdGggPSBbU2VsZWN0aW9uLkRFRkFVTFRfRE9DX1FVRVJZXSkge1xuICAgIGxldCBkb2NRdWVyeSA9IHBhdGhbMF07XG4gICAgbGV0IG9ialF1ZXJ5ID0gcGF0aC5zbGljZSgxKTtcbiAgICBvYmpRdWVyeSA9IG9ialF1ZXJ5Lmxlbmd0aCA+IDAgPyBqc29uUGF0aC5zdHJpbmdpZnkob2JqUXVlcnkpIDogJyc7XG4gICAgcmV0dXJuICdAJyArIGRvY1F1ZXJ5ICsgb2JqUXVlcnk7XG4gIH1cbiAgaWRUb1VuaXF1ZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZywgZG9jSWQpIHtcbiAgICBjb25zdCBjaHVua3MgPSAvQFteJF0qKFxcJC4qKS8uZXhlYyhzZWxlY3RvclN0cmluZyk7XG4gICAgcmV0dXJuIGBAe1wiX2lkXCI6XCIke2RvY0lkfVwifSR7Y2h1bmtzWzFdfWA7XG4gIH1cbiAgZXh0cmFjdERvY1F1ZXJ5IChzZWxlY3RvclN0cmluZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IC9AXFxzKih7Lip9KS8uZXhlYyhzZWxlY3RvclN0cmluZyk7XG4gICAgaWYgKHJlc3VsdCAmJiByZXN1bHRbMV0pIHtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHJlc3VsdFsxXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICBleHRyYWN0Q2xhc3NJbmZvRnJvbUlkIChpZCkge1xuICAgIGNvbnN0IHRlbXAgPSAvQFteJF0qXFwkXFwuY2xhc3NlcyhcXC5bXlxcc+KGkeKGki5dKyk/KFxcW1wiW15cIl0rXCJdKT8vLmV4ZWMoaWQpO1xuICAgIGlmICh0ZW1wICYmICh0ZW1wWzFdIHx8IHRlbXBbMl0pKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjbGFzc1BhdGhDaHVuazogdGVtcFsxXSB8fCB0ZW1wWzJdLFxuICAgICAgICBjbGFzc05hbWU6IHRlbXBbMV0gPyB0ZW1wWzFdLnNsaWNlKDEpIDogdGVtcFsyXS5zbGljZSgyLCB0ZW1wWzJdLmxlbmd0aCAtIDIpXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbiAgaW5mZXJUeXBlICh2YWx1ZSwgYWdncmVzc2l2ZSA9IGZhbHNlKSB7XG4gICAgY29uc3QganNUeXBlID0gdHlwZW9mIHZhbHVlO1xuICAgIGlmICh0aGlzLkpTVFlQRVNbanNUeXBlXSkge1xuICAgICAgcmV0dXJuIHRoaXMuSlNUWVBFU1tqc1R5cGVdO1xuICAgIH0gZWxzZSBpZiAoanNUeXBlID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gQXR0ZW1wdCB0byBwYXJzZSBhcyBhIHJlZmVyZW5jZVxuICAgICAgaWYgKHZhbHVlWzBdID09PSAnQCcgJiYgdGhpcy5wYXJzZVNlbGVjdG9yKHZhbHVlKSAhPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5SZWZlcmVuY2VXcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gTm90IGEgcmVmZXJlbmNlLi4uXG4gICAgICBpZiAoYWdncmVzc2l2ZSkge1xuICAgICAgICAvLyBBZ2dyZXNzaXZlbHkgYXR0ZW1wdCB0byBpZGVudGlmeSBzb21ldGhpbmcgbW9yZSBzcGVjaWZpYyB0aGFuIHN0cmluZ1xuICAgICAgICBpZiAoIWlzTmFOKE51bWJlcih2YWx1ZSkpKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcjtcbiAgICAgICAgLypcbiAgICAgICAgIEZvciBub3csIHdlIGRvbid0IGF0dGVtcHQgdG8gaWRlbnRpZnkgZGF0ZXMsIGV2ZW4gaW4gYWdncmVzc2l2ZSBtb2RlLFxuICAgICAgICAgYmVjYXVzZSB0aGluZ3MgbGlrZSBuZXcgRGF0ZSgnUGxheWVyIDEnKSB3aWxsIHN1Y2Nlc3NmdWxseSBwYXJzZSBhcyBhXG4gICAgICAgICBkYXRlLiBJZiB3ZSBjYW4gZmluZCBzbWFydGVyIHdheXMgdG8gYXV0by1pbmZlciBkYXRlcyAoZS5nLiBkb2VzIHRoZVxuICAgICAgICAgdmFsdWUgZmFsbCBzdXNwaWNpb3VzbHkgbmVhciB0aGUgdW5peCBlcG9jaCwgeTJrLCBvciBtb3JlIHRoYW4gKy8tNTAwXG4gICAgICAgICB5ZWFycyBmcm9tIG5vdz8gRG8gc2libGluZyBjb250YWluZXIgaXRlbXMgcGFyc2UgdGhpcyBhcyBhIGRhdGU/KSwgdGhlblxuICAgICAgICAgbWF5YmUgd2UnbGwgYWRkIHRoaXMgYmFjay4uLlxuICAgICAgICAqL1xuICAgICAgICAvLyB9IGVsc2UgaWYgKCFpc05hTihuZXcgRGF0ZSh2YWx1ZSkpKSB7XG4gICAgICAgIC8vICByZXR1cm4gV1JBUFBFUlMuRGF0ZVdyYXBwZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IHZhbHVlLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgaWYgKHRlbXAgPT09ICd0cnVlJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuQm9vbGVhbldyYXBwZXI7XG4gICAgICAgICAgfSBlbHNlIGlmICh0ZW1wID09PSAnZmFsc2UnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcjtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRlbXAgPT09ICdudWxsJykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuTnVsbFdyYXBwZXI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBpdCdzIGp1c3QgYSBzdHJpbmdcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLlN0cmluZ1dyYXBwZXI7XG4gICAgfSBlbHNlIGlmIChqc1R5cGUgPT09ICdmdW5jdGlvbicgfHwganNUeXBlID09PSAnc3ltYm9sJyB8fCBqc1R5cGUgPT09ICd1bmRlZmluZWQnIHx8IHZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkludmFsaWRXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLk51bGxXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlIHx8IHZhbHVlLiRpc0RhdGUgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkRhdGVXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuJG5vZGVzKSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKHZhbHVlLiRlZGdlcykge1xuICAgICAgaWYgKHZhbHVlLiRtZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHZhbHVlLiRtZW1iZXJzKSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5TZXRXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuJHRhZ3MpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyO1xuICAgIH1cbiAgfVxuICBhc3luYyBmb2xsb3dSZWxhdGl2ZUxpbmsgKHNlbGVjdG9yLCBkb2MpIHtcbiAgICAvLyBUaGlzIHNlbGVjdG9yIHNwZWNpZmllcyB0byBmb2xsb3cgdGhlIGxpbmtcbiAgICBpZiAodHlwZW9mIHNlbGVjdG9yICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBsZXQgZG9jUXVlcnkgPSB0aGlzLmV4dHJhY3REb2NRdWVyeShzZWxlY3Rvcik7XG4gICAgbGV0IGNyb3NzRG9jO1xuICAgIGlmICghZG9jUXVlcnkpIHtcbiAgICAgIHNlbGVjdG9yID0gYEB7XCJfaWRcIjpcIiR7ZG9jLl9pZH1cIn0ke3NlbGVjdG9yLnNsaWNlKDEpfWA7XG4gICAgICBjcm9zc0RvYyA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjcm9zc0RvYyA9IGRvY1F1ZXJ5Ll9pZCAhPT0gZG9jLl9pZDtcbiAgICB9XG4gICAgbGV0IHRlbXBTZWxlY3Rpb247XG4gICAgdHJ5IHtcbiAgICAgIHRlbXBTZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKHRoaXMsIHNlbGVjdG9yKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmIChlcnIuSU5WQUxJRF9TRUxFQ1RPUikge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBkb2NMaXN0cyA9IGNyb3NzRG9jID8gYXdhaXQgdGVtcFNlbGVjdGlvbi5kb2NMaXN0cygpIDogW1sgZG9jIF1dO1xuICAgIHJldHVybiB0ZW1wU2VsZWN0aW9uLml0ZW1zKGRvY0xpc3RzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcbmltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGItYnJvd3Nlcic7XG5pbXBvcnQgUG91Y2hGaW5kIGZyb20gJ3BvdWNoZGItZmluZCc7XG5pbXBvcnQgUG91Y2hBdXRoZW50aWNhdGlvbiBmcm9tICdwb3VjaGRiLWF1dGhlbnRpY2F0aW9uJztcblBvdWNoREIucGx1Z2luKFBvdWNoQXV0aGVudGljYXRpb24pO1xuUG91Y2hEQi5wbHVnaW4oUG91Y2hGaW5kKTtcblxubGV0IG11cmUgPSBuZXcgTXVyZShQb3VjaERCLCBkMyk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJERUZBVUxUX0RPQ19RVUVSWSIsIlNlbGVjdGlvbiIsIm11cmUiLCJzZWxlY3Rvckxpc3QiLCJBcnJheSIsInNlbGVjdG9ycyIsIm1hcCIsInNlbGVjdG9yU3RyaW5nIiwic2VsZWN0b3IiLCJwYXJzZVNlbGVjdG9yIiwiZXJyIiwiRXJyb3IiLCJJTlZBTElEX1NFTEVDVE9SIiwiaGFzaCIsIl9oYXNoIiwibWQ1IiwiSlNPTiIsInN0cmluZ2lmeSIsImRvY1F1ZXJ5Iiwib2JqUXVlcnkiLCJmcm9tIiwicGFyZW50U2hpZnQiLCJkIiwiam9pbiIsImZvbGxvd0xpbmtzIiwiaXNDYWNoZWQiLCJfY2FjaGVkV3JhcHBlcnMiLCJfY2FjaGVkRG9jTGlzdHMiLCJfc3VtbWFyeUNhY2hlcyIsImRvY0xpc3RzIiwiUHJvbWlzZSIsImFsbCIsInF1ZXJ5RG9jcyIsInBhcnNlZERvY1F1ZXJ5IiwiaSIsImxlbmd0aCIsImoiLCJkb2MiLCJDQUNIRURfRE9DUyIsIl9pZCIsInNlbGVjdGlvbnMiLCJpbmRleE9mIiwicHVzaCIsIl9yZXYiLCJjYWNoZWREb2MiLCJpdGVtcyIsInF1ZXVlQXN5bmMiLCJhZGRXcmFwcGVyIiwiaXRlbSIsInVuaXF1ZVNlbGVjdG9yIiwiaW5kZXgiLCJkb2NMaXN0IiwiV1JBUFBFUlMiLCJSb290V3JhcHBlciIsImZvckVhY2giLCJEb2N1bWVudFdyYXBwZXIiLCJkb2NJbmRleCIsIm1hdGNoaW5nV3JhcHBlcnMiLCJqc29uUGF0aCIsIm5vZGVzIiwiaXRlbUluZGV4IiwicGF0aCIsInZhbHVlIiwibG9jYWxQYXRoIiwiUkVTRVJWRURfT0JKX0tFWVMiLCJzbGljZSIsInNwbGljZSIsInF1ZXJ5IiwidmFsdWVzIiwiZm9sbG93UmVsYXRpdmVMaW5rIiwiV3JhcHBlclR5cGUiLCJpbmZlclR5cGUiLCJjb25jYXQiLCJleGVjdXRlIiwib3BlcmF0aW9uIiwiaW5wdXRPcHRpb25zIiwib3V0cHV0U3BlYyIsImV4ZWN1dGVPblNlbGVjdGlvbiIsInBvbGx1dGVkRG9jcyIsIk9iamVjdCIsInNraXBTYXZlIiwia2V5cyIsIndhcm5pbmdzIiwid2FybmluZ1N0cmluZyIsImlnbm9yZUVycm9ycyIsImh1bWFuUmVhZGFibGVUeXBlIiwiZW50cmllcyIsIndhcm5pbmciLCJjb3VudCIsIndhcm4iLCJzYXZlU3VjY2Vzc2Z1bCIsInNhdmVSZXN1bHQiLCJwdXREb2NzIiwiZXJyb3IiLCJtZXNzYWdlIiwiSU5WQUxJREFURV9ET0NfQ0FDSEUiLCJuZXdTZWxlY3RvcnMiLCJzdWJTZWxlY3QiLCJhcHBlbmQiLCJtb2RlIiwic2VsZWN0QWxsIiwiY29udGV4dCIsIm1lcmdlU2VsZWN0aW9uIiwib3RoZXJTZWxlY3Rpb24iLCJnZXRQb3B1bGF0ZWRJbnB1dFNwZWMiLCJpbnB1dFNwZWNzIiwidHlwZSIsImlucHV0U3BlYyIsImdldElucHV0U3BlYyIsInBvcHVsYXRlQ2hvaWNlc0Zyb21TZWxlY3Rpb24iLCJoaXN0b2dyYW1zIiwibnVtQmlucyIsIml0ZW1MaXN0IiwicmVzdWx0IiwiY291bnRQcmltaXRpdmUiLCJjb3VudGVycyIsImNhdGVnb3JpY2FsQmlucyIsInF1YW50aXRhdGl2ZUJpbnMiLCJxdWFudGl0YXRpdmVXcmFwcGVycyIsInF1YW50aXRhdGl2ZVR5cGUiLCJOdW1iZXJXcmFwcGVyIiwicXVhbnRpdGF0aXZlU2NhbGUiLCJkMyIsInNjYWxlTGluZWFyIiwiZG9tYWluIiwiRGF0ZVdyYXBwZXIiLCJzY2FsZVRpbWUiLCJyYXciLCJ0eXBlQmlucyIsIlByaW1pdGl2ZVdyYXBwZXIiLCJnZXRDb250ZW50cyIsImNoaWxkV3JhcHBlciIsImF0dHJpYnV0ZXMiLCJsYWJlbCIsImZpbmFsaXplQmlucyIsIm5pY2UiLCJoaXN0b2dyYW1HZW5lcmF0b3IiLCJoaXN0b2dyYW0iLCJ0aHJlc2hvbGRzIiwidGlja3MiLCJnZXRGbGF0R3JhcGhTY2hlbWEiLCJmbGF0R3JhcGhTY2hlbWEiLCJFZGdlV3JhcHBlciIsImNsYXNzTGlzdCIsImdldENsYXNzZXMiLCJlZGdlQ2xhc3NOYW1lIiwicHNldWRvRWRnZSIsImVkZ2VDbGFzc2VzIiwiJG5vZGVzIiwibm9kZVNlbGVjdG9yIiwiZGlyZWN0aW9ucyIsIm5vZGVXcmFwcGVyIiwibWlzc2luZ05vZGVzIiwibm9kZUNsYXNzTmFtZSIsImRpcmVjdGlvbiIsIk5vZGVXcmFwcGVyIiwicHNldWRvTm9kZSIsIm5vZGVDbGFzc2VzIiwiJGVkZ2VzIiwiZWRnZVNlbGVjdG9yIiwiZWRnZVdyYXBwZXIiLCJtaXNzaW5nRWRnZXMiLCJnZXRJbnRlcnNlY3RlZEdyYXBoU2NoZW1hIiwiYWxsTWV0YU9iakludGVyc2VjdGlvbnMiLCJtZXRhT2JqcyIsImxpbmtlZElkcyIsIm1ldGFPYmoiLCJsaW5rZWRJZCIsImlkVG9VbmlxdWVTZWxlY3RvciIsInNldHMiLCJzZXRMb29rdXAiLCJpdGVtSWRzIiwic29ydCIsInNldEtleSIsInVuZGVmaW5lZCIsImRvY0lkIiwic2VsZWN0aW9uIiwiaW52YWxpZGF0ZUNhY2hlIiwiSU5WQUxJREFURV9BTExfQ0FDSEVTIiwiSW50cm9zcGVjdGFibGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImRlZmluZVByb3BlcnR5IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VXcmFwcGVyIiwicGFyZW50IiwiX3ZhbHVlIiwibmV3VmFsdWUiLCJvdGhlciIsImV4ZWMiLCJuYW1lIiwiZ2V0Qm9pbGVycGxhdGVWYWx1ZSIsInN0YW5kYXJkaXplIiwiaXNCYWRWYWx1ZSIsIlR5cGVkV3JhcHBlciIsImRvY1BhdGhRdWVyeSIsInVuaXF1ZUpzb25QYXRoIiwiVHlwZUVycm9yIiwiSlNUWVBFIiwicGFyZW50V3JhcHBlciIsIlBhcmVudFR5cGUiLCJzdXBlcmNsYXNzIiwiYXR0cmlidXRlIiwidGFyZ2V0IiwiX2NvbnRlbnRXcmFwcGVyIiwiZmlsdGVyIiwiQ29udGFpbmVyV3JhcHBlciIsIkNvbnRhaW5lcldyYXBwZXJNaXhpbiIsIm5leHRMYWJlbCIsInJlZHVjZSIsIm1heCIsImtleSIsInBhcnNlSW50IiwiaXNOYU4iLCJTdHJpbmciLCJjb252ZXJ0QXJyYXkiLCJlbGVtZW50IiwiJHdhc0FycmF5IiwiYWdncmVzc2l2ZSIsIm5lc3RlZFZhbHVlIiwiREFUQUxJQl9GT1JNQVRTIiwiY29udGVudHMiLCJpc1ZhbGlkSWQiLCJ0b0xvd2VyQ2FzZSIsInBhcnRzIiwic3BsaXQiLCJtaW1lIiwiZXh0ZW5zaW9uIiwicGFyc2UiLCJ0ZXh0IiwiZGF0YWxpYiIsInJlYWQiLCJsYXVuY2hTdGFuZGFyZGl6YXRpb24iLCJleGlzdGluZ1VudGl0bGVkcyIsImRiIiwiYWxsRG9jcyIsIm1pbWVUeXBlIiwicm93cyIsImZpbGVuYW1lIiwibWluSW5kZXgiLCJ1RG9jIiwiSW5maW5pdHkiLCJpc0Zpbml0ZSIsImxvb2t1cCIsImNoYXJzZXQiLCJ0b1VwcGVyQ2FzZSIsIm9ycGhhbnMiLCJjbGFzc2VzIiwiSW52YWxpZFdyYXBwZXIiLCJOdWxsV3JhcHBlciIsIkJvb2xlYW5XcmFwcGVyIiwiTnVtYmVyIiwiU3RyaW5nV3JhcHBlciIsIkRhdGUiLCJzdHIiLCJ0b1N0cmluZyIsIiRpc0RhdGUiLCJSZWZlcmVuY2VXcmFwcGVyIiwiR2VuZXJpY1dyYXBwZXIiLCIkdGFncyIsImNsYXNzTmFtZSIsIlNldFdyYXBwZXIiLCJjbGFzc0l0ZW0iLCJhZ2ciLCJzZXRJZCIsImV4dHJhY3RDbGFzc0luZm9Gcm9tSWQiLCJjbGFzc1BhdGhDaHVuayIsIiRtZW1iZXJzIiwiaXRlbVRhZyIsInNldFRhZyIsImdldE1lbWJlcnMiLCJnZXRNZW1iZXJTZWxlY3RvcnMiLCJTZXRXcmFwcGVyTWl4aW4iLCJub2RlIiwibm9kZUlkIiwibm9kZVNlbGVjdG9ycyIsIm5vZGVXcmFwcGVycyIsImZvcndhcmQiLCJub2RlV3JhcHBlckNvdW50Iiwib3Bwb3NpdGVEaXJlY3Rpb24iLCJnbG9tcFZhbHVlIiwiZWRnZUxpc3QiLCJnbG9tcCIsIm90aGVyTm9kZSIsImNvbnRhaW5lciIsIm5ld0VkZ2UiLCJjcmVhdGVOZXdXcmFwcGVyIiwiYXR0YWNoVG8iLCJlZGdlU2VsZWN0b3JzIiwiZWRnZVdyYXBwZXJzIiwiJGVnZGVzIiwiZWRnZVdyYXBwZXJDb3VudCIsIlN1cGVybm9kZVdyYXBwZXIiLCJJbnB1dFNwZWMiLCJvcHRpb25zIiwib3B0aW9uIiwicGFyYW1ldGVyTmFtZSIsInVwZGF0ZUNob2ljZXMiLCJwYXJhbXMiLCJzcGVjcyIsInNwZWMiLCJJbnB1dE9wdGlvbiIsIl9kZWZhdWx0VmFsdWUiLCJkZWZhdWx0VmFsdWUiLCJjaG9pY2VzIiwib3BlbkVuZGVkIiwiaHVtYW5SZWFkYWJsZVBhcmFtZXRlck5hbWUiLCJ0b0xvY2FsZVVwcGVyQ2FzZSIsIk91dHB1dFNwZWMiLCJzcGVjTGlzdCIsIkJhc2VPcGVyYXRpb24iLCJhZGRPcHRpb24iLCJjYW5FeGVjdXRlT25JbnN0YW5jZSIsImV4ZWN1dGVPbkluc3RhbmNlIiwiaXRlbXNJblVzZSIsImFyZ3VtZW50IiwicG90ZW50aWFsbHlFeGVjdXRhYmxlT25TZWxlY3Rpb24iLCJzb21lIiwicG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIiwiY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIiwiZ2V0SXRlbXNJblVzZSIsImNhbkV4ZWN1dGVJbnN0YW5jZXMiLCJldmVyeSIsImNhbkV4ZWN1dGUiLCJvdXRwdXRTcGVjUHJvbWlzZXMiLCJDb250ZXh0dWFsT3B0aW9uIiwiaGlkZGVuQ2hvaWNlcyIsImNob2ljZSIsIlNlbGVjdEFsbE9wZXJhdGlvbiIsIm91dHB1dCIsImFkZFNlbGVjdG9ycyIsImVkZ2UiLCJuZXdTdHJpbmciLCJuZXdTZWxlY3RvciIsIm90aGVyU2VsZWN0b3JMaXN0IiwiU3RyaW5nT3B0aW9uIiwiY2hvaWNlRGljdCIsIkNsYXNzT3B0aW9uIiwicmVzZXQiLCJwb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyIsIkRFRkFVTFRfRklMVEVSX0ZVTkMiLCJGaWx0ZXJPcGVyYXRpb24iLCJmaWx0ZXJGdW5jdGlvbiIsImNvbm5lY3RXaGVuIiwiU3ludGF4RXJyb3IiLCJGdW5jdGlvbiIsIkJhc2VDb252ZXJzaW9uIiwiVGFyZ2V0VHlwZSIsInN0YW5kYXJkVHlwZXMiLCJzcGVjaWFsVHlwZXMiLCJUeXBlIiwic3RhbmRhcmRDb252ZXJzaW9uIiwic3BlY2lhbENvbnZlcnNpb24iLCJOdWxsQ29udmVyc2lvbiIsIkJvb2xlYW5Db252ZXJzaW9uIiwiTnVtYmVyQ29udmVyc2lvbiIsIlN0cmluZ0NvbnZlcnNpb24iLCJHZW5lcmljQ29udmVyc2lvbiIsIk5vZGVDb252ZXJzaW9uIiwiRWRnZUNvbnZlcnNpb24iLCJDb252ZXJ0T3BlcmF0aW9uIiwiY29udmVyc2lvbkxpc3QiLCJDT05WRVJTSU9OUyIsImNvbnZlcnNpb24iLCJhZGRPcHRpb25zVG9TcGVjIiwiY29udmVydEl0ZW0iLCJmbGFnUG9sbHV0ZWREb2MiLCJUeXBlZE9wdGlvbiIsInZhbGlkVHlwZXMiLCJzdWdnZXN0T3JwaGFucyIsIml0ZW1Mb29rdXAiLCJvcnBoYW5Mb29rdXAiLCJBdHRyaWJ1dGVPcHRpb24iLCJwb3B1bGF0ZUZyb21JdGVtIiwiZ2V0QXR0cmlidXRlcyIsImF0dHIiLCJwb3B1bGF0ZUZyb21JdGVtcyIsInVuc2hpZnQiLCJOZXN0ZWRBdHRyaWJ1dGVPcHRpb24iLCJnZXRJdGVtQ2hvaWNlUm9sZSIsIml0ZW1Sb2xlIiwiY2hpbGRyZW4iLCJERUZBVUxUX0NPTk5FQ1RfV0hFTiIsIkNvbm5lY3RPcGVyYXRpb24iLCJ0YXJnZXRzIiwiZXF1YWxzIiwic2F2ZUVkZ2VzSW4iLCJzb3VyY2VzIiwidGFyZ2V0SXRlbXMiLCJhdExlYXN0VHdvTm9kZXMiLCJzb3VyY2VBdHRyaWJ1dGUiLCJ0YXJnZXRBdHRyaWJ1dGUiLCJleGVjdXRlV2l0aGluU2VsZWN0aW9uIiwic291cmNlTGlzdCIsImNvbm5lY3RUbyIsImdldFNvdXJjZVZhbHVlIiwic291cmNlIiwiZ2V0VGFyZ2V0VmFsdWUiLCJkaXJlY3RlZCIsInRhcmdldExpc3QiLCJBdHRhY2hPcGVyYXRpb24iLCJlZGdlcyIsImVkZ2VJdGVtcyIsIm5vZGVJdGVtcyIsIm9uZU5vZGUiLCJvbmVFZGdlIiwiZWRnZUF0dHJpYnV0ZSIsIm5vZGVBdHRyaWJ1dGUiLCJnZXRFZGdlVmFsdWUiLCJnZXROb2RlVmFsdWUiLCJub2RlTGlzdCIsIkFzc2lnbkNsYXNzT3BlcmF0aW9uIiwiZ2V0VmFsdWUiLCJhZGRDbGFzcyIsIk11cmUiLCJNb2RlbCIsIlBvdWNoREIiLCJkM24iLCJ3aW5kb3ciLCJOU1N0cmluZyIsIm5hbWVzcGFjZXMiLCJERVJJVkVfTU9ERVMiLCJKU1RZUEVTIiwib3BlcmF0aW9uQ2xhc3NlcyIsIk9QRVJBVElPTlMiLCJPcGVyYXRpb24iLCJwcm90b3R5cGUiLCJnZXRPckluaXREYiIsImFsZXJ0IiwicmVzb2x2ZSIsInJlamVjdCIsImNvbmZpcm0iLCJwcm9tcHQiLCJhcmd1bWVudHMiLCJsb2ciLCJzaG93RGlhbG9nRnVuY3Rpb24iLCJkYlN0YXR1cyIsInN0YXR1cyIsInN5bmNlZCIsImNvdWNoRGJVcmwiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwiY291Y2hEYiIsInNraXBfc2V0dXAiLCJzeW5jIiwibGl2ZSIsInJldHJ5IiwiY2F0Y2giLCJpbmRleGVkIiwiY3JlYXRlSW5kZXgiLCJsaW5rZWRVc2VyU2VsZWN0aW9uIiwicHV0IiwibGlua2VkVmlld1NldHRpbmdzIiwiY2hhbmdlcyIsImluZm8iLCJ1cGRhdGVfc2VxIiwib24iLCJjaGFuZ2UiLCJpZCIsInNlYXJjaCIsInRyaWdnZXIiLCJzdGlja3lUcmlnZ2VyIiwic2V0dGluZ3MiLCJhc3NpZ24iLCJyZXN1bHRzIiwicm93IiwiYWxsRG9jV3JhcHBlcnMiLCJxdWVyeU9iaiIsInF1ZXJ5UmVzdWx0IiwiZmluZCIsImRvY3MiLCJnZXREb2MiLCJpbml0IiwibWF0Y2hpbmdEb2NzIiwibGltaXQiLCJwdXREb2MiLCJwcmV2aW91c0RvY3MiLCJidWxrRG9jcyIsIm5ld1JldnMiLCJlcnJvck1lc3NhZ2VzIiwiZXJyb3JTZWVuIiwicmVzdWx0T2JqIiwicmV2IiwicmV2ZXJ0ZWREb2NzIiwiaWRzIiwiZG93bmxvYWREb2MiLCJ0aGVuIiwiZm9ybWF0RG9jIiwiYSIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwidXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiQmxvYiIsImhyZWYiLCJkb3dubG9hZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmV2b2tlT2JqZWN0VVJMIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwidXBsb2FkRmlsZU9iaiIsImZpbGVPYmoiLCJlbmNvZGluZyIsImV4dGVuc2lvbk92ZXJyaWRlIiwic3RyaW5nIiwicmVhZGVyIiwiRmlsZVJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJ1cGxvYWRTdHJpbmciLCJ1cGxvYWREb2MiLCJvayIsImRlbGV0ZURvYyIsInNldExpbmtlZFZpZXdzIiwidXNlclNlbGVjdGlvbiIsImdldCIsImdldExpbmtlZFZpZXdzIiwiY2h1bmtzIiwidHJpbSIsImpzVHlwZSIsImV4dHJhY3REb2NRdWVyeSIsImNyb3NzRG9jIiwidGVtcFNlbGVjdGlvbiIsInBsdWdpbiIsIlBvdWNoQXV0aGVudGljYXRpb24iLCJQb3VjaEZpbmQiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBSUEsTUFBTUEsb0JBQW9CLDJCQUExQjs7QUFFQSxNQUFNQyxTQUFOLENBQWdCO2NBQ0RDLElBQWIsRUFBbUJDLGVBQWUsQ0FBQyxNQUFNSCxpQkFBUCxDQUFsQyxFQUE2RDtRQUN2RCxFQUFFRyx3QkFBd0JDLEtBQTFCLENBQUosRUFBc0M7cUJB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
