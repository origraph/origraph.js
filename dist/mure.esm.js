import mime from 'mime-types';
import datalib from 'datalib';
import sha1 from 'sha1';

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

class StaticDict extends Table {
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

    if (!this._attribute || !this._value) {
      throw new Error(`attribute and value are required`);
    }
  }

  toRawObject() {
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
      if (wrappedParent.row[this._attribute] === this._value) {
        const wrappedItem = this._wrap({
          index,
          row: wrappedParent.row,
          connectedRows: {
            wrappedParent
          }
        });

        this._finishItem(wrappedItem);

        yield wrappedItem;
        index++;
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
  StaticDict: StaticDict,
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

  aggregate(attribute) {
    const newTable = this.table.aggregate(attribute);
    return this._mure.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
    });
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
      this.disconnectAllEdges();
    } else {
      if (edgeClassIds.length === 1 || edgeClassIds.length === 2) {
        const sourceEdgeClass = this._mure.classes[edgeClassIds[0]];
        options.sourceNodeId = sourceEdgeClass.sourceNodeId;
        options.sourceNodeAttr = sourceEdgeClass.sourceNodeAttr;
        options.sourceEdgeAttr = sourceEdgeClass.targetNodeAttr;
        sourceEdgeClass.delete();
      }

      if (edgeClassIds.length === 2) {
        const targetEdgeClass = this._mure.classes[edgeClassIds[1]];
        options.targetNodeId = targetEdgeClass.targetNodeId;
        options.targetNodeAttr = targetEdgeClass.targetNodeAttr;
        options.targetEdgeAttr = targetEdgeClass.sourceNodeAttr;
        targetEdgeClass.delete();
      }
    }

    this.delete();
    delete options.classId;
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
      sourceNodeAttr: attribute,
      targetClassId: otherNodeClass.classId,
      targetNodeAttr: otherAttribute
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
    this.sourceNodeAttr = options.sourceNodeAttr || null;
    this.sourceEdgeAttr = options.sourceEdgeAttr || null;
    this.targetClassId = options.targetClassId || null;
    this.targetNodeAttr = options.targetNodeAttr || null;
    this.targetEdgeAttr = options.targetEdgeAttr || null;
    this.directed = options.directed || false;
  }

  _toRawObject() {
    const result = super._toRawObject();

    result.sourceClassId = this.sourceClassId;
    result.sourceNodeAttr = this.sourceNodeAttr;
    result.sourceEdgeAttr = this.sourceEdgeAttr;
    result.targetClassId = this.targetClassId;
    result.targetNodeAttr = this.targetNodeAttr;
    result.targetEdgeAttr = this.targetEdgeAttr;
    result.directed = this.directed;
    return result;
  }

  interpretAsNodes() {
    throw new Error(`unimplemented`);
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
        temp = this.sourceNodeAttr;
        this.sourceNodeAttr = this.targetNodeAttr;
        this.targetNodeAttr = temp;
        temp = this.intermediateSources;
        this.sourceEdgeAttr = this.targetEdgeAttr;
        this.targetEdgeAttr = temp;
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
    this._mure.classes[this.sourceClassId].edgeClassIds[this.classId] = true;
    this.sourceNodeAttr = nodeAttribute;
    this.sourceEdgeAttr = edgeAttribute;

    if (!skipSave) {
      this._mure.saveClasses();
    }
  }

  connectTarget({
    nodeClass,
    nodeAttribute,
    edgeAttribute,
    skipSave = false
  } = {}) {
    if (this.targetClassId) {
      this.disconnectTarget({
        skipSave: true
      });
    }

    this.targetClassId = nodeClass.classId;
    this._mure.classes[this.targetClassId].edgeClassIds[this.classId] = true;
    this.targetNodeAttr = nodeAttribute;
    this.targetEdgeAttr = edgeAttribute;

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

    this.sourceNodeAttr = null;
    this.sourceEdgeAttr = null;

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

    this.targetNodeAttr = null;
    this.targetEdgeAttr = null;

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
  constructor(FileReader, localStorage) {
    super();
    this.FileReader = FileReader; // either window.FileReader or one from Node

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
    options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDict';
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
var version = "0.5.3";
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

let mure = new Mure(window.FileReader, window.localStorage);
mure.version = pkg.version;

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lc20uanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyIsIi4uL3NyYy9Db21tb24vSW50cm9zcGVjdGFibGUuanMiLCIuLi9zcmMvVGFibGVzL1RhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9TdGF0aWNUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvU3RhdGljRGljdC5qcyIsIi4uL3NyYy9UYWJsZXMvU2luZ2xlUGFyZW50TWl4aW4uanMiLCIuLi9zcmMvVGFibGVzL0FnZ3JlZ2F0ZWRUYWJsZS5qcyIsIi4uL3NyYy9UYWJsZXMvRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzIiwiLi4vc3JjL1RhYmxlcy9FeHBhbmRlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9GaWx0ZXJlZFRhYmxlLmpzIiwiLi4vc3JjL1RhYmxlcy9Db25uZWN0ZWRUYWJsZS5qcyIsIi4uL3NyYy9DbGFzc2VzL0dlbmVyaWNDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL05vZGVDbGFzcy5qcyIsIi4uL3NyYy9DbGFzc2VzL0VkZ2VDbGFzcy5qcyIsIi4uL3NyYy9XcmFwcGVycy9HZW5lcmljV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9Ob2RlV3JhcHBlci5qcyIsIi4uL3NyYy9XcmFwcGVycy9FZGdlV3JhcHBlci5qcyIsIi4uL3NyYy9JbmRleGVzL0luTWVtb3J5SW5kZXguanMiLCIuLi9zcmMvTXVyZS5qcyIsIi4uL3NyYy9tb2R1bGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgVHJpZ2dlcmFibGVNaXhpbiA9IGZ1bmN0aW9uIChzdXBlcmNsYXNzKSB7XG4gIHJldHVybiBjbGFzcyBleHRlbmRzIHN1cGVyY2xhc3Mge1xuICAgIGNvbnN0cnVjdG9yICgpIHtcbiAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICB0aGlzLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgICAgIHRoaXMuc3RpY2t5VHJpZ2dlcnMgPSB7fTtcbiAgICB9XG4gICAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2ssIGFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5pbmRleE9mKGNhbGxiYWNrKSAhPT0gLTEpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgIH1cbiAgICBvZmYgKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0cmlnZ2VyIChldmVudE5hbWUsIC4uLmFyZ3MpIHtcbiAgICAgIGlmICh0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSkge1xuICAgICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgLy8gQWRkIHRpbWVvdXQgdG8gcHJldmVudCBibG9ja2luZ1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBzdGlja3lUcmlnZ2VyIChldmVudE5hbWUsIGFyZ09iaiwgZGVsYXkgPSAxMCkge1xuICAgICAgdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdID0gdGhpcy5zdGlja3lUcmlnZ2Vyc1tldmVudE5hbWVdIHx8IHsgYXJnT2JqOiB7fSB9O1xuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV0uYXJnT2JqLCBhcmdPYmopO1xuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuc3RpY2t5VHJpZ2dlcnMudGltZW91dCk7XG4gICAgICB0aGlzLnN0aWNreVRyaWdnZXJzLnRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGV0IGFyZ09iaiA9IHRoaXMuc3RpY2t5VHJpZ2dlcnNbZXZlbnROYW1lXS5hcmdPYmo7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnN0aWNreVRyaWdnZXJzW2V2ZW50TmFtZV07XG4gICAgICAgIHRoaXMudHJpZ2dlcihldmVudE5hbWUsIGFyZ09iaik7XG4gICAgICB9LCBkZWxheSk7XG4gICAgfVxuICB9O1xufTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUcmlnZ2VyYWJsZU1peGluLCBTeW1ib2wuaGFzSW5zdGFuY2UsIHtcbiAgdmFsdWU6IGkgPT4gISFpLl9pbnN0YW5jZU9mVHJpZ2dlcmFibGVNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBUcmlnZ2VyYWJsZU1peGluO1xuIiwiY2xhc3MgSW50cm9zcGVjdGFibGUge1xuICBnZXQgdHlwZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29uc3RydWN0b3IudHlwZTtcbiAgfVxuICBnZXQgbG93ZXJDYW1lbENhc2VUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5sb3dlckNhbWVsQ2FzZVR5cGU7XG4gIH1cbiAgZ2V0IGh1bWFuUmVhZGFibGVUeXBlICgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5odW1hblJlYWRhYmxlVHlwZTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAndHlwZScsIHtcbiAgLy8gVGhpcyBjYW4gLyBzaG91bGQgYmUgb3ZlcnJpZGRlbiBieSBzdWJjbGFzc2VzIHRoYXQgZm9sbG93IGEgY29tbW9uIHN0cmluZ1xuICAvLyBwYXR0ZXJuLCBzdWNoIGFzIFJvb3RUb2tlbiwgS2V5c1Rva2VuLCBQYXJlbnRUb2tlbiwgZXRjLlxuICBjb25maWd1cmFibGU6IHRydWUsXG4gIGdldCAoKSB7IHJldHVybiB0aGlzLnR5cGU7IH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnbG93ZXJDYW1lbENhc2VUeXBlJywge1xuICBnZXQgKCkge1xuICAgIGNvbnN0IHRlbXAgPSB0aGlzLnR5cGU7XG4gICAgcmV0dXJuIHRlbXAucmVwbGFjZSgvLi8sIHRlbXBbMF0udG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludHJvc3BlY3RhYmxlLCAnaHVtYW5SZWFkYWJsZVR5cGUnLCB7XG4gIGdldCAoKSB7XG4gICAgLy8gQ2FtZWxDYXNlIHRvIFNlbnRlbmNlIENhc2VcbiAgICByZXR1cm4gdGhpcy50eXBlLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csICckMSAkMicpO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEludHJvc3BlY3RhYmxlO1xuIiwiaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5pbXBvcnQgVHJpZ2dlcmFibGVNaXhpbiBmcm9tICcuLi9Db21tb24vVHJpZ2dlcmFibGVNaXhpbi5qcyc7XG5cbmNsYXNzIFRhYmxlIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLnRhYmxlSWQgPSBvcHRpb25zLnRhYmxlSWQ7XG4gICAgaWYgKCF0aGlzLl9tdXJlIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVyZSBhbmQgdGFibGVJZCBhcmUgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9leHBlY3RlZEF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXMgfHwge307XG4gICAgdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzID0ge307XG4gICAgdGhpcy5fZGVyaXZlZFRhYmxlcyA9IG9wdGlvbnMuZGVyaXZlZFRhYmxlcyB8fCB7fTtcblxuICAgIHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBmb3IgKGNvbnN0IFthdHRyLCBzdHJpbmdpZmllZEZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGFibGVJZDogdGhpcy50YWJsZUlkLFxuICAgICAgYXR0cmlidXRlczogdGhpcy5fYXR0cmlidXRlcyxcbiAgICAgIGRlcml2ZWRUYWJsZXM6IHRoaXMuX2Rlcml2ZWRUYWJsZXMsXG4gICAgICB1c2VkQnlDbGFzc2VzOiB0aGlzLl91c2VkQnlDbGFzc2VzLFxuICAgICAgZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uczoge31cbiAgICB9O1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICByZXN1bHQuZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuZGVoeWRyYXRlRnVuY3Rpb24oZnVuYyk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgZ2V0IG5hbWUgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIGFzeW5jICogaXRlcmF0ZSAob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gR2VuZXJpYyBjYWNoaW5nIHN0dWZmOyB0aGlzIGlzbid0IGp1c3QgZm9yIHBlcmZvcm1hbmNlLiBDb25uZWN0ZWRUYWJsZSdzXG4gICAgLy8gYWxnb3JpdGhtIHJlcXVpcmVzIHRoYXQgaXRzIHBhcmVudCB0YWJsZXMgaGF2ZSBwcmUtYnVpbHQgaW5kZXhlcyAod2VcbiAgICAvLyB0ZWNobmljYWxseSBjb3VsZCBpbXBsZW1lbnQgaXQgZGlmZmVyZW50bHksIGJ1dCBpdCB3b3VsZCBiZSBleHBlbnNpdmUsXG4gICAgLy8gcmVxdWlyZXMgdHJpY2t5IGxvZ2ljLCBhbmQgd2UncmUgYWxyZWFkeSBidWlsZGluZyBpbmRleGVzIGZvciBzb21lIHRhYmxlc1xuICAgIC8vIGxpa2UgQWdncmVnYXRlZFRhYmxlIGFueXdheSlcbiAgICBpZiAob3B0aW9ucy5yZXNldCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fY2FjaGUpIHtcbiAgICAgIGZvciAoY29uc3QgZmluaXNoZWRJdGVtIG9mIE9iamVjdC52YWx1ZXModGhpcy5fY2FjaGUpKSB7XG4gICAgICAgIHlpZWxkIGZpbmlzaGVkSXRlbTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB5aWVsZCAqIGF3YWl0IHRoaXMuX2J1aWxkQ2FjaGUob3B0aW9ucyk7XG4gIH1cbiAgcmVzZXQgKCkge1xuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX2NhY2hlO1xuICAgIGZvciAoY29uc3QgZGVyaXZlZFRhYmxlIG9mIHRoaXMuZGVyaXZlZFRhYmxlcykge1xuICAgICAgZGVyaXZlZFRhYmxlLnJlc2V0KCk7XG4gICAgfVxuICAgIHRoaXMudHJpZ2dlcigncmVzZXQnKTtcbiAgfVxuICBhc3luYyAqIF9idWlsZENhY2hlIChvcHRpb25zKSB7XG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGNvbnN0IGxpbWl0ID0gb3B0aW9ucy5saW1pdCA9PT0gdW5kZWZpbmVkID8gSW5maW5pdHkgOiBvcHRpb25zLmxpbWl0O1xuICAgIGRlbGV0ZSBvcHRpb25zLmxpbWl0O1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5faXRlcmF0ZShvcHRpb25zKTtcbiAgICBsZXQgY29tcGxldGVkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW1pdDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZW1wID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gaXRlcmF0aW9uIHdhcyBjYW5jZWxsZWQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodGVtcC5kb25lKSB7XG4gICAgICAgIGNvbXBsZXRlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh0ZW1wLnZhbHVlKTtcbiAgICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3RlbXAudmFsdWUuaW5kZXhdID0gdGVtcC52YWx1ZTtcbiAgICAgICAgeWllbGQgdGVtcC52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbXBsZXRlZCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgfVxuICAgIGRlbGV0ZSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIHRocm93IG5ldyBFcnJvcihgdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3ZlcnJpZGRlbmApO1xuICB9XG4gIF9maW5pc2hJdGVtICh3cmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICB3cmFwcGVkSXRlbS5yb3dbYXR0cl0gPSBmdW5jKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBhdHRyIG9mIE9iamVjdC5rZXlzKHdyYXBwZWRJdGVtLnJvdykpIHtcbiAgICAgIHRoaXMuX29ic2VydmVkQXR0cmlidXRlc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHdyYXBwZWRJdGVtLnRyaWdnZXIoJ2ZpbmlzaCcpO1xuICB9XG4gIF93cmFwIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy50YWJsZSA9IHRoaXM7XG4gICAgY29uc3QgY2xhc3NPYmogPSB0aGlzLmNsYXNzT2JqO1xuICAgIHJldHVybiBjbGFzc09iaiA/IGNsYXNzT2JqLl93cmFwKG9wdGlvbnMpIDogbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgIGNvbnN0IGFsbEF0dHJzID0ge307XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX2V4cGVjdGVkQXR0cmlidXRlcykge1xuICAgICAgYWxsQXR0cnNbYXR0cl0gPSB0cnVlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGF0dHIgaW4gdGhpcy5fb2JzZXJ2ZWRBdHRyaWJ1dGVzKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIGZvciAoY29uc3QgYXR0ciBpbiB0aGlzLl9kZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zKSB7XG4gICAgICBhbGxBdHRyc1thdHRyXSA9IHRydWU7XG4gICAgfVxuICAgIHJldHVybiBhbGxBdHRycztcbiAgfVxuICBnZXQgYXR0cmlidXRlcyAoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2dldEFsbEF0dHJpYnV0ZXMoKSk7XG4gIH1cbiAgZ2V0IGN1cnJlbnREYXRhICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGF0YTogdGhpcy5fY2FjaGUgfHwgdGhpcy5fcGFydGlhbENhY2hlIHx8IHt9LFxuICAgICAgY29tcGxldGU6ICEhdGhpcy5fY2FjaGVcbiAgICB9O1xuICB9XG4gIGRlcml2ZUF0dHJpYnV0ZSAoYXR0cmlidXRlLCBmdW5jKSB7XG4gICAgdGhpcy5fZGVyaXZlZEF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyaWJ1dGVdID0gZnVuYztcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbiAgX2Rlcml2ZVRhYmxlIChvcHRpb25zKSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKG9wdGlvbnMpO1xuICAgIHRoaXMuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIHRoaXMuX211cmUuc2F2ZVRhYmxlcygpO1xuICAgIHJldHVybiBuZXdUYWJsZTtcbiAgfVxuICBfZ2V0RXhpc3RpbmdUYWJsZSAob3B0aW9ucykge1xuICAgIC8vIENoZWNrIGlmIHRoZSBkZXJpdmVkIHRhYmxlIGhhcyBhbHJlYWR5IGJlZW4gZGVmaW5lZFxuICAgIGNvbnN0IGV4aXN0aW5nVGFibGVJZCA9IHRoaXMuZGVyaXZlZFRhYmxlcy5maW5kKHRhYmxlT2JqID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuZW50cmllcyhvcHRpb25zKS5ldmVyeSgoW29wdGlvbk5hbWUsIG9wdGlvblZhbHVlXSkgPT4ge1xuICAgICAgICBpZiAob3B0aW9uTmFtZSA9PT0gJ3R5cGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlT2JqLmNvbnN0cnVjdG9yLm5hbWUgPT09IG9wdGlvblZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiB0YWJsZU9ialsnXycgKyBvcHRpb25OYW1lXSA9PT0gb3B0aW9uVmFsdWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiAoZXhpc3RpbmdUYWJsZUlkICYmIHRoaXMuX211cmUudGFibGVzW2V4aXN0aW5nVGFibGVJZF0pIHx8IG51bGw7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0FnZ3JlZ2F0ZWRUYWJsZScsXG4gICAgICBhdHRyaWJ1dGVcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9nZXRFeGlzdGluZ1RhYmxlKG9wdGlvbnMpIHx8IHRoaXMuX2Rlcml2ZVRhYmxlKG9wdGlvbnMpO1xuICB9XG4gIGV4cGFuZCAoYXR0cmlidXRlLCBkZWxpbWl0ZXIpIHtcbiAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgdHlwZTogJ0V4cGFuZGVkVGFibGUnLFxuICAgICAgYXR0cmlidXRlLFxuICAgICAgZGVsaW1pdGVyXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgfVxuICBjbG9zZWRGYWNldCAoYXR0cmlidXRlLCB2YWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWVzLm1hcCh2YWx1ZSA9PiB7XG4gICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICB0eXBlOiAnRmlsdGVyZWRUYWJsZScsXG4gICAgICAgIGF0dHJpYnV0ZSxcbiAgICAgICAgdmFsdWVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0RXhpc3RpbmdUYWJsZShvcHRpb25zKSB8fCB0aGlzLl9kZXJpdmVUYWJsZShvcHRpb25zKTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyAqIG9wZW5GYWNldCAoYXR0cmlidXRlLCBsaW1pdCA9IEluZmluaXR5KSB7XG4gICAgY29uc3QgdmFsdWVzID0ge307XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkSXRlbSBvZiB0aGlzLml0ZXJhdGUoeyBsaW1pdCB9KSkge1xuICAgICAgY29uc3QgdmFsdWUgPSB3cmFwcGVkSXRlbS5yb3dbYXR0cmlidXRlXTtcbiAgICAgIGlmICghdmFsdWVzW3ZhbHVlXSkge1xuICAgICAgICB2YWx1ZXNbdmFsdWVdID0gdHJ1ZTtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0eXBlOiAnRmlsdGVyZWRUYWJsZScsXG4gICAgICAgICAgYXR0cmlidXRlLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIHlpZWxkIHRoaXMuX2dldEV4aXN0aW5nVGFibGUob3B0aW9ucykgfHwgdGhpcy5fZGVyaXZlVGFibGUob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGNvbm5lY3QgKG90aGVyVGFibGVMaXN0KSB7XG4gICAgY29uc3QgbmV3VGFibGUgPSB0aGlzLl9tdXJlLmNyZWF0ZVRhYmxlKHsgdHlwZTogJ0Nvbm5lY3RlZFRhYmxlJyB9KTtcbiAgICB0aGlzLl9kZXJpdmVkVGFibGVzW25ld1RhYmxlLnRhYmxlSWRdID0gdHJ1ZTtcbiAgICBmb3IgKGNvbnN0IG90aGVyVGFibGUgb2Ygb3RoZXJUYWJsZUxpc3QpIHtcbiAgICAgIG90aGVyVGFibGUuX2Rlcml2ZWRUYWJsZXNbbmV3VGFibGUudGFibGVJZF0gPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGU7XG4gIH1cbiAgZ2V0IGNsYXNzT2JqICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLl9tdXJlLmNsYXNzZXMpLmZpbmQoY2xhc3NPYmogPT4ge1xuICAgICAgcmV0dXJuIGNsYXNzT2JqLnRhYmxlID09PSB0aGlzO1xuICAgIH0pO1xuICB9XG4gIGdldCBwYXJlbnRUYWJsZXMgKCkge1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX211cmUudGFibGVzKS5yZWR1Y2UoKGFnZywgdGFibGVPYmopID0+IHtcbiAgICAgIGlmICh0YWJsZU9iai5fZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdKSB7XG4gICAgICAgIGFnZy5wdXNoKHRhYmxlT2JqKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhZ2c7XG4gICAgfSwgW10pO1xuICB9XG4gIGdldCBkZXJpdmVkVGFibGVzICgpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fZGVyaXZlZFRhYmxlcykubWFwKHRhYmxlSWQgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RhYmxlSWRdO1xuICAgIH0pO1xuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX2Rlcml2ZWRUYWJsZXMpLmxlbmd0aCA+IDAgfHwgdGhpcy5jbGFzc09iaikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW4ndCBkZWxldGUgaW4tdXNlIHRhYmxlICR7dGhpcy50YWJsZUlkfWApO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHRoaXMucGFyZW50VGFibGVzKSB7XG4gICAgICBkZWxldGUgcGFyZW50VGFibGUuZGVyaXZlZFRhYmxlc1t0aGlzLnRhYmxlSWRdO1xuICAgIH1cbiAgICBkZWxldGUgdGhpcy5fbXVyZS50YWJsZXNbdGhpcy50YWJsZUlkXTtcbiAgICB0aGlzLl9tdXJlLnNhdmVUYWJsZXMoKTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRhYmxlLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilUYWJsZS8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IFRhYmxlO1xuIiwiaW1wb3J0IFRhYmxlIGZyb20gJy4vVGFibGUuanMnO1xuXG5jbGFzcyBTdGF0aWNUYWJsZSBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwgW107XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRoaXMuX2RhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICBjb25zdCBpdGVtID0gdGhpcy5fd3JhcCh7IGluZGV4LCByb3c6IHRoaXMuX2RhdGFbaW5kZXhdIH0pO1xuICAgICAgdGhpcy5fZmluaXNoSXRlbShpdGVtKTtcbiAgICAgIHlpZWxkIGl0ZW07XG4gICAgfVxuICB9XG59XG5leHBvcnQgZGVmYXVsdCBTdGF0aWNUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcblxuY2xhc3MgU3RhdGljRGljdCBleHRlbmRzIFRhYmxlIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgIHRoaXMuX2RhdGEgPSBvcHRpb25zLmRhdGEgfHwge307XG4gICAgaWYgKCF0aGlzLl9uYW1lIHx8ICF0aGlzLl9kYXRhKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5hbWUgYW5kIGRhdGEgYXJlIHJlcXVpcmVkYCk7XG4gICAgfVxuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5uYW1lID0gdGhpcy5fbmFtZTtcbiAgICBvYmouZGF0YSA9IHRoaXMuX2RhdGE7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIChjb25zdCBbaW5kZXgsIHJvd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fZGF0YSkpIHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB0aGlzLl93cmFwKHsgaW5kZXgsIHJvdyB9KTtcbiAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0oaXRlbSk7XG4gICAgICB5aWVsZCBpdGVtO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RhdGljRGljdDtcbiIsImNvbnN0IFNpbmdsZVBhcmVudE1peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluID0gdHJ1ZTtcbiAgICB9XG4gICAgZ2V0IHBhcmVudFRhYmxlICgpIHtcbiAgICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgICAgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJlbnQgdGFibGUgaXMgcmVxdWllcmQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9IGVsc2UgaWYgKHBhcmVudFRhYmxlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgT25seSBvbmUgcGFyZW50IHRhYmxlIGFsbG93ZWQgZm9yIHRhYmxlIG9mIHR5cGUgJHt0aGlzLnR5cGV9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyZW50VGFibGVzWzBdO1xuICAgIH1cbiAgfTtcbn07XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2luZ2xlUGFyZW50TWl4aW4sIFN5bWJvbC5oYXNJbnN0YW5jZSwge1xuICB2YWx1ZTogaSA9PiAhIWkuX2luc3RhbmNlT2ZTaW5nbGVQYXJlbnRNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBTaW5nbGVQYXJlbnRNaXhpbjtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgQWdncmVnYXRlZFRhYmxlIGV4dGVuZHMgU2luZ2xlUGFyZW50TWl4aW4oVGFibGUpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMgPSB7fTtcbiAgICBpZiAob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2F0dHIsIHN0cmluZ2lmaWVkRnVuY10gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucy5yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuaHlkcmF0ZUZ1bmN0aW9uKHN0cmluZ2lmaWVkRnVuYyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoucmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zID0ge307XG4gICAgZm9yIChjb25zdCBbYXR0ciwgZnVuY10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5fcmVkdWNlQXR0cmlidXRlRnVuY3Rpb25zKSkge1xuICAgICAgb2JqLnJlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IHRoaXMuX211cmUuX2RlaHlkcmF0ZUZ1bmN0aW9uKGZ1bmMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5wYXJlbnRUYWJsZS5uYW1lICsgJ+KGpic7XG4gIH1cbiAgZGVyaXZlUmVkdWNlZEF0dHJpYnV0ZSAoYXR0ciwgZnVuYykge1xuICAgIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9uc1thdHRyXSA9IGZ1bmM7XG4gICAgdGhpcy5yZXNldCgpO1xuICB9XG4gIF91cGRhdGVJdGVtIChvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSkge1xuICAgIGZvciAoY29uc3QgW2F0dHIsIGZ1bmNdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykpIHtcbiAgICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0ucm93W2F0dHJdID0gZnVuYyhvcmlnaW5hbFdyYXBwZWRJdGVtLCBuZXdXcmFwcGVkSXRlbSk7XG4gICAgfVxuICAgIG9yaWdpbmFsV3JhcHBlZEl0ZW0udHJpZ2dlcigndXBkYXRlJyk7XG4gIH1cbiAgYXN5bmMgKiBfYnVpbGRDYWNoZSAob3B0aW9ucykge1xuICAgIC8vIFdlIG92ZXJyaWRlIF9idWlsZENhY2hlIGJlY2F1c2Ugc28gdGhhdCBBZ2dyZWdhdGVkVGFibGUgY2FuIHRha2UgYWR2YW50YWdlXG4gICAgLy8gb2YgdGhlIHBhcnRpYWxseS1idWlsdCBjYWNoZSBhcyBpdCBnb2VzLCBhbmQgcG9zdHBvbmUgZmluaXNoaW5nIGl0ZW1zXG4gICAgLy8gdW50aWwgYWZ0ZXIgdGhlIHBhcmVudCB0YWJsZSBoYXMgYmVlbiBmdWxseSBpdGVyYXRlZFxuXG4gICAgLy8gVE9ETzogaW4gbGFyZ2UgZGF0YSBzY2VuYXJpb3MsIHdlIHNob3VsZCBidWlsZCB0aGUgY2FjaGUgLyBpbmRleFxuICAgIC8vIGV4dGVybmFsbHkgb24gZGlza1xuICAgIHRoaXMuX3BhcnRpYWxDYWNoZSA9IHt9O1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZEl0ZW0gb2YgdGhpcy5faXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgdGhpcy5fcGFydGlhbENhY2hlW3dyYXBwZWRJdGVtLmluZGV4XSA9IHdyYXBwZWRJdGVtO1xuICAgICAgLy8gR28gYWhlYWQgYW5kIHlpZWxkIHRoZSB1bmZpbmlzaGVkIGl0ZW07IHRoaXMgbWFrZXMgaXQgcG9zc2libGUgZm9yXG4gICAgICAvLyBjbGllbnQgYXBwcyB0byBiZSBtb3JlIHJlc3BvbnNpdmUgYW5kIHJlbmRlciBwYXJ0aWFsIHJlc3VsdHMsIGJ1dCBhbHNvXG4gICAgICAvLyBtZWFucyB0aGF0IHRoZXkgbmVlZCB0byB3YXRjaCBmb3Igd3JhcHBlZEl0ZW0ub24oJ3VwZGF0ZScpIGV2ZW50c1xuICAgICAgeWllbGQgd3JhcHBlZEl0ZW07XG4gICAgfVxuXG4gICAgLy8gU2Vjb25kIHBhc3M6IG5vdyB0aGF0IHdlJ3ZlIGNvbXBsZXRlZCB0aGUgZnVsbCBpdGVyYXRpb24gb2YgdGhlIHBhcmVudFxuICAgIC8vIHRhYmxlLCB3ZSBjYW4gZmluaXNoIGVhY2ggaXRlbVxuICAgIGZvciAoY29uc3QgaW5kZXggaW4gdGhpcy5fcGFydGlhbENhY2hlKSB7XG4gICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF07XG4gICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICB9XG4gICAgdGhpcy5fY2FjaGUgPSB0aGlzLl9wYXJ0aWFsQ2FjaGU7XG4gICAgZGVsZXRlIHRoaXMuX3BhcnRpYWxDYWNoZTtcbiAgfVxuICBhc3luYyAqIF9pdGVyYXRlIChvcHRpb25zKSB7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgaW5kZXggPSB3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdO1xuICAgICAgaWYgKCF0aGlzLl9wYXJ0aWFsQ2FjaGUpIHtcbiAgICAgICAgLy8gV2Ugd2VyZSByZXNldDsgcmV0dXJuIGltbWVkaWF0ZWx5XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5fcGFydGlhbENhY2hlW2luZGV4XSkge1xuICAgICAgICB0aGlzLl91cGRhdGVJdGVtKHRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0sIHdyYXBwZWRQYXJlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmV3SXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNvbm5lY3RlZFJvd3M6IHsgd3JhcHBlZFBhcmVudCB9XG4gICAgICAgIH0pO1xuICAgICAgICAvLyBSZWR1Y2Ugb3BlcmF0aW9ucyBzdGlsbCBuZWVkIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGZpcnN0IGl0ZW1cbiAgICAgICAgdGhpcy5fdXBkYXRlSXRlbShuZXdJdGVtLCBuZXdJdGVtKTtcbiAgICAgICAgeWllbGQgbmV3SXRlbTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgX2dldEFsbEF0dHJpYnV0ZXMgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl9nZXRBbGxBdHRyaWJ1dGVzKCk7XG4gICAgZm9yIChjb25zdCBhdHRyIGluIHRoaXMuX3JlZHVjZUF0dHJpYnV0ZUZ1bmN0aW9ucykge1xuICAgICAgcmVzdWx0W2F0dHJdID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQWdncmVnYXRlZFRhYmxlO1xuIiwiY29uc3QgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluID0gZnVuY3Rpb24gKHN1cGVyY2xhc3MpIHtcbiAgcmV0dXJuIGNsYXNzIGV4dGVuZHMgc3VwZXJjbGFzcyB7XG4gICAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgdGhpcy5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiA9IHRydWU7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcyA9IG9wdGlvbnMuZHVwbGljYXRlZEF0dHJpYnV0ZXMgfHwge307XG4gICAgfVxuICAgIF90b1Jhd09iamVjdCAoKSB7XG4gICAgICBjb25zdCBvYmogPSBzdXBlci5fdG9SYXdPYmplY3QoKTtcbiAgICAgIG9iai5kdXBsaWNhdGVkQXR0cmlidXRlcyA9IHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgZHVwbGljYXRlQXR0cmlidXRlIChwYXJlbnRJZCwgYXR0cmlidXRlKSB7XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gPSB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0gfHwgW107XG4gICAgICB0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlc1twYXJlbnRJZF0ucHVzaChhdHRyaWJ1dGUpO1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cbiAgICBfZHVwbGljYXRlQXR0cmlidXRlcyAod3JhcHBlZEl0ZW0sIGNvbm5lY3RlZFJvd3MpIHtcbiAgICAgIGZvciAoY29uc3QgW3BhcmVudElkLCBhdHRyXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLl9kdXBsaWNhdGVkQXR0cmlidXRlcykpIHtcbiAgICAgICAgY29uc3QgcGFyZW50TmFtZSA9IHRoaXMuX211cmUudGFibGVzW3BhcmVudElkXS5uYW1lO1xuICAgICAgICB3cmFwcGVkSXRlbS5yb3dbYCR7cGFyZW50TmFtZX0uJHthdHRyfWBdID0gY29ubmVjdGVkUm93c1twYXJlbnRJZF0ucm93W2F0dHJdO1xuICAgICAgfVxuICAgIH1cbiAgICBfZ2V0QWxsQXR0cmlidXRlcyAoKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBzdXBlci5fZ2V0QWxsQXR0cmlidXRlcygpO1xuICAgICAgZm9yIChjb25zdCBbcGFyZW50SWQsIGF0dHJdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuX2R1cGxpY2F0ZWRBdHRyaWJ1dGVzKSkge1xuICAgICAgICBjb25zdCBwYXJlbnROYW1lID0gdGhpcy5fbXVyZS50YWJsZXNbcGFyZW50SWRdLm5hbWU7XG4gICAgICAgIHJlc3VsdFtgJHtwYXJlbnROYW1lfS4ke2F0dHJ9YF0gPSB0cnVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH07XG59O1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiwgU3ltYm9sLmhhc0luc3RhbmNlLCB7XG4gIHZhbHVlOiBpID0+ICEhaS5faW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpblxufSk7XG5leHBvcnQgZGVmYXVsdCBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW47XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgU2luZ2xlUGFyZW50TWl4aW4gZnJvbSAnLi9TaW5nbGVQYXJlbnRNaXhpbi5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgRXhwYW5kZWRUYWJsZSBleHRlbmRzIER1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbihTaW5nbGVQYXJlbnRNaXhpbihUYWJsZSkpIHtcbiAgY29uc3RydWN0b3IgKG9wdGlvbnMpIHtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgICB0aGlzLl9hdHRyaWJ1dGUgPSBvcHRpb25zLmF0dHJpYnV0ZTtcbiAgICBpZiAoIXRoaXMuX2F0dHJpYnV0ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgaXMgcmVxdWlyZWRgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlbGltaXRlciA9IG9wdGlvbnMuZGVsaW1pdGVyIHx8ICcsJztcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IG9iaiA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIG9iai5hdHRyaWJ1dGUgPSB0aGlzLl9hdHRyaWJ1dGU7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuICBnZXQgbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMucGFyZW50VGFibGUubmFtZSArICfihqQnO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGNvbnN0IHBhcmVudFRhYmxlSWQgPSB0aGlzLnBhcmVudFRhYmxlLnRhYmxlSWQ7XG4gICAgZm9yIGF3YWl0IChjb25zdCB3cmFwcGVkUGFyZW50IG9mIHRoaXMucGFyZW50VGFibGUuaXRlcmF0ZShvcHRpb25zKSkge1xuICAgICAgY29uc3QgdmFsdWVzID0gKHdyYXBwZWRQYXJlbnQucm93W3RoaXMuX2F0dHJpYnV0ZV0gfHwgJycpLnNwbGl0KHRoaXMuZGVsaW1pdGVyKTtcbiAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IHt9O1xuICAgICAgICByb3dbdGhpcy5fYXR0cmlidXRlXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgIGNvbm5lY3RlZFJvd3NbcGFyZW50VGFibGVJZF0gPSB3cmFwcGVkUGFyZW50O1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgcm93LCBjb25uZWN0ZWRSb3dzIH0pO1xuICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgdGhpcy5fZmluaXNoSXRlbSh3cmFwcGVkSXRlbSk7XG4gICAgICAgIHlpZWxkIHdyYXBwZWRJdGVtO1xuICAgICAgICBpbmRleCsrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgRXhwYW5kZWRUYWJsZTtcbiIsImltcG9ydCBUYWJsZSBmcm9tICcuL1RhYmxlLmpzJztcbmltcG9ydCBTaW5nbGVQYXJlbnRNaXhpbiBmcm9tICcuL1NpbmdsZVBhcmVudE1peGluLmpzJztcblxuY2xhc3MgRmlsdGVyZWRUYWJsZSBleHRlbmRzIFNpbmdsZVBhcmVudE1peGluKFRhYmxlKSB7XG4gIGNvbnN0cnVjdG9yIChvcHRpb25zKSB7XG4gICAgc3VwZXIob3B0aW9ucyk7XG4gICAgdGhpcy5fYXR0cmlidXRlID0gb3B0aW9ucy5hdHRyaWJ1dGU7XG4gICAgdGhpcy5fdmFsdWUgPSBvcHRpb25zLnZhbHVlO1xuICAgIGlmICghdGhpcy5fYXR0cmlidXRlIHx8ICF0aGlzLl92YWx1ZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhdHRyaWJ1dGUgYW5kIHZhbHVlIGFyZSByZXF1aXJlZGApO1xuICAgIH1cbiAgfVxuICB0b1Jhd09iamVjdCAoKSB7XG4gICAgY29uc3Qgb2JqID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgb2JqLmF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZTtcbiAgICBvYmoudmFsdWUgPSB0aGlzLl92YWx1ZTtcbiAgICByZXR1cm4gb2JqO1xuICB9XG4gIGdldCBuYW1lICgpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5wYXJlbnRUYWJsZS5uYW1lfVske3RoaXMuX3ZhbHVlfV1gO1xuICB9XG4gIGFzeW5jICogX2l0ZXJhdGUgKG9wdGlvbnMpIHtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciBhd2FpdCAoY29uc3Qgd3JhcHBlZFBhcmVudCBvZiB0aGlzLnBhcmVudFRhYmxlLml0ZXJhdGUob3B0aW9ucykpIHtcbiAgICAgIGlmICh3cmFwcGVkUGFyZW50LnJvd1t0aGlzLl9hdHRyaWJ1dGVdID09PSB0aGlzLl92YWx1ZSkge1xuICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoe1xuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIHJvdzogd3JhcHBlZFBhcmVudC5yb3csXG4gICAgICAgICAgY29ubmVjdGVkUm93czogeyB3cmFwcGVkUGFyZW50IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2ZpbmlzaEl0ZW0od3JhcHBlZEl0ZW0pO1xuICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbmV4cG9ydCBkZWZhdWx0IEZpbHRlcmVkVGFibGU7XG4iLCJpbXBvcnQgVGFibGUgZnJvbSAnLi9UYWJsZS5qcyc7XG5pbXBvcnQgRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluIGZyb20gJy4vRHVwbGljYXRhYmxlQXR0cmlidXRlc01peGluLmpzJztcblxuY2xhc3MgQ29ubmVjdGVkVGFibGUgZXh0ZW5kcyBEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4oVGFibGUpIHtcbiAgZ2V0IG5hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLnBhcmVudFRhYmxlcy5tYXAocGFyZW50VGFibGUgPT4gcGFyZW50VGFibGUubmFtZSkuam9pbign4qivJyk7XG4gIH1cbiAgYXN5bmMgKiBfaXRlcmF0ZSAob3B0aW9ucykge1xuICAgIGNvbnN0IHBhcmVudFRhYmxlcyA9IHRoaXMucGFyZW50VGFibGVzO1xuICAgIC8vIFNwaW4gdGhyb3VnaCBhbGwgb2YgdGhlIHBhcmVudFRhYmxlcyBzbyB0aGF0IHRoZWlyIF9jYWNoZSBpcyBwcmUtYnVpbHRcbiAgICBmb3IgKGNvbnN0IHBhcmVudFRhYmxlIG9mIHBhcmVudFRhYmxlcykge1xuICAgICAgaWYgKCFwYXJlbnRUYWJsZS5fY2FjaGUpIHtcbiAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBwYXJlbnRUYWJsZS5pdGVyYXRlKCk7XG4gICAgICAgIGxldCB0ZW1wO1xuICAgICAgICB3aGlsZSAoIXRlbXAgfHwgIXRlbXAuZG9uZSkge1xuICAgICAgICAgIHRlbXAgPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgLy8gTm93IHRoYXQgdGhlIGNhY2hlcyBhcmUgYnVpbHQsIGp1c3QgaXRlcmF0ZSB0aGVpciBrZXlzIGRpcmVjdGx5XG4gICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZSBvZiBwYXJlbnRUYWJsZXMpIHtcbiAgICAgIGlmICghcGFyZW50VGFibGUuX2NhY2hlKSB7XG4gICAgICAgIC8vIE9uZSBvZiB0aGUgcGFyZW50IHRhYmxlcyB3YXMgcmVzZXQ7IHJldHVybiBpbW1lZGlhdGVseVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGluZGV4IGluIHBhcmVudFRhYmxlLl9jYWNoZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3BhcnRpYWxDYWNoZVtpbmRleF0pIHtcbiAgICAgICAgICBjb25zdCBjb25uZWN0ZWRSb3dzID0ge307XG4gICAgICAgICAgZm9yIChjb25zdCBwYXJlbnRUYWJsZTIgb2YgcGFyZW50VGFibGVzKSB7XG4gICAgICAgICAgICBjb25uZWN0ZWRSb3dzW3BhcmVudFRhYmxlMi50YWJsZUlkXSA9IHBhcmVudFRhYmxlMi5fY2FjaGVbaW5kZXhdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCB3cmFwcGVkSXRlbSA9IHRoaXMuX3dyYXAoeyBpbmRleCwgY29ubmVjdGVkUm93cyB9KTtcbiAgICAgICAgICB0aGlzLl9kdXBsaWNhdGVBdHRyaWJ1dGVzKHdyYXBwZWRJdGVtLCBjb25uZWN0ZWRSb3dzKTtcbiAgICAgICAgICB0aGlzLl9maW5pc2hJdGVtKHdyYXBwZWRJdGVtKTtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgQ29ubmVjdGVkVGFibGU7XG4iLCJpbXBvcnQgSW50cm9zcGVjdGFibGUgZnJvbSAnLi4vQ29tbW9uL0ludHJvc3BlY3RhYmxlLmpzJztcblxuY2xhc3MgR2VuZXJpY0NsYXNzIGV4dGVuZHMgSW50cm9zcGVjdGFibGUge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5fbXVyZSA9IG9wdGlvbnMubXVyZTtcbiAgICB0aGlzLmNsYXNzSWQgPSBvcHRpb25zLmNsYXNzSWQ7XG4gICAgdGhpcy50YWJsZUlkID0gb3B0aW9ucy50YWJsZUlkO1xuICAgIGlmICghdGhpcy5fbXVyZSB8fCAhdGhpcy5jbGFzc0lkIHx8ICF0aGlzLnRhYmxlSWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX211cmUsIGNsYXNzSWQsIGFuZCB0YWJsZUlkIGFyZSByZXF1aXJlZGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lIHx8IG51bGw7XG4gICAgdGhpcy5hbm5vdGF0aW9uID0gb3B0aW9ucy5hbm5vdGF0aW9uIHx8ICcnO1xuICB9XG4gIF90b1Jhd09iamVjdCAoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHRhYmxlSWQ6IHRoaXMudGFibGVJZCxcbiAgICAgIGNsYXNzTmFtZTogdGhpcy5fY2xhc3NOYW1lLFxuICAgICAgYW5ub3RhdGlvbjogdGhpcy5hbm5vdGF0aW9uXG4gICAgfTtcbiAgfVxuICBzZXRDbGFzc05hbWUgKHZhbHVlKSB7XG4gICAgdGhpcy5fY2xhc3NOYW1lID0gdmFsdWU7XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGdldCBoYXNDdXN0b21OYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY2xhc3NOYW1lICE9PSBudWxsO1xuICB9XG4gIGdldCBjbGFzc05hbWUgKCkge1xuICAgIHJldHVybiB0aGlzLl9jbGFzc05hbWUgfHwgdGhpcy50YWJsZS5uYW1lO1xuICB9XG4gIGdldEhhc2hUYWJsZSAoYXR0cmlidXRlKSB7XG4gICAgcmV0dXJuIGF0dHJpYnV0ZSA9PT0gbnVsbCA/IHRoaXMudGFibGUgOiB0aGlzLnRhYmxlLmFnZ3JlZ2F0ZShhdHRyaWJ1dGUpO1xuICB9XG4gIGdldCB0YWJsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX211cmUudGFibGVzW3RoaXMudGFibGVJZF07XG4gIH1cbiAgX3dyYXAgKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IHRoaXMuX211cmUuV1JBUFBFUlMuR2VuZXJpY1dyYXBwZXIob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNOb2RlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ05vZGVDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgaW50ZXJwcmV0QXNFZGdlcyAoKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHRoaXMuX3RvUmF3T2JqZWN0KCk7XG4gICAgb3B0aW9ucy50eXBlID0gJ0VkZ2VDbGFzcyc7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Mob3B0aW9ucyk7XG4gIH1cbiAgYWdncmVnYXRlIChhdHRyaWJ1dGUpIHtcbiAgICBjb25zdCBuZXdUYWJsZSA9IHRoaXMudGFibGUuYWdncmVnYXRlKGF0dHJpYnV0ZSk7XG4gICAgcmV0dXJuIHRoaXMuX211cmUubmV3Q2xhc3Moe1xuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZCxcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnXG4gICAgfSk7XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuY2xhc3NJZF07XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoR2VuZXJpY0NsYXNzLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilDbGFzcy8uZXhlYyh0aGlzLm5hbWUpWzFdO1xuICB9XG59KTtcbmV4cG9ydCBkZWZhdWx0IEdlbmVyaWNDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBOb2RlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuZWRnZUNsYXNzSWRzID0gb3B0aW9ucy5lZGdlQ2xhc3NJZHMgfHwge307XG4gICAgdGhpcy5XcmFwcGVyID0gdGhpcy5fbXVyZS5XUkFQUEVSUy5Ob2RlV3JhcHBlcjtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuICAgIHJlc3VsdC5lZGdlQ2xhc3NJZHMgPSB0aGlzLmVkZ2VDbGFzc0lkcztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIGNvbnN0IGVkZ2VDbGFzc0lkcyA9IE9iamVjdC5rZXlzKHRoaXMuZWRnZUNsYXNzSWRzKTtcbiAgICBjb25zdCBvcHRpb25zID0gc3VwZXIuX3RvUmF3T2JqZWN0KCk7XG4gICAgaWYgKGVkZ2VDbGFzc0lkcy5sZW5ndGggPiAyKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZWRnZUNsYXNzSWRzLmxlbmd0aCA9PT0gMSB8fCBlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZUVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMF1dO1xuICAgICAgICBvcHRpb25zLnNvdXJjZU5vZGVJZCA9IHNvdXJjZUVkZ2VDbGFzcy5zb3VyY2VOb2RlSWQ7XG4gICAgICAgIG9wdGlvbnMuc291cmNlTm9kZUF0dHIgPSBzb3VyY2VFZGdlQ2xhc3Muc291cmNlTm9kZUF0dHI7XG4gICAgICAgIG9wdGlvbnMuc291cmNlRWRnZUF0dHIgPSBzb3VyY2VFZGdlQ2xhc3MudGFyZ2V0Tm9kZUF0dHI7XG4gICAgICAgIHNvdXJjZUVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlZGdlQ2xhc3NJZHMubGVuZ3RoID09PSAyKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldEVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZHNbMV1dO1xuICAgICAgICBvcHRpb25zLnRhcmdldE5vZGVJZCA9IHRhcmdldEVkZ2VDbGFzcy50YXJnZXROb2RlSWQ7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0Tm9kZUF0dHIgPSB0YXJnZXRFZGdlQ2xhc3MudGFyZ2V0Tm9kZUF0dHI7XG4gICAgICAgIG9wdGlvbnMudGFyZ2V0RWRnZUF0dHIgPSB0YXJnZXRFZGdlQ2xhc3Muc291cmNlTm9kZUF0dHI7XG4gICAgICAgIHRhcmdldEVkZ2VDbGFzcy5kZWxldGUoKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kZWxldGUoKTtcbiAgICBkZWxldGUgb3B0aW9ucy5jbGFzc0lkO1xuICAgIG9wdGlvbnMudHlwZSA9ICdFZGdlQ2xhc3MnO1xuICAgIHJldHVybiB0aGlzLl9tdXJlLm5ld0NsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBvdGhlck5vZGVDbGFzcywgZGlyZWN0ZWQsIGF0dHJpYnV0ZSwgb3RoZXJBdHRyaWJ1dGUgfSkge1xuICAgIGNvbnN0IHRoaXNIYXNoID0gdGhpcy5nZXRIYXNoVGFibGUoYXR0cmlidXRlKTtcbiAgICBjb25zdCBvdGhlckhhc2ggPSBvdGhlck5vZGVDbGFzcy5nZXRIYXNoVGFibGUob3RoZXJBdHRyaWJ1dGUpO1xuICAgIGNvbnN0IGNvbm5lY3RlZFRhYmxlID0gdGhpc0hhc2guY29ubmVjdChbb3RoZXJIYXNoXSk7XG4gICAgY29uc3QgbmV3RWRnZUNsYXNzID0gdGhpcy5fbXVyZS5jcmVhdGVDbGFzcyh7XG4gICAgICB0eXBlOiAnRWRnZUNsYXNzJyxcbiAgICAgIHRhYmxlSWQ6IGNvbm5lY3RlZFRhYmxlLnRhYmxlSWQsXG4gICAgICBkaXJlY3RlZCxcbiAgICAgIHNvdXJjZUNsYXNzSWQ6IHRoaXMuY2xhc3NJZCxcbiAgICAgIHNvdXJjZU5vZGVBdHRyOiBhdHRyaWJ1dGUsXG4gICAgICB0YXJnZXRDbGFzc0lkOiBvdGhlck5vZGVDbGFzcy5jbGFzc0lkLFxuICAgICAgdGFyZ2V0Tm9kZUF0dHI6IG90aGVyQXR0cmlidXRlXG4gICAgfSk7XG4gICAgdGhpcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICBvdGhlck5vZGVDbGFzcy5lZGdlQ2xhc3NJZHNbbmV3RWRnZUNsYXNzLmNsYXNzSWRdID0gdHJ1ZTtcbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gICAgcmV0dXJuIG5ld0VkZ2VDbGFzcztcbiAgfVxuICBjb25uZWN0VG9FZGdlQ2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBlZGdlQ2xhc3MgPSBvcHRpb25zLmVkZ2VDbGFzcztcbiAgICBkZWxldGUgb3B0aW9ucy5lZGdlQ2xhc3M7XG4gICAgb3B0aW9ucy5ub2RlQ2xhc3MgPSB0aGlzO1xuICAgIHJldHVybiBlZGdlQ2xhc3MuY29ubmVjdFRvTm9kZUNsYXNzKG9wdGlvbnMpO1xuICB9XG4gIGRpc2Nvbm5lY3RBbGxFZGdlcyAoKSB7XG4gICAgZm9yIChjb25zdCBlZGdlQ2xhc3NJZCBvZiBPYmplY3Qua2V5cyh0aGlzLmVkZ2VDbGFzc0lkcykpIHtcbiAgICAgIGNvbnN0IGVkZ2VDbGFzcyA9IHRoaXMuX211cmUuY2xhc3Nlc1tlZGdlQ2xhc3NJZF07XG4gICAgICBpZiAoZWRnZUNsYXNzLnNvdXJjZUNsYXNzSWQgPT09IHRoaXMuY2xhc3NJZCkge1xuICAgICAgICBlZGdlQ2xhc3MuZGlzY29ubmVjdFNvdXJjZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGVkZ2VDbGFzcy50YXJnZXRDbGFzc0lkID09PSB0aGlzLmNsYXNzSWQpIHtcbiAgICAgICAgZWRnZUNsYXNzLmRpc2Nvbm5lY3RUYXJnZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlICgpIHtcbiAgICB0aGlzLmRpc2Nvbm5lY3RBbGxFZGdlcygpO1xuICAgIHN1cGVyLmRlbGV0ZSgpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVDbGFzcztcbiIsImltcG9ydCBHZW5lcmljQ2xhc3MgZnJvbSAnLi9HZW5lcmljQ2xhc3MuanMnO1xuXG5jbGFzcyBFZGdlQ2xhc3MgZXh0ZW5kcyBHZW5lcmljQ2xhc3Mge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgIHRoaXMuV3JhcHBlciA9IHRoaXMuX211cmUuV1JBUFBFUlMuRWRnZVdyYXBwZXI7XG5cbiAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSBvcHRpb25zLnNvdXJjZUNsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnNvdXJjZU5vZGVBdHRyID0gb3B0aW9ucy5zb3VyY2VOb2RlQXR0ciB8fCBudWxsO1xuICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSBvcHRpb25zLnNvdXJjZUVkZ2VBdHRyIHx8IG51bGw7XG5cbiAgICB0aGlzLnRhcmdldENsYXNzSWQgPSBvcHRpb25zLnRhcmdldENsYXNzSWQgfHwgbnVsbDtcbiAgICB0aGlzLnRhcmdldE5vZGVBdHRyID0gb3B0aW9ucy50YXJnZXROb2RlQXR0ciB8fCBudWxsO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBvcHRpb25zLnRhcmdldEVkZ2VBdHRyIHx8IG51bGw7XG5cbiAgICB0aGlzLmRpcmVjdGVkID0gb3B0aW9ucy5kaXJlY3RlZCB8fCBmYWxzZTtcbiAgfVxuICBfdG9SYXdPYmplY3QgKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IHN1cGVyLl90b1Jhd09iamVjdCgpO1xuXG4gICAgcmVzdWx0LnNvdXJjZUNsYXNzSWQgPSB0aGlzLnNvdXJjZUNsYXNzSWQ7XG4gICAgcmVzdWx0LnNvdXJjZU5vZGVBdHRyID0gdGhpcy5zb3VyY2VOb2RlQXR0cjtcbiAgICByZXN1bHQuc291cmNlRWRnZUF0dHIgPSB0aGlzLnNvdXJjZUVkZ2VBdHRyO1xuXG4gICAgcmVzdWx0LnRhcmdldENsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgcmVzdWx0LnRhcmdldE5vZGVBdHRyID0gdGhpcy50YXJnZXROb2RlQXR0cjtcbiAgICByZXN1bHQudGFyZ2V0RWRnZUF0dHIgPSB0aGlzLnRhcmdldEVkZ2VBdHRyO1xuXG4gICAgcmVzdWx0LmRpcmVjdGVkID0gdGhpcy5kaXJlY3RlZDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIGludGVycHJldEFzTm9kZXMgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgdW5pbXBsZW1lbnRlZGApO1xuICB9XG4gIGludGVycHJldEFzRWRnZXMgKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9XG4gIGNvbm5lY3RUb05vZGVDbGFzcyAoeyBub2RlQ2xhc3MsIGRpcmVjdGlvbiwgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KSB7XG4gICAgaWYgKGRpcmVjdGlvbiAhPT0gJ3NvdXJjZScgJiYgZGlyZWN0aW9uICE9PSAndGFyZ2V0Jykge1xuICAgICAgZGlyZWN0aW9uID0gdGhpcy50YXJnZXRDbGFzc0lkID09PSBudWxsID8gJ3RhcmdldCcgOiAnc291cmNlJztcbiAgICB9XG4gICAgaWYgKGRpcmVjdGlvbiA9PT0gJ3RhcmdldCcpIHtcbiAgICAgIHRoaXMuY29ubmVjdFRhcmdldCh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jb25uZWN0U291cmNlKHsgbm9kZUNsYXNzLCBub2RlQXR0cmlidXRlLCBlZGdlQXR0cmlidXRlIH0pO1xuICAgIH1cbiAgICB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7XG4gIH1cbiAgdG9nZ2xlTm9kZURpcmVjdGlvbiAoc291cmNlQ2xhc3NJZCkge1xuICAgIGlmICghc291cmNlQ2xhc3NJZCkge1xuICAgICAgdGhpcy5kaXJlY3RlZCA9IGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRpcmVjdGVkID0gdHJ1ZTtcbiAgICAgIGlmIChzb3VyY2VDbGFzc0lkICE9PSB0aGlzLnNvdXJjZUNsYXNzSWQpIHtcbiAgICAgICAgaWYgKHNvdXJjZUNsYXNzSWQgIT09IHRoaXMudGFyZ2V0Q2xhc3NJZCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3Qgc3dhcCB0byB1bmNvbm5lY3RlZCBjbGFzcyBpZDogJHtzb3VyY2VDbGFzc0lkfWApO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0ZW1wID0gdGhpcy5zb3VyY2VDbGFzc0lkO1xuICAgICAgICB0aGlzLnNvdXJjZUNsYXNzSWQgPSB0aGlzLnRhcmdldENsYXNzSWQ7XG4gICAgICAgIHRoaXMudGFyZ2V0Q2xhc3NJZCA9IHRlbXA7XG4gICAgICAgIHRlbXAgPSB0aGlzLnNvdXJjZU5vZGVBdHRyO1xuICAgICAgICB0aGlzLnNvdXJjZU5vZGVBdHRyID0gdGhpcy50YXJnZXROb2RlQXR0cjtcbiAgICAgICAgdGhpcy50YXJnZXROb2RlQXR0ciA9IHRlbXA7XG4gICAgICAgIHRlbXAgPSB0aGlzLmludGVybWVkaWF0ZVNvdXJjZXM7XG4gICAgICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSB0aGlzLnRhcmdldEVkZ2VBdHRyO1xuICAgICAgICB0aGlzLnRhcmdldEVkZ2VBdHRyID0gdGVtcDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpO1xuICB9XG4gIGNvbm5lY3RTb3VyY2UgKHtcbiAgICBub2RlQ2xhc3MsXG4gICAgbm9kZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgZWRnZUF0dHJpYnV0ZSA9IG51bGwsXG4gICAgc2tpcFNhdmUgPSBmYWxzZVxuICB9ID0ge30pIHtcbiAgICBpZiAodGhpcy5zb3VyY2VDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RTb3VyY2UoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy5zb3VyY2VDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSBub2RlQXR0cmlidXRlO1xuICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSBlZGdlQXR0cmlidXRlO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBjb25uZWN0VGFyZ2V0ICh7IG5vZGVDbGFzcywgbm9kZUF0dHJpYnV0ZSwgZWRnZUF0dHJpYnV0ZSwgc2tpcFNhdmUgPSBmYWxzZSB9ID0ge30pIHtcbiAgICBpZiAodGhpcy50YXJnZXRDbGFzc0lkKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3RUYXJnZXQoeyBza2lwU2F2ZTogdHJ1ZSB9KTtcbiAgICB9XG4gICAgdGhpcy50YXJnZXRDbGFzc0lkID0gbm9kZUNsYXNzLmNsYXNzSWQ7XG4gICAgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMudGFyZ2V0Q2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF0gPSB0cnVlO1xuICAgIHRoaXMudGFyZ2V0Tm9kZUF0dHIgPSBub2RlQXR0cmlidXRlO1xuICAgIHRoaXMudGFyZ2V0RWRnZUF0dHIgPSBlZGdlQXR0cmlidXRlO1xuXG4gICAgaWYgKCFza2lwU2F2ZSkgeyB0aGlzLl9tdXJlLnNhdmVDbGFzc2VzKCk7IH1cbiAgfVxuICBkaXNjb25uZWN0U291cmNlICh7IHNraXBTYXZlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnNvdXJjZUNsYXNzSWRdKSB7XG4gICAgICBkZWxldGUgdGhpcy5fbXVyZS5jbGFzc2VzW3RoaXMuc291cmNlQ2xhc3NJZF0uZWRnZUNsYXNzSWRzW3RoaXMuY2xhc3NJZF07XG4gICAgfVxuICAgIHRoaXMuc291cmNlTm9kZUF0dHIgPSBudWxsO1xuICAgIHRoaXMuc291cmNlRWRnZUF0dHIgPSBudWxsO1xuICAgIGlmICghc2tpcFNhdmUpIHsgdGhpcy5fbXVyZS5zYXZlQ2xhc3NlcygpOyB9XG4gIH1cbiAgZGlzY29ubmVjdFRhcmdldCAoeyBza2lwU2F2ZSA9IGZhbHNlIH0gPSB7fSkge1xuICAgIGlmICh0aGlzLl9tdXJlLmNsYXNzZXNbdGhpcy50YXJnZXRDbGFzc0lkXSkge1xuICAgICAgZGVsZXRlIHRoaXMuX211cmUuY2xhc3Nlc1t0aGlzLnRhcmdldENsYXNzSWRdLmVkZ2VDbGFzc0lkc1t0aGlzLmNsYXNzSWRdO1xuICAgIH1cbiAgICB0aGlzLnRhcmdldE5vZGVBdHRyID0gbnVsbDtcbiAgICB0aGlzLnRhcmdldEVkZ2VBdHRyID0gbnVsbDtcbiAgICBpZiAoIXNraXBTYXZlKSB7IHRoaXMuX211cmUuc2F2ZUNsYXNzZXMoKTsgfVxuICB9XG4gIGRlbGV0ZSAoKSB7XG4gICAgdGhpcy5kaXNjb25uZWN0U291cmNlKHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgdGhpcy5kaXNjb25uZWN0VGFyZ2V0KHsgc2tpcFNhdmU6IHRydWUgfSk7XG4gICAgc3VwZXIuZGVsZXRlKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRWRnZUNsYXNzO1xuIiwiaW1wb3J0IFRyaWdnZXJhYmxlTWl4aW4gZnJvbSAnLi4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0IEludHJvc3BlY3RhYmxlIGZyb20gJy4uL0NvbW1vbi9JbnRyb3NwZWN0YWJsZS5qcyc7XG5cbmNsYXNzIEdlbmVyaWNXcmFwcGVyIGV4dGVuZHMgVHJpZ2dlcmFibGVNaXhpbihJbnRyb3NwZWN0YWJsZSkge1xuICBjb25zdHJ1Y3RvciAob3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5pbmRleCA9IG9wdGlvbnMuaW5kZXg7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbmRleCBpcyByZXF1aXJlZGApO1xuICAgIH1cbiAgICB0aGlzLnJvdyA9IG9wdGlvbnMucm93IHx8IHt9O1xuICAgIHRoaXMuY29ubmVjdGVkUm93cyA9IG9wdGlvbnMuY29ubmVjdGVkUm93cyB8fCB7fTtcbiAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEdlbmVyaWNXcmFwcGVyLCAndHlwZScsIHtcbiAgZ2V0ICgpIHtcbiAgICByZXR1cm4gLyguKilXcmFwcGVyLy5leGVjKHRoaXMubmFtZSlbMV07XG4gIH1cbn0pO1xuZXhwb3J0IGRlZmF1bHQgR2VuZXJpY1dyYXBwZXI7XG4iLCJpbXBvcnQgR2VuZXJpY1dyYXBwZXIgZnJvbSAnLi9HZW5lcmljV3JhcHBlci5qcyc7XG5cbmNsYXNzIE5vZGVXcmFwcGVyIGV4dGVuZHMgR2VuZXJpY1dyYXBwZXIge1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGVXcmFwcGVyO1xuIiwiaW1wb3J0IEdlbmVyaWNXcmFwcGVyIGZyb20gJy4vR2VuZXJpY1dyYXBwZXIuanMnO1xuXG5jbGFzcyBFZGdlV3JhcHBlciBleHRlbmRzIEdlbmVyaWNXcmFwcGVyIHtcblxufVxuXG5leHBvcnQgZGVmYXVsdCBFZGdlV3JhcHBlcjtcbiIsImNsYXNzIEluTWVtb3J5SW5kZXgge1xuICBjb25zdHJ1Y3RvciAoeyBlbnRyaWVzID0ge30sIGNvbXBsZXRlID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgdGhpcy5lbnRyaWVzID0gZW50cmllcztcbiAgICB0aGlzLmNvbXBsZXRlID0gY29tcGxldGU7XG4gIH1cbiAgYXN5bmMgdG9SYXdPYmplY3QgKCkge1xuICAgIHJldHVybiB0aGlzLmVudHJpZXM7XG4gIH1cbiAgYXN5bmMgKiBpdGVyRW50cmllcyAoKSB7XG4gICAgZm9yIChjb25zdCBbaGFzaCwgdmFsdWVMaXN0XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCB7IGhhc2gsIHZhbHVlTGlzdCB9O1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJIYXNoZXMgKCkge1xuICAgIGZvciAoY29uc3QgaGFzaCBvZiBPYmplY3Qua2V5cyh0aGlzLmVudHJpZXMpKSB7XG4gICAgICB5aWVsZCBoYXNoO1xuICAgIH1cbiAgfVxuICBhc3luYyAqIGl0ZXJWYWx1ZUxpc3RzICgpIHtcbiAgICBmb3IgKGNvbnN0IHZhbHVlTGlzdCBvZiBPYmplY3QudmFsdWVzKHRoaXMuZW50cmllcykpIHtcbiAgICAgIHlpZWxkIHZhbHVlTGlzdDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0VmFsdWVMaXN0IChoYXNoKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllc1toYXNoXSB8fCBbXTtcbiAgfVxuICBhc3luYyBhZGRWYWx1ZSAoaGFzaCwgdmFsdWUpIHtcbiAgICAvLyBUT0RPOiBhZGQgc29tZSBraW5kIG9mIHdhcm5pbmcgaWYgdGhpcyBpcyBnZXR0aW5nIGJpZz9cbiAgICB0aGlzLmVudHJpZXNbaGFzaF0gPSBhd2FpdCB0aGlzLmdldFZhbHVlTGlzdChoYXNoKTtcbiAgICBpZiAodGhpcy5lbnRyaWVzW2hhc2hdLmluZGV4T2YodmFsdWUpID09PSAtMSkge1xuICAgICAgdGhpcy5lbnRyaWVzW2hhc2hdLnB1c2godmFsdWUpO1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgSW5NZW1vcnlJbmRleDtcbiIsImltcG9ydCBtaW1lIGZyb20gJ21pbWUtdHlwZXMnO1xuaW1wb3J0IGRhdGFsaWIgZnJvbSAnZGF0YWxpYic7XG5pbXBvcnQgc2hhMSBmcm9tICdzaGExJztcbmltcG9ydCBUcmlnZ2VyYWJsZU1peGluIGZyb20gJy4vQ29tbW9uL1RyaWdnZXJhYmxlTWl4aW4uanMnO1xuaW1wb3J0ICogYXMgVEFCTEVTIGZyb20gJy4vVGFibGVzL1RhYmxlcy5qcyc7XG5pbXBvcnQgKiBhcyBDTEFTU0VTIGZyb20gJy4vQ2xhc3Nlcy9DbGFzc2VzLmpzJztcbmltcG9ydCAqIGFzIFdSQVBQRVJTIGZyb20gJy4vV3JhcHBlcnMvV3JhcHBlcnMuanMnO1xuaW1wb3J0ICogYXMgSU5ERVhFUyBmcm9tICcuL0luZGV4ZXMvSW5kZXhlcy5qcyc7XG5cbmxldCBORVhUX0NMQVNTX0lEID0gMTtcbmxldCBORVhUX1RBQkxFX0lEID0gMTtcblxuY2xhc3MgTXVyZSBleHRlbmRzIFRyaWdnZXJhYmxlTWl4aW4oY2xhc3Mge30pIHtcbiAgY29uc3RydWN0b3IgKEZpbGVSZWFkZXIsIGxvY2FsU3RvcmFnZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5GaWxlUmVhZGVyID0gRmlsZVJlYWRlcjsgLy8gZWl0aGVyIHdpbmRvdy5GaWxlUmVhZGVyIG9yIG9uZSBmcm9tIE5vZGVcbiAgICB0aGlzLmxvY2FsU3RvcmFnZSA9IGxvY2FsU3RvcmFnZTsgLy8gZWl0aGVyIHdpbmRvdy5sb2NhbFN0b3JhZ2Ugb3IgbnVsbFxuICAgIHRoaXMubWltZSA9IG1pbWU7IC8vIGV4cG9zZSBhY2Nlc3MgdG8gbWltZSBsaWJyYXJ5LCBzaW5jZSB3ZSdyZSBidW5kbGluZyBpdCBhbnl3YXlcblxuICAgIHRoaXMuZGVidWcgPSBmYWxzZTsgLy8gU2V0IG11cmUuZGVidWcgdG8gdHJ1ZSB0byBkZWJ1ZyBzdHJlYW1zXG5cbiAgICAvLyBleHRlbnNpb25zIHRoYXQgd2Ugd2FudCBkYXRhbGliIHRvIGhhbmRsZVxuICAgIHRoaXMuREFUQUxJQl9GT1JNQVRTID0ge1xuICAgICAgJ2pzb24nOiAnanNvbicsXG4gICAgICAnY3N2JzogJ2NzdicsXG4gICAgICAndHN2JzogJ3RzdicsXG4gICAgICAndG9wb2pzb24nOiAndG9wb2pzb24nLFxuICAgICAgJ3RyZWVqc29uJzogJ3RyZWVqc29uJ1xuICAgIH07XG5cbiAgICAvLyBBY2Nlc3MgdG8gY29yZSBjbGFzc2VzIHZpYSB0aGUgbWFpbiBsaWJyYXJ5IGhlbHBzIGF2b2lkIGNpcmN1bGFyIGltcG9ydHNcbiAgICB0aGlzLlRBQkxFUyA9IFRBQkxFUztcbiAgICB0aGlzLkNMQVNTRVMgPSBDTEFTU0VTO1xuICAgIHRoaXMuV1JBUFBFUlMgPSBXUkFQUEVSUztcbiAgICB0aGlzLklOREVYRVMgPSBJTkRFWEVTO1xuXG4gICAgLy8gRGVmYXVsdCBuYW1lZCBmdW5jdGlvbnNcbiAgICB0aGlzLk5BTUVEX0ZVTkNUSU9OUyA9IHtcbiAgICAgIGlkZW50aXR5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkgeyB5aWVsZCB3cmFwcGVkSXRlbS5yYXdJdGVtOyB9LFxuICAgICAga2V5OiBmdW5jdGlvbiAqICh3cmFwcGVkSXRlbSkge1xuICAgICAgICBpZiAoIXdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgICF3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQgfHxcbiAgICAgICAgICAgIHR5cGVvZiB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LndyYXBwZWRQYXJlbnQucmF3SXRlbSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBHcmFuZHBhcmVudCBpcyBub3QgYW4gb2JqZWN0IC8gYXJyYXlgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJlbnRUeXBlID0gdHlwZW9mIHdyYXBwZWRJdGVtLndyYXBwZWRQYXJlbnQucmF3SXRlbTtcbiAgICAgICAgaWYgKCEocGFyZW50VHlwZSA9PT0gJ251bWJlcicgfHwgcGFyZW50VHlwZSA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUGFyZW50IGlzbid0IGEga2V5IC8gaW5kZXhgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB5aWVsZCB3cmFwcGVkSXRlbS53cmFwcGVkUGFyZW50LnJhd0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBkZWZhdWx0RmluaXNoOiBmdW5jdGlvbiAqICh0aGlzV3JhcHBlZEl0ZW0sIG90aGVyV3JhcHBlZEl0ZW0pIHtcbiAgICAgICAgeWllbGQge1xuICAgICAgICAgIGxlZnQ6IHRoaXNXcmFwcGVkSXRlbS5yYXdJdGVtLFxuICAgICAgICAgIHJpZ2h0OiBvdGhlcldyYXBwZWRJdGVtLnJhd0l0ZW1cbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICBzaGExOiByYXdJdGVtID0+IHNoYTEoSlNPTi5zdHJpbmdpZnkocmF3SXRlbSkpLFxuICAgICAgbm9vcDogKCkgPT4ge31cbiAgICB9O1xuXG4gICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgZWFjaCBvZiBvdXIgZGF0YSBzb3VyY2VzXG4gICAgdGhpcy50YWJsZXMgPSB0aGlzLmh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy5UQUJMRVMpO1xuICAgIE5FWFRfVEFCTEVfSUQgPSBPYmplY3Qua2V5cyh0aGlzLnRhYmxlcylcbiAgICAgIC5yZWR1Y2UoKGhpZ2hlc3ROdW0sIHRhYmxlSWQpID0+IHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KGhpZ2hlc3ROdW0sIHBhcnNlSW50KHRhYmxlSWQubWF0Y2goL3RhYmxlKFxcZCopLylbMV0pKTtcbiAgICAgIH0sIDApICsgMTtcblxuICAgIC8vIE9iamVjdCBjb250YWluaW5nIG91ciBjbGFzcyBzcGVjaWZpY2F0aW9uc1xuICAgIHRoaXMuY2xhc3NlcyA9IHRoaXMuaHlkcmF0ZSgnbXVyZV9jbGFzc2VzJywgdGhpcy5DTEFTU0VTKTtcbiAgICBORVhUX0NMQVNTX0lEID0gT2JqZWN0LmtleXModGhpcy5jbGFzc2VzKVxuICAgICAgLnJlZHVjZSgoaGlnaGVzdE51bSwgY2xhc3NJZCkgPT4ge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoaGlnaGVzdE51bSwgcGFyc2VJbnQoY2xhc3NJZC5tYXRjaCgvY2xhc3MoXFxkKikvKVsxXSkpO1xuICAgICAgfSwgMCkgKyAxO1xuICB9XG5cbiAgc2F2ZVRhYmxlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfdGFibGVzJywgdGhpcy50YWJsZXMpO1xuICAgIHRoaXMudHJpZ2dlcigndGFibGVVcGRhdGUnKTtcbiAgfVxuICBzYXZlQ2xhc3NlcyAoKSB7XG4gICAgdGhpcy5kZWh5ZHJhdGUoJ211cmVfY2xhc3NlcycsIHRoaXMuY2xhc3Nlcyk7XG4gICAgdGhpcy50cmlnZ2VyKCdjbGFzc1VwZGF0ZScpO1xuICB9XG5cbiAgaHlkcmF0ZSAoc3RvcmFnZUtleSwgVFlQRVMpIHtcbiAgICBsZXQgY29udGFpbmVyID0gdGhpcy5sb2NhbFN0b3JhZ2UgJiYgdGhpcy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShzdG9yYWdlS2V5KTtcbiAgICBjb250YWluZXIgPSBjb250YWluZXIgPyBKU09OLnBhcnNlKGNvbnRhaW5lcikgOiB7fTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhjb250YWluZXIpKSB7XG4gICAgICBjb25zdCB0eXBlID0gdmFsdWUudHlwZTtcbiAgICAgIGRlbGV0ZSB2YWx1ZS50eXBlO1xuICAgICAgdmFsdWUubXVyZSA9IHRoaXM7XG4gICAgICBjb250YWluZXJba2V5XSA9IG5ldyBUWVBFU1t0eXBlXSh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiBjb250YWluZXI7XG4gIH1cbiAgZGVoeWRyYXRlIChzdG9yYWdlS2V5LCBjb250YWluZXIpIHtcbiAgICBpZiAodGhpcy5sb2NhbFN0b3JhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHt9O1xuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoY29udGFpbmVyKSkge1xuICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlLl90b1Jhd09iamVjdCgpO1xuICAgICAgICByZXN1bHRba2V5XS50eXBlID0gdmFsdWUuY29uc3RydWN0b3IubmFtZTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gICAgfVxuICB9XG4gIGh5ZHJhdGVGdW5jdGlvbiAoc3RyaW5naWZpZWRGdW5jKSB7XG4gICAgbmV3IEZ1bmN0aW9uKGByZXR1cm4gJHtzdHJpbmdpZmllZEZ1bmN9YCkoKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9XG4gIGRlaHlkcmF0ZUZ1bmN0aW9uIChmdW5jKSB7XG4gICAgbGV0IHN0cmluZ2lmaWVkRnVuYyA9IGZ1bmMudG9TdHJpbmcoKTtcbiAgICAvLyBJc3RhbmJ1bCBhZGRzIHNvbWUgY29kZSB0byBmdW5jdGlvbnMgZm9yIGNvbXB1dGluZyBjb3ZlcmFnZSwgdGhhdCBnZXRzXG4gICAgLy8gaW5jbHVkZWQgaW4gdGhlIHN0cmluZ2lmaWNhdGlvbiBwcm9jZXNzIGR1cmluZyB0ZXN0aW5nLiBTZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2dvdHdhcmxvc3QvaXN0YW5idWwvaXNzdWVzLzMxMCNpc3N1ZWNvbW1lbnQtMjc0ODg5MDIyXG4gICAgc3RyaW5naWZpZWRGdW5jID0gc3RyaW5naWZpZWRGdW5jLnJlcGxhY2UoL2Nvdl8oLis/KVxcK1xcK1ssO10/L2csICcnKTtcbiAgICByZXR1cm4gc3RyaW5naWZpZWRGdW5jO1xuICB9XG5cbiAgY3JlYXRlVGFibGUgKG9wdGlvbnMpIHtcbiAgICBpZiAoIW9wdGlvbnMudGFibGVJZCkge1xuICAgICAgb3B0aW9ucy50YWJsZUlkID0gYHRhYmxlJHtORVhUX1RBQkxFX0lEfWA7XG4gICAgICBORVhUX1RBQkxFX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLlRBQkxFU1tvcHRpb25zLnR5cGVdO1xuICAgIGRlbGV0ZSBvcHRpb25zLnR5cGU7XG4gICAgb3B0aW9ucy5tdXJlID0gdGhpcztcbiAgICB0aGlzLnRhYmxlc1tvcHRpb25zLnRhYmxlSWRdID0gbmV3IFR5cGUob3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXMudGFibGVzW29wdGlvbnMudGFibGVJZF07XG4gIH1cbiAgY3JlYXRlQ2xhc3MgKG9wdGlvbnMgPSB7IHNlbGVjdG9yOiBgZW1wdHlgIH0pIHtcbiAgICBpZiAoIW9wdGlvbnMuY2xhc3NJZCkge1xuICAgICAgb3B0aW9ucy5jbGFzc0lkID0gYGNsYXNzJHtORVhUX0NMQVNTX0lEfWA7XG4gICAgICBORVhUX0NMQVNTX0lEICs9IDE7XG4gICAgfVxuICAgIGNvbnN0IFR5cGUgPSB0aGlzLkNMQVNTRVNbb3B0aW9ucy50eXBlXTtcbiAgICBkZWxldGUgb3B0aW9ucy50eXBlO1xuICAgIG9wdGlvbnMubXVyZSA9IHRoaXM7XG4gICAgdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF0gPSBuZXcgVHlwZShvcHRpb25zKTtcbiAgICByZXR1cm4gdGhpcy5jbGFzc2VzW29wdGlvbnMuY2xhc3NJZF07XG4gIH1cblxuICBuZXdUYWJsZSAob3B0aW9ucykge1xuICAgIGNvbnN0IG5ld1RhYmxlT2JqID0gdGhpcy5jcmVhdGVUYWJsZShvcHRpb25zKTtcbiAgICB0aGlzLnNhdmVUYWJsZXMoKTtcbiAgICByZXR1cm4gbmV3VGFibGVPYmo7XG4gIH1cbiAgbmV3Q2xhc3MgKG9wdGlvbnMpIHtcbiAgICBjb25zdCBuZXdDbGFzc09iaiA9IHRoaXMuY3JlYXRlQ2xhc3Mob3B0aW9ucyk7XG4gICAgdGhpcy5zYXZlQ2xhc3NlcygpO1xuICAgIHJldHVybiBuZXdDbGFzc09iajtcbiAgfVxuXG4gIGFzeW5jIGFkZEZpbGVBc1N0YXRpY1RhYmxlICh7XG4gICAgZmlsZU9iaixcbiAgICBlbmNvZGluZyA9IG1pbWUuY2hhcnNldChmaWxlT2JqLnR5cGUpLFxuICAgIGV4dGVuc2lvbk92ZXJyaWRlID0gbnVsbCxcbiAgICBza2lwU2l6ZUNoZWNrID0gZmFsc2VcbiAgfSA9IHt9KSB7XG4gICAgY29uc3QgZmlsZU1CID0gZmlsZU9iai5zaXplIC8gMTA0ODU3NjtcbiAgICBpZiAoZmlsZU1CID49IDMwKSB7XG4gICAgICBpZiAoc2tpcFNpemVDaGVjaykge1xuICAgICAgICBjb25zb2xlLndhcm4oYEF0dGVtcHRpbmcgdG8gbG9hZCAke2ZpbGVNQn1NQiBmaWxlIGludG8gbWVtb3J5YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7ZmlsZU1CfU1CIGZpbGUgaXMgdG9vIGxhcmdlIHRvIGxvYWQgc3RhdGljYWxseTsgdHJ5IGFkZER5bmFtaWNUYWJsZSgpIGluc3RlYWQuYCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGV4dGVuc2lvbk92ZXJyaWRlIGFsbG93cyB0aGluZ3MgbGlrZSB0b3BvanNvbiBvciB0cmVlanNvbiAodGhhdCBkb24ndFxuICAgIC8vIGhhdmUgc3RhbmRhcmRpemVkIG1pbWVUeXBlcykgdG8gYmUgcGFyc2VkIGNvcnJlY3RseVxuICAgIGxldCB0ZXh0ID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHJlYWRlciA9IG5ldyB0aGlzLkZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUocmVhZGVyLnJlc3VsdCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaiwgZW5jb2RpbmcpO1xuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLmFkZFN0cmluZ0FzU3RhdGljVGFibGUoe1xuICAgICAgbmFtZTogZmlsZU9iai5uYW1lLFxuICAgICAgZXh0ZW5zaW9uOiBleHRlbnNpb25PdmVycmlkZSB8fCBtaW1lLmV4dGVuc2lvbihmaWxlT2JqLnR5cGUpLFxuICAgICAgdGV4dFxuICAgIH0pO1xuICB9XG4gIGFkZFN0cmluZ0FzU3RhdGljVGFibGUgKHsgbmFtZSwgZXh0ZW5zaW9uID0gJ3R4dCcsIHRleHQgfSkge1xuICAgIGxldCBkYXRhLCBhdHRyaWJ1dGVzO1xuICAgIGlmICh0aGlzLkRBVEFMSUJfRk9STUFUU1tleHRlbnNpb25dKSB7XG4gICAgICBkYXRhID0gZGF0YWxpYi5yZWFkKHRleHQsIHsgdHlwZTogZXh0ZW5zaW9uIH0pO1xuICAgICAgaWYgKGV4dGVuc2lvbiA9PT0gJ2NzdicgfHwgZXh0ZW5zaW9uID09PSAndHN2Jykge1xuICAgICAgICBhdHRyaWJ1dGVzID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBvZiBkYXRhLmNvbHVtbnMpIHtcbiAgICAgICAgICBhdHRyaWJ1dGVzW2F0dHJdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgZGF0YS5jb2x1bW5zO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZXh0ZW5zaW9uID09PSAneG1sJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmltcGxlbWVudGVkJyk7XG4gICAgfSBlbHNlIGlmIChleHRlbnNpb24gPT09ICd0eHQnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBmaWxlIGV4dGVuc2lvbjogJHtleHRlbnNpb259YCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkZFN0YXRpY1RhYmxlKHsgbmFtZSwgZGF0YSwgYXR0cmlidXRlcyB9KTtcbiAgfVxuICBhZGRTdGF0aWNUYWJsZSAob3B0aW9ucykge1xuICAgIG9wdGlvbnMudHlwZSA9IG9wdGlvbnMuZGF0YSBpbnN0YW5jZW9mIEFycmF5ID8gJ1N0YXRpY1RhYmxlJyA6ICdTdGF0aWNEaWN0JztcbiAgICBsZXQgbmV3VGFibGUgPSB0aGlzLm5ld1RhYmxlKG9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzLm5ld0NsYXNzKHtcbiAgICAgIHR5cGU6ICdHZW5lcmljQ2xhc3MnLFxuICAgICAgbmFtZTogb3B0aW9ucy5uYW1lLFxuICAgICAgdGFibGVJZDogbmV3VGFibGUudGFibGVJZFxuICAgIH0pO1xuICB9XG4gIGRlbGV0ZUFsbFVudXNlZFRhYmxlcyAoKSB7XG4gICAgZm9yIChjb25zdCB0YWJsZUlkIGluIHRoaXMudGFibGVzKSB7XG4gICAgICBpZiAodGhpcy50YWJsZXNbdGFibGVJZF0pIHtcbiAgICAgICAgdHJ5IHsgdGhpcy50YWJsZXNbdGFibGVJZF0uZGVsZXRlKCk7IH0gY2F0Y2ggKGVycikge31cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGVsZXRlQWxsQ2xhc3NlcyAoKSB7XG4gICAgZm9yIChjb25zdCBjbGFzc09iaiBvZiBPYmplY3QudmFsdWVzKHRoaXMuY2xhc3NlcykpIHtcbiAgICAgIGNsYXNzT2JqLmRlbGV0ZSgpO1xuICAgIH1cbiAgfVxuICBnZXRDbGFzc0RhdGEgKCkge1xuICAgIGNvbnN0IHJlc3VsdHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGNsYXNzT2JqIG9mIE9iamVjdC52YWx1ZXModGhpcy5jbGFzc2VzKSkge1xuICAgICAgcmVzdWx0c1tjbGFzc09iai5jbGFzc0lkXSA9IGNsYXNzT2JqLmN1cnJlbnREYXRhO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlLmpzJztcbmltcG9ydCBwa2cgZnJvbSAnLi4vcGFja2FnZS5qc29uJztcblxubGV0IG11cmUgPSBuZXcgTXVyZSh3aW5kb3cuRmlsZVJlYWRlciwgd2luZG93LmxvY2FsU3RvcmFnZSk7XG5tdXJlLnZlcnNpb24gPSBwa2cudmVyc2lvbjtcblxuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJUcmlnZ2VyYWJsZU1peGluIiwic3VwZXJjbGFzcyIsImNvbnN0cnVjdG9yIiwiYXJndW1lbnRzIiwiX2luc3RhbmNlT2ZUcmlnZ2VyYWJsZU1peGluIiwiZXZlbnRIYW5kbGVycyIsInN0aWNreVRyaWdnZXJzIiwib24iLCJldmVudE5hbWUiLCJjYWxsYmFjayIsImFsbG93RHVwbGljYXRlTGlzdGVuZXJzIiwiaW5kZXhPZiIsInB1c2giLCJvZmYiLCJpbmRleCIsInNwbGljZSIsInRyaWdnZXIiLCJhcmdzIiwiZm9yRWFjaCIsInNldFRpbWVvdXQiLCJhcHBseSIsInN0aWNreVRyaWdnZXIiLCJhcmdPYmoiLCJkZWxheSIsIk9iamVjdCIsImFzc2lnbiIsImNsZWFyVGltZW91dCIsInRpbWVvdXQiLCJkZWZpbmVQcm9wZXJ0eSIsIlN5bWJvbCIsImhhc0luc3RhbmNlIiwidmFsdWUiLCJpIiwiSW50cm9zcGVjdGFibGUiLCJ0eXBlIiwibG93ZXJDYW1lbENhc2VUeXBlIiwiaHVtYW5SZWFkYWJsZVR5cGUiLCJjb25maWd1cmFibGUiLCJnZXQiLCJ0ZW1wIiwicmVwbGFjZSIsInRvTG9jYWxlTG93ZXJDYXNlIiwiVGFibGUiLCJvcHRpb25zIiwiX211cmUiLCJtdXJlIiwidGFibGVJZCIsIkVycm9yIiwiX2V4cGVjdGVkQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJfb2JzZXJ2ZWRBdHRyaWJ1dGVzIiwiX2Rlcml2ZWRUYWJsZXMiLCJkZXJpdmVkVGFibGVzIiwiX2Rlcml2ZWRBdHRyaWJ1dGVGdW5jdGlvbnMiLCJkZXJpdmVkQXR0cmlidXRlRnVuY3Rpb25zIiwiYXR0ciIsInN0cmluZ2lmaWVkRnVuYyIsImVudHJpZXMiLCJoeWRyYXRlRnVuY3Rpb24iLCJfdG9SYXdPYmplY3QiLCJyZXN1bHQiLCJfYXR0cmlidXRlcyIsInVzZWRCeUNsYXNzZXMiLCJfdXNlZEJ5Q2xhc3NlcyIsImZ1bmMiLCJkZWh5ZHJhdGVGdW5jdGlvbiIsIm5hbWUiLCJpdGVyYXRlIiwicmVzZXQiLCJfY2FjaGUiLCJmaW5pc2hlZEl0ZW0iLCJ2YWx1ZXMiLCJfYnVpbGRDYWNoZSIsIl9wYXJ0aWFsQ2FjaGUiLCJkZXJpdmVkVGFibGUiLCJsaW1pdCIsInVuZGVmaW5lZCIsIkluZmluaXR5IiwiaXRlcmF0b3IiLCJfaXRlcmF0ZSIsImNvbXBsZXRlZCIsIm5leHQiLCJkb25lIiwiX2ZpbmlzaEl0ZW0iLCJ3cmFwcGVkSXRlbSIsInJvdyIsImtleXMiLCJfd3JhcCIsInRhYmxlIiwiY2xhc3NPYmoiLCJXUkFQUEVSUyIsIkdlbmVyaWNXcmFwcGVyIiwiX2dldEFsbEF0dHJpYnV0ZXMiLCJhbGxBdHRycyIsImN1cnJlbnREYXRhIiwiZGF0YSIsImNvbXBsZXRlIiwiZGVyaXZlQXR0cmlidXRlIiwiYXR0cmlidXRlIiwiX2Rlcml2ZVRhYmxlIiwibmV3VGFibGUiLCJjcmVhdGVUYWJsZSIsInNhdmVUYWJsZXMiLCJfZ2V0RXhpc3RpbmdUYWJsZSIsImV4aXN0aW5nVGFibGVJZCIsImZpbmQiLCJ0YWJsZU9iaiIsImV2ZXJ5Iiwib3B0aW9uTmFtZSIsIm9wdGlvblZhbHVlIiwidGFibGVzIiwiYWdncmVnYXRlIiwiZXhwYW5kIiwiZGVsaW1pdGVyIiwiY2xvc2VkRmFjZXQiLCJtYXAiLCJvcGVuRmFjZXQiLCJjb25uZWN0Iiwib3RoZXJUYWJsZUxpc3QiLCJvdGhlclRhYmxlIiwiY2xhc3NlcyIsInBhcmVudFRhYmxlcyIsInJlZHVjZSIsImFnZyIsImRlbGV0ZSIsImxlbmd0aCIsInBhcmVudFRhYmxlIiwiZXhlYyIsIlN0YXRpY1RhYmxlIiwiX25hbWUiLCJfZGF0YSIsIm9iaiIsIml0ZW0iLCJTdGF0aWNEaWN0IiwiU2luZ2xlUGFyZW50TWl4aW4iLCJfaW5zdGFuY2VPZlNpbmdsZVBhcmVudE1peGluIiwiQWdncmVnYXRlZFRhYmxlIiwiX2F0dHJpYnV0ZSIsIl9yZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJyZWR1Y2VBdHRyaWJ1dGVGdW5jdGlvbnMiLCJfZGVoeWRyYXRlRnVuY3Rpb24iLCJkZXJpdmVSZWR1Y2VkQXR0cmlidXRlIiwiX3VwZGF0ZUl0ZW0iLCJvcmlnaW5hbFdyYXBwZWRJdGVtIiwibmV3V3JhcHBlZEl0ZW0iLCJ3cmFwcGVkUGFyZW50IiwibmV3SXRlbSIsImNvbm5lY3RlZFJvd3MiLCJEdXBsaWNhdGFibGVBdHRyaWJ1dGVzTWl4aW4iLCJfaW5zdGFuY2VPZkR1cGxpY2F0YWJsZUF0dHJpYnV0ZXNNaXhpbiIsIl9kdXBsaWNhdGVkQXR0cmlidXRlcyIsImR1cGxpY2F0ZWRBdHRyaWJ1dGVzIiwiZHVwbGljYXRlQXR0cmlidXRlIiwicGFyZW50SWQiLCJfZHVwbGljYXRlQXR0cmlidXRlcyIsInBhcmVudE5hbWUiLCJFeHBhbmRlZFRhYmxlIiwicGFyZW50VGFibGVJZCIsInNwbGl0IiwiRmlsdGVyZWRUYWJsZSIsIl92YWx1ZSIsInRvUmF3T2JqZWN0IiwiQ29ubmVjdGVkVGFibGUiLCJqb2luIiwicGFyZW50VGFibGUyIiwiR2VuZXJpY0NsYXNzIiwiY2xhc3NJZCIsIl9jbGFzc05hbWUiLCJjbGFzc05hbWUiLCJhbm5vdGF0aW9uIiwic2V0Q2xhc3NOYW1lIiwic2F2ZUNsYXNzZXMiLCJoYXNDdXN0b21OYW1lIiwiZ2V0SGFzaFRhYmxlIiwiaW50ZXJwcmV0QXNOb2RlcyIsIm5ld0NsYXNzIiwiaW50ZXJwcmV0QXNFZGdlcyIsIk5vZGVDbGFzcyIsImVkZ2VDbGFzc0lkcyIsIldyYXBwZXIiLCJOb2RlV3JhcHBlciIsImRpc2Nvbm5lY3RBbGxFZGdlcyIsInNvdXJjZUVkZ2VDbGFzcyIsInNvdXJjZU5vZGVJZCIsInNvdXJjZU5vZGVBdHRyIiwic291cmNlRWRnZUF0dHIiLCJ0YXJnZXROb2RlQXR0ciIsInRhcmdldEVkZ2VDbGFzcyIsInRhcmdldE5vZGVJZCIsInRhcmdldEVkZ2VBdHRyIiwiY29ubmVjdFRvTm9kZUNsYXNzIiwib3RoZXJOb2RlQ2xhc3MiLCJkaXJlY3RlZCIsIm90aGVyQXR0cmlidXRlIiwidGhpc0hhc2giLCJvdGhlckhhc2giLCJjb25uZWN0ZWRUYWJsZSIsIm5ld0VkZ2VDbGFzcyIsImNyZWF0ZUNsYXNzIiwic291cmNlQ2xhc3NJZCIsInRhcmdldENsYXNzSWQiLCJjb25uZWN0VG9FZGdlQ2xhc3MiLCJlZGdlQ2xhc3MiLCJub2RlQ2xhc3MiLCJlZGdlQ2xhc3NJZCIsImRpc2Nvbm5lY3RTb3VyY2UiLCJkaXNjb25uZWN0VGFyZ2V0IiwiRWRnZUNsYXNzIiwiRWRnZVdyYXBwZXIiLCJkaXJlY3Rpb24iLCJub2RlQXR0cmlidXRlIiwiZWRnZUF0dHJpYnV0ZSIsImNvbm5lY3RUYXJnZXQiLCJjb25uZWN0U291cmNlIiwidG9nZ2xlTm9kZURpcmVjdGlvbiIsImludGVybWVkaWF0ZVNvdXJjZXMiLCJza2lwU2F2ZSIsIkluTWVtb3J5SW5kZXgiLCJpdGVyRW50cmllcyIsImhhc2giLCJ2YWx1ZUxpc3QiLCJpdGVySGFzaGVzIiwiaXRlclZhbHVlTGlzdHMiLCJnZXRWYWx1ZUxpc3QiLCJhZGRWYWx1ZSIsIk5FWFRfQ0xBU1NfSUQiLCJORVhUX1RBQkxFX0lEIiwiTXVyZSIsIkZpbGVSZWFkZXIiLCJsb2NhbFN0b3JhZ2UiLCJtaW1lIiwiZGVidWciLCJEQVRBTElCX0ZPUk1BVFMiLCJUQUJMRVMiLCJDTEFTU0VTIiwiSU5ERVhFUyIsIk5BTUVEX0ZVTkNUSU9OUyIsImlkZW50aXR5IiwicmF3SXRlbSIsImtleSIsIlR5cGVFcnJvciIsInBhcmVudFR5cGUiLCJkZWZhdWx0RmluaXNoIiwidGhpc1dyYXBwZWRJdGVtIiwib3RoZXJXcmFwcGVkSXRlbSIsImxlZnQiLCJyaWdodCIsInNoYTEiLCJKU09OIiwic3RyaW5naWZ5Iiwibm9vcCIsImh5ZHJhdGUiLCJoaWdoZXN0TnVtIiwiTWF0aCIsIm1heCIsInBhcnNlSW50IiwibWF0Y2giLCJkZWh5ZHJhdGUiLCJzdG9yYWdlS2V5IiwiVFlQRVMiLCJjb250YWluZXIiLCJnZXRJdGVtIiwicGFyc2UiLCJzZXRJdGVtIiwiRnVuY3Rpb24iLCJ0b1N0cmluZyIsIlR5cGUiLCJzZWxlY3RvciIsIm5ld1RhYmxlT2JqIiwibmV3Q2xhc3NPYmoiLCJhZGRGaWxlQXNTdGF0aWNUYWJsZSIsImZpbGVPYmoiLCJlbmNvZGluZyIsImNoYXJzZXQiLCJleHRlbnNpb25PdmVycmlkZSIsInNraXBTaXplQ2hlY2siLCJmaWxlTUIiLCJzaXplIiwiY29uc29sZSIsIndhcm4iLCJ0ZXh0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZWFkZXIiLCJvbmxvYWQiLCJyZWFkQXNUZXh0IiwiYWRkU3RyaW5nQXNTdGF0aWNUYWJsZSIsImV4dGVuc2lvbiIsImRhdGFsaWIiLCJyZWFkIiwiY29sdW1ucyIsImFkZFN0YXRpY1RhYmxlIiwiQXJyYXkiLCJkZWxldGVBbGxVbnVzZWRUYWJsZXMiLCJlcnIiLCJkZWxldGVBbGxDbGFzc2VzIiwiZ2V0Q2xhc3NEYXRhIiwicmVzdWx0cyIsIndpbmRvdyIsInZlcnNpb24iLCJwa2ciXSwibWFwcGluZ3MiOiI7Ozs7QUFB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
