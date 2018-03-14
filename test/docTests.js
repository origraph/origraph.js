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
          let uploadMessage = await mure.uploadString('blackJack_round1.json', 'application/json', data);
          let tests = [];

          // Make sure the document has been loaded and has a _rev and purgedArrays property
          let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round1.json' });
          let _revTestResult = {
            passed: uploadMessage && dbDoc._rev && dbDoc.purgedArrays !== undefined
          };
          if (!_revTestResult.passed) {
            _revTestResult.details = 'Upload message:\n' +
              JSON.stringify(uploadMessage, null, 2) + '\n\n' +
              'State after upload:' + '\n' +
              JSON.stringify(dbDoc, null, 2);
          }
          tests.push({
            name: 'blackJack_round1.json has _rev and purgedArrays properties',
            result: _revTestResult
          });

          // blackJack_round1 is correctly formatted; aside from _rev,
          // it should match the original exactly
          let rev = dbDoc._rev;
          delete dbDoc._rev;
          let purgedArrays = dbDoc.purgedArrays;
          delete dbDoc.purgedArrays;
          let doc = JSON.parse(data);
          tests.push({
            name: 'upload blackJack_round1.json without change',
            result: logging.testObjectEquality(dbDoc, doc)
          });
          dbDoc._rev = rev;
          dbDoc.purgedArrays = purgedArrays;

          // make a change and save the document
          delete dbDoc.contents['Player 1'];
          let saveMessage = await mure.saveDoc(dbDoc);
          let savedDoc = await mure.getDoc(dbDoc._id);
          let saveTestResult = {
            passed: saveMessage.ok && savedDoc._rev !== rev && !savedDoc.contents['Player 1']
          };
          if (!saveTestResult.passed) {
            saveTestResult.details = 'Save message:\n' +
              JSON.stringify(saveMessage, null, 2) + '\n\n' +
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
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/blackJack_round2.json', 'utf8', (err, data) => {
        if (err) { reject(err); }
        (async () => {
          let uploadMessage = await mure.uploadString('blackJack_round2.json', 'application/json', data);
          let tests = [];

          // Make sure the document has been loaded and purgedArrays is true
          let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round2.json' });
          let _revTestResult = {
            passed: uploadMessage && dbDoc._rev && dbDoc.purgedArrays === true
          };
          if (!_revTestResult.passed) {
            _revTestResult.details = 'Upload message:\n' +
              JSON.stringify(uploadMessage, null, 2) + '\n\n' +
              'State after upload:' + '\n' +
              JSON.stringify(dbDoc, null, 2);
          }
          tests.push({
            name: 'blackJack_round2.json: purgedArrays === true',
            result: _revTestResult
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
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/hearts_round3.json', 'utf8', (err, data) => {
        if (err) { reject(err); }
        (async () => {
          let uploadMessage = await mure.uploadString('hearts_round3.json', 'application/json', data);
          let tests = [];

          // Make sure the document has been loaded and purgedArrays is true
          let dbDoc = await mure.getDoc({ 'filename': 'hearts_round3.json' });
          let _revTestResult = {
            passed: uploadMessage && dbDoc._rev && dbDoc.purgedArrays === true
          };
          if (!_revTestResult.passed) {
            _revTestResult.details = 'Upload message:\n' +
              JSON.stringify(uploadMessage, null, 2) + '\n\n' +
              'State after upload:' + '\n' +
              JSON.stringify(dbDoc, null, 2);
          }
          tests.push({
            name: 'hearts_round3.json: purgedArrays === true',
            result: _revTestResult
          });

          // Delete the document, and validate that it was deleted
          let deleteMessage = await mure.deleteDoc(dbDoc._id);
          let deleteTestResult = { passed: deleteMessage.ok };
          if (!deleteMessage.ok) {
            deleteTestResult.details = JSON.stringify(deleteMessage, null, 2);
          }
          tests.push({
            name: 'delete hearts_round3.json',
            result: deleteTestResult
          });
          resolve(tests);
        })();
      });
    });
  }
];
