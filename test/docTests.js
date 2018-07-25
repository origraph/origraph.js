const fs = require('fs');
const mure = require('../dist/mure.cjs.js');

const blackJack1 = require('./data/blackJack_round1.json');
const expectedBlackJack1 = require('./data/blackJack_round1_expected.json');
const blackJack2 = require('./data/blackJack_round2.json');
const crossGameLinks = require('./data/crossGameLinks.json');
const expectedCsv = require('./data/expectedCsv.json');

describe('Document Tests', () => {
  beforeEach(() => {
    if (!mure.db) {
      mure.getOrInitDb();
    }
  });

  afterEach(async () => {
    await mure.db.destroy();
    delete mure.db;
  });

  test('getDoc w/out arguments (creates new Untitled doc)', async () => {
    expect.assertions(1);
    expect(await mure.getDoc()).toEqual(require('./data/Untitled 1.json'));
  });

  test('getDoc w/out init', async () => {
    expect.assertions(2);
    const doc = await mure.getDoc('dummy_id', { init: false });
    const doc2 = await mure.getDoc({ 'filename': 'doesntExist.json' }, { init: false });
    expect(doc).toBeNull();
    expect(doc2).toBeNull();
  });

  test('standardize a file', async () => {
    expect.assertions(3);

    // Make sure the upload works
    expect(await mure.uploadString('blackJack_round1.json', 'application/json', 'UTF-8', JSON.stringify(blackJack1)))
      .toBeTruthy();

    // Make sure the document has been loaded and has a _rev property
    let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round1.json' });
    expect(dbDoc._rev).toBeTruthy();

    // Aside from _rev, blackJack_round1 should now match expectedDoc exactly
    let rev = dbDoc._rev;
    delete dbDoc._rev;
    expect(dbDoc).toEqual(expectedBlackJack1);
    dbDoc._rev = rev;
  });

  test('edit a file', async () => {
    expect.assertions(6);

    // Make sure the upload works
    expect(await mure.uploadDoc('blackJack_round1.json', 'application/json', 'UTF-8', expectedBlackJack1))
      .toBeTruthy();

    // Get the document
    let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round1.json' });
    expect(dbDoc).toBeTruthy();

    // Make a change and save the document
    delete dbDoc.contents['Player 1'];
    expect(await mure.putDoc(dbDoc)).toBeTruthy();

    // Validate that the saved document has a different _rev, and that
    // 'Player 1' no longer exists
    let savedDoc = await mure.getDoc(dbDoc._id);
    expect(dbDoc._rev).not.toMatch(savedDoc._rev);
    expect(savedDoc.contents['Player 1']).toBeUndefined();

    // Delete the file
    expect((await mure.deleteDoc(savedDoc._id))
      .ok).toBe(true);
  });

  test('convert arrays in files', async () => {
    expect.assertions(4);

    // Make sure the upload works
    expect(await mure.uploadDoc('blackJack_round2.json', 'application/json', 'UTF-8', blackJack2))
      .toBeTruthy();

    // Get the document
    let dbDoc = await mure.getDoc({ 'filename': 'blackJack_round2.json' });
    expect(dbDoc).toBeTruthy();

    // Validate that the array was converted
    expect(dbDoc.contents['Player 1']).not.toBeInstanceOf(Array);
    expect(dbDoc.contents['Player 1'].$wasArray).toBe(true);
  });

  test('check that already-standardized file loads without change', async () => {
    expect.assertions(3);

    // Make sure the upload works
    expect(await mure.uploadString(null, 'application/json', null, JSON.stringify(crossGameLinks)))
      .toBeTruthy();

    // Get the document
    let dbDoc = await mure.getDoc({ 'filename': 'Cross Game Links' });
    expect(dbDoc).toBeTruthy();

    // Aside from _rev, dbDoc should match crossGameLinks exactly
    delete dbDoc._rev;
    expect(dbDoc).toEqual(crossGameLinks);
  });

  test('load a CSV file', async () => {
    expect.assertions(3);

    const csvString = await new Promise((resolve, reject) => {
      fs.readFile('test/data/csvTest.csv', 'utf8', (err, data) => {
        if (err) { reject(err); }
        resolve(data);
      });
    });

    // Make sure the upload works
    expect(await mure.uploadString('csvTest.csv', 'text/csv', 'UTF-8', csvString))
      .toBeTruthy();

    // Get the document
    let dbDoc = await mure.getDoc({ 'filename': 'csvTest.csv' });
    expect(dbDoc).toBeTruthy();

    // Aside from _rev, dbDoc should match expectedCsv exactly
    delete dbDoc._rev;
    expect(dbDoc).toEqual(expectedCsv);
  });
});
