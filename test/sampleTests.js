const mure = require('../dist/mure.cjs.js');
const loadFiles = require('./loadFiles.js');

async function getNodeToEdgeSamples (nodeClassObj) {
  const samples = [];
  let fullMatches = 0;
  for await (const node of nodeClassObj.table.iterate()) {
    for await (const edge of node.edges({ limit: 1 })) {
      samples.push({ node, edge });
      fullMatches++;
      if (fullMatches >= 5) {
        return samples;
      }
    }
  }
  return samples;
}

async function getEdgeToNodeSamples (edgeClassObj) {
  const samples = [];
  let fullMatches = 0;
  for await (const edge of edgeClassObj.table.iterate()) {
    for await (const source of edge.sourceNodes({ limit: 1 })) {
      for await (const target of edge.targetNodes({ limit: 1 })) {
        samples.push({ source, edge, target });
        fullMatches++;
        if (fullMatches >= 5) {
          return samples;
        }
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
    expect.assertions(13);

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

    let samples = await getNodeToEdgeSamples(mure.classes[peopleId]);

    expect(samples[0].node).toBeInstanceOf(mure.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(mure.WRAPPERS.EdgeWrapper);

    samples = samples.map(sample => {
      return {
        node: sample.node.row.name,
        edge: sample.edge.row.edgeType
      };
    });
    expect(samples).toEqual([
      {'edge': 'ACTED_IN', 'node': 'Keanu Reeves'},
      {'edge': 'ACTED_IN', 'node': 'Carrie-Anne Moss'},
      {'edge': 'ACTED_IN', 'node': 'Laurence Fishburne'},
      {'edge': 'ACTED_IN', 'node': 'Hugo Weaving'},
      {'edge': 'PRODUCED', 'node': 'Andy Wachowski'}
    ]);

    samples = await getNodeToEdgeSamples(mure.classes[moviesId]);

    expect(samples[0].node).toBeInstanceOf(mure.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(mure.WRAPPERS.EdgeWrapper);

    samples = samples.map(sample => {
      return {
        node: sample.node.row.title,
        edge: sample.edge.row.edgeType
      };
    });
    expect(samples).toEqual([
      {'edge': 'ACTED_IN', 'node': 'The Matrix'},
      {'edge': 'ACTED_IN', 'node': 'The Matrix Reloaded'},
      {'edge': 'ACTED_IN', 'node': 'The Matrix Revolutions'},
      {'edge': 'ACTED_IN', 'node': 'The Devil\'s Advocate'},
      {'edge': 'ACTED_IN', 'node': 'A Few Good Men'}
    ]);

    samples = await getEdgeToNodeSamples(mure.classes[movieEdgesId]);

    expect(samples[0].source).toBeInstanceOf(mure.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(mure.WRAPPERS.EdgeWrapper);
    expect(samples[0].target).toBeInstanceOf(mure.WRAPPERS.NodeWrapper);

    samples = samples.map(sample => {
      return {
        source: sample.source.row.name,
        edge: sample.edge.row.edgeType,
        target: sample.target.row.title
      };
    });
    expect(samples).toEqual([
      {'edge': 'ACTED_IN', 'source': 'Keanu Reeves', 'target': 'Something\'s Gotta Give'},
      {'edge': 'ACTED_IN', 'source': 'Keanu Reeves', 'target': 'Johnny Mnemonic'},
      {'edge': 'ACTED_IN', 'source': 'Keanu Reeves', 'target': 'The Replacements'},
      {'edge': 'ACTED_IN', 'source': 'Keanu Reeves', 'target': 'The Devil\'s Advocate'},
      {'edge': 'ACTED_IN', 'source': 'Keanu Reeves', 'target': 'The Matrix Revolutions'}
    ]);
  });
});
