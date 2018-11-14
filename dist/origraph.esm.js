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

    on(eventName, callback, allowDuplicateListeners) {
      if (!this._eventHandlers[eventName]) {
        this._eventHandlers[eventName] = [];
      }

      if (!allowDuplicateListeners) {
        if (this._eventHandlers[eventName].indexOf(callback) !== -1) {
          return;
        }
      }

      this._eventHandlers[eventName].push(callback);
    }

    off(eventName, callback) {
      if (this._eventHandlers[eventName]) {
        if (!callback) {
          delete this._eventHandlers[eventName];
        } else {
          let index = this._eventHandlers[eventName].indexOf(callback);

          if (index >= 0) {
            this._eventHandlers[eventName].splice(index, 1);
          }
        }
      }
    }

    trigger(eventName, ...args) {
      if (this._eventHandlers[eventName]) {
        this._eventHandlers[eventName].forEach(callback => {
          setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
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
        return _this.classObj._origraph.tables[tableId].buildCache();
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
    return Object.keys((await this.buildCache())).length;
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
    options.preSave = newTable => {
      this._derivedTables[newTable.tableId] = true;
    };

    return this.model.createTable(options);
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
    return this.model.createTable({
      type: 'ConnectedTable',
      preSave: newTable => {
        this._derivedTables[newTable.tableId] = true;

        for (const otherTable of otherTableList) {
          otherTable._derivedTables[newTable.tableId] = true;
        }
      }
    });
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
        throw new Error(`Parent table is requierd for table of type ${this.type}`);
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
        const edgeClass = _this.classObj._origraph.classes[edgeId];

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

  interpretAsEdges() {
    const edgeClassIds = Object.keys(this.edgeClassIds);

    const options = super._toRawObject();

    if (edgeClassIds.length > 2) {
      // If there are more than two edges, break all connections and make
      // this a floating edge (for now, we're not dealing in hyperedges)
      this.disconnectAllEdges();
    } else if (edgeClassIds.length === 1) {
      // With only one connection, this node should become a self-edge
      const edgeClass = this.model.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
      // of sourceId / targetId, not edgeClass.direction)?

      const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
      // should be whatever is at the other end of edgeClass (if anything)

      if (isSource) {
        options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
      } else {
        options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
      } // tableId lists should emanate out from the (new) edge table; assuming
      // (for a moment) that isSource === true, we'd construct the tableId list
      // like this:


      let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

      if (!isSource) {
        // Whoops, got it backwards!
        tableIdList.reverse();
      }

      options.directed = edgeClass.directed;
      options.sourceTableIds = options.targetTableIds = tableIdList; // TODO: instead of deleting the existing edge class, should we leave it
      // hanging + unconnected?

      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
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
      options.targetClassId = targetEdgeClass.classId; // Concatenate the intermediate tableId lists, emanating out from the
      // (new) edge table

      options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

      if (sourceEdgeClass.targetClassId === this.classId) {
        options.sourceTableIds.reverse();
      }

      options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

      if (targetEdgeClass.targetClassId === this.classId) {
        options.targetTableIds.reverse();
      } // Delete each of the edge classes


      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
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
    return this.model.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      sourceClassId: this.classId,
      sourceTableIds,
      targetClassId: otherNodeClass.classId,
      targetTableIds,
      preSave: newEdgeClass => {
        this.edgeClassIds[newEdgeClass.classId] = true;
        otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;
      }
    });
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

      const sourceTableId = _this.classObj._origraph.classes[_this.classObj.sourceClassId].tableId;
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

      const targetTableId = _this2.classObj._origraph.classes[_this2.classObj.targetClassId].tableId;
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

    this.disconnectAllEdges();
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
let NEXT_CLASS_ID = 1;
let NEXT_TABLE_ID = 1;

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
      classes[classObj.classId].type = classObj.type;
    }

    for (const tableObj of Object.values(this.tables)) {
      tables[tableObj.tableId] = tableObj._toRawObject();
      tables[tableObj.tableId].type = tableObj.type;
    }

    return {
      modelId: this.modelId,
      name: this.name,
      annotations: this.annotations,
      classes: this.classes,
      tables: this.tables
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
      options.tableId = `table${NEXT_TABLE_ID}`;
      NEXT_TABLE_ID += 1;
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
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    options.model = this;
    this.classes[options.classId] = new CLASSES[options.type](options);
    this.trigger('update');
    return this.classes[options.classId];
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
      let reader = new this.FileReader();

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
    extension = 'txt',
    text
  }) {
    let data, attributes;

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
      edgeLookup: {}
    };
    let numTriples = 0;
    let numEdgeInstances = 0;

    const addNode = node => {
      if (!sampleGraph.nodeLookup[node.instanceId]) {
        sampleGraph.nodeLookup[node.instanceId] = sampleGraph.nodes.length;
        sampleGraph.nodes.push(node);
      }

      return sampleGraph.nodes.length > nodeLimit;
    };

    const addEdge = edge => {
      if (!sampleGraph.edgeLookup[edge.instanceId]) {
        sampleGraph.edgeLookup[edge.instanceId] = {
          instance: edge,
          pairwiseInstances: []
        };
        numEdgeInstances++;
      }

      return numEdgeInstances > edgeLimit;
    };

    const addTriple = (source, edge, target) => {
      const trippedOtherLimit = addNode(source) || addNode(edge) || addEdge(target);
      sampleGraph.edgeLookup[edge.instanceId].pairwiseInstances.push(sampleGraph.edges.length);
      sampleGraph.edges.push({
        source: sampleGraph.nodeLookup[source.instanceId],
        target: sampleGraph.nodeLookup[target.instanceId],
        edgeInstance: edge
      });
      numTriples++;
      return trippedOtherLimit || numTriples > tripleLimit;
    };

    let classList = rootClass ? [rootClass] : Object.values(this.classes);

    for (const classObj of classList) {
      if (classObj.type === 'Node') {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(rootClass.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const node = _value;

            if (addNode(node)) {
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

                if (addTriple(source, edge, target)) {
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
          for (var _iterator3 = _asyncIterator(rootClass.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const edge = _value3;

            if (addEdge(edge)) {
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

                if (addTriple(source, edge, target)) {
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

  getNetworkModelGraph(includeDummies = false) {
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

      const classSpec = classObj._toRawObject();

      classSpec.type = classObj.constructor.name;
      graph.classes.push(classSpec);

      if (classObj.type === 'Edge') {
        // Store the edge class so we can create classConnections later
        edgeClasses.push(classObj);
      } else if (classObj.type === 'Node' && includeDummies) {
        // Create a "potential" connection + dummy node
        graph.classConnections.push({
          id: `${classObj.classID}>dummy`,
          source: graph.classes.length,
          target: graph.classes.length,
          directed: false,
          location: 'node',
          dummy: true
        });
        graph.nodes.push({
          dummy: true
        });
      } // Create existing classConnections


      edgeClasses.forEach(edgeClass => {
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
      });
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
    return this.models[this._currentModelId] || this.createModel();
  }

  set currentModel(model) {
    this._currentModelId = model.modelId;
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
var version = "0.1.4";
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
	"@babel/core": "^7.1.2",
	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
	"@babel/preset-env": "^7.1.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.6.0",
	coveralls: "^3.0.2",
	jest: "^23.6.0",
	rollup: "^0.66.6",
	"rollup-plugin-babel": "^4.0.3",
	"rollup-plugin-commonjs": "^9.2.0",
	"rollup-plugin-json": "^3.1.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.4.0",
	"rollup-plugin-node-resolve": "^3.4.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	filereader: "^0.10.3",
	"mime-types": "^2.1.20"
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ3JhcGguZXNtLmpzIiwic291cmNlcyI6WyIuLi9zcmMvQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMiLCIuLi9zcmMvQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1RhYmxlcy9UYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1N0YXRpY0RpY3RUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRXhwYW5kZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRmFjZXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9UcmFuc3Bvc2VkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL0NvbW1vbi9OZXR3b3JrTW9kZWwuanMiLCIuLi9zcmMvT3JpZ3JhcGguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IFRyaWdnZXJhYmxlTWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgICBzdXBlciguLi5hcmd1bWVudHMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlRyaWdnZXJhYmxlTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZXZlbnRIYW5kbGVycyA9IHt9O1xuICAgICAgdGhpcy5fc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0gPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmICghYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5wdXNoKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAodGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKTtcbiAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRyaWdnZXIgKGV2ZW50TmFtZSwgLi4uYXJncykge1xuICAgICAgaWYgKHRoaXMuX2V2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uZm9yRWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgc3RpY2t5VHJpZ2dlciAoZXZlbnROYW1lLCBhcmdPYmosIGRlbGF5ID0gMTApIHtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0gPSB0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLl9zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdLmFyZ09iaiwgYXJnT2JqKTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdGlja3lUcmlnZ2Vycy50aW1lb3V0KTtcbiAgICAgIHRoaXMuX3N0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuX3N0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqO1xuICAgICAgICBkZWxldGUgdGhpcy5fc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXTtcbiAgICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50TmFtZSwgYXJnT2JqKTtcbiAgICAgIH0sIGRlbGF5KTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyaWdnZXJhYmxlTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFRyaWdnZXJhYmxlTWl4aW47XG4iLCJjbGFzcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGdldCB0eXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci50eXBlO1xuICB9XG4gIGdldCBsb3dlckNhbWVsQ2FzZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmxvd2VyQ2FtZWxDYXNlVHlwZTtcbiAgfVxuICBnZXQgaHVtYW5SZWFkYWJsZVR5cGUgKCkge1xuICAgIHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLmh1bWFuUmVhZGFibGVUeXBlO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICd0eXBlJywge1xuICAvLyBUaGlzIGNhbiAvIHNob3VsZCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzZXMgdGhhdCBmb2xsb3cgYSBjb21tb24gc3RyaW5nXG4gIC8vIHBhdHRlcm4sIHN1Y2ggYXMgUm9vdFRva2VuLCBLZXlzVG9rZW4sIFBhcmVudFRva2VuLCBldGMuXG4gIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgZ2V0ICgpIHsgcmV0dXJuIHRoaXMudHlwZTsgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdsb3dlckNhbWVsQ2FzZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgY29uc3QgdGVtcCA9IHRoaXMudHlwZTtcbiAgICByZXR1cm4gdGVtcC5yZXBsYWNlKC8uLywgdGVtcFswXS50b0xvY2FsZUxvd2VyQ2FzZSgpKTtcbiAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW50cm9zcGVjdGFibGUsICdodW1hblJlYWRhYmxlVHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICAvLyBDYW1lbENhc2UgdG8gU2VudGVuY2UgQ2FzZVxuICAgIHJldHVybiB0aGlzLnR5cGUucmVwbGFjZSgvKFthLXpdKShbQS1aXSkvZywgJyQxICQyJyk7XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgSW50cm9zcGVjdGFibGU7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY1dyYXBwZXIgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKEludHJvc3BlY3RhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmluZGV4ID0gb3B0aW9ucy5pbmRleDtcbiAgICB0aGlzLnRhYmxlID0gb3B0aW9ucy50YWJsZTtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLnRhYmxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGluZGV4IGFuZCB0YWJsZSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gICAgdGhpcy5jbGFzc09iaiA9IG9wdGlvbnMuY2xhc3NPYmogfHwgbnVsbDtcbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkSXRlbXMgPSBvcHRpb25zLmNvbm5lY3RlZEl0ZW1zIHx8IHt9O1xuICB9XG4gIGNvbm5lY3RJdGVtIChpdGVtKSB7XG4gICAgdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdID0gdGhpcy5jb25uZWN0ZWRJdGVtc1tpdGVtLnRhYmxlLnRhYmxlSWRdIHx8IFtdO1xuICAgIGlmICh0aGlzLmNvbm5lY3RlZEl0ZW1zW2l0ZW0udGFibGUudGFibGVJZF0uaW5kZXhPZihpdGVtKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuY29ubmVjdGVkSXRlbXNbaXRlbS50YWJsZS50YWJsZUlkXS5wdXNoKGl0ZW0pO1xuICAgIH1cbiAgfVxuICBkaXNjb25uZWN0ICgpIHtcbiAgICBmb3IgKGNvbnN0IGl0ZW1MaXN0IG9mIE9iamVjdC52YWx1ZXModGhpcy5jb25uZWN0ZWRJdGVtcykpIHtcbiAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtTGlzdCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IChpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0gfHwgW10pLmluZGV4T2YodGhpcyk7XG4gICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICBpdGVtLmNvbm5lY3RlZEl0ZW1zW3RoaXMudGFibGUudGFibGVJZF0uc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbm5lY3RlZEl0ZW1zID0ge307XG4gIH1cbiAgZ2V0IGluc3RhbmNlSWQgKCkge1xuICAgIHJldHVybiBgJHt0aGlzLmNsYXNzT2JqLmNsYXNzSWR9XyR7dGhpcy5pbmRleH1gO1xuICB9XG4gIGVxdWFscyAoaXRlbSkge1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlSWQgPT09IGl0ZW0uaW5zdGFuY2VJZDtcbiAgfVxuICBhc3luYyAqIGl0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAoeyB0YWJsZUlkcywgbGltaXQgPSBJbmZpbml0eSB9KSB7XG4gICAgLy8gRmlyc3QgbWFrZSBzdXJlIHRoYXQgYWxsIHRoZSB0YWJsZSBjYWNoZXMgaGF2ZSBiZWVuIGZ1bGx5IGJ1aWx0IGFuZFxuICAgIC8vIGNvbm5lY3RlZFxuICAgIGF3YWl0IFByb21pc2UuYWxsKHRhYmxlSWRzLm1hcCh0YWJsZUlkID0+IHtcbiAgICAgIHJldHVybiB0aGlzLmNsYXNzT2JqLl9vcmlncmFwaC50YWJsZXNbdGFibGVJZF0uYnVpbGRDYWNoZSgpO1xuICAgIH0pKTtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyh0YWJsZUlkcykpIHtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgICBpKys7XG4gICAgICBpZiAoaSA+PSBsaW1pdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogX2l0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyAodGFibGVJZHMpIHtcbiAgICBpZiAodGFibGVJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICB5aWVsZCAqICh0aGlzLmNvbm5lY3RlZEl0ZW1zW3RhYmxlSWRzWzBdXSB8fCBbXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRoaXNUYWJsZUlkID0gdGFibGVJZHNbMF07XG4gICAgICBjb25zdCByZW1haW5pbmdUYWJsZUlkcyA9IHRhYmxlSWRzLnNsaWNlKDEpO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMuY29ubmVjdGVkSXRlbXNbdGhpc1RhYmxlSWRdIHx8IFtdKSB7XG4gICAgICAgIHlpZWxkICogaXRlbS5faXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKHJlbWFpbmluZ1RhYmxlSWRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljV3JhcHBlciwgJ3R5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgcmV0dXJuIC8oLiopV3JhcHBlci8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNXcmFwcGVyO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBUYWJsZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oSW50cm9zcGVjdGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubW9kZWwgPSBvcHRpb25zLm1vZGVsO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMubW9kZWwgfHwgIXRoaXMudGFibGVJZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtb2RlbCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG5cbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzID0gb3B0aW9ucy5kZXJpdmVkVGFibGVzIHx8IHt9O1xuXG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIHx8IHt9KSkge1xuICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLnN1cHByZXNzZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSAhIW9wdGlvbnMuc3VwcHJlc3NJbmRleDtcblxuICAgIHRoaXMuX2luZGV4RmlsdGVyID0gKG9wdGlvbnMuaW5kZXhGaWx0ZXIgJiYgdGhpcy5oeWRyYXRlRnVuY3Rpb24ob3B0aW9ucy5pbmRleEZpbHRlcikpIHx8IG51bGw7XG4gICAgdGhpcy5fYXR0cmlidXRlRmlsdGVycyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5hdHRyaWJ1dGVGaWx0ZXJzIHx8IHt9KSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlRmlsdGVyc1thdHRyXSA9IHRoaXMuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge30sXG4gICAgICBzdXBwcmVzc2VkQXR0cmlidXRlczogdGhpcy5fc3VwcHJlc3NlZEF0dHJpYnV0ZXMsXG4gICAgICBzdXBwcmVzc0luZGV4OiB0aGlzLl9zdXBwcmVzc0luZGV4LFxuICAgICAgYXR0cmlidXRlRmlsdGVyczoge30sXG4gICAgICBpbmRleEZpbHRlcjogKHRoaXMuX2luZGV4RmlsdGVyICYmIHRoaXMuZGVoeWRyYXRlRnVuY3Rpb24odGhpcy5faW5kZXhGaWx0ZXIpKSB8fCBudWxsXG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgcmVzdWx0LmRlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAgcmVzdWx0LmF0dHJpYnV0ZUZpbHRlcnNbYXR0cl0gPSB0aGlzLmRlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgY29uc3QgbGltaXQgPSBvcHRpb25zLmxpbWl0ID09PSB1bmRlZmluZWQgPyBJbmZpbml0eSA6IG9wdGlvbnMubGltaXQ7XG4gICAgICB5aWVsZCAqIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpLnNsaWNlKDAsIGxpbWl0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHdyYXBwZWRJdGVtLnJvdykge1xuICAgICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBkZWxldGUgd3JhcHBlZEl0ZW0ucm93W2F0dHJdO1xuICAgIH1cbiAgICBsZXQga2VlcCA9IHRydWU7XG4gICAgaWYgKHRoaXMuX2luZGV4RmlsdGVyKSB7XG4gICAgICBrZWVwID0gdGhpcy5faW5kZXhGaWx0ZXIod3JhcHBlZEl0ZW0uaW5kZXgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSkge1xuICAgICAga2VlcCA9IGtlZXAgJiYgZnVuYyh3cmFwcGVkSXRlbS5yb3dbYXR0cl0pO1xuICAgICAgaWYgKCFrZWVwKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChrZWVwKSB7XG4gICAgICB3cmFwcGVkSXRlbS50cmlnZ2VyKCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd3JhcHBlZEl0ZW0uZGlzY29ubmVjdCgpO1xuICAgICAgd3JhcHBlZEl0ZW0udHJpZ2dlcignZmlsdGVyJyk7XG4gICAgfVxuICAgIHJldHVybiBrZWVwO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIGNvbnN0IHdyYXBwZWRJdGVtID0gY2xhc3NPYmogPyBjbGFzc09iai5fd3JhcChvcHRpb25zKSA6IG5ldyBHZW5lcmljV3JhcHBlcihvcHRpb25zKTtcbiAgICBmb3IgKGNvbnN0IG90aGVySXRlbSBvZiBvcHRpb25zLml0ZW1zVG9Db25uZWN0IHx8IFtdKSB7XG4gICAgICB3cmFwcGVkSXRlbS5jb25uZWN0SXRlbShvdGhlckl0ZW0pO1xuICAgICAgb3RoZXJJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgcmV0dXJuIHdyYXBwZWRJdGVtO1xuICB9XG4gIHJlc2V0ICgpIHtcbiAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9jYWNoZTtcbiAgICBmb3IgKGNvbnN0IGRlcml2ZWRUYWJsZSBvZiB0aGlzLmRlcml2ZWRUYWJsZXMpIHtcbiAgICAgIGRlcml2ZWRUYWJsZS5yZXNldCgpO1xuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3Jlc2V0Jyk7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jIGJ1aWxkQ2FjaGUgKCkge1xuICAgIGlmICh0aGlzLl9jYWNoZSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fY2FjaGVQcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVQcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9jYWNoZVByb21pc2UgPSBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgdGVtcCBvZiB0aGlzLl9idWlsZENhY2hlKCkpIHt9IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NhY2hlUHJvbWlzZTtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLl9jYWNoZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVByb21pc2U7XG4gICAgfVxuICB9XG4gIGFzeW5jIGNvdW50Um93cyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKGF3YWl0IHRoaXMuYnVpbGRDYWNoZSgpKS5sZW5ndGg7XG4gIH1cbiAgZ2V0SW5kZXhEZXRhaWxzICgpIHtcbiAgICBjb25zdCBkZXRhaWxzID0geyBuYW1lOiBudWxsIH07XG4gICAgaWYgKHRoaXMuX3N1cHByZXNzSW5kZXgpIHtcbiAgICAgIGRldGFpbHMuc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLl9pbmRleEZpbHRlcikge1xuICAgICAgZGV0YWlscy5maWx0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBkZXRhaWxzO1xuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLmV4cGVjdGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX29ic2VydmVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSBhbGxBdHRyc1thdHRyXSB8fCB7IG5hbWU6IGF0dHIgfTtcbiAgICAgIGFsbEF0dHJzW2F0dHJdLm9ic2VydmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5kZXJpdmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3N1cHByZXNzZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uc3VwcHJlc3NlZCA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IGFsbEF0dHJzW2F0dHJdIHx8IHsgbmFtZTogYXR0ciB9O1xuICAgICAgYWxsQXR0cnNbYXR0cl0uZmlsdGVyZWQgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gYWxsQXR0cnM7XG4gIH1cbiAgZ2V0IGF0dHJpYnV0ZXMgKCkge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLmdldEF0dHJpYnV0ZURldGFpbHMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgc3VwcHJlc3NBdHRyaWJ1dGUgKGF0dHJpYnV0ZSkge1xuICAgIGlmIChhdHRyaWJ1dGUgPT09IG51bGwpIHtcbiAgICAgIHRoaXMuX3N1cHByZXNzSW5kZXggPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdXBwcmVzc2VkQXR0cmlidXRlc1thdHRyaWJ1dGVdID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIGFkZEZpbHRlciAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5faW5kZXhGaWx0ZXIgPSBmdW5jO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVGaWx0ZXJzW2F0dHJpYnV0ZV0gPSBmdW5jO1xuICAgIH1cbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5wcmVTYXZlID0gKG5ld1RhYmxlKSA9PiB7XG4gICAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIF9nZXRFeGlzdGluZ1RhYmxlIChvcHRpb25zKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhlIGRlcml2ZWQgdGFibGUgaGFzIGFscmVhZHkgYmVlbiBkZWZpbmVkXG4gICAgY29uc3QgZXhpc3RpbmdUYWJsZSA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZSAmJiB0aGlzLm1vZGVsLnRhYmxlc1tleGlzdGluZ1RhYmxlLnRhYmxlSWRdKSB8fCBudWxsO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdBZ2dyZWdhdGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBleHBhbmQgKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIHR5cGU6ICdFeHBhbmRlZFRhYmxlJyxcbiAgICAgIGF0dHJpYnV0ZSxcbiAgICAgIGRlbGltaXRlclxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHZhbHVlcy5tYXAodmFsdWUgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgdHlwZTogJ0ZhY2V0ZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmFjZXRlZFRhYmxlJyxcbiAgICAgICAgICBhdHRyaWJ1dGUsXG4gICAgICAgICAgdmFsdWVcbiAgICAgICAgfTtcbiAgICAgICAgeWllbGQgdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY2xvc2VkVHJhbnNwb3NlIChpbmRleGVzKSB7XG4gICAgcmV0dXJuIGluZGV4ZXMubWFwKGluZGV4ID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jICogb3BlblRyYW5zcG9zZSAobGltaXQgPSBJbmZpbml0eSkge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5pdGVyYXRlKHsgbGltaXQgfSkpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgIHR5cGU6ICdUcmFuc3Bvc2VkVGFibGUnLFxuICAgICAgICBpbmRleDogd3JhcHBlZEl0ZW0uaW5kZXhcbiAgICAgIH07XG4gICAgICB5aWVsZCB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuICBjb25uZWN0IChvdGhlclRhYmxlTGlzdCkge1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZVRhYmxlKHtcbiAgICAgIHR5cGU6ICdDb25uZWN0ZWRUYWJsZScsXG4gICAgICBwcmVTYXZlOiAobmV3VGFibGUpID0+IHtcbiAgICAgICAgdGhpcy5fZGVyaXZlZFRhYmxlc1tuZXdUYWJsZS50YWJsZUlkXSA9IHRydWU7XG4gICAgICAgIGZvciAoY29uc3Qgb3RoZXJUYWJsZSBvZiBvdGhlclRhYmxlTGlzdCkge1xuICAgICAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMubW9kZWwudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGdldCBpblVzZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLm1vZGVsLmNsYXNzZXMpLnNvbWUoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlSWQgPT09IHRoaXMudGFibGVJZCB8fFxuICAgICAgICBjbGFzc09iai5zb3VyY2VUYWJsZUlkcy5pbmRleE9mKHRoaXMudGFibGVJZCkgIT09IC0xIHx8XG4gICAgICAgIGNsYXNzT2JqLnRhcmdldFRhYmxlSWRzLmluZGV4T2YodGhpcy50YWJsZUlkKSAhPT0gLTE7XG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBpZiAodGhpcy5pblVzZSkge1xuICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgICAgZXJyLmluVXNlID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiB0aGlzLnBhcmVudFRhYmxlcykge1xuICAgICAgZGVsZXRlIHBhcmVudFRhYmxlLmRlcml2ZWRUYWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB9XG4gICAgZGVsZXRlIHRoaXMubW9kZWwudGFibGVzW3RoaXMudGFibGVJZF07XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSkpIHtcbiAgICAgICAgeWllbGQgaXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IFN0YXRpY1RhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNEaWN0VGFibGUgZXh0ZW5kcyBUYWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fbmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICB0aGlzLl9kYXRhID0gb3B0aW9ucy5kYXRhIHx8IHt9O1xuICAgIGlmICghdGhpcy5fbmFtZSB8fCAhdGhpcy5fZGF0YSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBuYW1lIGFuZCBkYXRhIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX25hbWU7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmoubmFtZSA9IHRoaXMuX25hbWU7XG4gICAgb2JqLmRhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciAoY29uc3QgW2luZGV4LCByb3ddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2RhdGEpKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3cgfSk7XG4gICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShpdGVtKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdFRhYmxlO1xuIiwiY29uc3QgU2luZ2xlUGFyZW50TWl4aW4gPSBmdW5jdGlvbiAoc3VwZXJjbGFzcykge1xuICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBzdXBlcmNsYXNzIHtcbiAgICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW4gPSB0cnVlO1xuICAgIH1cbiAgICBnZXQgcGFyZW50VGFibGUgKCkge1xuICAgICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgICBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCB0YWJsZSBpcyByZXF1aWVyZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH0gZWxzZSBpZiAocGFyZW50VGFibGVzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBPbmx5IG9uZSBwYXJlbnQgdGFibGUgYWxsb3dlZCBmb3IgdGFibGUgb2YgdHlwZSAke3RoaXMudHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJlbnRUYWJsZXNbMF07XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTaW5nbGVQYXJlbnRNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluXG59KTtcbmV4cG9ydCBkZWZhdWx0IFNpbmdsZVBhcmVudE1peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuXG5jbGFzcyBBZ2dyZWdhdGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgfHwge30pKSB7XG4gICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLm1vZGVsLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLm1vZGVsLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuICfihqYnICsgdGhpcy5fYXR0cmlidXRlO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgaWYgKCF0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCBpbmRleCA9IFN0cmluZyh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdKTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdJdGVtID0gdGhpcy5fcGFydGlhbENhY2hlW2luZGV4XTtcbiAgICAgICAgZXhpc3RpbmdJdGVtLmNvbm5lY3RJdGVtKHdyYXBwZWRQYXJlbnQpO1xuICAgICAgICB3cmFwcGVkUGFyZW50LmNvbm5lY3RJdGVtKGV4aXN0aW5nSXRlbSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0oZXhpc3RpbmdJdGVtLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBpdGVtc1RvQ29ubmVjdDogWyB3cmFwcGVkUGFyZW50IF1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgd3JhcHBlZFBhcmVudCk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGdldEF0dHJpYnV0ZURldGFpbHMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0gc3VwZXIuZ2V0QXR0cmlidXRlRGV0YWlscygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGFsbEF0dHJzW2F0dHJdID0gYWxsQXR0cnNbYXR0cl0gfHwgeyBuYW1lOiBhdHRyIH07XG4gICAgICBhbGxBdHRyc1thdHRyXS5yZWR1Y2VkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGFsbEF0dHJzO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBBZ2dyZWdhdGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBpcyByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuZGVsaW1pdGVyID0gb3B0aW9ucy5kZWxpbWl0ZXIgfHwgJywnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpCc7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcGFyZW50VGFibGUgPSB0aGlzLnBhcmVudFRhYmxlO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiBwYXJlbnRUYWJsZS5pdGVyYXRlKG9wdGlvbnMpKSB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSB8fCAnJykuc3BsaXQodGhpcy5kZWxpbWl0ZXIpO1xuICAgICAgZm9yIChjb25zdCB2YWx1ZSBvZiB2YWx1ZXMpIHtcbiAgICAgICAgY29uc3Qgcm93ID0ge307XG4gICAgICAgIHJvd1t0aGlzLl9hdHRyaWJ1dGVdID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICByb3csXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZhY2V0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYFske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRQYXJlbnQgb2YgcGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgaWYgKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gPT09IHRoaXMuX3ZhbHVlKSB7XG4gICAgICAgIC8vIE5vcm1hbCBmYWNldGluZyBqdXN0IGdpdmVzIGEgc3Vic2V0IG9mIHRoZSBvcmlnaW5hbCB0YWJsZVxuICAgICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgcm93OiBPYmplY3QuYXNzaWduKHt9LCB3cmFwcGVkUGFyZW50LnJvdyksXG4gICAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5fZmluaXNoSXRlbShuZXdJdGVtKSkge1xuICAgICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZhY2V0ZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgVHJhbnNwb3NlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuX2luZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW5kZXggaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouaW5kZXggPSB0aGlzLl9pbmRleDtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYOG1gCR7dGhpcy5faW5kZXh9YDtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgLy8gUHJlLWJ1aWxkIHRoZSBwYXJlbnQgdGFibGUncyBjYWNoZVxuICAgIGNvbnN0IHBhcmVudFRhYmxlID0gdGhpcy5wYXJlbnRUYWJsZTtcbiAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG5cbiAgICAvLyBJdGVyYXRlIHRoZSByb3cncyBhdHRyaWJ1dGVzIGFzIGluZGV4ZXNcbiAgICBjb25zdCB3cmFwcGVkUGFyZW50ID0gcGFyZW50VGFibGUuX2NhY2hlW3RoaXMuX2luZGV4XSB8fCB7IHJvdzoge30gfTtcbiAgICBmb3IgKGNvbnN0IFsgaW5kZXgsIHZhbHVlIF0gb2YgT2JqZWN0LmVudHJpZXMod3JhcHBlZFBhcmVudC5yb3cpKSB7XG4gICAgICBjb25zdCBuZXdJdGVtID0gdGhpcy5fd3JhcCh7XG4gICAgICAgIGluZGV4LFxuICAgICAgICByb3c6IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgPyB2YWx1ZSA6IHsgdmFsdWUgfSxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IFsgd3JhcHBlZFBhcmVudCBdXG4gICAgICB9KTtcbiAgICAgIGlmICh0aGlzLl9maW5pc2hJdGVtKG5ld0l0ZW0pKSB7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBUcmFuc3Bvc2VkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGVzLm1hcChwYXJlbnRUYWJsZSA9PiBwYXJlbnRUYWJsZS5uYW1lKS5qb2luKCfiqK8nKTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgY29uc3QgcGFyZW50VGFibGVzID0gdGhpcy5wYXJlbnRUYWJsZXM7XG4gICAgLy8gU3BpbiB0aHJvdWdoIGFsbCBvZiB0aGUgcGFyZW50VGFibGVzIHNvIHRoYXQgdGhlaXIgX2NhY2hlIGlzIHByZS1idWlsdFxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBhd2FpdCBwYXJlbnRUYWJsZS5idWlsZENhY2hlKCk7XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseS4gV2Ugb25seVxuICAgIC8vIGNhcmUgYWJvdXQgaW5jbHVkaW5nIHJvd3MgdGhhdCBoYXZlIGV4YWN0IG1hdGNoZXMgYWNyb3NzIGFsbCB0YWJsZXMsIHNvXG4gICAgLy8gd2UgY2FuIGp1c3QgcGljayBvbmUgcGFyZW50IHRhYmxlIHRvIGl0ZXJhdGVcbiAgICBjb25zdCBiYXNlUGFyZW50VGFibGUgPSBwYXJlbnRUYWJsZXNbMF07XG4gICAgY29uc3Qgb3RoZXJQYXJlbnRUYWJsZXMgPSBwYXJlbnRUYWJsZXMuc2xpY2UoMSk7XG4gICAgZm9yIChjb25zdCBpbmRleCBpbiBiYXNlUGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlcy5ldmVyeSh0YWJsZSA9PiB0YWJsZS5fY2FjaGUpKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoIW90aGVyUGFyZW50VGFibGVzLmV2ZXJ5KHRhYmxlID0+IHRhYmxlLl9jYWNoZVtpbmRleF0pKSB7XG4gICAgICAgIC8vIE5vIG1hdGNoIGluIG9uZSBvZiB0aGUgb3RoZXIgdGFibGVzOyBvbWl0IHRoaXMgaXRlbVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IGFkZCBlYWNoIHBhcmVudCB0YWJsZXMnIGtleXMgYXMgYXR0cmlidXRlIHZhbHVlc1xuICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICBpbmRleCxcbiAgICAgICAgaXRlbXNUb0Nvbm5lY3Q6IHBhcmVudFRhYmxlcy5tYXAodGFibGUgPT4gdGFibGUuX2NhY2hlW2luZGV4XSlcbiAgICAgIH0pO1xuICAgICAgaWYgKHRoaXMuX2ZpbmlzaEl0ZW0obmV3SXRlbSkpIHtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi4vV3JhcHBlcnMvR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBHZW5lcmljQ2xhc3MgZXh0ZW5kcyBJbnRyb3NwZWN0YWJsZSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLm1vZGVsID0gb3B0aW9ucy5tb2RlbDtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5tb2RlbCB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbW9kZWwsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9ucyA9IG9wdGlvbnMuYW5ub3RhdGlvbnMgfHwge307XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgY2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgY2xhc3NOYW1lOiB0aGlzLl9jbGFzc05hbWUsXG4gICAgICBhbm5vdGF0aW9uczogdGhpcy5hbm5vdGF0aW9uc1xuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZ2V0IGhhc0N1c3RvbU5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgIT09IG51bGw7XG4gIH1cbiAgZ2V0IGNsYXNzTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSB8fCB0aGlzLnRhYmxlLm5hbWU7XG4gIH1cbiAgZ2V0IHRhYmxlICgpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICBvcHRpb25zLnR5cGUgPSAnRWRnZUNsYXNzJztcbiAgICBvcHRpb25zLm92ZXJ3cml0ZSA9IHRydWU7XG4gICAgdGhpcy50YWJsZS5yZXNldCgpO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVOZXdDbGFzcyAobmV3VGFibGUsIHR5cGUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyh7XG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkLFxuICAgICAgdHlwZVxuICAgIH0pO1xuICB9XG4gIGFnZ3JlZ2F0ZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Rlcml2ZU5ld0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlTmV3Q2xhc3ModGhpcy50YWJsZS5leHBhbmQoYXR0cmlidXRlLCBkZWxpbWl0ZXIpKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRGYWNldChhdHRyaWJ1dGUsIHZhbHVlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuRmFjZXQgKGF0dHJpYnV0ZSkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbmV3VGFibGUgb2YgdGhpcy50YWJsZS5vcGVuRmFjZXQoYXR0cmlidXRlKSkge1xuICAgICAgeWllbGQgdGhpcy5fZGVyaXZlTmV3Q2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBjbG9zZWRUcmFuc3Bvc2UgKGluZGV4ZXMpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZS5jbG9zZWRUcmFuc3Bvc2UoaW5kZXhlcykubWFwKG5ld1RhYmxlID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgKiBvcGVuVHJhbnNwb3NlICgpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IG5ld1RhYmxlIG9mIHRoaXMudGFibGUub3BlblRyYW5zcG9zZSgpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVOZXdDbGFzcyhuZXdUYWJsZSk7XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgZGVsZXRlIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLmNsYXNzSWRdO1xuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBOb2RlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuY2xhc3NPYmopIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgY2xhc3NPYmogaXMgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBlZGdlcyAob3B0aW9ucyA9IHsgbGltaXQ6IEluZmluaXR5IH0pIHtcbiAgICBjb25zdCBlZGdlSWRzID0gb3B0aW9ucy5lZGdlSWRzIHx8IHRoaXMuY2xhc3NPYmouZWRnZUNsYXNzSWRzO1xuICAgIGxldCBpID0gMDtcbiAgICBmb3IgKGNvbnN0IGVkZ2VJZCBvZiBPYmplY3Qua2V5cyhlZGdlSWRzKSkge1xuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5jbGFzc09iai5fb3JpZ3JhcGguY2xhc3Nlc1tlZGdlSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzT2JqLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy50YWJsZUlkcyA9IGVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAgIC5jb25jYXQoW2VkZ2VDbGFzcy50YWJsZUlkXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLnRhYmxlSWRzID0gZWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgICAgLmNvbmNhdChbZWRnZUNsYXNzLnRhYmxlSWRdKTtcbiAgICAgIH1cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgaXRlbSBvZiB0aGlzLml0ZXJhdGVBY3Jvc3NDb25uZWN0aW9ucyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgICBpKys7XG4gICAgICAgIGlmIChpID49IG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZU5laWdoYm9yaG9vZCAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiB0aGlzLmVkZ2VzKG9wdGlvbnMpKSB7XG4gICAgICB5aWVsZCAqIGVkZ2UucGFpcndpc2VFZGdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTm9kZVdyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcbmltcG9ydCBOb2RlV3JhcHBlciBmcm9tICcuLi9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5jbGFzc09iaiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBOb2RlV3JhcHBlcihvcHRpb25zKTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3NJZHMgPSBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcyk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbW9yZSB0aGFuIHR3byBlZGdlcywgYnJlYWsgYWxsIGNvbm5lY3Rpb25zIGFuZCBtYWtlXG4gICAgICAvLyB0aGlzIGEgZmxvYXRpbmcgZWRnZSAoZm9yIG5vdywgd2UncmUgbm90IGRlYWxpbmcgaW4gaHlwZXJlZGdlcylcbiAgICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgfSBlbHNlIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBXaXRoIG9ubHkgb25lIGNvbm5lY3Rpb24sIHRoaXMgbm9kZSBzaG91bGQgYmVjb21lIGEgc2VsZi1lZGdlXG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLm1vZGVsLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIC8vIEFyZSB3ZSB0aGUgc291cmNlIG9yIHRhcmdldCBvZiB0aGUgZXhpc3RpbmcgZWRnZSAoaW50ZXJuYWxseSwgaW4gdGVybXNcbiAgICAgIC8vIG9mIHNvdXJjZUlkIC8gdGFyZ2V0SWQsIG5vdCBlZGdlQ2xhc3MuZGlyZWN0aW9uKT9cbiAgICAgIGNvbnN0IGlzU291cmNlID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZDtcblxuICAgICAgLy8gQXMgd2UncmUgY29udmVydGVkIHRvIGFuIGVkZ2UsIG91ciBuZXcgcmVzdWx0aW5nIHNvdXJjZSBBTkQgdGFyZ2V0XG4gICAgICAvLyBzaG91bGQgYmUgd2hhdGV2ZXIgaXMgYXQgdGhlIG90aGVyIGVuZCBvZiBlZGdlQ2xhc3MgKGlmIGFueXRoaW5nKVxuICAgICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIHRhYmxlSWQgbGlzdHMgc2hvdWxkIGVtYW5hdGUgb3V0IGZyb20gdGhlIChuZXcpIGVkZ2UgdGFibGU7IGFzc3VtaW5nXG4gICAgICAvLyAoZm9yIGEgbW9tZW50KSB0aGF0IGlzU291cmNlID09PSB0cnVlLCB3ZSdkIGNvbnN0cnVjdCB0aGUgdGFibGVJZCBsaXN0XG4gICAgICAvLyBsaWtlIHRoaXM6XG4gICAgICBsZXQgdGFibGVJZExpc3QgPSBlZGdlQ2xhc3MudGFyZ2V0VGFibGVJZHMuc2xpY2UoKS5yZXZlcnNlKClcbiAgICAgICAgLmNvbmNhdChbIGVkZ2VDbGFzcy50YWJsZUlkIF0pXG4gICAgICAgIC5jb25jYXQoZWRnZUNsYXNzLnNvdXJjZVRhYmxlSWRzKTtcbiAgICAgIGlmICghaXNTb3VyY2UpIHtcbiAgICAgICAgLy8gV2hvb3BzLCBnb3QgaXQgYmFja3dhcmRzIVxuICAgICAgICB0YWJsZUlkTGlzdC5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZWRnZUNsYXNzLmRpcmVjdGVkO1xuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IG9wdGlvbnMudGFyZ2V0VGFibGVJZHMgPSB0YWJsZUlkTGlzdDtcbiAgICAgIC8vIFRPRE86IGluc3RlYWQgb2YgZGVsZXRpbmcgdGhlIGV4aXN0aW5nIGVkZ2UgY2xhc3MsIHNob3VsZCB3ZSBsZWF2ZSBpdFxuICAgICAgLy8gaGFuZ2luZyArIHVuY29ubmVjdGVkP1xuICAgICAgZWRnZUNsYXNzLmRlbGV0ZSgpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgLy8gT2theSwgd2UndmUgZ290IHR3byBlZGdlcywgc28gdGhpcyBpcyBhIGxpdHRsZSBtb3JlIHN0cmFpZ2h0Zm9yd2FyZFxuICAgICAgbGV0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgbGV0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgLy8gRmlndXJlIG91dCB0aGUgZGlyZWN0aW9uLCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSBmYWxzZTtcbiAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MuZGlyZWN0ZWQgJiYgdGFyZ2V0RWRnZUNsYXNzLmRpcmVjdGVkKSB7XG4gICAgICAgIGlmIChzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICB0YXJnZXRFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgICAgLy8gV2UgaGFwcGVuZWQgdG8gZ2V0IHRoZSBlZGdlcyBpbiBvcmRlcjsgc2V0IGRpcmVjdGVkIHRvIHRydWVcbiAgICAgICAgICBvcHRpb25zLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzb3VyY2VFZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkICYmXG4gICAgICAgICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGdvdCB0aGUgZWRnZXMgYmFja3dhcmRzOyBzd2FwIHRoZW0gYW5kIHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICAgICAgc291cmNlRWRnZUNsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW2VkZ2VDbGFzc0lkc1sxXV07XG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIG5vdyB3ZSBrbm93IGhvdyB0byBzZXQgc291cmNlIC8gdGFyZ2V0IGlkc1xuICAgICAgb3B0aW9ucy5zb3VyY2VDbGFzc0lkID0gc291cmNlRWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICBvcHRpb25zLnRhcmdldENsYXNzSWQgPSB0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZDtcbiAgICAgIC8vIENvbmNhdGVuYXRlIHRoZSBpbnRlcm1lZGlhdGUgdGFibGVJZCBsaXN0cywgZW1hbmF0aW5nIG91dCBmcm9tIHRoZVxuICAgICAgLy8gKG5ldykgZWRnZSB0YWJsZVxuICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyA9IHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRUYWJsZUlkcy5zbGljZSgpLnJldmVyc2UoKVxuICAgICAgICAuY29uY2F0KFsgc291cmNlRWRnZUNsYXNzLnRhYmxlSWQgXSlcbiAgICAgICAgLmNvbmNhdChzb3VyY2VFZGdlQ2xhc3Muc291cmNlVGFibGVJZHMpO1xuICAgICAgaWYgKHNvdXJjZUVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgb3B0aW9ucy5zb3VyY2VUYWJsZUlkcy5yZXZlcnNlKCk7XG4gICAgICB9XG4gICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzID0gdGFyZ2V0RWRnZUNsYXNzLnRhcmdldFRhYmxlSWRzLnNsaWNlKCkucmV2ZXJzZSgpXG4gICAgICAgIC5jb25jYXQoWyB0YXJnZXRFZGdlQ2xhc3MudGFibGVJZCBdKVxuICAgICAgICAuY29uY2F0KHRhcmdldEVkZ2VDbGFzcy5zb3VyY2VUYWJsZUlkcyk7XG4gICAgICBpZiAodGFyZ2V0RWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBvcHRpb25zLnRhcmdldFRhYmxlSWRzLnJldmVyc2UoKTtcbiAgICAgIH1cbiAgICAgIC8vIERlbGV0ZSBlYWNoIG9mIHRoZSBlZGdlIGNsYXNzZXNcbiAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgb3B0aW9ucy5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIHRoaXMudGFibGUucmVzZXQoKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbC5jcmVhdGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgb3RoZXJOb2RlQ2xhc3MsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGxldCB0aGlzSGFzaCwgb3RoZXJIYXNoLCBzb3VyY2VUYWJsZUlkcywgdGFyZ2V0VGFibGVJZHM7XG4gICAgaWYgKGF0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbXTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpc0hhc2ggPSB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgICAgc291cmNlVGFibGVJZHMgPSBbIHRoaXNIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgaWYgKG90aGVyQXR0cmlidXRlID09PSBudWxsKSB7XG4gICAgICBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy50YWJsZTtcbiAgICAgIHRhcmdldFRhYmxlSWRzID0gW107XG4gICAgfSBlbHNlIHtcbiAgICAgIG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgICB0YXJnZXRUYWJsZUlkcyA9IFsgb3RoZXJIYXNoLnRhYmxlSWQgXTtcbiAgICB9XG4gICAgLy8gSWYgd2UgaGF2ZSBhIHNlbGYgZWRnZSBjb25uZWN0aW5nIHRoZSBzYW1lIGF0dHJpYnV0ZSwgd2UgY2FuIGp1c3QgdXNlXG4gICAgLy8gdGhlIEFnZ3JlZ2F0ZWRUYWJsZSBhcyB0aGUgZWRnZSB0YWJsZTsgb3RoZXJ3aXNlIHdlIG5lZWQgdG8gY3JlYXRlIGFcbiAgICAvLyBDb25uZWN0ZWRUYWJsZVxuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpcyA9PT0gb3RoZXJOb2RlQ2xhc3MgJiYgYXR0cmlidXRlID09PSBvdGhlckF0dHJpYnV0ZVxuICAgICAgPyB0aGlzSGFzaCA6IHRoaXNIYXNoLmNvbm5lY3QoW290aGVySGFzaF0pO1xuICAgIHJldHVybiB0aGlzLm1vZGVsLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZVRhYmxlSWRzLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgIHRhcmdldFRhYmxlSWRzLFxuICAgICAgcHJlU2F2ZTogbmV3RWRnZUNsYXNzID0+IHtcbiAgICAgICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBhZ2dyZWdhdGUgKGF0dHJpYnV0ZSkge1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHN1cGVyLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICAgIHRoaXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiBuZXdOb2RlQ2xhc3MsXG4gICAgICBhdHRyaWJ1dGUsXG4gICAgICBvdGhlckF0dHJpYnV0ZTogbnVsbFxuICAgIH0pO1xuICAgIHJldHVybiBuZXdOb2RlQ2xhc3M7XG4gIH1cbiAgZGlzY29ubmVjdEFsbEVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3Mgb2YgdGhpcy5jb25uZWN0ZWRDbGFzc2VzKCkpIHtcbiAgICAgIGlmIChlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIEVkZ2VXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIGlmICghdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjbGFzc09iaiBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIHNvdXJjZU5vZGVzIChvcHRpb25zID0ge30pIHtcbiAgICBpZiAodGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHNvdXJjZVRhYmxlSWQgPSB0aGlzLmNsYXNzT2JqLl9vcmlncmFwaFxuICAgICAgLmNsYXNzZXNbdGhpcy5jbGFzc09iai5zb3VyY2VDbGFzc0lkXS50YWJsZUlkO1xuICAgIG9wdGlvbnMudGFibGVJZHMgPSB0aGlzLmNsYXNzT2JqLnNvdXJjZVRhYmxlSWRzXG4gICAgICAuY29uY2F0KFsgc291cmNlVGFibGVJZCBdKTtcbiAgICB5aWVsZCAqIHRoaXMuaXRlcmF0ZUFjcm9zc0Nvbm5lY3Rpb25zKG9wdGlvbnMpO1xuICB9XG4gIGFzeW5jICogdGFyZ2V0Tm9kZXMgKG9wdGlvbnMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWQgPT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgdGFyZ2V0VGFibGVJZCA9IHRoaXMuY2xhc3NPYmouX29yaWdyYXBoXG4gICAgICAuY2xhc3Nlc1t0aGlzLmNsYXNzT2JqLnRhcmdldENsYXNzSWRdLnRhYmxlSWQ7XG4gICAgb3B0aW9ucy50YWJsZUlkcyA9IHRoaXMuY2xhc3NPYmoudGFyZ2V0VGFibGVJZHNcbiAgICAgIC5jb25jYXQoWyB0YXJnZXRUYWJsZUlkIF0pO1xuICAgIHlpZWxkICogdGhpcy5pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMob3B0aW9ucyk7XG4gIH1cbiAgYXN5bmMgKiBwYWlyd2lzZUVkZ2VzIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBzb3VyY2Ugb2YgdGhpcy5zb3VyY2VOb2RlcyhvcHRpb25zKSkge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXROb2RlcyhvcHRpb25zKSkge1xuICAgICAgICB5aWVsZCB7IHNvdXJjZSwgZWRnZTogdGhpcywgdGFyZ2V0IH07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jIGh5cGVyZWRnZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHNvdXJjZXM6IFtdLFxuICAgICAgdGFyZ2V0czogW10sXG4gICAgICBlZGdlOiB0aGlzXG4gICAgfTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHNvdXJjZSBvZiB0aGlzLnNvdXJjZU5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICByZXN1bHQucHVzaChzb3VyY2UpO1xuICAgIH1cbiAgICBmb3IgYXdhaXQgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldE5vZGVzKG9wdGlvbnMpKSB7XG4gICAgICByZXN1bHQucHVzaCh0YXJnZXQpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuaW1wb3J0IEVkZ2VXcmFwcGVyIGZyb20gJy4uL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcblxuICAgIC8vIHNvdXJjZVRhYmxlSWRzIGFuZCB0YXJnZXRUYWJsZUlkcyBhcmUgbGlzdHMgb2YgYW55IGludGVybWVkaWF0ZSB0YWJsZXMsXG4gICAgLy8gYmVnaW5uaW5nIHdpdGggdGhlIGVkZ2UgdGFibGUgKGJ1dCBub3QgaW5jbHVkaW5nIGl0KSwgdGhhdCBsZWFkIHRvIHRoZVxuICAgIC8vIHNvdXJjZSAvIHRhcmdldCBub2RlIHRhYmxlcyAoYnV0IG5vdCBpbmNsdWRpbmcpIHRob3NlXG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gb3B0aW9ucy5zb3VyY2VUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gb3B0aW9ucy50YXJnZXRUYWJsZUlkcyB8fCBbXTtcbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZVRhYmxlSWRzID0gdGhpcy5zb3VyY2VUYWJsZUlkcztcbiAgICByZXN1bHQudGFyZ2V0Q2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICByZXN1bHQudGFyZ2V0VGFibGVJZHMgPSB0aGlzLnRhcmdldFRhYmxlSWRzO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfd3JhcCAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuY2xhc3NPYmogPSB0aGlzO1xuICAgIHJldHVybiBuZXcgRWRnZVdyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX3NwbGl0VGFibGVJZExpc3QgKHRhYmxlSWRMaXN0LCBvdGhlckNsYXNzKSB7XG4gICAgbGV0IHJlc3VsdCA9IHtcbiAgICAgIG5vZGVUYWJsZUlkTGlzdDogW10sXG4gICAgICBlZGdlVGFibGVJZDogbnVsbCxcbiAgICAgIGVkZ2VUYWJsZUlkTGlzdDogW11cbiAgICB9O1xuICAgIGlmICh0YWJsZUlkTGlzdC5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWQgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSkudGFibGVJZDtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGUgYXMgdGhlIG5ldyBlZGdlIHRhYmxlOyBwcmlvcml0aXplXG4gICAgICAvLyBTdGF0aWNUYWJsZSBhbmQgU3RhdGljRGljdFRhYmxlXG4gICAgICBsZXQgc3RhdGljRXhpc3RzID0gZmFsc2U7XG4gICAgICBsZXQgdGFibGVEaXN0YW5jZXMgPSB0YWJsZUlkTGlzdC5tYXAoKHRhYmxlSWQsIGluZGV4KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0aGlzLm1vZGVsLnRhYmxlc1t0YWJsZUlkXS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZUlkLCBpbmRleCwgZGlzdDogTWF0aC5hYnModGFibGVJZExpc3QgLyAyIC0gaW5kZXgpIH07XG4gICAgICB9KTtcbiAgICAgIGlmIChzdGF0aWNFeGlzdHMpIHtcbiAgICAgICAgdGFibGVEaXN0YW5jZXMgPSB0YWJsZURpc3RhbmNlcy5maWx0ZXIoKHsgdGFibGVJZCB9KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMubW9kZWwudGFibGVzW3RhYmxlSWRdLnR5cGUuc3RhcnRzV2l0aCgnU3RhdGljJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgY29uc3QgeyB0YWJsZUlkLCBpbmRleCB9ID0gdGFibGVEaXN0YW5jZXMuc29ydCgoYSwgYikgPT4gYS5kaXN0IC0gYi5kaXN0KVswXTtcbiAgICAgIHJlc3VsdC5lZGdlVGFibGVJZCA9IHRhYmxlSWQ7XG4gICAgICByZXN1bHQuZWRnZVRhYmxlSWRMaXN0ID0gdGFibGVJZExpc3Quc2xpY2UoMCwgaW5kZXgpLnJldmVyc2UoKTtcbiAgICAgIHJlc3VsdC5ub2RlVGFibGVJZExpc3QgPSB0YWJsZUlkTGlzdC5zbGljZShpbmRleCArIDEpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIHRoaXMuZGlzY29ubmVjdEFsbEVkZ2VzKCk7XG4gICAgdGVtcC50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgdGVtcC5vdmVyd3JpdGUgPSB0cnVlO1xuICAgIGNvbnN0IG5ld05vZGVDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3ModGVtcCk7XG5cbiAgICBpZiAodGVtcC5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnNvdXJjZUNsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAuc291cmNlVGFibGVJZHMsIHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHNvdXJjZVRhYmxlSWRzOiBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogZWRnZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0ZW1wLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3Qge1xuICAgICAgICBub2RlVGFibGVJZExpc3QsXG4gICAgICAgIGVkZ2VUYWJsZUlkLFxuICAgICAgICBlZGdlVGFibGVJZExpc3RcbiAgICAgIH0gPSB0aGlzLl9zcGxpdFRhYmxlSWRMaXN0KHRlbXAudGFyZ2V0VGFibGVJZHMsIHRhcmdldENsYXNzKTtcbiAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMubW9kZWwuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiBuZXdOb2RlQ2xhc3MuY2xhc3NJZCxcbiAgICAgICAgc291cmNlVGFibGVJZHM6IGVkZ2VUYWJsZUlkTGlzdCxcbiAgICAgICAgdGFyZ2V0Q2xhc3NJZDogdGVtcC50YXJnZXRDbGFzc0lkLFxuICAgICAgICB0YXJnZXRUYWJsZUlkczogbm9kZVRhYmxlSWRMaXN0XG4gICAgICB9KTtcbiAgICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1t0YXJnZXRFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLnRhYmxlLnJlc2V0KCk7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgICByZXR1cm4gbmV3Tm9kZUNsYXNzO1xuICB9XG4gICogY29ubmVjdGVkQ2xhc3NlcyAoKSB7XG4gICAgaWYgKHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgeWllbGQgdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgfVxuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHlpZWxkIHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIH1cbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucy5zaWRlID09PSAnc291cmNlJykge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5zaWRlID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFBvbGl0aWNhbE91dHNpZGVyRXJyb3I6IFwiJHtvcHRpb25zLnNpZGV9XCIgaXMgYW4gaW52YWxpZCBzaWRlYCk7XG4gICAgfVxuICB9XG4gIHRvZ2dsZURpcmVjdGlvbiAoZGlyZWN0ZWQpIHtcbiAgICBpZiAoZGlyZWN0ZWQgPT09IGZhbHNlIHx8IHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9PT0gdHJ1ZSkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgICAgZGVsZXRlIHRoaXMuc3dhcHBlZERpcmVjdGlvbjtcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmRpcmVjdGVkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuc3dhcHBlZERpcmVjdGlvbiA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBEaXJlY3RlZCB3YXMgYWxyZWFkeSB0cnVlLCBqdXN0IHN3aXRjaCBzb3VyY2UgYW5kIHRhcmdldFxuICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICB0aGlzLnRhcmdldENsYXNzSWQgPSB0ZW1wO1xuICAgICAgdGVtcCA9IHRoaXMuc291cmNlVGFibGVJZHM7XG4gICAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gdGhpcy50YXJnZXRUYWJsZUlkcztcbiAgICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSB0ZW1wO1xuICAgICAgdGhpcy5zd2FwcGVkRGlyZWN0aW9uID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBjb25uZWN0U291cmNlICh7XG4gICAgbm9kZUNsYXNzLFxuICAgIG5vZGVBdHRyaWJ1dGUgPSBudWxsLFxuICAgIGVkZ2VBdHRyaWJ1dGUgPSBudWxsXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgIH1cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCBzb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyBzb3VyY2VDbGFzcy50YWJsZSA6IHNvdXJjZUNsYXNzLnRhYmxlLmFnZ3JlZ2F0ZShub2RlQXR0cmlidXRlKTtcbiAgICB0aGlzLnNvdXJjZVRhYmxlSWRzID0gWyBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pLnRhYmxlSWQgXTtcbiAgICBpZiAoZWRnZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy51bnNoaWZ0KGVkZ2VIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICBpZiAobm9kZUF0dHJpYnV0ZSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zb3VyY2VUYWJsZUlkcy5wdXNoKG5vZGVIYXNoLnRhYmxlSWQpO1xuICAgIH1cbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGNvbm5lY3RUYXJnZXQgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGxcbiAgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgfVxuICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IG5vZGVDbGFzcy5jbGFzc0lkO1xuICAgIGNvbnN0IHRhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgdGFyZ2V0Q2xhc3MuZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuXG4gICAgY29uc3QgZWRnZUhhc2ggPSBlZGdlQXR0cmlidXRlID09PSBudWxsID8gdGhpcy50YWJsZSA6IHRoaXMudGFibGUuYWdncmVnYXRlKGVkZ2VBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG5vZGVIYXNoID0gbm9kZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRhcmdldENsYXNzLnRhYmxlIDogdGFyZ2V0Q2xhc3MudGFibGUuYWdncmVnYXRlKG5vZGVBdHRyaWJ1dGUpO1xuICAgIHRoaXMudGFyZ2V0VGFibGVJZHMgPSBbIGVkZ2VIYXNoLmNvbm5lY3QoW25vZGVIYXNoXSkudGFibGVJZCBdO1xuICAgIGlmIChlZGdlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnVuc2hpZnQoZWRnZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIGlmIChub2RlQXR0cmlidXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnRhcmdldFRhYmxlSWRzLnB1c2gobm9kZUhhc2gudGFibGVJZCk7XG4gICAgfVxuICAgIHRoaXMubW9kZWwudHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgZGlzY29ubmVjdFNvdXJjZSAoKSB7XG4gICAgY29uc3QgZXhpc3RpbmdTb3VyY2VDbGFzcyA9IHRoaXMubW9kZWwuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdO1xuICAgIGlmIChleGlzdGluZ1NvdXJjZUNsYXNzKSB7XG4gICAgICBkZWxldGUgZXhpc3RpbmdTb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VUYWJsZUlkcyA9IFtdO1xuICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IG51bGw7XG4gICAgdGhpcy5tb2RlbC50cmlnZ2VyKCd1cGRhdGUnKTtcbiAgfVxuICBkaXNjb25uZWN0VGFyZ2V0ICgpIHtcbiAgICBjb25zdCBleGlzdGluZ1RhcmdldENsYXNzID0gdGhpcy5tb2RlbC5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF07XG4gICAgaWYgKGV4aXN0aW5nVGFyZ2V0Q2xhc3MpIHtcbiAgICAgIGRlbGV0ZSBleGlzdGluZ1RhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldFRhYmxlSWRzID0gW107XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbnVsbDtcbiAgICB0aGlzLm1vZGVsLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKCk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IG1pbWUgZnJvbSAnbWltZS10eXBlcyc7XG5pbXBvcnQgZGF0YWxpYiBmcm9tICdkYXRhbGliJztcblxuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4uL1RhYmxlcy9UYWJsZXMuanMnO1xuaW1wb3J0ICogYXMgQ0xBU1NFUyBmcm9tICcuLi9DbGFzc2VzL0NsYXNzZXMuanMnO1xuXG5jb25zdCBEQVRBTElCX0ZPUk1BVFMgPSB7XG4gICdqc29uJzogJ2pzb24nLFxuICAnY3N2JzogJ2NzdicsXG4gICd0c3YnOiAndHN2JyxcbiAgJ3RvcG9qc29uJzogJ3RvcG9qc29uJyxcbiAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xufTtcblxubGV0IE5FWFRfQ0xBU1NfSUQgPSAxO1xubGV0IE5FWFRfVEFCTEVfSUQgPSAxO1xuXG5jbGFzcyBOZXR3b3JrTW9kZWwgZXh0ZW5kcyBUcmlnZ2VyYWJsZU1peGluKGNsYXNzIHt9KSB7XG4gIGNvbnN0cnVjdG9yICh7XG4gICAgb3JpZ3JhcGgsXG4gICAgbW9kZWxJZCxcbiAgICBuYW1lID0gbW9kZWxJZCxcbiAgICBhbm5vdGF0aW9ucyA9IHt9LFxuICAgIGNsYXNzZXMgPSB7fSxcbiAgICB0YWJsZXMgPSB7fVxuICB9KSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLl9vcmlncmFwaCA9IG9yaWdyYXBoO1xuICAgIHRoaXMubW9kZWxJZCA9IG1vZGVsSWQ7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmFubm90YXRpb25zID0gYW5ub3RhdGlvbnM7XG4gICAgdGhpcy5jbGFzc2VzID0ge307XG4gICAgdGhpcy50YWJsZXMgPSB7fTtcblxuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyhjbGFzc2VzKSkge1xuICAgICAgdGhpcy5jbGFzc2VzW2NsYXNzT2JqLmNsYXNzSWRdID0gdGhpcy5oeWRyYXRlKGNsYXNzT2JqLCBDTEFTU0VTKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiBPYmplY3QudmFsdWVzKHRhYmxlcykpIHtcbiAgICAgIHRoaXMudGFibGVzW3RhYmxlLnRhYmxlSWRdID0gdGhpcy5oeWRyYXRlKHRhYmxlLCBUQUJMRVMpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ3VwZGF0ZScsICgpID0+IHtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zYXZlVGltZW91dCk7XG4gICAgICB0aGlzLl9zYXZlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vcmlncmFwaC5zYXZlKCk7XG4gICAgICAgIHRoaXMuX3NhdmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuICAgICAgfSwgMCk7XG4gICAgfSk7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBjbGFzc2VzID0ge307XG4gICAgY29uc3QgdGFibGVzID0ge307XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0gPSBjbGFzc09iai5fdG9SYXdPYmplY3QoKTtcbiAgICAgIGNsYXNzZXNbY2xhc3NPYmouY2xhc3NJZF0udHlwZSA9IGNsYXNzT2JqLnR5cGU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgdGFibGVPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLnRhYmxlcykpIHtcbiAgICAgIHRhYmxlc1t0YWJsZU9iai50YWJsZUlkXSA9IHRhYmxlT2JqLl90b1Jhd09iamVjdCgpO1xuICAgICAgdGFibGVzW3RhYmxlT2JqLnRhYmxlSWRdLnR5cGUgPSB0YWJsZU9iai50eXBlO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgbW9kZWxJZDogdGhpcy5tb2RlbElkLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgYW5ub3RhdGlvbnM6IHRoaXMuYW5ub3RhdGlvbnMsXG4gICAgICBjbGFzc2VzOiB0aGlzLmNsYXNzZXMsXG4gICAgICB0YWJsZXM6IHRoaXMudGFibGVzXG4gICAgfTtcbiAgfVxuICBnZXQgdW5zYXZlZCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NhdmVUaW1lb3V0ICE9PSB1bmRlZmluZWQ7XG4gIH1cbiAgaHlkcmF0ZSAocmF3T2JqZWN0LCBUWVBFUykge1xuICAgIHJhd09iamVjdC5tb2RlbCA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBUWVBFU1tyYXdPYmplY3QudHlwZV0ocmF3T2JqZWN0KTtcbiAgfVxuICBjcmVhdGVUYWJsZSAob3B0aW9ucykge1xuICAgIHdoaWxlICghb3B0aW9ucy50YWJsZUlkIHx8ICghb3B0aW9ucy5vdmVyd3JpdGUgJiYgdGhpcy50YWJsZXNbb3B0aW9ucy50YWJsZUlkXSkpIHtcbiAgICAgIG9wdGlvbnMudGFibGVJZCA9IGB0YWJsZSR7TkVYVF9UQUJMRV9JRH1gO1xuICAgICAgTkVYVF9UQUJMRV9JRCArPSAxO1xuICAgIH1cbiAgICBvcHRpb25zLm1vZGVsID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFRBQkxFU1tvcHRpb25zLnR5cGVdKG9wdGlvbnMpO1xuICAgIHRoaXMudHJpZ2dlcigndXBkYXRlJyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICB3aGlsZSAoIW9wdGlvbnMuY2xhc3NJZCB8fCAoIW9wdGlvbnMub3ZlcndyaXRlICYmIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdKSkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMubW9kZWwgPSB0aGlzO1xuICAgIHRoaXMuY2xhc3Nlc1tvcHRpb25zLmNsYXNzSWRdID0gbmV3IENMQVNTRVNbb3B0aW9ucy50eXBlXShvcHRpb25zKTtcbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICAgIHJldHVybiB0aGlzLmNsYXNzZXNbb3B0aW9ucy5jbGFzc0lkXTtcbiAgfVxuICBhc3luYyBhZGRGaWxlQXNTdGF0aWNUYWJsZSAoe1xuICAgIGZpbGVPYmosXG4gICAgZW5jb2RpbmcgPSBtaW1lLmNoYXJzZXQoZmlsZU9iai50eXBlKSxcbiAgICBleHRlbnNpb25PdmVycmlkZSA9IG51bGwsXG4gICAgc2tpcFNpemVDaGVjayA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGNvbnN0IGZpbGVNQiA9IGZpbGVPYmouc2l6ZSAvIDEwNDg1NzY7XG4gICAgaWYgKGZpbGVNQiA+PSAzMCkge1xuICAgICAgaWYgKHNraXBTaXplQ2hlY2spIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBBdHRlbXB0aW5nIHRvIGxvYWQgJHtmaWxlTUJ9TUIgZmlsZSBpbnRvIG1lbW9yeWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke2ZpbGVNQn1NQiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkIHN0YXRpY2FsbHlgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZXh0ZW5zaW9uT3ZlcnJpZGUgYWxsb3dzIHRoaW5ncyBsaWtlIHRvcG9qc29uIG9yIHRyZWVqc29uICh0aGF0IGRvbid0XG4gICAgLy8gaGF2ZSBzdGFuZGFyZGl6ZWQgbWltZVR5cGVzKSB0byBiZSBwYXJzZWQgY29ycmVjdGx5XG4gICAgbGV0IHRleHQgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVhZGVyID0gbmV3IHRoaXMuRmlsZVJlYWRlcigpO1xuICAgICAgcmVhZGVyLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlT2JqLCBlbmNvZGluZyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSh7XG4gICAgICBuYW1lOiBmaWxlT2JqLm5hbWUsXG4gICAgICBleHRlbnNpb246IGV4dGVuc2lvbk92ZXJyaWRlIHx8IG1pbWUuZXh0ZW5zaW9uKGZpbGVPYmoudHlwZSksXG4gICAgICB0ZXh0XG4gICAgfSk7XG4gIH1cbiAgYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSAoeyBuYW1lLCBleHRlbnNpb24gPSAndHh0JywgdGV4dCB9KSB7XG4gICAgbGV0IGRhdGEsIGF0dHJpYnV0ZXM7XG4gICAgaWYgKERBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMuY3JlYXRlVGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlQ2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMudGFibGVzW3RhYmxlSWRdLmRlbGV0ZSgpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoIWVyci5pblVzZSkge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jIGdldFNhbXBsZUdyYXBoICh7XG4gICAgcm9vdENsYXNzID0gbnVsbCxcbiAgICBicmFuY2hMaW1pdCA9IEluZmluaXR5LFxuICAgIG5vZGVMaW1pdCA9IEluZmluaXR5LFxuICAgIGVkZ2VMaW1pdCA9IEluZmluaXR5LFxuICAgIHRyaXBsZUxpbWl0ID0gSW5maW5pdHlcbiAgfSA9IHt9KSB7XG4gICAgY29uc3Qgc2FtcGxlR3JhcGggPSB7XG4gICAgICBub2RlczogW10sXG4gICAgICBub2RlTG9va3VwOiB7fSxcbiAgICAgIGVkZ2VzOiBbXSxcbiAgICAgIGVkZ2VMb29rdXA6IHt9XG4gICAgfTtcblxuICAgIGxldCBudW1UcmlwbGVzID0gMDtcbiAgICBsZXQgbnVtRWRnZUluc3RhbmNlcyA9IDA7XG4gICAgY29uc3QgYWRkTm9kZSA9IG5vZGUgPT4ge1xuICAgICAgaWYgKCFzYW1wbGVHcmFwaC5ub2RlTG9va3VwW25vZGUuaW5zdGFuY2VJZF0pIHtcbiAgICAgICAgc2FtcGxlR3JhcGgubm9kZUxvb2t1cFtub2RlLmluc3RhbmNlSWRdID0gc2FtcGxlR3JhcGgubm9kZXMubGVuZ3RoO1xuICAgICAgICBzYW1wbGVHcmFwaC5ub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNhbXBsZUdyYXBoLm5vZGVzLmxlbmd0aCA+IG5vZGVMaW1pdDtcbiAgICB9O1xuICAgIGNvbnN0IGFkZEVkZ2UgPSBlZGdlID0+IHtcbiAgICAgIGlmICghc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdKSB7XG4gICAgICAgIHNhbXBsZUdyYXBoLmVkZ2VMb29rdXBbZWRnZS5pbnN0YW5jZUlkXSA9IHtcbiAgICAgICAgICBpbnN0YW5jZTogZWRnZSxcbiAgICAgICAgICBwYWlyd2lzZUluc3RhbmNlczogW11cbiAgICAgICAgfTtcbiAgICAgICAgbnVtRWRnZUluc3RhbmNlcysrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bUVkZ2VJbnN0YW5jZXMgPiBlZGdlTGltaXQ7XG4gICAgfTtcbiAgICBjb25zdCBhZGRUcmlwbGUgPSAoc291cmNlLCBlZGdlLCB0YXJnZXQpID0+IHtcbiAgICAgIGNvbnN0IHRyaXBwZWRPdGhlckxpbWl0ID0gYWRkTm9kZShzb3VyY2UpIHx8IGFkZE5vZGUoZWRnZSkgfHwgYWRkRWRnZSh0YXJnZXQpO1xuICAgICAgc2FtcGxlR3JhcGguZWRnZUxvb2t1cFtlZGdlLmluc3RhbmNlSWRdLnBhaXJ3aXNlSW5zdGFuY2VzXG4gICAgICAgIC5wdXNoKHNhbXBsZUdyYXBoLmVkZ2VzLmxlbmd0aCk7XG4gICAgICBzYW1wbGVHcmFwaC5lZGdlcy5wdXNoKHtcbiAgICAgICAgc291cmNlOiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3NvdXJjZS5pbnN0YW5jZUlkXSxcbiAgICAgICAgdGFyZ2V0OiBzYW1wbGVHcmFwaC5ub2RlTG9va3VwW3RhcmdldC5pbnN0YW5jZUlkXSxcbiAgICAgICAgZWRnZUluc3RhbmNlOiBlZGdlXG4gICAgICB9KTtcbiAgICAgIG51bVRyaXBsZXMrKztcbiAgICAgIHJldHVybiB0cmlwcGVkT3RoZXJMaW1pdCB8fCBudW1UcmlwbGVzID4gdHJpcGxlTGltaXQ7XG4gICAgfTtcblxuICAgIGxldCBjbGFzc0xpc3QgPSByb290Q2xhc3MgPyBbcm9vdENsYXNzXSA6IE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IG5vZGUgb2Ygcm9vdENsYXNzLnRhYmxlLml0ZXJhdGUoKSkge1xuICAgICAgICAgIGlmIChhZGROb2RlKG5vZGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgeyBzb3VyY2UsIGVkZ2UsIHRhcmdldCB9IG9mIG5vZGUucGFpcndpc2VOZWlnaGJvcmhvb2QoeyBsaW1pdDogYnJhbmNoTGltaXQgfSkpIHtcbiAgICAgICAgICAgIGlmIChhZGRUcmlwbGUoc291cmNlLCBlZGdlLCB0YXJnZXQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoY2xhc3NPYmoudHlwZSA9PT0gJ0VkZ2UnKSB7XG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgZWRnZSBvZiByb290Q2xhc3MudGFibGUuaXRlcmF0ZSgpKSB7XG4gICAgICAgICAgaWYgKGFkZEVkZ2UoZWRnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yIGF3YWl0IChjb25zdCB7IHNvdXJjZSwgdGFyZ2V0IH0gb2YgZWRnZS5wYWlyd2lzZUVkZ2VzKHsgbGltaXQ6IGJyYW5jaExpbWl0IH0pKSB7XG4gICAgICAgICAgICBpZiAoYWRkVHJpcGxlKHNvdXJjZSwgZWRnZSwgdGFyZ2V0KSkge1xuICAgICAgICAgICAgICByZXR1cm4gc2FtcGxlR3JhcGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzYW1wbGVHcmFwaDtcbiAgfVxuICBnZXROZXR3b3JrTW9kZWxHcmFwaCAoaW5jbHVkZUR1bW1pZXMgPSBmYWxzZSkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc2VzID0gW107XG4gICAgbGV0IGdyYXBoID0ge1xuICAgICAgY2xhc3NlczogW10sXG4gICAgICBjbGFzc0xvb2t1cDoge30sXG4gICAgICBjbGFzc0Nvbm5lY3Rpb25zOiBbXVxuICAgIH07XG5cbiAgICBjb25zdCBjbGFzc0xpc3QgPSBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3Nlcyk7XG5cbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIGNsYXNzTGlzdCkge1xuICAgICAgLy8gQWRkIGFuZCBpbmRleCB0aGUgY2xhc3MgYXMgYSBub2RlXG4gICAgICBncmFwaC5jbGFzc0xvb2t1cFtjbGFzc09iai5jbGFzc0lkXSA9IGdyYXBoLmNsYXNzZXMubGVuZ3RoO1xuICAgICAgY29uc3QgY2xhc3NTcGVjID0gY2xhc3NPYmouX3RvUmF3T2JqZWN0KCk7XG4gICAgICBjbGFzc1NwZWMudHlwZSA9IGNsYXNzT2JqLmNvbnN0cnVjdG9yLm5hbWU7XG4gICAgICBncmFwaC5jbGFzc2VzLnB1c2goY2xhc3NTcGVjKTtcblxuICAgICAgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdFZGdlJykge1xuICAgICAgICAvLyBTdG9yZSB0aGUgZWRnZSBjbGFzcyBzbyB3ZSBjYW4gY3JlYXRlIGNsYXNzQ29ubmVjdGlvbnMgbGF0ZXJcbiAgICAgICAgZWRnZUNsYXNzZXMucHVzaChjbGFzc09iaik7XG4gICAgICB9IGVsc2UgaWYgKGNsYXNzT2JqLnR5cGUgPT09ICdOb2RlJyAmJiBpbmNsdWRlRHVtbWllcykge1xuICAgICAgICAvLyBDcmVhdGUgYSBcInBvdGVudGlhbFwiIGNvbm5lY3Rpb24gKyBkdW1teSBub2RlXG4gICAgICAgIGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMucHVzaCh7XG4gICAgICAgICAgaWQ6IGAke2NsYXNzT2JqLmNsYXNzSUR9PmR1bW15YCxcbiAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgZGlyZWN0ZWQ6IGZhbHNlLFxuICAgICAgICAgIGxvY2F0aW9uOiAnbm9kZScsXG4gICAgICAgICAgZHVtbXk6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIGdyYXBoLm5vZGVzLnB1c2goeyBkdW1teTogdHJ1ZSB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gQ3JlYXRlIGV4aXN0aW5nIGNsYXNzQ29ubmVjdGlvbnNcbiAgICAgIGVkZ2VDbGFzc2VzLmZvckVhY2goZWRnZUNsYXNzID0+IHtcbiAgICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ29ubmVjdCB0aGUgc291cmNlIG5vZGUgY2xhc3MgdG8gdGhlIGVkZ2UgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkfT4ke2VkZ2VDbGFzcy5jbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJ1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgc291cmNlIGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgZHVtbXk+JHtlZGdlQ2xhc3MuY2xhc3NJZH1gLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLmNsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAnc291cmNlJyxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkICE9PSBudWxsKSB7XG4gICAgICAgICAgLy8gQ29ubmVjdCB0aGUgZWRnZSBjbGFzcyB0byB0aGUgdGFyZ2V0IG5vZGUgY2xhc3NcbiAgICAgICAgICBncmFwaC5jbGFzc0Nvbm5lY3Rpb25zLnB1c2goe1xuICAgICAgICAgICAgaWQ6IGAke2VkZ2VDbGFzcy5jbGFzc0lkfT4ke2VkZ2VDbGFzcy50YXJnZXRDbGFzc0lkfWAsXG4gICAgICAgICAgICBzb3VyY2U6IGdyYXBoLmNsYXNzTG9va3VwW2VkZ2VDbGFzcy5jbGFzc0lkXSxcbiAgICAgICAgICAgIHRhcmdldDogZ3JhcGguY2xhc3NMb29rdXBbZWRnZUNsYXNzLnRhcmdldENsYXNzSWRdLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0J1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGluY2x1ZGVEdW1taWVzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgXCJwb3RlbnRpYWxcIiBjb25uZWN0aW9uICsgZHVtbXkgdGFyZ2V0IGNsYXNzXG4gICAgICAgICAgZ3JhcGguY2xhc3NDb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICAgIGlkOiBgJHtlZGdlQ2xhc3MuY2xhc3NJZH0+ZHVtbXlgLFxuICAgICAgICAgICAgc291cmNlOiBncmFwaC5jbGFzc0xvb2t1cFtlZGdlQ2xhc3MuY2xhc3NJZF0sXG4gICAgICAgICAgICB0YXJnZXQ6IGdyYXBoLmNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgZGlyZWN0ZWQ6IGVkZ2VDbGFzcy5kaXJlY3RlZCxcbiAgICAgICAgICAgIGxvY2F0aW9uOiAndGFyZ2V0JyxcbiAgICAgICAgICAgIGR1bW15OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZ3JhcGguY2xhc3Nlcy5wdXNoKHsgZHVtbXk6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBncmFwaDtcbiAgfVxuICBnZXRUYWJsZURlcGVuZGVuY3lHcmFwaCAoKSB7XG4gICAgY29uc3QgZ3JhcGggPSB7XG4gICAgICB0YWJsZXM6IFtdLFxuICAgICAgdGFibGVMb29rdXA6IHt9LFxuICAgICAgdGFibGVMaW5rczogW11cbiAgICB9O1xuICAgIGNvbnN0IHRhYmxlTGlzdCA9IE9iamVjdC52YWx1ZXModGhpcy50YWJsZXMpO1xuICAgIGZvciAoY29uc3QgdGFibGUgb2YgdGFibGVMaXN0KSB7XG4gICAgICBjb25zdCB0YWJsZVNwZWMgPSB0YWJsZS5fdG9SYXdPYmplY3QoKTtcbiAgICAgIHRhYmxlU3BlYy50eXBlID0gdGFibGUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdID0gZ3JhcGgudGFibGVzLmxlbmd0aDtcbiAgICAgIGdyYXBoLnRhYmxlcy5wdXNoKHRhYmxlU3BlYyk7XG4gICAgfVxuICAgIC8vIEZpbGwgdGhlIGdyYXBoIHdpdGggbGlua3MgYmFzZWQgb24gcGFyZW50VGFibGVzLi4uXG4gICAgZm9yIChjb25zdCB0YWJsZSBvZiB0YWJsZUxpc3QpIHtcbiAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgdGFibGUucGFyZW50VGFibGVzKSB7XG4gICAgICAgIGdyYXBoLnRhYmxlTGlua3MucHVzaCh7XG4gICAgICAgICAgc291cmNlOiBncmFwaC50YWJsZUxvb2t1cFtwYXJlbnRUYWJsZS50YWJsZUlkXSxcbiAgICAgICAgICB0YXJnZXQ6IGdyYXBoLnRhYmxlTG9va3VwW3RhYmxlLnRhYmxlSWRdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZ3JhcGg7XG4gIH1cbiAgZ2V0RnVsbFNjaGVtYUdyYXBoICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih0aGlzLmdldE5ldHdvcmtNb2RlbEdyYXBoKCksIHRoaXMuZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgoKSk7XG4gIH1cbiAgY3JlYXRlU2NoZW1hTW9kZWwgKCkge1xuICAgIGNvbnN0IGdyYXBoID0gdGhpcy5nZXRGdWxsU2NoZW1hR3JhcGgoKTtcbiAgICBjb25zdCBuZXdNb2RlbCA9IHRoaXMuX29yaWdyYXBoLmNyZWF0ZU1vZGVsKHsgbmFtZTogdGhpcy5uYW1lICsgJ19zY2hlbWEnIH0pO1xuICAgIGxldCBjbGFzc2VzID0gbmV3TW9kZWwuYWRkU3RhdGljVGFibGUoe1xuICAgICAgZGF0YTogZ3JhcGguY2xhc3NlcyxcbiAgICAgIG5hbWU6ICdDbGFzc2VzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgY2xhc3NDb25uZWN0aW9ucyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLmNsYXNzQ29ubmVjdGlvbnMsXG4gICAgICBuYW1lOiAnQ2xhc3MgQ29ubmVjdGlvbnMnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGxldCB0YWJsZXMgPSBuZXdNb2RlbC5hZGRTdGF0aWNUYWJsZSh7XG4gICAgICBkYXRhOiBncmFwaC50YWJsZXMsXG4gICAgICBuYW1lOiAnVGFibGVzJ1xuICAgIH0pLmludGVycHJldEFzTm9kZXMoKTtcbiAgICBsZXQgdGFibGVMaW5rcyA9IG5ld01vZGVsLmFkZFN0YXRpY1RhYmxlKHtcbiAgICAgIGRhdGE6IGdyYXBoLnRhYmxlTGlua3MsXG4gICAgICBuYW1lOiAnVGFibGUgTGlua3MnXG4gICAgfSkuaW50ZXJwcmV0QXNFZGdlcygpO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogY2xhc3NDb25uZWN0aW9ucyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgY2xhc3Nlcy5jb25uZWN0VG9FZGdlQ2xhc3Moe1xuICAgICAgZWRnZUNsYXNzOiBjbGFzc0Nvbm5lY3Rpb25zLFxuICAgICAgc2lkZTogJ3RhcmdldCcsXG4gICAgICBub2RlQXR0cmlidXRlOiBudWxsLFxuICAgICAgZWRnZUF0dHJpYnV0ZTogJ3RhcmdldCdcbiAgICB9KTtcbiAgICB0YWJsZXMuY29ubmVjdFRvRWRnZUNsYXNzKHtcbiAgICAgIGVkZ2VDbGFzczogdGFibGVMaW5rcyxcbiAgICAgIHNpZGU6ICdzb3VyY2UnLFxuICAgICAgbm9kZUF0dHJpYnV0ZTogbnVsbCxcbiAgICAgIGVkZ2VBdHRyaWJ1dGU6ICdzb3VyY2UnXG4gICAgfSk7XG4gICAgdGFibGVzLmNvbm5lY3RUb0VkZ2VDbGFzcyh7XG4gICAgICBlZGdlQ2xhc3M6IHRhYmxlTGlua3MsXG4gICAgICBzaWRlOiAndGFyZ2V0JyxcbiAgICAgIG5vZGVBdHRyaWJ1dGU6IG51bGwsXG4gICAgICBlZGdlQXR0cmlidXRlOiAndGFyZ2V0J1xuICAgIH0pO1xuICAgIGNsYXNzZXMuY29ubmVjdFRvTm9kZUNsYXNzKHtcbiAgICAgIG90aGVyTm9kZUNsYXNzOiB0YWJsZXMsXG4gICAgICBhdHRyaWJ1dGU6ICd0YWJsZUlkJyxcbiAgICAgIG90aGVyQXR0cmlidXRlOiAndGFibGVJZCdcbiAgICB9KS5zZXRDbGFzc05hbWUoJ0NvcmUgVGFibGVzJyk7XG4gICAgcmV0dXJuIG5ld01vZGVsO1xuICB9XG59XG5leHBvcnQgZGVmYXVsdCBOZXR3b3JrTW9kZWw7XG4iLCJpbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuL0NvbW1vbi9UcmlnZ2VyYWJsZU1peGluLmpzJztcbmltcG9ydCBOZXR3b3JrTW9kZWwgZnJvbSAnLi9Db21tb24vTmV0d29ya01vZGVsLmpzJztcblxubGV0IE5FWFRfTU9ERUxfSUQgPSAxO1xuXG5jbGFzcyBPcmlncmFwaCBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuXG4gICAgdGhpcy5wbHVnaW5zID0ge307XG5cbiAgICB0aGlzLm1vZGVscyA9IHt9O1xuICAgIGxldCBleGlzdGluZ01vZGVscyA9IHRoaXMubG9jYWxTdG9yYWdlICYmIHRoaXMubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ29yaWdyYXBoX21vZGVscycpO1xuICAgIGlmIChleGlzdGluZ01vZGVscykge1xuICAgICAgZm9yIChjb25zdCBbbW9kZWxJZCwgbW9kZWxdIG9mIE9iamVjdC5lbnRyaWVzKEpTT04ucGFyc2UoZXhpc3RpbmdNb2RlbHMpKSkge1xuICAgICAgICBtb2RlbC5vcmlncmFwaCA9IHRoaXM7XG4gICAgICAgIHRoaXMubW9kZWxzW21vZGVsSWRdID0gbmV3IE5ldHdvcmtNb2RlbChtb2RlbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICB9XG4gIHJlZ2lzdGVyUGx1Z2luIChuYW1lLCBwbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbnNbbmFtZV0gPSBwbHVnaW47XG4gIH1cbiAgc2F2ZSAoKSB7XG4gICAgaWYgKHRoaXMubG9jYWxTdG9yYWdlKSB7XG4gICAgICBjb25zdCBtb2RlbHMgPSB7fTtcbiAgICAgIGZvciAoY29uc3QgW21vZGVsSWQsIG1vZGVsXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm1vZGVscykpIHtcbiAgICAgICAgbW9kZWxzW21vZGVsSWRdID0gbW9kZWwuX3RvUmF3T2JqZWN0KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvY2FsU3RvcmFnZS5zZXRJdGVtKCdvcmlncmFwaF9tb2RlbHMnLCBKU09OLnN0cmluZ2lmeShtb2RlbHMpKTtcbiAgICAgIHRoaXMudHJpZ2dlcignc2F2ZScpO1xuICAgIH1cbiAgfVxuICBjbG9zZUN1cnJlbnRNb2RlbCAoKSB7XG4gICAgdGhpcy5fY3VycmVudE1vZGVsSWQgPSBudWxsO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gIH1cbiAgZ2V0IGN1cnJlbnRNb2RlbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW3RoaXMuX2N1cnJlbnRNb2RlbElkXSB8fCB0aGlzLmNyZWF0ZU1vZGVsKCk7XG4gIH1cbiAgc2V0IGN1cnJlbnRNb2RlbCAobW9kZWwpIHtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG1vZGVsLm1vZGVsSWQ7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxuICBjcmVhdGVNb2RlbCAob3B0aW9ucyA9IHt9KSB7XG4gICAgd2hpbGUgKCFvcHRpb25zLm1vZGVsSWQgfHwgdGhpcy5tb2RlbHNbb3B0aW9ucy5tb2RlbElkXSkge1xuICAgICAgb3B0aW9ucy5tb2RlbElkID0gYG1vZGVsJHtORVhUX01PREVMX0lEfWA7XG4gICAgICBORVhUX01PREVMX0lEICs9IDE7XG4gICAgfVxuICAgIG9wdGlvbnMub3JpZ3JhcGggPSB0aGlzO1xuICAgIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF0gPSBuZXcgTmV0d29ya01vZGVsKG9wdGlvbnMpO1xuICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gb3B0aW9ucy5tb2RlbElkO1xuICAgIHRoaXMuc2F2ZSgpO1xuICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzW29wdGlvbnMubW9kZWxJZF07XG4gIH1cbiAgZGVsZXRlTW9kZWwgKG1vZGVsSWQgPSB0aGlzLmN1cnJlbnRNb2RlbElkKSB7XG4gICAgaWYgKCF0aGlzLm1vZGVsc1ttb2RlbElkXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgbm9uLWV4aXN0ZW50IG1vZGVsOiAke21vZGVsSWR9YCk7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLm1vZGVsc1ttb2RlbElkXTtcbiAgICBpZiAodGhpcy5fY3VycmVudE1vZGVsSWQgPT09IG1vZGVsSWQpIHtcbiAgICAgIHRoaXMuX2N1cnJlbnRNb2RlbElkID0gbnVsbDtcbiAgICAgIHRoaXMudHJpZ2dlcignY2hhbmdlQ3VycmVudE1vZGVsJyk7XG4gICAgfVxuICAgIHRoaXMuc2F2ZSgpO1xuICB9XG4gIGRlbGV0ZUFsbE1vZGVscyAoKSB7XG4gICAgdGhpcy5tb2RlbHMgPSB7fTtcbiAgICB0aGlzLl9jdXJyZW50TW9kZWxJZCA9IG51bGw7XG4gICAgdGhpcy5zYXZlKCk7XG4gICAgdGhpcy50cmlnZ2VyKCdjaGFuZ2VDdXJyZW50TW9kZWwnKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBPcmlncmFwaDtcbiIsImltcG9ydCBPcmlncmFwaCBmcm9tICcuL09yaWdyYXBoLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG9yaWdyYXBoID0gbmV3IE9yaWdyYXBoKHdpbmRvdy5GaWxlUmVhZGVyLCB3aW5kb3cubG9jYWxTdG9yYWdlKTtcbm9yaWdyYXBoLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgb3JpZ3JhcGg7XG4iXSwibmFtZXMiOlsiVHJpZ2dlcmFibGVNaXhpbiIsInN1cGVyY2xhc3MiLCJjb25zdHJ1Y3RvciIsImFyZ3VtZW50cyIsIl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiIsIl9ldmVudEhhbmRsZXJzIiwiX3N0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiR2VuZXJpY1dyYXBwZXIiLCJvcHRpb25zIiwidGFibGUiLCJ1bmRlZmluZWQiLCJFcnJvciIsImNsYXNzT2JqIiwicm93IiwiY29ubmVjdGVkSXRlbXMiLCJjb25uZWN0SXRlbSIsIml0ZW0iLCJ0YWJsZUlkIiwiZGlzY29ubmVjdCIsIml0ZW1MaXN0IiwidmFsdWVzIiwiaW5zdGFuY2VJZCIsImNsYXNzSWQiLCJlcXVhbHMiLCJpdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJ0YWJsZUlkcyIsImxpbWl0IiwiSW5maW5pdHkiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwiX29yaWdyYXBoIiwidGFibGVzIiwiYnVpbGRDYWNoZSIsIl9pdGVyYXRlQWNyb3NzQ29ubmVjdGlvbnMiLCJsZW5ndGgiLCJ0aGlzVGFibGVJZCIsInJlbWFpbmluZ1RhYmxlSWRzIiwic2xpY2UiLCJleGVjIiwibmFtZSIsIlRhYmxlIiwibW9kZWwiLCJfZXhwZWN0ZWRBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsIl9vYnNlcnZlZEF0dHJpYnV0ZXMiLCJfZGVyaXZlZFRhYmxlcyIsImRlcml2ZWRUYWJsZXMiLCJfZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImF0dHIiLCJzdHJpbmdpZmllZEZ1bmMiLCJlbnRyaWVzIiwiZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucyIsImh5ZHJhdGVGdW5jdGlvbiIsIl9zdXBwcmVzc2VkQXR0cmlidXRlcyIsInN1cHByZXNzZWRBdHRyaWJ1dGVzIiwiX3N1cHByZXNzSW5kZXgiLCJzdXBwcmVzc0luZGV4IiwiX2luZGV4RmlsdGVyIiwiaW5kZXhGaWx0ZXIiLCJfYXR0cmlidXRlRmlsdGVycyIsImF0dHJpYnV0ZUZpbHRlcnMiLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsInVzZWRCeUNsYXNzZXMiLCJfdXNlZEJ5Q2xhc3NlcyIsImRlaHlkcmF0ZUZ1bmN0aW9uIiwiZnVuYyIsIkZ1bmN0aW9uIiwidG9TdHJpbmciLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJpdGVyYXRvciIsIl9pdGVyYXRlIiwiY29tcGxldGVkIiwibmV4dCIsImRvbmUiLCJfZmluaXNoSXRlbSIsIndyYXBwZWRJdGVtIiwia2VlcCIsIl93cmFwIiwib3RoZXJJdGVtIiwiaXRlbXNUb0Nvbm5lY3QiLCJkZXJpdmVkVGFibGUiLCJfY2FjaGVQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvdW50Um93cyIsImtleXMiLCJnZXRJbmRleERldGFpbHMiLCJkZXRhaWxzIiwic3VwcHJlc3NlZCIsImZpbHRlcmVkIiwiZ2V0QXR0cmlidXRlRGV0YWlscyIsImFsbEF0dHJzIiwiZXhwZWN0ZWQiLCJvYnNlcnZlZCIsImRlcml2ZWQiLCJjdXJyZW50RGF0YSIsImRhdGEiLCJjb21wbGV0ZSIsImRlcml2ZUF0dHJpYnV0ZSIsImF0dHJpYnV0ZSIsInN1cHByZXNzQXR0cmlidXRlIiwiYWRkRmlsdGVyIiwiX2Rlcml2ZVRhYmxlIiwicHJlU2F2ZSIsIm5ld1RhYmxlIiwiY3JlYXRlVGFibGUiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGUiLCJmaW5kIiwidGFibGVPYmoiLCJldmVyeSIsIm9wdGlvbk5hbWUiLCJvcHRpb25WYWx1ZSIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY2xvc2VkVHJhbnNwb3NlIiwiaW5kZXhlcyIsIm9wZW5UcmFuc3Bvc2UiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImluVXNlIiwic29tZSIsInNvdXJjZVRhYmxlSWRzIiwidGFyZ2V0VGFibGVJZHMiLCJkZWxldGUiLCJlcnIiLCJwYXJlbnRUYWJsZSIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIlN0YXRpY0RpY3RUYWJsZSIsIlNpbmdsZVBhcmVudE1peGluIiwiX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiIsIkFnZ3JlZ2F0ZWRUYWJsZSIsIl9hdHRyaWJ1dGUiLCJfcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwicmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zIiwiX2RlaHlkcmF0ZUZ1bmN0aW9uIiwiZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSIsIl91cGRhdGVJdGVtIiwib3JpZ2luYWxXcmFwcGVkSXRlbSIsIm5ld1dyYXBwZWRJdGVtIiwid3JhcHBlZFBhcmVudCIsIlN0cmluZyIsImV4aXN0aW5nSXRlbSIsIm5ld0l0ZW0iLCJyZWR1Y2VkIiwiRXhwYW5kZWRUYWJsZSIsInNwbGl0IiwiRmFjZXRlZFRhYmxlIiwiX3ZhbHVlIiwiVHJhbnNwb3NlZFRhYmxlIiwiX2luZGV4IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwiYmFzZVBhcmVudFRhYmxlIiwib3RoZXJQYXJlbnRUYWJsZXMiLCJHZW5lcmljQ2xhc3MiLCJfY2xhc3NOYW1lIiwiY2xhc3NOYW1lIiwiYW5ub3RhdGlvbnMiLCJzZXRDbGFzc05hbWUiLCJoYXNDdXN0b21OYW1lIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm92ZXJ3cml0ZSIsImNyZWF0ZUNsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVOZXdDbGFzcyIsIk5vZGVXcmFwcGVyIiwiZWRnZXMiLCJlZGdlSWRzIiwiZWRnZUNsYXNzSWRzIiwiZWRnZUlkIiwiZWRnZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInJldmVyc2UiLCJjb25jYXQiLCJwYWlyd2lzZU5laWdoYm9yaG9vZCIsImVkZ2UiLCJwYWlyd2lzZUVkZ2VzIiwiTm9kZUNsYXNzIiwiZGlzY29ubmVjdEFsbEVkZ2VzIiwiaXNTb3VyY2UiLCJ0YXJnZXRDbGFzc0lkIiwidGFibGVJZExpc3QiLCJkaXJlY3RlZCIsInNvdXJjZUVkZ2VDbGFzcyIsInRhcmdldEVkZ2VDbGFzcyIsImNvbm5lY3RUb05vZGVDbGFzcyIsIm90aGVyTm9kZUNsYXNzIiwib3RoZXJBdHRyaWJ1dGUiLCJ0aGlzSGFzaCIsIm90aGVySGFzaCIsImNvbm5lY3RlZFRhYmxlIiwibmV3RWRnZUNsYXNzIiwiY29ubmVjdFRvRWRnZUNsYXNzIiwibm9kZUNsYXNzIiwibmV3Tm9kZUNsYXNzIiwiY29ubmVjdGVkQ2xhc3NlcyIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiZWRnZUNsYXNzSWQiLCJFZGdlV3JhcHBlciIsInNvdXJjZU5vZGVzIiwic291cmNlVGFibGVJZCIsInRhcmdldE5vZGVzIiwidGFyZ2V0VGFibGVJZCIsInNvdXJjZSIsInRhcmdldCIsImh5cGVyZWRnZSIsInNvdXJjZXMiLCJ0YXJnZXRzIiwiRWRnZUNsYXNzIiwiX3NwbGl0VGFibGVJZExpc3QiLCJvdGhlckNsYXNzIiwibm9kZVRhYmxlSWRMaXN0IiwiZWRnZVRhYmxlSWQiLCJlZGdlVGFibGVJZExpc3QiLCJzdGF0aWNFeGlzdHMiLCJ0YWJsZURpc3RhbmNlcyIsInN0YXJ0c1dpdGgiLCJkaXN0IiwiTWF0aCIsImFicyIsImZpbHRlciIsInNvcnQiLCJhIiwiYiIsInNvdXJjZUNsYXNzIiwidGFyZ2V0Q2xhc3MiLCJzaWRlIiwiY29ubmVjdFNvdXJjZSIsImNvbm5lY3RUYXJnZXQiLCJ0b2dnbGVEaXJlY3Rpb24iLCJzd2FwcGVkRGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJlZGdlSGFzaCIsIm5vZGVIYXNoIiwidW5zaGlmdCIsImV4aXN0aW5nU291cmNlQ2xhc3MiLCJleGlzdGluZ1RhcmdldENsYXNzIiwiREFUQUxJQl9GT1JNQVRTIiwiTkVYVF9DTEFTU19JRCIsIk5FWFRfVEFCTEVfSUQiLCJOZXR3b3JrTW9kZWwiLCJvcmlncmFwaCIsIm1vZGVsSWQiLCJoeWRyYXRlIiwiQ0xBU1NFUyIsIlRBQkxFUyIsIl9zYXZlVGltZW91dCIsInNhdmUiLCJ1bnNhdmVkIiwicmF3T2JqZWN0IiwiVFlQRVMiLCJzZWxlY3RvciIsImFkZEZpbGVBc1N0YXRpY1RhYmxlIiwiZmlsZU9iaiIsImVuY29kaW5nIiwibWltZSIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwicmVhZGVyIiwiRmlsZVJlYWRlciIsIm9ubG9hZCIsInJlYWRBc1RleHQiLCJhZGRTdHJpbmdBc1N0YXRpY1RhYmxlIiwiZXh0ZW5zaW9uIiwiZGF0YWxpYiIsInJlYWQiLCJjb2x1bW5zIiwiYWRkU3RhdGljVGFibGUiLCJBcnJheSIsImRlbGV0ZUFsbFVudXNlZFRhYmxlcyIsImdldFNhbXBsZUdyYXBoIiwicm9vdENsYXNzIiwiYnJhbmNoTGltaXQiLCJub2RlTGltaXQiLCJlZGdlTGltaXQiLCJ0cmlwbGVMaW1pdCIsInNhbXBsZUdyYXBoIiwibm9kZXMiLCJub2RlTG9va3VwIiwiZWRnZUxvb2t1cCIsIm51bVRyaXBsZXMiLCJudW1FZGdlSW5zdGFuY2VzIiwiYWRkTm9kZSIsIm5vZGUiLCJhZGRFZGdlIiwiaW5zdGFuY2UiLCJwYWlyd2lzZUluc3RhbmNlcyIsImFkZFRyaXBsZSIsInRyaXBwZWRPdGhlckxpbWl0IiwiZWRnZUluc3RhbmNlIiwiY2xhc3NMaXN0IiwiZ2V0TmV0d29ya01vZGVsR3JhcGgiLCJpbmNsdWRlRHVtbWllcyIsImVkZ2VDbGFzc2VzIiwiZ3JhcGgiLCJjbGFzc0xvb2t1cCIsImNsYXNzQ29ubmVjdGlvbnMiLCJjbGFzc1NwZWMiLCJpZCIsImNsYXNzSUQiLCJsb2NhdGlvbiIsImR1bW15IiwiZ2V0VGFibGVEZXBlbmRlbmN5R3JhcGgiLCJ0YWJsZUxvb2t1cCIsInRhYmxlTGlua3MiLCJ0YWJsZUxpc3QiLCJ0YWJsZVNwZWMiLCJnZXRGdWxsU2NoZW1hR3JhcGgiLCJjcmVhdGVTY2hlbWFNb2RlbCIsIm5ld01vZGVsIiwiY3JlYXRlTW9kZWwiLCJORVhUX01PREVMX0lEIiwiT3JpZ3JhcGgiLCJsb2NhbFN0b3JhZ2UiLCJwbHVnaW5zIiwibW9kZWxzIiwiZXhpc3RpbmdNb2RlbHMiLCJnZXRJdGVtIiwiSlNPTiIsInBhcnNlIiwiX2N1cnJlbnRNb2RlbElkIiwicmVnaXN0ZXJQbHVnaW4iLCJwbHVnaW4iLCJzZXRJdGVtIiwic3RyaW5naWZ5IiwiY2xvc2VDdXJyZW50TW9kZWwiLCJjdXJyZW50TW9kZWwiLCJkZWxldGVNb2RlbCIsImN1cnJlbnRNb2RlbElkIiwiZGVsZXRlQWxsTW9kZWxzIiwid2luZG93IiwidmVyc2lvbiIs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
