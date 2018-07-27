import Token from './Token.js';

class MetaToken extends Token {
  * helper (path, obj, selector) {
    for (let key of obj) {
      if (key === selector) {
        yield path.concat([selector, obj[key]]);
      } else if (key[0] === '⌘') {
        yield * this.helper(path.concat([key, obj[key]], obj, selector));
      }
    }
  }
  * navigate (path) {
    const root = path[0];
    if (typeof root !== 'object') { return; }
    const selector = this.mure.pathToSelector(path);
    for (let metaPath of this.helper([root], root, selector)) {
      yield metaPath;
    }
  }
}
MetaToken.REGEX = /^⌘/;
export default MetaToken;
