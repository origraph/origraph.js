import PrimitiveConstruct from './PrimitiveConstruct.js';

class NullConstruct extends PrimitiveConstruct {}
NullConstruct.JSTYPE = 'null';
NullConstruct.getBoilerplateValue = () => null;
NullConstruct.standardize = () => null;

export default NullConstruct;
