const DuplicatableAttributesMixin = function (superclass) {
  return class extends superclass {
    constructor (options) {
      super(options);
      this._instanceOfDuplicatableAttributesMixin = true;
      this._duplicatedAttributes = options.duplicatedAttributes || {};
    }
    _toRawObject () {
      const obj = super._toRawObject();
      obj.duplicatedAttributes = this._duplicatedAttributes;
      return obj;
    }
    duplicateAttribute (parentId, attribute) {
      this._duplicateAttributes[parentId] = this._duplicateAttributes[parentId] || [];
      this._duplicatedAttributes[parentId].push(attribute);
      this.reset();
    }
    _duplicateAttributes (wrappedItem, parentItems) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        wrappedItem.row[`${parentId}.${attr}`] = parentItems[parentId][attr];
      }
    }
    _getAllAttributes () {
      const result = super._getAllAttributes();
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        result[`${parentId}.${attr}`] = true;
      }
      return result;
    }
  };
};
Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});
export default DuplicatableAttributesMixin;
