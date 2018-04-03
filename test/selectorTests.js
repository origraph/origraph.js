const logging = require('./logging.js');
const mure = require('../dist/mure.cjs.js');
const fs = require('fs');
require('events').EventEmitter.defaultMaxListeners = 30;

module.exports = [
  async () => {
    return new Promise((resolve, reject) => {
      fs.readFile('test/data/blackJack_combined_selection.json', 'utf8', (err, blackJackSelection) => {
        if (err) { reject(err); }
        blackJackSelection = JSON.parse(blackJackSelection);
        fs.readFile('test/data/blackJack_round1.json', 'utf8', (err, data1) => {
          if (err) { reject(err); }
          fs.readFile('test/data/blackJack_round2.json', 'utf8', (err, data2) => {
            if (err) { reject(err); }

            (async () => {
              let doc = JSON.parse(data1);
              let queries1 = {
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

              let uploadMessage = await mure.uploadString('blackJack_round1.json', 'application/json', data1);
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
              let selectors = Object.keys(queries1);
              for (let i = 0; i < selectors.length; i += 1) {
                let selector = selectors[i];
                let selection = docSelection.selectAll(selector);
                let expectedObjs = queries1[selector];
                let nodes = await selection.nodes();
                let selectedObjs = nodes.map(n => n.value);
                tests.push({
                  name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
                  result: logging.testObjectEquality(expectedObjs, selectedObjs)
                });
              }

              let queries2 = {
                '@': blackJackSelection,
                '@ { "filename": "blackJack_round2.json" } $["Player 1"]': [
                  {
                    '0': { 'suit': '♠', 'value': '2' },
                    '1': { 'suit': '♣', 'value': 'Q' },
                    '2': { 'suit': '♣', 'value': '7' }
                  }
                ],
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

              uploadMessage = await mure.uploadString('blackJack_round2.json', 'application/json', data2);
              tests.push({
                name: 'Upload blackJack_round2.json for selector testing',
                result: {
                  passed: uploadMessage.ok,
                  details: uploadMessage.ok ? undefined : JSON.stringify(uploadMessage, null, 2)
                }
              });

              // Multi-document selection tests
              selectors = Object.keys(queries2);
              let cachedSelections = {};
              for (let i = 0; i < selectors.length; i += 1) {
                let selector = selectors[i];
                let selection = mure.selectAll(selector);
                cachedSelections[selector] = selection;
                let expectedObjs = queries2[selector];
                let nodes = await selection.nodes();
                let selectedObjs = nodes.map(n => n.value);
                tests.push({
                  name: 'mure.selectDoc().selectAll(\'' + selector + '\')',
                  result: logging.testObjectEquality(expectedObjs, selectedObjs)
                });
              }

              let deleteMessage = await mure.deleteDoc('application/json;blackJack_round2.json');
              tests.push({
                name: 'Delete blackJack_round2.json to make sure selectors still work',
                result: {
                  passed: deleteMessage.ok,
                  details: deleteMessage.ok ? undefined : JSON.stringify(deleteMessage, null, 2)
                }
              });

              let queries3 = {
                '@': [{ 'application/json;blackJack_round1.json': doc.contents }],
                '@ { "filename": "blackJack_round2.json" } $["Player 1"]': [],
                '@ { "filename": { "$regex": "blackJack_round\\\\d.json" } } $["Player 1"][?(@.suit==="♣")]': [
                  { 'suit': '♣', 'value': '8' },
                  { 'suit': '♣', 'value': 'Q' }
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
                  }
                ]
              };

              // Cache invalidation tests
              selectors = Object.keys(queries3);
              for (let i = 0; i < selectors.length; i += 1) {
                let selector = selectors[i];
                let selection = cachedSelections[selector];
                let expectedObjs = queries3[selector];
                let nodes = await selection.nodes();
                let selectedObjs = nodes.map(n => n.value);
                tests.push({
                  name: 'post-deletion: mure.selectDoc().selectAll(\'' + selector + '\')',
                  result: logging.testObjectEquality(expectedObjs, selectedObjs)
                });
              }

              resolve(tests);
            })();
          });
        });
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
