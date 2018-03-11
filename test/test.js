const chalk = require('chalk');
const basicTests = require('./basicTests.js');
const docTests = require('./docTests.js');
const selectorTests = require('./selectorTests.js');

const tests = [
  ...basicTests,
  ...docTests,
  ...selectorTests
];
let totalTests = 0;
let numPassed = 0;
let index = 0;
(async () => {
  while (tests.length > 0) {
    let testFunc = tests.shift();
    index += 1;
    let testResults;
    try {
      testResults = await testFunc();
    } catch (err) {
      testResults = [{
        passed: false,
        result: {
          name: 'Error thrown in test ' + index,
          details: JSON.stringify(err, null, 2)
        }
      }];
    }

    totalTests += testResults.length;
    numPassed += testResults.reduce((subCount, subTest, subIndex) => {
      let testName = subTest.name || 'Test ' + index + '.' + subIndex;
      let mainMessage = subTest.result.passed ? chalk`{bold.hex('#666666') Passed ${testName}}` : chalk`{bold.hex('#e7298a') Failed ${testName}}`;
      console.log(mainMessage);
      if (subTest.result.details) {
        console.log('Details:\n' + subTest.result.details);
      }
      console.log('');
      return subTest.result.passed ? subCount + 1 : subCount;
    }, 0);
  }
  if (numPassed === totalTests) {
    console.log(chalk`{bold.hex('#666666') Passed ${numPassed} out of ${totalTests} tests\n\n}`);
    process.exit(0);
  } else {
    console.error(chalk`{bold.hex('#e7298a') Failed ${totalTests - numPassed} of ${totalTests} tests\n\n}`);
    process.exit(1);
  }
})();
