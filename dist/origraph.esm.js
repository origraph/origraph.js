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

function _asyncGeneratorDelegate(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

function _awaitAsyncGenerator(value) { return new _AwaitValue(value); }

function _wrapAsyncGenerator(fn) { return function () { return new _AsyncGenerator(fn.apply(this, arguments)); }; }

function _AsyncGenerator(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue(value) { this.wrapped = value; }

function _asyncIterator(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

  get label() {
    return this.classObj.annotations.labelAttr ? this.row[this.classObj.annotations.labelAttr] : this.index;
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

function _wrapAsyncGenerator$1(fn) { return function () { return new _AsyncGenerator$1(fn.apply(this, arguments)); }; }

function _AsyncGenerator$1(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$1; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$1.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$1.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$1.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$1.prototype.return = function (arg) { return this._invoke("return", arg); };

function _awaitAsyncGenerator$1(value) { return new _AwaitValue$1(value); }

function _AwaitValue$1(value) { this.wrapped = value; }

function _asyncIterator$1(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _asyncGeneratorDelegate$1(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

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

    return _wrapAsyncGenerator$1(function* () {
      if (_this._cache) {
        // The cache has already been built; just grab data from it directly
        yield* _asyncGeneratorDelegate$1(_asyncIterator$1(_this._cache.slice(0, limit)), _awaitAsyncGenerator$1);
      } else if (_this._partialCache && _this._partialCache.length >= limit) {
        // The cache isn't finished, but it's already long enough to satisfy this
        // request
        yield* _asyncGeneratorDelegate$1(_asyncIterator$1(_this._partialCache.slice(0, limit)), _awaitAsyncGenerator$1);
      } else {
        // The cache isn't finished building (and maybe didn't even start yet);
        // kick it off, and then wait for enough items to be processed to satisfy
        // the limit
        _this.buildCache();

        yield* _asyncGeneratorDelegate$1(_asyncIterator$1((yield _awaitAsyncGenerator$1(new Promise((resolve, reject) => {
          _this._limitPromises[limit] = _this._limitPromises[limit] || [];

          _this._limitPromises[limit].push({
            resolve,
            reject
          });
        })))), _awaitAsyncGenerator$1);
      }
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator$1(function* () {
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

  async _getItem(index = null) {
    // Stupid approach when the cache isn't built: interate until we see the
    // index. Subclasses could override this
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;

    var _iteratorError;

    try {
      for (var _iterator = _asyncIterator$1(this.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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

  async getItem(index = null) {
    if (this._cacheLookup) {
      return index === null ? this._cache[0] : this._cache[this._cacheLookup[index]];
    } else if (this._partialCacheLookup && (index === null && this._partialCache.length > 0 || this._partialCacheLookup[index] !== undefined)) {
      return index === null ? this._partialCache[0] : this._partialCache[this._partialCacheLookup[index]];
    }

    return this._getItem(index);
  }

  async getRandomItem() {
    const randIndex = Math.floor(Math.random() * (await this.countRows()));
    return this._cache[randIndex];
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
    this.model.trigger('update');
  }

  get suppressedAttributes() {
    return Object.keys(this._suppressedAttributes);
  }

  get unSuppressedAttributes() {
    return this.attributes.filter(attr => !this._suppressedAttributes[attr]);
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

  unSuppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = false;
    } else {
      delete this._suppressedAttributes[attribute];
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

    return _wrapAsyncGenerator$1(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator$1(_this2.iterate(limit)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$1(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$1(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = yield _awaitAsyncGenerator$1(wrappedItem.row[attribute]);

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
            yield _awaitAsyncGenerator$1(_iterator2.return());
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

    return _wrapAsyncGenerator$1(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator$1(_this3.iterate(limit)), _step3, _value3; _step3 = yield _awaitAsyncGenerator$1(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator$1(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
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
            yield _awaitAsyncGenerator$1(_iterator3.return());
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

function _awaitAsyncGenerator$2(value) { return new _AwaitValue$2(value); }

function _wrapAsyncGenerator$2(fn) { return function () { return new _AsyncGenerator$2(fn.apply(this, arguments)); }; }

function _AsyncGenerator$2(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$2; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$2.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$2.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$2.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$2.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$2(value) { this.wrapped = value; }

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

    return _wrapAsyncGenerator$2(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (yield _awaitAsyncGenerator$2(_this._finishItem(item))) {
          yield item;
        }
      }
    })();
  }

}

function _awaitAsyncGenerator$3(value) { return new _AwaitValue$3(value); }

function _wrapAsyncGenerator$3(fn) { return function () { return new _AsyncGenerator$3(fn.apply(this, arguments)); }; }

function _AsyncGenerator$3(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$3; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$3.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$3.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$3.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$3.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$3(value) { this.wrapped = value; }

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

    return _wrapAsyncGenerator$3(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (yield _awaitAsyncGenerator$3(_this._finishItem(item))) {
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

function _awaitAsyncGenerator$4(value) { return new _AwaitValue$4(value); }

function _wrapAsyncGenerator$4(fn) { return function () { return new _AsyncGenerator$4(fn.apply(this, arguments)); }; }

function _AsyncGenerator$4(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$4; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$4.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$4.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$4.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$4.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$4(value) { this.wrapped = value; }

function _asyncIterator$2(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$4(function* () {
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$2(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$4(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$4(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          let index = yield _awaitAsyncGenerator$4(wrappedParent.row[_this._attribute]);

          if (typeof index === 'object') {
            // Don't promote [object Object] as a value (ignore unhashable values)
            continue;
          }

          index = String(index);

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
            yield _awaitAsyncGenerator$4(_iterator.return());
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

function _awaitAsyncGenerator$5(value) { return new _AwaitValue$5(value); }

function _wrapAsyncGenerator$5(fn) { return function () { return new _AsyncGenerator$5(fn.apply(this, arguments)); }; }

function _AsyncGenerator$5(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$5; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$5.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$5.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$5.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$5.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$5(value) { this.wrapped = value; }

function _asyncIterator$3(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$5(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$3(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$5(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$5(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if ((yield _awaitAsyncGenerator$5(wrappedParent.row[_this._attribute])) === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (yield _awaitAsyncGenerator$5(_this._finishItem(newItem))) {
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
            yield _awaitAsyncGenerator$5(_iterator.return());
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

function _awaitAsyncGenerator$6(value) { return new _AwaitValue$6(value); }

function _wrapAsyncGenerator$6(fn) { return function () { return new _AsyncGenerator$6(fn.apply(this, arguments)); }; }

function _AsyncGenerator$6(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$6; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$6.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$6.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$6.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$6.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$6(value) { this.wrapped = value; }

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

    return _wrapAsyncGenerator$6(function* () {
      // Pre-build the parent table's cache
      yield _awaitAsyncGenerator$6(_this.parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = _this.parentTable._cache[_this.parentTable._cacheLookup[_this._index]] || {
        row: {}
      };

      for (let [index, value] of Object.entries(wrappedParent.row)) {
        value = yield _awaitAsyncGenerator$6(value);

        const newItem = _this._wrap({
          index,
          row: typeof value === 'object' ? value : {
            value
          },
          itemsToConnect: [wrappedParent]
        });

        if (yield _awaitAsyncGenerator$6(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

function _awaitAsyncGenerator$7(value) { return new _AwaitValue$7(value); }

function _wrapAsyncGenerator$7(fn) { return function () { return new _AsyncGenerator$7(fn.apply(this, arguments)); }; }

function _AsyncGenerator$7(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$7; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$7.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$7.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$7.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$7.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$7(value) { this.wrapped = value; }

class ConnectedTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('=');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join('=');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator$7(function* () {
      const parentTables = _this.parentTables; // Don't try to connect values until all of the parent tables' caches are
      // built; TODO: might be able to do something more responsive here?

      yield _awaitAsyncGenerator$7(Promise.all(parentTables.map(pTable => pTable.buildCache()))); // Now that the caches are built, just iterate their keys directly. We only
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

        if (yield _awaitAsyncGenerator$7(_this._finishItem(newItem))) {
          yield newItem;
        }
      }
    })();
  }

}

function _awaitAsyncGenerator$8(value) { return new _AwaitValue$8(value); }

function _wrapAsyncGenerator$8(fn) { return function () { return new _AsyncGenerator$8(fn.apply(this, arguments)); }; }

function _AsyncGenerator$8(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$8; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$8.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$8.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$8.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$8.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$8(value) { this.wrapped = value; }

function _asyncIterator$4(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

class DuplicatedTable extends SingleParentMixin(Table) {
  get name() {
    return this.parentTable.name;
  }

  getSortHash() {
    return super.getSortHash() + this.parentTable.getSortHash();
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator$8(function* () {
      // Yield the same items with the same connections, but wrapped and finished
      // by this table
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$4(_this.parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$8(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$8(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;

          const newItem = _this._wrap({
            index: item.index,
            row: item.row,
            itemsToConnect: Object.values(item.connectedItems).reduce((agg, itemList) => {
              return agg.concat(itemList);
            }, [])
          });

          item.registerDuplicate(newItem);

          if (yield _awaitAsyncGenerator$8(_this._finishItem(newItem))) {
            yield newItem;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator$8(_iterator.return());
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

function _awaitAsyncGenerator$9(value) { return new _AwaitValue$9(value); }

function _wrapAsyncGenerator$9(fn) { return function () { return new _AsyncGenerator$9(fn.apply(this, arguments)); }; }

function _AsyncGenerator$9(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$9; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$9.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$9.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$9.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$9.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$9(value) { this.wrapped = value; }

function _asyncIterator$5(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$9(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$5(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$9(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$9(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const row = yield _awaitAsyncGenerator$9(wrappedParent.row[_this._attribute]);

          if (row !== undefined && row !== null && Object.keys(row).length > 0) {
            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent],
              parentIndex: wrappedParent.index
            });

            if (yield _awaitAsyncGenerator$9(_this._finishItem(newItem))) {
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
            yield _awaitAsyncGenerator$9(_iterator.return());
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

function _awaitAsyncGenerator$a(value) { return new _AwaitValue$a(value); }

function _wrapAsyncGenerator$a(fn) { return function () { return new _AsyncGenerator$a(fn.apply(this, arguments)); }; }

function _AsyncGenerator$a(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$a; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$a.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$a.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$a.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$a.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$a(value) { this.wrapped = value; }

function _asyncIterator$6(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$a(function* () {
      const parentTable = _this.parentTable;
      let index = 0;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$6(parentTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$a(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$a(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const rows = wrappedParent.row[_this._attribute];

          if (rows !== undefined && rows !== null && typeof rows[Symbol.iterator] === 'function') {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator$6(rows), _step2, _value2; _step2 = yield _awaitAsyncGenerator$a(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$a(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const row = _value2;

                const newItem = _this._wrap({
                  index,
                  row,
                  itemsToConnect: [wrappedParent],
                  parentIndex: wrappedParent.index
                });

                if (yield _awaitAsyncGenerator$a(_this._finishItem(newItem))) {
                  yield newItem;
                  index++;
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                  yield _awaitAsyncGenerator$a(_iterator2.return());
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
            yield _awaitAsyncGenerator$a(_iterator.return());
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

function _awaitAsyncGenerator$b(value) { return new _AwaitValue$b(value); }

function _wrapAsyncGenerator$b(fn) { return function () { return new _AsyncGenerator$b(fn.apply(this, arguments)); }; }

function _AsyncGenerator$b(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$b; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$b.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$b.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$b.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$b.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$b(value) { this.wrapped = value; }

function _asyncIterator$7(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

class ParentChildTable extends Table {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('/');
  }

  getSortHash() {
    return super.getSortHash() + this.parentTables.map(table => table.getSortHash()).join(',');
  }

  _iterate() {
    var _this = this;

    return _wrapAsyncGenerator$b(function* () {
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
        for (var _iterator = _asyncIterator$7(childTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$b(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$b(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const child = _value;
          const parent = yield _awaitAsyncGenerator$b(parentTable.getItem(child.parentIndex));

          const newItem = _this._wrap({
            index,
            itemsToConnect: [parent, child]
          });

          if (yield _awaitAsyncGenerator$b(_this._finishItem(newItem))) {
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
            yield _awaitAsyncGenerator$b(_iterator.return());
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

function _awaitAsyncGenerator$c(value) { return new _AwaitValue$c(value); }

function _wrapAsyncGenerator$c(fn) { return function () { return new _AsyncGenerator$c(fn.apply(this, arguments)); }; }

function _AsyncGenerator$c(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$c; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$c.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$c.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$c.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$c.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$c(value) { this.wrapped = value; }

function _asyncIterator$8(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

    return _wrapAsyncGenerator$c(function* () {
      const self = _this;
      const firstTable = _this.model.tables[_this.tableOrder[0]];

      const remainingIds = _this.tableOrder.slice(1);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$8(firstTable.iterate()), _step, _value; _step = yield _awaitAsyncGenerator$c(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$c(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const sourceItem = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator$8(sourceItem.iterateAcrossConnections(remainingIds)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$c(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$c(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const lastItem = _value2;

              const newItem = _this._wrap({
                index: sourceItem.index + '⨯' + lastItem.index,
                itemsToConnect: [sourceItem, lastItem]
              });

              if (yield _awaitAsyncGenerator$c(self._finishItem(newItem))) {
                yield newItem;
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                yield _awaitAsyncGenerator$c(_iterator2.return());
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
            yield _awaitAsyncGenerator$c(_iterator.return());
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

function _awaitAsyncGenerator$d(value) { return new _AwaitValue$d(value); }

function _wrapAsyncGenerator$d(fn) { return function () { return new _AsyncGenerator$d(fn.apply(this, arguments)); }; }

function _AsyncGenerator$d(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$d; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$d.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$d.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$d.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$d.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$d(value) { this.wrapped = value; }

function _asyncIterator$9(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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

  setAnnotation(key, value) {
    this.annotations[key] = value;
    this.model.trigger('update');
  }

  deleteAnnotation(key) {
    delete this.annotations[key];
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

  expand(attribute) {
    return this.model.createClass({
      tableId: this.table.expand(attribute).tableId,
      type: this.constructor.name
    });
  }

  unroll(attribute) {
    return this.model.createClass({
      tableId: this.table.unroll(attribute).tableId,
      type: this.constructor.name
    });
  }

  promote(attribute) {
    return this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: this.constructor.name
    });
  }

  aggregate(attribute, options = {}) {
    options = Object.assign(this._toRawObject(), options, {
      classId: this.classId,
      overwrite: true,
      tableId: this.table.promote(attribute).tableId,
      type: this.constructor.name
    });
    return this.model.createClass(options);
  }

  dissolve(options = {}) {
    if (!this.canDissolve) {
      throw new Error(`Can't dissolve class that has table of type ${this.table.type}`);
    }

    options = Object.assign(this._toRawObject(), options, {
      classId: this.classId,
      overwrite: true,
      tableId: this.table.parentTable.tableId,
      type: this.constructor.name
    });
    return this.model.createClass(options);
  }

  get canDissolve() {
    return this.table.type === 'Promoted';
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    });
  }

  openFacet(attribute) {
    var _this = this;

    return _wrapAsyncGenerator$d(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$9(_this.table.openFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator$d(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$d(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const newTable = _value;
          yield _this.model.createClass({
            tableId: newTable.tableId,
            type: _this.constructor.name
          });
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return != null) {
            yield _awaitAsyncGenerator$d(_iterator.return());
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
      return this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    });
  }

  openTranspose() {
    var _this2 = this;

    return _wrapAsyncGenerator$d(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator$9(_this2.table.openTranspose()), _step2, _value2; _step2 = yield _awaitAsyncGenerator$d(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$d(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const newTable = _value2;
          yield _this2.model.createClass({
            tableId: newTable.tableId,
            type: _this2.constructor.name
          });
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
            yield _awaitAsyncGenerator$d(_iterator2.return());
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

  async countAllUniqueValues() {
    // TODO: this is wildly inefficient, especially for quantitative
    // attributes... currently doing this (under protest) for stats in the
    // connect interface. Maybe useful for writing histogram functions in
    // the future?
    const hashableBins = {};
    const unHashableCounts = {};
    const indexBin = {};
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;

    var _iteratorError3;

    try {
      for (var _iterator3 = _asyncIterator$9(this.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
        const item = _value3;
        indexBin[item.index] = 1; // always 1

        for (const [attr, value] of Object.entries(item.row)) {
          if (value === undefined || typeof value === 'object') {
            unHashableCounts[attr] = unHashableCounts[attr] || 0;
            unHashableCounts[attr]++;
          } else {
            hashableBins[attr] = hashableBins[attr] || {};
            hashableBins[attr][value] = hashableBins[attr][value] || 0;
            hashableBins[attr][value]++;
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

    return {
      hashableBins,
      unHashableCounts,
      indexBin
    };
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

function _wrapAsyncGenerator$e(fn) { return function () { return new _AsyncGenerator$e(fn.apply(this, arguments)); }; }

function _AsyncGenerator$e(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$e; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$e.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$e.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$e.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$e.prototype.return = function (arg) { return this._invoke("return", arg); };

function _awaitAsyncGenerator$e(value) { return new _AwaitValue$e(value); }

function _AwaitValue$e(value) { this.wrapped = value; }

function _asyncIterator$a(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _asyncGeneratorDelegate$2(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

class NodeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  edges(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator$e(function* () {
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

      yield* _asyncGeneratorDelegate$2(_asyncIterator$a(_this.handleLimit(options, iterators)), _awaitAsyncGenerator$e);
    })();
  }

  neighborNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator$e(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$a(_this2.edges()), _step, _value; _step = yield _awaitAsyncGenerator$e(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$e(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const edge = _value;

          const role = _this2.classObj.getEdgeRole(edge.classObj);

          if (role === 'both' || role === 'source') {
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator$a(edge.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$e(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$e(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const target = _value2;

                if (_this2 !== target) {
                  yield target;
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                  yield _awaitAsyncGenerator$e(_iterator2.return());
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          }

          if (role === 'both' || role === 'target') {
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator$a(edge.sourceNodes(options)), _step3, _value3; _step3 = yield _awaitAsyncGenerator$e(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator$e(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const source = _value3;

                if (_this2 !== source) {
                  yield source;
                }
              }
            } catch (err) {
              _didIteratorError3 = true;
              _iteratorError3 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                  yield _awaitAsyncGenerator$e(_iterator3.return());
                }
              } finally {
                if (_didIteratorError3) {
                  throw _iteratorError3;
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
            yield _awaitAsyncGenerator$e(_iterator.return());
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
    })();
  }

  neighbors(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator$e(function* () {
      yield* _asyncGeneratorDelegate$2(_asyncIterator$a(_this3.edges(options)), _awaitAsyncGenerator$e);
    })();
  }

  pairwiseNeighborhood(options) {
    var _this4 = this;

    return _wrapAsyncGenerator$e(function* () {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;

      var _iteratorError4;

      try {
        for (var _iterator4 = _asyncIterator$a(_this4.edges()), _step4, _value4; _step4 = yield _awaitAsyncGenerator$e(_iterator4.next()), _iteratorNormalCompletion4 = _step4.done, _value4 = yield _awaitAsyncGenerator$e(_step4.value), !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
          const edge = _value4;
          yield* _asyncGeneratorDelegate$2(_asyncIterator$a(edge.pairwiseNeighborhood(options)), _awaitAsyncGenerator$e);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            yield _awaitAsyncGenerator$e(_iterator4.return());
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
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
    const newNodeClass = super.promote(attribute);
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
  }

  aggregate(attribute, options = {}) {
    const newClass = super.aggregate(attribute, options);

    for (const edgeClass of newClass.edgeClasses()) {
      const role = this.getEdgeRole(edgeClass);

      if (role === 'source' || role === 'both') {
        edgeClass.sourceTableIds.push(this.tableId);
      }

      if (role === 'target' || role === 'both') {
        edgeClass.targetTableIds.push(this.tableId);
      }
    }

    return newClass;
  }

  dissolve(options = {}) {
    const newClass = super.dissolve(options);

    for (const edgeClass of newClass.edgeClasses()) {
      const role = this.getEdgeRole(edgeClass);

      if (role === 'source' || role === 'both') {
        if (edgeClass.sourceTableIds.pop() !== newClass.tableId) {
          throw new Error(`Inconsistent tableIds when dissolving a node class`);
        }
      }

      if (role === 'target' || role === 'both') {
        if (edgeClass.targetTableIds.pop() !== newClass.tableId) {
          throw new Error(`Inconsistent tableIds when dissolving a node class`);
        }
      }
    }

    return newClass;
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
    const newNodeClass = super.expand(attribute);
    this.connectToChildNodeClass(newNodeClass);
    return newNodeClass;
  }

  unroll(attribute) {
    const newNodeClass = super.unroll(attribute);
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

function _wrapAsyncGenerator$f(fn) { return function () { return new _AsyncGenerator$f(fn.apply(this, arguments)); }; }

function _AsyncGenerator$f(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$f; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$f.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$f.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$f.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$f.prototype.return = function (arg) { return this._invoke("return", arg); };

function _awaitAsyncGenerator$f(value) { return new _AwaitValue$f(value); }

function _AwaitValue$f(value) { this.wrapped = value; }

function _asyncIterator$b(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

function _asyncGeneratorDelegate$3(inner, awaitWrap) { var iter = {}, waiting = false; function pump(key, value) { waiting = true; value = new Promise(function (resolve) { resolve(inner[key](value)); }); return { done: false, value: awaitWrap(value) }; } if (typeof Symbol === "function" && Symbol.iterator) { iter[Symbol.iterator] = function () { return this; }; } iter.next = function (value) { if (waiting) { waiting = false; return value; } return pump("next", value); }; if (typeof inner.throw === "function") { iter.throw = function (value) { if (waiting) { waiting = false; throw value; } return pump("throw", value); }; } if (typeof inner.return === "function") { iter.return = function (value) { return pump("return", value); }; } return iter; }

class EdgeWrapper extends GenericWrapper {
  constructor(options) {
    super(options);

    if (!this.classObj) {
      throw new Error(`classObj is required`);
    }
  }

  sourceNodes(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator$f(function* () {
      if (_this.classObj.sourceClassId === null || options.classes && !options.classes.find(d => _this.classObj.sourceClassId === d.classId) || options.classIds && options.classIds.indexOf(_this.classObj.sourceClassId) === -1) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;

      const tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);

      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this.handleLimit(options, [_this.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator$f);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator$f(function* () {
      if (_this2.classObj.targetClassId === null || options.classes && !options.classes.find(d => _this2.classObj.targetClassId === d.classId) || options.classIds && options.classIds.indexOf(_this2.classObj.targetClassId) === -1) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;

      const tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);

      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this2.handleLimit(options, [_this2.iterateAcrossConnections(tableIds)])), _awaitAsyncGenerator$f);
    })();
  }

  nodes(options = {}) {
    var _this3 = this;

    return _wrapAsyncGenerator$f(function* () {
      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this3.handleLimit(options, [_this3.sourceNodes(options), _this3.targetNodes(options)])), _awaitAsyncGenerator$f);
    })();
  }

  neighbors(options = {}) {
    var _this4 = this;

    return _wrapAsyncGenerator$f(function* () {
      yield* _asyncGeneratorDelegate$3(_asyncIterator$b(_this4.nodes(options)), _awaitAsyncGenerator$f);
    })();
  }

  pairwiseNeighborhood(options) {
    var _this5 = this;

    return _wrapAsyncGenerator$f(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$b(_this5.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator$f(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$f(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator$b(_this5.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator$f(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator$f(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                target,
                edge: _this5
              };
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                yield _awaitAsyncGenerator$f(_iterator2.return());
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
            yield _awaitAsyncGenerator$f(_iterator.return());
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

function _awaitAsyncGenerator$g(value) { return new _AwaitValue$g(value); }

function _wrapAsyncGenerator$g(fn) { return function () { return new _AsyncGenerator$g(fn.apply(this, arguments)); }; }

function _AsyncGenerator$g(gen) { var front, back; function send(key, arg) { return new Promise(function (resolve, reject) { var request = { key: key, arg: arg, resolve: resolve, reject: reject, next: null }; if (back) { back = back.next = request; } else { front = back = request; resume(key, arg); } }); } function resume(key, arg) { try { var result = gen[key](arg); var value = result.value; var wrappedAwait = value instanceof _AwaitValue$g; Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) { if (wrappedAwait) { resume("next", arg); return; } settle(result.done ? "return" : "normal", arg); }, function (err) { resume("throw", err); }); } catch (err) { settle("throw", err); } } function settle(type, value) { switch (type) { case "return": front.resolve({ value: value, done: true }); break; case "throw": front.reject(value); break; default: front.resolve({ value: value, done: false }); break; } front = front.next; if (front) { resume(front.key, front.arg); } else { back = null; } } this._invoke = send; if (typeof gen.return !== "function") { this.return = undefined; } }

if (typeof Symbol === "function" && Symbol.asyncIterator) { _AsyncGenerator$g.prototype[Symbol.asyncIterator] = function () { return this; }; }

_AsyncGenerator$g.prototype.next = function (arg) { return this._invoke("next", arg); };

_AsyncGenerator$g.prototype.throw = function (arg) { return this._invoke("throw", arg); };

_AsyncGenerator$g.prototype.return = function (arg) { return this._invoke("return", arg); };

function _AwaitValue$g(value) { this.wrapped = value; }

function _asyncIterator$c(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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
      return super.promote(attribute);
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

  aggregate(attribute, options = {}) {
    const newClass = super.aggregate(attribute, options);
    newClass.sourceTableIds.unshift(this.tableId);
    newClass.targetTableIds.unshift(this.tableId);
    return newClass;
  }

  dissolve(options = {}) {
    const newClass = super.dissolve(options);

    if (newClass.sourceTableIds.shift() !== newClass.tableId) {
      throw new Error(`Inconsistent tableIds when dissolving an edge class`);
    }

    if (newClass.targetTableIds.shift() !== newClass.tableId) {
      throw new Error(`Inconsistent tableIds when dissolving an edge class`);
    }

    return newClass;
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

    return _wrapAsyncGenerator$g(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$c(_superprop_callOpenFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator$g(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator$g(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
            yield _awaitAsyncGenerator$g(_iterator.return());
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

function _asyncIterator$d(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }
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
        for (var _iterator = _asyncIterator$d(nodes.openFacet(classAttribute)), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
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
        for (var _iterator2 = _asyncIterator$d(edges.openFacet(classAttribute)), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edgeClass = _value2;
          edgeClasses.push(edgeClass.interpretAsEdges());
          const sample = await edgeClass.table.getItem();
          const sourceClassName = await sample.row[sourceAttribute + '_' + classAttribute];

          if (nodeClassLookup[sourceClassName] !== undefined) {
            edgeClass.connectToNodeClass({
              nodeClass: nodeClasses[nodeClassLookup[sourceClassName]],
              side: 'source',
              nodeAttribute,
              edgeAttribute: sourceAttribute
            });
          }

          const targetClassName = await sample.row[targetAttribute + '_' + classAttribute];

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
          for (var _iterator3 = _asyncIterator$d(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
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
        for (var _iterator4 = _asyncIterator$d(nodeClass.table.iterate()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
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
        for (var _iterator5 = _asyncIterator$d(edgeClass.table.iterate()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const edge = _value5;
          const row = await this.buildRow(edge);
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;

          var _iteratorError6;

          try {
            for (var _iterator6 = _asyncIterator$d(edge.sourceNodes({
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
                for (var _iterator7 = _asyncIterator$d(edge.targetNodes({
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

function _asyncIterator$e(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }

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
      const attributes = classObj.table.unSuppressedAttributes;
      let contents = `${indexName},${attributes.join(',')}\n`;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$e(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const item = _value;
          contents += `${item.index}`;

          for (const attr of attributes) {
            contents += `,${await item.row[attr]}`;
          }

          contents += `\n`;
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

function _asyncIterator$f(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }
const escapeChars = {
  '&quot;': /"/g,
  '&apos;': /'/g,
  '&lt;': /</g,
  '&gt;': />/g
};

class GEXF extends FileFormat {
  async importData({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }

  escape(str) {
    str = str.replace(/&/g, '&amp;');

    for (const [repl, exp] of Object.entries(escapeChars)) {
      str = str.replace(exp, repl);
    }

    return str;
  }

  async formatData({
    model,
    includeClasses = Object.values(model.classes),
    classAttribute = 'class'
  }) {
    let nodeChunk = '';
    let edgeChunk = '';

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator$f(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const node = _value;
            nodeChunk += `
    <node id="${this.escape(node.exportId)}" label="${this.escape(node.label)}">
      <attvalues>
        <attvalue for="0" value="${this.escape(classObj.className)}"/>
      </attvalues>
    </node>`;
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
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator$f(classObj.table.iterate()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const edge = _value2;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator$f(edge.sourceNodes({
                classes: includeClasses
              })), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const source = _value3;
                var _iteratorNormalCompletion4 = true;
                var _didIteratorError4 = false;

                var _iteratorError4;

                try {
                  for (var _iterator4 = _asyncIterator$f(edge.targetNodes({
                    classes: includeClasses
                  })), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                    const target = _value4;
                    edgeChunk += `
    <edge id="${this.escape(edge.exportId)}" source="${this.escape(source.exportId)}" target="${this.escape(target.exportId)}">
      <attvalues>
        <attvalue for="0" value="${this.escape(classObj.className)}"/>
      </attvalues>
    </edge>`;
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

    const result = `\
<?xml version="1.0" encoding="UTF-8"?>
<gexf  xmlns="http://www.gexf.net/1.2draft" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd" version="1.2">
<meta lastmodifieddate="2009-03-20">
  <creator>origraph.github.io</creator>
  <description>${model.name}</description>
</meta>
<graph mode="static" defaultedgetype="directed">
  <attributes class="node">
    <attribute id="0" title="${classAttribute}" type="string"/>
  </attributes>
  <attributes class="edge">
    <attribute id="0" title="${classAttribute}" type="string"/>
  </attributes>
  <nodes>${nodeChunk}
  </nodes>
  <edges>${edgeChunk}
  </edges>
</graph>
</gexf>
  `;
    return {
      data: 'data:text/xml;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/xml',
      extension: 'gexf'
    };
  }

}

var GEXF$1 = new GEXF();



var FILE_FORMATS = /*#__PURE__*/Object.freeze({
  D3Json: D3Json$1,
  CsvZip: CsvZip$1,
  GEXF: GEXF$1
});

function _asyncIterator$g(iterable) { var method; if (typeof Symbol === "function") { if (Symbol.asyncIterator) { method = iterable[Symbol.asyncIterator]; if (method != null) return method.call(iterable); } if (Symbol.iterator) { method = iterable[Symbol.iterator]; if (method != null) return method.call(iterable); } } throw new TypeError("Object is not async iterable"); }
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

  createClass(options = {}) {
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

  async getInstanceSample() {
    const seedLimit = 100;
    const clusterLimit = 5;
    const classCount = 5; // Try to get at most roughly seedCount nodes / edges, in clusters of about
    // clusterLimit, and try to include at least classCount instances per class
    // (may return null if caches are invalidated during iteration)

    let iterationReset = false;
    const instances = {};
    let totalCount = 0;
    const classCounts = {};

    const populateClassCounts = async instance => {
      if (instance.reset) {
        // Cache invalidated! Stop iterating and return null
        iterationReset = true;
        return false;
      }

      if (instances[instance.instanceId]) {
        // Don't add this instance if we already sampled it, but keep iterating
        return true;
      } // Add and count this instance to the sample


      instances[instance.instanceId] = instance;
      totalCount++;
      classCounts[instance.classObj.classId] = classCounts[instance.classObj.classId] || 0;
      classCounts[instance.classObj.classId]++;

      if (totalCount >= seedLimit) {
        // We have enough; stop iterating
        return false;
      } // Try to add the neighbors of this sample from classes where we don't have
      // enough samples yet


      const classIds = Object.keys(this.classes).filter(classId => {
        return (classCounts[classId] || 0) < classCount;
      });
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator$g(instance.neighbors({
          limit: clusterLimit,
          classIds
        })), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const neighbor = _value;

          if (!(await populateClassCounts(neighbor))) {
            // Pass along the signal to stop iterating
            return false;
          }
        } // Signal that we should keep iterating

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

      return true;
    };

    for (const [classId, classObj] of Object.entries(this.classes)) {
      const rowCount = await classObj.table.countRows(); // Get at least classCount instances from this class (as long as we
      // haven't exhausted all the instances the class has to give)

      while ((classCounts[classId] || 0) < classCount && (classCounts[classId] || 0) < rowCount) {
        if (iterationReset) {
          // Cache invalidated; bail immediately
          return null;
        } // Add a random instance, and try to prioritize its neighbors in other classes


        if (!(await populateClassCounts((await classObj.table.getRandomItem())))) {
          break;
        }
      }
    }

    return instances;
  }

  validateInstanceSample(instances) {
    // Check if all the instances are still current; return null as a signal
    // that a cache was invalidated, and that a function needs to be called again
    for (const instance of Object.values(instances)) {
      if (instance.reset) {
        return null;
      }
    }

    return instances;
  }

  async updateInstanceSample(instances) {
    // Replace any out-of-date instances, and exclude instances that no longer exist
    const result = {};

    for (const [instanceId, instance] of Object.entries(instances)) {
      const {
        classId,
        index
      } = JSON.parse(instanceId);

      if (this.classes[classId]) {
        if (instance.reset) {
          const newInstance = await this.classes[classId].table.getItem(index);

          if (newInstance) {
            result[newInstance.instanceId] = newInstance;
          }
        } else {
          result[instanceId] = instance;
        }
      }
    }

    return this.validateInstanceSample(result);
  }

  partitionInstanceSample(instances) {
    // Separate samples by their type
    const result = {
      nodes: {},
      edges: {},
      generics: {}
    };

    for (const [instanceId, instance] of Object.entries(instances)) {
      if (instance.type === 'Node') {
        result.nodes[instanceId] = instance;
      } else if (instance.type === 'Edge') {
        result.edges[instanceId] = instance;
      } else {
        result.generics[instanceId] = instance;
      }
    }

    return result;
  }

  async fillInstanceSample(instances) {
    // Given a specific sample of the graph, add instances to ensure that:
    // 1. For every pair of nodes, any edges that exist between them should be added
    // 2. For every edge, ensure that at least one source and target node is added
    const {
      nodes,
      edges
    } = this.partitionInstanceSample(instances);
    const extraNodes = {};
    const extraEdges = {}; // Make sure that each edge has at least one source and one target (assuming
    // that source and target classes are connected)

    const seedSide = async (edge, iterFunc) => {
      let aNode;
      let isSeeded = false;
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;

      var _iteratorError5;

      try {
        for (var _iterator5 = _asyncIterator$g(edge[iterFunc]()), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
          const node = _value5;
          aNode = aNode || node;

          if (nodes[node.instanceId]) {
            isSeeded = true;
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

      if (!isSeeded && aNode) {
        extraNodes[aNode.instanceId] = aNode;
      }
    };

    for (const edge of Object.values(edges)) {
      await seedSide(edge, 'sourceNodes');
      await seedSide(edge, 'targetNodes');
    } // Add any edges that exist that connect any of the core nodes


    for (const node of Object.values(nodes)) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator$g(node.edges()), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edge = _value2;

          if (!edges[edge.instanceId]) {
            // Check that both ends of the edge connect at least one
            // of our nodes
            let connectsSource = false;
            let connectsTarget = false;
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;

            var _iteratorError3;

            try {
              for (var _iterator3 = _asyncIterator$g(edge.sourceNodes()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
                const node = _value3;

                if (nodes[node.instanceId]) {
                  connectsSource = true;
                  break;
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

            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;

            var _iteratorError4;

            try {
              for (var _iterator4 = _asyncIterator$g(edge.targetNodes()), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                const node = _value4;

                if (nodes[node.instanceId]) {
                  connectsTarget = true;
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

            if (connectsSource && connectsTarget) {
              extraEdges[edge.instanceId] = edge;
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
    } // At this point we have a complete set of nodes and edges that we want to
    // include. We just need to merge and validate the samples:


    instances = Object.assign({}, nodes, edges, extraNodes, extraEdges);
    return this.validateInstanceSample(instances);
  }

  async instanceSampleToGraph(instances) {
    const graph = {
      nodes: [],
      nodeLookup: {},
      edges: []
    };
    const {
      nodes,
      edges
    } = this.partitionInstanceSample(instances); // Make a list of nodes, plus a lookup to each node's index

    for (const [instanceId, node] of Object.entries(nodes)) {
      graph.nodeLookup[instanceId] = graph.nodes.length;
      graph.nodes.push({
        nodeInstance: node,
        dummy: false
      });
    } // Add all the edges, including dummy nodes for dangling edges


    for (const edge of Object.values(edges)) {
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
            for (var _iterator6 = _asyncIterator$g(edge.targetNodes()), _step6, _value6; _step6 = await _iterator6.next(), _iteratorNormalCompletion6 = _step6.done, _value6 = await _step6.value, !_iteratorNormalCompletion6; _iteratorNormalCompletion6 = true) {
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
          for (var _iterator7 = _asyncIterator$g(edge.sourceNodes()), _step7, _value7; _step7 = await _iterator7.next(), _iteratorNormalCompletion7 = _step7.done, _value7 = await _step7.value, !_iteratorNormalCompletion7; _iteratorNormalCompletion7 = true) {
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
        // (only create dummy nodes for edges that are actually disconnected)
        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;

        var _iteratorError8;

        try {
          for (var _iterator8 = _asyncIterator$g(edge.sourceNodes()), _step8, _value8; _step8 = await _iterator8.next(), _iteratorNormalCompletion8 = _step8.done, _value8 = await _step8.value, !_iteratorNormalCompletion8; _iteratorNormalCompletion8 = true) {
            const sourceNode = _value8;

            if (graph.nodeLookup[sourceNode.instanceId] !== undefined) {
              var _iteratorNormalCompletion9 = true;
              var _didIteratorError9 = false;

              var _iteratorError9;

              try {
                for (var _iterator9 = _asyncIterator$g(edge.targetNodes()), _step9, _value9; _step9 = await _iterator9.next(), _iteratorNormalCompletion9 = _step9.done, _value9 = await _step9.value, !_iteratorNormalCompletion9; _iteratorNormalCompletion9 = true) {
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
var version = "0.2.7";
var description = "A library for flexible graph reshaping";
var main = "dist/origraph.cjs.js";
var module = "dist/origraph.esm.js";
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
	"@babel/core": "^7.3.4",
	"@babel/plugin-proposal-async-generator-functions": "^7.2.0",
	"@babel/preset-env": "^7.3.4",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^24.3.1",
	coveralls: "^3.0.3",
	jest: "^24.3.1",
	rollup: "^1.5.0",
	"rollup-plugin-babel": "^4.3.2",
	"rollup-plugin-commonjs": "^9.2.1",
	"rollup-plugin-istanbul": "^2.0.1",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^4.0.1",
	sha1: "^1.1.1"
};
var dependencies = {
	d3: "^5.9.1",
	datalib: "^1.9.2",
	filereader: "^0.10.3",
	jszip: "^3.2.0",
	"mime-types": "^2.1.22"
};
var peerDependencies = {
	d3: "^5.4.0"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0dFWEYuanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBnZXQgbGFiZWwgKCkge1xuICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLmFubm90YXRpb25zLmxhYmVsQXR0ciA/IHRoaXMucm93W3RoaXMuY2xhc3NPYmouYW5ub3RhdGlvbnMubGFiZWxBdHRyXSA6IHRoaXMuaW5kZXg7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZnVuYyBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGFzeW5jIF9nZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICAvLyBTdHVwaWQgYXBwcm9hY2ggd2hlbiB0aGUgY2FjaGUgaXNuJ3QgYnVpbHQ6IGludGVyYXRlIHVudGlsIHdlIHNlZSB0aGVcbiAgICAvLyBpbmRleC4gU3ViY2xhc3NlcyBjb3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRJdGVtKGluZGV4KTtcbiAgfVxuICBhc3luYyBnZXRSYW5kb21JdGVtICgpIHtcbiAgICBjb25zdCByYW5kSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhd2FpdCB0aGlzLmNvdW50Um93cygpKTtcbiAgICByZXR1cm4gdGhpcy5fY2FjaGVbcmFuZEluZGV4XTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IHN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpO1xuICB9XG4gIGdldCB1blN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+ICF0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyXSk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgdW5TdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChmdW5jLCBhdHRyaWJ1dGUgPSBudWxsKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBwcm9qZWN0ICh0YWJsZUlkcykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnUHJvamVjdGVkVGFibGUnLFxuICAgICAgdGFibGVPcmRlcjogW3RoaXMudGFibGVJZF0uY29uY2F0KHRhYmxlSWRzKVxuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZUlkIG9mIHRhYmxlSWRzKSB7XG4gICAgICBjb25zdCBvdGhlclRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbb3RoZXJUYWJsZUlkXTtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKGZvcmNlID0gZmFsc2UpIHtcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGxldCBpbmRleCA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBEb24ndCBwcm9tb3RlIFtvYmplY3QgT2JqZWN0XSBhcyBhIHZhbHVlIChpZ25vcmUgdW5oYXNoYWJsZSB2YWx1ZXMpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBTdHJpbmcoaW5kZXgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLl92YWx1ZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgYXdhaXQgdGhpcy5wYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGxldCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgdmFsdWUgPSBhd2FpdCB2YWx1ZTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJz0nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignPScpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldFxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBEdXBsaWNhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gWWllbGQgdGhlIHNhbWUgaXRlbXMgd2l0aCB0aGUgc2FtZSBjb25uZWN0aW9ucywgYnV0IHdyYXBwZWQgYW5kIGZpbmlzaGVkXG4gICAgLy8gYnkgdGhpcyB0YWJsZVxuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleDogaXRlbS5pbmRleCxcbiAgICAgICAgcm93OiBpdGVtLnJvdyxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IE9iamVjdC52YWx1ZXMoaXRlbS5jb25uZWN0ZWRJdGVtcykucmVkdWNlKChhZ2csIGl0ZW1MaXN0KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoaXRlbUxpc3QpO1xuICAgICAgICB9LCBbXSlcbiAgICAgIH0pO1xuICAgICAgaXRlbS5yZWdpc3RlckR1cGxpY2F0ZShuZXdJdGVtKTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGVkVGFibGU7XG4iLCJpbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNvbnN0IENoaWxkVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIEF0dHJUYWJsZU1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSBzdXBlci5fd3JhcChvcHRpb25zKTtcbiAgICAgIG5ld0l0ZW0ucGFyZW50SW5kZXggPSBvcHRpb25zLnBhcmVudEluZGV4O1xuICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDaGlsZFRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQ2hpbGRUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93cyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93cyAhPT0gdW5kZWZpbmVkICYmIHJvd3MgIT09IG51bGwgJiZcbiAgICAgICAgICB0eXBlb2Ygcm93c1tTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgcm93IG9mIHJvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIHJvdyxcbiAgICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVW5yb2xsZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUGFyZW50Q2hpbGRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignLycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IHBhcmVudFRhYmxlLCBjaGlsZFRhYmxlO1xuICAgIGlmICh0aGlzLnBhcmVudFRhYmxlc1swXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMV0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFRhYmxlc1sxXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMF0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50Q2hpbGRUYWJsZSBub3Qgc2V0IHVwIHByb3Blcmx5YCk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoaWxkIG9mIGNoaWxkVGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwYXJlbnRUYWJsZS5nZXRJdGVtKGNoaWxkLnBhcmVudEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbcGFyZW50LCBjaGlsZF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcmVudENoaWxkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFByb2plY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMudGFibGVPcmRlciA9IG9wdGlvbnMudGFibGVPcmRlcjtcbiAgICBpZiAoIXRoaXMudGFibGVPcmRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZU9yZGVyIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU9yZGVyLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMudGFibGVPcmRlclxuICAgICAgLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLmdldFNvcnRIYXNoKCkpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgZmlyc3RUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVPcmRlclswXV07XG4gICAgY29uc3QgcmVtYWluaW5nSWRzID0gdGhpcy50YWJsZU9yZGVyLnNsaWNlKDEpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlSXRlbSBvZiBmaXJzdFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBsYXN0SXRlbSBvZiBzb3VyY2VJdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdJZHMpKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleDogc291cmNlSXRlbS5pbmRleCArICfiqK8nICsgbGFzdEl0ZW0uaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtzb3VyY2VJdGVtLCBsYXN0SXRlbV1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCBzZWxmLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHNldEFubm90YXRpb24gKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIHVucm9sbCAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS51bnJvbGwoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgfSk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZS5wcm9tb3RlKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih0aGlzLl90b1Jhd09iamVjdCgpLCBvcHRpb25zLCB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZGlzc29sdmUgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICghdGhpcy5jYW5EaXNzb2x2ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkaXNzb2x2ZSBjbGFzcyB0aGF0IGhhcyB0YWJsZSBvZiB0eXBlICR7dGhpcy50YWJsZS50eXBlfWApO1xuICAgIH1cbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih0aGlzLl90b1Jhd09iamVjdCgpLCBvcHRpb25zLCB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnBhcmVudFRhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBnZXQgY2FuRGlzc29sdmUgKCkge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLnR5cGUgPT09ICdQcm9tb3RlZCc7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwub3B0aW1pemVUYWJsZXMoKTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jIGNvdW50QWxsVW5pcXVlVmFsdWVzICgpIHtcbiAgICAvLyBUT0RPOiB0aGlzIGlzIHdpbGRseSBpbmVmZmljaWVudCwgZXNwZWNpYWxseSBmb3IgcXVhbnRpdGF0aXZlXG4gICAgLy8gYXR0cmlidXRlcy4uLiBjdXJyZW50bHkgZG9pbmcgdGhpcyAodW5kZXIgcHJvdGVzdCkgZm9yIHN0YXRzIGluIHRoZVxuICAgIC8vIGNvbm5lY3QgaW50ZXJmYWNlLiBNYXliZSB1c2VmdWwgZm9yIHdyaXRpbmcgaGlzdG9ncmFtIGZ1bmN0aW9ucyBpblxuICAgIC8vIHRoZSBmdXR1cmU/XG4gICAgY29uc3QgaGFzaGFibGVCaW5zID0ge307XG4gICAgY29uc3QgdW5IYXNoYWJsZUNvdW50cyA9IHt9O1xuICAgIGNvbnN0IGluZGV4QmluID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBpbmRleEJpbltpdGVtLmluZGV4XSA9IDE7IC8vIGFsd2F5cyAxXG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaXRlbS5yb3cpKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB1bkhhc2hhYmxlQ291bnRzW2F0dHJdID0gdW5IYXNoYWJsZUNvdW50c1thdHRyXSB8fCAwO1xuICAgICAgICAgIHVuSGFzaGFibGVDb3VudHNbYXR0cl0rKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBoYXNoYWJsZUJpbnNbYXR0cl0gPSBoYXNoYWJsZUJpbnNbYXR0cl0gfHwge307XG4gICAgICAgICAgaGFzaGFibGVCaW5zW2F0dHJdW3ZhbHVlXSA9IGhhc2hhYmxlQmluc1thdHRyXVt2YWx1ZV0gfHwgMDtcbiAgICAgICAgICBoYXNoYWJsZUJpbnNbYXR0cl1bdmFsdWVdKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHsgaGFzaGFibGVCaW5zLCB1bkhhc2hhYmxlQ291bnRzLCBpbmRleEJpbiB9O1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogZWRnZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCBlZGdlSWRzID0gb3B0aW9ucy5jbGFzc2VzXG4gICAgICA/IG9wdGlvbnMuY2xhc3Nlcy5tYXAoY2xhc3NPYmogPT4gY2xhc3NPYmouY2xhc3NJZClcbiAgICAgIDogb3B0aW9ucy5jbGFzc0lkcyB8fCBPYmplY3Qua2V5cyh0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3QgaXRlcmF0b3JzID0gW107XG4gICAgZm9yIChjb25zdCBlZGdlSWQgb2YgZWRnZUlkcykge1xuICAgICAgaWYgKCF0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tlZGdlSWRdKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5jbGFzc09iai5tb2RlbC5jbGFzc2VzW2VkZ2VJZF07XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5jbGFzc09iai5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBjb25zdCB0YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICAgIGl0ZXJhdG9ycy5wdXNoKHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSk7XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIGl0ZXJhdG9ycyk7XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvck5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcygpKSB7XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5jbGFzc09iai5nZXRFZGdlUm9sZShlZGdlLmNsYXNzT2JqKTtcbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICAgIGlmICh0aGlzICE9PSB0YXJnZXQpIHtcbiAgICAgICAgICAgIHlpZWxkIHRhcmdldDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgICAgIGlmICh0aGlzICE9PSBzb3VyY2UpIHtcbiAgICAgICAgICAgIHlpZWxkIHNvdXJjZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvcnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5lZGdlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIHRoaXMuZWRnZXMoKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlTmVpZ2hib3Job29kKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IE5vZGVXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkcyA9IG9wdGlvbnMuZWRnZUNsYXNzSWRzIHx8IHt9O1xuICB9XG4gICogZWRnZUNsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBnZXRFZGdlUm9sZSAoZWRnZUNsYXNzKSB7XG4gICAgaWYgKCF0aGlzLmVkZ2VDbGFzc0lkc1tlZGdlQ2xhc3MuY2xhc3NJZF0pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgcmV0dXJuICdib3RoJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAnc291cmNlJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgIHJldHVybiAndGFyZ2V0JztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnRlcm5hbCBtaXNtYXRjaCBiZXR3ZWVuIG5vZGUgYW5kIGVkZ2UgY2xhc3NJZHNgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICByZXN1bHQuZWRnZUNsYXNzSWRzID0gdGhpcy5lZGdlQ2xhc3NJZHM7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgTm9kZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoeyBhdXRvY29ubmVjdCA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICAgIHNvdXJjZVRhYmxlSWRzID0gWyB0aGlzSGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGlmIChvdGhlckF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGU7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZS5wcm9tb3RlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBjb25zdCBjb25uZWN0ZWRUYWJsZSA9IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUsIG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIG5ld0NsYXNzLmVkZ2VDbGFzc2VzKCkpIHtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ3NvdXJjZScgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5wdXNoKHRoaXMudGFibGVJZCk7XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ3RhcmdldCcgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5wdXNoKHRoaXMudGFibGVJZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBkaXNzb2x2ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSBzdXBlci5kaXNzb2x2ZShvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBuZXdDbGFzcy5lZGdlQ2xhc3NlcygpKSB7XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdzb3VyY2UnIHx8IHJvbGUgPT09ICdib3RoJykge1xuICAgICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnBvcCgpICE9PSBuZXdDbGFzcy50YWJsZUlkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmNvbnNpc3RlbnQgdGFibGVJZHMgd2hlbiBkaXNzb2x2aW5nIGEgbm9kZSBjbGFzc2ApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocm9sZSA9PT0gJ3RhcmdldCcgfHwgcm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMucG9wKCkgIT09IG5ld0NsYXNzLnRhYmxlSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEluY29uc2lzdGVudCB0YWJsZUlkcyB3aGVuIGRpc3NvbHZpbmcgYSBub2RlIGNsYXNzYCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIChjaGlsZENsYXNzKSB7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3QoW2NoaWxkQ2xhc3MudGFibGVdLCAnUGFyZW50Q2hpbGRUYWJsZScpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogY2hpbGRDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjaGlsZENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5leHBhbmQoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzKG5ld05vZGVDbGFzcyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLnVucm9sbChhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvQ2hpbGROb2RlQ2xhc3MobmV3Tm9kZUNsYXNzKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIHByb2plY3ROZXdFZGdlIChjbGFzc0lkTGlzdCkge1xuICAgIGNvbnN0IGNsYXNzTGlzdCA9IFt0aGlzXS5jb25jYXQoY2xhc3NJZExpc3QubWFwKGNsYXNzSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwuY2xhc3Nlc1tjbGFzc0lkXTtcbiAgICB9KSk7XG4gICAgaWYgKGNsYXNzTGlzdC5sZW5ndGggPCAzIHx8IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0udHlwZSAhPT0gJ05vZGUnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY2xhc3NJZExpc3RgKTtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlQ2xhc3NJZCA9IHRoaXMuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzc0lkID0gY2xhc3NMaXN0W2NsYXNzTGlzdC5sZW5ndGggLSAxXS5jbGFzc0lkO1xuICAgIGxldCB0YWJsZU9yZGVyID0gW107XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjbGFzc0xpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGNsYXNzT2JqID0gY2xhc3NMaXN0W2ldO1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBlZGdlUm9sZSA9IGNsYXNzTGlzdFtpIC0gMV0uZ2V0RWRnZVJvbGUoY2xhc3NPYmopO1xuICAgICAgICBpZiAoZWRnZVJvbGUgPT09ICdzb3VyY2UnIHx8IGVkZ2VSb2xlID09PSAnYm90aCcpIHtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoXG4gICAgICAgICAgICBBcnJheS5mcm9tKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKS5yZXZlcnNlKCkpO1xuICAgICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChcbiAgICAgICAgICAgIEFycmF5LmZyb20oY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMpLnJldmVyc2UoKSk7XG4gICAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgICAgIHRhYmxlT3JkZXIgPSB0YWJsZU9yZGVyLmNvbmNhdChjbGFzc09iai5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLnRhYmxlLnByb2plY3QodGFibGVPcmRlcik7XG4gICAgY29uc3QgbmV3Q2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQsXG4gICAgICB0YXJnZXRDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHM6IFtdLFxuICAgICAgdGFyZ2V0VGFibGVJZHM6IFtdXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICByZXR1cm4gbmV3Q2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NlcyAmJiAhb3B0aW9ucy5jbGFzc2VzLmZpbmQoZCA9PiB0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IGQuY2xhc3NJZCkpIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzSWRzICYmIG9wdGlvbnMuY2xhc3NJZHMuaW5kZXhPZih0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpID09PSAtMSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBjb25zdCB0YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuY29uY2F0KFsgdGFyZ2V0VGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgW1xuICAgICAgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBub2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucyksXG4gICAgICB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpXG4gICAgXSk7XG4gIH1cbiAgYXN5bmMgKiBuZWlnaGJvcnMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5ub2RlcyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlTmVpZ2hib3Job29kIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7XG4gICAgICAgICAgc291cmNlLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBlZGdlOiB0aGlzXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUsIG9wdGlvbnMpO1xuICAgIG5ld0NsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICBuZXdDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGRpc3NvbHZlIChvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBuZXdDbGFzcyA9IHN1cGVyLmRpc3NvbHZlKG9wdGlvbnMpO1xuICAgIGlmIChuZXdDbGFzcy5zb3VyY2VUYWJsZUlkcy5zaGlmdCgpICE9PSBuZXdDbGFzcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEluY29uc2lzdGVudCB0YWJsZUlkcyB3aGVuIGRpc3NvbHZpbmcgYW4gZWRnZSBjbGFzc2ApO1xuICAgIH1cbiAgICBpZiAobmV3Q2xhc3MudGFyZ2V0VGFibGVJZHMuc2hpZnQoKSAhPT0gbmV3Q2xhc3MudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbmNvbnNpc3RlbnQgdGFibGVJZHMgd2hlbiBkaXNzb2x2aW5nIGFuIGVkZ2UgY2xhc3NgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGNvbm5lY3RGYWNldGVkQ2xhc3MgKG5ld0VkZ2VDbGFzcykge1xuICAgIC8vIFdoZW4gYW4gZWRnZSBjbGFzcyBpcyBmYWNldGVkLCB3ZSB3YW50IHRvIGtlZXAgdGhlIHNhbWUgY29ubmVjdGlvbnMuIFRoaXNcbiAgICAvLyBtZWFucyB3ZSBuZWVkIHRvIGNsb25lIGVhY2ggdGFibGUgY2hhaW4sIGFuZCBhZGQgb3VyIG93biB0YWJsZSB0byBpdFxuICAgIC8vIChiZWNhdXNlIG91ciB0YWJsZSBpcyB0aGUgcGFyZW50VGFibGUgb2YgdGhlIG5ldyBvbmUpXG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICBuZXdFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMgPSBBcnJheS5mcm9tKHRoaXMuc291cmNlVGFibGVJZHMpO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnVuc2hpZnQodGhpcy50YWJsZUlkKTtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIGNvbnN0IG5ld0NsYXNzZXMgPSBzdXBlci5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcyk7XG4gICAgZm9yIChjb25zdCBuZXdDbGFzcyBvZiBuZXdDbGFzc2VzKSB7XG4gICAgICB0aGlzLmNvbm5lY3RGYWNldGVkQ2xhc3MobmV3Q2xhc3MpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3Q2xhc3NlcztcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdDbGFzcyBvZiBzdXBlci5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICAgIHlpZWxkIG5ld0NsYXNzO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImNsYXNzIEZpbGVGb3JtYXQge1xuICBhc3luYyBidWlsZFJvdyAoaXRlbSkge1xuICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgIGZvciAobGV0IGF0dHIgaW4gaXRlbS5yb3cpIHtcbiAgICAgIHJvd1thdHRyXSA9IGF3YWl0IGl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICByZXR1cm4gcm93O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWxlRm9ybWF0O1xuIiwiY2xhc3MgUGFyc2VGYWlsdXJlIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvciAoZmlsZUZvcm1hdCkge1xuICAgIHN1cGVyKGBGYWlsZWQgdG8gcGFyc2UgZm9ybWF0OiAke2ZpbGVGb3JtYXQuY29uc3RydWN0b3IubmFtZX1gKTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUGFyc2VGYWlsdXJlO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBQYXJzZUZhaWx1cmUgZnJvbSAnLi9QYXJzZUZhaWx1cmUuanMnO1xuXG5jb25zdCBOT0RFX05BTUVTID0gWydub2RlcycsICdOb2RlcyddO1xuY29uc3QgRURHRV9OQU1FUyA9IFsnZWRnZXMnLCAnbGlua3MnLCAnRWRnZXMnLCAnTGlua3MnXTtcblxuY2xhc3MgRDNKc29uIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0LFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgY29uc3Qgbm9kZU5hbWUgPSBOT0RFX05BTUVTLmZpbmQobmFtZSA9PiBkYXRhW25hbWVdIGluc3RhbmNlb2YgQXJyYXkpO1xuICAgIGNvbnN0IGVkZ2VOYW1lID0gRURHRV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBpZiAoIW5vZGVOYW1lIHx8ICFlZGdlTmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlRmFpbHVyZSh0aGlzKTtcbiAgICB9XG5cbiAgICBjb25zdCBjb3JlVGFibGUgPSBtb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnU3RhdGljRGljdFRhYmxlJyxcbiAgICAgIG5hbWU6ICdjb3JlVGFibGUnLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pO1xuICAgIGNvbnN0IGNvcmVDbGFzcyA9IG1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29yZVRhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgICBsZXQgW25vZGVzLCBlZGdlc10gPSBjb3JlQ2xhc3MuY2xvc2VkVHJhbnNwb3NlKFtub2RlTmFtZSwgZWRnZU5hbWVdKTtcblxuICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBpbXBvcnQgY2xhc3NlcyBmcm9tIEQzLXN0eWxlIEpTT04gd2l0aG91dCBub2RlQXR0cmlidXRlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCBub2RlQ2xhc3NlcyA9IFtdO1xuICAgICAgY29uc3Qgbm9kZUNsYXNzTG9va3VwID0ge307XG4gICAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlQ2xhc3Mgb2Ygbm9kZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBub2RlQ2xhc3NMb29rdXBbbm9kZUNsYXNzLmNsYXNzTmFtZV0gPSBub2RlQ2xhc3Nlcy5sZW5ndGg7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2gobm9kZUNsYXNzLmludGVycHJldEFzTm9kZXMoKSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlcy5vcGVuRmFjZXQoY2xhc3NBdHRyaWJ1dGUpKSB7XG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goZWRnZUNsYXNzLmludGVycHJldEFzRWRnZXMoKSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZSA9IGF3YWl0IGVkZ2VDbGFzcy50YWJsZS5nZXRJdGVtKCk7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNsYXNzTmFtZSA9IGF3YWl0IHNhbXBsZS5yb3dbc291cmNlQXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdO1xuICAgICAgICBpZiAobm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgICAgICAgbm9kZUNsYXNzOiBub2RlQ2xhc3Nlc1tub2RlQ2xhc3NMb29rdXBbc291cmNlQ2xhc3NOYW1lXV0sXG4gICAgICAgICAgICBzaWRlOiAnc291cmNlJyxcbiAgICAgICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRDbGFzc05hbWUgPSBhd2FpdCBzYW1wbGUucm93W3RhcmdldEF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3RhcmdldENsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZXMgPSBub2Rlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgICBub2Rlcy5zZXRDbGFzc05hbWUobm9kZU5hbWUpO1xuICAgICAgZWRnZXMgPSBlZGdlcy5pbnRlcnByZXRBc0VkZ2VzKCk7XG4gICAgICBlZGdlcy5zZXRDbGFzc05hbWUoZWRnZU5hbWUpO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHNvdXJjZUF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgICBub2Rlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgICBlZGdlQ2xhc3M6IGVkZ2VzLFxuICAgICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogdGFyZ2V0QXR0cmlidXRlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBwcmV0dHkgPSB0cnVlLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIHNvdXJjZUF0dHJpYnV0ZSA9ICdzb3VyY2UnLFxuICAgIHRhcmdldEF0dHJpYnV0ZSA9ICd0YXJnZXQnLFxuICAgIGNsYXNzQXR0cmlidXRlID0gbnVsbFxuICB9KSB7XG4gICAgaWYgKGNsYXNzQXR0cmlidXRlICYmICFub2RlQXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCBEMy1zdHlsZSBKU09OIHdpdGggY2xhc3Nlcywgd2l0aG91dCBhIG5vZGVBdHRyaWJ1dGVgKTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG4gICAgY29uc3Qgbm9kZUxvb2t1cCA9IHt9O1xuICAgIGNvbnN0IG5vZGVDbGFzc2VzID0gW107XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIG5vZGVDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQub3RoZXIgPSByZXN1bHQub3RoZXIgfHwgW107XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICByZXN1bHQub3RoZXIucHVzaChhd2FpdCB0aGlzLmJ1aWxkUm93KGl0ZW0pKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IG5vZGVDbGFzcyBvZiBub2RlQ2xhc3Nlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIG5vZGVDbGFzcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgbm9kZUxvb2t1cFtub2RlLmV4cG9ydElkXSA9IHJlc3VsdC5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3cobm9kZSk7XG4gICAgICAgIGlmIChub2RlQXR0cmlidXRlKSB7XG4gICAgICAgICAgcm93W25vZGVBdHRyaWJ1dGVdID0gbm9kZS5leHBvcnRJZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbY2xhc3NBdHRyaWJ1dGVdID0gbm9kZS5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0Lm5vZGVzLnB1c2gocm93KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiBlZGdlQ2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHRoaXMuYnVpbGRSb3coZWRnZSk7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBub2RlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHNvdXJjZS5leHBvcnRJZCA6IG5vZGVMb29rdXBbc291cmNlLmV4cG9ydElkXTtcbiAgICAgICAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgIHJvd1tzb3VyY2VBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV0gPSBzb3VyY2UuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3Nlczogbm9kZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgIHJvd1t0YXJnZXRBdHRyaWJ1dGVdID0gbm9kZUF0dHJpYnV0ZSA/IHRhcmdldC5leHBvcnRJZCA6IG5vZGVMb29rdXBbdGFyZ2V0LmV4cG9ydElkXTtcbiAgICAgICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgICByb3dbdGFyZ2V0QXR0cmlidXRlICsgJ18nICsgY2xhc3NBdHRyaWJ1dGVdID0gdGFyZ2V0LmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5saW5rcy5wdXNoKE9iamVjdC5hc3NpZ24oe30sIHJvdykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJldHR5KSB7XG4gICAgICByZXN1bHQubm9kZXMgPSAnICBcIm5vZGVzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5ub2Rlcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICByZXN1bHQubGlua3MgPSAnICBcImxpbmtzXCI6IFtcXG4gICAgJyArIHJlc3VsdC5saW5rcy5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgIC5qb2luKCcsXFxuICAgICcpICsgJ1xcbiAgXSc7XG4gICAgICBpZiAocmVzdWx0Lm90aGVyKSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9ICcsXFxuICBcIm90aGVyXCI6IFtcXG4gICAgJyArIHJlc3VsdC5vdGhlci5tYXAocm93ID0+IEpTT04uc3RyaW5naWZ5KHJvdykpXG4gICAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIH1cbiAgICAgIHJlc3VsdCA9IGB7XFxuJHtyZXN1bHQubm9kZXN9LFxcbiR7cmVzdWx0LmxpbmtzfSR7cmVzdWx0Lm90aGVyIHx8ICcnfVxcbn1cXG5gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeShyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogJ2RhdGE6dGV4dC9qc29uO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC9qc29uJyxcbiAgICAgIGV4dGVuc2lvbjogJ2pzb24nXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEQzSnNvbigpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBKU1ppcCBmcm9tICdqc3ppcCc7XG5cbmNsYXNzIENzdlppcCBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBpbmRleE5hbWUgPSAnaW5kZXgnXG4gIH0pIHtcbiAgICBjb25zdCB6aXAgPSBuZXcgSlNaaXAoKTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBjbGFzc09iai50YWJsZS51blN1cHByZXNzZWRBdHRyaWJ1dGVzO1xuICAgICAgbGV0IGNvbnRlbnRzID0gYCR7aW5kZXhOYW1lfSwke2F0dHJpYnV0ZXMuam9pbignLCcpfVxcbmA7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnRlbnRzICs9IGAke2l0ZW0uaW5kZXh9YDtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICBjb250ZW50cyArPSBgLCR7YXdhaXQgaXRlbS5yb3dbYXR0cl19YDtcbiAgICAgICAgfVxuICAgICAgICBjb250ZW50cyArPSBgXFxuYDtcbiAgICAgIH1cbiAgICAgIHppcC5maWxlKGNsYXNzT2JqLmNsYXNzTmFtZSArICcuY3N2JywgY29udGVudHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTphcHBsaWNhdGlvbi96aXA7YmFzZTY0LCcgKyBhd2FpdCB6aXAuZ2VuZXJhdGVBc3luYyh7IHR5cGU6ICdiYXNlNjQnIH0pLFxuICAgICAgdHlwZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG4gICAgICBleHRlbnNpb246ICd6aXAnXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IENzdlppcCgpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcblxuY29uc3QgZXNjYXBlQ2hhcnMgPSB7XG4gICcmcXVvdDsnOiAvXCIvZyxcbiAgJyZhcG9zOyc6IC8nL2csXG4gICcmbHQ7JzogLzwvZyxcbiAgJyZndDsnOiAvPi9nXG59O1xuXG5jbGFzcyBHRVhGIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBlc2NhcGUgKHN0cikge1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC8mL2csICcmYW1wOycpO1xuICAgIGZvciAoY29uc3QgWyByZXBsLCBleHAgXSBvZiBPYmplY3QuZW50cmllcyhlc2NhcGVDaGFycykpIHtcbiAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKGV4cCwgcmVwbCk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9ICdjbGFzcydcbiAgfSkge1xuICAgIGxldCBub2RlQ2h1bmsgPSAnJztcbiAgICBsZXQgZWRnZUNodW5rID0gJyc7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGluY2x1ZGVDbGFzc2VzKSB7XG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBjbGFzc09iai50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgICBub2RlQ2h1bmsgKz0gYFxuICAgIDxub2RlIGlkPVwiJHt0aGlzLmVzY2FwZShub2RlLmV4cG9ydElkKX1cIiBsYWJlbD1cIiR7dGhpcy5lc2NhcGUobm9kZS5sYWJlbCl9XCI+XG4gICAgICA8YXR0dmFsdWVzPlxuICAgICAgICA8YXR0dmFsdWUgZm9yPVwiMFwiIHZhbHVlPVwiJHt0aGlzLmVzY2FwZShjbGFzc09iai5jbGFzc05hbWUpfVwiLz5cbiAgICAgIDwvYXR0dmFsdWVzPlxuICAgIDwvbm9kZT5gO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2Rlcyh7IGNsYXNzZXM6IGluY2x1ZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKHsgY2xhc3NlczogaW5jbHVkZUNsYXNzZXMgfSkpIHtcbiAgICAgICAgICAgICAgZWRnZUNodW5rICs9IGBcbiAgICA8ZWRnZSBpZD1cIiR7dGhpcy5lc2NhcGUoZWRnZS5leHBvcnRJZCl9XCIgc291cmNlPVwiJHt0aGlzLmVzY2FwZShzb3VyY2UuZXhwb3J0SWQpfVwiIHRhcmdldD1cIiR7dGhpcy5lc2NhcGUodGFyZ2V0LmV4cG9ydElkKX1cIj5cbiAgICAgIDxhdHR2YWx1ZXM+XG4gICAgICAgIDxhdHR2YWx1ZSBmb3I9XCIwXCIgdmFsdWU9XCIke3RoaXMuZXNjYXBlKGNsYXNzT2JqLmNsYXNzTmFtZSl9XCIvPlxuICAgICAgPC9hdHR2YWx1ZXM+XG4gICAgPC9lZGdlPmA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gYFxcXG48P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cbjxnZXhmICB4bWxucz1cImh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnRcIiB4bWxuczp4c2k9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAxL1hNTFNjaGVtYS1pbnN0YW5jZVwiIHhzaTpzY2hlbWFMb2NhdGlvbj1cImh0dHA6Ly93d3cuZ2V4Zi5uZXQvMS4yZHJhZnQgaHR0cDovL3d3dy5nZXhmLm5ldC8xLjJkcmFmdC9nZXhmLnhzZFwiIHZlcnNpb249XCIxLjJcIj5cbjxtZXRhIGxhc3Rtb2RpZmllZGRhdGU9XCIyMDA5LTAzLTIwXCI+XG4gIDxjcmVhdG9yPm9yaWdyYXBoLmdpdGh1Yi5pbzwvY3JlYXRvcj5cbiAgPGRlc2NyaXB0aW9uPiR7bW9kZWwubmFtZX08L2Rlc2NyaXB0aW9uPlxuPC9tZXRhPlxuPGdyYXBoIG1vZGU9XCJzdGF0aWNcIiBkZWZhdWx0ZWRnZXR5cGU9XCJkaXJlY3RlZFwiPlxuICA8YXR0cmlidXRlcyBjbGFzcz1cIm5vZGVcIj5cbiAgICA8YXR0cmlidXRlIGlkPVwiMFwiIHRpdGxlPVwiJHtjbGFzc0F0dHJpYnV0ZX1cIiB0eXBlPVwic3RyaW5nXCIvPlxuICA8L2F0dHJpYnV0ZXM+XG4gIDxhdHRyaWJ1dGVzIGNsYXNzPVwiZWRnZVwiPlxuICAgIDxhdHRyaWJ1dGUgaWQ9XCIwXCIgdGl0bGU9XCIke2NsYXNzQXR0cmlidXRlfVwiIHR5cGU9XCJzdHJpbmdcIi8+XG4gIDwvYXR0cmlidXRlcz5cbiAgPG5vZGVzPiR7bm9kZUNodW5rfVxuICA8L25vZGVzPlxuICA8ZWRnZXM+JHtlZGdlQ2h1bmt9XG4gIDwvZWRnZXM+XG48L2dyYXBoPlxuPC9nZXhmPlxuICBgO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6ICdkYXRhOnRleHQveG1sO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICB0eXBlOiAndGV4dC94bWwnLFxuICAgICAgZXh0ZW5zaW9uOiAnZ2V4ZidcbiAgICB9O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgR0VYRigpO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIEZJTEVfRk9STUFUUyBmcm9tICcuLi9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0cy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBpZiAodGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5jbGFzc09iaiAmJiAhb3B0aW9ucy5vdmVyd3JpdGUpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICB9XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgQ0xBU1NFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdO1xuICB9XG4gIGZpbmRDbGFzcyAoY2xhc3NOYW1lKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IGNsYXNzT2JqLmNsYXNzTmFtZSA9PT0gY2xhc3NOYW1lKTtcbiAgfVxuICByZW5hbWUgKG5ld05hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuZXdOYW1lO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYW5ub3RhdGUgKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuX29yaWdyYXBoLmRlbGV0ZU1vZGVsKHRoaXMubW9kZWxJZCk7XG4gIH1cbiAgZ2V0IGRlbGV0ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9vcmlncmFwaC5tb2RlbHNbdGhpcy5tb2RlbElkXTtcbiAgfVxuICBhc3luYyBhZGRUZXh0RmlsZSAob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucy5mb3JtYXQpIHtcbiAgICAgIG9wdGlvbnMuZm9ybWF0ID0gbWltZS5leHRlbnNpb24obWltZS5sb29rdXAob3B0aW9ucy5uYW1lKSk7XG4gICAgfVxuICAgIGlmIChGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmltcG9ydERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICBvcHRpb25zLmRhdGEgPSBkYXRhbGliLnJlYWQob3B0aW9ucy50ZXh0LCB7IHR5cGU6IG9wdGlvbnMuZm9ybWF0IH0pO1xuICAgICAgaWYgKG9wdGlvbnMuZm9ybWF0ID09PSAnY3N2JyB8fCBvcHRpb25zLmZvcm1hdCA9PT0gJ3RzdicpIHtcbiAgICAgICAgb3B0aW9ucy5hdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBvcHRpb25zLmRhdGEuY29sdW1ucykge1xuICAgICAgICAgIG9wdGlvbnMuYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIG9wdGlvbnMuZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYWRkU3RhdGljVGFibGUob3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgcmV0dXJuIEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0uZm9ybWF0RGF0YShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKERBVEFMSUJfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmF3ICR7b3B0aW9ucy5mb3JtYXR9IGV4cG9ydCBub3QgeWV0IHN1cHBvcnRlZGApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGV4cG9ydCB1bmtub3duIGZvcm1hdDogJHtvcHRpb25zLmZvcm1hdH1gKTtcbiAgICB9XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIG9wdGltaXplVGFibGVzICgpIHtcbiAgICBjb25zdCB0YWJsZXNJblVzZSA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICB0YWJsZXNJblVzZVtjbGFzc09iai50YWJsZUlkXSA9IHRydWU7XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgY2xhc3NPYmouc291cmNlVGFibGVJZHMgfHwgW10pIHtcbiAgICAgICAgdGFibGVzSW5Vc2VbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzIHx8IFtdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgcGFyZW50c1Zpc2l0ZWQgPSB7fTtcbiAgICBjb25zdCBxdWV1ZSA9IE9iamVjdC5rZXlzKHRhYmxlc0luVXNlKTtcbiAgICB3aGlsZSAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgdGFibGVJZCA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgICBpZiAoIXBhcmVudHNWaXNpdGVkW3RhYmxlSWRdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgICAgcGFyZW50c1Zpc2l0ZWRbdGFibGVJZF0gPSB0cnVlO1xuICAgICAgICBjb25zdCB0YWJsZSA9IHRoaXMudGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICAgIHF1ZXVlLnB1c2gocGFyZW50VGFibGUudGFibGVJZCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRoaXMudGFibGVzKSkge1xuICAgICAgY29uc3QgdGFibGUgPSB0aGlzLnRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIGlmICghdGFibGVzSW5Vc2VbdGFibGVJZF0gJiYgdGFibGUudHlwZSAhPT0gJ1N0YXRpYycgJiYgdGFibGUudHlwZSAhPT0gJ1N0YXRpY0RpY3QnKSB7XG4gICAgICAgIHRhYmxlLmRlbGV0ZSh0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gVE9ETzogSWYgYW55IER1cGxpY2F0ZWRUYWJsZSBpcyBpbiB1c2UsIGJ1dCB0aGUgb3JpZ2luYWwgaXNuJ3QsIHN3YXAgZm9yIHRoZSByZWFsIG9uZVxuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlU2FtcGxlICgpIHtcbiAgICBjb25zdCBzZWVkTGltaXQgPSAxMDA7XG4gICAgY29uc3QgY2x1c3RlckxpbWl0ID0gNTtcbiAgICBjb25zdCBjbGFzc0NvdW50ID0gNTtcbiAgICAvLyBUcnkgdG8gZ2V0IGF0IG1vc3Qgcm91Z2hseSBzZWVkQ291bnQgbm9kZXMgLyBlZGdlcywgaW4gY2x1c3RlcnMgb2YgYWJvdXRcbiAgICAvLyBjbHVzdGVyTGltaXQsIGFuZCB0cnkgdG8gaW5jbHVkZSBhdCBsZWFzdCBjbGFzc0NvdW50IGluc3RhbmNlcyBwZXIgY2xhc3NcbiAgICAvLyAobWF5IHJldHVybiBudWxsIGlmIGNhY2hlcyBhcmUgaW52YWxpZGF0ZWQgZHVyaW5nIGl0ZXJhdGlvbilcbiAgICBsZXQgaXRlcmF0aW9uUmVzZXQgPSBmYWxzZTtcbiAgICBjb25zdCBpbnN0YW5jZXMgPSB7fTtcbiAgICBsZXQgdG90YWxDb3VudCA9IDA7XG4gICAgY29uc3QgY2xhc3NDb3VudHMgPSB7fTtcblxuICAgIGNvbnN0IHBvcHVsYXRlQ2xhc3NDb3VudHMgPSBhc3luYyAoaW5zdGFuY2UpID0+IHtcbiAgICAgIGlmIChpbnN0YW5jZS5yZXNldCkge1xuICAgICAgICAvLyBDYWNoZSBpbnZhbGlkYXRlZCEgU3RvcCBpdGVyYXRpbmcgYW5kIHJldHVybiBudWxsXG4gICAgICAgIGl0ZXJhdGlvblJlc2V0ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKGluc3RhbmNlc1tpbnN0YW5jZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAvLyBEb24ndCBhZGQgdGhpcyBpbnN0YW5jZSBpZiB3ZSBhbHJlYWR5IHNhbXBsZWQgaXQsIGJ1dCBrZWVwIGl0ZXJhdGluZ1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIC8vIEFkZCBhbmQgY291bnQgdGhpcyBpbnN0YW5jZSB0byB0aGUgc2FtcGxlXG4gICAgICBpbnN0YW5jZXNbaW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIHRvdGFsQ291bnQrKztcbiAgICAgIGNsYXNzQ291bnRzW2luc3RhbmNlLmNsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NDb3VudHNbaW5zdGFuY2UuY2xhc3NPYmouY2xhc3NJZF0gfHwgMDtcbiAgICAgIGNsYXNzQ291bnRzW2luc3RhbmNlLmNsYXNzT2JqLmNsYXNzSWRdKys7XG5cbiAgICAgIGlmICh0b3RhbENvdW50ID49IHNlZWRMaW1pdCkge1xuICAgICAgICAvLyBXZSBoYXZlIGVub3VnaDsgc3RvcCBpdGVyYXRpbmdcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBUcnkgdG8gYWRkIHRoZSBuZWlnaGJvcnMgb2YgdGhpcyBzYW1wbGUgZnJvbSBjbGFzc2VzIHdoZXJlIHdlIGRvbid0IGhhdmVcbiAgICAgIC8vIGVub3VnaCBzYW1wbGVzIHlldFxuICAgICAgY29uc3QgY2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmNsYXNzZXMpLmZpbHRlcihjbGFzc0lkID0+IHtcbiAgICAgICAgcmV0dXJuIChjbGFzc0NvdW50c1tjbGFzc0lkXSB8fCAwKSA8IGNsYXNzQ291bnQ7XG4gICAgICB9KTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbmVpZ2hib3Igb2YgaW5zdGFuY2UubmVpZ2hib3JzKHsgbGltaXQ6IGNsdXN0ZXJMaW1pdCwgY2xhc3NJZHMgfSkpIHtcbiAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKG5laWdoYm9yKSkge1xuICAgICAgICAgIC8vIFBhc3MgYWxvbmcgdGhlIHNpZ25hbCB0byBzdG9wIGl0ZXJhdGluZ1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gU2lnbmFsIHRoYXQgd2Ugc2hvdWxkIGtlZXAgaXRlcmF0aW5nXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2NsYXNzSWQsIGNsYXNzT2JqXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjb25zdCByb3dDb3VudCA9IGF3YWl0IGNsYXNzT2JqLnRhYmxlLmNvdW50Um93cygpO1xuICAgICAgLy8gR2V0IGF0IGxlYXN0IGNsYXNzQ291bnQgaW5zdGFuY2VzIGZyb20gdGhpcyBjbGFzcyAoYXMgbG9uZyBhcyB3ZVxuICAgICAgLy8gaGF2ZW4ndCBleGhhdXN0ZWQgYWxsIHRoZSBpbnN0YW5jZXMgdGhlIGNsYXNzIGhhcyB0byBnaXZlKVxuICAgICAgd2hpbGUgKChjbGFzc0NvdW50c1tjbGFzc0lkXSB8fCAwKSA8IGNsYXNzQ291bnQgJiYgKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgcm93Q291bnQpIHtcbiAgICAgICAgaWYgKGl0ZXJhdGlvblJlc2V0KSB7XG4gICAgICAgICAgLy8gQ2FjaGUgaW52YWxpZGF0ZWQ7IGJhaWwgaW1tZWRpYXRlbHlcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgYSByYW5kb20gaW5zdGFuY2UsIGFuZCB0cnkgdG8gcHJpb3JpdGl6ZSBpdHMgbmVpZ2hib3JzIGluIG90aGVyIGNsYXNzZXNcbiAgICAgICAgaWYgKCFhd2FpdCBwb3B1bGF0ZUNsYXNzQ291bnRzKGF3YWl0IGNsYXNzT2JqLnRhYmxlLmdldFJhbmRvbUl0ZW0oKSkpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5zdGFuY2VzO1xuICB9XG4gIHZhbGlkYXRlSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIENoZWNrIGlmIGFsbCB0aGUgaW5zdGFuY2VzIGFyZSBzdGlsbCBjdXJyZW50OyByZXR1cm4gbnVsbCBhcyBhIHNpZ25hbFxuICAgIC8vIHRoYXQgYSBjYWNoZSB3YXMgaW52YWxpZGF0ZWQsIGFuZCB0aGF0IGEgZnVuY3Rpb24gbmVlZHMgdG8gYmUgY2FsbGVkIGFnYWluXG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBPYmplY3QudmFsdWVzKGluc3RhbmNlcykpIHtcbiAgICAgIGlmIChpbnN0YW5jZS5yZXNldCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGluc3RhbmNlcztcbiAgfVxuICBhc3luYyB1cGRhdGVJbnN0YW5jZVNhbXBsZSAoaW5zdGFuY2VzKSB7XG4gICAgLy8gUmVwbGFjZSBhbnkgb3V0LW9mLWRhdGUgaW5zdGFuY2VzLCBhbmQgZXhjbHVkZSBpbnN0YW5jZXMgdGhhdCBubyBsb25nZXIgZXhpc3RcbiAgICBjb25zdCByZXN1bHQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtpbnN0YW5jZUlkLCBpbnN0YW5jZV0gb2YgT2JqZWN0LmVudHJpZXMoaW5zdGFuY2VzKSkge1xuICAgICAgY29uc3QgeyBjbGFzc0lkLCBpbmRleCB9ID0gSlNPTi5wYXJzZShpbnN0YW5jZUlkKTtcbiAgICAgIGlmICh0aGlzLmNsYXNzZXNbY2xhc3NJZF0pIHtcbiAgICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgICAgY29uc3QgbmV3SW5zdGFuY2UgPSBhd2FpdCB0aGlzLmNsYXNzZXNbY2xhc3NJZF0udGFibGUuZ2V0SXRlbShpbmRleCk7XG4gICAgICAgICAgaWYgKG5ld0luc3RhbmNlKSB7XG4gICAgICAgICAgICByZXN1bHRbbmV3SW5zdGFuY2UuaW5zdGFuY2VJZF0gPSBuZXdJbnN0YW5jZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmFsaWRhdGVJbnN0YW5jZVNhbXBsZShyZXN1bHQpO1xuICB9XG4gIHBhcnRpdGlvbkluc3RhbmNlU2FtcGxlIChpbnN0YW5jZXMpIHtcbiAgICAvLyBTZXBhcmF0ZSBzYW1wbGVzIGJ5IHRoZWlyIHR5cGVcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBub2Rlczoge30sXG4gICAgICBlZGdlczoge30sXG4gICAgICBnZW5lcmljczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIGluc3RhbmNlXSBvZiBPYmplY3QuZW50cmllcyhpbnN0YW5jZXMpKSB7XG4gICAgICBpZiAoaW5zdGFuY2UudHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIHJlc3VsdC5ub2Rlc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfSBlbHNlIGlmIChpbnN0YW5jZS50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgcmVzdWx0LmVkZ2VzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuZ2VuZXJpY3NbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBhc3luYyBmaWxsSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIEdpdmVuIGEgc3BlY2lmaWMgc2FtcGxlIG9mIHRoZSBncmFwaCwgYWRkIGluc3RhbmNlcyB0byBlbnN1cmUgdGhhdDpcbiAgICAvLyAxLiBGb3IgZXZlcnkgcGFpciBvZiBub2RlcywgYW55IGVkZ2VzIHRoYXQgZXhpc3QgYmV0d2VlbiB0aGVtIHNob3VsZCBiZSBhZGRlZFxuICAgIC8vIDIuIEZvciBldmVyeSBlZGdlLCBlbnN1cmUgdGhhdCBhdCBsZWFzdCBvbmUgc291cmNlIGFuZCB0YXJnZXQgbm9kZSBpcyBhZGRlZFxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gICAgY29uc3QgZXh0cmFOb2RlcyA9IHt9O1xuICAgIGNvbnN0IGV4dHJhRWRnZXMgPSB7fTtcblxuICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGVhY2ggZWRnZSBoYXMgYXQgbGVhc3Qgb25lIHNvdXJjZSBhbmQgb25lIHRhcmdldCAoYXNzdW1pbmdcbiAgICAvLyB0aGF0IHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXMgYXJlIGNvbm5lY3RlZClcbiAgICBjb25zdCBzZWVkU2lkZSA9IGFzeW5jIChlZGdlLCBpdGVyRnVuYykgPT4ge1xuICAgICAgbGV0IGFOb2RlO1xuICAgICAgbGV0IGlzU2VlZGVkID0gZmFsc2U7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgZWRnZVtpdGVyRnVuY10oKSkge1xuICAgICAgICBhTm9kZSA9IGFOb2RlIHx8IG5vZGU7XG4gICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgaXNTZWVkZWQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIWlzU2VlZGVkICYmIGFOb2RlKSB7XG4gICAgICAgIGV4dHJhTm9kZXNbYU5vZGUuaW5zdGFuY2VJZF0gPSBhTm9kZTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VzKSkge1xuICAgICAgYXdhaXQgc2VlZFNpZGUoZWRnZSwgJ3NvdXJjZU5vZGVzJyk7XG4gICAgICBhd2FpdCBzZWVkU2lkZShlZGdlLCAndGFyZ2V0Tm9kZXMnKTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYW55IGVkZ2VzIHRoYXQgZXhpc3QgdGhhdCBjb25uZWN0IGFueSBvZiB0aGUgY29yZSBub2Rlc1xuICAgIGZvciAoY29uc3Qgbm9kZSBvZiBPYmplY3QudmFsdWVzKG5vZGVzKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIG5vZGUuZWRnZXMoKSkge1xuICAgICAgICBpZiAoIWVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAvLyBDaGVjayB0aGF0IGJvdGggZW5kcyBvZiB0aGUgZWRnZSBjb25uZWN0IGF0IGxlYXN0IG9uZVxuICAgICAgICAgIC8vIG9mIG91ciBub2Rlc1xuICAgICAgICAgIGxldCBjb25uZWN0c1NvdXJjZSA9IGZhbHNlO1xuICAgICAgICAgIGxldCBjb25uZWN0c1RhcmdldCA9IGZhbHNlO1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzU291cmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChub2Rlc1tub2RlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgICAgICAgIGNvbm5lY3RzVGFyZ2V0ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjb25uZWN0c1NvdXJjZSAmJiBjb25uZWN0c1RhcmdldCkge1xuICAgICAgICAgICAgZXh0cmFFZGdlc1tlZGdlLmluc3RhbmNlSWRdID0gZWRnZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYSBjb21wbGV0ZSBzZXQgb2Ygbm9kZXMgYW5kIGVkZ2VzIHRoYXQgd2Ugd2FudCB0b1xuICAgIC8vIGluY2x1ZGUuIFdlIGp1c3QgbmVlZCB0byBtZXJnZSBhbmQgdmFsaWRhdGUgdGhlIHNhbXBsZXM6XG4gICAgaW5zdGFuY2VzID0gT2JqZWN0LmFzc2lnbih7fSwgbm9kZXMsIGVkZ2VzLCBleHRyYU5vZGVzLCBleHRyYUVkZ2VzKTtcbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG4gIH1cbiAgYXN5bmMgaW5zdGFuY2VTYW1wbGVUb0dyYXBoIChpbnN0YW5jZXMpIHtcbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcblxuICAgIGNvbnN0IHsgbm9kZXMsIGVkZ2VzIH0gPSB0aGlzLnBhcnRpdGlvbkluc3RhbmNlU2FtcGxlKGluc3RhbmNlcyk7XG5cbiAgICAvLyBNYWtlIGEgbGlzdCBvZiBub2RlcywgcGx1cyBhIGxvb2t1cCB0byBlYWNoIG5vZGUncyBpbmRleFxuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIG5vZGVdIG9mIE9iamVjdC5lbnRyaWVzKG5vZGVzKSkge1xuICAgICAgZ3JhcGgubm9kZUxvb2t1cFtpbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLm5vZGVzLnB1c2goe1xuICAgICAgICBub2RlSW5zdGFuY2U6IG5vZGUsXG4gICAgICAgIGR1bW15OiBmYWxzZVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIGFsbCB0aGUgZWRnZXMsIGluY2x1ZGluZyBkdW1teSBub2RlcyBmb3IgZGFuZ2xpbmcgZWRnZXNcbiAgICBmb3IgKGNvbnN0IGVkZ2Ugb2YgT2JqZWN0LnZhbHVlcyhlZGdlcykpIHtcbiAgICAgIGlmICghZWRnZS5jbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgLy8gTWlzc2luZyBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IGNsYXNzZXM7IGFkZCBkdW1teSBub2RlcyBmb3IgYm90aCBlbmRzXG4gICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoICsgMVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQWRkIGR1bW15IHNvdXJjZSBub2Rlc1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF1cbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoIWVkZ2UuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAvLyBBZGQgZHVtbXkgdGFyZ2V0IG5vZGVzXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdLFxuICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGVyZSBzaG91bGQgYmUgYm90aCBzb3VyY2UgYW5kIHRhcmdldCBub2RlcyBmb3IgZWFjaCBlZGdlXG4gICAgICAgIC8vIChvbmx5IGNyZWF0ZSBkdW1teSBub2RlcyBmb3IgZWRnZXMgdGhhdCBhcmUgYWN0dWFsbHkgZGlzY29ubmVjdGVkKVxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZU5vZGUgb2YgZWRnZS5zb3VyY2VOb2RlcygpKSB7XG4gICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldE5vZGUgb2YgZWRnZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldE5vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlLFxuICAgICAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW3NvdXJjZU5vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSxcbiAgICBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcylcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICBsZXQgZ3JhcGggPSB7XG4gICAgICBjbGFzc2VzOiBbXSxcbiAgICAgIGNsYXNzTG9va3VwOiB7fSxcbiAgICAgIGNsYXNzQ29ubmVjdGlvbnM6IFtdXG4gICAgfTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgY2xhc3NMaXN0KSB7XG4gICAgICAvLyBBZGQgYW5kIGluZGV4IHRoZSBjbGFzcyBhcyBhIG5vZGVcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGdyYXBoLmNsYXNzZXMucHVzaChjbGFzc1NwZWMpO1xuXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBlZGdlIGNsYXNzIHNvIHdlIGNhbiBjcmVhdGUgY2xhc3NDb25uZWN0aW9ucyBsYXRlclxuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ05vZGUnICYmIGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IG5vZGVcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7Y2xhc3NPYmouY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGggLSAxLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZUNsYXNzZXMpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZH0+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYGR1bW15PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+JHtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIGRpcmVjdGVkOiBlZGdlQ2xhc3MuZGlyZWN0ZWQsXG4gICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGggKCkge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgdGFibGVzOiBbXSxcbiAgICAgIHRhYmxlTG9va3VwOiB7fSxcbiAgICAgIHRhYmxlTGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCB0YWJsZUxpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMudGFibGVzKTtcbiAgICBmb3IgKGNvbnN0IHRhYmxlIG9mIHRhYmxlTGlzdCkge1xuICAgICAgY29uc3QgdGFibGVTcGVjID0gdGFibGUuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB0YWJsZVNwZWMudHlwZSA9IHRhYmxlLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGdyYXBoLnRhYmxlcy5sZW5ndGg7XG4gICAgICBncmFwaC50YWJsZXMucHVzaCh0YWJsZVNwZWMpO1xuICAgIH1cbiAgICAvLyBGaWxsIHRoZSBncmFwaCB3aXRoIGxpbmtzIGJhc2VkIG9uIHBhcmVudFRhYmxlcy4uLlxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRhYmxlLnBhcmVudFRhYmxlcykge1xuICAgICAgICBncmFwaC50YWJsZUxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogZ3JhcGgudGFibGVMb29rdXBbcGFyZW50VGFibGUudGFibGVJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC50YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE1vZGVsRHVtcCAoKSB7XG4gICAgLy8gQmVjYXVzZSBvYmplY3Qga2V5IG9yZGVycyBhcmVuJ3QgZGV0ZXJtaW5pc3RpYywgaXQgY2FuIGJlIHByb2JsZW1hdGljXG4gICAgLy8gZm9yIHRlc3RpbmcgKGJlY2F1c2UgaWRzIGNhbiByYW5kb21seSBjaGFuZ2UgZnJvbSB0ZXN0IHJ1biB0byB0ZXN0IHJ1bikuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzb3J0cyBlYWNoIGtleSwgYW5kIGp1c3QgcmVwbGFjZXMgSURzIHdpdGggaW5kZXggbnVtYmVyc1xuICAgIGNvbnN0IHJhd09iaiA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkodGhpcy5fdG9SYXdPYmplY3QoKSkpO1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIGNsYXNzZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLmNsYXNzZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLmNsYXNzZXNbYS5jbGFzc0lkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBjb25zdCBiSGFzaCA9IHRoaXMuY2xhc3Nlc1tiLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgdGFibGVzOiBPYmplY3QudmFsdWVzKHJhd09iai50YWJsZXMpLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgY29uc3QgYUhhc2ggPSB0aGlzLnRhYmxlc1thLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy50YWJsZXNbYi50YWJsZUlkXS5nZXRTb3J0SGFzaCgpO1xuICAgICAgICBpZiAoYUhhc2ggPCBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSBlbHNlIGlmIChhSGFzaCA+IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZSBoYXNoIGNvbGxpc2lvbmApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gICAgY29uc3QgY2xhc3NMb29rdXAgPSB7fTtcbiAgICBjb25zdCB0YWJsZUxvb2t1cCA9IHt9O1xuICAgIHJlc3VsdC5jbGFzc2VzLmZvckVhY2goKGNsYXNzT2JqLCBpbmRleCkgPT4ge1xuICAgICAgY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBpbmRleDtcbiAgICB9KTtcbiAgICByZXN1bHQudGFibGVzLmZvckVhY2goKHRhYmxlLCBpbmRleCkgPT4ge1xuICAgICAgdGFibGVMb29rdXBbdGFibGUudGFibGVJZF0gPSBpbmRleDtcbiAgICB9KTtcblxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgcmVzdWx0LnRhYmxlcykge1xuICAgICAgdGFibGUudGFibGVJZCA9IHRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpKSB7XG4gICAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVMb29rdXBbdGFibGVJZF1dID0gdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZGVsZXRlIHRhYmxlLmRlcml2ZWRUYWJsZXNbdGFibGVJZF07XG4gICAgICB9XG4gICAgICBkZWxldGUgdGFibGUuZGF0YTsgLy8gZG9uJ3QgaW5jbHVkZSBhbnkgb2YgdGhlIGRhdGE7IHdlIGp1c3Qgd2FudCB0aGUgbW9kZWwgc3RydWN0dXJlXG4gICAgfVxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgcmVzdWx0LmNsYXNzZXMpIHtcbiAgICAgIGNsYXNzT2JqLmNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXTtcbiAgICAgIGNsYXNzT2JqLnRhYmxlSWQgPSB0YWJsZUxvb2t1cFtjbGFzc09iai50YWJsZUlkXTtcbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai5zb3VyY2VUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcyA9IGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldENsYXNzSWQgPSBjbGFzc0xvb2t1cFtjbGFzc09iai50YXJnZXRDbGFzc0lkXTtcbiAgICAgIH1cbiAgICAgIGlmIChjbGFzc09iai50YXJnZXRUYWJsZUlkcykge1xuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcyA9IGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHRhYmxlTG9va3VwW3RhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgY2xhc3NJZCBvZiBPYmplY3Qua2V5cyhjbGFzc09iai5lZGdlQ2xhc3NJZHMgfHwge30pKSB7XG4gICAgICAgIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0xvb2t1cFtjbGFzc0lkXV0gPSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICAgIGRlbGV0ZSBjbGFzc09iai5lZGdlQ2xhc3NJZHNbY2xhc3NJZF07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRNb2RlbER1bXAoKTtcblxuICAgIGdyYXBoLnRhYmxlcy5mb3JFYWNoKHRhYmxlID0+IHtcbiAgICAgIHRhYmxlLmRlcml2ZWRUYWJsZXMgPSBPYmplY3Qua2V5cyh0YWJsZS5kZXJpdmVkVGFibGVzKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5fb3JpZ3JhcGguY3JlYXRlTW9kZWwoeyBuYW1lOiB0aGlzLm5hbWUgKyAnX3NjaGVtYScgfSk7XG4gICAgY29uc3QgcmF3ID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGgsXG4gICAgICBuYW1lOiAnUmF3IER1bXAnXG4gICAgfSk7XG4gICAgbGV0IFsgY2xhc3NlcywgdGFibGVzIF0gPSByYXcuY2xvc2VkVHJhbnNwb3NlKFsnY2xhc3NlcycsICd0YWJsZXMnXSk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgIGNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdDbGFzc2VzJyk7XG4gICAgcmF3LmRlbGV0ZSgpO1xuXG4gICAgY29uc3Qgc291cmNlQ2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAnc291cmNlQ2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHNvdXJjZUNsYXNzZXMuc2V0Q2xhc3NOYW1lKCdTb3VyY2UgQ2xhc3MnKTtcbiAgICBzb3VyY2VDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuICAgIGNvbnN0IHRhcmdldENsYXNzZXMgPSBjbGFzc2VzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogY2xhc3NlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhcmdldENsYXNzSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YXJnZXRDbGFzc2VzLnNldENsYXNzTmFtZSgnVGFyZ2V0IENsYXNzJyk7XG4gICAgdGFyZ2V0Q2xhc3Nlcy50b2dnbGVEaXJlY3Rpb24oKTtcblxuICAgIHRhYmxlcyA9IHRhYmxlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgdGFibGVzLnNldENsYXNzTmFtZSgnVGFibGVzJyk7XG5cbiAgICBjb25zdCB0YWJsZURlcGVuZGVuY2llcyA9IHRhYmxlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ2Rlcml2ZWRUYWJsZXMnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICB0YWJsZURlcGVuZGVuY2llcy5zZXRDbGFzc05hbWUoJ0lzIFBhcmVudCBPZicpO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgY29uc3QgY29yZVRhYmxlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgY29yZVRhYmxlcy5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGUnKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IE5ldHdvcmtNb2RlbDtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IE5ldHdvcmtNb2RlbCBmcm9tICcuL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMnO1xuXG5sZXQgTkVYVF9NT0RFTF9JRCA9IDE7XG5cbmNsYXNzIE9yaWdyYXBoIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihjbGFzcyB7fSkge1xuICBjb25zdHJ1Y3RvciAobG9jYWxTdG9yYWdlKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gb25seSBkZWZpbmVkIGluIHRoZSBicm93c2VyIGNvbnRleHRcblxuICAgIHRoaXMucGx1Z2lucyA9IHt9O1xuXG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICBsZXQgZXhpc3RpbmdNb2RlbHMgPSB0aGlzLmxvY2FsU3RvcmFnZSAmJiB0aGlzLmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnKTtcbiAgICBpZiAoZXhpc3RpbmdNb2RlbHMpIHtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyhKU09OLnBhcnNlKGV4aXN0aW5nTW9kZWxzKSkpIHtcbiAgICAgICAgbW9kZWwub3JpZ3JhcGggPSB0aGlzO1xuICAgICAgICB0aGlzLm1vZGVsc1ttb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwobW9kZWwpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgfVxuICByZWdpc3RlclBsdWdpbiAobmFtZSwgcGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW5zW25hbWVdID0gcGx1Z2luO1xuICB9XG4gIHNhdmUgKCkge1xuICAgIC8qXG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgICAqL1xuICB9XG4gIGNsb3NlQ3VycmVudE1vZGVsICgpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBnZXQgY3VycmVudE1vZGVsICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbdGhpcy5fY3VycmVudE1vZGVsSWRdIHx8IG51bGw7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsID8gbW9kZWwubW9kZWxJZCA6IG51bGw7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBhc3luYyBsb2FkTW9kZWwgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuY3JlYXRlTW9kZWwoeyBtb2RlbElkOiBvcHRpb25zLm5hbWUgfSk7XG4gICAgYXdhaXQgbmV3TW9kZWwuYWRkVGV4dEZpbGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG4gIGNyZWF0ZU1vZGVsIChvcHRpb25zID0ge30pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMubW9kZWxJZCB8fCB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdKSB7XG4gICAgICBvcHRpb25zLm1vZGVsSWQgPSBgbW9kZWwke05FWFRfTU9ERUxfSUR9YDtcbiAgICAgIE5FWFRfTU9ERUxfSUQgKz0gMTtcbiAgICB9XG4gICAgb3B0aW9ucy5vcmlncmFwaCA9IHRoaXM7XG4gICAgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSA9IG5ldyBOZXR3b3JrTW9kZWwob3B0aW9ucyk7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBvcHRpb25zLm1vZGVsSWQ7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXTtcbiAgfVxuICBkZWxldGVNb2RlbCAobW9kZWxJZCA9IHRoaXMuY3VycmVudE1vZGVsSWQpIHtcbiAgICBpZiAoIXRoaXMubW9kZWxzW21vZGVsSWRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBub24tZXhpc3RlbnQgbW9kZWw6ICR7bW9kZWxJZH1gKTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWxzW21vZGVsSWRdO1xuICAgIGlmICh0aGlzLl9jdXJyZW50TW9kZWxJZCA9PT0gbW9kZWxJZCkge1xuICAgICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgICB9XG4gICAgdGhpcy5zYXZlKCk7XG4gIH1cbiAgZGVsZXRlQWxsTW9kZWxzICgpIHtcbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9yaWdyYXBoO1xuIiwiaW1wb3J0IE9yaWdyYXBoIGZyb20gJy4vT3JpZ3JhcGguanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuXG5sZXQgb3JpZ3JhcGggPSBuZXcgT3JpZ3JhcGgod2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJkdXBsaWNhdGVJdGVtcyIsInJlZ2lzdGVyRHVwbGljYXRlIiwiaXRlbSIsImNvbm5lY3RJdGVtIiwidGFibGVJZCIsImR1cCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXhwb3J0SWQiLCJsYWJlbCIsImFubm90YXRpb25zIiwibGFiZWxBdHRyIiwiZXF1YWxzIiwiaGFuZGxlTGltaXQiLCJpdGVyYXRvcnMiLCJsaW1pdCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsIlByb21pc2UiLCJhbGwiLCJtYXAiLCJtb2RlbCIsInRhYmxlcyIsImJ1aWxkQ2FjaGUiLCJfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwicmVzZXQiLCJuZXh0VGFibGVJZCIsImxlbmd0aCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX2xpbWl0UHJvbWlzZXMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsImdldFNvcnRIYXNoIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIml0ZXJhdGUiLCJfY2FjaGUiLCJfcGFydGlhbENhY2hlIiwicmVzb2x2ZSIsInJlamVjdCIsIl9pdGVyYXRlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlTG9va3VwIiwiZG9uZSIsIm5leHQiLCJoYW5kbGVSZXNldCIsIl9maW5pc2hJdGVtIiwiTnVtYmVyIiwiX2NhY2hlTG9va3VwIiwiX2NhY2hlUHJvbWlzZSIsIml0ZW1zVG9SZXNldCIsImNvbmNhdCIsImRlcml2ZWRUYWJsZSIsImNvdW50Um93cyIsIndyYXBwZWRJdGVtIiwiZGVsYXllZFJvdyIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwibG9va3VwIiwiY29tcGxldGUiLCJfZ2V0SXRlbSIsImdldEl0ZW0iLCJnZXRSYW5kb21JdGVtIiwicmFuZEluZGV4IiwiTWF0aCIsImZsb29yIiwicmFuZG9tIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwidW5TdXBwcmVzc2VkQXR0cmlidXRlcyIsImZpbHRlciIsInN1cHByZXNzQXR0cmlidXRlIiwidW5TdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsInByb21vdGUiLCJleHBhbmQiLCJ1bnJvbGwiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiZHVwbGljYXRlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsInByb2plY3QiLCJ0YWJsZU9yZGVyIiwib3RoZXJUYWJsZUlkIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJmb3JjZSIsImVyciIsInBhcmVudFRhYmxlIiwiU3RhdGljVGFibGUiLCJfbmFtZSIsIl9kYXRhIiwib2JqIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQXR0clRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkF0dHJUYWJsZU1peGluIiwiX2F0dHJpYnV0ZSIsIlByb21vdGVkVGFibGUiLCJfdW5maW5pc2hlZENhY2hlIiwiX3VuZmluaXNoZWRDYWNoZUxvb2t1cCIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicFRhYmxlIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJEdXBsaWNhdGVkVGFibGUiLCJDaGlsZFRhYmxlTWl4aW4iLCJfaW5zdGFuY2VPZkNoaWxkVGFibGVNaXhpbiIsInBhcmVudEluZGV4IiwiRXhwYW5kZWRUYWJsZSIsIlVucm9sbGVkVGFibGUiLCJyb3dzIiwiUGFyZW50Q2hpbGRUYWJsZSIsImNoaWxkVGFibGUiLCJjaGlsZCIsInBhcmVudCIsIlByb2plY3RlZFRhYmxlIiwic2VsZiIsImZpcnN0VGFibGUiLCJyZW1haW5pbmdJZHMiLCJzb3VyY2VJdGVtIiwibGFzdEl0ZW0iLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwic2V0Q2xhc3NOYW1lIiwic2V0QW5ub3RhdGlvbiIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJoYXNDdXN0b21OYW1lIiwidmFyaWFibGVOYW1lIiwiZCIsInRvTG9jYWxlVXBwZXJDYXNlIiwiZGVsZXRlZCIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJhZ2dyZWdhdGUiLCJkaXNzb2x2ZSIsImNhbkRpc3NvbHZlIiwib3B0aW1pemVUYWJsZXMiLCJjb3VudEFsbFVuaXF1ZVZhbHVlcyIsImhhc2hhYmxlQmlucyIsInVuSGFzaGFibGVDb3VudHMiLCJpbmRleEJpbiIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiY2xhc3NJZHMiLCJlZGdlQ2xhc3NJZHMiLCJlZGdlSWQiLCJlZGdlQ2xhc3MiLCJyb2xlIiwiZ2V0RWRnZVJvbGUiLCJyZXZlcnNlIiwibmVpZ2hib3JOb2RlcyIsImVkZ2UiLCJ0YXJnZXROb2RlcyIsInRhcmdldCIsInNvdXJjZU5vZGVzIiwic291cmNlIiwibmVpZ2hib3JzIiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NlcyIsImVkZ2VDbGFzc0lkIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJub2RlQ2xhc3MiLCJ0YWJsZUlkTGlzdCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJuZXdOb2RlQ2xhc3MiLCJuZXdDbGFzcyIsInBvcCIsImNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzIiwiY2hpbGRDbGFzcyIsInByb2plY3ROZXdFZGdlIiwiY2xhc3NJZExpc3QiLCJjbGFzc0xpc3QiLCJlZGdlUm9sZSIsIkFycmF5IiwiZnJvbSIsImNvbm5lY3RlZENsYXNzZXMiLCJFZGdlV3JhcHBlciIsInNvdXJjZVRhYmxlSWQiLCJ0YXJnZXRUYWJsZUlkIiwibm9kZXMiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiYWJzIiwic29ydCIsImEiLCJiIiwic2lkZSIsImNvbm5lY3RTb3VyY2UiLCJjb25uZWN0VGFyZ2V0IiwidG9nZ2xlRGlyZWN0aW9uIiwic3dhcHBlZERpcmVjdGlvbiIsIm5vZGVBdHRyaWJ1dGUiLCJlZGdlQXR0cmlidXRlIiwiZWRnZUhhc2giLCJub2RlSGFzaCIsInVuc2hpZnQiLCJleGlzdGluZ1NvdXJjZUNsYXNzIiwiZXhpc3RpbmdUYXJnZXRDbGFzcyIsInNoaWZ0IiwiY29ubmVjdEZhY2V0ZWRDbGFzcyIsIm5ld0NsYXNzZXMiLCJGaWxlRm9ybWF0IiwiYnVpbGRSb3ciLCJQYXJzZUZhaWx1cmUiLCJmaWxlRm9ybWF0IiwiTk9ERV9OQU1FUyIsIkVER0VfTkFNRVMiLCJEM0pzb24iLCJpbXBvcnREYXRhIiwidGV4dCIsInNvdXJjZUF0dHJpYnV0ZSIsInRhcmdldEF0dHJpYnV0ZSIsImNsYXNzQXR0cmlidXRlIiwiSlNPTiIsInBhcnNlIiwibm9kZU5hbWUiLCJlZGdlTmFtZSIsImNvcmVUYWJsZSIsImNvcmVDbGFzcyIsIm5vZGVDbGFzc2VzIiwibm9kZUNsYXNzTG9va3VwIiwic2FtcGxlIiwic291cmNlQ2xhc3NOYW1lIiwidGFyZ2V0Q2xhc3NOYW1lIiwiZm9ybWF0RGF0YSIsImluY2x1ZGVDbGFzc2VzIiwicHJldHR5IiwibGlua3MiLCJub2RlTG9va3VwIiwib3RoZXIiLCJub2RlIiwic3RyaW5naWZ5IiwiQnVmZmVyIiwiZXh0ZW5zaW9uIiwiQ3N2WmlwIiwiaW5kZXhOYW1lIiwiemlwIiwiSlNaaXAiLCJjb250ZW50cyIsImZpbGUiLCJnZW5lcmF0ZUFzeW5jIiwiZXNjYXBlQ2hhcnMiLCJHRVhGIiwiZXNjYXBlIiwic3RyIiwicmVwbCIsImV4cCIsIm5vZGVDaHVuayIsImVkZ2VDaHVuayIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImRlbGV0ZU1vZGVsIiwibW9kZWxzIiwiYWRkVGV4dEZpbGUiLCJmb3JtYXQiLCJtaW1lIiwiRklMRV9GT1JNQVRTIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJ0YWJsZXNJblVzZSIsInBhcmVudHNWaXNpdGVkIiwicXVldWUiLCJnZXRJbnN0YW5jZVNhbXBsZSIsInNlZWRMaW1pdCIsImNsdXN0ZXJMaW1pdCIsImNsYXNzQ291bnQiLCJpdGVyYXRpb25SZXNldCIsImluc3RhbmNlcyIsInRvdGFsQ291bnQiLCJjbGFzc0NvdW50cyIsInBvcHVsYXRlQ2xhc3NDb3VudHMiLCJpbnN0YW5jZSIsIm5laWdoYm9yIiwicm93Q291bnQiLCJ2YWxpZGF0ZUluc3RhbmNlU2FtcGxlIiwidXBkYXRlSW5zdGFuY2VTYW1wbGUiLCJuZXdJbnN0YW5jZSIsInBhcnRpdGlvbkluc3RhbmNlU2FtcGxlIiwiZ2VuZXJpY3MiLCJmaWxsSW5zdGFuY2VTYW1wbGUiLCJleHRyYU5vZGVzIiwiZXh0cmFFZGdlcyIsInNlZWRTaWRlIiwiaXRlckZ1bmMiLCJhTm9kZSIsImlzU2VlZGVkIiwiY29ubmVjdHNTb3VyY2UiLCJjb25uZWN0c1RhcmdldCIsImluc3RhbmNlU2FtcGxlVG9HcmFwaCIsImdyYXBoIiwibm9kZUluc3RhbmNlIiwiZHVtbXkiLCJlZGdlSW5zdGFuY2UiLCJzb3VyY2VOb2RlIiwidGFyZ2V0Tm9kZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRNb2RlbER1bXAiLCJyYXdPYmoiLCJhSGFzaCIsImJIYXNoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwic291cmNlQ2xhc3NlcyIsInRhcmdldENsYXNzZXMiLCJ0YWJsZURlcGVuZGVuY2llcyIsImNvcmVUYWJsZXMiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwibG9hZE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7V0FDS0MsZUFBTCxHQUF1QixFQUF2Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ25CLENBQUNDLEtBQUQsRUFBUUMsU0FB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
