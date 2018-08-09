import Introspectable from '../Common/Introspectable.js';

class BaseToken extends Introspectable {
  constructor (stream) {
    super();
    this.stream = stream;
  }
  toString () {
    // The string version of most tokens can just be derived from the class type
    return `.${this.type.toLowerCase()}()`;
  }
  async * navigate (path, mode) {
    throw new Error(`This function should be overridden`);
  }
}
Object.defineProperty(BaseToken, 'type', {
  get () {
    return /(.*)Token/.exec(this.name)[1];
  }
});
export default BaseToken;
