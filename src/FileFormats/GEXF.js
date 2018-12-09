import FileFormat from './FileFormat.js';

class D3Json extends FileFormat {
  async importData ({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }
  async formatData ({
    model,
    includeClasses = Object.values(model.classes),
    classAttribute = 'class'
  }) {
    let nodeChunk = '';
    let edgeChunk = '';

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        for await (const node of classObj.table.iterate()) {
          nodeChunk += `
    <node id="${node.exportId}" label="${node.label}">
      <attvalues>
        <attvalue for="0" value="${classObj.className}"/>
      </attvalues>
    </node>`;
        }
      } else if (classObj.type === 'Edge') {
        for await (const edge of classObj.table.iterate()) {
          for await (const source of edge.sourceNodes({ classes: includeClasses })) {
            for await (const target of edge.targetNodes({ classes: includeClasses })) {
              edgeChunk += `
    <edge id="${edge.exportId}" source="${source.exportId}" target="${target.exportId}">
      <attvalues>
        <attvalue for="0" value="${classObj.className}"/>
      </attvalues>
    </edge>`;
            }
          }
        }
      }
    }

    const result = `\
<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">
<meta lastmodifieddate="2009-03-20">
  <creator>origraph.github.io</creator>
  <description>${model.name}</description>
</meta>
<graph mode="static" defaultedgetype="directed">
  <attributes class="node">
    <attribute id="0" title="${classAttribute}" type="string"/>
  </attributes>
  <attributes class="edge">
    <attribute id="0" title="${classAttribute}" type="string"/>
  </attributes>
  <nodes>${nodeChunk}
  </nodes>
  <edges>${edgeChunk}
  </edges>
</graph>
</gexf>
  `;

    return {
      data: 'data:text/xml;base64,' + Buffer.from(result).toString('base64'),
      type: 'text/xml',
      extension: 'gexf'
    };
  }
}
export default new D3Json();
