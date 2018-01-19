const chalk = require('chalk');
const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');

const tests = [
  {
    execute: () => {
      let svg = mure.d3n.createSVG(500, 500);
      svg.append('g');
      svg.select('g').classed('test', true);
      return logging.testStringEquality(mure.d3n.svgString(),
        '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g class="test"></g></svg>');
    }
  }
];

let numPassed = tests.reduce((count, test, index) => {
  let result = test.execute();
  let testName = test.name || 'Test ' + index;
  let mainMessage = result.passed ? chalk`{bold.hex('#666666') Passed ${testName}}` : chalk`{bold.hex('#e7298a') Failed ${testName}}`;
  console.log(mainMessage);
  if (result.details) {
    console.log('Details:\n' + result.details);
  }
  console.log('');
  return result.passed ? count + 1 : count;
}, 0);
if (numPassed === tests.length) {
  console.log(chalk`{bold.hex('#666666') Passed ${numPassed} out of ${tests.length} tests\n\n}`);
  process.exit(0);
} else {
  console.error(chalk`{bold.hex('#e7298a') Failed ${tests.length - numPassed} of ${tests.length} tests\n\n}`);
  process.exit(1);
}
