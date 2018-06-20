import PrimitiveItem from './PrimitiveItem.js';

class NullItem extends PrimitiveItem {}
NullItem.JSTYPE = 'null';
NullItem.getBoilerplateValue = () => null;
NullItem.standardize = () => null;

export default NullItem;
