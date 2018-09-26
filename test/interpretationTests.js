const mure = require('../dist/mure.cjs.js');
const loadFiles = require('./loadFiles.js');

describe('Interpretation Tests', () => {
  afterEach(() => {
    mure.deleteAllClasses();
    mure.deleteAllUnusedTables();
  });

  test('Movie + Person nodes + Connections', async () => {
    expect.assertions(20);

    const classes = await loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    const [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    mure.classes[peopleId].interpretAsNodes();
    mure.classes[peopleId].setClassName('People');

    mure.classes[moviesId].interpretAsNodes();
    mure.classes[moviesId].setClassName('Movies');

    mure.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    mure.classes[peopleId].connectToEdgeClass({
      edgeClass: mure.classes[movieEdgesId],
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    mure.classes[movieEdgesId].connectToNodeClass({
      nodeClass: mure.classes[moviesId],
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    const rawPeopleSpec = mure.classes[peopleId]._toRawObject();
    expect(rawPeopleSpec.annotation).toEqual('');
    expect(rawPeopleSpec.classId).toEqual(peopleId);
    expect(rawPeopleSpec.className).toEqual('People');
    expect(rawPeopleSpec.edgeClassIds[movieEdgesId]).toEqual(true);

    const rawMoviesSpec = mure.classes[moviesId]._toRawObject();
    expect(rawMoviesSpec.annotation).toEqual('');
    expect(rawMoviesSpec.classId).toEqual(moviesId);
    expect(rawMoviesSpec.className).toEqual('Movies');
    expect(rawMoviesSpec.edgeClassIds[movieEdgesId]).toEqual(true);

    const rawMovieEdgesSpec = mure.classes[movieEdgesId]._toRawObject();
    expect(rawMovieEdgesSpec.annotation).toEqual('');
    expect(rawMovieEdgesSpec.classId).toEqual(movieEdgesId);
    expect(rawMovieEdgesSpec.className).toEqual(null);
    expect(rawMovieEdgesSpec.directed).toEqual(false);
    expect(rawMovieEdgesSpec.sourceClassId).toEqual(peopleId);
    expect(rawMovieEdgesSpec.targetClassId).toEqual(moviesId);

    let [ edgesAggregatedId, connectedId, peopleAggregatedId ] =
      rawMovieEdgesSpec.sourceTableIds;
    expect(mure.tables[edgesAggregatedId].parentTable.tableId)
      .toEqual(mure.classes[movieEdgesId].tableId);
    expect(mure.tables[connectedId].parentTables.map(table => table.tableId))
      .toEqual([ edgesAggregatedId, peopleAggregatedId ]);
    expect(mure.tables[peopleAggregatedId].parentTable.tableId)
      .toEqual(mure.classes[peopleId].tableId);

    let moviesAggregatedId;
    [ edgesAggregatedId, connectedId, moviesAggregatedId ] =
      rawMovieEdgesSpec.targetTableIds;
    expect(mure.tables[edgesAggregatedId].parentTable.tableId)
      .toEqual(mure.classes[movieEdgesId].tableId);
    expect(mure.tables[connectedId].parentTables.map(table => table.tableId))
      .toEqual([ edgesAggregatedId, moviesAggregatedId ]);
    expect(mure.tables[moviesAggregatedId].parentTable.tableId)
      .toEqual(mure.classes[moviesId].tableId);
  });

  test('Simple self edge test', async () => {
    expect.assertions(10);

    let [ nodeClassId ] = (await loadFiles(['csvTest.csv'])).map(classObj => classObj.classId);

    mure.classes[nodeClassId].interpretAsNodes();
    const edgeClassId = mure.classes[nodeClassId].connectToNodeClass({
      otherNodeClass: mure.classes[nodeClassId],
      attribute: 'is',
      otherAttribute: 'a'
    }).classId;
    mure.classes[edgeClassId].toggleDirection();

    const nodeSpec = mure.classes[nodeClassId]._toRawObject();
    expect(nodeSpec.annotation).toEqual('');
    expect(nodeSpec.classId).toEqual(nodeClassId);
    expect(nodeSpec.className).toEqual(null);
    expect(nodeSpec.edgeClassIds[edgeClassId]).toEqual(true);

    const edgeSpec = mure.classes[edgeClassId]._toRawObject();
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
    mure.classes[peopleId].interpretAsNodes();
    mure.classes[peopleId].setClassName('People');

    mure.classes[moviesId].interpretAsNodes();
    mure.classes[moviesId].setClassName('Movies');

    mure.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    mure.classes[peopleId].connectToEdgeClass({
      edgeClass: mure.classes[movieEdgesId],
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    mure.classes[movieEdgesId].connectToNodeClass({
      nodeClass: mure.classes[moviesId],
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    // Reinterpret Movies as Edges
    moviesId = mure.classes[moviesId].interpretAsEdges().classId;

    const rawMoviesSpec = mure.classes[moviesId]._toRawObject();
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
    mure.classes[peopleId].interpretAsNodes();
    mure.classes[peopleId].setClassName('People');

    mure.classes[moviesId].interpretAsNodes();
    mure.classes[moviesId].setClassName('Movies');

    mure.classes[movieEdgesId].interpretAsEdges();
    const movieEdgesTableId = mure.classes[movieEdgesId].tableId;

    // Set up initial connections
    mure.classes[peopleId].connectToEdgeClass({
      edgeClass: mure.classes[movieEdgesId],
      side: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    mure.classes[movieEdgesId].connectToNodeClass({
      nodeClass: mure.classes[moviesId],
      side: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    // Reinterpret Movies as Edges
    moviesId = mure.classes[moviesId].interpretAsEdges().classId;

    // Reinterpret Movies as Nodes
    moviesId = mure.classes[moviesId].interpretAsNodes().classId;

    // Check that the basics are still there
    const rawMoviesSpec = mure.classes[moviesId]._toRawObject();
    expect(rawMoviesSpec.annotation).toEqual('');
    expect(rawMoviesSpec.classId).toEqual(moviesId);
    expect(rawMoviesSpec.className).toEqual('Movies');

    // Check that we now have exactly one edge class that refers to
    // the movieEdges table
    const edgeClassIds = Object.keys(rawMoviesSpec.edgeClassIds);
    expect(edgeClassIds.length).toEqual(1);
    expect(mure.classes[edgeClassIds[0]].tableId).toEqual(movieEdgesTableId);
  });
});
