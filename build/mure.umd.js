(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('pouchdb'), require('uki')) :
	typeof define === 'function' && define.amd ? define(['pouchdb', 'uki'], factory) :
	(global.mure = factory(global.PouchDB,global.uki));
}(this, (function (PouchDB,uki) { 'use strict';

PouchDB = PouchDB && PouchDB.hasOwnProperty('default') ? PouchDB['default'] : PouchDB;

var docs = { "name": "docs", "description": "The core app / landing page for Mure", "author": "Alex Bigelow", "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjAuMiwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDJ7b3BhY2l0eTowLjQ1O2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDN7b3BhY2l0eTowLjU1O2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDR7b3BhY2l0eTowLjI7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0NXtmaWxsOiM3NTcwQjM7fQo8L3N0eWxlPgo8cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjMzOS4zLDQwNy4zIDI1Niw1MDYgMTcyLjcsNDA3LjMgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDEiIHBvaW50cz0iMjE0LjEsMzcyLjIgMjk3LjUsMjczLjUgMzgwLjgsMzcyLjIgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDIiIHBvaW50cz0iNTA2LDI3My41IDQyMi43LDM3Mi4yIDMzOS4zLDI3My41ICIvPgo8cG9seWdvbiBjbGFzcz0ic3QzIiBwb2ludHM9IjI1NiwyMzguNSAzMzkuMywxMzkuOCA0MjIuNywyMzguNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MiIgcG9pbnRzPSIyNTYsMjczLjUgMTcyLjcsMzcyLjIgODkuMywyNzMuNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI2LDIzOC41IDg5LjMsMTM5LjggMTcyLjcsMjM4LjUgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDQiIHBvaW50cz0iMjk3LjUsMTM5LjggMjE0LjEsMjM4LjUgMTMwLjgsMTM5LjggIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDUiIHBvaW50cz0iMTcyLjcsMTA0LjcgMjU2LDYgMzM5LjMsMTA0LjcgIi8+Cjwvc3ZnPgo=" };
var appList = {
	docs: docs,
	"data-binder": { "name": "data-binder", "description": "A Mure app that is responsible for (re)binding data to graphics", "author": "Alex Bigelow", "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjEuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe29wYWNpdHk6MC42O2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6I0U2QUIwMjt9Cgkuc3Qye29wYWNpdHk6MC42O2ZpbGw6Izc1NzBCMzt9Cgkuc3Qze2ZpbGw6Izc1NzBCMzt9Cgkuc3Q0e29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMzt9Cgkuc3Q1e2ZpbGw6I0U2QUIwMjt9Cjwvc3R5bGU+CjxnPgoJPHBhdGggY2xhc3M9InN0MCIgZD0iTTExOS43LDI2Ny43di0yMy40YzU5LjYsMCw3Ny4zLTE5LjcsODMuMi0yNi4xYzE0LjEtMTUuNywxOS0zNy40LDI0LjItNjAuNGM1LjQtMjQsMTEtNDguOSwyNy45LTY4LjMKCQlDMjc0LjEsNjcuNiwzMDQuNiw1NywzNDguMyw1N3YyMy40Yy0zNi41LDAtNjEuMyw4LTc1LjgsMjQuNWMtMTMsMTQuOS0xNy43LDM1LjgtMjIuNyw1OGMtNS42LDI0LjktMTEuNCw1MC42LTI5LjYsNzAuOQoJCUMxOTkuNywyNTYuNiwxNjYuOCwyNjcuNywxMTkuNywyNjcuN3oiLz4KCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0xMTkuNyw0NTV2LTIzLjRjMzQuNCwwLDk0LjMtNDAuMiwxNjQuNC0xMTAuM2wxNi42LDE2LjZDMjQ3LjEsMzkxLjMsMTcyLjQsNDU1LDExOS43LDQ1NXoiLz4KCTxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik03LjUsMjk5LjVjMzIuNy0yNi43LDU2LjYtNDcuMiw1Ni42LTYzLjhjMC0xMS03LTE2LjItMTcuOC0xNi4yYy05LjEsMC0xNi4yLDUuOC0yMi44LDExLjZMNiwyMTMuMwoJCWMxMy4zLTEzLjUsMjUuNy0xOS43LDQ1LTE5LjdjMjYuMywwLDQ0LjcsMTUuOSw0NC43LDQwLjJjMCwxOS43LTIwLjUsNDEuNC00MC42LDU4LjRjNi44LTAuOCwxNi0xLjUsMjItMS41aDI0Ljd2MjcuOEg3LjVWMjk5LjV6IgoJCS8+Cgk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNOC4yLDEwMy45SDM5VjM5LjNIMTMuNFYxOC41YzE1LTIuOCwyNC44LTYuMywzNC43LTEyLjJoMjQuOHY5Ny43aDI2Ljh2MjcuMkg4LjJWMTAzLjl6Ii8+Cgk8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNi41LDQ4OC43bDE0LjgtMjAuNWM4LDYuOCwxOC4yLDExLjQsMjcuMywxMS40YzExLjgsMCwyMC4xLTMuOCwyMC4xLTExLjRjMC05LjEtNi42LTE0LjQtMzMuNC0xNC40VjQzMQoJCWMyMS42LDAsMjkuNi01LjMsMjkuNi0xMy43YzAtNy4yLTUuNy0xMS0xNS4yLTExYy04LjcsMC0xNS42LDMuNC0yMy45LDkuOUw5LjUsMzk2LjRjMTIuMy05LjksMjYuMi0xNS42LDQxLjgtMTUuNgoJCWMyNy43LDAsNDYuMywxMi4xLDQ2LjMsMzRjMCwxMS42LTcuOCwyMC4zLTIyLDI2djAuOGMxNC44LDQuMiwyNS44LDEzLjcsMjUuOCwyOC44YzAsMjIuOC0yMy4zLDM1LjMtNDkuMywzNS4zCgkJQzMxLjUsNTA1LjgsMTYsNDk5LjMsNi41LDQ4OC43eiIvPgoJPHJlY3QgeD0iMzA1LjQiIHk9IjE5MS42IiBjbGFzcz0ic3Q0IiB3aWR0aD0iMTI0LjkiIGhlaWdodD0iMTI0LjkiLz4KCTxjaXJjbGUgY2xhc3M9InN0MiIgY3g9IjQzNy43IiBjeT0iNzQuNSIgcj0iNjguMyIvPgoJPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI0MjcuMSwzNjkuMiAzNDguMyw1MDUuOCA1MDYsNTA1LjggCSIvPgoJPHBhdGggY2xhc3M9InN0NSIgZD0iTTM1My45LDQ0OS4yYy0zNC42LDAtNjUtNC41LTkwLjMtMTMuM2MtMjMuOC04LjMtNDMuOS0yMC43LTU5LjgtMzYuOGMtNTMtNTMuNy01MS44LTE0MC01MC45LTIwOS4zCgkJYzAuNi00NC44LDEuMi04Ny4yLTE0LTEwMi41Yy00LjYtNC43LTEwLjctNi44LTE5LjItNi44VjU3YzE0LjgsMCwyNi45LDQuNiwzNS45LDEzLjhjMjIsMjIuMywyMS40LDY3LjMsMjAuNywxMTkuMwoJCWMtMC45LDY4LjMtMiwxNDUuNyw0NC4yLDE5Mi41YzI4LjcsMjkuMSw3Mi4zLDQzLjIsMTMzLjUsNDMuMlY0NDkuMnoiLz4KPC9nPgo8L3N2Zz4K" }
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
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

    _this.loadUserLibraries = false;
    _this.runUserScripts = false;

    // default error handling (apps can listen for / display error messages in addition to this):
    _this.on('error', function (errorMessage) {
      console.warn(errorMessage);
    });
    _this.catchDbError = function (errorObj) {
      _this.trigger('error', 'Unexpected error reading PouchDB:\n' + errorObj.stack);
    };

    // in the absence of a custom dialogs, just use window.prompt:
    _this.prompt = window.prompt;
    _this.confirm = window.confirm;
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
            _this2.getFileList().then(function (fileList) {
              _this2.trigger('fileListChange', fileList);
            });
          }
          // Whether we have a new file, or the current one was updated, fire a fileChange event
          _this2.getFile(change.doc.currentFile).then(function (fileBlob) {
            _this2.trigger('fileChange', fileBlob);
          });
        } else if (change.deleted && change.id !== _this2.lastFile) {
          // If a file is deleted that wasn't opened, it won't ever cause a change
          // to userPrefs. So we need to fire fileListChange immediately.
          _this2.getFileList().then(function (fileList) {
            _this2.trigger('fileListChange', fileList);
          });
        }
      }).on('error', function (errorObj) {
        _this2.catchDbError(errorObj);
      });
      return db;
    }
  }, {
    key: 'setCurrentFile',
    value: function setCurrentFile(filename) {
      var _this3 = this;

      return this.db.get('userPrefs').then(function (prefs) {
        prefs.currentFile = filename;
        return _this3.db.put(prefs);
      }).catch(this.catchDbError);
    }
  }, {
    key: 'getCurrentFilename',
    value: function getCurrentFilename() {
      return this.db.get('userPrefs').then(function (prefs) {
        return prefs.currentFile;
      });
    }
  }, {
    key: 'getFile',
    value: function getFile(filename) {
      if (filename) {
        return this.db.getAttachment(filename, filename);
      } else {
        return Promise.resolve(null);
      }
    }
  }, {
    key: 'signalSvgLoaded',
    value: function signalSvgLoaded(loadUserLibrariesFunc, runUserScriptsFunc) {
      // Only load the SVG's linked libraries + embedded scripts if we've been told to
      var callback = this.runUserScripts ? runUserScriptsFunc : function () {};
      if (this.loadUserLibraries) {
        loadUserLibrariesFunc(callback);
      }
      this.trigger('svgLoaded');
    }
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
    value: function openApp(appName) {
      window.open('/' + appName, '_blank');
    }
  }, {
    key: 'getSvgBlob',
    value: function getSvgBlob(filename) {
      return this.db.getAttachment(filename, filename).catch(this.catchDbError);
    }
  }, {
    key: 'saveSvgBlob',
    value: function saveSvgBlob(filename, blob) {
      var _this4 = this;

      var dbEntry = {
        _id: filename,
        _attachments: {}
      };
      dbEntry._attachments[filename] = {
        content_type: blob.type,
        data: blob
      };
      return this.db.get(filename).then(function (existingDoc) {
        // the file exists... overwrite the document
        dbEntry._rev = existingDoc._rev;
        return _this4.db.put(dbEntry);
      }).catch(function (errorObj) {
        if (errorObj.message === 'missing') {
          // the file doesn't exist yet...
          return _this4.db.put(dbEntry);
        } else {
          _this4.catchDbError(errorObj);
        }
      });
    }
  }, {
    key: 'getFileList',
    value: function getFileList() {
      return this.db.allDocs().then(function (response) {
        var result = [];
        response.rows.forEach(function (d) {
          if (d.id !== 'userPrefs') {
            result.push(d.id);
          }
        });
        return result;
      }).catch(this.catchDbError);
    }
  }, {
    key: 'getFileRevisions',
    value: function getFileRevisions() {
      return this.db.allDocs().then(function (response) {
        var result = {};
        response.rows.forEach(function (d) {
          if (d.id !== 'userPrefs') {
            result[d.id] = d.value.rev;
          }
        });
        return result;
      }).catch(this.catchDbError);
    }
  }, {
    key: 'uploadSvg',
    value: function uploadSvg(fileObj) {
      var _this5 = this;

      var filename = fileObj.name;
      return this.getFileRevisions().then(function (revisionDict) {
        // Ask multiple times if the user happens to enter another filename that already exists
        while (revisionDict[filename]) {
          var newName = _this5.prompt.call(window, fileObj.name + ' already exists. Pick a new name, or leave it the same to overwrite:', fileObj.name);
          if (!newName) {
            return null;
          } else if (newName === filename) {
            return filename;
          } else {
            filename = newName;
          }
        }
        return filename;
      }).then(function (filename) {
        if (filename) {
          return _this5.saveSvgBlob(filename, fileObj).then(function () {
            return _this5.setCurrentFile(filename);
          });
        }
      }).catch(this.catchDbError);
    }
  }, {
    key: 'deleteSvg',
    value: function deleteSvg(filename) {
      var _this6 = this;

      if (this.confirm.call(window, 'Are you sure you want to delete ' + filename + '?')) {
        return Promise.all([this.db.get(filename), this.getCurrentFilename()]).then(function (promiseResults) {
          var existingDoc = promiseResults[0];
          var currentFile = promiseResults[1];
          return _this6.db.remove(existingDoc._id, existingDoc._rev).then(function (removeResponse) {
            if (filename === currentFile) {
              _this6.setCurrentFile(null).catch(_this6.catchDbError);
            }
            return removeResponse;
          });
        }).catch(this.catchDbError);
      }
    }
  }, {
    key: 'downloadSvg',
    value: function downloadSvg(filename) {
      this.getSvgBlob(filename).then(function (blob) {
        // create a fake link...
        var a = document.createElement('a');
        a.style = 'display:none';
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.parentNode.removeChild(a);
      }).catch(this.catchDbError);
    }
  }]);
  return Mure;
}(uki.Model);

Mure.VALID_EVENTS = {
  fileListChange: true,
  fileChange: true,
  error: true,
  svgLoaded: true
};

var mure = new Mure();

return mure;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9tdXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGInO1xuaW1wb3J0IGFwcExpc3QgZnJvbSAnLi9hcHBMaXN0Lmpzb24nO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICd1a2knO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmFwcExpc3QgPSBhcHBMaXN0O1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGV2ZW4gYmVpbmcgdXNlZCBpbiB0aGUgYnJvd3NlciAobW9zdGx5IHVzZWZ1bCBmb3IgZ2V0dGluZ1xuICAgIC8vIGFjY2VzcyB0byB0aGUgYXBwbGlzdCBpbiBhbGwtYXBwcy1kZXYtc2VydmVyLmpzKVxuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiB3aW5kb3cgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEZ1bmt5IHN0dWZmIHRvIGZpZ3VyZSBvdXQgaWYgd2UncmUgZGVidWdnaW5nIChpZiB0aGF0J3MgdGhlIGNhc2UsIHdlIHdhbnQgdG8gdXNlXG4gICAgLy8gbG9jYWxob3N0IGluc3RlYWQgb2YgdGhlIGdpdGh1YiBsaW5rIGZvciBhbGwgbGlua3MpXG4gICAgbGV0IHdpbmRvd1RpdGxlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RpdGxlJylbMF07XG4gICAgd2luZG93VGl0bGUgPSB3aW5kb3dUaXRsZSA/IHdpbmRvd1RpdGxlLnRleHRDb250ZW50IDogJyc7XG4gICAgdGhpcy5kZWJ1Z01vZGUgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnICYmIHdpbmRvd1RpdGxlLnN0YXJ0c1dpdGgoJ011cmUnKTtcblxuICAgIC8vIEZpZ3VyZSBvdXQgd2hpY2ggYXBwIHdlIGFyZSAob3IgbnVsbCBpZiB0aGUgbXVyZSBsaWJyYXJ5IGlzIGJlaW5nIHVzZWQgc29tZXdoZXJlIGVsc2UpXG4gICAgdGhpcy5jdXJyZW50QXBwID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnJlcGxhY2UoL1xcLy9nLCAnJyk7XG4gICAgaWYgKCF0aGlzLmFwcExpc3RbdGhpcy5jdXJyZW50QXBwXSkge1xuICAgICAgdGhpcy5jdXJyZW50QXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgLyBsb2FkIHRoZSBsb2NhbCBkYXRhYmFzZSBvZiBmaWxlc1xuICAgIHRoaXMubGFzdEZpbGUgPSBudWxsO1xuICAgIHRoaXMuZGIgPSB0aGlzLmdldE9ySW5pdERiKCk7XG5cbiAgICB0aGlzLmxvYWRVc2VyTGlicmFyaWVzID0gZmFsc2U7XG4gICAgdGhpcy5ydW5Vc2VyU2NyaXB0cyA9IGZhbHNlO1xuXG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGluZyAoYXBwcyBjYW4gbGlzdGVuIGZvciAvIGRpc3BsYXkgZXJyb3IgbWVzc2FnZXMgaW4gYWRkaXRpb24gdG8gdGhpcyk6XG4gICAgdGhpcy5vbignZXJyb3InLCBlcnJvck1lc3NhZ2UgPT4geyBjb25zb2xlLndhcm4oZXJyb3JNZXNzYWdlKTsgfSk7XG4gICAgdGhpcy5jYXRjaERiRXJyb3IgPSBlcnJvck9iaiA9PiB7IHRoaXMudHJpZ2dlcignZXJyb3InLCAnVW5leHBlY3RlZCBlcnJvciByZWFkaW5nIFBvdWNoREI6XFxuJyArIGVycm9yT2JqLnN0YWNrKTsgfTtcblxuICAgIC8vIGluIHRoZSBhYnNlbmNlIG9mIGEgY3VzdG9tIGRpYWxvZ3MsIGp1c3QgdXNlIHdpbmRvdy5wcm9tcHQ6XG4gICAgdGhpcy5wcm9tcHQgPSB3aW5kb3cucHJvbXB0O1xuICAgIHRoaXMuY29uZmlybSA9IHdpbmRvdy5jb25maXJtO1xuICB9XG4gIGdldE9ySW5pdERiICgpIHtcbiAgICBsZXQgZGIgPSBuZXcgUG91Y2hEQignbXVyZScpO1xuICAgIGRiLmdldCgndXNlclByZWZzJykudGhlbihwcmVmcyA9PiB7XG4gICAgICB0aGlzLmxhc3RGaWxlID0gcHJlZnMuY3VycmVudEZpbGU7XG4gICAgfSkuY2F0Y2goZXJyb3JPYmogPT4ge1xuICAgICAgaWYgKGVycm9yT2JqLm1lc3NhZ2UgPT09ICdtaXNzaW5nJykge1xuICAgICAgICByZXR1cm4gZGIucHV0KHtcbiAgICAgICAgICBfaWQ6ICd1c2VyUHJlZnMnLFxuICAgICAgICAgIGN1cnJlbnRGaWxlOiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jYXRjaERiRXJyb3IoZXJyb3JPYmopO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGRiLmNoYW5nZXMoe1xuICAgICAgc2luY2U6ICdub3cnLFxuICAgICAgbGl2ZTogdHJ1ZSxcbiAgICAgIGluY2x1ZGVfZG9jczogdHJ1ZVxuICAgIH0pLm9uKCdjaGFuZ2UnLCBjaGFuZ2UgPT4ge1xuICAgICAgaWYgKGNoYW5nZS5pZCA9PT0gJ3VzZXJQcmVmcycpIHtcbiAgICAgICAgaWYgKHRoaXMubGFzdEZpbGUgIT09IGNoYW5nZS5kb2MuY3VycmVudEZpbGUpIHtcbiAgICAgICAgICAvLyBEaWZmZXJlbnQgZmlsZW5hbWUuLi4gYSBuZXcgb25lIHdhcyBvcGVuZWQsIG9yIHRoZSBjdXJyZW50IGZpbGUgd2FzIGRlbGV0ZWRcbiAgICAgICAgICB0aGlzLmxhc3RGaWxlID0gY2hhbmdlLmRvYy5jdXJyZW50RmlsZTtcbiAgICAgICAgICAvLyBUaGlzIHdpbGwgaGF2ZSBjaGFuZ2VkIHRoZSBjdXJyZW50IGZpbGUgbGlzdFxuICAgICAgICAgIHRoaXMuZ2V0RmlsZUxpc3QoKS50aGVuKGZpbGVMaXN0ID0+IHtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUxpc3RDaGFuZ2UnLCBmaWxlTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2hldGhlciB3ZSBoYXZlIGEgbmV3IGZpbGUsIG9yIHRoZSBjdXJyZW50IG9uZSB3YXMgdXBkYXRlZCwgZmlyZSBhIGZpbGVDaGFuZ2UgZXZlbnRcbiAgICAgICAgdGhpcy5nZXRGaWxlKGNoYW5nZS5kb2MuY3VycmVudEZpbGUpLnRoZW4oZmlsZUJsb2IgPT4ge1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUNoYW5nZScsIGZpbGVCbG9iKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNoYW5nZS5kZWxldGVkICYmIGNoYW5nZS5pZCAhPT0gdGhpcy5sYXN0RmlsZSkge1xuICAgICAgICAvLyBJZiBhIGZpbGUgaXMgZGVsZXRlZCB0aGF0IHdhc24ndCBvcGVuZWQsIGl0IHdvbid0IGV2ZXIgY2F1c2UgYSBjaGFuZ2VcbiAgICAgICAgLy8gdG8gdXNlclByZWZzLiBTbyB3ZSBuZWVkIHRvIGZpcmUgZmlsZUxpc3RDaGFuZ2UgaW1tZWRpYXRlbHkuXG4gICAgICAgIHRoaXMuZ2V0RmlsZUxpc3QoKS50aGVuKGZpbGVMaXN0ID0+IHtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2ZpbGVMaXN0Q2hhbmdlJywgZmlsZUxpc3QpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KS5vbignZXJyb3InLCBlcnJvck9iaiA9PiB7XG4gICAgICB0aGlzLmNhdGNoRGJFcnJvcihlcnJvck9iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRiO1xuICB9XG4gIHNldEN1cnJlbnRGaWxlIChmaWxlbmFtZSkge1xuICAgIHJldHVybiB0aGlzLmRiLmdldCgndXNlclByZWZzJykudGhlbihwcmVmcyA9PiB7XG4gICAgICBwcmVmcy5jdXJyZW50RmlsZSA9IGZpbGVuYW1lO1xuICAgICAgcmV0dXJuIHRoaXMuZGIucHV0KHByZWZzKTtcbiAgICB9KS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gIH1cbiAgZ2V0Q3VycmVudEZpbGVuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoJ3VzZXJQcmVmcycpLnRoZW4ocHJlZnMgPT4ge1xuICAgICAgcmV0dXJuIHByZWZzLmN1cnJlbnRGaWxlO1xuICAgIH0pO1xuICB9XG4gIGdldEZpbGUgKGZpbGVuYW1lKSB7XG4gICAgaWYgKGZpbGVuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5kYi5nZXRBdHRhY2htZW50KGZpbGVuYW1lLCBmaWxlbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgfVxuICB9XG4gIHNpZ25hbFN2Z0xvYWRlZCAobG9hZFVzZXJMaWJyYXJpZXNGdW5jLCBydW5Vc2VyU2NyaXB0c0Z1bmMpIHtcbiAgICAvLyBPbmx5IGxvYWQgdGhlIFNWRydzIGxpbmtlZCBsaWJyYXJpZXMgKyBlbWJlZGRlZCBzY3JpcHRzIGlmIHdlJ3ZlIGJlZW4gdG9sZCB0b1xuICAgIGxldCBjYWxsYmFjayA9IHRoaXMucnVuVXNlclNjcmlwdHMgPyBydW5Vc2VyU2NyaXB0c0Z1bmMgOiAoKSA9PiB7fTtcbiAgICBpZiAodGhpcy5sb2FkVXNlckxpYnJhcmllcykge1xuICAgICAgbG9hZFVzZXJMaWJyYXJpZXNGdW5jKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdzdmdMb2FkZWQnKTtcbiAgfVxuICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICghTXVyZS5WQUxJRF9FVkVOVFNbZXZlbnROYW1lXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGV2ZW50IG5hbWU6ICcgKyBldmVudE5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci5vbihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cbiAgY3VzdG9taXplQ29uZmlybURpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5jb25maXJtID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZVByb21wdERpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5wcm9tcHQgPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgb3BlbkFwcCAoYXBwTmFtZSkge1xuICAgIHdpbmRvdy5vcGVuKCcvJyArIGFwcE5hbWUsICdfYmxhbmsnKTtcbiAgfVxuICBnZXRTdmdCbG9iIChmaWxlbmFtZSkge1xuICAgIHJldHVybiB0aGlzLmRiLmdldEF0dGFjaG1lbnQoZmlsZW5hbWUsIGZpbGVuYW1lKVxuICAgICAgLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxuICBzYXZlU3ZnQmxvYiAoZmlsZW5hbWUsIGJsb2IpIHtcbiAgICBsZXQgZGJFbnRyeSA9IHtcbiAgICAgIF9pZDogZmlsZW5hbWUsXG4gICAgICBfYXR0YWNobWVudHM6IHt9XG4gICAgfTtcbiAgICBkYkVudHJ5Ll9hdHRhY2htZW50c1tmaWxlbmFtZV0gPSB7XG4gICAgICBjb250ZW50X3R5cGU6IGJsb2IudHlwZSxcbiAgICAgIGRhdGE6IGJsb2JcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLmRiLmdldChmaWxlbmFtZSkudGhlbihleGlzdGluZ0RvYyA9PiB7XG4gICAgICAvLyB0aGUgZmlsZSBleGlzdHMuLi4gb3ZlcndyaXRlIHRoZSBkb2N1bWVudFxuICAgICAgZGJFbnRyeS5fcmV2ID0gZXhpc3RpbmdEb2MuX3JldjtcbiAgICAgIHJldHVybiB0aGlzLmRiLnB1dChkYkVudHJ5KTtcbiAgICB9KS5jYXRjaChlcnJvck9iaiA9PiB7XG4gICAgICBpZiAoZXJyb3JPYmoubWVzc2FnZSA9PT0gJ21pc3NpbmcnKSB7XG4gICAgICAgIC8vIHRoZSBmaWxlIGRvZXNuJ3QgZXhpc3QgeWV0Li4uXG4gICAgICAgIHJldHVybiB0aGlzLmRiLnB1dChkYkVudHJ5KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2F0Y2hEYkVycm9yKGVycm9yT2JqKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBnZXRGaWxlTGlzdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuYWxsRG9jcygpXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgICAgcmVzcG9uc2Uucm93cy5mb3JFYWNoKGQgPT4ge1xuICAgICAgICAgIGlmIChkLmlkICE9PSAndXNlclByZWZzJykge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goZC5pZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxuICBnZXRGaWxlUmV2aXNpb25zICgpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5hbGxEb2NzKClcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IHt9O1xuICAgICAgICByZXNwb25zZS5yb3dzLmZvckVhY2goZCA9PiB7XG4gICAgICAgICAgaWYgKGQuaWQgIT09ICd1c2VyUHJlZnMnKSB7XG4gICAgICAgICAgICByZXN1bHRbZC5pZF0gPSBkLnZhbHVlLnJldjtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICB9XG4gIHVwbG9hZFN2ZyAoZmlsZU9iaikge1xuICAgIGxldCBmaWxlbmFtZSA9IGZpbGVPYmoubmFtZTtcbiAgICByZXR1cm4gdGhpcy5nZXRGaWxlUmV2aXNpb25zKCkudGhlbihyZXZpc2lvbkRpY3QgPT4ge1xuICAgICAgLy8gQXNrIG11bHRpcGxlIHRpbWVzIGlmIHRoZSB1c2VyIGhhcHBlbnMgdG8gZW50ZXIgYW5vdGhlciBmaWxlbmFtZSB0aGF0IGFscmVhZHkgZXhpc3RzXG4gICAgICB3aGlsZSAocmV2aXNpb25EaWN0W2ZpbGVuYW1lXSkge1xuICAgICAgICBsZXQgbmV3TmFtZSA9IHRoaXMucHJvbXB0LmNhbGwod2luZG93LFxuICAgICAgICAgIGZpbGVPYmoubmFtZSArICcgYWxyZWFkeSBleGlzdHMuIFBpY2sgYSBuZXcgbmFtZSwgb3IgbGVhdmUgaXQgdGhlIHNhbWUgdG8gb3ZlcndyaXRlOicsXG4gICAgICAgICAgZmlsZU9iai5uYW1lKTtcbiAgICAgICAgaWYgKCFuZXdOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSBpZiAobmV3TmFtZSA9PT0gZmlsZW5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmlsZW5hbWUgPSBuZXdOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfSkudGhlbihmaWxlbmFtZSA9PiB7XG4gICAgICBpZiAoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2F2ZVN2Z0Jsb2IoZmlsZW5hbWUsIGZpbGVPYmopLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNldEN1cnJlbnRGaWxlKGZpbGVuYW1lKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICB9XG4gIGRlbGV0ZVN2ZyAoZmlsZW5hbWUpIHtcbiAgICBpZiAodGhpcy5jb25maXJtLmNhbGwod2luZG93LCAnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSAnICsgZmlsZW5hbWUgKyAnPycpKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwoW3RoaXMuZGIuZ2V0KGZpbGVuYW1lKSwgdGhpcy5nZXRDdXJyZW50RmlsZW5hbWUoKV0pLnRoZW4ocHJvbWlzZVJlc3VsdHMgPT4ge1xuICAgICAgICBsZXQgZXhpc3RpbmdEb2MgPSBwcm9taXNlUmVzdWx0c1swXTtcbiAgICAgICAgbGV0IGN1cnJlbnRGaWxlID0gcHJvbWlzZVJlc3VsdHNbMV07XG4gICAgICAgIHJldHVybiB0aGlzLmRiLnJlbW92ZShleGlzdGluZ0RvYy5faWQsIGV4aXN0aW5nRG9jLl9yZXYpXG4gICAgICAgICAgLnRoZW4ocmVtb3ZlUmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGVuYW1lID09PSBjdXJyZW50RmlsZSkge1xuICAgICAgICAgICAgICB0aGlzLnNldEN1cnJlbnRGaWxlKG51bGwpLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZW1vdmVSZXNwb25zZTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICB9XG4gIH1cbiAgZG93bmxvYWRTdmcgKGZpbGVuYW1lKSB7XG4gICAgdGhpcy5nZXRTdmdCbG9iKGZpbGVuYW1lKS50aGVuKGJsb2IgPT4ge1xuICAgICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rLi4uXG4gICAgICBsZXQgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICAgIGxldCB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgIGEuaHJlZiA9IHVybDtcbiAgICAgIGEuZG93bmxvYWQgPSBmaWxlbmFtZTtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG4gICAgICBhLmNsaWNrKCk7XG4gICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgICAgYS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGEpO1xuICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxufVxuXG5NdXJlLlZBTElEX0VWRU5UUyA9IHtcbiAgZmlsZUxpc3RDaGFuZ2U6IHRydWUsXG4gIGZpbGVDaGFuZ2U6IHRydWUsXG4gIGVycm9yOiB0cnVlLFxuICBzdmdMb2FkZWQ6IHRydWVcbn07XG5cbmxldCBtdXJlID0gbmV3IE11cmUoKTtcbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiTXVyZSIsImFwcExpc3QiLCJkb2N1bWVudCIsIndpbmRvdyIsInVuZGVmaW5lZCIsIndpbmRvd1RpdGxlIiwiZ2V0RWxlbWVudHNCeVRhZ05hbWUiLCJ0ZXh0Q29udGVudCIsImRlYnVnTW9kZSIsImxvY2F0aW9uIiwiaG9zdG5hbWUiLCJzdGFydHNXaXRoIiwiY3VycmVudEFwcCIsInBhdGhuYW1lIiwicmVwbGFjZSIsImxhc3RGaWxlIiwiZGIiLCJnZXRPckluaXREYiIsImxvYWRVc2VyTGlicmFyaWVzIiwicnVuVXNlclNjcmlwdHMiLCJvbiIsIndhcm4iLCJlcnJvck1lc3NhZ2UiLCJjYXRjaERiRXJyb3IiLCJ0cmlnZ2VyIiwiZXJyb3JPYmoiLCJzdGFjayIsInByb21wdCIsImNvbmZpcm0iLCJQb3VjaERCIiwiZ2V0IiwidGhlbiIsInByZWZzIiwiY3VycmVudEZpbGUiLCJjYXRjaCIsIm1lc3NhZ2UiLCJwdXQiLCJjaGFuZ2VzIiwiY2hhbmdlIiwiaWQiLCJkb2MiLCJnZXRGaWxlTGlzdCIsImZpbGVMaXN0IiwiZ2V0RmlsZSIsImZpbGVCbG9iIiwiZGVsZXRlZCIsImZpbGVuYW1lIiwiZ2V0QXR0YWNobWVudCIsIlByb21pc2UiLCJyZXNvbHZlIiwibG9hZFVzZXJMaWJyYXJpZXNGdW5jIiwicnVuVXNlclNjcmlwdHNGdW5jIiwiY2FsbGJhY2siLCJldmVudE5hbWUiLCJWQUxJRF9FVkVOVFMiLCJFcnJvciIsInNob3dEaWFsb2dGdW5jdGlvbiIsImFwcE5hbWUiLCJvcGVuIiwiYmxvYiIsImRiRW50cnkiLCJfYXR0YWNobWVudHMiLCJ0eXBlIiwiX3JldiIsImV4aXN0aW5nRG9jIiwiYWxsRG9jcyIsInJlc3VsdCIsInJvd3MiLCJmb3JFYWNoIiwiZCIsInB1c2giLCJ2YWx1ZSIsInJldiIsImZpbGVPYmoiLCJuYW1lIiwiZ2V0RmlsZVJldmlzaW9ucyIsInJldmlzaW9uRGljdCIsIm5ld05hbWUiLCJjYWxsIiwic2F2ZVN2Z0Jsb2IiLCJzZXRDdXJyZW50RmlsZSIsImFsbCIsImdldEN1cnJlbnRGaWxlbmFtZSIsInByb21pc2VSZXN1bHRzIiwicmVtb3ZlIiwiX2lkIiwicmVtb3ZlUmVzcG9uc2UiLCJnZXRTdmdCbG9iIiwiYSIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsInVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsImhyZWYiLCJkb3dubG9hZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmV2b2tlT2JqZWN0VVJMIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwiTW9kZWwiLCJtdXJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUlNQTs7O2tCQUNXOzs7OztVQUVSQyxPQUFMLEdBQWVBLE9BQWY7OztRQUdJLE9BQU9DLFFBQVAsS0FBb0IsV0FBcEIsSUFBbUMsUUFBT0MsTUFBUCx5Q0FBT0EsTUFBUCxPQUFrQkMsU0FBekQsRUFBb0U7Ozs7OztRQU1oRUMsY0FBY0gsU0FBU0ksb0JBQVQsQ0FBOEIsT0FBOUIsRUFBdUMsQ0FBdkMsQ0FBbEI7a0JBQ2NELGNBQWNBLFlBQVlFLFdBQTFCLEdBQXdDLEVBQXREO1VBQ0tDLFNBQUwsR0FBaUJMLE9BQU9NLFFBQVAsQ0FBZ0JDLFFBQWhCLEtBQTZCLFdBQTdCLElBQTRDTCxZQUFZTSxVQUFaLENBQXVCLE1BQXZCLENBQTdEOzs7VUFHS0MsVUFBTCxHQUFrQlQsT0FBT00sUUFBUCxDQUFnQkksUUFBaEIsQ0FBeUJDLE9BQXpCLENBQWlDLEtBQWpDLEVBQXdDLEVBQXhDLENBQWxCO1FBQ0ksQ0FBQyxNQUFLYixPQUFMLENBQWEsTUFBS1csVUFBbEIsQ0FBTCxFQUFvQztZQUM3QkEsVUFBTCxHQUFrQixJQUFsQjs7OztVQUlHRyxRQUFMLEdBQWdCLElBQWhCO1VBQ0tD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
