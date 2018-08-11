import md5 from 'blueimp-md5';

const DEFAULT_FUNCTIONS = {
  identity: function * (item, path) { yield item; },
  md5: (item, path) => md5(item),
  noop: () => {}
};

class Stream {
  constructor ({ mure, selector = 'root', functions = {}, streams = {}, mode = 'permissive' }) {
    this.mure = mure;

    this.tokenList = this.parseSelector(selector);

    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.mode = mode;
  }
  get selector () {
    return this.tokenList.join('');
  }
  parseSelector (selectorString) {
    if (!selectorString.startsWith('root')) {
      return null;
    }
    const tokenStrings = selectorString.match(/\.([^(]*)\(([^)]*)\)/g);
    if (!tokenStrings) {
      throw new SyntaxError(`Invalid selector string: ${selectorString}`);
    }
    const tokenList = [];
    tokenStrings.forEach(chunk => {
      const temp = chunk.match(/^.([^(]*)\(([^)]*)\)/);
      if (!temp) {
        throw new SyntaxError(`Invalid token: ${chunk}`);
      }
      const tokenClassName = temp[1][0].toUpperCase() + temp[1].slice(1) + 'Token';
      const argList = temp[2].split(/(?<!\\),/).map(d => d.trim());
      if (tokenClassName === 'ValuesToken') {
        tokenList.push(new this.mure.TOKENS.KeysToken(this, argList));
        tokenList.push(new this.mure.TOKENS.ValueToken(this, []));
      } else if (this.mure.TOKENS[tokenClassName]) {
        tokenList.push(new this.mure.TOKENS[tokenClassName](this, argList));
      } else {
        throw new SyntaxError(`Unknown token: ${temp[1]}`);
      }
    });
    return tokenList;
  }
  async * iterate ({ mode = 'DFS' }) {
    if (mode === 'BFS') {
      throw new Error(`Breadth-first iteration is not yet implemented.`);
    } else if (mode === 'DFS') {
      const deepHelper = this.deepHelper(this.tokenList, mode, [this.mure.root], this.tokenList.length - 1);
      for await (const finishedPath of deepHelper) {
        yield finishedPath;
      }
    }
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  async * deepHelper (tokenList, mode, path0, i) {
    if (i === 0) {
      yield * await tokenList[0].navigate(path0);
    } else {
      for await (let pathI of this.deepHelper(tokenList, path0, mode, i - 1)) {
        yield * await tokenList[i].navigate(pathI);
      }
    }
  }

  extend (TokenClass, argList, functions = {}, streams = {}) {
    const newStream = new Stream({
      mure: this.mure,
      functions: Object.assign({}, this.functions, functions),
      streams: Object.assign({}, this.streams, streams),
      mode: this.mode
    });
    newStream.tokenList = this.tokenList.concat([ new TokenClass(newStream, argList) ]);
    return newStream;
  }

  isSuperSetOfTokenList (tokenList) {
    if (tokenList.length !== this.tokenList.length) { return false; }
    return this.tokenList.every((token, i) => token.isSuperSetOf(tokenList[i]));
  }
}
export default Stream;
