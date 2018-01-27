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
      let result = { passed: false };
      try {
        let diff = JsDiff.diffChars(a, b);
        result.details = diff.map(part => {
          if (part.added) {
            return chalk`{hex('#e6f5c9').bgHex('#2b450d') ${part.value}}`;
          } else if (part.removed) {
            return chalk`{hex('#f4cae4').bgHex('#6e0c3f') ${part.value}}`;
          } else {
            return chalk`{hex('#ffffff').bgHex('#333333') ${part.value}}`;
          }
        }).join('');
      } catch (error) {
        result.details = error.message;
      }
      return result;
    }
  }
};
