import Introspectable from '../Common/Introspectable.js';

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this._origraph = options.origraph;
    this.classId = options.classId;
    this.tableId = options.tableId;
    if (!this._origraph || !this.classId || !this.tableId) {
      throw new Error(`_origraph, classId, and tableId are required`);
    }

    this._className = options.className || null;
    this.annotations = options.annotations || {};
  }
  _toRawObject () {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotations: this.annotations
    };
  }
  setClassName (value) {
    this._className = value;
    this._origraph.saveClasses();
  }
  get hasCustomName () {
    return this._className !== null;
  }
  get className () {
    return this._className || this.table.name;
  }
  getHashTable (attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }
  get table () {
    return this._origraph.tables[this.tableId];
  }
  _wrap (options) {
    options.classObj = this;
    return new this._origraph.WRAPPERS.GenericWrapper(options);
  }
  interpretAsNodes () {
    const options = this._toRawObject();
    options.type = 'NodeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }
  interpretAsEdges () {
    const options = this._toRawObject();
    options.type = 'EdgeClass';
    this.table.reset();
    return this._origraph.newClass(options);
  }
  _deriveGenericClass (newTable, type = this.constructor.name) {
    return this._origraph.newClass({
      tableId: newTable.tableId,
      type
    });
  }
  aggregate (attribute) {
    return this._deriveGenericClass(this.table.aggregate(attribute));
  }
  expand (attribute, delimiter) {
    return this._deriveGenericClass(this.table.expand(attribute, delimiter));
  }
  closedFacet (attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveGenericClass(newTable);
    });
  }
  async * openFacet (attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this._deriveGenericClass(newTable);
    }
  }
  closedTranspose (indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this._deriveGenericClass(newTable);
    });
  }
  async * openTranspose () {
    for await (const newTable of this.table.openTranspose()) {
      yield this._deriveGenericClass(newTable);
    }
  }
  delete () {
    delete this._origraph.classes[this.classId];
    this._origraph.saveClasses();
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
