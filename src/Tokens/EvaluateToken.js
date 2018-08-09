import BaseToken from './BaseToken.js';

class EvaluateToken extends BaseToken {
  async * navigate (path, mode) {
    let newStream = path[path.length - 1];
    if (typeof newStream !== 'string') {
      throw new TypeError(`Input to EvaluateToken is not a string`);
    }
    try {
      newStream = this.stream.mure.stream({
        stream: this.stream,
        selector: newStream,
        functions: this.stream.functions,
        streams: this.stream.streams
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return;
      } else {
        throw err;
      }
    }
    yield * await newStream.iterate({ mode });
  }
}
export default EvaluateToken;
