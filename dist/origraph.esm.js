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

            if (i >= limit) {
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
    if (tableIds.length === 1) {
      yield* this.connectedItems[tableIds[0]] || [];
    } else {
      const thisTableId = tableIds[0];
      const remainingTableIds = tableIds.slice(1);

      for (const item of this.connectedItems[thisTableId] || []) {
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
    this.iterationReset = new Error('Iteration reset');
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
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }

      if (!this._partialCache) {
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
      this._limitPromises[limit].reject(this.iterationReset);

      delete this._limitPromises;
    }

    reject(this.iterationReset);
  }

  async countRows() {
    return (await this.buildCache()).length;
  }

  async _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);
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
      return this._partialCache[index];
    } // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses should override this


    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
        const item = _value;

        if (item.index === index) {
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

  connect(otherTableList) {
    const newTable = this.model.createTable({
      type: 'ConnectedTable'
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

class PromotedTable extends SingleParentMixin(Table) {
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
    return '↦' + this._attribute;
  }

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
      try {
        temp = await iterator.next();
      } catch (err) {
        // Something went wrong upstream (something that this._iterate
        // depends on was reset or threw a real error)
        if (err === this.iterationReset) {
          this.handleReset(reject);
        } else {
          throw err;
        }
      }

      if (!this._partialCache) {
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
            throw _this.iterationReset;
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
    return `ᵀ${this._index}`;
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
          // One of the parent tables was reset, meaning we need to reset as well
          throw _this.iterationReset;
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
    return this.parentTable.name + '*';
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



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  PromotedTable: PromotedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable,
  DuplicatedTable: DuplicatedTable
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
    return this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: 'GenericClass'
    });
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

  getSampleGraph(options) {
    options.rootClass = this;
    return this.model.getSampleGraph(options);
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

  pairwiseNeighborhood(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this2.edges(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const edge = _value;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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
  }) {
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


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Add this class to the source's / target's edgeClassIds

      this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

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
    const newNodeClass = this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: 'NodeClass'
    });
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
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

  pairwiseEdges(options = {}) {
    var _this4 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this4.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this4.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                edge: _this4,
                target
              };
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

  async addFileAsStaticTable({
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
        throw new Error(`${fileMB}MB file is too large to load statically`);
      }
    } // extensionOverride allows things like topojson or treejson (that don't
    // have standardized mimeTypes) to be parsed correctly


    let text = await new Promise((resolve, reject) => {
      let reader = new this._origraph.FileReader();

      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsText(fileObj, encoding);
    });
    return this.addStringAsStaticTable({
      name: fileObj.name,
      extension: extensionOverride || mime.extension(fileObj.type),
      text
    });
  }

  addStringAsStaticTable({
    name,
    extension,
    text
  }) {
    let data, attributes;

    if (!extension) {
      extension = mime.extension(mime.lookup(name));
    }

    if (DATALIB_FORMATS[extension]) {
      data = datalib.read(text, {
        type: extension
      });

      if (extension === 'csv' || extension === 'tsv') {
        attributes = {};

        for (const attr of data.columns) {
          attributes[attr] = true;
        }

        delete data.columns;
      }
    } else if (extension === 'xml') {
      throw new Error('unimplemented');
    } else if (extension === 'txt') {
      throw new Error('unimplemented');
    } else {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    return this.addStaticTable({
      name,
      data,
      attributes
    });
  }

  addStaticTable(options) {
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
    let newTable = this.createTable(options);
    return this.createClass({
      type: 'GenericClass',
      name: options.name,
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

  async getSampleGraph({
    rootClass = null,
    branchLimit = Infinity,
    nodeLimit = Infinity,
    edgeLimit = Infinity,
    tripleLimit = Infinity
  } = {}) {
    const sampleGraph = {
      nodes: [],
      nodeLookup: {},
      edges: [],
      edgeLookup: {},
      links: []
    };
    let numTriples = 0;

    const addNode = node => {
      if (sampleGraph.nodeLookup[node.instanceId] === undefined) {
        sampleGraph.nodeLookup[node.instanceId] = sampleGraph.nodes.length;
        sampleGraph.nodes.push(node);
      }

      return sampleGraph.nodes.length <= nodeLimit;
    };

    const addEdge = edge => {
      if (sampleGraph.edgeLookup[edge.instanceId] === undefined) {
        sampleGraph.edgeLookup[edge.instanceId] = sampleGraph.edges.length;
        sampleGraph.edges.push(edge);
      }

      return sampleGraph.edges.length <= edgeLimit;
    };

    const addTriple = (source, edge, target) => {
      if (addNode(source) && addNode(target) && addEdge(edge)) {
        sampleGraph.links.push({
          source: sampleGraph.nodeLookup[source.instanceId],
          target: sampleGraph.nodeLookup[target.instanceId],
          edge: sampleGraph.edgeLookup[edge.instanceId]
        });
        numTriples++;
        return numTriples <= tripleLimit;
      } else {
        return false;
      }
    };

    let classList = rootClass ? [rootClass] : Object.values(this.classes);

    for (const classObj of classList) {
      if (classObj.type === 'Node') {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const node = _value;

            if (!addNode(node)) {
              return sampleGraph;
            }

            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator(node.pairwiseNeighborhood({
                limit: branchLimit
              })), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const {
                  source,
                  edge,
                  target
                } = _value2;

                if (!addTriple(source, edge, target)) {
                  return sampleGraph;
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
      } else if (classObj.type === 'Edge') {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const edge = _value3;

            if (!addEdge(edge)) {
              return sampleGraph;
            }

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator(edge.pairwiseEdges({
                limit: branchLimit
              })), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const {
                  source,
                  target
                } = _value4;

                if (!addTriple(source, edge, target)) {
                  return sampleGraph;
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

    return sampleGraph;
  }

  async getInstanceGraph(instanceIdList) {
    if (!instanceIdList) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instanceIdList = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;

          var _iteratorError5;

          try {
            for (var _iterator5 = _asyncIterator(classObj.table.iterate(5)), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const item = _value5;
              instanceIdList.push(item.instanceId);
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
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;

      var _iteratorError6;

      try {
        for (var _iterator6 = _asyncIterator(edgeInstances[edgeId].nodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
          const node = _value6;

          if (!nodeInstances[node.instanceId]) {
            extraNodes[node.instanceId] = node;
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
    } // Add any edges that connect our nodes


    const extraEdges = {};

    for (const nodeId in nodeInstances) {
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;

      var _iteratorError7;

      try {
        for (var _iterator7 = _asyncIterator(nodeInstances[nodeId].edges()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
          const edge = _value7;

          if (!edgeInstances[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion8 = true;
            var _didIteratorError8 = false;

            var _iteratorError8;

            try {
              for (var _iterator8 = _asyncIterator(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
                const node = _value8;

                if (nodeInstances[node.instanceId]) {
                  connectsSource = true;
                  break;
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

            var _iteratorNormalCompletion9 = true;
            var _didIteratorError9 = false;

            var _iteratorError9;

            try {
              for (var _iterator9 = _asyncIterator(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
                const node = _value9;

                if (nodeInstances[node.instanceId]) {
                  connectsTarget = true;
                  break;
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

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
            }
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
          var _iteratorNormalCompletion10 = true;
          var _didIteratorError10 = false;

          var _iteratorError10;

          try {
            for (var _iterator10 = _asyncIterator(edge.targetNodes()), _step10, _value10; _step10 = await _iterator10.next(), _iteratorNormalCompletion10 = _step10.done, _value10 = await _step10.value, !_iteratorNormalCompletion10; _iteratorNormalCompletion10 = true) {
              const node = _value10;

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
            _didIteratorError10 = true;
            _iteratorError10 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion10 && _iterator10.return != null) {
                await _iterator10.return();
              }
            } finally {
              if (_didIteratorError10) {
                throw _iteratorError10;
              }
            }
          }
        }
      } else if (!edge.classObj.targetClassId) {
        // Add dummy target nodes
        var _iteratorNormalCompletion11 = true;
        var _didIteratorError11 = false;

        var _iteratorError11;

        try {
          for (var _iterator11 = _asyncIterator(edge.sourceNodes()), _step11, _value11; _step11 = await _iterator11.next(), _iteratorNormalCompletion11 = _step11.done, _value11 = await _step11.value, !_iteratorNormalCompletion11; _iteratorNormalCompletion11 = true) {
            const node = _value11;

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
          _didIteratorError11 = true;
          _iteratorError11 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion11 && _iterator11.return != null) {
              await _iterator11.return();
            }
          } finally {
            if (_didIteratorError11) {
              throw _iteratorError11;
            }
          }
        }
      } else {
        // There should be both source and target nodes for each edge
        var _iteratorNormalCompletion12 = true;
        var _didIteratorError12 = false;

        var _iteratorError12;

        try {
          for (var _iterator12 = _asyncIterator(edge.sourceNodes()), _step12, _value12; _step12 = await _iterator12.next(), _iteratorNormalCompletion12 = _step12.done, _value12 = await _step12.value, !_iteratorNormalCompletion12; _iteratorNormalCompletion12 = true) {
            const sourceNode = _value12;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion13 = true;
              var _didIteratorError13 = false;

              var _iteratorError13;

              try {
                for (var _iterator13 = _asyncIterator(edge.targetNodes()), _step13, _value13; _step13 = await _iterator13.next(), _iteratorNormalCompletion13 = _step13.done, _value13 = await _step13.value, !_iteratorNormalCompletion13; _iteratorNormalCompletion13 = true) {
                  const targetNode = _value13;

                  if (graph.nodeLookup[targetNode.instanceId] !== undefined) {
                    graph.edges.push({
                      edgeInstance: edge,
                      source: graph.nodeLookup[sourceNode.instanceId],
                      target: graph.nodeLookup[targetNode.instanceId]
                    });
                  }
                }
              } catch (err) {
                _didIteratorError13 = true;
                _iteratorError13 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion13 && _iterator13.return != null) {
                    await _iterator13.return();
                  }
                } finally {
                  if (_didIteratorError13) {
                    throw _iteratorError13;
                  }
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError12 = true;
          _iteratorError12 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion12 && _iterator12.return != null) {
              await _iterator12.return();
            }
          } finally {
            if (_didIteratorError12) {
              throw _iteratorError12;
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
  constructor(FileReader, PouchDB) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.PouchDB = PouchDB; // either pouchdb-browser or pouchdb-node

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
    /*if (this.localStorage) {
      const models = {};
      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }
      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }*/
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
var version = "0.2.2";
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

let origraph = new Origraph(window.FileReader, window.localStorage);
origraph.version = pkg.version;

export default origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL1Byb21vdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvVHJhbnNwb3NlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcyA9IG9wdGlvbnMuZHVwbGljYXRlSXRlbXMgfHwgW107XG4gIH1cbiAgcmVnaXN0ZXJEdXBsaWNhdGUgKGl0ZW0pIHtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zLnB1c2goaXRlbSk7XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZHVwIG9mIHRoaXMuZHVwbGljYXRlSXRlbXMpIHtcbiAgICAgIGl0ZW0uY29ubmVjdEl0ZW0oZHVwKTtcbiAgICAgIGR1cC5jb25uZWN0SXRlbShpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGdldCBpbnN0YW5jZUlkICgpIHtcbiAgICByZXR1cm4gYHtcImNsYXNzSWRcIjpcIiR7dGhpcy5jbGFzc09iai5jbGFzc0lkfVwiLFwiaW5kZXhcIjpcIiR7dGhpcy5pbmRleH1cIn1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGhhbmRsZUxpbWl0IChvcHRpb25zLCBpdGVyYXRvcnMpIHtcbiAgICBsZXQgbGltaXQgPSBJbmZpbml0eTtcbiAgICBpZiAob3B0aW9ucy5saW1pdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsaW1pdCA9IG9wdGlvbnMubGltaXQ7XG4gICAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICB9XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgaXRlcmF0b3Igb2YgaXRlcmF0b3JzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgaXRlcmF0b3IpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICB9KSk7XG4gICAgeWllbGQgKiB0aGlzLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpO1xuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbGltaXRQcm9taXNlcyA9IHt9O1xuXG4gICAgdGhpcy5pdGVyYXRpb25SZXNldCA9IG5ldyBFcnJvcignSXRlcmF0aW9uIHJlc2V0Jyk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIHVwc3RyZWFtIChzb21ldGhpbmcgdGhhdCB0aGlzLl9pdGVyYXRlXG4gICAgICAgIC8vIGRlcGVuZHMgb24gd2FzIHJlc2V0IG9yIHRocmV3IGEgcmVhbCBlcnJvcilcbiAgICAgICAgaWYgKGVyciA9PT0gdGhpcy5pdGVyYXRpb25SZXNldCkge1xuICAgICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKSkge1xuICAgICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gRG9uZSBpdGVyYXRpbmchIFdlIGNhbiBncmFkdWF0ZSB0aGUgcGFydGlhbCBjYWNoZSAvIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpbmlzaGVkIG9uZXMsIGFuZCBzYXRpc2Z5IGFsbCB0aGUgcmVxdWVzdHNcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBUaGUgc2V0VGltZW91dCBoZXJlIGlzIGFic29sdXRlbHkgbmVjZXNzYXJ5LCBvciB0aGlzLl9jYWNoZVByb21pc2VcbiAgICAgICAgLy8gd29uJ3QgYmUgc3RvcmVkIGluIHRpbWUgZm9yIHRoZSBuZXh0IGJ1aWxkQ2FjaGUoKSBjYWxsIHRoYXQgY29tZXNcbiAgICAgICAgLy8gdGhyb3VnaFxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB0aGlzLl9idWlsZENhY2hlKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QodGhpcy5pdGVyYXRpb25SZXNldCk7XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlcztcbiAgICB9XG4gICAgcmVqZWN0KHRoaXMuaXRlcmF0aW9uUmVzZXQpO1xuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmJ1aWxkQ2FjaGUoKSkubGVuZ3RoO1xuICB9XG4gIGFzeW5jIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgYXdhaXQgZnVuYyhhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIC8vIEFsbG93IHByb2JpbmcgdG8gc2VlIHdoYXRldmVyIGRhdGEgaGFwcGVucyB0byBiZSBhdmFpbGFibGVcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IFtdLFxuICAgICAgbG9va3VwOiB0aGlzLl9jYWNoZUxvb2t1cCB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGVMb29rdXApIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVt0aGlzLl9jYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlTG9va3VwICYmIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgfVxuICAgIC8vIFN0dXBpZCBhcHByb2FjaCB3aGVuIHRoZSBjYWNoZSBpc24ndCBidWlsdDogaW50ZXJhdGUgdW50aWwgd2Ugc2VlIHRoZVxuICAgIC8vIGluZGV4LiBTdWJjbGFzc2VzIHNob3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbS5pbmRleCA9PT0gaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhZGRGaWx0ZXIgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4RmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnUHJvbW90ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgd2FudCB0byBjYWxsIF9maW5pc2hJdGVtXG4gICAgLy8gdW50aWwgYWxsIHVuaXF1ZSB2YWx1ZXMgaGF2ZSBiZWVuIHNlZW5cbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXAgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyB1cHN0cmVhbSAoc29tZXRoaW5nIHRoYXQgdGhpcy5faXRlcmF0ZVxuICAgICAgICAvLyBkZXBlbmRzIG9uIHdhcyByZXNldCBvciB0aHJldyBhIHJlYWwgZXJyb3IpXG4gICAgICAgIGlmIChlcnIgPT09IHRoaXMuaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fdW5maW5pc2hlZENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE9rYXksIG5vdyB3ZSd2ZSBzZWVuIGV2ZXJ5dGhpbmc7IHdlIGNhbiBjYWxsIF9maW5pc2hJdGVtIG9uIGVhY2ggb2YgdGhlXG4gICAgLy8gdW5pcXVlIHZhbHVlc1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX3VuZmluaXNoZWRDYWNoZSkge1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odmFsdWUpKSB7XG4gICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICBpKys7XG4gICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cDtcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyhhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQhXG4gICAgICAgIHRocm93IHRoaXMuaXRlcmF0aW9uUmVzZXQ7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVbdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGDhtYAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQsIG1lYW5pbmcgd2UgbmVlZCB0byByZXNldCBhcyB3ZWxsXG4gICAgICAgIHRocm93IHRoaXMuaXRlcmF0aW9uUmVzZXQ7XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAnKic7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0U2FtcGxlR3JhcGggKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnJvb3RDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuZ2V0U2FtcGxlR3JhcGgob3B0aW9ucyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcyhvcHRpb25zKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlRWRnZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5wcm9tb3RlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6ICdOb2RlQ2xhc3MnXG4gICAgfSk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBwcm9qZWN0TmV3RWRnZSAoY2xhc3NJZExpc3QpIHtcbiAgICBjb25zdCBjbGFzc0xpc3QgPSBjbGFzc0lkTGlzdC5tYXAoY2xhc3NJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jbGFzc2VzW2NsYXNzSWRdO1xuICAgIH0pO1xuICAgIGlmIChjbGFzc0xpc3QubGVuZ3RoIDwgMiB8fCBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLnR5cGUgIT09ICdOb2RlJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNsYXNzSWRMaXN0YCk7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZUNsYXNzSWQgPSB0aGlzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIGNvbnN0IHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgbGV0IHRhYmxlSWQ7XG4gICAgY29uc3QgbWlkZGxlSW5kZXggPSBNYXRoLmZsb29yKChjbGFzc0xpc3QubGVuZ3RoIC0gMSkgLyAyKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzTGlzdC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGlmIChpIDwgbWlkZGxlSW5kZXgpIHtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaSA9PT0gbWlkZGxlSW5kZXgpIHtcbiAgICAgICAgdGFibGVJZCA9IGNsYXNzTGlzdFtpXS50YWJsZS5kdXBsaWNhdGUoKS50YWJsZUlkO1xuICAgICAgICBpZiAoY2xhc3NMaXN0W2ldLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAgIGNvbnN0IHRlbXAgPSBBcnJheS5mcm9tKGNsYXNzTGlzdFtpXS5zb3VyY2VUYWJsZUlkcykucmV2ZXJzZSgpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiB0ZW1wKSB7XG4gICAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NMaXN0W2ldLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBub2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZUVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIHsgc291cmNlLCBlZGdlOiB0aGlzLCB0YXJnZXQgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fFxuICAgICAgKCh0aGlzLnNvdXJjZUNsYXNzICYmIHRoaXMuc291cmNlQ2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpICtcbiAgICAgICctJyArXG4gICAgICAoKHRoaXMudGFyZ2V0Q2xhc3MgJiYgdGhpcy50YXJnZXRDbGFzcy5jbGFzc05hbWUpIHx8ICc/Jyk7XG4gIH1cbiAgZ2V0IHNvdXJjZUNsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBnZXQgdGFyZ2V0Q2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy50YXJnZXRDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlVGFibGVJZHMgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBFZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfc3BsaXRUYWJsZUlkTGlzdCAodGFibGVJZExpc3QsIG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZVRhYmxlSWRMaXN0OiBbXSxcbiAgICAgIGVkZ2VUYWJsZUlkOiBudWxsLFxuICAgICAgZWRnZVRhYmxlSWRMaXN0OiBbXVxuICAgIH07XG4gICAgaWYgKHRhYmxlSWRMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKS50YWJsZUlkO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZSBhcyB0aGUgbmV3IGVkZ2UgdGFibGU7IHByaW9yaXRpemVcbiAgICAgIC8vIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGxldCB0YWJsZURpc3RhbmNlcyA9IHRhYmxlSWRMaXN0Lm1hcCgodGFibGVJZCwgaW5kZXgpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlSWQsIGluZGV4LCBkaXN0OiBNYXRoLmFicyh0YWJsZUlkTGlzdCAvIDIgLSBpbmRleCkgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICB0YWJsZURpc3RhbmNlcyA9IHRhYmxlRGlzdGFuY2VzLmZpbHRlcigoeyB0YWJsZUlkIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGVtcC5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAuc291cmNlVGFibGVJZHMsIHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAudGFyZ2V0VGFibGVJZHMsIHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5zaWRlID09PSAnc291cmNlJykge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5zaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtvcHRpb25zLnNpZGV9XCIgaXMgYW4gaW52YWxpZCBzaWRlYCk7XG4gICAgfVxuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLnByb21vdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5wcm9tb3RlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkICYmIHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgcmV0dXJuIHN1cGVyLnByb21vdGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6ICdOb2RlQ2xhc3MnXG4gICAgICB9KTtcbiAgICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgbm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICAgIHNpZGU6ICF0aGlzLnNvdXJjZUNsYXNzSWQgPyAnc291cmNlJyA6ICd0YXJnZXQnLFxuICAgICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBhdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnLFxuICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAndHJlZWpzb24nOiAndHJlZWpzb24nXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIGZpbmRDbGFzcyAoY2xhc3NOYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lKTtcbiAgfVxuICByZW5hbWUgKG5ld05hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYW5ub3RhdGUgKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuX29yaWdyYXBoLmRlbGV0ZU1vZGVsKHRoaXMubW9kZWxJZCk7XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5tb2RlbHNbdGhpcy5tb2RlbElkXTtcbiAgfVxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHlgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuX29yaWdyYXBoLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAoIWV4dGVuc2lvbikge1xuICAgICAgZXh0ZW5zaW9uID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAobmFtZSkpO1xuICAgIH1cbiAgICBpZiAoREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICghZXJyLmluVXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgZ2V0U2FtcGxlR3JhcGggKHtcbiAgICByb290Q2xhc3MgPSBudWxsLFxuICAgIGJyYW5jaExpbWl0ID0gSW5maW5pdHksXG4gICAgbm9kZUxpbWl0ID0gSW5maW5pdHksXG4gICAgZWRnZUxpbWl0ID0gSW5maW5pdHksXG4gICAgdHJpcGxlTGltaXQgPSBJbmZpbml0eVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBzYW1wbGVHcmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdLFxuICAgICAgZWRnZUxvb2t1cDoge30sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuXG4gICAgbGV0IG51bVRyaXBsZXMgPSAwO1xuICAgIGNvbnN0IGFkZE5vZGUgPSBub2RlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoIDw9IG5vZGVMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZEVkZ2UgPSBlZGdlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoIDw9IGVkZ2VMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZFRyaXBsZSA9IChzb3VyY2UsIGVkZ2UsIHRhcmdldCkgPT4ge1xuICAgICAgaWYgKGFkZE5vZGUoc291cmNlKSAmJiBhZGROb2RlKHRhcmdldCkgJiYgYWRkRWRnZShlZGdlKSkge1xuICAgICAgICBzYW1wbGVHcmFwaC5saW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdLFxuICAgICAgICAgIHRhcmdldDogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgZWRnZTogc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdXG4gICAgICAgIH0pO1xuICAgICAgICBudW1UcmlwbGVzKys7XG4gICAgICAgIHJldHVybiBudW1UcmlwbGVzIDw9IHRyaXBsZUxpbWl0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgY2xhc3NMaXN0ID0gcm9vdENsYXNzID8gW3Jvb3RDbGFzc10gOiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3Nlcyk7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkTm9kZShub2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCBlZGdlLCB0YXJnZXQgfSBvZiBub2RlLnBhaXJ3aXNlTmVpZ2hib3Job29kKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkRWRnZShlZGdlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCB0YXJnZXQgfSBvZiBlZGdlLnBhaXJ3aXNlRWRnZXMoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZUlkTGlzdCkge1xuICAgIGlmICghaW5zdGFuY2VJZExpc3QpIHtcbiAgICAgIC8vIFdpdGhvdXQgc3BlY2lmaWVkIGluc3RhbmNlcywganVzdCBwaWNrIHRoZSBmaXJzdCA1IGZyb20gZWFjaCBub2RlXG4gICAgICAvLyBhbmQgZWRnZSBjbGFzc1xuICAgICAgaW5zdGFuY2VJZExpc3QgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoNSkpIHtcbiAgICAgICAgICAgIGluc3RhbmNlSWRMaXN0LnB1c2goaXRlbS5pbnN0YW5jZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHZXQgdGhlIHNwZWNpZmllZCBpdGVtc1xuICAgIGNvbnN0IG5vZGVJbnN0YW5jZXMgPSB7fTtcbiAgICBjb25zdCBlZGdlSW5zdGFuY2VzID0ge307XG4gICAgZm9yIChjb25zdCBpbnN0YW5jZUlkIG9mIGluc3RhbmNlSWRMaXN0KSB7XG4gICAgICBjb25zdCB7IGNsYXNzSWQsIGluZGV4IH0gPSBKU09OLnBhcnNlKGluc3RhbmNlSWQpO1xuICAgICAgY29uc3QgaW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VJbnN0YW5jZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQWRkIGFueSBub2RlcyBjb25uZWN0ZWQgdG8gb3VyIGVkZ2VzXG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgZWRnZUlkIGluIGVkZ2VJbnN0YW5jZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlSW5zdGFuY2VzW2VkZ2VJZF0ubm9kZXMoKSkge1xuICAgICAgICBpZiAoIW5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIGV4dHJhTm9kZXNbbm9kZS5pbnN0YW5jZUlkXSA9IG5vZGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQWRkIGFueSBlZGdlcyB0aGF0IGNvbm5lY3Qgb3VyIG5vZGVzXG4gICAgY29uc3QgZXh0cmFFZGdlcyA9IHt9O1xuICAgIGZvciAoY29uc3Qgbm9kZUlkIGluIG5vZGVJbnN0YW5jZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBub2RlSW5zdGFuY2VzW25vZGVJZF0uZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VJbnN0YW5jZXNbZWRnZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIC8vIENoZWNrIHRoYXQgYm90aCBlbmRzIG9mIHRoZSBlZGdlIGNvbm5lY3QgYXQgbGVhc3Qgb25lXG4gICAgICAgICAgLy8gb2Ygb3VyIG5vZGVzXG4gICAgICAgICAgbGV0IGNvbm5lY3RzU291cmNlID0gZmFsc2U7XG4gICAgICAgICAgbGV0IGNvbm5lY3RzVGFyZ2V0ID0gZmFsc2U7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVJbnN0YW5jZXNbbm9kZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgICAgICBjb25uZWN0c1NvdXJjZSA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICBpZiAobm9kZUluc3RhbmNlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPa2F5LCBub3cgd2UgaGF2ZSBhIGNvbXBsZXRlIHNldCBvZiBub2RlcyBhbmQgZWRnZXMgdGhhdCB3ZSB3YW50IHRvXG4gICAgLy8gaW5jbHVkZTsgY3JlYXRlIHBhaXJ3aXNlIGVkZ2UgZW50cmllcyBmb3IgZXZlcnkgY29ubmVjdGlvblxuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW11cbiAgICB9O1xuXG4gICAgLy8gQWRkIGFsbCB0aGUgbm9kZXMsIGFuZCBwb3B1bGF0ZSBhIGxvb2t1cCBmb3Igd2hlcmUgdGhleSBhcmUgaW4gdGhlIGxpc3RcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgT2JqZWN0LnZhbHVlcyhub2RlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYU5vZGVzKSkpIHtcbiAgICAgIGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMuLi5cbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlSW5zdGFuY2VzKS5jb25jYXQoT2JqZWN0LnZhbHVlcyhleHRyYUVkZ2VzKSkpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlTm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0Tm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBQb3VjaERCKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMuUG91Y2hEQiA9IFBvdWNoREI7IC8vIGVpdGhlciBwb3VjaGRiLWJyb3dzZXIgb3IgcG91Y2hkYi1ub2RlXG5cbiAgICB0aGlzLnBsdWdpbnMgPSB7fTtcblxuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgbGV0IGV4aXN0aW5nTW9kZWxzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJyk7XG4gICAgaWYgKGV4aXN0aW5nTW9kZWxzKSB7XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXMoSlNPTi5wYXJzZShleGlzdGluZ01vZGVscykpKSB7XG4gICAgICAgIG1vZGVsLm9yaWdyYXBoID0gdGhpcztcbiAgICAgICAgdGhpcy5tb2RlbHNbbW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG1vZGVsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gIH1cbiAgcmVnaXN0ZXJQbHVnaW4gKG5hbWUsIHBsdWdpbikge1xuICAgIHRoaXMucGx1Z2luc1tuYW1lXSA9IHBsdWdpbjtcbiAgfVxuICBzYXZlICgpIHtcbiAgICAvKmlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9Ki9cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwibGVuZ3RoIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl9saW1pdFByb21pc2VzIiwiaXRlcmF0aW9uUmVzZXQiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJlcnIiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsInJlc2V0IiwiZGVyaXZlZFRhYmxlIiwiY291bnRSb3dzIiwid3JhcHBlZEl0ZW0iLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImxvb2t1cCIsImNvbXBsZXRlIiwiZ2V0SXRlbSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZSIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwicHJvbW90ZSIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJkdXBsaWNhdGUiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIlByb21vdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3VuZmluaXNoZWRDYWNoZSIsIl91bmZpbmlzaGVkQ2FjaGVMb29rdXAiLCJ3cmFwcGVkUGFyZW50IiwiU3RyaW5nIiwiZXhpc3RpbmdJdGVtIiwibmV3SXRlbSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsInBUYWJsZSIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiRHVwbGljYXRlZFRhYmxlIiwiY29uY2F0IiwiR2VuZXJpY0NsYXNzIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwiaGFzQ3VzdG9tTmFtZSIsInZhcmlhYmxlTmFtZSIsImZpbHRlciIsImQiLCJ0b0xvY2FsZVVwcGVyQ2FzZSIsImRlbGV0ZWQiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwiZ2V0U2FtcGxlR3JhcGgiLCJyb290Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiZWRnZSIsInBhaXJ3aXNlRWRnZXMiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJwcm9qZWN0TmV3RWRnZSIsImNsYXNzSWRMaXN0IiwiY2xhc3NMaXN0IiwibWlkZGxlSW5kZXgiLCJNYXRoIiwiZmxvb3IiLCJ1bnNoaWZ0IiwiQXJyYXkiLCJmcm9tIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJzb3VyY2UiLCJ0YXJnZXQiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiYWJzIiwic29ydCIsImEiLCJiIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTmV0d29ya01vZGVsIiwib3JpZ3JhcGgiLCJtb2RlbElkIiwiX29yaWdyYXBoIiwiX25leHRDbGFzc0lkIiwiX25leHRUYWJsZUlkIiwiaHlkcmF0ZSIsIkNMQVNTRVMiLCJUQUJMRVMiLCJfc2F2ZVRpbWVvdXQiLCJzYXZlIiwidW5zYXZlZCIsInJhd09iamVjdCIsIlRZUEVTIiwic2VsZWN0b3IiLCJmaW5kQ2xhc3MiLCJyZW5hbWUiLCJuZXdOYW1lIiwiYW5ub3RhdGUiLCJrZXkiLCJkZWxldGVBbm5vdGF0aW9uIiwiZGVsZXRlTW9kZWwiLCJtb2RlbHMiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsIm1pbWUiLCJjaGFyc2V0IiwiZXh0ZW5zaW9uT3ZlcnJpZGUiLCJza2lwU2l6ZUNoZWNrIiwiZmlsZU1CIiwic2l6ZSIsImNvbnNvbGUiLCJ3YXJuIiwidGV4dCIsInJlYWRlciIsIkZpbGVSZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiZGVsZXRlQWxsVW51c2VkVGFibGVzIiwiYnJhbmNoTGltaXQiLCJub2RlTGltaXQiLCJlZGdlTGltaXQiLCJ0cmlwbGVMaW1pdCIsInNhbXBsZUdyYXBoIiwibm9kZUxvb2t1cCIsImVkZ2VMb29rdXAiLCJsaW5rcyIsIm51bVRyaXBsZXMiLCJhZGROb2RlIiwibm9kZSIsImFkZEVkZ2UiLCJhZGRUcmlwbGUiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VJZExpc3QiLCJub2RlSW5zdGFuY2VzIiwiZWRnZUluc3RhbmNlcyIsIkpTT04iLCJwYXJzZSIsImluc3RhbmNlIiwiZXh0cmFOb2RlcyIsImV4dHJhRWRnZXMiLCJub2RlSWQiLCJjb25uZWN0c1NvdXJjZSIsImNvbm5lY3RzVGFyZ2V0IiwiZ3JhcGgiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldE1vZGVsRHVtcCIsInJhd09iaiIsInN0cmluZ2lmeSIsImFIYXNoIiwiYkhhc2giLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJzb3VyY2VDbGFzc2VzIiwidGFyZ2V0Q2xhc3NlcyIsInRhYmxlRGVwZW5kZW5jaWVzIiwiY29yZVRhYmxlcyIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsIlBvdWNoREIiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJsb2NhbFN0b3JhZ2UiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FBTCxHQUFzQixFQUF0QjtXQUNLQyxlQUFMLEdBQXVCLEVBQXZCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDbkIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7V0FDS1AsY0FBTCxDQUFvQkssS0FBcEIsSUFBNkIsS0FBS0wsY0FBTCxDQUFvQkssS0FBcEIsS0FDM0I7WUFBTTtPQURSOztVQUVJLENBQUNDLFNBQUwsRUFBZ0I7YUFDVE4sY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFBK0JHLElBQS9CLENBQW9DSixRQUFwQztPQURGLE1BRU87YUFDQUosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkJDLFNBQTNCLElBQXdDRixRQUF4Qzs7OztJQUdKSyxHQUFHLENBQUVOLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6Qjs7VUFDSSxLQUFLUCxjQUFMLENBQW9CSyxLQUFwQixDQUFKLEVBQWdDO1lBQzFCLENBQUNDLFNBQUwsRUFBZ0I7Y0FDVixDQUFDRixRQUFMLEVBQWU7aUJBQ1JKLGNBQUwsQ0FBb0JLLEtBQXBCLEVBQTJCLEVBQTNC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
