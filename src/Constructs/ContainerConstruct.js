import jsonPath from 'jsonpath';
import TypedConstruct from './TypedConstruct.js';
import ContainerConstructMixin from './ContainerConstructMixin.js';

class ContainerConstruct extends ContainerConstructMixin(TypedConstruct) {
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
  createNewConstruct (value, label, ConstructType) {
    ConstructType = ConstructType || this.mure.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item = new ConstructType({
      mure: this.mure,
      value: ConstructType.getBoilerplateValue(),
      path,
      doc: this.doc
    });
    this.addConstruct(item, label);
    return item;
  }
  addConstruct (item, label) {
    if (item instanceof ContainerConstruct) {
      if (item.value._id) {
        throw new Error('Construct has already been assigned an _id');
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
ContainerConstruct.getBoilerplateValue = () => { return {}; };
ContainerConstruct.convertArray = value => {
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
ContainerConstruct.standardize = ({ mure, value, path, doc, aggressive }) => {
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
        nestedValue = ContainerConstruct.convertArray(nestedValue);
        // What kind of value are we dealing with?
        let ConstructType = mure.inferType(nestedValue, aggressive);
        // Apply that class's standardization function
        value[key] = ConstructType.standardize({
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

export default ContainerConstruct;
