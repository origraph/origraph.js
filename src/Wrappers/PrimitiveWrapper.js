import TypedWrapper from './TypedWrapper.js';

class PrimitiveWrapper extends TypedWrapper {
  stringValue () {
    return String(this.value);
  }
}

export default PrimitiveWrapper;
