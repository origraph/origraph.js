import Introspectable from '../Common/Introspectable.js';

class BaseConstruct extends Introspectable {
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
      // setting the value on the Construct wrapper object *won't* naturally update
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
    return this.uniqueSelector === other.uniqueSelector;
  }
}
Object.defineProperty(BaseConstruct, 'type', {
  get () {
    return /(.*)Construct/.exec(this.name)[1];
  }
});
BaseConstruct.getBoilerplateValue = () => {
  throw new Error('unimplemented');
};
BaseConstruct.standardize = ({ value }) => {
  // Default action: do nothing
  return value;
};
BaseConstruct.isBadValue = value => false;

export default BaseConstruct;
