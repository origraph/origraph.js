import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this.eventHandlers = {};
      this.stickyTriggers = {};
    }

    on(eventName, callback, allowDuplicateListeners) {
      if (!this.eventHandlers[eventName]) {
        this.eventHandlers[eventName] = [];
      }

      if (!allowDuplicateListeners) {
        if (this.eventHandlers[eventName].indexOf(callback) !== -1) {
          return;
        }
      }

      this.eventHandlers[eventName].push(callback);
    }

    off(eventName, callback) {
      if (this.eventHandlers[eventName]) {
        if (!callback) {
          delete this.eventHandlers[eventName];
        } else {
          let index = this.eventHandlers[eventName].indexOf(callback);

          if (index >= 0) {
            this.eventHandlers[eventName].splice(index, 1);
          }
        }
      }
    }

    trigger(eventName, ...args) {
      if (this.eventHandlers[eventName]) {
        this.eventHandlers[eventName].forEach(callback => {
          setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || {
        argObj: {}
      };
      Object.assign(this.stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this.stickyTriggers.timeout);
      this.stickyTriggers.timeout = setTimeout(() => {
        let argObj = this.stickyTriggers[eventName].argObj;
        delete this.stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }

  };
};

Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

class Stream {
  constructor(options) {
    this.mure = options.mure;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams || {};
    this.launchedFromClass = options.launchedFromClass || null;
    this.tokenClassList = options.tokenClassList || []; // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams

    this.tokenList = options.tokenClassList.map(({
      TokenClass,
      argList
    }) => {
      return new TokenClass(this, argList);
    }); // Reminder: this always needs to be after initializing this.tokenList

    this.Wrappers = this.getWrapperList(); // TODO: preserve these somehow?

    this.indexes = {};
  }

  getWrapperList() {
    // Look up which, if any, classes describe the result of each token, so that
    // we can wrap items appropriately:
    return this.tokenList.map((token, index) => {
      if (index === this.tokenList.length - 1 && this.launchedFromClass) {
        // If this stream was started from a class, we already know we should
        // use that class's wrapper for the last token
        return this.launchedFromClass.Wrapper;
      } // Find a class that describes exactly each series of tokens


      const localTokenList = this.tokenList.slice(0, index + 1);
      const potentialWrappers = Object.values(this.mure.classes).filter(classObj => {
        const classTokenList = classObj.tokenClassList;

        if (!classTokenList.length !== localTokenList.length) {
          return false;
        }

        return localTokenList.every((localToken, localIndex) => {
          const tokenClassSpec = classTokenList[localIndex];
          return localToken instanceof tokenClassSpec.TokenClass && token.isSubsetOf(tokenClassSpec.argList);
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

  get selector() {
    return this.tokenList.join('');
  }

  fork(selector) {
    return new Stream({
      mure: this.mure,
      namedFunctions: this.namedFunctions,
      namedStreams: this.namedStreams,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.namedStreams = Object.assign({}, this.namedStreams, options.namedStreams || {});
    options.tokenClassList = this.tokenClassList.concat([{
      TokenClass,
      argList
    }]);
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    return new Stream(options);
  }

  wrap({
    wrappedParent,
    token,
    rawItem,
    hashes = {}
  }) {
    let wrapperIndex = 0;
    let temp = wrappedParent;

    while (temp !== null) {
      wrapperIndex += 1;
      temp = temp.wrappedParent;
    }

    const wrappedItem = new this.Wrappers[wrapperIndex]({
      wrappedParent,
      token,
      rawItem
    });
    return wrappedItem;
  }

  getIndex(hashFunctionName, token) {
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

  async *iterate() {
    const lastToken = this.tokenList[this.tokenList.length - 1];
    const temp = this.tokenList.slice(0, this.tokenList.length - 1);
    yield* await lastToken.iterate(temp);
  }

  async *sample({
    limit = 10,
    rebuildIndexes = false
  }) {
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
  // This can / should be overridden by subclasses that follow a common string
  // pattern, such as RootToken, KeysToken, ParentToken, etc.
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

class BaseToken extends Introspectable {
  constructor(stream) {
    super();
    this.stream = stream;
  }

  toString() {
    // The string version of most tokens can just be derived from the class type
    return `.${this.type.toLowerCase()}()`;
  }

  isSubSetOf() {
    // By default (without any arguments), tokens of the same class are subsets
    // of each other
    return true;
  }

  async *iterate(ancestorTokens) {
    throw new Error(`This function should be overridden`);
  }

  async *iterateParent(ancestorTokens) {
    const parentToken = ancestorTokens[ancestorTokens.length - 1];
    const temp = ancestorTokens.slice(0, ancestorTokens.length - 1);
    let yieldedSomething = false;

    for await (const wrappedParent of parentToken.iterate(temp)) {
      yieldedSomething = true;
      yield wrappedParent;
    }

    if (!yieldedSomething && this.stream.mure.debug) {
      throw new TypeError(`Token yielded no results: ${parentToken}`);
    }
  }

  async wrap({
    wrappedParent,
    rawItem
  }) {
    // IndexedToken overrides with an async function
    return this.stream.wrap({
      wrappedParent,
      token: this,
      rawItem
    });
  }

}

Object.defineProperty(BaseToken, 'type', {
  get() {
    return /(.*)Token/.exec(this.name)[1];
  }

});

class EmptyToken extends BaseToken {
  async *iterate() {// yield nothing
  }

  toString() {
    return `empty`;
  }

}

class RootToken extends BaseToken {
  async *iterate() {
    yield this.wrap({
      wrappedParent: null,
      rawItem: this.stream.mure.root
    });
  }

  toString() {
    return `root`;
  }

}

class KeysToken extends BaseToken {
  constructor(stream, argList, {
    matchAll,
    keys,
    ranges
  } = {}) {
    super(stream);

    if (keys || ranges) {
      this.keys = keys;
      this.ranges = ranges;
    } else if (argList && argList.length === 1 && argList[0] === undefined || matchAll) {
      this.matchAll = true;
    } else {
      argList.forEach(arg => {
        let temp = arg.match(/(\d+)-([\d∞]+)/);

        if (temp && temp[2] === '∞') {
          temp[2] = Infinity;
        }

        temp = temp ? temp.map(d => d.parseInt(d)) : null;

        if (temp && !isNaN(temp[1]) && !isNaN(temp[2])) {
          for (let i = temp[1]; i <= temp[2]; i++) {
            this.ranges = this.ranges || [];
            this.ranges.push({
              low: temp[1],
              high: temp[2]
            });
          }

          return;
        }

        temp = arg.match(/'(.*)'/);
        temp = temp && temp[1] ? temp[1] : arg;
        let num = Number(temp);

        if (isNaN(num) || num !== parseInt(temp)) {
          // leave non-integer numbers as strings
          this.keys = this.keys || {};
          this.keys[temp] = true;
        } else {
          this.ranges = this.ranges || [];
          this.ranges.push({
            low: num,
            high: num
          });
        }
      });

      if (!this.keys && !this.ranges) {
        throw new SyntaxError(`Bad token key(s) / range(s): ${JSON.stringify(argList)}`);
      }
    }

    if (this.ranges) {
      this.ranges = this.consolidateRanges(this.ranges);
    }
  }

  get selectsNothing() {
    return !this.matchAll && !this.keys && !this.ranges;
  }

  consolidateRanges(ranges) {
    // Merge any overlapping ranges
    const newRanges = [];
    const temp = ranges.sort((a, b) => a.low - b.low);
    let currentRange = null;

    for (let i = 0; i < temp.length; i++) {
      if (!currentRange) {
        currentRange = temp[i];
      } else if (temp[i].low <= currentRange.high) {
        currentRange.high = temp[i].high;
      } else {
        newRanges.push(currentRange);
        currentRange = temp[i];
      }
    }

    if (currentRange) {
      // Corner case: add the last range
      newRanges.push(currentRange);
    }

    return newRanges.length > 0 ? newRanges : undefined;
  }

  difference(otherToken) {
    // Compute what is left of this after subtracting out everything in otherToken
    if (!(otherToken instanceof KeysToken)) {
      throw new Error(`Can't compute the difference of two different token types`);
    } else if (otherToken.matchAll) {
      return null;
    } else if (this.matchAll) {
      console.warn(`Inaccurate difference computed! TODO: need to figure out how to invert categorical keys!`);
      return this;
    } else {
      const newKeys = {};

      for (let key in this.keys || {}) {
        if (!otherToken.keys || !otherToken.keys[key]) {
          newKeys[key] = true;
        }
      }

      let newRanges = [];

      if (this.ranges) {
        if (otherToken.ranges) {
          let allPoints = this.ranges.reduce((agg, range) => {
            return agg.concat([{
              include: true,
              low: true,
              value: range.low
            }, {
              include: true,
              high: true,
              value: range.high
            }]);
          }, []);
          allPoints = allPoints.concat(otherToken.ranges.reduce((agg, range) => {
            return agg.concat([{
              exclude: true,
              low: true,
              value: range.low
            }, {
              exclude: true,
              high: true,
              value: range.high
            }]);
          }, [])).sort();
          let currentRange = null;

          for (let i = 0; i < allPoints.length; i++) {
            if (currentRange === null) {
              if (allPoints[i].include && allPoints[i].low) {
                currentRange = {
                  low: allPoints[i].value
                };
              }
            } else if (allPoints[i].include && allPoints[i].high) {
              currentRange.high = allPoints[i].value;

              if (currentRange.high >= currentRange.low) {
                newRanges.push(currentRange);
              }

              currentRange = null;
            } else if (allPoints[i].exclude) {
              if (allPoints[i].low) {
                currentRange.high = allPoints[i].low - 1;

                if (currentRange.high >= currentRange.low) {
                  newRanges.push(currentRange);
                }

                currentRange = null;
              } else if (allPoints[i].high) {
                currentRange.low = allPoints[i].high + 1;
              }
            }
          }
        } else {
          newRanges = this.ranges;
        }
      }

      return new KeysToken(this.mure, null, {
        keys: newKeys,
        ranges: newRanges
      });
    }
  }

  isSubSetOf(argList) {
    const otherToken = new KeysToken(this.stream, argList);
    const diff = otherToken.difference(this);
    return diff === null || diff.selectsNothing;
  }

  toString() {
    if (this.matchAll) {
      return '.keys()';
    }

    return '.keys(' + (this.ranges || []).map(({
      low,
      high
    }) => {
      return low === high ? low : `${low}-${high}`;
    }).concat(Object.keys(this.keys || {}).map(key => `'${key}'`)).join(',') + ')';
  }

  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      if (typeof wrappedParent.rawItem !== 'object') {
        if (!this.stream.mure.debug) {
          throw new TypeError(`Input to KeysToken is not an object`);
        } else {
          continue;
        }
      }

      if (this.matchAll) {
        for (let key in wrappedParent.rawItem) {
          yield this.wrap({
            wrappedParent,
            rawItem: key
          });
        }
      } else {
        for (let {
          low,
          high
        } of this.ranges || []) {
          low = Math.max(0, low);
          high = Math.min(wrappedParent.rawItem.length - 1, high);

          for (let i = low; i <= high; i++) {
            if (wrappedParent.rawItem[i] !== undefined) {
              yield this.wrap({
                wrappedParent,
                rawItem: i
              });
            }
          }
        }

        for (let key in this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield this.wrap({
              wrappedParent,
              rawItem: key
            });
          }
        }
      }
    }
  }

}

class ValueToken extends BaseToken {
  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
      const key = wrappedParent && wrappedParent.rawItem;
      const keyType = typeof key;

      if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
        if (!this.stream.mure.debug) {
          throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
        } else {
          continue;
        }
      }

      yield this.wrap({
        wrappedParent,
        rawItem: obj[key]
      });
    }
  }

}

class EvaluateToken extends BaseToken {
  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      if (typeof wrappedParent.rawItem !== 'string') {
        if (!this.stream.mure.debug) {
          throw new TypeError(`Input to EvaluateToken is not a string`);
        } else {
          continue;
        }
      }

      let newStream;

      try {
        newStream = this.stream.fork(wrappedParent.rawItem);
      } catch (err) {
        if (!this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          continue;
        }
      }

      yield* await newStream.iterate();
    }
  }

}

class MapToken extends BaseToken {
  constructor(stream, [generator = 'identity']) {
    super(stream);

    if (!stream.namedFunctions[generator]) {
      throw new SyntaxError(`Unknown named function: ${generator}`);
    }

    this.generator = generator;
  }

  toString() {
    return `.map(${this.generator})`;
  }

  isSubSetOf([generator = 'identity']) {
    return generator === this.generator;
  }

  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      for await (const mappedRawItem of this.stream.namedFunctions[this.generator](wrappedParent)) {
        yield this.wrap({
          wrappedParent,
          rawItem: mappedRawItem
        });
      }
    }
  }

}

class IndexedToken extends BaseToken {
  async wrap({
    wrappedParent,
    rawItem,
    hashes = {}
  }) {
    const wrappedItem = await super.wrap({
      wrappedParent,
      rawItem
    });

    for (const [hashFuncName, hash] of Object.entries(hashes)) {
      const index = this.stream.getIndex(hashFuncName, this);
      await index.addValue(hash, wrappedItem);
    }

    return wrappedItem;
  }

}

class PromoteToken extends IndexedToken {
  constructor(stream, [map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    super(stream);

    for (const func of [map, hash, reduceInstances]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    this.map = map;
    this.hash = hash;
    this.reduceInstances = reduceInstances;
  }

  toString() {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }

  isSubSetOf([map = 'identity', hash = 'sha1', reduceInstances = 'noop']) {
    return this.map === map && this.hash === hash && this.reduceInstances === reduceInstances;
  }

  async *iterate(ancestorTokens) {
    for await (const wrappedParent of this.iterateParent(ancestorTokens)) {
      const mapFunction = this.stream.namedFunctions[this.map];
      const hashFunction = this.stream.namedFunctions[this.hash];
      const reduceInstancesFunction = this.stream.namedFunctions[this.reduceInstances];
      const hashIndex = this.stream.getIndex(this.hash, this);

      for await (const mappedRawItem of mapFunction(wrappedParent)) {
        const hash = hashFunction(mappedRawItem);
        let originalWrappedItem = (await hashIndex.getValueList(hash))[0];

        if (originalWrappedItem) {
          if (this.reduceInstances !== 'noop') {
            reduceInstancesFunction(originalWrappedItem, mappedRawItem);
            originalWrappedItem.trigger('update');
          }
        } else {
          const hashes = {};
          hashes[this.hash] = hash;
          yield this.wrap({
            wrappedParent,
            rawItem: mappedRawItem,
            hashes
          });
        }
      }
    }
  }

}

class JoinToken extends IndexedToken {
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish', edgeRole = 'none']) {
    super(stream);

    for (const func of [thisHash, finish]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    const temp = stream.namedStreams[otherStream];

    if (!temp) {
      throw new SyntaxError(`Unknown named stream: ${otherStream}`);
    } // Require otherHash on the other stream, or copy ours over if it isn't
    // already defined


    if (!temp.namedFunctions[otherHash]) {
      if (!stream.namedFunctions[otherHash]) {
        throw new SyntaxError(`Unknown hash function on either stream: ${otherHash}`);
      } else {
        temp.namedFunctions[otherHash] = stream.namedFunctions[otherHash];
      }
    }

    this.otherStream = otherStream;
    this.thisHash = thisHash;
    this.otherHash = otherHash;
    this.finish = finish;
    this.edgeRole = edgeRole;
    this.hashThisGrandparent = edgeRole === 'full';
  }

  toString() {
    return `.join(${this.otherStream}, ${this.thisHash}, ${this.otherHash}, ${this.finish})`;
  }

  isSubSetOf([otherStream, thisHash = 'key', otherHash = 'key', finish = 'identity']) {
    return this.otherStream === otherStream && this.thisHash === thisHash && this.otherHash === otherHash && this.finish === finish;
  }

  async *iterate(ancestorTokens) {
    const otherStream = this.stream.namedStreams[this.otherStream];
    const thisHashFunction = this.stream.namedFunctions[this.thisHash];
    const otherHashFunction = otherStream.namedFunctions[this.otherHash];
    const finishFunction = this.stream.namedFunctions[this.finish];
    const thisIndex = this.stream.getIndex(this.thisHash, this);
    const otherIndex = otherStream.getIndex(this.otherHash, this);

    if (thisIndex.complete) {
      if (otherIndex.complete) {
        // Best of all worlds; we can just join the indexes
        for await (const {
          hash,
          valueList
        } of thisIndex.iterEntries()) {
          const otherList = await otherIndex.getValueList(hash);

          for await (const otherWrappedItem of otherList) {
            for await (const thisWrappedItem of valueList) {
              for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                yield this.wrap({
                  wrappedParent: thisWrappedItem,
                  rawItem
                });
              }
            }
          }
        }
      } else {
        // Need to iterate the other items, and take advantage of our complete
        // index
        for await (const otherWrappedItem of otherStream.iterate()) {
          for await (const hash of otherHashFunction(otherWrappedItem)) {
            // Add otherWrappedItem to otherIndex:
            await otherIndex.addValue(hash, otherWrappedItem);
            const thisList = await thisIndex.getValueList(hash);

            for await (const thisWrappedItem of thisList) {
              for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                yield this.wrap({
                  wrappedParent: thisWrappedItem,
                  rawItem
                });
              }
            }
          }
        }
      }
    } else {
      if (otherIndex.complete) {
        // Need to iterate our items, and take advantage of the other complete
        // index
        for await (const thisWrappedItem of this.iterateParent(ancestorTokens)) {
          // Odd corner case for edges; sometimes we want to hash the grandparent instead of the result of
          // an intermediate join:
          const thisHashItem = this.hashThisGrandparent ? thisWrappedItem.wrappedParent : thisWrappedItem;

          for await (const hash of thisHashFunction(thisHashItem)) {
            // add thisWrappedItem to thisIndex
            await thisIndex.addValue(hash, thisHashItem);
            const otherList = await otherIndex.getValueList(hash);

            for await (const otherWrappedItem of otherList) {
              for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                yield this.wrap({
                  wrappedParent: thisWrappedItem,
                  rawItem
                });
              }
            }
          }
        }
      } else {
        // Neither stream is fully indexed; for more distributed sampling, grab
        // one item from each stream at a time, and use the partial indexes
        const thisIterator = this.iterateParent(ancestorTokens, this.thisIndirectKey);
        let thisIsDone = false;
        const otherIterator = otherStream.iterate();
        let otherIsDone = false;

        while (!thisIsDone || !otherIsDone) {
          // Take one sample from this stream
          let temp = await thisIterator.next();

          if (temp.done) {
            thisIsDone = true;
          } else {
            const thisWrappedItem = await temp.value; // Odd corner case for edges; sometimes we want to hash the grandparent instead of the result of
            // an intermediate join:

            const thisHashItem = this.hashThisGrandparent ? thisWrappedItem.wrappedParent : thisWrappedItem;

            for await (const hash of thisHashFunction(thisHashItem)) {
              // add thisWrappedItem to thisIndex
              thisIndex.addValue(hash, thisHashItem);
              const otherList = await otherIndex.getValueList(hash);

              for await (const otherWrappedItem of otherList) {
                for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                  yield this.wrap({
                    wrappedParent: thisWrappedItem,
                    rawItem
                  });
                }
              }
            }
          } // Now for a sample from the other stream


          temp = await otherIterator.next();

          if (temp.done) {
            otherIsDone = true;
          } else {
            const otherWrappedItem = await temp.value;

            for await (const hash of otherHashFunction(otherWrappedItem)) {
              // add otherWrappedItem to otherIndex
              otherIndex.addValue(hash, otherWrappedItem);
              const thisList = await thisIndex.getValueList(hash);

              for await (const thisWrappedItem of thisList) {
                for await (const rawItem of finishFunction(thisWrappedItem, otherWrappedItem)) {
                  yield this.wrap({
                    wrappedParent: thisWrappedItem,
                    rawItem
                  });
                }
              }
            }
          }
        }
      }
    }
  }

}



var TOKENS = /*#__PURE__*/Object.freeze({
  EmptyToken: EmptyToken,
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken,
  JoinToken: JoinToken
});

const ASTERISKS = {
  'evaluate': '↬',
  'join': '⨯',
  'map': '↦',
  'promote': '↑',
  'value': '→'
};

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.customNameTokenIndex = options.customNameTokenIndex || null;
    this.annotations = options.annotations || [];
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});

    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      if (typeof func === 'string') {
        this.namedFunctions[funcName] = new Function(`return ${func}`)(); // eslint-disable-line no-new-func
      }
    }
  }

  get selector() {
    return this._selector;
  }

  get tokenClassList() {
    return this.mure.parseSelector(this.selector);
  }

  toRawObject() {
    const result = {
      classType: this.constructor.name,
      selector: this._selector,
      customClassName: this.customClassName,
      customNameTokenIndex: this.customNameTokenIndex,
      annotations: this.annotations,
      classId: this.classId,
      namedFunctions: {}
    };

    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
      // included in the stringification process during testing. See:
      // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

      stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
      result.namedFunctions[funcName] = stringifiedFunc;
    }

    return result;
  }

  setClassName(value) {
    if (this.customClassName !== value) {
      this.customClassName = value;
      this.customNameTokenIndex = this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
      this.mure.saveClasses();
    }
  }

  get hasCustomName() {
    return this.customClassName !== null && this.customNameTokenIndex === this.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
  }

  get className() {
    const selector = this.selector;
    const tokenStrings = selector.match(/\.([^(]*)\(([^)]*)\)/g);
    let result = '';

    for (let i = tokenStrings.length - 1; i >= 0; i--) {
      if (this.customClassName !== null && i <= this.customNameTokenIndex) {
        return this.customClassName + result;
      }

      const temp = tokenStrings[i].match(/^.([^(]*)\(([^)]*)\)/);

      if (temp[1] === 'keys' || temp[1] === 'values') {
        if (temp[2] === '') {
          result = '*' + result;
        } else {
          result = temp[2].replace(/'([^']*)'/, '$1') + result;
        }
      } else {
        result = ASTERISKS[temp[1]] + result;
      }
    }

    return (selector.startsWith('empty') ? '∅' : '') + result;
  }

  addHashFunction(funcName, func) {
    this.namedFunctions[funcName] = func;
  }

  addAttributeAsHashFunction(attrName) {
    this.namedFunctions[attrName] = function* (wrappedItem) {
      yield wrappedItem.rawItem[attrName];
    };
  }

  expandAttributeAsHashFunction(attrName, delimiter = ',') {
    this.namedFunctions[attrName] = function* (wrappedItem) {
      for (const value of wrappedItem.rawItem.split(delimiter)) {
        yield value.trim();
      }
    };
  }

  populateStreamOptions(options = {}) {
    options.mure = this.mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    return options;
  }

  getStream(options = {}) {
    return new Stream(this.populateStreamOptions(options));
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }

    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }

  interpretAsNodes() {
    const options = this.toRawObject();
    options.ClassType = this.mure.CLASSES.NodeClass;
    return this.mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this.toRawObject();
    options.ClassType = this.mure.CLASSES.EdgeClass;
    return this.mure.newClass(options);
  }

  aggregate(hash, reduce) {
    throw new Error(`unimplemented`);
  }

  expand(map) {
    throw new Error(`unimplemented`);
  }

  filter(filter) {
    throw new Error(`unimplemented`);
  }

  split(hash) {
    throw new Error(`unimplemented`);
  }

  delete() {
    delete this.mure.classes[this.classId];
    this.mure.saveClasses();
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
    this.edgeConnections = options.edgeConnections || {};
  }

  toRawObject() {
    const result = super.toRawObject();
    result.edgeConnections = this.edgeConnections;
    return result;
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    throw new Error(`unimplemented`);
    /*
    const edgeIds = Object.keys(this.edgeConnections);
    if (edgeIds.length > 2) {
      this.disconnectAllEdges();
    }
    const options = super.toRawObject();
    options.ClassType = this.mure.CLASSES.EdgeClass;
    const newEdgeClass = this.mure.createClass(options);
    if (edgeIds.length === 1 || edgeIds.length === 2) {
      const sourceEdgeClass = this.mure.classes[edgeIds[0]];
      newEdgeClass.sourceClassId = sourceEdgeClass.sourceClassId;
      newEdgeClass.sourceChain = sourceEdgeClass.
      newEdgeClass.glompSourceEdge(this.mure.classes[edgeIds[0]]);
    }
    if (edgeIds.length === 2) {
      newEdgeClass.glompTargetEdge(this.mure.classes[edgeIds[1]]);
    }
    this.mure.saveClasses();
    */
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    thisHashName,
    otherHashName
  }) {
    const newEdge = this.mure.createClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      sourceChain: {
        nodeHash: thisHashName,
        edgeHash: null
      },
      targetClassId: otherNodeClass.classId,
      targetHashName: {
        nodeHash: otherHashName,
        edgeHash: null
      },
      directed
    });
    this.edgeConnections[newEdge.classId] = true;
    otherNodeClass.edgeConnections[newEdge.classId] = true;
    this.mure.saveClasses();
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSources();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTargets();
      }

      delete this.edgeConnections[edgeClassId];
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class Chain {
  constructor({
    nodeHash = null,
    edgeHash = null,
    intermediates = []
  } = {}) {
    this.nodeHash = nodeHash;
    this.edgeHash = edgeHash;
    this.intermediates = intermediates;
  }

  toRawObject() {
    return {
      nodeHash: this.nodeHash,
      edgeHash: this.edgeHash,
      intermediates: this.intermediates
    };
  }

  split() {
    throw new Error(`unimplemented`); // return [ edgewardChain, nodewardChain ]
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.sourceChain = new Chain(options.sourceChain);
    this.targetClassId = options.targetClassId || null;
    this.targetChain = new Chain(options.targetChain);
    this.directed = options.directed || false;
  }

  toRawObject() {
    const result = super.toRawObject();
    result.sourceClassId = this.sourceClassId;
    result.sourceChain = this.sourceChain.toRawObject;
    result.targetClassId = this.targetClassId;
    result.targetChain = this.targetChain.toRawObject;
    result.directed = this.directed;
    return result;
  }

  get selector() {
    // TODO!
    return this._selector;
    /*
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];
     if (!this._selector) {
      if (!sourceClass || !targetClass) {
        throw new Error(`Partial connections without an edge table should never happen`);
      } else {
        // No edge table (simple join between two nodes)
        const sourceHash = sourceClass.edgeConnections[this.classId].nodeHashName;
        const targetHash = targetClass.edgeConnections[this.classId].nodeHashName;
        return sourceClass.selector + `.join(target, ${sourceHash}, ${targetHash}, defaultFinish, sourceTarget)`;
      }
    } else {
      let result = this._selector;
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return result;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, edgeTarget)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish, sourceEdge)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, full)`;
        return result;
      }
    }
    */
  }

  populateStreamOptions(options = {}) {
    const sourceClass = this.mure.classes[this.sourceClassId];
    const targetClass = this.mure.classes[this.targetClassId];
    options.namedStreams = {};

    if (!this._selector) {
      // Use the options from the source stream instead of our class
      options = sourceClass.populateStreamOptions(options);
      options.namedStreams.target = targetClass.getStream();
    } else {
      options = super.populateStreamOptions(options);

      if (sourceClass) {
        options.namedStreams.source = sourceClass.getStream();
      }

      if (targetClass) {
        options.namedStreams.target = targetClass.getStream();
      }
    }

    return options;
  }

  interpretAsNodes() {
    const options = super.toRawObject();
    options.ClassType = this.mure.CLASSES.NodeClass;
    const newNodeClass = this.mure.createClass(options);

    if (this.sourceClassId) {
      const sourceNodeClass = this.mure.classes[this.sourceClassId];
      let [targetChain, sourceChain] = this.sourceChain.split();
      const newSourceEdgeClass = this.mure.createClass({
        ClassType: this.mure.CLASSES.EdgeClass,
        sourceClassId: sourceNodeClass.classId,
        sourceChain: sourceChain.toRawObject(),
        targetClassId: newNodeClass.classId,
        targetChain: targetChain.toRawObject(),
        directed: this.directed
      });
      delete sourceNodeClass.edgeConnections[newNodeClass.classId];
      sourceNodeClass.edgeConnections[newSourceEdgeClass.classId] = true;
      newNodeClass.edgeConnections[newSourceEdgeClass.classId] = true;
    }

    if (this.targetClassId) {
      const targetNodeClass = this.mure.classes[this.targetClassId];
      let [sourceChain, targetChain] = this.targetChain.split();
      const newTargetEdgeClass = this.mure.createClass({
        ClassType: this.mure.CLASSES.EdgeClass,
        sourceClassId: targetNodeClass.classId,
        sourceChain: sourceChain.toRawObject(),
        targetClassId: newNodeClass.classId,
        targetChain: targetChain.toRawObject(),
        directed: this.directed
      });
      delete targetNodeClass.edgeConnections[newNodeClass.classId];
      targetNodeClass.edgeConnections[newTargetEdgeClass.classId] = true;
      newNodeClass.edgeConnections[newTargetEdgeClass.classId] = true;
    }

    this.mure.saveClasses();
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    direction,
    nodeHashName,
    edgeHashName
  }) {
    if (direction === 'source') {
      if (this.sourceClassId) {
        delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
      }

      this.sourceClassId = nodeClass.classId;
      this.sourceChain = new Chain({
        nodeHash: nodeHashName,
        edgeHash: edgeHashName
      });
    } else if (direction === 'target') {
      if (this.targetClassId) {
        delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
      }

      this.targetClassId = nodeClass.classId;
      this.targetChain = new Chain({
        nodeHash: nodeHashName,
        edgeHash: edgeHashName
      });
    } else {
      if (!this.sourceClassId) {
        this.sourceClassId = nodeClass.classId;
        this.sourceChain = new Chain({
          nodeHash: nodeHashName,
          edgeHash: edgeHashName
        });
      } else if (!this.targetClassId) {
        this.targetClassId = nodeClass.classId;
        this.targetChain = new Chain({
          nodeHash: nodeHashName,
          edgeHash: edgeHashName
        });
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }

    this.mure.saveClasses();
  }

  toggleNodeDirection(sourceClassId) {
    if (!sourceClassId) {
      this.directed = false;
    } else {
      this.directed = true;

      if (sourceClassId !== this.sourceClassId) {
        if (sourceClassId !== this.targetClassId) {
          throw new Error(`Can't swap to unconnected class id: ${sourceClassId}`);
        }

        this.sourceClassId = this.targetClassId;
        this.targetClassId = sourceClassId;
        const temp = this.sourceChain;
        this.sourceChain = this.targetChain;
        this.targetChain = temp;
      }
    }

    this.mure.saveClasses();
  }

  disconnectSources() {
    this.sourceClassId = null;
    this.sourceChain = new Chain();
  }

  disconnectTargets() {
    this.targetClassId = null;
    this.targetChain = new Chain();
  }

  delete() {
    if (this.sourceClassId) {
      delete this.mure.classes[this.sourceClassId].edgeConnections[this.classId];
    }

    if (this.targetClassId) {
      delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
    }

    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor({
    wrappedParent,
    token,
    rawItem
  }) {
    super();
    this.wrappedParent = wrappedParent;
    this.token = token;
    this.rawItem = rawItem;
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {
  constructor({
    wrappedParent,
    token,
    rawItem
  }) {
    super({
      wrappedParent,
      token,
      rawItem
    });

    if (token.edgeRole === 'sourceTarget') {
      this.rawItem = {
        source: this.rawItem.left,
        target: this.rawItem.right
      };
    } else if (token.edgeRole === 'edgeTarget') {
      this.rawItem = {
        edge: this.rawItem.left,
        target: this.rawItem.right
      };
    } else if (token.edgeRole === 'sourceEdge') {
      this.rawItem = {
        source: this.rawItem.right,
        edge: this.rawItem.left
      };
    } else if (token.edgeRole === 'full') {
      this.rawItem = {
        source: this.rawItem.left.right,
        edge: this.rawItem.left.left,
        target: this.rawItem.right
      };
    } // if there is no edgeRole, leave the rawItem as-is

  }

}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({
    entries = {},
    complete = false
  } = {}) {
    this.entries = entries;
    this.complete = complete;
  }

  async toRawObject() {
    return this.entries;
  }

  async *iterEntries() {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield {
        hash,
        valueList
      };
    }
  }

  async *iterHashes() {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }

  async *iterValueLists() {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
  }

  async getValueList(hash) {
    return this.entries[hash] || [];
  }

  async addValue(hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);

    if (this.entries[hash].indexOf(value) === -1) {
      this.entries[hash].push(value);
    }
  }

}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams
    // extensions that we want datalib to handle

    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    }; // Access to core classes via the main library helps avoid circular imports

    this.TOKENS = TOKENS;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES; // Monkey-patch available tokens as functions onto the Stream class

    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];

      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    } // Default named functions


    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedItem) {
        yield wrappedItem.rawItem;
      },
      key: function* (wrappedItem) {
        if (!wrappedItem.wrappedParent || !wrappedItem.wrappedParent.wrappedParent || typeof wrappedItem.wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Grandparent is not an object / array`);
        }

        const parentType = typeof wrappedItem.wrappedParent.rawItem;

        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else {
          yield wrappedItem.wrappedParent.rawItem;
        }
      },
      defaultFinish: function* (thisWrappedItem, otherWrappedItem) {
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    }; // Object containing each of our data sources

    this.root = this.loadRoot(); // Object containing our class specifications

    this.classes = this.loadClasses();
  }

  loadRoot() {
    let root = this.localStorage && this.localStorage.getItem('mure_root');
    root = root ? JSON.parse(root) : {};
    return root;
  }

  saveRoot() {
    if (this.localStorage) {
      this.localStorage.setItem('mure_root', JSON.stringify(this.root));
    }

    this.trigger('rootUpdate');
  }

  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classId, rawClassObj]) => {
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classId] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }

  getRawClasses() {
    const rawClasses = {};

    for (const [classId, classObj] of Object.entries(this.classes)) {
      rawClasses[classId] = classObj.toRawObject();
    }

    return rawClasses;
  }

  saveClasses() {
    if (this.localStorage) {
      this.localStorage.setItem('mure_classes', JSON.stringify(this.getRawClasses()));
    }

    this.trigger('classUpdate');
  }

  parseSelector(selectorString) {
    const startsWithRoot = selectorString.startsWith('root');

    if (!(startsWithRoot || selectorString.startsWith('empty'))) {
      throw new SyntaxError(`Selectors must start with 'root' or 'empty'`);
    }

    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);

    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }

    const tokenClassList = [{
      TokenClass: startsWithRoot ? this.TOKENS.RootToken : this.TOKENS.EmptyToken
    }];
    tokenStrings.forEach(chunk => {
      const temp = chunk.match(/^.([^(]*)\(([^)]*)\)/);

      if (!temp) {
        throw new SyntaxError(`Invalid token: ${chunk}`);
      }

      const tokenClassName = temp[1][0].toUpperCase() + temp[1].slice(1) + 'Token';
      const argList = temp[2].split(/(?<!\\),/).map(d => {
        d = d.trim();
        return d === '' ? undefined : d;
      });

      if (tokenClassName === 'ValuesToken') {
        tokenClassList.push({
          TokenClass: this.TOKENS.KeysToken,
          argList
        });
        tokenClassList.push({
          TokenClass: this.TOKENS.ValueToken
        });
      } else if (this.TOKENS[tokenClassName]) {
        tokenClassList.push({
          TokenClass: this.TOKENS[tokenClassName],
          argList
        });
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenClassList;
  }

  stream(options) {
    options.mure = this;
    options.tokenClassList = this.parseSelector(options.selector || `root.values()`);
    return new Stream(options);
  }

  createClass(options = {
    selector: `empty`
  }) {
    if (!options.classId) {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.classId] = new ClassType(options);
    return this.classes[options.classId];
  }

  newClass(options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
  }

  async addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    const fileMB = fileObj.size / 1048576;

    if (fileMB >= 30) {
      if (skipSizeCheck) {
        console.warn(`Attempting to load ${fileMB}MB file into memory`);
      } else {
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicDataSource() instead.`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this.FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticDataSource({
      key: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }

  addStringAsStaticDataSource({
    key,
    extension = 'txt',
    text
  }) {
    let obj;

    if (this.DATALIB_FORMATS[extension]) {
      obj = datalib.read(text, {
        type: extension
      });

      if (extension === 'csv' || extension === 'tsv') {
        delete obj.columns;
      }
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return this.addStaticDataSource(key, obj);
  }

  addStaticDataSource(key, obj) {
    this.root[key] = obj;
    this.saveRoot();
    return this.newClass({
      selector: `root.values('${key}').values()`
    });
  }

  removeDataSource(key) {
    delete this.root[key];
    this.saveRoot();
  }

}

var name = "mure";
var version = "0.4.10";
var description = "A library for flexible graph reshaping";
var main = "dist/mure.cjs.js";
var module$1 = "dist/mure.esm.js";
var browser = "dist/mure.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = [
	"dist"
];
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
	"@babel/core": "^7.0.0",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.4.2",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^4.0.2",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	"mime-types": "^2.1.20",
	sha1: "^1.1.1"
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvSW5kZXhlZFRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Qcm9tb3RlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0pvaW5Ub2tlbi5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0NoYWluLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0luZGV4ZXMvSW5NZW1vcnlJbmRleC5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG5cbiAgICAvLyBUT0RPOiBwcmVzZXJ2ZSB0aGVzZSBzb21laG93P1xuICAgIHRoaXMuaW5kZXhlcyA9IHt9O1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBjb25zdCBjbGFzc1Rva2VuTGlzdCA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0O1xuICAgICAgICAgIGlmICghY2xhc3NUb2tlbkxpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzVG9rZW5MaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbmFtZWRTdHJlYW1zOiB0aGlzLm5hbWVkU3RyZWFtcyxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZFN0cmVhbXMsIG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoW3sgVG9rZW5DbGFzcywgYXJnTGlzdCB9XSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBsZXQgd3JhcHBlckluZGV4ID0gMDtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHdyYXBwZXJJbmRleCArPSAxO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUsIHRva2VuKSB7XG4gICAgaWYgKCF0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0pIHtcbiAgICAgIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSA9IHt9O1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkluZGV4ID0gdGhpcy50b2tlbkxpc3QuaW5kZXhPZih0b2tlbik7XG4gICAgaWYgKCF0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV1bdG9rZW5JbmRleF0pIHtcbiAgICAgIC8vIFRPRE86IGZpZ3VyZSBvdXQgZXh0ZXJuYWwgaW5kZXhlcy4uLlxuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdW3Rva2VuSW5kZXhdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXVt0b2tlbkluZGV4XTtcbiAgfVxuXG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgbGFzdFRva2VuID0gdGhpcy50b2tlbkxpc3RbdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgIHlpZWxkICogYXdhaXQgbGFzdFRva2VuLml0ZXJhdGUodGVtcCk7XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwLCByZWJ1aWxkSW5kZXhlcyA9IGZhbHNlIH0pIHtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1YlNldE9mICgpIHtcbiAgICAvLyBCeSBkZWZhdWx0ICh3aXRob3V0IGFueSBhcmd1bWVudHMpLCB0b2tlbnMgb2YgdGhlIHNhbWUgY2xhc3MgYXJlIHN1YnNldHNcbiAgICAvLyBvZiBlYWNoIG90aGVyXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZVBhcmVudCAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUb2tlbiA9IGFuY2VzdG9yVG9rZW5zW2FuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSBhbmNlc3RvclRva2Vucy5zbGljZSgwLCBhbmNlc3RvclRva2Vucy5sZW5ndGggLSAxKTtcbiAgICBsZXQgeWllbGRlZFNvbWV0aGluZyA9IGZhbHNlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUb2tlbi5pdGVyYXRlKHRlbXApKSB7XG4gICAgICB5aWVsZGVkU29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgIHlpZWxkIHdyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGlmICgheWllbGRlZFNvbWV0aGluZyAmJiB0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUb2tlbiB5aWVsZGVkIG5vIHJlc3VsdHM6ICR7cGFyZW50VG9rZW59YCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgcmF3SXRlbSB9KSB7XG4gICAgLy8gSW5kZXhlZFRva2VuIG92ZXJyaWRlcyB3aXRoIGFuIGFzeW5jIGZ1bmN0aW9uXG4gICAgcmV0dXJuIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbVxuICAgIH0pO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZVRva2VuLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUb2tlbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFbXB0eVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICAvLyB5aWVsZCBub3RoaW5nXG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgZW1wdHlgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFbXB0eVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFJvb3RUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gdW5kZWZpbmVkKSB8fCBtYXRjaEFsbCkge1xuICAgICAgdGhpcy5tYXRjaEFsbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ0xpc3QuZm9yRWFjaChhcmcgPT4ge1xuICAgICAgICBsZXQgdGVtcCA9IGFyZy5tYXRjaCgvKFxcZCspLShbXFxk4oieXSspLyk7XG4gICAgICAgIGlmICh0ZW1wICYmIHRlbXBbMl0gPT09ICfiiJ4nKSB7XG4gICAgICAgICAgdGVtcFsyXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSB0ZW1wID8gdGVtcC5tYXAoZCA9PiBkLnBhcnNlSW50KGQpKSA6IG51bGw7XG4gICAgICAgIGlmICh0ZW1wICYmICFpc05hTih0ZW1wWzFdKSAmJiAhaXNOYU4odGVtcFsyXSkpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gdGVtcFsxXTsgaSA8PSB0ZW1wWzJdOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiB0ZW1wWzFdLCBoaWdoOiB0ZW1wWzJdIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IGFyZy5tYXRjaCgvJyguKiknLyk7XG4gICAgICAgIHRlbXAgPSB0ZW1wICYmIHRlbXBbMV0gPyB0ZW1wWzFdIDogYXJnO1xuICAgICAgICBsZXQgbnVtID0gTnVtYmVyKHRlbXApO1xuICAgICAgICBpZiAoaXNOYU4obnVtKSB8fCBudW0gIT09IHBhcnNlSW50KHRlbXApKSB7IC8vIGxlYXZlIG5vbi1pbnRlZ2VyIG51bWJlcnMgYXMgc3RyaW5nc1xuICAgICAgICAgIHRoaXMua2V5cyA9IHRoaXMua2V5cyB8fCB7fTtcbiAgICAgICAgICB0aGlzLmtleXNbdGVtcF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogbnVtLCBoaWdoOiBudW0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQmFkIHRva2VuIGtleShzKSAvIHJhbmdlKHMpOiAke0pTT04uc3RyaW5naWZ5KGFyZ0xpc3QpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5jb25zb2xpZGF0ZVJhbmdlcyh0aGlzLnJhbmdlcyk7XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RzTm90aGluZyAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1hdGNoQWxsICYmICF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzO1xuICB9XG4gIGNvbnNvbGlkYXRlUmFuZ2VzIChyYW5nZXMpIHtcbiAgICAvLyBNZXJnZSBhbnkgb3ZlcmxhcHBpbmcgcmFuZ2VzXG4gICAgY29uc3QgbmV3UmFuZ2VzID0gW107XG4gICAgY29uc3QgdGVtcCA9IHJhbmdlcy5zb3J0KChhLCBiKSA9PiBhLmxvdyAtIGIubG93KTtcbiAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXAubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghY3VycmVudFJhbmdlKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9IGVsc2UgaWYgKHRlbXBbaV0ubG93IDw9IGN1cnJlbnRSYW5nZS5oaWdoKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gdGVtcFtpXS5oaWdoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgICAgLy8gQ29ybmVyIGNhc2U6IGFkZCB0aGUgbGFzdCByYW5nZVxuICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1Jhbmdlcy5sZW5ndGggPiAwID8gbmV3UmFuZ2VzIDogdW5kZWZpbmVkO1xuICB9XG4gIGRpZmZlcmVuY2UgKG90aGVyVG9rZW4pIHtcbiAgICAvLyBDb21wdXRlIHdoYXQgaXMgbGVmdCBvZiB0aGlzIGFmdGVyIHN1YnRyYWN0aW5nIG91dCBldmVyeXRoaW5nIGluIG90aGVyVG9rZW5cbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBjb21wdXRlIHRoZSBkaWZmZXJlbmNlIG9mIHR3byBkaWZmZXJlbnQgdG9rZW4gdHlwZXNgKTtcbiAgICB9IGVsc2UgaWYgKG90aGVyVG9rZW4ubWF0Y2hBbGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgY29uc29sZS53YXJuKGBJbmFjY3VyYXRlIGRpZmZlcmVuY2UgY29tcHV0ZWQhIFRPRE86IG5lZWQgdG8gZmlndXJlIG91dCBob3cgdG8gaW52ZXJ0IGNhdGVnb3JpY2FsIGtleXMhYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3S2V5cyA9IHt9O1xuICAgICAgZm9yIChsZXQga2V5IGluICh0aGlzLmtleXMgfHwge30pKSB7XG4gICAgICAgIGlmICghb3RoZXJUb2tlbi5rZXlzIHx8ICFvdGhlclRva2VuLmtleXNba2V5XSkge1xuICAgICAgICAgIG5ld0tleXNba2V5XSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdSYW5nZXMgPSBbXTtcbiAgICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgICBpZiAob3RoZXJUb2tlbi5yYW5nZXMpIHtcbiAgICAgICAgICBsZXQgYWxsUG9pbnRzID0gdGhpcy5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pO1xuICAgICAgICAgIGFsbFBvaW50cyA9IGFsbFBvaW50cy5jb25jYXQob3RoZXJUb2tlbi5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pKS5zb3J0KCk7XG4gICAgICAgICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSB7IGxvdzogYWxsUG9pbnRzW2ldLnZhbHVlIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0udmFsdWU7XG4gICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uZXhjbHVkZSkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLmxvdyAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UubG93ID0gYWxsUG9pbnRzW2ldLmhpZ2ggKyAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld1JhbmdlcyA9IHRoaXMucmFuZ2VzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEtleXNUb2tlbih0aGlzLm11cmUsIG51bGwsIHsga2V5czogbmV3S2V5cywgcmFuZ2VzOiBuZXdSYW5nZXMgfSk7XG4gICAgfVxuICB9XG4gIGlzU3ViU2V0T2YgKGFyZ0xpc3QpIHtcbiAgICBjb25zdCBvdGhlclRva2VuID0gbmV3IEtleXNUb2tlbih0aGlzLnN0cmVhbSwgYXJnTGlzdCk7XG4gICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICByZXR1cm4gZGlmZiA9PT0gbnVsbCB8fCBkaWZmLnNlbGVjdHNOb3RoaW5nO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgKHRoaXMucmFuZ2VzIHx8IFtdKS5tYXAoKHtsb3csIGhpZ2h9KSA9PiB7XG4gICAgICByZXR1cm4gbG93ID09PSBoaWdoID8gbG93IDogYCR7bG93fS0ke2hpZ2h9YDtcbiAgICB9KS5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzIHx8IHt9KS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGlmICh0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBLZXlzVG9rZW4gaXMgbm90IGFuIG9iamVjdGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgICBmb3IgKGxldCBrZXkgaW4gd3JhcHBlZFBhcmVudC5yYXdJdGVtKSB7XG4gICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChsZXQge2xvdywgaGlnaH0gb2YgdGhpcy5yYW5nZXMgfHwgW10pIHtcbiAgICAgICAgICBsb3cgPSBNYXRoLm1heCgwLCBsb3cpO1xuICAgICAgICAgIGhpZ2ggPSBNYXRoLm1pbih3cmFwcGVkUGFyZW50LnJhd0l0ZW0ubGVuZ3RoIC0gMSwgaGlnaCk7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IGxvdzsgaSA8PSBoaWdoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW1baV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEtleXNUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBWYWx1ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBvYmogPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleSA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5VHlwZSA9IHR5cGVvZiBrZXk7XG4gICAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgKGtleVR5cGUgIT09ICdzdHJpbmcnICYmIGtleVR5cGUgIT09ICdudW1iZXInKSkge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBWYWx1ZVRva2VuIHVzZWQgb24gYSBub24tb2JqZWN0LCBvciB3aXRob3V0IGEgc3RyaW5nIC8gbnVtZXJpYyBrZXlgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNYXBUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBJbmRleGVkVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGF3YWl0IHN1cGVyLndyYXAoeyB3cmFwcGVkUGFyZW50LCByYXdJdGVtIH0pO1xuICAgIGZvciAoY29uc3QgWyBoYXNoRnVuY05hbWUsIGhhc2ggXSBvZiBPYmplY3QuZW50cmllcyhoYXNoZXMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KGhhc2hGdW5jTmFtZSwgdGhpcyk7XG4gICAgICBhd2FpdCBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5kZXhlZFRva2VuO1xuIiwiaW1wb3J0IEluZGV4ZWRUb2tlbiBmcm9tICcuL0luZGV4ZWRUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEluZGV4ZWRUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCwgdGhpcyk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBJbmRleGVkVG9rZW4gZnJvbSAnLi9JbmRleGVkVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBJbmRleGVkVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnLCBlZGdlUm9sZSA9ICdub25lJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyB0aGlzSGFzaCwgZmluaXNoIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXAgPSBzdHJlYW0ubmFtZWRTdHJlYW1zW290aGVyU3RyZWFtXTtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBzdHJlYW06ICR7b3RoZXJTdHJlYW19YCk7XG4gICAgfVxuICAgIC8vIFJlcXVpcmUgb3RoZXJIYXNoIG9uIHRoZSBvdGhlciBzdHJlYW0sIG9yIGNvcHkgb3VycyBvdmVyIGlmIGl0IGlzbid0XG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkXG4gICAgaWYgKCF0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGhhc2ggZnVuY3Rpb24gb24gZWl0aGVyIHN0cmVhbTogJHtvdGhlckhhc2h9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0gPSBzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm90aGVyU3RyZWFtID0gb3RoZXJTdHJlYW07XG4gICAgdGhpcy50aGlzSGFzaCA9IHRoaXNIYXNoO1xuICAgIHRoaXMub3RoZXJIYXNoID0gb3RoZXJIYXNoO1xuICAgIHRoaXMuZmluaXNoID0gZmluaXNoO1xuICAgIHRoaXMuZWRnZVJvbGUgPSBlZGdlUm9sZTtcbiAgICB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPSBlZGdlUm9sZSA9PT0gJ2Z1bGwnO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5qb2luKCR7dGhpcy5vdGhlclN0cmVhbX0sICR7dGhpcy50aGlzSGFzaH0sICR7dGhpcy5vdGhlckhhc2h9LCAke3RoaXMuZmluaXNofSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gdGhpcy5vdGhlclN0cmVhbSA9PT0gb3RoZXJTdHJlYW0gJiZcbiAgICAgIHRoaXMudGhpc0hhc2ggPT09IHRoaXNIYXNoICYmXG4gICAgICB0aGlzLm90aGVySGFzaCA9PT0gb3RoZXJIYXNoICYmXG4gICAgICB0aGlzLmZpbmlzaCA9PT0gZmluaXNoO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBvdGhlclN0cmVhbSA9IHRoaXMuc3RyZWFtLm5hbWVkU3RyZWFtc1t0aGlzLm90aGVyU3RyZWFtXTtcbiAgICBjb25zdCB0aGlzSGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy50aGlzSGFzaF07XG4gICAgY29uc3Qgb3RoZXJIYXNoRnVuY3Rpb24gPSBvdGhlclN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm90aGVySGFzaF07XG4gICAgY29uc3QgZmluaXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmZpbmlzaF07XG5cbiAgICBjb25zdCB0aGlzSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLnRoaXNIYXNoLCB0aGlzKTtcbiAgICBjb25zdCBvdGhlckluZGV4ID0gb3RoZXJTdHJlYW0uZ2V0SW5kZXgodGhpcy5vdGhlckhhc2gsIHRoaXMpO1xuXG4gICAgaWYgKHRoaXNJbmRleC5jb21wbGV0ZSkge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gQmVzdCBvZiBhbGwgd29ybGRzOyB3ZSBjYW4ganVzdCBqb2luIHRoZSBpbmRleGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBoYXNoLCB2YWx1ZUxpc3QgfSBvZiB0aGlzSW5kZXguaXRlckVudHJpZXMoKSkge1xuICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHZhbHVlTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSB0aGUgb3RoZXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiBvdXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyU3RyZWFtLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgLy8gQWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleDpcbiAgICAgICAgICAgIGF3YWl0IG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIG91ciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIHRoZSBvdGhlciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICAgICAgLy8gT2RkIGNvcm5lciBjYXNlIGZvciBlZGdlczsgc29tZXRpbWVzIHdlIHdhbnQgdG8gaGFzaCB0aGUgZ3JhbmRwYXJlbnQgaW5zdGVhZCBvZiB0aGUgcmVzdWx0IG9mXG4gICAgICAgICAgLy8gYW4gaW50ZXJtZWRpYXRlIGpvaW46XG4gICAgICAgICAgY29uc3QgdGhpc0hhc2hJdGVtID0gdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID8gdGhpc1dyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgOiB0aGlzV3JhcHBlZEl0ZW07XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc0hhc2hJdGVtKSkge1xuICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgIGF3YWl0IHRoaXNJbmRleC5hZGRWYWx1ZShoYXNoLCB0aGlzSGFzaEl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVpdGhlciBzdHJlYW0gaXMgZnVsbHkgaW5kZXhlZDsgZm9yIG1vcmUgZGlzdHJpYnV0ZWQgc2FtcGxpbmcsIGdyYWJcbiAgICAgICAgLy8gb25lIGl0ZW0gZnJvbSBlYWNoIHN0cmVhbSBhdCBhIHRpbWUsIGFuZCB1c2UgdGhlIHBhcnRpYWwgaW5kZXhlc1xuICAgICAgICBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMsIHRoaXMudGhpc0luZGlyZWN0S2V5KTtcbiAgICAgICAgbGV0IHRoaXNJc0RvbmUgPSBmYWxzZTtcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcbiAgICAgICAgbGV0IG90aGVySXNEb25lID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCF0aGlzSXNEb25lIHx8ICFvdGhlcklzRG9uZSkge1xuICAgICAgICAgIC8vIFRha2Ugb25lIHNhbXBsZSBmcm9tIHRoaXMgc3RyZWFtXG4gICAgICAgICAgbGV0IHRlbXAgPSBhd2FpdCB0aGlzSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXNJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0aGlzV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgLy8gT2RkIGNvcm5lciBjYXNlIGZvciBlZGdlczsgc29tZXRpbWVzIHdlIHdhbnQgdG8gaGFzaCB0aGUgZ3JhbmRwYXJlbnQgaW5zdGVhZCBvZiB0aGUgcmVzdWx0IG9mXG4gICAgICAgICAgICAvLyBhbiBpbnRlcm1lZGlhdGUgam9pbjpcbiAgICAgICAgICAgIGNvbnN0IHRoaXNIYXNoSXRlbSA9IHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA/IHRoaXNXcmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IDogdGhpc1dyYXBwZWRJdGVtO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc0hhc2hJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgICB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc0hhc2hJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBOb3cgZm9yIGEgc2FtcGxlIGZyb20gdGhlIG90aGVyIHN0cmVhbVxuICAgICAgICAgIHRlbXAgPSBhd2FpdCBvdGhlckl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgICAgICBvdGhlcklzRG9uZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgIC8vIGFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXhcbiAgICAgICAgICAgICAgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBKb2luVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi4vU3RyZWFtLmpzJztcblxuY29uc3QgQVNURVJJU0tTID0ge1xuICAnZXZhbHVhdGUnOiAn4oasJyxcbiAgJ2pvaW4nOiAn4qivJyxcbiAgJ21hcCc6ICfihqYnLFxuICAncHJvbW90ZSc6ICfihpEnLFxuICAndmFsdWUnOiAn4oaSJ1xufTtcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLl9zZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3I7XG4gICAgdGhpcy5jdXN0b21DbGFzc05hbWUgPSBvcHRpb25zLmN1c3RvbUNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPSBvcHRpb25zLmN1c3RvbU5hbWVUb2tlbkluZGV4IHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwgW107XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IG5ldyBGdW5jdGlvbihgcmV0dXJuICR7ZnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yO1xuICB9XG4gIGdldCB0b2tlbkNsYXNzTGlzdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKHRoaXMuc2VsZWN0b3IpO1xuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc1R5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZSxcbiAgICAgIHNlbGVjdG9yOiB0aGlzLl9zZWxlY3RvcixcbiAgICAgIGN1c3RvbUNsYXNzTmFtZTogdGhpcy5jdXN0b21DbGFzc05hbWUsXG4gICAgICBjdXN0b21OYW1lVG9rZW5JbmRleDogdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHt9XG4gICAgfTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgICByZXN1bHQubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gc3RyaW5naWZpZWRGdW5jO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IHZhbHVlKSB7XG4gICAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IHZhbHVlO1xuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIH1cbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmXG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID09PSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yO1xuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IHRva2VuU3RyaW5ncy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmIGkgPD0gdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgKyByZXN1bHQ7XG4gICAgICB9XG4gICAgICBjb25zdCB0ZW1wID0gdG9rZW5TdHJpbmdzW2ldLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAodGVtcFsxXSA9PT0gJ2tleXMnIHx8IHRlbXBbMV0gPT09ICd2YWx1ZXMnKSB7XG4gICAgICAgIGlmICh0ZW1wWzJdID09PSAnJykge1xuICAgICAgICAgIHJlc3VsdCA9ICcqJyArIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSB0ZW1wWzJdLnJlcGxhY2UoLycoW14nXSopJy8sICckMScpICsgcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBBU1RFUklTS1NbdGVtcFsxXV0gKyByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoc2VsZWN0b3Iuc3RhcnRzV2l0aCgnZW1wdHknKSA/ICfiiIUnIDogJycpICsgcmVzdWx0O1xuICB9XG4gIGFkZEhhc2hGdW5jdGlvbiAoZnVuY05hbWUsIGZ1bmMpIHtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmM7XG4gIH1cbiAgYWRkQXR0cmlidXRlQXNIYXNoRnVuY3Rpb24gKGF0dHJOYW1lKSB7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1thdHRyTmFtZV0gPSBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW0ucmF3SXRlbVthdHRyTmFtZV07XG4gICAgfTtcbiAgfVxuICBleHBhbmRBdHRyaWJ1dGVBc0hhc2hGdW5jdGlvbiAoYXR0ck5hbWUsIGRlbGltaXRlciA9ICcsJykge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbYXR0ck5hbWVdID0gZnVuY3Rpb24gKiAod3JhcHBlZEl0ZW0pIHtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2Ygd3JhcHBlZEl0ZW0ucmF3SXRlbS5zcGxpdChkZWxpbWl0ZXIpKSB7XG4gICAgICAgIHlpZWxkIHZhbHVlLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0O1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGdldFN0cmVhbSAob3B0aW9ucyA9IHt9KSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0odGhpcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucykpO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLkNsYXNzVHlwZSA9IHRoaXMubXVyZS5DTEFTU0VTLk5vZGVDbGFzcztcbiAgICByZXR1cm4gdGhpcy5tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLnRvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy5DbGFzc1R5cGUgPSB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3M7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5uZXdDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGhhc2gsIHJlZHVjZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGV4cGFuZCAobWFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgZmlsdGVyIChmaWx0ZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBzcGxpdCAoaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zID0gb3B0aW9ucy5lZGdlQ29ubmVjdGlvbnMgfHwge307XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLnRvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDb25uZWN0aW9ucyA9IHRoaXMuZWRnZUNvbm5lY3Rpb25zO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gICAgLypcbiAgICBjb25zdCBlZGdlSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ29ubmVjdGlvbnMpO1xuICAgIGlmIChlZGdlSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMuQ2xhc3NUeXBlID0gdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubXVyZS5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgICBpZiAoZWRnZUlkcy5sZW5ndGggPT09IDEgfHwgZWRnZUlkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW2VkZ2VJZHNbMF1dO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VDaGFpbiA9IHNvdXJjZUVkZ2VDbGFzcy5cbiAgICAgIG5ld0VkZ2VDbGFzcy5nbG9tcFNvdXJjZUVkZ2UodGhpcy5tdXJlLmNsYXNzZXNbZWRnZUlkc1swXV0pO1xuICAgIH1cbiAgICBpZiAoZWRnZUlkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy5nbG9tcFRhcmdldEVkZ2UodGhpcy5tdXJlLmNsYXNzZXNbZWRnZUlkc1sxXV0pO1xuICAgIH1cbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICAqL1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIHRoaXNIYXNoTmFtZSwgb3RoZXJIYXNoTmFtZSB9KSB7XG4gICAgY29uc3QgbmV3RWRnZSA9IHRoaXMubXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogbnVsbCxcbiAgICAgIENsYXNzVHlwZTogdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlQ2hhaW46IHsgbm9kZUhhc2g6IHRoaXNIYXNoTmFtZSwgZWRnZUhhc2g6IG51bGwgfSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRIYXNoTmFtZTogeyBub2RlSGFzaDogb3RoZXJIYXNoTmFtZSwgZWRnZUhhc2g6IG51bGwgfSxcbiAgICAgIGRpcmVjdGVkXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ29ubmVjdGlvbnNbbmV3RWRnZS5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW25ld0VkZ2UuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ29ubmVjdGlvbnMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZXMoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0cygpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuZWRnZUNvbm5lY3Rpb25zW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImNsYXNzIENoYWluIHtcbiAgY29uc3RydWN0b3IgKHsgbm9kZUhhc2ggPSBudWxsLCBlZGdlSGFzaCA9IG51bGwsIGludGVybWVkaWF0ZXMgPSBbXSB9ID0ge30pIHtcbiAgICB0aGlzLm5vZGVIYXNoID0gbm9kZUhhc2g7XG4gICAgdGhpcy5lZGdlSGFzaCA9IGVkZ2VIYXNoO1xuICAgIHRoaXMuaW50ZXJtZWRpYXRlcyA9IGludGVybWVkaWF0ZXM7XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBub2RlSGFzaDogdGhpcy5ub2RlSGFzaCxcbiAgICAgIGVkZ2VIYXNoOiB0aGlzLmVkZ2VIYXNoLFxuICAgICAgaW50ZXJtZWRpYXRlczogdGhpcy5pbnRlcm1lZGlhdGVzXG4gICAgfTtcbiAgfVxuICBzcGxpdCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gICAgLy8gcmV0dXJuIFsgZWRnZXdhcmRDaGFpbiwgbm9kZXdhcmRDaGFpbiBdXG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENoYWluO1xuIiwiaW1wb3J0IENoYWluIGZyb20gJy4vQ2hhaW4uanMnO1xuaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlQ2hhaW4gPSBuZXcgQ2hhaW4ob3B0aW9ucy5zb3VyY2VDaGFpbik7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDaGFpbiA9IG5ldyBDaGFpbihvcHRpb25zLnRhcmdldENoYWluKTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIudG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlQ2hhaW4gPSB0aGlzLnNvdXJjZUNoYWluLnRvUmF3T2JqZWN0O1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDaGFpbiA9IHRoaXMudGFyZ2V0Q2hhaW4udG9SYXdPYmplY3Q7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgLy8gVE9ETyFcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gICAgLypcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuXG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcyB8fCAhdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJ0aWFsIGNvbm5lY3Rpb25zIHdpdGhvdXQgYW4gZWRnZSB0YWJsZSBzaG91bGQgbmV2ZXIgaGFwcGVuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlZGdlIHRhYmxlIChzaW1wbGUgam9pbiBiZXR3ZWVuIHR3byBub2RlcylcbiAgICAgICAgY29uc3Qgc291cmNlSGFzaCA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SGFzaCA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNsYXNzLnNlbGVjdG9yICsgYC5qb2luKHRhcmdldCwgJHtzb3VyY2VIYXNofSwgJHt0YXJnZXRIYXNofSwgZGVmYXVsdEZpbmlzaCwgc291cmNlVGFyZ2V0KWA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCByZXN1bHQgPSB0aGlzLl9zZWxlY3RvcjtcbiAgICAgIGlmICghc291cmNlQ2xhc3MpIHtcbiAgICAgICAgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAgIC8vIE5vIGNvbm5lY3Rpb25zIHlldDsganVzdCB5aWVsZCB0aGUgcmF3IGVkZ2UgdGFibGVcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFBhcnRpYWwgZWRnZS10YXJnZXQgY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zdCB7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0ICsgYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGVkZ2VUYXJnZXQpYDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgLy8gUGFydGlhbCBzb3VyY2UtZWRnZSBjb25uZWN0aW9uc1xuICAgICAgICBjb25zdCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBzb3VyY2VFZGdlKWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBGdWxsIGNvbm5lY3Rpb25zXG4gICAgICAgIGxldCB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0gPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbihzb3VyY2UsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgICh7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSk7XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgZnVsbClgO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgICAqL1xuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IHt9O1xuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIC8vIFVzZSB0aGUgb3B0aW9ucyBmcm9tIHRoZSBzb3VyY2Ugc3RyZWFtIGluc3RlYWQgb2Ygb3VyIGNsYXNzXG4gICAgICBvcHRpb25zID0gc291cmNlQ2xhc3MucG9wdWxhdGVTdHJlYW1PcHRpb25zKG9wdGlvbnMpO1xuICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSBzdXBlci5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBpZiAoc291cmNlQ2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMuc291cmNlID0gc291cmNlQ2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgb3B0aW9ucy5uYW1lZFN0cmVhbXMudGFyZ2V0ID0gdGFyZ2V0Q2xhc3MuZ2V0U3RyZWFtKCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvcHRpb25zO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMuQ2xhc3NUeXBlID0gdGhpcy5tdXJlLkNMQVNTRVMuTm9kZUNsYXNzO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubXVyZS5jcmVhdGVDbGFzcyhvcHRpb25zKTtcblxuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZU5vZGVDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgICBsZXQgWyB0YXJnZXRDaGFpbiwgc291cmNlQ2hhaW4gXSA9IHRoaXMuc291cmNlQ2hhaW4uc3BsaXQoKTtcbiAgICAgIGNvbnN0IG5ld1NvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIENsYXNzVHlwZTogdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBzb3VyY2VOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlQ2hhaW46IHNvdXJjZUNoYWluLnRvUmF3T2JqZWN0KCksXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRDaGFpbjogdGFyZ2V0Q2hhaW4udG9SYXdPYmplY3QoKSxcbiAgICAgICAgZGlyZWN0ZWQ6IHRoaXMuZGlyZWN0ZWRcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHNvdXJjZU5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbbmV3Tm9kZUNsYXNzLmNsYXNzSWRdO1xuICAgICAgc291cmNlTm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1tuZXdTb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1tuZXdTb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHRhcmdldE5vZGVDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgICBsZXQgWyBzb3VyY2VDaGFpbiwgdGFyZ2V0Q2hhaW4gXSA9IHRoaXMudGFyZ2V0Q2hhaW4uc3BsaXQoKTtcbiAgICAgIGNvbnN0IG5ld1RhcmdldEVkZ2VDbGFzcyA9IHRoaXMubXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICAgIENsYXNzVHlwZTogdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0YXJnZXROb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlQ2hhaW46IHNvdXJjZUNoYWluLnRvUmF3T2JqZWN0KCksXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRDaGFpbjogdGFyZ2V0Q2hhaW4udG9SYXdPYmplY3QoKSxcbiAgICAgICAgZGlyZWN0ZWQ6IHRoaXMuZGlyZWN0ZWRcbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHRhcmdldE5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbbmV3Tm9kZUNsYXNzLmNsYXNzSWRdO1xuICAgICAgdGFyZ2V0Tm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1tuZXdUYXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1tuZXdUYXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdzb3VyY2UnKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNoYWluID0gbmV3IENoYWluKHsgbm9kZUhhc2g6IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2g6IGVkZ2VIYXNoTmFtZSB9KTtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIHRoaXMudGFyZ2V0Q2hhaW4gPSBuZXcgQ2hhaW4oeyBub2RlSGFzaDogbm9kZUhhc2hOYW1lLCBlZGdlSGFzaDogZWRnZUhhc2hOYW1lIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgICAgdGhpcy5zb3VyY2VDaGFpbiA9IG5ldyBDaGFpbih7IG5vZGVIYXNoOiBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoOiBlZGdlSGFzaE5hbWUgfSk7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2hhaW4gPSBuZXcgQ2hhaW4oeyBub2RlSGFzaDogbm9kZUhhc2hOYW1lLCBlZGdlSGFzaDogZWRnZUhhc2hOYW1lIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgYW5kIHRhcmdldCBhcmUgYWxyZWFkeSBkZWZpbmVkOyBwbGVhc2Ugc3BlY2lmeSBhIGRpcmVjdGlvbiB0byBvdmVycmlkZWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBzb3VyY2VDbGFzc0lkO1xuICAgICAgICBjb25zdCB0ZW1wID0gdGhpcy5zb3VyY2VDaGFpbjtcbiAgICAgICAgdGhpcy5zb3VyY2VDaGFpbiA9IHRoaXMudGFyZ2V0Q2hhaW47XG4gICAgICAgIHRoaXMudGFyZ2V0Q2hhaW4gPSB0ZW1wO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlcyAoKSB7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLnNvdXJjZUNoYWluID0gbmV3IENoYWluKCk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldHMgKCkge1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy50YXJnZXRDaGFpbiA9IG5ldyBDaGFpbigpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcih7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2VkZ2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlRWRnZScpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdmdWxsJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdC5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9XG4gICAgLy8gaWYgdGhlcmUgaXMgbm8gZWRnZVJvbGUsIGxlYXZlIHRoZSByYXdJdGVtIGFzLWlzXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgaWYgKHRoaXMuZW50cmllc1toYXNoXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0gdGhpcy5sb2FkUm9vdCgpO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5sb2FkQ2xhc3NlcygpO1xuICB9XG5cbiAgbG9hZFJvb3QgKCkge1xuICAgIGxldCByb290ID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9yb290Jyk7XG4gICAgcm9vdCA9IHJvb3QgPyBKU09OLnBhcnNlKHJvb3QpIDoge307XG4gICAgcmV0dXJuIHJvb3Q7XG4gIH1cbiAgc2F2ZVJvb3QgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9yb290JywgSlNPTi5zdHJpbmdpZnkodGhpcy5yb290KSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncm9vdFVwZGF0ZScpO1xuICB9XG4gIGxvYWRDbGFzc2VzICgpIHtcbiAgICBsZXQgY2xhc3NlcyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfY2xhc3NlcycpO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzID8gSlNPTi5wYXJzZShjbGFzc2VzKSA6IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKGNsYXNzZXMpLmZvckVhY2goKFsgY2xhc3NJZCwgcmF3Q2xhc3NPYmogXSkgPT4ge1xuICAgICAgY29uc3QgY2xhc3NUeXBlID0gcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgZGVsZXRlIHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIHJhd0NsYXNzT2JqLm11cmUgPSB0aGlzO1xuICAgICAgY2xhc3Nlc1tjbGFzc0lkXSA9IG5ldyB0aGlzLkNMQVNTRVNbY2xhc3NUeXBlXShyYXdDbGFzc09iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsYXNzZXM7XG4gIH1cbiAgZ2V0UmF3Q2xhc3NlcyAoKSB7XG4gICAgY29uc3QgcmF3Q2xhc3NlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgWyBjbGFzc0lkLCBjbGFzc09iaiBdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gcmF3Q2xhc3NlcztcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeSh0aGlzLmdldFJhd0NsYXNzZXMoKSkpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ2NsYXNzVXBkYXRlJyk7XG4gIH1cblxuICBwYXJzZVNlbGVjdG9yIChzZWxlY3RvclN0cmluZykge1xuICAgIGNvbnN0IHN0YXJ0c1dpdGhSb290ID0gc2VsZWN0b3JTdHJpbmcuc3RhcnRzV2l0aCgncm9vdCcpO1xuICAgIGlmICghKHN0YXJ0c1dpdGhSb290IHx8IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ2VtcHR5JykpKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFNlbGVjdG9ycyBtdXN0IHN0YXJ0IHdpdGggJ3Jvb3QnIG9yICdlbXB0eSdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkNsYXNzTGlzdCA9IFt7XG4gICAgICBUb2tlbkNsYXNzOiBzdGFydHNXaXRoUm9vdCA/IHRoaXMuVE9LRU5TLlJvb3RUb2tlbiA6IHRoaXMuVE9LRU5TLkVtcHR5VG9rZW5cbiAgICB9XTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiB7XG4gICAgICAgIGQgPSBkLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGQgPT09ICcnID8gdW5kZWZpbmVkIDogZDtcbiAgICAgIH0pO1xuICAgICAgaWYgKHRva2VuQ2xhc3NOYW1lID09PSAnVmFsdWVzVG9rZW4nKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLktleXNUb2tlbixcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5WYWx1ZVRva2VuXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0pIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gdG9rZW46ICR7dGVtcFsxXX1gKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdG9rZW5DbGFzc0xpc3Q7XG4gIH1cblxuICBzdHJlYW0gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnBhcnNlU2VsZWN0b3Iob3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWApO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IENsYXNzVHlwZSA9IG9wdGlvbnMuQ2xhc3NUeXBlIHx8IHRoaXMuQ0xBU1NFUy5HZW5lcmljQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuQ2xhc3NUeXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIG5ld0NsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3Q2xhc3NPYmogPSB0aGlzLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICAgIHRoaXMuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gbmV3Q2xhc3NPYmo7XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIHRoaXMuc2F2ZVJvb3QoKTtcbiAgICByZXR1cm4gdGhpcy5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogYHJvb3QudmFsdWVzKCcke2tleX0nKS52YWx1ZXMoKWBcbiAgICB9KTtcbiAgfVxuICByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsIm9mZiIsImluZGV4Iiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5Iiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiT2JqZWN0IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJ0b2tlbkNsYXNzTGlzdCIsInRva2VuTGlzdCIsIm1hcCIsIlRva2VuQ2xhc3MiLCJhcmdMaXN0IiwiV3JhcHBlcnMiLCJnZXRXcmFwcGVyTGlzdCIsImluZGV4ZXMiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJjbGFzc1Rva2VuTGlzdCIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiY29uc29sZSIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJmb3JrIiwicGFyc2VTZWxlY3RvciIsImV4dGVuZCIsImNvbmNhdCIsIndyYXAiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsImdldEluZGV4IiwiaGFzaEZ1bmN0aW9uTmFtZSIsInRva2VuSW5kZXgiLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsIml0ZXJhdGUiLCJsYXN0VG9rZW4iLCJzYW1wbGUiLCJsaW1pdCIsInJlYnVpbGRJbmRleGVzIiwiaXRlcmF0b3IiLCJuZXh0IiwiZG9uZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9TdHJpbmciLCJ0b0xvd2VyQ2FzZSIsImlzU3ViU2V0T2YiLCJhbmNlc3RvclRva2VucyIsIkVycm9yIiwiaXRlcmF0ZVBhcmVudCIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJFbXB0eVRva2VuIiwiUm9vdFRva2VuIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiSW5maW5pdHkiLCJkIiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJTeW50YXhFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwiZGlmZmVyZW5jZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwicmVkdWNlIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJNYXRoIiwibWF4IiwibWluIiwiaGFzT3duUHJvcGVydHkiLCJWYWx1ZVRva2VuIiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJuZXdTdHJlYW0iLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJJbmRleGVkVG9rZW4iLCJoYXNoRnVuY05hbWUiLCJoYXNoIiwiZW50cmllcyIsImFkZFZhbHVlIiwiUHJvbW90ZVRva2VuIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsIm1hcEZ1bmN0aW9uIiwiaGFzaEZ1bmN0aW9uIiwicmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24iLCJoYXNoSW5kZXgiLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwiZ2V0VmFsdWVMaXN0IiwiSm9pblRva2VuIiwib3RoZXJTdHJlYW0iLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImZpbmlzaCIsImVkZ2VSb2xlIiwiaGFzaFRoaXNHcmFuZHBhcmVudCIsInRoaXNIYXNoRnVuY3Rpb24iLCJvdGhlckhhc2hGdW5jdGlvbiIsImZpbmlzaEZ1bmN0aW9uIiwidGhpc0luZGV4Iiwib3RoZXJJbmRleCIsImNvbXBsZXRlIiwidmFsdWVMaXN0IiwiaXRlckVudHJpZXMiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSGFzaEl0ZW0iLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSW5kaXJlY3RLZXkiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiQVNURVJJU0tTIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsImN1c3RvbU5hbWVUb2tlbkluZGV4IiwiYW5ub3RhdGlvbnMiLCJmdW5jTmFtZSIsIkZ1bmN0aW9uIiwidG9SYXdPYmplY3QiLCJyZXN1bHQiLCJjbGFzc1R5cGUiLCJzdHJpbmdpZmllZEZ1bmMiLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJjbGFzc05hbWUiLCJ0b2tlblN0cmluZ3MiLCJzdGFydHNXaXRoIiwiYWRkSGFzaEZ1bmN0aW9uIiwiYWRkQXR0cmlidXRlQXNIYXNoRnVuY3Rpb24iLCJhdHRyTmFtZSIsImV4cGFuZEF0dHJpYnV0ZUFzSGFzaEZ1bmN0aW9uIiwiZGVsaW1pdGVyIiwic3BsaXQiLCJ0cmltIiwicG9wdWxhdGVTdHJlYW1PcHRpb25zIiwiZ2V0U3RyZWFtIiwiaXNTdXBlclNldE9mVG9rZW5MaXN0IiwiaXNTdXBlclNldE9mIiwiaW50ZXJwcmV0QXNOb2RlcyIsIkNsYXNzVHlwZSIsIkNMQVNTRVMiLCJOb2RlQ2xhc3MiLCJuZXdDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJFZGdlQ2xhc3MiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxldGUiLCJOb2RlV3JhcHBlciIsImVkZ2VDb25uZWN0aW9ucyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwiZGlyZWN0ZWQiLCJ0aGlzSGFzaE5hbWUiLCJvdGhlckhhc2hOYW1lIiwibmV3RWRnZSIsImNyZWF0ZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInNvdXJjZUNoYWluIiwibm9kZUhhc2giLCJlZGdlSGFzaCIsInRhcmdldENsYXNzSWQiLCJ0YXJnZXRIYXNoTmFtZSIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsImVkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImVkZ2VDbGFzc0lkIiwiZGlzY29ubmVjdFNvdXJjZXMiLCJkaXNjb25uZWN0VGFyZ2V0cyIsIkNoYWluIiwiaW50ZXJtZWRpYXRlcyIsIkVkZ2VXcmFwcGVyIiwidGFyZ2V0Q2hhaW4iLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwidGFyZ2V0Iiwic291cmNlIiwibmV3Tm9kZUNsYXNzIiwic291cmNlTm9kZUNsYXNzIiwibmV3U291cmNlRWRnZUNsYXNzIiwidGFyZ2V0Tm9kZUNsYXNzIiwibmV3VGFyZ2V0RWRnZUNsYXNzIiwiZGlyZWN0aW9uIiwibm9kZUhhc2hOYW1lIiwiZWRnZUhhc2hOYW1lIiwidG9nZ2xlTm9kZURpcmVjdGlvbiIsImxlZnQiLCJyaWdodCIsImVkZ2UiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJORVhUX0NMQVNTX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVE9LRU5TIiwidG9rZW5DbGFzc05hbWUiLCJwcm90b3R5cGUiLCJpZGVudGl0eSIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwic2hhMSIsIm5vb3AiLCJsb2FkUm9vdCIsImxvYWRDbGFzc2VzIiwiZ2V0SXRlbSIsInBhcnNlIiwic2F2ZVJvb3QiLCJzZXRJdGVtIiwicmF3Q2xhc3NPYmoiLCJnZXRSYXdDbGFzc2VzIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJjaHVuayIsInRvVXBwZXJDYXNlIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInJlbW92ZURhdGFTb3VyY2UiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCQyx1QkFBdkIsRUFBZ0Q7VUFDNUMsQ0FBQyxLQUFLTCxhQUFMLENBQW1C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
