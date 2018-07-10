export default (superclass) => class extends superclass {
  async getValueContents () {
    return Object.entries(this.value)
      .reduce((agg, [label, value]) => {
        if (!this.mure.RESERVED_OBJ_KEYS[label]) {
          let ConstructType = this.mure.inferType(value);
          agg.push(new ConstructType({
            mure: this.mure,
            value,
            path: this.path.concat([label]),
            doc: this.doc
          }));
        }
        return agg;
      }, []);
  }
  async getValueContentCount () {
    return Object.keys(this.value)
      .filter(label => !this.mure.RESERVED_OBJ_KEYS[label])
      .length;
  }
};
