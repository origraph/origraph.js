(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('babel-polyfill'), require('d3'), require('jquery'), require('datalib'), require('md5'), require('jsonpath'), require('pouchdb'), require('uki')) :
	typeof define === 'function' && define.amd ? define(['babel-polyfill', 'd3', 'jquery', 'datalib', 'md5', 'jsonpath', 'pouchdb', 'uki'], factory) :
	(global.mure = factory(null,global.d3,global.jQuery,global.datalib,global.md5,global.jsonpath,global.PouchDB,global.uki));
}(this, (function (babelPolyfill,d3,jQuery,datalib,md5,jsonpath,PouchDB,uki) { 'use strict';

jQuery = jQuery && jQuery.hasOwnProperty('default') ? jQuery['default'] : jQuery;
datalib = datalib && datalib.hasOwnProperty('default') ? datalib['default'] : datalib;
md5 = md5 && md5.hasOwnProperty('default') ? md5['default'] : md5;
PouchDB = PouchDB && PouchDB.hasOwnProperty('default') ? PouchDB['default'] : PouchDB;

var docs = { "name": "docs", "description": "The core app / landing page for Mure", "author": "Alex Bigelow", "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjAuMiwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDJ7b3BhY2l0eTowLjQ1O2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDN7b3BhY2l0eTowLjU1O2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDR7b3BhY2l0eTowLjI7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0NXtmaWxsOiM3NTcwQjM7fQo8L3N0eWxlPgo8cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjMzOS4zLDQwNy4zIDI1Niw1MDYgMTcyLjcsNDA3LjMgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDEiIHBvaW50cz0iMjE0LjEsMzcyLjIgMjk3LjUsMjczLjUgMzgwLjgsMzcyLjIgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDIiIHBvaW50cz0iNTA2LDI3My41IDQyMi43LDM3Mi4yIDMzOS4zLDI3My41ICIvPgo8cG9seWdvbiBjbGFzcz0ic3QzIiBwb2ludHM9IjI1NiwyMzguNSAzMzkuMywxMzkuOCA0MjIuNywyMzguNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MiIgcG9pbnRzPSIyNTYsMjczLjUgMTcyLjcsMzcyLjIgODkuMywyNzMuNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI2LDIzOC41IDg5LjMsMTM5LjggMTcyLjcsMjM4LjUgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDQiIHBvaW50cz0iMjk3LjUsMTM5LjggMjE0LjEsMjM4LjUgMTMwLjgsMTM5LjggIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDUiIHBvaW50cz0iMTcyLjcsMTA0LjcgMjU2LDYgMzM5LjMsMTA0LjcgIi8+Cjwvc3ZnPgo=" };
var appList = {
	docs: docs,
	"encoding-manager": { "name": "encoding-manager", "description": "A Mure app that is responsible for learning / applying data constraints to graphics", "author": "Alex Bigelow", "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjEuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHdpZHRoPSI1MTJweCIgaGVpZ2h0PSI1MTJweCIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojNzU3MEIzO30KCS5zdDF7ZmlsbDojRTZBQjAyO30KCS5zdDJ7b3BhY2l0eTowLjE7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0M3tvcGFjaXR5OjAuOTtmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cgkuc3Q0e29wYWNpdHk6MC4yO2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDV7b3BhY2l0eTowLjg7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0NntvcGFjaXR5OjAuMztmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cgkuc3Q3e29wYWNpdHk6MC43O2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDh7b3BhY2l0eTowLjQ7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0OXtvcGFjaXR5OjAuNjtmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cgkuc3QxMHtvcGFjaXR5OjAuNTtmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cjwvc3R5bGU+Cjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iMjczLjksMzgxIDI3My45LDM0OS44IDE2NC41LDM0OS44IDE2NC41LDI3MS42IDIyMC4zLDI3MS42IDIyMC4zLDI0MC40IDE2NC41LDI0MC40IDE2NC41LDE2Mi4yIAoJMjIwLjMsMTYyLjIgMjIwLjMsMTMxIDE2NC41LDEzMSAxNjQuNSw1Mi45IDIyMC4zLDUyLjkgMjIwLjMsMjEuNiAxNjQuNSwyMS42IDE2NC41LDYgMTMzLjIsNiAxMzMuMiwyMS42IDc3LjQsMjEuNiA3Ny40LDUyLjkgCgkxMzMuMiw1Mi45IDEzMy4yLDEzMSA3Ny40LDEzMSA3Ny40LDE2Mi4yIDEzMy4yLDE2Mi4yIDEzMy4yLDI0MC40IDc3LjQsMjQwLjQgNzcuNCwyNzEuNiAxMzMuMiwyNzEuNiAxMzMuMiwzNDkuOCAyMy45LDM0OS44IAoJMjMuOSwzODEgMTMzLjIsMzgxIDEzMy4yLDQ1OS4xIDc3LjQsNDU5LjEgNzcuNCw0OTAuNCAxMzMuMiw0OTAuNCAxMzMuMiw1MDYgMTY0LjUsNTA2IDE2NC41LDQ5MC40IDIyMC4zLDQ5MC40IDIyMC4zLDQ1OS4xIAoJMTY0LjUsNDU5LjEgMTY0LjUsMzgxICIvPgo8cmVjdCB4PSIzMDkuNiIgeT0iNiIgY2xhc3M9InN0MSIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSI0MTYuNyIgeT0iNiIgY2xhc3M9InN0MiIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSIzMDkuNiIgeT0iMTEzLjEiIGNsYXNzPSJzdDMiIHdpZHRoPSI3MS40IiBoZWlnaHQ9IjcxLjQiLz4KPHJlY3QgeD0iNDE2LjciIHk9IjExMy4xIiBjbGFzcz0ic3Q0IiB3aWR0aD0iNzEuNCIgaGVpZ2h0PSI3MS40Ii8+CjxyZWN0IHg9IjMwOS42IiB5PSIyMjAuMyIgY2xhc3M9InN0NSIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSI0MTYuNyIgeT0iMjIwLjMiIGNsYXNzPSJzdDYiIHdpZHRoPSI3MS40IiBoZWlnaHQ9IjcxLjQiLz4KPHJlY3QgeD0iMzA5LjYiIHk9IjMyNy40IiBjbGFzcz0ic3Q3IiB3aWR0aD0iNzEuNCIgaGVpZ2h0PSI3MS40Ii8+CjxyZWN0IHg9IjQxNi43IiB5PSIzMjcuNCIgY2xhc3M9InN0OCIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSIzMDkuNiIgeT0iNDM0LjYiIGNsYXNzPSJzdDkiIHdpZHRoPSI3MS40IiBoZWlnaHQ9IjcxLjQiLz4KPHJlY3QgeD0iNDE2LjciIHk9IjQzNC42IiBjbGFzcz0ic3QxMCIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8L3N2Zz4K" },
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













var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

/* eslint no-useless-escape: 0 */
var Mure = function (_Model) {
  inherits(Mure, _Model);

  function Mure() {
    classCallCheck(this, Mure);

    var _this = possibleConstructorReturn(this, (Mure.__proto__ || Object.getPrototypeOf(Mure)).call(this));

    _this.appList = appList;
    // Check if we're even being used in the browser (mostly useful for getting
    // access to the applist in all-apps-dev-server.js)
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return possibleConstructorReturn(_this);
    }

    // Enumerations...
    _this.VALID_EVENTS = {
      fileListChange: {},
      fileChange: {},
      domChange: {},
      metadataChange: {},
      error: {}
    };

    _this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

    _this.SIGNALS = {
      cancelled: {}
    };

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
    key: 'on',
    value: function on(eventName, callback) {
      if (!this.VALID_EVENTS[eventName]) {
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
    key: 'getOrInitDb',
    value: function getOrInitDb() {
      var _this2 = this;

      var db = new PouchDB('mure');
      asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var prefs;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _this2.lastFile = null;
                _context.prev = 1;
                _context.next = 4;
                return db.get('userPrefs');

              case 4:
                prefs = _context.sent;

                if (!prefs.currentFile) {
                  _context.next = 9;
                  break;
                }

                _context.next = 8;
                return _this2.getFile(prefs.currentFile);

              case 8:
                _this2.lastFile = _context.sent;

              case 9:
                _context.next = 14;
                break;

              case 11:
                _context.prev = 11;
                _context.t0 = _context['catch'](1);

                if (_context.t0.message === 'missing') {
                  db.put({
                    _id: 'userPrefs',
                    currentFile: null
                  });
                } else {
                  _this2.catchDbError(_context.t0);
                }

              case 14:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this2, [[1, 11]]);
      }))();

      db.changes({
        since: 'now',
        live: true,
        include_docs: true
      }).on('change', function (change) {
        var fileChanged = void 0;
        var fileListChanged = void 0;
        var domChanged = void 0;
        var metadataChanged = void 0;

        if (change.deleted) {
          if (change.doc._id !== _this2.lastFile._id) {
            // Weird corner case: if we just deleted a file that wasn't the current one,
            // we won't ever get a change event on the userPrefs object; in that case,
            // we need to trigger the fileListChanged event immediately
            asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
              var fileList;
              return regeneratorRuntime.wrap(function _callee2$(_context2) {
                while (1) {
                  switch (_context2.prev = _context2.next) {
                    case 0:
                      _context2.next = 2;
                      return _this2.getFileList();

                    case 2:
                      fileList = _context2.sent;

                      _this2.trigger('fileListChange', fileList);

                    case 4:
                    case 'end':
                      return _context2.stop();
                  }
                }
              }, _callee2, _this2);
            }))().catch(_this2.catchDbError);
          }
          // Whether or not the deleted file was the currently open one, don't
          // trigger any other events; we want events to fire in context of the
          // new stuff getting loaded below
          return;
        }

        var currentFile = void 0;
        if (change.doc._id === 'userPrefs') {
          // We just changed the currently open file; trigger all the events
          fileChanged = fileListChanged = domChanged = metadataChanged = true;
          currentFile = _this2.lastFile;
        } else {
          if (_this2.lastFile === null || _this2.lastFile._id !== change.doc._id) {
            // The file itself is changing; DON'T actually trigger any of the events
            // because userPrefs is about to be changed as well... and things listening
            // to changes that care about checking userPrefs will want to do it with
            // its value updated
            fileChanged = fileListChanged = domChanged = metadataChanged = false;
          } else {
            fileChanged = false;
            domChanged = _this2.lastFile._attachments[_this2.lastFile._id].digest !== change.doc._attachments[change.doc._id].digest;
            metadataChanged = _this2.lastFile.metadataDigest !== change.doc.metadataDigest;
          }
          _this2.lastFile = currentFile = change.doc;
        }

        if (fileChanged) {
          _this2.trigger('fileChange', currentFile);
        }
        if (fileListChanged) {
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
        }
        if (domChanged) {
          asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
            var blob;
            return regeneratorRuntime.wrap(function _callee4$(_context4) {
              while (1) {
                switch (_context4.prev = _context4.next) {
                  case 0:
                    if (!currentFile) {
                      _context4.next = 6;
                      break;
                    }

                    _context4.next = 3;
                    return _this2.getFileAsBlob(currentFile._id);

                  case 3:
                    _context4.t0 = _context4.sent;
                    _context4.next = 7;
                    break;

                  case 6:
                    _context4.t0 = null;

                  case 7:
                    blob = _context4.t0;

                    _this2.trigger('domChange', blob);

                  case 9:
                  case 'end':
                    return _context4.stop();
                }
              }
            }, _callee4, _this2);
          }))();
        }
        if (metadataChanged) {
          _this2.trigger('metadataChange', currentFile ? currentFile.metadata : null);
        }
      }).on('error', function (errorObj) {
        _this2.catchDbError(errorObj);
      });
      return db;
    }
  }, {
    key: 'setCurrentFile',
    value: function () {
      var _ref5 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(filename) {
        var _this3 = this;

        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt('return', this.db.get('userPrefs').then(function (prefs) {
                  prefs.currentFile = filename;
                  return _this3.db.put(prefs);
                }).catch(this.catchDbError));

              case 1:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function setCurrentFile(_x) {
        return _ref5.apply(this, arguments);
      }

      return setCurrentFile;
    }()
  }, {
    key: 'getFile',
    value: function () {
      var _ref6 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(filename, contentFormat) {
        var _this4 = this;

        var pouchdbOptions;
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
                pouchdbOptions = {};

                if (contentFormat !== this.CONTENT_FORMATS.exclude) {
                  pouchdbOptions.attachments = true;
                  if (contentFormat === this.CONTENT_FORMATS.blob) {
                    pouchdbOptions.binary = true;
                  }
                }

                if (!(filename !== null)) {
                  _context6.next = 10;
                  break;
                }

                return _context6.abrupt('return', this.db.get(filename, pouchdbOptions || {}).then(function (fileObj) {
                  if (contentFormat === _this4.CONTENT_FORMATS.dom) {
                    var xmlText = window.atob(fileObj._attachments[fileObj._id].data);
                    var dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
                    fileObj._attachments[fileObj._id].dom = dom;
                  }
                  return fileObj;
                }));

              case 10:
                return _context6.abrupt('return', Promise.resolve(null));

              case 11:
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
    key: 'saveFile',
    value: function () {
      var _ref7 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(options) {
        var existingDoc, userConfirmation, newDoc;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.prev = 0;
                existingDoc = void 0;

                if (options.blobOrBase64string) {
                  _context7.next = 8;
                  break;
                }

                _context7.next = 5;
                return this.getFile(options.filename, this.CONTENT_FORMATS.exclude);

              case 5:
                existingDoc = _context7.sent;
                _context7.next = 17;
                break;

              case 8:
                _context7.next = 10;
                return this.getFile(options.filename, this.CONTENT_FORMATS.blob);

              case 10:
                existingDoc = _context7.sent;

                existingDoc._attachments[options.filename].data = options.blobOrBase64string;

                if (!((!options.metadata || Object.keys(options.metadata).length === 0) && Object.keys(existingDoc.metadata) > 0)) {
                  _context7.next = 17;
                  break;
                }

                _context7.next = 15;
                return this.confirm('It appears that the file you\'re uploading has lost its Mure metadata. ' + 'This is fairly common when you\'ve edited it with an external program.\n\n' + 'Restore the most recent metadata?');

              case 15:
                userConfirmation = _context7.sent;

                if (!userConfirmation) {
                  existingDoc.metadata = {};
                  existingDoc.metadataDigest = md5('{}');
                }

              case 17:
                if (options.metadata) {
                  existingDoc.metadata = options.metadata;
                  existingDoc.metadataDigest = md5(JSON.stringify(options.metadata));
                }
                return _context7.abrupt('return', this.db.put(existingDoc));

              case 21:
                _context7.prev = 21;
                _context7.t0 = _context7['catch'](0);

                if (!(_context7.t0.message === 'missing')) {
                  _context7.next = 30;
                  break;
                }

                // The file doesn't exist yet...
                newDoc = {
                  _id: options.filename,
                  _attachments: {},
                  metadata: options.metadata || {},
                  metadataDigest: options.metadata ? md5(JSON.stringify(options.metadata)) : md5('{}')
                };

                if (!options.blobOrBase64string) {
                  this.trigger('error', 'Attempted to save a file without contents!');
                }
                newDoc._attachments[options.filename] = {
                  content_type: 'image/svg+xml',
                  data: options.blobOrBase64string
                };
                return _context7.abrupt('return', this.db.put(newDoc));

              case 30:
                this.catchDbError(_context7.t0);
                return _context7.abrupt('return', Promise.reject(_context7.t0));

              case 32:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, this, [[0, 21]]);
      }));

      function saveFile(_x4) {
        return _ref7.apply(this, arguments);
      }

      return saveFile;
    }()
  }, {
    key: 'getMetadata',
    value: function () {
      var _ref8 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(filename) {
        var currentFile;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this.getFile(filename, this.CONTENT_FORMATS.exclude);

              case 2:
                currentFile = _context8.sent;
                return _context8.abrupt('return', currentFile !== null ? currentFile.metadata : null);

              case 4:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function getMetadata(_x5) {
        return _ref8.apply(this, arguments);
      }

      return getMetadata;
    }()
  }, {
    key: 'getCurrentFilename',
    value: function () {
      var _ref9 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                return _context9.abrupt('return', this.db.get('userPrefs').then(function (prefs) {
                  return prefs.currentFile;
                }));

              case 1:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function getCurrentFilename() {
        return _ref9.apply(this, arguments);
      }

      return getCurrentFilename;
    }()
  }, {
    key: 'getFileList',
    value: function () {
      var _ref10 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10() {
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                return _context10.abrupt('return', this.db.allDocs().then(function (response) {
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
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function getFileList() {
        return _ref10.apply(this, arguments);
      }

      return getFileList;
    }()
  }, {
    key: 'getFileRevisions',
    value: function () {
      var _ref11 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11() {
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                return _context11.abrupt('return', this.db.allDocs().then(function (response) {
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
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function getFileRevisions() {
        return _ref11.apply(this, arguments);
      }

      return getFileRevisions;
    }()
  }, {
    key: 'readFile',
    value: function () {
      var _ref12 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12(reader, fileObj) {
        var _this5 = this;

        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                return _context12.abrupt('return', new Promise(function (resolve, reject) {
                  reader.onloadend = function (xmlText) {
                    resolve(xmlText.target.result);
                  };
                  reader.onerror = function (error) {
                    reject(error);
                  };
                  reader.onabort = function () {
                    reject(_this5.SIGNALS.cancelled);
                  };
                  reader.readAsText(fileObj);
                }));

              case 1:
              case 'end':
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function readFile(_x6, _x7) {
        return _ref12.apply(this, arguments);
      }

      return readFile;
    }()
  }, {
    key: 'validateFileName',
    value: function () {
      var _ref13 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee13(originalName, takenNames, abortFunction) {
        var filename;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                // Ask multiple times if the user happens to enter another filename that already exists
                filename = originalName;

              case 1:
                if (!takenNames[filename]) {
                  _context13.next = 20;
                  break;
                }

                _context13.next = 4;
                return this.prompt(filename + ' already exists. Pick a new name, or leave it the same to overwrite:', filename);

              case 4:
                filename = _context13.sent;

                if (!(filename === null)) {
                  _context13.next = 10;
                  break;
                }

                if (abortFunction) {
                  abortFunction();
                }
                return _context13.abrupt('return', Promise.reject(this.SIGNALS.cancelled));

              case 10:
                if (!(filename === '')) {
                  _context13.next = 16;
                  break;
                }

                _context13.next = 13;
                return this.prompt('You must enter a file name (or click cancel to cancel the upload)');

              case 13:
                filename = _context13.sent;
                _context13.next = 18;
                break;

              case 16:
                if (!(filename === originalName)) {
                  _context13.next = 18;
                  break;
                }

                return _context13.abrupt('return', filename);

              case 18:
                _context13.next = 1;
                break;

              case 20:
                return _context13.abrupt('return', filename);

              case 21:
              case 'end':
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function validateFileName(_x8, _x9, _x10) {
        return _ref13.apply(this, arguments);
      }

      return validateFileName;
    }()
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
      var _ref14 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee14(fileObj) {
        var parser, errorObj, metadata, _errorObj, reader, dataFileName, fileText;

        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                parser = this.inferParser(fileObj);

                if (parser) {
                  _context14.next = 5;
                  break;
                }

                errorObj = new Error('Unknown data file type: ' + fileObj.type);

                this.trigger('error', errorObj);
                return _context14.abrupt('return', Promise.reject(errorObj));

              case 5:
                _context14.next = 7;
                return this.getMetadata();

              case 7:
                metadata = _context14.sent;

                if (!(metadata === null)) {
                  _context14.next = 12;
                  break;
                }

                _errorObj = new Error('Can\'t embed a data file without an SVG file already open');

                this.trigger('error', _errorObj);
                return _context14.abrupt('return', Promise.reject(_errorObj));

              case 12:
                metadata.datasets = metadata.datasets || {};

                reader = new window.FileReader();
                _context14.next = 16;
                return this.validateFileName(fileObj.name, metadata.datasets, reader.abort);

              case 16:
                dataFileName = _context14.sent;
                _context14.next = 19;
                return this.readFile(reader, fileObj);

              case 19:
                fileText = _context14.sent;


                metadata.datasets[dataFileName] = parser(fileText);
                return _context14.abrupt('return', this.saveFile({ metadata: metadata }));

              case 22:
              case 'end':
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function uploadDataset(_x11) {
        return _ref14.apply(this, arguments);
      }

      return uploadDataset;
    }()
  }, {
    key: 'uploadSvg',
    value: function () {
      var _ref15 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee15(fileObj) {
        var _this6 = this;

        var reader, contentsPromise, filenamePromise;
        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                reader = new window.FileReader();
                contentsPromise = this.readFile(reader, fileObj).then(function (xmlText) {
                  var dom = new window.DOMParser().parseFromString(xmlText, 'image/svg+xml');
                  var contents = { metadata: _this6.extractMetadata(dom) };
                  contents.base64data = window.btoa(new window.XMLSerializer().serializeToString(dom));
                  return contents;
                });
                filenamePromise = this.getFileRevisions().catch(this.catchDbError).then(function (revisionDict) {
                  return _this6.validateFileName(fileObj.name, revisionDict, reader.abort);
                });
                return _context15.abrupt('return', Promise.all([filenamePromise, contentsPromise]).then(function (_ref16) {
                  var _ref17 = slicedToArray(_ref16, 2),
                      filename = _ref17[0],
                      contents = _ref17[1];

                  return _this6.saveFile({
                    filename: filename,
                    blobOrBase64string: contents.base64data,
                    metadata: contents.metadata
                  }).then(function () {
                    return _this6.setCurrentFile(filename);
                  });
                }).catch(function (errList) {
                  if (errList[0] !== _this6.SIGNALS.cancelled || errList[1] !== _this6.SIGNALS.cancelled) {
                    // cancelling is not a problem; only reject if something else happened
                    return Promise.reject(errList);
                  }
                }));

              case 4:
              case 'end':
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function uploadSvg(_x12) {
        return _ref15.apply(this, arguments);
      }

      return uploadSvg;
    }()
  }, {
    key: 'deleteSvg',
    value: function () {
      var _ref18 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee16(filename) {
        var _this7 = this;

        var userConfirmation, currentFile;
        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                _context16.next = 2;
                return this.confirm('Are you sure you want to delete ' + filename + '?');

              case 2:
                userConfirmation = _context16.sent;

                if (!userConfirmation) {
                  _context16.next = 10;
                  break;
                }

                _context16.next = 6;
                return this.getFile(filename, this.CONTENT_FORMATS.exclude);

              case 6:
                currentFile = _context16.sent;
                return _context16.abrupt('return', this.db.remove(currentFile._id, currentFile._rev).then(function (removeResponse) {
                  if (_this7.lastFile && filename === _this7.lastFile._id) {
                    return _this7.setCurrentFile(null).then(function () {
                      return removeResponse;
                    });
                  }
                  return removeResponse;
                }));

              case 10:
                return _context16.abrupt('return', Promise.resolve(false));

              case 11:
              case 'end':
                return _context16.stop();
            }
          }
        }, _callee16, this);
      }));

      function deleteSvg(_x13) {
        return _ref18.apply(this, arguments);
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
          dataExpression: '(d, k) => k',
          svgExpression: '(el, i) => i'
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
        bindingId: '',
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

      return dom;
    }
  }, {
    key: 'downloadSvg',
    value: function () {
      var _ref19 = asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee17(filename) {
        var fileEntry, dom, xmlText, a, url;
        return regeneratorRuntime.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                _context17.next = 2;
                return this.getFile(filename, this.CONTENT_FORMATS.dom);

              case 2:
                fileEntry = _context17.sent;

                if (fileEntry) {
                  _context17.next = 5;
                  break;
                }

                throw new Error('Can\'t download non-existent file: ' + filename);

              case 5:
                dom = this.embedMetadata(fileEntry._attachments[fileEntry._id].dom, fileEntry.metadata);
                xmlText = new window.XMLSerializer().serializeToString(dom).replace(/&lt;!\[CDATA\[/g, '<!\[CDATA\[').replace(/]]&gt;/g, ']]>');

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

              case 16:
              case 'end':
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));

      function downloadSvg(_x14) {
        return _ref19.apply(this, arguments);
      }

      return downloadSvg;
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
    key: 'getMatches',
    value: function getMatches(metadata, dom) {
      var _this8 = this;

      var connections = [];
      if (metadata && metadata.bindings && metadata.datasets && dom) {
        d3.values(metadata.bindings).forEach(function (binding) {
          if (!binding.dataRoot || !binding.svgRoot || !binding.keyFunction || !binding.keyFunction.dataExpression) {
            return;
          }
          /* eslint-disable no-eval */
          var dataExpression = (0, eval)(binding.keyFunction.dataExpression);
          /* eslint-enable no-eval */

          var dataRoot = jsonpath.query(metadata.datasets, binding.dataRoot)[0];
          var dataItems = void 0;
          if (dataRoot instanceof Array) {
            dataItems = dataRoot.map(function (d, i) {
              return {
                key: i,
                value: d
              };
            });
          } else if ((typeof dataRoot === 'undefined' ? 'undefined' : _typeof(dataRoot)) === 'object') {
            dataItems = d3.entries(dataRoot);
          } else {
            return; // a leaf was picked as a root... no connections possible
          }

          var svgRoot = dom.querySelector(binding.svgRoot);
          var svgItems = Array.from(svgRoot.children);

          dataItems.forEach(function (dataItem) {
            var dataKeyValue = dataExpression(dataItem.value, dataItem.key);
            if (binding.keyFunction.customMapping) {
              connections.push.apply(connections, toConsumableArray(_this8.getManualConnections(binding, dataKeyValue, dataItem.value, svgItems)));
            } else if (binding.keyFunction.svgExpression !== undefined) {
              connections.push.apply(connections, toConsumableArray(_this8.getExpressionConnections(binding, dataKeyValue, dataItem.value, svgItems)));
            } else {
              connections.push.apply(connections, toConsumableArray(_this8.getInferredConnections(binding, dataKeyValue, dataItem.value, svgItems)));
            }
          });
        });
      }
      return connections;
    }
  }, {
    key: 'getManualConnections',
    value: function getManualConnections(binding, dataKeyValue, dataItem, svgItems) {
      // TODO
      return [];
    }
  }, {
    key: 'getExpressionConnections',
    value: function getExpressionConnections(binding, dataKeyValue, dataItem, svgItems) {
      /* eslint-disable no-eval */
      var svgExpression = (0, eval)(binding.keyFunction.svgExpression);
      /* eslint-enable no-eval */
      var connections = [];
      svgItems.forEach(function (svgItem, itemIndex) {
        if (svgExpression(svgItem, itemIndex, d3.select(svgItem), jQuery(svgItem)) === dataKeyValue) {
          connections.push({
            dataItem: dataItem,
            svgItem: svgItem
          });
        }
      });
      return connections;
    }
  }, {
    key: 'getInferredConnections',
    value: function getInferredConnections(binding, dataKeyValue, dataItem, svgItems) {
      // TODO
      return [];
    }
  }]);
  return Mure;
}(uki.Model);

var mure = new Mure();

return mure;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9tdXJlSW50ZXJhY3Rpdml0eVJ1bm5lci5qcyIsIi4uL3NyYy9tdXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIFRoZXJlIGlzbid0IGFuIGVhc3kgd2F5IHRvIGltcG9ydCB0aGlzIGZpbGUgYXMgcmF3IHRleHQgdXNpbmcgb25seSBFUzYsXG4vLyBzbyBpdCdzIGp1c3Qgc2ltcGxlciB0byBjb21tZW50IHRoZSBmaXJzdCBhbmQgbGFzdCBsaW5lcyB3aGVuIGVkaXRpbmcuXG5cbmV4cG9ydCBkZWZhdWx0IGBcbi8qIGdsb2JhbHMgWE1MSHR0cFJlcXVlc3QsIEFjdGl2ZVhPYmplY3QgKi9cbi8qIGVzbGludCBuby1ldmFsOiAwICovXG4vKiBleHBvcnRlZCBtdXJlSW50ZXJhY3Rpdml0eSAqL1xudmFyIG11cmVJbnRlcmFjdGl2aXR5ID0ge1xuICBnZXREYXRhOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICdUT0RPJztcbiAgfVxufTtcblxuKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gbG9hZCAodXJsLCBjYWxsYmFjaykge1xuICAgIGxldCB4aHI7XG4gICAgaWYgKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgdmVyc2lvbnMgPSBbXG4gICAgICAgICdNU1hNTDIuWG1sSHR0cC41LjAnLFxuICAgICAgICAnTVNYTUwyLlhtbEh0dHAuNC4wJyxcbiAgICAgICAgJ01TWE1MMi5YbWxIdHRwLjMuMCcsXG4gICAgICAgICdNU1hNTDIuWG1sSHR0cC4yLjAnLFxuICAgICAgICAnTWljcm9zb2Z0LlhtbEh0dHAnXG4gICAgICBdO1xuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHZlcnNpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgeGhyID0gbmV3IEFjdGl2ZVhPYmplY3QodmVyc2lvbnNbaV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBlbnN1cmVSZWFkaW5lc3M7XG5cbiAgICBmdW5jdGlvbiBlbnN1cmVSZWFkaW5lc3MgKCkge1xuICAgICAgaWYgKHhoci5yZWFkeVN0YXRlIDwgNCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh4aHIuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBhbGwgaXMgd2VsbFxuICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgIGNhbGxiYWNrKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHhoci5zZW5kKCcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGxvYWRVc2VyTGlicmFyaWVzIChjYWxsYmFjaykge1xuICAgIC8vIEdyYWIgYWxsIHRoZSBtdXJlOmxpYnJhcnkgdGFncywgYW5kIGxvYWQgdGhlIHJlZmVyZW5jZWQgbGlicmFyeSAoc2NyaXB0IHNyYyBhdHRyaWJ1dGVzXG4gICAgLy8gaW4gU1ZHIGRvbid0IHdvcmssIHNvIHdlIGhhdmUgdG8gbWFudWFsbHkgbG9hZCByZW1vdGUgbGlicmFyaWVzKVxuICAgIGxldCBsaWJyYXJpZXMgPSBBcnJheS5mcm9tKGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lTlMoJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJywgJ2xpYnJhcnknKSlcbiAgICAgIC5tYXAobGlicmFyeVRhZyA9PiBsaWJyYXJ5VGFnLmdldEF0dHJpYnV0ZSgnc3JjJykpO1xuXG4gICAgbGV0IGxvYWRlZExpYnJhcmllcyA9IHt9O1xuICAgIGxldCBvbmxvYWRGaXJlZCA9IGZhbHNlO1xuXG4gICAgbGlicmFyaWVzLmZvckVhY2goZnVuY3Rpb24gKHNjcmlwdCkge1xuICAgICAgbG9hZChzY3JpcHQsIGZ1bmN0aW9uIChzY3JpcHRUZXh0KSB7XG4gICAgICAgIHdpbmRvdy5ldmFsKHNjcmlwdFRleHQpO1xuICAgICAgICBsb2FkZWRMaWJyYXJpZXNbc2NyaXB0XSA9IHRydWU7XG4gICAgICAgIGF0dGVtcHRTdGFydCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgb25sb2FkRmlyZWQgPSB0cnVlO1xuICAgICAgYXR0ZW1wdFN0YXJ0KCk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGF0dGVtcHRTdGFydCAoKSB7XG4gICAgICBpZiAoIW9ubG9hZEZpcmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGxldCBhbGxMb2FkZWQgPSBsaWJyYXJpZXMuZXZlcnkoc2NyaXB0ID0+IHtcbiAgICAgICAgcmV0dXJuIGxvYWRlZExpYnJhcmllc1tzY3JpcHRdO1xuICAgICAgfSk7XG4gICAgICBpZiAoYWxsTG9hZGVkKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcnVuVXNlclNjcmlwdHMgKCkge1xuICAgIEFycmF5LmZyb20oZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWVOUygnaHR0cDovL211cmUtYXBwcy5naXRodWIuaW8nLCAnc2NyaXB0JykpXG4gICAgICAuZm9yRWFjaChzY3JpcHRUYWcgPT4gd2luZG93LmV2YWwoc2NyaXB0VGFnLnRleHRDb250ZW50KSk7XG4gIH1cblxuICAvLyBXaGVyZSB3ZSBhY3R1YWxseSBzdGFydCBleGVjdXRpbmcgc3R1ZmY6XG4gIGlmICghd2luZG93LmZyYW1lRWxlbWVudCB8fFxuICAgICAgIXdpbmRvdy5mcmFtZUVsZW1lbnQuX19zdXBwcmVzc0ludGVyYWN0aXZpdHlfXykge1xuICAgIC8vIFdlJ3ZlIGJlZW4gbG9hZGVkIGRpcmVjdGx5IGludG8gYSBicm93c2VyLCBvciBlbWJlZGRlZCBpbiBhIG5vcm1hbCBwYWdlO1xuICAgIC8vIGxvYWQgYWxsIHRoZSBsaWJyYXJpZXMsIGFuZCB0aGVuIHJ1biBhbGwgdGhlIHNjcmlwdHNcbiAgICBsb2FkVXNlckxpYnJhcmllcyhydW5Vc2VyU2NyaXB0cyk7XG4gIH1cbn0pKCk7XG5gO1xuIiwiLyogZXNsaW50IG5vLXVzZWxlc3MtZXNjYXBlOiAwICovXG5pbXBvcnQgJ2JhYmVsLXBvbHlmaWxsJztcbmltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCBqUXVlcnkgZnJvbSAnanF1ZXJ5JztcbmltcG9ydCBkYXRhbGliIGZyb20gJ2RhdGFsaWInO1xuaW1wb3J0IG1kNSBmcm9tICdtZDUnO1xuaW1wb3J0ICogYXMganNvbnBhdGggZnJvbSAnanNvbnBhdGgnO1xuaW1wb3J0IFBvdWNoREIgZnJvbSAncG91Y2hkYic7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJ3VraSc7XG5pbXBvcnQgYXBwTGlzdCBmcm9tICcuL2FwcExpc3QuanNvbic7XG5pbXBvcnQgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IGZyb20gJy4vbXVyZUludGVyYWN0aXZpdHlSdW5uZXIuanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmFwcExpc3QgPSBhcHBMaXN0O1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGV2ZW4gYmVpbmcgdXNlZCBpbiB0aGUgYnJvd3NlciAobW9zdGx5IHVzZWZ1bCBmb3IgZ2V0dGluZ1xuICAgIC8vIGFjY2VzcyB0byB0aGUgYXBwbGlzdCBpbiBhbGwtYXBwcy1kZXYtc2VydmVyLmpzKVxuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRW51bWVyYXRpb25zLi4uXG4gICAgdGhpcy5WQUxJRF9FVkVOVFMgPSB7XG4gICAgICBmaWxlTGlzdENoYW5nZToge30sXG4gICAgICBmaWxlQ2hhbmdlOiB7fSxcbiAgICAgIGRvbUNoYW5nZToge30sXG4gICAgICBtZXRhZGF0YUNoYW5nZToge30sXG4gICAgICBlcnJvcjoge31cbiAgICB9O1xuXG4gICAgdGhpcy5DT05URU5UX0ZPUk1BVFMgPSB7XG4gICAgICBleGNsdWRlOiAwLFxuICAgICAgYmxvYjogMSxcbiAgICAgIGRvbTogMixcbiAgICAgIGJhc2U2NDogM1xuICAgIH07XG5cbiAgICB0aGlzLlNJR05BTFMgPSB7XG4gICAgICBjYW5jZWxsZWQ6IHt9XG4gICAgfTtcblxuICAgIC8vIFRoZSBuYW1lc3BhY2Ugc3RyaW5nIGZvciBvdXIgY3VzdG9tIFhNTFxuICAgIHRoaXMuTlNTdHJpbmcgPSAnaHR0cDovL211cmUtYXBwcy5naXRodWIuaW8nO1xuICAgIGQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBGdW5reSBzdHVmZiB0byBmaWd1cmUgb3V0IGlmIHdlJ3JlIGRlYnVnZ2luZyAoaWYgdGhhdCdzIHRoZSBjYXNlLCB3ZSB3YW50IHRvIHVzZVxuICAgIC8vIGxvY2FsaG9zdCBpbnN0ZWFkIG9mIHRoZSBnaXRodWIgbGluayBmb3IgYWxsIGxpbmtzKVxuICAgIGxldCB3aW5kb3dUaXRsZSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0aXRsZScpWzBdO1xuICAgIHdpbmRvd1RpdGxlID0gd2luZG93VGl0bGUgPyB3aW5kb3dUaXRsZS50ZXh0Q29udGVudCA6ICcnO1xuICAgIHRoaXMuZGVidWdNb2RlID0gd2luZG93LmxvY2F0aW9uLmhvc3RuYW1lID09PSAnbG9jYWxob3N0JyAmJiB3aW5kb3dUaXRsZS5zdGFydHNXaXRoKCdNdXJlJyk7XG5cbiAgICAvLyBGaWd1cmUgb3V0IHdoaWNoIGFwcCB3ZSBhcmUgKG9yIG51bGwgaWYgdGhlIG11cmUgbGlicmFyeSBpcyBiZWluZyB1c2VkIHNvbWV3aGVyZSBlbHNlKVxuICAgIHRoaXMuY3VycmVudEFwcCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5yZXBsYWNlKC9cXC8vZywgJycpO1xuICAgIGlmICghdGhpcy5hcHBMaXN0W3RoaXMuY3VycmVudEFwcF0pIHtcbiAgICAgIHRoaXMuY3VycmVudEFwcCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIC8gbG9hZCB0aGUgbG9jYWwgZGF0YWJhc2Ugb2YgZmlsZXNcbiAgICB0aGlzLmxhc3RGaWxlID0gbnVsbDtcbiAgICB0aGlzLmRiID0gdGhpcy5nZXRPckluaXREYigpO1xuXG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGluZyAoYXBwcyBjYW4gbGlzdGVuIGZvciAvIGRpc3BsYXkgZXJyb3IgbWVzc2FnZXMgaW4gYWRkaXRpb24gdG8gdGhpcyk6XG4gICAgdGhpcy5vbignZXJyb3InLCBlcnJvck1lc3NhZ2UgPT4ge1xuICAgICAgY29uc29sZS53YXJuKGVycm9yTWVzc2FnZSk7XG4gICAgfSk7XG4gICAgdGhpcy5jYXRjaERiRXJyb3IgPSBlcnJvck9iaiA9PiB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgJ1VuZXhwZWN0ZWQgZXJyb3IgcmVhZGluZyBQb3VjaERCOiAnICsgZXJyb3JPYmoubWVzc2FnZSArICdcXG4nICsgZXJyb3JPYmouc3RhY2spO1xuICAgIH07XG5cbiAgICAvLyBpbiB0aGUgYWJzZW5jZSBvZiBhIGN1c3RvbSBkaWFsb2dzLCBqdXN0IHVzZSB3aW5kb3cuYWxlcnQsIHdpbmRvdy5jb25maXJtIGFuZCB3aW5kb3cucHJvbXB0OlxuICAgIHRoaXMuYWxlcnQgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgd2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xuICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLmNvbmZpcm0gPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh3aW5kb3cuY29uZmlybShtZXNzYWdlKSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMucHJvbXB0ID0gKG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh3aW5kb3cucHJvbXB0KG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaykge1xuICAgIGlmICghdGhpcy5WQUxJRF9FVkVOVFNbZXZlbnROYW1lXSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGV2ZW50IG5hbWU6ICcgKyBldmVudE5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdXBlci5vbihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cbiAgY3VzdG9taXplQWxlcnREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuYWxlcnQgPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgY3VzdG9taXplQ29uZmlybURpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5jb25maXJtID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZVByb21wdERpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5wcm9tcHQgPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgb3BlbkFwcCAoYXBwTmFtZSwgbmV3VGFiKSB7XG4gICAgaWYgKG5ld1RhYikge1xuICAgICAgd2luZG93Lm9wZW4oJy8nICsgYXBwTmFtZSwgJ19ibGFuaycpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgPSAnLycgKyBhcHBOYW1lO1xuICAgIH1cbiAgfVxuICBnZXRPckluaXREYiAoKSB7XG4gICAgbGV0IGRiID0gbmV3IFBvdWNoREIoJ211cmUnKTtcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgdGhpcy5sYXN0RmlsZSA9IG51bGw7XG4gICAgICB0cnkge1xuICAgICAgICBsZXQgcHJlZnMgPSBhd2FpdCBkYi5nZXQoJ3VzZXJQcmVmcycpO1xuICAgICAgICBpZiAocHJlZnMuY3VycmVudEZpbGUpIHtcbiAgICAgICAgICB0aGlzLmxhc3RGaWxlID0gYXdhaXQgdGhpcy5nZXRGaWxlKHByZWZzLmN1cnJlbnRGaWxlKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3JPYmopIHtcbiAgICAgICAgaWYgKGVycm9yT2JqLm1lc3NhZ2UgPT09ICdtaXNzaW5nJykge1xuICAgICAgICAgIGRiLnB1dCh7XG4gICAgICAgICAgICBfaWQ6ICd1c2VyUHJlZnMnLFxuICAgICAgICAgICAgY3VycmVudEZpbGU6IG51bGxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmNhdGNoRGJFcnJvcihlcnJvck9iaik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KSgpO1xuXG4gICAgZGIuY2hhbmdlcyh7XG4gICAgICBzaW5jZTogJ25vdycsXG4gICAgICBsaXZlOiB0cnVlLFxuICAgICAgaW5jbHVkZV9kb2NzOiB0cnVlXG4gICAgfSkub24oJ2NoYW5nZScsIGNoYW5nZSA9PiB7XG4gICAgICBsZXQgZmlsZUNoYW5nZWQ7XG4gICAgICBsZXQgZmlsZUxpc3RDaGFuZ2VkO1xuICAgICAgbGV0IGRvbUNoYW5nZWQ7XG4gICAgICBsZXQgbWV0YWRhdGFDaGFuZ2VkO1xuXG4gICAgICBpZiAoY2hhbmdlLmRlbGV0ZWQpIHtcbiAgICAgICAgaWYgKGNoYW5nZS5kb2MuX2lkICE9PSB0aGlzLmxhc3RGaWxlLl9pZCkge1xuICAgICAgICAgIC8vIFdlaXJkIGNvcm5lciBjYXNlOiBpZiB3ZSBqdXN0IGRlbGV0ZWQgYSBmaWxlIHRoYXQgd2Fzbid0IHRoZSBjdXJyZW50IG9uZSxcbiAgICAgICAgICAvLyB3ZSB3b24ndCBldmVyIGdldCBhIGNoYW5nZSBldmVudCBvbiB0aGUgdXNlclByZWZzIG9iamVjdDsgaW4gdGhhdCBjYXNlLFxuICAgICAgICAgIC8vIHdlIG5lZWQgdG8gdHJpZ2dlciB0aGUgZmlsZUxpc3RDaGFuZ2VkIGV2ZW50IGltbWVkaWF0ZWx5XG4gICAgICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGxldCBmaWxlTGlzdCA9IGF3YWl0IHRoaXMuZ2V0RmlsZUxpc3QoKTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcignZmlsZUxpc3RDaGFuZ2UnLCBmaWxlTGlzdCk7XG4gICAgICAgICAgfSkoKS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2hldGhlciBvciBub3QgdGhlIGRlbGV0ZWQgZmlsZSB3YXMgdGhlIGN1cnJlbnRseSBvcGVuIG9uZSwgZG9uJ3RcbiAgICAgICAgLy8gdHJpZ2dlciBhbnkgb3RoZXIgZXZlbnRzOyB3ZSB3YW50IGV2ZW50cyB0byBmaXJlIGluIGNvbnRleHQgb2YgdGhlXG4gICAgICAgIC8vIG5ldyBzdHVmZiBnZXR0aW5nIGxvYWRlZCBiZWxvd1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxldCBjdXJyZW50RmlsZTtcbiAgICAgIGlmIChjaGFuZ2UuZG9jLl9pZCA9PT0gJ3VzZXJQcmVmcycpIHtcbiAgICAgICAgLy8gV2UganVzdCBjaGFuZ2VkIHRoZSBjdXJyZW50bHkgb3BlbiBmaWxlOyB0cmlnZ2VyIGFsbCB0aGUgZXZlbnRzXG4gICAgICAgIGZpbGVDaGFuZ2VkID0gZmlsZUxpc3RDaGFuZ2VkID0gZG9tQ2hhbmdlZCA9IG1ldGFkYXRhQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIGN1cnJlbnRGaWxlID0gdGhpcy5sYXN0RmlsZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmICh0aGlzLmxhc3RGaWxlID09PSBudWxsIHx8IHRoaXMubGFzdEZpbGUuX2lkICE9PSBjaGFuZ2UuZG9jLl9pZCkge1xuICAgICAgICAgIC8vIFRoZSBmaWxlIGl0c2VsZiBpcyBjaGFuZ2luZzsgRE9OJ1QgYWN0dWFsbHkgdHJpZ2dlciBhbnkgb2YgdGhlIGV2ZW50c1xuICAgICAgICAgIC8vIGJlY2F1c2UgdXNlclByZWZzIGlzIGFib3V0IHRvIGJlIGNoYW5nZWQgYXMgd2VsbC4uLiBhbmQgdGhpbmdzIGxpc3RlbmluZ1xuICAgICAgICAgIC8vIHRvIGNoYW5nZXMgdGhhdCBjYXJlIGFib3V0IGNoZWNraW5nIHVzZXJQcmVmcyB3aWxsIHdhbnQgdG8gZG8gaXQgd2l0aFxuICAgICAgICAgIC8vIGl0cyB2YWx1ZSB1cGRhdGVkXG4gICAgICAgICAgZmlsZUNoYW5nZWQgPSBmaWxlTGlzdENoYW5nZWQgPSBkb21DaGFuZ2VkID0gbWV0YWRhdGFDaGFuZ2VkID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmlsZUNoYW5nZWQgPSBmYWxzZTtcbiAgICAgICAgICBkb21DaGFuZ2VkID0gdGhpcy5sYXN0RmlsZS5fYXR0YWNobWVudHNbdGhpcy5sYXN0RmlsZS5faWRdLmRpZ2VzdCAhPT1cbiAgICAgICAgICAgIGNoYW5nZS5kb2MuX2F0dGFjaG1lbnRzW2NoYW5nZS5kb2MuX2lkXS5kaWdlc3Q7XG4gICAgICAgICAgbWV0YWRhdGFDaGFuZ2VkID0gdGhpcy5sYXN0RmlsZS5tZXRhZGF0YURpZ2VzdCAhPT0gY2hhbmdlLmRvYy5tZXRhZGF0YURpZ2VzdDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxhc3RGaWxlID0gY3VycmVudEZpbGUgPSBjaGFuZ2UuZG9jO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmlsZUNoYW5nZWQpIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdmaWxlQ2hhbmdlJywgY3VycmVudEZpbGUpO1xuICAgICAgfVxuICAgICAgaWYgKGZpbGVMaXN0Q2hhbmdlZCkge1xuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGxldCBmaWxlTGlzdCA9IGF3YWl0IHRoaXMuZ2V0RmlsZUxpc3QoKTtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2ZpbGVMaXN0Q2hhbmdlJywgZmlsZUxpc3QpO1xuICAgICAgICB9KSgpLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgICAgIH1cbiAgICAgIGlmIChkb21DaGFuZ2VkKSB7XG4gICAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgbGV0IGJsb2IgPSBjdXJyZW50RmlsZSA/IGF3YWl0IHRoaXMuZ2V0RmlsZUFzQmxvYihjdXJyZW50RmlsZS5faWQpIDogbnVsbDtcbiAgICAgICAgICB0aGlzLnRyaWdnZXIoJ2RvbUNoYW5nZScsIGJsb2IpO1xuICAgICAgICB9KSgpO1xuICAgICAgfVxuICAgICAgaWYgKG1ldGFkYXRhQ2hhbmdlZCkge1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ21ldGFkYXRhQ2hhbmdlJywgY3VycmVudEZpbGUgPyBjdXJyZW50RmlsZS5tZXRhZGF0YSA6IG51bGwpO1xuICAgICAgfVxuICAgIH0pLm9uKCdlcnJvcicsIGVycm9yT2JqID0+IHtcbiAgICAgIHRoaXMuY2F0Y2hEYkVycm9yKGVycm9yT2JqKTtcbiAgICB9KTtcbiAgICByZXR1cm4gZGI7XG4gIH1cbiAgYXN5bmMgc2V0Q3VycmVudEZpbGUgKGZpbGVuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuZ2V0KCd1c2VyUHJlZnMnKS50aGVuKHByZWZzID0+IHtcbiAgICAgIHByZWZzLmN1cnJlbnRGaWxlID0gZmlsZW5hbWU7XG4gICAgICByZXR1cm4gdGhpcy5kYi5wdXQocHJlZnMpO1xuICAgIH0pLmNhdGNoKHRoaXMuY2F0Y2hEYkVycm9yKTtcbiAgfVxuICBhc3luYyBnZXRGaWxlIChmaWxlbmFtZSwgY29udGVudEZvcm1hdCkge1xuICAgIGlmICghZmlsZW5hbWUpIHtcbiAgICAgIGZpbGVuYW1lID0gYXdhaXQgdGhpcy5nZXRDdXJyZW50RmlsZW5hbWUoKTtcbiAgICB9XG5cbiAgICBsZXQgcG91Y2hkYk9wdGlvbnMgPSB7fTtcbiAgICBpZiAoY29udGVudEZvcm1hdCAhPT0gdGhpcy5DT05URU5UX0ZPUk1BVFMuZXhjbHVkZSkge1xuICAgICAgcG91Y2hkYk9wdGlvbnMuYXR0YWNobWVudHMgPSB0cnVlO1xuICAgICAgaWYgKGNvbnRlbnRGb3JtYXQgPT09IHRoaXMuQ09OVEVOVF9GT1JNQVRTLmJsb2IpIHtcbiAgICAgICAgcG91Y2hkYk9wdGlvbnMuYmluYXJ5ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZmlsZW5hbWUgIT09IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLmRiLmdldChmaWxlbmFtZSwgcG91Y2hkYk9wdGlvbnMgfHwge30pXG4gICAgICAgIC50aGVuKGZpbGVPYmogPT4ge1xuICAgICAgICAgIGlmIChjb250ZW50Rm9ybWF0ID09PSB0aGlzLkNPTlRFTlRfRk9STUFUUy5kb20pIHtcbiAgICAgICAgICAgIGxldCB4bWxUZXh0ID0gd2luZG93LmF0b2IoZmlsZU9iai5fYXR0YWNobWVudHNbZmlsZU9iai5faWRdLmRhdGEpO1xuICAgICAgICAgICAgbGV0IGRvbSA9IG5ldyB3aW5kb3cuRE9NUGFyc2VyKCkucGFyc2VGcm9tU3RyaW5nKHhtbFRleHQsICdpbWFnZS9zdmcreG1sJyk7XG4gICAgICAgICAgICBmaWxlT2JqLl9hdHRhY2htZW50c1tmaWxlT2JqLl9pZF0uZG9tID0gZG9tO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZmlsZU9iajtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIHNhdmVGaWxlIChvcHRpb25zKSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBleGlzdGluZ0RvYztcbiAgICAgIGlmICghb3B0aW9ucy5ibG9iT3JCYXNlNjRzdHJpbmcpIHtcbiAgICAgICAgZXhpc3RpbmdEb2MgPSBhd2FpdCB0aGlzLmdldEZpbGUob3B0aW9ucy5maWxlbmFtZSwgdGhpcy5DT05URU5UX0ZPUk1BVFMuZXhjbHVkZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleGlzdGluZ0RvYyA9IGF3YWl0IHRoaXMuZ2V0RmlsZShvcHRpb25zLmZpbGVuYW1lLCB0aGlzLkNPTlRFTlRfRk9STUFUUy5ibG9iKTtcbiAgICAgICAgZXhpc3RpbmdEb2MuX2F0dGFjaG1lbnRzW29wdGlvbnMuZmlsZW5hbWVdLmRhdGEgPSBvcHRpb25zLmJsb2JPckJhc2U2NHN0cmluZztcbiAgICAgICAgaWYgKCghb3B0aW9ucy5tZXRhZGF0YSB8fCBPYmplY3Qua2V5cyhvcHRpb25zLm1ldGFkYXRhKS5sZW5ndGggPT09IDApICYmXG4gICAgICAgICAgT2JqZWN0LmtleXMoZXhpc3RpbmdEb2MubWV0YWRhdGEpID4gMCkge1xuICAgICAgICAgIGxldCB1c2VyQ29uZmlybWF0aW9uID0gYXdhaXQgdGhpcy5jb25maXJtKFxuICAgICAgICAgICAgJ0l0IGFwcGVhcnMgdGhhdCB0aGUgZmlsZSB5b3VcXCdyZSB1cGxvYWRpbmcgaGFzIGxvc3QgaXRzIE11cmUgbWV0YWRhdGEuICcgK1xuICAgICAgICAgICAgJ1RoaXMgaXMgZmFpcmx5IGNvbW1vbiB3aGVuIHlvdVxcJ3ZlIGVkaXRlZCBpdCB3aXRoIGFuIGV4dGVybmFsIHByb2dyYW0uXFxuXFxuJyArXG4gICAgICAgICAgICAnUmVzdG9yZSB0aGUgbW9zdCByZWNlbnQgbWV0YWRhdGE/Jyk7XG4gICAgICAgICAgaWYgKCF1c2VyQ29uZmlybWF0aW9uKSB7XG4gICAgICAgICAgICBleGlzdGluZ0RvYy5tZXRhZGF0YSA9IHt9O1xuICAgICAgICAgICAgZXhpc3RpbmdEb2MubWV0YWRhdGFEaWdlc3QgPSBtZDUoJ3t9Jyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5tZXRhZGF0YSkge1xuICAgICAgICBleGlzdGluZ0RvYy5tZXRhZGF0YSA9IG9wdGlvbnMubWV0YWRhdGE7XG4gICAgICAgIGV4aXN0aW5nRG9jLm1ldGFkYXRhRGlnZXN0ID0gbWQ1KEpTT04uc3RyaW5naWZ5KG9wdGlvbnMubWV0YWRhdGEpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmRiLnB1dChleGlzdGluZ0RvYyk7XG4gICAgfSBjYXRjaCAoZXJyb3JPYmopIHtcbiAgICAgIGlmIChlcnJvck9iai5tZXNzYWdlID09PSAnbWlzc2luZycpIHtcbiAgICAgICAgLy8gVGhlIGZpbGUgZG9lc24ndCBleGlzdCB5ZXQuLi5cbiAgICAgICAgbGV0IG5ld0RvYyA9IHtcbiAgICAgICAgICBfaWQ6IG9wdGlvbnMuZmlsZW5hbWUsXG4gICAgICAgICAgX2F0dGFjaG1lbnRzOiB7fSxcbiAgICAgICAgICBtZXRhZGF0YTogb3B0aW9ucy5tZXRhZGF0YSB8fCB7fSxcbiAgICAgICAgICBtZXRhZGF0YURpZ2VzdDogb3B0aW9ucy5tZXRhZGF0YSA/IG1kNShKU09OLnN0cmluZ2lmeShvcHRpb25zLm1ldGFkYXRhKSkgOiBtZDUoJ3t9JylcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmJsb2JPckJhc2U2NHN0cmluZykge1xuICAgICAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCAnQXR0ZW1wdGVkIHRvIHNhdmUgYSBmaWxlIHdpdGhvdXQgY29udGVudHMhJyk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3RG9jLl9hdHRhY2htZW50c1tvcHRpb25zLmZpbGVuYW1lXSA9IHtcbiAgICAgICAgICBjb250ZW50X3R5cGU6ICdpbWFnZS9zdmcreG1sJyxcbiAgICAgICAgICBkYXRhOiBvcHRpb25zLmJsb2JPckJhc2U2NHN0cmluZ1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5kYi5wdXQobmV3RG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY2F0Y2hEYkVycm9yKGVycm9yT2JqKTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yT2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgZ2V0TWV0YWRhdGEgKGZpbGVuYW1lKSB7XG4gICAgbGV0IGN1cnJlbnRGaWxlID0gYXdhaXQgdGhpcy5nZXRGaWxlKGZpbGVuYW1lLCB0aGlzLkNPTlRFTlRfRk9STUFUUy5leGNsdWRlKTtcbiAgICByZXR1cm4gY3VycmVudEZpbGUgIT09IG51bGwgPyBjdXJyZW50RmlsZS5tZXRhZGF0YSA6IG51bGw7XG4gIH1cbiAgYXN5bmMgZ2V0Q3VycmVudEZpbGVuYW1lICgpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoJ3VzZXJQcmVmcycpLnRoZW4ocHJlZnMgPT4ge1xuICAgICAgcmV0dXJuIHByZWZzLmN1cnJlbnRGaWxlO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIGdldEZpbGVMaXN0ICgpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5hbGxEb2NzKClcbiAgICAgIC50aGVuKHJlc3BvbnNlID0+IHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICByZXNwb25zZS5yb3dzLmZvckVhY2goZCA9PiB7XG4gICAgICAgICAgaWYgKGQuaWQgIT09ICd1c2VyUHJlZnMnKSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChkLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfSkuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpO1xuICB9XG4gIGFzeW5jIGdldEZpbGVSZXZpc2lvbnMgKCkge1xuICAgIHJldHVybiB0aGlzLmRiLmFsbERvY3MoKVxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICBsZXQgcmVzdWx0ID0ge307XG4gICAgICAgIHJlc3BvbnNlLnJvd3MuZm9yRWFjaChkID0+IHtcbiAgICAgICAgICBpZiAoZC5pZCAhPT0gJ3VzZXJQcmVmcycpIHtcbiAgICAgICAgICAgIHJlc3VsdFtkLmlkXSA9IGQudmFsdWUucmV2O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9KS5jYXRjaCh0aGlzLmNhdGNoRGJFcnJvcik7XG4gIH1cbiAgYXN5bmMgcmVhZEZpbGUgKHJlYWRlciwgZmlsZU9iaikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICByZWFkZXIub25sb2FkZW5kID0geG1sVGV4dCA9PiB7XG4gICAgICAgIHJlc29sdmUoeG1sVGV4dC50YXJnZXQucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXIub25lcnJvciA9IGVycm9yID0+IHtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH07XG4gICAgICByZWFkZXIub25hYm9ydCA9ICgpID0+IHtcbiAgICAgICAgcmVqZWN0KHRoaXMuU0lHTkFMUy5jYW5jZWxsZWQpO1xuICAgICAgfTtcbiAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGVPYmopO1xuICAgIH0pO1xuICB9XG4gIGFzeW5jIHZhbGlkYXRlRmlsZU5hbWUgKG9yaWdpbmFsTmFtZSwgdGFrZW5OYW1lcywgYWJvcnRGdW5jdGlvbikge1xuICAgIC8vIEFzayBtdWx0aXBsZSB0aW1lcyBpZiB0aGUgdXNlciBoYXBwZW5zIHRvIGVudGVyIGFub3RoZXIgZmlsZW5hbWUgdGhhdCBhbHJlYWR5IGV4aXN0c1xuICAgIGxldCBmaWxlbmFtZSA9IG9yaWdpbmFsTmFtZTtcbiAgICB3aGlsZSAodGFrZW5OYW1lc1tmaWxlbmFtZV0pIHtcbiAgICAgIGZpbGVuYW1lID0gYXdhaXQgdGhpcy5wcm9tcHQoXG4gICAgICAgIGZpbGVuYW1lICsgJyBhbHJlYWR5IGV4aXN0cy4gUGljayBhIG5ldyBuYW1lLCBvciBsZWF2ZSBpdCB0aGUgc2FtZSB0byBvdmVyd3JpdGU6JyxcbiAgICAgICAgZmlsZW5hbWUpO1xuICAgICAgaWYgKGZpbGVuYW1lID09PSBudWxsKSB7XG4gICAgICAgIGlmIChhYm9ydEZ1bmN0aW9uKSB7XG4gICAgICAgICAgYWJvcnRGdW5jdGlvbigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCh0aGlzLlNJR05BTFMuY2FuY2VsbGVkKTtcbiAgICAgIH0gZWxzZSBpZiAoZmlsZW5hbWUgPT09ICcnKSB7XG4gICAgICAgIGZpbGVuYW1lID0gYXdhaXQgdGhpcy5wcm9tcHQoJ1lvdSBtdXN0IGVudGVyIGEgZmlsZSBuYW1lIChvciBjbGljayBjYW5jZWwgdG8gY2FuY2VsIHRoZSB1cGxvYWQpJyk7XG4gICAgICB9IGVsc2UgaWYgKGZpbGVuYW1lID09PSBvcmlnaW5hbE5hbWUpIHtcbiAgICAgICAgLy8gVGhleSBsZWZ0IGl0IHRoZSBzYW1lLi4uIG92ZXJ3cml0ZSFcbiAgICAgICAgcmV0dXJuIGZpbGVuYW1lO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmlsZW5hbWU7XG4gIH1cbiAgaW5mZXJQYXJzZXIgKGZpbGVPYmopIHtcbiAgICBsZXQgZXh0ID0gZmlsZU9iai50eXBlLnNwbGl0KCcvJylbMV07XG4gICAgaWYgKGV4dCA9PT0gJ2NzdicpIHtcbiAgICAgIHJldHVybiAoY29udGVudHMpID0+IHsgcmV0dXJuIGRhdGFsaWIucmVhZChjb250ZW50cywge3R5cGU6ICdjc3YnLCBwYXJzZTogJ2F1dG8nfSk7IH07XG4gICAgfSBlbHNlIGlmIChleHQgPT09ICd0c3YnKSB7XG4gICAgICByZXR1cm4gKGNvbnRlbnRzKSA9PiB7IHJldHVybiBkYXRhbGliLnJlYWQoY29udGVudHMsIHt0eXBlOiAndHN2JywgcGFyc2U6ICdhdXRvJ30pOyB9O1xuICAgIH0gZWxzZSBpZiAoZXh0ID09PSAnZHN2Jykge1xuICAgICAgcmV0dXJuIChjb250ZW50cykgPT4geyByZXR1cm4gZGF0YWxpYi5yZWFkKGNvbnRlbnRzLCB7dHlwZTogJ2RzdicsIHBhcnNlOiAnYXV0byd9KTsgfTtcbiAgICB9IGVsc2UgaWYgKGV4dCA9PT0gJ2pzb24nKSB7XG4gICAgICAvLyBUT0RPOiBhdHRlbXB0IHRvIGF1dG8tZGlzY292ZXIgdG9wb2pzb24gb3IgdHJlZWpzb24/XG4gICAgICByZXR1cm4gKGNvbnRlbnRzKSA9PiB7IHJldHVybiBkYXRhbGliLnJlYWQoY29udGVudHMsIHt0eXBlOiAnanNvbicsIHBhcnNlOiAnYXV0byd9KTsgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG4gIGFzeW5jIHVwbG9hZERhdGFzZXQgKGZpbGVPYmopIHtcbiAgICBsZXQgcGFyc2VyID0gdGhpcy5pbmZlclBhcnNlcihmaWxlT2JqKTtcbiAgICBpZiAoIXBhcnNlcikge1xuICAgICAgbGV0IGVycm9yT2JqID0gbmV3IEVycm9yKCdVbmtub3duIGRhdGEgZmlsZSB0eXBlOiAnICsgZmlsZU9iai50eXBlKTtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCBlcnJvck9iaik7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3JPYmopO1xuICAgIH1cblxuICAgIGxldCBtZXRhZGF0YSA9IGF3YWl0IHRoaXMuZ2V0TWV0YWRhdGEoKTtcbiAgICBpZiAobWV0YWRhdGEgPT09IG51bGwpIHtcbiAgICAgIGxldCBlcnJvck9iaiA9IG5ldyBFcnJvcignQ2FuXFwndCBlbWJlZCBhIGRhdGEgZmlsZSB3aXRob3V0IGFuIFNWRyBmaWxlIGFscmVhZHkgb3BlbicpO1xuICAgICAgdGhpcy50cmlnZ2VyKCdlcnJvcicsIGVycm9yT2JqKTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvck9iaik7XG4gICAgfVxuICAgIG1ldGFkYXRhLmRhdGFzZXRzID0gbWV0YWRhdGEuZGF0YXNldHMgfHwge307XG5cbiAgICBsZXQgcmVhZGVyID0gbmV3IHdpbmRvdy5GaWxlUmVhZGVyKCk7XG4gICAgbGV0IGRhdGFGaWxlTmFtZSA9IGF3YWl0IHRoaXMudmFsaWRhdGVGaWxlTmFtZShmaWxlT2JqLm5hbWUsIG1ldGFkYXRhLmRhdGFzZXRzLCByZWFkZXIuYWJvcnQpO1xuICAgIGxldCBmaWxlVGV4dCA9IGF3YWl0IHRoaXMucmVhZEZpbGUocmVhZGVyLCBmaWxlT2JqKTtcblxuICAgIG1ldGFkYXRhLmRhdGFzZXRzW2RhdGFGaWxlTmFtZV0gPSBwYXJzZXIoZmlsZVRleHQpO1xuICAgIHJldHVybiB0aGlzLnNhdmVGaWxlKHsgbWV0YWRhdGEgfSk7XG4gIH1cbiAgYXN5bmMgdXBsb2FkU3ZnIChmaWxlT2JqKSB7XG4gICAgbGV0IHJlYWRlciA9IG5ldyB3aW5kb3cuRmlsZVJlYWRlcigpO1xuICAgIGxldCBjb250ZW50c1Byb21pc2UgPSB0aGlzLnJlYWRGaWxlKHJlYWRlciwgZmlsZU9iailcbiAgICAgIC50aGVuKHhtbFRleHQgPT4ge1xuICAgICAgICBsZXQgZG9tID0gbmV3IHdpbmRvdy5ET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoeG1sVGV4dCwgJ2ltYWdlL3N2Zyt4bWwnKTtcbiAgICAgICAgbGV0IGNvbnRlbnRzID0geyBtZXRhZGF0YTogdGhpcy5leHRyYWN0TWV0YWRhdGEoZG9tKSB9O1xuICAgICAgICBjb250ZW50cy5iYXNlNjRkYXRhID0gd2luZG93LmJ0b2EobmV3IHdpbmRvdy5YTUxTZXJpYWxpemVyKCkuc2VyaWFsaXplVG9TdHJpbmcoZG9tKSk7XG4gICAgICAgIHJldHVybiBjb250ZW50cztcbiAgICAgIH0pO1xuXG4gICAgbGV0IGZpbGVuYW1lUHJvbWlzZSA9IHRoaXMuZ2V0RmlsZVJldmlzaW9ucygpXG4gICAgICAuY2F0Y2godGhpcy5jYXRjaERiRXJyb3IpXG4gICAgICAudGhlbihyZXZpc2lvbkRpY3QgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUZpbGVOYW1lKGZpbGVPYmoubmFtZSwgcmV2aXNpb25EaWN0LCByZWFkZXIuYWJvcnQpO1xuICAgICAgfSk7XG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoW2ZpbGVuYW1lUHJvbWlzZSwgY29udGVudHNQcm9taXNlXSkudGhlbigoW2ZpbGVuYW1lLCBjb250ZW50c10pID0+IHtcbiAgICAgIHJldHVybiB0aGlzLnNhdmVGaWxlKHtcbiAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgIGJsb2JPckJhc2U2NHN0cmluZzogY29udGVudHMuYmFzZTY0ZGF0YSxcbiAgICAgICAgbWV0YWRhdGE6IGNvbnRlbnRzLm1ldGFkYXRhXG4gICAgICB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0Q3VycmVudEZpbGUoZmlsZW5hbWUpO1xuICAgICAgfSk7XG4gICAgfSkuY2F0Y2goKGVyckxpc3QpID0+IHtcbiAgICAgIGlmIChlcnJMaXN0WzBdICE9PSB0aGlzLlNJR05BTFMuY2FuY2VsbGVkIHx8IGVyckxpc3RbMV0gIT09IHRoaXMuU0lHTkFMUy5jYW5jZWxsZWQpIHtcbiAgICAgICAgLy8gY2FuY2VsbGluZyBpcyBub3QgYSBwcm9ibGVtOyBvbmx5IHJlamVjdCBpZiBzb21ldGhpbmcgZWxzZSBoYXBwZW5lZFxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyTGlzdCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgYXN5bmMgZGVsZXRlU3ZnIChmaWxlbmFtZSkge1xuICAgIGxldCB1c2VyQ29uZmlybWF0aW9uID0gYXdhaXQgdGhpcy5jb25maXJtKCdBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlICcgKyBmaWxlbmFtZSArICc/Jyk7XG4gICAgaWYgKHVzZXJDb25maXJtYXRpb24pIHtcbiAgICAgIGxldCBjdXJyZW50RmlsZSA9IGF3YWl0IHRoaXMuZ2V0RmlsZShmaWxlbmFtZSwgdGhpcy5DT05URU5UX0ZPUk1BVFMuZXhjbHVkZSk7XG4gICAgICByZXR1cm4gdGhpcy5kYi5yZW1vdmUoY3VycmVudEZpbGUuX2lkLCBjdXJyZW50RmlsZS5fcmV2KVxuICAgICAgICAudGhlbihyZW1vdmVSZXNwb25zZSA9PiB7XG4gICAgICAgICAgaWYgKHRoaXMubGFzdEZpbGUgJiYgZmlsZW5hbWUgPT09IHRoaXMubGFzdEZpbGUuX2lkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zZXRDdXJyZW50RmlsZShudWxsKS50aGVuKCgpID0+IHJlbW92ZVJlc3BvbnNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlbW92ZVJlc3BvbnNlO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG4gICAgfVxuICB9XG4gIGV4dHJhY3RNZXRhZGF0YSAoZG9tKSB7XG4gICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgIGxldCBtZXRhZGF0YSA9IHt9O1xuICAgIGxldCBkM2RvbSA9IGQzLnNlbGVjdChkb20ucm9vdEVsZW1lbnQpO1xuXG4gICAgLy8gRXh0cmFjdCB0aGUgY29udGFpbmVyIGZvciBvdXIgbWV0YWRhdGEsIGlmIGl0IGV4aXN0c1xuICAgIGxldCByb290ID0gZDNkb20uc2VsZWN0KCcjbXVyZScpO1xuICAgIGlmIChyb290LnNpemUoKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG1ldGFkYXRhO1xuICAgIH1cbiAgICBsZXQgbnNFbGVtZW50ID0gcm9vdC5zZWxlY3QoJ211cmUnKTtcbiAgICBpZiAobnNFbGVtZW50LnNpemUoKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG1ldGFkYXRhO1xuICAgIH1cblxuICAgIC8vIEFueSBsaWJyYXJpZXM/XG4gICAgbnNFbGVtZW50LnNlbGVjdEFsbCgnbGlicmFyeScpLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgIGlmICghbWV0YWRhdGEubGlicmFyaWVzKSB7XG4gICAgICAgIG1ldGFkYXRhLmxpYnJhcmllcyA9IFtdO1xuICAgICAgfVxuICAgICAgbWV0YWRhdGEubGlicmFyaWVzLnB1c2goZDMuc2VsZWN0KHRoaXMpLmF0dHIoJ3NyYycpKTtcbiAgICB9KTtcblxuICAgIC8vIEFueSBzY3JpcHRzP1xuICAgIG5zRWxlbWVudC5zZWxlY3RBbGwoJ3NjcmlwdCcpLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgIGxldCBlbCA9IGQzLnNlbGVjdCh0aGlzKTtcbiAgICAgIGxldCBzY3JpcHQgPSB7XG4gICAgICAgIHRleHQ6IHNlbGYuZXh0cmFjdENEQVRBKGVsLnRleHQoKSlcbiAgICAgIH07XG4gICAgICBsZXQgaWQgPSBlbC5hdHRyKCdpZCcpO1xuICAgICAgaWYgKGlkKSB7XG4gICAgICAgIGlmIChpZCA9PT0gJ211cmVJbnRlcmFjdGl2aXR5UnVubmVyJykge1xuICAgICAgICAgIC8vIERvbid0IHN0b3JlIG91ciBpbnRlcmFjdGl2aXR5IHJ1bm5lciBzY3JpcHRcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2NyaXB0LmlkID0gaWQ7XG4gICAgICB9XG4gICAgICBpZiAoIW1ldGFkYXRhLnNjcmlwdHMpIHtcbiAgICAgICAgbWV0YWRhdGEuc2NyaXB0cyA9IFtdO1xuICAgICAgfVxuICAgICAgbWV0YWRhdGEuc2NyaXB0cy5wdXNoKHNjcmlwdCk7XG4gICAgfSk7XG5cbiAgICAvLyBBbnkgZGF0YXNldHM/XG4gICAgbnNFbGVtZW50LnNlbGVjdEFsbCgnZGF0YXNldHMnKS5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICBsZXQgZWwgPSBkMy5zZWxlY3QodGhpcyk7XG4gICAgICBpZiAoIW1ldGFkYXRhLmRhdGFzZXRzKSB7XG4gICAgICAgIG1ldGFkYXRhLmRhdGFzZXRzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5kYXRhc2V0c1tlbC5hdHRyKCduYW1lJyldID0gSlNPTi5wYXJzZShzZWxmLmV4dHJhY3RDREFUQShlbC50ZXh0KCkpKTtcbiAgICB9KTtcblxuICAgIC8vIEFueSBkYXRhIGJpbmRpbmdzP1xuICAgIG5zRWxlbWVudC5zZWxlY3RBbGwoJ2JpbmRpbmcnKS5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICBsZXQgZWwgPSBkMy5zZWxlY3QodGhpcyk7XG4gICAgICBsZXQgYmluZGluZyA9IHtcbiAgICAgICAgaWQ6IGVsLmF0dHIoJ2lkJyksXG4gICAgICAgIGRhdGFSb290OiBlbC5hdHRyKCdkYXRhcm9vdCcpLFxuICAgICAgICBzdmdSb290OiBlbC5hdHRyKCdzdmdyb290JyksXG4gICAgICAgIGtleUZ1bmN0aW9uOiBKU09OLnBhcnNlKHNlbGYuZXh0cmFjdENEQVRBKGVsLnRleHQoKSkpXG4gICAgICB9O1xuXG4gICAgICBpZiAoIW1ldGFkYXRhLmJpbmRpbmdzKSB7XG4gICAgICAgIG1ldGFkYXRhLmJpbmRpbmdzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5iaW5kaW5nc1tiaW5kaW5nLmlkXSA9IGJpbmRpbmc7XG4gICAgfSk7XG5cbiAgICAvLyBBbnkgZW5jb2RpbmdzP1xuICAgIG5zRWxlbWVudC5zZWxlY3RBbGwoJ2VuY29kaW5nJykuZWFjaChmdW5jdGlvbiAoZCkge1xuICAgICAgbGV0IGVsID0gZDMuc2VsZWN0KHRoaXMpO1xuICAgICAgbGV0IGVuY29kaW5nID0ge1xuICAgICAgICBpZDogZWwuYXR0cignaWQnKSxcbiAgICAgICAgYmluZGluZ0lkOiBlbC5hdHRyKCdmb3InKSxcbiAgICAgICAgc3BlYzogSlNPTi5wYXJzZShzZWxmLmV4dHJhY3RDREFUQShlbC50ZXh0KCkpKVxuICAgICAgfTtcblxuICAgICAgaWYgKCFtZXRhZGF0YS5lbmNvZGluZ3MpIHtcbiAgICAgICAgbWV0YWRhdGEuZW5jb2RpbmdzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5lbmNvZGluZ3NbZW5jb2RpbmcuaWRdID0gZW5jb2Rpbmc7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWV0YWRhdGE7XG4gIH1cbiAgZXh0cmFjdENEQVRBIChzdHIpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyg8IVxcW0NEQVRBXFxbKS9nLCAnJykucmVwbGFjZSgvXV0+L2csICcnKTtcbiAgfVxuICBnZXRFbXB0eUJpbmRpbmcgKG1ldGFkYXRhLCBhZGQpIHtcbiAgICBsZXQgaWQgPSAxO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb24gKi9cbiAgICB3aGlsZSAobWV0YWRhdGEuYmluZGluZ3MgJiYgbWV0YWRhdGEuYmluZGluZ3NbJ0JpbmRpbmcnICsgaWRdKSB7XG4gICAgICBpZCsrO1xuICAgIH1cbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb24gKi9cbiAgICBsZXQgbmV3QmluZGluZyA9IHtcbiAgICAgIGlkOiAnQmluZGluZycgKyBpZCxcbiAgICAgIHN2Z1Jvb3Q6ICcnLFxuICAgICAgZGF0YVJvb3Q6ICcnLFxuICAgICAga2V5RnVuY3Rpb246IHtcbiAgICAgICAgZGF0YUV4cHJlc3Npb246ICcoZCwgaykgPT4gaycsXG4gICAgICAgIHN2Z0V4cHJlc3Npb246ICcoZWwsIGkpID0+IGknXG4gICAgICB9XG4gICAgfTtcbiAgICBpZiAoYWRkKSB7XG4gICAgICBpZiAoIW1ldGFkYXRhLmJpbmRpbmdzKSB7XG4gICAgICAgIG1ldGFkYXRhLmJpbmRpbmdzID0ge307XG4gICAgICB9XG4gICAgICBtZXRhZGF0YS5iaW5kaW5nc1tuZXdCaW5kaW5nLmlkXSA9IG5ld0JpbmRpbmc7XG4gICAgfVxuICAgIHJldHVybiBuZXdCaW5kaW5nO1xuICB9XG4gIGdldEVtcHR5RW5jb2RpbmcgKG1ldGFkYXRhLCBhZGQpIHtcbiAgICBsZXQgaWQgPSAxO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb24gKi9cbiAgICB3aGlsZSAobWV0YWRhdGEuZW5jb2RpbmdzICYmIG1ldGFkYXRhLmVuY29kaW5nc1snRW5jb2RpbmcnICsgaWRdKSB7XG4gICAgICBpZCsrO1xuICAgIH1cbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb24gKi9cbiAgICBsZXQgbmV3RW5jb2RpbmcgPSB7XG4gICAgICBpZDogJ0VuY29kaW5nJyArIGlkLFxuICAgICAgYmluZGluZ0lkOiAnJyxcbiAgICAgIHNwZWM6IHt9XG4gICAgfTtcbiAgICBpZiAoYWRkKSB7XG4gICAgICBpZiAoIW1ldGFkYXRhLmVuY29kaW5ncykge1xuICAgICAgICBtZXRhZGF0YS5lbmNvZGluZ3MgPSB7fTtcbiAgICAgIH1cbiAgICAgIG1ldGFkYXRhLmVuY29kaW5nc1tuZXdFbmNvZGluZy5pZF0gPSBuZXdFbmNvZGluZztcbiAgICB9XG4gICAgcmV0dXJuIG5ld0VuY29kaW5nO1xuICB9XG4gIGVtYmVkTWV0YWRhdGEgKGRvbSwgbWV0YWRhdGEpIHtcbiAgICBsZXQgZDNkb20gPSBkMy5zZWxlY3QoZG9tLnJvb3RFbGVtZW50KTtcblxuICAgIC8vIFRvcDogbmVlZCBhIG1ldGFkYXRhIHRhZ1xuICAgIGxldCByb290ID0gZDNkb20uc2VsZWN0QWxsKCcjbXVyZScpLmRhdGEoWzBdKTtcbiAgICByb290LmV4aXQoKS5yZW1vdmUoKTtcbiAgICByb290ID0gcm9vdC5lbnRlcigpLmFwcGVuZCgnbWV0YWRhdGEnKS5hdHRyKCdpZCcsICdtdXJlJykubWVyZ2Uocm9vdCk7XG5cbiAgICAvLyBOZXh0IGRvd246IGEgdGFnIHRvIGRlZmluZSB0aGUgbmFtZXNwYWNlXG4gICAgbGV0IG5zRWxlbWVudCA9IHJvb3Quc2VsZWN0QWxsKCdtdXJlJykuZGF0YShbMF0pO1xuICAgIG5zRWxlbWVudC5leGl0KCkucmVtb3ZlKCk7XG4gICAgbnNFbGVtZW50ID0gbnNFbGVtZW50LmVudGVyKCkuYXBwZW5kKCdtdXJlJykuYXR0cigneG1sbnMnLCB0aGlzLk5TU3RyaW5nKS5tZXJnZShuc0VsZW1lbnQpO1xuXG4gICAgLy8gT2theSwgd2UncmUgaW4gb3VyIGN1c3RvbSBuYW1lc3BhY2UuLi4gbGV0J3MgZmlndXJlIG91dCB0aGUgbGlicmFyaWVzXG4gICAgbGV0IGxpYnJhcnlMaXN0ID0gbWV0YWRhdGEubGlicmFyaWVzIHx8IFtdO1xuICAgIGxldCBsaWJyYXJpZXMgPSBuc0VsZW1lbnQuc2VsZWN0QWxsKCdsaWJyYXJ5JykuZGF0YShsaWJyYXJ5TGlzdCk7XG4gICAgbGlicmFyaWVzLmV4aXQoKS5yZW1vdmUoKTtcbiAgICBsaWJyYXJpZXMgPSBsaWJyYXJpZXMuZW50ZXIoKS5hcHBlbmQoJ2xpYnJhcnknKS5tZXJnZShsaWJyYXJpZXMpO1xuICAgIGxpYnJhcmllcy5hdHRyKCdzcmMnLCBkID0+IGQpO1xuXG4gICAgLy8gTGV0J3MgZGVhbCB3aXRoIGFueSB1c2VyIHNjcmlwdHNcbiAgICBsZXQgc2NyaXB0TGlzdCA9IG1ldGFkYXRhLnNjcmlwdHMgfHwgW107XG4gICAgbGV0IHNjcmlwdHMgPSBuc0VsZW1lbnQuc2VsZWN0QWxsKCdzY3JpcHQnKS5kYXRhKHNjcmlwdExpc3QpO1xuICAgIHNjcmlwdHMuZXhpdCgpLnJlbW92ZSgpO1xuICAgIGxldCBzY3JpcHRzRW50ZXIgPSBzY3JpcHRzLmVudGVyKCkuYXBwZW5kKCdzY3JpcHQnKTtcbiAgICBzY3JpcHRzID0gc2NyaXB0c0VudGVyLm1lcmdlKHNjcmlwdHMpO1xuICAgIHNjcmlwdHMuYXR0cignaWQnLCBkID0+IGQuaWQgfHwgbnVsbCk7XG4gICAgc2NyaXB0cy5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICB0aGlzLmlubmVySFRNTCA9ICc8IVtDREFUQVsnICsgZC50ZXh0ICsgJ11dPic7XG4gICAgfSk7XG5cbiAgICAvLyBSZW1vdmUgbXVyZUludGVyYWN0aXZpdHlSdW5uZXIgYnkgZGVmYXVsdCB0byBlbnN1cmUgaXQgYWx3YXlzIGNvbWVzIGFmdGVyIHRoZVxuICAgIC8vIG1ldGFkYXRhIHRhZyAob2YgY291cnNlLCBvbmx5IGJvdGhlciBhZGRpbmcgaXQgaWYgd2UgaGF2ZSBhbnkgbGlicmFyaWVzIG9yIHNjcmlwdHMpXG4gICAgZDNkb20uc2VsZWN0KCcjbXVyZUludGVyYWN0aXZpdHlSdW5uZXInKS5yZW1vdmUoKTtcbiAgICBpZiAobGlicmFyeUxpc3QubGVuZ3RoID4gMCB8fCBzY3JpcHRMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgIGQzZG9tLmFwcGVuZCgnc2NyaXB0JylcbiAgICAgICAgLmF0dHIoJ2lkJywgJ211cmVJbnRlcmFjdGl2aXR5UnVubmVyJylcbiAgICAgICAgLmF0dHIoJ3R5cGUnLCAndGV4dC9qYXZhc2NyaXB0JylcbiAgICAgICAgLnRleHQoJzwhW0NEQVRBWycgKyBtdXJlSW50ZXJhY3Rpdml0eVJ1bm5lclRleHQgKyAnXV0nKTtcbiAgICB9XG5cbiAgICAvLyBXZSBhbHdheXMgc3RvcmUgZGF0YXNldHMgYXMgSlNPTlxuICAgIGxldCBkYXRhc2V0cyA9IG5zRWxlbWVudC5zZWxlY3RBbGwoJ2RhdGFzZXQnKS5kYXRhKGQzLmVudHJpZXMobWV0YWRhdGEuZGF0YXNldHMgfHwge30pKTtcbiAgICBkYXRhc2V0cy5leGl0KCkucmVtb3ZlKCk7XG4gICAgbGV0IGRhdGFzZXRzRW50ZXIgPSBkYXRhc2V0cy5lbnRlcigpLmFwcGVuZCgnZGF0YXNldCcpO1xuICAgIGRhdGFzZXRzID0gZGF0YXNldHNFbnRlci5tZXJnZShkYXRhc2V0cyk7XG4gICAgZGF0YXNldHMuYXR0cignbmFtZScsIGQgPT4gZC5rZXkpXG4gICAgICAuaHRtbChkID0+ICc8IVtDREFUQVsnICsgSlNPTi5zdHJpbmdpZnkoZC52YWx1ZSkgKyAnXV0+Jyk7XG5cbiAgICAvLyBTdG9yZSBkYXRhIGJpbmRpbmdzXG4gICAgbGV0IGJpbmRpbmdzID0gbnNFbGVtZW50LnNlbGVjdEFsbCgnYmluZGluZycpLmRhdGEoZDMudmFsdWVzKG1ldGFkYXRhLmJpbmRpbmdzIHx8IHt9KSk7XG4gICAgYmluZGluZ3MuZXhpdCgpLnJlbW92ZSgpO1xuICAgIGxldCBiaW5kaW5nc0VudGVyID0gYmluZGluZ3MuZW50ZXIoKS5hcHBlbmQoJ2JpbmRpbmcnKTtcbiAgICBiaW5kaW5ncyA9IGJpbmRpbmdzRW50ZXIubWVyZ2UoYmluZGluZ3MpO1xuICAgIGJpbmRpbmdzXG4gICAgICAuYXR0cignaWQnLCBkID0+IGQuaWQpXG4gICAgICAuYXR0cignZGF0YXJvb3QnLCBkID0+IGQuZGF0YVJvb3QpXG4gICAgICAuYXR0cignc3Zncm9vdCcsIGQgPT4gZC5zdmdSb290KVxuICAgICAgLmh0bWwoZCA9PiAnPCFbQ0RBVEFbJyArIEpTT04uc3RyaW5naWZ5KGQua2V5RnVuY3Rpb24pICsgJ11dPicpO1xuXG4gICAgLy8gU3RvcmUgZW5jb2RpbmcgbWV0YWRhdGFcbiAgICBsZXQgZW5jb2RpbmdzID0gbnNFbGVtZW50LnNlbGVjdEFsbCgnZW5jb2RpbmcnKS5kYXRhKGQzLnZhbHVlcyhtZXRhZGF0YS5lbmNvZGluZ3MgfHwge30pKTtcbiAgICBlbmNvZGluZ3MuZXhpdCgpLnJlbW92ZSgpO1xuICAgIGxldCBlbmNvZGluZ3NFbnRlciA9IGVuY29kaW5ncy5lbnRlcigpLmFwcGVuZCgnZW5jb2RpbmcnKTtcbiAgICBlbmNvZGluZ3MgPSBlbmNvZGluZ3NFbnRlci5tZXJnZShlbmNvZGluZ3MpO1xuICAgIGVuY29kaW5nc1xuICAgICAgLmF0dHIoJ2lkJywgZCA9PiBkLmlkKVxuICAgICAgLmF0dHIoJ2JpbmRpbmdpZCcsIGQgPT4gZC5iaW5kaW5nSWQpXG4gICAgICAuaHRtbChkID0+ICc8IVtDREFUQVsnICsgSlNPTi5zdHJpbmdpZnkoZC5zcGVjKSArICddXT4nKTtcblxuICAgIHJldHVybiBkb207XG4gIH1cbiAgYXN5bmMgZG93bmxvYWRTdmcgKGZpbGVuYW1lKSB7XG4gICAgbGV0IGZpbGVFbnRyeSA9IGF3YWl0IHRoaXMuZ2V0RmlsZShmaWxlbmFtZSwgdGhpcy5DT05URU5UX0ZPUk1BVFMuZG9tKTtcbiAgICBpZiAoIWZpbGVFbnRyeSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGRvd25sb2FkIG5vbi1leGlzdGVudCBmaWxlOiAnICsgZmlsZW5hbWUpO1xuICAgIH1cbiAgICBsZXQgZG9tID0gdGhpcy5lbWJlZE1ldGFkYXRhKGZpbGVFbnRyeS5fYXR0YWNobWVudHNbZmlsZUVudHJ5Ll9pZF0uZG9tLCBmaWxlRW50cnkubWV0YWRhdGEpO1xuICAgIGxldCB4bWxUZXh0ID0gbmV3IHdpbmRvdy5YTUxTZXJpYWxpemVyKCkuc2VyaWFsaXplVG9TdHJpbmcoZG9tKVxuICAgICAgLnJlcGxhY2UoLyZsdDshXFxbQ0RBVEFcXFsvZywgJzwhXFxbQ0RBVEFcXFsnKS5yZXBsYWNlKC9dXSZndDsvZywgJ11dPicpO1xuXG4gICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rIHRvIGluaXRpYXRlIHRoZSBkb3dubG9hZFxuICAgIGxldCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICBsZXQgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwobmV3IHdpbmRvdy5CbG9iKFt4bWxUZXh0XSwgeyB0eXBlOiAnaW1hZ2Uvc3ZnK3htbCcgfSkpO1xuICAgIGEuaHJlZiA9IHVybDtcbiAgICBhLmRvd25sb2FkID0gZmlsZW5hbWU7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICBhLmNsaWNrKCk7XG4gICAgd2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcbiAgICBhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSk7XG4gIH1cbiAgbWF0Y2hEYXRhUGF0aHMgKHBhdGgxLCBwYXRoMiwgbWV0YWRhdGEpIHtcbiAgICBpZiAoIW1ldGFkYXRhIHx8ICFtZXRhZGF0YS5kYXRhc2V0cyB8fCAhcGF0aDEgfHwgIXBhdGgyKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGxldCByZXN1bHQxID0ganNvbnBhdGgucXVlcnkobWV0YWRhdGEuZGF0YXNldHMsIHBhdGgxKTtcbiAgICBsZXQgcmVzdWx0MiA9IGpzb25wYXRoLnF1ZXJ5KG1ldGFkYXRhLmRhdGFzZXRzLCBwYXRoMik7XG4gICAgaWYgKHJlc3VsdDEubGVuZ3RoICE9PSAxIHx8IHJlc3VsdDIubGVuZ3RoICE9PSAxKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQxWzBdID09PSByZXN1bHQyWzBdO1xuICB9XG4gIG1hdGNoRG9tU2VsZWN0b3JzIChzZWxlY3RvcjEsIHNlbGVjdG9yMiwgZG9tKSB7XG4gICAgaWYgKCFzZWxlY3RvcjEgfHwgIXNlbGVjdG9yMikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0MSA9IGRvbS5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yMSk7XG4gICAgbGV0IHJlc3VsdDIgPSBkb20ucXVlcnlTZWxlY3RvcihzZWxlY3RvcjIpO1xuICAgIHJldHVybiByZXN1bHQxID09PSByZXN1bHQyO1xuICB9XG4gIGdldE1hdGNoZXMgKG1ldGFkYXRhLCBkb20pIHtcbiAgICBsZXQgY29ubmVjdGlvbnMgPSBbXTtcbiAgICBpZiAobWV0YWRhdGEgJiYgbWV0YWRhdGEuYmluZGluZ3MgJiYgbWV0YWRhdGEuZGF0YXNldHMgJiYgZG9tKSB7XG4gICAgICBkMy52YWx1ZXMobWV0YWRhdGEuYmluZGluZ3MpLmZvckVhY2goYmluZGluZyA9PiB7XG4gICAgICAgIGlmICghYmluZGluZy5kYXRhUm9vdCB8fCAhYmluZGluZy5zdmdSb290IHx8ICFiaW5kaW5nLmtleUZ1bmN0aW9uIHx8ICFiaW5kaW5nLmtleUZ1bmN0aW9uLmRhdGFFeHByZXNzaW9uKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWV2YWwgKi9cbiAgICAgICAgbGV0IGRhdGFFeHByZXNzaW9uID0gKDAsIGV2YWwpKGJpbmRpbmcua2V5RnVuY3Rpb24uZGF0YUV4cHJlc3Npb24pO1xuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWV2YWwgKi9cblxuICAgICAgICBsZXQgZGF0YVJvb3QgPSBqc29ucGF0aC5xdWVyeShtZXRhZGF0YS5kYXRhc2V0cywgYmluZGluZy5kYXRhUm9vdClbMF07XG4gICAgICAgIGxldCBkYXRhSXRlbXM7XG4gICAgICAgIGlmIChkYXRhUm9vdCBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgZGF0YUl0ZW1zID0gZGF0YVJvb3QubWFwKChkLCBpKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBrZXk6IGksXG4gICAgICAgICAgICAgIHZhbHVlOiBkXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhUm9vdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBkYXRhSXRlbXMgPSBkMy5lbnRyaWVzKGRhdGFSb290KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm47IC8vIGEgbGVhZiB3YXMgcGlja2VkIGFzIGEgcm9vdC4uLiBubyBjb25uZWN0aW9ucyBwb3NzaWJsZVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN2Z1Jvb3QgPSBkb20ucXVlcnlTZWxlY3RvcihiaW5kaW5nLnN2Z1Jvb3QpO1xuICAgICAgICBsZXQgc3ZnSXRlbXMgPSBBcnJheS5mcm9tKHN2Z1Jvb3QuY2hpbGRyZW4pO1xuXG4gICAgICAgIGRhdGFJdGVtcy5mb3JFYWNoKGRhdGFJdGVtID0+IHtcbiAgICAgICAgICBsZXQgZGF0YUtleVZhbHVlID0gZGF0YUV4cHJlc3Npb24oZGF0YUl0ZW0udmFsdWUsIGRhdGFJdGVtLmtleSk7XG4gICAgICAgICAgaWYgKGJpbmRpbmcua2V5RnVuY3Rpb24uY3VzdG9tTWFwcGluZykge1xuICAgICAgICAgICAgY29ubmVjdGlvbnMucHVzaCguLi50aGlzLmdldE1hbnVhbENvbm5lY3Rpb25zKGJpbmRpbmcsIGRhdGFLZXlWYWx1ZSwgZGF0YUl0ZW0udmFsdWUsIHN2Z0l0ZW1zKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChiaW5kaW5nLmtleUZ1bmN0aW9uLnN2Z0V4cHJlc3Npb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29ubmVjdGlvbnMucHVzaCguLi50aGlzLmdldEV4cHJlc3Npb25Db25uZWN0aW9ucyhiaW5kaW5nLCBkYXRhS2V5VmFsdWUsIGRhdGFJdGVtLnZhbHVlLCBzdmdJdGVtcykpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25uZWN0aW9ucy5wdXNoKC4uLnRoaXMuZ2V0SW5mZXJyZWRDb25uZWN0aW9ucyhiaW5kaW5nLCBkYXRhS2V5VmFsdWUsIGRhdGFJdGVtLnZhbHVlLCBzdmdJdGVtcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbm5lY3Rpb25zO1xuICB9XG4gIGdldE1hbnVhbENvbm5lY3Rpb25zIChiaW5kaW5nLCBkYXRhS2V5VmFsdWUsIGRhdGFJdGVtLCBzdmdJdGVtcykge1xuICAgIC8vIFRPRE9cbiAgICByZXR1cm4gW107XG4gIH1cbiAgZ2V0RXhwcmVzc2lvbkNvbm5lY3Rpb25zIChiaW5kaW5nLCBkYXRhS2V5VmFsdWUsIGRhdGFJdGVtLCBzdmdJdGVtcykge1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWV2YWwgKi9cbiAgICBsZXQgc3ZnRXhwcmVzc2lvbiA9ICgwLCBldmFsKShiaW5kaW5nLmtleUZ1bmN0aW9uLnN2Z0V4cHJlc3Npb24pO1xuICAgIC8qIGVzbGludC1lbmFibGUgbm8tZXZhbCAqL1xuICAgIGxldCBjb25uZWN0aW9ucyA9IFtdO1xuICAgIHN2Z0l0ZW1zLmZvckVhY2goKHN2Z0l0ZW0sIGl0ZW1JbmRleCkgPT4ge1xuICAgICAgaWYgKHN2Z0V4cHJlc3Npb24oc3ZnSXRlbSwgaXRlbUluZGV4LCBkMy5zZWxlY3Qoc3ZnSXRlbSksIGpRdWVyeShzdmdJdGVtKSkgPT09IGRhdGFLZXlWYWx1ZSkge1xuICAgICAgICBjb25uZWN0aW9ucy5wdXNoKHtcbiAgICAgICAgICBkYXRhSXRlbSxcbiAgICAgICAgICBzdmdJdGVtXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBjb25uZWN0aW9ucztcbiAgfVxuICBnZXRJbmZlcnJlZENvbm5lY3Rpb25zIChiaW5kaW5nLCBkYXRhS2V5VmFsdWUsIGRhdGFJdGVtLCBzdmdJdGVtcykge1xuICAgIC8vIFRPRE9cbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxubGV0IG11cmUgPSBuZXcgTXVyZSgpO1xuZXhwb3J0IGRlZmF1bHQgbXVyZTtcbiJdLCJuYW1lcyI6WyJNdXJlIiwiYXBwTGlzdCIsImRvY3VtZW50Iiwid2luZG93IiwiVkFMSURfRVZFTlRTIiwiQ09OVEVOVF9GT1JNQVRTIiwiU0lHTkFMUyIsIk5TU3RyaW5nIiwibXVyZSIsIndpbmRvd1RpdGxlIiwiZ2V0RWxlbWVudHNCeVRhZ05hbWUiLCJ0ZXh0Q29udGVudCIsImRlYnVnTW9kZSIsImxvY2F0aW9uIiwiaG9zdG5hbWUiLCJzdGFydHNXaXRoIiwiY3VycmVudEFwcCIsInBhdGhuYW1lIiwicmVwbGFjZSIsImxhc3RGaWxlIiwiZGIiLCJnZXRPckluaXREYiIsIm9uIiwid2FybiIsImVycm9yTWVzc2FnZSIsImNhdGNoRGJFcnJvciIsInRyaWdnZXIiLCJlcnJvck9iaiIsIm1lc3NhZ2UiLCJzdGFjayIsImFsZXJ0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjb25maXJtIiwicHJvbXB0IiwiZGVmYXVsdFZhbHVlIiwiZXZlbnROYW1lIiwiY2FsbGJhY2siLCJFcnJvciIsInNob3dEaWFsb2dGdW5jdGlvbiIsImFwcE5hbWUiLCJuZXdUYWIiLCJvcGVuIiwiUG91Y2hEQiIsImdldCIsInByZWZzIiwiY3VycmVudEZpbGUiLCJnZXRGaWxlIiwicHV0IiwiY2hhbmdlcyIsImZpbGVDaGFuZ2VkIiwiZmlsZUxpc3RDaGFuZ2VkIiwiZG9tQ2hhbmdlZCIsIm1ldGFkYXRhQ2hhbmdlZCIsImNoYW5nZSIsImRlbGV0ZWQiLCJkb2MiLCJfaWQiLCJnZXRGaWxlTGlzdCIsImZpbGVMaXN0IiwiY2F0Y2giLCJfYXR0YWNobWVudHMiLCJkaWdlc3QiLCJtZXRhZGF0YURpZ2VzdCIsImdldEZpbGVBc0Jsb2IiLCJibG9iIiwibWV0YWRhdGEiLCJmaWxlbmFtZSIsInRoZW4iLCJjb250ZW50Rm9ybWF0IiwiZ2V0Q3VycmVudEZpbGVuYW1lIiwiZXhjbHVkZSIsImF0dGFjaG1lbnRzIiwiYmluYXJ5IiwicG91Y2hkYk9wdGlvbnMiLCJkb20iLCJ4bWxUZXh0IiwiYXRvYiIsImZpbGVPYmoiLCJkYXRhIiwiRE9NUGFyc2VyIiwicGFyc2VGcm9tU3RyaW5nIiwib3B0aW9ucyIsImJsb2JPckJhc2U2NHN0cmluZyIsIk9iamVjdCIsImtleXMiLCJsZW5ndGgiLCJleGlzdGluZ0RvYyIsInVzZXJDb25maXJtYXRpb24iLCJtZDUiLCJKU09OIiwic3RyaW5naWZ5IiwibmV3RG9jIiwiYWxsRG9jcyIsInJlc3VsdCIsInJvd3MiLCJmb3JFYWNoIiwiZCIsImlkIiwicHVzaCIsInZhbHVlIiwicmV2IiwicmVhZGVyIiwib25sb2FkZW5kIiwidGFyZ2V0Iiwib25lcnJvciIsImVycm9yIiwib25hYm9ydCIsImNhbmNlbGxlZCIsInJlYWRBc1RleHQiLCJvcmlnaW5hbE5hbWUiLCJ0YWtlbk5hbWVzIiwiYWJvcnRGdW5jdGlvbiIsImV4dCIsInR5cGUiLCJzcGxpdCIsImNvbnRlbnRzIiwiZGF0YWxpYiIsInJlYWQiLCJwYXJzZSIsImluZmVyUGFyc2VyIiwicGFyc2VyIiwiZ2V0TWV0YWRhdGEiLCJkYXRhc2V0cyIsIkZpbGVSZWFkZXIiLCJ2YWxpZGF0ZUZpbGVOYW1lIiwibmFtZSIsImFib3J0IiwicmVhZEZpbGUiLCJkYXRhRmlsZU5hbWUiLCJmaWxlVGV4dCIsInNhdmVGaWxlIiwiZXh0cmFjdE1ldGFkYXRhIiwiYmFzZTY0ZGF0YSIsImJ0b2EiLCJYTUxTZXJpYWxpemVyIiwic2VyaWFsaXplVG9TdHJpbmciLCJnZXRGaWxlUmV2aXNpb25zIiwicmV2aXNpb25EaWN0IiwiYWxsIiwiZmlsZW5hbWVQcm9taXNlIiwiY29udGVudHNQcm9taXNlIiwic2V0Q3VycmVudEZpbGUiLCJlcnJMaXN0IiwicmVtb3ZlIiwiX3JldiIsInJlbW92ZVJlc3BvbnNlIiwic2VsZiIsImQzZG9tIiwiZDMiLCJyb290RWxlbWVudCIsInJvb3QiLCJzZWxlY3QiLCJzaXplIiwibnNFbGVtZW50Iiwic2VsZWN0QWxsIiwiZWFjaCIsImxpYnJhcmllcyIsImF0dHIiLCJlbCIsInNjcmlwdCIsImV4dHJhY3RDREFUQSIsInRleHQiLCJzY3JpcHRzIiwiYmluZGluZyIsImJpbmRpbmdzIiwiZW5jb2RpbmciLCJlbmNvZGluZ3MiLCJzdHIiLCJhZGQiLCJuZXdCaW5kaW5nIiwibmV3RW5jb2RpbmciLCJleGl0IiwiZW50ZXIiLCJhcHBlbmQiLCJtZXJnZSIsImxpYnJhcnlMaXN0Iiwic2NyaXB0TGlzdCIsInNjcmlwdHNFbnRlciIsImlubmVySFRNTCIsIm11cmVJbnRlcmFjdGl2aXR5UnVubmVyVGV4dCIsImRhdGFzZXRzRW50ZXIiLCJrZXkiLCJodG1sIiwiYmluZGluZ3NFbnRlciIsImRhdGFSb290Iiwic3ZnUm9vdCIsImtleUZ1bmN0aW9uIiwiZW5jb2RpbmdzRW50ZXIiLCJiaW5kaW5nSWQiLCJzcGVjIiwiZmlsZUVudHJ5IiwiZW1iZWRNZXRhZGF0YSIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIkJsb2IiLCJocmVmIiwidXJsIiwiZG93bmxvYWQiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJhIiwiY2xpY2siLCJyZXZva2VPYmplY3RVUkwiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJwYXRoMSIsInBhdGgyIiwicmVzdWx0MSIsImpzb25wYXRoIiwicmVzdWx0MiIsInNlbGVjdG9yMSIsInNlbGVjdG9yMiIsInF1ZXJ5U2VsZWN0b3IiLCJjb25uZWN0aW9ucyIsImRhdGFFeHByZXNzaW9uIiwiZXZhbCIsImRhdGFJdGVtcyIsIkFycmF5IiwibWFwIiwiaSIsInN2Z0l0ZW1zIiwiZnJvbSIsImNoaWxkcmVuIiwiZGF0YUtleVZhbHVlIiwiZGF0YUl0ZW0iLCJjdXN0b21NYXBwaW5nIiwiZ2V0TWFudWFsQ29ubmVjdGlvbnMiLCJzdmdFeHByZXNzaW9uIiwidW5kZWZpbmVkIiwiZ2V0RXhwcmVzc2lvbkNvbm5lY3Rpb25zIiwiZ2V0SW5mZXJyZWRDb25uZWN0aW9ucyIsInN2Z0l0ZW0iLCJpdGVtSW5kZXgiLCJqUXVlcnkiLCJNb2RlbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7OztBQUdBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNIQTtBQUNBLElBV01BOzs7a0JBQ1c7Ozs7O1VBRVJDLE9BQUwsR0FBZUEsT0FBZjs7O1FBR0ksT0FBT0MsUUFBUCxLQUFvQixXQUFwQixJQUFtQyxPQUFPQyxNQUFQLEtBQWtCLFdBQXpELEVBQXNFOzs7OztVQUtqRUMsWUFBTCxHQUFvQjtzQkFDRixFQURFO2tCQUVOLEVBRk07aUJBR1AsRUFITztzQkFJRixFQUpFO2FBS1g7S0FMVDs7VUFRS0MsZUFBTCxHQUF1QjtlQUNaLENBRFk7WUFFZixDQUZlO1dBR2hCLENBSGdCO2NBSWI7S0FKVjs7VUFPS0MsT0FBTCxHQUFlO2lCQUNGO0tB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
