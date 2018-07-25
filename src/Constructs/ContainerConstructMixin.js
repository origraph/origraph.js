export default (superclass) => class extends superclass {
  getValue (attribute, target = this._contentConstruct || this) {
    return target.value[attribute];
  }
  getAttributes (target = this._contentConstruct || this) {
    return Object.keys(target.value)
      .filter(d => !this.mure.RESERVED_OBJ_KEYS[d]);
  }
  getContents (target = this._contentConstruct || this) {
    const result = {};
    Object.entries(target.value).forEach(([label, value]) => {
      if (!this.mure.RESERVED_OBJ_KEYS[label]) {
        let ConstructType = this.mure.inferType(value);
        const temp = new ConstructType({
          mure: this.mure,
          value,
          path: target.path.concat([label]),
          doc: target.doc
        });
        result[temp.uniqueSelector] = temp;
      }
    });
    return result;
  }
  getContentSelectors (target = this._contentConstruct || this) {
    return Object.keys(this.getContents(target));
  }
  getContentCount (target = this._contentConstruct || this) {
    return Object.keys(target.value)
      .filter(label => !this.mure.RESERVED_OBJ_KEYS[label])
      .length;
  }
};
