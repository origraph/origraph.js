import Introspectable from '../Common/Introspectable.js';

class BaseWrapper extends Introspectable {
  constructor ({ mure, path, value, parent, doc, label, uniqueSelector }) {
    super();
    this.mure = mure;
    this.path = path;
    this._value = value;
    this.parent = parent;
    this.doc = doc;
    this.label = label;
    this.uniqueSelector = uniqueSelector;
  }
  get value () { return this._value; }
  set value (newValue) {
    if (this.parent) {
      // In the event that this is a primitive boolean, number, string, etc,
      // setting the value on the Wrapper wrapper object *won't* naturally update
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
  equals (other) {
    return other instanceof BaseWrapper &&
      this.uniqueSelector === other.uniqueSelector;
  }
}
Object.defineProperty(BaseWrapper, 'type', {
  get () {
    return /(.*)Wrapper/.exec(this.name)[1];
  }
});
BaseWrapper.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};
BaseWrapper.standardize = ({ value }) => {
  // Default action: do nothing
  return value;
};
BaseWrapper.isBadValue = value => false;

export default BaseWrapper;
