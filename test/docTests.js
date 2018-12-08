const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Document Tests', () => {
  afterAll(async () => {
    origraph.deleteAllModels();
  });

  test('load and read a CSV file', async () => {
    expect.assertions(2);

    const testTable = (await utils.loadFiles(['csvTest.csv']))[0].table;

    const result = [];
    for await (const wrappedItem of testTable.iterate()) {
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

    let testTable = (await utils.loadFiles(['miserables.json']))[0].table;

    let result;
    for await (const wrappedItem of testTable.iterate(1)) {
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

  test('load a D3Json file', async () => {
    expect.assertions(4);

    const model = await origraph.loadModel({
      format: 'D3Json',
      text: await utils.loadRawText('miserables.json'),
      name: 'Les Miserables',
      nodeAttribute: 'index'
    });

    // Verify that it contains what we expect
    const nodes = await model.findClass('nodes');
    expect(await nodes.table.countRows()).toEqual(77);
    const edges = await model.findClass('links');
    expect(await edges.table.countRows()).toEqual(254);

    let samples = [];
    const testItem = await nodes.table.getItem();
    expect(testItem.row).toEqual({ 'name': 'Myriel', 'group': 1, 'index': 0 });
    for await (const edge of testItem.edges()) {
      samples.push(edge.row);
    }
    expect(samples).toEqual([
      {'source': 1, 'target': 0, 'value': 1},
      {'source': 2, 'target': 0, 'value': 8},
      {'source': 3, 'target': 0, 'value': 10},
      {'source': 4, 'target': 0, 'value': 1},
      {'source': 5, 'target': 0, 'value': 1},
      {'source': 6, 'target': 0, 'value': 1},
      {'source': 7, 'target': 0, 'value': 1},
      {'source': 8, 'target': 0, 'value': 2},
      {'source': 9, 'target': 0, 'value': 1},
      {'source': 11, 'target': 0, 'value': 5}
    ]);
  });
});
