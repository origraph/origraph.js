import Token from './Token.js';

class ParentToken extends Token {
  * navigate (path) {
    yield path.slice(0, path.length - 1);
  }
}
ParentToken.REGEX = /^←/;
export default ParentToken;
