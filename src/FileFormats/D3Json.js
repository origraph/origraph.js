import FileFormat from './FileFormat.js';
import ParseFailure from './ParseFailure.js';

const NODE_NAMES = ['nodes', 'Nodes'];
const EDGE_NAMES = ['edges', 'links', 'Edges', 'Links'];

class D3Json extends FileFormat {
  async importData ({
    model,
    text,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
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

    if (classAttribute) {
      if (nodeAttribute === null) {
        throw new Error(`Can't import classes from D3-style JSON without nodeAttribute`);
      }
      const nodeClasses = [];
      const nodeClassLookup = {};
      const edgeClasses = [];
      for await (const nodeClass of nodes.openFacet(classAttribute)) {
        nodeClassLookup[nodeClass.className] = nodeClasses.length;
        nodeClasses.push(nodeClass.interpretAsNodes());
      }
      for await (const edgeClass of edges.openFacet(classAttribute)) {
        edgeClasses.push(edgeClass.interpretAsEdges());
        const sample = await edgeClass.table.getItem();
        const sourceClassName = sample.row[sourceAttribute + '_' + classAttribute];
        if (nodeClassLookup[sourceClassName] !== undefined) {
          edgeClass.connectToNodeClass({
            nodeClass: nodeClasses[nodeClassLookup[sourceClassName]],
            side: 'source',
            nodeAttribute,
            edgeAttribute: sourceAttribute
          });
        }
        const targetClassName = sample.row[targetAttribute + '_' + classAttribute];
        if (nodeClassLookup[targetClassName] !== undefined) {
          edgeClass.connectToNodeClass({
            nodeClass: nodeClasses[nodeClassLookup[targetClassName]],
            side: 'target',
            nodeAttribute,
            edgeAttribute: targetAttribute
          });
        }
      }
    } else {
      nodes = nodes.interpretAsNodes();
      nodes.setClassName(nodeName);
      edges = edges.interpretAsEdges();
      edges.setClassName(edgeName);
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'source',
        nodeAttribute,
        edgeAttribute: sourceAttribute
      });
      nodes.connectToEdgeClass({
        edgeClass: edges,
        side: 'target',
        nodeAttribute,
        edgeAttribute: targetAttribute
      });
    }
  }
  async formatData ({
    model,
    includeClasses = Object.values(model.classes),
    pretty = true,
    nodeAttribute = null,
    sourceAttribute = 'source',
    targetAttribute = 'target',
    classAttribute = null
  }) {
    if (classAttribute && !nodeAttribute) {
      throw new Error(`Can't export D3-style JSON with classes, without a nodeAttribute`);
    }
    let result = {
      nodes: [],
      links: []
    };
    const nodeLookup = {};
    const nodeClasses = [];
    const edgeClasses = [];
    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        nodeClasses.push(classObj);
      } else if (classObj.type === 'Edge') {
        edgeClasses.push(classObj);
      } else {
        result.other = result.other || [];
        for await (const item of classObj.table.iterate()) {
          result.other.push(await this.buildRow(item));
        }
      }
    }
    for (const nodeClass of nodeClasses) {
      for await (const node of nodeClass.table.iterate()) {
        nodeLookup[node.exportId] = result.nodes.length;
        const row = await this.buildRow(node);
        if (nodeAttribute) {
          row[nodeAttribute] = node.exportId;
        }
        if (classAttribute) {
          row[classAttribute] = node.classObj.className;
        }
        result.nodes.push(row);
      }
    }
    for (const edgeClass of edgeClasses) {
      for await (const edge of edgeClass.table.iterate()) {
        const row = await this.buildRow(edge);
        for await (const source of edge.sourceNodes({ classes: nodeClasses })) {
          row[sourceAttribute] = nodeAttribute ? source.exportId : nodeLookup[source.exportId];
          if (classAttribute) {
            row[sourceAttribute + '_' + classAttribute] = source.classObj.className;
          }
          for await (const target of edge.targetNodes({ classes: nodeClasses })) {
            row[targetAttribute] = nodeAttribute ? target.exportId : nodeLookup[target.exportId];
            if (classAttribute) {
              row[targetAttribute + '_' + classAttribute] = target.classObj.className;
            }
            result.links.push(Object.assign({}, row));
          }
        }
      }
    }
    if (pretty) {
      result.nodes = '  "nodes": [\n    ' + result.nodes.map(row => JSON.stringify(row))
        .join(',\n    ') + '\n  ]';
      result.links = '  "links": [\n    ' + result.links.map(row => JSON.stringify(row))
        .join(',\n    ') + '\n  ]';
      if (result.other) {
        result.other = ',\n  "other": [\n    ' + result.other.map(row => JSON.stringify(row))
          .join(',\n    ') + '\n  ]';
      }
      result = `{\n${result.nodes},\n${result.links}${result.other || ''}\n}\n`;
    } else {
      result = JSON.stringify(result);
    }
    return {
      data: 'data:text/json;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/json',
      extension: 'json'
    };
  }
}
export default new D3Json();
