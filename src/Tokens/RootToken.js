import Token from './Token.js';

class RootToken extends Token {
  * navigate (path) {
    yield [path[0]];
  }
}
RootToken.REGEX = /^\$/;
export default RootToken;
