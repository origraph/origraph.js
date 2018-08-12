import md5 from 'blueimp-md5';
import mime from 'mime-types';
import datalib from 'datalib';

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
          window.setTimeout(() => {
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

const DEFAULT_FUNCTIONS = {
  identity: function* (wrappedParent) {
    yield wrappedParent.rawItem;
  },
  md5: wrappedParent => md5(wrappedParent.rawItem),
  noop: () => {}
};

class Stream {
  constructor({
    mure,
    selector = 'root',
    functions = {},
    streams = {},
    traversalMode = 'DFS'
  }) {
    this.mure = mure;

    this.tokenList = this.parseSelector(selector);

    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.traversalMode = traversalMode;
  }
  get selector() {
    return this.tokenList.join('');
  }
  parseSelector(selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenList = [new this.mure.TOKENS.RootToken(this)];
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
              yield* asyncGeneratorDelegate(asyncIterator((yield asyncGenerator.await(tokenList[i].navigate(wrappedParent)))), asyncGenerator.await);
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

  sample({ limit = 10 }) {
    var _this3 = this;

    return asyncGenerator.wrap(function* () {
      const iterator = _this3.iterate();
      for (let i = 0; i < limit; i++) {
        const temp = yield asyncGenerator.await(iterator.next());
        if (temp.done) {
          break;
        }
        yield temp.value;
      }
    })();
  }

  extend(TokenClass, argList, functions = {}, streams = {}) {
    const newStream = new Stream({
      mure: this.mure,
      functions: Object.assign({}, this.functions, functions),
      streams: Object.assign({}, this.streams, streams),
      mode: this.mode
    });
    newStream.tokenList = this.tokenList.concat([new TokenClass(newStream, argList)]);
    return newStream;
  }

  isSuperSetOfTokenList(tokenList) {
    if (tokenList.length !== this.tokenList.length) {
      return false;
    }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
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
  isSuperSetOf(otherToken) {
    return otherToken.constructor === this.constructor;
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
    yield this.stream.mure.wrap({
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
    } else if (argList && argList.length === 1 && argList[0] === '' || matchAll) {
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
  isSuperSetOf(otherToken) {
    if (!(otherToken instanceof KeysToken)) {
      return false;
    } else {
      const diff = otherToken.difference(this);
      return diff === null || diff.selectsNothing;
    }
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
          yield _this.stream.mure.wrap({
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
              yield _this.stream.mure.wrap({
                wrappedParent,
                token: _this,
                rawItem: i
              });
            }
          }
        }
        for (let key in _this.keys || {}) {
          if (wrappedParent.rawItem.hasOwnProperty(key)) {
            yield _this.stream.mure.wrap({
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
      yield _this.stream.mure.wrap({
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
        newStream = _this.stream.mure.stream({
          selector: wrappedParent.rawItem,
          functions: _this.stream.functions,
          streams: _this.stream.streams,
          traversalMode: _this.stream.traversalMode
        });
      } catch (err) {
        if (!_this.stream.mure.debug || !(err instanceof SyntaxError)) {
          throw err;
        } else {
          return;
        }
      }
      const iterator = yield asyncGenerator.await(newStream.iterate());
      yield* asyncGeneratorDelegate(asyncIterator(iterator), asyncGenerator.await);
    })();
  }
}

class MapToken extends BaseToken {
  constructor(stream, [generator = 'identity']) {
    super(stream);
    if (!stream.functions[generator]) {
      throw new SyntaxError(`Unknown function: ${generator}`);
    }
    this.generator = stream.functions[generator];
  }
  toString() {
    return `.map(${this.generator})`;
  }
  isSuperSetOf(otherToken) {
    return otherToken.constructor === MapToken && otherToken.generator === this.generator;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.generator(wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          yield _this.stream.mure.wrap({
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
  constructor(stream, [map = 'identity', hash = 'md5', reduceInstances = 'noop']) {
    super(stream);
    for (const func of [map, hash, reduceInstances]) {
      if (!stream.functions[func]) {
        throw new SyntaxError(`Unknown function: ${func}`);
      }
    }
    this.map = map;
    this.hash = hash;
    this.reduceInstances = reduceInstances;

    this.seenItems = {};
  }
  toString() {
    return `.promote(${this.map}, ${this.hash}, ${this.reduceInstances})`;
  }
  navigate(wrappedParent) {
    var _this = this;

    return asyncGenerator.wrap(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = asyncIterator(_this.map(wrappedParent)), _step, _value; _step = yield asyncGenerator.await(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield asyncGenerator.await(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const mappedRawItem = _value;

          const hash = _this.hash(mappedRawItem);
          if (_this.seenItems[hash]) {
            _this.reduceInstances(_this.seenItems[hash], mappedRawItem);
            _this.seenItems[hash].trigger('update');
          } else {
            _this.seenItems[hash] = _this.stream.mure.wrap({
              wrappedParent,
              token: _this,
              rawItem: mappedRawItem
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

class GenericConstruct extends Introspectable {
  constructor({ mure, selector, classNames = [] }) {
    super();
    this.mure = mure;
    this.selector = selector;
    this.stream = this.mure.stream({ selector: selector });
    this.classNames = classNames;
    this.annotations = [];
  }
  wrap(options) {
    return new this.mure.WRAPPERS.GenericWrapper(options);
  }
}
Object.defineProperty(GenericConstruct, 'type', {
  get() {
    return (/(.*)Construct/.exec(this.name)[1]
    );
  }
});

class NodeConstruct extends GenericConstruct {}

class EdgeConstruct extends GenericConstruct {}



var CONSTRUCTS = /*#__PURE__*/Object.freeze({
  GenericConstruct: GenericConstruct,
  NodeConstruct: NodeConstruct,
  EdgeConstruct: EdgeConstruct
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
    this.CONSTRUCTS = CONSTRUCTS;
    this.WRAPPERS = WRAPPERS;

    // Monkey-patch available tokens as functions onto the Stream class
    for (const tokenClassName in this.TOKENS) {
      const TokenClass = this.TOKENS[tokenClassName];
      Stream.prototype[TokenClass.lowerCamelCaseType] = function (argList, functions, streams) {
        return this.extend(TokenClass, argList, functions, streams);
      };
    }
  }

  stream(options = {}) {
    options.mure = this;
    return new Stream(options);
  }
  wrap({ wrappedParent, token, rawItem }) {
    const tokenList = [token];
    let temp = wrappedParent;
    while (temp !== null) {
      tokenList.unshift(temp.token);
      temp = temp.wrappedParent;
    }
    for (let classSelector in this.classes) {
      const construct = this.classes[classSelector];
      if (construct.stream.isSuperSetOfTokenList(tokenList)) {
        return construct.wrap({ wrappedParent, token, rawItem });
      }
    }
    return new this.WRAPPERS.GenericWrapper({ wrappedParent, token, rawItem });
  }

  newClass({ ClassType, selector, classNames }) {
    if (this.classes[selector]) {
      return this.classes[selector];
    }
    this.classes[selector] = new ClassType({ mure: this, selector, classNames });
    return this.classes[selector];
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
        selector: `root.values('${key}').values()`,
        ClassType: _this3.CONSTRUCTS.GenericConstruct,
        classNames: [key]
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
	"blueimp-md5": "^2.10.0",
	datalib: "^1.9.1",
	"mime-types": "^2.1.19"
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9TdHJlYW0uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1Rva2Vucy9CYXNlVG9rZW4uanMiLCIuLi9zcmMvVG9rZW5zL1Jvb3RUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvS2V5c1Rva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9WYWx1ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9FdmFsdWF0ZVRva2VuLmpzIiwiLi4vc3JjL1Rva2Vucy9NYXBUb2tlbi5qcyIsIi4uL3NyYy9Ub2tlbnMvUHJvbW90ZVRva2VuLmpzIiwiLi4vc3JjL0NvbnN0cnVjdHMvR2VuZXJpY0NvbnN0cnVjdC5qcyIsIi4uL3NyYy9Db25zdHJ1Y3RzL05vZGVDb25zdHJ1Y3QuanMiLCIuLi9zcmMvQ29uc3RydWN0cy9FZGdlQ29uc3RydWN0LmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL011cmUuanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgaWYgKCF0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKCFhbGxvd0R1cGxpY2F0ZUxpc3RlbmVycykge1xuICAgICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnROYW1lLCAuLi5hcmdzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0pIHtcbiAgICAgICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICB9LCAwKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJpbXBvcnQgbWQ1IGZyb20gJ2JsdWVpbXAtbWQ1JztcblxuY29uc3QgREVGQVVMVF9GVU5DVElPTlMgPSB7XG4gIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkUGFyZW50KSB7IHlpZWxkIHdyYXBwZWRQYXJlbnQucmF3SXRlbTsgfSxcbiAgbWQ1OiAod3JhcHBlZFBhcmVudCkgPT4gbWQ1KHdyYXBwZWRQYXJlbnQucmF3SXRlbSksXG4gIG5vb3A6ICgpID0+IHt9XG59O1xuXG5jbGFzcyBTdHJlYW0ge1xuICBjb25zdHJ1Y3RvciAoe1xuICAgIG11cmUsXG4gICAgc2VsZWN0b3IgPSAncm9vdCcsXG4gICAgZnVuY3Rpb25zID0ge30sXG4gICAgc3RyZWFtcyA9IHt9LFxuICAgIHRyYXZlcnNhbE1vZGUgPSAnREZTJ1xuICB9KSB7XG4gICAgdGhpcy5tdXJlID0gbXVyZTtcblxuICAgIHRoaXMudG9rZW5MaXN0ID0gdGhpcy5wYXJzZVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIHRoaXMuZnVuY3Rpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9GVU5DVElPTlMsIGZ1bmN0aW9ucyk7XG4gICAgdGhpcy5zdHJlYW1zID0gc3RyZWFtcztcbiAgICB0aGlzLnRyYXZlcnNhbE1vZGUgPSB0cmF2ZXJzYWxNb2RlO1xuICB9XG4gIGdldCBzZWxlY3RvciAoKSB7XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmpvaW4oJycpO1xuICB9XG4gIHBhcnNlU2VsZWN0b3IgKHNlbGVjdG9yU3RyaW5nKSB7XG4gICAgaWYgKCFzZWxlY3RvclN0cmluZy5zdGFydHNXaXRoKCdyb290JykpIHtcbiAgICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihgU2VsZWN0b3JzIG11c3Qgc3RhcnQgd2l0aCAncm9vdCdgKTtcbiAgICB9XG4gICAgY29uc3QgdG9rZW5TdHJpbmdzID0gc2VsZWN0b3JTdHJpbmcubWF0Y2goL1xcLihbXihdKilcXCgoW14pXSopXFwpL2cpO1xuICAgIGlmICghdG9rZW5TdHJpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgc2VsZWN0b3Igc3RyaW5nOiAke3NlbGVjdG9yU3RyaW5nfWApO1xuICAgIH1cbiAgICBjb25zdCB0b2tlbkxpc3QgPSBbbmV3IHRoaXMubXVyZS5UT0tFTlMuUm9vdFRva2VuKHRoaXMpXTtcbiAgICB0b2tlblN0cmluZ3MuZm9yRWFjaChjaHVuayA9PiB7XG4gICAgICBjb25zdCB0ZW1wID0gY2h1bmsubWF0Y2goL14uKFteKF0qKVxcKChbXildKilcXCkvKTtcbiAgICAgIGlmICghdGVtcCkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEludmFsaWQgdG9rZW46ICR7Y2h1bmt9YCk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b2tlbkNsYXNzTmFtZSA9IHRlbXBbMV1bMF0udG9VcHBlckNhc2UoKSArIHRlbXBbMV0uc2xpY2UoMSkgKyAnVG9rZW4nO1xuICAgICAgY29uc3QgYXJnTGlzdCA9IHRlbXBbMl0uc3BsaXQoLyg/PCFcXFxcKSwvKS5tYXAoZCA9PiBkLnRyaW0oKSk7XG4gICAgICBpZiAodG9rZW5DbGFzc05hbWUgPT09ICdWYWx1ZXNUb2tlbicpIHtcbiAgICAgICAgdG9rZW5MaXN0LnB1c2gobmV3IHRoaXMubXVyZS5UT0tFTlMuS2V5c1Rva2VuKHRoaXMsIGFyZ0xpc3QpKTtcbiAgICAgICAgdG9rZW5MaXN0LnB1c2gobmV3IHRoaXMubXVyZS5UT0tFTlMuVmFsdWVUb2tlbih0aGlzLCBbXSkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm11cmUuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXSkge1xuICAgICAgICB0b2tlbkxpc3QucHVzaChuZXcgdGhpcy5tdXJlLlRPS0VOU1t0b2tlbkNsYXNzTmFtZV0odGhpcywgYXJnTGlzdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIHRva2VuOiAke3RlbXBbMV19YCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRva2VuTGlzdDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKCkge1xuICAgIGlmICh0aGlzLnRyYXZlcnNhbE1vZGUgPT09ICdCRlMnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEJyZWFkdGgtZmlyc3QgaXRlcmF0aW9uIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQuYCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRyYXZlcnNhbE1vZGUgPT09ICdERlMnKSB7XG4gICAgICBjb25zdCBkZWVwSGVscGVyID0gdGhpcy5kZWVwSGVscGVyKHRoaXMudG9rZW5MaXN0LCB0aGlzLnRva2VuTGlzdC5sZW5ndGggLSAxKTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgZGVlcEhlbHBlcikge1xuICAgICAgICBpZiAoISh3cmFwcGVkSXRlbSBpbnN0YW5jZW9mIHRoaXMubXVyZS5XUkFQUEVSUy5HZW5lcmljV3JhcHBlcikpIHtcbiAgICAgICAgICBpZiAodGhpcy5tdXJlLmRlYnVnKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4od3JhcHBlZEl0ZW0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gdHJhdmVyc2FsTW9kZTogJHt0aGlzLnRyYXZlcnNhbE1vZGV9YCk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBUaGlzIGhlbHBzIGRlcHRoLWZpcnN0IGl0ZXJhdGlvbiAod2Ugb25seSB3YW50IHRvIHlpZWxkIGZpbmlzaGVkIHBhdGhzLCBzb1xuICAgKiBpdCBsYXppbHkgYXNrcyBmb3IgdGhlbSBvbmUgYXQgYSB0aW1lIGZyb20gdGhlICpmaW5hbCogdG9rZW4sIHJlY3Vyc2l2ZWx5XG4gICAqIGFza2luZyBlYWNoIHByZWNlZGluZyB0b2tlbiB0byB5aWVsZCBkZXBlbmRlbnQgcGF0aHMgb25seSBhcyBuZWVkZWQpXG4gICAqL1xuICBhc3luYyAqIGRlZXBIZWxwZXIgKHRva2VuTGlzdCwgaSkge1xuICAgIGlmIChpID09PSAwKSB7XG4gICAgICB5aWVsZCAqIGF3YWl0IHRva2VuTGlzdFswXS5uYXZpZ2F0ZSgpOyAvLyBUaGUgZmlyc3QgdG9rZW4gaXMgYWx3YXlzIHRoZSByb290XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBwYXJlbnRZaWVsZGVkU29tZXRoaW5nID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGxldCB3cmFwcGVkUGFyZW50IG9mIHRoaXMuZGVlcEhlbHBlcih0b2tlbkxpc3QsIGkgLSAxKSkge1xuICAgICAgICBwYXJlbnRZaWVsZGVkU29tZXRoaW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHdyYXBwZWRQYXJlbnQgaW5zdGFuY2VvZiB0aGlzLm11cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIpIHtcbiAgICAgICAgICB5aWVsZCAqIGF3YWl0IHRva2VuTGlzdFtpXS5uYXZpZ2F0ZSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkUGFyZW50O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5tdXJlLmRlYnVnICYmICFwYXJlbnRZaWVsZGVkU29tZXRoaW5nKSB7XG4gICAgICAgIHlpZWxkIGBUb2tlbiB5aWVsZGVkIG5vdGhpbmc6ICR7dG9rZW5MaXN0W2kgLSAxXX1gO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jICogc2FtcGxlICh7IGxpbWl0ID0gMTAgfSkge1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5pdGVyYXRlKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZXh0ZW5kIChUb2tlbkNsYXNzLCBhcmdMaXN0LCBmdW5jdGlvbnMgPSB7fSwgc3RyZWFtcyA9IHt9KSB7XG4gICAgY29uc3QgbmV3U3RyZWFtID0gbmV3IFN0cmVhbSh7XG4gICAgICBtdXJlOiB0aGlzLm11cmUsXG4gICAgICBmdW5jdGlvbnM6IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuZnVuY3Rpb25zLCBmdW5jdGlvbnMpLFxuICAgICAgc3RyZWFtczogT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdHJlYW1zLCBzdHJlYW1zKSxcbiAgICAgIG1vZGU6IHRoaXMubW9kZVxuICAgIH0pO1xuICAgIG5ld1N0cmVhbS50b2tlbkxpc3QgPSB0aGlzLnRva2VuTGlzdC5jb25jYXQoWyBuZXcgVG9rZW5DbGFzcyhuZXdTdHJlYW0sIGFyZ0xpc3QpIF0pO1xuICAgIHJldHVybiBuZXdTdHJlYW07XG4gIH1cblxuICBpc1N1cGVyU2V0T2ZUb2tlbkxpc3QgKHRva2VuTGlzdCkge1xuICAgIGlmICh0b2tlbkxpc3QubGVuZ3RoICE9PSB0aGlzLnRva2VuTGlzdC5sZW5ndGgpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgcmV0dXJuIHRoaXMudG9rZW5MaXN0LmV2ZXJ5KCh0b2tlbiwgaSkgPT4gdG9rZW4uaXNTdXBlclNldE9mKHRva2VuTGlzdFtpXSkpO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdHJlYW07XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgQmFzZVRva2VuIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLnN0cmVhbSA9IHN0cmVhbTtcbiAgfVxuICB0b1N0cmluZyAoKSB7XG4gICAgLy8gVGhlIHN0cmluZyB2ZXJzaW9uIG9mIG1vc3QgdG9rZW5zIGNhbiBqdXN0IGJlIGRlcml2ZWQgZnJvbSB0aGUgY2xhc3MgdHlwZVxuICAgIHJldHVybiBgLiR7dGhpcy50eXBlLnRvTG93ZXJDYXNlKCl9KClgO1xuICB9XG4gIGlzU3VwZXJTZXRPZiAob3RoZXJUb2tlbikge1xuICAgIHJldHVybiBvdGhlclRva2VuLmNvbnN0cnVjdG9yID09PSB0aGlzLmNvbnN0cnVjdG9yO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhc2VUb2tlbiwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVG9rZW4vLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBCYXNlVG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgUm9vdFRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgKiBuYXZpZ2F0ZSAoKSB7XG4gICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgIHdyYXBwZWRQYXJlbnQ6IG51bGwsXG4gICAgICB0b2tlbjogdGhpcyxcbiAgICAgIHJhd0l0ZW06IHRoaXMuc3RyZWFtLm11cmUucm9vdFxuICAgIH0pO1xuICB9XG4gIHRvU3RyaW5nICgpIHtcbiAgICByZXR1cm4gYHJvb3RgO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBSb290VG9rZW47XG4iLCJpbXBvcnQgQmFzZVRva2VuIGZyb20gJy4vQmFzZVRva2VuLmpzJztcblxuY2xhc3MgS2V5c1Rva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgY29uc3RydWN0b3IgKHN0cmVhbSwgYXJnTGlzdCwgeyBtYXRjaEFsbCwga2V5cywgcmFuZ2VzIH0gPSB7fSkge1xuICAgIHN1cGVyKHN0cmVhbSk7XG4gICAgaWYgKGtleXMgfHwgcmFuZ2VzKSB7XG4gICAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgICAgdGhpcy5yYW5nZXMgPSByYW5nZXM7XG4gICAgfSBlbHNlIGlmICgoYXJnTGlzdCAmJiBhcmdMaXN0Lmxlbmd0aCA9PT0gMSAmJiBhcmdMaXN0WzBdID09PSAnJykgfHwgbWF0Y2hBbGwpIHtcbiAgICAgIHRoaXMubWF0Y2hBbGwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdMaXN0LmZvckVhY2goYXJnID0+IHtcbiAgICAgICAgbGV0IHRlbXAgPSBhcmcubWF0Y2goLyhcXGQrKS0oW1xcZOKInl0rKS8pO1xuICAgICAgICBpZiAodGVtcCAmJiB0ZW1wWzJdID09PSAn4oieJykge1xuICAgICAgICAgIHRlbXBbMl0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICB0ZW1wID0gdGVtcCA/IHRlbXAubWFwKGQgPT4gZC5wYXJzZUludChkKSkgOiBudWxsO1xuICAgICAgICBpZiAodGVtcCAmJiAhaXNOYU4odGVtcFsxXSkgJiYgIWlzTmFOKHRlbXBbMl0pKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IHRlbXBbMV07IGkgPD0gdGVtcFsyXTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgICAgdGhpcy5yYW5nZXMucHVzaCh7IGxvdzogdGVtcFsxXSwgaGlnaDogdGVtcFsyXSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRlbXAgPSBhcmcubWF0Y2goLycoLiopJy8pO1xuICAgICAgICB0ZW1wID0gdGVtcCAmJiB0ZW1wWzFdID8gdGVtcFsxXSA6IGFyZztcbiAgICAgICAgbGV0IG51bSA9IE51bWJlcih0ZW1wKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bSkgfHwgbnVtICE9PSBwYXJzZUludCh0ZW1wKSkgeyAvLyBsZWF2ZSBub24taW50ZWdlciBudW1iZXJzIGFzIHN0cmluZ3NcbiAgICAgICAgICB0aGlzLmtleXMgPSB0aGlzLmtleXMgfHwge307XG4gICAgICAgICAgdGhpcy5rZXlzW3RlbXBdID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJhbmdlcyA9IHRoaXMucmFuZ2VzIHx8IFtdO1xuICAgICAgICAgIHRoaXMucmFuZ2VzLnB1c2goeyBsb3c6IG51bSwgaGlnaDogbnVtIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIGlmICghdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYEJhZCB0b2tlbiBrZXkocykgLyByYW5nZShzKTogJHtKU09OLnN0cmluZ2lmeShhcmdMaXN0KX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRoaXMucmFuZ2VzKSB7XG4gICAgICB0aGlzLnJhbmdlcyA9IHRoaXMuY29uc29saWRhdGVSYW5nZXModGhpcy5yYW5nZXMpO1xuICAgIH1cbiAgfVxuICBnZXQgc2VsZWN0c05vdGhpbmcgKCkge1xuICAgIHJldHVybiAhdGhpcy5tYXRjaEFsbCAmJiAhdGhpcy5rZXlzICYmICF0aGlzLnJhbmdlcztcbiAgfVxuICBjb25zb2xpZGF0ZVJhbmdlcyAocmFuZ2VzKSB7XG4gICAgLy8gTWVyZ2UgYW55IG92ZXJsYXBwaW5nIHJhbmdlc1xuICAgIGNvbnN0IG5ld1JhbmdlcyA9IFtdO1xuICAgIGNvbnN0IHRlbXAgPSByYW5nZXMuc29ydCgoYSwgYikgPT4gYS5sb3cgLSBiLmxvdyk7XG4gICAgbGV0IGN1cnJlbnRSYW5nZSA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZW1wLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIWN1cnJlbnRSYW5nZSkge1xuICAgICAgICBjdXJyZW50UmFuZ2UgPSB0ZW1wW2ldO1xuICAgICAgfSBlbHNlIGlmICh0ZW1wW2ldLmxvdyA8PSBjdXJyZW50UmFuZ2UuaGlnaCkge1xuICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IHRlbXBbaV0uaGlnaDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgIGN1cnJlbnRSYW5nZSA9IHRlbXBbaV07XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJyZW50UmFuZ2UpIHtcbiAgICAgIC8vIENvcm5lciBjYXNlOiBhZGQgdGhlIGxhc3QgcmFuZ2VcbiAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgfVxuICAgIHJldHVybiBuZXdSYW5nZXMubGVuZ3RoID4gMCA/IG5ld1JhbmdlcyA6IHVuZGVmaW5lZDtcbiAgfVxuICBkaWZmZXJlbmNlIChvdGhlclRva2VuKSB7XG4gICAgLy8gQ29tcHV0ZSB3aGF0IGlzIGxlZnQgb2YgdGhpcyBhZnRlciBzdWJ0cmFjdGluZyBvdXQgZXZlcnl0aGluZyBpbiBvdGhlclRva2VuXG4gICAgaWYgKCEob3RoZXJUb2tlbiBpbnN0YW5jZW9mIEtleXNUb2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgY29tcHV0ZSB0aGUgZGlmZmVyZW5jZSBvZiB0d28gZGlmZmVyZW50IHRva2VuIHR5cGVzYCk7XG4gICAgfSBlbHNlIGlmIChvdGhlclRva2VuLm1hdGNoQWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKHRoaXMubWF0Y2hBbGwpIHtcbiAgICAgIGNvbnNvbGUud2FybihgSW5hY2N1cmF0ZSBkaWZmZXJlbmNlIGNvbXB1dGVkISBUT0RPOiBuZWVkIHRvIGZpZ3VyZSBvdXQgaG93IHRvIGludmVydCBjYXRlZ29yaWNhbCBrZXlzIWApO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld0tleXMgPSB7fTtcbiAgICAgIGZvciAobGV0IGtleSBpbiAodGhpcy5rZXlzIHx8IHt9KSkge1xuICAgICAgICBpZiAoIW90aGVyVG9rZW4ua2V5cyB8fCAhb3RoZXJUb2tlbi5rZXlzW2tleV0pIHtcbiAgICAgICAgICBuZXdLZXlzW2tleV0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBsZXQgbmV3UmFuZ2VzID0gW107XG4gICAgICBpZiAodGhpcy5yYW5nZXMpIHtcbiAgICAgICAgaWYgKG90aGVyVG9rZW4ucmFuZ2VzKSB7XG4gICAgICAgICAgbGV0IGFsbFBvaW50cyA9IHRoaXMucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGluY2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKTtcbiAgICAgICAgICBhbGxQb2ludHMgPSBhbGxQb2ludHMuY29uY2F0KG90aGVyVG9rZW4ucmFuZ2VzLnJlZHVjZSgoYWdnLCByYW5nZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoW1xuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGxvdzogdHJ1ZSwgdmFsdWU6IHJhbmdlLmxvdyB9LFxuICAgICAgICAgICAgICB7IGV4Y2x1ZGU6IHRydWUsIGhpZ2g6IHRydWUsIHZhbHVlOiByYW5nZS5oaWdoIH1cbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgIH0sIFtdKSkuc29ydCgpO1xuICAgICAgICAgIGxldCBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGlmIChhbGxQb2ludHNbaV0uaW5jbHVkZSAmJiBhbGxQb2ludHNbaV0ubG93KSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0geyBsb3c6IGFsbFBvaW50c1tpXS52YWx1ZSB9O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5pbmNsdWRlICYmIGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRSYW5nZS5oaWdoID0gYWxsUG9pbnRzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICBpZiAoY3VycmVudFJhbmdlLmhpZ2ggPj0gY3VycmVudFJhbmdlLmxvdykge1xuICAgICAgICAgICAgICAgIG5ld1Jhbmdlcy5wdXNoKGN1cnJlbnRSYW5nZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgY3VycmVudFJhbmdlID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYWxsUG9pbnRzW2ldLmV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgaWYgKGFsbFBvaW50c1tpXS5sb3cpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UuaGlnaCA9IGFsbFBvaW50c1tpXS5sb3cgLSAxO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50UmFuZ2UuaGlnaCA+PSBjdXJyZW50UmFuZ2UubG93KSB7XG4gICAgICAgICAgICAgICAgICBuZXdSYW5nZXMucHVzaChjdXJyZW50UmFuZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJyZW50UmFuZ2UgPSBudWxsO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFsbFBvaW50c1tpXS5oaWdoKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFJhbmdlLmxvdyA9IGFsbFBvaW50c1tpXS5oaWdoICsgMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXdSYW5nZXMgPSB0aGlzLnJhbmdlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG5ldyBLZXlzVG9rZW4odGhpcy5tdXJlLCBudWxsLCB7IGtleXM6IG5ld0tleXMsIHJhbmdlczogbmV3UmFuZ2VzIH0pO1xuICAgIH1cbiAgfVxuICBpc1N1cGVyU2V0T2YgKG90aGVyVG9rZW4pIHtcbiAgICBpZiAoIShvdGhlclRva2VuIGluc3RhbmNlb2YgS2V5c1Rva2VuKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBkaWZmID0gb3RoZXJUb2tlbi5kaWZmZXJlbmNlKHRoaXMpO1xuICAgICAgcmV0dXJuIGRpZmYgPT09IG51bGwgfHwgZGlmZi5zZWxlY3RzTm90aGluZztcbiAgICB9XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIGlmICh0aGlzLm1hdGNoQWxsKSB7IHJldHVybiAnLmtleXMoKSc7IH1cbiAgICByZXR1cm4gJy5rZXlzKCcgKyAodGhpcy5yYW5nZXMgfHwgW10pLm1hcCgoe2xvdywgaGlnaH0pID0+IHtcbiAgICAgIHJldHVybiBsb3cgPT09IGhpZ2ggPyBsb3cgOiBgJHtsb3d9LSR7aGlnaH1gO1xuICAgIH0pLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmtleXMgfHwge30pLm1hcChrZXkgPT4gYCcke2tleX0nYCkpXG4gICAgICAuam9pbignLCcpICsgJyknO1xuICB9XG4gIGFzeW5jICogbmF2aWdhdGUgKHdyYXBwZWRQYXJlbnQpIHtcbiAgICBpZiAodHlwZW9mIHdyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgIGlmICghdGhpcy5zdHJlYW0ubXVyZS5kZWJ1Zykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJbnB1dCB0byBLZXlzVG9rZW4gaXMgbm90IGFuIG9iamVjdGApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5tYXRjaEFsbCkge1xuICAgICAgZm9yIChsZXQga2V5IGluIHdyYXBwZWRQYXJlbnQucmF3SXRlbSkge1xuICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgIHdyYXBwZWRQYXJlbnQsXG4gICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGxldCB7bG93LCBoaWdofSBvZiB0aGlzLnJhbmdlcyB8fCBbXSkge1xuICAgICAgICBsb3cgPSBNYXRoLm1heCgwLCBsb3cpO1xuICAgICAgICBoaWdoID0gTWF0aC5taW4od3JhcHBlZFBhcmVudC5yYXdJdGVtLmxlbmd0aCAtIDEsIGhpZ2gpO1xuICAgICAgICBmb3IgKGxldCBpID0gbG93OyBpIDw9IGhpZ2g7IGkrKykge1xuICAgICAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJhd0l0ZW1baV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgICAgICAgIHJhd0l0ZW06IGlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZm9yIChsZXQga2V5IGluIHRoaXMua2V5cyB8fCB7fSkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yYXdJdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICB5aWVsZCB0aGlzLnN0cmVhbS5tdXJlLndyYXAoe1xuICAgICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICAgIHRva2VuOiB0aGlzLFxuICAgICAgICAgICAgcmF3SXRlbToga2V5XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEtleXNUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBWYWx1ZVRva2VuIGV4dGVuZHMgQmFzZVRva2VuIHtcbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGNvbnN0IG9iaiA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC53cmFwcGVkUGFyZW50ICYmIHdyYXBwZWRQYXJlbnQud3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgIGNvbnN0IGtleSA9IHdyYXBwZWRQYXJlbnQgJiYgd3JhcHBlZFBhcmVudC5yYXdJdGVtO1xuICAgIGNvbnN0IGtleVR5cGUgPSB0eXBlb2Yga2V5O1xuICAgIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyB8fCAoa2V5VHlwZSAhPT0gJ3N0cmluZycgJiYga2V5VHlwZSAhPT0gJ251bWJlcicpKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVmFsdWVUb2tlbiB1c2VkIG9uIGEgbm9uLW9iamVjdCwgb3Igd2l0aG91dCBhIHN0cmluZyAvIG51bWVyaWMga2V5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkIHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICB3cmFwcGVkUGFyZW50LFxuICAgICAgdG9rZW46IHRoaXMsXG4gICAgICByYXdJdGVtOiBvYmpba2V5XVxuICAgIH0pO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBWYWx1ZVRva2VuO1xuIiwiaW1wb3J0IEJhc2VUb2tlbiBmcm9tICcuL0Jhc2VUb2tlbi5qcyc7XG5cbmNsYXNzIEV2YWx1YXRlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgaWYgKHR5cGVvZiB3cmFwcGVkUGFyZW50LnJhd0l0ZW0gIT09ICdzdHJpbmcnKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW5wdXQgdG8gRXZhbHVhdGVUb2tlbiBpcyBub3QgYSBzdHJpbmdgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IG5ld1N0cmVhbTtcbiAgICB0cnkge1xuICAgICAgbmV3U3RyZWFtID0gdGhpcy5zdHJlYW0ubXVyZS5zdHJlYW0oe1xuICAgICAgICBzZWxlY3Rvcjogd3JhcHBlZFBhcmVudC5yYXdJdGVtLFxuICAgICAgICBmdW5jdGlvbnM6IHRoaXMuc3RyZWFtLmZ1bmN0aW9ucyxcbiAgICAgICAgc3RyZWFtczogdGhpcy5zdHJlYW0uc3RyZWFtcyxcbiAgICAgICAgdHJhdmVyc2FsTW9kZTogdGhpcy5zdHJlYW0udHJhdmVyc2FsTW9kZVxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIXRoaXMuc3RyZWFtLm11cmUuZGVidWcgfHwgIShlcnIgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikpIHtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBpdGVyYXRvciA9IGF3YWl0IG5ld1N0cmVhbS5pdGVyYXRlKCk7XG4gICAgeWllbGQgKiBpdGVyYXRvcjtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXZhbHVhdGVUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBNYXBUb2tlbiBleHRlbmRzIEJhc2VUb2tlbiB7XG4gIGNvbnN0cnVjdG9yIChzdHJlYW0sIFsgZ2VuZXJhdG9yID0gJ2lkZW50aXR5JyBdKSB7XG4gICAgc3VwZXIoc3RyZWFtKTtcbiAgICBpZiAoIXN0cmVhbS5mdW5jdGlvbnNbZ2VuZXJhdG9yXSkge1xuICAgICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGBVbmtub3duIGZ1bmN0aW9uOiAke2dlbmVyYXRvcn1gKTtcbiAgICB9XG4gICAgdGhpcy5nZW5lcmF0b3IgPSBzdHJlYW0uZnVuY3Rpb25zW2dlbmVyYXRvcl07XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLm1hcCgke3RoaXMuZ2VuZXJhdG9yfSlgO1xuICB9XG4gIGlzU3VwZXJTZXRPZiAob3RoZXJUb2tlbikge1xuICAgIHJldHVybiBvdGhlclRva2VuLmNvbnN0cnVjdG9yID09PSBNYXBUb2tlbiAmJiBvdGhlclRva2VuLmdlbmVyYXRvciA9PT0gdGhpcy5nZW5lcmF0b3I7XG4gIH1cbiAgYXN5bmMgKiBuYXZpZ2F0ZSAod3JhcHBlZFBhcmVudCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWFwcGVkUmF3SXRlbSBvZiB0aGlzLmdlbmVyYXRvcih3cmFwcGVkUGFyZW50KSkge1xuICAgICAgeWllbGQgdGhpcy5zdHJlYW0ubXVyZS53cmFwKHtcbiAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgdG9rZW46IHRoaXMsXG4gICAgICAgIHJhd0l0ZW06IG1hcHBlZFJhd0l0ZW1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNYXBUb2tlbjtcbiIsImltcG9ydCBCYXNlVG9rZW4gZnJvbSAnLi9CYXNlVG9rZW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlVG9rZW4gZXh0ZW5kcyBCYXNlVG9rZW4ge1xuICBjb25zdHJ1Y3RvciAoc3RyZWFtLCBbIG1hcCA9ICdpZGVudGl0eScsIGhhc2ggPSAnbWQ1JywgcmVkdWNlSW5zdGFuY2VzID0gJ25vb3AnIF0pIHtcbiAgICBzdXBlcihzdHJlYW0pO1xuICAgIGZvciAoY29uc3QgZnVuYyBvZiBbIG1hcCwgaGFzaCwgcmVkdWNlSW5zdGFuY2VzIF0pIHtcbiAgICAgIGlmICghc3RyZWFtLmZ1bmN0aW9uc1tmdW5jXSkge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYFVua25vd24gZnVuY3Rpb246ICR7ZnVuY31gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5tYXAgPSBtYXA7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcbiAgICB0aGlzLnJlZHVjZUluc3RhbmNlcyA9IHJlZHVjZUluc3RhbmNlcztcblxuICAgIHRoaXMuc2Vlbkl0ZW1zID0ge307XG4gIH1cbiAgdG9TdHJpbmcgKCkge1xuICAgIHJldHVybiBgLnByb21vdGUoJHt0aGlzLm1hcH0sICR7dGhpcy5oYXNofSwgJHt0aGlzLnJlZHVjZUluc3RhbmNlc30pYDtcbiAgfVxuICBhc3luYyAqIG5hdmlnYXRlICh3cmFwcGVkUGFyZW50KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBtYXBwZWRSYXdJdGVtIG9mIHRoaXMubWFwKHdyYXBwZWRQYXJlbnQpKSB7XG4gICAgICBjb25zdCBoYXNoID0gdGhpcy5oYXNoKG1hcHBlZFJhd0l0ZW0pO1xuICAgICAgaWYgKHRoaXMuc2Vlbkl0ZW1zW2hhc2hdKSB7XG4gICAgICAgIHRoaXMucmVkdWNlSW5zdGFuY2VzKHRoaXMuc2Vlbkl0ZW1zW2hhc2hdLCBtYXBwZWRSYXdJdGVtKTtcbiAgICAgICAgdGhpcy5zZWVuSXRlbXNbaGFzaF0udHJpZ2dlcigndXBkYXRlJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNlZW5JdGVtc1toYXNoXSA9IHRoaXMuc3RyZWFtLm11cmUud3JhcCh7XG4gICAgICAgICAgd3JhcHBlZFBhcmVudCxcbiAgICAgICAgICB0b2tlbjogdGhpcyxcbiAgICAgICAgICByYXdJdGVtOiBtYXBwZWRSYXdJdGVtXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlVG9rZW47XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NvbnN0cnVjdCBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKHsgbXVyZSwgc2VsZWN0b3IsIGNsYXNzTmFtZXMgPSBbXSB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm11cmUgPSBtdXJlO1xuICAgIHRoaXMuc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICB0aGlzLnN0cmVhbSA9IHRoaXMubXVyZS5zdHJlYW0oeyBzZWxlY3Rvcjogc2VsZWN0b3IgfSk7XG4gICAgdGhpcy5jbGFzc05hbWVzID0gY2xhc3NOYW1lcztcbiAgICB0aGlzLmFubm90YXRpb25zID0gW107XG4gIH1cbiAgd3JhcCAob3B0aW9ucykge1xuICAgIHJldHVybiBuZXcgdGhpcy5tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NvbnN0cnVjdCwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ29uc3RydWN0Ly5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NvbnN0cnVjdDtcbiIsImltcG9ydCBHZW5lcmljQ29uc3RydWN0IGZyb20gJy4vR2VuZXJpY0NvbnN0cnVjdC5qcyc7XG5cbmNsYXNzIE5vZGVDb25zdHJ1Y3QgZXh0ZW5kcyBHZW5lcmljQ29uc3RydWN0IHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ29uc3RydWN0O1xuIiwiaW1wb3J0IEdlbmVyaWNDb25zdHJ1Y3QgZnJvbSAnLi9HZW5lcmljQ29uc3RydWN0LmpzJztcblxuY2xhc3MgRWRnZUNvbnN0cnVjdCBleHRlbmRzIEdlbmVyaWNDb25zdHJ1Y3Qge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDb25zdHJ1Y3Q7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yICh7IHdyYXBwZWRQYXJlbnQsIHRva2VuLCByYXdJdGVtIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMud3JhcHBlZFBhcmVudCA9IHdyYXBwZWRQYXJlbnQ7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMucmF3SXRlbSA9IHJhd0l0ZW07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgU3RyZWFtIGZyb20gJy4vU3RyZWFtLmpzJztcbmltcG9ydCAqIGFzIFRPS0VOUyBmcm9tICcuL1Rva2Vucy9Ub2tlbnMuanMnO1xuaW1wb3J0ICogYXMgQ09OU1RSVUNUUyBmcm9tICcuL0NvbnN0cnVjdHMvQ29uc3RydWN0cy5qcyc7XG5pbXBvcnQgKiBhcyBXUkFQUEVSUyBmcm9tICcuL1dyYXBwZXJzL1dyYXBwZXJzLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuRmlsZVJlYWRlciA9IEZpbGVSZWFkZXI7IC8vIGVpdGhlciB3aW5kb3cuRmlsZVJlYWRlciBvciBvbmUgZnJvbSBOb2RlXG4gICAgdGhpcy5taW1lID0gbWltZTsgLy8gZXhwb3NlIGFjY2VzcyB0byBtaW1lIGxpYnJhcnksIHNpbmNlIHdlJ3JlIGJ1bmRsaW5nIGl0IGFueXdheVxuXG4gICAgdGhpcy5kZWJ1ZyA9IGZhbHNlOyAvLyBTZXQgbXVyZS5kZWJ1ZyB0byB0cnVlIHRvIGRlYnVnIHN0cmVhbXNcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIGVhY2ggb2Ygb3VyIGRhdGEgc291cmNlc1xuICAgIHRoaXMucm9vdCA9IHt9O1xuICAgIHRoaXMuY2xhc3NlcyA9IHt9O1xuXG4gICAgLy8gZXh0ZW5zaW9ucyB0aGF0IHdlIHdhbnQgZGF0YWxpYiB0byBoYW5kbGVcbiAgICB0aGlzLkRBVEFMSUJfRk9STUFUUyA9IHtcbiAgICAgICdqc29uJzogJ2pzb24nLFxuICAgICAgJ2Nzdic6ICdjc3YnLFxuICAgICAgJ3Rzdic6ICd0c3YnLFxuICAgICAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgICAgICd0cmVlanNvbic6ICd0cmVlanNvbidcbiAgICB9O1xuXG4gICAgdGhpcy5UUlVUSFlfU1RSSU5HUyA9IHtcbiAgICAgICd0cnVlJzogdHJ1ZSxcbiAgICAgICd5ZXMnOiB0cnVlLFxuICAgICAgJ3knOiB0cnVlXG4gICAgfTtcbiAgICB0aGlzLkZBTFNFWV9TVFJJTkdTID0ge1xuICAgICAgJ2ZhbHNlJzogdHJ1ZSxcbiAgICAgICdubyc6IHRydWUsXG4gICAgICAnbic6IHRydWVcbiAgICB9O1xuXG4gICAgLy8gQWNjZXNzIHRvIGNvcmUgY2xhc3NlcyB2aWEgdGhlIG1haW4gbGlicmFyeSBoZWxwcyBhdm9pZCBjaXJjdWxhciBpbXBvcnRzXG4gICAgdGhpcy5UT0tFTlMgPSBUT0tFTlM7XG4gICAgdGhpcy5DT05TVFJVQ1RTID0gQ09OU1RSVUNUUztcbiAgICB0aGlzLldSQVBQRVJTID0gV1JBUFBFUlM7XG5cbiAgICAvLyBNb25rZXktcGF0Y2ggYXZhaWxhYmxlIHRva2VucyBhcyBmdW5jdGlvbnMgb250byB0aGUgU3RyZWFtIGNsYXNzXG4gICAgZm9yIChjb25zdCB0b2tlbkNsYXNzTmFtZSBpbiB0aGlzLlRPS0VOUykge1xuICAgICAgY29uc3QgVG9rZW5DbGFzcyA9IHRoaXMuVE9LRU5TW3Rva2VuQ2xhc3NOYW1lXTtcbiAgICAgIFN0cmVhbS5wcm90b3R5cGVbVG9rZW5DbGFzcy5sb3dlckNhbWVsQ2FzZVR5cGVdID0gZnVuY3Rpb24gKGFyZ0xpc3QsIGZ1bmN0aW9ucywgc3RyZWFtcykge1xuICAgICAgICByZXR1cm4gdGhpcy5leHRlbmQoVG9rZW5DbGFzcywgYXJnTGlzdCwgZnVuY3Rpb25zLCBzdHJlYW1zKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgc3RyZWFtIChvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zLm11cmUgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgU3RyZWFtKG9wdGlvbnMpO1xuICB9XG4gIHdyYXAgKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSkge1xuICAgIGNvbnN0IHRva2VuTGlzdCA9IFt0b2tlbl07XG4gICAgbGV0IHRlbXAgPSB3cmFwcGVkUGFyZW50O1xuICAgIHdoaWxlICh0ZW1wICE9PSBudWxsKSB7XG4gICAgICB0b2tlbkxpc3QudW5zaGlmdCh0ZW1wLnRva2VuKTtcbiAgICAgIHRlbXAgPSB0ZW1wLndyYXBwZWRQYXJlbnQ7XG4gICAgfVxuICAgIGZvciAobGV0IGNsYXNzU2VsZWN0b3IgaW4gdGhpcy5jbGFzc2VzKSB7XG4gICAgICBjb25zdCBjb25zdHJ1Y3QgPSB0aGlzLmNsYXNzZXNbY2xhc3NTZWxlY3Rvcl07XG4gICAgICBpZiAoY29uc3RydWN0LnN0cmVhbS5pc1N1cGVyU2V0T2ZUb2tlbkxpc3QodG9rZW5MaXN0KSkge1xuICAgICAgICByZXR1cm4gY29uc3RydWN0LndyYXAoeyB3cmFwcGVkUGFyZW50LCB0b2tlbiwgcmF3SXRlbSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ldyB0aGlzLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKHsgd3JhcHBlZFBhcmVudCwgdG9rZW4sIHJhd0l0ZW0gfSk7XG4gIH1cblxuICBuZXdDbGFzcyAoeyBDbGFzc1R5cGUsIHNlbGVjdG9yLCBjbGFzc05hbWVzIH0pIHtcbiAgICBpZiAodGhpcy5jbGFzc2VzW3NlbGVjdG9yXSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl07XG4gICAgfVxuICAgIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl0gPSBuZXcgQ2xhc3NUeXBlKHsgbXVyZTogdGhpcywgc2VsZWN0b3IsIGNsYXNzTmFtZXMgfSk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tzZWxlY3Rvcl07XG4gIH1cblxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNEYXRhU291cmNlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNEYXRhU291cmNlKCkgaW5zdGVhZC5gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlKHtcbiAgICAgIGtleTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGFkZFN0cmluZ0FzU3RhdGljRGF0YVNvdXJjZSAoe1xuICAgIGtleSxcbiAgICBleHRlbnNpb24gPSAndHh0JyxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICBsZXQgb2JqO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBvYmogPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGRlbGV0ZSBvYmouY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNEYXRhU291cmNlKGtleSwgb2JqKTtcbiAgfVxuICBhc3luYyBhZGRTdGF0aWNEYXRhU291cmNlIChrZXksIG9iaikge1xuICAgIHRoaXMucm9vdFtrZXldID0gb2JqO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHNlbGVjdG9yOiBgcm9vdC52YWx1ZXMoJyR7a2V5fScpLnZhbHVlcygpYCxcbiAgICAgIENsYXNzVHlwZTogdGhpcy5DT05TVFJVQ1RTLkdlbmVyaWNDb25zdHJ1Y3QsXG4gICAgICBjbGFzc05hbWVzOiBbIGtleSBdXG4gICAgfSk7XG4gIH1cblxuICByZW1vdmVEYXRhU291cmNlIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5yb290W2tleV07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTXVyZTtcbiIsImltcG9ydCBNdXJlIGZyb20gJy4vTXVyZS5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUod2luZG93LkZpbGVSZWFkZXIpO1xubXVyZS52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJldmVudEhhbmRsZXJzIiwic3RpY2t5VHJpZ2dlcnMiLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJpbmRleCIsInNwbGljZSIsImFyZ3MiLCJmb3JFYWNoIiwic2V0VGltZW91dCIsImFwcGx5IiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJ0aW1lb3V0IiwidHJpZ2dlciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJpIiwiREVGQVVMVF9GVU5DVElPTlMiLCJ3cmFwcGVkUGFyZW50IiwicmF3SXRlbSIsIm1kNSIsIlN0cmVhbSIsIm11cmUiLCJ0b2tlbkxpc3QiLCJwYXJzZVNlbGVjdG9yIiwic2VsZWN0b3IiLCJmdW5jdGlvbnMiLCJzdHJlYW1zIiwidHJhdmVyc2FsTW9kZSIsImpvaW4iLCJzZWxlY3RvclN0cmluZyIsInN0YXJ0c1dpdGgiLCJTeW50YXhFcnJvciIsInRva2VuU3RyaW5ncyIsIm1hdGNoIiwiVE9LRU5TIiwiUm9vdFRva2VuIiwiY2h1bmsiLCJ0ZW1wIiwidG9rZW5DbGFzc05hbWUiLCJ0b1VwcGVyQ2FzZSIsInNsaWNlIiwiYXJnTGlzdCIsInNwbGl0IiwibWFwIiwiZCIsInRyaW0iLCJLZXlzVG9rZW4iLCJWYWx1ZVRva2VuIiwiRXJyb3IiLCJkZWVwSGVscGVyIiwibGVuZ3RoIiwid3JhcHBlZEl0ZW0iLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiZGVidWciLCJ3YXJuIiwibmF2aWdhdGUiLCJwYXJlbnRZaWVsZGVkU29tZXRoaW5nIiwibGltaXQiLCJpdGVyYXRvciIsIml0ZXJhdGUiLCJuZXh0IiwiZG9uZSIsInZhbHVlIiwiVG9rZW5DbGFzcyIsIm5ld1N0cmVhbSIsIm1vZGUiLCJjb25jYXQiLCJldmVyeSIsInRva2VuIiwiaXNTdXBlclNldE9mIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwiY29uc3RydWN0b3IiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkJhc2VUb2tlbiIsInN0cmVhbSIsInRvTG93ZXJDYXNlIiwib3RoZXJUb2tlbiIsImV4ZWMiLCJuYW1lIiwid3JhcCIsInJvb3QiLCJtYXRjaEFsbCIsImtleXMiLCJyYW5nZXMiLCJhcmciLCJJbmZpbml0eSIsInBhcnNlSW50IiwiaXNOYU4iLCJsb3ciLCJoaWdoIiwibnVtIiwiTnVtYmVyIiwiSlNPTiIsInN0cmluZ2lmeSIsImNvbnNvbGlkYXRlUmFuZ2VzIiwic2VsZWN0c05vdGhpbmciLCJuZXdSYW5nZXMiLCJzb3J0IiwiYSIsImIiLCJjdXJyZW50UmFuZ2UiLCJ1bmRlZmluZWQiLCJuZXdLZXlzIiwia2V5IiwiYWxsUG9pbnRzIiwicmVkdWNlIiwiYWdnIiwicmFuZ2UiLCJpbmNsdWRlIiwiZXhjbHVkZSIsImRpZmYiLCJkaWZmZXJlbmNlIiwiVHlwZUVycm9yIiwiTWF0aCIsIm1heCIsIm1pbiIsImhhc093blByb3BlcnR5Iiwib2JqIiwia2V5VHlwZSIsIkV2YWx1YXRlVG9rZW4iLCJlcnIiLCJNYXBUb2tlbiIsImdlbmVyYXRvciIsIm1hcHBlZFJhd0l0ZW0iLCJQcm9tb3RlVG9rZW4iLCJoYXNoIiwicmVkdWNlSW5zdGFuY2VzIiwiZnVuYyIsInNlZW5JdGVtcyIsIkdlbmVyaWNDb25zdHJ1Y3QiLCJjbGFzc05hbWVzIiwiYW5ub3RhdGlvbnMiLCJvcHRpb25zIiwiTm9kZUNvbnN0cnVjdCIsIkVkZ2VDb25zdHJ1Y3QiLCJOb2RlV3JhcHBlciIsIkVkZ2VXcmFwcGVyIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJtaW1lIiwiY2xhc3NlcyIsIkRBVEFMSUJfRk9STUFUUyIsIlRSVVRIWV9TVFJJTkdTIiwiRkFMU0VZX1NUUklOR1MiLCJDT05TVFJVQ1RTIiwicHJvdG90eXBlIiwiZXh0ZW5kIiwidW5zaGlmdCIsImNsYXNzU2VsZWN0b3IiLCJjb25zdHJ1Y3QiLCJpc1N1cGVyU2V0T2ZUb2tlbkxpc3QiLCJDbGFzc1R5cGUiLCJjaGFyc2V0IiwiZmlsZU9iaiIsImZpbGVNQiIsInNpemUiLCJza2lwU2l6ZUNoZWNrIiwidGV4dCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVhZGVyIiwib25sb2FkIiwicmVzdWx0IiwicmVhZEFzVGV4dCIsImVuY29kaW5nIiwiYWRkU3RyaW5nQXNTdGF0aWNEYXRhU291cmNlIiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJleHRlbnNpb24iLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNEYXRhU291cmNlIiwibmV3Q2xhc3MiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsbUJBQW1CLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtrQkFDZjtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsYUFBTCxHQUFxQixFQUFyQjtXQUNLQyxjQUFMLEdBQXNCLEVBQXRCOztPQUVFQyxTQUFKLEVBQWVDLFFBQWYsRUFBeUJDLHVCQUF6QixFQUFrRDtVQUM1QyxDQUFDLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLENBQUwsRUFBb0M7YUFDN0JGLGFBQUwsQ0FBbUJFLFNBQW5CLElBQWdDLEVBQWhDOztVQUVFLENBQUNFLHVCQUFMLEVBQThCO1lBQ3hCLEtBQUtKLGFBQUwsQ0FBbUJFLFNBQW5CLEVBQThCRyxPQUE5QixDQUFzQ0YsUUFBdEMsTUFBb0QsQ0FBQyxDQUF6RCxFQUE0RDs7OztXQUl6REgsYUFBTCxDQUFtQkUsU0FBbkIsRUFBOEJJLElBQTlCLENBQW1DSCxRQUFuQzs7UUFFR0QsU0FBTCxFQUFnQkMsUUFBaEIsRUFBMEI7VUFDcEIsS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBSixFQUFtQztZQUM3QixDQUFDQyxRQUFMLEVBQWU7aUJBQ04sS0FBS0gsYUFBTCxDQUFtQkUsU0FBbkIsQ0FBUDtTQURG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
