const fs = require('fs');
const origraph = require('../dist/origraph.cjs.js');

// Load a file
fs.readFile(`test/data/miserables.json`, 'utf8', async (err, text) => {
  if (err) { throw err; }

  // Initialize a network model
  const model = origraph.createModel({
    name: 'Les Miserables'
  });

  // This dataset comes in one base class...
  const baseClass = await model.addTextFile({
    name: 'miserables.json',
    text
  });
  // ... that we split up:
  let [ nodeClass, edgeClass ] = baseClass
    .closedTranspose(['nodes', 'links']);
  // We don't need baseClass anymore:
  baseClass.delete();

  // Now for the interpretive part:
  nodeClass = nodeClass.interpretAsNodes();
  nodeClass.setClassName('Characters');
  edgeClass = edgeClass.interpretAsEdges();
  edgeClass.setClassName('Co-occurrence');

  // With classes set up, let's connect them:
  edgeClass.connectToNodeClass({
    nodeClass,
    side: 'source',
    nodeAttribute: 'index',
    edgeAttribute: 'source'
  });
  edgeClass.connectToNodeClass({
    nodeClass,
    side: 'target',
    nodeAttribute: 'index',
    edgeAttribute: 'target'
  });

  // Finally, let's export as GEXF:
  const { data } = await model.formatData({
    format: 'GEXF',
    rawText: true
  });
  fs.writeFile('miserables.gexf', data,
    (err) => {
      if (err) { throw err; }
    });
});
