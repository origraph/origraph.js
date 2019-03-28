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
    return this.model.createClass(options);
  }
  interpretAsEdges () {
    const options = this._toRawObject();
    options.type = 'EdgeClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }
  intepretAsGeneric () {
    const options = this._toRawObject();
    options.type = 'GenericClass';
    options.overwrite = true;
    return this.model.createClass(options);
  }
  expand (attribute) {
    return this.model.createClass({
      tableId: this.table.expand(attribute).tableId,
      type: this.constructor.name
    });
  }
  unroll (attribute) {
    return this.model.createClass({
      tableId: this.table.unroll(attribute).tableId,
      type: this.constructor.name
    });
  }
  promote (attribute) {
    return this.model.createClass({
      tableId: this.table.promote(attribute).tableId,
      type: this.constructor.name
    });
  }
  aggregate (attribute, options = {}) {
    options = Object.assign(this._toRawObject(), options, {
      classId: this.classId,
      overwrite: true,
      tableId: this.table.promote(attribute).tableId,
      type: this.constructor.name
    });
    return this.model.createClass(options);
  }
  dissolve (options = {}) {
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
  get canDissolve () {
    return this.table.type === 'Promoted';
  }
  closedFacet (attribute, values) {
    return this.table.closedFacet(attribute, values).map(newTable => {
      return this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    });
  }
  async * openFacet (attribute) {
    for await (const newTable of this.table.openFacet(attribute)) {
      yield this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    }
  }
  closedTranspose (indexes) {
    return this.table.closedTranspose(indexes).map(newTable => {
      return this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    });
  }
  async * openTranspose () {
    for await (const newTable of this.table.openTranspose()) {
      yield this.model.createClass({
        tableId: newTable.tableId,
        type: this.constructor.name
      });
    }
  }
  delete () {
    delete this.model.classes[this.classId];
    this.model.optimizeTables();
    this.model.trigger('update');
  }
  async countAllUniqueValues () {
    // TODO: this is wildly inefficient, especially for quantitative
    // attributes... currently doing this (under protest) for stats in the
    // connect interface. Maybe useful for writing histogram functions in
    // the future?
    const hashableBins = {};
    const unHashableCounts = {};
    const indexBin = {};
    for await (const item of this.table.iterate()) {
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
    return { hashableBins, unHashableCounts, indexBin };
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
