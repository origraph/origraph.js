class Stream {
  constructor ({
    mure,
    tokenClassList,
    namedFunctions = {},
    traversalMode = 'DFS',
    launchedFromClass = null
  }) {
    this.mure = mure;
    this.namedFunctions = namedFunctions;
    this.traversalMode = traversalMode;
    this.tokenList = tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    this.launchedFromClass = launchedFromClass;
    this.Wrappers = this.getWrapperList();
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
          if (!classObj.tokenClassList.length !== localTokenList.length) {
            return false;
          }
          return localTokenList.every((localToken, localIndex) => {
            const tokenClassSpec = classObj.tokenClassList[localIndex];
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
      traversalMode: this.traversalMode,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass
    });
  }

  extend (TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.tokenClassList = this.tokenClassList.concat({ TokenClass, argList });
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.traversalMode = options.traversalMode || this.traversalMode;
    return new Stream(options);
  }

  wrap ({ wrappedParent, token, rawItem }) {
    let wrapperIndex = 0;
    let temp = wrappedParent;
    while (temp !== null) {
      wrapperIndex += 1;
      temp = temp.wrappedParent;
    }
    return new this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
  }

  async * iterate () {
    if (this.traversalMode === 'BFS') {
      throw new Error(`Breadth-first iteration is not yet implemented.`);
    } else if (this.traversalMode === 'DFS') {
      const deepHelper = this.deepHelper(this.tokenList, this.tokenList.length - 1);
      for await (const wrappedItem of deepHelper) {
        if (!(wrappedItem instanceof this.mure.WRAPPERS.GenericWrapper)) {
          if (this.mure.debug) {
            console.warn(wrappedItem);
          }
        } else {
          yield wrappedItem;
        }
      }
    } else {
      throw new Error(`Unknown traversalMode: ${this.traversalMode}`);
    }
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  async * deepHelper (tokenList, i) {
    if (i === 0) {
      yield * await tokenList[0].navigate(); // The first token is always the root
    } else {
      let parentYieldedSomething = false;
      for await (let wrappedParent of this.deepHelper(tokenList, i - 1)) {
        parentYieldedSomething = true;
        if (wrappedParent instanceof this.mure.WRAPPERS.GenericWrapper) {
          const iterator = await tokenList[i].navigate(wrappedParent);
          yield * iterator;
        } else {
          yield wrappedParent;
        }
      }
      if (this.mure.debug && !parentYieldedSomething) {
        yield `Token yielded nothing: ${tokenList[i - 1]}`;
      }
    }
  }

  async * sample ({ limit = 10 }) {
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
