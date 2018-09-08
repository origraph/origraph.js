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
      this._duplicatedAttributes[parentId] = this._duplicatedAttributes[parentId] || [];
      this._duplicatedAttributes[parentId].push(attribute);
      this.reset();
    }
    _duplicateAttributes (wrappedItem) {
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const parentName = this._mure.tables[parentId].name;
        wrappedItem.row[`${parentName}.${attr}`] = wrappedItem.connectedItems[parentId][0].row[attr];
      }
    }
    getAttributeDetails () {
      const allAttrs = super.getAttributeDetails();
      for (const [parentId, attr] of Object.entries(this._duplicatedAttributes)) {
        const attrName = `${this._mure.tables[parentId].name}.${attr}`;
        allAttrs[attrName] = allAttrs[attrName] || {};
        allAttrs[attrName].copied = true;
      }
      return allAttrs;
    }
  };
};
Object.defineProperty(DuplicatableAttributesMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfDuplicatableAttributesMixin
});
export default DuplicatableAttributesMixin;
