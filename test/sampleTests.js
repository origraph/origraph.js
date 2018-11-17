const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Sample Tests', () => {
  afterEach(() => {
    origraph.deleteAllModels();
  });

  test('Movie + Person + Edge', async () => {
    expect.assertions(11);

    let { people, movies, movieEdges } = await utils.setupMovies();

    let count = await people.table.countRows();
    expect(count).toEqual(133);
    count = await movies.table.countRows();
    expect(count).toEqual(38);
    count = await movieEdges.table.countRows();
    expect(count).toEqual(506);

    let samples = await origraph.currentModel.getFlattenedSamples({
      branchLimit: 2,
      tripleLimit: 2
    });

    expect(samples).toEqual(require('./data/dump1.json'));
  });

  test('Person + Year + Person (as edges)', async () => {
    expect.assertions(3);

    let people = (await utils.loadFiles(['people.csv']))[0];

    // Interpretation
    people = people.interpretAsNodes();
    const years = people.connectToNodeClass({
      otherNodeClass: people,
      attribute: 'born',
      otherAttribute: 'born'
    });

    let count = await people.table.countRows();
    expect(count).toEqual(133);
    count = await years.table.countRows();
    expect(count).toEqual(53);

    let samples = await origraph.currentModel.getFlattenedSamples({
      branchLimit: 2,
      tripleLimit: 2
    });

    expect(samples).toEqual([ null ]);
  });

  test('Person + Year (as aggregated nodes)', async () => {
    expect.assertions(3);

    let people = (await utils.loadFiles(['people.csv']))[0];

    // Interpretation
    people = people.interpretAsNodes();
    const years = people.aggregate('born');

    let count = await people.table.countRows();
    expect(count).toEqual(133);
    count = await years.table.countRows();
    expect(count).toEqual(53);

    let samples = await origraph.currentModel.getFlattenedSamples({
      branchLimit: 2,
      tripleLimit: 2
    });

    expect(samples).toEqual([ null ]);
  });
});
