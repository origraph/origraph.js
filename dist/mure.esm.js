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
  constructor(stream, [otherStream, thisHash = 'key', otherHash = 'key', finish = 'defaultFinish', nthJoin = 0]) {
    super(stream);
    for (const func of [thisHash, finish]) {
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
    this.nthJoin = nthJoin;
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
    this.indexes = options.indexes || {};
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
    var _this = this;

    return asyncToGenerator(function* () {
      const result = {
        classType: _this.constructor.name,
        selector: _this._selector,
        customClassName: _this.customClassName,
        customNameTokenIndex: _this.customNameTokenIndex,
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
  setClassName(value) {
    var _this2 = this;

    return asyncToGenerator(function* () {
      if (_this2.customClassName !== value) {
        _this2.customClassName = value;
        _this2.customNameTokenIndex = _this2.selector.match(/\.([^(]*)\(([^)]*)\)/g).length;
        yield _this2.mure.saveClasses();
      }
    })();
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
  setNamedFunction(funcName, func) {
    this.namedFunctions[funcName] = func;
  }
  populateStreamOptions(options = {}) {
    options.mure = this.mure;
    options.tokenClassList = this.tokenClassList;
    options.namedFunctions = this.namedFunctions;
    options.launchedFromClass = this;
    options.indexes = this.indexes;
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
    var _this3 = this;

    return asyncToGenerator(function* () {
      const options = yield _this3.toRawObject();
      options.mure = _this3.mure;
      _this3.mure.classes[_this3.classId] = new _this3.mure.CLASSES.NodeClass(options);
      yield _this3.mure.saveClasses();
      return _this3.mure.classes[_this3.classId];
    })();
  }
  interpretAsEdges() {
    var _this4 = this;

    return asyncToGenerator(function* () {
      const options = yield _this4.toRawObject();
      options.mure = _this4.mure;
      _this4.mure.classes[_this4.classId] = new _this4.mure.CLASSES.EdgeClass(options);
      yield _this4.mure.saveClasses();
      return _this4.mure.classes[_this4.classId];
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
  delete() {
    return asyncToGenerator(function* () {
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
      let result = this._selector;
      if (!sourceClass) {
        if (!targetClass) {
          // No connections yet; just yield the raw edge table
          return result;
        } else {
          // Partial edge-target connections
          const { edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId];
          return result + `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        }
      } else if (!targetClass) {
        // Partial source-edge connections
        const { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        return result + `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
      } else {
        // Full connections
        let { nodeHashName, edgeHashName } = sourceClass.edgeConnections[this.classId];
        result += `.join(source, ${edgeHashName}, ${nodeHashName}, defaultFinish)`;
        ({ edgeHashName, nodeHashName } = targetClass.edgeConnections[this.classId]);
        result += `.join(target, ${edgeHashName}, ${nodeHashName}, defaultFinish, 1)`;
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
      _this.trigger('rootUpdate');
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
      _this2.trigger('classUpdate');
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
var version = "0.4.8r2";
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
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^3.0.7",
	"rollup-plugin-commonjs": "^9.1.6",
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL0VtcHR5VG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9Kb2luVG9rZW4uanMiLCIuLi9zcmMvQ2xhc3Nlcy9HZW5lcmljQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9Ob2RlQ2xhc3MuanMiLCIuLi9zcmMvQ2xhc3Nlcy9FZGdlQ2xhc3MuanMiLCIuLi9zcmMvV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMiLCIuLi9zcmMvV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMiLCIuLi9zcmMvSW5kZXhlcy9Jbk1lbW9yeUluZGV4LmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIFN0cmVhbSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgdGhpcy5tdXJlID0gb3B0aW9ucy5tdXJlO1xuICAgIHRoaXMubmFtZWRGdW5jdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LFxuICAgICAgdGhpcy5tdXJlLk5BTUVEX0ZVTkNUSU9OUywgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyB8fCB7fSk7XG4gICAgdGhpcy5uYW1lZFN0cmVhbXMgPSBvcHRpb25zLm5hbWVkU3RyZWFtcyB8fCB7fTtcbiAgICB0aGlzLmxhdW5jaGVkRnJvbUNsYXNzID0gb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyB8fCBudWxsO1xuICAgIHRoaXMuaW5kZXhlcyA9IG9wdGlvbnMuaW5kZXhlcyB8fCB7fTtcbiAgICB0aGlzLnRva2VuQ2xhc3NMaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdCB8fCBbXTtcblxuICAgIC8vIFJlbWluZGVyOiB0aGlzIGFsd2F5cyBuZWVkcyB0byBiZSBhZnRlciBpbml0aWFsaXppbmcgdGhpcy5uYW1lZEZ1bmN0aW9uc1xuICAgIC8vIGFuZCB0aGlzLm5hbWVkU3RyZWFtc1xuICAgIHRoaXMudG9rZW5MaXN0ID0gb3B0aW9ucy50b2tlbkNsYXNzTGlzdC5tYXAoKHsgVG9rZW5DbGFzcywgYXJnTGlzdCB9KSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFRva2VuQ2xhc3ModGhpcywgYXJnTGlzdCk7XG4gICAgfSk7XG4gICAgLy8gUmVtaW5kZXI6IHRoaXMgYWx3YXlzIG5lZWRzIHRvIGJlIGFmdGVyIGluaXRpYWxpemluZyB0aGlzLnRva2VuTGlzdFxuICAgIHRoaXMuV3JhcHBlcnMgPSB0aGlzLmdldFdyYXBwZXJMaXN0KCk7XG4gIH1cblxuICBnZXRXcmFwcGVyTGlzdCAoKSB7XG4gICAgLy8gTG9vayB1cCB3aGljaCwgaWYgYW55LCBjbGFzc2VzIGRlc2NyaWJlIHRoZSByZXN1bHQgb2YgZWFjaCB0b2tlbiwgc28gdGhhdFxuICAgIC8vIHdlIGNhbiB3cmFwIGl0ZW1zIGFwcHJvcHJpYXRlbHk6XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0Lm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICBpZiAoaW5kZXggPT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDEgJiYgdGhpcy5sYXVuY2hlZEZyb21DbGFzcykge1xuICAgICAgICAvLyBJZiB0aGlzIHN0cmVhbSB3YXMgc3RhcnRlZCBmcm9tIGEgY2xhc3MsIHdlIGFscmVhZHkga25vdyB3ZSBzaG91bGRcbiAgICAgICAgLy8gdXNlIHRoYXQgY2xhc3MncyB3cmFwcGVyIGZvciB0aGUgbGFzdCB0b2tlblxuICAgICAgICByZXR1cm4gdGhpcy5sYXVuY2hlZEZyb21DbGFzcy5XcmFwcGVyO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBhIGNsYXNzIHRoYXQgZGVzY3JpYmVzIGV4YWN0bHkgZWFjaCBzZXJpZXMgb2YgdG9rZW5zXG4gICAgICBjb25zdCBsb2NhbFRva2VuTGlzdCA9IHRoaXMudG9rZW5MaXN0LnNsaWNlKDAsIGluZGV4ICsgMSk7XG4gICAgICBjb25zdCBwb3RlbnRpYWxXcmFwcGVycyA9IE9iamVjdC52YWx1ZXModGhpcy5tdXJlLmNsYXNzZXMpXG4gICAgICAgIC5maWx0ZXIoY2xhc3NPYmogPT4ge1xuICAgICAgICAgIGlmICghY2xhc3NPYmoudG9rZW5DbGFzc0xpc3QubGVuZ3RoICE9PSBsb2NhbFRva2VuTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW5MaXN0LmV2ZXJ5KChsb2NhbFRva2VuLCBsb2NhbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b2tlbkNsYXNzU3BlYyA9IGNsYXNzT2JqLnRva2VuQ2xhc3NMaXN0W2xvY2FsSW5kZXhdO1xuICAgICAgICAgICAgcmV0dXJuIGxvY2FsVG9rZW4gaW5zdGFuY2VvZiB0b2tlbkNsYXNzU3BlYy5Ub2tlbkNsYXNzICYmXG4gICAgICAgICAgICAgIHRva2VuLmlzU3Vic2V0T2YodG9rZW5DbGFzc1NwZWMuYXJnTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgaWYgKHBvdGVudGlhbFdyYXBwZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBObyBjbGFzc2VzIGRlc2NyaWJlIHRoaXMgc2VyaWVzIG9mIHRva2Vucywgc28gdXNlIHRoZSBnZW5lcmljIHdyYXBwZXJcbiAgICAgICAgcmV0dXJuIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwb3RlbnRpYWxXcmFwcGVycy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBNdWx0aXBsZSBjbGFzc2VzIGRlc2NyaWJlIHRoZSBzYW1lIGl0ZW0hIEFyYml0cmFyaWx5IGNob29zaW5nIG9uZS4uLmApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3RlbnRpYWxXcmFwcGVyc1swXS5XcmFwcGVyO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3Quam9pbignJyk7XG4gIH1cblxuICBmb3JrIChzZWxlY3Rvcikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtKHtcbiAgICAgIG11cmU6IHRoaXMubXVyZSxcbiAgICAgIG5hbWVkRnVuY3Rpb25zOiB0aGlzLm5hbWVkRnVuY3Rpb25zLFxuICAgICAgbmFtZWRTdHJlYW1zOiB0aGlzLm5hbWVkU3RyZWFtcyxcbiAgICAgIHRva2VuQ2xhc3NMaXN0OiB0aGlzLm11cmUucGFyc2VTZWxlY3RvcihzZWxlY3RvciksXG4gICAgICBsYXVuY2hlZEZyb21DbGFzczogdGhpcy5sYXVuY2hlZEZyb21DbGFzcyxcbiAgICAgIGluZGV4ZXM6IHRoaXMuaW5kZXhlc1xuICAgIH0pO1xuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgb3B0aW9ucy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMubmFtZWRGdW5jdGlvbnMsIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgfHwge30pO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5uYW1lZFN0cmVhbXMsIG9wdGlvbnMubmFtZWRTdHJlYW1zIHx8IHt9KTtcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy50b2tlbkNsYXNzTGlzdC5jb25jYXQoW3sgVG9rZW5DbGFzcywgYXJnTGlzdCB9XSk7XG4gICAgb3B0aW9ucy5sYXVuY2hlZEZyb21DbGFzcyA9IG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgfHwgdGhpcy5sYXVuY2hlZEZyb21DbGFzcztcbiAgICBvcHRpb25zLmluZGV4ZXMgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLmluZGV4ZXMsIG9wdGlvbnMuaW5kZXhlcyB8fCB7fSk7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW0ob3B0aW9ucyk7XG4gIH1cblxuICBhc3luYyB3cmFwICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtLCBoYXNoZXMgPSB7fSB9KSB7XG4gICAgbGV0IHdyYXBwZXJJbmRleCA9IDA7XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB3cmFwcGVySW5kZXggKz0gMTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gbmV3IHRoaXMuV3JhcHBlcnNbd3JhcHBlckluZGV4XSh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKGhhc2hlcykucmVkdWNlKChwcm9taXNlTGlzdCwgW2hhc2hGdW5jdGlvbk5hbWUsIGhhc2hdKSA9PiB7XG4gICAgICBjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXgoaGFzaEZ1bmN0aW9uTmFtZSk7XG4gICAgICBpZiAoIWluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNlTGlzdC5jb25jYXQoWyBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSkgXSk7XG4gICAgICB9XG4gICAgfSwgW10pKTtcbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cblxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGNvbnN0IGxhc3RUb2tlbiA9IHRoaXMudG9rZW5MaXN0W3RoaXMudG9rZW5MaXN0Lmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnRva2VuTGlzdC5zbGljZSgwLCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICB5aWVsZCAqIGF3YWl0IGxhc3RUb2tlbi5pdGVyYXRlKHRlbXApO1xuICB9XG5cbiAgZ2V0SW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXSkge1xuICAgICAgLy8gVE9ETzogaWYgdXNpbmcgbm9kZS5qcywgc3RhcnQgd2l0aCBleHRlcm5hbCAvIG1vcmUgc2NhbGFibGUgaW5kZXhlc1xuICAgICAgdGhpcy5pbmRleGVzW2hhc2hGdW5jdGlvbk5hbWVdID0gbmV3IHRoaXMubXVyZS5JTkRFWEVTLkluTWVtb3J5SW5kZXgoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgfVxuXG4gIGFzeW5jIGJ1aWxkSW5kZXggKGhhc2hGdW5jdGlvbk5hbWUpIHtcbiAgICBjb25zdCBoYXNoRnVuY3Rpb24gPSB0aGlzLm5hbWVkRnVuY3Rpb25zW2hhc2hGdW5jdGlvbk5hbWVdO1xuICAgIGlmICghaGFzaEZ1bmN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbmFtZWQgZnVuY3Rpb246ICR7aGFzaEZ1bmN0aW9uTmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLmdldEluZGV4KGhhc2hGdW5jdGlvbk5hbWUpO1xuICAgIGlmIChpbmRleC5jb21wbGV0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2YgaGFzaEZ1bmN0aW9uKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBpbmRleC5hZGRWYWx1ZShoYXNoLCB3cmFwcGVkSXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIGluZGV4LmNvbXBsZXRlID0gdHJ1ZTtcbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAsIHJlYnVpbGRJbmRleGVzID0gZmFsc2UgfSkge1xuICAgIC8vIEJlZm9yZSB3ZSBzdGFydCwgY2xlYW4gb3V0IGFueSBvbGQgaW5kZXhlcyB0aGF0IHdlcmUgbmV2ZXIgZmluaXNoZWRcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLmluZGV4ZXMpLmZvckVhY2goKFtoYXNoRnVuY3Rpb25OYW1lLCBpbmRleF0pID0+IHtcbiAgICAgIGlmIChyZWJ1aWxkSW5kZXhlcyB8fCAhaW5kZXguY29tcGxldGUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1toYXNoRnVuY3Rpb25OYW1lXTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuaXRlcmF0ZSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgLy8gV2UgYWN0dWFsbHkgZmluaXNoZWQgYSBmdWxsIHBhc3M7IGZsYWcgYWxsIG9mIG91ciBpbmRleGVzIGFzIGNvbXBsZXRlXG4gICAgICAgIE9iamVjdC52YWx1ZXModGhpcy5pbmRleGVzKS5mb3JFYWNoKGluZGV4ID0+IHtcbiAgICAgICAgICBpbmRleC5jb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3ViU2V0T2YgKCkge1xuICAgIC8vIEJ5IGRlZmF1bHQgKHdpdGhvdXQgYW55IGFyZ3VtZW50cyksIHRva2VucyBvZiB0aGUgc2FtZSBjbGFzcyBhcmUgc3Vic2V0c1xuICAgIC8vIG9mIGVhY2ggb3RoZXJcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlUGFyZW50IChhbmNlc3RvclRva2Vucykge1xuICAgIGNvbnN0IHBhcmVudFRva2VuID0gYW5jZXN0b3JUb2tlbnNbYW5jZXN0b3JUb2tlbnMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGVtcCA9IGFuY2VzdG9yVG9rZW5zLnNsaWNlKDAsIGFuY2VzdG9yVG9rZW5zLmxlbmd0aCAtIDEpO1xuICAgIGxldCB5aWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRva2VuLml0ZXJhdGUodGVtcCkpIHtcbiAgICAgIHlpZWxkZWRTb21ldGhpbmcgPSB0cnVlO1xuICAgICAgeWllbGQgd3JhcHBlZFBhcmVudDtcbiAgICB9XG4gICAgaWYgKCF5aWVsZGVkU29tZXRoaW5nICYmIHRoaXMubXVyZS5kZWJ1Zykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVG9rZW4geWllbGRlZCBubyByZXN1bHRzOiAke3BhcmVudFRva2VufWApO1xuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgRW1wdHlUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoKSB7XG4gICAgLy8geWllbGQgbm90aGluZ1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYGVtcHR5YDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRW1wdHlUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBSb290VG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgd3JhcHBlZFBhcmVudDogbnVsbCxcbiAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgcmF3SXRlbTogdGhpcy5zdHJlYW0ubXVyZS5yb290XG4gICAgfSk7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgcm9vdGA7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFJvb3RUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBLZXlzVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBhcmdMaXN0LCB7IG1hdGNoQWxsLCBrZXlzLCByYW5nZXMgfSA9IHt9KSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoa2V5cyB8fCByYW5nZXMpIHtcbiAgICAgIHRoaXMua2V5cyA9IGtleXM7XG4gICAgICB0aGlzLnJhbmdlcyA9IHJhbmdlcztcbiAgICB9IGVsc2UgaWYgKChhcmdMaXN0ICYmIGFyZ0xpc3QubGVuZ3RoID09PSAxICYmIGFyZ0xpc3RbMF0gPT09IHVuZGVmaW5lZCkgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1YlNldE9mIChhcmdMaXN0KSB7XG4gICAgY29uc3Qgb3RoZXJUb2tlbiA9IG5ldyBLZXlzVG9rZW4odGhpcy5zdHJlYW0sIGFyZ0xpc3QpO1xuICAgIGNvbnN0IGRpZmYgPSBvdGhlclRva2VuLmRpZmZlcmVuY2UodGhpcyk7XG4gICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgaWYgKHRoaXMubWF0Y2hBbGwpIHsgcmV0dXJuICcua2V5cygpJzsgfVxuICAgIHJldHVybiAnLmtleXMoJyArICh0aGlzLnJhbmdlcyB8fCBbXSkubWFwKCh7bG93LCBoaWdofSkgPT4ge1xuICAgICAgcmV0dXJuIGxvdyA9PT0gaGlnaCA/IGxvdyA6IGAke2xvd30tJHtoaWdofWA7XG4gICAgfSkuY29uY2F0KE9iamVjdC5rZXlzKHRoaXMua2V5cyB8fCB7fSkubWFwKGtleSA9PiBgJyR7a2V5fSdgKSlcbiAgICAgIC5qb2luKCcsJykgKyAnKSc7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gS2V5c1Rva2VuIGlzIG5vdCBhbiBvYmplY3RgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IHtsb3csIGhpZ2h9IG9mIHRoaXMucmFuZ2VzIHx8IFtdKSB7XG4gICAgICAgICAgbG93ID0gTWF0aC5tYXgoMCwgbG93KTtcbiAgICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICAgIGZvciAobGV0IGkgPSBsb3c7IGkgPD0gaGlnaDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtW2ldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICAgICAgICByYXdJdGVtOiBpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBrZXkgaW4gdGhpcy5rZXlzIHx8IHt9KSB7XG4gICAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucmF3SXRlbS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBLZXlzVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgVmFsdWVUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGFzeW5jICogaXRlcmF0ZSAoYW5jZXN0b3JUb2tlbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgY29uc3Qgb2JqID0gd3JhcHBlZFBhcmVudCAmJiB3cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICBjb25zdCBrZXkgPSB3cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IChrZXlUeXBlICE9PSAnc3RyaW5nJyAmJiBrZXlUeXBlICE9PSAnbnVtYmVyJykpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgcmF3SXRlbTogb2JqW2tleV1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVmFsdWVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBFdmFsdWF0ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0cmVhbS5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IG5ld1N0cmVhbTtcbiAgICAgIHRyeSB7XG4gICAgICAgIG5ld1N0cmVhbSA9IHRoaXMuc3RyZWFtLmZvcmsod3JhcHBlZFBhcmVudC5yYXdJdGVtKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHlpZWxkICogYXdhaXQgbmV3U3RyZWFtLml0ZXJhdGUoKTtcbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV2YWx1YXRlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgTWFwVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIGdlbmVyYXRvciA9ICdpZGVudGl0eScgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBnZW5lcmF0b3I7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3ViU2V0T2YgKFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIGdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChhbmNlc3RvclRva2Vucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLml0ZXJhdGVQYXJlbnQoYW5jZXN0b3JUb2tlbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG1hcHBlZFJhd0l0ZW0gb2YgdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5nZW5lcmF0b3JdKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbTogbWFwcGVkUmF3SXRlbVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTWFwVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUHJvbW90ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgWyBtYXAgPSAnaWRlbnRpdHknLCBoYXNoID0gJ3NoYTEnLCByZWR1Y2VJbnN0YW5jZXMgPSAnbm9vcCcgXSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIFsgbWFwLCBoYXNoLCByZWR1Y2VJbnN0YW5jZXMgXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMubWFwID0gbWFwO1xuICAgIHRoaXMuaGFzaCA9IGhhc2g7XG4gICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPSByZWR1Y2VJbnN0YW5jZXM7XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnc2hhMScsIHJlZHVjZUluc3RhbmNlcyA9ICdub29wJyBdKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwID09PSBtYXAgJiZcbiAgICAgIHRoaXMuaGFzaCA9PT0gaGFzaCAmJlxuICAgICAgdGhpcy5yZWR1Y2VJbnN0YW5jZXMgPT09IHJlZHVjZUluc3RhbmNlcztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuaXRlcmF0ZVBhcmVudChhbmNlc3RvclRva2VucykpIHtcbiAgICAgIGNvbnN0IG1hcEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5tYXBdO1xuICAgICAgY29uc3QgaGFzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5oYXNoXTtcbiAgICAgIGNvbnN0IHJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5yZWR1Y2VJbnN0YW5jZXNdO1xuICAgICAgY29uc3QgaGFzaEluZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy5oYXNoKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiBtYXBGdW5jdGlvbih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgICBjb25zdCBoYXNoID0gaGFzaEZ1bmN0aW9uKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgICBsZXQgb3JpZ2luYWxXcmFwcGVkSXRlbSA9IChhd2FpdCBoYXNoSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpKVswXTtcbiAgICAgICAgaWYgKG9yaWdpbmFsV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWR1Y2VJbnN0YW5jZXMgIT09ICdub29wJykge1xuICAgICAgICAgICAgcmVkdWNlSW5zdGFuY2VzRnVuY3Rpb24ob3JpZ2luYWxXcmFwcGVkSXRlbSwgbWFwcGVkUmF3SXRlbSk7XG4gICAgICAgICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBoYXNoZXMgPSB7fTtcbiAgICAgICAgICBoYXNoZXNbdGhpcy5oYXNoXSA9IGhhc2g7XG4gICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtLFxuICAgICAgICAgICAgaGFzaGVzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUHJvbW90ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEpvaW5Ub2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgb3RoZXJTdHJlYW0sIHRoaXNIYXNoID0gJ2tleScsIG90aGVySGFzaCA9ICdrZXknLCBmaW5pc2ggPSAnZGVmYXVsdEZpbmlzaCcsIG50aEpvaW4gPSAwIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIHRoaXNIYXNoLCBmaW5pc2ggXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbZnVuY10pIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIGZ1bmN0aW9uOiAke2Z1bmN9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcCA9IHN0cmVhbS5uYW1lZFN0cmVhbXNbb3RoZXJTdHJlYW1dO1xuICAgIGlmICghdGVtcCkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIG5hbWVkIHN0cmVhbTogJHtvdGhlclN0cmVhbX1gKTtcbiAgICB9XG4gICAgLy8gUmVxdWlyZSBvdGhlckhhc2ggb24gdGhlIG90aGVyIHN0cmVhbSwgb3IgY29weSBvdXJzIG92ZXIgaWYgaXQgaXNuJ3RcbiAgICAvLyBhbHJlYWR5IGRlZmluZWRcbiAgICBpZiAoIXRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgaWYgKCFzdHJlYW0ubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gaGFzaCBmdW5jdGlvbiBvbiBlaXRoZXIgc3RyZWFtOiAke290aGVySGFzaH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRlbXAubmFtZWRGdW5jdGlvbnNbb3RoZXJIYXNoXSA9IHN0cmVhbS5uYW1lZEZ1bmN0aW9uc1tvdGhlckhhc2hdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3RoZXJTdHJlYW0gPSBvdGhlclN0cmVhbTtcbiAgICB0aGlzLnRoaXNIYXNoID0gdGhpc0hhc2g7XG4gICAgdGhpcy5vdGhlckhhc2ggPSBvdGhlckhhc2g7XG4gICAgdGhpcy5maW5pc2ggPSBmaW5pc2g7XG4gICAgdGhpcy5udGhKb2luID0gbnRoSm9pbjtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgcmV0dXJuIGAuam9pbigke3RoaXMub3RoZXJTdHJlYW19LCAke3RoaXMudGhpc0hhc2h9LCAke3RoaXMub3RoZXJIYXNofSwgJHt0aGlzLmZpbmlzaH0pYDtcbiAgfVxuICBpc1N1YlNldE9mIChbIG90aGVyU3RyZWFtLCB0aGlzSGFzaCA9ICdrZXknLCBvdGhlckhhc2ggPSAna2V5JywgZmluaXNoID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgcmV0dXJuIHRoaXMub3RoZXJTdHJlYW0gPT09IG90aGVyU3RyZWFtICYmXG4gICAgICB0aGlzLnRoaXNIYXNoID09PSB0aGlzSGFzaCAmJlxuICAgICAgdGhpcy5vdGhlckhhc2ggPT09IG90aGVySGFzaCAmJlxuICAgICAgdGhpcy5maW5pc2ggPT09IGZpbmlzaDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGFuY2VzdG9yVG9rZW5zKSB7XG4gICAgY29uc3Qgb3RoZXJTdHJlYW0gPSB0aGlzLnN0cmVhbS5uYW1lZFN0cmVhbXNbdGhpcy5vdGhlclN0cmVhbV07XG4gICAgY29uc3QgdGhpc0hhc2hGdW5jdGlvbiA9IHRoaXMuc3RyZWFtLm5hbWVkRnVuY3Rpb25zW3RoaXMudGhpc0hhc2hdO1xuICAgIGNvbnN0IG90aGVySGFzaEZ1bmN0aW9uID0gb3RoZXJTdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5vdGhlckhhc2hdO1xuICAgIGNvbnN0IGZpbmlzaEZ1bmN0aW9uID0gdGhpcy5zdHJlYW0ubmFtZWRGdW5jdGlvbnNbdGhpcy5maW5pc2hdO1xuXG4gICAgLy8gY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAvLyBjb25zdCBvdGhlckl0ZXJhdG9yID0gb3RoZXJTdHJlYW0uaXRlcmF0ZSgpO1xuXG4gICAgY29uc3QgdGhpc0luZGV4ID0gdGhpcy5zdHJlYW0uZ2V0SW5kZXgodGhpcy50aGlzSGFzaCk7XG4gICAgY29uc3Qgb3RoZXJJbmRleCA9IG90aGVyU3RyZWFtLmdldEluZGV4KHRoaXMub3RoZXJIYXNoKTtcblxuICAgIGlmICh0aGlzSW5kZXguY29tcGxldGUpIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIEJlc3Qgb2YgYWxsIHdvcmxkczsgd2UgY2FuIGp1c3Qgam9pbiB0aGUgaW5kZXhlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgaGFzaCwgdmFsdWVMaXN0IH0gb2YgdGhpc0luZGV4Lml0ZXJFbnRyaWVzKCkpIHtcbiAgICAgICAgICBjb25zdCBvdGhlckxpc3QgPSBhd2FpdCBvdGhlckluZGV4LmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG90aGVyV3JhcHBlZEl0ZW0gb2Ygb3RoZXJMaXN0KSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRoaXNXcmFwcGVkSXRlbSBvZiB2YWx1ZUxpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWVkIHRvIGl0ZXJhdGUgdGhlIG90aGVyIGl0ZW1zLCBhbmQgdGFrZSBhZHZhbnRhZ2Ugb2Ygb3VyIGNvbXBsZXRlXG4gICAgICAgIC8vIGluZGV4XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlclN0cmVhbS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIEFkZCBvdGhlcldyYXBwZWRJdGVtIHRvIG90aGVySW5kZXg6XG4gICAgICAgICAgICBhd2FpdCBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgY29uc3QgdGhpc0xpc3QgPSBhd2FpdCB0aGlzSW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpc0xpc3QpIHtcbiAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS53cmFwKHtcbiAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgcmF3SXRlbVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvdGhlckluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gaXRlcmF0ZSBvdXIgaXRlbXMsIGFuZCB0YWtlIGFkdmFudGFnZSBvZiB0aGUgb3RoZXIgY29tcGxldGVcbiAgICAgICAgLy8gaW5kZXhcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0aGlzV3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaGFzaCBvZiB0aGlzSGFzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgIC8vIGFkZCB0aGlzV3JhcHBlZEl0ZW0gdG8gdGhpc0luZGV4XG4gICAgICAgICAgICBhd2FpdCB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc1dyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IG90aGVyTGlzdCA9IGF3YWl0IG90aGVySW5kZXguZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBvdGhlcldyYXBwZWRJdGVtIG9mIG90aGVyTGlzdCkge1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudDogdGhpc1dyYXBwZWRJdGVtLFxuICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgc3RyZWFtIGlzIGZ1bGx5IGluZGV4ZWQ7IGZvciBtb3JlIGRpc3RyaWJ1dGVkIHNhbXBsaW5nLCBncmFiXG4gICAgICAgIC8vIG9uZSBpdGVtIGZyb20gZWFjaCBzdHJlYW0gYXQgYSB0aW1lLCBhbmQgdXNlIHRoZSBwYXJ0aWFsIGluZGV4ZXNcbiAgICAgICAgY29uc3QgdGhpc0l0ZXJhdG9yID0gdGhpcy5pdGVyYXRlUGFyZW50KGFuY2VzdG9yVG9rZW5zKTtcbiAgICAgICAgbGV0IHRoaXNJc0RvbmUgPSBmYWxzZTtcbiAgICAgICAgY29uc3Qgb3RoZXJJdGVyYXRvciA9IG90aGVyU3RyZWFtLml0ZXJhdGUoKTtcbiAgICAgICAgbGV0IG90aGVySXNEb25lID0gZmFsc2U7XG5cbiAgICAgICAgd2hpbGUgKCF0aGlzSXNEb25lIHx8ICFvdGhlcklzRG9uZSkge1xuICAgICAgICAgIC8vIFRha2Ugb25lIHNhbXBsZSBmcm9tIHRoaXMgc3RyZWFtXG4gICAgICAgICAgbGV0IHRlbXAgPSBhd2FpdCB0aGlzSXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXNJc0RvbmUgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB0aGlzV3JhcHBlZEl0ZW0gPSBhd2FpdCB0ZW1wLnZhbHVlO1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBoYXNoIG9mIHRoaXNIYXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAvLyBhZGQgdGhpc1dyYXBwZWRJdGVtIHRvIHRoaXNJbmRleFxuICAgICAgICAgICAgICB0aGlzSW5kZXguYWRkVmFsdWUoaGFzaCwgdGhpc1dyYXBwZWRJdGVtKTtcbiAgICAgICAgICAgICAgY29uc3Qgb3RoZXJMaXN0ID0gYXdhaXQgb3RoZXJJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSBvZiBvdGhlckxpc3QpIHtcbiAgICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHJhd0l0ZW0gb2YgZmluaXNoRnVuY3Rpb24odGhpc1dyYXBwZWRJdGVtLCBvdGhlcldyYXBwZWRJdGVtKSkge1xuICAgICAgICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ud3JhcCh7XG4gICAgICAgICAgICAgICAgICAgIHdyYXBwZWRQYXJlbnQ6IHRoaXNXcmFwcGVkSXRlbSxcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIHJhd0l0ZW1cbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5vdyBmb3IgYSBzYW1wbGUgZnJvbSB0aGUgb3RoZXIgc3RyZWFtXG4gICAgICAgICAgdGVtcCA9IGF3YWl0IG90aGVySXRlcmF0b3IubmV4dCgpO1xuICAgICAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgICAgIG90aGVySXNEb25lID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RoZXJXcmFwcGVkSXRlbSA9IGF3YWl0IHRlbXAudmFsdWU7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGhhc2ggb2Ygb3RoZXJIYXNoRnVuY3Rpb24ob3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgLy8gYWRkIG90aGVyV3JhcHBlZEl0ZW0gdG8gb3RoZXJJbmRleFxuICAgICAgICAgICAgICBvdGhlckluZGV4LmFkZFZhbHVlKGhhc2gsIG90aGVyV3JhcHBlZEl0ZW0pO1xuICAgICAgICAgICAgICBjb25zdCB0aGlzTGlzdCA9IGF3YWl0IHRoaXNJbmRleC5nZXRWYWx1ZUxpc3QoaGFzaCk7XG4gICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGhpc1dyYXBwZWRJdGVtIG9mIHRoaXNMaXN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCByYXdJdGVtIG9mIGZpbmlzaEZ1bmN0aW9uKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgIHlpZWxkIHRoaXMuc3RyZWFtLndyYXAoe1xuICAgICAgICAgICAgICAgICAgICB3cmFwcGVkUGFyZW50OiB0aGlzV3JhcHBlZEl0ZW0sXG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgICAgICAgICByYXdJdGVtXG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSm9pblRva2VuO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4uL1N0cmVhbS5qcyc7XG5cbmNvbnN0IEFTVEVSSVNLUyA9IHtcbiAgJ2V2YWx1YXRlJzogJ+KGrCcsXG4gICdqb2luJzogJ+KorycsXG4gICdtYXAnOiAn4oamJyxcbiAgJ3Byb21vdGUnOiAn4oaRJyxcbiAgJ3ZhbHVlJzogJ+KGkidcbn07XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy5fc2VsZWN0b3IgPSBvcHRpb25zLnNlbGVjdG9yO1xuICAgIHRoaXMuY3VzdG9tQ2xhc3NOYW1lID0gb3B0aW9ucy5jdXN0b21DbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID0gb3B0aW9ucy5jdXN0b21OYW1lVG9rZW5JbmRleCB8fCBudWxsO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcjtcbiAgICB0aGlzLmluZGV4ZXMgPSBvcHRpb25zLmluZGV4ZXMgfHwge307XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sXG4gICAgICB0aGlzLm11cmUuTkFNRURfRlVOQ1RJT05TLCBvcHRpb25zLm5hbWVkRnVuY3Rpb25zIHx8IHt9KTtcbiAgICBmb3IgKGxldCBbZnVuY05hbWUsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubmFtZWRGdW5jdGlvbnMpKSB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMubmFtZWRGdW5jdGlvbnNbZnVuY05hbWVdID0gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtmdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICByZXR1cm4gdGhpcy5fc2VsZWN0b3I7XG4gIH1cbiAgZ2V0IHRva2VuQ2xhc3NMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5tdXJlLnBhcnNlU2VsZWN0b3IodGhpcy5zZWxlY3Rvcik7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzVHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgc2VsZWN0b3I6IHRoaXMuX3NlbGVjdG9yLFxuICAgICAgY3VzdG9tQ2xhc3NOYW1lOiB0aGlzLmN1c3RvbUNsYXNzTmFtZSxcbiAgICAgIGN1c3RvbU5hbWVUb2tlbkluZGV4OiB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4LFxuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgaW5kZXhlczoge30sXG4gICAgICBuYW1lZEZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAobGV0IFtmdW5jTmFtZSwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5uYW1lZEZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuaW5kZXhlcykubWFwKGFzeW5jIChbZnVuY05hbWUsIGluZGV4XSkgPT4ge1xuICAgICAgaWYgKGluZGV4LmNvbXBsZXRlKSB7XG4gICAgICAgIHJlc3VsdC5pbmRleGVzW2Z1bmNOYW1lXSA9IGF3YWl0IGluZGV4LnRvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgfSkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5XcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICBpZiAodGhpcy5jdXN0b21DbGFzc05hbWUgIT09IHZhbHVlKSB7XG4gICAgICB0aGlzLmN1c3RvbUNsYXNzTmFtZSA9IHZhbHVlO1xuICAgICAgdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCA9IHRoaXMuc2VsZWN0b3IubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpLmxlbmd0aDtcbiAgICAgIGF3YWl0IHRoaXMubXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIH1cbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmXG4gICAgICB0aGlzLmN1c3RvbU5hbWVUb2tlbkluZGV4ID09PSB0aGlzLnNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKS5sZW5ndGg7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yO1xuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IHRva2VuU3RyaW5ncy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgaWYgKHRoaXMuY3VzdG9tQ2xhc3NOYW1lICE9PSBudWxsICYmIGkgPD0gdGhpcy5jdXN0b21OYW1lVG9rZW5JbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXN0b21DbGFzc05hbWUgKyByZXN1bHQ7XG4gICAgICB9XG4gICAgICBjb25zdCB0ZW1wID0gdG9rZW5TdHJpbmdzW2ldLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAodGVtcFsxXSA9PT0gJ2tleXMnIHx8IHRlbXBbMV0gPT09ICd2YWx1ZXMnKSB7XG4gICAgICAgIGlmICh0ZW1wWzJdID09PSAnJykge1xuICAgICAgICAgIHJlc3VsdCA9ICcqJyArIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHQgPSB0ZW1wWzJdLnJlcGxhY2UoLycoW14nXSopJy8sICckMScpICsgcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBBU1RFUklTS1NbdGVtcFsxXV0gKyByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoc2VsZWN0b3Iuc3RhcnRzV2l0aCgnZW1wdHknKSA/ICfiiIUnIDogJycpICsgcmVzdWx0O1xuICB9XG4gIHNldE5hbWVkRnVuY3Rpb24gKGZ1bmNOYW1lLCBmdW5jKSB7XG4gICAgdGhpcy5uYW1lZEZ1bmN0aW9uc1tmdW5jTmFtZV0gPSBmdW5jO1xuICB9XG4gIHBvcHVsYXRlU3RyZWFtT3B0aW9ucyAob3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcy5tdXJlO1xuICAgIG9wdGlvbnMudG9rZW5DbGFzc0xpc3QgPSB0aGlzLnRva2VuQ2xhc3NMaXN0O1xuICAgIG9wdGlvbnMubmFtZWRGdW5jdGlvbnMgPSB0aGlzLm5hbWVkRnVuY3Rpb25zO1xuICAgIG9wdGlvbnMubGF1bmNoZWRGcm9tQ2xhc3MgPSB0aGlzO1xuICAgIG9wdGlvbnMuaW5kZXhlcyA9IHRoaXMuaW5kZXhlcztcbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfVxuICBnZXRTdHJlYW0gKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChvcHRpb25zLnJlc2V0IHx8ICF0aGlzLl9zdHJlYW0pIHtcbiAgICAgIHRoaXMuX3N0cmVhbSA9IG5ldyBTdHJlYW0odGhpcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtO1xuICB9XG4gIGlzU3VwZXJTZXRPZlRva2VuTGlzdCAodG9rZW5MaXN0KSB7XG4gICAgaWYgKHRva2VuTGlzdC5sZW5ndGggIT09IHRoaXMudG9rZW5MaXN0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICByZXR1cm4gdGhpcy50b2tlbkxpc3QuZXZlcnkoKHRva2VuLCBpKSA9PiB0b2tlbi5pc1N1cGVyU2V0T2YodG9rZW5MaXN0W2ldKSk7XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMudG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzLm11cmU7XG4gICAgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXSA9IG5ldyB0aGlzLm11cmUuQ0xBU1NFUy5FZGdlQ2xhc3Mob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgYXN5bmMgYWdncmVnYXRlIChoYXNoLCByZWR1Y2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBleHBhbmQgKG1hcCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGZpbHRlciAoZmlsdGVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgKiBzcGxpdCAoaGFzaCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGRlbGV0ZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICAgIHRoaXMuZWRnZUNvbm5lY3Rpb25zID0gb3B0aW9ucy5lZGdlQ29ubmVjdGlvbnMgfHwge307XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIC8vIFRPRE86IG5lZWQgdG8gZGVlcCBjb3B5IGVkZ2VDb25uZWN0aW9ucz9cbiAgICByZXN1bHQuZWRnZUNvbm5lY3Rpb25zID0gdGhpcy5lZGdlQ29ubmVjdGlvbnM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCB0aGlzSGFzaE5hbWUsIG90aGVySGFzaE5hbWUgfSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGFzeW5jIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLm11cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IHNlbGVjdG9yICgpIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuXG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgaWYgKCFzb3VyY2VDbGFzcyB8fCAhdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJ0aWFsIGNvbm5lY3Rpb25zIHdpdGhvdXQgYW4gZWRnZSB0YWJsZSBzaG91bGQgbmV2ZXIgaGFwcGVuYCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBObyBlZGdlIHRhYmxlIChzaW1wbGUgam9pbiBiZXR3ZWVuIHR3byBub2RlcylcbiAgICAgICAgY29uc3Qgc291cmNlSGFzaCA9IHNvdXJjZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0SGFzaCA9IHRhcmdldENsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdLm5vZGVIYXNoTmFtZTtcbiAgICAgICAgcmV0dXJuIHNvdXJjZUNsYXNzLnNlbGVjdG9yICsgYC5qb2luKHRhcmdldCwgJHtzb3VyY2VIYXNofSwgJHt0YXJnZXRIYXNofSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5fc2VsZWN0b3I7XG4gICAgICBpZiAoIXNvdXJjZUNsYXNzKSB7XG4gICAgICAgIGlmICghdGFyZ2V0Q2xhc3MpIHtcbiAgICAgICAgICAvLyBObyBjb25uZWN0aW9ucyB5ZXQ7IGp1c3QgeWllbGQgdGhlIHJhdyBlZGdlIHRhYmxlXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBQYXJ0aWFsIGVkZ2UtdGFyZ2V0IGNvbm5lY3Rpb25zXG4gICAgICAgICAgY29uc3QgeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdCArIGAuam9pbih0YXJnZXQsICR7ZWRnZUhhc2hOYW1lfSwgJHtub2RlSGFzaE5hbWV9LCBkZWZhdWx0RmluaXNoKWA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIXRhcmdldENsYXNzKSB7XG4gICAgICAgIC8vIFBhcnRpYWwgc291cmNlLWVkZ2UgY29ubmVjdGlvbnNcbiAgICAgICAgY29uc3QgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJldHVybiByZXN1bHQgKyBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRnVsbCBjb25uZWN0aW9uc1xuICAgICAgICBsZXQgeyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9ID0gc291cmNlQ2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF07XG4gICAgICAgIHJlc3VsdCArPSBgLmpvaW4oc291cmNlLCAke2VkZ2VIYXNoTmFtZX0sICR7bm9kZUhhc2hOYW1lfSwgZGVmYXVsdEZpbmlzaClgO1xuICAgICAgICAoeyBlZGdlSGFzaE5hbWUsIG5vZGVIYXNoTmFtZSB9ID0gdGFyZ2V0Q2xhc3MuZWRnZUNvbm5lY3Rpb25zW3RoaXMuY2xhc3NJZF0pO1xuICAgICAgICByZXN1bHQgKz0gYC5qb2luKHRhcmdldCwgJHtlZGdlSGFzaE5hbWV9LCAke25vZGVIYXNoTmFtZX0sIGRlZmF1bHRGaW5pc2gsIDEpYDtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcG9wdWxhdGVTdHJlYW1PcHRpb25zIChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm11cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIG9wdGlvbnMubmFtZWRTdHJlYW1zID0ge307XG4gICAgaWYgKCF0aGlzLl9zZWxlY3Rvcikge1xuICAgICAgLy8gVXNlIHRoZSBvcHRpb25zIGZyb20gdGhlIHNvdXJjZSBzdHJlYW0gaW5zdGVhZCBvZiBvdXIgY2xhc3NcbiAgICAgIG9wdGlvbnMgPSBzb3VyY2VDbGFzcy5wb3B1bGF0ZVN0cmVhbU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IHN1cGVyLnBvcHVsYXRlU3RyZWFtT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgIGlmIChzb3VyY2VDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy5zb3VyY2UgPSBzb3VyY2VDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXRDbGFzcykge1xuICAgICAgICBvcHRpb25zLm5hbWVkU3RyZWFtcy50YXJnZXQgPSB0YXJnZXRDbGFzcy5nZXRTdHJlYW0oKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9wdGlvbnM7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIC8vIFRPRE86IGEgYmFiZWwgYnVnIChodHRwczovL2dpdGh1Yi5jb20vYmFiZWwvYmFiZWwvaXNzdWVzLzM5MzApXG4gICAgLy8gcHJldmVudHMgYGF3YWl0IHN1cGVyYDsgdGhpcyBpcyBhIHdvcmthcm91bmQ6XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgR2VuZXJpY0NsYXNzLnByb3RvdHlwZS50b1Jhd09iamVjdC5jYWxsKHRoaXMpO1xuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBhc3luYyBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVIYXNoTmFtZSwgZWRnZUhhc2hOYW1lIH0pIHtcbiAgICBpZiAoZGlyZWN0aW9uID09PSAnc291cmNlJykge1xuICAgICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXS5lZGdlQ29ubmVjdGlvbnNbdGhpcy5jbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgU291cmNlIGFuZCB0YXJnZXQgYXJlIGFscmVhZHkgZGVmaW5lZDsgcGxlYXNlIHNwZWNpZnkgYSBkaXJlY3Rpb24gdG8gb3ZlcnJpZGVgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgbm9kZUNsYXNzLmVkZ2VDb25uZWN0aW9uc1t0aGlzLmNsYXNzSWRdID0geyBub2RlSGFzaE5hbWUsIGVkZ2VIYXNoTmFtZSB9O1xuICAgIGRlbGV0ZSB0aGlzLl9zdHJlYW07XG4gICAgYXdhaXQgdGhpcy5tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLndyYXBwZWRQYXJlbnQgPSB3cmFwcGVkUGFyZW50O1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnJhd0l0ZW0gPSByYXdJdGVtO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiY2xhc3MgSW5NZW1vcnlJbmRleCB7XG4gIGNvbnN0cnVjdG9yICh7IGVudHJpZXMgPSB7fSwgY29tcGxldGUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICB0aGlzLmVudHJpZXMgPSBlbnRyaWVzO1xuICAgIHRoaXMuY29tcGxldGUgPSBjb21wbGV0ZTtcbiAgfVxuICBhc3luYyB0b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcztcbiAgfVxuICBhc3luYyAqIGl0ZXJFbnRyaWVzICgpIHtcbiAgICBmb3IgKGNvbnN0IFtoYXNoLCB2YWx1ZUxpc3RdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHsgaGFzaCwgdmFsdWVMaXN0IH07XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlckhhc2hlcyAoKSB7XG4gICAgZm9yIChjb25zdCBoYXNoIG9mIE9iamVjdC5rZXlzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIGhhc2g7XG4gICAgfVxuICB9XG4gIGFzeW5jICogaXRlclZhbHVlTGlzdHMgKCkge1xuICAgIGZvciAoY29uc3QgdmFsdWVMaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5lbnRyaWVzKSkge1xuICAgICAgeWllbGQgdmFsdWVMaXN0O1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRWYWx1ZUxpc3QgKGhhc2gpIHtcbiAgICByZXR1cm4gdGhpcy5lbnRyaWVzW2hhc2hdIHx8IFtdO1xuICB9XG4gIGFzeW5jIGFkZFZhbHVlIChoYXNoLCB2YWx1ZSkge1xuICAgIC8vIFRPRE86IGFkZCBzb21lIGtpbmQgb2Ygd2FybmluZyBpZiB0aGlzIGlzIGdldHRpbmcgYmlnP1xuICAgIHRoaXMuZW50cmllc1toYXNoXSA9IGF3YWl0IHRoaXMuZ2V0VmFsdWVMaXN0KGhhc2gpO1xuICAgIHRoaXMuZW50cmllc1toYXNoXS5wdXNoKHZhbHVlKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IFN0cmVhbSBmcm9tICcuL1N0cmVhbS5qcyc7XG5pbXBvcnQgKiBhcyBUT0tFTlMgZnJvbSAnLi9Ub2tlbnMvVG9rZW5zLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgV1JBUFBFUlMgZnJvbSAnLi9XcmFwcGVycy9XcmFwcGVycy5qcyc7XG5pbXBvcnQgKiBhcyBJTkRFWEVTIGZyb20gJy4vSW5kZXhlcy9JbmRleGVzLmpzJztcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAoRmlsZVJlYWRlciwgbG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBlaXRoZXIgd2luZG93LmxvY2FsU3RvcmFnZSBvciBudWxsXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIGV4dGVuc2lvbnMgdGhhdCB3ZSB3YW50IGRhdGFsaWIgdG8gaGFuZGxlXG4gICAgdGhpcy5EQVRBTElCX0ZPUk1BVFMgPSB7XG4gICAgICAnanNvbic6ICdqc29uJyxcbiAgICAgICdjc3YnOiAnY3N2JyxcbiAgICAgICd0c3YnOiAndHN2JyxcbiAgICAgICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICAgICAndHJlZWpzb24nOiAndHJlZWpzb24nXG4gICAgfTtcblxuICAgIC8vIEFjY2VzcyB0byBjb3JlIGNsYXNzZXMgdmlhIHRoZSBtYWluIGxpYnJhcnkgaGVscHMgYXZvaWQgY2lyY3VsYXIgaW1wb3J0c1xuICAgIHRoaXMuVE9LRU5TID0gVE9LRU5TO1xuICAgIHRoaXMuQ0xBU1NFUyA9IENMQVNTRVM7XG4gICAgdGhpcy5XUkFQUEVSUyA9IFdSQVBQRVJTO1xuICAgIHRoaXMuSU5ERVhFUyA9IElOREVYRVM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZXh0ZW5kKFRva2VuQ2xhc3MsIGFyZ0xpc3QsIG9wdGlvbnMpO1xuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0IG5hbWVkIGZ1bmN0aW9uc1xuICAgIHRoaXMuTkFNRURfRlVOQ1RJT05TID0ge1xuICAgICAgaWRlbnRpdHk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7IHlpZWxkIHdyYXBwZWRJdGVtLnJhd0l0ZW07IH0sXG4gICAgICBrZXk6IGZ1bmN0aW9uICogKHdyYXBwZWRJdGVtKSB7XG4gICAgICAgIGlmICghd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudCB8fFxuICAgICAgICAgICAgdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEdyYW5kcGFyZW50IGlzIG5vdCBhbiBvYmplY3QgLyBhcnJheWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcmVudFR5cGUgPSB0eXBlb2Ygd3JhcHBlZEl0ZW0ud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgICAgICBpZiAoIShwYXJlbnRUeXBlID09PSAnbnVtYmVyJyB8fCBwYXJlbnRUeXBlID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBQYXJlbnQgaXNuJ3QgYSBrZXkgLyBpbmRleGApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRGaW5pc2g6IGZ1bmN0aW9uICogKHRoaXNXcmFwcGVkSXRlbSwgb3RoZXJXcmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAodGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgIC8vIGlmIHJlbGV2YW50LCBtZXJnZSB0aGUgcmVzdWx0cyBvZiBhIHNlcmllcyBvZiBqb2lucyBpbnRvIGEgc2luZ2xlXG4gICAgICAgICAgLy8gYXJyYXlcbiAgICAgICAgICB5aWVsZCB0aGlzV3JhcHBlZEl0ZW0ucmF3SXRlbS5jb25jYXQoWyBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW0gXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gb3RoZXJ3aXNlIGp1c3QgeWllbGQgdGhlIHR3byByZXN1bHRzIGFzIGFuIGFycmF5XG4gICAgICAgICAgeWllbGQgW1xuICAgICAgICAgICAgdGhpc1dyYXBwZWRJdGVtLnJhd0l0ZW0sXG4gICAgICAgICAgICBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgICBdO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgc2hhMTogcmF3SXRlbSA9PiBzaGExKEpTT04uc3RyaW5naWZ5KHJhd0l0ZW0pKSxcbiAgICAgIG5vb3A6ICgpID0+IHt9XG4gICAgfTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHRoaXMubG9hZFJvb3QoKTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMubG9hZENsYXNzZXMoKTtcbiAgfVxuXG4gIGxvYWRSb290ICgpIHtcbiAgICBsZXQgcm9vdCA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ211cmVfcm9vdCcpO1xuICAgIHJvb3QgPSByb290ID8gSlNPTi5wYXJzZShyb290KSA6IHt9O1xuICAgIHJldHVybiByb290O1xuICB9XG4gIGFzeW5jIHNhdmVSb290ICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfcm9vdCcsIEpTT04uc3RyaW5naWZ5KHRoaXMucm9vdCkpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jvb3RVcGRhdGUnKTtcbiAgfVxuICBsb2FkQ2xhc3NlcyAoKSB7XG4gICAgbGV0IGNsYXNzZXMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdtdXJlX2NsYXNzZXMnKTtcbiAgICBjbGFzc2VzID0gY2xhc3NlcyA/IEpTT04ucGFyc2UoY2xhc3NlcykgOiB7fTtcbiAgICBPYmplY3QuZW50cmllcyhjbGFzc2VzKS5mb3JFYWNoKChbIGNsYXNzSWQsIHJhd0NsYXNzT2JqIF0pID0+IHtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHJhd0NsYXNzT2JqLmluZGV4ZXMpLmZvckVhY2goKFtmdW5jTmFtZSwgcmF3SW5kZXhPYmpdKSA9PiB7XG4gICAgICAgIHJhd0NsYXNzT2JqLmluZGV4ZXNbZnVuY05hbWVdID0gbmV3IHRoaXMuSU5ERVhFUy5Jbk1lbW9yeUluZGV4KHtcbiAgICAgICAgICBlbnRyaWVzOiByYXdJbmRleE9iaiwgY29tcGxldGU6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IGNsYXNzVHlwZSA9IHJhd0NsYXNzT2JqLmNsYXNzVHlwZTtcbiAgICAgIGRlbGV0ZSByYXdDbGFzc09iai5jbGFzc1R5cGU7XG4gICAgICByYXdDbGFzc09iai5tdXJlID0gdGhpcztcbiAgICAgIGNsYXNzZXNbY2xhc3NJZF0gPSBuZXcgdGhpcy5DTEFTU0VTW2NsYXNzVHlwZV0ocmF3Q2xhc3NPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBjbGFzc2VzO1xuICB9XG4gIGFzeW5jIHNhdmVDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJhd0NsYXNzZXMgPSB7fTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC5lbnRyaWVzKHRoaXMuY2xhc3NlcylcbiAgICAgICAgLm1hcChhc3luYyAoWyBjbGFzc0lkLCBjbGFzc09iaiBdKSA9PiB7XG4gICAgICAgICAgcmF3Q2xhc3Nlc1tjbGFzc0lkXSA9IGF3YWl0IGNsYXNzT2JqLnRvUmF3T2JqZWN0KCk7XG4gICAgICAgIH0pKTtcbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ211cmVfY2xhc3NlcycsIEpTT04uc3RyaW5naWZ5KHJhd0NsYXNzZXMpKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgcGFyc2VTZWxlY3RvciAoc2VsZWN0b3JTdHJpbmcpIHtcbiAgICBjb25zdCBzdGFydHNXaXRoUm9vdCA9IHNlbGVjdG9yU3RyaW5nLnN0YXJ0c1dpdGgoJ3Jvb3QnKTtcbiAgICBpZiAoIShzdGFydHNXaXRoUm9vdCB8fCBzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdlbXB0eScpKSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBTZWxlY3RvcnMgbXVzdCBzdGFydCB3aXRoICdyb290JyBvciAnZW1wdHknYCk7XG4gICAgfVxuICAgIGNvbnN0IHRva2VuU3RyaW5ncyA9IHNlbGVjdG9yU3RyaW5nLm1hdGNoKC9cXC4oW14oXSopXFwoKFteKV0qKVxcKS9nKTtcbiAgICBpZiAoIXRva2VuU3RyaW5ncykge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yIHN0cmluZzogJHtzZWxlY3RvclN0cmluZ31gKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5DbGFzc0xpc3QgPSBbe1xuICAgICAgVG9rZW5DbGFzczogc3RhcnRzV2l0aFJvb3QgPyB0aGlzLlRPS0VOUy5Sb290VG9rZW4gOiB0aGlzLlRPS0VOUy5FbXB0eVRva2VuXG4gICAgfV07XG4gICAgdG9rZW5TdHJpbmdzLmZvckVhY2goY2h1bmsgPT4ge1xuICAgICAgY29uc3QgdGVtcCA9IGNodW5rLm1hdGNoKC9eLihbXihdKilcXCgoW14pXSopXFwpLyk7XG4gICAgICBpZiAoIXRlbXApIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBJbnZhbGlkIHRva2VuOiAke2NodW5rfWApO1xuICAgICAgfVxuICAgICAgY29uc3QgdG9rZW5DbGFzc05hbWUgPSB0ZW1wWzFdWzBdLnRvVXBwZXJDYXNlKCkgKyB0ZW1wWzFdLnNsaWNlKDEpICsgJ1Rva2VuJztcbiAgICAgIGNvbnN0IGFyZ0xpc3QgPSB0ZW1wWzJdLnNwbGl0KC8oPzwhXFxcXCksLykubWFwKGQgPT4ge1xuICAgICAgICBkID0gZC50cmltKCk7XG4gICAgICAgIHJldHVybiBkID09PSAnJyA/IHVuZGVmaW5lZCA6IGQ7XG4gICAgICB9KTtcbiAgICAgIGlmICh0b2tlbkNsYXNzTmFtZSA9PT0gJ1ZhbHVlc1Rva2VuJykge1xuICAgICAgICB0b2tlbkNsYXNzTGlzdC5wdXNoKHtcbiAgICAgICAgICBUb2tlbkNsYXNzOiB0aGlzLlRPS0VOUy5LZXlzVG9rZW4sXG4gICAgICAgICAgYXJnTGlzdFxuICAgICAgICB9KTtcbiAgICAgICAgdG9rZW5DbGFzc0xpc3QucHVzaCh7XG4gICAgICAgICAgVG9rZW5DbGFzczogdGhpcy5UT0tFTlMuVmFsdWVUb2tlblxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5UT0tFTlNbdG9rZW5DbGFzc05hbWVdKSB7XG4gICAgICAgIHRva2VuQ2xhc3NMaXN0LnB1c2goe1xuICAgICAgICAgIFRva2VuQ2xhc3M6IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSxcbiAgICAgICAgICBhcmdMaXN0XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuQ2xhc3NMaXN0O1xuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICBvcHRpb25zLnRva2VuQ2xhc3NMaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKG9wdGlvbnMuc2VsZWN0b3IgfHwgYHJvb3QudmFsdWVzKClgKTtcbiAgICByZXR1cm4gbmV3IFN0cmVhbShvcHRpb25zKTtcbiAgfVxuXG4gIGFzeW5jIG5ld0NsYXNzIChvcHRpb25zID0geyBzZWxlY3RvcjogYHJvb3RgIH0pIHtcbiAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke05FWFRfQ0xBU1NfSUR9YDtcbiAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgY29uc3QgQ2xhc3NUeXBlID0gb3B0aW9ucy5DbGFzc1R5cGUgfHwgdGhpcy5DTEFTU0VTLkdlbmVyaWNDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5DbGFzc1R5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDbGFzc1R5cGUob3B0aW9ucyk7XG4gICAgYXdhaXQgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY0RhdGFTb3VyY2UgKHtcbiAgICBmaWxlT2JqLFxuICAgIGVuY29kaW5nID0gbWltZS5jaGFyc2V0KGZpbGVPYmoudHlwZSksXG4gICAgZXh0ZW5zaW9uT3ZlcnJpZGUgPSBudWxsLFxuICAgIHNraXBTaXplQ2hlY2sgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBmaWxlTUIgPSBmaWxlT2JqLnNpemUgLyAxMDQ4NTc2O1xuICAgIGlmIChmaWxlTUIgPj0gMzApIHtcbiAgICAgIGlmIChza2lwU2l6ZUNoZWNrKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgQXR0ZW1wdGluZyB0byBsb2FkICR7ZmlsZU1CfU1CIGZpbGUgaW50byBtZW1vcnlgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtmaWxlTUJ9TUIgZmlsZSBpcyB0b28gbGFyZ2UgdG8gbG9hZCBzdGF0aWNhbGx5OyB0cnkgYWRkRHluYW1pY0RhdGFTb3VyY2UoKSBpbnN0ZWFkLmApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5GaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICByZXNvbHZlKHJlYWRlci5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmosIGVuY29kaW5nKTtcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5hZGRTdHJpbmdBc1N0YXRpY0RhdGFTb3VyY2Uoe1xuICAgICAga2V5OiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAga2V5LFxuICAgIGV4dGVuc2lvbiA9ICd0eHQnLFxuICAgIHRleHRcbiAgfSkge1xuICAgIGxldCBvYmo7XG4gICAgaWYgKHRoaXMuREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIG9iaiA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgZGVsZXRlIG9iai5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY0RhdGFTb3VyY2Uoa2V5LCBvYmopO1xuICB9XG4gIGFzeW5jIGFkZFN0YXRpY0RhdGFTb3VyY2UgKGtleSwgb2JqKSB7XG4gICAgdGhpcy5yb290W2tleV0gPSBvYmo7XG4gICAgY29uc3QgdGVtcCA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnNhdmVSb290KCksIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgc2VsZWN0b3I6IGByb290LnZhbHVlcygnJHtrZXl9JykudmFsdWVzKClgXG4gICAgfSldKTtcbiAgICByZXR1cm4gdGVtcFsxXTtcbiAgfVxuICBhc3luYyByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gICAgYXdhaXQgdGhpcy5zYXZlUm9vdCgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm11cmUudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycyIsImluZGV4T2YiLCJwdXNoIiwiaW5kZXgiLCJzcGxpY2UiLCJhcmdzIiwiZm9yRWFjaCIsImFwcGx5IiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJ0aW1lb3V0Iiwic2V0VGltZW91dCIsInRyaWdnZXIiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwiaSIsIlN0cmVhbSIsIm9wdGlvbnMiLCJtdXJlIiwibmFtZWRGdW5jdGlvbnMiLCJOQU1FRF9GVU5DVElPTlMiLCJuYW1lZFN0cmVhbXMiLCJsYXVuY2hlZEZyb21DbGFzcyIsImluZGV4ZXMiLCJ0b2tlbkNsYXNzTGlzdCIsInRva2VuTGlzdCIsIm1hcCIsIlRva2VuQ2xhc3MiLCJhcmdMaXN0IiwiV3JhcHBlcnMiLCJnZXRXcmFwcGVyTGlzdCIsInRva2VuIiwibGVuZ3RoIiwiV3JhcHBlciIsImxvY2FsVG9rZW5MaXN0Iiwic2xpY2UiLCJwb3RlbnRpYWxXcmFwcGVycyIsInZhbHVlcyIsImNsYXNzZXMiLCJmaWx0ZXIiLCJjbGFzc09iaiIsImV2ZXJ5IiwibG9jYWxUb2tlbiIsImxvY2FsSW5kZXgiLCJ0b2tlbkNsYXNzU3BlYyIsImlzU3Vic2V0T2YiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwid2FybiIsInNlbGVjdG9yIiwiam9pbiIsInBhcnNlU2VsZWN0b3IiLCJjb25jYXQiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsImhhc2hlcyIsIndyYXBwZXJJbmRleCIsInRlbXAiLCJ3cmFwcGVkSXRlbSIsIlByb21pc2UiLCJhbGwiLCJlbnRyaWVzIiwicmVkdWNlIiwicHJvbWlzZUxpc3QiLCJoYXNoRnVuY3Rpb25OYW1lIiwiaGFzaCIsImdldEluZGV4IiwiY29tcGxldGUiLCJhZGRWYWx1ZSIsImxhc3RUb2tlbiIsIml0ZXJhdGUiLCJJTkRFWEVTIiwiSW5NZW1vcnlJbmRleCIsImhhc2hGdW5jdGlvbiIsIkVycm9yIiwibGltaXQiLCJyZWJ1aWxkSW5kZXhlcyIsIml0ZXJhdG9yIiwibmV4dCIsImRvbmUiLCJ2YWx1ZSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImNvbnN0cnVjdG9yIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJCYXNlVG9rZW4iLCJzdHJlYW0iLCJ0b0xvd2VyQ2FzZSIsImFuY2VzdG9yVG9rZW5zIiwicGFyZW50VG9rZW4iLCJ5aWVsZGVkU29tZXRoaW5nIiwiZGVidWciLCJUeXBlRXJyb3IiLCJleGVjIiwibmFtZSIsIkVtcHR5VG9rZW4iLCJSb290VG9rZW4iLCJ3cmFwIiwicm9vdCIsIktleXNUb2tlbiIsIm1hdGNoQWxsIiwia2V5cyIsInJhbmdlcyIsInVuZGVmaW5lZCIsImFyZyIsIm1hdGNoIiwiSW5maW5pdHkiLCJkIiwicGFyc2VJbnQiLCJpc05hTiIsImxvdyIsImhpZ2giLCJudW0iLCJOdW1iZXIiLCJTeW50YXhFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zb2xpZGF0ZVJhbmdlcyIsInNlbGVjdHNOb3RoaW5nIiwibmV3UmFuZ2VzIiwic29ydCIsImEiLCJiIiwiY3VycmVudFJhbmdlIiwib3RoZXJUb2tlbiIsIm5ld0tleXMiLCJrZXkiLCJhbGxQb2ludHMiLCJhZ2ciLCJyYW5nZSIsImluY2x1ZGUiLCJleGNsdWRlIiwiZGlmZiIsImRpZmZlcmVuY2UiLCJpdGVyYXRlUGFyZW50IiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5IiwiVmFsdWVUb2tlbiIsIm9iaiIsImtleVR5cGUiLCJFdmFsdWF0ZVRva2VuIiwibmV3U3RyZWFtIiwiZm9yayIsImVyciIsIk1hcFRva2VuIiwiZ2VuZXJhdG9yIiwibWFwcGVkUmF3SXRlbSIsIlByb21vdGVUb2tlbiIsInJlZHVjZUluc3RhbmNlcyIsImZ1bmMiLCJtYXBGdW5jdGlvbiIsInJlZHVjZUluc3RhbmNlc0Z1bmN0aW9uIiwiaGFzaEluZGV4Iiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsImdldFZhbHVlTGlzdCIsIkpvaW5Ub2tlbiIsIm90aGVyU3RyZWFtIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJmaW5pc2giLCJudGhKb2luIiwidGhpc0hhc2hGdW5jdGlvbiIsIm90aGVySGFzaEZ1bmN0aW9uIiwiZmluaXNoRnVuY3Rpb24iLCJ0aGlzSW5kZXgiLCJvdGhlckluZGV4IiwiaXRlckVudHJpZXMiLCJ2YWx1ZUxpc3QiLCJvdGhlckxpc3QiLCJvdGhlcldyYXBwZWRJdGVtIiwidGhpc1dyYXBwZWRJdGVtIiwidGhpc0xpc3QiLCJ0aGlzSXRlcmF0b3IiLCJ0aGlzSXNEb25lIiwib3RoZXJJdGVyYXRvciIsIm90aGVySXNEb25lIiwiQVNURVJJU0tTIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9zZWxlY3RvciIsImN1c3RvbUNsYXNzTmFtZSIsImN1c3RvbU5hbWVUb2tlbkluZGV4IiwiZnVuY05hbWUiLCJGdW5jdGlvbiIsInJlc3VsdCIsInRvU3RyaW5nIiwidG9SYXdPYmplY3QiLCJzYXZlQ2xhc3NlcyIsImhhc0N1c3RvbU5hbWUiLCJjbGFzc05hbWUiLCJ0b2tlblN0cmluZ3MiLCJzdGFydHNXaXRoIiwicmVzZXQiLCJfc3RyZWFtIiwicG9wdWxhdGVTdHJlYW1PcHRpb25zIiwiaXNTdXBlclNldE9mIiwiQ0xBU1NFUyIsIk5vZGVDbGFzcyIsIkVkZ2VDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZUNvbm5lY3Rpb25zIiwicHJvdG90eXBlIiwiY2FsbCIsIm5vZGVDbGFzcyIsInRoaXNIYXNoTmFtZSIsIm90aGVySGFzaE5hbWUiLCJlZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJFZGdlV3JhcHBlciIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiZGlyZWN0ZWQiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwic291cmNlSGFzaCIsIm5vZGVIYXNoTmFtZSIsInRhcmdldEhhc2giLCJlZGdlSGFzaE5hbWUiLCJ0YXJnZXQiLCJnZXRTdHJlYW0iLCJzb3VyY2UiLCJkaXJlY3Rpb24iLCJORVhUX0NMQVNTX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiREFUQUxJQl9GT1JNQVRTIiwiVE9LRU5TIiwidG9rZW5DbGFzc05hbWUiLCJleHRlbmQiLCJwYXJlbnRUeXBlIiwiQXJyYXkiLCJzaGExIiwibG9hZFJvb3QiLCJsb2FkQ2xhc3NlcyIsImdldEl0ZW0iLCJwYXJzZSIsInNldEl0ZW0iLCJyYXdDbGFzc09iaiIsInJhd0luZGV4T2JqIiwiY2xhc3NUeXBlIiwicmF3Q2xhc3NlcyIsInNlbGVjdG9yU3RyaW5nIiwic3RhcnRzV2l0aFJvb3QiLCJjaHVuayIsInRvVXBwZXJDYXNlIiwic3BsaXQiLCJ0cmltIiwiQ2xhc3NUeXBlIiwiY2hhcnNldCIsImZpbGVPYmoiLCJmaWxlTUIiLCJzaXplIiwic2tpcFNpemVDaGVjayIsInRleHQiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVhZEFzVGV4dCIsImVuY29kaW5nIiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwic2F2ZVJvb3QiLCJuZXdDbGFzcyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxNQUFNQSxtQkFBbUIsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO2tCQUNmO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7O09BRUVDLFNBQUos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
