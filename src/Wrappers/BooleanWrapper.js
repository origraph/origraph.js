import PrimitiveWrapper from './PrimitiveWrapper.js';

class BooleanWrapper extends PrimitiveWrapper {}
BooleanWrapper.JSTYPE = 'boolean';
BooleanWrapper.getBoilerplateValue = () => false;
BooleanWrapper.standardize = ({ value }) => !!value;

export default BooleanWrapper;
