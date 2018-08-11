import BaseToken from './BaseToken.js';

class EvaluateToken extends BaseToken {
  async * navigate (wrappedParent, mode) {
    if (typeof wrappedParent.value !== 'string') {
      throw new TypeError(`Input to EvaluateToken is not a string`);
    }
    let newStream = this.stream.mure.stream({
      stream: this.stream,
      selector: wrappedParent.value,
      functions: this.stream.functions,
      streams: this.stream.streams
    });
    yield * await newStream.iterate({ mode });
  }
}
export default EvaluateToken;
