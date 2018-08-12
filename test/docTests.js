const fs = require('fs');
const mure = require('../dist/mure.cjs.js');

const expectedCsv = require('./data/expectedCsv.json');

describe('Document Tests', () => {
  test('load and read a CSV file', async () => {
    expect.assertions(1);

    const csvString = await new Promise((resolve, reject) => {
      fs.readFile('test/data/csvTest.csv', 'utf8', (err, data) => {
        if (err) { reject(err); }
        resolve(data);
      });
    });

    // Upload and parse the data source
    const genericClass = await mure.addStringAsStaticDataSource({
      key: 'csvTest.csv',
      extension: 'csv',
      text: csvString
    });

    // Stream the data
    const result = [];
    for await (const wrappedItem of genericClass.stream.sample({ limit: Infinity })) {
      result.push(wrappedItem.rawItem);
    }

    // Verify that it matches what we expect
    expect(result).toEqual(expectedCsv);
  });
});
