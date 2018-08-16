import BaseToken from './BaseToken.js';

class EvaluateToken extends BaseToken {
  async * navigate (wrappedParent) {
    if (typeof wrappedParent.rawItem !== 'string') {
      if (!this.stream.mure.debug) {
        throw new TypeError(`Input to EvaluateToken is not a string`);
      } else {
        return;
      }
    }
    let newStream;
    try {
      newStream = this.stream.fork(wrappedParent.rawItem);
    } catch (err) {
      if (!this.stream.mure.debug || !(err instanceof SyntaxError)) {
        throw err;
      } else {
        return;
      }
    }
    yield * await newStream.iterate();
  }
}
export default EvaluateToken;
