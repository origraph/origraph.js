export default (superclass) => class extends superclass {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    if (!value.$members) {
      throw new TypeError(`SetWrapper requires a $members object`);
    }
  }
  addWrapper (item) {
    const itemTag = item.value._id;
    const setTag = this.value._id;
    this.value.$members[itemTag] = true;
    item.value.$tags[setTag] = true;
  }
  getMemberSelectors () {
    return Object.keys(this.value.$members);
  }
  async getMembers () {
    return this.mure.selectAll(this.getMemberSelectors()).items();
  }
};
