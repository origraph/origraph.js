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
  }

  connectItem(item) {
    this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

    if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
      this.connectedItems[item.table.tableId].push(item);
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

  iterateAcrossConnections({
    tableIds,
    limit = Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // First make sure that all the table caches have been fully built and
      // connected
      yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
        return _this.classObj.model.tables[tableId].buildCache();
      })));
      let i = 0;

      for (const item of _this._iterateAcrossConnections(tableIds)) {
        yield item;
        i++;

        if (i >= limit) {
          return;
        }
      }
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
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
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

  hydrateFunction(stringifiedFunc) {
    new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
  }

  dehydrateFunction(func) {
    let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
    // included in the stringification process during testing. See:
    // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

    stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
    return stringifiedFunc;
  }

  iterate(options = {}) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Generic caching stuff; this isn't just for performance. ConnectedTable's
      // algorithm requires that its parent tables have pre-built indexes (we
      // technically could implement it differently, but it would be expensive,
      // requires tricky logic, and we're already building indexes for some tables
      // like AggregatedTable anyway)
      if (options.reset) {
        _this.reset();
      }

      if (_this._cache) {
        const limit = options.limit === undefined ? Infinity : options.limit;
        yield* _asyncGeneratorDelegate(_asyncIterator(Object.values(_this._cache).slice(0, limit)), _awaitAsyncGenerator);
        return;
      }

      yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(_this._buildCache(options)))), _awaitAsyncGenerator);
    })();
  }

  _buildCache(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      // TODO: in large data scenarios, we should build the cache / index
      // externally on disk
      _this2._partialCache = {};
      const limit = options.limit === undefined ? Infinity : options.limit;
      delete options.limit;

      const iterator = _this2._iterate(options);

      let completed = false;

      for (let i = 0; i < limit; i++) {
        const temp = yield _awaitAsyncGenerator(iterator.next());

        if (!_this2._partialCache) {
          // iteration was cancelled; return immediately
          return;
        }

        if (temp.done) {
          completed = true;
          break;
        } else {
          _this2._finishItem(temp.value);

          _this2._partialCache[temp.value.index] = temp.value;
          yield temp.value;
        }
      }

      if (completed) {
        _this2._cache = _this2._partialCache;
      }

      delete _this2._partialCache;
    })();
  }

  _iterate(options) {
    return _wrapAsyncGenerator(function* () {
      throw new Error(`this function should be overridden`);
    })();
  }

  _finishItem(wrappedItem) {
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
      keep = keep && func(wrappedItem.row[attr]);

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

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async buildCache() {
    if (this._cache) {
      return this._cache;
    } else if (this._cachePromise) {
      return this._cachePromise;
    } else {
      this._cachePromise = new Promise(async (resolve, reject) => {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(this._buildCache()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          } // eslint-disable-line no-unused-vars

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

        delete this._cachePromise;
        resolve(this._cache);
      });
      return this._cachePromise;
    }
  }

  async countRows() {
    const cache = await this.buildCache();
    return cache ? Object.keys(cache).length : -1;
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
    return {
      data: this._cache || this._partialCache || {},
      complete: !!this._cache
    };
  }

  deriveAttribute(attribute, func) {
    this._derivedAttributeFunctions[attribute] = func;
    this.reset();
  }

  suppressAttribute(attribute) {
    if (attribute === null) {
      this._suppressIndex = true;
    } else {
      this._suppressedAttributes[attribute] = true;
    }

    this.reset();
  }

  addFilter(attribute, func) {
    if (attribute === null) {
      this._indexFilter = func;
    } else {
      this._attributeFilters[attribute] = func;
    }

    this.reset();
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

  aggregate(attribute) {
    const options = {
      type: 'AggregatedTable',
      attribute
    };
    return this._getExistingTable(options) || this._deriveTable(options);
  }

  expand(attribute, delimiter) {
    const options = {
      type: 'ExpandedTable',
      attribute,
      delimiter
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
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      const values = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this3.iterate({
          limit
        })), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedItem = _value2;
          const value = wrappedItem.row[attribute];

          if (!values[value]) {
            values[value] = true;
            const options = {
              type: 'FacetedTable',
              attribute,
              value
            };
            yield _this3._getExistingTable(options) || _this3._deriveTable(options);
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
    var _this4 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(_this4.iterate({
          limit
        })), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const wrappedItem = _value3;
          const options = {
            type: 'TransposedTable',
            index: wrappedItem.index
          };
          yield _this4._getExistingTable(options) || _this4._deriveTable(options);
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (let index = 0; index < _this._data.length; index++) {
        const item = _this._wrap({
          index,
          row: _this._data[index]
        });

        if (_this._finishItem(item)) {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      for (const [index, row] of Object.entries(_this._data)) {
        const item = _this._wrap({
          index,
          row
        });

        if (_this._finishItem(item)) {
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

class AggregatedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this._reduceAttributeFunctions = {};

    for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions || {})) {
      this._reduceAttributeFunctions[attr] = this.model.hydrateFunction(stringifiedFunc);
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this.model._dehydrateFunction(func);
    }

    return obj;
  }

  get name() {
    return '↦' + this._attribute;
  }

  deriveReducedAttribute(attr, func) {
    this._reduceAttributeFunctions[attr] = func;
    this.reset();
  }

  _updateItem(originalWrappedItem, newWrappedItem) {
    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
    }

    originalWrappedItem.trigger('update');
  }

  _buildCache(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // We override _buildCache because so that AggregatedTable can take advantage
      // of the partially-built cache as it goes, and postpone finishing items
      // until after the parent table has been fully iterated
      // TODO: in large data scenarios, we should build the cache / index
      // externally on disk
      _this._partialCache = {};
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this._iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedItem = _value;
          _this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
          // client apps to be more responsive and render partial results, but also
          // means that they need to watch for wrappedItem.on('update') events

          yield wrappedItem;
        } // Second pass: now that we've completed the full iteration of the parent
        // table, we can finish each item

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

      for (const index in _this._partialCache) {
        const wrappedItem = _this._partialCache[index];

        if (!_this._finishItem(wrappedItem)) {
          delete _this._partialCache[index];
        }
      }

      _this._cache = _this._partialCache;
      delete _this._partialCache;
    })();
  }

  _iterate(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      const parentTable = _this2.parentTable;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(parentTable.iterate(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const wrappedParent = _value2;
          const index = String(wrappedParent.row[_this2._attribute]);

          if (!_this2._partialCache) {
            // We were reset; return immediately
            return;
          } else if (_this2._partialCache[index]) {
            const existingItem = _this2._partialCache[index];
            existingItem.connectItem(wrappedParent);
            wrappedParent.connectItem(existingItem);

            _this2._updateItem(existingItem, wrappedParent);
          } else {
            const newItem = _this2._wrap({
              index,
              itemsToConnect: [wrappedParent]
            });

            _this2._updateItem(newItem, wrappedParent);

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
    })();
  }

  getAttributeDetails() {
    const allAttrs = super.getAttributeDetails();

    for (const attr in this._reduceAttributeFunctions) {
      allAttrs[attr] = allAttrs[attr] || {
        name: attr
      };
      allAttrs[attr].reduced = true;
    }

    return allAttrs;
  }

}

class ExpandedTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;

    if (!this._attribute) {
      throw new Error(`attribute is required`);
    }

    this.delimiter = options.delimiter || ',';
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    return obj;
  }

  get name() {
    return this.parentTable.name + '↤';
  }

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;
          const values = (wrappedParent.row[_this._attribute] || '').split(_this.delimiter);

          for (const value of values) {
            const row = {};
            row[_this._attribute] = value;

            const newItem = _this._wrap({
              index,
              row,
              itemsToConnect: [wrappedParent]
            });

            if (_this._finishItem(newItem)) {
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

  get name() {
    return `[${this._value}]`;
  }

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      let index = 0;
      const parentTable = _this.parentTable;
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const wrappedParent = _value;

          if (wrappedParent.row[_this._attribute] === _this._value) {
            // Normal faceting just gives a subset of the original table
            const newItem = _this._wrap({
              index,
              row: Object.assign({}, wrappedParent.row),
              itemsToConnect: [wrappedParent]
            });

            if (_this._finishItem(newItem)) {
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

  get name() {
    return `ᵀ${this._index}`;
  }

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      // Pre-build the parent table's cache
      const parentTable = _this.parentTable;
      yield _awaitAsyncGenerator(parentTable.buildCache()); // Iterate the row's attributes as indexes

      const wrappedParent = parentTable._cache[_this._index] || {
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

        if (_this._finishItem(newItem)) {
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

  _iterate(options) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const parentTables = _this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

      for (const parentTable of parentTables) {
        yield _awaitAsyncGenerator(parentTable.buildCache());
      } // Now that the caches are built, just iterate their keys directly. We only
      // care about including rows that have exact matches across all tables, so
      // we can just pick one parent table to iterate


      const baseParentTable = parentTables[0];
      const otherParentTables = parentTables.slice(1);

      for (const index in baseParentTable._cache) {
        if (!parentTables.every(table => table._cache)) {
          // One of the parent tables was reset; return immediately
          return;
        }

        if (!otherParentTables.every(table => table._cache[index])) {
          // No match in one of the other tables; omit this item
          continue;
        } // TODO: add each parent tables' keys as attribute values


        const newItem = _this._wrap({
          index,
          itemsToConnect: parentTables.map(table => table._cache[index])
        });

        if (_this._finishItem(newItem)) {
          yield newItem;
        }
      }
    })();
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FacetedTable: FacetedTable,
  ConnectedTable: ConnectedTable,
  TransposedTable: TransposedTable
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

  get table() {
    return this.model.tables[this.tableId];
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

  aggregate(attribute) {
    return this._deriveNewClass(this.table.aggregate(attribute));
  }

  expand(attribute, delimiter) {
    return this._deriveNewClass(this.table.expand(attribute, delimiter));
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

  edges(options = {
    limit: Infinity
  }) {
    var _this = this;

    return _wrapAsyncGenerator(function* () {
      const edgeIds = options.edgeIds || _this.classObj.edgeClassIds;
      let i = 0;

      for (const edgeId of Object.keys(edgeIds)) {
        const edgeClass = _this.classObj.model.classes[edgeId];

        if (edgeClass.sourceClassId === _this.classObj.classId) {
          options.tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
        } else {
          options.tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
        }

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(_this.iterateAcrossConnections(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const item = _value;
            yield item;
            i++;

            if (i >= options.limit) {
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

  pairwiseNeighborhood(options) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;

      var _iteratorError2;

      try {
        for (var _iterator2 = _asyncIterator(_this2.edges(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
          const edge = _value2;
          yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
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

}

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
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
      thisHash = this.table.aggregate(attribute);
      sourceTableIds = [thisHash.tableId];
    }

    if (otherAttribute === null) {
      otherHash = otherNodeClass.table;
      targetTableIds = [];
    } else {
      otherHash = otherNodeClass.table.aggregate(otherAttribute);
      targetTableIds = [otherHash.tableId];
    } // If we have a self edge connecting the same attribute, we can just use
    // the AggregatedTable as the edge table; otherwise we need to create a
    // ConnectedTable


    const connectedTable = this === otherNodeClass && attribute === otherAttribute ? thisHash : thisHash.connect([otherHash]);
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

  aggregate(attribute) {
    const newNodeClass = super.aggregate(attribute);
    this.connectToNodeClass({
      otherNodeClass: newNodeClass,
      attribute,
      otherAttribute: null
    });
    return newNodeClass;
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
      if (_this.classObj.sourceClassId === null) {
        return;
      }

      const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;
      options.tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  targetNodes(options = {}) {
    var _this2 = this;

    return _wrapAsyncGenerator(function* () {
      if (_this2.classObj.targetClassId === null) {
        return;
      }

      const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;
      options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
      yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
    })();
  }

  pairwiseEdges(options) {
    var _this3 = this;

    return _wrapAsyncGenerator(function* () {
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;

      var _iteratorError;

      try {
        for (var _iterator = _asyncIterator(_this3.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
          const source = _value;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;

          var _iteratorError2;

          try {
            for (var _iterator2 = _asyncIterator(_this3.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
              const target = _value2;
              yield {
                source,
                edge: _this3,
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

  async hyperedge(options) {
    const result = {
      sources: [],
      targets: [],
      edge: this
    };
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;

    var _iteratorError3;

    try {
      for (var _iterator3 = _asyncIterator(this.sourceNodes(options)), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
        const source = _value3;
        result.push(source);
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
      for (var _iterator4 = _asyncIterator(this.targetNodes(options)), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
        const target = _value4;
        result.push(target);
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
    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.aggregate(nodeAttribute);
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
    const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.aggregate(nodeAttribute);
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
            for (var _iterator5 = _asyncIterator(classObj.table.iterate({
              limit: 5
            })), _step5, _value5; _step5 = await _iterator5.next(), _iteratorNormalCompletion5 = _step5.done, _value5 = await _step5.value, !_iteratorNormalCompletion5; _iteratorNormalCompletion5 = true) {
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
    includeDummies = false
  } = {}) {
    const edgeClasses = [];
    let graph = {
      classes: [],
      classLookup: {},
      classConnections: []
    };
    const classList = Object.values(this.classes);

    for (const classObj of classList) {
      // Add and index the class as a node
      graph.classLookup[classObj.classId] = graph.classes.length;
      const classSpec = raw ? classObj._toRawObject() : {
        classObj
      };
      classSpec.type = classObj.constructor.name;
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

  getFullSchemaGraph() {
    return Object.assign(this.getNetworkModelGraph(), this.getTableDependencyGraph());
  }

  createSchemaModel() {
    const graph = this.getFullSchemaGraph();

    const newModel = this._origraph.createModel({
      name: this.name + '_schema'
    });

    let classes = newModel.addStaticTable({
      data: graph.classes,
      name: 'Classes'
    }).interpretAsNodes();
    let classConnections = newModel.addStaticTable({
      data: graph.classConnections,
      name: 'Class Connections'
    }).interpretAsEdges();
    let tables = newModel.addStaticTable({
      data: graph.tables,
      name: 'Tables'
    }).interpretAsNodes();
    let tableLinks = newModel.addStaticTable({
      data: graph.tableLinks,
      name: 'Table Links'
    }).interpretAsEdges();
    classes.connectToEdgeClass({
      edgeClass: classConnections,
      side: 'source',
      nodeAttribute: null,
      edgeAttribute: 'source'
    });
    classes.connectToEdgeClass({
      edgeClass: classConnections,
      side: 'target',
      nodeAttribute: null,
      edgeAttribute: 'target'
    });
    tables.connectToEdgeClass({
      edgeClass: tableLinks,
      side: 'source',
      nodeAttribute: null,
      edgeAttribute: 'source'
    });
    tables.connectToEdgeClass({
      edgeClass: tableLinks,
      side: 'target',
      nodeAttribute: null,
      edgeAttribute: 'target'
    });
    classes.connectToNodeClass({
      otherNodeClass: tables,
      attribute: 'tableId',
      otherAttribute: 'tableId'
    }).setClassName('Core Tables');
    return newModel;
  }

}

let NEXT_MODEL_ID = 1;

class Origraph extends TriggerableMixin(class {}) {
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

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
    if (this.localStorage) {
      const models = {};

      for (const [modelId, model] of Object.entries(this.models)) {
        models[modelId] = model._toRawObject();
      }

      this.localStorage.setItem('origraph_models', JSON.stringify(models));
      this.trigger('save');
    }
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
var version = "0.2.0";
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
	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGxldCBbZXZlbnQsIG5hbWVzcGFjZV0gPSBldmVudE5hbWUuc3BsaXQoJzonKTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0gfHxcbiAgICAgICAgeyAnJzogW10gfTtcbiAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5wdXNoKGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0gPSBjYWxsYmFjaztcbiAgICAgIH1cbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF0pIHtcbiAgICAgICAgaWYgKCFuYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10gPSBbXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50LCAuLi5hcmdzKSB7XG4gICAgICBjb25zdCBoYW5kbGVDYWxsYmFjayA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGZvciAoY29uc3QgbmFtZXNwYWNlIG9mIE9iamVjdC5rZXlzKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSkge1xuICAgICAgICAgIGlmIChuYW1lc3BhY2UgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10uZm9yRWFjaChoYW5kbGVDYWxsYmFjayk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUNhbGxiYWNrKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdW25hbWVzcGFjZV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXSA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gfHwgeyBhcmdPYmo6IHt9IH07XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQpO1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMudGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICBsZXQgYXJnT2JqID0gdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdO1xuICAgICAgICB0aGlzLnRyaWdnZXIoZXZlbnROYW1lLCBhcmdPYmopO1xuICAgICAgfSwgZGVsYXkpO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVHJpZ2dlcmFibGVNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVHJpZ2dlcmFibGVNaXhpbjtcbiIsImNsYXNzIEludHJvc3BlY3RhYmxlIHtcbiAgZ2V0IHR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLnR5cGU7XG4gIH1cbiAgZ2V0IGxvd2VyQ2FtZWxDYXNlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IubG93ZXJDYW1lbENhc2VUeXBlO1xuICB9XG4gIGdldCBodW1hblJlYWRhYmxlVHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IuaHVtYW5SZWFkYWJsZVR5cGU7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ3R5cGUnLCB7XG4gIC8vIFRoaXMgY2FuIC8gc2hvdWxkIGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3NlcyB0aGF0IGZvbGxvdyBhIGNvbW1vbiBzdHJpbmdcbiAgLy8gcGF0dGVybiwgc3VjaCBhcyBSb290VG9rZW4sIEtleXNUb2tlbiwgUGFyZW50VG9rZW4sIGV0Yy5cbiAgY29uZmlndXJhYmxlOiB0cnVlLFxuICBnZXQgKCkgeyByZXR1cm4gdGhpcy50eXBlOyB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2xvd2VyQ2FtZWxDYXNlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy50eXBlO1xuICAgIHJldHVybiB0ZW1wLnJlcGxhY2UoLy4vLCB0ZW1wWzBdLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyb3NwZWN0YWJsZSwgJ2h1bWFuUmVhZGFibGVUeXBlJywge1xuICBnZXQgKCkge1xuICAgIC8vIENhbWVsQ2FzZSB0byBTZW50ZW5jZSBDYXNlXG4gICAgcmV0dXJuIHRoaXMudHlwZS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCAnJDEgJDInKTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBJbnRyb3NwZWN0YWJsZTtcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuXG5jbGFzcyBHZW5lcmljV3JhcHBlciBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuaW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIHRoaXMudGFibGUgPSBvcHRpb25zLnRhYmxlO1xuICAgIGlmICh0aGlzLmluZGV4ID09PSB1bmRlZmluZWQgfHwgIXRoaXMudGFibGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggYW5kIHRhYmxlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLmNsYXNzT2JqID0gb3B0aW9ucy5jbGFzc09iaiB8fCBudWxsO1xuICAgIHRoaXMucm93ID0gb3B0aW9ucy5yb3cgfHwge307XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtcyA9IG9wdGlvbnMuY29ubmVjdGVkSXRlbXMgfHwge307XG4gIH1cbiAgY29ubmVjdEl0ZW0gKGl0ZW0pIHtcbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gPSB0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0gfHwgW107XG4gICAgaWYgKHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5pbmRleE9mKGl0ZW0pID09PSAtMSkge1xuICAgICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdLnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG4gIGRpc2Nvbm5lY3QgKCkge1xuICAgIGZvciAoY29uc3QgaXRlbUxpc3Qgb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNvbm5lY3RlZEl0ZW1zKSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1MaXN0KSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gKGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXSB8fCBbXSkuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICAgIGl0ZW0uY29ubmVjdGVkSXRlbXNbdGhpcy50YWJsZS50YWJsZUlkXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSB7fTtcbiAgfVxuICBnZXQgaW5zdGFuY2VJZCAoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuY2xhc3NPYmouY2xhc3NJZH1fJHt0aGlzLmluZGV4fWA7XG4gIH1cbiAgZXF1YWxzIChpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VJZCA9PT0gaXRlbS5pbnN0YW5jZUlkO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh7IHRhYmxlSWRzLCBsaW1pdCA9IEluZmluaXR5IH0pIHtcbiAgICAvLyBGaXJzdCBtYWtlIHN1cmUgdGhhdCBhbGwgdGhlIHRhYmxlIGNhY2hlcyBoYXZlIGJlZW4gZnVsbHkgYnVpbHQgYW5kXG4gICAgLy8gY29ubmVjdGVkXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwodGFibGVJZHMubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuY2xhc3NPYmoubW9kZWwudGFibGVzW3RhYmxlSWRdLmJ1aWxkQ2FjaGUoKTtcbiAgICB9KSk7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnModGFibGVJZHMpKSB7XG4gICAgICB5aWVsZCBpdGVtO1xuICAgICAgaSsrO1xuICAgICAgaWYgKGkgPj0gbGltaXQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIF9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMgKHRhYmxlSWRzKSB7XG4gICAgaWYgKHRhYmxlSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgeWllbGQgKiAodGhpcy5jb25uZWN0ZWRJdGVtc1t0YWJsZUlkc1swXV0gfHwgW10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0aGlzVGFibGVJZCA9IHRhYmxlSWRzWzBdO1xuICAgICAgY29uc3QgcmVtYWluaW5nVGFibGVJZHMgPSB0YWJsZUlkcy5zbGljZSgxKTtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmNvbm5lY3RlZEl0ZW1zW3RoaXNUYWJsZUlkXSB8fCBbXSkge1xuICAgICAgICB5aWVsZCAqIGl0ZW0uX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhyZW1haW5pbmdUYWJsZUlkcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY1dyYXBwZXIsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVdyYXBwZXIvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljV3JhcHBlcjtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgVGFibGUgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5hdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcyA9IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cblxuICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzID0gb3B0aW9ucy5zdXBwcmVzc2VkQXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gISFvcHRpb25zLnN1cHByZXNzSW5kZXg7XG5cbiAgICB0aGlzLl9pbmRleEZpbHRlciA9IChvcHRpb25zLmluZGV4RmlsdGVyICYmIHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKG9wdGlvbnMuaW5kZXhGaWx0ZXIpKSB8fCBudWxsO1xuICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuYXR0cmlidXRlRmlsdGVycyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGF0dHJpYnV0ZXM6IHRoaXMuX2F0dHJpYnV0ZXMsXG4gICAgICBkZXJpdmVkVGFibGVzOiB0aGlzLl9kZXJpdmVkVGFibGVzLFxuICAgICAgdXNlZEJ5Q2xhc3NlczogdGhpcy5fdXNlZEJ5Q2xhc3NlcyxcbiAgICAgIGRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnM6IHt9LFxuICAgICAgc3VwcHJlc3NlZEF0dHJpYnV0ZXM6IHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzLFxuICAgICAgc3VwcHJlc3NJbmRleDogdGhpcy5fc3VwcHJlc3NJbmRleCxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcnM6IHt9LFxuICAgICAgaW5kZXhGaWx0ZXI6ICh0aGlzLl9pbmRleEZpbHRlciAmJiB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKHRoaXMuX2luZGV4RmlsdGVyKSkgfHwgbnVsbFxuICAgIH07XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIHJlc3VsdC5hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBoeWRyYXRlRnVuY3Rpb24gKHN0cmluZ2lmaWVkRnVuYykge1xuICAgIG5ldyBGdW5jdGlvbihgcmV0dXJuICR7c3RyaW5naWZpZWRGdW5jfWApKCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbmV3LWZ1bmNcbiAgfVxuICBkZWh5ZHJhdGVGdW5jdGlvbiAoZnVuYykge1xuICAgIGxldCBzdHJpbmdpZmllZEZ1bmMgPSBmdW5jLnRvU3RyaW5nKCk7XG4gICAgLy8gSXN0YW5idWwgYWRkcyBzb21lIGNvZGUgdG8gZnVuY3Rpb25zIGZvciBjb21wdXRpbmcgY292ZXJhZ2UsIHRoYXQgZ2V0c1xuICAgIC8vIGluY2x1ZGVkIGluIHRoZSBzdHJpbmdpZmljYXRpb24gcHJvY2VzcyBkdXJpbmcgdGVzdGluZy4gU2VlOlxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9nb3R3YXJsb3N0L2lzdGFuYnVsL2lzc3Vlcy8zMTAjaXNzdWVjb21tZW50LTI3NDg4OTAyMlxuICAgIHN0cmluZ2lmaWVkRnVuYyA9IHN0cmluZ2lmaWVkRnVuYy5yZXBsYWNlKC9jb3ZfKC4rPylcXCtcXCtbLDtdPy9nLCAnJyk7XG4gICAgcmV0dXJuIHN0cmluZ2lmaWVkRnVuYztcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIEdlbmVyaWMgY2FjaGluZyBzdHVmZjsgdGhpcyBpc24ndCBqdXN0IGZvciBwZXJmb3JtYW5jZS4gQ29ubmVjdGVkVGFibGUnc1xuICAgIC8vIGFsZ29yaXRobSByZXF1aXJlcyB0aGF0IGl0cyBwYXJlbnQgdGFibGVzIGhhdmUgcHJlLWJ1aWx0IGluZGV4ZXMgKHdlXG4gICAgLy8gdGVjaG5pY2FsbHkgY291bGQgaW1wbGVtZW50IGl0IGRpZmZlcmVudGx5LCBidXQgaXQgd291bGQgYmUgZXhwZW5zaXZlLFxuICAgIC8vIHJlcXVpcmVzIHRyaWNreSBsb2dpYywgYW5kIHdlJ3JlIGFscmVhZHkgYnVpbGRpbmcgaW5kZXhlcyBmb3Igc29tZSB0YWJsZXNcbiAgICAvLyBsaWtlIEFnZ3JlZ2F0ZWRUYWJsZSBhbnl3YXkpXG4gICAgaWYgKG9wdGlvbnMucmVzZXQpIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgICAgeWllbGQgKiBPYmplY3QudmFsdWVzKHRoaXMuX2NhY2hlKS5zbGljZSgwLCBsaW1pdCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgeWllbGQgKiBhd2FpdCB0aGlzLl9idWlsZENhY2hlKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICBkZWxldGUgb3B0aW9ucy5saW1pdDtcbiAgICBjb25zdCBpdGVyYXRvciA9IHRoaXMuX2l0ZXJhdGUob3B0aW9ucyk7XG4gICAgbGV0IGNvbXBsZXRlZCA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGltaXQ7IGkrKykge1xuICAgICAgY29uc3QgdGVtcCA9IGF3YWl0IGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIGl0ZXJhdGlvbiB3YXMgY2FuY2VsbGVkOyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHRlbXAuZG9uZSkge1xuICAgICAgICBjb21wbGV0ZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0odGVtcC52YWx1ZSk7XG4gICAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt0ZW1wLnZhbHVlLmluZGV4XSA9IHRlbXAudmFsdWU7XG4gICAgICAgIHlpZWxkIHRlbXAudmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb21wbGV0ZWQpIHtcbiAgICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBfZmluaXNoSXRlbSAod3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgd3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB3cmFwcGVkSXRlbS5yb3cpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgZGVsZXRlIHdyYXBwZWRJdGVtLnJvd1thdHRyXTtcbiAgICB9XG4gICAgbGV0IGtlZXAgPSB0cnVlO1xuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAga2VlcCA9IHRoaXMuX2luZGV4RmlsdGVyKHdyYXBwZWRJdGVtLmluZGV4KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fYXR0cmlidXRlRmlsdGVycykpIHtcbiAgICAgIGtlZXAgPSBrZWVwICYmIGZ1bmMod3JhcHBlZEl0ZW0ucm93W2F0dHJdKTtcbiAgICAgIGlmICgha2VlcCkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAoa2VlcCkge1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmluaXNoJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyYXBwZWRJdGVtLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbHRlcicpO1xuICAgIH1cbiAgICByZXR1cm4ga2VlcDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudGFibGUgPSB0aGlzO1xuICAgIGNvbnN0IGNsYXNzT2JqID0gdGhpcy5jbGFzc09iajtcbiAgICBjb25zdCB3cmFwcGVkSXRlbSA9IGNsYXNzT2JqID8gY2xhc3NPYmouX3dyYXAob3B0aW9ucykgOiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gICAgZm9yIChjb25zdCBvdGhlckl0ZW0gb2Ygb3B0aW9ucy5pdGVtc1RvQ29ubmVjdCB8fCBbXSkge1xuICAgICAgd3JhcHBlZEl0ZW0uY29ubmVjdEl0ZW0ob3RoZXJJdGVtKTtcbiAgICAgIG90aGVySXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHJldHVybiB3cmFwcGVkSXRlbTtcbiAgfVxuICByZXNldCAoKSB7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fY2FjaGU7XG4gICAgZm9yIChjb25zdCBkZXJpdmVkVGFibGUgb2YgdGhpcy5kZXJpdmVkVGFibGVzKSB7XG4gICAgICBkZXJpdmVkVGFibGUucmVzZXQoKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdyZXNldCcpO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYHRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG92ZXJyaWRkZW5gKTtcbiAgfVxuICBhc3luYyBidWlsZENhY2hlICgpIHtcbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX2NhY2hlUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fY2FjaGVQcm9taXNlID0gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IHRlbXAgb2YgdGhpcy5fYnVpbGRDYWNoZSgpKSB7fSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgICAgIHJlc29sdmUodGhpcy5fY2FjaGUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH1cbiAgfVxuICBhc3luYyBjb3VudFJvd3MgKCkge1xuICAgIGNvbnN0IGNhY2hlID0gYXdhaXQgdGhpcy5idWlsZENhY2hlKCk7XG4gICAgcmV0dXJuIGNhY2hlID8gT2JqZWN0LmtleXMoY2FjaGUpLmxlbmd0aCA6IC0xO1xuICB9XG4gIGdldEluZGV4RGV0YWlscyAoKSB7XG4gICAgY29uc3QgZGV0YWlscyA9IHsgbmFtZTogbnVsbCB9O1xuICAgIGlmICh0aGlzLl9zdXBwcmVzc0luZGV4KSB7XG4gICAgICBkZXRhaWxzLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGRldGFpbHMuZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGV0YWlscztcbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHt9O1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5leHBlY3RlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5vYnNlcnZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZGVyaXZlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnN1cHByZXNzZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fYXR0cmlidXRlRmlsdGVycykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG4gIGdldCBhdHRyaWJ1dGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5nZXRBdHRyaWJ1dGVEZXRhaWxzKCkpO1xuICB9XG4gIGdldCBjdXJyZW50RGF0YSAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRhdGE6IHRoaXMuX2NhY2hlIHx8IHRoaXMuX3BhcnRpYWxDYWNoZSB8fCB7fSxcbiAgICAgIGNvbXBsZXRlOiAhIXRoaXMuX2NhY2hlXG4gICAgfTtcbiAgfVxuICBkZXJpdmVBdHRyaWJ1dGUgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIHN1cHByZXNzQXR0cmlidXRlIChhdHRyaWJ1dGUpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc0luZGV4ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXNbYXR0cmlidXRlXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBhZGRGaWx0ZXIgKGF0dHJpYnV0ZSwgZnVuYykge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX2luZGV4RmlsdGVyID0gZnVuYztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF9kZXJpdmVUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlID0gdGhpcy5tb2RlbC5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGUgPSB0aGlzLmRlcml2ZWRUYWJsZXMuZmluZCh0YWJsZU9iaiA9PiB7XG4gICAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMob3B0aW9ucykuZXZlcnkoKFtvcHRpb25OYW1lLCBvcHRpb25WYWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbk5hbWUgPT09ICd0eXBlJykge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmpbJ18nICsgb3B0aW9uTmFtZV0gPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGV4aXN0aW5nVGFibGUgJiYgdGhpcy5tb2RlbC50YWJsZXNbZXhpc3RpbmdUYWJsZS50YWJsZUlkXSkgfHwgbnVsbDtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnQWdncmVnYXRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZVxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0eXBlOiAnRXhwYW5kZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBkZWxpbWl0ZXJcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB2YWx1ZXMubWFwKHZhbHVlID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSwgbGltaXQgPSBJbmZpbml0eSkge1xuICAgIGNvbnN0IHZhbHVlcyA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gd3JhcHBlZEl0ZW0ucm93W2F0dHJpYnV0ZV07XG4gICAgICBpZiAoIXZhbHVlc1t2YWx1ZV0pIHtcbiAgICAgICAgdmFsdWVzW3ZhbHVlXSA9IHRydWU7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiBpbmRleGVzLm1hcChpbmRleCA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXhcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnVHJhbnNwb3NlZFRhYmxlJyxcbiAgICAgICAgaW5kZXg6IHdyYXBwZWRJdGVtLmluZGV4XG4gICAgICB9O1xuICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9XG4gIH1cbiAgY29ubmVjdCAob3RoZXJUYWJsZUxpc3QpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUoe1xuICAgICAgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJ1xuICAgIH0pO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgb3RoZXJUYWJsZS5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld1RhYmxlO1xuICB9XG4gIGdldCBjbGFzc09iaiAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5maW5kKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZSA9PT0gdGhpcztcbiAgICB9KTtcbiAgfVxuICBnZXQgcGFyZW50VGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLnRhYmxlcykucmVkdWNlKChhZ2csIHRhYmxlT2JqKSA9PiB7XG4gICAgICBpZiAodGFibGVPYmouX2Rlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXSkge1xuICAgICAgICBhZ2cucHVzaCh0YWJsZU9iaik7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWdnO1xuICAgIH0sIFtdKTtcbiAgfVxuICBnZXQgZGVyaXZlZFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXTtcbiAgICB9KTtcbiAgfVxuICBnZXQgaW5Vc2UgKCkge1xuICAgIGlmIChPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC5jbGFzc2VzKS5zb21lKGNsYXNzT2JqID0+IHtcbiAgICAgIHJldHVybiBjbGFzc09iai50YWJsZUlkID09PSB0aGlzLnRhYmxlSWQgfHxcbiAgICAgICAgY2xhc3NPYmouc291cmNlVGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMSB8fFxuICAgICAgICBjbGFzc09iai50YXJnZXRUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKHRoaXMuaW5Vc2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIGluLXVzZSB0YWJsZSAke3RoaXMudGFibGVJZH1gKTtcbiAgICAgIGVyci5pblVzZSA9IHRydWU7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGhpcy5wYXJlbnRUYWJsZXMpIHtcbiAgICAgIGRlbGV0ZSBwYXJlbnRUYWJsZS5kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUYWJsZSwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopVGFibGUvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IFtdO1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCB0aGlzLl9kYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93OiB0aGlzLl9kYXRhW2luZGV4XSB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY0RpY3RUYWJsZTtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWlyZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5tb2RlbC5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5tb2RlbC5fZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiAn4oamJyArIHRoaXMuX2F0dHJpYnV0ZTtcbiAgfVxuICBkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIChhdHRyLCBmdW5jKSB7XG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX3VwZGF0ZUl0ZW0gKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb3JpZ2luYWxXcmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKG9yaWdpbmFsV3JhcHBlZEl0ZW0sIG5ld1dyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgb3JpZ2luYWxXcmFwcGVkSXRlbS50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gV2Ugb3ZlcnJpZGUgX2J1aWxkQ2FjaGUgYmVjYXVzZSBzbyB0aGF0IEFnZ3JlZ2F0ZWRUYWJsZSBjYW4gdGFrZSBhZHZhbnRhZ2VcbiAgICAvLyBvZiB0aGUgcGFydGlhbGx5LWJ1aWx0IGNhY2hlIGFzIGl0IGdvZXMsIGFuZCBwb3N0cG9uZSBmaW5pc2hpbmcgaXRlbXNcbiAgICAvLyB1bnRpbCBhZnRlciB0aGUgcGFyZW50IHRhYmxlIGhhcyBiZWVuIGZ1bGx5IGl0ZXJhdGVkXG5cbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbd3JhcHBlZEl0ZW0uaW5kZXhdID0gd3JhcHBlZEl0ZW07XG4gICAgICAvLyBHbyBhaGVhZCBhbmQgeWllbGQgdGhlIHVuZmluaXNoZWQgaXRlbTsgdGhpcyBtYWtlcyBpdCBwb3NzaWJsZSBmb3JcbiAgICAgIC8vIGNsaWVudCBhcHBzIHRvIGJlIG1vcmUgcmVzcG9uc2l2ZSBhbmQgcmVuZGVyIHBhcnRpYWwgcmVzdWx0cywgYnV0IGFsc29cbiAgICAgIC8vIG1lYW5zIHRoYXQgdGhleSBuZWVkIHRvIHdhdGNoIGZvciB3cmFwcGVkSXRlbS5vbigndXBkYXRlJykgZXZlbnRzXG4gICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICB9XG5cbiAgICAvLyBTZWNvbmQgcGFzczogbm93IHRoYXQgd2UndmUgY29tcGxldGVkIHRoZSBmdWxsIGl0ZXJhdGlvbiBvZiB0aGUgcGFyZW50XG4gICAgLy8gdGFibGUsIHdlIGNhbiBmaW5pc2ggZWFjaCBpdGVtXG4gICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIGlmICghdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSBTdHJpbmcod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBXZSB3ZXJlIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICAgIGV4aXN0aW5nSXRlbS5jb25uZWN0SXRlbSh3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgd3JhcHBlZFBhcmVudC5jb25uZWN0SXRlbShleGlzdGluZ0l0ZW0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKGV4aXN0aW5nSXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKG5ld0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBnZXRBdHRyaWJ1dGVEZXRhaWxzICgpIHtcbiAgICBjb25zdCBhbGxBdHRycyA9IHN1cGVyLmdldEF0dHJpYnV0ZURldGFpbHMoKTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ucmVkdWNlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBFeHBhbmRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8ICcsJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqQnO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gfHwgJycpLnNwbGl0KHRoaXMuZGVsaW1pdGVyKTtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgICAgICByb3dbdGhpcy5fYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBFeHBhbmRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBGYWNldGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSB8fCAhdGhpcy5fdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnZhbHVlID0gdGhpcy5fdmFsdWU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGBbJHt0aGlzLl92YWx1ZX1dYDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICAvLyBOb3JtYWwgZmFjZXRpbmcganVzdCBnaXZlcyBhIHN1YnNldCBvZiB0aGUgb3JpZ2luYWwgdGFibGVcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogT2JqZWN0LmFzc2lnbih7fSwgd3JhcHBlZFBhcmVudC5yb3cpLFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICAgIGluZGV4Kys7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGYWNldGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIFRyYW5zcG9zZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5faW5kZXggPSBvcHRpb25zLmluZGV4O1xuICAgIGlmICh0aGlzLl9pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmluZGV4ID0gdGhpcy5faW5kZXg7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIGDhtYAke3RoaXMuX2luZGV4fWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIC8vIFByZS1idWlsZCB0aGUgcGFyZW50IHRhYmxlJ3MgY2FjaGVcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuXG4gICAgLy8gSXRlcmF0ZSB0aGUgcm93J3MgYXR0cmlidXRlcyBhcyBpbmRleGVzXG4gICAgY29uc3Qgd3JhcHBlZFBhcmVudCA9IHBhcmVudFRhYmxlLl9jYWNoZVt0aGlzLl9pbmRleF0gfHwgeyByb3c6IHt9IH07XG4gICAgZm9yIChjb25zdCBbIGluZGV4LCB2YWx1ZSBdIG9mIE9iamVjdC5lbnRyaWVzKHdyYXBwZWRQYXJlbnQucm93KSkge1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgcm93OiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gdmFsdWUgOiB7IHZhbHVlIH0sXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgVHJhbnNwb3NlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBDb25uZWN0ZWRUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgYXdhaXQgcGFyZW50VGFibGUuYnVpbGRDYWNoZSgpO1xuICAgIH1cbiAgICAvLyBOb3cgdGhhdCB0aGUgY2FjaGVzIGFyZSBidWlsdCwganVzdCBpdGVyYXRlIHRoZWlyIGtleXMgZGlyZWN0bHkuIFdlIG9ubHlcbiAgICAvLyBjYXJlIGFib3V0IGluY2x1ZGluZyByb3dzIHRoYXQgaGF2ZSBleGFjdCBtYXRjaGVzIGFjcm9zcyBhbGwgdGFibGVzLCBzb1xuICAgIC8vIHdlIGNhbiBqdXN0IHBpY2sgb25lIHBhcmVudCB0YWJsZSB0byBpdGVyYXRlXG4gICAgY29uc3QgYmFzZVBhcmVudFRhYmxlID0gcGFyZW50VGFibGVzWzBdO1xuICAgIGNvbnN0IG90aGVyUGFyZW50VGFibGVzID0gcGFyZW50VGFibGVzLnNsaWNlKDEpO1xuICAgIGZvciAoY29uc3QgaW5kZXggaW4gYmFzZVBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlKSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKCFvdGhlclBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKSkge1xuICAgICAgICAvLyBObyBtYXRjaCBpbiBvbmUgb2YgdGhlIG90aGVyIHRhYmxlczsgb21pdCB0aGlzIGl0ZW1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBhZGQgZWFjaCBwYXJlbnQgdGFibGVzJyBrZXlzIGFzIGF0dHJpYnV0ZSB2YWx1ZXNcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGl0ZW1zVG9Db25uZWN0OiBwYXJlbnRUYWJsZXMubWFwKHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pXG4gICAgICB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBDb25uZWN0ZWRUYWJsZTtcbiIsImltcG9ydCBJbnRyb3NwZWN0YWJsZSBmcm9tICcuLi9Db21tb24vSW50cm9zcGVjdGFibGUuanMnO1xuaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBvcHRpb25zLmFubm90YXRpb25zIHx8IHt9O1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnNcbiAgICB9O1xuICB9XG4gIHNldENsYXNzTmFtZSAodmFsdWUpIHtcbiAgICB0aGlzLl9jbGFzc05hbWUgPSB2YWx1ZTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBfZGVyaXZlTmV3Q2xhc3MgKG5ld1RhYmxlLCB0eXBlID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGVcbiAgICB9KTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlbkZhY2V0KGF0dHJpYnV0ZSkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkVHJhbnNwb3NlKGluZGV4ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAoKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5UcmFuc3Bvc2UoKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGdldFNhbXBsZUdyYXBoIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5yb290Q2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmdldFNhbXBsZUdyYXBoKG9wdGlvbnMpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgTm9kZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogZWRnZXMgKG9wdGlvbnMgPSB7IGxpbWl0OiBJbmZpbml0eSB9KSB7XG4gICAgY29uc3QgZWRnZUlkcyA9IG9wdGlvbnMuZWRnZUlkcyB8fCB0aGlzLmNsYXNzT2JqLmVkZ2VDbGFzc0lkcztcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBlZGdlSWQgb2YgT2JqZWN0LmtleXMoZWRnZUlkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuY2xhc3NPYmoubW9kZWwuY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzT2JqLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpID49IG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKG9wdGlvbnMpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VFZGdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICh7IGF1dG9jb25uZWN0ID0gZmFsc2UgfSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG5cbiAgICBpZiAoIWF1dG9jb25uZWN0IHx8IGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIG5vZGUgY2xhc3Mgb24gdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MsIGFkZCBvdXJcbiAgICAgIC8vIGlkIHRvIGl0cyBsaXN0IG9mIGNvbm5lY3Rpb25zXG4gICAgICBjb25zdCBub2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGlmIChub2RlQ2xhc3MpIHtcbiAgICAgICAgbm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gdGFibGVJZCBsaXN0cyBzaG91bGQgZW1hbmF0ZSBvdXQgZnJvbSB0aGUgKG5ldykgZWRnZSB0YWJsZTsgYXNzdW1pbmdcbiAgICAgIC8vIChmb3IgYSBtb21lbnQpIHRoYXQgaXNTb3VyY2UgPT09IHRydWUsIHdlJ2QgY29uc3RydWN0IHRoZSB0YWJsZUlkIGxpc3RcbiAgICAgIC8vIGxpa2UgdGhpczpcbiAgICAgIGxldCB0YWJsZUlkTGlzdCA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgZWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKCFpc1NvdXJjZSkge1xuICAgICAgICAvLyBXaG9vcHMsIGdvdCBpdCBiYWNrd2FyZHMhXG4gICAgICAgIHRhYmxlSWRMaXN0LnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBlZGdlQ2xhc3MuZGlyZWN0ZWQ7XG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhYmxlSWRMaXN0O1xuICAgIH0gZWxzZSBpZiAoYXV0b2Nvbm5lY3QgJiYgZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIEFkZCB0aGlzIGNsYXNzIHRvIHRoZSBzb3VyY2UncyAvIHRhcmdldCdzIGVkZ2VDbGFzc0lkc1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgdGhpcy5tb2RlbC5jbGFzc2VzW29wdGlvbnMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgLy8gQ29uY2F0ZW5hdGUgdGhlIGludGVybWVkaWF0ZSB0YWJsZUlkIGxpc3RzLCBlbWFuYXRpbmcgb3V0IGZyb20gdGhlXG4gICAgICAvLyAobmV3KSBlZGdlIHRhYmxlXG4gICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzID0gc291cmNlRWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBzb3VyY2VFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnNvdXJjZVRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHRhcmdldEVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQodGFyZ2V0RWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICh0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0VGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgLy8gRGlzY29ubmVjdCB0aGUgZXhpc3RpbmcgZWRnZSBjbGFzc2VzIGZyb20gdGhlIG5ldyAobm93IGVkZ2UpIGNsYXNzXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH1cbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFsgb3RoZXJIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgLy8gSWYgd2UgaGF2ZSBhIHNlbGYgZWRnZSBjb25uZWN0aW5nIHRoZSBzYW1lIGF0dHJpYnV0ZSwgd2UgY2FuIGp1c3QgdXNlXG4gICAgLy8gdGhlIEFnZ3JlZ2F0ZWRUYWJsZSBhcyB0aGUgZWRnZSB0YWJsZTsgb3RoZXJ3aXNlIHdlIG5lZWQgdG8gY3JlYXRlIGFcbiAgICAvLyBDb25uZWN0ZWRUYWJsZVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpcyA9PT0gb3RoZXJOb2RlQ2xhc3MgJiYgYXR0cmlidXRlID09PSBvdGhlckF0dHJpYnV0ZVxuICAgICAgPyB0aGlzSGFzaCA6IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIGNvbnN0IG5ld0VkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICB0YWJsZUlkOiBjb25uZWN0ZWRUYWJsZS50YWJsZUlkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgc291cmNlVGFibGVJZHMsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0VGFibGVJZHNcbiAgICB9KTtcbiAgICB0aGlzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIG90aGVyTm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tuZXdFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gc3VwZXIuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgdGhpcy5jb25uZWN0VG9Ob2RlQ2xhc3Moe1xuICAgICAgb3RoZXJOb2RlQ2xhc3M6IG5ld05vZGVDbGFzcyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIG90aGVyQXR0cmlidXRlOiBudWxsXG4gICAgfSk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiB0aGlzLmNvbm5lY3RlZENsYXNzZXMoKSkge1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2Uob3B0aW9ucyk7XG4gICAgICB9XG4gICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBjb25uZWN0ZWRDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzc0lkIG9mIE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKSkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuL0dlbmVyaWNXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZVdyYXBwZXIgZXh0ZW5kcyBHZW5lcmljV3JhcHBlciB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLmNsYXNzT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGNsYXNzT2JqIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGFzeW5jICogc291cmNlTm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnNvdXJjZUNsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgc291cmNlVGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai5zb3VyY2VUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHNvdXJjZVRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHRhcmdldE5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai50YXJnZXRDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHRhcmdldFRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLm1vZGVsXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZUVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7IHNvdXJjZSwgZWRnZTogdGhpcywgdGFyZ2V0IH07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jIGh5cGVyZWRnZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHNvdXJjZXM6IFtdLFxuICAgICAgdGFyZ2V0czogW10sXG4gICAgICBlZGdlOiB0aGlzXG4gICAgfTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICByZXN1bHQucHVzaChzb3VyY2UpO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICByZXN1bHQucHVzaCh0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgcmVuYW1lIChuZXdOYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmV3TmFtZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFubm90YXRlIChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hbm5vdGF0aW9uc1trZXldID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGVBbm5vdGF0aW9uIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5hbm5vdGF0aW9uc1trZXldO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLl9vcmlncmFwaC5kZWxldGVNb2RlbCh0aGlzLm1vZGVsSWQpO1xuICB9XG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5fb3JpZ3JhcGguRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24sIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChuYW1lKSk7XG4gICAgfVxuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaChlZGdlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGggPD0gZWRnZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkVHJpcGxlID0gKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSA9PiB7XG4gICAgICBpZiAoYWRkTm9kZShzb3VyY2UpICYmIGFkZE5vZGUodGFyZ2V0KSAmJiBhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgICBlZGdlOiBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF1cbiAgICAgICAgfSk7XG4gICAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgICAgcmV0dXJuIG51bVRyaXBsZXMgPD0gdHJpcGxlTGltaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGVkZ2UucGFpcndpc2VFZGdlcyh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlcykge1xuICAgIGlmICghaW5zdGFuY2VzKSB7XG4gICAgICAvLyBXaXRob3V0IHNwZWNpZmllZCBpbnN0YW5jZXMsIGp1c3QgcGljayB0aGUgZmlyc3QgNSBmcm9tIGVhY2ggbm9kZVxuICAgICAgLy8gYW5kIGVkZ2UgY2xhc3NcbiAgICAgIGluc3RhbmNlcyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSh7IGxpbWl0OiA1IH0pKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXMucHVzaChpdGVtKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcbiAgICBjb25zdCBlZGdlVGFibGVFbnRyaWVzID0gW107XG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBpbnN0YW5jZXMpIHtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZ3JhcGgubm9kZUxvb2t1cFtpbnN0YW5jZS5pbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7XG4gICAgICAgICAgbm9kZUluc3RhbmNlOiBpbnN0YW5jZSxcbiAgICAgICAgICBkdW1teTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlVGFibGVFbnRyaWVzLnB1c2goaW5zdGFuY2UpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGVkZ2VJbnN0YW5jZSBvZiBlZGdlVGFibGVFbnRyaWVzKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlSW5zdGFuY2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHNvdXJjZXMucHVzaChncmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIGVkZ2VJbnN0YW5jZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGFyZ2V0cy5wdXNoKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Lmluc3RhbmNlSWRdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHNvdXJjZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIFdlIGhhdmUgY29tcGxldGVseSBoYW5naW5nIGVkZ2VzLCBtYWtlIGR1bW15IG5vZGVzIGZvciB0aGVcbiAgICAgICAgICAvLyBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aCArIDFcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFRoZSBzb3VyY2VzIGFyZSBoYW5naW5nLCBidXQgd2UgaGF2ZSB0YXJnZXRzXG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgIHRhcmdldFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRhcmdldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIFRoZSB0YXJnZXRzIGFyZSBoYW5naW5nLCBidXQgd2UgaGF2ZSBzb3VyY2VzXG4gICAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHRoZSBzb3VyY2UsIG5vciB0aGUgdGFyZ2V0IGFyZSBoYW5naW5nXG4gICAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICAgIHRhcmdldFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgY29uc3QgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0RnVsbFNjaGVtYUdyYXBoICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0aGlzLmdldE5ldHdvcmtNb2RlbEdyYXBoKCksIHRoaXMuZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgoKSk7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRGdWxsU2NoZW1hR3JhcGgoKTtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGxldCBjbGFzc2VzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGguY2xhc3NlcyxcbiAgICAgIG5hbWU6ICdDbGFzc2VzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgY2xhc3NDb25uZWN0aW9ucyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBuYW1lOiAnQ2xhc3MgQ29ubmVjdGlvbnMnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGxldCB0YWJsZXMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZXMsXG4gICAgICBuYW1lOiAnVGFibGVzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgdGFibGVMaW5rcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLnRhYmxlTGlua3MsXG4gICAgICBuYW1lOiAnVGFibGUgTGlua3MnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgY2xhc3Nlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiBjbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICB0YWJsZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogdGFibGVMaW5rcyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAndGFyZ2V0J1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiAndGFibGVJZCdcbiAgICB9KS5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGVzJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5cbmxldCBvcmlncmFwaCA9IG5ldyBPcmlncmFwaCh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5vcmlncmFwaC52ZXJzaW9uID0gcGtnLnZlcnNpb247XG5cbmV4cG9ydCBkZWZhdWx0IG9yaWdyYXBoO1xuIl0sIm5hbWVzIjpbIlRyaWdnZXJhYmxlTWl4aW4iLCJzdXBlcmNsYXNzIiwiY29uc3RydWN0b3IiLCJhcmd1bWVudHMiLCJfaW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4iLCJfZXZlbnRIYW5kbGVycyIsIl9zdGlja3lUcmlnZ2VycyIsIm9uIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJldmVudCIsIm5hbWVzcGFjZSIsInNwbGl0IiwicHVzaCIsIm9mZiIsImluZGV4IiwiaW5kZXhPZiIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiaGFuZGxlQ2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiYXBwbHkiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJjb25uZWN0SXRlbSIsIml0ZW0iLCJ0YWJsZUlkIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJlcXVhbHMiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsImxpbWl0IiwiSW5maW5pdHkiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwibW9kZWwiLCJ0YWJsZXMiLCJidWlsZENhY2hlIiwiX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyIsImxlbmd0aCIsInRoaXNUYWJsZUlkIiwicmVtYWluaW5nVGFibGVJZHMiLCJzbGljZSIsImV4ZWMiLCJuYW1lIiwiVGFibGUiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImh5ZHJhdGVGdW5jdGlvbiIsIl9zdXBwcmVzc2VkQXR0cmlidXRlcyIsInN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiX3N1cHByZXNzSW5kZXgiLCJzdXBwcmVzc0luZGV4IiwiX2luZGV4RmlsdGVyIiwiaW5kZXhGaWx0ZXIiLCJfYXR0cmlidXRlRmlsdGVycyIsImF0dHJpYnV0ZUZpbHRlcnMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsInVzZWRCeUNsYXNzZXMiLCJfdXNlZEJ5Q2xhc3NlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwia2VlcCIsIl93cmFwIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJkZXJpdmVkVGFibGUiLCJfY2FjaGVQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvdW50Um93cyIsImNhY2hlIiwiZ2V0SW5kZXhEZXRhaWxzIiwiZGV0YWlscyIsInN1cHByZXNzZWQiLCJmaWx0ZXJlZCIsImdldEF0dHJpYnV0ZURldGFpbHMiLCJhbGxBdHRycyIsImV4cGVjdGVkIiwib2JzZXJ2ZWQiLCJkZXJpdmVkIiwiY3VycmVudERhdGEiLCJkYXRhIiwiY29tcGxldGUiLCJkZXJpdmVBdHRyaWJ1dGUiLCJhdHRyaWJ1dGUiLCJzdXBwcmVzc0F0dHJpYnV0ZSIsImFkZEZpbHRlciIsIl9kZXJpdmVUYWJsZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJlcnIiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwicmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwiX2RlaHlkcmF0ZUZ1bmN0aW9uIiwiZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsIlN0cmluZyIsImV4aXN0aW5nSXRlbSIsIm5ld0l0ZW0iLCJyZWR1Y2VkIiwiRXhwYW5kZWRUYWJsZSIsIkZhY2V0ZWRUYWJsZSIsIl92YWx1ZSIsIlRyYW5zcG9zZWRUYWJsZSIsIl9pbmRleCIsIkNvbm5lY3RlZFRhYmxlIiwiam9pbiIsImJhc2VQYXJlbnRUYWJsZSIsIm90aGVyUGFyZW50VGFibGVzIiwiR2VuZXJpY0NsYXNzIiwiX2NsYXNzTmFtZSIsImNsYXNzTmFtZSIsImFubm90YXRpb25zIiwic2V0Q2xhc3NOYW1lIiwiaGFzQ3VzdG9tTmFtZSIsImludGVycHJldEFzTm9kZXMiLCJvdmVyd3JpdGUiLCJjcmVhdGVDbGFzcyIsImludGVycHJldEFzRWRnZXMiLCJfZGVyaXZlTmV3Q2xhc3MiLCJnZXRTYW1wbGVHcmFwaCIsInJvb3RDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInJldmVyc2UiLCJjb25jYXQiLCJwYWlyd2lzZU5laWdoYm9yaG9vZCIsImVkZ2UiLCJwYWlyd2lzZUVkZ2VzIiwiTm9kZUNsYXNzIiwiYXV0b2Nvbm5lY3QiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJpc1NvdXJjZSIsInRhcmdldENsYXNzSWQiLCJkaXNjb25uZWN0U291cmNlIiwiZGlzY29ubmVjdFRhcmdldCIsIm5vZGVDbGFzcyIsInRhYmxlSWRMaXN0IiwiZGlyZWN0ZWQiLCJzb3VyY2VFZGdlQ2xhc3MiLCJ0YXJnZXRFZGdlQ2xhc3MiLCJjb25uZWN0VG9Ob2RlQ2xhc3MiLCJvdGhlck5vZGVDbGFzcyIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5ld05vZGVDbGFzcyIsImNvbm5lY3RlZENsYXNzZXMiLCJlZGdlQ2xhc3NJZCIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwic291cmNlIiwidGFyZ2V0IiwiaHlwZXJlZGdlIiwic291cmNlcyIsInRhcmdldHMiLCJFZGdlQ2xhc3MiLCJfc3BsaXRUYWJsZUlkTGlzdCIsIm90aGVyQ2xhc3MiLCJub2RlVGFibGVJZExpc3QiLCJlZGdlVGFibGVJZCIsImVkZ2VUYWJsZUlkTGlzdCIsInN0YXRpY0V4aXN0cyIsInRhYmxlRGlzdGFuY2VzIiwic3RhcnRzV2l0aCIsImRpc3QiLCJNYXRoIiwiYWJzIiwiZmlsdGVyIiwic29ydCIsImEiLCJiIiwic291cmNlQ2xhc3MiLCJ0YXJnZXRDbGFzcyIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwibWltZSIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwicmVhZGVyIiwiRmlsZVJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwibG9va3VwIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImJyYW5jaExpbWl0Iiwibm9kZUxpbWl0IiwiZWRnZUxpbWl0IiwidHJpcGxlTGltaXQiLCJzYW1wbGVHcmFwaCIsIm5vZGVzIiwibm9kZUxvb2t1cCIsImVkZ2VMb29rdXAiLCJsaW5rcyIsIm51bVRyaXBsZXMiLCJhZGROb2RlIiwibm9kZSIsImFkZEVkZ2UiLCJhZGRUcmlwbGUiLCJjbGFzc0xpc3QiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VzIiwiZ3JhcGgiLCJlZGdlVGFibGVFbnRyaWVzIiwiaW5zdGFuY2UiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJlZGdlQ2xhc3NlcyIsImNsYXNzTG9va3VwIiwiY2xhc3NDb25uZWN0aW9ucyIsImNsYXNzU3BlYyIsImlkIiwibG9jYXRpb24iLCJnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCIsInRhYmxlTG9va3VwIiwidGFibGVMaW5rcyIsInRhYmxlTGlzdCIsInRhYmxlU3BlYyIsImdldEZ1bGxTY2hlbWFHcmFwaCIsImNyZWF0ZVNjaGVtYU1vZGVsIiwibmV3TW9kZWwiLCJjcmVhdGVNb2RlbCIsIk5FWFRfTU9ERUxfSUQiLCJPcmlncmFwaCIsImxvY2FsU3RvcmFnZSIsInBsdWdpbnMiLCJtb2RlbHMiLCJleGlzdGluZ01vZGVscyIsImdldEl0ZW0iLCJKU09OIiwicGFyc2UiLCJfY3VycmVudE1vZGVsSWQiLCJyZWdpc3RlclBsdWdpbiIsInBsdWdpbiIsInNldEl0ZW0iLCJzdHJpbmdpZnkiLCJjbG9zZUN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwid2luZG93IiwidmVyc2lvbiIsInBrZyJdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7V0FDS0MsZUFBTCxHQUF1QixFQUF2Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ25CLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxLQUFWLENBQWdCLEdBQWhCLENBQXpCO1dBQ0tQLGNBQUwsQ0FBb0JLLEtBQXBCLElBQTZCLEtBQUtMLGNBQUwsQ0FBb0JLLEtBQXBCLEtBQzNCO1lBQU07T0FEUjs7VUFFSSxDQUFDQyxTQUFMLEVBQWdCO2FBQ1ROLGNBQUwsQ0FBb0JLLEtBQXBCLEVBQTJCLEVBQTNCLEVBQStCRyxJQUEvQixDQUFvQ0osUUFBcEM7T0FERixNQUVPO2FBQ0FKLGNBQUwsQ0FBb0JLLEtBQXBCLEVBQTJCQyxTQUEzQixJQUF3Q0YsUUFBeEM7Ozs7SUFHSkssR0FBRyxDQUFFTixTQUFGLEVBQWFDLFFBQWIsRUFBdUI7VUFDcEIsQ0FBQ0MsS0FBRCxFQUFRQyxTQUFSLElBQXFCSCxTQUFTLENBQUNJLEtBQVYsQ0FBZ0IsR0FBaEIsQ0FBekI7O1VBQ0ksS0FBS1AsY0FBTCxDQUFvQkssS0FBcEIsQ0FBSixFQUFnQztZQUMxQixDQUFDQyxTQUFMLEVBQWdCO2NBQ1YsQ0FBQ0YsUUFBTCxFQUFlO2lCQUNSSixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixJQUFpQyxFQUFqQztXQURGLE1BRU87Z0JBQ0RLLEtBQUssR0FBRyxLQUFLVixjQUFMLENBQW9CSyxLQUFwQixFQUEyQixFQUEzQixFQUErQk0sT0FBL0Is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
