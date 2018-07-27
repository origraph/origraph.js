import Token from './Token.js';

class ReferenceToken extends Token {
  async * navigate (path) {
    let selection = path[path.length - 1];
    if (typeof selection !== 'string') { return; }
    try {
      selection = this.mure.selectAll(selection);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return;
      } else {
        throw err;
      }
    }
    yield * await selection.iterate({ startWithPath: path });
  }
}
ReferenceToken.REGEX = /^↬/;
export default ReferenceToken;
