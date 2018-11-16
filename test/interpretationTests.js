const origraph = require('../dist/origraph.cjs.js');
const utils = require('./utils.js');

describe('Interpretation Tests', () => {
  afterEach(() => {
    origraph.deleteAllModels();
  });

  test('Movie + Person nodes + Connections', async () => {
    expect.assertions(10);

    let { people, movies, movieEdges } = await utils.setupMovies();

    // Dump schema graph
    const dump = origraph.currentModel.getNetworkModelGraph();
    const peopleDump = dump.classes[dump.classLookup[people.classId]];
    expect(peopleDump.className).toEqual('People');
    expect(peopleDump.edgeClassIds[movieEdges.classId]).toEqual(true);
    expect(peopleDump.type).toEqual('NodeClass');
    const moviesDump = dump.classes[dump.classLookup[movies.classId]];
    expect(moviesDump.className).toEqual('Movies');
    expect(moviesDump.edgeClassIds[movieEdges.classId]).toEqual(true);
    expect(moviesDump.type).toEqual('NodeClass');
    const movieEdgesDump = dump.classes[dump.classLookup[movieEdges.classId]];
    expect(movieEdgesDump.className).toEqual(null);
    expect(movieEdgesDump.sourceClassId).toEqual(people.classId);
    expect(movieEdgesDump.targetClassId).toEqual(movies.classId);
    expect(movieEdgesDump.type).toEqual('EdgeClass');
  });
  test('Simple self edge test', async () => {
    expect.assertions(6);

    let [ nodeClass ] = await utils.loadFiles(['csvTest.csv']);

    nodeClass = nodeClass.interpretAsNodes();
    const edgeClass = nodeClass.connectToNodeClass({
      otherNodeClass: nodeClass,
      attribute: 'is',
      otherAttribute: 'a'
    });
    edgeClass.toggleDirection();

    const dump = origraph.currentModel.getNetworkModelGraph();
    const nodeDump = dump.classes[dump.classLookup[nodeClass.classId]];
    expect(nodeDump.className).toEqual(null);
    expect(nodeDump.edgeClassIds[edgeClass.classId]).toEqual(true);

    const edgeDump = dump.classes[dump.classLookup[edgeClass.classId]];
    expect(edgeDump.className).toEqual(null);
    expect(edgeDump.directed).toEqual(true);
    expect(edgeDump.sourceClassId).toEqual(nodeClass.classId);
    expect(edgeDump.targetClassId).toEqual(nodeClass.classId);
  });

  test('Movies to Edges', async () => {
    expect.assertions(8);

    let { people, movies, movieEdges } = await utils.setupMovies();

    // Reinterpret Movies as Edges
    movies = movies.interpretAsEdges({ autoconnect: true });

    // Check that movies are now self-edges to people, and that they're
    // no longer connected to movieEdges
    let dump = origraph.currentModel.getNetworkModelGraph();
    let moviesDump = dump.classes[dump.classLookup[movies.classId]];
    expect(moviesDump.className).toEqual('Movies');
    expect(moviesDump.directed).toEqual(false);
    expect(moviesDump.sourceClassId).toEqual(people.classId);
    expect(moviesDump.targetClassId).toEqual(people.classId);
    expect(moviesDump.type).toEqual('EdgeClass');
    let peopleDump = dump.classes[dump.classLookup[people.classId]];
    const expectedEdgeClassIds = {};
    expectedEdgeClassIds[movies.classId] = true;
    expectedEdgeClassIds[movieEdges.classId] = true;
    expect(peopleDump.edgeClassIds).toEqual(expectedEdgeClassIds);
    let movieEdgesDump = dump.classes[dump.classLookup[movieEdges.classId]];
    expect(movieEdgesDump.sourceClassId).toEqual(people.classId);
    expect(movieEdgesDump.targetClassId).toEqual(null);
  });

  test('Movies to Edges and Back Again', async () => {
    expect.assertions(3);

    let { people, movies, movieEdges } = await utils.setupMovies();

    // Reinterpret Movies as Edges
    movies = movies.interpretAsEdges({ autoconnect: true });

    // Reinterpret Movies as Nodes
    movies = movies.interpretAsNodes();

    // Validate that there are now two edge classes (the original movieEdges,
    // and the new one) attached to people, one attached to movies (NOT the
    // original movieEdges), and that they all point to the movieEdges table
    for (const connectedClass of people.connectedClasses()) {
      expect(connectedClass.tableId).toEqual(movieEdges.tableId);
    }
    for (const connectedClass of movies.connectedClasses()) {
      expect(connectedClass.tableId).toEqual(movieEdges.tableId);
    }
  });
});
