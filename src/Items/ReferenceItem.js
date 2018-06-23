import StringItem from './StringItem.js';

class ReferenceItem extends StringItem {}
ReferenceItem.getBoilerplateValue = () => '@$';

export default ReferenceItem;
