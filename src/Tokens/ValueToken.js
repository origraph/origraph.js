import Token from './Token.js';

class ValueToken extends Token {
  * navigate (path) {
    if (path.length < 2) { return; }
    const obj = path[path.length - 2];
    const key = path[path.length - 1];
    const keyType = typeof key;
    if (typeof obj !== 'object' || (keyType !== 'string' && keyType !== 'number')) {
      return;
    }
    yield path.concat([key]);
  }
}
ValueToken.REGEX = /^→/;
export default ValueToken;
