import AttrTableMixin from './AttrTableMixin.js';

const ChildTableMixin = function (superclass) {
  return class extends AttrTableMixin(superclass) {
    constructor (options) {
      super(options);
      this._instanceOfChildTableMixin = true;
    }
    _wrap (options) {
      const newItem = super._wrap(options);
      newItem.parentIndex = options.parentIndex;
      return newItem;
    }
  };
};
Object.defineProperty(ChildTableMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfChildTableMixin
});
export default ChildTableMixin;
