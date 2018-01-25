(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('xml-js'), require('scalpel'), require('uki'), require('d3'), require('pouchdb'), require('pouchdb-authentication')) :
	typeof define === 'function' && define.amd ? define(['xml-js', 'scalpel', 'uki', 'd3', 'pouchdb', 'pouchdb-authentication'], factory) :
	(global.mure = factory(global.xmlJs,global.scalpel,global.uki,global.d3,global.PouchDB,global.PouchAuthentication));
}(this, (function (xmlJs,scalpel,uki,d3,PouchDB,PouchAuthentication) { 'use strict';

xmlJs = xmlJs && xmlJs.hasOwnProperty('default') ? xmlJs['default'] : xmlJs;
PouchDB = PouchDB && PouchDB.hasOwnProperty('default') ? PouchDB['default'] : PouchDB;
PouchAuthentication = PouchAuthentication && PouchAuthentication.hasOwnProperty('default') ? PouchAuthentication['default'] : PouchAuthentication;

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

  function Mure(PouchDB$$1, d3$$1, d3n) {
    classCallCheck(this, Mure);

    var _this = possibleConstructorReturn(this, (Mure.__proto__ || Object.getPrototypeOf(Mure)).call(this));

    _this.PouchDB = PouchDB$$1; // for Node.js, this will be pouchdb-node, not the regular one
    _this.d3 = d3$$1; // for Node.js, this will be from d3-node, not the regular one
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

PouchDB.plugin(PouchAuthentication);

var module$1 = new Mure(PouchDB, d3);

return module$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Eb2NIYW5kbGVyL2luZGV4LmpzIiwiLi4vc3JjL011cmUvaW5kZXguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB4bWxKcyBmcm9tICd4bWwtanMnO1xuaW1wb3J0IHsgY3JlYXRlUGFyc2VyIH0gZnJvbSAnc2NhbHBlbCc7XG5pbXBvcnQgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IGZyb20gJy4vbXVyZUludGVyYWN0aXZpdHlSdW5uZXIudGV4dC5qcyc7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBkZWZhdWx0U3ZnRG9jVGVtcGxhdGUgZnJvbSAnLi9kZWZhdWx0LnRleHQuc3ZnJztcbmltcG9ydCBtaW5pbXVtU3ZnRG9jIGZyb20gJy4vbWluaW11bS50ZXh0LnN2Zyc7XG5cbi8vIHNuZWFraWx5IGVtYmVkIHRoZSBpbnRlcmFjdGl2aXR5LXJ1bm5pbmcgc2NyaXB0XG5jb25zdCBkZWZhdWx0U3ZnRG9jID0gZGVmYXVsdFN2Z0RvY1RlbXBsYXRlLnJlcGxhY2UoL1xcJHttdXJlSW50ZXJhY3Rpdml0eVJ1bm5lclRleHR9LywgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0KTtcblxuY2xhc3MgRG9jSGFuZGxlciB7XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHRoaXMuc2VsZWN0b3JQYXJzZXIgPSBjcmVhdGVQYXJzZXIoKTtcbiAgICAvLyB0b2RvOiBmb3IgZWZmaWNpZW5jeSwgSSBzaG91bGQgcmVuYW1lIGFsbCBvZiB4bWwtanMncyBkZWZhdWx0IChsZW5ndGh5ISkga2V5IG5hbWVzXG4gICAgdGhpcy5rZXlOYW1lcyA9IHt9O1xuICAgIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgJ2NvbXBhY3QnOiBmYWxzZSxcbiAgICAgICdpbmRlbnRDZGF0YSc6IHRydWVcbiAgICB9LCB0aGlzLmtleU5hbWVzKTtcbiAgICB0aGlzLnhtbDJqc29uU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICdjb21wYWN0JzogZmFsc2UsXG4gICAgICAnbmF0aXZlVHlwZSc6IHRydWUsXG4gICAgICAnYWx3YXlzQXJyYXknOiB0cnVlLFxuICAgICAgJ2FkZFBhcmVudCc6IHRydWVcbiAgICB9LCB0aGlzLmtleU5hbWVzKTtcbiAgICB0aGlzLmRlZmF1bHRKc29uRG9jID0gdGhpcy54bWwyanNvbihkZWZhdWx0U3ZnRG9jKTtcbiAgICB0aGlzLm1pbmltdW1Kc0RvYyA9IHRoaXMueG1sMmpzKG1pbmltdW1TdmdEb2MpO1xuICB9XG4gIHhtbDJqcyAodGV4dCkgeyByZXR1cm4geG1sSnMueG1sMmpzKHRleHQsIHRoaXMueG1sMmpzb25TZXR0aW5ncyk7IH1cbiAgeG1sMmpzb24gKHRleHQpIHsgcmV0dXJuIHhtbEpzLnhtbDJqc29uKHRleHQsIHRoaXMueG1sMmpzb25TZXR0aW5ncyk7IH1cbiAganNvbjJ4bWwgKHRleHQpIHsgcmV0dXJuIHhtbEpzLmpzb24yeG1sKHRleHQsIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyk7IH1cbiAganMyeG1sICh0ZXh0KSB7IHJldHVybiB4bWxKcy5qczJ4bWwodGV4dCwgdGhpcy5qc29uMnhtbFNldHRpbmdzKTsgfVxuICBzdGFuZGFyZGl6ZSAodGVzdE9iaiwgc3RhbmRhcmRPYmopIHtcbiAgICBpZiAoIXN0YW5kYXJkT2JqKSB7XG4gICAgICBpZiAoIXRlc3RPYmouX2lkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgYXQgbGVhc3Qgc3VwcGx5IGFuIGlkIHRvIHN0YW5kYXJkaXplIHRoZSBkb2N1bWVudCcpO1xuICAgICAgfVxuICAgICAgdGVzdE9iai5jdXJyZW50U2VsZWN0aW9uID0gdGVzdE9iai5jdXJyZW50U2VsZWN0aW9uIHx8IG51bGw7XG4gICAgICB0ZXN0T2JqLmNvbnRlbnRzID0gdGhpcy5zdGFuZGFyZGl6ZSh0ZXN0T2JqLmNvbnRlbnRzIHx8IHt9LCB0aGlzLm1pbmltdW1Kc0RvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE9cbiAgICB9XG4gICAgcmV0dXJuIHRlc3RPYmo7XG4gIH1cbiAgaXRlcmF0ZSAob2JqLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgbm9kZXMucHVzaChvYmopO1xuICAgIGRvIHtcbiAgICAgIG9iaiA9IG5vZGVzLnNoaWZ0KCk7XG4gICAgICBjYWxsYmFjayhvYmopO1xuICAgICAgaWYgKG9iai5lbGVtZW50cykge1xuICAgICAgICBub2Rlcy51bnNoaWZ0KC4uLm9iai5lbGVtZW50cyk7XG4gICAgICB9XG4gICAgfSB3aGlsZSAobm9kZXMubGVuZ3RoID4gMCk7XG4gIH1cbiAgbWF0Y2hPYmplY3QgKG9iaiwgcXVlcnlUb2tlbnMpIHtcbiAgICAvLyBUT0RPXG4gIH1cbiAgc2VsZWN0QWxsIChyb290LCBzZWxlY3Rvcikge1xuICAgIGNvbnN0IHF1ZXJ5VG9rZW5zID0gdGhpcy5zZWxlY3RvclBhcnNlci5wYXJzZShzZWxlY3Rvcik7XG4gICAgY29uc3QgZWxlbWVudHMgPSBbXTtcbiAgICB0aGlzLml0ZXJhdGUocm9vdCwgb2JqID0+IHtcbiAgICAgIGlmICh0aGlzLm1hdGNoT2JqZWN0KG9iaiwgcXVlcnlUb2tlbnMpKSB7XG4gICAgICAgIGVsZW1lbnRzLnB1c2gob2JqKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZWxlbWVudHM7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IERvY0hhbmRsZXIoKTtcbiIsImltcG9ydCB7IE1vZGVsIH0gZnJvbSAndWtpJztcbmltcG9ydCBkb2NIIGZyb20gJy4uL0RvY0hhbmRsZXIvaW5kZXguanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoUG91Y2hEQiwgZDMsIGQzbikge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLlBvdWNoREIgPSBQb3VjaERCOyAvLyBmb3IgTm9kZS5qcywgdGhpcyB3aWxsIGJlIHBvdWNoZGItbm9kZSwgbm90IHRoZSByZWd1bGFyIG9uZVxuICAgIHRoaXMuZDMgPSBkMzsgLy8gZm9yIE5vZGUuanMsIHRoaXMgd2lsbCBiZSBmcm9tIGQzLW5vZGUsIG5vdCB0aGUgcmVndWxhciBvbmVcbiAgICB0aGlzLmQzbiA9IGQzbjsgLy8gaW4gTm9kZSwgd2UgYWxzbyBuZWVkIGFjY2VzcyB0byB0aGUgaGlnaGVyLWxldmVsIHN0dWZmIGZyb20gZDMtbm9kZVxuXG4gICAgLy8gRW51bWVyYXRpb25zLi4uXG4gICAgdGhpcy5DT05URU5UX0ZPUk1BVFMgPSB7XG4gICAgICBleGNsdWRlOiAwLFxuICAgICAgYmxvYjogMSxcbiAgICAgIGRvbTogMixcbiAgICAgIGJhc2U2NDogM1xuICAgIH07XG5cbiAgICAvLyBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3Igb3VyIGN1c3RvbSBYTUxcbiAgICB0aGlzLk5TU3RyaW5nID0gJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJztcbiAgICB0aGlzLmQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBDcmVhdGUgLyBsb2FkIHRoZSBsb2NhbCBkYXRhYmFzZSBvZiBmaWxlc1xuICAgIHRoaXMuZGIgPSBuZXcgdGhpcy5Qb3VjaERCKCdtdXJlJyk7XG5cbiAgICAvLyBkZWZhdWx0IGVycm9yIGhhbmRsaW5nIChhcHBzIGNhbiBsaXN0ZW4gZm9yIC8gZGlzcGxheSBlcnJvciBtZXNzYWdlcyBpbiBhZGRpdGlvbiB0byB0aGlzKTpcbiAgICB0aGlzLm9uKCdlcnJvcicsIGVycm9yTWVzc2FnZSA9PiB7XG4gICAgICBjb25zb2xlLndhcm4oZXJyb3JNZXNzYWdlKTtcbiAgICB9KTtcbiAgICB0aGlzLmNhdGNoRGJFcnJvciA9IGVycm9yT2JqID0+IHtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCAnVW5leHBlY3RlZCBlcnJvciByZWFkaW5nIFBvdWNoREI6ICcgKyBlcnJvck9iai5tZXNzYWdlICsgJ1xcbicgKyBlcnJvck9iai5zdGFjayk7XG4gICAgfTtcblxuICAgIC8vIGluIHRoZSBhYnNlbmNlIG9mIGEgY3VzdG9tIGRpYWxvZ3MsIGp1c3QgdXNlIHdpbmRvdy5hbGVydCwgd2luZG93LmNvbmZpcm0gYW5kIHdpbmRvdy5wcm9tcHQ6XG4gICAgdGhpcy5hbGVydCA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB3aW5kb3cuYWxlcnQobWVzc2FnZSk7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMuY29uZmlybSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy5wcm9tcHQgPSAobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHdpbmRvdy5wcm9tcHQobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9XG4gIGN1c3RvbWl6ZUFsZXJ0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmFsZXJ0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZUNvbmZpcm1EaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuY29uZmlybSA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVQcm9tcHREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMucHJvbXB0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIG9wZW5BcHAgKGFwcE5hbWUsIG5ld1RhYikge1xuICAgIGlmIChuZXdUYWIpIHtcbiAgICAgIHdpbmRvdy5vcGVuKCcvJyArIGFwcE5hbWUsICdfYmxhbmsnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lID0gJy8nICsgYXBwTmFtZTtcbiAgICB9XG4gIH1cbiAgZ2V0T3JJbml0RGIgKCkge1xuICAgIGxldCBkYiA9IG5ldyB0aGlzLlBvdWNoREIoJ211cmUnKTtcbiAgICBsZXQgY291Y2hEYlVybCA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY291Y2hEYlVybCcpO1xuICAgIGlmIChjb3VjaERiVXJsKSB7XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgY291Y2hEYiA9IG5ldyB0aGlzLlBvdWNoREIoY291Y2hEYlVybCwge3NraXBfc2V0dXA6IHRydWV9KTtcbiAgICAgICAgcmV0dXJuIGRiLnN5bmMoY291Y2hEYiwge2xpdmU6IHRydWUsIHJldHJ5OiB0cnVlfSk7XG4gICAgICB9KSgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRoaXMuYWxlcnQoJ0Vycm9yIHN5bmNpbmcgd2l0aCAnICsgY291Y2hEYlVybCArICc6ICcgK1xuICAgICAgICAgIGVyci5tZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZGI7XG4gIH1cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBhcm91bmQgUG91Y2hEQi5nZXQoKSB0aGF0IGVuc3VyZXMgdGhhdCB0aGUgcmV0dXJuZWQgZG9jdW1lbnRcbiAgICogZXhpc3RzICh1c2VzIGRlZmF1bHQudGV4dC5zdmcgd2hlbiBpdCBkb2Vzbid0KSwgYW5kIGhhcyBhdCBsZWFzdCB0aGVcbiAgICogZWxlbWVudHMgc3BlY2lmaWVkIGJ5IG1pbmltdW0udGV4dC5zdmdcbiAgICogQHJldHVybiB7b2JqZWN0fSBBIFBvdWNoREIgZG9jdW1lbnRcbiAgICovXG4gIGdldFN0YW5kYXJkaXplZERvYyAoZG9jSWQpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoZG9jSWQpXG4gICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5uYW1lID09PSAnbm90X2ZvdW5kJykge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBfaWQ6IGRvY0lkLFxuICAgICAgICAgICAgY3VycmVudFNlbGVjdGlvbjogbnVsbCxcbiAgICAgICAgICAgIGNvbnRlbnRzOiBKU09OLnBhcnNlKGRvY0guZGVmYXVsdEpzb25Eb2MpXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pLnRoZW4oZG9jID0+IHtcbiAgICAgICAgcmV0dXJuIGRvY0guc3RhbmRhcmRpemUoZG9jKTtcbiAgICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWREb2MgKGRvY0lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuZ2V0KGRvY0lkKVxuICAgICAgLnRoZW4oZG9jID0+IHtcbiAgICAgICAgbGV0IHhtbFRleHQgPSBkb2NILmpzMnhtbChkb2MuY29udGVudHMpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIGZha2UgbGluayB0byBpbml0aWF0ZSB0aGUgZG93bmxvYWRcbiAgICAgICAgbGV0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICAgICAgbGV0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyB3aW5kb3cuQmxvYihbeG1sVGV4dF0sIHsgdHlwZTogJ2ltYWdlL3N2Zyt4bWwnIH0pKTtcbiAgICAgICAgYS5ocmVmID0gdXJsO1xuICAgICAgICBhLmRvd25sb2FkID0gZG9jLl9pZDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICAgICAgYS5jbGljaygpO1xuICAgICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgICAgICBhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSk7XG4gICAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlL2luZGV4LmpzJztcbmltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGInO1xuaW1wb3J0IFBvdWNoQXV0aGVudGljYXRpb24gZnJvbSAncG91Y2hkYi1hdXRoZW50aWNhdGlvbic7XG5Qb3VjaERCLnBsdWdpbihQb3VjaEF1dGhlbnRpY2F0aW9uKTtcblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11cmUoUG91Y2hEQiwgZDMpO1xuIl0sIm5hbWVzIjpbImRlZmF1bHRTdmdEb2MiLCJkZWZhdWx0U3ZnRG9jVGVtcGxhdGUiLCJyZXBsYWNlIiwibXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IiwiRG9jSGFuZGxlciIsInNlbGVjdG9yUGFyc2VyIiwiY3JlYXRlUGFyc2VyIiwia2V5TmFtZXMiLCJqc29uMnhtbFNldHRpbmdzIiwiT2JqZWN0IiwiYXNzaWduIiwieG1sMmpzb25TZXR0aW5ncyIsImRlZmF1bHRKc29uRG9jIiwieG1sMmpzb24iLCJtaW5pbXVtSnNEb2MiLCJ4bWwyanMiLCJtaW5pbXVtU3ZnRG9jIiwidGV4dCIsInhtbEpzIiwianNvbjJ4bWwiLCJqczJ4bWwiLCJ0ZXN0T2JqIiwic3RhbmRhcmRPYmoiLCJfaWQiLCJFcnJvciIsImN1cnJlbnRTZWxlY3Rpb24iLCJjb250ZW50cyIsInN0YW5kYXJkaXplIiwib2JqIiwiY2FsbGJhY2siLCJub2RlcyIsInB1c2giLCJzaGlmdCIsImVsZW1lbnRzIiwidW5zaGlmdCIsImxlbmd0aCIsInF1ZXJ5VG9rZW5zIiwicm9vdCIsInNlbGVjdG9yIiwicGFyc2UiLCJpdGVyYXRlIiwibWF0Y2hPYmplY3QiLCJNdXJlIiwiUG91Y2hEQiIsImQzIiwiZDNuIiwiQ09OVEVOVF9GT1JNQVRTIiwiTlNTdHJpbmciLCJuYW1lc3BhY2VzIiwibXVyZSIsImRiIiwib24iLCJ3YXJuIiwiZXJyb3JNZXNzYWdlIiwiY2F0Y2hEYkVycm9yIiwidHJpZ2dlciIsImVycm9yT2JqIiwibWVzc2FnZSIsInN0YWNrIiwiYWxlcnQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvbmZpcm0iLCJ3aW5kb3ciLCJwcm9tcHQiLCJkZWZhdWx0VmFsdWUiLCJzaG93RGlhbG9nRnVuY3Rpb24iLCJhcHBOYW1lIiwibmV3VGFiIiwib3BlbiIsImxvY2F0aW9uIiwicGF0aG5hbWUiLCJjb3VjaERiVXJsIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsInNraXBfc2V0dXAiLCJzeW5jIiwiY291Y2hEYiIsImxpdmUiLCJyZXRyeSIsImNhdGNoIiwiZXJyIiwiZG9jSWQiLCJnZXQiLCJuYW1lIiwiSlNPTiIsImRvY0giLCJ0aGVuIiwiZG9jIiwieG1sVGV4dCIsImEiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsInVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIkJsb2IiLCJ0eXBlIiwiaHJlZiIsImRvd25sb2FkIiwiYm9keSIsImFwcGVuZENoaWxkIiwiY2xpY2siLCJyZXZva2VPYmplY3RVUkwiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJNb2RlbCIsInBsdWdpbiIsIlBvdWNoQXV0aGVudGljYXRpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFNQTtBQUNBLElBQU1BLGdCQUFnQkMsc0JBQXNCQyxPQUF0QixD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
