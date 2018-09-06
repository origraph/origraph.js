'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mime = _interopDefault(require('mime-types'));
var datalib = _interopDefault(require('datalib'));
var sha1 = _interopDefault(require('sha1'));
var FileReader = _interopDefault(require('filereader'));

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
          setTimeout(() => {
            // Add timeout to prevent blocking
            callback.apply(this, args);
          }, 0);
        });
      }
    }

    stickyTrigger(eventName, argObj, delay = 10) {
      this.stickyTriggers[eventName] = this.stickyTriggers[eventName] || {
        argObj: {}
      };
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

class Table extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this._mure = options.mure;
    this.tableId = options.tableId;

    if (!this._mure || !this.tableId) {
      throw new Error(`mure and tableId are required`);
    }

    this._expectedAttributes = options.attributes || {};
    this._observedAttributes = {};
    this._derivedTables = options.derivedTables || {};
    this._derivedAttributeFunctions = {};

    if (options.derivedAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions)) {
        this._derivedAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
      }
    }
  }

  _toRawObject() {
    const result = {
      tableId: this.tableId,
      attributes: this._attributes,
      derivedTables: this._derivedTables,
      usedByClasses: this._usedByClasses,
      derivedAttributeFunctions: {}
    };

    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      result.derivedAttributeFunctions[attr] = this._mure.dehydrateFunction(func);
    }

    return result;
  }

  get name() {
    throw new Error(`this function should be overridden`);
  }

  async *iterate(options = {}) {
    // Generic caching stuff; this isn't just for performance. ConnectedTable's
    // algorithm requires that its parent tables have pre-built indexes (we
    // technically could implement it differently, but it would be expensive,
    // requires tricky logic, and we're already building indexes for some tables
    // like AggregatedTable anyway)
    if (options.reset) {
      this.reset();
    }

    if (this._cache) {
      for (const finishedItem of Object.values(this._cache)) {
        yield finishedItem;
      }

      return;
    }

    yield* await this._buildCache(options);
  }

  reset() {
    delete this._partialCache;
    delete this._cache;

    for (const derivedTable of this.derivedTables) {
      derivedTable.reset();
    }

    this.trigger('reset');
  }

  async *_buildCache(options) {
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};
    const limit = options.limit === undefined ? Infinity : options.limit;
    delete options.limit;

    const iterator = this._iterate(options);

    let completed = false;

    for (let i = 0; i < limit; i++) {
      const temp = await iterator.next();

      if (!this._partialCache) {
        // iteration was cancelled; return immediately
        return;
      }

      if (temp.done) {
        completed = true;
        break;
      } else {
        this._finishItem(temp.value);

        this._partialCache[temp.value.index] = temp.value;
        yield temp.value;
      }
    }

    if (completed) {
      this._cache = this._partialCache;
    }

    delete this._partialCache;
  }

  async *_iterate(options) {
    throw new Error(`this function should be overridden`);
  }

  _finishItem(wrappedItem) {
    for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
      wrappedItem.row[attr] = func(wrappedItem);
    }

    for (const attr of Object.keys(wrappedItem.row)) {
      this._observedAttributes[attr] = true;
    }

    wrappedItem.trigger('finish');
  }

  _wrap(options) {
    options.table = this;
    const classObj = this.classObj;
    return classObj ? classObj._wrap(options) : new this._mure.WRAPPERS.GenericWrapper(options);
  }

  _getAllAttributes() {
    const allAttrs = {};

    for (const attr in this._expectedAttributes) {
      allAttrs[attr] = true;
    }

    for (const attr in this._observedAttributes) {
      allAttrs[attr] = true;
    }

    for (const attr in this._derivedAttributeFunctions) {
      allAttrs[attr] = true;
    }

    return allAttrs;
  }

  get attributes() {
    return Object.keys(this._getAllAttributes());
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

  _deriveTable(options) {
    const newTable = this._mure.createTable(options);

    this._derivedTables[newTable.tableId] = true;

    this._mure.saveTables();

    return newTable;
  }

  _getExistingTable(options) {
    // Check if the derived table has already been defined
    const existingTableId = this.derivedTables.find(tableObj => {
      return Object.entries(options).every(([optionName, optionValue]) => {
        if (optionName === 'type') {
          return tableObj.constructor.name === optionValue;
        } else {
          return tableObj['_' + optionName] === optionValue;
        }
      });
    });
    return existingTableId && this._mure.tables[existingTableId] || null;
  }

  shortestPathToTable(otherTable) {
    // Dijkstra's algorithm...
    const visited = {};
    const distances = {};
    const prevTables = {};

    const visit = targetId => {
      const targetTable = this._mure.tables[targetId]; // Only check the unvisited derived and parent tables

      const neighborList = Object.keys(targetTable._derivedTables).concat(targetTable.parentTables.map(parentTable => parentTable.tableId)).filter(tableId => !visited[tableId]); // Check and assign (or update) tentative distances to each neighbor

      for (const neighborId of neighborList) {
        if (distances[neighborId] === undefined) {
          distances[neighborId] = Infinity;
        }

        if (distances[targetId] + 1 < distances[neighborId]) {
          distances[neighborId] = distances[targetId] + 1;
          prevTables[neighborId] = targetId;
        }
      } // Okay, this table is officially visited; take it out of the running
      // for future visits / checks


      visited[targetId] = true;
      delete distances[targetId];
    }; // Start with this table


    prevTables[this.tableId] = null;
    distances[this.tableId] = 0;
    let toVisit = Object.keys(distances);

    while (toVisit.length > 0) {
      // Visit the next table that has the shortest distance
      toVisit.sort((a, b) => distances[a] - distances[b]);
      let nextId = toVisit.shift();

      if (nextId === otherTable.tableId) {
        // Found otherTable! Send back the chain of connected tables
        const chain = [];

        while (prevTables[nextId] !== null) {
          chain.unshift(this._mure.tables[nextId]);
          nextId = prevTables[nextId];
        }

        return chain;
      } else {
        // Visit the table
        visit(nextId);
        toVisit = Object.keys(distances);
      }
    } // We didn't find it; there's no connection


    return null;
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
        type: 'FilteredTable',
        attribute,
        value
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    });
  }

  async *openFacet(attribute, limit = Infinity) {
    const values = {};

    for await (const wrappedItem of this.iterate({
      limit
    })) {
      const value = wrappedItem.row[attribute];

      if (!values[value]) {
        values[value] = true;
        const options = {
          type: 'FilteredTable',
          attribute,
          value
        };
        yield this._getExistingTable(options) || this._deriveTable(options);
      }
    }
  }

  connect(otherTableList) {
    const newTable = this._mure.createTable({
      type: 'ConnectedTable'
    });

    this._derivedTables[newTable.tableId] = true;

    for (const otherTable of otherTableList) {
      otherTable._derivedTables[newTable.tableId] = true;
    }

    this._mure.saveTables();

    return newTable;
  }

  get classObj() {
    return Object.values(this._mure.classes).find(classObj => {
      return classObj.table === this;
    });
  }

  get parentTables() {
    return Object.values(this._mure.tables).reduce((agg, tableObj) => {
      if (tableObj._derivedTables[this.tableId]) {
        agg.push(tableObj);
      }

      return agg;
    }, []);
  }

  get derivedTables() {
    return Object.keys(this._derivedTables).map(tableId => {
      return this._mure.tables[tableId];
    });
  }

  delete() {
    if (Object.keys(this._derivedTables).length > 0 || this.classObj) {
      throw new Error(`Can't delete in-use table ${this.tableId}`);
    }

    for (const parentTable of this.parentTables) {
      delete parentTable.derivedTables[this.tableId];
    }

    delete this._mure.tables[this.tableId];

    this._mure.saveTables();
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

  async *_iterate(options) {
    for (let index = 0; index < this._data.length; index++) {
      const item = this._wrap({
        index,
        row: this._data[index]
      });

      this._finishItem(item);

      yield item;
    }
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

  async *_iterate(options) {
    for (const [index, row] of Object.entries(this._data)) {
      const item = this._wrap({
        index,
        row
      });

      this._finishItem(item);

      yield item;
    }
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

    if (options.reduceAttributeFunctions) {
      for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions)) {
        this._reduceAttributeFunctions[attr] = this._mure.hydrateFunction(stringifiedFunc);
      }
    }
  }

  _toRawObject() {
    const obj = super._toRawObject();

    obj.attribute = this._attribute;
    obj.reduceAttributeFunctions = {};

    for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
      obj.reduceAttributeFunctions[attr] = this._mure._dehydrateFunction(func);
    }

    return obj;
  }

  get name() {
    return this.parentTable.name + '↦';
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

  async *_buildCache(options) {
    // We override _buildCache because so that AggregatedTable can take advantage
    // of the partially-built cache as it goes, and postpone finishing items
    // until after the parent table has been fully iterated
    // TODO: in large data scenarios, we should build the cache / index
    // externally on disk
    this._partialCache = {};

    for await (const wrappedItem of this._iterate(options)) {
      this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
      // client apps to be more responsive and render partial results, but also
      // means that they need to watch for wrappedItem.on('update') events

      yield wrappedItem;
    } // Second pass: now that we've completed the full iteration of the parent
    // table, we can finish each item


    for (const index in this._partialCache) {
      const wrappedItem = this._partialCache[index];

      this._finishItem(wrappedItem);
    }

    this._cache = this._partialCache;
    delete this._partialCache;
  }

  async *_iterate(options) {
    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const index = wrappedParent.row[this._attribute];

      if (!this._partialCache) {
        // We were reset; return immediately
        return;
      } else if (this._partialCache[index]) {
        this._updateItem(this._partialCache[index], wrappedParent);
      } else {
        const newItem = this._wrap({
          index,
          connectedRows: {
            wrappedParent
          }
        }); // Reduce operations still need to be applied to the first item


        this._updateItem(newItem, newItem);

        yield newItem;
      }
    }
  }

  _getAllAttributes() {
    const result = super._getAllAttributes();

    for (const attr in this._reduceAttributeFunctions) {
      result[attr] = true;
    }

    return result;
  }

}

const DuplicatableAttributesMixin = function (superclass) {
  return class extends superclass {
    constructor(options) {
      super(options);
      this._instanceOfDuplicatableAttributesMixin = true;
      this._duplicatedAttributes = options.duplicatedAttributes || {};
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.duplicatedAttributes = this._duplicatedAttributes;
      return obj;
    }

    duplicateAttribute(parentId, attribute) {
      this._duplicatedAttributes[parentId] = this._duplicatedAttributes[parentId] || [];

      this._duplicatedAttributes[parentId].push(attribute);

      this.reset();
    }

    _duplicateAttributes(wrappedItem, connectedRows) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = connectedRows[parentId].row[attr];
      }
    }

    _getAllAttributes() {
      const result = super._getAllAttributes();

      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        result[`${parentName}.${attr}`] = true;
      }

      return result;
    }

  };
};

Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});

class ExpandedTable extends DuplicatableAttributesMixin(SingleParentMixin(Table)) {
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

  async *_iterate(options) {
    let index = 0;
    const parentTableId = this.parentTable.tableId;

    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const values = (wrappedParent.row[this._attribute] || '').split(this.delimiter);

      for (const value of values) {
        const row = {};
        row[this._attribute] = value;
        const connectedRows = {};
        connectedRows[parentTableId] = wrappedParent;

        const wrappedItem = this._wrap({
          index,
          row,
          connectedRows
        });

        this._duplicateAttributes(wrappedItem, connectedRows);

        this._finishItem(wrappedItem);

        yield wrappedItem;
        index++;
      }
    }
  }

}

class FilteredTable extends SingleParentMixin(Table) {
  constructor(options) {
    super(options);
    this._attribute = options.attribute;
    this._value = options.value;

    if (!this._attribute === undefined || !this._value === undefined) {
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
    return `${this.parentTable.name}[${this._value}]`;
  }

  async *_iterate(options) {
    let index = 0;

    for await (const wrappedParent of this.parentTable.iterate(options)) {
      const includeItem = () => {
        const wrappedItem = this._wrap({
          index,
          row: wrappedParent.row,
          connectedRows: {
            wrappedParent
          }
        });

        this._finishItem(wrappedItem);

        index++;
        return wrappedItem;
      };

      if (this._attribute === null) {
        if (wrappedParent.index === this._value) {
          yield includeItem();
        }
      } else {
        if (wrappedParent.row[this._attribute] === this._value) {
          yield includeItem();
        }
      }
    }
  }

}

class ConnectedTable extends DuplicatableAttributesMixin(Table) {
  get name() {
    return this.parentTables.map(parentTable => parentTable.name).join('⨯');
  }

  async *_iterate(options) {
    const parentTables = this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        const iterator = parentTable.iterate();
        let temp;

        while (!temp || !temp.done) {
          temp = await iterator.next();
        }
      }
    } // Now that the caches are built, just iterate their keys directly


    for (const parentTable of parentTables) {
      if (!parentTable._cache) {
        // One of the parent tables was reset; return immediately
        return;
      }

      for (const index in parentTable._cache) {
        if (!this._partialCache[index]) {
          const connectedRows = {};

          for (const parentTable2 of parentTables) {
            connectedRows[parentTable2.tableId] = parentTable2._cache[index];
          }

          const wrappedItem = this._wrap({
            index,
            connectedRows
          });

          this._duplicateAttributes(wrappedItem, connectedRows);

          this._finishItem(wrappedItem);

          yield wrappedItem;
        }
      }
    }
  }

}



var TABLES = /*#__PURE__*/Object.freeze({
  StaticTable: StaticTable,
  StaticDictTable: StaticDictTable,
  AggregatedTable: AggregatedTable,
  ExpandedTable: ExpandedTable,
  FilteredTable: FilteredTable,
  ConnectedTable: ConnectedTable
});

class GenericClass extends Introspectable {
  constructor(options) {
    super();
    this._mure = options.mure;
    this.classId = options.classId;
    this.tableId = options.tableId;

    if (!this._mure || !this.classId || !this.tableId) {
      throw new Error(`_mure, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotation = options.annotation || '';
  }

  _toRawObject() {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotation: this.annotation
    };
  }

  setClassName(value) {
    this._className = value;

    this._mure.saveClasses();
  }

  get hasCustomName() {
    return this._className !== null;
  }

  get className() {
    return this._className || this.table.name;
  }

  getHashTable(attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }

  get table() {
    return this._mure.tables[this.tableId];
  }

  _wrap(options) {
    return new this._mure.WRAPPERS.GenericWrapper(options);
  }

  interpretAsNodes() {
    const options = this._toRawObject();

    options.type = 'NodeClass';
    return this._mure.newClass(options);
  }

  interpretAsEdges() {
    const options = this._toRawObject();

    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  _deriveGenericClass(newTable) {
    return this._mure.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
    });
  }

  aggregate(attribute) {
    return this._deriveGenericClass(this.table.aggregate(attribute));
  }

  expand(attribute, delimiter) {
    return this._deriveGenericClass(this.table.expand(attribute, delimiter));
  }

  closedFacet(attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveGenericClass(newTable);
    });
  }

  async *openFacet(attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this._deriveGenericClass(newTable);
    }
  }

  delete() {
    delete this._mure.classes[this.classId];

    this._mure.saveClasses();
  }

}

Object.defineProperty(GenericClass, 'type', {
  get() {
    return /(.*)Class/.exec(this.name)[1];
  }

});

class NodeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.edgeClassIds = options.edgeClassIds || {};
    this.Wrapper = this._mure.WRAPPERS.NodeWrapper;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.edgeClassIds = this.edgeClassIds;
    return result;
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
      // (or a floating edge if edgeClass.sourceClassId is null)
      const edgeClass = this._mure.classes[edgeClassIds[0]];
      options.sourceClassId = edgeClass.sourceClassId;
      options.targetClassId = edgeClass.sourceClassId;
      options.directed = edgeClass.directed;
      edgeClass.delete();
    } else if (edgeClassIds.length === 2) {
      let sourceEdgeClass = this._mure.classes[edgeClassIds[0]];
      let targetEdgeClass = this._mure.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

      options.directed = false;

      if (sourceEdgeClass.directed && targetEdgeClass.directed) {
        if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
          // We happened to get the edges in order; set directed to true
          options.directed = true;
        } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
          // We got the edges backwards; swap them and set directed to true
          targetEdgeClass = this._mure.classes[edgeClassIds[0]];
          sourceEdgeClass = this._mure.classes[edgeClassIds[1]];
          options.directed = true;
        }
      } // Okay, now we know how to set source / target ids


      options.sourceClassId = sourceEdgeClass.classId;
      options.targetClassId = targetEdgeClass.classId; // Delete each of the edge classes

      sourceEdgeClass.delete();
      targetEdgeClass.delete();
    }

    this.delete();
    delete options.classId;
    delete options.edgeClassIds;
    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }

  connectToNodeClass({
    otherNodeClass,
    directed,
    attribute,
    otherAttribute
  }) {
    const thisHash = this.getHashTable(attribute);
    const otherHash = otherNodeClass.getHashTable(otherAttribute);
    const connectedTable = thisHash.connect([otherHash]);

    const newEdgeClass = this._mure.createClass({
      type: 'EdgeClass',
      tableId: connectedTable.tableId,
      directed,
      sourceClassId: this.classId,
      targetClassId: otherNodeClass.classId
    });

    this.edgeClassIds[newEdgeClass.classId] = true;
    otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;

    this._mure.saveClasses();

    return newEdgeClass;
  }

  connectToEdgeClass(options) {
    const edgeClass = options.edgeClass;
    delete options.edgeClass;
    options.nodeClass = this;
    return edgeClass.connectToNodeClass(options);
  }

  disconnectAllEdges() {
    for (const edgeClassId of Object.keys(this.edgeClassIds)) {
      const edgeClass = this._mure.classes[edgeClassId];

      if (edgeClass.sourceClassId === this.classId) {
        edgeClass.disconnectSource();
      }

      if (edgeClass.targetClassId === this.classId) {
        edgeClass.disconnectTarget();
      }
    }
  }

  delete() {
    this.disconnectAllEdges();
    super.delete();
  }

}

class EdgeClass extends GenericClass {
  constructor(options) {
    super(options);
    this.Wrapper = this._mure.WRAPPERS.EdgeWrapper;
    this.sourceClassId = options.sourceClassId || null;
    this.targetClassId = options.targetClassId || null;
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.targetClassId = this.targetClassId;
    result.directed = this.directed;
    return result;
  }

  _pickEdgeTable(otherClass) {
    let edgeTable;
    let chain = this.table.shortestPathToTable(otherClass.table);

    if (chain === null) {
      throw new Error(`Underlying table chain between edge and node classes is broken`);
    } else if (chain.length <= 2) {
      // Weird corner case where we're trying to create an edge between
      // adjacent or identical tables... create a ConnectedTable
      edgeTable = this.table.connect(otherClass.table);
    } else {
      // Use a table in the middle; prioritize StaticTable and StaticDictTable
      let staticExists = false;
      chain = chain.slice(1, chain.length - 1).map((table, dist) => {
        staticExists = staticExists || table.type.startsWith('Static');
        return {
          table,
          dist
        };
      });

      if (staticExists) {
        chain = chain.filter(({
          table
        }) => {
          return table.type.startsWith('Static');
        });
      }

      edgeTable = chain[0].table;
    }

    return edgeTable;
  }

  interpretAsNodes() {
    const temp = this._toRawObject();

    this.delete();
    temp.type = 'NodeClass';
    delete temp.classId;

    const newNodeClass = this._mure.createClass(temp);

    if (temp.sourceClassId) {
      const sourceClass = this._mure.classes[this.sourceClassId];

      const edgeTable = this._pickEdgeTable(sourceClass);

      const sourceEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: temp.sourceClassId,
        targetClassId: newNodeClass.classId
      });

      sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
    }

    if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
      const targetClass = this._mure.classes[this.targetClassId];

      const edgeTable = this._pickEdgeTable(targetClass);

      const targetEdgeClass = this._mure.createClass({
        type: 'EdgeClass',
        tableId: edgeTable.tableId,
        directed: temp.directed,
        sourceClassId: newNodeClass.classId,
        targetClassId: temp.targetClassId
      });

      targetClass.edgeClassIds[targetEdgeClass.classId] = true;
      newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
    }

    this._mure.saveClasses();

    return newNodeClass;
  }

  interpretAsEdges() {
    return this;
  }

  connectToNodeClass({
    nodeClass,
    direction,
    nodeAttribute,
    edgeAttribute
  }) {
    if (direction) {
      this.directed = true;
    }

    if (direction !== 'source' && direction !== 'target') {
      direction = this.targetClassId === null ? 'target' : 'source';
    }

    if (direction === 'target') {
      this.connectTarget({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    } else {
      this.connectSource({
        nodeClass,
        nodeAttribute,
        edgeAttribute
      });
    }

    this._mure.saveClasses();
  }

  toggleNodeDirection(sourceClassId) {
    if (!sourceClassId) {
      this.directed = false;
    } else {
      this.directed = true;

      if (sourceClassId !== this.sourceClassId) {
        if (sourceClassId !== this.targetClassId) {
          throw new Error(`Can't swap to unconnected class id: ${sourceClassId}`);
        }

        let temp = this.sourceClassId;
        this.sourceClassId = this.targetClassId;
        this.targetClassId = temp;
      }
    }

    this._mure.saveClasses();
  }

  connectSource({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.sourceClassId) {
      this.disconnectSource({
        skipSave: true
      });
    }

    this.sourceClassId = nodeClass.classId;
    const sourceClass = this._mure.classes[this.sourceClassId];
    sourceClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  connectTarget({
    nodeClass,
    nodeAttribute = null,
    edgeAttribute = null,
    skipSave = false
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget({
        skipSave: true
      });
    }

    this.targetClassId = nodeClass.classId;
    const targetClass = this._mure.classes[this.targetClassId];
    targetClass.edgeClassIds[this.classId] = true;
    const edgeHash = edgeAttribute === null ? this.table : this.getHashTable(edgeAttribute);
    const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.getHashTable(nodeAttribute);
    edgeHash.connect([nodeHash]);

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectSource({
    skipSave = false
  } = {}) {
    if (this._mure.classes[this.sourceClassId]) {
      delete this._mure.classes[this.sourceClassId].edgeClassIds[this.classId];
    }

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  disconnectTarget({
    skipSave = false
  } = {}) {
    if (this._mure.classes[this.targetClassId]) {
      delete this._mure.classes[this.targetClassId].edgeClassIds[this.classId];
    }

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  delete() {
    this.disconnectSource({
      skipSave: true
    });
    this.disconnectTarget({
      skipSave: true
    });
    super.delete();
  }

}



var CLASSES = /*#__PURE__*/Object.freeze({
  GenericClass: GenericClass,
  NodeClass: NodeClass,
  EdgeClass: EdgeClass
});

class GenericWrapper extends TriggerableMixin(Introspectable) {
  constructor(options) {
    super();
    this.index = options.index;

    if (this.index === undefined) {
      throw new Error(`index is required`);
    }

    this.row = options.row || {};
    this.connectedRows = options.connectedRows || {};
  }

}

Object.defineProperty(GenericWrapper, 'type', {
  get() {
    return /(.*)Wrapper/.exec(this.name)[1];
  }

});

class NodeWrapper extends GenericWrapper {}

class EdgeWrapper extends GenericWrapper {}



var WRAPPERS = /*#__PURE__*/Object.freeze({
  GenericWrapper: GenericWrapper,
  NodeWrapper: NodeWrapper,
  EdgeWrapper: EdgeWrapper
});

class InMemoryIndex {
  constructor({
    entries = {},
    complete = false
  } = {}) {
    this.entries = entries;
    this.complete = complete;
  }

  async toRawObject() {
    return this.entries;
  }

  async *iterEntries() {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield {
        hash,
        valueList
      };
    }
  }

  async *iterHashes() {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }

  async *iterValueLists() {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
  }

  async getValueList(hash) {
    return this.entries[hash] || [];
  }

  async addValue(hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);

    if (this.entries[hash].indexOf(value) === -1) {
      this.entries[hash].push(value);
    }
  }

}



var INDEXES = /*#__PURE__*/Object.freeze({
  InMemoryIndex: InMemoryIndex
});

let NEXT_CLASS_ID = 1;
let NEXT_TABLE_ID = 1;

class Mure extends TriggerableMixin(class {}) {
  constructor(FileReader$$1, localStorage) {
    super();
    this.FileReader = FileReader$$1; // either window.FileReader or one from Node

    this.localStorage = localStorage; // either window.localStorage or null

    this.mime = mime; // expose access to mime library, since we're bundling it anyway

    this.debug = false; // Set mure.debug to true to debug streams
    // extensions that we want datalib to handle

    this.DATALIB_FORMATS = {
      'json': 'json',
      'csv': 'csv',
      'tsv': 'tsv',
      'topojson': 'topojson',
      'treejson': 'treejson'
    }; // Access to core classes via the main library helps avoid circular imports

    this.TABLES = TABLES;
    this.CLASSES = CLASSES;
    this.WRAPPERS = WRAPPERS;
    this.INDEXES = INDEXES; // Default named functions

    this.NAMED_FUNCTIONS = {
      identity: function* (wrappedItem) {
        yield wrappedItem.rawItem;
      },
      key: function* (wrappedItem) {
        if (!wrappedItem.wrappedParent || !wrappedItem.wrappedParent.wrappedParent || typeof wrappedItem.wrappedParent.wrappedParent.rawItem !== 'object') {
          throw new TypeError(`Grandparent is not an object / array`);
        }

        const parentType = typeof wrappedItem.wrappedParent.rawItem;

        if (!(parentType === 'number' || parentType === 'string')) {
          throw new TypeError(`Parent isn't a key / index`);
        } else {
          yield wrappedItem.wrappedParent.rawItem;
        }
      },
      defaultFinish: function* (thisWrappedItem, otherWrappedItem) {
        yield {
          left: thisWrappedItem.rawItem,
          right: otherWrappedItem.rawItem
        };
      },
      sha1: rawItem => sha1(JSON.stringify(rawItem)),
      noop: () => {}
    }; // Object containing each of our data sources

    this.tables = this.hydrate('mure_tables', this.TABLES);
    NEXT_TABLE_ID = Object.keys(this.tables).reduce((highestNum, tableId) => {
      return Math.max(highestNum, parseInt(tableId.match(/table(\d*)/)[1]));
    }, 0) + 1; // Object containing our class specifications

    this.classes = this.hydrate('mure_classes', this.CLASSES);
    NEXT_CLASS_ID = Object.keys(this.classes).reduce((highestNum, classId) => {
      return Math.max(highestNum, parseInt(classId.match(/class(\d*)/)[1]));
    }, 0) + 1;
  }

  saveTables() {
    this.dehydrate('mure_tables', this.tables);
    this.trigger('tableUpdate');
  }

  saveClasses() {
    this.dehydrate('mure_classes', this.classes);
    this.trigger('classUpdate');
  }

  hydrate(storageKey, TYPES) {
    let container = this.localStorage && this.localStorage.getItem(storageKey);
    container = container ? JSON.parse(container) : {};

    for (const [key, value] of Object.entries(container)) {
      const type = value.type;
      delete value.type;
      value.mure = this;
      container[key] = new TYPES[type](value);
    }

    return container;
  }

  dehydrate(storageKey, container) {
    if (this.localStorage) {
      const result = {};

      for (const [key, value] of Object.entries(container)) {
        result[key] = value._toRawObject();
        result[key].type = value.constructor.name;
      }

      this.localStorage.setItem(storageKey, JSON.stringify(result));
    }
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

  createTable(options) {
    if (!options.tableId) {
      options.tableId = `table${NEXT_TABLE_ID}`;
      NEXT_TABLE_ID += 1;
    }

    const Type = this.TABLES[options.type];
    delete options.type;
    options.mure = this;
    this.tables[options.tableId] = new Type(options);
    return this.tables[options.tableId];
  }

  createClass(options = {
    selector: `empty`
  }) {
    if (!options.classId) {
      options.classId = `class${NEXT_CLASS_ID}`;
      NEXT_CLASS_ID += 1;
    }

    const Type = this.CLASSES[options.type];
    delete options.type;
    options.mure = this;
    this.classes[options.classId] = new Type(options);
    return this.classes[options.classId];
  }

  newTable(options) {
    const newTableObj = this.createTable(options);
    this.saveTables();
    return newTableObj;
  }

  newClass(options) {
    const newClassObj = this.createClass(options);
    this.saveClasses();
    return newClassObj;
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
        throw new Error(`${fileMB}MB file is too large to load statically; try addDynamicTable() instead.`);
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

    if (this.DATALIB_FORMATS[extension]) {
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
    let newTable = this.newTable(options);
    return this.newClass({
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
        } catch (err) {}
      }
    }
  }

  deleteAllClasses() {
    for (const classObj of Object.values(this.classes)) {
      classObj.delete();
    }
  }

  getClassData() {
    const results = {};

    for (const classObj of Object.values(this.classes)) {
      results[classObj.classId] = classObj.currentData;
    }
  }

}

var name = "mure";
var version = "0.5.5";
var description = "A library for flexible graph reshaping";
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
var files = [
	"dist"
];
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
	"@babel/core": "^7.0.0",
	"@babel/preset-env": "^7.0.0",
	"babel-core": "^7.0.0-0",
	"babel-jest": "^23.4.2",
	coveralls: "^3.0.2",
	filereader: "^0.10.3",
	jest: "^23.5.0",
	rollup: "^0.65.0",
	"rollup-plugin-babel": "^4.0.2",
	"rollup-plugin-commonjs": "^9.1.6",
	"rollup-plugin-json": "^3.0.0",
	"rollup-plugin-node-builtins": "^2.1.2",
	"rollup-plugin-node-globals": "^1.2.1",
	"rollup-plugin-node-resolve": "^3.3.0",
	"rollup-plugin-string": "^2.0.2"
};
var dependencies = {
	datalib: "^1.9.1",
	"mime-types": "^2.1.20",
	sha1: "^1.1.1"
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

let mure = new Mure(FileReader, null);
mure.version = pkg.version;

module.exports = mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5janMuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TaW5nbGVQYXJlbnRNaXhpbi5qcyIsIi4uL3NyYy9UYWJsZXMvQWdncmVnYXRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9EdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0V4cGFuZGVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0ZpbHRlcmVkVGFibGUuanMiLCIuLi9zcmMvVGFibGVzL0Nvbm5lY3RlZFRhYmxlLmpzIiwiLi4vc3JjL0NsYXNzZXMvR2VuZXJpY0NsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvTm9kZUNsYXNzLmpzIiwiLi4vc3JjL0NsYXNzZXMvRWRnZUNsYXNzLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0dlbmVyaWNXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL05vZGVXcmFwcGVyLmpzIiwiLi4vc3JjL1dyYXBwZXJzL0VkZ2VXcmFwcGVyLmpzIiwiLi4vc3JjL0luZGV4ZXMvSW5NZW1vcnlJbmRleC5qcyIsIi4uL3NyYy9NdXJlLmpzIiwiLi4vc3JjL21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVyZSBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGZvciAoY29uc3QgZmluaXNoZWRJdGVtIG9mIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpKSB7XG4gICAgICAgIHlpZWxkIGZpbmlzaGVkSXRlbTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIE9iamVjdC5rZXlzKHdyYXBwZWRJdGVtLnJvdykpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIHJldHVybiBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2dldEFsbEF0dHJpYnV0ZXMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgc2hvcnRlc3RQYXRoVG9UYWJsZSAob3RoZXJUYWJsZSkge1xuICAgIC8vIERpamtzdHJhJ3MgYWxnb3JpdGhtLi4uXG4gICAgY29uc3QgdmlzaXRlZCA9IHt9O1xuICAgIGNvbnN0IGRpc3RhbmNlcyA9IHt9O1xuICAgIGNvbnN0IHByZXZUYWJsZXMgPSB7fTtcbiAgICBjb25zdCB2aXNpdCA9IHRhcmdldElkID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFRhYmxlID0gdGhpcy5fbXVyZS50YWJsZXNbdGFyZ2V0SWRdO1xuICAgICAgLy8gT25seSBjaGVjayB0aGUgdW52aXNpdGVkIGRlcml2ZWQgYW5kIHBhcmVudCB0YWJsZXNcbiAgICAgIGNvbnN0IG5laWdoYm9yTGlzdCA9IE9iamVjdC5rZXlzKHRhcmdldFRhYmxlLl9kZXJpdmVkVGFibGVzKVxuICAgICAgICAuY29uY2F0KHRhcmdldFRhYmxlLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUudGFibGVJZCkpXG4gICAgICAgIC5maWx0ZXIodGFibGVJZCA9PiAhdmlzaXRlZFt0YWJsZUlkXSk7XG4gICAgICAvLyBDaGVjayBhbmQgYXNzaWduIChvciB1cGRhdGUpIHRlbnRhdGl2ZSBkaXN0YW5jZXMgdG8gZWFjaCBuZWlnaGJvclxuICAgICAgZm9yIChjb25zdCBuZWlnaGJvcklkIG9mIG5laWdoYm9yTGlzdCkge1xuICAgICAgICBpZiAoZGlzdGFuY2VzW25laWdoYm9ySWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBJbmZpbml0eTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGlzdGFuY2VzW3RhcmdldElkXSArIDEgPCBkaXN0YW5jZXNbbmVpZ2hib3JJZF0pIHtcbiAgICAgICAgICBkaXN0YW5jZXNbbmVpZ2hib3JJZF0gPSBkaXN0YW5jZXNbdGFyZ2V0SWRdICsgMTtcbiAgICAgICAgICBwcmV2VGFibGVzW25laWdoYm9ySWRdID0gdGFyZ2V0SWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIE9rYXksIHRoaXMgdGFibGUgaXMgb2ZmaWNpYWxseSB2aXNpdGVkOyB0YWtlIGl0IG91dCBvZiB0aGUgcnVubmluZ1xuICAgICAgLy8gZm9yIGZ1dHVyZSB2aXNpdHMgLyBjaGVja3NcbiAgICAgIHZpc2l0ZWRbdGFyZ2V0SWRdID0gdHJ1ZTtcbiAgICAgIGRlbGV0ZSBkaXN0YW5jZXNbdGFyZ2V0SWRdO1xuICAgIH07XG5cbiAgICAvLyBTdGFydCB3aXRoIHRoaXMgdGFibGVcbiAgICBwcmV2VGFibGVzW3RoaXMudGFibGVJZF0gPSBudWxsO1xuICAgIGRpc3RhbmNlc1t0aGlzLnRhYmxlSWRdID0gMDtcbiAgICBsZXQgdG9WaXNpdCA9IE9iamVjdC5rZXlzKGRpc3RhbmNlcyk7XG4gICAgd2hpbGUgKHRvVmlzaXQubGVuZ3RoID4gMCkge1xuICAgICAgLy8gVmlzaXQgdGhlIG5leHQgdGFibGUgdGhhdCBoYXMgdGhlIHNob3J0ZXN0IGRpc3RhbmNlXG4gICAgICB0b1Zpc2l0LnNvcnQoKGEsIGIpID0+IGRpc3RhbmNlc1thXSAtIGRpc3RhbmNlc1tiXSk7XG4gICAgICBsZXQgbmV4dElkID0gdG9WaXNpdC5zaGlmdCgpO1xuICAgICAgaWYgKG5leHRJZCA9PT0gb3RoZXJUYWJsZS50YWJsZUlkKSB7XG4gICAgICAgIC8vIEZvdW5kIG90aGVyVGFibGUhIFNlbmQgYmFjayB0aGUgY2hhaW4gb2YgY29ubmVjdGVkIHRhYmxlc1xuICAgICAgICBjb25zdCBjaGFpbiA9IFtdO1xuICAgICAgICB3aGlsZSAocHJldlRhYmxlc1tuZXh0SWRdICE9PSBudWxsKSB7XG4gICAgICAgICAgY2hhaW4udW5zaGlmdCh0aGlzLl9tdXJlLnRhYmxlc1tuZXh0SWRdKTtcbiAgICAgICAgICBuZXh0SWQgPSBwcmV2VGFibGVzW25leHRJZF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYWluO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVmlzaXQgdGhlIHRhYmxlXG4gICAgICAgIHZpc2l0KG5leHRJZCk7XG4gICAgICAgIHRvVmlzaXQgPSBPYmplY3Qua2V5cyhkaXN0YW5jZXMpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBXZSBkaWRuJ3QgZmluZCBpdDsgdGhlcmUncyBubyBjb25uZWN0aW9uXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmlsdGVyZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmlsdGVyZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdFRhYmxlIGV4dGVuZHMgVGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX25hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgdGhpcy5fZGF0YSA9IG9wdGlvbnMuZGF0YSB8fCB7fTtcbiAgICBpZiAoIXRoaXMuX25hbWUgfHwgIXRoaXMuX2RhdGEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbmFtZSBhbmQgZGF0YSBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLm5hbWUgPSB0aGlzLl9uYW1lO1xuICAgIG9iai5kYXRhID0gdGhpcy5fZGF0YTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGNvbnN0IFtpbmRleCwgcm93XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kYXRhKSkge1xuICAgICAgY29uc3QgaXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93IH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNEaWN0VGFibGU7XG4iLCJjb25zdCBTaW5nbGVQYXJlbnRNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpbiA9IHRydWU7XG4gICAgfVxuICAgIGdldCBwYXJlbnRUYWJsZSAoKSB7XG4gICAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAgIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IHRhYmxlIGlzIHJlcXVpZXJkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfSBlbHNlIGlmIChwYXJlbnRUYWJsZXMubGVuZ3RoID4gMSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE9ubHkgb25lIHBhcmVudCB0YWJsZSBhbGxvd2VkIGZvciB0YWJsZSBvZiB0eXBlICR7dGhpcy50eXBlfWApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcmVudFRhYmxlc1swXTtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNpbmdsZVBhcmVudE1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mU2luZ2xlUGFyZW50TWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgU2luZ2xlUGFyZW50TWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEFnZ3JlZ2F0ZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgaWYgKG9wdGlvbnMucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLmh5ZHJhdGVGdW5jdGlvbihzdHJpbmdpZmllZEZ1bmMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucyA9IHt9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9iai5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSB0aGlzLl9tdXJlLl9kZWh5ZHJhdGVGdW5jdGlvbihmdW5jKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqYnO1xuICB9XG4gIGRlcml2ZVJlZHVjZWRBdHRyaWJ1dGUgKGF0dHIsIGZ1bmMpIHtcbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnNbYXR0cl0gPSBmdW5jO1xuICAgIHRoaXMucmVzZXQoKTtcbiAgfVxuICBfdXBkYXRlSXRlbSAob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pIHtcbiAgICBmb3IgKGNvbnN0IFthdHRyLCBmdW5jXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnJvd1thdHRyXSA9IGZ1bmMob3JpZ2luYWxXcmFwcGVkSXRlbSwgbmV3V3JhcHBlZEl0ZW0pO1xuICAgIH1cbiAgICBvcmlnaW5hbFdyYXBwZWRJdGVtLnRyaWdnZXIoJ3VwZGF0ZScpO1xuICB9XG4gIGFzeW5jICogX2J1aWxkQ2FjaGUgKG9wdGlvbnMpIHtcbiAgICAvLyBXZSBvdmVycmlkZSBfYnVpbGRDYWNoZSBiZWNhdXNlIHNvIHRoYXQgQWdncmVnYXRlZFRhYmxlIGNhbiB0YWtlIGFkdmFudGFnZVxuICAgIC8vIG9mIHRoZSBwYXJ0aWFsbHktYnVpbHQgY2FjaGUgYXMgaXQgZ29lcywgYW5kIHBvc3Rwb25lIGZpbmlzaGluZyBpdGVtc1xuICAgIC8vIHVudGlsIGFmdGVyIHRoZSBwYXJlbnQgdGFibGUgaGFzIGJlZW4gZnVsbHkgaXRlcmF0ZWRcblxuICAgIC8vIFRPRE86IGluIGxhcmdlIGRhdGEgc2NlbmFyaW9zLCB3ZSBzaG91bGQgYnVpbGQgdGhlIGNhY2hlIC8gaW5kZXhcbiAgICAvLyBleHRlcm5hbGx5IG9uIGRpc2tcbiAgICB0aGlzLl9wYXJ0aWFsQ2FjaGUgPSB7fTtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IHdyYXBwZWRJdGVtIG9mIHRoaXMuX2l0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIHRoaXMuX3BhcnRpYWxDYWNoZVt3cmFwcGVkSXRlbS5pbmRleF0gPSB3cmFwcGVkSXRlbTtcbiAgICAgIC8vIEdvIGFoZWFkIGFuZCB5aWVsZCB0aGUgdW5maW5pc2hlZCBpdGVtOyB0aGlzIG1ha2VzIGl0IHBvc3NpYmxlIGZvclxuICAgICAgLy8gY2xpZW50IGFwcHMgdG8gYmUgbW9yZSByZXNwb25zaXZlIGFuZCByZW5kZXIgcGFydGlhbCByZXN1bHRzLCBidXQgYWxzb1xuICAgICAgLy8gbWVhbnMgdGhhdCB0aGV5IG5lZWQgdG8gd2F0Y2ggZm9yIHdyYXBwZWRJdGVtLm9uKCd1cGRhdGUnKSBldmVudHNcbiAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzOiBub3cgdGhhdCB3ZSd2ZSBjb21wbGV0ZWQgdGhlIGZ1bGwgaXRlcmF0aW9uIG9mIHRoZSBwYXJlbnRcbiAgICAvLyB0YWJsZSwgd2UgY2FuIGZpbmlzaCBlYWNoIGl0ZW1cbiAgICBmb3IgKGNvbnN0IGluZGV4IGluIHRoaXMuX3BhcnRpYWxDYWNoZSkge1xuICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIHRoaXMuX2NhY2hlID0gdGhpcy5fcGFydGlhbENhY2hlO1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluZGV4ID0gd3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXTtcbiAgICAgIGlmICghdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICAgIC8vIFdlIHdlcmUgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbSh0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdLCB3cmFwcGVkUGFyZW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLl93cmFwKHtcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjb25uZWN0ZWRSb3dzOiB7IHdyYXBwZWRQYXJlbnQgfVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gUmVkdWNlIG9wZXJhdGlvbnMgc3RpbGwgbmVlZCB0byBiZSBhcHBsaWVkIHRvIHRoZSBmaXJzdCBpdGVtXG4gICAgICAgIHRoaXMuX3VwZGF0ZUl0ZW0obmV3SXRlbSwgbmV3SXRlbSk7XG4gICAgICAgIHlpZWxkIG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF9nZXRBbGxBdHRyaWJ1dGVzICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIHJlc3VsdFthdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEFnZ3JlZ2F0ZWRUYWJsZTtcbiIsImNvbnN0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgIHRoaXMuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4gPSB0cnVlO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmR1cGxpY2F0ZWRBdHRyaWJ1dGVzIHx8IHt9O1xuICAgIH1cbiAgICBfdG9SYXdPYmplY3QgKCkge1xuICAgICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgICBvYmouZHVwbGljYXRlZEF0dHJpYnV0ZXMgPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcztcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfVxuICAgIGR1cGxpY2F0ZUF0dHJpYnV0ZSAocGFyZW50SWQsIGF0dHJpYnV0ZSkge1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdID0gdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdIHx8IFtdO1xuICAgICAgdGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXNbcGFyZW50SWRdLnB1c2goYXR0cmlidXRlKTtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG4gICAgX2R1cGxpY2F0ZUF0dHJpYnV0ZXMgKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKSB7XG4gICAgICBmb3IgKGNvbnN0IFtwYXJlbnRJZCwgYXR0cl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZHVwbGljYXRlZEF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHBhcmVudE5hbWUgPSB0aGlzLl9tdXJlLnRhYmxlc1twYXJlbnRJZF0ubmFtZTtcbiAgICAgICAgd3JhcHBlZEl0ZW0ucm93W2Ake3BhcmVudE5hbWV9LiR7YXR0cn1gXSA9IGNvbm5lY3RlZFJvd3NbcGFyZW50SWRdLnJvd1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gICAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX2dldEFsbEF0dHJpYnV0ZXMoKTtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICByZXN1bHRbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW5cbn0pO1xuZXhwb3J0IGRlZmF1bHQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IFNpbmdsZVBhcmVudE1peGluIGZyb20gJy4vU2luZ2xlUGFyZW50TWl4aW4uanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIEV4cGFuZGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgaWYgKCF0aGlzLl9hdHRyaWJ1dGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXR0cmlidXRlIGlzIHJlcXVpcmVkYCk7XG4gICAgfVxuXG4gICAgdGhpcy5kZWxpbWl0ZXIgPSBvcHRpb25zLmRlbGltaXRlciB8fCAnLCc7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICBvYmouYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlO1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlLm5hbWUgKyAn4oakJztcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBjb25zdCBwYXJlbnRUYWJsZUlkID0gdGhpcy5wYXJlbnRUYWJsZS50YWJsZUlkO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IHZhbHVlcyA9ICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdIHx8ICcnKS5zcGxpdCh0aGlzLmRlbGltaXRlcik7XG4gICAgICBmb3IgKGNvbnN0IHZhbHVlIG9mIHZhbHVlcykge1xuICAgICAgICBjb25zdCByb3cgPSB7fTtcbiAgICAgICAgcm93W3RoaXMuX2F0dHJpYnV0ZV0gPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgY29ubmVjdGVkUm93cyA9IHt9O1xuICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlSWRdID0gd3JhcHBlZFBhcmVudDtcbiAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdywgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyh3cmFwcGVkSXRlbSwgY29ubmVjdGVkUm93cyk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEV4cGFuZGVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5cbmNsYXNzIEZpbHRlcmVkVGFibGUgZXh0ZW5kcyBTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuX2F0dHJpYnV0ZSA9IG9wdGlvbnMuYXR0cmlidXRlO1xuICAgIHRoaXMuX3ZhbHVlID0gb3B0aW9ucy52YWx1ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSA9PT0gdW5kZWZpbmVkIHx8ICF0aGlzLl92YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGF0dHJpYnV0ZSBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5wYXJlbnRUYWJsZS5uYW1lfVske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGNvbnN0IGluY2x1ZGVJdGVtID0gKCkgPT4ge1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogd3JhcHBlZFBhcmVudC5yb3csXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgICByZXR1cm4gd3JhcHBlZEl0ZW07XG4gICAgICB9O1xuICAgICAgaWYgKHRoaXMuX2F0dHJpYnV0ZSA9PT0gbnVsbCkge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5pbmRleCA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgICB5aWVsZCBpbmNsdWRlSXRlbSgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAod3JhcHBlZFBhcmVudC5yb3dbdGhpcy5fYXR0cmlidXRlXSA9PT0gdGhpcy5fdmFsdWUpIHtcbiAgICAgICAgICB5aWVsZCBpbmNsdWRlSXRlbSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBGaWx0ZXJlZFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuaW1wb3J0IER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiBmcm9tICcuL0R1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbi5qcyc7XG5cbmNsYXNzIENvbm5lY3RlZFRhYmxlIGV4dGVuZHMgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluKFRhYmxlKSB7XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZXMubWFwKHBhcmVudFRhYmxlID0+IHBhcmVudFRhYmxlLm5hbWUpLmpvaW4oJ+KorycpO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBwYXJlbnRUYWJsZXMgPSB0aGlzLnBhcmVudFRhYmxlcztcbiAgICAvLyBTcGluIHRocm91Z2ggYWxsIG9mIHRoZSBwYXJlbnRUYWJsZXMgc28gdGhhdCB0aGVpciBfY2FjaGUgaXMgcHJlLWJ1aWx0XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIGNvbnN0IGl0ZXJhdG9yID0gcGFyZW50VGFibGUuaXRlcmF0ZSgpO1xuICAgICAgICBsZXQgdGVtcDtcbiAgICAgICAgd2hpbGUgKCF0ZW1wIHx8ICF0ZW1wLmRvbmUpIHtcbiAgICAgICAgICB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIE5vdyB0aGF0IHRoZSBjYWNoZXMgYXJlIGJ1aWx0LCBqdXN0IGl0ZXJhdGUgdGhlaXIga2V5cyBkaXJlY3RseVxuICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICBpZiAoIXBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICAvLyBPbmUgb2YgdGhlIHBhcmVudCB0YWJsZXMgd2FzIHJlc2V0OyByZXR1cm4gaW1tZWRpYXRlbHlcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBpbmRleCBpbiBwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGVbaW5kZXhdKSB7XG4gICAgICAgICAgY29uc3QgY29ubmVjdGVkUm93cyA9IHt9O1xuICAgICAgICAgIGZvciAoY29uc3QgcGFyZW50VGFibGUyIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgICAgICAgY29ubmVjdGVkUm93c1twYXJlbnRUYWJsZTIudGFibGVJZF0gPSBwYXJlbnRUYWJsZTIuX2NhY2hlW2luZGV4XTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgd3JhcHBlZEl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIGNvbm5lY3RlZFJvd3MgfSk7XG4gICAgICAgICAgdGhpcy5fZHVwbGljYXRlQXR0cmlidXRlcyh3cmFwcGVkSXRlbSwgY29ubmVjdGVkUm93cyk7XG4gICAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IENvbm5lY3RlZFRhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNDbGFzcyBleHRlbmRzIEludHJvc3BlY3RhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX211cmUgPSBvcHRpb25zLm11cmU7XG4gICAgdGhpcy5jbGFzc0lkID0gb3B0aW9ucy5jbGFzc0lkO1xuICAgIHRoaXMudGFibGVJZCA9IG9wdGlvbnMudGFibGVJZDtcbiAgICBpZiAoIXRoaXMuX211cmUgfHwgIXRoaXMuY2xhc3NJZCB8fCAhdGhpcy50YWJsZUlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYF9tdXJlLCBjbGFzc0lkLCBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZSB8fCBudWxsO1xuICAgIHRoaXMuYW5ub3RhdGlvbiA9IG9wdGlvbnMuYW5ub3RhdGlvbiB8fCAnJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB7XG4gICAgICBjbGFzc0lkOiB0aGlzLmNsYXNzSWQsXG4gICAgICB0YWJsZUlkOiB0aGlzLnRhYmxlSWQsXG4gICAgICBjbGFzc05hbWU6IHRoaXMuX2NsYXNzTmFtZSxcbiAgICAgIGFubm90YXRpb246IHRoaXMuYW5ub3RhdGlvblxuICAgIH07XG4gIH1cbiAgc2V0Q2xhc3NOYW1lICh2YWx1ZSkge1xuICAgIHRoaXMuX2NsYXNzTmFtZSA9IHZhbHVlO1xuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICBnZXQgaGFzQ3VzdG9tTmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NsYXNzTmFtZSAhPT0gbnVsbDtcbiAgfVxuICBnZXQgY2xhc3NOYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lIHx8IHRoaXMudGFibGUubmFtZTtcbiAgfVxuICBnZXRIYXNoVGFibGUgKGF0dHJpYnV0ZSkge1xuICAgIHJldHVybiBhdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy50YWJsZS5hZ2dyZWdhdGUoYXR0cmlidXRlKTtcbiAgfVxuICBnZXQgdGFibGUgKCkge1xuICAgIHJldHVybiB0aGlzLl9tdXJlLnRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyB0aGlzLl9tdXJlLldSQVBQRVJTLkdlbmVyaWNXcmFwcGVyKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl90b1Jhd09iamVjdCgpO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIF9kZXJpdmVHZW5lcmljQ2xhc3MgKG5ld1RhYmxlKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnXG4gICAgfSk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSkpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKHRoaXMudGFibGUuZXhwYW5kKGF0dHJpYnV0ZSwgZGVsaW1pdGVyKSk7XG4gIH1cbiAgY2xvc2VkRmFjZXQgKGF0dHJpYnV0ZSwgdmFsdWVzKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGUuY2xvc2VkRmFjZXQoYXR0cmlidXRlLCB2YWx1ZXMpLm1hcChuZXdUYWJsZSA9PiB7XG4gICAgICByZXR1cm4gdGhpcy5fZGVyaXZlR2VuZXJpY0NsYXNzKG5ld1RhYmxlKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBuZXdUYWJsZSBvZiB0aGlzLnRhYmxlLm9wZW5GYWNldChhdHRyaWJ1dGUpKSB7XG4gICAgICB5aWVsZCB0aGlzLl9kZXJpdmVHZW5lcmljQ2xhc3MobmV3VGFibGUpO1xuICAgIH1cbiAgfVxuICBkZWxldGUgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5jbGFzc0lkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShHZW5lcmljQ2xhc3MsICd0eXBlJywge1xuICBnZXQgKCkge1xuICAgIHJldHVybiAvKC4qKUNsYXNzLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY0NsYXNzO1xuIiwiaW1wb3J0IEdlbmVyaWNDbGFzcyBmcm9tICcuL0dlbmVyaWNDbGFzcy5qcyc7XG5cbmNsYXNzIE5vZGVDbGFzcyBleHRlbmRzIEdlbmVyaWNDbGFzcyB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHMgPSBvcHRpb25zLmVkZ2VDbGFzc0lkcyB8fCB7fTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLl9tdXJlLldSQVBQRVJTLk5vZGVXcmFwcGVyO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgcmVzdWx0LmVkZ2VDbGFzc0lkcyA9IHRoaXMuZWRnZUNsYXNzSWRzO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzSWRzID0gT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID4gMikge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG1vcmUgdGhhbiB0d28gZWRnZXMsIGJyZWFrIGFsbCBjb25uZWN0aW9ucyBhbmQgbWFrZVxuICAgICAgLy8gdGhpcyBhIGZsb2F0aW5nIGVkZ2UgKGZvciBub3csIHdlJ3JlIG5vdCBkZWFsaW5nIGluIGh5cGVyZWRnZXMpXG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgLy8gV2l0aCBvbmx5IG9uZSBjb25uZWN0aW9uLCB0aGlzIG5vZGUgc2hvdWxkIGJlY29tZSBhIHNlbGYtZWRnZVxuICAgICAgLy8gKG9yIGEgZmxvYXRpbmcgZWRnZSBpZiBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZCBpcyBudWxsKVxuICAgICAgY29uc3QgZWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW2VkZ2VDbGFzc0lkc1swXV07XG4gICAgICBvcHRpb25zLnNvdXJjZUNsYXNzSWQgPSBlZGdlQ2xhc3Muc291cmNlQ2xhc3NJZDtcbiAgICAgIG9wdGlvbnMudGFyZ2V0Q2xhc3NJZCA9IGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IGVkZ2VDbGFzcy5kaXJlY3RlZDtcbiAgICAgIGVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICB9IGVsc2UgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGxldCBzb3VyY2VFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzBdXTtcbiAgICAgIGxldCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRzWzFdXTtcbiAgICAgIC8vIEZpZ3VyZSBvdXQgdGhlIGRpcmVjdGlvbiwgaWYgdGhlcmUgaXMgb25lXG4gICAgICBvcHRpb25zLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgICBpZiAoc291cmNlRWRnZUNsYXNzLmRpcmVjdGVkICYmIHRhcmdldEVkZ2VDbGFzcy5kaXJlY3RlZCkge1xuICAgICAgICBpZiAoc291cmNlRWRnZUNsYXNzLnRhcmdldENsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgdGFyZ2V0RWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICAgIC8vIFdlIGhhcHBlbmVkIHRvIGdldCB0aGUgZWRnZXMgaW4gb3JkZXI7IHNldCBkaXJlY3RlZCB0byB0cnVlXG4gICAgICAgICAgb3B0aW9ucy5kaXJlY3RlZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlRWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCAmJlxuICAgICAgICAgICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgICAvLyBXZSBnb3QgdGhlIGVkZ2VzIGJhY2t3YXJkczsgc3dhcCB0aGVtIGFuZCBzZXQgZGlyZWN0ZWQgdG8gdHJ1ZVxuICAgICAgICAgIHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICAgIHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICAgIG9wdGlvbnMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPa2F5LCBub3cgd2Uga25vdyBob3cgdG8gc2V0IHNvdXJjZSAvIHRhcmdldCBpZHNcbiAgICAgIG9wdGlvbnMuc291cmNlQ2xhc3NJZCA9IHNvdXJjZUVkZ2VDbGFzcy5jbGFzc0lkO1xuICAgICAgb3B0aW9ucy50YXJnZXRDbGFzc0lkID0gdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWQ7XG4gICAgICAvLyBEZWxldGUgZWFjaCBvZiB0aGUgZWRnZSBjbGFzc2VzXG4gICAgICBzb3VyY2VFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgICB0YXJnZXRFZGdlQ2xhc3MuZGVsZXRlKCk7XG4gICAgfVxuICAgIHRoaXMuZGVsZXRlKCk7XG4gICAgZGVsZXRlIG9wdGlvbnMuY2xhc3NJZDtcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3NJZHM7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgY29ubmVjdFRvTm9kZUNsYXNzICh7IG90aGVyTm9kZUNsYXNzLCBkaXJlY3RlZCwgYXR0cmlidXRlLCBvdGhlckF0dHJpYnV0ZSB9KSB7XG4gICAgY29uc3QgdGhpc0hhc2ggPSB0aGlzLmdldEhhc2hUYWJsZShhdHRyaWJ1dGUpO1xuICAgIGNvbnN0IG90aGVySGFzaCA9IG90aGVyTm9kZUNsYXNzLmdldEhhc2hUYWJsZShvdGhlckF0dHJpYnV0ZSk7XG4gICAgY29uc3QgY29ubmVjdGVkVGFibGUgPSB0aGlzSGFzaC5jb25uZWN0KFtvdGhlckhhc2hdKTtcbiAgICBjb25zdCBuZXdFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgIHR5cGU6ICdFZGdlQ2xhc3MnLFxuICAgICAgdGFibGVJZDogY29ubmVjdGVkVGFibGUudGFibGVJZCxcbiAgICAgIGRpcmVjdGVkLFxuICAgICAgc291cmNlQ2xhc3NJZDogdGhpcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0Q2xhc3NJZDogb3RoZXJOb2RlQ2xhc3MuY2xhc3NJZFxuICAgIH0pO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgb3RoZXJOb2RlQ2xhc3MuZWRnZUNsYXNzSWRzW25ld0VkZ2VDbGFzcy5jbGFzc0lkXSA9IHRydWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdFZGdlQ2xhc3M7XG4gIH1cbiAgY29ubmVjdFRvRWRnZUNsYXNzIChvcHRpb25zKSB7XG4gICAgY29uc3QgZWRnZUNsYXNzID0gb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgZGVsZXRlIG9wdGlvbnMuZWRnZUNsYXNzO1xuICAgIG9wdGlvbnMubm9kZUNsYXNzID0gdGhpcztcbiAgICByZXR1cm4gZWRnZUNsYXNzLmNvbm5lY3RUb05vZGVDbGFzcyhvcHRpb25zKTtcbiAgfVxuICBkaXNjb25uZWN0QWxsRWRnZXMgKCkge1xuICAgIGZvciAoY29uc3QgZWRnZUNsYXNzSWQgb2YgT2JqZWN0LmtleXModGhpcy5lZGdlQ2xhc3NJZHMpKSB7XG4gICAgICBjb25zdCBlZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbZWRnZUNsYXNzSWRdO1xuICAgICAgaWYgKGVkZ2VDbGFzcy5zb3VyY2VDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RTb3VyY2UoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3MudGFyZ2V0Q2xhc3NJZCA9PT0gdGhpcy5jbGFzc0lkKSB7XG4gICAgICAgIGVkZ2VDbGFzcy5kaXNjb25uZWN0VGFyZ2V0KCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0QWxsRWRnZXMoKTtcbiAgICBzdXBlci5kZWxldGUoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBOb2RlQ2xhc3M7XG4iLCJpbXBvcnQgR2VuZXJpY0NsYXNzIGZyb20gJy4vR2VuZXJpY0NsYXNzLmpzJztcblxuY2xhc3MgRWRnZUNsYXNzIGV4dGVuZHMgR2VuZXJpY0NsYXNzIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLldyYXBwZXIgPSB0aGlzLl9tdXJlLldSQVBQRVJTLkVkZ2VXcmFwcGVyO1xuXG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gb3B0aW9ucy5zb3VyY2VDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gb3B0aW9ucy50YXJnZXRDbGFzc0lkIHx8IG51bGw7XG4gICAgdGhpcy5kaXJlY3RlZCA9IG9wdGlvbnMuZGlyZWN0ZWQgfHwgZmFsc2U7XG4gIH1cbiAgX3RvUmF3T2JqZWN0ICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcblxuICAgIHJlc3VsdC5zb3VyY2VDbGFzc0lkID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgIHJlc3VsdC50YXJnZXRDbGFzc0lkID0gdGhpcy50YXJnZXRDbGFzc0lkO1xuICAgIHJlc3VsdC5kaXJlY3RlZCA9IHRoaXMuZGlyZWN0ZWQ7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICBfcGlja0VkZ2VUYWJsZSAob3RoZXJDbGFzcykge1xuICAgIGxldCBlZGdlVGFibGU7XG4gICAgbGV0IGNoYWluID0gdGhpcy50YWJsZS5zaG9ydGVzdFBhdGhUb1RhYmxlKG90aGVyQ2xhc3MudGFibGUpO1xuICAgIGlmIChjaGFpbiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmRlcmx5aW5nIHRhYmxlIGNoYWluIGJldHdlZW4gZWRnZSBhbmQgbm9kZSBjbGFzc2VzIGlzIGJyb2tlbmApO1xuICAgIH0gZWxzZSBpZiAoY2hhaW4ubGVuZ3RoIDw9IDIpIHtcbiAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlIHdoZXJlIHdlJ3JlIHRyeWluZyB0byBjcmVhdGUgYW4gZWRnZSBiZXR3ZWVuXG4gICAgICAvLyBhZGphY2VudCBvciBpZGVudGljYWwgdGFibGVzLi4uIGNyZWF0ZSBhIENvbm5lY3RlZFRhYmxlXG4gICAgICBlZGdlVGFibGUgPSB0aGlzLnRhYmxlLmNvbm5lY3Qob3RoZXJDbGFzcy50YWJsZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSBhIHRhYmxlIGluIHRoZSBtaWRkbGU7IHByaW9yaXRpemUgU3RhdGljVGFibGUgYW5kIFN0YXRpY0RpY3RUYWJsZVxuICAgICAgbGV0IHN0YXRpY0V4aXN0cyA9IGZhbHNlO1xuICAgICAgY2hhaW4gPSBjaGFpbi5zbGljZSgxLCBjaGFpbi5sZW5ndGggLSAxKS5tYXAoKHRhYmxlLCBkaXN0KSA9PiB7XG4gICAgICAgIHN0YXRpY0V4aXN0cyA9IHN0YXRpY0V4aXN0cyB8fCB0YWJsZS50eXBlLnN0YXJ0c1dpdGgoJ1N0YXRpYycpO1xuICAgICAgICByZXR1cm4geyB0YWJsZSwgZGlzdCB9O1xuICAgICAgfSk7XG4gICAgICBpZiAoc3RhdGljRXhpc3RzKSB7XG4gICAgICAgIGNoYWluID0gY2hhaW4uZmlsdGVyKCh7IHRhYmxlIH0pID0+IHtcbiAgICAgICAgICByZXR1cm4gdGFibGUudHlwZS5zdGFydHNXaXRoKCdTdGF0aWMnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlZGdlVGFibGUgPSBjaGFpblswXS50YWJsZTtcbiAgICB9XG4gICAgcmV0dXJuIGVkZ2VUYWJsZTtcbiAgfVxuICBpbnRlcnByZXRBc05vZGVzICgpIHtcbiAgICBjb25zdCB0ZW1wID0gdGhpcy5fdG9SYXdPYmplY3QoKTtcbiAgICB0aGlzLmRlbGV0ZSgpO1xuICAgIHRlbXAudHlwZSA9ICdOb2RlQ2xhc3MnO1xuICAgIGRlbGV0ZSB0ZW1wLmNsYXNzSWQ7XG4gICAgY29uc3QgbmV3Tm9kZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh0ZW1wKTtcblxuICAgIGlmICh0ZW1wLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgIGNvbnN0IHNvdXJjZUNsYXNzID0gdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF07XG4gICAgICBjb25zdCBlZGdlVGFibGUgPSB0aGlzLl9waWNrRWRnZVRhYmxlKHNvdXJjZUNsYXNzKTtcbiAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY3JlYXRlQ2xhc3Moe1xuICAgICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgICAgdGFibGVJZDogZWRnZVRhYmxlLnRhYmxlSWQsXG4gICAgICAgIGRpcmVjdGVkOiB0ZW1wLmRpcmVjdGVkLFxuICAgICAgICBzb3VyY2VDbGFzc0lkOiB0ZW1wLnNvdXJjZUNsYXNzSWQsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IG5ld05vZGVDbGFzcy5jbGFzc0lkXG4gICAgICB9KTtcbiAgICAgIHNvdXJjZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgICAgbmV3Tm9kZUNsYXNzLmVkZ2VDbGFzc0lkc1tzb3VyY2VFZGdlQ2xhc3MuY2xhc3NJZF0gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGVtcC50YXJnZXRDbGFzc0lkICYmIHRlbXAuc291cmNlQ2xhc3NJZCAhPT0gdGVtcC50YXJnZXRDbGFzc0lkKSB7XG4gICAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgICAgY29uc3QgZWRnZVRhYmxlID0gdGhpcy5fcGlja0VkZ2VUYWJsZSh0YXJnZXRDbGFzcyk7XG4gICAgICBjb25zdCB0YXJnZXRFZGdlQ2xhc3MgPSB0aGlzLl9tdXJlLmNyZWF0ZUNsYXNzKHtcbiAgICAgICAgdHlwZTogJ0VkZ2VDbGFzcycsXG4gICAgICAgIHRhYmxlSWQ6IGVkZ2VUYWJsZS50YWJsZUlkLFxuICAgICAgICBkaXJlY3RlZDogdGVtcC5kaXJlY3RlZCxcbiAgICAgICAgc291cmNlQ2xhc3NJZDogbmV3Tm9kZUNsYXNzLmNsYXNzSWQsXG4gICAgICAgIHRhcmdldENsYXNzSWQ6IHRlbXAudGFyZ2V0Q2xhc3NJZFxuICAgICAgfSk7XG4gICAgICB0YXJnZXRDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICAgIG5ld05vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbdGFyZ2V0RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld05vZGVDbGFzcztcbiAgfVxuICBpbnRlcnByZXRBc0VkZ2VzICgpIHtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuICBjb25uZWN0VG9Ob2RlQ2xhc3MgKHsgbm9kZUNsYXNzLCBkaXJlY3Rpb24sIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSkge1xuICAgIGlmIChkaXJlY3Rpb24pIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uICE9PSAnc291cmNlJyAmJiBkaXJlY3Rpb24gIT09ICd0YXJnZXQnKSB7XG4gICAgICBkaXJlY3Rpb24gPSB0aGlzLnRhcmdldENsYXNzSWQgPT09IG51bGwgPyAndGFyZ2V0JyA6ICdzb3VyY2UnO1xuICAgIH1cbiAgICBpZiAoZGlyZWN0aW9uID09PSAndGFyZ2V0Jykge1xuICAgICAgdGhpcy5jb25uZWN0VGFyZ2V0KHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbm5lY3RTb3VyY2UoeyBub2RlQ2xhc3MsIG5vZGVBdHRyaWJ1dGUsIGVkZ2VBdHRyaWJ1dGUgfSk7XG4gICAgfVxuICAgIHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTtcbiAgfVxuICB0b2dnbGVOb2RlRGlyZWN0aW9uIChzb3VyY2VDbGFzc0lkKSB7XG4gICAgaWYgKCFzb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGlyZWN0ZWQgPSB0cnVlO1xuICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMuc291cmNlQ2xhc3NJZCkge1xuICAgICAgICBpZiAoc291cmNlQ2xhc3NJZCAhPT0gdGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBzd2FwIHRvIHVuY29ubmVjdGVkIGNsYXNzIGlkOiAke3NvdXJjZUNsYXNzSWR9YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHRlbXAgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgICAgIHRoaXMuc291cmNlQ2xhc3NJZCA9IHRoaXMudGFyZ2V0Q2xhc3NJZDtcbiAgICAgICAgdGhpcy50YXJnZXRDbGFzc0lkID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgY29uc3Qgc291cmNlQ2xhc3MgPSB0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy5zb3VyY2VDbGFzc0lkXTtcbiAgICBzb3VyY2VDbGFzcy5lZGdlQ2xhc3NJZHNbdGhpcy5jbGFzc0lkXSA9IHRydWU7XG5cbiAgICBjb25zdCBlZGdlSGFzaCA9IGVkZ2VBdHRyaWJ1dGUgPT09IG51bGwgPyB0aGlzLnRhYmxlIDogdGhpcy5nZXRIYXNoVGFibGUoZWRnZUF0dHJpYnV0ZSk7XG4gICAgY29uc3Qgbm9kZUhhc2ggPSBub2RlQXR0cmlidXRlID09PSBudWxsID8gc291cmNlQ2xhc3MudGFibGUgOiBzb3VyY2VDbGFzcy5nZXRIYXNoVGFibGUobm9kZUF0dHJpYnV0ZSk7XG4gICAgZWRnZUhhc2guY29ubmVjdChbbm9kZUhhc2hdKTtcblxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgY29ubmVjdFRhcmdldCAoe1xuICAgIG5vZGVDbGFzcyxcbiAgICBub2RlQXR0cmlidXRlID0gbnVsbCxcbiAgICBlZGdlQXR0cmlidXRlID0gbnVsbCxcbiAgICBza2lwU2F2ZSA9IGZhbHNlXG4gIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLnRhcmdldENsYXNzSWQpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdFRhcmdldCh7IHNraXBTYXZlOiB0cnVlIH0pO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBub2RlQ2xhc3MuY2xhc3NJZDtcbiAgICBjb25zdCB0YXJnZXRDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdO1xuICAgIHRhcmdldENsYXNzLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdID0gdHJ1ZTtcblxuICAgIGNvbnN0IGVkZ2VIYXNoID0gZWRnZUF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLmdldEhhc2hUYWJsZShlZGdlQXR0cmlidXRlKTtcbiAgICBjb25zdCBub2RlSGFzaCA9IG5vZGVBdHRyaWJ1dGUgPT09IG51bGwgPyB0YXJnZXRDbGFzcy50YWJsZSA6IHRhcmdldENsYXNzLmdldEhhc2hUYWJsZShub2RlQXR0cmlidXRlKTtcbiAgICBlZGdlSGFzaC5jb25uZWN0KFtub2RlSGFzaF0pO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0U291cmNlICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkge1xuICAgICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkUm93cyA9IG9wdGlvbnMuY29ubmVjdGVkUm93cyB8fCB7fTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRBQkxFUyA9IFRBQkxFUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy50YWJsZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy5UQUJMRVMpO1xuICAgIE5FWFRfVEFCTEVfSUQgPSBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIHRhYmxlSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KHRhYmxlSWQubWF0Y2goL3RhYmxlKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy50YWJsZXMpO1xuICAgIHRoaXMudHJpZ2dlcigndGFibGVVcGRhdGUnKTtcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuY2xhc3Nlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgdmFsdWUubXVyZSA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLkNMQVNTRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlT2JqID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGVPYmo7XG4gIH1cbiAgbmV3Q2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdDbGFzc09iaiA9IHRoaXMuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdDbGFzc09iajtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNUYWJsZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0VGFibGUnO1xuICAgIGxldCBuZXdUYWJsZSA9IHRoaXMubmV3VGFibGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMubmV3Q2xhc3Moe1xuICAgICAgdHlwZTogJ0dlbmVyaWNDbGFzcycsXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0YWJsZUlkOiBuZXdUYWJsZS50YWJsZUlkXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlQWxsVW51c2VkVGFibGVzICgpIHtcbiAgICBmb3IgKGNvbnN0IHRhYmxlSWQgaW4gdGhpcy50YWJsZXMpIHtcbiAgICAgIGlmICh0aGlzLnRhYmxlc1t0YWJsZUlkXSkge1xuICAgICAgICB0cnkgeyB0aGlzLnRhYmxlc1t0YWJsZUlkXS5kZWxldGUoKTsgfSBjYXRjaCAoZXJyKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBkZWxldGVBbGxDbGFzc2VzICgpIHtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgY2xhc3NPYmouZGVsZXRlKCk7XG4gICAgfVxuICB9XG4gIGdldENsYXNzRGF0YSAoKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IHt9O1xuICAgIGZvciAoY29uc3QgY2xhc3NPYmogb2YgT2JqZWN0LnZhbHVlcyh0aGlzLmNsYXNzZXMpKSB7XG4gICAgICByZXN1bHRzW2NsYXNzT2JqLmNsYXNzSWRdID0gY2xhc3NPYmouY3VycmVudERhdGE7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUuanMnO1xuaW1wb3J0IHBrZyBmcm9tICcuLi9wYWNrYWdlLmpzb24nO1xuaW1wb3J0IEZpbGVSZWFkZXIgZnJvbSAnZmlsZXJlYWRlcic7XG5cbmxldCBtdXJlID0gbmV3IE11cmUoRmlsZVJlYWRlciwgbnVsbCk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsInVzZWRCeUNsYXNzZXMiLCJfdXNlZEJ5Q2xhc3NlcyIsImZ1bmMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsIm5hbWUiLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJmaW5pc2hlZEl0ZW0iLCJ2YWx1ZXMiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJkZXJpdmVkVGFibGUiLCJsaW1pdCIsInVuZGVmaW5lZCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsInJvdyIsImtleXMiLCJfd3JhcCIsInRhYmxlIiwiY2xhc3NPYmoiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiX2dldEFsbEF0dHJpYnV0ZXMiLCJhbGxBdHRycyIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsInNhdmVUYWJsZXMiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGVJZCIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwidGFibGVzIiwic2hvcnRlc3RQYXRoVG9UYWJsZSIsIm90aGVyVGFibGUiLCJ2aXNpdGVkIiwiZGlzdGFuY2VzIiwicHJldlRhYmxlcyIsInZpc2l0IiwidGFyZ2V0SWQiLCJ0YXJnZXRUYWJsZSIsIm5laWdoYm9yTGlzdCIsImNvbmNhdCIsInBhcmVudFRhYmxlcyIsIm1hcCIsInBhcmVudFRhYmxlIiwiZmlsdGVyIiwibmVpZ2hib3JJZCIsInRvVmlzaXQiLCJsZW5ndGgiLCJzb3J0IiwiYSIsImIiLCJuZXh0SWQiLCJzaGlmdCIsImNoYWluIiwidW5zaGlmdCIsImFnZ3JlZ2F0ZSIsImV4cGFuZCIsImRlbGltaXRlciIsImNsb3NlZEZhY2V0Iiwib3BlbkZhY2V0IiwiY29ubmVjdCIsIm90aGVyVGFibGVMaXN0IiwiY2xhc3NlcyIsInJlZHVjZSIsImFnZyIsImRlbGV0ZSIsImV4ZWMiLCJTdGF0aWNUYWJsZSIsIl9uYW1lIiwiX2RhdGEiLCJvYmoiLCJpdGVtIiwiU3RhdGljRGljdFRhYmxlIiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwibmV3SXRlbSIsImNvbm5lY3RlZFJvd3MiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJFeHBhbmRlZFRhYmxlIiwicGFyZW50VGFibGVJZCIsInNwbGl0IiwiRmlsdGVyZWRUYWJsZSIsIl92YWx1ZSIsImluY2x1ZGVJdGVtIiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicGFyZW50VGFibGUyIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9uIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIl9kZXJpdmVHZW5lcmljQ2xhc3MiLCJOb2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZHMiLCJXcmFwcGVyIiwiTm9kZVdyYXBwZXIiLCJkaXNjb25uZWN0QWxsRWRnZXMiLCJlZGdlQ2xhc3MiLCJzb3VyY2VDbGFzc0lkIiwidGFyZ2V0Q2xhc3NJZCIsImRpcmVjdGVkIiwic291cmNlRWRnZUNsYXNzIiwidGFyZ2V0RWRnZUNsYXNzIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJvdGhlckF0dHJpYnV0ZSIsInRoaXNIYXNoIiwib3RoZXJIYXNoIiwiY29ubmVjdGVkVGFibGUiLCJuZXdFZGdlQ2xhc3MiLCJjcmVhdGVDbGFzcyIsImNvbm5lY3RUb0VkZ2VDbGFzcyIsIm5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkIiwiZGlzY29ubmVjdFNvdXJjZSIsImRpc2Nvbm5lY3RUYXJnZXQiLCJFZGdlQ2xhc3MiLCJFZGdlV3JhcHBlciIsIl9waWNrRWRnZVRhYmxlIiwib3RoZXJDbGFzcyIsImVkZ2VUYWJsZSIsInN0YXRpY0V4aXN0cyIsInNsaWNlIiwiZGlzdCIsInN0YXJ0c1dpdGgiLCJuZXdOb2RlQ2xhc3MiLCJzb3VyY2VDbGFzcyIsInRhcmdldENsYXNzIiwiZGlyZWN0aW9uIiwibm9kZUF0dHJpYnV0ZSIsImVkZ2VBdHRyaWJ1dGUiLCJjb25uZWN0VGFyZ2V0IiwiY29ubmVjdFNvdXJjZSIsInRvZ2dsZU5vZGVEaXJlY3Rpb24iLCJza2lwU2F2ZSIsImVkZ2VIYXNoIiwibm9kZUhhc2giLCJJbk1lbW9yeUluZGV4IiwidG9SYXdPYmplY3QiLCJpdGVyRW50cmllcyIsImhhc2giLCJ2YWx1ZUxpc3QiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJnZXRWYWx1ZUxpc3QiLCJhZGRWYWx1ZSIsIk5FWFRfQ0xBU1NfSUQiLCJORVhUX1RBQkxFX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiZGVidWciLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwiTWF0aCIsIm1heCIsInBhcnNlSW50IiwibWF0Y2giLCJkZWh5ZHJhdGUiLCJzdG9yYWdlS2V5IiwiVFlQRVMiLCJjb250YWluZXIiLCJnZXRJdGVtIiwicGFyc2UiLCJzZXRJdGVtIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIlR5cGUiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE1BQU1BLGdCQUFnQixHQUFHLFVBQVVDLFVBQVYsRUFBc0I7U0FDdEMsY0FBY0EsVUFBZCxDQUF5QjtJQUM5QkMsV0FBVyxHQUFJO1lBQ1AsR0FBR0MsU0FBVDtXQUNLQywyQkFBTCxHQUFtQyxJQUFuQztXQUNLQyxhQUFMLEdBQXFCLEVBQXJCO1dBQ0tDLGNBQUwsR0FBc0IsRUFBdEI7OztJQUVGQyxFQUFFLENBQUVDLFNBQUYsRUFBYUMsUUFBYixFQUF1QkMsdUJBQXZCLEVB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
