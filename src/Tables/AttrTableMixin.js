import SingleParentMixin from './SingleParentMixin.js';

const AttrTableMixin = function (superclass) {
  return class extends SingleParentMixin(superclass) {
    constructor (options) {
      super(options);
      this._instanceOfAttrTableMixin = true;
      this._attribute = options.attribute;
      if (!this._attribute) {
        throw new Error(`attribute is required`);
      }
    }
    _toRawObject () {
      const obj = super._toRawObject();
      obj.attribute = this._attribute;
      return obj;
    }
    getSortHash () {
      return super.getSortHash() + this.parentTable.getSortHash() + this._attribute;
    }
    get name () {
      return this._attribute;
    }
  };
};
Object.defineProperty(AttrTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfAttrTableMixin
});
export default AttrTableMixin;
