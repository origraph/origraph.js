'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
var FileReader = _interopDefault(require('filereader'));

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
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.namedStreams = options.namedStreams || {};
    this.traversalMode = options.traversalMode || 'DFS';
    this.launchedFromClass = options.launchedFromClass || null;
    this.indexes = options.indexes || {};

    // Reminder: this always needs to be after initializing this.namedFunctions
    // and this.namedStreams
    this.tokenList = options.tokenClassList.map(({ TokenClass, argList }) => {
      return new TokenClass(this, argList);
    });
    // Reminder: this always needs to be after initializing this.tokenList
    this.Wrappers = this.getWrapperList();
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
    var _this = this;

    return asyncToGenerator(function* () {
      let wrapperIndex = 0;
      let temp = wrappedParent;
      while (temp !== null) {
        wrapperIndex += 1;
        temp = temp.wrappedParent;
      }
      const wrappedItem = new _this.Wrappers[wrapperIndex]({ wrappedParent, token, rawItem });
      yield Promise.all(Object.entries(hashes).reduce(function (promiseList, [hashFunctionName, hash]) {
        const index = _this.getIndex(hashFunctionName);
        if (!index.complete) {
          return promiseList.concat([index.addValue(hash, wrappedItem)]);
        }
      }, []));
      return wrappedItem;
    })();
  }

  iterate() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      const lastToken = _this2.tokenList[_this2.tokenList.length - 1];
      const temp = _this2.tokenList.slice(0, _this2.tokenList.length - 1);
      yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(lastToken.iterate(temp)))), asyncGenerator.await);
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
  iterate(ancestorTokens) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`This function should be overridden`);
    })();
  }
  iterateParent(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const parentToken = ancestorTokens[ancestorTokens.length - 1];
      const temp = ancestorTokens.slice(0, ancestorTokens.length - 1);
      let yieldedSomething = false;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(parentToken.iterate(temp)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          yieldedSomething = true;
          yield wrappedParent;
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

      if (!yieldedSomething && _this.mure.debug) {
        throw new TypeError(`Token yielded no results: ${parentToken}`);
      }
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
  iterate() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      yield _this.stream.wrap({
        wrappedParent: null,
        token: _this,
        rawItem: _this.stream.mure.root
      });
    })();
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (typeof wrappedParent.rawItem !== 'object') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`Input to KeysToken is not an object`);
            } else {
              continue;
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

class ValueToken extends BaseToken {
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
          const key = wrappedParent && wrappedParent.rawItem;
          const keyType = typeof key;
          if (typeof obj !== 'object' || keyType !== 'string' && keyType !== 'number') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
            } else {
              continue;
            }
          }
          yield _this.stream.wrap({
            wrappedParent,
            token: _this,
            rawItem: obj[key]
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

class EvaluateToken extends BaseToken {
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (typeof wrappedParent.rawItem !== 'string') {
            if (!_this.stream.mure.debug) {
              throw new TypeError(`Input to EvaluateToken is not a string`);
            } else {
              continue;
            }
          }
          let newStream;
          try {
            newStream = _this.stream.fork(wrappedParent.rawItem);
          } catch (err) {
            if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
              throw err;
            } else {
              continue;
            }
          }
          yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(newStream.iterate()))), asyncGenerator.await);
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(_this.stream.namedFunctions[_this.generator](wrappedParent)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const mappedRawItem = _value2;

              yield _this.stream.wrap({
                wrappedParent,
                token: _this,
                rawItem: mappedRawItem
              });
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
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.iterateParent(ancestorTokens)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          const mapFunction = _this.stream.namedFunctions[_this.map];
          const hashFunction = _this.stream.namedFunctions[_this.hash];
          const reduceInstancesFunction = _this.stream.namedFunctions[_this.reduceInstances];
          const hashIndex = _this.stream.getIndex(_this.hash);
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(mapFunction(wrappedParent)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const mappedRawItem = _value2;

              const hash = hashFunction(mappedRawItem);
              let originalWrappedItem = (yield asyncGenerator.await(hashIndex.getValueList(hash)))[0];
              if (originalWrappedItem) {
                if (_this.reduceInstances !== 'noop') {
                  reduceInstancesFunction(originalWrappedItem, mappedRawItem);
                  originalWrappedItem.trigger('update');
                }
              } else {
                const hashes = {};
                hashes[_this.hash] = hash;
                yield _this.stream.wrap({
                  wrappedParent,
                  token: _this,
                  rawItem: mappedRawItem,
                  hashes
                });
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

class JoinToken extends BaseToken {
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish']) {
    super(stream);
    for (const func of [finish, thisHash, finish]) {
      if (!stream.namedFunctions[func]) {
        throw new SyntaxError(`Unknown named function: ${func}`);
      }
    }

    const temp = stream.namedStreams[otherStream];
    if (!temp) {
      throw new SyntaxError(`Unknown named stream: ${otherStream}`);
    }
    // Require otherHash on the other stream, or copy ours over if it isn't
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
  }
  toString() {
    return `.join(${this.otherStream}, ${this.thisHash}, ${this.otherHash}, ${this.finish})`;
  }
  isSubSetOf([otherStream, thisHash = 'key', otherHash = 'key', finish = 'identity']) {
    return this.otherStream === otherStream && this.thisHash === thisHash && this.otherHash === otherHash && this.finish === finish;
  }
  iterate(ancestorTokens) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      const otherStream = _this.stream.namedStreams[_this.otherStream];
      const thisHashFunction = _this.stream.namedFunctions[_this.thisHash];
      const otherHashFunction = otherStream.namedFunctions[_this.otherHash];
      const finishFunction = _this.stream.namedFunctions[_this.finish];

      // const thisIterator = this.iterateParent(ancestorTokens);
      // const otherIterator = otherStream.iterate();

      const thisIndex = _this.stream.getIndex(_this.thisHash);
      const otherIndex = otherStream.getIndex(_this.otherHash);

      if (thisIndex.complete) {
        if (otherIndex.complete) {
          // Best of all worlds; we can just join the indexes
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = asyncIterator(thisIndex.iterValues()), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const { hash, valueList } = _value;

              const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
              for (const otherWrappedItem of otherList) {
                for (const thisWrappedItem of valueList) {
                  var _iteratorNormalCompletion2 = true;
                  var _didIteratorError2 = false;
                  var _iteratorError2 = undefined;

                  try {
                    for (var _iterator2 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                      const rawItem = _value2;

                      yield _this.stream.wrap({
                        wrappedParent: thisWrappedItem,
                        token: _this,
                        rawItem
                      });
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
                }
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
          // Need to iterate the other items, and take advantage of our complete
          // index
          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;
          var _iteratorError3 = undefined;

          try {
            for (var _iterator3 = asyncIterator(otherStream.iterate()), _step3, _value3; _step3 = yield asyncGenerator.await(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield asyncGenerator.await(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
              const otherWrappedItem = _value3;

              const hash = otherHashFunction(otherWrappedItem);
              // Add otherWrappedItem to otherIndex:
              yield asyncGenerator.await(otherIndex.addValue(hash, otherWrappedItem));
              const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
              for (const thisWrappedItem of thisList) {
                var _iteratorNormalCompletion4 = true;
                var _didIteratorError4 = false;
                var _iteratorError4 = undefined;

                try {
                  for (var _iterator4 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step4, _value4; _step4 = yield asyncGenerator.await(_iterator4.next()), _iteratorNormalCompletion4 = _step4.done, _value4 = yield asyncGenerator.await(_step4.value), !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                    const rawItem = _value4;

                    yield _this.stream.wrap({
                      wrappedParent: thisWrappedItem,
                      token: _this,
                      rawItem
                    });
                  }
                } catch (err) {
                  _didIteratorError4 = true;
                  _iteratorError4 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion4 && _iterator4.return) {
                      yield asyncGenerator.await(_iterator4.return());
                    }
                  } finally {
                    if (_didIteratorError4) {
                      throw _iteratorError4;
                    }
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion3 && _iterator3.return) {
                yield asyncGenerator.await(_iterator3.return());
              }
            } finally {
              if (_didIteratorError3) {
                throw _iteratorError3;
              }
            }
          }
        }
      } else {
        if (otherIndex.complete) {
          // Need to iterate our items, and take advantage of the other complete
          // index
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = asyncIterator(_this.iterateParent(ancestorTokens)), _step5, _value5; _step5 = yield asyncGenerator.await(_iterator5.next()), _iteratorNormalCompletion5 = _step5.done, _value5 = yield asyncGenerator.await(_step5.value), !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const thisWrappedItem = _value5;

              const hash = thisHashFunction(thisWrappedItem);
              // add thisWrappedItem to thisIndex
              yield asyncGenerator.await(thisIndex.addValue(hash, thisWrappedItem));
              const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
              for (const otherWrappedItem of otherList) {
                var _iteratorNormalCompletion6 = true;
                var _didIteratorError6 = false;
                var _iteratorError6 = undefined;

                try {
                  for (var _iterator6 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step6, _value6; _step6 = yield asyncGenerator.await(_iterator6.next()), _iteratorNormalCompletion6 = _step6.done, _value6 = yield asyncGenerator.await(_step6.value), !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
                    const rawItem = _value6;

                    yield _this.stream.wrap({
                      wrappedParent: thisWrappedItem,
                      token: _this,
                      rawItem
                    });
                  }
                } catch (err) {
                  _didIteratorError6 = true;
                  _iteratorError6 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion6 && _iterator6.return) {
                      yield asyncGenerator.await(_iterator6.return());
                    }
                  } finally {
                    if (_didIteratorError6) {
                      throw _iteratorError6;
                    }
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                yield asyncGenerator.await(_iterator5.return());
              }
            } finally {
              if (_didIteratorError5) {
                throw _iteratorError5;
              }
            }
          }
        } else {
          // Neither stream is fully indexed; for more distributed sampling, grab
          // one item from each stream at a time, and use the partial indexes
          const thisIterator = _this.iterateParent(ancestorTokens);
          let thisIsDone = false;
          const otherIterator = otherStream.iterate();
          let otherIsDone = false;

          while (!thisIsDone || !otherIsDone) {
            // Take one sample from this stream
            let temp = yield asyncGenerator.await(thisIterator.next());
            if (temp.done) {
              thisIsDone = true;
            } else {
              const thisWrappedItem = yield asyncGenerator.await(temp.value);
              const hash = thisHashFunction(thisWrappedItem);
              // add thisWrappedItem to thisIndex
              thisIndex.addValue(hash, thisWrappedItem);
              const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
              for (const otherWrappedItem of otherList) {
                var _iteratorNormalCompletion7 = true;
                var _didIteratorError7 = false;
                var _iteratorError7 = undefined;

                try {
                  for (var _iterator7 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step7, _value7; _step7 = yield asyncGenerator.await(_iterator7.next()), _iteratorNormalCompletion7 = _step7.done, _value7 = yield asyncGenerator.await(_step7.value), !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                    const rawItem = _value7;

                    yield _this.stream.wrap({
                      wrappedParent: thisWrappedItem,
                      token: _this,
                      rawItem
                    });
                  }
                } catch (err) {
                  _didIteratorError7 = true;
                  _iteratorError7 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion7 && _iterator7.return) {
                      yield asyncGenerator.await(_iterator7.return());
                    }
                  } finally {
                    if (_didIteratorError7) {
                      throw _iteratorError7;
                    }
                  }
                }
              }
            }

            // Now for a sample from the other stream
            temp = yield asyncGenerator.await(otherIterator.next());
            if (temp.done) {
              otherIsDone = true;
            } else {
              const otherWrappedItem = yield asyncGenerator.await(temp.value);
              const hash = otherHashFunction(otherWrappedItem);
              // add otherWrappedItem to otherIndex
              otherIndex.addValue(hash, otherWrappedItem);
              const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
              for (const thisWrappedItem of thisList) {
                var _iteratorNormalCompletion8 = true;
                var _didIteratorError8 = false;
                var _iteratorError8 = undefined;

                try {
                  for (var _iterator8 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step8, _value8; _step8 = yield asyncGenerator.await(_iterator8.next()), _iteratorNormalCompletion8 = _step8.done, _value8 = yield asyncGenerator.await(_step8.value), !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
                    const rawItem = _value8;

                    yield _this.stream.wrap({
                      wrappedParent: thisWrappedItem,
                      token: _this,
                      rawItem
                    });
                  }
                } catch (err) {
                  _didIteratorError8 = true;
                  _iteratorError8 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion8 && _iterator8.return) {
                      yield asyncGenerator.await(_iterator8.return());
                    }
                  } finally {
                    if (_didIteratorError8) {
                      throw _iteratorError8;
                    }
                  }
                }
              }
            }
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
  PromoteToken: PromoteToken,
  JoinToken: JoinToken
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.mure = options.mure;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    this.selector = options.selector || `root.values()`;
    this.tokenClassList = this.mure.parseSelector(options.selector);
    this.indexes = options.indexes || {};
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
      options.indexes = this.indexes;
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
    this._connections = {};
  }
  connectToNodeClass({ nodeClass, thisHash, otherHash }) {
    throw new Error(`unimplemented`);
  }
  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    edgeClass.connectToNodeClass(options);
  }
}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this.mure.WRAPPERS.EdgeWrapper;
    this._sourceSelector = null;
    this._targetSelector = null;
    this.directed = false;
  }
  connectToNodeClass({ nodeClass, direction, nodeHash, edgeHash }) {
    if (direction === 'source') {
      if (this._sourceSelector) {
        delete this.mure.classes[this._sourceSelector]._connections[this.selector];
      }
      this._sourceSelector = nodeClass.selector;
    } else if (direction === 'target') {
      if (this._targetSelector) {
        delete this.mure.classes[this._targetSelector]._connections[this.selector];
      }
      this._targetSelector = nodeClass.selector;
    } else {
      if (!this._sourceSelector) {
        this._sourceSelector = nodeClass.selector;
      } else if (!this._targetSelector) {
        this._targetSelector = nodeClass.selector;
      } else {
        throw new Error(`Source and target are already defined; please specify a direction to override`);
      }
    }
    nodeClass._connections[this.selector] = { nodeHash, edgeHash };
  }
  getStream(options) {
    throw new Error(`unimplemented`);
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
  iterEntries() {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      for (const [hash, valueList] of Object.entries(_this.entries)) {
        yield { hash, valueList };
      }
    })();
  }
  iterHashes() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      for (const hash of Object.keys(_this2.entries)) {
        yield hash;
      }
    })();
  }
  iterValueLists() {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      for (const valueList of Object.values(_this3.entries)) {
        yield valueList;
      }
    })();
  }
  getValueList(hash) {
    var _this4 = this;

    return asyncToGenerator(function* () {
      return _this4.entries[hash] || [];
    })();
  }
  addValue(hash, value) {
    var _this5 = this;

    return asyncToGenerator(function* () {
      // TODO: add some kind of warning if this is getting big?
      _this5.entries[hash] = yield _this5.getValueList(hash);
      _this5.entries[hash].push(value);
    })();
  }
}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader$$1) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node
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
      defaultFinish: function* (thisWrappedItem, otherWrappedItem) {
        yield [thisWrappedItem.rawItem, otherWrappedItem.rawItem];
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
    options.mure = this;
    options.tokenClassList = this.parseSelector(options.selector || `root.values()`);
    return new Stream(options);
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

let mure = new Mure(FileReader);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy50cmF2ZXJzYWxNb2RlID0gb3B0aW9ucy50cmF2ZXJzYWxNb2RlIHx8ICdERlMnO1xuICAgIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IG51bGw7XG4gICAgdGhpcy5pbmRleGVzID0gb3B0aW9ucy5pbmRleGVzIHx8IHt9O1xuXG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLm5hbWVkRnVuY3Rpb25zXG4gICAgLy8gYW5kIHRoaXMubmFtZWRTdHJlYW1zXG4gICAgdGhpcy50b2tlbkxpc3QgPSBvcHRpb25zLnRva2VuQ2xhc3NMaXN0Lm1hcCgoeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH0pID0+IHtcbiAgICAgIHJldHVybiBuZXcgVG9rZW5DbGFzcyh0aGlzLCBhcmdMaXN0KTtcbiAgICB9KTtcbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMudG9rZW5MaXN0XG4gICAgdGhpcy5XcmFwcGVycyA9IHRoaXMuZ2V0V3JhcHBlckxpc3QoKTtcbiAgfVxuXG4gIGdldFdyYXBwZXJMaXN0ICgpIHtcbiAgICAvLyBMb29rIHVwIHdoaWNoLCBpZiBhbnksIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHJlc3VsdCBvZiBlYWNoIHRva2VuLCBzbyB0aGF0XG4gICAgLy8gd2UgY2FuIHdyYXAgaXRlbXMgYXBwcm9wcmlhdGVseTpcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QubWFwKCh0b2tlbiwgaW5kZXgpID0+IHtcbiAgICAgIGlmIChpbmRleCA9PT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSAmJiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzKSB7XG4gICAgICAgIC8vIElmIHRoaXMgc3RyZWFtIHdhcyBzdGFydGVkIGZyb20gYSBjbGFzcywgd2UgYWxyZWFkeSBrbm93IHdlIHNob3VsZFxuICAgICAgICAvLyB1c2UgdGhhdCBjbGFzcydzIHdyYXBwZXIgZm9yIHRoZSBsYXN0IHRva2VuXG4gICAgICAgIHJldHVybiB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzLldyYXBwZXI7XG4gICAgICB9XG4gICAgICAvLyBGaW5kIGEgY2xhc3MgdGhhdCBkZXNjcmliZXMgZXhhY3RseSBlYWNoIHNlcmllcyBvZiB0b2tlbnNcbiAgICAgIGNvbnN0IGxvY2FsVG9rZW5MaXN0ID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgaW5kZXggKyAxKTtcbiAgICAgIGNvbnN0IHBvdGVudGlhbFdyYXBwZXJzID0gT2JqZWN0LnZhbHVlcyh0aGlzLm11cmUuY2xhc3NlcylcbiAgICAgICAgLmZpbHRlcihjbGFzc09iaiA9PiB7XG4gICAgICAgICAgaWYgKCFjbGFzc09iai50b2tlbkNsYXNzTGlzdC5sZW5ndGggIT09IGxvY2FsVG9rZW5MaXN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbkxpc3QuZXZlcnkoKGxvY2FsVG9rZW4sIGxvY2FsSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuQ2xhc3NTcGVjID0gY2xhc3NPYmoudG9rZW5DbGFzc0xpc3RbbG9jYWxJbmRleF07XG4gICAgICAgICAgICByZXR1cm4gbG9jYWxUb2tlbiBpbnN0YW5jZW9mIHRva2VuQ2xhc3NTcGVjLlRva2VuQ2xhc3MgJiZcbiAgICAgICAgICAgICAgdG9rZW4uaXNTdWJzZXRPZih0b2tlbkNsYXNzU3BlYy5hcmdMaXN0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIE5vIGNsYXNzZXMgZGVzY3JpYmUgdGhpcyBzZXJpZXMgb2YgdG9rZW5zLCBzbyB1c2UgdGhlIGdlbmVyaWMgd3JhcHBlclxuICAgICAgICByZXR1cm4gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oYE11bHRpcGxlIGNsYXNzZXMgZGVzY3JpYmUgdGhlIHNhbWUgaXRlbSEgQXJiaXRyYXJpbHkgY2hvb3Npbmcgb25lLi4uYCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbFdyYXBwZXJzWzBdLldyYXBwZXI7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBnZXQgc2VsZWN0b3IgKCkge1xuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5qb2luKCcnKTtcbiAgfVxuXG4gIGZvcmsgKHNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0oe1xuICAgICAgbXVyZTogdGhpcy5tdXJlLFxuICAgICAgbmFtZWRGdW5jdGlvbnM6IHRoaXMubmFtZWRGdW5jdGlvbnMsXG4gICAgICB0cmF2ZXJzYWxNb2RlOiB0aGlzLnRyYXZlcnNhbE1vZGUsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3NcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoeyBUb2tlbkNsYXNzLCBhcmdMaXN0IH0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgb3B0aW9ucy50cmF2ZXJzYWxNb2RlID0gb3B0aW9ucy50cmF2ZXJzYWxNb2RlIHx8IHRoaXMudHJhdmVyc2FsTW9kZTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0sIGhhc2hlcyA9IHt9IH0pIHtcbiAgICBsZXQgd3JhcHBlckluZGV4ID0gMDtcbiAgICBsZXQgdGVtcCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgd2hpbGUgKHRlbXAgIT09IG51bGwpIHtcbiAgICAgIHdyYXBwZXJJbmRleCArPSAxO1xuICAgICAgdGVtcCA9IHRlbXAud3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBuZXcgdGhpcy5XcmFwcGVyc1t3cmFwcGVySW5kZXhdKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXMoaGFzaGVzKS5yZWR1Y2UoKHByb21pc2VMaXN0LCBbaGFzaEZ1bmN0aW9uTmFtZSwgaGFzaF0pID0+IHtcbiAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICAgIGlmICghaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmV0dXJuIHByb21pc2VMaXN0LmNvbmNhdChbIGluZGV4LmFkZFZhbHVlKGhhc2gsIHdyYXBwZWRJdGVtKSBdKTtcbiAgICAgIH1cbiAgICB9LCBbXSkpO1xuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuXG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgbGFzdFRva2VuID0gdGhpcy50b2tlbkxpc3RbdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEpO1xuICAgIHlpZWxkICogYXdhaXQgbGFzdFRva2VuLml0ZXJhdGUodGVtcCk7XG4gIH1cblxuICBnZXRJbmRleCAoaGFzaEZ1bmN0aW9uTmFtZSkge1xuICAgIGlmICghdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdKSB7XG4gICAgICAvLyBUT0RPOiBpZiB1c2luZyBub2RlLmpzLCBzdGFydCB3aXRoIGV4dGVybmFsIC8gbW9yZSBzY2FsYWJsZSBpbmRleGVzXG4gICAgICB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0gPSBuZXcgdGhpcy5tdXJlLklOREVYRVMuSW5NZW1vcnlJbmRleCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICB9XG5cbiAgYXN5bmMgKiBzYW1wbGUgKHsgbGltaXQgPSAxMCwgcmVidWlsZEluZGV4ZXMgPSBmYWxzZSB9KSB7XG4gICAgLy8gQmVmb3JlIHdlIHN0YXJ0LCBjbGVhbiBvdXQgYW55IG9sZCBpbmRleGVzIHRoYXQgd2VyZSBuZXZlciBmaW5pc2hlZFxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaCgoW2hhc2hGdW5jdGlvbk5hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKHJlYnVpbGRJbmRleGVzIHx8ICFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAvLyBXZSBhY3R1YWxseSBmaW5pc2hlZCBhIGZ1bGwgcGFzczsgZmxhZyBhbGwgb2Ygb3VyIGluZGV4ZXMgYXMgY29tcGxldGVcbiAgICAgICAgT2JqZWN0LnZhbHVlcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goaW5kZXggPT4ge1xuICAgICAgICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0cmVhbTtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBCYXNlVG9rZW4gZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuc3RyZWFtID0gc3RyZWFtO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICAvLyBUaGUgc3RyaW5nIHZlcnNpb24gb2YgbW9zdCB0b2tlbnMgY2FuIGp1c3QgYmUgZGVyaXZlZCBmcm9tIHRoZSBjbGFzcyB0eXBlXG4gICAgcmV0dXJuIGAuJHt0aGlzLnR5cGUudG9Mb3dlckNhc2UoKX0oKWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoKSB7XG4gICAgLy8gQnkgZGVmYXVsdCAod2l0aG91dCBhbnkgYXJndW1lbnRzKSwgdG9rZW5zIG9mIHRoZSBzYW1lIGNsYXNzIGFyZSBzdWJzZXRzXG4gICAgLy8gb2YgZWFjaCBvdGhlclxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVQYXJlbnQgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3QgcGFyZW50VG9rZW4gPSBhbmNlc3RvclRva2Vuc1thbmNlc3RvclRva2Vucy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gYW5jZXN0b3JUb2tlbnMuc2xpY2UoMCwgYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHlpZWxkZWRTb21ldGhpbmcgPSBmYWxzZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VG9rZW4uaXRlcmF0ZSh0ZW1wKSkge1xuICAgICAgeWllbGRlZFNvbWV0aGluZyA9IHRydWU7XG4gICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBpZiAoIXlpZWxkZWRTb21ldGhpbmcgJiYgdGhpcy5tdXJlLmRlYnVnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUb2tlbiB5aWVsZGVkIG5vIHJlc3VsdHM6ICR7cGFyZW50VG9rZW59YCk7XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZVRva2VuLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUb2tlbi8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgZmluaXNoLCB0aGlzSGFzaCwgZmluaXNoIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRlbXAgPSBzdHJlYW0ubmFtZWRTdHJlYW1zW290aGVyU3RyZWFtXTtcbiAgICBpZiAoIXRlbXApIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBzdHJlYW06ICR7b3RoZXJTdHJlYW19YCk7XG4gICAgfVxuICAgIC8vIFJlcXVpcmUgb3RoZXJIYXNoIG9uIHRoZSBvdGhlciBzdHJlYW0sIG9yIGNvcHkgb3VycyBvdmVyIGlmIGl0IGlzbid0XG4gICAgLy8gYWxyZWFkeSBkZWZpbmVkXG4gICAgaWYgKCF0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGhhc2ggZnVuY3Rpb24gb24gZWl0aGVyIHN0cmVhbTogJHtvdGhlckhhc2h9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZW1wLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF0gPSBzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm90aGVyU3RyZWFtID0gb3RoZXJTdHJlYW07XG4gICAgdGhpcy50aGlzSGFzaCA9IHRoaXNIYXNoO1xuICAgIHRoaXMub3RoZXJIYXNoID0gb3RoZXJIYXNoO1xuICAgIHRoaXMuZmluaXNoID0gZmluaXNoO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5qb2luKCR7dGhpcy5vdGhlclN0cmVhbX0sICR7dGhpcy50aGlzSGFzaH0sICR7dGhpcy5vdGhlckhhc2h9LCAke3RoaXMuZmluaXNofSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnaWRlbnRpdHknIF0pIHtcbiAgICByZXR1cm4gdGhpcy5vdGhlclN0cmVhbSA9PT0gb3RoZXJTdHJlYW0gJiZcbiAgICAgIHRoaXMudGhpc0hhc2ggPT09IHRoaXNIYXNoICYmXG4gICAgICB0aGlzLm90aGVySGFzaCA9PT0gb3RoZXJIYXNoICYmXG4gICAgICB0aGlzLmZpbmlzaCA9PT0gZmluaXNoO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBvdGhlclN0cmVhbSA9IHRoaXMuc3RyZWFtLm5hbWVkU3RyZWFtc1t0aGlzLm90aGVyU3RyZWFtXTtcbiAgICBjb25zdCB0aGlzSGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy50aGlzSGFzaF07XG4gICAgY29uc3Qgb3RoZXJIYXNoRnVuY3Rpb24gPSBvdGhlclN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLm90aGVySGFzaF07XG4gICAgY29uc3QgZmluaXNoRnVuY3Rpb24gPSB0aGlzLnN0cmVhbS5uYW1lZEZ1bmN0aW9uc1t0aGlzLmZpbmlzaF07XG5cbiAgICAvLyBjb25zdCB0aGlzSXRlcmF0b3IgPSB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpO1xuICAgIC8vIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG5cbiAgICBjb25zdCB0aGlzSW5kZXggPSB0aGlzLnN0cmVhbS5nZXRJbmRleCh0aGlzLnRoaXNIYXNoKTtcbiAgICBjb25zdCBvdGhlckluZGV4ID0gb3RoZXJTdHJlYW0uZ2V0SW5kZXgodGhpcy5vdGhlckhhc2gpO1xuXG4gICAgaWYgKHRoaXNJbmRleC5jb21wbGV0ZSkge1xuICAgICAgaWYgKG90aGVySW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgLy8gQmVzdCBvZiBhbGwgd29ybGRzOyB3ZSBjYW4ganVzdCBqb2luIHRoZSBpbmRleGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBoYXNoLCB2YWx1ZUxpc3QgfSBvZiB0aGlzSW5kZXguaXRlclZhbHVlcygpKSB7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdmFsdWVMaXN0KSB7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTmVlZCB0byBpdGVyYXRlIHRoZSBvdGhlciBpdGVtcywgYW5kIHRha2UgYWR2YW50YWdlIG9mIG91ciBjb21wbGV0ZVxuICAgICAgICAvLyBpbmRleFxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJTdHJlYW0uaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgY29uc3QgaGFzaCA9IG90aGVySGFzaEZ1bmN0aW9uKG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgIC8vIEFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXg6XG4gICAgICAgICAgYXdhaXQgb3RoZXJJbmRleC5hZGRWYWx1ZShoYXNoLCBvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgcmF3SXRlbSBvZiBmaW5pc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAob3RoZXJJbmRleC5jb21wbGV0ZSkge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgb3VyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlIG90aGVyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgICAgICBjb25zdCBoYXNoID0gdGhpc0hhc2hGdW5jdGlvbih0aGlzV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgYXdhaXQgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgZm9yIChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHN0cmVhbSBpcyBmdWxseSBpbmRleGVkOyBmb3IgbW9yZSBkaXN0cmlidXRlZCBzYW1wbGluZywgZ3JhYlxuICAgICAgICAvLyBvbmUgaXRlbSBmcm9tIGVhY2ggc3RyZWFtIGF0IGEgdGltZSwgYW5kIHVzZSB0aGUgcGFydGlhbCBpbmRleGVzXG4gICAgICAgIGNvbnN0IHRoaXNJdGVyYXRvciA9IHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2Vucyk7XG4gICAgICAgIGxldCB0aGlzSXNEb25lID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IG90aGVySXRlcmF0b3IgPSBvdGhlclN0cmVhbS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCBvdGhlcklzRG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIHdoaWxlICghdGhpc0lzRG9uZSB8fCAhb3RoZXJJc0RvbmUpIHtcbiAgICAgICAgICAvLyBUYWtlIG9uZSBzYW1wbGUgZnJvbSB0aGlzIHN0cmVhbVxuICAgICAgICAgIGxldCB0ZW1wID0gYXdhaXQgdGhpc0l0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgICAgICB0aGlzSXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdGhpc1dyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgdGhpc0luZGV4LmFkZFZhbHVlKGhhc2gsIHRoaXNXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm93IGZvciBhIHNhbXBsZSBmcm9tIHRoZSBvdGhlciBzdHJlYW1cbiAgICAgICAgICB0ZW1wID0gYXdhaXQgb3RoZXJJdGVyYXRvci5uZXh0KCk7XG4gICAgICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICAgICAgb3RoZXJJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBvdGhlcldyYXBwZWRJdGVtID0gYXdhaXQgdGVtcC52YWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IGhhc2ggPSBvdGhlckhhc2hGdW5jdGlvbihvdGhlcldyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIC8vIGFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXhcbiAgICAgICAgICAgIG90aGVySW5kZXguYWRkVmFsdWUoaGFzaCwgb3RoZXJXcmFwcGVkSXRlbSk7XG4gICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB0aGlzTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICB0aGlzLnNlbGVjdG9yID0gb3B0aW9ucy5zZWxlY3RvciB8fCBgcm9vdC52YWx1ZXMoKWA7XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IHRoaXMubXVyZS5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IpO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgfVxuICB3cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5yZXNldCB8fCAhdGhpcy5fc3RyZWFtKSB7XG4gICAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdDtcbiAgICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IHRoaXM7XG4gICAgICBvcHRpb25zLmluZGV4ZXMgPSB0aGlzLmluZGV4ZXM7XG4gICAgICB0aGlzLl9zdHJlYW0gPSBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuX2Nvbm5lY3Rpb25zID0ge307XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgdGhpc0hhc2gsIG90aGVySGFzaCB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5FZGdlV3JhcHBlcjtcbiAgICB0aGlzLl9zb3VyY2VTZWxlY3RvciA9IG51bGw7XG4gICAgdGhpcy5fdGFyZ2V0U2VsZWN0b3IgPSBudWxsO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVIYXNoLCBlZGdlSGFzaCB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLl9zb3VyY2VTZWxlY3Rvcikge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5fc291cmNlU2VsZWN0b3JdLl9jb25uZWN0aW9uc1t0aGlzLnNlbGVjdG9yXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3NvdXJjZVNlbGVjdG9yID0gbm9kZUNsYXNzLnNlbGVjdG9yO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgaWYgKHRoaXMuX3RhcmdldFNlbGVjdG9yKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLl90YXJnZXRTZWxlY3Rvcl0uX2Nvbm5lY3Rpb25zW3RoaXMuc2VsZWN0b3JdO1xuICAgICAgfVxuICAgICAgdGhpcy5fdGFyZ2V0U2VsZWN0b3IgPSBub2RlQ2xhc3Muc2VsZWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5fc291cmNlU2VsZWN0b3IpIHtcbiAgICAgICAgdGhpcy5fc291cmNlU2VsZWN0b3IgPSBub2RlQ2xhc3Muc2VsZWN0b3I7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLl90YXJnZXRTZWxlY3Rvcikge1xuICAgICAgICB0aGlzLl90YXJnZXRTZWxlY3RvciA9IG5vZGVDbGFzcy5zZWxlY3RvcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGFuZCB0YXJnZXQgYXJlIGFscmVhZHkgZGVmaW5lZDsgcGxlYXNlIHNwZWNpZnkgYSBkaXJlY3Rpb24gdG8gb3ZlcnJpZGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZUNsYXNzLl9jb25uZWN0aW9uc1t0aGlzLnNlbGVjdG9yXSA9IHsgbm9kZUhhc2gsIGVkZ2VIYXNoIH07XG4gIH1cbiAgZ2V0U3RyZWFtIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICgpIHtcbiAgICB0aGlzLmVudHJpZXMgPSB7fTtcbiAgICB0aGlzLmNvbXBsZXRlID0gZmFsc2U7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmNsYXNzIE11cmUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB7fTtcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIHRoaXMuVFJVVEhZX1NUUklOR1MgPSB7XG4gICAgICAndHJ1ZSc6IHRydWUsXG4gICAgICAneWVzJzogdHJ1ZSxcbiAgICAgICd5JzogdHJ1ZVxuICAgIH07XG4gICAgdGhpcy5GQUxTRVlfU1RSSU5HUyA9IHtcbiAgICAgICdmYWxzZSc6IHRydWUsXG4gICAgICAnbm8nOiB0cnVlLFxuICAgICAgJ24nOiB0cnVlXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRQYXJlbnQpIHsgeWllbGQgd3JhcHBlZFBhcmVudC5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkUGFyZW50KSB7XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2UgaWYgKCF3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXMgbm90IGFuIG9iamVjdCAvIGFycmF5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZGVmYXVsdEZpbmlzaDogZnVuY3Rpb24gKiAodGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSB7XG4gICAgICAgIHlpZWxkIFtcbiAgICAgICAgICB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbSxcbiAgICAgICAgICBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgXTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBpZiAoIXNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290J2ApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlblN0cmluZ3MgPSBzZWxlY3RvclN0cmluZy5tYXRjaCgvXFwuKFteKF0qKVxcKChbXildKilcXCkvZyk7XG4gICAgaWYgKCF0b2tlblN0cmluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCBzZWxlY3RvciBzdHJpbmc6ICR7c2VsZWN0b3JTdHJpbmd9YCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuQ2xhc3NMaXN0ID0gW3tcbiAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlJvb3RUb2tlblxuICAgIH1dO1xuICAgIHRva2VuU3RyaW5ncy5mb3JFYWNoKGNodW5rID0+IHtcbiAgICAgIGNvbnN0IHRlbXAgPSBjaHVuay5tYXRjaCgvXi4oW14oXSopXFwoKFteKV0qKVxcKS8pO1xuICAgICAgaWYgKCF0ZW1wKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgSW52YWxpZCB0b2tlbjogJHtjaHVua31gKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRva2VuQ2xhc3NOYW1lID0gdGVtcFsxXVswXS50b1VwcGVyQ2FzZSgpICsgdGVtcFsxXS5zbGljZSgxKSArICdUb2tlbic7XG4gICAgICBjb25zdCBhcmdMaXN0ID0gdGVtcFsyXS5zcGxpdCgvKD88IVxcXFwpLC8pLm1hcChkID0+IHtcbiAgICAgICAgZCA9IGQudHJpbSgpO1xuICAgICAgICByZXR1cm4gZCA9PT0gJycgPyB1bmRlZmluZWQgOiBkO1xuICAgICAgfSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuS2V5c1Rva2VuLFxuICAgICAgICAgIGFyZ0xpc3RcbiAgICAgICAgfSk7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TLlZhbHVlVG9rZW5cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biB0b2tlbjogJHt0ZW1wWzFdfWApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0b2tlbkNsYXNzTGlzdDtcbiAgfVxuXG4gIHN0cmVhbSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMucGFyc2VTZWxlY3RvcihvcHRpb25zLnNlbGVjdG9yIHx8IGByb290LnZhbHVlcygpYCk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBuZXdDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGByb290LnZhbHVlcygpYCB9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3Nlc1tvcHRpb25zLnNlbGVjdG9yXSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLnNlbGVjdG9yXTtcbiAgICB9XG4gICAgY29uc3QgQ2xhc3NUeXBlID0gb3B0aW9ucy5DbGFzc1R5cGUgfHwgdGhpcy5DTEFTU0VTLkdlbmVyaWNDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5DbGFzc1R5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl0gPSBuZXcgQ2xhc3NUeXBlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5zZWxlY3Rvcl07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYFxuICAgIH0pO1xuICB9XG5cbiAgcmVtb3ZlRGF0YVNvdXJjZSAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMucm9vdFtrZXldO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlcik7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJhcHBseSIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwidGltZW91dCIsInNldFRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwidHJhdmVyc2FsTW9kZSIsImxhdW5jaGVkRnJvbUNsYXNzIiwiaW5kZXhlcyIsInRva2VuTGlzdCIsInRva2VuQ2xhc3NMaXN0IiwibWFwIiwiVG9rZW5DbGFzcyIsImFyZ0xpc3QiLCJXcmFwcGVycyIsImdldFdyYXBwZXJMaXN0IiwidG9rZW4iLCJsZW5ndGgiLCJXcmFwcGVyIiwibG9jYWxUb2tlbkxpc3QiLCJzbGljZSIsInBvdGVudGlhbFdyYXBwZXJzIiwidmFsdWVzIiwiY2xhc3NlcyIsImZpbHRlciIsImNsYXNzT2JqIiwiZXZlcnkiLCJsb2NhbFRva2VuIiwibG9jYWxJbmRleCIsInRva2VuQ2xhc3NTcGVjIiwiaXNTdWJzZXRPZiIsIldSQVBQRVJTIiwiR2VuZXJpY1dyYXBwZXIiLCJ3YXJuIiwic2VsZWN0b3IiLCJqb2luIiwicGFyc2VTZWxlY3RvciIsImNvbmNhdCIsIndyYXBwZWRQYXJlbnQiLCJyYXdJdGVtIiwiaGFzaGVzIiwid3JhcHBlckluZGV4IiwidGVtcCIsIndyYXBwZWRJdGVtIiwiUHJvbWlzZSIsImFsbCIsImVudHJpZXMiLCJyZWR1Y2UiLCJwcm9taXNlTGlzdCIsImhhc2hGdW5jdGlvbk5hbWUiLCJoYXNoIiwiZ2V0SW5kZXgiLCJjb21wbGV0ZSIsImFkZFZhbHVlIiwibGFzdFRva2VuIiwiaXRlcmF0ZSIsIklOREVYRVMiLCJJbk1lbW9yeUluZGV4IiwibGltaXQiLCJyZWJ1aWxkSW5kZXhlcyIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJ2YWx1ZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsImFuY2VzdG9yVG9rZW5zIiwiRXJyb3IiLCJwYXJlbnRUb2tlbiIsInlpZWxkZWRTb21ldGhpbmciLCJkZWJ1ZyIsIlR5cGVFcnJvciIsImV4ZWMiLCJuYW1lIiwiUm9vdFRva2VuIiwid3JhcCIsInJvb3QiLCJLZXlzVG9rZW4iLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJ1bmRlZmluZWQiLCJhcmciLCJtYXRjaCIsIkluZmluaXR5IiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiaXRlcmF0ZVBhcmVudCIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImZvcmsiLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJoYXNoRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiaXRlclZhbHVlcyIsInZhbHVlTGlzdCIsIm90aGVyTGlzdCIsIm90aGVyV3JhcHBlZEl0ZW0iLCJ0aGlzV3JhcHBlZEl0ZW0iLCJ0aGlzTGlzdCIsInRoaXNJdGVyYXRvciIsInRoaXNJc0RvbmUiLCJvdGhlckl0ZXJhdG9yIiwib3RoZXJJc0RvbmUiLCJHZW5lcmljQ2xhc3MiLCJyZXNldCIsIl9zdHJlYW0iLCJpc1N1cGVyU2V0T2YiLCJOb2RlQ2xhc3MiLCJOb2RlV3JhcHBlciIsIl9jb25uZWN0aW9ucyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIkVkZ2VDbGFzcyIsIkVkZ2VXcmFwcGVyIiwiX3NvdXJjZVNlbGVjdG9yIiwiX3RhcmdldFNlbGVjdG9yIiwiZGlyZWN0ZWQiLCJkaXJlY3Rpb24iLCJub2RlSGFzaCIsImVkZ2VIYXNoIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVFJVVEhZX1NUUklOR1MiLCJGQUxTRVlfU1RSSU5HUyIsIlRPS0VOUyIsIkNMQVNTRVMiLCJ0b2tlbkNsYXNzTmFtZSIsInByb3RvdHlwZSIsImV4dGVuZCIsInBhcmVudFR5cGUiLCJzaGExIiwic2VsZWN0b3JTdHJpbmciLCJzdGFydHNXaXRoIiwidG9rZW5TdHJpbmdzIiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInNwbGl0IiwidHJpbSIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlc3VsdCIsInJlYWRBc1RleHQiLCJlbmNvZGluZyIsImFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSIsImV4dGVuc2lvbk92ZXJyaWRlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsIm5ld0NsYXNzIiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTUEsbUJBQW1CLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtrQkFDZjtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOztPQUVFQyxTQUFKLEVBQWVDLFFBQWYsRUFBeUJDLHVCQUF6QixFQUFrRDtVQUM1QyxDQUFDLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JGLGFBQUwsQ0FBbUJFLFNBQW5CLElBQWdDLEVBQWhDOztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtKLGFBQUws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
