import PrimitiveItem from './PrimitiveItem.js';

class BooleanItem extends PrimitiveItem {}
BooleanItem.JSTYPE = 'boolean';
BooleanItem.getBoilerplateValue = () => false;
BooleanItem.standardize = ({ value }) => !!value;

export default BooleanItem;
