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
    await this.dbStatus;
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
var version = "0.4.2";
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
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && rm -rf mure mure-mrview* && node --inspect-brk node_modules/.bin/jest --runInBand -t",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9TZWxlY3Rpb24uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0Jhc2VXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1Jvb3RXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1R5cGVkV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Db250YWluZXJXcmFwcGVyTWl4aW4uanMiLCIuLi9zcmMvV3JhcHBlcnMvQ29udGFpbmVyV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Eb2N1bWVudFdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvUHJpbWl0aXZlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9JbnZhbGlkV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9OdWxsV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Cb29sZWFuV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9OdW1iZXJXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL1N0cmluZ1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRGF0ZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvUmVmZXJlbmNlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9TZXRXcmFwcGVyTWl4aW4uanMiLCIuLi9zcmMvV3JhcHBlcnMvU2V0V3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9TdXBlcm5vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL0lucHV0U3BlYy5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9JbnB1dE9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9PdXRwdXRTcGVjLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL1NlbGVjdEFsbE9wZXJhdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbW1vbi9TdHJpbmdPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQ2xhc3NPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9GaWx0ZXJPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9CYXNlQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnNpb25zL051bGxDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvQm9vbGVhbkNvbnZlcnNpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9OdW1iZXJDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvU3RyaW5nQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnNpb25zL0dlbmVyaWNDb252ZXJzaW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29udmVyc2lvbnMvTm9kZUNvbnZlcnNpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db252ZXJzaW9ucy9FZGdlQ29udmVyc2lvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0NvbnZlcnRPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vVHlwZWRPcHRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Db21tb24vQXR0cmlidXRlT3B0aW9uLmpzIiwiLi4vc3JjL09wZXJhdGlvbnMvQ29tbW9uL05lc3RlZEF0dHJpYnV0ZU9wdGlvbi5qcyIsIi4uL3NyYy9PcGVyYXRpb25zL0Nvbm5lY3RPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9BdHRhY2hPcGVyYXRpb24uanMiLCIuLi9zcmMvT3BlcmF0aW9ucy9Bc3NpZ25DbGFzc09wZXJhdGlvbi5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQganNvblBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IHsgcXVldWVBc3luYyB9IGZyb20gJ3VraSc7XG5pbXBvcnQgbWQ1IGZyb20gJ2JsdWVpbXAtbWQ1JztcblxuY29uc3QgREVGQVVMVF9ET0NfUVVFUlkgPSAne1wiX2lkXCI6e1wiJGd0XCI6XCJfXFx1ZmZmZlwifX0nO1xuXG5jbGFzcyBTZWxlY3Rpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSwgc2VsZWN0b3JMaXN0ID0gWydAJyArIERFRkFVTFRfRE9DX1FVRVJZXSkge1xuICAgIGlmICghKHNlbGVjdG9yTGlzdCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgc2VsZWN0b3JMaXN0ID0gWyBzZWxlY3Rvckxpc3QgXTtcbiAgICB9XG4gICAgdGhpcy5zZWxlY3RvcnMgPSBzZWxlY3Rvckxpc3QubWFwKHNlbGVjdG9yU3RyaW5nID0+IHtcbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gbXVyZS5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yU3RyaW5nKTtcbiAgICAgIGlmIChzZWxlY3RvciA9PT0gbnVsbCkge1xuICAgICAgICBsZXQgZXJyID0gbmV3IEVycm9yKCdJbnZhbGlkIHNlbGVjdG9yOiAnICsgc2VsZWN0b3JTdHJpbmcpO1xuICAgICAgICBlcnIuSU5WQUxJRF9TRUxFQ1RPUiA9IHRydWU7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICB9KTtcblxuICAgIC8vIFRPRE86IG9wdGltaXplIGFuZCBzb3J0IHRoaXMuc2VsZWN0b3JzIGZvciBiZXR0ZXIgaGFzaCBlcXVpdmFsZW5jZVxuXG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgfVxuICBnZXQgaGFzaCAoKSB7XG4gICAgaWYgKCF0aGlzLl9oYXNoKSB7XG4gICAgICB0aGlzLl9oYXNoID0gbWQ1KEpTT04uc3RyaW5naWZ5KHRoaXMuc2VsZWN0b3JMaXN0KSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9oYXNoO1xuICB9XG4gIGdldCBzZWxlY3Rvckxpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLnNlbGVjdG9ycy5tYXAoc2VsZWN0b3IgPT4ge1xuICAgICAgcmV0dXJuICdAJyArIHNlbGVjdG9yLmRvY1F1ZXJ5ICsgc2VsZWN0b3Iub2JqUXVlcnkgK1xuICAgICAgICBBcnJheS5mcm9tKEFycmF5KHNlbGVjdG9yLnBhcmVudFNoaWZ0KSkubWFwKGQgPT4gJ+KGkScpLmpvaW4oJycpICtcbiAgICAgICAgKHNlbGVjdG9yLmZvbGxvd0xpbmtzID8gJ+KGkicgOiAnJyk7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGlzQ2FjaGVkICgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9jYWNoZWRXcmFwcGVycztcbiAgfVxuICBpbnZhbGlkYXRlQ2FjaGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZWREb2NMaXN0cztcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVkV3JhcHBlcnM7XG4gICAgZGVsZXRlIHRoaXMuX3N1bW1hcnlDYWNoZXM7XG4gIH1cbiAgYXN5bmMgZG9jTGlzdHMgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZWREb2NMaXN0cykge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZERvY0xpc3RzO1xuICAgIH1cbiAgICB0aGlzLl9jYWNoZWREb2NMaXN0cyA9IGF3YWl0IFByb21pc2UuYWxsKHRoaXMuc2VsZWN0b3JzXG4gICAgICAubWFwKGQgPT4gdGhpcy5tdXJlLnF1ZXJ5RG9jcyh7IHNlbGVjdG9yOiBkLnBhcnNlZERvY1F1ZXJ5IH0pKSk7XG4gICAgLy8gV2Ugd2FudCBhbGwgc2VsZWN0aW9ucyB0byBvcGVyYXRlIGZyb20gZXhhY3RseSB0aGUgc2FtZSBkb2N1bWVudCBvYmplY3QsXG4gICAgLy8gc28gaXQncyBlYXN5IC8gc3RyYWlnaHRmb3J3YXJkIGZvciBXcmFwcGVycyB0byBqdXN0IG11dGF0ZSB0aGVpciBvd24gdmFsdWVcbiAgICAvLyByZWZlcmVuY2VzLCBhbmQgaGF2ZSB0aG9zZSBjaGFuZ2VzIGF1dG9tYXRpY2FsbHkgYXBwZWFyIGluIGRvY3VtZW50c1xuICAgIC8vIHdoZW4gdGhleSdyZSBzYXZlZC4uLiBzbyB3ZSBhY3R1YWxseSB3YW50IHRvICpzd2FwIG91dCogbWF0Y2hpbmcgZG9jdW1lbnRzXG4gICAgLy8gZm9yIHRoZWlyIGNhY2hlZCB2ZXJzaW9uc1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2FjaGVkRG9jTGlzdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fY2FjaGVkRG9jTGlzdHNbaV0ubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgY29uc3QgZG9jID0gdGhpcy5fY2FjaGVkRG9jTGlzdHNbaV1bal07XG4gICAgICAgIGlmIChTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jLl9pZF0pIHtcbiAgICAgICAgICBpZiAoU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdLnNlbGVjdGlvbnMuaW5kZXhPZih0aGlzKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIC8vIFJlZ2lzdGVyIGFzIGEgc2VsZWN0aW9uIHRoYXQncyB1c2luZyB0aGlzIGNhY2hlLCBzbyB3ZSdyZVxuICAgICAgICAgICAgLy8gbm90aWZpZWQgaW4gdGhlIGV2ZW50IHRoYXQgaXQgZ2V0cyBpbnZhbGlkYXRlZFxuICAgICAgICAgICAgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdLnNlbGVjdGlvbnMucHVzaCh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gVmVyaWZ5IHRoYXQgdGhlIGRvYyBoYXMgbm90IGNoYW5nZWQgKHdlIHdhdGNoIGZvciBjaGFuZ2VzIGFuZFxuICAgICAgICAgIC8vIGludmFsaWRhdGUgY2FjaGVzIGluIG11cmUuZ2V0T3JJbml0RGIsIHNvIHRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlbilcbiAgICAgICAgICBpZiAoZG9jLl9yZXYgIT09IFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2MuX2lkXS5jYWNoZWREb2MuX3Jldikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWNoZWQgZG9jdW1lbnQgX3JldiBjaGFuZ2VkIHdpdGhvdXQgbm90aWZpY2F0aW9uJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFN3YXAgZm9yIHRoZSBjYWNoZWQgdmVyc2lvblxuICAgICAgICAgIHRoaXMuX2NhY2hlZERvY0xpc3RzW2ldW2pdID0gU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdLmNhY2hlZERvYztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBXZSdyZSB0aGUgZmlyc3Qgb25lIHRvIGNhY2hlIHRoaXMgZG9jdW1lbnQsIHNvIHVzZSBvdXJzXG4gICAgICAgICAgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2RvYy5faWRdID0ge1xuICAgICAgICAgICAgc2VsZWN0aW9uczogW3RoaXNdLFxuICAgICAgICAgICAgY2FjaGVkRG9jOiBkb2NcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZWREb2NMaXN0cztcbiAgfVxuICBhc3luYyBpdGVtcyAoZG9jTGlzdHMpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVkV3JhcHBlcnMpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZWRXcmFwcGVycztcbiAgICB9XG5cbiAgICAvLyBOb3RlOiB3ZSBzaG91bGQgb25seSBwYXNzIGluIGRvY0xpc3RzIGluIHJhcmUgc2l0dWF0aW9ucyAoc3VjaCBhcyB0aGVcbiAgICAvLyBvbmUtb2ZmIGNhc2UgaW4gZm9sbG93UmVsYXRpdmVMaW5rKCkgd2hlcmUgd2UgYWxyZWFkeSBoYXZlIHRoZSBkb2N1bWVudFxuICAgIC8vIGF2YWlsYWJsZSwgYW5kIGNyZWF0aW5nIHRoZSBuZXcgc2VsZWN0aW9uIHdpbGwgcmVzdWx0IGluIGFuIHVubm5lY2Vzc2FyeVxuICAgIC8vIHF1ZXJ5IG9mIHRoZSBkYXRhYmFzZSkuIFVzdWFsbHksIHdlIHNob3VsZCByZWx5IG9uIHRoZSBjYWNoZS5cbiAgICBkb2NMaXN0cyA9IGRvY0xpc3RzIHx8IGF3YWl0IHRoaXMuZG9jTGlzdHMoKTtcblxuICAgIHJldHVybiBxdWV1ZUFzeW5jKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIENvbGxlY3QgdGhlIHJlc3VsdHMgb2Ygb2JqUXVlcnlcbiAgICAgIHRoaXMuX2NhY2hlZFdyYXBwZXJzID0ge307XG4gICAgICBjb25zdCBhZGRXcmFwcGVyID0gaXRlbSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5fY2FjaGVkV3JhcHBlcnNbaXRlbS51bmlxdWVTZWxlY3Rvcl0pIHtcbiAgICAgICAgICB0aGlzLl9jYWNoZWRXcmFwcGVyc1tpdGVtLnVuaXF1ZVNlbGVjdG9yXSA9IGl0ZW07XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLnNlbGVjdG9ycy5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yc1tpbmRleF07XG4gICAgICAgIGNvbnN0IGRvY0xpc3QgPSBkb2NMaXN0c1tpbmRleF07XG5cbiAgICAgICAgaWYgKHNlbGVjdG9yLm9ialF1ZXJ5ID09PSAnJykge1xuICAgICAgICAgIC8vIE5vIG9ialF1ZXJ5IG1lYW5zIHRoYXQgd2Ugd2FudCBhIHZpZXcgb2YgbXVsdGlwbGUgZG9jdW1lbnRzIChvdGhlclxuICAgICAgICAgIC8vIHNoZW5hbmlnYW5zIG1lYW4gd2Ugc2hvdWxkbid0IHNlbGVjdCBhbnl0aGluZylcbiAgICAgICAgICBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPT09IDAgJiYgIXNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIoe1xuICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgIGRvY0xpc3RcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsZWN0b3Iub2JqUXVlcnkgPT09ICckJykge1xuICAgICAgICAgIC8vIFNlbGVjdGluZyB0aGUgZG9jdW1lbnRzIHRoZW1zZWx2ZXNcbiAgICAgICAgICBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPT09IDAgJiYgIXNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICBkb2NMaXN0LmZvckVhY2goZG9jID0+IHtcbiAgICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcih7XG4gICAgICAgICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSAxKSB7XG4gICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIoe1xuICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgIGRvY0xpc3RcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT2theSwgd2UgbmVlZCB0byBldmFsdWF0ZSB0aGUganNvblBhdGhcbiAgICAgICAgICBmb3IgKGxldCBkb2NJbmRleCA9IDA7IGRvY0luZGV4IDwgZG9jTGlzdC5sZW5ndGg7IGRvY0luZGV4KyspIHtcbiAgICAgICAgICAgIGxldCBkb2MgPSBkb2NMaXN0W2RvY0luZGV4XTtcbiAgICAgICAgICAgIGxldCBtYXRjaGluZ1dyYXBwZXJzID0ganNvblBhdGgubm9kZXMoZG9jLCBzZWxlY3Rvci5vYmpRdWVyeSk7XG4gICAgICAgICAgICBmb3IgKGxldCBpdGVtSW5kZXggPSAwOyBpdGVtSW5kZXggPCBtYXRjaGluZ1dyYXBwZXJzLmxlbmd0aDsgaXRlbUluZGV4KyspIHtcbiAgICAgICAgICAgICAgbGV0IHsgcGF0aCwgdmFsdWUgfSA9IG1hdGNoaW5nV3JhcHBlcnNbaXRlbUluZGV4XTtcbiAgICAgICAgICAgICAgbGV0IGxvY2FsUGF0aCA9IHBhdGg7XG4gICAgICAgICAgICAgIGlmICh0aGlzLm11cmUuUkVTRVJWRURfT0JKX0tFWVNbbG9jYWxQYXRoLnNsaWNlKC0xKVswXV0pIHtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCBjcmVhdGUgaXRlbXMgdW5kZXIgcmVzZXJ2ZWQga2V5c1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHNlbGVjdG9yLnBhcmVudFNoaWZ0ID09PSBsb2NhbFBhdGgubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgcGFyZW50IHNoaWZ0ZWQgdXAgdG8gdGhlIHJvb3QgbGV2ZWxcbiAgICAgICAgICAgICAgICBpZiAoIXNlbGVjdG9yLmZvbGxvd0xpbmtzKSB7XG4gICAgICAgICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIoe1xuICAgICAgICAgICAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgICAgICAgICAgIGRvY0xpc3RcbiAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VsZWN0b3IucGFyZW50U2hpZnQgPT09IGxvY2FsUGF0aC5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgcGFyZW50IHNoaWZ0ZWQgdG8gdGhlIGRvY3VtZW50IGxldmVsXG4gICAgICAgICAgICAgICAgaWYgKCFzZWxlY3Rvci5mb2xsb3dMaW5rcykge1xuICAgICAgICAgICAgICAgICAgYWRkV3JhcHBlcihuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcih7XG4gICAgICAgICAgICAgICAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgICAgICAgICAgICAgICAgZG9jXG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzZWxlY3Rvci5wYXJlbnRTaGlmdCA+IDAgJiYgc2VsZWN0b3IucGFyZW50U2hpZnQgPCBsb2NhbFBhdGgubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsIHBhcmVudFNoaWZ0XG4gICAgICAgICAgICAgICAgICBsb2NhbFBhdGguc3BsaWNlKGxvY2FsUGF0aC5sZW5ndGggLSBzZWxlY3Rvci5wYXJlbnRTaGlmdCk7XG4gICAgICAgICAgICAgICAgICB2YWx1ZSA9IGpzb25QYXRoLnF1ZXJ5KGRvYywganNvblBhdGguc3RyaW5naWZ5KGxvY2FsUGF0aCkpWzBdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0b3IuZm9sbG93TGlua3MpIHtcbiAgICAgICAgICAgICAgICAgIC8vIFdlIChwb3RlbnRpYWxseSkgc2VsZWN0ZWQgYSBsaW5rIHRoYXQgd2UgbmVlZCB0byBmb2xsb3dcbiAgICAgICAgICAgICAgICAgIE9iamVjdC52YWx1ZXMoYXdhaXQgdGhpcy5tdXJlLmZvbGxvd1JlbGF0aXZlTGluayh2YWx1ZSwgZG9jKSlcbiAgICAgICAgICAgICAgICAgICAgLmZvckVhY2goYWRkV3JhcHBlcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IFdyYXBwZXJUeXBlID0gdGhpcy5tdXJlLmluZmVyVHlwZSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICBhZGRXcmFwcGVyKG5ldyBXcmFwcGVyVHlwZSh7XG4gICAgICAgICAgICAgICAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IFtge1wiX2lkXCI6XCIke2RvYy5faWR9XCJ9YF0uY29uY2F0KGxvY2FsUGF0aCksXG4gICAgICAgICAgICAgICAgICAgIGRvY1xuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlZFdyYXBwZXJzO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGUgKG9wZXJhdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgbGV0IG91dHB1dFNwZWMgPSBhd2FpdCBvcGVyYXRpb24uZXhlY3V0ZU9uU2VsZWN0aW9uKHRoaXMsIGlucHV0T3B0aW9ucyk7XG5cbiAgICBjb25zdCBwb2xsdXRlZERvY3MgPSBPYmplY3QudmFsdWVzKG91dHB1dFNwZWMucG9sbHV0ZWREb2NzKTtcblxuICAgIC8vIFdyaXRlIGFueSB3YXJuaW5ncywgYW5kLCBkZXBlbmRpbmcgb24gdGhlIHVzZXIncyBzZXR0aW5ncywgc2tpcCBvciBzYXZlXG4gICAgLy8gdGhlIHJlc3VsdHNcbiAgICBsZXQgc2tpcFNhdmUgPSBmYWxzZTtcbiAgICBpZiAoT2JqZWN0LmtleXMob3V0cHV0U3BlYy53YXJuaW5ncykubGVuZ3RoID4gMCkge1xuICAgICAgbGV0IHdhcm5pbmdTdHJpbmc7XG4gICAgICBpZiAob3V0cHV0U3BlYy5pZ25vcmVFcnJvcnMgPT09ICdTdG9wIG9uIEVycm9yJykge1xuICAgICAgICBza2lwU2F2ZSA9IHRydWU7XG4gICAgICAgIHdhcm5pbmdTdHJpbmcgPSBgJHtvcGVyYXRpb24uaHVtYW5SZWFkYWJsZVR5cGV9IG9wZXJhdGlvbiBmYWlsZWQuXFxuYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHdhcm5pbmdTdHJpbmcgPSBgJHtvcGVyYXRpb24uaHVtYW5SZWFkYWJsZVR5cGV9IG9wZXJhdGlvbiBmaW5pc2hlZCB3aXRoIHdhcm5pbmdzOlxcbmA7XG4gICAgICB9XG4gICAgICB3YXJuaW5nU3RyaW5nICs9IE9iamVjdC5lbnRyaWVzKG91dHB1dFNwZWMud2FybmluZ3MpLm1hcCgoW3dhcm5pbmcsIGNvdW50XSkgPT4ge1xuICAgICAgICBpZiAoY291bnQgPiAxKSB7XG4gICAgICAgICAgcmV0dXJuIGAke3dhcm5pbmd9ICh4JHtjb3VudH0pYDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gYCR7d2FybmluZ31gO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHRoaXMubXVyZS53YXJuKHdhcm5pbmdTdHJpbmcpO1xuICAgIH1cbiAgICBsZXQgc2F2ZVN1Y2Nlc3NmdWwgPSBmYWxzZTtcbiAgICBpZiAoIXNraXBTYXZlKSB7XG4gICAgICAvLyBTYXZlIHRoZSByZXN1bHRzXG4gICAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgdGhpcy5tdXJlLnB1dERvY3MocG9sbHV0ZWREb2NzKTtcbiAgICAgIHNhdmVTdWNjZXNzZnVsID0gc2F2ZVJlc3VsdC5lcnJvciAhPT0gdHJ1ZTtcbiAgICAgIGlmICghc2F2ZVN1Y2Nlc3NmdWwpIHtcbiAgICAgICAgLy8gVGhlcmUgd2FzIGEgcHJvYmxlbSBzYXZpbmcgdGhlIHJlc3VsdFxuICAgICAgICB0aGlzLm11cmUud2FybihzYXZlUmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFueSBzZWxlY3Rpb24gdGhhdCBoYXMgY2FjaGVkIGFueSBvZiB0aGUgZG9jdW1lbnRzIHRoYXQgd2UgYWx0ZXJlZFxuICAgIC8vIG5lZWRzIHRvIGhhdmUgaXRzIGNhY2hlIGludmFsaWRhdGVkXG4gICAgcG9sbHV0ZWREb2NzLmZvckVhY2goZG9jID0+IHtcbiAgICAgIFNlbGVjdGlvbi5JTlZBTElEQVRFX0RPQ19DQUNIRShkb2MuX2lkKTtcbiAgICB9KTtcblxuICAgIC8vIEZpbmFsbHksIHJldHVybiB0aGlzIHNlbGVjdGlvbiwgb3IgYSBuZXcgc2VsZWN0aW9uLCBkZXBlbmRpbmcgb24gdGhlXG4gICAgLy8gb3BlcmF0aW9uXG4gICAgaWYgKHNhdmVTdWNjZXNzZnVsICYmIG91dHB1dFNwZWMubmV3U2VsZWN0b3JzICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gbmV3IFNlbGVjdGlvbih0aGlzLm11cmUsIG91dHB1dFNwZWMubmV3U2VsZWN0b3JzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG5cbiAgLypcbiAgIFNob3J0Y3V0cyBmb3Igc2VsZWN0aW9uIG1hbmlwdWxhdGlvblxuICAgKi9cbiAgYXN5bmMgc3ViU2VsZWN0IChhcHBlbmQsIG1vZGUgPSAnUmVwbGFjZScpIHtcbiAgICByZXR1cm4gdGhpcy5zZWxlY3RBbGwoeyBjb250ZXh0OiAnU2VsZWN0b3InLCBhcHBlbmQsIG1vZGUgfSk7XG4gIH1cbiAgYXN5bmMgbWVyZ2VTZWxlY3Rpb24gKG90aGVyU2VsZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0QWxsKHsgY29udGV4dDogJ1NlbGVjdGlvbicsIG90aGVyU2VsZWN0aW9uLCBtb2RlOiAnVW5pb24nIH0pO1xuICB9XG5cbiAgLypcbiAgIFRoZXNlIGZ1bmN0aW9ucyBwcm92aWRlIHN0YXRpc3RpY3MgLyBzdW1tYXJpZXMgb2YgdGhlIHNlbGVjdGlvbjpcbiAgICovXG4gIGFzeW5jIGdldFBvcHVsYXRlZElucHV0U3BlYyAob3BlcmF0aW9uKSB7XG4gICAgaWYgKHRoaXMuX3N1bW1hcnlDYWNoZXMgJiYgdGhpcy5fc3VtbWFyeUNhY2hlcy5pbnB1dFNwZWNzICYmXG4gICAgICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjc1tvcGVyYXRpb24udHlwZV0pIHtcbiAgICAgIHJldHVybiB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3Nbb3BlcmF0aW9uLnR5cGVdO1xuICAgIH1cblxuICAgIGNvbnN0IGlucHV0U3BlYyA9IG9wZXJhdGlvbi5nZXRJbnB1dFNwZWMoKTtcbiAgICBhd2FpdCBpbnB1dFNwZWMucG9wdWxhdGVDaG9pY2VzRnJvbVNlbGVjdGlvbih0aGlzKTtcblxuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMgPSB0aGlzLl9zdW1tYXJ5Q2FjaGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjcyA9IHRoaXMuX3N1bW1hcnlDYWNoZXMuaW5wdXRTcGVjcyB8fCB7fTtcbiAgICB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmlucHV0U3BlY3Nbb3BlcmF0aW9uLnR5cGVdID0gaW5wdXRTcGVjO1xuICAgIHJldHVybiBpbnB1dFNwZWM7XG4gIH1cbiAgYXN5bmMgaGlzdG9ncmFtcyAobnVtQmlucyA9IDIwKSB7XG4gICAgaWYgKHRoaXMuX3N1bW1hcnlDYWNoZXMgJiYgdGhpcy5fc3VtbWFyeUNhY2hlcy5oaXN0b2dyYW1zKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc3VtbWFyeUNhY2hlcy5oaXN0b2dyYW1zO1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgdGhpcy5pdGVtcygpO1xuICAgIGNvbnN0IGl0ZW1MaXN0ID0gT2JqZWN0LnZhbHVlcyhpdGVtcyk7XG5cbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgcmF3OiB7XG4gICAgICAgIHR5cGVCaW5zOiB7fSxcbiAgICAgICAgY2F0ZWdvcmljYWxCaW5zOiB7fSxcbiAgICAgICAgcXVhbnRpdGF0aXZlQmluczogW11cbiAgICAgIH0sXG4gICAgICBhdHRyaWJ1dGVzOiB7fVxuICAgIH07XG5cbiAgICBjb25zdCBjb3VudFByaW1pdGl2ZSA9IChjb3VudGVycywgaXRlbSkgPT4ge1xuICAgICAgLy8gQXR0ZW1wdCB0byBjb3VudCB0aGUgdmFsdWUgY2F0ZWdvcmljYWxseVxuICAgICAgaWYgKGNvdW50ZXJzLmNhdGVnb3JpY2FsQmlucyAhPT0gbnVsbCkge1xuICAgICAgICBjb3VudGVycy5jYXRlZ29yaWNhbEJpbnNbaXRlbS52YWx1ZV0gPSAoY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zW2l0ZW0udmFsdWVdIHx8IDApICsgMTtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKGNvdW50ZXJzLmNhdGVnb3JpY2FsQmlucykubGVuZ3RoID4gbnVtQmlucykge1xuICAgICAgICAgIC8vIFdlJ3ZlIGVuY291bnRlcmVkIHRvbyBtYW55IGNhdGVnb3JpY2FsIGJpbnM7IHRoaXMgbGlrZWx5IGlzbid0IGEgY2F0ZWdvcmljYWwgYXR0cmlidXRlXG4gICAgICAgICAgY291bnRlcnMuY2F0ZWdvcmljYWxCaW5zID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gQXR0ZW1wdCB0byBiaW4gdGhlIHZhbHVlIHF1YW50aXRhdGl2ZWx5XG4gICAgICBpZiAoY291bnRlcnMucXVhbnRpdGF0aXZlQmlucyAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoY291bnRlcnMucXVhbnRpdGF0aXZlQmlucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAvLyBJbml0IHRoZSBjb3VudGVycyB3aXRoIHNvbWUgdGVtcG9yYXJ5IHBsYWNlaG9sZGVyc1xuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzID0gW107XG4gICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZSA9IGl0ZW0udHlwZTtcbiAgICAgICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyKSB7XG4gICAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZSA9IHRoaXMubXVyZS5kMy5zY2FsZUxpbmVhcigpXG4gICAgICAgICAgICAgIC5kb21haW4oW2l0ZW0udmFsdWUsIGl0ZW0udmFsdWVdKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRGF0ZVdyYXBwZXIpIHtcbiAgICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlID0gdGhpcy5tdXJlLmQzLnNjYWxlVGltZSgpXG4gICAgICAgICAgICAgIC5kb21haW4oW2l0ZW0udmFsdWUsIGl0ZW0udmFsdWVdKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gVGhlIGZpcnN0IHZhbHVlIGlzIG5vbi1xdWFudGl0YXRpdmU7IHRoaXMgbGlrZWx5IGlzbid0IGEgcXVhbnRpdGF0aXZlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgY291bnRlcnMucXVhbnRpdGF0aXZlQmlucyA9IG51bGw7XG4gICAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlV3JhcHBlcnM7XG4gICAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZTtcbiAgICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZSAhPT0gaXRlbS50eXBlKSB7XG4gICAgICAgICAgLy8gRW5jb3VudGVyZWQgYW4gaXRlbSBvZiBhIGRpZmZlcmVudCB0eXBlOyB0aGlzIGxpa2VseSBpc24ndCBhIHF1YW50aXRhdGl2ZSBhdHRyaWJ1dGVcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVCaW5zID0gbnVsbDtcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlV3JhcHBlcnM7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVR5cGU7XG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgc2NhbGUncyBkb21haW4gKHdlJ2xsIGRldGVybWluZSBiaW5zIGxhdGVyKVxuICAgICAgICAgIGxldCBkb21haW4gPSBjb3VudGVycy5xdWFudGl0YXRpdmVTY2FsZS5kb21haW4oKTtcbiAgICAgICAgICBpZiAoaXRlbS52YWx1ZSA8IGRvbWFpblswXSkge1xuICAgICAgICAgICAgZG9tYWluWzBdID0gaXRlbS52YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGl0ZW0udmFsdWUgPiBkb21haW5bMV0pIHtcbiAgICAgICAgICAgIGRvbWFpblsxXSA9IGl0ZW0udmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLmRvbWFpbihkb21haW4pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaXRlbUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBpdGVtTGlzdFtpXTtcbiAgICAgIHJlc3VsdC5yYXcudHlwZUJpbnNbaXRlbS50eXBlXSA9IChyZXN1bHQucmF3LnR5cGVCaW5zW2l0ZW0udHlwZV0gfHwgMCkgKyAxO1xuICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuUHJpbWl0aXZlV3JhcHBlcikge1xuICAgICAgICBjb3VudFByaW1pdGl2ZShyZXN1bHQucmF3LCBpdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpdGVtLmdldENvbnRlbnRzKSB7XG4gICAgICAgICAgT2JqZWN0LnZhbHVlcyhpdGVtLmdldENvbnRlbnRzKCkpLmZvckVhY2goY2hpbGRXcmFwcGVyID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ZXJzID0gcmVzdWx0LmF0dHJpYnV0ZXNbY2hpbGRXcmFwcGVyLmxhYmVsXSA9IHJlc3VsdC5hdHRyaWJ1dGVzW2NoaWxkV3JhcHBlci5sYWJlbF0gfHwge1xuICAgICAgICAgICAgICB0eXBlQmluczoge30sXG4gICAgICAgICAgICAgIGNhdGVnb3JpY2FsQmluczoge30sXG4gICAgICAgICAgICAgIHF1YW50aXRhdGl2ZUJpbnM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY291bnRlcnMudHlwZUJpbnNbY2hpbGRXcmFwcGVyLnR5cGVdID0gKGNvdW50ZXJzLnR5cGVCaW5zW2NoaWxkV3JhcHBlci50eXBlXSB8fCAwKSArIDE7XG4gICAgICAgICAgICBpZiAoY2hpbGRXcmFwcGVyIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlByaW1pdGl2ZVdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgY291bnRQcmltaXRpdmUoY291bnRlcnMsIGNoaWxkV3JhcHBlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVE9ETzogY29sbGVjdCBtb3JlIHN0YXRpc3RpY3MsIHN1Y2ggYXMgbm9kZSBkZWdyZWUsIHNldCBzaXplXG4gICAgICAgIC8vIChhbmQgYSBzZXQncyBtZW1iZXJzJyBhdHRyaWJ1dGVzLCBzaW1pbGFyIHRvIGdldENvbnRlbnRzPylcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBmaW5hbGl6ZUJpbnMgPSBjb3VudGVycyA9PiB7XG4gICAgICAvLyBDbGVhciBvdXQgYW55dGhpbmcgdGhhdCBkaWRuJ3Qgc2VlIGFueSB2YWx1ZXNcbiAgICAgIGlmIChjb3VudGVycy50eXBlQmlucyAmJiBPYmplY3Qua2V5cyhjb3VudGVycy50eXBlQmlucykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvdW50ZXJzLnR5cGVCaW5zID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmIChjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMgJiZcbiAgICAgICAgICBPYmplY3Qua2V5cyhjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb3VudGVycy5jYXRlZ29yaWNhbEJpbnMgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMpIHtcbiAgICAgICAgaWYgKCFjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycyB8fFxuICAgICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZUJpbnMgPSBudWxsO1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVXcmFwcGVycztcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlVHlwZTtcbiAgICAgICAgICBkZWxldGUgY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQ2FsY3VsYXRlIHF1YW50aXRhdGl2ZSBiaW4gc2l6ZXMgYW5kIHRoZWlyIGNvdW50c1xuICAgICAgICAgIC8vIENsZWFuIHVwIHRoZSBzY2FsZSBhIGJpdFxuICAgICAgICAgIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLm5pY2UoKTtcbiAgICAgICAgICAvLyBIaXN0b2dyYW0gZ2VuZXJhdG9yXG4gICAgICAgICAgY29uc3QgaGlzdG9ncmFtR2VuZXJhdG9yID0gdGhpcy5tdXJlLmQzLmhpc3RvZ3JhbSgpXG4gICAgICAgICAgICAuZG9tYWluKGNvdW50ZXJzLnF1YW50aXRhdGl2ZVNjYWxlLmRvbWFpbigpKVxuICAgICAgICAgICAgLnRocmVzaG9sZHMoY291bnRlcnMucXVhbnRpdGF0aXZlU2NhbGUudGlja3MobnVtQmlucykpXG4gICAgICAgICAgICAudmFsdWUoZCA9PiBkLnZhbHVlKTtcbiAgICAgICAgICBjb3VudGVycy5xdWFudGl0YXRpdmVCaW5zID0gaGlzdG9ncmFtR2VuZXJhdG9yKGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzKTtcbiAgICAgICAgICAvLyBDbGVhbiB1cCBzb21lIG9mIHRoZSB0ZW1wb3JhcnkgcGxhY2Vob2xkZXJzXG4gICAgICAgICAgZGVsZXRlIGNvdW50ZXJzLnF1YW50aXRhdGl2ZVdyYXBwZXJzO1xuICAgICAgICAgIGRlbGV0ZSBjb3VudGVycy5xdWFudGl0YXRpdmVUeXBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcbiAgICBmaW5hbGl6ZUJpbnMocmVzdWx0LnJhdyk7XG4gICAgT2JqZWN0LnZhbHVlcyhyZXN1bHQuYXR0cmlidXRlcykuZm9yRWFjaChmaW5hbGl6ZUJpbnMpO1xuXG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcyA9IHRoaXMuX3N1bW1hcnlDYWNoZXMgfHwge307XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcy5oaXN0b2dyYW1zID0gcmVzdWx0O1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgZ2V0RmxhdEdyYXBoU2NoZW1hICgpIHtcbiAgICBpZiAodGhpcy5fc3VtbWFyeUNhY2hlcyAmJiB0aGlzLl9zdW1tYXJ5Q2FjaGVzLmZsYXRHcmFwaFNjaGVtYSkge1xuICAgICAgcmV0dXJuIHRoaXMuX3N1bW1hcnlDYWNoZXMuZmxhdEdyYXBoU2NoZW1hO1xuICAgIH1cblxuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgdGhpcy5pdGVtcygpO1xuICAgIGxldCByZXN1bHQgPSB7XG4gICAgICBub2RlQ2xhc3Nlczoge30sXG4gICAgICBlZGdlQ2xhc3Nlczoge30sXG4gICAgICBtaXNzaW5nTm9kZXM6IGZhbHNlLFxuICAgICAgbWlzc2luZ0VkZ2VzOiBmYWxzZVxuICAgIH07XG5cbiAgICAvLyBGaXJzdCBwYXNzOiBpZGVudGlmeSBpdGVtcyBieSBjbGFzcywgYW5kIGdlbmVyYXRlIHBzZXVkby1pdGVtcyB0aGF0XG4gICAgLy8gcG9pbnQgdG8gY2xhc3NlcyBpbnN0ZWFkIG9mIHNlbGVjdG9yc1xuICAgIE9iamVjdC5lbnRyaWVzKGl0ZW1zKS5mb3JFYWNoKChbdW5pcXVlU2VsZWN0b3IsIGl0ZW1dKSA9PiB7XG4gICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcikge1xuICAgICAgICAvLyBUaGlzIGlzIGFuIGVkZ2U7IGNyZWF0ZSAvIGFkZCB0byBhIHBzZXVkby1pdGVtIGZvciBlYWNoIGNsYXNzXG4gICAgICAgIGxldCBjbGFzc0xpc3QgPSBpdGVtLmdldENsYXNzZXMoKTtcbiAgICAgICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBjbGFzc0xpc3QucHVzaCgnKG5vIGNsYXNzKScpO1xuICAgICAgICB9XG4gICAgICAgIGNsYXNzTGlzdC5mb3JFYWNoKGVkZ2VDbGFzc05hbWUgPT4ge1xuICAgICAgICAgIGxldCBwc2V1ZG9FZGdlID0gcmVzdWx0LmVkZ2VDbGFzc2VzW2VkZ2VDbGFzc05hbWVdID1cbiAgICAgICAgICAgIHJlc3VsdC5lZGdlQ2xhc3Nlc1tlZGdlQ2xhc3NOYW1lXSB8fCB7ICRub2Rlczoge30gfTtcbiAgICAgICAgICAvLyBBZGQgb3VyIGRpcmVjdGlvbiBjb3VudHMgZm9yIGVhY2ggb2YgdGhlIG5vZGUncyBjbGFzc2VzIHRvIHRoZSBwc2V1ZG8taXRlbVxuICAgICAgICAgIE9iamVjdC5lbnRyaWVzKGl0ZW0udmFsdWUuJG5vZGVzKS5mb3JFYWNoKChbbm9kZVNlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4ge1xuICAgICAgICAgICAgbGV0IG5vZGVXcmFwcGVyID0gaXRlbXNbbm9kZVNlbGVjdG9yXTtcbiAgICAgICAgICAgIGlmICghbm9kZVdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgLy8gVGhpcyBlZGdlIHJlZmVycyB0byBhIG5vZGUgb3V0c2lkZSB0aGUgc2VsZWN0aW9uXG4gICAgICAgICAgICAgIHJlc3VsdC5taXNzaW5nTm9kZXMgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbm9kZVdyYXBwZXIuZ2V0Q2xhc3NlcygpLmZvckVhY2gobm9kZUNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoZGlyZWN0aW9ucykuZm9yRWFjaCgoW2RpcmVjdGlvbiwgY291bnRdKSA9PiB7XG4gICAgICAgICAgICAgICAgICBwc2V1ZG9FZGdlLiRub2Rlc1tub2RlQ2xhc3NOYW1lXSA9IHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgcHNldWRvRWRnZS4kbm9kZXNbbm9kZUNsYXNzTmFtZV1bZGlyZWN0aW9uXSA9IHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdW2RpcmVjdGlvbl0gfHwgMDtcbiAgICAgICAgICAgICAgICAgIHBzZXVkb0VkZ2UuJG5vZGVzW25vZGVDbGFzc05hbWVdW2RpcmVjdGlvbl0gKz0gY291bnQ7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikge1xuICAgICAgICAvLyBUaGlzIGlzIGEgbm9kZTsgY3JlYXRlIC8gYWRkIHRvIGEgcHNldWRvLWl0ZW0gZm9yIGVhY2ggY2xhc3NcbiAgICAgICAgbGV0IGNsYXNzTGlzdCA9IGl0ZW0uZ2V0Q2xhc3NlcygpO1xuICAgICAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGNsYXNzTGlzdC5wdXNoKCcobm8gY2xhc3MpJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2xhc3NMaXN0LmZvckVhY2gobm9kZUNsYXNzTmFtZSA9PiB7XG4gICAgICAgICAgbGV0IHBzZXVkb05vZGUgPSByZXN1bHQubm9kZUNsYXNzZXNbbm9kZUNsYXNzTmFtZV0gPVxuICAgICAgICAgICAgcmVzdWx0Lm5vZGVDbGFzc2VzW25vZGVDbGFzc05hbWVdIHx8IHsgY291bnQ6IDAsICRlZGdlczoge30gfTtcbiAgICAgICAgICBwc2V1ZG9Ob2RlLmNvdW50ICs9IDE7XG4gICAgICAgICAgLy8gRW5zdXJlIHRoYXQgdGhlIGVkZ2UgY2xhc3MgaXMgcmVmZXJlbmNlZCAoZGlyZWN0aW9ucycgY291bnRzIGFyZSBrZXB0IG9uIHRoZSBlZGdlcylcbiAgICAgICAgICBPYmplY3Qua2V5cyhpdGVtLnZhbHVlLiRlZGdlcykuZm9yRWFjaChlZGdlU2VsZWN0b3IgPT4ge1xuICAgICAgICAgICAgbGV0IGVkZ2VXcmFwcGVyID0gaXRlbXNbZWRnZVNlbGVjdG9yXTtcbiAgICAgICAgICAgIGlmICghZWRnZVdyYXBwZXIpIHtcbiAgICAgICAgICAgICAgLy8gVGhpcyBub2RlIHJlZmVycyB0byBhbiBlZGdlIG91dHNpZGUgdGhlIHNlbGVjdGlvblxuICAgICAgICAgICAgICByZXN1bHQubWlzc2luZ0VkZ2VzID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGVkZ2VXcmFwcGVyLmdldENsYXNzZXMoKS5mb3JFYWNoKGVkZ2VDbGFzc05hbWUgPT4ge1xuICAgICAgICAgICAgICAgIHBzZXVkb05vZGUuJGVkZ2VzW2VkZ2VDbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcyA9IHRoaXMuX3N1bW1hcnlDYWNoZXMgfHwge307XG4gICAgdGhpcy5fc3VtbWFyeUNhY2hlcy5mbGF0R3JhcGhTY2hlbWEgPSByZXN1bHQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBnZXRJbnRlcnNlY3RlZEdyYXBoU2NoZW1hICgpIHtcbiAgICAvLyBjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuaXRlbXMoKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgfVxuICBhc3luYyBhbGxNZXRhT2JqSW50ZXJzZWN0aW9ucyAobWV0YU9ianMpIHtcbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuaXRlbXMoKTtcbiAgICBsZXQgbGlua2VkSWRzID0ge307XG4gICAgaXRlbXMuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIG1ldGFPYmpzLmZvckVhY2gobWV0YU9iaiA9PiB7XG4gICAgICAgIGlmIChpdGVtLnZhbHVlW21ldGFPYmpdKSB7XG4gICAgICAgICAgT2JqZWN0LmtleXMoaXRlbS52YWx1ZVttZXRhT2JqXSkuZm9yRWFjaChsaW5rZWRJZCA9PiB7XG4gICAgICAgICAgICBsaW5rZWRJZCA9IHRoaXMubXVyZS5pZFRvVW5pcXVlU2VsZWN0b3IobGlua2VkSWQsIGl0ZW0uZG9jLl9pZCk7XG4gICAgICAgICAgICBsaW5rZWRJZHNbbGlua2VkSWRdID0gbGlua2VkSWRzW2xpbmtlZElkXSB8fCB7fTtcbiAgICAgICAgICAgIGxpbmtlZElkc1tsaW5rZWRJZF1baXRlbS51bmlxdWVTZWxlY3Rvcl0gPSB0cnVlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBsZXQgc2V0cyA9IFtdO1xuICAgIGxldCBzZXRMb29rdXAgPSB7fTtcbiAgICBPYmplY3Qua2V5cyhsaW5rZWRJZHMpLmZvckVhY2gobGlua2VkSWQgPT4ge1xuICAgICAgbGV0IGl0ZW1JZHMgPSBPYmplY3Qua2V5cyhsaW5rZWRJZHNbbGlua2VkSWRdKS5zb3J0KCk7XG4gICAgICBsZXQgc2V0S2V5ID0gaXRlbUlkcy5qb2luKCcsJyk7XG4gICAgICBpZiAoc2V0TG9va3VwW3NldEtleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzZXRMb29rdXBbc2V0S2V5XSA9IHNldHMubGVuZ3RoO1xuICAgICAgICBzZXRzLnB1c2goeyBpdGVtSWRzLCBsaW5rZWRJZHM6IHt9IH0pO1xuICAgICAgfVxuICAgICAgc2V0TG9va3VwW3NldEtleV0ubGlua2VkSWRzW2xpbmtlZElkXSA9IHRydWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIHNldHM7XG4gIH1cbn1cbi8vIFRPRE86IHRoaXMgd2F5IG9mIGRlYWxpbmcgd2l0aCBjYWNoZSBpbnZhbGlkYXRpb24gY2F1c2VzIGEgbWVtb3J5IGxlYWssIGFzXG4vLyBvbGQgc2VsZWN0aW9ucyBhcmUgZ29pbmcgdG8gcGlsZSB1cCBpbiBDQUNIRURfRE9DUyBhZnRlciB0aGV5J3ZlIGxvc3QgYWxsXG4vLyBvdGhlciByZWZlcmVuY2VzLCBwcmV2ZW50aW5nIHRoZWlyIGdhcmJhZ2UgY29sbGVjdGlvbi4gVW5mb3J0dW5hdGVseSB0aGluZ3Ncbi8vIGxpa2UgV2Vha01hcCBhcmVuJ3QgZW51bWVyYWJsZS4uLiBhIGdvb2QgaWRlYSB3b3VsZCBwcm9iYWJseSBiZSB0byBqdXN0XG4vLyBwdXJnZSB0aGUgY2FjaGUgZXZlcnkgbiBtaW51dGVzIG9yIHNvLi4uP1xuU2VsZWN0aW9uLkRFRkFVTFRfRE9DX1FVRVJZID0gREVGQVVMVF9ET0NfUVVFUlk7XG5TZWxlY3Rpb24uQ0FDSEVEX0RPQ1MgPSB7fTtcblNlbGVjdGlvbi5JTlZBTElEQVRFX0RPQ19DQUNIRSA9IGRvY0lkID0+IHtcbiAgaWYgKFNlbGVjdGlvbi5DQUNIRURfRE9DU1tkb2NJZF0pIHtcbiAgICBTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jSWRdLnNlbGVjdGlvbnMuZm9yRWFjaChzZWxlY3Rpb24gPT4ge1xuICAgICAgc2VsZWN0aW9uLmludmFsaWRhdGVDYWNoZSgpO1xuICAgIH0pO1xuICAgIGRlbGV0ZSBTZWxlY3Rpb24uQ0FDSEVEX0RPQ1NbZG9jSWRdO1xuICB9XG59O1xuU2VsZWN0aW9uLklOVkFMSURBVEVfQUxMX0NBQ0hFUyA9ICgpID0+IHtcbiAgT2JqZWN0LnZhbHVlcyhTZWxlY3Rpb24uQ0FDSEVEX0RPQ1MpLmZvckVhY2goKHsgY2FjaGVkRG9jLCBzZWxlY3Rpb25zIH0pID0+IHtcbiAgICBzZWxlY3Rpb25zLmZvckVhY2goc2VsZWN0aW9uID0+IHtcbiAgICAgIHNlbGVjdGlvbi5pbnZhbGlkYXRlQ2FjaGUoKTtcbiAgICB9KTtcbiAgICBkZWxldGUgU2VsZWN0aW9uLkNBQ0hFRF9ET0NTW2NhY2hlZERvYy5faWRdO1xuICB9KTtcbn07XG5leHBvcnQgZGVmYXVsdCBTZWxlY3Rpb247XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXNcbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlV3JhcHBlciBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgcGF0aCwgdmFsdWUsIHBhcmVudCwgZG9jLCBsYWJlbCwgdW5pcXVlU2VsZWN0b3IgfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgICB0aGlzLnBhdGggPSBwYXRoO1xuICAgIHRoaXMuX3ZhbHVlID0gdmFsdWU7XG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQ7XG4gICAgdGhpcy5kb2MgPSBkb2M7XG4gICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgIHRoaXMudW5pcXVlU2VsZWN0b3IgPSB1bmlxdWVTZWxlY3RvcjtcbiAgfVxuICBnZXQgdmFsdWUgKCkgeyByZXR1cm4gdGhpcy5fdmFsdWU7IH1cbiAgc2V0IHZhbHVlIChuZXdWYWx1ZSkge1xuICAgIGlmICh0aGlzLnBhcmVudCkge1xuICAgICAgLy8gSW4gdGhlIGV2ZW50IHRoYXQgdGhpcyBpcyBhIHByaW1pdGl2ZSBib29sZWFuLCBudW1iZXIsIHN0cmluZywgZXRjLFxuICAgICAgLy8gc2V0dGluZyB0aGUgdmFsdWUgb24gdGhlIFdyYXBwZXIgd3JhcHBlciBvYmplY3QgKndvbid0KiBuYXR1cmFsbHkgdXBkYXRlXG4gICAgICAvLyBpdCBpbiBpdHMgY29udGFpbmluZyBkb2N1bWVudC4uLlxuICAgICAgdGhpcy5wYXJlbnRbdGhpcy5sYWJlbF0gPSBuZXdWYWx1ZTtcbiAgICB9XG4gICAgdGhpcy5fdmFsdWUgPSBuZXdWYWx1ZTtcbiAgfVxuICByZW1vdmUgKCkge1xuICAgIC8vIHRoaXMucGFyZW50IGlzIGEgcG9pbnRlciB0byB0aGUgcmF3IGVsZW1lbnQsIHNvIHdlIHdhbnQgdG8gZGVsZXRlIGl0c1xuICAgIC8vIHJlZmVyZW5jZSB0byB0aGlzIGl0ZW1cbiAgICBkZWxldGUgdGhpcy5wYXJlbnRbdGhpcy5sYWJlbF07XG4gIH1cbiAgZXF1YWxzIChvdGhlcikge1xuICAgIHJldHVybiBvdGhlciBpbnN0YW5jZW9mIEJhc2VXcmFwcGVyICYmXG4gICAgICB0aGlzLnVuaXF1ZVNlbGVjdG9yID09PSBvdGhlci51bmlxdWVTZWxlY3RvcjtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuQmFzZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG59O1xuQmFzZVdyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyB2YWx1ZSB9KSA9PiB7XG4gIC8vIERlZmF1bHQgYWN0aW9uOiBkbyBub3RoaW5nXG4gIHJldHVybiB2YWx1ZTtcbn07XG5CYXNlV3JhcHBlci5pc0JhZFZhbHVlID0gdmFsdWUgPT4gZmFsc2U7XG5cbmV4cG9ydCBkZWZhdWx0IEJhc2VXcmFwcGVyO1xuIiwiaW1wb3J0IEJhc2VXcmFwcGVyIGZyb20gJy4vQmFzZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBSb290V3JhcHBlciBleHRlbmRzIEJhc2VXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgZG9jTGlzdCB9KSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIHBhdGg6IFtdLFxuICAgICAgdmFsdWU6IHt9LFxuICAgICAgcGFyZW50OiBudWxsLFxuICAgICAgZG9jOiBudWxsLFxuICAgICAgbGFiZWw6IG51bGwsXG4gICAgICB1bmlxdWVTZWxlY3RvcjogJ0AnXG4gICAgfSk7XG4gICAgZG9jTGlzdC5mb3JFYWNoKGRvYyA9PiB7XG4gICAgICB0aGlzLnZhbHVlW2RvYy5faWRdID0gZG9jO1xuICAgIH0pO1xuICB9XG4gIHJlbW92ZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCByZW1vdmUgdGhlIHJvb3QgaXRlbWApO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290V3JhcHBlcjtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgQmFzZVdyYXBwZXIgZnJvbSAnLi9CYXNlV3JhcHBlci5qcyc7XG5cbmNsYXNzIFR5cGVkV3JhcHBlciBleHRlbmRzIEJhc2VXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgbGV0IHBhcmVudDtcbiAgICBpZiAocGF0aC5sZW5ndGggPCAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNyZWF0ZSBhIG5vbi1Sb290IG9yIG5vbi1Eb2MgV3JhcHBlciB3aXRoIGEgcGF0aCBsZW5ndGggbGVzcyB0aGFuIDJgKTtcbiAgICB9IGVsc2UgaWYgKHBhdGgubGVuZ3RoID09PSAyKSB7XG4gICAgICBwYXJlbnQgPSBkb2M7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCB0ZW1wID0ganNvblBhdGguc3RyaW5naWZ5KHBhdGguc2xpY2UoMSwgcGF0aC5sZW5ndGggLSAxKSk7XG4gICAgICBwYXJlbnQgPSBqc29uUGF0aC52YWx1ZShkb2MsIHRlbXApO1xuICAgIH1cbiAgICBjb25zdCBkb2NQYXRoUXVlcnkgPSBwYXRoWzBdO1xuICAgIGNvbnN0IHVuaXF1ZUpzb25QYXRoID0ganNvblBhdGguc3RyaW5naWZ5KHBhdGguc2xpY2UoMSkpO1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBwYXRoLFxuICAgICAgdmFsdWUsXG4gICAgICBwYXJlbnQsXG4gICAgICBkb2MsXG4gICAgICBsYWJlbDogcGF0aFtwYXRoLmxlbmd0aCAtIDFdLFxuICAgICAgdW5pcXVlU2VsZWN0b3I6ICdAJyArIGRvY1BhdGhRdWVyeSArIHVuaXF1ZUpzb25QYXRoXG4gICAgfSk7XG4gICAgaWYgKHRoaXMuY29uc3RydWN0b3IuaXNCYWRWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYHR5cGVvZiAke3ZhbHVlfSBpcyAke3R5cGVvZiB2YWx1ZX0sIHdoaWNoIGRvZXMgbm90IG1hdGNoIHJlcXVpcmVkICR7dGhpcy5jb25zdHJ1Y3Rvci5KU1RZUEV9YCk7XG4gICAgfVxuICB9XG4gIGdldCBwYXJlbnRXcmFwcGVyICgpIHtcbiAgICBjb25zdCBQYXJlbnRUeXBlID0gdGhpcy5tdXJlLmluZmVyVHlwZSh0aGlzLnBhcmVudCk7XG4gICAgcmV0dXJuIG5ldyBQYXJlbnRUeXBlKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIHZhbHVlOiB0aGlzLnBhcmVudCxcbiAgICAgIHBhdGg6IHRoaXMucGF0aC5zbGljZSgwLCB0aGlzLnBhdGgubGVuZ3RoIC0gMSksXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gIH1cbn1cblR5cGVkV3JhcHBlci5KU1RZUEUgPSAnb2JqZWN0JztcblR5cGVkV3JhcHBlci5pc0JhZFZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHJldHVybiAodHlwZW9mIHZhbHVlKSAhPT0gdGhpcy5KU1RZUEU7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgdmFsaWQtdHlwZW9mXG59O1xuXG5leHBvcnQgZGVmYXVsdCBUeXBlZFdyYXBwZXI7XG4iLCJleHBvcnQgZGVmYXVsdCAoc3VwZXJjbGFzcykgPT4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgZ2V0VmFsdWUgKGF0dHJpYnV0ZSwgdGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIHJldHVybiB0YXJnZXQudmFsdWVbYXR0cmlidXRlXTtcbiAgfVxuICBnZXRBdHRyaWJ1dGVzICh0YXJnZXQgPSB0aGlzLl9jb250ZW50V3JhcHBlciB8fCB0aGlzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRhcmdldC52YWx1ZSlcbiAgICAgIC5maWx0ZXIoZCA9PiAhdGhpcy5tdXJlLlJFU0VSVkVEX09CSl9LRVlTW2RdKTtcbiAgfVxuICBnZXRDb250ZW50cyAodGFyZ2V0ID0gdGhpcy5fY29udGVudFdyYXBwZXIgfHwgdGhpcykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKHRhcmdldC52YWx1ZSkuZm9yRWFjaCgoW2xhYmVsLCB2YWx1ZV0pID0+IHtcbiAgICAgIGlmICghdGhpcy5tdXJlLlJFU0VSVkVEX09CSl9LRVlTW2xhYmVsXSkge1xuICAgICAgICBsZXQgV3JhcHBlclR5cGUgPSB0aGlzLm11cmUuaW5mZXJUeXBlKHZhbHVlKTtcbiAgICAgICAgY29uc3QgdGVtcCA9IG5ldyBXcmFwcGVyVHlwZSh7XG4gICAgICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIHBhdGg6IHRhcmdldC5wYXRoLmNvbmNhdChbbGFiZWxdKSxcbiAgICAgICAgICBkb2M6IHRhcmdldC5kb2NcbiAgICAgICAgfSk7XG4gICAgICAgIHJlc3VsdFt0ZW1wLnVuaXF1ZVNlbGVjdG9yXSA9IHRlbXA7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRDb250ZW50U2VsZWN0b3JzICh0YXJnZXQgPSB0aGlzLl9jb250ZW50V3JhcHBlciB8fCB0aGlzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0Q29udGVudHModGFyZ2V0KSk7XG4gIH1cbiAgZ2V0Q29udGVudENvdW50ICh0YXJnZXQgPSB0aGlzLl9jb250ZW50V3JhcHBlciB8fCB0aGlzKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRhcmdldC52YWx1ZSlcbiAgICAgIC5maWx0ZXIobGFiZWwgPT4gIXRoaXMubXVyZS5SRVNFUlZFRF9PQkpfS0VZU1tsYWJlbF0pXG4gICAgICAubGVuZ3RoO1xuICB9XG59O1xuIiwiaW1wb3J0IGpzb25QYXRoIGZyb20gJ2pzb25wYXRoJztcbmltcG9ydCBUeXBlZFdyYXBwZXIgZnJvbSAnLi9UeXBlZFdyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXJNaXhpbiBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXJNaXhpbi5qcyc7XG5cbmNsYXNzIENvbnRhaW5lcldyYXBwZXIgZXh0ZW5kcyBDb250YWluZXJXcmFwcGVyTWl4aW4oVHlwZWRXcmFwcGVyKSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIHN1cGVyKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KTtcbiAgICB0aGlzLm5leHRMYWJlbCA9IE9iamVjdC5rZXlzKHRoaXMudmFsdWUpXG4gICAgICAucmVkdWNlKChtYXgsIGtleSkgPT4ge1xuICAgICAgICBrZXkgPSBwYXJzZUludChrZXkpO1xuICAgICAgICBpZiAoIWlzTmFOKGtleSkgJiYga2V5ID4gbWF4KSB7XG4gICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gbWF4O1xuICAgICAgICB9XG4gICAgICB9LCAwKSArIDE7XG4gIH1cbiAgY3JlYXRlTmV3V3JhcHBlciAodmFsdWUsIGxhYmVsLCBXcmFwcGVyVHlwZSkge1xuICAgIFdyYXBwZXJUeXBlID0gV3JhcHBlclR5cGUgfHwgdGhpcy5tdXJlLmluZmVyVHlwZSh2YWx1ZSk7XG4gICAgaWYgKGxhYmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGxhYmVsID0gU3RyaW5nKHRoaXMubmV4dExhYmVsKTtcbiAgICAgIHRoaXMubmV4dExhYmVsICs9IDE7XG4gICAgfVxuICAgIGxldCBwYXRoID0gdGhpcy5wYXRoLmNvbmNhdChsYWJlbCk7XG4gICAgbGV0IGl0ZW0gPSBuZXcgV3JhcHBlclR5cGUoe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgdmFsdWU6IFdyYXBwZXJUeXBlLmdldEJvaWxlcnBsYXRlVmFsdWUoKSxcbiAgICAgIHBhdGgsXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gICAgdGhpcy5hZGRXcmFwcGVyKGl0ZW0sIGxhYmVsKTtcbiAgICByZXR1cm4gaXRlbTtcbiAgfVxuICBhZGRXcmFwcGVyIChpdGVtLCBsYWJlbCkge1xuICAgIGlmIChpdGVtIGluc3RhbmNlb2YgQ29udGFpbmVyV3JhcHBlcikge1xuICAgICAgaWYgKGl0ZW0udmFsdWUuX2lkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignV3JhcHBlciBoYXMgYWxyZWFkeSBiZWVuIGFzc2lnbmVkIGFuIF9pZCcpO1xuICAgICAgfVxuICAgICAgaWYgKGxhYmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGFiZWwgPSB0aGlzLm5leHRMYWJlbDtcbiAgICAgICAgdGhpcy5uZXh0TGFiZWwgKz0gMTtcbiAgICAgIH1cbiAgICAgIGl0ZW0udmFsdWUuX2lkID0gYEAke2pzb25QYXRoLnN0cmluZ2lmeSh0aGlzLnBhdGguc2xpY2UoMSkuY29uY2F0KFtsYWJlbF0pKX1gO1xuICAgIH1cbiAgICB0aGlzLnZhbHVlW2xhYmVsXSA9IGl0ZW0udmFsdWU7XG4gIH1cbn1cbkNvbnRhaW5lcldyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHsgcmV0dXJuIHt9OyB9O1xuQ29udGFpbmVyV3JhcHBlci5jb252ZXJ0QXJyYXkgPSB2YWx1ZSA9PiB7XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgbGV0IHRlbXAgPSB7fTtcbiAgICB2YWx1ZS5mb3JFYWNoKChlbGVtZW50LCBpbmRleCkgPT4ge1xuICAgICAgdGVtcFtpbmRleF0gPSBlbGVtZW50O1xuICAgIH0pO1xuICAgIHZhbHVlID0gdGVtcDtcbiAgICB2YWx1ZS4kd2FzQXJyYXkgPSB0cnVlO1xuICB9XG4gIHJldHVybiB2YWx1ZTtcbn07XG5Db250YWluZXJXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KSA9PiB7XG4gIC8vIEFzc2lnbiB0aGUgb2JqZWN0J3MgaWQgaWYgYSBwYXRoIGlzIHN1cHBsaWVkXG4gIGlmIChwYXRoKSB7XG4gICAgdmFsdWUuX2lkID0gJ0AnICsganNvblBhdGguc3RyaW5naWZ5KHBhdGguc2xpY2UoMSkpO1xuICB9XG4gIC8vIFJlY3Vyc2l2ZWx5IHN0YW5kYXJkaXplIGNvbnRlbnRzIGlmIGEgcGF0aCBhbmQgZG9jIGFyZSBzdXBwbGllZFxuICBpZiAocGF0aCAmJiBkb2MpIHtcbiAgICBPYmplY3QuZW50cmllcyh2YWx1ZSkuZm9yRWFjaCgoW2tleSwgbmVzdGVkVmFsdWVdKSA9PiB7XG4gICAgICBpZiAoIW11cmUuUkVTRVJWRURfT0JKX0tFWVNba2V5XSkge1xuICAgICAgICBsZXQgdGVtcCA9IEFycmF5LmZyb20ocGF0aCk7XG4gICAgICAgIHRlbXAucHVzaChrZXkpO1xuICAgICAgICAvLyBBbGF5d3MgY29udmVydCBhcnJheXMgdG8gb2JqZWN0c1xuICAgICAgICBuZXN0ZWRWYWx1ZSA9IENvbnRhaW5lcldyYXBwZXIuY29udmVydEFycmF5KG5lc3RlZFZhbHVlKTtcbiAgICAgICAgLy8gV2hhdCBraW5kIG9mIHZhbHVlIGFyZSB3ZSBkZWFsaW5nIHdpdGg/XG4gICAgICAgIGxldCBXcmFwcGVyVHlwZSA9IG11cmUuaW5mZXJUeXBlKG5lc3RlZFZhbHVlLCBhZ2dyZXNzaXZlKTtcbiAgICAgICAgLy8gQXBwbHkgdGhhdCBjbGFzcydzIHN0YW5kYXJkaXphdGlvbiBmdW5jdGlvblxuICAgICAgICB2YWx1ZVtrZXldID0gV3JhcHBlclR5cGUuc3RhbmRhcmRpemUoe1xuICAgICAgICAgIG11cmUsXG4gICAgICAgICAgdmFsdWU6IG5lc3RlZFZhbHVlLFxuICAgICAgICAgIHBhdGg6IHRlbXAsXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIGFnZ3Jlc3NpdmVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgQ29udGFpbmVyV3JhcHBlcjtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgQmFzZVdyYXBwZXIgZnJvbSAnLi9CYXNlV3JhcHBlci5qcyc7XG5pbXBvcnQgQ29udGFpbmVyV3JhcHBlciBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXJNaXhpbiBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXJNaXhpbi5qcyc7XG5cbi8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSBbXG4gICdqc29uJyxcbiAgJ2NzdicsXG4gICd0c3YnLFxuICAndG9wb2pzb24nLFxuICAndHJlZWpzb24nXG5dO1xuXG5jbGFzcyBEb2N1bWVudFdyYXBwZXIgZXh0ZW5kcyBDb250YWluZXJXcmFwcGVyTWl4aW4oQmFzZVdyYXBwZXIpIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgZG9jIH0pIHtcbiAgICBjb25zdCBkb2NQYXRoUXVlcnkgPSBge1wiX2lkXCI6XCIke2RvYy5faWR9XCJ9YDtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgcGF0aDogW2RvY1BhdGhRdWVyeSwgJyQnXSxcbiAgICAgIHZhbHVlOiBkb2MsXG4gICAgICBwYXJlbnQ6IG51bGwsXG4gICAgICBkb2M6IGRvYyxcbiAgICAgIGxhYmVsOiBkb2NbJ2ZpbGVuYW1lJ10sXG4gICAgICB1bmlxdWVTZWxlY3RvcjogJ0AnICsgZG9jUGF0aFF1ZXJ5ICsgJyQnXG4gICAgfSk7XG4gICAgdGhpcy5fY29udGVudFdyYXBwZXIgPSBuZXcgQ29udGFpbmVyV3JhcHBlcih7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICB2YWx1ZTogdGhpcy52YWx1ZS5jb250ZW50cyxcbiAgICAgIHBhdGg6IHRoaXMucGF0aC5jb25jYXQoWydjb250ZW50cyddKSxcbiAgICAgIGRvYzogdGhpcy5kb2NcbiAgICB9KTtcbiAgfVxuICByZW1vdmUgKCkge1xuICAgIC8vIFRPRE86IHJlbW92ZSBldmVyeXRoaW5nIGluIHRoaXMudmFsdWUgZXhjZXB0IF9pZCwgX3JldiwgYW5kIGFkZCBfZGVsZXRlZD9cbiAgICAvLyBUaGVyZSdzIHByb2JhYmx5IHNvbWUgZnVua2luZXNzIGluIHRoZSB0aW1pbmcgb2Ygc2F2ZSgpIEkgc3RpbGwgbmVlZCB0b1xuICAgIC8vIHRoaW5rIHRocm91Z2guLi5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYERlbGV0aW5nIGZpbGVzIHZpYSBTZWxlY3Rpb25zIG5vdCB5ZXQgaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuRG9jdW1lbnRXcmFwcGVyLmlzVmFsaWRJZCA9IChkb2NJZCkgPT4ge1xuICBpZiAoZG9jSWRbMF0udG9Mb3dlckNhc2UoKSAhPT0gZG9jSWRbMF0pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgbGV0IHBhcnRzID0gZG9jSWQuc3BsaXQoJzsnKTtcbiAgaWYgKHBhcnRzLmxlbmd0aCAhPT0gMikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gISFtaW1lLmV4dGVuc2lvbihwYXJ0c1swXSk7XG59O1xuRG9jdW1lbnRXcmFwcGVyLnBhcnNlID0gYXN5bmMgKHRleHQsIGV4dGVuc2lvbikgPT4ge1xuICBsZXQgY29udGVudHM7XG4gIGlmIChEQVRBTElCX0ZPUk1BVFMuaW5kZXhPZihleHRlbnNpb24pICE9PSAtMSkge1xuICAgIGNvbnRlbnRzID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gIH1cbiAgaWYgKCFjb250ZW50cy5jb250ZW50cykge1xuICAgIGNvbnRlbnRzID0geyBjb250ZW50czogY29udGVudHMgfTtcbiAgfVxuICByZXR1cm4gY29udGVudHM7XG59O1xuRG9jdW1lbnRXcmFwcGVyLmxhdW5jaFN0YW5kYXJkaXphdGlvbiA9IGFzeW5jICh7IG11cmUsIGRvYyB9KSA9PiB7XG4gIGxldCBleGlzdGluZ1VudGl0bGVkcyA9IGF3YWl0IG11cmUuZGIuYWxsRG9jcyh7XG4gICAgc3RhcnRrZXk6IGRvYy5taW1lVHlwZSArICc7VW50aXRsZWQgJyxcbiAgICBlbmRrZXk6IGRvYy5taW1lVHlwZSArICc7VW50aXRsZWQgXFx1ZmZmZidcbiAgfSk7XG4gIHJldHVybiBEb2N1bWVudFdyYXBwZXIuc3RhbmRhcmRpemUoe1xuICAgIG11cmUsXG4gICAgZG9jLFxuICAgIGV4aXN0aW5nVW50aXRsZWRzLFxuICAgIGFnZ3Jlc3NpdmU6IHRydWVcbiAgfSk7XG59O1xuRG9jdW1lbnRXcmFwcGVyLnN0YW5kYXJkaXplID0gKHtcbiAgbXVyZSxcbiAgZG9jLFxuICBleGlzdGluZ1VudGl0bGVkcyA9IHsgcm93czogW10gfSxcbiAgYWdncmVzc2l2ZVxufSkgPT4ge1xuICBpZiAoIWRvYy5faWQgfHwgIURvY3VtZW50V3JhcHBlci5pc1ZhbGlkSWQoZG9jLl9pZCkpIHtcbiAgICBpZiAoIWRvYy5taW1lVHlwZSAmJiAhZG9jLmZpbGVuYW1lKSB7XG4gICAgICAvLyBXaXRob3V0IGFuIGlkLCBmaWxlbmFtZSwgb3IgbWltZVR5cGUsIGp1c3QgYXNzdW1lIGl0J3MgYXBwbGljYXRpb24vanNvblxuICAgICAgZG9jLm1pbWVUeXBlID0gJ2FwcGxpY2F0aW9uL2pzb24nO1xuICAgIH1cbiAgICBpZiAoIWRvYy5maWxlbmFtZSkge1xuICAgICAgaWYgKGRvYy5faWQpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSBnaXZlbiBhbiBpbnZhbGlkIGlkOyB1c2UgaXQgYXMgdGhlIGZpbGVuYW1lIGluc3RlYWRcbiAgICAgICAgZG9jLmZpbGVuYW1lID0gZG9jLl9pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdpdGhvdXQgYW55dGhpbmcgdG8gZ28gb24sIHVzZSBcIlVudGl0bGVkIDFcIiwgZXRjXG4gICAgICAgIGxldCBtaW5JbmRleCA9IGV4aXN0aW5nVW50aXRsZWRzLnJvd3MucmVkdWNlKChtaW5JbmRleCwgdURvYykgPT4ge1xuICAgICAgICAgIGxldCBpbmRleCA9IC9VbnRpdGxlZCAoXFxkKykvZy5leGVjKHVEb2MuX2lkKTtcbiAgICAgICAgICBpbmRleCA9IGluZGV4ID8gaW5kZXhbMV0gfHwgSW5maW5pdHkgOiBJbmZpbml0eTtcbiAgICAgICAgICByZXR1cm4gaW5kZXggPCBtaW5JbmRleCA/IGluZGV4IDogbWluSW5kZXg7XG4gICAgICAgIH0sIEluZmluaXR5KTtcbiAgICAgICAgbWluSW5kZXggPSBpc0Zpbml0ZShtaW5JbmRleCkgPyBtaW5JbmRleCArIDEgOiAxO1xuICAgICAgICBkb2MuZmlsZW5hbWUgPSAnVW50aXRsZWQgJyArIG1pbkluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWRvYy5taW1lVHlwZSkge1xuICAgICAgLy8gV2Ugd2VyZSBnaXZlbiBhIGJpdCBvZiBpbmZvIHdpdGggdGhlIGZpbGVuYW1lIC8gYmFkIF9pZDtcbiAgICAgIC8vIHRyeSB0byBpbmZlciB0aGUgbWltZVR5cGUgZnJvbSB0aGF0IChhZ2FpbiB1c2UgYXBwbGljYXRpb24vanNvblxuICAgICAgLy8gaWYgdGhhdCBmYWlscylcbiAgICAgIGRvYy5taW1lVHlwZSA9IG1pbWUubG9va3VwKGRvYy5maWxlbmFtZSkgfHwgJ2FwcGxpY2F0aW9uL2pzb24nO1xuICAgIH1cbiAgICBkb2MubWltZVR5cGUgPSBkb2MubWltZVR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICBkb2MuX2lkID0gZG9jLm1pbWVUeXBlICsgJzsnICsgZG9jLmZpbGVuYW1lO1xuICB9XG4gIGlmIChkb2MuX2lkWzBdID09PSAnXycgfHwgZG9jLl9pZFswXSA9PT0gJyQnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBfaWRzIG1heSBub3Qgc3RhcnQgd2l0aCAnICsgZG9jLl9pZFswXSArICc6ICcgKyBkb2MuX2lkKTtcbiAgfVxuICBkb2MubWltZVR5cGUgPSBkb2MubWltZVR5cGUgfHwgZG9jLl9pZC5zcGxpdCgnOycpWzBdO1xuICBpZiAoIW1pbWUuZXh0ZW5zaW9uKGRvYy5taW1lVHlwZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbWltZVR5cGU6ICcgKyBkb2MubWltZVR5cGUpO1xuICB9XG4gIGRvYy5maWxlbmFtZSA9IGRvYy5maWxlbmFtZSB8fCBkb2MuX2lkLnNwbGl0KCc7JylbMV07XG4gIGRvYy5jaGFyc2V0ID0gKGRvYy5jaGFyc2V0IHx8ICdVVEYtOCcpLnRvVXBwZXJDYXNlKCk7XG5cbiAgZG9jLm9ycGhhbnMgPSBkb2Mub3JwaGFucyB8fCB7fTtcbiAgZG9jLm9ycGhhbnMuX2lkID0gJ0AkLm9ycGhhbnMnO1xuXG4gIGRvYy5jbGFzc2VzID0gZG9jLmNsYXNzZXMgfHwge307XG4gIGRvYy5jbGFzc2VzLl9pZCA9ICdAJC5jbGFzc2VzJztcblxuICBkb2MuY29udGVudHMgPSBkb2MuY29udGVudHMgfHwge307XG4gIC8vIEluIGNhc2UgZG9jLmNvbnRlbnRzIGlzIGFuIGFycmF5LCBwcmVwIGl0IGZvciBDb250YWluZXJXcmFwcGVyLnN0YW5kYXJkaXplXG4gIGRvYy5jb250ZW50cyA9IENvbnRhaW5lcldyYXBwZXIuY29udmVydEFycmF5KGRvYy5jb250ZW50cyk7XG4gIGRvYy5jb250ZW50cyA9IENvbnRhaW5lcldyYXBwZXIuc3RhbmRhcmRpemUoe1xuICAgIG11cmUsXG4gICAgdmFsdWU6IGRvYy5jb250ZW50cyxcbiAgICBwYXRoOiBbYHtcIl9pZFwiOlwiJHtkb2MuX2lkfVwifWAsICckJywgJ2NvbnRlbnRzJ10sXG4gICAgZG9jLFxuICAgIGFnZ3Jlc3NpdmVcbiAgfSk7XG5cbiAgcmV0dXJuIGRvYztcbn07XG5cbmV4cG9ydCBkZWZhdWx0IERvY3VtZW50V3JhcHBlcjtcbiIsImltcG9ydCBUeXBlZFdyYXBwZXIgZnJvbSAnLi9UeXBlZFdyYXBwZXIuanMnO1xuXG5jbGFzcyBQcmltaXRpdmVXcmFwcGVyIGV4dGVuZHMgVHlwZWRXcmFwcGVyIHtcbiAgc3RyaW5nVmFsdWUgKCkge1xuICAgIHJldHVybiBTdHJpbmcodGhpcy52YWx1ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJpbWl0aXZlV3JhcHBlcjtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgQmFzZVdyYXBwZXIgZnJvbSAnLi9CYXNlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEludmFsaWRXcmFwcGVyIGV4dGVuZHMgQmFzZVdyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBsZXQgcGFyZW50O1xuICAgIGlmIChwYXRoLmxlbmd0aCA8IDIpIHtcbiAgICAgIHBhcmVudCA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCA9PT0gMikge1xuICAgICAgcGFyZW50ID0gZG9jO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdGVtcCA9IGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEsIHBhdGgubGVuZ3RoIC0gMSkpO1xuICAgICAgcGFyZW50ID0ganNvblBhdGgudmFsdWUoZG9jLCB0ZW1wKTtcbiAgICB9XG4gICAgY29uc3QgZG9jUGF0aFF1ZXJ5ID0gcGF0aFswXSB8fCAnJztcbiAgICBjb25zdCB1bmlxdWVKc29uUGF0aCA9IGpzb25QYXRoLnN0cmluZ2lmeShwYXRoLnNsaWNlKDEpKTtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgcGF0aCxcbiAgICAgIHZhbHVlLFxuICAgICAgcGFyZW50LFxuICAgICAgZG9jLFxuICAgICAgbGFiZWw6IHBhdGhbcGF0aC5sZW5ndGggLSAxXSxcbiAgICAgIHVuaXF1ZVNlbGVjdG9yOiAnQCcgKyBkb2NQYXRoUXVlcnkgKyB1bmlxdWVKc29uUGF0aFxuICAgIH0pO1xuICB9XG4gIHN0cmluZ1ZhbHVlICgpIHtcbiAgICByZXR1cm4gJ0ludmFsaWQ6ICcgKyBTdHJpbmcodGhpcy52YWx1ZSk7XG4gIH1cbn1cbkludmFsaWRXcmFwcGVyLkpTVFlQRSA9ICdvYmplY3QnO1xuSW52YWxpZFdyYXBwZXIuaXNCYWRWYWx1ZSA9IHZhbHVlID0+IHRydWU7XG5cbmV4cG9ydCBkZWZhdWx0IEludmFsaWRXcmFwcGVyO1xuIiwiaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9QcmltaXRpdmVXcmFwcGVyLmpzJztcblxuY2xhc3MgTnVsbFdyYXBwZXIgZXh0ZW5kcyBQcmltaXRpdmVXcmFwcGVyIHt9XG5OdWxsV3JhcHBlci5KU1RZUEUgPSAnbnVsbCc7XG5OdWxsV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4gbnVsbDtcbk51bGxXcmFwcGVyLnN0YW5kYXJkaXplID0gKCkgPT4gbnVsbDtcblxuZXhwb3J0IGRlZmF1bHQgTnVsbFdyYXBwZXI7XG4iLCJpbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBCb29sZWFuV3JhcHBlciBleHRlbmRzIFByaW1pdGl2ZVdyYXBwZXIge31cbkJvb2xlYW5XcmFwcGVyLkpTVFlQRSA9ICdib29sZWFuJztcbkJvb2xlYW5XcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiBmYWxzZTtcbkJvb2xlYW5XcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4gISF2YWx1ZTtcblxuZXhwb3J0IGRlZmF1bHQgQm9vbGVhbldyYXBwZXI7XG4iLCJpbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOdW1iZXJXcmFwcGVyIGV4dGVuZHMgUHJpbWl0aXZlV3JhcHBlciB7fVxuTnVtYmVyV3JhcHBlci5KU1RZUEUgPSAnbnVtYmVyJztcbk51bWJlcldyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IDA7XG5OdW1iZXJXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4gTnVtYmVyKHZhbHVlKTtcbk51bWJlcldyYXBwZXIuaXNCYWRWYWx1ZSA9IGlzTmFOO1xuXG5leHBvcnQgZGVmYXVsdCBOdW1iZXJXcmFwcGVyO1xuIiwiaW1wb3J0IFByaW1pdGl2ZVdyYXBwZXIgZnJvbSAnLi9QcmltaXRpdmVXcmFwcGVyLmpzJztcblxuY2xhc3MgU3RyaW5nV3JhcHBlciBleHRlbmRzIFByaW1pdGl2ZVdyYXBwZXIge31cblN0cmluZ1dyYXBwZXIuSlNUWVBFID0gJ3N0cmluZyc7XG5TdHJpbmdXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiAnJztcblN0cmluZ1dyYXBwZXIuc3RhbmRhcmRpemUgPSAoeyB2YWx1ZSB9KSA9PiB7XG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICB9IGVsc2Uge1xuICAgIEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbiAgfVxufTtcblxuZXhwb3J0IGRlZmF1bHQgU3RyaW5nV3JhcHBlcjtcbiIsImltcG9ydCBQcmltaXRpdmVXcmFwcGVyIGZyb20gJy4vUHJpbWl0aXZlV3JhcHBlci5qcyc7XG5cbmNsYXNzIERhdGVXcmFwcGVyIGV4dGVuZHMgUHJpbWl0aXZlV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSkge1xuICAgIHN1cGVyKHsgbXVyZSwgdmFsdWU6IERhdGVXcmFwcGVyLnN0YW5kYXJkaXplKHZhbHVlKSwgcGF0aCwgZG9jIH0pO1xuICB9XG4gIGdldCB2YWx1ZSAoKSB7IHJldHVybiBuZXcgRGF0ZSh0aGlzLl92YWx1ZS5zdHIpOyB9XG4gIHNldCB2YWx1ZSAobmV3VmFsdWUpIHtcbiAgICBzdXBlci52YWx1ZSA9IERhdGVXcmFwcGVyLnN0YW5kYXJkaXplKG5ld1ZhbHVlKTtcbiAgfVxuICBzdHJpbmdWYWx1ZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLnZhbHVlKTtcbiAgfVxufVxuRGF0ZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IG5ldyBEYXRlKCk7XG5EYXRlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IHZhbHVlIH0pID0+IHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICB2YWx1ZSA9IG5ldyBEYXRlKHZhbHVlKTtcbiAgfVxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgdmFsdWUgPSB7XG4gICAgICAkaXNEYXRlOiB0cnVlLFxuICAgICAgc3RyOiB2YWx1ZS50b1N0cmluZygpXG4gICAgfTtcbiAgfVxuICBpZiAoIXZhbHVlLiRpc0RhdGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byB3cmFwIERhdGUgb2JqZWN0YCk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufTtcbkRhdGVXcmFwcGVyLmlzQmFkVmFsdWUgPSB2YWx1ZSA9PiB2YWx1ZS50b1N0cmluZygpICE9PSAnSW52YWxpZCBEYXRlJztcblxuZXhwb3J0IGRlZmF1bHQgRGF0ZVdyYXBwZXI7XG4iLCJpbXBvcnQgU3RyaW5nV3JhcHBlciBmcm9tICcuL1N0cmluZ1dyYXBwZXIuanMnO1xuXG5jbGFzcyBSZWZlcmVuY2VXcmFwcGVyIGV4dGVuZHMgU3RyaW5nV3JhcHBlciB7fVxuUmVmZXJlbmNlV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4gJ0AkJztcblxuZXhwb3J0IGRlZmF1bHQgUmVmZXJlbmNlV3JhcHBlcjtcbiIsImltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgQ29udGFpbmVyV3JhcHBlciBmcm9tICcuL0NvbnRhaW5lcldyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIENvbnRhaW5lcldyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBzdXBlcih7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSk7XG4gICAgaWYgKCF2YWx1ZS4kdGFncykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgR2VuZXJpY1dyYXBwZXIgcmVxdWlyZXMgYSAkdGFncyBvYmplY3RgKTtcbiAgICB9XG4gIH1cbiAgYWRkQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgIGlmICghdGhpcy5kb2MuY2xhc3Nlc1tjbGFzc05hbWVdKSB7XG4gICAgICB0aGlzLmRvYy5jbGFzc2VzW2NsYXNzTmFtZV0gPSB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlKCk7XG4gICAgICB0aGlzLmRvYy5jbGFzc2VzW2NsYXNzTmFtZV0uX2lkID0gJ0AnICsganNvblBhdGguc3RyaW5naWZ5KFsnJCcsICdjbGFzc2VzJywgY2xhc3NOYW1lXSk7XG4gICAgfVxuICAgIGNvbnN0IGNsYXNzSXRlbSA9IG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcih7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBwYXRoOiBbdGhpcy5wYXRoWzBdLCAnJCcsICdjbGFzc2VzJywgY2xhc3NOYW1lXSxcbiAgICAgIHZhbHVlOiB0aGlzLmRvYy5jbGFzc2VzW2NsYXNzTmFtZV0sXG4gICAgICBkb2M6IHRoaXMuZG9jXG4gICAgfSk7XG4gICAgY2xhc3NJdGVtLmFkZFdyYXBwZXIodGhpcyk7XG4gIH1cbiAgZ2V0Q2xhc3NlcyAoKSB7XG4gICAgaWYgKCF0aGlzLnZhbHVlIHx8ICF0aGlzLnZhbHVlLiR0YWdzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnZhbHVlLiR0YWdzKS5yZWR1Y2UoKGFnZywgc2V0SWQpID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSB0aGlzLm11cmUuZXh0cmFjdENsYXNzSW5mb0Zyb21JZChzZXRJZCk7XG4gICAgICBpZiAodGVtcCkge1xuICAgICAgICBhZ2cucHVzaCh0ZW1wLmNsYXNzTmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKS5zb3J0KCk7XG4gIH1cbn1cbkdlbmVyaWNXcmFwcGVyLmdldEJvaWxlcnBsYXRlVmFsdWUgPSAoKSA9PiB7XG4gIHJldHVybiB7ICR0YWdzOiB7fSB9O1xufTtcbkdlbmVyaWNXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KSA9PiB7XG4gIC8vIERvIHRoZSByZWd1bGFyIENvbnRhaW5lcldyYXBwZXIgc3RhbmRhcmRpemF0aW9uXG4gIHZhbHVlID0gQ29udGFpbmVyV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIEVuc3VyZSB0aGUgZXhpc3RlbmNlIG9mIGEgJHRhZ3Mgb2JqZWN0XG4gIHZhbHVlLiR0YWdzID0gdmFsdWUuJHRhZ3MgfHwge307XG4gIC8vIE1vdmUgYW55IGV4aXN0aW5nIGNsYXNzIGRlZmluaXRpb25zIHRvIHRoaXMgZG9jdW1lbnRcbiAgT2JqZWN0LmtleXModmFsdWUuJHRhZ3MpLmZvckVhY2goc2V0SWQgPT4ge1xuICAgIGNvbnN0IHRlbXAgPSBtdXJlLmV4dHJhY3RDbGFzc0luZm9Gcm9tSWQoc2V0SWQpO1xuICAgIGlmICh0ZW1wKSB7XG4gICAgICBkZWxldGUgdmFsdWUuJHRhZ3Nbc2V0SWRdO1xuXG4gICAgICBzZXRJZCA9IGRvYy5jbGFzc2VzLl9pZCArIHRlbXAuY2xhc3NQYXRoQ2h1bms7XG4gICAgICB2YWx1ZS4kdGFnc1tzZXRJZF0gPSB0cnVlO1xuXG4gICAgICBkb2MuY2xhc3Nlc1t0ZW1wLmNsYXNzTmFtZV0gPSBkb2MuY2xhc3Nlc1t0ZW1wLmNsYXNzTmFtZV0gfHwgeyBfaWQ6IHNldElkLCAkbWVtYmVyczoge30gfTtcbiAgICAgIGRvYy5jbGFzc2VzW3RlbXAuY2xhc3NOYW1lXS4kbWVtYmVyc1t2YWx1ZS5faWRdID0gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImV4cG9ydCBkZWZhdWx0IChzdXBlcmNsYXNzKSA9PiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICBjb25zdHJ1Y3RvciAoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pIHtcbiAgICBzdXBlcih7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MgfSk7XG4gICAgaWYgKCF2YWx1ZS4kbWVtYmVycykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgU2V0V3JhcHBlciByZXF1aXJlcyBhICRtZW1iZXJzIG9iamVjdGApO1xuICAgIH1cbiAgfVxuICBhZGRXcmFwcGVyIChpdGVtKSB7XG4gICAgY29uc3QgaXRlbVRhZyA9IGl0ZW0udmFsdWUuX2lkO1xuICAgIGNvbnN0IHNldFRhZyA9IHRoaXMudmFsdWUuX2lkO1xuICAgIHRoaXMudmFsdWUuJG1lbWJlcnNbaXRlbVRhZ10gPSB0cnVlO1xuICAgIGl0ZW0udmFsdWUuJHRhZ3Nbc2V0VGFnXSA9IHRydWU7XG4gIH1cbiAgZ2V0TWVtYmVyU2VsZWN0b3JzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy52YWx1ZS4kbWVtYmVycyk7XG4gIH1cbiAgYXN5bmMgZ2V0TWVtYmVycyAoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5zZWxlY3RBbGwodGhpcy5nZXRNZW1iZXJTZWxlY3RvcnMoKSkuaXRlbXMoKTtcbiAgfVxufTtcbiIsImltcG9ydCBUeXBlZFdyYXBwZXIgZnJvbSAnLi9UeXBlZFdyYXBwZXIuanMnO1xuaW1wb3J0IFNldFdyYXBwZXJNaXhpbiBmcm9tICcuL1NldFdyYXBwZXJNaXhpbi5qcyc7XG5cbmNsYXNzIFNldFdyYXBwZXIgZXh0ZW5kcyBTZXRXcmFwcGVyTWl4aW4oVHlwZWRXcmFwcGVyKSB7fVxuU2V0V3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkbWVtYmVyczoge30gfTtcbn07XG5TZXRXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgdmFsdWUgfSkgPT4ge1xuICAvLyBFbnN1cmUgdGhlIGV4aXN0ZW5jZSBvZiBhICRtZW1iZXJzIG9iamVjdFxuICB2YWx1ZS4kbWVtYmVycyA9IHZhbHVlLiRtZW1iZXJzIHx8IHt9O1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTZXRXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgc3VwZXIoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pO1xuICAgIGlmICghdmFsdWUuJG5vZGVzKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBFZGdlV3JhcHBlciByZXF1aXJlcyBhICRub2RlcyBvYmplY3RgKTtcbiAgICB9XG4gIH1cbiAgYXR0YWNoVG8gKG5vZGUsIGRpcmVjdGlvbiA9ICd1bmRpcmVjdGVkJykge1xuICAgIG5vZGUudmFsdWUuJGVkZ2VzW3RoaXMudW5pcXVlU2VsZWN0b3JdID0gdHJ1ZTtcbiAgICBsZXQgbm9kZUlkID0gbm9kZS51bmlxdWVTZWxlY3RvcjtcbiAgICB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdID0gdGhpcy52YWx1ZS4kbm9kZXNbbm9kZUlkXSB8fCB7fTtcbiAgICB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdW2RpcmVjdGlvbl0gPSB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdW2RpcmVjdGlvbl0gfHwgMDtcbiAgICB0aGlzLnZhbHVlLiRub2Rlc1tub2RlSWRdW2RpcmVjdGlvbl0gKz0gMTtcbiAgfVxuICBhc3luYyBub2RlU2VsZWN0b3JzIChkaXJlY3Rpb24gPSBudWxsKSB7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHRoaXMudmFsdWUuJG5vZGVzKVxuICAgICAgLmZpbHRlcigoW3NlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4ge1xuICAgICAgICAvLyBudWxsIGluZGljYXRlcyB0aGF0IHdlIGFsbG93IGFsbCBtb3ZlbWVudFxuICAgICAgICByZXR1cm4gZGlyZWN0aW9uID09PSBudWxsIHx8IGRpcmVjdGlvbnNbZGlyZWN0aW9uXTtcbiAgICAgIH0pLm1hcCgoW3NlbGVjdG9yLCBkaXJlY3Rpb25zXSkgPT4gc2VsZWN0b3IpO1xuICB9XG4gIGFzeW5jIG5vZGVXcmFwcGVycyAoZm9yd2FyZCA9IG51bGwpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnNlbGVjdEFsbCgoYXdhaXQgdGhpcy5ub2RlU2VsZWN0b3JzKGZvcndhcmQpKSkuaXRlbXMoKTtcbiAgfVxuICBhc3luYyBub2RlV3JhcHBlckNvdW50IChmb3J3YXJkID0gbnVsbCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5ub2RlU2VsZWN0b3JzKGZvcndhcmQpKS5sZW5ndGg7XG4gIH1cbn1cbkVkZ2VXcmFwcGVyLm9wcG9zaXRlRGlyZWN0aW9uID0gZGlyZWN0aW9uID0+IHtcbiAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScgPyAndGFyZ2V0J1xuICAgIDogZGlyZWN0aW9uID09PSAndGFyZ2V0JyA/ICdzb3VyY2UnXG4gICAgICA6ICd1bmRpcmVjdGVkJztcbn07XG5FZGdlV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkdGFnczoge30sICRub2Rlczoge30gfTtcbn07XG5FZGdlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBEbyB0aGUgcmVndWxhciBHZW5lcmljV3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBHZW5lcmljV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIEVuc3VyZSB0aGUgZXhpc3RlbmNlIG9mIGEgJG5vZGVzIG9iamVjdFxuICB2YWx1ZS4kbm9kZXMgPSB2YWx1ZS4kbm9kZXMgfHwge307XG4gIHJldHVybiB2YWx1ZTtcbn07XG5FZGdlV3JhcHBlci5nbG9tcFZhbHVlID0gZWRnZUxpc3QgPT4ge1xuICBsZXQgdGVtcCA9IEdlbmVyaWNXcmFwcGVyLmdsb21wKGVkZ2VMaXN0KTtcbiAgdGVtcC52YWx1ZS4kbm9kZXMgPSB7fTtcbiAgZWRnZUxpc3QuZm9yRWFjaChlZGdlV3JhcHBlciA9PiB7XG4gICAgT2JqZWN0LmVudHJpZXMoZWRnZVdyYXBwZXIudmFsdWUuJG5vZGVzKS5mb3JFYWNoKChbc2VsZWN0b3IsIGRpcmVjdGlvbnNdKSA9PiB7XG4gICAgICB0ZW1wLiRub2Rlc1tzZWxlY3Rvcl0gPSB0ZW1wLnZhbHVlLiRub2Rlc1tzZWxlY3Rvcl0gfHwge307XG4gICAgICBPYmplY3Qua2V5cyhkaXJlY3Rpb25zKS5mb3JFYWNoKGRpcmVjdGlvbiA9PiB7XG4gICAgICAgIHRlbXAudmFsdWUuJG5vZGVzW3NlbGVjdG9yXVtkaXJlY3Rpb25dID0gdGVtcC52YWx1ZS4kbm9kZXNbc2VsZWN0b3JdW2RpcmVjdGlvbl0gfHwgMDtcbiAgICAgICAgdGVtcC52YWx1ZS4kbm9kZXNbc2VsZWN0b3JdW2RpcmVjdGlvbl0gKz0gZGlyZWN0aW9uc1tkaXJlY3Rpb25dO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gdGVtcDtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4vRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYyB9KSB7XG4gICAgc3VwZXIoeyBtdXJlLCB2YWx1ZSwgcGF0aCwgZG9jIH0pO1xuICAgIGlmICghdmFsdWUuJGVkZ2VzKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBOb2RlV3JhcHBlciByZXF1aXJlcyBhbiAkZWRnZXMgb2JqZWN0YCk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RUbyAob3RoZXJOb2RlLCBjb250YWluZXIsIGRpcmVjdGlvbiA9ICd1bmRpcmVjdGVkJykge1xuICAgIGxldCBuZXdFZGdlID0gY29udGFpbmVyLmNyZWF0ZU5ld1dyYXBwZXIoe30sIHVuZGVmaW5lZCwgRWRnZVdyYXBwZXIpO1xuICAgIG5ld0VkZ2UuYXR0YWNoVG8odGhpcywgZGlyZWN0aW9uKTtcbiAgICBuZXdFZGdlLmF0dGFjaFRvKG90aGVyTm9kZSwgRWRnZVdyYXBwZXIub3Bwb3NpdGVEaXJlY3Rpb24oZGlyZWN0aW9uKSk7XG4gICAgcmV0dXJuIG5ld0VkZ2U7XG4gIH1cbiAgYXN5bmMgZWRnZVNlbGVjdG9ycyAoZGlyZWN0aW9uID0gbnVsbCkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLnZhbHVlLiRlZGdlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAoYXdhaXQgdGhpcy5lZGdlV3JhcHBlcnMoZGlyZWN0aW9uKSkubWFwKGl0ZW0gPT4gaXRlbS51bmlxdWVTZWxlY3Rvcik7XG4gICAgfVxuICB9XG4gIGFzeW5jIGVkZ2VXcmFwcGVycyAoZGlyZWN0aW9uID0gbnVsbCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5tdXJlLnNlbGVjdEFsbChPYmplY3Qua2V5cyh0aGlzLnZhbHVlLiRlZ2RlcykpKS5pdGVtcygpXG4gICAgICAuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgICAvLyBudWxsIGluZGljYXRlcyB0aGF0IHdlIGFsbG93IGFsbCBlZGdlcy4gSWYgZGlyZWN0aW9uIGlzbid0IG51bGwsXG4gICAgICAgIC8vIG9ubHkgaW5jbHVkZSBlZGdlcyB3aGVyZSB3ZSBhcmUgdGhlIE9QUE9TSVRFIGRpcmVjdGlvbiAod2UgYXJlXG4gICAgICAgIC8vIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHRyYXZlcnNhbClcbiAgICAgICAgcmV0dXJuIGRpcmVjdGlvbiA9PT0gbnVsbCB8fFxuICAgICAgICAgIGl0ZW0uJG5vZGVzW3RoaXMudW5pcXVlU2VsZWN0b3JdW0VkZ2VXcmFwcGVyLm9wcG9zaXRlRGlyZWN0aW9uKGRpcmVjdGlvbildO1xuICAgICAgfSk7XG4gIH1cbiAgYXN5bmMgZWRnZVdyYXBwZXJDb3VudCAoZm9yd2FyZCA9IG51bGwpIHtcbiAgICByZXR1cm4gKGF3YWl0IHRoaXMuZWRnZVNlbGVjdG9ycyhmb3J3YXJkKSkubGVuZ3RoO1xuICB9XG59XG5Ob2RlV3JhcHBlci5nZXRCb2lsZXJwbGF0ZVZhbHVlID0gKCkgPT4ge1xuICByZXR1cm4geyAkdGFnczoge30sICRlZGdlczoge30gfTtcbn07XG5Ob2RlV3JhcHBlci5zdGFuZGFyZGl6ZSA9ICh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSkgPT4ge1xuICAvLyBEbyB0aGUgcmVndWxhciBHZW5lcmljV3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBHZW5lcmljV3JhcHBlci5zdGFuZGFyZGl6ZSh7IG11cmUsIHZhbHVlLCBwYXRoLCBkb2MsIGFnZ3Jlc3NpdmUgfSk7XG4gIC8vIEVuc3VyZSB0aGUgZXhpc3RlbmNlIG9mIGFuICRlZGdlcyBvYmplY3RcbiAgdmFsdWUuJGVkZ2VzID0gdmFsdWUuJGVkZ2VzIHx8IHt9O1xuICByZXR1cm4gdmFsdWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBTZXRXcmFwcGVyIGZyb20gJy4vU2V0V3JhcHBlci5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi9Ob2RlV3JhcHBlci5qcyc7XG5pbXBvcnQgU2V0V3JhcHBlck1peGluIGZyb20gJy4vU2V0V3JhcHBlck1peGluLmpzJztcblxuY2xhc3MgU3VwZXJub2RlV3JhcHBlciBleHRlbmRzIFNldFdyYXBwZXJNaXhpbihOb2RlV3JhcHBlcikge31cblN1cGVybm9kZVdyYXBwZXIuZ2V0Qm9pbGVycGxhdGVWYWx1ZSA9ICgpID0+IHtcbiAgcmV0dXJuIHsgJHRhZ3M6IHt9LCAkbWVtYmVyczoge30sICRlZGdlczoge30gfTtcbn07XG5TdXBlcm5vZGVXcmFwcGVyLnN0YW5kYXJkaXplID0gKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KSA9PiB7XG4gIC8vIERvIHRoZSByZWd1bGFyIE5vZGVXcmFwcGVyIHN0YW5kYXJkaXphdGlvblxuICB2YWx1ZSA9IE5vZGVXcmFwcGVyLnN0YW5kYXJkaXplKHsgbXVyZSwgdmFsdWUsIHBhdGgsIGRvYywgYWdncmVzc2l2ZSB9KTtcbiAgLy8gLi4uIGFuZCB0aGUgU2V0V3JhcHBlciBzdGFuZGFyZGl6YXRpb25cbiAgdmFsdWUgPSBTZXRXcmFwcGVyLnN0YW5kYXJkaXplKHsgdmFsdWUgfSk7XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbmV4cG9ydCBkZWZhdWx0IFN1cGVybm9kZVdyYXBwZXI7XG4iLCJjbGFzcyBJbnB1dFNwZWMge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgdGhpcy5vcHRpb25zID0ge307XG4gIH1cbiAgYWRkT3B0aW9uIChvcHRpb24pIHtcbiAgICB0aGlzLm9wdGlvbnNbb3B0aW9uLnBhcmFtZXRlck5hbWVdID0gb3B0aW9uO1xuICB9XG4gIGFzeW5jIHVwZGF0ZUNob2ljZXMgKHBhcmFtcykge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKHRoaXMub3B0aW9ucykubWFwKG9wdGlvbiA9PiB7XG4gICAgICBpZiAob3B0aW9uLnNwZWNzKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKG9wdGlvbi5zcGVjcylcbiAgICAgICAgICAubWFwKHNwZWMgPT4gc3BlYy51cGRhdGVDaG9pY2VzKHBhcmFtcykpKTtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9uLnVwZGF0ZUNob2ljZXMpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbi51cGRhdGVDaG9pY2VzKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfSkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IElucHV0U3BlYztcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi8uLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBJbnB1dE9wdGlvbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBwYXJhbWV0ZXJOYW1lLFxuICAgIGRlZmF1bHRWYWx1ZSA9IG51bGwsXG4gICAgY2hvaWNlcyA9IFtdLFxuICAgIG9wZW5FbmRlZCA9IGZhbHNlXG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMucGFyYW1ldGVyTmFtZSA9IHBhcmFtZXRlck5hbWU7XG4gICAgdGhpcy5fZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlO1xuICAgIHRoaXMuY2hvaWNlcyA9IGNob2ljZXM7XG4gICAgdGhpcy5vcGVuRW5kZWQgPSBvcGVuRW5kZWQ7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVQYXJhbWV0ZXJOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJOYW1lXG4gICAgICAucmVwbGFjZSgvLi8sIHRoaXMucGFyYW1ldGVyTmFtZVswXS50b0xvY2FsZVVwcGVyQ2FzZSgpKVxuICAgICAgLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG4gIGdldCBkZWZhdWx0VmFsdWUgKCkge1xuICAgIGlmICh0aGlzLl9kZWZhdWx0VmFsdWUgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLl9kZWZhdWx0VmFsdWU7XG4gICAgfSBlbHNlIGlmICh0aGlzLmNob2ljZXMubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuY2hvaWNlc1swXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIHNldCBkZWZhdWx0VmFsdWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fZGVmYXVsdFZhbHVlID0gdmFsdWU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnB1dE9wdGlvbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopT3B0aW9uLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW5wdXRPcHRpb247XG4iLCJjbGFzcyBPdXRwdXRTcGVjIHtcbiAgY29uc3RydWN0b3IgKHsgbmV3U2VsZWN0b3JzID0gbnVsbCwgcG9sbHV0ZWREb2NzID0ge30sIHdhcm5pbmdzID0ge30gfSA9IHt9KSB7XG4gICAgdGhpcy5uZXdTZWxlY3RvcnMgPSBuZXdTZWxlY3RvcnM7XG4gICAgdGhpcy5wb2xsdXRlZERvY3MgPSBwb2xsdXRlZERvY3M7XG4gICAgdGhpcy53YXJuaW5ncyA9IHdhcm5pbmdzO1xuICB9XG4gIGFkZFNlbGVjdG9ycyAoc2VsZWN0b3JzKSB7XG4gICAgdGhpcy5uZXdTZWxlY3RvcnMgPSAodGhpcy5uZXdTZWxlY3RvcnMgfHwgW10pLmNvbmNhdChzZWxlY3RvcnMpO1xuICB9XG4gIGZsYWdQb2xsdXRlZERvYyAoZG9jKSB7XG4gICAgdGhpcy5wb2xsdXRlZERvY3NbZG9jLl9pZF0gPSBkb2M7XG4gIH1cbiAgd2FybiAod2FybmluZykge1xuICAgIHRoaXMud2FybmluZ3Nbd2FybmluZ10gPSB0aGlzLndhcm5pbmdzW3dhcm5pbmddIHx8IDA7XG4gICAgdGhpcy53YXJuaW5nc1t3YXJuaW5nXSArPSAxO1xuICB9XG59XG5PdXRwdXRTcGVjLmdsb21wID0gc3BlY0xpc3QgPT4ge1xuICBsZXQgbmV3U2VsZWN0b3JzID0ge307XG4gIGxldCBwb2xsdXRlZERvY3MgPSB7fTtcbiAgbGV0IHdhcm5pbmdzID0ge307XG4gIHNwZWNMaXN0LmZvckVhY2goc3BlYyA9PiB7XG4gICAgaWYgKHNwZWMubmV3U2VsZWN0b3JzKSB7XG4gICAgICBzcGVjLm5ld1NlbGVjdG9ycy5mb3JFYWNoKHNlbGVjdG9yID0+IHtcbiAgICAgICAgbmV3U2VsZWN0b3JzW3NlbGVjdG9yXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhzcGVjLnBvbGx1dGVkRG9jcykuZm9yRWFjaChkb2MgPT4ge1xuICAgICAgcG9sbHV0ZWREb2NzW2RvYy5faWRdID0gZG9jO1xuICAgIH0pO1xuICAgIE9iamVjdC5lbnRyaWVzKHNwZWMud2FybmluZ3MpLmZvckVhY2goKFt3YXJuaW5nLCBjb3VudF0pID0+IHtcbiAgICAgIHdhcm5pbmdzW3dhcm5pbmddID0gd2FybmluZ3Nbd2FybmluZ10gfHwgMDtcbiAgICAgIHdhcm5pbmdzW3dhcm5pbmddICs9IGNvdW50O1xuICAgIH0pO1xuICB9KTtcbiAgbmV3U2VsZWN0b3JzID0gT2JqZWN0LmtleXMobmV3U2VsZWN0b3JzKTtcbiAgcmV0dXJuIG5ldyBPdXRwdXRTcGVjKHtcbiAgICBuZXdTZWxlY3RvcnM6IG5ld1NlbGVjdG9ycy5sZW5ndGggPiAwID8gbmV3U2VsZWN0b3JzIDogbnVsbCxcbiAgICBwb2xsdXRlZERvY3MsXG4gICAgd2FybmluZ3NcbiAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBPdXRwdXRTcGVjO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uLy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgSW5wdXRTcGVjIGZyb20gJy4vSW5wdXRTcGVjLmpzJztcbmltcG9ydCBJbnB1dE9wdGlvbiBmcm9tICcuL0lucHV0T3B0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vT3V0cHV0U3BlYy5qcyc7XG5cbmNsYXNzIEJhc2VPcGVyYXRpb24gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICB9XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IElucHV0U3BlYygpO1xuICAgIHJlc3VsdC5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdpZ25vcmVFcnJvcnMnLFxuICAgICAgY2hvaWNlczogWydTdG9wIG9uIEVycm9yJywgJ0lnbm9yZSddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnU3RvcCBvbiBFcnJvcidcbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBwb3RlbnRpYWxseUV4ZWN1dGFibGVPbkl0ZW0gKGl0ZW0pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgcmV0dXJuIGl0ZW0gJiYgaW5wdXRPcHRpb25zLmlnbm9yZUVycm9ycyAhPT0gJ1N0b3Agb24gRXJyb3InO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgfVxuICBnZXRJdGVtc0luVXNlIChpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBpdGVtc0luVXNlID0ge307XG4gICAgT2JqZWN0LnZhbHVlcyhpbnB1dE9wdGlvbnMpLmZvckVhY2goYXJndW1lbnQgPT4ge1xuICAgICAgaWYgKGFyZ3VtZW50ICYmIGFyZ3VtZW50LnVuaXF1ZVNlbGVjdG9yKSB7XG4gICAgICAgIGl0ZW1zSW5Vc2VbYXJndW1lbnQudW5pcXVlU2VsZWN0b3JdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gaXRlbXNJblVzZTtcbiAgfVxuICBhc3luYyBwb3RlbnRpYWxseUV4ZWN1dGFibGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uKSB7XG4gICAgY29uc3QgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhpdGVtcykuc29tZShpdGVtID0+IHRoaXMucG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtKGl0ZW0pKTtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3QgaXRlbXNJblVzZSA9IHRoaXMuZ2V0SXRlbXNJblVzZShpbnB1dE9wdGlvbnMpO1xuICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgY29uc3QgY2FuRXhlY3V0ZUluc3RhbmNlcyA9IChhd2FpdCBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKGl0ZW1zKVxuICAgICAgLm1hcChpdGVtID0+IHtcbiAgICAgICAgcmV0dXJuIGl0ZW1zSW5Vc2VbaXRlbS51bmlxdWVTZWxlY3Rvcl0gfHwgdGhpcy5jYW5FeGVjdXRlT25JbnN0YW5jZShpdGVtLCBpbnB1dE9wdGlvbnMpO1xuICAgICAgfSkpKTtcbiAgICBpZiAoY2FuRXhlY3V0ZUluc3RhbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGlmIChpbnB1dE9wdGlvbnMuaWdub3JlRXJyb3JzID09PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgIHJldHVybiBjYW5FeGVjdXRlSW5zdGFuY2VzLmV2ZXJ5KGNhbkV4ZWN1dGUgPT4gY2FuRXhlY3V0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjYW5FeGVjdXRlSW5zdGFuY2VzLnNvbWUoY2FuRXhlY3V0ZSA9PiBjYW5FeGVjdXRlKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IGl0ZW1zSW5Vc2UgPSB0aGlzLmdldEl0ZW1zSW5Vc2UoaW5wdXRPcHRpb25zKTtcbiAgICBjb25zdCBpdGVtcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgIGNvbnN0IG91dHB1dFNwZWNQcm9taXNlcyA9IE9iamVjdC52YWx1ZXMoaXRlbXMpLm1hcChpdGVtID0+IHtcbiAgICAgIGlmIChpdGVtc0luVXNlW2l0ZW0udW5pcXVlU2VsZWN0b3JdKSB7XG4gICAgICAgIHJldHVybiBuZXcgT3V0cHV0U3BlYygpOyAvLyBJZ25vcmUgaXRlbXMgdGhhdCBhcmUgaW5wdXRPcHRpb25zXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5leGVjdXRlT25JbnN0YW5jZShpdGVtLCBpbnB1dE9wdGlvbnMpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBPdXRwdXRTcGVjLmdsb21wKGF3YWl0IFByb21pc2UuYWxsKG91dHB1dFNwZWNQcm9taXNlcykpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZU9wZXJhdGlvbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopT3BlcmF0aW9uLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBCYXNlT3BlcmF0aW9uO1xuIiwiaW1wb3J0IElucHV0U3BlYyBmcm9tICcuL0lucHV0U3BlYy5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNsYXNzIENvbnRleHR1YWxPcHRpb24gZXh0ZW5kcyBJbnB1dE9wdGlvbiB7XG4gIGNvbnN0cnVjdG9yICh7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcyA9IFtdLCBoaWRkZW5DaG9pY2VzID0gW10gfSkge1xuICAgIGlmIChjaG9pY2VzLmxlbmd0aCA8IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ29udGV4dHVhbCBvcHRpb25zIG11c3Qgc3BlY2lmeSBhdCBsZWFzdCB0d28gY2hvaWNlcyBhIHByaW9yaScpO1xuICAgIH1cbiAgICBzdXBlcih7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcywgb3BlbkVuZGVkOiBmYWxzZSB9KTtcbiAgICB0aGlzLnNwZWNzID0ge307XG4gICAgY2hvaWNlcy5jb25jYXQoaGlkZGVuQ2hvaWNlcykuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgdGhpcy5zcGVjc1tjaG9pY2VdID0gbmV3IElucHV0U3BlYygpO1xuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb250ZXh0dWFsT3B0aW9uO1xuIiwiaW1wb3J0IFNlbGVjdGlvbiBmcm9tICcuLi9TZWxlY3Rpb24uanMnO1xuaW1wb3J0IEJhc2VPcGVyYXRpb24gZnJvbSAnLi9Db21tb24vQmFzZU9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgT3V0cHV0U3BlYyBmcm9tICcuL0NvbW1vbi9PdXRwdXRTcGVjLmpzJztcbmltcG9ydCBDb250ZXh0dWFsT3B0aW9uIGZyb20gJy4vQ29tbW9uL0NvbnRleHR1YWxPcHRpb24uanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vQ29tbW9uL0lucHV0T3B0aW9uLmpzJztcblxuY2xhc3MgU2VsZWN0QWxsT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnQ2hpbGRyZW4nLCAnUGFyZW50cycsICdOb2RlcycsICdFZGdlcycsICdNZW1iZXJzJ10sXG4gICAgICBoaWRkZW5DaG9pY2VzOiBbJ1NlbGVjdG9yJywgJ1NlbGVjdG9yIExpc3QnLCAnU2VsZWN0aW9uJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdDaGlsZHJlbidcbiAgICB9KTtcbiAgICByZXN1bHQuYWRkT3B0aW9uKGNvbnRleHQpO1xuXG4gICAgY29uc3QgZGlyZWN0aW9uID0gbmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdkaXJlY3Rpb24nLFxuICAgICAgY2hvaWNlczogWydJZ25vcmUnLCAnRm9yd2FyZCcsICdCYWNrd2FyZCddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnSWdub3JlJ1xuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ05vZGVzJ10uYWRkT3B0aW9uKGRpcmVjdGlvbik7XG4gICAgY29udGV4dC5zcGVjc1snRWRnZXMnXS5hZGRPcHRpb24oZGlyZWN0aW9uKTtcblxuICAgIC8vIEV4dHJhIHNldHRpbmdzIGZvciBoaWRkZW4gbW9kZXM6XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3InXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdhcHBlbmQnLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnWypdJyxcbiAgICAgIG9wZW5FbmRlZDogdHJ1ZVxuICAgIH0pKTtcbiAgICBjb250ZXh0LnNwZWNzWydTZWxlY3RvciBMaXN0J10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbXRlck5hbWU6ICdzZWxlY3Rvckxpc3QnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBbXVxuICAgIH0pKTtcbiAgICBjb250ZXh0LnNwZWNzWydTZWxlY3Rpb24nXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdvdGhlclNlbGVjdGlvbidcbiAgICB9KSk7XG5cbiAgICBjb25zdCBtb2RlID0gbmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdtb2RlJyxcbiAgICAgIGNob2ljZXM6IFsnUmVwbGFjZScsICdVbmlvbicsICdYT1InXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1JlcGxhY2UnXG4gICAgfSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3InXS5hZGRPcHRpb24obW9kZSk7XG4gICAgY29udGV4dC5zcGVjc1snU2VsZWN0b3IgTGlzdCddLmFkZE9wdGlvbihtb2RlKTtcbiAgICBjb250ZXh0LnNwZWNzWydTZWxlY3Rpb24nXS5hZGRPcHRpb24obW9kZSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoYXdhaXQgc3VwZXIuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0NoaWxkcmVuJykge1xuICAgICAgcmV0dXJuIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnUGFyZW50cycpIHtcbiAgICAgIHJldHVybiAhKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuUm9vdFdyYXBwZXIpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdOb2RlcycpIHtcbiAgICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0VkZ2VzJykge1xuICAgICAgcmV0dXJuIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIgfHxcbiAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnTWVtYmVycycpIHtcbiAgICAgIHJldHVybiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdTZWxlY3RvcicpIHtcbiAgICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihpdGVtLnVuaXF1ZVNlbGVjdG9yICsgaW5wdXRPcHRpb25zLmFwcGVuZCkgIT09IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgY29uc3QgZGlyZWN0aW9uID0gaW5wdXRPcHRpb25zLmRpcmVjdGlvbiB8fCAnSWdub3JlJztcbiAgICBjb25zdCBmb3J3YXJkID0gZGlyZWN0aW9uID09PSAnRm9yd2FyZCcgPyB0cnVlXG4gICAgICA6IGRpcmVjdGlvbiA9PT0gJ0JhY2t3YXJkJyA/IGZhbHNlXG4gICAgICAgIDogbnVsbDtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdDaGlsZHJlbicgJiZcbiAgICAgICAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyKSkge1xuICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhPYmplY3QudmFsdWVzKGl0ZW0uZ2V0Q29udGVudHMoKSlcbiAgICAgICAgLm1hcChjaGlsZFdyYXBwZXIgPT4gY2hpbGRXcmFwcGVyLnVuaXF1ZVNlbGVjdG9yKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1BhcmVudHMnICYmXG4gICAgICAgICAgICAgIShpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlciB8fFxuICAgICAgICAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Sb290V3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoW2l0ZW0ucGFyZW50V3JhcHBlci51bmlxdWVTZWxlY3Rvcl0pO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdOb2RlcycgJiZcbiAgICAgICAgICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoYXdhaXQgaXRlbS5ub2RlU2VsZWN0b3JzKGZvcndhcmQpKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnTm9kZXMnICYmXG4gICAgICAgICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKGF3YWl0IFByb21pc2UuYWxsKChhd2FpdCBpdGVtLmVkZ2VXcmFwcGVycyhmb3J3YXJkKSlcbiAgICAgICAgLm1hcChlZGdlID0+IGVkZ2Uubm9kZVNlbGVjdG9ycyhmb3J3YXJkKSkpKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnRWRnZXMnICYmXG4gICAgICAgICAgICAgICBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSB7XG4gICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKGF3YWl0IGl0ZW0uZWRnZVNlbGVjdG9ycyhmb3J3YXJkKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0VkZ2VzJyAmJlxuICAgICAgICAgICAgICAgaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcikge1xuICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhhd2FpdCBQcm9taXNlLmFsbCgoYXdhaXQgaXRlbS5ub2RlV3JhcHBlcnMoZm9yd2FyZCkpXG4gICAgICAgIC5tYXAobm9kZSA9PiBub2RlLmVkZ2VTZWxlY3RvcnMoZm9yd2FyZCkpKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ01lbWJlcnMnICYmXG4gICAgICAgICAgICAgIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMoYXdhaXQgaXRlbS5nZXRNZW1iZXJTZWxlY3RvcnMoKSk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1NlbGVjdG9yJykge1xuICAgICAgY29uc3QgbmV3U3RyaW5nID0gaXRlbS51bmlxdWVTZWxlY3RvciArIGlucHV0T3B0aW9ucy5hcHBlbmQ7XG4gICAgICBjb25zdCBuZXdTZWxlY3RvciA9IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKG5ld1N0cmluZyk7XG4gICAgICBpZiAobmV3U2VsZWN0b3IgPT09IG51bGwpIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYEludmFsaWQgc2VsZWN0b3I6ICR7bmV3U3RyaW5nfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhbbmV3U3RyaW5nXSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC53YXJuKGBDYW4ndCBzZWxlY3QgJHtpbnB1dE9wdGlvbnMuY29udGV4dH0gZnJvbSAke2l0ZW0udHlwZX1gKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnU2VsZWN0b3IgTGlzdCcpIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuc2VsZWN0b3JMaXN0IGluc3RhbmNlb2YgQXJyYXk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1NlbGVjdGlvbicpIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMub3RoZXJTZWxlY3Rpb24gaW5zdGFuY2VvZiBTZWxlY3Rpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdXBlci5jYW5FeGVjdXRlT25TZWxlY3Rpb24oc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgbGV0IG90aGVyU2VsZWN0b3JMaXN0ID0gaW5wdXRPcHRpb25zLnNlbGVjdG9yTGlzdCB8fFxuICAgICAgKGlucHV0T3B0aW9ucy5vdGhlclNlbGVjdGlvbiAmJiBpbnB1dE9wdGlvbnMub3RoZXJTZWxlY3Rpb24uc2VsZWN0b3JMaXN0KTtcbiAgICBpZiAob3RoZXJTZWxlY3Rvckxpc3QpIHtcbiAgICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdVbmlvbicpIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhzZWxlY3Rpb24uc2VsZWN0b3JMaXN0LmNvbmNhdChvdGhlclNlbGVjdG9yTGlzdCkpO1xuICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ1hPUicpIHtcbiAgICAgICAgb3V0cHV0LmFkZFNlbGVjdG9ycyhvdGhlclNlbGVjdG9yTGlzdFxuICAgICAgICAgIC5maWx0ZXIoc2VsZWN0b3IgPT4gc2VsZWN0aW9uLnNlbGVjdG9yTGlzdC5pbmRleE9mKHNlbGVjdG9yKSA9PT0gLTEpXG4gICAgICAgICAgLmNvbmNhdChzZWxlY3Rpb24uc2VsZWN0b3JMaXN0XG4gICAgICAgICAgICAuZmlsdGVyKHNlbGVjdG9yID0+IG90aGVyU2VsZWN0b3JMaXN0LmluZGV4T2Yoc2VsZWN0b3IpID09PSAtMSkpKTtcbiAgICAgIH0gZWxzZSB7IC8vIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ1JlcGxhY2UnKSB7XG4gICAgICAgIG91dHB1dC5hZGRTZWxlY3RvcnMob3RoZXJTZWxlY3Rvckxpc3QpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHN1cGVyLmV4ZWN1dGVPblNlbGVjdGlvbihzZWxlY3Rpb24sIGlucHV0T3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlbGVjdEFsbE9wZXJhdGlvbjtcbiIsImltcG9ydCBJbnB1dE9wdGlvbiBmcm9tICcuL0lucHV0T3B0aW9uLmpzJztcblxuY2xhc3MgU3RyaW5nT3B0aW9uIGV4dGVuZHMgSW5wdXRPcHRpb24ge1xuICBwb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyAoY2hvaWNlRGljdCkge1xuICAgIHRoaXMuY2hvaWNlcy5mb3JFYWNoKGNob2ljZSA9PiB7XG4gICAgICBpZiAoY2hvaWNlICE9PSBudWxsKSB7XG4gICAgICAgIGNob2ljZURpY3RbY2hvaWNlXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ09wdGlvbjtcbiIsImltcG9ydCBTdHJpbmdPcHRpb24gZnJvbSAnLi9TdHJpbmdPcHRpb24uanMnO1xuXG5jbGFzcyBDbGFzc09wdGlvbiBleHRlbmRzIFN0cmluZ09wdGlvbiB7XG4gIGFzeW5jIHVwZGF0ZUNob2ljZXMgKHsgaXRlbXMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGxldCBjbGFzc2VzID0ge307XG4gICAgaWYgKCFyZXNldCkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyhjbGFzc2VzKTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhpdGVtcykubWFwKGl0ZW0gPT4ge1xuICAgICAgcmV0dXJuIGl0ZW0uZ2V0Q2xhc3NlcyA/IGl0ZW0uZ2V0Q2xhc3NlcygpIDogW107XG4gICAgfSkuZm9yRWFjaChjbGFzc0xpc3QgPT4ge1xuICAgICAgY2xhc3NMaXN0LmZvckVhY2goY2xhc3NOYW1lID0+IHtcbiAgICAgICAgY2xhc3Nlc1tjbGFzc05hbWVdID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHRoaXMuY2hvaWNlcyA9IE9iamVjdC5rZXlzKGNsYXNzZXMpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDbGFzc09wdGlvbjtcbiIsImltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBDbGFzc09wdGlvbiBmcm9tICcuL0NvbW1vbi9DbGFzc09wdGlvbi5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9Db21tb24vSW5wdXRPcHRpb24uanMnO1xuXG5jb25zdCBERUZBVUxUX0ZJTFRFUl9GVU5DID0gJ3JldHVybiBpdGVtLnZhbHVlID09PSB0cnVlJztcblxuY2xhc3MgRmlsdGVyT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnQ2xhc3MnLCAnRnVuY3Rpb24nXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ0NsYXNzJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICBjb250ZXh0LnNwZWNzWydDbGFzcyddLmFkZE9wdGlvbihuZXcgQ2xhc3NPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2NsYXNzTmFtZSdcbiAgICB9KSk7XG4gICAgY29udGV4dC5zcGVjc1snRnVuY3Rpb24nXS5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdmaWx0ZXJGdW5jdGlvbicsXG4gICAgICBkZWZhdWx0VmFsdWU6IERFRkFVTFRfRklMVEVSX0ZVTkMsXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhlIEZpbHRlciBvcGVyYXRpb24gaXMgbm90IHlldCBzdXBwb3J0ZWQgYXQgdGhlIGluc3RhbmNlIGxldmVsYCk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0Z1bmN0aW9uJykge1xuICAgICAgaWYgKHR5cGVvZiBpbnB1dE9wdGlvbnMuZmlsdGVyRnVuY3Rpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBGdW5jdGlvbignaXRlbScsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9GSUxURVJfRlVOQyk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGlucHV0T3B0aW9ucy5jbGFzc05hbWU7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVPblNlbGVjdGlvbiAoc2VsZWN0aW9uLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBjb25zdCBvdXRwdXQgPSBuZXcgT3V0cHV0U3BlYygpO1xuICAgIGxldCBmaWx0ZXJGdW5jdGlvbjtcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGZpbHRlckZ1bmN0aW9uID0gaW5wdXRPcHRpb25zLmZpbHRlckZ1bmN0aW9uO1xuICAgICAgaWYgKHR5cGVvZiBmaWx0ZXJGdW5jdGlvbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZpbHRlckZ1bmN0aW9uID0gbmV3IEZ1bmN0aW9uKCdpdGVtJywgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgICAgICAgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuIHx8IERFRkFVTFRfRklMVEVSX0ZVTkMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICAgIG91dHB1dC53YXJuKGBmaWx0ZXJGdW5jdGlvbiBTeW50YXhFcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgeyAvLyBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdDbGFzcycpXG4gICAgICBmaWx0ZXJGdW5jdGlvbiA9IGl0ZW0gPT4ge1xuICAgICAgICByZXR1cm4gaXRlbS5nZXRDbGFzc2VzICYmIGl0ZW0uZ2V0Q2xhc3NlcygpLmluZGV4T2YoaW5wdXRPcHRpb25zLmNsYXNzTmFtZSkgIT09IC0xO1xuICAgICAgfTtcbiAgICB9XG4gICAgT2JqZWN0LnZhbHVlcyhhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKSkuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGlmIChmaWx0ZXJGdW5jdGlvbihpdGVtKSkge1xuICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtpdGVtLnVuaXF1ZVNlbGVjdG9yXSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBGaWx0ZXJPcGVyYXRpb247XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZUNvbnZlcnNpb24gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yICh7IG11cmUsIFRhcmdldFR5cGUsIHN0YW5kYXJkVHlwZXMgPSBbXSwgc3BlY2lhbFR5cGVzID0gW10gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcbiAgICB0aGlzLlRhcmdldFR5cGUgPSBUYXJnZXRUeXBlO1xuICAgIHRoaXMuc3RhbmRhcmRUeXBlcyA9IHt9O1xuICAgIHN0YW5kYXJkVHlwZXMuZm9yRWFjaChUeXBlID0+IHsgdGhpcy5zdGFuZGFyZFR5cGVzW1R5cGUudHlwZV0gPSBUeXBlOyB9KTtcbiAgICB0aGlzLnNwZWNpYWxUeXBlcyA9IHt9O1xuICAgIHNwZWNpYWxUeXBlcy5mb3JFYWNoKFR5cGUgPT4geyB0aGlzLnNwZWNpYWxUeXBlc1tUeXBlLnR5cGVdID0gVHlwZTsgfSk7XG4gIH1cbiAgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5zdGFuZGFyZFR5cGVzW2l0ZW0udHlwZV0gfHwgdGhpcy5zcGVjaWFsVHlwZXNbaXRlbS50eXBlXTtcbiAgfVxuICBjb252ZXJ0SXRlbSAoaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKSB7XG4gICAgaWYgKGl0ZW0uY29uc3RydWN0b3IgPT09IHRoaXMuVGFyZ2V0VHlwZSkge1xuICAgICAgLy8gc2tpcCBjb252ZXJzaW9uIGlmIHRoZSB0eXBlIGlzIGFscmVhZHkgdGhlIHNhbWVcbiAgICAgIHJldHVybjtcbiAgICB9IGlmICh0aGlzLnN0YW5kYXJkVHlwZXNbaXRlbS50eXBlXSkge1xuICAgICAgdGhpcy5zdGFuZGFyZENvbnZlcnNpb24oaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc3BlY2lhbFR5cGVzW2l0ZW0udHlwZV0pIHtcbiAgICAgIHRoaXMuc3BlY2lhbENvbnZlcnNpb24oaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0U3BlYy53YXJuKGBDb252ZXJzaW9uIGZyb20gJHtpdGVtLnR5cGV9IHRvICR7dGhpcy5UYXJnZXRUeXBlLnR5cGV9IGlzIG5vdCBzdXBwb3J0ZWRgKTtcbiAgICB9XG4gIH1cbiAgYWRkT3B0aW9uc1RvU3BlYyAoaW5wdXRTcGVjKSB7fVxuICBzdGFuZGFyZENvbnZlcnNpb24gKGl0ZW0sIGlucHV0T3B0aW9ucywgb3V0cHV0U3BlYykge1xuICAgIC8vIEJlY2F1c2Ugb2YgQmFzZVdyYXBwZXIncyBzZXR0ZXIsIHRoaXMgd2lsbCBhY3R1YWxseSBhcHBseSB0byB0aGVcbiAgICAvLyBpdGVtJ3MgZG9jdW1lbnQgYXMgd2VsbCBhcyB0byB0aGUgaXRlbSB3cmFwcGVyXG4gICAgaXRlbS52YWx1ZSA9IHRoaXMuVGFyZ2V0VHlwZS5zdGFuZGFyZGl6ZSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcbiAgICAgIHBhdGg6IGl0ZW0ucGF0aCxcbiAgICAgIGRvYzogaXRlbS5kb2NcbiAgICB9KTtcbiAgICBpZiAodGhpcy5UYXJnZXRUeXBlLmlzQmFkVmFsdWUoaXRlbS52YWx1ZSkpIHtcbiAgICAgIG91dHB1dFNwZWMud2FybihgQ29udmVydGVkICR7aXRlbS50eXBlfSB0byAke2l0ZW0udmFsdWV9YCk7XG4gICAgfVxuICB9XG4gIHNwZWNpYWxDb252ZXJzaW9uIChpdGVtLCBpbnB1dE9wdGlvbnMsIG91dHB1dFNwZWMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1pcGxlbWVudGVkJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlQ29udmVyc2lvbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ29udmVyc2lvbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBOdWxsQ29udmVyc2lvbiBleHRlbmRzIEJhc2VDb252ZXJzaW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgVGFyZ2V0VHlwZTogbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlN0cmluZ1dyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuRGF0ZVdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuUmVmZXJlbmNlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlNldFdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW11cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTnVsbENvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIEJvb2xlYW5Db252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLkJvb2xlYW5XcmFwcGVyLFxuICAgICAgc3RhbmRhcmRUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLk51bGxXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLk51bWJlcldyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuRGF0ZVdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuUmVmZXJlbmNlV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLlNldFdyYXBwZXIsXG4gICAgICAgIG11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLlN0cmluZ1dyYXBwZXJcbiAgICAgIF1cbiAgICB9KTtcbiAgfVxuICBzcGVjaWFsQ29udmVyc2lvbiAoaXRlbSwgaW5wdXRPcHRpb25zLCBvdXRwdXRTcGVjKSB7XG4gICAgLy8gVE9ETzogc21hcnRlciBjb252ZXJzaW9uIGZyb20gc3RyaW5ncyB0aGFuIGphdmFzY3JpcHQncyBkZWZhdWx0XG4gICAgaXRlbS52YWx1ZSA9ICEhaXRlbS52YWx1ZTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQm9vbGVhbkNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIE51bWJlckNvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuTnVtYmVyV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5TdHJpbmdXcmFwcGVyXG4gICAgICBdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE51bWJlckNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIFN0cmluZ0NvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuU3RyaW5nV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdWxsV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcixcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyLFxuICAgICAgICBtdXJlLldSQVBQRVJTLkRhdGVXcmFwcGVyXG4gICAgICBdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ0NvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZUNvbnZlcnNpb24gZnJvbSAnLi9CYXNlQ29udmVyc2lvbi5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDb252ZXJzaW9uIGV4dGVuZHMgQmFzZUNvbnZlcnNpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKHtcbiAgICAgIG11cmUsXG4gICAgICBUYXJnZXRUeXBlOiBtdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyLFxuICAgICAgc3RhbmRhcmRUeXBlczogW1xuICAgICAgICBtdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXJcbiAgICAgIF0sXG4gICAgICBzcGVjaWFsVHlwZXM6IFtdXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDb252ZXJzaW9uO1xuIiwiaW1wb3J0IEJhc2VDb252ZXJzaW9uIGZyb20gJy4vQmFzZUNvbnZlcnNpb24uanMnO1xuXG5jbGFzcyBOb2RlQ29udmVyc2lvbiBleHRlbmRzIEJhc2VDb252ZXJzaW9uIHtcbiAgY29uc3RydWN0b3IgKG11cmUpIHtcbiAgICBzdXBlcih7XG4gICAgICBtdXJlLFxuICAgICAgVGFyZ2V0VHlwZTogbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcixcbiAgICAgIHN0YW5kYXJkVHlwZXM6IFtcbiAgICAgICAgbXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyXG4gICAgICBdLFxuICAgICAgc3BlY2lhbFR5cGVzOiBbXVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOb2RlQ29udmVyc2lvbjtcbiIsImltcG9ydCBCYXNlQ29udmVyc2lvbiBmcm9tICcuL0Jhc2VDb252ZXJzaW9uLmpzJztcblxuY2xhc3MgRWRnZUNvbnZlcnNpb24gZXh0ZW5kcyBCYXNlQ29udmVyc2lvbiB7XG4gIGNvbnN0cnVjdG9yIChtdXJlKSB7XG4gICAgc3VwZXIoe1xuICAgICAgbXVyZSxcbiAgICAgIFRhcmdldFR5cGU6IG11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIsXG4gICAgICBzdGFuZGFyZFR5cGVzOiBbXG4gICAgICAgIG11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlclxuICAgICAgXSxcbiAgICAgIHNwZWNpYWxUeXBlczogW11cbiAgICB9KTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRWRnZUNvbnZlcnNpb247XG4iLCJpbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBJbnB1dFNwZWMgZnJvbSAnLi9Db21tb24vSW5wdXRTcGVjLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgTnVsbENvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9OdWxsQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgQm9vbGVhbkNvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9Cb29sZWFuQ29udmVyc2lvbi5qcyc7XG5pbXBvcnQgTnVtYmVyQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL051bWJlckNvbnZlcnNpb24uanMnO1xuaW1wb3J0IFN0cmluZ0NvbnZlcnNpb24gZnJvbSAnLi9Db252ZXJzaW9ucy9TdHJpbmdDb252ZXJzaW9uLmpzJztcbmltcG9ydCBHZW5lcmljQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL0dlbmVyaWNDb252ZXJzaW9uLmpzJztcbmltcG9ydCBOb2RlQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL05vZGVDb252ZXJzaW9uLmpzJztcbmltcG9ydCBFZGdlQ29udmVyc2lvbiBmcm9tICcuL0NvbnZlcnNpb25zL0VkZ2VDb252ZXJzaW9uLmpzJztcblxuY2xhc3MgQ29udmVydE9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBjb25zdHJ1Y3RvciAobXVyZSkge1xuICAgIHN1cGVyKG11cmUpO1xuXG4gICAgY29uc3QgY29udmVyc2lvbkxpc3QgPSBbXG4gICAgICBuZXcgQm9vbGVhbkNvbnZlcnNpb24obXVyZSksXG4gICAgICBuZXcgTnVtYmVyQ29udmVyc2lvbihtdXJlKSxcbiAgICAgIG5ldyBTdHJpbmdDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IE51bGxDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IEdlbmVyaWNDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IE5vZGVDb252ZXJzaW9uKG11cmUpLFxuICAgICAgbmV3IEVkZ2VDb252ZXJzaW9uKG11cmUpXG4gICAgXTtcbiAgICB0aGlzLkNPTlZFUlNJT05TID0ge307XG4gICAgY29udmVyc2lvbkxpc3QuZm9yRWFjaChjb252ZXJzaW9uID0+IHtcbiAgICAgIHRoaXMuQ09OVkVSU0lPTlNbY29udmVyc2lvbi50eXBlXSA9IGNvbnZlcnNpb247XG4gICAgfSk7XG4gIH1cbiAgZ2V0SW5wdXRTcGVjICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgSW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IE9iamVjdC5rZXlzKHRoaXMuQ09OVkVSU0lPTlMpLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnU3RyaW5nJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICBjb250ZXh0LmNob2ljZXMuZm9yRWFjaChjaG9pY2UgPT4ge1xuICAgICAgdGhpcy5DT05WRVJTSU9OU1tjaG9pY2VdLmFkZE9wdGlvbnNUb1NwZWMoY29udGV4dC5zcGVjc1tjaG9pY2VdKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgcG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5DT05WRVJTSU9OUykuc29tZShjb252ZXJzaW9uID0+IHtcbiAgICAgIHJldHVybiBjb252ZXJzaW9uLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0pO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGNhbkV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICBpZiAoYXdhaXQgc3VwZXIuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNvbnN0IGNvbnZlcnNpb24gPSB0aGlzLkNPTlZFUlNJT05TW2lucHV0T3B0aW9ucy5jb250ZXh0XTtcbiAgICByZXR1cm4gY29udmVyc2lvbiAmJiBjb252ZXJzaW9uLmNhbkV4ZWN1dGVPbkluc3RhbmNlKGl0ZW0sIGlucHV0T3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgY29uc3QgY29udmVyc2lvbiA9IHRoaXMuQ09OVkVSU0lPTlNbaW5wdXRPcHRpb25zLmNvbnRleHRdO1xuICAgIGlmICghY29udmVyc2lvbikge1xuICAgICAgb3V0cHV0Lndhcm4oYFVua25vd24gY29udGV4dCBmb3IgY29udmVyc2lvbjogJHtpbnB1dE9wdGlvbnMuY29udGV4dH1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29udmVyc2lvbi5jb252ZXJ0SXRlbShpdGVtLCBpbnB1dE9wdGlvbnMsIG91dHB1dCk7XG4gICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKGl0ZW0uZG9jKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDb252ZXJ0T3BlcmF0aW9uO1xuIiwiaW1wb3J0IENvbnRhaW5lcldyYXBwZXIgZnJvbSAnLi4vLi4vV3JhcHBlcnMvQ29udGFpbmVyV3JhcHBlci5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9JbnB1dE9wdGlvbi5qcyc7XG5cbmNsYXNzIFR5cGVkT3B0aW9uIGV4dGVuZHMgSW5wdXRPcHRpb24ge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIHBhcmFtZXRlck5hbWUsXG4gICAgZGVmYXVsdFZhbHVlLFxuICAgIGNob2ljZXMsXG4gICAgdmFsaWRUeXBlcyA9IFtdLFxuICAgIHN1Z2dlc3RPcnBoYW5zID0gZmFsc2VcbiAgfSkge1xuICAgIHN1cGVyKHtcbiAgICAgIHBhcmFtZXRlck5hbWUsXG4gICAgICBkZWZhdWx0VmFsdWUsXG4gICAgICBjaG9pY2VzLFxuICAgICAgb3BlbkVuZGVkOiBmYWxzZVxuICAgIH0pO1xuICAgIHRoaXMudmFsaWRUeXBlcyA9IHZhbGlkVHlwZXM7XG4gICAgdGhpcy5zdWdnZXN0T3JwaGFucyA9IHN1Z2dlc3RPcnBoYW5zO1xuICB9XG4gIGFzeW5jIHVwZGF0ZUNob2ljZXMgKHsgaXRlbXMsIGlucHV0T3B0aW9ucywgcmVzZXQgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgaXRlbUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IG9ycGhhbkxvb2t1cCA9IHt9O1xuICAgIGlmICghcmVzZXQpIHtcbiAgICAgIHRoaXMuY2hvaWNlcy5mb3JFYWNoKGNob2ljZSA9PiB7XG4gICAgICAgIGl0ZW1Mb29rdXBbY2hvaWNlLnVuaXF1ZVNlbGVjdG9yXSA9IGNob2ljZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBPYmplY3QudmFsdWVzKGl0ZW1zKS5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgaWYgKHRoaXMudmFsaWRUeXBlcy5pbmRleE9mKGl0ZW0uY29uc3RydWN0b3IpICE9PSAtMSkge1xuICAgICAgICBpdGVtTG9va3VwW2l0ZW0udW5pcXVlU2VsZWN0b3JdID0gaXRlbTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnN1Z2dlc3RPcnBoYW5zICYmIGl0ZW0uZG9jICYmICFvcnBoYW5Mb29rdXBbaXRlbS5kb2MuX2lkXSkge1xuICAgICAgICBvcnBoYW5Mb29rdXBbaXRlbS5kb2MuX2lkXSA9IG5ldyBDb250YWluZXJXcmFwcGVyKHtcbiAgICAgICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICAgICAgdmFsdWU6IGl0ZW0uZG9jLm9ycGhhbnMsXG4gICAgICAgICAgcGF0aDogW2l0ZW0ucGF0aFswXSwgJ29ycGhhbnMnXSxcbiAgICAgICAgICBkb2M6IGl0ZW0uZG9jXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuY2hvaWNlcyA9IE9iamVjdC52YWx1ZXMoaXRlbUxvb2t1cCkuY29uY2F0KE9iamVjdC52YWx1ZXMob3JwaGFuTG9va3VwKSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFR5cGVkT3B0aW9uO1xuIiwiaW1wb3J0IFN0cmluZ09wdGlvbiBmcm9tICcuL1N0cmluZ09wdGlvbi5qcyc7XG5cbmNsYXNzIEF0dHJpYnV0ZU9wdGlvbiBleHRlbmRzIFN0cmluZ09wdGlvbiB7XG4gIGFzeW5jIHBvcHVsYXRlRnJvbUl0ZW0gKGl0ZW0sIGF0dHJpYnV0ZXMpIHtcbiAgICBpZiAoaXRlbS5nZXRBdHRyaWJ1dGVzKSB7XG4gICAgICAoYXdhaXQgaXRlbS5nZXRBdHRyaWJ1dGVzKCkpLmZvckVhY2goYXR0ciA9PiB7XG4gICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIHBvcHVsYXRlRnJvbUl0ZW1zIChpdGVtcywgYXR0cmlidXRlcykge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChPYmplY3QudmFsdWVzKGl0ZW1zKS5tYXAoaXRlbSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5wb3B1bGF0ZUZyb21JdGVtKGl0ZW0sIGF0dHJpYnV0ZXMpO1xuICAgIH0pKTtcbiAgfVxuICBhc3luYyB1cGRhdGVDaG9pY2VzICh7IGl0ZW1zLCBpbnB1dE9wdGlvbnMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0ge307XG4gICAgaWYgKCFyZXNldCkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyhhdHRyaWJ1dGVzKTtcbiAgICB9XG4gICAgYXdhaXQgdGhpcy5wb3B1bGF0ZUZyb21JdGVtcyhpdGVtcywgYXR0cmlidXRlcyk7XG4gICAgdGhpcy5jaG9pY2VzID0gT2JqZWN0LmtleXMoYXR0cmlidXRlcyk7XG4gICAgdGhpcy5jaG9pY2VzLnVuc2hpZnQobnVsbCk7IC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGl0ZW0ncyBsYWJlbCBzaG91bGQgYmUgdXNlZFxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBdHRyaWJ1dGVPcHRpb247XG4iLCJpbXBvcnQgQXR0cmlidXRlT3B0aW9uIGZyb20gJy4vQXR0cmlidXRlT3B0aW9uLmpzJztcblxuY2xhc3MgTmVzdGVkQXR0cmlidXRlT3B0aW9uIGV4dGVuZHMgQXR0cmlidXRlT3B0aW9uIHtcbiAgY29uc3RydWN0b3IgKHsgcGFyYW1ldGVyTmFtZSwgZGVmYXVsdFZhbHVlLCBjaG9pY2VzLCBvcGVuRW5kZWQsIGdldEl0ZW1DaG9pY2VSb2xlIH0pIHtcbiAgICBzdXBlcih7IHBhcmFtZXRlck5hbWUsIGRlZmF1bHRWYWx1ZSwgY2hvaWNlcywgb3BlbkVuZGVkIH0pO1xuICAgIHRoaXMuZ2V0SXRlbUNob2ljZVJvbGUgPSBnZXRJdGVtQ2hvaWNlUm9sZTtcbiAgfVxuICBhc3luYyB1cGRhdGVDaG9pY2VzICh7IGl0ZW1zLCBpbnB1dE9wdGlvbnMsIHJlc2V0ID0gZmFsc2UgfSkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0ge307XG4gICAgaWYgKCFyZXNldCkge1xuICAgICAgdGhpcy5wb3B1bGF0ZUV4aXN0aW5nQ2hvaWNlU3RyaW5ncyhhdHRyaWJ1dGVzKTtcbiAgICB9XG4gICAgY29uc3QgaXRlbUxpc3QgPSBPYmplY3QudmFsdWVzKGl0ZW1zKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGl0ZW1MaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gaXRlbUxpc3RbaV07XG4gICAgICBjb25zdCBpdGVtUm9sZSA9IHRoaXMuZ2V0SXRlbUNob2ljZVJvbGUoaXRlbSwgaW5wdXRPcHRpb25zKTtcbiAgICAgIGlmIChpdGVtUm9sZSA9PT0gJ3N0YW5kYXJkJykge1xuICAgICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlRnJvbUl0ZW0oaXRlbSwgYXR0cmlidXRlcyk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW1Sb2xlID09PSAnZGVlcCcpIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBpdGVtLmdldE1lbWJlcnMgPyBhd2FpdCBpdGVtLmdldE1lbWJlcnMoKVxuICAgICAgICAgIDogaXRlbS5nZXRDb250ZW50cyA/IGl0ZW0uZ2V0Q29udGVudHMoKSA6IHt9O1xuICAgICAgICBhd2FpdCB0aGlzLnBvcHVsYXRlRnJvbUl0ZW1zKGNoaWxkcmVuLCBhdHRyaWJ1dGVzKTtcbiAgICAgIH0gLy8gZWxzZSBpZiAoaXRlbVJvbGUgPT09ICdpZ25vcmUnKVxuICAgIH1cbiAgICB0aGlzLmNob2ljZXMgPSBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKTtcbiAgICB0aGlzLmNob2ljZXMudW5zaGlmdChudWxsKTsgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgaXRlbSdzIGxhYmVsIHNob3VsZCBiZSB1c2VkXG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbjtcbiIsImltcG9ydCBTZWxlY3Rpb24gZnJvbSAnLi4vU2VsZWN0aW9uLmpzJztcbmltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBUeXBlZE9wdGlvbiBmcm9tICcuL0NvbW1vbi9UeXBlZE9wdGlvbi5qcyc7XG5pbXBvcnQgTmVzdGVkQXR0cmlidXRlT3B0aW9uIGZyb20gJy4vQ29tbW9uL05lc3RlZEF0dHJpYnV0ZU9wdGlvbi5qcyc7XG5pbXBvcnQgSW5wdXRPcHRpb24gZnJvbSAnLi9Db21tb24vSW5wdXRPcHRpb24uanMnO1xuXG5jb25zdCBERUZBVUxUX0NPTk5FQ1RfV0hFTiA9ICdyZXR1cm4gc291cmNlLmxhYmVsID09PSB0YXJnZXQubGFiZWw7JztcblxuY2xhc3MgQ29ubmVjdE9wZXJhdGlvbiBleHRlbmRzIEJhc2VPcGVyYXRpb24ge1xuICBnZXRJbnB1dFNwZWMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLmdldElucHV0U3BlYygpO1xuXG4gICAgLy8gRG8gd2UgY29ubmVjdCBub2RlcyBpbiB0aGUgY3VycmVudCBzZWxlY3Rpb24sIG9yIHRvIHRoZSBub2RlcyBpbnNpZGUgc29tZVxuICAgIC8vIHNldC1saWtlIGNvbnN0cnVjdD9cbiAgICBjb25zdCBjb250ZXh0ID0gbmV3IENvbnRleHR1YWxPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2NvbnRleHQnLFxuICAgICAgY2hvaWNlczogWydXaXRoaW4gU2VsZWN0aW9uJywgJ0JpcGFydGl0ZSddLFxuICAgICAgaGlkZGVuQ2hvaWNlczogWydUYXJnZXQgQ29udGFpbmVyJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG5cbiAgICAvLyBGb3Igc29tZSBjb250ZXh0cywgd2UgbmVlZCB0byBzcGVjaWZ5IHNvdXJjZSBhbmQvb3IgdGFyZ2V0IGRvY3VtZW50cyxcbiAgICAvLyBpdGVtcywgb3Igc2V0cyAoY2xhc3NlcyBvciBncm91cHMpXG4gICAgY29udGV4dC5zcGVjc1snQmlwYXJ0aXRlJ10uYWRkT3B0aW9uKG5ldyBUeXBlZE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnc291cmNlcycsXG4gICAgICB2YWxpZFR5cGVzOiBbXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIsXG4gICAgICAgIFNlbGVjdGlvblxuICAgICAgXVxuICAgIH0pKTtcbiAgICBjb25zdCB0YXJnZXRzID0gbmV3IFR5cGVkT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICd0YXJnZXRzJyxcbiAgICAgIHZhbGlkVHlwZXM6IFtcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcixcbiAgICAgICAgU2VsZWN0aW9uXG4gICAgICBdXG4gICAgfSk7XG4gICAgY29udGV4dC5zcGVjc1snQmlwYXJ0aXRlJ10uYWRkT3B0aW9uKHRhcmdldHMpO1xuICAgIGNvbnRleHQuc3BlY3NbJ1RhcmdldCBDb250YWluZXInXS5hZGRPcHRpb24odGFyZ2V0cyk7XG5cbiAgICAvLyBFZGdlIGRpcmVjdGlvblxuICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnZGlyZWN0ZWQnLFxuICAgICAgY2hvaWNlczogWydVbmRpcmVjdGVkJywgJ0RpcmVjdGVkJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdVbmRpcmVjdGVkJ1xuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihkaXJlY3Rpb24pO1xuICAgIGNvbnRleHQuc3BlY3NbJ1RhcmdldCBDb250YWluZXInXS5hZGRPcHRpb24oZGlyZWN0aW9uKTtcblxuICAgIC8vIEFsbCBjb250ZXh0cyBjYW4gYmUgZXhlY3V0ZWQgYnkgbWF0Y2hpbmcgYXR0cmlidXRlcyBvciBldmFsdWF0aW5nXG4gICAgLy8gYSBmdW5jdGlvblxuICAgIGNvbnN0IG1vZGUgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnbW9kZScsXG4gICAgICBjaG9pY2VzOiBbJ0F0dHJpYnV0ZScsICdGdW5jdGlvbiddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnQXR0cmlidXRlJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24obW9kZSk7XG5cbiAgICAvLyBBdHRyaWJ1dGUgbW9kZSBuZWVkcyBzb3VyY2UgYW5kIHRhcmdldCBhdHRyaWJ1dGVzXG4gICAgbW9kZS5zcGVjc1snQXR0cmlidXRlJ10uYWRkT3B0aW9uKG5ldyBOZXN0ZWRBdHRyaWJ1dGVPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ3NvdXJjZUF0dHJpYnV0ZScsXG4gICAgICBkZWZhdWx0VmFsdWU6IG51bGwsIC8vIG51bGwgaW5kaWNhdGVzIHRoYXQgdGhlIGxhYmVsIHNob3VsZCBiZSB1c2VkXG4gICAgICBnZXRJdGVtQ2hvaWNlUm9sZTogKGl0ZW0sIGlucHV0T3B0aW9ucykgPT4ge1xuICAgICAgICBpZiAoaXRlbS5lcXVhbHMoaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luKSkge1xuICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgICAgICBpZiAoaW5wdXRPcHRpb25zLnNvdXJjZXMgJiYgaXRlbS5lcXVhbHMoaW5wdXRPcHRpb25zLnNvdXJjZXMpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2RlZXAnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy50YXJnZXRzKSkge1xuICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gJ3N0YW5kYXJkJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pKTtcbiAgICBtb2RlLnNwZWNzWydBdHRyaWJ1dGUnXS5hZGRPcHRpb24obmV3IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAndGFyZ2V0QXR0cmlidXRlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCwgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgbGFiZWwgc2hvdWxkIGJlIHVzZWRcbiAgICAgIGdldEl0ZW1DaG9pY2VSb2xlOiAoaXRlbSwgaW5wdXRPcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4pKSB7XG4gICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy50YXJnZXRzKSkge1xuICAgICAgICAgIHJldHVybiAnZGVlcCc7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICAgICAgcmV0dXJuICdpZ25vcmUnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiAnc3RhbmRhcmQnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuXG4gICAgLy8gRnVuY3Rpb24gbW9kZSBuZWVkcyB0aGUgZnVuY3Rpb25cbiAgICBtb2RlLnNwZWNzWydGdW5jdGlvbiddLmFkZE9wdGlvbihuZXcgSW5wdXRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2Nvbm5lY3RXaGVuJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogREVGQVVMVF9DT05ORUNUX1dIRU4sXG4gICAgICBvcGVuRW5kZWQ6IHRydWVcbiAgICB9KSk7XG5cbiAgICAvLyBGaW5hbCBvcHRpb24gYWRkZWQgdG8gYWxsIGNvbnRleHQgLyBtb2Rlczogd2hlcmUgdG8gc3RvcmUgdGhlIGNyZWF0ZWRcbiAgICAvLyBlZGdlcz9cbiAgICByZXN1bHQuYWRkT3B0aW9uKG5ldyBUeXBlZE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnc2F2ZUVkZ2VzSW4nLFxuICAgICAgdmFsaWRUeXBlczogW3RoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyXSxcbiAgICAgIHN1Z2dlc3RPcnBoYW5zOiB0cnVlXG4gICAgfSkpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBjYW5FeGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGFzeW5jIGV4ZWN1dGVPbkluc3RhbmNlIChpdGVtLCBpbnB1dE9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFJ1bm5pbmcgdGhlIENvbm5lY3Qgb3BlcmF0aW9uIG9uIGFuIGluc3RhbmNlIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuaWdub3JlRXJyb3JzICE9PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoIShpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQmlwYXJ0aXRlJykge1xuICAgICAgaWYgKCEoXG4gICAgICAgIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIpICYmXG4gICAgICAgIChpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ1RhcmdldCBDb250YWluZXInKSB7XG4gICAgICBpZiAoIWlucHV0T3B0aW9ucy50YXJnZXRzIHx8ICFpbnB1dE9wdGlvbnMudGFyZ2V0cy5pdGVtcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBsZXQgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICAgIGxldCB0YXJnZXRJdGVtcyA9IGF3YWl0IGlucHV0T3B0aW9ucy50YXJnZXRzLml0ZW1zKCk7XG4gICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhpdGVtcylcbiAgICAgICAgLnNvbWUoaXRlbSA9PiBpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyKSAmJlxuICAgICAgICBPYmplY3QudmFsdWVzKHRhcmdldEl0ZW1zKVxuICAgICAgICAgIC5zb21lKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcik7XG4gICAgfSBlbHNlIHsgLy8gaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgICAgY29uc3QgaXRlbXMgPSBhd2FpdCBzZWxlY3Rpb24uaXRlbXMoKTtcbiAgICAgIGxldCBjb3VudCA9IDA7XG4gICAgICBjb25zdCBhdExlYXN0VHdvTm9kZXMgPSBPYmplY3QudmFsdWVzKGl0ZW1zKS5zb21lKGl0ZW0gPT4ge1xuICAgICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcikge1xuICAgICAgICAgIGNvdW50ICs9IDE7XG4gICAgICAgICAgaWYgKGNvdW50ID49IDIpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIWF0TGVhc3RUd29Ob2Rlcykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ0Z1bmN0aW9uJykge1xuICAgICAgaWYgKHR5cGVvZiBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBGdW5jdGlvbignc291cmNlJywgJ3RhcmdldCcsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuc291cmNlQXR0cmlidXRlICYmIGlucHV0T3B0aW9ucy50YXJnZXRBdHRyaWJ1dGU7XG4gICAgfVxuICB9XG4gIGFzeW5jIGV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24gKGl0ZW1zLCBjb25uZWN0V2hlbiwgc2F2ZUVkZ2VzSW4sIG91dHB1dCkge1xuICAgIC8vIFdlJ3JlIG9ubHkgY3JlYXRpbmcgZWRnZXMgd2l0aGluIHRoZSBzZWxlY3Rpb247IHdlIGRvbid0IGhhdmUgdG8gd29ycnlcbiAgICAvLyBhYm91dCBkaXJlY3Rpb24gb3IgdGhlIG90aGVyIHNldCBvZiBub2RlcywgYnV0IHdlIGRvIG5lZWQgdG8gaXRlcmF0ZSBpblxuICAgIC8vIGEgd2F5IHRoYXQgZ3VhcmFudGVlcyB0aGF0IHdlIGRvbid0IGR1cGxpY2F0ZSBlZGdlc1xuICAgIGNvbnN0IHNvdXJjZUxpc3QgPSBPYmplY3QudmFsdWVzKGl0ZW1zKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNvdXJjZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHNvdXJjZUxpc3QubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKGNvbm5lY3RXaGVuKHNvdXJjZUxpc3RbaV0sIHNvdXJjZUxpc3Rbal0pKSB7XG4gICAgICAgICAgY29uc3QgbmV3RWRnZSA9IHNvdXJjZUxpc3RbaV0uY29ubmVjdFRvKHNvdXJjZUxpc3Rbal0sIHNhdmVFZGdlc0luKTtcbiAgICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtuZXdFZGdlLnVuaXF1ZVNlbGVjdG9yXSk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhzb3VyY2VMaXN0W2ldLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhzb3VyY2VMaXN0W2pdLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhuZXdFZGdlLmRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3Qgb3V0cHV0ID0gbmV3IE91dHB1dFNwZWMoKTtcblxuICAgIC8vIE1ha2Ugc3VyZSB3ZSBoYXZlIGEgcGxhY2UgdG8gc2F2ZSB0aGUgZWRnZXNcbiAgICBpZiAoIShpbnB1dE9wdGlvbnMuc2F2ZUVkZ2VzSW4gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikpIHtcbiAgICAgIG91dHB1dC53YXJuKGBzYXZlRWRnZXNJbiBpcyBub3QgYW4gSXRlbWApO1xuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICAvLyBGaWd1cmUgb3V0IHRoZSBjcml0ZXJpYSBmb3IgbWF0Y2hpbmcgbm9kZXNcbiAgICBsZXQgY29ubmVjdFdoZW47XG4gICAgaWYgKGlucHV0T3B0aW9ucy5tb2RlID09PSAnRnVuY3Rpb24nKSB7XG4gICAgICBjb25uZWN0V2hlbiA9IGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbjtcbiAgICAgIGlmICh0eXBlb2YgY29ubmVjdFdoZW4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25uZWN0V2hlbiA9IG5ldyBGdW5jdGlvbignc291cmNlJywgJ3RhcmdldCcsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICAgIGlucHV0T3B0aW9ucy5jb25uZWN0V2hlbiB8fCBERUZBVUxUX0NPTk5FQ1RfV0hFTik7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgICAgICAgb3V0cHV0Lndhcm4oYGNvbm5lY3RXaGVuIFN5bnRheEVycm9yOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIGlmIChpbnB1dE9wdGlvbnMubW9kZSA9PT0gJ0F0dHJpYnV0ZScpXG4gICAgICBjb25zdCBnZXRTb3VyY2VWYWx1ZSA9IGlucHV0T3B0aW9ucy5zb3VyY2VBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyBzb3VyY2UgPT4gc291cmNlLmxhYmVsXG4gICAgICAgIDogc291cmNlID0+IHNvdXJjZS52YWx1ZVtpbnB1dE9wdGlvbnMuc291cmNlQXR0cmlidXRlXTtcbiAgICAgIGNvbnN0IGdldFRhcmdldFZhbHVlID0gaW5wdXRPcHRpb25zLnRhcmdldEF0dHJpYnV0ZSA9PT0gbnVsbFxuICAgICAgICA/IHRhcmdldCA9PiB0YXJnZXQubGFiZWxcbiAgICAgICAgOiB0YXJnZXQgPT4gdGFyZ2V0LnZhbHVlW2lucHV0T3B0aW9ucy50YXJnZXRBdHRyaWJ1dGVdO1xuICAgICAgY29ubmVjdFdoZW4gPSAoc291cmNlLCB0YXJnZXQpID0+IGdldFNvdXJjZVZhbHVlKHNvdXJjZSkgPT09IGdldFRhcmdldFZhbHVlKHRhcmdldCk7XG4gICAgfVxuXG4gICAgbGV0IHNvdXJjZXM7XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnQmlwYXJ0aXRlJykge1xuICAgICAgaWYgKGlucHV0T3B0aW9ucy5zb3VyY2VzIGluc3RhbmNlb2YgU2VsZWN0aW9uKSB7XG4gICAgICAgIHNvdXJjZXMgPSBhd2FpdCBpbnB1dE9wdGlvbnMuc291cmNlcy5pdGVtcygpO1xuICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyIHx8XG4gICAgICAgICAgaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcikge1xuICAgICAgICBzb3VyY2VzID0gYXdhaXQgaW5wdXRPcHRpb25zLnNvdXJjZXMuZ2V0TWVtYmVycygpO1xuICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuc291cmNlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgICAgaW5wdXRPcHRpb25zLnNvdXJjZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikge1xuICAgICAgICBzb3VyY2VzID0gaW5wdXRPcHRpb25zLnNvdXJjZXMuZ2V0Q29udGVudHMoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC53YXJuKGBpbnB1dE9wdGlvbnMuc291cmNlcyBpcyBvZiB1bmV4cGVjdGVkIHR5cGUgJHtpbnB1dE9wdGlvbnMuc291cmNlcyAmJiBpbnB1dE9wdGlvbnMuc291cmNlcy50eXBlfWApO1xuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzb3VyY2VzID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc291cmNlTGlzdCA9IE9iamVjdC52YWx1ZXMoc291cmNlcyk7XG4gICAgaWYgKHNvdXJjZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBvdXRwdXQud2FybihgTm8gc291cmNlcyBzdXBwbGllZCB0byBjb25uZWN0IG9wZXJhdGlvbmApO1xuICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlIGtub3cgZW5vdWdoIHRvIGRlYWwgd2l0aCAnV2l0aGluIFNlbGVjdGlvbicgbW9kZTpcbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdXaXRoaW4gU2VsZWN0aW9uJykge1xuICAgICAgcmV0dXJuIHRoaXMuZXhlY3V0ZVdpdGhpblNlbGVjdGlvbihzb3VyY2VzLCBjb25uZWN0V2hlbiwgaW5wdXRPcHRpb25zLnNhdmVFZGdlc0luLCBvdXRwdXQpO1xuICAgIH1cblxuICAgIC8vIFdoYXQgcm9sZSBhcmUgdGhlIHNvdXJjZSBub2RlcyBwbGF5aW5nICgndW5kaXJlY3RlZCcgdnMgJ3NvdXJjZScpP1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IGlucHV0T3B0aW9ucy5kaXJlY3RlZCA9PT0gJ0RpcmVjdGVkJyA/ICdzb3VyY2UnIDogJ3VuZGlyZWN0ZWQnO1xuXG4gICAgbGV0IHRhcmdldHM7XG4gICAgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgU2VsZWN0aW9uKSB7XG4gICAgICB0YXJnZXRzID0gYXdhaXQgaW5wdXRPcHRpb25zLnRhcmdldHMuaXRlbXMoKTtcbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGlucHV0T3B0aW9ucy50YXJnZXRzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIpIHtcbiAgICAgIHRhcmdldHMgPSBhd2FpdCBpbnB1dE9wdGlvbnMudGFyZ2V0cy5nZXRNZW1iZXJzKCk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICAgICAgICBpbnB1dE9wdGlvbnMudGFyZ2V0cyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIpIHtcbiAgICAgIHRhcmdldHMgPSBpbnB1dE9wdGlvbnMudGFyZ2V0cy5nZXRDb250ZW50cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXRwdXQud2FybihgaW5wdXRPcHRpb25zLnRhcmdldHMgaXMgb2YgdW5leHBlY3RlZCB0eXBlICR7aW5wdXRPcHRpb25zLnRhcmdldHMgJiYgaW5wdXRPcHRpb25zLnRhcmdldHMudHlwZX1gKTtcbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0TGlzdCA9IE9iamVjdC52YWx1ZXModGFyZ2V0cyk7XG4gICAgaWYgKHRhcmdldExpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBvdXRwdXQud2FybignTm8gdGFyZ2V0cyBzdXBwbGllZCB0byBjb25uZWN0IG9wZXJhdGlvbicpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgZWRnZXMhXG4gICAgc291cmNlTGlzdC5mb3JFYWNoKHNvdXJjZSA9PiB7XG4gICAgICB0YXJnZXRMaXN0LmZvckVhY2godGFyZ2V0ID0+IHtcbiAgICAgICAgaWYgKHNvdXJjZSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJlxuICAgICAgICAgICAgdGFyZ2V0IGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyICYmXG4gICAgICAgICAgICBjb25uZWN0V2hlbihzb3VyY2UsIHRhcmdldCkpIHtcbiAgICAgICAgICBjb25zdCBuZXdFZGdlID0gc291cmNlLmNvbm5lY3RUbyh0YXJnZXQsIGlucHV0T3B0aW9ucy5zYXZlRWRnZXNJbiwgZGlyZWN0aW9uKTtcbiAgICAgICAgICBvdXRwdXQuYWRkU2VsZWN0b3JzKFtuZXdFZGdlLnVuaXF1ZVNlbGVjdG9yXSk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhzb3VyY2UuZG9jKTtcbiAgICAgICAgICBvdXRwdXQuZmxhZ1BvbGx1dGVkRG9jKHRhcmdldC5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MobmV3RWRnZS5kb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RPcGVyYXRpb247XG4iLCJpbXBvcnQgU2VsZWN0aW9uIGZyb20gJy4uL1NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgQmFzZU9wZXJhdGlvbiBmcm9tICcuL0NvbW1vbi9CYXNlT3BlcmF0aW9uLmpzJztcbmltcG9ydCBPdXRwdXRTcGVjIGZyb20gJy4vQ29tbW9uL091dHB1dFNwZWMuanMnO1xuaW1wb3J0IENvbnRleHR1YWxPcHRpb24gZnJvbSAnLi9Db21tb24vQ29udGV4dHVhbE9wdGlvbi5qcyc7XG5pbXBvcnQgVHlwZWRPcHRpb24gZnJvbSAnLi9Db21tb24vVHlwZWRPcHRpb24uanMnO1xuaW1wb3J0IE5lc3RlZEF0dHJpYnV0ZU9wdGlvbiBmcm9tICcuL0NvbW1vbi9OZXN0ZWRBdHRyaWJ1dGVPcHRpb24uanMnO1xuaW1wb3J0IElucHV0T3B0aW9uIGZyb20gJy4vQ29tbW9uL0lucHV0T3B0aW9uLmpzJztcblxuY29uc3QgREVGQVVMVF9DT05ORUNUX1dIRU4gPSAncmV0dXJuIGVkZ2UubGFiZWwgPT09IG5vZGUubGFiZWw7JztcblxuY2xhc3MgQXR0YWNoT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG5cbiAgICAvLyBEbyB3ZSBjb25uZWN0IG5vZGVzIGluIHRoZSBjdXJyZW50IHNlbGVjdGlvbiwgb3IgdG8gdGhlIG5vZGVzIGluc2lkZSBzb21lXG4gICAgLy8gc2V0LWxpa2UgY29uc3RydWN0P1xuICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgQ29udGV4dHVhbE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29udGV4dCcsXG4gICAgICBjaG9pY2VzOiBbJ1dpdGhpbiBTZWxlY3Rpb24nLCAnQmlwYXJ0aXRlJ10sXG4gICAgICBoaWRkZW5DaG9pY2VzOiBbJ1RhcmdldCBDb250YWluZXInXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ1dpdGhpbiBTZWxlY3Rpb24nXG4gICAgfSk7XG4gICAgcmVzdWx0LmFkZE9wdGlvbihjb250ZXh0KTtcblxuICAgIC8vIEZvciBzb21lIGNvbnRleHRzLCB3ZSBuZWVkIHRvIHNwZWNpZnkgZWRnZSBhbmQvb3Igbm9kZSBkb2N1bWVudHMsXG4gICAgLy8gaXRlbXMsIG9yIHNldHMgKGNsYXNzZXMgb3IgZ3JvdXBzKVxuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihuZXcgVHlwZWRPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ2VkZ2VzJyxcbiAgICAgIHZhbGlkVHlwZXM6IFtcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5TZXRXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcixcbiAgICAgICAgU2VsZWN0aW9uXG4gICAgICBdXG4gICAgfSkpO1xuICAgIGNvbnN0IG5vZGVzID0gbmV3IFR5cGVkT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdub2RlcycsXG4gICAgICB2YWxpZFR5cGVzOiBbXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIsXG4gICAgICAgIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyLFxuICAgICAgICB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcixcbiAgICAgICAgdGhpcy5tdXJlLldSQVBQRVJTLlN1cGVybm9kZVdyYXBwZXIsXG4gICAgICAgIFNlbGVjdGlvblxuICAgICAgXVxuICAgIH0pO1xuICAgIGNvbnRleHQuc3BlY3NbJ0JpcGFydGl0ZSddLmFkZE9wdGlvbihub2Rlcyk7XG4gICAgY29udGV4dC5zcGVjc1snVGFyZ2V0IENvbnRhaW5lciddLmFkZE9wdGlvbihub2Rlcyk7XG5cbiAgICAvLyBFZGdlIGRpcmVjdGlvblxuICAgIHJlc3VsdC5hZGRPcHRpb24obmV3IElucHV0T3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdkaXJlY3Rpb24nLFxuICAgICAgY2hvaWNlczogWyd1bmRpcmVjdGVkJywgJ3NvdXJjZScsICd0YXJnZXQnXSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ3VuZGlyZWN0ZWQnXG4gICAgfSkpO1xuXG4gICAgLy8gQWxsIGNvbnRleHRzIGNhbiBiZSBleGVjdXRlZCBieSBtYXRjaGluZyBhdHRyaWJ1dGVzIG9yIGV2YWx1YXRpbmdcbiAgICAvLyBhIGZ1bmN0aW9uXG4gICAgY29uc3QgbW9kZSA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdtb2RlJyxcbiAgICAgIGNob2ljZXM6IFsnQXR0cmlidXRlJywgJ0Z1bmN0aW9uJ10sXG4gICAgICBkZWZhdWx0VmFsdWU6ICdBdHRyaWJ1dGUnXG4gICAgfSk7XG4gICAgcmVzdWx0LmFkZE9wdGlvbihtb2RlKTtcblxuICAgIC8vIEF0dHJpYnV0ZSBtb2RlIG5lZWRzIGVkZ2UgYW5kIG5vZGUgYXR0cmlidXRlc1xuICAgIG1vZGUuc3BlY3NbJ0F0dHJpYnV0ZSddLmFkZE9wdGlvbihuZXcgTmVzdGVkQXR0cmlidXRlT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdlZGdlQXR0cmlidXRlJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogbnVsbCwgLy8gbnVsbCBpbmRpY2F0ZXMgdGhhdCB0aGUgbGFiZWwgc2hvdWxkIGJlIHVzZWRcbiAgICAgIGdldEl0ZW1DaG9pY2VSb2xlOiAoaXRlbSwgaW5wdXRPcHRpb25zKSA9PiB7XG4gICAgICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgICAgICBpZiAoaW5wdXRPcHRpb25zLmVkZ2VzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy5lZGdlcykpIHtcbiAgICAgICAgICAgIHJldHVybiAnZGVlcCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAnaWdub3JlJztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLm5vZGVzICYmIGl0ZW0uZXF1YWxzKGlucHV0T3B0aW9ucy5ub2RlcykpIHtcbiAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICdzdGFuZGFyZCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG4gICAgbW9kZS5zcGVjc1snQXR0cmlidXRlJ10uYWRkT3B0aW9uKG5ldyBOZXN0ZWRBdHRyaWJ1dGVPcHRpb24oe1xuICAgICAgcGFyYW1ldGVyTmFtZTogJ25vZGVBdHRyaWJ1dGUnLFxuICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLCAvLyBudWxsIGluZGljYXRlcyB0aGF0IHRoZSBsYWJlbCBzaG91bGQgYmUgdXNlZFxuICAgICAgZ2V0SXRlbUNob2ljZVJvbGU6IChpdGVtLCBpbnB1dE9wdGlvbnMpID0+IHtcbiAgICAgICAgaWYgKGlucHV0T3B0aW9ucy5ub2RlcyAmJiBpdGVtLmVxdWFscyhpbnB1dE9wdGlvbnMubm9kZXMpKSB7XG4gICAgICAgICAgcmV0dXJuICdkZWVwJztcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgICAgICByZXR1cm4gJ2lnbm9yZSc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuICdzdGFuZGFyZCc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSk7XG5cbiAgICAvLyBGdW5jdGlvbiBtb2RlIG5lZWRzIHRoZSBmdW5jdGlvblxuICAgIG1vZGUuc3BlY3NbJ0Z1bmN0aW9uJ10uYWRkT3B0aW9uKG5ldyBJbnB1dE9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY29ubmVjdFdoZW4nLFxuICAgICAgZGVmYXVsdFZhbHVlOiBERUZBVUxUX0NPTk5FQ1RfV0hFTixcbiAgICAgIG9wZW5FbmRlZDogdHJ1ZVxuICAgIH0pKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBhc3luYyBleGVjdXRlT25JbnN0YW5jZSAoaXRlbSwgaW5wdXRPcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBSdW5uaW5nIHRoZSBBdHRhY2ggb3BlcmF0aW9uIG9uIGFuIGluc3RhbmNlIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uU2VsZWN0aW9uIChzZWxlY3Rpb24sIGlucHV0T3B0aW9ucykge1xuICAgIGlmIChpbnB1dE9wdGlvbnMuaWdub3JlRXJyb3JzICE9PSAnU3RvcCBvbiBFcnJvcicpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdCaXBhcnRpdGUnKSB7XG4gICAgICBpZiAoIShcbiAgICAgICAgKGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcikgJiZcbiAgICAgICAgKGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIgfHxcbiAgICAgICAgIGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Db250YWluZXJXcmFwcGVyIHx8XG4gICAgICAgICBpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlcikpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnVGFyZ2V0IENvbnRhaW5lcicpIHtcbiAgICAgIGlmICghaW5wdXRPcHRpb25zLm5vZGVzIHx8ICFpbnB1dE9wdGlvbnMubm9kZXMuaXRlbXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgbGV0IGVkZ2VJdGVtcyA9IGF3YWl0IHNlbGVjdGlvbi5pdGVtcygpO1xuICAgICAgbGV0IG5vZGVJdGVtcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5ub2Rlcy5pdGVtcygpO1xuICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoZWRnZUl0ZW1zKVxuICAgICAgICAuc29tZShpdGVtID0+IGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIpICYmXG4gICAgICAgIE9iamVjdC52YWx1ZXMobm9kZUl0ZW1zKVxuICAgICAgICAgIC5zb21lKGl0ZW0gPT4gaXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcik7XG4gICAgfSBlbHNlIHsgLy8gaW5wdXRPcHRpb25zLmNvbnRleHQgPT09ICdXaXRoaW4gU2VsZWN0aW9uJ1xuICAgICAgY29uc3QgZWRnZUl0ZW1zID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgICBsZXQgb25lTm9kZSA9IGZhbHNlO1xuICAgICAgbGV0IG9uZUVkZ2UgPSBmYWxzZTtcbiAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKGVkZ2VJdGVtcykuc29tZShpdGVtID0+IHtcbiAgICAgICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuTm9kZVdyYXBwZXIpIHtcbiAgICAgICAgICBvbmVOb2RlID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyKSB7XG4gICAgICAgICAgb25lRWRnZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9uZU5vZGUgJiYgb25lRWRnZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGlmICh0eXBlb2YgaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgRnVuY3Rpb24oJ2VkZ2UnLCAnbm9kZScsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpbnB1dE9wdGlvbnMuZWRnZUF0dHJpYnV0ZSAmJiBpbnB1dE9wdGlvbnMubm9kZUF0dHJpYnV0ZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZVdpdGhpblNlbGVjdGlvbiAoaXRlbXMsIGNvbm5lY3RXaGVuLCBkaXJlY3Rpb24sIG91dHB1dCkge1xuICAgIC8vIFdpdGhpbiB0aGUgc2VsZWN0aW9uLCB3ZSBvbmx5IGtub3cgd2hpY2ggb25lcyBhcmUgZWRnZXMgYW5kIHdoaWNoIG9uZXNcbiAgICAvLyBhcmUgbm9kZXMgb24gdGhlIGZseVxuICAgIGNvbnN0IGl0ZW1MaXN0ID0gT2JqZWN0LnZhbHVlcyhpdGVtcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpdGVtTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgaXRlbUxpc3QubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgbGV0IGVkZ2UgPVxuICAgICAgICAgIChpdGVtTGlzdFtpXSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlciAmJiBpdGVtTGlzdFtpXSkgfHxcbiAgICAgICAgICAoaXRlbUxpc3Rbal0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXIgJiYgaXRlbUxpc3Rbal0pO1xuICAgICAgICBsZXQgbm9kZSA9XG4gICAgICAgICAgKGl0ZW1MaXN0W2ldIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyICYmIGl0ZW1MaXN0W2ldKSB8fFxuICAgICAgICAgIChpdGVtTGlzdFtqXSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJiBpdGVtTGlzdFtqXSk7XG4gICAgICAgIGlmIChlZGdlICYmIG5vZGUgJiYgY29ubmVjdFdoZW4oZWRnZSwgbm9kZSkpIHtcbiAgICAgICAgICBlZGdlLmF0dGFjaFRvKG5vZGUsIGRpcmVjdGlvbik7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhlZGdlLmRvYyk7XG4gICAgICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhub2RlLmRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dHB1dDtcbiAgfVxuICBhc3luYyBleGVjdXRlT25TZWxlY3Rpb24gKHNlbGVjdGlvbiwgaW5wdXRPcHRpb25zKSB7XG4gICAgY29uc3Qgb3V0cHV0ID0gbmV3IE91dHB1dFNwZWMoKTtcblxuICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGNyaXRlcmlhIGZvciBtYXRjaGluZyBub2Rlc1xuICAgIGxldCBjb25uZWN0V2hlbjtcbiAgICBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdGdW5jdGlvbicpIHtcbiAgICAgIGNvbm5lY3RXaGVuID0gaW5wdXRPcHRpb25zLmNvbm5lY3RXaGVuO1xuICAgICAgaWYgKHR5cGVvZiBjb25uZWN0V2hlbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbm5lY3RXaGVuID0gbmV3IEZ1bmN0aW9uKCdlZGdlJywgJ25vZGUnLCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgICBpbnB1dE9wdGlvbnMuY29ubmVjdFdoZW4gfHwgREVGQVVMVF9DT05ORUNUX1dIRU4pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpIHtcbiAgICAgICAgICAgIG91dHB1dC53YXJuKGBjb25uZWN0V2hlbiBTeW50YXhFcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgeyAvLyBpZiAoaW5wdXRPcHRpb25zLm1vZGUgPT09ICdBdHRyaWJ1dGUnKVxuICAgICAgY29uc3QgZ2V0RWRnZVZhbHVlID0gaW5wdXRPcHRpb25zLmVkZ2VBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyBlZGdlID0+IGVkZ2UubGFiZWxcbiAgICAgICAgOiBlZGdlID0+IGVkZ2UudmFsdWVbaW5wdXRPcHRpb25zLmVkZ2VBdHRyaWJ1dGVdO1xuICAgICAgY29uc3QgZ2V0Tm9kZVZhbHVlID0gaW5wdXRPcHRpb25zLm5vZGVBdHRyaWJ1dGUgPT09IG51bGxcbiAgICAgICAgPyBub2RlID0+IG5vZGUubGFiZWxcbiAgICAgICAgOiBub2RlID0+IG5vZGUudmFsdWVbaW5wdXRPcHRpb25zLm5vZGVBdHRyaWJ1dGVdO1xuICAgICAgY29ubmVjdFdoZW4gPSAoZWRnZSwgbm9kZSkgPT4gZ2V0RWRnZVZhbHVlKGVkZ2UpID09PSBnZXROb2RlVmFsdWUobm9kZSk7XG4gICAgfVxuXG4gICAgbGV0IGVkZ2VzO1xuICAgIGlmIChpbnB1dE9wdGlvbnMuY29udGV4dCA9PT0gJ0JpcGFydGl0ZScpIHtcbiAgICAgIGlmIChpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuU2V0V3JhcHBlciB8fFxuICAgICAgICAgIGlucHV0T3B0aW9ucy5lZGdlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyKSB7XG4gICAgICAgIGVkZ2VzID0gYXdhaXQgaW5wdXRPcHRpb25zLmVkZ2VzLmdldE1lbWJlcnMoKTtcbiAgICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLmVkZ2VzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlciB8fFxuICAgICAgICAgICAgICAgICBpbnB1dE9wdGlvbnMuZWRnZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlcikge1xuICAgICAgICBlZGdlcyA9IGlucHV0T3B0aW9ucy5lZGdlcy5nZXRDb250ZW50cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYGlucHV0T3B0aW9ucy5lZGdlcyBpcyBvZiB1bmV4cGVjdGVkIHR5cGUgJHtpbnB1dE9wdGlvbnMuZWRnZXMgJiYgaW5wdXRPcHRpb25zLmVkZ2VzLnR5cGV9YCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVkZ2VzID0gYXdhaXQgc2VsZWN0aW9uLml0ZW1zKCk7XG4gICAgfVxuXG4gICAgbGV0IGVkZ2VMaXN0ID0gT2JqZWN0LnZhbHVlcyhlZGdlcyk7XG4gICAgaWYgKGVkZ2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgb3V0cHV0Lndhcm4oYE5vIGVkZ2VzIHN1cHBsaWVkIHRvIGF0dGFjaCBvcGVyYXRpb25gKTtcbiAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSBrbm93IGVub3VnaCB0byBkZWFsIHdpdGggJ1dpdGhpbiBTZWxlY3Rpb24nIG1vZGU6XG4gICAgaWYgKGlucHV0T3B0aW9ucy5jb250ZXh0ID09PSAnV2l0aGluIFNlbGVjdGlvbicpIHtcbiAgICAgIHJldHVybiB0aGlzLmV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24oZWRnZXMsIGNvbm5lY3RXaGVuLCBpbnB1dE9wdGlvbnMuZGlyZWN0aW9uLCBvdXRwdXQpO1xuICAgIH1cblxuICAgIGxldCBub2RlcztcbiAgICBpZiAoaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgU2VsZWN0aW9uKSB7XG4gICAgICBub2RlcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5ub2Rlcy5pdGVtcygpO1xuICAgIH0gZWxzZSBpZiAoaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLlNldFdyYXBwZXIgfHxcbiAgICAgICAgICAgICAgIGlucHV0T3B0aW9ucy5ub2RlcyBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5TdXBlcm5vZGVXcmFwcGVyKSB7XG4gICAgICBub2RlcyA9IGF3YWl0IGlucHV0T3B0aW9ucy5ub2Rlcy5nZXRNZW1iZXJzKCk7XG4gICAgfSBlbHNlIGlmIChpbnB1dE9wdGlvbnMubm9kZXMgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuQ29udGFpbmVyV3JhcHBlciB8fFxuICAgICAgICAgICAgICAgaW5wdXRPcHRpb25zLm5vZGVzIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcikge1xuICAgICAgbm9kZXMgPSBpbnB1dE9wdGlvbnMubm9kZXMuZ2V0Q29udGVudHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0Lndhcm4oYGlucHV0T3B0aW9ucy5ub2RlcyBpcyBvZiB1bmV4cGVjdGVkIHR5cGUgJHtpbnB1dE9wdGlvbnMubm9kZXMgJiYgaW5wdXRPcHRpb25zLm5vZGVzLnR5cGV9YCk7XG4gICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVMaXN0ID0gT2JqZWN0LnZhbHVlcyhub2Rlcyk7XG4gICAgaWYgKG5vZGVMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgb3V0cHV0Lndhcm4oJ05vIG5vZGVzIHN1cHBsaWVkIHRvIGF0dGFjaCBvcGVyYXRpb24nKTtcbiAgICB9XG5cbiAgICAvLyBBdHRhY2ggdGhlIGVkZ2VzIVxuICAgIGVkZ2VMaXN0LmZvckVhY2goZWRnZSA9PiB7XG4gICAgICBub2RlTGlzdC5mb3JFYWNoKG5vZGUgPT4ge1xuICAgICAgICBpZiAoZWRnZSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlciAmJlxuICAgICAgICAgICAgbm9kZSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlciAmJlxuICAgICAgICAgICAgY29ubmVjdFdoZW4oZWRnZSwgbm9kZSkpIHtcbiAgICAgICAgICBlZGdlLmF0dGFjaFRvKG5vZGUsIGlucHV0T3B0aW9ucy5kaXJlY3Rpb24pO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2MoZWRnZS5kb2MpO1xuICAgICAgICAgIG91dHB1dC5mbGFnUG9sbHV0ZWREb2Mobm9kZS5kb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dGFjaE9wZXJhdGlvbjtcbiIsImltcG9ydCBCYXNlT3BlcmF0aW9uIGZyb20gJy4vQ29tbW9uL0Jhc2VPcGVyYXRpb24uanMnO1xuaW1wb3J0IE91dHB1dFNwZWMgZnJvbSAnLi9Db21tb24vT3V0cHV0U3BlYy5qcyc7XG5pbXBvcnQgQ29udGV4dHVhbE9wdGlvbiBmcm9tICcuL0NvbW1vbi9Db250ZXh0dWFsT3B0aW9uLmpzJztcbmltcG9ydCBBdHRyaWJ1dGVPcHRpb24gZnJvbSAnLi9Db21tb24vQXR0cmlidXRlT3B0aW9uLmpzJztcbmltcG9ydCBDbGFzc09wdGlvbiBmcm9tICcuL0NvbW1vbi9DbGFzc09wdGlvbi5qcyc7XG5cbmNsYXNzIEFzc2lnbkNsYXNzT3BlcmF0aW9uIGV4dGVuZHMgQmFzZU9wZXJhdGlvbiB7XG4gIGdldElucHV0U3BlYyAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuZ2V0SW5wdXRTcGVjKCk7XG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBDb250ZXh0dWFsT3B0aW9uKHtcbiAgICAgIHBhcmFtZXRlck5hbWU6ICdjb250ZXh0JyxcbiAgICAgIGNob2ljZXM6IFsnU3RyaW5nJywgJ0F0dHJpYnV0ZSddLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnU3RyaW5nJ1xuICAgIH0pO1xuICAgIHJlc3VsdC5hZGRPcHRpb24oY29udGV4dCk7XG4gICAgY29udGV4dC5zcGVjc1snU3RyaW5nJ10uYWRkT3B0aW9uKG5ldyBDbGFzc09wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnY2xhc3NOYW1lJyxcbiAgICAgIG9wZW5FbmRlZDogdHJ1ZVxuICAgIH0pKTtcbiAgICBjb250ZXh0LnNwZWNzWydBdHRyaWJ1dGUnXS5hZGRPcHRpb24obmV3IEF0dHJpYnV0ZU9wdGlvbih7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiAnYXR0cmlidXRlJ1xuICAgIH0pKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgcG90ZW50aWFsbHlFeGVjdXRhYmxlT25JdGVtIChpdGVtKSB7XG4gICAgcmV0dXJuIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gIH1cbiAgYXN5bmMgY2FuRXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIHJldHVybiAoYXdhaXQgc3VwZXIuY2FuRXhlY3V0ZU9uSW5zdGFuY2UoaXRlbSwgaW5wdXRPcHRpb25zKSkgfHxcbiAgICAgIGl0ZW0gaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gIH1cbiAgYXN5bmMgZXhlY3V0ZU9uSW5zdGFuY2UgKGl0ZW0sIGlucHV0T3B0aW9ucykge1xuICAgIGNvbnN0IG91dHB1dCA9IG5ldyBPdXRwdXRTcGVjKCk7XG4gICAgbGV0IGNsYXNzTmFtZSA9IGlucHV0T3B0aW9ucy5jbGFzc05hbWU7XG4gICAgaWYgKCFpbnB1dE9wdGlvbnMuY2xhc3NOYW1lKSB7XG4gICAgICBpZiAoIWlucHV0T3B0aW9ucy5hdHRyaWJ1dGUpIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYE5vIGNsYXNzTmFtZSBvciBhdHRyaWJ1dGUgb3B0aW9uIHN1cHBsaWVkYCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgICBpZiAoaXRlbS5nZXRWYWx1ZSkge1xuICAgICAgICBjbGFzc05hbWUgPSBhd2FpdCBpdGVtLmdldFZhbHVlKGlucHV0T3B0aW9ucy5hdHRyaWJ1dGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0Lndhcm4oYENhbid0IGdldCBhdHRyaWJ1dGVzIGZyb20gJHtpdGVtLnR5cGV9IGluc3RhbmNlYCk7XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICB9XG4gICAgICBpZiAoIWNsYXNzTmFtZSkge1xuICAgICAgICBvdXRwdXQud2FybihgJHtpdGVtLnR5cGV9IGluc3RhbmNlIG1pc3NpbmcgYXR0cmlidXRlICR7aW5wdXRPcHRpb25zLmF0dHJpYnV0ZX1gKTtcbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFpdGVtLmFkZENsYXNzKSB7XG4gICAgICBvdXRwdXQud2FybihgQ2FuJ3QgYXNzaWduIGNsYXNzIHRvIG5vbi10YWdnYWJsZSAke2l0ZW0udHlwZX1gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXRlbS5hZGRDbGFzcyhjbGFzc05hbWUpO1xuICAgICAgb3V0cHV0LmZsYWdQb2xsdXRlZERvYyhpdGVtLmRvYyk7XG4gICAgfVxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXNzaWduQ2xhc3NPcGVyYXRpb247XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBqc29uUGF0aCBmcm9tICdqc29ucGF0aCc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJ3VraSc7XG5pbXBvcnQgU2VsZWN0aW9uIGZyb20gJy4vU2VsZWN0aW9uLmpzJztcblxuaW1wb3J0IFJvb3RXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvUm9vdFdyYXBwZXIuanMnO1xuaW1wb3J0IERvY3VtZW50V3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL0RvY3VtZW50V3JhcHBlci5qcyc7XG5pbXBvcnQgUHJpbWl0aXZlV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1ByaW1pdGl2ZVdyYXBwZXIuanMnO1xuaW1wb3J0IEludmFsaWRXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvSW52YWxpZFdyYXBwZXIuanMnO1xuaW1wb3J0IE51bGxXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvTnVsbFdyYXBwZXIuanMnO1xuaW1wb3J0IEJvb2xlYW5XcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvQm9vbGVhbldyYXBwZXIuanMnO1xuaW1wb3J0IE51bWJlcldyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9OdW1iZXJXcmFwcGVyLmpzJztcbmltcG9ydCBTdHJpbmdXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvU3RyaW5nV3JhcHBlci5qcyc7XG5pbXBvcnQgRGF0ZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9EYXRlV3JhcHBlci5qcyc7XG5pbXBvcnQgUmVmZXJlbmNlV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1JlZmVyZW5jZVdyYXBwZXIuanMnO1xuaW1wb3J0IENvbnRhaW5lcldyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9Db250YWluZXJXcmFwcGVyLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcbmltcG9ydCBTZXRXcmFwcGVyIGZyb20gJy4vV3JhcHBlcnMvU2V0V3JhcHBlci5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5pbXBvcnQgU3VwZXJub2RlV3JhcHBlciBmcm9tICcuL1dyYXBwZXJzL1N1cGVybm9kZVdyYXBwZXIuanMnO1xuXG5pbXBvcnQgU2VsZWN0QWxsT3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9TZWxlY3RBbGxPcGVyYXRpb24uanMnO1xuaW1wb3J0IEZpbHRlck9wZXJhdGlvbiBmcm9tICcuL09wZXJhdGlvbnMvRmlsdGVyT3BlcmF0aW9uLmpzJztcbmltcG9ydCBDb252ZXJ0T3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9Db252ZXJ0T3BlcmF0aW9uLmpzJztcbmltcG9ydCBDb25uZWN0T3BlcmF0aW9uIGZyb20gJy4vT3BlcmF0aW9ucy9Db25uZWN0T3BlcmF0aW9uLmpzJztcbmltcG9ydCBBdHRhY2hPcGVyYXRpb24gZnJvbSAnLi9PcGVyYXRpb25zL0F0dGFjaE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgQXNzaWduQ2xhc3NPcGVyYXRpb24gZnJvbSAnLi9PcGVyYXRpb25zL0Fzc2lnbkNsYXNzT3BlcmF0aW9uLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIE1vZGVsIHtcbiAgY29uc3RydWN0b3IgKFBvdWNoREIsIGQzLCBkM24pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuUG91Y2hEQiA9IFBvdWNoREI7IC8vIGNvdWxkIGJlIHBvdWNoZGItbm9kZSBvciBwb3VjaGRiLWJyb3dzZXJcbiAgICB0aGlzLmQzID0gZDM7IC8vIGZvciBOb2RlLmpzLCB0aGlzIHdpbGwgYmUgZnJvbSBkMy1ub2RlLCBub3QgdGhlIHJlZ3VsYXIgb25lXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgaWYgKGQzbikge1xuICAgICAgLy8gdG8gcnVuIHRlc3RzLCB3ZSBhbHNvIG5lZWQgYWNjZXNzIHRvIHRoZSBkMy1ub2RlIHdyYXBwZXIgKHdlIGRvbid0XG4gICAgICAvLyBpbXBvcnQgaXQgZGlyZWN0bHkgaW50byB0aGUgdGVzdHMgdG8gbWFrZSBzdXJlIHRoYXQgdGhlIG5hbWVzcGFjZVxuICAgICAgLy8gYWRkaXRpb24gYmVsb3cgd29ya3MpXG4gICAgICB0aGlzLmQzbiA9IGQzbjtcbiAgICAgIHRoaXMud2luZG93ID0gdGhpcy5kM24ud2luZG93O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLndpbmRvdyA9IHdpbmRvdztcbiAgICB9XG5cbiAgICAvLyBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3Igb3VyIGN1c3RvbSBYTUxcbiAgICB0aGlzLk5TU3RyaW5nID0gJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJztcbiAgICB0aGlzLmQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBPdXIgY3VzdG9tIHR5cGUgZGVmaW5pdGlvbnNcbiAgICB0aGlzLldSQVBQRVJTID0ge1xuICAgICAgUm9vdFdyYXBwZXIsXG4gICAgICBEb2N1bWVudFdyYXBwZXIsXG4gICAgICBQcmltaXRpdmVXcmFwcGVyLFxuICAgICAgSW52YWxpZFdyYXBwZXIsXG4gICAgICBOdWxsV3JhcHBlcixcbiAgICAgIEJvb2xlYW5XcmFwcGVyLFxuICAgICAgTnVtYmVyV3JhcHBlcixcbiAgICAgIFN0cmluZ1dyYXBwZXIsXG4gICAgICBEYXRlV3JhcHBlcixcbiAgICAgIFJlZmVyZW5jZVdyYXBwZXIsXG4gICAgICBDb250YWluZXJXcmFwcGVyLFxuICAgICAgR2VuZXJpY1dyYXBwZXIsXG4gICAgICBTZXRXcmFwcGVyLFxuICAgICAgRWRnZVdyYXBwZXIsXG4gICAgICBOb2RlV3JhcHBlcixcbiAgICAgIFN1cGVybm9kZVdyYXBwZXJcbiAgICB9O1xuXG4gICAgLy8gU3BlY2lhbCBrZXlzIHRoYXQgc2hvdWxkIGJlIHNraXBwZWQgaW4gdmFyaW91cyBvcGVyYXRpb25zXG4gICAgdGhpcy5SRVNFUlZFRF9PQkpfS0VZUyA9IHtcbiAgICAgICdfaWQnOiB0cnVlLFxuICAgICAgJ19yZXYnOiB0cnVlLFxuICAgICAgJyR3YXNBcnJheSc6IHRydWUsXG4gICAgICAnJHRhZ3MnOiB0cnVlLFxuICAgICAgJyRtZW1iZXJzJzogdHJ1ZSxcbiAgICAgICckZWRnZXMnOiB0cnVlLFxuICAgICAgJyRub2Rlcyc6IHRydWUsXG4gICAgICAnJG5leHRMYWJlbCc6IHRydWUsXG4gICAgICAnJGlzRGF0ZSc6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gTW9kZXMgZm9yIGRlcml2aW5nIHNlbGVjdGlvbnNcbiAgICB0aGlzLkRFUklWRV9NT0RFUyA9IHtcbiAgICAgIFJFUExBQ0U6ICdSRVBMQUNFJyxcbiAgICAgIFVOSU9OOiAnVU5JT04nLFxuICAgICAgWE9SOiAnWE9SJ1xuICAgIH07XG5cbiAgICAvLyBBdXRvLW1hcHBpbmdzIGZyb20gbmF0aXZlIGphdmFzY3JpcHQgdHlwZXMgdG8gV3JhcHBlcnNcbiAgICB0aGlzLkpTVFlQRVMgPSB7XG4gICAgICAnbnVsbCc6IE51bGxXcmFwcGVyLFxuICAgICAgJ2Jvb2xlYW4nOiBCb29sZWFuV3JhcHBlcixcbiAgICAgICdudW1iZXInOiBOdW1iZXJXcmFwcGVyXG4gICAgfTtcblxuICAgIC8vIEFsbCB0aGUgc3VwcG9ydGVkIG9wZXJhdGlvbnNcbiAgICBsZXQgb3BlcmF0aW9uQ2xhc3NlcyA9IFtcbiAgICAgIFNlbGVjdEFsbE9wZXJhdGlvbixcbiAgICAgIEZpbHRlck9wZXJhdGlvbixcbiAgICAgIENvbnZlcnRPcGVyYXRpb24sXG4gICAgICBDb25uZWN0T3BlcmF0aW9uLFxuICAgICAgQXR0YWNoT3BlcmF0aW9uLFxuICAgICAgQXNzaWduQ2xhc3NPcGVyYXRpb25cbiAgICBdO1xuICAgIHRoaXMuT1BFUkFUSU9OUyA9IHt9O1xuXG4gICAgLy8gVW5saWtlIFdSQVBQRVJTLCB3ZSBhY3R1YWxseSB3YW50IHRvIGluc3RhbnRpYXRlIGFsbCB0aGUgb3BlcmF0aW9uc1xuICAgIC8vIHdpdGggYSByZWZlcmVuY2UgdG8gdGhpcy4gV2hpbGUgd2UncmUgYXQgaXQsIG1vbmtleSBwYXRjaCB0aGVtIG9udG9cbiAgICAvLyB0aGUgU2VsZWN0aW9uIGNsYXNzXG4gICAgb3BlcmF0aW9uQ2xhc3Nlcy5mb3JFYWNoKE9wZXJhdGlvbiA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gbmV3IE9wZXJhdGlvbih0aGlzKTtcbiAgICAgIHRoaXMuT1BFUkFUSU9OU1t0ZW1wLnR5cGVdID0gdGVtcDtcbiAgICAgIFNlbGVjdGlvbi5wcm90b3R5cGVbdGVtcC5sb3dlckNhbWVsQ2FzZVR5cGVdID0gYXN5bmMgZnVuY3Rpb24gKGlucHV0T3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leGVjdXRlKHRlbXAsIGlucHV0T3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIC8gbG9hZCB0aGUgbG9jYWwgZGF0YWJhc2Ugb2YgZmlsZXNcbiAgICB0aGlzLmdldE9ySW5pdERiKCk7XG5cbiAgICAvLyBpbiB0aGUgYWJzZW5jZSBvZiBhIGN1c3RvbSBkaWFsb2dzLCBqdXN0IHVzZSB3aW5kb3cuYWxlcnQsXG4gICAgLy8gd2luZG93LmNvbmZpcm0sIHdpbmRvdy5wcm9tcHQsIGNvbnNvbGUud2FybiwgYW5kIGNvbnNvbGUubG9nOlxuICAgIHRoaXMuYWxlcnQgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy53aW5kb3cuYWxlcnQobWVzc2FnZSk7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMuY29uZmlybSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHRoaXMud2luZG93LmNvbmZpcm0obWVzc2FnZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLnByb21wdCA9IChtZXNzYWdlLCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUodGhpcy53aW5kb3cucHJvbXB0KG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLndhcm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zb2xlLndhcm4oLi4uYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIHRoaXMubG9nID0gZnVuY3Rpb24gKCkge1xuICAgICAgY29uc29sZS5sb2coLi4uYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG4gIGN1c3RvbWl6ZUFsZXJ0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmFsZXJ0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZUNvbmZpcm1EaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuY29uZmlybSA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVQcm9tcHREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMucHJvbXB0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGdldE9ySW5pdERiICgpIHtcbiAgICB0aGlzLmRiID0gbmV3IHRoaXMuUG91Y2hEQignbXVyZScpO1xuICAgIHRoaXMuZGJTdGF0dXMgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgc3RhdHVzID0geyBzeW5jZWQ6IGZhbHNlIH07XG4gICAgICAgIGxldCBjb3VjaERiVXJsID0gdGhpcy53aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NvdWNoRGJVcmwnKTtcbiAgICAgICAgaWYgKGNvdWNoRGJVcmwpIHtcbiAgICAgICAgICBsZXQgY291Y2hEYiA9IG5ldyB0aGlzLlBvdWNoREIoY291Y2hEYlVybCwge3NraXBfc2V0dXA6IHRydWV9KTtcbiAgICAgICAgICBzdGF0dXMuc3luY2VkID0gISEoYXdhaXQgdGhpcy5kYi5zeW5jKGNvdWNoRGIsIHtsaXZlOiB0cnVlLCByZXRyeTogdHJ1ZX0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5hbGVydCgnRXJyb3Igc3luY2luZyB3aXRoICcgKyBjb3VjaERiVXJsICsgJzogJyArXG4gICAgICAgICAgICAgICAgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdHVzLmluZGV4ZWQgPSAhIShhd2FpdCB0aGlzLmRiLmNyZWF0ZUluZGV4KHtcbiAgICAgICAgICBpbmRleDoge1xuICAgICAgICAgICAgZmllbGRzOiBbJ2ZpbGVuYW1lJ11cbiAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGZhbHNlKSk7XG4gICAgICAgIHN0YXR1cy5saW5rZWRVc2VyU2VsZWN0aW9uID0gISEoYXdhaXQgdGhpcy5kYi5wdXQoe1xuICAgICAgICAgIF9pZDogJyRsaW5rZWRVc2VyU2VsZWN0aW9uJyxcbiAgICAgICAgICBzZWxlY3Rvckxpc3Q6IFtdXG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGZhbHNlKSk7XG4gICAgICAgIHN0YXR1cy5saW5rZWRWaWV3U2V0dGluZ3MgPSAhIShhd2FpdCB0aGlzLmRiLnB1dCh7XG4gICAgICAgICAgX2lkOiAnJGxpbmtlZFZpZXdTZXR0aW5ncycsXG4gICAgICAgICAgc2V0dGluZ3M6IHt9XG4gICAgICAgIH0pLmNhdGNoKCgpID0+IGZhbHNlKSk7XG4gICAgICAgIHRoaXMuZGIuY2hhbmdlcyh7XG4gICAgICAgICAgc2luY2U6IChhd2FpdCB0aGlzLmRiLmluZm8oKSkudXBkYXRlX3NlcSAtIDEsXG4gICAgICAgICAgbGl2ZTogdHJ1ZSxcbiAgICAgICAgICBpbmNsdWRlX2RvY3M6IHRydWVcbiAgICAgICAgfSkub24oJ2NoYW5nZScsIGNoYW5nZSA9PiB7XG4gICAgICAgICAgaWYgKGNoYW5nZS5pZCA+ICdfXFx1ZmZmZicpIHtcbiAgICAgICAgICAgIC8vIEEgcmVndWxhciBkb2N1bWVudCBjaGFuZ2VkOyBpbnZhbGlkYXRlIGFsbCBzZWxlY3Rpb24gY2FjaGVzXG4gICAgICAgICAgICAvLyBjb3JyZXNwb25kaW5nIHRvIHRoaXMgZG9jdW1lbnRcbiAgICAgICAgICAgIFNlbGVjdGlvbi5JTlZBTElEQVRFX0RPQ19DQUNIRShjaGFuZ2UuaWQpO1xuICAgICAgICAgICAgaWYgKGNoYW5nZS5kb2MuX3Jldi5zZWFyY2goL14xLS8pICE9PSAtMSkge1xuICAgICAgICAgICAgICAvLyBUT0RPOiB0aGlzIGlzIGEgaGFjayB0byBzZWUgaWYgaXQncyBhIG5ld2x5LWFkZGVkIGRvYyAod2Ugd2FudFxuICAgICAgICAgICAgICAvLyB0byBpbnZhbGlkYXRlIGFsbCBzZWxlY3Rpb24gY2FjaGVzLCBiZWNhdXNlIHdlIGhhdmUgbm8gd2F5IHRvXG4gICAgICAgICAgICAgIC8vIGtub3cgaWYgdGhleSdkIHNlbGVjdCB0aGlzIG5ldyBkb2N1bWVudCBvciBub3QpLiBUaGlzIHdvbid0XG4gICAgICAgICAgICAgIC8vIHdvcmsgb25jZSB3ZSBzdGFydCBkZWFsaW5nIHdpdGggcmVwbGljYXRpb24sIGlmIGEgZmlsZSBnZXRzXG4gICAgICAgICAgICAgIC8vIGFkZGVkIHJlbW90ZWx5LiBTZWUgXCJIb3cgY2FuIEkgZGlzdGluZ3Vpc2ggYmV0d2VlbiBhZGRlZCBhbmRcbiAgICAgICAgICAgICAgLy8gbW9kaWZpZWQgZG9jdW1lbnRzXCIgaW4gdGhlIFBvdWNoREIgZG9jdW1lbnRhdGlvbjpcbiAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9wb3VjaGRiLmNvbS9ndWlkZXMvY2hhbmdlcy5odG1sXG4gICAgICAgICAgICAgIFNlbGVjdGlvbi5JTlZBTElEQVRFX0FMTF9DQUNIRVMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZG9jQ2hhbmdlJywgY2hhbmdlLmRvYyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaGFuZ2UuaWQgPT09ICckbGlua2VkVXNlclNlbGVjdGlvbicpIHtcbiAgICAgICAgICAgIC8vIFRoZSBsaW5rZWQgdXNlciBzZWxlY3Rpb24gY2hhbmdlZFxuICAgICAgICAgICAgdGhpcy5zdGlja3lUcmlnZ2VyKCdsaW5rZWRWaWV3Q2hhbmdlJywge1xuICAgICAgICAgICAgICB1c2VyU2VsZWN0aW9uOiB0aGlzLnNlbGVjdEFsbChjaGFuZ2UuZG9jLnNlbGVjdG9yTGlzdClcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2hhbmdlLmlkID09PSAnJGxpbmtlZFZpZXdTZXR0aW5ncycpIHtcbiAgICAgICAgICAgIC8vIFRoZSBsaW5rZWQgdmlldyBzZXR0aW5ncyBjaGFuZ2VkXG4gICAgICAgICAgICB0aGlzLnN0aWNreVRyaWdnZXIoJ2xpbmtlZFZpZXdDaGFuZ2UnLCB7XG4gICAgICAgICAgICAgIHNldHRpbmdzOiBjaGFuZ2UuZG9jLnNldHRpbmdzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLm9uKCdlcnJvcicsIGVyciA9PiB7XG4gICAgICAgICAgdGhpcy53YXJuKGVycik7XG4gICAgICAgIH0pO1xuICAgICAgICByZXNvbHZlKHN0YXR1cyk7XG4gICAgICB9KSgpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFsbERvY3MgKG9wdGlvbnMgPSB7fSkge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgT2JqZWN0LmFzc2lnbihvcHRpb25zLCB7XG4gICAgICBzdGFydGtleTogJ19cXHVmZmZmJyxcbiAgICAgIGluY2x1ZGVfZG9jczogdHJ1ZVxuICAgIH0pO1xuICAgIGxldCByZXN1bHRzID0gYXdhaXQgdGhpcy5kYi5hbGxEb2NzKG9wdGlvbnMpO1xuICAgIHJldHVybiByZXN1bHRzLnJvd3MubWFwKHJvdyA9PiByb3cuZG9jKTtcbiAgfVxuICBhc3luYyBhbGxEb2NXcmFwcGVycyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmFsbERvY3MoKSlcbiAgICAgIC5tYXAoZG9jID0+IG5ldyB0aGlzLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlcih7IG11cmU6IHRoaXMsIGRvYyB9KSk7XG4gIH1cbiAgYXN5bmMgcXVlcnlEb2NzIChxdWVyeU9iaikge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgbGV0IHF1ZXJ5UmVzdWx0ID0gYXdhaXQgdGhpcy5kYi5maW5kKHF1ZXJ5T2JqKTtcbiAgICBpZiAocXVlcnlSZXN1bHQud2FybmluZykgeyB0aGlzLndhcm4ocXVlcnlSZXN1bHQud2FybmluZyk7IH1cbiAgICByZXR1cm4gcXVlcnlSZXN1bHQuZG9jcztcbiAgfVxuICAvKipcbiAgICogQSB3cmFwcGVyIGFyb3VuZCBQb3VjaERCLmdldCgpIHRoYXQgZW5zdXJlcyB0aGF0IHRoZSBmaXJzdCBtYXRjaGVkXG4gICAqIGRvY3VtZW50IGV4aXN0cyAob3B0aW9uYWxseSBjcmVhdGVzIGFuIGVtcHR5IGRvY3VtZW50IHdoZW4gaXQgZG9lc24ndCksIGFuZFxuICAgKiB0aGF0IGl0IGNvbmZvcm1zIHRvIHRoZSBzcGVjaWZpY2F0aW9ucyBvdXRsaW5lZCBpbiBkb2N1bWVudGF0aW9uL3NjaGVtYS5tZFxuICAgKiBAcGFyYW0gIHtPYmplY3R8c3RyaW5nfSAgW2RvY1F1ZXJ5XVxuICAgKiBUaGUgYHNlbGVjdG9yYCBjb21wb25lbnQgb2YgYSBNYW5nbyBxdWVyeSwgb3IsIGlmIGEgc3RyaW5nLCB0aGUgcHJlY2lzZVxuICAgKiBkb2N1bWVudCBfaWRcbiAgICogQHBhcmFtICB7e2Jvb2xlYW59fSAgW2luaXQ9dHJ1ZV1cbiAgICogSWYgdHJ1ZSAoZGVmYXVsdCksIHRoZSBkb2N1bWVudCB3aWxsIGJlIGNyZWF0ZWQgKGJ1dCBub3Qgc2F2ZWQpIGlmIGl0IGRvZXNcbiAgICogbm90IGV4aXN0LiBJZiBmYWxzZSwgdGhlIHJldHVybmVkIFByb21pc2Ugd2lsbCByZXNvbHZlIHRvIG51bGxcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICogUmVzb2x2ZXMgdGhlIGRvY3VtZW50XG4gICAqL1xuICBhc3luYyBnZXREb2MgKGRvY1F1ZXJ5LCB7IGluaXQgPSB0cnVlIH0gPSB7fSkge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgbGV0IGRvYztcbiAgICBpZiAoIWRvY1F1ZXJ5KSB7XG4gICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIubGF1bmNoU3RhbmRhcmRpemF0aW9uKHsgZG9jOiB7fSwgbXVyZTogdGhpcyB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBkb2NRdWVyeSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGRvY1F1ZXJ5WzBdID09PSAnQCcpIHtcbiAgICAgICAgICBkb2NRdWVyeSA9IEpTT04ucGFyc2UoZG9jUXVlcnkuc2xpY2UoMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRvY1F1ZXJ5ID0geyAnX2lkJzogZG9jUXVlcnkgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG1hdGNoaW5nRG9jcyA9IGF3YWl0IHRoaXMucXVlcnlEb2NzKHsgc2VsZWN0b3I6IGRvY1F1ZXJ5LCBsaW1pdDogMSB9KTtcbiAgICAgIGlmIChtYXRjaGluZ0RvY3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmIChpbml0KSB7XG4gICAgICAgICAgLy8gSWYgbWlzc2luZywgdXNlIHRoZSBkb2NRdWVyeSBpdHNlbGYgYXMgdGhlIHRlbXBsYXRlIGZvciBhIG5ldyBkb2NcbiAgICAgICAgICBkb2MgPSBhd2FpdCB0aGlzLldSQVBQRVJTLkRvY3VtZW50V3JhcHBlci5sYXVuY2hTdGFuZGFyZGl6YXRpb24oeyBkb2M6IGRvY1F1ZXJ5LCBtdXJlOiB0aGlzIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb2MgPSBtYXRjaGluZ0RvY3NbMF07XG4gICAgICB9XG4gICAgICByZXR1cm4gZG9jO1xuICAgIH1cbiAgfVxuICBhc3luYyBwdXREb2MgKGRvYykge1xuICAgIGF3YWl0IHRoaXMuZGJTdGF0dXM7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLmRiLnB1dChkb2MpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhpcy53YXJuKGVyci5tZXNzYWdlKTtcbiAgICAgIHJldHVybiBlcnI7XG4gICAgfVxuICB9XG4gIGFzeW5jIHB1dERvY3MgKGRvY0xpc3QpIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIC8vIFBvdWNoREIgZG9lc24ndCBzdXBwb3J0IHRyYW5zYWN0aW9ucywgc28gd2Ugd2FudCB0byBiZSBhYmxlIHRvIHJvbGwgYmFja1xuICAgIC8vIGFueSBjaGFuZ2VzIGluIHRoZSBldmVudCB0aGF0IG91ciB1cGRhdGUgZmFpbHNcbiAgICBjb25zdCBwcmV2aW91c0RvY3MgPSAoYXdhaXQgdGhpcy5kYi5maW5kKHtcbiAgICAgIHNlbGVjdG9yOiB7JyRvcic6IGRvY0xpc3QubWFwKGRvYyA9PiB7XG4gICAgICAgIHJldHVybiB7IF9pZDogZG9jLl9pZCB9O1xuICAgICAgfSl9XG4gICAgfSkpLmRvY3M7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kYi5idWxrRG9jcyhkb2NMaXN0KTtcbiAgICBsZXQgbmV3UmV2cyA9IHt9O1xuICAgIGxldCBlcnJvck1lc3NhZ2VzID0ge307XG4gICAgbGV0IGVycm9yU2VlbiA9IGZhbHNlO1xuICAgIHJlc3VsdC5mb3JFYWNoKHJlc3VsdE9iaiA9PiB7XG4gICAgICBpZiAocmVzdWx0T2JqLmVycm9yKSB7XG4gICAgICAgIGVycm9yU2VlbiA9IHRydWU7XG4gICAgICAgIGVycm9yTWVzc2FnZXNbcmVzdWx0T2JqLm1lc3NhZ2VdID0gZXJyb3JNZXNzYWdlc1tyZXN1bHRPYmoubWVzc2FnZV0gfHwgW107XG4gICAgICAgIGVycm9yTWVzc2FnZXNbcmVzdWx0T2JqLm1lc3NhZ2VdLnB1c2gocmVzdWx0T2JqLmlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1JldnNbcmVzdWx0T2JqLmlkXSA9IHJlc3VsdE9iai5yZXY7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKGVycm9yU2Vlbikge1xuICAgICAgLy8gV2UgbmVlZCB0byByZXZlcnQgYW55IGRvY3VtZW50cyB0aGF0IHdlcmUgc3VjY2Vzc2Z1bFxuICAgICAgY29uc3QgcmV2ZXJ0ZWREb2NzID0gcHJldmlvdXNEb2NzLmZpbHRlcihkb2MgPT4ge1xuICAgICAgICBpZiAobmV3UmV2c1tkb2MuX2lkXSkge1xuICAgICAgICAgIGRvYy5fcmV2ID0gbmV3UmV2c1tkb2MuX2lkXTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gVE9ETzogd2hhdCBpZiBUSElTIGZhaWxzP1xuICAgICAgYXdhaXQgdGhpcy5kYi5idWxrRG9jcyhyZXZlcnRlZERvY3MpO1xuICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoT2JqZWN0LmVudHJpZXMoZXJyb3JNZXNzYWdlcykubWFwKChbbWVzc2FnZSwgaWRzXSkgPT4ge1xuICAgICAgICByZXR1cm4gYCR7bWVzc2FnZX1cXG5BZmZlY3RlZCBEb2N1bWVudHM6XFxuICAke2lkcy5qb2luKCdcXG4gICcpfWA7XG4gICAgICB9KS5qb2luKCdcXG5cXG4nKSk7XG4gICAgICBlcnJvci5lcnJvciA9IHRydWU7XG4gICAgICByZXR1cm4gZXJyb3I7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgLyoqXG4gICAqIERvd25sb2FkcyBhIGdpdmVuIGZpbGUsIG9wdGlvbmFsbHkgc3BlY2lmeWluZyBhIHBhcnRpY3VsYXIgZm9ybWF0XG4gICAqIEBwYXJhbSAge09iamVjdHxzdHJpbmd9ICBkb2NRdWVyeVxuICAgKiBUaGUgYHNlbGVjdG9yYCBjb21wb25lbnQgb2YgYSBNYW5nbyBxdWVyeSwgb3IsIGlmIGEgc3RyaW5nLCB0aGUgcHJlY2lzZVxuICAgKiBkb2N1bWVudCBfaWRcbiAgICogQHBhcmFtICB7e3N0cmluZ3xudWxsfX0gIFttaW1lVHlwZT1udWxsXVxuICAgKiBPdmVycmlkZXMgdGhlIGRvY3VtZW50J3MgbWltZVR5cGUgaW4gZm9ybWF0dGluZyB0aGUgZG93bmxvYWRcbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICogUmVzb2x2ZXMgYXMgYHRydWVgIG9uY2UgdGhlIGRvd25sb2FkIGlzIGluaXRpYXRlZFxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWREb2MgKGRvY1F1ZXJ5LCB7IG1pbWVUeXBlID0gbnVsbCB9ID0ge30pIHtcbiAgICByZXR1cm4gdGhpcy5nZXREb2MoZG9jUXVlcnkpXG4gICAgICAudGhlbihkb2MgPT4ge1xuICAgICAgICBtaW1lVHlwZSA9IG1pbWVUeXBlIHx8IGRvYy5taW1lVHlwZTtcbiAgICAgICAgbGV0IGNvbnRlbnRzID0gdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIuZm9ybWF0RG9jKGRvYywgeyBtaW1lVHlwZSB9KTtcblxuICAgICAgICAvLyBjcmVhdGUgYSBmYWtlIGxpbmsgdG8gaW5pdGlhdGUgdGhlIGRvd25sb2FkXG4gICAgICAgIGxldCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBhLnN0eWxlID0gJ2Rpc3BsYXk6bm9uZSc7XG4gICAgICAgIGxldCB1cmwgPSB0aGlzLndpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyB3aW5kb3cuQmxvYihbY29udGVudHNdLCB7IHR5cGU6IG1pbWVUeXBlIH0pKTtcbiAgICAgICAgYS5ocmVmID0gdXJsO1xuICAgICAgICBhLmRvd25sb2FkID0gZG9jLl9pZDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICAgICAgYS5jbGljaygpO1xuICAgICAgICB0aGlzLndpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgIGEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICB9XG4gIGFzeW5jIHVwbG9hZEZpbGVPYmogKGZpbGVPYmosIHsgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSwgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsIH0gPSB7fSkge1xuICAgIGxldCBzdHJpbmcgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHdpbmRvdy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy51cGxvYWRTdHJpbmcoZmlsZU9iai5uYW1lLCBmaWxlT2JqLnR5cGUsIGVuY29kaW5nLCBzdHJpbmcsIGV4dGVuc2lvbk92ZXJyaWRlKTtcbiAgfVxuICBhc3luYyB1cGxvYWRTdHJpbmcgKGZpbGVuYW1lLCBtaW1lVHlwZSwgZW5jb2RpbmcsIHN0cmluZywgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsKSB7XG4gICAgY29uc3QgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uT3ZlcnJpZGUgfHwgbWltZS5leHRlbnNpb24obWltZVR5cGUgfHwgbWltZS5sb29rdXAoZmlsZW5hbWUpKSB8fCAndHh0JztcbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgZG9jID0gYXdhaXQgdGhpcy5XUkFQUEVSUy5Eb2N1bWVudFdyYXBwZXIucGFyc2Uoc3RyaW5nLCBleHRlbnNpb24pO1xuICAgIHJldHVybiB0aGlzLnVwbG9hZERvYyhmaWxlbmFtZSwgbWltZVR5cGUsIGVuY29kaW5nLCBkb2MpO1xuICB9XG4gIGFzeW5jIHVwbG9hZERvYyAoZmlsZW5hbWUsIG1pbWVUeXBlLCBlbmNvZGluZywgZG9jKSB7XG4gICAgYXdhaXQgdGhpcy5kYlN0YXR1cztcbiAgICBkb2MuZmlsZW5hbWUgPSBmaWxlbmFtZSB8fCBkb2MuZmlsZW5hbWU7XG4gICAgZG9jLm1pbWVUeXBlID0gbWltZVR5cGUgfHwgZG9jLm1pbWVUeXBlIHx8IG1pbWUubG9va3VwKGZpbGVuYW1lKTtcbiAgICBkb2MuY2hhcnNldCA9IGVuY29kaW5nIHx8IGRvYy5jaGFyc2V0IHx8IG1pbWUuY2hhcnNldChkb2MubWltZVR5cGUpO1xuICAgIGRvYyA9IGF3YWl0IHRoaXMuV1JBUFBFUlMuRG9jdW1lbnRXcmFwcGVyLmxhdW5jaFN0YW5kYXJkaXphdGlvbih7IGRvYywgbXVyZTogdGhpcyB9KTtcbiAgICBpZiAoIShhd2FpdCB0aGlzLnB1dERvYyhkb2MpKS5vaykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnNlbGVjdEFsbChgQHtcIl9pZFwiOlwiJHtkb2MuX2lkfVwifSRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZGVsZXRlRG9jIChkb2NRdWVyeSkge1xuICAgIGxldCBkb2MgPSBhd2FpdCB0aGlzLmdldERvYyhkb2NRdWVyeSk7XG4gICAgcmV0dXJuIHRoaXMucHV0RG9jKHtcbiAgICAgIF9pZDogZG9jLl9pZCxcbiAgICAgIF9yZXY6IGRvYy5fcmV2LFxuICAgICAgX2RlbGV0ZWQ6IHRydWVcbiAgICB9KTtcbiAgfVxuICBzZWxlY3REb2MgKGRvY0lkKSB7XG4gICAgcmV0dXJuIHRoaXMuc2VsZWN0QWxsKCdAe1wiX2lkXCI6XCInICsgZG9jSWQgKyAnXCJ9JCcpO1xuICB9XG4gIHNlbGVjdEFsbCAoc2VsZWN0b3JMaXN0KSB7XG4gICAgcmV0dXJuIG5ldyBTZWxlY3Rpb24odGhpcywgc2VsZWN0b3JMaXN0KTtcbiAgfVxuICBhc3luYyBzZXRMaW5rZWRWaWV3cyAoeyB1c2VyU2VsZWN0aW9uLCBzZXR0aW5ncyB9ID0ge30pIHtcbiAgICBhd2FpdCB0aGlzLmRiU3RhdHVzO1xuICAgIGxldCBkb2NzID0gW107XG4gICAgaWYgKHVzZXJTZWxlY3Rpb24pIHtcbiAgICAgIGNvbnN0IGxpbmtlZFVzZXJTZWxlY3Rpb24gPSBhd2FpdCB0aGlzLmRiLmdldCgnJGxpbmtlZFVzZXJTZWxlY3Rpb24nKTtcbiAgICAgIGxpbmtlZFVzZXJTZWxlY3Rpb24uc2VsZWN0b3JMaXN0ID0gdXNlclNlbGVjdGlvbi5zZWxlY3Rvckxpc3Q7XG4gICAgICBkb2NzLnB1c2gobGlua2VkVXNlclNlbGVjdGlvbik7XG4gICAgfVxuICAgIGlmIChzZXR0aW5ncykge1xuICAgICAgY29uc3QgbGlua2VkVmlld1NldHRpbmdzID0gYXdhaXQgdGhpcy5kYi5nZXQoJyRsaW5rZWRWaWV3U2V0dGluZ3MnKTtcbiAgICAgIE9iamVjdC5hc3NpZ24obGlua2VkVmlld1NldHRpbmdzLnNldHRpbmdzLCBzZXR0aW5ncyk7XG4gICAgICBkb2NzLnB1c2gobGlua2VkVmlld1NldHRpbmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucHV0RG9jcyhkb2NzKTtcbiAgfVxuICBhc3luYyBnZXRMaW5rZWRWaWV3cyAoKSB7XG4gICAgYXdhaXQgdGhpcy5kYlN0YXR1cztcbiAgICBjb25zdCB0ZW1wID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5kYi5nZXQoJyRsaW5rZWRVc2VyU2VsZWN0aW9uJyksXG4gICAgICB0aGlzLmRiLmdldCgnJGxpbmtlZFZpZXdTZXR0aW5ncycpXG4gICAgXSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHVzZXJTZWxlY3Rpb246IHRoaXMuc2VsZWN0QWxsKHRlbXBbMF0uc2VsZWN0b3JMaXN0KSxcbiAgICAgIHNldHRpbmdzOiB0ZW1wWzFdLnNldHRpbmdzXG4gICAgfTtcbiAgfVxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGxldCBjaHVua3MgPSAvQFxccyooey4qfSk/XFxzKihcXCRbXuKGkeKGkl0qKT9cXHMqKOKGkSopXFxzKijihpIpPyguKikvLmV4ZWMoc2VsZWN0b3JTdHJpbmcpO1xuICAgIGlmICghY2h1bmtzIHx8IGNodW5rc1s1XSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGxldCBwYXJzZWREb2NRdWVyeSA9IGNodW5rc1sxXSA/IEpTT04ucGFyc2UoY2h1bmtzWzFdLnRyaW0oKSkgOiBKU09OLnBhcnNlKFNlbGVjdGlvbi5ERUZBVUxUX0RPQ19RVUVSWSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRvY1F1ZXJ5OiBjaHVua3NbMV0gPyBjaHVua3NbMV0udHJpbSgpIDogU2VsZWN0aW9uLkRFRkFVTFRfRE9DX1FVRVJZLFxuICAgICAgcGFyc2VkRG9jUXVlcnksXG4gICAgICBvYmpRdWVyeTogY2h1bmtzWzJdID8gY2h1bmtzWzJdLnRyaW0oKSA6ICcnLFxuICAgICAgcGFyZW50U2hpZnQ6IGNodW5rc1szXSA/IGNodW5rc1szXS5sZW5ndGggOiAwLFxuICAgICAgZm9sbG93TGlua3M6ICEhY2h1bmtzWzRdXG4gICAgfTtcbiAgfVxuICBwYXRoVG9TZWxlY3RvciAocGF0aCA9IFtTZWxlY3Rpb24uREVGQVVMVF9ET0NfUVVFUlldKSB7XG4gICAgbGV0IGRvY1F1ZXJ5ID0gcGF0aFswXTtcbiAgICBsZXQgb2JqUXVlcnkgPSBwYXRoLnNsaWNlKDEpO1xuICAgIG9ialF1ZXJ5ID0gb2JqUXVlcnkubGVuZ3RoID4gMCA/IGpzb25QYXRoLnN0cmluZ2lmeShvYmpRdWVyeSkgOiAnJztcbiAgICByZXR1cm4gJ0AnICsgZG9jUXVlcnkgKyBvYmpRdWVyeTtcbiAgfVxuICBpZFRvVW5pcXVlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nLCBkb2NJZCkge1xuICAgIGNvbnN0IGNodW5rcyA9IC9AW14kXSooXFwkLiopLy5leGVjKHNlbGVjdG9yU3RyaW5nKTtcbiAgICByZXR1cm4gYEB7XCJfaWRcIjpcIiR7ZG9jSWR9XCJ9JHtjaHVua3NbMV19YDtcbiAgfVxuICBleHRyYWN0RG9jUXVlcnkgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gL0BcXHMqKHsuKn0pLy5leGVjKHNlbGVjdG9yU3RyaW5nKTtcbiAgICBpZiAocmVzdWx0ICYmIHJlc3VsdFsxXSkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzdWx0WzFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIGV4dHJhY3RDbGFzc0luZm9Gcm9tSWQgKGlkKSB7XG4gICAgY29uc3QgdGVtcCA9IC9AW14kXSpcXCRcXC5jbGFzc2VzKFxcLlteXFxz4oaR4oaSLl0rKT8oXFxbXCJbXlwiXStcIl0pPy8uZXhlYyhpZCk7XG4gICAgaWYgKHRlbXAgJiYgKHRlbXBbMV0gfHwgdGVtcFsyXSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNsYXNzUGF0aENodW5rOiB0ZW1wWzFdIHx8IHRlbXBbMl0sXG4gICAgICAgIGNsYXNzTmFtZTogdGVtcFsxXSA/IHRlbXBbMV0uc2xpY2UoMSkgOiB0ZW1wWzJdLnNsaWNlKDIsIHRlbXBbMl0ubGVuZ3RoIC0gMilcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuICBpbmZlclR5cGUgKHZhbHVlLCBhZ2dyZXNzaXZlID0gZmFsc2UpIHtcbiAgICBjb25zdCBqc1R5cGUgPSB0eXBlb2YgdmFsdWU7XG4gICAgaWYgKHRoaXMuSlNUWVBFU1tqc1R5cGVdKSB7XG4gICAgICByZXR1cm4gdGhpcy5KU1RZUEVTW2pzVHlwZV07XG4gICAgfSBlbHNlIGlmIChqc1R5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBBdHRlbXB0IHRvIHBhcnNlIGFzIGEgcmVmZXJlbmNlXG4gICAgICBpZiAodmFsdWVbMF0gPT09ICdAJyAmJiB0aGlzLnBhcnNlU2VsZWN0b3IodmFsdWUpICE9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLlJlZmVyZW5jZVdyYXBwZXI7XG4gICAgICB9XG4gICAgICAvLyBOb3QgYSByZWZlcmVuY2UuLi5cbiAgICAgIGlmIChhZ2dyZXNzaXZlKSB7XG4gICAgICAgIC8vIEFnZ3Jlc3NpdmVseSBhdHRlbXB0IHRvIGlkZW50aWZ5IHNvbWV0aGluZyBtb3JlIHNwZWNpZmljIHRoYW4gc3RyaW5nXG4gICAgICAgIGlmICghaXNOYU4oTnVtYmVyKHZhbHVlKSkpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5OdW1iZXJXcmFwcGVyO1xuICAgICAgICAvKlxuICAgICAgICAgRm9yIG5vdywgd2UgZG9uJ3QgYXR0ZW1wdCB0byBpZGVudGlmeSBkYXRlcywgZXZlbiBpbiBhZ2dyZXNzaXZlIG1vZGUsXG4gICAgICAgICBiZWNhdXNlIHRoaW5ncyBsaWtlIG5ldyBEYXRlKCdQbGF5ZXIgMScpIHdpbGwgc3VjY2Vzc2Z1bGx5IHBhcnNlIGFzIGFcbiAgICAgICAgIGRhdGUuIElmIHdlIGNhbiBmaW5kIHNtYXJ0ZXIgd2F5cyB0byBhdXRvLWluZmVyIGRhdGVzIChlLmcuIGRvZXMgdGhlXG4gICAgICAgICB2YWx1ZSBmYWxsIHN1c3BpY2lvdXNseSBuZWFyIHRoZSB1bml4IGVwb2NoLCB5MmssIG9yIG1vcmUgdGhhbiArLy01MDBcbiAgICAgICAgIHllYXJzIGZyb20gbm93PyBEbyBzaWJsaW5nIGNvbnRhaW5lciBpdGVtcyBwYXJzZSB0aGlzIGFzIGEgZGF0ZT8pLCB0aGVuXG4gICAgICAgICBtYXliZSB3ZSdsbCBhZGQgdGhpcyBiYWNrLi4uXG4gICAgICAgICovXG4gICAgICAgIC8vIH0gZWxzZSBpZiAoIWlzTmFOKG5ldyBEYXRlKHZhbHVlKSkpIHtcbiAgICAgICAgLy8gIHJldHVybiBXUkFQUEVSUy5EYXRlV3JhcHBlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gdmFsdWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICBpZiAodGVtcCA9PT0gJ3RydWUnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5Cb29sZWFuV3JhcHBlcjtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRlbXAgPT09ICdmYWxzZScpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkJvb2xlYW5XcmFwcGVyO1xuICAgICAgICAgIH0gZWxzZSBpZiAodGVtcCA9PT0gJ251bGwnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5XUkFQUEVSUy5OdWxsV3JhcHBlcjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIGl0J3MganVzdCBhIHN0cmluZ1xuICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuU3RyaW5nV3JhcHBlcjtcbiAgICB9IGVsc2UgaWYgKGpzVHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCBqc1R5cGUgPT09ICdzeW1ib2wnIHx8IGpzVHlwZSA9PT0gJ3VuZGVmaW5lZCcgfHwgdmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuSW52YWxpZFdyYXBwZXI7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuTnVsbFdyYXBwZXI7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUgfHwgdmFsdWUuJGlzRGF0ZSA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuRGF0ZVdyYXBwZXI7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS4kbm9kZXMpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuJGVkZ2VzKSB7XG4gICAgICBpZiAodmFsdWUuJG1lbWJlcnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuU3VwZXJub2RlV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodmFsdWUuJG1lbWJlcnMpIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLlNldFdyYXBwZXI7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS4kdGFncykge1xuICAgICAgcmV0dXJuIHRoaXMuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLldSQVBQRVJTLkNvbnRhaW5lcldyYXBwZXI7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvbGxvd1JlbGF0aXZlTGluayAoc2VsZWN0b3IsIGRvYykge1xuICAgIC8vIFRoaXMgc2VsZWN0b3Igc3BlY2lmaWVzIHRvIGZvbGxvdyB0aGUgbGlua1xuICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGxldCBkb2NRdWVyeSA9IHRoaXMuZXh0cmFjdERvY1F1ZXJ5KHNlbGVjdG9yKTtcbiAgICBsZXQgY3Jvc3NEb2M7XG4gICAgaWYgKCFkb2NRdWVyeSkge1xuICAgICAgc2VsZWN0b3IgPSBgQHtcIl9pZFwiOlwiJHtkb2MuX2lkfVwifSR7c2VsZWN0b3Iuc2xpY2UoMSl9YDtcbiAgICAgIGNyb3NzRG9jID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNyb3NzRG9jID0gZG9jUXVlcnkuX2lkICE9PSBkb2MuX2lkO1xuICAgIH1cbiAgICBsZXQgdGVtcFNlbGVjdGlvbjtcbiAgICB0cnkge1xuICAgICAgdGVtcFNlbGVjdGlvbiA9IG5ldyBTZWxlY3Rpb24odGhpcywgc2VsZWN0b3IpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyci5JTlZBTElEX1NFTEVDVE9SKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGRvY0xpc3RzID0gY3Jvc3NEb2MgPyBhd2FpdCB0ZW1wU2VsZWN0aW9uLmRvY0xpc3RzKCkgOiBbWyBkb2MgXV07XG4gICAgcmV0dXJuIHRlbXBTZWxlY3Rpb24uaXRlbXMoZG9jTGlzdHMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0ICogYXMgZDMgZnJvbSAnZDMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IFBvdWNoREIgZnJvbSAncG91Y2hkYi1icm93c2VyJztcbmltcG9ydCBQb3VjaEZpbmQgZnJvbSAncG91Y2hkYi1maW5kJztcbmltcG9ydCBQb3VjaEF1dGhlbnRpY2F0aW9uIGZyb20gJ3BvdWNoZGItYXV0aGVudGljYXRpb24nO1xuUG91Y2hEQi5wbHVnaW4oUG91Y2hBdXRoZW50aWNhdGlvbik7XG5Qb3VjaERCLnBsdWdpbihQb3VjaEZpbmQpO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKFBvdWNoREIsIGQzKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIkRFRkFVTFRfRE9DX1FVRVJZIiwiU2VsZWN0aW9uIiwibXVyZSIsInNlbGVjdG9yTGlzdCIsIkFycmF5Iiwic2VsZWN0b3JzIiwibWFwIiwic2VsZWN0b3JTdHJpbmciLCJzZWxlY3RvciIsInBhcnNlU2VsZWN0b3IiLCJlcnIiLCJFcnJvciIsIklOVkFMSURfU0VMRUNUT1IiLCJoYXNoIiwiX2hhc2giLCJtZDUiLCJKU09OIiwic3RyaW5naWZ5IiwiZG9jUXVlcnkiLCJvYmpRdWVyeSIsImZyb20iLCJwYXJlbnRTaGlmdCIsImQiLCJqb2luIiwiZm9sbG93TGlua3MiLCJpc0NhY2hlZCIsIl9jYWNoZWRXcmFwcGVycyIsIl9jYWNoZWREb2NMaXN0cyIsIl9zdW1tYXJ5Q2FjaGVzIiwiZG9jTGlzdHMiLCJQcm9taXNlIiwiYWxsIiwicXVlcnlEb2NzIiwicGFyc2VkRG9jUXVlcnkiLCJpIiwibGVuZ3RoIiwiaiIsImRvYyIsIkNBQ0hFRF9ET0NTIiwiX2lkIiwic2VsZWN0aW9ucyIsImluZGV4T2YiLCJwdXNoIiwiX3JldiIsImNhY2hlZERvYyIsIml0ZW1zIiwicXVldWVBc3luYyIsImFkZFdyYXBwZXIiLCJpdGVtIiwidW5pcXVlU2VsZWN0b3IiLCJpbmRleCIsImRvY0xpc3QiLCJXUkFQUEVSUyIsIlJvb3RXcmFwcGVyIiwiZm9yRWFjaCIsIkRvY3VtZW50V3JhcHBlciIsImRvY0luZGV4IiwibWF0Y2hpbmdXcmFwcGVycyIsImpzb25QYXRoIiwibm9kZXMiLCJpdGVtSW5kZXgiLCJwYXRoIiwidmFsdWUiLCJsb2NhbFBhdGgiLCJSRVNFUlZFRF9PQkpfS0VZUyIsInNsaWNlIiwic3BsaWNlIiwicXVlcnkiLCJ2YWx1ZXMiLCJmb2xsb3dSZWxhdGl2ZUxpbmsiLCJXcmFwcGVyVHlwZSIsImluZmVyVHlwZSIsImNvbmNhdCIsImV4ZWN1dGUiLCJvcGVyYXRpb24iLCJpbnB1dE9wdGlvbnMiLCJvdXRwdXRTcGVjIiwiZXhlY3V0ZU9uU2VsZWN0aW9uIiwicG9sbHV0ZWREb2NzIiwiT2JqZWN0Iiwic2tpcFNhdmUiLCJrZXlzIiwid2FybmluZ3MiLCJ3YXJuaW5nU3RyaW5nIiwiaWdub3JlRXJyb3JzIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJlbnRyaWVzIiwid2FybmluZyIsImNvdW50Iiwid2FybiIsInNhdmVTdWNjZXNzZnVsIiwic2F2ZVJlc3VsdCIsInB1dERvY3MiLCJlcnJvciIsIm1lc3NhZ2UiLCJJTlZBTElEQVRFX0RPQ19DQUNIRSIsIm5ld1NlbGVjdG9ycyIsInN1YlNlbGVjdCIsImFwcGVuZCIsIm1vZGUiLCJzZWxlY3RBbGwiLCJjb250ZXh0IiwibWVyZ2VTZWxlY3Rpb24iLCJvdGhlclNlbGVjdGlvbiIsImdldFBvcHVsYXRlZElucHV0U3BlYyIsImlucHV0U3BlY3MiLCJ0eXBlIiwiaW5wdXRTcGVjIiwiZ2V0SW5wdXRTcGVjIiwicG9wdWxhdGVDaG9pY2VzRnJvbVNlbGVjdGlvbiIsImhpc3RvZ3JhbXMiLCJudW1CaW5zIiwiaXRlbUxpc3QiLCJyZXN1bHQiLCJjb3VudFByaW1pdGl2ZSIsImNvdW50ZXJzIiwiY2F0ZWdvcmljYWxCaW5zIiwicXVhbnRpdGF0aXZlQmlucyIsInF1YW50aXRhdGl2ZVdyYXBwZXJzIiwicXVhbnRpdGF0aXZlVHlwZSIsIk51bWJlcldyYXBwZXIiLCJxdWFudGl0YXRpdmVTY2FsZSIsImQzIiwic2NhbGVMaW5lYXIiLCJkb21haW4iLCJEYXRlV3JhcHBlciIsInNjYWxlVGltZSIsInJhdyIsInR5cGVCaW5zIiwiUHJpbWl0aXZlV3JhcHBlciIsImdldENvbnRlbnRzIiwiY2hpbGRXcmFwcGVyIiwiYXR0cmlidXRlcyIsImxhYmVsIiwiZmluYWxpemVCaW5zIiwibmljZSIsImhpc3RvZ3JhbUdlbmVyYXRvciIsImhpc3RvZ3JhbSIsInRocmVzaG9sZHMiLCJ0aWNrcyIsImdldEZsYXRHcmFwaFNjaGVtYSIsImZsYXRHcmFwaFNjaGVtYSIsIkVkZ2VXcmFwcGVyIiwiY2xhc3NMaXN0IiwiZ2V0Q2xhc3NlcyIsImVkZ2VDbGFzc05hbWUiLCJwc2V1ZG9FZGdlIiwiZWRnZUNsYXNzZXMiLCIkbm9kZXMiLCJub2RlU2VsZWN0b3IiLCJkaXJlY3Rpb25zIiwibm9kZVdyYXBwZXIiLCJtaXNzaW5nTm9kZXMiLCJub2RlQ2xhc3NOYW1lIiwiZGlyZWN0aW9uIiwiTm9kZVdyYXBwZXIiLCJwc2V1ZG9Ob2RlIiwibm9kZUNsYXNzZXMiLCIkZWRnZXMiLCJlZGdlU2VsZWN0b3IiLCJlZGdlV3JhcHBlciIsIm1pc3NpbmdFZGdlcyIsImdldEludGVyc2VjdGVkR3JhcGhTY2hlbWEiLCJhbGxNZXRhT2JqSW50ZXJzZWN0aW9ucyIsIm1ldGFPYmpzIiwibGlua2VkSWRzIiwibWV0YU9iaiIsImxpbmtlZElkIiwiaWRUb1VuaXF1ZVNlbGVjdG9yIiwic2V0cyIsInNldExvb2t1cCIsIml0ZW1JZHMiLCJzb3J0Iiwic2V0S2V5IiwidW5kZWZpbmVkIiwiZG9jSWQiLCJzZWxlY3Rpb24iLCJpbnZhbGlkYXRlQ2FjaGUiLCJJTlZBTElEQVRFX0FMTF9DQUNIRVMiLCJJbnRyb3NwZWN0YWJsZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiZGVmaW5lUHJvcGVydHkiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVdyYXBwZXIiLCJwYXJlbnQiLCJfdmFsdWUiLCJuZXdWYWx1ZSIsIm90aGVyIiwiZXhlYyIsIm5hbWUiLCJnZXRCb2lsZXJwbGF0ZVZhbHVlIiwic3RhbmRhcmRpemUiLCJpc0JhZFZhbHVlIiwiVHlwZWRXcmFwcGVyIiwiZG9jUGF0aFF1ZXJ5IiwidW5pcXVlSnNvblBhdGgiLCJUeXBlRXJyb3IiLCJKU1RZUEUiLCJwYXJlbnRXcmFwcGVyIiwiUGFyZW50VHlwZSIsInN1cGVyY2xhc3MiLCJhdHRyaWJ1dGUiLCJ0YXJnZXQiLCJfY29udGVudFdyYXBwZXIiLCJmaWx0ZXIiLCJDb250YWluZXJXcmFwcGVyIiwiQ29udGFpbmVyV3JhcHBlck1peGluIiwibmV4dExhYmVsIiwicmVkdWNlIiwibWF4Iiwia2V5IiwicGFyc2VJbnQiLCJpc05hTiIsIlN0cmluZyIsImNvbnZlcnRBcnJheSIsImVsZW1lbnQiLCIkd2FzQXJyYXkiLCJhZ2dyZXNzaXZlIiwibmVzdGVkVmFsdWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJjb250ZW50cyIsImlzVmFsaWRJZCIsInRvTG93ZXJDYXNlIiwicGFydHMiLCJzcGxpdCIsIm1pbWUiLCJleHRlbnNpb24iLCJwYXJzZSIsInRleHQiLCJkYXRhbGliIiwicmVhZCIsImxhdW5jaFN0YW5kYXJkaXphdGlvbiIsImV4aXN0aW5nVW50aXRsZWRzIiwiZGIiLCJhbGxEb2NzIiwibWltZVR5cGUiLCJyb3dzIiwiZmlsZW5hbWUiLCJtaW5JbmRleCIsInVEb2MiLCJJbmZpbml0eSIsImlzRmluaXRlIiwibG9va3VwIiwiY2hhcnNldCIsInRvVXBwZXJDYXNlIiwib3JwaGFucyIsImNsYXNzZXMiLCJJbnZhbGlkV3JhcHBlciIsIk51bGxXcmFwcGVyIiwiQm9vbGVhbldyYXBwZXIiLCJOdW1iZXIiLCJTdHJpbmdXcmFwcGVyIiwiRGF0ZSIsInN0ciIsInRvU3RyaW5nIiwiJGlzRGF0ZSIsIlJlZmVyZW5jZVdyYXBwZXIiLCJHZW5lcmljV3JhcHBlciIsIiR0YWdzIiwiY2xhc3NOYW1lIiwiU2V0V3JhcHBlciIsImNsYXNzSXRlbSIsImFnZyIsInNldElkIiwiZXh0cmFjdENsYXNzSW5mb0Zyb21JZCIsImNsYXNzUGF0aENodW5rIiwiJG1lbWJlcnMiLCJpdGVtVGFnIiwic2V0VGFnIiwiZ2V0TWVtYmVycyIsImdldE1lbWJlclNlbGVjdG9ycyIsIlNldFdyYXBwZXJNaXhpbiIsIm5vZGUiLCJub2RlSWQiLCJub2RlU2VsZWN0b3JzIiwibm9kZVdyYXBwZXJzIiwiZm9yd2FyZCIsIm5vZGVXcmFwcGVyQ291bnQiLCJvcHBvc2l0ZURpcmVjdGlvbiIsImdsb21wVmFsdWUiLCJlZGdlTGlzdCIsImdsb21wIiwib3RoZXJOb2RlIiwiY29udGFpbmVyIiwibmV3RWRnZSIsImNyZWF0ZU5ld1dyYXBwZXIiLCJhdHRhY2hUbyIsImVkZ2VTZWxlY3RvcnMiLCJlZGdlV3JhcHBlcnMiLCIkZWdkZXMiLCJlZGdlV3JhcHBlckNvdW50IiwiU3VwZXJub2RlV3JhcHBlciIsIklucHV0U3BlYyIsIm9wdGlvbnMiLCJvcHRpb24iLCJwYXJhbWV0ZXJOYW1lIiwidXBkYXRlQ2hvaWNlcyIsInBhcmFtcyIsInNwZWNzIiwic3BlYyIsIklucHV0T3B0aW9uIiwiX2RlZmF1bHRWYWx1ZSIsImRlZmF1bHRWYWx1ZSIsImNob2ljZXMiLCJvcGVuRW5kZWQiLCJodW1hblJlYWRhYmxlUGFyYW1ldGVyTmFtZSIsInRvTG9jYWxlVXBwZXJDYXNlIiwiT3V0cHV0U3BlYyIsInNwZWNMaXN0IiwiQmFzZU9wZXJhdGlvbiIsImFkZE9wdGlvbiIsImNhbkV4ZWN1dGVPbkluc3RhbmNlIiwiZXhlY3V0ZU9uSW5zdGFuY2UiLCJpdGVtc0luVXNlIiwiYXJndW1lbnQiLCJwb3RlbnRpYWxseUV4ZWN1dGFibGVPblNlbGVjdGlvbiIsInNvbWUiLCJwb3RlbnRpYWxseUV4ZWN1dGFibGVPbkl0ZW0iLCJjYW5FeGVjdXRlT25TZWxlY3Rpb24iLCJnZXRJdGVtc0luVXNlIiwiY2FuRXhlY3V0ZUluc3RhbmNlcyIsImV2ZXJ5IiwiY2FuRXhlY3V0ZSIsIm91dHB1dFNwZWNQcm9taXNlcyIsIkNvbnRleHR1YWxPcHRpb24iLCJoaWRkZW5DaG9pY2VzIiwiY2hvaWNlIiwiU2VsZWN0QWxsT3BlcmF0aW9uIiwib3V0cHV0IiwiYWRkU2VsZWN0b3JzIiwiZWRnZSIsIm5ld1N0cmluZyIsIm5ld1NlbGVjdG9yIiwib3RoZXJTZWxlY3Rvckxpc3QiLCJTdHJpbmdPcHRpb24iLCJjaG9pY2VEaWN0IiwiQ2xhc3NPcHRpb24iLCJyZXNldCIsInBvcHVsYXRlRXhpc3RpbmdDaG9pY2VTdHJpbmdzIiwiREVGQVVMVF9GSUxURVJfRlVOQyIsIkZpbHRlck9wZXJhdGlvbiIsImZpbHRlckZ1bmN0aW9uIiwiY29ubmVjdFdoZW4iLCJTeW50YXhFcnJvciIsIkZ1bmN0aW9uIiwiQmFzZUNvbnZlcnNpb24iLCJUYXJnZXRUeXBlIiwic3RhbmRhcmRUeXBlcyIsInNwZWNpYWxUeXBlcyIsIlR5cGUiLCJzdGFuZGFyZENvbnZlcnNpb24iLCJzcGVjaWFsQ29udmVyc2lvbiIsIk51bGxDb252ZXJzaW9uIiwiQm9vbGVhbkNvbnZlcnNpb24iLCJOdW1iZXJDb252ZXJzaW9uIiwiU3RyaW5nQ29udmVyc2lvbiIsIkdlbmVyaWNDb252ZXJzaW9uIiwiTm9kZUNvbnZlcnNpb24iLCJFZGdlQ29udmVyc2lvbiIsIkNvbnZlcnRPcGVyYXRpb24iLCJjb252ZXJzaW9uTGlzdCIsIkNPTlZFUlNJT05TIiwiY29udmVyc2lvbiIsImFkZE9wdGlvbnNUb1NwZWMiLCJjb252ZXJ0SXRlbSIsImZsYWdQb2xsdXRlZERvYyIsIlR5cGVkT3B0aW9uIiwidmFsaWRUeXBlcyIsInN1Z2dlc3RPcnBoYW5zIiwiaXRlbUxvb2t1cCIsIm9ycGhhbkxvb2t1cCIsIkF0dHJpYnV0ZU9wdGlvbiIsInBvcHVsYXRlRnJvbUl0ZW0iLCJnZXRBdHRyaWJ1dGVzIiwiYXR0ciIsInBvcHVsYXRlRnJvbUl0ZW1zIiwidW5zaGlmdCIsIk5lc3RlZEF0dHJpYnV0ZU9wdGlvbiIsImdldEl0ZW1DaG9pY2VSb2xlIiwiaXRlbVJvbGUiLCJjaGlsZHJlbiIsIkRFRkFVTFRfQ09OTkVDVF9XSEVOIiwiQ29ubmVjdE9wZXJhdGlvbiIsInRhcmdldHMiLCJlcXVhbHMiLCJzYXZlRWRnZXNJbiIsInNvdXJjZXMiLCJ0YXJnZXRJdGVtcyIsImF0TGVhc3RUd29Ob2RlcyIsInNvdXJjZUF0dHJpYnV0ZSIsInRhcmdldEF0dHJpYnV0ZSIsImV4ZWN1dGVXaXRoaW5TZWxlY3Rpb24iLCJzb3VyY2VMaXN0IiwiY29ubmVjdFRvIiwiZ2V0U291cmNlVmFsdWUiLCJzb3VyY2UiLCJnZXRUYXJnZXRWYWx1ZSIsImRpcmVjdGVkIiwidGFyZ2V0TGlzdCIsIkF0dGFjaE9wZXJhdGlvbiIsImVkZ2VzIiwiZWRnZUl0ZW1zIiwibm9kZUl0ZW1zIiwib25lTm9kZSIsIm9uZUVkZ2UiLCJlZGdlQXR0cmlidXRlIiwibm9kZUF0dHJpYnV0ZSIsImdldEVkZ2VWYWx1ZSIsImdldE5vZGVWYWx1ZSIsIm5vZGVMaXN0IiwiQXNzaWduQ2xhc3NPcGVyYXRpb24iLCJnZXRWYWx1ZSIsImFkZENsYXNzIiwiTXVyZSIsIk1vZGVsIiwiUG91Y2hEQiIsImQzbiIsIndpbmRvdyIsIk5TU3RyaW5nIiwibmFtZXNwYWNlcyIsIkRFUklWRV9NT0RFUyIsIkpTVFlQRVMiLCJvcGVyYXRpb25DbGFzc2VzIiwiT1BFUkFUSU9OUyIsIk9wZXJhdGlvbiIsInByb3RvdHlwZSIsImdldE9ySW5pdERiIiwiYWxlcnQiLCJyZXNvbHZlIiwicmVqZWN0IiwiY29uZmlybSIsInByb21wdCIsImFyZ3VtZW50cyIsImxvZyIsInNob3dEaWFsb2dGdW5jdGlvbiIsImRiU3RhdHVzIiwic3RhdHVzIiwic3luY2VkIiwiY291Y2hEYlVybCIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJjb3VjaERiIiwic2tpcF9zZXR1cCIsInN5bmMiLCJsaXZlIiwicmV0cnkiLCJjYXRjaCIsImluZGV4ZWQiLCJjcmVhdGVJbmRleCIsImxpbmtlZFVzZXJTZWxlY3Rpb24iLCJwdXQiLCJsaW5rZWRWaWV3U2V0dGluZ3MiLCJjaGFuZ2VzIiwiaW5mbyIsInVwZGF0ZV9zZXEiLCJvbiIsImNoYW5nZSIsImlkIiwic2VhcmNoIiwidHJpZ2dlciIsInN0aWNreVRyaWdnZXIiLCJzZXR0aW5ncyIsImFzc2lnbiIsInJlc3VsdHMiLCJyb3ciLCJhbGxEb2NXcmFwcGVycyIsInF1ZXJ5T2JqIiwicXVlcnlSZXN1bHQiLCJmaW5kIiwiZG9jcyIsImdldERvYyIsImluaXQiLCJtYXRjaGluZ0RvY3MiLCJsaW1pdCIsInB1dERvYyIsInByZXZpb3VzRG9jcyIsImJ1bGtEb2NzIiwibmV3UmV2cyIsImVycm9yTWVzc2FnZXMiLCJlcnJvclNlZW4iLCJyZXN1bHRPYmoiLCJyZXYiLCJyZXZlcnRlZERvY3MiLCJpZHMiLCJkb3dubG9hZERvYyIsInRoZW4iLCJmb3JtYXREb2MiLCJhIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50Iiwic3R5bGUiLCJ1cmwiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJCbG9iIiwiaHJlZiIsImRvd25sb2FkIiwiYm9keSIsImFwcGVuZENoaWxkIiwiY2xpY2siLCJyZXZva2VPYmplY3RVUkwiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJ1cGxvYWRGaWxlT2JqIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJzdHJpbmciLCJyZWFkZXIiLCJGaWxlUmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsInVwbG9hZFN0cmluZyIsInVwbG9hZERvYyIsIm9rIiwiZGVsZXRlRG9jIiwic2V0TGlua2VkVmlld3MiLCJ1c2VyU2VsZWN0aW9uIiwiZ2V0IiwiZ2V0TGlua2VkVmlld3MiLCJjaHVua3MiLCJ0cmltIiwianNUeXBlIiwiZXh0cmFjdERvY1F1ZXJ5IiwiY3Jvc3NEb2MiLCJ0ZW1wU2VsZWN0aW9uIiwicGx1Z2luIiwiUG91Y2hBdXRoZW50aWNhdGlvbiIsIlBvdWNoRmluZCIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFJQSxNQUFNQSxvQkFBb0IsMkJBQTFCOztBQUVBLE1BQU1DLFNBQU4sQ0FBZ0I7Y0FDREMsSUFBYixFQUFtQkMsZUFBZSxDQUFDLE1BQU1ILGlCQUFQLENBQWxDLEVBQTZEO1FBQ3ZELEVBQUVHLHdC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
