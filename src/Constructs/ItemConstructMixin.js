export default (superclass) => class extends superclass {
  async getValue (attribute, target = this._contentConstruct || this) {
    return target.value[attribute];
  }
  async getAttributes (target = this._contentConstruct || this) {
    return Object.keys(target.value);
  }
  async getContents (target = this._contentConstruct || this) {
    return Object.entries(target.value)
      .reduce((agg, [label, value]) => {
        if (!this.mure.RESERVED_OBJ_KEYS[label]) {
          let ConstructType = this.mure.inferType(value);
          agg.push(new ConstructType({
            mure: this.mure,
            value,
            path: target.path.concat([label]),
            doc: target.doc
          }));
        }
        return agg;
      }, []);
  }
  async getContentSelectors (target = this._contentConstruct || this) {
    return this.getContents().map(item => item.uniqueSelector);
  }
  async getContentCount (target = this._contentConstruct || this) {
    return Object.keys(target.value)
      .filter(label => !this.mure.RESERVED_OBJ_KEYS[label])
      .length;
  }
};
