const origraph = require('../dist/origraph.cjs.js');
const loadFiles = require('./loadFiles.js');

describe('Document Tests', () => {
  afterAll(async () => {
    origraph.deleteModel();
  });

  test('load and read a CSV file', async () => {
    expect.assertions(2);

    const testTable = (await loadFiles(['csvTest.csv']))[0].table;

    const result = [];
    for await (const wrappedItem of testTable.iterate({ limit: Infinity })) {
      result.push(wrappedItem.row);
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

    // Verify that it was a StaticTable
    expect(testTable.type).toEqual('Static');
  });

  test('load and read a JSON file', async () => {
    expect.assertions(2);

    let testTable = (await loadFiles(['miserables.json']))[0].table;

    let result;
    for await (const wrappedItem of testTable.iterate({ limit: 1 })) {
      result = wrappedItem.row;
    }

    // Verify that it matches what we expect
    expect(result.slice(0, 5)).toEqual([
      {'group': 1, 'index': 0, 'name': 'Myriel'},
      {'group': 1, 'index': 1, 'name': 'Napoleon'},
      {'group': 1, 'index': 2, 'name': 'Mlle.Baptistine'},
      {'group': 1, 'index': 3, 'name': 'Mme.Magloire'},
      {'group': 1, 'index': 4, 'name': 'CountessdeLo'}
    ]);

    // Verify that it was a StaticDictTable
    expect(testTable.type).toEqual('StaticDict');
  });
});
