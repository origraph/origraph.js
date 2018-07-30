import Token from './Token.js';

class KeyToken extends Token {
  constructor (mure, matchedChunk = '', { matchAll, keys, ranges }) {
    super(mure);
    if (keys || ranges) {
      this.keys = keys;
      this.ranges = ranges;
    } else if (matchedChunk === '*' || matchAll) {
      this.matchAll = true;
    } else {
      matchedChunk.split(',').forEach(key => {
        let temp = key.match(/(\d+)-(\d+)/);
        temp = temp ? temp.map(d => d.parseInt(d)) : null;
        if (temp && !isNaN(temp[1]) && !isNaN(temp[2])) {
          for (let i = temp[1]; i <= temp[2]; i++) {
            this.ranges = this.ranges || [];
            this.ranges.push({ low: temp[1], high: temp[2] });
          }
          return;
        }
        temp = key.match(/'(.*)'/);
        temp = temp && temp[1] ? temp[1] : key;
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
        throw new SyntaxError(`Bad token key(s) / range(s): ${matchedChunk}`);
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
  union (otherToken) {
    if (!(otherToken instanceof KeyToken)) {
      return null;
    } else if (this.matchAll || otherToken.matchAll) {
      return new KeyToken(this.mure, null, { matchAll: true });
    } else {
      let keysAndRanges = {
        keys: Object.assign({}, this.keys, otherToken.keys),
        ranges: this.consolidateRanges((this.ranges || []).concat(otherToken.ranges || []))
      };
      return new KeyToken(this.mure, null, keysAndRanges);
    }
  }
  difference (otherToken) {
    // Compute what is left of this after subtracting out everything in otherToken
    if (!(otherToken instanceof KeyToken)) {
      throw new Error(`Can't compute the difference of two different token types`);
    } else if (otherToken.matchAll) {
      return null;
    } else if (this.matchAll) {
      console.warn(`Inaccurate difference computed! TODO: need to figure out how to invert categorical keys!`);
      return this;
    } else {
      const newKeys = {};
      for (let key in (this.keys || {})) {
        if (!otherToken.keys || !otherToken.keys[key]) {
          newKeys[key] = true;
        }
      }
      let newRanges = [];
      if (this.ranges) {
        if (otherToken.ranges) {
          let allPoints = this.ranges.reduce((agg, range) => {
            return agg.concat([
              { include: true, low: true, value: range.low },
              { include: true, high: true, value: range.high }
            ]);
          }, []);
          allPoints = allPoints.concat(otherToken.ranges.reduce((agg, range) => {
            return agg.concat([
              { exclude: true, low: true, value: range.low },
              { exclude: true, high: true, value: range.high }
            ]);
          }, [])).sort();
          let currentRange = null;
          for (let i = 0; i < allPoints.length; i++) {
            if (currentRange === null) {
              if (allPoints[i].include && allPoints[i].low) {
                currentRange = { low: allPoints[i].value };
              }
            } else if (allPoints[i].include && allPoints[i].high) {
              currentRange.high = allPoints[i].value;
              if (currentRange.high >= currentRange.low) {
                newRanges.push(currentRange);
              }
              currentRange = null;
            } else if (allPoints[i].exclude) {
              if (allPoints[i].low) {
                currentRange.high = allPoints[i].low - 1;
                if (currentRange.high >= currentRange.low) {
                  newRanges.push(currentRange);
                }
                currentRange = null;
              } else if (allPoints[i].high) {
                currentRange.low = allPoints[i].high + 1;
              }
            }
          }
        } else {
          newRanges = this.ranges;
        }
      }
      return new KeyToken(this.mure, null, { keys: newKeys, ranges: newRanges });
    }
  }
  isSuperSetOf (otherToken) {
    if (!(otherToken instanceof KeyToken)) {
      return false;
    } else {
      const diff = otherToken.difference(this);
      return diff === null || diff.selectsNothing;
    }
  }
  toString () {
    if (this.matchAll) { return '[*]'; }
    return '[' + this.ranges.map(({low, high}) => `${low}-${high}`)
      .concat(Object.keys(this.keys).map(key => `'${key}'`))
      .join(',') + ']';
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
      for (let {low, high} of this.ranges || []) {
        for (let i = low; i <= high; i++) {
          yield path.concat([i]);
        }
      }
      for (let key in this.keys || {}) {
        if (lastElement.hasOwnProperty(key)) {
          yield path.concat([key]);
        }
      }
    }
  }
}
KeyToken.REGEX = /^\[([^\]]*)\]/;
export default KeyToken;
