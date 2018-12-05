import ParseFailure from './ParseFailure.js';

const NODE_NAMES = ['nodes', 'Nodes'];
const EDGE_NAMES = ['edges', 'links', 'Edges', 'Links'];

class D3Json {
  async importData ({ model, text }) {
    const data = JSON.parse(text);
    const nodeName = NODE_NAMES.find(name => data[name] instanceof Array);
    const edgeName = EDGE_NAMES.find(name => data[name] instanceof Array);
    if (!nodeName || !edgeName) {
      throw new ParseFailure(this);
    }

    const coreTable = model.createTable({
      type: 'StaticDictTable',
      name: 'coreTable',
      data: data
    });
    const coreClass = model.createClass({
      type: 'GenericClass',
      tableId: coreTable.tableId
    });
    let [nodes, edges] = coreClass.closedTranspose([nodeName, edgeName]);
    nodes = nodes.interpretAsNodes();
    nodes.setClassName(nodeName);
    edges = edges.interpretAsEdges();
    edges.setClassName(edgeName);
    coreClass.delete();

    nodes.connectToEdgeClass({
      edgeClass: edges,
      side: 'source',
      nodeAttribute: 'index',
      edgeAttribute: 'source'
    });
    nodes.connectToEdgeClass({
      edgeClass: edges,
      side: 'target',
      nodeAttribute: 'index',
      edgeAttribute: 'target'
    });
  }
  async exportData ({ model, excludeClasses = [], pretty = true }) {
    const result = {
      nodes: [],
      links: []
    };
    for (const classObj of Object.values(model.classes)) {
      if (excludeClasses.indexOf(classObj) === -1) {
        for await (const item of classObj.iterate()) {
          const row = {};
          for (const attr in item.row) {
            row[attr] = item.row[attr] instanceof Promise ? await item.row[attr] : item.row[attr];
          }
          if (item.type === 'Node') {
            row.index = item.exportId;
            result.nodes.push(row);
          } else if (item.type === 'Edge') {
            for await (const source of item.sourceNodes()) {
              row.source = source.exportId;
              for await (const target of item.targetNodes()) {
                row.target = target.exportId;
                result.links.push(Object.assign({}, row));
              }
            }
          }
        }
      }
    }
    if (pretty) {
      result.nodes = result.nodes.map(row => JSON.stringify(row))
        .join('    ,\n');
      result.links = result.links.map(row => JSON.stringify(row))
        .join('    ,\n');
      return `\
{
  "nodes": [
    ${result.nodes}
  ],
  "edges": [
    ${result.links}
  ]
}
`;
    } else {
      return JSON.stringify(result);
    }
  }
}
export default new D3Json();
