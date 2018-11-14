const SingleParentMixin = function (superclass) {
  return class extends superclass {
    constructor (options) {
      super(options);
      this._instanceOfSingleParentMixin = true;
    }
    get parentTable () {
      const parentTables = this.parentTables;
      if (parentTables.length === 0) {
        throw new Error(`Parent table is required for table of type ${this.type}`);
      } else if (parentTables.length > 1) {
        throw new Error(`Only one parent table allowed for table of type ${this.type}`);
      }
      return parentTables[0];
    }
  };
};
Object.defineProperty(SingleParentMixin, Symbol.hasInstance, {
  value: i => !!i._instanceOfSingleParentMixin
});
export default SingleParentMixin;
