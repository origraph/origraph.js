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
        hearts_round3: './data/hearts_round3',
        crossGameLinks: './data/crossGameLinks'
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

      (async () => {
        let tests = [];

        let uploadMessages = await Promise.all(uploadPromises);
        let allUploaded = uploadMessages.reduce((agg, m) => agg && m, true);

        tests.push({
          name: 'Upload files for selector testing',
          result: {
            passed: allUploaded
          }
        });

        // Single-document selection tests
        let docSelection = mure.selectDoc('application/json;blackJack_round1.json');
        let selectors = Object.keys(testResults.singleFile);
        for (let i = 0; i < selectors.length; i += 1) {
          let selector = selectors[i];
          let selection = docSelection.selectAll(selector);
          let expectedObjs = testResults.singleFile[selector];
          let selectedObjs = Object.values(await selection.items()).map(n => n.value);
          tests.push({
            name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
            result: logging.testObjectEquality(expectedObjs, selectedObjs)
          });
        }

        // Multi-document selection tests
        // TODO: check why indirect test is passing when it shouldn't (shouldn't be empty)
        selectors = Object.keys(testResults.multiFile);
        for (let i = 0; i < selectors.length; i += 1) {
          let selector = selectors[i];
          let selection = mure.selectAll(selector);
          let expectedObjs = testResults.multiFile[selector];
          let selectedObjs = Object.values(await selection.items()).map(n => n.value);
          tests.push({
            name: 'mure.selectAll(\'' + selector + '\')',
            result: logging.testObjectEquality(expectedObjs, selectedObjs)
          });
        }

        // Full file / all doc selection tests
        let rootValue = {};
        let allDocs = await mure.db.allDocs({
          include_docs: true,
          startkey: '_\uffff'
        });
        allDocs = allDocs.rows.map(doc => {
          rootValue[doc.doc._id] = doc.doc;
          return doc.doc;
        });
        let fullFileTests = {
          '@': [rootValue],
          '@ $': allDocs,
          '@ $ ↑': [rootValue],
          '@ $ ↑↑': [],
          '@ $.contents.hands ↑↑': allDocs
            .filter(doc => !!doc.contents.hands)
        };
        selectors = Object.keys(fullFileTests);
        for (let i = 0; i < selectors.length; i += 1) {
          let selector = selectors[i];
          let selection = mure.selectAll(selector);
          let expectedObjs = fullFileTests[selector];
          let selectedObjs = Object.values(await selection.items()).map(n => n.value);
          tests.push({
            name: `mure.selectAll('${selector}')`,
            result: logging.testObjectEquality(expectedObjs, selectedObjs)
          });
        }

        resolve(tests);
      })();
    });
  }
];
