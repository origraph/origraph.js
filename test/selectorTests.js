const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
require('events').EventEmitter.defaultMaxListeners = 30;

module.exports = [
  async () => {
    return new Promise((resolve, reject) => {
      const dataFiles = {
        blackJack_round1: './data/blackJack_round1',
        blackJack_round2: './data/blackJack_round2',
        hearts_round1: './data/hearts_round1',
        hearts_round2: './data/hearts_round2',
        hearts_round3: './data/hearts_round3'
      };
      let uploadPromises = [];
      Object.keys(dataFiles).forEach(f => {
        dataFiles[f] = require(dataFiles[f]);
        uploadPromises.push(mure.uploadString(
          f + '.json', 'application/json', 'UTF-8',
          JSON.stringify(dataFiles[f])));
      });

      const testResults = {
        singleFile: './data/singleFileSelectorTests',
        multiFile: './data/multiFileSelectorTests'
      };
      Object.keys(testResults).forEach(f => {
        testResults[f] = require(testResults[f]);
      });
      [
        './data/blackJack_round1',
        './data/blackJack_round2',
        './data/hearts_round1',
        './data/hearts_round2',
        './data/hearts_round3',
        './data/singleFileSelectorTests',
        './data/multiFileSelectorTests'
      ].forEach(path => {
        let filename = /.\/data\/(.*)/.exec(path)[1];
        dataFiles[filename] = require(path);
      });
      (async () => {
        let tests = [];

        let uploadMessages = await Promise.all(uploadPromises);
        let allUploaded = uploadMessages.reduce((agg, m) => agg && m.ok, true);

        tests.push({
          name: 'Upload files for selector testing',
          result: {
            passed: allUploaded,
            details: allUploaded
              ? undefined : 'Messages:\n' + JSON.stringify(uploadMessages, null, 2)
          }
        });

        // Single-document selection tests
        let docSelection = mure.selectDoc('application/json;blackJack_round1.json');
        let selectors = Object.keys(testResults.singleFile);
        for (let i = 0; i < selectors.length; i += 1) {
          let selector = selectors[i];
          let selection = docSelection.selectAll(selector);
          let expectedObjs = testResults.singleFile[selector];
          let docs = await selection.docs();
          let selectedObjs = selection.items(docs).map(n => n.value);
          tests.push({
            name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
            result: logging.testObjectEquality(expectedObjs, selectedObjs)
          });
        }

        // Multi-document selection tests
        selectors = Object.keys(testResults.multiFile);
        let cachedSelections = {};
        for (let i = 0; i < selectors.length; i += 1) {
          let selector = selectors[i];
          let selection = mure.selectAll(selector);
          cachedSelections[selector] = selection;
          let expectedObjs = testResults.multiFile[selector];
          let docs = await selection.docs();
          let selectedObjs = selection.items(docs).map(n => n.value);
          tests.push({
            name: 'mure.selectAll(\'' + selector + '\')',
            result: logging.testObjectEquality(expectedObjs, selectedObjs)
          });
        }

        resolve(tests);
      })();
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      let selection = mure.selectAll();
      resolve([{
        name: 'headless selection test',
        result: {
          passed: selection.headless === true,
          details: selection.headless ? undefined : 'Headless value: ' + selection.headless
        }
      }]);
    });
  }
];
