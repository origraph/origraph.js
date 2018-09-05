const mure = require('../dist/mure.cjs.js');
const loadFiles = require('./loadFiles.js');

async function getFiveSamples (tableObj) {
  const samples = [];
  for await (const sample of tableObj.iterate({ limit: 5 })) {
    samples.push(sample);
  }
  return samples;
}

describe('StaticTable Samples', () => {
  afterEach(() => {
    mure.deleteAllClasses();
    mure.deleteAllUnusedTables();
  });

  test('Raw Table Samples', async () => {
    expect.assertions(1);

    let peopleId = (await loadFiles(['people.csv']))[0].tableId;

    // Test that the data is what we'd expect
    const samples = await getFiveSamples(mure.tables[peopleId]);
    expect(samples.map(s => s.row)).toEqual([
      {'born': '1964', 'id': '1', 'name': 'Keanu Reeves'},
      {'born': '1967', 'id': '2', 'name': 'Carrie-Anne Moss'},
      {'born': '1961', 'id': '3', 'name': 'Laurence Fishburne'},
      {'born': '1960', 'id': '4', 'name': 'Hugo Weaving'},
      {'born': '1967', 'id': '5', 'name': 'Andy Wachowski'}
    ]);
  });

  test('AggregatedTable Samples', async () => {
    expect.assertions(2);

    let peopleId = (await loadFiles(['people.csv']))[0].tableId;
    const bornId = mure.tables[peopleId].aggregate('born').tableId;

    mure.tables[bornId].deriveReducedAttribute('count', (originalItem, newItem) => {
      return (originalItem.row.count || 0) + 1;
    });

    const samples = await getFiveSamples(mure.tables[bornId]);

    // Test that the indexes are what we'd expect at this point
    expect(samples.map(s => s.index)).toEqual([
      '1964', '1967', '1961', '1960'
    ]);

    // Test that the data is what we'd expect at this point
    expect(samples.map(s => s.row)).toEqual([
      { count: 1 },
      { count: 2 },
      { count: 1 },
      { count: 1 }
    ]);
  });

  test('ExpandedTable Samples', async () => {
    expect.assertions(1);

    let testId = (await loadFiles(['csvTest.csv']))[0].tableId;
    const digitId = mure.tables[testId].expand('this', '.').tableId;

    mure.tables[digitId].duplicateAttribute(testId, 'test');

    const samples = await getFiveSamples(mure.tables[digitId]);

    // Test that the data is what we'd expect
    expect(samples.map(s => s.row)).toEqual([
      {'csvTest.csv.test': 'five', 'this': '3'},
      {'csvTest.csv.test': 'five', 'this': '1'},
      {'csvTest.csv.test': 'three', 'this': '9'},
      {'csvTest.csv.test': 'three', 'this': '2'},
      {'csvTest.csv.test': 'nine', 'this': '5'}
    ]);
  });

  test('ConnectedTable Samples', async () => {
    expect.assertions(2);

    let testId = (await loadFiles(['csvTest.csv']))[0].tableId;
    const connectedId = mure.tables[testId].connect([
      mure.tables[testId]
    ]).tableId;

    mure.tables[connectedId].duplicateAttribute(testId, 'test');

    const samples = await getFiveSamples(mure.tables[connectedId]);

    // Test that the indexes are what we'd expect
    expect(samples.map(s => s.index)).toEqual([
      '0', '1', '2', '3', '4'
    ]);

    // Test that the data is what we'd expect
    expect(samples.map(s => s.row)).toEqual([
      {'csvTest.csv.test': 'five'},
      {'csvTest.csv.test': 'three'},
      {'csvTest.csv.test': 'nine'},
      {'csvTest.csv.test': 'four'},
      {'csvTest.csv.test': 'three'}
    ]);
  });

  test('FilteredTable Samples (closedFacet)', async () => {
    expect.assertions(2);

    let testId = (await loadFiles(['csvTest.csv']))[0].tableId;
    const values = ['three', 'seven'];
    const [threeId, sevenId] = mure.tables[testId].closedFacet('test', values)
      .map(tableObj => tableObj.tableId);

    // Test that the data is what we'd expect
    let samples = await getFiveSamples(mure.tables[threeId]);
    expect(samples.map(s => s.row)).toEqual([
      {'a': '5', 'is': '6', 'test': 'three', 'this': '9.2'},
      {'a': '4', 'is': '6', 'test': 'three', 'this': '6.2'}
    ]);

    samples = await getFiveSamples(mure.tables[sevenId]);
    expect(samples.map(s => s.row)).toEqual([
      {'a': '2', 'is': '3', 'test': 'seven', 'this': '3.8'},
      {'a': '9', 'is': '1', 'test': 'seven', 'this': '8.4'}
    ]);
  });

  test('FilteredTable Samples (openFacet)', async () => {
    expect.assertions(2);

    const limit = 4;

    let testId = (await loadFiles(['csvTest.csv']))[0].tableId;
    const tableIds = [];
    for await (const tableObj of mure.tables[testId].openFacet('test', limit)) {
      tableIds.push(tableObj.tableId);
    }

    // Test that we get the right number of tables
    expect(tableIds.length).toEqual(limit);

    // Test that the table names are what we'd expect
    expect(tableIds.map(tableId => mure.tables[tableId].name)).toEqual([
      'csvTest.csv[five]',
      'csvTest.csv[three]',
      'csvTest.csv[nine]',
      'csvTest.csv[four]'
    ]);
  });
});
