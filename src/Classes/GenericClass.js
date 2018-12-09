import Introspectable from '../Common/Introspectable.js';
import GenericWrapper from '../Wrappers/GenericWrapper.js';

class GenericClass extends Introspectable {
  constructor (options) {
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
  _toRawObject () {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotations: this.annotations
    };
  }
  getSortHash () {
    return this.type + this.className;
  }
  setClassName (value) {
    this._className = value;
    this.model.trigger('update');
  }
  setAnnotation (key, value) {
    this.annotations[key] = value;
    this.model.trigger('update');
  }
  deleteAnnotation (key) {
    delete this.annotations[key];
    this.model.trigger('update');
  }
  get hasCustomName () {
    return this._className !== null;
  }
  get className () {
    return this._className || this.table.name;
  }
  get variableName () {
    return this.type.toLocaleLowerCase() + '_' +
      this.className
        .split(/\W+/g)
        .filter(d => d.length > 0)
        .map(d => d[0].toLocaleUpperCase() + d.slice(1))
        .join('');
  }
  get table () {
    return this.model.tables[this.tableId];
  }
  get deleted () {
    return !this.model.deleted && this.model.classes[this.classId];
  }
  _wrap (options) {
    options.classObj = this;
    return new GenericWrapper(options);
  }
  interpretAsNodes () {
    const options = this._toRawObject();
    options.type = 'NodeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }
  interpretAsEdges () {
    const options = this._toRawObject();
    options.type = 'EdgeClass';
    options.overwrite = true;
    this.table.reset();
    return this.model.createClass(options);
  }
  _deriveNewClass (newTable, type = this.constructor.name) {
    return this.model.createClass({
      tableId: newTable.tableId,
      type
    });
  }
  promote (attribute) {
    return this._deriveNewClass(this.table.promote(attribute).tableId, 'GenericClass');
  }
  expand (attribute) {
    return this._deriveNewClass(this.table.expand(attribute));
  }
  unroll (attribute) {
    return this._deriveNewClass(this.table.unroll(attribute));
  }
  closedFacet (attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }
  async * openFacet (attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this._deriveNewClass(newTable);
    }
  }
  closedTranspose (indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this._deriveNewClass(newTable);
    });
  }
  async * openTranspose () {
    for await (const newTable of this.table.openTranspose()) {
      yield this._deriveNewClass(newTable);
    }
  }
  delete () {
    delete this.model.classes[this.classId];
    this.model.optimizeTables();
    this.model.trigger('update');
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
