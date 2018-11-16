(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.origraph = factory());
}(this, (function () { 'use strict';

  const TriggerableMixin = function (superclass) {
    return class extends superclass {
      constructor() {
        super(...arguments);
        this._instanceOfTriggerableMixin = true;
        this._eventHandlers = {};
        this._stickyTriggers = {};
      }

      on(eventName, callback, allowDuplicateListeners) {
        if (!this._eventHandlers[eventName]) {
          this._eventHandlers[eventName] = [];
        }

        if (!allowDuplicateListeners) {
          if (this._eventHandlers[eventName].indexOf(callback) !== -1) {
            return;
          }
        }

        this._eventHandlers[eventName].push(callback);
      }

      off(eventName, callback) {
        if (this._eventHandlers[eventName]) {
          if (!callback) {
            delete this._eventHandlers[eventName];
          } else {
            let index = this._eventHandlers[eventName].indexOf(callback);

            if (index >= 0) {
              this._eventHandlers[eventName].splice(index, 1);
            }
          }
        }
      }

      trigger(eventName, ...args) {
        if (this._eventHandlers[eventName]) {
          this._eventHandlers[eventName].forEach(callback => {
            setTimeout(() => {
              // Add timeout to prevent blocking
              callback.apply(this, args);
            }, 0);
          });
        }
      }

      stickyTrigger(eventName, argObj, delay = 10) {
        this._stickyTriggers[eventName] = this._stickyTriggers[eventName] || {
          argObj: {}
        };
        Object.assign(this._stickyTriggers[eventName].argObj, argObj);
        clearTimeout(this._stickyTriggers.timeout);
        this._stickyTriggers.timeout = setTimeout(() => {
          let argObj = this._stickyTriggers[eventName].argObj;
          delete this._stickyTriggers[eventName];
          this.trigger(eventName, argObj);
        }, delay);
      }

    };
  };

  Object.defineProperty(TriggerableMixin, Symbol.hasInstance, {
    value: i => !!i._instanceOfTriggerableMixin
  });

  function _asyncIterator(iterable) {
    var method;

    if (typeof Symbol === "function") {
      if (Symbol.asyncIterator) {
        method = iterable[Symbol.asyncIterator];
        if (method != null) return method.call(iterable);
      }

      if (Symbol.iterator) {
        method = iterable[Symbol.iterator];
        if (method != null) return method.call(iterable);
      }
    }

    throw new TypeError("Object is not async iterable");
  }

  function _AwaitValue(value) {
    this.wrapped = value;
  }

  function _AsyncGenerator(gen) {
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
        var wrappedAwait = value instanceof _AwaitValue;
        Promise.resolve(wrappedAwait ? value.wrapped : value).then(function (arg) {
          if (wrappedAwait) {
            resume("next", arg);
            return;
          }

          settle(result.done ? "return" : "normal", arg);
        }, function (err) {
          resume("throw", err);
        });
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
    _AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  _AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  _AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  _AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  function _wrapAsyncGenerator(fn) {
    return function () {
      return new _AsyncGenerator(fn.apply(this, arguments));
    };
  }

  function _awaitAsyncGenerator(value) {
    return new _AwaitValue(value);
  }

  function _asyncGeneratorDelegate(inner, awaitWrap) {
    var iter = {},
        waiting = false;

    function pump(key, value) {
      waiting = true;
      value = new Promise(function (resolve) {
        resolve(inner[key](value));
      });
      return {
        done: false,
        value: awaitWrap(value)
      };
    }

    if (typeof Symbol === "function" && Symbol.iterator) {
      iter[Symbol.iterator] = function () {
        return this;
      };
    }

    iter.next = function (value) {
      if (waiting) {
        waiting = false;
        return value;
      }

      return pump("next", value);
    };

    if (typeof inner.throw === "function") {
      iter.throw = function (value) {
        if (waiting) {
          waiting = false;
          throw value;
        }

        return pump("throw", value);
      };
    }

    if (typeof inner.return === "function") {
      iter.return = function (value) {
        return pump("return", value);
      };
    }

    return iter;
  }

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  function getCjsExportFromNamespace (n) {
  	return n && n.default || n;
  }

  var db = {
  	"application/1d-interleaved-parityfec": {
  	source: "iana"
  },
  	"application/3gpdash-qoe-report+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/3gpp-ims+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/a2l": {
  	source: "iana"
  },
  	"application/activemessage": {
  	source: "iana"
  },
  	"application/activity+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-costmap+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-costmapfilter+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-directory+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-endpointcost+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-endpointcostparams+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-endpointprop+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-endpointpropparams+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-error+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-networkmap+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/alto-networkmapfilter+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/aml": {
  	source: "iana"
  },
  	"application/andrew-inset": {
  	source: "iana",
  	extensions: [
  		"ez"
  	]
  },
  	"application/applefile": {
  	source: "iana"
  },
  	"application/applixware": {
  	source: "apache",
  	extensions: [
  		"aw"
  	]
  },
  	"application/atf": {
  	source: "iana"
  },
  	"application/atfx": {
  	source: "iana"
  },
  	"application/atom+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"atom"
  	]
  },
  	"application/atomcat+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"atomcat"
  	]
  },
  	"application/atomdeleted+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/atomicmail": {
  	source: "iana"
  },
  	"application/atomsvc+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"atomsvc"
  	]
  },
  	"application/atxml": {
  	source: "iana"
  },
  	"application/auth-policy+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/bacnet-xdd+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/batch-smtp": {
  	source: "iana"
  },
  	"application/bdoc": {
  	compressible: false,
  	extensions: [
  		"bdoc"
  	]
  },
  	"application/beep+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/calendar+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/calendar+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/call-completion": {
  	source: "iana"
  },
  	"application/cals-1840": {
  	source: "iana"
  },
  	"application/cbor": {
  	source: "iana"
  },
  	"application/cccex": {
  	source: "iana"
  },
  	"application/ccmp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/ccxml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"ccxml"
  	]
  },
  	"application/cdfx+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/cdmi-capability": {
  	source: "iana",
  	extensions: [
  		"cdmia"
  	]
  },
  	"application/cdmi-container": {
  	source: "iana",
  	extensions: [
  		"cdmic"
  	]
  },
  	"application/cdmi-domain": {
  	source: "iana",
  	extensions: [
  		"cdmid"
  	]
  },
  	"application/cdmi-object": {
  	source: "iana",
  	extensions: [
  		"cdmio"
  	]
  },
  	"application/cdmi-queue": {
  	source: "iana",
  	extensions: [
  		"cdmiq"
  	]
  },
  	"application/cdni": {
  	source: "iana"
  },
  	"application/cea": {
  	source: "iana"
  },
  	"application/cea-2018+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/cellml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/cfw": {
  	source: "iana"
  },
  	"application/clue_info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/cms": {
  	source: "iana"
  },
  	"application/cnrp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/coap-group+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/coap-payload": {
  	source: "iana"
  },
  	"application/commonground": {
  	source: "iana"
  },
  	"application/conference-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/cose": {
  	source: "iana"
  },
  	"application/cose-key": {
  	source: "iana"
  },
  	"application/cose-key-set": {
  	source: "iana"
  },
  	"application/cpl+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/csrattrs": {
  	source: "iana"
  },
  	"application/csta+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/cstadata+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/csvm+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/cu-seeme": {
  	source: "apache",
  	extensions: [
  		"cu"
  	]
  },
  	"application/cwt": {
  	source: "iana"
  },
  	"application/cybercash": {
  	source: "iana"
  },
  	"application/dart": {
  	compressible: true
  },
  	"application/dash+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mpd"
  	]
  },
  	"application/dashdelta": {
  	source: "iana"
  },
  	"application/davmount+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"davmount"
  	]
  },
  	"application/dca-rft": {
  	source: "iana"
  },
  	"application/dcd": {
  	source: "iana"
  },
  	"application/dec-dx": {
  	source: "iana"
  },
  	"application/dialog-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/dicom": {
  	source: "iana"
  },
  	"application/dicom+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/dicom+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/dii": {
  	source: "iana"
  },
  	"application/dit": {
  	source: "iana"
  },
  	"application/dns": {
  	source: "iana"
  },
  	"application/dns+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/dns-message": {
  	source: "iana"
  },
  	"application/docbook+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"dbk"
  	]
  },
  	"application/dskpp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/dssc+der": {
  	source: "iana",
  	extensions: [
  		"dssc"
  	]
  },
  	"application/dssc+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xdssc"
  	]
  },
  	"application/dvcs": {
  	source: "iana"
  },
  	"application/ecmascript": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"ecma",
  		"es"
  	]
  },
  	"application/edi-consent": {
  	source: "iana"
  },
  	"application/edi-x12": {
  	source: "iana",
  	compressible: false
  },
  	"application/edifact": {
  	source: "iana",
  	compressible: false
  },
  	"application/efi": {
  	source: "iana"
  },
  	"application/emergencycalldata.comment+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emergencycalldata.control+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emergencycalldata.deviceinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emergencycalldata.ecall.msd": {
  	source: "iana"
  },
  	"application/emergencycalldata.providerinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emergencycalldata.serviceinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emergencycalldata.subscriberinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emergencycalldata.veds+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/emma+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"emma"
  	]
  },
  	"application/emotionml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/encaprtp": {
  	source: "iana"
  },
  	"application/epp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/epub+zip": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"epub"
  	]
  },
  	"application/eshop": {
  	source: "iana"
  },
  	"application/exi": {
  	source: "iana",
  	extensions: [
  		"exi"
  	]
  },
  	"application/fastinfoset": {
  	source: "iana"
  },
  	"application/fastsoap": {
  	source: "iana"
  },
  	"application/fdt+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/fhir+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/fhir+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/fido.trusted-apps+json": {
  	compressible: true
  },
  	"application/fits": {
  	source: "iana"
  },
  	"application/font-sfnt": {
  	source: "iana"
  },
  	"application/font-tdpfr": {
  	source: "iana",
  	extensions: [
  		"pfr"
  	]
  },
  	"application/font-woff": {
  	source: "iana",
  	compressible: false
  },
  	"application/framework-attributes+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/geo+json": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"geojson"
  	]
  },
  	"application/geo+json-seq": {
  	source: "iana"
  },
  	"application/geopackage+sqlite3": {
  	source: "iana"
  },
  	"application/geoxacml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/gltf-buffer": {
  	source: "iana"
  },
  	"application/gml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"gml"
  	]
  },
  	"application/gpx+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"gpx"
  	]
  },
  	"application/gxf": {
  	source: "apache",
  	extensions: [
  		"gxf"
  	]
  },
  	"application/gzip": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"gz"
  	]
  },
  	"application/h224": {
  	source: "iana"
  },
  	"application/held+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/hjson": {
  	extensions: [
  		"hjson"
  	]
  },
  	"application/http": {
  	source: "iana"
  },
  	"application/hyperstudio": {
  	source: "iana",
  	extensions: [
  		"stk"
  	]
  },
  	"application/ibe-key-request+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/ibe-pkg-reply+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/ibe-pp-data": {
  	source: "iana"
  },
  	"application/iges": {
  	source: "iana"
  },
  	"application/im-iscomposing+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/index": {
  	source: "iana"
  },
  	"application/index.cmd": {
  	source: "iana"
  },
  	"application/index.obj": {
  	source: "iana"
  },
  	"application/index.response": {
  	source: "iana"
  },
  	"application/index.vnd": {
  	source: "iana"
  },
  	"application/inkml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"ink",
  		"inkml"
  	]
  },
  	"application/iotp": {
  	source: "iana"
  },
  	"application/ipfix": {
  	source: "iana",
  	extensions: [
  		"ipfix"
  	]
  },
  	"application/ipp": {
  	source: "iana"
  },
  	"application/isup": {
  	source: "iana"
  },
  	"application/its+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/java-archive": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"jar",
  		"war",
  		"ear"
  	]
  },
  	"application/java-serialized-object": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"ser"
  	]
  },
  	"application/java-vm": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"class"
  	]
  },
  	"application/javascript": {
  	source: "iana",
  	charset: "UTF-8",
  	compressible: true,
  	extensions: [
  		"js",
  		"mjs"
  	]
  },
  	"application/jf2feed+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/jose": {
  	source: "iana"
  },
  	"application/jose+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/jrd+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/json": {
  	source: "iana",
  	charset: "UTF-8",
  	compressible: true,
  	extensions: [
  		"json",
  		"map"
  	]
  },
  	"application/json-patch+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/json-seq": {
  	source: "iana"
  },
  	"application/json5": {
  	extensions: [
  		"json5"
  	]
  },
  	"application/jsonml+json": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"jsonml"
  	]
  },
  	"application/jwk+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/jwk-set+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/jwt": {
  	source: "iana"
  },
  	"application/kpml-request+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/kpml-response+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/ld+json": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"jsonld"
  	]
  },
  	"application/lgr+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/link-format": {
  	source: "iana"
  },
  	"application/load-control+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/lost+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"lostxml"
  	]
  },
  	"application/lostsync+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/lxf": {
  	source: "iana"
  },
  	"application/mac-binhex40": {
  	source: "iana",
  	extensions: [
  		"hqx"
  	]
  },
  	"application/mac-compactpro": {
  	source: "apache",
  	extensions: [
  		"cpt"
  	]
  },
  	"application/macwriteii": {
  	source: "iana"
  },
  	"application/mads+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mads"
  	]
  },
  	"application/manifest+json": {
  	charset: "UTF-8",
  	compressible: true,
  	extensions: [
  		"webmanifest"
  	]
  },
  	"application/marc": {
  	source: "iana",
  	extensions: [
  		"mrc"
  	]
  },
  	"application/marcxml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mrcx"
  	]
  },
  	"application/mathematica": {
  	source: "iana",
  	extensions: [
  		"ma",
  		"nb",
  		"mb"
  	]
  },
  	"application/mathml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mathml"
  	]
  },
  	"application/mathml-content+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mathml-presentation+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-associated-procedure-description+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-deregister+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-envelope+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-msk+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-msk-response+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-protection-description+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-reception-report+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-register+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-register-response+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-schedule+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbms-user-service-description+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mbox": {
  	source: "iana",
  	extensions: [
  		"mbox"
  	]
  },
  	"application/media-policy-dataset+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/media_control+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mediaservercontrol+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mscml"
  	]
  },
  	"application/merge-patch+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/metalink+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"metalink"
  	]
  },
  	"application/metalink4+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"meta4"
  	]
  },
  	"application/mets+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mets"
  	]
  },
  	"application/mf4": {
  	source: "iana"
  },
  	"application/mikey": {
  	source: "iana"
  },
  	"application/mmt-usd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mods+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mods"
  	]
  },
  	"application/moss-keys": {
  	source: "iana"
  },
  	"application/moss-signature": {
  	source: "iana"
  },
  	"application/mosskey-data": {
  	source: "iana"
  },
  	"application/mosskey-request": {
  	source: "iana"
  },
  	"application/mp21": {
  	source: "iana",
  	extensions: [
  		"m21",
  		"mp21"
  	]
  },
  	"application/mp4": {
  	source: "iana",
  	extensions: [
  		"mp4s",
  		"m4p"
  	]
  },
  	"application/mpeg4-generic": {
  	source: "iana"
  },
  	"application/mpeg4-iod": {
  	source: "iana"
  },
  	"application/mpeg4-iod-xmt": {
  	source: "iana"
  },
  	"application/mrb-consumer+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/mrb-publish+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/msc-ivr+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/msc-mixer+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/msword": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"doc",
  		"dot"
  	]
  },
  	"application/mud+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/mxf": {
  	source: "iana",
  	extensions: [
  		"mxf"
  	]
  },
  	"application/n-quads": {
  	source: "iana"
  },
  	"application/n-triples": {
  	source: "iana"
  },
  	"application/nasdata": {
  	source: "iana"
  },
  	"application/news-checkgroups": {
  	source: "iana"
  },
  	"application/news-groupinfo": {
  	source: "iana"
  },
  	"application/news-transmission": {
  	source: "iana"
  },
  	"application/nlsml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/node": {
  	source: "iana"
  },
  	"application/nss": {
  	source: "iana"
  },
  	"application/ocsp-request": {
  	source: "iana"
  },
  	"application/ocsp-response": {
  	source: "iana"
  },
  	"application/octet-stream": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"bin",
  		"dms",
  		"lrf",
  		"mar",
  		"so",
  		"dist",
  		"distz",
  		"pkg",
  		"bpk",
  		"dump",
  		"elc",
  		"deploy",
  		"exe",
  		"dll",
  		"deb",
  		"dmg",
  		"iso",
  		"img",
  		"msi",
  		"msp",
  		"msm",
  		"buffer"
  	]
  },
  	"application/oda": {
  	source: "iana",
  	extensions: [
  		"oda"
  	]
  },
  	"application/odx": {
  	source: "iana"
  },
  	"application/oebps-package+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"opf"
  	]
  },
  	"application/ogg": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"ogx"
  	]
  },
  	"application/omdoc+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"omdoc"
  	]
  },
  	"application/onenote": {
  	source: "apache",
  	extensions: [
  		"onetoc",
  		"onetoc2",
  		"onetmp",
  		"onepkg"
  	]
  },
  	"application/oxps": {
  	source: "iana",
  	extensions: [
  		"oxps"
  	]
  },
  	"application/p2p-overlay+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/parityfec": {
  	source: "iana"
  },
  	"application/passport": {
  	source: "iana"
  },
  	"application/patch-ops-error+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xer"
  	]
  },
  	"application/pdf": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"pdf"
  	]
  },
  	"application/pdx": {
  	source: "iana"
  },
  	"application/pgp-encrypted": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"pgp"
  	]
  },
  	"application/pgp-keys": {
  	source: "iana"
  },
  	"application/pgp-signature": {
  	source: "iana",
  	extensions: [
  		"asc",
  		"sig"
  	]
  },
  	"application/pics-rules": {
  	source: "apache",
  	extensions: [
  		"prf"
  	]
  },
  	"application/pidf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/pidf-diff+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/pkcs10": {
  	source: "iana",
  	extensions: [
  		"p10"
  	]
  },
  	"application/pkcs12": {
  	source: "iana"
  },
  	"application/pkcs7-mime": {
  	source: "iana",
  	extensions: [
  		"p7m",
  		"p7c"
  	]
  },
  	"application/pkcs7-signature": {
  	source: "iana",
  	extensions: [
  		"p7s"
  	]
  },
  	"application/pkcs8": {
  	source: "iana",
  	extensions: [
  		"p8"
  	]
  },
  	"application/pkcs8-encrypted": {
  	source: "iana"
  },
  	"application/pkix-attr-cert": {
  	source: "iana",
  	extensions: [
  		"ac"
  	]
  },
  	"application/pkix-cert": {
  	source: "iana",
  	extensions: [
  		"cer"
  	]
  },
  	"application/pkix-crl": {
  	source: "iana",
  	extensions: [
  		"crl"
  	]
  },
  	"application/pkix-pkipath": {
  	source: "iana",
  	extensions: [
  		"pkipath"
  	]
  },
  	"application/pkixcmp": {
  	source: "iana",
  	extensions: [
  		"pki"
  	]
  },
  	"application/pls+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"pls"
  	]
  },
  	"application/poc-settings+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/postscript": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"ai",
  		"eps",
  		"ps"
  	]
  },
  	"application/ppsp-tracker+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/problem+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/problem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/provenance+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/prs.alvestrand.titrax-sheet": {
  	source: "iana"
  },
  	"application/prs.cww": {
  	source: "iana",
  	extensions: [
  		"cww"
  	]
  },
  	"application/prs.hpub+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/prs.nprend": {
  	source: "iana"
  },
  	"application/prs.plucker": {
  	source: "iana"
  },
  	"application/prs.rdf-xml-crypt": {
  	source: "iana"
  },
  	"application/prs.xsf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/pskc+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"pskcxml"
  	]
  },
  	"application/qsig": {
  	source: "iana"
  },
  	"application/raml+yaml": {
  	compressible: true,
  	extensions: [
  		"raml"
  	]
  },
  	"application/raptorfec": {
  	source: "iana"
  },
  	"application/rdap+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/rdf+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rdf",
  		"owl"
  	]
  },
  	"application/reginfo+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rif"
  	]
  },
  	"application/relax-ng-compact-syntax": {
  	source: "iana",
  	extensions: [
  		"rnc"
  	]
  },
  	"application/remote-printing": {
  	source: "iana"
  },
  	"application/reputon+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/resource-lists+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rl"
  	]
  },
  	"application/resource-lists-diff+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rld"
  	]
  },
  	"application/rfc+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/riscos": {
  	source: "iana"
  },
  	"application/rlmi+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/rls-services+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rs"
  	]
  },
  	"application/route-apd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/route-s-tsid+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/route-usd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/rpki-ghostbusters": {
  	source: "iana",
  	extensions: [
  		"gbr"
  	]
  },
  	"application/rpki-manifest": {
  	source: "iana",
  	extensions: [
  		"mft"
  	]
  },
  	"application/rpki-publication": {
  	source: "iana"
  },
  	"application/rpki-roa": {
  	source: "iana",
  	extensions: [
  		"roa"
  	]
  },
  	"application/rpki-updown": {
  	source: "iana"
  },
  	"application/rsd+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"rsd"
  	]
  },
  	"application/rss+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"rss"
  	]
  },
  	"application/rtf": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rtf"
  	]
  },
  	"application/rtploopback": {
  	source: "iana"
  },
  	"application/rtx": {
  	source: "iana"
  },
  	"application/samlassertion+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/samlmetadata+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/sbml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"sbml"
  	]
  },
  	"application/scaip+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/scim+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/scvp-cv-request": {
  	source: "iana",
  	extensions: [
  		"scq"
  	]
  },
  	"application/scvp-cv-response": {
  	source: "iana",
  	extensions: [
  		"scs"
  	]
  },
  	"application/scvp-vp-request": {
  	source: "iana",
  	extensions: [
  		"spq"
  	]
  },
  	"application/scvp-vp-response": {
  	source: "iana",
  	extensions: [
  		"spp"
  	]
  },
  	"application/sdp": {
  	source: "iana",
  	extensions: [
  		"sdp"
  	]
  },
  	"application/secevent+jwt": {
  	source: "iana"
  },
  	"application/senml+cbor": {
  	source: "iana"
  },
  	"application/senml+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/senml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/senml-exi": {
  	source: "iana"
  },
  	"application/sensml+cbor": {
  	source: "iana"
  },
  	"application/sensml+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/sensml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/sensml-exi": {
  	source: "iana"
  },
  	"application/sep+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/sep-exi": {
  	source: "iana"
  },
  	"application/session-info": {
  	source: "iana"
  },
  	"application/set-payment": {
  	source: "iana"
  },
  	"application/set-payment-initiation": {
  	source: "iana",
  	extensions: [
  		"setpay"
  	]
  },
  	"application/set-registration": {
  	source: "iana"
  },
  	"application/set-registration-initiation": {
  	source: "iana",
  	extensions: [
  		"setreg"
  	]
  },
  	"application/sgml": {
  	source: "iana"
  },
  	"application/sgml-open-catalog": {
  	source: "iana"
  },
  	"application/shf+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"shf"
  	]
  },
  	"application/sieve": {
  	source: "iana"
  },
  	"application/simple-filter+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/simple-message-summary": {
  	source: "iana"
  },
  	"application/simplesymbolcontainer": {
  	source: "iana"
  },
  	"application/slate": {
  	source: "iana"
  },
  	"application/smil": {
  	source: "iana"
  },
  	"application/smil+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"smi",
  		"smil"
  	]
  },
  	"application/smpte336m": {
  	source: "iana"
  },
  	"application/soap+fastinfoset": {
  	source: "iana"
  },
  	"application/soap+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/sparql-query": {
  	source: "iana",
  	extensions: [
  		"rq"
  	]
  },
  	"application/sparql-results+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"srx"
  	]
  },
  	"application/spirits-event+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/sql": {
  	source: "iana"
  },
  	"application/srgs": {
  	source: "iana",
  	extensions: [
  		"gram"
  	]
  },
  	"application/srgs+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"grxml"
  	]
  },
  	"application/sru+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"sru"
  	]
  },
  	"application/ssdl+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"ssdl"
  	]
  },
  	"application/ssml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"ssml"
  	]
  },
  	"application/stix+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/tamp-apex-update": {
  	source: "iana"
  },
  	"application/tamp-apex-update-confirm": {
  	source: "iana"
  },
  	"application/tamp-community-update": {
  	source: "iana"
  },
  	"application/tamp-community-update-confirm": {
  	source: "iana"
  },
  	"application/tamp-error": {
  	source: "iana"
  },
  	"application/tamp-sequence-adjust": {
  	source: "iana"
  },
  	"application/tamp-sequence-adjust-confirm": {
  	source: "iana"
  },
  	"application/tamp-status-query": {
  	source: "iana"
  },
  	"application/tamp-status-response": {
  	source: "iana"
  },
  	"application/tamp-update": {
  	source: "iana"
  },
  	"application/tamp-update-confirm": {
  	source: "iana"
  },
  	"application/tar": {
  	compressible: true
  },
  	"application/taxii+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/tei+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"tei",
  		"teicorpus"
  	]
  },
  	"application/thraud+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"tfi"
  	]
  },
  	"application/timestamp-query": {
  	source: "iana"
  },
  	"application/timestamp-reply": {
  	source: "iana"
  },
  	"application/timestamped-data": {
  	source: "iana",
  	extensions: [
  		"tsd"
  	]
  },
  	"application/tlsrpt+gzip": {
  	source: "iana"
  },
  	"application/tlsrpt+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/tnauthlist": {
  	source: "iana"
  },
  	"application/trickle-ice-sdpfrag": {
  	source: "iana"
  },
  	"application/trig": {
  	source: "iana"
  },
  	"application/ttml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/tve-trigger": {
  	source: "iana"
  },
  	"application/ulpfec": {
  	source: "iana"
  },
  	"application/urc-grpsheet+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/urc-ressheet+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/urc-targetdesc+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/urc-uisocketdesc+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vcard+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vcard+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vemmi": {
  	source: "iana"
  },
  	"application/vividence.scriptfile": {
  	source: "apache"
  },
  	"application/vnd.1000minds.decision-model+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp-prose+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp-prose-pc3ch+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp-v2x-local-service-information": {
  	source: "iana"
  },
  	"application/vnd.3gpp.access-transfer-events+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.bsf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.gmop+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mc-signalling-ear": {
  	source: "iana"
  },
  	"application/vnd.3gpp.mcdata-payload": {
  	source: "iana"
  },
  	"application/vnd.3gpp.mcdata-signalling": {
  	source: "iana"
  },
  	"application/vnd.3gpp.mcptt-affiliation-command+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mcptt-floor-request+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mcptt-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mcptt-location-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mcptt-signed+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.mid-call+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.pic-bw-large": {
  	source: "iana",
  	extensions: [
  		"plb"
  	]
  },
  	"application/vnd.3gpp.pic-bw-small": {
  	source: "iana",
  	extensions: [
  		"psb"
  	]
  },
  	"application/vnd.3gpp.pic-bw-var": {
  	source: "iana",
  	extensions: [
  		"pvb"
  	]
  },
  	"application/vnd.3gpp.sms": {
  	source: "iana"
  },
  	"application/vnd.3gpp.sms+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.srvcc-ext+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.srvcc-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.state-and-event-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp.ussd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp2.bcmcsinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.3gpp2.sms": {
  	source: "iana"
  },
  	"application/vnd.3gpp2.tcap": {
  	source: "iana",
  	extensions: [
  		"tcap"
  	]
  },
  	"application/vnd.3lightssoftware.imagescal": {
  	source: "iana"
  },
  	"application/vnd.3m.post-it-notes": {
  	source: "iana",
  	extensions: [
  		"pwn"
  	]
  },
  	"application/vnd.accpac.simply.aso": {
  	source: "iana",
  	extensions: [
  		"aso"
  	]
  },
  	"application/vnd.accpac.simply.imp": {
  	source: "iana",
  	extensions: [
  		"imp"
  	]
  },
  	"application/vnd.acucobol": {
  	source: "iana",
  	extensions: [
  		"acu"
  	]
  },
  	"application/vnd.acucorp": {
  	source: "iana",
  	extensions: [
  		"atc",
  		"acutc"
  	]
  },
  	"application/vnd.adobe.air-application-installer-package+zip": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"air"
  	]
  },
  	"application/vnd.adobe.flash.movie": {
  	source: "iana"
  },
  	"application/vnd.adobe.formscentral.fcdt": {
  	source: "iana",
  	extensions: [
  		"fcdt"
  	]
  },
  	"application/vnd.adobe.fxp": {
  	source: "iana",
  	extensions: [
  		"fxp",
  		"fxpl"
  	]
  },
  	"application/vnd.adobe.partial-upload": {
  	source: "iana"
  },
  	"application/vnd.adobe.xdp+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xdp"
  	]
  },
  	"application/vnd.adobe.xfdf": {
  	source: "iana",
  	extensions: [
  		"xfdf"
  	]
  },
  	"application/vnd.aether.imp": {
  	source: "iana"
  },
  	"application/vnd.afpc.afplinedata": {
  	source: "iana"
  },
  	"application/vnd.afpc.modca": {
  	source: "iana"
  },
  	"application/vnd.ah-barcode": {
  	source: "iana"
  },
  	"application/vnd.ahead.space": {
  	source: "iana",
  	extensions: [
  		"ahead"
  	]
  },
  	"application/vnd.airzip.filesecure.azf": {
  	source: "iana",
  	extensions: [
  		"azf"
  	]
  },
  	"application/vnd.airzip.filesecure.azs": {
  	source: "iana",
  	extensions: [
  		"azs"
  	]
  },
  	"application/vnd.amadeus+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.amazon.ebook": {
  	source: "apache",
  	extensions: [
  		"azw"
  	]
  },
  	"application/vnd.amazon.mobi8-ebook": {
  	source: "iana"
  },
  	"application/vnd.americandynamics.acc": {
  	source: "iana",
  	extensions: [
  		"acc"
  	]
  },
  	"application/vnd.amiga.ami": {
  	source: "iana",
  	extensions: [
  		"ami"
  	]
  },
  	"application/vnd.amundsen.maze+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.android.package-archive": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"apk"
  	]
  },
  	"application/vnd.anki": {
  	source: "iana"
  },
  	"application/vnd.anser-web-certificate-issue-initiation": {
  	source: "iana",
  	extensions: [
  		"cii"
  	]
  },
  	"application/vnd.anser-web-funds-transfer-initiation": {
  	source: "apache",
  	extensions: [
  		"fti"
  	]
  },
  	"application/vnd.antix.game-component": {
  	source: "iana",
  	extensions: [
  		"atx"
  	]
  },
  	"application/vnd.apache.thrift.binary": {
  	source: "iana"
  },
  	"application/vnd.apache.thrift.compact": {
  	source: "iana"
  },
  	"application/vnd.apache.thrift.json": {
  	source: "iana"
  },
  	"application/vnd.api+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.apothekende.reservation+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.apple.installer+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mpkg"
  	]
  },
  	"application/vnd.apple.keynote": {
  	source: "iana",
  	extensions: [
  		"keynote"
  	]
  },
  	"application/vnd.apple.mpegurl": {
  	source: "iana",
  	extensions: [
  		"m3u8"
  	]
  },
  	"application/vnd.apple.numbers": {
  	source: "iana",
  	extensions: [
  		"numbers"
  	]
  },
  	"application/vnd.apple.pages": {
  	source: "iana",
  	extensions: [
  		"pages"
  	]
  },
  	"application/vnd.apple.pkpass": {
  	compressible: false,
  	extensions: [
  		"pkpass"
  	]
  },
  	"application/vnd.arastra.swi": {
  	source: "iana"
  },
  	"application/vnd.aristanetworks.swi": {
  	source: "iana",
  	extensions: [
  		"swi"
  	]
  },
  	"application/vnd.artisan+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.artsquare": {
  	source: "iana"
  },
  	"application/vnd.astraea-software.iota": {
  	source: "iana",
  	extensions: [
  		"iota"
  	]
  },
  	"application/vnd.audiograph": {
  	source: "iana",
  	extensions: [
  		"aep"
  	]
  },
  	"application/vnd.autopackage": {
  	source: "iana"
  },
  	"application/vnd.avalon+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.avistar+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.balsamiq.bmml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.balsamiq.bmpr": {
  	source: "iana"
  },
  	"application/vnd.banana-accounting": {
  	source: "iana"
  },
  	"application/vnd.bbf.usp.msg": {
  	source: "iana"
  },
  	"application/vnd.bbf.usp.msg+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.bekitzur-stech+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.bint.med-content": {
  	source: "iana"
  },
  	"application/vnd.biopax.rdf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.blink-idb-value-wrapper": {
  	source: "iana"
  },
  	"application/vnd.blueice.multipass": {
  	source: "iana",
  	extensions: [
  		"mpm"
  	]
  },
  	"application/vnd.bluetooth.ep.oob": {
  	source: "iana"
  },
  	"application/vnd.bluetooth.le.oob": {
  	source: "iana"
  },
  	"application/vnd.bmi": {
  	source: "iana",
  	extensions: [
  		"bmi"
  	]
  },
  	"application/vnd.businessobjects": {
  	source: "iana",
  	extensions: [
  		"rep"
  	]
  },
  	"application/vnd.byu.uapi+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.cab-jscript": {
  	source: "iana"
  },
  	"application/vnd.canon-cpdl": {
  	source: "iana"
  },
  	"application/vnd.canon-lips": {
  	source: "iana"
  },
  	"application/vnd.capasystems-pg+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.cendio.thinlinc.clientconf": {
  	source: "iana"
  },
  	"application/vnd.century-systems.tcp_stream": {
  	source: "iana"
  },
  	"application/vnd.chemdraw+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"cdxml"
  	]
  },
  	"application/vnd.chess-pgn": {
  	source: "iana"
  },
  	"application/vnd.chipnuts.karaoke-mmd": {
  	source: "iana",
  	extensions: [
  		"mmd"
  	]
  },
  	"application/vnd.cinderella": {
  	source: "iana",
  	extensions: [
  		"cdy"
  	]
  },
  	"application/vnd.cirpack.isdn-ext": {
  	source: "iana"
  },
  	"application/vnd.citationstyles.style+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"csl"
  	]
  },
  	"application/vnd.claymore": {
  	source: "iana",
  	extensions: [
  		"cla"
  	]
  },
  	"application/vnd.cloanto.rp9": {
  	source: "iana",
  	extensions: [
  		"rp9"
  	]
  },
  	"application/vnd.clonk.c4group": {
  	source: "iana",
  	extensions: [
  		"c4g",
  		"c4d",
  		"c4f",
  		"c4p",
  		"c4u"
  	]
  },
  	"application/vnd.cluetrust.cartomobile-config": {
  	source: "iana",
  	extensions: [
  		"c11amc"
  	]
  },
  	"application/vnd.cluetrust.cartomobile-config-pkg": {
  	source: "iana",
  	extensions: [
  		"c11amz"
  	]
  },
  	"application/vnd.coffeescript": {
  	source: "iana"
  },
  	"application/vnd.collabio.xodocuments.document": {
  	source: "iana"
  },
  	"application/vnd.collabio.xodocuments.document-template": {
  	source: "iana"
  },
  	"application/vnd.collabio.xodocuments.presentation": {
  	source: "iana"
  },
  	"application/vnd.collabio.xodocuments.presentation-template": {
  	source: "iana"
  },
  	"application/vnd.collabio.xodocuments.spreadsheet": {
  	source: "iana"
  },
  	"application/vnd.collabio.xodocuments.spreadsheet-template": {
  	source: "iana"
  },
  	"application/vnd.collection+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.collection.doc+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.collection.next+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.comicbook+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.comicbook-rar": {
  	source: "iana"
  },
  	"application/vnd.commerce-battelle": {
  	source: "iana"
  },
  	"application/vnd.commonspace": {
  	source: "iana",
  	extensions: [
  		"csp"
  	]
  },
  	"application/vnd.contact.cmsg": {
  	source: "iana",
  	extensions: [
  		"cdbcmsg"
  	]
  },
  	"application/vnd.coreos.ignition+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.cosmocaller": {
  	source: "iana",
  	extensions: [
  		"cmc"
  	]
  },
  	"application/vnd.crick.clicker": {
  	source: "iana",
  	extensions: [
  		"clkx"
  	]
  },
  	"application/vnd.crick.clicker.keyboard": {
  	source: "iana",
  	extensions: [
  		"clkk"
  	]
  },
  	"application/vnd.crick.clicker.palette": {
  	source: "iana",
  	extensions: [
  		"clkp"
  	]
  },
  	"application/vnd.crick.clicker.template": {
  	source: "iana",
  	extensions: [
  		"clkt"
  	]
  },
  	"application/vnd.crick.clicker.wordbank": {
  	source: "iana",
  	extensions: [
  		"clkw"
  	]
  },
  	"application/vnd.criticaltools.wbs+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"wbs"
  	]
  },
  	"application/vnd.ctc-posml": {
  	source: "iana",
  	extensions: [
  		"pml"
  	]
  },
  	"application/vnd.ctct.ws+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.cups-pdf": {
  	source: "iana"
  },
  	"application/vnd.cups-postscript": {
  	source: "iana"
  },
  	"application/vnd.cups-ppd": {
  	source: "iana",
  	extensions: [
  		"ppd"
  	]
  },
  	"application/vnd.cups-raster": {
  	source: "iana"
  },
  	"application/vnd.cups-raw": {
  	source: "iana"
  },
  	"application/vnd.curl": {
  	source: "iana"
  },
  	"application/vnd.curl.car": {
  	source: "apache",
  	extensions: [
  		"car"
  	]
  },
  	"application/vnd.curl.pcurl": {
  	source: "apache",
  	extensions: [
  		"pcurl"
  	]
  },
  	"application/vnd.cyan.dean.root+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.cybank": {
  	source: "iana"
  },
  	"application/vnd.d2l.coursepackage1p0+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.dart": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"dart"
  	]
  },
  	"application/vnd.data-vision.rdz": {
  	source: "iana",
  	extensions: [
  		"rdz"
  	]
  },
  	"application/vnd.datapackage+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dataresource+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.debian.binary-package": {
  	source: "iana"
  },
  	"application/vnd.dece.data": {
  	source: "iana",
  	extensions: [
  		"uvf",
  		"uvvf",
  		"uvd",
  		"uvvd"
  	]
  },
  	"application/vnd.dece.ttml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"uvt",
  		"uvvt"
  	]
  },
  	"application/vnd.dece.unspecified": {
  	source: "iana",
  	extensions: [
  		"uvx",
  		"uvvx"
  	]
  },
  	"application/vnd.dece.zip": {
  	source: "iana",
  	extensions: [
  		"uvz",
  		"uvvz"
  	]
  },
  	"application/vnd.denovo.fcselayout-link": {
  	source: "iana",
  	extensions: [
  		"fe_launch"
  	]
  },
  	"application/vnd.desmume.movie": {
  	source: "iana"
  },
  	"application/vnd.dir-bi.plate-dl-nosuffix": {
  	source: "iana"
  },
  	"application/vnd.dm.delegation+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dna": {
  	source: "iana",
  	extensions: [
  		"dna"
  	]
  },
  	"application/vnd.document+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dolby.mlp": {
  	source: "apache",
  	extensions: [
  		"mlp"
  	]
  },
  	"application/vnd.dolby.mobile.1": {
  	source: "iana"
  },
  	"application/vnd.dolby.mobile.2": {
  	source: "iana"
  },
  	"application/vnd.doremir.scorecloud-binary-document": {
  	source: "iana"
  },
  	"application/vnd.dpgraph": {
  	source: "iana",
  	extensions: [
  		"dpg"
  	]
  },
  	"application/vnd.dreamfactory": {
  	source: "iana",
  	extensions: [
  		"dfac"
  	]
  },
  	"application/vnd.drive+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ds-keypoint": {
  	source: "apache",
  	extensions: [
  		"kpxx"
  	]
  },
  	"application/vnd.dtg.local": {
  	source: "iana"
  },
  	"application/vnd.dtg.local.flash": {
  	source: "iana"
  },
  	"application/vnd.dtg.local.html": {
  	source: "iana"
  },
  	"application/vnd.dvb.ait": {
  	source: "iana",
  	extensions: [
  		"ait"
  	]
  },
  	"application/vnd.dvb.dvbj": {
  	source: "iana"
  },
  	"application/vnd.dvb.esgcontainer": {
  	source: "iana"
  },
  	"application/vnd.dvb.ipdcdftnotifaccess": {
  	source: "iana"
  },
  	"application/vnd.dvb.ipdcesgaccess": {
  	source: "iana"
  },
  	"application/vnd.dvb.ipdcesgaccess2": {
  	source: "iana"
  },
  	"application/vnd.dvb.ipdcesgpdd": {
  	source: "iana"
  },
  	"application/vnd.dvb.ipdcroaming": {
  	source: "iana"
  },
  	"application/vnd.dvb.iptv.alfec-base": {
  	source: "iana"
  },
  	"application/vnd.dvb.iptv.alfec-enhancement": {
  	source: "iana"
  },
  	"application/vnd.dvb.notif-aggregate-root+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.notif-container+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.notif-generic+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.notif-ia-msglist+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.notif-ia-registration-request+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.notif-ia-registration-response+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.notif-init+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.dvb.pfr": {
  	source: "iana"
  },
  	"application/vnd.dvb.service": {
  	source: "iana",
  	extensions: [
  		"svc"
  	]
  },
  	"application/vnd.dxr": {
  	source: "iana"
  },
  	"application/vnd.dynageo": {
  	source: "iana",
  	extensions: [
  		"geo"
  	]
  },
  	"application/vnd.dzr": {
  	source: "iana"
  },
  	"application/vnd.easykaraoke.cdgdownload": {
  	source: "iana"
  },
  	"application/vnd.ecdis-update": {
  	source: "iana"
  },
  	"application/vnd.ecip.rlp": {
  	source: "iana"
  },
  	"application/vnd.ecowin.chart": {
  	source: "iana",
  	extensions: [
  		"mag"
  	]
  },
  	"application/vnd.ecowin.filerequest": {
  	source: "iana"
  },
  	"application/vnd.ecowin.fileupdate": {
  	source: "iana"
  },
  	"application/vnd.ecowin.series": {
  	source: "iana"
  },
  	"application/vnd.ecowin.seriesrequest": {
  	source: "iana"
  },
  	"application/vnd.ecowin.seriesupdate": {
  	source: "iana"
  },
  	"application/vnd.efi.img": {
  	source: "iana"
  },
  	"application/vnd.efi.iso": {
  	source: "iana"
  },
  	"application/vnd.emclient.accessrequest+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.enliven": {
  	source: "iana",
  	extensions: [
  		"nml"
  	]
  },
  	"application/vnd.enphase.envoy": {
  	source: "iana"
  },
  	"application/vnd.eprints.data+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.epson.esf": {
  	source: "iana",
  	extensions: [
  		"esf"
  	]
  },
  	"application/vnd.epson.msf": {
  	source: "iana",
  	extensions: [
  		"msf"
  	]
  },
  	"application/vnd.epson.quickanime": {
  	source: "iana",
  	extensions: [
  		"qam"
  	]
  },
  	"application/vnd.epson.salt": {
  	source: "iana",
  	extensions: [
  		"slt"
  	]
  },
  	"application/vnd.epson.ssf": {
  	source: "iana",
  	extensions: [
  		"ssf"
  	]
  },
  	"application/vnd.ericsson.quickcall": {
  	source: "iana"
  },
  	"application/vnd.espass-espass+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.eszigno3+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"es3",
  		"et3"
  	]
  },
  	"application/vnd.etsi.aoc+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.asic-e+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.etsi.asic-s+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.etsi.cug+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvcommand+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvdiscovery+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvprofile+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvsad-bc+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvsad-cod+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvsad-npvr+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvservice+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvsync+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.iptvueprofile+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.mcid+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.mheg5": {
  	source: "iana"
  },
  	"application/vnd.etsi.overload-control-policy-dataset+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.pstn+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.sci+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.simservs+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.timestamp-token": {
  	source: "iana"
  },
  	"application/vnd.etsi.tsl+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.etsi.tsl.der": {
  	source: "iana"
  },
  	"application/vnd.eudora.data": {
  	source: "iana"
  },
  	"application/vnd.evolv.ecig.profile": {
  	source: "iana"
  },
  	"application/vnd.evolv.ecig.settings": {
  	source: "iana"
  },
  	"application/vnd.evolv.ecig.theme": {
  	source: "iana"
  },
  	"application/vnd.exstream-empower+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.ezpix-album": {
  	source: "iana",
  	extensions: [
  		"ez2"
  	]
  },
  	"application/vnd.ezpix-package": {
  	source: "iana",
  	extensions: [
  		"ez3"
  	]
  },
  	"application/vnd.f-secure.mobile": {
  	source: "iana"
  },
  	"application/vnd.fastcopy-disk-image": {
  	source: "iana"
  },
  	"application/vnd.fdf": {
  	source: "iana",
  	extensions: [
  		"fdf"
  	]
  },
  	"application/vnd.fdsn.mseed": {
  	source: "iana",
  	extensions: [
  		"mseed"
  	]
  },
  	"application/vnd.fdsn.seed": {
  	source: "iana",
  	extensions: [
  		"seed",
  		"dataless"
  	]
  },
  	"application/vnd.ffsns": {
  	source: "iana"
  },
  	"application/vnd.filmit.zfc": {
  	source: "iana"
  },
  	"application/vnd.fints": {
  	source: "iana"
  },
  	"application/vnd.firemonkeys.cloudcell": {
  	source: "iana"
  },
  	"application/vnd.flographit": {
  	source: "iana",
  	extensions: [
  		"gph"
  	]
  },
  	"application/vnd.fluxtime.clip": {
  	source: "iana",
  	extensions: [
  		"ftc"
  	]
  },
  	"application/vnd.font-fontforge-sfd": {
  	source: "iana"
  },
  	"application/vnd.framemaker": {
  	source: "iana",
  	extensions: [
  		"fm",
  		"frame",
  		"maker",
  		"book"
  	]
  },
  	"application/vnd.frogans.fnc": {
  	source: "iana",
  	extensions: [
  		"fnc"
  	]
  },
  	"application/vnd.frogans.ltf": {
  	source: "iana",
  	extensions: [
  		"ltf"
  	]
  },
  	"application/vnd.fsc.weblaunch": {
  	source: "iana",
  	extensions: [
  		"fsc"
  	]
  },
  	"application/vnd.fujitsu.oasys": {
  	source: "iana",
  	extensions: [
  		"oas"
  	]
  },
  	"application/vnd.fujitsu.oasys2": {
  	source: "iana",
  	extensions: [
  		"oa2"
  	]
  },
  	"application/vnd.fujitsu.oasys3": {
  	source: "iana",
  	extensions: [
  		"oa3"
  	]
  },
  	"application/vnd.fujitsu.oasysgp": {
  	source: "iana",
  	extensions: [
  		"fg5"
  	]
  },
  	"application/vnd.fujitsu.oasysprs": {
  	source: "iana",
  	extensions: [
  		"bh2"
  	]
  },
  	"application/vnd.fujixerox.art-ex": {
  	source: "iana"
  },
  	"application/vnd.fujixerox.art4": {
  	source: "iana"
  },
  	"application/vnd.fujixerox.ddd": {
  	source: "iana",
  	extensions: [
  		"ddd"
  	]
  },
  	"application/vnd.fujixerox.docuworks": {
  	source: "iana",
  	extensions: [
  		"xdw"
  	]
  },
  	"application/vnd.fujixerox.docuworks.binder": {
  	source: "iana",
  	extensions: [
  		"xbd"
  	]
  },
  	"application/vnd.fujixerox.docuworks.container": {
  	source: "iana"
  },
  	"application/vnd.fujixerox.hbpl": {
  	source: "iana"
  },
  	"application/vnd.fut-misnet": {
  	source: "iana"
  },
  	"application/vnd.futoin+cbor": {
  	source: "iana"
  },
  	"application/vnd.futoin+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.fuzzysheet": {
  	source: "iana",
  	extensions: [
  		"fzs"
  	]
  },
  	"application/vnd.genomatix.tuxedo": {
  	source: "iana",
  	extensions: [
  		"txd"
  	]
  },
  	"application/vnd.geo+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.geocube+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.geogebra.file": {
  	source: "iana",
  	extensions: [
  		"ggb"
  	]
  },
  	"application/vnd.geogebra.tool": {
  	source: "iana",
  	extensions: [
  		"ggt"
  	]
  },
  	"application/vnd.geometry-explorer": {
  	source: "iana",
  	extensions: [
  		"gex",
  		"gre"
  	]
  },
  	"application/vnd.geonext": {
  	source: "iana",
  	extensions: [
  		"gxt"
  	]
  },
  	"application/vnd.geoplan": {
  	source: "iana",
  	extensions: [
  		"g2w"
  	]
  },
  	"application/vnd.geospace": {
  	source: "iana",
  	extensions: [
  		"g3w"
  	]
  },
  	"application/vnd.gerber": {
  	source: "iana"
  },
  	"application/vnd.globalplatform.card-content-mgt": {
  	source: "iana"
  },
  	"application/vnd.globalplatform.card-content-mgt-response": {
  	source: "iana"
  },
  	"application/vnd.gmx": {
  	source: "iana",
  	extensions: [
  		"gmx"
  	]
  },
  	"application/vnd.google-apps.document": {
  	compressible: false,
  	extensions: [
  		"gdoc"
  	]
  },
  	"application/vnd.google-apps.presentation": {
  	compressible: false,
  	extensions: [
  		"gslides"
  	]
  },
  	"application/vnd.google-apps.spreadsheet": {
  	compressible: false,
  	extensions: [
  		"gsheet"
  	]
  },
  	"application/vnd.google-earth.kml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"kml"
  	]
  },
  	"application/vnd.google-earth.kmz": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"kmz"
  	]
  },
  	"application/vnd.gov.sk.e-form+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.gov.sk.e-form+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.gov.sk.xmldatacontainer+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.grafeq": {
  	source: "iana",
  	extensions: [
  		"gqf",
  		"gqs"
  	]
  },
  	"application/vnd.gridmp": {
  	source: "iana"
  },
  	"application/vnd.groove-account": {
  	source: "iana",
  	extensions: [
  		"gac"
  	]
  },
  	"application/vnd.groove-help": {
  	source: "iana",
  	extensions: [
  		"ghf"
  	]
  },
  	"application/vnd.groove-identity-message": {
  	source: "iana",
  	extensions: [
  		"gim"
  	]
  },
  	"application/vnd.groove-injector": {
  	source: "iana",
  	extensions: [
  		"grv"
  	]
  },
  	"application/vnd.groove-tool-message": {
  	source: "iana",
  	extensions: [
  		"gtm"
  	]
  },
  	"application/vnd.groove-tool-template": {
  	source: "iana",
  	extensions: [
  		"tpl"
  	]
  },
  	"application/vnd.groove-vcard": {
  	source: "iana",
  	extensions: [
  		"vcg"
  	]
  },
  	"application/vnd.hal+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.hal+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"hal"
  	]
  },
  	"application/vnd.handheld-entertainment+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"zmm"
  	]
  },
  	"application/vnd.hbci": {
  	source: "iana",
  	extensions: [
  		"hbci"
  	]
  },
  	"application/vnd.hc+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.hcl-bireports": {
  	source: "iana"
  },
  	"application/vnd.hdt": {
  	source: "iana"
  },
  	"application/vnd.heroku+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.hhe.lesson-player": {
  	source: "iana",
  	extensions: [
  		"les"
  	]
  },
  	"application/vnd.hp-hpgl": {
  	source: "iana",
  	extensions: [
  		"hpgl"
  	]
  },
  	"application/vnd.hp-hpid": {
  	source: "iana",
  	extensions: [
  		"hpid"
  	]
  },
  	"application/vnd.hp-hps": {
  	source: "iana",
  	extensions: [
  		"hps"
  	]
  },
  	"application/vnd.hp-jlyt": {
  	source: "iana",
  	extensions: [
  		"jlt"
  	]
  },
  	"application/vnd.hp-pcl": {
  	source: "iana",
  	extensions: [
  		"pcl"
  	]
  },
  	"application/vnd.hp-pclxl": {
  	source: "iana",
  	extensions: [
  		"pclxl"
  	]
  },
  	"application/vnd.httphone": {
  	source: "iana"
  },
  	"application/vnd.hydrostatix.sof-data": {
  	source: "iana",
  	extensions: [
  		"sfd-hdstx"
  	]
  },
  	"application/vnd.hyper+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.hyper-item+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.hyperdrive+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.hzn-3d-crossword": {
  	source: "iana"
  },
  	"application/vnd.ibm.afplinedata": {
  	source: "iana"
  },
  	"application/vnd.ibm.electronic-media": {
  	source: "iana"
  },
  	"application/vnd.ibm.minipay": {
  	source: "iana",
  	extensions: [
  		"mpy"
  	]
  },
  	"application/vnd.ibm.modcap": {
  	source: "iana",
  	extensions: [
  		"afp",
  		"listafp",
  		"list3820"
  	]
  },
  	"application/vnd.ibm.rights-management": {
  	source: "iana",
  	extensions: [
  		"irm"
  	]
  },
  	"application/vnd.ibm.secure-container": {
  	source: "iana",
  	extensions: [
  		"sc"
  	]
  },
  	"application/vnd.iccprofile": {
  	source: "iana",
  	extensions: [
  		"icc",
  		"icm"
  	]
  },
  	"application/vnd.ieee.1905": {
  	source: "iana"
  },
  	"application/vnd.igloader": {
  	source: "iana",
  	extensions: [
  		"igl"
  	]
  },
  	"application/vnd.imagemeter.folder+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.imagemeter.image+zip": {
  	source: "iana",
  	compressible: false
  },
  	"application/vnd.immervision-ivp": {
  	source: "iana",
  	extensions: [
  		"ivp"
  	]
  },
  	"application/vnd.immervision-ivu": {
  	source: "iana",
  	extensions: [
  		"ivu"
  	]
  },
  	"application/vnd.ims.imsccv1p1": {
  	source: "iana"
  },
  	"application/vnd.ims.imsccv1p2": {
  	source: "iana"
  },
  	"application/vnd.ims.imsccv1p3": {
  	source: "iana"
  },
  	"application/vnd.ims.lis.v2.result+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ims.lti.v2.toolconsumerprofile+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ims.lti.v2.toolproxy+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ims.lti.v2.toolproxy.id+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ims.lti.v2.toolsettings+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ims.lti.v2.toolsettings.simple+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.informedcontrol.rms+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.informix-visionary": {
  	source: "iana"
  },
  	"application/vnd.infotech.project": {
  	source: "iana"
  },
  	"application/vnd.infotech.project+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.innopath.wamp.notification": {
  	source: "iana"
  },
  	"application/vnd.insors.igm": {
  	source: "iana",
  	extensions: [
  		"igm"
  	]
  },
  	"application/vnd.intercon.formnet": {
  	source: "iana",
  	extensions: [
  		"xpw",
  		"xpx"
  	]
  },
  	"application/vnd.intergeo": {
  	source: "iana",
  	extensions: [
  		"i2g"
  	]
  },
  	"application/vnd.intertrust.digibox": {
  	source: "iana"
  },
  	"application/vnd.intertrust.nncp": {
  	source: "iana"
  },
  	"application/vnd.intu.qbo": {
  	source: "iana",
  	extensions: [
  		"qbo"
  	]
  },
  	"application/vnd.intu.qfx": {
  	source: "iana",
  	extensions: [
  		"qfx"
  	]
  },
  	"application/vnd.iptc.g2.catalogitem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.iptc.g2.conceptitem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.iptc.g2.knowledgeitem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.iptc.g2.newsitem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.iptc.g2.newsmessage+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.iptc.g2.packageitem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.iptc.g2.planningitem+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ipunplugged.rcprofile": {
  	source: "iana",
  	extensions: [
  		"rcprofile"
  	]
  },
  	"application/vnd.irepository.package+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"irp"
  	]
  },
  	"application/vnd.is-xpr": {
  	source: "iana",
  	extensions: [
  		"xpr"
  	]
  },
  	"application/vnd.isac.fcs": {
  	source: "iana",
  	extensions: [
  		"fcs"
  	]
  },
  	"application/vnd.jam": {
  	source: "iana",
  	extensions: [
  		"jam"
  	]
  },
  	"application/vnd.japannet-directory-service": {
  	source: "iana"
  },
  	"application/vnd.japannet-jpnstore-wakeup": {
  	source: "iana"
  },
  	"application/vnd.japannet-payment-wakeup": {
  	source: "iana"
  },
  	"application/vnd.japannet-registration": {
  	source: "iana"
  },
  	"application/vnd.japannet-registration-wakeup": {
  	source: "iana"
  },
  	"application/vnd.japannet-setstore-wakeup": {
  	source: "iana"
  },
  	"application/vnd.japannet-verification": {
  	source: "iana"
  },
  	"application/vnd.japannet-verification-wakeup": {
  	source: "iana"
  },
  	"application/vnd.jcp.javame.midlet-rms": {
  	source: "iana",
  	extensions: [
  		"rms"
  	]
  },
  	"application/vnd.jisp": {
  	source: "iana",
  	extensions: [
  		"jisp"
  	]
  },
  	"application/vnd.joost.joda-archive": {
  	source: "iana",
  	extensions: [
  		"joda"
  	]
  },
  	"application/vnd.jsk.isdn-ngn": {
  	source: "iana"
  },
  	"application/vnd.kahootz": {
  	source: "iana",
  	extensions: [
  		"ktz",
  		"ktr"
  	]
  },
  	"application/vnd.kde.karbon": {
  	source: "iana",
  	extensions: [
  		"karbon"
  	]
  },
  	"application/vnd.kde.kchart": {
  	source: "iana",
  	extensions: [
  		"chrt"
  	]
  },
  	"application/vnd.kde.kformula": {
  	source: "iana",
  	extensions: [
  		"kfo"
  	]
  },
  	"application/vnd.kde.kivio": {
  	source: "iana",
  	extensions: [
  		"flw"
  	]
  },
  	"application/vnd.kde.kontour": {
  	source: "iana",
  	extensions: [
  		"kon"
  	]
  },
  	"application/vnd.kde.kpresenter": {
  	source: "iana",
  	extensions: [
  		"kpr",
  		"kpt"
  	]
  },
  	"application/vnd.kde.kspread": {
  	source: "iana",
  	extensions: [
  		"ksp"
  	]
  },
  	"application/vnd.kde.kword": {
  	source: "iana",
  	extensions: [
  		"kwd",
  		"kwt"
  	]
  },
  	"application/vnd.kenameaapp": {
  	source: "iana",
  	extensions: [
  		"htke"
  	]
  },
  	"application/vnd.kidspiration": {
  	source: "iana",
  	extensions: [
  		"kia"
  	]
  },
  	"application/vnd.kinar": {
  	source: "iana",
  	extensions: [
  		"kne",
  		"knp"
  	]
  },
  	"application/vnd.koan": {
  	source: "iana",
  	extensions: [
  		"skp",
  		"skd",
  		"skt",
  		"skm"
  	]
  },
  	"application/vnd.kodak-descriptor": {
  	source: "iana",
  	extensions: [
  		"sse"
  	]
  },
  	"application/vnd.las.las+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.las.las+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"lasxml"
  	]
  },
  	"application/vnd.leap+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.liberty-request+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.llamagraphics.life-balance.desktop": {
  	source: "iana",
  	extensions: [
  		"lbd"
  	]
  },
  	"application/vnd.llamagraphics.life-balance.exchange+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"lbe"
  	]
  },
  	"application/vnd.lotus-1-2-3": {
  	source: "iana",
  	extensions: [
  		"123"
  	]
  },
  	"application/vnd.lotus-approach": {
  	source: "iana",
  	extensions: [
  		"apr"
  	]
  },
  	"application/vnd.lotus-freelance": {
  	source: "iana",
  	extensions: [
  		"pre"
  	]
  },
  	"application/vnd.lotus-notes": {
  	source: "iana",
  	extensions: [
  		"nsf"
  	]
  },
  	"application/vnd.lotus-organizer": {
  	source: "iana",
  	extensions: [
  		"org"
  	]
  },
  	"application/vnd.lotus-screencam": {
  	source: "iana",
  	extensions: [
  		"scm"
  	]
  },
  	"application/vnd.lotus-wordpro": {
  	source: "iana",
  	extensions: [
  		"lwp"
  	]
  },
  	"application/vnd.macports.portpkg": {
  	source: "iana",
  	extensions: [
  		"portpkg"
  	]
  },
  	"application/vnd.mapbox-vector-tile": {
  	source: "iana"
  },
  	"application/vnd.marlin.drm.actiontoken+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.marlin.drm.conftoken+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.marlin.drm.license+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.marlin.drm.mdcf": {
  	source: "iana"
  },
  	"application/vnd.mason+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.maxmind.maxmind-db": {
  	source: "iana"
  },
  	"application/vnd.mcd": {
  	source: "iana",
  	extensions: [
  		"mcd"
  	]
  },
  	"application/vnd.medcalcdata": {
  	source: "iana",
  	extensions: [
  		"mc1"
  	]
  },
  	"application/vnd.mediastation.cdkey": {
  	source: "iana",
  	extensions: [
  		"cdkey"
  	]
  },
  	"application/vnd.meridian-slingshot": {
  	source: "iana"
  },
  	"application/vnd.mfer": {
  	source: "iana",
  	extensions: [
  		"mwf"
  	]
  },
  	"application/vnd.mfmp": {
  	source: "iana",
  	extensions: [
  		"mfm"
  	]
  },
  	"application/vnd.micro+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.micrografx.flo": {
  	source: "iana",
  	extensions: [
  		"flo"
  	]
  },
  	"application/vnd.micrografx.igx": {
  	source: "iana",
  	extensions: [
  		"igx"
  	]
  },
  	"application/vnd.microsoft.portable-executable": {
  	source: "iana"
  },
  	"application/vnd.microsoft.windows.thumbnail-cache": {
  	source: "iana"
  },
  	"application/vnd.miele+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.mif": {
  	source: "iana",
  	extensions: [
  		"mif"
  	]
  },
  	"application/vnd.minisoft-hp3000-save": {
  	source: "iana"
  },
  	"application/vnd.mitsubishi.misty-guard.trustweb": {
  	source: "iana"
  },
  	"application/vnd.mobius.daf": {
  	source: "iana",
  	extensions: [
  		"daf"
  	]
  },
  	"application/vnd.mobius.dis": {
  	source: "iana",
  	extensions: [
  		"dis"
  	]
  },
  	"application/vnd.mobius.mbk": {
  	source: "iana",
  	extensions: [
  		"mbk"
  	]
  },
  	"application/vnd.mobius.mqy": {
  	source: "iana",
  	extensions: [
  		"mqy"
  	]
  },
  	"application/vnd.mobius.msl": {
  	source: "iana",
  	extensions: [
  		"msl"
  	]
  },
  	"application/vnd.mobius.plc": {
  	source: "iana",
  	extensions: [
  		"plc"
  	]
  },
  	"application/vnd.mobius.txf": {
  	source: "iana",
  	extensions: [
  		"txf"
  	]
  },
  	"application/vnd.mophun.application": {
  	source: "iana",
  	extensions: [
  		"mpn"
  	]
  },
  	"application/vnd.mophun.certificate": {
  	source: "iana",
  	extensions: [
  		"mpc"
  	]
  },
  	"application/vnd.motorola.flexsuite": {
  	source: "iana"
  },
  	"application/vnd.motorola.flexsuite.adsi": {
  	source: "iana"
  },
  	"application/vnd.motorola.flexsuite.fis": {
  	source: "iana"
  },
  	"application/vnd.motorola.flexsuite.gotap": {
  	source: "iana"
  },
  	"application/vnd.motorola.flexsuite.kmr": {
  	source: "iana"
  },
  	"application/vnd.motorola.flexsuite.ttc": {
  	source: "iana"
  },
  	"application/vnd.motorola.flexsuite.wem": {
  	source: "iana"
  },
  	"application/vnd.motorola.iprm": {
  	source: "iana"
  },
  	"application/vnd.mozilla.xul+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xul"
  	]
  },
  	"application/vnd.ms-3mfdocument": {
  	source: "iana"
  },
  	"application/vnd.ms-artgalry": {
  	source: "iana",
  	extensions: [
  		"cil"
  	]
  },
  	"application/vnd.ms-asf": {
  	source: "iana"
  },
  	"application/vnd.ms-cab-compressed": {
  	source: "iana",
  	extensions: [
  		"cab"
  	]
  },
  	"application/vnd.ms-color.iccprofile": {
  	source: "apache"
  },
  	"application/vnd.ms-excel": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"xls",
  		"xlm",
  		"xla",
  		"xlc",
  		"xlt",
  		"xlw"
  	]
  },
  	"application/vnd.ms-excel.addin.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"xlam"
  	]
  },
  	"application/vnd.ms-excel.sheet.binary.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"xlsb"
  	]
  },
  	"application/vnd.ms-excel.sheet.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"xlsm"
  	]
  },
  	"application/vnd.ms-excel.template.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"xltm"
  	]
  },
  	"application/vnd.ms-fontobject": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"eot"
  	]
  },
  	"application/vnd.ms-htmlhelp": {
  	source: "iana",
  	extensions: [
  		"chm"
  	]
  },
  	"application/vnd.ms-ims": {
  	source: "iana",
  	extensions: [
  		"ims"
  	]
  },
  	"application/vnd.ms-lrm": {
  	source: "iana",
  	extensions: [
  		"lrm"
  	]
  },
  	"application/vnd.ms-office.activex+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ms-officetheme": {
  	source: "iana",
  	extensions: [
  		"thmx"
  	]
  },
  	"application/vnd.ms-opentype": {
  	source: "apache",
  	compressible: true
  },
  	"application/vnd.ms-outlook": {
  	compressible: false,
  	extensions: [
  		"msg"
  	]
  },
  	"application/vnd.ms-package.obfuscated-opentype": {
  	source: "apache"
  },
  	"application/vnd.ms-pki.seccat": {
  	source: "apache",
  	extensions: [
  		"cat"
  	]
  },
  	"application/vnd.ms-pki.stl": {
  	source: "apache",
  	extensions: [
  		"stl"
  	]
  },
  	"application/vnd.ms-playready.initiator+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ms-powerpoint": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"ppt",
  		"pps",
  		"pot"
  	]
  },
  	"application/vnd.ms-powerpoint.addin.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"ppam"
  	]
  },
  	"application/vnd.ms-powerpoint.presentation.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"pptm"
  	]
  },
  	"application/vnd.ms-powerpoint.slide.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"sldm"
  	]
  },
  	"application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"ppsm"
  	]
  },
  	"application/vnd.ms-powerpoint.template.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"potm"
  	]
  },
  	"application/vnd.ms-printdevicecapabilities+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ms-printing.printticket+xml": {
  	source: "apache",
  	compressible: true
  },
  	"application/vnd.ms-printschematicket+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.ms-project": {
  	source: "iana",
  	extensions: [
  		"mpp",
  		"mpt"
  	]
  },
  	"application/vnd.ms-tnef": {
  	source: "iana"
  },
  	"application/vnd.ms-windows.devicepairing": {
  	source: "iana"
  },
  	"application/vnd.ms-windows.nwprinting.oob": {
  	source: "iana"
  },
  	"application/vnd.ms-windows.printerpairing": {
  	source: "iana"
  },
  	"application/vnd.ms-windows.wsd.oob": {
  	source: "iana"
  },
  	"application/vnd.ms-wmdrm.lic-chlg-req": {
  	source: "iana"
  },
  	"application/vnd.ms-wmdrm.lic-resp": {
  	source: "iana"
  },
  	"application/vnd.ms-wmdrm.meter-chlg-req": {
  	source: "iana"
  },
  	"application/vnd.ms-wmdrm.meter-resp": {
  	source: "iana"
  },
  	"application/vnd.ms-word.document.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"docm"
  	]
  },
  	"application/vnd.ms-word.template.macroenabled.12": {
  	source: "iana",
  	extensions: [
  		"dotm"
  	]
  },
  	"application/vnd.ms-works": {
  	source: "iana",
  	extensions: [
  		"wps",
  		"wks",
  		"wcm",
  		"wdb"
  	]
  },
  	"application/vnd.ms-wpl": {
  	source: "iana",
  	extensions: [
  		"wpl"
  	]
  },
  	"application/vnd.ms-xpsdocument": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"xps"
  	]
  },
  	"application/vnd.msa-disk-image": {
  	source: "iana"
  },
  	"application/vnd.mseq": {
  	source: "iana",
  	extensions: [
  		"mseq"
  	]
  },
  	"application/vnd.msign": {
  	source: "iana"
  },
  	"application/vnd.multiad.creator": {
  	source: "iana"
  },
  	"application/vnd.multiad.creator.cif": {
  	source: "iana"
  },
  	"application/vnd.music-niff": {
  	source: "iana"
  },
  	"application/vnd.musician": {
  	source: "iana",
  	extensions: [
  		"mus"
  	]
  },
  	"application/vnd.muvee.style": {
  	source: "iana",
  	extensions: [
  		"msty"
  	]
  },
  	"application/vnd.mynfc": {
  	source: "iana",
  	extensions: [
  		"taglet"
  	]
  },
  	"application/vnd.ncd.control": {
  	source: "iana"
  },
  	"application/vnd.ncd.reference": {
  	source: "iana"
  },
  	"application/vnd.nearst.inv+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nervana": {
  	source: "iana"
  },
  	"application/vnd.netfpx": {
  	source: "iana"
  },
  	"application/vnd.neurolanguage.nlu": {
  	source: "iana",
  	extensions: [
  		"nlu"
  	]
  },
  	"application/vnd.nimn": {
  	source: "iana"
  },
  	"application/vnd.nintendo.nitro.rom": {
  	source: "iana"
  },
  	"application/vnd.nintendo.snes.rom": {
  	source: "iana"
  },
  	"application/vnd.nitf": {
  	source: "iana",
  	extensions: [
  		"ntf",
  		"nitf"
  	]
  },
  	"application/vnd.noblenet-directory": {
  	source: "iana",
  	extensions: [
  		"nnd"
  	]
  },
  	"application/vnd.noblenet-sealer": {
  	source: "iana",
  	extensions: [
  		"nns"
  	]
  },
  	"application/vnd.noblenet-web": {
  	source: "iana",
  	extensions: [
  		"nnw"
  	]
  },
  	"application/vnd.nokia.catalogs": {
  	source: "iana"
  },
  	"application/vnd.nokia.conml+wbxml": {
  	source: "iana"
  },
  	"application/vnd.nokia.conml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nokia.iptv.config+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nokia.isds-radio-presets": {
  	source: "iana"
  },
  	"application/vnd.nokia.landmark+wbxml": {
  	source: "iana"
  },
  	"application/vnd.nokia.landmark+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nokia.landmarkcollection+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nokia.n-gage.ac+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nokia.n-gage.data": {
  	source: "iana",
  	extensions: [
  		"ngdat"
  	]
  },
  	"application/vnd.nokia.n-gage.symbian.install": {
  	source: "iana",
  	extensions: [
  		"n-gage"
  	]
  },
  	"application/vnd.nokia.ncd": {
  	source: "iana"
  },
  	"application/vnd.nokia.pcd+wbxml": {
  	source: "iana"
  },
  	"application/vnd.nokia.pcd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.nokia.radio-preset": {
  	source: "iana",
  	extensions: [
  		"rpst"
  	]
  },
  	"application/vnd.nokia.radio-presets": {
  	source: "iana",
  	extensions: [
  		"rpss"
  	]
  },
  	"application/vnd.novadigm.edm": {
  	source: "iana",
  	extensions: [
  		"edm"
  	]
  },
  	"application/vnd.novadigm.edx": {
  	source: "iana",
  	extensions: [
  		"edx"
  	]
  },
  	"application/vnd.novadigm.ext": {
  	source: "iana",
  	extensions: [
  		"ext"
  	]
  },
  	"application/vnd.ntt-local.content-share": {
  	source: "iana"
  },
  	"application/vnd.ntt-local.file-transfer": {
  	source: "iana"
  },
  	"application/vnd.ntt-local.ogw_remote-access": {
  	source: "iana"
  },
  	"application/vnd.ntt-local.sip-ta_remote": {
  	source: "iana"
  },
  	"application/vnd.ntt-local.sip-ta_tcp_stream": {
  	source: "iana"
  },
  	"application/vnd.oasis.opendocument.chart": {
  	source: "iana",
  	extensions: [
  		"odc"
  	]
  },
  	"application/vnd.oasis.opendocument.chart-template": {
  	source: "iana",
  	extensions: [
  		"otc"
  	]
  },
  	"application/vnd.oasis.opendocument.database": {
  	source: "iana",
  	extensions: [
  		"odb"
  	]
  },
  	"application/vnd.oasis.opendocument.formula": {
  	source: "iana",
  	extensions: [
  		"odf"
  	]
  },
  	"application/vnd.oasis.opendocument.formula-template": {
  	source: "iana",
  	extensions: [
  		"odft"
  	]
  },
  	"application/vnd.oasis.opendocument.graphics": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"odg"
  	]
  },
  	"application/vnd.oasis.opendocument.graphics-template": {
  	source: "iana",
  	extensions: [
  		"otg"
  	]
  },
  	"application/vnd.oasis.opendocument.image": {
  	source: "iana",
  	extensions: [
  		"odi"
  	]
  },
  	"application/vnd.oasis.opendocument.image-template": {
  	source: "iana",
  	extensions: [
  		"oti"
  	]
  },
  	"application/vnd.oasis.opendocument.presentation": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"odp"
  	]
  },
  	"application/vnd.oasis.opendocument.presentation-template": {
  	source: "iana",
  	extensions: [
  		"otp"
  	]
  },
  	"application/vnd.oasis.opendocument.spreadsheet": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"ods"
  	]
  },
  	"application/vnd.oasis.opendocument.spreadsheet-template": {
  	source: "iana",
  	extensions: [
  		"ots"
  	]
  },
  	"application/vnd.oasis.opendocument.text": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"odt"
  	]
  },
  	"application/vnd.oasis.opendocument.text-master": {
  	source: "iana",
  	extensions: [
  		"odm"
  	]
  },
  	"application/vnd.oasis.opendocument.text-template": {
  	source: "iana",
  	extensions: [
  		"ott"
  	]
  },
  	"application/vnd.oasis.opendocument.text-web": {
  	source: "iana",
  	extensions: [
  		"oth"
  	]
  },
  	"application/vnd.obn": {
  	source: "iana"
  },
  	"application/vnd.ocf+cbor": {
  	source: "iana"
  },
  	"application/vnd.oftn.l10n+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.contentaccessdownload+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.contentaccessstreaming+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.cspg-hexbinary": {
  	source: "iana"
  },
  	"application/vnd.oipf.dae.svg+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.dae.xhtml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.mippvcontrolmessage+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.pae.gem": {
  	source: "iana"
  },
  	"application/vnd.oipf.spdiscovery+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.spdlist+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.ueprofile+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oipf.userprofile+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.olpc-sugar": {
  	source: "iana",
  	extensions: [
  		"xo"
  	]
  },
  	"application/vnd.oma-scws-config": {
  	source: "iana"
  },
  	"application/vnd.oma-scws-http-request": {
  	source: "iana"
  },
  	"application/vnd.oma-scws-http-response": {
  	source: "iana"
  },
  	"application/vnd.oma.bcast.associated-procedure-parameter+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.drm-trigger+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.imd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.ltkm": {
  	source: "iana"
  },
  	"application/vnd.oma.bcast.notification+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.provisioningtrigger": {
  	source: "iana"
  },
  	"application/vnd.oma.bcast.sgboot": {
  	source: "iana"
  },
  	"application/vnd.oma.bcast.sgdd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.sgdu": {
  	source: "iana"
  },
  	"application/vnd.oma.bcast.simple-symbol-container": {
  	source: "iana"
  },
  	"application/vnd.oma.bcast.smartcard-trigger+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.sprov+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.bcast.stkm": {
  	source: "iana"
  },
  	"application/vnd.oma.cab-address-book+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.cab-feature-handler+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.cab-pcc+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.cab-subs-invite+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.cab-user-prefs+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.dcd": {
  	source: "iana"
  },
  	"application/vnd.oma.dcdc": {
  	source: "iana"
  },
  	"application/vnd.oma.dd2+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"dd2"
  	]
  },
  	"application/vnd.oma.drm.risd+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.group-usage-list+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.lwm2m+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.lwm2m+tlv": {
  	source: "iana"
  },
  	"application/vnd.oma.pal+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.poc.detailed-progress-report+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.poc.final-report+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.poc.groups+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.poc.invocation-descriptor+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.poc.optimized-progress-report+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.push": {
  	source: "iana"
  },
  	"application/vnd.oma.scidm.messages+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oma.xcap-directory+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.omads-email+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.omads-file+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.omads-folder+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.omaloc-supl-init": {
  	source: "iana"
  },
  	"application/vnd.onepager": {
  	source: "iana"
  },
  	"application/vnd.onepagertamp": {
  	source: "iana"
  },
  	"application/vnd.onepagertamx": {
  	source: "iana"
  },
  	"application/vnd.onepagertat": {
  	source: "iana"
  },
  	"application/vnd.onepagertatp": {
  	source: "iana"
  },
  	"application/vnd.onepagertatx": {
  	source: "iana"
  },
  	"application/vnd.openblox.game+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openblox.game-binary": {
  	source: "iana"
  },
  	"application/vnd.openeye.oeb": {
  	source: "iana"
  },
  	"application/vnd.openofficeorg.extension": {
  	source: "apache",
  	extensions: [
  		"oxt"
  	]
  },
  	"application/vnd.openstreetmap.data+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.custom-properties+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawing+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.extended-properties+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.presentation": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"pptx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slide": {
  	source: "iana",
  	extensions: [
  		"sldx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
  	source: "iana",
  	extensions: [
  		"ppsx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.template": {
  	source: "iana",
  	extensions: [
  		"potx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"xlsx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
  	source: "iana",
  	extensions: [
  		"xltx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.theme+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.themeoverride+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.vmldrawing": {
  	source: "iana"
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"docx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
  	source: "iana",
  	extensions: [
  		"dotx"
  	]
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-package.core-properties+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.openxmlformats-package.relationships+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oracle.resource+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.orange.indata": {
  	source: "iana"
  },
  	"application/vnd.osa.netdeploy": {
  	source: "iana"
  },
  	"application/vnd.osgeo.mapguide.package": {
  	source: "iana",
  	extensions: [
  		"mgp"
  	]
  },
  	"application/vnd.osgi.bundle": {
  	source: "iana"
  },
  	"application/vnd.osgi.dp": {
  	source: "iana",
  	extensions: [
  		"dp"
  	]
  },
  	"application/vnd.osgi.subsystem": {
  	source: "iana",
  	extensions: [
  		"esa"
  	]
  },
  	"application/vnd.otps.ct-kip+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.oxli.countgraph": {
  	source: "iana"
  },
  	"application/vnd.pagerduty+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.palm": {
  	source: "iana",
  	extensions: [
  		"pdb",
  		"pqa",
  		"oprc"
  	]
  },
  	"application/vnd.panoply": {
  	source: "iana"
  },
  	"application/vnd.paos.xml": {
  	source: "iana"
  },
  	"application/vnd.patentdive": {
  	source: "iana"
  },
  	"application/vnd.pawaafile": {
  	source: "iana",
  	extensions: [
  		"paw"
  	]
  },
  	"application/vnd.pcos": {
  	source: "iana"
  },
  	"application/vnd.pg.format": {
  	source: "iana",
  	extensions: [
  		"str"
  	]
  },
  	"application/vnd.pg.osasli": {
  	source: "iana",
  	extensions: [
  		"ei6"
  	]
  },
  	"application/vnd.piaccess.application-licence": {
  	source: "iana"
  },
  	"application/vnd.picsel": {
  	source: "iana",
  	extensions: [
  		"efif"
  	]
  },
  	"application/vnd.pmi.widget": {
  	source: "iana",
  	extensions: [
  		"wg"
  	]
  },
  	"application/vnd.poc.group-advertisement+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.pocketlearn": {
  	source: "iana",
  	extensions: [
  		"plf"
  	]
  },
  	"application/vnd.powerbuilder6": {
  	source: "iana",
  	extensions: [
  		"pbd"
  	]
  },
  	"application/vnd.powerbuilder6-s": {
  	source: "iana"
  },
  	"application/vnd.powerbuilder7": {
  	source: "iana"
  },
  	"application/vnd.powerbuilder7-s": {
  	source: "iana"
  },
  	"application/vnd.powerbuilder75": {
  	source: "iana"
  },
  	"application/vnd.powerbuilder75-s": {
  	source: "iana"
  },
  	"application/vnd.preminet": {
  	source: "iana"
  },
  	"application/vnd.previewsystems.box": {
  	source: "iana",
  	extensions: [
  		"box"
  	]
  },
  	"application/vnd.proteus.magazine": {
  	source: "iana",
  	extensions: [
  		"mgz"
  	]
  },
  	"application/vnd.psfs": {
  	source: "iana"
  },
  	"application/vnd.publishare-delta-tree": {
  	source: "iana",
  	extensions: [
  		"qps"
  	]
  },
  	"application/vnd.pvi.ptid1": {
  	source: "iana",
  	extensions: [
  		"ptid"
  	]
  },
  	"application/vnd.pwg-multiplexed": {
  	source: "iana"
  },
  	"application/vnd.pwg-xhtml-print+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.qualcomm.brew-app-res": {
  	source: "iana"
  },
  	"application/vnd.quarantainenet": {
  	source: "iana"
  },
  	"application/vnd.quark.quarkxpress": {
  	source: "iana",
  	extensions: [
  		"qxd",
  		"qxt",
  		"qwd",
  		"qwt",
  		"qxl",
  		"qxb"
  	]
  },
  	"application/vnd.quobject-quoxdocument": {
  	source: "iana"
  },
  	"application/vnd.radisys.moml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-audit+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-audit-conf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-audit-conn+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-audit-dialog+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-audit-stream+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-conf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog-base+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog-fax-detect+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog-group+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog-speech+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.radisys.msml-dialog-transform+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.rainstor.data": {
  	source: "iana"
  },
  	"application/vnd.rapid": {
  	source: "iana"
  },
  	"application/vnd.rar": {
  	source: "iana"
  },
  	"application/vnd.realvnc.bed": {
  	source: "iana",
  	extensions: [
  		"bed"
  	]
  },
  	"application/vnd.recordare.musicxml": {
  	source: "iana",
  	extensions: [
  		"mxl"
  	]
  },
  	"application/vnd.recordare.musicxml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"musicxml"
  	]
  },
  	"application/vnd.renlearn.rlprint": {
  	source: "iana"
  },
  	"application/vnd.restful+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.rig.cryptonote": {
  	source: "iana",
  	extensions: [
  		"cryptonote"
  	]
  },
  	"application/vnd.rim.cod": {
  	source: "apache",
  	extensions: [
  		"cod"
  	]
  },
  	"application/vnd.rn-realmedia": {
  	source: "apache",
  	extensions: [
  		"rm"
  	]
  },
  	"application/vnd.rn-realmedia-vbr": {
  	source: "apache",
  	extensions: [
  		"rmvb"
  	]
  },
  	"application/vnd.route66.link66+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"link66"
  	]
  },
  	"application/vnd.rs-274x": {
  	source: "iana"
  },
  	"application/vnd.ruckus.download": {
  	source: "iana"
  },
  	"application/vnd.s3sms": {
  	source: "iana"
  },
  	"application/vnd.sailingtracker.track": {
  	source: "iana",
  	extensions: [
  		"st"
  	]
  },
  	"application/vnd.sbm.cid": {
  	source: "iana"
  },
  	"application/vnd.sbm.mid2": {
  	source: "iana"
  },
  	"application/vnd.scribus": {
  	source: "iana"
  },
  	"application/vnd.sealed.3df": {
  	source: "iana"
  },
  	"application/vnd.sealed.csf": {
  	source: "iana"
  },
  	"application/vnd.sealed.doc": {
  	source: "iana"
  },
  	"application/vnd.sealed.eml": {
  	source: "iana"
  },
  	"application/vnd.sealed.mht": {
  	source: "iana"
  },
  	"application/vnd.sealed.net": {
  	source: "iana"
  },
  	"application/vnd.sealed.ppt": {
  	source: "iana"
  },
  	"application/vnd.sealed.tiff": {
  	source: "iana"
  },
  	"application/vnd.sealed.xls": {
  	source: "iana"
  },
  	"application/vnd.sealedmedia.softseal.html": {
  	source: "iana"
  },
  	"application/vnd.sealedmedia.softseal.pdf": {
  	source: "iana"
  },
  	"application/vnd.seemail": {
  	source: "iana",
  	extensions: [
  		"see"
  	]
  },
  	"application/vnd.sema": {
  	source: "iana",
  	extensions: [
  		"sema"
  	]
  },
  	"application/vnd.semd": {
  	source: "iana",
  	extensions: [
  		"semd"
  	]
  },
  	"application/vnd.semf": {
  	source: "iana",
  	extensions: [
  		"semf"
  	]
  },
  	"application/vnd.shana.informed.formdata": {
  	source: "iana",
  	extensions: [
  		"ifm"
  	]
  },
  	"application/vnd.shana.informed.formtemplate": {
  	source: "iana",
  	extensions: [
  		"itp"
  	]
  },
  	"application/vnd.shana.informed.interchange": {
  	source: "iana",
  	extensions: [
  		"iif"
  	]
  },
  	"application/vnd.shana.informed.package": {
  	source: "iana",
  	extensions: [
  		"ipk"
  	]
  },
  	"application/vnd.shootproof+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.sigrok.session": {
  	source: "iana"
  },
  	"application/vnd.simtech-mindmapper": {
  	source: "iana",
  	extensions: [
  		"twd",
  		"twds"
  	]
  },
  	"application/vnd.siren+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.smaf": {
  	source: "iana",
  	extensions: [
  		"mmf"
  	]
  },
  	"application/vnd.smart.notebook": {
  	source: "iana"
  },
  	"application/vnd.smart.teacher": {
  	source: "iana",
  	extensions: [
  		"teacher"
  	]
  },
  	"application/vnd.software602.filler.form+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.software602.filler.form-xml-zip": {
  	source: "iana"
  },
  	"application/vnd.solent.sdkm+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"sdkm",
  		"sdkd"
  	]
  },
  	"application/vnd.spotfire.dxp": {
  	source: "iana",
  	extensions: [
  		"dxp"
  	]
  },
  	"application/vnd.spotfire.sfs": {
  	source: "iana",
  	extensions: [
  		"sfs"
  	]
  },
  	"application/vnd.sqlite3": {
  	source: "iana"
  },
  	"application/vnd.sss-cod": {
  	source: "iana"
  },
  	"application/vnd.sss-dtf": {
  	source: "iana"
  },
  	"application/vnd.sss-ntf": {
  	source: "iana"
  },
  	"application/vnd.stardivision.calc": {
  	source: "apache",
  	extensions: [
  		"sdc"
  	]
  },
  	"application/vnd.stardivision.draw": {
  	source: "apache",
  	extensions: [
  		"sda"
  	]
  },
  	"application/vnd.stardivision.impress": {
  	source: "apache",
  	extensions: [
  		"sdd"
  	]
  },
  	"application/vnd.stardivision.math": {
  	source: "apache",
  	extensions: [
  		"smf"
  	]
  },
  	"application/vnd.stardivision.writer": {
  	source: "apache",
  	extensions: [
  		"sdw",
  		"vor"
  	]
  },
  	"application/vnd.stardivision.writer-global": {
  	source: "apache",
  	extensions: [
  		"sgl"
  	]
  },
  	"application/vnd.stepmania.package": {
  	source: "iana",
  	extensions: [
  		"smzip"
  	]
  },
  	"application/vnd.stepmania.stepchart": {
  	source: "iana",
  	extensions: [
  		"sm"
  	]
  },
  	"application/vnd.street-stream": {
  	source: "iana"
  },
  	"application/vnd.sun.wadl+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"wadl"
  	]
  },
  	"application/vnd.sun.xml.calc": {
  	source: "apache",
  	extensions: [
  		"sxc"
  	]
  },
  	"application/vnd.sun.xml.calc.template": {
  	source: "apache",
  	extensions: [
  		"stc"
  	]
  },
  	"application/vnd.sun.xml.draw": {
  	source: "apache",
  	extensions: [
  		"sxd"
  	]
  },
  	"application/vnd.sun.xml.draw.template": {
  	source: "apache",
  	extensions: [
  		"std"
  	]
  },
  	"application/vnd.sun.xml.impress": {
  	source: "apache",
  	extensions: [
  		"sxi"
  	]
  },
  	"application/vnd.sun.xml.impress.template": {
  	source: "apache",
  	extensions: [
  		"sti"
  	]
  },
  	"application/vnd.sun.xml.math": {
  	source: "apache",
  	extensions: [
  		"sxm"
  	]
  },
  	"application/vnd.sun.xml.writer": {
  	source: "apache",
  	extensions: [
  		"sxw"
  	]
  },
  	"application/vnd.sun.xml.writer.global": {
  	source: "apache",
  	extensions: [
  		"sxg"
  	]
  },
  	"application/vnd.sun.xml.writer.template": {
  	source: "apache",
  	extensions: [
  		"stw"
  	]
  },
  	"application/vnd.sus-calendar": {
  	source: "iana",
  	extensions: [
  		"sus",
  		"susp"
  	]
  },
  	"application/vnd.svd": {
  	source: "iana",
  	extensions: [
  		"svd"
  	]
  },
  	"application/vnd.swiftview-ics": {
  	source: "iana"
  },
  	"application/vnd.symbian.install": {
  	source: "apache",
  	extensions: [
  		"sis",
  		"sisx"
  	]
  },
  	"application/vnd.syncml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xsm"
  	]
  },
  	"application/vnd.syncml.dm+wbxml": {
  	source: "iana",
  	extensions: [
  		"bdm"
  	]
  },
  	"application/vnd.syncml.dm+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xdm"
  	]
  },
  	"application/vnd.syncml.dm.notification": {
  	source: "iana"
  },
  	"application/vnd.syncml.dmddf+wbxml": {
  	source: "iana"
  },
  	"application/vnd.syncml.dmddf+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.syncml.dmtnds+wbxml": {
  	source: "iana"
  },
  	"application/vnd.syncml.dmtnds+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.syncml.ds.notification": {
  	source: "iana"
  },
  	"application/vnd.tableschema+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.tao.intent-module-archive": {
  	source: "iana",
  	extensions: [
  		"tao"
  	]
  },
  	"application/vnd.tcpdump.pcap": {
  	source: "iana",
  	extensions: [
  		"pcap",
  		"cap",
  		"dmp"
  	]
  },
  	"application/vnd.think-cell.ppttc+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.tmd.mediaflex.api+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.tml": {
  	source: "iana"
  },
  	"application/vnd.tmobile-livetv": {
  	source: "iana",
  	extensions: [
  		"tmo"
  	]
  },
  	"application/vnd.tri.onesource": {
  	source: "iana"
  },
  	"application/vnd.trid.tpt": {
  	source: "iana",
  	extensions: [
  		"tpt"
  	]
  },
  	"application/vnd.triscape.mxs": {
  	source: "iana",
  	extensions: [
  		"mxs"
  	]
  },
  	"application/vnd.trueapp": {
  	source: "iana",
  	extensions: [
  		"tra"
  	]
  },
  	"application/vnd.truedoc": {
  	source: "iana"
  },
  	"application/vnd.ubisoft.webplayer": {
  	source: "iana"
  },
  	"application/vnd.ufdl": {
  	source: "iana",
  	extensions: [
  		"ufd",
  		"ufdl"
  	]
  },
  	"application/vnd.uiq.theme": {
  	source: "iana",
  	extensions: [
  		"utz"
  	]
  },
  	"application/vnd.umajin": {
  	source: "iana",
  	extensions: [
  		"umj"
  	]
  },
  	"application/vnd.unity": {
  	source: "iana",
  	extensions: [
  		"unityweb"
  	]
  },
  	"application/vnd.uoml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"uoml"
  	]
  },
  	"application/vnd.uplanet.alert": {
  	source: "iana"
  },
  	"application/vnd.uplanet.alert-wbxml": {
  	source: "iana"
  },
  	"application/vnd.uplanet.bearer-choice": {
  	source: "iana"
  },
  	"application/vnd.uplanet.bearer-choice-wbxml": {
  	source: "iana"
  },
  	"application/vnd.uplanet.cacheop": {
  	source: "iana"
  },
  	"application/vnd.uplanet.cacheop-wbxml": {
  	source: "iana"
  },
  	"application/vnd.uplanet.channel": {
  	source: "iana"
  },
  	"application/vnd.uplanet.channel-wbxml": {
  	source: "iana"
  },
  	"application/vnd.uplanet.list": {
  	source: "iana"
  },
  	"application/vnd.uplanet.list-wbxml": {
  	source: "iana"
  },
  	"application/vnd.uplanet.listcmd": {
  	source: "iana"
  },
  	"application/vnd.uplanet.listcmd-wbxml": {
  	source: "iana"
  },
  	"application/vnd.uplanet.signal": {
  	source: "iana"
  },
  	"application/vnd.uri-map": {
  	source: "iana"
  },
  	"application/vnd.valve.source.material": {
  	source: "iana"
  },
  	"application/vnd.vcx": {
  	source: "iana",
  	extensions: [
  		"vcx"
  	]
  },
  	"application/vnd.vd-study": {
  	source: "iana"
  },
  	"application/vnd.vectorworks": {
  	source: "iana"
  },
  	"application/vnd.vel+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.verimatrix.vcas": {
  	source: "iana"
  },
  	"application/vnd.vidsoft.vidconference": {
  	source: "iana"
  },
  	"application/vnd.visio": {
  	source: "iana",
  	extensions: [
  		"vsd",
  		"vst",
  		"vss",
  		"vsw"
  	]
  },
  	"application/vnd.visionary": {
  	source: "iana",
  	extensions: [
  		"vis"
  	]
  },
  	"application/vnd.vividence.scriptfile": {
  	source: "iana"
  },
  	"application/vnd.vsf": {
  	source: "iana",
  	extensions: [
  		"vsf"
  	]
  },
  	"application/vnd.wap.sic": {
  	source: "iana"
  },
  	"application/vnd.wap.slc": {
  	source: "iana"
  },
  	"application/vnd.wap.wbxml": {
  	source: "iana",
  	extensions: [
  		"wbxml"
  	]
  },
  	"application/vnd.wap.wmlc": {
  	source: "iana",
  	extensions: [
  		"wmlc"
  	]
  },
  	"application/vnd.wap.wmlscriptc": {
  	source: "iana",
  	extensions: [
  		"wmlsc"
  	]
  },
  	"application/vnd.webturbo": {
  	source: "iana",
  	extensions: [
  		"wtb"
  	]
  },
  	"application/vnd.wfa.p2p": {
  	source: "iana"
  },
  	"application/vnd.wfa.wsc": {
  	source: "iana"
  },
  	"application/vnd.windows.devicepairing": {
  	source: "iana"
  },
  	"application/vnd.wmc": {
  	source: "iana"
  },
  	"application/vnd.wmf.bootstrap": {
  	source: "iana"
  },
  	"application/vnd.wolfram.mathematica": {
  	source: "iana"
  },
  	"application/vnd.wolfram.mathematica.package": {
  	source: "iana"
  },
  	"application/vnd.wolfram.player": {
  	source: "iana",
  	extensions: [
  		"nbp"
  	]
  },
  	"application/vnd.wordperfect": {
  	source: "iana",
  	extensions: [
  		"wpd"
  	]
  },
  	"application/vnd.wqd": {
  	source: "iana",
  	extensions: [
  		"wqd"
  	]
  },
  	"application/vnd.wrq-hp3000-labelled": {
  	source: "iana"
  },
  	"application/vnd.wt.stf": {
  	source: "iana",
  	extensions: [
  		"stf"
  	]
  },
  	"application/vnd.wv.csp+wbxml": {
  	source: "iana"
  },
  	"application/vnd.wv.csp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.wv.ssp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.xacml+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.xara": {
  	source: "iana",
  	extensions: [
  		"xar"
  	]
  },
  	"application/vnd.xfdl": {
  	source: "iana",
  	extensions: [
  		"xfdl"
  	]
  },
  	"application/vnd.xfdl.webform": {
  	source: "iana"
  },
  	"application/vnd.xmi+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/vnd.xmpie.cpkg": {
  	source: "iana"
  },
  	"application/vnd.xmpie.dpkg": {
  	source: "iana"
  },
  	"application/vnd.xmpie.plan": {
  	source: "iana"
  },
  	"application/vnd.xmpie.ppkg": {
  	source: "iana"
  },
  	"application/vnd.xmpie.xlim": {
  	source: "iana"
  },
  	"application/vnd.yamaha.hv-dic": {
  	source: "iana",
  	extensions: [
  		"hvd"
  	]
  },
  	"application/vnd.yamaha.hv-script": {
  	source: "iana",
  	extensions: [
  		"hvs"
  	]
  },
  	"application/vnd.yamaha.hv-voice": {
  	source: "iana",
  	extensions: [
  		"hvp"
  	]
  },
  	"application/vnd.yamaha.openscoreformat": {
  	source: "iana",
  	extensions: [
  		"osf"
  	]
  },
  	"application/vnd.yamaha.openscoreformat.osfpvg+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"osfpvg"
  	]
  },
  	"application/vnd.yamaha.remote-setup": {
  	source: "iana"
  },
  	"application/vnd.yamaha.smaf-audio": {
  	source: "iana",
  	extensions: [
  		"saf"
  	]
  },
  	"application/vnd.yamaha.smaf-phrase": {
  	source: "iana",
  	extensions: [
  		"spf"
  	]
  },
  	"application/vnd.yamaha.through-ngn": {
  	source: "iana"
  },
  	"application/vnd.yamaha.tunnel-udpencap": {
  	source: "iana"
  },
  	"application/vnd.yaoweme": {
  	source: "iana"
  },
  	"application/vnd.yellowriver-custom-menu": {
  	source: "iana",
  	extensions: [
  		"cmp"
  	]
  },
  	"application/vnd.youtube.yt": {
  	source: "iana"
  },
  	"application/vnd.zul": {
  	source: "iana",
  	extensions: [
  		"zir",
  		"zirz"
  	]
  },
  	"application/vnd.zzazz.deck+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"zaz"
  	]
  },
  	"application/voicexml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"vxml"
  	]
  },
  	"application/voucher-cms+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/vq-rtcpxr": {
  	source: "iana"
  },
  	"application/wasm": {
  	compressible: true,
  	extensions: [
  		"wasm"
  	]
  },
  	"application/watcherinfo+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/webpush-options+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/whoispp-query": {
  	source: "iana"
  },
  	"application/whoispp-response": {
  	source: "iana"
  },
  	"application/widget": {
  	source: "iana",
  	extensions: [
  		"wgt"
  	]
  },
  	"application/winhlp": {
  	source: "apache",
  	extensions: [
  		"hlp"
  	]
  },
  	"application/wita": {
  	source: "iana"
  },
  	"application/wordperfect5.1": {
  	source: "iana"
  },
  	"application/wsdl+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"wsdl"
  	]
  },
  	"application/wspolicy+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"wspolicy"
  	]
  },
  	"application/x-7z-compressed": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"7z"
  	]
  },
  	"application/x-abiword": {
  	source: "apache",
  	extensions: [
  		"abw"
  	]
  },
  	"application/x-ace-compressed": {
  	source: "apache",
  	extensions: [
  		"ace"
  	]
  },
  	"application/x-amf": {
  	source: "apache"
  },
  	"application/x-apple-diskimage": {
  	source: "apache",
  	extensions: [
  		"dmg"
  	]
  },
  	"application/x-arj": {
  	compressible: false,
  	extensions: [
  		"arj"
  	]
  },
  	"application/x-authorware-bin": {
  	source: "apache",
  	extensions: [
  		"aab",
  		"x32",
  		"u32",
  		"vox"
  	]
  },
  	"application/x-authorware-map": {
  	source: "apache",
  	extensions: [
  		"aam"
  	]
  },
  	"application/x-authorware-seg": {
  	source: "apache",
  	extensions: [
  		"aas"
  	]
  },
  	"application/x-bcpio": {
  	source: "apache",
  	extensions: [
  		"bcpio"
  	]
  },
  	"application/x-bdoc": {
  	compressible: false,
  	extensions: [
  		"bdoc"
  	]
  },
  	"application/x-bittorrent": {
  	source: "apache",
  	extensions: [
  		"torrent"
  	]
  },
  	"application/x-blorb": {
  	source: "apache",
  	extensions: [
  		"blb",
  		"blorb"
  	]
  },
  	"application/x-bzip": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"bz"
  	]
  },
  	"application/x-bzip2": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"bz2",
  		"boz"
  	]
  },
  	"application/x-cbr": {
  	source: "apache",
  	extensions: [
  		"cbr",
  		"cba",
  		"cbt",
  		"cbz",
  		"cb7"
  	]
  },
  	"application/x-cdlink": {
  	source: "apache",
  	extensions: [
  		"vcd"
  	]
  },
  	"application/x-cfs-compressed": {
  	source: "apache",
  	extensions: [
  		"cfs"
  	]
  },
  	"application/x-chat": {
  	source: "apache",
  	extensions: [
  		"chat"
  	]
  },
  	"application/x-chess-pgn": {
  	source: "apache",
  	extensions: [
  		"pgn"
  	]
  },
  	"application/x-chrome-extension": {
  	extensions: [
  		"crx"
  	]
  },
  	"application/x-cocoa": {
  	source: "nginx",
  	extensions: [
  		"cco"
  	]
  },
  	"application/x-compress": {
  	source: "apache"
  },
  	"application/x-conference": {
  	source: "apache",
  	extensions: [
  		"nsc"
  	]
  },
  	"application/x-cpio": {
  	source: "apache",
  	extensions: [
  		"cpio"
  	]
  },
  	"application/x-csh": {
  	source: "apache",
  	extensions: [
  		"csh"
  	]
  },
  	"application/x-deb": {
  	compressible: false
  },
  	"application/x-debian-package": {
  	source: "apache",
  	extensions: [
  		"deb",
  		"udeb"
  	]
  },
  	"application/x-dgc-compressed": {
  	source: "apache",
  	extensions: [
  		"dgc"
  	]
  },
  	"application/x-director": {
  	source: "apache",
  	extensions: [
  		"dir",
  		"dcr",
  		"dxr",
  		"cst",
  		"cct",
  		"cxt",
  		"w3d",
  		"fgd",
  		"swa"
  	]
  },
  	"application/x-doom": {
  	source: "apache",
  	extensions: [
  		"wad"
  	]
  },
  	"application/x-dtbncx+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"ncx"
  	]
  },
  	"application/x-dtbook+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"dtb"
  	]
  },
  	"application/x-dtbresource+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"res"
  	]
  },
  	"application/x-dvi": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"dvi"
  	]
  },
  	"application/x-envoy": {
  	source: "apache",
  	extensions: [
  		"evy"
  	]
  },
  	"application/x-eva": {
  	source: "apache",
  	extensions: [
  		"eva"
  	]
  },
  	"application/x-font-bdf": {
  	source: "apache",
  	extensions: [
  		"bdf"
  	]
  },
  	"application/x-font-dos": {
  	source: "apache"
  },
  	"application/x-font-framemaker": {
  	source: "apache"
  },
  	"application/x-font-ghostscript": {
  	source: "apache",
  	extensions: [
  		"gsf"
  	]
  },
  	"application/x-font-libgrx": {
  	source: "apache"
  },
  	"application/x-font-linux-psf": {
  	source: "apache",
  	extensions: [
  		"psf"
  	]
  },
  	"application/x-font-pcf": {
  	source: "apache",
  	extensions: [
  		"pcf"
  	]
  },
  	"application/x-font-snf": {
  	source: "apache",
  	extensions: [
  		"snf"
  	]
  },
  	"application/x-font-speedo": {
  	source: "apache"
  },
  	"application/x-font-sunos-news": {
  	source: "apache"
  },
  	"application/x-font-type1": {
  	source: "apache",
  	extensions: [
  		"pfa",
  		"pfb",
  		"pfm",
  		"afm"
  	]
  },
  	"application/x-font-vfont": {
  	source: "apache"
  },
  	"application/x-freearc": {
  	source: "apache",
  	extensions: [
  		"arc"
  	]
  },
  	"application/x-futuresplash": {
  	source: "apache",
  	extensions: [
  		"spl"
  	]
  },
  	"application/x-gca-compressed": {
  	source: "apache",
  	extensions: [
  		"gca"
  	]
  },
  	"application/x-glulx": {
  	source: "apache",
  	extensions: [
  		"ulx"
  	]
  },
  	"application/x-gnumeric": {
  	source: "apache",
  	extensions: [
  		"gnumeric"
  	]
  },
  	"application/x-gramps-xml": {
  	source: "apache",
  	extensions: [
  		"gramps"
  	]
  },
  	"application/x-gtar": {
  	source: "apache",
  	extensions: [
  		"gtar"
  	]
  },
  	"application/x-gzip": {
  	source: "apache"
  },
  	"application/x-hdf": {
  	source: "apache",
  	extensions: [
  		"hdf"
  	]
  },
  	"application/x-httpd-php": {
  	compressible: true,
  	extensions: [
  		"php"
  	]
  },
  	"application/x-install-instructions": {
  	source: "apache",
  	extensions: [
  		"install"
  	]
  },
  	"application/x-iso9660-image": {
  	source: "apache",
  	extensions: [
  		"iso"
  	]
  },
  	"application/x-java-archive-diff": {
  	source: "nginx",
  	extensions: [
  		"jardiff"
  	]
  },
  	"application/x-java-jnlp-file": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"jnlp"
  	]
  },
  	"application/x-javascript": {
  	compressible: true
  },
  	"application/x-latex": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"latex"
  	]
  },
  	"application/x-lua-bytecode": {
  	extensions: [
  		"luac"
  	]
  },
  	"application/x-lzh-compressed": {
  	source: "apache",
  	extensions: [
  		"lzh",
  		"lha"
  	]
  },
  	"application/x-makeself": {
  	source: "nginx",
  	extensions: [
  		"run"
  	]
  },
  	"application/x-mie": {
  	source: "apache",
  	extensions: [
  		"mie"
  	]
  },
  	"application/x-mobipocket-ebook": {
  	source: "apache",
  	extensions: [
  		"prc",
  		"mobi"
  	]
  },
  	"application/x-mpegurl": {
  	compressible: false
  },
  	"application/x-ms-application": {
  	source: "apache",
  	extensions: [
  		"application"
  	]
  },
  	"application/x-ms-shortcut": {
  	source: "apache",
  	extensions: [
  		"lnk"
  	]
  },
  	"application/x-ms-wmd": {
  	source: "apache",
  	extensions: [
  		"wmd"
  	]
  },
  	"application/x-ms-wmz": {
  	source: "apache",
  	extensions: [
  		"wmz"
  	]
  },
  	"application/x-ms-xbap": {
  	source: "apache",
  	extensions: [
  		"xbap"
  	]
  },
  	"application/x-msaccess": {
  	source: "apache",
  	extensions: [
  		"mdb"
  	]
  },
  	"application/x-msbinder": {
  	source: "apache",
  	extensions: [
  		"obd"
  	]
  },
  	"application/x-mscardfile": {
  	source: "apache",
  	extensions: [
  		"crd"
  	]
  },
  	"application/x-msclip": {
  	source: "apache",
  	extensions: [
  		"clp"
  	]
  },
  	"application/x-msdos-program": {
  	extensions: [
  		"exe"
  	]
  },
  	"application/x-msdownload": {
  	source: "apache",
  	extensions: [
  		"exe",
  		"dll",
  		"com",
  		"bat",
  		"msi"
  	]
  },
  	"application/x-msmediaview": {
  	source: "apache",
  	extensions: [
  		"mvb",
  		"m13",
  		"m14"
  	]
  },
  	"application/x-msmetafile": {
  	source: "apache",
  	extensions: [
  		"wmf",
  		"wmz",
  		"emf",
  		"emz"
  	]
  },
  	"application/x-msmoney": {
  	source: "apache",
  	extensions: [
  		"mny"
  	]
  },
  	"application/x-mspublisher": {
  	source: "apache",
  	extensions: [
  		"pub"
  	]
  },
  	"application/x-msschedule": {
  	source: "apache",
  	extensions: [
  		"scd"
  	]
  },
  	"application/x-msterminal": {
  	source: "apache",
  	extensions: [
  		"trm"
  	]
  },
  	"application/x-mswrite": {
  	source: "apache",
  	extensions: [
  		"wri"
  	]
  },
  	"application/x-netcdf": {
  	source: "apache",
  	extensions: [
  		"nc",
  		"cdf"
  	]
  },
  	"application/x-ns-proxy-autoconfig": {
  	compressible: true,
  	extensions: [
  		"pac"
  	]
  },
  	"application/x-nzb": {
  	source: "apache",
  	extensions: [
  		"nzb"
  	]
  },
  	"application/x-perl": {
  	source: "nginx",
  	extensions: [
  		"pl",
  		"pm"
  	]
  },
  	"application/x-pilot": {
  	source: "nginx",
  	extensions: [
  		"prc",
  		"pdb"
  	]
  },
  	"application/x-pkcs12": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"p12",
  		"pfx"
  	]
  },
  	"application/x-pkcs7-certificates": {
  	source: "apache",
  	extensions: [
  		"p7b",
  		"spc"
  	]
  },
  	"application/x-pkcs7-certreqresp": {
  	source: "apache",
  	extensions: [
  		"p7r"
  	]
  },
  	"application/x-rar-compressed": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"rar"
  	]
  },
  	"application/x-redhat-package-manager": {
  	source: "nginx",
  	extensions: [
  		"rpm"
  	]
  },
  	"application/x-research-info-systems": {
  	source: "apache",
  	extensions: [
  		"ris"
  	]
  },
  	"application/x-sea": {
  	source: "nginx",
  	extensions: [
  		"sea"
  	]
  },
  	"application/x-sh": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"sh"
  	]
  },
  	"application/x-shar": {
  	source: "apache",
  	extensions: [
  		"shar"
  	]
  },
  	"application/x-shockwave-flash": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"swf"
  	]
  },
  	"application/x-silverlight-app": {
  	source: "apache",
  	extensions: [
  		"xap"
  	]
  },
  	"application/x-sql": {
  	source: "apache",
  	extensions: [
  		"sql"
  	]
  },
  	"application/x-stuffit": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"sit"
  	]
  },
  	"application/x-stuffitx": {
  	source: "apache",
  	extensions: [
  		"sitx"
  	]
  },
  	"application/x-subrip": {
  	source: "apache",
  	extensions: [
  		"srt"
  	]
  },
  	"application/x-sv4cpio": {
  	source: "apache",
  	extensions: [
  		"sv4cpio"
  	]
  },
  	"application/x-sv4crc": {
  	source: "apache",
  	extensions: [
  		"sv4crc"
  	]
  },
  	"application/x-t3vm-image": {
  	source: "apache",
  	extensions: [
  		"t3"
  	]
  },
  	"application/x-tads": {
  	source: "apache",
  	extensions: [
  		"gam"
  	]
  },
  	"application/x-tar": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"tar"
  	]
  },
  	"application/x-tcl": {
  	source: "apache",
  	extensions: [
  		"tcl",
  		"tk"
  	]
  },
  	"application/x-tex": {
  	source: "apache",
  	extensions: [
  		"tex"
  	]
  },
  	"application/x-tex-tfm": {
  	source: "apache",
  	extensions: [
  		"tfm"
  	]
  },
  	"application/x-texinfo": {
  	source: "apache",
  	extensions: [
  		"texinfo",
  		"texi"
  	]
  },
  	"application/x-tgif": {
  	source: "apache",
  	extensions: [
  		"obj"
  	]
  },
  	"application/x-ustar": {
  	source: "apache",
  	extensions: [
  		"ustar"
  	]
  },
  	"application/x-virtualbox-hdd": {
  	compressible: true,
  	extensions: [
  		"hdd"
  	]
  },
  	"application/x-virtualbox-ova": {
  	compressible: true,
  	extensions: [
  		"ova"
  	]
  },
  	"application/x-virtualbox-ovf": {
  	compressible: true,
  	extensions: [
  		"ovf"
  	]
  },
  	"application/x-virtualbox-vbox": {
  	compressible: true,
  	extensions: [
  		"vbox"
  	]
  },
  	"application/x-virtualbox-vbox-extpack": {
  	compressible: false,
  	extensions: [
  		"vbox-extpack"
  	]
  },
  	"application/x-virtualbox-vdi": {
  	compressible: true,
  	extensions: [
  		"vdi"
  	]
  },
  	"application/x-virtualbox-vhd": {
  	compressible: true,
  	extensions: [
  		"vhd"
  	]
  },
  	"application/x-virtualbox-vmdk": {
  	compressible: true,
  	extensions: [
  		"vmdk"
  	]
  },
  	"application/x-wais-source": {
  	source: "apache",
  	extensions: [
  		"src"
  	]
  },
  	"application/x-web-app-manifest+json": {
  	compressible: true,
  	extensions: [
  		"webapp"
  	]
  },
  	"application/x-www-form-urlencoded": {
  	source: "iana",
  	compressible: true
  },
  	"application/x-x509-ca-cert": {
  	source: "apache",
  	extensions: [
  		"der",
  		"crt",
  		"pem"
  	]
  },
  	"application/x-xfig": {
  	source: "apache",
  	extensions: [
  		"fig"
  	]
  },
  	"application/x-xliff+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"xlf"
  	]
  },
  	"application/x-xpinstall": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"xpi"
  	]
  },
  	"application/x-xz": {
  	source: "apache",
  	extensions: [
  		"xz"
  	]
  },
  	"application/x-zmachine": {
  	source: "apache",
  	extensions: [
  		"z1",
  		"z2",
  		"z3",
  		"z4",
  		"z5",
  		"z6",
  		"z7",
  		"z8"
  	]
  },
  	"application/x400-bp": {
  	source: "iana"
  },
  	"application/xacml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xaml+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"xaml"
  	]
  },
  	"application/xcap-att+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xcap-caps+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xcap-diff+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xdf"
  	]
  },
  	"application/xcap-el+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xcap-error+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xcap-ns+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xcon-conference-info+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xcon-conference-info-diff+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xenc+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xenc"
  	]
  },
  	"application/xhtml+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xhtml",
  		"xht"
  	]
  },
  	"application/xhtml-voice+xml": {
  	source: "apache",
  	compressible: true
  },
  	"application/xliff+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xml",
  		"xsl",
  		"xsd",
  		"rng"
  	]
  },
  	"application/xml-dtd": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"dtd"
  	]
  },
  	"application/xml-external-parsed-entity": {
  	source: "iana"
  },
  	"application/xml-patch+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xmpp+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/xop+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xop"
  	]
  },
  	"application/xproc+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"xpl"
  	]
  },
  	"application/xslt+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xslt"
  	]
  },
  	"application/xspf+xml": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"xspf"
  	]
  },
  	"application/xv+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"mxml",
  		"xhvml",
  		"xvml",
  		"xvm"
  	]
  },
  	"application/yang": {
  	source: "iana",
  	extensions: [
  		"yang"
  	]
  },
  	"application/yang-data+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/yang-data+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/yang-patch+json": {
  	source: "iana",
  	compressible: true
  },
  	"application/yang-patch+xml": {
  	source: "iana",
  	compressible: true
  },
  	"application/yin+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"yin"
  	]
  },
  	"application/zip": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"zip"
  	]
  },
  	"application/zlib": {
  	source: "iana"
  },
  	"application/zstd": {
  	source: "iana"
  },
  	"audio/1d-interleaved-parityfec": {
  	source: "iana"
  },
  	"audio/32kadpcm": {
  	source: "iana"
  },
  	"audio/3gpp": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"3gpp"
  	]
  },
  	"audio/3gpp2": {
  	source: "iana"
  },
  	"audio/aac": {
  	source: "iana"
  },
  	"audio/ac3": {
  	source: "iana"
  },
  	"audio/adpcm": {
  	source: "apache",
  	extensions: [
  		"adp"
  	]
  },
  	"audio/amr": {
  	source: "iana"
  },
  	"audio/amr-wb": {
  	source: "iana"
  },
  	"audio/amr-wb+": {
  	source: "iana"
  },
  	"audio/aptx": {
  	source: "iana"
  },
  	"audio/asc": {
  	source: "iana"
  },
  	"audio/atrac-advanced-lossless": {
  	source: "iana"
  },
  	"audio/atrac-x": {
  	source: "iana"
  },
  	"audio/atrac3": {
  	source: "iana"
  },
  	"audio/basic": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"au",
  		"snd"
  	]
  },
  	"audio/bv16": {
  	source: "iana"
  },
  	"audio/bv32": {
  	source: "iana"
  },
  	"audio/clearmode": {
  	source: "iana"
  },
  	"audio/cn": {
  	source: "iana"
  },
  	"audio/dat12": {
  	source: "iana"
  },
  	"audio/dls": {
  	source: "iana"
  },
  	"audio/dsr-es201108": {
  	source: "iana"
  },
  	"audio/dsr-es202050": {
  	source: "iana"
  },
  	"audio/dsr-es202211": {
  	source: "iana"
  },
  	"audio/dsr-es202212": {
  	source: "iana"
  },
  	"audio/dv": {
  	source: "iana"
  },
  	"audio/dvi4": {
  	source: "iana"
  },
  	"audio/eac3": {
  	source: "iana"
  },
  	"audio/encaprtp": {
  	source: "iana"
  },
  	"audio/evrc": {
  	source: "iana"
  },
  	"audio/evrc-qcp": {
  	source: "iana"
  },
  	"audio/evrc0": {
  	source: "iana"
  },
  	"audio/evrc1": {
  	source: "iana"
  },
  	"audio/evrcb": {
  	source: "iana"
  },
  	"audio/evrcb0": {
  	source: "iana"
  },
  	"audio/evrcb1": {
  	source: "iana"
  },
  	"audio/evrcnw": {
  	source: "iana"
  },
  	"audio/evrcnw0": {
  	source: "iana"
  },
  	"audio/evrcnw1": {
  	source: "iana"
  },
  	"audio/evrcwb": {
  	source: "iana"
  },
  	"audio/evrcwb0": {
  	source: "iana"
  },
  	"audio/evrcwb1": {
  	source: "iana"
  },
  	"audio/evs": {
  	source: "iana"
  },
  	"audio/fwdred": {
  	source: "iana"
  },
  	"audio/g711-0": {
  	source: "iana"
  },
  	"audio/g719": {
  	source: "iana"
  },
  	"audio/g722": {
  	source: "iana"
  },
  	"audio/g7221": {
  	source: "iana"
  },
  	"audio/g723": {
  	source: "iana"
  },
  	"audio/g726-16": {
  	source: "iana"
  },
  	"audio/g726-24": {
  	source: "iana"
  },
  	"audio/g726-32": {
  	source: "iana"
  },
  	"audio/g726-40": {
  	source: "iana"
  },
  	"audio/g728": {
  	source: "iana"
  },
  	"audio/g729": {
  	source: "iana"
  },
  	"audio/g7291": {
  	source: "iana"
  },
  	"audio/g729d": {
  	source: "iana"
  },
  	"audio/g729e": {
  	source: "iana"
  },
  	"audio/gsm": {
  	source: "iana"
  },
  	"audio/gsm-efr": {
  	source: "iana"
  },
  	"audio/gsm-hr-08": {
  	source: "iana"
  },
  	"audio/ilbc": {
  	source: "iana"
  },
  	"audio/ip-mr_v2.5": {
  	source: "iana"
  },
  	"audio/isac": {
  	source: "apache"
  },
  	"audio/l16": {
  	source: "iana"
  },
  	"audio/l20": {
  	source: "iana"
  },
  	"audio/l24": {
  	source: "iana",
  	compressible: false
  },
  	"audio/l8": {
  	source: "iana"
  },
  	"audio/lpc": {
  	source: "iana"
  },
  	"audio/melp": {
  	source: "iana"
  },
  	"audio/melp1200": {
  	source: "iana"
  },
  	"audio/melp2400": {
  	source: "iana"
  },
  	"audio/melp600": {
  	source: "iana"
  },
  	"audio/midi": {
  	source: "apache",
  	extensions: [
  		"mid",
  		"midi",
  		"kar",
  		"rmi"
  	]
  },
  	"audio/mobile-xmf": {
  	source: "iana"
  },
  	"audio/mp3": {
  	compressible: false,
  	extensions: [
  		"mp3"
  	]
  },
  	"audio/mp4": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"m4a",
  		"mp4a"
  	]
  },
  	"audio/mp4a-latm": {
  	source: "iana"
  },
  	"audio/mpa": {
  	source: "iana"
  },
  	"audio/mpa-robust": {
  	source: "iana"
  },
  	"audio/mpeg": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"mpga",
  		"mp2",
  		"mp2a",
  		"mp3",
  		"m2a",
  		"m3a"
  	]
  },
  	"audio/mpeg4-generic": {
  	source: "iana"
  },
  	"audio/musepack": {
  	source: "apache"
  },
  	"audio/ogg": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"oga",
  		"ogg",
  		"spx"
  	]
  },
  	"audio/opus": {
  	source: "iana"
  },
  	"audio/parityfec": {
  	source: "iana"
  },
  	"audio/pcma": {
  	source: "iana"
  },
  	"audio/pcma-wb": {
  	source: "iana"
  },
  	"audio/pcmu": {
  	source: "iana"
  },
  	"audio/pcmu-wb": {
  	source: "iana"
  },
  	"audio/prs.sid": {
  	source: "iana"
  },
  	"audio/qcelp": {
  	source: "iana"
  },
  	"audio/raptorfec": {
  	source: "iana"
  },
  	"audio/red": {
  	source: "iana"
  },
  	"audio/rtp-enc-aescm128": {
  	source: "iana"
  },
  	"audio/rtp-midi": {
  	source: "iana"
  },
  	"audio/rtploopback": {
  	source: "iana"
  },
  	"audio/rtx": {
  	source: "iana"
  },
  	"audio/s3m": {
  	source: "apache",
  	extensions: [
  		"s3m"
  	]
  },
  	"audio/silk": {
  	source: "apache",
  	extensions: [
  		"sil"
  	]
  },
  	"audio/smv": {
  	source: "iana"
  },
  	"audio/smv-qcp": {
  	source: "iana"
  },
  	"audio/smv0": {
  	source: "iana"
  },
  	"audio/sp-midi": {
  	source: "iana"
  },
  	"audio/speex": {
  	source: "iana"
  },
  	"audio/t140c": {
  	source: "iana"
  },
  	"audio/t38": {
  	source: "iana"
  },
  	"audio/telephone-event": {
  	source: "iana"
  },
  	"audio/tone": {
  	source: "iana"
  },
  	"audio/uemclip": {
  	source: "iana"
  },
  	"audio/ulpfec": {
  	source: "iana"
  },
  	"audio/usac": {
  	source: "iana"
  },
  	"audio/vdvi": {
  	source: "iana"
  },
  	"audio/vmr-wb": {
  	source: "iana"
  },
  	"audio/vnd.3gpp.iufp": {
  	source: "iana"
  },
  	"audio/vnd.4sb": {
  	source: "iana"
  },
  	"audio/vnd.audiokoz": {
  	source: "iana"
  },
  	"audio/vnd.celp": {
  	source: "iana"
  },
  	"audio/vnd.cisco.nse": {
  	source: "iana"
  },
  	"audio/vnd.cmles.radio-events": {
  	source: "iana"
  },
  	"audio/vnd.cns.anp1": {
  	source: "iana"
  },
  	"audio/vnd.cns.inf1": {
  	source: "iana"
  },
  	"audio/vnd.dece.audio": {
  	source: "iana",
  	extensions: [
  		"uva",
  		"uvva"
  	]
  },
  	"audio/vnd.digital-winds": {
  	source: "iana",
  	extensions: [
  		"eol"
  	]
  },
  	"audio/vnd.dlna.adts": {
  	source: "iana"
  },
  	"audio/vnd.dolby.heaac.1": {
  	source: "iana"
  },
  	"audio/vnd.dolby.heaac.2": {
  	source: "iana"
  },
  	"audio/vnd.dolby.mlp": {
  	source: "iana"
  },
  	"audio/vnd.dolby.mps": {
  	source: "iana"
  },
  	"audio/vnd.dolby.pl2": {
  	source: "iana"
  },
  	"audio/vnd.dolby.pl2x": {
  	source: "iana"
  },
  	"audio/vnd.dolby.pl2z": {
  	source: "iana"
  },
  	"audio/vnd.dolby.pulse.1": {
  	source: "iana"
  },
  	"audio/vnd.dra": {
  	source: "iana",
  	extensions: [
  		"dra"
  	]
  },
  	"audio/vnd.dts": {
  	source: "iana",
  	extensions: [
  		"dts"
  	]
  },
  	"audio/vnd.dts.hd": {
  	source: "iana",
  	extensions: [
  		"dtshd"
  	]
  },
  	"audio/vnd.dvb.file": {
  	source: "iana"
  },
  	"audio/vnd.everad.plj": {
  	source: "iana"
  },
  	"audio/vnd.hns.audio": {
  	source: "iana"
  },
  	"audio/vnd.lucent.voice": {
  	source: "iana",
  	extensions: [
  		"lvp"
  	]
  },
  	"audio/vnd.ms-playready.media.pya": {
  	source: "iana",
  	extensions: [
  		"pya"
  	]
  },
  	"audio/vnd.nokia.mobile-xmf": {
  	source: "iana"
  },
  	"audio/vnd.nortel.vbk": {
  	source: "iana"
  },
  	"audio/vnd.nuera.ecelp4800": {
  	source: "iana",
  	extensions: [
  		"ecelp4800"
  	]
  },
  	"audio/vnd.nuera.ecelp7470": {
  	source: "iana",
  	extensions: [
  		"ecelp7470"
  	]
  },
  	"audio/vnd.nuera.ecelp9600": {
  	source: "iana",
  	extensions: [
  		"ecelp9600"
  	]
  },
  	"audio/vnd.octel.sbc": {
  	source: "iana"
  },
  	"audio/vnd.presonus.multitrack": {
  	source: "iana"
  },
  	"audio/vnd.qcelp": {
  	source: "iana"
  },
  	"audio/vnd.rhetorex.32kadpcm": {
  	source: "iana"
  },
  	"audio/vnd.rip": {
  	source: "iana",
  	extensions: [
  		"rip"
  	]
  },
  	"audio/vnd.rn-realaudio": {
  	compressible: false
  },
  	"audio/vnd.sealedmedia.softseal.mpeg": {
  	source: "iana"
  },
  	"audio/vnd.vmx.cvsd": {
  	source: "iana"
  },
  	"audio/vnd.wave": {
  	compressible: false
  },
  	"audio/vorbis": {
  	source: "iana",
  	compressible: false
  },
  	"audio/vorbis-config": {
  	source: "iana"
  },
  	"audio/wav": {
  	compressible: false,
  	extensions: [
  		"wav"
  	]
  },
  	"audio/wave": {
  	compressible: false,
  	extensions: [
  		"wav"
  	]
  },
  	"audio/webm": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"weba"
  	]
  },
  	"audio/x-aac": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"aac"
  	]
  },
  	"audio/x-aiff": {
  	source: "apache",
  	extensions: [
  		"aif",
  		"aiff",
  		"aifc"
  	]
  },
  	"audio/x-caf": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"caf"
  	]
  },
  	"audio/x-flac": {
  	source: "apache",
  	extensions: [
  		"flac"
  	]
  },
  	"audio/x-m4a": {
  	source: "nginx",
  	extensions: [
  		"m4a"
  	]
  },
  	"audio/x-matroska": {
  	source: "apache",
  	extensions: [
  		"mka"
  	]
  },
  	"audio/x-mpegurl": {
  	source: "apache",
  	extensions: [
  		"m3u"
  	]
  },
  	"audio/x-ms-wax": {
  	source: "apache",
  	extensions: [
  		"wax"
  	]
  },
  	"audio/x-ms-wma": {
  	source: "apache",
  	extensions: [
  		"wma"
  	]
  },
  	"audio/x-pn-realaudio": {
  	source: "apache",
  	extensions: [
  		"ram",
  		"ra"
  	]
  },
  	"audio/x-pn-realaudio-plugin": {
  	source: "apache",
  	extensions: [
  		"rmp"
  	]
  },
  	"audio/x-realaudio": {
  	source: "nginx",
  	extensions: [
  		"ra"
  	]
  },
  	"audio/x-tta": {
  	source: "apache"
  },
  	"audio/x-wav": {
  	source: "apache",
  	extensions: [
  		"wav"
  	]
  },
  	"audio/xm": {
  	source: "apache",
  	extensions: [
  		"xm"
  	]
  },
  	"chemical/x-cdx": {
  	source: "apache",
  	extensions: [
  		"cdx"
  	]
  },
  	"chemical/x-cif": {
  	source: "apache",
  	extensions: [
  		"cif"
  	]
  },
  	"chemical/x-cmdf": {
  	source: "apache",
  	extensions: [
  		"cmdf"
  	]
  },
  	"chemical/x-cml": {
  	source: "apache",
  	extensions: [
  		"cml"
  	]
  },
  	"chemical/x-csml": {
  	source: "apache",
  	extensions: [
  		"csml"
  	]
  },
  	"chemical/x-pdb": {
  	source: "apache"
  },
  	"chemical/x-xyz": {
  	source: "apache",
  	extensions: [
  		"xyz"
  	]
  },
  	"font/collection": {
  	source: "iana",
  	extensions: [
  		"ttc"
  	]
  },
  	"font/otf": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"otf"
  	]
  },
  	"font/sfnt": {
  	source: "iana"
  },
  	"font/ttf": {
  	source: "iana",
  	extensions: [
  		"ttf"
  	]
  },
  	"font/woff": {
  	source: "iana",
  	extensions: [
  		"woff"
  	]
  },
  	"font/woff2": {
  	source: "iana",
  	extensions: [
  		"woff2"
  	]
  },
  	"image/aces": {
  	source: "iana",
  	extensions: [
  		"exr"
  	]
  },
  	"image/apng": {
  	compressible: false,
  	extensions: [
  		"apng"
  	]
  },
  	"image/avci": {
  	source: "iana"
  },
  	"image/avcs": {
  	source: "iana"
  },
  	"image/bmp": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"bmp"
  	]
  },
  	"image/cgm": {
  	source: "iana",
  	extensions: [
  		"cgm"
  	]
  },
  	"image/dicom-rle": {
  	source: "iana",
  	extensions: [
  		"drle"
  	]
  },
  	"image/emf": {
  	source: "iana",
  	extensions: [
  		"emf"
  	]
  },
  	"image/fits": {
  	source: "iana",
  	extensions: [
  		"fits"
  	]
  },
  	"image/g3fax": {
  	source: "iana",
  	extensions: [
  		"g3"
  	]
  },
  	"image/gif": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"gif"
  	]
  },
  	"image/heic": {
  	source: "iana",
  	extensions: [
  		"heic"
  	]
  },
  	"image/heic-sequence": {
  	source: "iana",
  	extensions: [
  		"heics"
  	]
  },
  	"image/heif": {
  	source: "iana",
  	extensions: [
  		"heif"
  	]
  },
  	"image/heif-sequence": {
  	source: "iana",
  	extensions: [
  		"heifs"
  	]
  },
  	"image/ief": {
  	source: "iana",
  	extensions: [
  		"ief"
  	]
  },
  	"image/jls": {
  	source: "iana",
  	extensions: [
  		"jls"
  	]
  },
  	"image/jp2": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"jp2",
  		"jpg2"
  	]
  },
  	"image/jpeg": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"jpeg",
  		"jpg",
  		"jpe"
  	]
  },
  	"image/jpm": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"jpm"
  	]
  },
  	"image/jpx": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"jpx",
  		"jpf"
  	]
  },
  	"image/ktx": {
  	source: "iana",
  	extensions: [
  		"ktx"
  	]
  },
  	"image/naplps": {
  	source: "iana"
  },
  	"image/pjpeg": {
  	compressible: false
  },
  	"image/png": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"png"
  	]
  },
  	"image/prs.btif": {
  	source: "iana",
  	extensions: [
  		"btif"
  	]
  },
  	"image/prs.pti": {
  	source: "iana",
  	extensions: [
  		"pti"
  	]
  },
  	"image/pwg-raster": {
  	source: "iana"
  },
  	"image/sgi": {
  	source: "apache",
  	extensions: [
  		"sgi"
  	]
  },
  	"image/svg+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"svg",
  		"svgz"
  	]
  },
  	"image/t38": {
  	source: "iana",
  	extensions: [
  		"t38"
  	]
  },
  	"image/tiff": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"tif",
  		"tiff"
  	]
  },
  	"image/tiff-fx": {
  	source: "iana",
  	extensions: [
  		"tfx"
  	]
  },
  	"image/vnd.adobe.photoshop": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"psd"
  	]
  },
  	"image/vnd.airzip.accelerator.azv": {
  	source: "iana",
  	extensions: [
  		"azv"
  	]
  },
  	"image/vnd.cns.inf2": {
  	source: "iana"
  },
  	"image/vnd.dece.graphic": {
  	source: "iana",
  	extensions: [
  		"uvi",
  		"uvvi",
  		"uvg",
  		"uvvg"
  	]
  },
  	"image/vnd.djvu": {
  	source: "iana",
  	extensions: [
  		"djvu",
  		"djv"
  	]
  },
  	"image/vnd.dvb.subtitle": {
  	source: "iana",
  	extensions: [
  		"sub"
  	]
  },
  	"image/vnd.dwg": {
  	source: "iana",
  	extensions: [
  		"dwg"
  	]
  },
  	"image/vnd.dxf": {
  	source: "iana",
  	extensions: [
  		"dxf"
  	]
  },
  	"image/vnd.fastbidsheet": {
  	source: "iana",
  	extensions: [
  		"fbs"
  	]
  },
  	"image/vnd.fpx": {
  	source: "iana",
  	extensions: [
  		"fpx"
  	]
  },
  	"image/vnd.fst": {
  	source: "iana",
  	extensions: [
  		"fst"
  	]
  },
  	"image/vnd.fujixerox.edmics-mmr": {
  	source: "iana",
  	extensions: [
  		"mmr"
  	]
  },
  	"image/vnd.fujixerox.edmics-rlc": {
  	source: "iana",
  	extensions: [
  		"rlc"
  	]
  },
  	"image/vnd.globalgraphics.pgb": {
  	source: "iana"
  },
  	"image/vnd.microsoft.icon": {
  	source: "iana",
  	extensions: [
  		"ico"
  	]
  },
  	"image/vnd.mix": {
  	source: "iana"
  },
  	"image/vnd.mozilla.apng": {
  	source: "iana"
  },
  	"image/vnd.ms-modi": {
  	source: "iana",
  	extensions: [
  		"mdi"
  	]
  },
  	"image/vnd.ms-photo": {
  	source: "apache",
  	extensions: [
  		"wdp"
  	]
  },
  	"image/vnd.net-fpx": {
  	source: "iana",
  	extensions: [
  		"npx"
  	]
  },
  	"image/vnd.radiance": {
  	source: "iana"
  },
  	"image/vnd.sealed.png": {
  	source: "iana"
  },
  	"image/vnd.sealedmedia.softseal.gif": {
  	source: "iana"
  },
  	"image/vnd.sealedmedia.softseal.jpg": {
  	source: "iana"
  },
  	"image/vnd.svf": {
  	source: "iana"
  },
  	"image/vnd.tencent.tap": {
  	source: "iana",
  	extensions: [
  		"tap"
  	]
  },
  	"image/vnd.valve.source.texture": {
  	source: "iana",
  	extensions: [
  		"vtf"
  	]
  },
  	"image/vnd.wap.wbmp": {
  	source: "iana",
  	extensions: [
  		"wbmp"
  	]
  },
  	"image/vnd.xiff": {
  	source: "iana",
  	extensions: [
  		"xif"
  	]
  },
  	"image/vnd.zbrush.pcx": {
  	source: "iana",
  	extensions: [
  		"pcx"
  	]
  },
  	"image/webp": {
  	source: "apache",
  	extensions: [
  		"webp"
  	]
  },
  	"image/wmf": {
  	source: "iana",
  	extensions: [
  		"wmf"
  	]
  },
  	"image/x-3ds": {
  	source: "apache",
  	extensions: [
  		"3ds"
  	]
  },
  	"image/x-cmu-raster": {
  	source: "apache",
  	extensions: [
  		"ras"
  	]
  },
  	"image/x-cmx": {
  	source: "apache",
  	extensions: [
  		"cmx"
  	]
  },
  	"image/x-freehand": {
  	source: "apache",
  	extensions: [
  		"fh",
  		"fhc",
  		"fh4",
  		"fh5",
  		"fh7"
  	]
  },
  	"image/x-icon": {
  	source: "apache",
  	compressible: true,
  	extensions: [
  		"ico"
  	]
  },
  	"image/x-jng": {
  	source: "nginx",
  	extensions: [
  		"jng"
  	]
  },
  	"image/x-mrsid-image": {
  	source: "apache",
  	extensions: [
  		"sid"
  	]
  },
  	"image/x-ms-bmp": {
  	source: "nginx",
  	compressible: true,
  	extensions: [
  		"bmp"
  	]
  },
  	"image/x-pcx": {
  	source: "apache",
  	extensions: [
  		"pcx"
  	]
  },
  	"image/x-pict": {
  	source: "apache",
  	extensions: [
  		"pic",
  		"pct"
  	]
  },
  	"image/x-portable-anymap": {
  	source: "apache",
  	extensions: [
  		"pnm"
  	]
  },
  	"image/x-portable-bitmap": {
  	source: "apache",
  	extensions: [
  		"pbm"
  	]
  },
  	"image/x-portable-graymap": {
  	source: "apache",
  	extensions: [
  		"pgm"
  	]
  },
  	"image/x-portable-pixmap": {
  	source: "apache",
  	extensions: [
  		"ppm"
  	]
  },
  	"image/x-rgb": {
  	source: "apache",
  	extensions: [
  		"rgb"
  	]
  },
  	"image/x-tga": {
  	source: "apache",
  	extensions: [
  		"tga"
  	]
  },
  	"image/x-xbitmap": {
  	source: "apache",
  	extensions: [
  		"xbm"
  	]
  },
  	"image/x-xcf": {
  	compressible: false
  },
  	"image/x-xpixmap": {
  	source: "apache",
  	extensions: [
  		"xpm"
  	]
  },
  	"image/x-xwindowdump": {
  	source: "apache",
  	extensions: [
  		"xwd"
  	]
  },
  	"message/cpim": {
  	source: "iana"
  },
  	"message/delivery-status": {
  	source: "iana"
  },
  	"message/disposition-notification": {
  	source: "iana",
  	extensions: [
  		"disposition-notification"
  	]
  },
  	"message/external-body": {
  	source: "iana"
  },
  	"message/feedback-report": {
  	source: "iana"
  },
  	"message/global": {
  	source: "iana",
  	extensions: [
  		"u8msg"
  	]
  },
  	"message/global-delivery-status": {
  	source: "iana",
  	extensions: [
  		"u8dsn"
  	]
  },
  	"message/global-disposition-notification": {
  	source: "iana",
  	extensions: [
  		"u8mdn"
  	]
  },
  	"message/global-headers": {
  	source: "iana",
  	extensions: [
  		"u8hdr"
  	]
  },
  	"message/http": {
  	source: "iana",
  	compressible: false
  },
  	"message/imdn+xml": {
  	source: "iana",
  	compressible: true
  },
  	"message/news": {
  	source: "iana"
  },
  	"message/partial": {
  	source: "iana",
  	compressible: false
  },
  	"message/rfc822": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"eml",
  		"mime"
  	]
  },
  	"message/s-http": {
  	source: "iana"
  },
  	"message/sip": {
  	source: "iana"
  },
  	"message/sipfrag": {
  	source: "iana"
  },
  	"message/tracking-status": {
  	source: "iana"
  },
  	"message/vnd.si.simp": {
  	source: "iana"
  },
  	"message/vnd.wfa.wsc": {
  	source: "iana",
  	extensions: [
  		"wsc"
  	]
  },
  	"model/3mf": {
  	source: "iana"
  },
  	"model/gltf+json": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"gltf"
  	]
  },
  	"model/gltf-binary": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"glb"
  	]
  },
  	"model/iges": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"igs",
  		"iges"
  	]
  },
  	"model/mesh": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"msh",
  		"mesh",
  		"silo"
  	]
  },
  	"model/stl": {
  	source: "iana"
  },
  	"model/vnd.collada+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"dae"
  	]
  },
  	"model/vnd.dwf": {
  	source: "iana",
  	extensions: [
  		"dwf"
  	]
  },
  	"model/vnd.flatland.3dml": {
  	source: "iana"
  },
  	"model/vnd.gdl": {
  	source: "iana",
  	extensions: [
  		"gdl"
  	]
  },
  	"model/vnd.gs-gdl": {
  	source: "apache"
  },
  	"model/vnd.gs.gdl": {
  	source: "iana"
  },
  	"model/vnd.gtw": {
  	source: "iana",
  	extensions: [
  		"gtw"
  	]
  },
  	"model/vnd.moml+xml": {
  	source: "iana",
  	compressible: true
  },
  	"model/vnd.mts": {
  	source: "iana",
  	extensions: [
  		"mts"
  	]
  },
  	"model/vnd.opengex": {
  	source: "iana"
  },
  	"model/vnd.parasolid.transmit.binary": {
  	source: "iana"
  },
  	"model/vnd.parasolid.transmit.text": {
  	source: "iana"
  },
  	"model/vnd.rosette.annotated-data-model": {
  	source: "iana"
  },
  	"model/vnd.usdz+zip": {
  	source: "iana",
  	compressible: false
  },
  	"model/vnd.valve.source.compiled-map": {
  	source: "iana"
  },
  	"model/vnd.vtu": {
  	source: "iana",
  	extensions: [
  		"vtu"
  	]
  },
  	"model/vrml": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"wrl",
  		"vrml"
  	]
  },
  	"model/x3d+binary": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"x3db",
  		"x3dbz"
  	]
  },
  	"model/x3d+fastinfoset": {
  	source: "iana"
  },
  	"model/x3d+vrml": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"x3dv",
  		"x3dvz"
  	]
  },
  	"model/x3d+xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"x3d",
  		"x3dz"
  	]
  },
  	"model/x3d-vrml": {
  	source: "iana"
  },
  	"multipart/alternative": {
  	source: "iana",
  	compressible: false
  },
  	"multipart/appledouble": {
  	source: "iana"
  },
  	"multipart/byteranges": {
  	source: "iana"
  },
  	"multipart/digest": {
  	source: "iana"
  },
  	"multipart/encrypted": {
  	source: "iana",
  	compressible: false
  },
  	"multipart/form-data": {
  	source: "iana",
  	compressible: false
  },
  	"multipart/header-set": {
  	source: "iana"
  },
  	"multipart/mixed": {
  	source: "iana",
  	compressible: false
  },
  	"multipart/multilingual": {
  	source: "iana"
  },
  	"multipart/parallel": {
  	source: "iana"
  },
  	"multipart/related": {
  	source: "iana",
  	compressible: false
  },
  	"multipart/report": {
  	source: "iana"
  },
  	"multipart/signed": {
  	source: "iana",
  	compressible: false
  },
  	"multipart/vnd.bint.med-plus": {
  	source: "iana"
  },
  	"multipart/voice-message": {
  	source: "iana"
  },
  	"multipart/x-mixed-replace": {
  	source: "iana"
  },
  	"text/1d-interleaved-parityfec": {
  	source: "iana"
  },
  	"text/cache-manifest": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"appcache",
  		"manifest"
  	]
  },
  	"text/calendar": {
  	source: "iana",
  	extensions: [
  		"ics",
  		"ifb"
  	]
  },
  	"text/calender": {
  	compressible: true
  },
  	"text/cmd": {
  	compressible: true
  },
  	"text/coffeescript": {
  	extensions: [
  		"coffee",
  		"litcoffee"
  	]
  },
  	"text/css": {
  	source: "iana",
  	charset: "UTF-8",
  	compressible: true,
  	extensions: [
  		"css"
  	]
  },
  	"text/csv": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"csv"
  	]
  },
  	"text/csv-schema": {
  	source: "iana"
  },
  	"text/directory": {
  	source: "iana"
  },
  	"text/dns": {
  	source: "iana"
  },
  	"text/ecmascript": {
  	source: "iana"
  },
  	"text/encaprtp": {
  	source: "iana"
  },
  	"text/enriched": {
  	source: "iana"
  },
  	"text/fwdred": {
  	source: "iana"
  },
  	"text/grammar-ref-list": {
  	source: "iana"
  },
  	"text/html": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"html",
  		"htm",
  		"shtml"
  	]
  },
  	"text/jade": {
  	extensions: [
  		"jade"
  	]
  },
  	"text/javascript": {
  	source: "iana",
  	compressible: true
  },
  	"text/jcr-cnd": {
  	source: "iana"
  },
  	"text/jsx": {
  	compressible: true,
  	extensions: [
  		"jsx"
  	]
  },
  	"text/less": {
  	extensions: [
  		"less"
  	]
  },
  	"text/markdown": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"markdown",
  		"md"
  	]
  },
  	"text/mathml": {
  	source: "nginx",
  	extensions: [
  		"mml"
  	]
  },
  	"text/mizar": {
  	source: "iana"
  },
  	"text/n3": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"n3"
  	]
  },
  	"text/parameters": {
  	source: "iana"
  },
  	"text/parityfec": {
  	source: "iana"
  },
  	"text/plain": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"txt",
  		"text",
  		"conf",
  		"def",
  		"list",
  		"log",
  		"in",
  		"ini"
  	]
  },
  	"text/provenance-notation": {
  	source: "iana"
  },
  	"text/prs.fallenstein.rst": {
  	source: "iana"
  },
  	"text/prs.lines.tag": {
  	source: "iana",
  	extensions: [
  		"dsc"
  	]
  },
  	"text/prs.prop.logic": {
  	source: "iana"
  },
  	"text/raptorfec": {
  	source: "iana"
  },
  	"text/red": {
  	source: "iana"
  },
  	"text/rfc822-headers": {
  	source: "iana"
  },
  	"text/richtext": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rtx"
  	]
  },
  	"text/rtf": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"rtf"
  	]
  },
  	"text/rtp-enc-aescm128": {
  	source: "iana"
  },
  	"text/rtploopback": {
  	source: "iana"
  },
  	"text/rtx": {
  	source: "iana"
  },
  	"text/sgml": {
  	source: "iana",
  	extensions: [
  		"sgml",
  		"sgm"
  	]
  },
  	"text/shex": {
  	extensions: [
  		"shex"
  	]
  },
  	"text/slim": {
  	extensions: [
  		"slim",
  		"slm"
  	]
  },
  	"text/strings": {
  	source: "iana"
  },
  	"text/stylus": {
  	extensions: [
  		"stylus",
  		"styl"
  	]
  },
  	"text/t140": {
  	source: "iana"
  },
  	"text/tab-separated-values": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"tsv"
  	]
  },
  	"text/troff": {
  	source: "iana",
  	extensions: [
  		"t",
  		"tr",
  		"roff",
  		"man",
  		"me",
  		"ms"
  	]
  },
  	"text/turtle": {
  	source: "iana",
  	charset: "UTF-8",
  	extensions: [
  		"ttl"
  	]
  },
  	"text/ulpfec": {
  	source: "iana"
  },
  	"text/uri-list": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"uri",
  		"uris",
  		"urls"
  	]
  },
  	"text/vcard": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"vcard"
  	]
  },
  	"text/vnd.a": {
  	source: "iana"
  },
  	"text/vnd.abc": {
  	source: "iana"
  },
  	"text/vnd.ascii-art": {
  	source: "iana"
  },
  	"text/vnd.curl": {
  	source: "iana",
  	extensions: [
  		"curl"
  	]
  },
  	"text/vnd.curl.dcurl": {
  	source: "apache",
  	extensions: [
  		"dcurl"
  	]
  },
  	"text/vnd.curl.mcurl": {
  	source: "apache",
  	extensions: [
  		"mcurl"
  	]
  },
  	"text/vnd.curl.scurl": {
  	source: "apache",
  	extensions: [
  		"scurl"
  	]
  },
  	"text/vnd.debian.copyright": {
  	source: "iana"
  },
  	"text/vnd.dmclientscript": {
  	source: "iana"
  },
  	"text/vnd.dvb.subtitle": {
  	source: "iana",
  	extensions: [
  		"sub"
  	]
  },
  	"text/vnd.esmertec.theme-descriptor": {
  	source: "iana"
  },
  	"text/vnd.fly": {
  	source: "iana",
  	extensions: [
  		"fly"
  	]
  },
  	"text/vnd.fmi.flexstor": {
  	source: "iana",
  	extensions: [
  		"flx"
  	]
  },
  	"text/vnd.gml": {
  	source: "iana"
  },
  	"text/vnd.graphviz": {
  	source: "iana",
  	extensions: [
  		"gv"
  	]
  },
  	"text/vnd.hgl": {
  	source: "iana"
  },
  	"text/vnd.in3d.3dml": {
  	source: "iana",
  	extensions: [
  		"3dml"
  	]
  },
  	"text/vnd.in3d.spot": {
  	source: "iana",
  	extensions: [
  		"spot"
  	]
  },
  	"text/vnd.iptc.newsml": {
  	source: "iana"
  },
  	"text/vnd.iptc.nitf": {
  	source: "iana"
  },
  	"text/vnd.latex-z": {
  	source: "iana"
  },
  	"text/vnd.motorola.reflex": {
  	source: "iana"
  },
  	"text/vnd.ms-mediapackage": {
  	source: "iana"
  },
  	"text/vnd.net2phone.commcenter.command": {
  	source: "iana"
  },
  	"text/vnd.radisys.msml-basic-layout": {
  	source: "iana"
  },
  	"text/vnd.si.uricatalogue": {
  	source: "iana"
  },
  	"text/vnd.sun.j2me.app-descriptor": {
  	source: "iana",
  	extensions: [
  		"jad"
  	]
  },
  	"text/vnd.trolltech.linguist": {
  	source: "iana"
  },
  	"text/vnd.wap.si": {
  	source: "iana"
  },
  	"text/vnd.wap.sl": {
  	source: "iana"
  },
  	"text/vnd.wap.wml": {
  	source: "iana",
  	extensions: [
  		"wml"
  	]
  },
  	"text/vnd.wap.wmlscript": {
  	source: "iana",
  	extensions: [
  		"wmls"
  	]
  },
  	"text/vtt": {
  	charset: "UTF-8",
  	compressible: true,
  	extensions: [
  		"vtt"
  	]
  },
  	"text/x-asm": {
  	source: "apache",
  	extensions: [
  		"s",
  		"asm"
  	]
  },
  	"text/x-c": {
  	source: "apache",
  	extensions: [
  		"c",
  		"cc",
  		"cxx",
  		"cpp",
  		"h",
  		"hh",
  		"dic"
  	]
  },
  	"text/x-component": {
  	source: "nginx",
  	extensions: [
  		"htc"
  	]
  },
  	"text/x-fortran": {
  	source: "apache",
  	extensions: [
  		"f",
  		"for",
  		"f77",
  		"f90"
  	]
  },
  	"text/x-gwt-rpc": {
  	compressible: true
  },
  	"text/x-handlebars-template": {
  	extensions: [
  		"hbs"
  	]
  },
  	"text/x-java-source": {
  	source: "apache",
  	extensions: [
  		"java"
  	]
  },
  	"text/x-jquery-tmpl": {
  	compressible: true
  },
  	"text/x-lua": {
  	extensions: [
  		"lua"
  	]
  },
  	"text/x-markdown": {
  	compressible: true,
  	extensions: [
  		"mkd"
  	]
  },
  	"text/x-nfo": {
  	source: "apache",
  	extensions: [
  		"nfo"
  	]
  },
  	"text/x-opml": {
  	source: "apache",
  	extensions: [
  		"opml"
  	]
  },
  	"text/x-org": {
  	compressible: true,
  	extensions: [
  		"org"
  	]
  },
  	"text/x-pascal": {
  	source: "apache",
  	extensions: [
  		"p",
  		"pas"
  	]
  },
  	"text/x-processing": {
  	compressible: true,
  	extensions: [
  		"pde"
  	]
  },
  	"text/x-sass": {
  	extensions: [
  		"sass"
  	]
  },
  	"text/x-scss": {
  	extensions: [
  		"scss"
  	]
  },
  	"text/x-setext": {
  	source: "apache",
  	extensions: [
  		"etx"
  	]
  },
  	"text/x-sfv": {
  	source: "apache",
  	extensions: [
  		"sfv"
  	]
  },
  	"text/x-suse-ymp": {
  	compressible: true,
  	extensions: [
  		"ymp"
  	]
  },
  	"text/x-uuencode": {
  	source: "apache",
  	extensions: [
  		"uu"
  	]
  },
  	"text/x-vcalendar": {
  	source: "apache",
  	extensions: [
  		"vcs"
  	]
  },
  	"text/x-vcard": {
  	source: "apache",
  	extensions: [
  		"vcf"
  	]
  },
  	"text/xml": {
  	source: "iana",
  	compressible: true,
  	extensions: [
  		"xml"
  	]
  },
  	"text/xml-external-parsed-entity": {
  	source: "iana"
  },
  	"text/yaml": {
  	extensions: [
  		"yaml",
  		"yml"
  	]
  },
  	"video/1d-interleaved-parityfec": {
  	source: "iana"
  },
  	"video/3gpp": {
  	source: "iana",
  	extensions: [
  		"3gp",
  		"3gpp"
  	]
  },
  	"video/3gpp-tt": {
  	source: "iana"
  },
  	"video/3gpp2": {
  	source: "iana",
  	extensions: [
  		"3g2"
  	]
  },
  	"video/bmpeg": {
  	source: "iana"
  },
  	"video/bt656": {
  	source: "iana"
  },
  	"video/celb": {
  	source: "iana"
  },
  	"video/dv": {
  	source: "iana"
  },
  	"video/encaprtp": {
  	source: "iana"
  },
  	"video/h261": {
  	source: "iana",
  	extensions: [
  		"h261"
  	]
  },
  	"video/h263": {
  	source: "iana",
  	extensions: [
  		"h263"
  	]
  },
  	"video/h263-1998": {
  	source: "iana"
  },
  	"video/h263-2000": {
  	source: "iana"
  },
  	"video/h264": {
  	source: "iana",
  	extensions: [
  		"h264"
  	]
  },
  	"video/h264-rcdo": {
  	source: "iana"
  },
  	"video/h264-svc": {
  	source: "iana"
  },
  	"video/h265": {
  	source: "iana"
  },
  	"video/iso.segment": {
  	source: "iana"
  },
  	"video/jpeg": {
  	source: "iana",
  	extensions: [
  		"jpgv"
  	]
  },
  	"video/jpeg2000": {
  	source: "iana"
  },
  	"video/jpm": {
  	source: "apache",
  	extensions: [
  		"jpm",
  		"jpgm"
  	]
  },
  	"video/mj2": {
  	source: "iana",
  	extensions: [
  		"mj2",
  		"mjp2"
  	]
  },
  	"video/mp1s": {
  	source: "iana"
  },
  	"video/mp2p": {
  	source: "iana"
  },
  	"video/mp2t": {
  	source: "iana",
  	extensions: [
  		"ts"
  	]
  },
  	"video/mp4": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"mp4",
  		"mp4v",
  		"mpg4"
  	]
  },
  	"video/mp4v-es": {
  	source: "iana"
  },
  	"video/mpeg": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"mpeg",
  		"mpg",
  		"mpe",
  		"m1v",
  		"m2v"
  	]
  },
  	"video/mpeg4-generic": {
  	source: "iana"
  },
  	"video/mpv": {
  	source: "iana"
  },
  	"video/nv": {
  	source: "iana"
  },
  	"video/ogg": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"ogv"
  	]
  },
  	"video/parityfec": {
  	source: "iana"
  },
  	"video/pointer": {
  	source: "iana"
  },
  	"video/quicktime": {
  	source: "iana",
  	compressible: false,
  	extensions: [
  		"qt",
  		"mov"
  	]
  },
  	"video/raptorfec": {
  	source: "iana"
  },
  	"video/raw": {
  	source: "iana"
  },
  	"video/rtp-enc-aescm128": {
  	source: "iana"
  },
  	"video/rtploopback": {
  	source: "iana"
  },
  	"video/rtx": {
  	source: "iana"
  },
  	"video/smpte291": {
  	source: "iana"
  },
  	"video/smpte292m": {
  	source: "iana"
  },
  	"video/ulpfec": {
  	source: "iana"
  },
  	"video/vc1": {
  	source: "iana"
  },
  	"video/vc2": {
  	source: "iana"
  },
  	"video/vnd.cctv": {
  	source: "iana"
  },
  	"video/vnd.dece.hd": {
  	source: "iana",
  	extensions: [
  		"uvh",
  		"uvvh"
  	]
  },
  	"video/vnd.dece.mobile": {
  	source: "iana",
  	extensions: [
  		"uvm",
  		"uvvm"
  	]
  },
  	"video/vnd.dece.mp4": {
  	source: "iana"
  },
  	"video/vnd.dece.pd": {
  	source: "iana",
  	extensions: [
  		"uvp",
  		"uvvp"
  	]
  },
  	"video/vnd.dece.sd": {
  	source: "iana",
  	extensions: [
  		"uvs",
  		"uvvs"
  	]
  },
  	"video/vnd.dece.video": {
  	source: "iana",
  	extensions: [
  		"uvv",
  		"uvvv"
  	]
  },
  	"video/vnd.directv.mpeg": {
  	source: "iana"
  },
  	"video/vnd.directv.mpeg-tts": {
  	source: "iana"
  },
  	"video/vnd.dlna.mpeg-tts": {
  	source: "iana"
  },
  	"video/vnd.dvb.file": {
  	source: "iana",
  	extensions: [
  		"dvb"
  	]
  },
  	"video/vnd.fvt": {
  	source: "iana",
  	extensions: [
  		"fvt"
  	]
  },
  	"video/vnd.hns.video": {
  	source: "iana"
  },
  	"video/vnd.iptvforum.1dparityfec-1010": {
  	source: "iana"
  },
  	"video/vnd.iptvforum.1dparityfec-2005": {
  	source: "iana"
  },
  	"video/vnd.iptvforum.2dparityfec-1010": {
  	source: "iana"
  },
  	"video/vnd.iptvforum.2dparityfec-2005": {
  	source: "iana"
  },
  	"video/vnd.iptvforum.ttsavc": {
  	source: "iana"
  },
  	"video/vnd.iptvforum.ttsmpeg2": {
  	source: "iana"
  },
  	"video/vnd.motorola.video": {
  	source: "iana"
  },
  	"video/vnd.motorola.videop": {
  	source: "iana"
  },
  	"video/vnd.mpegurl": {
  	source: "iana",
  	extensions: [
  		"mxu",
  		"m4u"
  	]
  },
  	"video/vnd.ms-playready.media.pyv": {
  	source: "iana",
  	extensions: [
  		"pyv"
  	]
  },
  	"video/vnd.nokia.interleaved-multimedia": {
  	source: "iana"
  },
  	"video/vnd.nokia.mp4vr": {
  	source: "iana"
  },
  	"video/vnd.nokia.videovoip": {
  	source: "iana"
  },
  	"video/vnd.objectvideo": {
  	source: "iana"
  },
  	"video/vnd.radgamettools.bink": {
  	source: "iana"
  },
  	"video/vnd.radgamettools.smacker": {
  	source: "iana"
  },
  	"video/vnd.sealed.mpeg1": {
  	source: "iana"
  },
  	"video/vnd.sealed.mpeg4": {
  	source: "iana"
  },
  	"video/vnd.sealed.swf": {
  	source: "iana"
  },
  	"video/vnd.sealedmedia.softseal.mov": {
  	source: "iana"
  },
  	"video/vnd.uvvu.mp4": {
  	source: "iana",
  	extensions: [
  		"uvu",
  		"uvvu"
  	]
  },
  	"video/vnd.vivo": {
  	source: "iana",
  	extensions: [
  		"viv"
  	]
  },
  	"video/vp8": {
  	source: "iana"
  },
  	"video/webm": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"webm"
  	]
  },
  	"video/x-f4v": {
  	source: "apache",
  	extensions: [
  		"f4v"
  	]
  },
  	"video/x-fli": {
  	source: "apache",
  	extensions: [
  		"fli"
  	]
  },
  	"video/x-flv": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"flv"
  	]
  },
  	"video/x-m4v": {
  	source: "apache",
  	extensions: [
  		"m4v"
  	]
  },
  	"video/x-matroska": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"mkv",
  		"mk3d",
  		"mks"
  	]
  },
  	"video/x-mng": {
  	source: "apache",
  	extensions: [
  		"mng"
  	]
  },
  	"video/x-ms-asf": {
  	source: "apache",
  	extensions: [
  		"asf",
  		"asx"
  	]
  },
  	"video/x-ms-vob": {
  	source: "apache",
  	extensions: [
  		"vob"
  	]
  },
  	"video/x-ms-wm": {
  	source: "apache",
  	extensions: [
  		"wm"
  	]
  },
  	"video/x-ms-wmv": {
  	source: "apache",
  	compressible: false,
  	extensions: [
  		"wmv"
  	]
  },
  	"video/x-ms-wmx": {
  	source: "apache",
  	extensions: [
  		"wmx"
  	]
  },
  	"video/x-ms-wvx": {
  	source: "apache",
  	extensions: [
  		"wvx"
  	]
  },
  	"video/x-msvideo": {
  	source: "apache",
  	extensions: [
  		"avi"
  	]
  },
  	"video/x-sgi-movie": {
  	source: "apache",
  	extensions: [
  		"movie"
  	]
  },
  	"video/x-smv": {
  	source: "apache",
  	extensions: [
  		"smv"
  	]
  },
  	"x-conference/x-cooltalk": {
  	source: "apache",
  	extensions: [
  		"ice"
  	]
  },
  	"x-shader/x-fragment": {
  	compressible: true
  },
  	"x-shader/x-vertex": {
  	compressible: true
  }
  };

  var db$1 = /*#__PURE__*/Object.freeze({
    default: db
  });

  var require$$0 = getCjsExportFromNamespace(db$1);

  /*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * MIT Licensed
   */

  /**
   * Module exports.
   */

  var mimeDb = require$$0;

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  // resolves . and .. elements in a path array with directory names there
  // must be no slashes, empty elements, or device names (c:\) in the array
  // (so also no leading and trailing slashes - it does not distinguish
  // relative and absolute paths)
  function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..');
      }
    }

    return parts;
  }

  // Split a filename into [root, dir, basename, ext], unix version
  // 'root' is just a slash, or nothing.
  var splitPathRe =
      /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  var splitPath = function(filename) {
    return splitPathRe.exec(filename).slice(1);
  };

  // path.resolve([from ...], to)
  // posix version
  function resolve() {
    var resolvedPath = '',
        resolvedAbsolute = false;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? arguments[i] : '/';

      // Skip empty and invalid entries
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
      return !!p;
    }), !resolvedAbsolute).join('/');

    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
  }
  // path.normalize(path)
  // posix version
  function normalize(path) {
    var isPathAbsolute = isAbsolute(path),
        trailingSlash = substr(path, -1) === '/';

    // Normalize the path
    path = normalizeArray(filter(path.split('/'), function(p) {
      return !!p;
    }), !isPathAbsolute).join('/');

    if (!path && !isPathAbsolute) {
      path = '.';
    }
    if (path && trailingSlash) {
      path += '/';
    }

    return (isPathAbsolute ? '/' : '') + path;
  }
  // posix version
  function isAbsolute(path) {
    return path.charAt(0) === '/';
  }

  // posix version
  function join() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return normalize(filter(paths, function(p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings');
      }
      return p;
    }).join('/'));
  }


  // path.relative(from, to)
  // posix version
  function relative(from, to) {
    from = resolve(from).substr(1);
    to = resolve(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break;
      }

      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '') break;
      }

      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }

    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));

    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }

    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
  }

  var sep = '/';
  var delimiter = ':';

  function dirname(path) {
    var result = splitPath(path),
        root = result[0],
        dir = result[1];

    if (!root && !dir) {
      // No dirname whatsoever
      return '.';
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
  }

  function basename(path, ext) {
    var f = splitPath(path)[2];
    // TODO: make this comparison case-insensitive on windows?
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length);
    }
    return f;
  }


  function extname(path) {
    return splitPath(path)[3];
  }
  var require$$0$1 = {
    extname: extname,
    basename: basename,
    dirname: dirname,
    sep: sep,
    delimiter: delimiter,
    relative: relative,
    join: join,
    isAbsolute: isAbsolute,
    normalize: normalize,
    resolve: resolve
  };
  function filter (xs, f) {
      if (xs.filter) return xs.filter(f);
      var res = [];
      for (var i = 0; i < xs.length; i++) {
          if (f(xs[i], i, xs)) res.push(xs[i]);
      }
      return res;
  }

  // String.prototype.substr - negative index don't work in IE8
  var substr = 'ab'.substr(-1) === 'b' ?
      function (str, start, len) { return str.substr(start, len) } :
      function (str, start, len) {
          if (start < 0) start = str.length + start;
          return str.substr(start, len);
      }
  ;

  var mimeTypes = createCommonjsModule(function (module, exports) {

  /**
   * Module dependencies.
   * @private
   */


  var extname = require$$0$1.extname;

  /**
   * Module variables.
   * @private
   */

  var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
  var TEXT_TYPE_REGEXP = /^text\//i;

  /**
   * Module exports.
   * @public
   */

  exports.charset = charset;
  exports.charsets = { lookup: charset };
  exports.contentType = contentType;
  exports.extension = extension;
  exports.extensions = Object.create(null);
  exports.lookup = lookup;
  exports.types = Object.create(null);

  // Populate the extensions/types maps
  populateMaps(exports.extensions, exports.types);

  /**
   * Get the default charset for a MIME type.
   *
   * @param {string} type
   * @return {boolean|string}
   */

  function charset (type) {
    if (!type || typeof type !== 'string') {
      return false
    }

    // TODO: use media-typer
    var match = EXTRACT_TYPE_REGEXP.exec(type);
    var mime = match && mimeDb[match[1].toLowerCase()];

    if (mime && mime.charset) {
      return mime.charset
    }

    // default text/* to utf-8
    if (match && TEXT_TYPE_REGEXP.test(match[1])) {
      return 'UTF-8'
    }

    return false
  }

  /**
   * Create a full Content-Type header given a MIME type or extension.
   *
   * @param {string} str
   * @return {boolean|string}
   */

  function contentType (str) {
    // TODO: should this even be in this module?
    if (!str || typeof str !== 'string') {
      return false
    }

    var mime = str.indexOf('/') === -1
      ? exports.lookup(str)
      : str;

    if (!mime) {
      return false
    }

    // TODO: use content-type or other module
    if (mime.indexOf('charset') === -1) {
      var charset = exports.charset(mime);
      if (charset) mime += '; charset=' + charset.toLowerCase();
    }

    return mime
  }

  /**
   * Get the default extension for a MIME type.
   *
   * @param {string} type
   * @return {boolean|string}
   */

  function extension (type) {
    if (!type || typeof type !== 'string') {
      return false
    }

    // TODO: use media-typer
    var match = EXTRACT_TYPE_REGEXP.exec(type);

    // get extensions
    var exts = match && exports.extensions[match[1].toLowerCase()];

    if (!exts || !exts.length) {
      return false
    }

    return exts[0]
  }

  /**
   * Lookup the MIME type for a file path/extension.
   *
   * @param {string} path
   * @return {boolean|string}
   */

  function lookup (path) {
    if (!path || typeof path !== 'string') {
      return false
    }

    // get the extension ("ext" or ".ext" or full path)
    var extension = extname('x.' + path)
      .toLowerCase()
      .substr(1);

    if (!extension) {
      return false
    }

    return exports.types[extension] || false
  }

  /**
   * Populate the extensions and types maps.
   * @private
   */

  function populateMaps (extensions, types) {
    // source preference (least -> most)
    var preference = ['nginx', 'apache', undefined, 'iana'];

    Object.keys(mimeDb).forEach(function forEachMimeType (type) {
      var mime = mimeDb[type];
      var exts = mime.extensions;

      if (!exts || !exts.length) {
        return
      }

      // mime -> extensions
      extensions[type] = exts;

      // extension -> mime
      for (var i = 0; i < exts.length; i++) {
        var extension = exts[i];

        if (types[extension]) {
          var from = preference.indexOf(mimeDb[types[extension]].source);
          var to = preference.indexOf(mime.source);

          if (types[extension] !== 'application/octet-stream' &&
            (from > to || (from === to && types[extension].substr(0, 12) === 'application/'))) {
            // skip the remapping
            continue
          }
        }

        // set the extension -> mime
        types[extension] = type;
      }
    });
  }
  });
  var mimeTypes_1 = mimeTypes.charset;
  var mimeTypes_2 = mimeTypes.charsets;
  var mimeTypes_3 = mimeTypes.contentType;
  var mimeTypes_4 = mimeTypes.extension;
  var mimeTypes_5 = mimeTypes.extensions;
  var mimeTypes_6 = mimeTypes.lookup;
  var mimeTypes_7 = mimeTypes.types;

  var global$1 = (typeof global !== "undefined" ? global :
              typeof self !== "undefined" ? self :
              typeof window !== "undefined" ? window : {});

  var lookup = [];
  var revLookup = [];
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
  var inited = false;
  function init () {
    inited = true;
    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (var i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }

    revLookup['-'.charCodeAt(0)] = 62;
    revLookup['_'.charCodeAt(0)] = 63;
  }

  function toByteArray (b64) {
    if (!inited) {
      init();
    }
    var i, j, l, tmp, placeHolders, arr;
    var len = b64.length;

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(len * 3 / 4 - placeHolders);

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? len - 4 : len;

    var L = 0;

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
      arr[L++] = (tmp >> 16) & 0xFF;
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    if (placeHolders === 2) {
      tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
      arr[L++] = tmp & 0xFF;
    } else if (placeHolders === 1) {
      tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    return arr
  }

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
  }

  function encodeChunk (uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
      output.push(tripletToBase64(tmp));
    }
    return output.join('')
  }

  function fromByteArray (uint8) {
    if (!inited) {
      init();
    }
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    var output = '';
    var parts = [];
    var maxChunkLength = 16383; // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      output += lookup[tmp >> 2];
      output += lookup[(tmp << 4) & 0x3F];
      output += '==';
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
      output += lookup[tmp >> 10];
      output += lookup[(tmp >> 4) & 0x3F];
      output += lookup[(tmp << 2) & 0x3F];
      output += '=';
    }

    parts.push(output);

    return parts.join('')
  }

  function read (buffer, offset, isLE, mLen, nBytes) {
    var e, m;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var nBits = -7;
    var i = isLE ? (nBytes - 1) : 0;
    var d = isLE ? -1 : 1;
    var s = buffer[offset + i];

    i += d;

    e = s & ((1 << (-nBits)) - 1);
    s >>= (-nBits);
    nBits += eLen;
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1);
    e >>= (-nBits);
    nBits += mLen;
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias;
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen);
      e = e - eBias;
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  function write (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
    var i = isLE ? 0 : (nBytes - 1);
    var d = isLE ? 1 : -1;
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

    value = Math.abs(value);

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0;
      e = eMax;
    } else {
      e = Math.floor(Math.log(value) / Math.LN2);
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--;
        c *= 2;
      }
      if (e + eBias >= 1) {
        value += rt / c;
      } else {
        value += rt * Math.pow(2, 1 - eBias);
      }
      if (value * c >= 2) {
        e++;
        c /= 2;
      }

      if (e + eBias >= eMax) {
        m = 0;
        e = eMax;
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen);
        e = e + eBias;
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
        e = 0;
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = (e << mLen) | m;
    eLen += mLen;
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128;
  }

  var toString = {}.toString;

  var isArray = Array.isArray || function (arr) {
    return toString.call(arr) == '[object Array]';
  };

  var INSPECT_MAX_BYTES = 50;

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * Due to various browser bugs, sometimes the Object implementation will be used even
   * when the browser supports typed arrays.
   *
   * Note:
   *
   *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
   *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
   *
   *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
   *
   *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
   *     incorrect length in some situations.

   * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
   * get the Object implementation, which is slower but behaves correctly.
   */
  Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
    ? global$1.TYPED_ARRAY_SUPPORT
    : true;

  function kMaxLength () {
    return Buffer.TYPED_ARRAY_SUPPORT
      ? 0x7fffffff
      : 0x3fffffff
  }

  function createBuffer (that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length')
    }
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length);
      that.__proto__ = Buffer.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer(length);
      }
      that.length = length;
    }

    return that
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer (arg, encodingOrOffset, length) {
    if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
      return new Buffer(arg, encodingOrOffset, length)
    }

    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error(
          'If encoding is specified then the first argument must be a string'
        )
      }
      return allocUnsafe(this, arg)
    }
    return from(this, arg, encodingOrOffset, length)
  }

  Buffer.poolSize = 8192; // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer._augment = function (arr) {
    arr.__proto__ = Buffer.prototype;
    return arr
  };

  function from (that, value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number')
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return fromArrayBuffer(that, value, encodingOrOffset, length)
    }

    if (typeof value === 'string') {
      return fromString(that, value, encodingOrOffset)
    }

    return fromObject(that, value)
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length)
  };

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    Buffer.prototype.__proto__ = Uint8Array.prototype;
    Buffer.__proto__ = Uint8Array;
  }

  function assertSize (size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be a number')
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative')
    }
  }

  function alloc (that, size, fill, encoding) {
    assertSize(size);
    if (size <= 0) {
      return createBuffer(that, size)
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string'
        ? createBuffer(that, size).fill(fill, encoding)
        : createBuffer(that, size).fill(fill)
    }
    return createBuffer(that, size)
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding)
  };

  function allocUnsafe (that, size) {
    assertSize(size);
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
    if (!Buffer.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0;
      }
    }
    return that
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer.allocUnsafe = function (size) {
    return allocUnsafe(null, size)
  };
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size)
  };

  function fromString (that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8';
    }

    if (!Buffer.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding')
    }

    var length = byteLength(string, encoding) | 0;
    that = createBuffer(that, length);

    var actual = that.write(string, encoding);

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      that = that.slice(0, actual);
    }

    return that
  }

  function fromArrayLike (that, array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0;
    that = createBuffer(that, length);
    for (var i = 0; i < length; i += 1) {
      that[i] = array[i] & 255;
    }
    return that
  }

  function fromArrayBuffer (that, array, byteOffset, length) {
    array.byteLength; // this throws if `array` is not a valid ArrayBuffer

    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('\'offset\' is out of bounds')
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('\'length\' is out of bounds')
    }

    if (byteOffset === undefined && length === undefined) {
      array = new Uint8Array(array);
    } else if (length === undefined) {
      array = new Uint8Array(array, byteOffset);
    } else {
      array = new Uint8Array(array, byteOffset, length);
    }

    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array;
      that.__proto__ = Buffer.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      that = fromArrayLike(that, array);
    }
    return that
  }

  function fromObject (that, obj) {
    if (internalIsBuffer(obj)) {
      var len = checked(obj.length) | 0;
      that = createBuffer(that, len);

      if (that.length === 0) {
        return that
      }

      obj.copy(that, 0, 0, len);
      return that
    }

    if (obj) {
      if ((typeof ArrayBuffer !== 'undefined' &&
          obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
        if (typeof obj.length !== 'number' || isnan(obj.length)) {
          return createBuffer(that, 0)
        }
        return fromArrayLike(that, obj)
      }

      if (obj.type === 'Buffer' && isArray(obj.data)) {
        return fromArrayLike(that, obj.data)
      }
    }

    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
  }

  function checked (length) {
    // Note: cannot use `length < kMaxLength()` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= kMaxLength()) {
      throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                           'size: 0x' + kMaxLength().toString(16) + ' bytes')
    }
    return length | 0
  }
  Buffer.isBuffer = isBuffer;
  function internalIsBuffer (b) {
    return !!(b != null && b._isBuffer)
  }

  Buffer.compare = function compare (a, b) {
    if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
      throw new TypeError('Arguments must be Buffers')
    }

    if (a === b) return 0

    var x = a.length;
    var y = b.length;

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i];
        y = b[i];
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  };

  Buffer.isEncoding = function isEncoding (encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  };

  Buffer.concat = function concat (list, length) {
    if (!isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer.alloc(0)
    }

    var i;
    if (length === undefined) {
      length = 0;
      for (i = 0; i < list.length; ++i) {
        length += list[i].length;
      }
    }

    var buffer = Buffer.allocUnsafe(length);
    var pos = 0;
    for (i = 0; i < list.length; ++i) {
      var buf = list[i];
      if (!internalIsBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }
      buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer
  };

  function byteLength (string, encoding) {
    if (internalIsBuffer(string)) {
      return string.length
    }
    if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
        (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
      return string.byteLength
    }
    if (typeof string !== 'string') {
      string = '' + string;
    }

    var len = string.length;
    if (len === 0) return 0

    // Use a for loop to avoid recursion
    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2
        case 'hex':
          return len >>> 1
        case 'base64':
          return base64ToBytes(string).length
        default:
          if (loweredCase) return utf8ToBytes(string).length // assume utf8
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  }
  Buffer.byteLength = byteLength;

  function slowToString (encoding, start, end) {
    var loweredCase = false;

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0;
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return ''
    }

    if (end === undefined || end > this.length) {
      end = this.length;
    }

    if (end <= 0) {
      return ''
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0;
    start >>>= 0;

    if (end <= start) {
      return ''
    }

    if (!encoding) encoding = 'utf8';

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end)

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end)

        case 'ascii':
          return asciiSlice(this, start, end)

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end)

        case 'base64':
          return base64Slice(this, start, end)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = (encoding + '').toLowerCase();
          loweredCase = true;
      }
    }
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
  // Buffer instances.
  Buffer.prototype._isBuffer = true;

  function swap (b, n, m) {
    var i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  Buffer.prototype.swap16 = function swap16 () {
    var len = this.length;
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1);
    }
    return this
  };

  Buffer.prototype.swap32 = function swap32 () {
    var len = this.length;
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits')
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3);
      swap(this, i + 1, i + 2);
    }
    return this
  };

  Buffer.prototype.swap64 = function swap64 () {
    var len = this.length;
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits')
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7);
      swap(this, i + 1, i + 6);
      swap(this, i + 2, i + 5);
      swap(this, i + 3, i + 4);
    }
    return this
  };

  Buffer.prototype.toString = function toString () {
    var length = this.length | 0;
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  };

  Buffer.prototype.equals = function equals (b) {
    if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer.compare(this, b) === 0
  };

  Buffer.prototype.inspect = function inspect () {
    var str = '';
    var max = INSPECT_MAX_BYTES;
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
      if (this.length > max) str += ' ... ';
    }
    return '<Buffer ' + str + '>'
  };

  Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
    if (!internalIsBuffer(target)) {
      throw new TypeError('Argument must be a Buffer')
    }

    if (start === undefined) {
      start = 0;
    }
    if (end === undefined) {
      end = target ? target.length : 0;
    }
    if (thisStart === undefined) {
      thisStart = 0;
    }
    if (thisEnd === undefined) {
      thisEnd = this.length;
    }

    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      throw new RangeError('out of range index')
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0
    }
    if (thisStart >= thisEnd) {
      return -1
    }
    if (start >= end) {
      return 1
    }

    start >>>= 0;
    end >>>= 0;
    thisStart >>>= 0;
    thisEnd >>>= 0;

    if (this === target) return 0

    var x = thisEnd - thisStart;
    var y = end - start;
    var len = Math.min(x, y);

    var thisCopy = this.slice(thisStart, thisEnd);
    var targetCopy = target.slice(start, end);

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i];
        y = targetCopy[i];
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  };

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = 0;
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff;
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000;
    }
    byteOffset = +byteOffset;  // Coerce to Number.
    if (isNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : (buffer.length - 1);
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
    if (byteOffset >= buffer.length) {
      if (dir) return -1
      else byteOffset = buffer.length - 1;
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0;
      else return -1
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer.from(val, encoding);
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (internalIsBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    } else if (typeof val === 'number') {
      val = val & 0xFF; // Search for a byte value [0-255]
      if (Buffer.TYPED_ARRAY_SUPPORT &&
          typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
        }
      }
      return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
    }

    throw new TypeError('val must be string, number or Buffer')
  }

  function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
    var indexSize = 1;
    var arrLength = arr.length;
    var valLength = val.length;

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase();
      if (encoding === 'ucs2' || encoding === 'ucs-2' ||
          encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1
        }
        indexSize = 2;
        arrLength /= 2;
        valLength /= 2;
        byteOffset /= 2;
      }
    }

    function read$$1 (buf, i) {
      if (indexSize === 1) {
        return buf[i]
      } else {
        return buf.readUInt16BE(i * indexSize)
      }
    }

    var i;
    if (dir) {
      var foundIndex = -1;
      for (i = byteOffset; i < arrLength; i++) {
        if (read$$1(arr, i) === read$$1(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i;
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
        } else {
          if (foundIndex !== -1) i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
      for (i = byteOffset; i >= 0; i--) {
        var found = true;
        for (var j = 0; j < valLength; j++) {
          if (read$$1(arr, i + j) !== read$$1(val, j)) {
            found = false;
            break
          }
        }
        if (found) return i
      }
    }

    return -1
  }

  Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  };

  Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  };

  Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
  };

  function hexWrite (buf, string, offset, length) {
    offset = Number(offset) || 0;
    var remaining = buf.length - offset;
    if (!length) {
      length = remaining;
    } else {
      length = Number(length);
      if (length > remaining) {
        length = remaining;
      }
    }

    // must be an even number of digits
    var strLen = string.length;
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2;
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16);
      if (isNaN(parsed)) return i
      buf[offset + i] = parsed;
    }
    return i
  }

  function utf8Write (buf, string, offset, length) {
    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  }

  function asciiWrite (buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length)
  }

  function latin1Write (buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length)
  }

  function base64Write (buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length)
  }

  function ucs2Write (buf, string, offset, length) {
    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
  }

  Buffer.prototype.write = function write$$1 (string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8';
      length = this.length;
      offset = 0;
    // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
    // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset | 0;
      if (isFinite(length)) {
        length = length | 0;
        if (encoding === undefined) encoding = 'utf8';
      } else {
        encoding = length;
        length = undefined;
      }
    // legacy write(string, encoding, offset, length) - remove in v0.13
    } else {
      throw new Error(
        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      )
    }

    var remaining = this.length - offset;
    if (length === undefined || length > remaining) length = remaining;

    if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds')
    }

    if (!encoding) encoding = 'utf8';

    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length)

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length)

        case 'ascii':
          return asciiWrite(this, string, offset, length)

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length)

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  };

  Buffer.prototype.toJSON = function toJSON () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  };

  function base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return fromByteArray(buf)
    } else {
      return fromByteArray(buf.slice(start, end))
    }
  }

  function utf8Slice (buf, start, end) {
    end = Math.min(buf.length, end);
    var res = [];

    var i = start;
    while (i < end) {
      var firstByte = buf[i];
      var codePoint = null;
      var bytesPerSequence = (firstByte > 0xEF) ? 4
        : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
        : 1;

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint;

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte;
            }
            break
          case 2:
            secondByte = buf[i + 1];
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint;
              }
            }
            break
          case 3:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint;
              }
            }
            break
          case 4:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            fourthByte = buf[i + 3];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint;
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD;
        bytesPerSequence = 1;
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000;
        res.push(codePoint >>> 10 & 0x3FF | 0xD800);
        codePoint = 0xDC00 | codePoint & 0x3FF;
      }

      res.push(codePoint);
      i += bytesPerSequence;
    }

    return decodeCodePointsArray(res)
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000;

  function decodeCodePointsArray (codePoints) {
    var len = codePoints.length;
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = '';
    var i = 0;
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
      );
    }
    return res
  }

  function asciiSlice (buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7F);
    }
    return ret
  }

  function latin1Slice (buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i]);
    }
    return ret
  }

  function hexSlice (buf, start, end) {
    var len = buf.length;

    if (!start || start < 0) start = 0;
    if (!end || end < 0 || end > len) end = len;

    var out = '';
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i]);
    }
    return out
  }

  function utf16leSlice (buf, start, end) {
    var bytes = buf.slice(start, end);
    var res = '';
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
    }
    return res
  }

  Buffer.prototype.slice = function slice (start, end) {
    var len = this.length;
    start = ~~start;
    end = end === undefined ? len : ~~end;

    if (start < 0) {
      start += len;
      if (start < 0) start = 0;
    } else if (start > len) {
      start = len;
    }

    if (end < 0) {
      end += len;
      if (end < 0) end = 0;
    } else if (end > len) {
      end = len;
    }

    if (end < start) end = start;

    var newBuf;
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end);
      newBuf.__proto__ = Buffer.prototype;
    } else {
      var sliceLen = end - start;
      newBuf = new Buffer(sliceLen, undefined);
      for (var i = 0; i < sliceLen; ++i) {
        newBuf[i] = this[i + start];
      }
    }

    return newBuf
  };

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset (offset, ext, length) {
    if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
  }

  Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }

    return val
  };

  Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length);
    }

    var val = this[offset + --byteLength];
    var mul = 1;
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul;
    }

    return val
  };

  Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    return this[offset]
  };

  Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return this[offset] | (this[offset + 1] << 8)
  };

  Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return (this[offset] << 8) | this[offset + 1]
  };

  Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return ((this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16)) +
        (this[offset + 3] * 0x1000000)
  };

  Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
  };

  Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val
  };

  Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var i = byteLength;
    var mul = 1;
    var val = this[offset + --i];
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val
  };

  Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    if (!(this[offset] & 0x80)) return (this[offset])
    return ((0xff - this[offset] + 1) * -1)
  };

  Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset] | (this[offset + 1] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset + 1] | (this[offset] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
  };

  Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
  };

  Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4)
  };

  Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4)
  };

  Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8)
  };

  Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8)
  };

  function checkInt (buf, value, offset, ext, max, min) {
    if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var mul = 1;
    var i = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var i = byteLength - 1;
    var mul = 1;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    this[offset] = (value & 0xff);
    return offset + 1
  };

  function objectWriteUInt16 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
      buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
        (littleEndian ? i : 1 - i) * 8;
    }
  }

  Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  function objectWriteUInt32 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffffffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
      buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
    }
  }

  Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = (value >>> 24);
      this[offset + 2] = (value >>> 16);
      this[offset + 1] = (value >>> 8);
      this[offset] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = 0;
    var mul = 1;
    var sub = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = byteLength - 1;
    var mul = 1;
    var sub = 0;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
    }

    return offset + byteLength
  };

  Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    if (value < 0) value = 0xff + value + 1;
    this[offset] = (value & 0xff);
    return offset + 1
  };

  Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
      this[offset + 2] = (value >>> 16);
      this[offset + 3] = (value >>> 24);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (value < 0) value = 0xffffffff + value + 1;
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  function checkIEEE754 (buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
    if (offset < 0) throw new RangeError('Index out of range')
  }

  function writeFloat (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
    }
    write(buf, value, offset, littleEndian, 23, 4);
    return offset + 4
  }

  Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert)
  };

  Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert)
  };

  function writeDouble (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
    }
    write(buf, value, offset, littleEndian, 52, 8);
    return offset + 8
  }

  Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert)
  };

  Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert)
  };

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer.prototype.copy = function copy (target, targetStart, start, end) {
    if (!start) start = 0;
    if (!end && end !== 0) end = this.length;
    if (targetStart >= target.length) targetStart = target.length;
    if (!targetStart) targetStart = 0;
    if (end > 0 && end < start) end = start;

    // Copy 0 bytes; we're done
    if (end === start) return 0
    if (target.length === 0 || this.length === 0) return 0

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds')
    }
    if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
    if (end < 0) throw new RangeError('sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length) end = this.length;
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start;
    }

    var len = end - start;
    var i;

    if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start];
      }
    } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
      // ascending copy from start
      for (i = 0; i < len; ++i) {
        target[i + targetStart] = this[i + start];
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, start + len),
        targetStart
      );
    }

    return len
  };

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer.prototype.fill = function fill (val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start;
        start = 0;
        end = this.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = this.length;
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0);
        if (code < 256) {
          val = code;
        }
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string')
      }
      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding)
      }
    } else if (typeof val === 'number') {
      val = val & 255;
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index')
    }

    if (end <= start) {
      return this
    }

    start = start >>> 0;
    end = end === undefined ? this.length : end >>> 0;

    if (!val) val = 0;

    var i;
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val;
      }
    } else {
      var bytes = internalIsBuffer(val)
        ? val
        : utf8ToBytes(new Buffer(val, encoding).toString());
      var len = bytes.length;
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len];
      }
    }

    return this
  };

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

  function base64clean (str) {
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = stringtrim(str).replace(INVALID_BASE64_RE, '');
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return ''
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '=';
    }
    return str
  }

  function stringtrim (str) {
    if (str.trim) return str.trim()
    return str.replace(/^\s+|\s+$/g, '')
  }

  function toHex (n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes (string, units) {
    units = units || Infinity;
    var codePoint;
    var length = string.length;
    var leadSurrogate = null;
    var bytes = [];

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);

      // is surrogate component
      if (codePoint > 0xD7FF && codePoint < 0xE000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xDBFF) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue
          }

          // valid lead
          leadSurrogate = codePoint;

          continue
        }

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          leadSurrogate = codePoint;
          continue
        }

        // valid surrogate pair
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      }

      leadSurrogate = null;

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break
        bytes.push(
          codePoint >> 0x6 | 0xC0,
          codePoint & 0x3F | 0x80
        );
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break
        bytes.push(
          codePoint >> 0xC | 0xE0,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        );
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break
        bytes.push(
          codePoint >> 0x12 | 0xF0,
          codePoint >> 0xC & 0x3F | 0x80,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        );
      } else {
        throw new Error('Invalid code point')
      }
    }

    return bytes
  }

  function asciiToBytes (str) {
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF);
    }
    return byteArray
  }

  function utf16leToBytes (str, units) {
    var c, hi, lo;
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break

      c = str.charCodeAt(i);
      hi = c >> 8;
      lo = c % 256;
      byteArray.push(lo);
      byteArray.push(hi);
    }

    return byteArray
  }


  function base64ToBytes (str) {
    return toByteArray(base64clean(str))
  }

  function blitBuffer (src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if ((i + offset >= dst.length) || (i >= src.length)) break
      dst[i + offset] = src[i];
    }
    return i
  }

  function isnan (val) {
    return val !== val // eslint-disable-line no-self-compare
  }


  // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
  // The _isBuffer check is for Safari 5-7 support, because it's missing
  // Object.prototype.constructor. Remove this eventually
  function isBuffer(obj) {
    return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
  }

  function isFastBuffer (obj) {
    return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
  }

  // For Node v0.10 support. Remove this eventually.
  function isSlowBuffer (obj) {
    return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
  }

  var util = createCommonjsModule(function (module) {
  var u = module.exports;

  // utility functions

  var FNAME = '__name__';

  u.namedfunc = function(name, f) { return (f[FNAME] = name, f); };

  u.name = function(f) { return f==null ? null : f[FNAME]; };

  u.identity = function(x) { return x; };

  u.true = u.namedfunc('true', function() { return true; });

  u.false = u.namedfunc('false', function() { return false; });

  u.duplicate = function(obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  u.equal = function(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  };

  u.extend = function(obj) {
    for (var x, name, i=1, len=arguments.length; i<len; ++i) {
      x = arguments[i];
      for (name in x) { obj[name] = x[name]; }
    }
    return obj;
  };

  u.length = function(x) {
    return x != null && x.length != null ? x.length : null;
  };

  u.keys = function(x) {
    var keys = [], k;
    for (k in x) keys.push(k);
    return keys;
  };

  u.vals = function(x) {
    var vals = [], k;
    for (k in x) vals.push(x[k]);
    return vals;
  };

  u.toMap = function(list, f) {
    return (f = u.$(f)) ?
      list.reduce(function(obj, x) { return (obj[f(x)] = 1, obj); }, {}) :
      list.reduce(function(obj, x) { return (obj[x] = 1, obj); }, {});
  };

  u.keystr = function(values) {
    // use to ensure consistent key generation across modules
    var n = values.length;
    if (!n) return '';
    for (var s=String(values[0]), i=1; i<n; ++i) {
      s += '|' + String(values[i]);
    }
    return s;
  };

  // type checking functions

  var toString = Object.prototype.toString;

  u.isObject = function(obj) {
    return obj === Object(obj);
  };

  u.isFunction = function(obj) {
    return toString.call(obj) === '[object Function]';
  };

  u.isString = function(obj) {
    return typeof value === 'string' || toString.call(obj) === '[object String]';
  };

  u.isArray = Array.isArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  u.isNumber = function(obj) {
    return typeof obj === 'number' || toString.call(obj) === '[object Number]';
  };

  u.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  u.isDate = function(obj) {
    return toString.call(obj) === '[object Date]';
  };

  u.isValid = function(obj) {
    return obj != null && obj === obj;
  };

  u.isBuffer = (typeof Buffer === 'function' && isBuffer) || u.false;

  // type coercion functions

  u.number = function(s) {
    return s == null || s === '' ? null : +s;
  };

  u.boolean = function(s) {
    return s == null || s === '' ? null : s==='false' ? false : !!s;
  };

  // parse a date with optional d3.time-format format
  u.date = function(s, format) {
    var d = format ? format : Date;
    return s == null || s === '' ? null : d.parse(s);
  };

  u.array = function(x) {
    return x != null ? (u.isArray(x) ? x : [x]) : [];
  };

  u.str = function(x) {
    return u.isArray(x) ? '[' + x.map(u.str) + ']'
      : u.isObject(x) || u.isString(x) ?
        // Output valid JSON and JS source strings.
        // See http://timelessrepo.com/json-isnt-a-javascript-subset
        JSON.stringify(x).replace('\u2028','\\u2028').replace('\u2029', '\\u2029')
      : x;
  };

  // data access functions

  var field_re = /\[(.*?)\]|[^.\[]+/g;

  u.field = function(f) {
    return String(f).match(field_re).map(function(d) {
      return d[0] !== '[' ? d :
        d[1] !== "'" && d[1] !== '"' ? d.slice(1, -1) :
        d.slice(2, -2).replace(/\\(["'])/g, '$1');
    });
  };

  u.accessor = function(f) {
    /* jshint evil: true */
    return f==null || u.isFunction(f) ? f :
      u.namedfunc(f, Function('x', 'return x[' + u.field(f).map(u.str).join('][') + '];'));
  };

  // short-cut for accessor
  u.$ = u.accessor;

  u.mutator = function(f) {
    var s;
    return u.isString(f) && (s=u.field(f)).length > 1 ?
      function(x, v) {
        for (var i=0; i<s.length-1; ++i) x = x[s[i]];
        x[s[i]] = v;
      } :
      function(x, v) { x[f] = v; };
  };


  u.$func = function(name, op) {
    return function(f) {
      f = u.$(f) || u.identity;
      var n = name + (u.name(f) ? '_'+u.name(f) : '');
      return u.namedfunc(n, function(d) { return op(f(d)); });
    };
  };

  u.$valid  = u.$func('valid', u.isValid);
  u.$length = u.$func('length', u.length);

  u.$in = function(f, values) {
    f = u.$(f);
    var map = u.isArray(values) ? u.toMap(values) : values;
    return function(d) { return !!map[f(d)]; };
  };

  // comparison / sorting functions

  u.comparator = function(sort) {
    var sign = [];
    if (sort === undefined) sort = [];
    sort = u.array(sort).map(function(f) {
      var s = 1;
      if      (f[0] === '-') { s = -1; f = f.slice(1); }
      else if (f[0] === '+') { s = +1; f = f.slice(1); }
      sign.push(s);
      return u.accessor(f);
    });
    return function(a, b) {
      var i, n, f, c;
      for (i=0, n=sort.length; i<n; ++i) {
        f = sort[i];
        c = u.cmp(f(a), f(b));
        if (c) return c * sign[i];
      }
      return 0;
    };
  };

  u.cmp = function(a, b) {
    return (a < b || a == null) && b != null ? -1 :
      (a > b || b == null) && a != null ? 1 :
      ((b = b instanceof Date ? +b : b),
       (a = a instanceof Date ? +a : a)) !== a && b === b ? -1 :
      b !== b && a === a ? 1 : 0;
  };

  u.numcmp = function(a, b) { return a - b; };

  u.stablesort = function(array, sortBy, keyFn) {
    var indices = array.reduce(function(idx, v, i) {
      return (idx[keyFn(v)] = i, idx);
    }, {});

    array.sort(function(a, b) {
      var sa = sortBy(a),
          sb = sortBy(b);
      return sa < sb ? -1 : sa > sb ? 1
           : (indices[keyFn(a)] - indices[keyFn(b)]);
    });

    return array;
  };

  // permutes an array using a Knuth shuffle
  u.permute = function(a) {
    var m = a.length,
        swap,
        i;

    while (m) {
      i = Math.floor(Math.random() * m--);
      swap = a[m];
      a[m] = a[i];
      a[i] = swap;
    }
  };

  // string functions

  u.pad = function(s, length, pos, padchar) {
    padchar = padchar || " ";
    var d = length - s.length;
    if (d <= 0) return s;
    switch (pos) {
      case 'left':
        return strrep(d, padchar) + s;
      case 'middle':
      case 'center':
        return strrep(Math.floor(d/2), padchar) +
           s + strrep(Math.ceil(d/2), padchar);
      default:
        return s + strrep(d, padchar);
    }
  };

  function strrep(n, str) {
    var s = "", i;
    for (i=0; i<n; ++i) s += str;
    return s;
  }

  u.truncate = function(s, length, pos, word, ellipsis) {
    var len = s.length;
    if (len <= length) return s;
    ellipsis = ellipsis !== undefined ? String(ellipsis) : '\u2026';
    var l = Math.max(0, length - ellipsis.length);

    switch (pos) {
      case 'left':
        return ellipsis + (word ? truncateOnWord(s,l,1) : s.slice(len-l));
      case 'middle':
      case 'center':
        var l1 = Math.ceil(l/2), l2 = Math.floor(l/2);
        return (word ? truncateOnWord(s,l1) : s.slice(0,l1)) +
          ellipsis + (word ? truncateOnWord(s,l2,1) : s.slice(len-l2));
      default:
        return (word ? truncateOnWord(s,l) : s.slice(0,l)) + ellipsis;
    }
  };

  function truncateOnWord(s, len, rev) {
    var cnt = 0, tok = s.split(truncate_word_re);
    if (rev) {
      s = (tok = tok.reverse())
        .filter(function(w) { cnt += w.length; return cnt <= len; })
        .reverse();
    } else {
      s = tok.filter(function(w) { cnt += w.length; return cnt <= len; });
    }
    return s.length ? s.join('').trim() : tok[0].slice(0, len);
  }

  var truncate_word_re = /([\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF])/;
  });

  var _args = [
  	[
  		"datalib@1.9.1",
  		"/media/data/Repositories/origraph.js"
  	]
  ];
  var _from = "datalib@1.9.1";
  var _id = "datalib@1.9.1";
  var _inBundle = false;
  var _integrity = "sha512-E1F/V6LkSw2RZ3A7g/uiVPRD5oE5NjWXgZLU0aBmgIWbGLvYdsgrODfYJJmFcZE1bWr9SOO1UzfJ9pj+g+t2ng==";
  var _location = "/datalib";
  var _phantomChildren = {
  };
  var _requested = {
  	type: "version",
  	registry: true,
  	raw: "datalib@1.9.1",
  	name: "datalib",
  	escapedName: "datalib",
  	rawSpec: "1.9.1",
  	saveSpec: null,
  	fetchSpec: "1.9.1"
  };
  var _requiredBy = [
  	"/"
  ];
  var _resolved = "https://registry.npmjs.org/datalib/-/datalib-1.9.1.tgz";
  var _spec = "1.9.1";
  var _where = "/media/data/Repositories/origraph.js";
  var author = {
  	name: "Jeffrey Heer",
  	url: "http://idl.cs.washington.edu"
  };
  var browser = {
  	buffer: false,
  	fs: false,
  	http: false,
  	request: false,
  	"sync-request": false,
  	url: false
  };
  var bugs = {
  	url: "https://github.com/vega/datalib/issues"
  };
  var contributors = [
  	{
  		name: "Michael Correll",
  		url: "http://pages.cs.wisc.edu/~mcorrell/"
  	},
  	{
  		name: "Ryan Russell",
  		url: "https://github.com/RussellSprouts"
  	}
  ];
  var dependencies = {
  	"d3-dsv": "0.1",
  	"d3-format": "0.4",
  	"d3-time": "0.1",
  	"d3-time-format": "0.2",
  	request: "^2.67.0",
  	"sync-request": "^2.1.0",
  	"topojson-client": "^3.0.0"
  };
  var description = "JavaScript utilites for loading, summarizing and working with data.";
  var devDependencies = {
  	chai: "^4.1.2",
  	istanbul: "latest",
  	jshint: "^2.9.5",
  	mocha: "^5.2.0",
  	rollup: "^0.62.0",
  	"rollup-plugin-commonjs": "^9.1.3",
  	"rollup-plugin-json": "^3.0.0",
  	"rollup-plugin-node-resolve": "^3.3.0",
  	"uglify-js": "^3.4.3"
  };
  var homepage = "https://github.com/vega/datalib#readme";
  var jsdelivr = "datalib.min.js";
  var keywords = [
  	"data",
  	"table",
  	"statistics",
  	"parse",
  	"csv",
  	"tsv",
  	"json",
  	"utility"
  ];
  var license = "BSD-3-Clause";
  var main = "src/index.js";
  var name = "datalib";
  var repository = {
  	type: "git",
  	url: "git+ssh://git@github.com/vega/datalib.git"
  };
  var scripts = {
  	build: "rollup -c",
  	cover: "TZ=America/Los_Angeles istanbul cover _mocha -- --recursive test/",
  	deploy: "npm run test && scripts/deploy.sh",
  	lint: "jshint src/",
  	postbuild: "uglifyjs datalib.js -c -m -o datalib.min.js",
  	test: "npm run lint && TZ=America/Los_Angeles mocha --recursive test/"
  };
  var unpkg = "datalib.min.js";
  var version = "1.9.1";
  var _package = {
  	_args: _args,
  	_from: _from,
  	_id: _id,
  	_inBundle: _inBundle,
  	_integrity: _integrity,
  	_location: _location,
  	_phantomChildren: _phantomChildren,
  	_requested: _requested,
  	_requiredBy: _requiredBy,
  	_resolved: _resolved,
  	_spec: _spec,
  	_where: _where,
  	author: author,
  	browser: browser,
  	bugs: bugs,
  	contributors: contributors,
  	dependencies: dependencies,
  	description: description,
  	devDependencies: devDependencies,
  	homepage: homepage,
  	jsdelivr: jsdelivr,
  	keywords: keywords,
  	license: license,
  	main: main,
  	name: name,
  	repository: repository,
  	scripts: scripts,
  	unpkg: unpkg,
  	version: version
  };

  var _package$1 = /*#__PURE__*/Object.freeze({
    _args: _args,
    _from: _from,
    _id: _id,
    _inBundle: _inBundle,
    _integrity: _integrity,
    _location: _location,
    _phantomChildren: _phantomChildren,
    _requested: _requested,
    _requiredBy: _requiredBy,
    _resolved: _resolved,
    _spec: _spec,
    _where: _where,
    author: author,
    browser: browser,
    bugs: bugs,
    contributors: contributors,
    dependencies: dependencies,
    description: description,
    devDependencies: devDependencies,
    homepage: homepage,
    jsdelivr: jsdelivr,
    keywords: keywords,
    license: license,
    main: main,
    name: name,
    repository: repository,
    scripts: scripts,
    unpkg: unpkg,
    version: version,
    default: _package
  });

  var require$$3 = {};

  // Matches absolute URLs with optional protocol
  //   https://...    file://...    //...
  var protocol_re = /^([A-Za-z]+:)?\/\//;

  // Special treatment in node.js for the file: protocol
  var fileProtocol = 'file://';

  // Validate and cleanup URL to ensure that it is allowed to be accessed
  // Returns cleaned up URL, or false if access is not allowed
  function sanitizeUrl(opt) {
    var url = opt.url;
    if (!url && opt.file) { return fileProtocol + opt.file; }

    // In case this is a relative url (has no host), prepend opt.baseURL
    if (opt.baseURL && !protocol_re.test(url)) {
      if (!startsWith(url, '/') && opt.baseURL[opt.baseURL.length-1] !== '/') {
        url = '/' + url; // Ensure that there is a slash between the baseURL (e.g. hostname) and url
      }
      url = opt.baseURL + url;
    }
    // relative protocol, starts with '//'
    if (!load.useXHR && startsWith(url, '//')) {
      url = (opt.defaultProtocol || 'http') + ':' + url;
    }
    // If opt.domainWhiteList is set, only allows url, whose hostname
    // * Is the same as the origin (window.location.hostname)
    // * Equals one of the values in the whitelist
    // * Is a proper subdomain of one of the values in the whitelist
    if (opt.domainWhiteList) {
      var domain, origin;
      if (load.useXHR) {
        var a = document.createElement('a');
        a.href = url;
        // From http://stackoverflow.com/questions/736513/how-do-i-parse-a-url-into-hostname-and-path-in-javascript
        // IE doesn't populate all link properties when setting .href with a relative URL,
        // however .href will return an absolute URL which then can be used on itself
        // to populate these additional fields.
        if (a.host === '') {
          a.href = a.href;
        }
        domain = a.hostname.toLowerCase();
        origin = window.location.hostname;
      } else {
        // relative protocol is broken: https://github.com/defunctzombie/node-url/issues/5
        var parts = require$$3.parse(url);
        domain = parts.hostname;
        origin = null;
      }

      if (origin !== domain) {
        var whiteListed = opt.domainWhiteList.some(function(d) {
          var idx = domain.length - d.length;
          return d === domain ||
            (idx > 1 && domain[idx-1] === '.' && domain.lastIndexOf(d) === idx);
        });
        if (!whiteListed) {
          throw 'URL is not whitelisted: ' + url;
        }
      }
    }
    return url;
  }

  function load(opt, callback) {
    return load.loader(opt, callback);
  }

  function loader(opt, callback) {
    var error = callback || function(e) { throw e; }, url;

    try {
      url = load.sanitizeUrl(opt); // enable override
    } catch (err) {
      error(err);
      return;
    }

    if (!url) {
      error('Invalid URL: ' + opt.url);
    } else if (load.useXHR) {
      // on client, use xhr
      return load.xhr(url, opt, callback);
    } else if (startsWith(url, fileProtocol)) {
      // on server, if url starts with 'file://', strip it and load from file
      return load.file(url.slice(fileProtocol.length), opt, callback);
    } else if (url.indexOf('://') < 0) { // TODO better protocol check?
      // on server, if no protocol assume file
      return load.file(url, opt, callback);
    } else {
      // for regular URLs on server
      return load.http(url, opt, callback);
    }
  }

  function xhrHasResponse(request) {
    var type = request.responseType;
    return type && type !== 'text' ?
      request.response : // null on error
      request.responseText; // '' on error
  }

  function xhr(url, opt, callback) {
    var async = !!callback;
    var request = new XMLHttpRequest();
    // If IE does not support CORS, use XDomainRequest (copied from d3.xhr)
    if (typeof XDomainRequest !== 'undefined' &&
        !('withCredentials' in request) &&
        /^(http(s)?:)?\/\//.test(url)) request = new XDomainRequest();

    function respond() {
      var status = request.status;
      if (!status && xhrHasResponse(request) || status >= 200 && status < 300 || status === 304) {
        callback(null, request.responseText);
      } else {
        callback(request, null);
      }
    }

    if (async) {
      if ('onload' in request) {
        request.onload = request.onerror = respond;
      } else {
        request.onreadystatechange = function() {
          if (request.readyState > 3) respond();
        };
      }
    }

    request.open('GET', url, async);
    /* istanbul ignore else */
    if (request.setRequestHeader) {
      var headers = util.extend({}, load.headers, opt.headers);
      for (var name in headers) {
        request.setRequestHeader(name, headers[name]);
      }
    }
    request.send();

    if (!async && xhrHasResponse(request)) {
      return request.responseText;
    }
  }

  function file(filename, opt, callback) {
    var fs = require$$3;
    if (!callback) {
      return fs.readFileSync(filename, 'utf8');
    }
    fs.readFile(filename, callback);
  }

  function http(url, opt, callback) {
    var headers = util.extend({}, load.headers, opt.headers);

    var options = {url: url, encoding: null, gzip: true, headers: headers};
    if (!callback) {
      return require$$3('GET', url, options).getBody();
    }
    require$$3(options, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        callback(null, body);
      } else {
        error = error ||
          'Load failed with response code ' + response.statusCode + '.';
        callback(error, null);
      }
    });
  }

  function startsWith(string, searchString) {
    return string == null ? false : string.lastIndexOf(searchString, 0) === 0;
  }

  // Allow these functions to be overriden by the user of the library
  load.loader = loader;
  load.sanitizeUrl = sanitizeUrl;
  load.xhr = xhr;
  load.file = file;
  load.http = http;

  // Default settings
  load.useXHR = (typeof XMLHttpRequest !== 'undefined');
  load.headers = {};

  var load_1 = load;

  var TYPES = '__types__';

  var PARSERS = {
    boolean: util.boolean,
    integer: util.number,
    number:  util.number,
    date:    util.date,
    string:  function(x) { return x == null || x === '' ? null : x + ''; }
  };

  var TESTS = {
    boolean: function(x) { return x==='true' || x==='false' || util.isBoolean(x); },
    integer: function(x) { return TESTS.number(x) && (x=+x) === ~~x; },
    number: function(x) { return !isNaN(+x) && !util.isDate(x); },
    date: function(x) { return !isNaN(Date.parse(x)); }
  };

  function annotation(data, types) {
    if (!types) return data && data[TYPES] || null;
    data[TYPES] = types;
  }

  function fieldNames(datum) {
    return util.keys(datum);
  }

  function bracket(fieldName) {
    return '[' + fieldName + ']';
  }

  function type(values, f) {
    values = util.array(values);
    f = util.$(f);
    var v, i, n;

    // if data array has type annotations, use them
    if (values[TYPES]) {
      v = f(values[TYPES]);
      if (util.isString(v)) return v;
    }

    for (i=0, n=values.length; !util.isValid(v) && i<n; ++i) {
      v = f ? f(values[i]) : values[i];
    }

    return util.isDate(v) ? 'date' :
      util.isNumber(v)    ? 'number' :
      util.isBoolean(v)   ? 'boolean' :
      util.isString(v)    ? 'string' : null;
  }

  function typeAll(data, fields) {
    if (!data.length) return;
    var get = fields ? util.identity : (fields = fieldNames(data[0]), bracket);
    return fields.reduce(function(types, f) {
      return (types[f] = type(data, get(f)), types);
    }, {});
  }

  function infer(values, f, ignore) {
    values = util.array(values);
    f = util.$(f);
    var i, j, v;

    // types to test for, in precedence order
    var types = ['boolean', 'integer', 'number', 'date'];

    for (i=0; i<values.length; ++i) {
      // get next value to test
      v = f ? f(values[i]) : values[i];
      // test value against remaining types
      for (j=0; j<types.length; ++j) {
        if ((!ignore || !ignore.test(v)) && util.isValid(v) && !TESTS[types[j]](v)) {
          types.splice(j, 1);
          j -= 1;
        }
      }
      // if no types left, return 'string'
      if (types.length === 0) return 'string';
    }

    return types[0];
  }

  function inferAll(data, fields, ignore) {
    var get = fields ? util.identity : (fields = fieldNames(data[0]), bracket);
    return fields.reduce(function(types, f) {
      types[f] = infer(data, get(f), ignore);
      return types;
    }, {});
  }

  type.annotation = annotation;
  type.all = typeAll;
  type.infer = infer;
  type.inferAll = inferAll;
  type.parsers = PARSERS;
  var type_1 = type;

  var d3Dsv = createCommonjsModule(function (module, exports) {
  (function (global, factory) {
    factory(exports);
  }(commonjsGlobal, function (exports) {
    function dsv(delimiter) {
      return new Dsv(delimiter);
    }

    function objectConverter(columns) {
      return new Function("d", "return {" + columns.map(function(name, i) {
        return JSON.stringify(name) + ": d[" + i + "]";
      }).join(",") + "}");
    }

    function customConverter(columns, f) {
      var object = objectConverter(columns);
      return function(row, i) {
        return f(object(row), i, columns);
      };
    }

    // Compute unique columns in order of discovery.
    function inferColumns(rows) {
      var columnSet = Object.create(null),
          columns = [];

      rows.forEach(function(row) {
        for (var column in row) {
          if (!(column in columnSet)) {
            columns.push(columnSet[column] = column);
          }
        }
      });

      return columns;
    }

    function Dsv(delimiter) {
      var reFormat = new RegExp("[\"" + delimiter + "\n]"),
          delimiterCode = delimiter.charCodeAt(0);

      this.parse = function(text, f) {
        var convert, columns, rows = this.parseRows(text, function(row, i) {
          if (convert) return convert(row, i - 1);
          columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
        });
        rows.columns = columns;
        return rows;
      };

      this.parseRows = function(text, f) {
        var EOL = {}, // sentinel value for end-of-line
            EOF = {}, // sentinel value for end-of-file
            rows = [], // output rows
            N = text.length,
            I = 0, // current character index
            n = 0, // the current line number
            t, // the current token
            eol; // is the current token followed by EOL?

        function token() {
          if (I >= N) return EOF; // special case: end of file
          if (eol) return eol = false, EOL; // special case: end of line

          // special case: quotes
          var j = I, c;
          if (text.charCodeAt(j) === 34) {
            var i = j;
            while (i++ < N) {
              if (text.charCodeAt(i) === 34) {
                if (text.charCodeAt(i + 1) !== 34) break;
                ++i;
              }
            }
            I = i + 2;
            c = text.charCodeAt(i + 1);
            if (c === 13) {
              eol = true;
              if (text.charCodeAt(i + 2) === 10) ++I;
            } else if (c === 10) {
              eol = true;
            }
            return text.slice(j + 1, i).replace(/""/g, "\"");
          }

          // common case: find next delimiter or newline
          while (I < N) {
            var k = 1;
            c = text.charCodeAt(I++);
            if (c === 10) eol = true; // \n
            else if (c === 13) { eol = true; if (text.charCodeAt(I) === 10) ++I, ++k; } // \r|\r\n
            else if (c !== delimiterCode) continue;
            return text.slice(j, I - k);
          }

          // special case: last token before EOF
          return text.slice(j);
        }

        while ((t = token()) !== EOF) {
          var a = [];
          while (t !== EOL && t !== EOF) {
            a.push(t);
            t = token();
          }
          if (f && (a = f(a, n++)) == null) continue;
          rows.push(a);
        }

        return rows;
      };

      this.format = function(rows, columns) {
        if (columns == null) columns = inferColumns(rows);
        return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
          return columns.map(function(column) {
            return formatValue(row[column]);
          }).join(delimiter);
        })).join("\n");
      };

      this.formatRows = function(rows) {
        return rows.map(formatRow).join("\n");
      };

      function formatRow(row) {
        return row.map(formatValue).join(delimiter);
      }

      function formatValue(text) {
        return reFormat.test(text) ? "\"" + text.replace(/\"/g, "\"\"") + "\"" : text;
      }
    }

    dsv.prototype = Dsv.prototype;

    var csv = dsv(",");
    var tsv = dsv("\t");

    var version = "0.1.14";

    exports.version = version;
    exports.dsv = dsv;
    exports.csv = csv;
    exports.tsv = tsv;

  }));
  });

  function dsv(data, format) {
    if (data) {
      var h = format.header;
      data = (h ? h.join(format.delimiter) + '\n' : '') + data;
    }
    return d3Dsv.dsv(format.delimiter).parse(data);
  }

  dsv.delimiter = function(delim) {
    var fmt = {delimiter: delim};
    return function(data, format) {
      return dsv(data, format ? util.extend(format, fmt) : fmt);
    };
  };

  var dsv_1 = dsv;

  var json = function(data, format) {
    var d = util.isObject(data) && !util.isBuffer(data) ?
      data : JSON.parse(data);
    if (format && format.property) {
      d = util.accessor(format.property)(d);
    }
    return d;
  };

  function identity(x) {
    return x;
  }

  function transform(transform) {
    if (transform == null) return identity;
    var x0,
        y0,
        kx = transform.scale[0],
        ky = transform.scale[1],
        dx = transform.translate[0],
        dy = transform.translate[1];
    return function(input, i) {
      if (!i) x0 = y0 = 0;
      var j = 2, n = input.length, output = new Array(n);
      output[0] = (x0 += input[0]) * kx + dx;
      output[1] = (y0 += input[1]) * ky + dy;
      while (j < n) output[j] = input[j], ++j;
      return output;
    };
  }

  function bbox(topology) {
    var t = transform(topology.transform), key,
        x0 = Infinity, y0 = x0, x1 = -x0, y1 = -x0;

    function bboxPoint(p) {
      p = t(p);
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }

    function bboxGeometry(o) {
      switch (o.type) {
        case "GeometryCollection": o.geometries.forEach(bboxGeometry); break;
        case "Point": bboxPoint(o.coordinates); break;
        case "MultiPoint": o.coordinates.forEach(bboxPoint); break;
      }
    }

    topology.arcs.forEach(function(arc) {
      var i = -1, n = arc.length, p;
      while (++i < n) {
        p = t(arc[i], i);
        if (p[0] < x0) x0 = p[0];
        if (p[0] > x1) x1 = p[0];
        if (p[1] < y0) y0 = p[1];
        if (p[1] > y1) y1 = p[1];
      }
    });

    for (key in topology.objects) {
      bboxGeometry(topology.objects[key]);
    }

    return [x0, y0, x1, y1];
  }

  function reverse(array, n) {
    var t, j = array.length, i = j - n;
    while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
  }

  function feature(topology, o) {
    return o.type === "GeometryCollection"
        ? {type: "FeatureCollection", features: o.geometries.map(function(o) { return feature$1(topology, o); })}
        : feature$1(topology, o);
  }

  function feature$1(topology, o) {
    var id = o.id,
        bbox = o.bbox,
        properties = o.properties == null ? {} : o.properties,
        geometry = object(topology, o);
    return id == null && bbox == null ? {type: "Feature", properties: properties, geometry: geometry}
        : bbox == null ? {type: "Feature", id: id, properties: properties, geometry: geometry}
        : {type: "Feature", id: id, bbox: bbox, properties: properties, geometry: geometry};
  }

  function object(topology, o) {
    var transformPoint = transform(topology.transform),
        arcs = topology.arcs;

    function arc(i, points) {
      if (points.length) points.pop();
      for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length; k < n; ++k) {
        points.push(transformPoint(a[k], k));
      }
      if (i < 0) reverse(points, n);
    }

    function point(p) {
      return transformPoint(p);
    }

    function line(arcs) {
      var points = [];
      for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
      if (points.length < 2) points.push(points[0]); // This should never happen per the specification.
      return points;
    }

    function ring(arcs) {
      var points = line(arcs);
      while (points.length < 4) points.push(points[0]); // This may happen if an arc has only two points.
      return points;
    }

    function polygon(arcs) {
      return arcs.map(ring);
    }

    function geometry(o) {
      var type = o.type, coordinates;
      switch (type) {
        case "GeometryCollection": return {type: type, geometries: o.geometries.map(geometry)};
        case "Point": coordinates = point(o.coordinates); break;
        case "MultiPoint": coordinates = o.coordinates.map(point); break;
        case "LineString": coordinates = line(o.arcs); break;
        case "MultiLineString": coordinates = o.arcs.map(line); break;
        case "Polygon": coordinates = polygon(o.arcs); break;
        case "MultiPolygon": coordinates = o.arcs.map(polygon); break;
        default: return null;
      }
      return {type: type, coordinates: coordinates};
    }

    return geometry(o);
  }

  function stitch(topology, arcs) {
    var stitchedArcs = {},
        fragmentByStart = {},
        fragmentByEnd = {},
        fragments = [],
        emptyIndex = -1;

    // Stitch empty arcs first, since they may be subsumed by other arcs.
    arcs.forEach(function(i, j) {
      var arc = topology.arcs[i < 0 ? ~i : i], t;
      if (arc.length < 3 && !arc[1][0] && !arc[1][1]) {
        t = arcs[++emptyIndex], arcs[emptyIndex] = i, arcs[j] = t;
      }
    });

    arcs.forEach(function(i) {
      var e = ends(i),
          start = e[0],
          end = e[1],
          f, g;

      if (f = fragmentByEnd[start]) {
        delete fragmentByEnd[f.end];
        f.push(i);
        f.end = end;
        if (g = fragmentByStart[end]) {
          delete fragmentByStart[g.start];
          var fg = g === f ? f : f.concat(g);
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.end] = fg;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByStart[end]) {
        delete fragmentByStart[f.start];
        f.unshift(i);
        f.start = start;
        if (g = fragmentByEnd[start]) {
          delete fragmentByEnd[g.end];
          var gf = g === f ? f : g.concat(f);
          fragmentByStart[gf.start = g.start] = fragmentByEnd[gf.end = f.end] = gf;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else {
        f = [i];
        fragmentByStart[f.start = start] = fragmentByEnd[f.end = end] = f;
      }
    });

    function ends(i) {
      var arc = topology.arcs[i < 0 ? ~i : i], p0 = arc[0], p1;
      if (topology.transform) p1 = [0, 0], arc.forEach(function(dp) { p1[0] += dp[0], p1[1] += dp[1]; });
      else p1 = arc[arc.length - 1];
      return i < 0 ? [p1, p0] : [p0, p1];
    }

    function flush(fragmentByEnd, fragmentByStart) {
      for (var k in fragmentByEnd) {
        var f = fragmentByEnd[k];
        delete fragmentByStart[f.start];
        delete f.start;
        delete f.end;
        f.forEach(function(i) { stitchedArcs[i < 0 ? ~i : i] = 1; });
        fragments.push(f);
      }
    }

    flush(fragmentByEnd, fragmentByStart);
    flush(fragmentByStart, fragmentByEnd);
    arcs.forEach(function(i) { if (!stitchedArcs[i < 0 ? ~i : i]) fragments.push([i]); });

    return fragments;
  }

  function mesh(topology) {
    return object(topology, meshArcs.apply(this, arguments));
  }

  function meshArcs(topology, object$$1, filter) {
    var arcs, i, n;
    if (arguments.length > 1) arcs = extractArcs(topology, object$$1, filter);
    else for (i = 0, arcs = new Array(n = topology.arcs.length); i < n; ++i) arcs[i] = i;
    return {type: "MultiLineString", arcs: stitch(topology, arcs)};
  }

  function extractArcs(topology, object$$1, filter) {
    var arcs = [],
        geomsByArc = [],
        geom;

    function extract0(i) {
      var j = i < 0 ? ~i : i;
      (geomsByArc[j] || (geomsByArc[j] = [])).push({i: i, g: geom});
    }

    function extract1(arcs) {
      arcs.forEach(extract0);
    }

    function extract2(arcs) {
      arcs.forEach(extract1);
    }

    function extract3(arcs) {
      arcs.forEach(extract2);
    }

    function geometry(o) {
      switch (geom = o, o.type) {
        case "GeometryCollection": o.geometries.forEach(geometry); break;
        case "LineString": extract1(o.arcs); break;
        case "MultiLineString": case "Polygon": extract2(o.arcs); break;
        case "MultiPolygon": extract3(o.arcs); break;
      }
    }

    geometry(object$$1);

    geomsByArc.forEach(filter == null
        ? function(geoms) { arcs.push(geoms[0].i); }
        : function(geoms) { if (filter(geoms[0].g, geoms[geoms.length - 1].g)) arcs.push(geoms[0].i); });

    return arcs;
  }

  function planarRingArea(ring) {
    var i = -1, n = ring.length, a, b = ring[n - 1], area = 0;
    while (++i < n) a = b, b = ring[i], area += a[0] * b[1] - a[1] * b[0];
    return Math.abs(area); // Note: doubled area!
  }

  function merge(topology) {
    return object(topology, mergeArcs.apply(this, arguments));
  }

  function mergeArcs(topology, objects) {
    var polygonsByArc = {},
        polygons = [],
        groups = [];

    objects.forEach(geometry);

    function geometry(o) {
      switch (o.type) {
        case "GeometryCollection": o.geometries.forEach(geometry); break;
        case "Polygon": extract(o.arcs); break;
        case "MultiPolygon": o.arcs.forEach(extract); break;
      }
    }

    function extract(polygon) {
      polygon.forEach(function(ring) {
        ring.forEach(function(arc) {
          (polygonsByArc[arc = arc < 0 ? ~arc : arc] || (polygonsByArc[arc] = [])).push(polygon);
        });
      });
      polygons.push(polygon);
    }

    function area(ring) {
      return planarRingArea(object(topology, {type: "Polygon", arcs: [ring]}).coordinates[0]);
    }

    polygons.forEach(function(polygon) {
      if (!polygon._) {
        var group = [],
            neighbors = [polygon];
        polygon._ = 1;
        groups.push(group);
        while (polygon = neighbors.pop()) {
          group.push(polygon);
          polygon.forEach(function(ring) {
            ring.forEach(function(arc) {
              polygonsByArc[arc < 0 ? ~arc : arc].forEach(function(polygon) {
                if (!polygon._) {
                  polygon._ = 1;
                  neighbors.push(polygon);
                }
              });
            });
          });
        }
      }
    });

    polygons.forEach(function(polygon) {
      delete polygon._;
    });

    return {
      type: "MultiPolygon",
      arcs: groups.map(function(polygons) {
        var arcs = [], n;

        // Extract the exterior (unique) arcs.
        polygons.forEach(function(polygon) {
          polygon.forEach(function(ring) {
            ring.forEach(function(arc) {
              if (polygonsByArc[arc < 0 ? ~arc : arc].length < 2) {
                arcs.push(arc);
              }
            });
          });
        });

        // Stitch the arcs into one or more rings.
        arcs = stitch(topology, arcs);

        // If more than one ring is returned,
        // at most one of these rings can be the exterior;
        // choose the one with the greatest absolute area.
        if ((n = arcs.length) > 1) {
          for (var i = 1, k = area(arcs[0]), ki, t; i < n; ++i) {
            if ((ki = area(arcs[i])) > k) {
              t = arcs[0], arcs[0] = arcs[i], arcs[i] = t, k = ki;
            }
          }
        }

        return arcs;
      })
    };
  }

  function bisect(a, x) {
    var lo = 0, hi = a.length;
    while (lo < hi) {
      var mid = lo + hi >>> 1;
      if (a[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function neighbors(objects) {
    var indexesByArc = {}, // arc index -> array of object indexes
        neighbors = objects.map(function() { return []; });

    function line(arcs, i) {
      arcs.forEach(function(a) {
        if (a < 0) a = ~a;
        var o = indexesByArc[a];
        if (o) o.push(i);
        else indexesByArc[a] = [i];
      });
    }

    function polygon(arcs, i) {
      arcs.forEach(function(arc) { line(arc, i); });
    }

    function geometry(o, i) {
      if (o.type === "GeometryCollection") o.geometries.forEach(function(o) { geometry(o, i); });
      else if (o.type in geometryType) geometryType[o.type](o.arcs, i);
    }

    var geometryType = {
      LineString: line,
      MultiLineString: polygon,
      Polygon: polygon,
      MultiPolygon: function(arcs, i) { arcs.forEach(function(arc) { polygon(arc, i); }); }
    };

    objects.forEach(geometry);

    for (var i in indexesByArc) {
      for (var indexes = indexesByArc[i], m = indexes.length, j = 0; j < m; ++j) {
        for (var k = j + 1; k < m; ++k) {
          var ij = indexes[j], ik = indexes[k], n;
          if ((n = neighbors[ij])[i = bisect(n, ik)] !== ik) n.splice(i, 0, ik);
          if ((n = neighbors[ik])[i = bisect(n, ij)] !== ij) n.splice(i, 0, ij);
        }
      }
    }

    return neighbors;
  }

  function untransform(transform) {
    if (transform == null) return identity;
    var x0,
        y0,
        kx = transform.scale[0],
        ky = transform.scale[1],
        dx = transform.translate[0],
        dy = transform.translate[1];
    return function(input, i) {
      if (!i) x0 = y0 = 0;
      var j = 2,
          n = input.length,
          output = new Array(n),
          x1 = Math.round((input[0] - dx) / kx),
          y1 = Math.round((input[1] - dy) / ky);
      output[0] = x1 - x0, x0 = x1;
      output[1] = y1 - y0, y0 = y1;
      while (j < n) output[j] = input[j], ++j;
      return output;
    };
  }

  function quantize(topology, transform) {
    if (topology.transform) throw new Error("already quantized");

    if (!transform || !transform.scale) {
      if (!((n = Math.floor(transform)) >= 2)) throw new Error("n must be ≥2");
      box = topology.bbox || bbox(topology);
      var x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3], n;
      transform = {scale: [x1 - x0 ? (x1 - x0) / (n - 1) : 1, y1 - y0 ? (y1 - y0) / (n - 1) : 1], translate: [x0, y0]};
    } else {
      box = topology.bbox;
    }

    var t = untransform(transform), box, key, inputs = topology.objects, outputs = {};

    function quantizePoint(point) {
      return t(point);
    }

    function quantizeGeometry(input) {
      var output;
      switch (input.type) {
        case "GeometryCollection": output = {type: "GeometryCollection", geometries: input.geometries.map(quantizeGeometry)}; break;
        case "Point": output = {type: "Point", coordinates: quantizePoint(input.coordinates)}; break;
        case "MultiPoint": output = {type: "MultiPoint", coordinates: input.coordinates.map(quantizePoint)}; break;
        default: return input;
      }
      if (input.id != null) output.id = input.id;
      if (input.bbox != null) output.bbox = input.bbox;
      if (input.properties != null) output.properties = input.properties;
      return output;
    }

    function quantizeArc(input) {
      var i = 0, j = 1, n = input.length, p, output = new Array(n); // pessimistic
      output[0] = t(input[0], 0);
      while (++i < n) if ((p = t(input[i], i))[0] || p[1]) output[j++] = p; // non-coincident points
      if (j === 1) output[j++] = [0, 0]; // an arc must have at least two points
      output.length = j;
      return output;
    }

    for (key in inputs) outputs[key] = quantizeGeometry(inputs[key]);

    return {
      type: "Topology",
      bbox: box,
      transform: transform,
      objects: outputs,
      arcs: topology.arcs.map(quantizeArc)
    };
  }



  var topojsonClient = /*#__PURE__*/Object.freeze({
    bbox: bbox,
    feature: feature,
    mesh: mesh,
    meshArcs: meshArcs,
    merge: merge,
    mergeArcs: mergeArcs,
    neighbors: neighbors,
    quantize: quantize,
    transform: transform,
    untransform: untransform
  });

  var reader = function(data, format) {
    var topojson = reader.topojson;
    if (topojson == null) { throw Error('TopoJSON library not loaded.'); }

    var t = json(data, format), obj;

    if (format && format.feature) {
      if ((obj = t.objects[format.feature])) {
        return topojson.feature(t, obj).features;
      } else {
        throw Error('Invalid TopoJSON object: ' + format.feature);
      }
    } else if (format && format.mesh) {
      if ((obj = t.objects[format.mesh])) {
        return [topojson.mesh(t, t.objects[format.mesh])];
      } else {
        throw Error('Invalid TopoJSON object: ' + format.mesh);
      }
    } else {
      throw Error('Missing TopoJSON feature or mesh parameter.');
    }
  };

  reader.topojson = topojsonClient;
  var topojson = reader;

  var treejson = function(tree, format) {
    return toTable(json(tree, format), format);
  };

  function toTable(root, fields) {
    var childrenField = fields && fields.children || 'children',
        parentField = fields && fields.parent || 'parent',
        table = [];

    function visit(node, parent) {
      node[parentField] = parent;
      table.push(node);
      var children = node[childrenField];
      if (children) {
        for (var i=0; i<children.length; ++i) {
          visit(children[i], node);
        }
      }
    }

    visit(root, null);
    return (table.root = root, table);
  }

  var formats = {
    json: json,
    topojson: topojson,
    treejson: treejson,
    dsv: dsv_1,
    csv: dsv_1.delimiter(','),
    tsv: dsv_1.delimiter('\t')
  };

  var d3Time = createCommonjsModule(function (module, exports) {
  (function (global, factory) {
    factory(exports);
  }(commonjsGlobal, function (exports) {
    var t0 = new Date;
    var t1 = new Date;
    function newInterval(floori, offseti, count, field) {

      function interval(date) {
        return floori(date = new Date(+date)), date;
      }

      interval.floor = interval;

      interval.round = function(date) {
        var d0 = new Date(+date),
            d1 = new Date(date - 1);
        floori(d0), floori(d1), offseti(d1, 1);
        return date - d0 < d1 - date ? d0 : d1;
      };

      interval.ceil = function(date) {
        return floori(date = new Date(date - 1)), offseti(date, 1), date;
      };

      interval.offset = function(date, step) {
        return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
      };

      interval.range = function(start, stop, step) {
        var range = [];
        start = new Date(start - 1);
        stop = new Date(+stop);
        step = step == null ? 1 : Math.floor(step);
        if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
        offseti(start, 1), floori(start);
        if (start < stop) range.push(new Date(+start));
        while (offseti(start, step), floori(start), start < stop) range.push(new Date(+start));
        return range;
      };

      interval.filter = function(test) {
        return newInterval(function(date) {
          while (floori(date), !test(date)) date.setTime(date - 1);
        }, function(date, step) {
          while (--step >= 0) while (offseti(date, 1), !test(date));
        });
      };

      if (count) {
        interval.count = function(start, end) {
          t0.setTime(+start), t1.setTime(+end);
          floori(t0), floori(t1);
          return Math.floor(count(t0, t1));
        };

        interval.every = function(step) {
          step = Math.floor(step);
          return !isFinite(step) || !(step > 0) ? null
              : !(step > 1) ? interval
              : interval.filter(field
                  ? function(d) { return field(d) % step === 0; }
                  : function(d) { return interval.count(0, d) % step === 0; });
        };
      }

      return interval;
    }
    var millisecond = newInterval(function() {
      // noop
    }, function(date, step) {
      date.setTime(+date + step);
    }, function(start, end) {
      return end - start;
    });

    // An optimized implementation for this simple case.
    millisecond.every = function(k) {
      k = Math.floor(k);
      if (!isFinite(k) || !(k > 0)) return null;
      if (!(k > 1)) return millisecond;
      return newInterval(function(date) {
        date.setTime(Math.floor(date / k) * k);
      }, function(date, step) {
        date.setTime(+date + step * k);
      }, function(start, end) {
        return (end - start) / k;
      });
    };

    var second = newInterval(function(date) {
      date.setMilliseconds(0);
    }, function(date, step) {
      date.setTime(+date + step * 1e3);
    }, function(start, end) {
      return (end - start) / 1e3;
    }, function(date) {
      return date.getSeconds();
    });

    var minute = newInterval(function(date) {
      date.setSeconds(0, 0);
    }, function(date, step) {
      date.setTime(+date + step * 6e4);
    }, function(start, end) {
      return (end - start) / 6e4;
    }, function(date) {
      return date.getMinutes();
    });

    var hour = newInterval(function(date) {
      date.setMinutes(0, 0, 0);
    }, function(date, step) {
      date.setTime(+date + step * 36e5);
    }, function(start, end) {
      return (end - start) / 36e5;
    }, function(date) {
      return date.getHours();
    });

    var day = newInterval(function(date) {
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setDate(date.getDate() + step);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 864e5;
    }, function(date) {
      return date.getDate() - 1;
    });

    function weekday(i) {
      return newInterval(function(date) {
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      }, function(date, step) {
        date.setDate(date.getDate() + step * 7);
      }, function(start, end) {
        return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 6048e5;
      });
    }

    var sunday = weekday(0);
    var monday = weekday(1);
    var tuesday = weekday(2);
    var wednesday = weekday(3);
    var thursday = weekday(4);
    var friday = weekday(5);
    var saturday = weekday(6);

    var month = newInterval(function(date) {
      date.setHours(0, 0, 0, 0);
      date.setDate(1);
    }, function(date, step) {
      date.setMonth(date.getMonth() + step);
    }, function(start, end) {
      return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
    }, function(date) {
      return date.getMonth();
    });

    var year = newInterval(function(date) {
      date.setHours(0, 0, 0, 0);
      date.setMonth(0, 1);
    }, function(date, step) {
      date.setFullYear(date.getFullYear() + step);
    }, function(start, end) {
      return end.getFullYear() - start.getFullYear();
    }, function(date) {
      return date.getFullYear();
    });

    var utcSecond = newInterval(function(date) {
      date.setUTCMilliseconds(0);
    }, function(date, step) {
      date.setTime(+date + step * 1e3);
    }, function(start, end) {
      return (end - start) / 1e3;
    }, function(date) {
      return date.getUTCSeconds();
    });

    var utcMinute = newInterval(function(date) {
      date.setUTCSeconds(0, 0);
    }, function(date, step) {
      date.setTime(+date + step * 6e4);
    }, function(start, end) {
      return (end - start) / 6e4;
    }, function(date) {
      return date.getUTCMinutes();
    });

    var utcHour = newInterval(function(date) {
      date.setUTCMinutes(0, 0, 0);
    }, function(date, step) {
      date.setTime(+date + step * 36e5);
    }, function(start, end) {
      return (end - start) / 36e5;
    }, function(date) {
      return date.getUTCHours();
    });

    var utcDay = newInterval(function(date) {
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step);
    }, function(start, end) {
      return (end - start) / 864e5;
    }, function(date) {
      return date.getUTCDate() - 1;
    });

    function utcWeekday(i) {
      return newInterval(function(date) {
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      }, function(date, step) {
        date.setUTCDate(date.getUTCDate() + step * 7);
      }, function(start, end) {
        return (end - start) / 6048e5;
      });
    }

    var utcSunday = utcWeekday(0);
    var utcMonday = utcWeekday(1);
    var utcTuesday = utcWeekday(2);
    var utcWednesday = utcWeekday(3);
    var utcThursday = utcWeekday(4);
    var utcFriday = utcWeekday(5);
    var utcSaturday = utcWeekday(6);

    var utcMonth = newInterval(function(date) {
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(1);
    }, function(date, step) {
      date.setUTCMonth(date.getUTCMonth() + step);
    }, function(start, end) {
      return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
    }, function(date) {
      return date.getUTCMonth();
    });

    var utcYear = newInterval(function(date) {
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCMonth(0, 1);
    }, function(date, step) {
      date.setUTCFullYear(date.getUTCFullYear() + step);
    }, function(start, end) {
      return end.getUTCFullYear() - start.getUTCFullYear();
    }, function(date) {
      return date.getUTCFullYear();
    });

    var milliseconds = millisecond.range;
    var seconds = second.range;
    var minutes = minute.range;
    var hours = hour.range;
    var days = day.range;
    var sundays = sunday.range;
    var mondays = monday.range;
    var tuesdays = tuesday.range;
    var wednesdays = wednesday.range;
    var thursdays = thursday.range;
    var fridays = friday.range;
    var saturdays = saturday.range;
    var weeks = sunday.range;
    var months = month.range;
    var years = year.range;

    var utcMillisecond = millisecond;
    var utcMilliseconds = milliseconds;
    var utcSeconds = utcSecond.range;
    var utcMinutes = utcMinute.range;
    var utcHours = utcHour.range;
    var utcDays = utcDay.range;
    var utcSundays = utcSunday.range;
    var utcMondays = utcMonday.range;
    var utcTuesdays = utcTuesday.range;
    var utcWednesdays = utcWednesday.range;
    var utcThursdays = utcThursday.range;
    var utcFridays = utcFriday.range;
    var utcSaturdays = utcSaturday.range;
    var utcWeeks = utcSunday.range;
    var utcMonths = utcMonth.range;
    var utcYears = utcYear.range;

    var version = "0.1.1";

    exports.version = version;
    exports.milliseconds = milliseconds;
    exports.seconds = seconds;
    exports.minutes = minutes;
    exports.hours = hours;
    exports.days = days;
    exports.sundays = sundays;
    exports.mondays = mondays;
    exports.tuesdays = tuesdays;
    exports.wednesdays = wednesdays;
    exports.thursdays = thursdays;
    exports.fridays = fridays;
    exports.saturdays = saturdays;
    exports.weeks = weeks;
    exports.months = months;
    exports.years = years;
    exports.utcMillisecond = utcMillisecond;
    exports.utcMilliseconds = utcMilliseconds;
    exports.utcSeconds = utcSeconds;
    exports.utcMinutes = utcMinutes;
    exports.utcHours = utcHours;
    exports.utcDays = utcDays;
    exports.utcSundays = utcSundays;
    exports.utcMondays = utcMondays;
    exports.utcTuesdays = utcTuesdays;
    exports.utcWednesdays = utcWednesdays;
    exports.utcThursdays = utcThursdays;
    exports.utcFridays = utcFridays;
    exports.utcSaturdays = utcSaturdays;
    exports.utcWeeks = utcWeeks;
    exports.utcMonths = utcMonths;
    exports.utcYears = utcYears;
    exports.millisecond = millisecond;
    exports.second = second;
    exports.minute = minute;
    exports.hour = hour;
    exports.day = day;
    exports.sunday = sunday;
    exports.monday = monday;
    exports.tuesday = tuesday;
    exports.wednesday = wednesday;
    exports.thursday = thursday;
    exports.friday = friday;
    exports.saturday = saturday;
    exports.week = sunday;
    exports.month = month;
    exports.year = year;
    exports.utcSecond = utcSecond;
    exports.utcMinute = utcMinute;
    exports.utcHour = utcHour;
    exports.utcDay = utcDay;
    exports.utcSunday = utcSunday;
    exports.utcMonday = utcMonday;
    exports.utcTuesday = utcTuesday;
    exports.utcWednesday = utcWednesday;
    exports.utcThursday = utcThursday;
    exports.utcFriday = utcFriday;
    exports.utcSaturday = utcSaturday;
    exports.utcWeek = utcSunday;
    exports.utcMonth = utcMonth;
    exports.utcYear = utcYear;
    exports.interval = newInterval;

  }));
  });

  var d3TimeFormat = createCommonjsModule(function (module, exports) {
  (function (global, factory) {
    factory(exports, d3Time);
  }(commonjsGlobal, function (exports,d3Time$$1) {
    function localDate(d) {
      if (0 <= d.y && d.y < 100) {
        var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
        date.setFullYear(d.y);
        return date;
      }
      return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
    }

    function utcDate(d) {
      if (0 <= d.y && d.y < 100) {
        var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
        date.setUTCFullYear(d.y);
        return date;
      }
      return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
    }

    function newYear(y) {
      return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
    }

    function locale$1(locale) {
      var locale_dateTime = locale.dateTime,
          locale_date = locale.date,
          locale_time = locale.time,
          locale_periods = locale.periods,
          locale_weekdays = locale.days,
          locale_shortWeekdays = locale.shortDays,
          locale_months = locale.months,
          locale_shortMonths = locale.shortMonths;

      var periodRe = formatRe(locale_periods),
          periodLookup = formatLookup(locale_periods),
          weekdayRe = formatRe(locale_weekdays),
          weekdayLookup = formatLookup(locale_weekdays),
          shortWeekdayRe = formatRe(locale_shortWeekdays),
          shortWeekdayLookup = formatLookup(locale_shortWeekdays),
          monthRe = formatRe(locale_months),
          monthLookup = formatLookup(locale_months),
          shortMonthRe = formatRe(locale_shortMonths),
          shortMonthLookup = formatLookup(locale_shortMonths);

      var formats = {
        "a": formatShortWeekday,
        "A": formatWeekday,
        "b": formatShortMonth,
        "B": formatMonth,
        "c": null,
        "d": formatDayOfMonth,
        "e": formatDayOfMonth,
        "H": formatHour24,
        "I": formatHour12,
        "j": formatDayOfYear,
        "L": formatMilliseconds,
        "m": formatMonthNumber,
        "M": formatMinutes,
        "p": formatPeriod,
        "S": formatSeconds,
        "U": formatWeekNumberSunday,
        "w": formatWeekdayNumber,
        "W": formatWeekNumberMonday,
        "x": null,
        "X": null,
        "y": formatYear,
        "Y": formatFullYear,
        "Z": formatZone,
        "%": formatLiteralPercent
      };

      var utcFormats = {
        "a": formatUTCShortWeekday,
        "A": formatUTCWeekday,
        "b": formatUTCShortMonth,
        "B": formatUTCMonth,
        "c": null,
        "d": formatUTCDayOfMonth,
        "e": formatUTCDayOfMonth,
        "H": formatUTCHour24,
        "I": formatUTCHour12,
        "j": formatUTCDayOfYear,
        "L": formatUTCMilliseconds,
        "m": formatUTCMonthNumber,
        "M": formatUTCMinutes,
        "p": formatUTCPeriod,
        "S": formatUTCSeconds,
        "U": formatUTCWeekNumberSunday,
        "w": formatUTCWeekdayNumber,
        "W": formatUTCWeekNumberMonday,
        "x": null,
        "X": null,
        "y": formatUTCYear,
        "Y": formatUTCFullYear,
        "Z": formatUTCZone,
        "%": formatLiteralPercent
      };

      var parses = {
        "a": parseShortWeekday,
        "A": parseWeekday,
        "b": parseShortMonth,
        "B": parseMonth,
        "c": parseLocaleDateTime,
        "d": parseDayOfMonth,
        "e": parseDayOfMonth,
        "H": parseHour24,
        "I": parseHour24,
        "j": parseDayOfYear,
        "L": parseMilliseconds,
        "m": parseMonthNumber,
        "M": parseMinutes,
        "p": parsePeriod,
        "S": parseSeconds,
        "U": parseWeekNumberSunday,
        "w": parseWeekdayNumber,
        "W": parseWeekNumberMonday,
        "x": parseLocaleDate,
        "X": parseLocaleTime,
        "y": parseYear,
        "Y": parseFullYear,
        "Z": parseZone,
        "%": parseLiteralPercent
      };

      // These recursive directive definitions must be deferred.
      formats.x = newFormat(locale_date, formats);
      formats.X = newFormat(locale_time, formats);
      formats.c = newFormat(locale_dateTime, formats);
      utcFormats.x = newFormat(locale_date, utcFormats);
      utcFormats.X = newFormat(locale_time, utcFormats);
      utcFormats.c = newFormat(locale_dateTime, utcFormats);

      function newFormat(specifier, formats) {
        return function(date) {
          var string = [],
              i = -1,
              j = 0,
              n = specifier.length,
              c,
              pad,
              format;

          if (!(date instanceof Date)) date = new Date(+date);

          while (++i < n) {
            if (specifier.charCodeAt(i) === 37) {
              string.push(specifier.slice(j, i));
              if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
              else pad = c === "e" ? " " : "0";
              if (format = formats[c]) c = format(date, pad);
              string.push(c);
              j = i + 1;
            }
          }

          string.push(specifier.slice(j, i));
          return string.join("");
        };
      }

      function newParse(specifier, newDate) {
        return function(string) {
          var d = newYear(1900),
              i = parseSpecifier(d, specifier, string += "", 0);
          if (i != string.length) return null;

          // The am-pm flag is 0 for AM, and 1 for PM.
          if ("p" in d) d.H = d.H % 12 + d.p * 12;

          // Convert day-of-week and week-of-year to day-of-year.
          if ("W" in d || "U" in d) {
            if (!("w" in d)) d.w = "W" in d ? 1 : 0;
            var day = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
            d.m = 0;
            d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
          }

          // If a time zone is specified, all fields are interpreted as UTC and then
          // offset according to the specified time zone.
          if ("Z" in d) {
            d.H += d.Z / 100 | 0;
            d.M += d.Z % 100;
            return utcDate(d);
          }

          // Otherwise, all fields are in local time.
          return newDate(d);
        };
      }

      function parseSpecifier(d, specifier, string, j) {
        var i = 0,
            n = specifier.length,
            m = string.length,
            c,
            parse;

        while (i < n) {
          if (j >= m) return -1;
          c = specifier.charCodeAt(i++);
          if (c === 37) {
            c = specifier.charAt(i++);
            parse = parses[c in pads ? specifier.charAt(i++) : c];
            if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
          } else if (c != string.charCodeAt(j++)) {
            return -1;
          }
        }

        return j;
      }

      function parsePeriod(d, string, i) {
        var n = periodRe.exec(string.slice(i));
        return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
      }

      function parseShortWeekday(d, string, i) {
        var n = shortWeekdayRe.exec(string.slice(i));
        return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
      }

      function parseWeekday(d, string, i) {
        var n = weekdayRe.exec(string.slice(i));
        return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
      }

      function parseShortMonth(d, string, i) {
        var n = shortMonthRe.exec(string.slice(i));
        return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
      }

      function parseMonth(d, string, i) {
        var n = monthRe.exec(string.slice(i));
        return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
      }

      function parseLocaleDateTime(d, string, i) {
        return parseSpecifier(d, locale_dateTime, string, i);
      }

      function parseLocaleDate(d, string, i) {
        return parseSpecifier(d, locale_date, string, i);
      }

      function parseLocaleTime(d, string, i) {
        return parseSpecifier(d, locale_time, string, i);
      }

      function formatShortWeekday(d) {
        return locale_shortWeekdays[d.getDay()];
      }

      function formatWeekday(d) {
        return locale_weekdays[d.getDay()];
      }

      function formatShortMonth(d) {
        return locale_shortMonths[d.getMonth()];
      }

      function formatMonth(d) {
        return locale_months[d.getMonth()];
      }

      function formatPeriod(d) {
        return locale_periods[+(d.getHours() >= 12)];
      }

      function formatUTCShortWeekday(d) {
        return locale_shortWeekdays[d.getUTCDay()];
      }

      function formatUTCWeekday(d) {
        return locale_weekdays[d.getUTCDay()];
      }

      function formatUTCShortMonth(d) {
        return locale_shortMonths[d.getUTCMonth()];
      }

      function formatUTCMonth(d) {
        return locale_months[d.getUTCMonth()];
      }

      function formatUTCPeriod(d) {
        return locale_periods[+(d.getUTCHours() >= 12)];
      }

      return {
        format: function(specifier) {
          var f = newFormat(specifier += "", formats);
          f.parse = newParse(specifier, localDate);
          f.toString = function() { return specifier; };
          return f;
        },
        utcFormat: function(specifier) {
          var f = newFormat(specifier += "", utcFormats);
          f.parse = newParse(specifier, utcDate);
          f.toString = function() { return specifier; };
          return f;
        }
      };
    }
    var pads = {"-": "", "_": " ", "0": "0"};
    var numberRe = /^\s*\d+/;
    var percentRe = /^%/;
    var requoteRe = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;
    function pad(value, fill, width) {
      var sign = value < 0 ? "-" : "",
          string = (sign ? -value : value) + "",
          length = string.length;
      return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
    }

    function requote(s) {
      return s.replace(requoteRe, "\\$&");
    }

    function formatRe(names) {
      return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
    }

    function formatLookup(names) {
      var map = {}, i = -1, n = names.length;
      while (++i < n) map[names[i].toLowerCase()] = i;
      return map;
    }

    function parseWeekdayNumber(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 1));
      return n ? (d.w = +n[0], i + n[0].length) : -1;
    }

    function parseWeekNumberSunday(d, string, i) {
      var n = numberRe.exec(string.slice(i));
      return n ? (d.U = +n[0], i + n[0].length) : -1;
    }

    function parseWeekNumberMonday(d, string, i) {
      var n = numberRe.exec(string.slice(i));
      return n ? (d.W = +n[0], i + n[0].length) : -1;
    }

    function parseFullYear(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 4));
      return n ? (d.y = +n[0], i + n[0].length) : -1;
    }

    function parseYear(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
    }

    function parseZone(d, string, i) {
      var n = /^(Z)|([+-]\d\d)(?:\:?(\d\d))?/.exec(string.slice(i, i + 6));
      return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
    }

    function parseMonthNumber(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
    }

    function parseDayOfMonth(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.d = +n[0], i + n[0].length) : -1;
    }

    function parseDayOfYear(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 3));
      return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
    }

    function parseHour24(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.H = +n[0], i + n[0].length) : -1;
    }

    function parseMinutes(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.M = +n[0], i + n[0].length) : -1;
    }

    function parseSeconds(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 2));
      return n ? (d.S = +n[0], i + n[0].length) : -1;
    }

    function parseMilliseconds(d, string, i) {
      var n = numberRe.exec(string.slice(i, i + 3));
      return n ? (d.L = +n[0], i + n[0].length) : -1;
    }

    function parseLiteralPercent(d, string, i) {
      var n = percentRe.exec(string.slice(i, i + 1));
      return n ? i + n[0].length : -1;
    }

    function formatDayOfMonth(d, p) {
      return pad(d.getDate(), p, 2);
    }

    function formatHour24(d, p) {
      return pad(d.getHours(), p, 2);
    }

    function formatHour12(d, p) {
      return pad(d.getHours() % 12 || 12, p, 2);
    }

    function formatDayOfYear(d, p) {
      return pad(1 + d3Time$$1.day.count(d3Time$$1.year(d), d), p, 3);
    }

    function formatMilliseconds(d, p) {
      return pad(d.getMilliseconds(), p, 3);
    }

    function formatMonthNumber(d, p) {
      return pad(d.getMonth() + 1, p, 2);
    }

    function formatMinutes(d, p) {
      return pad(d.getMinutes(), p, 2);
    }

    function formatSeconds(d, p) {
      return pad(d.getSeconds(), p, 2);
    }

    function formatWeekNumberSunday(d, p) {
      return pad(d3Time$$1.sunday.count(d3Time$$1.year(d), d), p, 2);
    }

    function formatWeekdayNumber(d) {
      return d.getDay();
    }

    function formatWeekNumberMonday(d, p) {
      return pad(d3Time$$1.monday.count(d3Time$$1.year(d), d), p, 2);
    }

    function formatYear(d, p) {
      return pad(d.getFullYear() % 100, p, 2);
    }

    function formatFullYear(d, p) {
      return pad(d.getFullYear() % 10000, p, 4);
    }

    function formatZone(d) {
      var z = d.getTimezoneOffset();
      return (z > 0 ? "-" : (z *= -1, "+"))
          + pad(z / 60 | 0, "0", 2)
          + pad(z % 60, "0", 2);
    }

    function formatUTCDayOfMonth(d, p) {
      return pad(d.getUTCDate(), p, 2);
    }

    function formatUTCHour24(d, p) {
      return pad(d.getUTCHours(), p, 2);
    }

    function formatUTCHour12(d, p) {
      return pad(d.getUTCHours() % 12 || 12, p, 2);
    }

    function formatUTCDayOfYear(d, p) {
      return pad(1 + d3Time$$1.utcDay.count(d3Time$$1.utcYear(d), d), p, 3);
    }

    function formatUTCMilliseconds(d, p) {
      return pad(d.getUTCMilliseconds(), p, 3);
    }

    function formatUTCMonthNumber(d, p) {
      return pad(d.getUTCMonth() + 1, p, 2);
    }

    function formatUTCMinutes(d, p) {
      return pad(d.getUTCMinutes(), p, 2);
    }

    function formatUTCSeconds(d, p) {
      return pad(d.getUTCSeconds(), p, 2);
    }

    function formatUTCWeekNumberSunday(d, p) {
      return pad(d3Time$$1.utcSunday.count(d3Time$$1.utcYear(d), d), p, 2);
    }

    function formatUTCWeekdayNumber(d) {
      return d.getUTCDay();
    }

    function formatUTCWeekNumberMonday(d, p) {
      return pad(d3Time$$1.utcMonday.count(d3Time$$1.utcYear(d), d), p, 2);
    }

    function formatUTCYear(d, p) {
      return pad(d.getUTCFullYear() % 100, p, 2);
    }

    function formatUTCFullYear(d, p) {
      return pad(d.getUTCFullYear() % 10000, p, 4);
    }

    function formatUTCZone() {
      return "+0000";
    }

    function formatLiteralPercent() {
      return "%";
    }

    var locale = locale$1({
      dateTime: "%a %b %e %X %Y",
      date: "%m/%d/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    });

    var caES = locale$1({
      dateTime: "%A, %e de %B de %Y, %X",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"],
      shortDays: ["dg.", "dl.", "dt.", "dc.", "dj.", "dv.", "ds."],
      months: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
      shortMonths: ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."]
    });

    var deCH = locale$1({
      dateTime: "%A, der %e. %B %Y, %X",
      date: "%d.%m.%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"], // unused
      days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
      shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
      months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
      shortMonths: ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
    });

    var deDE = locale$1({
      dateTime: "%A, der %e. %B %Y, %X",
      date: "%d.%m.%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"], // unused
      days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
      shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
      months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
      shortMonths: ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
    });

    var enCA = locale$1({
      dateTime: "%a %b %e %X %Y",
      date: "%Y-%m-%d",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    });

    var enGB = locale$1({
      dateTime: "%a %e %b %X %Y",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    });

    var esES = locale$1({
      dateTime: "%A, %e de %B de %Y, %X",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
      shortDays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
      months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
      shortMonths: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    });

    var fiFI = locale$1({
      dateTime: "%A, %-d. %Bta %Y klo %X",
      date: "%-d.%-m.%Y",
      time: "%H:%M:%S",
      periods: ["a.m.", "p.m."],
      days: ["sunnuntai", "maanantai", "tiistai", "keskiviikko", "torstai", "perjantai", "lauantai"],
      shortDays: ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"],
      months: ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"],
      shortMonths: ["Tammi", "Helmi", "Maalis", "Huhti", "Touko", "Kesä", "Heinä", "Elo", "Syys", "Loka", "Marras", "Joulu"]
    });

    var frCA = locale$1({
      dateTime: "%a %e %b %Y %X",
      date: "%Y-%m-%d",
      time: "%H:%M:%S",
      periods: ["", ""],
      days: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
      shortDays: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
      months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
      shortMonths: ["jan", "fév", "mar", "avr", "mai", "jui", "jul", "aoû", "sep", "oct", "nov", "déc"]
    });

    var frFR = locale$1({
      dateTime: "%A, le %e %B %Y, %X",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"], // unused
      days: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
      shortDays: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
      months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
      shortMonths: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    });

    var heIL = locale$1({
      dateTime: "%A, %e ב%B %Y %X",
      date: "%d.%m.%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
      shortDays: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
      months: ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"],
      shortMonths: ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"]
    });

    var huHU = locale$1({
      dateTime: "%Y. %B %-e., %A %X",
      date: "%Y. %m. %d.",
      time: "%H:%M:%S",
      periods: ["de.", "du."], // unused
      days: ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"],
      shortDays: ["V", "H", "K", "Sze", "Cs", "P", "Szo"],
      months: ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"],
      shortMonths: ["jan.", "feb.", "már.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]
    });

    var itIT = locale$1({
      dateTime: "%A %e %B %Y, %X",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"], // unused
      days: ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"],
      shortDays: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
      months: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
      shortMonths: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
    });

    var jaJP = locale$1({
      dateTime: "%Y %b %e %a %X",
      date: "%Y/%m/%d",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
      shortDays: ["日", "月", "火", "水", "木", "金", "土"],
      months: ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"],
      shortMonths: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    });

    var koKR = locale$1({
      dateTime: "%Y/%m/%d %a %X",
      date: "%Y/%m/%d",
      time: "%H:%M:%S",
      periods: ["오전", "오후"],
      days: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
      shortDays: ["일", "월", "화", "수", "목", "금", "토"],
      months: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
      shortMonths: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]
    });

    var mkMK = locale$1({
      dateTime: "%A, %e %B %Y г. %X",
      date: "%d.%m.%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"],
      shortDays: ["нед", "пон", "вто", "сре", "чет", "пет", "саб"],
      months: ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"],
      shortMonths: ["јан", "фев", "мар", "апр", "мај", "јун", "јул", "авг", "сеп", "окт", "ное", "дек"]
    });

    var nlNL = locale$1({
      dateTime: "%a %e %B %Y %T",
      date: "%d-%m-%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"], // unused
      days: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
      shortDays: ["zo", "ma", "di", "wo", "do", "vr", "za"],
      months: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
      shortMonths: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
    });

    var plPL = locale$1({
      dateTime: "%A, %e %B %Y, %X",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"], // unused
      days: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
      shortDays: ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."],
      months: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
      shortMonths: ["Stycz.", "Luty", "Marz.", "Kwie.", "Maj", "Czerw.", "Lipc.", "Sierp.", "Wrz.", "Paźdz.", "Listop.", "Grudz."]/* In Polish language abbraviated months are not commonly used so there is a dispute about the proper abbraviations. */
    });

    var ptBR = locale$1({
      dateTime: "%A, %e de %B de %Y. %X",
      date: "%d/%m/%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
      shortDays: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
      months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
      shortMonths: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    });

    var ruRU = locale$1({
      dateTime: "%A, %e %B %Y г. %X",
      date: "%d.%m.%Y",
      time: "%H:%M:%S",
      periods: ["AM", "PM"],
      days: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
      shortDays: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"],
      months: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
      shortMonths: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
    });

    var svSE = locale$1({
      dateTime: "%A den %d %B %Y %X",
      date: "%Y-%m-%d",
      time: "%H:%M:%S",
      periods: ["fm", "em"],
      days: ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"],
      shortDays: ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"],
      months: ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"],
      shortMonths: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"]
    });

    var zhCN = locale$1({
      dateTime: "%a %b %e %X %Y",
      date: "%Y/%-m/%-d",
      time: "%H:%M:%S",
      periods: ["上午", "下午"],
      days: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
      shortDays: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
      months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
      shortMonths: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
    });

    var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

    function formatIsoNative(date) {
      return date.toISOString();
    }

    formatIsoNative.parse = function(string) {
      var date = new Date(string);
      return isNaN(date) ? null : date;
    };

    formatIsoNative.toString = function() {
      return isoSpecifier;
    };

    var formatIso = Date.prototype.toISOString && +new Date("2000-01-01T00:00:00.000Z")
        ? formatIsoNative
        : locale.utcFormat(isoSpecifier);

    var format = locale.format;
    var utcFormat = locale.utcFormat;

    var version = "0.2.1";

    exports.version = version;
    exports.format = format;
    exports.utcFormat = utcFormat;
    exports.locale = locale$1;
    exports.localeCaEs = caES;
    exports.localeDeCh = deCH;
    exports.localeDeDe = deDE;
    exports.localeEnCa = enCA;
    exports.localeEnGb = enGB;
    exports.localeEnUs = locale;
    exports.localeEsEs = esES;
    exports.localeFiFi = fiFI;
    exports.localeFrCa = frCA;
    exports.localeFrFr = frFR;
    exports.localeHeIl = heIL;
    exports.localeHuHu = huHU;
    exports.localeItIt = itIT;
    exports.localeJaJp = jaJP;
    exports.localeKoKr = koKR;
    exports.localeMkMk = mkMK;
    exports.localeNlNl = nlNL;
    exports.localePlPl = plPL;
    exports.localePtBr = ptBR;
    exports.localeRuRu = ruRU;
    exports.localeSvSe = svSE;
    exports.localeZhCn = zhCN;
    exports.isoFormat = formatIso;

  }));
  });

  var d3Format = createCommonjsModule(function (module, exports) {
  (function (global, factory) {
    factory(exports);
  }(commonjsGlobal, function (exports) {
    // Computes the decimal coefficient and exponent of the specified number x with
    // significant digits p, where x is positive and p is in [1, 21] or undefined.
    // For example, formatDecimal(1.23) returns ["123", 0].
    function formatDecimal(x, p) {
      if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
      var i, coefficient = x.slice(0, i);

      // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
      // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
      return [
        coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
        +x.slice(i + 1)
      ];
    }
    function exponent(x) {
      return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
    }
    function formatGroup(grouping, thousands) {
      return function(value, width) {
        var i = value.length,
            t = [],
            j = 0,
            g = grouping[0],
            length = 0;

        while (i > 0 && g > 0) {
          if (length + g + 1 > width) g = Math.max(1, width - length);
          t.push(value.substring(i -= g, i + g));
          if ((length += g + 1) > width) break;
          g = grouping[j = (j + 1) % grouping.length];
        }

        return t.reverse().join(thousands);
      };
    }
    var prefixExponent;

    function formatPrefixAuto(x, p) {
      var d = formatDecimal(x, p);
      if (!d) return x + "";
      var coefficient = d[0],
          exponent = d[1],
          i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
          n = coefficient.length;
      return i === n ? coefficient
          : i > n ? coefficient + new Array(i - n + 1).join("0")
          : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
          : "0." + new Array(1 - i).join("0") + formatDecimal(x, Math.max(0, p + i - 1))[0]; // less than 1y!
    }
    function formatRounded(x, p) {
      var d = formatDecimal(x, p);
      if (!d) return x + "";
      var coefficient = d[0],
          exponent = d[1];
      return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
          : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
          : coefficient + new Array(exponent - coefficient.length + 2).join("0");
    }
    function formatDefault(x, p) {
      x = x.toPrecision(p);

      out: for (var n = x.length, i = 1, i0 = -1, i1; i < n; ++i) {
        switch (x[i]) {
          case ".": i0 = i1 = i; break;
          case "0": if (i0 === 0) i0 = i; i1 = i; break;
          case "e": break out;
          default: if (i0 > 0) i0 = 0; break;
        }
      }

      return i0 > 0 ? x.slice(0, i0) + x.slice(i1 + 1) : x;
    }
    var formatTypes = {
      "": formatDefault,
      "%": function(x, p) { return (x * 100).toFixed(p); },
      "b": function(x) { return Math.round(x).toString(2); },
      "c": function(x) { return x + ""; },
      "d": function(x) { return Math.round(x).toString(10); },
      "e": function(x, p) { return x.toExponential(p); },
      "f": function(x, p) { return x.toFixed(p); },
      "g": function(x, p) { return x.toPrecision(p); },
      "o": function(x) { return Math.round(x).toString(8); },
      "p": function(x, p) { return formatRounded(x * 100, p); },
      "r": formatRounded,
      "s": formatPrefixAuto,
      "X": function(x) { return Math.round(x).toString(16).toUpperCase(); },
      "x": function(x) { return Math.round(x).toString(16); }
    };

    // [[fill]align][sign][symbol][0][width][,][.precision][type]
    var re = /^(?:(.)?([<>=^]))?([+\-\( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?([a-z%])?$/i;

    function formatSpecifier(specifier) {
      return new FormatSpecifier(specifier);
    }
    function FormatSpecifier(specifier) {
      if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);

      var match,
          fill = match[1] || " ",
          align = match[2] || ">",
          sign = match[3] || "-",
          symbol = match[4] || "",
          zero = !!match[5],
          width = match[6] && +match[6],
          comma = !!match[7],
          precision = match[8] && +match[8].slice(1),
          type = match[9] || "";

      // The "n" type is an alias for ",g".
      if (type === "n") comma = true, type = "g";

      // Map invalid types to the default format.
      else if (!formatTypes[type]) type = "";

      // If zero fill is specified, padding goes after sign and before digits.
      if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

      this.fill = fill;
      this.align = align;
      this.sign = sign;
      this.symbol = symbol;
      this.zero = zero;
      this.width = width;
      this.comma = comma;
      this.precision = precision;
      this.type = type;
    }

    FormatSpecifier.prototype.toString = function() {
      return this.fill
          + this.align
          + this.sign
          + this.symbol
          + (this.zero ? "0" : "")
          + (this.width == null ? "" : Math.max(1, this.width | 0))
          + (this.comma ? "," : "")
          + (this.precision == null ? "" : "." + Math.max(0, this.precision | 0))
          + this.type;
    };

    var prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

    function identity(x) {
      return x;
    }

    function locale(locale) {
      var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity,
          currency = locale.currency,
          decimal = locale.decimal;

      function format(specifier) {
        specifier = formatSpecifier(specifier);

        var fill = specifier.fill,
            align = specifier.align,
            sign = specifier.sign,
            symbol = specifier.symbol,
            zero = specifier.zero,
            width = specifier.width,
            comma = specifier.comma,
            precision = specifier.precision,
            type = specifier.type;

        // Compute the prefix and suffix.
        // For SI-prefix, the suffix is lazily computed.
        var prefix = symbol === "$" ? currency[0] : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
            suffix = symbol === "$" ? currency[1] : /[%p]/.test(type) ? "%" : "";

        // What format function should we use?
        // Is this an integer type?
        // Can this type generate exponential notation?
        var formatType = formatTypes[type],
            maybeSuffix = !type || /[defgprs%]/.test(type);

        // Set the default precision if not specified,
        // or clamp the specified precision to the supported range.
        // For significant precision, it must be in [1, 21].
        // For fixed precision, it must be in [0, 20].
        precision = precision == null ? (type ? 6 : 12)
            : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
            : Math.max(0, Math.min(20, precision));

        return function(value) {
          var valuePrefix = prefix,
              valueSuffix = suffix;

          if (type === "c") {
            valueSuffix = formatType(value) + valueSuffix;
            value = "";
          } else {
            value = +value;

            // Convert negative to positive, and compute the prefix.
            // Note that -0 is not less than 0, but 1 / -0 is!
            var valueNegative = (value < 0 || 1 / value < 0) && (value *= -1, true);

            // Perform the initial formatting.
            value = formatType(value, precision);

            // If the original value was negative, it may be rounded to zero during
            // formatting; treat this as (positive) zero.
            if (valueNegative) {
              var i = -1, n = value.length, c;
              valueNegative = false;
              while (++i < n) {
                if (c = value.charCodeAt(i), (48 < c && c < 58)
                    || (type === "x" && 96 < c && c < 103)
                    || (type === "X" && 64 < c && c < 71)) {
                  valueNegative = true;
                  break;
                }
              }
            }

            // Compute the prefix and suffix.
            valuePrefix = (valueNegative ? (sign === "(" ? sign : "-") : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
            valueSuffix = valueSuffix + (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + (valueNegative && sign === "(" ? ")" : "");

            // Break the formatted value into the integer “value” part that can be
            // grouped, and fractional or exponential “suffix” part that is not.
            if (maybeSuffix) {
              var i = -1, n = value.length, c;
              while (++i < n) {
                if (c = value.charCodeAt(i), 48 > c || c > 57) {
                  valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                  value = value.slice(0, i);
                  break;
                }
              }
            }
          }

          // If the fill character is not "0", grouping is applied before padding.
          if (comma && !zero) value = group(value, Infinity);

          // Compute the padding.
          var length = valuePrefix.length + value.length + valueSuffix.length,
              padding = length < width ? new Array(width - length + 1).join(fill) : "";

          // If the fill character is "0", grouping is applied after padding.
          if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

          // Reconstruct the final output based on the desired alignment.
          switch (align) {
            case "<": return valuePrefix + value + valueSuffix + padding;
            case "=": return valuePrefix + padding + value + valueSuffix;
            case "^": return padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
          }
          return padding + valuePrefix + value + valueSuffix;
        };
      }

      function formatPrefix(specifier, value) {
        var f = format((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
            e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
            k = Math.pow(10, -e),
            prefix = prefixes[8 + e / 3];
        return function(value) {
          return f(k * value) + prefix;
        };
      }

      return {
        format: format,
        formatPrefix: formatPrefix
      };
    }
    var defaultLocale = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["$", ""]
    });

    var caES = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["", "\xa0€"]
    });

    var csCZ = locale({
      decimal: ",",
      thousands: "\xa0",
      grouping: [3],
      currency: ["", "\xa0Kč"],
    });

    var deCH = locale({
      decimal: ",",
      thousands: "'",
      grouping: [3],
      currency: ["", "\xa0CHF"]
    });

    var deDE = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["", "\xa0€"]
    });

    var enCA = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["$", ""]
    });

    var enGB = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["£", ""]
    });

    var esES = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["", "\xa0€"]
    });

    var fiFI = locale({
      decimal: ",",
      thousands: "\xa0",
      grouping: [3],
      currency: ["", "\xa0€"]
    });

    var frCA = locale({
      decimal: ",",
      thousands: "\xa0",
      grouping: [3],
      currency: ["", "$"]
    });

    var frFR = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["", "\xa0€"]
    });

    var heIL = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["₪", ""]
    });

    var huHU = locale({
      decimal: ",",
      thousands: "\xa0",
      grouping: [3],
      currency: ["", "\xa0Ft"]
    });

    var itIT = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["€", ""]
    });

    var jaJP = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["", "円"]
    });

    var koKR = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["₩", ""]
    });

    var mkMK = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["", "\xa0ден."]
    });

    var nlNL = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["€\xa0", ""]
    });

    var plPL = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["", "zł"]
    });

    var ptBR = locale({
      decimal: ",",
      thousands: ".",
      grouping: [3],
      currency: ["R$", ""]
    });

    var ruRU = locale({
      decimal: ",",
      thousands: "\xa0",
      grouping: [3],
      currency: ["", "\xa0руб."]
    });

    var svSE = locale({
      decimal: ",",
      thousands: "\xa0",
      grouping: [3],
      currency: ["", "SEK"]
    });

    var zhCN = locale({
      decimal: ".",
      thousands: ",",
      grouping: [3],
      currency: ["¥", ""]
    });

    function precisionFixed(step) {
      return Math.max(0, -exponent(Math.abs(step)));
    }
    function precisionPrefix(step, value) {
      return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
    }
    function precisionRound(step, max) {
      step = Math.abs(step), max = Math.abs(max) - step;
      return Math.max(0, exponent(max) - exponent(step)) + 1;
    }
    var format = defaultLocale.format;
    var formatPrefix = defaultLocale.formatPrefix;

    var version = "0.4.2";

    exports.version = version;
    exports.format = format;
    exports.formatPrefix = formatPrefix;
    exports.locale = locale;
    exports.localeCaEs = caES;
    exports.localeCsCz = csCZ;
    exports.localeDeCh = deCH;
    exports.localeDeDe = deDE;
    exports.localeEnCa = enCA;
    exports.localeEnGb = enGB;
    exports.localeEnUs = defaultLocale;
    exports.localeEsEs = esES;
    exports.localeFiFi = fiFI;
    exports.localeFrCa = frCA;
    exports.localeFrFr = frFR;
    exports.localeHeIl = heIL;
    exports.localeHuHu = huHU;
    exports.localeItIt = itIT;
    exports.localeJaJp = jaJP;
    exports.localeKoKr = koKR;
    exports.localeMkMk = mkMK;
    exports.localeNlNl = nlNL;
    exports.localePlPl = plPL;
    exports.localePtBr = ptBR;
    exports.localeRuRu = ruRU;
    exports.localeSvSe = svSE;
    exports.localeZhCn = zhCN;
    exports.formatSpecifier = formatSpecifier;
    exports.precisionFixed = precisionFixed;
    exports.precisionPrefix = precisionPrefix;
    exports.precisionRound = precisionRound;

  }));
  });

  var numberF = d3Format, // defaults to EN-US
      timeF = d3TimeFormat,     // defaults to EN-US
      tmpDate = new Date(2000, 0, 1),
      monthFull, monthAbbr, dayFull, dayAbbr;


  var format = {
    // Update number formatter to use provided locale configuration.
    // For more see https://github.com/d3/d3-format
    numberLocale: numberLocale,
    number:       function(f) { return numberF.format(f); },
    numberPrefix: function(f, v) { return numberF.formatPrefix(f, v); },

    // Update time formatter to use provided locale configuration.
    // For more see https://github.com/d3/d3-time-format
    timeLocale:   timeLocale,
    time:         function(f) { return timeF.format(f); },
    utc:          function(f) { return timeF.utcFormat(f); },

    // Set number and time locale simultaneously.
    locale:       function(l) { numberLocale(l); timeLocale(l); },

    // automatic formatting functions
    auto: {
      number:   autoNumberFormat,
      linear:   linearNumberFormat,
      time:     function() { return timeAutoFormat(); },
      utc:      function() { return utcAutoFormat(); }
    },

    month:      monthFormat,      // format month name from integer code
    day:        dayFormat,        // format week day name from integer code
    quarter:    quarterFormat,    // format quarter name from timestamp
    utcQuarter: utcQuarterFormat  // format quarter name from utc timestamp
  };

  // -- Locales ----

  // transform 'en-US' style locale string to match d3-format v0.4+ convention
  function localeRef(l) {
    return l.length > 4 && 'locale' + (
      l[0].toUpperCase() + l[1].toLowerCase() +
      l[3].toUpperCase() + l[4].toLowerCase()
    );
  }

  function numberLocale(l) {
    var f = util.isString(l) ? d3Format[localeRef(l)] : d3Format.locale(l);
    if (f == null) throw Error('Unrecognized locale: ' + l);
    numberF = f;
  }

  function timeLocale(l) {
    var f = util.isString(l) ? d3TimeFormat[localeRef(l)] : d3TimeFormat.locale(l);
    if (f == null) throw Error('Unrecognized locale: ' + l);
    timeF = f;
    monthFull = monthAbbr = dayFull = dayAbbr = null;
  }

  // -- Number Formatting ----

  var e10 = Math.sqrt(50),
      e5 = Math.sqrt(10),
      e2 = Math.sqrt(2);

  function linearRange(domain, count) {
    if (!domain.length) domain = [0];
    if (count == null) count = 10;

    var start = domain[0],
        stop = domain[domain.length - 1];

    if (stop < start) { error = stop; stop = start; start = error; }

    var span = (stop - start) || (count = 1, start || stop || 1),
        step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10)),
        error = span / count / step;

    // Filter ticks to get closer to the desired count.
    if (error >= e10) step *= 10;
    else if (error >= e5) step *= 5;
    else if (error >= e2) step *= 2;

    // Round start and stop values to step interval.
    return [
      Math.ceil(start / step) * step,
      Math.floor(stop / step) * step + step / 2, // inclusive
      step
    ];
  }

  function trimZero(f, decimal) {
    return function(x) {
      var s = f(x),
          n = s.indexOf(decimal);
      if (n < 0) return s;

      var idx = rightmostDigit(s, n),
          end = idx < s.length ? s.slice(idx) : '';

      while (--idx > n) {
        if (s[idx] !== '0') { ++idx; break; }
      }
      return s.slice(0, idx) + end;
    };
  }

  function rightmostDigit(s, n) {
    var i = s.lastIndexOf('e'), c;
    if (i > 0) return i;
    for (i=s.length; --i > n;) {
      c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) return i+1; // is digit
    }
  }

  function autoNumberFormat(f) {
    var decimal = numberF.format('.1f')(1)[1]; // get decimal char
    if (f == null) f = ',';
    f = d3Format.formatSpecifier(f);
    if (f.precision == null) f.precision = 12;
    switch (f.type) {
      case '%': f.precision -= 2; break;
      case 'e': f.precision -= 1; break;
    }
    return trimZero(numberF.format(f), decimal);
  }

  function linearNumberFormat(domain, count, f) {
    var range = linearRange(domain, count);

    if (f == null) f = ',f';

    switch (f = d3Format.formatSpecifier(f), f.type) {
      case 's': {
        var value = Math.max(Math.abs(range[0]), Math.abs(range[1]));
        if (f.precision == null) f.precision = d3Format.precisionPrefix(range[2], value);
        return numberF.formatPrefix(f, value);
      }
      case '':
      case 'e':
      case 'g':
      case 'p':
      case 'r': {
        if (f.precision == null) f.precision = d3Format.precisionRound(range[2], Math.max(Math.abs(range[0]), Math.abs(range[1]))) - (f.type === 'e');
        break;
      }
      case 'f':
      case '%': {
        if (f.precision == null) f.precision = d3Format.precisionFixed(range[2]) - 2 * (f.type === '%');
        break;
      }
    }
    return numberF.format(f);
  }

  // -- Datetime Formatting ----

  function timeAutoFormat() {
    var f = timeF.format,
        formatMillisecond = f('.%L'),
        formatSecond = f(':%S'),
        formatMinute = f('%I:%M'),
        formatHour = f('%I %p'),
        formatDay = f('%a %d'),
        formatWeek = f('%b %d'),
        formatMonth = f('%B'),
        formatYear = f('%Y');

    return function(date) {
      var d = +date;
      return (d3Time.second(date) < d ? formatMillisecond
          : d3Time.minute(date) < d ? formatSecond
          : d3Time.hour(date) < d ? formatMinute
          : d3Time.day(date) < d ? formatHour
          : d3Time.month(date) < d ?
            (d3Time.week(date) < d ? formatDay : formatWeek)
          : d3Time.year(date) < d ? formatMonth
          : formatYear)(date);
    };
  }

  function utcAutoFormat() {
    var f = timeF.utcFormat,
        formatMillisecond = f('.%L'),
        formatSecond = f(':%S'),
        formatMinute = f('%I:%M'),
        formatHour = f('%I %p'),
        formatDay = f('%a %d'),
        formatWeek = f('%b %d'),
        formatMonth = f('%B'),
        formatYear = f('%Y');

    return function(date) {
      var d = +date;
      return (d3Time.utcSecond(date) < d ? formatMillisecond
          : d3Time.utcMinute(date) < d ? formatSecond
          : d3Time.utcHour(date) < d ? formatMinute
          : d3Time.utcDay(date) < d ? formatHour
          : d3Time.utcMonth(date) < d ?
            (d3Time.utcWeek(date) < d ? formatDay : formatWeek)
          : d3Time.utcYear(date) < d ? formatMonth
          : formatYear)(date);
    };
  }

  function monthFormat(month, abbreviate) {
    var f = abbreviate ?
      (monthAbbr || (monthAbbr = timeF.format('%b'))) :
      (monthFull || (monthFull = timeF.format('%B')));
    return (tmpDate.setMonth(month), f(tmpDate));
  }

  function dayFormat(day, abbreviate) {
    var f = abbreviate ?
      (dayAbbr || (dayAbbr = timeF.format('%a'))) :
      (dayFull || (dayFull = timeF.format('%A')));
    return (tmpDate.setMonth(0), tmpDate.setDate(2 + day), f(tmpDate));
  }

  function quarterFormat(date) {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  function utcQuarterFormat(date) {
    return Math.floor(date.getUTCMonth() / 3) + 1;
  }

  var timeF$1 = format.time;

  function read$1(data, format$$1) {
    var type = (format$$1 && format$$1.type) || 'json';
    data = formats[type](data, format$$1);
    if (format$$1 && format$$1.parse) parse(data, format$$1.parse);
    return data;
  }

  function parse(data, types) {
    var cols, parsers, d, i, j, clen, len = data.length;

    types = (types==='auto') ? type_1.inferAll(data) : util.duplicate(types);
    cols = util.keys(types);
    parsers = cols.map(function(c) {
      var t = types[c];
      if (t && t.indexOf('date:') === 0) {
        var parts = t.split(/:(.+)?/, 2),  // split on first :
            pattern = parts[1];
        if ((pattern[0] === '\'' && pattern[pattern.length-1] === '\'') ||
            (pattern[0] === '"'  && pattern[pattern.length-1] === '"')) {
          pattern = pattern.slice(1, -1);
        } else {
          throw Error('Format pattern must be quoted: ' + pattern);
        }
        pattern = timeF$1(pattern);
        return function(v) { return pattern.parse(v); };
      }
      if (!type_1.parsers[t]) {
        throw Error('Illegal format pattern: ' + c + ':' + t);
      }
      return type_1.parsers[t];
    });

    for (i=0, clen=cols.length; i<len; ++i) {
      d = data[i];
      for (j=0; j<clen; ++j) {
        d[cols[j]] = parsers[j](d[cols[j]]);
      }
    }
    type_1.annotation(data, types);
  }

  read$1.formats = formats;
  var read_1 = read$1;

  var generate = createCommonjsModule(function (module) {
  var gen = module.exports;

  gen.repeat = function(val, n) {
    var a = Array(n), i;
    for (i=0; i<n; ++i) a[i] = val;
    return a;
  };

  gen.zeros = function(n) {
    return gen.repeat(0, n);
  };

  gen.range = function(start, stop, step) {
    if (arguments.length < 3) {
      step = 1;
      if (arguments.length < 2) {
        stop = start;
        start = 0;
      }
    }
    if ((stop - start) / step == Infinity) throw new Error('Infinite range');
    var range = [], i = -1, j;
    if (step < 0) while ((j = start + step * ++i) > stop) range.push(j);
    else while ((j = start + step * ++i) < stop) range.push(j);
    return range;
  };

  gen.random = {};

  gen.random.uniform = function(min, max) {
    if (max === undefined) {
      max = min === undefined ? 1 : min;
      min = 0;
    }
    var d = max - min;
    var f = function() {
      return min + d * Math.random();
    };
    f.samples = function(n) {
      return gen.zeros(n).map(f);
    };
    f.pdf = function(x) {
      return (x >= min && x <= max) ? 1/d : 0;
    };
    f.cdf = function(x) {
      return x < min ? 0 : x > max ? 1 : (x - min) / d;
    };
    f.icdf = function(p) {
      return (p >= 0 && p <= 1) ? min + p*d : NaN;
    };
    return f;
  };

  gen.random.integer = function(a, b) {
    if (b === undefined) {
      b = a;
      a = 0;
    }
    var d = b - a;
    var f = function() {
      return a + Math.floor(d * Math.random());
    };
    f.samples = function(n) {
      return gen.zeros(n).map(f);
    };
    f.pdf = function(x) {
      return (x === Math.floor(x) && x >= a && x < b) ? 1/d : 0;
    };
    f.cdf = function(x) {
      var v = Math.floor(x);
      return v < a ? 0 : v >= b ? 1 : (v - a + 1) / d;
    };
    f.icdf = function(p) {
      return (p >= 0 && p <= 1) ? a - 1 + Math.floor(p*d) : NaN;
    };
    return f;
  };

  gen.random.normal = function(mean, stdev) {
    mean = mean || 0;
    stdev = stdev || 1;
    var next;
    var f = function() {
      var x = 0, y = 0, rds, c;
      if (next !== undefined) {
        x = next;
        next = undefined;
        return x;
      }
      do {
        x = Math.random()*2-1;
        y = Math.random()*2-1;
        rds = x*x + y*y;
      } while (rds === 0 || rds > 1);
      c = Math.sqrt(-2*Math.log(rds)/rds); // Box-Muller transform
      next = mean + y*c*stdev;
      return mean + x*c*stdev;
    };
    f.samples = function(n) {
      return gen.zeros(n).map(f);
    };
    f.pdf = function(x) {
      var exp = Math.exp(Math.pow(x-mean, 2) / (-2 * Math.pow(stdev, 2)));
      return (1 / (stdev * Math.sqrt(2*Math.PI))) * exp;
    };
    f.cdf = function(x) {
      // Approximation from West (2009)
      // Better Approximations to Cumulative Normal Functions
      var cd,
          z = (x - mean) / stdev,
          Z = Math.abs(z);
      if (Z > 37) {
        cd = 0;
      } else {
        var sum, exp = Math.exp(-Z*Z/2);
        if (Z < 7.07106781186547) {
          sum = 3.52624965998911e-02 * Z + 0.700383064443688;
          sum = sum * Z + 6.37396220353165;
          sum = sum * Z + 33.912866078383;
          sum = sum * Z + 112.079291497871;
          sum = sum * Z + 221.213596169931;
          sum = sum * Z + 220.206867912376;
          cd = exp * sum;
          sum = 8.83883476483184e-02 * Z + 1.75566716318264;
          sum = sum * Z + 16.064177579207;
          sum = sum * Z + 86.7807322029461;
          sum = sum * Z + 296.564248779674;
          sum = sum * Z + 637.333633378831;
          sum = sum * Z + 793.826512519948;
          sum = sum * Z + 440.413735824752;
          cd = cd / sum;
        } else {
          sum = Z + 0.65;
          sum = Z + 4 / sum;
          sum = Z + 3 / sum;
          sum = Z + 2 / sum;
          sum = Z + 1 / sum;
          cd = exp / sum / 2.506628274631;
        }
      }
      return z > 0 ? 1 - cd : cd;
    };
    f.icdf = function(p) {
      // Approximation of Probit function using inverse error function.
      if (p <= 0 || p >= 1) return NaN;
      var x = 2*p - 1,
          v = (8 * (Math.PI - 3)) / (3 * Math.PI * (4-Math.PI)),
          a = (2 / (Math.PI*v)) + (Math.log(1 - Math.pow(x,2)) / 2),
          b = Math.log(1 - (x*x)) / v,
          s = (x > 0 ? 1 : -1) * Math.sqrt(Math.sqrt((a*a) - b) - a);
      return mean + stdev * Math.SQRT2 * s;
    };
    return f;
  };

  gen.random.bootstrap = function(domain, smooth) {
    // Generates a bootstrap sample from a set of observations.
    // Smooth bootstrapping adds random zero-centered noise to the samples.
    var val = domain.filter(util.isValid),
        len = val.length,
        err = smooth ? gen.random.normal(0, smooth) : null;
    var f = function() {
      return val[~~(Math.random()*len)] + (err ? err() : 0);
    };
    f.samples = function(n) {
      return gen.zeros(n).map(f);
    };
    return f;
  };
  });

  var stats_1 = createCommonjsModule(function (module) {
  var stats = module.exports;

  // Collect unique values.
  // Output: an array of unique values, in first-observed order
  stats.unique = function(values, f, results) {
    f = util.$(f);
    results = results || [];
    var u = {}, v, i, n;
    for (i=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (v in u) continue;
      u[v] = 1;
      results.push(v);
    }
    return results;
  };

  // Return the length of the input array.
  stats.count = function(values) {
    return values && values.length || 0;
  };

  // Count the number of non-null, non-undefined, non-NaN values.
  stats.count.valid = function(values, f) {
    f = util.$(f);
    var v, i, n, valid = 0;
    for (i=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) valid += 1;
    }
    return valid;
  };

  // Count the number of null or undefined values.
  stats.count.missing = function(values, f) {
    f = util.$(f);
    var v, i, n, count = 0;
    for (i=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (v == null) count += 1;
    }
    return count;
  };

  // Count the number of distinct values.
  // Null, undefined and NaN are each considered distinct values.
  stats.count.distinct = function(values, f) {
    f = util.$(f);
    var u = {}, v, i, n, count = 0;
    for (i=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (v in u) continue;
      u[v] = 1;
      count += 1;
    }
    return count;
  };

  // Construct a map from distinct values to occurrence counts.
  stats.count.map = function(values, f) {
    f = util.$(f);
    var map = {}, v, i, n;
    for (i=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      map[v] = (v in map) ? map[v] + 1 : 1;
    }
    return map;
  };

  // Compute the median of an array of numbers.
  stats.median = function(values, f) {
    if (f) values = values.map(util.$(f));
    values = values.filter(util.isValid).sort(util.cmp);
    return stats.quantile(values, 0.5);
  };

  // Computes the quartile boundaries of an array of numbers.
  stats.quartile = function(values, f) {
    if (f) values = values.map(util.$(f));
    values = values.filter(util.isValid).sort(util.cmp);
    var q = stats.quantile;
    return [q(values, 0.25), q(values, 0.50), q(values, 0.75)];
  };

  // Compute the quantile of a sorted array of numbers.
  // Adapted from the D3.js implementation.
  stats.quantile = function(values, f, p) {
    if (p === undefined) { p = f; f = util.identity; }
    f = util.$(f);
    var H = (values.length - 1) * p + 1,
        h = Math.floor(H),
        v = +f(values[h - 1]),
        e = H - h;
    return e ? v + e * (f(values[h]) - v) : v;
  };

  // Compute the sum of an array of numbers.
  stats.sum = function(values, f) {
    f = util.$(f);
    for (var sum=0, i=0, n=values.length, v; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) sum += v;
    }
    return sum;
  };

  // Compute the mean (average) of an array of numbers.
  stats.mean = function(values, f) {
    f = util.$(f);
    var mean = 0, delta, i, n, c, v;
    for (i=0, c=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        delta = v - mean;
        mean = mean + delta / (++c);
      }
    }
    return mean;
  };

  // Compute the geometric mean of an array of numbers.
  stats.mean.geometric = function(values, f) {
    f = util.$(f);
    var mean = 1, c, n, v, i;
    for (i=0, c=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        if (v <= 0) {
          throw Error("Geometric mean only defined for positive values.");
        }
        mean *= v;
        ++c;
      }
    }
    mean = c > 0 ? Math.pow(mean, 1/c) : 0;
    return mean;
  };

  // Compute the harmonic mean of an array of numbers.
  stats.mean.harmonic = function(values, f) {
    f = util.$(f);
    var mean = 0, c, n, v, i;
    for (i=0, c=0, n=values.length; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        mean += 1/v;
        ++c;
      }
    }
    return c / mean;
  };

  // Compute the sample variance of an array of numbers.
  stats.variance = function(values, f) {
    f = util.$(f);
    if (!util.isArray(values) || values.length < 2) return 0;
    var mean = 0, M2 = 0, delta, i, c, v;
    for (i=0, c=0; i<values.length; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        delta = v - mean;
        mean = mean + delta / (++c);
        M2 = M2 + delta * (v - mean);
      }
    }
    M2 = M2 / (c - 1);
    return M2;
  };

  // Compute the sample standard deviation of an array of numbers.
  stats.stdev = function(values, f) {
    return Math.sqrt(stats.variance(values, f));
  };

  // Compute the Pearson mode skewness ((median-mean)/stdev) of an array of numbers.
  stats.modeskew = function(values, f) {
    var avg = stats.mean(values, f),
        med = stats.median(values, f),
        std = stats.stdev(values, f);
    return std === 0 ? 0 : (avg - med) / std;
  };

  // Find the minimum value in an array.
  stats.min = function(values, f) {
    return stats.extent(values, f)[0];
  };

  // Find the maximum value in an array.
  stats.max = function(values, f) {
    return stats.extent(values, f)[1];
  };

  // Find the minimum and maximum of an array of values.
  stats.extent = function(values, f) {
    f = util.$(f);
    var a, b, v, i, n = values.length;
    for (i=0; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) { a = b = v; break; }
    }
    for (; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        if (v < a) a = v;
        if (v > b) b = v;
      }
    }
    return [a, b];
  };

  // Find the integer indices of the minimum and maximum values.
  stats.extent.index = function(values, f) {
    f = util.$(f);
    var x = -1, y = -1, a, b, v, i, n = values.length;
    for (i=0; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) { a = b = v; x = y = i; break; }
    }
    for (; i<n; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        if (v < a) { a = v; x = i; }
        if (v > b) { b = v; y = i; }
      }
    }
    return [x, y];
  };

  // Compute the dot product of two arrays of numbers.
  stats.dot = function(values, a, b) {
    var sum = 0, i, v;
    if (!b) {
      if (values.length !== a.length) {
        throw Error('Array lengths must match.');
      }
      for (i=0; i<values.length; ++i) {
        v = values[i] * a[i];
        if (v === v) sum += v;
      }
    } else {
      a = util.$(a);
      b = util.$(b);
      for (i=0; i<values.length; ++i) {
        v = a(values[i]) * b(values[i]);
        if (v === v) sum += v;
      }
    }
    return sum;
  };

  // Compute the vector distance between two arrays of numbers.
  // Default is Euclidean (exp=2) distance, configurable via exp argument.
  stats.dist = function(values, a, b, exp) {
    var f = util.isFunction(b) || util.isString(b),
        X = values,
        Y = f ? values : a,
        e = f ? exp : b,
        L2 = e === 2 || e == null,
        n = values.length, s = 0, d, i;
    if (f) {
      a = util.$(a);
      b = util.$(b);
    }
    for (i=0; i<n; ++i) {
      d = f ? (a(X[i])-b(Y[i])) : (X[i]-Y[i]);
      s += L2 ? d*d : Math.pow(Math.abs(d), e);
    }
    return L2 ? Math.sqrt(s) : Math.pow(s, 1/e);
  };

  // Compute the Cohen's d effect size between two arrays of numbers.
  stats.cohensd = function(values, a, b) {
    var X = b ? values.map(util.$(a)) : values,
        Y = b ? values.map(util.$(b)) : a,
        x1 = stats.mean(X),
        x2 = stats.mean(Y),
        n1 = stats.count.valid(X),
        n2 = stats.count.valid(Y);

    if ((n1+n2-2) <= 0) {
      // if both arrays are size 1, or one is empty, there's no effect size
      return 0;
    }
    // pool standard deviation
    var s1 = stats.variance(X),
        s2 = stats.variance(Y),
        s = Math.sqrt((((n1-1)*s1) + ((n2-1)*s2)) / (n1+n2-2));
    // if there is no variance, there's no effect size
    return s===0 ? 0 : (x1 - x2) / s;
  };

  // Computes the covariance between two arrays of numbers
  stats.covariance = function(values, a, b) {
    var X = b ? values.map(util.$(a)) : values,
        Y = b ? values.map(util.$(b)) : a,
        n = X.length,
        xm = stats.mean(X),
        ym = stats.mean(Y),
        sum = 0, c = 0, i, x, y, vx, vy;

    if (n !== Y.length) {
      throw Error('Input lengths must match.');
    }

    for (i=0; i<n; ++i) {
      x = X[i]; vx = util.isValid(x);
      y = Y[i]; vy = util.isValid(y);
      if (vx && vy) {
        sum += (x-xm) * (y-ym);
        ++c;
      } else if (vx || vy) {
        throw Error('Valid values must align.');
      }
    }
    return sum / (c-1);
  };

  // Compute ascending rank scores for an array of values.
  // Ties are assigned their collective mean rank.
  stats.rank = function(values, f) {
    f = util.$(f) || util.identity;
    var a = values.map(function(v, i) {
        return {idx: i, val: f(v)};
      })
      .sort(util.comparator('val'));

    var n = values.length,
        r = Array(n),
        tie = -1, p = {}, i, v, mu;

    for (i=0; i<n; ++i) {
      v = a[i].val;
      if (tie < 0 && p === v) {
        tie = i - 1;
      } else if (tie > -1 && p !== v) {
        mu = 1 + (i-1 + tie) / 2;
        for (; tie<i; ++tie) r[a[tie].idx] = mu;
        tie = -1;
      }
      r[a[i].idx] = i + 1;
      p = v;
    }

    if (tie > -1) {
      mu = 1 + (n-1 + tie) / 2;
      for (; tie<n; ++tie) r[a[tie].idx] = mu;
    }

    return r;
  };

  // Compute the sample Pearson product-moment correlation of two arrays of numbers.
  stats.cor = function(values, a, b) {
    var fn = b;
    b = fn ? values.map(util.$(b)) : a;
    a = fn ? values.map(util.$(a)) : values;

    var dot = stats.dot(a, b),
        mua = stats.mean(a),
        mub = stats.mean(b),
        sda = stats.stdev(a),
        sdb = stats.stdev(b),
        n = values.length;

    return (dot - n*mua*mub) / ((n-1) * sda * sdb);
  };

  // Compute the Spearman rank correlation of two arrays of values.
  stats.cor.rank = function(values, a, b) {
    var ra = b ? stats.rank(values, a) : stats.rank(values),
        rb = b ? stats.rank(values, b) : stats.rank(a),
        n = values.length, i, s, d;

    for (i=0, s=0; i<n; ++i) {
      d = ra[i] - rb[i];
      s += d * d;
    }

    return 1 - 6*s / (n * (n*n-1));
  };

  // Compute the distance correlation of two arrays of numbers.
  // http://en.wikipedia.org/wiki/Distance_correlation
  stats.cor.dist = function(values, a, b) {
    var X = b ? values.map(util.$(a)) : values,
        Y = b ? values.map(util.$(b)) : a;

    var A = stats.dist.mat(X),
        B = stats.dist.mat(Y),
        n = A.length,
        i, aa, bb, ab;

    for (i=0, aa=0, bb=0, ab=0; i<n; ++i) {
      aa += A[i]*A[i];
      bb += B[i]*B[i];
      ab += A[i]*B[i];
    }

    return Math.sqrt(ab / Math.sqrt(aa*bb));
  };

  // Simple linear regression.
  // Returns a "fit" object with slope (m), intercept (b),
  // r value (R), and sum-squared residual error (rss).
  stats.linearRegression = function(values, a, b) {
    var X = b ? values.map(util.$(a)) : values,
        Y = b ? values.map(util.$(b)) : a,
        n = X.length,
        xy = stats.covariance(X, Y), // will throw err if valid vals don't align
        sx = stats.stdev(X),
        sy = stats.stdev(Y),
        slope = xy / (sx*sx),
        icept = stats.mean(Y) - slope * stats.mean(X),
        fit = {slope: slope, intercept: icept, R: xy / (sx*sy), rss: 0},
        res, i;

    for (i=0; i<n; ++i) {
      if (util.isValid(X[i]) && util.isValid(Y[i])) {
        res = (slope*X[i] + icept) - Y[i];
        fit.rss += res * res;
      }
    }

    return fit;
  };

  // Namespace for bootstrap
  stats.bootstrap = {};

  // Construct a bootstrapped confidence interval at a given percentile level
  // Arguments are an array, an optional n (defaults to 1000),
  //  an optional alpha (defaults to 0.05), and an optional smoothing parameter
  stats.bootstrap.ci = function(values, a, b, c, d) {
    var X, N, alpha, smooth, bs, means, i;
    if (util.isFunction(a) || util.isString(a)) {
      X = values.map(util.$(a));
      N = b;
      alpha = c;
      smooth = d;
    } else {
      X = values;
      N = a;
      alpha = b;
      smooth = c;
    }
    N = N ? +N : 1000;
    alpha = alpha || 0.05;

    bs = generate.random.bootstrap(X, smooth);
    for (i=0, means = Array(N); i<N; ++i) {
      means[i] = stats.mean(bs.samples(X.length));
    }
    means.sort(util.numcmp);
    return [
      stats.quantile(means, alpha/2),
      stats.quantile(means, 1-(alpha/2))
    ];
  };

  // Namespace for z-tests
  stats.z = {};

  // Construct a z-confidence interval at a given significance level
  // Arguments are an array and an optional alpha (defaults to 0.05).
  stats.z.ci = function(values, a, b) {
    var X = values, alpha = a;
    if (util.isFunction(a) || util.isString(a)) {
      X = values.map(util.$(a));
      alpha = b;
    }
    alpha = alpha || 0.05;

    var z = alpha===0.05 ? 1.96 : generate.random.normal(0, 1).icdf(1-(alpha/2)),
        mu = stats.mean(X),
        SE = stats.stdev(X) / Math.sqrt(stats.count.valid(X));
    return [mu - (z*SE), mu + (z*SE)];
  };

  // Perform a z-test of means. Returns the p-value.
  // If a single array is provided, performs a one-sample location test.
  // If two arrays or a table and two accessors are provided, performs
  // a two-sample location test. A paired test is performed if specified
  // by the options hash.
  // The options hash format is: {paired: boolean, nullh: number}.
  // http://en.wikipedia.org/wiki/Z-test
  // http://en.wikipedia.org/wiki/Paired_difference_test
  stats.z.test = function(values, a, b, opt) {
    if (util.isFunction(b) || util.isString(b)) { // table and accessors
      return (opt && opt.paired ? ztestP : ztest2)(opt, values, a, b);
    } else if (util.isArray(a)) { // two arrays
      return (b && b.paired ? ztestP : ztest2)(b, values, a);
    } else if (util.isFunction(a) || util.isString(a)) {
      return ztest1(b, values, a); // table and accessor
    } else {
      return ztest1(a, values); // one array
    }
  };

  // Perform a z-test of means. Returns the p-value.
  // Assuming we have a list of values, and a null hypothesis. If no null
  // hypothesis, assume our null hypothesis is mu=0.
  function ztest1(opt, X, f) {
    var nullH = opt && opt.nullh || 0,
        gaussian = generate.random.normal(0, 1),
        mu = stats.mean(X,f),
        SE = stats.stdev(X,f) / Math.sqrt(stats.count.valid(X,f));

    if (SE===0) {
      // Test not well defined when standard error is 0.
      return (mu - nullH) === 0 ? 1 : 0;
    }
    // Two-sided, so twice the one-sided cdf.
    var z = (mu - nullH) / SE;
    return 2 * gaussian.cdf(-Math.abs(z));
  }

  // Perform a two sample paired z-test of means. Returns the p-value.
  function ztestP(opt, values, a, b) {
    var X = b ? values.map(util.$(a)) : values,
        Y = b ? values.map(util.$(b)) : a,
        n1 = stats.count(X),
        n2 = stats.count(Y),
        diffs = Array(), i;

    if (n1 !== n2) {
      throw Error('Array lengths must match.');
    }
    for (i=0; i<n1; ++i) {
      // Only valid differences should contribute to the test statistic
      if (util.isValid(X[i]) && util.isValid(Y[i])) {
        diffs.push(X[i] - Y[i]);
      }
    }
    return stats.z.test(diffs, opt && opt.nullh || 0);
  }

  // Perform a two sample z-test of means. Returns the p-value.
  function ztest2(opt, values, a, b) {
    var X = b ? values.map(util.$(a)) : values,
        Y = b ? values.map(util.$(b)) : a,
        n1 = stats.count.valid(X),
        n2 = stats.count.valid(Y),
        gaussian = generate.random.normal(0, 1),
        meanDiff = stats.mean(X) - stats.mean(Y) - (opt && opt.nullh || 0),
        SE = Math.sqrt(stats.variance(X)/n1 + stats.variance(Y)/n2);

    if (SE===0) {
      // Not well defined when pooled standard error is 0.
      return meanDiff===0 ? 1 : 0;
    }
    // Two-tailed, so twice the one-sided cdf.
    var z = meanDiff / SE;
    return 2 * gaussian.cdf(-Math.abs(z));
  }

  // Construct a mean-centered distance matrix for an array of numbers.
  stats.dist.mat = function(X) {
    var n = X.length,
        m = n*n,
        A = Array(m),
        R = generate.zeros(n),
        M = 0, v, i, j;

    for (i=0; i<n; ++i) {
      A[i*n+i] = 0;
      for (j=i+1; j<n; ++j) {
        A[i*n+j] = (v = Math.abs(X[i] - X[j]));
        A[j*n+i] = v;
        R[i] += v;
        R[j] += v;
      }
    }

    for (i=0; i<n; ++i) {
      M += R[i];
      R[i] /= n;
    }
    M /= m;

    for (i=0; i<n; ++i) {
      for (j=i; j<n; ++j) {
        A[i*n+j] += M - R[i] - R[j];
        A[j*n+i] = A[i*n+j];
      }
    }

    return A;
  };

  // Compute the Shannon entropy (log base 2) of an array of counts.
  stats.entropy = function(counts, f) {
    f = util.$(f);
    var i, p, s = 0, H = 0, n = counts.length;
    for (i=0; i<n; ++i) {
      s += (f ? f(counts[i]) : counts[i]);
    }
    if (s === 0) return 0;
    for (i=0; i<n; ++i) {
      p = (f ? f(counts[i]) : counts[i]) / s;
      if (p) H += p * Math.log(p);
    }
    return -H / Math.LN2;
  };

  // Compute the mutual information between two discrete variables.
  // Returns an array of the form [MI, MI_distance]
  // MI_distance is defined as 1 - I(a,b) / H(a,b).
  // http://en.wikipedia.org/wiki/Mutual_information
  stats.mutual = function(values, a, b, counts) {
    var x = counts ? values.map(util.$(a)) : values,
        y = counts ? values.map(util.$(b)) : a,
        z = counts ? values.map(util.$(counts)) : b;

    var px = {},
        py = {},
        n = z.length,
        s = 0, I = 0, H = 0, p, t, i;

    for (i=0; i<n; ++i) {
      px[x[i]] = 0;
      py[y[i]] = 0;
    }

    for (i=0; i<n; ++i) {
      px[x[i]] += z[i];
      py[y[i]] += z[i];
      s += z[i];
    }

    t = 1 / (s * Math.LN2);
    for (i=0; i<n; ++i) {
      if (z[i] === 0) continue;
      p = (s * z[i]) / (px[x[i]] * py[y[i]]);
      I += z[i] * t * Math.log(p);
      H += z[i] * t * Math.log(z[i]/s);
    }

    return [I, 1 + I/H];
  };

  // Compute the mutual information between two discrete variables.
  stats.mutual.info = function(values, a, b, counts) {
    return stats.mutual(values, a, b, counts)[0];
  };

  // Compute the mutual information distance between two discrete variables.
  // MI_distance is defined as 1 - I(a,b) / H(a,b).
  stats.mutual.dist = function(values, a, b, counts) {
    return stats.mutual(values, a, b, counts)[1];
  };

  // Compute a profile of summary statistics for a variable.
  stats.profile = function(values, f) {
    var mean = 0,
        valid = 0,
        missing = 0,
        distinct = 0,
        min = null,
        max = null,
        M2 = 0,
        vals = [],
        u = {}, delta, sd, i, v, x;

    // compute summary stats
    for (i=0; i<values.length; ++i) {
      v = f ? f(values[i]) : values[i];

      // update unique values
      u[v] = (v in u) ? u[v] + 1 : (distinct += 1, 1);

      if (v == null) {
        ++missing;
      } else if (util.isValid(v)) {
        // update stats
        x = (typeof v === 'string') ? v.length : v;
        if (min===null || x < min) min = x;
        if (max===null || x > max) max = x;
        delta = x - mean;
        mean = mean + delta / (++valid);
        M2 = M2 + delta * (x - mean);
        vals.push(x);
      }
    }
    M2 = M2 / (valid - 1);
    sd = Math.sqrt(M2);

    // sort values for median and iqr
    vals.sort(util.cmp);

    return {
      type:     type_1(values, f),
      unique:   u,
      count:    values.length,
      valid:    valid,
      missing:  missing,
      distinct: distinct,
      min:      min,
      max:      max,
      mean:     mean,
      stdev:    sd,
      median:   (v = stats.quantile(vals, 0.5)),
      q1:       stats.quantile(vals, 0.25),
      q3:       stats.quantile(vals, 0.75),
      modeskew: sd === 0 ? 0 : (mean - v) / sd
    };
  };

  // Compute profiles for all variables in a data set.
  stats.summary = function(data, fields) {
    fields = fields || util.keys(data[0]);
    var s = fields.map(function(f) {
      var p = stats.profile(data, util.$(f));
      return (p.field = f, p);
    });
    return (s.__summary__ = true, s);
  };
  });

  var types = {
    'values': measure({
      name: 'values',
      init: 'cell.collect = true;',
      set:  'cell.data.values()', idx: -1
    }),
    'count': measure({
      name: 'count',
      set:  'cell.num'
    }),
    'missing': measure({
      name: 'missing',
      set:  'this.missing'
    }),
    'valid': measure({
      name: 'valid',
      set:  'this.valid'
    }),
    'sum': measure({
      name: 'sum',
      init: 'this.sum = 0;',
      add:  'this.sum += v;',
      rem:  'this.sum -= v;',
      set:  'this.sum'
    }),
    'mean': measure({
      name: 'mean',
      init: 'this.mean = 0;',
      add:  'var d = v - this.mean; this.mean += d / this.valid;',
      rem:  'var d = v - this.mean; this.mean -= this.valid ? d / this.valid : this.mean;',
      set:  'this.mean'
    }),
    'average': measure({
      name: 'average',
      set:  'this.mean',
      req:  ['mean'], idx: 1
    }),
    'variance': measure({
      name: 'variance',
      init: 'this.dev = 0;',
      add:  'this.dev += d * (v - this.mean);',
      rem:  'this.dev -= d * (v - this.mean);',
      set:  'this.valid > 1 ? this.dev / (this.valid-1) : 0',
      req:  ['mean'], idx: 1
    }),
    'variancep': measure({
      name: 'variancep',
      set:  'this.valid > 1 ? this.dev / this.valid : 0',
      req:  ['variance'], idx: 2
    }),
    'stdev': measure({
      name: 'stdev',
      set:  'this.valid > 1 ? Math.sqrt(this.dev / (this.valid-1)) : 0',
      req:  ['variance'], idx: 2
    }),
    'stdevp': measure({
      name: 'stdevp',
      set:  'this.valid > 1 ? Math.sqrt(this.dev / this.valid) : 0',
      req:  ['variance'], idx: 2
    }),
    'stderr': measure({
      name: 'stderr',
      set:  'this.valid > 1 ? Math.sqrt(this.dev / (this.valid * (this.valid-1))) : 0',
      req:  ['variance'], idx: 2
    }),
    'median': measure({
      name: 'median',
      set:  'cell.data.q2(this.get)',
      req:  ['values'], idx: 3
    }),
    'q1': measure({
      name: 'q1',
      set:  'cell.data.q1(this.get)',
      req:  ['values'], idx: 3
    }),
    'q3': measure({
      name: 'q3',
      set:  'cell.data.q3(this.get)',
      req:  ['values'], idx: 3
    }),
    'distinct': measure({
      name: 'distinct',
      set:  'this.distinct(cell.data.values(), this.get)',
      req:  ['values'], idx: 3
    }),
    'argmin': measure({
      name: 'argmin',
      add:  'if (v < this.min) this.argmin = t;',
      rem:  'if (v <= this.min) this.argmin = null;',
      set:  'this.argmin = this.argmin || cell.data.argmin(this.get)',
      req:  ['min'], str: ['values'], idx: 3
    }),
    'argmax': measure({
      name: 'argmax',
      add:  'if (v > this.max) this.argmax = t;',
      rem:  'if (v >= this.max) this.argmax = null;',
      set:  'this.argmax = this.argmax || cell.data.argmax(this.get)',
      req:  ['max'], str: ['values'], idx: 3
    }),
    'min': measure({
      name: 'min',
      init: 'this.min = +Infinity;',
      add:  'if (v < this.min) this.min = v;',
      rem:  'if (v <= this.min) this.min = NaN;',
      set:  'this.min = (isNaN(this.min) ? cell.data.min(this.get) : this.min)',
      str:  ['values'], idx: 4
    }),
    'max': measure({
      name: 'max',
      init: 'this.max = -Infinity;',
      add:  'if (v > this.max) this.max = v;',
      rem:  'if (v >= this.max) this.max = NaN;',
      set:  'this.max = (isNaN(this.max) ? cell.data.max(this.get) : this.max)',
      str:  ['values'], idx: 4
    }),
    'modeskew': measure({
      name: 'modeskew',
      set:  'this.dev===0 ? 0 : (this.mean - cell.data.q2(this.get)) / Math.sqrt(this.dev/(this.valid-1))',
      req:  ['mean', 'variance', 'median'], idx: 5
    })
  };

  function measure(base) {
    return function(out) {
      var m = util.extend({init:'', add:'', rem:'', idx:0}, base);
      m.out = out || base.name;
      return m;
    };
  }

  function resolve$1(agg, stream) {
    function collect(m, a) {
      function helper(r) { if (!m[r]) collect(m, m[r] = types[r]()); }
      if (a.req) a.req.forEach(helper);
      if (stream && a.str) a.str.forEach(helper);
      return m;
    }
    var map = agg.reduce(
      collect,
      agg.reduce(function(m, a) { return (m[a.name] = a, m); }, {})
    );
    return util.vals(map).sort(function(a, b) { return a.idx - b.idx; });
  }

  function create(agg, stream, accessor, mutator) {
    var all = resolve$1(agg, stream),
        ctr = 'this.cell = cell; this.tuple = t; this.valid = 0; this.missing = 0;',
        add = 'if (v==null) this.missing++; if (!this.isValid(v)) return; ++this.valid;',
        rem = 'if (v==null) this.missing--; if (!this.isValid(v)) return; --this.valid;',
        set = 'var t = this.tuple; var cell = this.cell;';

    all.forEach(function(a) {
      if (a.idx < 0) {
        ctr = a.init + ctr;
        add = a.add + add;
        rem = a.rem + rem;
      } else {
        ctr += a.init;
        add += a.add;
        rem += a.rem;
      }
    });
    agg.slice()
      .sort(function(a, b) { return a.idx - b.idx; })
      .forEach(function(a) {
        set += 'this.assign(t,\''+a.out+'\','+a.set+');';
      });
    set += 'return t;';

    /* jshint evil: true */
    ctr = Function('cell', 't', ctr);
    ctr.prototype.assign = mutator;
    ctr.prototype.add = Function('t', 'var v = this.get(t);' + add);
    ctr.prototype.rem = Function('t', 'var v = this.get(t);' + rem);
    ctr.prototype.set = Function(set);
    ctr.prototype.get = accessor;
    ctr.prototype.distinct = stats_1.count.distinct;
    ctr.prototype.isValid = util.isValid;
    ctr.fields = agg.map(util.$('out'));
    return ctr;
  }

  types.create = create;
  var measures = types;

  var REM = '__dl_rem__';

  function Collector(key) {
    this._add = [];
    this._rem = [];
    this._key = key || null;
    this._last = null;
  }

  var proto = Collector.prototype;

  proto.add = function(v) {
    this._add.push(v);
  };

  proto.rem = function(v) {
    this._rem.push(v);
  };

  proto.values = function() {
    this._get = null;
    if (this._rem.length === 0) return this._add;

    var a = this._add,
        r = this._rem,
        k = this._key,
        x = Array(a.length - r.length),
        i, j, n, m;

    if (!util.isObject(r[0])) {
      // processing raw values
      m = stats_1.count.map(r);
      for (i=0, j=0, n=a.length; i<n; ++i) {
        if (m[a[i]] > 0) {
          m[a[i]] -= 1;
        } else {
          x[j++] = a[i];
        }
      }
    } else if (k) {
      // has unique key field, so use that
      m = util.toMap(r, k);
      for (i=0, j=0, n=a.length; i<n; ++i) {
        if (!m.hasOwnProperty(k(a[i]))) { x[j++] = a[i]; }
      }
    } else {
      // no unique key, mark tuples directly
      for (i=0, n=r.length; i<n; ++i) {
        r[i][REM] = 1;
      }
      for (i=0, j=0, n=a.length; i<n; ++i) {
        if (!a[i][REM]) { x[j++] = a[i]; }
      }
      for (i=0, n=r.length; i<n; ++i) {
        delete r[i][REM];
      }
    }

    this._rem = [];
    return (this._add = x);
  };

  // memoizing statistics methods

  proto.extent = function(get) {
    if (this._get !== get || !this._ext) {
      var v = this.values(),
          i = stats_1.extent.index(v, get);
      this._ext = [v[i[0]], v[i[1]]];
      this._get = get;
    }
    return this._ext;
  };

  proto.argmin = function(get) {
    return this.extent(get)[0];
  };

  proto.argmax = function(get) {
    return this.extent(get)[1];
  };

  proto.min = function(get) {
    var m = this.extent(get)[0];
    return m != null ? get(m) : +Infinity;
  };

  proto.max = function(get) {
    var m = this.extent(get)[1];
    return m != null ? get(m) : -Infinity;
  };

  proto.quartile = function(get) {
    if (this._get !== get || !this._q) {
      this._q = stats_1.quartile(this.values(), get);
      this._get = get;
    }
    return this._q;
  };

  proto.q1 = function(get) {
    return this.quartile(get)[0];
  };

  proto.q2 = function(get) {
    return this.quartile(get)[1];
  };

  proto.q3 = function(get) {
    return this.quartile(get)[2];
  };

  var collector = Collector;

  function Aggregator() {
    this._cells = {};
    this._aggr = [];
    this._stream = false;
  }

  var Flags = Aggregator.Flags = {
    ADD_CELL: 1,
    MOD_CELL: 2
  };

  var proto$1 = Aggregator.prototype;

  // Parameters

  proto$1.stream = function(v) {
    if (v == null) return this._stream;
    this._stream = !!v;
    this._aggr = [];
    return this;
  };

  // key accessor to use for streaming removes
  proto$1.key = function(key) {
    if (key == null) return this._key;
    this._key = util.$(key);
    return this;
  };

  // Input: array of objects of the form
  // {name: string, get: function}
  proto$1.groupby = function(dims) {
    this._dims = util.array(dims).map(function(d, i) {
      d = util.isString(d) ? {name: d, get: util.$(d)}
        : util.isFunction(d) ? {name: util.name(d) || d.name || ('_' + i), get: d}
        : (d.name && util.isFunction(d.get)) ? d : null;
      if (d == null) throw 'Invalid groupby argument: ' + d;
      return d;
    });
    return this.clear();
  };

  // Input: array of objects of the form
  // {name: string, ops: [string, ...]}
  proto$1.summarize = function(fields) {
    fields = summarize_args(fields);
    this._count = true;
    var aggr = (this._aggr = []),
        m, f, i, j, op, as, get;

    for (i=0; i<fields.length; ++i) {
      for (j=0, m=[], f=fields[i]; j<f.ops.length; ++j) {
        op = f.ops[j];
        if (op !== 'count') this._count = false;
        as = (f.as && f.as[j]) || (op + (f.name==='*' ? '' : '_'+f.name));
        m.push(measures[op](as));
      }
      get = f.get && util.$(f.get) ||
        (f.name === '*' ? util.identity : util.$(f.name));
      aggr.push({
        name: f.name,
        measures: measures.create(
          m,
          this._stream, // streaming remove flag
          get,          // input tuple getter
          this._assign) // output tuple setter
      });
    }
    return this.clear();
  };

  // Convenience method to summarize by count
  proto$1.count = function() {
    return this.summarize({'*':'count'});
  };

  // Override to perform custom tuple value assignment
  proto$1._assign = function(object, name, value) {
    object[name] = value;
  };

  function summarize_args(fields) {
    if (util.isArray(fields)) { return fields; }
    if (fields == null) { return []; }
    var a = [], name, ops;
    for (name in fields) {
      ops = util.array(fields[name]);
      a.push({name: name, ops: ops});
    }
    return a;
  }

  // Cell Management

  proto$1.clear = function() {
    return (this._cells = {}, this);
  };

  proto$1._cellkey = function(x) {
    var d = this._dims,
        n = d.length, i,
        k = String(d[0].get(x));
    for (i=1; i<n; ++i) {
      k += '|' + d[i].get(x);
    }
    return k;
  };

  proto$1._cell = function(x) {
    var key = this._dims.length ? this._cellkey(x) : '';
    return this._cells[key] || (this._cells[key] = this._newcell(x, key));
  };

  proto$1._newcell = function(x, key) {
    var cell = {
      num:   0,
      tuple: this._newtuple(x, key),
      flag:  Flags.ADD_CELL,
      aggs:  {}
    };

    var aggr = this._aggr, i;
    for (i=0; i<aggr.length; ++i) {
      cell.aggs[aggr[i].name] = new aggr[i].measures(cell, cell.tuple);
    }
    if (cell.collect) {
      cell.data = new collector(this._key);
    }
    return cell;
  };

  proto$1._newtuple = function(x) {
    var dims = this._dims,
        t = {}, i, n;
    for (i=0, n=dims.length; i<n; ++i) {
      t[dims[i].name] = dims[i].get(x);
    }
    return this._ingest(t);
  };

  // Override to perform custom tuple ingestion
  proto$1._ingest = util.identity;

  // Process Tuples

  proto$1._add = function(x) {
    var cell = this._cell(x),
        aggr = this._aggr, i;

    cell.num += 1;
    if (!this._count) { // skip if count-only
      if (cell.collect) cell.data.add(x);
      for (i=0; i<aggr.length; ++i) {
        cell.aggs[aggr[i].name].add(x);
      }
    }
    cell.flag |= Flags.MOD_CELL;
    if (this._on_add) this._on_add(x, cell);
  };

  proto$1._rem = function(x) {
    var cell = this._cell(x),
        aggr = this._aggr, i;

    cell.num -= 1;
    if (!this._count) { // skip if count-only
      if (cell.collect) cell.data.rem(x);
      for (i=0; i<aggr.length; ++i) {
        cell.aggs[aggr[i].name].rem(x);
      }
    }
    cell.flag |= Flags.MOD_CELL;
    if (this._on_rem) this._on_rem(x, cell);
  };

  proto$1._mod = function(curr, prev) {
    var cell0 = this._cell(prev),
        cell1 = this._cell(curr),
        aggr = this._aggr, i;

    if (cell0 !== cell1) {
      cell0.num -= 1;
      cell1.num += 1;
      if (cell0.collect) cell0.data.rem(prev);
      if (cell1.collect) cell1.data.add(curr);
    } else if (cell0.collect && !util.isObject(curr)) {
      cell0.data.rem(prev);
      cell0.data.add(curr);
    }

    for (i=0; i<aggr.length; ++i) {
      cell0.aggs[aggr[i].name].rem(prev);
      cell1.aggs[aggr[i].name].add(curr);
    }
    cell0.flag |= Flags.MOD_CELL;
    cell1.flag |= Flags.MOD_CELL;
    if (this._on_mod) this._on_mod(curr, prev, cell0, cell1);
  };

  proto$1._markMod = function(x) {
    var cell0 = this._cell(x);
    cell0.flag |= Flags.MOD_CELL;
  };

  proto$1.result = function() {
    var result = [],
        aggr = this._aggr,
        cell, i, k;

    for (k in this._cells) {
      cell = this._cells[k];
      if (cell.num > 0) {
        // consolidate collector values
        if (cell.collect) {
          cell.data.values();
        }
        // update tuple properties
        for (i=0; i<aggr.length; ++i) {
          cell.aggs[aggr[i].name].set();
        }
        // add output tuple
        result.push(cell.tuple);
      } else {
        delete this._cells[k];
      }
      cell.flag = 0;
    }

    this._rems = false;
    return result;
  };

  proto$1.changes = function(output) {
    var changes = output || {add:[], rem:[], mod:[]},
        aggr = this._aggr,
        cell, flag, i, k;

    for (k in this._cells) {
      cell = this._cells[k];
      flag = cell.flag;

      // consolidate collector values
      if (cell.collect) {
        cell.data.values();
      }

      // update tuple properties
      for (i=0; i<aggr.length; ++i) {
        cell.aggs[aggr[i].name].set();
      }

      // organize output tuples
      if (cell.num <= 0) {
        changes.rem.push(cell.tuple); // if (flag === Flags.MOD_CELL) { ??
        delete this._cells[k];
        if (this._on_drop) this._on_drop(cell);
      } else {
        if (this._on_keep) this._on_keep(cell);
        if (flag & Flags.ADD_CELL) {
          changes.add.push(cell.tuple);
        } else if (flag & Flags.MOD_CELL) {
          changes.mod.push(cell.tuple);
        }
      }

      cell.flag = 0;
    }

    this._rems = false;
    return changes;
  };

  proto$1.execute = function(input) {
    return this.clear().insert(input).result();
  };

  proto$1.insert = function(input) {
    this._consolidate();
    for (var i=0; i<input.length; ++i) {
      this._add(input[i]);
    }
    return this;
  };

  proto$1.remove = function(input) {
    if (!this._stream) {
      throw 'Aggregator not configured for streaming removes.' +
        ' Call stream(true) prior to calling summarize.';
    }
    for (var i=0; i<input.length; ++i) {
      this._rem(input[i]);
    }
    this._rems = true;
    return this;
  };

  // consolidate removals
  proto$1._consolidate = function() {
    if (!this._rems) return;
    for (var k in this._cells) {
      if (this._cells[k].collect) {
        this._cells[k].data.values();
      }
    }
    this._rems = false;
  };

  var aggregator = Aggregator;

  var groupby = function() {
    // flatten arguments into a single array
    var args = [].reduce.call(arguments, function(a, x) {
      return a.concat(util.array(x));
    }, []);
    // create and return an aggregator
    return new aggregator()
      .groupby(args)
      .summarize({'*':'values'});
  };

  var tempDate = new Date(),
      baseDate = new Date(0, 0, 1).setFullYear(0), // Jan 1, 0 AD
      utcBaseDate = new Date(Date.UTC(0, 0, 1)).setUTCFullYear(0);

  function date(d) {
    return (tempDate.setTime(+d), tempDate);
  }

  // create a time unit entry
  function entry(type, date, unit, step, min, max) {
    var e = {
      type: type,
      date: date,
      unit: unit
    };
    if (step) {
      e.step = step;
    } else {
      e.minstep = 1;
    }
    if (min != null) e.min = min;
    if (max != null) e.max = max;
    return e;
  }

  function create$1(type, unit, base, step, min, max) {
    return entry(type,
      function(d) { return unit.offset(base, d); },
      function(d) { return unit.count(base, d); },
      step, min, max);
  }

  var locale = [
    create$1('second', d3Time.second, baseDate),
    create$1('minute', d3Time.minute, baseDate),
    create$1('hour',   d3Time.hour,   baseDate),
    create$1('day',    d3Time.day,    baseDate, [1, 7]),
    create$1('month',  d3Time.month,  baseDate, [1, 3, 6]),
    create$1('year',   d3Time.year,   baseDate),

    // periodic units
    entry('seconds',
      function(d) { return new Date(1970, 0, 1, 0, 0, d); },
      function(d) { return date(d).getSeconds(); },
      null, 0, 59
    ),
    entry('minutes',
      function(d) { return new Date(1970, 0, 1, 0, d); },
      function(d) { return date(d).getMinutes(); },
      null, 0, 59
    ),
    entry('hours',
      function(d) { return new Date(1970, 0, 1, d); },
      function(d) { return date(d).getHours(); },
      null, 0, 23
    ),
    entry('weekdays',
      function(d) { return new Date(1970, 0, 4+d); },
      function(d) { return date(d).getDay(); },
      [1], 0, 6
    ),
    entry('dates',
      function(d) { return new Date(1970, 0, d); },
      function(d) { return date(d).getDate(); },
      [1], 1, 31
    ),
    entry('months',
      function(d) { return new Date(1970, d % 12, 1); },
      function(d) { return date(d).getMonth(); },
      [1], 0, 11
    )
  ];

  var utc = [
    create$1('second', d3Time.utcSecond, utcBaseDate),
    create$1('minute', d3Time.utcMinute, utcBaseDate),
    create$1('hour',   d3Time.utcHour,   utcBaseDate),
    create$1('day',    d3Time.utcDay,    utcBaseDate, [1, 7]),
    create$1('month',  d3Time.utcMonth,  utcBaseDate, [1, 3, 6]),
    create$1('year',   d3Time.utcYear,   utcBaseDate),

    // periodic units
    entry('seconds',
      function(d) { return new Date(Date.UTC(1970, 0, 1, 0, 0, d)); },
      function(d) { return date(d).getUTCSeconds(); },
      null, 0, 59
    ),
    entry('minutes',
      function(d) { return new Date(Date.UTC(1970, 0, 1, 0, d)); },
      function(d) { return date(d).getUTCMinutes(); },
      null, 0, 59
    ),
    entry('hours',
      function(d) { return new Date(Date.UTC(1970, 0, 1, d)); },
      function(d) { return date(d).getUTCHours(); },
      null, 0, 23
    ),
    entry('weekdays',
      function(d) { return new Date(Date.UTC(1970, 0, 4+d)); },
      function(d) { return date(d).getUTCDay(); },
      [1], 0, 6
    ),
    entry('dates',
      function(d) { return new Date(Date.UTC(1970, 0, d)); },
      function(d) { return date(d).getUTCDate(); },
      [1], 1, 31
    ),
    entry('months',
      function(d) { return new Date(Date.UTC(1970, d % 12, 1)); },
      function(d) { return date(d).getUTCMonth(); },
      [1], 0, 11
    )
  ];

  var STEPS = [
    [31536e6, 5],  // 1-year
    [7776e6, 4],   // 3-month
    [2592e6, 4],   // 1-month
    [12096e5, 3],  // 2-week
    [6048e5, 3],   // 1-week
    [1728e5, 3],   // 2-day
    [864e5, 3],    // 1-day
    [432e5, 2],    // 12-hour
    [216e5, 2],    // 6-hour
    [108e5, 2],    // 3-hour
    [36e5, 2],     // 1-hour
    [18e5, 1],     // 30-minute
    [9e5, 1],      // 15-minute
    [3e5, 1],      // 5-minute
    [6e4, 1],      // 1-minute
    [3e4, 0],      // 30-second
    [15e3, 0],     // 15-second
    [5e3, 0],      // 5-second
    [1e3, 0]       // 1-second
  ];

  function find(units, span, minb, maxb) {
    var step = STEPS[0], i, n, bins;

    for (i=1, n=STEPS.length; i<n; ++i) {
      step = STEPS[i];
      if (span > step[0]) {
        bins = span / step[0];
        if (bins > maxb) {
          return units[STEPS[i-1][1]];
        }
        if (bins >= minb) {
          return units[step[1]];
        }
      }
    }
    return units[STEPS[n-1][1]];
  }

  function toUnitMap(units) {
    var map = {}, i, n;
    for (i=0, n=units.length; i<n; ++i) {
      map[units[i].type] = units[i];
    }
    map.find = function(span, minb, maxb) {
      return find(units, span, minb, maxb);
    };
    return map;
  }

  var time = toUnitMap(locale);
  var utc_1 = toUnitMap(utc);
  time.utc = utc_1;

  var EPSILON = 1e-15;

  function bins(opt) {
    if (!opt) { throw Error("Missing binning options."); }

    // determine range
    var maxb = opt.maxbins || 15,
        base = opt.base || 10,
        logb = Math.log(base),
        div = opt.div || [5, 2],
        min = opt.min,
        max = opt.max,
        span = max - min,
        step, level, minstep, precision, v, i, eps;

    if (opt.step) {
      // if step size is explicitly given, use that
      step = opt.step;
    } else if (opt.steps) {
      // if provided, limit choice to acceptable step sizes
      step = opt.steps[Math.min(
        opt.steps.length - 1,
        bisect$1(opt.steps, span/maxb, 0, opt.steps.length)
      )];
    } else {
      // else use span to determine step size
      level = Math.ceil(Math.log(maxb) / logb);
      minstep = opt.minstep || 0;
      step = Math.max(
        minstep,
        Math.pow(base, Math.round(Math.log(span) / logb) - level)
      );

      // increase step size if too many bins
      while (Math.ceil(span/step) > maxb) { step *= base; }

      // decrease step size if allowed
      for (i=0; i<div.length; ++i) {
        v = step / div[i];
        if (v >= minstep && span / v <= maxb) step = v;
      }
    }

    // update precision, min and max
    v = Math.log(step);
    precision = v >= 0 ? 0 : ~~(-v / logb) + 1;
    eps = Math.pow(base, -precision - 1);
    min = Math.min(min, Math.floor(min / step + eps) * step);
    max = Math.ceil(max / step) * step;

    return {
      start: min,
      stop:  max,
      step:  step,
      unit:  {precision: precision},
      value: value$1,
      index: index
    };
  }

  function bisect$1(a, x, lo, hi) {
    while (lo < hi) {
      var mid = lo + hi >>> 1;
      if (util.cmp(a[mid], x) < 0) { lo = mid + 1; }
      else { hi = mid; }
    }
    return lo;
  }

  function value$1(v) {
    return this.step * Math.floor(v / this.step + EPSILON);
  }

  function index(v) {
    return Math.floor((v - this.start) / this.step + EPSILON);
  }

  function date_value(v) {
    return this.unit.date(value$1.call(this, v));
  }

  function date_index(v) {
    return index.call(this, this.unit.unit(v));
  }

  bins.date = function(opt) {
    if (!opt) { throw Error("Missing date binning options."); }

    // find time step, then bin
    var units = opt.utc ? time.utc : time,
        dmin = opt.min,
        dmax = opt.max,
        maxb = opt.maxbins || 20,
        minb = opt.minbins || 4,
        span = (+dmax) - (+dmin),
        unit = opt.unit ? units[opt.unit] : units.find(span, minb, maxb),
        spec = bins({
          min:     unit.min != null ? unit.min : unit.unit(dmin),
          max:     unit.max != null ? unit.max : unit.unit(dmax),
          maxbins: maxb,
          minstep: unit.minstep,
          steps:   unit.step
        });

    spec.unit = unit;
    spec.index = date_index;
    if (!opt.raw) spec.value = date_value;
    return spec;
  };

  var bins_1 = bins;

  var qtype = {
    'integer': 1,
    'number': 1,
    'date': 1
  };

  function $bin(values, f, opt) {
    opt = options(values, f, opt);
    var b = spec(opt);
    return !b ? (opt.accessor || util.identity) :
      util.$func('bin', b.unit.unit ?
        function(x) { return b.value(b.unit.unit(x)); } :
        function(x) { return b.value(x); }
      )(opt.accessor);
  }

  function histogram(values, f, opt) {
    opt = options(values, f, opt);
    var b = spec(opt);
    return b ?
      numerical(values, opt.accessor, b) :
      categorical(values, opt.accessor, opt && opt.sort);
  }

  function spec(opt) {
    var t = opt.type, b = null;
    if (t == null || qtype[t]) {
      if (t === 'integer' && opt.minstep == null) opt.minstep = 1;
      b = (t === 'date') ? bins_1.date(opt) : bins_1(opt);
    }
    return b;
  }

  function options() {
    var a = arguments,
        i = 0,
        values = util.isArray(a[i]) ? a[i++] : null,
        f = util.isFunction(a[i]) || util.isString(a[i]) ? util.$(a[i++]) : null,
        opt = util.extend({}, a[i]);

    if (values) {
      opt.type = opt.type || type_1(values, f);
      if (qtype[opt.type]) {
        var ext = stats_1.extent(values, f);
        opt = util.extend({min: ext[0], max: ext[1]}, opt);
      }
    }
    if (f) { opt.accessor = f; }
    return opt;
  }

  function numerical(values, f, b) {
    var h = generate.range(b.start, b.stop + b.step/2, b.step)
      .map(function(v) { return {value: b.value(v), count: 0}; });

    for (var i=0, v, j; i<values.length; ++i) {
      v = f ? f(values[i]) : values[i];
      if (util.isValid(v)) {
        j = b.index(v);
        if (j < 0 || j >= h.length || !isFinite(j)) continue;
        h[j].count += 1;
      }
    }
    h.bins = b;
    return h;
  }

  function categorical(values, f, sort) {
    var u = stats_1.unique(values, f),
        c = stats_1.count.map(values, f);
    return u.map(function(k) { return {value: k, count: c[k]}; })
      .sort(util.comparator(sort ? '-count' : '+value'));
  }

  var histogram_1 = {
    $bin: $bin,
    histogram: histogram
  };

  var context = {
    formats:    [],
    format_map: {},
    truncate:   util.truncate,
    pad:        util.pad,
    day:        format.day,
    month:      format.month,
    quarter:    format.quarter,
    utcQuarter: format.utcQuarter
  };

  function template(text) {
    var src = source(text, 'd');
    src = 'var __t; return ' + src + ';';

    /* jshint evil: true */
    return (new Function('d', src)).bind(context);
  }

  template.source = source;
  template.context = context;
  template.format = get_format;
  var template_1 = template;

  // Clear cache of format objects.
  // This can *break* prior template functions, so invoke with care!
  template.clearFormatCache = function() {
    context.formats = [];
    context.format_map = {};
  };

  // Generate property access code for use within template source.
  // object: the name of the object (variable) containing template data
  // property: the property access string, verbatim from template tag
  template.property = function(object, property) {
    var src = util.field(property).map(util.str).join('][');
    return object + '[' + src + ']';
  };

  // Generate source code for a template function.
  // text: the template text
  // variable: the name of the data object variable ('obj' by default)
  // properties: optional hash for collecting all accessed properties
  function source(text, variable, properties) {
    variable = variable || 'obj';
    var index = 0;
    var src = '\'';
    var regex = template_re;

    // Compile the template source, escaping string literals appropriately.
    text.replace(regex, function(match, interpolate, offset) {
      src += text
        .slice(index, offset)
        .replace(template_escaper, template_escapeChar);
      index = offset + match.length;

      if (interpolate) {
        src += '\'\n+((__t=(' +
          template_var(interpolate, variable, properties) +
          '))==null?\'\':__t)+\n\'';
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    return src + '\'';
  }

  function template_var(text, variable, properties) {
    var filters = text.match(filter_re);
    var prop = filters.shift().trim();
    var stringCast = true;

    function strcall(fn) {
      fn = fn || '';
      if (stringCast) {
        stringCast = false;
        src = 'String(' + src + ')' + fn;
      } else {
        src += fn;
      }
      return src;
    }

    function date() {
      return '(typeof ' + src + '==="number"?new Date('+src+'):'+src+')';
    }

    function formatter(type) {
      var pattern = args[0];
      if ((pattern[0] === '\'' && pattern[pattern.length-1] === '\'') ||
          (pattern[0] === '"'  && pattern[pattern.length-1] === '"')) {
        pattern = pattern.slice(1, -1);
      } else {
        throw Error('Format pattern must be quoted: ' + pattern);
      }
      a = template_format(pattern, type);
      stringCast = false;
      var arg = type === 'number' ? src : date();
      src = 'this.formats['+a+']('+arg+')';
    }

    if (properties) properties[prop] = 1;
    var src = template.property(variable, prop);

    for (var i=0; i<filters.length; ++i) {
      var f = filters[i], args = null, pidx, a, b;

      if ((pidx=f.indexOf(':')) > 0) {
        f = f.slice(0, pidx);
        args = filters[i].slice(pidx+1)
          .match(args_re)
          .map(function(s) { return s.trim(); });
      }
      f = f.trim();

      switch (f) {
        case 'length':
          strcall('.length');
          break;
        case 'lower':
          strcall('.toLowerCase()');
          break;
        case 'upper':
          strcall('.toUpperCase()');
          break;
        case 'lower-locale':
          strcall('.toLocaleLowerCase()');
          break;
        case 'upper-locale':
          strcall('.toLocaleUpperCase()');
          break;
        case 'trim':
          strcall('.trim()');
          break;
        case 'left':
          a = util.number(args[0]);
          strcall('.slice(0,' + a + ')');
          break;
        case 'right':
          a = util.number(args[0]);
          strcall('.slice(-' + a +')');
          break;
        case 'mid':
          a = util.number(args[0]);
          b = a + util.number(args[1]);
          strcall('.slice(+'+a+','+b+')');
          break;
        case 'slice':
          a = util.number(args[0]);
          strcall('.slice('+ a +
            (args.length > 1 ? ',' + util.number(args[1]) : '') +
            ')');
          break;
        case 'truncate':
          a = util.number(args[0]);
          b = args[1];
          b = (b!=='left' && b!=='middle' && b!=='center') ? 'right' : b;
          src = 'this.truncate(' + strcall() + ',' + a + ',\'' + b + '\')';
          break;
        case 'pad':
          a = util.number(args[0]);
          b = args[1];
          b = (b!=='left' && b!=='middle' && b!=='center') ? 'right' : b;
          src = 'this.pad(' + strcall() + ',' + a + ',\'' + b + '\')';
          break;
        case 'number':
          formatter('number');
          break;
        case 'time':
          formatter('time');
          break;
        case 'time-utc':
          formatter('utc');
          break;
        case 'month':
          src = 'this.month(' + src + ')';
          break;
        case 'month-abbrev':
          src = 'this.month(' + src + ',true)';
          break;
        case 'day':
          src = 'this.day(' + src + ')';
          break;
        case 'day-abbrev':
          src = 'this.day(' + src + ',true)';
          break;
        case 'quarter':
          src = 'this.quarter(' + src + ')';
          break;
        case 'quarter-utc':
          src = 'this.utcQuarter(' + src + ')';
          break;
        default:
          throw Error('Unrecognized template filter: ' + f);
      }
    }

    return src;
  }

  var template_re = /\{\{(.+?)\}\}|$/g,
      filter_re = /(?:"[^"]*"|\'[^\']*\'|[^\|"]+|[^\|\']+)+/g,
      args_re = /(?:"[^"]*"|\'[^\']*\'|[^,"]+|[^,\']+)+/g;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var template_escapes = {
    '\'':     '\'',
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var template_escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  function template_escapeChar(match) {
    return '\\' + template_escapes[match];
  }

  function template_format(pattern, type) {
    var key = type + ':' + pattern;
    if (context.format_map[key] == null) {
      var f = format[type](pattern);
      var i = context.formats.length;
      context.formats.push(f);
      context.format_map[key] = i;
      return i;
    }
    return context.format_map[key];
  }

  function get_format(pattern, type) {
    return context.formats[template_format(pattern, type)];
  }

  var accessor = createCommonjsModule(function (module) {
  var utc = time.utc;

  var u = module.exports;

  u.$year   = util.$func('year', time.year.unit);
  u.$month  = util.$func('month', time.months.unit);
  u.$date   = util.$func('date', time.dates.unit);
  u.$day    = util.$func('day', time.weekdays.unit);
  u.$hour   = util.$func('hour', time.hours.unit);
  u.$minute = util.$func('minute', time.minutes.unit);
  u.$second = util.$func('second', time.seconds.unit);

  u.$utcYear   = util.$func('utcYear', utc.year.unit);
  u.$utcMonth  = util.$func('utcMonth', utc.months.unit);
  u.$utcDate   = util.$func('utcDate', utc.dates.unit);
  u.$utcDay    = util.$func('utcDay', utc.weekdays.unit);
  u.$utcHour   = util.$func('utcHour', utc.hours.unit);
  u.$utcMinute = util.$func('utcMinute', utc.minutes.unit);
  u.$utcSecond = util.$func('utcSecond', utc.seconds.unit);
  });

  var readers = util
    .keys(read_1.formats)
    .reduce(function(out, type) {
      out[type] = function(opt, format, callback) {
        // process arguments
        if (util.isString(opt)) { opt = {url: opt}; }
        if (arguments.length === 2 && util.isFunction(format)) {
          callback = format;
          format = undefined;
        }

        // set up read format
        format = util.extend({parse: 'auto'}, format);
        format.type = type;

        // load data
        var data = load_1(opt, callback ? function(error, data) {
          if (error) { callback(error, null); return; }
          try {
            // data loaded, now parse it (async)
            data = read_1(data, format);
            callback(null, data);
          } catch (e) {
            callback(e, null);
          }
        } : undefined);

        // data loaded, now parse it (sync)
        if (!callback) return read_1(data, format);
      };
      return out;
    }, {});

  var formatTables = {
    table:   formatTable,  // format a data table
    summary: formatSummary // format a data table summary
  };

  var FMT = {
    'date':    '|time:"%m/%d/%Y %H:%M:%S"',
    'number':  '|number:".4f"',
    'integer': '|number:"d"'
  };

  var POS = {
    'number':  'left',
    'integer': 'left'
  };

  function formatTable(data, opt) {
    opt = util.extend({separator:' ', minwidth: 8, maxwidth: 15}, opt);
    var fields = opt.fields || util.keys(data[0]),
        types = type_1.all(data);

    if (opt.start || opt.limit) {
      var a = opt.start || 0,
          b = opt.limit ? a + opt.limit : data.length;
      data = data.slice(a, b);
    }

    // determine char width of fields
    var lens = fields.map(function(name) {
      var format = FMT[types[name]] || '',
          t = template_1('{{' + name + format + '}}'),
          l = stats_1.max(data, function(x) { return t(x).length; });
      l = Math.max(Math.min(name.length, opt.minwidth), l);
      return opt.maxwidth > 0 ? Math.min(l, opt.maxwidth) : l;
    });

    // print header row
    var head = fields.map(function(name, i) {
      return util.truncate(util.pad(name, lens[i], 'center'), lens[i]);
    }).join(opt.separator);

    // build template function for each row
    var tmpl = template_1(fields.map(function(name, i) {
      return '{{' +
        name +
        (FMT[types[name]] || '') +
        ('|pad:' + lens[i] + ',' + (POS[types[name]] || 'right')) +
        ('|truncate:' + lens[i]) +
      '}}';
    }).join(opt.separator));

    // print table
    return head + "\n" + data.map(tmpl).join('\n');
  }

  function formatSummary(s) {
    s = s ? s.__summary__ ? s : stats_1.summary(s) : this;
    var str = [], i, n;
    for (i=0, n=s.length; i<n; ++i) {
      str.push('-- ' + s[i].field + ' --');
      if (s[i].type === 'string' || s[i].distinct < 10) {
        str.push(printCategoricalProfile(s[i]));
      } else {
        str.push(printQuantitativeProfile(s[i]));
      }
      str.push('');
    }
    return str.join('\n');
  }

  function printQuantitativeProfile(p) {
    return [
      'valid:    ' + p.valid,
      'missing:  ' + p.missing,
      'distinct: ' + p.distinct,
      'min:      ' + p.min,
      'max:      ' + p.max,
      'median:   ' + p.median,
      'mean:     ' + p.mean,
      'stdev:    ' + p.stdev,
      'modeskew: ' + p.modeskew
    ].join('\n');
  }

  function printCategoricalProfile(p) {
    var list = [
      'valid:    ' + p.valid,
      'missing:  ' + p.missing,
      'distinct: ' + p.distinct,
      'top values: '
    ];
    var u = p.unique;
    var top = util.keys(u)
      .sort(function(a,b) { return u[b] - u[a]; })
      .slice(0, 6)
      .map(function(v) { return ' \'' + v + '\' (' + u[v] + ')'; });
    return list.concat(top).join('\n');
  }

  var require$$0$2 = getCjsExportFromNamespace(_package$1);

  var dl = {
    version:    require$$0$2.version,
    load:       load_1,
    read:       read_1,
    type:       type_1,
    Aggregator: aggregator,
    groupby:    groupby,
    bins:       bins_1,
    $bin:       histogram_1.$bin,
    histogram:  histogram_1.histogram,
    format:     format,
    template:   template_1,
    time:       time
  };

  util.extend(dl, util);
  util.extend(dl, accessor);
  util.extend(dl, generate);
  util.extend(dl, stats_1);
  util.extend(dl, readers);
  util.extend(dl.format, formatTables);

  // backwards-compatible, deprecated API
  // will remove in the future
  dl.print = {
    table:   dl.format.table,
    summary: dl.format.summary
  };

  var src = dl;

  class Introspectable {
    get type() {
      return this.constructor.type;
    }

    get lowerCamelCaseType() {
      return this.constructor.lowerCamelCaseType;
    }

    get humanReadableType() {
      return this.constructor.humanReadableType;
    }

  }

  Object.defineProperty(Introspectable, 'type', {
    // This can / should be overridden by subclasses that follow a common string
    // pattern, such as RootToken, KeysToken, ParentToken, etc.
    configurable: true,

    get() {
      return this.type;
    }

  });
  Object.defineProperty(Introspectable, 'lowerCamelCaseType', {
    get() {
      const temp = this.type;
      return temp.replace(/./, temp[0].toLocaleLowerCase());
    }

  });
  Object.defineProperty(Introspectable, 'humanReadableType', {
    get() {
      // CamelCase to Sentence Case
      return this.type.replace(/([a-z])([A-Z])/g, '$1 $2');
    }

  });

  class GenericWrapper extends TriggerableMixin(Introspectable) {
    constructor(options) {
      super();
      this.index = options.index;
      this.table = options.table;

      if (this.index === undefined || !this.table) {
        throw new Error(`index and table are required`);
      }

      this.classObj = options.classObj || null;
      this.row = options.row || {};
      this.connectedItems = options.connectedItems || {};
    }

    connectItem(item) {
      this.connectedItems[item.table.tableId] = this.connectedItems[item.table.tableId] || [];

      if (this.connectedItems[item.table.tableId].indexOf(item) === -1) {
        this.connectedItems[item.table.tableId].push(item);
      }
    }

    disconnect() {
      for (const itemList of Object.values(this.connectedItems)) {
        for (const item of itemList) {
          const index = (item.connectedItems[this.table.tableId] || []).indexOf(this);

          if (index !== -1) {
            item.connectedItems[this.table.tableId].splice(index, 1);
          }
        }
      }

      this.connectedItems = {};
    }

    get instanceId() {
      return `${this.classObj.classId}_${this.index}`;
    }

    equals(item) {
      return this.instanceId === item.instanceId;
    }

    iterateAcrossConnections({
      tableIds,
      limit = Infinity
    }) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        // First make sure that all the table caches have been fully built and
        // connected
        yield _awaitAsyncGenerator(Promise.all(tableIds.map(tableId => {
          return _this.classObj.model.tables[tableId].buildCache();
        })));
        let i = 0;

        for (const item of _this._iterateAcrossConnections(tableIds)) {
          yield item;
          i++;

          if (i >= limit) {
            return;
          }
        }
      })();
    }

    *_iterateAcrossConnections(tableIds) {
      if (tableIds.length === 1) {
        yield* this.connectedItems[tableIds[0]] || [];
      } else {
        const thisTableId = tableIds[0];
        const remainingTableIds = tableIds.slice(1);

        for (const item of this.connectedItems[thisTableId] || []) {
          yield* item._iterateAcrossConnections(remainingTableIds);
        }
      }
    }

  }

  Object.defineProperty(GenericWrapper, 'type', {
    get() {
      return /(.*)Wrapper/.exec(this.name)[1];
    }

  });

  class Table extends TriggerableMixin(Introspectable) {
    constructor(options) {
      super();
      this.model = options.model;
      this.tableId = options.tableId;

      if (!this.model || !this.tableId) {
        throw new Error(`model and tableId are required`);
      }

      this._expectedAttributes = options.attributes || {};
      this._observedAttributes = {};
      this._derivedTables = options.derivedTables || {};
      this._derivedAttributeFunctions = {};

      for (const [attr, stringifiedFunc] of Object.entries(options.derivedAttributeFunctions || {})) {
        this._derivedAttributeFunctions[attr] = this.hydrateFunction(stringifiedFunc);
      }

      this._suppressedAttributes = options.suppressedAttributes || {};
      this._suppressIndex = !!options.suppressIndex;
      this._indexFilter = options.indexFilter && this.hydrateFunction(options.indexFilter) || null;
      this._attributeFilters = {};

      for (const [attr, stringifiedFunc] of Object.entries(options.attributeFilters || {})) {
        this._attributeFilters[attr] = this.hydrateFunction(stringifiedFunc);
      }
    }

    _toRawObject() {
      const result = {
        tableId: this.tableId,
        attributes: this._attributes,
        derivedTables: this._derivedTables,
        usedByClasses: this._usedByClasses,
        derivedAttributeFunctions: {},
        suppressedAttributes: this._suppressedAttributes,
        suppressIndex: this._suppressIndex,
        attributeFilters: {},
        indexFilter: this._indexFilter && this.dehydrateFunction(this._indexFilter) || null
      };

      for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
        result.derivedAttributeFunctions[attr] = this.dehydrateFunction(func);
      }

      for (const [attr, func] of Object.entries(this._attributeFilters)) {
        result.attributeFilters[attr] = this.dehydrateFunction(func);
      }

      return result;
    }

    hydrateFunction(stringifiedFunc) {
      new Function(`return ${stringifiedFunc}`)(); // eslint-disable-line no-new-func
    }

    dehydrateFunction(func) {
      let stringifiedFunc = func.toString(); // Istanbul adds some code to functions for computing coverage, that gets
      // included in the stringification process during testing. See:
      // https://github.com/gotwarlost/istanbul/issues/310#issuecomment-274889022

      stringifiedFunc = stringifiedFunc.replace(/cov_(.+?)\+\+[,;]?/g, '');
      return stringifiedFunc;
    }

    iterate(options = {}) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        // Generic caching stuff; this isn't just for performance. ConnectedTable's
        // algorithm requires that its parent tables have pre-built indexes (we
        // technically could implement it differently, but it would be expensive,
        // requires tricky logic, and we're already building indexes for some tables
        // like AggregatedTable anyway)
        if (options.reset) {
          _this.reset();
        }

        if (_this._cache) {
          const limit = options.limit === undefined ? Infinity : options.limit;
          yield* _asyncGeneratorDelegate(_asyncIterator(Object.values(_this._cache).slice(0, limit)), _awaitAsyncGenerator);
          return;
        }

        yield* _asyncGeneratorDelegate(_asyncIterator((yield _awaitAsyncGenerator(_this._buildCache(options)))), _awaitAsyncGenerator);
      })();
    }

    _buildCache(options = {}) {
      var _this2 = this;

      return _wrapAsyncGenerator(function* () {
        // TODO: in large data scenarios, we should build the cache / index
        // externally on disk
        _this2._partialCache = {};
        const limit = options.limit === undefined ? Infinity : options.limit;
        delete options.limit;

        const iterator = _this2._iterate(options);

        let completed = false;

        for (let i = 0; i < limit; i++) {
          const temp = yield _awaitAsyncGenerator(iterator.next());

          if (!_this2._partialCache) {
            // iteration was cancelled; return immediately
            return;
          }

          if (temp.done) {
            completed = true;
            break;
          } else {
            _this2._finishItem(temp.value);

            _this2._partialCache[temp.value.index] = temp.value;
            yield temp.value;
          }
        }

        if (completed) {
          _this2._cache = _this2._partialCache;
        }

        delete _this2._partialCache;
      })();
    }

    _iterate(options) {
      return _wrapAsyncGenerator(function* () {
        throw new Error(`this function should be overridden`);
      })();
    }

    _finishItem(wrappedItem) {
      for (const [attr, func] of Object.entries(this._derivedAttributeFunctions)) {
        wrappedItem.row[attr] = func(wrappedItem);
      }

      for (const attr in wrappedItem.row) {
        this._observedAttributes[attr] = true;
      }

      for (const attr in this._suppressedAttributes) {
        delete wrappedItem.row[attr];
      }

      let keep = true;

      if (this._indexFilter) {
        keep = this._indexFilter(wrappedItem.index);
      }

      for (const [attr, func] of Object.entries(this._attributeFilters)) {
        keep = keep && func(wrappedItem.row[attr]);

        if (!keep) {
          break;
        }
      }

      if (keep) {
        wrappedItem.trigger('finish');
      } else {
        wrappedItem.disconnect();
        wrappedItem.trigger('filter');
      }

      return keep;
    }

    _wrap(options) {
      options.table = this;
      const classObj = this.classObj;
      const wrappedItem = classObj ? classObj._wrap(options) : new GenericWrapper(options);

      for (const otherItem of options.itemsToConnect || []) {
        wrappedItem.connectItem(otherItem);
        otherItem.connectItem(wrappedItem);
      }

      return wrappedItem;
    }

    reset() {
      delete this._partialCache;
      delete this._cache;

      for (const derivedTable of this.derivedTables) {
        derivedTable.reset();
      }

      this.trigger('reset');
    }

    get name() {
      throw new Error(`this function should be overridden`);
    }

    async buildCache() {
      if (this._cache) {
        return this._cache;
      } else if (this._cachePromise) {
        return this._cachePromise;
      } else {
        this._cachePromise = new Promise(async (resolve, reject) => {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(this._buildCache()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            } // eslint-disable-line no-unused-vars

          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                await _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }

          delete this._cachePromise;
          resolve(this._cache);
        });
        return this._cachePromise;
      }
    }

    async countRows() {
      return Object.keys((await this.buildCache())).length;
    }

    getIndexDetails() {
      const details = {
        name: null
      };

      if (this._suppressIndex) {
        details.suppressed = true;
      }

      if (this._indexFilter) {
        details.filtered = true;
      }

      return details;
    }

    getAttributeDetails() {
      const allAttrs = {};

      for (const attr in this._expectedAttributes) {
        allAttrs[attr] = allAttrs[attr] || {
          name: attr
        };
        allAttrs[attr].expected = true;
      }

      for (const attr in this._observedAttributes) {
        allAttrs[attr] = allAttrs[attr] || {
          name: attr
        };
        allAttrs[attr].observed = true;
      }

      for (const attr in this._derivedAttributeFunctions) {
        allAttrs[attr] = allAttrs[attr] || {
          name: attr
        };
        allAttrs[attr].derived = true;
      }

      for (const attr in this._suppressedAttributes) {
        allAttrs[attr] = allAttrs[attr] || {
          name: attr
        };
        allAttrs[attr].suppressed = true;
      }

      for (const attr in this._attributeFilters) {
        allAttrs[attr] = allAttrs[attr] || {
          name: attr
        };
        allAttrs[attr].filtered = true;
      }

      return allAttrs;
    }

    get attributes() {
      return Object.keys(this.getAttributeDetails());
    }

    get currentData() {
      return {
        data: this._cache || this._partialCache || {},
        complete: !!this._cache
      };
    }

    deriveAttribute(attribute, func) {
      this._derivedAttributeFunctions[attribute] = func;
      this.reset();
    }

    suppressAttribute(attribute) {
      if (attribute === null) {
        this._suppressIndex = true;
      } else {
        this._suppressedAttributes[attribute] = true;
      }

      this.reset();
    }

    addFilter(attribute, func) {
      if (attribute === null) {
        this._indexFilter = func;
      } else {
        this._attributeFilters[attribute] = func;
      }

      this.reset();
    }

    _deriveTable(options) {
      const newTable = this.model.createTable(options);
      this._derivedTables[newTable.tableId] = true;
      this.model.trigger('update');
      return newTable;
    }

    _getExistingTable(options) {
      // Check if the derived table has already been defined
      const existingTable = this.derivedTables.find(tableObj => {
        return Object.entries(options).every(([optionName, optionValue]) => {
          if (optionName === 'type') {
            return tableObj.constructor.name === optionValue;
          } else {
            return tableObj['_' + optionName] === optionValue;
          }
        });
      });
      return existingTable && this.model.tables[existingTable.tableId] || null;
    }

    aggregate(attribute) {
      const options = {
        type: 'AggregatedTable',
        attribute
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    }

    expand(attribute, delimiter) {
      const options = {
        type: 'ExpandedTable',
        attribute,
        delimiter
      };
      return this._getExistingTable(options) || this._deriveTable(options);
    }

    closedFacet(attribute, values) {
      return values.map(value => {
        const options = {
          type: 'FacetedTable',
          attribute,
          value
        };
        return this._getExistingTable(options) || this._deriveTable(options);
      });
    }

    openFacet(attribute, limit = Infinity) {
      var _this3 = this;

      return _wrapAsyncGenerator(function* () {
        const values = {};
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator(_this3.iterate({
            limit
          })), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const wrappedItem = _value2;
            const value = wrappedItem.row[attribute];

            if (!values[value]) {
              values[value] = true;
              const options = {
                type: 'FacetedTable',
                attribute,
                value
              };
              yield _this3._getExistingTable(options) || _this3._deriveTable(options);
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
              yield _awaitAsyncGenerator(_iterator2.return());
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      })();
    }

    closedTranspose(indexes) {
      return indexes.map(index => {
        const options = {
          type: 'TransposedTable',
          index
        };
        return this._getExistingTable(options) || this._deriveTable(options);
      });
    }

    openTranspose(limit = Infinity) {
      var _this4 = this;

      return _wrapAsyncGenerator(function* () {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;

        var _iteratorError3;

        try {
          for (var _iterator3 = _asyncIterator(_this4.iterate({
            limit
          })), _step3, _value3; _step3 = yield _awaitAsyncGenerator(_iterator3.next()), _iteratorNormalCompletion3 = _step3.done, _value3 = yield _awaitAsyncGenerator(_step3.value), !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
            const wrappedItem = _value3;
            const options = {
              type: 'TransposedTable',
              index: wrappedItem.index
            };
            yield _this4._getExistingTable(options) || _this4._deriveTable(options);
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
              yield _awaitAsyncGenerator(_iterator3.return());
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
      })();
    }

    connect(otherTableList) {
      const newTable = this.model.createTable({
        type: 'ConnectedTable'
      });
      this._derivedTables[newTable.tableId] = true;

      for (const otherTable of otherTableList) {
        otherTable._derivedTables[newTable.tableId] = true;
      }

      this.model.trigger('update');
      return newTable;
    }

    get classObj() {
      return Object.values(this.model.classes).find(classObj => {
        return classObj.table === this;
      });
    }

    get parentTables() {
      return Object.values(this.model.tables).reduce((agg, tableObj) => {
        if (tableObj._derivedTables[this.tableId]) {
          agg.push(tableObj);
        }

        return agg;
      }, []);
    }

    get derivedTables() {
      return Object.keys(this._derivedTables).map(tableId => {
        return this.model.tables[tableId];
      });
    }

    get inUse() {
      if (Object.keys(this._derivedTables).length > 0) {
        return true;
      }

      return Object.values(this.model.classes).some(classObj => {
        return classObj.tableId === this.tableId || classObj.sourceTableIds.indexOf(this.tableId) !== -1 || classObj.targetTableIds.indexOf(this.tableId) !== -1;
      });
    }

    delete() {
      if (this.inUse) {
        const err = new Error(`Can't delete in-use table ${this.tableId}`);
        err.inUse = true;
        throw err;
      }

      for (const parentTable of this.parentTables) {
        delete parentTable.derivedTables[this.tableId];
      }

      delete this.model.tables[this.tableId];
      this.model.trigger('update');
    }

  }

  Object.defineProperty(Table, 'type', {
    get() {
      return /(.*)Table/.exec(this.name)[1];
    }

  });

  class StaticTable extends Table {
    constructor(options) {
      super(options);
      this._name = options.name;
      this._data = options.data || [];

      if (!this._name || !this._data) {
        throw new Error(`name and data are required`);
      }
    }

    get name() {
      return this._name;
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.name = this._name;
      obj.data = this._data;
      return obj;
    }

    _iterate(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        for (let index = 0; index < _this._data.length; index++) {
          const item = _this._wrap({
            index,
            row: _this._data[index]
          });

          if (_this._finishItem(item)) {
            yield item;
          }
        }
      })();
    }

  }

  class StaticDictTable extends Table {
    constructor(options) {
      super(options);
      this._name = options.name;
      this._data = options.data || {};

      if (!this._name || !this._data) {
        throw new Error(`name and data are required`);
      }
    }

    get name() {
      return this._name;
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.name = this._name;
      obj.data = this._data;
      return obj;
    }

    _iterate(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        for (const [index, row] of Object.entries(_this._data)) {
          const item = _this._wrap({
            index,
            row
          });

          if (_this._finishItem(item)) {
            yield item;
          }
        }
      })();
    }

  }

  const SingleParentMixin = function (superclass) {
    return class extends superclass {
      constructor(options) {
        super(options);
        this._instanceOfSingleParentMixin = true;
      }

      get parentTable() {
        const parentTables = this.parentTables;

        if (parentTables.length === 0) {
          throw new Error(`Parent table is required for table of type ${this.type}`);
        } else if (parentTables.length > 1) {
          throw new Error(`Only one parent table allowed for table of type ${this.type}`);
        }

        return parentTables[0];
      }

    };
  };

  Object.defineProperty(SingleParentMixin, Symbol.hasInstance, {
    value: i => !!i._instanceOfSingleParentMixin
  });

  class AggregatedTable extends SingleParentMixin(Table) {
    constructor(options) {
      super(options);
      this._attribute = options.attribute;

      if (!this._attribute) {
        throw new Error(`attribute is required`);
      }

      this._reduceAttributeFunctions = {};

      for (const [attr, stringifiedFunc] of Object.entries(options.reduceAttributeFunctions || {})) {
        this._reduceAttributeFunctions[attr] = this.model.hydrateFunction(stringifiedFunc);
      }
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.attribute = this._attribute;
      obj.reduceAttributeFunctions = {};

      for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
        obj.reduceAttributeFunctions[attr] = this.model._dehydrateFunction(func);
      }

      return obj;
    }

    get name() {
      return '↦' + this._attribute;
    }

    deriveReducedAttribute(attr, func) {
      this._reduceAttributeFunctions[attr] = func;
      this.reset();
    }

    _updateItem(originalWrappedItem, newWrappedItem) {
      for (const [attr, func] of Object.entries(this._reduceAttributeFunctions)) {
        originalWrappedItem.row[attr] = func(originalWrappedItem, newWrappedItem);
      }

      originalWrappedItem.trigger('update');
    }

    _buildCache(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        // We override _buildCache because so that AggregatedTable can take advantage
        // of the partially-built cache as it goes, and postpone finishing items
        // until after the parent table has been fully iterated
        // TODO: in large data scenarios, we should build the cache / index
        // externally on disk
        _this._partialCache = {};
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(_this._iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const wrappedItem = _value;
            _this._partialCache[wrappedItem.index] = wrappedItem; // Go ahead and yield the unfinished item; this makes it possible for
            // client apps to be more responsive and render partial results, but also
            // means that they need to watch for wrappedItem.on('update') events

            yield wrappedItem;
          } // Second pass: now that we've completed the full iteration of the parent
          // table, we can finish each item

        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        for (const index in _this._partialCache) {
          const wrappedItem = _this._partialCache[index];

          if (!_this._finishItem(wrappedItem)) {
            delete _this._partialCache[index];
          }
        }

        _this._cache = _this._partialCache;
        delete _this._partialCache;
      })();
    }

    _iterate(options) {
      var _this2 = this;

      return _wrapAsyncGenerator(function* () {
        const parentTable = _this2.parentTable;
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator(parentTable.iterate(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const wrappedParent = _value2;
            const index = String(wrappedParent.row[_this2._attribute]);

            if (!_this2._partialCache) {
              // We were reset; return immediately
              return;
            } else if (_this2._partialCache[index]) {
              const existingItem = _this2._partialCache[index];
              existingItem.connectItem(wrappedParent);
              wrappedParent.connectItem(existingItem);

              _this2._updateItem(existingItem, wrappedParent);
            } else {
              const newItem = _this2._wrap({
                index,
                itemsToConnect: [wrappedParent]
              });

              _this2._updateItem(newItem, wrappedParent);

              yield newItem;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
              yield _awaitAsyncGenerator(_iterator2.return());
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      })();
    }

    getAttributeDetails() {
      const allAttrs = super.getAttributeDetails();

      for (const attr in this._reduceAttributeFunctions) {
        allAttrs[attr] = allAttrs[attr] || {
          name: attr
        };
        allAttrs[attr].reduced = true;
      }

      return allAttrs;
    }

  }

  class ExpandedTable extends SingleParentMixin(Table) {
    constructor(options) {
      super(options);
      this._attribute = options.attribute;

      if (!this._attribute) {
        throw new Error(`attribute is required`);
      }

      this.delimiter = options.delimiter || ',';
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.attribute = this._attribute;
      return obj;
    }

    get name() {
      return this.parentTable.name + '↤';
    }

    _iterate(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        let index = 0;
        const parentTable = _this.parentTable;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const wrappedParent = _value;
            const values = (wrappedParent.row[_this._attribute] || '').split(_this.delimiter);

            for (const value of values) {
              const row = {};
              row[_this._attribute] = value;

              const newItem = _this._wrap({
                index,
                row,
                itemsToConnect: [wrappedParent]
              });

              if (_this._finishItem(newItem)) {
                yield newItem;
              }

              index++;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      })();
    }

  }

  class FacetedTable extends SingleParentMixin(Table) {
    constructor(options) {
      super(options);
      this._attribute = options.attribute;
      this._value = options.value;

      if (!this._attribute || !this._value === undefined) {
        throw new Error(`attribute and value are required`);
      }
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.attribute = this._attribute;
      obj.value = this._value;
      return obj;
    }

    get name() {
      return `[${this._value}]`;
    }

    _iterate(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        let index = 0;
        const parentTable = _this.parentTable;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(parentTable.iterate(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const wrappedParent = _value;

            if (wrappedParent.row[_this._attribute] === _this._value) {
              // Normal faceting just gives a subset of the original table
              const newItem = _this._wrap({
                index,
                row: Object.assign({}, wrappedParent.row),
                itemsToConnect: [wrappedParent]
              });

              if (_this._finishItem(newItem)) {
                yield newItem;
              }

              index++;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      })();
    }

  }

  class TransposedTable extends SingleParentMixin(Table) {
    constructor(options) {
      super(options);
      this._index = options.index;

      if (this._index === undefined) {
        throw new Error(`index is required`);
      }
    }

    _toRawObject() {
      const obj = super._toRawObject();

      obj.index = this._index;
      return obj;
    }

    get name() {
      return `ᵀ${this._index}`;
    }

    _iterate(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        // Pre-build the parent table's cache
        const parentTable = _this.parentTable;
        yield _awaitAsyncGenerator(parentTable.buildCache()); // Iterate the row's attributes as indexes

        const wrappedParent = parentTable._cache[_this._index] || {
          row: {}
        };

        for (const [index, value] of Object.entries(wrappedParent.row)) {
          const newItem = _this._wrap({
            index,
            row: typeof value === 'object' ? value : {
              value
            },
            itemsToConnect: [wrappedParent]
          });

          if (_this._finishItem(newItem)) {
            yield newItem;
          }
        }
      })();
    }

  }

  class ConnectedTable extends Table {
    get name() {
      return this.parentTables.map(parentTable => parentTable.name).join('⨯');
    }

    _iterate(options) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        const parentTables = _this.parentTables; // Spin through all of the parentTables so that their _cache is pre-built

        for (const parentTable of parentTables) {
          yield _awaitAsyncGenerator(parentTable.buildCache());
        } // Now that the caches are built, just iterate their keys directly. We only
        // care about including rows that have exact matches across all tables, so
        // we can just pick one parent table to iterate


        const baseParentTable = parentTables[0];
        const otherParentTables = parentTables.slice(1);

        for (const index in baseParentTable._cache) {
          if (!parentTables.every(table => table._cache)) {
            // One of the parent tables was reset; return immediately
            return;
          }

          if (!otherParentTables.every(table => table._cache[index])) {
            // No match in one of the other tables; omit this item
            continue;
          } // TODO: add each parent tables' keys as attribute values


          const newItem = _this._wrap({
            index,
            itemsToConnect: parentTables.map(table => table._cache[index])
          });

          if (_this._finishItem(newItem)) {
            yield newItem;
          }
        }
      })();
    }

  }



  var TABLES = /*#__PURE__*/Object.freeze({
    StaticTable: StaticTable,
    StaticDictTable: StaticDictTable,
    AggregatedTable: AggregatedTable,
    ExpandedTable: ExpandedTable,
    FacetedTable: FacetedTable,
    ConnectedTable: ConnectedTable,
    TransposedTable: TransposedTable
  });

  class GenericClass extends Introspectable {
    constructor(options) {
      super();
      this.model = options.model;
      this.classId = options.classId;
      this.tableId = options.tableId;

      if (!this.model || !this.classId || !this.tableId) {
        throw new Error(`model, classId, and tableId are required`);
      }

      this._className = options.className || null;
      this.annotations = options.annotations || {};
    }

    _toRawObject() {
      return {
        classId: this.classId,
        tableId: this.tableId,
        className: this._className,
        annotations: this.annotations
      };
    }

    setClassName(value) {
      this._className = value;
      this.model.trigger('update');
    }

    get hasCustomName() {
      return this._className !== null;
    }

    get className() {
      return this._className || this.table.name;
    }

    get table() {
      return this.model.tables[this.tableId];
    }

    _wrap(options) {
      options.classObj = this;
      return new GenericWrapper(options);
    }

    interpretAsNodes() {
      const options = this._toRawObject();

      options.type = 'NodeClass';
      options.overwrite = true;
      this.table.reset();
      return this.model.createClass(options);
    }

    interpretAsEdges() {
      const options = this._toRawObject();

      options.type = 'EdgeClass';
      options.overwrite = true;
      this.table.reset();
      return this.model.createClass(options);
    }

    _deriveNewClass(newTable, type = this.constructor.name) {
      return this.model.createClass({
        tableId: newTable.tableId,
        type
      });
    }

    aggregate(attribute) {
      return this._deriveNewClass(this.table.aggregate(attribute));
    }

    expand(attribute, delimiter) {
      return this._deriveNewClass(this.table.expand(attribute, delimiter));
    }

    closedFacet(attribute, values) {
      return this.table.closedFacet(attribute, values).map(newTable => {
        return this._deriveNewClass(newTable);
      });
    }

    openFacet(attribute) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(_this.table.openFacet(attribute)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const newTable = _value;
            yield _this._deriveNewClass(newTable);
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      })();
    }

    closedTranspose(indexes) {
      return this.table.closedTranspose(indexes).map(newTable => {
        return this._deriveNewClass(newTable);
      });
    }

    openTranspose() {
      var _this2 = this;

      return _wrapAsyncGenerator(function* () {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator(_this2.table.openTranspose()), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const newTable = _value2;
            yield _this2._deriveNewClass(newTable);
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
              yield _awaitAsyncGenerator(_iterator2.return());
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      })();
    }

    delete() {
      delete this.model.classes[this.classId];
      this.model.trigger('update');
    }

    getSampleGraph(options) {
      options.rootClass = this;
      return this.model.getSampleGraph(options);
    }

  }

  Object.defineProperty(GenericClass, 'type', {
    get() {
      return /(.*)Class/.exec(this.name)[1];
    }

  });

  class NodeWrapper extends GenericWrapper {
    constructor(options) {
      super(options);

      if (!this.classObj) {
        throw new Error(`classObj is required`);
      }
    }

    edges(options = {
      limit: Infinity
    }) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        const edgeIds = options.edgeIds || _this.classObj.edgeClassIds;
        let i = 0;

        for (const edgeId of Object.keys(edgeIds)) {
          const edgeClass = _this.classObj.model.classes[edgeId];

          if (edgeClass.sourceClassId === _this.classObj.classId) {
            options.tableIds = edgeClass.sourceTableIds.slice().reverse().concat([edgeClass.tableId]);
          } else {
            options.tableIds = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]);
          }

          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(_this.iterateAcrossConnections(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const item = _value;
              yield item;
              i++;

              if (i >= options.limit) {
                return;
              }
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                yield _awaitAsyncGenerator(_iterator.return());
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }
      })();
    }

    pairwiseNeighborhood(options) {
      var _this2 = this;

      return _wrapAsyncGenerator(function* () {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;

        var _iteratorError2;

        try {
          for (var _iterator2 = _asyncIterator(_this2.edges(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
            const edge = _value2;
            yield* _asyncGeneratorDelegate(_asyncIterator(edge.pairwiseEdges(options)), _awaitAsyncGenerator);
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
              yield _awaitAsyncGenerator(_iterator2.return());
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      })();
    }

  }

  class NodeClass extends GenericClass {
    constructor(options) {
      super(options);
      this.edgeClassIds = options.edgeClassIds || {};
    }

    _toRawObject() {
      const result = super._toRawObject();

      result.edgeClassIds = this.edgeClassIds;
      return result;
    }

    _wrap(options) {
      options.classObj = this;
      return new NodeWrapper(options);
    }

    interpretAsNodes() {
      return this;
    }

    interpretAsEdges() {
      const edgeClassIds = Object.keys(this.edgeClassIds);

      const options = super._toRawObject();

      if (edgeClassIds.length > 2) {
        // If there are more than two edges, break all connections and make
        // this a floating edge (for now, we're not dealing in hyperedges)
        this.disconnectAllEdges();
      } else if (edgeClassIds.length === 1) {
        // With only one connection, this node should become a self-edge
        const edgeClass = this.model.classes[edgeClassIds[0]]; // Are we the source or target of the existing edge (internally, in terms
        // of sourceId / targetId, not edgeClass.direction)?

        const isSource = edgeClass.sourceClassId === this.classId; // As we're converted to an edge, our new resulting source AND target
        // should be whatever is at the other end of edgeClass (if anything)

        if (isSource) {
          options.sourceClassId = options.targetClassId = edgeClass.targetClassId;
        } else {
          options.sourceClassId = options.targetClassId = edgeClass.sourceClassId;
        } // If there is a node class on the other end of edgeClass, add our
        // id to its list of connections


        const nodeClass = this.model.classes[options.sourceClassId];

        if (nodeClass) {
          nodeClass.edgeClassIds[this.classId] = true;
        } // tableId lists should emanate out from the (new) edge table; assuming
        // (for a moment) that isSource === true, we'd construct the tableId list
        // like this:


        let tableIdList = edgeClass.targetTableIds.slice().reverse().concat([edgeClass.tableId]).concat(edgeClass.sourceTableIds);

        if (!isSource) {
          // Whoops, got it backwards!
          tableIdList.reverse();
        }

        options.directed = edgeClass.directed;
        options.sourceTableIds = options.targetTableIds = tableIdList; // TODO: instead of deleting the existing edge class, should we leave it
        // hanging + unconnected?

        edgeClass.delete();
      } else if (edgeClassIds.length === 2) {
        // Okay, we've got two edges, so this is a little more straightforward
        let sourceEdgeClass = this.model.classes[edgeClassIds[0]];
        let targetEdgeClass = this.model.classes[edgeClassIds[1]]; // Figure out the direction, if there is one

        options.directed = false;

        if (sourceEdgeClass.directed && targetEdgeClass.directed) {
          if (sourceEdgeClass.targetClassId === this.classId && targetEdgeClass.sourceClassId === this.classId) {
            // We happened to get the edges in order; set directed to true
            options.directed = true;
          } else if (sourceEdgeClass.sourceClassId === this.classId && targetEdgeClass.targetClassId === this.classId) {
            // We got the edges backwards; swap them and set directed to true
            targetEdgeClass = this.model.classes[edgeClassIds[0]];
            sourceEdgeClass = this.model.classes[edgeClassIds[1]];
            options.directed = true;
          }
        } // Okay, now we know how to set source / target ids


        options.sourceClassId = sourceEdgeClass.classId;
        options.targetClassId = targetEdgeClass.classId; // If node classes exist on the other end of those edges, add this class
        // to their edgeClassIds

        if (this.model.classes[options.sourceClassId]) {
          this.model.classes[options.sourceClassId].edgeClassIds[this.classId] = true;
        }

        if (this.model.classes[options.targetClassId]) {
          this.model.classes[options.targetClassId].edgeClassIds[this.classId] = true;
        } // Concatenate the intermediate tableId lists, emanating out from the
        // (new) edge table


        options.sourceTableIds = sourceEdgeClass.targetTableIds.slice().reverse().concat([sourceEdgeClass.tableId]).concat(sourceEdgeClass.sourceTableIds);

        if (sourceEdgeClass.targetClassId === this.classId) {
          options.sourceTableIds.reverse();
        }

        options.targetTableIds = targetEdgeClass.targetTableIds.slice().reverse().concat([targetEdgeClass.tableId]).concat(targetEdgeClass.sourceTableIds);

        if (targetEdgeClass.targetClassId === this.classId) {
          options.targetTableIds.reverse();
        } // Delete each of the edge classes


        sourceEdgeClass.delete();
        targetEdgeClass.delete();
      }

      this.delete();
      delete options.edgeClassIds;
      options.type = 'EdgeClass';
      options.overwrite = true;
      this.table.reset();
      return this.model.createClass(options);
    }

    connectToNodeClass({
      otherNodeClass,
      attribute,
      otherAttribute
    }) {
      let thisHash, otherHash, sourceTableIds, targetTableIds;

      if (attribute === null) {
        thisHash = this.table;
        sourceTableIds = [];
      } else {
        thisHash = this.table.aggregate(attribute);
        sourceTableIds = [thisHash.tableId];
      }

      if (otherAttribute === null) {
        otherHash = otherNodeClass.table;
        targetTableIds = [];
      } else {
        otherHash = otherNodeClass.table.aggregate(otherAttribute);
        targetTableIds = [otherHash.tableId];
      } // If we have a self edge connecting the same attribute, we can just use
      // the AggregatedTable as the edge table; otherwise we need to create a
      // ConnectedTable


      const connectedTable = this === otherNodeClass && attribute === otherAttribute ? thisHash : thisHash.connect([otherHash]);
      const newEdgeClass = this.model.createClass({
        type: 'EdgeClass',
        tableId: connectedTable.tableId,
        sourceClassId: this.classId,
        sourceTableIds,
        targetClassId: otherNodeClass.classId,
        targetTableIds
      });
      this.edgeClassIds[newEdgeClass.classId] = true;
      otherNodeClass.edgeClassIds[newEdgeClass.classId] = true;
      this.model.trigger('update');
      return newEdgeClass;
    }

    connectToEdgeClass(options) {
      const edgeClass = options.edgeClass;
      delete options.edgeClass;
      options.nodeClass = this;
      return edgeClass.connectToNodeClass(options);
    }

    aggregate(attribute) {
      const newNodeClass = super.aggregate(attribute);
      this.connectToNodeClass({
        otherNodeClass: newNodeClass,
        attribute,
        otherAttribute: null
      });
      return newNodeClass;
    }

    disconnectAllEdges(options) {
      for (const edgeClass of this.connectedClasses()) {
        if (edgeClass.sourceClassId === this.classId) {
          edgeClass.disconnectSource(options);
        }

        if (edgeClass.targetClassId === this.classId) {
          edgeClass.disconnectTarget(options);
        }
      }
    }

    *connectedClasses() {
      for (const edgeClassId of Object.keys(this.edgeClassIds)) {
        yield this.model.classes[edgeClassId];
      }
    }

    delete() {
      this.disconnectAllEdges();
      super.delete();
    }

  }

  class EdgeWrapper extends GenericWrapper {
    constructor(options) {
      super(options);

      if (!this.classObj) {
        throw new Error(`classObj is required`);
      }
    }

    sourceNodes(options = {}) {
      var _this = this;

      return _wrapAsyncGenerator(function* () {
        if (_this.classObj.sourceClassId === null) {
          return;
        }

        const sourceTableId = _this.classObj.model.classes[_this.classObj.sourceClassId].tableId;
        options.tableIds = _this.classObj.sourceTableIds.concat([sourceTableId]);
        yield* _asyncGeneratorDelegate(_asyncIterator(_this.iterateAcrossConnections(options)), _awaitAsyncGenerator);
      })();
    }

    targetNodes(options = {}) {
      var _this2 = this;

      return _wrapAsyncGenerator(function* () {
        if (_this2.classObj.targetClassId === null) {
          return;
        }

        const targetTableId = _this2.classObj.model.classes[_this2.classObj.targetClassId].tableId;
        options.tableIds = _this2.classObj.targetTableIds.concat([targetTableId]);
        yield* _asyncGeneratorDelegate(_asyncIterator(_this2.iterateAcrossConnections(options)), _awaitAsyncGenerator);
      })();
    }

    pairwiseEdges(options) {
      var _this3 = this;

      return _wrapAsyncGenerator(function* () {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;

        var _iteratorError;

        try {
          for (var _iterator = _asyncIterator(_this3.sourceNodes(options)), _step, _value; _step = yield _awaitAsyncGenerator(_iterator.next()), _iteratorNormalCompletion = _step.done, _value = yield _awaitAsyncGenerator(_step.value), !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
            const source = _value;
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;

            var _iteratorError2;

            try {
              for (var _iterator2 = _asyncIterator(_this3.targetNodes(options)), _step2, _value2; _step2 = yield _awaitAsyncGenerator(_iterator2.next()), _iteratorNormalCompletion2 = _step2.done, _value2 = yield _awaitAsyncGenerator(_step2.value), !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                const target = _value2;
                yield {
                  source,
                  edge: _this3,
                  target
                };
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                  yield _awaitAsyncGenerator(_iterator2.return());
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
              yield _awaitAsyncGenerator(_iterator.return());
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      })();
    }

    async hyperedge(options) {
      const result = {
        sources: [],
        targets: [],
        edge: this
      };
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;

      var _iteratorError3;

      try {
        for (var _iterator3 = _asyncIterator(this.sourceNodes(options)), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
          const source = _value3;
          result.push(source);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
            await _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;

      var _iteratorError4;

      try {
        for (var _iterator4 = _asyncIterator(this.targetNodes(options)), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
          const target = _value4;
          result.push(target);
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            await _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }

  }

  class EdgeClass extends GenericClass {
    constructor(options) {
      super(options); // sourceTableIds and targetTableIds are lists of any intermediate tables,
      // beginning with the edge table (but not including it), that lead to the
      // source / target node tables (but not including) those

      this.sourceClassId = options.sourceClassId || null;
      this.sourceTableIds = options.sourceTableIds || [];
      this.targetClassId = options.targetClassId || null;
      this.targetTableIds = options.targetTableIds || [];
      this.directed = options.directed || false;
    }

    _toRawObject() {
      const result = super._toRawObject();

      result.sourceClassId = this.sourceClassId;
      result.sourceTableIds = this.sourceTableIds;
      result.targetClassId = this.targetClassId;
      result.targetTableIds = this.targetTableIds;
      result.directed = this.directed;
      return result;
    }

    _wrap(options) {
      options.classObj = this;
      return new EdgeWrapper(options);
    }

    _splitTableIdList(tableIdList, otherClass) {
      let result = {
        nodeTableIdList: [],
        edgeTableId: null,
        edgeTableIdList: []
      };

      if (tableIdList.length === 0) {
        // Weird corner case where we're trying to create an edge between
        // adjacent or identical tables... create a ConnectedTable
        result.edgeTableId = this.table.connect(otherClass.table).tableId;
        return result;
      } else {
        // Use a table in the middle as the new edge table; prioritize
        // StaticTable and StaticDictTable
        let staticExists = false;
        let tableDistances = tableIdList.map((tableId, index) => {
          staticExists = staticExists || this.model.tables[tableId].type.startsWith('Static');
          return {
            tableId,
            index,
            dist: Math.abs(tableIdList / 2 - index)
          };
        });

        if (staticExists) {
          tableDistances = tableDistances.filter(({
            tableId
          }) => {
            return this.model.tables[tableId].type.startsWith('Static');
          });
        }

        const {
          tableId,
          index
        } = tableDistances.sort((a, b) => a.dist - b.dist)[0];
        result.edgeTableId = tableId;
        result.edgeTableIdList = tableIdList.slice(0, index).reverse();
        result.nodeTableIdList = tableIdList.slice(index + 1);
      }

      return result;
    }

    interpretAsNodes() {
      const temp = this._toRawObject();

      this.disconnectSource();
      this.disconnectTarget();
      temp.type = 'NodeClass';
      temp.overwrite = true;
      const newNodeClass = this.model.createClass(temp);

      if (temp.sourceClassId) {
        const sourceClass = this.model.classes[temp.sourceClassId];

        const {
          nodeTableIdList,
          edgeTableId,
          edgeTableIdList
        } = this._splitTableIdList(temp.sourceTableIds, sourceClass);

        const sourceEdgeClass = this.model.createClass({
          type: 'EdgeClass',
          tableId: edgeTableId,
          directed: temp.directed,
          sourceClassId: temp.sourceClassId,
          sourceTableIds: nodeTableIdList,
          targetClassId: newNodeClass.classId,
          targetTableIds: edgeTableIdList
        });
        sourceClass.edgeClassIds[sourceEdgeClass.classId] = true;
        newNodeClass.edgeClassIds[sourceEdgeClass.classId] = true;
      }

      if (temp.targetClassId && temp.sourceClassId !== temp.targetClassId) {
        const targetClass = this.model.classes[temp.targetClassId];

        const {
          nodeTableIdList,
          edgeTableId,
          edgeTableIdList
        } = this._splitTableIdList(temp.targetTableIds, targetClass);

        const targetEdgeClass = this.model.createClass({
          type: 'EdgeClass',
          tableId: edgeTableId,
          directed: temp.directed,
          sourceClassId: newNodeClass.classId,
          sourceTableIds: edgeTableIdList,
          targetClassId: temp.targetClassId,
          targetTableIds: nodeTableIdList
        });
        targetClass.edgeClassIds[targetEdgeClass.classId] = true;
        newNodeClass.edgeClassIds[targetEdgeClass.classId] = true;
      }

      this.table.reset();
      this.model.trigger('update');
      return newNodeClass;
    }

    *connectedClasses() {
      if (this.sourceClassId) {
        yield this.model.classes[this.sourceClassId];
      }

      if (this.targetClassId) {
        yield this.model.classes[this.targetClassId];
      }
    }

    interpretAsEdges() {
      return this;
    }

    connectToNodeClass(options) {
      if (options.side === 'source') {
        this.connectSource(options);
      } else if (options.side === 'target') {
        this.connectTarget(options);
      } else {
        throw new Error(`PoliticalOutsiderError: "${options.side}" is an invalid side`);
      }
    }

    toggleDirection(directed) {
      if (directed === false || this.swappedDirection === true) {
        this.directed = false;
        delete this.swappedDirection;
      } else if (!this.directed) {
        this.directed = true;
        this.swappedDirection = false;
      } else {
        // Directed was already true, just switch source and target
        let temp = this.sourceClassId;
        this.sourceClassId = this.targetClassId;
        this.targetClassId = temp;
        temp = this.sourceTableIds;
        this.sourceTableIds = this.targetTableIds;
        this.targetTableIds = temp;
        this.swappedDirection = true;
      }

      this.model.trigger('update');
    }

    connectSource({
      nodeClass,
      nodeAttribute = null,
      edgeAttribute = null
    } = {}) {
      if (this.sourceClassId) {
        this.disconnectSource();
      }

      this.sourceClassId = nodeClass.classId;
      const sourceClass = this.model.classes[this.sourceClassId];
      sourceClass.edgeClassIds[this.classId] = true;
      const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
      const nodeHash = nodeAttribute === null ? sourceClass.table : sourceClass.table.aggregate(nodeAttribute);
      this.sourceTableIds = [edgeHash.connect([nodeHash]).tableId];

      if (edgeAttribute !== null) {
        this.sourceTableIds.unshift(edgeHash.tableId);
      }

      if (nodeAttribute !== null) {
        this.sourceTableIds.push(nodeHash.tableId);
      }

      this.model.trigger('update');
    }

    connectTarget({
      nodeClass,
      nodeAttribute = null,
      edgeAttribute = null
    } = {}) {
      if (this.targetClassId) {
        this.disconnectTarget();
      }

      this.targetClassId = nodeClass.classId;
      const targetClass = this.model.classes[this.targetClassId];
      targetClass.edgeClassIds[this.classId] = true;
      const edgeHash = edgeAttribute === null ? this.table : this.table.aggregate(edgeAttribute);
      const nodeHash = nodeAttribute === null ? targetClass.table : targetClass.table.aggregate(nodeAttribute);
      this.targetTableIds = [edgeHash.connect([nodeHash]).tableId];

      if (edgeAttribute !== null) {
        this.targetTableIds.unshift(edgeHash.tableId);
      }

      if (nodeAttribute !== null) {
        this.targetTableIds.push(nodeHash.tableId);
      }

      this.model.trigger('update');
    }

    disconnectSource() {
      const existingSourceClass = this.model.classes[this.sourceClassId];

      if (existingSourceClass) {
        delete existingSourceClass.edgeClassIds[this.classId];
      }

      this.sourceTableIds = [];
      this.sourceClassId = null;
      this.model.trigger('update');
    }

    disconnectTarget() {
      const existingTargetClass = this.model.classes[this.targetClassId];

      if (existingTargetClass) {
        delete existingTargetClass.edgeClassIds[this.classId];
      }

      this.targetTableIds = [];
      this.targetClassId = null;
      this.model.trigger('update');
    }

    delete() {
      this.disconnectSource();
      this.disconnectTarget();
      super.delete();
    }

  }



  var CLASSES = /*#__PURE__*/Object.freeze({
    GenericClass: GenericClass,
    NodeClass: NodeClass,
    EdgeClass: EdgeClass
  });

  const DATALIB_FORMATS = {
    'json': 'json',
    'csv': 'csv',
    'tsv': 'tsv',
    'topojson': 'topojson',
    'treejson': 'treejson'
  };

  class NetworkModel extends TriggerableMixin(class {}) {
    constructor({
      origraph,
      modelId,
      name = modelId,
      annotations = {},
      classes = {},
      tables = {}
    }) {
      super();
      this._origraph = origraph;
      this.modelId = modelId;
      this.name = name;
      this.annotations = annotations;
      this.classes = {};
      this.tables = {};
      this._nextClassId = 1;
      this._nextTableId = 1;

      for (const classObj of Object.values(classes)) {
        this.classes[classObj.classId] = this.hydrate(classObj, CLASSES);
      }

      for (const table of Object.values(tables)) {
        this.tables[table.tableId] = this.hydrate(table, TABLES);
      }

      this.on('update', () => {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => {
          this._origraph.save();

          this._saveTimeout = undefined;
        }, 0);
      });
    }

    _toRawObject() {
      const classes = {};
      const tables = {};

      for (const classObj of Object.values(this.classes)) {
        classes[classObj.classId] = classObj._toRawObject();
        classes[classObj.classId].type = classObj.type;
      }

      for (const tableObj of Object.values(this.tables)) {
        tables[tableObj.tableId] = tableObj._toRawObject();
        tables[tableObj.tableId].type = tableObj.type;
      }

      return {
        modelId: this.modelId,
        name: this.name,
        annotations: this.annotations,
        classes: this.classes,
        tables: this.tables
      };
    }

    get unsaved() {
      return this._saveTimeout !== undefined;
    }

    hydrate(rawObject, TYPES) {
      rawObject.model = this;
      return new TYPES[rawObject.type](rawObject);
    }

    createTable(options) {
      while (!options.tableId || !options.overwrite && this.tables[options.tableId]) {
        options.tableId = `table${this._nextTableId}`;
        this._nextTableId += 1;
      }

      options.model = this;
      this.tables[options.tableId] = new TABLES[options.type](options);
      this.trigger('update');
      return this.tables[options.tableId];
    }

    createClass(options = {
      selector: `empty`
    }) {
      while (!options.classId || !options.overwrite && this.classes[options.classId]) {
        options.classId = `class${this._nextClassId}`;
        this._nextClassId += 1;
      }

      options.model = this;
      this.classes[options.classId] = new CLASSES[options.type](options);
      this.trigger('update');
      return this.classes[options.classId];
    }

    async addFileAsStaticTable({
      fileObj,
      encoding = mimeTypes.charset(fileObj.type),
      extensionOverride = null,
      skipSizeCheck = false
    } = {}) {
      const fileMB = fileObj.size / 1048576;

      if (fileMB >= 30) {
        if (skipSizeCheck) {
          console.warn(`Attempting to load ${fileMB}MB file into memory`);
        } else {
          throw new Error(`${fileMB}MB file is too large to load statically`);
        }
      } // extensionOverride allows things like topojson or treejson (that don't
      // have standardized mimeTypes) to be parsed correctly


      let text = await new Promise((resolve, reject) => {
        let reader = new this.FileReader();

        reader.onload = () => {
          resolve(reader.result);
        };

        reader.readAsText(fileObj, encoding);
      });
      return this.addStringAsStaticTable({
        name: fileObj.name,
        extension: extensionOverride || mimeTypes.extension(fileObj.type),
        text
      });
    }

    addStringAsStaticTable({
      name,
      extension = 'txt',
      text
    }) {
      let data, attributes;

      if (DATALIB_FORMATS[extension]) {
        data = src.read(text, {
          type: extension
        });

        if (extension === 'csv' || extension === 'tsv') {
          attributes = {};

          for (const attr of data.columns) {
            attributes[attr] = true;
          }

          delete data.columns;
        }
      } else if (extension === 'xml') {
        throw new Error('unimplemented');
      } else if (extension === 'txt') {
        throw new Error('unimplemented');
      } else {
        throw new Error(`Unsupported file extension: ${extension}`);
      }

      return this.addStaticTable({
        name,
        data,
        attributes
      });
    }

    addStaticTable(options) {
      options.type = options.data instanceof Array ? 'StaticTable' : 'StaticDictTable';
      let newTable = this.createTable(options);
      return this.createClass({
        type: 'GenericClass',
        name: options.name,
        tableId: newTable.tableId
      });
    }

    deleteAllUnusedTables() {
      for (const tableId in this.tables) {
        if (this.tables[tableId]) {
          try {
            this.tables[tableId].delete();
          } catch (err) {
            if (!err.inUse) {
              throw err;
            }
          }
        }
      }

      this.trigger('update');
    }

    async getSampleGraph({
      rootClass = null,
      branchLimit = Infinity,
      nodeLimit = Infinity,
      edgeLimit = Infinity,
      tripleLimit = Infinity
    } = {}) {
      const sampleGraph = {
        nodes: [],
        nodeLookup: {},
        edges: [],
        edgeLookup: {}
      };
      let numTriples = 0;
      let numEdgeInstances = 0;

      const addNode = node => {
        if (!sampleGraph.nodeLookup[node.instanceId]) {
          sampleGraph.nodeLookup[node.instanceId] = sampleGraph.nodes.length;
          sampleGraph.nodes.push(node);
        }

        return sampleGraph.nodes.length <= nodeLimit;
      };

      const addEdge = edge => {
        if (!sampleGraph.edgeLookup[edge.instanceId]) {
          sampleGraph.edgeLookup[edge.instanceId] = {
            instance: edge,
            pairwiseInstances: []
          };
          numEdgeInstances++;
        }

        return numEdgeInstances <= edgeLimit;
      };

      const addTriple = (source, edge, target) => {
        if (addNode(source) && addNode(target) && addEdge(edge)) {
          sampleGraph.edgeLookup[edge.instanceId].pairwiseInstances.push(sampleGraph.edges.length);
          sampleGraph.edges.push({
            source: sampleGraph.nodeLookup[source.instanceId],
            target: sampleGraph.nodeLookup[target.instanceId],
            edgeInstance: edge
          });
          numTriples++;
          return numTriples <= tripleLimit;
        } else {
          return false;
        }
      };

      let classList = rootClass ? [rootClass] : Object.values(this.classes);

      for (const classObj of classList) {
        if (classObj.type === 'Node') {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;

          var _iteratorError;

          try {
            for (var _iterator = _asyncIterator(classObj.table.iterate()), _step, _value; _step = await _iterator.next(), _iteratorNormalCompletion = _step.done, _value = await _step.value, !_iteratorNormalCompletion; _iteratorNormalCompletion = true) {
              const node = _value;

              if (!addNode(node)) {
                return sampleGraph;
              }

              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;

              var _iteratorError2;

              try {
                for (var _iterator2 = _asyncIterator(node.pairwiseNeighborhood({
                  limit: branchLimit
                })), _step2, _value2; _step2 = await _iterator2.next(), _iteratorNormalCompletion2 = _step2.done, _value2 = await _step2.value, !_iteratorNormalCompletion2; _iteratorNormalCompletion2 = true) {
                  const {
                    source,
                    edge,
                    target
                  } = _value2;

                  if (!addTriple(source, edge, target)) {
                    return sampleGraph;
                  }
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
                    await _iterator2.return();
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                await _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        } else if (classObj.type === 'Edge') {
          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;

          var _iteratorError3;

          try {
            for (var _iterator3 = _asyncIterator(classObj.table.iterate()), _step3, _value3; _step3 = await _iterator3.next(), _iteratorNormalCompletion3 = _step3.done, _value3 = await _step3.value, !_iteratorNormalCompletion3; _iteratorNormalCompletion3 = true) {
              const edge = _value3;

              if (!addEdge(edge)) {
                return sampleGraph;
              }

              var _iteratorNormalCompletion4 = true;
              var _didIteratorError4 = false;

              var _iteratorError4;

              try {
                for (var _iterator4 = _asyncIterator(edge.pairwiseEdges({
                  limit: branchLimit
                })), _step4, _value4; _step4 = await _iterator4.next(), _iteratorNormalCompletion4 = _step4.done, _value4 = await _step4.value, !_iteratorNormalCompletion4; _iteratorNormalCompletion4 = true) {
                  const {
                    source,
                    target
                  } = _value4;

                  if (!addTriple(source, edge, target)) {
                    return sampleGraph;
                  }
                }
              } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
                    await _iterator4.return();
                  }
                } finally {
                  if (_didIteratorError4) {
                    throw _iteratorError4;
                  }
                }
              }
            }
          } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
                await _iterator3.return();
              }
            } finally {
              if (_didIteratorError3) {
                throw _iteratorError3;
              }
            }
          }
        }
      }

      return sampleGraph;
    }

    getNetworkModelGraph(includeDummies = false) {
      const edgeClasses = [];
      let graph = {
        classes: [],
        classLookup: {},
        classConnections: []
      };
      const classList = Object.values(this.classes);

      for (const classObj of classList) {
        // Add and index the class as a node
        graph.classLookup[classObj.classId] = graph.classes.length;

        const classSpec = classObj._toRawObject();

        classSpec.type = classObj.constructor.name;
        graph.classes.push(classSpec);

        if (classObj.type === 'Edge') {
          // Store the edge class so we can create classConnections later
          edgeClasses.push(classObj);
        } else if (classObj.type === 'Node' && includeDummies) {
          // Create a "potential" connection + dummy node
          graph.classConnections.push({
            id: `${classObj.classID}>dummy`,
            source: graph.classes.length,
            target: graph.classes.length,
            directed: false,
            location: 'node',
            dummy: true
          });
          graph.nodes.push({
            dummy: true
          });
        } // Create existing classConnections


        edgeClasses.forEach(edgeClass => {
          if (edgeClass.sourceClassId !== null) {
            // Connect the source node class to the edge class
            graph.classConnections.push({
              id: `${edgeClass.sourceClassId}>${edgeClass.classId}`,
              source: graph.classLookup[edgeClass.sourceClassId],
              target: graph.classLookup[edgeClass.classId],
              directed: edgeClass.directed,
              location: 'source'
            });
          } else if (includeDummies) {
            // Create a "potential" connection + dummy source class
            graph.classConnections.push({
              id: `dummy>${edgeClass.classId}`,
              source: graph.classes.length,
              target: graph.classLookup[edgeClass.classId],
              directed: edgeClass.directed,
              location: 'source',
              dummy: true
            });
            graph.classes.push({
              dummy: true
            });
          }

          if (edgeClass.targetClassId !== null) {
            // Connect the edge class to the target node class
            graph.classConnections.push({
              id: `${edgeClass.classId}>${edgeClass.targetClassId}`,
              source: graph.classLookup[edgeClass.classId],
              target: graph.classLookup[edgeClass.targetClassId],
              directed: edgeClass.directed,
              location: 'target'
            });
          } else if (includeDummies) {
            // Create a "potential" connection + dummy target class
            graph.classConnections.push({
              id: `${edgeClass.classId}>dummy`,
              source: graph.classLookup[edgeClass.classId],
              target: graph.classes.length,
              directed: edgeClass.directed,
              location: 'target',
              dummy: true
            });
            graph.classes.push({
              dummy: true
            });
          }
        });
      }

      return graph;
    }

    getTableDependencyGraph() {
      const graph = {
        tables: [],
        tableLookup: {},
        tableLinks: []
      };
      const tableList = Object.values(this.tables);

      for (const table of tableList) {
        const tableSpec = table._toRawObject();

        tableSpec.type = table.constructor.name;
        graph.tableLookup[table.tableId] = graph.tables.length;
        graph.tables.push(tableSpec);
      } // Fill the graph with links based on parentTables...


      for (const table of tableList) {
        for (const parentTable of table.parentTables) {
          graph.tableLinks.push({
            source: graph.tableLookup[parentTable.tableId],
            target: graph.tableLookup[table.tableId]
          });
        }
      }

      return graph;
    }

    getFullSchemaGraph() {
      return Object.assign(this.getNetworkModelGraph(), this.getTableDependencyGraph());
    }

    createSchemaModel() {
      const graph = this.getFullSchemaGraph();

      const newModel = this._origraph.createModel({
        name: this.name + '_schema'
      });

      let classes = newModel.addStaticTable({
        data: graph.classes,
        name: 'Classes'
      }).interpretAsNodes();
      let classConnections = newModel.addStaticTable({
        data: graph.classConnections,
        name: 'Class Connections'
      }).interpretAsEdges();
      let tables = newModel.addStaticTable({
        data: graph.tables,
        name: 'Tables'
      }).interpretAsNodes();
      let tableLinks = newModel.addStaticTable({
        data: graph.tableLinks,
        name: 'Table Links'
      }).interpretAsEdges();
      classes.connectToEdgeClass({
        edgeClass: classConnections,
        side: 'source',
        nodeAttribute: null,
        edgeAttribute: 'source'
      });
      classes.connectToEdgeClass({
        edgeClass: classConnections,
        side: 'target',
        nodeAttribute: null,
        edgeAttribute: 'target'
      });
      tables.connectToEdgeClass({
        edgeClass: tableLinks,
        side: 'source',
        nodeAttribute: null,
        edgeAttribute: 'source'
      });
      tables.connectToEdgeClass({
        edgeClass: tableLinks,
        side: 'target',
        nodeAttribute: null,
        edgeAttribute: 'target'
      });
      classes.connectToNodeClass({
        otherNodeClass: tables,
        attribute: 'tableId',
        otherAttribute: 'tableId'
      }).setClassName('Core Tables');
      return newModel;
    }

  }

  let NEXT_MODEL_ID = 1;

  class Origraph extends TriggerableMixin(class {}) {
    constructor(FileReader, localStorage) {
      super();
      this.FileReader = FileReader; // either window.FileReader or one from Node

      this.localStorage = localStorage; // either window.localStorage or null

      this.plugins = {};
      this.models = {};
      let existingModels = this.localStorage && this.localStorage.getItem('origraph_models');

      if (existingModels) {
        for (const [modelId, model] of Object.entries(JSON.parse(existingModels))) {
          model.origraph = this;
          this.models[modelId] = new NetworkModel(model);
        }
      }

      this._currentModelId = null;
    }

    registerPlugin(name, plugin) {
      this.plugins[name] = plugin;
    }

    save() {
      if (this.localStorage) {
        const models = {};

        for (const [modelId, model] of Object.entries(this.models)) {
          models[modelId] = model._toRawObject();
        }

        this.localStorage.setItem('origraph_models', JSON.stringify(models));
        this.trigger('save');
      }
    }

    closeCurrentModel() {
      this._currentModelId = null;
      this.trigger('changeCurrentModel');
    }

    get currentModel() {
      return this.models[this._currentModelId] || this.createModel();
    }

    set currentModel(model) {
      this._currentModelId = model.modelId;
      this.trigger('changeCurrentModel');
    }

    createModel(options = {}) {
      while (!options.modelId || this.models[options.modelId]) {
        options.modelId = `model${NEXT_MODEL_ID}`;
        NEXT_MODEL_ID += 1;
      }

      options.origraph = this;
      this.models[options.modelId] = new NetworkModel(options);
      this._currentModelId = options.modelId;
      this.save();
      this.trigger('changeCurrentModel');
      return this.models[options.modelId];
    }

    deleteModel(modelId = this.currentModelId) {
      if (!this.models[modelId]) {
        throw new Error(`Can't delete non-existent model: ${modelId}`);
      }

      delete this.models[modelId];

      if (this._currentModelId === modelId) {
        this._currentModelId = null;
        this.trigger('changeCurrentModel');
      }

      this.save();
    }

    deleteAllModels() {
      this.models = {};
      this._currentModelId = null;
      this.save();
      this.trigger('changeCurrentModel');
    }

  }

  var name$1 = "origraph";
  var version$1 = "0.1.4";
  var description$1 = "A library for flexible graph reshaping";
  var main$1 = "dist/origraph.cjs.js";
  var module$1 = "dist/origraph.esm.js";
  var browser$1 = "dist/origraph.umd.js";
  var scripts$1 = {
  	build: "rollup -c --environment TARGET:all",
  	watch: "rollup -c -w",
  	watchcjs: "rollup -c -w --environment TARGET:cjs",
  	watchumd: "rollup -c -w --environment TARGET:umd",
  	watchesm: "rollup -c -w --environment TARGET:esm",
  	test: "jest --runInBand",
  	pretest: "rollup -c --environment TARGET:cjs",
  	debug: "rollup -c --environment TARGET:cjs,SOURCEMAP:false && node --inspect-brk node_modules/.bin/jest --runInBand -t",
  	coveralls: "cat ./coverage/lcov.info | node node_modules/.bin/coveralls"
  };
  var files = [
  	"dist"
  ];
  var repository$1 = {
  	type: "git",
  	url: "git+https://github.com/origraph/origraph.js.git"
  };
  var author$1 = "Alex Bigelow";
  var license$1 = "MIT";
  var bugs$1 = {
  	url: "https://github.com/origraph/origraph.js/issues"
  };
  var homepage$1 = "https://github.com/origraph/origraph.js#readme";
  var devDependencies$1 = {
  	"@babel/core": "^7.1.5",
  	"@babel/plugin-proposal-async-generator-functions": "^7.1.0",
  	"@babel/preset-env": "^7.1.5",
  	"babel-core": "^7.0.0-0",
  	"babel-jest": "^23.6.0",
  	coveralls: "^3.0.2",
  	jest: "^23.6.0",
  	rollup: "^0.67.1",
  	"rollup-plugin-babel": "^4.0.3",
  	"rollup-plugin-commonjs": "^9.2.0",
  	"rollup-plugin-json": "^3.1.0",
  	"rollup-plugin-node-builtins": "^2.1.2",
  	"rollup-plugin-node-globals": "^1.4.0",
  	"rollup-plugin-node-resolve": "^3.4.0",
  	"rollup-plugin-string": "^2.0.2"
  };
  var dependencies$1 = {
  	datalib: "^1.9.1",
  	filereader: "^0.10.3",
  	"mime-types": "^2.1.21"
  };
  var peerDependencies = {
  	d3: "^5.4.0"
  };
  var pkg = {
  	name: name$1,
  	version: version$1,
  	description: description$1,
  	main: main$1,
  	module: module$1,
  	"jsnext:main": "dist/origraph.esm.js",
  	browser: browser$1,
  	scripts: scripts$1,
  	files: files,
  	repository: repository$1,
  	author: author$1,
  	license: license$1,
  	bugs: bugs$1,
  	homepage: homepage$1,
  	devDependencies: devDependencies$1,
  	dependencies: dependencies$1,
  	peerDependencies: peerDependencies
  };

  let origraph = new Origraph(window.FileReader, window.localStorage);
  origraph.version = pkg.version;

  return origraph;

})));
//# sourceMappingURL=origraph.umd.js.map
