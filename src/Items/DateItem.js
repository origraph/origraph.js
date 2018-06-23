import PrimitiveItem from './PrimitiveItem.js';

class DateItem extends PrimitiveItem {
  constructor ({ mure, value, path, doc }) {
    super(mure, DateItem.standardize(value), path, doc);
  }
  get value () { return new Date(this._value.str); }
  set value (newValue) {
    super.value = DateItem.standardize(newValue);
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
