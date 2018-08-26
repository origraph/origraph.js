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
    this.launchedFromClass = options.launchedFromClass || null;
    this.indexes = options.indexes || {};
    this.tokenClassList = options.tokenClassList || [];

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
      namedStreams: this.namedStreams,
      tokenClassList: this.mure.parseSelector(selector),
      launchedFromClass: this.launchedFromClass,
      indexes: this.indexes
    });
  }

  extend(TokenClass, argList, options = {}) {
    options.mure = this.mure;
    options.namedFunctions = Object.assign({}, this.namedFunctions, options.namedFunctions || {});
    options.namedStreams = Object.assign({}, this.namedStreams, options.namedStreams || {});
    options.tokenClassList = this.tokenClassList.concat([{ TokenClass, argList }]);
    options.launchedFromClass = options.launchedFromClass || this.launchedFromClass;
    options.indexes = Object.assign({}, this.indexes, options.indexes || {});
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

  buildIndex(hashFunctionName) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const hashFunction = _this3.namedFunctions[hashFunctionName];
      if (!hashFunction) {
        throw new Error(`Unknown named function: ${hashFunctionName}`);
      }
      const index = _this3.getIndex(hashFunctionName);
      if (index.complete) {
        return;
      }
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this3.iterate()), _step, _value; _step = yield _iterator.next(), _iteratorNormalCompletion = _step.done, _value = yield _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = asyncIterator(hashFunction(wrappedItem)), _step2, _value2; _step2 = yield _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const hash = _value2;

              index.addValue(hash, wrappedItem);
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                yield _iterator2.return();
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
            yield _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      index.complete = true;
    })();
  }

  sample({ limit = 10, rebuildIndexes = false }) {
    var _this4 = this;

    return asyncGenerator.wrap(function* () {
      // Before we start, clean out any old indexes that were never finished
      Object.entries(_this4.indexes).forEach(function ([hashFunctionName, index]) {
        if (rebuildIndexes || !index.complete) {
          delete _this4.indexes[hashFunctionName];
        }
      });
      const iterator = _this4.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          // We actually finished a full pass; flag all of our indexes as complete
          Object.values(_this4.indexes).forEach(function (index) {
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

class EmptyToken extends BaseToken {
  iterate() {
    // yield nothing

    return asyncGenerator.wrap(function* () {})();
  }
  toString() {
    return `empty`;
  }
}

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
            for (var _iterator = asyncIterator(thisIndex.iterEntries()), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const { hash, valueList } = _value;

              const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = asyncIterator(otherList), _step2, _value2; _step2 = yield asyncGenerator.await(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield asyncGenerator.await(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                  const otherWrappedItem = _value2;
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = undefined;

                  try {
                    for (var _iterator3 = asyncIterator(valueList), _step3, _value3; _step3 = yield asyncGenerator.await(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield asyncGenerator.await(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                      const thisWrappedItem = _value3;
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
        } else {
          // Need to iterate the other items, and take advantage of our complete
          // index
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = asyncIterator(otherStream.iterate()), _step5, _value5; _step5 = yield asyncGenerator.await(_iterator5.next()), _iteratorNormalCompletion5 = _step5.done, _value5 = yield asyncGenerator.await(_step5.value), !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const otherWrappedItem = _value5;
              var _iteratorNormalCompletion6 = true;
              var _didIteratorError6 = false;
              var _iteratorError6 = undefined;

              try {
                for (var _iterator6 = asyncIterator(otherHashFunction(otherWrappedItem)), _step6, _value6; _step6 = yield asyncGenerator.await(_iterator6.next()), _iteratorNormalCompletion6 = _step6.done, _value6 = yield asyncGenerator.await(_step6.value), !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
                  const hash = _value6;

                  // Add otherWrappedItem to otherIndex:
                  yield asyncGenerator.await(otherIndex.addValue(hash, otherWrappedItem));
                  const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
                  var _iteratorNormalCompletion7 = true;
                  var _didIteratorError7 = false;
                  var _iteratorError7 = undefined;

                  try {
                    for (var _iterator7 = asyncIterator(thisList), _step7, _value7; _step7 = yield asyncGenerator.await(_iterator7.next()), _iteratorNormalCompletion7 = _step7.done, _value7 = yield asyncGenerator.await(_step7.value), !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                      const thisWrappedItem = _value7;
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
        }
      } else {
        if (otherIndex.complete) {
          // Need to iterate our items, and take advantage of the other complete
          // index
          var _iteratorNormalCompletion9 = true;
          var _didIteratorError9 = false;
          var _iteratorError9 = undefined;

          try {
            for (var _iterator9 = asyncIterator(_this.iterateParent(ancestorTokens)), _step9, _value9; _step9 = yield asyncGenerator.await(_iterator9.next()), _iteratorNormalCompletion9 = _step9.done, _value9 = yield asyncGenerator.await(_step9.value), !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
              const thisWrappedItem = _value9;
              var _iteratorNormalCompletion10 = true;
              var _didIteratorError10 = false;
              var _iteratorError10 = undefined;

              try {
                for (var _iterator10 = asyncIterator(thisHashFunction(thisWrappedItem)), _step10, _value10; _step10 = yield asyncGenerator.await(_iterator10.next()), _iteratorNormalCompletion10 = _step10.done, _value10 = yield asyncGenerator.await(_step10.value), !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
                  const hash = _value10;

                  // add thisWrappedItem to thisIndex
                  yield asyncGenerator.await(thisIndex.addValue(hash, thisWrappedItem));
                  const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
                  var _iteratorNormalCompletion11 = true;
                  var _didIteratorError11 = false;
                  var _iteratorError11 = undefined;

                  try {
                    for (var _iterator11 = asyncIterator(otherList), _step11, _value11; _step11 = yield asyncGenerator.await(_iterator11.next()), _iteratorNormalCompletion11 = _step11.done, _value11 = yield asyncGenerator.await(_step11.value), !_iteratorNormalCompletion11; _iteratorNormalCompletion11 = true) {
                      const otherWrappedItem = _value11;
                      var _iteratorNormalCompletion12 = true;
                      var _didIteratorError12 = false;
                      var _iteratorError12 = undefined;

                      try {
                        for (var _iterator12 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step12, _value12; _step12 = yield asyncGenerator.await(_iterator12.next()), _iteratorNormalCompletion12 = _step12.done, _value12 = yield asyncGenerator.await(_step12.value), !_iteratorNormalCompletion12; _iteratorNormalCompletion12 = true) {
                          const rawItem = _value12;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError12 = true;
                        _iteratorError12 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion12 && _iterator12.return) {
                            yield asyncGenerator.await(_iterator12.return());
                          }
                        } finally {
                          if (_didIteratorError12) {
                            throw _iteratorError12;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError11 = true;
                    _iteratorError11 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion11 && _iterator11.return) {
                        yield asyncGenerator.await(_iterator11.return());
                      }
                    } finally {
                      if (_didIteratorError11) {
                        throw _iteratorError11;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError10 = true;
                _iteratorError10 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion10 && _iterator10.return) {
                    yield asyncGenerator.await(_iterator10.return());
                  }
                } finally {
                  if (_didIteratorError10) {
                    throw _iteratorError10;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError9 = true;
            _iteratorError9 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion9 && _iterator9.return) {
                yield asyncGenerator.await(_iterator9.return());
              }
            } finally {
              if (_didIteratorError9) {
                throw _iteratorError9;
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
              var _iteratorNormalCompletion13 = true;
              var _didIteratorError13 = false;
              var _iteratorError13 = undefined;

              try {
                for (var _iterator13 = asyncIterator(thisHashFunction(thisWrappedItem)), _step13, _value13; _step13 = yield asyncGenerator.await(_iterator13.next()), _iteratorNormalCompletion13 = _step13.done, _value13 = yield asyncGenerator.await(_step13.value), !_iteratorNormalCompletion13; _iteratorNormalCompletion13 = true) {
                  const hash = _value13;

                  // add thisWrappedItem to thisIndex
                  thisIndex.addValue(hash, thisWrappedItem);
                  const otherList = yield asyncGenerator.await(otherIndex.getValueList(hash));
                  var _iteratorNormalCompletion14 = true;
                  var _didIteratorError14 = false;
                  var _iteratorError14 = undefined;

                  try {
                    for (var _iterator14 = asyncIterator(otherList), _step14, _value14; _step14 = yield asyncGenerator.await(_iterator14.next()), _iteratorNormalCompletion14 = _step14.done, _value14 = yield asyncGenerator.await(_step14.value), !_iteratorNormalCompletion14; _iteratorNormalCompletion14 = true) {
                      const otherWrappedItem = _value14;
                      var _iteratorNormalCompletion15 = true;
                      var _didIteratorError15 = false;
                      var _iteratorError15 = undefined;

                      try {
                        for (var _iterator15 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step15, _value15; _step15 = yield asyncGenerator.await(_iterator15.next()), _iteratorNormalCompletion15 = _step15.done, _value15 = yield asyncGenerator.await(_step15.value), !_iteratorNormalCompletion15; _iteratorNormalCompletion15 = true) {
                          const rawItem = _value15;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError15 = true;
                        _iteratorError15 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion15 && _iterator15.return) {
                            yield asyncGenerator.await(_iterator15.return());
                          }
                        } finally {
                          if (_didIteratorError15) {
                            throw _iteratorError15;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError14 = true;
                    _iteratorError14 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion14 && _iterator14.return) {
                        yield asyncGenerator.await(_iterator14.return());
                      }
                    } finally {
                      if (_didIteratorError14) {
                        throw _iteratorError14;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError13 = true;
                _iteratorError13 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion13 && _iterator13.return) {
                    yield asyncGenerator.await(_iterator13.return());
                  }
                } finally {
                  if (_didIteratorError13) {
                    throw _iteratorError13;
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
              var _iteratorNormalCompletion16 = true;
              var _didIteratorError16 = false;
              var _iteratorError16 = undefined;

              try {
                for (var _iterator16 = asyncIterator(otherHashFunction(otherWrappedItem)), _step16, _value16; _step16 = yield asyncGenerator.await(_iterator16.next()), _iteratorNormalCompletion16 = _step16.done, _value16 = yield asyncGenerator.await(_step16.value), !_iteratorNormalCompletion16; _iteratorNormalCompletion16 = true) {
                  const hash = _value16;

                  // add otherWrappedItem to otherIndex
                  otherIndex.addValue(hash, otherWrappedItem);
                  const thisList = yield asyncGenerator.await(thisIndex.getValueList(hash));
                  var _iteratorNormalCompletion17 = true;
                  var _didIteratorError17 = false;
                  var _iteratorError17 = undefined;

                  try {
                    for (var _iterator17 = asyncIterator(thisList), _step17, _value17; _step17 = yield asyncGenerator.await(_iterator17.next()), _iteratorNormalCompletion17 = _step17.done, _value17 = yield asyncGenerator.await(_step17.value), !_iteratorNormalCompletion17; _iteratorNormalCompletion17 = true) {
                      const thisWrappedItem = _value17;
                      var _iteratorNormalCompletion18 = true;
                      var _didIteratorError18 = false;
                      var _iteratorError18 = undefined;

                      try {
                        for (var _iterator18 = asyncIterator(finishFunction(thisWrappedItem, otherWrappedItem)), _step18, _value18; _step18 = yield asyncGenerator.await(_iterator18.next()), _iteratorNormalCompletion18 = _step18.done, _value18 = yield asyncGenerator.await(_step18.value), !_iteratorNormalCompletion18; _iteratorNormalCompletion18 = true) {
                          const rawItem = _value18;

                          yield _this.stream.wrap({
                            wrappedParent: thisWrappedItem,
                            token: _this,
                            rawItem
                          });
                        }
                      } catch (err) {
                        _didIteratorError18 = true;
                        _iteratorError18 = err;
                      } finally {
                        try {
                          if (!_iteratorNormalCompletion18 && _iterator18.return) {
                            yield asyncGenerator.await(_iterator18.return());
                          }
                        } finally {
                          if (_didIteratorError18) {
                            throw _iteratorError18;
                          }
                        }
                      }
                    }
                  } catch (err) {
                    _didIteratorError17 = true;
                    _iteratorError17 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion17 && _iterator17.return) {
                        yield asyncGenerator.await(_iterator17.return());
                      }
                    } finally {
                      if (_didIteratorError17) {
                        throw _iteratorError17;
                      }
                    }
                  }
                }
              } catch (err) {
                _didIteratorError16 = true;
                _iteratorError16 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion16 && _iterator16.return) {
                    yield asyncGenerator.await(_iterator16.return());
                  }
                } finally {
                  if (_didIteratorError16) {
                    throw _iteratorError16;
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
  EmptyToken: EmptyToken,
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
    this.classId = options.classId;
    this._selector = options.selector;
    this.customClassName = options.customClassName || null;
    this.opsSinceCustomName = options.opsSinceCustomName || null;
    this.Wrapper = this.mure.WRAPPERS.GenericWrapper;
    this.indexes = options.indexes || {};
    this.namedFunctions = Object.assign({}, this.mure.NAMED_FUNCTIONS, options.namedFunctions || {});
    for (let [funcName, func] of Object.entries(this.namedFunctions)) {
      if (typeof func === 'string') {
        this.namedFunctions[funcName] = new Function(func); // eslint-disable-line no-new-func
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
    var _this = this;

    return asyncToGenerator(function* () {
      const result = {
        classType: _this.constructor.name,
        selector: _this._selector,
        customClassName: _this.customClassName,
        opsSinceCustomName: _this.opsSinceCustomName,
        classId: _this.classId,
        indexes: {},
        namedFunctions: {}
      };
      for (let [funcName, func] of Object.entries(_this.namedFunctions)) {
        result.namedFunctions[funcName] = func.toString();
      }
      yield Promise.all(Object.entries(_this.indexes).map((() => {
        var _ref = asyncToGenerator(function* ([funcName, index]) {
          if (index.complete) {
            result.indexes[funcName] = yield index.toRawObject();
          }
        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      })()));
      return result;
    })();
  }
  wrap(options) {
    return new this.Wrapper(options);
  }
  set className(value) {
    this.customClassName = value;
    this.opsSinceCustomName = 0;
  }
  get className() {
    if (this.opsSinceCustomName === null) {
      return this.selector;
    } else {
      const tokenStrings = this.selector.match(/\.([^(]*)\(([^)]*)\)/g);
      if (this.opsSinceCustomName > tokenStrings.length) {
        return this.selector;
      } else {
        const sliceIndex = tokenStrings.length - this.opsSinceCustomName;
        return `${this.customClassName}.${tokenStrings.slice(sliceIndex).join('.')}`;
      }
    }
  }
  setNamedFunction(funcName, func) {
    this.namedFunctions[funcName] = func;
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
  interpretAsNodes() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      const options = yield _this2.toRawObject();
      options.mure = _this2.mure;
      _this2.mure.classes[_this2.classId] = new _this2.mure.CLASSES.NodeClass(options);
      yield _this2.mure.saveClasses();
      return _this2.mure.classes[_this2.classId];
    })();
  }
  interpretAsEdges() {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const options = yield _this3.toRawObject();
      options.mure = _this3.mure;
      _this3.mure.classes[_this3.classId] = new _this3.mure.CLASSES.EdgeClass(options);
      yield _this3.mure.saveClasses();
      return _this3.mure.classes[_this3.classId];
    })();
  }
  aggregate(hash, reduce) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  expand(map) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  filter(filter) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  split(hash) {
    return asyncGenerator.wrap(function* () {
      throw new Error(`unimplemented`);
    })();
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
    this.edgeConnections = options.edgeConnections || {};
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      // TODO: need to deep copy edgeConnections?
      result.edgeConnections = _this.edgeConnections;
      return result;
    })();
  }
  interpretAsNodes() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      return _this2;
    })();
  }
  interpretAsEdges() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  connectToNodeClass({ nodeClass, thisHashName, otherHashName }) {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  connectToEdgeClass(options) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      const edgeClass = options.edgeClass;
      delete options.edgeClass;
      options.nodeClass = _this3;
      edgeClass.connectToNodeClass(options);
    })();
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
        return sourceClass.selector + `.join(target, ${sourceHash}, ${targetHash}, defaultFinish)`;
      }
    } else {
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return this._selector;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return this._selector + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return sourceClass.selector + `.join(edge, ${nodeHashName}, ${edgeHashName}, defaultFinish)`;
      } else {
        // Full connections
        let result = sourceClass.selector;
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(edge, ${nodeHashName}, ${edgeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        return result;
      }
    }
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      // TODO: a babel bug (https://github.com/babel/babel/issues/3930)
      // prevents `await super`; this is a workaround:
      const result = yield GenericClass.prototype.toRawObject.call(_this);
      result.sourceClassId = _this.sourceClassId;
      result.targetClassId = _this.targetClassId;
      result.directed = _this.directed;
      return result;
    })();
  }
  interpretAsNodes() {
    return asyncToGenerator(function* () {
      throw new Error(`unimplemented`);
    })();
  }
  interpretAsEdges() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      return _this2;
    })();
  }
  connectToNodeClass({ nodeClass, direction, nodeHashName, edgeHashName }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      if (direction === 'source') {
        if (_this3.sourceClassId) {
          delete _this3.mure.classes[_this3.sourceClassId].edgeConnections[_this3.classId];
        }
        _this3.sourceClassId = nodeClass.classId;
      } else if (direction === 'target') {
        if (_this3.targetClassId) {
          delete _this3.mure.classes[_this3.targetClassId].edgeConnections[_this3.classId];
        }
        _this3.targetClassId = nodeClass.classId;
      } else {
        if (!_this3.sourceClassId) {
          _this3.sourceClassId = nodeClass.classId;
        } else if (!_this3.targetClassId) {
          _this3.targetClassId = nodeClass.classId;
        } else {
          throw new Error(`Source and target are already defined; please specify a direction to override`);
        }
      }
      nodeClass.edgeConnections[_this3.classId] = { nodeHashName, edgeHashName };
      delete _this3._stream;
      yield _this3.mure.saveClasses();
    })();
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
  constructor({ entries = {}, complete = false } = {}) {
    this.entries = entries;
    this.complete = complete;
  }
  toRawObject() {
    var _this = this;

    return asyncToGenerator(function* () {
      return _this.entries;
    })();
  }
  iterEntries() {
    var _this2 = this;

    return asyncGenerator.wrap(function* () {
      for (const [hash, valueList] of Object.entries(_this2.entries)) {
        yield { hash, valueList };
      }
    })();
  }
  iterHashes() {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      for (const hash of Object.keys(_this3.entries)) {
        yield hash;
      }
    })();
  }
  iterValueLists() {
    var _this4 = this;

    return asyncGenerator.wrap(function* () {
      for (const valueList of Object.values(_this4.entries)) {
        yield valueList;
      }
    })();
  }
  getValueList(hash) {
    var _this5 = this;

    return asyncToGenerator(function* () {
      return _this5.entries[hash] || [];
    })();
  }
  addValue(hash, value) {
    var _this6 = this;

    return asyncToGenerator(function* () {
      // TODO: add some kind of warning if this is getting big?
      _this6.entries[hash] = yield _this6.getValueList(hash);
      _this6.entries[hash].push(value);
    })();
  }
}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node
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
        if (thisWrappedItem.rawItem instanceof Array) {
          // if relevant, merge the results of a series of joins into a single
          // array
          yield thisWrappedItem.rawItem.concat([otherWrappedItem.rawItem]);
        } else {
          // otherwise just yield the two results as an array
          yield [thisWrappedItem.rawItem, otherWrappedItem.rawItem];
        }
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    };

    // Object containing each of our data sources
    this.root = this.loadRoot();

    // Object containing our class specifications
    this.classes = this.loadClasses();
  }

  loadRoot() {
    let root = this.localStorage && this.localStorage.getItem('mure_root');
    root = root ? JSON.parse(root) : {};
    return root;
  }
  saveRoot() {
    var _this = this;

    return asyncToGenerator(function* () {
      if (_this.localStorage) {
        _this.localStorage.setItem('mure_root', JSON.stringify(_this.root));
      }
    })();
  }
  loadClasses() {
    let classes = this.localStorage && this.localStorage.getItem('mure_classes');
    classes = classes ? JSON.parse(classes) : {};
    Object.entries(classes).forEach(([classId, rawClassObj]) => {
      Object.entries(rawClassObj.indexes).forEach(([funcName, rawIndexObj]) => {
        rawClassObj.indexes[funcName] = new this.INDEXES.InMemoryIndex({
          entries: rawIndexObj, complete: true
        });
      });
      const classType = rawClassObj.classType;
      delete rawClassObj.classType;
      rawClassObj.mure = this;
      classes[classId] = new this.CLASSES[classType](rawClassObj);
    });
    return classes;
  }
  saveClasses() {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.localStorage) {
        const rawClasses = {};
        yield Promise.all(Object.entries(_this2.classes).map((() => {
          var _ref = asyncToGenerator(function* ([classId, classObj]) {
            rawClasses[classId] = yield classObj.toRawObject();
          });

          return function (_x) {
            return _ref.apply(this, arguments);
          };
        })()));
        _this2.localStorage.setItem('mure_classes', JSON.stringify(rawClasses));
      }
    })();
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

  newClass(options = { selector: `root` }) {
    var _this3 = this;

    return asyncToGenerator(function* () {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
      const ClassType = options.ClassType || _this3.CLASSES.GenericClass;
      delete options.ClassType;
      options.mure = _this3;
      _this3.classes[options.classId] = new ClassType(options);
      yield _this3.saveClasses();
      return _this3.classes[options.classId];
    })();
  }

  addFileAsStaticDataSource({
    fileObj,
    encoding = mime.charset(fileObj.type),
    extensionOverride = null,
    skipSizeCheck = false
  } = {}) {
    var _this4 = this;

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
        let reader = new _this4.FileReader();
        reader.onload = function () {
          resolve(reader.result);
        };
        reader.readAsText(fileObj, encoding);
      });
      return _this4.addStringAsStaticDataSource({
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
    var _this5 = this;

    return asyncToGenerator(function* () {
      let obj;
      if (_this5.DATALIB_FORMATS[extension]) {
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
      return _this5.addStaticDataSource(key, obj);
    })();
  }
  addStaticDataSource(key, obj) {
    var _this6 = this;

    return asyncToGenerator(function* () {
      _this6.root[key] = obj;
      const temp = yield Promise.all([_this6.saveRoot(), _this6.newClass({
        selector: `root.values('${key}').values()`
      })]);
      return temp[1];
    })();
  }
  removeDataSource(key) {
    var _this7 = this;

    return asyncToGenerator(function* () {
      delete _this7.root[key];
      yield _this7.saveRoot();
    })();
  }
}

var name = "mure";
var version = "0.4.7";
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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgIGlmICghdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spICE9PSAtMSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIHRoaXMubmFtZWRTdHJlYW1zID0gb3B0aW9ucy5uYW1lZFN0cmVhbXMgfHwge307XG4gICAgdGhpcy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgbnVsbDtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy50b2tlbkNsYXNzTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgfHwgW107XG5cbiAgICAvLyBSZW1pbmRlcjogdGhpcyBhbHdheXMgbmVlZHMgdG8gYmUgYWZ0ZXIgaW5pdGlhbGl6aW5nIHRoaXMubmFtZWRGdW5jdGlvbnNcbiAgICAvLyBhbmQgdGhpcy5uYW1lZFN0cmVhbXNcbiAgICB0aGlzLnRva2VuTGlzdCA9IG9wdGlvbnMudG9rZW5DbGFzc0xpc3QubWFwKCh7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBUb2tlbkNsYXNzKHRoaXMsIGFyZ0xpc3QpO1xuICAgIH0pO1xuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy50b2tlbkxpc3RcbiAgICB0aGlzLldyYXBwZXJzID0gdGhpcy5nZXRXcmFwcGVyTGlzdCgpO1xuICB9XG5cbiAgZ2V0V3JhcHBlckxpc3QgKCkge1xuICAgIC8vIExvb2sgdXAgd2hpY2gsIGlmIGFueSwgY2xhc3NlcyBkZXNjcmliZSB0aGUgcmVzdWx0IG9mIGVhY2ggdG9rZW4sIHNvIHRoYXRcbiAgICAvLyB3ZSBjYW4gd3JhcCBpdGVtcyBhcHByb3ByaWF0ZWx5OlxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5tYXAoKHRva2VuLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKGluZGV4ID09PSB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxICYmIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MpIHtcbiAgICAgICAgLy8gSWYgdGhpcyBzdHJlYW0gd2FzIHN0YXJ0ZWQgZnJvbSBhIGNsYXNzLCB3ZSBhbHJlYWR5IGtub3cgd2Ugc2hvdWxkXG4gICAgICAgIC8vIHVzZSB0aGF0IGNsYXNzJ3Mgd3JhcHBlciBmb3IgdGhlIGxhc3QgdG9rZW5cbiAgICAgICAgcmV0dXJuIHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MuV3JhcHBlcjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgYSBjbGFzcyB0aGF0IGRlc2NyaWJlcyBleGFjdGx5IGVhY2ggc2VyaWVzIG9mIHRva2Vuc1xuICAgICAgY29uc3QgbG9jYWxUb2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCBpbmRleCArIDEpO1xuICAgICAgY29uc3QgcG90ZW50aWFsV3JhcHBlcnMgPSBPYmplY3QudmFsdWVzKHRoaXMubXVyZS5jbGFzc2VzKVxuICAgICAgICAuZmlsdGVyKGNsYXNzT2JqID0+IHtcbiAgICAgICAgICBpZiAoIWNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0Lmxlbmd0aCAhPT0gbG9jYWxUb2tlbkxpc3QubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuTGlzdC5ldmVyeSgobG9jYWxUb2tlbiwgbG9jYWxJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9rZW5DbGFzc1NwZWMgPSBjbGFzc09iai50b2tlbkNsYXNzTGlzdFtsb2NhbEluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBsb2NhbFRva2VuIGluc3RhbmNlb2YgdG9rZW5DbGFzc1NwZWMuVG9rZW5DbGFzcyAmJlxuICAgICAgICAgICAgICB0b2tlbi5pc1N1YnNldE9mKHRva2VuQ2xhc3NTcGVjLmFyZ0xpc3QpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gTm8gY2xhc3NlcyBkZXNjcmliZSB0aGlzIHNlcmllcyBvZiB0b2tlbnMsIHNvIHVzZSB0aGUgZ2VuZXJpYyB3cmFwcGVyXG4gICAgICAgIHJldHVybiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocG90ZW50aWFsV3JhcHBlcnMubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihgTXVsdGlwbGUgY2xhc3NlcyBkZXNjcmliZSB0aGUgc2FtZSBpdGVtISBBcmJpdHJhcmlseSBjaG9vc2luZyBvbmUuLi5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcG90ZW50aWFsV3JhcHBlcnNbMF0uV3JhcHBlcjtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG5cbiAgZm9yayAoc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBuYW1lZEZ1bmN0aW9uczogdGhpcy5uYW1lZEZ1bmN0aW9ucyxcbiAgICAgIG5hbWVkU3RyZWFtczogdGhpcy5uYW1lZFN0cmVhbXMsXG4gICAgICB0b2tlbkNsYXNzTGlzdDogdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3Ioc2VsZWN0b3IpLFxuICAgICAgbGF1bmNoZWRGcm9tQ2xhc3M6IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3MsXG4gICAgICBpbmRleGVzOiB0aGlzLmluZGV4ZXNcbiAgICB9KTtcbiAgfVxuXG4gIGV4dGVuZCAoVG9rZW5DbGFzcywgYXJnTGlzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLm5hbWVkRnVuY3Rpb25zLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBvcHRpb25zLm5hbWVkU3RyZWFtcyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRTdHJlYW1zLCBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fSk7XG4gICAgb3B0aW9ucy50b2tlbkNsYXNzTGlzdCA9IHRoaXMudG9rZW5DbGFzc0xpc3QuY29uY2F0KFt7IFRva2VuQ2xhc3MsIGFyZ0xpc3QgfV0pO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzIHx8IHRoaXMubGF1bmNoZWRGcm9tQ2xhc3M7XG4gICAgb3B0aW9ucy5pbmRleGVzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5pbmRleGVzLCBvcHRpb25zLmluZGV4ZXMgfHwge30pO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG5cbiAgYXN5bmMgd3JhcCAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSwgaGFzaGVzID0ge30gfSkge1xuICAgIGxldCB3cmFwcGVySW5kZXggPSAwO1xuICAgIGxldCB0ZW1wID0gd3JhcHBlZFBhcmVudDtcbiAgICB3aGlsZSAodGVtcCAhPT0gbnVsbCkge1xuICAgICAgd3JhcHBlckluZGV4ICs9IDE7XG4gICAgICB0ZW1wID0gdGVtcC53cmFwcGVkUGFyZW50O1xuICAgIH1cbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IG5ldyB0aGlzLldyYXBwZXJzW3dyYXBwZXJJbmRleF0oeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyhoYXNoZXMpLnJlZHVjZSgocHJvbWlzZUxpc3QsIFtoYXNoRnVuY3Rpb25OYW1lLCBoYXNoXSkgPT4ge1xuICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgICAgaWYgKCFpbmRleC5jb21wbGV0ZSkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZUxpc3QuY29uY2F0KFsgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pIF0pO1xuICAgICAgfVxuICAgIH0sIFtdKSk7XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG5cbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICBjb25zdCBsYXN0VG9rZW4gPSB0aGlzLnRva2VuTGlzdFt0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50b2tlbkxpc3Quc2xpY2UoMCwgdGhpcy50b2tlbkxpc3QubGVuZ3RoIC0gMSk7XG4gICAgeWllbGQgKiBhd2FpdCBsYXN0VG9rZW4uaXRlcmF0ZSh0ZW1wKTtcbiAgfVxuXG4gIGdldEluZGV4IChoYXNoRnVuY3Rpb25OYW1lKSB7XG4gICAgaWYgKCF0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV0pIHtcbiAgICAgIC8vIFRPRE86IGlmIHVzaW5nIG5vZGUuanMsIHN0YXJ0IHdpdGggZXh0ZXJuYWwgLyBtb3JlIHNjYWxhYmxlIGluZGV4ZXNcbiAgICAgIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSA9IG5ldyB0aGlzLm11cmUuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gIH1cblxuICBhc3luYyBidWlsZEluZGV4IChoYXNoRnVuY3Rpb25OYW1lKSB7XG4gICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5uYW1lZEZ1bmN0aW9uc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICBpZiAoIWhhc2hGdW5jdGlvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2hhc2hGdW5jdGlvbk5hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5nZXRJbmRleChoYXNoRnVuY3Rpb25OYW1lKTtcbiAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIGhhc2hGdW5jdGlvbih3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgaW5kZXguYWRkVmFsdWUoaGFzaCwgd3JhcHBlZEl0ZW0pO1xuICAgICAgfVxuICAgIH1cbiAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gIH1cblxuICBhc3luYyAqIHNhbXBsZSAoeyBsaW1pdCA9IDEwLCByZWJ1aWxkSW5kZXhlcyA9IGZhbHNlIH0pIHtcbiAgICAvLyBCZWZvcmUgd2Ugc3RhcnQsIGNsZWFuIG91dCBhbnkgb2xkIGluZGV4ZXMgdGhhdCB3ZXJlIG5ldmVyIGZpbmlzaGVkXG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKChbaGFzaEZ1bmN0aW9uTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAocmVidWlsZEluZGV4ZXMgfHwgIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmluZGV4ZXNbaGFzaEZ1bmN0aW9uTmFtZV07XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLml0ZXJhdGUoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIC8vIFdlIGFjdHVhbGx5IGZpbmlzaGVkIGEgZnVsbCBwYXNzOyBmbGFnIGFsbCBvZiBvdXIgaW5kZXhlcyBhcyBjb21wbGV0ZVxuICAgICAgICBPYmplY3QudmFsdWVzKHRoaXMuaW5kZXhlcykuZm9yRWFjaChpbmRleCA9PiB7XG4gICAgICAgICAgaW5kZXguY29tcGxldGUgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEJhc2VUb2tlbiBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zdHJlYW0gPSBzdHJlYW07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIC8vIFRoZSBzdHJpbmcgdmVyc2lvbiBvZiBtb3N0IHRva2VucyBjYW4ganVzdCBiZSBkZXJpdmVkIGZyb20gdGhlIGNsYXNzIHR5cGVcbiAgICByZXR1cm4gYC4ke3RoaXMudHlwZS50b0xvd2VyQ2FzZSgpfSgpYDtcbiAgfVxuICBpc1N1YlNldE9mICgpIHtcbiAgICAvLyBCeSBkZWZhdWx0ICh3aXRob3V0IGFueSBhcmd1bWVudHMpLCB0b2tlbnMgb2YgdGhlIHNhbWUgY2xhc3MgYXJlIHN1YnNldHNcbiAgICAvLyBvZiBlYWNoIG90aGVyXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZVBhcmVudCAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUb2tlbiA9IGFuY2VzdG9yVG9rZW5zW2FuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSBhbmNlc3RvclRva2Vucy5zbGljZSgwLCBhbmNlc3RvclRva2Vucy5sZW5ndGggLSAxKTtcbiAgICBsZXQgeWllbGRlZFNvbWV0aGluZyA9IGZhbHNlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUb2tlbi5pdGVyYXRlKHRlbXApKSB7XG4gICAgICB5aWVsZGVkU29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgIHlpZWxkIHdyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGlmICgheWllbGRlZFNvbWV0aGluZyAmJiB0aGlzLm11cmUuZGVidWcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFRva2VuIHlpZWxkZWQgbm8gcmVzdWx0czogJHtwYXJlbnRUb2tlbn1gKTtcbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXNlVG9rZW4sICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRva2VuLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQmFzZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEVtcHR5VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIC8vIHlpZWxkIG5vdGhpbmdcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGBlbXB0eWA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEVtcHR5VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlICgpIHtcbiAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSB1bmRlZmluZWQpIHx8IG1hdGNoQWxsKSB7XG4gICAgICB0aGlzLm1hdGNoQWxsID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXJnTGlzdC5mb3JFYWNoKGFyZyA9PiB7XG4gICAgICAgIGxldCB0ZW1wID0gYXJnLm1hdGNoKC8oXFxkKyktKFtcXGTiiJ5dKykvKTtcbiAgICAgICAgaWYgKHRlbXAgJiYgdGVtcFsyXSA9PT0gJ+KInicpIHtcbiAgICAgICAgICB0ZW1wWzJdID0gSW5maW5pdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGVtcCA9IHRlbXAgPyB0ZW1wLm1hcChkID0+IGQucGFyc2VJbnQoZCkpIDogbnVsbDtcbiAgICAgICAgaWYgKHRlbXAgJiYgIWlzTmFOKHRlbXBbMV0pICYmICFpc05hTih0ZW1wWzJdKSkge1xuICAgICAgICAgIGZvciAobGV0IGkgPSB0ZW1wWzFdOyBpIDw9IHRlbXBbMl07IGkrKykge1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IHRlbXBbMV0sIGhpZ2g6IHRlbXBbMl0gfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gYXJnLm1hdGNoKC8nKC4qKScvKTtcbiAgICAgICAgdGVtcCA9IHRlbXAgJiYgdGVtcFsxXSA/IHRlbXBbMV0gOiBhcmc7XG4gICAgICAgIGxldCBudW0gPSBOdW1iZXIodGVtcCk7XG4gICAgICAgIGlmIChpc05hTihudW0pIHx8IG51bSAhPT0gcGFyc2VJbnQodGVtcCkpIHsgLy8gbGVhdmUgbm9uLWludGVnZXIgbnVtYmVycyBhcyBzdHJpbmdzXG4gICAgICAgICAgdGhpcy5rZXlzID0gdGhpcy5rZXlzIHx8IHt9O1xuICAgICAgICAgIHRoaXMua2V5c1t0ZW1wXSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLnJhbmdlcyB8fCBbXTtcbiAgICAgICAgICB0aGlzLnJhbmdlcy5wdXNoKHsgbG93OiBudW0sIGhpZ2g6IG51bSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBpZiAoIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBCYWQgdG9rZW4ga2V5KHMpIC8gcmFuZ2Uocyk6ICR7SlNPTi5zdHJpbmdpZnkoYXJnTGlzdCl9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0aGlzLnJhbmdlcykge1xuICAgICAgdGhpcy5yYW5nZXMgPSB0aGlzLmNvbnNvbGlkYXRlUmFuZ2VzKHRoaXMucmFuZ2VzKTtcbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdHNOb3RoaW5nICgpIHtcbiAgICByZXR1cm4gIXRoaXMubWF0Y2hBbGwgJiYgIXRoaXMua2V5cyAmJiAhdGhpcy5yYW5nZXM7XG4gIH1cbiAgY29uc29saWRhdGVSYW5nZXMgKHJhbmdlcykge1xuICAgIC8vIE1lcmdlIGFueSBvdmVybGFwcGluZyByYW5nZXNcbiAgICBjb25zdCBuZXdSYW5nZXMgPSBbXTtcbiAgICBjb25zdCB0ZW1wID0gcmFuZ2VzLnNvcnQoKGEsIGIpID0+IGEubG93IC0gYi5sb3cpO1xuICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGVtcC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCFjdXJyZW50UmFuZ2UpIHtcbiAgICAgICAgY3VycmVudFJhbmdlID0gdGVtcFtpXTtcbiAgICAgIH0gZWxzZSBpZiAodGVtcFtpXS5sb3cgPD0gY3VycmVudFJhbmdlLmhpZ2gpIHtcbiAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSB0ZW1wW2ldLmhpZ2g7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY3VycmVudFJhbmdlKSB7XG4gICAgICAvLyBDb3JuZXIgY2FzZTogYWRkIHRoZSBsYXN0IHJhbmdlXG4gICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3UmFuZ2VzLmxlbmd0aCA+IDAgPyBuZXdSYW5nZXMgOiB1bmRlZmluZWQ7XG4gIH1cbiAgZGlmZmVyZW5jZSAob3RoZXJUb2tlbikge1xuICAgIC8vIENvbXB1dGUgd2hhdCBpcyBsZWZ0IG9mIHRoaXMgYWZ0ZXIgc3VidHJhY3Rpbmcgb3V0IGV2ZXJ5dGhpbmcgaW4gb3RoZXJUb2tlblxuICAgIGlmICghKG90aGVyVG9rZW4gaW5zdGFuY2VvZiBLZXlzVG9rZW4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGNvbXB1dGUgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIGRpZmZlcmVudCB0b2tlbiB0eXBlc2ApO1xuICAgIH0gZWxzZSBpZiAob3RoZXJUb2tlbi5tYXRjaEFsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICBjb25zb2xlLndhcm4oYEluYWNjdXJhdGUgZGlmZmVyZW5jZSBjb21wdXRlZCEgVE9ETzogbmVlZCB0byBmaWd1cmUgb3V0IGhvdyB0byBpbnZlcnQgY2F0ZWdvcmljYWwga2V5cyFgKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBuZXdLZXlzID0ge307XG4gICAgICBmb3IgKGxldCBrZXkgaW4gKHRoaXMua2V5cyB8fCB7fSkpIHtcbiAgICAgICAgaWYgKCFvdGhlclRva2VuLmtleXMgfHwgIW90aGVyVG9rZW4ua2V5c1trZXldKSB7XG4gICAgICAgICAgbmV3S2V5c1trZXldID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1JhbmdlcyA9IFtdO1xuICAgICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICAgIGlmIChvdGhlclRva2VuLnJhbmdlcykge1xuICAgICAgICAgIGxldCBhbGxQb2ludHMgPSB0aGlzLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBpbmNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSk7XG4gICAgICAgICAgYWxsUG9pbnRzID0gYWxsUG9pbnRzLmNvbmNhdChvdGhlclRva2VuLnJhbmdlcy5yZWR1Y2UoKGFnZywgcmFuZ2UpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KFtcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBsb3c6IHRydWUsIHZhbHVlOiByYW5nZS5sb3cgfSxcbiAgICAgICAgICAgICAgeyBleGNsdWRlOiB0cnVlLCBoaWdoOiB0cnVlLCB2YWx1ZTogcmFuZ2UuaGlnaCB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgICB9LCBbXSkpLnNvcnQoKTtcbiAgICAgICAgICBsZXQgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbFBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBpZiAoYWxsUG9pbnRzW2ldLmluY2x1ZGUgJiYgYWxsUG9pbnRzW2ldLmxvdykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IHsgbG93OiBhbGxQb2ludHNbaV0udmFsdWUgfTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS52YWx1ZTtcbiAgICAgICAgICAgICAgaWYgKGN1cnJlbnRSYW5nZS5oaWdoID49IGN1cnJlbnRSYW5nZS5sb3cpIHtcbiAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5leGNsdWRlKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmhpZ2ggPSBhbGxQb2ludHNbaV0ubG93IC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgICAgbmV3UmFuZ2VzLnB1c2goY3VycmVudFJhbmdlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxQb2ludHNbaV0uaGlnaCkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5sb3cgPSBhbGxQb2ludHNbaV0uaGlnaCArIDE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3UmFuZ2VzID0gdGhpcy5yYW5nZXM7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgS2V5c1Rva2VuKHRoaXMubXVyZSwgbnVsbCwgeyBrZXlzOiBuZXdLZXlzLCByYW5nZXM6IG5ld1JhbmdlcyB9KTtcbiAgICB9XG4gIH1cbiAgaXNTdWJTZXRPZiAoYXJnTGlzdCkge1xuICAgIGNvbnN0IG90aGVyVG9rZW4gPSBuZXcgS2V5c1Rva2VuKHRoaXMuc3RyZWFtLCBhcmdMaXN0KTtcbiAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgIHJldHVybiBkaWZmID09PSBudWxsIHx8IGRpZmYuc2VsZWN0c05vdGhpbmc7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEtleXNUb2tlbiBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7XG4gICAgICAgIGZvciAobGV0IGtleSBpbiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0pIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICAgIGxvdyA9IE1hdGgubWF4KDAsIGxvdyk7XG4gICAgICAgICAgaGlnaCA9IE1hdGgubWluKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5sZW5ndGggLSAxLCBoaWdoKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgcmF3SXRlbTogaVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW0uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICByYXdJdGVtOiBrZXlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgS2V5c1Rva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFZhbHVlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgY29uc3Qga2V5ID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXlUeXBlID0gdHlwZW9mIGtleTtcbiAgICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYFZhbHVlVG9rZW4gdXNlZCBvbiBhIG5vbi1vYmplY3QsIG9yIHdpdGhvdXQgYSBzdHJpbmcgLyBudW1lcmljIGtleWApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG9ialtrZXldXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFZhbHVlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRXZhbHVhdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElucHV0IHRvIEV2YWx1YXRlVG9rZW4gaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGxldCBuZXdTdHJlYW07XG4gICAgICB0cnkge1xuICAgICAgICBuZXdTdHJlYW0gPSB0aGlzLnN0cmVhbS5mb3JrKHdyYXBwZWRQYXJlbnQucmF3SXRlbSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnIHx8ICEoZXJyIGluc3RhbmNlb2YgU3ludGF4RXJyb3IpKSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFdmFsdWF0ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIE1hcFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBnZW5lcmF0b3IgPSAnaWRlbnRpdHknIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2dlbmVyYXRvcl0pIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtnZW5lcmF0b3J9YCk7XG4gICAgfVxuICAgIHRoaXMuZ2VuZXJhdG9yID0gZ2VuZXJhdG9yO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5tYXAoJHt0aGlzLmdlbmVyYXRvcn0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHJldHVybiBnZW5lcmF0b3IgPT09IHRoaXMuZ2VuZXJhdG9yO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuZ2VuZXJhdG9yXSh3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1hcFRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIFByb21vdGVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgbWFwID0gJ2lkZW50aXR5JywgaGFzaCA9ICdzaGExJywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLm5hbWVkRnVuY3Rpb25zW2Z1bmNdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBuYW1lZCBmdW5jdGlvbjogJHtmdW5jfWApO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICB0aGlzLmhhc2ggPSBoYXNoO1xuICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID0gcmVkdWNlSW5zdGFuY2VzO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYC5wcm9tb3RlKCR7dGhpcy5tYXB9LCAke3RoaXMuaGFzaH0sICR7dGhpcy5yZWR1Y2VJbnN0YW5jZXN9KWA7XG4gIH1cbiAgaXNTdWJTZXRPZiAoWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHJldHVybiB0aGlzLm1hcCA9PT0gbWFwICYmXG4gICAgICB0aGlzLmhhc2ggPT09IGhhc2ggJiZcbiAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzID09PSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBjb25zdCBtYXBGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMubWFwXTtcbiAgICAgIGNvbnN0IGhhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMuaGFzaF07XG4gICAgICBjb25zdCByZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMucmVkdWNlSW5zdGFuY2VzXTtcbiAgICAgIGNvbnN0IGhhc2hJbmRleCA9IHRoaXMuc3RyZWFtLmdldEluZGV4KHRoaXMuaGFzaCk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgbWFwRnVuY3Rpb24od3JhcHBlZFBhcmVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IGhhc2hGdW5jdGlvbihtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgbGV0IG9yaWdpbmFsV3JhcHBlZEl0ZW0gPSAoYXdhaXQgaGFzaEluZGV4LmdldFZhbHVlTGlzdChoYXNoKSlbMF07XG4gICAgICAgIGlmIChvcmlnaW5hbFdyYXBwZWRJdGVtKSB7XG4gICAgICAgICAgaWYgKHRoaXMucmVkdWNlSW5zdGFuY2VzICE9PSAnbm9vcCcpIHtcbiAgICAgICAgICAgIHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaGFzaGVzID0ge307XG4gICAgICAgICAgaGFzaGVzW3RoaXMuaGFzaF0gPSBoYXNoO1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbSxcbiAgICAgICAgICAgIGhhc2hlc1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBKb2luVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2RlZmF1bHRGaW5pc2gnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIGZpbmlzaCwgdGhpc0hhc2gsIGZpbmlzaCBdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wID0gc3RyZWFtLm5hbWVkU3RyZWFtc1tvdGhlclN0cmVhbV07XG4gICAgaWYgKCF0ZW1wKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gbmFtZWQgc3RyZWFtOiAke290aGVyU3RyZWFtfWApO1xuICAgIH1cbiAgICAvLyBSZXF1aXJlIG90aGVySGFzaCBvbiB0aGUgb3RoZXIgc3RyZWFtLCBvciBjb3B5IG91cnMgb3ZlciBpZiBpdCBpc24ndFxuICAgIC8vIGFscmVhZHkgZGVmaW5lZFxuICAgIGlmICghdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICBpZiAoIXN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdKSB7XG4gICAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgVW5rbm93biBoYXNoIGZ1bmN0aW9uIG9uIGVpdGhlciBzdHJlYW06ICR7b3RoZXJIYXNofWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGVtcC5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdID0gc3RyZWFtLm5hbWVkRnVuY3Rpb25zW290aGVySGFzaF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5vdGhlclN0cmVhbSA9IG90aGVyU3RyZWFtO1xuICAgIHRoaXMudGhpc0hhc2ggPSB0aGlzSGFzaDtcbiAgICB0aGlzLm90aGVySGFzaCA9IG90aGVySGFzaDtcbiAgICB0aGlzLmZpbmlzaCA9IGZpbmlzaDtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAuam9pbigke3RoaXMub3RoZXJTdHJlYW19LCAke3RoaXMudGhpc0hhc2h9LCAke3RoaXMub3RoZXJIYXNofSwgJHt0aGlzLmZpbmlzaH0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIHRoaXMub3RoZXJTdHJlYW0gPT09IG90aGVyU3RyZWFtICYmXG4gICAgICB0aGlzLnRoaXNIYXNoID09PSB0aGlzSGFzaCAmJlxuICAgICAgdGhpcy5vdGhlckhhc2ggPT09IG90aGVySGFzaCAmJlxuICAgICAgdGhpcy5maW5pc2ggPT09IGZpbmlzaDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3Qgb3RoZXJTdHJlYW0gPSB0aGlzLnN0cmVhbS5uYW1lZFN0cmVhbXNbdGhpcy5vdGhlclN0cmVhbV07XG4gICAgY29uc3QgdGhpc0hhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMudGhpc0hhc2hdO1xuICAgIGNvbnN0IG90aGVySGFzaEZ1bmN0aW9uID0gb3RoZXJTdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5vdGhlckhhc2hdO1xuICAgIGNvbnN0IGZpbmlzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5maW5pc2hdO1xuXG4gICAgLy8gY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAvLyBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuXG4gICAgY29uc3QgdGhpc0luZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy50aGlzSGFzaCk7XG4gICAgY29uc3Qgb3RoZXJJbmRleCA9IG90aGVyU3RyZWFtLmdldEluZGV4KHRoaXMub3RoZXJIYXNoKTtcblxuICAgIGlmICh0aGlzSW5kZXguY29tcGxldGUpIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIEJlc3Qgb2YgYWxsIHdvcmxkczsgd2UgY2FuIGp1c3Qgam9pbiB0aGUgaW5kZXhlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgaGFzaCwgdmFsdWVMaXN0IH0gb2YgdGhpc0luZGV4Lml0ZXJFbnRyaWVzKCkpIHtcbiAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB2YWx1ZUxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgdGhlIG90aGVyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2Ygb3VyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlclN0cmVhbS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIEFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXg6XG4gICAgICAgICAgICBhd2FpdCBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSBvdXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiB0aGUgb3RoZXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICBhd2FpdCB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc1dyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgc3RyZWFtIGlzIGZ1bGx5IGluZGV4ZWQ7IGZvciBtb3JlIGRpc3RyaWJ1dGVkIHNhbXBsaW5nLCBncmFiXG4gICAgICAgIC8vIG9uZSBpdGVtIGZyb20gZWFjaCBzdHJlYW0gYXQgYSB0aW1lLCBhbmQgdXNlIHRoZSBwYXJ0aWFsIGluZGV4ZXNcbiAgICAgICAgY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAgICAgbGV0IHRoaXNJc0RvbmUgPSBmYWxzZTtcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcbiAgICAgICAgbGV0IG90aGVySXNEb25lID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCF0aGlzSXNEb25lIHx8ICFvdGhlcklzRG9uZSkge1xuICAgICAgICAgIC8vIFRha2Ugb25lIHNhbXBsZSBmcm9tIHRoaXMgc3RyZWFtXG4gICAgICAgICAgbGV0IHRlbXAgPSBhd2FpdCB0aGlzSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXNJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0aGlzV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgICB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc1dyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy5fc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yO1xuICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21DbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLm9wc1NpbmNlQ3VzdG9tTmFtZSA9IG9wdGlvbnMub3BzU2luY2VDdXN0b21OYW1lIHx8IG51bGw7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLm5hbWVkRnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSxcbiAgICAgIHRoaXMubXVyZS5OQU1FRF9GVU5DVElPTlMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIGlmICh0eXBlb2YgZnVuYyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBuZXcgRnVuY3Rpb24oZnVuYyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHRva2VuQ2xhc3NMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IodGhpcy5zZWxlY3Rvcik7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzVHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgc2VsZWN0b3I6IHRoaXMuX3NlbGVjdG9yLFxuICAgICAgY3VzdG9tQ2xhc3NOYW1lOiB0aGlzLmN1c3RvbUNsYXNzTmFtZSxcbiAgICAgIG9wc1NpbmNlQ3VzdG9tTmFtZTogdGhpcy5vcHNTaW5jZUN1c3RvbU5hbWUsXG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBpbmRleGVzOiB7fSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB7fVxuICAgIH07XG4gICAgZm9yIChsZXQgW2Z1bmNOYW1lLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm5hbWVkRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0Lm5hbWVkRnVuY3Rpb25zW2Z1bmNOYW1lXSA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoT2JqZWN0LmVudHJpZXModGhpcy5pbmRleGVzKS5tYXAoYXN5bmMgKFtmdW5jTmFtZSwgaW5kZXhdKSA9PiB7XG4gICAgICBpZiAoaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgcmVzdWx0LmluZGV4ZXNbZnVuY05hbWVdID0gYXdhaXQgaW5kZXgudG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICB3cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLldyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgc2V0IGNsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMub3BzU2luY2VDdXN0b21OYW1lID0gMDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICBpZiAodGhpcy5vcHNTaW5jZUN1c3RvbU5hbWUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLnNlbGVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0b2tlblN0cmluZ3MgPSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICAgIGlmICh0aGlzLm9wc1NpbmNlQ3VzdG9tTmFtZSA+IHRva2VuU3RyaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2VsZWN0b3I7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBzbGljZUluZGV4ID0gdG9rZW5TdHJpbmdzLmxlbmd0aCAtIHRoaXMub3BzU2luY2VDdXN0b21OYW1lO1xuICAgICAgICByZXR1cm4gYCR7dGhpcy5jdXN0b21DbGFzc05hbWV9LiR7dG9rZW5TdHJpbmdzLnNsaWNlKHNsaWNlSW5kZXgpLmpvaW4oJy4nKX1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBzZXROYW1lZEZ1bmN0aW9uIChmdW5jTmFtZSwgZnVuYykge1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gZnVuYztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChvcHRpb25zLnJlc2V0IHx8ICF0aGlzLl9zdHJlYW0pIHtcbiAgICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0O1xuICAgICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IHRoaXMubmFtZWRGdW5jdGlvbnM7XG4gICAgICBvcHRpb25zLmxhdW5jaGVkRnJvbUNsYXNzID0gdGhpcztcbiAgICAgIG9wdGlvbnMuaW5kZXhlcyA9IHRoaXMuaW5kZXhlcztcbiAgICAgIHRoaXMuX3N0cmVhbSA9IG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9zdHJlYW07XG4gIH1cbiAgaXNTdXBlclNldE9mVG9rZW5MaXN0ICh0b2tlbkxpc3QpIHtcbiAgICBpZiAodG9rZW5MaXN0Lmxlbmd0aCAhPT0gdGhpcy50b2tlbkxpc3QubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuICAgIHJldHVybiB0aGlzLnRva2VuTGlzdC5ldmVyeSgodG9rZW4sIGkpID0+IHRva2VuLmlzU3VwZXJTZXRPZih0b2tlbkxpc3RbaV0pKTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLk5vZGVDbGFzcyhvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gYXdhaXQgdGhpcy50b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXMubXVyZTtcbiAgICB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdID0gbmV3IHRoaXMubXVyZS5DTEFTU0VTLkVkZ2VDbGFzcyhvcHRpb25zKTtcbiAgICBhd2FpdCB0aGlzLm11cmUuc2F2ZUNsYXNzZXMoKTtcbiAgICByZXR1cm4gdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBhZ2dyZWdhdGUgKGhhc2gsIHJlZHVjZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGV4cGFuZCAobWFwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZmlsdGVyIChmaWx0ZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyAqIHNwbGl0IChoYXNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zID0gb3B0aW9ucy5lZGdlQ29ubmVjdGlvbnMgfHwge307XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIC8vIFRPRE86IG5lZWQgdG8gZGVlcCBjb3B5IGVkZ2VDb25uZWN0aW9ucz9cbiAgICByZXN1bHQuZWRnZUNvbm5lY3Rpb25zID0gdGhpcy5lZGdlQ29ubmVjdGlvbnM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCB0aGlzSGFzaE5hbWUsIG90aGVySGFzaE5hbWUgfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuXG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcyB8fCAhdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJ0aWFsIGNvbm5lY3Rpb25zIHdpdGhvdXQgYW4gZWRnZSB0YWJsZSBzaG91bGQgbmV2ZXIgaGFwcGVuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlZGdlIHRhYmxlIChzaW1wbGUgam9pbiBiZXR3ZWVuIHR3byBub2RlcylcbiAgICAgICAgY29uc3Qgc291cmNlSGFzaCA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SGFzaCA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNsYXNzLnNlbGVjdG9yICsgYC5qb2luKHRhcmdldCwgJHtzb3VyY2VIYXNofSwgJHt0YXJnZXRIYXNofSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHRoaXMuX3NlbGVjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFBhcnRpYWwgZWRnZS10YXJnZXQgY29ubmVjdGlvbnNcbiAgICAgICAgICBjb25zdCB7IGVkZ2VIYXNoTmFtZSwgbm9kZUhhc2hOYW1lIH0gPSB0YXJnZXRDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3IgKyBgLmpvaW4odGFyZ2V0LCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF0YXJnZXRDbGFzcykge1xuICAgICAgICAvLyBQYXJ0aWFsIHNvdXJjZS1lZGdlIGNvbm5lY3Rpb25zXG4gICAgICAgIGNvbnN0IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfSA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdO1xuICAgICAgICByZXR1cm4gc291cmNlQ2xhc3Muc2VsZWN0b3IgKyBgLmpvaW4oZWRnZSwgJHtub2RlSGFzaE5hbWV9LCAke2VkZ2VIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEZ1bGwgY29ubmVjdGlvbnNcbiAgICAgICAgbGV0IHJlc3VsdCA9IHNvdXJjZUNsYXNzLnNlbGVjdG9yO1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oZWRnZSwgJHtub2RlSGFzaE5hbWV9LCAke2VkZ2VIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gpYDtcbiAgICAgICAgKHsgZWRnZUhhc2hOYW1lLCBub2RlSGFzaE5hbWUgfSA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdKTtcbiAgICAgICAgcmVzdWx0ICs9IGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jIHRvUmF3T2JqZWN0ICgpIHtcbiAgICAvLyBUT0RPOiBhIGJhYmVsIGJ1ZyAoaHR0cHM6Ly9naXRodWIuY29tL2JhYmVsL2JhYmVsL2lzc3Vlcy8zOTMwKVxuICAgIC8vIHByZXZlbnRzIGBhd2FpdCBzdXBlcmA7IHRoaXMgaXMgYSB3b3JrYXJvdW5kOlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEdlbmVyaWNDbGFzcy5wcm90b3R5cGUudG9SYXdPYmplY3QuY2FsbCh0aGlzKTtcbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQuZGlyZWN0ZWQgPSB0aGlzLmRpcmVjdGVkO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgYXN5bmMgY29ubmVjdFRvTm9kZUNsYXNzICh7IG5vZGVDbGFzcywgZGlyZWN0aW9uLCBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICB9XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBhbHJlYWR5IGRlZmluZWQ7IHBsZWFzZSBzcGVjaWZ5IGEgZGlyZWN0aW9uIHRvIG92ZXJyaWRlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIG5vZGVDbGFzcy5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXSA9IHsgbm9kZUhhc2hOYW1lLCBlZGdlSGFzaE5hbWUgfTtcbiAgICBkZWxldGUgdGhpcy5fc3RyZWFtO1xuICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy53cmFwcGVkUGFyZW50ID0gd3JhcHBlZFBhcmVudDtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5yYXdJdGVtID0gcmF3SXRlbTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICB0aGlzLmVudHJpZXNbaGFzaF0ucHVzaCh2YWx1ZSk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEluTWVtb3J5SW5kZXg7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IHNoYTEgZnJvbSAnc2hhMSc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBTdHJlYW0gZnJvbSAnLi9TdHJlYW0uanMnO1xuaW1wb3J0ICogYXMgVE9LRU5TIGZyb20gJy4vVG9rZW5zL1Rva2Vucy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRPS0VOUyA9IFRPS0VOUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gTW9ua2V5LXBhdGNoIGF2YWlsYWJsZSB0b2tlbnMgYXMgZnVuY3Rpb25zIG9udG8gdGhlIFN0cmVhbSBjbGFzc1xuICAgIGZvciAoY29uc3QgdG9rZW5DbGFzc05hbWUgaW4gdGhpcy5UT0tFTlMpIHtcbiAgICAgIGNvbnN0IFRva2VuQ2xhc3MgPSB0aGlzLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV07XG4gICAgICBTdHJlYW0ucHJvdG90eXBlW1Rva2VuQ2xhc3MubG93ZXJDYW1lbENhc2VUeXBlXSA9IGZ1bmN0aW9uIChhcmdMaXN0LCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmV4dGVuZChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgaWYgKHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAvLyBpZiByZWxldmFudCwgbWVyZ2UgdGhlIHJlc3VsdHMgb2YgYSBzZXJpZXMgb2Ygam9pbnMgaW50byBhIHNpbmdsZVxuICAgICAgICAgIC8vIGFycmF5XG4gICAgICAgICAgeWllbGQgdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0uY29uY2F0KFsgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtIF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG90aGVyd2lzZSBqdXN0IHlpZWxkIHRoZSB0d28gcmVzdWx0cyBhcyBhbiBhcnJheVxuICAgICAgICAgIHlpZWxkIFtcbiAgICAgICAgICAgIHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgICAgb3RoZXJXcmFwcGVkSXRlbS5yYXdJdGVtXG4gICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHNoYTE6IHJhd0l0ZW0gPT4gc2hhMShKU09OLnN0cmluZ2lmeShyYXdJdGVtKSksXG4gICAgICBub29wOiAoKSA9PiB7fVxuICAgIH07XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBlYWNoIG9mIG91ciBkYXRhIHNvdXJjZXNcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmxvYWRSb290KCk7XG5cbiAgICAvLyBPYmplY3QgY29udGFpbmluZyBvdXIgY2xhc3Mgc3BlY2lmaWNhdGlvbnNcbiAgICB0aGlzLmNsYXNzZXMgPSB0aGlzLmxvYWRDbGFzc2VzKCk7XG4gIH1cblxuICBsb2FkUm9vdCAoKSB7XG4gICAgbGV0IHJvb3QgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX3Jvb3QnKTtcbiAgICByb290ID0gcm9vdCA/IEpTT04ucGFyc2Uocm9vdCkgOiB7fTtcbiAgICByZXR1cm4gcm9vdDtcbiAgfVxuICBhc3luYyBzYXZlUm9vdCAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX3Jvb3QnLCBKU09OLnN0cmluZ2lmeSh0aGlzLnJvb3QpKTtcbiAgICB9XG4gIH1cbiAgbG9hZENsYXNzZXMgKCkge1xuICAgIGxldCBjbGFzc2VzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnbXVyZV9jbGFzc2VzJyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMgPyBKU09OLnBhcnNlKGNsYXNzZXMpIDoge307XG4gICAgT2JqZWN0LmVudHJpZXMoY2xhc3NlcykuZm9yRWFjaCgoWyBjbGFzc0lkLCByYXdDbGFzc09iaiBdKSA9PiB7XG4gICAgICBPYmplY3QuZW50cmllcyhyYXdDbGFzc09iai5pbmRleGVzKS5mb3JFYWNoKChbZnVuY05hbWUsIHJhd0luZGV4T2JqXSkgPT4ge1xuICAgICAgICByYXdDbGFzc09iai5pbmRleGVzW2Z1bmNOYW1lXSA9IG5ldyB0aGlzLklOREVYRVMuSW5NZW1vcnlJbmRleCh7XG4gICAgICAgICAgZW50cmllczogcmF3SW5kZXhPYmosIGNvbXBsZXRlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBjbGFzc1R5cGUgPSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICBkZWxldGUgcmF3Q2xhc3NPYmouY2xhc3NUeXBlO1xuICAgICAgcmF3Q2xhc3NPYmoubXVyZSA9IHRoaXM7XG4gICAgICBjbGFzc2VzW2NsYXNzSWRdID0gbmV3IHRoaXMuQ0xBU1NFU1tjbGFzc1R5cGVdKHJhd0NsYXNzT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gY2xhc3NlcztcbiAgfVxuICBhc3luYyBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCByYXdDbGFzc2VzID0ge307XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpXG4gICAgICAgIC5tYXAoYXN5bmMgKFsgY2xhc3NJZCwgY2xhc3NPYmogXSkgPT4ge1xuICAgICAgICAgIHJhd0NsYXNzZXNbY2xhc3NJZF0gPSBhd2FpdCBjbGFzc09iai50b1Jhd09iamVjdCgpO1xuICAgICAgICB9KSk7XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdtdXJlX2NsYXNzZXMnLCBKU09OLnN0cmluZ2lmeShyYXdDbGFzc2VzKSk7XG4gICAgfVxuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBjb25zdCBzdGFydHNXaXRoUm9vdCA9IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKTtcbiAgICBpZiAoIShzdGFydHNXaXRoUm9vdCB8fCBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdlbXB0eScpKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290JyBvciAnZW1wdHknYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogc3RhcnRzV2l0aFJvb3QgPyB0aGlzLlRPS0VOUy5Sb290VG9rZW4gOiB0aGlzLlRPS0VOUy5FbXB0eVRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3RgIH0pIHtcbiAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgY29uc3QgQ2xhc3NUeXBlID0gb3B0aW9ucy5DbGFzc1R5cGUgfHwgdGhpcy5DTEFTU0VTLkdlbmVyaWNDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5DbGFzc1R5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnNhdmVSb290KCksIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSldKTtcbiAgICByZXR1cm4gdGVtcFsxXTtcbiAgfVxuICBhc3luYyByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgYXdhaXQgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlciwgbnVsbCk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsImV2ZW50SGFuZGxlcnMiLCJzdGlja3lUcmlnZ2VycyIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMiLCJpbmRleE9mIiwicHVzaCIsImluZGV4Iiwic3BsaWNlIiwiYXJncyIsImZvckVhY2giLCJhcHBseSIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwidGltZW91dCIsInNldFRpbWVvdXQiLCJ0cmlnZ2VyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsImkiLCJTdHJlYW0iLCJvcHRpb25zIiwibXVyZSIsIm5hbWVkRnVuY3Rpb25zIiwiTkFNRURfRlVOQ1RJT05TIiwibmFtZWRTdHJlYW1zIiwibGF1bmNoZWRGcm9tQ2xhc3MiLCJpbmRleGVzIiwidG9rZW5DbGFzc0xpc3QiLCJ0b2tlbkxpc3QiLCJtYXAiLCJUb2tlbkNsYXNzIiwiYXJnTGlzdCIsIldyYXBwZXJzIiwiZ2V0V3JhcHBlckxpc3QiLCJ0b2tlbiIsImxlbmd0aCIsIldyYXBwZXIiLCJsb2NhbFRva2VuTGlzdCIsInNsaWNlIiwicG90ZW50aWFsV3JhcHBlcnMiLCJ2YWx1ZXMiLCJjbGFzc2VzIiwiZmlsdGVyIiwiY2xhc3NPYmoiLCJldmVyeSIsImxvY2FsVG9rZW4iLCJsb2NhbEluZGV4IiwidG9rZW5DbGFzc1NwZWMiLCJpc1N1YnNldE9mIiwiV1JBUFBFUlMiLCJHZW5lcmljV3JhcHBlciIsIndhcm4iLCJzZWxlY3RvciIsImpvaW4iLCJwYXJzZVNlbGVjdG9yIiwiY29uY2F0Iiwid3JhcHBlZFBhcmVudCIsInJhd0l0ZW0iLCJoYXNoZXMiLCJ3cmFwcGVySW5kZXgiLCJ0ZW1wIiwid3JhcHBlZEl0ZW0iLCJQcm9taXNlIiwiYWxsIiwiZW50cmllcyIsInJlZHVjZSIsInByb21pc2VMaXN0IiwiaGFzaEZ1bmN0aW9uTmFtZSIsImhhc2giLCJnZXRJbmRleCIsImNvbXBsZXRlIiwiYWRkVmFsdWUiLCJsYXN0VG9rZW4iLCJpdGVyYXRlIiwiSU5ERVhFUyIsIkluTWVtb3J5SW5kZXgiLCJoYXNoRnVuY3Rpb24iLCJFcnJvciIsImxpbWl0IiwicmVidWlsZEluZGV4ZXMiLCJpdGVyYXRvciIsIm5leHQiLCJkb25lIiwidmFsdWUiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJjb25zdHJ1Y3RvciIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiQmFzZVRva2VuIiwic3RyZWFtIiwidG9Mb3dlckNhc2UiLCJhbmNlc3RvclRva2VucyIsInBhcmVudFRva2VuIiwieWllbGRlZFNvbWV0aGluZyIsImRlYnVnIiwiVHlwZUVycm9yIiwiZXhlYyIsIm5hbWUiLCJFbXB0eVRva2VuIiwiUm9vdFRva2VuIiwid3JhcCIsInJvb3QiLCJLZXlzVG9rZW4iLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJ1bmRlZmluZWQiLCJhcmciLCJtYXRjaCIsIkluZmluaXR5IiwiZCIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiU3ludGF4RXJyb3IiLCJKU09OIiwic3RyaW5naWZ5IiwiY29uc29saWRhdGVSYW5nZXMiLCJzZWxlY3RzTm90aGluZyIsIm5ld1JhbmdlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRSYW5nZSIsIm90aGVyVG9rZW4iLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiaXRlcmF0ZVBhcmVudCIsIk1hdGgiLCJtYXgiLCJtaW4iLCJoYXNPd25Qcm9wZXJ0eSIsIlZhbHVlVG9rZW4iLCJvYmoiLCJrZXlUeXBlIiwiRXZhbHVhdGVUb2tlbiIsIm5ld1N0cmVhbSIsImZvcmsiLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJyZWR1Y2VJbnN0YW5jZXMiLCJmdW5jIiwibWFwRnVuY3Rpb24iLCJyZWR1Y2VJbnN0YW5jZXNGdW5jdGlvbiIsImhhc2hJbmRleCIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJnZXRWYWx1ZUxpc3QiLCJKb2luVG9rZW4iLCJvdGhlclN0cmVhbSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiZmluaXNoIiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiaXRlckVudHJpZXMiLCJ2YWx1ZUxpc3QiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsIm9wc1NpbmNlQ3VzdG9tTmFtZSIsImZ1bmNOYW1lIiwiRnVuY3Rpb24iLCJyZXN1bHQiLCJ0b1N0cmluZyIsInRvUmF3T2JqZWN0IiwiY2xhc3NOYW1lIiwidG9rZW5TdHJpbmdzIiwic2xpY2VJbmRleCIsInJlc2V0IiwiX3N0cmVhbSIsImlzU3VwZXJTZXRPZiIsIkNMQVNTRVMiLCJOb2RlQ2xhc3MiLCJzYXZlQ2xhc3NlcyIsIkVkZ2VDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwicHJvdG90eXBlIiwiY2FsbCIsIm5vZGVDbGFzcyIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsIm5vZGVIYXNoTmFtZSIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJkaXJlY3Rpb24iLCJORVhUX0NMQVNTX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVE9LRU5TIiwidG9rZW5DbGFzc05hbWUiLCJleHRlbmQiLCJwYXJlbnRUeXBlIiwiQXJyYXkiLCJzaGExIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0luZGV4T2JqIiwiY2xhc3NUeXBlIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJzdGFydHNXaXRoIiwiY2h1bmsiLCJ0b1VwcGVyQ2FzZSIsInNwbGl0IiwidHJpbSIsIkNsYXNzVHlwZSIsImNoYXJzZXQiLCJmaWxlT2JqIiwiZmlsZU1CIiwic2l6ZSIsInNraXBTaXplQ2hlY2siLCJ0ZXh0IiwicmVzb2x2ZSIsInJlamVjdCIsInJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJlbmNvZGluZyIsImFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSIsImV4dGVuc2lvbk92ZXJyaWRlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljRGF0YVNvdXJjZSIsInNhdmVSb290IiwibmV3Q2xhc3MiLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxNQUFNQSxtQkFBbUIsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO2tCQUNmO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0Is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
