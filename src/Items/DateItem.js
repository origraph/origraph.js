import PrimitiveItem from './PrimitiveItem.js';
import NumberItem from './NumberItem.js';
import StringItem from './StringItem.js';

class DateItem extends PrimitiveItem {
  constructor ({ mure, value, path, doc }) {
    super(mure, DateItem.standardize(value), path, doc);
  }
  get value () { return new Date(this._value.str); }
  set value (newValue) {
    super.value = DateItem.standardize(newValue);
  }
  canConvertTo (ItemType) {
    return ItemType === NumberItem ||
      ItemType === StringItem ||
      super.canConvertTo(ItemType);
  }
  convertTo (ItemType) {
    if (ItemType === NumberItem) {
      this.parent[this.label] = this._value = Number(this.value);
      return new NumberItem(this._value, this.path, this.doc);
    } else if (ItemType === StringItem) {
      this.parent[this.label] = this._value = String(this.value);
      return new StringItem(this._value, this.path, this.doc);
    } else {
      return super.convertTo(ItemType);
    }
  }
  stringValue () {
    return String(this.value);
  }
}
DateItem.getBoilerplateValue = () => new Date();
DateItem.standardize = ({ value }) => {
  if (typeof value === 'string') {
    value = new Date(value);
  }
  if (value instanceof Date) {
    value = {
      $isDate: true,
      str: value.toString()
    };
  }
  if (!value.$isDate) {
    throw new Error(`Failed to wrap Date object`);
  }
  return value;
};

export default DateItem;
