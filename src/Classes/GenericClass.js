import Introspectable from '../Common/Introspectable.js';

class GenericClass extends Introspectable {
  constructor (options) {
    super();
    this._mure = options.mure;
    this.classId = options.classId;
    this.tableId = options.tableId;
    if (!this._mure || !this.classId || !this.tableId) {
      throw new Error(`_mure and classId are required`);
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
  set className (value) {
    this._className = value;
  }
  get hasCustomName () {
    return this._customName !== null;
  }
  get className () {
    return this._customName || this._autoDeriveClassName();
  }
  getHashTable (attribute) {
    return attribute === null ? this.table : this.table.aggregate(attribute);
  }
  _autoDeriveClassName () {
    throw new Error(`this function should be overridden`);
  }
  get table () {
    return this._mure.tables[this.tableId];
  }
  interpretAsNodes () {
    const options = this._toRawObject();
    options.ClassType = this._mure.CLASSES.NodeClass;
    return this._mure.newClass(options);
  }
  interpretAsEdges () {
    const options = this._toRawObject();
    options.ClassType = this._mure.CLASSES.EdgeClass;
    return this._mure.newClass(options);
  }
  _wrap (options) {
    return new this._mure.WRAPPERS.GenericWrapper(options);
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
