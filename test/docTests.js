const fs = require('fs');
const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');

module.exports = [
  async () => {
    let doc = await mure.getDoc();
    const expectedDoc = require('./data/Untitled 1');
    return Promise.resolve([{
      name: 'getDoc w/out arguments (creates new Untitled doc)',
      result: logging.testObjectEquality(doc, expectedDoc)
    }]);
  },
  async () => {
    let doc = await mure.getDoc('dummy_id', { init: false });
    let doc2 = await mure.getDoc({ 'filename': 'doesntExist.json' }, { init: false });
    return Promise.resolve([
      {
        name: 'getDoc w/out init (bad id)',
        result: {
          passed: doc === null
        }
      },
      {
        name: 'getDoc w/out init (bad query)',
        result: {
          passed: doc2 === null
        }
      }
    ]);
  },
  async () => {
    return new Promise((resolve, reject) => {
      const doc = require('./data/blackJack_round1');
      const expectedDoc = require('./data/blackJack_round1_expected');
      const data = JSON.stringify(doc);
      (async () => {
        let tests = [];
        let uploadSelection = await mure.uploadString('blackJack_round1.json', 'application/json', 'UTF-8', data);

        // Make sure the document has been loaded and has a _rev property
        let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round1.json' });
        let _revTestResult = {
          passed: uploadSelection && dbDoc._rev
        };
        if (!_revTestResult.passed) {
          _revTestResult.details = 'State after upload:' + '\n' +
            JSON.stringify(dbDoc, null, 2);
        }
        tests.push({
          name: 'blackJack_round1.json uploaded, has _rev property',
          result: _revTestResult
        });

        // aside from _rev, blackJack_round1 should now match expectedDoc exactly
        let rev = dbDoc._rev;
        delete dbDoc._rev;
        tests.push({
          name: 'standardize blackJack_round1.json',
          result: logging.testObjectEquality(dbDoc, expectedDoc)
        });
        dbDoc._rev = rev;

        // make a change and save the document
        delete dbDoc.contents['Player 1'];
        let saveMessage = await mure.putDoc(dbDoc);
        let savedDoc = await mure.getDoc(dbDoc._id);
        let saveTestResult = {
          passed: saveMessage.ok && savedDoc._rev !== rev && !savedDoc.contents['Player 1']
        };
        if (!saveTestResult.passed) {
          saveTestResult.details = 'Save message:\n' +
            JSON.stringify(saveMessage, null, 2) + '\n\n' +
            'Original _rev: ' + rev + '\n\n' +
            'State after save:' + '\n' +
            JSON.stringify(savedDoc, null, 2);
        }
        tests.push({
          name: 'delete "Player 1" from document and save it',
          result: saveTestResult
        });

        // Delete the document, and validate that it was deleted
        let deleteMessage = await mure.deleteDoc(savedDoc._id);
        let deleteTestResult = { passed: deleteMessage.ok };
        if (!deleteMessage.ok) {
          deleteTestResult.details = JSON.stringify(deleteMessage, null, 2);
        }
        tests.push({
          name: 'delete blackJack_round1.json',
          result: deleteTestResult
        });
        resolve(tests);
      })();
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      const doc = require('./data/blackJack_round2');
      const data = JSON.stringify(doc);
      (async () => {
        let uploadSelection = await mure.uploadString('blackJack_round2.json', 'application/json', 'UTF-8', data);
        let tests = [];

        // Make sure the document has been loaded
        let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round2.json' });
        let _revTestResult = {
          passed: uploadSelection && dbDoc._rev
        };
        if (!_revTestResult.passed) {
          _revTestResult.details = 'State after upload:' + '\n' +
            JSON.stringify(dbDoc, null, 2);
        }
        tests.push({
          name: 'blackJack_round1.json uploaded, has _rev property',
          result: _revTestResult
        });

        // Validate that the array was actually converted, and that $wasArray
        // was set
        let _wasArrayResult = {
          passed: !(dbDoc.contents['Player 1'] instanceof Array) &&
            dbDoc.contents['Player 1'].$wasArray === true
        };
        if (!_wasArrayResult.passed) {
          _wasArrayResult.details = 'State after upload:' + '\n' +
            JSON.stringify(dbDoc, null, 2);
        }
        tests.push({
          name: 'verify that Player 1 in blackJack_round2.json is no longer an array',
          result: _wasArrayResult
        });

        // Delete the document, and validate that it was deleted
        let deleteMessage = await mure.deleteDoc(dbDoc._id);
        let deleteTestResult = { passed: deleteMessage.ok };
        if (!deleteMessage.ok) {
          deleteTestResult.details = JSON.stringify(deleteMessage, null, 2);
        }
        tests.push({
          name: 'delete blackJack_round2.json',
          result: deleteTestResult
        });
        resolve(tests);
      })();
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      const doc = require('./data/crossGameLinks');
      const data = JSON.stringify(doc);
      (async () => {
        let tests = [];
        let uploadSelection = await mure.uploadString(null, 'application/json', null, data);

        // Make sure the document has been loaded and has a _rev property
        let dbDoc = await mure.getDoc({ 'filename': 'Cross Game Links' });
        let _revTestResult = {
          passed: uploadSelection && dbDoc._rev
        };
        if (!_revTestResult.passed) {
          _revTestResult.details = 'State after upload:' + '\n' +
            JSON.stringify(dbDoc, null, 2);
        }
        tests.push({
          name: 'crossGameLinks.json uploaded, has _rev property',
          result: _revTestResult
        });

        // aside from _rev, it should match its original state exactly
        let rev = dbDoc._rev;
        delete dbDoc._rev;
        tests.push({
          name: 'standardize crossGameLinks.json without change',
          result: logging.testObjectEquality(dbDoc, doc)
        });
        dbDoc._rev = rev;

        // Delete the document, and validate that it was deleted
        let deleteMessage = await mure.deleteDoc(dbDoc._id);
        let deleteTestResult = { passed: deleteMessage.ok };
        if (!deleteMessage.ok) {
          deleteTestResult.details = JSON.stringify(deleteMessage, null, 2);
        }
        tests.push({
          name: 'delete crossGameLinks.json',
          result: deleteTestResult
        });
        resolve(tests);
      })();
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      const expectedCsv = require('./data/expectedCsv');
      fs.readFile('test/data/csvTest.csv', 'utf8', (err, data) => {
        if (err) throw err;
        (async () => {
          let tests = [];
          let uploadSelection = await mure.uploadString('csvTest.csv', 'text/csv', 'UTF-8', data);

          // Make sure the document has been loaded and has a _rev property
          let dbDoc = await mure.getDoc({ 'filename': 'csvTest.csv' });
          let _revTestResult = {
            passed: uploadSelection && dbDoc._rev
          };
          if (!_revTestResult.passed) {
            _revTestResult.details = 'State after upload:' + '\n' +
              JSON.stringify(dbDoc, null, 2);
          }
          tests.push({
            name: 'csvTest.csv uploaded, has _rev property',
            result: _revTestResult
          });

          // check that it matches what we'd expect (ignoring _rev)
          let rev = dbDoc._rev;
          delete dbDoc._rev;
          tests.push({
            name: 'csvTest.csv matches expected structure',
            result: logging.testObjectEquality(dbDoc, expectedCsv)
          });
          dbDoc._rev = rev;

          // Delete the document, and validate that it was deleted
          let deleteMessage = await mure.deleteDoc(dbDoc._id);
          let deleteTestResult = { passed: deleteMessage.ok };
          if (!deleteMessage.ok) {
            deleteTestResult.details = JSON.stringify(deleteMessage, null, 2);
          }
          tests.push({
            name: 'delete csvTest.csv',
            result: deleteTestResult
          });
          resolve(tests);
        })();
      });
    });
  }
];
