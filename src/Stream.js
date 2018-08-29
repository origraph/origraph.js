class Stream {
  constructor (options) {
    this.mure = options.mure;
    this.namedFunctions = Object.assign({},
      this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams || {};
    this.launchedFromClass = options.launchedFromClass || null;
    this.tokenClassList = options.tokenClassList || [];

    // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams
    this.tokenList = options.tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    // Reminder: this always needs to be after initializing this.tokenList
    this.Wrappers = this.getWrapperList();

    // TODO: preserve these somehow?
    this.indexes = {};
  }

  getWrapperList () {
    // Look up which, if any, classes describe the result of each token, so that
    // we can wrap items appropriately:
    return this.tokenList.map((token, index) => {
      if (index === this.tokenList.length - 1 && this.launchedFromClass) {
        // If this stream was started from a class, we already know we should
        // use that class's wrapper for the last token
        return this.launchedFromClass.Wrapper;
      }
      // Find a class that describes exactly each series of tokens
      const localTokenList = this.tokenList.slice(0, index + 1);
      const potentialWrappers = Object.values(this.mure.classes)
        .filter(classObj => {
          const classTokenList = classObj.tokenClassList;
          if (!classTokenList.length !== localTokenList.length) {
            return false;
          }
          return localTokenList.every((localToken, localIndex) => {
            const tokenClassSpec = classTokenList[localIndex];
            return localToken instanceof tokenClassSpec.TokenClass &&
              token.isSubsetOf(tokenClassSpec.argList);
          });
        });
      if (potentialWrappers.length === 0) {
        // No classes describe this series of tokens, so use the generic wrapper
        return this.mure.WRAPPERS.GenericWrapper;
      } else {
        if (potentialWrappers.length > 1) {
          console.warn(`Multiple classes describe the same item! Arbitrarily choosing one...`);
        }
        return potentialWrappers[0].Wrapper;
      }
    });
  }

  get selector () {
    return this.tokenList.join('');
  }

  fork (selector) {
    return new Stream({
      mure: this.mure,
      namedFunctions: this.namedFunctions,
      namedStreams: this.namedStreams,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass
    });
  }

  extend (TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.namedStreams = Object.assign({}, this.namedStreams, options.namedStreams || {});
    options.tokenClassList = this.tokenClassList.concat([{ TokenClass, argList }]);
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    return new Stream(options);
  }

  wrap ({ wrappedParent, token, rawItem, hashes = {} }) {
    let wrapperIndex = 0;
    let temp = wrappedParent;
    while (temp !== null) {
      wrapperIndex += 1;
      temp = temp.wrappedParent;
    }
    const wrappedItem = new this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
    return wrappedItem;
  }

  getIndex (hashFunctionName, token) {
    if (!this.indexes[hashFunctionName]) {
      this.indexes[hashFunctionName] = {};
    }
    const tokenIndex = this.tokenList.indexOf(token);
    if (!this.indexes[hashFunctionName][tokenIndex]) {
      // TODO: figure out external indexes...
      this.indexes[hashFunctionName][tokenIndex] = new this.mure.INDEXES.InMemoryIndex();
    }
    return this.indexes[hashFunctionName][tokenIndex];
  }

  async * iterate () {
    const lastToken = this.tokenList[this.tokenList.length - 1];
    const temp = this.tokenList.slice(0, this.tokenList.length - 1);
    yield * await lastToken.iterate(temp);
  }

  async * sample ({ limit = 10, rebuildIndexes = false }) {
    const iterator = this.iterate();
    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();
      if (temp.done) {
        break;
      }
      yield temp.value;
    }
  }
}
export default Stream;
