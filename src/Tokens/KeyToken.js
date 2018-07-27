import Token from './Token.js';

class KeyToken extends Token {
  constructor (mure, matchedChunk, tokensToMerge) {
    super(mure);
    if (tokensToMerge) {
      if (tokensToMerge[0].matchAll || tokensToMerge[1].matchAll) {
        this.matchAll = true;
      } else if (tokensToMerge[0].keys || tokensToMerge[1].keys) {
        this.keys = Object.assign({}, tokensToMerge[0].keys, tokensToMerge[1].keys);
      }
    } else if (matchedChunk === '*') {
      this.matchAll = true;
    } else {
      matchedChunk.split(',').forEach(key => {
        let temp = key.match(/'(.*)'/);
        if (temp && temp[1]) {
          this.keys = this.keys || {};
          this.keys[temp[1]] = true;
          return;
        }
        temp = key.match(/(\d+)-(\d+)/);
        temp = temp ? temp.map(d => d.parseInt(d)) : null;
        if (temp && !isNaN(temp[1]) && !isNaN(temp[2])) {
          // TODO: in the event of large ranges, the enumeration of indices is
          // best handled inside evaluate (the thing that's allowed to be
          // expensive), not here (this should be as quick as possible). I
          // should store ranges in a separate this.ranges dict, and merge those
          // intelligently in this.merge()
          for (let i = temp[1]; i <= temp[2]; i++) {
            this.keys = this.keys || {};
            this.keys[i] = true;
          }
          return;
        }
        temp = parseInt(key);
        if (isNaN(temp)) {
          this.keys = this.keys || {};
          this.keys[temp] = true;
        }
      });
    }
    if (!this.matchAll && !this.keys) {
      throw new SyntaxError(`Bad token: ${matchedChunk}`);
    }
  }
  merge (otherToken) {
    if (otherToken.constructor === KeyToken) {
      return new KeyToken(null, [this, otherToken]);
    } else {
      return null;
    }
  }
  isSuperSetOf (otherToken) {
    if (otherToken.constructor !== KeyToken) {
      return false;
    } else if (otherToken.matchAll) {
      return !!this.matchAll;
    } else {
      return Object.keys(otherToken.keys).every(key => {
        if (key[0] === '⌘') {
          return this.keys[key];
        } else {
          return !!this.matchAll || this.keys[key];
        }
      });
    }
  }
  toString () {
    return this.matchAll ? '[*]' : `['${Object.keys(this.keys).sort().join(`','`)}']`;
  }
  * navigate (path) {
    const lastElement = path[path.length - 1];
    if (typeof lastElement !== 'object') { return; }
    if (this.matchAll) {
      for (let key in lastElement) {
        if (key[0] === '⌘') { continue; }
        yield path.concat([key]);
      }
    } else {
      for (let key in this.keys) {
        if (lastElement.hasOwnProperty(key)) {
          yield path.concat([key]);
        }
      }
    }
  }
}
KeyToken.REGEX = /^\[([^\]]*)\]/;
export default KeyToken;
