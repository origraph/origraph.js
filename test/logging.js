const JsDiff = require('diff');
const chalk = require('chalk');

let logging = {
  testBasicEquality: (a, b) => {
    return { passed: a === b };
  },
  getBasicEqualityDetails: (a, b) => {
    if (a !== b) {
      let aStr = JSON.stringify(a, null, 2);
      let bStr = JSON.stringify(b, null, 2);
      return chalk`{bold.hex('#e7298a') ${aStr} !== ${bStr}}`;
    } else {
      return '';
    }
  },
  testStringEquality: (a, b) => {
    if (logging.testBasicEquality(a, b).passed) {
      return { passed: true };
    }
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
  },
  getTypeMismatchDetails: (a, b) => {
    return chalk`{bold.hex('#e7298a') Type Mismatch:\n}` +
      chalk`{bold.hex('#e7298a') A:}` +
      JSON.stringify(a, null, 2) + '\n' +
      chalk`{bold.hex('#e7298a') B:}` +
      JSON.stringify(b, null, 2);
  },
  getSizeMismatchDetails: (a, b, objType) => {
    return chalk`{bold.hex('#e7298a') ${objType}s have different size: }` +
      chalk`{bold.hex('#e7298a') A:} ${a.length} ` +
      chalk`{bold.hex('#e7298a') B:} ${b.length}`;
  },
  appendObjMismatchDetails: (a, b, result) => {
    if (!result.cause) {
      result.cause = result.details;
    }
    result.details = result.cause + '\n\n' +
      chalk`{bold.hex('#e7298a') Full objects:\n}` +
      chalk`{bold.hex('#e7298a') A:}` +
      JSON.stringify(a, null, 2) + '\n' +
      chalk`{bold.hex('#e7298a') B:}` +
      JSON.stringify(b, null, 2);
    return result;
  },
  testObjectEquality: (a, b) => {
    if (logging.testBasicEquality(a, b).passed) {
      return { passed: true };
    }
    let result = { passed: false };

    try {
      let aType = typeof a;
      let bType = typeof b;
      if (aType !== bType) {
        result.details = logging.getTypeMismatchDetails(a, b);
        return result;
      } else {
        if (aType === 'string') {
          return logging.testStringEquality(a, b);
        } else if (aType === 'object') {
          if (a instanceof Array) {
            if (!(b instanceof Array)) {
              result.details = logging.getTypeMismatchDetails(a, b);
              return result;
            } else {
              if (a.length !== b.length) {
                result.details = logging.getSizeMismatchDetails(a, b, 'Array');
                result = logging.appendObjMismatchDetails(a, b, result);
                return result;
              } else if (!a.every((aChild, index) => {
                result = logging.testObjectEquality(aChild, b[index]);
                if (!result.passed) {
                  result = logging.appendObjMismatchDetails(a, b, result);
                }
                return result.passed;
              })) { return result; }
            }
          } else {
            let aKeys = Object.keys(a);
            let bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) {
              result.details = logging.getSizeMismatchDetails(aKeys, bKeys, 'Object');
              result = logging.appendObjMismatchDetails(a, b, result);
              return result;
            } else if (!aKeys.every(key => {
              result = logging.testObjectEquality(a[key], b[key]);
              if (!result.passed) {
                result = logging.appendObjMismatchDetails(a, b, result);
              }
              return result.passed;
            })) { return result; }
          }
        }
      }
    } catch (error) {
      result.details = error.message;
      return result;
    }
    result.passed = true;
    return result;
  }
};
module.exports = logging;
