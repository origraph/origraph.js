const origraph = require('../dist/origraph.cjs.js');
const loadFiles = require('./loadFiles.js');

describe('Interpretation Tests', () => {
  afterEach(() => {
    origraph.deleteAllClasses();
    origraph.deleteAllUnusedTables();
  });

  test('Movie + Person nodes + Connections', async () => {
    expect.assertions(20);

    const classes = await loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    const [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    origraph.classes[peopleId].interpretAsNodes();
    origraph.classes[peopleId].setClassName('People');

    origraph.classes[moviesId].interpretAsNodes();
    origraph.classes[moviesId].setClassName('Movies');

    origraph.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    origraph.classes[peopleId].connectToEdgeClass({
      edgeClass: origraph.classes[movieEdgesId],
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    origraph.classes[movieEdgesId].connectToNodeClass({
      nodeClass: origraph.classes[moviesId],
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    const rawPeopleSpec = origraph.classes[peopleId]._toRawObject();
    expect(rawPeopleSpec.annotation).toEqual('');
    expect(rawPeopleSpec.classId).toEqual(peopleId);
    expect(rawPeopleSpec.className).toEqual('People');
    expect(rawPeopleSpec.edgeClassIds[movieEdgesId]).toEqual(true);

    const rawMoviesSpec = origraph.classes[moviesId]._toRawObject();
    expect(rawMoviesSpec.annotation).toEqual('');
    expect(rawMoviesSpec.classId).toEqual(moviesId);
    expect(rawMoviesSpec.className).toEqual('Movies');
    expect(rawMoviesSpec.edgeClassIds[movieEdgesId]).toEqual(true);

    const rawMovieEdgesSpec = origraph.classes[movieEdgesId]._toRawObject();
    expect(rawMovieEdgesSpec.annotation).toEqual('');
    expect(rawMovieEdgesSpec.classId).toEqual(movieEdgesId);
    expect(rawMovieEdgesSpec.className).toEqual(null);
    expect(rawMovieEdgesSpec.directed).toEqual(false);
    expect(rawMovieEdgesSpec.sourceClassId).toEqual(peopleId);
    expect(rawMovieEdgesSpec.targetClassId).toEqual(moviesId);

    let [ edgesAggregatedId, connectedId, peopleAggregatedId ] =
      rawMovieEdgesSpec.sourceTableIds;
    expect(origraph.tables[edgesAggregatedId].parentTable.tableId)
      .toEqual(origraph.classes[movieEdgesId].tableId);
    expect(origraph.tables[connectedId].parentTables.map(table => table.tableId))
      .toEqual([ edgesAggregatedId, peopleAggregatedId ]);
    expect(origraph.tables[peopleAggregatedId].parentTable.tableId)
      .toEqual(origraph.classes[peopleId].tableId);

    let moviesAggregatedId;
    [ edgesAggregatedId, connectedId, moviesAggregatedId ] =
      rawMovieEdgesSpec.targetTableIds;
    expect(origraph.tables[edgesAggregatedId].parentTable.tableId)
      .toEqual(origraph.classes[movieEdgesId].tableId);
    expect(origraph.tables[connectedId].parentTables.map(table => table.tableId))
      .toEqual([ edgesAggregatedId, moviesAggregatedId ]);
    expect(origraph.tables[moviesAggregatedId].parentTable.tableId)
      .toEqual(origraph.classes[moviesId].tableId);
  });

  test('Simple self edge test', async () => {
    expect.assertions(10);

    let [ nodeClassId ] = (await loadFiles(['csvTest.csv'])).map(classObj => classObj.classId);

    origraph.classes[nodeClassId].interpretAsNodes();
    const edgeClassId = origraph.classes[nodeClassId].connectToNodeClass({
      otherNodeClass: origraph.classes[nodeClassId],
      attribute: 'is',
      otherAttribute: 'a'
    }).classId;
    origraph.classes[edgeClassId].toggleDirection();

    const nodeSpec = origraph.classes[nodeClassId]._toRawObject();
    expect(nodeSpec.annotation).toEqual('');
    expect(nodeSpec.classId).toEqual(nodeClassId);
    expect(nodeSpec.className).toEqual(null);
    expect(nodeSpec.edgeClassIds[edgeClassId]).toEqual(true);

    const edgeSpec = origraph.classes[edgeClassId]._toRawObject();
    expect(edgeSpec.annotation).toEqual('');
    expect(edgeSpec.classId).toEqual(edgeClassId);
    expect(edgeSpec.className).toEqual(null);
    expect(edgeSpec.directed).toEqual(false);
    expect(edgeSpec.sourceClassId).toEqual(nodeClassId);
    expect(edgeSpec.targetClassId).toEqual(nodeClassId);
  });

  test('Movies to Edges', async () => {
    expect.assertions(6);

    const classes = await loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    let [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    origraph.classes[peopleId].interpretAsNodes();
    origraph.classes[peopleId].setClassName('People');

    origraph.classes[moviesId].interpretAsNodes();
    origraph.classes[moviesId].setClassName('Movies');

    origraph.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    origraph.classes[peopleId].connectToEdgeClass({
      edgeClass: origraph.classes[movieEdgesId],
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    origraph.classes[movieEdgesId].connectToNodeClass({
      nodeClass: origraph.classes[moviesId],
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    // Reinterpret Movies as Edges
    moviesId = origraph.classes[moviesId].interpretAsEdges().classId;

    const rawMoviesSpec = origraph.classes[moviesId]._toRawObject();
    expect(rawMoviesSpec.annotation).toEqual('');
    expect(rawMoviesSpec.classId).toEqual(moviesId);
    expect(rawMoviesSpec.className).toEqual('Movies');
    expect(rawMoviesSpec.directed).toEqual(false);
    expect(rawMoviesSpec.sourceClassId).toEqual(peopleId);
    expect(rawMoviesSpec.targetClassId).toEqual(peopleId);
  });

  test('Movies to Edges and Back Again', async () => {
    expect.assertions(5);

    const classes = await loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    let [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    origraph.classes[peopleId].interpretAsNodes();
    origraph.classes[peopleId].setClassName('People');

    origraph.classes[moviesId].interpretAsNodes();
    origraph.classes[moviesId].setClassName('Movies');

    origraph.classes[movieEdgesId].interpretAsEdges();
    const movieEdgesTableId = origraph.classes[movieEdgesId].tableId;

    // Set up initial connections
    origraph.classes[peopleId].connectToEdgeClass({
      edgeClass: origraph.classes[movieEdgesId],
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    origraph.classes[movieEdgesId].connectToNodeClass({
      nodeClass: origraph.classes[moviesId],
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    // Reinterpret Movies as Edges
    moviesId = origraph.classes[moviesId].interpretAsEdges().classId;

    // Reinterpret Movies as Nodes
    moviesId = origraph.classes[moviesId].interpretAsNodes().classId;

    // Check that the basics are still there
    const rawMoviesSpec = origraph.classes[moviesId]._toRawObject();
    expect(rawMoviesSpec.annotation).toEqual('');
    expect(rawMoviesSpec.classId).toEqual(moviesId);
    expect(rawMoviesSpec.className).toEqual('Movies');

    // Check that we now have exactly one edge class that refers to
    // the movieEdges table
    const edgeClassIds = Object.keys(rawMoviesSpec.edgeClassIds);
    expect(edgeClassIds.length).toEqual(1);
    expect(origraph.classes[edgeClassIds[0]].tableId).toEqual(movieEdgesTableId);
  });
});
