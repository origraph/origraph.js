const mure = require('../dist/mure.cjs.js');
const loadFiles = require('./loadFiles.js');

async function getFiveSamples (tableObj) {
  const samples = [];
  for await (const sample of tableObj.iterate({ limit: 5 })) {
    samples.push(sample);
  }
  return samples;
}

describe('Sampling Tests', () => {
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

  test('Aggregated Table Samples', async () => {
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

  test('Expanded Table Samples', async () => {
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
});
