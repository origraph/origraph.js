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
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this2.iterate(limit)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
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
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this3.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this3._getExistingTable(options) || _this3._deriveTable(options);
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

  async getInstanceGraph(instances) {
    if (!instances) {
      // Without specified instances, just pick the first 5 from each node
      // and edge class
      instances = [];

      for (const classObj of Object.values(this.classes)) {
        if (classObj.type === 'Node' || classObj.type === 'Edge') {
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;

          var _iteratorError5;

          try {
            for (var _iterator5 = _asyncIterator(classObj.table.iterate(5)), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
              const item = _value5;
              instances.push(item);
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
    }

    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };
    const edgeTableEntries = [];

    for (const instance of instances) {
      if (instance.type === 'Node') {
        graph.nodeLookup[instance.instanceId] = graph.nodes.length;
        graph.nodes.push({
          nodeInstance: instance,
          dummy: false
        });
      } else if (instance.type === 'Edge') {
        edgeTableEntries.push(instance);
      }
    }

    for (const edgeInstance of edgeTableEntries) {
      const sources = [];
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;

      var _iteratorError6;

      try {
        for (var _iterator6 = _asyncIterator(edgeInstance.sourceNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
          const source = _value6;

          if (graph.nodeLookup[source.instanceId] !== undefined) {
            sources.push(graph.nodeLookup[source.instanceId]);
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

      const targets = [];
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;

      var _iteratorError7;

      try {
        for (var _iterator7 = _asyncIterator(edgeInstance.targetNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
          const target = _value7;

          if (graph.nodeLookup[target.instanceId] !== undefined) {
            targets.push(graph.nodeLookup[target.instanceId]);
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

      if (sources.length === 0) {
        if (targets.length === 0) {
          // We have completely hanging edges, make dummy nodes for the
          // source and target
          graph.edges.push({
            edgeInstance,
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
          // The sources are hanging, but we have targets
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source: graph.nodes.length,
              target
            });
            graph.nodes.push({
              dummy: true
            });
          }
        }
      } else if (targets.length === 0) {
        // The targets are hanging, but we have sources
        for (const source of sources) {
          graph.edges.push({
            edgeInstance,
            source,
            target: graph.nodes.length
          });
          graph.nodes.push({
            dummy: true
          });
        }
      } else {
        // Neither the source, nor the target are hanging
        for (const source of sources) {
          for (const target of targets) {
            graph.edges.push({
              edgeInstance,
              source,
              target
            });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL1Byb21vdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZhY2V0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvVHJhbnNwb3NlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gICAgdGhpcy5kdXBsaWNhdGVJdGVtcyA9IG9wdGlvbnMuZHVwbGljYXRlSXRlbXMgfHwgW107XG4gIH1cbiAgcmVnaXN0ZXJEdXBsaWNhdGUgKGl0ZW0pIHtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zLnB1c2goaXRlbSk7XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZHVwIG9mIHRoaXMuZHVwbGljYXRlSXRlbXMpIHtcbiAgICAgIGl0ZW0uY29ubmVjdEl0ZW0oZHVwKTtcbiAgICAgIGR1cC5jb25uZWN0SXRlbShpdGVtKTtcbiAgICB9XG4gIH1cbiAgZGlzY29ubmVjdCAoKSB7XG4gICAgZm9yIChjb25zdCBpdGVtTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuY29ubmVjdGVkSXRlbXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbUxpc3QpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSAoaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdIHx8IFtdKS5pbmRleE9mKHRoaXMpO1xuICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgaXRlbS5jb25uZWN0ZWRJdGVtc1t0aGlzLnRhYmxlLnRhYmxlSWRdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IHt9O1xuICB9XG4gIGdldCBpbnN0YW5jZUlkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBlcXVhbHMgKGl0ZW0pIHtcbiAgICByZXR1cm4gdGhpcy5pbnN0YW5jZUlkID09PSBpdGVtLmluc3RhbmNlSWQ7XG4gIH1cbiAgYXN5bmMgKiBoYW5kbGVMaW1pdCAob3B0aW9ucywgaXRlcmF0b3JzKSB7XG4gICAgbGV0IGxpbWl0ID0gSW5maW5pdHk7XG4gICAgaWYgKG9wdGlvbnMubGltaXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbGltaXQgPSBvcHRpb25zLmxpbWl0O1xuICAgICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgfVxuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZXJhdG9yIG9mIGl0ZXJhdG9ycykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGl0ZXJhdG9yKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICAgIGkrKztcbiAgICAgICAgaWYgKGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRhYmxlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgeWllbGQgKiAodGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkc1swXV0gfHwgW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0aGlzVGFibGVJZCA9IHRhYmxlSWRzWzBdO1xuICAgICAgY29uc3QgcmVtYWluaW5nVGFibGVJZHMgPSB0YWJsZUlkcy5zbGljZSgxKTtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmNvbm5lY3RlZEl0ZW1zW3RoaXNUYWJsZUlkXSB8fCBbXSkge1xuICAgICAgICB5aWVsZCAqIGl0ZW0uX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdUYWJsZUlkcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleEZpbHRlciA9IChvcHRpb25zLmluZGV4RmlsdGVyICYmIHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX2xpbWl0UHJvbWlzZXMgPSB7fTtcblxuICAgIHRoaXMuaXRlcmF0aW9uUmVzZXQgPSBuZXcgRXJyb3IoJ0l0ZXJhdGlvbiByZXNldCcpO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4RmlsdGVyOiAodGhpcy5faW5kZXhGaWx0ZXIgJiYgdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleEZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGU7XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgLy8gVGhlIGNhY2hlIGhhcyBhbHJlYWR5IGJlZW4gYnVpbHQ7IGp1c3QgZ3JhYiBkYXRhIGZyb20gaXQgZGlyZWN0bHlcbiAgICAgIHlpZWxkICogdGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlICYmIHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGggPj0gbGltaXQpIHtcbiAgICAgIC8vIFRoZSBjYWNoZSBpc24ndCBmaW5pc2hlZCwgYnV0IGl0J3MgYWxyZWFkeSBsb25nIGVub3VnaCB0byBzYXRpc2Z5IHRoaXNcbiAgICAgIC8vIHJlcXVlc3RcbiAgICAgIHlpZWxkICogdGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkIGJ1aWxkaW5nIChhbmQgbWF5YmUgZGlkbid0IGV2ZW4gc3RhcnQgeWV0KTtcbiAgICAgIC8vIGtpY2sgaXQgb2ZmLCBhbmQgdGhlbiB3YWl0IGZvciBlbm91Z2ggaXRlbXMgdG8gYmUgcHJvY2Vzc2VkIHRvIHNhdGlzZnlcbiAgICAgIC8vIHRoZSBsaW1pdFxuICAgICAgdGhpcy5idWlsZENhY2hlKCk7XG4gICAgICB5aWVsZCAqIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0gPSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSB8fCBbXTtcbiAgICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0ucHVzaCh7IHJlc29sdmUsIHJlamVjdCB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IFtdO1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZSgpO1xuICAgIGxldCBpID0gMDtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyB1cHN0cmVhbSAoc29tZXRoaW5nIHRoYXQgdGhpcy5faXRlcmF0ZVxuICAgICAgICAvLyBkZXBlbmRzIG9uIHdhcyByZXNldCBvciB0aHJldyBhIHJlYWwgZXJyb3IpXG4gICAgICAgIGlmIChlcnIgPT09IHRoaXMuaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBoYW5kbGVSZXNldCAocmVqZWN0KSB7XG4gICAgZm9yIChjb25zdCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0ucmVqZWN0KHRoaXMuaXRlcmF0aW9uUmVzZXQpO1xuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXM7XG4gICAgfVxuICAgIHJlamVjdCh0aGlzLml0ZXJhdGlvblJlc2V0KTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4RmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGF3YWl0IGZ1bmMoYXdhaXQgd3JhcHBlZEl0ZW0ucm93W2F0dHJdKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhZGRGaWx0ZXIgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4RmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnUHJvbW90ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9uYW1lO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aXJlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBQcm9tb3RlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgX2J1aWxkQ2FjaGUgKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgd2FudCB0byBjYWxsIF9maW5pc2hJdGVtXG4gICAgLy8gdW50aWwgYWxsIHVuaXF1ZSB2YWx1ZXMgaGF2ZSBiZWVuIHNlZW5cbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXAgPSB7fTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSBbXTtcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgPSB7fTtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUoKTtcbiAgICBsZXQgdGVtcCA9IHsgZG9uZTogZmFsc2UgfTtcbiAgICB3aGlsZSAoIXRlbXAuZG9uZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyB1cHN0cmVhbSAoc29tZXRoaW5nIHRoYXQgdGhpcy5faXRlcmF0ZVxuICAgICAgICAvLyBkZXBlbmRzIG9uIHdhcyByZXNldCBvciB0aHJldyBhIHJlYWwgZXJyb3IpXG4gICAgICAgIGlmIChlcnIgPT09IHRoaXMuaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICB0aGlzLmhhbmRsZVJlc2V0KHJlamVjdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW3RlbXAudmFsdWUuaW5kZXhdID0gdGhpcy5fdW5maW5pc2hlZENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdW5maW5pc2hlZENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE9rYXksIG5vdyB3ZSd2ZSBzZWVuIGV2ZXJ5dGhpbmc7IHdlIGNhbiBjYWxsIF9maW5pc2hJdGVtIG9uIGVhY2ggb2YgdGhlXG4gICAgLy8gdW5pcXVlIHZhbHVlc1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX3VuZmluaXNoZWRDYWNoZSkge1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odmFsdWUpKSB7XG4gICAgICAgIC8vIE9rYXksIHRoaXMgaXRlbSBwYXNzZWQgYWxsIGZpbHRlcnMsIGFuZCBpcyByZWFkeSB0byBiZSBzZW50IG91dFxuICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbdmFsdWUuaW5kZXhdID0gdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godmFsdWUpO1xuICAgICAgICBpKys7XG4gICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIHdlIGhhdmUgZW5vdWdoIGRhdGEgbm93IHRvIHNhdGlzZnkgYW55IHdhaXRpbmcgcmVxdWVzdHNcbiAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICAgICAgICByZXNvbHZlKHRoaXMuX3BhcnRpYWxDYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBEb25lIGl0ZXJhdGluZyEgV2UgY2FuIGdyYWR1YXRlIHRoZSBwYXJ0aWFsIGNhY2hlIC8gbG9va3VwcyBpbnRvXG4gICAgLy8gZmluaXNoZWQgb25lcywgYW5kIHNhdGlzZnkgYWxsIHRoZSByZXF1ZXN0c1xuICAgIGRlbGV0ZSB0aGlzLl91bmZpbmlzaGVkQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cDtcbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIHRoaXMuX2NhY2hlTG9va3VwID0gdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgIGxpbWl0ID0gTnVtYmVyKGxpbWl0KTtcbiAgICAgIGZvciAoY29uc3QgeyByZXNvbHZlIH0gb2YgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF0pIHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCkpO1xuICAgICAgfVxuICAgICAgZGVsZXRlIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIHRoaXMudHJpZ2dlcignY2FjaGVCdWlsdCcpO1xuICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyhhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQhXG4gICAgICAgIHRocm93IHRoaXMuaXRlcmF0aW9uUmVzZXQ7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGVbdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFByb21vdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX2F0dHJpYnV0ZSArIHRoaXMuX3ZhbHVlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGlmIChhd2FpdCB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9pbmRleDtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGDhtYAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGF3YWl0IHRoaXMucGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHRoaXMucGFyZW50VGFibGUuX2NhY2hlW3RoaXMucGFyZW50VGFibGUuX2NhY2hlTG9va3VwW3RoaXMuX2luZGV4XV0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLmdldFNvcnRIYXNoKCkpLmpvaW4oJywnKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBEb24ndCB0cnkgdG8gY29ubmVjdCB2YWx1ZXMgdW50aWwgYWxsIG9mIHRoZSBwYXJlbnQgdGFibGVzJyBjYWNoZXMgYXJlXG4gICAgLy8gYnVpbHQ7IFRPRE86IG1pZ2h0IGJlIGFibGUgdG8gZG8gc29tZXRoaW5nIG1vcmUgcmVzcG9uc2l2ZSBoZXJlP1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHBhcmVudFRhYmxlcy5tYXAocFRhYmxlID0+IHBUYWJsZS5idWlsZENhY2hlKCkpKTtcblxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlTG9va3VwKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVMb29rdXApKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQsIG1lYW5pbmcgd2UgbmVlZCB0byByZXNldCBhcyB3ZWxsXG4gICAgICAgIHRocm93IHRoaXMuaXRlcmF0aW9uUmVzZXQ7XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cFtpbmRleF0gIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XV0pXG4gICAgICB9KTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRHVwbGljYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAnKic7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIC8vIFlpZWxkIHRoZSBzYW1lIGl0ZW1zIHdpdGggdGhlIHNhbWUgY29ubmVjdGlvbnMsIGJ1dCB3cmFwcGVkIGFuZCBmaW5pc2hlZFxuICAgIC8vIGJ5IHRoaXMgdGFibGVcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5wYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXg6IGl0ZW0uaW5kZXgsXG4gICAgICAgIHJvdzogaXRlbS5yb3csXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBPYmplY3QudmFsdWVzKGl0ZW0uY29ubmVjdGVkSXRlbXMpLnJlZHVjZSgoYWdnLCBpdGVtTGlzdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBhZ2cuY29uY2F0KGl0ZW1MaXN0KTtcbiAgICAgICAgfSwgW10pXG4gICAgICB9KTtcbiAgICAgIGl0ZW0ucmVnaXN0ZXJEdXBsaWNhdGUobmV3SXRlbSk7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiB0aGlzLnR5cGUgKyB0aGlzLmNsYXNzTmFtZTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcydcbiAgICB9KTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0U2FtcGxlR3JhcGggKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnJvb3RDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuZ2V0U2FtcGxlR3JhcGgob3B0aW9ucyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcyhvcHRpb25zKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlRWRnZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5wcm9tb3RlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6ICdOb2RlQ2xhc3MnXG4gICAgfSk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBwcm9qZWN0TmV3RWRnZSAoY2xhc3NJZExpc3QpIHtcbiAgICBjb25zdCBjbGFzc0xpc3QgPSBjbGFzc0lkTGlzdC5tYXAoY2xhc3NJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jbGFzc2VzW2NsYXNzSWRdO1xuICAgIH0pO1xuICAgIGlmIChjbGFzc0xpc3QubGVuZ3RoIDwgMiB8fCBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLnR5cGUgIT09ICdOb2RlJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNsYXNzSWRMaXN0YCk7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZUNsYXNzSWQgPSB0aGlzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIGNvbnN0IHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgbGV0IHRhYmxlSWQ7XG4gICAgY29uc3QgbWlkZGxlSW5kZXggPSBNYXRoLmZsb29yKChjbGFzc0xpc3QubGVuZ3RoIC0gMSkgLyAyKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsYXNzTGlzdC5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgIGlmIChpIDwgbWlkZGxlSW5kZXgpIHtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgc291cmNlVGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaSA9PT0gbWlkZGxlSW5kZXgpIHtcbiAgICAgICAgdGFibGVJZCA9IGNsYXNzTGlzdFtpXS50YWJsZS5kdXBsaWNhdGUoKS50YWJsZUlkO1xuICAgICAgICBpZiAoY2xhc3NMaXN0W2ldLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAgIGNvbnN0IHRlbXAgPSBBcnJheS5mcm9tKGNsYXNzTGlzdFtpXS5zb3VyY2VUYWJsZUlkcykucmV2ZXJzZSgpO1xuICAgICAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiB0ZW1wKSB7XG4gICAgICAgICAgICBzb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NMaXN0W2ldLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRhYmxlSWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGNsYXNzTGlzdFtpXS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgICB0YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGNsYXNzTGlzdFtpXS50YWJsZUlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB0ZW1wID0gQXJyYXkuZnJvbShjbGFzc0xpc3RbaV0uc291cmNlVGFibGVJZHMpLnJldmVyc2UoKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgdGVtcCkge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdChjbGFzc0xpc3RbaV0udGFibGVJZCk7XG4gICAgICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzTGlzdFtpXS50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICAgICAgdGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0YWJsZUlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZCxcbiAgICAgIHRhcmdldENsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldFRhYmxlSWRzXG4gICAgfSk7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBub2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZUVkZ2VzIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIHsgc291cmNlLCBlZGdlOiB0aGlzLCB0YXJnZXQgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBFZGdlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG5cbiAgICAvLyBzb3VyY2VUYWJsZUlkcyBhbmQgdGFyZ2V0VGFibGVJZHMgYXJlIGxpc3RzIG9mIGFueSBpbnRlcm1lZGlhdGUgdGFibGVzLFxuICAgIC8vIGJlZ2lubmluZyB3aXRoIHRoZSBlZGdlIHRhYmxlIChidXQgbm90IGluY2x1ZGluZyBpdCksIHRoYXQgbGVhZCB0byB0aGVcbiAgICAvLyBzb3VyY2UgLyB0YXJnZXQgbm9kZSB0YWJsZXMgKGJ1dCBub3QgaW5jbHVkaW5nKSB0aG9zZVxuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMuc291cmNlVGFibGVJZHMgfHwgW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgfHwgW107XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fFxuICAgICAgKCh0aGlzLnNvdXJjZUNsYXNzICYmIHRoaXMuc291cmNlQ2xhc3MuY2xhc3NOYW1lKSB8fCAnPycpICtcbiAgICAgICctJyArXG4gICAgICAoKHRoaXMudGFyZ2V0Q2xhc3MgJiYgdGhpcy50YXJnZXRDbGFzcy5jbGFzc05hbWUpIHx8ICc/Jyk7XG4gIH1cbiAgZ2V0IHNvdXJjZUNsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBnZXQgdGFyZ2V0Q2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy50YXJnZXRDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlVGFibGVJZHMgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBFZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfc3BsaXRUYWJsZUlkTGlzdCAodGFibGVJZExpc3QsIG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZVRhYmxlSWRMaXN0OiBbXSxcbiAgICAgIGVkZ2VUYWJsZUlkOiBudWxsLFxuICAgICAgZWRnZVRhYmxlSWRMaXN0OiBbXVxuICAgIH07XG4gICAgaWYgKHRhYmxlSWRMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKS50YWJsZUlkO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZSBhcyB0aGUgbmV3IGVkZ2UgdGFibGU7IHByaW9yaXRpemVcbiAgICAgIC8vIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGxldCB0YWJsZURpc3RhbmNlcyA9IHRhYmxlSWRMaXN0Lm1hcCgodGFibGVJZCwgaW5kZXgpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlSWQsIGluZGV4LCBkaXN0OiBNYXRoLmFicyh0YWJsZUlkTGlzdCAvIDIgLSBpbmRleCkgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICB0YWJsZURpc3RhbmNlcyA9IHRhYmxlRGlzdGFuY2VzLmZpbHRlcigoeyB0YWJsZUlkIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGVtcC5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAuc291cmNlVGFibGVJZHMsIHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAudGFyZ2V0VGFibGVJZHMsIHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5zaWRlID09PSAnc291cmNlJykge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5zaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtvcHRpb25zLnNpZGV9XCIgaXMgYW4gaW52YWxpZCBzaWRlYCk7XG4gICAgfVxuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLnByb21vdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5wcm9tb3RlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBwcm9tb3RlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkICYmIHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgcmV0dXJuIHN1cGVyLnByb21vdGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6ICdOb2RlQ2xhc3MnXG4gICAgICB9KTtcbiAgICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgbm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICAgIHNpZGU6ICF0aGlzLnNvdXJjZUNsYXNzSWQgPyAnc291cmNlJyA6ICd0YXJnZXQnLFxuICAgICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBhdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgbWltZSBmcm9tICdtaW1lLXR5cGVzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuXG5pbXBvcnQgKiBhcyBUQUJMRVMgZnJvbSAnLi4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4uL0NsYXNzZXMvQ2xhc3Nlcy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnLFxuICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAndHJlZWpzb24nOiAndHJlZWpzb24nXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHt0aGlzLl9uZXh0Q2xhc3NJZH1gO1xuICAgICAgdGhpcy5fbmV4dENsYXNzSWQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIGZpbmRDbGFzcyAoY2xhc3NOYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lKTtcbiAgfVxuICByZW5hbWUgKG5ld05hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYW5ub3RhdGUgKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuX29yaWdyYXBoLmRlbGV0ZU1vZGVsKHRoaXMubW9kZWxJZCk7XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5tb2RlbHNbdGhpcy5tb2RlbElkXTtcbiAgfVxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHlgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuX29yaWdyYXBoLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uLCB0ZXh0IH0pIHtcbiAgICBsZXQgZGF0YSwgYXR0cmlidXRlcztcbiAgICBpZiAoIWV4dGVuc2lvbikge1xuICAgICAgZXh0ZW5zaW9uID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAobmFtZSkpO1xuICAgIH1cbiAgICBpZiAoREFUQUxJQl9GT1JNQVRTW2V4dGVuc2lvbl0pIHtcbiAgICAgIGRhdGEgPSBkYXRhbGliLnJlYWQodGV4dCwgeyB0eXBlOiBleHRlbnNpb24gfSk7XG4gICAgICBpZiAoZXh0ZW5zaW9uID09PSAnY3N2JyB8fCBleHRlbnNpb24gPT09ICd0c3YnKSB7XG4gICAgICAgIGF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGRhdGEuY29sdW1ucykge1xuICAgICAgICAgIGF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBkYXRhLmNvbHVtbnM7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd4bWwnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3R4dCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUoeyBuYW1lLCBkYXRhLCBhdHRyaWJ1dGVzIH0pO1xuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBkZWxldGVBbGxVbnVzZWRUYWJsZXMgKCkge1xuICAgIGZvciAoY29uc3QgdGFibGVJZCBpbiB0aGlzLnRhYmxlcykge1xuICAgICAgaWYgKHRoaXMudGFibGVzW3RhYmxlSWRdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGlmICghZXJyLmluVXNlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgZ2V0U2FtcGxlR3JhcGggKHtcbiAgICByb290Q2xhc3MgPSBudWxsLFxuICAgIGJyYW5jaExpbWl0ID0gSW5maW5pdHksXG4gICAgbm9kZUxpbWl0ID0gSW5maW5pdHksXG4gICAgZWRnZUxpbWl0ID0gSW5maW5pdHksXG4gICAgdHJpcGxlTGltaXQgPSBJbmZpbml0eVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBzYW1wbGVHcmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdLFxuICAgICAgZWRnZUxvb2t1cDoge30sXG4gICAgICBsaW5rczogW11cbiAgICB9O1xuXG4gICAgbGV0IG51bVRyaXBsZXMgPSAwO1xuICAgIGNvbnN0IGFkZE5vZGUgPSBub2RlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoIDw9IG5vZGVMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZEVkZ2UgPSBlZGdlID0+IHtcbiAgICAgIGlmIChzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF0gPSBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGg7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VzLnB1c2goZWRnZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2FtcGxlR3JhcGguZWRnZXMubGVuZ3RoIDw9IGVkZ2VMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZFRyaXBsZSA9IChzb3VyY2UsIGVkZ2UsIHRhcmdldCkgPT4ge1xuICAgICAgaWYgKGFkZE5vZGUoc291cmNlKSAmJiBhZGROb2RlKHRhcmdldCkgJiYgYWRkRWRnZShlZGdlKSkge1xuICAgICAgICBzYW1wbGVHcmFwaC5saW5rcy5wdXNoKHtcbiAgICAgICAgICBzb3VyY2U6IHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdLFxuICAgICAgICAgIHRhcmdldDogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgZWRnZTogc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdXG4gICAgICAgIH0pO1xuICAgICAgICBudW1UcmlwbGVzKys7XG4gICAgICAgIHJldHVybiBudW1UcmlwbGVzIDw9IHRyaXBsZUxpbWl0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBsZXQgY2xhc3NMaXN0ID0gcm9vdENsYXNzID8gW3Jvb3RDbGFzc10gOiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3Nlcyk7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkTm9kZShub2RlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCBlZGdlLCB0YXJnZXQgfSBvZiBub2RlLnBhaXJ3aXNlTmVpZ2hib3Job29kKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoIWFkZFRyaXBsZShzb3VyY2UsIGVkZ2UsIHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmICghYWRkRWRnZShlZGdlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHsgc291cmNlLCB0YXJnZXQgfSBvZiBlZGdlLnBhaXJ3aXNlRWRnZXMoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZUdyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBpZiAoIWluc3RhbmNlcykge1xuICAgICAgLy8gV2l0aG91dCBzcGVjaWZpZWQgaW5zdGFuY2VzLCBqdXN0IHBpY2sgdGhlIGZpcnN0IDUgZnJvbSBlYWNoIG5vZGVcbiAgICAgIC8vIGFuZCBlZGdlIGNsYXNzXG4gICAgICBpbnN0YW5jZXMgPSBbXTtcbiAgICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgfHwgY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoNSkpIHtcbiAgICAgICAgICAgIGluc3RhbmNlcy5wdXNoKGl0ZW0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW11cbiAgICB9O1xuICAgIGNvbnN0IGVkZ2VUYWJsZUVudHJpZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIGluc3RhbmNlcykge1xuICAgICAgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBncmFwaC5ub2RlTG9va3VwW2luc3RhbmNlLmluc3RhbmNlSWRdID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHtcbiAgICAgICAgICBub2RlSW5zdGFuY2U6IGluc3RhbmNlLFxuICAgICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGVkZ2VUYWJsZUVudHJpZXMucHVzaChpbnN0YW5jZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgZWRnZUluc3RhbmNlIG9mIGVkZ2VUYWJsZUVudHJpZXMpIHtcbiAgICAgIGNvbnN0IHNvdXJjZXMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2VJbnN0YW5jZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgc291cmNlcy5wdXNoKGdyYXBoLm5vZGVMb29rdXBbc291cmNlLmluc3RhbmNlSWRdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgdGFyZ2V0cyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZUluc3RhbmNlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Lmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0YXJnZXRzLnB1c2goZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXQuaW5zdGFuY2VJZF0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc291cmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgaWYgKHRhcmdldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgLy8gV2UgaGF2ZSBjb21wbGV0ZWx5IGhhbmdpbmcgZWRnZXMsIG1ha2UgZHVtbXkgbm9kZXMgZm9yIHRoZVxuICAgICAgICAgIC8vIHNvdXJjZSBhbmQgdGFyZ2V0XG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gVGhlIHNvdXJjZXMgYXJlIGhhbmdpbmcsIGJ1dCB3ZSBoYXZlIHRhcmdldHNcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgdGFyZ2V0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGFyZ2V0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gVGhlIHRhcmdldHMgYXJlIGhhbmdpbmcsIGJ1dCB3ZSBoYXZlIHNvdXJjZXNcbiAgICAgICAgZm9yIChjb25zdCBzb3VyY2Ugb2Ygc291cmNlcykge1xuICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgc291cmNlLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGhcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5laXRoZXIgdGhlIHNvdXJjZSwgbm9yIHRoZSB0YXJnZXQgYXJlIGhhbmdpbmdcbiAgICAgICAgZm9yIChjb25zdCBzb3VyY2Ugb2Ygc291cmNlcykge1xuICAgICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRhcmdldHMpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2UsXG4gICAgICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICAgICAgdGFyZ2V0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChGaWxlUmVhZGVyLCBQb3VjaERCKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLkZpbGVSZWFkZXIgPSBGaWxlUmVhZGVyOyAvLyBlaXRoZXIgd2luZG93LkZpbGVSZWFkZXIgb3Igb25lIGZyb20gTm9kZVxuICAgIHRoaXMuUG91Y2hEQiA9IFBvdWNoREI7IC8vIGVpdGhlciBwb3VjaGRiLWJyb3dzZXIgb3IgcG91Y2hkYi1ub2RlXG5cbiAgICB0aGlzLnBsdWdpbnMgPSB7fTtcblxuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgbGV0IGV4aXN0aW5nTW9kZWxzID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJyk7XG4gICAgaWYgKGV4aXN0aW5nTW9kZWxzKSB7XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXMoSlNPTi5wYXJzZShleGlzdGluZ01vZGVscykpKSB7XG4gICAgICAgIG1vZGVsLm9yaWdyYXBoID0gdGhpcztcbiAgICAgICAgdGhpcy5tb2RlbHNbbW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG1vZGVsKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gIH1cbiAgcmVnaXN0ZXJQbHVnaW4gKG5hbWUsIHBsdWdpbikge1xuICAgIHRoaXMucGx1Z2luc1tuYW1lXSA9IHBsdWdpbjtcbiAgfVxuICBzYXZlICgpIHtcbiAgICAvKmlmICh0aGlzLmxvY2FsU3RvcmFnZSkge1xuICAgICAgY29uc3QgbW9kZWxzID0ge307XG4gICAgICBmb3IgKGNvbnN0IFttb2RlbElkLCBtb2RlbF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5tb2RlbHMpKSB7XG4gICAgICAgIG1vZGVsc1ttb2RlbElkXSA9IG1vZGVsLl90b1Jhd09iamVjdCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnb3JpZ3JhcGhfbW9kZWxzJywgSlNPTi5zdHJpbmdpZnkobW9kZWxzKSk7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3NhdmUnKTtcbiAgICB9Ki9cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwibGVuZ3RoIiwidGhpc1RhYmxlSWQiLCJyZW1haW5pbmdUYWJsZUlkcyIsInNsaWNlIiwiZXhlYyIsIm5hbWUiLCJUYWJsZSIsIl9leHBlY3RlZEF0dHJpYnV0ZXMiLCJhdHRyaWJ1dGVzIiwiX29ic2VydmVkQXR0cmlidXRlcyIsIl9kZXJpdmVkVGFibGVzIiwiZGVyaXZlZFRhYmxlcyIsIl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiaHlkcmF0ZUZ1bmN0aW9uIiwiX3N1cHByZXNzZWRBdHRyaWJ1dGVzIiwic3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJfc3VwcHJlc3NJbmRleCIsInN1cHByZXNzSW5kZXgiLCJfaW5kZXhGaWx0ZXIiLCJpbmRleEZpbHRlciIsIl9hdHRyaWJ1dGVGaWx0ZXJzIiwiYXR0cmlidXRlRmlsdGVycyIsIl9saW1pdFByb21pc2VzIiwiaXRlcmF0aW9uUmVzZXQiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJlcnIiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsInJlc2V0IiwiZGVyaXZlZFRhYmxlIiwiY291bnRSb3dzIiwid3JhcHBlZEl0ZW0iLCJrZWVwIiwiX3dyYXAiLCJvdGhlckl0ZW0iLCJpdGVtc1RvQ29ubmVjdCIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImxvb2t1cCIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJwcm9tb3RlIiwiY2xvc2VkRmFjZXQiLCJvcGVuRmFjZXQiLCJjbG9zZWRUcmFuc3Bvc2UiLCJpbmRleGVzIiwib3BlblRyYW5zcG9zZSIsImR1cGxpY2F0ZSIsImNvbm5lY3QiLCJvdGhlclRhYmxlTGlzdCIsIm90aGVyVGFibGUiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiUHJvbW90ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJjb25jYXQiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZmlsdGVyIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJnZXRTYW1wbGVHcmFwaCIsInJvb3RDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImF1dG9jb25uZWN0IiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJtaWRkbGVJbmRleCIsIk1hdGgiLCJmbG9vciIsInVuc2hpZnQiLCJBcnJheSIsImZyb20iLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VOb2RlcyIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXROb2RlcyIsInRhcmdldFRhYmxlSWQiLCJub2RlcyIsInNvdXJjZSIsInRhcmdldCIsIkVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJhYnMiLCJzb3J0IiwiYSIsImIiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsIm1vZGVscyIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwibWltZSIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwicmVhZGVyIiwiRmlsZVJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJicmFuY2hMaW1pdCIsIm5vZGVMaW1pdCIsImVkZ2VMaW1pdCIsInRyaXBsZUxpbWl0Iiwic2FtcGxlR3JhcGgiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsImxpbmtzIiwibnVtVHJpcGxlcyIsImFkZE5vZGUiLCJub2RlIiwiYWRkRWRnZSIsImFkZFRyaXBsZSIsImdldEluc3RhbmNlR3JhcGgiLCJpbnN0YW5jZXMiLCJncmFwaCIsImVkZ2VUYWJsZUVudHJpZXMiLCJpbnN0YW5jZSIsIm5vZGVJbnN0YW5jZSIsImR1bW15IiwiZWRnZUluc3RhbmNlIiwic291cmNlcyIsInRhcmdldHMiLCJnZXROZXR3b3JrTW9kZWxHcmFwaCIsInJhdyIsImluY2x1ZGVEdW1taWVzIiwiY2xhc3NMb29rdXAiLCJjbGFzc0Nvbm5lY3Rpb25zIiwiY2xhc3NTcGVjIiwiaWQiLCJsb2NhdGlvbiIsImdldFRhYmxlRGVwZW5kZW5jeUdyYXBoIiwidGFibGVMb29rdXAiLCJ0YWJsZUxpbmtzIiwidGFibGVMaXN0IiwidGFibGVTcGVjIiwiZ2V0TW9kZWxEdW1wIiwicmF3T2JqIiwiSlNPTiIsInBhcnNlIiwic3RyaW5naWZ5IiwiYUhhc2giLCJiSGFzaCIsImNyZWF0ZVNjaGVtYU1vZGVsIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsInNvdXJjZUNsYXNzZXMiLCJ0YXJnZXRDbGFzc2VzIiwidGFibGVEZXBlbmRlbmNpZXMiLCJjb3JlVGFibGVzIiwiTkVYVF9NT0RFTF9JRCIsIk9yaWdyYXBoIiwiUG91Y2hEQiIsInBsdWdpbnMiLCJleGlzdGluZ01vZGVscyIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7QUFBQSxNQUFNQSxnQkFBZ0IsR0FBRyxVQUFVQyxVQUFWLEVBQXNCO1NBQ3RDLGNBQWNBLFVBQWQsQ0FBeUI7SUFDOUJDLFdBQVcsR0FBSTtZQUNQLEdBQUdDLFNBQVQ7V0FDS0MsMkJBQUwsR0FBbUMsSUFBbkM7V0FDS0MsY0FBTCxHQUFzQixFQUF0QjtXQUNLQyxlQUFMLEdBQXVCLEVBQXZCOzs7SUFFRkMsRUFBRSxDQUFFQyxTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDbkIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7V0FDS1AsY0FBTCxDQUFvQkssS0FBcEIsSUFBNkIsS0FBS0wsY0FBTCxDQUFvQkssS0FBcEIsS0FDM0I7WUFBTTtPQURSOztVQUVJLENBQUNDLFNBQUwsRUFBZ0I7YUFDVE4sY0FBTCxDQUFvQkssS0FBcEIsRUFBMkIsRUFBM0IsRUFBK0JHLElBQS9CLENBQW9DSixRQUFwQztPQURGLE1BRU87YUFDQUosY0FBTCxDQUFvQkssS0FBcEIsRUFBMkJDLFNBQTNCLElBQXdDRixRQUF4Qzs7OztJQUdKSyxHQUFHLENBQUVOLFNBQUYsRUFBYUMsUUFBYixFQUF1QjtVQUNwQixDQUFDQyxLQUFELEVBQVFDLFNBQVIsSUFBcUJILFNBQVMsQ0FBQ0ksS0FBVixDQUFnQixHQUFoQixDQUF6Qjs7VUFDSSxLQUFLUCxjQUFMLENBQW9CSyxLQUFwQixDQUFKLEVBQWdDO1lBQzFCLENBQUNDLFNBQUwsRUFBZ0I7Y0FDVixDQUFDRixRQUFMLEVBQWU7aUJBQ1JK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
