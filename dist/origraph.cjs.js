'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var FileReader = _interopDefault(require('filereader'));

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

  *edgeClasses() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      yield this.model.classes[edgeClassId];
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
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

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

let origraph = new Origraph(FileReader, null);
origraph.version = pkg.version;

module.exports = origraph;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguY2pzLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBUcmlnZ2VyYWJsZU1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKCkge1xuICAgICAgc3VwZXIoLi4uYXJndW1lbnRzKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluID0gdHJ1ZTtcbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzID0ge307XG4gICAgfVxuICAgIG9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBsZXQgW2V2ZW50LCBuYW1lc3BhY2VdID0gZXZlbnROYW1lLnNwbGl0KCc6Jyk7XG4gICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdIHx8XG4gICAgICAgIHsgJyc6IFtdIH07XG4gICAgICBpZiAoIW5hbWVzcGFjZSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVsnJ10ucHVzaChjYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdID0gY2FsbGJhY2s7XG4gICAgICB9XG4gICAgfVxuICAgIG9mZiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgICAgbGV0IFtldmVudCwgbmFtZXNwYWNlXSA9IGV2ZW50TmFtZS5zcGxpdCgnOicpO1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdKSB7XG4gICAgICAgIGlmICghbmFtZXNwYWNlKSB7XG4gICAgICAgICAgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddID0gW107XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnRdWycnXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bbmFtZXNwYWNlXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudCwgLi4uYXJncykge1xuICAgICAgY29uc3QgaGFuZGxlQ2FsbGJhY2sgPSBjYWxsYmFjayA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4geyAvLyBBZGQgdGltZW91dCB0byBwcmV2ZW50IGJsb2NraW5nXG4gICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfTtcbiAgICAgIGlmICh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkge1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWVzcGFjZSBvZiBPYmplY3Qua2V5cyh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XSkpIHtcbiAgICAgICAgICBpZiAobmFtZXNwYWNlID09PSAnJykge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudF1bJyddLmZvckVhY2goaGFuZGxlQ2FsbGJhY2spO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYW5kbGVDYWxsYmFjayh0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50XVtuYW1lc3BhY2VdKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS5idWlsZENhY2hlKCk7XG4gICAgfSkpO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHRhYmxlSWRzKSkge1xuICAgICAgeWllbGQgaXRlbTtcbiAgICAgIGkrKztcbiAgICAgIGlmIChpID49IGxpbWl0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKiBfaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zICh0YWJsZUlkcykge1xuICAgIGlmICh0YWJsZUlkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHlpZWxkICogKHRoaXMuY29ubmVjdGVkSXRlbXNbdGFibGVJZHNbMF1dIHx8IFtdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGhpc1RhYmxlSWQgPSB0YWJsZUlkc1swXTtcbiAgICAgIGNvbnN0IHJlbWFpbmluZ1RhYmxlSWRzID0gdGFibGVJZHMuc2xpY2UoMSk7XG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jb25uZWN0ZWRJdGVtc1t0aGlzVGFibGVJZF0gfHwgW10pIHtcbiAgICAgICAgeWllbGQgKiBpdGVtLl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMocmVtYWluaW5nVGFibGVJZHMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5tb2RlbCA9IG9wdGlvbnMubW9kZWw7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG1vZGVsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlcyB8fCB7fTtcbiAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXMgPSB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXMgPSBvcHRpb25zLmRlcml2ZWRUYWJsZXMgfHwge307XG5cbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyA9IG9wdGlvbnMuc3VwcHJlc3NlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9ICEhb3B0aW9ucy5zdXBwcmVzc0luZGV4O1xuXG4gICAgdGhpcy5faW5kZXhGaWx0ZXIgPSAob3B0aW9ucy5pbmRleEZpbHRlciAmJiB0aGlzLmh5ZHJhdGVGdW5jdGlvbihvcHRpb25zLmluZGV4RmlsdGVyKSkgfHwgbnVsbDtcbiAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLmF0dHJpYnV0ZUZpbHRlcnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJdID0gdGhpcy5oeWRyYXRlRnVuY3Rpb24oc3RyaW5naWZpZWRGdW5jKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBhdHRyaWJ1dGVzOiB0aGlzLl9hdHRyaWJ1dGVzLFxuICAgICAgZGVyaXZlZFRhYmxlczogdGhpcy5fZGVyaXZlZFRhYmxlcyxcbiAgICAgIHVzZWRCeUNsYXNzZXM6IHRoaXMuX3VzZWRCeUNsYXNzZXMsXG4gICAgICBkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zOiB7fSxcbiAgICAgIHN1cHByZXNzZWRBdHRyaWJ1dGVzOiB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlcyxcbiAgICAgIHN1cHByZXNzSW5kZXg6IHRoaXMuX3N1cHByZXNzSW5kZXgsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXJzOiB7fSxcbiAgICAgIGluZGV4RmlsdGVyOiAodGhpcy5faW5kZXhGaWx0ZXIgJiYgdGhpcy5kZWh5ZHJhdGVGdW5jdGlvbih0aGlzLl9pbmRleEZpbHRlcikpIHx8IG51bGxcbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICByZXN1bHQuYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaHlkcmF0ZUZ1bmN0aW9uIChzdHJpbmdpZmllZEZ1bmMpIHtcbiAgICBuZXcgRnVuY3Rpb24oYHJldHVybiAke3N0cmluZ2lmaWVkRnVuY31gKSgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy1mdW5jXG4gIH1cbiAgZGVoeWRyYXRlRnVuY3Rpb24gKGZ1bmMpIHtcbiAgICBsZXQgc3RyaW5naWZpZWRGdW5jID0gZnVuYy50b1N0cmluZygpO1xuICAgIC8vIElzdGFuYnVsIGFkZHMgc29tZSBjb2RlIHRvIGZ1bmN0aW9ucyBmb3IgY29tcHV0aW5nIGNvdmVyYWdlLCB0aGF0IGdldHNcbiAgICAvLyBpbmNsdWRlZCBpbiB0aGUgc3RyaW5naWZpY2F0aW9uIHByb2Nlc3MgZHVyaW5nIHRlc3RpbmcuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vZ290d2FybG9zdC9pc3RhbmJ1bC9pc3N1ZXMvMzEwI2lzc3VlY29tbWVudC0yNzQ4ODkwMjJcbiAgICBzdHJpbmdpZmllZEZ1bmMgPSBzdHJpbmdpZmllZEZ1bmMucmVwbGFjZSgvY292XyguKz8pXFwrXFwrWyw7XT8vZywgJycpO1xuICAgIHJldHVybiBzdHJpbmdpZmllZEZ1bmM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyYXRlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBHZW5lcmljIGNhY2hpbmcgc3R1ZmY7IHRoaXMgaXNuJ3QganVzdCBmb3IgcGVyZm9ybWFuY2UuIENvbm5lY3RlZFRhYmxlJ3NcbiAgICAvLyBhbGdvcml0aG0gcmVxdWlyZXMgdGhhdCBpdHMgcGFyZW50IHRhYmxlcyBoYXZlIHByZS1idWlsdCBpbmRleGVzICh3ZVxuICAgIC8vIHRlY2huaWNhbGx5IGNvdWxkIGltcGxlbWVudCBpdCBkaWZmZXJlbnRseSwgYnV0IGl0IHdvdWxkIGJlIGV4cGVuc2l2ZSxcbiAgICAvLyByZXF1aXJlcyB0cmlja3kgbG9naWMsIGFuZCB3ZSdyZSBhbHJlYWR5IGJ1aWxkaW5nIGluZGV4ZXMgZm9yIHNvbWUgdGFibGVzXG4gICAgLy8gbGlrZSBBZ2dyZWdhdGVkVGFibGUgYW55d2F5KVxuICAgIGlmIChvcHRpb25zLnJlc2V0KSB7XG4gICAgICB0aGlzLnJlc2V0KCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICBjb25zdCBsaW1pdCA9IG9wdGlvbnMubGltaXQgPT09IHVuZGVmaW5lZCA/IEluZmluaXR5IDogb3B0aW9ucy5saW1pdDtcbiAgICAgIHlpZWxkICogT2JqZWN0LnZhbHVlcyh0aGlzLl9jYWNoZSkuc2xpY2UoMCwgbGltaXQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHlpZWxkICogYXdhaXQgdGhpcy5fYnVpbGRDYWNoZShvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zID0ge30pIHtcbiAgICAvLyBUT0RPOiBpbiBsYXJnZSBkYXRhIHNjZW5hcmlvcywgd2Ugc2hvdWxkIGJ1aWxkIHRoZSBjYWNoZSAvIGluZGV4XG4gICAgLy8gZXh0ZXJuYWxseSBvbiBkaXNrXG4gICAgdGhpcy5fcGFydGlhbENhY2hlID0ge307XG4gICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgZGVsZXRlIG9wdGlvbnMubGltaXQ7XG4gICAgY29uc3QgaXRlcmF0b3IgPSB0aGlzLl9pdGVyYXRlKG9wdGlvbnMpO1xuICAgIGxldCBjb21wbGV0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbWl0OyBpKyspIHtcbiAgICAgIGNvbnN0IHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgICAvLyBpdGVyYXRpb24gd2FzIGNhbmNlbGxlZDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICh0ZW1wLmRvbmUpIHtcbiAgICAgICAgY29tcGxldGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHRlbXAudmFsdWUpO1xuICAgICAgICB0aGlzLl9wYXJ0aWFsQ2FjaGVbdGVtcC52YWx1ZS5pbmRleF0gPSB0ZW1wLnZhbHVlO1xuICAgICAgICB5aWVsZCB0ZW1wLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29tcGxldGVkKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgX2ZpbmlzaEl0ZW0gKHdyYXBwZWRJdGVtKSB7XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIHdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMod3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gd3JhcHBlZEl0ZW0ucm93KSB7XG4gICAgICB0aGlzLl9vYnNlcnZlZEF0dHJpYnV0ZXNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGRlbGV0ZSB3cmFwcGVkSXRlbS5yb3dbYXR0cl07XG4gICAgfVxuICAgIGxldCBrZWVwID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5kZXhGaWx0ZXIpIHtcbiAgICAgIGtlZXAgPSB0aGlzLl9pbmRleEZpbHRlcih3cmFwcGVkSXRlbS5pbmRleCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpKSB7XG4gICAgICBrZWVwID0ga2VlcCAmJiBmdW5jKHdyYXBwZWRJdGVtLnJvd1thdHRyXSk7XG4gICAgICBpZiAoIWtlZXApIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgaWYgKGtlZXApIHtcbiAgICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3cmFwcGVkSXRlbS5kaXNjb25uZWN0KCk7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaWx0ZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGtlZXA7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnRhYmxlID0gdGhpcztcbiAgICBjb25zdCBjbGFzc09iaiA9IHRoaXMuY2xhc3NPYmo7XG4gICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IEdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICAgIGZvciAoY29uc3Qgb3RoZXJJdGVtIG9mIG9wdGlvbnMuaXRlbXNUb0Nvbm5lY3QgfHwgW10pIHtcbiAgICAgIHdyYXBwZWRJdGVtLmNvbm5lY3RJdGVtKG90aGVySXRlbSk7XG4gICAgICBvdGhlckl0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB0aGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBvdmVycmlkZGVuYCk7XG4gIH1cbiAgYXN5bmMgYnVpbGRDYWNoZSAoKSB7XG4gICAgaWYgKHRoaXMuX2NhY2hlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGU7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9jYWNoZVByb21pc2UpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2NhY2hlUHJvbWlzZSA9IG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCB0ZW1wIG9mIHRoaXMuX2J1aWxkQ2FjaGUoKSkge30gLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICBkZWxldGUgdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgICAgICByZXNvbHZlKHRoaXMuX2NhY2hlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgY291bnRSb3dzICgpIHtcbiAgICBjb25zdCBjYWNoZSA9IGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpO1xuICAgIHJldHVybiBjYWNoZSA/IE9iamVjdC5rZXlzKGNhY2hlKS5sZW5ndGggOiAtMTtcbiAgfVxuICBnZXRJbmRleERldGFpbHMgKCkge1xuICAgIGNvbnN0IGRldGFpbHMgPSB7IG5hbWU6IG51bGwgfTtcbiAgICBpZiAodGhpcy5fc3VwcHJlc3NJbmRleCkge1xuICAgICAgZGV0YWlscy5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBkZXRhaWxzLmZpbHRlcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGRldGFpbHM7XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZXhwZWN0ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZXhwZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0ub2JzZXJ2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmRlcml2ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5zdXBwcmVzc2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuZ2V0QXR0cmlidXRlRGV0YWlscygpKTtcbiAgfVxuICBnZXQgY3VycmVudERhdGEgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9jYWNoZSB8fCB0aGlzLl9wYXJ0aWFsQ2FjaGUgfHwge30sXG4gICAgICBjb21wbGV0ZTogISF0aGlzLl9jYWNoZVxuICAgIH07XG4gIH1cbiAgZGVyaXZlQXR0cmlidXRlIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBzdXBwcmVzc0F0dHJpYnV0ZSAoYXR0cmlidXRlKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5fc3VwcHJlc3NJbmRleCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzW2F0dHJpYnV0ZV0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgYWRkRmlsdGVyIChhdHRyaWJ1dGUsIGZ1bmMpIHtcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzLl9pbmRleEZpbHRlciA9IGZ1bmM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2F0dHJpYnV0ZUZpbHRlcnNbYXR0cmlidXRlXSA9IGZ1bmM7XG4gICAgfVxuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfZGVyaXZlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMubW9kZWwuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgX2dldEV4aXN0aW5nVGFibGUgKG9wdGlvbnMpIHtcbiAgICAvLyBDaGVjayBpZiB0aGUgZGVyaXZlZCB0YWJsZSBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWRcbiAgICBjb25zdCBleGlzdGluZ1RhYmxlID0gdGhpcy5kZXJpdmVkVGFibGVzLmZpbmQodGFibGVPYmogPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMpLmV2ZXJ5KChbb3B0aW9uTmFtZSwgb3B0aW9uVmFsdWVdKSA9PiB7XG4gICAgICAgIGlmIChvcHRpb25OYW1lID09PSAndHlwZScpIHtcbiAgICAgICAgICByZXR1cm4gdGFibGVPYmouY29uc3RydWN0b3IubmFtZSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqWydfJyArIG9wdGlvbk5hbWVdID09PSBvcHRpb25WYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChleGlzdGluZ1RhYmxlICYmIHRoaXMubW9kZWwudGFibGVzW2V4aXN0aW5nVGFibGUudGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICB2YWx1ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlbkZhY2V0IChhdHRyaWJ1dGUsIGxpbWl0ID0gSW5maW5pdHkpIHtcbiAgICBjb25zdCB2YWx1ZXMgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuaXRlcmF0ZSh7IGxpbWl0IH0pKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHdyYXBwZWRJdGVtLnJvd1thdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF2YWx1ZXNbdmFsdWVdKSB7XG4gICAgICAgIHZhbHVlc1t2YWx1ZV0gPSB0cnVlO1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgIHR5cGU6ICdGYWNldGVkVGFibGUnLFxuICAgICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9O1xuICAgICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gaW5kZXhlcy5tYXAoaW5kZXggPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlIChsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ1RyYW5zcG9zZWRUYWJsZScsXG4gICAgICAgIGluZGV4OiB3cmFwcGVkSXRlbS5pbmRleFxuICAgICAgfTtcbiAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdDb25uZWN0ZWRUYWJsZSdcbiAgICB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBnZXQgY2xhc3NPYmogKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3NlcykuZmluZChjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGUgPT09IHRoaXM7XG4gICAgfSk7XG4gIH1cbiAgZ2V0IHBhcmVudFRhYmxlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5tb2RlbC50YWJsZXMpLnJlZHVjZSgoYWdnLCB0YWJsZU9iaikgPT4ge1xuICAgICAgaWYgKHRhYmxlT2JqLl9kZXJpdmVkVGFibGVzW3RoaXMudGFibGVJZF0pIHtcbiAgICAgICAgYWdnLnB1c2godGFibGVPYmopO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFnZztcbiAgICB9LCBbXSk7XG4gIH1cbiAgZ2V0IGRlcml2ZWRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9kZXJpdmVkVGFibGVzKS5tYXAodGFibGVJZCA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGFibGVJZF07XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGluVXNlICgpIHtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwuY2xhc3Nlcykuc29tZShjbGFzc09iaiA9PiB7XG4gICAgICByZXR1cm4gY2xhc3NPYmoudGFibGVJZCA9PT0gdGhpcy50YWJsZUlkIHx8XG4gICAgICAgIGNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTEgfHxcbiAgICAgICAgY2xhc3NPYmoudGFyZ2V0VGFibGVJZHMuaW5kZXhPZih0aGlzLnRhYmxlSWQpICE9PSAtMTtcbiAgICB9KTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGlmICh0aGlzLmluVXNlKSB7XG4gICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoYENhbid0IGRlbGV0ZSBpbi11c2UgdGFibGUgJHt0aGlzLnRhYmxlSWR9YCk7XG4gICAgICBlcnIuaW5Vc2UgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVGFibGUsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKVRhYmxlLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY1RhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCBbXTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGhpcy5fZGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdzogdGhpcy5fZGF0YVtpbmRleF0gfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIFN0YXRpY0RpY3RUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKGl0ZW0pKSB7XG4gICAgICAgIHlpZWxkIGl0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpcmVkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgc3RyaW5naWZpZWRGdW5jXSBvZiBPYmplY3QuZW50cmllcyhvcHRpb25zLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyB8fCB7fSkpIHtcbiAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMubW9kZWwuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gJ+KGpicgKyB0aGlzLl9hdHRyaWJ1dGU7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICBpZiAoIXRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLl9jYWNoZSA9IHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gU3RyaW5nKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0pO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0l0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgICBleGlzdGluZ0l0ZW0uY29ubmVjdEl0ZW0od3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHdyYXBwZWRQYXJlbnQuY29ubmVjdEl0ZW0oZXhpc3RpbmdJdGVtKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShleGlzdGluZ0l0ZW0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGl0ZW1zVG9Db25uZWN0OiBbIHdyYXBwZWRQYXJlbnQgXVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShuZXdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZ2V0QXR0cmlidXRlRGV0YWlscyAoKSB7XG4gICAgY29uc3QgYWxsQXR0cnMgPSBzdXBlci5nZXRBdHRyaWJ1dGVEZXRhaWxzKCk7XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLnJlZHVjZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZSA9IHRoaXMucGFyZW50VGFibGU7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdyxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmFjZXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICB0aGlzLl92YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUgfHwgIXRoaXMuX3ZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIG9iai52YWx1ZSA9IHRoaXMuX3ZhbHVlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBgWyR7dGhpcy5fdmFsdWV9XWA7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgLy8gTm9ybWFsIGZhY2V0aW5nIGp1c3QgZ2l2ZXMgYSBzdWJzZXQgb2YgdGhlIG9yaWdpbmFsIHRhYmxlXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3c6IE9iamVjdC5hc3NpZ24oe30sIHdyYXBwZWRQYXJlbnQucm93KSxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRmFjZXRlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBUcmFuc3Bvc2VkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2luZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICBpZiAodGhpcy5faW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5pbmRleCA9IHRoaXMuX2luZGV4O1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiBg4bWAJHt0aGlzLl9pbmRleH1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICAvLyBQcmUtYnVpbGQgdGhlIHBhcmVudCB0YWJsZSdzIGNhY2hlXG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcblxuICAgIC8vIEl0ZXJhdGUgdGhlIHJvdydzIGF0dHJpYnV0ZXMgYXMgaW5kZXhlc1xuICAgIGNvbnN0IHdyYXBwZWRQYXJlbnQgPSBwYXJlbnRUYWJsZS5fY2FjaGVbdGhpcy5faW5kZXhdIHx8IHsgcm93OiB7fSB9O1xuICAgIGZvciAoY29uc3QgWyBpbmRleCwgdmFsdWUgXSBvZiBPYmplY3QuZW50cmllcyh3cmFwcGVkUGFyZW50LnJvdykpIHtcbiAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIHJvdzogdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IHZhbHVlIDogeyB2YWx1ZSB9LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFRyYW5zcG9zZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGF3YWl0IHBhcmVudFRhYmxlLmJ1aWxkQ2FjaGUoKTtcbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5LiBXZSBvbmx5XG4gICAgLy8gY2FyZSBhYm91dCBpbmNsdWRpbmcgcm93cyB0aGF0IGhhdmUgZXhhY3QgbWF0Y2hlcyBhY3Jvc3MgYWxsIHRhYmxlcywgc29cbiAgICAvLyB3ZSBjYW4ganVzdCBwaWNrIG9uZSBwYXJlbnQgdGFibGUgdG8gaXRlcmF0ZVxuICAgIGNvbnN0IGJhc2VQYXJlbnRUYWJsZSA9IHBhcmVudFRhYmxlc1swXTtcbiAgICBjb25zdCBvdGhlclBhcmVudFRhYmxlcyA9IHBhcmVudFRhYmxlcy5zbGljZSgxKTtcbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIGJhc2VQYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZSkpIHtcbiAgICAgICAgLy8gT25lIG9mIHRoZSBwYXJlbnQgdGFibGVzIHdhcyByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghb3RoZXJQYXJlbnRUYWJsZXMuZXZlcnkodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSkpIHtcbiAgICAgICAgLy8gTm8gbWF0Y2ggaW4gb25lIG9mIHRoZSBvdGhlciB0YWJsZXM7IG9taXQgdGhpcyBpdGVtXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVE9ETzogYWRkIGVhY2ggcGFyZW50IHRhYmxlcycga2V5cyBhcyBhdHRyaWJ1dGUgdmFsdWVzXG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICBpdGVtc1RvQ29ubmVjdDogcGFyZW50VGFibGVzLm1hcCh0YWJsZSA9PiB0YWJsZS5fY2FjaGVbaW5kZXhdKVxuICAgICAgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICB5aWVsZCBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcbmltcG9ydCBHZW5lcmljV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMuY2xhc3NJZCA9IG9wdGlvbnMuY2xhc3NJZDtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLm1vZGVsIHx8ICF0aGlzLmNsYXNzSWQgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCwgY2xhc3NJZCwgYW5kIHRhYmxlSWQgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fY2xhc3NOYW1lID0gb3B0aW9ucy5jbGFzc05hbWUgfHwgbnVsbDtcbiAgICB0aGlzLmFubm90YXRpb25zID0gb3B0aW9ucy5hbm5vdGF0aW9ucyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb25zOiB0aGlzLmFubm90YXRpb25zXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnTm9kZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIG9wdGlvbnMub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgX2Rlcml2ZU5ld0NsYXNzIChuZXdUYWJsZSwgdHlwZSA9IHRoaXMuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHRhYmxlSWQ6IG5ld1RhYmxlLnRhYmxlSWQsXG4gICAgICB0eXBlXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKSk7XG4gIH1cbiAgZXhwYW5kIChhdHRyaWJ1dGUsIGRlbGltaXRlcikge1xuICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyh0aGlzLnRhYmxlLmV4cGFuZChhdHRyaWJ1dGUsIGRlbGltaXRlcikpO1xuICB9XG4gIGNsb3NlZEZhY2V0IChhdHRyaWJ1dGUsIHZhbHVlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZEZhY2V0KGF0dHJpYnV0ZSwgdmFsdWVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGNsb3NlZFRyYW5zcG9zZSAoaW5kZXhlcykge1xuICAgIHJldHVybiB0aGlzLnRhYmxlLmNsb3NlZFRyYW5zcG9zZShpbmRleGVzKS5tYXAobmV3VGFibGUgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5UcmFuc3Bvc2UgKCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuVHJhbnNwb3NlKCkpIHtcbiAgICAgIHlpZWxkIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBnZXRTYW1wbGVHcmFwaCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMucm9vdENsYXNzID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5nZXRTYW1wbGVHcmFwaChvcHRpb25zKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNDbGFzcywgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopQ2xhc3MvLmV4ZWModGhpcy5uYW1lKVsxXTtcbiAgfVxufSk7XG5leHBvcnQgZGVmYXVsdCBHZW5lcmljQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGVkZ2VzIChvcHRpb25zID0geyBsaW1pdDogSW5maW5pdHkgfSkge1xuICAgIGNvbnN0IGVkZ2VJZHMgPSBvcHRpb25zLmVkZ2VJZHMgfHwgdGhpcy5jbGFzc09iai5lZGdlQ2xhc3NJZHM7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoY29uc3QgZWRnZUlkIG9mIE9iamVjdC5rZXlzKGVkZ2VJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLmNsYXNzT2JqLm1vZGVsLmNsYXNzZXNbZWRnZUlkXTtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc09iai5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMudGFibGVJZHMgPSBlZGdlQ2xhc3Muc291cmNlVGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgICAuY29uY2F0KFtlZGdlQ2xhc3MudGFibGVJZF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICB9XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucykpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgICAgaSsrO1xuICAgICAgICBpZiAoaSA+PSBvcHRpb25zLmxpbWl0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICogcGFpcndpc2VOZWlnaGJvcmhvb2QgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgdGhpcy5lZGdlcyhvcHRpb25zKSkge1xuICAgICAgeWllbGQgKiBlZGdlLnBhaXJ3aXNlRWRnZXMob3B0aW9ucyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgTm9kZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvTm9kZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gIH1cbiAgKiBlZGdlQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmNsYXNzT2JqID0gdGhpcztcbiAgICByZXR1cm4gbmV3IE5vZGVXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKHsgYXV0b2Nvbm5lY3QgPSBmYWxzZSB9KSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmICghYXV0b2Nvbm5lY3QgfHwgZWRnZUNsYXNzSWRzLmxlbmd0aCA+IDIpIHtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBtb3JlIHRoYW4gdHdvIGVkZ2VzLCBicmVhayBhbGwgY29ubmVjdGlvbnMgYW5kIG1ha2VcbiAgICAgIC8vIHRoaXMgYSBmbG9hdGluZyBlZGdlIChmb3Igbm93LCB3ZSdyZSBub3QgZGVhbGluZyBpbiBoeXBlcmVkZ2VzKVxuICAgICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICB9IGVsc2UgaWYgKGF1dG9jb25uZWN0ICYmIGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIFdpdGggb25seSBvbmUgY29ubmVjdGlvbiwgdGhpcyBub2RlIHNob3VsZCBiZWNvbWUgYSBzZWxmLWVkZ2VcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgLy8gQXJlIHdlIHRoZSBzb3VyY2Ugb3IgdGFyZ2V0IG9mIHRoZSBleGlzdGluZyBlZGdlIChpbnRlcm5hbGx5LCBpbiB0ZXJtc1xuICAgICAgLy8gb2Ygc291cmNlSWQgLyB0YXJnZXRJZCwgbm90IGVkZ2VDbGFzcy5kaXJlY3Rpb24pP1xuICAgICAgY29uc3QgaXNTb3VyY2UgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkO1xuXG4gICAgICAvLyBBcyB3ZSdyZSBjb252ZXJ0ZWQgdG8gYW4gZWRnZSwgb3VyIG5ldyByZXN1bHRpbmcgc291cmNlIEFORCB0YXJnZXRcbiAgICAgIC8vIHNob3VsZCBiZSB3aGF0ZXZlciBpcyBhdCB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcyAoaWYgYW55dGhpbmcpXG4gICAgICBpZiAoaXNTb3VyY2UpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgbm9kZSBjbGFzcyBvbiB0aGUgb3RoZXIgZW5kIG9mIGVkZ2VDbGFzcywgYWRkIG91clxuICAgICAgLy8gaWQgdG8gaXRzIGxpc3Qgb2YgY29ubmVjdGlvbnNcbiAgICAgIGNvbnN0IG5vZGVDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tvcHRpb25zLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgaWYgKG5vZGVDbGFzcykge1xuICAgICAgICBub2RlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyB0YWJsZUlkIGxpc3RzIHNob3VsZCBlbWFuYXRlIG91dCBmcm9tIHRoZSAobmV3KSBlZGdlIHRhYmxlOyBhc3N1bWluZ1xuICAgICAgLy8gKGZvciBhIG1vbWVudCkgdGhhdCBpc1NvdXJjZSA9PT0gdHJ1ZSwgd2UnZCBjb25zdHJ1Y3QgdGhlIHRhYmxlSWQgbGlzdFxuICAgICAgLy8gbGlrZSB0aGlzOlxuICAgICAgbGV0IHRhYmxlSWRMaXN0ID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyBlZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAoIWlzU291cmNlKSB7XG4gICAgICAgIC8vIFdob29wcywgZ290IGl0IGJhY2t3YXJkcyFcbiAgICAgICAgdGFibGVJZExpc3QucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFibGVJZExpc3Q7XG4gICAgfSBlbHNlIGlmIChhdXRvY29ubmVjdCAmJiBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAvLyBPa2F5LCB3ZSd2ZSBnb3QgdHdvIGVkZ2VzLCBzbyB0aGlzIGlzIGEgbGl0dGxlIG1vcmUgc3RyYWlnaHRmb3J3YXJkXG4gICAgICBsZXQgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBsZXQgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAvLyBGaWd1cmUgb3V0IHRoZSBkaXJlY3Rpb24sIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy5kaXJlY3RlZCAmJiB0YXJnZXRFZGdlQ2xhc3MuZGlyZWN0ZWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBoYXBwZW5lZCB0byBnZXQgdGhlIGVkZ2VzIGluIG9yZGVyOyBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQgJiZcbiAgICAgICAgICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgZ290IHRoZSBlZGdlcyBiYWNrd2FyZHM7IHN3YXAgdGhlbSBhbmQgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgICAgICBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gT2theSwgbm93IHdlIGtub3cgaG93IHRvIHNldCBzb3VyY2UgLyB0YXJnZXQgaWRzXG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IHRhcmdldEVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgLy8gQWRkIHRoaXMgY2xhc3MgdG8gdGhlIHNvdXJjZSdzIC8gdGFyZ2V0J3MgZWRnZUNsYXNzSWRzXG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy5zb3VyY2VDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB0aGlzLm1vZGVsLmNsYXNzZXNbb3B0aW9ucy50YXJnZXRDbGFzc0lkXS5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICAvLyBDb25jYXRlbmF0ZSB0aGUgaW50ZXJtZWRpYXRlIHRhYmxlSWQgbGlzdHMsIGVtYW5hdGluZyBvdXQgZnJvbSB0aGVcbiAgICAgIC8vIChuZXcpIGVkZ2UgdGFibGVcbiAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIHNvdXJjZUVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoc291cmNlRWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlVGFibGVJZHMucmV2ZXJzZSgpO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcyA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgdGFyZ2V0RWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdCh0YXJnZXRFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YXJnZXRUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICAvLyBEaXNjb25uZWN0IHRoZSBleGlzdGluZyBlZGdlIGNsYXNzZXMgZnJvbSB0aGUgbmV3IChub3cgZWRnZSkgY2xhc3NcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfVxuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzc0lkcztcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgbGV0IHRoaXNIYXNoLCBvdGhlckhhc2gsIHNvdXJjZVRhYmxlSWRzLCB0YXJnZXRUYWJsZUlkcztcbiAgICBpZiAoYXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGU7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzSGFzaCA9IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgICBzb3VyY2VUYWJsZUlkcyA9IFsgdGhpc0hhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICBpZiAob3RoZXJBdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlO1xuICAgICAgdGFyZ2V0VGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXJIYXNoID0gb3RoZXJOb2RlQ2xhc3MudGFibGUuYWdncmVnYXRlKG90aGVyQXR0cmlidXRlKTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gWyBvdGhlckhhc2gudGFibGVJZCBdO1xuICAgIH1cbiAgICAvLyBJZiB3ZSBoYXZlIGEgc2VsZiBlZGdlIGNvbm5lY3RpbmcgdGhlIHNhbWUgYXR0cmlidXRlLCB3ZSBjYW4ganVzdCB1c2VcbiAgICAvLyB0aGUgQWdncmVnYXRlZFRhYmxlIGFzIHRoZSBlZGdlIHRhYmxlOyBvdGhlcndpc2Ugd2UgbmVlZCB0byBjcmVhdGUgYVxuICAgIC8vIENvbm5lY3RlZFRhYmxlXG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzID09PSBvdGhlck5vZGVDbGFzcyAmJiBhdHRyaWJ1dGUgPT09IG90aGVyQXR0cmlidXRlXG4gICAgICA/IHRoaXNIYXNoIDogdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBzb3VyY2VDbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICBzb3VyY2VUYWJsZUlkcyxcbiAgICAgIHRhcmdldENsYXNzSWQ6IG90aGVyTm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICB0YXJnZXRUYWJsZUlkc1xuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3RWRnZUNsYXNzO1xuICB9XG4gIGNvbm5lY3RUb0VkZ2VDbGFzcyAob3B0aW9ucykge1xuICAgIGNvbnN0IGVkZ2VDbGFzcyA9IG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIGRlbGV0ZSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBvcHRpb25zLm5vZGVDbGFzcyA9IHRoaXM7XG4gICAgcmV0dXJuIGVkZ2VDbGFzcy5jb25uZWN0VG9Ob2RlQ2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSBzdXBlci5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgICB0aGlzLmNvbm5lY3RUb05vZGVDbGFzcyh7XG4gICAgICBvdGhlck5vZGVDbGFzczogbmV3Tm9kZUNsYXNzLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgb3RoZXJBdHRyaWJ1dGU6IG51bGxcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzIG9mIHRoaXMuY29ubmVjdGVkQ2xhc3NlcygpKSB7XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZUNsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBzb3VyY2VOb2RlcyAob3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKHRoaXMuY2xhc3NPYmouc291cmNlQ2xhc3NJZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBzb3VyY2VUYWJsZUlkID0gdGhpcy5jbGFzc09iai5tb2RlbFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmoubW9kZWxcbiAgICAgIC5jbGFzc2VzW3RoaXMuY2xhc3NPYmoudGFyZ2V0Q2xhc3NJZF0udGFibGVJZDtcbiAgICBvcHRpb25zLnRhYmxlSWRzID0gdGhpcy5jbGFzc09iai50YXJnZXRUYWJsZUlkc1xuICAgICAgLmNvbmNhdChbIHRhcmdldFRhYmxlSWQgXSk7XG4gICAgeWllbGQgKiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKTtcbiAgfVxuICBhc3luYyAqIHBhaXJ3aXNlRWRnZXMgKG9wdGlvbnMpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICAgIHlpZWxkIHsgc291cmNlLCBlZGdlOiB0aGlzLCB0YXJnZXQgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgaHlwZXJlZGdlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc291cmNlczogW10sXG4gICAgICB0YXJnZXRzOiBbXSxcbiAgICAgIGVkZ2U6IHRoaXNcbiAgICB9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgc291cmNlIG9mIHRoaXMuc291cmNlTm9kZXMob3B0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHNvdXJjZSk7XG4gICAgfVxuICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0Tm9kZXMob3B0aW9ucykpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRhcmdldCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5pbXBvcnQgRWRnZVdyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvRWRnZVdyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuXG4gICAgLy8gc291cmNlVGFibGVJZHMgYW5kIHRhcmdldFRhYmxlSWRzIGFyZSBsaXN0cyBvZiBhbnkgaW50ZXJtZWRpYXRlIHRhYmxlcyxcbiAgICAvLyBiZWdpbm5pbmcgd2l0aCB0aGUgZWRnZSB0YWJsZSAoYnV0IG5vdCBpbmNsdWRpbmcgaXQpLCB0aGF0IGxlYWQgdG8gdGhlXG4gICAgLy8gc291cmNlIC8gdGFyZ2V0IG5vZGUgdGFibGVzIChidXQgbm90IGluY2x1ZGluZykgdGhvc2VcblxuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMuc291cmNlQ2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBvcHRpb25zLnNvdXJjZVRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBvcHRpb25zLnRhcmdldFRhYmxlSWRzIHx8IFtdO1xuICAgIHRoaXMuZGlyZWN0ZWQgPSBvcHRpb25zLmRpcmVjdGVkIHx8IGZhbHNlO1xuICB9XG4gIGdldCBzb3VyY2VDbGFzcyAoKSB7XG4gICAgcmV0dXJuICh0aGlzLnNvdXJjZUNsYXNzSWQgJiYgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0pIHx8IG51bGw7XG4gIH1cbiAgZ2V0IHRhcmdldENsYXNzICgpIHtcbiAgICByZXR1cm4gKHRoaXMudGFyZ2V0Q2xhc3NJZCAmJiB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkgfHwgbnVsbDtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHRlbXAub3ZlcndyaXRlID0gdHJ1ZTtcbiAgICBjb25zdCBuZXdOb2RlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHRlbXApO1xuXG4gICAgaWYgKHRlbXAuc291cmNlQ2xhc3NJZCkge1xuICAgICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC5zb3VyY2VDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnNvdXJjZVRhYmxlSWRzLCBzb3VyY2VDbGFzcyk7XG4gICAgICBjb25zdCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogdGVtcC5zb3VyY2VDbGFzc0lkLFxuICAgICAgICBzb3VyY2VUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICB0YXJnZXRDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbc291cmNlRWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRlbXAudGFyZ2V0Q2xhc3NJZCAmJiB0ZW1wLnNvdXJjZUNsYXNzSWQgIT09IHRlbXAudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgY29uc3QgdGFyZ2V0Q2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGVtcC50YXJnZXRDbGFzc0lkXTtcbiAgICAgIGNvbnN0IHtcbiAgICAgICAgbm9kZVRhYmxlSWRMaXN0LFxuICAgICAgICBlZGdlVGFibGVJZCxcbiAgICAgICAgZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9ID0gdGhpcy5fc3BsaXRUYWJsZUlkTGlzdCh0ZW1wLnRhcmdldFRhYmxlSWRzLCB0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBlZGdlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZCxcbiAgICAgICAgdGFyZ2V0VGFibGVJZHM6IG5vZGVUYWJsZUlkTGlzdFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICAqIGNvbm5lY3RlZENsYXNzZXMgKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB5aWVsZCB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXTtcbiAgICB9XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzIChvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3NvdXJjZScpIHtcbiAgICAgIHRoaXMuY29ubmVjdFNvdXJjZShvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc2lkZSA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldChvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb2xpdGljYWxPdXRzaWRlckVycm9yOiBcIiR7b3B0aW9ucy5zaWRlfVwiIGlzIGFuIGludmFsaWQgc2lkZWApO1xuICAgIH1cbiAgfVxuICB0b2dnbGVEaXJlY3Rpb24gKGRpcmVjdGVkKSB7XG4gICAgaWYgKGRpcmVjdGVkID09PSBmYWxzZSB8fCB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGRlbGV0ZSB0aGlzLnN3YXBwZWREaXJlY3Rpb247XG4gICAgfSBlbHNlIGlmICghdGhpcy5kaXJlY3RlZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICB0aGlzLnN3YXBwZWREaXJlY3Rpb24gPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGlyZWN0ZWQgd2FzIGFscmVhZHkgdHJ1ZSwganVzdCBzd2l0Y2ggc291cmNlIGFuZCB0YXJnZXRcbiAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZVRhYmxlSWRzO1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IHRoaXMudGFyZ2V0VGFibGVJZHM7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gdGVtcDtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgY29ubmVjdFNvdXJjZSAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbFxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy50YWJsZS5hZ2dyZWdhdGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFsgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKS50YWJsZUlkIF07XG4gICAgaWYgKGVkZ2VBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMudW5zaGlmdChlZGdlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgaWYgKG5vZGVBdHRyaWJ1dGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc291cmNlVGFibGVJZHMucHVzaChub2RlSGFzaC50YWJsZUlkKTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy50YXJnZXRUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRpc2Nvbm5lY3RTb3VyY2UgKCkge1xuICAgIGNvbnN0IGV4aXN0aW5nU291cmNlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBpZiAoZXhpc3RpbmdTb3VyY2VDbGFzcykge1xuICAgICAgZGVsZXRlIGV4aXN0aW5nU291cmNlQ2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBudWxsO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUYXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1RhcmdldENsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdUYXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGUgKCkge1xuICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCgpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEVkZ2VDbGFzcztcbiIsImltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4uL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5cbmltcG9ydCAqIGFzIFRBQkxFUyBmcm9tICcuLi9UYWJsZXMvVGFibGVzLmpzJztcbmltcG9ydCAqIGFzIENMQVNTRVMgZnJvbSAnLi4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcblxuY29uc3QgREFUQUxJQl9GT1JNQVRTID0ge1xuICAnanNvbic6ICdqc29uJyxcbiAgJ2Nzdic6ICdjc3YnLFxuICAndHN2JzogJ3RzdicsXG4gICd0b3BvanNvbic6ICd0b3BvanNvbicsXG4gICd0cmVlanNvbic6ICd0cmVlanNvbidcbn07XG5cbmNsYXNzIE5ldHdvcmtNb2RlbCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKHtcbiAgICBvcmlncmFwaCxcbiAgICBtb2RlbElkLFxuICAgIG5hbWUgPSBtb2RlbElkLFxuICAgIGFubm90YXRpb25zID0ge30sXG4gICAgY2xhc3NlcyA9IHt9LFxuICAgIHRhYmxlcyA9IHt9XG4gIH0pIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX29yaWdyYXBoID0gb3JpZ3JhcGg7XG4gICAgdGhpcy5tb2RlbElkID0gbW9kZWxJZDtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuYW5ub3RhdGlvbnMgPSBhbm5vdGF0aW9ucztcbiAgICB0aGlzLmNsYXNzZXMgPSB7fTtcbiAgICB0aGlzLnRhYmxlcyA9IHt9O1xuXG4gICAgdGhpcy5fbmV4dENsYXNzSWQgPSAxO1xuICAgIHRoaXMuX25leHRUYWJsZUlkID0gMTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzLFxuICAgICAgdGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7dGhpcy5fbmV4dFRhYmxlSWR9YDtcbiAgICAgIHRoaXMuX25leHRUYWJsZUlkICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF0gPSBuZXcgVEFCTEVTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXTtcbiAgfVxuICBjcmVhdGVDbGFzcyAob3B0aW9ucyA9IHsgc2VsZWN0b3I6IGBlbXB0eWAgfSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5jbGFzc0lkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0pKSB7XG4gICAgICBvcHRpb25zLmNsYXNzSWQgPSBgY2xhc3Mke3RoaXMuX25leHRDbGFzc0lkfWA7XG4gICAgICB0aGlzLl9uZXh0Q2xhc3NJZCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXSA9IG5ldyBDTEFTU0VTW29wdGlvbnMudHlwZV0ob3B0aW9ucyk7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cbiAgcmVuYW1lIChuZXdOYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmV3TmFtZTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFubm90YXRlIChrZXksIHZhbHVlKSB7XG4gICAgdGhpcy5hbm5vdGF0aW9uc1trZXldID0gdmFsdWU7XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkZWxldGVBbm5vdGF0aW9uIChrZXkpIHtcbiAgICBkZWxldGUgdGhpcy5hbm5vdGF0aW9uc1trZXldO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLl9vcmlncmFwaC5kZWxldGVNb2RlbCh0aGlzLm1vZGVsSWQpO1xuICB9XG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseWApO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBleHRlbnNpb25PdmVycmlkZSBhbGxvd3MgdGhpbmdzIGxpa2UgdG9wb2pzb24gb3IgdHJlZWpzb24gKHRoYXQgZG9uJ3RcbiAgICAvLyBoYXZlIHN0YW5kYXJkaXplZCBtaW1lVHlwZXMpIHRvIGJlIHBhcnNlZCBjb3JyZWN0bHlcbiAgICBsZXQgdGV4dCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZWFkZXIgPSBuZXcgdGhpcy5fb3JpZ3JhcGguRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24sIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICghZXh0ZW5zaW9uKSB7XG4gICAgICBleHRlbnNpb24gPSBtaW1lLmV4dGVuc2lvbihtaW1lLmxvb2t1cChuYW1lKSk7XG4gICAgfVxuICAgIGlmIChEQVRBTElCX0ZPUk1BVFNbZXh0ZW5zaW9uXSkge1xuICAgICAgZGF0YSA9IGRhdGFsaWIucmVhZCh0ZXh0LCB7IHR5cGU6IGV4dGVuc2lvbiB9KTtcbiAgICAgIGlmIChleHRlbnNpb24gPT09ICdjc3YnIHx8IGV4dGVuc2lvbiA9PT0gJ3RzdicpIHtcbiAgICAgICAgYXR0cmlidXRlcyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHIgb2YgZGF0YS5jb2x1bW5zKSB7XG4gICAgICAgICAgYXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIGRhdGEuY29sdW1ucztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGV4dGVuc2lvbiA9PT0gJ3htbCcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5pbXBsZW1lbnRlZCcpO1xuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAndHh0Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgZmlsZSBleHRlbnNpb246ICR7ZXh0ZW5zaW9ufWApO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGRTdGF0aWNUYWJsZSh7IG5hbWUsIGRhdGEsIGF0dHJpYnV0ZXMgfSk7XG4gIH1cbiAgYWRkU3RhdGljVGFibGUgKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLnR5cGUgPSBvcHRpb25zLmRhdGEgaW5zdGFuY2VvZiBBcnJheSA/ICdTdGF0aWNUYWJsZScgOiAnU3RhdGljRGljdFRhYmxlJztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgaWYgKCFlcnIuaW5Vc2UpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBhc3luYyBnZXRTYW1wbGVHcmFwaCAoe1xuICAgIHJvb3RDbGFzcyA9IG51bGwsXG4gICAgYnJhbmNoTGltaXQgPSBJbmZpbml0eSxcbiAgICBub2RlTGltaXQgPSBJbmZpbml0eSxcbiAgICBlZGdlTGltaXQgPSBJbmZpbml0eSxcbiAgICB0cmlwbGVMaW1pdCA9IEluZmluaXR5XG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IHNhbXBsZUdyYXBoID0ge1xuICAgICAgbm9kZXM6IFtdLFxuICAgICAgbm9kZUxvb2t1cDoge30sXG4gICAgICBlZGdlczogW10sXG4gICAgICBlZGdlTG9va3VwOiB7fSxcbiAgICAgIGxpbmtzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgbnVtVHJpcGxlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLm5vZGVMb29rdXBbbm9kZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZXMucHVzaChub2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5ub2Rlcy5sZW5ndGggPD0gbm9kZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkRWRnZSA9IGVkZ2UgPT4ge1xuICAgICAgaWYgKHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aDtcbiAgICAgICAgc2FtcGxlR3JhcGguZWRnZXMucHVzaChlZGdlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzYW1wbGVHcmFwaC5lZGdlcy5sZW5ndGggPD0gZWRnZUxpbWl0O1xuICAgIH07XG4gICAgY29uc3QgYWRkVHJpcGxlID0gKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSA9PiB7XG4gICAgICBpZiAoYWRkTm9kZShzb3VyY2UpICYmIGFkZE5vZGUodGFyZ2V0KSAmJiBhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmxpbmtzLnB1c2goe1xuICAgICAgICAgIHNvdXJjZTogc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0sXG4gICAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgICBlZGdlOiBzYW1wbGVHcmFwaC5lZGdlTG9va3VwW2VkZ2UuaW5zdGFuY2VJZF1cbiAgICAgICAgfSk7XG4gICAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgICAgcmV0dXJuIG51bVRyaXBsZXMgPD0gdHJpcGxlTGltaXQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmICghYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGVkZ2Ugb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKCFhZGRFZGdlKGVkZ2UpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGVkZ2UucGFpcndpc2VFZGdlcyh7IGxpbWl0OiBicmFuY2hMaW1pdCB9KSkge1xuICAgICAgICAgICAgaWYgKCFhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNhbXBsZUdyYXBoO1xuICB9XG4gIGFzeW5jIGdldEluc3RhbmNlR3JhcGggKGluc3RhbmNlcykge1xuICAgIGlmICghaW5zdGFuY2VzKSB7XG4gICAgICAvLyBXaXRob3V0IHNwZWNpZmllZCBpbnN0YW5jZXMsIGp1c3QgcGljayB0aGUgZmlyc3QgNSBmcm9tIGVhY2ggbm9kZVxuICAgICAgLy8gYW5kIGVkZ2UgY2xhc3NcbiAgICAgIGluc3RhbmNlcyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyB8fCBjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGl0ZW0gb2YgY2xhc3NPYmoudGFibGUuaXRlcmF0ZSh7IGxpbWl0OiA1IH0pKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXMucHVzaChpdGVtKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBncmFwaCA9IHtcbiAgICAgIG5vZGVzOiBbXSxcbiAgICAgIG5vZGVMb29rdXA6IHt9LFxuICAgICAgZWRnZXM6IFtdXG4gICAgfTtcbiAgICBjb25zdCBlZGdlVGFibGVFbnRyaWVzID0gW107XG4gICAgZm9yIChjb25zdCBpbnN0YW5jZSBvZiBpbnN0YW5jZXMpIHtcbiAgICAgIGlmIChpbnN0YW5jZS50eXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgZ3JhcGgubm9kZUxvb2t1cFtpbnN0YW5jZS5pbnN0YW5jZUlkXSA9IGdyYXBoLm5vZGVzLmxlbmd0aDtcbiAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7XG4gICAgICAgICAgbm9kZUluc3RhbmNlOiBpbnN0YW5jZSxcbiAgICAgICAgICBkdW1teTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICBlZGdlVGFibGVFbnRyaWVzLnB1c2goaW5zdGFuY2UpO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKGNvbnN0IGVkZ2VJbnN0YW5jZSBvZiBlZGdlVGFibGVFbnRyaWVzKSB7XG4gICAgICBjb25zdCBzb3VyY2VzID0gW107XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiBlZGdlSW5zdGFuY2Uuc291cmNlTm9kZXMoKSkge1xuICAgICAgICBpZiAoZ3JhcGgubm9kZUxvb2t1cFtzb3VyY2UuaW5zdGFuY2VJZF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHNvdXJjZXMucHVzaChncmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgdGFyZ2V0IG9mIGVkZ2VJbnN0YW5jZS50YXJnZXROb2RlcygpKSB7XG4gICAgICAgIGlmIChncmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdGFyZ2V0cy5wdXNoKGdyYXBoLm5vZGVMb29rdXBbdGFyZ2V0Lmluc3RhbmNlSWRdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHNvdXJjZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIC8vIFdlIGhhdmUgY29tcGxldGVseSBoYW5naW5nIGVkZ2VzLCBtYWtlIGR1bW15IG5vZGVzIGZvciB0aGVcbiAgICAgICAgICAvLyBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgICAgIGdyYXBoLmVkZ2VzLnB1c2goe1xuICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLm5vZGVzLmxlbmd0aCArIDFcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIFRoZSBzb3VyY2VzIGFyZSBoYW5naW5nLCBidXQgd2UgaGF2ZSB0YXJnZXRzXG4gICAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGFyZ2V0cykge1xuICAgICAgICAgICAgZ3JhcGguZWRnZXMucHVzaCh7XG4gICAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgICAgc291cmNlOiBncmFwaC5ub2Rlcy5sZW5ndGgsXG4gICAgICAgICAgICAgIHRhcmdldFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBncmFwaC5ub2Rlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRhcmdldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIFRoZSB0YXJnZXRzIGFyZSBoYW5naW5nLCBidXQgd2UgaGF2ZSBzb3VyY2VzXG4gICAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgIGVkZ2VJbnN0YW5jZSxcbiAgICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGgubm9kZXMubGVuZ3RoXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGgubm9kZXMucHVzaCh7IGR1bW15OiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBOZWl0aGVyIHRoZSBzb3VyY2UsIG5vciB0aGUgdGFyZ2V0IGFyZSBoYW5naW5nXG4gICAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0YXJnZXRzKSB7XG4gICAgICAgICAgICBncmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgICAgICAgZWRnZUluc3RhbmNlLFxuICAgICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICAgIHRhcmdldFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoe1xuICAgIHJhdyA9IHRydWUsXG4gICAgaW5jbHVkZUR1bW1pZXMgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NlcyA9IFtdO1xuICAgIGxldCBncmFwaCA9IHtcbiAgICAgIGNsYXNzZXM6IFtdLFxuICAgICAgY2xhc3NMb29rdXA6IHt9LFxuICAgICAgY2xhc3NDb25uZWN0aW9uczogW11cbiAgICB9O1xuXG4gICAgY29uc3QgY2xhc3NMaXN0ID0gT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpO1xuXG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBjbGFzc0xpc3QpIHtcbiAgICAgIC8vIEFkZCBhbmQgaW5kZXggdGhlIGNsYXNzIGFzIGEgbm9kZVxuICAgICAgZ3JhcGguY2xhc3NMb29rdXBbY2xhc3NPYmouY2xhc3NJZF0gPSBncmFwaC5jbGFzc2VzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGNsYXNzU3BlYyA9IHJhdyA/IGNsYXNzT2JqLl90b1Jhd09iamVjdCgpIDogeyBjbGFzc09iaiB9O1xuICAgICAgY2xhc3NTcGVjLnR5cGUgPSBjbGFzc09iai5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKGNsYXNzU3BlYyk7XG5cbiAgICAgIGlmIChjbGFzc09iai50eXBlID09PSAnRWRnZScpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGVkZ2UgY2xhc3Mgc28gd2UgY2FuIGNyZWF0ZSBjbGFzc0Nvbm5lY3Rpb25zIGxhdGVyXG4gICAgICAgIGVkZ2VDbGFzc2VzLnB1c2goY2xhc3NPYmopO1xuICAgICAgfSBlbHNlIGlmIChjbGFzc09iai50eXBlID09PSAnTm9kZScgJiYgaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgbm9kZVxuICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgIGlkOiBgJHtjbGFzc09iai5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCAtIDEsXG4gICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICBkaXJlY3RlZDogZmFsc2UsXG4gICAgICAgICAgbG9jYXRpb246ICdub2RlJyxcbiAgICAgICAgICBkdW1teTogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIENyZWF0ZSBleGlzdGluZyBjbGFzc0Nvbm5lY3Rpb25zXG4gICAgICBmb3IgKGNvbnN0IGVkZ2VDbGFzcyBvZiBlZGdlQ2xhc3Nlcykge1xuICAgICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBDb25uZWN0IHRoZSBzb3VyY2Ugbm9kZSBjbGFzcyB0byB0aGUgZWRnZSBjbGFzc1xuICAgICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWR9PiR7ZWRnZUNsYXNzLmNsYXNzSWR9YCxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWRdLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBzb3VyY2UgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGBkdW1teT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICdzb3VyY2UnLFxuICAgICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZWRnZUNsYXNzLnRhcmdldENsYXNzSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBDb25uZWN0IHRoZSBlZGdlIGNsYXNzIHRvIHRoZSB0YXJnZXQgbm9kZSBjbGFzc1xuICAgICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgICBpZDogYCR7ZWRnZUNsYXNzLmNsYXNzSWR9PiR7ZWRnZUNsYXNzLnRhcmdldENsYXNzSWR9YCxcbiAgICAgICAgICAgIHNvdXJjZTogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgdGFyZ2V0OiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZF0sXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5jbHVkZUR1bW1pZXMpIHtcbiAgICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSB0YXJnZXQgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT5kdW1teWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgICBkaXJlY3RlZDogZWRnZUNsYXNzLmRpcmVjdGVkLFxuICAgICAgICAgICAgbG9jYXRpb246ICd0YXJnZXQnLFxuICAgICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBncmFwaC5jbGFzc2VzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0RnVsbFNjaGVtYUdyYXBoICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0aGlzLmdldE5ldHdvcmtNb2RlbEdyYXBoKCksIHRoaXMuZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgoKSk7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRGdWxsU2NoZW1hR3JhcGgoKTtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGxldCBjbGFzc2VzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGguY2xhc3NlcyxcbiAgICAgIG5hbWU6ICdDbGFzc2VzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgY2xhc3NDb25uZWN0aW9ucyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBuYW1lOiAnQ2xhc3MgQ29ubmVjdGlvbnMnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGxldCB0YWJsZXMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZXMsXG4gICAgICBuYW1lOiAnVGFibGVzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgdGFibGVMaW5rcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLnRhYmxlTGlua3MsXG4gICAgICBuYW1lOiAnVGFibGUgTGlua3MnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgY2xhc3Nlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiBjbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICB0YWJsZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogdGFibGVMaW5rcyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAndGFyZ2V0J1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiAndGFibGVJZCdcbiAgICB9KS5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGVzJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCBudWxsO1xuICB9XG4gIHNldCBjdXJyZW50TW9kZWwgKG1vZGVsKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBtb2RlbCA/IG1vZGVsLm1vZGVsSWQgOiBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgY3JlYXRlTW9kZWwgKG9wdGlvbnMgPSB7fSkge1xuICAgIHdoaWxlICghb3B0aW9ucy5tb2RlbElkIHx8IHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0pIHtcbiAgICAgIG9wdGlvbnMubW9kZWxJZCA9IGBtb2RlbCR7TkVYVF9NT0RFTF9JRH1gO1xuICAgICAgTkVYVF9NT0RFTF9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm9yaWdyYXBoID0gdGhpcztcbiAgICB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChvcHRpb25zKTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG9wdGlvbnMubW9kZWxJZDtcbiAgICB0aGlzLnNhdmUoKTtcbiAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsc1tvcHRpb25zLm1vZGVsSWRdO1xuICB9XG4gIGRlbGV0ZU1vZGVsIChtb2RlbElkID0gdGhpcy5jdXJyZW50TW9kZWxJZCkge1xuICAgIGlmICghdGhpcy5tb2RlbHNbbW9kZWxJZF0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZGVsZXRlIG5vbi1leGlzdGVudCBtb2RlbDogJHttb2RlbElkfWApO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5tb2RlbHNbbW9kZWxJZF07XG4gICAgaWYgKHRoaXMuX2N1cnJlbnRNb2RlbElkID09PSBtb2RlbElkKSB7XG4gICAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NoYW5nZUN1cnJlbnRNb2RlbCcpO1xuICAgIH1cbiAgICB0aGlzLnNhdmUoKTtcbiAgfVxuICBkZWxldGVBbGxNb2RlbHMgKCkge1xuICAgIHRoaXMubW9kZWxzID0ge307XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgT3JpZ3JhcGg7XG4iLCJpbXBvcnQgT3JpZ3JhcGggZnJvbSAnLi9PcmlncmFwaC5qcyc7XG5pbXBvcnQgcGtnIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XG5pbXBvcnQgRmlsZVJlYWRlciBmcm9tICdmaWxlcmVhZGVyJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKEZpbGVSZWFkZXIsIG51bGwpO1xub3JpZ3JhcGgudmVyc2lvbiA9IHBrZy52ZXJzaW9uO1xuXG5leHBvcnQgZGVmYXVsdCBvcmlncmFwaDtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiX2V2ZW50SGFuZGxlcnMiLCJfc3RpY2t5VHJpZ2dlcnMiLCJvbiIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiZXZlbnQiLCJuYW1lc3BhY2UiLCJzcGxpdCIsInB1c2giLCJvZmYiLCJpbmRleCIsImluZGV4T2YiLCJzcGxpY2UiLCJ0cmlnZ2VyIiwiYXJncyIsImhhbmRsZUNhbGxiYWNrIiwic2V0VGltZW91dCIsImFwcGx5IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJzdGlja3lUcmlnZ2VyIiwiYXJnT2JqIiwiZGVsYXkiLCJhc3NpZ24iLCJjbGVhclRpbWVvdXQiLCJ0aW1lb3V0IiwiZGVmaW5lUHJvcGVydHkiLCJTeW1ib2wiLCJoYXNJbnN0YW5jZSIsInZhbHVlIiwiaSIsIkludHJvc3BlY3RhYmxlIiwidHlwZSIsImxvd2VyQ2FtZWxDYXNlVHlwZSIsImh1bWFuUmVhZGFibGVUeXBlIiwiY29uZmlndXJhYmxlIiwiZ2V0IiwidGVtcCIsInJlcGxhY2UiLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsIkdlbmVyaWNXcmFwcGVyIiwib3B0aW9ucyIsInRhYmxlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJjbGFzc09iaiIsInJvdyIsImNvbm5lY3RlZEl0ZW1zIiwiY29ubmVjdEl0ZW0iLCJpdGVtIiwidGFibGVJZCIsImRpc2Nvbm5lY3QiLCJpdGVtTGlzdCIsInZhbHVlcyIsImluc3RhbmNlSWQiLCJjbGFzc0lkIiwiZXF1YWxzIiwiaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zIiwidGFibGVJZHMiLCJsaW1pdCIsIkluZmluaXR5IiwiUHJvbWlzZSIsImFsbCIsIm1hcCIsIm1vZGVsIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJhdHRyIiwic3RyaW5naWZpZWRGdW5jIiwiZW50cmllcyIsImRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfc3VwcHJlc3NlZEF0dHJpYnV0ZXMiLCJzdXBwcmVzc2VkQXR0cmlidXRlcyIsIl9zdXBwcmVzc0luZGV4Iiwic3VwcHJlc3NJbmRleCIsIl9pbmRleEZpbHRlciIsImluZGV4RmlsdGVyIiwiX2F0dHJpYnV0ZUZpbHRlcnMiLCJhdHRyaWJ1dGVGaWx0ZXJzIiwiX3RvUmF3T2JqZWN0IiwicmVzdWx0IiwiX2F0dHJpYnV0ZXMiLCJ1c2VkQnlDbGFzc2VzIiwiX3VzZWRCeUNsYXNzZXMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsImZ1bmMiLCJGdW5jdGlvbiIsInRvU3RyaW5nIiwiaXRlcmF0ZSIsInJlc2V0IiwiX2NhY2hlIiwiX2J1aWxkQ2FjaGUiLCJfcGFydGlhbENhY2hlIiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsImtlZXAiLCJfd3JhcCIsIm90aGVySXRlbSIsIml0ZW1zVG9Db25uZWN0IiwiZGVyaXZlZFRhYmxlIiwiX2NhY2hlUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjb3VudFJvd3MiLCJjYWNoZSIsImdldEluZGV4RGV0YWlscyIsImRldGFpbHMiLCJzdXBwcmVzc2VkIiwiZmlsdGVyZWQiLCJnZXRBdHRyaWJ1dGVEZXRhaWxzIiwiYWxsQXR0cnMiLCJleHBlY3RlZCIsIm9ic2VydmVkIiwiZGVyaXZlZCIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwic3VwcHJlc3NBdHRyaWJ1dGUiLCJhZGRGaWx0ZXIiLCJfZGVyaXZlVGFibGUiLCJuZXdUYWJsZSIsImNyZWF0ZVRhYmxlIiwiX2dldEV4aXN0aW5nVGFibGUiLCJleGlzdGluZ1RhYmxlIiwiZmluZCIsInRhYmxlT2JqIiwiZXZlcnkiLCJvcHRpb25OYW1lIiwib3B0aW9uVmFsdWUiLCJhZ2dyZWdhdGUiLCJleHBhbmQiLCJkZWxpbWl0ZXIiLCJjbG9zZWRGYWNldCIsIm9wZW5GYWNldCIsImNsb3NlZFRyYW5zcG9zZSIsImluZGV4ZXMiLCJvcGVuVHJhbnNwb3NlIiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0Iiwib3RoZXJUYWJsZSIsImNsYXNzZXMiLCJwYXJlbnRUYWJsZXMiLCJyZWR1Y2UiLCJhZ2ciLCJpblVzZSIsInNvbWUiLCJzb3VyY2VUYWJsZUlkcyIsInRhcmdldFRhYmxlSWRzIiwiZGVsZXRlIiwiZXJyIiwicGFyZW50VGFibGUiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJTdGF0aWNEaWN0VGFibGUiLCJTaW5nbGVQYXJlbnRNaXhpbiIsIl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4iLCJBZ2dyZWdhdGVkVGFibGUiLCJfYXR0cmlidXRlIiwiX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsInJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyIsIl9kZWh5ZHJhdGVGdW5jdGlvbiIsImRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUiLCJfdXBkYXRlSXRlbSIsIm9yaWdpbmFsV3JhcHBlZEl0ZW0iLCJuZXdXcmFwcGVkSXRlbSIsIndyYXBwZWRQYXJlbnQiLCJTdHJpbmciLCJleGlzdGluZ0l0ZW0iLCJuZXdJdGVtIiwicmVkdWNlZCIsIkV4cGFuZGVkVGFibGUiLCJGYWNldGVkVGFibGUiLCJfdmFsdWUiLCJUcmFuc3Bvc2VkVGFibGUiLCJfaW5kZXgiLCJDb25uZWN0ZWRUYWJsZSIsImpvaW4iLCJiYXNlUGFyZW50VGFibGUiLCJvdGhlclBhcmVudFRhYmxlcyIsIkdlbmVyaWNDbGFzcyIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9ucyIsInNldENsYXNzTmFtZSIsImhhc0N1c3RvbU5hbWUiLCJpbnRlcnByZXRBc05vZGVzIiwib3ZlcndyaXRlIiwiY3JlYXRlQ2xhc3MiLCJpbnRlcnByZXRBc0VkZ2VzIiwiX2Rlcml2ZU5ld0NsYXNzIiwiZ2V0U2FtcGxlR3JhcGgiLCJyb290Q2xhc3MiLCJOb2RlV3JhcHBlciIsImVkZ2VzIiwiZWRnZUlkcyIsImVkZ2VDbGFzc0lkcyIsImVkZ2VJZCIsImVkZ2VDbGFzcyIsInNvdXJjZUNsYXNzSWQiLCJyZXZlcnNlIiwiY29uY2F0IiwicGFpcndpc2VOZWlnaGJvcmhvb2QiLCJlZGdlIiwicGFpcndpc2VFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc2VzIiwiZWRnZUNsYXNzSWQiLCJhdXRvY29ubmVjdCIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsImlzU291cmNlIiwidGFyZ2V0Q2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0Iiwibm9kZUNsYXNzIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY29ubmVjdGVkQ2xhc3NlcyIsIkVkZ2VXcmFwcGVyIiwic291cmNlTm9kZXMiLCJzb3VyY2VUYWJsZUlkIiwidGFyZ2V0Tm9kZXMiLCJ0YXJnZXRUYWJsZUlkIiwic291cmNlIiwidGFyZ2V0IiwiaHlwZXJlZGdlIiwic291cmNlcyIsInRhcmdldHMiLCJFZGdlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiTWF0aCIsImFicyIsImZpbHRlciIsInNvcnQiLCJhIiwiYiIsInNpZGUiLCJjb25uZWN0U291cmNlIiwiY29ubmVjdFRhcmdldCIsInRvZ2dsZURpcmVjdGlvbiIsInN3YXBwZWREaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJ1bnNoaWZ0IiwiZXhpc3RpbmdTb3VyY2VDbGFzcyIsImV4aXN0aW5nVGFyZ2V0Q2xhc3MiLCJEQVRBTElCX0ZPUk1BVFMiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJfb3JpZ3JhcGgiLCJfbmV4dENsYXNzSWQiLCJfbmV4dFRhYmxlSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsInJlbmFtZSIsIm5ld05hbWUiLCJhbm5vdGF0ZSIsImtleSIsImRlbGV0ZUFubm90YXRpb24iLCJkZWxldGVNb2RlbCIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwibWltZSIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwicmVhZGVyIiwiRmlsZVJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwibG9va3VwIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImJyYW5jaExpbWl0Iiwibm9kZUxpbWl0IiwiZWRnZUxpbWl0IiwidHJpcGxlTGltaXQiLCJzYW1wbGVHcmFwaCIsIm5vZGVzIiwibm9kZUxvb2t1cCIsImVkZ2VMb29rdXAiLCJsaW5rcyIsIm51bVRyaXBsZXMiLCJhZGROb2RlIiwibm9kZSIsImFkZEVkZ2UiLCJhZGRUcmlwbGUiLCJjbGFzc0xpc3QiLCJnZXRJbnN0YW5jZUdyYXBoIiwiaW5zdGFuY2VzIiwiZ3JhcGgiLCJlZGdlVGFibGVFbnRyaWVzIiwiaW5zdGFuY2UiLCJub2RlSW5zdGFuY2UiLCJkdW1teSIsImVkZ2VJbnN0YW5jZSIsImdldE5ldHdvcmtNb2RlbEdyYXBoIiwicmF3IiwiaW5jbHVkZUR1bW1pZXMiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImxvY2F0aW9uIiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRGdWxsU2NoZW1hR3JhcGgiLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwibW9kZWxzIiwiZXhpc3RpbmdNb2RlbHMiLCJnZXRJdGVtIiwiSlNPTiIsInBhcnNlIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJzZXRJdGVtIiwic3RyaW5naWZ5IiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWxJZCIsImRlbGV0ZUFsbE1vZGVscyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUEsTUFBTUEsZ0JBQWdCLEdBQUcsVUFBVUMsVUFBVixFQUFzQjtTQUN0QyxjQUFjQSxVQUFkLENBQXlCO0lBQzlCQyxXQUFXLEdBQUk7WUFDUCxHQUFHQyxTQUFUO1dBQ0tDLDJCQUFMLEdBQW1DLElBQW5DO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7V0FDS0MsZUFBTCxHQUF1QixFQUF2Qjs7O0lBRUZDLEVBQUUsQ0FBRUMsU0FBRixFQUFhQyxRQUFiLEVBQXVCO1VBQ25CLENBQUNDLEtBQUQsRUFBUUMsU0FBUixJQUFxQkgsU0FBUyxDQUFDSSxLQUFWLENBQWdCLEdBQWhCLENBQXpCO1dBQ0tQLGNBQUwsQ0FBb0JLLEtBQXBCLElBQTZCLEtBQUtMLGNBQUwsQ0FBb0JLLEtBQXBCLEtBQzNCO1lBQU07T0FEUjs7VUFFSSxDQUFDQyxTQUFMLEVBQWdCO2FBQ1ROLGNBQUwsQ0FBb0JLLEtBQXBCLEVBQTJCLEVBQTNCLEVBQStCRyxJQUEvQixDQUFvQ0osUUFBcEM7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
