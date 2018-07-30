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

    // Quick merge / optimize this.tokenLists (not exhaustive on purpose):
    let i = 0;
    while (i < this.tokenLists.length - 1) {
      const merged = this.mergeTokenLists(this.tokenLists[i], this.tokenLists[i + 1]);
      if (merged) {
        this.tokenLists.splice(1);
        this.tokenLists[i] = merged;
      } else {
        i++;
      }
    }
  }
  mergeTokenLists (a, b) {
    if (a.length !== b.length) {
      return null;
    } else {
      const result = [];
      if (!a.every((aToken, i) => {
        const temp = a.merge(b[i]);
        result.push(temp);
        return temp;
      })) { return null; }
      return result;
    }
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
  async * sample ({ limit = Infinity, mode = 'BFS', aggressive }) {
    let count = 0;
    let metaSelection = this.subSelectAll('⌘');
    for await (let path of this.iterate({ mode })) {
      if (count >= limit) {
        return;
      }
      count++;
      let value = path[path.length - 1];
      let metaData = {};
      for await (let metaPath of metaSelection.iterate()) {
        this.augmentMetaDataObject(metaData, metaPath);
      }
      yield this.mure.wrap({ value, path, metaData, aggressive });
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

  async execute (operation, inputOptions) {
    let outputSpec = await operation.executeOnSelection(this, inputOptions);

    // Return this selection, or a new selection, depending on the operation
    if (outputSpec.newSelectors !== null) {
      return new Selection(this.mure, outputSpec.newSelectors);
    } else {
      return this;
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

  /*
   These functions provide statistics / summaries of the selection:
   */
  async getPopulatedInputSpec (operation) {
    const inputSpec = operation.getInputSpec();
    await inputSpec.populateChoicesFromSelection(this);
    return inputSpec;
  }
  async histograms ({ numBins = 20, limit, mode, aggressive }) {
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

    for await (let item of this.sample({ limit, mode, aggressive })) {
      result.raw.typeBins[item.type] = (result.raw.typeBins[item.type] || 0) + 1;
      if (item instanceof this.mure.WRAPPERS.PrimitiveWrapper) {
        countPrimitive(result.raw, item);
      } else if (item instanceof this.mure.WRAPPERS.ContainerMixin) {
        for await (let childItem of item.iterateContents()) {
          const counters = result.attributes[childItem.key] = result.attributes[childItem.key] || {
            typeBins: {},
            categoricalBins: {},
            quantitativeBins: []
          };
          counters.typeBins[childItem.type] = (counters.typeBins[childItem.type] || 0) + 1;
          if (childItem instanceof this.mure.WRAPPERS.PrimitiveWrapper) {
            countPrimitive(counters, childItem);
          }
        }
        // TODO: collect more statistics, such as node degree, set size
        // (and a set's members' attributes, similar to getContents?)
      } // TODO: else if (item instanceof this.mure.WRAPPERS.SetMixin) {}
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

    return result;
  }
}
export default Selection;
