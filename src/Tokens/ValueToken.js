import BaseToken from './BaseToken.js';

class ValueToken extends BaseToken {
  async * navigate (wrappedParent) {
    const obj = wrappedParent && wrappedParent.wrappedParent && wrappedParent.wrappedParent.rawItem;
    const key = wrappedParent && wrappedParent.rawItem;
    const keyType = typeof key;
    if (typeof obj !== 'object' || (keyType !== 'string' && keyType !== 'number')) {
      if (!this.stream.mure.debug) {
        throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
      } else {
        return;
      }
    }
    yield this.stream.wrap({
      wrappedParent,
      token: this,
      rawItem: obj[key]
    });
  }
}
export default ValueToken;
