import { namespaces } from 'd3';
import PouchDB from 'pouchdb';
import PouchDBAuthentication from 'pouchdb-authentication';
import { Model } from 'uki';
import xmlJs from 'xml-js';
import { createParser } from 'scalpel';

console.log(PouchDB);
PouchDB.plugin(PouchDBAuthentication);

var appList = [{
  "name": "docs",
  "description": "The core app / landing page for Mure",
  "author": "Alex Bigelow",
  "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjAuMiwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDJ7b3BhY2l0eTowLjQ1O2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDN7b3BhY2l0eTowLjU1O2ZpbGw6Izc1NzBCMztlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDR7b3BhY2l0eTowLjI7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0NXtmaWxsOiM3NTcwQjM7fQo8L3N0eWxlPgo8cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjMzOS4zLDQwNy4zIDI1Niw1MDYgMTcyLjcsNDA3LjMgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDEiIHBvaW50cz0iMjE0LjEsMzcyLjIgMjk3LjUsMjczLjUgMzgwLjgsMzcyLjIgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDIiIHBvaW50cz0iNTA2LDI3My41IDQyMi43LDM3Mi4yIDMzOS4zLDI3My41ICIvPgo8cG9seWdvbiBjbGFzcz0ic3QzIiBwb2ludHM9IjI1NiwyMzguNSAzMzkuMywxMzkuOCA0MjIuNywyMzguNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MiIgcG9pbnRzPSIyNTYsMjczLjUgMTcyLjcsMzcyLjIgODkuMywyNzMuNSAiLz4KPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI2LDIzOC41IDg5LjMsMTM5LjggMTcyLjcsMjM4LjUgIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDQiIHBvaW50cz0iMjk3LjUsMTM5LjggMjE0LjEsMjM4LjUgMTMwLjgsMTM5LjggIi8+Cjxwb2x5Z29uIGNsYXNzPSJzdDUiIHBvaW50cz0iMTcyLjcsMTA0LjcgMjU2LDYgMzM5LjMsMTA0LjcgIi8+Cjwvc3ZnPgo="
}, {
  "name": "data-binder",
  "description": "A Mure app that is responsible for (re)binding data to graphics",
  "author": "Alex Bigelow",
  "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjEuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe29wYWNpdHk6MC42O2ZpbGw6I0U2QUIwMjt9Cgkuc3Qxe29wYWNpdHk6MC4zO2ZpbGw6I0U2QUIwMjt9Cgkuc3Qye29wYWNpdHk6MC42O2ZpbGw6Izc1NzBCMzt9Cgkuc3Qze2ZpbGw6Izc1NzBCMzt9Cgkuc3Q0e29wYWNpdHk6MC4zO2ZpbGw6Izc1NzBCMzt9Cgkuc3Q1e2ZpbGw6I0U2QUIwMjt9Cjwvc3R5bGU+CjxnPgoJPHBhdGggY2xhc3M9InN0MCIgZD0iTTExOS43LDI2Ny43di0yMy40YzU5LjYsMCw3Ny4zLTE5LjcsODMuMi0yNi4xYzE0LjEtMTUuNywxOS0zNy40LDI0LjItNjAuNGM1LjQtMjQsMTEtNDguOSwyNy45LTY4LjMKCQlDMjc0LjEsNjcuNiwzMDQuNiw1NywzNDguMyw1N3YyMy40Yy0zNi41LDAtNjEuMyw4LTc1LjgsMjQuNWMtMTMsMTQuOS0xNy43LDM1LjgtMjIuNyw1OGMtNS42LDI0LjktMTEuNCw1MC42LTI5LjYsNzAuOQoJCUMxOTkuNywyNTYuNiwxNjYuOCwyNjcuNywxMTkuNywyNjcuN3oiLz4KCTxwYXRoIGNsYXNzPSJzdDEiIGQ9Ik0xMTkuNyw0NTV2LTIzLjRjMzQuNCwwLDk0LjMtNDAuMiwxNjQuNC0xMTAuM2wxNi42LDE2LjZDMjQ3LjEsMzkxLjMsMTcyLjQsNDU1LDExOS43LDQ1NXoiLz4KCTxwYXRoIGNsYXNzPSJzdDIiIGQ9Ik03LjUsMjk5LjVjMzIuNy0yNi43LDU2LjYtNDcuMiw1Ni42LTYzLjhjMC0xMS03LTE2LjItMTcuOC0xNi4yYy05LjEsMC0xNi4yLDUuOC0yMi44LDExLjZMNiwyMTMuMwoJCWMxMy4zLTEzLjUsMjUuNy0xOS43LDQ1LTE5LjdjMjYuMywwLDQ0LjcsMTUuOSw0NC43LDQwLjJjMCwxOS43LTIwLjUsNDEuNC00MC42LDU4LjRjNi44LTAuOCwxNi0xLjUsMjItMS41aDI0Ljd2MjcuOEg3LjVWMjk5LjV6IgoJCS8+Cgk8cGF0aCBjbGFzcz0ic3QzIiBkPSJNOC4yLDEwMy45SDM5VjM5LjNIMTMuNFYxOC41YzE1LTIuOCwyNC44LTYuMywzNC43LTEyLjJoMjQuOHY5Ny43aDI2Ljh2MjcuMkg4LjJWMTAzLjl6Ii8+Cgk8cGF0aCBjbGFzcz0ic3Q0IiBkPSJNNi41LDQ4OC43bDE0LjgtMjAuNWM4LDYuOCwxOC4yLDExLjQsMjcuMywxMS40YzExLjgsMCwyMC4xLTMuOCwyMC4xLTExLjRjMC05LjEtNi42LTE0LjQtMzMuNC0xNC40VjQzMQoJCWMyMS42LDAsMjkuNi01LjMsMjkuNi0xMy43YzAtNy4yLTUuNy0xMS0xNS4yLTExYy04LjcsMC0xNS42LDMuNC0yMy45LDkuOUw5LjUsMzk2LjRjMTIuMy05LjksMjYuMi0xNS42LDQxLjgtMTUuNgoJCWMyNy43LDAsNDYuMywxMi4xLDQ2LjMsMzRjMCwxMS42LTcuOCwyMC4zLTIyLDI2djAuOGMxNC44LDQuMiwyNS44LDEzLjcsMjUuOCwyOC44YzAsMjIuOC0yMy4zLDM1LjMtNDkuMywzNS4zCgkJQzMxLjUsNTA1LjgsMTYsNDk5LjMsNi41LDQ4OC43eiIvPgoJPHJlY3QgeD0iMzA1LjQiIHk9IjE5MS42IiBjbGFzcz0ic3Q0IiB3aWR0aD0iMTI0LjkiIGhlaWdodD0iMTI0LjkiLz4KCTxjaXJjbGUgY2xhc3M9InN0MiIgY3g9IjQzNy43IiBjeT0iNzQuNSIgcj0iNjguMyIvPgoJPHBvbHlnb24gY2xhc3M9InN0MyIgcG9pbnRzPSI0MjcuMSwzNjkuMiAzNDguMyw1MDUuOCA1MDYsNTA1LjggCSIvPgoJPHBhdGggY2xhc3M9InN0NSIgZD0iTTM1My45LDQ0OS4yYy0zNC42LDAtNjUtNC41LTkwLjMtMTMuM2MtMjMuOC04LjMtNDMuOS0yMC43LTU5LjgtMzYuOGMtNTMtNTMuNy01MS44LTE0MC01MC45LTIwOS4zCgkJYzAuNi00NC44LDEuMi04Ny4yLTE0LTEwMi41Yy00LjYtNC43LTEwLjctNi44LTE5LjItNi44VjU3YzE0LjgsMCwyNi45LDQuNiwzNS45LDEzLjhjMjIsMjIuMywyMS40LDY3LjMsMjAuNywxMTkuMwoJCWMtMC45LDY4LjMtMiwxNDUuNyw0NC4yLDE5Mi41YzI4LjcsMjkuMSw3Mi4zLDQzLjIsMTMzLjUsNDMuMlY0NDkuMnoiLz4KPC9nPgo8L3N2Zz4K"
}, {
  "name": "encoding-manager",
  "description": "A Mure app that is responsible for learning / applying data constraints to graphics",
  "author": "Alex Bigelow",
  "icon": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDIxLjEuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHdpZHRoPSI1MTJweCIgaGVpZ2h0PSI1MTJweCIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDUxMiA1MTI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojNzU3MEIzO30KCS5zdDF7ZmlsbDojRTZBQjAyO30KCS5zdDJ7b3BhY2l0eTowLjE7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0M3tvcGFjaXR5OjAuOTtmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cgkuc3Q0e29wYWNpdHk6MC4yO2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDV7b3BhY2l0eTowLjg7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0NntvcGFjaXR5OjAuMztmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cgkuc3Q3e29wYWNpdHk6MC43O2ZpbGw6I0U2QUIwMjtlbmFibGUtYmFja2dyb3VuZDpuZXcgICAgO30KCS5zdDh7b3BhY2l0eTowLjQ7ZmlsbDojRTZBQjAyO2VuYWJsZS1iYWNrZ3JvdW5kOm5ldyAgICA7fQoJLnN0OXtvcGFjaXR5OjAuNjtmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cgkuc3QxMHtvcGFjaXR5OjAuNTtmaWxsOiNFNkFCMDI7ZW5hYmxlLWJhY2tncm91bmQ6bmV3ICAgIDt9Cjwvc3R5bGU+Cjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iMjczLjksMzgxIDI3My45LDM0OS44IDE2NC41LDM0OS44IDE2NC41LDI3MS42IDIyMC4zLDI3MS42IDIyMC4zLDI0MC40IDE2NC41LDI0MC40IDE2NC41LDE2Mi4yIAoJMjIwLjMsMTYyLjIgMjIwLjMsMTMxIDE2NC41LDEzMSAxNjQuNSw1Mi45IDIyMC4zLDUyLjkgMjIwLjMsMjEuNiAxNjQuNSwyMS42IDE2NC41LDYgMTMzLjIsNiAxMzMuMiwyMS42IDc3LjQsMjEuNiA3Ny40LDUyLjkgCgkxMzMuMiw1Mi45IDEzMy4yLDEzMSA3Ny40LDEzMSA3Ny40LDE2Mi4yIDEzMy4yLDE2Mi4yIDEzMy4yLDI0MC40IDc3LjQsMjQwLjQgNzcuNCwyNzEuNiAxMzMuMiwyNzEuNiAxMzMuMiwzNDkuOCAyMy45LDM0OS44IAoJMjMuOSwzODEgMTMzLjIsMzgxIDEzMy4yLDQ1OS4xIDc3LjQsNDU5LjEgNzcuNCw0OTAuNCAxMzMuMiw0OTAuNCAxMzMuMiw1MDYgMTY0LjUsNTA2IDE2NC41LDQ5MC40IDIyMC4zLDQ5MC40IDIyMC4zLDQ1OS4xIAoJMTY0LjUsNDU5LjEgMTY0LjUsMzgxICIvPgo8cmVjdCB4PSIzMDkuNiIgeT0iNiIgY2xhc3M9InN0MSIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSI0MTYuNyIgeT0iNiIgY2xhc3M9InN0MiIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSIzMDkuNiIgeT0iMTEzLjEiIGNsYXNzPSJzdDMiIHdpZHRoPSI3MS40IiBoZWlnaHQ9IjcxLjQiLz4KPHJlY3QgeD0iNDE2LjciIHk9IjExMy4xIiBjbGFzcz0ic3Q0IiB3aWR0aD0iNzEuNCIgaGVpZ2h0PSI3MS40Ii8+CjxyZWN0IHg9IjMwOS42IiB5PSIyMjAuMyIgY2xhc3M9InN0NSIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSI0MTYuNyIgeT0iMjIwLjMiIGNsYXNzPSJzdDYiIHdpZHRoPSI3MS40IiBoZWlnaHQ9IjcxLjQiLz4KPHJlY3QgeD0iMzA5LjYiIHk9IjMyNy40IiBjbGFzcz0ic3Q3IiB3aWR0aD0iNzEuNCIgaGVpZ2h0PSI3MS40Ii8+CjxyZWN0IHg9IjQxNi43IiB5PSIzMjcuNCIgY2xhc3M9InN0OCIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8cmVjdCB4PSIzMDkuNiIgeT0iNDM0LjYiIGNsYXNzPSJzdDkiIHdpZHRoPSI3MS40IiBoZWlnaHQ9IjcxLjQiLz4KPHJlY3QgeD0iNDE2LjciIHk9IjQzNC42IiBjbGFzcz0ic3QxMCIgd2lkdGg9IjcxLjQiIGhlaWdodD0iNzEuNCIvPgo8L3N2Zz4K"
}];

var defaultSvgDocTemplate = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" width=\"500\" height=\"500\">\n  <metadata id=\"mure\">\n    <mure xmlns=\"http://mure-apps.github.io\">\n    </mure>\n  </metadata>\n  <script id=\"mureInteractivityRunner\" type=\"text/javascript\">\n    <![CDATA[\n      ${mureInteractivityRunnerText}\n    ]]>\n  </script>\n</svg>\n";

var minimumSvgDoc = "<svg>\n  <metadata id=\"mure\">\n    <mure xmlns=\"http://mure-apps.github.io\">\n    </mure>\n  </metadata>\n</svg>\n";

// sneakily embed the interactivity-running script
var defaultSvgDoc = eval('`' + defaultSvgDocTemplate + '`'); // eslint-disable-line no-eval

var DocHandler = function () {
  /**
   *
   */
  function DocHandler() {
    babelHelpers.classCallCheck(this, DocHandler);

    this.selectorParser = createParser();
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

  babelHelpers.createClass(DocHandler, [{
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
          nodes.unshift.apply(nodes, babelHelpers.toConsumableArray(obj.elements));
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
  babelHelpers.inherits(Mure, _Model);

  function Mure() {
    babelHelpers.classCallCheck(this, Mure);

    var _this = babelHelpers.possibleConstructorReturn(this, (Mure.__proto__ || Object.getPrototypeOf(Mure)).call(this));

    _this.appList = appList;
    // Check if we're even being used in the browser (mostly useful for getting
    // access to the applist in all-apps-dev-server.js)
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return babelHelpers.possibleConstructorReturn(_this);
    }

    // Enumerations...
    _this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

    // The namespace string for our custom XML
    _this.NSString = 'http://mure-apps.github.io';
    namespaces.mure = _this.NSString;

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
    _this.db = new PouchDB('mure');

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

  babelHelpers.createClass(Mure, [{
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
      var couchDbUrl = window.localStorage.getItem('couchDbUrl');
      if (couchDbUrl) {
        babelHelpers.asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
          var couchDb;
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  couchDb = new PouchDB(couchDbUrl, { skip_setup: true });
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
      var _ref2 = babelHelpers.asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(docId) {
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
}(Model);

var mure = new Mure();

export default mure;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5lcy5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3BvdWNoRGJDb25maWcuanMiLCIuLi9zcmMvZG9jSGFuZGxlci5qcyIsIi4uL3NyYy9tdXJlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQb3VjaERCIGZyb20gJ3BvdWNoZGInO1xuY29uc29sZS5sb2coUG91Y2hEQik7XG5pbXBvcnQgUG91Y2hEQkF1dGhlbnRpY2F0aW9uIGZyb20gJ3BvdWNoZGItYXV0aGVudGljYXRpb24nO1xuUG91Y2hEQi5wbHVnaW4oUG91Y2hEQkF1dGhlbnRpY2F0aW9uKTtcbmV4cG9ydCBkZWZhdWx0IFBvdWNoREI7XG4iLCJpbXBvcnQgeG1sSnMgZnJvbSAneG1sLWpzJztcbmltcG9ydCB7IGNyZWF0ZVBhcnNlciB9IGZyb20gJ3NjYWxwZWwnO1xuaW1wb3J0IG11cmVJbnRlcmFjdGl2aXR5UnVubmVyVGV4dCBmcm9tICcuL211cmVJbnRlcmFjdGl2aXR5UnVubmVyLnRleHQuanMnOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgZGVmYXVsdFN2Z0RvY1RlbXBsYXRlIGZyb20gJy4vZGVmYXVsdC50ZXh0LnN2Zyc7XG5pbXBvcnQgbWluaW11bVN2Z0RvYyBmcm9tICcuL21pbmltdW0udGV4dC5zdmcnO1xuXG4vLyBzbmVha2lseSBlbWJlZCB0aGUgaW50ZXJhY3Rpdml0eS1ydW5uaW5nIHNjcmlwdFxuY29uc3QgZGVmYXVsdFN2Z0RvYyA9IGV2YWwoJ2AnICsgZGVmYXVsdFN2Z0RvY1RlbXBsYXRlICsgJ2AnKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1ldmFsXG5cbmNsYXNzIERvY0hhbmRsZXIge1xuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yICgpIHtcbiAgICB0aGlzLnNlbGVjdG9yUGFyc2VyID0gY3JlYXRlUGFyc2VyKCk7XG4gICAgLy8gdG9kbzogZm9yIGVmZmljaWVuY3ksIEkgc2hvdWxkIHJlbmFtZSBhbGwgb2YgeG1sLWpzJ3MgZGVmYXVsdCAobGVuZ3RoeSEpIGtleSBuYW1lc1xuICAgIHRoaXMua2V5TmFtZXMgPSB7fTtcbiAgICB0aGlzLmpzb24yeG1sU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICdjb21wYWN0JzogZmFsc2UsXG4gICAgICAnaW5kZW50Q2RhdGEnOiB0cnVlXG4gICAgfSwgdGhpcy5rZXlOYW1lcyk7XG4gICAgdGhpcy54bWwyanNvblNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7XG4gICAgICAnY29tcGFjdCc6IGZhbHNlLFxuICAgICAgJ25hdGl2ZVR5cGUnOiB0cnVlLFxuICAgICAgJ2Fsd2F5c0FycmF5JzogdHJ1ZSxcbiAgICAgICdhZGRQYXJlbnQnOiB0cnVlXG4gICAgfSwgdGhpcy5rZXlOYW1lcyk7XG4gICAgdGhpcy5kZWZhdWx0SnNvbkRvYyA9IHRoaXMueG1sMmpzb24oZGVmYXVsdFN2Z0RvYyk7XG4gICAgdGhpcy5taW5pbXVtSnNEb2MgPSB0aGlzLnhtbDJqcyhtaW5pbXVtU3ZnRG9jKTtcbiAgfVxuICB4bWwyanMgKHRleHQpIHsgcmV0dXJuIHhtbEpzLnhtbDJqcyh0ZXh0LCB0aGlzLnhtbDJqc29uU2V0dGluZ3MpOyB9XG4gIHhtbDJqc29uICh0ZXh0KSB7IHJldHVybiB4bWxKcy54bWwyanNvbih0ZXh0LCB0aGlzLnhtbDJqc29uU2V0dGluZ3MpOyB9XG4gIGpzb24yeG1sICh0ZXh0KSB7IHJldHVybiB4bWxKcy5qc29uMnhtbCh0ZXh0LCB0aGlzLmpzb24yeG1sU2V0dGluZ3MpOyB9XG4gIGpzMnhtbCAodGV4dCkgeyByZXR1cm4geG1sSnMuanMyeG1sKHRleHQsIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyk7IH1cbiAgc3RhbmRhcmRpemUgKHRlc3RPYmosIHN0YW5kYXJkT2JqKSB7XG4gICAgaWYgKCFzdGFuZGFyZE9iaikge1xuICAgICAgaWYgKCF0ZXN0T2JqLl9pZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGF0IGxlYXN0IHN1cHBseSBhbiBpZCB0byBzdGFuZGFyZGl6ZSB0aGUgZG9jdW1lbnQnKTtcbiAgICAgIH1cbiAgICAgIHRlc3RPYmouY3VycmVudFNlbGVjdGlvbiA9IHRlc3RPYmouY3VycmVudFNlbGVjdGlvbiB8fCBudWxsO1xuICAgICAgdGVzdE9iai5jb250ZW50cyA9IHRoaXMuc3RhbmRhcmRpemUodGVzdE9iai5jb250ZW50cyB8fCB7fSwgdGhpcy5taW5pbXVtSnNEb2MpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPXG4gICAgfVxuICAgIHJldHVybiB0ZXN0T2JqO1xuICB9XG4gIGl0ZXJhdGUgKG9iaiwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBub2RlcyA9IFtdO1xuICAgIG5vZGVzLnB1c2gob2JqKTtcbiAgICBkbyB7XG4gICAgICBvYmogPSBub2Rlcy5zaGlmdCgpO1xuICAgICAgY2FsbGJhY2sob2JqKTtcbiAgICAgIGlmIChvYmouZWxlbWVudHMpIHtcbiAgICAgICAgbm9kZXMudW5zaGlmdCguLi5vYmouZWxlbWVudHMpO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKG5vZGVzLmxlbmd0aCA+IDApO1xuICB9XG4gIG1hdGNoT2JqZWN0IChvYmosIHF1ZXJ5VG9rZW5zKSB7XG4gICAgLy8gVE9ET1xuICB9XG4gIHNlbGVjdEFsbCAocm9vdCwgc2VsZWN0b3IpIHtcbiAgICBjb25zdCBxdWVyeVRva2VucyA9IHRoaXMuc2VsZWN0b3JQYXJzZXIucGFyc2Uoc2VsZWN0b3IpO1xuICAgIGNvbnN0IGVsZW1lbnRzID0gW107XG4gICAgdGhpcy5pdGVyYXRlKHJvb3QsIG9iaiA9PiB7XG4gICAgICBpZiAodGhpcy5tYXRjaE9iamVjdChvYmosIHF1ZXJ5VG9rZW5zKSkge1xuICAgICAgICBlbGVtZW50cy5wdXNoKG9iaik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGVsZW1lbnRzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBEb2NIYW5kbGVyKCk7XG4iLCJpbXBvcnQgKiBhcyBkMyBmcm9tICdkMyc7XG5pbXBvcnQgUG91Y2hEQiBmcm9tICcuL3BvdWNoRGJDb25maWcuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICd1a2knO1xuaW1wb3J0IGFwcExpc3QgZnJvbSAnLi9hcHBMaXN0Lmpzb24nO1xuaW1wb3J0IGRvY0ggZnJvbSAnLi9kb2NIYW5kbGVyLmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIE1vZGVsIHtcbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5hcHBMaXN0ID0gYXBwTGlzdDtcbiAgICAvLyBDaGVjayBpZiB3ZSdyZSBldmVuIGJlaW5nIHVzZWQgaW4gdGhlIGJyb3dzZXIgKG1vc3RseSB1c2VmdWwgZm9yIGdldHRpbmdcbiAgICAvLyBhY2Nlc3MgdG8gdGhlIGFwcGxpc3QgaW4gYWxsLWFwcHMtZGV2LXNlcnZlci5qcylcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEVudW1lcmF0aW9ucy4uLlxuICAgIHRoaXMuQ09OVEVOVF9GT1JNQVRTID0ge1xuICAgICAgZXhjbHVkZTogMCxcbiAgICAgIGJsb2I6IDEsXG4gICAgICBkb206IDIsXG4gICAgICBiYXNlNjQ6IDNcbiAgICB9O1xuXG4gICAgLy8gVGhlIG5hbWVzcGFjZSBzdHJpbmcgZm9yIG91ciBjdXN0b20gWE1MXG4gICAgdGhpcy5OU1N0cmluZyA9ICdodHRwOi8vbXVyZS1hcHBzLmdpdGh1Yi5pbyc7XG4gICAgZDMubmFtZXNwYWNlcy5tdXJlID0gdGhpcy5OU1N0cmluZztcblxuICAgIC8vIEZ1bmt5IHN0dWZmIHRvIGZpZ3VyZSBvdXQgaWYgd2UncmUgZGVidWdnaW5nIChpZiB0aGF0J3MgdGhlIGNhc2UsIHdlIHdhbnQgdG8gdXNlXG4gICAgLy8gbG9jYWxob3N0IGluc3RlYWQgb2YgdGhlIGdpdGh1YiBsaW5rIGZvciBhbGwgbGlua3MpXG4gICAgbGV0IHdpbmRvd1RpdGxlID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RpdGxlJylbMF07XG4gICAgd2luZG93VGl0bGUgPSB3aW5kb3dUaXRsZSA/IHdpbmRvd1RpdGxlLnRleHRDb250ZW50IDogJyc7XG4gICAgdGhpcy5kZWJ1Z01vZGUgPSB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUgPT09ICdsb2NhbGhvc3QnICYmIHdpbmRvd1RpdGxlLnN0YXJ0c1dpdGgoJ011cmUnKTtcblxuICAgIC8vIEZpZ3VyZSBvdXQgd2hpY2ggYXBwIHdlIGFyZSAob3IgbnVsbCBpZiB0aGUgbXVyZSBsaWJyYXJ5IGlzIGJlaW5nIHVzZWQgc29tZXdoZXJlIGVsc2UpXG4gICAgdGhpcy5jdXJyZW50QXBwID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnJlcGxhY2UoL1xcLy9nLCAnJyk7XG4gICAgaWYgKCF0aGlzLmFwcExpc3RbdGhpcy5jdXJyZW50QXBwXSkge1xuICAgICAgdGhpcy5jdXJyZW50QXBwID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgLyBsb2FkIHRoZSBsb2NhbCBkYXRhYmFzZSBvZiBmaWxlc1xuICAgIHRoaXMuZGIgPSBuZXcgUG91Y2hEQignbXVyZScpO1xuXG4gICAgLy8gZGVmYXVsdCBlcnJvciBoYW5kbGluZyAoYXBwcyBjYW4gbGlzdGVuIGZvciAvIGRpc3BsYXkgZXJyb3IgbWVzc2FnZXMgaW4gYWRkaXRpb24gdG8gdGhpcyk6XG4gICAgdGhpcy5vbignZXJyb3InLCBlcnJvck1lc3NhZ2UgPT4ge1xuICAgICAgY29uc29sZS53YXJuKGVycm9yTWVzc2FnZSk7XG4gICAgfSk7XG4gICAgdGhpcy5jYXRjaERiRXJyb3IgPSBlcnJvck9iaiA9PiB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2Vycm9yJywgJ1VuZXhwZWN0ZWQgZXJyb3IgcmVhZGluZyBQb3VjaERCOiAnICsgZXJyb3JPYmoubWVzc2FnZSArICdcXG4nICsgZXJyb3JPYmouc3RhY2spO1xuICAgIH07XG5cbiAgICAvLyBpbiB0aGUgYWJzZW5jZSBvZiBhIGN1c3RvbSBkaWFsb2dzLCBqdXN0IHVzZSB3aW5kb3cuYWxlcnQsIHdpbmRvdy5jb25maXJtIGFuZCB3aW5kb3cucHJvbXB0OlxuICAgIHRoaXMuYWxlcnQgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgd2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xuICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLmNvbmZpcm0gPSAobWVzc2FnZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh3aW5kb3cuY29uZmlybShtZXNzYWdlKSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMucHJvbXB0ID0gKG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkgPT4ge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh3aW5kb3cucHJvbXB0KG1lc3NhZ2UsIGRlZmF1bHRWYWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuICBjdXN0b21pemVBbGVydERpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5hbGVydCA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVDb25maXJtRGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmNvbmZpcm0gPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgY3VzdG9taXplUHJvbXB0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLnByb21wdCA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBvcGVuQXBwIChhcHBOYW1lLCBuZXdUYWIpIHtcbiAgICBpZiAobmV3VGFiKSB7XG4gICAgICB3aW5kb3cub3BlbignLycgKyBhcHBOYW1lLCAnX2JsYW5rJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSA9ICcvJyArIGFwcE5hbWU7XG4gICAgfVxuICB9XG4gIGdldE9ySW5pdERiICgpIHtcbiAgICBsZXQgZGIgPSBuZXcgUG91Y2hEQignbXVyZScpO1xuICAgIGxldCBjb3VjaERiVXJsID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjb3VjaERiVXJsJyk7XG4gICAgaWYgKGNvdWNoRGJVcmwpIHtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGxldCBjb3VjaERiID0gbmV3IFBvdWNoREIoY291Y2hEYlVybCwge3NraXBfc2V0dXA6IHRydWV9KTtcbiAgICAgICAgcmV0dXJuIGRiLnN5bmMoY291Y2hEYiwge2xpdmU6IHRydWUsIHJldHJ5OiB0cnVlfSk7XG4gICAgICB9KSgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRoaXMuYWxlcnQoJ0Vycm9yIHN5bmNpbmcgd2l0aCAnICsgY291Y2hEYlVybCArICc6ICcgK1xuICAgICAgICAgIGVyci5tZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gZGI7XG4gIH1cbiAgLyoqXG4gICAqIEEgd3JhcHBlciBhcm91bmQgUG91Y2hEQi5nZXQoKSB0aGF0IGVuc3VyZXMgdGhhdCB0aGUgcmV0dXJuZWQgZG9jdW1lbnRcbiAgICogZXhpc3RzICh1c2VzIGRlZmF1bHQudGV4dC5zdmcgd2hlbiBpdCBkb2Vzbid0KSwgYW5kIGhhcyBhdCBsZWFzdCB0aGVcbiAgICogZWxlbWVudHMgc3BlY2lmaWVkIGJ5IG1pbmltdW0udGV4dC5zdmdcbiAgICogQHJldHVybiB7b2JqZWN0fSBBIFBvdWNoREIgZG9jdW1lbnRcbiAgICovXG4gIGdldFN0YW5kYXJkaXplZERvYyAoZG9jSWQpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoZG9jSWQpXG4gICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKGVyci5uYW1lID09PSAnbm90X2ZvdW5kJykge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBfaWQ6IGRvY0lkLFxuICAgICAgICAgICAgY3VycmVudFNlbGVjdGlvbjogbnVsbCxcbiAgICAgICAgICAgIGNvbnRlbnRzOiBKU09OLnBhcnNlKGRvY0guZGVmYXVsdEpzb25Eb2MpXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pLnRoZW4oZG9jID0+IHtcbiAgICAgICAgcmV0dXJuIGRvY0guc3RhbmRhcmRpemUoZG9jKTtcbiAgICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgZG93bmxvYWREb2MgKGRvY0lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZGIuZ2V0KGRvY0lkKVxuICAgICAgLnRoZW4oZG9jID0+IHtcbiAgICAgICAgbGV0IHhtbFRleHQgPSBkb2NILmpzMnhtbChkb2MuY29udGVudHMpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIGZha2UgbGluayB0byBpbml0aWF0ZSB0aGUgZG93bmxvYWRcbiAgICAgICAgbGV0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGEuc3R5bGUgPSAnZGlzcGxheTpub25lJztcbiAgICAgICAgbGV0IHVybCA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyB3aW5kb3cuQmxvYihbeG1sVGV4dF0sIHsgdHlwZTogJ2ltYWdlL3N2Zyt4bWwnIH0pKTtcbiAgICAgICAgYS5ocmVmID0gdXJsO1xuICAgICAgICBhLmRvd25sb2FkID0gZG9jLl9pZDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICAgICAgYS5jbGljaygpO1xuICAgICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xuICAgICAgICBhLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYSk7XG4gICAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBuZXcgTXVyZSgpO1xuIl0sIm5hbWVzIjpbImNvbnNvbGUiLCJsb2ciLCJQb3VjaERCIiwicGx1Z2luIiwiUG91Y2hEQkF1dGhlbnRpY2F0aW9uIiwiZGVmYXVsdFN2Z0RvYyIsImV2YWwiLCJkZWZhdWx0U3ZnRG9jVGVtcGxhdGUiLCJEb2NIYW5kbGVyIiwic2VsZWN0b3JQYXJzZXIiLCJjcmVhdGVQYXJzZXIiLCJrZXlOYW1lcyIsImpzb24yeG1sU2V0dGluZ3MiLCJPYmplY3QiLCJhc3NpZ24iLCJ4bWwyanNvblNldHRpbmdzIiwiZGVmYXVsdEpzb25Eb2MiLCJ4bWwyanNvbiIsIm1pbmltdW1Kc0RvYyIsInhtbDJqcyIsIm1pbmltdW1TdmdEb2MiLCJ0ZXh0IiwieG1sSnMiLCJqc29uMnhtbCIsImpzMnhtbCIsInRlc3RPYmoiLCJzdGFuZGFyZE9iaiIsIl9pZCIsIkVycm9yIiwiY3VycmVudFNlbGVjdGlvbiIsImNvbnRlbnRzIiwic3RhbmRhcmRpemUiLCJvYmoiLCJjYWxsYmFjayIsIm5vZGVzIiwicHVzaCIsInNoaWZ0IiwiZWxlbWVudHMiLCJ1bnNoaWZ0IiwibGVuZ3RoIiwicXVlcnlUb2tlbnMiLCJyb290Iiwic2VsZWN0b3IiLCJwYXJzZSIsIml0ZXJhdGUiLCJtYXRjaE9iamVjdCIsIk11cmUiLCJhcHBMaXN0IiwiZG9jdW1lbnQiLCJ3aW5kb3ciLCJDT05URU5UX0ZPUk1BVFMiLCJOU1N0cmluZyIsIm11cmUiLCJ3aW5kb3dUaXRsZSIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwidGV4dENvbnRlbnQiLCJkZWJ1Z01vZGUiLCJsb2NhdGlvbiIsImhvc3RuYW1lIiwic3RhcnRzV2l0aCIsImN1cnJlbnRBcHAiLCJwYXRobmFtZSIsInJlcGxhY2UiLCJkYiIsIm9uIiwid2FybiIsImVycm9yTWVzc2FnZSIsImNhdGNoRGJFcnJvciIsInRyaWdnZXIiLCJlcnJvck9iaiIsIm1lc3NhZ2UiLCJzdGFjayIsImFsZXJ0IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjb25maXJtIiwicHJvbXB0IiwiZGVmYXVsdFZhbHVlIiwic2hvd0RpYWxvZ0Z1bmN0aW9uIiwiYXBwTmFtZSIsIm5ld1RhYiIsIm9wZW4iLCJjb3VjaERiVXJsIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsInNraXBfc2V0dXAiLCJzeW5jIiwiY291Y2hEYiIsImxpdmUiLCJyZXRyeSIsImNhdGNoIiwiZXJyIiwiZG9jSWQiLCJnZXQiLCJuYW1lIiwiSlNPTiIsImRvY0giLCJ0aGVuIiwiZG9jIiwieG1sVGV4dCIsImEiLCJjcmVhdGVFbGVtZW50Iiwic3R5bGUiLCJ1cmwiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJCbG9iIiwidHlwZSIsImhyZWYiLCJkb3dubG9hZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmV2b2tlT2JqZWN0VVJMIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwiTW9kZWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFDQUEsUUFBUUMsR0FBUixDQUFZQyxPQUFaO0FBQ0EsQUFDQUEsUUFBUUMsTUFBUixDQUFlQyxxQkFBZjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUNHQTtBQUNBLElBQU1DLGdCQUFnQkMsS0FBSyxNQUFNQyxxQkFBTixHQUE4QixHQUFuQyxDQUF0Qjs7SUFFTUM7Ozs7d0JBSVc7OztTQUNSQyxjQUFMLEdBQXNCQyxjQUF0Qjs7U0FFS0MsUUFBTCxHQUFnQixFQUFoQjtTQUNLQyxnQkFBTCxHQUF3QkMsT0FBT0MsTUFBUCxDQUFjO2lCQUN6QixLQUR5QjtxQkFFckI7S0FGTyxFQUdyQixLQUFLSCxRQUhnQixDQUF4QjtTQUlLSSxnQkFBTCxHQUF3QkYsT0FBT0MsTUFBUCxDQUFjO2lCQUN6QixLQUR5QjtvQkFFdEIsSUFGc0I7cUJBR3JCLElBSHFCO21CQUl2QjtLQUpTLEVBS3JCLEtBQUtILFFBTGdCLENBQXhCO1NBTUtLLGNBQUwsR0FBc0IsS0FBS0MsUUFBTCxDQUFjWixhQUFkLENBQXRCO1NBQ0thLFlBQUwsR0FBb0IsS0FBS0MsTUFBTCxDQUFZQyxhQUFaLENBQXBCOzs7OzsyQkFFTUMsTUFBTTthQUFTQyxNQUFNSCxNQUFOLENBQWFFLElBQWIsRUFBbUIsS0FBS04sZ0JBQXhCLENBQVA7Ozs7NkJBQ05NLE1BQU07YUFBU0MsTUFBTUwsUUFBTixDQUFlSSxJQUFmLEVBQXFCLEtBQUtOLGdCQUExQixDQUFQOzs7OzZCQUNSTSxNQUFNO2FBQVNDLE1BQU1DLFFBQU4sQ0FBZUYsSUFBZixFQUFxQixLQUFLVCxnQkFBMUIsQ0FBUDs7OzsyQkFDVlMsTUFBTTthQUFTQyxNQUFNRSxNQUFOLENBQWFILElBQWIsRUFBbUIsS0FBS1QsZ0JBQXhCLENBQVA7Ozs7Z0NBQ0hhLFNBQVNDLGFBQWE7VUFDN0IsQ0FBQ0EsV0FBTCxFQUFrQjtZQUNaLENBQUNELFFBQVFFLEdBQWIsRUFBa0I7Z0JBQ1YsSUFBSUMsS0FBSixDQUFVLDREQUFWLENBQU47O2dCQUVNQyxnQkFBUixHQUEyQkosUUFBUUksZ0JBQVIsSUFBNEIsSUFBdkQ7Z0JBQ1FDLFFBQVIsR0FBbUIsS0FBS0MsV0FBTCxDQUFpQk4sUUFBUUssUUFBUixJQUFvQixFQUFyQyxFQUF5QyxLQUFLWixZQUE5QyxDQUFuQjtPQUxGLE1BTU87OzthQUdBTyxPQUFQOzs7OzRCQUVPTyxLQUFLQyxVQUFVO1VBQ2hCQyxRQUFRLEVBQWQ7WUFDTUMsSUFBTixDQUFXSCxHQUFYO1NBQ0c7Y0FDS0UsTUFBTUUsS0FBTixFQUFOO2lCQUNTSixHQUFUO1lBQ0lBLElBQUlLLFFBQVIsRUFBa0I7Z0JBQ1ZDLE9BQU4sNkNBQWlCTixJQUFJSyxRQUFyQjs7T0FKSixRQU1TSCxNQUFNSyxNQUFOLEdBQWUsQ0FOeEI7Ozs7Z0NBUVdQLEtBQUtRLGFBQWE7Ozs7OzhCQUdwQkMsTUFBTUMsVUFBVTs7O1VBQ25CRixjQUFjLEtBQUsvQixjQUFMLENBQW9Ca0MsS0FBcEIsQ0FBMEJELFFBQTFCLENBQXBCO1VBQ01MLFdBQVcsRUFBakI7V0FDS08sT0FBTCxDQUFhSCxJQUFiLEVBQW1CLGVBQU87WUFDcEIsTUFBS0ksV0FBTCxDQUFpQmIsR0FBakIsRUFBc0JRLFdBQXRCLENBQUosRUFBd0M7bUJBQzdCTCxJQUFULENBQWNILEdBQWQ7O09BRko7YUFLT0ssUUFBUDs7Ozs7O0FBSUosV0FBZSxJQUFJN0IsVUFBSixFQUFmOztJQ2xFTXNDOzs7a0JBQ1c7Ozs7O1VBRVJDLE9BQUwsR0FBZUEsT0FBZjs7O1FBR0ksT0FBT0MsUUFBUCxLQUFvQixXQUFwQixJQUFtQyxPQUFPQyxNQUFQLEtBQWtCLFdBQXpELEVBQXNFOzs7OztVQUtqRUMsZUFBTCxHQUF1QjtlQUNaLENBRFk7WUFFZixDQUZlO1dBR2hCLENBSGdCO2NBSWI7S0FKVjs7O1VBUUtDLFFBQUwsR0FBZ0IsNEJBQWhCO2NBQ0EsQ0FBY0MsSUFBZCxHQUFxQixNQUFLRCxRQUExQjs7OztRQUlJRSxjQUFjTCxTQUFTTSxvQkFBVCxDQUE4QixPQUE5QixFQUF1QyxDQUF2QyxDQUFsQjtrQkFDY0QsY0FBY0EsWUFBWUUsV0FBMUIsR0FBd0MsRUFBdEQ7VUFDS0MsU0FBTCxHQUFpQlAsT0FBT1EsUUFBUCxDQUFnQkMsUUFBaEIsS0FBNkIsV0FBN0IsSUFBNENMLFlBQVlNLFVBQVosQ0FBdUIsTUFBdkIsQ0FBN0Q7OztVQUdLQyxVQUFMLEdBQWtCWCxPQUFPUSxRQUFQLENBQWdCSSxRQUFoQixDQUF5QkMsT0FBekIsQ0FBaUMsS0FBakMsRUFBd0MsRUFBeEMsQ0FBbEI7UUFDSSxDQUFDLE1BQUtmLE9BQUwsQ0FBYSxNQUFLYSxVQUFsQixDQUFMLEVBQW9DO1lBQzdCQSxVQUFMLEdBQWtCLElBQWxCOzs7O1VBSUdHLEVBQUwsR0FBVSxJQUFJN0QsT0FBSixDQUFZLE1BQVosQ0FBVjs7O1VBR0s4RCxFQUFMLENBQVEsT0FBUixFQUFpQix3QkFBZ0I7Y0FDdkJDLElBQVIsQ0FBYUMsWUFBYjtLQURGO1VBR0tDLFlBQUwsR0FBb0Isb0JBQVk7WUFDekJDLE9BQUwsQ0FBYSxPQUFiLEVBQXNCLHVDQUF1Q0MsU0FBU0MsT0FBaEQsR0FBMEQsSUFBMUQsR0FBaUVELFNBQVNFLEtBQWhHO0tBREY7OztVQUtLQyxLQUFMLEdBQWEsVUFBQ0YsT0FBRCxFQUFhO2FBQ2pCLElBQUlHLE9BQUosQ0FBWSxVQUFDQyxPQUFELEVBQVVDLE1BQVYsRUFBcUI7ZUFDL0JILEtBQVAsQ0FBYUYsT0FBYjtnQkFDUSxJQUFSO09BRkssQ0FBUDtLQURGO1VBTUtNLE9BQUwsR0FBZSxVQUFDTixPQUFELEVBQWE7YUFDbkIsSUFBSUcsT0FBSixDQUFZLFVBQUNDLE9BQUQsRUFBVUMsTUFBVixFQUFxQjtnQkFDOUIxQixPQUFPMkIsT0FBUCxDQUFlTixPQUFmLENBQVI7T0FESyxDQUFQO0tBREY7VUFLS08sTUFBTCxHQUFjLFVBQUNQLE9BQUQsRUFBVVEsWUFBVixFQUEyQjthQUNoQyxJQUFJTCxPQUFKLENBQVksVUFBQ0MsT0FBRCxFQUFVQyxNQUFWLEVBQXFCO2dCQUM5QjFCLE9BQU80QixNQUFQLENBQWNQLE9BQWQsRUFBdUJRLFlBQXZCLENBQVI7T0FESyxDQUFQO0tBREY7Ozs7Ozt5Q0FNb0JDLG9CQUFvQjtXQUNuQ1AsS0FBTCxHQUFhTyxrQkFBYjs7OzsyQ0FFc0JBLG9CQUFvQjtXQUNyQ0gsT0FBTCxHQUFlRyxrQkFBZjs7OzswQ0FFcUJBLG9CQUFvQjtXQUNwQ0YsTUFBTCxHQUFjRSxrQkFBZDs7Ozs0QkFFT0MsU0FBU0MsUUFBUTtVQUNwQkEsTUFBSixFQUFZO2VBQ0hDLElBQVAsQ0FBWSxNQUFNRixPQUFsQixFQUEyQixRQUEzQjtPQURGLE1BRU87ZUFDRXZCLFFBQVAsQ0FBZ0JJLFFBQWhCLEdBQTJCLE1BQU1tQixPQUFqQzs7Ozs7a0NBR1c7OztVQUNUakIsS0FBSyxJQUFJN0QsT0FBSixDQUFZLE1BQVosQ0FBVDtVQUNJaUYsYUFBYWxDLE9BQU9tQyxZQUFQLENBQW9CQyxPQUFwQixDQUE0QixZQUE1QixDQUFqQjtVQUNJRixVQUFKLEVBQWdCOzRFQUNiOzs7Ozs7eUJBQUEsR0FDZSxJQUFJakYsT0FBSixDQUFZaUYsVUFBWixFQUF3QixFQUFDRyxZQUFZLElBQWIsRUFBeEIsQ0FEZjttREFFUXZCLEdBQUd3QixJQUFILENBQVFDLE9BQVIsRUFBaUIsRUFBQ0MsTUFBTSxJQUFQLEVBQWFDLE9BQU8sSUFBcEIsRUFBakIsQ0FGUjs7Ozs7Ozs7U0FBRCxLQUdLQyxLQUhMLENBR1csZUFBTztpQkFDWG5CLEtBQUwsQ0FBVyx3QkFBd0JXLFVBQXhCLEdBQXFDLElBQXJDLEdBQ1RTLElBQUl0QixPQUROO1NBSkY7O2FBUUtQLEVBQVA7Ozs7Ozs7Ozs7O3VDQVFrQjhCLE9BQU87YUFDbEIsS0FBSzlCLEVBQUwsQ0FBUStCLEdBQVIsQ0FBWUQsS0FBWixFQUNKRixLQURJLENBQ0UsZUFBTztZQUNSQyxJQUFJRyxJQUFKLEtBQWEsV0FBakIsRUFBOEI7aUJBQ3JCO2lCQUNBRixLQURBOzhCQUVhLElBRmI7c0JBR0tHLEtBQUtyRCxLQUFMLENBQVdzRCxLQUFLakYsY0FBaEI7V0FIWjtTQURGLE1BTU87Z0JBQ0M0RSxHQUFOOztPQVRDLEVBV0ZNLElBWEUsQ0FXRyxlQUFPO2VBQ05ELEtBQUtsRSxXQUFMLENBQWlCb0UsR0FBakIsQ0FBUDtPQVpHLENBQVA7Ozs7Ozs7Ozt3R0FrQmlCTjs7Ozs7a0RBQ1YsS0FBSzlCLEVBQUwsQ0FBUStCLEdBQVIsQ0FBWUQsS0FBWixFQUNKSyxJQURJLENBQ0MsZUFBTztzQkFDUEUsVUFBVUgsS0FBS3pFLE1BQUwsQ0FBWTJFLElBQUlyRSxRQUFoQixDQUFkOzs7c0JBR0l1RSxJQUFJckQsU0FBU3NELGFBQVQsQ0FBdUIsR0FBdkIsQ0FBUjtvQkFDRUMsS0FBRixHQUFVLGNBQVY7c0JBQ0lDLE1BQU12RCxPQUFPd0QsR0FBUCxDQUFXQyxlQUFYLENBQTJCLElBQUl6RCxPQUFPMEQsSUFBWCxDQUFnQixDQUFDUCxPQUFELENBQWhCLEVBQTJCLEVBQUVRLE1BQU0sZUFBUixFQUEzQixDQUEzQixDQUFWO29CQUNFQyxJQUFGLEdBQVNMLEdBQVQ7b0JBQ0VNLFFBQUYsR0FBYVgsSUFBSXhFLEdBQWpCOzJCQUNTb0YsSUFBVCxDQUFjQyxXQUFkLENBQTBCWCxDQUExQjtvQkFDRVksS0FBRjt5QkFDT1IsR0FBUCxDQUFXUyxlQUFYLENBQTJCVixHQUEzQjtvQkFDRVcsVUFBRixDQUFhQyxXQUFiLENBQXlCZixDQUF6QjtpQkFiRzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBdkhRZ0I7O0FBeUluQixXQUFlLElBQUl2RSxJQUFKLEVBQWY7Ozs7In0=
