import jsonPath from 'jsonpath';
import TypedWrapper from './TypedWrapper.js';
import ContainerWrapperMixin from './ContainerWrapperMixin.js';

class ContainerWrapper extends ContainerWrapperMixin(TypedWrapper) {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value, path, doc });
    this.nextLabel = Object.keys(this.value)
      .reduce((max, key) => {
        key = parseInt(key);
        if (!isNaN(key) && key > max) {
          return key;
        } else {
          return max;
        }
      }, 0) + 1;
  }
  createNewWrapper (value, label, WrapperType) {
    WrapperType = WrapperType || this.mure.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item = new WrapperType({
      mure: this.mure,
      value: WrapperType.getBoilerplateValue(),
      path,
      doc: this.doc
    });
    this.addWrapper(item, label);
    return item;
  }
  addWrapper (item, label) {
    if (item instanceof ContainerWrapper) {
      if (item.value._id) {
        throw new Error('Wrapper has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.slice(1).concat([label]))}`;
    }
    this.value[label] = item.value;
  }
}
ContainerWrapper.getBoilerplateValue = () => { return {}; };
ContainerWrapper.convertArray = value => {
  if (value instanceof Array) {
    let temp = {};
    value.forEach((element, index) => {
      temp[index] = element;
    });
    value = temp;
    value.$wasArray = true;
  }
  return value;
};
ContainerWrapper.standardize = ({ mure, value, path, doc, aggressive }) => {
  // Assign the object's id if a path is supplied
  if (path) {
    value._id = '@' + jsonPath.stringify(path.slice(1));
  }
  // Recursively standardize contents if a path and doc are supplied
  if (path && doc) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (!mure.RESERVED_OBJ_KEYS[key]) {
        let temp = Array.from(path);
        temp.push(key);
        // Alayws convert arrays to objects
        nestedValue = ContainerWrapper.convertArray(nestedValue);
        // What kind of value are we dealing with?
        let WrapperType = mure.inferType(nestedValue, aggressive);
        // Apply that class's standardization function
        value[key] = WrapperType.standardize({
          mure,
          value: nestedValue,
          path: temp,
          doc,
          aggressive
        });
      }
    });
  }
  return value;
};

export default ContainerWrapper;
