'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var xmlJs = _interopDefault(require('xml-js'));
var scalpel = require('scalpel');
var uki = require('uki');
var D3Node = _interopDefault(require('d3-node'));
var PouchDB = _interopDefault(require('pouchdb-node'));

var mureInteractivityRunnerText = "/* globals XMLHttpRequest, ActiveXObject, Node */\n/* eslint no-eval: 0 */\n(function () {\n  var nonAsyncScriptTexts = [];\n\n  function load (url, callback) {\n    var xhr;\n\n    if (typeof XMLHttpRequest !== 'undefined') {\n      xhr = new XMLHttpRequest();\n    } else {\n      var versions = [\n        'MSXML2.XmlHttp.5.0',\n        'MSXML2.XmlHttp.4.0',\n        'MSXML2.XmlHttp.3.0',\n        'MSXML2.XmlHttp.2.0',\n        'Microsoft.XmlHttp'\n      ];\n      for (var i = 0, len = versions.length; i < len; i++) {\n        try {\n          xhr = new ActiveXObject(versions[i]);\n          break;\n        } catch (e) {}\n      }\n    }\n\n    xhr.onreadystatechange = ensureReadiness;\n\n    function ensureReadiness () {\n      if (xhr.readyState < 4) {\n        return;\n      }\n\n      if (xhr.status !== 200) {\n        return;\n      }\n\n      // all is well\n      if (xhr.readyState === 4) {\n        callback(xhr.responseText);\n      }\n    }\n\n    xhr.open('GET', url, true);\n    xhr.send('');\n  }\n\n  function documentPositionComparator (a, b) {\n    // function shamelessly adapted from https://stackoverflow.com/questions/31991235/sort-elements-by-document-order-in-javascript/31992057\n    a = a.element;\n    b = b.element;\n    if (a === b) { return 0; }\n    var position = a.compareDocumentPosition(b);\n    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {\n      return -1;\n    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {\n      return 1;\n    } else { return 0; }\n  }\n\n  function loadUserLibraries (callback) {\n    // Grab all the mure:library tags, and load the referenced library (script src attributes\n    // in SVG don't work, so we have to manually load remote libraries)\n    var libraries = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'library'))\n      .map(element => {\n        return {\n          src: element.getAttribute('src'),\n          async: (element.getAttribute('async') || 'true').toLocaleLowerCase() !== 'false',\n          element: element\n        };\n      });\n\n    var loadedLibraries = {};\n    var onloadFired = false;\n\n    libraries.forEach(function (library) {\n      load(library.src, function (scriptText) {\n        if (library.async) {\n          window.eval(scriptText);\n        } else {\n          library.scriptText = scriptText;\n          nonAsyncScriptTexts.push(library);\n        }\n        loadedLibraries[library.src] = true;\n        attemptStart();\n      });\n    });\n\n    window.onload = function () {\n      onloadFired = true;\n      attemptStart();\n    };\n\n    function attemptStart () {\n      if (!onloadFired) {\n        return;\n      }\n      var allLoaded = libraries.every(library => {\n        return loadedLibraries[library.src];\n      });\n      if (allLoaded) {\n        callback();\n      }\n    }\n  }\n\n  function runUserScripts () {\n    var userScripts = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'script'))\n      .map(element => {\n        return {\n          element: element,\n          scriptText: element.textContent\n        };\n      });\n    var allScripts = nonAsyncScriptTexts.concat(userScripts)\n      .sort(documentPositionComparator);\n    allScripts.forEach(scriptOrLibrary => {\n      window.eval(scriptOrLibrary.scriptText);\n    });\n  }\n\n  // Where we actually start executing stuff:\n  if (!window.frameElement ||\n      !window.frameElement.__suppressMureInteractivity__) {\n    // We've been loaded directly into a browser, or embedded in a normal page;\n    // load all the libraries, and then run all the scripts\n    loadUserLibraries(runUserScripts);\n  }\n})();\n";

var defaultSvgDocTemplate = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" width=\"500\" height=\"500\">\n  <metadata id=\"mure\">\n    <mure xmlns=\"http://mure-apps.github.io\">\n    </mure>\n  </metadata>\n  <script id=\"mureInteractivityRunner\" type=\"text/javascript\">\n    <![CDATA[\n      ${mureInteractivityRunnerText}\n    ]]>\n  </script>\n</svg>\n";

var minimumSvgDoc = "<svg>\n  <metadata id=\"mure\">\n    <mure xmlns=\"http://mure-apps.github.io\">\n    </mure>\n  </metadata>\n</svg>\n";

var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();









var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};



















var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

// sneakily embed the interactivity-running script
var defaultSvgDoc = defaultSvgDocTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

var DocHandler = function () {
  /**
   *
   */
  function DocHandler() {
    classCallCheck(this, DocHandler);

    this.selectorParser = scalpel.createParser();
    // todo: for efficiency, I should rename all of xml-js's default (lengthy!) key names
    this.keyNames = {};
    this.json2xmlSettings = Object.assign({
      'compact': false,
      'indentCdata': true
    }, this.keyNames);
    this.xml2jsonSettings = Object.assign({
      'compact': false,
      'nativeType': true,
      'alwaysArray': true,
      'addParent': true
    }, this.keyNames);
    this.defaultJsonDoc = this.xml2json(defaultSvgDoc);
    this.minimumJsDoc = this.xml2js(minimumSvgDoc);
  }

  createClass(DocHandler, [{
    key: 'xml2js',
    value: function xml2js(text) {
      return xmlJs.xml2js(text, this.xml2jsonSettings);
    }
  }, {
    key: 'xml2json',
    value: function xml2json(text) {
      return xmlJs.xml2json(text, this.xml2jsonSettings);
    }
  }, {
    key: 'json2xml',
    value: function json2xml(text) {
      return xmlJs.json2xml(text, this.json2xmlSettings);
    }
  }, {
    key: 'js2xml',
    value: function js2xml(text) {
      return xmlJs.js2xml(text, this.json2xmlSettings);
    }
  }, {
    key: 'standardize',
    value: function standardize(testObj, standardObj) {
      if (!standardObj) {
        if (!testObj._id) {
          throw new Error('You must at least supply an id to standardize the document');
        }
        testObj.currentSelection = testObj.currentSelection || null;
        testObj.contents = this.standardize(testObj.contents || {}, this.minimumJsDoc);
      } else {
        // TODO
      }
      return testObj;
    }
  }, {
    key: 'iterate',
    value: function iterate(obj, callback) {
      var nodes = [];
      nodes.push(obj);
      do {
        obj = nodes.shift();
        callback(obj);
        if (obj.elements) {
          nodes.unshift.apply(nodes, toConsumableArray(obj.elements));
        }
      } while (nodes.length > 0);
    }
  }, {
    key: 'matchObject',
    value: function matchObject(obj, queryTokens) {
      // TODO
    }
  }, {
    key: 'selectAll',
    value: function selectAll(root, selector) {
      var _this = this;

      var queryTokens = this.selectorParser.parse(selector);
      var elements = [];
      this.iterate(root, function (obj) {
        if (_this.matchObject(obj, queryTokens)) {
          elements.push(obj);
        }
      });
      return elements;
    }
  }]);
  return DocHandler;
}();

var docH = new DocHandler();

var Mure = function (_Model) {
  inherits(Mure, _Model);

  function Mure(PouchDB$$1, d3, d3n) {
    classCallCheck(this, Mure);

    var _this = possibleConstructorReturn(this, (Mure.__proto__ || Object.getPrototypeOf(Mure)).call(this));

    _this.PouchDB = PouchDB$$1; // for Node.js, this will be pouchdb-node, not the regular one
    _this.d3 = d3; // for Node.js, this will be from d3-node, not the regular one
    _this.d3n = d3n; // in Node, we also need access to the higher-level stuff from d3-node

    // Enumerations...
    _this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

    // The namespace string for our custom XML
    _this.NSString = 'http://mure-apps.github.io';
    _this.d3.namespaces.mure = _this.NSString;

    // Create / load the local database of files
    _this.db = new _this.PouchDB('mure');

    // default error handling (apps can listen for / display error messages in addition to this):
    _this.on('error', function (errorMessage) {
      console.warn(errorMessage);
    });
    _this.catchDbError = function (errorObj) {
      _this.trigger('error', 'Unexpected error reading PouchDB: ' + errorObj.message + '\n' + errorObj.stack);
    };

    // in the absence of a custom dialogs, just use window.alert, window.confirm and window.prompt:
    _this.alert = function (message) {
      return new Promise(function (resolve, reject) {
        window.alert(message);
        resolve(true);
      });
    };
    _this.confirm = function (message) {
      return new Promise(function (resolve, reject) {
        resolve(window.confirm(message));
      });
    };
    _this.prompt = function (message, defaultValue) {
      return new Promise(function (resolve, reject) {
        resolve(window.prompt(message, defaultValue));
      });
    };
    return _this;
  }

  createClass(Mure, [{
    key: 'customizeAlertDialog',
    value: function customizeAlertDialog(showDialogFunction) {
      this.alert = showDialogFunction;
    }
  }, {
    key: 'customizeConfirmDialog',
    value: function customizeConfirmDialog(showDialogFunction) {
      this.confirm = showDialogFunction;
    }
  }, {
    key: 'customizePromptDialog',
    value: function customizePromptDialog(showDialogFunction) {
      this.prompt = showDialogFunction;
    }
  }, {
    key: 'openApp',
    value: function openApp(appName, newTab) {
      if (newTab) {
        window.open('/' + appName, '_blank');
      } else {
        window.location.pathname = '/' + appName;
      }
    }
  }, {
    key: 'getOrInitDb',
    value: function getOrInitDb() {
      var _this2 = this;

      var db = new this.PouchDB('mure');
      var couchDbUrl = window.localStorage.getItem('couchDbUrl');
      if (couchDbUrl) {
        asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
          var couchDb;
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  couchDb = new _this2.PouchDB(couchDbUrl, { skip_setup: true });
                  return _context.abrupt('return', db.sync(couchDb, { live: true, retry: true }));

                case 2:
                case 'end':
                  return _context.stop();
              }
            }
          }, _callee, _this2);
        }))().catch(function (err) {
          _this2.alert('Error syncing with ' + couchDbUrl + ': ' + err.message);
        });
      }
      return db;
    }
    /**
     * A wrapper around PouchDB.get() that ensures that the returned document
     * exists (uses default.text.svg when it doesn't), and has at least the
     * elements specified by minimum.text.svg
     * @return {object} A PouchDB document
     */

  }, {
    key: 'getStandardizedDoc',
    value: function getStandardizedDoc(docId) {
      return this.db.get(docId).catch(function (err) {
        if (err.name === 'not_found') {
          return {
            _id: docId,
            currentSelection: null,
            contents: JSON.parse(docH.defaultJsonDoc)
          };
        } else {
          throw err;
        }
      }).then(function (doc) {
        return docH.standardize(doc);
      });
    }
    /**
     *
     */

  }, {
    key: 'downloadDoc',
    value: function () {
      var _ref2 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(docId) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                return _context2.abrupt('return', this.db.get(docId).then(function (doc) {
                  var xmlText = docH.js2xml(doc.contents);

                  // create a fake link to initiate the download
                  var a = document.createElement('a');
                  a.style = 'display:none';
                  var url = window.URL.createObjectURL(new window.Blob([xmlText], { type: 'image/svg+xml' }));
                  a.href = url;
                  a.download = doc._id;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  a.parentNode.removeChild(a);
                }));

              case 1:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function downloadDoc(_x) {
        return _ref2.apply(this, arguments);
      }

      return downloadDoc;
    }()
  }]);
  return Mure;
}(uki.Model);

var d3n = new D3Node();

var main = new Mure(PouchDB, d3n.d3, d3n);

module.exports = main;
