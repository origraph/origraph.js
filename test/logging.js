const JsDiff = require('diff');
const chalk = require('chalk');

module.exports = {
  testStringEquality: (a, b, testName) => {
    if (a === b) {
      return {
        passed: true,
        details: ''
      };
    } else {
      let diff = JsDiff.diffChars(a, b);
      let result = {
        passed: false,
        details: diff.map(part => {
          if (part.added) {
            return chalk`{hex('#e6f5c9').bgHex('#2b450d') ${part.value}}`;
          } else if (part.removed) {
            return chalk`{hex('#f4cae4').bgHex('#6e0c3f') ${part.value}}`;
          } else {
            return chalk`{hex('#ffffff').bgHex('#333333') ${part.value}}`;
          }
        }).join('')
      };
      return result;
    }
  }
};
