const DuplicatableAttributesMixin = function (superclass) {
  return class extends superclass {
    constructor (options) {
      super(options);
      this._instanceOfDuplicatableAttributesMixin = true;
      this._duplicatedAttributes = options.duplicatedAttributes || {};
    }
    duplicateAttributes (wrappedItem, wrappedParent) {
      for (const attr in this._duplicatedAttributes) {
        wrappedItem.row[attr] = wrappedParent.row[attr];
      }
    }
    toRawObject () {
      const obj = super.toRawObject();
      obj.duplicatedAttributes = this._duplicatedAttributes;
      return obj;
    }
    getAllAttributes () {
      const result = super.getAllAttributes();
      for (const attr in this._duplicatedAttributes) {
        result[attr] = true;
      }
      return result;
    }
  };
};
Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});
export default DuplicatableAttributesMixin;
