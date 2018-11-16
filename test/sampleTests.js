const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Sample Tests', () => {
  afterEach(() => {
    origraph.deleteAllClasses();
    origraph.deleteAllUnusedTables();
  });

  test('Movie + Person + Edge', async () => {
    expect.assertions(13);

    let { people, movies, movieEdges } = await utils.setupMovies();

    let count = await people.table.countRows();
    expect(count).toEqual(133);
    count = await movies.table.countRows();
    expect(count).toEqual(38);
    count = await movieEdges.table.countRows();
    expect(count).toEqual(506);

    let samples = await people.getSampleGraph({
      nodeLimit: 5
    });

    expect(samples.nodes[0].type).toEqual('Node');
    expect(samples.edges[0].edgeInstance.type).toEqual('Edge');

    samples = {
      nodes: samples.nodes.map(d => d.row),
      edges: samples.edges.map(d => d.edgeInstance.row)
    };
    expect(samples).toEqual([ null ]);

    samples = await movies.getSampleGraph({
      nodeLimit: 5
    });

    expect(samples.nodes[0].type).toEqual('Node');
    expect(samples.edges[0].edgeInstance.type).toEqual('Edge');

    samples = {
      nodes: samples.nodes.map(d => d.row),
      edges: samples.edges.map(d => d.edgeInstance.row)
    };
    expect(samples).toEqual([ null ]);

    samples = await movieEdges.getSampleGraph({
      edgeLimit: 5
    });

    expect(samples.nodes[0].type).toEqual('Node');
    expect(samples.edges[0].edgeInstance.type).toEqual('Edge');

    samples = {
      nodes: samples.nodes.map(d => d.row),
      edges: samples.edges.map(d => d.edgeInstance.row)
    };
    expect(samples).toEqual([ null ]);
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

    let samples = years.getSampleGraph({ nodeLimit: 5 });

    expect(samples).toEqual([ null ]);
  });

  test('Person + Year (as aggregated nodes)', async () => {
    expect.assertions(7);

    let people = (await utils.loadFiles(['people.csv']))[0];

    // Interpretation
    people = people.interpretAsNodes();
    const years = people.aggregate('born');

    let count = await people.table.countRows();
    expect(count).toEqual(133);
    count = await years.table.countRows();
    expect(count).toEqual(53);

    let samples = years.getSampleGraph({ nodeLimit: 5 });

    expect(samples).toEqual([ null ]);
  });
});
