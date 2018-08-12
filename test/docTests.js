const fs = require('fs');
const mure = require('../dist/mure.cjs.js');
mure.debug = true;

describe('Document Tests', () => {
  afterAll(async () => {
    mure.removeDataSource('csvTest.csv');
  });

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
    expect(result).toEqual([
      {'a': '1', 'is': '4', 'test': 'five', 'this': '3.1'},
      {'a': '5', 'is': '6', 'test': 'three', 'this': '9.2'},
      {'a': '7', 'is': '9', 'test': 'nine', 'this': '5.8'},
      {'a': '8', 'is': '3', 'test': 'four', 'this': '3.2'},
      {'a': '4', 'is': '6', 'test': 'three', 'this': '6.2'},
      {'a': '2', 'is': '3', 'test': 'seven', 'this': '3.8'},
      {'a': '2', 'is': '0', 'test': 'eight', 'this': '9.5'},
      {'a': '9', 'is': '1', 'test': 'seven', 'this': '8.4'}
    ]);
  });
});
