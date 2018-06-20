import jsonPath from 'jsonpath';
import TypedItem from './TypedItem.js';
import ContainerItemMixin from './ContainerItemMixin.js';
import NodeItem from './NodeItem.js';

class ContainerItem extends ContainerItemMixin(TypedItem) {
  constructor ({ mure, value, path, doc }) {
    super(mure, value, path, doc);
    this.nextLabel = Object.keys(this.value)
      .reduce((max, key) => {
        key = parseInt(key);
        if (!isNaN(key) && key > max) {
          return key;
        } else {
          return max;
        }
      }, 0) + 1;
    this.classes = this.mure.getItemClasses(this);
  }
  createNewItem (value, label, ItemType) {
    ItemType = ItemType || this.mure.inferType(value);
    if (label === undefined) {
      label = String(this.nextLabel);
      this.nextLabel += 1;
    }
    let path = this.path.concat(label);
    let item = new ItemType(ItemType.getBoilerplateValue(), path, this.doc);
    this.addItem(item, label);
    return item;
  }
  addItem (item, label) {
    if (item instanceof ContainerItem) {
      if (item.value._id) {
        throw new Error('Item has already been assigned an _id');
      }
      if (label === undefined) {
        label = this.nextLabel;
        this.nextLabel += 1;
      }
      item.value._id = `@${jsonPath.stringify(this.path.slice(1).concat([label]))}`;
    }
    this.value[label] = item.value;
  }
  canConvertTo (ItemType) {
    return ItemType === NodeItem ||
      super.canConvertTo(ItemType);
  }
  convertTo (ItemType) {
    if (ItemType === NodeItem) {
      this.value.$edges = {};
      this.value.$tags = {};
      return new NodeItem(this.value, this.path, this.doc);
    } else {
      return super.convertTo(ItemType);
    }
  }
  contentItems () {
    return this.getValueContents();
  }
  contentItemCount () {
    return this.getValueContentCount();
  }
}
ContainerItem.getBoilerplateValue = () => { return {}; };
ContainerItem.convertArray = value => {
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
ContainerItem.standardize = ({ mure, value, path, doc, aggressive }) => {
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
        nestedValue = ContainerItem.convertArray(nestedValue);
        // What kind of value are we dealing with?
        let ItemType = mure.inferType(nestedValue, aggressive);
        // Apply that class's standardization function
        value[key] = ItemType.standardize({
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

export default ContainerItem;
