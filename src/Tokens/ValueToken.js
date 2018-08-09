import BaseToken from './BaseToken.js';

class ValueToken extends BaseToken {
  async * navigate (path) {
    const obj = path[path.length - 2];
    const key = path[path.length - 1];
    const keyType = typeof key;
    if (typeof obj !== 'object' || (keyType !== 'string' && keyType !== 'number')) {
      throw new TypeError(`ValueToken used on a non-object, or without a string / numeric key`);
    }
    yield path.concat([obj[key]]);
  }
}
export default ValueToken;
