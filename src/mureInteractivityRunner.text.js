/* globals XMLHttpRequest, ActiveXObject, Node */
/* eslint no-eval: 0 */
(function () {
  var nonAsyncScriptTexts = [];

  function load (url, callback) {
    var xhr;

    if (typeof XMLHttpRequest !== 'undefined') {
      xhr = new XMLHttpRequest();
    } else {
      var versions = [
        'MSXML2.XmlHttp.5.0',
        'MSXML2.XmlHttp.4.0',
        'MSXML2.XmlHttp.3.0',
        'MSXML2.XmlHttp.2.0',
        'Microsoft.XmlHttp'
      ];
      for (var i = 0, len = versions.length; i < len; i++) {
        try {
          xhr = new ActiveXObject(versions[i]);
          break;
        } catch (e) {}
      }
    }

    xhr.onreadystatechange = ensureReadiness;

    function ensureReadiness () {
      if (xhr.readyState < 4) {
        return;
      }

      if (xhr.status !== 200) {
        return;
      }

      // all is well
      if (xhr.readyState === 4) {
        callback(xhr.responseText);
      }
    }

    xhr.open('GET', url, true);
    xhr.send('');
  }

  function documentPositionComparator (a, b) {
    // function shamelessly adapted from https://stackoverflow.com/questions/31991235/sort-elements-by-document-order-in-javascript/31992057
    a = a.element;
    b = b.element;
    if (a === b) { return 0; }
    var position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      return -1;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
      return 1;
    } else { return 0; }
  }

  function loadUserLibraries (callback) {
    // Grab all the mure:library tags, and load the referenced library (script src attributes
    // in SVG don't work, so we have to manually load remote libraries)
    var libraries = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'library'))
      .map(element => {
        return {
          src: element.getAttribute('src'),
          async: (element.getAttribute('async') || 'true').toLocaleLowerCase() !== 'false',
          element: element
        };
      });

    var loadedLibraries = {};
    var onloadFired = false;

    libraries.forEach(function (library) {
      load(library.src, function (scriptText) {
        if (library.async) {
          window.eval(scriptText);
        } else {
          library.scriptText = scriptText;
          nonAsyncScriptTexts.push(library);
        }
        loadedLibraries[library.src] = true;
        attemptStart();
      });
    });

    window.onload = function () {
      onloadFired = true;
      attemptStart();
    };

    function attemptStart () {
      if (!onloadFired) {
        return;
      }
      var allLoaded = libraries.every(library => {
        return loadedLibraries[library.src];
      });
      if (allLoaded) {
        callback();
      }
    }
  }

  function runUserScripts () {
    var userScripts = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'script'))
      .map(element => {
        return {
          element: element,
          scriptText: element.textContent
        };
      });
    var allScripts = nonAsyncScriptTexts.concat(userScripts)
      .sort(documentPositionComparator);
    allScripts.forEach(scriptOrLibrary => {
      window.eval(scriptOrLibrary.scriptText);
    });
  }

  // Where we actually start executing stuff:
  if (!window.frameElement ||
      !window.frameElement.__suppressInteractivity__) {
    // We've been loaded directly into a browser, or embedded in a normal page;
    // load all the libraries, and then run all the scripts
    loadUserLibraries(runUserScripts);
  }
})();
