import md5 from 'blueimp-md5';

const DEFAULT_FUNCTIONS = {
  identity: function * (wrappedParent) { yield wrappedParent.rawItem; },
  md5: (wrappedParent) => md5(wrappedParent.rawItem),
  noop: () => {}
};

class Stream {
  constructor ({
    mure,
    selector = 'root',
    functions = {},
    streams = {},
    errorMode = 'permissive',
    traversalMode = 'DFS'
  }) {
    this.mure = mure;

    this.tokenList = this.parseSelector(selector);

    this.functions = Object.assign({}, DEFAULT_FUNCTIONS, functions);
    this.streams = streams;
    this.errorMode = errorMode;
    this.traversalMode = traversalMode;
  }
  get selector () {
    return this.tokenList.join('');
  }
  parseSelector (selectorString) {
    if (!selectorString.startsWith('root')) {
      throw new SyntaxError(`Selectors must start with 'root'`);
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
  async * iterate () {
    if (this.traversalMode === 'BFS') {
      throw new Error(`Breadth-first iteration is not yet implemented.`);
    } else if (this.traversalMode === 'DFS') {
      const deepHelper = this.deepHelper(this.tokenList, this.tokenList.length - 1);
      for await (const finishedPath of deepHelper) {
        yield finishedPath;
      }
    } else {
      throw new Error(`Unknown traversalMode: ${this.traversalMode}`);
    }
  }
  /**
   * This helps depth-first iteration (we only want to yield finished paths, so
   * it lazily asks for them one at a time from the *final* token, recursively
   * asking each preceding token to yield dependent paths only as needed)
   */
  async * deepHelper (tokenList, i) {
    if (i === 0) {
      yield * await tokenList[0].navigate(); // The first token is always the root
    } else {
      for await (let wrappedParent of this.deepHelper(tokenList, i - 1)) {
        try {
          yield * await tokenList[i].navigate(wrappedParent);
        } catch (err) {
          if (this.errorMode !== 'permissive' ||
            !(err instanceof TypeError && err instanceof SyntaxError)) {
            throw err;
          }
        }
      }
    }
  }

  async * sample ({ limit = 10 }) {
    const iterator = await this.iterate();
    for (let i = 0; i < limit; i++) {
      yield iterator.next().value;
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
