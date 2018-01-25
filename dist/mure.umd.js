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

// sneakily embed the interactivity-running script
const defaultSvgDoc = defaultSvgDocTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

class DocHandler {
  /**
   *
   */
  constructor () {
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
  xml2js (text) { return xmlJs.xml2js(text, this.xml2jsonSettings); }
  xml2json (text) { return xmlJs.xml2json(text, this.xml2jsonSettings); }
  json2xml (text) { return xmlJs.json2xml(text, this.json2xmlSettings); }
  js2xml (text) { return xmlJs.js2xml(text, this.json2xmlSettings); }
  standardize (testObj, standardObj) {
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
  iterate (obj, callback) {
    const nodes = [];
    nodes.push(obj);
    do {
      obj = nodes.shift();
      callback(obj);
      if (obj.elements) {
        nodes.unshift(...obj.elements);
      }
    } while (nodes.length > 0);
  }
  matchObject (obj, queryTokens) {
    // TODO
  }
  selectAll (root, selector) {
    const queryTokens = this.selectorParser.parse(selector);
    const elements = [];
    this.iterate(root, obj => {
      if (this.matchObject(obj, queryTokens)) {
        elements.push(obj);
      }
    });
    return elements;
  }
}

var docH = new DocHandler();

class Mure extends uki.Model {
  constructor (PouchDB$$1, d3$$1, d3n) {
    super();

    this.PouchDB = PouchDB$$1; // for Node.js, this will be pouchdb-node, not the regular one
    this.d3 = d3$$1; // for Node.js, this will be from d3-node, not the regular one
    this.d3n = d3n; // in Node, we also need access to the higher-level stuff from d3-node

    // Enumerations...
    this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

    // The namespace string for our custom XML
    this.NSString = 'http://mure-apps.github.io';
    this.d3.namespaces.mure = this.NSString;

    // Create / load the local database of files
    this.db = new this.PouchDB('mure');

    // default error handling (apps can listen for / display error messages in addition to this):
    this.on('error', errorMessage => {
      console.warn(errorMessage);
    });
    this.catchDbError = errorObj => {
      this.trigger('error', 'Unexpected error reading PouchDB: ' + errorObj.message + '\n' + errorObj.stack);
    };

    // in the absence of a custom dialogs, just use window.alert, window.confirm and window.prompt:
    this.alert = (message) => {
      return new Promise((resolve, reject) => {
        window.alert(message);
        resolve(true);
      });
    };
    this.confirm = (message) => {
      return new Promise((resolve, reject) => {
        resolve(window.confirm(message));
      });
    };
    this.prompt = (message, defaultValue) => {
      return new Promise((resolve, reject) => {
        resolve(window.prompt(message, defaultValue));
      });
    };
  }
  customizeAlertDialog (showDialogFunction) {
    this.alert = showDialogFunction;
  }
  customizeConfirmDialog (showDialogFunction) {
    this.confirm = showDialogFunction;
  }
  customizePromptDialog (showDialogFunction) {
    this.prompt = showDialogFunction;
  }
  openApp (appName, newTab) {
    if (newTab) {
      window.open('/' + appName, '_blank');
    } else {
      window.location.pathname = '/' + appName;
    }
  }
  getOrInitDb () {
    let db = new this.PouchDB('mure');
    let couchDbUrl = window.localStorage.getItem('couchDbUrl');
    if (couchDbUrl) {
      (async () => {
        let couchDb = new this.PouchDB(couchDbUrl, {skip_setup: true});
        return db.sync(couchDb, {live: true, retry: true});
      })().catch(err => {
        this.alert('Error syncing with ' + couchDbUrl + ': ' +
          err.message);
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
  getStandardizedDoc (docId) {
    return this.db.get(docId)
      .catch(err => {
        if (err.name === 'not_found') {
          return {
            _id: docId,
            currentSelection: null,
            contents: JSON.parse(docH.defaultJsonDoc)
          };
        } else {
          throw err;
        }
      }).then(doc => {
        return docH.standardize(doc);
      });
  }
  /**
   *
   */
  async downloadDoc (docId) {
    return this.db.get(docId)
      .then(doc => {
        let xmlText = docH.js2xml(doc.contents);

        // create a fake link to initiate the download
        let a = document.createElement('a');
        a.style = 'display:none';
        let url = window.URL.createObjectURL(new window.Blob([xmlText], { type: 'image/svg+xml' }));
        a.href = url;
        a.download = doc._id;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.parentNode.removeChild(a);
      });
  }
}

PouchDB.plugin(PouchAuthentication);

var module$1 = new Mure(PouchDB, d3);

return module$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9Eb2NIYW5kbGVyL2luZGV4LmpzIiwiLi4vc3JjL011cmUvaW5kZXguanMiLCIuLi9zcmMvbW9kdWxlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB4bWxKcyBmcm9tICd4bWwtanMnO1xuaW1wb3J0IHsgY3JlYXRlUGFyc2VyIH0gZnJvbSAnc2NhbHBlbCc7XG5pbXBvcnQgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IGZyb20gJy4vbXVyZUludGVyYWN0aXZpdHlSdW5uZXIudGV4dC5qcyc7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBkZWZhdWx0U3ZnRG9jVGVtcGxhdGUgZnJvbSAnLi9kZWZhdWx0LnRleHQuc3ZnJztcbmltcG9ydCBtaW5pbXVtU3ZnRG9jIGZyb20gJy4vbWluaW11bS50ZXh0LnN2Zyc7XG5cbi8vIHNuZWFraWx5IGVtYmVkIHRoZSBpbnRlcmFjdGl2aXR5LXJ1bm5pbmcgc2NyaXB0XG5jb25zdCBkZWZhdWx0U3ZnRG9jID0gZGVmYXVsdFN2Z0RvY1RlbXBsYXRlLnJlcGxhY2UoL1xcJHttdXJlSW50ZXJhY3Rpdml0eVJ1bm5lclRleHR9LywgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0KTtcblxuY2xhc3MgRG9jSGFuZGxlciB7XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHRoaXMuc2VsZWN0b3JQYXJzZXIgPSBjcmVhdGVQYXJzZXIoKTtcbiAgICAvLyB0b2RvOiBmb3IgZWZmaWNpZW5jeSwgSSBzaG91bGQgcmVuYW1lIGFsbCBvZiB4bWwtanMncyBkZWZhdWx0IChsZW5ndGh5ISkga2V5IG5hbWVzXG4gICAgdGhpcy5rZXlOYW1lcyA9IHt9O1xuICAgIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgJ2NvbXBhY3QnOiBmYWxzZSxcbiAgICAgICdpbmRlbnRDZGF0YSc6IHRydWVcbiAgICB9LCB0aGlzLmtleU5hbWVzKTtcbiAgICB0aGlzLnhtbDJqc29uU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICdjb21wYWN0JzogZmFsc2UsXG4gICAgICAnbmF0aXZlVHlwZSc6IHRydWUsXG4gICAgICAnYWx3YXlzQXJyYXknOiB0cnVlLFxuICAgICAgJ2FkZFBhcmVudCc6IHRydWVcbiAgICB9LCB0aGlzLmtleU5hbWVzKTtcbiAgICB0aGlzLmRlZmF1bHRKc29uRG9jID0gdGhpcy54bWwyanNvbihkZWZhdWx0U3ZnRG9jKTtcbiAgICB0aGlzLm1pbmltdW1Kc0RvYyA9IHRoaXMueG1sMmpzKG1pbmltdW1TdmdEb2MpO1xuICB9XG4gIHhtbDJqcyAodGV4dCkgeyByZXR1cm4geG1sSnMueG1sMmpzKHRleHQsIHRoaXMueG1sMmpzb25TZXR0aW5ncyk7IH1cbiAgeG1sMmpzb24gKHRleHQpIHsgcmV0dXJuIHhtbEpzLnhtbDJqc29uKHRleHQsIHRoaXMueG1sMmpzb25TZXR0aW5ncyk7IH1cbiAganNvbjJ4bWwgKHRleHQpIHsgcmV0dXJuIHhtbEpzLmpzb24yeG1sKHRleHQsIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyk7IH1cbiAganMyeG1sICh0ZXh0KSB7IHJldHVybiB4bWxKcy5qczJ4bWwodGV4dCwgdGhpcy5qc29uMnhtbFNldHRpbmdzKTsgfVxuICBzdGFuZGFyZGl6ZSAodGVzdE9iaiwgc3RhbmRhcmRPYmopIHtcbiAgICBpZiAoIXN0YW5kYXJkT2JqKSB7XG4gICAgICBpZiAoIXRlc3RPYmouX2lkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgYXQgbGVhc3Qgc3VwcGx5IGFuIGlkIHRvIHN0YW5kYXJkaXplIHRoZSBkb2N1bWVudCcpO1xuICAgICAgfVxuICAgICAgdGVzdE9iai5jdXJyZW50U2VsZWN0aW9uID0gdGVzdE9iai5jdXJyZW50U2VsZWN0aW9uIHx8IG51bGw7XG4gICAgICB0ZXN0T2JqLmNvbnRlbnRzID0gdGhpcy5zdGFuZGFyZGl6ZSh0ZXN0T2JqLmNvbnRlbnRzIHx8IHt9LCB0aGlzLm1pbmltdW1Kc0RvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE9cbiAgICB9XG4gICAgcmV0dXJuIHRlc3RPYmo7XG4gIH1cbiAgaXRlcmF0ZSAob2JqLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgbm9kZXMucHVzaChvYmopO1xuICAgIGRvIHtcbiAgICAgIG9iaiA9IG5vZGVzLnNoaWZ0KCk7XG4gICAgICBjYWxsYmFjayhvYmopO1xuICAgICAgaWYgKG9iai5lbGVtZW50cykge1xuICAgICAgICBub2Rlcy51bnNoaWZ0KC4uLm9iai5lbGVtZW50cyk7XG4gICAgICB9XG4gICAgfSB3aGlsZSAobm9kZXMubGVuZ3RoID4gMCk7XG4gIH1cbiAgbWF0Y2hPYmplY3QgKG9iaiwgcXVlcnlUb2tlbnMpIHtcbiAgICAvLyBUT0RPXG4gIH1cbiAgc2VsZWN0QWxsIChyb290LCBzZWxlY3Rvcikge1xuICAgIGNvbnN0IHF1ZXJ5VG9rZW5zID0gdGhpcy5zZWxlY3RvclBhcnNlci5wYXJzZShzZWxlY3Rvcik7XG4gICAgY29uc3QgZWxlbWVudHMgPSBbXTtcbiAgICB0aGlzLml0ZXJhdGUocm9vdCwgb2JqID0+IHtcbiAgICAgIGlmICh0aGlzLm1hdGNoT2JqZWN0KG9iaiwgcXVlcnlUb2tlbnMpKSB7XG4gICAgICAgIGVsZW1lbnRzLnB1c2gob2JqKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZWxlbWVudHM7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IERvY0hhbmRsZXIoKTtcbiIsImltcG9ydCB7IE1vZGVsIH0gZnJvbSAndWtpJztcbmltcG9ydCBkb2NIIGZyb20gJy4uL0RvY0hhbmRsZXIvaW5kZXguanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoUG91Y2hEQiwgZDMsIGQzbikge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLlBvdWNoREIgPSBQb3VjaERCOyAvLyBmb3IgTm9kZS5qcywgdGhpcyB3aWxsIGJlIHBvdWNoZGItbm9kZSwgbm90IHRoZSByZWd1bGFyIG9uZVxuICAgIHRoaXMuZDMgPSBkMzsgLy8gZm9yIE5vZGUuanMsIHRoaXMgd2lsbCBiZSBmcm9tIGQzLW5vZGUsIG5vdCB0aGUgcmVndWxhciBvbmVcbiAgICB0aGlzLmQzbiA9IGQzbjsgLy8gaW4gTm9kZSwgd2UgYWxzbyBuZWVkIGFjY2VzcyB0byB0aGUgaGlnaGVyLWxldmVsIHN0dWZmIGZyb20gZDMtbm9kZVxuXG4gICAgLy8gRW51bWVyYXRpb25zLi4uXG4gICAgdGhpcy5DT05URU5UX0ZPUk1BVFMgPSB7XG4gICAgICBleGNsdWRlOiAwLFxuICAgICAgYmxvYjogMSxcbiAgICAgIGRvbTogMixcbiAgICAgIGJhc2U2NDogM1xuICAgIH07XG5cbiAgICAvLyBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3Igb3VyIGN1c3RvbSBYTUxcbiAgICB0aGlzLk5TU3RyaW5nID0gJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJztcbiAgICB0aGlzLmQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBDcmVhdGUgLyBsb2FkIHRoZSBsb2NhbCBkYXRhYmFzZSBvZiBmaWxlc1xuICAgIHRoaXMuZGIgPSBuZXcgdGhpcy5Qb3VjaERCKCdtdXJlJyk7XG5cbiAgICAvLyBkZWZhdWx0IGVycm9yIGhhbmRsaW5nIChhcHBzIGNhbiBsaXN0ZW4gZm9yIC8gZGlzcGxheSBlcnJvciBtZXNzYWdlcyBpbiBhZGRpdGlvbiB0byB0aGlzKTpcbiAgICB0aGlzLm9uKCdlcnJvcicsIGVycm9yTWVzc2FnZSA9PiB7XG4gICAgICBjb25zb2xlLndhcm4oZXJyb3JNZXNzYWdlKTtcbiAgICB9KTtcbiAgICB0aGlzLmNhdGNoRGJFcnJvciA9IGVycm9yT2JqID0+IHtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCAnVW5leHBlY3RlZCBlcnJvciByZWFkaW5nIFBvdWNoREI6ICcgKyBlcnJvck9iai5tZXNzYWdlICsgJ1xcbicgKyBlcnJvck9iai5zdGFjayk7XG4gICAgfTtcblxuICAgIC8vIGluIHRoZSBhYnNlbmNlIG9mIGEgY3VzdG9tIGRpYWxvZ3MsIGp1c3QgdXNlIHdpbmRvdy5hbGVydCwgd2luZG93LmNvbmZpcm0gYW5kIHdpbmRvdy5wcm9tcHQ6XG4gICAgdGhpcy5hbGVydCA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB3aW5kb3cuYWxlcnQobWVzc2FnZSk7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMuY29uZmlybSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy5wcm9tcHQgPSAobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHdpbmRvdy5wcm9tcHQobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9XG4gIGN1c3RvbWl6ZUFsZXJ0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmFsZXJ0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZUNvbmZpcm1EaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuY29uZmlybSA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVQcm9tcHREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMucHJvbXB0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIG9wZW5BcHAgKGFwcE5hbWUsIG5ld1RhYikge1xuICAgIGlmIChuZXdUYWIpIHtcbiAgICAgIHdpbmRvdy5vcGVuKCcvJyArIGFwcE5hbWUsICdfYmxhbmsnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lID0gJy8nICsgYXBwTmFtZTtcbiAgICB9XG4gIH1cbiAgZ2V0T3JJbml0RGIgKCkge1xuICAgIGxldCBkYiA9IG5ldyB0aGlzLlBvdWNoREIoJ211cmUnKTtcbiAgICBsZXQgY291Y2hEYlVybCA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY291Y2hEYlVybCcpO1xuICAgIGlmIChjb3VjaERiVXJsKSB7XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgY291Y2hEYiA9IG5ldyB0aGlzLlBvdWNoREIoY291Y2hEYlVybCwge3NraXBfc2V0dXA6IHRydWV9KTtcbiAgICAgICAgcmV0dXJuIGRiLnN5bmMoY291Y2hEYiwge2xpdmU6IHRydWUsIHJldHJ5OiB0cnVlfSk7XG4gICAgICB9KSgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRoaXMuYWxlcnQoJ0Vycm9yIHN5bmNpbmcgd2l0aCAnICsgY291Y2hEYlVybCArICc6ICcgK1xuICAgICAgICAgIGVyci5tZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZGI7XG4gIH1cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBhcm91bmQgUG91Y2hEQi5nZXQoKSB0aGF0IGVuc3VyZXMgdGhhdCB0aGUgcmV0dXJuZWQgZG9jdW1lbnRcbiAgICogZXhpc3RzICh1c2VzIGRlZmF1bHQudGV4dC5zdmcgd2hlbiBpdCBkb2Vzbid0KSwgYW5kIGhhcyBhdCBsZWFzdCB0aGVcbiAgICogZWxlbWVudHMgc3BlY2lmaWVkIGJ5IG1pbmltdW0udGV4dC5zdmdcbiAgICogQHJldHVybiB7b2JqZWN0fSBBIFBvdWNoREIgZG9jdW1lbnRcbiAgICovXG4gIGdldFN0YW5kYXJkaXplZERvYyAoZG9jSWQpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoZG9jSWQpXG4gICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5uYW1lID09PSAnbm90X2ZvdW5kJykge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBfaWQ6IGRvY0lkLFxuICAgICAgICAgICAgY3VycmVudFNlbGVjdGlvbjogbnVsbCxcbiAgICAgICAgICAgIGNvbnRlbnRzOiBKU09OLnBhcnNlKGRvY0guZGVmYXVsdEpzb25Eb2MpXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pLnRoZW4oZG9jID0+IHtcbiAgICAgICAgcmV0dXJuIGRvY0guc3RhbmRhcmRpemUoZG9jKTtcbiAgICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWREb2MgKGRvY0lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuZ2V0KGRvY0lkKVxuICAgICAgLnRoZW4oZG9jID0+IHtcbiAgICAgICAgbGV0IHhtbFRleHQgPSBkb2NILmpzMnhtbChkb2MuY29udGVudHMpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIGZha2UgbGluayB0byBpbml0aWF0ZSB0aGUgZG93bmxvYWRcbiAgICAgICAgbGV0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICAgICAgbGV0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyB3aW5kb3cuQmxvYihbeG1sVGV4dF0sIHsgdHlwZTogJ2ltYWdlL3N2Zyt4bWwnIH0pKTtcbiAgICAgICAgYS5ocmVmID0gdXJsO1xuICAgICAgICBhLmRvd25sb2FkID0gZG9jLl9pZDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICAgICAgYS5jbGljaygpO1xuICAgICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgICAgICBhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSk7XG4gICAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNdXJlO1xuIiwiaW1wb3J0IE11cmUgZnJvbSAnLi9NdXJlL2luZGV4LmpzJztcbmltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGInO1xuaW1wb3J0IFBvdWNoQXV0aGVudGljYXRpb24gZnJvbSAncG91Y2hkYi1hdXRoZW50aWNhdGlvbic7XG5Qb3VjaERCLnBsdWdpbihQb3VjaEF1dGhlbnRpY2F0aW9uKTtcblxuZXhwb3J0IGRlZmF1bHQgbmV3IE11cmUoUG91Y2hEQiwgZDMpO1xuIl0sIm5hbWVzIjpbImNyZWF0ZVBhcnNlciIsIk1vZGVsIiwiUG91Y2hEQiIsImQzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBTUE7QUFDQSxNQUFNLGFBQWEsR0FBRyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsaUNBQWlDLEVBQUUsMkJBQTJCLENBQUMsQ0FBQzs7QUFFcEgsTUFBTSxVQUFVLENBQUM7Ozs7RUFJZixXQUFXLENBQUMsR0FBRztJQUNiLElBQUksQ0FBQyxjQUFjLEdBQUdBLG9CQUFZLEVBQUUsQ0FBQzs7SUFFckMsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7SUFDbkIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7TUFDcEMsU0FBUyxFQUFFLEtBQUs7TUFDaEIsYUFBYSxFQUFFLElBQUk7S0FDcEIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbEIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7TUFDcEMsU0FBUyxFQUFFLEtBQUs7TUFDaEIsWUFBWSxFQUFFLElBQUk7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
