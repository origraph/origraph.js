// There isn't an easy way to import this file as raw text using only ES6,
// so it's just simpler to comment the first and last lines when editing.

export default `
/* globals XMLHttpRequest, ActiveXObject */
/* eslint no-eval: 0 */
/* exported mureInteractivity */
var mureInteractivity = {
  getData: function () {
    return 'TODO';
  }
};

(function () {
  function load (url, callback) {
    let xhr;
    if (typeof XMLHttpRequest !== 'undefined') {
      xhr = new XMLHttpRequest();
    } else {
      let versions = [
        'MSXML2.XmlHttp.5.0',
        'MSXML2.XmlHttp.4.0',
        'MSXML2.XmlHttp.3.0',
        'MSXML2.XmlHttp.2.0',
        'Microsoft.XmlHttp'
      ];
      for (let i = 0, len = versions.length; i < len; i++) {
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

  function loadUserLibraries (callback) {
    // Grab all the mure:library tags, and load the referenced library (script src attributes
    // in SVG don't work, so we have to manually load remote libraries)
    let libraries = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'library'))
      .map(libraryTag => libraryTag.getAttribute('src'));

    let loadedLibraries = {};
    let onloadFired = false;

    libraries.forEach(function (script) {
      load(script, function (scriptText) {
        window.eval(scriptText);
        loadedLibraries[script] = true;
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
      let allLoaded = libraries.every(script => {
        return loadedLibraries[script];
      });
      if (allLoaded) {
        callback();
      }
    }
  }

  function runUserScripts () {
    Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'script'))
      .forEach(scriptTag => window.eval(scriptTag.textContent));
  }

  // Where we actually start executing stuff:
  if (!window.frameElement ||
      !window.frameElement.__suppressInteractivity__) {
    // We've been loaded directly into a browser, or embedded in a normal page;
    // load all the libraries, and then run all the scripts
    loadUserLibraries(runUserScripts);
  }
})();
`;
