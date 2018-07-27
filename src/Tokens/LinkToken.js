import Token from './Token.js';

class LinkToken extends Token {
  async * navigate (path) {
    const url = path[path.length - 1];
    if (typeof url !== 'string') { return; }
    yield await this.mure.fetch(url);
  }
}
LinkToken.REGEX = /^🔗/;
export default LinkToken;
