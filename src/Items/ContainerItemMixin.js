export default (superclass) => class extends superclass {
  async getValueContents () {
    return Object.entries(this.value)
      .reduce((agg, [label, value]) => {
        if (!this.mure.RESERVED_OBJ_KEYS[label]) {
          let ItemType = this.mure.inferType(value);
          agg.push(new ItemType(value, this.path.concat([label]), this.doc));
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
