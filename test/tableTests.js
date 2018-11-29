const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Table Samples', () => {
  afterEach(() => {
    origraph.deleteAllModels();
  });

  test('StaticTable Samples', async () => {
    expect.assertions(1);

    let people = (await utils.loadFiles(['movies/small/people.csv']))[0].table;

    // Test that the data is what we'd expect
    const samples = await utils.getFiveSamples(people);
    expect(samples.map(s => s.row)).toEqual([
      {'born': '1964', 'id': '1', 'name': 'Keanu Reeves'},
      {'born': '1967', 'id': '2', 'name': 'Carrie-Anne Moss'},
      {'born': '1961', 'id': '3', 'name': 'Laurence Fishburne'},
      {'born': '1960', 'id': '4', 'name': 'Hugo Weaving'},
      {'born': '1967', 'id': '5', 'name': 'Andy Wachowski'}
    ]);
  });

  test('AggregatedTable Samples', async () => {
    expect.assertions(1);

    let people = (await utils.loadFiles(['movies/small/people.csv']))[0].table;
    const born = people.aggregate('born');

    const samples = await utils.getFiveSamples(born);

    // Test that the indexes are what we'd expect at this point
    expect(samples.map(s => s.index)).toEqual([
      '1964', '1967', '1961', '1960', '1967'
    ]);
  });

  test('ConnectedTable Samples', async () => {
    expect.assertions(2);

    let test = (await utils.loadFiles(['csvTest.csv']))[0].table;
    const connected = test.connect([ test ]);

    const samples = await utils.getFiveSamples(connected);

    // Test that the indexes are what we'd expect
    expect(samples.map(s => s.index)).toEqual([
      '0', '1', '2', '3', '4'
    ]);

    // Test that the data is what we'd expect
    expect(samples.map(s => s.row)).toEqual([
      {}, {}, {}, {}, {}
    ]);
  });

  test('FacetedTable Samples (closedFacet)', async () => {
    expect.assertions(2);

    let test = (await utils.loadFiles(['csvTest.csv']))[0].table;
    const values = ['three', 'seven'];
    const [three, seven] = test.closedFacet('test', values);

    // Test that the data is what we'd expect
    let samples = await utils.getFiveSamples(three);
    expect(samples.map(s => s.row)).toEqual([
      {'a': '5', 'is': '6', 'test': 'three', 'this': '9.2'},
      {'a': '4', 'is': '6', 'test': 'three', 'this': '6.2'}
    ]);

    samples = await utils.getFiveSamples(seven);
    expect(samples.map(s => s.row)).toEqual([
      {'a': '2', 'is': '3', 'test': 'seven', 'this': '3.8'},
      {'a': '9', 'is': '1', 'test': 'seven', 'this': '8.4'}
    ]);
  });

  test('FacetedTable Samples (openFacet)', async () => {
    expect.assertions(2);

    const limit = 4;

    let test = (await utils.loadFiles(['csvTest.csv']))[0].table;
    const tables = [];
    for await (const tableObj of test.openFacet('test', limit)) {
      tables.push(tableObj);
    }

    // Test that we get the right number of tables
    expect(tables.length).toEqual(limit);

    // Test that the table names are what we'd expect
    expect(tables.map(table => table.name)).toEqual([
      '[five]',
      '[three]',
      '[nine]',
      '[four]'
    ]);
  });

  test('TransposedTable Samples (openTranspose)', async () => {
    expect.assertions(4);

    let test = (await utils.loadFiles(['miserables.json']))[0].table;
    const tables = [];
    for await (const tableObj of test.openTranspose()) {
      tables.push(tableObj);
    }

    // Test that we get the right number of tables
    expect(tables.length).toEqual(2);

    // Test that the table names are what we'd expect
    expect(tables.map(table => table.name)).toEqual([
      'ᵀnodes',
      'ᵀlinks'
    ]);

    // Test that we get the rows that we'd expect
    let samples = await utils.getFiveSamples(tables[0]);
    expect(samples.map(s => s.row)).toEqual([
      {'group': 1, 'index': 0, 'name': 'Myriel'},
      {'group': 1, 'index': 1, 'name': 'Napoleon'},
      {'group': 1, 'index': 2, 'name': 'Mlle.Baptistine'},
      {'group': 1, 'index': 3, 'name': 'Mme.Magloire'},
      {'group': 1, 'index': 4, 'name': 'CountessdeLo'}
    ]);

    samples = await utils.getFiveSamples(tables[1]);
    expect(samples.map(s => s.row)).toEqual([
      {'source': 1, 'target': 0, 'value': 1},
      {'source': 2, 'target': 0, 'value': 8},
      {'source': 3, 'target': 0, 'value': 10},
      {'source': 3, 'target': 2, 'value': 6},
      {'source': 4, 'target': 0, 'value': 1}
    ]);
  });
});
