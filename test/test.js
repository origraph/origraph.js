const chalk = require('chalk');
const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
const pkg = require('../package.json');

const tests = [
  () => {
    return [{
      name: 'Version check',
      result: logging.testStringEquality(pkg.version, mure.version)
    }];
  },
  () => {
    let svg = mure.d3n.createSVG(500, 500);
    svg.append('g');
    svg.select('g').classed('test', true);
    return [{
      name: 'Simple d3n test',
      result: logging.testStringEquality(mure.d3n.svgString(),
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g class="test"></g></svg>')
    }];
  }
];

let totalTests = 0;
let numPassed = tests.reduce((count, testFunction, index) => {
  let results = testFunction();
  totalTests += results.length;
  return count + results.reduce((subCount, subTest, subIndex) => {
    let testName = subTest.name || 'Test ' + index + '.' + subIndex;
    let mainMessage = subTest.result.passed ? chalk`{bold.hex('#666666') Passed ${testName}}` : chalk`{bold.hex('#e7298a') Failed ${testName}}`;
    console.log(mainMessage);
    if (subTest.result.details) {
      console.log('Details:\n' + subTest.result.details);
    }
    console.log('');
    return subTest.result.passed ? subCount + 1 : subCount;
  }, 0);
}, 0);
if (numPassed === totalTests) {
  console.log(chalk`{bold.hex('#666666') Passed ${numPassed} out of ${tests.length} tests\n\n}`);
  process.exit(0);
} else {
  console.error(chalk`{bold.hex('#e7298a') Failed ${tests.length - numPassed} of ${tests.length} tests\n\n}`);
  process.exit(1);
}
