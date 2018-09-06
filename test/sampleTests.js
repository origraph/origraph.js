const mure = require('../dist/mure.cjs.js');
const loadFiles = require('./loadFiles.js');

async function getNodeToEdgeSamples (nodeClassObj) {
  const samples = [];
  for await (const node of nodeClassObj.table.iterate({ limit: 2 })) {
    for await (const edge of node.edges({ limit: 2 })) {
      samples.push({ node, edge });
    }
  }
  return samples;
}

async function getEdgeToNodeSamples (edgeClassObj) {
  const samples = [];
  for await (const edge of edgeClassObj.table.iterate({ limit: 2 })) {
    for await (const source of edge.sourceNodes({ limit: 2 })) {
      for await (const target of edge.targetNodes({ limit: 2 })) {
        samples.push({ source, edge, target });
      }
    }
  }
  return samples;
}

describe('Sample Tests', () => {
  afterEach(() => {
    mure.deleteAllClasses();
    mure.deleteAllUnusedTables();
  });

  test('Movie + Person + Edge Samples', async () => {
    expect.assertions(6);

    const classes = await loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    const [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    mure.classes[peopleId].interpretAsNodes();
    mure.classes[peopleId].setClassName('People');

    mure.classes[moviesId].interpretAsNodes();
    mure.classes[moviesId].setClassName('Movies');

    mure.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    await mure.classes[peopleId].connectToEdgeClass({
      edgeClass: mure.classes[movieEdgesId],
      direction: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    await mure.classes[movieEdgesId].connectToNodeClass({
      nodeClass: mure.classes[moviesId],
      direction: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    let count = await mure.classes[peopleId].table.countRows();
    expect(count).toEqual(133);
    count = await mure.classes[moviesId].table.countRows();
    expect(count).toEqual(38);
    count = await mure.classes[movieEdgesId].table.countRows();
    expect(count).toEqual(506);

    let samples = (await getNodeToEdgeSamples(mure.classes[peopleId]))
      .map(sample => {
        return {
          node: sample.node.row.name,
          edge: sample.edge.row.edgeType
        };
      });
    expect(samples).toEqual([
      {'edge': 'ACTED_IN', 'node': 'Keanu Reeves'},
      {'edge': 'ACTED_IN', 'node': 'Keanu Reeves'},
      {'edge': 'ACTED_IN', 'node': 'Carrie-Anne Moss'},
      {'edge': 'ACTED_IN', 'node': 'Carrie-Anne Moss'}
    ]);

    samples = (await getNodeToEdgeSamples(mure.classes[moviesId]))
      .map(sample => {
        return {
          node: sample.node.row.title,
          edge: sample.edge.row.edgeType
        };
      });
    expect(samples).toEqual([
      {'edge': 'ACTED_IN', 'node': 'The Matrix'},
      {'edge': 'ACTED_IN', 'node': 'The Matrix'},
      {'edge': 'ACTED_IN', 'node': 'The Matrix Reloaded'},
      {'edge': 'ACTED_IN', 'node': 'The Matrix Reloaded'}
    ]);

    samples = (await getEdgeToNodeSamples(mure.classes[movieEdgesId]))
      .map(sample => {
        return {
          source: sample.source.row.name,
          edge: sample.edge.row.edgeType,
          target: sample.target.row.title
        };
      });
    expect(samples).toEqual([null]);
  });
});
