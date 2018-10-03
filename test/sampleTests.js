const origraph = require('../dist/origraph.cjs.js');
const loadFiles = require('./loadFiles.js');

async function getNodeToEdgeSamples (nodeClassObj, branchLimit = 1, fullLimit = 5) {
  const samples = [];
  let fullMatches = 0;
  for await (const node of nodeClassObj.table.iterate()) {
    for await (const edge of node.edges({ limit: branchLimit })) {
      samples.push({ node, edge });
      fullMatches++;
      if (fullMatches >= fullLimit) {
        return samples;
      }
    }
  }
  return samples;
}

async function getEdgeToNodeSamples (edgeClassObj, branchLimit = 1, fullLimit = 5) {
  const samples = [];
  let fullMatches = 0;
  for await (const edge of edgeClassObj.table.iterate()) {
    for await (const source of edge.sourceNodes({ limit: branchLimit })) {
      for await (const target of edge.targetNodes({ limit: branchLimit })) {
        samples.push({ source, edge, target });
        fullMatches++;
        if (fullMatches >= fullLimit) {
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

  test('Movie + Person + Edge', async () => {
    expect.assertions(13);

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

    let count = await origraph.classes[peopleId].table.countRows();
    expect(count).toEqual(133);
    count = await origraph.classes[moviesId].table.countRows();
    expect(count).toEqual(38);
    count = await origraph.classes[movieEdgesId].table.countRows();
    expect(count).toEqual(506);

    let samples = await getNodeToEdgeSamples(origraph.classes[peopleId]);

    expect(samples[0].node).toBeInstanceOf(origraph.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(origraph.WRAPPERS.EdgeWrapper);

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

    samples = await getNodeToEdgeSamples(origraph.classes[moviesId]);

    expect(samples[0].node).toBeInstanceOf(origraph.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(origraph.WRAPPERS.EdgeWrapper);

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

    samples = await getEdgeToNodeSamples(origraph.classes[movieEdgesId]);

    expect(samples[0].source).toBeInstanceOf(origraph.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(origraph.WRAPPERS.EdgeWrapper);
    expect(samples[0].target).toBeInstanceOf(origraph.WRAPPERS.NodeWrapper);

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

  test('Person + Year + Person', async () => {
    expect.assertions(6);

    const peopleId = (await loadFiles(['people.csv']))[0].classId;

    // Interpretation
    origraph.classes[peopleId].interpretAsNodes();
    const yearsId = origraph.classes[peopleId].connectToNodeClass({
      otherNodeClass: origraph.classes[peopleId],
      attribute: 'born',
      otherAttribute: 'born'
    }).classId;

    let count = await origraph.classes[peopleId].table.countRows();
    expect(count).toEqual(133);
    count = await origraph.classes[yearsId].table.countRows();
    expect(count).toEqual(-1); // TODO: this should at least be higher than 133

    let samples = await getEdgeToNodeSamples(origraph.classes[yearsId]);

    expect(samples[0].source).toBeInstanceOf(origraph.WRAPPERS.NodeWrapper);
    expect(samples[0].edge).toBeInstanceOf(origraph.WRAPPERS.EdgeWrapper);
    expect(samples[0].target).toBeInstanceOf(origraph.WRAPPERS.NodeWrapper);

    samples = samples.map(sample => {
      return {
        source: sample.source.row.name,
        edge: sample.edge.index,
        target: sample.target.row.name
      };
    });
    expect(samples).toEqual([
      {'edge': '1929', 'source': 'Max von Sydow', 'target': 'Max von Sydow'},
      {'edge': '1930', 'source': 'Gene Hackman', 'target': 'Gene Hackman'},
      {'edge': '1931', 'source': 'Mike Nichols', 'target': 'Mike Nichols'},
      {'edge': '1932', 'source': 'Milos Forman', 'target': 'Milos Forman'},
      {'edge': '1933', 'source': 'Tom Skerritt', 'target': 'Tom Skerritt'}
    ]);
  });
});
