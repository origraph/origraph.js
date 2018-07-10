import PrimitiveConstruct from './PrimitiveConstruct.js';

class StringConstruct extends PrimitiveConstruct {}
StringConstruct.JSTYPE = 'string';
StringConstruct.getBoilerplateValue = () => '';
StringConstruct.standardize = ({ value }) => String(value);

export default StringConstruct;
