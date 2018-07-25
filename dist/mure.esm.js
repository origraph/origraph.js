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
