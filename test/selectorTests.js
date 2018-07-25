const mure = require('../dist/mure.cjs.js');

const testResults = {
  singleFile: './data/singleFileSelectorTests',
  multiFile: './data/multiFileSelectorTests'
};
Object.keys(testResults).forEach(f => {
  testResults[f] = require(testResults[f]);
});

describe('Selector Tests', () => {
  beforeAll(async () => {
    if (!mure.db) {
      mure.getOrInitDb();
    }
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
    await Promise.all(uploadPromises);
  });

  afterAll(async () => {
    await mure.db.destroy();
    delete mure.db;
  });

  // Single-document selection tests
  let selectors = Object.keys(testResults.singleFile);
  for (let i = 0; i < selectors.length; i += 1) {
    const selector = selectors[i];
    const expectedObjs = testResults.singleFile[selector];
    test(`mure.selectDoc().subSelect('${selector}')`, async () => {
      expect.assertions(1);
      const docSelection = mure.selectDoc('application/json;blackJack_round1.json');
      const selection = await docSelection.subSelect(selector);
      const selectedObjs = Object.values(await selection.items()).map(n => n.value);
      expect(selectedObjs).toEqual(expectedObjs);
    });
  }

  // Multi-document selection tests
  selectors = Object.keys(testResults.multiFile);
  for (let i = 0; i < selectors.length; i += 1) {
    const selector = selectors[i];
    const expectedObjs = testResults.multiFile[selector];
    test(`mure.selectAll('${selector}')`, async () => {
      expect.assertions(1);
      const selection = mure.selectAll(selector);
      const selectedObjs = Object.values(await selection.items()).map(n => n.value);
      expect(selectedObjs).toEqual(expectedObjs);
    });
  }

  // Full file / all doc selection tests
  let rootValue = {};
  let getAllDocs = async () => {
    return (await mure.db.allDocs({
      include_docs: true,
      startkey: '_\uffff'
    })).rows.map(doc => {
      rootValue[doc.doc._id] = doc.doc;
      return doc.doc;
    });
  };
  let fullFileTests = {
    '@': async () => {
      await getAllDocs();
      return [rootValue];
    },
    '@ $': getAllDocs,
    '@ $ ↑': [rootValue],
    '@ $ ↑↑': [],
    '@ $.contents.hands ↑↑': async () => {
      return (await getAllDocs())
        .filter(doc => {
          return !!doc.contents.hands;
        });
    }
  };
  selectors = Object.keys(fullFileTests);
  for (let i = 0; i < selectors.length; i += 1) {
    const selector = selectors[i];
    let expectedObjs = fullFileTests[selector];
    test(`mure.selectAll('${selector}')`, async () => {
      expect.assertions(1);
      let selection = mure.selectAll(selector);
      let selectedObjs = Object.values(await selection.items()).map(n => n.value);
      if (typeof expectedObjs === 'function') {
        expectedObjs = await expectedObjs();
      }
      expect(selectedObjs).toEqual(expectedObjs);
    });
  }
});
