export default (superclass) => class extends superclass {
  constructor ({ value, path, doc }) {
    super(value, path, doc);
    if (!value.$members) {
      throw new TypeError(`SetItem requires a $members object`);
    }
  }
  addItem (item) {
    const itemTag = item.value._id;
    const setTag = this.value._id;
    this.value.$members[itemTag] = true;
    item.value.$tags[setTag] = true;
  }
};
