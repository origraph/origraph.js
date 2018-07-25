import PrimitiveWrapper from './PrimitiveWrapper.js';

class NumberWrapper extends PrimitiveWrapper {}
NumberWrapper.JSTYPE = 'number';
NumberWrapper.getBoilerplateValue = () => 0;
NumberWrapper.standardize = ({ value }) => Number(value);
NumberWrapper.isBadValue = isNaN;

export default NumberWrapper;
