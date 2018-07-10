import PrimitiveConstruct from './PrimitiveConstruct.js';

class NumberConstruct extends PrimitiveConstruct {}
NumberConstruct.JSTYPE = 'number';
NumberConstruct.getBoilerplateValue = () => 0;
NumberConstruct.standardize = ({ value }) => Number(value);

export default NumberConstruct;
