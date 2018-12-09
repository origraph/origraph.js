import mime from 'mime-types';
import datalib from 'datalib';
import JSZip from 'jszip';

const TriggerableMixin = function (superclass) {
  return class extends superclass {
    constructor() {
      super(...arguments);
      this._instanceOfTriggerableMixin = true;
      this._eventHandlers = {};
      this._stickyTriggers = {};
    }

    on(eventName, callback) {
      let [event, namespace] = eventName.split(':');
      this._eventHandlers[event] = this._eventHandlers[event] || {
        '': []
      };

      if (!namespace) {
        this._eventHandlers[event][''].push(callback);
      } else {
        this._eventHandlers[event][namespace] = callback;
      }
    }

    off(eventName, callback) {
      let [event, namespace] = eventName.split(':');

      if (this._eventHandlers[event]) {
        if (!namespace) {
          if (!callback) {
            this._eventHandlers[event][''] = [];
          } else {
            let index = this._eventHandlers[event][''].indexOf(callback);

            if (index >= 0) {
              this._eventHandlers[event][''].splice(index, 1);
            }
          }
        } else {
          delete this._eventHandlers[event][namespace];
        }
      }
    }

    trigger(event, ...args) {
      const handleCallback = callback => {
        setTimeout(() => {
          // Add timeout to prevent blocking
          callback.apply(this, args);
        }, 0);
      };

      if (this._eventHandlers[event]) {
        for (const namespace of Object.keys(this._eventHandlers[event])) {
          if (namespace === '') {
            this._eventHandlers[event][''].forEach(handleCallback);
          } else {
            handleCallback(this._eventHandlers[event][namespace]);
          }
        }
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this._stickyTriggers[eventName] = this._stickyTriggers[eventName] || {
        argObj: {}
      };
      Object.assign(this._stickyTriggers[eventName].argObj, argObj);
      clearTimeout(this._stickyTriggers.timeout);
      this._stickyTriggers.timeout = setTimeout(() => {
        let argObj = this._stickyTriggers[eventName].argObj;
        delete this._stickyTriggers[eventName];
        this.trigger(eventName, argObj);
      }, delay);
    }

  };
};

Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfTriggerableMixin
});

function _asyncIterator(iterable) {
  var method;

  if (typeof Symbol === "function") {
    if (Symbol.asyncIterator) {
      method = iterable[Symbol.asyncIterator];
      if (method != null) return method.call(iterable);
    }

    if (Symbol.iterator) {
      method = iterable[Symbol.iterator];
      if (method != null) return method.call(iterable);
    }
  }

  throw new TypeError("Object is not async iterable");
}

function _AwaitValue(value) {
  this.wrapped = value;
}

function _AsyncGenerator(gen) {
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
      var wrappedAwait = value instanceof _AwaitValue;
      Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) {
        if (wrappedAwait) {
          resume("next", arg);
          return;
        }

        settle(result.done ? "return" : "normal", arg);
      }, function (err) {
        resume("throw", err);
      });
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
  _AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
    return this;
  };
}

_AsyncGenerator.prototype.next = function (arg) {
  return this._invoke("next", arg);
};

_AsyncGenerator.prototype.throw = function (arg) {
  return this._invoke("throw", arg);
};

_AsyncGenerator.prototype.return = function (arg) {
  return this._invoke("return", arg);
};

function _wrapAsyncGenerator(fn) {
  return function () {
    return new _AsyncGenerator(fn.apply(this, arguments));
  };
}

function _awaitAsyncGenerator(value) {
  return new _AwaitValue(value);
}

function _asyncGeneratorDelegate(inner, awaitWrap) {
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

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.index = options.index;
    this.table = options.table;

    if (this.index === undefined || !this.table) {
      throw new Error(`index and table are required`);
    }

    this.classObj = options.classObj || null;
    this.row = options.row || {};
    this.connectedItems = options.connectedItems || {};
    this.duplicateItems = options.duplicateItems || [];
  }

  registerDuplicate(item) {
    this.duplicateItems.push(item);
  }

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
    }

    for (const dup of this.duplicateItems) {
      item.connectItem(dup);
      dup.connectItem(item);
    }
  }

  disconnect() {
    for (const itemList of Object.values(this.connectedItems)) {
      for (const item of itemList) {
        const index = (item.connectedItems[this.table.tableId] || []).indexOf(this);

        if (index !== -1) {
          item.connectedItems[this.table.tableId].splice(index, 1);
        }
      }
    }

    this.connectedItems = {};
  }

  get instanceId() {
    return `{"classId":"${this.classObj.classId}","index":"${this.index}"}`;
  }

  get exportId() {
    return `${this.classObj.classId}_${this.index}`;
  }

  equals(item) {
    return this.instanceId === item.instanceId;
  }

  handleLimit(options, iterators) {
    return _wrapAsyncGenerator(function* () {
      let limit = Infinity;

      if (options.limit !== undefined) {
        limit = options.limit;
        delete options.limit;
      }

      let i = 0;

      for (const iterator of iterators) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(iterator), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const item = _value;
            yield item;
            i++;

            if (item === null || i >= limit) {
              return;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    })();
  }

  iterateAcrossConnections(tableIds) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj.model.tables[tableId].buildCache();
      })));
      yield* _asyncGeneratorDelegate(_asyncIterator(_this._iterateAcrossConnections(tableIds)), _awaitAsyncGenerator);
    })();
  }

  *_iterateAcrossConnections(tableIds) {
    if (this.reset) {
      return;
    }

    const nextTableId = tableIds[0];

    if (tableIds.length === 1) {
      yield* this.connectedItems[nextTableId] || [];
    } else {
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[nextTableId] || []) {
        yield* item._iterateAcrossConnections(remainingTableIds);
      }
    }
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.model = options.model;
    this.tableId = options.tableId;

    if (!this.model || !this.tableId) {
      throw new Error(`model and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
      this._derivedAttributeFunctions[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._suppressedAttributes = options.suppressedAttributes || {};
    this._suppressIndex = !!options.suppressIndex;
    this._indexFilter = options.indexFilter && this.hydrateFunction(options.indexFilter) || null;
    this._attributeFilters = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.attributeFilters || {})) {
      this._attributeFilters[attr] = this.hydrateFunction(stringifiedFunc);
    }

    this._limitPromises = {};
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      derivedAttributeFunctions: {},
      suppressedAttributes: this._suppressedAttributes,
      suppressIndex: this._suppressIndex,
      attributeFilters: {},
      indexFilter: this._indexFilter && this.dehydrateFunction(this._indexFilter) || null
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this.dehydrateFunction(func);
    }

    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      result.attributeFilters[attr] = this.dehydrateFunction(func);
    }

    return result;
  }

  getSortHash() {
    return this.type;
  }

  hydrateFunction(stringifiedFunc) {
    return new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }

  dehydrateFunction(func) {
    let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  iterate(limit = Infinity) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      if (_this._cache) {
        // The cache has already been built; just grab data from it directly
        yield* _asyncGeneratorDelegate(_asyncIterator(_this._cache.slice(0, limit)), _awaitAsyncGenerator);
      } else if (_this._partialCache && _this._partialCache.length >= limit) {
        // The cache isn't finished, but it's already long enough to satisfy this
        // request
        yield* _asyncGeneratorDelegate(_asyncIterator(_this._partialCache.slice(0, limit)), _awaitAsyncGenerator);
      } else {
        // The cache isn't finished building (and maybe didn't even start yet);
        // kick it off, and then wait for enough items to be processed to satisfy
        // the limit
        _this.buildCache();

        yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(new Promise((resolve, reject) => {
          _this._limitPromises[limit] = _this._limitPromises[limit] || [];

          _this._limitPromises[limit].push({
            resolve,
            reject
          });
        })))), _awaitAsyncGenerator);
      }
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator(function* () {
      throw new Error(`this function should be overridden`);
    })();
  }

  async _buildCache(resolve, reject) {
    this._partialCache = [];
    this._partialCacheLookup = {};

    const iterator = this._iterate();

    let i = 0;
    let temp = {
      done: false
    };

    while (!temp.done) {
      temp = await iterator.next();

      if (!this._partialCache || temp === null) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }

      if (!temp.done) {
        if (await this._finishItem(temp.value)) {
          // Okay, this item passed all filters, and is ready to be sent out
          // into the world
          this._partialCacheLookup[temp.value.index] = this._partialCache.length;

          this._partialCache.push(temp.value);

          i++;

          for (let limit of Object.keys(this._limitPromises)) {
            limit = Number(limit); // check if we have enough data now to satisfy any waiting requests

            if (limit <= i) {
              for (const {
                resolve
              } of this._limitPromises[limit]) {
                resolve(this._partialCache.slice(0, limit));
              }

              delete this._limitPromises[limit];
            }
          }
        }
      }
    } // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests


    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;

    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);

      for (const {
        resolve
      } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }

      delete this._limitPromises[limit];
    }

    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }

  buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (!this._cachePromise) {
      this._cachePromise = new Promise((resolve, reject) => {
        // The setTimeout here is absolutely necessary, or this._cachePromise
        // won't be stored in time for the next buildCache() call that comes
        // through
        setTimeout(() => {
          this._buildCache(resolve, reject);
        }, 0);
      });
    }

    return this._cachePromise;
  }

  reset() {
    const itemsToReset = (this._cache || []).concat(this._partialCache || []);

    for (const item of itemsToReset) {
      item.reset = true;
    }

    delete this._cache;
    delete this._cacheLookup;
    delete this._partialCache;
    delete this._partialCacheLookup;
    delete this._cachePromise;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  handleReset(reject) {
    for (const limit of Object.keys(this._limitPromises)) {
      this._limitPromises[limit].reject();

      delete this._limitPromises;
    }

    reject();
  }

  async countRows() {
    return (await this.buildCache()).length;
  }

  async _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);

      if (wrappedItem.row[attr] instanceof Promise) {
        (async () => {
          wrappedItem.delayedRow = wrappedItem.delayedRow || {};
          wrappedItem.delayedRow[attr] = await wrappedItem.row[attr];
        })();
      }
    }

    for (const attr in wrappedItem.row) {
      this._observedAttributes[attr] = true;
    }

    for (const attr in this._suppressedAttributes) {
      delete wrappedItem.row[attr];
    }

    let keep = true;

    if (this._indexFilter) {
      keep = this._indexFilter(wrappedItem.index);
    }

    for (const func of Object.values(this._attributeFilters)) {
      keep = keep && (await func(wrappedItem));

      if (!keep) {
        break;
      }
    }

    if (keep) {
      wrappedItem.trigger('finish');
    } else {
      wrappedItem.disconnect();
      wrappedItem.trigger('filter');
    }

    return keep;
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    const wrappedItem = classObj ? classObj._wrap(options) : new GenericWrapper(options);

    for (const otherItem of options.itemsToConnect || []) {
      wrappedItem.connectItem(otherItem);
      otherItem.connectItem(wrappedItem);
    }

    return wrappedItem;
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  getIndexDetails() {
    const details = {
      name: null
    };

    if (this._suppressIndex) {
      details.suppressed = true;
    }

    if (this._indexFilter) {
      details.filtered = true;
    }

    return details;
  }

  getAttributeDetails() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].expected = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].observed = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].derived = true;
    }

    for (const attr in this._suppressedAttributes) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].suppressed = true;
    }

    for (const attr in this._attributeFilters) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].filtered = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this.getAttributeDetails());
  }

  get currentData() {
    // Allow probing to see whatever data happens to be available
    return {
      data: this._cache || this._partialCache || [],
      lookup: this._cacheLookup || this._partialCacheLookup || {},
      complete: !!this._cache
    };
  }

  async getItem(index = null) {
    if (this._cacheLookup) {
      return index === null ? this._cache[0] : this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && (index === null && this._partialCache.length > 0 || this._partialCacheLookup[index] !== undefined)) {
      return index === null ? this._partialCache[0] : this._partialCache[this._partialCacheLookup[index]];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses could override this


    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
        const item = _value;

        if (item === null || item.index === index) {
          return item;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return != null) {
          await _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return null;
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
    this.model.trigger('update');
  }

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
    this.model.trigger('update');
  }

  addFilter(func, attribute = null) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }

    this.reset();
    this.model.trigger('update');
  }

  _deriveTable(options) {
    const newTable = this.model.createTable(options);
    this._derivedTables[newTable.tableId] = true;
    this.model.trigger('update');
    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTable = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTable && this.model.tables[existingTable.tableId] || null;
  }

  promote(attribute) {
    const options = {
      type: 'PromotedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  expand(attribute) {
    const options = {
      type: 'ExpandedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  unroll(attribute) {
    const options = {
      type: 'UnrolledTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  closedFacet(attribute, values) {
    return values.map(value => {
      const options = {
        type: 'FacetedTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  openFacet(attribute, limit = Infinity) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = yield _awaitAsyncGenerator(wrappedItem.row[attribute]);

          if (!values[value]) {
            values[value] = true;
            const options = {
              type: 'FacetedTable',
              attribute,
              value
            };
            yield _this2._getExistingTable(options) || _this2._deriveTable(options);
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator(_iterator2.return());
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
  }

  closedTranspose(indexes) {
    return indexes.map(index => {
      const options = {
        type: 'TransposedTable',
        index
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  openTranspose(limit = Infinity) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this3.iterate(limit)), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const wrappedItem = _value3;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this3._getExistingTable(options) || _this3._deriveTable(options);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            yield _awaitAsyncGenerator(_iterator3.return());
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    })();
  }

  duplicate() {
    return this._deriveTable({
      type: 'DuplicatedTable'
    });
  }

  connect(otherTableList, type = 'ConnectedTable') {
    const newTable = this.model.createTable({
      type
    });
    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this.model.trigger('update');
    return newTable;
  }

  project(tableIds) {
    const newTable = this.model.createTable({
      type: 'ProjectedTable',
      tableOrder: [this.tableId].concat(tableIds)
    });
    this._derivedTables[newTable.tableId] = true;

    for (const otherTableId of tableIds) {
      const otherTable = this.model.tables[otherTableId];
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this.model.trigger('update');
    return newTable;
  }

  get classObj() {
    return Object.values(this.model.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this.model.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this.model.tables[tableId];
    });
  }

  get inUse() {
    if (Object.keys(this._derivedTables).length > 0) {
      return true;
    }

    return Object.values(this.model.classes).some(classObj => {
      return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
    });
  }

  delete(force = false) {
    if (!force && this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }

    for (const parentTable of this.parentTables) {
      delete parentTable._derivedTables[this.tableId];
    }

    delete this.model.tables[this.tableId];
    this.model.trigger('update');
  }

}

Object.defineProperty(Table, 'type', {
  get() {
    return /(.*)Table/.exec(this.name)[1];
  }

});

class StaticTable extends Table {
  constructor(options) {
    super(options);
    this._name = options.name;
    this._data = options.data || [];

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._name;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

class StaticDictTable extends Table {
  constructor(options) {
    super(options);
    this._name = options.name;
    this._data = options.data || {};

    if (!this._name || !this._data) {
      throw new Error(`name and data are required`);
    }
  }

  get name() {
    return this._name;
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.name = this._name;
    obj.data = this._data;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._name;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

const SingleParentMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfSingleParentMixin = true;
    }

    get parentTable() {
      const parentTables = this.parentTables;

      if (parentTables.length === 0) {
        throw new Error(`Parent table is required for table of type ${this.type}`);
      } else if (parentTables.length > 1) {
        throw new Error(`Only one parent table allowed for table of type ${this.type}`);
      }

      return parentTables[0];
    }

  };
};

Object.defineProperty(SingleParentMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfSingleParentMixin
});

const AttrTableMixin = function (superclass) {
  return class extends SingleParentMixin(superclass) {
    constructor(options) {
      super(options);
      this._instanceOfAttrTableMixin = true;
      this._attribute = options.attribute;

      if (!this._attribute) {
        throw new Error(`attribute is required`);
      }
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.attribute = this._attribute;
      return obj;
    }

    getSortHash() {
      return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
    }

    get name() {
      return this._attribute;
    }

  };
};

Object.defineProperty(AttrTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfAttrTableMixin
});

class PromotedTable extends AttrTableMixin(Table) {
  async _buildCache(resolve, reject) {
    // We override _buildCache because we don't actually want to call _finishItem
    // until all unique values have been seen
    this._unfinishedCache = [];
    this._unfinishedCacheLookup = {};
    this._partialCache = [];
    this._partialCacheLookup = {};

    const iterator = this._iterate();

    let temp = {
      done: false
    };

    while (!temp.done) {
      temp = await iterator.next();

      if (!this._partialCache || temp === null) {
        // reset() was called before we could finish; we need to let everyone
        // that was waiting on us know that we can't comply
        this.handleReset(reject);
        return;
      }

      if (!temp.done) {
        this._unfinishedCacheLookup[temp.value.index] = this._unfinishedCache.length;

        this._unfinishedCache.push(temp.value);
      }
    } // Okay, now we've seen everything; we can call _finishItem on each of the
    // unique values


    let i = 0;

    for (const value of this._unfinishedCache) {
      if (await this._finishItem(value)) {
        // Okay, this item passed all filters, and is ready to be sent out
        // into the world
        this._partialCacheLookup[value.index] = this._partialCache.length;

        this._partialCache.push(value);

        i++;

        for (let limit of Object.keys(this._limitPromises)) {
          limit = Number(limit); // check if we have enough data now to satisfy any waiting requests

          if (limit <= i) {
            for (const {
              resolve
            } of this._limitPromises[limit]) {
              resolve(this._partialCache.slice(0, limit));
            }

            delete this._limitPromises[limit];
          }
        }
      }
    } // Done iterating! We can graduate the partial cache / lookups into
    // finished ones, and satisfy all the requests


    delete this._unfinishedCache;
    delete this._unfinishedCacheLookup;
    this._cache = this._partialCache;
    delete this._partialCache;
    this._cacheLookup = this._partialCacheLookup;
    delete this._partialCacheLookup;

    for (let limit of Object.keys(this._limitPromises)) {
      limit = Number(limit);

      for (const {
        resolve
      } of this._limitPromises[limit]) {
        resolve(this._cache.slice(0, limit));
      }

      delete this._limitPromises[limit];
    }

    delete this._cachePromise;
    this.trigger('cacheBuilt');
    resolve(this._cache);
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const index = String((yield _awaitAsyncGenerator(wrappedParent.row[_this._attribute])));

          if (!_this._partialCache) {
            // We were reset!
            return;
          } else if (_this._unfinishedCacheLookup[index] !== undefined) {
            const existingItem = _this._unfinishedCache[_this._unfinishedCacheLookup[index]];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);
          } else {
            const newItem = _this._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class FacetedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute || !this._value === undefined) {
      throw new Error(`attribute and value are required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.value = this._value;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this._attribute + this._value;
  }

  get name() {
    return String(this._value);
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if ((yield _awaitAsyncGenerator(wrappedParent.row[_this._attribute])) === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
              yield newItem;
            }

            index++;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class TransposedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._index = options.index;

    if (this._index === undefined) {
      throw new Error(`index is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.index = this._index;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._index;
  }

  get name() {
    return `${this._index}`;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      yield _awaitAsyncGenerator(_this.parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = _this.parentTable._cache[_this.parentTable._cacheLookup[_this._index]] || {
        row: {}
      };

      for (const [index, value] of Object.entries(wrappedParent.row)) {
        const newItem = _this._wrap({
          index,
          row: typeof value === 'object' ? value : {
            value
          },
          itemsToConnect: [wrappedParent]
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

class ConnectedTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('=');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join('=');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTables = _this.parentTables; // Don't try to connect values until all of the parent tables' caches are
      // built; TODO: might be able to do something more responsive here?

      yield _awaitAsyncGenerator(Promise.all(parentTables.map(pTable => pTable.buildCache()))); // Now that the caches are built, just iterate their keys directly. We only
      // care about including rows that have exact matches across all tables, so
      // we can just pick one parent table to iterate

      const baseParentTable = parentTables[0];
      const otherParentTables = parentTables.slice(1);

      for (const index in baseParentTable._cacheLookup) {
        if (!parentTables.every(table => table._cacheLookup)) {
          // One of the parent tables was reset
          _this.reset();

          return;
        }

        if (!otherParentTables.every(table => table._cacheLookup[index] !== undefined)) {
          // No match in one of the other tables; omit this item
          continue;
        } // TODO: add each parent tables' keys as attribute values


        const newItem = _this._wrap({
          index,
          itemsToConnect: parentTables.map(table => table._cache[table._cacheLookup[index]])
        });

        if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

class DuplicatedTable extends SingleParentMixin(Table) {
  get name() {
    return this.parentTable.name;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash();
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Yield the same items with the same connections, but wrapped and finished
      // by this table
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this.parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;

          const newItem = _this._wrap({
            index: item.index,
            row: item.row,
            itemsToConnect: Object.values(item.connectedItems).reduce((agg, itemList) => {
              return agg.concat(itemList);
            }, [])
          });

          item.registerDuplicate(newItem);

          if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

const ChildTableMixin = function (superclass) {
  return class extends AttrTableMixin(superclass) {
    constructor(options) {
      super(options);
      this._instanceOfChildTableMixin = true;
    }

    _wrap(options) {
      const newItem = super._wrap(options);

      newItem.parentIndex = options.parentIndex;
      return newItem;
    }

  };
};

Object.defineProperty(ChildTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfChildTableMixin
});

class ExpandedTable extends ChildTableMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return this._attribute;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const row = wrappedParent.row[_this._attribute];

          if (row !== undefined && row !== null && Object.keys(row).length > 0) {
            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent],
              parentIndex: wrappedParent.index
            });

            if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
              yield newItem;
              index++;
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class UnrolledTable extends ChildTableMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
  }

  get name() {
    return this._attribute;
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const rows = wrappedParent.row[_this._attribute];

          if (rows !== undefined && rows !== null && typeof rows[Symbol.iterator] === 'function') {
            for (const row of rows) {
              const newItem = _this._wrap({
                index,
                row,
                itemsToConnect: [wrappedParent],
                parentIndex: wrappedParent.index
              });

              if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
                yield newItem;
                index++;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class ParentChildTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('/');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let parentTable, childTable;

      if (_this.parentTables[0].parentTable === _this.parentTables[1]) {
        parentTable = _this.parentTables[1];
        childTable = _this.parentTables[0];
      } else if (_this.parentTables[1].parentTable === _this.parentTables[0]) {
        parentTable = _this.parentTables[0];
        childTable = _this.parentTables[1];
      } else {
        throw new Error(`ParentChildTable not set up properly`);
      }

      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(childTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const child = _value;
          const parent = yield _awaitAsyncGenerator(parentTable.getItem(child.parentIndex));

          const newItem = _this._wrap({
            index,
            itemsToConnect: [parent, child]
          });

          if (yield _awaitAsyncGenerator(_this._finishItem(newItem))) {
            yield newItem;
            index++;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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

class ProjectedTable extends Table {
  constructor(options) {
    super(options);
    this.tableOrder = options.tableOrder;

    if (!this.tableOrder) {
      throw new Error(`tableOrder is required`);
    }
  }

  get name() {
    return this.tableOrder.map(tableId => this.model.tables[tableId].name).join('⨯');
  }

  getSortHash() {
    return super.getSortHash() + this.tableOrder.map(tableId => this.model.tables[tableId].getSortHash()).join('⨯');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const self = _this;
      const firstTable = _this.model.tables[_this.tableOrder[0]];

      const remainingIds = _this.tableOrder.slice(1);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(firstTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const sourceItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(sourceItem.iterateAcrossConnections(remainingIds)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const lastItem = _value2;

              const newItem = _this._wrap({
                index: sourceItem.index + '⨯' + lastItem.index,
                itemsToConnect: [sourceItem, lastItem]
              });

              if (yield _awaitAsyncGenerator(self._finishItem(newItem))) {
                yield newItem;
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                yield _awaitAsyncGenerator(_iterator2.return());
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
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
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



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  PromotedTable: PromotedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable,
  DuplicatedTable: DuplicatedTable,
  ExpandedTable: ExpandedTable,
  UnrolledTable: UnrolledTable,
  ParentChildTable: ParentChildTable,
  ProjectedTable: ProjectedTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this.model = options.model;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this.model || !this.classId || !this.tableId) {
      throw new Error(`model, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotations = options.annotations || {};
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotations: this.annotations
    };
  }

  getSortHash() {
    return this.type + this.className;
  }

  setClassName(value) {
    this._className = value;
    this.model.trigger('update');
  }

  get hasCustomName() {
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  get variableName() {
    return this.type.toLocaleLowerCase() + '_' + this.className.split(/\W+/g).filter(d => d.length > 0).map(d => d[0].toLocaleUpperCase() + d.slice(1)).join('');
  }

  get table() {
    return this.model.tables[this.tableId];
  }

  get deleted() {
    return !this.model.deleted && this.model.classes[this.classId];
  }

  _wrap(options) {
    options.classObj = this;
    return new GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  _deriveNewClass(newTable, type = this.constructor.name) {
    return this.model.createClass({
      tableId: newTable.tableId,
      type
    });
  }

  promote(attribute) {
    return this._deriveNewClass(this.table.promote(attribute).tableId, 'GenericClass');
  }

  expand(attribute) {
    return this._deriveNewClass(this.table.expand(attribute));
  }

  unroll(attribute) {
    return this._deriveNewClass(this.table.unroll(attribute));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }

  openFacet(attribute) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this.table.openFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newTable = _value;
          yield _this._deriveNewClass(newTable);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  closedTranspose(indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }

  openTranspose() {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.table.openTranspose()), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const newTable = _value2;
          yield _this2._deriveNewClass(newTable);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator(_iterator2.return());
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
  }

  delete() {
    delete this.model.classes[this.classId];
    this.model.optimizeTables();
    this.model.trigger('update');
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  edges(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let edgeIds = options.classes ? options.classes.map(classObj => classObj.classId) : options.classIds || Object.keys(_this.classObj.edgeClassIds);
      const iterators = [];

      for (const edgeId of edgeIds) {
        if (!_this.classObj.edgeClassIds[edgeId]) {
          continue;
        }

        const edgeClass = _this.classObj.model.classes[edgeId];

        const role = _this.classObj.getEdgeRole(edgeClass);

        if (role === 'both' || role === 'source') {
          const tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
          iterators.push(_this.iterateAcrossConnections(tableIds));
        }

        if (role === 'both' || role === 'target') {
          const tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
          iterators.push(_this.iterateAcrossConnections(tableIds));
        }
      }

      yield* _asyncGeneratorDelegate(_asyncIterator(_this.handleLimit(options, iterators)), _awaitAsyncGenerator);
    })();
  }

}

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
  }

  *edgeClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }

  getEdgeRole(edgeClass) {
    if (!this.edgeClassIds[edgeClass.classId]) {
      return null;
    } else if (edgeClass.sourceClassId === this.classId) {
      if (edgeClass.targetClassId === this.classId) {
        return 'both';
      } else {
        return 'source';
      }
    } else if (edgeClass.targetClassId === this.classId) {
      return 'target';
    } else {
      throw new Error(`Internal mismatch between node and edge classIds`);
    }
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new NodeWrapper(options);
  }

  interpretAsNodes() {
    return this;
  }

  interpretAsEdges({
    autoconnect = false
  } = {}) {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (!autoconnect || edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (autoconnect && edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
        edgeClass.disconnectSource();
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
        edgeClass.disconnectTarget();
      } // If there is a node class on the other end of edgeClass, add our
      // id to its list of connections


      const nodeClass = this.model.classes[options.sourceClassId];

      if (nodeClass) {
        nodeClass.edgeClassIds[this.classId] = true;
      } // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:


      let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList;
    } else if (autoconnect && edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
      let targetEdgeClass = this.model.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this.model.classes[edgeClassIds[0]];
          sourceEdgeClass = this.model.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.sourceClassId;
      options.targetClassId = targetEdgeClass.targetClassId; // Add this class to the source's / target's edgeClassIds

      this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.sourceTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.targetTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Disconnect the existing edge classes from the new (now edge) class


      this.disconnectAllEdges();
    }

    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    attribute,
    otherAttribute
  }) {
    let thisHash, otherHash, sourceTableIds, targetTableIds;

    if (attribute === null) {
      thisHash = this.table;
      sourceTableIds = [];
    } else {
      thisHash = this.table.promote(attribute);
      sourceTableIds = [thisHash.tableId];
    }

    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.promote(otherAttribute);
      targetTableIds = [otherHash.tableId];
    }

    const connectedTable = thisHash.connect([otherHash]);
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds,
      targetClassId: otherNodeClass.classId,
      targetTableIds
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  promote(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.promote(attribute), 'NodeClass');

    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }

  connectToChildNodeClass(childClass) {
    const connectedTable = this.table.connect([childClass.table], 'ParentChildTable');
    const newEdgeClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds: [],
      targetClassId: childClass.classId,
      targetTableIds: []
    });
    this.edgeClassIds[newEdgeClass.classId] = true;
    childClass.edgeClassIds[newEdgeClass.classId] = true;
    this.model.trigger('update');
  }

  expand(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.expand(attribute), 'NodeClass');

    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  unroll(attribute) {
    const newNodeClass = this._deriveNewClass(this.table.unroll(attribute), 'NodeClass');

    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  projectNewEdge(classIdList) {
    const classList = [this].concat(classIdList.map(classId => {
      return this.model.classes[classId];
    }));

    if (classList.length < 3 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }

    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    let tableOrder = [];

    for (let i = 1; i < classList.length; i++) {
      const classObj = classList[i];

      if (classObj.type === 'Node') {
        tableOrder.push(classObj.tableId);
      } else {
        const edgeRole = classList[i - 1].getEdgeRole(classObj);

        if (edgeRole === 'source' || edgeRole === 'both') {
          tableOrder = tableOrder.concat(Array.from(classObj.sourceTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.targetTableIds);
        } else {
          tableOrder = tableOrder.concat(Array.from(classObj.targetTableIds).reverse());
          tableOrder.push(classObj.tableId);
          tableOrder = tableOrder.concat(classObj.sourceTableIds);
        }
      }
    }

    const newTable = this.table.project(tableOrder);
    const newClass = this.model.createClass({
      type: 'EdgeClass',
      tableId: newTable.tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds: [],
      targetTableIds: []
    });
    this.edgeClassIds[newClass.classId] = true;
    classList[classList.length - 1].edgeClassIds[newClass.classId] = true;
    return newClass;
  }

  disconnectAllEdges(options) {
    for (const edgeClass of this.connectedClasses()) {
      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource(options);
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget(options);
      }
    }
  }

  *connectedClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  sourceNodes(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      if (_this.classObj.sourceClassId === null || options.classes && !options.classes.find(d => _this.classObj.sourceClassId === d.classId) || options.classIds && options.classIds.indexOf(_this.classObj.sourceClassId) === -1) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;

      const tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);

      yield* _asyncGeneratorDelegate(_asyncIterator(_this.handleLimit(options, [_this.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      if (_this2.classObj.targetClassId === null || options.classes && !options.classes.find(d => _this2.classObj.targetClassId === d.classId) || options.classIds && options.classIds.indexOf(_this2.classObj.targetClassId) === -1) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;

      const tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);

      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.handleLimit(options, [_this2.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator);
    })();
  }

  nodes(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      yield* _asyncGeneratorDelegate(_asyncIterator(_this3.handleLimit(options, [_this3.sourceNodes(options), _this3.targetNodes(options)])), _awaitAsyncGenerator);
    })();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options); // sourceTableIds and targetTableIds are lists of any intermediate tables,
    // beginning with the edge table (but not including it), that lead to the
    // source / target node tables (but not including) those

    this.sourceClassId = options.sourceClassId || null;
    this.sourceTableIds = options.sourceTableIds || [];
    this.targetClassId = options.targetClassId || null;
    this.targetTableIds = options.targetTableIds || [];
    this.directed = options.directed || false;
  }

  get className() {
    return this._className || (this.sourceClass && this.sourceClass.className || '?') + '-' + (this.targetClass && this.targetClass.className || '?');
  }

  get sourceClass() {
    return this.sourceClassId && this.model.classes[this.sourceClassId] || null;
  }

  get targetClass() {
    return this.targetClassId && this.model.classes[this.targetClassId] || null;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceTableIds = this.sourceTableIds;
    result.targetClassId = this.targetClassId;
    result.targetTableIds = this.targetTableIds;
    result.directed = this.directed;
    return result;
  }

  _wrap(options) {
    options.classObj = this;
    return new EdgeWrapper(options);
  }

  _splitTableIdList(tableIdList, otherClass) {
    let result = {
      nodeTableIdList: [],
      edgeTableId: null,
      edgeTableIdList: []
    };

    if (tableIdList.length === 0) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      result.edgeTableId = this.table.connect(otherClass.table).tableId;
      return result;
    } else {
      // Use a table in the middle as the new edge table; prioritize
      // StaticTable and StaticDictTable
      let staticExists = false;
      let tableDistances = tableIdList.map((tableId, index) => {
        staticExists = staticExists || this.model.tables[tableId].type.startsWith('Static');
        return {
          tableId,
          index,
          dist: Math.abs(tableIdList / 2 - index)
        };
      });

      if (staticExists) {
        tableDistances = tableDistances.filter(({
          tableId
        }) => {
          return this.model.tables[tableId].type.startsWith('Static');
        });
      }

      const {
        tableId,
        index
      } = tableDistances.sort((a, b) => a.dist - b.dist)[0];
      result.edgeTableId = tableId;
      result.edgeTableIdList = tableIdList.slice(0, index).reverse();
      result.nodeTableIdList = tableIdList.slice(index + 1);
    }

    return result;
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.disconnectSource();
    this.disconnectTarget();
    temp.type = 'NodeClass';
    temp.overwrite = true;
    const newNodeClass = this.model.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this.model.classes[temp.sourceClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

      const sourceEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        sourceTableIds: nodeTableIdList,
        targetClassId: newNodeClass.classId,
        targetTableIds: edgeTableIdList
      });
      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this.model.classes[temp.targetClassId];

      const {
        nodeTableIdList,
        edgeTableId,
        edgeTableIdList
      } = this._splitTableIdList(temp.targetTableIds, targetClass);

      const targetEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: edgeTableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        sourceTableIds: edgeTableIdList,
        targetClassId: temp.targetClassId,
        targetTableIds: nodeTableIdList
      });
      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this.table.reset();
    this.model.trigger('update');
    return newNodeClass;
  }

  *connectedClasses() {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }

    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass(options) {
    if (options.side === 'source') {
      this.connectSource(options);
    } else if (options.side === 'target') {
      this.connectTarget(options);
    } else {
      throw new Error(`PoliticalOutsiderError: "${options.side}" is an invalid side`);
    }
  }

  toggleDirection(directed) {
    if (directed === false || this.swappedDirection === true) {
      this.directed = false;
      delete this.swappedDirection;
    } else if (!this.directed) {
      this.directed = true;
      this.swappedDirection = false;
    } else {
      // Directed was already true, just switch source and target
      let temp = this.sourceClassId;
      this.sourceClassId = this.targetClassId;
      this.targetClassId = temp;
      temp = this.sourceTableIds;
      this.sourceTableIds = this.targetTableIds;
      this.targetTableIds = temp;
      this.swappedDirection = true;
    }

    this.model.trigger('update');
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource();
    }

    this.sourceClassId = nodeClass.classId;
    const sourceClass = this.model.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.table.promote(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.promote(nodeAttribute);
    this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.sourceTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.sourceTableIds.push(nodeHash.tableId);
    }

    this.model.trigger('update');
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget();
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this.model.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.table.promote(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.promote(nodeAttribute);
    this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

    if (edgeAttribute !== null) {
      this.targetTableIds.unshift(edgeHash.tableId);
    }

    if (nodeAttribute !== null) {
      this.targetTableIds.push(nodeHash.tableId);
    }

    this.model.trigger('update');
  }

  disconnectSource() {
    const existingSourceClass = this.model.classes[this.sourceClassId];

    if (existingSourceClass) {
      delete existingSourceClass.edgeClassIds[this.classId];
    }

    this.sourceTableIds = [];
    this.sourceClassId = null;
    this.model.trigger('update');
  }

  disconnectTarget() {
    const existingTargetClass = this.model.classes[this.targetClassId];

    if (existingTargetClass) {
      delete existingTargetClass.edgeClassIds[this.classId];
    }

    this.targetTableIds = [];
    this.targetClassId = null;
    this.model.trigger('update');
  }

  promote(attribute) {
    if (this.sourceClassId && this.targetClassId) {
      return super.promote();
    } else {
      const newNodeClass = this.model.createClass({
        tableId: this.table.promote(attribute).tableId,
        type: 'NodeClass'
      });
      this.connectToNodeClass({
        nodeClass: newNodeClass,
        side: !this.sourceClassId ? 'source' : 'target',
        nodeAttribute: null,
        edgeAttribute: attribute
      });
      return newNodeClass;
    }
  }

  connectFacetedClass(newEdgeClass) {
    // When an edge class is faceted, we want to keep the same connections. This
    // means we need to clone each table chain, and add our own table to it
    // (because our table is the parentTable of the new one)
    if (this.sourceClassId) {
      newEdgeClass.sourceClassId = this.sourceClassId;
      newEdgeClass.sourceTableIds = Array.from(this.sourceTableIds);
      newEdgeClass.sourceTableIds.unshift(this.tableId);
      this.sourceClass.edgeClassIds[newEdgeClass.classId] = true;
    }

    if (this.targetClassId) {
      newEdgeClass.targetClassId = this.targetClassId;
      newEdgeClass.targetTableIds = Array.from(this.targetTableIds);
      newEdgeClass.targetTableIds.unshift(this.tableId);
      this.targetClass.edgeClassIds[newEdgeClass.classId] = true;
    }

    this.model.trigger('update');
  }

  closedFacet(attribute, values) {
    const newClasses = super.closedFacet(attribute, values);

    for (const newClass of newClasses) {
      this.connectFacetedClass(newClass);
    }

    return newClasses;
  }

  openFacet(attribute) {
    var _this = this,
        _superprop_callOpenFacet = (..._args) => super.openFacet(..._args);

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_superprop_callOpenFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newClass = _value;

          _this.connectFacetedClass(newClass);

          yield newClass;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  delete() {
    this.disconnectSource();
    this.disconnectTarget();
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class FileFormat {
  async buildRow(item) {
    const row = {};

    for (let attr in item.row) {
      row[attr] = await item.row[attr];
    }

    return row;
  }

}

class ParseFailure extends Error {
  constructor(fileFormat) {
    super(`Failed to parse format: ${fileFormat.constructor.name}`);
  }

}

const NODE_NAMES = ['nodes', 'Nodes'];
const EDGE_NAMES = ['edges', 'links', 'Edges', 'Links'];

class D3Json extends FileFormat {
  async importData({
    model,
    text,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    const data = JSON.parse(text);
    const nodeName = NODE_NAMES.find(name => data[name] instanceof Array);
    const edgeName = EDGE_NAMES.find(name => data[name] instanceof Array);

    if (!nodeName || !edgeName) {
      throw new ParseFailure(this);
    }

    const coreTable = model.createTable({
      type: 'StaticDictTable',
      name: 'coreTable',
      data: data
    });
    const coreClass = model.createClass({
      type: 'GenericClass',
      tableId: coreTable.tableId
    });
    let [nodes, edges] = coreClass.closedTranspose([nodeName, edgeName]);

    if (classAttribute) {
      if (nodeAttribute === null) {
        throw new Error(`Can't import classes from D3-style JSON without nodeAttribute`);
      }

      const nodeClasses = [];
      const nodeClassLookup = {};
      const edgeClasses = [];
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(nodes.openFacet(classAttribute)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const nodeClass = _value;
          nodeClassLookup[nodeClass.className] = nodeClasses.length;
          nodeClasses.push(nodeClass.interpretAsNodes());
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            await _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(edges.openFacet(classAttribute)), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edgeClass = _value2;
          edgeClasses.push(edgeClass.interpretAsEdges());
          const sample = await edgeClass.table.getItem();
          const sourceClassName = sample.row[sourceAttribute + '_' + classAttribute];

          if (nodeClassLookup[sourceClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[sourceClassName]],
              side: 'source',
              nodeAttribute,
              edgeAttribute: sourceAttribute
            });
          }

          const targetClassName = sample.row[targetAttribute + '_' + classAttribute];

          if (nodeClassLookup[targetClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[targetClassName]],
              side: 'target',
              nodeAttribute,
              edgeAttribute: targetAttribute
            });
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } else {
      nodes = nodes.interpretAsNodes();
      nodes.setClassName(nodeName);
      edges = edges.interpretAsEdges();
      edges.setClassName(edgeName);
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'source',
        nodeAttribute,
        edgeAttribute: sourceAttribute
      });
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'target',
        nodeAttribute,
        edgeAttribute: targetAttribute
      });
    }
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    pretty = true,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    if (classAttribute && !nodeAttribute) {
      throw new Error(`Can't export D3-style JSON with classes, without a nodeAttribute`);
    }

    let result = {
      nodes: [],
      links: []
    };
    const nodeLookup = {};
    const nodeClasses = [];
    const edgeClasses = [];

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        nodeClasses.push(classObj);
      } else if (classObj.type === 'Edge') {
        edgeClasses.push(classObj);
      } else {
        result.other = result.other || [];
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const item = _value3;
            result.other.push((await this.buildRow(item)));
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
              await _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      }
    }

    for (const nodeClass of nodeClasses) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;

      var _iteratorError4;

      try {
        for (var _iterator4 = _asyncIterator(nodeClass.table.iterate()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
          const node = _value4;
          nodeLookup[node.exportId] = result.nodes.length;
          const row = await this.buildRow(node);

          if (nodeAttribute) {
            row[nodeAttribute] = node.exportId;
          }

          if (classAttribute) {
            row[classAttribute] = node.classObj.className;
          }

          result.nodes.push(row);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            await _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }

    for (const edgeClass of edgeClasses) {
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;

      var _iteratorError5;

      try {
        for (var _iterator5 = _asyncIterator(edgeClass.table.iterate()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const edge = _value5;
          const row = await this.buildRow(edge);
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator(edge.sourceNodes({
              classes: nodeClasses
            })), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
              const source = _value6;
              row[sourceAttribute] = nodeAttribute ? source.exportId : nodeLookup[source.exportId];

              if (classAttribute) {
                row[sourceAttribute + '_' + classAttribute] = source.classObj.className;
              }

              var _iteratorNormalCompletion7 = true;
              var _didIteratorError7 = false;

              var _iteratorError7;

              try {
                for (var _iterator7 = _asyncIterator(edge.targetNodes({
                  classes: nodeClasses
                })), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
                  const target = _value7;
                  row[targetAttribute] = nodeAttribute ? target.exportId : nodeLookup[target.exportId];

                  if (classAttribute) {
                    row[targetAttribute + '_' + classAttribute] = target.classObj.className;
                  }

                  result.links.push(Object.assign({}, row));
                }
              } catch (err) {
                _didIteratorError7 = true;
                _iteratorError7 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
                    await _iterator7.return();
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
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                await _iterator6.return();
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
          if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
            await _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }
    }

    if (pretty) {
      result.nodes = '  "nodes": [\n    ' + result.nodes.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';
      result.links = '  "links": [\n    ' + result.links.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';

      if (result.other) {
        result.other = ',\n  "other": [\n    ' + result.other.map(row => JSON.stringify(row)).join(',\n    ') + '\n  ]';
      }

      result = `{\n${result.nodes},\n${result.links}${result.other || ''}\n}\n`;
    } else {
      result = JSON.stringify(result);
    }

    return {
      data: 'data:text/json;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/json',
      extension: 'json'
    };
  }

}

var D3Json$1 = new D3Json();

class CsvZip extends FileFormat {
  async importData({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    indexName = 'index'
  }) {
    const zip = new JSZip();

    for (const classObj of includeClasses) {
      const attributes = classObj.table.attributes;
      let contents = `${indexName},${attributes.join(',')}\n`;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;
          const row = attributes.map(attr => item.row[attr]);
          contents += `${item.index},${row.join(',')}\n`;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            await _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      zip.file(classObj.className + '.csv', contents);
    }

    return {
      data: 'data:application/zip;base64,' + (await zip.generateAsync({
        type: 'base64'
      })),
      type: 'application/zip',
      extension: 'zip'
    };
  }

}

var CsvZip$1 = new CsvZip();



var FILE_FORMATS = /*#__PURE__*/Object.freeze({
  D3Json: D3Json$1,
  CsvZip: CsvZip$1
});

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv'
};

class NetworkModel extends TriggerableMixin(class {}) {
  constructor({
    origraph,
    modelId,
    name = modelId,
    annotations = {},
    classes = {},
    tables = {}
  }) {
    super();
    this._origraph = origraph;
    this.modelId = modelId;
    this.name = name;
    this.annotations = annotations;
    this.classes = {};
    this.tables = {};
    this._nextClassId = 1;
    this._nextTableId = 1;

    for (const classObj of Object.values(classes)) {
      this.classes[classObj.classId] = this.hydrate(classObj, CLASSES);
    }

    for (const table of Object.values(tables)) {
      this.tables[table.tableId] = this.hydrate(table, TABLES);
    }

    this.on('update', () => {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this._origraph.save();

        this._saveTimeout = undefined;
      }, 0);
    });
  }

  _toRawObject() {
    const classes = {};
    const tables = {};

    for (const classObj of Object.values(this.classes)) {
      classes[classObj.classId] = classObj._toRawObject();
      classes[classObj.classId].type = classObj.constructor.name;
    }

    for (const tableObj of Object.values(this.tables)) {
      tables[tableObj.tableId] = tableObj._toRawObject();
      tables[tableObj.tableId].type = tableObj.constructor.name;
    }

    return {
      modelId: this.modelId,
      name: this.name,
      annotations: this.annotations,
      classes,
      tables
    };
  }

  get unsaved() {
    return this._saveTimeout !== undefined;
  }

  hydrate(rawObject, TYPES) {
    rawObject.model = this;
    return new TYPES[rawObject.type](rawObject);
  }

  createTable(options) {
    while (!options.tableId || !options.overwrite && this.tables[options.tableId]) {
      options.tableId = `table${this._nextTableId}`;
      this._nextTableId += 1;
    }

    options.model = this;
    this.tables[options.tableId] = new TABLES[options.type](options);
    this.trigger('update');
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    while (!options.classId || !options.overwrite && this.classes[options.classId]) {
      options.classId = `class${this._nextClassId}`;
      this._nextClassId += 1;
    }

    if (this.tables[options.tableId].classObj && !options.overwrite) {
      options.tableId = this.tables[options.tableId].duplicate().tableId;
    }

    options.model = this;
    this.classes[options.classId] = new CLASSES[options.type](options);
    this.trigger('update');
    return this.classes[options.classId];
  }

  findClass(className) {
    return Object.values(this.classes).find(classObj => classObj.className === className);
  }

  rename(newName) {
    this.name = newName;
    this.trigger('update');
  }

  annotate(key, value) {
    this.annotations[key] = value;
    this.trigger('update');
  }

  deleteAnnotation(key) {
    delete this.annotations[key];
    this.trigger('update');
  }

  delete() {
    this._origraph.deleteModel(this.modelId);
  }

  get deleted() {
    return this._origraph.models[this.modelId];
  }

  async addTextFile(options) {
    if (!options.format) {
      options.format = mime.extension(mime.lookup(options.name));
    }

    if (FILE_FORMATS[options.format]) {
      options.model = this;
      return FILE_FORMATS[options.format].importData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      options.data = datalib.read(options.text, {
        type: options.format
      });

      if (options.format === 'csv' || options.format === 'tsv') {
        options.attributes = {};

        for (const attr of options.data.columns) {
          options.attributes[attr] = true;
        }

        delete options.data.columns;
      }

      return this.addStaticTable(options);
    } else {
      throw new Error(`Unsupported file format: ${options.format}`);
    }
  }

  async formatData(options) {
    options.model = this;

    if (FILE_FORMATS[options.format]) {
      return FILE_FORMATS[options.format].formatData(options);
    } else if (DATALIB_FORMATS[options.format]) {
      throw new Error(`Raw ${options.format} export not yet supported`);
    } else {
      throw new Error(`Can't export unknown format: ${options.format}`);
    }
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      tableId: newTable.tableId
    });
  }

  optimizeTables() {
    const tablesInUse = {};

    for (const classObj of Object.values(this.classes)) {
      tablesInUse[classObj.tableId] = true;

      for (const tableId of classObj.sourceTableIds || []) {
        tablesInUse[tableId] = true;
      }

      for (const tableId of classObj.targetTableIds || []) {
        tablesInUse[tableId] = true;
      }
    }

    const parentsVisited = {};
    const queue = Object.keys(tablesInUse);

    while (queue.length > 0) {
      const tableId = queue.shift();

      if (!parentsVisited[tableId]) {
        tablesInUse[tableId] = true;
        parentsVisited[tableId] = true;
        const table = this.tables[tableId];

        for (const parentTable of table.parentTables) {
          queue.push(parentTable.tableId);
        }
      }
    }

    for (const tableId of Object.keys(this.tables)) {
      const table = this.tables[tableId];

      if (!tablesInUse[tableId] && table.type !== 'Static' && table.type !== 'StaticDict') {
        table.delete(true);
      }
    } // TODO: If any DuplicatedTable is in use, but the original isn't, swap for the real one

  }

  async getInstanceGraph(instanceIdList) {
    if (!instanceIdList) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instanceIdList = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(classObj.table.iterate(5)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const item = _value;
              instanceIdList.push(item.instanceId);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                await _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }
      }
    } // Get the specified items


    const nodeInstances = {};
    const edgeInstances = {};

    for (const instanceId of instanceIdList) {
      const {
        classId,
        index
      } = JSON.parse(instanceId);
      const instance = await this.classes[classId].table.getItem(index);

      if (instance.type === 'Node') {
        nodeInstances[instanceId] = instance;
      } else if (instance.type === 'Edge') {
        edgeInstances[instanceId] = instance;
      }
    } // Add any nodes connected to our edges


    const extraNodes = {};

    for (const edgeId in edgeInstances) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(edgeInstances[edgeId].nodes()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const node = _value2;

          if (!nodeInstances[node.instanceId]) {
            extraNodes[node.instanceId] = node;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    } // Add any edges that connect our nodes


    const extraEdges = {};

    for (const nodeId in nodeInstances) {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(nodeInstances[nodeId].edges()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const edge = _value3;

          if (!edgeInstances[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator(edge.sourceNodes()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const node = _value4;

                if (nodeInstances[node.instanceId]) {
                  connectsSource = true;
                  break;
                }
              }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
                  await _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }

            var _iteratorNormalCompletion5 = true;
            var _didIteratorError5 = false;

            var _iteratorError5;

            try {
              for (var _iterator5 = _asyncIterator(edge.targetNodes()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
                const node = _value5;

                if (nodeInstances[node.instanceId]) {
                  connectsTarget = true;
                  break;
                }
              }
            } catch (err) {
              _didIteratorError5 = true;
              _iteratorError5 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
                  await _iterator5.return();
                }
              } finally {
                if (_didIteratorError5) {
                  throw _iteratorError5;
                }
              }
            }

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
            }
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            await _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    } // Okay, now we have a complete set of nodes and edges that we want to
    // include; create pairwise edge entries for every connection


    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    }; // Add all the nodes, and populate a lookup for where they are in the list

    for (const node of Object.values(nodeInstances).concat(Object.values(extraNodes))) {
      graph.nodeLookup[node.instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    } // Add all the edges...


    for (const edge of Object.values(edgeInstances).concat(Object.values(extraEdges))) {
      if (!edge.classObj.sourceClassId) {
        if (!edge.classObj.targetClassId) {
          // Missing both source and target classes; add dummy nodes for both ends
          graph.edges.push({
            edgeInstance: edge,
            source: graph.nodes.length,
            target: graph.nodes.length + 1
          });
          graph.nodes.push({
            dummy: true
          });
          graph.nodes.push({
            dummy: true
          });
        } else {
          // Add dummy source nodes
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator(edge.targetNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
              const node = _value6;

              if (graph.nodeLookup[node.instanceId] !== undefined) {
                graph.edges.push({
                  edgeInstance: edge,
                  source: graph.nodes.length,
                  target: graph.nodeLookup[node.instanceId]
                });
                graph.nodes.push({
                  dummy: true
                });
              }
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                await _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;

        var _iteratorError7;

        try {
          for (var _iterator7 = _asyncIterator(edge.sourceNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
            const node = _value7;

            if (graph.nodeLookup[node.instanceId] !== undefined) {
              graph.edges.push({
                edgeInstance: edge,
                source: graph.nodeLookup[node.instanceId],
                target: graph.nodes.length
              });
              graph.nodes.push({
                dummy: true
              });
            }
          }
        } catch (err) {
          _didIteratorError7 = true;
          _iteratorError7 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
              await _iterator7.return();
            }
          } finally {
            if (_didIteratorError7) {
              throw _iteratorError7;
            }
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;

        var _iteratorError8;

        try {
          for (var _iterator8 = _asyncIterator(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
            const sourceNode = _value8;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion9 = true;
              var _didIteratorError9 = false;

              var _iteratorError9;

              try {
                for (var _iterator9 = _asyncIterator(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
                  const targetNode = _value9;

                  if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                    graph.edges.push({
                      edgeInstance: edge,
                      source: graph.nodeLookup[sourceNode.instanceId],
                      target: graph.nodeLookup[targetNode.instanceId]
                    });
                  }
                }
              } catch (err) {
                _didIteratorError9 = true;
                _iteratorError9 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion9 && _iterator9.return != null) {
                    await _iterator9.return();
                  }
                } finally {
                  if (_didIteratorError9) {
                    throw _iteratorError9;
                  }
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError8 = true;
          _iteratorError8 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion8 && _iterator8.return != null) {
              await _iterator8.return();
            }
          } finally {
            if (_didIteratorError8) {
              throw _iteratorError8;
            }
          }
        }
      }
    }

    return graph;
  }

  getNetworkModelGraph({
    raw = true,
    includeDummies = false,
    classList = Object.values(this.classes)
  } = {}) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      classConnections: []
    };

    for (const classObj of classList) {
      // Add and index the class as a node
      const classSpec = raw ? classObj._toRawObject() : {
        classObj
      };
      classSpec.type = classObj.constructor.name;
      graph.classLookup[classObj.classId] = graph.classes.length;
      graph.classes.push(classSpec);

      if (classObj.type === 'Edge') {
        // Store the edge class so we can create classConnections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node' && includeDummies) {
        // Create a "potential" connection + dummy node
        graph.classConnections.push({
          id: `${classObj.classId}>dummy`,
          source: graph.classes.length - 1,
          target: graph.classes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }
    } // Create existing classConnections


    for (const edgeClass of edgeClasses) {
      if (edgeClass.sourceClassId !== null) {
        // Connect the source node class to the edge class
        graph.classConnections.push({
          id: `${edgeClass.sourceClassId}>${edgeClass.classId}`,
          source: graph.classLookup[edgeClass.sourceClassId],
          target: graph.classLookup[edgeClass.classId],
          directed: edgeClass.directed,
          location: 'source'
        });
      } else if (includeDummies) {
        // Create a "potential" connection + dummy source class
        graph.classConnections.push({
          id: `dummy>${edgeClass.classId}`,
          source: graph.classes.length,
          target: graph.classLookup[edgeClass.classId],
          directed: edgeClass.directed,
          location: 'source',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }

      if (edgeClass.targetClassId !== null) {
        // Connect the edge class to the target node class
        graph.classConnections.push({
          id: `${edgeClass.classId}>${edgeClass.targetClassId}`,
          source: graph.classLookup[edgeClass.classId],
          target: graph.classLookup[edgeClass.targetClassId],
          directed: edgeClass.directed,
          location: 'target'
        });
      } else if (includeDummies) {
        // Create a "potential" connection + dummy target class
        graph.classConnections.push({
          id: `${edgeClass.classId}>dummy`,
          source: graph.classLookup[edgeClass.classId],
          target: graph.classes.length,
          directed: edgeClass.directed,
          location: 'target',
          dummy: true
        });
        graph.classes.push({
          dummy: true
        });
      }
    }

    return graph;
  }

  getTableDependencyGraph() {
    const graph = {
      tables: [],
      tableLookup: {},
      tableLinks: []
    };
    const tableList = Object.values(this.tables);

    for (const table of tableList) {
      const tableSpec = table._toRawObject();

      tableSpec.type = table.constructor.name;
      graph.tableLookup[table.tableId] = graph.tables.length;
      graph.tables.push(tableSpec);
    } // Fill the graph with links based on parentTables...


    for (const table of tableList) {
      for (const parentTable of table.parentTables) {
        graph.tableLinks.push({
          source: graph.tableLookup[parentTable.tableId],
          target: graph.tableLookup[table.tableId]
        });
      }
    }

    return graph;
  }

  getModelDump() {
    // Because object key orders aren't deterministic, it can be problematic
    // for testing (because ids can randomly change from test run to test run).
    // This function sorts each key, and just replaces IDs with index numbers
    const rawObj = JSON.parse(JSON.stringify(this._toRawObject()));
    const result = {
      classes: Object.values(rawObj.classes).sort((a, b) => {
        const aHash = this.classes[a.classId].getSortHash();
        const bHash = this.classes[b.classId].getSortHash();

        if (aHash < bHash) {
          return -1;
        } else if (aHash > bHash) {
          return 1;
        } else {
          throw new Error(`class hash collision`);
        }
      }),
      tables: Object.values(rawObj.tables).sort((a, b) => {
        const aHash = this.tables[a.tableId].getSortHash();
        const bHash = this.tables[b.tableId].getSortHash();

        if (aHash < bHash) {
          return -1;
        } else if (aHash > bHash) {
          return 1;
        } else {
          throw new Error(`table hash collision`);
        }
      })
    };
    const classLookup = {};
    const tableLookup = {};
    result.classes.forEach((classObj, index) => {
      classLookup[classObj.classId] = index;
    });
    result.tables.forEach((table, index) => {
      tableLookup[table.tableId] = index;
    });

    for (const table of result.tables) {
      table.tableId = tableLookup[table.tableId];

      for (const tableId of Object.keys(table.derivedTables)) {
        table.derivedTables[tableLookup[tableId]] = table.derivedTables[tableId];
        delete table.derivedTables[tableId];
      }

      delete table.data; // don't include any of the data; we just want the model structure
    }

    for (const classObj of result.classes) {
      classObj.classId = classLookup[classObj.classId];
      classObj.tableId = tableLookup[classObj.tableId];

      if (classObj.sourceClassId) {
        classObj.sourceClassId = classLookup[classObj.sourceClassId];
      }

      if (classObj.sourceTableIds) {
        classObj.sourceTableIds = classObj.sourceTableIds.map(tableId => tableLookup[tableId]);
      }

      if (classObj.targetClassId) {
        classObj.targetClassId = classLookup[classObj.targetClassId];
      }

      if (classObj.targetTableIds) {
        classObj.targetTableIds = classObj.targetTableIds.map(tableId => tableLookup[tableId]);
      }

      for (const classId of Object.keys(classObj.edgeClassIds || {})) {
        classObj.edgeClassIds[classLookup[classId]] = classObj.edgeClassIds[classId];
        delete classObj.edgeClassIds[classId];
      }
    }

    return result;
  }

  createSchemaModel() {
    const graph = this.getModelDump();
    graph.tables.forEach(table => {
      table.derivedTables = Object.keys(table.derivedTables);
    });

    const newModel = this._origraph.createModel({
      name: this.name + '_schema'
    });

    const raw = newModel.addStaticTable({
      data: graph,
      name: 'Raw Dump'
    });
    let [classes, tables] = raw.closedTranspose(['classes', 'tables']);
    classes = classes.interpretAsNodes();
    classes.setClassName('Classes');
    raw.delete();
    const sourceClasses = classes.connectToNodeClass({
      otherNodeClass: classes,
      attribute: 'sourceClassId',
      otherAttribute: null
    });
    sourceClasses.setClassName('Source Class');
    sourceClasses.toggleDirection();
    const targetClasses = classes.connectToNodeClass({
      otherNodeClass: classes,
      attribute: 'targetClassId',
      otherAttribute: null
    });
    targetClasses.setClassName('Target Class');
    targetClasses.toggleDirection();
    tables = tables.interpretAsNodes();
    tables.setClassName('Tables');
    const tableDependencies = tables.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'derivedTables',
      otherAttribute: null
    });
    tableDependencies.setClassName('Is Parent Of');
    tableDependencies.toggleDirection();
    const coreTables = classes.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'tableId',
      otherAttribute: null
    });
    coreTables.setClassName('Core Table');
    return newModel;
  }

}

let NEXT_MODEL_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(localStorage) {
    super();
    this.localStorage = localStorage; // only defined in the browser context

    this.plugins = {};
    this.models = {};
    let existingModels = this.localStorage && this.localStorage.getItem('origraph_models');

    if (existingModels) {
      for (const [modelId, model] of Object.entries(JSON.parse(existingModels))) {
        model.origraph = this;
        this.models[modelId] = new NetworkModel(model);
      }
    }

    this._currentModelId = null;
  }

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
  }

  save() {
    /*
    if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }
    */
  }

  closeCurrentModel() {
    this._currentModelId = null;
    this.trigger('changeCurrentModel');
  }

  get currentModel() {
    return this.models[this._currentModelId] || null;
  }

  set currentModel(model) {
    this._currentModelId = model ? model.modelId : null;
    this.trigger('changeCurrentModel');
  }

  async loadModel(options) {
    const newModel = this.createModel({
      modelId: options.name
    });
    await newModel.addTextFile(options);
    return newModel;
  }

  createModel(options = {}) {
    while (!options.modelId || this.models[options.modelId]) {
      options.modelId = `model${NEXT_MODEL_ID}`;
      NEXT_MODEL_ID += 1;
    }

    options.origraph = this;
    this.models[options.modelId] = new NetworkModel(options);
    this._currentModelId = options.modelId;
    this.save();
    this.trigger('changeCurrentModel');
    return this.models[options.modelId];
  }

  deleteModel(modelId = this.currentModelId) {
    if (!this.models[modelId]) {
      throw new Error(`Can't delete non-existent model: ${modelId}`);
    }

    delete this.models[modelId];

    if (this._currentModelId === modelId) {
      this._currentModelId = null;
      this.trigger('changeCurrentModel');
    }

    this.save();
  }

  deleteAllModels() {
    this.models = {};
    this._currentModelId = null;
    this.save();
    this.trigger('changeCurrentModel');
  }

}

var name = "origraph";
var version = "0.2.3";
var description = "A library for flexible graph reshaping";
var main = "dist/origraph.cjs.js";
var module$1 = "dist/origraph.esm.js";
var browser = "dist/origraph.umd.js";
var scripts = {
	build: "rollup -c --environment TARGET:all",
	watch: "rollup -c -w",
	watchcjs: "rollup -c -w --environment TARGET:cjs",
	watchumd: "rollup -c -w --environment TARGET:umd",
	watchesm: "rollup -c -w --environment TARGET:esm",
	test: "jest --runInBand",
	pretest: "rollup -c --environment TARGET:cjs",
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t --detectOpenHandles",
	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
};
var files = [
	"dist"
];
var repository = {
	type: "git",
	url: "git+https://github.com/origraph/origraph.js.git"
};
var author = "Alex Bigelow";
var license = "MIT";
var bugs = {
	url: "https://github.com/origraph/origraph.js/issues"
};
var homepage = "https://github.com/origraph/origraph.js#readme";
var devDependencies = {
	"@babel/core": "^7.1.6",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.6",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.67.3",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-istanbul": "^2.0.1",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2",
	sha1: "^1.1.1"
};
var dependencies = {
	datalib: "^1.9.2",
	filereader: "^0.10.3",
	jszip: "^3.1.5",
	"mime-types": "^2.1.21"
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
	"jsnext:main": "dist/origraph.esm.js",
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

let origraph = new Origraph(window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcyA9IG9wdGlvbnMuZHVwbGljYXRlSXRlbXMgfHwgW107XG4gIH1cbiAgcmVnaXN0ZXJEdXBsaWNhdGUgKGl0ZW0pIHtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zLnB1c2goaXRlbSk7XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZHVwIG9mIHRoaXMuZHVwbGljYXRlSXRlbXMpIHtcbiAgICAgIGl0ZW0uY29ubmVjdEl0ZW0oZHVwKTtcbiAgICAgIGR1cC5jb25uZWN0SXRlbShpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGdldCBpbnN0YW5jZUlkICgpIHtcbiAgICByZXR1cm4gYHtcImNsYXNzSWRcIjpcIiR7dGhpcy5jbGFzc09iai5jbGFzc0lkfVwiLFwiaW5kZXhcIjpcIiR7dGhpcy5pbmRleH1cIn1gO1xuICB9XG4gIGdldCBleHBvcnRJZCAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuY2xhc3NPYmouY2xhc3NJZH1fJHt0aGlzLmluZGV4fWA7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4RmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBmdW5jIG9mIE9iamVjdC52YWx1ZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGF3YWl0IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIC8vIEFsbG93IHByb2JpbmcgdG8gc2VlIHdoYXRldmVyIGRhdGEgaGFwcGVucyB0byBiZSBhdmFpbGFibGVcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IFtdLFxuICAgICAgbG9va3VwOiB0aGlzLl9jYWNoZUxvb2t1cCB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIC8vIFN0dXBpZCBhcHByb2FjaCB3aGVuIHRoZSBjYWNoZSBpc24ndCBidWlsdDogaW50ZXJhdGUgdW50aWwgd2Ugc2VlIHRoZVxuICAgIC8vIGluZGV4LiBTdWJjbGFzc2VzIGNvdWxkIG92ZXJyaWRlIHRoaXNcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGl0ZW0uaW5kZXggPT09IGluZGV4KSB7XG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChmdW5jLCBhdHRyaWJ1dGUgPSBudWxsKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBwcm9qZWN0ICh0YWJsZUlkcykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnUHJvamVjdGVkVGFibGUnLFxuICAgICAgdGFibGVPcmRlcjogW3RoaXMudGFibGVJZF0uY29uY2F0KHRhYmxlSWRzKVxuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZUlkIG9mIHRhYmxlSWRzKSB7XG4gICAgICBjb25zdCBvdGhlclRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbb3RoZXJUYWJsZUlkXTtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKGZvcmNlID0gZmFsc2UpIHtcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gU3RyaW5nKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0pO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLl92YWx1ZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgYXdhaXQgdGhpcy5wYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCc9Jyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJz0nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXRcbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IEF0dHJUYWJsZU1peGluIGZyb20gJy4vQXR0clRhYmxlTWl4aW4uanMnO1xuXG5jb25zdCBDaGlsZFRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIF93cmFwIChvcHRpb25zKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gc3VwZXIuX3dyYXAob3B0aW9ucyk7XG4gICAgICBuZXdJdGVtLnBhcmVudEluZGV4ID0gb3B0aW9ucy5wYXJlbnRJbmRleDtcbiAgICAgIHJldHVybiBuZXdJdGVtO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2hpbGRUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IENoaWxkVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBDaGlsZFRhYmxlTWl4aW4gZnJvbSAnLi9DaGlsZFRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgQ2hpbGRUYWJsZU1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3cgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvdyAhPT0gdW5kZWZpbmVkICYmIHJvdyAhPT0gbnVsbCAmJiBPYmplY3Qua2V5cyhyb3cpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgcGFyZW50SW5kZXg6IHdyYXBwZWRQYXJlbnQuaW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFVucm9sbGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvd3MgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvd3MgIT09IHVuZGVmaW5lZCAmJiByb3dzICE9PSBudWxsICYmXG4gICAgICAgICAgdHlwZW9mIHJvd3NbU3ltYm9sLml0ZXJhdG9yXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFVucm9sbGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFBhcmVudENoaWxkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJy8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignLCcpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBwYXJlbnRUYWJsZSwgY2hpbGRUYWJsZTtcbiAgICBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMF0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzFdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMV0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzBdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudENoaWxkVGFibGUgbm90IHNldCB1cCBwcm9wZXJseWApO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGlsZCBvZiBjaGlsZFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgcGFyZW50ID0gYXdhaXQgcGFyZW50VGFibGUuZ2V0SXRlbShjaGlsZC5wYXJlbnRJbmRleCk7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogW3BhcmVudCwgY2hpbGRdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQYXJlbnRDaGlsZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBQcm9qZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLnRhYmxlT3JkZXIgPSBvcHRpb25zLnRhYmxlT3JkZXI7XG4gICAgaWYgKCF0aGlzLnRhYmxlT3JkZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGVPcmRlciBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVPcmRlci5tYXAodGFibGVJZCA9PiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnRhYmxlT3JkZXJcbiAgICAgIC5tYXAodGFibGVJZCA9PiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5nZXRTb3J0SGFzaCgpKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IGZpcnN0VGFibGUgPSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlT3JkZXJbMF1dO1xuICAgIGNvbnN0IHJlbWFpbmluZ0lkcyA9IHRoaXMudGFibGVPcmRlci5zbGljZSgxKTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZUl0ZW0gb2YgZmlyc3RUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbGFzdEl0ZW0gb2Ygc291cmNlSXRlbS5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nSWRzKSkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXg6IHNvdXJjZUl0ZW0uaW5kZXggKyAn4qivJyArIGxhc3RJdGVtLmluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbc291cmNlSXRlbSwgbGFzdEl0ZW1dXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgc2VsZi5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFByb2plY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCwgJ0dlbmVyaWNDbGFzcycpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC5vcHRpbWl6ZVRhYmxlcygpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gICogZWRnZUNsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBnZXRFZGdlUm9sZSAoZWRnZUNsYXNzKSB7XG4gICAgaWYgKCF0aGlzLmVkZ2VDbGFzc0lkc1tlZGdlQ2xhc3MuY2xhc3NJZF0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgcmV0dXJuICdib3RoJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc291cmNlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIHJldHVybiAndGFyZ2V0JztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBtaXNtYXRjaCBiZXR3ZWVuIG5vZGUgYW5kIGVkZ2UgY2xhc3NJZHNgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5wcm9tb3RlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBjb25uZWN0VG9DaGlsZE5vZGVDbGFzcyAoY2hpbGRDbGFzcykge1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpcy50YWJsZS5jb25uZWN0KFtjaGlsZENsYXNzLnRhYmxlXSwgJ1BhcmVudENoaWxkVGFibGUnKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzOiBbXSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IGNoaWxkQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzOiBbXVxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgY2hpbGRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlKSwgJ05vZGVDbGFzcycpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKSwgJ05vZGVDbGFzcycpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHByb2plY3ROZXdFZGdlIChjbGFzc0lkTGlzdCkge1xuICAgIGNvbnN0IGNsYXNzTGlzdCA9IFt0aGlzXS5jb25jYXQoY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KSk7XG4gICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPCAzIHx8IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0udHlwZSAhPT0gJ05vZGUnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2xhc3NJZExpc3RgKTtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlQ2xhc3NJZCA9IHRoaXMuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzc0lkID0gY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5jbGFzc0lkO1xuICAgIGxldCB0YWJsZU9yZGVyID0gW107XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjbGFzc0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGNsYXNzT2JqID0gY2xhc3NMaXN0W2ldO1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlZGdlUm9sZSA9IGNsYXNzTGlzdFtpIC0gMV0uZ2V0RWRnZVJvbGUoY2xhc3NPYmopO1xuICAgICAgICBpZiAoZWRnZVJvbGUgPT09ICdzb3VyY2UnIHx8IGVkZ2VSb2xlID09PSAnYm90aCcpIHtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoXG4gICAgICAgICAgICBBcnJheS5mcm9tKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCkpO1xuICAgICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLnRhYmxlLnByb2plY3QodGFibGVPcmRlcik7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICByZXR1cm4gbmV3Q2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBub2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fFxuICAgICAgKCh0aGlzLnNvdXJjZUNsYXNzICYmIHRoaXMuc291cmNlQ2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpICtcbiAgICAgICctJyArXG4gICAgICAoKHRoaXMudGFyZ2V0Q2xhc3MgJiYgdGhpcy50YXJnZXRDbGFzcy5jbGFzc05hbWUpIHx8ICc/Jyk7XG4gIH1cbiAgZ2V0IHNvdXJjZUNsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBnZXQgdGFyZ2V0Q2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy50YXJnZXRDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlVGFibGVJZHMgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBFZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfc3BsaXRUYWJsZUlkTGlzdCAodGFibGVJZExpc3QsIG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZVRhYmxlSWRMaXN0OiBbXSxcbiAgICAgIGVkZ2VUYWJsZUlkOiBudWxsLFxuICAgICAgZWRnZVRhYmxlSWRMaXN0OiBbXVxuICAgIH07XG4gICAgaWYgKHRhYmxlSWRMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKS50YWJsZUlkO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZSBhcyB0aGUgbmV3IGVkZ2UgdGFibGU7IHByaW9yaXRpemVcbiAgICAgIC8vIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGxldCB0YWJsZURpc3RhbmNlcyA9IHRhYmxlSWRMaXN0Lm1hcCgodGFibGVJZCwgaW5kZXgpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlSWQsIGluZGV4LCBkaXN0OiBNYXRoLmFicyh0YWJsZUlkTGlzdCAvIDIgLSBpbmRleCkgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICB0YWJsZURpc3RhbmNlcyA9IHRhYmxlRGlzdGFuY2VzLmZpbHRlcigoeyB0YWJsZUlkIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGVtcC5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAuc291cmNlVGFibGVJZHMsIHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAudGFyZ2V0VGFibGVJZHMsIHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5zaWRlID09PSAnc291cmNlJykge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5zaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtvcHRpb25zLnNpZGV9XCIgaXMgYW4gaW52YWxpZCBzaWRlYCk7XG4gICAgfVxuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLnByb21vdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5wcm9tb3RlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkICYmIHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgcmV0dXJuIHN1cGVyLnByb21vdGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6ICdOb2RlQ2xhc3MnXG4gICAgICB9KTtcbiAgICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgbm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICAgIHNpZGU6ICF0aGlzLnNvdXJjZUNsYXNzSWQgPyAnc291cmNlJyA6ICd0YXJnZXQnLFxuICAgICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBhdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgICB9XG4gIH1cbiAgY29ubmVjdEZhY2V0ZWRDbGFzcyAobmV3RWRnZUNsYXNzKSB7XG4gICAgLy8gV2hlbiBhbiBlZGdlIGNsYXNzIGlzIGZhY2V0ZWQsIHdlIHdhbnQgdG8ga2VlcCB0aGUgc2FtZSBjb25uZWN0aW9ucy4gVGhpc1xuICAgIC8vIG1lYW5zIHdlIG5lZWQgdG8gY2xvbmUgZWFjaCB0YWJsZSBjaGFpbiwgYW5kIGFkZCBvdXIgb3duIHRhYmxlIHRvIGl0XG4gICAgLy8gKGJlY2F1c2Ugb3VyIHRhYmxlIGlzIHRoZSBwYXJlbnRUYWJsZSBvZiB0aGUgbmV3IG9uZSlcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMudW5zaGlmdCh0aGlzLnRhYmxlSWQpO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMudGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgY29uc3QgbmV3Q2xhc3NlcyA9IHN1cGVyLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKTtcbiAgICBmb3IgKGNvbnN0IG5ld0NsYXNzIG9mIG5ld0NsYXNzZXMpIHtcbiAgICAgIHRoaXMuY29ubmVjdEZhY2V0ZWRDbGFzcyhuZXdDbGFzcyk7XG4gICAgfVxuICAgIHJldHVybiBuZXdDbGFzc2VzO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld0NsYXNzIG9mIHN1cGVyLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgICAgeWllbGQgbmV3Q2xhc3M7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiY2xhc3MgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGJ1aWxkUm93IChpdGVtKSB7XG4gICAgY29uc3Qgcm93ID0ge307XG4gICAgZm9yIChsZXQgYXR0ciBpbiBpdGVtLnJvdykge1xuICAgICAgcm93W2F0dHJdID0gYXdhaXQgaXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIHJldHVybiByb3c7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZpbGVGb3JtYXQ7XG4iLCJjbGFzcyBQYXJzZUZhaWx1cmUgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yIChmaWxlRm9ybWF0KSB7XG4gICAgc3VwZXIoYEZhaWxlZCB0byBwYXJzZSBmb3JtYXQ6ICR7ZmlsZUZvcm1hdC5jb25zdHJ1Y3Rvci5uYW1lfWApO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQYXJzZUZhaWx1cmU7XG4iLCJpbXBvcnQgRmlsZUZvcm1hdCBmcm9tICcuL0ZpbGVGb3JtYXQuanMnO1xuaW1wb3J0IFBhcnNlRmFpbHVyZSBmcm9tICcuL1BhcnNlRmFpbHVyZS5qcyc7XG5cbmNvbnN0IE5PREVfTkFNRVMgPSBbJ25vZGVzJywgJ05vZGVzJ107XG5jb25zdCBFREdFX05BTUVTID0gWydlZGdlcycsICdsaW5rcycsICdFZGdlcycsICdMaW5rcyddO1xuXG5jbGFzcyBEM0pzb24gZXh0ZW5kcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgaW1wb3J0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIHRleHQsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc291cmNlQXR0cmlidXRlID0gJ3NvdXJjZScsXG4gICAgdGFyZ2V0QXR0cmlidXRlID0gJ3RhcmdldCcsXG4gICAgY2xhc3NBdHRyaWJ1dGUgPSBudWxsXG4gIH0pIHtcbiAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZSh0ZXh0KTtcbiAgICBjb25zdCBub2RlTmFtZSA9IE5PREVfTkFNRVMuZmluZChuYW1lID0+IGRhdGFbbmFtZV0gaW5zdGFuY2VvZiBBcnJheSk7XG4gICAgY29uc3QgZWRnZU5hbWUgPSBFREdFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGlmICghbm9kZU5hbWUgfHwgIWVkZ2VOYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgUGFyc2VGYWlsdXJlKHRoaXMpO1xuICAgIH1cblxuICAgIGNvbnN0IGNvcmVUYWJsZSA9IG1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdTdGF0aWNEaWN0VGFibGUnLFxuICAgICAgbmFtZTogJ2NvcmVUYWJsZScsXG4gICAgICBkYXRhOiBkYXRhXG4gICAgfSk7XG4gICAgY29uc3QgY29yZUNsYXNzID0gbW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb3JlVGFibGUudGFibGVJZFxuICAgIH0pO1xuICAgIGxldCBbbm9kZXMsIGVkZ2VzXSA9IGNvcmVDbGFzcy5jbG9zZWRUcmFuc3Bvc2UoW25vZGVOYW1lLCBlZGdlTmFtZV0pO1xuXG4gICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICBpZiAobm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGltcG9ydCBjbGFzc2VzIGZyb20gRDMtc3R5bGUgSlNPTiB3aXRob3V0IG5vZGVBdHRyaWJ1dGVgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5vZGVDbGFzc2VzID0gW107XG4gICAgICBjb25zdCBub2RlQ2xhc3NMb29rdXAgPSB7fTtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGVDbGFzcyBvZiBub2Rlcy5vcGVuRmFjZXQoY2xhc3NBdHRyaWJ1dGUpKSB7XG4gICAgICAgIG5vZGVDbGFzc0xvb2t1cFtub2RlQ2xhc3MuY2xhc3NOYW1lXSA9IG5vZGVDbGFzc2VzLmxlbmd0aDtcbiAgICAgICAgbm9kZUNsYXNzZXMucHVzaChub2RlQ2xhc3MuaW50ZXJwcmV0QXNOb2RlcygpKTtcbiAgICAgIH1cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VzLm9wZW5GYWNldChjbGFzc0F0dHJpYnV0ZSkpIHtcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChlZGdlQ2xhc3MuaW50ZXJwcmV0QXNFZGdlcygpKTtcbiAgICAgICAgY29uc3Qgc2FtcGxlID0gYXdhaXQgZWRnZUNsYXNzLnRhYmxlLmdldEl0ZW0oKTtcbiAgICAgICAgY29uc3Qgc291cmNlQ2xhc3NOYW1lID0gc2FtcGxlLnJvd1tzb3VyY2VBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV07XG4gICAgICAgIGlmIChub2RlQ2xhc3NMb29rdXBbc291cmNlQ2xhc3NOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgICAgICBub2RlQ2xhc3M6IG5vZGVDbGFzc2VzW25vZGVDbGFzc0xvb2t1cFtzb3VyY2VDbGFzc05hbWVdXSxcbiAgICAgICAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHNvdXJjZUF0dHJpYnV0ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRhcmdldENsYXNzTmFtZSA9IHNhbXBsZS5yb3dbdGFyZ2V0QXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdO1xuICAgICAgICBpZiAobm9kZUNsYXNzTG9va3VwW3RhcmdldENsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICAgICAgbm9kZUNsYXNzOiBub2RlQ2xhc3Nlc1tub2RlQ2xhc3NMb29rdXBbdGFyZ2V0Q2xhc3NOYW1lXV0sXG4gICAgICAgICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgICAgICBlZGdlQXR0cmlidXRlOiB0YXJnZXRBdHRyaWJ1dGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBub2RlcyA9IG5vZGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICAgIG5vZGVzLnNldENsYXNzTmFtZShub2RlTmFtZSk7XG4gICAgICBlZGdlcyA9IGVkZ2VzLmludGVycHJldEFzRWRnZXMoKTtcbiAgICAgIGVkZ2VzLnNldENsYXNzTmFtZShlZGdlTmFtZSk7XG4gICAgICBub2Rlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogc291cmNlQXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIG5vZGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICAgIGVkZ2VDbGFzczogZWRnZXMsXG4gICAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiB0YXJnZXRBdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBhc3luYyBmb3JtYXREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgaW5jbHVkZUNsYXNzZXMgPSBPYmplY3QudmFsdWVzKG1vZGVsLmNsYXNzZXMpLFxuICAgIHByZXR0eSA9IHRydWUsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc291cmNlQXR0cmlidXRlID0gJ3NvdXJjZScsXG4gICAgdGFyZ2V0QXR0cmlidXRlID0gJ3RhcmdldCcsXG4gICAgY2xhc3NBdHRyaWJ1dGUgPSBudWxsXG4gIH0pIHtcbiAgICBpZiAoY2xhc3NBdHRyaWJ1dGUgJiYgIW5vZGVBdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZXhwb3J0IEQzLXN0eWxlIEpTT04gd2l0aCBjbGFzc2VzLCB3aXRob3V0IGEgbm9kZUF0dHJpYnV0ZWApO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCBub2RlTG9va3VwID0ge307XG4gICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IHJlc3VsdC5vdGhlciB8fCBbXTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIHJlc3VsdC5vdGhlci5wdXNoKGF3YWl0IHRoaXMuYnVpbGRSb3coaXRlbSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2Ygbm9kZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBub2RlTG9va3VwW25vZGUuZXhwb3J0SWRdID0gcmVzdWx0Lm5vZGVzLmxlbmd0aDtcbiAgICAgICAgY29uc3Qgcm93ID0gYXdhaXQgdGhpcy5idWlsZFJvdyhub2RlKTtcbiAgICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbbm9kZUF0dHJpYnV0ZV0gPSBub2RlLmV4cG9ydElkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgIHJvd1tjbGFzc0F0dHJpYnV0ZV0gPSBub2RlLmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQubm9kZXMucHVzaChyb3cpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGVkZ2VDbGFzcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgY29uc3Qgcm93ID0gYXdhaXQgdGhpcy5idWlsZFJvdyhlZGdlKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2Rlcyh7IGNsYXNzZXM6IG5vZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgcm93W3NvdXJjZUF0dHJpYnV0ZV0gPSBub2RlQXR0cmlidXRlID8gc291cmNlLmV4cG9ydElkIDogbm9kZUxvb2t1cFtzb3VyY2UuZXhwb3J0SWRdO1xuICAgICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgcm93W3NvdXJjZUF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXSA9IHNvdXJjZS5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIGVkZ2UudGFyZ2V0Tm9kZXMoeyBjbGFzc2VzOiBub2RlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgICAgcm93W3RhcmdldEF0dHJpYnV0ZV0gPSBub2RlQXR0cmlidXRlID8gdGFyZ2V0LmV4cG9ydElkIDogbm9kZUxvb2t1cFt0YXJnZXQuZXhwb3J0SWRdO1xuICAgICAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgIHJvd1t0YXJnZXRBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV0gPSB0YXJnZXQuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LmxpbmtzLnB1c2goT2JqZWN0LmFzc2lnbih7fSwgcm93KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcmV0dHkpIHtcbiAgICAgIHJlc3VsdC5ub2RlcyA9ICcgIFwibm9kZXNcIjogW1xcbiAgICAnICsgcmVzdWx0Lm5vZGVzLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIHJlc3VsdC5saW5rcyA9ICcgIFwibGlua3NcIjogW1xcbiAgICAnICsgcmVzdWx0LmxpbmtzLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIGlmIChyZXN1bHQub3RoZXIpIHtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gJyxcXG4gIFwib3RoZXJcIjogW1xcbiAgICAnICsgcmVzdWx0Lm90aGVyLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gYHtcXG4ke3Jlc3VsdC5ub2Rlc30sXFxuJHtyZXN1bHQubGlua3N9JHtyZXN1bHQub3RoZXIgfHwgJyd9XFxufVxcbmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHJlc3VsdCk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTp0ZXh0L2pzb247YmFzZTY0LCcgKyBCdWZmZXIuZnJvbShyZXN1bHQpLnRvU3RyaW5nKCdiYXNlNjQnKSxcbiAgICAgIHR5cGU6ICd0ZXh0L2pzb24nLFxuICAgICAgZXh0ZW5zaW9uOiAnanNvbidcbiAgICB9O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgRDNKc29uKCk7XG4iLCJpbXBvcnQgRmlsZUZvcm1hdCBmcm9tICcuL0ZpbGVGb3JtYXQuanMnO1xuaW1wb3J0IEpTWmlwIGZyb20gJ2pzemlwJztcblxuY2xhc3MgQ3N2WmlwIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBhc3luYyBmb3JtYXREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgaW5jbHVkZUNsYXNzZXMgPSBPYmplY3QudmFsdWVzKG1vZGVsLmNsYXNzZXMpLFxuICAgIGluZGV4TmFtZSA9ICdpbmRleCdcbiAgfSkge1xuICAgIGNvbnN0IHppcCA9IG5ldyBKU1ppcCgpO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgY29uc3QgYXR0cmlidXRlcyA9IGNsYXNzT2JqLnRhYmxlLmF0dHJpYnV0ZXM7XG4gICAgICBsZXQgY29udGVudHMgPSBgJHtpbmRleE5hbWV9LCR7YXR0cmlidXRlcy5qb2luKCcsJyl9XFxuYDtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgY29uc3Qgcm93ID0gYXR0cmlidXRlcy5tYXAoYXR0ciA9PiBpdGVtLnJvd1thdHRyXSk7XG4gICAgICAgIGNvbnRlbnRzICs9IGAke2l0ZW0uaW5kZXh9LCR7cm93LmpvaW4oJywnKX1cXG5gO1xuICAgICAgfVxuICAgICAgemlwLmZpbGUoY2xhc3NPYmouY2xhc3NOYW1lICsgJy5jc3YnLCBjb250ZW50cyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOmFwcGxpY2F0aW9uL3ppcDtiYXNlNjQsJyArIGF3YWl0IHppcC5nZW5lcmF0ZUFzeW5jKHsgdHlwZTogJ2Jhc2U2NCcgfSksXG4gICAgICB0eXBlOiAnYXBwbGljYXRpb24vemlwJyxcbiAgICAgIGV4dGVuc2lvbjogJ3ppcCdcbiAgICB9O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgQ3N2WmlwKCk7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcblxuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4uL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgRklMRV9GT1JNQVRTIGZyb20gJy4uL0ZpbGVGb3JtYXRzL0ZpbGVGb3JtYXRzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3Rzdidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBpZiAodGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5jbGFzc09iaiAmJiAhb3B0aW9ucy5vdmVyd3JpdGUpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIGZpbmRDbGFzcyAoY2xhc3NOYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lKTtcbiAgfVxuICByZW5hbWUgKG5ld05hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYW5ub3RhdGUgKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuX29yaWdyYXBoLmRlbGV0ZU1vZGVsKHRoaXMubW9kZWxJZCk7XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5tb2RlbHNbdGhpcy5tb2RlbElkXTtcbiAgfVxuICBhc3luYyBhZGRUZXh0RmlsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5mb3JtYXQpIHtcbiAgICAgIG9wdGlvbnMuZm9ybWF0ID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAob3B0aW9ucy5uYW1lKSk7XG4gICAgfVxuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmltcG9ydERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLmRhdGEgPSBkYXRhbGliLnJlYWQob3B0aW9ucy50ZXh0LCB7IHR5cGU6IG9wdGlvbnMuZm9ybWF0IH0pO1xuICAgICAgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnY3N2JyB8fCBvcHRpb25zLmZvcm1hdCA9PT0gJ3RzdicpIHtcbiAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBvcHRpb25zLmRhdGEuY29sdW1ucykge1xuICAgICAgICAgIG9wdGlvbnMuYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9wdGlvbnMuZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uZm9ybWF0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmF3ICR7b3B0aW9ucy5mb3JtYXR9IGV4cG9ydCBub3QgeWV0IHN1cHBvcnRlZGApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCB1bmtub3duIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIG9wdGltaXplVGFibGVzICgpIHtcbiAgICBjb25zdCB0YWJsZXNJblVzZSA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICB0YWJsZXNJblVzZVtjbGFzc09iai50YWJsZUlkXSA9IHRydWU7XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NPYmouc291cmNlVGFibGVJZHMgfHwgW10pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzIHx8IFtdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgcGFyZW50c1Zpc2l0ZWQgPSB7fTtcbiAgICBjb25zdCBxdWV1ZSA9IE9iamVjdC5rZXlzKHRhYmxlc0luVXNlKTtcbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgdGFibGVJZCA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICBpZiAoIXBhcmVudHNWaXNpdGVkW3RhYmxlSWRdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgICAgcGFyZW50c1Zpc2l0ZWRbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgICBjb25zdCB0YWJsZSA9IHRoaXMudGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICAgIHF1ZXVlLnB1c2gocGFyZW50VGFibGUudGFibGVJZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRoaXMudGFibGVzKSkge1xuICAgICAgY29uc3QgdGFibGUgPSB0aGlzLnRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIGlmICghdGFibGVzSW5Vc2VbdGFibGVJZF0gJiYgdGFibGUudHlwZSAhPT0gJ1N0YXRpYycgJiYgdGFibGUudHlwZSAhPT0gJ1N0YXRpY0RpY3QnKSB7XG4gICAgICAgIHRhYmxlLmRlbGV0ZSh0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVE9ETzogSWYgYW55IER1cGxpY2F0ZWRUYWJsZSBpcyBpbiB1c2UsIGJ1dCB0aGUgb3JpZ2luYWwgaXNuJ3QsIHN3YXAgZm9yIHRoZSByZWFsIG9uZVxuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlSWRMaXN0KSB7XG4gICAgaWYgKCFpbnN0YW5jZUlkTGlzdCkge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZUlkTGlzdCA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSg1KSkge1xuICAgICAgICAgICAgaW5zdGFuY2VJZExpc3QucHVzaChpdGVtLmluc3RhbmNlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEdldCB0aGUgc3BlY2lmaWVkIGl0ZW1zXG4gICAgY29uc3Qgbm9kZUluc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IGVkZ2VJbnN0YW5jZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlSWQgb2YgaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIGNvbnN0IHsgY2xhc3NJZCwgaW5kZXggfSA9IEpTT04ucGFyc2UoaW5zdGFuY2VJZCk7XG4gICAgICBjb25zdCBpbnN0YW5jZSA9IGF3YWl0IHRoaXMuY2xhc3Nlc1tjbGFzc0lkXS50YWJsZS5nZXRJdGVtKGluZGV4KTtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBBZGQgYW55IG5vZGVzIGNvbm5lY3RlZCB0byBvdXIgZWRnZXNcbiAgICBjb25zdCBleHRyYU5vZGVzID0ge307XG4gICAgZm9yIChjb25zdCBlZGdlSWQgaW4gZWRnZUluc3RhbmNlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2VJbnN0YW5jZXNbZWRnZUlkXS5ub2RlcygpKSB7XG4gICAgICAgIGlmICghbm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgZXh0cmFOb2Rlc1tub2RlLmluc3RhbmNlSWRdID0gbm9kZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgY29ubmVjdCBvdXIgbm9kZXNcbiAgICBjb25zdCBleHRyYUVkZ2VzID0ge307XG4gICAgZm9yIChjb25zdCBub2RlSWQgaW4gbm9kZUluc3RhbmNlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGVJbnN0YW5jZXNbbm9kZUlkXS5lZGdlcygpKSB7XG4gICAgICAgIGlmICghZWRnZUluc3RhbmNlc1tlZGdlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgdGhhdCBib3RoIGVuZHMgb2YgdGhlIGVkZ2UgY29ubmVjdCBhdCBsZWFzdCBvbmVcbiAgICAgICAgICAvLyBvZiBvdXIgbm9kZXNcbiAgICAgICAgICBsZXQgY29ubmVjdHNTb3VyY2UgPSBmYWxzZTtcbiAgICAgICAgICBsZXQgY29ubmVjdHNUYXJnZXQgPSBmYWxzZTtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAobm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNUYXJnZXQgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvbm5lY3RzU291cmNlICYmIGNvbm5lY3RzVGFyZ2V0KSB7XG4gICAgICAgICAgICBleHRyYUVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0gPSBlZGdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE9rYXksIG5vdyB3ZSBoYXZlIGEgY29tcGxldGUgc2V0IG9mIG5vZGVzIGFuZCBlZGdlcyB0aGF0IHdlIHdhbnQgdG9cbiAgICAvLyBpbmNsdWRlOyBjcmVhdGUgcGFpcndpc2UgZWRnZSBlbnRyaWVzIGZvciBldmVyeSBjb25uZWN0aW9uXG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXVxuICAgIH07XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBub2RlcywgYW5kIHBvcHVsYXRlIGEgbG9va3VwIGZvciB3aGVyZSB0aGV5IGFyZSBpbiB0aGUgbGlzdFxuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVJbnN0YW5jZXMpLmNvbmNhdChPYmplY3QudmFsdWVzKGV4dHJhTm9kZXMpKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgubm9kZXMucHVzaCh7XG4gICAgICAgIG5vZGVJbnN0YW5jZTogbm9kZSxcbiAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBlZGdlcy4uLlxuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VJbnN0YW5jZXMpLmNvbmNhdChPYmplY3QudmFsdWVzKGV4dHJhRWRnZXMpKSkge1xuICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICAvLyBNaXNzaW5nIGJvdGggc291cmNlIGFuZCB0YXJnZXQgY2xhc3NlczsgYWRkIGR1bW15IG5vZGVzIGZvciBib3RoIGVuZHNcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBBZGQgZHVtbXkgc291cmNlIG5vZGVzXG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIC8vIEFkZCBkdW1teSB0YXJnZXQgbm9kZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZXJlIHNob3VsZCBiZSBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vZGVzIGZvciBlYWNoIGVkZ2VcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2VOb2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXROb2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TmV0d29ya01vZGVsR3JhcGggKHtcbiAgICByYXcgPSB0cnVlLFxuICAgIGluY2x1ZGVEdW1taWVzID0gZmFsc2UsXG4gICAgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBjb25zdCBjbGFzc1NwZWMgPSByYXcgPyBjbGFzc09iai5fdG9SYXdPYmplY3QoKSA6IHsgY2xhc3NPYmogfTtcbiAgICAgIGNsYXNzU3BlYy50eXBlID0gY2xhc3NPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLmNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gZ3JhcGguY2xhc3Nlcy5sZW5ndGg7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoIC0gMSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBmYWxzZSxcbiAgICAgICAgICBsb2NhdGlvbjogJ25vZGUnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgZXhpc3RpbmcgY2xhc3NDb25uZWN0aW9uc1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIGVkZ2VDbGFzc2VzKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkXSxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldFRhYmxlRGVwZW5kZW5jeUdyYXBoICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIHRhYmxlczogW10sXG4gICAgICB0YWJsZUxvb2t1cDoge30sXG4gICAgICB0YWJsZUxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3QgdGFibGVMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcyk7XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGNvbnN0IHRhYmxlU3BlYyA9IHRhYmxlLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVTcGVjLnR5cGUgPSB0YWJsZS5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBncmFwaC50YWJsZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgudGFibGVzLnB1c2godGFibGVTcGVjKTtcbiAgICB9XG4gICAgLy8gRmlsbCB0aGUgZ3JhcGggd2l0aCBsaW5rcyBiYXNlZCBvbiBwYXJlbnRUYWJsZXMuLi5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgZ3JhcGgudGFibGVMaW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLnRhYmxlTG9va3VwW3BhcmVudFRhYmxlLnRhYmxlSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGgudGFibGVMb29rdXBbdGFibGUudGFibGVJZF1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRNb2RlbER1bXAgKCkge1xuICAgIC8vIEJlY2F1c2Ugb2JqZWN0IGtleSBvcmRlcnMgYXJlbid0IGRldGVybWluaXN0aWMsIGl0IGNhbiBiZSBwcm9ibGVtYXRpY1xuICAgIC8vIGZvciB0ZXN0aW5nIChiZWNhdXNlIGlkcyBjYW4gcmFuZG9tbHkgY2hhbmdlIGZyb20gdGVzdCBydW4gdG8gdGVzdCBydW4pLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc29ydHMgZWFjaCBrZXksIGFuZCBqdXN0IHJlcGxhY2VzIElEcyB3aXRoIGluZGV4IG51bWJlcnNcbiAgICBjb25zdCByYXdPYmogPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RvUmF3T2JqZWN0KCkpKTtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBjbGFzc2VzOiBPYmplY3QudmFsdWVzKHJhd09iai5jbGFzc2VzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy5jbGFzc2VzW2EuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLmNsYXNzZXNbYi5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzcyBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgICAgIHRhYmxlczogT2JqZWN0LnZhbHVlcyhyYXdPYmoudGFibGVzKS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGFIYXNoID0gdGhpcy50YWJsZXNbYS50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMudGFibGVzW2IudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdGFibGUgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICAgIGNvbnN0IGNsYXNzTG9va3VwID0ge307XG4gICAgY29uc3QgdGFibGVMb29rdXAgPSB7fTtcbiAgICByZXN1bHQuY2xhc3Nlcy5mb3JFYWNoKChjbGFzc09iaiwgaW5kZXgpID0+IHtcbiAgICAgIGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdID0gaW5kZXg7XG4gICAgfSk7XG4gICAgcmVzdWx0LnRhYmxlcy5mb3JFYWNoKCh0YWJsZSwgaW5kZXgpID0+IHtcbiAgICAgIHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gaW5kZXg7XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHJlc3VsdC50YWJsZXMpIHtcbiAgICAgIHRhYmxlLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXTtcbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKSkge1xuICAgICAgICB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlTG9va3VwW3RhYmxlSWRdXSA9IHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICAgIGRlbGV0ZSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRhYmxlLmRhdGE7IC8vIGRvbid0IGluY2x1ZGUgYW55IG9mIHRoZSBkYXRhOyB3ZSBqdXN0IHdhbnQgdGhlIG1vZGVsIHN0cnVjdHVyZVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIHJlc3VsdC5jbGFzc2VzKSB7XG4gICAgICBjbGFzc09iai5jbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF07XG4gICAgICBjbGFzc09iai50YWJsZUlkID0gdGFibGVMb29rdXBbY2xhc3NPYmoudGFibGVJZF07XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmouc291cmNlQ2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmouc291cmNlVGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMgPSBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICBjbGFzc09iai50YXJnZXRDbGFzc0lkID0gY2xhc3NMb29rdXBbY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF07XG4gICAgICB9XG4gICAgICBpZiAoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMgPSBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5tYXAodGFibGVJZCA9PiB0YWJsZUxvb2t1cFt0YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzSWQgb2YgT2JqZWN0LmtleXMoY2xhc3NPYmouZWRnZUNsYXNzSWRzIHx8IHt9KSkge1xuICAgICAgICBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NMb29rdXBbY2xhc3NJZF1dID0gY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgICBkZWxldGUgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzSWRdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGNyZWF0ZVNjaGVtYU1vZGVsICgpIHtcbiAgICBjb25zdCBncmFwaCA9IHRoaXMuZ2V0TW9kZWxEdW1wKCk7XG5cbiAgICBncmFwaC50YWJsZXMuZm9yRWFjaCh0YWJsZSA9PiB7XG4gICAgICB0YWJsZS5kZXJpdmVkVGFibGVzID0gT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcyk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGNvbnN0IHJhdyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLFxuICAgICAgbmFtZTogJ1JhdyBEdW1wJ1xuICAgIH0pO1xuICAgIGxldCBbIGNsYXNzZXMsIHRhYmxlcyBdID0gcmF3LmNsb3NlZFRyYW5zcG9zZShbJ2NsYXNzZXMnLCAndGFibGVzJ10pO1xuICAgIGNsYXNzZXMgPSBjbGFzc2VzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBjbGFzc2VzLnNldENsYXNzTmFtZSgnQ2xhc3NlcycpO1xuICAgIHJhdy5kZWxldGUoKTtcblxuICAgIGNvbnN0IHNvdXJjZUNsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3NvdXJjZUNsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBzb3VyY2VDbGFzc2VzLnNldENsYXNzTmFtZSgnU291cmNlIENsYXNzJyk7XG4gICAgc291cmNlQ2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcbiAgICBjb25zdCB0YXJnZXRDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YXJnZXRDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1RhcmdldCBDbGFzcycpO1xuICAgIHRhcmdldENsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICB0YWJsZXMgPSB0YWJsZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIHRhYmxlcy5zZXRDbGFzc05hbWUoJ1RhYmxlcycpO1xuXG4gICAgY29uc3QgdGFibGVEZXBlbmRlbmNpZXMgPSB0YWJsZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdkZXJpdmVkVGFibGVzJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMuc2V0Q2xhc3NOYW1lKCdJcyBQYXJlbnQgT2YnKTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIGNvbnN0IGNvcmVUYWJsZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAndGFibGVJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIGNvcmVUYWJsZXMuc2V0Q2xhc3NOYW1lKCdDb3JlIFRhYmxlJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5sb2NhbFN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2U7IC8vIG9ubHkgZGVmaW5lZCBpbiB0aGUgYnJvd3NlciBjb250ZXh0XG5cbiAgICB0aGlzLnBsdWdpbnMgPSB7fTtcblxuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgbGV0IGV4aXN0aW5nTW9kZWxzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJyk7XG4gICAgaWYgKGV4aXN0aW5nTW9kZWxzKSB7XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXMoSlNPTi5wYXJzZShleGlzdGluZ01vZGVscykpKSB7XG4gICAgICAgIG1vZGVsLm9yaWdyYXBoID0gdGhpcztcbiAgICAgICAgdGhpcy5tb2RlbHNbbW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG1vZGVsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gIH1cbiAgcmVnaXN0ZXJQbHVnaW4gKG5hbWUsIHBsdWdpbikge1xuICAgIHRoaXMucGx1Z2luc1tuYW1lXSA9IHBsdWdpbjtcbiAgfVxuICBzYXZlICgpIHtcbiAgICAvKlxuICAgIGlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9XG4gICAgKi9cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgYXN5bmMgbG9hZE1vZGVsIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLmNyZWF0ZU1vZGVsKHsgbW9kZWxJZDogb3B0aW9ucy5uYW1lIH0pO1xuICAgIGF3YWl0IG5ld01vZGVsLmFkZFRleHRGaWxlKG9wdGlvbnMpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxuICBjcmVhdGVNb2RlbCAob3B0aW9ucyA9IHt9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLm1vZGVsSWQgfHwgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSkge1xuICAgICAgb3B0aW9ucy5tb2RlbElkID0gYG1vZGVsJHtORVhUX01PREVMX0lEfWA7XG4gICAgICBORVhUX01PREVMX0lEICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMub3JpZ3JhcGggPSB0aGlzO1xuICAgIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG9wdGlvbnMpO1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gb3B0aW9ucy5tb2RlbElkO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF07XG4gIH1cbiAgZGVsZXRlTW9kZWwgKG1vZGVsSWQgPSB0aGlzLmN1cnJlbnRNb2RlbElkKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsc1ttb2RlbElkXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgbm9uLWV4aXN0ZW50IG1vZGVsOiAke21vZGVsSWR9YCk7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsc1ttb2RlbElkXTtcbiAgICBpZiAodGhpcy5fY3VycmVudE1vZGVsSWQgPT09IG1vZGVsSWQpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgfVxuICAgIHRoaXMuc2F2ZSgpO1xuICB9XG4gIGRlbGV0ZUFsbE1vZGVscyAoKSB7XG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKHdpbmRvdy5sb2NhbFN0b3JhZ2UpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiZXZlbnQiLCJuYW1lc3BhY2UiLCJzcGxpdCIsInB1c2giLCJvZmYiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImhhbmRsZUNhbGxiYWNrIiwic2V0VGltZW91dCIsImFwcGx5IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkdlbmVyaWNXcmFwcGVyIiwib3B0aW9ucyIsInRhYmxlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJjbGFzc09iaiIsInJvdyIsImNvbm5lY3RlZEl0ZW1zIiwiZHVwbGljYXRlSXRlbXMiLCJyZWdpc3RlckR1cGxpY2F0ZSIsIml0ZW0iLCJjb25uZWN0SXRlbSIsInRhYmxlSWQiLCJkdXAiLCJkaXNjb25uZWN0IiwiaXRlbUxpc3QiLCJ2YWx1ZXMiLCJpbnN0YW5jZUlkIiwiY2xhc3NJZCIsImV4cG9ydElkIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwicmVzZXQiLCJuZXh0VGFibGVJZCIsImxlbmd0aCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsIml0ZW1zVG9SZXNldCIsImNvbmNhdCIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsIndyYXBwZWRJdGVtIiwiZGVsYXllZFJvdyIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJnZXRJdGVtIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJwcm9tb3RlIiwiZXhwYW5kIiwidW5yb2xsIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImR1cGxpY2F0ZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJwcm9qZWN0IiwidGFibGVPcmRlciIsIm90aGVyVGFibGVJZCIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZm9yY2UiLCJlcnIiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkF0dHJUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpbiIsIl9hdHRyaWJ1dGUiLCJQcm9tb3RlZFRhYmxlIiwiX3VuZmluaXNoZWRDYWNoZSIsIl91bmZpbmlzaGVkQ2FjaGVMb29rdXAiLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBUYWJsZSIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiRHVwbGljYXRlZFRhYmxlIiwiQ2hpbGRUYWJsZU1peGluIiwiX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW4iLCJwYXJlbnRJbmRleCIsIkV4cGFuZGVkVGFibGUiLCJVbnJvbGxlZFRhYmxlIiwicm93cyIsIlBhcmVudENoaWxkVGFibGUiLCJjaGlsZFRhYmxlIiwiY2hpbGQiLCJwYXJlbnQiLCJQcm9qZWN0ZWRUYWJsZSIsInNlbGYiLCJmaXJzdFRhYmxlIiwicmVtYWluaW5nSWRzIiwic291cmNlSXRlbSIsImxhc3RJdGVtIiwiR2VuZXJpY0NsYXNzIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwiaGFzQ3VzdG9tTmFtZSIsInZhcmlhYmxlTmFtZSIsImZpbHRlciIsImQiLCJ0b0xvY2FsZVVwcGVyQ2FzZSIsImRlbGV0ZWQiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwib3B0aW1pemVUYWJsZXMiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIiwiY2hpbGRDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJlZGdlUm9sZSIsIkFycmF5IiwiZnJvbSIsIm5ld0NsYXNzIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiTWF0aCIsImFicyIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIkZpbGVGb3JtYXQiLCJidWlsZFJvdyIsIlBhcnNlRmFpbHVyZSIsImZpbGVGb3JtYXQiLCJOT0RFX05BTUVTIiwiRURHRV9OQU1FUyIsIkQzSnNvbiIsImltcG9ydERhdGEiLCJ0ZXh0Iiwic291cmNlQXR0cmlidXRlIiwidGFyZ2V0QXR0cmlidXRlIiwiY2xhc3NBdHRyaWJ1dGUiLCJKU09OIiwicGFyc2UiLCJub2RlTmFtZSIsImVkZ2VOYW1lIiwiY29yZVRhYmxlIiwiY29yZUNsYXNzIiwibm9kZUNsYXNzZXMiLCJub2RlQ2xhc3NMb29rdXAiLCJzYW1wbGUiLCJzb3VyY2VDbGFzc05hbWUiLCJ0YXJnZXRDbGFzc05hbWUiLCJmb3JtYXREYXRhIiwiaW5jbHVkZUNsYXNzZXMiLCJwcmV0dHkiLCJsaW5rcyIsIm5vZGVMb29rdXAiLCJvdGhlciIsIm5vZGUiLCJlZGdlIiwic291cmNlIiwidGFyZ2V0Iiwic3RyaW5naWZ5IiwiQnVmZmVyIiwiZXh0ZW5zaW9uIiwiQ3N2WmlwIiwiaW5kZXhOYW1lIiwiemlwIiwiSlNaaXAiLCJjb250ZW50cyIsImZpbGUiLCJnZW5lcmF0ZUFzeW5jIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRUZXh0RmlsZSIsImZvcm1hdCIsIm1pbWUiLCJGSUxFX0ZPUk1BVFMiLCJkYXRhbGliIiwicmVhZCIsImNvbHVtbnMiLCJhZGRTdGF0aWNUYWJsZSIsInRhYmxlc0luVXNlIiwicGFyZW50c1Zpc2l0ZWQiLCJxdWV1ZSIsInNoaWZ0IiwiZ2V0SW5zdGFuY2VHcmFwaCIsImluc3RhbmNlSWRMaXN0Iiwibm9kZUluc3RhbmNlcyIsImVkZ2VJbnN0YW5jZXMiLCJpbnN0YW5jZSIsImV4dHJhTm9kZXMiLCJleHRyYUVkZ2VzIiwibm9kZUlkIiwiY29ubmVjdHNTb3VyY2UiLCJjb25uZWN0c1RhcmdldCIsImdyYXBoIiwibm9kZUluc3RhbmNlIiwiZHVtbXkiLCJlZGdlSW5zdGFuY2UiLCJzb3VyY2VOb2RlIiwidGFyZ2V0Tm9kZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRNb2RlbER1bXAiLCJyYXdPYmoiLCJhSGFzaCIsImJIYXNoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwic291cmNlQ2xhc3NlcyIsInRhcmdldENsYXNzZXMiLCJ0YWJsZURlcGVuZGVuY2llcyIsImNvcmVUYWJsZXMiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwibG9hZE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0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
