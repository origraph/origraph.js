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

  populateStreamOptions(options = {}) {
    options.mure = this.mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    return options;
  }

  getStream(options = {}) {
    if (options.reset || !this._stream) {
      this._stream = new Stream(this.populateStreamOptions(options));
    }

    return this._stream;
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }

    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }

  interpretAsNodes() {
    const options = this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.NodeClass(options);
    this.mure.saveClasses();
    return this.mure.classes[this.classId];
  }

  interpretAsEdges() {
    const options = this.toRawObject();
    options.mure = this.mure;
    this.mure.classes[this.classId] = new this.mure.CLASSES.EdgeClass(options);
    this.mure.saveClasses();
    return this.mure.classes[this.classId];
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
    const result = super.toRawObject(); // TODO: need to deep copy edgeConnections?

    result.edgeConnections = this.edgeConnections;
    return result;
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges() {
    throw new Error(`unimplemented`);
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    thisHashName,
    otherHashName
  }) {
    const edgeClass = this.mure.newClass({
      selector: null,
      ClassType: this.mure.CLASSES.EdgeClass,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId,
      directed
    });
    this.edgeConnections[edgeClass.classId] = {
      nodeHashName: thisHashName
    };
    otherNodeClass.edgeConnections[edgeClass.classId] = {
      nodeHashName: otherHashName
    };
    delete this._stream;
    this.mure.saveClasses();
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }

  delete() {
    for (const edgeClassId of Object.keys(this.edgeConnections)) {
      const edgeClass = this.mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.sourceClassId = null;
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.targetClassId = null;
      }
    }

    super.delete();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }

  get selector() {
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
          const {
            edgeHashName,
            nodeHashName
          } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, edgeTarget)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const {
          nodeHashName,
          edgeHashName
        } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish, sourceEdge)`;
      } else {
        // Full connections
        let {
          nodeHashName,
          edgeHashName
        } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({
          edgeHashName,
          nodeHashName
        } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, full)`;
        return result;
      }
    }
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

  toRawObject() {
    const result = super.toRawObject();
    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  interpretAsNodes() {
    throw new Error(`unimplemented`);
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
    } else if (direction === 'target') {
      if (this.targetClassId) {
        delete this.mure.classes[this.targetClassId].edgeConnections[this.classId];
      }

      this.targetClassId = nodeClass.classId;
    } else {
      if (!this.sourceClassId) {
        this.sourceClassId = nodeClass.classId;
      } else if (!this.targetClassId) {
        this.targetClassId = nodeClass.classId;
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }

    nodeClass.edgeConnections[this.classId] = {
      nodeHashName,
      edgeHashName
    };
    delete this._stream;
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
      }
    }

    delete this._stream;
    this.mure.saveClasses();
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

  saveClasses() {
    if (this.localStorage) {
      const rawClasses = {};

      for (const [classId, classObj] of Object.entries(this.classes)) {
        rawClasses[classId] = classObj.toRawObject();
      }

      this.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
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

  newClass(options = {
    selector: `root`
  }) {
    options.classId = `class${NEXT_CLASS_ID}`;
    NEXT_CLASS_ID += 1;
    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.classId] = new ClassType(options);
    this.saveClasses();
    return this.classes[options.classId];
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
var version = "0.4.9";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvSW5kZXhlZFRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Qcm9tb3RlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0pvaW5Ub2tlbi5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgU3RyZWFtIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICB0aGlzLm5hbWVkU3RyZWFtcyA9IG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9O1xuICAgIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IG51bGw7XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuXG4gICAgLy8gVE9ETzogcHJlc2VydmUgdGhlc2Ugc29tZWhvdz9cbiAgICB0aGlzLmluZGV4ZXMgPSB7fTtcbiAgfVxuXG4gIGdldFdyYXBwZXJMaXN0ICgpIHtcbiAgICAvLyBMb29rIHVwIHdoaWNoLCBpZiBhbnksIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHJlc3VsdCBvZiBlYWNoIHRva2VuLCBzbyB0aGF0XG4gICAgLy8gd2UgY2FuIHdyYXAgaXRlbXMgYXBwcm9wcmlhdGVseTpcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QubWFwKCh0b2tlbiwgaW5kZXgpID0+IHtcbiAgICAgIGlmIChpbmRleCA9PT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSAmJiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzKSB7XG4gICAgICAgIC8vIElmIHRoaXMgc3RyZWFtIHdhcyBzdGFydGVkIGZyb20gYSBjbGFzcywgd2UgYWxyZWFkeSBrbm93IHdlIHNob3VsZFxuICAgICAgICAvLyB1c2UgdGhhdCBjbGFzcydzIHdyYXBwZXIgZm9yIHRoZSBsYXN0IHRva2VuXG4gICAgICAgIHJldHVybiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLldyYXBwZXI7XG4gICAgICB9XG4gICAgICAvLyBGaW5kIGEgY2xhc3MgdGhhdCBkZXNjcmliZXMgZXhhY3RseSBlYWNoIHNlcmllcyBvZiB0b2tlbnNcbiAgICAgIGNvbnN0IGxvY2FsVG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgaW5kZXggKyAxKTtcbiAgICAgIGNvbnN0IHBvdGVudGlhbFdyYXBwZXJzID0gT2JqZWN0LnZhbHVlcyh0aGlzLm11cmUuY2xhc3NlcylcbiAgICAgICAgLmZpbHRlcihjbGFzc09iaiA9PiB7XG4gICAgICAgICAgY29uc3QgY2xhc3NUb2tlbkxpc3QgPSBjbGFzc09iai50b2tlbkNsYXNzTGlzdDtcbiAgICAgICAgICBpZiAoIWNsYXNzVG9rZW5MaXN0Lmxlbmd0aCAhPT0gbG9jYWxUb2tlbkxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuTGlzdC5ldmVyeSgobG9jYWxUb2tlbiwgbG9jYWxJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5DbGFzc1NwZWMgPSBjbGFzc1Rva2VuTGlzdFtsb2NhbEluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuIGluc3RhbmNlb2YgdG9rZW5DbGFzc1NwZWMuVG9rZW5DbGFzcyAmJlxuICAgICAgICAgICAgICB0b2tlbi5pc1N1YnNldE9mKHRva2VuQ2xhc3NTcGVjLmFyZ0xpc3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2xhc3NlcyBkZXNjcmliZSB0aGlzIHNlcmllcyBvZiB0b2tlbnMsIHNvIHVzZSB0aGUgZ2VuZXJpYyB3cmFwcGVyXG4gICAgICAgIHJldHVybiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgTXVsdGlwbGUgY2xhc3NlcyBkZXNjcmliZSB0aGUgc2FtZSBpdGVtISBBcmJpdHJhcmlseSBjaG9vc2luZyBvbmUuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG90ZW50aWFsV3JhcHBlcnNbMF0uV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG5cbiAgZm9yayAoc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogdGhpcy5uYW1lZEZ1bmN0aW9ucyxcbiAgICAgIG5hbWVkU3RyZWFtczogdGhpcy5uYW1lZFN0cmVhbXMsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3NcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRTdHJlYW1zLCBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fSk7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3QuY29uY2F0KFt7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfV0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGdldEluZGV4IChoYXNoRnVuY3Rpb25OYW1lLCB0b2tlbikge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSB7fTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5JbmRleCA9IHRoaXMudG9rZW5MaXN0LmluZGV4T2YodG9rZW4pO1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdW3Rva2VuSW5kZXhdKSB7XG4gICAgICAvLyBUT0RPOiBmaWd1cmUgb3V0IGV4dGVybmFsIGluZGV4ZXMuLi5cbiAgICAgIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXVt0b2tlbkluZGV4XSA9IG5ldyB0aGlzLm11cmUuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV1bdG9rZW5JbmRleF07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVQYXJlbnQgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3QgcGFyZW50VG9rZW4gPSBhbmNlc3RvclRva2Vuc1thbmNlc3RvclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gYW5jZXN0b3JUb2tlbnMuc2xpY2UoMCwgYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VG9rZW4uaXRlcmF0ZSh0ZW1wKSkge1xuICAgICAgeWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBpZiAoIXlpZWxkZWRTb21ldGhpbmcgJiYgdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHJhd0l0ZW0gfSkge1xuICAgIC8vIEluZGV4ZWRUb2tlbiBvdmVycmlkZXMgd2l0aCBhbiBhc3luYyBmdW5jdGlvblxuICAgIHJldHVybiB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW1cbiAgICB9KTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB0aGlzLmtleXMgfHwge30pIHtcbiAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgSW5kZXhlZFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBhd2FpdCBzdXBlci53cmFwKHsgd3JhcHBlZFBhcmVudCwgcmF3SXRlbSB9KTtcbiAgICBmb3IgKGNvbnN0IFsgaGFzaEZ1bmNOYW1lLCBoYXNoIF0gb2YgT2JqZWN0LmVudHJpZXMoaGFzaGVzKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleChoYXNoRnVuY05hbWUsIHRoaXMpO1xuICAgICAgYXdhaXQgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluZGV4ZWRUb2tlbjtcbiIsImltcG9ydCBJbmRleGVkVG9rZW4gZnJvbSAnLi9JbmRleGVkVG9rZW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlVG9rZW4gZXh0ZW5kcyBJbmRleGVkVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBmb3IgKGNvbnN0IGZ1bmMgb2YgWyBtYXAsIGhhc2gsIHJlZHVjZUluc3RhbmNlcyBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcbiAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAucHJvbW90ZSgke3RoaXMubWFwfSwgJHt0aGlzLmhhc2h9LCAke3RoaXMucmVkdWNlSW5zdGFuY2VzfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICByZXR1cm4gdGhpcy5tYXAgPT09IG1hcCAmJlxuICAgICAgdGhpcy5oYXNoID09PSBoYXNoICYmXG4gICAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9PT0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3QgbWFwRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm1hcF07XG4gICAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmhhc2hdO1xuICAgICAgY29uc3QgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnJlZHVjZUluc3RhbmNlc107XG4gICAgICBjb25zdCBoYXNoSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLmhhc2gsIHRoaXMpO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIG1hcEZ1bmN0aW9uKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIGNvbnN0IGhhc2ggPSBoYXNoRnVuY3Rpb24obWFwcGVkUmF3SXRlbSk7XG4gICAgICAgIGxldCBvcmlnaW5hbFdyYXBwZWRJdGVtID0gKGF3YWl0IGhhc2hJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCkpWzBdO1xuICAgICAgICBpZiAob3JpZ2luYWxXcmFwcGVkSXRlbSkge1xuICAgICAgICAgIGlmICh0aGlzLnJlZHVjZUluc3RhbmNlcyAhPT0gJ25vb3AnKSB7XG4gICAgICAgICAgICByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbihvcmlnaW5hbFdyYXBwZWRJdGVtLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGhhc2hlcyA9IHt9O1xuICAgICAgICAgIGhhc2hlc1t0aGlzLmhhc2hdID0gaGFzaDtcbiAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW0sXG4gICAgICAgICAgICBoYXNoZXNcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlVG9rZW47XG4iLCJpbXBvcnQgSW5kZXhlZFRva2VuIGZyb20gJy4vSW5kZXhlZFRva2VuLmpzJztcblxuY2xhc3MgSm9pblRva2VuIGV4dGVuZHMgSW5kZXhlZFRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBvdGhlclN0cmVhbSwgdGhpc0hhc2ggPSAna2V5Jywgb3RoZXJIYXNoID0gJ2tleScsIGZpbmlzaCA9ICdkZWZhdWx0RmluaXNoJywgZWRnZVJvbGUgPSAnbm9uZScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgdGhpc0hhc2gsIGZpbmlzaCBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gc3RyZWFtLm5hbWVkU3RyZWFtc1tvdGhlclN0cmVhbV07XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgc3RyZWFtOiAke290aGVyU3RyZWFtfWApO1xuICAgIH1cbiAgICAvLyBSZXF1aXJlIG90aGVySGFzaCBvbiB0aGUgb3RoZXIgc3RyZWFtLCBvciBjb3B5IG91cnMgb3ZlciBpZiBpdCBpc24ndFxuICAgIC8vIGFscmVhZHkgZGVmaW5lZFxuICAgIGlmICghdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBoYXNoIGZ1bmN0aW9uIG9uIGVpdGhlciBzdHJlYW06ICR7b3RoZXJIYXNofWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdID0gc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vdGhlclN0cmVhbSA9IG90aGVyU3RyZWFtO1xuICAgIHRoaXMudGhpc0hhc2ggPSB0aGlzSGFzaDtcbiAgICB0aGlzLm90aGVySGFzaCA9IG90aGVySGFzaDtcbiAgICB0aGlzLmZpbmlzaCA9IGZpbmlzaDtcbiAgICB0aGlzLmVkZ2VSb2xlID0gZWRnZVJvbGU7XG4gICAgdGhpcy5oYXNoVGhpc0dyYW5kcGFyZW50ID0gZWRnZVJvbGUgPT09ICdmdWxsJztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAuam9pbigke3RoaXMub3RoZXJTdHJlYW19LCAke3RoaXMudGhpc0hhc2h9LCAke3RoaXMub3RoZXJIYXNofSwgJHt0aGlzLmZpbmlzaH0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIHRoaXMub3RoZXJTdHJlYW0gPT09IG90aGVyU3RyZWFtICYmXG4gICAgICB0aGlzLnRoaXNIYXNoID09PSB0aGlzSGFzaCAmJlxuICAgICAgdGhpcy5vdGhlckhhc2ggPT09IG90aGVySGFzaCAmJlxuICAgICAgdGhpcy5maW5pc2ggPT09IGZpbmlzaDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3Qgb3RoZXJTdHJlYW0gPSB0aGlzLnN0cmVhbS5uYW1lZFN0cmVhbXNbdGhpcy5vdGhlclN0cmVhbV07XG4gICAgY29uc3QgdGhpc0hhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMudGhpc0hhc2hdO1xuICAgIGNvbnN0IG90aGVySGFzaEZ1bmN0aW9uID0gb3RoZXJTdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5vdGhlckhhc2hdO1xuICAgIGNvbnN0IGZpbmlzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5maW5pc2hdO1xuXG4gICAgY29uc3QgdGhpc0luZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy50aGlzSGFzaCwgdGhpcyk7XG4gICAgY29uc3Qgb3RoZXJJbmRleCA9IG90aGVyU3RyZWFtLmdldEluZGV4KHRoaXMub3RoZXJIYXNoLCB0aGlzKTtcblxuICAgIGlmICh0aGlzSW5kZXguY29tcGxldGUpIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIEJlc3Qgb2YgYWxsIHdvcmxkczsgd2UgY2FuIGp1c3Qgam9pbiB0aGUgaW5kZXhlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgaGFzaCwgdmFsdWVMaXN0IH0gb2YgdGhpc0luZGV4Lml0ZXJFbnRyaWVzKCkpIHtcbiAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB2YWx1ZUxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgdGhlIG90aGVyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2Ygb3VyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlclN0cmVhbS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIEFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXg6XG4gICAgICAgICAgICBhd2FpdCBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSBvdXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiB0aGUgb3RoZXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgICAgIC8vIE9kZCBjb3JuZXIgY2FzZSBmb3IgZWRnZXM7IHNvbWV0aW1lcyB3ZSB3YW50IHRvIGhhc2ggdGhlIGdyYW5kcGFyZW50IGluc3RlYWQgb2YgdGhlIHJlc3VsdCBvZlxuICAgICAgICAgIC8vIGFuIGludGVybWVkaWF0ZSBqb2luOlxuICAgICAgICAgIGNvbnN0IHRoaXNIYXNoSXRlbSA9IHRoaXMuaGFzaFRoaXNHcmFuZHBhcmVudCA/IHRoaXNXcmFwcGVkSXRlbS53cmFwcGVkUGFyZW50IDogdGhpc1dyYXBwZWRJdGVtO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNIYXNoSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICBhd2FpdCB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc0hhc2hJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgc3RyZWFtIGlzIGZ1bGx5IGluZGV4ZWQ7IGZvciBtb3JlIGRpc3RyaWJ1dGVkIHNhbXBsaW5nLCBncmFiXG4gICAgICAgIC8vIG9uZSBpdGVtIGZyb20gZWFjaCBzdHJlYW0gYXQgYSB0aW1lLCBhbmQgdXNlIHRoZSBwYXJ0aWFsIGluZGV4ZXNcbiAgICAgICAgY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zLCB0aGlzLnRoaXNJbmRpcmVjdEtleSk7XG4gICAgICAgIGxldCB0aGlzSXNEb25lID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCBvdGhlcklzRG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIHdoaWxlICghdGhpc0lzRG9uZSB8fCAhb3RoZXJJc0RvbmUpIHtcbiAgICAgICAgICAvLyBUYWtlIG9uZSBzYW1wbGUgZnJvbSB0aGlzIHN0cmVhbVxuICAgICAgICAgIGxldCB0ZW1wID0gYXdhaXQgdGhpc0l0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgICAgICB0aGlzSXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGhpc1dyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIC8vIE9kZCBjb3JuZXIgY2FzZSBmb3IgZWRnZXM7IHNvbWV0aW1lcyB3ZSB3YW50IHRvIGhhc2ggdGhlIGdyYW5kcGFyZW50IGluc3RlYWQgb2YgdGhlIHJlc3VsdCBvZlxuICAgICAgICAgICAgLy8gYW4gaW50ZXJtZWRpYXRlIGpvaW46XG4gICAgICAgICAgICBjb25zdCB0aGlzSGFzaEl0ZW0gPSB0aGlzLmhhc2hUaGlzR3JhbmRwYXJlbnQgPyB0aGlzV3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCA6IHRoaXNXcmFwcGVkSXRlbTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNIYXNoSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIHRoaXNXcmFwcGVkSXRlbSB0byB0aGlzSW5kZXhcbiAgICAgICAgICAgICAgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNIYXNoSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgb3RoZXJXcmFwcGVkSXRlbSB0byBvdGhlckluZGV4XG4gICAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAgIGNvbnN0IHRoaXNMaXN0ID0gYXdhaXQgdGhpc0luZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy53cmFwKHtcbiAgICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNvbnN0IEFTVEVSSVNLUyA9IHtcbiAgJ2V2YWx1YXRlJzogJ+KGrCcsXG4gICdqb2luJzogJ+KorycsXG4gICdtYXAnOiAn4oamJyxcbiAgJ3Byb21vdGUnOiAn4oaRJyxcbiAgJ3ZhbHVlJzogJ+KGkidcbn07XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy5fc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yO1xuICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21DbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gb3B0aW9ucy5jdXN0b21OYW1lVG9rZW5JbmRleCB8fCBudWxsO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oYHJldHVybiAke2Z1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcjtcbiAgfVxuICBnZXQgdG9rZW5DbGFzc0xpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLm11cmUucGFyc2VTZWxlY3Rvcih0aGlzLnNlbGVjdG9yKTtcbiAgfVxuICB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NUeXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICBzZWxlY3RvcjogdGhpcy5fc2VsZWN0b3IsXG4gICAgICBjdXN0b21DbGFzc05hbWU6IHRoaXMuY3VzdG9tQ2xhc3NOYW1lLFxuICAgICAgY3VzdG9tTmFtZVRva2VuSW5kZXg6IHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXgsXG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBuYW1lZEZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICAgIHJlc3VsdC5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBzdHJpbmdpZmllZEZ1bmM7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIGlmICh0aGlzLmN1c3RvbUNsYXNzTmFtZSAhPT0gdmFsdWUpIHtcbiAgICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gdmFsdWU7XG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gdGhpcy5zZWxlY3Rvci5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZykubGVuZ3RoO1xuICAgICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgfVxuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiZcbiAgICAgIHRoaXMuY3VzdG9tTmFtZVRva2VuSW5kZXggPT09IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICBjb25zdCBzZWxlY3RvciA9IHRoaXMuc2VsZWN0b3I7XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGxldCByZXN1bHQgPSAnJztcbiAgICBmb3IgKGxldCBpID0gdG9rZW5TdHJpbmdzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IG51bGwgJiYgaSA8PSB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1c3RvbUNsYXNzTmFtZSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRlbXAgPSB0b2tlblN0cmluZ3NbaV0ubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICh0ZW1wWzFdID09PSAna2V5cycgfHwgdGVtcFsxXSA9PT0gJ3ZhbHVlcycpIHtcbiAgICAgICAgaWYgKHRlbXBbMl0gPT09ICcnKSB7XG4gICAgICAgICAgcmVzdWx0ID0gJyonICsgcmVzdWx0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdCA9IHRlbXBbMl0ucmVwbGFjZSgvJyhbXiddKiknLywgJyQxJykgKyByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IEFTVEVSSVNLU1t0ZW1wWzFdXSArIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIChzZWxlY3Rvci5zdGFydHNXaXRoKCdlbXB0eScpID8gJ+KIhScgOiAnJykgKyByZXN1bHQ7XG4gIH1cbiAgYWRkSGFzaEZ1bmN0aW9uIChmdW5jTmFtZSwgZnVuYykge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gZnVuYztcbiAgfVxuICBwb3B1bGF0ZVN0cmVhbU9wdGlvbnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICBvcHRpb25zLm5hbWVkRnVuY3Rpb25zID0gdGhpcy5uYW1lZEZ1bmN0aW9ucztcbiAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChvcHRpb25zLnJlc2V0IHx8ICF0aGlzLl9zdHJlYW0pIHtcbiAgICAgIHRoaXMuX3N0cmVhbSA9IG5ldyBTdHJlYW0odGhpcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYWdncmVnYXRlIChoYXNoLCByZWR1Y2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBleHBhbmQgKG1hcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGZpbHRlciAoZmlsdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgc3BsaXQgKGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgICB0aGlzLmVkZ2VDb25uZWN0aW9ucyA9IG9wdGlvbnMuZWRnZUNvbm5lY3Rpb25zIHx8IHt9O1xuICB9XG4gIHRvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci50b1Jhd09iamVjdCgpO1xuICAgIC8vIFRPRE86IG5lZWQgdG8gZGVlcCBjb3B5IGVkZ2VDb25uZWN0aW9ucz9cbiAgICByZXN1bHQuZWRnZUNvbm5lY3Rpb25zID0gdGhpcy5lZGdlQ29ubmVjdGlvbnM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGRpcmVjdGVkLCB0aGlzSGFzaE5hbWUsIG90aGVySGFzaE5hbWUgfSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubXVyZS5uZXdDbGFzcyh7XG4gICAgICBzZWxlY3RvcjogbnVsbCxcbiAgICAgIENsYXNzVHlwZTogdGhpcy5tdXJlLkNMQVNTRVMuRWRnZUNsYXNzLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIGRpcmVjdGVkXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ29ubmVjdGlvbnNbZWRnZUNsYXNzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWU6IHRoaXNIYXNoTmFtZSB9O1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1tlZGdlQ2xhc3MuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZTogb3RoZXJIYXNoTmFtZSB9O1xuICAgIGRlbGV0ZSB0aGlzLl9zdHJlYW07XG4gICAgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDb25uZWN0aW9ucykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcblxuICAgIGlmICghdGhpcy5fc2VsZWN0b3IpIHtcbiAgICAgIGlmICghc291cmNlQ2xhc3MgfHwgIXRhcmdldENsYXNzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFydGlhbCBjb25uZWN0aW9ucyB3aXRob3V0IGFuIGVkZ2UgdGFibGUgc2hvdWxkIG5ldmVyIGhhcHBlbmApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm8gZWRnZSB0YWJsZSAoc2ltcGxlIGpvaW4gYmV0d2VlbiB0d28gbm9kZXMpXG4gICAgICAgIGNvbnN0IHNvdXJjZUhhc2ggPSBzb3VyY2VDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIGNvbnN0IHRhcmdldEhhc2ggPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXS5ub2RlSGFzaE5hbWU7XG4gICAgICAgIHJldHVybiBzb3VyY2VDbGFzcy5zZWxlY3RvciArIGAuam9pbih0YXJnZXQsICR7c291cmNlSGFzaH0sICR7dGFyZ2V0SGFzaH0sIGRlZmF1bHRGaW5pc2gsIHNvdXJjZVRhcmdldClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5fc2VsZWN0b3I7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBQYXJ0aWFsIGVkZ2UtdGFyZ2V0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29uc3QgeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoLCBlZGdlVGFyZ2V0KWA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgIC8vIFBhcnRpYWwgc291cmNlLWVkZ2UgY29ubmVjdGlvbnNcbiAgICAgICAgY29uc3QgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaCwgc291cmNlRWRnZSlgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRnVsbCBjb25uZWN0aW9uc1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICAoeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0pO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIGZ1bGwpYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0ge307XG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgLy8gVXNlIHRoZSBvcHRpb25zIGZyb20gdGhlIHNvdXJjZSBzdHJlYW0gaW5zdGVhZCBvZiBvdXIgY2xhc3NcbiAgICAgIG9wdGlvbnMgPSBzb3VyY2VDbGFzcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IHN1cGVyLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIGlmIChzb3VyY2VDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy5zb3VyY2UgPSBzb3VyY2VDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXRDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLnRvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24gPT09ICdzb3VyY2UnKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICd0YXJnZXQnKSB7XG4gICAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb3VyY2UgYW5kIHRhcmdldCBhcmUgYWxyZWFkeSBkZWZpbmVkOyBwbGVhc2Ugc3BlY2lmeSBhIGRpcmVjdGlvbiB0byBvdmVycmlkZWApO1xuICAgICAgfVxuICAgIH1cbiAgICBub2RlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0gPSB7IG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH07XG4gICAgZGVsZXRlIHRoaXMuX3N0cmVhbTtcbiAgICB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBzb3VyY2VDbGFzc0lkO1xuICAgICAgfVxuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcih7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ3NvdXJjZVRhcmdldCcpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ubGVmdCxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLnJhd0l0ZW0ucmlnaHRcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0b2tlbi5lZGdlUm9sZSA9PT0gJ2VkZ2VUYXJnZXQnKSB7XG4gICAgICB0aGlzLnJhd0l0ZW0gPSB7XG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHRva2VuLmVkZ2VSb2xlID09PSAnc291cmNlRWRnZScpIHtcbiAgICAgIHRoaXMucmF3SXRlbSA9IHtcbiAgICAgICAgc291cmNlOiB0aGlzLnJhd0l0ZW0ucmlnaHQsXG4gICAgICAgIGVkZ2U6IHRoaXMucmF3SXRlbS5sZWZ0XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodG9rZW4uZWRnZVJvbGUgPT09ICdmdWxsJykge1xuICAgICAgdGhpcy5yYXdJdGVtID0ge1xuICAgICAgICBzb3VyY2U6IHRoaXMucmF3SXRlbS5sZWZ0LnJpZ2h0LFxuICAgICAgICBlZGdlOiB0aGlzLnJhd0l0ZW0ubGVmdC5sZWZ0LFxuICAgICAgICB0YXJnZXQ6IHRoaXMucmF3SXRlbS5yaWdodFxuICAgICAgfTtcbiAgICB9XG4gICAgLy8gaWYgdGhlcmUgaXMgbm8gZWRnZVJvbGUsIGxlYXZlIHRoZSByYXdJdGVtIGFzLWlzXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKHsgZW50cmllcyA9IHt9LCBjb21wbGV0ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIHRoaXMuZW50cmllcyA9IGVudHJpZXM7XG4gICAgdGhpcy5jb21wbGV0ZSA9IGNvbXBsZXRlO1xuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzO1xuICB9XG4gIGFzeW5jICogaXRlckVudHJpZXMgKCkge1xuICAgIGZvciAoY29uc3QgW2hhc2gsIHZhbHVlTGlzdF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgeyBoYXNoLCB2YWx1ZUxpc3QgfTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVySGFzaGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IGhhc2ggb2YgT2JqZWN0LmtleXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgaGFzaDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyVmFsdWVMaXN0cyAoKSB7XG4gICAgZm9yIChjb25zdCB2YWx1ZUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB2YWx1ZUxpc3Q7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldFZhbHVlTGlzdCAoaGFzaCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNbaGFzaF0gfHwgW107XG4gIH1cbiAgYXN5bmMgYWRkVmFsdWUgKGhhc2gsIHZhbHVlKSB7XG4gICAgLy8gVE9ETzogYWRkIHNvbWUga2luZCBvZiB3YXJuaW5nIGlmIHRoaXMgaXMgZ2V0dGluZyBiaWc/XG4gICAgdGhpcy5lbnRyaWVzW2hhc2hdID0gYXdhaXQgdGhpcy5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgaWYgKHRoaXMuZW50cmllc1toYXNoXS5pbmRleE9mKHZhbHVlKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy5yb290ID0gdGhpcy5sb2FkUm9vdCgpO1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgb3VyIGNsYXNzIHNwZWNpZmljYXRpb25zXG4gICAgdGhpcy5jbGFzc2VzID0gdGhpcy5sb2FkQ2xhc3NlcygpO1xuICB9XG5cbiAgbG9hZFJvb3QgKCkge1xuICAgIGxldCByb290ID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9yb290Jyk7XG4gICAgcm9vdCA9IHJvb3QgPyBKU09OLnBhcnNlKHJvb3QpIDoge307XG4gICAgcmV0dXJuIHJvb3Q7XG4gIH1cbiAgc2F2ZVJvb3QgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnbXVyZV9yb290JywgSlNPTi5zdHJpbmdpZnkodGhpcy5yb290KSk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncm9vdFVwZGF0ZScpO1xuICB9XG4gIGxvYWRDbGFzc2VzICgpIHtcbiAgICBsZXQgY2xhc3NlcyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfY2xhc3NlcycpO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzID8gSlNPTi5wYXJzZShjbGFzc2VzKSA6IHt9O1xuICAgIE9iamVjdC5lbnRyaWVzKGNsYXNzZXMpLmZvckVhY2goKFsgY2xhc3NJZCwgcmF3Q2xhc3NPYmogXSkgPT4ge1xuICAgICAgY29uc3QgY2xhc3NUeXBlID0gcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgZGVsZXRlIHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIHJhd0NsYXNzT2JqLm11cmUgPSB0aGlzO1xuICAgICAgY2xhc3Nlc1tjbGFzc0lkXSA9IG5ldyB0aGlzLkNMQVNTRVNbY2xhc3NUeXBlXShyYXdDbGFzc09iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGNsYXNzZXM7XG4gIH1cbiAgc2F2ZUNsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgcmF3Q2xhc3NlcyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBbIGNsYXNzSWQsIGNsYXNzT2JqIF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgICByYXdDbGFzc2VzW2NsYXNzSWRdID0gY2xhc3NPYmoudG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfY2xhc3NlcycsIEpTT04uc3RyaW5naWZ5KHJhd0NsYXNzZXMpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBjb25zdCBzdGFydHNXaXRoUm9vdCA9IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKTtcbiAgICBpZiAoIShzdGFydHNXaXRoUm9vdCB8fCBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdlbXB0eScpKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290JyBvciAnZW1wdHknYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogc3RhcnRzV2l0aFJvb3QgPyB0aGlzLlRPS0VOUy5Sb290VG9rZW4gOiB0aGlzLlRPS0VOUy5FbXB0eVRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3RgIH0pIHtcbiAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgY29uc3QgQ2xhc3NUeXBlID0gb3B0aW9ucy5DbGFzc1R5cGUgfHwgdGhpcy5DTEFTU0VTLkdlbmVyaWNDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5DbGFzc1R5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgdGhpcy5zYXZlUm9vdCgpO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pO1xuICB9XG4gIHJlbW92ZURhdGFTb3VyY2UgKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLnJvb3Rba2V5XTtcbiAgICB0aGlzLnNhdmVSb290KCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUod2luZG93LkZpbGVSZWFkZXIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImZvckVhY2giLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJPYmplY3QiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsInRva2VuQ2xhc3NMaXN0IiwidG9rZW5MaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwiaW5kZXhlcyIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImNsYXNzVG9rZW5MaXN0IiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJjb25zb2xlIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsImZvcmsiLCJwYXJzZVNlbGVjdG9yIiwiZXh0ZW5kIiwiY29uY2F0Iiwid3JhcCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIndyYXBwZWRJdGVtIiwiZ2V0SW5kZXgiLCJoYXNoRnVuY3Rpb25OYW1lIiwidG9rZW5JbmRleCIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwiaXRlcmF0ZSIsImxhc3RUb2tlbiIsInNhbXBsZSIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiaXNTdWJTZXRPZiIsImFuY2VzdG9yVG9rZW5zIiwiRXJyb3IiLCJpdGVyYXRlUGFyZW50IiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIkVtcHR5VG9rZW4iLCJSb290VG9rZW4iLCJyb290IiwiS2V5c1Rva2VuIiwibWF0Y2hBbGwiLCJrZXlzIiwicmFuZ2VzIiwidW5kZWZpbmVkIiwiYXJnIiwibWF0Y2giLCJJbmZpbml0eSIsImQiLCJwYXJzZUludCIsImlzTmFOIiwibG93IiwiaGlnaCIsIm51bSIsIk51bWJlciIsIlN5bnRheEVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJkaWZmZXJlbmNlIiwib3RoZXJUb2tlbiIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJyZWR1Y2UiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIkluZGV4ZWRUb2tlbiIsImhhc2hGdW5jTmFtZSIsImhhc2giLCJlbnRyaWVzIiwiYWRkVmFsdWUiLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJoYXNoRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwiZWRnZVJvbGUiLCJoYXNoVGhpc0dyYW5kcGFyZW50IiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiY29tcGxldGUiLCJ2YWx1ZUxpc3QiLCJpdGVyRW50cmllcyIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNIYXNoSXRlbSIsInRoaXNJdGVyYXRvciIsInRoaXNJbmRpcmVjdEtleSIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJBU1RFUklTS1MiLCJHZW5lcmljQ2xhc3MiLCJjbGFzc0lkIiwiX3NlbGVjdG9yIiwiY3VzdG9tQ2xhc3NOYW1lIiwiY3VzdG9tTmFtZVRva2VuSW5kZXgiLCJmdW5jTmFtZSIsIkZ1bmN0aW9uIiwidG9SYXdPYmplY3QiLCJyZXN1bHQiLCJjbGFzc1R5cGUiLCJzdHJpbmdpZmllZEZ1bmMiLCJzZXRDbGFzc05hbWUiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJjbGFzc05hbWUiLCJ0b2tlblN0cmluZ3MiLCJzdGFydHNXaXRoIiwiYWRkSGFzaEZ1bmN0aW9uIiwicG9wdWxhdGVTdHJlYW1PcHRpb25zIiwiZ2V0U3RyZWFtIiwicmVzZXQiLCJfc3RyZWFtIiwiaXNTdXBlclNldE9mVG9rZW5MaXN0IiwiaXNTdXBlclNldE9mIiwiaW50ZXJwcmV0QXNOb2RlcyIsIkNMQVNTRVMiLCJOb2RlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiRWRnZUNsYXNzIiwiYWdncmVnYXRlIiwiZXhwYW5kIiwic3BsaXQiLCJkZWxldGUiLCJOb2RlV3JhcHBlciIsImVkZ2VDb25uZWN0aW9ucyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwiZGlyZWN0ZWQiLCJ0aGlzSGFzaE5hbWUiLCJvdGhlckhhc2hOYW1lIiwiZWRnZUNsYXNzIiwibmV3Q2xhc3MiLCJDbGFzc1R5cGUiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsIm5vZGVIYXNoTmFtZSIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJ0YXJnZXQiLCJzb3VyY2UiLCJkaXJlY3Rpb24iLCJ0b2dnbGVOb2RlRGlyZWN0aW9uIiwibGVmdCIsInJpZ2h0IiwiZWRnZSIsIml0ZXJIYXNoZXMiLCJpdGVyVmFsdWVMaXN0cyIsIk5FWFRfQ0xBU1NfSUQiLCJNdXJlIiwiRmlsZVJlYWRlciIsImxvY2FsU3RvcmFnZSIsIm1pbWUiLCJEQVRBTElCX0ZPUk1BVFMiLCJUT0tFTlMiLCJ0b2tlbkNsYXNzTmFtZSIsInByb3RvdHlwZSIsImlkZW50aXR5IiwicGFyZW50VHlwZSIsImRlZmF1bHRGaW5pc2giLCJzaGExIiwibm9vcCIsImxvYWRSb290IiwibG9hZENsYXNzZXMiLCJnZXRJdGVtIiwicGFyc2UiLCJzYXZlUm9vdCIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0NsYXNzZXMiLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGhSb290IiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInRyaW0iLCJhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwiY2hhcnNldCIsImV4dGVuc2lvbk92ZXJyaWRlIiwic2tpcFNpemVDaGVjayIsImZpbGVNQiIsInNpemUiLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInJlbW92ZURhdGFTb3VyY2UiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGFBQUwsR0FBcUIsRUFBckI7V0FDS0MsY0FBTCxHQUFzQixFQUF0Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCQyx1QkFBdkIsRUFBZ0Q7VUFDNUMsQ0FBQyxLQUFLTCxhQUFMLENBQW1CRyxTQUFuQixDQUFMLEVBQW9DO2FBQzdCSCxhQUFMLENBQW1CRyxTQUFuQixJQUFnQyxFQUFoQzs7O1VBRUUsQ0FBQ0UsdUJBQUwsRUFBOEI7WUFDeEIsS0FBS0wsYUFBTCxDQUFtQkcsU0FBbkIsRUFBOEJHLE9BQTlCLENBQXNDRixRQUF0QyxNQUFvRCxDQUFDLENB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
