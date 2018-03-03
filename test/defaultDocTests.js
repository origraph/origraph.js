const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');

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
  }
];
