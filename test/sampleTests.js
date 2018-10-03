const origraph = require('../dist/origraph.cjs.js');
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
    origraph.deleteAllClasses();
    origraph.deleteAllUnusedTables();
  });

  test('Movie + Person + Edge Samples', async () => {
    expect.assertions(6);

    const classes = await loadFiles(['people.csv', 'movies.csv', 'movieEdges.csv']);

    const [ peopleId, moviesId, movieEdgesId ] = classes.map(classObj => classObj.classId);

    // Initial interpretation
    origraph.classes[peopleId].interpretAsNodes();
    origraph.classes[peopleId].setClassName('People');

    origraph.classes[moviesId].interpretAsNodes();
    origraph.classes[moviesId].setClassName('Movies');

    origraph.classes[movieEdgesId].interpretAsEdges();

    // Set up initial connections
    await origraph.classes[peopleId].connectToEdgeClass({
      edgeClass: origraph.classes[movieEdgesId],
      direction: 'source',
      nodeAttribute: 'id',
      edgeAttribute: 'sourceID'
    });
    await origraph.classes[movieEdgesId].connectToNodeClass({
      nodeClass: origraph.classes[moviesId],
      direction: 'target',
      nodeAttribute: 'id',
      edgeAttribute: 'targetID'
    });

    let count = await origraph.classes[peopleId].table.countRows();
    expect(count).toEqual(133);
    count = await origraph.classes[moviesId].table.countRows();
    expect(count).toEqual(38);
    count = await origraph.classes[movieEdgesId].table.countRows();
    expect(count).toEqual(506);

    let samples = (await getNodeToEdgeSamples(origraph.classes[peopleId]))
      .map(sample => {
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

    samples = (await getNodeToEdgeSamples(origraph.classes[moviesId]))
      .map(sample => {
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

    samples = (await getEdgeToNodeSamples(origraph.classes[movieEdgesId]))
      .map(sample => {
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
