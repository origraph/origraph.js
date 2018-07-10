import TypedConstruct from './TypedConstruct.js';

class PrimitiveConstruct extends TypedConstruct {
  stringValue () {
    return String(this.value);
  }
}

export default PrimitiveConstruct;
