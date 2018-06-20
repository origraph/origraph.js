import PrimitiveItem from './PrimitiveItem.js';

class StringItem extends PrimitiveItem {}
StringItem.JSTYPE = 'string';
StringItem.getBoilerplateValue = () => '';
StringItem.standardize = ({ value }) => String(value);

export default StringItem;
