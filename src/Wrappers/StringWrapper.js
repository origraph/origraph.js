import PrimitiveWrapper from './PrimitiveWrapper.js';

class StringWrapper extends PrimitiveWrapper {}
StringWrapper.JSTYPE = 'string';
StringWrapper.getBoilerplateValue = () => '';
StringWrapper.standardize = ({ value }) => {
  if (isNaN(value) || value === undefined) {
    return String(value);
  } else {
    JSON.stringify(value);
  }
};

export default StringWrapper;
