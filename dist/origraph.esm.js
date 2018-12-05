import mime from 'mime-types';
import datalib from 'datalib';

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

    for (const [attr, func] of Object.entries(this._attributeFilters)) {
      keep = keep && (await func((await wrappedItem.row[attr])));

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

  async getItem(index) {
    if (this._cacheLookup) {
      return this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && this._partialCacheLookup[index] !== undefined) {
      return this._partialCache[this._partialCacheLookup[index]];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses should override this


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

  addFilter(attribute, func) {
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

  delete() {
    if (this.inUse) {
      const err = new Error(`Can't delete in-use table ${this.tableId}`);
      err.inUse = true;
      throw err;
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
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
    return `[${this._value}]`;
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
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
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
  ParentChildTable: ParentChildTable
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
    const classList = classIdList.map(classId => {
      return this.model.classes[classId];
    });

    if (classList.length < 2 || classList[classList.length - 1].type !== 'Node') {
      throw new Error(`Invalid classIdList`);
    }

    const sourceClassId = this.classId;
    const targetClassId = classList[classList.length - 1].classId;
    const sourceTableIds = [];
    const targetTableIds = [];
    let tableId;
    const middleIndex = Math.floor((classList.length - 1) / 2);

    for (let i = 0; i < classList.length - 1; i++) {
      if (i < middleIndex) {
        if (classList[i].type === 'Node') {
          sourceTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }

          sourceTableIds.unshift(classList[i].tableId);

          for (const tableId of classList[i].targetTableIds) {
            sourceTableIds.unshift(tableId);
          }
        }
      } else if (i === middleIndex) {
        tableId = classList[i].table.duplicate().tableId;

        if (classList[i].type === 'Edge') {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            sourceTableIds.unshift(tableId);
          }

          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      } else {
        if (classList[i].type === 'Node') {
          targetTableIds.unshift(classList[i].tableId);
        } else {
          const temp = Array.from(classList[i].sourceTableIds).reverse();

          for (const tableId of temp) {
            targetTableIds.unshift(tableId);
          }

          targetTableIds.unshift(classList[i].tableId);

          for (const tableId of classList[i].targetTableIds) {
            targetTableIds.unshift(tableId);
          }
        }
      }
    }

    return this.model.createClass({
      type: 'EdgeClass',
      tableId,
      sourceClassId,
      targetClassId,
      sourceTableIds,
      targetTableIds
    });
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

class ParseFailure extends Error {
  constructor(fileFormat) {
    super(`Failed to parse format: ${fileFormat.constructor.name}`);
  }

}

const NODE_NAMES = ['nodes', 'Nodes'];
const EDGE_NAMES = ['edges', 'links', 'Edges', 'Links'];

class D3Json {
  async importData({
    model,
    text
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
    nodes = nodes.interpretAsNodes();
    nodes.setClassName(nodeName);
    edges = edges.interpretAsEdges();
    edges.setClassName(edgeName);
    coreClass.delete();
    nodes.connectToEdgeClass({
      edgeClass: edges,
      side: 'source',
      nodeAttribute: 'index',
      edgeAttribute: 'source'
    });
    nodes.connectToEdgeClass({
      edgeClass: edges,
      side: 'target',
      nodeAttribute: 'index',
      edgeAttribute: 'target'
    });
  }

  async exportData({
    model,
    excludeClasses = [],
    pretty = true
  }) {
    const result = {
      nodes: [],
      links: []
    };

    for (const classObj of Object.values(model.classes)) {
      if (excludeClasses.indexOf(classObj) === -1) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(classObj.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const item = _value;
            const row = {};

            for (const attr in item.row) {
              row[attr] = item.row[attr] instanceof Promise ? await item.row[attr] : item.row[attr];
            }

            if (item.type === 'Node') {
              row.index = item.exportId;
              result.nodes.push(row);
            } else if (item.type === 'Edge') {
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;

              var _iteratorError2;

              try {
                for (var _iterator2 = _asyncIterator(item.sourceNodes()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                  const source = _value2;
                  row.source = source.exportId;
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;

                  var _iteratorError3;

                  try {
                    for (var _iterator3 = _asyncIterator(item.targetNodes()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                      const target = _value3;
                      row.target = target.exportId;
                      result.links.push(Object.assign({}, row));
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
      }
    }

    if (pretty) {
      result.nodes = result.nodes.map(row => JSON.stringify(row)).join('    ,\n');
      result.links = result.links.map(row => JSON.stringify(row)).join('    ,\n');
      return `\
{
  "nodes": [
    ${result.nodes}
  ],
  "edges": [
    ${result.links}
  ]
}
`;
    } else {
      return JSON.stringify(result);
    }
  }

}

var D3Json$1 = new D3Json();



var FILE_FORMATS = /*#__PURE__*/Object.freeze({
  D3Json: D3Json$1
});

const DATALIB_FORMATS = {
  'json': 'json',
  'csv': 'csv',
  'tsv': 'tsv',
  'topojson': 'topojson',
  'treejson': 'treejson'
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

  async addTextFile({
    name,
    format,
    text
  }) {
    if (!format) {
      format = mime.extension(mime.lookup(name));
    }

    if (FILE_FORMATS[format]) {
      return FILE_FORMATS[format].importData({
        model: this,
        text
      });
    } else if (DATALIB_FORMATS[format]) {
      let data, attributes;
      data = datalib.read(text, {
        type: format
      });

      if (format === 'csv' || format === 'tsv') {
        attributes = {};

        for (const attr of data.columns) {
          attributes[attr] = true;
        }

        delete data.columns;
      }

      return this.addStaticTable({
        name,
        data,
        attributes
      });
    } else {
      throw new Error(`Unsupported file format: ${format}`);
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

  deleteAllUnusedTables() {
    for (const tableId in this.tables) {
      if (this.tables[tableId]) {
        try {
          this.tables[tableId].delete();
        } catch (err) {
          if (!err.inUse) {
            throw err;
          }
        }
      }
    }

    this.trigger('update');
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

  async loadModel({
    name,
    format,
    text
  }) {
    const newModel = this.createModel({
      modelId: name
    });
    await newModel.addTextFile({
      name,
      format,
      text
    });
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
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.2",
	filereader: "^0.10.3",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBlcXVhbHMgKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5pbnN0YW5jZUlkID09PSBpdGVtLmluc3RhbmNlSWQ7XG4gIH1cbiAgYXN5bmMgKiBoYW5kbGVMaW1pdCAob3B0aW9ucywgaXRlcmF0b3JzKSB7XG4gICAgbGV0IGxpbWl0ID0gSW5maW5pdHk7XG4gICAgaWYgKG9wdGlvbnMubGltaXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGltaXQgPSBvcHRpb25zLmxpbWl0O1xuICAgICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgfVxuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZXJhdG9yIG9mIGl0ZXJhdG9ycykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGl0ZXJhdG9yKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGl0ZW0gPT09IG51bGwgfHwgaSA+PSBsaW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICB9KSk7XG4gICAgeWllbGQgKiB0aGlzLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpO1xuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGhpcy5yZXNldCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBuZXh0VGFibGVJZCA9IHRhYmxlSWRzWzBdO1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbbmV4dFRhYmxlSWRdIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVtYWluaW5nVGFibGVJZHMgPSB0YWJsZUlkcy5zbGljZSgxKTtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSkge1xuICAgICAgICB5aWVsZCAqIGl0ZW0uX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdUYWJsZUlkcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleEZpbHRlciA9IChvcHRpb25zLmluZGV4RmlsdGVyICYmIHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX2xpbWl0UHJvbWlzZXMgPSB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlRmlsdGVyczoge30sXG4gICAgICBpbmRleEZpbHRlcjogKHRoaXMuX2luZGV4RmlsdGVyICYmIHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlO1xuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgcmV0dXJuIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBoYXMgYWxyZWFkeSBiZWVuIGJ1aWx0OyBqdXN0IGdyYWIgZGF0YSBmcm9tIGl0IGRpcmVjdGx5XG4gICAgICB5aWVsZCAqIHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZSAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID49IGxpbWl0KSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQsIGJ1dCBpdCdzIGFscmVhZHkgbG9uZyBlbm91Z2ggdG8gc2F0aXNmeSB0aGlzXG4gICAgICAvLyByZXF1ZXN0XG4gICAgICB5aWVsZCAqIHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCBidWlsZGluZyAoYW5kIG1heWJlIGRpZG4ndCBldmVuIHN0YXJ0IHlldCk7XG4gICAgICAvLyBraWNrIGl0IG9mZiwgYW5kIHRoZW4gd2FpdCBmb3IgZW5vdWdoIGl0ZW1zIHRvIGJlIHByb2Nlc3NlZCB0byBzYXRpc2Z5XG4gICAgICAvLyB0aGUgbGltaXRcbiAgICAgIHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgICAgeWllbGQgKiBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdID0gdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0gfHwgW107XG4gICAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnB1c2goeyByZXNvbHZlLCByZWplY3QgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBUaGUgc2V0VGltZW91dCBoZXJlIGlzIGFic29sdXRlbHkgbmVjZXNzYXJ5LCBvciB0aGlzLl9jYWNoZVByb21pc2VcbiAgICAgICAgLy8gd29uJ3QgYmUgc3RvcmVkIGluIHRpbWUgZm9yIHRoZSBuZXh0IGJ1aWxkQ2FjaGUoKSBjYWxsIHRoYXQgY29tZXNcbiAgICAgICAgLy8gdGhyb3VnaFxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9idWlsZENhY2hlKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGNvbnN0IGl0ZW1zVG9SZXNldCA9ICh0aGlzLl9jYWNoZSB8fCBbXSlcbiAgICAgIC5jb25jYXQodGhpcy5fcGFydGlhbENhY2hlIHx8IFtdKTtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXNUb1Jlc2V0KSB7XG4gICAgICBpdGVtLnJlc2V0ID0gdHJ1ZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgaGFuZGxlUmVzZXQgKHJlamVjdCkge1xuICAgIGZvciAoY29uc3QgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdLnJlamVjdCgpO1xuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXM7XG4gICAgfVxuICAgIHJlamVjdCgpO1xuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGFzeW5jIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICh3cmFwcGVkSXRlbS5yb3dbYXR0cl0gaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgd3JhcHBlZEl0ZW0uZGVsYXllZFJvdyA9IHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgfHwge307XG4gICAgICAgICAgd3JhcHBlZEl0ZW0uZGVsYXllZFJvd1thdHRyXSA9IGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgYXdhaXQgZnVuYyhhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIC8vIEFsbG93IHByb2JpbmcgdG8gc2VlIHdoYXRldmVyIGRhdGEgaGFwcGVucyB0byBiZSBhdmFpbGFibGVcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IFtdLFxuICAgICAgbG9va3VwOiB0aGlzLl9jYWNoZUxvb2t1cCB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVMb29rdXApIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVt0aGlzLl9jYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlTG9va3VwICYmIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnRpYWxDYWNoZVt0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdXTtcbiAgICB9XG4gICAgLy8gU3R1cGlkIGFwcHJvYWNoIHdoZW4gdGhlIGNhY2hlIGlzbid0IGJ1aWx0OiBpbnRlcmF0ZSB1bnRpbCB3ZSBzZWUgdGhlXG4gICAgLy8gaW5kZXguIFN1YmNsYXNzZXMgc2hvdWxkIG92ZXJyaWRlIHRoaXNcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGl0ZW0uaW5kZXggPT09IGluZGV4KSB7XG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGUgPSB0aGlzLmRlcml2ZWRUYWJsZXMuZmluZCh0YWJsZU9iaiA9PiB7XG4gICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMob3B0aW9ucykuZXZlcnkoKFtvcHRpb25OYW1lLCBvcHRpb25WYWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbk5hbWUgPT09ICd0eXBlJykge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmpbJ18nICsgb3B0aW9uTmFtZV0gPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGV4aXN0aW5nVGFibGUgJiYgdGhpcy5tb2RlbC50YWJsZXNbZXhpc3RpbmdUYWJsZS50YWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ1Byb21vdGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdVbnJvbGxlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlcy5tYXAodmFsdWUgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUobGltaXQpKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUobGltaXQpKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgZHVwbGljYXRlICgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlVGFibGUoe1xuICAgICAgdHlwZTogJ0R1cGxpY2F0ZWRUYWJsZSdcbiAgICB9KTtcbiAgfVxuICBjb25uZWN0IChvdGhlclRhYmxlTGlzdCwgdHlwZSA9ICdDb25uZWN0ZWRUYWJsZScpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoeyB0eXBlIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jb25zdCBBdHRyVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQXR0clRhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgICAgfVxuICAgIH1cbiAgICBfdG9SYXdPYmplY3QgKCkge1xuICAgICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZ2V0U29ydEhhc2ggKCkge1xuICAgICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgfVxuICAgIGdldCBuYW1lICgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShBdHRyVGFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IEF0dHJUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IEF0dHJUYWJsZU1peGluIGZyb20gJy4vQXR0clRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlZFRhYmxlIGV4dGVuZHMgQXR0clRhYmxlTWl4aW4oVGFibGUpIHtcbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgd2FudCB0byBjYWxsIF9maW5pc2hJdGVtXG4gICAgLy8gdW50aWwgYWxsIHVuaXF1ZSB2YWx1ZXMgaGF2ZSBiZWVuIHNlZW5cbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXAgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlIHx8IHRlbXAgPT09IG51bGwpIHtcbiAgICAgICAgLy8gcmVzZXQoKSB3YXMgY2FsbGVkIGJlZm9yZSB3ZSBjb3VsZCBmaW5pc2g7IHdlIG5lZWQgdG8gbGV0IGV2ZXJ5b25lXG4gICAgICAgIC8vIHRoYXQgd2FzIHdhaXRpbmcgb24gdXMga25vdyB0aGF0IHdlIGNhbid0IGNvbXBseVxuICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghdGVtcC5kb25lKSB7XG4gICAgICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3VuZmluaXNoZWRDYWNoZS5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VuZmluaXNoZWRDYWNoZS5wdXNoKHRlbXAudmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBPa2F5LCBub3cgd2UndmUgc2VlbiBldmVyeXRoaW5nOyB3ZSBjYW4gY2FsbCBfZmluaXNoSXRlbSBvbiBlYWNoIG9mIHRoZVxuICAgIC8vIHVuaXF1ZSB2YWx1ZXNcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCB2YWx1ZSBvZiB0aGlzLl91bmZpbmlzaGVkQ2FjaGUpIHtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKHZhbHVlKSkge1xuICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgLy8gaW50byB0aGUgd29ybGRcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3ZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZS5wdXNoKHZhbHVlKTtcbiAgICAgICAgaSsrO1xuICAgICAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgaWYgKGxpbWl0IDw9IGkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXA7XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcoYXdhaXQgd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0IVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVbdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXRcbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IEF0dHJUYWJsZU1peGluIGZyb20gJy4vQXR0clRhYmxlTWl4aW4uanMnO1xuXG5jb25zdCBDaGlsZFRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBBdHRyVGFibGVNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIF93cmFwIChvcHRpb25zKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gc3VwZXIuX3dyYXAob3B0aW9ucyk7XG4gICAgICBuZXdJdGVtLnBhcmVudEluZGV4ID0gb3B0aW9ucy5wYXJlbnRJbmRleDtcbiAgICAgIHJldHVybiBuZXdJdGVtO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2hpbGRUYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IENoaWxkVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBDaGlsZFRhYmxlTWl4aW4gZnJvbSAnLi9DaGlsZFRhYmxlTWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgQ2hpbGRUYWJsZU1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCByb3cgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvdyAhPT0gdW5kZWZpbmVkICYmIHJvdyAhPT0gbnVsbCAmJiBPYmplY3Qua2V5cyhyb3cpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgcGFyZW50SW5kZXg6IHdyYXBwZWRQYXJlbnQuaW5kZXhcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgICBpbmRleCsrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFVucm9sbGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvd3MgPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKHJvd3MgIT09IHVuZGVmaW5lZCAmJiByb3dzICE9PSBudWxsICYmXG4gICAgICAgICAgdHlwZW9mIHJvd3NbU3ltYm9sLml0ZXJhdG9yXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiByb3dzKSB7XG4gICAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICByb3csXG4gICAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF0sXG4gICAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFVucm9sbGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFBhcmVudENoaWxkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJy8nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignLCcpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBwYXJlbnRUYWJsZSwgY2hpbGRUYWJsZTtcbiAgICBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMF0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzFdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnRUYWJsZXNbMV0ucGFyZW50VGFibGUgPT09IHRoaXMucGFyZW50VGFibGVzWzBdKSB7XG4gICAgICBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzBdO1xuICAgICAgY2hpbGRUYWJsZSA9IHRoaXMucGFyZW50VGFibGVzWzFdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudENoaWxkVGFibGUgbm90IHNldCB1cCBwcm9wZXJseWApO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaGlsZCBvZiBjaGlsZFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgcGFyZW50ID0gYXdhaXQgcGFyZW50VGFibGUuZ2V0SXRlbShjaGlsZC5wYXJlbnRJbmRleCk7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogW3BhcmVudCwgY2hpbGRdXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQYXJlbnRDaGlsZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCwgJ0dlbmVyaWNDbGFzcycpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkpO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBsZXQgZWRnZUlkcyA9IG9wdGlvbnMuY2xhc3Nlc1xuICAgICAgPyBvcHRpb25zLmNsYXNzZXMubWFwKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzSWQpXG4gICAgICA6IG9wdGlvbnMuY2xhc3NJZHMgfHwgT2JqZWN0LmtleXModGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IGl0ZXJhdG9ycyA9IFtdO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIGVkZ2VJZHMpIHtcbiAgICAgIGlmICghdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHNbZWRnZUlkXSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgY29uc3Qgcm9sZSA9IHRoaXMuY2xhc3NPYmouZ2V0RWRnZVJvbGUoZWRnZUNsYXNzKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgfVxuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBpdGVyYXRvcnMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSksICdOb2RlQ2xhc3MnKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLnVucm9sbChhdHRyaWJ1dGUpLCAnTm9kZUNsYXNzJyk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgcHJvamVjdE5ld0VkZ2UgKGNsYXNzSWRMaXN0KSB7XG4gICAgY29uc3QgY2xhc3NMaXN0ID0gY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KTtcbiAgICBpZiAoY2xhc3NMaXN0Lmxlbmd0aCA8IDIgfHwgY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS50eXBlICE9PSAnTm9kZScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjbGFzc0lkTGlzdGApO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VDbGFzc0lkID0gdGhpcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzSWQgPSBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICBjb25zdCB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIGxldCB0YWJsZUlkO1xuICAgIGNvbnN0IG1pZGRsZUluZGV4ID0gTWF0aC5mbG9vcigoY2xhc3NMaXN0Lmxlbmd0aCAtIDEpIC8gMik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGFzc0xpc3QubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICBpZiAoaSA8IG1pZGRsZUluZGV4KSB7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGkgPT09IG1pZGRsZUluZGV4KSB7XG4gICAgICAgIHRhYmxlSWQgPSBjbGFzc0xpc3RbaV0udGFibGUuZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjbGFzc0xpc3RbaV0udHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVtcCA9IEFycmF5LmZyb20oY2xhc3NMaXN0W2ldLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIHRlbXApIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQoY2xhc3NMaXN0W2ldLnRhYmxlSWQpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc0xpc3RbaV0udGFyZ2V0VGFibGVJZHMpIHtcbiAgICAgICAgICAgIHRhcmdldFRhYmxlSWRzLnVuc2hpZnQodGFibGVJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai5zb3VyY2VUYWJsZUlkcy5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldFRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogbm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpLFxuICAgICAgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKVxuICAgIF0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHxcbiAgICAgICgodGhpcy5zb3VyY2VDbGFzcyAmJiB0aGlzLnNvdXJjZUNsYXNzLmNsYXNzTmFtZSkgfHwgJz8nKSArXG4gICAgICAnLScgK1xuICAgICAgKCh0aGlzLnRhcmdldENsYXNzICYmIHRoaXMudGFyZ2V0Q2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImNsYXNzIFBhcnNlRmFpbHVyZSBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IgKGZpbGVGb3JtYXQpIHtcbiAgICBzdXBlcihgRmFpbGVkIHRvIHBhcnNlIGZvcm1hdDogJHtmaWxlRm9ybWF0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcnNlRmFpbHVyZTtcbiIsImltcG9ydCBQYXJzZUZhaWx1cmUgZnJvbSAnLi9QYXJzZUZhaWx1cmUuanMnO1xuXG5jb25zdCBOT0RFX05BTUVTID0gWydub2RlcycsICdOb2RlcyddO1xuY29uc3QgRURHRV9OQU1FUyA9IFsnZWRnZXMnLCAnbGlua3MnLCAnRWRnZXMnLCAnTGlua3MnXTtcblxuY2xhc3MgRDNKc29uIHtcbiAgYXN5bmMgaW1wb3J0RGF0YSAoeyBtb2RlbCwgdGV4dCB9KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgY29uc3Qgbm9kZU5hbWUgPSBOT0RFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGNvbnN0IGVkZ2VOYW1lID0gRURHRV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBpZiAoIW5vZGVOYW1lIHx8ICFlZGdlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlRmFpbHVyZSh0aGlzKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb3JlVGFibGUgPSBtb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnU3RhdGljRGljdFRhYmxlJyxcbiAgICAgIG5hbWU6ICdjb3JlVGFibGUnLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pO1xuICAgIGNvbnN0IGNvcmVDbGFzcyA9IG1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29yZVRhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgICBsZXQgW25vZGVzLCBlZGdlc10gPSBjb3JlQ2xhc3MuY2xvc2VkVHJhbnNwb3NlKFtub2RlTmFtZSwgZWRnZU5hbWVdKTtcbiAgICBub2RlcyA9IG5vZGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBub2Rlcy5zZXRDbGFzc05hbWUobm9kZU5hbWUpO1xuICAgIGVkZ2VzID0gZWRnZXMuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGVkZ2VzLnNldENsYXNzTmFtZShlZGdlTmFtZSk7XG4gICAgY29yZUNsYXNzLmRlbGV0ZSgpO1xuXG4gICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogZWRnZXMsXG4gICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6ICdpbmRleCcsXG4gICAgICBlZGdlQXR0cmlidXRlOiAnc291cmNlJ1xuICAgIH0pO1xuICAgIG5vZGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiAnaW5kZXgnLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgfVxuICBhc3luYyBleHBvcnREYXRhICh7IG1vZGVsLCBleGNsdWRlQ2xhc3NlcyA9IFtdLCBwcmV0dHkgPSB0cnVlIH0pIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSkge1xuICAgICAgaWYgKGV4Y2x1ZGVDbGFzc2VzLmluZGV4T2YoY2xhc3NPYmopID09PSAtMSkge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmouaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgICAgZm9yIChjb25zdCBhdHRyIGluIGl0ZW0ucm93KSB7XG4gICAgICAgICAgICByb3dbYXR0cl0gPSBpdGVtLnJvd1thdHRyXSBpbnN0YW5jZW9mIFByb21pc2UgPyBhd2FpdCBpdGVtLnJvd1thdHRyXSA6IGl0ZW0ucm93W2F0dHJdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaXRlbS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgICAgIHJvdy5pbmRleCA9IGl0ZW0uZXhwb3J0SWQ7XG4gICAgICAgICAgICByZXN1bHQubm9kZXMucHVzaChyb3cpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGl0ZW0uc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgICAgICByb3cuc291cmNlID0gc291cmNlLmV4cG9ydElkO1xuICAgICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBpdGVtLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgICAgICByb3cudGFyZ2V0ID0gdGFyZ2V0LmV4cG9ydElkO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5saW5rcy5wdXNoKE9iamVjdC5hc3NpZ24oe30sIHJvdykpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcmV0dHkpIHtcbiAgICAgIHJlc3VsdC5ub2RlcyA9IHJlc3VsdC5ub2Rlcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcgICAgLFxcbicpO1xuICAgICAgcmVzdWx0LmxpbmtzID0gcmVzdWx0LmxpbmtzLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgLmpvaW4oJyAgICAsXFxuJyk7XG4gICAgICByZXR1cm4gYFxcXG57XG4gIFwibm9kZXNcIjogW1xuICAgICR7cmVzdWx0Lm5vZGVzfVxuICBdLFxuICBcImVkZ2VzXCI6IFtcbiAgICAke3Jlc3VsdC5saW5rc31cbiAgXVxufVxuYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlc3VsdCk7XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgRDNKc29uKCk7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcblxuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4uL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuaW1wb3J0ICogYXMgRklMRV9GT1JNQVRTIGZyb20gJy4uL0ZpbGVGb3JtYXRzL0ZpbGVGb3JtYXRzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgZmluZENsYXNzIChjbGFzc05hbWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NOYW1lID09PSBjbGFzc05hbWUpO1xuICB9XG4gIHJlbmFtZSAobmV3TmFtZSkge1xuICAgIHRoaXMubmFtZSA9IG5ld05hbWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhbm5vdGF0ZSAoa2V5LCB2YWx1ZSkge1xuICAgIHRoaXMuYW5ub3RhdGlvbnNba2V5XSA9IHZhbHVlO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlQW5ub3RhdGlvbiAoa2V5KSB7XG4gICAgZGVsZXRlIHRoaXMuYW5ub3RhdGlvbnNba2V5XTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5fb3JpZ3JhcGguZGVsZXRlTW9kZWwodGhpcy5tb2RlbElkKTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX29yaWdyYXBoLm1vZGVsc1t0aGlzLm1vZGVsSWRdO1xuICB9XG4gIGFzeW5jIGFkZFRleHRGaWxlICh7IG5hbWUsIGZvcm1hdCwgdGV4dCB9KSB7XG4gICAgaWYgKCFmb3JtYXQpIHtcbiAgICAgIGZvcm1hdCA9IG1pbWUuZXh0ZW5zaW9uKG1pbWUubG9va3VwKG5hbWUpKTtcbiAgICB9XG4gICAgaWYgKEZJTEVfRk9STUFUU1tmb3JtYXRdKSB7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW2Zvcm1hdF0uaW1wb3J0RGF0YSh7IG1vZGVsOiB0aGlzLCB0ZXh0IH0pO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW2Zvcm1hdF0pIHtcbiAgICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGZvcm1hdCB9KTtcbiAgICAgIGlmIChmb3JtYXQgPT09ICdjc3YnIHx8IGZvcm1hdCA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGZvcm1hdDogJHtmb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICghZXJyLmluVXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgZ2V0SW5zdGFuY2VHcmFwaCAoaW5zdGFuY2VJZExpc3QpIHtcbiAgICBpZiAoIWluc3RhbmNlSWRMaXN0KSB7XG4gICAgICAvLyBXaXRob3V0IHNwZWNpZmllZCBpbnN0YW5jZXMsIGp1c3QgcGljayB0aGUgZmlyc3QgNSBmcm9tIGVhY2ggbm9kZVxuICAgICAgLy8gYW5kIGVkZ2UgY2xhc3NcbiAgICAgIGluc3RhbmNlSWRMaXN0ID0gW107XG4gICAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnIHx8IGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKDUpKSB7XG4gICAgICAgICAgICBpbnN0YW5jZUlkTGlzdC5wdXNoKGl0ZW0uaW5zdGFuY2VJZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBzcGVjaWZpZWQgaXRlbXNcbiAgICBjb25zdCBub2RlSW5zdGFuY2VzID0ge307XG4gICAgY29uc3QgZWRnZUluc3RhbmNlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgaW5zdGFuY2VJZCBvZiBpbnN0YW5jZUlkTGlzdCkge1xuICAgICAgY29uc3QgeyBjbGFzc0lkLCBpbmRleCB9ID0gSlNPTi5wYXJzZShpbnN0YW5jZUlkKTtcbiAgICAgIGNvbnN0IGluc3RhbmNlID0gYXdhaXQgdGhpcy5jbGFzc2VzW2NsYXNzSWRdLnRhYmxlLmdldEl0ZW0oaW5kZXgpO1xuICAgICAgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBub2RlSW5zdGFuY2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlSW5zdGFuY2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFkZCBhbnkgbm9kZXMgY29ubmVjdGVkIHRvIG91ciBlZGdlc1xuICAgIGNvbnN0IGV4dHJhTm9kZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBpbiBlZGdlSW5zdGFuY2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZUluc3RhbmNlc1tlZGdlSWRdLm5vZGVzKCkpIHtcbiAgICAgICAgaWYgKCFub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICBleHRyYU5vZGVzW25vZGUuaW5zdGFuY2VJZF0gPSBub2RlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIEFkZCBhbnkgZWRnZXMgdGhhdCBjb25uZWN0IG91ciBub2Rlc1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IG5vZGVJZCBpbiBub2RlSW5zdGFuY2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2Ygbm9kZUluc3RhbmNlc1tub2RlSWRdLmVkZ2VzKCkpIHtcbiAgICAgICAgaWYgKCFlZGdlSW5zdGFuY2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2RlSW5zdGFuY2VzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNTb3VyY2UgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgICAgICBjb25uZWN0c1RhcmdldCA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoY29ubmVjdHNTb3VyY2UgJiYgY29ubmVjdHNUYXJnZXQpIHtcbiAgICAgICAgICAgIGV4dHJhRWRnZXNbZWRnZS5pbnN0YW5jZUlkXSA9IGVkZ2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gT2theSwgbm93IHdlIGhhdmUgYSBjb21wbGV0ZSBzZXQgb2Ygbm9kZXMgYW5kIGVkZ2VzIHRoYXQgd2Ugd2FudCB0b1xuICAgIC8vIGluY2x1ZGU7IGNyZWF0ZSBwYWlyd2lzZSBlZGdlIGVudHJpZXMgZm9yIGV2ZXJ5IGNvbm5lY3Rpb25cbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIC8vIEFkZCBhbGwgdGhlIG5vZGVzLCBhbmQgcG9wdWxhdGUgYSBsb29rdXAgZm9yIHdoZXJlIHRoZXkgYXJlIGluIHRoZSBsaXN0XG4gICAgZm9yIChjb25zdCBub2RlIG9mIE9iamVjdC52YWx1ZXMobm9kZUluc3RhbmNlcykuY29uY2F0KE9iamVjdC52YWx1ZXMoZXh0cmFOb2RlcykpKSB7XG4gICAgICBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBncmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICBncmFwaC5ub2Rlcy5wdXNoKHtcbiAgICAgICAgbm9kZUluc3RhbmNlOiBub2RlLFxuICAgICAgICBkdW1teTogZmFsc2VcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFkZCBhbGwgdGhlIGVkZ2VzLi4uXG4gICAgZm9yIChjb25zdCBlZGdlIG9mIE9iamVjdC52YWx1ZXMoZWRnZUluc3RhbmNlcykuY29uY2F0KE9iamVjdC52YWx1ZXMoZXh0cmFFZGdlcykpKSB7XG4gICAgICBpZiAoIWVkZ2UuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIC8vIE1pc3NpbmcgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBjbGFzc2VzOyBhZGQgZHVtbXkgbm9kZXMgZm9yIGJvdGggZW5kc1xuICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aCArIDFcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEFkZCBkdW1teSBzb3VyY2Ugbm9kZXNcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCFlZGdlLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgLy8gQWRkIGR1bW15IHRhcmdldCBub2Rlc1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGhcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlcmUgc2hvdWxkIGJlIGJvdGggc291cmNlIGFuZCB0YXJnZXQgbm9kZXMgZm9yIGVhY2ggZWRnZVxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZU5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldE5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSxcbiAgICBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcylcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE1vZGVsRHVtcCAoKSB7XG4gICAgLy8gQmVjYXVzZSBvYmplY3Qga2V5IG9yZGVycyBhcmVuJ3QgZGV0ZXJtaW5pc3RpYywgaXQgY2FuIGJlIHByb2JsZW1hdGljXG4gICAgLy8gZm9yIHRlc3RpbmcgKGJlY2F1c2UgaWRzIGNhbiByYW5kb21seSBjaGFuZ2UgZnJvbSB0ZXN0IHJ1biB0byB0ZXN0IHJ1bikuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzb3J0cyBlYWNoIGtleSwgYW5kIGp1c3QgcmVwbGFjZXMgSURzIHdpdGggaW5kZXggbnVtYmVyc1xuICAgIGNvbnN0IHJhd09iaiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcy5fdG9SYXdPYmplY3QoKSkpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLmNsYXNzZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLmNsYXNzZXNbYS5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMuY2xhc3Nlc1tiLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHJhd09iai50YWJsZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLnRhYmxlc1thLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy50YWJsZXNbYi50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZSBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgY29uc3QgY2xhc3NMb29rdXAgPSB7fTtcbiAgICBjb25zdCB0YWJsZUxvb2t1cCA9IHt9O1xuICAgIHJlc3VsdC5jbGFzc2VzLmZvckVhY2goKGNsYXNzT2JqLCBpbmRleCkgPT4ge1xuICAgICAgY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBpbmRleDtcbiAgICB9KTtcbiAgICByZXN1bHQudGFibGVzLmZvckVhY2goKHRhYmxlLCBpbmRleCkgPT4ge1xuICAgICAgdGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBpbmRleDtcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgcmVzdWx0LnRhYmxlcykge1xuICAgICAgdGFibGUudGFibGVJZCA9IHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpKSB7XG4gICAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVMb29rdXBbdGFibGVJZF1dID0gdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZGVsZXRlIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICB9XG4gICAgICBkZWxldGUgdGFibGUuZGF0YTsgLy8gZG9uJ3QgaW5jbHVkZSBhbnkgb2YgdGhlIGRhdGE7IHdlIGp1c3Qgd2FudCB0aGUgbW9kZWwgc3RydWN0dXJlXG4gICAgfVxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgcmVzdWx0LmNsYXNzZXMpIHtcbiAgICAgIGNsYXNzT2JqLmNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXTtcbiAgICAgIGNsYXNzT2JqLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFtjbGFzc09iai50YWJsZUlkXTtcbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyA9IGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldENsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai50YXJnZXRDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcyA9IGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyhjbGFzc09iai5lZGdlQ2xhc3NJZHMgfHwge30pKSB7XG4gICAgICAgIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0xvb2t1cFtjbGFzc0lkXV0gPSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGRlbGV0ZSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRNb2RlbER1bXAoKTtcblxuICAgIGdyYXBoLnRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXMgPSBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlTW9kZWwoeyBuYW1lOiB0aGlzLm5hbWUgKyAnX3NjaGVtYScgfSk7XG4gICAgY29uc3QgcmF3ID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgsXG4gICAgICBuYW1lOiAnUmF3IER1bXAnXG4gICAgfSk7XG4gICAgbGV0IFsgY2xhc3NlcywgdGFibGVzIF0gPSByYXcuY2xvc2VkVHJhbnNwb3NlKFsnY2xhc3NlcycsICd0YWJsZXMnXSk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIGNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdDbGFzc2VzJyk7XG4gICAgcmF3LmRlbGV0ZSgpO1xuXG4gICAgY29uc3Qgc291cmNlQ2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAnc291cmNlQ2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHNvdXJjZUNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdTb3VyY2UgQ2xhc3MnKTtcbiAgICBzb3VyY2VDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuICAgIGNvbnN0IHRhcmdldENsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhcmdldENsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YXJnZXRDbGFzc2VzLnNldENsYXNzTmFtZSgnVGFyZ2V0IENsYXNzJyk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIHRhYmxlcyA9IHRhYmxlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgdGFibGVzLnNldENsYXNzTmFtZSgnVGFibGVzJyk7XG5cbiAgICBjb25zdCB0YWJsZURlcGVuZGVuY2llcyA9IHRhYmxlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ2Rlcml2ZWRUYWJsZXMnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy5zZXRDbGFzc05hbWUoJ0lzIFBhcmVudCBPZicpO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgY29uc3QgY29yZVRhYmxlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgY29yZVRhYmxlcy5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGUnKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5ldHdvcmtNb2RlbDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IE5ldHdvcmtNb2RlbCBmcm9tICcuL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMnO1xuXG5sZXQgTkVYVF9NT0RFTF9JRCA9IDE7XG5cbmNsYXNzIE9yaWdyYXBoIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAobG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gb25seSBkZWZpbmVkIGluIHRoZSBicm93c2VyIGNvbnRleHRcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qXG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgICAqL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBhc3luYyBsb2FkTW9kZWwgKHsgbmFtZSwgZm9ybWF0LCB0ZXh0IH0pIHtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoeyBtb2RlbElkOiBuYW1lIH0pO1xuICAgIGF3YWl0IG5ld01vZGVsLmFkZFRleHRGaWxlKHsgbmFtZSwgZm9ybWF0LCB0ZXh0IH0pO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxuICBjcmVhdGVNb2RlbCAob3B0aW9ucyA9IHt9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLm1vZGVsSWQgfHwgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSkge1xuICAgICAgb3B0aW9ucy5tb2RlbElkID0gYG1vZGVsJHtORVhUX01PREVMX0lEfWA7XG4gICAgICBORVhUX01PREVMX0lEICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMub3JpZ3JhcGggPSB0aGlzO1xuICAgIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG9wdGlvbnMpO1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gb3B0aW9ucy5tb2RlbElkO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF07XG4gIH1cbiAgZGVsZXRlTW9kZWwgKG1vZGVsSWQgPSB0aGlzLmN1cnJlbnRNb2RlbElkKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsc1ttb2RlbElkXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgbm9uLWV4aXN0ZW50IG1vZGVsOiAke21vZGVsSWR9YCk7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsc1ttb2RlbElkXTtcbiAgICBpZiAodGhpcy5fY3VycmVudE1vZGVsSWQgPT09IG1vZGVsSWQpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgfVxuICAgIHRoaXMuc2F2ZSgpO1xuICB9XG4gIGRlbGV0ZUFsbE1vZGVscyAoKSB7XG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKHdpbmRvdy5sb2NhbFN0b3JhZ2UpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiZXZlbnQiLCJuYW1lc3BhY2UiLCJzcGxpdCIsInB1c2giLCJvZmYiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImhhbmRsZUNhbGxiYWNrIiwic2V0VGltZW91dCIsImFwcGx5IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkdlbmVyaWNXcmFwcGVyIiwib3B0aW9ucyIsInRhYmxlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJjbGFzc09iaiIsInJvdyIsImNvbm5lY3RlZEl0ZW1zIiwiZHVwbGljYXRlSXRlbXMiLCJyZWdpc3RlckR1cGxpY2F0ZSIsIml0ZW0iLCJjb25uZWN0SXRlbSIsInRhYmxlSWQiLCJkdXAiLCJkaXNjb25uZWN0IiwiaXRlbUxpc3QiLCJ2YWx1ZXMiLCJpbnN0YW5jZUlkIiwiY2xhc3NJZCIsImV4cG9ydElkIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwicmVzZXQiLCJuZXh0VGFibGVJZCIsImxlbmd0aCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsIml0ZW1zVG9SZXNldCIsImNvbmNhdCIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsIndyYXBwZWRJdGVtIiwiZGVsYXllZFJvdyIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJnZXRJdGVtIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJwcm9tb3RlIiwiZXhwYW5kIiwidW5yb2xsIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImR1cGxpY2F0ZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9ucyIsInNldENsYXNzTmFtZSIsImhhc0N1c3RvbU5hbWUiLCJ2YXJpYWJsZU5hbWUiLCJmaWx0ZXIiLCJkIiwidG9Mb2NhbGVVcHBlckNhc2UiLCJkZWxldGVkIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm92ZXJ3cml0ZSIsImNyZWF0ZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVOZXdDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzZXMiLCJlZGdlQ2xhc3NJZCIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiYXV0b2Nvbm5lY3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJpc1NvdXJjZSIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MiLCJjaGlsZENsYXNzIiwicHJvamVjdE5ld0VkZ2UiLCJjbGFzc0lkTGlzdCIsImNsYXNzTGlzdCIsIm1pZGRsZUluZGV4IiwiTWF0aCIsImZsb29yIiwidW5zaGlmdCIsIkFycmF5IiwiZnJvbSIsImNvbm5lY3RlZENsYXNzZXMiLCJFZGdlV3JhcHBlciIsInNvdXJjZU5vZGVzIiwic291cmNlVGFibGVJZCIsInRhcmdldE5vZGVzIiwidGFyZ2V0VGFibGVJZCIsIm5vZGVzIiwiRWRnZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsImFicyIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsImNvbm5lY3RGYWNldGVkQ2xhc3MiLCJuZXdDbGFzc2VzIiwibmV3Q2xhc3MiLCJQYXJzZUZhaWx1cmUiLCJmaWxlRm9ybWF0IiwiTk9ERV9OQU1FUyIsIkVER0VfTkFNRVMiLCJEM0pzb24iLCJpbXBvcnREYXRhIiwidGV4dCIsIkpTT04iLCJwYXJzZSIsIm5vZGVOYW1lIiwiZWRnZU5hbWUiLCJjb3JlVGFibGUiLCJjb3JlQ2xhc3MiLCJleHBvcnREYXRhIiwiZXhjbHVkZUNsYXNzZXMiLCJwcmV0dHkiLCJsaW5rcyIsInNvdXJjZSIsInRhcmdldCIsInN0cmluZ2lmeSIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsInNlbGVjdG9yIiwiZmluZENsYXNzIiwicmVuYW1lIiwibmV3TmFtZSIsImFubm90YXRlIiwia2V5IiwiZGVsZXRlQW5ub3RhdGlvbiIsImRlbGV0ZU1vZGVsIiwibW9kZWxzIiwiYWRkVGV4dEZpbGUiLCJmb3JtYXQiLCJtaW1lIiwiZXh0ZW5zaW9uIiwiRklMRV9GT1JNQVRTIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VJZExpc3QiLCJub2RlSW5zdGFuY2VzIiwiZWRnZUluc3RhbmNlcyIsImluc3RhbmNlIiwiZXh0cmFOb2RlcyIsIm5vZGUiLCJleHRyYUVkZ2VzIiwibm9kZUlkIiwiZWRnZSIsImNvbm5lY3RzU291cmNlIiwiY29ubmVjdHNUYXJnZXQiLCJncmFwaCIsIm5vZGVMb29rdXAiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsIl9jdXJyZW50TW9kZWxJZCIsInJlZ2lzdGVyUGx1Z2luIiwicGx1Z2luIiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJsb2FkTW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxjQUFMLEdBQXNCLEVBQXRCO1dBQ0tDLGVBQUwsR0FBdUIsRUFBdkI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNuQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6QjtXQUNLUCxjQUFMLENBQW9CSyxLQUFwQixJQUE2QixLQUFLTCxjQUFMLENBQW9CSyxLQUFwQixLQUMzQjtZQUFNO09BRFI7O1VBRUksQ0FBQ0MsU0FBTCxFQUFnQjthQUNUTixjQUFMLENBQW9CSyxLQUFw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
