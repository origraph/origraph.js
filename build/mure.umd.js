(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('pouchdb'), require('uki')) :
	typeof define === 'function' && define.amd ? define(['pouchdb', 'uki'], factory) :
	(global.mure = factory(global.PouchDB,global.uki));
}(this, (function (PouchDB,uki) { 'use strict';

PouchDB = PouchDB && PouchDB.hasOwnProperty('default') ? PouchDB['default'] : PouchDB;

var appList = {
	"data-binder": { "name": "data-binder", "description": "A Mure app that is responsible for (re)binding data to graphics", "author": "Alex Bigelow" }
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
    if (!document || !window) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9tdXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGInO1xuaW1wb3J0IGFwcExpc3QgZnJvbSAnLi9hcHBMaXN0Lmpzb24nO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICd1a2knO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmFwcExpc3QgPSBhcHBMaXN0O1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGV2ZW4gYmVpbmcgdXNlZCBpbiB0aGUgYnJvd3NlciAobW9zdGx5IHVzZWZ1bCBmb3IgZ2V0dGluZ1xuICAgIC8vIGFjY2VzcyB0byB0aGUgYXBwbGlzdCBpbiBhbGwtYXBwcy1kZXYtc2VydmVyLmpzKVxuICAgIGlmICghZG9jdW1lbnQgfHwgIXdpbmRvdykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEZ1bmt5IHN0dWZmIHRvIGZpZ3VyZSBvdXQgaWYgd2UncmUgZGVidWdnaW5nIChpZiB0aGF0J3MgdGhlIGNhc2UsIHdlIHdhbnQgdG8gdXNlXG4gICAgLy8gbG9jYWxob3N0IGluc3RlYWQgb2YgdGhlIGdpdGh1YiBsaW5rIGZvciBhbGwgbGlua3MpXG4gICAgbGV0IHdpbmRvd1RpdGxlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RpdGxlJylbMF07XG4gICAgd2luZG93VGl0bGUgPSB3aW5kb3dUaXRsZSA/IHdpbmRvd1RpdGxlLnRleHRDb250ZW50IDogJyc7XG4gICAgdGhpcy5kZWJ1Z01vZGUgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnICYmIHdpbmRvd1RpdGxlLnN0YXJ0c1dpdGgoJ011cmUnKTtcblxuICAgIC8vIEZpZ3VyZSBvdXQgd2hpY2ggYXBwIHdlIGFyZSAob3IgbnVsbCBpZiB0aGUgbXVyZSBsaWJyYXJ5IGlzIGJlaW5nIHVzZWQgc29tZXdoZXJlIGVsc2UpXG4gICAgdGhpcy5jdXJyZW50QXBwID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnJlcGxhY2UoL1xcLy9nLCAnJyk7XG4gICAgaWYgKCF0aGlzLmFwcExpc3RbdGhpcy5jdXJyZW50QXBwXSkge1xuICAgICAgdGhpcy5jdXJyZW50QXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgLyBsb2FkIHRoZSBsb2NhbCBkYXRhYmFzZSBvZiBmaWxlc1xuICAgIHRoaXMubGFzdEZpbGUgPSBudWxsO1xuICAgIHRoaXMuZGIgPSB0aGlzLmdldE9ySW5pdERiKCk7XG5cbiAgICB0aGlzLmxvYWRVc2VyTGlicmFyaWVzID0gZmFsc2U7XG4gICAgdGhpcy5ydW5Vc2VyU2NyaXB0cyA9IGZhbHNlO1xuXG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGluZyAoYXBwcyBjYW4gbGlzdGVuIGZvciAvIGRpc3BsYXkgZXJyb3IgbWVzc2FnZXMgaW4gYWRkaXRpb24gdG8gdGhpcyk6XG4gICAgdGhpcy5vbignZXJyb3InLCBlcnJvck1lc3NhZ2UgPT4geyBjb25zb2xlLndhcm4oZXJyb3JNZXNzYWdlKTsgfSk7XG4gICAgdGhpcy5jYXRjaERiRXJyb3IgPSBlcnJvck9iaiA9PiB7IHRoaXMudHJpZ2dlcignZXJyb3InLCAnVW5leHBlY3RlZCBlcnJvciByZWFkaW5nIFBvdWNoREI6XFxuJyArIGVycm9yT2JqLnN0YWNrKTsgfTtcblxuICAgIC8vIGluIHRoZSBhYnNlbmNlIG9mIGEgY3VzdG9tIGRpYWxvZ3MsIGp1c3QgdXNlIHdpbmRvdy5wcm9tcHQ6XG4gICAgdGhpcy5wcm9tcHQgPSB3aW5kb3cucHJvbXB0O1xuICAgIHRoaXMuY29uZmlybSA9IHdpbmRvdy5jb25maXJtO1xuICB9XG4gIGdldE9ySW5pdERiICgpIHtcbiAgICBsZXQgZGIgPSBuZXcgUG91Y2hEQignbXVyZScpO1xuICAgIGRiLmdldCgndXNlclByZWZzJykudGhlbihwcmVmcyA9PiB7XG4gICAgICB0aGlzLmxhc3RGaWxlID0gcHJlZnMuY3VycmVudEZpbGU7XG4gICAgfSkuY2F0Y2goZXJyb3JPYmogPT4ge1xuICAgICAgaWYgKGVycm9yT2JqLm1lc3NhZ2UgPT09ICdtaXNzaW5nJykge1xuICAgICAgICByZXR1cm4gZGIucHV0KHtcbiAgICAgICAgICBfaWQ6ICd1c2VyUHJlZnMnLFxuICAgICAgICAgIGN1cnJlbnRGaWxlOiBudWxsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jYXRjaERiRXJyb3IoZXJyb3JPYmopO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGRiLmNoYW5nZXMoe1xuICAgICAgc2luY2U6ICdub3cnLFxuICAgICAgbGl2ZTogdHJ1ZSxcbiAgICAgIGluY2x1ZGVfZG9jczogdHJ1ZVxuICAgIH0pLm9uKCdjaGFuZ2UnLCBjaGFuZ2UgPT4ge1xuICAgICAgaWYgKGNoYW5nZS5pZCA9PT0gJ3VzZXJQcmVmcycpIHtcbiAgICAgICAgaWYgKHRoaXMubGFzdEZpbGUgIT09IGNoYW5nZS5kb2MuY3VycmVudEZpbGUpIHtcbiAgICAgICAgICAvLyBEaWZmZXJlbnQgZmlsZW5hbWUuLi4gYSBuZXcgb25lIHdhcyBvcGVuZWQsIG9yIHRoZSBjdXJyZW50IGZpbGUgd2FzIGRlbGV0ZWRcbiAgICAgICAgICB0aGlzLmxhc3RGaWxlID0gY2hhbmdlLmRvYy5jdXJyZW50RmlsZTtcbiAgICAgICAgICAvLyBUaGlzIHdpbGwgaGF2ZSBjaGFuZ2VkIHRoZSBjdXJyZW50IGZpbGUgbGlzdFxuICAgICAgICAgIHRoaXMuZ2V0RmlsZUxpc3QoKS50aGVuKGZpbGVMaXN0ID0+IHtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUxpc3RDaGFuZ2UnLCBmaWxlTGlzdCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2hldGhlciB3ZSBoYXZlIGEgbmV3IGZpbGUsIG9yIHRoZSBjdXJyZW50IG9uZSB3YXMgdXBkYXRlZCwgZmlyZSBhIGZpbGVDaGFuZ2UgZXZlbnRcbiAgICAgICAgdGhpcy5nZXRGaWxlKGNoYW5nZS5kb2MuY3VycmVudEZpbGUpLnRoZW4oZmlsZUJsb2IgPT4ge1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUNoYW5nZScsIGZpbGVCbG9iKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNoYW5nZS5kZWxldGVkICYmIGNoYW5nZS5pZCAhPT0gdGhpcy5sYXN0RmlsZSkge1xuICAgICAgICAvLyBJZiBhIGZpbGUgaXMgZGVsZXRlZCB0aGF0IHdhc24ndCBvcGVuZWQsIGl0IHdvbid0IGV2ZXIgY2F1c2UgYSBjaGFuZ2VcbiAgICAgICAgLy8gdG8gdXNlclByZWZzLiBTbyB3ZSBuZWVkIHRvIGZpcmUgZmlsZUxpc3RDaGFuZ2UgaW1tZWRpYXRlbHkuXG4gICAgICAgIHRoaXMuZ2V0RmlsZUxpc3QoKS50aGVuKGZpbGVMaXN0ID0+IHtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2ZpbGVMaXN0Q2hhbmdlJywgZmlsZUxpc3QpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KS5vbignZXJyb3InLCBlcnJvck9iaiA9PiB7XG4gICAgICB0aGlzLmNhdGNoRGJFcnJvcihlcnJvck9iaik7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRiO1xuICB9XG4gIHNldEN1cnJlbnRGaWxlIChmaWxlbmFtZSkge1xuICAgIHJldHVybiB0aGlzLmRiLmdldCgndXNlclByZWZzJykudGhlbihwcmVmcyA9PiB7XG4gICAgICBwcmVmcy5jdXJyZW50RmlsZSA9IGZpbGVuYW1lO1xuICAgICAgcmV0dXJuIHRoaXMuZGIucHV0KHByZWZzKTtcbiAgICB9KS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gIH1cbiAgZ2V0Q3VycmVudEZpbGVuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoJ3VzZXJQcmVmcycpLnRoZW4ocHJlZnMgPT4ge1xuICAgICAgcmV0dXJuIHByZWZzLmN1cnJlbnRGaWxlO1xuICAgIH0pO1xuICB9XG4gIGdldEZpbGUgKGZpbGVuYW1lKSB7XG4gICAgaWYgKGZpbGVuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5kYi5nZXRBdHRhY2htZW50KGZpbGVuYW1lLCBmaWxlbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgfVxuICB9XG4gIHNpZ25hbFN2Z0xvYWRlZCAobG9hZFVzZXJMaWJyYXJpZXNGdW5jLCBydW5Vc2VyU2NyaXB0c0Z1bmMpIHtcbiAgICAvLyBPbmx5IGxvYWQgdGhlIFNWRydzIGxpbmtlZCBsaWJyYXJpZXMgKyBlbWJlZGRlZCBzY3JpcHRzIGlmIHdlJ3ZlIGJlZW4gdG9sZCB0b1xuICAgIGxldCBjYWxsYmFjayA9IHRoaXMucnVuVXNlclNjcmlwdHMgPyBydW5Vc2VyU2NyaXB0c0Z1bmMgOiAoKSA9PiB7fTtcbiAgICBpZiAodGhpcy5sb2FkVXNlckxpYnJhcmllcykge1xuICAgICAgbG9hZFVzZXJMaWJyYXJpZXNGdW5jKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgdGhpcy50cmlnZ2VyKCdzdmdMb2FkZWQnKTtcbiAgfVxuICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICghTXVyZS5WQUxJRF9FVkVOVFNbZXZlbnROYW1lXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGV2ZW50IG5hbWU6ICcgKyBldmVudE5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci5vbihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cbiAgY3VzdG9taXplQ29uZmlybURpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5jb25maXJtID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZVByb21wdERpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5wcm9tcHQgPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgb3BlbkFwcCAoYXBwTmFtZSkge1xuICAgIHdpbmRvdy5vcGVuKCcvJyArIGFwcE5hbWUsICdfYmxhbmsnKTtcbiAgfVxuICBnZXRTdmdCbG9iIChmaWxlbmFtZSkge1xuICAgIHJldHVybiB0aGlzLmRiLmdldEF0dGFjaG1lbnQoZmlsZW5hbWUsIGZpbGVuYW1lKVxuICAgICAgLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxuICBzYXZlU3ZnQmxvYiAoZmlsZW5hbWUsIGJsb2IpIHtcbiAgICBsZXQgZGJFbnRyeSA9IHtcbiAgICAgIF9pZDogZmlsZW5hbWUsXG4gICAgICBfYXR0YWNobWVudHM6IHt9XG4gICAgfTtcbiAgICBkYkVudHJ5Ll9hdHRhY2htZW50c1tmaWxlbmFtZV0gPSB7XG4gICAgICBjb250ZW50X3R5cGU6IGJsb2IudHlwZSxcbiAgICAgIGRhdGE6IGJsb2JcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLmRiLmdldChmaWxlbmFtZSkudGhlbihleGlzdGluZ0RvYyA9PiB7XG4gICAgICAvLyB0aGUgZmlsZSBleGlzdHMuLi4gb3ZlcndyaXRlIHRoZSBkb2N1bWVudFxuICAgICAgZGJFbnRyeS5fcmV2ID0gZXhpc3RpbmdEb2MuX3JldjtcbiAgICAgIHJldHVybiB0aGlzLmRiLnB1dChkYkVudHJ5KTtcbiAgICB9KS5jYXRjaChlcnJvck9iaiA9PiB7XG4gICAgICBpZiAoZXJyb3JPYmoubWVzc2FnZSA9PT0gJ21pc3NpbmcnKSB7XG4gICAgICAgIC8vIHRoZSBmaWxlIGRvZXNuJ3QgZXhpc3QgeWV0Li4uXG4gICAgICAgIHJldHVybiB0aGlzLmRiLnB1dChkYkVudHJ5KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2F0Y2hEYkVycm9yKGVycm9yT2JqKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBnZXRGaWxlTGlzdCAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuYWxsRG9jcygpXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XG4gICAgICAgIGxldCByZXN1bHQgPSBbXTtcbiAgICAgICAgcmVzcG9uc2Uucm93cy5mb3JFYWNoKGQgPT4ge1xuICAgICAgICAgIGlmIChkLmlkICE9PSAndXNlclByZWZzJykge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goZC5pZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxuICBnZXRGaWxlUmV2aXNpb25zICgpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5hbGxEb2NzKClcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IHt9O1xuICAgICAgICByZXNwb25zZS5yb3dzLmZvckVhY2goZCA9PiB7XG4gICAgICAgICAgaWYgKGQuaWQgIT09ICd1c2VyUHJlZnMnKSB7XG4gICAgICAgICAgICByZXN1bHRbZC5pZF0gPSBkLnZhbHVlLnJldjtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICB9XG4gIHVwbG9hZFN2ZyAoZmlsZU9iaikge1xuICAgIGxldCBmaWxlbmFtZSA9IGZpbGVPYmoubmFtZTtcbiAgICByZXR1cm4gdGhpcy5nZXRGaWxlUmV2aXNpb25zKCkudGhlbihyZXZpc2lvbkRpY3QgPT4ge1xuICAgICAgLy8gQXNrIG11bHRpcGxlIHRpbWVzIGlmIHRoZSB1c2VyIGhhcHBlbnMgdG8gZW50ZXIgYW5vdGhlciBmaWxlbmFtZSB0aGF0IGFscmVhZHkgZXhpc3RzXG4gICAgICB3aGlsZSAocmV2aXNpb25EaWN0W2ZpbGVuYW1lXSkge1xuICAgICAgICBsZXQgbmV3TmFtZSA9IHRoaXMucHJvbXB0LmNhbGwod2luZG93LFxuICAgICAgICAgIGZpbGVPYmoubmFtZSArICcgYWxyZWFkeSBleGlzdHMuIFBpY2sgYSBuZXcgbmFtZSwgb3IgbGVhdmUgaXQgdGhlIHNhbWUgdG8gb3ZlcndyaXRlOicsXG4gICAgICAgICAgZmlsZU9iai5uYW1lKTtcbiAgICAgICAgaWYgKCFuZXdOYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSBpZiAobmV3TmFtZSA9PT0gZmlsZW5hbWUpIHtcbiAgICAgICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmlsZW5hbWUgPSBuZXdOYW1lO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmlsZW5hbWU7XG4gICAgfSkudGhlbihmaWxlbmFtZSA9PiB7XG4gICAgICBpZiAoZmlsZW5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2F2ZVN2Z0Jsb2IoZmlsZW5hbWUsIGZpbGVPYmopLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnNldEN1cnJlbnRGaWxlKGZpbGVuYW1lKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICB9XG4gIGRlbGV0ZVN2ZyAoZmlsZW5hbWUpIHtcbiAgICBpZiAodGhpcy5jb25maXJtLmNhbGwod2luZG93LCAnQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSAnICsgZmlsZW5hbWUgKyAnPycpKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwoW3RoaXMuZGIuZ2V0KGZpbGVuYW1lKSwgdGhpcy5nZXRDdXJyZW50RmlsZW5hbWUoKV0pLnRoZW4ocHJvbWlzZVJlc3VsdHMgPT4ge1xuICAgICAgICBsZXQgZXhpc3RpbmdEb2MgPSBwcm9taXNlUmVzdWx0c1swXTtcbiAgICAgICAgbGV0IGN1cnJlbnRGaWxlID0gcHJvbWlzZVJlc3VsdHNbMV07XG4gICAgICAgIHJldHVybiB0aGlzLmRiLnJlbW92ZShleGlzdGluZ0RvYy5faWQsIGV4aXN0aW5nRG9jLl9yZXYpXG4gICAgICAgICAgLnRoZW4ocmVtb3ZlUmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGVuYW1lID09PSBjdXJyZW50RmlsZSkge1xuICAgICAgICAgICAgICB0aGlzLnNldEN1cnJlbnRGaWxlKG51bGwpLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZW1vdmVSZXNwb25zZTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICB9XG4gIH1cbiAgZG93bmxvYWRTdmcgKGZpbGVuYW1lKSB7XG4gICAgdGhpcy5nZXRTdmdCbG9iKGZpbGVuYW1lKS50aGVuKGJsb2IgPT4ge1xuICAgICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rLi4uXG4gICAgICBsZXQgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICAgIGxldCB1cmwgPSB3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgIGEuaHJlZiA9IHVybDtcbiAgICAgIGEuZG93bmxvYWQgPSBmaWxlbmFtZTtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG4gICAgICBhLmNsaWNrKCk7XG4gICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgICAgYS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGEpO1xuICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxufVxuXG5NdXJlLlZBTElEX0VWRU5UUyA9IHtcbiAgZmlsZUxpc3RDaGFuZ2U6IHRydWUsXG4gIGZpbGVDaGFuZ2U6IHRydWUsXG4gIGVycm9yOiB0cnVlLFxuICBzdmdMb2FkZWQ6IHRydWVcbn07XG5cbmxldCBtdXJlID0gbmV3IE11cmUoKTtcbmV4cG9ydCBkZWZhdWx0IG11cmU7XG4iXSwibmFtZXMiOlsiTXVyZSIsImFwcExpc3QiLCJkb2N1bWVudCIsIndpbmRvdyIsIndpbmRvd1RpdGxlIiwiZ2V0RWxlbWVudHNCeVRhZ05hbWUiLCJ0ZXh0Q29udGVudCIsImRlYnVnTW9kZSIsImxvY2F0aW9uIiwiaG9zdG5hbWUiLCJzdGFydHNXaXRoIiwiY3VycmVudEFwcCIsInBhdGhuYW1lIiwicmVwbGFjZSIsImxhc3RGaWxlIiwiZGIiLCJnZXRPckluaXREYiIsImxvYWRVc2VyTGlicmFyaWVzIiwicnVuVXNlclNjcmlwdHMiLCJvbiIsIndhcm4iLCJlcnJvck1lc3NhZ2UiLCJjYXRjaERiRXJyb3IiLCJ0cmlnZ2VyIiwiZXJyb3JPYmoiLCJzdGFjayIsInByb21wdCIsImNvbmZpcm0iLCJQb3VjaERCIiwiZ2V0IiwidGhlbiIsInByZWZzIiwiY3VycmVudEZpbGUiLCJjYXRjaCIsIm1lc3NhZ2UiLCJwdXQiLCJjaGFuZ2VzIiwiY2hhbmdlIiwiaWQiLCJkb2MiLCJnZXRGaWxlTGlzdCIsImZpbGVMaXN0IiwiZ2V0RmlsZSIsImZpbGVCbG9iIiwiZGVsZXRlZCIsImZpbGVuYW1lIiwiZ2V0QXR0YWNobWVudCIsIlByb21pc2UiLCJyZXNvbHZlIiwibG9hZFVzZXJMaWJyYXJpZXNGdW5jIiwicnVuVXNlclNjcmlwdHNGdW5jIiwiY2FsbGJhY2siLCJldmVudE5hbWUiLCJWQUxJRF9FVkVOVFMiLCJFcnJvciIsInNob3dEaWFsb2dGdW5jdGlvbiIsImFwcE5hbWUiLCJvcGVuIiwiYmxvYiIsImRiRW50cnkiLCJfYXR0YWNobWVudHMiLCJ0eXBlIiwiX3JldiIsImV4aXN0aW5nRG9jIiwiYWxsRG9jcyIsInJlc3VsdCIsInJvd3MiLCJmb3JFYWNoIiwiZCIsInB1c2giLCJ2YWx1ZSIsInJldiIsImZpbGVPYmoiLCJuYW1lIiwiZ2V0RmlsZVJldmlzaW9ucyIsInJldmlzaW9uRGljdCIsIm5ld05hbWUiLCJjYWxsIiwic2F2ZVN2Z0Jsb2IiLCJzZXRDdXJyZW50RmlsZSIsImFsbCIsImdldEN1cnJlbnRGaWxlbmFtZSIsInByb21pc2VSZXN1bHRzIiwicmVtb3ZlIiwiX2lkIiwicmVtb3ZlUmVzcG9uc2UiLCJnZXRTdmdCbG9iIiwiYSIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsInVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsImhyZWYiLCJkb3dubG9hZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmV2b2tlT2JqZWN0VVJMIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwiTW9kZWwiLCJtdXJlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUlNQTs7O2tCQUNXOzs7OztVQUVSQyxPQUFMLEdBQWVBLE9BQWY7OztRQUdJLENBQUNDLFFBQUQsSUFBYSxDQUFDQyxNQUFsQixFQUEwQjs7Ozs7O1FBTXRCQyxjQUFjRixTQUFTRyxvQkFBVCxDQUE4QixPQUE5QixFQUF1QyxDQUF2QyxDQUFsQjtrQkFDY0QsY0FBY0EsWUFBWUUsV0FBMUIsR0FBd0MsRUFBdEQ7VUFDS0MsU0FBTCxHQUFpQkosT0FBT0ssUUFBUCxDQUFnQkMsUUFBaEIsS0FBNkIsV0FBN0IsSUFBNENMLFlBQVlNLFVBQVosQ0FBdUIsTUFBdkIsQ0FBN0Q7OztVQUdLQyxVQUFMLEdBQWtCUixPQUFPSyxRQUFQLENBQWdCSSxRQUFoQixDQUF5QkMsT0FBekIsQ0FBaUMsS0FBakMsRUFBd0MsRUFBeEMsQ0FBbEI7UUFDSSxDQUFDLE1BQUtaLE9BQUwsQ0FBYSxNQUFLVSxVQUFsQixDQUFMLEVBQW9DO1lBQzdCQSxVQUFMLEdBQWtCLElBQWxCOzs7O1VBSUdHLFFBQUwsR0FBZ0IsSUFBaEI7VUFDS0MsRUFBTCxHQUFVLE1BQUtDLFdBQUwsRUFBVjs7VUFFS0MsaUJBQUwsR0FBeUIsS0FBekI7VUFDS0MsY0FBTCxHQUFzQixLQUF0Qjs7O1VBR0tDLEVBQUwsQ0FBUSxPQUFSLEVBQWlCLHdCQUFn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
