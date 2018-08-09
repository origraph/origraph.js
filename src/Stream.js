import md5 from 'blueimp-md5';

const DEFAULT_FUNCTIONS = {
  identity: function * (item, path) { yield item; },
  md5: (item, path) => md5(item),
  noop: () => {}
};

class Stream {
  constructor ({ mure, selector = 'root', functions = {}, streams = {}, mode = 'permissive' }) {
    this.mure = mure;

    this.tokenList = this.parseSelector(selector);

    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.mode = mode;
  }
  get selector () {
    return this.tokenList.join('');
  }
  parseSelector (selectorString) {
    if (!selectorString.startsWith('root')) {
      return null;
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenList = [];
    tokenStrings.forEach(chunk => {
      const temp = chunk.match(/^.([^(]*)\(([^)]*)\)/);
      if (!temp) {
        throw new SyntaxError(`Invalid token: ${chunk}`);
      }
      const tokenClassName = temp[1][0].toUpperCase() + temp[1].slice(1) + 'Token';
      const argList = temp[2].split(/(?<!\\),/).map(d => d.trim());
      if (tokenClassName === 'ValuesToken') {
        tokenList.push(new this.mure.TOKENS.KeysToken(this, argList));
        tokenList.push(new this.mure.TOKENS.ValueToken(this, []));
      } else if (this.mure.TOKENS[tokenClassName]) {
        tokenList.push(new this.mure.TOKENS[tokenClassName](this, argList));
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenList;
  }
  async * iterate ({ mode = 'DFS' }) {
    if (mode === 'BFS') {
      throw new Error(`Breadth-first iteration is not yet implemented.`);
    } else if (mode === 'DFS') {
      const deepHelper = this.deepHelper(this.tokenList, mode, [this.mure.root], this.tokenList.length - 1);
      for await (const finishedPath of deepHelper) {
        yield finishedPath;
      }
    }
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  async * deepHelper (tokenList, mode, path0, i) {
    if (i === 0) {
      yield * await tokenList[0].navigate(path0);
    } else {
      for await (let pathI of this.deepHelper(tokenList, path0, mode, i - 1)) {
        yield * await tokenList[i].navigate(pathI);
      }
    }
  }

  // TODO: continue here!

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
