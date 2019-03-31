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
    return this.model.createClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }

  interpretAsGeneric() {
    const options = this._toRawObject();

    options.type = 'GenericClass';
    options.overwrite = true;
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

  get canAutoConnect() {
    const allRoles = Object.keys(this.edgeClassIds).map(id => this.getEdgeRole(this.model.classes[id]));
    return allRoles.length > 0 && allRoles.length <= 2 && allRoles.indexOf('both') === -1;
  }

  interpretAsEdges({
    autoconnect = false
  } = {}) {
    const edgeClassIds = Object.keys(this.edgeClassIds);
    const roles = edgeClassIds.map(id => this.getEdgeRole(this.model.classes[id]));

    const options = super._toRawObject();

    if (!autoconnect || edgeClassIds.length > 2 || roles.indexOf('both') !== -1) {
      // If there are more than two connections, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (autoconnect && edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]]; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (roles[0] === 'source') {
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

      if (roles[0] === 'target') {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList;
    } else if (autoconnect && edgeClassIds.length === 2) {
      // Okay, we've got two edges, so this is a little more straightforward
      let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
      let mySourceRole = roles[0];
      let targetEdgeClass = this.model.classes[edgeClassIds[1]];
      let myTargetRole = roles[1];

      if (mySourceRole === 'source' && myTargetRole === 'target') {
        // Swap if the source points away and the target points at me
        sourceEdgeClass = this.model.classes[edgeClassIds[1]];
        mySourceRole = roles[1];
        targetEdgeClass = this.model.classes[edgeClassIds[0]];
        myTargetRole = roles[0];
      } // Figure out the direction, if there is one


      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        // Only stay directed if both edges are pointing in the same direction
        // (if both are pointing at, or away from this node class, then the
        // resulting edge shouldn't be directed)
        options.directed = mySourceRole !== myTargetRole;
      } else if (sourceEdgeClass.directed) {
        // Only the source edge is directed; keep the direction, and swap
        // classes if it's actually pointing inward (then we'd want it to
        // be on the target side)
        options.directed = true;

        if (mySourceRole === 'target') {
          let temp = sourceEdgeClass;
          sourceEdgeClass = targetEdgeClass;
          targetEdgeClass = temp;
          temp = mySourceRole;
          mySourceRole = myTargetRole;
          myTargetRole = temp;
        }
      } else if (targetEdgeClass.directed) {
        // Only the target edge is directed; keep the direction, and swap
        // classes if it's actually pointing inward (then we'd want it to
        // be on the source side)
        options.directed = true;

        if (myTargetRole === 'target') {
          let temp = sourceEdgeClass;
          sourceEdgeClass = targetEdgeClass;
          targetEdgeClass = temp;
          temp = mySourceRole;
          mySourceRole = myTargetRole;
          myTargetRole = temp;
        }
      } // Okay, set source / target ids


      options.sourceClassId = mySourceRole === 'target' ? sourceEdgeClass.sourceClassId : sourceEdgeClass.targetClassId;
      options.targetClassId = myTargetRole === 'source' ? targetEdgeClass.targetClassId : targetEdgeClass.sourceClassId; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = (sourceEdgeClass.targetTableIds || []).slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds || []);

      if (mySourceRole === 'source') {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = (targetEdgeClass.sourceTableIds || []).slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.targetTableIds || []);

      if (myTargetRole === 'target') {
        options.targetTableIds.reverse();
      } // Disconnect the existing edge classes from the new (now edge) class


      this.disconnectAllEdges(); // Connect this class to the node classes on the other end of source /
      // target (if they're connected)

      if (this.model.classes[options.sourceClassId]) {
        this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
      }

      if (this.model.classes[options.targetClassId]) {
        this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true;
      }
    }

    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }

  interpretAsGeneric() {
    this.disconnectAllEdges();
    return super.interpretAsGeneric();
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

  createSupernodes(attribute) {
    const existingEdgeClassIds = Object.keys(this.edgeClassIds);
    const newNodeClass = super.promote(attribute);
    const newEdgeClass = this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });

    for (const edgeClassId of existingEdgeClassIds) {
      const edgeClass = this.model.classes[edgeClassId];
      const role = this.getEdgeRole(edgeClass);

      if (role === 'both') {
        newNodeClass.projectNewEdge([newEdgeClass.classId, this.classId, edgeClass.classId, this.classId, newEdgeClass.classId, newNodeClass.classId]).setClassName(edgeClass.className);
      } else {
        newNodeClass.projectNewEdge([newEdgeClass.classId, this.classId, edgeClass.classId, role === 'source' ? edgeClass.targetClassId : edgeClass.sourceClassId]).setClassName(edgeClass.className);
      }
    }

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

  *connectedClasses() {
    if (this.sourceClassId) {
      yield this.model.classes[this.sourceClassId];
    }

    if (this.targetClassId) {
      yield this.model.classes[this.targetClassId];
    }
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

    this.model.trigger('update');
    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  interpretAsGeneric() {
    this.disconnectSource();
    this.disconnectTarget();
    return super.interpretAsGeneric();
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

  rollup(attribute) {
    const newTable = this.table.promote(attribute);
    const sourceTableIds = this.sourceClassId ? [this.tableId].concat(this.sourceTableIds) : [];
    const targetTableIds = this.targetClassId ? [this.tableId].concat(this.targetTableIds) : [];
    const newClass = this.model.createClass({
      tableId: newTable.tableId,
      type: 'EdgeClass',
      directed: this.directed,
      sourceClassId: this.sourceClassId,
      sourceTableIds,
      targetClassId: this.targetClassId,
      targetTableIds
    });

    if (this.sourceClassId) {
      this.sourceClass.edgeClassIds[newClass.classId] = true;
    }

    if (this.targetClassId) {
      this.targetClass.edgeClassIds[newClass.classId] = true;
    }

    this.model.trigger('update');
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
    classAttribute = null,
    rawText = false
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

    if (!rawText) {
      result = 'data:text/json;base64,' + Buffer.from(result).toString('base64');
    }

    return {
      data: result,
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
    classAttribute = 'class',
    rawText = false
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

    let result = `\
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
</gexf>`;

    if (!rawText) {
      result = 'data:text/xml;base64,' + Buffer.from(result).toString('base64');
    }

    return {
      data: result,
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

    if (options.overwrite) {
      this.tables[options.tableId].reset();
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
      const rowCount = await classObj.table.countRows(); // Don't sample from GenericClasses

      if (classObj.type === 'Generic') {
        continue;
      } // Get at least classCount instances from this class (as long as we
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
var version = "0.2.8";
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0F0dHJUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9tb3RlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GYWNldGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RyYW5zcG9zZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ29ubmVjdGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0R1cGxpY2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvQ2hpbGRUYWJsZU1peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9VbnJvbGxlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9QYXJlbnRDaGlsZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Qcm9qZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0LmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL1BhcnNlRmFpbHVyZS5qcyIsIi4uL3NyYy9GaWxlRm9ybWF0cy9EM0pzb24uanMiLCIuLi9zcmMvRmlsZUZvcm1hdHMvQ3N2WmlwLmpzIiwiLi4vc3JjL0ZpbGVGb3JtYXRzL0dFWEYuanMiLCIuLi9zcmMvQ29tbW9uL05ldHdvcmtNb2RlbC5qcyIsIi4uL3NyYy9PcmlncmFwaC5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzID0ge307XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2VycyA9IHt9O1xuICAgIH1cbiAgICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSB8fFxuICAgICAgICB7ICcnOiBbXSB9O1xuICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnB1c2goY2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSA9IGNhbGxiYWNrO1xuICAgICAgfVxuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXSA9IFtdO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uaW5kZXhPZihjYWxsYmFjayk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdHJpZ2dlciAoZXZlbnQsIC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IGhhbmRsZUNhbGxiYWNrID0gY2FsbGJhY2sgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH07XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgZm9yIChjb25zdCBuYW1lc3BhY2Ugb2YgT2JqZWN0LmtleXModGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pKSB7XG4gICAgICAgICAgaWYgKG5hbWVzcGFjZSA9PT0gJycpIHtcbiAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5mb3JFYWNoKGhhbmRsZUNhbGxiYWNrKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlQ2FsbGJhY2sodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHN0aWNreVRyaWdnZXIgKGV2ZW50TmFtZSwgYXJnT2JqLCBkZWxheSA9IDEwKSB7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSB8fCB7IGFyZ09iajoge30gfTtcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmosIGFyZ09iaik7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGxldCBhcmdPYmogPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iajtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgdGhpcy50YWJsZSA9IG9wdGlvbnMudGFibGU7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCB8fCAhdGhpcy50YWJsZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBhbmQgdGFibGUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICAgIHRoaXMuY2xhc3NPYmogPSBvcHRpb25zLmNsYXNzT2JqIHx8IG51bGw7XG4gICAgdGhpcy5yb3cgPSBvcHRpb25zLnJvdyB8fCB7fTtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0gb3B0aW9ucy5jb25uZWN0ZWRJdGVtcyB8fCB7fTtcbiAgICB0aGlzLmR1cGxpY2F0ZUl0ZW1zID0gb3B0aW9ucy5kdXBsaWNhdGVJdGVtcyB8fCBbXTtcbiAgfVxuICByZWdpc3RlckR1cGxpY2F0ZSAoaXRlbSkge1xuICAgIHRoaXMuZHVwbGljYXRlSXRlbXMucHVzaChpdGVtKTtcbiAgfVxuICBjb25uZWN0SXRlbSAoaXRlbSkge1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSA9IHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXSB8fCBbXTtcbiAgICBpZiAodGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLmluZGV4T2YoaXRlbSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0ucHVzaChpdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBkdXAgb2YgdGhpcy5kdXBsaWNhdGVJdGVtcykge1xuICAgICAgaXRlbS5jb25uZWN0SXRlbShkdXApO1xuICAgICAgZHVwLmNvbm5lY3RJdGVtKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBge1wiY2xhc3NJZFwiOlwiJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XCIsXCJpbmRleFwiOlwiJHt0aGlzLmluZGV4fVwifWA7XG4gIH1cbiAgZ2V0IGV4cG9ydElkICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jbGFzc09iai5jbGFzc0lkfV8ke3RoaXMuaW5kZXh9YDtcbiAgfVxuICBnZXQgbGFiZWwgKCkge1xuICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLmFubm90YXRpb25zLmxhYmVsQXR0ciA/IHRoaXMucm93W3RoaXMuY2xhc3NPYmouYW5ub3RhdGlvbnMubGFiZWxBdHRyXSA6IHRoaXMuaW5kZXg7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaGFuZGxlTGltaXQgKG9wdGlvbnMsIGl0ZXJhdG9ycykge1xuICAgIGxldCBsaW1pdCA9IEluZmluaXR5O1xuICAgIGlmIChvcHRpb25zLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIH1cbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVyYXRvciBvZiBpdGVyYXRvcnMpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiBpdGVyYXRvcikge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpdGVtID09PSBudWxsIHx8IGkgPj0gbGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIHlpZWxkICogdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKTtcbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRoaXMucmVzZXQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbmV4dFRhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW25leHRUYWJsZUlkXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1tuZXh0VGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9saW1pdFByb21pc2VzID0ge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIHJldHVybiBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaGFzIGFscmVhZHkgYmVlbiBidWlsdDsganVzdCBncmFiIGRhdGEgZnJvbSBpdCBkaXJlY3RseVxuICAgICAgeWllbGQgKiB0aGlzLl9jYWNoZS5zbGljZSgwLCBsaW1pdCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGUgJiYgdGhpcy5fcGFydGlhbENhY2hlLmxlbmd0aCA+PSBsaW1pdCkge1xuICAgICAgLy8gVGhlIGNhY2hlIGlzbid0IGZpbmlzaGVkLCBidXQgaXQncyBhbHJlYWR5IGxvbmcgZW5vdWdoIHRvIHNhdGlzZnkgdGhpc1xuICAgICAgLy8gcmVxdWVzdFxuICAgICAgeWllbGQgKiB0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGUgY2FjaGUgaXNuJ3QgZmluaXNoZWQgYnVpbGRpbmcgKGFuZCBtYXliZSBkaWRuJ3QgZXZlbiBzdGFydCB5ZXQpO1xuICAgICAgLy8ga2ljayBpdCBvZmYsIGFuZCB0aGVuIHdhaXQgZm9yIGVub3VnaCBpdGVtcyB0byBiZSBwcm9jZXNzZWQgdG8gc2F0aXNmeVxuICAgICAgLy8gdGhlIGxpbWl0XG4gICAgICB0aGlzLmJ1aWxkQ2FjaGUoKTtcbiAgICAgIHlpZWxkICogYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSA9IHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdIHx8IFtdO1xuICAgICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5wdXNoKHsgcmVzb2x2ZSwgcmVqZWN0IH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBfYnVpbGRDYWNoZSAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGxldCB0ZW1wID0geyBkb25lOiBmYWxzZSB9O1xuICAgIHdoaWxlICghdGVtcC5kb25lKSB7XG4gICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwgdGVtcCA9PT0gbnVsbCkge1xuICAgICAgICAvLyByZXNldCgpIHdhcyBjYWxsZWQgYmVmb3JlIHdlIGNvdWxkIGZpbmlzaDsgd2UgbmVlZCB0byBsZXQgZXZlcnlvbmVcbiAgICAgICAgLy8gdGhhdCB3YXMgd2FpdGluZyBvbiB1cyBrbm93IHRoYXQgd2UgY2FuJ3QgY29tcGx5XG4gICAgICAgIHRoaXMuaGFuZGxlUmVzZXQocmVqZWN0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCF0ZW1wLmRvbmUpIHtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSkpIHtcbiAgICAgICAgICAvLyBPa2F5LCB0aGlzIGl0ZW0gcGFzc2VkIGFsbCBmaWx0ZXJzLCBhbmQgaXMgcmVhZHkgdG8gYmUgc2VudCBvdXRcbiAgICAgICAgICAvLyBpbnRvIHRoZSB3b3JsZFxuICAgICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt0ZW1wLnZhbHVlLmluZGV4XSA9IHRoaXMuX3BhcnRpYWxDYWNoZS5sZW5ndGg7XG4gICAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlLnB1c2godGVtcC52YWx1ZSk7XG4gICAgICAgICAgaSsrO1xuICAgICAgICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiB3ZSBoYXZlIGVub3VnaCBkYXRhIG5vdyB0byBzYXRpc2Z5IGFueSB3YWl0aW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAobGltaXQgPD0gaSkge1xuICAgICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLl9wYXJ0aWFsQ2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB0aGlzLl9jYWNoZUxvb2t1cCA9IHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGZvciAobGV0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUuc2xpY2UoMCwgbGltaXQpKTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NhY2hlQnVpbHQnKTtcbiAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgfVxuICBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgLy8gVGhlIHNldFRpbWVvdXQgaGVyZSBpcyBhYnNvbHV0ZWx5IG5lY2Vzc2FyeSwgb3IgdGhpcy5fY2FjaGVQcm9taXNlXG4gICAgICAgIC8vIHdvbid0IGJlIHN0b3JlZCBpbiB0aW1lIGZvciB0aGUgbmV4dCBidWlsZENhY2hlKCkgY2FsbCB0aGF0IGNvbWVzXG4gICAgICAgIC8vIHRocm91Z2hcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdGhpcy5fYnVpbGRDYWNoZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9LCAwKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBjb25zdCBpdGVtc1RvUmVzZXQgPSAodGhpcy5fY2FjaGUgfHwgW10pXG4gICAgICAuY29uY2F0KHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSk7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zVG9SZXNldCkge1xuICAgICAgaXRlbS5yZXNldCA9IHRydWU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGhhbmRsZVJlc2V0IChyZWplY3QpIHtcbiAgICBmb3IgKGNvbnN0IGxpbWl0IG9mIE9iamVjdC5rZXlzKHRoaXMuX2xpbWl0UHJvbWlzZXMpKSB7XG4gICAgICB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XS5yZWplY3QoKTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9saW1pdFByb21pc2VzO1xuICAgIH1cbiAgICByZWplY3QoKTtcbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5idWlsZENhY2hlKCkpLmxlbmd0aDtcbiAgfVxuICBhc3luYyBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgICBpZiAod3JhcHBlZEl0ZW0ucm93W2F0dHJdIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3cgPSB3cmFwcGVkSXRlbS5kZWxheWVkUm93IHx8IHt9O1xuICAgICAgICAgIHdyYXBwZWRJdGVtLmRlbGF5ZWRSb3dbYXR0cl0gPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZnVuYyBvZiBPYmplY3QudmFsdWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBhd2FpdCBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICAvLyBBbGxvdyBwcm9iaW5nIHRvIHNlZSB3aGF0ZXZlciBkYXRhIGhhcHBlbnMgdG8gYmUgYXZhaWxhYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCBbXSxcbiAgICAgIGxvb2t1cDogdGhpcy5fY2FjaGVMb29rdXAgfHwgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGFzeW5jIF9nZXRJdGVtIChpbmRleCA9IG51bGwpIHtcbiAgICAvLyBTdHVwaWQgYXBwcm9hY2ggd2hlbiB0aGUgY2FjaGUgaXNuJ3QgYnVpbHQ6IGludGVyYXRlIHVudGlsIHdlIHNlZSB0aGVcbiAgICAvLyBpbmRleC4gU3ViY2xhc3NlcyBjb3VsZCBvdmVycmlkZSB0aGlzXG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuaXRlcmF0ZSgpKSB7XG4gICAgICBpZiAoaXRlbSA9PT0gbnVsbCB8fCBpdGVtLmluZGV4ID09PSBpbmRleCkge1xuICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYXN5bmMgZ2V0SXRlbSAoaW5kZXggPSBudWxsKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlTG9va3VwKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9jYWNoZVswXSA6IHRoaXMuX2NhY2hlW3RoaXMuX2NhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXAgJiZcbiAgICAgICAgKChpbmRleCA9PT0gbnVsbCAmJiB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoID4gMCkgfHxcbiAgICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICByZXR1cm4gaW5kZXggPT09IG51bGwgPyB0aGlzLl9wYXJ0aWFsQ2FjaGVbMF1cbiAgICAgICAgOiB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGhpcy5fcGFydGlhbENhY2hlTG9va3VwW2luZGV4XV07XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9nZXRJdGVtKGluZGV4KTtcbiAgfVxuICBhc3luYyBnZXRSYW5kb21JdGVtICgpIHtcbiAgICBjb25zdCByYW5kSW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhd2FpdCB0aGlzLmNvdW50Um93cygpKTtcbiAgICByZXR1cm4gdGhpcy5fY2FjaGVbcmFuZEluZGV4XTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IHN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpO1xuICB9XG4gIGdldCB1blN1cHByZXNzZWRBdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gdGhpcy5hdHRyaWJ1dGVzLmZpbHRlcihhdHRyID0+ICF0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyXSk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgdW5TdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYWRkRmlsdGVyIChmdW5jLCBhdHRyaWJ1dGUgPSBudWxsKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdQcm9tb3RlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnVW5yb2xsZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKGxpbWl0KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGR1cGxpY2F0ZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdEdXBsaWNhdGVkVGFibGUnXG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QsIHR5cGUgPSAnQ29ubmVjdGVkVGFibGUnKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHsgdHlwZSB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBwcm9qZWN0ICh0YWJsZUlkcykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZSh7XG4gICAgICB0eXBlOiAnUHJvamVjdGVkVGFibGUnLFxuICAgICAgdGFibGVPcmRlcjogW3RoaXMudGFibGVJZF0uY29uY2F0KHRhYmxlSWRzKVxuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZUlkIG9mIHRhYmxlSWRzKSB7XG4gICAgICBjb25zdCBvdGhlclRhYmxlID0gdGhpcy5tb2RlbC50YWJsZXNbb3RoZXJUYWJsZUlkXTtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKGZvcmNlID0gZmFsc2UpIHtcbiAgICBpZiAoIWZvcmNlICYmIHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMuX25hbWU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5fbmFtZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY29uc3QgQXR0clRhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihzdXBlcmNsYXNzKSB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkF0dHJUYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGdldFNvcnRIYXNoICgpIHtcbiAgICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgICBnZXQgbmFtZSAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXR0clRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZBdHRyVGFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBBdHRyVGFibGVNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBBdHRyVGFibGVNaXhpbiBmcm9tICcuL0F0dHJUYWJsZU1peGluLmpzJztcblxuY2xhc3MgUHJvbW90ZWRUYWJsZSBleHRlbmRzIEF0dHJUYWJsZU1peGluKFRhYmxlKSB7XG4gIGFzeW5jIF9idWlsZENhY2hlIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHdlIGRvbid0IGFjdHVhbGx5IHdhbnQgdG8gY2FsbCBfZmluaXNoSXRlbVxuICAgIC8vIHVudGlsIGFsbCB1bmlxdWUgdmFsdWVzIGhhdmUgYmVlbiBzZWVuXG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlID0gW107XG4gICAgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwID0ge307XG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0gW107XG4gICAgdGhpcy5fcGFydGlhbENhY2hlTG9va3VwID0ge307XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKCk7XG4gICAgbGV0IHRlbXAgPSB7IGRvbmU6IGZhbHNlIH07XG4gICAgd2hpbGUgKCF0ZW1wLmRvbmUpIHtcbiAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSB8fCB0ZW1wID09PSBudWxsKSB7XG4gICAgICAgIC8vIHJlc2V0KCkgd2FzIGNhbGxlZCBiZWZvcmUgd2UgY291bGQgZmluaXNoOyB3ZSBuZWVkIHRvIGxldCBldmVyeW9uZVxuICAgICAgICAvLyB0aGF0IHdhcyB3YWl0aW5nIG9uIHVzIGtub3cgdGhhdCB3ZSBjYW4ndCBjb21wbHlcbiAgICAgICAgdGhpcy5oYW5kbGVSZXNldChyZWplY3QpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIXRlbXAuZG9uZSkge1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbdGVtcC52YWx1ZS5pbmRleF0gPSB0aGlzLl91bmZpbmlzaGVkQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl91bmZpbmlzaGVkQ2FjaGUucHVzaCh0ZW1wLnZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gT2theSwgbm93IHdlJ3ZlIHNlZW4gZXZlcnl0aGluZzsgd2UgY2FuIGNhbGwgX2ZpbmlzaEl0ZW0gb24gZWFjaCBvZiB0aGVcbiAgICAvLyB1bmlxdWUgdmFsdWVzXG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5fdW5maW5pc2hlZENhY2hlKSB7XG4gICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbSh2YWx1ZSkpIHtcbiAgICAgICAgLy8gT2theSwgdGhpcyBpdGVtIHBhc3NlZCBhbGwgZmlsdGVycywgYW5kIGlzIHJlYWR5IHRvIGJlIHNlbnQgb3V0XG4gICAgICAgIC8vIGludG8gdGhlIHdvcmxkXG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cFt2YWx1ZS5pbmRleF0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGUubGVuZ3RoO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUucHVzaCh2YWx1ZSk7XG4gICAgICAgIGkrKztcbiAgICAgICAgZm9yIChsZXQgbGltaXQgb2YgT2JqZWN0LmtleXModGhpcy5fbGltaXRQcm9taXNlcykpIHtcbiAgICAgICAgICBsaW1pdCA9IE51bWJlcihsaW1pdCk7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBlbm91Z2ggZGF0YSBub3cgdG8gc2F0aXNmeSBhbnkgd2FpdGluZyByZXF1ZXN0c1xuICAgICAgICAgIGlmIChsaW1pdCA8PSBpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHsgcmVzb2x2ZSB9IG9mIHRoaXMuX2xpbWl0UHJvbWlzZXNbbGltaXRdKSB7XG4gICAgICAgICAgICAgIHJlc29sdmUodGhpcy5fcGFydGlhbENhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIERvbmUgaXRlcmF0aW5nISBXZSBjYW4gZ3JhZHVhdGUgdGhlIHBhcnRpYWwgY2FjaGUgLyBsb29rdXBzIGludG9cbiAgICAvLyBmaW5pc2hlZCBvbmVzLCBhbmQgc2F0aXNmeSBhbGwgdGhlIHJlcXVlc3RzXG4gICAgZGVsZXRlIHRoaXMuX3VuZmluaXNoZWRDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fdW5maW5pc2hlZENhY2hlTG9va3VwO1xuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgdGhpcy5fY2FjaGVMb29rdXAgPSB0aGlzLl9wYXJ0aWFsQ2FjaGVMb29rdXA7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZUxvb2t1cDtcbiAgICBmb3IgKGxldCBsaW1pdCBvZiBPYmplY3Qua2V5cyh0aGlzLl9saW1pdFByb21pc2VzKSkge1xuICAgICAgbGltaXQgPSBOdW1iZXIobGltaXQpO1xuICAgICAgZm9yIChjb25zdCB7IHJlc29sdmUgfSBvZiB0aGlzLl9saW1pdFByb21pc2VzW2xpbWl0XSkge1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlLnNsaWNlKDAsIGxpbWl0KSk7XG4gICAgICB9XG4gICAgICBkZWxldGUgdGhpcy5fbGltaXRQcm9taXNlc1tsaW1pdF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgdGhpcy50cmlnZ2VyKCdjYWNoZUJ1aWx0Jyk7XG4gICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGxldCBpbmRleCA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBEb24ndCBwcm9tb3RlIFtvYmplY3QgT2JqZWN0XSBhcyBhIHZhbHVlIChpZ25vcmUgdW5oYXNoYWJsZSB2YWx1ZXMpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgaW5kZXggPSBTdHJpbmcoaW5kZXgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldCFcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl91bmZpbmlzaGVkQ2FjaGVMb29rdXBbaW5kZXhdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fdW5maW5pc2hlZENhY2hlW3RoaXMuX3VuZmluaXNoZWRDYWNoZUxvb2t1cFtpbmRleF1dO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBQcm9tb3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGUgKyB0aGlzLl92YWx1ZTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIFN0cmluZyh0aGlzLl92YWx1ZSk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgaWYgKGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoYXdhaXQgdGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGUuZ2V0U29ydEhhc2goKSArIHRoaXMuX2luZGV4O1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlICgpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgYXdhaXQgdGhpcy5wYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5wYXJlbnRUYWJsZS5fY2FjaGVMb29rdXBbdGhpcy5faW5kZXhdXSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGxldCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgdmFsdWUgPSBhd2FpdCB2YWx1ZTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJz0nKTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuZ2V0U29ydEhhc2goKSkuam9pbignPScpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIERvbid0IHRyeSB0byBjb25uZWN0IHZhbHVlcyB1bnRpbCBhbGwgb2YgdGhlIHBhcmVudCB0YWJsZXMnIGNhY2hlcyBhcmVcbiAgICAvLyBidWlsdDsgVE9ETzogbWlnaHQgYmUgYWJsZSB0byBkbyBzb21ldGhpbmcgbW9yZSByZXNwb25zaXZlIGhlcmU/XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwocGFyZW50VGFibGVzLm1hcChwVGFibGUgPT4gcFRhYmxlLmJ1aWxkQ2FjaGUoKSkpO1xuXG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGVMb29rdXApIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZUxvb2t1cCkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldFxuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlTG9va3VwW2luZGV4XSAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVt0YWJsZS5fY2FjaGVMb29rdXBbaW5kZXhdXSlcbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBEdXBsaWNhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgLy8gWWllbGQgdGhlIHNhbWUgaXRlbXMgd2l0aCB0aGUgc2FtZSBjb25uZWN0aW9ucywgYnV0IHdyYXBwZWQgYW5kIGZpbmlzaGVkXG4gICAgLy8gYnkgdGhpcyB0YWJsZVxuICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleDogaXRlbS5pbmRleCxcbiAgICAgICAgcm93OiBpdGVtLnJvdyxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IE9iamVjdC52YWx1ZXMoaXRlbS5jb25uZWN0ZWRJdGVtcykucmVkdWNlKChhZ2csIGl0ZW1MaXN0KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGFnZy5jb25jYXQoaXRlbUxpc3QpO1xuICAgICAgICB9LCBbXSlcbiAgICAgIH0pO1xuICAgICAgaXRlbS5yZWdpc3RlckR1cGxpY2F0ZShuZXdJdGVtKTtcbiAgICAgIGlmIChhd2FpdCB0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGVkVGFibGU7XG4iLCJpbXBvcnQgQXR0clRhYmxlTWl4aW4gZnJvbSAnLi9BdHRyVGFibGVNaXhpbi5qcyc7XG5cbmNvbnN0IENoaWxkVGFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIEF0dHJUYWJsZU1peGluKHN1cGVyY2xhc3MpIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSBzdXBlci5fd3JhcChvcHRpb25zKTtcbiAgICAgIG5ld0l0ZW0ucGFyZW50SW5kZXggPSBvcHRpb25zLnBhcmVudEluZGV4O1xuICAgICAgcmV0dXJuIG5ld0l0ZW07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDaGlsZFRhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZDaGlsZFRhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgQ2hpbGRUYWJsZU1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IENoaWxkVGFibGVNaXhpbiBmcm9tICcuL0NoaWxkVGFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBDaGlsZFRhYmxlTWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0U29ydEhhc2ggKCkge1xuICAgIHJldHVybiBzdXBlci5nZXRTb3J0SGFzaCgpICsgdGhpcy5wYXJlbnRUYWJsZS5nZXRTb3J0SGFzaCgpICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGNvbnN0IHJvdyA9IGF3YWl0IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93ICE9PSB1bmRlZmluZWQgJiYgcm93ICE9PSBudWxsICYmIE9iamVjdC5rZXlzKHJvdykubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICBwYXJlbnRJbmRleDogd3JhcHBlZFBhcmVudC5pbmRleFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgQ2hpbGRUYWJsZU1peGluIGZyb20gJy4vQ2hpbGRUYWJsZU1peGluLmpzJztcblxuY2xhc3MgVW5yb2xsZWRUYWJsZSBleHRlbmRzIENoaWxkVGFibGVNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHN1cGVyLmdldFNvcnRIYXNoKCkgKyB0aGlzLnBhcmVudFRhYmxlLmdldFNvcnRIYXNoKCkgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgY29uc3Qgcm93cyA9IHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV07XG4gICAgICBpZiAocm93cyAhPT0gdW5kZWZpbmVkICYmIHJvd3MgIT09IG51bGwgJiZcbiAgICAgICAgICB0eXBlb2Ygcm93c1tTeW1ib2wuaXRlcmF0b3JdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgcm93IG9mIHJvd3MpIHtcbiAgICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgICBpbmRleCxcbiAgICAgICAgICAgIHJvdyxcbiAgICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXSxcbiAgICAgICAgICAgIHBhcmVudEluZGV4OiB3cmFwcGVkUGFyZW50LmluZGV4XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgICAgICBpbmRleCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVW5yb2xsZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgUGFyZW50Q2hpbGRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbignLycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMucGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5nZXRTb3J0SGFzaCgpKS5qb2luKCcsJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAoKSB7XG4gICAgbGV0IHBhcmVudFRhYmxlLCBjaGlsZFRhYmxlO1xuICAgIGlmICh0aGlzLnBhcmVudFRhYmxlc1swXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMV0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgfSBlbHNlIGlmICh0aGlzLnBhcmVudFRhYmxlc1sxXS5wYXJlbnRUYWJsZSA9PT0gdGhpcy5wYXJlbnRUYWJsZXNbMF0pIHtcbiAgICAgIHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMF07XG4gICAgICBjaGlsZFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZXNbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50Q2hpbGRUYWJsZSBub3Qgc2V0IHVwIHByb3Blcmx5YCk7XG4gICAgfVxuXG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGNoaWxkIG9mIGNoaWxkVGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICBjb25zdCBwYXJlbnQgPSBhd2FpdCBwYXJlbnRUYWJsZS5nZXRJdGVtKGNoaWxkLnBhcmVudEluZGV4KTtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbcGFyZW50LCBjaGlsZF1cbiAgICAgIH0pO1xuICAgICAgaWYgKGF3YWl0IHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcmVudENoaWxkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFByb2plY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMudGFibGVPcmRlciA9IG9wdGlvbnMudGFibGVPcmRlcjtcbiAgICBpZiAoIXRoaXMudGFibGVPcmRlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGB0YWJsZU9yZGVyIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZU9yZGVyLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGdldFNvcnRIYXNoICgpIHtcbiAgICByZXR1cm4gc3VwZXIuZ2V0U29ydEhhc2goKSArIHRoaXMudGFibGVPcmRlclxuICAgICAgLm1hcCh0YWJsZUlkID0+IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLmdldFNvcnRIYXNoKCkpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3QgZmlyc3RUYWJsZSA9IHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVPcmRlclswXV07XG4gICAgY29uc3QgcmVtYWluaW5nSWRzID0gdGhpcy50YWJsZU9yZGVyLnNsaWNlKDEpO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlSXRlbSBvZiBmaXJzdFRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBsYXN0SXRlbSBvZiBzb3VyY2VJdGVtLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdJZHMpKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleDogc291cmNlSXRlbS5pbmRleCArICfiqK8nICsgbGFzdEl0ZW0uaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFtzb3VyY2VJdGVtLCBsYXN0SXRlbV1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhd2FpdCBzZWxmLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBnZXRTb3J0SGFzaCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudHlwZSArIHRoaXMuY2xhc3NOYW1lO1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIHNldEFubm90YXRpb24gKGtleSwgdmFsdWUpIHtcbiAgICB0aGlzLmFubm90YXRpb25zW2tleV0gPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZUFubm90YXRpb24gKGtleSkge1xuICAgIGRlbGV0ZSB0aGlzLmFubm90YXRpb25zW2tleV07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdmFyaWFibGVOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy50eXBlLnRvTG9jYWxlTG93ZXJDYXNlKCkgKyAnXycgK1xuICAgICAgdGhpcy5jbGFzc05hbWVcbiAgICAgICAgLnNwbGl0KC9cXFcrL2cpXG4gICAgICAgIC5maWx0ZXIoZCA9PiBkLmxlbmd0aCA+IDApXG4gICAgICAgIC5tYXAoZCA9PiBkWzBdLnRvTG9jYWxlVXBwZXJDYXNlKCkgKyBkLnNsaWNlKDEpKVxuICAgICAgICAuam9pbignJyk7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBnZXQgZGVsZXRlZCAoKSB7XG4gICAgcmV0dXJuICF0aGlzLm1vZGVsLmRlbGV0ZWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNHZW5lcmljICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnR2VuZXJpY0NsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUpLnRhYmxlSWQsXG4gICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICB9KTtcbiAgfVxuICB1bnJvbGwgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUudW5yb2xsKGF0dHJpYnV0ZSkudGFibGVJZCxcbiAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgIH0pO1xuICB9XG4gIHByb21vdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpLnRhYmxlSWQsXG4gICAgICB0eXBlOiB0aGlzLmNvbnN0cnVjdG9yLm5hbWVcbiAgICB9KTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICAgIHR5cGU6IHRoaXMuY29uc3RydWN0b3IubmFtZVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgICAgdHlwZTogdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC5vcHRpbWl6ZVRhYmxlcygpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgY291bnRBbGxVbmlxdWVWYWx1ZXMgKCkge1xuICAgIC8vIFRPRE86IHRoaXMgaXMgd2lsZGx5IGluZWZmaWNpZW50LCBlc3BlY2lhbGx5IGZvciBxdWFudGl0YXRpdmVcbiAgICAvLyBhdHRyaWJ1dGVzLi4uIGN1cnJlbnRseSBkb2luZyB0aGlzICh1bmRlciBwcm90ZXN0KSBmb3Igc3RhdHMgaW4gdGhlXG4gICAgLy8gY29ubmVjdCBpbnRlcmZhY2UuIE1heWJlIHVzZWZ1bCBmb3Igd3JpdGluZyBoaXN0b2dyYW0gZnVuY3Rpb25zIGluXG4gICAgLy8gdGhlIGZ1dHVyZT9cbiAgICBjb25zdCBoYXNoYWJsZUJpbnMgPSB7fTtcbiAgICBjb25zdCB1bkhhc2hhYmxlQ291bnRzID0ge307XG4gICAgY29uc3QgaW5kZXhCaW4gPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgIGluZGV4QmluW2l0ZW0uaW5kZXhdID0gMTsgLy8gYWx3YXlzIDFcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpdGVtLnJvdykpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIHVuSGFzaGFibGVDb3VudHNbYXR0cl0gPSB1bkhhc2hhYmxlQ291bnRzW2F0dHJdIHx8IDA7XG4gICAgICAgICAgdW5IYXNoYWJsZUNvdW50c1thdHRyXSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhc2hhYmxlQmluc1thdHRyXSA9IGhhc2hhYmxlQmluc1thdHRyXSB8fCB7fTtcbiAgICAgICAgICBoYXNoYWJsZUJpbnNbYXR0cl1bdmFsdWVdID0gaGFzaGFibGVCaW5zW2F0dHJdW3ZhbHVlXSB8fCAwO1xuICAgICAgICAgIGhhc2hhYmxlQmluc1thdHRyXVt2YWx1ZV0rKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBoYXNoYWJsZUJpbnMsIHVuSGFzaGFibGVDb3VudHMsIGluZGV4QmluIH07XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IGVkZ2VJZHMgPSBvcHRpb25zLmNsYXNzZXNcbiAgICAgID8gb3B0aW9ucy5jbGFzc2VzLm1hcChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc0lkKVxuICAgICAgOiBvcHRpb25zLmNsYXNzSWRzIHx8IE9iamVjdC5rZXlzKHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBpdGVyYXRvcnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBlZGdlSWRzKSB7XG4gICAgICBpZiAoIXRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzW2VkZ2VJZF0pIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2VDbGFzcyk7XG4gICAgICBpZiAocm9sZSA9PT0gJ2JvdGgnIHx8IHJvbGUgPT09ICdzb3VyY2UnKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlSWRzID0gZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgICAgaXRlcmF0b3JzLnB1c2godGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKTtcbiAgICAgIH1cbiAgICAgIGlmIChyb2xlID09PSAnYm90aCcgfHwgcm9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgY29uc3QgdGFibGVJZHMgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgICBpdGVyYXRvcnMucHVzaCh0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpO1xuICAgICAgfVxuICAgIH1cbiAgICB5aWVsZCAqIHRoaXMuaGFuZGxlTGltaXQob3B0aW9ucywgaXRlcmF0b3JzKTtcbiAgfVxuICBhc3luYyAqIG5laWdoYm9yTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKCkpIHtcbiAgICAgIGNvbnN0IHJvbGUgPSB0aGlzLmNsYXNzT2JqLmdldEVkZ2VSb2xlKGVkZ2UuY2xhc3NPYmopO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiBlZGdlLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgICAgaWYgKHRoaXMgIT09IHRhcmdldCkge1xuICAgICAgICAgICAgeWllbGQgdGFyZ2V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJyB8fCByb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgICAgaWYgKHRoaXMgIT09IHNvdXJjZSkge1xuICAgICAgICAgICAgeWllbGQgc291cmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqIG5laWdoYm9ycyAob3B0aW9ucyA9IHt9KSB7XG4gICAgeWllbGQgKiB0aGlzLmVkZ2VzKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcygpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VOZWlnaGJvcmhvb2Qob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGdldEVkZ2VSb2xlIChlZGdlQ2xhc3MpIHtcbiAgICBpZiAoIXRoaXMuZWRnZUNsYXNzSWRzW2VkZ2VDbGFzcy5jbGFzc0lkXSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICByZXR1cm4gJ2JvdGgnO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuICdzb3VyY2UnO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgcmV0dXJuICd0YXJnZXQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIG1pc21hdGNoIGJldHdlZW4gbm9kZSBhbmQgZWRnZSBjbGFzc0lkc2ApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBnZXQgY2FuQXV0b0Nvbm5lY3QgKCkge1xuICAgIGNvbnN0IGFsbFJvbGVzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpLm1hcChpZCA9PiB0aGlzLmdldEVkZ2VSb2xlKHRoaXMubW9kZWwuY2xhc3Nlc1tpZF0pKTtcbiAgICByZXR1cm4gYWxsUm9sZXMubGVuZ3RoID4gMCAmJiBhbGxSb2xlcy5sZW5ndGggPD0gMiAmJiBhbGxSb2xlcy5pbmRleE9mKCdib3RoJykgPT09IC0xO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgcm9sZXMgPSBlZGdlQ2xhc3NJZHMubWFwKGlkID0+IHRoaXMuZ2V0RWRnZVJvbGUodGhpcy5tb2RlbC5jbGFzc2VzW2lkXSkpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIgfHwgcm9sZXMuaW5kZXhPZignYm90aCcpICE9PSAtMSkge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gY29ubmVjdGlvbnMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG5cbiAgICAgIC8vIEFzIHdlJ3JlIGNvbnZlcnRlZCB0byBhbiBlZGdlLCBvdXIgbmV3IHJlc3VsdGluZyBzb3VyY2UgQU5EIHRhcmdldFxuICAgICAgLy8gc2hvdWxkIGJlIHdoYXRldmVyIGlzIGF0IHRoZSBvdGhlciBlbmQgb2YgZWRnZUNsYXNzIChpZiBhbnl0aGluZylcbiAgICAgIGlmIChyb2xlc1swXSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAocm9sZXNbMF0gPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgbXlTb3VyY2VSb2xlID0gcm9sZXNbMF07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICBsZXQgbXlUYXJnZXRSb2xlID0gcm9sZXNbMV07XG4gICAgICBpZiAobXlTb3VyY2VSb2xlID09PSAnc291cmNlJyAmJiBteVRhcmdldFJvbGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgIC8vIFN3YXAgaWYgdGhlIHNvdXJjZSBwb2ludHMgYXdheSBhbmQgdGhlIHRhcmdldCBwb2ludHMgYXQgbWVcbiAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgIG15U291cmNlUm9sZSA9IHJvbGVzWzFdO1xuICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgbXlUYXJnZXRSb2xlID0gcm9sZXNbMF07XG4gICAgICB9XG5cbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICAvLyBPbmx5IHN0YXkgZGlyZWN0ZWQgaWYgYm90aCBlZGdlcyBhcmUgcG9pbnRpbmcgaW4gdGhlIHNhbWUgZGlyZWN0aW9uXG4gICAgICAgIC8vIChpZiBib3RoIGFyZSBwb2ludGluZyBhdCwgb3IgYXdheSBmcm9tIHRoaXMgbm9kZSBjbGFzcywgdGhlbiB0aGVcbiAgICAgICAgLy8gcmVzdWx0aW5nIGVkZ2Ugc2hvdWxkbid0IGJlIGRpcmVjdGVkKVxuICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gbXlTb3VyY2VSb2xlICE9PSBteVRhcmdldFJvbGU7XG4gICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICAvLyBPbmx5IHRoZSBzb3VyY2UgZWRnZSBpcyBkaXJlY3RlZDsga2VlcCB0aGUgZGlyZWN0aW9uLCBhbmQgc3dhcFxuICAgICAgICAvLyBjbGFzc2VzIGlmIGl0J3MgYWN0dWFsbHkgcG9pbnRpbmcgaW53YXJkICh0aGVuIHdlJ2Qgd2FudCBpdCB0b1xuICAgICAgICAvLyBiZSBvbiB0aGUgdGFyZ2V0IHNpZGUpXG4gICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICBpZiAobXlTb3VyY2VSb2xlID09PSAndGFyZ2V0Jykge1xuICAgICAgICAgIGxldCB0ZW1wID0gc291cmNlRWRnZUNsYXNzO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRhcmdldEVkZ2VDbGFzcztcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0ZW1wO1xuICAgICAgICAgIHRlbXAgPSBteVNvdXJjZVJvbGU7XG4gICAgICAgICAgbXlTb3VyY2VSb2xlID0gbXlUYXJnZXRSb2xlO1xuICAgICAgICAgIG15VGFyZ2V0Um9sZSA9IHRlbXA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIC8vIE9ubHkgdGhlIHRhcmdldCBlZGdlIGlzIGRpcmVjdGVkOyBrZWVwIHRoZSBkaXJlY3Rpb24sIGFuZCBzd2FwXG4gICAgICAgIC8vIGNsYXNzZXMgaWYgaXQncyBhY3R1YWxseSBwb2ludGluZyBpbndhcmQgKHRoZW4gd2UnZCB3YW50IGl0IHRvXG4gICAgICAgIC8vIGJlIG9uIHRoZSBzb3VyY2Ugc2lkZSlcbiAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIGlmIChteVRhcmdldFJvbGUgPT09ICd0YXJnZXQnKSB7XG4gICAgICAgICAgbGV0IHRlbXAgPSBzb3VyY2VFZGdlQ2xhc3M7XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGFyZ2V0RWRnZUNsYXNzO1xuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRlbXA7XG4gICAgICAgICAgdGVtcCA9IG15U291cmNlUm9sZTtcbiAgICAgICAgICBteVNvdXJjZVJvbGUgPSBteVRhcmdldFJvbGU7XG4gICAgICAgICAgbXlUYXJnZXRSb2xlID0gdGVtcDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG15U291cmNlUm9sZSA9PT0gJ3RhcmdldCdcbiAgICAgICAgPyBzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA6IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gbXlUYXJnZXRSb2xlID09PSAnc291cmNlJ1xuICAgICAgICA/IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkIDogdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG5cbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMgfHwgW10pLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyB8fCBbXSk7XG4gICAgICBpZiAobXlTb3VyY2VSb2xlID09PSAnc291cmNlJykge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSAodGFyZ2V0RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzIHx8IFtdKS5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMgfHwgW10pO1xuICAgICAgaWYgKG15VGFyZ2V0Um9sZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG5cbiAgICAgIC8vIENvbm5lY3QgdGhpcyBjbGFzcyB0byB0aGUgbm9kZSBjbGFzc2VzIG9uIHRoZSBvdGhlciBlbmQgb2Ygc291cmNlIC9cbiAgICAgIC8vIHRhcmdldCAoaWYgdGhleSdyZSBjb25uZWN0ZWQpXG4gICAgICBpZiAodGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0pIHtcbiAgICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdKSB7XG4gICAgICAgIHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzSWRzO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0dlbmVyaWMgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgcmV0dXJuIHN1cGVyLmludGVycHJldEFzR2VuZXJpYygpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLnByb21vdGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbIG90aGVySGFzaC50YWJsZUlkIF07XG4gICAgfVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gc3VwZXIucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgY3JlYXRlU3VwZXJub2RlcyAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgZXhpc3RpbmdFZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gc3VwZXIucHJvbW90ZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgZXhpc3RpbmdFZGdlQ2xhc3NJZHMpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBjb25zdCByb2xlID0gdGhpcy5nZXRFZGdlUm9sZShlZGdlQ2xhc3MpO1xuICAgICAgaWYgKHJvbGUgPT09ICdib3RoJykge1xuICAgICAgICBuZXdOb2RlQ2xhc3MucHJvamVjdE5ld0VkZ2UoW1xuICAgICAgICAgIG5ld0VkZ2VDbGFzcy5jbGFzc0lkLFxuICAgICAgICAgIHRoaXMuY2xhc3NJZCxcbiAgICAgICAgICBlZGdlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgICB0aGlzLmNsYXNzSWQsXG4gICAgICAgICAgbmV3RWRnZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgICAgbmV3Tm9kZUNsYXNzLmNsYXNzSWRcbiAgICAgICAgXSkuc2V0Q2xhc3NOYW1lKGVkZ2VDbGFzcy5jbGFzc05hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3Tm9kZUNsYXNzLnByb2plY3ROZXdFZGdlKFtcbiAgICAgICAgICBuZXdFZGdlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgICB0aGlzLmNsYXNzSWQsXG4gICAgICAgICAgZWRnZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgICAgcm9sZSA9PT0gJ3NvdXJjZScgPyBlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA6IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXG4gICAgICAgIF0pLnNldENsYXNzTmFtZShlZGdlQ2xhc3MuY2xhc3NOYW1lKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBjb25uZWN0VG9DaGlsZE5vZGVDbGFzcyAoY2hpbGRDbGFzcykge1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpcy50YWJsZS5jb25uZWN0KFtjaGlsZENsYXNzLnRhYmxlXSwgJ1BhcmVudENoaWxkVGFibGUnKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzOiBbXSxcbiAgICAgIHRhcmdldENsYXNzSWQ6IGNoaWxkQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzOiBbXVxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgY2hpbGRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gc3VwZXIuZXhwYW5kKGF0dHJpYnV0ZSk7XG4gICAgdGhpcy5jb25uZWN0VG9DaGlsZE5vZGVDbGFzcyhuZXdOb2RlQ2xhc3MpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgdW5yb2xsIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci51bnJvbGwoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb0NoaWxkTm9kZUNsYXNzKG5ld05vZGVDbGFzcyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBwcm9qZWN0TmV3RWRnZSAoY2xhc3NJZExpc3QpIHtcbiAgICBjb25zdCBjbGFzc0xpc3QgPSBbdGhpc10uY29uY2F0KGNsYXNzSWRMaXN0Lm1hcChjbGFzc0lkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLmNsYXNzZXNbY2xhc3NJZF07XG4gICAgfSkpO1xuICAgIGlmIChjbGFzc0xpc3QubGVuZ3RoIDwgMyB8fCBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLnR5cGUgIT09ICdOb2RlJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNsYXNzSWRMaXN0YCk7XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZUNsYXNzSWQgPSB0aGlzLmNsYXNzSWQ7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTGlzdFtjbGFzc0xpc3QubGVuZ3RoIC0gMV0uY2xhc3NJZDtcbiAgICBsZXQgdGFibGVPcmRlciA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDwgY2xhc3NMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjbGFzc09iaiA9IGNsYXNzTGlzdFtpXTtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgdGFibGVPcmRlci5wdXNoKGNsYXNzT2JqLnRhYmxlSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZWRnZVJvbGUgPSBjbGFzc0xpc3RbaSAtIDFdLmdldEVkZ2VSb2xlKGNsYXNzT2JqKTtcbiAgICAgICAgaWYgKGVkZ2VSb2xlID09PSAnc291cmNlJyB8fCBlZGdlUm9sZSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KFxuICAgICAgICAgICAgQXJyYXkuZnJvbShjbGFzc09iai5zb3VyY2VUYWJsZUlkcykucmV2ZXJzZSgpKTtcbiAgICAgICAgICB0YWJsZU9yZGVyLnB1c2goY2xhc3NPYmoudGFibGVJZCk7XG4gICAgICAgICAgdGFibGVPcmRlciA9IHRhYmxlT3JkZXIuY29uY2F0KGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoXG4gICAgICAgICAgICBBcnJheS5mcm9tKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKS5yZXZlcnNlKCkpO1xuICAgICAgICAgIHRhYmxlT3JkZXIucHVzaChjbGFzc09iai50YWJsZUlkKTtcbiAgICAgICAgICB0YWJsZU9yZGVyID0gdGFibGVPcmRlci5jb25jYXQoY2xhc3NPYmouc291cmNlVGFibGVJZHMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy50YWJsZS5wcm9qZWN0KHRhYmxlT3JkZXIpO1xuICAgIGNvbnN0IG5ld0NsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkLFxuICAgICAgdGFyZ2V0Q2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzOiBbXSxcbiAgICAgIHRhcmdldFRhYmxlSWRzOiBbXVxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBjbGFzc0xpc3RbY2xhc3NMaXN0Lmxlbmd0aCAtIDFdLmVkZ2VDbGFzc0lkc1tuZXdDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgcmV0dXJuIG5ld0NsYXNzO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc2VzICYmICFvcHRpb25zLmNsYXNzZXMuZmluZChkID0+IHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gZC5jbGFzc0lkKSkgfHxcbiAgICAgICAgKG9wdGlvbnMuY2xhc3NJZHMgJiYgb3B0aW9ucy5jbGFzc0lkcy5pbmRleE9mKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCkgPT09IC0xKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIGNvbnN0IHRhYmxlSWRzID0gdGhpcy5jbGFzc09iai5zb3VyY2VUYWJsZUlkcy5jb25jYXQoWyBzb3VyY2VUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcylcbiAgICBdKTtcbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBudWxsIHx8XG4gICAgICAgIChvcHRpb25zLmNsYXNzZXMgJiYgIW9wdGlvbnMuY2xhc3Nlcy5maW5kKGQgPT4gdGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBkLmNsYXNzSWQpKSB8fFxuICAgICAgICAob3B0aW9ucy5jbGFzc0lkcyAmJiBvcHRpb25zLmNsYXNzSWRzLmluZGV4T2YodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkKSA9PT0gLTEpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldFRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgY29uc3QgdGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLmhhbmRsZUxpbWl0KG9wdGlvbnMsIFtcbiAgICAgIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogbm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIHlpZWxkICogdGhpcy5oYW5kbGVMaW1pdChvcHRpb25zLCBbXG4gICAgICB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpLFxuICAgICAgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKVxuICAgIF0pO1xuICB9XG4gIGFzeW5jICogbmVpZ2hib3JzIChvcHRpb25zID0ge30pIHtcbiAgICB5aWVsZCAqIHRoaXMubm9kZXMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgZWRnZTogdGhpc1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBnZXQgc291cmNlQ2xhc3MgKCkge1xuICAgIHJldHVybiAodGhpcy5zb3VyY2VDbGFzc0lkICYmIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdKSB8fCBudWxsO1xuICB9XG4gIGdldCB0YXJnZXRDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnRhcmdldENsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICByZXN1bHQuc291cmNlQ2xhc3NJZCA9IHRoaXMuc291cmNlQ2xhc3NJZDtcbiAgICByZXN1bHQuc291cmNlVGFibGVJZHMgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBFZGdlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBfc3BsaXRUYWJsZUlkTGlzdCAodGFibGVJZExpc3QsIG90aGVyQ2xhc3MpIHtcbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZVRhYmxlSWRMaXN0OiBbXSxcbiAgICAgIGVkZ2VUYWJsZUlkOiBudWxsLFxuICAgICAgZWRnZVRhYmxlSWRMaXN0OiBbXVxuICAgIH07XG4gICAgaWYgKHRhYmxlSWRMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gV2VpcmQgY29ybmVyIGNhc2Ugd2hlcmUgd2UncmUgdHJ5aW5nIHRvIGNyZWF0ZSBhbiBlZGdlIGJldHdlZW5cbiAgICAgIC8vIGFkamFjZW50IG9yIGlkZW50aWNhbCB0YWJsZXMuLi4gY3JlYXRlIGEgQ29ubmVjdGVkVGFibGVcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRoaXMudGFibGUuY29ubmVjdChvdGhlckNsYXNzLnRhYmxlKS50YWJsZUlkO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIGEgdGFibGUgaW4gdGhlIG1pZGRsZSBhcyB0aGUgbmV3IGVkZ2UgdGFibGU7IHByaW9yaXRpemVcbiAgICAgIC8vIFN0YXRpY1RhYmxlIGFuZCBTdGF0aWNEaWN0VGFibGVcbiAgICAgIGxldCBzdGF0aWNFeGlzdHMgPSBmYWxzZTtcbiAgICAgIGxldCB0YWJsZURpc3RhbmNlcyA9IHRhYmxlSWRMaXN0Lm1hcCgodGFibGVJZCwgaW5kZXgpID0+IHtcbiAgICAgICAgc3RhdGljRXhpc3RzID0gc3RhdGljRXhpc3RzIHx8IHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIHJldHVybiB7IHRhYmxlSWQsIGluZGV4LCBkaXN0OiBNYXRoLmFicyh0YWJsZUlkTGlzdCAvIDIgLSBpbmRleCkgfTtcbiAgICAgIH0pO1xuICAgICAgaWYgKHN0YXRpY0V4aXN0cykge1xuICAgICAgICB0YWJsZURpc3RhbmNlcyA9IHRhYmxlRGlzdGFuY2VzLmZpbHRlcigoeyB0YWJsZUlkIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF0udHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB7IHRhYmxlSWQsIGluZGV4IH0gPSB0YWJsZURpc3RhbmNlcy5zb3J0KChhLCBiKSA9PiBhLmRpc3QgLSBiLmRpc3QpWzBdO1xuICAgICAgcmVzdWx0LmVkZ2VUYWJsZUlkID0gdGFibGVJZDtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZSgwLCBpbmRleCkucmV2ZXJzZSgpO1xuICAgICAgcmVzdWx0Lm5vZGVUYWJsZUlkTGlzdCA9IHRhYmxlSWRMaXN0LnNsaWNlKGluZGV4ICsgMSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGVtcC5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAuc291cmNlVGFibGVJZHMsIHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAudGFyZ2V0VGFibGVJZHMsIHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNHZW5lcmljICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICByZXR1cm4gc3VwZXIuaW50ZXJwcmV0QXNHZW5lcmljKCk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5wcm9tb3RlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHNvdXJjZUNsYXNzLnRhYmxlIDogc291cmNlQ2xhc3MudGFibGUucHJvbW90ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUucHJvbW90ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLnByb21vdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0U291cmNlICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1NvdXJjZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nU291cmNlQ2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1NvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gW107XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RUYXJnZXQgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nVGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdUYXJnZXRDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nVGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgcHJvbW90ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCAmJiB0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHJldHVybiBzdXBlci5wcm9tb3RlKGF0dHJpYnV0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKS50YWJsZUlkLFxuICAgICAgICB0eXBlOiAnTm9kZUNsYXNzJ1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgIG5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgICBzaWRlOiAhdGhpcy5zb3VyY2VDbGFzc0lkID8gJ3NvdXJjZScgOiAndGFyZ2V0JyxcbiAgICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgICAgZWRnZUF0dHJpYnV0ZTogYXR0cmlidXRlXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gICAgfVxuICB9XG4gIHJvbGx1cCAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLnRhYmxlLnByb21vdGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkcyA9IHRoaXMuc291cmNlQ2xhc3NJZCA/IFt0aGlzLnRhYmxlSWRdLmNvbmNhdCh0aGlzLnNvdXJjZVRhYmxlSWRzKSA6IFtdO1xuICAgIGNvbnN0IHRhcmdldFRhYmxlSWRzID0gdGhpcy50YXJnZXRDbGFzc0lkID8gW3RoaXMudGFibGVJZF0uY29uY2F0KHRoaXMudGFyZ2V0VGFibGVJZHMpIDogW107XG4gICAgY29uc3QgbmV3Q2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIGRpcmVjdGVkOiB0aGlzLmRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5zb3VyY2VDbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiB0aGlzLnRhcmdldENsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuc291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0NsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy50YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3Q2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdDbGFzcztcbiAgfVxuICBjb25uZWN0RmFjZXRlZENsYXNzIChuZXdFZGdlQ2xhc3MpIHtcbiAgICAvLyBXaGVuIGFuIGVkZ2UgY2xhc3MgaXMgZmFjZXRlZCwgd2Ugd2FudCB0byBrZWVwIHRoZSBzYW1lIGNvbm5lY3Rpb25zLiBUaGlzXG4gICAgLy8gbWVhbnMgd2UgbmVlZCB0byBjbG9uZSBlYWNoIHRhYmxlIGNoYWluLCBhbmQgYWRkIG91ciBvd24gdGFibGUgdG8gaXRcbiAgICAvLyAoYmVjYXVzZSBvdXIgdGFibGUgaXMgdGhlIHBhcmVudFRhYmxlIG9mIHRoZSBuZXcgb25lKVxuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgbmV3RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzID0gQXJyYXkuZnJvbSh0aGlzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIG5ld0VkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KHRoaXMudGFibGVJZCk7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgIG5ld0VkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcyA9IEFycmF5LmZyb20odGhpcy50YXJnZXRUYWJsZUlkcyk7XG4gICAgICBuZXdFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMudW5zaGlmdCh0aGlzLnRhYmxlSWQpO1xuICAgICAgdGhpcy50YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICBjb25zdCBuZXdDbGFzc2VzID0gc3VwZXIuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpO1xuICAgIGZvciAoY29uc3QgbmV3Q2xhc3Mgb2YgbmV3Q2xhc3Nlcykge1xuICAgICAgdGhpcy5jb25uZWN0RmFjZXRlZENsYXNzKG5ld0NsYXNzKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ld0NsYXNzZXM7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3Q2xhc3Mgb2Ygc3VwZXIub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHRoaXMuY29ubmVjdEZhY2V0ZWRDbGFzcyhuZXdDbGFzcyk7XG4gICAgICB5aWVsZCBuZXdDbGFzcztcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlQ2xhc3M7XG4iLCJjbGFzcyBGaWxlRm9ybWF0IHtcbiAgYXN5bmMgYnVpbGRSb3cgKGl0ZW0pIHtcbiAgICBjb25zdCByb3cgPSB7fTtcbiAgICBmb3IgKGxldCBhdHRyIGluIGl0ZW0ucm93KSB7XG4gICAgICByb3dbYXR0cl0gPSBhd2FpdCBpdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgcmV0dXJuIHJvdztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmlsZUZvcm1hdDtcbiIsImNsYXNzIFBhcnNlRmFpbHVyZSBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IgKGZpbGVGb3JtYXQpIHtcbiAgICBzdXBlcihgRmFpbGVkIHRvIHBhcnNlIGZvcm1hdDogJHtmaWxlRm9ybWF0LmNvbnN0cnVjdG9yLm5hbWV9YCk7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFBhcnNlRmFpbHVyZTtcbiIsImltcG9ydCBGaWxlRm9ybWF0IGZyb20gJy4vRmlsZUZvcm1hdC5qcyc7XG5pbXBvcnQgUGFyc2VGYWlsdXJlIGZyb20gJy4vUGFyc2VGYWlsdXJlLmpzJztcblxuY29uc3QgTk9ERV9OQU1FUyA9IFsnbm9kZXMnLCAnTm9kZXMnXTtcbmNvbnN0IEVER0VfTkFNRVMgPSBbJ2VkZ2VzJywgJ2xpbmtzJywgJ0VkZ2VzJywgJ0xpbmtzJ107XG5cbmNsYXNzIEQzSnNvbiBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dCxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGxcbiAgfSkge1xuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHRleHQpO1xuICAgIGNvbnN0IG5vZGVOYW1lID0gTk9ERV9OQU1FUy5maW5kKG5hbWUgPT4gZGF0YVtuYW1lXSBpbnN0YW5jZW9mIEFycmF5KTtcbiAgICBjb25zdCBlZGdlTmFtZSA9IEVER0VfTkFNRVMuZmluZChuYW1lID0+IGRhdGFbbmFtZV0gaW5zdGFuY2VvZiBBcnJheSk7XG4gICAgaWYgKCFub2RlTmFtZSB8fCAhZWRnZU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZUZhaWx1cmUodGhpcyk7XG4gICAgfVxuXG4gICAgY29uc3QgY29yZVRhYmxlID0gbW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ1N0YXRpY0RpY3RUYWJsZScsXG4gICAgICBuYW1lOiAnY29yZVRhYmxlJyxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KTtcbiAgICBjb25zdCBjb3JlQ2xhc3MgPSBtb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvcmVUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gICAgbGV0IFtub2RlcywgZWRnZXNdID0gY29yZUNsYXNzLmNsb3NlZFRyYW5zcG9zZShbbm9kZU5hbWUsIGVkZ2VOYW1lXSk7XG5cbiAgICBpZiAoY2xhc3NBdHRyaWJ1dGUpIHtcbiAgICAgIGlmIChub2RlQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgaW1wb3J0IGNsYXNzZXMgZnJvbSBEMy1zdHlsZSBKU09OIHdpdGhvdXQgbm9kZUF0dHJpYnV0ZWApO1xuICAgICAgfVxuICAgICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICAgIGNvbnN0IG5vZGVDbGFzc0xvb2t1cCA9IHt9O1xuICAgICAgY29uc3QgZWRnZUNsYXNzZXMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVzLm9wZW5GYWNldChjbGFzc0F0dHJpYnV0ZSkpIHtcbiAgICAgICAgbm9kZUNsYXNzTG9va3VwW25vZGVDbGFzcy5jbGFzc05hbWVdID0gbm9kZUNsYXNzZXMubGVuZ3RoO1xuICAgICAgICBub2RlQ2xhc3Nlcy5wdXNoKG5vZGVDbGFzcy5pbnRlcnByZXRBc05vZGVzKCkpO1xuICAgICAgfVxuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlQ2xhc3Mgb2YgZWRnZXMub3BlbkZhY2V0KGNsYXNzQXR0cmlidXRlKSkge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGVkZ2VDbGFzcy5pbnRlcnByZXRBc0VkZ2VzKCkpO1xuICAgICAgICBjb25zdCBzYW1wbGUgPSBhd2FpdCBlZGdlQ2xhc3MudGFibGUuZ2V0SXRlbSgpO1xuICAgICAgICBjb25zdCBzb3VyY2VDbGFzc05hbWUgPSBhd2FpdCBzYW1wbGUucm93W3NvdXJjZUF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXTtcbiAgICAgICAgaWYgKG5vZGVDbGFzc0xvb2t1cFtzb3VyY2VDbGFzc05hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgICAgICAgIG5vZGVDbGFzczogbm9kZUNsYXNzZXNbbm9kZUNsYXNzTG9va3VwW3NvdXJjZUNsYXNzTmFtZV1dLFxuICAgICAgICAgICAgc2lkZTogJ3NvdXJjZScsXG4gICAgICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICAgICAgZWRnZUF0dHJpYnV0ZTogc291cmNlQXR0cmlidXRlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0Q2xhc3NOYW1lID0gYXdhaXQgc2FtcGxlLnJvd1t0YXJnZXRBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV07XG4gICAgICAgIGlmIChub2RlQ2xhc3NMb29rdXBbdGFyZ2V0Q2xhc3NOYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICAgICAgICBub2RlQ2xhc3M6IG5vZGVDbGFzc2VzW25vZGVDbGFzc0xvb2t1cFt0YXJnZXRDbGFzc05hbWVdXSxcbiAgICAgICAgICAgIHNpZGU6ICd0YXJnZXQnLFxuICAgICAgICAgICAgbm9kZUF0dHJpYnV0ZSxcbiAgICAgICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5vZGVzID0gbm9kZXMuaW50ZXJwcmV0QXNOb2RlcygpO1xuICAgICAgbm9kZXMuc2V0Q2xhc3NOYW1lKG5vZGVOYW1lKTtcbiAgICAgIGVkZ2VzID0gZWRnZXMuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgICAgZWRnZXMuc2V0Q2xhc3NOYW1lKGVkZ2VOYW1lKTtcbiAgICAgIG5vZGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICAgIGVkZ2VDbGFzczogZWRnZXMsXG4gICAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgICBub2RlQXR0cmlidXRlLFxuICAgICAgICBlZGdlQXR0cmlidXRlOiBzb3VyY2VBdHRyaWJ1dGVcbiAgICAgIH0pO1xuICAgICAgbm9kZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgICAgZWRnZUNsYXNzOiBlZGdlcyxcbiAgICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICAgIG5vZGVBdHRyaWJ1dGUsXG4gICAgICAgIGVkZ2VBdHRyaWJ1dGU6IHRhcmdldEF0dHJpYnV0ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGZvcm1hdERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICBpbmNsdWRlQ2xhc3NlcyA9IE9iamVjdC52YWx1ZXMobW9kZWwuY2xhc3NlcyksXG4gICAgcHJldHR5ID0gdHJ1ZSxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBzb3VyY2VBdHRyaWJ1dGUgPSAnc291cmNlJyxcbiAgICB0YXJnZXRBdHRyaWJ1dGUgPSAndGFyZ2V0JyxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9IG51bGwsXG4gICAgcmF3VGV4dCA9IGZhbHNlXG4gIH0pIHtcbiAgICBpZiAoY2xhc3NBdHRyaWJ1dGUgJiYgIW5vZGVBdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZXhwb3J0IEQzLXN0eWxlIEpTT04gd2l0aCBjbGFzc2VzLCB3aXRob3V0IGEgbm9kZUF0dHJpYnV0ZWApO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbGlua3M6IFtdXG4gICAgfTtcbiAgICBjb25zdCBub2RlTG9va3VwID0ge307XG4gICAgY29uc3Qgbm9kZUNsYXNzZXMgPSBbXTtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgbm9kZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlQ2xhc3Nlcy5wdXNoKGNsYXNzT2JqKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5vdGhlciA9IHJlc3VsdC5vdGhlciB8fCBbXTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIHJlc3VsdC5vdGhlci5wdXNoKGF3YWl0IHRoaXMuYnVpbGRSb3coaXRlbSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3Qgbm9kZUNsYXNzIG9mIG5vZGVDbGFzc2VzKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2Ygbm9kZUNsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICBub2RlTG9va3VwW25vZGUuZXhwb3J0SWRdID0gcmVzdWx0Lm5vZGVzLmxlbmd0aDtcbiAgICAgICAgY29uc3Qgcm93ID0gYXdhaXQgdGhpcy5idWlsZFJvdyhub2RlKTtcbiAgICAgICAgaWYgKG5vZGVBdHRyaWJ1dGUpIHtcbiAgICAgICAgICByb3dbbm9kZUF0dHJpYnV0ZV0gPSBub2RlLmV4cG9ydElkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgIHJvd1tjbGFzc0F0dHJpYnV0ZV0gPSBub2RlLmNsYXNzT2JqLmNsYXNzTmFtZTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQubm9kZXMucHVzaChyb3cpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGVkZ2VDbGFzcy50YWJsZS5pdGVyYXRlKCkpIHtcbiAgICAgICAgY29uc3Qgcm93ID0gYXdhaXQgdGhpcy5idWlsZFJvdyhlZGdlKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgZWRnZS5zb3VyY2VOb2Rlcyh7IGNsYXNzZXM6IG5vZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgcm93W3NvdXJjZUF0dHJpYnV0ZV0gPSBub2RlQXR0cmlidXRlID8gc291cmNlLmV4cG9ydElkIDogbm9kZUxvb2t1cFtzb3VyY2UuZXhwb3J0SWRdO1xuICAgICAgICAgIGlmIChjbGFzc0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgcm93W3NvdXJjZUF0dHJpYnV0ZSArICdfJyArIGNsYXNzQXR0cmlidXRlXSA9IHNvdXJjZS5jbGFzc09iai5jbGFzc05hbWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIGVkZ2UudGFyZ2V0Tm9kZXMoeyBjbGFzc2VzOiBub2RlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgICAgcm93W3RhcmdldEF0dHJpYnV0ZV0gPSBub2RlQXR0cmlidXRlID8gdGFyZ2V0LmV4cG9ydElkIDogbm9kZUxvb2t1cFt0YXJnZXQuZXhwb3J0SWRdO1xuICAgICAgICAgICAgaWYgKGNsYXNzQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgIHJvd1t0YXJnZXRBdHRyaWJ1dGUgKyAnXycgKyBjbGFzc0F0dHJpYnV0ZV0gPSB0YXJnZXQuY2xhc3NPYmouY2xhc3NOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LmxpbmtzLnB1c2goT2JqZWN0LmFzc2lnbih7fSwgcm93KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcmV0dHkpIHtcbiAgICAgIHJlc3VsdC5ub2RlcyA9ICcgIFwibm9kZXNcIjogW1xcbiAgICAnICsgcmVzdWx0Lm5vZGVzLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIHJlc3VsdC5saW5rcyA9ICcgIFwibGlua3NcIjogW1xcbiAgICAnICsgcmVzdWx0LmxpbmtzLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICBdJztcbiAgICAgIGlmIChyZXN1bHQub3RoZXIpIHtcbiAgICAgICAgcmVzdWx0Lm90aGVyID0gJyxcXG4gIFwib3RoZXJcIjogW1xcbiAgICAnICsgcmVzdWx0Lm90aGVyLm1hcChyb3cgPT4gSlNPTi5zdHJpbmdpZnkocm93KSlcbiAgICAgICAgICAuam9pbignLFxcbiAgICAnKSArICdcXG4gIF0nO1xuICAgICAgfVxuICAgICAgcmVzdWx0ID0gYHtcXG4ke3Jlc3VsdC5ub2Rlc30sXFxuJHtyZXN1bHQubGlua3N9JHtyZXN1bHQub3RoZXIgfHwgJyd9XFxufVxcbmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IEpTT04uc3RyaW5naWZ5KHJlc3VsdCk7XG4gICAgfVxuICAgIGlmICghcmF3VGV4dCkge1xuICAgICAgcmVzdWx0ID0gJ2RhdGE6dGV4dC9qc29uO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgICB0eXBlOiAndGV4dC9qc29uJyxcbiAgICAgIGV4dGVuc2lvbjogJ2pzb24nXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IEQzSnNvbigpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcbmltcG9ydCBKU1ppcCBmcm9tICdqc3ppcCc7XG5cbmNsYXNzIENzdlppcCBleHRlbmRzIEZpbGVGb3JtYXQge1xuICBhc3luYyBpbXBvcnREYXRhICh7XG4gICAgbW9kZWwsXG4gICAgdGV4dFxuICB9KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmltcGxlbWVudGVkYCk7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBpbmRleE5hbWUgPSAnaW5kZXgnXG4gIH0pIHtcbiAgICBjb25zdCB6aXAgPSBuZXcgSlNaaXAoKTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgaW5jbHVkZUNsYXNzZXMpIHtcbiAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBjbGFzc09iai50YWJsZS51blN1cHByZXNzZWRBdHRyaWJ1dGVzO1xuICAgICAgbGV0IGNvbnRlbnRzID0gYCR7aW5kZXhOYW1lfSwke2F0dHJpYnV0ZXMuam9pbignLCcpfVxcbmA7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgIGNvbnRlbnRzICs9IGAke2l0ZW0uaW5kZXh9YDtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyIG9mIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICBjb250ZW50cyArPSBgLCR7YXdhaXQgaXRlbS5yb3dbYXR0cl19YDtcbiAgICAgICAgfVxuICAgICAgICBjb250ZW50cyArPSBgXFxuYDtcbiAgICAgIH1cbiAgICAgIHppcC5maWxlKGNsYXNzT2JqLmNsYXNzTmFtZSArICcuY3N2JywgY29udGVudHMpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiAnZGF0YTphcHBsaWNhdGlvbi96aXA7YmFzZTY0LCcgKyBhd2FpdCB6aXAuZ2VuZXJhdGVBc3luYyh7IHR5cGU6ICdiYXNlNjQnIH0pLFxuICAgICAgdHlwZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG4gICAgICBleHRlbnNpb246ICd6aXAnXG4gICAgfTtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgbmV3IENzdlppcCgpO1xuIiwiaW1wb3J0IEZpbGVGb3JtYXQgZnJvbSAnLi9GaWxlRm9ybWF0LmpzJztcblxuY29uc3QgZXNjYXBlQ2hhcnMgPSB7XG4gICcmcXVvdDsnOiAvXCIvZyxcbiAgJyZhcG9zOyc6IC8nL2csXG4gICcmbHQ7JzogLzwvZyxcbiAgJyZndDsnOiAvPi9nXG59O1xuXG5jbGFzcyBHRVhGIGV4dGVuZHMgRmlsZUZvcm1hdCB7XG4gIGFzeW5jIGltcG9ydERhdGEgKHtcbiAgICBtb2RlbCxcbiAgICB0ZXh0XG4gIH0pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHVuaW1wbGVtZW50ZWRgKTtcbiAgfVxuICBlc2NhcGUgKHN0cikge1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC8mL2csICcmYW1wOycpO1xuICAgIGZvciAoY29uc3QgWyByZXBsLCBleHAgXSBvZiBPYmplY3QuZW50cmllcyhlc2NhcGVDaGFycykpIHtcbiAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKGV4cCwgcmVwbCk7XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG4gIH1cbiAgYXN5bmMgZm9ybWF0RGF0YSAoe1xuICAgIG1vZGVsLFxuICAgIGluY2x1ZGVDbGFzc2VzID0gT2JqZWN0LnZhbHVlcyhtb2RlbC5jbGFzc2VzKSxcbiAgICBjbGFzc0F0dHJpYnV0ZSA9ICdjbGFzcycsXG4gICAgcmF3VGV4dCA9IGZhbHNlXG4gIH0pIHtcbiAgICBsZXQgbm9kZUNodW5rID0gJyc7XG4gICAgbGV0IGVkZ2VDaHVuayA9ICcnO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBpbmNsdWRlQ2xhc3Nlcykge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgbm9kZUNodW5rICs9IGBcbiAgICA8bm9kZSBpZD1cIiR7dGhpcy5lc2NhcGUobm9kZS5leHBvcnRJZCl9XCIgbGFiZWw9XCIke3RoaXMuZXNjYXBlKG5vZGUubGFiZWwpfVwiPlxuICAgICAgPGF0dHZhbHVlcz5cbiAgICAgICAgPGF0dHZhbHVlIGZvcj1cIjBcIiB2YWx1ZT1cIiR7dGhpcy5lc2NhcGUoY2xhc3NPYmouY2xhc3NOYW1lKX1cIi8+XG4gICAgICA8L2F0dHZhbHVlcz5cbiAgICA8L25vZGU+YDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBlZGdlIG9mIGNsYXNzT2JqLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIGVkZ2Uuc291cmNlTm9kZXMoeyBjbGFzc2VzOiBpbmNsdWRlQ2xhc3NlcyB9KSkge1xuICAgICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgZWRnZS50YXJnZXROb2Rlcyh7IGNsYXNzZXM6IGluY2x1ZGVDbGFzc2VzIH0pKSB7XG4gICAgICAgICAgICAgIGVkZ2VDaHVuayArPSBgXG4gICAgPGVkZ2UgaWQ9XCIke3RoaXMuZXNjYXBlKGVkZ2UuZXhwb3J0SWQpfVwiIHNvdXJjZT1cIiR7dGhpcy5lc2NhcGUoc291cmNlLmV4cG9ydElkKX1cIiB0YXJnZXQ9XCIke3RoaXMuZXNjYXBlKHRhcmdldC5leHBvcnRJZCl9XCI+XG4gICAgICA8YXR0dmFsdWVzPlxuICAgICAgICA8YXR0dmFsdWUgZm9yPVwiMFwiIHZhbHVlPVwiJHt0aGlzLmVzY2FwZShjbGFzc09iai5jbGFzc05hbWUpfVwiLz5cbiAgICAgIDwvYXR0dmFsdWVzPlxuICAgIDwvZWRnZT5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGxldCByZXN1bHQgPSBgXFxcbjw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PlxuPGdleGYgIHhtbG5zPVwiaHR0cDovL3d3dy5nZXhmLm5ldC8xLjJkcmFmdFwiIHhtbG5zOnhzaT1cImh0dHA6Ly93d3cudzMub3JnLzIwMDEvWE1MU2NoZW1hLWluc3RhbmNlXCIgeHNpOnNjaGVtYUxvY2F0aW9uPVwiaHR0cDovL3d3dy5nZXhmLm5ldC8xLjJkcmFmdCBodHRwOi8vd3d3LmdleGYubmV0LzEuMmRyYWZ0L2dleGYueHNkXCIgdmVyc2lvbj1cIjEuMlwiPlxuPG1ldGEgbGFzdG1vZGlmaWVkZGF0ZT1cIjIwMDktMDMtMjBcIj5cbiAgPGNyZWF0b3I+b3JpZ3JhcGguZ2l0aHViLmlvPC9jcmVhdG9yPlxuICA8ZGVzY3JpcHRpb24+JHttb2RlbC5uYW1lfTwvZGVzY3JpcHRpb24+XG48L21ldGE+XG48Z3JhcGggbW9kZT1cInN0YXRpY1wiIGRlZmF1bHRlZGdldHlwZT1cImRpcmVjdGVkXCI+XG4gIDxhdHRyaWJ1dGVzIGNsYXNzPVwibm9kZVwiPlxuICAgIDxhdHRyaWJ1dGUgaWQ9XCIwXCIgdGl0bGU9XCIke2NsYXNzQXR0cmlidXRlfVwiIHR5cGU9XCJzdHJpbmdcIi8+XG4gIDwvYXR0cmlidXRlcz5cbiAgPGF0dHJpYnV0ZXMgY2xhc3M9XCJlZGdlXCI+XG4gICAgPGF0dHJpYnV0ZSBpZD1cIjBcIiB0aXRsZT1cIiR7Y2xhc3NBdHRyaWJ1dGV9XCIgdHlwZT1cInN0cmluZ1wiLz5cbiAgPC9hdHRyaWJ1dGVzPlxuICA8bm9kZXM+JHtub2RlQ2h1bmt9XG4gIDwvbm9kZXM+XG4gIDxlZGdlcz4ke2VkZ2VDaHVua31cbiAgPC9lZGdlcz5cbjwvZ3JhcGg+XG48L2dleGY+YDtcbiAgICBpZiAoIXJhd1RleHQpIHtcbiAgICAgIHJlc3VsdCA9ICdkYXRhOnRleHQveG1sO2Jhc2U2NCwnICsgQnVmZmVyLmZyb20ocmVzdWx0KS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiByZXN1bHQsXG4gICAgICB0eXBlOiAndGV4dC94bWwnLFxuICAgICAgZXh0ZW5zaW9uOiAnZ2V4ZidcbiAgICB9O1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBuZXcgR0VYRigpO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIEZJTEVfRk9STUFUUyBmcm9tICcuLi9GaWxlRm9ybWF0cy9GaWxlRm9ybWF0cy5qcyc7XG5cbmNvbnN0IERBVEFMSUJfRk9STUFUUyA9IHtcbiAgJ2pzb24nOiAnanNvbicsXG4gICdjc3YnOiAnY3N2JyxcbiAgJ3Rzdic6ICd0c3YnXG59O1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIHRoaXMuX25leHRDbGFzc0lkID0gMTtcbiAgICB0aGlzLl9uZXh0VGFibGVJZCA9IDE7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXMoY2xhc3NlcykpIHtcbiAgICAgIHRoaXMuY2xhc3Nlc1tjbGFzc09iai5jbGFzc0lkXSA9IHRoaXMuaHlkcmF0ZShjbGFzc09iaiwgQ0xBU1NFUyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGUgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgICB0aGlzLnRhYmxlc1t0YWJsZS50YWJsZUlkXSA9IHRoaXMuaHlkcmF0ZSh0YWJsZSwgVEFCTEVTKTtcbiAgICB9XG5cbiAgICB0aGlzLm9uKCd1cGRhdGUnLCAoKSA9PiB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc2F2ZVRpbWVvdXQpO1xuICAgICAgdGhpcy5fc2F2ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3JpZ3JhcGguc2F2ZSgpO1xuICAgICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHVuZGVmaW5lZDtcbiAgICAgIH0sIDApO1xuICAgIH0pO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgY2xhc3NlcyA9IHt9O1xuICAgIGNvbnN0IHRhYmxlcyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHRhYmxlT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpKSB7XG4gICAgICB0YWJsZXNbdGFibGVPYmoudGFibGVJZF0gPSB0YWJsZU9iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXS50eXBlID0gdGFibGVPYmouY29uc3RydWN0b3IubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsSWQ6IHRoaXMubW9kZWxJZCxcbiAgICAgIG5hbWU6IHRoaXMubmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zLFxuICAgICAgY2xhc3NlcyxcbiAgICAgIHRhYmxlc1xuICAgIH07XG4gIH1cbiAgZ2V0IHVuc2F2ZWQgKCkge1xuICAgIHJldHVybiB0aGlzLl9zYXZlVGltZW91dCAhPT0gdW5kZWZpbmVkO1xuICB9XG4gIGh5ZHJhdGUgKHJhd09iamVjdCwgVFlQRVMpIHtcbiAgICByYXdPYmplY3QubW9kZWwgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgVFlQRVNbcmF3T2JqZWN0LnR5cGVdKHJhd09iamVjdCk7XG4gIH1cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMudGFibGVJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0pKSB7XG4gICAgICBvcHRpb25zLnRhYmxlSWQgPSBgdGFibGUke3RoaXMuX25leHRUYWJsZUlkfWA7XG4gICAgICB0aGlzLl9uZXh0VGFibGVJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBpZiAodGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXS5jbGFzc09iaiAmJiAhb3B0aW9ucy5vdmVyd3JpdGUpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0uZHVwbGljYXRlKCkudGFibGVJZDtcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMub3ZlcndyaXRlKSB7XG4gICAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdLnJlc2V0KCk7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENMQVNTRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuICBmaW5kQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiBjbGFzc09iai5jbGFzc05hbWUgPT09IGNsYXNzTmFtZSk7XG4gIH1cbiAgcmVuYW1lIChuZXdOYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmV3TmFtZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFubm90YXRlIChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hbm5vdGF0aW9uc1trZXldID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGVBbm5vdGF0aW9uIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5hbm5vdGF0aW9uc1trZXldO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLl9vcmlncmFwaC5kZWxldGVNb2RlbCh0aGlzLm1vZGVsSWQpO1xuICB9XG4gIGdldCBkZWxldGVkICgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3JpZ3JhcGgubW9kZWxzW3RoaXMubW9kZWxJZF07XG4gIH1cbiAgYXN5bmMgYWRkVGV4dEZpbGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMuZm9ybWF0KSB7XG4gICAgICBvcHRpb25zLmZvcm1hdCA9IG1pbWUuZXh0ZW5zaW9uKG1pbWUubG9va3VwKG9wdGlvbnMubmFtZSkpO1xuICAgIH1cbiAgICBpZiAoRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgICByZXR1cm4gRklMRV9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XS5pbXBvcnREYXRhKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAoREFUQUxJQl9GT1JNQVRTW29wdGlvbnMuZm9ybWF0XSkge1xuICAgICAgb3B0aW9ucy5kYXRhID0gZGF0YWxpYi5yZWFkKG9wdGlvbnMudGV4dCwgeyB0eXBlOiBvcHRpb25zLmZvcm1hdCB9KTtcbiAgICAgIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ2NzdicgfHwgb3B0aW9ucy5mb3JtYXQgPT09ICd0c3YnKSB7XG4gICAgICAgIG9wdGlvbnMuYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2Ygb3B0aW9ucy5kYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBvcHRpb25zLmF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBvcHRpb25zLmRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGZpbGUgZm9ybWF0OiAke29wdGlvbnMuZm9ybWF0fWApO1xuICAgIH1cbiAgfVxuICBhc3luYyBmb3JtYXREYXRhIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5tb2RlbCA9IHRoaXM7XG4gICAgaWYgKEZJTEVfRk9STUFUU1tvcHRpb25zLmZvcm1hdF0pIHtcbiAgICAgIHJldHVybiBGSUxFX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdLmZvcm1hdERhdGEob3B0aW9ucyk7XG4gICAgfSBlbHNlIGlmIChEQVRBTElCX0ZPUk1BVFNbb3B0aW9ucy5mb3JtYXRdKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJhdyAke29wdGlvbnMuZm9ybWF0fSBleHBvcnQgbm90IHlldCBzdXBwb3J0ZWRgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBleHBvcnQgdW5rbm93biBmb3JtYXQ6ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgfVxuICB9XG4gIGFkZFN0YXRpY1RhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50eXBlID0gb3B0aW9ucy5kYXRhIGluc3RhbmNlb2YgQXJyYXkgPyAnU3RhdGljVGFibGUnIDogJ1N0YXRpY0RpY3RUYWJsZSc7XG4gICAgbGV0IG5ld1RhYmxlID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnR2VuZXJpY0NsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWRcbiAgICB9KTtcbiAgfVxuICBvcHRpbWl6ZVRhYmxlcyAoKSB7XG4gICAgY29uc3QgdGFibGVzSW5Vc2UgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgdGFibGVzSW5Vc2VbY2xhc3NPYmoudGFibGVJZF0gPSB0cnVlO1xuICAgICAgZm9yIChjb25zdCB0YWJsZUlkIG9mIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzIHx8IFtdKSB7XG4gICAgICAgIHRhYmxlc0luVXNlW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBjbGFzc09iai50YXJnZXRUYWJsZUlkcyB8fCBbXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHBhcmVudHNWaXNpdGVkID0ge307XG4gICAgY29uc3QgcXVldWUgPSBPYmplY3Qua2V5cyh0YWJsZXNJblVzZSk7XG4gICAgd2hpbGUgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHRhYmxlSWQgPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgaWYgKCFwYXJlbnRzVmlzaXRlZFt0YWJsZUlkXSkge1xuICAgICAgICB0YWJsZXNJblVzZVt0YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIHBhcmVudHNWaXNpdGVkW3RhYmxlSWRdID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgdGFibGUgPSB0aGlzLnRhYmxlc1t0YWJsZUlkXTtcbiAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0YWJsZS5wYXJlbnRUYWJsZXMpIHtcbiAgICAgICAgICBxdWV1ZS5wdXNoKHBhcmVudFRhYmxlLnRhYmxlSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVJZCBvZiBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIGNvbnN0IHRhYmxlID0gdGhpcy50YWJsZXNbdGFibGVJZF07XG4gICAgICBpZiAoIXRhYmxlc0luVXNlW3RhYmxlSWRdICYmIHRhYmxlLnR5cGUgIT09ICdTdGF0aWMnICYmIHRhYmxlLnR5cGUgIT09ICdTdGF0aWNEaWN0Jykge1xuICAgICAgICB0YWJsZS5kZWxldGUodHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFRPRE86IElmIGFueSBEdXBsaWNhdGVkVGFibGUgaXMgaW4gdXNlLCBidXQgdGhlIG9yaWdpbmFsIGlzbid0LCBzd2FwIGZvciB0aGUgcmVhbCBvbmVcbiAgfVxuICBhc3luYyBnZXRJbnN0YW5jZVNhbXBsZSAoKSB7XG4gICAgY29uc3Qgc2VlZExpbWl0ID0gMTAwO1xuICAgIGNvbnN0IGNsdXN0ZXJMaW1pdCA9IDU7XG4gICAgY29uc3QgY2xhc3NDb3VudCA9IDU7XG4gICAgLy8gVHJ5IHRvIGdldCBhdCBtb3N0IHJvdWdobHkgc2VlZENvdW50IG5vZGVzIC8gZWRnZXMsIGluIGNsdXN0ZXJzIG9mIGFib3V0XG4gICAgLy8gY2x1c3RlckxpbWl0LCBhbmQgdHJ5IHRvIGluY2x1ZGUgYXQgbGVhc3QgY2xhc3NDb3VudCBpbnN0YW5jZXMgcGVyIGNsYXNzXG4gICAgLy8gKG1heSByZXR1cm4gbnVsbCBpZiBjYWNoZXMgYXJlIGludmFsaWRhdGVkIGR1cmluZyBpdGVyYXRpb24pXG4gICAgbGV0IGl0ZXJhdGlvblJlc2V0ID0gZmFsc2U7XG4gICAgY29uc3QgaW5zdGFuY2VzID0ge307XG4gICAgbGV0IHRvdGFsQ291bnQgPSAwO1xuICAgIGNvbnN0IGNsYXNzQ291bnRzID0ge307XG5cbiAgICBjb25zdCBwb3B1bGF0ZUNsYXNzQ291bnRzID0gYXN5bmMgKGluc3RhbmNlKSA9PiB7XG4gICAgICBpZiAoaW5zdGFuY2UucmVzZXQpIHtcbiAgICAgICAgLy8gQ2FjaGUgaW52YWxpZGF0ZWQhIFN0b3AgaXRlcmF0aW5nIGFuZCByZXR1cm4gbnVsbFxuICAgICAgICBpdGVyYXRpb25SZXNldCA9IHRydWU7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChpbnN0YW5jZXNbaW5zdGFuY2UuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgLy8gRG9uJ3QgYWRkIHRoaXMgaW5zdGFuY2UgaWYgd2UgYWxyZWFkeSBzYW1wbGVkIGl0LCBidXQga2VlcCBpdGVyYXRpbmdcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICAvLyBBZGQgYW5kIGNvdW50IHRoaXMgaW5zdGFuY2UgdG8gdGhlIHNhbXBsZVxuICAgICAgaW5zdGFuY2VzW2luc3RhbmNlLmluc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB0b3RhbENvdW50Kys7XG4gICAgICBjbGFzc0NvdW50c1tpbnN0YW5jZS5jbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzQ291bnRzW2luc3RhbmNlLmNsYXNzT2JqLmNsYXNzSWRdIHx8IDA7XG4gICAgICBjbGFzc0NvdW50c1tpbnN0YW5jZS5jbGFzc09iai5jbGFzc0lkXSsrO1xuXG4gICAgICBpZiAodG90YWxDb3VudCA+PSBzZWVkTGltaXQpIHtcbiAgICAgICAgLy8gV2UgaGF2ZSBlbm91Z2g7IHN0b3AgaXRlcmF0aW5nXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gVHJ5IHRvIGFkZCB0aGUgbmVpZ2hib3JzIG9mIHRoaXMgc2FtcGxlIGZyb20gY2xhc3NlcyB3aGVyZSB3ZSBkb24ndCBoYXZlXG4gICAgICAvLyBlbm91Z2ggc2FtcGxlcyB5ZXRcbiAgICAgIGNvbnN0IGNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKS5maWx0ZXIoY2xhc3NJZCA9PiB7XG4gICAgICAgIHJldHVybiAoY2xhc3NDb3VudHNbY2xhc3NJZF0gfHwgMCkgPCBjbGFzc0NvdW50O1xuICAgICAgfSk7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IG5laWdoYm9yIG9mIGluc3RhbmNlLm5laWdoYm9ycyh7IGxpbWl0OiBjbHVzdGVyTGltaXQsIGNsYXNzSWRzIH0pKSB7XG4gICAgICAgIGlmICghYXdhaXQgcG9wdWxhdGVDbGFzc0NvdW50cyhuZWlnaGJvcikpIHtcbiAgICAgICAgICAvLyBQYXNzIGFsb25nIHRoZSBzaWduYWwgdG8gc3RvcCBpdGVyYXRpbmdcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFNpZ25hbCB0aGF0IHdlIHNob3VsZCBrZWVwIGl0ZXJhdGluZ1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFtjbGFzc0lkLCBjbGFzc09ial0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY29uc3Qgcm93Q291bnQgPSBhd2FpdCBjbGFzc09iai50YWJsZS5jb3VudFJvd3MoKTtcbiAgICAgIC8vIERvbid0IHNhbXBsZSBmcm9tIEdlbmVyaWNDbGFzc2VzXG4gICAgICBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0dlbmVyaWMnKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgYXQgbGVhc3QgY2xhc3NDb3VudCBpbnN0YW5jZXMgZnJvbSB0aGlzIGNsYXNzIChhcyBsb25nIGFzIHdlXG4gICAgICAvLyBoYXZlbid0IGV4aGF1c3RlZCBhbGwgdGhlIGluc3RhbmNlcyB0aGUgY2xhc3MgaGFzIHRvIGdpdmUpXG4gICAgICB3aGlsZSAoKGNsYXNzQ291bnRzW2NsYXNzSWRdIHx8IDApIDwgY2xhc3NDb3VudCAmJiAoY2xhc3NDb3VudHNbY2xhc3NJZF0gfHwgMCkgPCByb3dDb3VudCkge1xuICAgICAgICBpZiAoaXRlcmF0aW9uUmVzZXQpIHtcbiAgICAgICAgICAvLyBDYWNoZSBpbnZhbGlkYXRlZDsgYmFpbCBpbW1lZGlhdGVseVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIC8vIEFkZCBhIHJhbmRvbSBpbnN0YW5jZSwgYW5kIHRyeSB0byBwcmlvcml0aXplIGl0cyBuZWlnaGJvcnMgaW4gb3RoZXIgY2xhc3Nlc1xuICAgICAgICBpZiAoIWF3YWl0IHBvcHVsYXRlQ2xhc3NDb3VudHMoYXdhaXQgY2xhc3NPYmoudGFibGUuZ2V0UmFuZG9tSXRlbSgpKSkge1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBpbnN0YW5jZXM7XG4gIH1cbiAgdmFsaWRhdGVJbnN0YW5jZVNhbXBsZSAoaW5zdGFuY2VzKSB7XG4gICAgLy8gQ2hlY2sgaWYgYWxsIHRoZSBpbnN0YW5jZXMgYXJlIHN0aWxsIGN1cnJlbnQ7IHJldHVybiBudWxsIGFzIGEgc2lnbmFsXG4gICAgLy8gdGhhdCBhIGNhY2hlIHdhcyBpbnZhbGlkYXRlZCwgYW5kIHRoYXQgYSBmdW5jdGlvbiBuZWVkcyB0byBiZSBjYWxsZWQgYWdhaW5cbiAgICBmb3IgKGNvbnN0IGluc3RhbmNlIG9mIE9iamVjdC52YWx1ZXMoaW5zdGFuY2VzKSkge1xuICAgICAgaWYgKGluc3RhbmNlLnJlc2V0KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5zdGFuY2VzO1xuICB9XG4gIGFzeW5jIHVwZGF0ZUluc3RhbmNlU2FtcGxlIChpbnN0YW5jZXMpIHtcbiAgICAvLyBSZXBsYWNlIGFueSBvdXQtb2YtZGF0ZSBpbnN0YW5jZXMsIGFuZCBleGNsdWRlIGluc3RhbmNlcyB0aGF0IG5vIGxvbmdlciBleGlzdFxuICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgIGZvciAoY29uc3QgW2luc3RhbmNlSWQsIGluc3RhbmNlXSBvZiBPYmplY3QuZW50cmllcyhpbnN0YW5jZXMpKSB7XG4gICAgICBjb25zdCB7IGNsYXNzSWQsIGluZGV4IH0gPSBKU09OLnBhcnNlKGluc3RhbmNlSWQpO1xuICAgICAgaWYgKHRoaXMuY2xhc3Nlc1tjbGFzc0lkXSkge1xuICAgICAgICBpZiAoaW5zdGFuY2UucmVzZXQpIHtcbiAgICAgICAgICBjb25zdCBuZXdJbnN0YW5jZSA9IGF3YWl0IHRoaXMuY2xhc3Nlc1tjbGFzc0lkXS50YWJsZS5nZXRJdGVtKGluZGV4KTtcbiAgICAgICAgICBpZiAobmV3SW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJlc3VsdFtuZXdJbnN0YW5jZS5pbnN0YW5jZUlkXSA9IG5ld0luc3RhbmNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUluc3RhbmNlU2FtcGxlKHJlc3VsdCk7XG4gIH1cbiAgcGFydGl0aW9uSW5zdGFuY2VTYW1wbGUgKGluc3RhbmNlcykge1xuICAgIC8vIFNlcGFyYXRlIHNhbXBsZXMgYnkgdGhlaXIgdHlwZVxuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVzOiB7fSxcbiAgICAgIGVkZ2VzOiB7fSxcbiAgICAgIGdlbmVyaWNzOiB7fVxuICAgIH07XG4gICAgZm9yIChjb25zdCBbaW5zdGFuY2VJZCwgaW5zdGFuY2VdIG9mIE9iamVjdC5lbnRyaWVzKGluc3RhbmNlcykpIHtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgcmVzdWx0Lm5vZGVzW2luc3RhbmNlSWRdID0gaW5zdGFuY2U7XG4gICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICByZXN1bHQuZWRnZXNbaW5zdGFuY2VJZF0gPSBpbnN0YW5jZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdC5nZW5lcmljc1tpbnN0YW5jZUlkXSA9IGluc3RhbmNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGFzeW5jIGZpbGxJbnN0YW5jZVNhbXBsZSAoaW5zdGFuY2VzKSB7XG4gICAgLy8gR2l2ZW4gYSBzcGVjaWZpYyBzYW1wbGUgb2YgdGhlIGdyYXBoLCBhZGQgaW5zdGFuY2VzIHRvIGVuc3VyZSB0aGF0OlxuICAgIC8vIDEuIEZvciBldmVyeSBwYWlyIG9mIG5vZGVzLCBhbnkgZWRnZXMgdGhhdCBleGlzdCBiZXR3ZWVuIHRoZW0gc2hvdWxkIGJlIGFkZGVkXG4gICAgLy8gMi4gRm9yIGV2ZXJ5IGVkZ2UsIGVuc3VyZSB0aGF0IGF0IGxlYXN0IG9uZSBzb3VyY2UgYW5kIHRhcmdldCBub2RlIGlzIGFkZGVkXG4gICAgY29uc3QgeyBub2RlcywgZWRnZXMgfSA9IHRoaXMucGFydGl0aW9uSW5zdGFuY2VTYW1wbGUoaW5zdGFuY2VzKTtcbiAgICBjb25zdCBleHRyYU5vZGVzID0ge307XG4gICAgY29uc3QgZXh0cmFFZGdlcyA9IHt9O1xuXG4gICAgLy8gTWFrZSBzdXJlIHRoYXQgZWFjaCBlZGdlIGhhcyBhdCBsZWFzdCBvbmUgc291cmNlIGFuZCBvbmUgdGFyZ2V0IChhc3N1bWluZ1xuICAgIC8vIHRoYXQgc291cmNlIGFuZCB0YXJnZXQgY2xhc3NlcyBhcmUgY29ubmVjdGVkKVxuICAgIGNvbnN0IHNlZWRTaWRlID0gYXN5bmMgKGVkZ2UsIGl0ZXJGdW5jKSA9PiB7XG4gICAgICBsZXQgYU5vZGU7XG4gICAgICBsZXQgaXNTZWVkZWQgPSBmYWxzZTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3Qgbm9kZSBvZiBlZGdlW2l0ZXJGdW5jXSgpKSB7XG4gICAgICAgIGFOb2RlID0gYU5vZGUgfHwgbm9kZTtcbiAgICAgICAgaWYgKG5vZGVzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICBpc1NlZWRlZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICghaXNTZWVkZWQgJiYgYU5vZGUpIHtcbiAgICAgICAgZXh0cmFOb2Rlc1thTm9kZS5pbnN0YW5jZUlkXSA9IGFOb2RlO1xuICAgICAgfVxuICAgIH07XG4gICAgZm9yIChjb25zdCBlZGdlIG9mIE9iamVjdC52YWx1ZXMoZWRnZXMpKSB7XG4gICAgICBhd2FpdCBzZWVkU2lkZShlZGdlLCAnc291cmNlTm9kZXMnKTtcbiAgICAgIGF3YWl0IHNlZWRTaWRlKGVkZ2UsICd0YXJnZXROb2RlcycpO1xuICAgIH1cblxuICAgIC8vIEFkZCBhbnkgZWRnZXMgdGhhdCBleGlzdCB0aGF0IGNvbm5lY3QgYW55IG9mIHRoZSBjb3JlIG5vZGVzXG4gICAgZm9yIChjb25zdCBub2RlIG9mIE9iamVjdC52YWx1ZXMobm9kZXMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2Ygbm9kZS5lZGdlcygpKSB7XG4gICAgICAgIGlmICghZWRnZXNbZWRnZS5pbnN0YW5jZUlkXSkge1xuICAgICAgICAgIC8vIENoZWNrIHRoYXQgYm90aCBlbmRzIG9mIHRoZSBlZGdlIGNvbm5lY3QgYXQgbGVhc3Qgb25lXG4gICAgICAgICAgLy8gb2Ygb3VyIG5vZGVzXG4gICAgICAgICAgbGV0IGNvbm5lY3RzU291cmNlID0gZmFsc2U7XG4gICAgICAgICAgbGV0IGNvbm5lY3RzVGFyZ2V0ID0gZmFsc2U7XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNTb3VyY2UgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKG5vZGVzW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgICAgICAgY29ubmVjdHNUYXJnZXQgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvbm5lY3RzU291cmNlICYmIGNvbm5lY3RzVGFyZ2V0KSB7XG4gICAgICAgICAgICBleHRyYUVkZ2VzW2VkZ2UuaW5zdGFuY2VJZF0gPSBlZGdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEF0IHRoaXMgcG9pbnQgd2UgaGF2ZSBhIGNvbXBsZXRlIHNldCBvZiBub2RlcyBhbmQgZWRnZXMgdGhhdCB3ZSB3YW50IHRvXG4gICAgLy8gaW5jbHVkZS4gV2UganVzdCBuZWVkIHRvIG1lcmdlIGFuZCB2YWxpZGF0ZSB0aGUgc2FtcGxlczpcbiAgICBpbnN0YW5jZXMgPSBPYmplY3QuYXNzaWduKHt9LCBub2RlcywgZWRnZXMsIGV4dHJhTm9kZXMsIGV4dHJhRWRnZXMpO1xuICAgIHJldHVybiB0aGlzLnZhbGlkYXRlSW5zdGFuY2VTYW1wbGUoaW5zdGFuY2VzKTtcbiAgfVxuICBhc3luYyBpbnN0YW5jZVNhbXBsZVRvR3JhcGggKGluc3RhbmNlcykge1xuICAgIGNvbnN0IGdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW11cbiAgICB9O1xuXG4gICAgY29uc3QgeyBub2RlcywgZWRnZXMgfSA9IHRoaXMucGFydGl0aW9uSW5zdGFuY2VTYW1wbGUoaW5zdGFuY2VzKTtcblxuICAgIC8vIE1ha2UgYSBsaXN0IG9mIG5vZGVzLCBwbHVzIGEgbG9va3VwIHRvIGVhY2ggbm9kZSdzIGluZGV4XG4gICAgZm9yIChjb25zdCBbaW5zdGFuY2VJZCwgbm9kZV0gb2YgT2JqZWN0LmVudHJpZXMobm9kZXMpKSB7XG4gICAgICBncmFwaC5ub2RlTG9va3VwW2luc3RhbmNlSWRdID0gZ3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgZ3JhcGgubm9kZXMucHVzaCh7XG4gICAgICAgIG5vZGVJbnN0YW5jZTogbm9kZSxcbiAgICAgICAgZHVtbXk6IGZhbHNlXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgYWxsIHRoZSBlZGdlcywgaW5jbHVkaW5nIGR1bW15IG5vZGVzIGZvciBkYW5nbGluZyBlZGdlc1xuICAgIGZvciAoY29uc3QgZWRnZSBvZiBPYmplY3QudmFsdWVzKGVkZ2VzKSkge1xuICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKCFlZGdlLmNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgICAvLyBNaXNzaW5nIGJvdGggc291cmNlIGFuZCB0YXJnZXQgY2xhc3NlczsgYWRkIGR1bW15IG5vZGVzIGZvciBib3RoIGVuZHNcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGgubm9kZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5ub2Rlcy5sZW5ndGggKyAxXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBBZGQgZHVtbXkgc291cmNlIG5vZGVzXG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2UudGFyZ2V0Tm9kZXMoKSkge1xuICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICghZWRnZS5jbGFzc09iai50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgIC8vIEFkZCBkdW1teSB0YXJnZXQgbm9kZXNcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBub2RlIG9mIGVkZ2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRoZXJlIHNob3VsZCBiZSBib3RoIHNvdXJjZSBhbmQgdGFyZ2V0IG5vZGVzIGZvciBlYWNoIGVkZ2VcbiAgICAgICAgLy8gKG9ubHkgY3JlYXRlIGR1bW15IG5vZGVzIGZvciBlZGdlcyB0aGF0IGFyZSBhY3R1YWxseSBkaXNjb25uZWN0ZWQpXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlTm9kZSBvZiBlZGdlLnNvdXJjZU5vZGVzKCkpIHtcbiAgICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2VOb2RlLmluc3RhbmNlSWRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0Tm9kZSBvZiBlZGdlLnRhcmdldE5vZGVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Tm9kZS5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICBlZGdlSW5zdGFuY2U6IGVkZ2UsXG4gICAgICAgICAgICAgICAgICBzb3VyY2U6IGdyYXBoLm5vZGVMb29rdXBbc291cmNlTm9kZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZUxvb2t1cFt0YXJnZXROb2RlLmluc3RhbmNlSWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdyYXBoO1xuICB9XG4gIGdldE5ldHdvcmtNb2RlbEdyYXBoICh7XG4gICAgcmF3ID0gdHJ1ZSxcbiAgICBpbmNsdWRlRHVtbWllcyA9IGZhbHNlLFxuICAgIGNsYXNzTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgY29uc3QgY2xhc3NTcGVjID0gcmF3ID8gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCkgOiB7IGNsYXNzT2JqIH07XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIHNvdXJjZSBub2RlIGNsYXNzIHRvIHRoZSBlZGdlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZSdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHNvdXJjZSBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3NvdXJjZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgIC8vIENvbm5lY3QgdGhlIGVkZ2UgY2xhc3MgdG8gdGhlIHRhcmdldCBub2RlIGNsYXNzXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCdcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhIFwicG90ZW50aWFsXCIgY29ubmVjdGlvbiArIGR1bW15IHRhcmdldCBjbGFzc1xuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICBsb2NhdGlvbjogJ3RhcmdldCcsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLmNsYXNzZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0TW9kZWxEdW1wICgpIHtcbiAgICAvLyBCZWNhdXNlIG9iamVjdCBrZXkgb3JkZXJzIGFyZW4ndCBkZXRlcm1pbmlzdGljLCBpdCBjYW4gYmUgcHJvYmxlbWF0aWNcbiAgICAvLyBmb3IgdGVzdGluZyAoYmVjYXVzZSBpZHMgY2FuIHJhbmRvbWx5IGNoYW5nZSBmcm9tIHRlc3QgcnVuIHRvIHRlc3QgcnVuKS5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNvcnRzIGVhY2gga2V5LCBhbmQganVzdCByZXBsYWNlcyBJRHMgd2l0aCBpbmRleCBudW1iZXJzXG4gICAgY29uc3QgcmF3T2JqID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh0aGlzLl90b1Jhd09iamVjdCgpKSk7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgY2xhc3NlczogT2JqZWN0LnZhbHVlcyhyYXdPYmouY2xhc3Nlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMuY2xhc3Nlc1thLmNsYXNzSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGNvbnN0IGJIYXNoID0gdGhpcy5jbGFzc2VzW2IuY2xhc3NJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgaWYgKGFIYXNoIDwgYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0gZWxzZSBpZiAoYUhhc2ggPiBiSGFzaCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3MgaGFzaCBjb2xsaXNpb25gKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXMocmF3T2JqLnRhYmxlcykuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICBjb25zdCBhSGFzaCA9IHRoaXMudGFibGVzW2EudGFibGVJZF0uZ2V0U29ydEhhc2goKTtcbiAgICAgICAgY29uc3QgYkhhc2ggPSB0aGlzLnRhYmxlc1tiLnRhYmxlSWRdLmdldFNvcnRIYXNoKCk7XG4gICAgICAgIGlmIChhSGFzaCA8IGJIYXNoKSB7XG4gICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9IGVsc2UgaWYgKGFIYXNoID4gYkhhc2gpIHtcbiAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHRhYmxlIGhhc2ggY29sbGlzaW9uYCk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgICBjb25zdCBjbGFzc0xvb2t1cCA9IHt9O1xuICAgIGNvbnN0IHRhYmxlTG9va3VwID0ge307XG4gICAgcmVzdWx0LmNsYXNzZXMuZm9yRWFjaCgoY2xhc3NPYmosIGluZGV4KSA9PiB7XG4gICAgICBjbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGluZGV4O1xuICAgIH0pO1xuICAgIHJlc3VsdC50YWJsZXMuZm9yRWFjaCgodGFibGUsIGluZGV4KSA9PiB7XG4gICAgICB0YWJsZUxvb2t1cFt0YWJsZS50YWJsZUlkXSA9IGluZGV4O1xuICAgIH0pO1xuXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiByZXN1bHQudGFibGVzKSB7XG4gICAgICB0YWJsZS50YWJsZUlkID0gdGFibGVMb29rdXBbdGFibGUudGFibGVJZF07XG4gICAgICBmb3IgKGNvbnN0IHRhYmxlSWQgb2YgT2JqZWN0LmtleXModGFibGUuZGVyaXZlZFRhYmxlcykpIHtcbiAgICAgICAgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUxvb2t1cFt0YWJsZUlkXV0gPSB0YWJsZS5kZXJpdmVkVGFibGVzW3RhYmxlSWRdO1xuICAgICAgICBkZWxldGUgdGFibGUuZGVyaXZlZFRhYmxlc1t0YWJsZUlkXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSB0YWJsZS5kYXRhOyAvLyBkb24ndCBpbmNsdWRlIGFueSBvZiB0aGUgZGF0YTsgd2UganVzdCB3YW50IHRoZSBtb2RlbCBzdHJ1Y3R1cmVcbiAgICB9XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiByZXN1bHQuY2xhc3Nlcykge1xuICAgICAgY2xhc3NPYmouY2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLmNsYXNzSWRdO1xuICAgICAgY2xhc3NPYmoudGFibGVJZCA9IHRhYmxlTG9va3VwW2NsYXNzT2JqLnRhYmxlSWRdO1xuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzID0gY2xhc3NPYmouc291cmNlVGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldENsYXNzSWQpIHtcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZCA9IGNsYXNzTG9va3VwW2NsYXNzT2JqLnRhcmdldENsYXNzSWRdO1xuICAgICAgfVxuICAgICAgaWYgKGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzKSB7XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzID0gY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMubWFwKHRhYmxlSWQgPT4gdGFibGVMb29rdXBbdGFibGVJZF0pO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBjbGFzc0lkIG9mIE9iamVjdC5rZXlzKGNsYXNzT2JqLmVkZ2VDbGFzc0lkcyB8fCB7fSkpIHtcbiAgICAgICAgY2xhc3NPYmouZWRnZUNsYXNzSWRzW2NsYXNzTG9va3VwW2NsYXNzSWRdXSA9IGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgICAgZGVsZXRlIGNsYXNzT2JqLmVkZ2VDbGFzc0lkc1tjbGFzc0lkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBjcmVhdGVTY2hlbWFNb2RlbCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB0aGlzLmdldE1vZGVsRHVtcCgpO1xuXG4gICAgZ3JhcGgudGFibGVzLmZvckVhY2godGFibGUgPT4ge1xuICAgICAgdGFibGUuZGVyaXZlZFRhYmxlcyA9IE9iamVjdC5rZXlzKHRhYmxlLmRlcml2ZWRUYWJsZXMpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3TW9kZWwgPSB0aGlzLl9vcmlncmFwaC5jcmVhdGVNb2RlbCh7IG5hbWU6IHRoaXMubmFtZSArICdfc2NoZW1hJyB9KTtcbiAgICBjb25zdCByYXcgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaCxcbiAgICAgIG5hbWU6ICdSYXcgRHVtcCdcbiAgICB9KTtcbiAgICBsZXQgWyBjbGFzc2VzLCB0YWJsZXMgXSA9IHJhdy5jbG9zZWRUcmFuc3Bvc2UoWydjbGFzc2VzJywgJ3RhYmxlcyddKTtcbiAgICBjbGFzc2VzID0gY2xhc3Nlcy5pbnRlcnByZXRBc05vZGVzKCk7XG4gICAgY2xhc3Nlcy5zZXRDbGFzc05hbWUoJ0NsYXNzZXMnKTtcbiAgICByYXcuZGVsZXRlKCk7XG5cbiAgICBjb25zdCBzb3VyY2VDbGFzc2VzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IGNsYXNzZXMsXG4gICAgICBhdHRyaWJ1dGU6ICdzb3VyY2VDbGFzc0lkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgc291cmNlQ2xhc3Nlcy5zZXRDbGFzc05hbWUoJ1NvdXJjZSBDbGFzcycpO1xuICAgIHNvdXJjZUNsYXNzZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG4gICAgY29uc3QgdGFyZ2V0Q2xhc3NlcyA9IGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBjbGFzc2VzLFxuICAgICAgYXR0cmlidXRlOiAndGFyZ2V0Q2xhc3NJZCcsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhcmdldENsYXNzZXMuc2V0Q2xhc3NOYW1lKCdUYXJnZXQgQ2xhc3MnKTtcbiAgICB0YXJnZXRDbGFzc2VzLnRvZ2dsZURpcmVjdGlvbigpO1xuXG4gICAgdGFibGVzID0gdGFibGVzLmludGVycHJldEFzTm9kZXMoKTtcbiAgICB0YWJsZXMuc2V0Q2xhc3NOYW1lKCdUYWJsZXMnKTtcblxuICAgIGNvbnN0IHRhYmxlRGVwZW5kZW5jaWVzID0gdGFibGVzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogdGFibGVzLFxuICAgICAgYXR0cmlidXRlOiAnZGVyaXZlZFRhYmxlcycsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHRhYmxlRGVwZW5kZW5jaWVzLnNldENsYXNzTmFtZSgnSXMgUGFyZW50IE9mJyk7XG4gICAgdGFibGVEZXBlbmRlbmNpZXMudG9nZ2xlRGlyZWN0aW9uKCk7XG5cbiAgICBjb25zdCBjb3JlVGFibGVzID0gY2xhc3Nlcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IHRhYmxlcyxcbiAgICAgIGF0dHJpYnV0ZTogJ3RhYmxlSWQnLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICBjb3JlVGFibGVzLnNldENsYXNzTmFtZSgnQ29yZSBUYWJsZScpO1xuICAgIHJldHVybiBuZXdNb2RlbDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgTmV0d29ya01vZGVsO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgTmV0d29ya01vZGVsIGZyb20gJy4vQ29tbW9uL05ldHdvcmtNb2RlbC5qcyc7XG5cbmxldCBORVhUX01PREVMX0lEID0gMTtcblxuY2xhc3MgT3JpZ3JhcGggZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yIChsb2NhbFN0b3JhZ2UpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubG9jYWxTdG9yYWdlID0gbG9jYWxTdG9yYWdlOyAvLyBvbmx5IGRlZmluZWQgaW4gdGhlIGJyb3dzZXIgY29udGV4dFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgLypcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IG1vZGVscyA9IHt9O1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMubW9kZWxzKSkge1xuICAgICAgICBtb2RlbHNbbW9kZWxJZF0gPSBtb2RlbC5fdG9SYXdPYmplY3QoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oJ29yaWdyYXBoX21vZGVscycsIEpTT04uc3RyaW5naWZ5KG1vZGVscykpO1xuICAgICAgdGhpcy50cmlnZ2VyKCdzYXZlJyk7XG4gICAgfVxuICAgICovXG4gIH1cbiAgY2xvc2VDdXJyZW50TW9kZWwgKCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGdldCBjdXJyZW50TW9kZWwgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1t0aGlzLl9jdXJyZW50TW9kZWxJZF0gfHwgbnVsbDtcbiAgfVxuICBzZXQgY3VycmVudE1vZGVsIChtb2RlbCkge1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbW9kZWwgPyBtb2RlbC5tb2RlbElkIDogbnVsbDtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICB9XG4gIGFzeW5jIGxvYWRNb2RlbCAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld01vZGVsID0gdGhpcy5jcmVhdGVNb2RlbCh7IG1vZGVsSWQ6IG9wdGlvbnMubmFtZSB9KTtcbiAgICBhd2FpdCBuZXdNb2RlbC5hZGRUZXh0RmlsZShvcHRpb25zKTtcbiAgICByZXR1cm4gbmV3TW9kZWw7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImV2ZW50IiwibmFtZXNwYWNlIiwic3BsaXQiLCJwdXNoIiwib2ZmIiwiaW5kZXgiLCJpbmRleE9mIiwic3BsaWNlIiwidHJpZ2dlciIsImFyZ3MiLCJoYW5kbGVDYWxsYmFjayIsInNldFRpbWVvdXQiLCJhcHBseSIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwic3RpY2t5VHJpZ2dlciIsImFyZ09iaiIsImRlbGF5IiwiYXNzaWduIiwiY2xlYXJUaW1lb3V0IiwidGltZW91dCIsImRlZmluZVByb3BlcnR5IiwiU3ltYm9sIiwiaGFzSW5zdGFuY2UiLCJ2YWx1ZSIsImkiLCJJbnRyb3NwZWN0YWJsZSIsInR5cGUiLCJsb3dlckNhbWVsQ2FzZVR5cGUiLCJodW1hblJlYWRhYmxlVHlwZSIsImNvbmZpZ3VyYWJsZSIsImdldCIsInRlbXAiLCJyZXBsYWNlIiwidG9Mb2NhbGVMb3dlckNhc2UiLCJHZW5lcmljV3JhcHBlciIsIm9wdGlvbnMiLCJ0YWJsZSIsInVuZGVmaW5lZCIsIkVycm9yIiwiY2xhc3NPYmoiLCJyb3ciLCJjb25uZWN0ZWRJdGVtcyIsImR1cGxpY2F0ZUl0ZW1zIiwicmVnaXN0ZXJEdXBsaWNhdGUiLCJpdGVtIiwiY29ubmVjdEl0ZW0iLCJ0YWJsZUlkIiwiZHVwIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJleHBvcnRJZCIsImxhYmVsIiwiYW5ub3RhdGlvbnMiLCJsYWJlbEF0dHIiLCJlcXVhbHMiLCJoYW5kbGVMaW1pdCIsIml0ZXJhdG9ycyIsImxpbWl0IiwiSW5maW5pdHkiLCJpdGVyYXRvciIsIml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsInRhYmxlSWRzIiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJyZXNldCIsIm5leHRUYWJsZUlkIiwibGVuZ3RoIiwicmVtYWluaW5nVGFibGVJZHMiLCJzbGljZSIsImV4ZWMiLCJuYW1lIiwiVGFibGUiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImh5ZHJhdGVGdW5jdGlvbiIsIl9zdXBwcmVzc2VkQXR0cmlidXRlcyIsInN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiX3N1cHByZXNzSW5kZXgiLCJzdXBwcmVzc0luZGV4IiwiX2luZGV4RmlsdGVyIiwiaW5kZXhGaWx0ZXIiLCJfYXR0cmlidXRlRmlsdGVycyIsImF0dHJpYnV0ZUZpbHRlcnMiLCJfbGltaXRQcm9taXNlcyIsIl90b1Jhd09iamVjdCIsInJlc3VsdCIsIl9hdHRyaWJ1dGVzIiwiZGVoeWRyYXRlRnVuY3Rpb24iLCJmdW5jIiwiZ2V0U29ydEhhc2giLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsIl9jYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJyZXNvbHZlIiwicmVqZWN0IiwiX2l0ZXJhdGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGVMb29rdXAiLCJkb25lIiwibmV4dCIsImhhbmRsZVJlc2V0IiwiX2ZpbmlzaEl0ZW0iLCJOdW1iZXIiLCJfY2FjaGVMb29rdXAiLCJfY2FjaGVQcm9taXNlIiwiaXRlbXNUb1Jlc2V0IiwiY29uY2F0IiwiZGVyaXZlZFRhYmxlIiwiY291bnRSb3dzIiwid3JhcHBlZEl0ZW0iLCJkZWxheWVkUm93Iiwia2VlcCIsIl93cmFwIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJsb29rdXAiLCJjb21wbGV0ZSIsIl9nZXRJdGVtIiwiZ2V0SXRlbSIsImdldFJhbmRvbUl0ZW0iLCJyYW5kSW5kZXgiLCJNYXRoIiwiZmxvb3IiLCJyYW5kb20iLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJ1blN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiZmlsdGVyIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJ1blN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsIl9nZXRFeGlzdGluZ1RhYmxlIiwiZXhpc3RpbmdUYWJsZSIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwicHJvbW90ZSIsImV4cGFuZCIsInVucm9sbCIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJkdXBsaWNhdGUiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwicHJvamVjdCIsInRhYmxlT3JkZXIiLCJvdGhlclRhYmxlSWQiLCJjbGFzc2VzIiwicGFyZW50VGFibGVzIiwicmVkdWNlIiwiYWdnIiwiaW5Vc2UiLCJzb21lIiwic291cmNlVGFibGVJZHMiLCJ0YXJnZXRUYWJsZUlkcyIsImRlbGV0ZSIsImZvcmNlIiwiZXJyIiwicGFyZW50VGFibGUiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBdHRyVGFibGVNaXhpbiIsIl9pbnN0YW5jZU9mQXR0clRhYmxlTWl4aW4iLCJfYXR0cmlidXRlIiwiUHJvbW90ZWRUYWJsZSIsIl91bmZpbmlzaGVkQ2FjaGUiLCJfdW5maW5pc2hlZENhY2hlTG9va3VwIiwid3JhcHBlZFBhcmVudCIsIlN0cmluZyIsImV4aXN0aW5nSXRlbSIsIm5ld0l0ZW0iLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJUcmFuc3Bvc2VkVGFibGUiLCJfaW5kZXgiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJwVGFibGUiLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkR1cGxpY2F0ZWRUYWJsZSIsIkNoaWxkVGFibGVNaXhpbiIsIl9pbnN0YW5jZU9mQ2hpbGRUYWJsZU1peGluIiwicGFyZW50SW5kZXgiLCJFeHBhbmRlZFRhYmxlIiwiVW5yb2xsZWRUYWJsZSIsInJvd3MiLCJQYXJlbnRDaGlsZFRhYmxlIiwiY2hpbGRUYWJsZSIsImNoaWxkIiwicGFyZW50IiwiUHJvamVjdGVkVGFibGUiLCJzZWxmIiwiZmlyc3RUYWJsZSIsInJlbWFpbmluZ0lkcyIsInNvdXJjZUl0ZW0iLCJsYXN0SXRlbSIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJzZXRDbGFzc05hbWUiLCJzZXRBbm5vdGF0aW9uIiwia2V5IiwiZGVsZXRlQW5ub3RhdGlvbiIsImhhc0N1c3RvbU5hbWUiLCJ2YXJpYWJsZU5hbWUiLCJkIiwidG9Mb2NhbGVVcHBlckNhc2UiLCJkZWxldGVkIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm92ZXJ3cml0ZSIsImNyZWF0ZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsImludGVycHJldEFzR2VuZXJpYyIsIm9wdGltaXplVGFibGVzIiwiY291bnRBbGxVbmlxdWVWYWx1ZXMiLCJoYXNoYWJsZUJpbnMiLCJ1bkhhc2hhYmxlQ291bnRzIiwiaW5kZXhCaW4iLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImNsYXNzSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwicm9sZSIsImdldEVkZ2VSb2xlIiwicmV2ZXJzZSIsIm5laWdoYm9yTm9kZXMiLCJlZGdlIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXQiLCJzb3VyY2VOb2RlcyIsInNvdXJjZSIsIm5laWdoYm9ycyIsInBhaXJ3aXNlTmVpZ2hib3Job29kIiwiTm9kZUNsYXNzIiwiZWRnZUNsYXNzZXMiLCJlZGdlQ2xhc3NJZCIsInNvdXJjZUNsYXNzSWQiLCJ0YXJnZXRDbGFzc0lkIiwiY2FuQXV0b0Nvbm5lY3QiLCJhbGxSb2xlcyIsImlkIiwiYXV0b2Nvbm5lY3QiLCJyb2xlcyIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsIm15U291cmNlUm9sZSIsInRhcmdldEVkZ2VDbGFzcyIsIm15VGFyZ2V0Um9sZSIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY3JlYXRlU3VwZXJub2RlcyIsImV4aXN0aW5nRWRnZUNsYXNzSWRzIiwicHJvamVjdE5ld0VkZ2UiLCJjb25uZWN0VG9DaGlsZE5vZGVDbGFzcyIsImNoaWxkQ2xhc3MiLCJjbGFzc0lkTGlzdCIsImNsYXNzTGlzdCIsImVkZ2VSb2xlIiwiQXJyYXkiLCJmcm9tIiwibmV3Q2xhc3MiLCJjb25uZWN0ZWRDbGFzc2VzIiwiRWRnZVdyYXBwZXIiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0VGFibGVJZCIsIm5vZGVzIiwiRWRnZUNsYXNzIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsIl9zcGxpdFRhYmxlSWRMaXN0Iiwib3RoZXJDbGFzcyIsIm5vZGVUYWJsZUlkTGlzdCIsImVkZ2VUYWJsZUlkIiwiZWRnZVRhYmxlSWRMaXN0Iiwic3RhdGljRXhpc3RzIiwidGFibGVEaXN0YW5jZXMiLCJzdGFydHNXaXRoIiwiZGlzdCIsImFicyIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJyb2xsdXAiLCJjb25uZWN0RmFjZXRlZENsYXNzIiwibmV3Q2xhc3NlcyIsIkZpbGVGb3JtYXQiLCJidWlsZFJvdyIsIlBhcnNlRmFpbHVyZSIsImZpbGVGb3JtYXQiLCJOT0RFX05BTUVTIiwiRURHRV9OQU1FUyIsIkQzSnNvbiIsImltcG9ydERhdGEiLCJ0ZXh0Iiwic291cmNlQXR0cmlidXRlIiwidGFyZ2V0QXR0cmlidXRlIiwiY2xhc3NBdHRyaWJ1dGUiLCJKU09OIiwicGFyc2UiLCJub2RlTmFtZSIsImVkZ2VOYW1lIiwiY29yZVRhYmxlIiwiY29yZUNsYXNzIiwibm9kZUNsYXNzZXMiLCJub2RlQ2xhc3NMb29rdXAiLCJzYW1wbGUiLCJzb3VyY2VDbGFzc05hbWUiLCJ0YXJnZXRDbGFzc05hbWUiLCJmb3JtYXREYXRhIiwiaW5jbHVkZUNsYXNzZXMiLCJwcmV0dHkiLCJyYXdUZXh0IiwibGlua3MiLCJub2RlTG9va3VwIiwib3RoZXIiLCJub2RlIiwic3RyaW5naWZ5IiwiQnVmZmVyIiwiZXh0ZW5zaW9uIiwiQ3N2WmlwIiwiaW5kZXhOYW1lIiwiemlwIiwiSlNaaXAiLCJjb250ZW50cyIsImZpbGUiLCJnZW5lcmF0ZUFzeW5jIiwiZXNjYXBlQ2hhcnMiLCJHRVhGIiwiZXNjYXBlIiwic3RyIiwicmVwbCIsImV4cCIsIm5vZGVDaHVuayIsImVkZ2VDaHVuayIsIkRBVEFMSUJfRk9STUFUUyIsIk5ldHdvcmtNb2RlbCIsIm9yaWdyYXBoIiwibW9kZWxJZCIsIl9vcmlncmFwaCIsIl9uZXh0Q2xhc3NJZCIsIl9uZXh0VGFibGVJZCIsImh5ZHJhdGUiLCJDTEFTU0VTIiwiVEFCTEVTIiwiX3NhdmVUaW1lb3V0Iiwic2F2ZSIsInVuc2F2ZWQiLCJyYXdPYmplY3QiLCJUWVBFUyIsImZpbmRDbGFzcyIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImRlbGV0ZU1vZGVsIiwibW9kZWxzIiwiYWRkVGV4dEZpbGUiLCJmb3JtYXQiLCJtaW1lIiwiRklMRV9GT1JNQVRTIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJ0YWJsZXNJblVzZSIsInBhcmVudHNWaXNpdGVkIiwicXVldWUiLCJzaGlmdCIsImdldEluc3RhbmNlU2FtcGxlIiwic2VlZExpbWl0IiwiY2x1c3RlckxpbWl0IiwiY2xhc3NDb3VudCIsIml0ZXJhdGlvblJlc2V0IiwiaW5zdGFuY2VzIiwidG90YWxDb3VudCIsImNsYXNzQ291bnRzIiwicG9wdWxhdGVDbGFzc0NvdW50cyIsImluc3RhbmNlIiwibmVpZ2hib3IiLCJyb3dDb3VudCIsInZhbGlkYXRlSW5zdGFuY2VTYW1wbGUiLCJ1cGRhdGVJbnN0YW5jZVNhbXBsZSIsIm5ld0luc3RhbmNlIiwicGFydGl0aW9uSW5zdGFuY2VTYW1wbGUiLCJnZW5lcmljcyIsImZpbGxJbnN0YW5jZVNhbXBsZSIsImV4dHJhTm9kZXMiLCJleHRyYUVkZ2VzIiwic2VlZFNpZGUiLCJpdGVyRnVuYyIsImFOb2RlIiwiaXNTZWVkZWQiLCJjb25uZWN0c1NvdXJjZSIsImNvbm5lY3RzVGFyZ2V0IiwiaW5zdGFuY2VTYW1wbGVUb0dyYXBoIiwiZ3JhcGgiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsInNvdXJjZU5vZGUiLCJ0YXJnZXROb2RlIiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJyYXciLCJpbmNsdWRlRHVtbWllcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRNb2RlbER1bXAiLCJyYXdPYmoiLCJhSGFzaCIsImJIYXNoIiwiY3JlYXRlU2NoZW1hTW9kZWwiLCJuZXdNb2RlbCIsImNyZWF0ZU1vZGVsIiwic291cmNlQ2xhc3NlcyIsInRhcmdldENsYXNzZXMiLCJ0YWJsZURlcGVuZGVuY2llcyIsImNvcmVUYWJsZXMiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwiZXhpc3RpbmdNb2RlbHMiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsImNsb3NlQ3VycmVudE1vZGVsIiwiY3VycmVudE1vZGVsIiwibG9hZE1vZGVsIiwiY3VycmVudE1vZGVsSWQiLCJkZWxldGVBbGxNb2RlbHMiLCJ3aW5kb3ciLCJ2ZXJzaW9uIiwicGtnIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7V0FDS0MsZUFBTCxHQUF1QixFQUF2Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ25CLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxLQUFWLENBQWdCLEdBQWhCLENBQXpCO1dBQ0tQLGNBQUwsQ0FBb0JLLEtBQXBCLElBQTZCLEtBQUtMLGNBQUwsQ0FBb0JLLEtBQXBCLEtBQzNCO1lBQU07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
