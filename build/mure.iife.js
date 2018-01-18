var mure = (function (d3,PouchDB,PouchDBAuthentication,uki,xmlJs,scalpel) {
'use strict';

PouchDB = PouchDB && PouchDB.hasOwnProperty('default') ? PouchDB['default'] : PouchDB;
PouchDBAuthentication = PouchDBAuthentication && PouchDBAuthentication.hasOwnProperty('default') ? PouchDBAuthentication['default'] : PouchDBAuthentication;
xmlJs = xmlJs && xmlJs.hasOwnProperty('default') ? xmlJs['default'] : xmlJs;

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
}(uki.Model);

var mure = new Mure();

return mure;

}(d3,PouchDB,PouchDBAuthentication,uki,xmlJs,scalpel));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS5paWZlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcG91Y2hEYkNvbmZpZy5qcyIsIi4uL3NyYy9kb2NIYW5kbGVyLmpzIiwiLi4vc3JjL211cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFBvdWNoREIgZnJvbSAncG91Y2hkYic7XG5jb25zb2xlLmxvZyhQb3VjaERCKTtcbmltcG9ydCBQb3VjaERCQXV0aGVudGljYXRpb24gZnJvbSAncG91Y2hkYi1hdXRoZW50aWNhdGlvbic7XG5Qb3VjaERCLnBsdWdpbihQb3VjaERCQXV0aGVudGljYXRpb24pO1xuZXhwb3J0IGRlZmF1bHQgUG91Y2hEQjtcbiIsImltcG9ydCB4bWxKcyBmcm9tICd4bWwtanMnO1xuaW1wb3J0IHsgY3JlYXRlUGFyc2VyIH0gZnJvbSAnc2NhbHBlbCc7XG5pbXBvcnQgbXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0IGZyb20gJy4vbXVyZUludGVyYWN0aXZpdHlSdW5uZXIudGV4dC5qcyc7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBkZWZhdWx0U3ZnRG9jVGVtcGxhdGUgZnJvbSAnLi9kZWZhdWx0LnRleHQuc3ZnJztcbmltcG9ydCBtaW5pbXVtU3ZnRG9jIGZyb20gJy4vbWluaW11bS50ZXh0LnN2Zyc7XG5cbi8vIHNuZWFraWx5IGVtYmVkIHRoZSBpbnRlcmFjdGl2aXR5LXJ1bm5pbmcgc2NyaXB0XG5jb25zdCBkZWZhdWx0U3ZnRG9jID0gZXZhbCgnYCcgKyBkZWZhdWx0U3ZnRG9jVGVtcGxhdGUgKyAnYCcpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWV2YWxcblxuY2xhc3MgRG9jSGFuZGxlciB7XG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHRoaXMuc2VsZWN0b3JQYXJzZXIgPSBjcmVhdGVQYXJzZXIoKTtcbiAgICAvLyB0b2RvOiBmb3IgZWZmaWNpZW5jeSwgSSBzaG91bGQgcmVuYW1lIGFsbCBvZiB4bWwtanMncyBkZWZhdWx0IChsZW5ndGh5ISkga2V5IG5hbWVzXG4gICAgdGhpcy5rZXlOYW1lcyA9IHt9O1xuICAgIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgJ2NvbXBhY3QnOiBmYWxzZSxcbiAgICAgICdpbmRlbnRDZGF0YSc6IHRydWVcbiAgICB9LCB0aGlzLmtleU5hbWVzKTtcbiAgICB0aGlzLnhtbDJqc29uU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICdjb21wYWN0JzogZmFsc2UsXG4gICAgICAnbmF0aXZlVHlwZSc6IHRydWUsXG4gICAgICAnYWx3YXlzQXJyYXknOiB0cnVlLFxuICAgICAgJ2FkZFBhcmVudCc6IHRydWVcbiAgICB9LCB0aGlzLmtleU5hbWVzKTtcbiAgICB0aGlzLmRlZmF1bHRKc29uRG9jID0gdGhpcy54bWwyanNvbihkZWZhdWx0U3ZnRG9jKTtcbiAgICB0aGlzLm1pbmltdW1Kc0RvYyA9IHRoaXMueG1sMmpzKG1pbmltdW1TdmdEb2MpO1xuICB9XG4gIHhtbDJqcyAodGV4dCkgeyByZXR1cm4geG1sSnMueG1sMmpzKHRleHQsIHRoaXMueG1sMmpzb25TZXR0aW5ncyk7IH1cbiAgeG1sMmpzb24gKHRleHQpIHsgcmV0dXJuIHhtbEpzLnhtbDJqc29uKHRleHQsIHRoaXMueG1sMmpzb25TZXR0aW5ncyk7IH1cbiAganNvbjJ4bWwgKHRleHQpIHsgcmV0dXJuIHhtbEpzLmpzb24yeG1sKHRleHQsIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyk7IH1cbiAganMyeG1sICh0ZXh0KSB7IHJldHVybiB4bWxKcy5qczJ4bWwodGV4dCwgdGhpcy5qc29uMnhtbFNldHRpbmdzKTsgfVxuICBzdGFuZGFyZGl6ZSAodGVzdE9iaiwgc3RhbmRhcmRPYmopIHtcbiAgICBpZiAoIXN0YW5kYXJkT2JqKSB7XG4gICAgICBpZiAoIXRlc3RPYmouX2lkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgYXQgbGVhc3Qgc3VwcGx5IGFuIGlkIHRvIHN0YW5kYXJkaXplIHRoZSBkb2N1bWVudCcpO1xuICAgICAgfVxuICAgICAgdGVzdE9iai5jdXJyZW50U2VsZWN0aW9uID0gdGVzdE9iai5jdXJyZW50U2VsZWN0aW9uIHx8IG51bGw7XG4gICAgICB0ZXN0T2JqLmNvbnRlbnRzID0gdGhpcy5zdGFuZGFyZGl6ZSh0ZXN0T2JqLmNvbnRlbnRzIHx8IHt9LCB0aGlzLm1pbmltdW1Kc0RvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRPRE9cbiAgICB9XG4gICAgcmV0dXJuIHRlc3RPYmo7XG4gIH1cbiAgaXRlcmF0ZSAob2JqLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgbm9kZXMucHVzaChvYmopO1xuICAgIGRvIHtcbiAgICAgIG9iaiA9IG5vZGVzLnNoaWZ0KCk7XG4gICAgICBjYWxsYmFjayhvYmopO1xuICAgICAgaWYgKG9iai5lbGVtZW50cykge1xuICAgICAgICBub2Rlcy51bnNoaWZ0KC4uLm9iai5lbGVtZW50cyk7XG4gICAgICB9XG4gICAgfSB3aGlsZSAobm9kZXMubGVuZ3RoID4gMCk7XG4gIH1cbiAgbWF0Y2hPYmplY3QgKG9iaiwgcXVlcnlUb2tlbnMpIHtcbiAgICAvLyBUT0RPXG4gIH1cbiAgc2VsZWN0QWxsIChyb290LCBzZWxlY3Rvcikge1xuICAgIGNvbnN0IHF1ZXJ5VG9rZW5zID0gdGhpcy5zZWxlY3RvclBhcnNlci5wYXJzZShzZWxlY3Rvcik7XG4gICAgY29uc3QgZWxlbWVudHMgPSBbXTtcbiAgICB0aGlzLml0ZXJhdGUocm9vdCwgb2JqID0+IHtcbiAgICAgIGlmICh0aGlzLm1hdGNoT2JqZWN0KG9iaiwgcXVlcnlUb2tlbnMpKSB7XG4gICAgICAgIGVsZW1lbnRzLnB1c2gob2JqKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZWxlbWVudHM7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgbmV3IERvY0hhbmRsZXIoKTtcbiIsImltcG9ydCAqIGFzIGQzIGZyb20gJ2QzJztcbmltcG9ydCBQb3VjaERCIGZyb20gJy4vcG91Y2hEYkNvbmZpZy5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJ3VraSc7XG5pbXBvcnQgYXBwTGlzdCBmcm9tICcuL2FwcExpc3QuanNvbic7XG5pbXBvcnQgZG9jSCBmcm9tICcuL2RvY0hhbmRsZXIuanMnO1xuXG5jbGFzcyBNdXJlIGV4dGVuZHMgTW9kZWwge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmFwcExpc3QgPSBhcHBMaXN0O1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGV2ZW4gYmVpbmcgdXNlZCBpbiB0aGUgYnJvd3NlciAobW9zdGx5IHVzZWZ1bCBmb3IgZ2V0dGluZ1xuICAgIC8vIGFjY2VzcyB0byB0aGUgYXBwbGlzdCBpbiBhbGwtYXBwcy1kZXYtc2VydmVyLmpzKVxuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRW51bWVyYXRpb25zLi4uXG4gICAgdGhpcy5DT05URU5UX0ZPUk1BVFMgPSB7XG4gICAgICBleGNsdWRlOiAwLFxuICAgICAgYmxvYjogMSxcbiAgICAgIGRvbTogMixcbiAgICAgIGJhc2U2NDogM1xuICAgIH07XG5cbiAgICAvLyBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3Igb3VyIGN1c3RvbSBYTUxcbiAgICB0aGlzLk5TU3RyaW5nID0gJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJztcbiAgICBkMy5uYW1lc3BhY2VzLm11cmUgPSB0aGlzLk5TU3RyaW5nO1xuXG4gICAgLy8gRnVua3kgc3R1ZmYgdG8gZmlndXJlIG91dCBpZiB3ZSdyZSBkZWJ1Z2dpbmcgKGlmIHRoYXQncyB0aGUgY2FzZSwgd2Ugd2FudCB0byB1c2VcbiAgICAvLyBsb2NhbGhvc3QgaW5zdGVhZCBvZiB0aGUgZ2l0aHViIGxpbmsgZm9yIGFsbCBsaW5rcylcbiAgICBsZXQgd2luZG93VGl0bGUgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgndGl0bGUnKVswXTtcbiAgICB3aW5kb3dUaXRsZSA9IHdpbmRvd1RpdGxlID8gd2luZG93VGl0bGUudGV4dENvbnRlbnQgOiAnJztcbiAgICB0aGlzLmRlYnVnTW9kZSA9IHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSA9PT0gJ2xvY2FsaG9zdCcgJiYgd2luZG93VGl0bGUuc3RhcnRzV2l0aCgnTXVyZScpO1xuXG4gICAgLy8gRmlndXJlIG91dCB3aGljaCBhcHAgd2UgYXJlIChvciBudWxsIGlmIHRoZSBtdXJlIGxpYnJhcnkgaXMgYmVpbmcgdXNlZCBzb21ld2hlcmUgZWxzZSlcbiAgICB0aGlzLmN1cnJlbnRBcHAgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUucmVwbGFjZSgvXFwvL2csICcnKTtcbiAgICBpZiAoIXRoaXMuYXBwTGlzdFt0aGlzLmN1cnJlbnRBcHBdKSB7XG4gICAgICB0aGlzLmN1cnJlbnRBcHAgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSAvIGxvYWQgdGhlIGxvY2FsIGRhdGFiYXNlIG9mIGZpbGVzXG4gICAgdGhpcy5kYiA9IG5ldyBQb3VjaERCKCdtdXJlJyk7XG5cbiAgICAvLyBkZWZhdWx0IGVycm9yIGhhbmRsaW5nIChhcHBzIGNhbiBsaXN0ZW4gZm9yIC8gZGlzcGxheSBlcnJvciBtZXNzYWdlcyBpbiBhZGRpdGlvbiB0byB0aGlzKTpcbiAgICB0aGlzLm9uKCdlcnJvcicsIGVycm9yTWVzc2FnZSA9PiB7XG4gICAgICBjb25zb2xlLndhcm4oZXJyb3JNZXNzYWdlKTtcbiAgICB9KTtcbiAgICB0aGlzLmNhdGNoRGJFcnJvciA9IGVycm9yT2JqID0+IHtcbiAgICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCAnVW5leHBlY3RlZCBlcnJvciByZWFkaW5nIFBvdWNoREI6ICcgKyBlcnJvck9iai5tZXNzYWdlICsgJ1xcbicgKyBlcnJvck9iai5zdGFjayk7XG4gICAgfTtcblxuICAgIC8vIGluIHRoZSBhYnNlbmNlIG9mIGEgY3VzdG9tIGRpYWxvZ3MsIGp1c3QgdXNlIHdpbmRvdy5hbGVydCwgd2luZG93LmNvbmZpcm0gYW5kIHdpbmRvdy5wcm9tcHQ6XG4gICAgdGhpcy5hbGVydCA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB3aW5kb3cuYWxlcnQobWVzc2FnZSk7XG4gICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHRoaXMuY29uZmlybSA9IChtZXNzYWdlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHdpbmRvdy5jb25maXJtKG1lc3NhZ2UpKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy5wcm9tcHQgPSAobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICByZXNvbHZlKHdpbmRvdy5wcm9tcHQobWVzc2FnZSwgZGVmYXVsdFZhbHVlKSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9XG4gIGN1c3RvbWl6ZUFsZXJ0RGlhbG9nIChzaG93RGlhbG9nRnVuY3Rpb24pIHtcbiAgICB0aGlzLmFsZXJ0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZUNvbmZpcm1EaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuY29uZmlybSA9IHNob3dEaWFsb2dGdW5jdGlvbjtcbiAgfVxuICBjdXN0b21pemVQcm9tcHREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMucHJvbXB0ID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIG9wZW5BcHAgKGFwcE5hbWUsIG5ld1RhYikge1xuICAgIGlmIChuZXdUYWIpIHtcbiAgICAgIHdpbmRvdy5vcGVuKCcvJyArIGFwcE5hbWUsICdfYmxhbmsnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lID0gJy8nICsgYXBwTmFtZTtcbiAgICB9XG4gIH1cbiAgZ2V0T3JJbml0RGIgKCkge1xuICAgIGxldCBkYiA9IG5ldyBQb3VjaERCKCdtdXJlJyk7XG4gICAgbGV0IGNvdWNoRGJVcmwgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oJ2NvdWNoRGJVcmwnKTtcbiAgICBpZiAoY291Y2hEYlVybCkge1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgbGV0IGNvdWNoRGIgPSBuZXcgUG91Y2hEQihjb3VjaERiVXJsLCB7c2tpcF9zZXR1cDogdHJ1ZX0pO1xuICAgICAgICByZXR1cm4gZGIuc3luYyhjb3VjaERiLCB7bGl2ZTogdHJ1ZSwgcmV0cnk6IHRydWV9KTtcbiAgICAgIH0pKCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgdGhpcy5hbGVydCgnRXJyb3Igc3luY2luZyB3aXRoICcgKyBjb3VjaERiVXJsICsgJzogJyArXG4gICAgICAgICAgZXJyLm1lc3NhZ2UpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBkYjtcbiAgfVxuICAvKipcbiAgICogQSB3cmFwcGVyIGFyb3VuZCBQb3VjaERCLmdldCgpIHRoYXQgZW5zdXJlcyB0aGF0IHRoZSByZXR1cm5lZCBkb2N1bWVudFxuICAgKiBleGlzdHMgKHVzZXMgZGVmYXVsdC50ZXh0LnN2ZyB3aGVuIGl0IGRvZXNuJ3QpLCBhbmQgaGFzIGF0IGxlYXN0IHRoZVxuICAgKiBlbGVtZW50cyBzcGVjaWZpZWQgYnkgbWluaW11bS50ZXh0LnN2Z1xuICAgKiBAcmV0dXJuIHtvYmplY3R9IEEgUG91Y2hEQiBkb2N1bWVudFxuICAgKi9cbiAgZ2V0U3RhbmRhcmRpemVkRG9jIChkb2NJZCkge1xuICAgIHJldHVybiB0aGlzLmRiLmdldChkb2NJZClcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICBpZiAoZXJyLm5hbWUgPT09ICdub3RfZm91bmQnKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIF9pZDogZG9jSWQsXG4gICAgICAgICAgICBjdXJyZW50U2VsZWN0aW9uOiBudWxsLFxuICAgICAgICAgICAgY29udGVudHM6IEpTT04ucGFyc2UoZG9jSC5kZWZhdWx0SnNvbkRvYylcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfSkudGhlbihkb2MgPT4ge1xuICAgICAgICByZXR1cm4gZG9jSC5zdGFuZGFyZGl6ZShkb2MpO1xuICAgICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqXG4gICAqL1xuICBhc3luYyBkb3dubG9hZERvYyAoZG9jSWQpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoZG9jSWQpXG4gICAgICAudGhlbihkb2MgPT4ge1xuICAgICAgICBsZXQgeG1sVGV4dCA9IGRvY0guanMyeG1sKGRvYy5jb250ZW50cyk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rIHRvIGluaXRpYXRlIHRoZSBkb3dubG9hZFxuICAgICAgICBsZXQgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgYS5zdHlsZSA9ICdkaXNwbGF5Om5vbmUnO1xuICAgICAgICBsZXQgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwobmV3IHdpbmRvdy5CbG9iKFt4bWxUZXh0XSwgeyB0eXBlOiAnaW1hZ2Uvc3ZnK3htbCcgfSkpO1xuICAgICAgICBhLmhyZWYgPSB1cmw7XG4gICAgICAgIGEuZG93bmxvYWQgPSBkb2MuX2lkO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGEpO1xuICAgICAgICBhLmNsaWNrKCk7XG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgIGEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhKTtcbiAgICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBNdXJlKCk7XG4iXSwibmFtZXMiOlsiY29uc29sZSIsImxvZyIsIlBvdWNoREIiLCJwbHVnaW4iLCJQb3VjaERCQXV0aGVudGljYXRpb24iLCJkZWZhdWx0U3ZnRG9jIiwiZXZhbCIsImRlZmF1bHRTdmdEb2NUZW1wbGF0ZSIsIkRvY0hhbmRsZXIiLCJzZWxlY3RvclBhcnNlciIsImNyZWF0ZVBhcnNlciIsImtleU5hbWVzIiwianNvbjJ4bWxTZXR0aW5ncyIsIk9iamVjdCIsImFzc2lnbiIsInhtbDJqc29uU2V0dGluZ3MiLCJkZWZhdWx0SnNvbkRvYyIsInhtbDJqc29uIiwibWluaW11bUpzRG9jIiwieG1sMmpzIiwibWluaW11bVN2Z0RvYyIsInRleHQiLCJ4bWxKcyIsImpzb24yeG1sIiwianMyeG1sIiwidGVzdE9iaiIsInN0YW5kYXJkT2JqIiwiX2lkIiwiRXJyb3IiLCJjdXJyZW50U2VsZWN0aW9uIiwiY29udGVudHMiLCJzdGFuZGFyZGl6ZSIsIm9iaiIsImNhbGxiYWNrIiwibm9kZXMiLCJwdXNoIiwic2hpZnQiLCJlbGVtZW50cyIsInVuc2hpZnQiLCJsZW5ndGgiLCJxdWVyeVRva2VucyIsInJvb3QiLCJzZWxlY3RvciIsInBhcnNlIiwiaXRlcmF0ZSIsIm1hdGNoT2JqZWN0IiwiTXVyZSIsImFwcExpc3QiLCJkb2N1bWVudCIsIndpbmRvdyIsIkNPTlRFTlRfRk9STUFUUyIsIk5TU3RyaW5nIiwibXVyZSIsIndpbmRvd1RpdGxlIiwiZ2V0RWxlbWVudHNCeVRhZ05hbWUiLCJ0ZXh0Q29udGVudCIsImRlYnVnTW9kZSIsImxvY2F0aW9uIiwiaG9zdG5hbWUiLCJzdGFydHNXaXRoIiwiY3VycmVudEFwcCIsInBhdGhuYW1lIiwicmVwbGFjZSIsImRiIiwib24iLCJ3YXJuIiwiZXJyb3JNZXNzYWdlIiwiY2F0Y2hEYkVycm9yIiwidHJpZ2dlciIsImVycm9yT2JqIiwibWVzc2FnZSIsInN0YWNrIiwiYWxlcnQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvbmZpcm0iLCJwcm9tcHQiLCJkZWZhdWx0VmFsdWUiLCJzaG93RGlhbG9nRnVuY3Rpb24iLCJhcHBOYW1lIiwibmV3VGFiIiwib3BlbiIsImNvdWNoRGJVcmwiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwic2tpcF9zZXR1cCIsInN5bmMiLCJjb3VjaERiIiwibGl2ZSIsInJldHJ5IiwiY2F0Y2giLCJlcnIiLCJkb2NJZCIsImdldCIsIm5hbWUiLCJKU09OIiwiZG9jSCIsInRoZW4iLCJkb2MiLCJ4bWxUZXh0IiwiYSIsImNyZWF0ZUVsZW1lbnQiLCJzdHlsZSIsInVybCIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsIkJsb2IiLCJ0eXBlIiwiaHJlZiIsImRvd25sb2FkIiwiYm9keSIsImFwcGVuZENoaWxkIiwiY2xpY2siLCJyZXZva2VPYmplY3RVUkwiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJNb2RlbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUNBQSxRQUFRQyxHQUFSLENBQVlDLE9BQVo7QUFDQSxBQUNBQSxRQUFRQyxNQUFSLENBQWVDLHFCQUFmOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0dBO0FBQ0EsSUFBTUMsZ0JBQWdCQyxLQUFLLE1BQU1DLHFCQUFOLEdBQThCLEdBQW5DLENBQXRCOztJQUVNQzs7Ozt3QkFJVzs7O1NBQ1JDLGNBQUwsR0FBc0JDLHNCQUF0Qjs7U0FFS0MsUUFBTCxHQUFnQixFQUFoQjtTQUNLQyxnQkFBTCxHQUF3QkMsT0FBT0MsTUFBUCxDQUFjO2lCQUN6QixLQUR5QjtxQkFFckI7S0FGTyxFQUdyQixLQUFLSCxRQUhnQixDQUF4QjtTQUlLSSxnQkFBTCxHQUF3QkYsT0FBT0MsTUFBUCxDQUFjO2lCQUN6QixLQUR5QjtvQkFFdEIsSUFGc0I7cUJBR3JCLElBSHFCO21CQUl2QjtL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
