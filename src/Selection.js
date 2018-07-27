import md5 from 'blueimp-md5';

class Selection {
  constructor (mure, selectorList = ['@']) {
    this.mure = mure;

    if (!(selectorList instanceof Array)) {
      selectorList = [ selectorList ];
    }

    // Parse the selectors
    this.tokenLists = selectorList.map(selectorString => {
      const tokenList = mure.parseSelector(selectorString);
      if (tokenList === null) {
        throw new SyntaxError(`Invalid selector: ${selectorString}`);
      }
      return tokenList;
    });

    // TODO: merge / optimize this.tokenLists
  }
  get hash () {
    if (!this._hash) {
      this._hash = md5(JSON.stringify(this.selectorList));
    }
    return this._hash;
  }
  get selectorList () {
    return this.tokenLists.map(tokenList => tokenList.join(''));
  }
  async * iterate ({ startWithPath = [this.mure.root], mode = 'DFS' }) {
    if (mode === 'BFS') {
      throw new Error(`Breadth-first iteration is not yet implemented.`);
    } else if (mode === 'DFS') {
      for (let tokenList of this.tokenLists) {
        const deepHelper = this.deepHelper(tokenList, startWithPath, mode, tokenList.length - 1);
        for await (let finishedPath of deepHelper) {
          yield finishedPath;
        }
      }
    }
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  async * deepHelper (tokenList, path0, mode, i) {
    if (i === 0) {
      yield * await tokenList[0].navigate(path0);
    } else {
      for await (let pathI of this.deepHelper(tokenList, path0, mode, i - 1)) {
        yield * await tokenList[i].navigate(pathI);
      }
    }
  }
  async * sample ({ limit = Infinity, mode = 'BFS', wrap = true, aggressive }) {
    let count = 0;
    let metaSelection;
    if (wrap) {
      metaSelection = this.subSelectAll('⌘');
    }
    for await (let path of this.iterate({ mode })) {
      if (count >= limit) {
        return;
      }
      count++;
      const value = path[path.length - 1];
      if (wrap) {
        let metaData = {};
        for await (let metaPath of metaSelection.iterate()) {
          this.augmentMetaDataObject(metaData, metaPath);
        }
        yield this.mure.wrap({ value, path, metaData, aggressive });
      } else {
        yield value;
      }
    }
  }
  augmentMetaDataObject (obj, path) {
    let currentObj = obj;
    for (let i = 0; i < path.length - 2; i++) {
      if (i % 2 === 0) {
        if (typeof path[i] !== 'object') {
          throw new Error(`Bad meta path: ${path}`);
        }
      } else {
        if (typeof path[i] !== 'string' && typeof path[i] !== 'number') {
          throw new Error(`Bad meta path: ${path}`);
        }
        if (i === path.length - 3) {
          // Skip the target path selector key; instead, strap the final object
          // on directly
          currentObj[path[i]] = path[path.length - 1];
        } else {
          currentObj[path[i]] = currentObj[path[i]] || {};
          currentObj = currentObj[path[i]];
        }
      }
    }
  }

  /*
   Shortcuts for selection manipulation
   */
  subSelectAll (append, mode = 'Replace') {
    return this.selectAll({ context: 'Selector', append, mode });
  }
  merge (otherSelection) {
    return this.selectAll({ context: 'Selection', otherSelection, mode: 'Union' });
  }

  // TODO: continue here!

  async execute (operation, inputOptions) {
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
   These functions provide statistics / summaries of the selection:
   */
  async getPopulatedInputSpec (operation) {
    if (this._summaryCaches && this._summaryCaches.inputSpecs &&
        this._summaryCaches.inputSpecs[operation.type]) {
      return this._summaryCaches.inputSpecs[operation.type];
    }

    const inputSpec = operation.getInputSpec();
    await inputSpec.populateChoicesFromSelection(this);

    this._summaryCaches = this._summaryCaches || {};
    this._summaryCaches.inputSpecs = this._summaryCaches.inputSpecs || {};
    this._summaryCaches.inputSpecs[operation.type] = inputSpec;
    return inputSpec;
  }
  async histograms (numBins = 20) {
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
            counters.quantitativeScale = this.mure.d3.scaleLinear()
              .domain([item.value, item.value]);
          } else if (item instanceof this.mure.WRAPPERS.DateWrapper) {
            counters.quantitativeScale = this.mure.d3.scaleTime()
              .domain([item.value, item.value]);
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
      if (counters.categoricalBins &&
          Object.keys(counters.categoricalBins).length === 0) {
        counters.categoricalBins = null;
      }
      if (counters.quantitativeBins) {
        if (!counters.quantitativeWrappers ||
             counters.quantitativeWrappers.length === 0) {
          counters.quantitativeBins = null;
          delete counters.quantitativeWrappers;
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
  async getFlatGraphSchema () {
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
          let pseudoEdge = result.edgeClasses[edgeClassName] =
            result.edgeClasses[edgeClassName] || { $nodes: {} };
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
          let pseudoNode = result.nodeClasses[nodeClassName] =
            result.nodeClasses[nodeClassName] || { count: 0, $edges: {} };
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
  async getIntersectedGraphSchema () {
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
export default Selection;
