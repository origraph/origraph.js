import PrimitiveConstruct from './PrimitiveConstruct.js';

class BooleanConstruct extends PrimitiveConstruct {}
BooleanConstruct.JSTYPE = 'boolean';
BooleanConstruct.getBoilerplateValue = () => false;
BooleanConstruct.standardize = ({ value }) => !!value;

export default BooleanConstruct;
