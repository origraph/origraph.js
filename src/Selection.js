import jsonPath from 'jsonpath';
import { queueAsync } from 'uki';
import md5 from 'blueimp-md5';
import { OutputSpec } from './Operations/common.js';

const DEFAULT_DOC_QUERY = '{"_id":{"$gt":"_\uffff"}}';

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
  get hash () {
    if (!this._hash) {
      this._hash = md5(JSON.stringify(this.selectorList));
    }
    return this._hash;
  }
  get selectorList () {
    return this.selectors.map(selector => {
      return '@' + selector.docQuery + selector.objQuery +
        Array.from(Array(selector.parentShift)).map(d => '↑').join('') +
        (selector.followLinks ? '→' : '');
    });
  }
  get isCached () {
    return !!this._cachedItems;
  }
  invalidateCache () {
    delete this._cachedDocLists;
    delete this._cachedItems;
    delete this._summaryCaches;
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
  async items (docLists) {
    if (this._cachedItems) {
      return this._cachedItems;
    }

    // Note: we should only pass in docLists in rare situations (such as the
    // one-off case in followRelativeLink() where we already have the document
    // available, and creating the new selection will result in an unnnecessary
    // query of the database). Usually, we should rely on the cache.
    docLists = docLists || await this.docLists();

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
            addItem(new this.mure.ITEM_TYPES.RootItem({
              mure: this.mure,
              docList,
              selectSingle: this.selectSingle
            }));
          }
        } else if (selector.objQuery === '$') {
          // Selecting the documents themselves
          if (selector.parentShift === 0 && !selector.followLinks) {
            docList.some(doc => {
              addItem(new this.mure.ITEM_TYPES.DocumentItem({
                mure: this.mure,
                doc
              }));
              return this.selectSingle;
            });
          } else if (selector.parentShift === 1) {
            addItem(new this.mure.ITEM_TYPES.RootItem({
              mure: this.mure,
              docList,
              selectSingle: this.selectSingle
            }));
          }
        } else {
          // Okay, we need to evaluate the jsonPath
          for (let docIndex = 0; docIndex < docList.length; docIndex++) {
            let doc = docList[docIndex];
            let matchingItems = jsonPath.nodes(doc, selector.objQuery);
            for (let itemIndex = 0; itemIndex < matchingItems.length; itemIndex++) {
              let { path, value } = matchingItems[itemIndex];
              let localPath = path;
              if (this.mure.RESERVED_OBJ_KEYS[localPath.slice(-1)[0]]) {
                // Don't create items under reserved keys
                continue;
              } else if (selector.parentShift === localPath.length) {
                // we parent shifted up to the root level
                if (!selector.followLinks) {
                  addItem(new this.mure.ITEM_TYPES.RootItem({
                    mure: this.mure,
                    docList,
                    selectSingle: this.selectSingle
                  }));
                }
              } else if (selector.parentShift === localPath.length - 1) {
                // we parent shifted to the document level
                if (!selector.followLinks) {
                  addItem(new this.mure.ITEM_TYPES.DocumentItem({
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
                  Object.values(await this.mure.followRelativeLink(value, doc, this.selectSingle))
                    .forEach(addItem);
                } else {
                  const ItemType = this.mure.inferType(value);
                  addItem(new ItemType({
                    mure: this.mure,
                    value,
                    path: [`{"_id":"${doc._id}"}`].concat(localPath),
                    doc
                  }));
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
  get chainable () {
    if (this.pendingOperations.length === 0) {
      return true;
    } else {
      const lastOp = this.pendingOperations[this.pendingOperations.length].operation;
      return lastOp.terminatesChain === false;
    }
  }
  chain (operation, inputOptions) {
    if (!this.chainable) {
      throw new Error(`A terminating operation (\
${this.pendingOperations[this.pendingOperations.length].operation.humanReadableName}\
) has already been chained; please await executeChain() or cancelChain() before \
chaining additional operations.`);
    }
    this.pendingOperations.push({ operation, inputOptions });
    return this;
  }
  async executeChain () {
    // Evaluate all the pending operations that we've accrued; as each function
    // manipulates Items' .value property, those changes will automatically be
    // reflected in the document (as every .value is a pointer, or BaseItem's
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
  get chainPending () {
    return this.pendingOperations.length > 0;
  }
  cancelChain () {
    this.pendingOperations = [];
    return this;
  }
  async execute (operation, inputOptions) {
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

  async getAvailableOperations () {
    if (this._summaryCaches && this._summaryCaches.availableOps) {
      return this._summaryCaches.availableOps;
    }
    let availableOps = {};
    let opList = Object.entries(this.mure.OPERATIONS)
      .reduce((agg, [opFamilyName, opFamily]) => {
        return agg.concat(Object.entries(opFamily).map(([opName, op]) => {
          return { opFamilyName, opName, op };
        }));
      }, []);
    let inputSpecs = await Promise.all(opList.map(({ op }) => {
      return op.inferSelectionInputs(this);
    }));
    inputSpecs.forEach((spec, i) => {
      let { opFamilyName, opName } = opList[i];
      availableOps[opFamilyName] = availableOps[opFamilyName] || {};
      availableOps[opFamilyName][opName] = spec;
    });
    this._summaryCaches = this._summaryCaches || {};
    this._summaryCaches.availableOps = availableOps;
    return availableOps;
  }
  async histograms (numBins = 10) {
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
          counters.quantitativeItems = [];
          counters.quantitativeType = item.type;
          if (item instanceof this.mure.ITEM_TYPES.NumberItem) {
            counters.quantitativeScale = this.mure.d3.scaleLinear()
              .domain([item.value, item.value]);
          } else if (item instanceof this.mure.ITEM_TYPES.DateItem) {
            counters.quantitativeScale = this.mure.d3.scaleTime()
              .domain([item.value, item.value]);
          } else {
            // The first value is non-quantitative; this likely isn't a quantitative attribute
            counters.quantitativeBins = null;
            delete counters.quantitativeItems;
            delete counters.quantitativeType;
            delete counters.quantitativeScale;
          }
        } else if (counters.quantitativeType !== item.type) {
          // Encountered an item of a different type; this likely isn't a quantitative attribute
          counters.quantitativeBins = null;
          delete counters.quantitativeItems;
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
      if (item instanceof this.mure.ITEM_TYPES.PrimitiveItem) {
        countPrimitive(result.raw, item);
      } else {
        if (item.contentItems) {
          (await item.contentItems()).forEach(childItem => {
            const counters = result.attributes[childItem.label] = result.attributes[childItem.label] || {
              typeBins: {},
              categoricalBins: {},
              quantitativeBins: []
            };
            counters.typeBins[childItem.type] = (counters.typeBins[childItem.type] || 0) + 1;
            if (childItem instanceof this.mure.ITEM_TYPES.PrimitiveItem) {
              countPrimitive(counters, childItem);
            }
          });
        }
        // TODO: collect more statistics, such as node degree, set size
        // (and a set's members' attributes, similar to contentItems?)
      }
    }

    const finalizeBins = counters => {
      // Clear out anything that didn't see any values
      if (counters.typeBins && Object.keys(counters.typeBins).length === 0) {
        counters.typeBins = null;
      }
      if (counters.categoricalBins &&
          Object.keys(counters.categoricalBins).length === 0) {
        counters.categoricalBins = null;
      }
      if (counters.quantitativeBins) {
        if (!counters.quantitativeItems ||
             counters.quantitativeItems.length === 0) {
          counters.quantitativeBins = null;
          delete counters.quantitativeItems;
          delete counters.quantitativeType;
          delete counters.quantitativeScale;
        } else {
          // Calculate quantitative bin sizes and their counts
          // Clean up the scale a bit
          counters.quantitativeScale.nice();
          // Histogram generator
          const histogramGenerator = this.mure.d3.histogram()
            .domain(counters.quantitativeScale.domain())
            .thresholds(counters.quantitativeScale.ticks(numBins))
            .value(d => d.value);
          counters.quantitativeBins = histogramGenerator(counters.quantitativeItems);
          // Clean up some of the temporary placeholders
          delete counters.quantitativeItems;
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

  /*
   These functions are useful for deriving additional selections
   */
  deriveSelection (selectorList, options = { mode: this.mure.DERIVE_MODES.REPLACE }) {
    if (options.mode === this.mure.DERIVE_MODES.UNION) {
      selectorList = selectorList.concat(this.selectorList);
    } else if (options.mode === this.mure.DERIVE_MODES.XOR) {
      selectorList = selectorList.filter(selector => this.selectorList.indexOf(selector) === -1)
        .concat(this.selectorList.filter(selector => selectorList.indexOf(selector) === -1));
    } // else if (options.mode === DERIVE_MODES.REPLACE) { // do nothing }
    return new Selection(this.mure, selectorList, options);
  }
  merge (otherSelection, options = {}) {
    Object.assign(options, { mode: this.mure.DERIVE_MODES.UNION });
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
