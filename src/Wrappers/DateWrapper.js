import PrimitiveWrapper from './PrimitiveWrapper.js';

class DateWrapper extends PrimitiveWrapper {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value: DateWrapper.standardize(value), path, doc });
  }
  get value () { return new Date(this._value.str); }
  set value (newValue) {
    super.value = DateWrapper.standardize(newValue);
  }
  stringValue () {
    return String(this.value);
  }
}
DateWrapper.getBoilerplateValue = () => new Date();
DateWrapper.standardize = ({ value }) => {
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
DateWrapper.isBadValue = value => value.toString() !== 'Invalid Date';

export default DateWrapper;
