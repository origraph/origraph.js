import BaseToken from './BaseToken.js';

class EvaluateToken extends BaseToken {
  async * navigate (wrappedParent) {
    if (typeof wrappedParent.value !== 'string') {
      throw new TypeError(`Input to EvaluateToken is not a string`);
    }
    let newStream = this.stream.mure.stream({
      selector: wrappedParent.value,
      functions: this.stream.functions,
      streams: this.stream.streams,
      errorMode: this.stream.errorMode,
      traversalMode: this.stream.traversalMode
    });
    yield * await newStream.iterate();
  }
}
export default EvaluateToken;
