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
      newStream = this.stream.mure.stream({
        selector: wrappedParent.rawItem,
        functions: this.stream.functions,
        streams: this.stream.streams,
        traversalMode: this.stream.traversalMode
      });
    } catch (err) {
      if (!this.stream.mure.debug || !(err instanceof SyntaxError)) {
        throw err;
      } else {
        return;
      }
    }
    const iterator = await newStream.iterate();
    yield * iterator;
  }
}
export default EvaluateToken;
