import PrimitiveItem from './PrimitiveItem.js';

class NumberItem extends PrimitiveItem {}
NumberItem.JSTYPE = 'number';
NumberItem.getBoilerplateValue = () => 0;
NumberItem.standardize = ({ value }) => Number(value);

export default NumberItem;
