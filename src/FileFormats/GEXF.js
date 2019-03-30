import FileFormat from './FileFormat.js';

const escapeChars = {
  '&quot;': /"/g,
  '&apos;': /'/g,
  '&lt;': /</g,
  '&gt;': />/g
};

class GEXF extends FileFormat {
  async importData ({
    model,
    text
  }) {
    throw new Error(`unimplemented`);
  }
  escape (str) {
    str = str.replace(/&/g, '&amp;');
    for (const [ repl, exp ] of Object.entries(escapeChars)) {
      str = str.replace(exp, repl);
    }
    return str;
  }
  async formatData ({
    model,
    includeClasses = Object.values(model.classes),
    classAttribute = 'class',
    rawText = false
  }) {
    let nodeChunk = '';
    let edgeChunk = '';

    for (const classObj of includeClasses) {
      if (classObj.type === 'Node') {
        for await (const node of classObj.table.iterate()) {
          nodeChunk += `
    <node id="${this.escape(node.exportId)}" label="${this.escape(node.label)}">
      <attvalues>
        <attvalue for="0" value="${this.escape(classObj.className)}"/>
      </attvalues>
    </node>`;
        }
      } else if (classObj.type === 'Edge') {
        for await (const edge of classObj.table.iterate()) {
          for await (const source of edge.sourceNodes({ classes: includeClasses })) {
            for await (const target of edge.targetNodes({ classes: includeClasses })) {
              edgeChunk += `
    <edge id="${this.escape(edge.exportId)}" source="${this.escape(source.exportId)}" target="${this.escape(target.exportId)}">
      <attvalues>
        <attvalue for="0" value="${this.escape(classObj.className)}"/>
      </attvalues>
    </edge>`;
            }
          }
        }
      }
    }

    let result = `\
<?xml version="1.0" encoding="UTF-8"?>
<gexf  xmlns="http://www.gexf.net/1.2draft" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.gexf.net/1.2draft http://www.gexf.net/1.2draft/gexf.xsd" version="1.2">
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
</gexf>`;
    if (!rawText) {
      result = 'data:text/xml;base64,' + Buffer.from(result).toString('base64');
    }
    return {
      data: result,
      type: 'text/xml',
      extension: 'gexf'
    };
  }
}
export default new GEXF();
