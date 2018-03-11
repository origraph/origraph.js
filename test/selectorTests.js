const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
const fs = require('fs');

module.exports = [
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/blackJack_round1.json', 'utf8', (err, data) => {
        if (err) { reject(err); }

        let doc = JSON.parse(data);
        let selectors = {
          '@ $["Player 1"]': [doc.contents['Player 1']]
        };

        (async () => {
          let uploadMessage = await mure.uploadString('blackJack_round1.json', 'application/json', data);
          let tests = [];
          tests.push({
            name: 'Upload blackJack_round1.json for selector testing',
            result: {
              passed: uploadMessage.ok,
              details: uploadMessage.ok ? undefined : JSON.stringify(uploadMessage, null, 2)
            }
          });

          // Direct selection tests
          tests.push(...await Promise.all(Object.keys(selectors)
            .map(selector => {
              let expectedObjs = selectors[selector];
              selector = '@ { "filename": "blackJack_round1.json"}' + selector.slice(1);
              let selection = mure.selectAll(selector);
              return selection.nodes().then(nodes => {
                let selectedObjs = nodes.map(n => n.value);
                return {
                  name: 'mure.selectAll(\'' + selector + '\')',
                  result: logging.testObjectEquality(expectedObjs, selectedObjs)
                };
              });
            })));

          // Child selection tests
          let docSelection = mure.selectDoc('application/json;blackJack_round1.json');
          tests.push(...await Promise.all(Object.keys(selectors)
            .map(selector => {
              let selection = docSelection.selectAll(selector);
              let expectedObjs = selectors[selector];
              return selection.nodes().then(nodes => {
                let selectedObjs = nodes.map(n => n.value);
                return {
                  name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
                  result: logging.testObjectEquality(expectedObjs, selectedObjs)
                };
              });
            })));
          resolve(tests);
        })();
      });
    });
  }
];
