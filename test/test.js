const chalk = require('chalk');
const basicTests = require('./basicTests.js');
const defaultDocTests = require('./defaultDocTests.js');

const tests = [
  ...basicTests,
  ...defaultDocTests
];

(async () => {
  let totalTests = 0;
  let allResults = await Promise.all(tests.map(f => { return f(); }));
  let numPassed = allResults.reduce((count, subResults, index) => {
    totalTests += subResults.length;
    return count + subResults.reduce((subCount, subTest, subIndex) => {
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
})();
