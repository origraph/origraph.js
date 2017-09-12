(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('babel-polyfill'), require('d3'), require('datalib'), require('jsonpath'), require('pouchdb'), require('uki')) :
	typeof define === 'function' && define.amd ? define(['babel-polyfill', 'd3', 'datalib', 'jsonpath', 'pouchdb', 'uki'], factory) :
	(global.mure = factory(null,global.d3,global.datalib,global.jsonpath,global.PouchDB,global.uki));
}(this, (function (babelPolyfill,d3,datalib,jsonpath,PouchDB,uki) { 'use strict';

datalib = datalib && datalib.hasOwnProperty('default') ? datalib['default'] : datalib;
PouchDB = PouchDB && PouchDB.hasOwnProperty('default') ? PouchDB['default'] : PouchDB;

var docs = { "name": "docs", "description": "The core app / landing page for Mure", "author": "Alex Bigelow", "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjAuMiwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDJ7b3BhY2l0eTowLjQ1O2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDN7b3BhY2l0eTowLjU1O2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDR7b3BhY2l0eTowLjI7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0NXtmaWxsOiM3NTcwQjM7fQo8L3N0eWxlPgo8cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjMzOS4zLDQwNy4zIDI1Niw1MDYgMTcyLjcsNDA3LjMgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDEiIHBvaW50cz0iMjE0LjEsMzcyLjIgMjk3LjUsMjczLjUgMzgwLjgsMzcyLjIgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDIiIHBvaW50cz0iNTA2LDI3My41IDQyMi43LDM3Mi4yIDMzOS4zLDI3My41ICIvPgo8cG9seWdvbiBjbGFzcz0ic3QzIiBwb2ludHM9IjI1NiwyMzguNSAzMzkuMywxMzkuOCA0MjIuNywyMzguNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MiIgcG9pbnRzPSIyNTYsMjczLjUgMTcyLjcsMzcyLjIgODkuMywyNzMuNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI2LDIzOC41IDg5LjMsMTM5LjggMTcyLjcsMjM4LjUgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDQiIHBvaW50cz0iMjk3LjUsMTM5LjggMjE0LjEsMjM4LjUgMTMwLjgsMTM5LjggIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDUiIHBvaW50cz0iMTcyLjcsMTA0LjcgMjU2LDYgMzM5LjMsMTA0LjcgIi8+Cjwvc3ZnPgo=" };
var appList = {
	docs: docs,
	"data-binder": { "name": "data-binder", "description": "A Mure app that is responsible for (re)binding data to graphics", "author": "Alex Bigelow", "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjEuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe29wYWNpdHk6MC42O2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6I0U2QUIwMjt9Cgkuc3Qye29wYWNpdHk6MC42O2ZpbGw6Izc1NzBCMzt9Cgkuc3Qze2ZpbGw6Izc1NzBCMzt9Cgkuc3Q0e29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMzt9Cgkuc3Q1e2ZpbGw6I0U2QUIwMjt9Cjwvc3R5bGU+CjxnPgoJPHBhdGggY2xhc3M9InN0MCIgZD0iTTExOS43LDI2Ny43di0yMy40YzU5LjYsMCw3Ny4zLTE5LjcsODMuMi0yNi4xYzE0LjEtMTUuNywxOS0zNy40LDI0LjItNjAuNGM1LjQtMjQsMTEtNDguOSwyNy45LTY4LjMKCQlDMjc0LjEsNjcuNiwzMDQuNiw1NywzNDguMyw1N3YyMy40Yy0zNi41LDAtNjEuMyw4LTc1LjgsMjQuNWMtMTMsMTQuOS0xNy43LDM1LjgtMjIuNyw1OGMtNS42LDI0LjktMTEuNCw1MC42LTI5LjYsNzAuOQoJCUMxOTkuNywyNTYuNiwxNjYuOCwyNjcuNywxMTkuNywyNjcuN3oiLz4KCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0xMTkuNyw0NTV2LTIzLjRjMzQuNCwwLDk0LjMtNDAuMiwxNjQuNC0xMTAuM2wxNi42LDE2LjZDMjQ3LjEsMzkxLjMsMTcyLjQsNDU1LDExOS43LDQ1NXoiLz4KCTxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik03LjUsMjk5LjVjMzIuNy0yNi43LDU2LjYtNDcuMiw1Ni42LTYzLjhjMC0xMS03LTE2LjItMTcuOC0xNi4yYy05LjEsMC0xNi4yLDUuOC0yMi44LDExLjZMNiwyMTMuMwoJCWMxMy4zLTEzLjUsMjUuNy0xOS43LDQ1LTE5LjdjMjYuMywwLDQ0LjcsMTUuOSw0NC43LDQwLjJjMCwxOS43LTIwLjUsNDEuNC00MC42LDU4LjRjNi44LTAuOCwxNi0xLjUsMjItMS41aDI0Ljd2MjcuOEg3LjVWMjk5LjV6IgoJCS8+Cgk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNOC4yLDEwMy45SDM5VjM5LjNIMTMuNFYxOC41YzE1LTIuOCwyNC44LTYuMywzNC43LTEyLjJoMjQuOHY5Ny43aDI2Ljh2MjcuMkg4LjJWMTAzLjl6Ii8+Cgk8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNi41LDQ4OC43bDE0LjgtMjAuNWM4LDYuOCwxOC4yLDExLjQsMjcuMywxMS40YzExLjgsMCwyMC4xLTMuOCwyMC4xLTExLjRjMC05LjEtNi42LTE0LjQtMzMuNC0xNC40VjQzMQoJCWMyMS42LDAsMjkuNi01LjMsMjkuNi0xMy43YzAtNy4yLTUuNy0xMS0xNS4yLTExYy04LjcsMC0xNS42LDMuNC0yMy45LDkuOUw5LjUsMzk2LjRjMTIuMy05LjksMjYuMi0xNS42LDQxLjgtMTUuNgoJCWMyNy43LDAsNDYuMywxMi4xLDQ2LjMsMzRjMCwxMS42LTcuOCwyMC4zLTIyLDI2djAuOGMxNC44LDQuMiwyNS44LDEzLjcsMjUuOCwyOC44YzAsMjIuOC0yMy4zLDM1LjMtNDkuMywzNS4zCgkJQzMxLjUsNTA1LjgsMTYsNDk5LjMsNi41LDQ4OC43eiIvPgoJPHJlY3QgeD0iMzA1LjQiIHk9IjE5MS42IiBjbGFzcz0ic3Q0IiB3aWR0aD0iMTI0LjkiIGhlaWdodD0iMTI0LjkiLz4KCTxjaXJjbGUgY2xhc3M9InN0MiIgY3g9IjQzNy43IiBjeT0iNzQuNSIgcj0iNjguMyIvPgoJPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI0MjcuMSwzNjkuMiAzNDguMyw1MDUuOCA1MDYsNTA1LjggCSIvPgoJPHBhdGggY2xhc3M9InN0NSIgZD0iTTM1My45LDQ0OS4yYy0zNC42LDAtNjUtNC41LTkwLjMtMTMuM2MtMjMuOC04LjMtNDMuOS0yMC43LTU5LjgtMzYuOGMtNTMtNTMuNy01MS44LTE0MC01MC45LTIwOS4zCgkJYzAuNi00NC44LDEuMi04Ny4yLTE0LTEwMi41Yy00LjYtNC43LTEwLjctNi44LTE5LjItNi44VjU3YzE0LjgsMCwyNi45LDQuNiwzNS45LDEzLjhjMjIsMjIuMywyMS40LDY3LjMsMjAuNywxMTkuMwoJCWMtMC45LDY4LjMtMiwxNDUuNyw0NC4yLDE5Mi41YzI4LjcsMjkuMSw3Mi4zLDQzLjIsMTMzLjUsNDMuMlY0NDkuMnoiLz4KPC9nPgo8L3N2Zz4K" }
};

// There isn't an easy way to import this file as raw text using only ES6,
// so it's just simpler to comment the first and last lines when editing.

var mureInteractivityRunnerText = "\n/* globals XMLHttpRequest, ActiveXObject */\n/* eslint no-eval: 0 */\n/* exported mureInteractivity */\nvar mureInteractivity = {\n  getData: function () {\n    return 'TODO';\n  }\n};\n\n(function () {\n  function load (url, callback) {\n    let xhr;\n    if (typeof XMLHttpRequest !== 'undefined') {\n      xhr = new XMLHttpRequest();\n    } else {\n      let versions = [\n        'MSXML2.XmlHttp.5.0',\n        'MSXML2.XmlHttp.4.0',\n        'MSXML2.XmlHttp.3.0',\n        'MSXML2.XmlHttp.2.0',\n        'Microsoft.XmlHttp'\n      ];\n      for (let i = 0, len = versions.length; i < len; i++) {\n        try {\n          xhr = new ActiveXObject(versions[i]);\n          break;\n        } catch (e) {}\n      }\n    }\n\n    xhr.onreadystatechange = ensureReadiness;\n\n    function ensureReadiness () {\n      if (xhr.readyState < 4) {\n        return;\n      }\n\n      if (xhr.status !== 200) {\n        return;\n      }\n\n      // all is well\n      if (xhr.readyState === 4) {\n        callback(xhr.responseText);\n      }\n    }\n\n    xhr.open('GET', url, true);\n    xhr.send('');\n  }\n\n  function loadUserLibraries (callback) {\n    // Grab all the mure:library tags, and load the referenced library (script src attributes\n    // in SVG don't work, so we have to manually load remote libraries)\n    let libraries = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'library'))\n      .map(libraryTag => libraryTag.getAttribute('src'));\n\n    let loadedLibraries = {};\n    let onloadFired = false;\n\n    libraries.forEach(function (script) {\n      load(script, function (scriptText) {\n        window.eval(scriptText);\n        loadedLibraries[script] = true;\n        attemptStart();\n      });\n    });\n\n    window.onload = function () {\n      onloadFired = true;\n      attemptStart();\n    };\n\n    function attemptStart () {\n      if (!onloadFired) {\n        return;\n      }\n      let allLoaded = libraries.every(script => {\n        return loadedLibraries[script];\n      });\n      if (allLoaded) {\n        callback();\n      }\n    }\n  }\n\n  function runUserScripts () {\n    Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'script'))\n      .forEach(scriptTag => window.eval(scriptTag.textContent));\n  }\n\n  // Where we actually start executing stuff:\n  if (!window.frameElement ||\n      !window.frameElement.__suppressInteractivity__) {\n    // We've been loaded directly into a browser, or embedded in a normal page;\n    // load all the libraries, and then run all the scripts\n    loadUserLibraries(runUserScripts);\n  }\n})();\n";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};





var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();



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







var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

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





var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

/* eslint no-useless-escape: 0 */
var Mure = function (_Model) {
  inherits(Mure, _Model);

  function Mure() {
    classCallCheck(this, Mure);

    var _this = possibleConstructorReturn(this, (Mure.__proto__ || Object.getPrototypeOf(Mure)).call(this));

    _this.appList = appList;
    // Check if we're even being used in the browser (mostly useful for getting
    // access to the applist in all-apps-dev-server.js)
    if (typeof document === 'undefined' || (typeof window === 'undefined' ? 'undefined' : _typeof(window)) === undefined) {
      return possibleConstructorReturn(_this);
    }

    // The namespace string for our custom XML
    _this.NSString = 'http://mure-apps.github.io';
    d3.namespaces.mure = _this.NSString;

    // Funky stuff to figure out if we're debugging (if that's the case, we want to use
    // localhost instead of the github link for all links)
    var windowTitle = document.getElementsByTagName('title')[0];
    windowTitle = windowTitle ? windowTitle.textContent : '';
    _this.debugMode = window.location.hostname === 'localhost' && windowTitle.startsWith('Mure');

    // Figure out which app we are (or null if the mure library is being used somewhere else)
    _this.currentApp = window.location.pathname.replace(/\//g, '');
    if (!_this.appList[_this.currentApp]) {
      _this.currentApp = null;
    }

    // Create / load the local database of files
    _this.lastFile = null;
    _this.db = _this.getOrInitDb();

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
    key: 'getOrInitDb',
    value: function getOrInitDb() {
      var _this2 = this;

      var db = new PouchDB('mure');
      db.get('userPrefs').then(function (prefs) {
        _this2.lastFile = prefs.currentFile;
      }).catch(function (errorObj) {
        if (errorObj.message === 'missing') {
          return db.put({
            _id: 'userPrefs',
            currentFile: null
          });
        } else {
          _this2.catchDbError(errorObj);
        }
      });

      db.changes({
        since: 'now',
        live: true,
        include_docs: true
      }).on('change', function (change) {
        if (change.id === 'userPrefs') {
          if (_this2.lastFile !== change.doc.currentFile) {
            // Different filename... a new one was opened, or the current file was deleted
            _this2.lastFile = change.doc.currentFile;
            // This will have changed the current file list
            asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
              var fileList;
              return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      _context.next = 2;
                      return _this2.getFileList();

                    case 2:
                      fileList = _context.sent;

                      _this2.trigger('fileListChange', fileList);

                    case 4:
                    case 'end':
                      return _context.stop();
                  }
                }
              }, _callee, _this2);
            }))().catch(_this2.catchDbError);
          }
          // Whether we have a new file, or the current one was updated, fire a fileChange event
          asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
            var currentFile;
            return regeneratorRuntime.wrap(function _callee2$(_context2) {
              while (1) {
                switch (_context2.prev = _context2.next) {
                  case 0:
                    _context2.next = 2;
                    return _this2.getFile(change.doc.currentFile);

                  case 2:
                    currentFile = _context2.sent;

                    _this2.trigger('fileChange', currentFile);

                  case 4:
                  case 'end':
                    return _context2.stop();
                }
              }
            }, _callee2, _this2);
          }))().catch(_this2.catchDbError);
        } else if (change.deleted && change.id !== _this2.lastFile) {
          // If a file is deleted that wasn't opened, it won't ever cause a change
          // to userPrefs. So we need to fire fileListChange immediately.
          asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
            var fileList;
            return regeneratorRuntime.wrap(function _callee3$(_context3) {
              while (1) {
                switch (_context3.prev = _context3.next) {
                  case 0:
                    _context3.next = 2;
                    return _this2.getFileList();

                  case 2:
                    fileList = _context3.sent;

                    _this2.trigger('fileListChange', fileList);

                  case 4:
                  case 'end':
                    return _context3.stop();
                }
              }
            }, _callee3, _this2);
          }))().catch(_this2.catchDbError);
        } else {
          // The current file was changed in some way (without changing the file name)
          _this2.trigger('fileSave');
        }
      }).on('error', function (errorObj) {
        _this2.catchDbError(errorObj);
      });
      return db;
    }
  }, {
    key: 'setCurrentFile',
    value: function () {
      var _ref4 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(filename) {
        var _this3 = this;

        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                return _context4.abrupt('return', this.db.get('userPrefs').then(function (prefs) {
                  prefs.currentFile = filename;
                  return _this3.db.put(prefs);
                }).catch(this.catchDbError));

              case 1:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function setCurrentFile(_x) {
        return _ref4.apply(this, arguments);
      }

      return setCurrentFile;
    }()
  }, {
    key: 'getCurrentFilename',
    value: function () {
      var _ref5 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt('return', this.db.get('userPrefs').then(function (prefs) {
                  return prefs.currentFile;
                }));

              case 1:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function getCurrentFilename() {
        return _ref5.apply(this, arguments);
      }

      return getCurrentFilename;
    }()
  }, {
    key: 'getFile',
    value: function () {
      var _ref6 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(filename, includeData) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                if (filename) {
                  _context6.next = 4;
                  break;
                }

                _context6.next = 3;
                return this.getCurrentFilename();

              case 3:
                filename = _context6.sent;

              case 4:
                if (!(filename !== null)) {
                  _context6.next = 8;
                  break;
                }

                return _context6.abrupt('return', this.db.get(filename, { attachments: !!includeData }).then(function (dbEntry) {
                  var mureFile = {
                    filename: filename,
                    metadata: dbEntry.metadata,
                    _rev: dbEntry._rev
                  };
                  if (dbEntry._attachments[filename].data) {
                    mureFile.base64string = dbEntry._attachments[filename].data;
                  }
                  return mureFile;
                }).catch(this.catchDbError));

              case 8:
                return _context6.abrupt('return', Promise.resolve(null));

              case 9:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function getFile(_x2, _x3) {
        return _ref6.apply(this, arguments);
      }

      return getFile;
    }()
  }, {
    key: 'getMetadata',
    value: function () {
      var _ref7 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(filename) {
        var currentFile;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.getFile(filename);

              case 2:
                currentFile = _context7.sent;
                return _context7.abrupt('return', currentFile !== null ? currentFile.metadata : null);

              case 4:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function getMetadata(_x4) {
        return _ref7.apply(this, arguments);
      }

      return getMetadata;
    }()
  }, {
    key: 'getFileAsBlob',
    value: function () {
      var _ref8 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(filename) {
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                if (filename) {
                  _context8.next = 4;
                  break;
                }

                _context8.next = 3;
                return this.getCurrentFilename();

              case 3:
                filename = _context8.sent;

              case 4:
                if (!(filename !== null)) {
                  _context8.next = 8;
                  break;
                }

                return _context8.abrupt('return', this.db.getAttachment(filename, filename).catch(this.catchDbError));

              case 8:
                return _context8.abrupt('return', Promise.resolve(null));

              case 9:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function getFileAsBlob(_x5) {
        return _ref8.apply(this, arguments);
      }

      return getFileAsBlob;
    }()
  }, {
    key: 'getFileAsDOM',
    value: function () {
      var _ref9 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9(filename) {
        var mureFile, xmlText;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return this.getFile(filename, true);

              case 2:
                mureFile = _context9.sent;

                if (!(mureFile !== null)) {
                  _context9.next = 8;
                  break;
                }

                xmlText = window.atob(mureFile.base64string);
                return _context9.abrupt('return', new Promise(function (resolve, reject) {
                  resolve(new window.DOMParser().parseFromString(xmlText, 'image/svg+xml'));
                }));

              case 8:
                return _context9.abrupt('return', Promise.resolve(null));

              case 9:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function getFileAsDOM(_x6) {
        return _ref9.apply(this, arguments);
      }

      return getFileAsDOM;
    }()
  }, {
    key: 'on',
    value: function on(eventName, callback) {
      if (!Mure.VALID_EVENTS[eventName]) {
        throw new Error('Unknown event name: ' + eventName);
      } else {
        get(Mure.prototype.__proto__ || Object.getPrototypeOf(Mure.prototype), 'on', this).call(this, eventName, callback);
      }
    }
  }, {
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
    key: 'saveFile',
    value: function () {
      var _ref10 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10(options) {
        var existingDoc, userConfirmation, newDoc;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _context10.prev = 0;
                existingDoc = void 0;

                if (options.filename) {
                  _context10.next = 6;
                  break;
                }

                _context10.next = 5;
                return this.getCurrentFilename();

              case 5:
                options.filename = _context10.sent;

              case 6:
                if (options.blobOrBase64string) {
                  _context10.next = 12;
                  break;
                }

                _context10.next = 9;
                return this.db.get(options.filename);

              case 9:
                existingDoc = _context10.sent;
                _context10.next = 21;
                break;

              case 12:
                _context10.next = 14;
                return this.db.get(options.filename, { attachments: true });

              case 14:
                existingDoc = _context10.sent;

                existingDoc._attachments[options.filename].data = options.blobOrBase64string;

                if (!((!options.metadata || Object.keys(options.metadata).length === 0) && Object.keys(existingDoc.metadata) > 0)) {
                  _context10.next = 21;
                  break;
                }

                _context10.next = 19;
                return this.confirm('It appears that the file you\'re uploading has lost its Mure metadata. ' + 'This is fairly common when you\'ve edited it with an external program.\n\n' + 'Restore the most recent metadata?');

              case 19:
                userConfirmation = _context10.sent;

                if (!userConfirmation) {
                  existingDoc.metadata = {};
                }

              case 21:
                if (options.metadata) {
                  existingDoc.metadata = options.metadata;
                }
                _context10.next = 24;
                return this.db.put(existingDoc);

              case 24:
                return _context10.abrupt('return', _context10.sent);

              case 27:
                _context10.prev = 27;
                _context10.t0 = _context10['catch'](0);

                if (!(_context10.t0.message === 'missing')) {
                  _context10.next = 38;
                  break;
                }

                // The file doesn't exist yet...
                newDoc = {
                  _id: options.filename,
                  _attachments: {},
                  metadata: options.metadata || {}
                };

                if (!options.blobOrBase64string) {
                  this.trigger('error', 'Attempted to save a file without contents!');
                }
                newDoc._attachments[options.filename] = {
                  content_type: 'image/svg+xml',
                  data: options.blobOrBase64string
                };
                _context10.next = 35;
                return this.db.put(newDoc);

              case 35:
                return _context10.abrupt('return', _context10.sent);

              case 38:
                this.catchDbError(_context10.t0);
                return _context10.abrupt('return', Promise.reject(_context10.t0));

              case 40:
              case 'end':
                return _context10.stop();
            }
          }
        }, _callee10, this, [[0, 27]]);
      }));

      function saveFile(_x7) {
        return _ref10.apply(this, arguments);
      }

      return saveFile;
    }()
  }, {
    key: 'getFileList',
    value: function () {
      var _ref11 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11() {
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                return _context11.abrupt('return', this.db.allDocs().then(function (response) {
                  var result = [];
                  response.rows.forEach(function (d) {
                    if (d.id !== 'userPrefs') {
                      result.push(d.id);
                    }
                  });
                  return result;
                }).catch(this.catchDbError));

              case 1:
              case 'end':
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function getFileList() {
        return _ref11.apply(this, arguments);
      }

      return getFileList;
    }()
  }, {
    key: 'getFileRevisions',
    value: function () {
      var _ref12 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12() {
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                return _context12.abrupt('return', this.db.allDocs().then(function (response) {
                  var result = {};
                  response.rows.forEach(function (d) {
                    if (d.id !== 'userPrefs') {
                      result[d.id] = d.value.rev;
                    }
                  });
                  return result;
                }).catch(this.catchDbError));

              case 1:
              case 'end':
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function getFileRevisions() {
        return _ref12.apply(this, arguments);
      }

      return getFileRevisions;
    }()
  }, {
    key: 'readFile',
    value: function () {
      var _ref13 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee13(reader, fileObj) {
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                return _context13.abrupt('return', new Promise(function (resolve, reject) {
                  reader.onloadend = function (xmlText) {
                    resolve(xmlText.target.result);
                  };
                  reader.onerror = function (error) {
                    reject(error);
                  };
                  reader.onabort = function () {
                    reject(Mure.SIGNALS.cancelled);
                  };
                  reader.readAsText(fileObj);
                }));

              case 1:
              case 'end':
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function readFile(_x8, _x9) {
        return _ref13.apply(this, arguments);
      }

      return readFile;
    }()
  }, {
    key: 'validateFileName',
    value: function () {
      var _ref14 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee14(originalName, takenNames, abortFunction) {
        var filename, _filename;

        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                // Ask multiple times if the user happens to enter another filename that already exists
                filename = originalName;

              case 1:
                if (!takenNames[filename]) {
                  _context14.next = 20;
                  break;
                }

                _context14.next = 4;
                return this.prompt(_filename + ' already exists. Pick a new name, or leave it the same to overwrite:', _filename);

              case 4:
                _filename = _context14.sent;

                if (!(_filename === null)) {
                  _context14.next = 10;
                  break;
                }

                if (abortFunction) {
                  abortFunction();
                }
                return _context14.abrupt('return', Promise.reject(Mure.SIGNALS.cancelled));

              case 10:
                if (!(_filename === '')) {
                  _context14.next = 16;
                  break;
                }

                _context14.next = 13;
                return this.prompt('You must enter a file name (or hit cancel to cancel the upload)');

              case 13:
                _filename = _context14.sent;
                _context14.next = 18;
                break;

              case 16:
                if (!(_filename === originalName)) {
                  _context14.next = 18;
                  break;
                }

                return _context14.abrupt('return', _filename);

              case 18:
                _context14.next = 1;
                break;

              case 20:
                return _context14.abrupt('return', filename);

              case 21:
              case 'end':
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function validateFileName(_x10, _x11, _x12) {
        return _ref14.apply(this, arguments);
      }

      return validateFileName;
    }()
  }, {
    key: 'matchDataPaths',
    value: function matchDataPaths(path1, path2, metadata) {
      if (!metadata || !metadata.datasets || !path1 || !path2) {
        return false;
      }
      var result1 = jsonpath.query(metadata.datasets, path1);
      var result2 = jsonpath.query(metadata.datasets, path2);
      if (result1.length !== 1 || result2.length !== 1) {
        return false;
      }
      return result1[0] === result2[0];
    }
  }, {
    key: 'matchDomSelectors',
    value: function matchDomSelectors(selector1, selector2, dom) {
      if (!selector1 || !selector2) {
        return false;
      }
      var result1 = dom.querySelector(selector1);
      var result2 = dom.querySelector(selector2);
      return result1 === result2;
    }
  }, {
    key: 'inferParser',
    value: function inferParser(fileObj) {
      var ext = fileObj.type.split('/')[1];
      if (ext === 'csv') {
        return function (contents) {
          return datalib.read(contents, { type: 'csv', parse: 'auto' });
        };
      } else if (ext === 'tsv') {
        return function (contents) {
          return datalib.read(contents, { type: 'tsv', parse: 'auto' });
        };
      } else if (ext === 'dsv') {
        return function (contents) {
          return datalib.read(contents, { type: 'dsv', parse: 'auto' });
        };
      } else if (ext === 'json') {
        // TODO: attempt to auto-discover topojson or treejson?
        return function (contents) {
          return datalib.read(contents, { type: 'json', parse: 'auto' });
        };
      } else {
        return null;
      }
    }
  }, {
    key: 'uploadDataset',
    value: function () {
      var _ref15 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee15(fileObj) {
        var parser, metadata, reader, fileText, dataFileName;
        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                parser = this.inferParser(fileObj);

                if (parser) {
                  _context15.next = 4;
                  break;
                }

                this.trigger('error', 'Unknown data file type: ' + fileObj.type);
                return _context15.abrupt('return', Promise.reject());

              case 4:
                _context15.next = 6;
                return this.getMetadata();

              case 6:
                metadata = _context15.sent;

                if (!(metadata === null)) {
                  _context15.next = 10;
                  break;
                }

                this.trigger('error', 'Can\'t embed a data file without an SVG file already open');
                return _context15.abrupt('return', Promise.reject());

              case 10:
                metadata.datasets = metadata.datasets || {};

                reader = new window.FileReader();
                _context15.next = 14;
                return this.readFile(reader, fileObj);

              case 14:
                fileText = _context15.sent;
                _context15.next = 17;
                return this.validateFileName(fileObj.name, metadata.datasets, reader.abort);

              case 17:
                dataFileName = _context15.sent;


                metadata.datasets[dataFileName] = parser(fileText);
                return _context15.abrupt('return', this.saveFile({ metadata: metadata }));

              case 20:
              case 'end':
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function uploadDataset(_x13) {
        return _ref15.apply(this, arguments);
      }

      return uploadDataset;
    }()
  }, {
    key: 'uploadSvg',
    value: function () {
      var _ref16 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee16(fileObj) {
        var _this4 = this;

        var reader, contentsPromise, filenamePromise;
        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                reader = new window.FileReader();
                contentsPromise = this.readFile(reader, fileObj).then(function (xmlText) {
                  var dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
                  var contents = { metadata: _this4.extractMetadata(dom) };
                  contents.base64data = window.btoa(new window.XMLSerializer().serializeToString(dom));
                  return contents;
                });
                filenamePromise = this.getFileRevisions().catch(this.catchDbError).then(function (revisionDict) {
                  return _this4.validateFileName(fileObj.name, revisionDict, reader.abort);
                });
                return _context16.abrupt('return', Promise.all([filenamePromise, contentsPromise]).then(function (_ref17) {
                  var _ref18 = slicedToArray(_ref17, 2),
                      filename = _ref18[0],
                      contents = _ref18[1];

                  return _this4.saveFile({
                    filename: filename,
                    blobOrBase64string: contents.base64data,
                    metadata: contents.metadata
                  }).then(function () {
                    return _this4.setCurrentFile(filename);
                  });
                }).catch(function (errList) {
                  if (errList[0] === Mure.SIGNALS.cancelled && errList[1] === Mure.SIGNALS.cancelled) {
                    return; // cancelling is not a problem
                  } else {
                    return Promise.reject(errList);
                  }
                }));

              case 4:
              case 'end':
                return _context16.stop();
            }
          }
        }, _callee16, this);
      }));

      function uploadSvg(_x14) {
        return _ref16.apply(this, arguments);
      }

      return uploadSvg;
    }()
  }, {
    key: 'deleteSvg',
    value: function () {
      var _ref19 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee17(filename) {
        var _this5 = this;

        var userConfirmation;
        return regeneratorRuntime.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                _context17.next = 2;
                return this.confirm('Are you sure you want to delete ' + filename + '?');

              case 2:
                userConfirmation = _context17.sent;

                if (!userConfirmation) {
                  _context17.next = 7;
                  break;
                }

                return _context17.abrupt('return', Promise.all([this.db.get(filename), this.getCurrentFilename()]).then(function (promiseResults) {
                  var existingDoc = promiseResults[0];
                  var currentFile = promiseResults[1];
                  return _this5.db.remove(existingDoc._id, existingDoc._rev).then(function (removeResponse) {
                    if (filename === currentFile) {
                      _this5.setCurrentFile(null).catch(_this5.catchDbError);
                    }
                    return removeResponse;
                  });
                }).catch(this.catchDbError));

              case 7:
                return _context17.abrupt('return', Promise.resolve(false));

              case 8:
              case 'end':
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));

      function deleteSvg(_x15) {
        return _ref19.apply(this, arguments);
      }

      return deleteSvg;
    }()
  }, {
    key: 'extractMetadata',
    value: function extractMetadata(dom) {
      var self = this;
      var metadata = {};
      var d3dom = d3.select(dom.rootElement);

      // Extract the container for our metadata, if it exists
      var root = d3dom.select('#mure');
      if (root.size() === 0) {
        return metadata;
      }
      var nsElement = root.select('mure');
      if (nsElement.size() === 0) {
        return metadata;
      }

      // Any libraries?
      nsElement.selectAll('library').each(function (d) {
        if (!metadata.libraries) {
          metadata.libraries = [];
        }
        metadata.libraries.push(d3.select(this).attr('src'));
      });

      // Any scripts?
      nsElement.selectAll('script').each(function (d) {
        var el = d3.select(this);
        var script = {
          text: self.extractCDATA(el.text())
        };
        var id = el.attr('id');
        if (id) {
          if (id === 'mureInteractivityRunner') {
            // Don't store our interactivity runner script
            return;
          }
          script.id = id;
        }
        if (!metadata.scripts) {
          metadata.scripts = [];
        }
        metadata.scripts.push(script);
      });

      // Any datasets?
      nsElement.selectAll('datasets').each(function (d) {
        var el = d3.select(this);
        if (!metadata.datasets) {
          metadata.datasets = {};
        }
        metadata.datasets[el.attr('name')] = JSON.parse(self.extractCDATA(el.text()));
      });

      // Any data bindings?
      nsElement.selectAll('binding').each(function (d) {
        var el = d3.select(this);
        var binding = {
          id: el.attr('id'),
          dataRoot: el.attr('dataroot'),
          svgRoot: el.attr('svgroot'),
          keyFunction: JSON.parse(self.extractCDATA(el.text()))
        };

        if (!metadata.bindings) {
          metadata.bindings = {};
        }
        metadata.bindings[binding.id] = binding;
      });

      // Any encodings?
      nsElement.selectAll('encoding').each(function (d) {
        var el = d3.select(this);
        var encoding = {
          id: el.attr('id'),
          bindingId: el.attr('for'),
          spec: JSON.parse(self.extractCDATA(el.text()))
        };

        if (!metadata.encodings) {
          metadata.encodings = {};
        }
        metadata.encodings[encoding.id] = encoding;
      });

      return metadata;
    }
  }, {
    key: 'extractCDATA',
    value: function extractCDATA(str) {
      return str.replace(/(<!\[CDATA\[)/g, '').replace(/]]>/g, '');
    }
  }, {
    key: 'getEmptyBinding',
    value: function getEmptyBinding(metadata, add) {
      var id = 1;
      /* eslint-disable no-unmodified-loop-condition */
      while (metadata.bindings && metadata.bindings['Binding' + id]) {
        id++;
      }
      /* eslint-enable no-unmodified-loop-condition */
      var newBinding = {
        id: 'Binding' + id,
        svgRoot: '',
        dataRoot: '',
        keyFunction: {
          dataExpression: '(d, i) => i',
          svgExpression: '(el, i, d3el, $el) => i'
        }
      };
      if (add) {
        if (!metadata.bindings) {
          metadata.bindings = {};
        }
        metadata.bindings[newBinding.id] = newBinding;
      }
      return newBinding;
    }
  }, {
    key: 'getEmptyEncoding',
    value: function getEmptyEncoding(metadata, add) {
      var id = 1;
      /* eslint-disable no-unmodified-loop-condition */
      while (metadata.encodings && metadata.encodings['Encoding' + id]) {
        id++;
      }
      /* eslint-enable no-unmodified-loop-condition */
      var newEncoding = {
        id: 'Encoding' + id,
        bindingId: null,
        spec: {}
      };
      if (add) {
        if (!metadata.encodings) {
          metadata.encodings = {};
        }
        metadata.encodings[newEncoding.id] = newEncoding;
      }
      return newEncoding;
    }
  }, {
    key: 'embedMetadata',
    value: function embedMetadata(dom, metadata) {
      var d3dom = d3.select(dom.rootElement);

      // Top: need a metadata tag
      var root = d3dom.selectAll('#mure').data([0]);
      root.exit().remove();
      root = root.enter().append('metadata').attr('id', 'mure').merge(root);

      // Next down: a tag to define the namespace
      var nsElement = root.selectAll('mure').data([0]);
      nsElement.exit().remove();
      nsElement = nsElement.enter().append('mure').attr('xmlns', this.NSString).merge(nsElement);

      // Okay, we're in our custom namespace... let's figure out the libraries
      var libraryList = metadata.libraries || [];
      var libraries = nsElement.selectAll('library').data(libraryList);
      libraries.exit().remove();
      libraries = libraries.enter().append('library').merge(libraries);
      libraries.attr('src', function (d) {
        return d;
      });

      // Let's deal with any user scripts
      var scriptList = metadata.scripts || [];
      var scripts = nsElement.selectAll('script').data(scriptList);
      scripts.exit().remove();
      var scriptsEnter = scripts.enter().append('script');
      scripts = scriptsEnter.merge(scripts);
      scripts.attr('id', function (d) {
        return d.id || null;
      });
      scripts.each(function (d) {
        this.innerHTML = '<![CDATA[' + d.text + ']]>';
      });

      // Remove mureInteractivityRunner by default to ensure it always comes after the
      // metadata tag (of course, only bother adding it if we have any libraries or scripts)
      d3dom.select('#mureInteractivityRunner').remove();
      if (libraryList.length > 0 || scriptList.length > 0) {
        d3dom.append('script').attr('id', 'mureInteractivityRunner').attr('type', 'text/javascript').text('<![CDATA[' + mureInteractivityRunnerText + ']]');
      }

      // We always store datasets as JSON
      var datasets = nsElement.selectAll('dataset').data(d3.entries(metadata.datasets || {}));
      datasets.exit().remove();
      var datasetsEnter = datasets.enter().append('dataset');
      datasets = datasetsEnter.merge(datasets);
      datasets.attr('name', function (d) {
        return d.key;
      }).html(function (d) {
        return '<![CDATA[' + JSON.stringify(d.value) + ']]>';
      });

      // Store data bindings
      var bindings = nsElement.selectAll('binding').data(d3.values(metadata.bindings || {}));
      bindings.exit().remove();
      var bindingsEnter = bindings.enter().append('binding');
      bindings = bindingsEnter.merge(bindings);
      bindings.attr('id', function (d) {
        return d.id;
      }).attr('dataroot', function (d) {
        return d.dataRoot;
      }).attr('svgroot', function (d) {
        return d.svgRoot;
      }).html(function (d) {
        return '<![CDATA[' + JSON.stringify(d.keyFunction) + ']]>';
      });

      // Store encoding metadata
      var encodings = nsElement.selectAll('encoding').data(d3.values(metadata.encodings || {}));
      encodings.exit().remove();
      var encodingsEnter = encodings.enter().append('encoding');
      encodings = encodingsEnter.merge(encodings);
      encodings.attr('id', function (d) {
        return d.id;
      }).attr('bindingid', function (d) {
        return d.bindingId;
      }).html(function (d) {
        return '<![CDATA[' + JSON.stringify(d.spec) + ']]>';
      });
    }
  }, {
    key: 'downloadSvg',
    value: function () {
      var _ref20 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee18(filename) {
        var mureFile, xmlText, dom, a, url;
        return regeneratorRuntime.wrap(function _callee18$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                mureFile = void 0;
                _context18.prev = 1;
                _context18.next = 4;
                return this.getFile(filename, true);

              case 4:
                mureFile = _context18.sent;
                _context18.next = 11;
                break;

              case 7:
                _context18.prev = 7;
                _context18.t0 = _context18['catch'](1);

                this.catchDbError(_context18.t0);
                return _context18.abrupt('return');

              case 11:
                xmlText = window.atob(mureFile.base64string);
                dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');

                this.embedMetadata(dom, mureFile.metadata);
                xmlText = new window.XMLSerializer().serializeToString(dom);
                xmlText = xmlText.replace(/&lt;!\[CDATA\[/g, '<!\[CDATA\[').replace(/]]&gt;/g, ']]>');

                // create a fake link to initiate the download
                a = document.createElement('a');

                a.style = 'display:none';
                url = window.URL.createObjectURL(new window.Blob([xmlText], { type: 'image/svg+xml' }));

                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.parentNode.removeChild(a);

              case 25:
              case 'end':
                return _context18.stop();
            }
          }
        }, _callee18, this, [[1, 7]]);
      }));

      function downloadSvg(_x16) {
        return _ref20.apply(this, arguments);
      }

      return downloadSvg;
    }()
  }]);
  return Mure;
}(uki.Model);

Mure.VALID_EVENTS = {
  fileListChange: true,
  fileChange: true,
  fileSave: true,
  error: true
};

Mure.SIGNALS = {
  cancelled: true
};

var mure = new Mure();

return mure;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9tdXJlSW50ZXJhY3Rpdml0eVJ1bm5lci5qcyIsIi4uL3NyYy9tdXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIFRoZXJlIGlzbid0IGFuIGVhc3kgd2F5IHRvIGltcG9ydCB0aGlzIGZpbGUgYXMgcmF3IHRleHQgdXNpbmcgb25seSBFUzYsXG4vLyBzbyBpdCdzIGp1c3Qgc2ltcGxlciB0byBjb21tZW50IHRoZSBmaXJzdCBhbmQgbGFzdCBsaW5lcyB3aGVuIGVkaXRpbmcuXG5cbmV4cG9ydCBkZWZhdWx0IGBcbi8qIGdsb2JhbHMgWE1MSHR0cFJlcXVlc3QsIEFjdGl2ZVhPYmplY3QgKi9cbi8qIGVzbGludCBuby1ldmFsOiAwICovXG4vKiBleHBvcnRlZCBtdXJlSW50ZXJhY3Rpdml0eSAqL1xudmFyIG11cmVJbnRlcmFjdGl2aXR5ID0ge1xuICBnZXREYXRhOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICdUT0RPJztcbiAgfVxufTtcblxuKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gbG9hZCAodXJsLCBjYWxsYmFjaykge1xuICAgIGxldCB4aHI7XG4gICAgaWYgKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdmVyc2lvbnMgPSBbXG4gICAgICAgICdNU1hNTDIuWG1sSHR0cC41LjAnLFxuICAgICAgICAnTVNYTUwyLlhtbEh0dHAuNC4wJyxcbiAgICAgICAgJ01TWE1MMi5YbWxIdHRwLjMuMCcsXG4gICAgICAgICdNU1hNTDIuWG1sSHR0cC4yLjAnLFxuICAgICAgICAnTWljcm9zb2Z0LlhtbEh0dHAnXG4gICAgICBdO1xuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHZlcnNpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgeGhyID0gbmV3IEFjdGl2ZVhPYmplY3QodmVyc2lvbnNbaV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBlbnN1cmVSZWFkaW5lc3M7XG5cbiAgICBmdW5jdGlvbiBlbnN1cmVSZWFkaW5lc3MgKCkge1xuICAgICAgaWYgKHhoci5yZWFkeVN0YXRlIDwgNCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh4aHIuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBhbGwgaXMgd2VsbFxuICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgIGNhbGxiYWNrKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5zZW5kKCcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxvYWRVc2VyTGlicmFyaWVzIChjYWxsYmFjaykge1xuICAgIC8vIEdyYWIgYWxsIHRoZSBtdXJlOmxpYnJhcnkgdGFncywgYW5kIGxvYWQgdGhlIHJlZmVyZW5jZWQgbGlicmFyeSAoc2NyaXB0IHNyYyBhdHRyaWJ1dGVzXG4gICAgLy8gaW4gU1ZHIGRvbid0IHdvcmssIHNvIHdlIGhhdmUgdG8gbWFudWFsbHkgbG9hZCByZW1vdGUgbGlicmFyaWVzKVxuICAgIGxldCBsaWJyYXJpZXMgPSBBcnJheS5mcm9tKGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJywgJ2xpYnJhcnknKSlcbiAgICAgIC5tYXAobGlicmFyeVRhZyA9PiBsaWJyYXJ5VGFnLmdldEF0dHJpYnV0ZSgnc3JjJykpO1xuXG4gICAgbGV0IGxvYWRlZExpYnJhcmllcyA9IHt9O1xuICAgIGxldCBvbmxvYWRGaXJlZCA9IGZhbHNlO1xuXG4gICAgbGlicmFyaWVzLmZvckVhY2goZnVuY3Rpb24gKHNjcmlwdCkge1xuICAgICAgbG9hZChzY3JpcHQsIGZ1bmN0aW9uIChzY3JpcHRUZXh0KSB7XG4gICAgICAgIHdpbmRvdy5ldmFsKHNjcmlwdFRleHQpO1xuICAgICAgICBsb2FkZWRMaWJyYXJpZXNbc2NyaXB0XSA9IHRydWU7XG4gICAgICAgIGF0dGVtcHRTdGFydCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgb25sb2FkRmlyZWQgPSB0cnVlO1xuICAgICAgYXR0ZW1wdFN0YXJ0KCk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGF0dGVtcHRTdGFydCAoKSB7XG4gICAgICBpZiAoIW9ubG9hZEZpcmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGxldCBhbGxMb2FkZWQgPSBsaWJyYXJpZXMuZXZlcnkoc2NyaXB0ID0+IHtcbiAgICAgICAgcmV0dXJuIGxvYWRlZExpYnJhcmllc1tzY3JpcHRdO1xuICAgICAgfSk7XG4gICAgICBpZiAoYWxsTG9hZGVkKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcnVuVXNlclNjcmlwdHMgKCkge1xuICAgIEFycmF5LmZyb20oZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWVOUygnaHR0cDovL211cmUtYXBwcy5naXRodWIuaW8nLCAnc2NyaXB0JykpXG4gICAgICAuZm9yRWFjaChzY3JpcHRUYWcgPT4gd2luZG93LmV2YWwoc2NyaXB0VGFnLnRleHRDb250ZW50KSk7XG4gIH1cblxuICAvLyBXaGVyZSB3ZSBhY3R1YWxseSBzdGFydCBleGVjdXRpbmcgc3R1ZmY6XG4gIGlmICghd2luZG93LmZyYW1lRWxlbWVudCB8fFxuICAgICAgIXdpbmRvdy5mcmFtZUVsZW1lbnQuX19zdXBwcmVzc0ludGVyYWN0aXZpdHlfXykge1xuICAgIC8vIFdlJ3ZlIGJlZW4gbG9hZGVkIGRpcmVjdGx5IGludG8gYSBicm93c2VyLCBvciBlbWJlZGRlZCBpbiBhIG5vcm1hbCBwYWdlO1xuICAgIC8vIGxvYWQgYWxsIHRoZSBsaWJyYXJpZXMsIGFuZCB0aGVuIHJ1biBhbGwgdGhlIHNjcmlwdHNcbiAgICBsb2FkVXNlckxpYnJhcmllcyhydW5Vc2VyU2NyaXB0cyk7XG4gIH1cbn0pKCk7XG5gO1xuIiwiLyogZXNsaW50IG5vLXVzZWxlc3MtZXNjYXBlOiAwICovXG5pbXBvcnQgJ2JhYmVsLXBvbHlmaWxsJztcbmltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0ICogYXMganNvbnBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IFBvdWNoREIgZnJvbSAncG91Y2hkYic7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJ3VraSc7XG5pbXBvcnQgYXBwTGlzdCBmcm9tICcuL2FwcExpc3QuanNvbic7XG5pbXBvcnQgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IGZyb20gJy4vbXVyZUludGVyYWN0aXZpdHlSdW5uZXIuanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmFwcExpc3QgPSBhcHBMaXN0O1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGV2ZW4gYmVpbmcgdXNlZCBpbiB0aGUgYnJvd3NlciAobW9zdGx5IHVzZWZ1bCBmb3IgZ2V0dGluZ1xuICAgIC8vIGFjY2VzcyB0byB0aGUgYXBwbGlzdCBpbiBhbGwtYXBwcy1kZXYtc2VydmVyLmpzKVxuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiB3aW5kb3cgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRoZSBuYW1lc3BhY2Ugc3RyaW5nIGZvciBvdXIgY3VzdG9tIFhNTFxuICAgIHRoaXMuTlNTdHJpbmcgPSAnaHR0cDovL211cmUtYXBwcy5naXRodWIuaW8nO1xuICAgIGQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBGdW5reSBzdHVmZiB0byBmaWd1cmUgb3V0IGlmIHdlJ3JlIGRlYnVnZ2luZyAoaWYgdGhhdCdzIHRoZSBjYXNlLCB3ZSB3YW50IHRvIHVzZVxuICAgIC8vIGxvY2FsaG9zdCBpbnN0ZWFkIG9mIHRoZSBnaXRodWIgbGluayBmb3IgYWxsIGxpbmtzKVxuICAgIGxldCB3aW5kb3dUaXRsZSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0aXRsZScpWzBdO1xuICAgIHdpbmRvd1RpdGxlID0gd2luZG93VGl0bGUgPyB3aW5kb3dUaXRsZS50ZXh0Q29udGVudCA6ICcnO1xuICAgIHRoaXMuZGVidWdNb2RlID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lID09PSAnbG9jYWxob3N0JyAmJiB3aW5kb3dUaXRsZS5zdGFydHNXaXRoKCdNdXJlJyk7XG5cbiAgICAvLyBGaWd1cmUgb3V0IHdoaWNoIGFwcCB3ZSBhcmUgKG9yIG51bGwgaWYgdGhlIG11cmUgbGlicmFyeSBpcyBiZWluZyB1c2VkIHNvbWV3aGVyZSBlbHNlKVxuICAgIHRoaXMuY3VycmVudEFwcCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC8vZywgJycpO1xuICAgIGlmICghdGhpcy5hcHBMaXN0W3RoaXMuY3VycmVudEFwcF0pIHtcbiAgICAgIHRoaXMuY3VycmVudEFwcCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIC8gbG9hZCB0aGUgbG9jYWwgZGF0YWJhc2Ugb2YgZmlsZXNcbiAgICB0aGlzLmxhc3RGaWxlID0gbnVsbDtcbiAgICB0aGlzLmRiID0gdGhpcy5nZXRPckluaXREYigpO1xuXG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGluZyAoYXBwcyBjYW4gbGlzdGVuIGZvciAvIGRpc3BsYXkgZXJyb3IgbWVzc2FnZXMgaW4gYWRkaXRpb24gdG8gdGhpcyk6XG4gICAgdGhpcy5vbignZXJyb3InLCBlcnJvck1lc3NhZ2UgPT4ge1xuICAgICAgY29uc29sZS53YXJuKGVycm9yTWVzc2FnZSk7XG4gICAgfSk7XG4gICAgdGhpcy5jYXRjaERiRXJyb3IgPSBlcnJvck9iaiA9PiB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgJ1VuZXhwZWN0ZWQgZXJyb3IgcmVhZGluZyBQb3VjaERCOiAnICsgZXJyb3JPYmoubWVzc2FnZSArICdcXG4nICsgZXJyb3JPYmouc3RhY2spO1xuICAgIH07XG5cbiAgICAvLyBpbiB0aGUgYWJzZW5jZSBvZiBhIGN1c3RvbSBkaWFsb2dzLCBqdXN0IHVzZSB3aW5kb3cuYWxlcnQsIHdpbmRvdy5jb25maXJtIGFuZCB3aW5kb3cucHJvbXB0OlxuICAgIHRoaXMuYWxlcnQgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgd2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xuICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLmNvbmZpcm0gPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh3aW5kb3cuY29uZmlybShtZXNzYWdlKSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMucHJvbXB0ID0gKG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh3aW5kb3cucHJvbXB0KG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuICBnZXRPckluaXREYiAoKSB7XG4gICAgbGV0IGRiID0gbmV3IFBvdWNoREIoJ211cmUnKTtcbiAgICBkYi5nZXQoJ3VzZXJQcmVmcycpLnRoZW4ocHJlZnMgPT4ge1xuICAgICAgdGhpcy5sYXN0RmlsZSA9IHByZWZzLmN1cnJlbnRGaWxlO1xuICAgIH0pLmNhdGNoKGVycm9yT2JqID0+IHtcbiAgICAgIGlmIChlcnJvck9iai5tZXNzYWdlID09PSAnbWlzc2luZycpIHtcbiAgICAgICAgcmV0dXJuIGRiLnB1dCh7XG4gICAgICAgICAgX2lkOiAndXNlclByZWZzJyxcbiAgICAgICAgICBjdXJyZW50RmlsZTogbnVsbFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2F0Y2hEYkVycm9yKGVycm9yT2JqKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRiLmNoYW5nZXMoe1xuICAgICAgc2luY2U6ICdub3cnLFxuICAgICAgbGl2ZTogdHJ1ZSxcbiAgICAgIGluY2x1ZGVfZG9jczogdHJ1ZVxuICAgIH0pLm9uKCdjaGFuZ2UnLCBjaGFuZ2UgPT4ge1xuICAgICAgaWYgKGNoYW5nZS5pZCA9PT0gJ3VzZXJQcmVmcycpIHtcbiAgICAgICAgaWYgKHRoaXMubGFzdEZpbGUgIT09IGNoYW5nZS5kb2MuY3VycmVudEZpbGUpIHtcbiAgICAgICAgICAvLyBEaWZmZXJlbnQgZmlsZW5hbWUuLi4gYSBuZXcgb25lIHdhcyBvcGVuZWQsIG9yIHRoZSBjdXJyZW50IGZpbGUgd2FzIGRlbGV0ZWRcbiAgICAgICAgICB0aGlzLmxhc3RGaWxlID0gY2hhbmdlLmRvYy5jdXJyZW50RmlsZTtcbiAgICAgICAgICAvLyBUaGlzIHdpbGwgaGF2ZSBjaGFuZ2VkIHRoZSBjdXJyZW50IGZpbGUgbGlzdFxuICAgICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgZmlsZUxpc3QgPSBhd2FpdCB0aGlzLmdldEZpbGVMaXN0KCk7XG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2ZpbGVMaXN0Q2hhbmdlJywgZmlsZUxpc3QpO1xuICAgICAgICAgIH0pKCkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFdoZXRoZXIgd2UgaGF2ZSBhIG5ldyBmaWxlLCBvciB0aGUgY3VycmVudCBvbmUgd2FzIHVwZGF0ZWQsIGZpcmUgYSBmaWxlQ2hhbmdlIGV2ZW50XG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgbGV0IGN1cnJlbnRGaWxlID0gYXdhaXQgdGhpcy5nZXRGaWxlKGNoYW5nZS5kb2MuY3VycmVudEZpbGUpO1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUNoYW5nZScsIGN1cnJlbnRGaWxlKTtcbiAgICAgICAgfSkoKS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKGNoYW5nZS5kZWxldGVkICYmIGNoYW5nZS5pZCAhPT0gdGhpcy5sYXN0RmlsZSkge1xuICAgICAgICAvLyBJZiBhIGZpbGUgaXMgZGVsZXRlZCB0aGF0IHdhc24ndCBvcGVuZWQsIGl0IHdvbid0IGV2ZXIgY2F1c2UgYSBjaGFuZ2VcbiAgICAgICAgLy8gdG8gdXNlclByZWZzLiBTbyB3ZSBuZWVkIHRvIGZpcmUgZmlsZUxpc3RDaGFuZ2UgaW1tZWRpYXRlbHkuXG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgbGV0IGZpbGVMaXN0ID0gYXdhaXQgdGhpcy5nZXRGaWxlTGlzdCgpO1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUxpc3RDaGFuZ2UnLCBmaWxlTGlzdCk7XG4gICAgICAgIH0pKCkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGhlIGN1cnJlbnQgZmlsZSB3YXMgY2hhbmdlZCBpbiBzb21lIHdheSAod2l0aG91dCBjaGFuZ2luZyB0aGUgZmlsZSBuYW1lKVxuICAgICAgICB0aGlzLnRyaWdnZXIoJ2ZpbGVTYXZlJyk7XG4gICAgICB9XG4gICAgfSkub24oJ2Vycm9yJywgZXJyb3JPYmogPT4ge1xuICAgICAgdGhpcy5jYXRjaERiRXJyb3IoZXJyb3JPYmopO1xuICAgIH0pO1xuICAgIHJldHVybiBkYjtcbiAgfVxuICBhc3luYyBzZXRDdXJyZW50RmlsZSAoZmlsZW5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoJ3VzZXJQcmVmcycpLnRoZW4ocHJlZnMgPT4ge1xuICAgICAgcHJlZnMuY3VycmVudEZpbGUgPSBmaWxlbmFtZTtcbiAgICAgIHJldHVybiB0aGlzLmRiLnB1dChwcmVmcyk7XG4gICAgfSkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICB9XG4gIGFzeW5jIGdldEN1cnJlbnRGaWxlbmFtZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuZ2V0KCd1c2VyUHJlZnMnKS50aGVuKHByZWZzID0+IHtcbiAgICAgIHJldHVybiBwcmVmcy5jdXJyZW50RmlsZTtcbiAgICB9KTtcbiAgfVxuICBhc3luYyBnZXRGaWxlIChmaWxlbmFtZSwgaW5jbHVkZURhdGEpIHtcbiAgICBpZiAoIWZpbGVuYW1lKSB7XG4gICAgICBmaWxlbmFtZSA9IGF3YWl0IHRoaXMuZ2V0Q3VycmVudEZpbGVuYW1lKCk7XG4gICAgfVxuXG4gICAgaWYgKGZpbGVuYW1lICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5kYi5nZXQoZmlsZW5hbWUsIHsgYXR0YWNobWVudHM6ICEhaW5jbHVkZURhdGEgfSlcbiAgICAgICAgLnRoZW4oZGJFbnRyeSA9PiB7XG4gICAgICAgICAgbGV0IG11cmVGaWxlID0ge1xuICAgICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgICBtZXRhZGF0YTogZGJFbnRyeS5tZXRhZGF0YSxcbiAgICAgICAgICAgIF9yZXY6IGRiRW50cnkuX3JldlxuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKGRiRW50cnkuX2F0dGFjaG1lbnRzW2ZpbGVuYW1lXS5kYXRhKSB7XG4gICAgICAgICAgICBtdXJlRmlsZS5iYXNlNjRzdHJpbmcgPSBkYkVudHJ5Ll9hdHRhY2htZW50c1tmaWxlbmFtZV0uZGF0YTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG11cmVGaWxlO1xuICAgICAgICB9KS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIGdldE1ldGFkYXRhIChmaWxlbmFtZSkge1xuICAgIGxldCBjdXJyZW50RmlsZSA9IGF3YWl0IHRoaXMuZ2V0RmlsZShmaWxlbmFtZSk7XG4gICAgcmV0dXJuIGN1cnJlbnRGaWxlICE9PSBudWxsID8gY3VycmVudEZpbGUubWV0YWRhdGEgOiBudWxsO1xuICB9XG4gIGFzeW5jIGdldEZpbGVBc0Jsb2IgKGZpbGVuYW1lKSB7XG4gICAgaWYgKCFmaWxlbmFtZSkge1xuICAgICAgZmlsZW5hbWUgPSBhd2FpdCB0aGlzLmdldEN1cnJlbnRGaWxlbmFtZSgpO1xuICAgIH1cbiAgICBpZiAoZmlsZW5hbWUgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLmRiLmdldEF0dGFjaG1lbnQoZmlsZW5hbWUsIGZpbGVuYW1lKVxuICAgICAgICAuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuICAgIH1cbiAgfVxuICBhc3luYyBnZXRGaWxlQXNET00gKGZpbGVuYW1lKSB7XG4gICAgbGV0IG11cmVGaWxlID0gYXdhaXQgdGhpcy5nZXRGaWxlKGZpbGVuYW1lLCB0cnVlKTtcbiAgICBpZiAobXVyZUZpbGUgIT09IG51bGwpIHtcbiAgICAgIGxldCB4bWxUZXh0ID0gd2luZG93LmF0b2IobXVyZUZpbGUuYmFzZTY0c3RyaW5nKTtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUobmV3IHdpbmRvdy5ET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoeG1sVGV4dCwgJ2ltYWdlL3N2Zyt4bWwnKSk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcbiAgICB9XG4gIH1cbiAgb24gKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcbiAgICBpZiAoIU11cmUuVkFMSURfRVZFTlRTW2V2ZW50TmFtZV0pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBldmVudCBuYW1lOiAnICsgZXZlbnROYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VwZXIub24oZXZlbnROYW1lLCBjYWxsYmFjayk7XG4gICAgfVxuICB9XG4gIGN1c3RvbWl6ZUFsZXJ0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmFsZXJ0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZUNvbmZpcm1EaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuY29uZmlybSA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVQcm9tcHREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMucHJvbXB0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIG9wZW5BcHAgKGFwcE5hbWUsIG5ld1RhYikge1xuICAgIGlmIChuZXdUYWIpIHtcbiAgICAgIHdpbmRvdy5vcGVuKCcvJyArIGFwcE5hbWUsICdfYmxhbmsnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lID0gJy8nICsgYXBwTmFtZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgc2F2ZUZpbGUgKG9wdGlvbnMpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IGV4aXN0aW5nRG9jO1xuICAgICAgaWYgKCFvcHRpb25zLmZpbGVuYW1lKSB7XG4gICAgICAgIG9wdGlvbnMuZmlsZW5hbWUgPSBhd2FpdCB0aGlzLmdldEN1cnJlbnRGaWxlbmFtZSgpO1xuICAgICAgfVxuICAgICAgaWYgKCFvcHRpb25zLmJsb2JPckJhc2U2NHN0cmluZykge1xuICAgICAgICBleGlzdGluZ0RvYyA9IGF3YWl0IHRoaXMuZGIuZ2V0KG9wdGlvbnMuZmlsZW5hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZXhpc3RpbmdEb2MgPSBhd2FpdCB0aGlzLmRiLmdldChvcHRpb25zLmZpbGVuYW1lLCB7IGF0dGFjaG1lbnRzOiB0cnVlIH0pO1xuICAgICAgICBleGlzdGluZ0RvYy5fYXR0YWNobWVudHNbb3B0aW9ucy5maWxlbmFtZV0uZGF0YSA9IG9wdGlvbnMuYmxvYk9yQmFzZTY0c3RyaW5nO1xuICAgICAgICBpZiAoKCFvcHRpb25zLm1ldGFkYXRhIHx8IE9iamVjdC5rZXlzKG9wdGlvbnMubWV0YWRhdGEpLmxlbmd0aCA9PT0gMCkgJiZcbiAgICAgICAgICBPYmplY3Qua2V5cyhleGlzdGluZ0RvYy5tZXRhZGF0YSkgPiAwKSB7XG4gICAgICAgICAgbGV0IHVzZXJDb25maXJtYXRpb24gPSBhd2FpdCB0aGlzLmNvbmZpcm0oXG4gICAgICAgICAgICAnSXQgYXBwZWFycyB0aGF0IHRoZSBmaWxlIHlvdVxcJ3JlIHVwbG9hZGluZyBoYXMgbG9zdCBpdHMgTXVyZSBtZXRhZGF0YS4gJyArXG4gICAgICAgICAgICAnVGhpcyBpcyBmYWlybHkgY29tbW9uIHdoZW4geW91XFwndmUgZWRpdGVkIGl0IHdpdGggYW4gZXh0ZXJuYWwgcHJvZ3JhbS5cXG5cXG4nICtcbiAgICAgICAgICAgICdSZXN0b3JlIHRoZSBtb3N0IHJlY2VudCBtZXRhZGF0YT8nKTtcbiAgICAgICAgICBpZiAoIXVzZXJDb25maXJtYXRpb24pIHtcbiAgICAgICAgICAgIGV4aXN0aW5nRG9jLm1ldGFkYXRhID0ge307XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5tZXRhZGF0YSkge1xuICAgICAgICBleGlzdGluZ0RvYy5tZXRhZGF0YSA9IG9wdGlvbnMubWV0YWRhdGE7XG4gICAgICB9XG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5kYi5wdXQoZXhpc3RpbmdEb2MpO1xuICAgIH0gY2F0Y2ggKGVycm9yT2JqKSB7XG4gICAgICBpZiAoZXJyb3JPYmoubWVzc2FnZSA9PT0gJ21pc3NpbmcnKSB7XG4gICAgICAgIC8vIFRoZSBmaWxlIGRvZXNuJ3QgZXhpc3QgeWV0Li4uXG4gICAgICAgIGxldCBuZXdEb2MgPSB7XG4gICAgICAgICAgX2lkOiBvcHRpb25zLmZpbGVuYW1lLFxuICAgICAgICAgIF9hdHRhY2htZW50czoge30sXG4gICAgICAgICAgbWV0YWRhdGE6IG9wdGlvbnMubWV0YWRhdGEgfHwge31cbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmJsb2JPckJhc2U2NHN0cmluZykge1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCAnQXR0ZW1wdGVkIHRvIHNhdmUgYSBmaWxlIHdpdGhvdXQgY29udGVudHMhJyk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3RG9jLl9hdHRhY2htZW50c1tvcHRpb25zLmZpbGVuYW1lXSA9IHtcbiAgICAgICAgICBjb250ZW50X3R5cGU6ICdpbWFnZS9zdmcreG1sJyxcbiAgICAgICAgICBkYXRhOiBvcHRpb25zLmJsb2JPckJhc2U2NHN0cmluZ1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5kYi5wdXQobmV3RG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2F0Y2hEYkVycm9yKGVycm9yT2JqKTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yT2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0RmlsZUxpc3QgKCkge1xuICAgIHJldHVybiB0aGlzLmRiLmFsbERvY3MoKVxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0gW107XG4gICAgICAgIHJlc3BvbnNlLnJvd3MuZm9yRWFjaChkID0+IHtcbiAgICAgICAgICBpZiAoZC5pZCAhPT0gJ3VzZXJQcmVmcycpIHtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGQuaWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gIH1cbiAgYXN5bmMgZ2V0RmlsZVJldmlzaW9ucyAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuYWxsRG9jcygpXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgIGxldCByZXN1bHQgPSB7fTtcbiAgICAgICAgcmVzcG9uc2Uucm93cy5mb3JFYWNoKGQgPT4ge1xuICAgICAgICAgIGlmIChkLmlkICE9PSAndXNlclByZWZzJykge1xuICAgICAgICAgICAgcmVzdWx0W2QuaWRdID0gZC52YWx1ZS5yZXY7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxuICBhc3luYyByZWFkRmlsZSAocmVhZGVyLCBmaWxlT2JqKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSB4bWxUZXh0ID0+IHtcbiAgICAgICAgcmVzb2x2ZSh4bWxUZXh0LnRhcmdldC5yZXN1bHQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5vbmVycm9yID0gZXJyb3IgPT4ge1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5vbmFib3J0ID0gKCkgPT4ge1xuICAgICAgICByZWplY3QoTXVyZS5TSUdOQUxTLmNhbmNlbGxlZCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZU9iaik7XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgdmFsaWRhdGVGaWxlTmFtZSAob3JpZ2luYWxOYW1lLCB0YWtlbk5hbWVzLCBhYm9ydEZ1bmN0aW9uKSB7XG4gICAgLy8gQXNrIG11bHRpcGxlIHRpbWVzIGlmIHRoZSB1c2VyIGhhcHBlbnMgdG8gZW50ZXIgYW5vdGhlciBmaWxlbmFtZSB0aGF0IGFscmVhZHkgZXhpc3RzXG4gICAgbGV0IGZpbGVuYW1lID0gb3JpZ2luYWxOYW1lO1xuICAgIHdoaWxlICh0YWtlbk5hbWVzW2ZpbGVuYW1lXSkge1xuICAgICAgbGV0IGZpbGVuYW1lID0gYXdhaXQgdGhpcy5wcm9tcHQoXG4gICAgICAgIGZpbGVuYW1lICsgJyBhbHJlYWR5IGV4aXN0cy4gUGljayBhIG5ldyBuYW1lLCBvciBsZWF2ZSBpdCB0aGUgc2FtZSB0byBvdmVyd3JpdGU6JyxcbiAgICAgICAgZmlsZW5hbWUpO1xuICAgICAgaWYgKGZpbGVuYW1lID09PSBudWxsKSB7XG4gICAgICAgIGlmIChhYm9ydEZ1bmN0aW9uKSB7XG4gICAgICAgICAgYWJvcnRGdW5jdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChNdXJlLlNJR05BTFMuY2FuY2VsbGVkKTtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUgPT09ICcnKSB7XG4gICAgICAgIGZpbGVuYW1lID0gYXdhaXQgdGhpcy5wcm9tcHQoJ1lvdSBtdXN0IGVudGVyIGEgZmlsZSBuYW1lIChvciBoaXQgY2FuY2VsIHRvIGNhbmNlbCB0aGUgdXBsb2FkKScpO1xuICAgICAgfSBlbHNlIGlmIChmaWxlbmFtZSA9PT0gb3JpZ2luYWxOYW1lKSB7XG4gICAgICAgIC8vIFRoZXkgbGVmdCBpdCB0aGUgc2FtZS4uLiBvdmVyd3JpdGUhXG4gICAgICAgIHJldHVybiBmaWxlbmFtZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZpbGVuYW1lO1xuICB9XG4gIG1hdGNoRGF0YVBhdGhzIChwYXRoMSwgcGF0aDIsIG1ldGFkYXRhKSB7XG4gICAgaWYgKCFtZXRhZGF0YSB8fCAhbWV0YWRhdGEuZGF0YXNldHMgfHwgIXBhdGgxIHx8ICFwYXRoMikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0MSA9IGpzb25wYXRoLnF1ZXJ5KG1ldGFkYXRhLmRhdGFzZXRzLCBwYXRoMSk7XG4gICAgbGV0IHJlc3VsdDIgPSBqc29ucGF0aC5xdWVyeShtZXRhZGF0YS5kYXRhc2V0cywgcGF0aDIpO1xuICAgIGlmIChyZXN1bHQxLmxlbmd0aCAhPT0gMSB8fCByZXN1bHQyLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0MVswXSA9PT0gcmVzdWx0MlswXTtcbiAgfVxuICBtYXRjaERvbVNlbGVjdG9ycyAoc2VsZWN0b3IxLCBzZWxlY3RvcjIsIGRvbSkge1xuICAgIGlmICghc2VsZWN0b3IxIHx8ICFzZWxlY3RvcjIpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdDEgPSBkb20ucXVlcnlTZWxlY3RvcihzZWxlY3RvcjEpO1xuICAgIGxldCByZXN1bHQyID0gZG9tLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IyKTtcbiAgICByZXR1cm4gcmVzdWx0MSA9PT0gcmVzdWx0MjtcbiAgfVxuICBpbmZlclBhcnNlciAoZmlsZU9iaikge1xuICAgIGxldCBleHQgPSBmaWxlT2JqLnR5cGUuc3BsaXQoJy8nKVsxXTtcbiAgICBpZiAoZXh0ID09PSAnY3N2Jykge1xuICAgICAgcmV0dXJuIChjb250ZW50cykgPT4geyByZXR1cm4gZGF0YWxpYi5yZWFkKGNvbnRlbnRzLCB7dHlwZTogJ2NzdicsIHBhcnNlOiAnYXV0byd9KTsgfTtcbiAgICB9IGVsc2UgaWYgKGV4dCA9PT0gJ3RzdicpIHtcbiAgICAgIHJldHVybiAoY29udGVudHMpID0+IHsgcmV0dXJuIGRhdGFsaWIucmVhZChjb250ZW50cywge3R5cGU6ICd0c3YnLCBwYXJzZTogJ2F1dG8nfSk7IH07XG4gICAgfSBlbHNlIGlmIChleHQgPT09ICdkc3YnKSB7XG4gICAgICByZXR1cm4gKGNvbnRlbnRzKSA9PiB7IHJldHVybiBkYXRhbGliLnJlYWQoY29udGVudHMsIHt0eXBlOiAnZHN2JywgcGFyc2U6ICdhdXRvJ30pOyB9O1xuICAgIH0gZWxzZSBpZiAoZXh0ID09PSAnanNvbicpIHtcbiAgICAgIC8vIFRPRE86IGF0dGVtcHQgdG8gYXV0by1kaXNjb3ZlciB0b3BvanNvbiBvciB0cmVlanNvbj9cbiAgICAgIHJldHVybiAoY29udGVudHMpID0+IHsgcmV0dXJuIGRhdGFsaWIucmVhZChjb250ZW50cywge3R5cGU6ICdqc29uJywgcGFyc2U6ICdhdXRvJ30pOyB9O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cbiAgYXN5bmMgdXBsb2FkRGF0YXNldCAoZmlsZU9iaikge1xuICAgIGxldCBwYXJzZXIgPSB0aGlzLmluZmVyUGFyc2VyKGZpbGVPYmopO1xuICAgIGlmICghcGFyc2VyKSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgJ1Vua25vd24gZGF0YSBmaWxlIHR5cGU6ICcgKyBmaWxlT2JqLnR5cGUpO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gICAgfVxuXG4gICAgbGV0IG1ldGFkYXRhID0gYXdhaXQgdGhpcy5nZXRNZXRhZGF0YSgpO1xuICAgIGlmIChtZXRhZGF0YSA9PT0gbnVsbCkge1xuICAgICAgdGhpcy50cmlnZ2VyKCdlcnJvcicsICdDYW5cXCd0IGVtYmVkIGEgZGF0YSBmaWxlIHdpdGhvdXQgYW4gU1ZHIGZpbGUgYWxyZWFkeSBvcGVuJyk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgICB9XG4gICAgbWV0YWRhdGEuZGF0YXNldHMgPSBtZXRhZGF0YS5kYXRhc2V0cyB8fCB7fTtcblxuICAgIGxldCByZWFkZXIgPSBuZXcgd2luZG93LkZpbGVSZWFkZXIoKTtcbiAgICBsZXQgZmlsZVRleHQgPSBhd2FpdCB0aGlzLnJlYWRGaWxlKHJlYWRlciwgZmlsZU9iaik7XG4gICAgbGV0IGRhdGFGaWxlTmFtZSA9IGF3YWl0IHRoaXMudmFsaWRhdGVGaWxlTmFtZShmaWxlT2JqLm5hbWUsIG1ldGFkYXRhLmRhdGFzZXRzLCByZWFkZXIuYWJvcnQpO1xuXG4gICAgbWV0YWRhdGEuZGF0YXNldHNbZGF0YUZpbGVOYW1lXSA9IHBhcnNlcihmaWxlVGV4dCk7XG4gICAgcmV0dXJuIHRoaXMuc2F2ZUZpbGUoeyBtZXRhZGF0YSB9KTtcbiAgfVxuICBhc3luYyB1cGxvYWRTdmcgKGZpbGVPYmopIHtcbiAgICBsZXQgcmVhZGVyID0gbmV3IHdpbmRvdy5GaWxlUmVhZGVyKCk7XG4gICAgbGV0IGNvbnRlbnRzUHJvbWlzZSA9IHRoaXMucmVhZEZpbGUocmVhZGVyLCBmaWxlT2JqKVxuICAgIC50aGVuKHhtbFRleHQgPT4ge1xuICAgICAgbGV0IGRvbSA9IG5ldyB3aW5kb3cuRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHhtbFRleHQsICdpbWFnZS9zdmcreG1sJyk7XG4gICAgICBsZXQgY29udGVudHMgPSB7IG1ldGFkYXRhOiB0aGlzLmV4dHJhY3RNZXRhZGF0YShkb20pIH07XG4gICAgICBjb250ZW50cy5iYXNlNjRkYXRhID0gd2luZG93LmJ0b2EobmV3IHdpbmRvdy5YTUxTZXJpYWxpemVyKCkuc2VyaWFsaXplVG9TdHJpbmcoZG9tKSk7XG4gICAgICByZXR1cm4gY29udGVudHM7XG4gICAgfSk7XG5cbiAgICBsZXQgZmlsZW5hbWVQcm9taXNlID0gdGhpcy5nZXRGaWxlUmV2aXNpb25zKClcbiAgICAgIC5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcilcbiAgICAgIC50aGVuKHJldmlzaW9uRGljdCA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLnZhbGlkYXRlRmlsZU5hbWUoZmlsZU9iai5uYW1lLCByZXZpc2lvbkRpY3QsIHJlYWRlci5hYm9ydCk7XG4gICAgICB9KTtcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChbZmlsZW5hbWVQcm9taXNlLCBjb250ZW50c1Byb21pc2VdKS50aGVuKChbZmlsZW5hbWUsIGNvbnRlbnRzXSkgPT4ge1xuICAgICAgcmV0dXJuIHRoaXMuc2F2ZUZpbGUoe1xuICAgICAgICBmaWxlbmFtZSxcbiAgICAgICAgYmxvYk9yQmFzZTY0c3RyaW5nOiBjb250ZW50cy5iYXNlNjRkYXRhLFxuICAgICAgICBtZXRhZGF0YTogY29udGVudHMubWV0YWRhdGFcbiAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRDdXJyZW50RmlsZShmaWxlbmFtZSk7XG4gICAgICB9KTtcbiAgICB9KS5jYXRjaCgoZXJyTGlzdCkgPT4ge1xuICAgICAgaWYgKGVyckxpc3RbMF0gPT09IE11cmUuU0lHTkFMUy5jYW5jZWxsZWQgJiYgZXJyTGlzdFsxXSA9PT0gTXVyZS5TSUdOQUxTLmNhbmNlbGxlZCkge1xuICAgICAgICByZXR1cm47IC8vIGNhbmNlbGxpbmcgaXMgbm90IGEgcHJvYmxlbVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVyckxpc3QpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIGFzeW5jIGRlbGV0ZVN2ZyAoZmlsZW5hbWUpIHtcbiAgICBsZXQgdXNlckNvbmZpcm1hdGlvbiA9IGF3YWl0IHRoaXMuY29uZmlybSgnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSAnICsgZmlsZW5hbWUgKyAnPycpO1xuICAgIGlmICh1c2VyQ29uZmlybWF0aW9uKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwoW3RoaXMuZGIuZ2V0KGZpbGVuYW1lKSwgdGhpcy5nZXRDdXJyZW50RmlsZW5hbWUoKV0pLnRoZW4ocHJvbWlzZVJlc3VsdHMgPT4ge1xuICAgICAgICBsZXQgZXhpc3RpbmdEb2MgPSBwcm9taXNlUmVzdWx0c1swXTtcbiAgICAgICAgbGV0IGN1cnJlbnRGaWxlID0gcHJvbWlzZVJlc3VsdHNbMV07XG4gICAgICAgIHJldHVybiB0aGlzLmRiLnJlbW92ZShleGlzdGluZ0RvYy5faWQsIGV4aXN0aW5nRG9jLl9yZXYpXG4gICAgICAgICAgLnRoZW4ocmVtb3ZlUmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGVuYW1lID09PSBjdXJyZW50RmlsZSkge1xuICAgICAgICAgICAgICB0aGlzLnNldEN1cnJlbnRGaWxlKG51bGwpLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZW1vdmVSZXNwb25zZTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG4gICAgfVxuICB9XG4gIGV4dHJhY3RNZXRhZGF0YSAoZG9tKSB7XG4gICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgIGxldCBtZXRhZGF0YSA9IHt9O1xuICAgIGxldCBkM2RvbSA9IGQzLnNlbGVjdChkb20ucm9vdEVsZW1lbnQpO1xuXG4gICAgLy8gRXh0cmFjdCB0aGUgY29udGFpbmVyIGZvciBvdXIgbWV0YWRhdGEsIGlmIGl0IGV4aXN0c1xuICAgIGxldCByb290ID0gZDNkb20uc2VsZWN0KCcjbXVyZScpO1xuICAgIGlmIChyb290LnNpemUoKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG1ldGFkYXRhO1xuICAgIH1cbiAgICBsZXQgbnNFbGVtZW50ID0gcm9vdC5zZWxlY3QoJ211cmUnKTtcbiAgICBpZiAobnNFbGVtZW50LnNpemUoKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG1ldGFkYXRhO1xuICAgIH1cblxuICAgIC8vIEFueSBsaWJyYXJpZXM/XG4gICAgbnNFbGVtZW50LnNlbGVjdEFsbCgnbGlicmFyeScpLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgIGlmICghbWV0YWRhdGEubGlicmFyaWVzKSB7XG4gICAgICAgIG1ldGFkYXRhLmxpYnJhcmllcyA9IFtdO1xuICAgICAgfVxuICAgICAgbWV0YWRhdGEubGlicmFyaWVzLnB1c2goZDMuc2VsZWN0KHRoaXMpLmF0dHIoJ3NyYycpKTtcbiAgICB9KTtcblxuICAgIC8vIEFueSBzY3JpcHRzP1xuICAgIG5zRWxlbWVudC5zZWxlY3RBbGwoJ3NjcmlwdCcpLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgIGxldCBlbCA9IGQzLnNlbGVjdCh0aGlzKTtcbiAgICAgIGxldCBzY3JpcHQgPSB7XG4gICAgICAgIHRleHQ6IHNlbGYuZXh0cmFjdENEQVRBKGVsLnRleHQoKSlcbiAgICAgIH07XG4gICAgICBsZXQgaWQgPSBlbC5hdHRyKCdpZCcpO1xuICAgICAgaWYgKGlkKSB7XG4gICAgICAgIGlmIChpZCA9PT0gJ211cmVJbnRlcmFjdGl2aXR5UnVubmVyJykge1xuICAgICAgICAgIC8vIERvbid0IHN0b3JlIG91ciBpbnRlcmFjdGl2aXR5IHJ1bm5lciBzY3JpcHRcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2NyaXB0LmlkID0gaWQ7XG4gICAgICB9XG4gICAgICBpZiAoIW1ldGFkYXRhLnNjcmlwdHMpIHtcbiAgICAgICAgbWV0YWRhdGEuc2NyaXB0cyA9IFtdO1xuICAgICAgfVxuICAgICAgbWV0YWRhdGEuc2NyaXB0cy5wdXNoKHNjcmlwdCk7XG4gICAgfSk7XG5cbiAgICAvLyBBbnkgZGF0YXNldHM/XG4gICAgbnNFbGVtZW50LnNlbGVjdEFsbCgnZGF0YXNldHMnKS5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICBsZXQgZWwgPSBkMy5zZWxlY3QodGhpcyk7XG4gICAgICBpZiAoIW1ldGFkYXRhLmRhdGFzZXRzKSB7XG4gICAgICAgIG1ldGFkYXRhLmRhdGFzZXRzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5kYXRhc2V0c1tlbC5hdHRyKCduYW1lJyldID0gSlNPTi5wYXJzZShzZWxmLmV4dHJhY3RDREFUQShlbC50ZXh0KCkpKTtcbiAgICB9KTtcblxuICAgIC8vIEFueSBkYXRhIGJpbmRpbmdzP1xuICAgIG5zRWxlbWVudC5zZWxlY3RBbGwoJ2JpbmRpbmcnKS5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICBsZXQgZWwgPSBkMy5zZWxlY3QodGhpcyk7XG4gICAgICBsZXQgYmluZGluZyA9IHtcbiAgICAgICAgaWQ6IGVsLmF0dHIoJ2lkJyksXG4gICAgICAgIGRhdGFSb290OiBlbC5hdHRyKCdkYXRhcm9vdCcpLFxuICAgICAgICBzdmdSb290OiBlbC5hdHRyKCdzdmdyb290JyksXG4gICAgICAgIGtleUZ1bmN0aW9uOiBKU09OLnBhcnNlKHNlbGYuZXh0cmFjdENEQVRBKGVsLnRleHQoKSkpXG4gICAgICB9O1xuXG4gICAgICBpZiAoIW1ldGFkYXRhLmJpbmRpbmdzKSB7XG4gICAgICAgIG1ldGFkYXRhLmJpbmRpbmdzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5iaW5kaW5nc1tiaW5kaW5nLmlkXSA9IGJpbmRpbmc7XG4gICAgfSk7XG5cbiAgICAvLyBBbnkgZW5jb2RpbmdzP1xuICAgIG5zRWxlbWVudC5zZWxlY3RBbGwoJ2VuY29kaW5nJykuZWFjaChmdW5jdGlvbiAoZCkge1xuICAgICAgbGV0IGVsID0gZDMuc2VsZWN0KHRoaXMpO1xuICAgICAgbGV0IGVuY29kaW5nID0ge1xuICAgICAgICBpZDogZWwuYXR0cignaWQnKSxcbiAgICAgICAgYmluZGluZ0lkOiBlbC5hdHRyKCdmb3InKSxcbiAgICAgICAgc3BlYzogSlNPTi5wYXJzZShzZWxmLmV4dHJhY3RDREFUQShlbC50ZXh0KCkpKVxuICAgICAgfTtcblxuICAgICAgaWYgKCFtZXRhZGF0YS5lbmNvZGluZ3MpIHtcbiAgICAgICAgbWV0YWRhdGEuZW5jb2RpbmdzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5lbmNvZGluZ3NbZW5jb2RpbmcuaWRdID0gZW5jb2Rpbmc7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWV0YWRhdGE7XG4gIH1cbiAgZXh0cmFjdENEQVRBIChzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyg8IVxcW0NEQVRBXFxbKS9nLCAnJykucmVwbGFjZSgvXV0+L2csICcnKTtcbiAgfVxuICBnZXRFbXB0eUJpbmRpbmcgKG1ldGFkYXRhLCBhZGQpIHtcbiAgICBsZXQgaWQgPSAxO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb24gKi9cbiAgICB3aGlsZSAobWV0YWRhdGEuYmluZGluZ3MgJiYgbWV0YWRhdGEuYmluZGluZ3NbJ0JpbmRpbmcnICsgaWRdKSB7XG4gICAgICBpZCsrO1xuICAgIH1cbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb24gKi9cbiAgICBsZXQgbmV3QmluZGluZyA9IHtcbiAgICAgIGlkOiAnQmluZGluZycgKyBpZCxcbiAgICAgIHN2Z1Jvb3Q6ICcnLFxuICAgICAgZGF0YVJvb3Q6ICcnLFxuICAgICAga2V5RnVuY3Rpb246IHtcbiAgICAgICAgZGF0YUV4cHJlc3Npb246ICcoZCwgaSkgPT4gaScsXG4gICAgICAgIHN2Z0V4cHJlc3Npb246ICcoZWwsIGksIGQzZWwsICRlbCkgPT4gaSdcbiAgICAgIH1cbiAgICB9O1xuICAgIGlmIChhZGQpIHtcbiAgICAgIGlmICghbWV0YWRhdGEuYmluZGluZ3MpIHtcbiAgICAgICAgbWV0YWRhdGEuYmluZGluZ3MgPSB7fTtcbiAgICAgIH1cbiAgICAgIG1ldGFkYXRhLmJpbmRpbmdzW25ld0JpbmRpbmcuaWRdID0gbmV3QmluZGluZztcbiAgICB9XG4gICAgcmV0dXJuIG5ld0JpbmRpbmc7XG4gIH1cbiAgZ2V0RW1wdHlFbmNvZGluZyAobWV0YWRhdGEsIGFkZCkge1xuICAgIGxldCBpZCA9IDE7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW5tb2RpZmllZC1sb29wLWNvbmRpdGlvbiAqL1xuICAgIHdoaWxlIChtZXRhZGF0YS5lbmNvZGluZ3MgJiYgbWV0YWRhdGEuZW5jb2RpbmdzWydFbmNvZGluZycgKyBpZF0pIHtcbiAgICAgIGlkKys7XG4gICAgfVxuICAgIC8qIGVzbGludC1lbmFibGUgbm8tdW5tb2RpZmllZC1sb29wLWNvbmRpdGlvbiAqL1xuICAgIGxldCBuZXdFbmNvZGluZyA9IHtcbiAgICAgIGlkOiAnRW5jb2RpbmcnICsgaWQsXG4gICAgICBiaW5kaW5nSWQ6IG51bGwsXG4gICAgICBzcGVjOiB7fVxuICAgIH07XG4gICAgaWYgKGFkZCkge1xuICAgICAgaWYgKCFtZXRhZGF0YS5lbmNvZGluZ3MpIHtcbiAgICAgICAgbWV0YWRhdGEuZW5jb2RpbmdzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5lbmNvZGluZ3NbbmV3RW5jb2RpbmcuaWRdID0gbmV3RW5jb2Rpbmc7XG4gICAgfVxuICAgIHJldHVybiBuZXdFbmNvZGluZztcbiAgfVxuICBlbWJlZE1ldGFkYXRhIChkb20sIG1ldGFkYXRhKSB7XG4gICAgbGV0IGQzZG9tID0gZDMuc2VsZWN0KGRvbS5yb290RWxlbWVudCk7XG5cbiAgICAvLyBUb3A6IG5lZWQgYSBtZXRhZGF0YSB0YWdcbiAgICBsZXQgcm9vdCA9IGQzZG9tLnNlbGVjdEFsbCgnI211cmUnKS5kYXRhKFswXSk7XG4gICAgcm9vdC5leGl0KCkucmVtb3ZlKCk7XG4gICAgcm9vdCA9IHJvb3QuZW50ZXIoKS5hcHBlbmQoJ21ldGFkYXRhJykuYXR0cignaWQnLCAnbXVyZScpLm1lcmdlKHJvb3QpO1xuXG4gICAgLy8gTmV4dCBkb3duOiBhIHRhZyB0byBkZWZpbmUgdGhlIG5hbWVzcGFjZVxuICAgIGxldCBuc0VsZW1lbnQgPSByb290LnNlbGVjdEFsbCgnbXVyZScpLmRhdGEoWzBdKTtcbiAgICBuc0VsZW1lbnQuZXhpdCgpLnJlbW92ZSgpO1xuICAgIG5zRWxlbWVudCA9IG5zRWxlbWVudC5lbnRlcigpLmFwcGVuZCgnbXVyZScpLmF0dHIoJ3htbG5zJywgdGhpcy5OU1N0cmluZykubWVyZ2UobnNFbGVtZW50KTtcblxuICAgIC8vIE9rYXksIHdlJ3JlIGluIG91ciBjdXN0b20gbmFtZXNwYWNlLi4uIGxldCdzIGZpZ3VyZSBvdXQgdGhlIGxpYnJhcmllc1xuICAgIGxldCBsaWJyYXJ5TGlzdCA9IG1ldGFkYXRhLmxpYnJhcmllcyB8fCBbXTtcbiAgICBsZXQgbGlicmFyaWVzID0gbnNFbGVtZW50LnNlbGVjdEFsbCgnbGlicmFyeScpLmRhdGEobGlicmFyeUxpc3QpO1xuICAgIGxpYnJhcmllcy5leGl0KCkucmVtb3ZlKCk7XG4gICAgbGlicmFyaWVzID0gbGlicmFyaWVzLmVudGVyKCkuYXBwZW5kKCdsaWJyYXJ5JykubWVyZ2UobGlicmFyaWVzKTtcbiAgICBsaWJyYXJpZXMuYXR0cignc3JjJywgZCA9PiBkKTtcblxuICAgIC8vIExldCdzIGRlYWwgd2l0aCBhbnkgdXNlciBzY3JpcHRzXG4gICAgbGV0IHNjcmlwdExpc3QgPSBtZXRhZGF0YS5zY3JpcHRzIHx8IFtdO1xuICAgIGxldCBzY3JpcHRzID0gbnNFbGVtZW50LnNlbGVjdEFsbCgnc2NyaXB0JykuZGF0YShzY3JpcHRMaXN0KTtcbiAgICBzY3JpcHRzLmV4aXQoKS5yZW1vdmUoKTtcbiAgICBsZXQgc2NyaXB0c0VudGVyID0gc2NyaXB0cy5lbnRlcigpLmFwcGVuZCgnc2NyaXB0Jyk7XG4gICAgc2NyaXB0cyA9IHNjcmlwdHNFbnRlci5tZXJnZShzY3JpcHRzKTtcbiAgICBzY3JpcHRzLmF0dHIoJ2lkJywgZCA9PiBkLmlkIHx8IG51bGwpO1xuICAgIHNjcmlwdHMuZWFjaChmdW5jdGlvbiAoZCkge1xuICAgICAgdGhpcy5pbm5lckhUTUwgPSAnPCFbQ0RBVEFbJyArIGQudGV4dCArICddXT4nO1xuICAgIH0pO1xuXG4gICAgLy8gUmVtb3ZlIG11cmVJbnRlcmFjdGl2aXR5UnVubmVyIGJ5IGRlZmF1bHQgdG8gZW5zdXJlIGl0IGFsd2F5cyBjb21lcyBhZnRlciB0aGVcbiAgICAvLyBtZXRhZGF0YSB0YWcgKG9mIGNvdXJzZSwgb25seSBib3RoZXIgYWRkaW5nIGl0IGlmIHdlIGhhdmUgYW55IGxpYnJhcmllcyBvciBzY3JpcHRzKVxuICAgIGQzZG9tLnNlbGVjdCgnI211cmVJbnRlcmFjdGl2aXR5UnVubmVyJykucmVtb3ZlKCk7XG4gICAgaWYgKGxpYnJhcnlMaXN0Lmxlbmd0aCA+IDAgfHwgc2NyaXB0TGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICBkM2RvbS5hcHBlbmQoJ3NjcmlwdCcpXG4gICAgICAgIC5hdHRyKCdpZCcsICdtdXJlSW50ZXJhY3Rpdml0eVJ1bm5lcicpXG4gICAgICAgIC5hdHRyKCd0eXBlJywgJ3RleHQvamF2YXNjcmlwdCcpXG4gICAgICAgIC50ZXh0KCc8IVtDREFUQVsnICsgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0ICsgJ11dJyk7XG4gICAgfVxuXG4gICAgLy8gV2UgYWx3YXlzIHN0b3JlIGRhdGFzZXRzIGFzIEpTT05cbiAgICBsZXQgZGF0YXNldHMgPSBuc0VsZW1lbnQuc2VsZWN0QWxsKCdkYXRhc2V0JykuZGF0YShkMy5lbnRyaWVzKG1ldGFkYXRhLmRhdGFzZXRzIHx8IHt9KSk7XG4gICAgZGF0YXNldHMuZXhpdCgpLnJlbW92ZSgpO1xuICAgIGxldCBkYXRhc2V0c0VudGVyID0gZGF0YXNldHMuZW50ZXIoKS5hcHBlbmQoJ2RhdGFzZXQnKTtcbiAgICBkYXRhc2V0cyA9IGRhdGFzZXRzRW50ZXIubWVyZ2UoZGF0YXNldHMpO1xuICAgIGRhdGFzZXRzLmF0dHIoJ25hbWUnLCBkID0+IGQua2V5KVxuICAgICAgLmh0bWwoZCA9PiAnPCFbQ0RBVEFbJyArIEpTT04uc3RyaW5naWZ5KGQudmFsdWUpICsgJ11dPicpO1xuXG4gICAgLy8gU3RvcmUgZGF0YSBiaW5kaW5nc1xuICAgIGxldCBiaW5kaW5ncyA9IG5zRWxlbWVudC5zZWxlY3RBbGwoJ2JpbmRpbmcnKS5kYXRhKGQzLnZhbHVlcyhtZXRhZGF0YS5iaW5kaW5ncyB8fCB7fSkpO1xuICAgIGJpbmRpbmdzLmV4aXQoKS5yZW1vdmUoKTtcbiAgICBsZXQgYmluZGluZ3NFbnRlciA9IGJpbmRpbmdzLmVudGVyKCkuYXBwZW5kKCdiaW5kaW5nJyk7XG4gICAgYmluZGluZ3MgPSBiaW5kaW5nc0VudGVyLm1lcmdlKGJpbmRpbmdzKTtcbiAgICBiaW5kaW5nc1xuICAgICAgLmF0dHIoJ2lkJywgZCA9PiBkLmlkKVxuICAgICAgLmF0dHIoJ2RhdGFyb290JywgZCA9PiBkLmRhdGFSb290KVxuICAgICAgLmF0dHIoJ3N2Z3Jvb3QnLCBkID0+IGQuc3ZnUm9vdClcbiAgICAgIC5odG1sKGQgPT4gJzwhW0NEQVRBWycgKyBKU09OLnN0cmluZ2lmeShkLmtleUZ1bmN0aW9uKSArICddXT4nKTtcblxuICAgIC8vIFN0b3JlIGVuY29kaW5nIG1ldGFkYXRhXG4gICAgbGV0IGVuY29kaW5ncyA9IG5zRWxlbWVudC5zZWxlY3RBbGwoJ2VuY29kaW5nJykuZGF0YShkMy52YWx1ZXMobWV0YWRhdGEuZW5jb2RpbmdzIHx8IHt9KSk7XG4gICAgZW5jb2RpbmdzLmV4aXQoKS5yZW1vdmUoKTtcbiAgICBsZXQgZW5jb2RpbmdzRW50ZXIgPSBlbmNvZGluZ3MuZW50ZXIoKS5hcHBlbmQoJ2VuY29kaW5nJyk7XG4gICAgZW5jb2RpbmdzID0gZW5jb2RpbmdzRW50ZXIubWVyZ2UoZW5jb2RpbmdzKTtcbiAgICBlbmNvZGluZ3NcbiAgICAgIC5hdHRyKCdpZCcsIGQgPT4gZC5pZClcbiAgICAgIC5hdHRyKCdiaW5kaW5naWQnLCBkID0+IGQuYmluZGluZ0lkKVxuICAgICAgLmh0bWwoZCA9PiAnPCFbQ0RBVEFbJyArIEpTT04uc3RyaW5naWZ5KGQuc3BlYykgKyAnXV0+Jyk7XG4gIH1cbiAgYXN5bmMgZG93bmxvYWRTdmcgKGZpbGVuYW1lKSB7XG4gICAgbGV0IG11cmVGaWxlO1xuICAgIHRyeSB7XG4gICAgICAvLyBFbWJlZCBtdXJlRmlsZS5tZXRhZGF0YSBhcyBYTUwgaW5zaWRlIG11cmVGaWxlLmJhc2U2NGRhdGFcbiAgICAgIG11cmVGaWxlID0gYXdhaXQgdGhpcy5nZXRGaWxlKGZpbGVuYW1lLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhpcy5jYXRjaERiRXJyb3IoZXJyb3IpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgeG1sVGV4dCA9IHdpbmRvdy5hdG9iKG11cmVGaWxlLmJhc2U2NHN0cmluZyk7XG4gICAgbGV0IGRvbSA9IG5ldyB3aW5kb3cuRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHhtbFRleHQsICdpbWFnZS9zdmcreG1sJyk7XG4gICAgdGhpcy5lbWJlZE1ldGFkYXRhKGRvbSwgbXVyZUZpbGUubWV0YWRhdGEpO1xuICAgIHhtbFRleHQgPSBuZXcgd2luZG93LlhNTFNlcmlhbGl6ZXIoKS5zZXJpYWxpemVUb1N0cmluZyhkb20pO1xuICAgIHhtbFRleHQgPSB4bWxUZXh0LnJlcGxhY2UoLyZsdDshXFxbQ0RBVEFcXFsvZywgJzwhXFxbQ0RBVEFcXFsnKS5yZXBsYWNlKC9dXSZndDsvZywgJ11dPicpO1xuXG4gICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rIHRvIGluaXRpYXRlIHRoZSBkb3dubG9hZFxuICAgIGxldCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICBsZXQgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwobmV3IHdpbmRvdy5CbG9iKFt4bWxUZXh0XSwgeyB0eXBlOiAnaW1hZ2Uvc3ZnK3htbCcgfSkpO1xuICAgIGEuaHJlZiA9IHVybDtcbiAgICBhLmRvd25sb2FkID0gZmlsZW5hbWU7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICBhLmNsaWNrKCk7XG4gICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcbiAgICBhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSk7XG4gIH1cbn1cblxuTXVyZS5WQUxJRF9FVkVOVFMgPSB7XG4gIGZpbGVMaXN0Q2hhbmdlOiB0cnVlLFxuICBmaWxlQ2hhbmdlOiB0cnVlLFxuICBmaWxlU2F2ZTogdHJ1ZSxcbiAgZXJyb3I6IHRydWVcbn07XG5cbk11cmUuU0lHTkFMUyA9IHtcbiAgY2FuY2VsbGVkOiB0cnVlXG59O1xuXG5sZXQgbXVyZSA9IG5ldyBNdXJlKCk7XG5leHBvcnQgZGVmYXVsdCBtdXJlO1xuIl0sIm5hbWVzIjpbIk11cmUiLCJhcHBMaXN0IiwiZG9jdW1lbnQiLCJ3aW5kb3ciLCJ1bmRlZmluZWQiLCJOU1N0cmluZyIsIm11cmUiLCJ3aW5kb3dUaXRsZSIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwidGV4dENvbnRlbnQiLCJkZWJ1Z01vZGUiLCJsb2NhdGlvbiIsImhvc3RuYW1lIiwic3RhcnRzV2l0aCIsImN1cnJlbnRBcHAiLCJwYXRobmFtZSIsInJlcGxhY2UiLCJsYXN0RmlsZSIsImRiIiwiZ2V0T3JJbml0RGIiLCJvbiIsIndhcm4iLCJlcnJvck1lc3NhZ2UiLCJjYXRjaERiRXJyb3IiLCJ0cmlnZ2VyIiwiZXJyb3JPYmoiLCJtZXNzYWdlIiwic3RhY2siLCJhbGVydCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY29uZmlybSIsInByb21wdCIsImRlZmF1bHRWYWx1ZSIsIlBvdWNoREIiLCJnZXQiLCJ0aGVuIiwicHJlZnMiLCJjdXJyZW50RmlsZSIsImNhdGNoIiwicHV0IiwiY2hhbmdlcyIsImNoYW5nZSIsImlkIiwiZG9jIiwiZ2V0RmlsZUxpc3QiLCJmaWxlTGlzdCIsImdldEZpbGUiLCJkZWxldGVkIiwiZmlsZW5hbWUiLCJpbmNsdWRlRGF0YSIsImdldEN1cnJlbnRGaWxlbmFtZSIsImF0dGFjaG1lbnRzIiwibXVyZUZpbGUiLCJkYkVudHJ5IiwibWV0YWRhdGEiLCJfcmV2IiwiX2F0dGFjaG1lbnRzIiwiZGF0YSIsImJhc2U2NHN0cmluZyIsImdldEF0dGFjaG1lbnQiLCJhdG9iIiwiRE9NUGFyc2VyIiwicGFyc2VGcm9tU3RyaW5nIiwieG1sVGV4dCIsImV2ZW50TmFtZSIsImNhbGxiYWNrIiwiVkFMSURfRVZFTlRTIiwiRXJyb3IiLCJzaG93RGlhbG9nRnVuY3Rpb24iLCJhcHBOYW1lIiwibmV3VGFiIiwib3BlbiIsIm9wdGlvbnMiLCJibG9iT3JCYXNlNjRzdHJpbmciLCJPYmplY3QiLCJrZXlzIiwibGVuZ3RoIiwiZXhpc3RpbmdEb2MiLCJ1c2VyQ29uZmlybWF0aW9uIiwibmV3RG9jIiwiYWxsRG9jcyIsInJlc3VsdCIsInJvd3MiLCJmb3JFYWNoIiwiZCIsInB1c2giLCJ2YWx1ZSIsInJldiIsInJlYWRlciIsImZpbGVPYmoiLCJvbmxvYWRlbmQiLCJ0YXJnZXQiLCJvbmVycm9yIiwiZXJyb3IiLCJvbmFib3J0IiwiU0lHTkFMUyIsImNhbmNlbGxlZCIsInJlYWRBc1RleHQiLCJvcmlnaW5hbE5hbWUiLCJ0YWtlbk5hbWVzIiwiYWJvcnRGdW5jdGlvbiIsInBhdGgxIiwicGF0aDIiLCJkYXRhc2V0cyIsInJlc3VsdDEiLCJqc29ucGF0aCIsInJlc3VsdDIiLCJzZWxlY3RvcjEiLCJzZWxlY3RvcjIiLCJkb20iLCJxdWVyeVNlbGVjdG9yIiwiZXh0IiwidHlwZSIsInNwbGl0IiwiY29udGVudHMiLCJkYXRhbGliIiwicmVhZCIsInBhcnNlIiwiaW5mZXJQYXJzZXIiLCJwYXJzZXIiLCJnZXRNZXRhZGF0YSIsIkZpbGVSZWFkZXIiLCJyZWFkRmlsZSIsInZhbGlkYXRlRmlsZU5hbWUiLCJuYW1lIiwiYWJvcnQiLCJkYXRhRmlsZU5hbWUiLCJmaWxlVGV4dCIsInNhdmVGaWxlIiwiZXh0cmFjdE1ldGFkYXRhIiwiYmFzZTY0ZGF0YSIsImJ0b2EiLCJYTUxTZXJpYWxpemVyIiwic2VyaWFsaXplVG9TdHJpbmciLCJnZXRGaWxlUmV2aXNpb25zIiwicmV2aXNpb25EaWN0IiwiYWxsIiwiZmlsZW5hbWVQcm9taXNlIiwiY29udGVudHNQcm9taXNlIiwic2V0Q3VycmVudEZpbGUiLCJlcnJMaXN0IiwicHJvbWlzZVJlc3VsdHMiLCJyZW1vdmUiLCJfaWQiLCJyZW1vdmVSZXNwb25zZSIsInNlbGYiLCJkM2RvbSIsImQzIiwicm9vdEVsZW1lbnQiLCJyb290Iiwic2VsZWN0Iiwic2l6ZSIsIm5zRWxlbWVudCIsInNlbGVjdEFsbCIsImVhY2giLCJsaWJyYXJpZXMiLCJhdHRyIiwiZWwiLCJzY3JpcHQiLCJleHRyYWN0Q0RBVEEiLCJ0ZXh0Iiwic2NyaXB0cyIsIkpTT04iLCJiaW5kaW5nIiwiYmluZGluZ3MiLCJlbmNvZGluZyIsImVuY29kaW5ncyIsInN0ciIsImFkZCIsIm5ld0JpbmRpbmciLCJuZXdFbmNvZGluZyIsImV4aXQiLCJlbnRlciIsImFwcGVuZCIsIm1lcmdlIiwibGlicmFyeUxpc3QiLCJzY3JpcHRMaXN0Iiwic2NyaXB0c0VudGVyIiwiaW5uZXJIVE1MIiwibXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IiwiZGF0YXNldHNFbnRlciIsImtleSIsImh0bWwiLCJzdHJpbmdpZnkiLCJiaW5kaW5nc0VudGVyIiwiZGF0YVJvb3QiLCJzdmdSb290Iiwia2V5RnVuY3Rpb24iLCJlbmNvZGluZ3NFbnRlciIsImJpbmRpbmdJZCIsInNwZWMiLCJlbWJlZE1ldGFkYXRhIiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiQmxvYiIsImhyZWYiLCJ1cmwiLCJkb3dubG9hZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImEiLCJjbGljayIsInJldm9rZU9iamVjdFVSTCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsIk1vZGVsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7O0FBR0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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
