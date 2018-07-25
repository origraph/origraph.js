import StringWrapper from './StringWrapper.js';

class ReferenceWrapper extends StringWrapper {}
ReferenceWrapper.getBoilerplateValue = () => '@$';

export default ReferenceWrapper;
