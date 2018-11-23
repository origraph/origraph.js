const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Interpretation Tests', () => {
  afterEach(() => {
    origraph.deleteAllModels();
  });

  test('Movie + Person nodes + Connections', async () => {
    expect.assertions(1);

    await utils.setupMovies();

    expect(origraph.currentModel.getModelDump())
      .toEqual(require('./interpretationDumps/movies.json'));
  });
  test('Simple self edge test', async () => {
    expect.assertions(1);

    let [ nodeClass ] = await utils.loadFiles(['csvTest.csv']);

    nodeClass = nodeClass.interpretAsNodes();
    nodeClass.setClassName('Node');
    const edgeClass = nodeClass.connectToNodeClass({
      otherNodeClass: nodeClass,
      attribute: 'is',
      otherAttribute: 'a'
    });
    edgeClass.toggleDirection();
    edgeClass.setClassName('Edge');

    expect(origraph.currentModel.getModelDump())
      .toEqual(require('./interpretationDumps/selfEdge.json'));
  });

  test('Movies to Edges', async () => {
    expect.assertions(1);

    let { movies } = await utils.setupMovies();

    // Reinterpret Movies as Edges
    movies.interpretAsEdges({ autoconnect: true });

    expect(origraph.currentModel.getModelDump())
      .toEqual(require('./interpretationDumps/movies_asEdges.json'));
  });

  test('Movies to Edges and Back Again', async () => {
    expect.assertions(1);

    let { movies } = await utils.setupMovies();

    // Reinterpret Movies as Edges
    movies = movies.interpretAsEdges({ autoconnect: true });

    // Reinterpret Movies as Nodes
    movies.interpretAsNodes();

    expect(origraph.currentModel.getModelDump())
      .toEqual(require('./interpretationDumps/movies_asEdgesAndBack.json'));
  });

  test('Northwind test', async () => {
    expect.assertions(1);

    await utils.setupNorthwind();

    expect(origraph.currentModel.getModelDump())
      .toEqual(require('./interpretationDumps/northwind.json'));
  });
});
