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
  get hasCustomName () {
    return this._className !== null;
  }
  get className () {
    return this._className || this.table.name;
  }
  get table () {
    return this.model.tables[this.tableId];
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
  aggregate (attribute) {
    return this._deriveNewClass(this.table.aggregate(attribute));
  }
  expand (attribute, delimiter) {
    return this._deriveNewClass(this.table.expand(attribute, delimiter));
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
    this.model.trigger('update');
  }
  getSampleGraph (options) {
    options.rootClass = this;
    return this.model.getSampleGraph(options);
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
