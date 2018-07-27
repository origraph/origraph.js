import Token from './Token.js';

class MetaToken extends Token {
  * helper (path, parentMetaPath) {
    const obj = parentMetaPath[parentMetaPath.length - 1];
    for (let key of obj) {
      const metaPath = path.concat([key, obj[key]]);
      if (key[0] === '⌘') {
        yield * this.helper(path, metaPath);
      } else {
        const superPath = this.mure.parseSelector(key);
        if (this.mure.pathSupersedes(superPath, path)) {
          yield metaPath;
        }
      }
    }
  }
  * navigate (path) {
    const root = path[0];
    if (typeof root !== 'object') { return; }
    for (let metaPath of this.helper([root], root)) {
      yield metaPath;
    }
  }
}
MetaToken.REGEX = /^⌘/;
export default MetaToken;
