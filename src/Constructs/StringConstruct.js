import PrimitiveConstruct from './PrimitiveConstruct.js';

class StringConstruct extends PrimitiveConstruct {}
StringConstruct.JSTYPE = 'string';
StringConstruct.getBoilerplateValue = () => '';
StringConstruct.standardize = ({ value }) => {
  if (isNaN(value) || value === undefined) {
    return String(value);
  } else {
    JSON.stringify(value);
  }
};

export default StringConstruct;
