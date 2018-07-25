import PrimitiveWrapper from './PrimitiveWrapper.js';

class NullWrapper extends PrimitiveWrapper {}
NullWrapper.JSTYPE = 'null';
NullWrapper.getBoilerplateValue = () => null;
NullWrapper.standardize = () => null;

export default NullWrapper;
