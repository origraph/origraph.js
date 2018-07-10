import PrimitiveConstruct from './PrimitiveConstruct.js';

class DateConstruct extends PrimitiveConstruct {
  constructor ({ mure, value, path, doc }) {
    super({ mure, value: DateConstruct.standardize(value), path, doc });
  }
  get value () { return new Date(this._value.str); }
  set value (newValue) {
    super.value = DateConstruct.standardize(newValue);
  }
  stringValue () {
    return String(this.value);
  }
}
DateConstruct.getBoilerplateValue = () => new Date();
DateConstruct.standardize = ({ value }) => {
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

export default DateConstruct;
