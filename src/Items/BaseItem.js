class BaseItem {
  constructor ({ mure, path, value, parent, doc, label, uniqueSelector, classes }) {
    this.mure = mure;
    this.path = path;
    this._value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.uniqueSelector = uniqueSelector;
    this.classes = classes;
  }
  get type () {
    return /(.*)Item/.exec(this.constructor.name)[1];
  }
  get value () { return this._value; }
  set value (newValue) {
    if (this.parent) {
      // In the event that this is a primitive boolean, number, string, etc,
      // setting the value on the Item wrapper object *won't* naturally update
      // it in its containing document...
      this.parent[this.label] = newValue;
    }
    this._value = newValue;
  }
  remove () {
    // this.parent is a pointer to the raw element, so we want to delete its
    // reference to this item
    delete this.parent[this.label];
  }
  canConvertTo (ItemType) {
    return ItemType === this.constructor;
  }
  convertTo (ItemType) {
    if (ItemType === this.constructor) {
      return this;
    } else {
      throw new Error(`Conversion from ${this.constructor.name} to ${ItemType.name} not yet implemented.`);
    }
  }
}
BaseItem.getHumanReadableType = function () {
  return /(.*)Item/.exec(this.name)[1];
};
BaseItem.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};
BaseItem.standardize = ({ value }) => {
  // Default action: do nothing
  return value;
};

export default BaseItem;
