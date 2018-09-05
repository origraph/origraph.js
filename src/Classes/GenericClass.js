import Introspectable from '../Common/Introspectable.js';

class GenericClass extends Introspectable {
  constructor (options) {
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
  _toRawObject () {
    return {
      classId: this.classId,
      tableId: this.tableId,
      className: this._className,
      annotation: this.annotation
    };
  }
  setClassName (value) {
    this._className = value;
    this._mure.saveClasses();
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
    return this._mure.tables[this.tableId];
  }
  _wrap (options) {
    return new this._mure.WRAPPERS.GenericWrapper(options);
  }
  interpretAsNodes () {
    const options = this._toRawObject();
    options.type = 'NodeClass';
    return this._mure.newClass(options);
  }
  interpretAsEdges () {
    const options = this._toRawObject();
    options.type = 'EdgeClass';
    return this._mure.newClass(options);
  }
  aggregate (attribute) {
    const newTable = this.table.aggregate(attribute);
    return this._mure.newClass({
      tableId: newTable.tableId,
      type: 'GenericClass'
    });
  }
  delete () {
    delete this._mure.classes[this.classId];
    this._mure.saveClasses();
  }
}
Object.defineProperty(GenericClass, 'type', {
  get () {
    return /(.*)Class/.exec(this.name)[1];
  }
});
export default GenericClass;
