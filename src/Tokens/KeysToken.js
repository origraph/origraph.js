import BaseToken from './BaseToken.js';

class KeysToken extends BaseToken {
  constructor (stream, argList, { matchAll, keys, ranges }) {
    super(stream);
    if (keys || ranges) {
      this.keys = keys;
      this.ranges = ranges;
    } else if ((argList && argList.length === 0) || matchAll) {
      this.matchAll = true;
    } else {
      argList.forEach(arg => {
        let temp = arg.match(/(\d+)-([\d∞]+)/);
        if (temp && temp[2] === '∞') {
          temp[2] = Infinity;
        }
        temp = temp ? temp.map(d => d.parseInt(d)) : null;
        if (temp && !isNaN(temp[1]) && !isNaN(temp[2])) {
          for (let i = temp[1]; i <= temp[2]; i++) {
            this.ranges = this.ranges || [];
            this.ranges.push({ low: temp[1], high: temp[2] });
          }
          return;
        }
        temp = arg.match(/'(.*)'/);
        temp = temp && temp[1] ? temp[1] : arg;
        let num = Number(temp);
        if (isNaN(num) || num !== parseInt(temp)) { // leave non-integer numbers as strings
          this.keys = this.keys || {};
          this.keys[temp] = true;
        } else {
          this.ranges = this.ranges || [];
          this.ranges.push({ low: num, high: num });
        }
      });
      if (!this.keys && !this.ranges) {
        throw new SyntaxError(`Bad token key(s) / range(s): ${JSON.stringify(argList)}`);
      }
    }
    if (this.ranges) {
      this.ranges = this.consolidateRanges(this.ranges);
    }
  }
  get selectsNothing () {
    return !this.matchAll && !this.keys && !this.ranges;
  }
  consolidateRanges (ranges) {
    // Merge any overlapping ranges
    const newRanges = [];
    const temp = ranges.sort((a, b) => a.low - b.low);
    let currentRange = null;
    for (let i = 0; i < temp.length; i++) {
      if (!currentRange) {
        currentRange = temp[i];
      } else if (temp[i].low <= currentRange.high) {
        currentRange.high = temp[i].high;
      } else {
        newRanges.push(currentRange);
        currentRange = temp[i];
      }
    }
    if (currentRange) {
      // Corner case: add the last range
      newRanges.push(currentRange);
    }
    return newRanges.length > 0 ? newRanges : undefined;
  }
  isSuperSetOf (otherToken) {
    if (!(otherToken instanceof KeysToken)) {
      return false;
    } else {
      const diff = otherToken.difference(this);
      return diff === null || diff.selectsNothing;
    }
  }
  toString () {
    if (this.matchAll) { return '.keys()'; }
    return '.keys(' + this.ranges.map(({low, high}) => `${low}-${high}`)
      .concat(Object.keys(this.keys).map(key => `'${key}'`))
      .join(',') + ')';
  }
  async * navigate (wrappedParent) {
    if (typeof wrappedParent.rawItem !== 'object') {
      throw new TypeError(`Input to KeysToken is not an object`);
    }
    if (this.matchAll) {
      for (let key in wrappedParent.rawItem) {
        yield this.stream.mure.wrap({
          wrappedParent,
          token: this,
          rawItem: key
        });
      }
    } else {
      for (let {low, high} of this.ranges || []) {
        low = Math.max(0, low);
        high = Math.min(wrappedParent.rawItem.length - 1, high);
        for (let i = low; i <= high; i++) {
          if (wrappedParent.rawItem[i] !== undefined) {
            yield this.stream.mure.wrap({
              wrappedParent,
              token: this,
              rawItem: i
            });
          }
        }
      }
      for (let key in this.keys || {}) {
        if (wrappedParent.rawItem.hasOwnProperty(key)) {
          yield this.stream.mure.wrap({
            wrappedParent,
            token: this,
            rawItem: key
          });
        }
      }
    }
  }
}
export default KeysToken;
