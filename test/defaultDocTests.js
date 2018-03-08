const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
const fs = require('fs');

module.exports = [
  async () => {
    let doc = await mure.getDoc('dummy_id', { init: false });
    return Promise.resolve([{
      name: 'getDoc w/out init',
      result: {
        passed: doc === null
      }
    }]);
  },
  async () => {
    let doc = await mure.getDoc();
    return Promise.resolve([{
      name: 'getDoc w/out arguments',
      result: logging.testStringEquality(JSON.stringify(doc.contents), '{}')
    }]);
  },
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/blackJack_round1.json', 'utf8', (err, data) => {
        if (err) { reject(err); }
        (async () => {
          await mure.uploadString('blackJack_round1.json', 'application/json', data);
          let tests = [];

          // Make sure the document has been loaded and has a _rev property
          let temp = await mure.getDoc({ 'filename': 'blackJack_round1.json' });
          let _revTestResult = {
            passed: !!temp._rev
          };
          if (!_revTestResult.passed) {
            _revTestResult.details = JSON.stringify(temp, null, 2);
          }
          tests.push({
            name: 'blackJack_round1.json has _rev property',
            result: _revTestResult
          });

          // blackJack_round1 is correctly formatted; aside from _rev,
          // it should match the original exactly
          delete temp._rev;
          let doc = JSON.parse(data);
          tests.push({
            name: 'upload blackJack_round1.json without change',
            result: logging.testObjectEquality(temp, doc)
          });

          // TODO: any more tests with this file while we're at it?
          resolve(tests);
        })();
      });
    });
  }
];
