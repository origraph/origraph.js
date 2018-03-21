const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
const fs = require('fs');

module.exports = [
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/blackJack_round1.json', 'utf8', (err, data) => {
        if (err) { reject(err); }

        let doc = JSON.parse(data);
        let queries = {
          '@ $["Player 1"]': [doc.contents['Player 1']],
          '@ $["Player 1"][?(@.suit==="♣")]': [
            { 'suit': '♣', 'value': '8' },
            { 'suit': '♣', 'value': 'Q' }
          ],
          '@ $[*][?(@.suit==="♥")] ^': [
            {
              '0': { 'suit': '♥', 'value': 'A' },
              '1': { 'suit': '♦', 'value': 'K' }
            },
            {
              '0': { 'suit': '♦', 'value': '2' },
              '1': { 'suit': '♥', 'value': 'J' },
              '2': { 'suit': '♠', 'value': 'K' }
            }
          ]
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

          // Single-document selection tests
          let docSelection = mure.selectDoc('application/json;blackJack_round1.json');
          let selectors = Object.keys(queries);
          for (let i = 0; i < selectors.length; i += 1) {
            let selector = selectors[i];
            let selection = docSelection.selectAll(selector);
            let expectedObjs = queries[selector];
            let nodes = await selection.nodes();
            let selectedObjs = nodes.map(n => n.value);
            tests.push({
              name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
              result: logging.testObjectEquality(expectedObjs, selectedObjs)
            });
          }
          resolve(tests);
        })();
      });
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/blackJack_round2.json', 'utf8', (err, data) => {
        if (err) { reject(err); }

        let doc2 = JSON.parse(data);
        let queries = {
          '@ { "filename": "blackJack_round2.json" } $["Player 1"]': [doc2.contents['Player 1']],
          '@ { "filename": { "$regex": "blackJack_round\\\\d.json" } } $["Player 1"][?(@.suit==="♣")]': [
            { 'suit': '♣', 'value': '8' },
            { 'suit': '♣', 'value': 'Q' },
            { 'suit': '♣', 'value': 'Q' },
            { 'suit': '♣', 'value': '7' }
          ],
          '@ { "filename": { "$regex": "blackJack_round\\\\d.json" } } $[*][?(@.suit==="♥")] ^': [
            {
              '0': { 'suit': '♥', 'value': 'A' },
              '1': { 'suit': '♦', 'value': 'K' }
            },
            {
              '0': { 'suit': '♦', 'value': '2' },
              '1': { 'suit': '♥', 'value': 'J' },
              '2': { 'suit': '♠', 'value': 'K' }
            },
            {
              '0': { 'suit': '♦', 'value': '8' },
              '1': { 'suit': '♥', 'value': 'A' }
            },
            {
              '0': { 'suit': '♣', 'value': '4' },
              '1': { 'suit': '♥', 'value': '5' },
              '2': { 'suit': '♠', 'value': 'K' }
            }
          ]
        };

        (async () => {
          let uploadMessage = await mure.uploadString('blackJack_round2.json', 'application/json', data);
          let tests = [];
          tests.push({
            name: 'Upload blackJack_round2.json for selector testing',
            result: {
              passed: uploadMessage.ok,
              details: uploadMessage.ok ? undefined : JSON.stringify(uploadMessage, null, 2)
            }
          });

          // Multi-document selection tests
          let selectors = Object.keys(queries);
          for (let i = 0; i < selectors.length; i += 1) {
            let selector = selectors[i];
            let selection = mure.selectAll(selector);
            let expectedObjs = queries[selector];
            let nodes = await selection.nodes();
            let selectedObjs = nodes.map(n => n.value);
            tests.push({
              name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
              result: logging.testObjectEquality(expectedObjs, selectedObjs)
            });
          }
          resolve(tests);
        })();
      });
    });
  },
  async () => {
    return new Promise((resolve, reject) => {
      let selection = mure.selectAll();
      resolve([{
        name: 'headless selection test',
        result: {
          passed: selection.headless === true,
          details: selection.headless ? undefined : 'Headless value: ' + selection.headless
        }
      }]);
    });
  }
];
