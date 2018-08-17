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
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || { argObj: {} };
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

var asyncIterator = function (iterable) {
  if (typeof Symbol === "function") {
    if (Symbol.asyncIterator) {
      var method = iterable[Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (Symbol.iterator) {
      return iterable[Symbol.iterator]();
    }
  }

  throw new TypeError("Object is not async iterable");
};

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();

var asyncGeneratorDelegate = function (inner, awaitWrap) {
  var iter = {},
      waiting = false;

  function pump(key, value) {
    waiting = true;
    value = new Promise(function (resolve) {
      resolve(inner[key](value));
    });
    return {
      done: false,
      value: awaitWrap(value)
    };
  }

  if (typeof Symbol === "function" && Symbol.iterator) {
    iter[Symbol.iterator] = function () {
      return this;
    };
  }

  iter.next = function (value) {
    if (waiting) {
      waiting = false;
      return value;
    }

    return pump("next", value);
  };

  if (typeof inner.throw === "function") {
    iter.throw = function (value) {
      if (waiting) {
        waiting = false;
        throw value;
      }

      return pump("throw", value);
    };
  }

  if (typeof inner.return === "function") {
    iter.return = function (value) {
      return pump("return", value);
    };
  }

  return iter;
};

var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

class Stream {
  constructor(options) {
    this.mure = options.mure;
    this.tokenList = options.tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams;
    this.traversalMode = options.traversalMode || 'DFS';
    this.launchedFromClass = options.launchedFromClass || null;
    this.Wrappers = this.getWrapperList();
    this.indexes = options.indexes || {};
  }

  getWrapperList() {
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
      const potentialWrappers = Object.values(this.mure.classes).filter(classObj => {
        if (!classObj.tokenClassList.length !== localTokenList.length) {
          return false;
        }
        return localTokenList.every((localToken, localIndex) => {
          const tokenClassSpec = classObj.tokenClassList[localIndex];
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
      traversalMode: this.traversalMode,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.tokenClassList = this.tokenClassList.concat({ TokenClass, argList });
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.traversalMode = options.traversalMode || this.traversalMode;
    return new Stream(options);
  }

  wrap({ wrappedParent, token, rawItem, hashes = {} }) {
    let wrapperIndex = 0;
    let temp = wrappedParent;
    while (temp !== null) {
      wrapperIndex += 1;
      temp = temp.wrappedParent;
    }
    const wrappedItem = new this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
    Object.entries(hashes).forEach(([hashFunctionName, hash]) => {
      const index = this.getIndex(hashFunctionName);
      if (!index.complete) {
        index.addValue(hash, wrappedItem);
      }
    });
    return wrappedItem;
  }

  iterate() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (_this.traversalMode === 'BFS') {
        throw new Error(`Breadth-first iteration is not yet implemented.`);
      } else if (_this.traversalMode === 'DFS') {
        const deepHelper = _this.deepHelper(_this.tokenList, _this.tokenList.length - 1);
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = asyncIterator(deepHelper), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const wrappedItem = _value;

            if (!(wrappedItem instanceof _this.mure.WRAPPERS.GenericWrapper)) {
              if (_this.mure.debug) {
                console.warn(wrappedItem);
              }
            } else {
              yield wrappedItem;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              yield asyncGenerator.await(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      } else {
        throw new Error(`Unknown traversalMode: ${_this.traversalMode}`);
      }
    })();
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  deepHelper(tokenList, i) {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      if (i === 0) {
        yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(tokenList[0].navigate()))), asyncGenerator.await); // The first token is always the root
      } else {
        let parentYieldedSomething = false;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = asyncIterator(_this2.deepHelper(tokenList, i - 1)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            let wrappedParent = _value2;

            parentYieldedSomething = true;
            if (wrappedParent instanceof _this2.mure.WRAPPERS.GenericWrapper) {
              const iterator = yield asyncGenerator.await(tokenList[i].navigate(wrappedParent));
              yield* asyncGeneratorDelegate(asyncIterator(iterator), asyncGenerator.await);
            } else {
              yield wrappedParent;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              yield asyncGenerator.await(_iterator2.return());
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }

        if (_this2.mure.debug && !parentYieldedSomething) {
          yield `Token yielded nothing: ${tokenList[i - 1]}`;
        }
      }
    })();
  }

  getIndex(hashFunctionName) {
    if (!this.indexes[hashFunctionName]) {
      // TODO: if using node.js, start with external / more scalable indexes
      this.indexes[hashFunctionName] = new this.mure.INDEXES.InMemoryIndex();
    }
    return this.indexes[hashFunctionName];
  }

  sample({ limit = 10, rebuildIndexes = false }) {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      // Before we start, clean out any old indexes that were never finished
      Object.entries(_this3.indexes).forEach(function ([hashFunctionName, index]) {
        if (rebuildIndexes || !index.complete) {
          delete _this3.indexes[hashFunctionName];
        }
      });
      const iterator = _this3.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          // We actually finished a full pass; flag all of our indexes as complete
          Object.values(_this3.indexes).forEach(function (index) {
            index.complete = true;
          });
          break;
        }
        yield temp.value;
      }
    })();
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
  navigate(wrappedParent) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`This function should be overridden`);
    })();
  }
}
Object.defineProperty(BaseToken, 'type', {
  get() {
    return (/(.*)Token/.exec(this.name)[1]
    );
  }
});

class RootToken extends BaseToken {
  *navigate() {
    yield this.stream.wrap({
      wrappedParent: null,
      token: this,
      rawItem: this.stream.mure.root
    });
  }
  toString() {
    return `root`;
  }
}

class KeysToken extends BaseToken {
  constructor(stream, argList, { matchAll, keys, ranges } = {}) {
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
            this.ranges.push({ low: temp[1], high: temp[2] });
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
          this.ranges.push({ low: num, high: num });
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
            return agg.concat([{ include: true, low: true, value: range.low }, { include: true, high: true, value: range.high }]);
          }, []);
          allPoints = allPoints.concat(otherToken.ranges.reduce((agg, range) => {
            return agg.concat([{ exclude: true, low: true, value: range.low }, { exclude: true, high: true, value: range.high }]);
          }, [])).sort();
          let currentRange = null;
          for (let i = 0; i < allPoints.length; i++) {
            if (currentRange === null) {
              if (allPoints[i].include && allPoints[i].low) {
                currentRange = { low: allPoints[i].value };
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
      return new KeysToken(this.mure, null, { keys: newKeys, ranges: newRanges });
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
    return '.keys(' + (this.ranges || []).map(({ low, high }) => {
      return low === high ? low : `${low}-${high}`;
    }).concat(Object.keys(this.keys || {}).map(key => `'${key}'`)).join(',') + ')';
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.rawItem !== 'object') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`Input to KeysToken is not an object`);
        } else {
          return;
        }
      }
      if (_this.matchAll) {
        for (let key in wrappedParent.rawItem) {
          yield _this.stream.wrap({
            wrappedParent,
            token: _this,
            rawItem: key
          });
        }
      } else {
        for (let _ref of _this.ranges || []) {
          let { low, high } = _ref;

          low = Math.max(0, low);
          high = Math.min(wrappedParent.rawItem.length - 1, high);
          for (let i = low; i <= high; i++) {
            if (wrappedParent.rawItem[i] !== undefined) {
              yield _this.stream.wrap({
                wrappedParent,
                token: _this,
                rawItem: i
              });
            }
          }
        }
        for (let key in _this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield _this.stream.wrap({
              wrappedParent,
              token: _this,
              rawItem: key
            });
          }
        }
      }
    })();
  }
}

class ValueToken extends BaseToken {
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
      const key = wrappedParent && wrappedParent.rawItem;
      const keyType = typeof key;
      if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
        } else {
          return;
        }
      }
      yield _this.stream.wrap({
        wrappedParent,
        token: _this,
        rawItem: obj[key]
      });
    })();
  }
}

class EvaluateToken extends BaseToken {
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      if (typeof wrappedParent.rawItem !== 'string') {
        if (!_this.stream.mure.debug) {
          throw new TypeError(`Input to EvaluateToken is not a string`);
        } else {
          return;
        }
      }
      let newStream;
      try {
        newStream = _this.stream.fork(wrappedParent.rawItem);
      } catch (err) {
        if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          return;
        }
      }
      yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(newStream.iterate()))), asyncGenerator.await);
    })();
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
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.stream.namedFunctions[_this.generator](wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          yield _this.stream.wrap({
            wrappedParent,
            token: _this,
            rawItem: mappedRawItem
          });
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}

class PromoteToken extends BaseToken {
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
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const mapFunction = _this.stream.namedFunctions[_this.map];
      const hashFunction = _this.stream.namedFunctions[_this.hash];
      const reduceInstancesFunction = _this.stream.namedFunctions[_this.reduceInstances];
      const hashIndex = _this.stream.getIndex(_this.hash);
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(mapFunction(wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          const hashValue = hashFunction(mappedRawItem);
          let originalWrappedItem = hashIndex.getValues(hashValue)[0];
          if (originalWrappedItem) {
            if (_this.reduceInstances !== 'noop') {
              reduceInstancesFunction(originalWrappedItem, mappedRawItem);
              originalWrappedItem.trigger('update');
            }
          } else {
            const hashes = {};
            hashes[_this.hash] = hashValue;
            yield _this.stream.wrap({
              wrappedParent,
              token: _this,
              rawItem: mappedRawItem,
              hashes
            });
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            yield asyncGenerator.await(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }
}



var TOKENS = /*#__PURE__*/Object.freeze({
  RootToken: RootToken,
  KeysToken: KeysToken,
  ValueToken: ValueToken,
  EvaluateToken: EvaluateToken,
  MapToken: MapToken,
  PromoteToken: PromoteToken
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.tokenClassList = this.mure.parseSelector(options.selector || `root.values()`);
  }
  wrap(options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
  getStream(options = {}) {
    if (options.reset || !this._stream) {
      options.mure = this.mure;
      options.tokenClassList = this.tokenClassList;
      options.namedFunctions = this.namedFunctions;
      options.launchedFromClass = this;
      this._stream = new Stream(options);
    }
    return this._stream;
  }
  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
}
Object.defineProperty(GenericClass, 'type', {
  get() {
    return (/(.*)Class/.exec(this.name)[1]
    );
  }
});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.NodeWrapper;
  }
}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
  }
}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor({ wrappedParent, token, rawItem }) {
    super();
    this.wrappedParent = wrappedParent;
    this.token = token;
    this.rawItem = rawItem;
  }
}
Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return (/(.*)Wrapper/.exec(this.name)[1]
    );
  }
});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor() {
    this.entries = {};
    this.complete = false;
  }
  *iterValues(key) {
    for (let value of this.entries[key] || []) {
      yield value;
    }
  }
  getValues(key) {
    return this.entries[key] || [];
  }
  addValue(key, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[key] = this.getValues(key);
    this.entries[key].push(value);
  }
}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node
    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams

    // Object containing each of our data sources
    this.root = {};
    this.classes = {};

    // extensions that we want datalib to handle
    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    };

    this.TRUTHY_STRINGS = {
      'true': true,
      'yes': true,
      'y': true
    };
    this.FALSEY_STRINGS = {
      'false': true,
      'no': true,
      'n': true
    };

    // Access to core classes via the main library helps avoid circular imports
    this.TOKENS = TOKENS;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, options) {
        return this.extend(TokenClass, argList, options);
      };
    }

    // Default named functions
    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedParent) {
        yield wrappedParent.rawItem;
      },
      key: function* (wrappedParent) {
        const parentType = typeof wrappedParent.rawItem;
        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else if (!wrappedParent.wrappedParent || typeof wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Parent is not an object / array`);
        } else {
          yield wrappedParent.rawItem;
        }
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };
  }

  parseSelector(selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenClassList = [{
      TokenClass: this.TOKENS.RootToken
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
    return new Stream({
      mure: this,
      namedFunctions: Object.assign({}, this.NAMED_FUNCTIONS, options.namedFunctions || {}),
      tokenClassList: this.parseSelector(options.selector || `root.values()`)
    });
  }

  newClass(options = { selector: `root.values()` }) {
    if (this.classes[options.selector]) {
      return this.classes[options.selector];
    }
    const ClassType = options.ClassType || this.CLASSES.GenericClass;
    delete options.ClassType;
    options.mure = this;
    this.classes[options.selector] = new ClassType(options);
    return this.classes[options.selector];
  }

  addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    var _this = this;

    return asyncToGenerator(function* () {
      const fileMB = fileObj.size / 1048576;
      if (fileMB >= 30) {
        if (skipSizeCheck) {
          console.warn(`Attempting to load ${fileMB}MB file into memory`);
        } else {
          throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicDataSource() instead.`);
        }
      }
      // extensionOverride allows things like topojson or treejson (that don't
      // have standardized mimeTypes) to be parsed correctly
      let text = yield new Promise(function (resolve, reject) {
        let reader = new _this.FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsText(fileObj, encoding);
      });
      return _this.addStringAsStaticDataSource({
        key: fileObj.name,
        extension: extensionOverride || mime.extension(fileObj.type),
        text
      });
    })();
  }
  addStringAsStaticDataSource({
    key,
    extension = 'txt',
    text
  }) {
    var _this2 = this;

    return asyncToGenerator(function* () {
      let obj;
      if (_this2.DATALIB_FORMATS[extension]) {
        obj = datalib.read(text, { type: extension });
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
      return _this2.addStaticDataSource(key, obj);
    })();
  }
  addStaticDataSource(key, obj) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      _this3.root[key] = obj;
      return _this3.newClass({
        selector: `root.values('${key}').values()`
      });
    })();
  }

  removeDataSource(key) {
    delete this.root[key];
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
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
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
	"babel-preset-stage-3": "^6.24.1",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	"pouchdb-node": "^7.0.0",
	rollup: "^0.64.1",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.5",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	"mime-types": "^2.1.19",
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

let mure = new Mure(window.FileReader);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0luZGV4ZXMvSW5NZW1vcnlJbmRleC5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcztcbiAgICB0aGlzLnRyYXZlcnNhbE1vZGUgPSBvcHRpb25zLnRyYXZlcnNhbE1vZGUgfHwgJ0RGUyc7XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgfVxuXG4gIGdldFdyYXBwZXJMaXN0ICgpIHtcbiAgICAvLyBMb29rIHVwIHdoaWNoLCBpZiBhbnksIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHJlc3VsdCBvZiBlYWNoIHRva2VuLCBzbyB0aGF0XG4gICAgLy8gd2UgY2FuIHdyYXAgaXRlbXMgYXBwcm9wcmlhdGVseTpcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QubWFwKCh0b2tlbiwgaW5kZXgpID0+IHtcbiAgICAgIGlmIChpbmRleCA9PT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSAmJiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzKSB7XG4gICAgICAgIC8vIElmIHRoaXMgc3RyZWFtIHdhcyBzdGFydGVkIGZyb20gYSBjbGFzcywgd2UgYWxyZWFkeSBrbm93IHdlIHNob3VsZFxuICAgICAgICAvLyB1c2UgdGhhdCBjbGFzcydzIHdyYXBwZXIgZm9yIHRoZSBsYXN0IHRva2VuXG4gICAgICAgIHJldHVybiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLldyYXBwZXI7XG4gICAgICB9XG4gICAgICAvLyBGaW5kIGEgY2xhc3MgdGhhdCBkZXNjcmliZXMgZXhhY3RseSBlYWNoIHNlcmllcyBvZiB0b2tlbnNcbiAgICAgIGNvbnN0IGxvY2FsVG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgaW5kZXggKyAxKTtcbiAgICAgIGNvbnN0IHBvdGVudGlhbFdyYXBwZXJzID0gT2JqZWN0LnZhbHVlcyh0aGlzLm11cmUuY2xhc3NlcylcbiAgICAgICAgLmZpbHRlcihjbGFzc09iaiA9PiB7XG4gICAgICAgICAgaWYgKCFjbGFzc09iai50b2tlbkNsYXNzTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICB0cmF2ZXJzYWxNb2RlOiB0aGlzLnRyYXZlcnNhbE1vZGUsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3NcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgb3B0aW9ucy50cmF2ZXJzYWxNb2RlID0gb3B0aW9ucy50cmF2ZXJzYWxNb2RlIHx8IHRoaXMudHJhdmVyc2FsTW9kZTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBsZXQgd3JhcHBlckluZGV4ID0gMDtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHdyYXBwZXJJbmRleCArPSAxO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgT2JqZWN0LmVudHJpZXMoaGFzaGVzKS5mb3JFYWNoKChbaGFzaEZ1bmN0aW9uTmFtZSwgaGFzaF0pID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICAgIGlmICghaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgaWYgKHRoaXMudHJhdmVyc2FsTW9kZSA9PT0gJ0JGUycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQnJlYWR0aC1maXJzdCBpdGVyYXRpb24gaXMgbm90IHlldCBpbXBsZW1lbnRlZC5gKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMudHJhdmVyc2FsTW9kZSA9PT0gJ0RGUycpIHtcbiAgICAgIGNvbnN0IGRlZXBIZWxwZXIgPSB0aGlzLmRlZXBIZWxwZXIodGhpcy50b2tlbkxpc3QsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiBkZWVwSGVscGVyKSB7XG4gICAgICAgIGlmICghKHdyYXBwZWRJdGVtIGluc3RhbmNlb2YgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKSkge1xuICAgICAgICAgIGlmICh0aGlzLm11cmUuZGVidWcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih3cmFwcGVkSXRlbSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0cmF2ZXJzYWxNb2RlOiAke3RoaXMudHJhdmVyc2FsTW9kZX1gKTtcbiAgICB9XG4gIH1cbiAgLyoqXG4gICAqIFRoaXMgaGVscHMgZGVwdGgtZmlyc3QgaXRlcmF0aW9uICh3ZSBvbmx5IHdhbnQgdG8geWllbGQgZmluaXNoZWQgcGF0aHMsIHNvXG4gICAqIGl0IGxhemlseSBhc2tzIGZvciB0aGVtIG9uZSBhdCBhIHRpbWUgZnJvbSB0aGUgKmZpbmFsKiB0b2tlbiwgcmVjdXJzaXZlbHlcbiAgICogYXNraW5nIGVhY2ggcHJlY2VkaW5nIHRva2VuIHRvIHlpZWxkIGRlcGVuZGVudCBwYXRocyBvbmx5IGFzIG5lZWRlZClcbiAgICovXG4gIGFzeW5jICogZGVlcEhlbHBlciAodG9rZW5MaXN0LCBpKSB7XG4gICAgaWYgKGkgPT09IDApIHtcbiAgICAgIHlpZWxkICogYXdhaXQgdG9rZW5MaXN0WzBdLm5hdmlnYXRlKCk7IC8vIFRoZSBmaXJzdCB0b2tlbiBpcyBhbHdheXMgdGhlIHJvb3RcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IHBhcmVudFlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICAgIGZvciBhd2FpdCAobGV0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5kZWVwSGVscGVyKHRva2VuTGlzdCwgaSAtIDEpKSB7XG4gICAgICAgIHBhcmVudFlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudCBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcikge1xuICAgICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gYXdhaXQgdG9rZW5MaXN0W2ldLm5hdmlnYXRlKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICAgIHlpZWxkICogaXRlcmF0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubXVyZS5kZWJ1ZyAmJiAhcGFyZW50WWllbGRlZFNvbWV0aGluZykge1xuICAgICAgICB5aWVsZCBgVG9rZW4geWllbGRlZCBub3RoaW5nOiAke3Rva2VuTGlzdFtpIC0gMV19YDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICAvLyBUT0RPOiBpZiB1c2luZyBub2RlLmpzLCBzdGFydCB3aXRoIGV4dGVybmFsIC8gbW9yZSBzY2FsYWJsZSBpbmRleGVzXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgLy8gQmVmb3JlIHdlIHN0YXJ0LCBjbGVhbiBvdXQgYW55IG9sZCBpbmRleGVzIHRoYXQgd2VyZSBuZXZlciBmaW5pc2hlZFxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaCgoW2hhc2hGdW5jdGlvbk5hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKHJlYnVpbGRJbmRleGVzIHx8ICFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAvLyBXZSBhY3R1YWxseSBmaW5pc2hlZCBhIGZ1bGwgcGFzczsgZmxhZyBhbGwgb2Ygb3VyIGluZGV4ZXMgYXMgY29tcGxldGVcbiAgICAgICAgT2JqZWN0LnZhbHVlcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goaW5kZXggPT4ge1xuICAgICAgICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgKiBuYXZpZ2F0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50OiBudWxsLFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiB0aGlzLnN0cmVhbS5tdXJlLnJvb3RcbiAgICB9KTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGByb290YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUm9vdFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEtleXNUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIGFyZ0xpc3QsIHsgbWF0Y2hBbGwsIGtleXMsIHJhbmdlcyB9ID0ge30pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmIChrZXlzIHx8IHJhbmdlcykge1xuICAgICAgdGhpcy5rZXlzID0ga2V5cztcbiAgICAgIHRoaXMucmFuZ2VzID0gcmFuZ2VzO1xuICAgIH0gZWxzZSBpZiAoKGFyZ0xpc3QgJiYgYXJnTGlzdC5sZW5ndGggPT09IDEgJiYgYXJnTGlzdFswXSA9PT0gdW5kZWZpbmVkKSB8fCBtYXRjaEFsbCkge1xuICAgICAgdGhpcy5tYXRjaEFsbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ0xpc3QuZm9yRWFjaChhcmcgPT4ge1xuICAgICAgICBsZXQgdGVtcCA9IGFyZy5tYXRjaCgvKFxcZCspLShbXFxk4oieXSspLyk7XG4gICAgICAgIGlmICh0ZW1wICYmIHRlbXBbMl0gPT09ICfiiJ4nKSB7XG4gICAgICAgICAgdGVtcFsyXSA9IEluZmluaXR5O1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSB0ZW1wID8gdGVtcC5tYXAoZCA9PiBkLnBhcnNlSW50KGQpKSA6IG51bGw7XG4gICAgICAgIGlmICh0ZW1wICYmICFpc05hTih0ZW1wWzFdKSAmJiAhaXNOYU4odGVtcFsyXSkpIHtcbiAgICAgICAgICBmb3IgKGxldCBpID0gdGVtcFsxXTsgaSA8PSB0ZW1wWzJdOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiB0ZW1wWzFdLCBoaWdoOiB0ZW1wWzJdIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IGFyZy5tYXRjaCgvJyguKiknLyk7XG4gICAgICAgIHRlbXAgPSB0ZW1wICYmIHRlbXBbMV0gPyB0ZW1wWzFdIDogYXJnO1xuICAgICAgICBsZXQgbnVtID0gTnVtYmVyKHRlbXApO1xuICAgICAgICBpZiAoaXNOYU4obnVtKSB8fCBudW0gIT09IHBhcnNlSW50KHRlbXApKSB7IC8vIGxlYXZlIG5vbi1pbnRlZ2VyIG51bWJlcnMgYXMgc3RyaW5nc1xuICAgICAgICAgIHRoaXMua2V5cyA9IHRoaXMua2V5cyB8fCB7fTtcbiAgICAgICAgICB0aGlzLmtleXNbdGVtcF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5yYW5nZXMgfHwgW107XG4gICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogbnVtLCBoaWdoOiBudW0gfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgQmFkIHRva2VuIGtleShzKSAvIHJhbmdlKHMpOiAke0pTT04uc3RyaW5naWZ5KGFyZ0xpc3QpfWApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgIHRoaXMucmFuZ2VzID0gdGhpcy5jb25zb2xpZGF0ZVJhbmdlcyh0aGlzLnJhbmdlcyk7XG4gICAgfVxuICB9XG4gIGdldCBzZWxlY3RzTm90aGluZyAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1hdGNoQWxsICYmICF0aGlzLmtleXMgJiYgIXRoaXMucmFuZ2VzO1xuICB9XG4gIGNvbnNvbGlkYXRlUmFuZ2VzIChyYW5nZXMpIHtcbiAgICAvLyBNZXJnZSBhbnkgb3ZlcmxhcHBpbmcgcmFuZ2VzXG4gICAgY29uc3QgbmV3UmFuZ2VzID0gW107XG4gICAgY29uc3QgdGVtcCA9IHJhbmdlcy5zb3J0KChhLCBiKSA9PiBhLmxvdyAtIGIubG93KTtcbiAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRlbXAubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICghY3VycmVudFJhbmdlKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9IGVsc2UgaWYgKHRlbXBbaV0ubG93IDw9IGN1cnJlbnRSYW5nZS5oaWdoKSB7XG4gICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gdGVtcFtpXS5oaWdoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGN1cnJlbnRSYW5nZSkge1xuICAgICAgLy8gQ29ybmVyIGNhc2U6IGFkZCB0aGUgbGFzdCByYW5nZVxuICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld1Jhbmdlcy5sZW5ndGggPiAwID8gbmV3UmFuZ2VzIDogdW5kZWZpbmVkO1xuICB9XG4gIGRpZmZlcmVuY2UgKG90aGVyVG9rZW4pIHtcbiAgICAvLyBDb21wdXRlIHdoYXQgaXMgbGVmdCBvZiB0aGlzIGFmdGVyIHN1YnRyYWN0aW5nIG91dCBldmVyeXRoaW5nIGluIG90aGVyVG9rZW5cbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBjb21wdXRlIHRoZSBkaWZmZXJlbmNlIG9mIHR3byBkaWZmZXJlbnQgdG9rZW4gdHlwZXNgKTtcbiAgICB9IGVsc2UgaWYgKG90aGVyVG9rZW4ubWF0Y2hBbGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgY29uc29sZS53YXJuKGBJbmFjY3VyYXRlIGRpZmZlcmVuY2UgY29tcHV0ZWQhIFRPRE86IG5lZWQgdG8gZmlndXJlIG91dCBob3cgdG8gaW52ZXJ0IGNhdGVnb3JpY2FsIGtleXMhYCk7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3S2V5cyA9IHt9O1xuICAgICAgZm9yIChsZXQga2V5IGluICh0aGlzLmtleXMgfHwge30pKSB7XG4gICAgICAgIGlmICghb3RoZXJUb2tlbi5rZXlzIHx8ICFvdGhlclRva2VuLmtleXNba2V5XSkge1xuICAgICAgICAgIG5ld0tleXNba2V5XSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdSYW5nZXMgPSBbXTtcbiAgICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgICBpZiAob3RoZXJUb2tlbi5yYW5nZXMpIHtcbiAgICAgICAgICBsZXQgYWxsUG9pbnRzID0gdGhpcy5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgaW5jbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pO1xuICAgICAgICAgIGFsbFBvaW50cyA9IGFsbFBvaW50cy5jb25jYXQob3RoZXJUb2tlbi5yYW5nZXMucmVkdWNlKChhZ2csIHJhbmdlKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYWdnLmNvbmNhdChbXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgbG93OiB0cnVlLCB2YWx1ZTogcmFuZ2UubG93IH0sXG4gICAgICAgICAgICAgIHsgZXhjbHVkZTogdHJ1ZSwgaGlnaDogdHJ1ZSwgdmFsdWU6IHJhbmdlLmhpZ2ggfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgICAgfSwgW10pKS5zb3J0KCk7XG4gICAgICAgICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSB7IGxvdzogYWxsUG9pbnRzW2ldLnZhbHVlIH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0udmFsdWU7XG4gICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uZXhjbHVkZSkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLmxvdyAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmhpZ2gpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UubG93ID0gYWxsUG9pbnRzW2ldLmhpZ2ggKyAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5ld1JhbmdlcyA9IHRoaXMucmFuZ2VzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IEtleXNUb2tlbih0aGlzLm11cmUsIG51bGwsIHsga2V5czogbmV3S2V5cywgcmFuZ2VzOiBuZXdSYW5nZXMgfSk7XG4gICAgfVxuICB9XG4gIGlzU3ViU2V0T2YgKGFyZ0xpc3QpIHtcbiAgICBjb25zdCBvdGhlclRva2VuID0gbmV3IEtleXNUb2tlbih0aGlzLnN0cmVhbSwgYXJnTGlzdCk7XG4gICAgY29uc3QgZGlmZiA9IG90aGVyVG9rZW4uZGlmZmVyZW5jZSh0aGlzKTtcbiAgICByZXR1cm4gZGlmZiA9PT0gbnVsbCB8fCBkaWZmLnNlbGVjdHNOb3RoaW5nO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICBpZiAodGhpcy5tYXRjaEFsbCkgeyByZXR1cm4gJy5rZXlzKCknOyB9XG4gICAgcmV0dXJuICcua2V5cygnICsgKHRoaXMucmFuZ2VzIHx8IFtdKS5tYXAoKHtsb3csIGhpZ2h9KSA9PiB7XG4gICAgICByZXR1cm4gbG93ID09PSBoaWdoID8gbG93IDogYCR7bG93fS0ke2hpZ2h9YDtcbiAgICB9KS5jb25jYXQoT2JqZWN0LmtleXModGhpcy5rZXlzIHx8IHt9KS5tYXAoa2V5ID0+IGAnJHtrZXl9J2ApKVxuICAgICAgLmpvaW4oJywnKSArICcpJztcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgIGhpZ2ggPSBNYXRoLm1pbih3cmFwcGVkUGFyZW50LnJhd0l0ZW0ubGVuZ3RoIC0gMSwgaGlnaCk7XG4gICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBjb25zdCBvYmogPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcgfHwgKGtleVR5cGUgIT09ICdzdHJpbmcnICYmIGtleVR5cGUgIT09ICdudW1iZXInKSkge1xuICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgfSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBFdmFsdWF0ZVRva2VuIGlzIG5vdCBhIHN0cmluZ2ApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbmV3U3RyZWFtO1xuICAgIHRyeSB7XG4gICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmdlbmVyYXRvcl0od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgY29uc3QgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLnJlZHVjZUluc3RhbmNlc107XG4gICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgIGNvbnN0IGhhc2hWYWx1ZSA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgIGxldCBvcmlnaW5hbFdyYXBwZWRJdGVtID0gaGFzaEluZGV4LmdldFZhbHVlcyhoYXNoVmFsdWUpWzBdO1xuICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbihvcmlnaW5hbFdyYXBwZWRJdGVtLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoVmFsdWU7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICBoYXNoZXNcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuLi9TdHJlYW0uanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgfVxuICB3cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJjbGFzcyBJbk1lbW9yeUluZGV4IHtcbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHRoaXMuZW50cmllcyA9IHt9O1xuICAgIHRoaXMuY29tcGxldGUgPSBmYWxzZTtcbiAgfVxuICAqIGl0ZXJWYWx1ZXMgKGtleSkge1xuICAgIGZvciAobGV0IHZhbHVlIG9mICh0aGlzLmVudHJpZXNba2V5XSB8fCBbXSkpIHtcbiAgICAgIHlpZWxkIHZhbHVlO1xuICAgIH1cbiAgfVxuICBnZXRWYWx1ZXMgKGtleSkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXNba2V5XSB8fCBbXTtcbiAgfVxuICBhZGRWYWx1ZSAoa2V5LCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1trZXldID0gdGhpcy5nZXRWYWx1ZXMoa2V5KTtcbiAgICB0aGlzLmVudHJpZXNba2V5XS5wdXNoKHZhbHVlKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHt9O1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgdGhpcy5UUlVUSFlfU1RSSU5HUyA9IHtcbiAgICAgICd0cnVlJzogdHJ1ZSxcbiAgICAgICd5ZXMnOiB0cnVlLFxuICAgICAgJ3knOiB0cnVlXG4gICAgfTtcbiAgICB0aGlzLkZBTFNFWV9TVFJJTkdTID0ge1xuICAgICAgJ2ZhbHNlJzogdHJ1ZSxcbiAgICAgICdubyc6IHRydWUsXG4gICAgICAnbic6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DTEFTU0VTID0gQ0xBU1NFUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG4gICAgdGhpcy5JTkRFWEVTID0gSU5ERVhFUztcblxuICAgIC8vIE1vbmtleS1wYXRjaCBhdmFpbGFibGUgdG9rZW5zIGFzIGZ1bmN0aW9ucyBvbnRvIHRoZSBTdHJlYW0gY2xhc3NcbiAgICBmb3IgKGNvbnN0IHRva2VuQ2xhc3NOYW1lIGluIHRoaXMuVE9LRU5TKSB7XG4gICAgICBjb25zdCBUb2tlbkNsYXNzID0gdGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdO1xuICAgICAgU3RyZWFtLnByb3RvdHlwZVtUb2tlbkNsYXNzLmxvd2VyQ2FtZWxDYXNlVHlwZV0gPSBmdW5jdGlvbiAoYXJnTGlzdCwgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIERlZmF1bHQgbmFtZWQgZnVuY3Rpb25zXG4gICAgdGhpcy5OQU1FRF9GVU5DVElPTlMgPSB7XG4gICAgICBpZGVudGl0eTogZnVuY3Rpb24gKiAod3JhcHBlZFBhcmVudCkgeyB5aWVsZCB3cmFwcGVkUGFyZW50LnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRQYXJlbnQpIHtcbiAgICAgICAgY29uc3QgcGFyZW50VHlwZSA9IHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIGlmICghKHBhcmVudFR5cGUgPT09ICdudW1iZXInIHx8IHBhcmVudFR5cGUgPT09ICdzdHJpbmcnKSkge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpc24ndCBhIGtleSAvIGluZGV4YCk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBpZiAoIXNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlJvb3RUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pLFxuICAgICAgdG9rZW5DbGFzc0xpc3Q6IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYClcbiAgICB9KTtcbiAgfVxuXG4gIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3QudmFsdWVzKClgIH0pIHtcbiAgICBpZiAodGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuc2VsZWN0b3JdO1xuICAgIH1cbiAgICBjb25zdCBDbGFzc1R5cGUgPSBvcHRpb25zLkNsYXNzVHlwZSB8fCB0aGlzLkNMQVNTRVMuR2VuZXJpY0NsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLkNsYXNzVHlwZTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLnNlbGVjdG9yXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLnNlbGVjdG9yXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSk7XG4gIH1cblxuICByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUod2luZG93LkZpbGVSZWFkZXIpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJpbmRleCIsInNwbGljZSIsImFyZ3MiLCJmb3JFYWNoIiwiYXBwbHkiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsInRpbWVvdXQiLCJzZXRUaW1lb3V0IiwidHJpZ2dlciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJpIiwiU3RyZWFtIiwib3B0aW9ucyIsIm11cmUiLCJ0b2tlbkxpc3QiLCJ0b2tlbkNsYXNzTGlzdCIsIm1hcCIsIlRva2VuQ2xhc3MiLCJhcmdMaXN0IiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJ0cmF2ZXJzYWxNb2RlIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwiaW5kZXhlcyIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsInBhcnNlU2VsZWN0b3IiLCJjb25jYXQiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsImVudHJpZXMiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsIkVycm9yIiwiZGVlcEhlbHBlciIsImRlYnVnIiwibmF2aWdhdGUiLCJwYXJlbnRZaWVsZGVkU29tZXRoaW5nIiwiaXRlcmF0b3IiLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRlIiwibmV4dCIsImRvbmUiLCJ2YWx1ZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsImV4ZWMiLCJuYW1lIiwiUm9vdFRva2VuIiwid3JhcCIsInJvb3QiLCJLZXlzVG9rZW4iLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJ1bmRlZmluZWQiLCJhcmciLCJtYXRjaCIsIkluZmluaXR5IiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwicmVkdWNlIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiVHlwZUVycm9yIiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5IiwiVmFsdWVUb2tlbiIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwibmV3U3RyZWFtIiwiZm9yayIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJtYXBGdW5jdGlvbiIsImhhc2hGdW5jdGlvbiIsInJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uIiwiaGFzaEluZGV4IiwiaGFzaFZhbHVlIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsImdldFZhbHVlcyIsIkdlbmVyaWNDbGFzcyIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZiIsIk5vZGVDbGFzcyIsIk5vZGVXcmFwcGVyIiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJpdGVyVmFsdWVzIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIlRPS0VOUyIsIkNMQVNTRVMiLCJ0b2tlbkNsYXNzTmFtZSIsInByb3RvdHlwZSIsImV4dGVuZCIsInBhcmVudFR5cGUiLCJzaGExIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoIiwidG9rZW5TdHJpbmdzIiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInNwbGl0IiwidHJpbSIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZXN1bHQiLCJyZWFkQXNUZXh0IiwiZW5jb2RpbmciLCJhZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2UiLCJleHRlbnNpb25PdmVycmlkZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY0RhdGFTb3VyY2UiLCJuZXdDbGFzcyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxNQUFNQSxtQkFBbUIsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO2tCQUNmO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7O09BRUVDLFNBQUosRUFBZUMsUUFBZixFQUF5QkMsdUJBQXpCLEVB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
