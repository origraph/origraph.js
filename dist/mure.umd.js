(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('d3')) :
	typeof define === 'function' && define.amd ? define(['d3'], factory) :
	(global.mure = factory(global.d3));
}(this, (function (d3) { 'use strict';

class AbstractClass {
  requireProperties (properties) {
    properties.forEach(m => {
      if (this[m] === undefined) {
        throw new TypeError(m + ' is undefined for class ' + this.constructor.name);
      }
    });
  }
}

class Model extends AbstractClass {
  constructor () {
    super();
    this.eventHandlers = {};
  }
  on (eventName, callback, allowDuplicateListeners) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    if (!allowDuplicateListeners) {
      if (this.eventHandlers[eventName].indexOf(callback) !== -1) {
        return;
      }
    }
    this.eventHandlers[eventName].push(callback);
  }
  off (eventName, callback) {
    if (this.eventHandlers[eventName]) {
      if (!callback) {
        delete this.eventHandlers[eventName];
      } else {
        let index = this.eventHandlers[eventName].indexOf(callback);
        if (index >= 0) {
          this.eventHandlers[eventName].splice(index, 1);
        }
      }
    }
  }
  trigger () {
    let eventName = arguments[0];
    let args = Array.prototype.slice.call(arguments, 1);
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].forEach(callback => {
        window.setTimeout(() => {   // Add timeout to prevent blocking
          callback.apply(this, args);
        }, 0);
      });
    }
  }
}

var global$1 = typeof global !== "undefined" ? global :
            typeof self !== "undefined" ? self :
            typeof window !== "undefined" ? window : {}

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

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */


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

(function (sax) {
  // wrapper for non-node envs
  sax.parser = function (strict, opt) {
    return new SAXParser(strict, opt);
  };
  sax.SAXParser = SAXParser;
  sax.SAXStream = SAXStream;
  sax.createStream = createStream;

  // When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
  // When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
  // since that's the earliest that a buffer overrun could occur.  This way, checks are
  // as rare as required, but as often as necessary to ensure never crossing this bound.
  // Furthermore, buffers are only tested at most once per write(), so passing a very
  // large string into write() might have undesirable effects, but this is manageable by
  // the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
  // edge case, result in creating at most one complete copy of the string passed in.
  // Set to Infinity to have unlimited buffers.
  sax.MAX_BUFFER_LENGTH = 64 * 1024;

  var buffers = ['comment', 'sgmlDecl', 'textNode', 'tagName', 'doctype', 'procInstName', 'procInstBody', 'entity', 'attribName', 'attribValue', 'cdata', 'script'];

  sax.EVENTS = ['text', 'processinginstruction', 'sgmldeclaration', 'doctype', 'comment', 'opentagstart', 'attribute', 'opentag', 'closetag', 'opencdata', 'cdata', 'closecdata', 'error', 'end', 'ready', 'script', 'opennamespace', 'closenamespace'];

  function SAXParser(strict, opt) {
    if (!(this instanceof SAXParser)) {
      return new SAXParser(strict, opt);
    }

    var parser = this;
    clearBuffers(parser);
    parser.q = parser.c = '';
    parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH;
    parser.opt = opt || {};
    parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags;
    parser.looseCase = parser.opt.lowercase ? 'toLowerCase' : 'toUpperCase';
    parser.tags = [];
    parser.closed = parser.closedRoot = parser.sawRoot = false;
    parser.tag = parser.error = null;
    parser.strict = !!strict;
    parser.noscript = !!(strict || parser.opt.noscript);
    parser.state = S.BEGIN;
    parser.strictEntities = parser.opt.strictEntities;
    parser.ENTITIES = parser.strictEntities ? Object.create(sax.XML_ENTITIES) : Object.create(sax.ENTITIES);
    parser.attribList = [];

    // namespaces form a prototype chain.
    // it always points at the current tag,
    // which protos to its parent tag.
    if (parser.opt.xmlns) {
      parser.ns = Object.create(rootNS);
    }

    // mostly just for error reporting
    parser.trackPosition = parser.opt.position !== false;
    if (parser.trackPosition) {
      parser.position = parser.line = parser.column = 0;
    }
    emit(parser, 'onready');
  }

  if (!Object.create) {
    Object.create = function (o) {
      function F() {}
      F.prototype = o;
      var newf = new F();
      return newf;
    };
  }

  if (!Object.keys) {
    Object.keys = function (o) {
      var a = [];
      for (var i in o) if (o.hasOwnProperty(i)) a.push(i);
      return a;
    };
  }

  function checkBufferLength(parser) {
    var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10);
    var maxActual = 0;
    for (var i = 0, l = buffers.length; i < l; i++) {
      var len = parser[buffers[i]].length;
      if (len > maxAllowed) {
        // Text/cdata nodes can get big, and since they're buffered,
        // we can get here under normal conditions.
        // Avoid issues by emitting the text node now,
        // so at least it won't get any bigger.
        switch (buffers[i]) {
          case 'textNode':
            closeText(parser);
            break;

          case 'cdata':
            emitNode(parser, 'oncdata', parser.cdata);
            parser.cdata = '';
            break;

          case 'script':
            emitNode(parser, 'onscript', parser.script);
            parser.script = '';
            break;

          default:
            error(parser, 'Max buffer length exceeded: ' + buffers[i]);
        }
      }
      maxActual = Math.max(maxActual, len);
    }
    // schedule the next check for the earliest possible buffer overrun.
    var m = sax.MAX_BUFFER_LENGTH - maxActual;
    parser.bufferCheckPosition = m + parser.position;
  }

  function clearBuffers(parser) {
    for (var i = 0, l = buffers.length; i < l; i++) {
      parser[buffers[i]] = '';
    }
  }

  function flushBuffers(parser) {
    closeText(parser);
    if (parser.cdata !== '') {
      emitNode(parser, 'oncdata', parser.cdata);
      parser.cdata = '';
    }
    if (parser.script !== '') {
      emitNode(parser, 'onscript', parser.script);
      parser.script = '';
    }
  }

  SAXParser.prototype = {
    end: function () {
      end(this);
    },
    write: write,
    resume: function () {
      this.error = null;return this;
    },
    close: function () {
      return this.write(null);
    },
    flush: function () {
      flushBuffers(this);
    }
  };

  var Stream;
  try {
    Stream = require('stream').Stream;
  } catch (ex) {
    Stream = function () {};
  }

  var streamWraps = sax.EVENTS.filter(function (ev) {
    return ev !== 'error' && ev !== 'end';
  });

  function createStream(strict, opt) {
    return new SAXStream(strict, opt);
  }

  function SAXStream(strict, opt) {
    if (!(this instanceof SAXStream)) {
      return new SAXStream(strict, opt);
    }

    Stream.apply(this);

    this._parser = new SAXParser(strict, opt);
    this.writable = true;
    this.readable = true;

    var me = this;

    this._parser.onend = function () {
      me.emit('end');
    };

    this._parser.onerror = function (er) {
      me.emit('error', er);

      // if didn't throw, then means error was handled.
      // go ahead and clear error, so we can write again.
      me._parser.error = null;
    };

    this._decoder = null;

    streamWraps.forEach(function (ev) {
      Object.defineProperty(me, 'on' + ev, {
        get: function () {
          return me._parser['on' + ev];
        },
        set: function (h) {
          if (!h) {
            me.removeAllListeners(ev);
            me._parser['on' + ev] = h;
            return h;
          }
          me.on(ev, h);
        },
        enumerable: true,
        configurable: false
      });
    });
  }

  SAXStream.prototype = Object.create(Stream.prototype, {
    constructor: {
      value: SAXStream
    }
  });

  SAXStream.prototype.write = function (data) {
    if (typeof Buffer === 'function' && typeof isBuffer === 'function' && isBuffer(data)) {
      if (!this._decoder) {
        var SD = require('string_decoder').StringDecoder;
        this._decoder = new SD('utf8');
      }
      data = this._decoder.write(data);
    }

    this._parser.write(data.toString());
    this.emit('data', data);
    return true;
  };

  SAXStream.prototype.end = function (chunk) {
    if (chunk && chunk.length) {
      this.write(chunk);
    }
    this._parser.end();
    return true;
  };

  SAXStream.prototype.on = function (ev, handler) {
    var me = this;
    if (!me._parser['on' + ev] && streamWraps.indexOf(ev) !== -1) {
      me._parser['on' + ev] = function () {
        var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
        args.splice(0, 0, ev);
        me.emit.apply(me, args);
      };
    }

    return Stream.prototype.on.call(me, ev, handler);
  };

  // this really needs to be replaced with character classes.
  // XML allows all manner of ridiculous numbers and digits.
  var CDATA = '[CDATA[';
  var DOCTYPE = 'DOCTYPE';
  var XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
  var XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
  var rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE

    // http://www.w3.org/TR/REC-xml/#NT-NameStartChar
    // This implementation works on strings, a single character at a time
    // as such, it cannot ever support astral-plane characters (10000-EFFFF)
    // without a significant breaking change to either this  parser, or the
    // JavaScript language.  Implementation of an emoji-capable xml parser
    // is left as an exercise for the reader.
  };var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;

  var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;

  var entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
  var entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;

  function isWhitespace(c) {
    return c === ' ' || c === '\n' || c === '\r' || c === '\t';
  }

  function isQuote(c) {
    return c === '"' || c === '\'';
  }

  function isAttribEnd(c) {
    return c === '>' || isWhitespace(c);
  }

  function isMatch(regex, c) {
    return regex.test(c);
  }

  function notMatch(regex, c) {
    return !isMatch(regex, c);
  }

  var S = 0;
  sax.STATE = {
    BEGIN: S++, // leading byte order mark or whitespace
    BEGIN_WHITESPACE: S++, // leading whitespace
    TEXT: S++, // general stuff
    TEXT_ENTITY: S++, // &amp and such.
    OPEN_WAKA: S++, // <
    SGML_DECL: S++, // <!BLARG
    SGML_DECL_QUOTED: S++, // <!BLARG foo "bar
    DOCTYPE: S++, // <!DOCTYPE
    DOCTYPE_QUOTED: S++, // <!DOCTYPE "//blah
    DOCTYPE_DTD: S++, // <!DOCTYPE "//blah" [ ...
    DOCTYPE_DTD_QUOTED: S++, // <!DOCTYPE "//blah" [ "foo
    COMMENT_STARTING: S++, // <!-
    COMMENT: S++, // <!--
    COMMENT_ENDING: S++, // <!-- blah -
    COMMENT_ENDED: S++, // <!-- blah --
    CDATA: S++, // <![CDATA[ something
    CDATA_ENDING: S++, // ]
    CDATA_ENDING_2: S++, // ]]
    PROC_INST: S++, // <?hi
    PROC_INST_BODY: S++, // <?hi there
    PROC_INST_ENDING: S++, // <?hi "there" ?
    OPEN_TAG: S++, // <strong
    OPEN_TAG_SLASH: S++, // <strong /
    ATTRIB: S++, // <a
    ATTRIB_NAME: S++, // <a foo
    ATTRIB_NAME_SAW_WHITE: S++, // <a foo _
    ATTRIB_VALUE: S++, // <a foo=
    ATTRIB_VALUE_QUOTED: S++, // <a foo="bar
    ATTRIB_VALUE_CLOSED: S++, // <a foo="bar"
    ATTRIB_VALUE_UNQUOTED: S++, // <a foo=bar
    ATTRIB_VALUE_ENTITY_Q: S++, // <foo bar="&quot;"
    ATTRIB_VALUE_ENTITY_U: S++, // <foo bar=&quot
    CLOSE_TAG: S++, // </a
    CLOSE_TAG_SAW_WHITE: S++, // </a   >
    SCRIPT: S++, // <script> ...
    SCRIPT_ENDING: S++ // <script> ... <
  };

  sax.XML_ENTITIES = {
    'amp': '&',
    'gt': '>',
    'lt': '<',
    'quot': '"',
    'apos': "'"
  };

  sax.ENTITIES = {
    'amp': '&',
    'gt': '>',
    'lt': '<',
    'quot': '"',
    'apos': "'",
    'AElig': 198,
    'Aacute': 193,
    'Acirc': 194,
    'Agrave': 192,
    'Aring': 197,
    'Atilde': 195,
    'Auml': 196,
    'Ccedil': 199,
    'ETH': 208,
    'Eacute': 201,
    'Ecirc': 202,
    'Egrave': 200,
    'Euml': 203,
    'Iacute': 205,
    'Icirc': 206,
    'Igrave': 204,
    'Iuml': 207,
    'Ntilde': 209,
    'Oacute': 211,
    'Ocirc': 212,
    'Ograve': 210,
    'Oslash': 216,
    'Otilde': 213,
    'Ouml': 214,
    'THORN': 222,
    'Uacute': 218,
    'Ucirc': 219,
    'Ugrave': 217,
    'Uuml': 220,
    'Yacute': 221,
    'aacute': 225,
    'acirc': 226,
    'aelig': 230,
    'agrave': 224,
    'aring': 229,
    'atilde': 227,
    'auml': 228,
    'ccedil': 231,
    'eacute': 233,
    'ecirc': 234,
    'egrave': 232,
    'eth': 240,
    'euml': 235,
    'iacute': 237,
    'icirc': 238,
    'igrave': 236,
    'iuml': 239,
    'ntilde': 241,
    'oacute': 243,
    'ocirc': 244,
    'ograve': 242,
    'oslash': 248,
    'otilde': 245,
    'ouml': 246,
    'szlig': 223,
    'thorn': 254,
    'uacute': 250,
    'ucirc': 251,
    'ugrave': 249,
    'uuml': 252,
    'yacute': 253,
    'yuml': 255,
    'copy': 169,
    'reg': 174,
    'nbsp': 160,
    'iexcl': 161,
    'cent': 162,
    'pound': 163,
    'curren': 164,
    'yen': 165,
    'brvbar': 166,
    'sect': 167,
    'uml': 168,
    'ordf': 170,
    'laquo': 171,
    'not': 172,
    'shy': 173,
    'macr': 175,
    'deg': 176,
    'plusmn': 177,
    'sup1': 185,
    'sup2': 178,
    'sup3': 179,
    'acute': 180,
    'micro': 181,
    'para': 182,
    'middot': 183,
    'cedil': 184,
    'ordm': 186,
    'raquo': 187,
    'frac14': 188,
    'frac12': 189,
    'frac34': 190,
    'iquest': 191,
    'times': 215,
    'divide': 247,
    'OElig': 338,
    'oelig': 339,
    'Scaron': 352,
    'scaron': 353,
    'Yuml': 376,
    'fnof': 402,
    'circ': 710,
    'tilde': 732,
    'Alpha': 913,
    'Beta': 914,
    'Gamma': 915,
    'Delta': 916,
    'Epsilon': 917,
    'Zeta': 918,
    'Eta': 919,
    'Theta': 920,
    'Iota': 921,
    'Kappa': 922,
    'Lambda': 923,
    'Mu': 924,
    'Nu': 925,
    'Xi': 926,
    'Omicron': 927,
    'Pi': 928,
    'Rho': 929,
    'Sigma': 931,
    'Tau': 932,
    'Upsilon': 933,
    'Phi': 934,
    'Chi': 935,
    'Psi': 936,
    'Omega': 937,
    'alpha': 945,
    'beta': 946,
    'gamma': 947,
    'delta': 948,
    'epsilon': 949,
    'zeta': 950,
    'eta': 951,
    'theta': 952,
    'iota': 953,
    'kappa': 954,
    'lambda': 955,
    'mu': 956,
    'nu': 957,
    'xi': 958,
    'omicron': 959,
    'pi': 960,
    'rho': 961,
    'sigmaf': 962,
    'sigma': 963,
    'tau': 964,
    'upsilon': 965,
    'phi': 966,
    'chi': 967,
    'psi': 968,
    'omega': 969,
    'thetasym': 977,
    'upsih': 978,
    'piv': 982,
    'ensp': 8194,
    'emsp': 8195,
    'thinsp': 8201,
    'zwnj': 8204,
    'zwj': 8205,
    'lrm': 8206,
    'rlm': 8207,
    'ndash': 8211,
    'mdash': 8212,
    'lsquo': 8216,
    'rsquo': 8217,
    'sbquo': 8218,
    'ldquo': 8220,
    'rdquo': 8221,
    'bdquo': 8222,
    'dagger': 8224,
    'Dagger': 8225,
    'bull': 8226,
    'hellip': 8230,
    'permil': 8240,
    'prime': 8242,
    'Prime': 8243,
    'lsaquo': 8249,
    'rsaquo': 8250,
    'oline': 8254,
    'frasl': 8260,
    'euro': 8364,
    'image': 8465,
    'weierp': 8472,
    'real': 8476,
    'trade': 8482,
    'alefsym': 8501,
    'larr': 8592,
    'uarr': 8593,
    'rarr': 8594,
    'darr': 8595,
    'harr': 8596,
    'crarr': 8629,
    'lArr': 8656,
    'uArr': 8657,
    'rArr': 8658,
    'dArr': 8659,
    'hArr': 8660,
    'forall': 8704,
    'part': 8706,
    'exist': 8707,
    'empty': 8709,
    'nabla': 8711,
    'isin': 8712,
    'notin': 8713,
    'ni': 8715,
    'prod': 8719,
    'sum': 8721,
    'minus': 8722,
    'lowast': 8727,
    'radic': 8730,
    'prop': 8733,
    'infin': 8734,
    'ang': 8736,
    'and': 8743,
    'or': 8744,
    'cap': 8745,
    'cup': 8746,
    'int': 8747,
    'there4': 8756,
    'sim': 8764,
    'cong': 8773,
    'asymp': 8776,
    'ne': 8800,
    'equiv': 8801,
    'le': 8804,
    'ge': 8805,
    'sub': 8834,
    'sup': 8835,
    'nsub': 8836,
    'sube': 8838,
    'supe': 8839,
    'oplus': 8853,
    'otimes': 8855,
    'perp': 8869,
    'sdot': 8901,
    'lceil': 8968,
    'rceil': 8969,
    'lfloor': 8970,
    'rfloor': 8971,
    'lang': 9001,
    'rang': 9002,
    'loz': 9674,
    'spades': 9824,
    'clubs': 9827,
    'hearts': 9829,
    'diams': 9830
  };

  Object.keys(sax.ENTITIES).forEach(function (key) {
    var e = sax.ENTITIES[key];
    var s = typeof e === 'number' ? String.fromCharCode(e) : e;
    sax.ENTITIES[key] = s;
  });

  for (var s in sax.STATE) {
    sax.STATE[sax.STATE[s]] = s;
  }

  // shorthand
  S = sax.STATE;

  function emit(parser, event, data) {
    parser[event] && parser[event](data);
  }

  function emitNode(parser, nodeType, data) {
    if (parser.textNode) closeText(parser);
    emit(parser, nodeType, data);
  }

  function closeText(parser) {
    parser.textNode = textopts(parser.opt, parser.textNode);
    if (parser.textNode) emit(parser, 'ontext', parser.textNode);
    parser.textNode = '';
  }

  function textopts(opt, text) {
    if (opt.trim) text = text.trim();
    if (opt.normalize) text = text.replace(/\s+/g, ' ');
    return text;
  }

  function error(parser, er) {
    closeText(parser);
    if (parser.trackPosition) {
      er += '\nLine: ' + parser.line + '\nColumn: ' + parser.column + '\nChar: ' + parser.c;
    }
    er = new Error(er);
    parser.error = er;
    emit(parser, 'onerror', er);
    return parser;
  }

  function end(parser) {
    if (parser.sawRoot && !parser.closedRoot) strictFail(parser, 'Unclosed root tag');
    if (parser.state !== S.BEGIN && parser.state !== S.BEGIN_WHITESPACE && parser.state !== S.TEXT) {
      error(parser, 'Unexpected end');
    }
    closeText(parser);
    parser.c = '';
    parser.closed = true;
    emit(parser, 'onend');
    SAXParser.call(parser, parser.strict, parser.opt);
    return parser;
  }

  function strictFail(parser, message) {
    if (typeof parser !== 'object' || !(parser instanceof SAXParser)) {
      throw new Error('bad call to strictFail');
    }
    if (parser.strict) {
      error(parser, message);
    }
  }

  function newTag(parser) {
    if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]();
    var parent = parser.tags[parser.tags.length - 1] || parser;
    var tag = parser.tag = { name: parser.tagName, attributes: {}

      // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"
    };if (parser.opt.xmlns) {
      tag.ns = parent.ns;
    }
    parser.attribList.length = 0;
    emitNode(parser, 'onopentagstart', tag);
  }

  function qname(name, attribute) {
    var i = name.indexOf(':');
    var qualName = i < 0 ? ['', name] : name.split(':');
    var prefix = qualName[0];
    var local = qualName[1];

    // <x "xmlns"="http://foo">
    if (attribute && name === 'xmlns') {
      prefix = 'xmlns';
      local = '';
    }

    return { prefix: prefix, local: local };
  }

  function attrib(parser) {
    if (!parser.strict) {
      parser.attribName = parser.attribName[parser.looseCase]();
    }

    if (parser.attribList.indexOf(parser.attribName) !== -1 || parser.tag.attributes.hasOwnProperty(parser.attribName)) {
      parser.attribName = parser.attribValue = '';
      return;
    }

    if (parser.opt.xmlns) {
      var qn = qname(parser.attribName, true);
      var prefix = qn.prefix;
      var local = qn.local;

      if (prefix === 'xmlns') {
        // namespace binding attribute. push the binding into scope
        if (local === 'xml' && parser.attribValue !== XML_NAMESPACE) {
          strictFail(parser, 'xml: prefix must be bound to ' + XML_NAMESPACE + '\n' + 'Actual: ' + parser.attribValue);
        } else if (local === 'xmlns' && parser.attribValue !== XMLNS_NAMESPACE) {
          strictFail(parser, 'xmlns: prefix must be bound to ' + XMLNS_NAMESPACE + '\n' + 'Actual: ' + parser.attribValue);
        } else {
          var tag = parser.tag;
          var parent = parser.tags[parser.tags.length - 1] || parser;
          if (tag.ns === parent.ns) {
            tag.ns = Object.create(parent.ns);
          }
          tag.ns[local] = parser.attribValue;
        }
      }

      // defer onattribute events until all attributes have been seen
      // so any new bindings can take effect. preserve attribute order
      // so deferred events can be emitted in document order
      parser.attribList.push([parser.attribName, parser.attribValue]);
    } else {
      // in non-xmlns mode, we can emit the event right away
      parser.tag.attributes[parser.attribName] = parser.attribValue;
      emitNode(parser, 'onattribute', {
        name: parser.attribName,
        value: parser.attribValue
      });
    }

    parser.attribName = parser.attribValue = '';
  }

  function openTag(parser, selfClosing) {
    if (parser.opt.xmlns) {
      // emit namespace binding events
      var tag = parser.tag;

      // add namespace info to tag
      var qn = qname(parser.tagName);
      tag.prefix = qn.prefix;
      tag.local = qn.local;
      tag.uri = tag.ns[qn.prefix] || '';

      if (tag.prefix && !tag.uri) {
        strictFail(parser, 'Unbound namespace prefix: ' + JSON.stringify(parser.tagName));
        tag.uri = qn.prefix;
      }

      var parent = parser.tags[parser.tags.length - 1] || parser;
      if (tag.ns && parent.ns !== tag.ns) {
        Object.keys(tag.ns).forEach(function (p) {
          emitNode(parser, 'onopennamespace', {
            prefix: p,
            uri: tag.ns[p]
          });
        });
      }

      // handle deferred onattribute events
      // Note: do not apply default ns to attributes:
      //   http://www.w3.org/TR/REC-xml-names/#defaulting
      for (var i = 0, l = parser.attribList.length; i < l; i++) {
        var nv = parser.attribList[i];
        var name = nv[0];
        var value = nv[1];
        var qualName = qname(name, true);
        var prefix = qualName.prefix;
        var local = qualName.local;
        var uri = prefix === '' ? '' : tag.ns[prefix] || '';
        var a = {
          name: name,
          value: value,
          prefix: prefix,
          local: local,
          uri: uri

          // if there's any attributes with an undefined namespace,
          // then fail on them now.
        };if (prefix && prefix !== 'xmlns' && !uri) {
          strictFail(parser, 'Unbound namespace prefix: ' + JSON.stringify(prefix));
          a.uri = prefix;
        }
        parser.tag.attributes[name] = a;
        emitNode(parser, 'onattribute', a);
      }
      parser.attribList.length = 0;
    }

    parser.tag.isSelfClosing = !!selfClosing;

    // process the tag
    parser.sawRoot = true;
    parser.tags.push(parser.tag);
    emitNode(parser, 'onopentag', parser.tag);
    if (!selfClosing) {
      // special case for <script> in non-strict mode.
      if (!parser.noscript && parser.tagName.toLowerCase() === 'script') {
        parser.state = S.SCRIPT;
      } else {
        parser.state = S.TEXT;
      }
      parser.tag = null;
      parser.tagName = '';
    }
    parser.attribName = parser.attribValue = '';
    parser.attribList.length = 0;
  }

  function closeTag(parser) {
    if (!parser.tagName) {
      strictFail(parser, 'Weird empty close tag.');
      parser.textNode += '</>';
      parser.state = S.TEXT;
      return;
    }

    if (parser.script) {
      if (parser.tagName !== 'script') {
        parser.script += '</' + parser.tagName + '>';
        parser.tagName = '';
        parser.state = S.SCRIPT;
        return;
      }
      emitNode(parser, 'onscript', parser.script);
      parser.script = '';
    }

    // first make sure that the closing tag actually exists.
    // <a><b></c></b></a> will close everything, otherwise.
    var t = parser.tags.length;
    var tagName = parser.tagName;
    if (!parser.strict) {
      tagName = tagName[parser.looseCase]();
    }
    var closeTo = tagName;
    while (t--) {
      var close = parser.tags[t];
      if (close.name !== closeTo) {
        // fail the first time in strict mode
        strictFail(parser, 'Unexpected close tag');
      } else {
        break;
      }
    }

    // didn't find it.  we already failed for strict, so just abort.
    if (t < 0) {
      strictFail(parser, 'Unmatched closing tag: ' + parser.tagName);
      parser.textNode += '</' + parser.tagName + '>';
      parser.state = S.TEXT;
      return;
    }
    parser.tagName = tagName;
    var s = parser.tags.length;
    while (s-- > t) {
      var tag = parser.tag = parser.tags.pop();
      parser.tagName = parser.tag.name;
      emitNode(parser, 'onclosetag', parser.tagName);

      var x = {};
      for (var i in tag.ns) {
        x[i] = tag.ns[i];
      }

      var parent = parser.tags[parser.tags.length - 1] || parser;
      if (parser.opt.xmlns && tag.ns !== parent.ns) {
        // remove namespace bindings introduced by tag
        Object.keys(tag.ns).forEach(function (p) {
          var n = tag.ns[p];
          emitNode(parser, 'onclosenamespace', { prefix: p, uri: n });
        });
      }
    }
    if (t === 0) parser.closedRoot = true;
    parser.tagName = parser.attribValue = parser.attribName = '';
    parser.attribList.length = 0;
    parser.state = S.TEXT;
  }

  function parseEntity(parser) {
    var entity = parser.entity;
    var entityLC = entity.toLowerCase();
    var num;
    var numStr = '';

    if (parser.ENTITIES[entity]) {
      return parser.ENTITIES[entity];
    }
    if (parser.ENTITIES[entityLC]) {
      return parser.ENTITIES[entityLC];
    }
    entity = entityLC;
    if (entity.charAt(0) === '#') {
      if (entity.charAt(1) === 'x') {
        entity = entity.slice(2);
        num = parseInt(entity, 16);
        numStr = num.toString(16);
      } else {
        entity = entity.slice(1);
        num = parseInt(entity, 10);
        numStr = num.toString(10);
      }
    }
    entity = entity.replace(/^0+/, '');
    if (isNaN(num) || numStr.toLowerCase() !== entity) {
      strictFail(parser, 'Invalid character entity');
      return '&' + parser.entity + ';';
    }

    return String.fromCodePoint(num);
  }

  function beginWhiteSpace(parser, c) {
    if (c === '<') {
      parser.state = S.OPEN_WAKA;
      parser.startTagPosition = parser.position;
    } else if (!isWhitespace(c)) {
      // have to process this as a text node.
      // weird, but happens.
      strictFail(parser, 'Non-whitespace before first tag.');
      parser.textNode = c;
      parser.state = S.TEXT;
    }
  }

  function charAt(chunk, i) {
    var result = '';
    if (i < chunk.length) {
      result = chunk.charAt(i);
    }
    return result;
  }

  function write(chunk) {
    var parser = this;
    if (this.error) {
      throw this.error;
    }
    if (parser.closed) {
      return error(parser, 'Cannot write after close. Assign an onready handler.');
    }
    if (chunk === null) {
      return end(parser);
    }
    if (typeof chunk === 'object') {
      chunk = chunk.toString();
    }
    var i = 0;
    var c = '';
    while (true) {
      c = charAt(chunk, i++);
      parser.c = c;

      if (!c) {
        break;
      }

      if (parser.trackPosition) {
        parser.position++;
        if (c === '\n') {
          parser.line++;
          parser.column = 0;
        } else {
          parser.column++;
        }
      }

      switch (parser.state) {
        case S.BEGIN:
          parser.state = S.BEGIN_WHITESPACE;
          if (c === '\uFEFF') {
            continue;
          }
          beginWhiteSpace(parser, c);
          continue;

        case S.BEGIN_WHITESPACE:
          beginWhiteSpace(parser, c);
          continue;

        case S.TEXT:
          if (parser.sawRoot && !parser.closedRoot) {
            var starti = i - 1;
            while (c && c !== '<' && c !== '&') {
              c = charAt(chunk, i++);
              if (c && parser.trackPosition) {
                parser.position++;
                if (c === '\n') {
                  parser.line++;
                  parser.column = 0;
                } else {
                  parser.column++;
                }
              }
            }
            parser.textNode += chunk.substring(starti, i - 1);
          }
          if (c === '<' && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
            parser.state = S.OPEN_WAKA;
            parser.startTagPosition = parser.position;
          } else {
            if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) {
              strictFail(parser, 'Text data outside of root node.');
            }
            if (c === '&') {
              parser.state = S.TEXT_ENTITY;
            } else {
              parser.textNode += c;
            }
          }
          continue;

        case S.SCRIPT:
          // only non-strict
          if (c === '<') {
            parser.state = S.SCRIPT_ENDING;
          } else {
            parser.script += c;
          }
          continue;

        case S.SCRIPT_ENDING:
          if (c === '/') {
            parser.state = S.CLOSE_TAG;
          } else {
            parser.script += '<' + c;
            parser.state = S.SCRIPT;
          }
          continue;

        case S.OPEN_WAKA:
          // either a /, ?, !, or text is coming next.
          if (c === '!') {
            parser.state = S.SGML_DECL;
            parser.sgmlDecl = '';
          } else if (isWhitespace(c)) {
            // wait for it...
          } else if (isMatch(nameStart, c)) {
            parser.state = S.OPEN_TAG;
            parser.tagName = c;
          } else if (c === '/') {
            parser.state = S.CLOSE_TAG;
            parser.tagName = '';
          } else if (c === '?') {
            parser.state = S.PROC_INST;
            parser.procInstName = parser.procInstBody = '';
          } else {
            strictFail(parser, 'Unencoded <');
            // if there was some whitespace, then add that in.
            if (parser.startTagPosition + 1 < parser.position) {
              var pad = parser.position - parser.startTagPosition;
              c = new Array(pad).join(' ') + c;
            }
            parser.textNode += '<' + c;
            parser.state = S.TEXT;
          }
          continue;

        case S.SGML_DECL:
          if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
            emitNode(parser, 'onopencdata');
            parser.state = S.CDATA;
            parser.sgmlDecl = '';
            parser.cdata = '';
          } else if (parser.sgmlDecl + c === '--') {
            parser.state = S.COMMENT;
            parser.comment = '';
            parser.sgmlDecl = '';
          } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
            parser.state = S.DOCTYPE;
            if (parser.doctype || parser.sawRoot) {
              strictFail(parser, 'Inappropriately located doctype declaration');
            }
            parser.doctype = '';
            parser.sgmlDecl = '';
          } else if (c === '>') {
            emitNode(parser, 'onsgmldeclaration', parser.sgmlDecl);
            parser.sgmlDecl = '';
            parser.state = S.TEXT;
          } else if (isQuote(c)) {
            parser.state = S.SGML_DECL_QUOTED;
            parser.sgmlDecl += c;
          } else {
            parser.sgmlDecl += c;
          }
          continue;

        case S.SGML_DECL_QUOTED:
          if (c === parser.q) {
            parser.state = S.SGML_DECL;
            parser.q = '';
          }
          parser.sgmlDecl += c;
          continue;

        case S.DOCTYPE:
          if (c === '>') {
            parser.state = S.TEXT;
            emitNode(parser, 'ondoctype', parser.doctype);
            parser.doctype = true; // just remember that we saw it.
          } else {
            parser.doctype += c;
            if (c === '[') {
              parser.state = S.DOCTYPE_DTD;
            } else if (isQuote(c)) {
              parser.state = S.DOCTYPE_QUOTED;
              parser.q = c;
            }
          }
          continue;

        case S.DOCTYPE_QUOTED:
          parser.doctype += c;
          if (c === parser.q) {
            parser.q = '';
            parser.state = S.DOCTYPE;
          }
          continue;

        case S.DOCTYPE_DTD:
          parser.doctype += c;
          if (c === ']') {
            parser.state = S.DOCTYPE;
          } else if (isQuote(c)) {
            parser.state = S.DOCTYPE_DTD_QUOTED;
            parser.q = c;
          }
          continue;

        case S.DOCTYPE_DTD_QUOTED:
          parser.doctype += c;
          if (c === parser.q) {
            parser.state = S.DOCTYPE_DTD;
            parser.q = '';
          }
          continue;

        case S.COMMENT:
          if (c === '-') {
            parser.state = S.COMMENT_ENDING;
          } else {
            parser.comment += c;
          }
          continue;

        case S.COMMENT_ENDING:
          if (c === '-') {
            parser.state = S.COMMENT_ENDED;
            parser.comment = textopts(parser.opt, parser.comment);
            if (parser.comment) {
              emitNode(parser, 'oncomment', parser.comment);
            }
            parser.comment = '';
          } else {
            parser.comment += '-' + c;
            parser.state = S.COMMENT;
          }
          continue;

        case S.COMMENT_ENDED:
          if (c !== '>') {
            strictFail(parser, 'Malformed comment');
            // allow <!-- blah -- bloo --> in non-strict mode,
            // which is a comment of " blah -- bloo "
            parser.comment += '--' + c;
            parser.state = S.COMMENT;
          } else {
            parser.state = S.TEXT;
          }
          continue;

        case S.CDATA:
          if (c === ']') {
            parser.state = S.CDATA_ENDING;
          } else {
            parser.cdata += c;
          }
          continue;

        case S.CDATA_ENDING:
          if (c === ']') {
            parser.state = S.CDATA_ENDING_2;
          } else {
            parser.cdata += ']' + c;
            parser.state = S.CDATA;
          }
          continue;

        case S.CDATA_ENDING_2:
          if (c === '>') {
            if (parser.cdata) {
              emitNode(parser, 'oncdata', parser.cdata);
            }
            emitNode(parser, 'onclosecdata');
            parser.cdata = '';
            parser.state = S.TEXT;
          } else if (c === ']') {
            parser.cdata += ']';
          } else {
            parser.cdata += ']]' + c;
            parser.state = S.CDATA;
          }
          continue;

        case S.PROC_INST:
          if (c === '?') {
            parser.state = S.PROC_INST_ENDING;
          } else if (isWhitespace(c)) {
            parser.state = S.PROC_INST_BODY;
          } else {
            parser.procInstName += c;
          }
          continue;

        case S.PROC_INST_BODY:
          if (!parser.procInstBody && isWhitespace(c)) {
            continue;
          } else if (c === '?') {
            parser.state = S.PROC_INST_ENDING;
          } else {
            parser.procInstBody += c;
          }
          continue;

        case S.PROC_INST_ENDING:
          if (c === '>') {
            emitNode(parser, 'onprocessinginstruction', {
              name: parser.procInstName,
              body: parser.procInstBody
            });
            parser.procInstName = parser.procInstBody = '';
            parser.state = S.TEXT;
          } else {
            parser.procInstBody += '?' + c;
            parser.state = S.PROC_INST_BODY;
          }
          continue;

        case S.OPEN_TAG:
          if (isMatch(nameBody, c)) {
            parser.tagName += c;
          } else {
            newTag(parser);
            if (c === '>') {
              openTag(parser);
            } else if (c === '/') {
              parser.state = S.OPEN_TAG_SLASH;
            } else {
              if (!isWhitespace(c)) {
                strictFail(parser, 'Invalid character in tag name');
              }
              parser.state = S.ATTRIB;
            }
          }
          continue;

        case S.OPEN_TAG_SLASH:
          if (c === '>') {
            openTag(parser, true);
            closeTag(parser);
          } else {
            strictFail(parser, 'Forward-slash in opening tag not followed by >');
            parser.state = S.ATTRIB;
          }
          continue;

        case S.ATTRIB:
          // haven't read the attribute name yet.
          if (isWhitespace(c)) {
            continue;
          } else if (c === '>') {
            openTag(parser);
          } else if (c === '/') {
            parser.state = S.OPEN_TAG_SLASH;
          } else if (isMatch(nameStart, c)) {
            parser.attribName = c;
            parser.attribValue = '';
            parser.state = S.ATTRIB_NAME;
          } else {
            strictFail(parser, 'Invalid attribute name');
          }
          continue;

        case S.ATTRIB_NAME:
          if (c === '=') {
            parser.state = S.ATTRIB_VALUE;
          } else if (c === '>') {
            strictFail(parser, 'Attribute without value');
            parser.attribValue = parser.attribName;
            attrib(parser);
            openTag(parser);
          } else if (isWhitespace(c)) {
            parser.state = S.ATTRIB_NAME_SAW_WHITE;
          } else if (isMatch(nameBody, c)) {
            parser.attribName += c;
          } else {
            strictFail(parser, 'Invalid attribute name');
          }
          continue;

        case S.ATTRIB_NAME_SAW_WHITE:
          if (c === '=') {
            parser.state = S.ATTRIB_VALUE;
          } else if (isWhitespace(c)) {
            continue;
          } else {
            strictFail(parser, 'Attribute without value');
            parser.tag.attributes[parser.attribName] = '';
            parser.attribValue = '';
            emitNode(parser, 'onattribute', {
              name: parser.attribName,
              value: ''
            });
            parser.attribName = '';
            if (c === '>') {
              openTag(parser);
            } else if (isMatch(nameStart, c)) {
              parser.attribName = c;
              parser.state = S.ATTRIB_NAME;
            } else {
              strictFail(parser, 'Invalid attribute name');
              parser.state = S.ATTRIB;
            }
          }
          continue;

        case S.ATTRIB_VALUE:
          if (isWhitespace(c)) {
            continue;
          } else if (isQuote(c)) {
            parser.q = c;
            parser.state = S.ATTRIB_VALUE_QUOTED;
          } else {
            strictFail(parser, 'Unquoted attribute value');
            parser.state = S.ATTRIB_VALUE_UNQUOTED;
            parser.attribValue = c;
          }
          continue;

        case S.ATTRIB_VALUE_QUOTED:
          if (c !== parser.q) {
            if (c === '&') {
              parser.state = S.ATTRIB_VALUE_ENTITY_Q;
            } else {
              parser.attribValue += c;
            }
            continue;
          }
          attrib(parser);
          parser.q = '';
          parser.state = S.ATTRIB_VALUE_CLOSED;
          continue;

        case S.ATTRIB_VALUE_CLOSED:
          if (isWhitespace(c)) {
            parser.state = S.ATTRIB;
          } else if (c === '>') {
            openTag(parser);
          } else if (c === '/') {
            parser.state = S.OPEN_TAG_SLASH;
          } else if (isMatch(nameStart, c)) {
            strictFail(parser, 'No whitespace between attributes');
            parser.attribName = c;
            parser.attribValue = '';
            parser.state = S.ATTRIB_NAME;
          } else {
            strictFail(parser, 'Invalid attribute name');
          }
          continue;

        case S.ATTRIB_VALUE_UNQUOTED:
          if (!isAttribEnd(c)) {
            if (c === '&') {
              parser.state = S.ATTRIB_VALUE_ENTITY_U;
            } else {
              parser.attribValue += c;
            }
            continue;
          }
          attrib(parser);
          if (c === '>') {
            openTag(parser);
          } else {
            parser.state = S.ATTRIB;
          }
          continue;

        case S.CLOSE_TAG:
          if (!parser.tagName) {
            if (isWhitespace(c)) {
              continue;
            } else if (notMatch(nameStart, c)) {
              if (parser.script) {
                parser.script += '</' + c;
                parser.state = S.SCRIPT;
              } else {
                strictFail(parser, 'Invalid tagname in closing tag.');
              }
            } else {
              parser.tagName = c;
            }
          } else if (c === '>') {
            closeTag(parser);
          } else if (isMatch(nameBody, c)) {
            parser.tagName += c;
          } else if (parser.script) {
            parser.script += '</' + parser.tagName;
            parser.tagName = '';
            parser.state = S.SCRIPT;
          } else {
            if (!isWhitespace(c)) {
              strictFail(parser, 'Invalid tagname in closing tag');
            }
            parser.state = S.CLOSE_TAG_SAW_WHITE;
          }
          continue;

        case S.CLOSE_TAG_SAW_WHITE:
          if (isWhitespace(c)) {
            continue;
          }
          if (c === '>') {
            closeTag(parser);
          } else {
            strictFail(parser, 'Invalid characters in closing tag');
          }
          continue;

        case S.TEXT_ENTITY:
        case S.ATTRIB_VALUE_ENTITY_Q:
        case S.ATTRIB_VALUE_ENTITY_U:
          var returnState;
          var buffer;
          switch (parser.state) {
            case S.TEXT_ENTITY:
              returnState = S.TEXT;
              buffer = 'textNode';
              break;

            case S.ATTRIB_VALUE_ENTITY_Q:
              returnState = S.ATTRIB_VALUE_QUOTED;
              buffer = 'attribValue';
              break;

            case S.ATTRIB_VALUE_ENTITY_U:
              returnState = S.ATTRIB_VALUE_UNQUOTED;
              buffer = 'attribValue';
              break;
          }

          if (c === ';') {
            parser[buffer] += parseEntity(parser);
            parser.entity = '';
            parser.state = returnState;
          } else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) {
            parser.entity += c;
          } else {
            strictFail(parser, 'Invalid character in entity name');
            parser[buffer] += '&' + parser.entity + c;
            parser.entity = '';
            parser.state = returnState;
          }

          continue;

        default:
          throw new Error(parser, 'Unknown state: ' + parser.state);
      }
    } // while

    if (parser.position >= parser.bufferCheckPosition) {
      checkBufferLength(parser);
    }
    return parser;
  }

  /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
  /* istanbul ignore next */
  if (!String.fromCodePoint) {
    (function () {
      var stringFromCharCode = String.fromCharCode;
      var floor = Math.floor;
      var fromCodePoint = function () {
        var MAX_SIZE = 0x4000;
        var codeUnits = [];
        var highSurrogate;
        var lowSurrogate;
        var index = -1;
        var length = arguments.length;
        if (!length) {
          return '';
        }
        var result = '';
        while (++index < length) {
          var codePoint = Number(arguments[index]);
          if (!isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
          codePoint < 0 || // not a valid Unicode code point
          codePoint > 0x10FFFF || // not a valid Unicode code point
          floor(codePoint) !== codePoint // not an integer
          ) {
              throw RangeError('Invalid code point: ' + codePoint);
            }
          if (codePoint <= 0xFFFF) {
            // BMP code point
            codeUnits.push(codePoint);
          } else {
            // Astral code point; split in surrogate halves
            // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            codePoint -= 0x10000;
            highSurrogate = (codePoint >> 10) + 0xD800;
            lowSurrogate = codePoint % 0x400 + 0xDC00;
            codeUnits.push(highSurrogate, lowSurrogate);
          }
          if (index + 1 === length || codeUnits.length > MAX_SIZE) {
            result += stringFromCharCode.apply(null, codeUnits);
            codeUnits.length = 0;
          }
        }
        return result;
      };
      /* istanbul ignore next */
      if (Object.defineProperty) {
        Object.defineProperty(String, 'fromCodePoint', {
          value: fromCodePoint,
          configurable: true,
          writable: true
        });
      } else {
        String.fromCodePoint = fromCodePoint;
      }
    })();
  }
})(typeof exports === 'undefined' ? window.sax = {} : exports);

var sax = Object.freeze({

});

var optionsHelper = {

  copyOptions: function (options) {
    var key, copy = {};
    for (key in options) {
      if (options.hasOwnProperty(key)) {
        copy[key] = options[key];
      }
    }
    return copy;
  },

  ensureFlagExists: function (item, options) {
    if (!(item in options) || typeof options[item] !== 'boolean') {
      options[item] = false;
    }
  },

  ensureSpacesExists: function (options) {
    if (!('spaces' in options) || (typeof options.spaces !== 'number' && typeof options.spaces !== 'string')) {
      options.spaces = 0;
    }
  },

  ensureKeyExists: function (key, options) {
    if (!(key + 'Key' in options) || typeof options[key + 'Key'] !== 'string') {
      options[key + 'Key'] = options.compact ? '_' + key : key;
    }
  },

  checkFnExists: function (key, options) {
    return key + 'Fn' in options;
  }

};

var arrayHelper = {

  isArray: function(value) {
    if (Array.isArray) {
      return Array.isArray(value);
    }
    // fallback for older browsers like  IE 8
    return Object.prototype.toString.call( value ) === '[object Array]';
  }

};

var expat /*= require('node-expat');*/ = { on: function () { }, parse: function () { } };

var isArray$1 = arrayHelper.isArray;

var options;
var pureJsParser = true;
var currentElement;

function validateOptions(userOptions) {
  options = optionsHelper.copyOptions(userOptions);
  optionsHelper.ensureFlagExists('ignoreDeclaration', options);
  optionsHelper.ensureFlagExists('ignoreInstruction', options);
  optionsHelper.ensureFlagExists('ignoreAttributes', options);
  optionsHelper.ensureFlagExists('ignoreText', options);
  optionsHelper.ensureFlagExists('ignoreComment', options);
  optionsHelper.ensureFlagExists('ignoreCdata', options);
  optionsHelper.ensureFlagExists('ignoreDoctype', options);
  optionsHelper.ensureFlagExists('compact', options);
  optionsHelper.ensureFlagExists('alwaysArray', options);
  optionsHelper.ensureFlagExists('alwaysChildren', options);
  optionsHelper.ensureFlagExists('addParent', options);
  optionsHelper.ensureFlagExists('trim', options);
  optionsHelper.ensureFlagExists('nativeType', options);
  optionsHelper.ensureFlagExists('sanitize', options);
  optionsHelper.ensureFlagExists('instructionHasAttributes', options);
  optionsHelper.ensureFlagExists('captureSpacesBetweenElements', options);
  optionsHelper.ensureKeyExists('declaration', options);
  optionsHelper.ensureKeyExists('instruction', options);
  optionsHelper.ensureKeyExists('attributes', options);
  optionsHelper.ensureKeyExists('text', options);
  optionsHelper.ensureKeyExists('comment', options);
  optionsHelper.ensureKeyExists('cdata', options);
  optionsHelper.ensureKeyExists('doctype', options);
  optionsHelper.ensureKeyExists('type', options);
  optionsHelper.ensureKeyExists('name', options);
  optionsHelper.ensureKeyExists('elements', options);
  optionsHelper.ensureKeyExists('parent', options);
  optionsHelper.checkFnExists('doctype', options);
  optionsHelper.checkFnExists('instruction', options);
  optionsHelper.checkFnExists('cdata', options);
  optionsHelper.checkFnExists('comment', options);
  optionsHelper.checkFnExists('text', options);
  optionsHelper.checkFnExists('instructionName', options);
  optionsHelper.checkFnExists('elementName', options);
  optionsHelper.checkFnExists('attributeName', options);
  optionsHelper.checkFnExists('attributeValue', options);
  optionsHelper.checkFnExists('attributes', options);
  return options;
}

function nativeType(value) {
  var nValue = Number(value);
  if (!isNaN(nValue)) {
    return nValue;
  }
  var bValue = value.toLowerCase();
  if (bValue === 'true') {
    return true;
  } else if (bValue === 'false') {
    return false;
  }
  return value;
}

function addField(type, value) {
  var key;
  if (options.compact) {
    if (!currentElement[options[type + 'Key']] && options.alwaysArray) {
      currentElement[options[type + 'Key']] = [];
    }
    if (currentElement[options[type + 'Key']] && !isArray$1(currentElement[options[type + 'Key']])) {
      currentElement[options[type + 'Key']] = [currentElement[options[type + 'Key']]];
    }
    if (type + 'Fn' in options && typeof value === 'string') {
      value = options[type + 'Fn'](value, currentElement);
    }
    if (type === 'instruction' && ('instructionFn' in options || 'instructionNameFn' in options)) {
      for (key in value) {
        if (value.hasOwnProperty(key)) {
          if ('instructionFn' in options) {
            value[key] = options.instructionFn(value[key], key, currentElement);
          } else {
            var temp = value[key];
            delete value[key];
            value[options.instructionNameFn(key, temp, currentElement)] = temp;
          }
        }
      }
    }
    if (isArray$1(currentElement[options[type + 'Key']])) {
      currentElement[options[type + 'Key']].push(value);
    } else {
      currentElement[options[type + 'Key']] = value;
    }
  } else {
    if (!currentElement[options.elementsKey]) {
      currentElement[options.elementsKey] = [];
    }
    var element = {};
    element[options.typeKey] = type;
    if (type === 'instruction') {
      for (key in value) {
        if (value.hasOwnProperty(key)) {
          break;
        }
      }
      element[options.nameKey] = 'instructionNameFn' in options ? options.instructionNameFn(key, value, currentElement) : key;
      if (options.instructionHasAttributes) {
        element[options.attributesKey] = value[key][options.attributesKey];
        if ('instructionFn' in options) {
          element[options.attributesKey] = options.instructionFn(element[options.attributesKey], key, currentElement);
        }
      } else {
        if ('instructionFn' in options) {
          value[key] = options.instructionFn(value[key], key, currentElement);
        }
        element[options.instructionKey] = value[key];
      }
    } else {
      if (type + 'Fn' in options) {
        value = options[type + 'Fn'](value, currentElement);
      }
      element[options[type + 'Key']] = value;
    }
    if (options.addParent) {
      element[options.parentKey] = currentElement;
    }
    currentElement[options.elementsKey].push(element);
  }
}

function manipulateAttributes(attributes) {
  if ('attributesFn' in options && attributes) {
    attributes = options.attributesFn(attributes, currentElement);
  }
  if ((options.trim || 'attributeValueFn' in options || 'attributeNameFn' in options) && attributes) {
    var key;
    for (key in attributes) {
      if (attributes.hasOwnProperty(key)) {
        if (options.trim) attributes[key] = attributes[key].trim();
        if ('attributeValueFn' in options) attributes[key] = options.attributeValueFn(attributes[key], key, currentElement);
        if ('attributeNameFn' in options) {
          var temp = attributes[key];
          delete attributes[key];
          attributes[options.attributeNameFn(key, attributes[key], currentElement)] = temp;
        }
      }
    }
  }
  return attributes;
}

function onInstruction(instruction) {
  var attributes = {};
  if (instruction.body && (instruction.name.toLowerCase() === 'xml' || options.instructionHasAttributes)) {
    var attrsRegExp = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\w+))\s*/g;
    var match;
    while ((match = attrsRegExp.exec(instruction.body)) !== null) {
      attributes[match[1]] = match[2] || match[3] || match[4];
    }
    attributes = manipulateAttributes(attributes);
  }
  if (instruction.name.toLowerCase() === 'xml') {
    if (options.ignoreDeclaration) {
      return;
    }
    currentElement[options.declarationKey] = {};
    if (Object.keys(attributes).length) {
      currentElement[options.declarationKey][options.attributesKey] = attributes;
    }
    if (options.addParent) {
      currentElement[options.declarationKey][options.parentKey] = currentElement;
    }
  } else {
    if (options.ignoreInstruction) {
      return;
    }
    if (options.trim) {
      instruction.body = instruction.body.trim();
    }
    var value = {};
    if (options.instructionHasAttributes && Object.keys(attributes).length) {
      value[instruction.name] = {};
      value[instruction.name][options.attributesKey] = attributes;
    } else {
      value[instruction.name] = instruction.body;
    }
    addField('instruction', value);
  }
}

function onStartElement(name, attributes) {
  var element;
  if (typeof name === 'object') {
    attributes = name.attributes;
    name = name.name;
  }
  attributes = manipulateAttributes(attributes);
  if ('elementNameFn' in options) {
    name = options.elementNameFn(name, currentElement);
  }
  if (options.compact) {
    element = {};
    if (!options.ignoreAttributes && attributes && Object.keys(attributes).length) {
      element[options.attributesKey] = {};
      var key;
      for (key in attributes) {
        if (attributes.hasOwnProperty(key)) {
          element[options.attributesKey][key] = attributes[key];
        }
      }
    }
    if (!(name in currentElement) && options.alwaysArray) {
      currentElement[name] = [];
    }
    if (currentElement[name] && !isArray$1(currentElement[name])) {
      currentElement[name] = [currentElement[name]];
    }
    if (isArray$1(currentElement[name])) {
      currentElement[name].push(element);
    } else {
      currentElement[name] = element;
    }
  } else {
    if (!currentElement[options.elementsKey]) {
      currentElement[options.elementsKey] = [];
    }
    element = {};
    element[options.typeKey] = 'element';
    element[options.nameKey] = name;
    if (!options.ignoreAttributes && attributes && Object.keys(attributes).length) {
      element[options.attributesKey] = attributes;
    }
    if (options.alwaysChildren) {
      element[options.elementsKey] = [];
    }
    currentElement[options.elementsKey].push(element);
  }
  // if (options.addParent) {
    element[options.parentKey] = currentElement;
  // }
  currentElement = element;
}

function onText(text) {
  if (options.ignoreText) {
    return;
  }
  if (!text.trim() && !options.captureSpacesBetweenElements) {
    return;
  }
  if (options.trim) {
    text = text.trim();
  }
  if (options.nativeType) {
    text = nativeType(text);
  }
  if (options.sanitize) {
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  addField('text', text);
}

function onComment(comment) {
  if (options.ignoreComment) {
    return;
  }
  if (options.trim) {
    comment = comment.trim();
  }
  addField('comment', comment);
}

function onEndElement(name) {
  var parentElement = currentElement[options.parentKey];
  if (!options.addParent) {
    delete currentElement[options.parentKey];
  }
  currentElement = parentElement;
}

function onCdata(cdata) {
  if (options.ignoreCdata) {
    return;
  }
  if (options.trim) {
    cdata = cdata.trim();
  }
  addField('cdata', cdata);
}

function onDoctype(doctype) {
  if (options.ignoreDoctype) {
    return;
  }
  doctype = doctype.replace(/^ /, '');
  if (options.trim) {
    doctype = doctype.trim();
  }
  addField('doctype', doctype);
}

function onError(error) {
  error.note = error; //console.error(error);
}

var xml2js = function (xml, userOptions) {

  var parser = pureJsParser ? sax.parser(true, {}) : parser = new expat.Parser('UTF-8');
  var result = {};
  currentElement = result;

  options = validateOptions(userOptions);

  if (pureJsParser) {
    parser.onopentag = onStartElement;
    parser.ontext = onText;
    parser.oncomment = onComment;
    parser.onclosetag = onEndElement;
    parser.onerror = onError;
    parser.oncdata = onCdata;
    parser.ondoctype = onDoctype;
    parser.onprocessinginstruction = onInstruction;
  } else {
    parser.on('startElement', onStartElement);
    parser.on('text', onText);
    parser.on('comment', onComment);
    parser.on('endElement', onEndElement);
    parser.on('error', onError);
    //parser.on('startCdata', onStartCdata);
    //parser.on('endCdata', onEndCdata);
    //parser.on('entityDecl', onEntityDecl);
  }

  if (pureJsParser) {
    parser.write(xml).close();
  } else {
    if (!parser.parse(xml)) {
      throw new Error('XML parsing error: ' + parser.getError());
    }
  }

  if (result[options.elementsKey]) {
    var temp = result[options.elementsKey];
    delete result[options.elementsKey];
    result[options.elementsKey] = temp;
    delete result.text;
  }

  return result;

};

function validateOptions$1 (userOptions) {
  var options = optionsHelper.copyOptions(userOptions);
  optionsHelper.ensureSpacesExists(options);
  return options;
}

var xml2json = function(xml, userOptions) {
  var options, js, json, parentKey;
  options = validateOptions$1(userOptions);
  js = xml2js(xml, options);
  parentKey = 'compact' in options && options.compact ? '_parent' : 'parent';
  // parentKey = ptions.compact ? '_parent' : 'parent'; // consider this
  if ('addParent' in options && options.addParent) {
    json = JSON.stringify(js, function (k, v) { return k === parentKey? '_' : v; }, options.spaces);
  } else {
    json = JSON.stringify(js, null, options.spaces);
  }
  return json.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
};

var isArray$2 = arrayHelper.isArray;

var currentElement$1;
var currentElementName;

function validateOptions$2(userOptions) {
  var options = optionsHelper.copyOptions(userOptions);
  optionsHelper.ensureFlagExists('ignoreDeclaration', options);
  optionsHelper.ensureFlagExists('ignoreInstruction', options);
  optionsHelper.ensureFlagExists('ignoreAttributes', options);
  optionsHelper.ensureFlagExists('ignoreText', options);
  optionsHelper.ensureFlagExists('ignoreComment', options);
  optionsHelper.ensureFlagExists('ignoreCdata', options);
  optionsHelper.ensureFlagExists('ignoreDoctype', options);
  optionsHelper.ensureFlagExists('compact', options);
  optionsHelper.ensureFlagExists('indentText', options);
  optionsHelper.ensureFlagExists('indentCdata', options);
  optionsHelper.ensureFlagExists('indentAttributes', options);
  optionsHelper.ensureFlagExists('indentInstruction', options);
  optionsHelper.ensureFlagExists('fullTagEmptyElement', options);
  optionsHelper.ensureFlagExists('noQuotesForNativeAttributes', options);
  optionsHelper.ensureSpacesExists(options);
  if (typeof options.spaces === 'number') {
    options.spaces = Array(options.spaces + 1).join(' ');
  }
  optionsHelper.ensureKeyExists('declaration', options);
  optionsHelper.ensureKeyExists('instruction', options);
  optionsHelper.ensureKeyExists('attributes', options);
  optionsHelper.ensureKeyExists('text', options);
  optionsHelper.ensureKeyExists('comment', options);
  optionsHelper.ensureKeyExists('cdata', options);
  optionsHelper.ensureKeyExists('doctype', options);
  optionsHelper.ensureKeyExists('type', options);
  optionsHelper.ensureKeyExists('name', options);
  optionsHelper.ensureKeyExists('elements', options);
  optionsHelper.checkFnExists('doctype', options);
  optionsHelper.checkFnExists('instruction', options);
  optionsHelper.checkFnExists('cdata', options);
  optionsHelper.checkFnExists('comment', options);
  optionsHelper.checkFnExists('text', options);
  optionsHelper.checkFnExists('instructionName', options);
  optionsHelper.checkFnExists('elementName', options);
  optionsHelper.checkFnExists('attributeName', options);
  optionsHelper.checkFnExists('attributeValue', options);
  optionsHelper.checkFnExists('attributes', options);
  optionsHelper.checkFnExists('fullTagEmptyElement', options);
  return options;
}

function writeIndentation(options, depth, firstLine) {
  return (!firstLine && options.spaces ? '\n' : '') + Array(depth + 1).join(options.spaces);
}

function writeAttributes(attributes, options, depth) {
  if (options.ignoreAttributes) {
    return '';
  }
  if ('attributesFn' in options) {
    attributes = options.attributesFn(attributes, currentElementName, currentElement$1);
  }
  var key, attr, attrName, quote, result = '';
  for (key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      quote = options.noQuotesForNativeAttributes && typeof attributes[key] !== 'string' ? '' : '"';
      attr = '' + attributes[key]; // ensure number and boolean are converted to String
      attr = attr.replace(/"/g, '&quot;');
      attrName = 'attributeNameFn' in options ? options.attributeNameFn(key, attr, currentElementName, currentElement$1) : key;
      result += (options.spaces && options.indentAttributes? writeIndentation(options, depth+1, false) : ' ');
      result += attrName + '=' + quote + ('attributeValueFn' in options ? options.attributeValueFn(attr, key, currentElementName, currentElement$1) : attr) + quote;
    }
  }
  if (attributes && Object.keys(attributes).length && options.spaces && options.indentAttributes) {
    result += writeIndentation(options, depth, false);
  }
  return result;
}

function writeDeclaration(declaration, options, depth) {
  currentElement$1 = declaration;
  currentElementName = 'xml';
  return options.ignoreDeclaration ? '' :  '<?' + 'xml' + writeAttributes(declaration[options.attributesKey], options, depth) + '?>';
}

function writeInstruction(instruction, options, depth) {
  if (options.ignoreInstruction) {
    return '';
  }
  var key;
  for (key in instruction) {
    if (instruction.hasOwnProperty(key)) {
      break;
    }
  }
  var instructionName = 'instructionNameFn' in options ? options.instructionNameFn(key, instruction[key], currentElementName, currentElement$1) : key;
  if (typeof instruction[key] === 'object') {
    currentElement$1 = instruction;
    currentElementName = instructionName;
    return '<?' + instructionName + writeAttributes(instruction[key][options.attributesKey], options, depth) + '?>';
  } else {
    var instructionValue = instruction[key] ? instruction[key] : '';
    if ('instructionFn' in options) instructionValue = options.instructionFn(instructionValue, key, currentElementName, currentElement$1);
    return '<?' + instructionName + (instructionValue ? ' ' + instructionValue : '') + '?>';
  }
}

function writeComment(comment, options) {
  return options.ignoreComment ? '' : '<!--' + ('commentFn' in options ? options.commentFn(comment, currentElementName, currentElement$1) : comment) + '-->';
}

function writeCdata(cdata, options) {
  return options.ignoreCdata ? '' : '<![CDATA[' + ('cdataFn' in options ? options.cdataFn(cdata, currentElementName, currentElement$1) : cdata) + ']]>';
}

function writeDoctype(doctype, options) {
  return options.ignoreDoctype ? '' : '<!DOCTYPE ' + ('doctypeFn' in options ? options.doctypeFn(doctype, currentElementName, currentElement$1) : doctype) + '>';
}

function writeText(text, options) {
  if (options.ignoreText) return '';
  text = '' + text; // ensure Number and Boolean are converted to String
  text = text.replace(/&amp;/g, '&'); // desanitize to avoid double sanitization
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return 'textFn' in options ? options.textFn(text, currentElementName, currentElement$1) : text;
}

function hasContent(element, options) {
  var i;
  if (element.elements && element.elements.length) {
    for (i = 0; i < element.elements.length; ++i) {
      switch (element.elements[i][options.typeKey]) {
      case 'text':
        if (options.indentText) {
          return true;
        }
        break; // skip to next key
      case 'cdata':
        if (options.indentCdata) {
          return true;
        }
        break; // skip to next key
      case 'instruction':
        if (options.indentInstruction) {
          return true;
        }
        break; // skip to next key
      case 'doctype':
      case 'comment':
      case 'element':
        return true;
      default:
        return true;
      }
    }
  }
  return false;
}

function writeElement(element, options, depth) {
  currentElement$1 = element;
  currentElementName = element.name;
  var xml = '', elementName = 'elementNameFn' in options ? options.elementNameFn(element.name, element) : element.name;
  xml += '<' + elementName;
  if (element[options.attributesKey]) {
    xml += writeAttributes(element[options.attributesKey], options, depth);
  }
  var withClosingTag = element[options.elementsKey] && element[options.elementsKey].length || element[options.attributesKey] && element[options.attributesKey]['xml:space'] === 'preserve';
  if (!withClosingTag) {
    if ('fullTagEmptyElementFn' in options) {
      withClosingTag = options.fullTagEmptyElementFn(element.name, element);
    } else {
      withClosingTag = options.fullTagEmptyElement;
    }
  }
  if (withClosingTag) {
    xml += '>';
    if (element[options.elementsKey] && element[options.elementsKey].length) {
      xml += writeElements(element[options.elementsKey], options, depth + 1);
      currentElement$1 = element;
      currentElementName = element.name;
    }
    xml += options.spaces && hasContent(element, options) ? '\n' + Array(depth + 1).join(options.spaces) : '';
    xml += '</' + elementName + '>';
  } else {
    xml += '/>';
  }
  return xml;
}

function writeElements(elements, options, depth, firstLine) {
  return elements.reduce(function (xml, element) {
    var indent = writeIndentation(options, depth, firstLine && !xml);
    switch (element.type) {
    case 'element': return xml + indent + writeElement(element, options, depth);
    case 'comment': return xml + indent + writeComment(element[options.commentKey], options);
    case 'doctype': return xml + indent + writeDoctype(element[options.doctypeKey], options);
    case 'cdata': return xml + (options.indentCdata ? indent : '') + writeCdata(element[options.cdataKey], options);
    case 'text': return xml + (options.indentText ? indent : '') + writeText(element[options.textKey], options);
    case 'instruction':
      var instruction = {};
      instruction[element[options.nameKey]] = element[options.attributesKey] ? element : element[options.instructionKey];
      return xml + (options.indentInstruction ? indent : '') + writeInstruction(instruction, options, depth);
    }
  }, '');
}

function hasContentCompact(element, options, anyContent) {
  var key;
  for (key in element) {
    if (element.hasOwnProperty(key)) {
      switch (key) {
      case options.parentKey:
      case options.attributesKey:
        break; // skip to next key
      case options.textKey:
        if (options.indentText || anyContent) {
          return true;
        }
        break; // skip to next key
      case options.cdataKey:
        if (options.indentCdata || anyContent) {
          return true;
        }
        break; // skip to next key
      case options.instructionKey:
        if (options.indentInstruction || anyContent) {
          return true;
        }
        break; // skip to next key
      case options.doctypeKey:
      case options.commentKey:
        return true;
      default:
        return true;
      }
    }
  }
  return false;
}

function writeElementCompact(element, name, options, depth, indent) {
  currentElement$1 = element;
  currentElementName = name;
  var elementName = 'elementNameFn' in options ? options.elementNameFn(name, element) : name;
  if (typeof element === 'undefined' || element === null) {
    return 'fullTagEmptyElementFn' in options && options.fullTagEmptyElementFn(name, element) || options.fullTagEmptyElement ? '<' + elementName + '></' + elementName + '>' : '<' + elementName + '/>';
  }
  var xml = '';
  if (name) {
    xml += '<' + elementName;
    if (typeof element !== 'object') {
      xml += '>' + writeText(element,options) + '</' + elementName + '>';
      return xml;
    }
    if (element[options.attributesKey]) {
      xml += writeAttributes(element[options.attributesKey], options, depth);
    }
    var withClosingTag = hasContentCompact(element, options, true) || element[options.attributesKey] && element[options.attributesKey]['xml:space'] === 'preserve';
    if (!withClosingTag) {
      if ('fullTagEmptyElementFn' in options) {
        withClosingTag = options.fullTagEmptyElementFn(name, element);
      } else {
        withClosingTag = options.fullTagEmptyElement;
      }
    }
    if (withClosingTag) {
      xml += '>';
    } else {
      xml += '/>';
      return xml;
    }
  }
  xml += writeElementsCompact(element, options, depth + 1, false);
  currentElement$1 = element;
  currentElementName = name;
  if (name) {
    xml += (indent ? writeIndentation(options, depth, false) : '') + '</' + elementName + '>';
  }
  return xml;
}

function writeElementsCompact(element, options, depth, firstLine) {
  var i, key, nodes, xml = '';
  for (key in element) {
    if (element.hasOwnProperty(key)) {
      nodes = isArray$2(element[key]) ? element[key] : [element[key]];
      for (i = 0; i < nodes.length; ++i) {
        switch (key) {
        case options.declarationKey: xml += writeDeclaration(nodes[i], options, depth); break;
        case options.instructionKey: xml += (options.indentInstruction ? writeIndentation(options, depth, firstLine) : '') + writeInstruction(nodes[i], options, depth); break;
        case options.attributesKey: case options.parentKey: break; // skip
        case options.textKey: xml += (options.indentText ? writeIndentation(options, depth, firstLine) : '') + writeText(nodes[i], options); break;
        case options.cdataKey: xml += (options.indentCdata ? writeIndentation(options, depth, firstLine) : '') + writeCdata(nodes[i], options); break;
        case options.doctypeKey: xml += writeIndentation(options, depth, firstLine) + writeDoctype(nodes[i], options); break;
        case options.commentKey: xml += writeIndentation(options, depth, firstLine) + writeComment(nodes[i], options); break;
        default: xml += writeIndentation(options, depth, firstLine) + writeElementCompact(nodes[i], key, options, depth, hasContentCompact(nodes[i], options));
        }
        firstLine = firstLine && !xml;
      }
    }
  }
  return xml;
}

var js2xml = function (js, options) {
  options = validateOptions$2(options);
  var xml = '';
  currentElement$1 = js;
  currentElementName = '_root_';
  if (options.compact) {
    xml = writeElementsCompact(js, options, 0, true);
  } else {
    if (js[options.declarationKey]) {
      xml += writeDeclaration(js[options.declarationKey], options, 0);
    }
    if (js[options.elementsKey] && js[options.elementsKey].length) {
      xml += writeElements(js[options.elementsKey], options, 0, !xml);
    }
  }
  return xml;
};

var js2xml$2 = require('./js2xml.js');

module.exports = function (json, options) {
  if (json instanceof Buffer) {
    json = json.toString();
  }
  var js = null;
  if (typeof (json) === 'string') {
    try {
      js = JSON.parse(json);
    } catch (e) {
      throw new Error('The JSON structure is invalid');
    }
  } else {
    js = json;
  }
  return js2xml$2(js, options);
};


var json2xml = Object.freeze({

});

/*jslint node:true */






var lib = {
  xml2js: xml2js,
  xml2json: xml2json,
  js2xml: js2xml,
  json2xml: json2xml
};

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};



function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var createGenerator = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", {
  value: true
});
// @flow

/*:: import type {
  CombinatorTokenType,
  SelectorTokenType
} from './types';*/


var escapeValue = function escapeValue(value /*: string*/) /*: string*/ {
  return JSON.stringify(value);
};

var renderSelector = function renderSelector(selectorToken /*: SelectorTokenType*/) {
  var tokens = selectorToken.body;
  var parts = [];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = tokens[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var token = _step.value;

      var part = void 0;

      if (token.type === 'universalSelector') {
        part = '*';
      } else if (token.type === 'typeSelector') {
        part = token.name;
      } else if (token.type === 'idSelector') {
        part = '#' + token.name;
      } else if (token.type === 'classSelector') {
        part = '.' + token.name;
      } else if (token.type === 'attributePresenceSelector') {
        part = '[' + token.name + ']';
      } else if (token.type === 'attributeValueSelector') {
        part = '[' + token.name + token.operator + escapeValue(token.value) + ']';
      } else if (token.type === 'pseudoClassSelector') {
        part = ':' + token.name;

        if (token.parameters.length) {
          part += '(' + token.parameters.map(escapeValue).join(', ') + ')';
        }
      } else if (token.type === 'pseudoElementSelector') {
        part = '::' + token.name;
      } else {
        throw new Error('Unknown token.');
      }

      parts.push(part);
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return parts.join('');
};

exports.default = function () {
  var generate = function generate(tokens /*: Array<SelectorTokenType | CombinatorTokenType>*/) /*: string*/ {
    /**
     * @todo Think of a better name. This array contains selectors or combinators.
     */
    var sequences /*: Array<string>*/ = [];

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = tokens[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var token = _step2.value;

        if (token.type === 'selector') {
          sequences.push(renderSelector(token));
        } else if (token.type === 'descendantCombinator') {
          sequences.push(' ');
        } else if (token.type === 'childCombinator') {
          sequences.push(' > ');
        } else if (token.type === 'adjacentSiblingCombinator') {
          sequences.push(' + ');
        } else if (token.type === 'generalSiblingCombinator') {
          sequences.push(' ~ ');
        } else {
          throw new Error('Unknown token.');
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return sequences.join('');
  };

  return {
    generate
  };
};

});

unwrapExports(createGenerator);

var nearley = createCommonjsModule(function (module) {
(function(root, factory) {
    if ('object' === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.nearley = factory();
    }
}(commonjsGlobal, function() {

function Rule(name, symbols, postprocess) {
    this.id = ++Rule.highestId;
    this.name = name;
    this.symbols = symbols;        // a list of literal | regex class | nonterminal
    this.postprocess = postprocess;
    return this;
}
Rule.highestId = 0;

Rule.prototype.toString = function(withCursorAt) {
    function stringifySymbolSequence (e) {
        return e.literal ? JSON.stringify(e.literal) :
               e.type ? '%' + e.type : e.toString();
    }
    var symbolSequence = (typeof withCursorAt === "undefined")
                         ? this.symbols.map(stringifySymbolSequence).join(' ')
                         : (   this.symbols.slice(0, withCursorAt).map(stringifySymbolSequence).join(' ')
                             + " ● "
                             + this.symbols.slice(withCursorAt).map(stringifySymbolSequence).join(' ')     );
    return this.name + " → " + symbolSequence;
};


// a State is a rule at a position from a given starting point in the input stream (reference)
function State(rule, dot, reference, wantedBy) {
    this.rule = rule;
    this.dot = dot;
    this.reference = reference;
    this.data = [];
    this.wantedBy = wantedBy;
    this.isComplete = this.dot === rule.symbols.length;
}

State.prototype.toString = function() {
    return "{" + this.rule.toString(this.dot) + "}, from: " + (this.reference || 0);
};

State.prototype.nextState = function(child) {
    var state = new State(this.rule, this.dot + 1, this.reference, this.wantedBy);
    state.left = this;
    state.right = child;
    if (state.isComplete) {
        state.data = state.build();
    }
    return state;
};

State.prototype.build = function() {
    var children = [];
    var node = this;
    do {
        children.push(node.right.data);
        node = node.left;
    } while (node.left);
    children.reverse();
    return children;
};

State.prototype.finish = function() {
    if (this.rule.postprocess) {
        this.data = this.rule.postprocess(this.data, this.reference, Parser.fail);
    }
};


function Column(grammar, index) {
    this.grammar = grammar;
    this.index = index;
    this.states = [];
    this.wants = {}; // states indexed by the non-terminal they expect
    this.scannable = []; // list of states that expect a token
    this.completed = {}; // states that are nullable
}


Column.prototype.process = function(nextColumn) {
    var states = this.states;
    var wants = this.wants;
    var completed = this.completed;

    for (var w = 0; w < states.length; w++) { // nb. we push() during iteration
        var state = states[w];

        if (state.isComplete) {
            state.finish();
            if (state.data !== Parser.fail) {
                // complete
                var wantedBy = state.wantedBy;
                for (var i = wantedBy.length; i--; ) { // this line is hot
                    var left = wantedBy[i];
                    this.complete(left, state);
                }

                // special-case nullables
                if (state.reference === this.index) {
                    // make sure future predictors of this rule get completed.
                    var exp = state.rule.name;
                    (this.completed[exp] = this.completed[exp] || []).push(state);
                }
            }

        } else {
            // queue scannable states
            var exp = state.rule.symbols[state.dot];
            if (typeof exp !== 'string') {
                this.scannable.push(state);
                continue;
            }

            // predict
            if (wants[exp]) {
                wants[exp].push(state);

                if (completed.hasOwnProperty(exp)) {
                    var nulls = completed[exp];
                    for (var i = 0; i < nulls.length; i++) {
                        var right = nulls[i];
                        this.complete(state, right);
                    }
                }
            } else {
                wants[exp] = [state];
                this.predict(exp);
            }
        }
    }
};

Column.prototype.predict = function(exp) {
    var rules = this.grammar.byName[exp] || [];

    for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        var wantedBy = this.wants[exp];
        var s = new State(r, 0, this.index, wantedBy);
        this.states.push(s);
    }
};

Column.prototype.complete = function(left, right) {
    var inp = right.rule.name;
    if (left.rule.symbols[left.dot] === inp) {
        var copy = left.nextState(right);
        this.states.push(copy);
    }
};


function Grammar(rules, start) {
    this.rules = rules;
    this.start = start || this.rules[0].name;
    var byName = this.byName = {};
    this.rules.forEach(function(rule) {
        if (!byName.hasOwnProperty(rule.name)) {
            byName[rule.name] = [];
        }
        byName[rule.name].push(rule);
    });
}

// So we can allow passing (rules, start) directly to Parser for backwards compatibility
Grammar.fromCompiled = function(rules, start) {
    var lexer = rules.Lexer;
    if (rules.ParserStart) {
      start = rules.ParserStart;
      rules = rules.ParserRules;
    }
    var rules = rules.map(function (r) { return (new Rule(r.name, r.symbols, r.postprocess)); });
    var g = new Grammar(rules, start);
    g.lexer = lexer; // nb. storing lexer on Grammar is iffy, but unavoidable
    return g;
};


function StreamLexer() {
  this.reset("");
}

StreamLexer.prototype.reset = function(data, state) {
    this.buffer = data;
    this.index = 0;
    this.line = state ? state.line : 1;
    this.lastLineBreak = state ? -state.col : 0;
};

StreamLexer.prototype.next = function() {
    if (this.index < this.buffer.length) {
        var ch = this.buffer[this.index++];
        if (ch === '\n') {
          this.line += 1;
          this.lastLineBreak = this.index;
        }
        return {value: ch};
    }
};

StreamLexer.prototype.save = function() {
  return {
    line: this.line,
    col: this.index - this.lastLineBreak,
  }
};

StreamLexer.prototype.formatError = function(token, message) {
    // nb. this gets called after consuming the offending token,
    // so the culprit is index-1
    var buffer = this.buffer;
    if (typeof buffer === 'string') {
        var nextLineBreak = buffer.indexOf('\n', this.index);
        if (nextLineBreak === -1) nextLineBreak = buffer.length;
        var line = buffer.substring(this.lastLineBreak, nextLineBreak);
        var col = this.index - this.lastLineBreak;
        message += " at line " + this.line + " col " + col + ":\n\n";
        message += "  " + line + "\n";
        message += "  " + Array(col).join(" ") + "^";
        return message;
    } else {
        return message + " at index " + (this.index - 1);
    }
};


function Parser(rules, start, options) {
    if (rules instanceof Grammar) {
        var grammar = rules;
        var options = start;
    } else {
        var grammar = Grammar.fromCompiled(rules, start);
    }
    this.grammar = grammar;

    // Read options
    this.options = {
        keepHistory: false,
        lexer: grammar.lexer || new StreamLexer,
    };
    for (var key in (options || {})) {
        this.options[key] = options[key];
    }

    // Setup lexer
    this.lexer = this.options.lexer;
    this.lexerState = undefined;

    // Setup a table
    var column = new Column(grammar, 0);
    var table = this.table = [column];

    // I could be expecting anything.
    column.wants[grammar.start] = [];
    column.predict(grammar.start);
    // TODO what if start rule is nullable?
    column.process();
    this.current = 0; // token index
}

// create a reserved token for indicating a parse fail
Parser.fail = {};

Parser.prototype.feed = function(chunk) {
    var lexer = this.lexer;
    lexer.reset(chunk, this.lexerState);

    var token;
    while (token = lexer.next()) {
        // We add new states to table[current+1]
        var column = this.table[this.current];

        // GC unused states
        if (!this.options.keepHistory) {
            delete this.table[this.current - 1];
        }

        var n = this.current + 1;
        var nextColumn = new Column(this.grammar, n);
        this.table.push(nextColumn);

        // Advance all tokens that expect the symbol
        var literal = token.value;
        var value = lexer.constructor === StreamLexer ? token.value : token;
        var scannable = column.scannable;
        for (var w = scannable.length; w--; ) {
            var state = scannable[w];
            var expect = state.rule.symbols[state.dot];
            // Try to consume the token
            // either regex or literal
            if (expect.test ? expect.test(value) :
                expect.type ? expect.type === token.type
                            : expect.literal === literal) {
                // Add it
                var next = state.nextState({data: value, token: token, isToken: true, reference: n - 1});
                nextColumn.states.push(next);
            }
        }

        // Next, for each of the rules, we either
        // (a) complete it, and try to see if the reference row expected that
        //     rule
        // (b) predict the next nonterminal it expects by adding that
        //     nonterminal's start state
        // To prevent duplication, we also keep track of rules we have already
        // added

        nextColumn.process();

        // If needed, throw an error:
        if (nextColumn.states.length === 0) {
            // No states at all! This is not good.
            var message = this.lexer.formatError(token, "invalid syntax") + "\n";
            message += "Unexpected " + (token.type ? token.type + " token: " : "");
            message += JSON.stringify(token.value !== undefined ? token.value : token) + "\n";
            var err = new Error(message);
            err.offset = this.current;
            err.token = token;
            throw err;
        }

        // maybe save lexer state
        if (this.options.keepHistory) {
          column.lexerState = lexer.save();
        }

        this.current++;
    }
    if (column) {
      this.lexerState = lexer.save();
    }

    // Incrementally keep track of results
    this.results = this.finish();

    // Allow chaining, for whatever it's worth
    return this;
};

Parser.prototype.save = function() {
    var column = this.table[this.current];
    column.lexerState = this.lexerState;
    return column;
};

Parser.prototype.restore = function(column) {
    var index = column.index;
    this.current = index;
    this.table[index] = column;
    this.table.splice(index + 1);
    this.lexerState = column.lexerState;

    // Incrementally keep track of results
    this.results = this.finish();
};

// nb. deprecated: use save/restore instead!
Parser.prototype.rewind = function(index) {
    if (!this.options.keepHistory) {
        throw new Error('set option `keepHistory` to enable rewinding')
    }
    // nb. recall column (table) indicies fall between token indicies.
    //        col 0   --   token 0   --   col 1
    this.restore(this.table[index]);
};

Parser.prototype.finish = function() {
    // Return the possible parsings
    var considerations = [];
    var start = this.grammar.start;
    var column = this.table[this.table.length - 1];
    column.states.forEach(function (t) {
        if (t.rule.name === start
                && t.dot === t.rule.symbols.length
                && t.reference === 0
                && t.data !== Parser.fail) {
            considerations.push(t);
        }
    });
    return considerations.map(function(c) {return c.data; });
};

return {
    Parser: Parser,
    Grammar: Grammar,
    Rule: Rule,
};

}));
});

var grammar = createCommonjsModule(function (module) {
(function () {
  function id(x) {
    return x[0];
  }

  var appendItem = function appendItem(a, b) {
    return function (d) {
      return d[a].concat([d[b]]);
    };
  };
  var flatten = function flatten(d) {
    d = d.filter(function (r) {
      return r !== null;
    });
    return d.reduce(function (a, b) {
      return a.concat(b);
    }, []);
  };

  var combinatorMap = {
    ' ': 'descendantCombinator',
    '+': 'adjacentSiblingCombinator',
    '>': 'childCombinator',
    '~': 'generalSiblingCombinator'
  };

  var concatUsingCombinator = function concatUsingCombinator(d) {
    return (Array.isArray(d[0]) ? d[0] : [d[0]]).concat({
      type: combinatorMap[d[2]]
    }).concat(d[4]);
  };
  var grammar = {
    ParserRules: [{ "name": "combinator", "symbols": ["selector"] }, { "name": "combinator", "symbols": ["combinator", "_", /[>+~ ]/, "_", "selector"], "postprocess": concatUsingCombinator }, { "name": "selector", "symbols": ["selectorBody"], "postprocess": function postprocess(d) {
        return { type: 'selector', body: d[0] };
      } }, { "name": "selectorBody$ebnf$1", "symbols": ["typeSelector"], "postprocess": id }, { "name": "selectorBody$ebnf$1", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "selectorBody$ebnf$2", "symbols": ["idSelector"], "postprocess": id }, { "name": "selectorBody$ebnf$2", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "selectorBody$ebnf$3", "symbols": [] }, { "name": "selectorBody$ebnf$3", "symbols": ["classSelector", "selectorBody$ebnf$3"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$4", "symbols": [] }, { "name": "selectorBody$ebnf$4", "symbols": ["attributeValueSelector", "selectorBody$ebnf$4"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$5", "symbols": [] }, { "name": "selectorBody$ebnf$5", "symbols": ["attributePresenceSelector", "selectorBody$ebnf$5"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$6", "symbols": [] }, { "name": "selectorBody$ebnf$6", "symbols": ["pseudoClassSelector", "selectorBody$ebnf$6"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$7", "symbols": ["pseudoElementSelector"], "postprocess": id }, { "name": "selectorBody$ebnf$7", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "selectorBody", "symbols": ["selectorBody$ebnf$1", "selectorBody$ebnf$2", "selectorBody$ebnf$3", "selectorBody$ebnf$4", "selectorBody$ebnf$5", "selectorBody$ebnf$6", "selectorBody$ebnf$7"], "postprocess": function postprocess(d, i, reject) {
        var selectors = flatten(d);if (!selectors.length) return reject;return selectors;
      } }, { "name": "selectorBody$ebnf$8", "symbols": ["idSelector"], "postprocess": id }, { "name": "selectorBody$ebnf$8", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "selectorBody$ebnf$9", "symbols": [] }, { "name": "selectorBody$ebnf$9", "symbols": ["classSelector", "selectorBody$ebnf$9"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$10", "symbols": [] }, { "name": "selectorBody$ebnf$10", "symbols": ["attributeValueSelector", "selectorBody$ebnf$10"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$11", "symbols": [] }, { "name": "selectorBody$ebnf$11", "symbols": ["attributePresenceSelector", "selectorBody$ebnf$11"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$12", "symbols": [] }, { "name": "selectorBody$ebnf$12", "symbols": ["pseudoClassSelector", "selectorBody$ebnf$12"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "selectorBody$ebnf$13", "symbols": ["pseudoElementSelector"], "postprocess": id }, { "name": "selectorBody$ebnf$13", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "selectorBody", "symbols": ["universalSelector", "selectorBody$ebnf$8", "selectorBody$ebnf$9", "selectorBody$ebnf$10", "selectorBody$ebnf$11", "selectorBody$ebnf$12", "selectorBody$ebnf$13"], "postprocess": flatten }, { "name": "typeSelector", "symbols": ["attributeName"], "postprocess": function postprocess(d) {
        return { type: 'typeSelector', name: d[0] };
      } }, { "name": "className$ebnf$1", "symbols": [{ "literal": "-" }], "postprocess": id }, { "name": "className$ebnf$1", "symbols": [], "postprocess": function postprocess(d) {
        return null;
      } }, { "name": "className$ebnf$2", "symbols": [] }, { "name": "className$ebnf$2", "symbols": [/[_a-zA-Z0-9-]/, "className$ebnf$2"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "className", "symbols": ["className$ebnf$1", /[_a-zA-Z]/, "className$ebnf$2"], "postprocess": function postprocess(d) {
        return (d[0] || '') + d[1] + d[2].join('');
      } }, { "name": "attributeName$ebnf$1", "symbols": [] }, { "name": "attributeName$ebnf$1", "symbols": [/[_a-zA-Z0-9-]/, "attributeName$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "attributeName", "symbols": [/[_a-zA-Z]/, "attributeName$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0] + d[1].join('');
      } }, { "name": "classSelector", "symbols": [{ "literal": "." }, "className"], "postprocess": function postprocess(d) {
        return { type: 'classSelector', name: d[1] };
      } }, { "name": "idSelector", "symbols": [{ "literal": "#" }, "attributeName"], "postprocess": function postprocess(d) {
        return { type: 'idSelector', name: d[1] };
      } }, { "name": "universalSelector", "symbols": [{ "literal": "*" }], "postprocess": function postprocess(d) {
        return { type: 'universalSelector' };
      } }, { "name": "attributePresenceSelector", "symbols": [{ "literal": "[" }, "attributeName", { "literal": "]" }], "postprocess": function postprocess(d) {
        return { type: 'attributePresenceSelector', name: d[1] };
      } }, { "name": "attributeOperator", "symbols": [{ "literal": "=" }] }, { "name": "attributeOperator$string$1", "symbols": [{ "literal": "~" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$1"] }, { "name": "attributeOperator$string$2", "symbols": [{ "literal": "|" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$2"] }, { "name": "attributeOperator$string$3", "symbols": [{ "literal": "^" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$3"] }, { "name": "attributeOperator$string$4", "symbols": [{ "literal": "$" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$4"] }, { "name": "attributeOperator$string$5", "symbols": [{ "literal": "*" }, { "literal": "=" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "attributeOperator", "symbols": ["attributeOperator$string$5"] }, { "name": "attributeValueSelector", "symbols": [{ "literal": "[" }, "attributeName", "attributeOperator", "attributeValue", { "literal": "]" }], "postprocess": function postprocess(d) {
        return {
          type: 'attributeValueSelector',
          name: d[1],
          value: d[3],
          operator: d[2][0]
        };
      }
    }, { "name": "attributeValue", "symbols": ["unquotedAttributeValue"], "postprocess": id }, { "name": "attributeValue", "symbols": ["sqstring"], "postprocess": id }, { "name": "attributeValue", "symbols": ["dqstring"], "postprocess": id }, { "name": "unquotedAttributeValue$ebnf$1", "symbols": [/[^\[\]"',= ]/] }, { "name": "unquotedAttributeValue$ebnf$1", "symbols": [/[^\[\]"',= ]/, "unquotedAttributeValue$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "unquotedAttributeValue", "symbols": ["unquotedAttributeValue$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0].join('');
      } }, { "name": "classParameters", "symbols": [] }, { "name": "classParameters", "symbols": ["classParameter"] }, { "name": "classParameters", "symbols": ["classParameters", { "literal": "," }, "_", "classParameter"], "postprocess": appendItem(0, 3) }, { "name": "classParameter$ebnf$1", "symbols": [/[^()"', ]/] }, { "name": "classParameter$ebnf$1", "symbols": [/[^()"', ]/, "classParameter$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "classParameter", "symbols": ["classParameter$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0].join('');
      } }, { "name": "classParameter", "symbols": ["sqstring"], "postprocess": id }, { "name": "classParameter", "symbols": ["dqstring"], "postprocess": id }, { "name": "pseudoElementSelector$string$1", "symbols": [{ "literal": ":" }, { "literal": ":" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "pseudoElementSelector", "symbols": ["pseudoElementSelector$string$1", "pseudoClassSelectorName"], "postprocess": function postprocess(d) {
        return { type: 'pseudoElementSelector', name: d[1] };
      } }, { "name": "pseudoClassSelector", "symbols": [{ "literal": ":" }, "pseudoClassSelectorName"], "postprocess": function postprocess(d) {
        return { type: 'pseudoClassSelector', name: d[1] };
      } }, { "name": "pseudoClassSelector", "symbols": [{ "literal": ":" }, "pseudoClassSelectorName", { "literal": "(" }, "classParameters", { "literal": ")" }], "postprocess": function postprocess(d) {
        return { type: 'pseudoClassSelector', name: d[1], parameters: d[3] };
      } }, { "name": "pseudoClassSelectorName$ebnf$1", "symbols": [/[a-zA-Z0-9-_]/] }, { "name": "pseudoClassSelectorName$ebnf$1", "symbols": [/[a-zA-Z0-9-_]/, "pseudoClassSelectorName$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "pseudoClassSelectorName", "symbols": [/[a-zA-Z]/, "pseudoClassSelectorName$ebnf$1"], "postprocess": function postprocess(d) {
        return d[0] + d[1].join('');
      } }, { "name": "dqstring$ebnf$1", "symbols": [] }, { "name": "dqstring$ebnf$1", "symbols": ["dstrchar", "dqstring$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "dqstring", "symbols": [{ "literal": "\"" }, "dqstring$ebnf$1", { "literal": "\"" }], "postprocess": function postprocess(d) {
        return d[1].join('');
      } }, { "name": "dstrchar", "symbols": [/[^"]/], "postprocess": id }, { "name": "dstrchar$string$1", "symbols": [{ "literal": "\\" }, { "literal": "\"" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "dstrchar", "symbols": ["dstrchar$string$1"], "postprocess": function postprocess(d) {
        return '"';
      } }, { "name": "sqstring$ebnf$1", "symbols": [] }, { "name": "sqstring$ebnf$1", "symbols": ["sstrchar", "sqstring$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "sqstring", "symbols": [{ "literal": "'" }, "sqstring$ebnf$1", { "literal": "'" }], "postprocess": function postprocess(d) {
        return d[1].join('');
      } }, { "name": "sstrchar", "symbols": [/[^']/], "postprocess": id }, { "name": "sstrchar$string$1", "symbols": [{ "literal": "\\" }, { "literal": "'" }], "postprocess": function joiner(d) {
        return d.join('');
      } }, { "name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": function postprocess(d) {
        return '\'';
      } }, { "name": "_$ebnf$1", "symbols": [] }, { "name": "_$ebnf$1", "symbols": [/[ ]/, "_$ebnf$1"], "postprocess": function arrconcat(d) {
        return [d[0]].concat(d[1]);
      } }, { "name": "_", "symbols": ["_$ebnf$1"], "postprocess": function postprocess(d) {
        return null;
      } }],
    ParserStart: "combinator"
  };
  {
    module.exports = grammar;
  }
})();

});

var createParser = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", {
  value: true
});





var _grammar2 = _interopRequireDefault(grammar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*:: import type {
  CombinatorTokenType,
  SelectorTokenType
} from './types';*/ // @flow

exports.default = function () {
  var parse = function parse(selector /*: string*/) /*: Array<SelectorTokenType | CombinatorTokenType>*/ {
    var parser = new nearley.Parser(_grammar2.default.ParserRules, _grammar2.default.ParserStart);

    var results = parser.feed(selector).results;

    if (results.length === 0) {
      throw new Error('Found no parsings.');
    }

    if (results.length > 1) {
      throw new Error('Ambiguous results.');
    }

    return results[0];
  };

  return {
    parse
  };
};

});

unwrapExports(createParser);

var dist = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createParser = exports.createGenerator = undefined;



var _createGenerator2 = _interopRequireDefault(createGenerator);



var _createParser2 = _interopRequireDefault(createParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// @flow

exports.createGenerator = _createGenerator2.default;
exports.createParser = _createParser2.default;

});

unwrapExports(dist);
var dist_1 = dist.createParser;
var dist_2 = dist.createGenerator;

var mureInteractivityRunnerText = "/* globals XMLHttpRequest, ActiveXObject, Node */\n/* eslint no-eval: 0 */\n(function () {\n  var nonAsyncScriptTexts = [];\n\n  function load (url, callback) {\n    var xhr;\n\n    if (typeof XMLHttpRequest !== 'undefined') {\n      xhr = new XMLHttpRequest();\n    } else {\n      var versions = [\n        'MSXML2.XmlHttp.5.0',\n        'MSXML2.XmlHttp.4.0',\n        'MSXML2.XmlHttp.3.0',\n        'MSXML2.XmlHttp.2.0',\n        'Microsoft.XmlHttp'\n      ];\n      for (var i = 0, len = versions.length; i < len; i++) {\n        try {\n          xhr = new ActiveXObject(versions[i]);\n          break;\n        } catch (e) {}\n      }\n    }\n\n    xhr.onreadystatechange = ensureReadiness;\n\n    function ensureReadiness () {\n      if (xhr.readyState < 4) {\n        return;\n      }\n\n      if (xhr.status !== 200) {\n        return;\n      }\n\n      // all is well\n      if (xhr.readyState === 4) {\n        callback(xhr.responseText);\n      }\n    }\n\n    xhr.open('GET', url, true);\n    xhr.send('');\n  }\n\n  function documentPositionComparator (a, b) {\n    // function shamelessly adapted from https://stackoverflow.com/questions/31991235/sort-elements-by-document-order-in-javascript/31992057\n    a = a.element;\n    b = b.element;\n    if (a === b) { return 0; }\n    var position = a.compareDocumentPosition(b);\n    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {\n      return -1;\n    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {\n      return 1;\n    } else { return 0; }\n  }\n\n  function loadUserLibraries (callback) {\n    // Grab all the mure:library tags, and load the referenced library (script src attributes\n    // in SVG don't work, so we have to manually load remote libraries)\n    var libraries = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'library'))\n      .map(element => {\n        return {\n          src: element.getAttribute('src'),\n          async: (element.getAttribute('async') || 'true').toLocaleLowerCase() !== 'false',\n          element: element\n        };\n      });\n\n    var loadedLibraries = {};\n    var onloadFired = false;\n\n    libraries.forEach(function (library) {\n      load(library.src, function (scriptText) {\n        if (library.async) {\n          window.eval(scriptText);\n        } else {\n          library.scriptText = scriptText;\n          nonAsyncScriptTexts.push(library);\n        }\n        loadedLibraries[library.src] = true;\n        attemptStart();\n      });\n    });\n\n    window.onload = function () {\n      onloadFired = true;\n      attemptStart();\n    };\n\n    function attemptStart () {\n      if (!onloadFired) {\n        return;\n      }\n      var allLoaded = libraries.every(library => {\n        return loadedLibraries[library.src];\n      });\n      if (allLoaded) {\n        callback();\n      }\n    }\n  }\n\n  function runUserScripts () {\n    var userScripts = Array.from(document.getElementsByTagNameNS('http://mure-apps.github.io', 'script'))\n      .map(element => {\n        return {\n          element: element,\n          scriptText: element.textContent\n        };\n      });\n    var allScripts = nonAsyncScriptTexts.concat(userScripts)\n      .sort(documentPositionComparator);\n    allScripts.forEach(scriptOrLibrary => {\n      window.eval(scriptOrLibrary.scriptText);\n    });\n  }\n\n  // Where we actually start executing stuff:\n  if (!window.frameElement ||\n      !window.frameElement.__suppressMureInteractivity__) {\n    // We've been loaded directly into a browser, or embedded in a normal page;\n    // load all the libraries, and then run all the scripts\n    loadUserLibraries(runUserScripts);\n  }\n})();\n";

var defaultSvgDocTemplate = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" width=\"500\" height=\"500\">\n  <metadata id=\"mure\">\n    <mure xmlns=\"http://mure-apps.github.io\">\n    </mure>\n  </metadata>\n  <script id=\"mureInteractivityRunner\" type=\"text/javascript\">\n    <![CDATA[\n      ${mureInteractivityRunnerText}\n    ]]>\n  </script>\n</svg>\n";

var minimumSvgDoc = "<svg>\n  <metadata id=\"mure\">\n    <mure xmlns=\"http://mure-apps.github.io\">\n    </mure>\n  </metadata>\n</svg>\n";

// sneakily embed the interactivity-running script
const defaultSvgDoc = defaultSvgDocTemplate.replace(/\${mureInteractivityRunnerText}/, mureInteractivityRunnerText);

class DocHandler {
  /**
   *
   */
  constructor() {
    this.selectorParser = dist_1();
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
  xml2js(text) {
    return lib.xml2js(text, this.xml2jsonSettings);
  }
  xml2json(text) {
    return lib.xml2json(text, this.xml2jsonSettings);
  }
  json2xml(text) {
    return lib.json2xml(text, this.json2xmlSettings);
  }
  js2xml(text) {
    return lib.js2xml(text, this.json2xmlSettings);
  }
  standardize(testObj, standardObj) {
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
  iterate(obj, callback) {
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
  matchObject(obj, queryTokens) {
    // TODO
  }
  selectAll(root, selector) {
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

class Mure extends Model {
  constructor(PouchDB, d3$$1, d3n) {
    super();

    this.PouchDB = PouchDB; // could be pouchdb-node or pouchdb-browser
    this.d3 = d3$$1; // for Node.js, this will be from d3-node, not the regular one

    // to run tests, we also need access to the d3-node wrapper (we don't
    // import it directly into the tests to make sure that the namespace
    // addition below works)
    this.d3n = d3n;

    // The namespace string for our custom XML
    this.NSString = 'http://mure-apps.github.io';
    this.d3.namespaces.mure = this.NSString;

    // Enumerations...
    this.CONTENT_FORMATS = {
      exclude: 0,
      blob: 1,
      dom: 2,
      base64: 3
    };

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
    this.alert = message => {
      return new Promise((resolve, reject) => {
        window.alert(message);
        resolve(true);
      });
    };
    this.confirm = message => {
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
  customizeAlertDialog(showDialogFunction) {
    this.alert = showDialogFunction;
  }
  customizeConfirmDialog(showDialogFunction) {
    this.confirm = showDialogFunction;
  }
  customizePromptDialog(showDialogFunction) {
    this.prompt = showDialogFunction;
  }
  openApp(appName, newTab) {
    if (newTab) {
      window.open('/' + appName, '_blank');
    } else {
      window.location.pathname = '/' + appName;
    }
  }
  getOrInitDb() {
    let db = new this.PouchDB('mure');
    let couchDbUrl = window.localStorage.getItem('couchDbUrl');
    if (couchDbUrl) {
      (async () => {
        let couchDb = new this.PouchDB(couchDbUrl, { skip_setup: true });
        return db.sync(couchDb, { live: true, retry: true });
      })().catch(err => {
        this.alert('Error syncing with ' + couchDbUrl + ': ' + err.message);
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
  getStandardizedDoc(docId) {
    return this.db.get(docId).catch(err => {
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
  async downloadDoc(docId) {
    return this.db.get(docId).then(doc => {
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

var PouchDB = require('pouchdb-browser').plugin(require('pouchdb-authentication'));

var module$1 = new Mure(PouchDB, d3);

return module$1;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVyZS51bWQuanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy91a2kvYnVpbGQvdWtpLmVzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3JvbGx1cC1wbHVnaW4tbm9kZS1nbG9iYWxzL3NyYy9nbG9iYWwuanMiLCIuLi9ub2RlX21vZHVsZXMvYnVmZmVyLWVzNi9iYXNlNjQuanMiLCIuLi9ub2RlX21vZHVsZXMvYnVmZmVyLWVzNi9pZWVlNzU0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2J1ZmZlci1lczYvaXNBcnJheS5qcyIsIi4uL25vZGVfbW9kdWxlcy9idWZmZXItZXM2L2luZGV4LmpzIiwiLi4vLi4vc2F4LWpzL2xpYi9zYXguanMiLCIuLi9ub2RlX21vZHVsZXMveG1sLWpzL2xpYi9vcHRpb25zLWhlbHBlci5qcyIsIi4uL25vZGVfbW9kdWxlcy94bWwtanMvbGliL2FycmF5LWhlbHBlci5qcyIsIi4uL25vZGVfbW9kdWxlcy94bWwtanMvbGliL3htbDJqcy5qcyIsIi4uL25vZGVfbW9kdWxlcy94bWwtanMvbGliL3htbDJqc29uLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3htbC1qcy9saWIvanMyeG1sLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3htbC1qcy9saWIvanNvbjJ4bWwuanMiLCIuLi9ub2RlX21vZHVsZXMveG1sLWpzL2xpYi9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zY2FscGVsL2Rpc3QvY3JlYXRlR2VuZXJhdG9yLmpzIiwiLi4vbm9kZV9tb2R1bGVzL25lYXJsZXkvbGliL25lYXJsZXkuanMiLCIuLi9ub2RlX21vZHVsZXMvc2NhbHBlbC9kaXN0L2dyYW1tYXIuanMiLCIuLi9ub2RlX21vZHVsZXMvc2NhbHBlbC9kaXN0L2NyZWF0ZVBhcnNlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9zY2FscGVsL2Rpc3QvaW5kZXguanMiLCIuLi9zcmMvRG9jSGFuZGxlci9pbmRleC5qcyIsIi4uL3NyYy9NdXJlL2luZGV4LmpzIiwiLi4vc3JjL21vZHVsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjbGFzcyBBYnN0cmFjdENsYXNzIHtcbiAgcmVxdWlyZVByb3BlcnRpZXMgKHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2gobSA9PiB7XG4gICAgICBpZiAodGhpc1ttXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IobSArICcgaXMgdW5kZWZpbmVkIGZvciBjbGFzcyAnICsgdGhpcy5jb25zdHJ1Y3Rvci5uYW1lKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG5jbGFzcyBNb2RlbCBleHRlbmRzIEFic3RyYWN0Q2xhc3Mge1xuICBjb25zdHJ1Y3RvciAoKSB7XG4gICAgc3VwZXIoKTtcbiAgICB0aGlzLmV2ZW50SGFuZGxlcnMgPSB7fTtcbiAgfVxuICBvbiAoZXZlbnROYW1lLCBjYWxsYmFjaywgYWxsb3dEdXBsaWNhdGVMaXN0ZW5lcnMpIHtcbiAgICBpZiAoIXRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXSA9IFtdO1xuICAgIH1cbiAgICBpZiAoIWFsbG93RHVwbGljYXRlTGlzdGVuZXJzKSB7XG4gICAgICBpZiAodGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0uaW5kZXhPZihjYWxsYmFjaykgIT09IC0xKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5ldmVudEhhbmRsZXJzW2V2ZW50TmFtZV0ucHVzaChjYWxsYmFjayk7XG4gIH1cbiAgb2ZmIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBpbmRleCA9IHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgIHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdHJpZ2dlciAoKSB7XG4gICAgbGV0IGV2ZW50TmFtZSA9IGFyZ3VtZW50c1swXTtcbiAgICBsZXQgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgaWYgKHRoaXMuZXZlbnRIYW5kbGVyc1tldmVudE5hbWVdKSB7XG4gICAgICB0aGlzLmV2ZW50SGFuZGxlcnNbZXZlbnROYW1lXS5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4geyAgIC8vIEFkZCB0aW1lb3V0IHRvIHByZXZlbnQgYmxvY2tpbmdcbiAgICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgVmlldyBleHRlbmRzIE1vZGVsIHtcbiAgY29uc3RydWN0b3IgKCkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5kM2VsID0gbnVsbDtcbiAgICB0aGlzLmRpcnR5ID0gZmFsc2U7XG4gICAgdGhpcy5kcmF3VGltZW91dCA9IG51bGw7XG4gICAgdGhpcy5kZWJvdW5jZVdhaXQgPSAxMDA7XG4gICAgdGhpcy5yZXF1aXJlUHJvcGVydGllcyhbJ3NldHVwJywgJ2RyYXcnXSk7XG4gIH1cbiAgaGFzUmVuZGVyZWRUbyAoZDNlbCkge1xuICAgIC8vIERldGVybWluZSB3aGV0aGVyIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgd2UndmUgcmVuZGVyZWRcbiAgICAvLyBpbnNpZGUgdGhpcyBET00gZWxlbWVudDsgcmV0dXJuIGZhbHNlIGlmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWVcbiAgICAvLyBBbHNvIHN0b3JlIHRoZSBlbGVtZW50IGFzIHRoZSBsYXN0IG9uZSB0aGF0IHdlIHJlbmRlcmVkIHRvXG5cbiAgICBsZXQgbmVlZHNGcmVzaFJlbmRlciA9IHRoaXMuZGlydHk7XG4gICAgaWYgKGQzZWwpIHtcbiAgICAgIGlmICh0aGlzLmQzZWwpIHtcbiAgICAgICAgLy8gb25seSBuZWVkIHRvIGRvIGEgZnVsbCByZW5kZXIgaWYgdGhlIGxhc3QgZWxlbWVudCB3YXNuJ3QgdGhlIHNhbWUgYXMgdGhpcyBvbmVcbiAgICAgICAgbmVlZHNGcmVzaFJlbmRlciA9IHRoaXMuZGlydHkgfHwgZDNlbC5ub2RlKCkgIT09IHRoaXMuZDNlbC5ub2RlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB3ZSBkaWRuJ3QgaGF2ZSBhbiBlbGVtZW50IGJlZm9yZVxuICAgICAgICBuZWVkc0ZyZXNoUmVuZGVyID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZDNlbCA9IGQzZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5kM2VsKSB7XG4gICAgICAgIC8vIHdlIHdlcmVuJ3QgZ2l2ZW4gYSBuZXcgZWxlbWVudCB0byByZW5kZXIgdG8sIHNvIHVzZSB0aGUgbGFzdCBvbmVcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWxsZWQgcmVuZGVyKCkgd2l0aG91dCBhbiBlbGVtZW50IHRvIHJlbmRlciB0byAoYW5kIG5vIHByaW9yIGVsZW1lbnQgaGFzIGJlZW4gc3BlY2lmaWVkKScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZDNlbCA9IHRoaXMuZDNlbDtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5kaXJ0eSA9IGZhbHNlO1xuICAgIHJldHVybiAhbmVlZHNGcmVzaFJlbmRlcjtcbiAgfVxuICByZW5kZXIgKGQzZWwpIHtcbiAgICBkM2VsID0gZDNlbCB8fCB0aGlzLmQzZWw7XG4gICAgaWYgKCF0aGlzLmhhc1JlbmRlcmVkVG8oZDNlbCkpIHtcbiAgICAgIC8vIENhbGwgc2V0dXAgaW1tZWRpYXRlbHlcbiAgICAgIHRoaXMudXBkYXRlQ29udGFpbmVyQ2hhcmFjdGVyaXN0aWNzKGQzZWwpO1xuICAgICAgdGhpcy5zZXR1cChkM2VsKTtcbiAgICAgIHRoaXMuZDNlbCA9IGQzZWw7XG4gICAgfVxuICAgIC8vIERlYm91bmNlIHRoZSBhY3R1YWwgZHJhdyBjYWxsXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuZHJhd1RpbWVvdXQpO1xuICAgIHRoaXMuZHJhd1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHRoaXMuZHJhd1RpbWVvdXQgPSBudWxsO1xuICAgICAgdGhpcy5kcmF3KGQzZWwpO1xuICAgIH0sIHRoaXMuZGVib3VuY2VXYWl0KTtcbiAgfVxuICB1cGRhdGVDb250YWluZXJDaGFyYWN0ZXJpc3RpY3MgKGQzZWwpIHtcbiAgICBpZiAoZDNlbCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5lbVNpemUgPSBwYXJzZUZsb2F0KGQzZWwuc3R5bGUoJ2ZvbnQtc2l6ZScpKTtcbiAgICAgIHRoaXMuc2Nyb2xsQmFyU2l6ZSA9IHRoaXMuY29tcHV0ZVNjcm9sbEJhclNpemUoZDNlbCk7XG4gICAgfVxuICB9XG4gIGNvbXB1dGVTY3JvbGxCYXJTaXplIChkM2VsKSB7XG4gICAgLy8gYmxhdGFudGx5IGFkYXB0ZWQgZnJvbSBTTyB0aHJlYWQ6XG4gICAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMzM4MjUxNi9nZXR0aW5nLXNjcm9sbC1iYXItd2lkdGgtdXNpbmctamF2YXNjcmlwdFxuICAgIHZhciBvdXRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG91dGVyLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICBvdXRlci5zdHlsZS53aWR0aCA9ICcxMDBweCc7XG4gICAgb3V0ZXIuc3R5bGUubXNPdmVyZmxvd1N0eWxlID0gJ3Njcm9sbGJhcic7IC8vIG5lZWRlZCBmb3IgV2luSlMgYXBwc1xuXG4gICAgZDNlbC5ub2RlKCkuYXBwZW5kQ2hpbGQob3V0ZXIpO1xuXG4gICAgdmFyIHdpZHRoTm9TY3JvbGwgPSBvdXRlci5vZmZzZXRXaWR0aDtcbiAgICAvLyBmb3JjZSBzY3JvbGxiYXJzXG4gICAgb3V0ZXIuc3R5bGUub3ZlcmZsb3cgPSAnc2Nyb2xsJztcblxuICAgIC8vIGFkZCBpbm5lcmRpdlxuICAgIHZhciBpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGlubmVyLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgIG91dGVyLmFwcGVuZENoaWxkKGlubmVyKTtcblxuICAgIHZhciB3aWR0aFdpdGhTY3JvbGwgPSBpbm5lci5vZmZzZXRXaWR0aDtcblxuICAgIC8vIHJlbW92ZSBkaXZzXG4gICAgb3V0ZXIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvdXRlcik7XG5cbiAgICByZXR1cm4gd2lkdGhOb1Njcm9sbCAtIHdpZHRoV2l0aFNjcm9sbDtcbiAgfVxufVxuXG5leHBvcnQgeyBBYnN0cmFjdENsYXNzLCBNb2RlbCwgVmlldyB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lkV3RwTG1WekxtcHpJaXdpYzI5MWNtTmxjeUk2V3lJdUxpOXpjbU12UVdKemRISmhZM1JEYkdGemN5OXBibVJsZUM1cWN5SXNJaTR1TDNOeVl5OU5iMlJsYkM5cGJtUmxlQzVxY3lJc0lpNHVMM055WXk5V2FXVjNMMmx1WkdWNExtcHpJbDBzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSW1Oc1lYTnpJRUZpYzNSeVlXTjBRMnhoYzNNZ2UxeHVJQ0J5WlhGMWFYSmxVSEp2Y0dWeWRHbGxjeUFvY0hKdmNHVnlkR2xsY3lrZ2UxeHVJQ0FnSUhCeWIzQmxjblJwWlhNdVptOXlSV0ZqYUNodElEMCtJSHRjYmlBZ0lDQWdJR2xtSUNoMGFHbHpXMjFkSUQwOVBTQjFibVJsWm1sdVpXUXBJSHRjYmlBZ0lDQWdJQ0FnZEdoeWIzY2dibVYzSUZSNWNHVkZjbkp2Y2lodElDc2dKeUJwY3lCMWJtUmxabWx1WldRZ1ptOXlJR05zWVhOeklDY2dLeUIwYUdsekxtTnZibk4wY25WamRHOXlMbTVoYldVcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgwcE8xeHVJQ0I5WEc1OVhHNWxlSEJ2Y25RZ1pHVm1ZWFZzZENCQlluTjBjbUZqZEVOc1lYTnpPMXh1SWl3aWFXMXdiM0owSUVGaWMzUnlZV04wUTJ4aGMzTWdabkp2YlNBbkxpNHZRV0p6ZEhKaFkzUkRiR0Z6Y3k5cGJtUmxlQzVxY3ljN1hHNWNibU5zWVhOeklFMXZaR1ZzSUdWNGRHVnVaSE1nUVdKemRISmhZM1JEYkdGemN5QjdYRzRnSUdOdmJuTjBjblZqZEc5eUlDZ3BJSHRjYmlBZ0lDQnpkWEJsY2lncE8xeHVJQ0FnSUhSb2FYTXVaWFpsYm5SSVlXNWtiR1Z5Y3lBOUlIdDlPMXh1SUNCOVhHNGdJRzl1SUNobGRtVnVkRTVoYldVc0lHTmhiR3hpWVdOckxDQmhiR3h2ZDBSMWNHeHBZMkYwWlV4cGMzUmxibVZ5Y3lrZ2UxeHVJQ0FnSUdsbUlDZ2hkR2hwY3k1bGRtVnVkRWhoYm1Sc1pYSnpXMlYyWlc1MFRtRnRaVjBwSUh0Y2JpQWdJQ0FnSUhSb2FYTXVaWFpsYm5SSVlXNWtiR1Z5YzF0bGRtVnVkRTVoYldWZElEMGdXMTA3WEc0Z0lDQWdmVnh1SUNBZ0lHbG1JQ2doWVd4c2IzZEVkWEJzYVdOaGRHVk1hWE4wWlc1bGNuTXBJSHRjYmlBZ0lDQWdJR2xtSUNoMGFHbHpMbVYyWlc1MFNHRnVaR3hsY25OYlpYWmxiblJPWVcxbFhTNXBibVJsZUU5bUtHTmhiR3hpWVdOcktTQWhQVDBnTFRFcElIdGNiaUFnSUNBZ0lDQWdjbVYwZFhKdU8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0IwYUdsekxtVjJaVzUwU0dGdVpHeGxjbk5iWlhabGJuUk9ZVzFsWFM1d2RYTm9LR05oYkd4aVlXTnJLVHRjYmlBZ2ZWeHVJQ0J2Wm1ZZ0tHVjJaVzUwVG1GdFpTd2dZMkZzYkdKaFkyc3BJSHRjYmlBZ0lDQnBaaUFvZEdocGN5NWxkbVZ1ZEVoaGJtUnNaWEp6VzJWMlpXNTBUbUZ0WlYwcElIdGNiaUFnSUNBZ0lHbG1JQ2doWTJGc2JHSmhZMnNwSUh0Y2JpQWdJQ0FnSUNBZ1pHVnNaWFJsSUhSb2FYTXVaWFpsYm5SSVlXNWtiR1Z5YzF0bGRtVnVkRTVoYldWZE8xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ2JHVjBJR2x1WkdWNElEMGdkR2hwY3k1bGRtVnVkRWhoYm1Sc1pYSnpXMlYyWlc1MFRtRnRaVjB1YVc1a1pYaFBaaWhqWVd4c1ltRmpheWs3WEc0Z0lDQWdJQ0FnSUdsbUlDaHBibVJsZUNBK1BTQXdLU0I3WEc0Z0lDQWdJQ0FnSUNBZ2RHaHBjeTVsZG1WdWRFaGhibVJzWlhKelcyVjJaVzUwVG1GdFpWMHVjM0JzYVdObEtHbHVaR1Y0TENBeEtUdGNiaUFnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dUlDQjBjbWxuWjJWeUlDZ3BJSHRjYmlBZ0lDQnNaWFFnWlhabGJuUk9ZVzFsSUQwZ1lYSm5kVzFsYm5Seld6QmRPMXh1SUNBZ0lHeGxkQ0JoY21keklEMGdRWEp5WVhrdWNISnZkRzkwZVhCbExuTnNhV05sTG1OaGJHd29ZWEpuZFcxbGJuUnpMQ0F4S1R0Y2JpQWdJQ0JwWmlBb2RHaHBjeTVsZG1WdWRFaGhibVJzWlhKelcyVjJaVzUwVG1GdFpWMHBJSHRjYmlBZ0lDQWdJSFJvYVhNdVpYWmxiblJJWVc1a2JHVnljMXRsZG1WdWRFNWhiV1ZkTG1admNrVmhZMmdvWTJGc2JHSmhZMnNnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQjNhVzVrYjNjdWMyVjBWR2x0Wlc5MWRDZ29LU0E5UGlCN0lDQWdMeThnUVdSa0lIUnBiV1Z2ZFhRZ2RHOGdjSEpsZG1WdWRDQmliRzlqYTJsdVoxeHVJQ0FnSUNBZ0lDQWdJR05oYkd4aVlXTnJMbUZ3Y0d4NUtIUm9hWE1zSUdGeVozTXBPMXh1SUNBZ0lDQWdJQ0I5TENBd0tUdGNiaUFnSUNBZ0lIMHBPMXh1SUNBZ0lIMWNiaUFnZlZ4dWZWeHVYRzVsZUhCdmNuUWdaR1ZtWVhWc2RDQk5iMlJsYkR0Y2JpSXNJbWx0Y0c5eWRDQk5iMlJsYkNCbWNtOXRJQ2N1TGk5TmIyUmxiQzlwYm1SbGVDNXFjeWM3WEc1Y2JtTnNZWE56SUZacFpYY2daWGgwWlc1a2N5Qk5iMlJsYkNCN1hHNGdJR052Ym5OMGNuVmpkRzl5SUNncElIdGNiaUFnSUNCemRYQmxjaWdwTzF4dUlDQWdJSFJvYVhNdVpETmxiQ0E5SUc1MWJHdzdYRzRnSUNBZ2RHaHBjeTVrYVhKMGVTQTlJR1poYkhObE8xeHVJQ0FnSUhSb2FYTXVaSEpoZDFScGJXVnZkWFFnUFNCdWRXeHNPMXh1SUNBZ0lIUm9hWE11WkdWaWIzVnVZMlZYWVdsMElEMGdNVEF3TzF4dUlDQWdJSFJvYVhNdWNtVnhkV2x5WlZCeWIzQmxjblJwWlhNb1d5ZHpaWFIxY0Njc0lDZGtjbUYzSjEwcE8xeHVJQ0I5WEc0Z0lHaGhjMUpsYm1SbGNtVmtWRzhnS0dRelpXd3BJSHRjYmlBZ0lDQXZMeUJFWlhSbGNtMXBibVVnZDJobGRHaGxjaUIwYUdseklHbHpJSFJvWlNCbWFYSnpkQ0IwYVcxbElIZGxKM1psSUhKbGJtUmxjbVZrWEc0Z0lDQWdMeThnYVc1emFXUmxJSFJvYVhNZ1JFOU5JR1ZzWlcxbGJuUTdJSEpsZEhWeWJpQm1ZV3h6WlNCcFppQjBhR2x6SUdseklIUm9aU0JtYVhKemRDQjBhVzFsWEc0Z0lDQWdMeThnUVd4emJ5QnpkRzl5WlNCMGFHVWdaV3hsYldWdWRDQmhjeUIwYUdVZ2JHRnpkQ0J2Ym1VZ2RHaGhkQ0IzWlNCeVpXNWtaWEpsWkNCMGIxeHVYRzRnSUNBZ2JHVjBJRzVsWldSelJuSmxjMmhTWlc1a1pYSWdQU0IwYUdsekxtUnBjblI1TzF4dUlDQWdJR2xtSUNoa00yVnNLU0I3WEc0Z0lDQWdJQ0JwWmlBb2RHaHBjeTVrTTJWc0tTQjdYRzRnSUNBZ0lDQWdJQzh2SUc5dWJIa2dibVZsWkNCMGJ5QmtieUJoSUdaMWJHd2djbVZ1WkdWeUlHbG1JSFJvWlNCc1lYTjBJR1ZzWlcxbGJuUWdkMkZ6YmlkMElIUm9aU0J6WVcxbElHRnpJSFJvYVhNZ2IyNWxYRzRnSUNBZ0lDQWdJRzVsWldSelJuSmxjMmhTWlc1a1pYSWdQU0IwYUdsekxtUnBjblI1SUh4OElHUXpaV3d1Ym05a1pTZ3BJQ0U5UFNCMGFHbHpMbVF6Wld3dWJtOWtaU2dwTzF4dUlDQWdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJQ0FnTHk4Z2QyVWdaR2xrYmlkMElHaGhkbVVnWVc0Z1pXeGxiV1Z1ZENCaVpXWnZjbVZjYmlBZ0lDQWdJQ0FnYm1WbFpITkdjbVZ6YUZKbGJtUmxjaUE5SUhSeWRXVTdYRzRnSUNBZ0lDQjlYRzRnSUNBZ0lDQjBhR2x6TG1RelpXd2dQU0JrTTJWc08xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0JwWmlBb0lYUm9hWE11WkRObGJDa2dlMXh1SUNBZ0lDQWdJQ0F2THlCM1pTQjNaWEpsYmlkMElHZHBkbVZ1SUdFZ2JtVjNJR1ZzWlcxbGJuUWdkRzhnY21WdVpHVnlJSFJ2TENCemJ5QjFjMlVnZEdobElHeGhjM1FnYjI1bFhHNGdJQ0FnSUNBZ0lIUm9jbTkzSUc1bGR5QkZjbkp2Y2lnblEyRnNiR1ZrSUhKbGJtUmxjaWdwSUhkcGRHaHZkWFFnWVc0Z1pXeGxiV1Z1ZENCMGJ5QnlaVzVrWlhJZ2RHOGdLR0Z1WkNCdWJ5QndjbWx2Y2lCbGJHVnRaVzUwSUdoaGN5QmlaV1Z1SUhOd1pXTnBabWxsWkNrbktUdGNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lHUXpaV3dnUFNCMGFHbHpMbVF6Wld3N1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQWdJSFJvYVhNdVpHbHlkSGtnUFNCbVlXeHpaVHRjYmlBZ0lDQnlaWFIxY200Z0lXNWxaV1J6Um5KbGMyaFNaVzVrWlhJN1hHNGdJSDFjYmlBZ2NtVnVaR1Z5SUNoa00yVnNLU0I3WEc0Z0lDQWdaRE5sYkNBOUlHUXpaV3dnZkh3Z2RHaHBjeTVrTTJWc08xeHVJQ0FnSUdsbUlDZ2hkR2hwY3k1b1lYTlNaVzVrWlhKbFpGUnZLR1F6Wld3cEtTQjdYRzRnSUNBZ0lDQXZMeUJEWVd4c0lITmxkSFZ3SUdsdGJXVmthV0YwWld4NVhHNGdJQ0FnSUNCMGFHbHpMblZ3WkdGMFpVTnZiblJoYVc1bGNrTm9ZWEpoWTNSbGNtbHpkR2xqY3loa00yVnNLVHRjYmlBZ0lDQWdJSFJvYVhNdWMyVjBkWEFvWkRObGJDazdYRzRnSUNBZ0lDQjBhR2x6TG1RelpXd2dQU0JrTTJWc08xeHVJQ0FnSUgxY2JpQWdJQ0F2THlCRVpXSnZkVzVqWlNCMGFHVWdZV04wZFdGc0lHUnlZWGNnWTJGc2JGeHVJQ0FnSUdOc1pXRnlWR2x0Wlc5MWRDaDBhR2x6TG1SeVlYZFVhVzFsYjNWMEtUdGNiaUFnSUNCMGFHbHpMbVJ5WVhkVWFXMWxiM1YwSUQwZ2MyVjBWR2x0Wlc5MWRDZ29LU0E5UGlCN1hHNGdJQ0FnSUNCMGFHbHpMbVJ5WVhkVWFXMWxiM1YwSUQwZ2JuVnNiRHRjYmlBZ0lDQWdJSFJvYVhNdVpISmhkeWhrTTJWc0tUdGNiaUFnSUNCOUxDQjBhR2x6TG1SbFltOTFibU5sVjJGcGRDazdYRzRnSUgxY2JpQWdkWEJrWVhSbFEyOXVkR0ZwYm1WeVEyaGhjbUZqZEdWeWFYTjBhV056SUNoa00yVnNLU0I3WEc0Z0lDQWdhV1lnS0dRelpXd2dJVDA5SUc1MWJHd3BJSHRjYmlBZ0lDQWdJSFJvYVhNdVpXMVRhWHBsSUQwZ2NHRnljMlZHYkc5aGRDaGtNMlZzTG5OMGVXeGxLQ2RtYjI1MExYTnBlbVVuS1NrN1hHNGdJQ0FnSUNCMGFHbHpMbk5qY205c2JFSmhjbE5wZW1VZ1BTQjBhR2x6TG1OdmJYQjFkR1ZUWTNKdmJHeENZWEpUYVhwbEtHUXpaV3dwTzF4dUlDQWdJSDFjYmlBZ2ZWeHVJQ0JqYjIxd2RYUmxVMk55YjJ4c1FtRnlVMmw2WlNBb1pETmxiQ2tnZTF4dUlDQWdJQzh2SUdKc1lYUmhiblJzZVNCaFpHRndkR1ZrSUdaeWIyMGdVMDhnZEdoeVpXRmtPbHh1SUNBZ0lDOHZJR2gwZEhBNkx5OXpkR0ZqYTI5MlpYSm1iRzkzTG1OdmJTOXhkV1Z6ZEdsdmJuTXZNVE16T0RJMU1UWXZaMlYwZEdsdVp5MXpZM0p2Ykd3dFltRnlMWGRwWkhSb0xYVnphVzVuTFdwaGRtRnpZM0pwY0hSY2JpQWdJQ0IyWVhJZ2IzVjBaWElnUFNCa2IyTjFiV1Z1ZEM1amNtVmhkR1ZGYkdWdFpXNTBLQ2RrYVhZbktUdGNiaUFnSUNCdmRYUmxjaTV6ZEhsc1pTNTJhWE5wWW1sc2FYUjVJRDBnSjJocFpHUmxiaWM3WEc0Z0lDQWdiM1YwWlhJdWMzUjViR1V1ZDJsa2RHZ2dQU0FuTVRBd2NIZ25PMXh1SUNBZ0lHOTFkR1Z5TG5OMGVXeGxMbTF6VDNabGNtWnNiM2RUZEhsc1pTQTlJQ2R6WTNKdmJHeGlZWEluT3lBdkx5QnVaV1ZrWldRZ1ptOXlJRmRwYmtwVElHRndjSE5jYmx4dUlDQWdJR1F6Wld3dWJtOWtaU2dwTG1Gd2NHVnVaRU5vYVd4a0tHOTFkR1Z5S1R0Y2JseHVJQ0FnSUhaaGNpQjNhV1IwYUU1dlUyTnliMnhzSUQwZ2IzVjBaWEl1YjJabWMyVjBWMmxrZEdnN1hHNGdJQ0FnTHk4Z1ptOXlZMlVnYzJOeWIyeHNZbUZ5YzF4dUlDQWdJRzkxZEdWeUxuTjBlV3hsTG05MlpYSm1iRzkzSUQwZ0ozTmpjbTlzYkNjN1hHNWNiaUFnSUNBdkx5QmhaR1FnYVc1dVpYSmthWFpjYmlBZ0lDQjJZWElnYVc1dVpYSWdQU0JrYjJOMWJXVnVkQzVqY21WaGRHVkZiR1Z0Wlc1MEtDZGthWFluS1R0Y2JpQWdJQ0JwYm01bGNpNXpkSGxzWlM1M2FXUjBhQ0E5SUNjeE1EQWxKenRjYmlBZ0lDQnZkWFJsY2k1aGNIQmxibVJEYUdsc1pDaHBibTVsY2lrN1hHNWNiaUFnSUNCMllYSWdkMmxrZEdoWGFYUm9VMk55YjJ4c0lEMGdhVzV1WlhJdWIyWm1jMlYwVjJsa2RHZzdYRzVjYmlBZ0lDQXZMeUJ5WlcxdmRtVWdaR2wyYzF4dUlDQWdJRzkxZEdWeUxuQmhjbVZ1ZEU1dlpHVXVjbVZ0YjNabFEyaHBiR1FvYjNWMFpYSXBPMXh1WEc0Z0lDQWdjbVYwZFhKdUlIZHBaSFJvVG05VFkzSnZiR3dnTFNCM2FXUjBhRmRwZEdoVFkzSnZiR3c3WEc0Z0lIMWNibjFjYmx4dVpYaHdiM0owSUdSbFptRjFiSFFnVm1sbGR6dGNiaUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lRVUZCUVN4TlFVRk5MR0ZCUVdFc1EwRkJRenRGUVVOc1FpeHBRa0ZCYVVJc1EwRkJReXhEUVVGRExGVkJRVlVzUlVGQlJUdEpRVU0zUWl4VlFVRlZMRU5CUVVNc1QwRkJUeXhEUVVGRExFTkJRVU1zU1VGQlNUdE5RVU4wUWl4SlFVRkpMRWxCUVVrc1EwRkJReXhEUVVGRExFTkJRVU1zUzBGQlN5eFRRVUZUTEVWQlFVVTdVVUZEZWtJc1RVRkJUU3hKUVVGSkxGTkJRVk1zUTBGQlF5eERRVUZETEVkQlFVY3NNRUpCUVRCQ0xFZEJRVWNzU1VGQlNTeERRVUZETEZkQlFWY3NRMEZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRQUVVNM1JUdExRVU5HTEVOQlFVTXNRMEZCUXp0SFFVTktPME5CUTBZN08wRkRUa1FzVFVGQlRTeExRVUZMTEZOQlFWTXNZVUZCWVN4RFFVRkRPMFZCUTJoRExGZEJRVmNzUTBGQlF5eEhRVUZITzBsQlEySXNTMEZCU3l4RlFVRkZMRU5CUVVNN1NVRkRVaXhKUVVGSkxFTkJRVU1zWVVGQllTeEhRVUZITEVWQlFVVXNRMEZCUXp0SFFVTjZRanRGUVVORUxFVkJRVVVzUTBGQlF5eERRVUZETEZOQlFWTXNSVUZCUlN4UlFVRlJMRVZCUVVVc2RVSkJRWFZDTEVWQlFVVTdTVUZEYUVRc1NVRkJTU3hEUVVGRExFbEJRVWtzUTBGQlF5eGhRVUZoTEVOQlFVTXNVMEZCVXl4RFFVRkRMRVZCUVVVN1RVRkRiRU1zU1VGQlNTeERRVUZETEdGQlFXRXNRMEZCUXl4VFFVRlRMRU5CUVVNc1IwRkJSeXhGUVVGRkxFTkJRVU03UzBGRGNFTTdTVUZEUkN4SlFVRkpMRU5CUVVNc2RVSkJRWFZDTEVWQlFVVTdUVUZETlVJc1NVRkJTU3hKUVVGSkxFTkJRVU1zWVVGQllTeERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRMRTlCUVU4c1EwRkJReXhSUVVGUkxFTkJRVU1zUzBGQlN5eERRVUZETEVOQlFVTXNSVUZCUlR0UlFVTXhSQ3hQUVVGUE8wOUJRMUk3UzBGRFJqdEpRVU5FTEVsQlFVa3NRMEZCUXl4aFFVRmhMRU5CUVVNc1UwRkJVeXhEUVVGRExFTkJRVU1zU1VGQlNTeERRVUZETEZGQlFWRXNRMEZCUXl4RFFVRkRPMGRCUXpsRE8wVkJRMFFzUjBGQlJ5eERRVUZETEVOQlFVTXNVMEZCVXl4RlFVRkZMRkZCUVZFc1JVRkJSVHRKUVVONFFpeEpRVUZKTEVsQlFVa3NRMEZCUXl4aFFVRmhMRU5CUVVNc1UwRkJVeXhEUVVGRExFVkJRVVU3VFVGRGFrTXNTVUZCU1N4RFFVRkRMRkZCUVZFc1JVRkJSVHRSUVVOaUxFOUJRVThzU1VGQlNTeERRVUZETEdGQlFXRXNRMEZCUXl4VFFVRlRMRU5CUVVNc1EwRkJRenRQUVVOMFF5eE5RVUZOTzFGQlEwd3NTVUZCU1N4TFFVRkxMRWRCUVVjc1NVRkJTU3hEUVVGRExHRkJRV0VzUTBGQlF5eFRRVUZUTEVOQlFVTXNRMEZCUXl4UFFVRlBMRU5CUVVNc1VVRkJVU3hEUVVGRExFTkJRVU03VVVGRE5VUXNTVUZCU1N4TFFVRkxMRWxCUVVrc1EwRkJReXhGUVVGRk8xVkJRMlFzU1VGQlNTeERRVUZETEdGQlFXRXNRMEZCUXl4VFFVRlRMRU5CUVVNc1EwRkJReXhOUVVGTkxFTkJRVU1zUzBGQlN5eEZRVUZGTEVOQlFVTXNRMEZCUXl4RFFVRkRPMU5CUTJoRU8wOUJRMFk3UzBGRFJqdEhRVU5HTzBWQlEwUXNUMEZCVHl4RFFVRkRMRWRCUVVjN1NVRkRWQ3hKUVVGSkxGTkJRVk1zUjBGQlJ5eFRRVUZUTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1NVRkROMElzU1VGQlNTeEpRVUZKTEVkQlFVY3NTMEZCU3l4RFFVRkRMRk5CUVZNc1EwRkJReXhMUVVGTExFTkJRVU1zU1VGQlNTeERRVUZETEZOQlFWTXNSVUZCUlN4RFFVRkRMRU5CUVVNc1EwRkJRenRKUVVOd1JDeEpRVUZKTEVsQlFVa3NRMEZCUXl4aFFVRmhMRU5CUVVNc1UwRkJVeXhEUVVGRExFVkJRVVU3VFVGRGFrTXNTVUZCU1N4RFFVRkRMR0ZCUVdFc1EwRkJReXhUUVVGVExFTkJRVU1zUTBGQlF5eFBRVUZQTEVOQlFVTXNVVUZCVVN4SlFVRkpPMUZCUTJoRUxFMUJRVTBzUTBGQlF5eFZRVUZWTEVOQlFVTXNUVUZCVFR0VlFVTjBRaXhSUVVGUkxFTkJRVU1zUzBGQlN5eERRVUZETEVsQlFVa3NSVUZCUlN4SlFVRkpMRU5CUVVNc1EwRkJRenRUUVVNMVFpeEZRVUZGTEVOQlFVTXNRMEZCUXl4RFFVRkRPMDlCUTFBc1EwRkJReXhEUVVGRE8wdEJRMG83UjBGRFJqdERRVU5HT3p0QlEzWkRSQ3hOUVVGTkxFbEJRVWtzVTBGQlV5eExRVUZMTEVOQlFVTTdSVUZEZGtJc1YwRkJWeXhEUVVGRExFZEJRVWM3U1VGRFlpeExRVUZMTEVWQlFVVXNRMEZCUXp0SlFVTlNMRWxCUVVrc1EwRkJReXhKUVVGSkxFZEJRVWNzU1VGQlNTeERRVUZETzBsQlEycENMRWxCUVVrc1EwRkJReXhMUVVGTExFZEJRVWNzUzBGQlN5eERRVUZETzBsQlEyNUNMRWxCUVVrc1EwRkJReXhYUVVGWExFZEJRVWNzU1VGQlNTeERRVUZETzBsQlEzaENMRWxCUVVrc1EwRkJReXhaUVVGWkxFZEJRVWNzUjBGQlJ5eERRVUZETzBsQlEzaENMRWxCUVVrc1EwRkJReXhwUWtGQmFVSXNRMEZCUXl4RFFVRkRMRTlCUVU4c1JVRkJSU3hOUVVGTkxFTkJRVU1zUTBGQlF5eERRVUZETzBkQlF6TkRPMFZCUTBRc1lVRkJZU3hEUVVGRExFTkJRVU1zU1VGQlNTeEZRVUZGT3pzN096dEpRVXR1UWl4SlFVRkpMR2RDUVVGblFpeEhRVUZITEVsQlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNN1NVRkRiRU1zU1VGQlNTeEpRVUZKTEVWQlFVVTdUVUZEVWl4SlFVRkpMRWxCUVVrc1EwRkJReXhKUVVGSkxFVkJRVVU3TzFGQlJXSXNaMEpCUVdkQ0xFZEJRVWNzU1VGQlNTeERRVUZETEV0QlFVc3NTVUZCU1N4SlFVRkpMRU5CUVVNc1NVRkJTU3hGUVVGRkxFdEJRVXNzU1VGQlNTeERRVUZETEVsQlFVa3NRMEZCUXl4SlFVRkpMRVZCUVVVc1EwRkJRenRQUVVOdVJTeE5RVUZOT3p0UlFVVk1MR2RDUVVGblFpeEhRVUZITEVsQlFVa3NRMEZCUXp0UFFVTjZRanROUVVORUxFbEJRVWtzUTBGQlF5eEpRVUZKTEVkQlFVY3NTVUZCU1N4RFFVRkRPMHRCUTJ4Q0xFMUJRVTA3VFVGRFRDeEpRVUZKTEVOQlFVTXNTVUZCU1N4RFFVRkRMRWxCUVVrc1JVRkJSVHM3VVVGRlpDeE5RVUZOTEVsQlFVa3NTMEZCU3l4RFFVRkRMREpHUVVFeVJpeERRVUZETEVOQlFVTTdUMEZET1Vjc1RVRkJUVHRSUVVOTUxFbEJRVWtzUjBGQlJ5eEpRVUZKTEVOQlFVTXNTVUZCU1N4RFFVRkRPMDlCUTJ4Q08wdEJRMFk3U1VGRFJDeEpRVUZKTEVOQlFVTXNTMEZCU3l4SFFVRkhMRXRCUVVzc1EwRkJRenRKUVVOdVFpeFBRVUZQTEVOQlFVTXNaMEpCUVdkQ0xFTkJRVU03UjBGRE1VSTdSVUZEUkN4TlFVRk5MRU5CUVVNc1EwRkJReXhKUVVGSkxFVkJRVVU3U1VGRFdpeEpRVUZKTEVkQlFVY3NTVUZCU1N4SlFVRkpMRWxCUVVrc1EwRkJReXhKUVVGSkxFTkJRVU03U1VGRGVrSXNTVUZCU1N4RFFVRkRMRWxCUVVrc1EwRkJReXhoUVVGaExFTkJRVU1zU1VGQlNTeERRVUZETEVWQlFVVTdPMDFCUlRkQ0xFbEJRVWtzUTBGQlF5dzRRa0ZCT0VJc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dE5RVU14UXl4SlFVRkpMRU5CUVVNc1MwRkJTeXhEUVVGRExFbEJRVWtzUTBGQlF5eERRVUZETzAxQlEycENMRWxCUVVrc1EwRkJReXhKUVVGSkxFZEJRVWNzU1VGQlNTeERRVUZETzB0QlEyeENPenRKUVVWRUxGbEJRVmtzUTBGQlF5eEpRVUZKTEVOQlFVTXNWMEZCVnl4RFFVRkRMRU5CUVVNN1NVRkRMMElzU1VGQlNTeERRVUZETEZkQlFWY3NSMEZCUnl4VlFVRlZMRU5CUVVNc1RVRkJUVHROUVVOc1F5eEpRVUZKTEVOQlFVTXNWMEZCVnl4SFFVRkhMRWxCUVVrc1EwRkJRenROUVVONFFpeEpRVUZKTEVOQlFVTXNTVUZCU1N4RFFVRkRMRWxCUVVrc1EwRkJReXhEUVVGRE8wdEJRMnBDTEVWQlFVVXNTVUZCU1N4RFFVRkRMRmxCUVZrc1EwRkJReXhEUVVGRE8wZEJRM1pDTzBWQlEwUXNPRUpCUVRoQ0xFTkJRVU1zUTBGQlF5eEpRVUZKTEVWQlFVVTdTVUZEY0VNc1NVRkJTU3hKUVVGSkxFdEJRVXNzU1VGQlNTeEZRVUZGTzAxQlEycENMRWxCUVVrc1EwRkJReXhOUVVGTkxFZEJRVWNzVlVGQlZTeERRVUZETEVsQlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNc1YwRkJWeXhEUVVGRExFTkJRVU1zUTBGQlF6dE5RVU5zUkN4SlFVRkpMRU5CUVVNc1lVRkJZU3hIUVVGSExFbEJRVWtzUTBGQlF5eHZRa0ZCYjBJc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dExRVU4wUkR0SFFVTkdPMFZCUTBRc2IwSkJRVzlDTEVOQlFVTXNRMEZCUXl4SlFVRkpMRVZCUVVVN096dEpRVWN4UWl4SlFVRkpMRXRCUVVzc1IwRkJSeXhSUVVGUkxFTkJRVU1zWVVGQllTeERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRPMGxCUXpGRExFdEJRVXNzUTBGQlF5eExRVUZMTEVOQlFVTXNWVUZCVlN4SFFVRkhMRkZCUVZFc1EwRkJRenRKUVVOc1F5eExRVUZMTEVOQlFVTXNTMEZCU3l4RFFVRkRMRXRCUVVzc1IwRkJSeXhQUVVGUExFTkJRVU03U1VGRE5VSXNTMEZCU3l4RFFVRkRMRXRCUVVzc1EwRkJReXhsUVVGbExFZEJRVWNzVjBGQlZ5eERRVUZET3p0SlFVVXhReXhKUVVGSkxFTkJRVU1zU1VGQlNTeEZRVUZGTEVOQlFVTXNWMEZCVnl4RFFVRkRMRXRCUVVzc1EwRkJReXhEUVVGRE96dEpRVVV2UWl4SlFVRkpMR0ZCUVdFc1IwRkJSeXhMUVVGTExFTkJRVU1zVjBGQlZ5eERRVUZET3p0SlFVVjBReXhMUVVGTExFTkJRVU1zUzBGQlN5eERRVUZETEZGQlFWRXNSMEZCUnl4UlFVRlJMRU5CUVVNN096dEpRVWRvUXl4SlFVRkpMRXRCUVVzc1IwRkJSeXhSUVVGUkxFTkJRVU1zWVVGQllTeERRVUZETEV0QlFVc3NRMEZCUXl4RFFVRkRPMGxCUXpGRExFdEJRVXNzUTBGQlF5eExRVUZMTEVOQlFVTXNTMEZCU3l4SFFVRkhMRTFCUVUwc1EwRkJRenRKUVVNelFpeExRVUZMTEVOQlFVTXNWMEZCVnl4RFFVRkRMRXRCUVVzc1EwRkJReXhEUVVGRE96dEpRVVY2UWl4SlFVRkpMR1ZCUVdVc1IwRkJSeXhMUVVGTExFTkJRVU1zVjBGQlZ5eERRVUZET3pzN1NVRkhlRU1zUzBGQlN5eERRVUZETEZWQlFWVXNRMEZCUXl4WFFVRlhMRU5CUVVNc1MwRkJTeXhEUVVGRExFTkJRVU03TzBsQlJYQkRMRTlCUVU4c1lVRkJZU3hIUVVGSExHVkJRV1VzUTBGQlF6dEhRVU40UXp0RFFVTkdPenM3T3lKOVxuIiwiZXhwb3J0IGRlZmF1bHQgdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6XG4gICAgICAgICAgICB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOlxuICAgICAgICAgICAgdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9XG4iLCJcbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG52YXIgaW5pdGVkID0gZmFsc2U7XG5mdW5jdGlvbiBpbml0ICgpIHtcbiAgaW5pdGVkID0gdHJ1ZTtcbiAgdmFyIGNvZGUgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLydcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBsb29rdXBbaV0gPSBjb2RlW2ldXG4gICAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpXG4gIH1cblxuICByZXZMb29rdXBbJy0nLmNoYXJDb2RlQXQoMCldID0gNjJcbiAgcmV2TG9va3VwWydfJy5jaGFyQ29kZUF0KDApXSA9IDYzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0J5dGVBcnJheSAoYjY0KSB7XG4gIGlmICghaW5pdGVkKSB7XG4gICAgaW5pdCgpO1xuICB9XG4gIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gIC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcbiAgLy8gcmVwcmVzZW50IG9uZSBieXRlXG4gIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG4gIHBsYWNlSG9sZGVycyA9IGI2NFtsZW4gLSAyXSA9PT0gJz0nID8gMiA6IGI2NFtsZW4gLSAxXSA9PT0gJz0nID8gMSA6IDBcblxuICAvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbiAgYXJyID0gbmV3IEFycihsZW4gKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gbGVuIC0gNCA6IGxlblxuXG4gIHZhciBMID0gMFxuXG4gIGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAxOCkgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildIDw8IDYpIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAzKV1cbiAgICBhcnJbTCsrXSA9ICh0bXAgPj4gMTYpICYgMHhGRlxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcbiAgICB0bXAgPSAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA+PiA0KVxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDEwKSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA+PiAyKVxuICAgIGFycltMKytdID0gKHRtcCA+PiA4KSAmIDB4RkZcbiAgICBhcnJbTCsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgcmV0dXJuIGxvb2t1cFtudW0gPj4gMTggJiAweDNGXSArIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArIGxvb2t1cFtudW0gPj4gNiAmIDB4M0ZdICsgbG9va3VwW251bSAmIDB4M0ZdXG59XG5cbmZ1bmN0aW9uIGVuY29kZUNodW5rICh1aW50OCwgc3RhcnQsIGVuZCkge1xuICB2YXIgdG1wXG4gIHZhciBvdXRwdXQgPSBbXVxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkgKz0gMykge1xuICAgIHRtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcbiAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSlcbiAgfVxuICByZXR1cm4gb3V0cHV0LmpvaW4oJycpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmcm9tQnl0ZUFycmF5ICh1aW50OCkge1xuICBpZiAoIWluaXRlZCkge1xuICAgIGluaXQoKTtcbiAgfVxuICB2YXIgdG1wXG4gIHZhciBsZW4gPSB1aW50OC5sZW5ndGhcbiAgdmFyIGV4dHJhQnl0ZXMgPSBsZW4gJSAzIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG4gIHZhciBvdXRwdXQgPSAnJ1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPT0nXG4gIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgIHRtcCA9ICh1aW50OFtsZW4gLSAyXSA8PCA4KSArICh1aW50OFtsZW4gLSAxXSlcbiAgICBvdXRwdXQgKz0gbG9va3VwW3RtcCA+PiAxMF1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPj4gNCkgJiAweDNGXVxuICAgIG91dHB1dCArPSBsb29rdXBbKHRtcCA8PCAyKSAmIDB4M0ZdXG4gICAgb3V0cHV0ICs9ICc9J1xuICB9XG5cbiAgcGFydHMucHVzaChvdXRwdXQpXG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCJcbmV4cG9ydCBmdW5jdGlvbiByZWFkIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbmV4cG9ydCBkZWZhdWx0IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuXG5pbXBvcnQgKiBhcyBiYXNlNjQgZnJvbSAnLi9iYXNlNjQnXG5pbXBvcnQgKiBhcyBpZWVlNzU0IGZyb20gJy4vaWVlZTc1NCdcbmltcG9ydCBpc0FycmF5IGZyb20gJy4vaXNBcnJheSdcblxuZXhwb3J0IHZhciBJTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHJ1ZVxuXG4vKlxuICogRXhwb3J0IGtNYXhMZW5ndGggYWZ0ZXIgdHlwZWQgYXJyYXkgc3VwcG9ydCBpcyBkZXRlcm1pbmVkLlxuICovXG52YXIgX2tNYXhMZW5ndGggPSBrTWF4TGVuZ3RoKClcbmV4cG9ydCB7X2tNYXhMZW5ndGggYXMga01heExlbmd0aH07XG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIHJldHVybiB0cnVlO1xuICAvLyByb2xsdXAgaXNzdWVzXG4gIC8vIHRyeSB7XG4gIC8vICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gIC8vICAgYXJyLl9fcHJvdG9fXyA9IHtcbiAgLy8gICAgIF9fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsXG4gIC8vICAgICBmb286IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgLy8gICB9XG4gIC8vICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgLy8gICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgLy8gICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgLy8gfSBjYXRjaCAoZSkge1xuICAvLyAgIHJldHVybiBmYWxzZVxuICAvLyB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKGtNYXhMZW5ndGgoKSA8IGxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgaWYgKHRoYXQgPT09IG51bGwpIHtcbiAgICAgIHRoYXQgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgICB9XG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cblxuZXhwb3J0IGZ1bmN0aW9uIEJ1ZmZlciAoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiAhKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZ09yT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnSWYgZW5jb2RpbmcgaXMgc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBzdHJpbmcnXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZSh0aGlzLCBhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20odGhpcywgYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG4vLyBUT0RPOiBMZWdhY3ksIG5vdCBuZWVkZWQgYW55bW9yZS4gUmVtb3ZlIGluIG5leHQgbWFqb3IgdmVyc2lvbi5cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgYXJyLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiBmcm9tICh0aGF0LCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IG11c3Qgbm90IGJlIGEgbnVtYmVyJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHZhbHVlIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0KVxuICB9XG5cbiAgcmV0dXJuIGZyb21PYmplY3QodGhhdCwgdmFsdWUpXG59XG5cbi8qKlxuICogRnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdG8gQnVmZmVyKGFyZywgZW5jb2RpbmcpIGJ1dCB0aHJvd3MgYSBUeXBlRXJyb3JcbiAqIGlmIHZhbHVlIGlzIGEgbnVtYmVyLlxuICogQnVmZmVyLmZyb20oc3RyWywgZW5jb2RpbmddKVxuICogQnVmZmVyLmZyb20oYXJyYXkpXG4gKiBCdWZmZXIuZnJvbShidWZmZXIpXG4gKiBCdWZmZXIuZnJvbShhcnJheUJ1ZmZlclssIGJ5dGVPZmZzZXRbLCBsZW5ndGhdXSlcbiAqKi9cbkJ1ZmZlci5mcm9tID0gZnVuY3Rpb24gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGZyb20obnVsbCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gIEJ1ZmZlci5wcm90b3R5cGUuX19wcm90b19fID0gVWludDhBcnJheS5wcm90b3R5cGVcbiAgQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC5zcGVjaWVzICYmXG4gICAgICBCdWZmZXJbU3ltYm9sLnNwZWNpZXNdID09PSBCdWZmZXIpIHtcbiAgICAvLyBGaXggc3ViYXJyYXkoKSBpbiBFUzIwMTYuIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvcHVsbC85N1xuICAgIC8vIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIsIFN5bWJvbC5zcGVjaWVzLCB7XG4gICAgLy8gICB2YWx1ZTogbnVsbCxcbiAgICAvLyAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIC8vIH0pXG4gIH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBhIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgbmVnYXRpdmUnKVxuICB9XG59XG5cbmZ1bmN0aW9uIGFsbG9jICh0aGF0LCBzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICBhc3NlcnRTaXplKHNpemUpXG4gIGlmIChzaXplIDw9IDApIHtcbiAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG4gIH1cbiAgaWYgKGZpbGwgIT09IHVuZGVmaW5lZCkge1xuICAgIC8vIE9ubHkgcGF5IGF0dGVudGlvbiB0byBlbmNvZGluZyBpZiBpdCdzIGEgc3RyaW5nLiBUaGlzXG4gICAgLy8gcHJldmVudHMgYWNjaWRlbnRhbGx5IHNlbmRpbmcgaW4gYSBudW1iZXIgdGhhdCB3b3VsZFxuICAgIC8vIGJlIGludGVycHJldHRlZCBhcyBhIHN0YXJ0IG9mZnNldC5cbiAgICByZXR1cm4gdHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJ1xuICAgICAgPyBjcmVhdGVCdWZmZXIodGhhdCwgc2l6ZSkuZmlsbChmaWxsLCBlbmNvZGluZylcbiAgICAgIDogY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbClcbiAgfVxuICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBmaWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogYWxsb2Moc2l6ZVssIGZpbGxbLCBlbmNvZGluZ11dKVxuICoqL1xuQnVmZmVyLmFsbG9jID0gZnVuY3Rpb24gKHNpemUsIGZpbGwsIGVuY29kaW5nKSB7XG4gIHJldHVybiBhbGxvYyhudWxsLCBzaXplLCBmaWxsLCBlbmNvZGluZylcbn1cblxuZnVuY3Rpb24gYWxsb2NVbnNhZmUgKHRoYXQsIHNpemUpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICB0aGF0ID0gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUgPCAwID8gMCA6IGNoZWNrZWQoc2l6ZSkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzaXplOyArK2kpIHtcbiAgICAgIHRoYXRbaV0gPSAwXG4gICAgfVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogRXF1aXZhbGVudCB0byBCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqICovXG5CdWZmZXIuYWxsb2NVbnNhZmUgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cbi8qKlxuICogRXF1aXZhbGVudCB0byBTbG93QnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZVNsb3cgPSBmdW5jdGlvbiAoc2l6ZSkge1xuICByZXR1cm4gYWxsb2NVbnNhZmUobnVsbCwgc2l6ZSlcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICB9XG5cbiAgaWYgKCFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImVuY29kaW5nXCIgbXVzdCBiZSBhIHZhbGlkIHN0cmluZyBlbmNvZGluZycpXG4gIH1cblxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG5cbiAgdmFyIGFjdHVhbCA9IHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcblxuICBpZiAoYWN0dWFsICE9PSBsZW5ndGgpIHtcbiAgICAvLyBXcml0aW5nIGEgaGV4IHN0cmluZywgZm9yIGV4YW1wbGUsIHRoYXQgY29udGFpbnMgaW52YWxpZCBjaGFyYWN0ZXJzIHdpbGxcbiAgICAvLyBjYXVzZSBldmVyeXRoaW5nIGFmdGVyIHRoZSBmaXJzdCBpbnZhbGlkIGNoYXJhY3RlciB0byBiZSBpZ25vcmVkLiAoZS5nLlxuICAgIC8vICdhYnh4Y2QnIHdpbGwgYmUgdHJlYXRlZCBhcyAnYWInKVxuICAgIHRoYXQgPSB0aGF0LnNsaWNlKDAsIGFjdHVhbClcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUxpa2UgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGggPCAwID8gMCA6IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKGJ5dGVPZmZzZXQgPCAwIHx8IGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0KSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ29mZnNldFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIGlmIChhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCArIChsZW5ndGggfHwgMCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnbGVuZ3RoXFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBhcnJheVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbUFycmF5TGlrZSh0aGF0LCBhcnJheSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmopIHtcbiAgaWYgKGludGVybmFsSXNCdWZmZXIob2JqKSkge1xuICAgIHZhciBsZW4gPSBjaGVja2VkKG9iai5sZW5ndGgpIHwgMFxuICAgIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuKVxuXG4gICAgaWYgKHRoYXQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdGhhdFxuICAgIH1cblxuICAgIG9iai5jb3B5KHRoYXQsIDAsIDAsIGxlbilcbiAgICByZXR1cm4gdGhhdFxuICB9XG5cbiAgaWYgKG9iaikge1xuICAgIGlmICgodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICBvYmouYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHx8ICdsZW5ndGgnIGluIG9iaikge1xuICAgICAgaWYgKHR5cGVvZiBvYmoubGVuZ3RoICE9PSAnbnVtYmVyJyB8fCBpc25hbihvYmoubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlQnVmZmVyKHRoYXQsIDApXG4gICAgICB9XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmopXG4gICAgfVxuXG4gICAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBpc0FycmF5KG9iai5kYXRhKSkge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqLmRhdGEpXG4gICAgfVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZywgQnVmZmVyLCBBcnJheUJ1ZmZlciwgQXJyYXksIG9yIGFycmF5LWxpa2Ugb2JqZWN0LicpXG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoKClgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5leHBvcnQgZnVuY3Rpb24gU2xvd0J1ZmZlciAobGVuZ3RoKSB7XG4gIGlmICgrbGVuZ3RoICE9IGxlbmd0aCkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGVxZXFlcVxuICAgIGxlbmd0aCA9IDBcbiAgfVxuICByZXR1cm4gQnVmZmVyLmFsbG9jKCtsZW5ndGgpXG59XG5CdWZmZXIuaXNCdWZmZXIgPSBpc0J1ZmZlcjtcbmZ1bmN0aW9uIGludGVybmFsSXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghaW50ZXJuYWxJc0J1ZmZlcihhKSB8fCAhaW50ZXJuYWxJc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKHgsIHkpOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgeCA9IGFbaV1cbiAgICAgIHkgPSBiW2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdsYXRpbjEnOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gIH1cblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7ICsraSkge1xuICAgIHZhciBidWYgPSBsaXN0W2ldXG4gICAgaWYgKCFpbnRlcm5hbElzQnVmZmVyKGJ1ZikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gICAgfVxuICAgIGJ1Zi5jb3B5KGJ1ZmZlciwgcG9zKVxuICAgIHBvcyArPSBidWYubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZmZlclxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmIChpbnRlcm5hbElzQnVmZmVyKHN0cmluZykpIHtcbiAgICByZXR1cm4gc3RyaW5nLmxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBBcnJheUJ1ZmZlci5pc1ZpZXcgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIChBcnJheUJ1ZmZlci5pc1ZpZXcoc3RyaW5nKSB8fCBzdHJpbmcgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcbiAgICByZXR1cm4gc3RyaW5nLmJ5dGVMZW5ndGhcbiAgfVxuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcbiAgICBzdHJpbmcgPSAnJyArIHN0cmluZ1xuICB9XG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgIGNhc2UgdW5kZWZpbmVkOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgLy8gTm8gbmVlZCB0byB2ZXJpZnkgdGhhdCBcInRoaXMubGVuZ3RoIDw9IE1BWF9VSU5UMzJcIiBzaW5jZSBpdCdzIGEgcmVhZC1vbmx5XG4gIC8vIHByb3BlcnR5IG9mIGEgdHlwZWQgYXJyYXkuXG5cbiAgLy8gVGhpcyBiZWhhdmVzIG5laXRoZXIgbGlrZSBTdHJpbmcgbm9yIFVpbnQ4QXJyYXkgaW4gdGhhdCB3ZSBzZXQgc3RhcnQvZW5kXG4gIC8vIHRvIHRoZWlyIHVwcGVyL2xvd2VyIGJvdW5kcyBpZiB0aGUgdmFsdWUgcGFzc2VkIGlzIG91dCBvZiByYW5nZS5cbiAgLy8gdW5kZWZpbmVkIGlzIGhhbmRsZWQgc3BlY2lhbGx5IGFzIHBlciBFQ01BLTI2MiA2dGggRWRpdGlvbixcbiAgLy8gU2VjdGlvbiAxMy4zLjMuNyBSdW50aW1lIFNlbWFudGljczogS2V5ZWRCaW5kaW5nSW5pdGlhbGl6YXRpb24uXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkIHx8IHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIC8vIFJldHVybiBlYXJseSBpZiBzdGFydCA+IHRoaXMubGVuZ3RoLiBEb25lIGhlcmUgdG8gcHJldmVudCBwb3RlbnRpYWwgdWludDMyXG4gIC8vIGNvZXJjaW9uIGZhaWwgYmVsb3cuXG4gIGlmIChzdGFydCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKGVuZCA8PSAwKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICAvLyBGb3JjZSBjb2Vyc2lvbiB0byB1aW50MzIuIFRoaXMgd2lsbCBhbHNvIGNvZXJjZSBmYWxzZXkvTmFOIHZhbHVlcyB0byAwLlxuICBlbmQgPj4+PSAwXG4gIHN0YXJ0ID4+Pj0gMFxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdsYXRpbjEnOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGxhdGluMVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGUgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCBhbmQgYGlzLWJ1ZmZlcmAgKGluIFNhZmFyaSA1LTcpIHRvIGRldGVjdFxuLy8gQnVmZmVyIGluc3RhbmNlcy5cbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5mdW5jdGlvbiBzd2FwIChiLCBuLCBtKSB7XG4gIHZhciBpID0gYltuXVxuICBiW25dID0gYlttXVxuICBiW21dID0gaVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAxNiA9IGZ1bmN0aW9uIHN3YXAxNiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgMiAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMTYtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDEpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMzIgPSBmdW5jdGlvbiBzd2FwMzIgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDMyLWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAzKVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyAyKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDY0ID0gZnVuY3Rpb24gc3dhcDY0ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSA4ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA2NC1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSA4KSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgNylcbiAgICBzd2FwKHRoaXMsIGkgKyAxLCBpICsgNilcbiAgICBzd2FwKHRoaXMsIGkgKyAyLCBpICsgNSlcbiAgICBzd2FwKHRoaXMsIGkgKyAzLCBpICsgNClcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIWludGVybmFsSXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IElOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlICh0YXJnZXQsIHN0YXJ0LCBlbmQsIHRoaXNTdGFydCwgdGhpc0VuZCkge1xuICBpZiAoIWludGVybmFsSXNCdWZmZXIodGFyZ2V0KSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICB9XG5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBpZiAoZW5kID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmQgPSB0YXJnZXQgPyB0YXJnZXQubGVuZ3RoIDogMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNTdGFydCA9IDBcbiAgfVxuICBpZiAodGhpc0VuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc0VuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoc3RhcnQgPCAwIHx8IGVuZCA+IHRhcmdldC5sZW5ndGggfHwgdGhpc1N0YXJ0IDwgMCB8fCB0aGlzRW5kID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCAmJiBzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMFxuICB9XG4gIGlmICh0aGlzU3RhcnQgPj0gdGhpc0VuZCkge1xuICAgIHJldHVybiAtMVxuICB9XG4gIGlmIChzdGFydCA+PSBlbmQpIHtcbiAgICByZXR1cm4gMVxuICB9XG5cbiAgc3RhcnQgPj4+PSAwXG4gIGVuZCA+Pj49IDBcbiAgdGhpc1N0YXJ0ID4+Pj0gMFxuICB0aGlzRW5kID4+Pj0gMFxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQpIHJldHVybiAwXG5cbiAgdmFyIHggPSB0aGlzRW5kIC0gdGhpc1N0YXJ0XG4gIHZhciB5ID0gZW5kIC0gc3RhcnRcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG5cbiAgdmFyIHRoaXNDb3B5ID0gdGhpcy5zbGljZSh0aGlzU3RhcnQsIHRoaXNFbmQpXG4gIHZhciB0YXJnZXRDb3B5ID0gdGFyZ2V0LnNsaWNlKHN0YXJ0LCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgIGlmICh0aGlzQ29weVtpXSAhPT0gdGFyZ2V0Q29weVtpXSkge1xuICAgICAgeCA9IHRoaXNDb3B5W2ldXG4gICAgICB5ID0gdGFyZ2V0Q29weVtpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbi8vIEZpbmRzIGVpdGhlciB0aGUgZmlyc3QgaW5kZXggb2YgYHZhbGAgaW4gYGJ1ZmZlcmAgYXQgb2Zmc2V0ID49IGBieXRlT2Zmc2V0YCxcbi8vIE9SIHRoZSBsYXN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA8PSBgYnl0ZU9mZnNldGAuXG4vL1xuLy8gQXJndW1lbnRzOlxuLy8gLSBidWZmZXIgLSBhIEJ1ZmZlciB0byBzZWFyY2hcbi8vIC0gdmFsIC0gYSBzdHJpbmcsIEJ1ZmZlciwgb3IgbnVtYmVyXG4vLyAtIGJ5dGVPZmZzZXQgLSBhbiBpbmRleCBpbnRvIGBidWZmZXJgOyB3aWxsIGJlIGNsYW1wZWQgdG8gYW4gaW50MzJcbi8vIC0gZW5jb2RpbmcgLSBhbiBvcHRpb25hbCBlbmNvZGluZywgcmVsZXZhbnQgaXMgdmFsIGlzIGEgc3RyaW5nXG4vLyAtIGRpciAtIHRydWUgZm9yIGluZGV4T2YsIGZhbHNlIGZvciBsYXN0SW5kZXhPZlxuZnVuY3Rpb24gYmlkaXJlY3Rpb25hbEluZGV4T2YgKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIC8vIEVtcHR5IGJ1ZmZlciBtZWFucyBubyBtYXRjaFxuICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG5cbiAgLy8gTm9ybWFsaXplIGJ5dGVPZmZzZXRcbiAgaWYgKHR5cGVvZiBieXRlT2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gYnl0ZU9mZnNldFxuICAgIGJ5dGVPZmZzZXQgPSAwXG4gIH0gZWxzZSBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIHtcbiAgICBieXRlT2Zmc2V0ID0gMHg3ZmZmZmZmZlxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkge1xuICAgIGJ5dGVPZmZzZXQgPSAtMHg4MDAwMDAwMFxuICB9XG4gIGJ5dGVPZmZzZXQgPSArYnl0ZU9mZnNldCAgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKGlzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChpbnRlcm5hbElzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMHhGRiAvLyBTZWFyY2ggZm9yIGEgYnl0ZSB2YWx1ZSBbMC0yNTVdXG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmXG4gICAgICAgIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpZiAoZGlyKSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUubGFzdEluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZihidWZmZXIsIFsgdmFsIF0sIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgZGlyKSB7XG4gIHZhciBpbmRleFNpemUgPSAxXG4gIHZhciBhcnJMZW5ndGggPSBhcnIubGVuZ3RoXG4gIHZhciB2YWxMZW5ndGggPSB2YWwubGVuZ3RoXG5cbiAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9IFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgIGlmIChlbmNvZGluZyA9PT0gJ3VjczInIHx8IGVuY29kaW5nID09PSAndWNzLTInIHx8XG4gICAgICAgIGVuY29kaW5nID09PSAndXRmMTZsZScgfHwgZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcbiAgICAgIGlmIChhcnIubGVuZ3RoIDwgMiB8fCB2YWwubGVuZ3RoIDwgMikge1xuICAgICAgICByZXR1cm4gLTFcbiAgICAgIH1cbiAgICAgIGluZGV4U2l6ZSA9IDJcbiAgICAgIGFyckxlbmd0aCAvPSAyXG4gICAgICB2YWxMZW5ndGggLz0gMlxuICAgICAgYnl0ZU9mZnNldCAvPSAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoYnVmLCBpKSB7XG4gICAgaWYgKGluZGV4U2l6ZSA9PT0gMSkge1xuICAgICAgcmV0dXJuIGJ1ZltpXVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYnVmLnJlYWRVSW50MTZCRShpICogaW5kZXhTaXplKVxuICAgIH1cbiAgfVxuXG4gIHZhciBpXG4gIGlmIChkaXIpIHtcbiAgICB2YXIgZm91bmRJbmRleCA9IC0xXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA8IGFyckxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAocmVhZChhcnIsIGkpID09PSByZWFkKHZhbCwgZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXgpKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gZm91bmRJbmRleCAqIGluZGV4U2l6ZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggIT09IC0xKSBpIC09IGkgLSBmb3VuZEluZGV4XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYnl0ZU9mZnNldCArIHZhbExlbmd0aCA+IGFyckxlbmd0aCkgYnl0ZU9mZnNldCA9IGFyckxlbmd0aCAtIHZhbExlbmd0aFxuICAgIGZvciAoaSA9IGJ5dGVPZmZzZXQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB2YXIgZm91bmQgPSB0cnVlXG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IHZhbExlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChyZWFkKGFyciwgaSArIGopICE9PSByZWFkKHZhbCwgaikpIHtcbiAgICAgICAgICBmb3VuZCA9IGZhbHNlXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGZvdW5kKSByZXR1cm4gaVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluY2x1ZGVzID0gZnVuY3Rpb24gaW5jbHVkZXMgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIHRoaXMuaW5kZXhPZih2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSAhPT0gLTFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gYmlkaXJlY3Rpb25hbEluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZywgdHJ1ZSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uIGxhc3RJbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBmYWxzZSlcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgcmV0dXJuIGlcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGxhdGluMVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gdGhpcy5zdWJhcnJheShzdGFydCwgZW5kKVxuICAgIG5ld0J1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgKytpKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghaW50ZXJuYWxJc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIG1heEJ5dGVzID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpIC0gMVxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG1heEJ5dGVzLCAwKVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgKytpKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7ICsraSkge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSArIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBVc2FnZTpcbi8vICAgIGJ1ZmZlci5maWxsKG51bWJlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoYnVmZmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChzdHJpbmdbLCBvZmZzZXRbLCBlbmRdXVssIGVuY29kaW5nXSlcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbCwgc3RhcnQsIGVuZCwgZW5jb2RpbmcpIHtcbiAgLy8gSGFuZGxlIHN0cmluZyBjYXNlczpcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gc3RhcnRcbiAgICAgIHN0YXJ0ID0gMFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IGVuZFxuICAgICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgICB9XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDEpIHtcbiAgICAgIHZhciBjb2RlID0gdmFsLmNoYXJDb2RlQXQoMClcbiAgICAgIGlmIChjb2RlIDwgMjU2KSB7XG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVuY29kaW5nICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZW5jb2RpbmcgbXVzdCBiZSBhIHN0cmluZycpXG4gICAgfVxuICAgIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNFbmNvZGluZyhlbmNvZGluZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IGludGVybmFsSXNCdWZmZXIodmFsKVxuICAgICAgPyB2YWxcbiAgICAgIDogdXRmOFRvQnl0ZXMobmV3IEJ1ZmZlcih2YWwsIGVuY29kaW5nKS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSAwOyBpIDwgZW5kIC0gc3RhcnQ7ICsraSkge1xuICAgICAgdGhpc1tpICsgc3RhcnRdID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIGlzbmFuICh2YWwpIHtcbiAgcmV0dXJuIHZhbCAhPT0gdmFsIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tc2VsZi1jb21wYXJlXG59XG5cblxuLy8gdGhlIGZvbGxvd2luZyBpcyBmcm9tIGlzLWJ1ZmZlciwgYWxzbyBieSBGZXJvc3MgQWJvdWtoYWRpamVoIGFuZCB3aXRoIHNhbWUgbGlzZW5jZVxuLy8gVGhlIF9pc0J1ZmZlciBjaGVjayBpcyBmb3IgU2FmYXJpIDUtNyBzdXBwb3J0LCBiZWNhdXNlIGl0J3MgbWlzc2luZ1xuLy8gT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3Rvci4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseVxuZXhwb3J0IGZ1bmN0aW9uIGlzQnVmZmVyKG9iaikge1xuICByZXR1cm4gb2JqICE9IG51bGwgJiYgKCEhb2JqLl9pc0J1ZmZlciB8fCBpc0Zhc3RCdWZmZXIob2JqKSB8fCBpc1Nsb3dCdWZmZXIob2JqKSlcbn1cblxuZnVuY3Rpb24gaXNGYXN0QnVmZmVyIChvYmopIHtcbiAgcmV0dXJuICEhb2JqLmNvbnN0cnVjdG9yICYmIHR5cGVvZiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicgJiYgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iailcbn1cblxuLy8gRm9yIE5vZGUgdjAuMTAgc3VwcG9ydC4gUmVtb3ZlIHRoaXMgZXZlbnR1YWxseS5cbmZ1bmN0aW9uIGlzU2xvd0J1ZmZlciAob2JqKSB7XG4gIHJldHVybiB0eXBlb2Ygb2JqLnJlYWRGbG9hdExFID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBvYmouc2xpY2UgPT09ICdmdW5jdGlvbicgJiYgaXNGYXN0QnVmZmVyKG9iai5zbGljZSgwLCAwKSlcbn1cbiIsIjsoZnVuY3Rpb24gKHNheCkgeyAvLyB3cmFwcGVyIGZvciBub24tbm9kZSBlbnZzXG4gIHNheC5wYXJzZXIgPSBmdW5jdGlvbiAoc3RyaWN0LCBvcHQpIHsgcmV0dXJuIG5ldyBTQVhQYXJzZXIoc3RyaWN0LCBvcHQpIH1cbiAgc2F4LlNBWFBhcnNlciA9IFNBWFBhcnNlclxuICBzYXguU0FYU3RyZWFtID0gU0FYU3RyZWFtXG4gIHNheC5jcmVhdGVTdHJlYW0gPSBjcmVhdGVTdHJlYW1cblxuICAvLyBXaGVuIHdlIHBhc3MgdGhlIE1BWF9CVUZGRVJfTEVOR1RIIHBvc2l0aW9uLCBzdGFydCBjaGVja2luZyBmb3IgYnVmZmVyIG92ZXJydW5zLlxuICAvLyBXaGVuIHdlIGNoZWNrLCBzY2hlZHVsZSB0aGUgbmV4dCBjaGVjayBmb3IgTUFYX0JVRkZFUl9MRU5HVEggLSAobWF4KGJ1ZmZlciBsZW5ndGhzKSksXG4gIC8vIHNpbmNlIHRoYXQncyB0aGUgZWFybGllc3QgdGhhdCBhIGJ1ZmZlciBvdmVycnVuIGNvdWxkIG9jY3VyLiAgVGhpcyB3YXksIGNoZWNrcyBhcmVcbiAgLy8gYXMgcmFyZSBhcyByZXF1aXJlZCwgYnV0IGFzIG9mdGVuIGFzIG5lY2Vzc2FyeSB0byBlbnN1cmUgbmV2ZXIgY3Jvc3NpbmcgdGhpcyBib3VuZC5cbiAgLy8gRnVydGhlcm1vcmUsIGJ1ZmZlcnMgYXJlIG9ubHkgdGVzdGVkIGF0IG1vc3Qgb25jZSBwZXIgd3JpdGUoKSwgc28gcGFzc2luZyBhIHZlcnlcbiAgLy8gbGFyZ2Ugc3RyaW5nIGludG8gd3JpdGUoKSBtaWdodCBoYXZlIHVuZGVzaXJhYmxlIGVmZmVjdHMsIGJ1dCB0aGlzIGlzIG1hbmFnZWFibGUgYnlcbiAgLy8gdGhlIGNhbGxlciwgc28gaXQgaXMgYXNzdW1lZCB0byBiZSBzYWZlLiAgVGh1cywgYSBjYWxsIHRvIHdyaXRlKCkgbWF5LCBpbiB0aGUgZXh0cmVtZVxuICAvLyBlZGdlIGNhc2UsIHJlc3VsdCBpbiBjcmVhdGluZyBhdCBtb3N0IG9uZSBjb21wbGV0ZSBjb3B5IG9mIHRoZSBzdHJpbmcgcGFzc2VkIGluLlxuICAvLyBTZXQgdG8gSW5maW5pdHkgdG8gaGF2ZSB1bmxpbWl0ZWQgYnVmZmVycy5cbiAgc2F4Lk1BWF9CVUZGRVJfTEVOR1RIID0gNjQgKiAxMDI0XG5cbiAgdmFyIGJ1ZmZlcnMgPSBbXG4gICAgJ2NvbW1lbnQnLCAnc2dtbERlY2wnLCAndGV4dE5vZGUnLCAndGFnTmFtZScsICdkb2N0eXBlJyxcbiAgICAncHJvY0luc3ROYW1lJywgJ3Byb2NJbnN0Qm9keScsICdlbnRpdHknLCAnYXR0cmliTmFtZScsXG4gICAgJ2F0dHJpYlZhbHVlJywgJ2NkYXRhJywgJ3NjcmlwdCdcbiAgXVxuXG4gIHNheC5FVkVOVFMgPSBbXG4gICAgJ3RleHQnLFxuICAgICdwcm9jZXNzaW5naW5zdHJ1Y3Rpb24nLFxuICAgICdzZ21sZGVjbGFyYXRpb24nLFxuICAgICdkb2N0eXBlJyxcbiAgICAnY29tbWVudCcsXG4gICAgJ29wZW50YWdzdGFydCcsXG4gICAgJ2F0dHJpYnV0ZScsXG4gICAgJ29wZW50YWcnLFxuICAgICdjbG9zZXRhZycsXG4gICAgJ29wZW5jZGF0YScsXG4gICAgJ2NkYXRhJyxcbiAgICAnY2xvc2VjZGF0YScsXG4gICAgJ2Vycm9yJyxcbiAgICAnZW5kJyxcbiAgICAncmVhZHknLFxuICAgICdzY3JpcHQnLFxuICAgICdvcGVubmFtZXNwYWNlJyxcbiAgICAnY2xvc2VuYW1lc3BhY2UnXG4gIF1cblxuICBmdW5jdGlvbiBTQVhQYXJzZXIgKHN0cmljdCwgb3B0KSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNBWFBhcnNlcikpIHtcbiAgICAgIHJldHVybiBuZXcgU0FYUGFyc2VyKHN0cmljdCwgb3B0KVxuICAgIH1cblxuICAgIHZhciBwYXJzZXIgPSB0aGlzXG4gICAgY2xlYXJCdWZmZXJzKHBhcnNlcilcbiAgICBwYXJzZXIucSA9IHBhcnNlci5jID0gJydcbiAgICBwYXJzZXIuYnVmZmVyQ2hlY2tQb3NpdGlvbiA9IHNheC5NQVhfQlVGRkVSX0xFTkdUSFxuICAgIHBhcnNlci5vcHQgPSBvcHQgfHwge31cbiAgICBwYXJzZXIub3B0Lmxvd2VyY2FzZSA9IHBhcnNlci5vcHQubG93ZXJjYXNlIHx8IHBhcnNlci5vcHQubG93ZXJjYXNldGFnc1xuICAgIHBhcnNlci5sb29zZUNhc2UgPSBwYXJzZXIub3B0Lmxvd2VyY2FzZSA/ICd0b0xvd2VyQ2FzZScgOiAndG9VcHBlckNhc2UnXG4gICAgcGFyc2VyLnRhZ3MgPSBbXVxuICAgIHBhcnNlci5jbG9zZWQgPSBwYXJzZXIuY2xvc2VkUm9vdCA9IHBhcnNlci5zYXdSb290ID0gZmFsc2VcbiAgICBwYXJzZXIudGFnID0gcGFyc2VyLmVycm9yID0gbnVsbFxuICAgIHBhcnNlci5zdHJpY3QgPSAhIXN0cmljdFxuICAgIHBhcnNlci5ub3NjcmlwdCA9ICEhKHN0cmljdCB8fCBwYXJzZXIub3B0Lm5vc2NyaXB0KVxuICAgIHBhcnNlci5zdGF0ZSA9IFMuQkVHSU5cbiAgICBwYXJzZXIuc3RyaWN0RW50aXRpZXMgPSBwYXJzZXIub3B0LnN0cmljdEVudGl0aWVzXG4gICAgcGFyc2VyLkVOVElUSUVTID0gcGFyc2VyLnN0cmljdEVudGl0aWVzID8gT2JqZWN0LmNyZWF0ZShzYXguWE1MX0VOVElUSUVTKSA6IE9iamVjdC5jcmVhdGUoc2F4LkVOVElUSUVTKVxuICAgIHBhcnNlci5hdHRyaWJMaXN0ID0gW11cblxuICAgIC8vIG5hbWVzcGFjZXMgZm9ybSBhIHByb3RvdHlwZSBjaGFpbi5cbiAgICAvLyBpdCBhbHdheXMgcG9pbnRzIGF0IHRoZSBjdXJyZW50IHRhZyxcbiAgICAvLyB3aGljaCBwcm90b3MgdG8gaXRzIHBhcmVudCB0YWcuXG4gICAgaWYgKHBhcnNlci5vcHQueG1sbnMpIHtcbiAgICAgIHBhcnNlci5ucyA9IE9iamVjdC5jcmVhdGUocm9vdE5TKVxuICAgIH1cblxuICAgIC8vIG1vc3RseSBqdXN0IGZvciBlcnJvciByZXBvcnRpbmdcbiAgICBwYXJzZXIudHJhY2tQb3NpdGlvbiA9IHBhcnNlci5vcHQucG9zaXRpb24gIT09IGZhbHNlXG4gICAgaWYgKHBhcnNlci50cmFja1Bvc2l0aW9uKSB7XG4gICAgICBwYXJzZXIucG9zaXRpb24gPSBwYXJzZXIubGluZSA9IHBhcnNlci5jb2x1bW4gPSAwXG4gICAgfVxuICAgIGVtaXQocGFyc2VyLCAnb25yZWFkeScpXG4gIH1cblxuICBpZiAoIU9iamVjdC5jcmVhdGUpIHtcbiAgICBPYmplY3QuY3JlYXRlID0gZnVuY3Rpb24gKG8pIHtcbiAgICAgIGZ1bmN0aW9uIEYgKCkge31cbiAgICAgIEYucHJvdG90eXBlID0gb1xuICAgICAgdmFyIG5ld2YgPSBuZXcgRigpXG4gICAgICByZXR1cm4gbmV3ZlxuICAgIH1cbiAgfVxuXG4gIGlmICghT2JqZWN0LmtleXMpIHtcbiAgICBPYmplY3Qua2V5cyA9IGZ1bmN0aW9uIChvKSB7XG4gICAgICB2YXIgYSA9IFtdXG4gICAgICBmb3IgKHZhciBpIGluIG8pIGlmIChvLmhhc093blByb3BlcnR5KGkpKSBhLnB1c2goaSlcbiAgICAgIHJldHVybiBhXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY2hlY2tCdWZmZXJMZW5ndGggKHBhcnNlcikge1xuICAgIHZhciBtYXhBbGxvd2VkID0gTWF0aC5tYXgoc2F4Lk1BWF9CVUZGRVJfTEVOR1RILCAxMClcbiAgICB2YXIgbWF4QWN0dWFsID0gMFxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gYnVmZmVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBsZW4gPSBwYXJzZXJbYnVmZmVyc1tpXV0ubGVuZ3RoXG4gICAgICBpZiAobGVuID4gbWF4QWxsb3dlZCkge1xuICAgICAgICAvLyBUZXh0L2NkYXRhIG5vZGVzIGNhbiBnZXQgYmlnLCBhbmQgc2luY2UgdGhleSdyZSBidWZmZXJlZCxcbiAgICAgICAgLy8gd2UgY2FuIGdldCBoZXJlIHVuZGVyIG5vcm1hbCBjb25kaXRpb25zLlxuICAgICAgICAvLyBBdm9pZCBpc3N1ZXMgYnkgZW1pdHRpbmcgdGhlIHRleHQgbm9kZSBub3csXG4gICAgICAgIC8vIHNvIGF0IGxlYXN0IGl0IHdvbid0IGdldCBhbnkgYmlnZ2VyLlxuICAgICAgICBzd2l0Y2ggKGJ1ZmZlcnNbaV0pIHtcbiAgICAgICAgICBjYXNlICd0ZXh0Tm9kZSc6XG4gICAgICAgICAgICBjbG9zZVRleHQocGFyc2VyKVxuICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgIGNhc2UgJ2NkYXRhJzpcbiAgICAgICAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29uY2RhdGEnLCBwYXJzZXIuY2RhdGEpXG4gICAgICAgICAgICBwYXJzZXIuY2RhdGEgPSAnJ1xuICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgIGNhc2UgJ3NjcmlwdCc6XG4gICAgICAgICAgICBlbWl0Tm9kZShwYXJzZXIsICdvbnNjcmlwdCcsIHBhcnNlci5zY3JpcHQpXG4gICAgICAgICAgICBwYXJzZXIuc2NyaXB0ID0gJydcbiAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgZXJyb3IocGFyc2VyLCAnTWF4IGJ1ZmZlciBsZW5ndGggZXhjZWVkZWQ6ICcgKyBidWZmZXJzW2ldKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtYXhBY3R1YWwgPSBNYXRoLm1heChtYXhBY3R1YWwsIGxlbilcbiAgICB9XG4gICAgLy8gc2NoZWR1bGUgdGhlIG5leHQgY2hlY2sgZm9yIHRoZSBlYXJsaWVzdCBwb3NzaWJsZSBidWZmZXIgb3ZlcnJ1bi5cbiAgICB2YXIgbSA9IHNheC5NQVhfQlVGRkVSX0xFTkdUSCAtIG1heEFjdHVhbFxuICAgIHBhcnNlci5idWZmZXJDaGVja1Bvc2l0aW9uID0gbSArIHBhcnNlci5wb3NpdGlvblxuICB9XG5cbiAgZnVuY3Rpb24gY2xlYXJCdWZmZXJzIChwYXJzZXIpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGJ1ZmZlcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBwYXJzZXJbYnVmZmVyc1tpXV0gPSAnJ1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZsdXNoQnVmZmVycyAocGFyc2VyKSB7XG4gICAgY2xvc2VUZXh0KHBhcnNlcilcbiAgICBpZiAocGFyc2VyLmNkYXRhICE9PSAnJykge1xuICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25jZGF0YScsIHBhcnNlci5jZGF0YSlcbiAgICAgIHBhcnNlci5jZGF0YSA9ICcnXG4gICAgfVxuICAgIGlmIChwYXJzZXIuc2NyaXB0ICE9PSAnJykge1xuICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25zY3JpcHQnLCBwYXJzZXIuc2NyaXB0KVxuICAgICAgcGFyc2VyLnNjcmlwdCA9ICcnXG4gICAgfVxuICB9XG5cbiAgU0FYUGFyc2VyLnByb3RvdHlwZSA9IHtcbiAgICBlbmQ6IGZ1bmN0aW9uICgpIHsgZW5kKHRoaXMpIH0sXG4gICAgd3JpdGU6IHdyaXRlLFxuICAgIHJlc3VtZTogZnVuY3Rpb24gKCkgeyB0aGlzLmVycm9yID0gbnVsbDsgcmV0dXJuIHRoaXMgfSxcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpcy53cml0ZShudWxsKSB9LFxuICAgIGZsdXNoOiBmdW5jdGlvbiAoKSB7IGZsdXNoQnVmZmVycyh0aGlzKSB9XG4gIH1cblxuICB2YXIgU3RyZWFtXG4gIHRyeSB7XG4gICAgU3RyZWFtID0gcmVxdWlyZSgnc3RyZWFtJykuU3RyZWFtXG4gIH0gY2F0Y2ggKGV4KSB7XG4gICAgU3RyZWFtID0gZnVuY3Rpb24gKCkge31cbiAgfVxuXG4gIHZhciBzdHJlYW1XcmFwcyA9IHNheC5FVkVOVFMuZmlsdGVyKGZ1bmN0aW9uIChldikge1xuICAgIHJldHVybiBldiAhPT0gJ2Vycm9yJyAmJiBldiAhPT0gJ2VuZCdcbiAgfSlcblxuICBmdW5jdGlvbiBjcmVhdGVTdHJlYW0gKHN0cmljdCwgb3B0KSB7XG4gICAgcmV0dXJuIG5ldyBTQVhTdHJlYW0oc3RyaWN0LCBvcHQpXG4gIH1cblxuICBmdW5jdGlvbiBTQVhTdHJlYW0gKHN0cmljdCwgb3B0KSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNBWFN0cmVhbSkpIHtcbiAgICAgIHJldHVybiBuZXcgU0FYU3RyZWFtKHN0cmljdCwgb3B0KVxuICAgIH1cblxuICAgIFN0cmVhbS5hcHBseSh0aGlzKVxuXG4gICAgdGhpcy5fcGFyc2VyID0gbmV3IFNBWFBhcnNlcihzdHJpY3QsIG9wdClcbiAgICB0aGlzLndyaXRhYmxlID0gdHJ1ZVxuICAgIHRoaXMucmVhZGFibGUgPSB0cnVlXG5cbiAgICB2YXIgbWUgPSB0aGlzXG5cbiAgICB0aGlzLl9wYXJzZXIub25lbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBtZS5lbWl0KCdlbmQnKVxuICAgIH1cblxuICAgIHRoaXMuX3BhcnNlci5vbmVycm9yID0gZnVuY3Rpb24gKGVyKSB7XG4gICAgICBtZS5lbWl0KCdlcnJvcicsIGVyKVxuXG4gICAgICAvLyBpZiBkaWRuJ3QgdGhyb3csIHRoZW4gbWVhbnMgZXJyb3Igd2FzIGhhbmRsZWQuXG4gICAgICAvLyBnbyBhaGVhZCBhbmQgY2xlYXIgZXJyb3IsIHNvIHdlIGNhbiB3cml0ZSBhZ2Fpbi5cbiAgICAgIG1lLl9wYXJzZXIuZXJyb3IgPSBudWxsXG4gICAgfVxuXG4gICAgdGhpcy5fZGVjb2RlciA9IG51bGxcblxuICAgIHN0cmVhbVdyYXBzLmZvckVhY2goZnVuY3Rpb24gKGV2KSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobWUsICdvbicgKyBldiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gbWUuX3BhcnNlclsnb24nICsgZXZdXG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKGgpIHtcbiAgICAgICAgICBpZiAoIWgpIHtcbiAgICAgICAgICAgIG1lLnJlbW92ZUFsbExpc3RlbmVycyhldilcbiAgICAgICAgICAgIG1lLl9wYXJzZXJbJ29uJyArIGV2XSA9IGhcbiAgICAgICAgICAgIHJldHVybiBoXG4gICAgICAgICAgfVxuICAgICAgICAgIG1lLm9uKGV2LCBoKVxuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBTQVhTdHJlYW0ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdHJlYW0ucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHtcbiAgICAgIHZhbHVlOiBTQVhTdHJlYW1cbiAgICB9XG4gIH0pXG5cbiAgU0FYU3RyZWFtLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgaWYgKHR5cGVvZiBCdWZmZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIHR5cGVvZiBCdWZmZXIuaXNCdWZmZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgIEJ1ZmZlci5pc0J1ZmZlcihkYXRhKSkge1xuICAgICAgaWYgKCF0aGlzLl9kZWNvZGVyKSB7XG4gICAgICAgIHZhciBTRCA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyJykuU3RyaW5nRGVjb2RlclxuICAgICAgICB0aGlzLl9kZWNvZGVyID0gbmV3IFNEKCd1dGY4JylcbiAgICAgIH1cbiAgICAgIGRhdGEgPSB0aGlzLl9kZWNvZGVyLndyaXRlKGRhdGEpXG4gICAgfVxuXG4gICAgdGhpcy5fcGFyc2VyLndyaXRlKGRhdGEudG9TdHJpbmcoKSlcbiAgICB0aGlzLmVtaXQoJ2RhdGEnLCBkYXRhKVxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBTQVhTdHJlYW0ucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChjaHVuaykge1xuICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpIHtcbiAgICAgIHRoaXMud3JpdGUoY2h1bmspXG4gICAgfVxuICAgIHRoaXMuX3BhcnNlci5lbmQoKVxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBTQVhTdHJlYW0ucHJvdG90eXBlLm9uID0gZnVuY3Rpb24gKGV2LCBoYW5kbGVyKSB7XG4gICAgdmFyIG1lID0gdGhpc1xuICAgIGlmICghbWUuX3BhcnNlclsnb24nICsgZXZdICYmIHN0cmVhbVdyYXBzLmluZGV4T2YoZXYpICE9PSAtMSkge1xuICAgICAgbWUuX3BhcnNlclsnb24nICsgZXZdID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cy5sZW5ndGggPT09IDEgPyBbYXJndW1lbnRzWzBdXSA6IEFycmF5LmFwcGx5KG51bGwsIGFyZ3VtZW50cylcbiAgICAgICAgYXJncy5zcGxpY2UoMCwgMCwgZXYpXG4gICAgICAgIG1lLmVtaXQuYXBwbHkobWUsIGFyZ3MpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIFN0cmVhbS5wcm90b3R5cGUub24uY2FsbChtZSwgZXYsIGhhbmRsZXIpXG4gIH1cblxuICAvLyB0aGlzIHJlYWxseSBuZWVkcyB0byBiZSByZXBsYWNlZCB3aXRoIGNoYXJhY3RlciBjbGFzc2VzLlxuICAvLyBYTUwgYWxsb3dzIGFsbCBtYW5uZXIgb2YgcmlkaWN1bG91cyBudW1iZXJzIGFuZCBkaWdpdHMuXG4gIHZhciBDREFUQSA9ICdbQ0RBVEFbJ1xuICB2YXIgRE9DVFlQRSA9ICdET0NUWVBFJ1xuICB2YXIgWE1MX05BTUVTUEFDRSA9ICdodHRwOi8vd3d3LnczLm9yZy9YTUwvMTk5OC9uYW1lc3BhY2UnXG4gIHZhciBYTUxOU19OQU1FU1BBQ0UgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC94bWxucy8nXG4gIHZhciByb290TlMgPSB7IHhtbDogWE1MX05BTUVTUEFDRSwgeG1sbnM6IFhNTE5TX05BTUVTUEFDRSB9XG5cbiAgLy8gaHR0cDovL3d3dy53My5vcmcvVFIvUkVDLXhtbC8jTlQtTmFtZVN0YXJ0Q2hhclxuICAvLyBUaGlzIGltcGxlbWVudGF0aW9uIHdvcmtzIG9uIHN0cmluZ3MsIGEgc2luZ2xlIGNoYXJhY3RlciBhdCBhIHRpbWVcbiAgLy8gYXMgc3VjaCwgaXQgY2Fubm90IGV2ZXIgc3VwcG9ydCBhc3RyYWwtcGxhbmUgY2hhcmFjdGVycyAoMTAwMDAtRUZGRkYpXG4gIC8vIHdpdGhvdXQgYSBzaWduaWZpY2FudCBicmVha2luZyBjaGFuZ2UgdG8gZWl0aGVyIHRoaXMgIHBhcnNlciwgb3IgdGhlXG4gIC8vIEphdmFTY3JpcHQgbGFuZ3VhZ2UuICBJbXBsZW1lbnRhdGlvbiBvZiBhbiBlbW9qaS1jYXBhYmxlIHhtbCBwYXJzZXJcbiAgLy8gaXMgbGVmdCBhcyBhbiBleGVyY2lzZSBmb3IgdGhlIHJlYWRlci5cbiAgdmFyIG5hbWVTdGFydCA9IC9bOl9BLVphLXpcXHUwMEMwLVxcdTAwRDZcXHUwMEQ4LVxcdTAwRjZcXHUwMEY4LVxcdTAyRkZcXHUwMzcwLVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDLVxcdTIwMERcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRdL1xuXG4gIHZhciBuYW1lQm9keSA9IC9bOl9BLVphLXpcXHUwMEMwLVxcdTAwRDZcXHUwMEQ4LVxcdTAwRjZcXHUwMEY4LVxcdTAyRkZcXHUwMzcwLVxcdTAzN0RcXHUwMzdGLVxcdTFGRkZcXHUyMDBDLVxcdTIwMERcXHUyMDcwLVxcdTIxOEZcXHUyQzAwLVxcdTJGRUZcXHUzMDAxLVxcdUQ3RkZcXHVGOTAwLVxcdUZEQ0ZcXHVGREYwLVxcdUZGRkRcXHUwMEI3XFx1MDMwMC1cXHUwMzZGXFx1MjAzRi1cXHUyMDQwLlxcZC1dL1xuXG4gIHZhciBlbnRpdHlTdGFydCA9IC9bIzpfQS1aYS16XFx1MDBDMC1cXHUwMEQ2XFx1MDBEOC1cXHUwMEY2XFx1MDBGOC1cXHUwMkZGXFx1MDM3MC1cXHUwMzdEXFx1MDM3Ri1cXHUxRkZGXFx1MjAwQy1cXHUyMDBEXFx1MjA3MC1cXHUyMThGXFx1MkMwMC1cXHUyRkVGXFx1MzAwMS1cXHVEN0ZGXFx1RjkwMC1cXHVGRENGXFx1RkRGMC1cXHVGRkZEXS9cbiAgdmFyIGVudGl0eUJvZHkgPSAvWyM6X0EtWmEtelxcdTAwQzAtXFx1MDBENlxcdTAwRDgtXFx1MDBGNlxcdTAwRjgtXFx1MDJGRlxcdTAzNzAtXFx1MDM3RFxcdTAzN0YtXFx1MUZGRlxcdTIwMEMtXFx1MjAwRFxcdTIwNzAtXFx1MjE4RlxcdTJDMDAtXFx1MkZFRlxcdTMwMDEtXFx1RDdGRlxcdUY5MDAtXFx1RkRDRlxcdUZERjAtXFx1RkZGRFxcdTAwQjdcXHUwMzAwLVxcdTAzNkZcXHUyMDNGLVxcdTIwNDAuXFxkLV0vXG5cbiAgZnVuY3Rpb24gaXNXaGl0ZXNwYWNlIChjKSB7XG4gICAgcmV0dXJuIGMgPT09ICcgJyB8fCBjID09PSAnXFxuJyB8fCBjID09PSAnXFxyJyB8fCBjID09PSAnXFx0J1xuICB9XG5cbiAgZnVuY3Rpb24gaXNRdW90ZSAoYykge1xuICAgIHJldHVybiBjID09PSAnXCInIHx8IGMgPT09ICdcXCcnXG4gIH1cblxuICBmdW5jdGlvbiBpc0F0dHJpYkVuZCAoYykge1xuICAgIHJldHVybiBjID09PSAnPicgfHwgaXNXaGl0ZXNwYWNlKGMpXG4gIH1cblxuICBmdW5jdGlvbiBpc01hdGNoIChyZWdleCwgYykge1xuICAgIHJldHVybiByZWdleC50ZXN0KGMpXG4gIH1cblxuICBmdW5jdGlvbiBub3RNYXRjaCAocmVnZXgsIGMpIHtcbiAgICByZXR1cm4gIWlzTWF0Y2gocmVnZXgsIGMpXG4gIH1cblxuICB2YXIgUyA9IDBcbiAgc2F4LlNUQVRFID0ge1xuICAgIEJFR0lOOiBTKyssIC8vIGxlYWRpbmcgYnl0ZSBvcmRlciBtYXJrIG9yIHdoaXRlc3BhY2VcbiAgICBCRUdJTl9XSElURVNQQUNFOiBTKyssIC8vIGxlYWRpbmcgd2hpdGVzcGFjZVxuICAgIFRFWFQ6IFMrKywgLy8gZ2VuZXJhbCBzdHVmZlxuICAgIFRFWFRfRU5USVRZOiBTKyssIC8vICZhbXAgYW5kIHN1Y2guXG4gICAgT1BFTl9XQUtBOiBTKyssIC8vIDxcbiAgICBTR01MX0RFQ0w6IFMrKywgLy8gPCFCTEFSR1xuICAgIFNHTUxfREVDTF9RVU9URUQ6IFMrKywgLy8gPCFCTEFSRyBmb28gXCJiYXJcbiAgICBET0NUWVBFOiBTKyssIC8vIDwhRE9DVFlQRVxuICAgIERPQ1RZUEVfUVVPVEVEOiBTKyssIC8vIDwhRE9DVFlQRSBcIi8vYmxhaFxuICAgIERPQ1RZUEVfRFREOiBTKyssIC8vIDwhRE9DVFlQRSBcIi8vYmxhaFwiIFsgLi4uXG4gICAgRE9DVFlQRV9EVERfUVVPVEVEOiBTKyssIC8vIDwhRE9DVFlQRSBcIi8vYmxhaFwiIFsgXCJmb29cbiAgICBDT01NRU5UX1NUQVJUSU5HOiBTKyssIC8vIDwhLVxuICAgIENPTU1FTlQ6IFMrKywgLy8gPCEtLVxuICAgIENPTU1FTlRfRU5ESU5HOiBTKyssIC8vIDwhLS0gYmxhaCAtXG4gICAgQ09NTUVOVF9FTkRFRDogUysrLCAvLyA8IS0tIGJsYWggLS1cbiAgICBDREFUQTogUysrLCAvLyA8IVtDREFUQVsgc29tZXRoaW5nXG4gICAgQ0RBVEFfRU5ESU5HOiBTKyssIC8vIF1cbiAgICBDREFUQV9FTkRJTkdfMjogUysrLCAvLyBdXVxuICAgIFBST0NfSU5TVDogUysrLCAvLyA8P2hpXG4gICAgUFJPQ19JTlNUX0JPRFk6IFMrKywgLy8gPD9oaSB0aGVyZVxuICAgIFBST0NfSU5TVF9FTkRJTkc6IFMrKywgLy8gPD9oaSBcInRoZXJlXCIgP1xuICAgIE9QRU5fVEFHOiBTKyssIC8vIDxzdHJvbmdcbiAgICBPUEVOX1RBR19TTEFTSDogUysrLCAvLyA8c3Ryb25nIC9cbiAgICBBVFRSSUI6IFMrKywgLy8gPGFcbiAgICBBVFRSSUJfTkFNRTogUysrLCAvLyA8YSBmb29cbiAgICBBVFRSSUJfTkFNRV9TQVdfV0hJVEU6IFMrKywgLy8gPGEgZm9vIF9cbiAgICBBVFRSSUJfVkFMVUU6IFMrKywgLy8gPGEgZm9vPVxuICAgIEFUVFJJQl9WQUxVRV9RVU9URUQ6IFMrKywgLy8gPGEgZm9vPVwiYmFyXG4gICAgQVRUUklCX1ZBTFVFX0NMT1NFRDogUysrLCAvLyA8YSBmb289XCJiYXJcIlxuICAgIEFUVFJJQl9WQUxVRV9VTlFVT1RFRDogUysrLCAvLyA8YSBmb289YmFyXG4gICAgQVRUUklCX1ZBTFVFX0VOVElUWV9ROiBTKyssIC8vIDxmb28gYmFyPVwiJnF1b3Q7XCJcbiAgICBBVFRSSUJfVkFMVUVfRU5USVRZX1U6IFMrKywgLy8gPGZvbyBiYXI9JnF1b3RcbiAgICBDTE9TRV9UQUc6IFMrKywgLy8gPC9hXG4gICAgQ0xPU0VfVEFHX1NBV19XSElURTogUysrLCAvLyA8L2EgICA+XG4gICAgU0NSSVBUOiBTKyssIC8vIDxzY3JpcHQ+IC4uLlxuICAgIFNDUklQVF9FTkRJTkc6IFMrKyAvLyA8c2NyaXB0PiAuLi4gPFxuICB9XG5cbiAgc2F4LlhNTF9FTlRJVElFUyA9IHtcbiAgICAnYW1wJzogJyYnLFxuICAgICdndCc6ICc+JyxcbiAgICAnbHQnOiAnPCcsXG4gICAgJ3F1b3QnOiAnXCInLFxuICAgICdhcG9zJzogXCInXCJcbiAgfVxuXG4gIHNheC5FTlRJVElFUyA9IHtcbiAgICAnYW1wJzogJyYnLFxuICAgICdndCc6ICc+JyxcbiAgICAnbHQnOiAnPCcsXG4gICAgJ3F1b3QnOiAnXCInLFxuICAgICdhcG9zJzogXCInXCIsXG4gICAgJ0FFbGlnJzogMTk4LFxuICAgICdBYWN1dGUnOiAxOTMsXG4gICAgJ0FjaXJjJzogMTk0LFxuICAgICdBZ3JhdmUnOiAxOTIsXG4gICAgJ0FyaW5nJzogMTk3LFxuICAgICdBdGlsZGUnOiAxOTUsXG4gICAgJ0F1bWwnOiAxOTYsXG4gICAgJ0NjZWRpbCc6IDE5OSxcbiAgICAnRVRIJzogMjA4LFxuICAgICdFYWN1dGUnOiAyMDEsXG4gICAgJ0VjaXJjJzogMjAyLFxuICAgICdFZ3JhdmUnOiAyMDAsXG4gICAgJ0V1bWwnOiAyMDMsXG4gICAgJ0lhY3V0ZSc6IDIwNSxcbiAgICAnSWNpcmMnOiAyMDYsXG4gICAgJ0lncmF2ZSc6IDIwNCxcbiAgICAnSXVtbCc6IDIwNyxcbiAgICAnTnRpbGRlJzogMjA5LFxuICAgICdPYWN1dGUnOiAyMTEsXG4gICAgJ09jaXJjJzogMjEyLFxuICAgICdPZ3JhdmUnOiAyMTAsXG4gICAgJ09zbGFzaCc6IDIxNixcbiAgICAnT3RpbGRlJzogMjEzLFxuICAgICdPdW1sJzogMjE0LFxuICAgICdUSE9STic6IDIyMixcbiAgICAnVWFjdXRlJzogMjE4LFxuICAgICdVY2lyYyc6IDIxOSxcbiAgICAnVWdyYXZlJzogMjE3LFxuICAgICdVdW1sJzogMjIwLFxuICAgICdZYWN1dGUnOiAyMjEsXG4gICAgJ2FhY3V0ZSc6IDIyNSxcbiAgICAnYWNpcmMnOiAyMjYsXG4gICAgJ2FlbGlnJzogMjMwLFxuICAgICdhZ3JhdmUnOiAyMjQsXG4gICAgJ2FyaW5nJzogMjI5LFxuICAgICdhdGlsZGUnOiAyMjcsXG4gICAgJ2F1bWwnOiAyMjgsXG4gICAgJ2NjZWRpbCc6IDIzMSxcbiAgICAnZWFjdXRlJzogMjMzLFxuICAgICdlY2lyYyc6IDIzNCxcbiAgICAnZWdyYXZlJzogMjMyLFxuICAgICdldGgnOiAyNDAsXG4gICAgJ2V1bWwnOiAyMzUsXG4gICAgJ2lhY3V0ZSc6IDIzNyxcbiAgICAnaWNpcmMnOiAyMzgsXG4gICAgJ2lncmF2ZSc6IDIzNixcbiAgICAnaXVtbCc6IDIzOSxcbiAgICAnbnRpbGRlJzogMjQxLFxuICAgICdvYWN1dGUnOiAyNDMsXG4gICAgJ29jaXJjJzogMjQ0LFxuICAgICdvZ3JhdmUnOiAyNDIsXG4gICAgJ29zbGFzaCc6IDI0OCxcbiAgICAnb3RpbGRlJzogMjQ1LFxuICAgICdvdW1sJzogMjQ2LFxuICAgICdzemxpZyc6IDIyMyxcbiAgICAndGhvcm4nOiAyNTQsXG4gICAgJ3VhY3V0ZSc6IDI1MCxcbiAgICAndWNpcmMnOiAyNTEsXG4gICAgJ3VncmF2ZSc6IDI0OSxcbiAgICAndXVtbCc6IDI1MixcbiAgICAneWFjdXRlJzogMjUzLFxuICAgICd5dW1sJzogMjU1LFxuICAgICdjb3B5JzogMTY5LFxuICAgICdyZWcnOiAxNzQsXG4gICAgJ25ic3AnOiAxNjAsXG4gICAgJ2lleGNsJzogMTYxLFxuICAgICdjZW50JzogMTYyLFxuICAgICdwb3VuZCc6IDE2MyxcbiAgICAnY3VycmVuJzogMTY0LFxuICAgICd5ZW4nOiAxNjUsXG4gICAgJ2JydmJhcic6IDE2NixcbiAgICAnc2VjdCc6IDE2NyxcbiAgICAndW1sJzogMTY4LFxuICAgICdvcmRmJzogMTcwLFxuICAgICdsYXF1byc6IDE3MSxcbiAgICAnbm90JzogMTcyLFxuICAgICdzaHknOiAxNzMsXG4gICAgJ21hY3InOiAxNzUsXG4gICAgJ2RlZyc6IDE3NixcbiAgICAncGx1c21uJzogMTc3LFxuICAgICdzdXAxJzogMTg1LFxuICAgICdzdXAyJzogMTc4LFxuICAgICdzdXAzJzogMTc5LFxuICAgICdhY3V0ZSc6IDE4MCxcbiAgICAnbWljcm8nOiAxODEsXG4gICAgJ3BhcmEnOiAxODIsXG4gICAgJ21pZGRvdCc6IDE4MyxcbiAgICAnY2VkaWwnOiAxODQsXG4gICAgJ29yZG0nOiAxODYsXG4gICAgJ3JhcXVvJzogMTg3LFxuICAgICdmcmFjMTQnOiAxODgsXG4gICAgJ2ZyYWMxMic6IDE4OSxcbiAgICAnZnJhYzM0JzogMTkwLFxuICAgICdpcXVlc3QnOiAxOTEsXG4gICAgJ3RpbWVzJzogMjE1LFxuICAgICdkaXZpZGUnOiAyNDcsXG4gICAgJ09FbGlnJzogMzM4LFxuICAgICdvZWxpZyc6IDMzOSxcbiAgICAnU2Nhcm9uJzogMzUyLFxuICAgICdzY2Fyb24nOiAzNTMsXG4gICAgJ1l1bWwnOiAzNzYsXG4gICAgJ2Zub2YnOiA0MDIsXG4gICAgJ2NpcmMnOiA3MTAsXG4gICAgJ3RpbGRlJzogNzMyLFxuICAgICdBbHBoYSc6IDkxMyxcbiAgICAnQmV0YSc6IDkxNCxcbiAgICAnR2FtbWEnOiA5MTUsXG4gICAgJ0RlbHRhJzogOTE2LFxuICAgICdFcHNpbG9uJzogOTE3LFxuICAgICdaZXRhJzogOTE4LFxuICAgICdFdGEnOiA5MTksXG4gICAgJ1RoZXRhJzogOTIwLFxuICAgICdJb3RhJzogOTIxLFxuICAgICdLYXBwYSc6IDkyMixcbiAgICAnTGFtYmRhJzogOTIzLFxuICAgICdNdSc6IDkyNCxcbiAgICAnTnUnOiA5MjUsXG4gICAgJ1hpJzogOTI2LFxuICAgICdPbWljcm9uJzogOTI3LFxuICAgICdQaSc6IDkyOCxcbiAgICAnUmhvJzogOTI5LFxuICAgICdTaWdtYSc6IDkzMSxcbiAgICAnVGF1JzogOTMyLFxuICAgICdVcHNpbG9uJzogOTMzLFxuICAgICdQaGknOiA5MzQsXG4gICAgJ0NoaSc6IDkzNSxcbiAgICAnUHNpJzogOTM2LFxuICAgICdPbWVnYSc6IDkzNyxcbiAgICAnYWxwaGEnOiA5NDUsXG4gICAgJ2JldGEnOiA5NDYsXG4gICAgJ2dhbW1hJzogOTQ3LFxuICAgICdkZWx0YSc6IDk0OCxcbiAgICAnZXBzaWxvbic6IDk0OSxcbiAgICAnemV0YSc6IDk1MCxcbiAgICAnZXRhJzogOTUxLFxuICAgICd0aGV0YSc6IDk1MixcbiAgICAnaW90YSc6IDk1MyxcbiAgICAna2FwcGEnOiA5NTQsXG4gICAgJ2xhbWJkYSc6IDk1NSxcbiAgICAnbXUnOiA5NTYsXG4gICAgJ251JzogOTU3LFxuICAgICd4aSc6IDk1OCxcbiAgICAnb21pY3Jvbic6IDk1OSxcbiAgICAncGknOiA5NjAsXG4gICAgJ3Jobyc6IDk2MSxcbiAgICAnc2lnbWFmJzogOTYyLFxuICAgICdzaWdtYSc6IDk2MyxcbiAgICAndGF1JzogOTY0LFxuICAgICd1cHNpbG9uJzogOTY1LFxuICAgICdwaGknOiA5NjYsXG4gICAgJ2NoaSc6IDk2NyxcbiAgICAncHNpJzogOTY4LFxuICAgICdvbWVnYSc6IDk2OSxcbiAgICAndGhldGFzeW0nOiA5NzcsXG4gICAgJ3Vwc2loJzogOTc4LFxuICAgICdwaXYnOiA5ODIsXG4gICAgJ2Vuc3AnOiA4MTk0LFxuICAgICdlbXNwJzogODE5NSxcbiAgICAndGhpbnNwJzogODIwMSxcbiAgICAnenduaic6IDgyMDQsXG4gICAgJ3p3aic6IDgyMDUsXG4gICAgJ2xybSc6IDgyMDYsXG4gICAgJ3JsbSc6IDgyMDcsXG4gICAgJ25kYXNoJzogODIxMSxcbiAgICAnbWRhc2gnOiA4MjEyLFxuICAgICdsc3F1byc6IDgyMTYsXG4gICAgJ3JzcXVvJzogODIxNyxcbiAgICAnc2JxdW8nOiA4MjE4LFxuICAgICdsZHF1byc6IDgyMjAsXG4gICAgJ3JkcXVvJzogODIyMSxcbiAgICAnYmRxdW8nOiA4MjIyLFxuICAgICdkYWdnZXInOiA4MjI0LFxuICAgICdEYWdnZXInOiA4MjI1LFxuICAgICdidWxsJzogODIyNixcbiAgICAnaGVsbGlwJzogODIzMCxcbiAgICAncGVybWlsJzogODI0MCxcbiAgICAncHJpbWUnOiA4MjQyLFxuICAgICdQcmltZSc6IDgyNDMsXG4gICAgJ2xzYXF1byc6IDgyNDksXG4gICAgJ3JzYXF1byc6IDgyNTAsXG4gICAgJ29saW5lJzogODI1NCxcbiAgICAnZnJhc2wnOiA4MjYwLFxuICAgICdldXJvJzogODM2NCxcbiAgICAnaW1hZ2UnOiA4NDY1LFxuICAgICd3ZWllcnAnOiA4NDcyLFxuICAgICdyZWFsJzogODQ3NixcbiAgICAndHJhZGUnOiA4NDgyLFxuICAgICdhbGVmc3ltJzogODUwMSxcbiAgICAnbGFycic6IDg1OTIsXG4gICAgJ3VhcnInOiA4NTkzLFxuICAgICdyYXJyJzogODU5NCxcbiAgICAnZGFycic6IDg1OTUsXG4gICAgJ2hhcnInOiA4NTk2LFxuICAgICdjcmFycic6IDg2MjksXG4gICAgJ2xBcnInOiA4NjU2LFxuICAgICd1QXJyJzogODY1NyxcbiAgICAnckFycic6IDg2NTgsXG4gICAgJ2RBcnInOiA4NjU5LFxuICAgICdoQXJyJzogODY2MCxcbiAgICAnZm9yYWxsJzogODcwNCxcbiAgICAncGFydCc6IDg3MDYsXG4gICAgJ2V4aXN0JzogODcwNyxcbiAgICAnZW1wdHknOiA4NzA5LFxuICAgICduYWJsYSc6IDg3MTEsXG4gICAgJ2lzaW4nOiA4NzEyLFxuICAgICdub3Rpbic6IDg3MTMsXG4gICAgJ25pJzogODcxNSxcbiAgICAncHJvZCc6IDg3MTksXG4gICAgJ3N1bSc6IDg3MjEsXG4gICAgJ21pbnVzJzogODcyMixcbiAgICAnbG93YXN0JzogODcyNyxcbiAgICAncmFkaWMnOiA4NzMwLFxuICAgICdwcm9wJzogODczMyxcbiAgICAnaW5maW4nOiA4NzM0LFxuICAgICdhbmcnOiA4NzM2LFxuICAgICdhbmQnOiA4NzQzLFxuICAgICdvcic6IDg3NDQsXG4gICAgJ2NhcCc6IDg3NDUsXG4gICAgJ2N1cCc6IDg3NDYsXG4gICAgJ2ludCc6IDg3NDcsXG4gICAgJ3RoZXJlNCc6IDg3NTYsXG4gICAgJ3NpbSc6IDg3NjQsXG4gICAgJ2NvbmcnOiA4NzczLFxuICAgICdhc3ltcCc6IDg3NzYsXG4gICAgJ25lJzogODgwMCxcbiAgICAnZXF1aXYnOiA4ODAxLFxuICAgICdsZSc6IDg4MDQsXG4gICAgJ2dlJzogODgwNSxcbiAgICAnc3ViJzogODgzNCxcbiAgICAnc3VwJzogODgzNSxcbiAgICAnbnN1Yic6IDg4MzYsXG4gICAgJ3N1YmUnOiA4ODM4LFxuICAgICdzdXBlJzogODgzOSxcbiAgICAnb3BsdXMnOiA4ODUzLFxuICAgICdvdGltZXMnOiA4ODU1LFxuICAgICdwZXJwJzogODg2OSxcbiAgICAnc2RvdCc6IDg5MDEsXG4gICAgJ2xjZWlsJzogODk2OCxcbiAgICAncmNlaWwnOiA4OTY5LFxuICAgICdsZmxvb3InOiA4OTcwLFxuICAgICdyZmxvb3InOiA4OTcxLFxuICAgICdsYW5nJzogOTAwMSxcbiAgICAncmFuZyc6IDkwMDIsXG4gICAgJ2xveic6IDk2NzQsXG4gICAgJ3NwYWRlcyc6IDk4MjQsXG4gICAgJ2NsdWJzJzogOTgyNyxcbiAgICAnaGVhcnRzJzogOTgyOSxcbiAgICAnZGlhbXMnOiA5ODMwXG4gIH1cblxuICBPYmplY3Qua2V5cyhzYXguRU5USVRJRVMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciBlID0gc2F4LkVOVElUSUVTW2tleV1cbiAgICB2YXIgcyA9IHR5cGVvZiBlID09PSAnbnVtYmVyJyA/IFN0cmluZy5mcm9tQ2hhckNvZGUoZSkgOiBlXG4gICAgc2F4LkVOVElUSUVTW2tleV0gPSBzXG4gIH0pXG5cbiAgZm9yICh2YXIgcyBpbiBzYXguU1RBVEUpIHtcbiAgICBzYXguU1RBVEVbc2F4LlNUQVRFW3NdXSA9IHNcbiAgfVxuXG4gIC8vIHNob3J0aGFuZFxuICBTID0gc2F4LlNUQVRFXG5cbiAgZnVuY3Rpb24gZW1pdCAocGFyc2VyLCBldmVudCwgZGF0YSkge1xuICAgIHBhcnNlcltldmVudF0gJiYgcGFyc2VyW2V2ZW50XShkYXRhKVxuICB9XG5cbiAgZnVuY3Rpb24gZW1pdE5vZGUgKHBhcnNlciwgbm9kZVR5cGUsIGRhdGEpIHtcbiAgICBpZiAocGFyc2VyLnRleHROb2RlKSBjbG9zZVRleHQocGFyc2VyKVxuICAgIGVtaXQocGFyc2VyLCBub2RlVHlwZSwgZGF0YSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGNsb3NlVGV4dCAocGFyc2VyKSB7XG4gICAgcGFyc2VyLnRleHROb2RlID0gdGV4dG9wdHMocGFyc2VyLm9wdCwgcGFyc2VyLnRleHROb2RlKVxuICAgIGlmIChwYXJzZXIudGV4dE5vZGUpIGVtaXQocGFyc2VyLCAnb250ZXh0JywgcGFyc2VyLnRleHROb2RlKVxuICAgIHBhcnNlci50ZXh0Tm9kZSA9ICcnXG4gIH1cblxuICBmdW5jdGlvbiB0ZXh0b3B0cyAob3B0LCB0ZXh0KSB7XG4gICAgaWYgKG9wdC50cmltKSB0ZXh0ID0gdGV4dC50cmltKClcbiAgICBpZiAob3B0Lm5vcm1hbGl6ZSkgdGV4dCA9IHRleHQucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgcmV0dXJuIHRleHRcbiAgfVxuXG4gIGZ1bmN0aW9uIGVycm9yIChwYXJzZXIsIGVyKSB7XG4gICAgY2xvc2VUZXh0KHBhcnNlcilcbiAgICBpZiAocGFyc2VyLnRyYWNrUG9zaXRpb24pIHtcbiAgICAgIGVyICs9ICdcXG5MaW5lOiAnICsgcGFyc2VyLmxpbmUgK1xuICAgICAgICAnXFxuQ29sdW1uOiAnICsgcGFyc2VyLmNvbHVtbiArXG4gICAgICAgICdcXG5DaGFyOiAnICsgcGFyc2VyLmNcbiAgICB9XG4gICAgZXIgPSBuZXcgRXJyb3IoZXIpXG4gICAgcGFyc2VyLmVycm9yID0gZXJcbiAgICBlbWl0KHBhcnNlciwgJ29uZXJyb3InLCBlcilcbiAgICByZXR1cm4gcGFyc2VyXG4gIH1cblxuICBmdW5jdGlvbiBlbmQgKHBhcnNlcikge1xuICAgIGlmIChwYXJzZXIuc2F3Um9vdCAmJiAhcGFyc2VyLmNsb3NlZFJvb3QpIHN0cmljdEZhaWwocGFyc2VyLCAnVW5jbG9zZWQgcm9vdCB0YWcnKVxuICAgIGlmICgocGFyc2VyLnN0YXRlICE9PSBTLkJFR0lOKSAmJlxuICAgICAgKHBhcnNlci5zdGF0ZSAhPT0gUy5CRUdJTl9XSElURVNQQUNFKSAmJlxuICAgICAgKHBhcnNlci5zdGF0ZSAhPT0gUy5URVhUKSkge1xuICAgICAgZXJyb3IocGFyc2VyLCAnVW5leHBlY3RlZCBlbmQnKVxuICAgIH1cbiAgICBjbG9zZVRleHQocGFyc2VyKVxuICAgIHBhcnNlci5jID0gJydcbiAgICBwYXJzZXIuY2xvc2VkID0gdHJ1ZVxuICAgIGVtaXQocGFyc2VyLCAnb25lbmQnKVxuICAgIFNBWFBhcnNlci5jYWxsKHBhcnNlciwgcGFyc2VyLnN0cmljdCwgcGFyc2VyLm9wdClcbiAgICByZXR1cm4gcGFyc2VyXG4gIH1cblxuICBmdW5jdGlvbiBzdHJpY3RGYWlsIChwYXJzZXIsIG1lc3NhZ2UpIHtcbiAgICBpZiAodHlwZW9mIHBhcnNlciAhPT0gJ29iamVjdCcgfHwgIShwYXJzZXIgaW5zdGFuY2VvZiBTQVhQYXJzZXIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2JhZCBjYWxsIHRvIHN0cmljdEZhaWwnKVxuICAgIH1cbiAgICBpZiAocGFyc2VyLnN0cmljdCkge1xuICAgICAgZXJyb3IocGFyc2VyLCBtZXNzYWdlKVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld1RhZyAocGFyc2VyKSB7XG4gICAgaWYgKCFwYXJzZXIuc3RyaWN0KSBwYXJzZXIudGFnTmFtZSA9IHBhcnNlci50YWdOYW1lW3BhcnNlci5sb29zZUNhc2VdKClcbiAgICB2YXIgcGFyZW50ID0gcGFyc2VyLnRhZ3NbcGFyc2VyLnRhZ3MubGVuZ3RoIC0gMV0gfHwgcGFyc2VyXG4gICAgdmFyIHRhZyA9IHBhcnNlci50YWcgPSB7IG5hbWU6IHBhcnNlci50YWdOYW1lLCBhdHRyaWJ1dGVzOiB7fSB9XG5cbiAgICAvLyB3aWxsIGJlIG92ZXJyaWRkZW4gaWYgdGFnIGNvbnRhaWxzIGFuIHhtbG5zPVwiZm9vXCIgb3IgeG1sbnM6Zm9vPVwiYmFyXCJcbiAgICBpZiAocGFyc2VyLm9wdC54bWxucykge1xuICAgICAgdGFnLm5zID0gcGFyZW50Lm5zXG4gICAgfVxuICAgIHBhcnNlci5hdHRyaWJMaXN0Lmxlbmd0aCA9IDBcbiAgICBlbWl0Tm9kZShwYXJzZXIsICdvbm9wZW50YWdzdGFydCcsIHRhZylcbiAgfVxuXG4gIGZ1bmN0aW9uIHFuYW1lIChuYW1lLCBhdHRyaWJ1dGUpIHtcbiAgICB2YXIgaSA9IG5hbWUuaW5kZXhPZignOicpXG4gICAgdmFyIHF1YWxOYW1lID0gaSA8IDAgPyBbICcnLCBuYW1lIF0gOiBuYW1lLnNwbGl0KCc6JylcbiAgICB2YXIgcHJlZml4ID0gcXVhbE5hbWVbMF1cbiAgICB2YXIgbG9jYWwgPSBxdWFsTmFtZVsxXVxuXG4gICAgLy8gPHggXCJ4bWxuc1wiPVwiaHR0cDovL2Zvb1wiPlxuICAgIGlmIChhdHRyaWJ1dGUgJiYgbmFtZSA9PT0gJ3htbG5zJykge1xuICAgICAgcHJlZml4ID0gJ3htbG5zJ1xuICAgICAgbG9jYWwgPSAnJ1xuICAgIH1cblxuICAgIHJldHVybiB7IHByZWZpeDogcHJlZml4LCBsb2NhbDogbG9jYWwgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXR0cmliIChwYXJzZXIpIHtcbiAgICBpZiAoIXBhcnNlci5zdHJpY3QpIHtcbiAgICAgIHBhcnNlci5hdHRyaWJOYW1lID0gcGFyc2VyLmF0dHJpYk5hbWVbcGFyc2VyLmxvb3NlQ2FzZV0oKVxuICAgIH1cblxuICAgIGlmIChwYXJzZXIuYXR0cmliTGlzdC5pbmRleE9mKHBhcnNlci5hdHRyaWJOYW1lKSAhPT0gLTEgfHxcbiAgICAgIHBhcnNlci50YWcuYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShwYXJzZXIuYXR0cmliTmFtZSkpIHtcbiAgICAgIHBhcnNlci5hdHRyaWJOYW1lID0gcGFyc2VyLmF0dHJpYlZhbHVlID0gJydcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChwYXJzZXIub3B0LnhtbG5zKSB7XG4gICAgICB2YXIgcW4gPSBxbmFtZShwYXJzZXIuYXR0cmliTmFtZSwgdHJ1ZSlcbiAgICAgIHZhciBwcmVmaXggPSBxbi5wcmVmaXhcbiAgICAgIHZhciBsb2NhbCA9IHFuLmxvY2FsXG5cbiAgICAgIGlmIChwcmVmaXggPT09ICd4bWxucycpIHtcbiAgICAgICAgLy8gbmFtZXNwYWNlIGJpbmRpbmcgYXR0cmlidXRlLiBwdXNoIHRoZSBiaW5kaW5nIGludG8gc2NvcGVcbiAgICAgICAgaWYgKGxvY2FsID09PSAneG1sJyAmJiBwYXJzZXIuYXR0cmliVmFsdWUgIT09IFhNTF9OQU1FU1BBQ0UpIHtcbiAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlcixcbiAgICAgICAgICAgICd4bWw6IHByZWZpeCBtdXN0IGJlIGJvdW5kIHRvICcgKyBYTUxfTkFNRVNQQUNFICsgJ1xcbicgK1xuICAgICAgICAgICAgJ0FjdHVhbDogJyArIHBhcnNlci5hdHRyaWJWYWx1ZSlcbiAgICAgICAgfSBlbHNlIGlmIChsb2NhbCA9PT0gJ3htbG5zJyAmJiBwYXJzZXIuYXR0cmliVmFsdWUgIT09IFhNTE5TX05BTUVTUEFDRSkge1xuICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLFxuICAgICAgICAgICAgJ3htbG5zOiBwcmVmaXggbXVzdCBiZSBib3VuZCB0byAnICsgWE1MTlNfTkFNRVNQQUNFICsgJ1xcbicgK1xuICAgICAgICAgICAgJ0FjdHVhbDogJyArIHBhcnNlci5hdHRyaWJWYWx1ZSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgdGFnID0gcGFyc2VyLnRhZ1xuICAgICAgICAgIHZhciBwYXJlbnQgPSBwYXJzZXIudGFnc1twYXJzZXIudGFncy5sZW5ndGggLSAxXSB8fCBwYXJzZXJcbiAgICAgICAgICBpZiAodGFnLm5zID09PSBwYXJlbnQubnMpIHtcbiAgICAgICAgICAgIHRhZy5ucyA9IE9iamVjdC5jcmVhdGUocGFyZW50Lm5zKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0YWcubnNbbG9jYWxdID0gcGFyc2VyLmF0dHJpYlZhbHVlXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gZGVmZXIgb25hdHRyaWJ1dGUgZXZlbnRzIHVudGlsIGFsbCBhdHRyaWJ1dGVzIGhhdmUgYmVlbiBzZWVuXG4gICAgICAvLyBzbyBhbnkgbmV3IGJpbmRpbmdzIGNhbiB0YWtlIGVmZmVjdC4gcHJlc2VydmUgYXR0cmlidXRlIG9yZGVyXG4gICAgICAvLyBzbyBkZWZlcnJlZCBldmVudHMgY2FuIGJlIGVtaXR0ZWQgaW4gZG9jdW1lbnQgb3JkZXJcbiAgICAgIHBhcnNlci5hdHRyaWJMaXN0LnB1c2goW3BhcnNlci5hdHRyaWJOYW1lLCBwYXJzZXIuYXR0cmliVmFsdWVdKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBpbiBub24teG1sbnMgbW9kZSwgd2UgY2FuIGVtaXQgdGhlIGV2ZW50IHJpZ2h0IGF3YXlcbiAgICAgIHBhcnNlci50YWcuYXR0cmlidXRlc1twYXJzZXIuYXR0cmliTmFtZV0gPSBwYXJzZXIuYXR0cmliVmFsdWVcbiAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29uYXR0cmlidXRlJywge1xuICAgICAgICBuYW1lOiBwYXJzZXIuYXR0cmliTmFtZSxcbiAgICAgICAgdmFsdWU6IHBhcnNlci5hdHRyaWJWYWx1ZVxuICAgICAgfSlcbiAgICB9XG5cbiAgICBwYXJzZXIuYXR0cmliTmFtZSA9IHBhcnNlci5hdHRyaWJWYWx1ZSA9ICcnXG4gIH1cblxuICBmdW5jdGlvbiBvcGVuVGFnIChwYXJzZXIsIHNlbGZDbG9zaW5nKSB7XG4gICAgaWYgKHBhcnNlci5vcHQueG1sbnMpIHtcbiAgICAgIC8vIGVtaXQgbmFtZXNwYWNlIGJpbmRpbmcgZXZlbnRzXG4gICAgICB2YXIgdGFnID0gcGFyc2VyLnRhZ1xuXG4gICAgICAvLyBhZGQgbmFtZXNwYWNlIGluZm8gdG8gdGFnXG4gICAgICB2YXIgcW4gPSBxbmFtZShwYXJzZXIudGFnTmFtZSlcbiAgICAgIHRhZy5wcmVmaXggPSBxbi5wcmVmaXhcbiAgICAgIHRhZy5sb2NhbCA9IHFuLmxvY2FsXG4gICAgICB0YWcudXJpID0gdGFnLm5zW3FuLnByZWZpeF0gfHwgJydcblxuICAgICAgaWYgKHRhZy5wcmVmaXggJiYgIXRhZy51cmkpIHtcbiAgICAgICAgc3RyaWN0RmFpbChwYXJzZXIsICdVbmJvdW5kIG5hbWVzcGFjZSBwcmVmaXg6ICcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHBhcnNlci50YWdOYW1lKSlcbiAgICAgICAgdGFnLnVyaSA9IHFuLnByZWZpeFxuICAgICAgfVxuXG4gICAgICB2YXIgcGFyZW50ID0gcGFyc2VyLnRhZ3NbcGFyc2VyLnRhZ3MubGVuZ3RoIC0gMV0gfHwgcGFyc2VyXG4gICAgICBpZiAodGFnLm5zICYmIHBhcmVudC5ucyAhPT0gdGFnLm5zKSB7XG4gICAgICAgIE9iamVjdC5rZXlzKHRhZy5ucykuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29ub3Blbm5hbWVzcGFjZScsIHtcbiAgICAgICAgICAgIHByZWZpeDogcCxcbiAgICAgICAgICAgIHVyaTogdGFnLm5zW3BdXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgLy8gaGFuZGxlIGRlZmVycmVkIG9uYXR0cmlidXRlIGV2ZW50c1xuICAgICAgLy8gTm90ZTogZG8gbm90IGFwcGx5IGRlZmF1bHQgbnMgdG8gYXR0cmlidXRlczpcbiAgICAgIC8vICAgaHR0cDovL3d3dy53My5vcmcvVFIvUkVDLXhtbC1uYW1lcy8jZGVmYXVsdGluZ1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBwYXJzZXIuYXR0cmliTGlzdC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIG52ID0gcGFyc2VyLmF0dHJpYkxpc3RbaV1cbiAgICAgICAgdmFyIG5hbWUgPSBudlswXVxuICAgICAgICB2YXIgdmFsdWUgPSBudlsxXVxuICAgICAgICB2YXIgcXVhbE5hbWUgPSBxbmFtZShuYW1lLCB0cnVlKVxuICAgICAgICB2YXIgcHJlZml4ID0gcXVhbE5hbWUucHJlZml4XG4gICAgICAgIHZhciBsb2NhbCA9IHF1YWxOYW1lLmxvY2FsXG4gICAgICAgIHZhciB1cmkgPSBwcmVmaXggPT09ICcnID8gJycgOiAodGFnLm5zW3ByZWZpeF0gfHwgJycpXG4gICAgICAgIHZhciBhID0ge1xuICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgIHByZWZpeDogcHJlZml4LFxuICAgICAgICAgIGxvY2FsOiBsb2NhbCxcbiAgICAgICAgICB1cmk6IHVyaVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlcmUncyBhbnkgYXR0cmlidXRlcyB3aXRoIGFuIHVuZGVmaW5lZCBuYW1lc3BhY2UsXG4gICAgICAgIC8vIHRoZW4gZmFpbCBvbiB0aGVtIG5vdy5cbiAgICAgICAgaWYgKHByZWZpeCAmJiBwcmVmaXggIT09ICd4bWxucycgJiYgIXVyaSkge1xuICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnVW5ib3VuZCBuYW1lc3BhY2UgcHJlZml4OiAnICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHByZWZpeCkpXG4gICAgICAgICAgYS51cmkgPSBwcmVmaXhcbiAgICAgICAgfVxuICAgICAgICBwYXJzZXIudGFnLmF0dHJpYnV0ZXNbbmFtZV0gPSBhXG4gICAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29uYXR0cmlidXRlJywgYSlcbiAgICAgIH1cbiAgICAgIHBhcnNlci5hdHRyaWJMaXN0Lmxlbmd0aCA9IDBcbiAgICB9XG5cbiAgICBwYXJzZXIudGFnLmlzU2VsZkNsb3NpbmcgPSAhIXNlbGZDbG9zaW5nXG5cbiAgICAvLyBwcm9jZXNzIHRoZSB0YWdcbiAgICBwYXJzZXIuc2F3Um9vdCA9IHRydWVcbiAgICBwYXJzZXIudGFncy5wdXNoKHBhcnNlci50YWcpXG4gICAgZW1pdE5vZGUocGFyc2VyLCAnb25vcGVudGFnJywgcGFyc2VyLnRhZylcbiAgICBpZiAoIXNlbGZDbG9zaW5nKSB7XG4gICAgICAvLyBzcGVjaWFsIGNhc2UgZm9yIDxzY3JpcHQ+IGluIG5vbi1zdHJpY3QgbW9kZS5cbiAgICAgIGlmICghcGFyc2VyLm5vc2NyaXB0ICYmIHBhcnNlci50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzY3JpcHQnKSB7XG4gICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuU0NSSVBUXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlRFWFRcbiAgICAgIH1cbiAgICAgIHBhcnNlci50YWcgPSBudWxsXG4gICAgICBwYXJzZXIudGFnTmFtZSA9ICcnXG4gICAgfVxuICAgIHBhcnNlci5hdHRyaWJOYW1lID0gcGFyc2VyLmF0dHJpYlZhbHVlID0gJydcbiAgICBwYXJzZXIuYXR0cmliTGlzdC5sZW5ndGggPSAwXG4gIH1cblxuICBmdW5jdGlvbiBjbG9zZVRhZyAocGFyc2VyKSB7XG4gICAgaWYgKCFwYXJzZXIudGFnTmFtZSkge1xuICAgICAgc3RyaWN0RmFpbChwYXJzZXIsICdXZWlyZCBlbXB0eSBjbG9zZSB0YWcuJylcbiAgICAgIHBhcnNlci50ZXh0Tm9kZSArPSAnPC8+J1xuICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAocGFyc2VyLnNjcmlwdCkge1xuICAgICAgaWYgKHBhcnNlci50YWdOYW1lICE9PSAnc2NyaXB0Jykge1xuICAgICAgICBwYXJzZXIuc2NyaXB0ICs9ICc8LycgKyBwYXJzZXIudGFnTmFtZSArICc+J1xuICAgICAgICBwYXJzZXIudGFnTmFtZSA9ICcnXG4gICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuU0NSSVBUXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25zY3JpcHQnLCBwYXJzZXIuc2NyaXB0KVxuICAgICAgcGFyc2VyLnNjcmlwdCA9ICcnXG4gICAgfVxuXG4gICAgLy8gZmlyc3QgbWFrZSBzdXJlIHRoYXQgdGhlIGNsb3NpbmcgdGFnIGFjdHVhbGx5IGV4aXN0cy5cbiAgICAvLyA8YT48Yj48L2M+PC9iPjwvYT4gd2lsbCBjbG9zZSBldmVyeXRoaW5nLCBvdGhlcndpc2UuXG4gICAgdmFyIHQgPSBwYXJzZXIudGFncy5sZW5ndGhcbiAgICB2YXIgdGFnTmFtZSA9IHBhcnNlci50YWdOYW1lXG4gICAgaWYgKCFwYXJzZXIuc3RyaWN0KSB7XG4gICAgICB0YWdOYW1lID0gdGFnTmFtZVtwYXJzZXIubG9vc2VDYXNlXSgpXG4gICAgfVxuICAgIHZhciBjbG9zZVRvID0gdGFnTmFtZVxuICAgIHdoaWxlICh0LS0pIHtcbiAgICAgIHZhciBjbG9zZSA9IHBhcnNlci50YWdzW3RdXG4gICAgICBpZiAoY2xvc2UubmFtZSAhPT0gY2xvc2VUbykge1xuICAgICAgICAvLyBmYWlsIHRoZSBmaXJzdCB0aW1lIGluIHN0cmljdCBtb2RlXG4gICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnVW5leHBlY3RlZCBjbG9zZSB0YWcnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBkaWRuJ3QgZmluZCBpdC4gIHdlIGFscmVhZHkgZmFpbGVkIGZvciBzdHJpY3QsIHNvIGp1c3QgYWJvcnQuXG4gICAgaWYgKHQgPCAwKSB7XG4gICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ1VubWF0Y2hlZCBjbG9zaW5nIHRhZzogJyArIHBhcnNlci50YWdOYW1lKVxuICAgICAgcGFyc2VyLnRleHROb2RlICs9ICc8LycgKyBwYXJzZXIudGFnTmFtZSArICc+J1xuICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgcGFyc2VyLnRhZ05hbWUgPSB0YWdOYW1lXG4gICAgdmFyIHMgPSBwYXJzZXIudGFncy5sZW5ndGhcbiAgICB3aGlsZSAocy0tID4gdCkge1xuICAgICAgdmFyIHRhZyA9IHBhcnNlci50YWcgPSBwYXJzZXIudGFncy5wb3AoKVxuICAgICAgcGFyc2VyLnRhZ05hbWUgPSBwYXJzZXIudGFnLm5hbWVcbiAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29uY2xvc2V0YWcnLCBwYXJzZXIudGFnTmFtZSlcblxuICAgICAgdmFyIHggPSB7fVxuICAgICAgZm9yICh2YXIgaSBpbiB0YWcubnMpIHtcbiAgICAgICAgeFtpXSA9IHRhZy5uc1tpXVxuICAgICAgfVxuXG4gICAgICB2YXIgcGFyZW50ID0gcGFyc2VyLnRhZ3NbcGFyc2VyLnRhZ3MubGVuZ3RoIC0gMV0gfHwgcGFyc2VyXG4gICAgICBpZiAocGFyc2VyLm9wdC54bWxucyAmJiB0YWcubnMgIT09IHBhcmVudC5ucykge1xuICAgICAgICAvLyByZW1vdmUgbmFtZXNwYWNlIGJpbmRpbmdzIGludHJvZHVjZWQgYnkgdGFnXG4gICAgICAgIE9iamVjdC5rZXlzKHRhZy5ucykuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICAgIHZhciBuID0gdGFnLm5zW3BdXG4gICAgICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25jbG9zZW5hbWVzcGFjZScsIHsgcHJlZml4OiBwLCB1cmk6IG4gfSlcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHQgPT09IDApIHBhcnNlci5jbG9zZWRSb290ID0gdHJ1ZVxuICAgIHBhcnNlci50YWdOYW1lID0gcGFyc2VyLmF0dHJpYlZhbHVlID0gcGFyc2VyLmF0dHJpYk5hbWUgPSAnJ1xuICAgIHBhcnNlci5hdHRyaWJMaXN0Lmxlbmd0aCA9IDBcbiAgICBwYXJzZXIuc3RhdGUgPSBTLlRFWFRcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlRW50aXR5IChwYXJzZXIpIHtcbiAgICB2YXIgZW50aXR5ID0gcGFyc2VyLmVudGl0eVxuICAgIHZhciBlbnRpdHlMQyA9IGVudGl0eS50b0xvd2VyQ2FzZSgpXG4gICAgdmFyIG51bVxuICAgIHZhciBudW1TdHIgPSAnJ1xuXG4gICAgaWYgKHBhcnNlci5FTlRJVElFU1tlbnRpdHldKSB7XG4gICAgICByZXR1cm4gcGFyc2VyLkVOVElUSUVTW2VudGl0eV1cbiAgICB9XG4gICAgaWYgKHBhcnNlci5FTlRJVElFU1tlbnRpdHlMQ10pIHtcbiAgICAgIHJldHVybiBwYXJzZXIuRU5USVRJRVNbZW50aXR5TENdXG4gICAgfVxuICAgIGVudGl0eSA9IGVudGl0eUxDXG4gICAgaWYgKGVudGl0eS5jaGFyQXQoMCkgPT09ICcjJykge1xuICAgICAgaWYgKGVudGl0eS5jaGFyQXQoMSkgPT09ICd4Jykge1xuICAgICAgICBlbnRpdHkgPSBlbnRpdHkuc2xpY2UoMilcbiAgICAgICAgbnVtID0gcGFyc2VJbnQoZW50aXR5LCAxNilcbiAgICAgICAgbnVtU3RyID0gbnVtLnRvU3RyaW5nKDE2KVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW50aXR5ID0gZW50aXR5LnNsaWNlKDEpXG4gICAgICAgIG51bSA9IHBhcnNlSW50KGVudGl0eSwgMTApXG4gICAgICAgIG51bVN0ciA9IG51bS50b1N0cmluZygxMClcbiAgICAgIH1cbiAgICB9XG4gICAgZW50aXR5ID0gZW50aXR5LnJlcGxhY2UoL14wKy8sICcnKVxuICAgIGlmIChpc05hTihudW0pIHx8IG51bVN0ci50b0xvd2VyQ2FzZSgpICE9PSBlbnRpdHkpIHtcbiAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnSW52YWxpZCBjaGFyYWN0ZXIgZW50aXR5JylcbiAgICAgIHJldHVybiAnJicgKyBwYXJzZXIuZW50aXR5ICsgJzsnXG4gICAgfVxuXG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ29kZVBvaW50KG51bSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGJlZ2luV2hpdGVTcGFjZSAocGFyc2VyLCBjKSB7XG4gICAgaWYgKGMgPT09ICc8Jykge1xuICAgICAgcGFyc2VyLnN0YXRlID0gUy5PUEVOX1dBS0FcbiAgICAgIHBhcnNlci5zdGFydFRhZ1Bvc2l0aW9uID0gcGFyc2VyLnBvc2l0aW9uXG4gICAgfSBlbHNlIGlmICghaXNXaGl0ZXNwYWNlKGMpKSB7XG4gICAgICAvLyBoYXZlIHRvIHByb2Nlc3MgdGhpcyBhcyBhIHRleHQgbm9kZS5cbiAgICAgIC8vIHdlaXJkLCBidXQgaGFwcGVucy5cbiAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnTm9uLXdoaXRlc3BhY2UgYmVmb3JlIGZpcnN0IHRhZy4nKVxuICAgICAgcGFyc2VyLnRleHROb2RlID0gY1xuICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY2hhckF0IChjaHVuaywgaSkge1xuICAgIHZhciByZXN1bHQgPSAnJ1xuICAgIGlmIChpIDwgY2h1bmsubGVuZ3RoKSB7XG4gICAgICByZXN1bHQgPSBjaHVuay5jaGFyQXQoaSlcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKGNodW5rKSB7XG4gICAgdmFyIHBhcnNlciA9IHRoaXNcbiAgICBpZiAodGhpcy5lcnJvcikge1xuICAgICAgdGhyb3cgdGhpcy5lcnJvclxuICAgIH1cbiAgICBpZiAocGFyc2VyLmNsb3NlZCkge1xuICAgICAgcmV0dXJuIGVycm9yKHBhcnNlcixcbiAgICAgICAgJ0Nhbm5vdCB3cml0ZSBhZnRlciBjbG9zZS4gQXNzaWduIGFuIG9ucmVhZHkgaGFuZGxlci4nKVxuICAgIH1cbiAgICBpZiAoY2h1bmsgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBlbmQocGFyc2VyKVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGNodW5rID09PSAnb2JqZWN0Jykge1xuICAgICAgY2h1bmsgPSBjaHVuay50b1N0cmluZygpXG4gICAgfVxuICAgIHZhciBpID0gMFxuICAgIHZhciBjID0gJydcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgYyA9IGNoYXJBdChjaHVuaywgaSsrKVxuICAgICAgcGFyc2VyLmMgPSBjXG5cbiAgICAgIGlmICghYykge1xuICAgICAgICBicmVha1xuICAgICAgfVxuXG4gICAgICBpZiAocGFyc2VyLnRyYWNrUG9zaXRpb24pIHtcbiAgICAgICAgcGFyc2VyLnBvc2l0aW9uKytcbiAgICAgICAgaWYgKGMgPT09ICdcXG4nKSB7XG4gICAgICAgICAgcGFyc2VyLmxpbmUrK1xuICAgICAgICAgIHBhcnNlci5jb2x1bW4gPSAwXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGFyc2VyLmNvbHVtbisrXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgc3dpdGNoIChwYXJzZXIuc3RhdGUpIHtcbiAgICAgICAgY2FzZSBTLkJFR0lOOlxuICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQkVHSU5fV0hJVEVTUEFDRVxuICAgICAgICAgIGlmIChjID09PSAnXFx1RkVGRicpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJlZ2luV2hpdGVTcGFjZShwYXJzZXIsIGMpXG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuQkVHSU5fV0hJVEVTUEFDRTpcbiAgICAgICAgICBiZWdpbldoaXRlU3BhY2UocGFyc2VyLCBjKVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLlRFWFQ6XG4gICAgICAgICAgaWYgKHBhcnNlci5zYXdSb290ICYmICFwYXJzZXIuY2xvc2VkUm9vdCkge1xuICAgICAgICAgICAgdmFyIHN0YXJ0aSA9IGkgLSAxXG4gICAgICAgICAgICB3aGlsZSAoYyAmJiBjICE9PSAnPCcgJiYgYyAhPT0gJyYnKSB7XG4gICAgICAgICAgICAgIGMgPSBjaGFyQXQoY2h1bmssIGkrKylcbiAgICAgICAgICAgICAgaWYgKGMgJiYgcGFyc2VyLnRyYWNrUG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIucG9zaXRpb24rK1xuICAgICAgICAgICAgICAgIGlmIChjID09PSAnXFxuJykge1xuICAgICAgICAgICAgICAgICAgcGFyc2VyLmxpbmUrK1xuICAgICAgICAgICAgICAgICAgcGFyc2VyLmNvbHVtbiA9IDBcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGFyc2VyLmNvbHVtbisrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXJzZXIudGV4dE5vZGUgKz0gY2h1bmsuc3Vic3RyaW5nKHN0YXJ0aSwgaSAtIDEpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjID09PSAnPCcgJiYgIShwYXJzZXIuc2F3Um9vdCAmJiBwYXJzZXIuY2xvc2VkUm9vdCAmJiAhcGFyc2VyLnN0cmljdCkpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuT1BFTl9XQUtBXG4gICAgICAgICAgICBwYXJzZXIuc3RhcnRUYWdQb3NpdGlvbiA9IHBhcnNlci5wb3NpdGlvblxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIWlzV2hpdGVzcGFjZShjKSAmJiAoIXBhcnNlci5zYXdSb290IHx8IHBhcnNlci5jbG9zZWRSb290KSkge1xuICAgICAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ1RleHQgZGF0YSBvdXRzaWRlIG9mIHJvb3Qgbm9kZS4nKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGMgPT09ICcmJykge1xuICAgICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlRFWFRfRU5USVRZXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwYXJzZXIudGV4dE5vZGUgKz0gY1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5TQ1JJUFQ6XG4gICAgICAgICAgLy8gb25seSBub24tc3RyaWN0XG4gICAgICAgICAgaWYgKGMgPT09ICc8Jykge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5TQ1JJUFRfRU5ESU5HXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5zY3JpcHQgKz0gY1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5TQ1JJUFRfRU5ESU5HOlxuICAgICAgICAgIGlmIChjID09PSAnLycpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQ0xPU0VfVEFHXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5zY3JpcHQgKz0gJzwnICsgY1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5TQ1JJUFRcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuT1BFTl9XQUtBOlxuICAgICAgICAgIC8vIGVpdGhlciBhIC8sID8sICEsIG9yIHRleHQgaXMgY29taW5nIG5leHQuXG4gICAgICAgICAgaWYgKGMgPT09ICchJykge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5TR01MX0RFQ0xcbiAgICAgICAgICAgIHBhcnNlci5zZ21sRGVjbCA9ICcnXG4gICAgICAgICAgfSBlbHNlIGlmIChpc1doaXRlc3BhY2UoYykpIHtcbiAgICAgICAgICAgIC8vIHdhaXQgZm9yIGl0Li4uXG4gICAgICAgICAgfSBlbHNlIGlmIChpc01hdGNoKG5hbWVTdGFydCwgYykpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuT1BFTl9UQUdcbiAgICAgICAgICAgIHBhcnNlci50YWdOYW1lID0gY1xuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJy8nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNMT1NFX1RBR1xuICAgICAgICAgICAgcGFyc2VyLnRhZ05hbWUgPSAnJ1xuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJz8nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlBST0NfSU5TVFxuICAgICAgICAgICAgcGFyc2VyLnByb2NJbnN0TmFtZSA9IHBhcnNlci5wcm9jSW5zdEJvZHkgPSAnJ1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ1VuZW5jb2RlZCA8JylcbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIHdhcyBzb21lIHdoaXRlc3BhY2UsIHRoZW4gYWRkIHRoYXQgaW4uXG4gICAgICAgICAgICBpZiAocGFyc2VyLnN0YXJ0VGFnUG9zaXRpb24gKyAxIDwgcGFyc2VyLnBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgIHZhciBwYWQgPSBwYXJzZXIucG9zaXRpb24gLSBwYXJzZXIuc3RhcnRUYWdQb3NpdGlvblxuICAgICAgICAgICAgICBjID0gbmV3IEFycmF5KHBhZCkuam9pbignICcpICsgY1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGFyc2VyLnRleHROb2RlICs9ICc8JyArIGNcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuVEVYVFxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5TR01MX0RFQ0w6XG4gICAgICAgICAgaWYgKChwYXJzZXIuc2dtbERlY2wgKyBjKS50b1VwcGVyQ2FzZSgpID09PSBDREFUQSkge1xuICAgICAgICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25vcGVuY2RhdGEnKVxuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5DREFUQVxuICAgICAgICAgICAgcGFyc2VyLnNnbWxEZWNsID0gJydcbiAgICAgICAgICAgIHBhcnNlci5jZGF0YSA9ICcnXG4gICAgICAgICAgfSBlbHNlIGlmIChwYXJzZXIuc2dtbERlY2wgKyBjID09PSAnLS0nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNPTU1FTlRcbiAgICAgICAgICAgIHBhcnNlci5jb21tZW50ID0gJydcbiAgICAgICAgICAgIHBhcnNlci5zZ21sRGVjbCA9ICcnXG4gICAgICAgICAgfSBlbHNlIGlmICgocGFyc2VyLnNnbWxEZWNsICsgYykudG9VcHBlckNhc2UoKSA9PT0gRE9DVFlQRSkge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5ET0NUWVBFXG4gICAgICAgICAgICBpZiAocGFyc2VyLmRvY3R5cGUgfHwgcGFyc2VyLnNhd1Jvb3QpIHtcbiAgICAgICAgICAgICAgc3RyaWN0RmFpbChwYXJzZXIsXG4gICAgICAgICAgICAgICAgJ0luYXBwcm9wcmlhdGVseSBsb2NhdGVkIGRvY3R5cGUgZGVjbGFyYXRpb24nKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcGFyc2VyLmRvY3R5cGUgPSAnJ1xuICAgICAgICAgICAgcGFyc2VyLnNnbWxEZWNsID0gJydcbiAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICc+Jykge1xuICAgICAgICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25zZ21sZGVjbGFyYXRpb24nLCBwYXJzZXIuc2dtbERlY2wpXG4gICAgICAgICAgICBwYXJzZXIuc2dtbERlY2wgPSAnJ1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICAgICAgfSBlbHNlIGlmIChpc1F1b3RlKGMpKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlNHTUxfREVDTF9RVU9URURcbiAgICAgICAgICAgIHBhcnNlci5zZ21sRGVjbCArPSBjXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5zZ21sRGVjbCArPSBjXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLlNHTUxfREVDTF9RVU9URUQ6XG4gICAgICAgICAgaWYgKGMgPT09IHBhcnNlci5xKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlNHTUxfREVDTFxuICAgICAgICAgICAgcGFyc2VyLnEgPSAnJ1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJzZXIuc2dtbERlY2wgKz0gY1xuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLkRPQ1RZUEU6XG4gICAgICAgICAgaWYgKGMgPT09ICc+Jykge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICAgICAgICBlbWl0Tm9kZShwYXJzZXIsICdvbmRvY3R5cGUnLCBwYXJzZXIuZG9jdHlwZSlcbiAgICAgICAgICAgIHBhcnNlci5kb2N0eXBlID0gdHJ1ZSAvLyBqdXN0IHJlbWVtYmVyIHRoYXQgd2Ugc2F3IGl0LlxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYXJzZXIuZG9jdHlwZSArPSBjXG4gICAgICAgICAgICBpZiAoYyA9PT0gJ1snKSB7XG4gICAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuRE9DVFlQRV9EVERcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNRdW90ZShjKSkge1xuICAgICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkRPQ1RZUEVfUVVPVEVEXG4gICAgICAgICAgICAgIHBhcnNlci5xID0gY1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5ET0NUWVBFX1FVT1RFRDpcbiAgICAgICAgICBwYXJzZXIuZG9jdHlwZSArPSBjXG4gICAgICAgICAgaWYgKGMgPT09IHBhcnNlci5xKSB7XG4gICAgICAgICAgICBwYXJzZXIucSA9ICcnXG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkRPQ1RZUEVcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuRE9DVFlQRV9EVEQ6XG4gICAgICAgICAgcGFyc2VyLmRvY3R5cGUgKz0gY1xuICAgICAgICAgIGlmIChjID09PSAnXScpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuRE9DVFlQRVxuICAgICAgICAgIH0gZWxzZSBpZiAoaXNRdW90ZShjKSkge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5ET0NUWVBFX0RURF9RVU9URURcbiAgICAgICAgICAgIHBhcnNlci5xID0gY1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5ET0NUWVBFX0RURF9RVU9URUQ6XG4gICAgICAgICAgcGFyc2VyLmRvY3R5cGUgKz0gY1xuICAgICAgICAgIGlmIChjID09PSBwYXJzZXIucSkge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5ET0NUWVBFX0RURFxuICAgICAgICAgICAgcGFyc2VyLnEgPSAnJ1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5DT01NRU5UOlxuICAgICAgICAgIGlmIChjID09PSAnLScpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQ09NTUVOVF9FTkRJTkdcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyc2VyLmNvbW1lbnQgKz0gY1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5DT01NRU5UX0VORElORzpcbiAgICAgICAgICBpZiAoYyA9PT0gJy0nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNPTU1FTlRfRU5ERURcbiAgICAgICAgICAgIHBhcnNlci5jb21tZW50ID0gdGV4dG9wdHMocGFyc2VyLm9wdCwgcGFyc2VyLmNvbW1lbnQpXG4gICAgICAgICAgICBpZiAocGFyc2VyLmNvbW1lbnQpIHtcbiAgICAgICAgICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25jb21tZW50JywgcGFyc2VyLmNvbW1lbnQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXJzZXIuY29tbWVudCA9ICcnXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5jb21tZW50ICs9ICctJyArIGNcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQ09NTUVOVFxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5DT01NRU5UX0VOREVEOlxuICAgICAgICAgIGlmIChjICE9PSAnPicpIHtcbiAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnTWFsZm9ybWVkIGNvbW1lbnQnKVxuICAgICAgICAgICAgLy8gYWxsb3cgPCEtLSBibGFoIC0tIGJsb28gLS0+IGluIG5vbi1zdHJpY3QgbW9kZSxcbiAgICAgICAgICAgIC8vIHdoaWNoIGlzIGEgY29tbWVudCBvZiBcIiBibGFoIC0tIGJsb28gXCJcbiAgICAgICAgICAgIHBhcnNlci5jb21tZW50ICs9ICctLScgKyBjXG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNPTU1FTlRcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLkNEQVRBOlxuICAgICAgICAgIGlmIChjID09PSAnXScpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQ0RBVEFfRU5ESU5HXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5jZGF0YSArPSBjXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLkNEQVRBX0VORElORzpcbiAgICAgICAgICBpZiAoYyA9PT0gJ10nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNEQVRBX0VORElOR18yXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5jZGF0YSArPSAnXScgKyBjXG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNEQVRBXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLkNEQVRBX0VORElOR18yOlxuICAgICAgICAgIGlmIChjID09PSAnPicpIHtcbiAgICAgICAgICAgIGlmIChwYXJzZXIuY2RhdGEpIHtcbiAgICAgICAgICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25jZGF0YScsIHBhcnNlci5jZGF0YSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29uY2xvc2VjZGF0YScpXG4gICAgICAgICAgICBwYXJzZXIuY2RhdGEgPSAnJ1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICAgICAgfSBlbHNlIGlmIChjID09PSAnXScpIHtcbiAgICAgICAgICAgIHBhcnNlci5jZGF0YSArPSAnXSdcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGFyc2VyLmNkYXRhICs9ICddXScgKyBjXG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNEQVRBXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLlBST0NfSU5TVDpcbiAgICAgICAgICBpZiAoYyA9PT0gJz8nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlBST0NfSU5TVF9FTkRJTkdcbiAgICAgICAgICB9IGVsc2UgaWYgKGlzV2hpdGVzcGFjZShjKSkge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5QUk9DX0lOU1RfQk9EWVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwYXJzZXIucHJvY0luc3ROYW1lICs9IGNcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuUFJPQ19JTlNUX0JPRFk6XG4gICAgICAgICAgaWYgKCFwYXJzZXIucHJvY0luc3RCb2R5ICYmIGlzV2hpdGVzcGFjZShjKSkge1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICc/Jykge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5QUk9DX0lOU1RfRU5ESU5HXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5wcm9jSW5zdEJvZHkgKz0gY1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5QUk9DX0lOU1RfRU5ESU5HOlxuICAgICAgICAgIGlmIChjID09PSAnPicpIHtcbiAgICAgICAgICAgIGVtaXROb2RlKHBhcnNlciwgJ29ucHJvY2Vzc2luZ2luc3RydWN0aW9uJywge1xuICAgICAgICAgICAgICBuYW1lOiBwYXJzZXIucHJvY0luc3ROYW1lLFxuICAgICAgICAgICAgICBib2R5OiBwYXJzZXIucHJvY0luc3RCb2R5XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgcGFyc2VyLnByb2NJbnN0TmFtZSA9IHBhcnNlci5wcm9jSW5zdEJvZHkgPSAnJ1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5URVhUXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5wcm9jSW5zdEJvZHkgKz0gJz8nICsgY1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5QUk9DX0lOU1RfQk9EWVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5PUEVOX1RBRzpcbiAgICAgICAgICBpZiAoaXNNYXRjaChuYW1lQm9keSwgYykpIHtcbiAgICAgICAgICAgIHBhcnNlci50YWdOYW1lICs9IGNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3VGFnKHBhcnNlcilcbiAgICAgICAgICAgIGlmIChjID09PSAnPicpIHtcbiAgICAgICAgICAgICAgb3BlblRhZyhwYXJzZXIpXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICcvJykge1xuICAgICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLk9QRU5fVEFHX1NMQVNIXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAoIWlzV2hpdGVzcGFjZShjKSkge1xuICAgICAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnSW52YWxpZCBjaGFyYWN0ZXIgaW4gdGFnIG5hbWUnKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLk9QRU5fVEFHX1NMQVNIOlxuICAgICAgICAgIGlmIChjID09PSAnPicpIHtcbiAgICAgICAgICAgIG9wZW5UYWcocGFyc2VyLCB0cnVlKVxuICAgICAgICAgICAgY2xvc2VUYWcocGFyc2VyKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ0ZvcndhcmQtc2xhc2ggaW4gb3BlbmluZyB0YWcgbm90IGZvbGxvd2VkIGJ5ID4nKVxuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5BVFRSSUJcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuQVRUUklCOlxuICAgICAgICAgIC8vIGhhdmVuJ3QgcmVhZCB0aGUgYXR0cmlidXRlIG5hbWUgeWV0LlxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoYykpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfSBlbHNlIGlmIChjID09PSAnPicpIHtcbiAgICAgICAgICAgIG9wZW5UYWcocGFyc2VyKVxuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJy8nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLk9QRU5fVEFHX1NMQVNIXG4gICAgICAgICAgfSBlbHNlIGlmIChpc01hdGNoKG5hbWVTdGFydCwgYykpIHtcbiAgICAgICAgICAgIHBhcnNlci5hdHRyaWJOYW1lID0gY1xuICAgICAgICAgICAgcGFyc2VyLmF0dHJpYlZhbHVlID0gJydcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCX05BTUVcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RyaWN0RmFpbChwYXJzZXIsICdJbnZhbGlkIGF0dHJpYnV0ZSBuYW1lJylcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuQVRUUklCX05BTUU6XG4gICAgICAgICAgaWYgKGMgPT09ICc9Jykge1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5BVFRSSUJfVkFMVUVcbiAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICc+Jykge1xuICAgICAgICAgICAgc3RyaWN0RmFpbChwYXJzZXIsICdBdHRyaWJ1dGUgd2l0aG91dCB2YWx1ZScpXG4gICAgICAgICAgICBwYXJzZXIuYXR0cmliVmFsdWUgPSBwYXJzZXIuYXR0cmliTmFtZVxuICAgICAgICAgICAgYXR0cmliKHBhcnNlcilcbiAgICAgICAgICAgIG9wZW5UYWcocGFyc2VyKVxuICAgICAgICAgIH0gZWxzZSBpZiAoaXNXaGl0ZXNwYWNlKGMpKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkFUVFJJQl9OQU1FX1NBV19XSElURVxuICAgICAgICAgIH0gZWxzZSBpZiAoaXNNYXRjaChuYW1lQm9keSwgYykpIHtcbiAgICAgICAgICAgIHBhcnNlci5hdHRyaWJOYW1lICs9IGNcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RyaWN0RmFpbChwYXJzZXIsICdJbnZhbGlkIGF0dHJpYnV0ZSBuYW1lJylcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuQVRUUklCX05BTUVfU0FXX1dISVRFOlxuICAgICAgICAgIGlmIChjID09PSAnPScpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCX1ZBTFVFXG4gICAgICAgICAgfSBlbHNlIGlmIChpc1doaXRlc3BhY2UoYykpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnQXR0cmlidXRlIHdpdGhvdXQgdmFsdWUnKVxuICAgICAgICAgICAgcGFyc2VyLnRhZy5hdHRyaWJ1dGVzW3BhcnNlci5hdHRyaWJOYW1lXSA9ICcnXG4gICAgICAgICAgICBwYXJzZXIuYXR0cmliVmFsdWUgPSAnJ1xuICAgICAgICAgICAgZW1pdE5vZGUocGFyc2VyLCAnb25hdHRyaWJ1dGUnLCB7XG4gICAgICAgICAgICAgIG5hbWU6IHBhcnNlci5hdHRyaWJOYW1lLFxuICAgICAgICAgICAgICB2YWx1ZTogJydcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBwYXJzZXIuYXR0cmliTmFtZSA9ICcnXG4gICAgICAgICAgICBpZiAoYyA9PT0gJz4nKSB7XG4gICAgICAgICAgICAgIG9wZW5UYWcocGFyc2VyKVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc01hdGNoKG5hbWVTdGFydCwgYykpIHtcbiAgICAgICAgICAgICAgcGFyc2VyLmF0dHJpYk5hbWUgPSBjXG4gICAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCX05BTUVcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnSW52YWxpZCBhdHRyaWJ1dGUgbmFtZScpXG4gICAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLkFUVFJJQl9WQUxVRTpcbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGMpKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH0gZWxzZSBpZiAoaXNRdW90ZShjKSkge1xuICAgICAgICAgICAgcGFyc2VyLnEgPSBjXG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkFUVFJJQl9WQUxVRV9RVU9URURcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RyaWN0RmFpbChwYXJzZXIsICdVbnF1b3RlZCBhdHRyaWJ1dGUgdmFsdWUnKVxuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5BVFRSSUJfVkFMVUVfVU5RVU9URURcbiAgICAgICAgICAgIHBhcnNlci5hdHRyaWJWYWx1ZSA9IGNcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuQVRUUklCX1ZBTFVFX1FVT1RFRDpcbiAgICAgICAgICBpZiAoYyAhPT0gcGFyc2VyLnEpIHtcbiAgICAgICAgICAgIGlmIChjID09PSAnJicpIHtcbiAgICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5BVFRSSUJfVkFMVUVfRU5USVRZX1FcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBhcnNlci5hdHRyaWJWYWx1ZSArPSBjXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBhdHRyaWIocGFyc2VyKVxuICAgICAgICAgIHBhcnNlci5xID0gJydcbiAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkFUVFJJQl9WQUxVRV9DTE9TRURcbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5BVFRSSUJfVkFMVUVfQ0xPU0VEOlxuICAgICAgICAgIGlmIChpc1doaXRlc3BhY2UoYykpIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCXG4gICAgICAgICAgfSBlbHNlIGlmIChjID09PSAnPicpIHtcbiAgICAgICAgICAgIG9wZW5UYWcocGFyc2VyKVxuICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gJy8nKSB7XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLk9QRU5fVEFHX1NMQVNIXG4gICAgICAgICAgfSBlbHNlIGlmIChpc01hdGNoKG5hbWVTdGFydCwgYykpIHtcbiAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnTm8gd2hpdGVzcGFjZSBiZXR3ZWVuIGF0dHJpYnV0ZXMnKVxuICAgICAgICAgICAgcGFyc2VyLmF0dHJpYk5hbWUgPSBjXG4gICAgICAgICAgICBwYXJzZXIuYXR0cmliVmFsdWUgPSAnJ1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5BVFRSSUJfTkFNRVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ0ludmFsaWQgYXR0cmlidXRlIG5hbWUnKVxuICAgICAgICAgIH1cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGNhc2UgUy5BVFRSSUJfVkFMVUVfVU5RVU9URUQ6XG4gICAgICAgICAgaWYgKCFpc0F0dHJpYkVuZChjKSkge1xuICAgICAgICAgICAgaWYgKGMgPT09ICcmJykge1xuICAgICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkFUVFJJQl9WQUxVRV9FTlRJVFlfVVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGFyc2VyLmF0dHJpYlZhbHVlICs9IGNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIGF0dHJpYihwYXJzZXIpXG4gICAgICAgICAgaWYgKGMgPT09ICc+Jykge1xuICAgICAgICAgICAgb3BlblRhZyhwYXJzZXIpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IFMuQVRUUklCXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnRpbnVlXG5cbiAgICAgICAgY2FzZSBTLkNMT1NFX1RBRzpcbiAgICAgICAgICBpZiAoIXBhcnNlci50YWdOYW1lKSB7XG4gICAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGMpKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICB9IGVsc2UgaWYgKG5vdE1hdGNoKG5hbWVTdGFydCwgYykpIHtcbiAgICAgICAgICAgICAgaWYgKHBhcnNlci5zY3JpcHQpIHtcbiAgICAgICAgICAgICAgICBwYXJzZXIuc2NyaXB0ICs9ICc8LycgKyBjXG4gICAgICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gUy5TQ1JJUFRcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ0ludmFsaWQgdGFnbmFtZSBpbiBjbG9zaW5nIHRhZy4nKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwYXJzZXIudGFnTmFtZSA9IGNcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGMgPT09ICc+Jykge1xuICAgICAgICAgICAgY2xvc2VUYWcocGFyc2VyKVxuICAgICAgICAgIH0gZWxzZSBpZiAoaXNNYXRjaChuYW1lQm9keSwgYykpIHtcbiAgICAgICAgICAgIHBhcnNlci50YWdOYW1lICs9IGNcbiAgICAgICAgICB9IGVsc2UgaWYgKHBhcnNlci5zY3JpcHQpIHtcbiAgICAgICAgICAgIHBhcnNlci5zY3JpcHQgKz0gJzwvJyArIHBhcnNlci50YWdOYW1lXG4gICAgICAgICAgICBwYXJzZXIudGFnTmFtZSA9ICcnXG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLlNDUklQVFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIWlzV2hpdGVzcGFjZShjKSkge1xuICAgICAgICAgICAgICBzdHJpY3RGYWlsKHBhcnNlciwgJ0ludmFsaWQgdGFnbmFtZSBpbiBjbG9zaW5nIHRhZycpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXJzZXIuc3RhdGUgPSBTLkNMT1NFX1RBR19TQVdfV0hJVEVcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuQ0xPU0VfVEFHX1NBV19XSElURTpcbiAgICAgICAgICBpZiAoaXNXaGl0ZXNwYWNlKGMpKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYyA9PT0gJz4nKSB7XG4gICAgICAgICAgICBjbG9zZVRhZyhwYXJzZXIpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnSW52YWxpZCBjaGFyYWN0ZXJzIGluIGNsb3NpbmcgdGFnJylcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWVcblxuICAgICAgICBjYXNlIFMuVEVYVF9FTlRJVFk6XG4gICAgICAgIGNhc2UgUy5BVFRSSUJfVkFMVUVfRU5USVRZX1E6XG4gICAgICAgIGNhc2UgUy5BVFRSSUJfVkFMVUVfRU5USVRZX1U6XG4gICAgICAgICAgdmFyIHJldHVyblN0YXRlXG4gICAgICAgICAgdmFyIGJ1ZmZlclxuICAgICAgICAgIHN3aXRjaCAocGFyc2VyLnN0YXRlKSB7XG4gICAgICAgICAgICBjYXNlIFMuVEVYVF9FTlRJVFk6XG4gICAgICAgICAgICAgIHJldHVyblN0YXRlID0gUy5URVhUXG4gICAgICAgICAgICAgIGJ1ZmZlciA9ICd0ZXh0Tm9kZSdcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgY2FzZSBTLkFUVFJJQl9WQUxVRV9FTlRJVFlfUTpcbiAgICAgICAgICAgICAgcmV0dXJuU3RhdGUgPSBTLkFUVFJJQl9WQUxVRV9RVU9URURcbiAgICAgICAgICAgICAgYnVmZmVyID0gJ2F0dHJpYlZhbHVlJ1xuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICBjYXNlIFMuQVRUUklCX1ZBTFVFX0VOVElUWV9VOlxuICAgICAgICAgICAgICByZXR1cm5TdGF0ZSA9IFMuQVRUUklCX1ZBTFVFX1VOUVVPVEVEXG4gICAgICAgICAgICAgIGJ1ZmZlciA9ICdhdHRyaWJWYWx1ZSdcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYyA9PT0gJzsnKSB7XG4gICAgICAgICAgICBwYXJzZXJbYnVmZmVyXSArPSBwYXJzZUVudGl0eShwYXJzZXIpXG4gICAgICAgICAgICBwYXJzZXIuZW50aXR5ID0gJydcbiAgICAgICAgICAgIHBhcnNlci5zdGF0ZSA9IHJldHVyblN0YXRlXG4gICAgICAgICAgfSBlbHNlIGlmIChpc01hdGNoKHBhcnNlci5lbnRpdHkubGVuZ3RoID8gZW50aXR5Qm9keSA6IGVudGl0eVN0YXJ0LCBjKSkge1xuICAgICAgICAgICAgcGFyc2VyLmVudGl0eSArPSBjXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0cmljdEZhaWwocGFyc2VyLCAnSW52YWxpZCBjaGFyYWN0ZXIgaW4gZW50aXR5IG5hbWUnKVxuICAgICAgICAgICAgcGFyc2VyW2J1ZmZlcl0gKz0gJyYnICsgcGFyc2VyLmVudGl0eSArIGNcbiAgICAgICAgICAgIHBhcnNlci5lbnRpdHkgPSAnJ1xuICAgICAgICAgICAgcGFyc2VyLnN0YXRlID0gcmV0dXJuU3RhdGVcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb250aW51ZVxuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHBhcnNlciwgJ1Vua25vd24gc3RhdGU6ICcgKyBwYXJzZXIuc3RhdGUpXG4gICAgICB9XG4gICAgfSAvLyB3aGlsZVxuXG4gICAgaWYgKHBhcnNlci5wb3NpdGlvbiA+PSBwYXJzZXIuYnVmZmVyQ2hlY2tQb3NpdGlvbikge1xuICAgICAgY2hlY2tCdWZmZXJMZW5ndGgocGFyc2VyKVxuICAgIH1cbiAgICByZXR1cm4gcGFyc2VyXG4gIH1cblxuICAvKiEgaHR0cDovL210aHMuYmUvZnJvbWNvZGVwb2ludCB2MC4xLjAgYnkgQG1hdGhpYXMgKi9cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgaWYgKCFTdHJpbmcuZnJvbUNvZGVQb2ludCkge1xuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgc3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZVxuICAgICAgdmFyIGZsb29yID0gTWF0aC5mbG9vclxuICAgICAgdmFyIGZyb21Db2RlUG9pbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBNQVhfU0laRSA9IDB4NDAwMFxuICAgICAgICB2YXIgY29kZVVuaXRzID0gW11cbiAgICAgICAgdmFyIGhpZ2hTdXJyb2dhdGVcbiAgICAgICAgdmFyIGxvd1N1cnJvZ2F0ZVxuICAgICAgICB2YXIgaW5kZXggPSAtMVxuICAgICAgICB2YXIgbGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aFxuICAgICAgICBpZiAoIWxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiAnJ1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHQgPSAnJ1xuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xuICAgICAgICAgIHZhciBjb2RlUG9pbnQgPSBOdW1iZXIoYXJndW1lbnRzW2luZGV4XSlcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAhaXNGaW5pdGUoY29kZVBvaW50KSB8fCAvLyBgTmFOYCwgYCtJbmZpbml0eWAsIG9yIGAtSW5maW5pdHlgXG4gICAgICAgICAgICBjb2RlUG9pbnQgPCAwIHx8IC8vIG5vdCBhIHZhbGlkIFVuaWNvZGUgY29kZSBwb2ludFxuICAgICAgICAgICAgY29kZVBvaW50ID4gMHgxMEZGRkYgfHwgLy8gbm90IGEgdmFsaWQgVW5pY29kZSBjb2RlIHBvaW50XG4gICAgICAgICAgICBmbG9vcihjb2RlUG9pbnQpICE9PSBjb2RlUG9pbnQgLy8gbm90IGFuIGludGVnZXJcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHRocm93IFJhbmdlRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludDogJyArIGNvZGVQb2ludClcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvZGVQb2ludCA8PSAweEZGRkYpIHsgLy8gQk1QIGNvZGUgcG9pbnRcbiAgICAgICAgICAgIGNvZGVVbml0cy5wdXNoKGNvZGVQb2ludClcbiAgICAgICAgICB9IGVsc2UgeyAvLyBBc3RyYWwgY29kZSBwb2ludDsgc3BsaXQgaW4gc3Vycm9nYXRlIGhhbHZlc1xuICAgICAgICAgICAgLy8gaHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZyNzdXJyb2dhdGUtZm9ybXVsYWVcbiAgICAgICAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICAgICAgICBoaWdoU3Vycm9nYXRlID0gKGNvZGVQb2ludCA+PiAxMCkgKyAweEQ4MDBcbiAgICAgICAgICAgIGxvd1N1cnJvZ2F0ZSA9IChjb2RlUG9pbnQgJSAweDQwMCkgKyAweERDMDBcbiAgICAgICAgICAgIGNvZGVVbml0cy5wdXNoKGhpZ2hTdXJyb2dhdGUsIGxvd1N1cnJvZ2F0ZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGluZGV4ICsgMSA9PT0gbGVuZ3RoIHx8IGNvZGVVbml0cy5sZW5ndGggPiBNQVhfU0laRSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZS5hcHBseShudWxsLCBjb2RlVW5pdHMpXG4gICAgICAgICAgICBjb2RlVW5pdHMubGVuZ3RoID0gMFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RyaW5nLCAnZnJvbUNvZGVQb2ludCcsIHtcbiAgICAgICAgICB2YWx1ZTogZnJvbUNvZGVQb2ludCxcbiAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgd3JpdGFibGU6IHRydWVcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIFN0cmluZy5mcm9tQ29kZVBvaW50ID0gZnJvbUNvZGVQb2ludFxuICAgICAgfVxuICAgIH0oKSlcbiAgfVxufSkodHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gd2luZG93LnNheCA9IHt9IDogZXhwb3J0cylcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuXG4gIGNvcHlPcHRpb25zOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBrZXksIGNvcHkgPSB7fTtcbiAgICBmb3IgKGtleSBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIGNvcHlba2V5XSA9IG9wdGlvbnNba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvcHk7XG4gIH0sXG5cbiAgZW5zdXJlRmxhZ0V4aXN0czogZnVuY3Rpb24gKGl0ZW0sIG9wdGlvbnMpIHtcbiAgICBpZiAoIShpdGVtIGluIG9wdGlvbnMpIHx8IHR5cGVvZiBvcHRpb25zW2l0ZW1dICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIG9wdGlvbnNbaXRlbV0gPSBmYWxzZTtcbiAgICB9XG4gIH0sXG5cbiAgZW5zdXJlU3BhY2VzRXhpc3RzOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIGlmICghKCdzcGFjZXMnIGluIG9wdGlvbnMpIHx8ICh0eXBlb2Ygb3B0aW9ucy5zcGFjZXMgIT09ICdudW1iZXInICYmIHR5cGVvZiBvcHRpb25zLnNwYWNlcyAhPT0gJ3N0cmluZycpKSB7XG4gICAgICBvcHRpb25zLnNwYWNlcyA9IDA7XG4gICAgfVxuICB9LFxuXG4gIGVuc3VyZUtleUV4aXN0czogZnVuY3Rpb24gKGtleSwgb3B0aW9ucykge1xuICAgIGlmICghKGtleSArICdLZXknIGluIG9wdGlvbnMpIHx8IHR5cGVvZiBvcHRpb25zW2tleSArICdLZXknXSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdGlvbnNba2V5ICsgJ0tleSddID0gb3B0aW9ucy5jb21wYWN0ID8gJ18nICsga2V5IDoga2V5O1xuICAgIH1cbiAgfSxcblxuICBjaGVja0ZuRXhpc3RzOiBmdW5jdGlvbiAoa2V5LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGtleSArICdGbicgaW4gb3B0aW9ucztcbiAgfVxuXG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcblxyXG4gIGlzQXJyYXk6IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheSkge1xyXG4gICAgICByZXR1cm4gQXJyYXkuaXNBcnJheSh2YWx1ZSk7XHJcbiAgICB9XHJcbiAgICAvLyBmYWxsYmFjayBmb3Igb2xkZXIgYnJvd3NlcnMgbGlrZSAgSUUgOFxyXG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCggdmFsdWUgKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcclxuICB9XHJcblxyXG59O1xyXG4iLCJ2YXIgc2F4ID0gcmVxdWlyZSgnc2F4Jyk7XHJcbnZhciBleHBhdCAvKj0gcmVxdWlyZSgnbm9kZS1leHBhdCcpOyovID0geyBvbjogZnVuY3Rpb24gKCkgeyB9LCBwYXJzZTogZnVuY3Rpb24gKCkgeyB9IH07XHJcbnZhciBoZWxwZXIgPSByZXF1aXJlKCcuL29wdGlvbnMtaGVscGVyJyk7XHJcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnLi9hcnJheS1oZWxwZXInKS5pc0FycmF5O1xyXG5cclxudmFyIG9wdGlvbnM7XHJcbnZhciBwdXJlSnNQYXJzZXIgPSB0cnVlO1xyXG52YXIgY3VycmVudEVsZW1lbnQ7XHJcblxyXG5mdW5jdGlvbiB2YWxpZGF0ZU9wdGlvbnModXNlck9wdGlvbnMpIHtcclxuICBvcHRpb25zID0gaGVscGVyLmNvcHlPcHRpb25zKHVzZXJPcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaWdub3JlRGVjbGFyYXRpb24nLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaWdub3JlSW5zdHJ1Y3Rpb24nLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaWdub3JlQXR0cmlidXRlcycsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpZ25vcmVUZXh0Jywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2lnbm9yZUNvbW1lbnQnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaWdub3JlQ2RhdGEnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaWdub3JlRG9jdHlwZScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdjb21wYWN0Jywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2Fsd2F5c0FycmF5Jywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2Fsd2F5c0NoaWxkcmVuJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2FkZFBhcmVudCcsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCd0cmltJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ25hdGl2ZVR5cGUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnc2FuaXRpemUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaW5zdHJ1Y3Rpb25IYXNBdHRyaWJ1dGVzJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2NhcHR1cmVTcGFjZXNCZXR3ZWVuRWxlbWVudHMnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCdkZWNsYXJhdGlvbicsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ2luc3RydWN0aW9uJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygnYXR0cmlidXRlcycsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ3RleHQnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCdjb21tZW50Jywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygnY2RhdGEnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCdkb2N0eXBlJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygndHlwZScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ25hbWUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCdlbGVtZW50cycsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ3BhcmVudCcsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdkb2N0eXBlJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmNoZWNrRm5FeGlzdHMoJ2luc3RydWN0aW9uJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmNoZWNrRm5FeGlzdHMoJ2NkYXRhJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmNoZWNrRm5FeGlzdHMoJ2NvbW1lbnQnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygndGV4dCcsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdpbnN0cnVjdGlvbk5hbWUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygnZWxlbWVudE5hbWUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygnYXR0cmlidXRlTmFtZScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdhdHRyaWJ1dGVWYWx1ZScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdhdHRyaWJ1dGVzJywgb3B0aW9ucyk7XHJcbiAgcmV0dXJuIG9wdGlvbnM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5hdGl2ZVR5cGUodmFsdWUpIHtcclxuICB2YXIgblZhbHVlID0gTnVtYmVyKHZhbHVlKTtcclxuICBpZiAoIWlzTmFOKG5WYWx1ZSkpIHtcclxuICAgIHJldHVybiBuVmFsdWU7XHJcbiAgfVxyXG4gIHZhciBiVmFsdWUgPSB2YWx1ZS50b0xvd2VyQ2FzZSgpO1xyXG4gIGlmIChiVmFsdWUgPT09ICd0cnVlJykge1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfSBlbHNlIGlmIChiVmFsdWUgPT09ICdmYWxzZScpIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcbiAgcmV0dXJuIHZhbHVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRGaWVsZCh0eXBlLCB2YWx1ZSkge1xyXG4gIHZhciBrZXk7XHJcbiAgaWYgKG9wdGlvbnMuY29tcGFjdCkge1xyXG4gICAgaWYgKCFjdXJyZW50RWxlbWVudFtvcHRpb25zW3R5cGUgKyAnS2V5J11dICYmIG9wdGlvbnMuYWx3YXlzQXJyYXkpIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbb3B0aW9uc1t0eXBlICsgJ0tleSddXSA9IFtdO1xyXG4gICAgfVxyXG4gICAgaWYgKGN1cnJlbnRFbGVtZW50W29wdGlvbnNbdHlwZSArICdLZXknXV0gJiYgIWlzQXJyYXkoY3VycmVudEVsZW1lbnRbb3B0aW9uc1t0eXBlICsgJ0tleSddXSkpIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbb3B0aW9uc1t0eXBlICsgJ0tleSddXSA9IFtjdXJyZW50RWxlbWVudFtvcHRpb25zW3R5cGUgKyAnS2V5J11dXTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlICsgJ0ZuJyBpbiBvcHRpb25zICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgdmFsdWUgPSBvcHRpb25zW3R5cGUgKyAnRm4nXSh2YWx1ZSwgY3VycmVudEVsZW1lbnQpO1xyXG4gICAgfVxyXG4gICAgaWYgKHR5cGUgPT09ICdpbnN0cnVjdGlvbicgJiYgKCdpbnN0cnVjdGlvbkZuJyBpbiBvcHRpb25zIHx8ICdpbnN0cnVjdGlvbk5hbWVGbicgaW4gb3B0aW9ucykpIHtcclxuICAgICAgZm9yIChrZXkgaW4gdmFsdWUpIHtcclxuICAgICAgICBpZiAodmFsdWUuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG4gICAgICAgICAgaWYgKCdpbnN0cnVjdGlvbkZuJyBpbiBvcHRpb25zKSB7XHJcbiAgICAgICAgICAgIHZhbHVlW2tleV0gPSBvcHRpb25zLmluc3RydWN0aW9uRm4odmFsdWVba2V5XSwga2V5LCBjdXJyZW50RWxlbWVudCk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB2YXIgdGVtcCA9IHZhbHVlW2tleV07XHJcbiAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZVtrZXldO1xyXG4gICAgICAgICAgICB2YWx1ZVtvcHRpb25zLmluc3RydWN0aW9uTmFtZUZuKGtleSwgdGVtcCwgY3VycmVudEVsZW1lbnQpXSA9IHRlbXA7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAoaXNBcnJheShjdXJyZW50RWxlbWVudFtvcHRpb25zW3R5cGUgKyAnS2V5J11dKSkge1xyXG4gICAgICBjdXJyZW50RWxlbWVudFtvcHRpb25zW3R5cGUgKyAnS2V5J11dLnB1c2godmFsdWUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbb3B0aW9uc1t0eXBlICsgJ0tleSddXSA9IHZhbHVlO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICBpZiAoIWN1cnJlbnRFbGVtZW50W29wdGlvbnMuZWxlbWVudHNLZXldKSB7XHJcbiAgICAgIGN1cnJlbnRFbGVtZW50W29wdGlvbnMuZWxlbWVudHNLZXldID0gW107XHJcbiAgICB9XHJcbiAgICB2YXIgZWxlbWVudCA9IHt9O1xyXG4gICAgZWxlbWVudFtvcHRpb25zLnR5cGVLZXldID0gdHlwZTtcclxuICAgIGlmICh0eXBlID09PSAnaW5zdHJ1Y3Rpb24nKSB7XHJcbiAgICAgIGZvciAoa2V5IGluIHZhbHVlKSB7XHJcbiAgICAgICAgaWYgKHZhbHVlLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBlbGVtZW50W29wdGlvbnMubmFtZUtleV0gPSAnaW5zdHJ1Y3Rpb25OYW1lRm4nIGluIG9wdGlvbnMgPyBvcHRpb25zLmluc3RydWN0aW9uTmFtZUZuKGtleSwgdmFsdWUsIGN1cnJlbnRFbGVtZW50KSA6IGtleTtcclxuICAgICAgaWYgKG9wdGlvbnMuaW5zdHJ1Y3Rpb25IYXNBdHRyaWJ1dGVzKSB7XHJcbiAgICAgICAgZWxlbWVudFtvcHRpb25zLmF0dHJpYnV0ZXNLZXldID0gdmFsdWVba2V5XVtvcHRpb25zLmF0dHJpYnV0ZXNLZXldO1xyXG4gICAgICAgIGlmICgnaW5zdHJ1Y3Rpb25GbicgaW4gb3B0aW9ucykge1xyXG4gICAgICAgICAgZWxlbWVudFtvcHRpb25zLmF0dHJpYnV0ZXNLZXldID0gb3B0aW9ucy5pbnN0cnVjdGlvbkZuKGVsZW1lbnRbb3B0aW9ucy5hdHRyaWJ1dGVzS2V5XSwga2V5LCBjdXJyZW50RWxlbWVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGlmICgnaW5zdHJ1Y3Rpb25GbicgaW4gb3B0aW9ucykge1xyXG4gICAgICAgICAgdmFsdWVba2V5XSA9IG9wdGlvbnMuaW5zdHJ1Y3Rpb25Gbih2YWx1ZVtrZXldLCBrZXksIGN1cnJlbnRFbGVtZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxlbWVudFtvcHRpb25zLmluc3RydWN0aW9uS2V5XSA9IHZhbHVlW2tleV07XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICh0eXBlICsgJ0ZuJyBpbiBvcHRpb25zKSB7XHJcbiAgICAgICAgdmFsdWUgPSBvcHRpb25zW3R5cGUgKyAnRm4nXSh2YWx1ZSwgY3VycmVudEVsZW1lbnQpO1xyXG4gICAgICB9XHJcbiAgICAgIGVsZW1lbnRbb3B0aW9uc1t0eXBlICsgJ0tleSddXSA9IHZhbHVlO1xyXG4gICAgfVxyXG4gICAgaWYgKG9wdGlvbnMuYWRkUGFyZW50KSB7XHJcbiAgICAgIGVsZW1lbnRbb3B0aW9ucy5wYXJlbnRLZXldID0gY3VycmVudEVsZW1lbnQ7XHJcbiAgICB9XHJcbiAgICBjdXJyZW50RWxlbWVudFtvcHRpb25zLmVsZW1lbnRzS2V5XS5wdXNoKGVsZW1lbnQpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gbWFuaXB1bGF0ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcykge1xyXG4gIGlmICgnYXR0cmlidXRlc0ZuJyBpbiBvcHRpb25zICYmIGF0dHJpYnV0ZXMpIHtcclxuICAgIGF0dHJpYnV0ZXMgPSBvcHRpb25zLmF0dHJpYnV0ZXNGbihhdHRyaWJ1dGVzLCBjdXJyZW50RWxlbWVudCk7XHJcbiAgfVxyXG4gIGlmICgob3B0aW9ucy50cmltIHx8ICdhdHRyaWJ1dGVWYWx1ZUZuJyBpbiBvcHRpb25zIHx8ICdhdHRyaWJ1dGVOYW1lRm4nIGluIG9wdGlvbnMpICYmIGF0dHJpYnV0ZXMpIHtcclxuICAgIHZhciBrZXk7XHJcbiAgICBmb3IgKGtleSBpbiBhdHRyaWJ1dGVzKSB7XHJcbiAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgICBpZiAob3B0aW9ucy50cmltKSBhdHRyaWJ1dGVzW2tleV0gPSBhdHRyaWJ1dGVzW2tleV0udHJpbSgpO1xyXG4gICAgICAgIGlmICgnYXR0cmlidXRlVmFsdWVGbicgaW4gb3B0aW9ucykgYXR0cmlidXRlc1trZXldID0gb3B0aW9ucy5hdHRyaWJ1dGVWYWx1ZUZuKGF0dHJpYnV0ZXNba2V5XSwga2V5LCBjdXJyZW50RWxlbWVudCk7XHJcbiAgICAgICAgaWYgKCdhdHRyaWJ1dGVOYW1lRm4nIGluIG9wdGlvbnMpIHtcclxuICAgICAgICAgIHZhciB0ZW1wID0gYXR0cmlidXRlc1trZXldO1xyXG4gICAgICAgICAgZGVsZXRlIGF0dHJpYnV0ZXNba2V5XTtcclxuICAgICAgICAgIGF0dHJpYnV0ZXNbb3B0aW9ucy5hdHRyaWJ1dGVOYW1lRm4oa2V5LCBhdHRyaWJ1dGVzW2tleV0sIGN1cnJlbnRFbGVtZW50KV0gPSB0ZW1wO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gYXR0cmlidXRlcztcclxufVxyXG5cclxuZnVuY3Rpb24gb25JbnN0cnVjdGlvbihpbnN0cnVjdGlvbikge1xyXG4gIHZhciBhdHRyaWJ1dGVzID0ge307XHJcbiAgaWYgKGluc3RydWN0aW9uLmJvZHkgJiYgKGluc3RydWN0aW9uLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3htbCcgfHwgb3B0aW9ucy5pbnN0cnVjdGlvbkhhc0F0dHJpYnV0ZXMpKSB7XHJcbiAgICB2YXIgYXR0cnNSZWdFeHAgPSAvKFtcXHc6LV0rKVxccyo9XFxzKig/OlwiKFteXCJdKilcInwnKFteJ10qKSd8KFxcdyspKVxccyovZztcclxuICAgIHZhciBtYXRjaDtcclxuICAgIHdoaWxlICgobWF0Y2ggPSBhdHRyc1JlZ0V4cC5leGVjKGluc3RydWN0aW9uLmJvZHkpKSAhPT0gbnVsbCkge1xyXG4gICAgICBhdHRyaWJ1dGVzW21hdGNoWzFdXSA9IG1hdGNoWzJdIHx8IG1hdGNoWzNdIHx8IG1hdGNoWzRdO1xyXG4gICAgfVxyXG4gICAgYXR0cmlidXRlcyA9IG1hbmlwdWxhdGVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMpO1xyXG4gIH1cclxuICBpZiAoaW5zdHJ1Y3Rpb24ubmFtZS50b0xvd2VyQ2FzZSgpID09PSAneG1sJykge1xyXG4gICAgaWYgKG9wdGlvbnMuaWdub3JlRGVjbGFyYXRpb24pIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY3VycmVudEVsZW1lbnRbb3B0aW9ucy5kZWNsYXJhdGlvbktleV0gPSB7fTtcclxuICAgIGlmIChPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5sZW5ndGgpIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbb3B0aW9ucy5kZWNsYXJhdGlvbktleV1bb3B0aW9ucy5hdHRyaWJ1dGVzS2V5XSA9IGF0dHJpYnV0ZXM7XHJcbiAgICB9XHJcbiAgICBpZiAob3B0aW9ucy5hZGRQYXJlbnQpIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbb3B0aW9ucy5kZWNsYXJhdGlvbktleV1bb3B0aW9ucy5wYXJlbnRLZXldID0gY3VycmVudEVsZW1lbnQ7XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIGlmIChvcHRpb25zLmlnbm9yZUluc3RydWN0aW9uKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChvcHRpb25zLnRyaW0pIHtcclxuICAgICAgaW5zdHJ1Y3Rpb24uYm9keSA9IGluc3RydWN0aW9uLmJvZHkudHJpbSgpO1xyXG4gICAgfVxyXG4gICAgdmFyIHZhbHVlID0ge307XHJcbiAgICBpZiAob3B0aW9ucy5pbnN0cnVjdGlvbkhhc0F0dHJpYnV0ZXMgJiYgT2JqZWN0LmtleXMoYXR0cmlidXRlcykubGVuZ3RoKSB7XHJcbiAgICAgIHZhbHVlW2luc3RydWN0aW9uLm5hbWVdID0ge307XHJcbiAgICAgIHZhbHVlW2luc3RydWN0aW9uLm5hbWVdW29wdGlvbnMuYXR0cmlidXRlc0tleV0gPSBhdHRyaWJ1dGVzO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdmFsdWVbaW5zdHJ1Y3Rpb24ubmFtZV0gPSBpbnN0cnVjdGlvbi5ib2R5O1xyXG4gICAgfVxyXG4gICAgYWRkRmllbGQoJ2luc3RydWN0aW9uJywgdmFsdWUpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gb25TdGFydEVsZW1lbnQobmFtZSwgYXR0cmlidXRlcykge1xyXG4gIHZhciBlbGVtZW50O1xyXG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcclxuICAgIGF0dHJpYnV0ZXMgPSBuYW1lLmF0dHJpYnV0ZXM7XHJcbiAgICBuYW1lID0gbmFtZS5uYW1lO1xyXG4gIH1cclxuICBhdHRyaWJ1dGVzID0gbWFuaXB1bGF0ZUF0dHJpYnV0ZXMoYXR0cmlidXRlcyk7XHJcbiAgaWYgKCdlbGVtZW50TmFtZUZuJyBpbiBvcHRpb25zKSB7XHJcbiAgICBuYW1lID0gb3B0aW9ucy5lbGVtZW50TmFtZUZuKG5hbWUsIGN1cnJlbnRFbGVtZW50KTtcclxuICB9XHJcbiAgaWYgKG9wdGlvbnMuY29tcGFjdCkge1xyXG4gICAgZWxlbWVudCA9IHt9O1xyXG4gICAgaWYgKCFvcHRpb25zLmlnbm9yZUF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcyAmJiBPYmplY3Qua2V5cyhhdHRyaWJ1dGVzKS5sZW5ndGgpIHtcclxuICAgICAgZWxlbWVudFtvcHRpb25zLmF0dHJpYnV0ZXNLZXldID0ge307XHJcbiAgICAgIHZhciBrZXk7XHJcbiAgICAgIGZvciAoa2V5IGluIGF0dHJpYnV0ZXMpIHtcclxuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgICAgICBlbGVtZW50W29wdGlvbnMuYXR0cmlidXRlc0tleV1ba2V5XSA9IGF0dHJpYnV0ZXNba2V5XTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICghKG5hbWUgaW4gY3VycmVudEVsZW1lbnQpICYmIG9wdGlvbnMuYWx3YXlzQXJyYXkpIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbbmFtZV0gPSBbXTtcclxuICAgIH1cclxuICAgIGlmIChjdXJyZW50RWxlbWVudFtuYW1lXSAmJiAhaXNBcnJheShjdXJyZW50RWxlbWVudFtuYW1lXSkpIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbbmFtZV0gPSBbY3VycmVudEVsZW1lbnRbbmFtZV1dO1xyXG4gICAgfVxyXG4gICAgaWYgKGlzQXJyYXkoY3VycmVudEVsZW1lbnRbbmFtZV0pKSB7XHJcbiAgICAgIGN1cnJlbnRFbGVtZW50W25hbWVdLnB1c2goZWxlbWVudCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjdXJyZW50RWxlbWVudFtuYW1lXSA9IGVsZW1lbnQ7XHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIGlmICghY3VycmVudEVsZW1lbnRbb3B0aW9ucy5lbGVtZW50c0tleV0pIHtcclxuICAgICAgY3VycmVudEVsZW1lbnRbb3B0aW9ucy5lbGVtZW50c0tleV0gPSBbXTtcclxuICAgIH1cclxuICAgIGVsZW1lbnQgPSB7fTtcclxuICAgIGVsZW1lbnRbb3B0aW9ucy50eXBlS2V5XSA9ICdlbGVtZW50JztcclxuICAgIGVsZW1lbnRbb3B0aW9ucy5uYW1lS2V5XSA9IG5hbWU7XHJcbiAgICBpZiAoIW9wdGlvbnMuaWdub3JlQXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzICYmIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmxlbmd0aCkge1xyXG4gICAgICBlbGVtZW50W29wdGlvbnMuYXR0cmlidXRlc0tleV0gPSBhdHRyaWJ1dGVzO1xyXG4gICAgfVxyXG4gICAgaWYgKG9wdGlvbnMuYWx3YXlzQ2hpbGRyZW4pIHtcclxuICAgICAgZWxlbWVudFtvcHRpb25zLmVsZW1lbnRzS2V5XSA9IFtdO1xyXG4gICAgfVxyXG4gICAgY3VycmVudEVsZW1lbnRbb3B0aW9ucy5lbGVtZW50c0tleV0ucHVzaChlbGVtZW50KTtcclxuICB9XHJcbiAgLy8gaWYgKG9wdGlvbnMuYWRkUGFyZW50KSB7XHJcbiAgICBlbGVtZW50W29wdGlvbnMucGFyZW50S2V5XSA9IGN1cnJlbnRFbGVtZW50O1xyXG4gIC8vIH1cclxuICBjdXJyZW50RWxlbWVudCA9IGVsZW1lbnQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uVGV4dCh0ZXh0KSB7XHJcbiAgaWYgKG9wdGlvbnMuaWdub3JlVGV4dCkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAoIXRleHQudHJpbSgpICYmICFvcHRpb25zLmNhcHR1cmVTcGFjZXNCZXR3ZWVuRWxlbWVudHMpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgaWYgKG9wdGlvbnMudHJpbSkge1xyXG4gICAgdGV4dCA9IHRleHQudHJpbSgpO1xyXG4gIH1cclxuICBpZiAob3B0aW9ucy5uYXRpdmVUeXBlKSB7XHJcbiAgICB0ZXh0ID0gbmF0aXZlVHlwZSh0ZXh0KTtcclxuICB9XHJcbiAgaWYgKG9wdGlvbnMuc2FuaXRpemUpIHtcclxuICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcclxuICB9XHJcbiAgYWRkRmllbGQoJ3RleHQnLCB0ZXh0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Db21tZW50KGNvbW1lbnQpIHtcclxuICBpZiAob3B0aW9ucy5pZ25vcmVDb21tZW50KSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIGlmIChvcHRpb25zLnRyaW0pIHtcclxuICAgIGNvbW1lbnQgPSBjb21tZW50LnRyaW0oKTtcclxuICB9XHJcbiAgYWRkRmllbGQoJ2NvbW1lbnQnLCBjb21tZW50KTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25FbmRFbGVtZW50KG5hbWUpIHtcclxuICB2YXIgcGFyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50W29wdGlvbnMucGFyZW50S2V5XTtcclxuICBpZiAoIW9wdGlvbnMuYWRkUGFyZW50KSB7XHJcbiAgICBkZWxldGUgY3VycmVudEVsZW1lbnRbb3B0aW9ucy5wYXJlbnRLZXldO1xyXG4gIH1cclxuICBjdXJyZW50RWxlbWVudCA9IHBhcmVudEVsZW1lbnQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQ2RhdGEoY2RhdGEpIHtcclxuICBpZiAob3B0aW9ucy5pZ25vcmVDZGF0YSkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAob3B0aW9ucy50cmltKSB7XHJcbiAgICBjZGF0YSA9IGNkYXRhLnRyaW0oKTtcclxuICB9XHJcbiAgYWRkRmllbGQoJ2NkYXRhJywgY2RhdGEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkRvY3R5cGUoZG9jdHlwZSkge1xyXG4gIGlmIChvcHRpb25zLmlnbm9yZURvY3R5cGUpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgZG9jdHlwZSA9IGRvY3R5cGUucmVwbGFjZSgvXiAvLCAnJyk7XHJcbiAgaWYgKG9wdGlvbnMudHJpbSkge1xyXG4gICAgZG9jdHlwZSA9IGRvY3R5cGUudHJpbSgpO1xyXG4gIH1cclxuICBhZGRGaWVsZCgnZG9jdHlwZScsIGRvY3R5cGUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkVycm9yKGVycm9yKSB7XHJcbiAgZXJyb3Iubm90ZSA9IGVycm9yOyAvL2NvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh4bWwsIHVzZXJPcHRpb25zKSB7XHJcblxyXG4gIHZhciBwYXJzZXIgPSBwdXJlSnNQYXJzZXIgPyBzYXgucGFyc2VyKHRydWUsIHt9KSA6IHBhcnNlciA9IG5ldyBleHBhdC5QYXJzZXIoJ1VURi04Jyk7XHJcbiAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gIGN1cnJlbnRFbGVtZW50ID0gcmVzdWx0O1xyXG5cclxuICBvcHRpb25zID0gdmFsaWRhdGVPcHRpb25zKHVzZXJPcHRpb25zKTtcclxuXHJcbiAgaWYgKHB1cmVKc1BhcnNlcikge1xyXG4gICAgcGFyc2VyLm9ub3BlbnRhZyA9IG9uU3RhcnRFbGVtZW50O1xyXG4gICAgcGFyc2VyLm9udGV4dCA9IG9uVGV4dDtcclxuICAgIHBhcnNlci5vbmNvbW1lbnQgPSBvbkNvbW1lbnQ7XHJcbiAgICBwYXJzZXIub25jbG9zZXRhZyA9IG9uRW5kRWxlbWVudDtcclxuICAgIHBhcnNlci5vbmVycm9yID0gb25FcnJvcjtcclxuICAgIHBhcnNlci5vbmNkYXRhID0gb25DZGF0YTtcclxuICAgIHBhcnNlci5vbmRvY3R5cGUgPSBvbkRvY3R5cGU7XHJcbiAgICBwYXJzZXIub25wcm9jZXNzaW5naW5zdHJ1Y3Rpb24gPSBvbkluc3RydWN0aW9uO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBwYXJzZXIub24oJ3N0YXJ0RWxlbWVudCcsIG9uU3RhcnRFbGVtZW50KTtcclxuICAgIHBhcnNlci5vbigndGV4dCcsIG9uVGV4dCk7XHJcbiAgICBwYXJzZXIub24oJ2NvbW1lbnQnLCBvbkNvbW1lbnQpO1xyXG4gICAgcGFyc2VyLm9uKCdlbmRFbGVtZW50Jywgb25FbmRFbGVtZW50KTtcclxuICAgIHBhcnNlci5vbignZXJyb3InLCBvbkVycm9yKTtcclxuICAgIC8vcGFyc2VyLm9uKCdzdGFydENkYXRhJywgb25TdGFydENkYXRhKTtcclxuICAgIC8vcGFyc2VyLm9uKCdlbmRDZGF0YScsIG9uRW5kQ2RhdGEpO1xyXG4gICAgLy9wYXJzZXIub24oJ2VudGl0eURlY2wnLCBvbkVudGl0eURlY2wpO1xyXG4gIH1cclxuXHJcbiAgaWYgKHB1cmVKc1BhcnNlcikge1xyXG4gICAgcGFyc2VyLndyaXRlKHhtbCkuY2xvc2UoKTtcclxuICB9IGVsc2Uge1xyXG4gICAgaWYgKCFwYXJzZXIucGFyc2UoeG1sKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1hNTCBwYXJzaW5nIGVycm9yOiAnICsgcGFyc2VyLmdldEVycm9yKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaWYgKHJlc3VsdFtvcHRpb25zLmVsZW1lbnRzS2V5XSkge1xyXG4gICAgdmFyIHRlbXAgPSByZXN1bHRbb3B0aW9ucy5lbGVtZW50c0tleV07XHJcbiAgICBkZWxldGUgcmVzdWx0W29wdGlvbnMuZWxlbWVudHNLZXldO1xyXG4gICAgcmVzdWx0W29wdGlvbnMuZWxlbWVudHNLZXldID0gdGVtcDtcclxuICAgIGRlbGV0ZSByZXN1bHQudGV4dDtcclxuICB9XHJcblxyXG4gIHJldHVybiByZXN1bHQ7XHJcblxyXG59O1xyXG4iLCJ2YXIgaGVscGVyID0gcmVxdWlyZSgnLi9vcHRpb25zLWhlbHBlcicpO1xudmFyIHhtbDJqcyA9IHJlcXVpcmUoJy4veG1sMmpzJyk7XG5cbmZ1bmN0aW9uIHZhbGlkYXRlT3B0aW9ucyAodXNlck9wdGlvbnMpIHtcbiAgdmFyIG9wdGlvbnMgPSBoZWxwZXIuY29weU9wdGlvbnModXNlck9wdGlvbnMpO1xuICBoZWxwZXIuZW5zdXJlU3BhY2VzRXhpc3RzKG9wdGlvbnMpO1xuICByZXR1cm4gb3B0aW9ucztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbih4bWwsIHVzZXJPcHRpb25zKSB7XG4gIHZhciBvcHRpb25zLCBqcywganNvbiwgcGFyZW50S2V5O1xuICBvcHRpb25zID0gdmFsaWRhdGVPcHRpb25zKHVzZXJPcHRpb25zKTtcbiAganMgPSB4bWwyanMoeG1sLCBvcHRpb25zKTtcbiAgcGFyZW50S2V5ID0gJ2NvbXBhY3QnIGluIG9wdGlvbnMgJiYgb3B0aW9ucy5jb21wYWN0ID8gJ19wYXJlbnQnIDogJ3BhcmVudCc7XG4gIC8vIHBhcmVudEtleSA9IHB0aW9ucy5jb21wYWN0ID8gJ19wYXJlbnQnIDogJ3BhcmVudCc7IC8vIGNvbnNpZGVyIHRoaXNcbiAgaWYgKCdhZGRQYXJlbnQnIGluIG9wdGlvbnMgJiYgb3B0aW9ucy5hZGRQYXJlbnQpIHtcbiAgICBqc29uID0gSlNPTi5zdHJpbmdpZnkoanMsIGZ1bmN0aW9uIChrLCB2KSB7IHJldHVybiBrID09PSBwYXJlbnRLZXk/ICdfJyA6IHY7IH0sIG9wdGlvbnMuc3BhY2VzKTtcbiAgfSBlbHNlIHtcbiAgICBqc29uID0gSlNPTi5zdHJpbmdpZnkoanMsIG51bGwsIG9wdGlvbnMuc3BhY2VzKTtcbiAgfVxuICByZXR1cm4ganNvbi5yZXBsYWNlKC9cXHUyMDI4L2csICdcXFxcdTIwMjgnKS5yZXBsYWNlKC9cXHUyMDI5L2csICdcXFxcdTIwMjknKTtcbn07XG4iLCJ2YXIgaGVscGVyID0gcmVxdWlyZSgnLi9vcHRpb25zLWhlbHBlcicpO1xyXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJy4vYXJyYXktaGVscGVyJykuaXNBcnJheTtcclxuXHJcbnZhciBjdXJyZW50RWxlbWVudCwgY3VycmVudEVsZW1lbnROYW1lO1xyXG5cclxuZnVuY3Rpb24gdmFsaWRhdGVPcHRpb25zKHVzZXJPcHRpb25zKSB7XHJcbiAgdmFyIG9wdGlvbnMgPSBoZWxwZXIuY29weU9wdGlvbnModXNlck9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpZ25vcmVEZWNsYXJhdGlvbicsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpZ25vcmVJbnN0cnVjdGlvbicsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpZ25vcmVBdHRyaWJ1dGVzJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2lnbm9yZVRleHQnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaWdub3JlQ29tbWVudCcsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpZ25vcmVDZGF0YScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpZ25vcmVEb2N0eXBlJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2NvbXBhY3QnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnaW5kZW50VGV4dCcsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpbmRlbnRDZGF0YScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVGbGFnRXhpc3RzKCdpbmRlbnRBdHRyaWJ1dGVzJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2luZGVudEluc3RydWN0aW9uJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUZsYWdFeGlzdHMoJ2Z1bGxUYWdFbXB0eUVsZW1lbnQnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlRmxhZ0V4aXN0cygnbm9RdW90ZXNGb3JOYXRpdmVBdHRyaWJ1dGVzJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZVNwYWNlc0V4aXN0cyhvcHRpb25zKTtcclxuICBpZiAodHlwZW9mIG9wdGlvbnMuc3BhY2VzID09PSAnbnVtYmVyJykge1xyXG4gICAgb3B0aW9ucy5zcGFjZXMgPSBBcnJheShvcHRpb25zLnNwYWNlcyArIDEpLmpvaW4oJyAnKTtcclxuICB9XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygnZGVjbGFyYXRpb24nLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCdpbnN0cnVjdGlvbicsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ2F0dHJpYnV0ZXMnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCd0ZXh0Jywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygnY29tbWVudCcsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ2NkYXRhJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygnZG9jdHlwZScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5lbnN1cmVLZXlFeGlzdHMoJ3R5cGUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuZW5zdXJlS2V5RXhpc3RzKCduYW1lJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmVuc3VyZUtleUV4aXN0cygnZWxlbWVudHMnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygnZG9jdHlwZScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdpbnN0cnVjdGlvbicsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdjZGF0YScsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdjb21tZW50Jywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmNoZWNrRm5FeGlzdHMoJ3RleHQnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygnaW5zdHJ1Y3Rpb25OYW1lJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmNoZWNrRm5FeGlzdHMoJ2VsZW1lbnROYW1lJywgb3B0aW9ucyk7XHJcbiAgaGVscGVyLmNoZWNrRm5FeGlzdHMoJ2F0dHJpYnV0ZU5hbWUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygnYXR0cmlidXRlVmFsdWUnLCBvcHRpb25zKTtcclxuICBoZWxwZXIuY2hlY2tGbkV4aXN0cygnYXR0cmlidXRlcycsIG9wdGlvbnMpO1xyXG4gIGhlbHBlci5jaGVja0ZuRXhpc3RzKCdmdWxsVGFnRW1wdHlFbGVtZW50Jywgb3B0aW9ucyk7XHJcbiAgcmV0dXJuIG9wdGlvbnM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlSW5kZW50YXRpb24ob3B0aW9ucywgZGVwdGgsIGZpcnN0TGluZSkge1xyXG4gIHJldHVybiAoIWZpcnN0TGluZSAmJiBvcHRpb25zLnNwYWNlcyA/ICdcXG4nIDogJycpICsgQXJyYXkoZGVwdGggKyAxKS5qb2luKG9wdGlvbnMuc3BhY2VzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVBdHRyaWJ1dGVzKGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGRlcHRoKSB7XHJcbiAgaWYgKG9wdGlvbnMuaWdub3JlQXR0cmlidXRlcykge1xyXG4gICAgcmV0dXJuICcnO1xyXG4gIH1cclxuICBpZiAoJ2F0dHJpYnV0ZXNGbicgaW4gb3B0aW9ucykge1xyXG4gICAgYXR0cmlidXRlcyA9IG9wdGlvbnMuYXR0cmlidXRlc0ZuKGF0dHJpYnV0ZXMsIGN1cnJlbnRFbGVtZW50TmFtZSwgY3VycmVudEVsZW1lbnQpO1xyXG4gIH1cclxuICB2YXIga2V5LCBhdHRyLCBhdHRyTmFtZSwgcXVvdGUsIHJlc3VsdCA9ICcnO1xyXG4gIGZvciAoa2V5IGluIGF0dHJpYnV0ZXMpIHtcclxuICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgcXVvdGUgPSBvcHRpb25zLm5vUXVvdGVzRm9yTmF0aXZlQXR0cmlidXRlcyAmJiB0eXBlb2YgYXR0cmlidXRlc1trZXldICE9PSAnc3RyaW5nJyA/ICcnIDogJ1wiJztcclxuICAgICAgYXR0ciA9ICcnICsgYXR0cmlidXRlc1trZXldOyAvLyBlbnN1cmUgbnVtYmVyIGFuZCBib29sZWFuIGFyZSBjb252ZXJ0ZWQgdG8gU3RyaW5nXHJcbiAgICAgIGF0dHIgPSBhdHRyLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKTtcclxuICAgICAgYXR0ck5hbWUgPSAnYXR0cmlidXRlTmFtZUZuJyBpbiBvcHRpb25zID8gb3B0aW9ucy5hdHRyaWJ1dGVOYW1lRm4oa2V5LCBhdHRyLCBjdXJyZW50RWxlbWVudE5hbWUsIGN1cnJlbnRFbGVtZW50KSA6IGtleTtcclxuICAgICAgcmVzdWx0ICs9IChvcHRpb25zLnNwYWNlcyAmJiBvcHRpb25zLmluZGVudEF0dHJpYnV0ZXM/IHdyaXRlSW5kZW50YXRpb24ob3B0aW9ucywgZGVwdGgrMSwgZmFsc2UpIDogJyAnKTtcclxuICAgICAgcmVzdWx0ICs9IGF0dHJOYW1lICsgJz0nICsgcXVvdGUgKyAoJ2F0dHJpYnV0ZVZhbHVlRm4nIGluIG9wdGlvbnMgPyBvcHRpb25zLmF0dHJpYnV0ZVZhbHVlRm4oYXR0ciwga2V5LCBjdXJyZW50RWxlbWVudE5hbWUsIGN1cnJlbnRFbGVtZW50KSA6IGF0dHIpICsgcXVvdGU7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGlmIChhdHRyaWJ1dGVzICYmIE9iamVjdC5rZXlzKGF0dHJpYnV0ZXMpLmxlbmd0aCAmJiBvcHRpb25zLnNwYWNlcyAmJiBvcHRpb25zLmluZGVudEF0dHJpYnV0ZXMpIHtcclxuICAgIHJlc3VsdCArPSB3cml0ZUluZGVudGF0aW9uKG9wdGlvbnMsIGRlcHRoLCBmYWxzZSk7XHJcbiAgfVxyXG4gIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlRGVjbGFyYXRpb24oZGVjbGFyYXRpb24sIG9wdGlvbnMsIGRlcHRoKSB7XHJcbiAgY3VycmVudEVsZW1lbnQgPSBkZWNsYXJhdGlvbjtcclxuICBjdXJyZW50RWxlbWVudE5hbWUgPSAneG1sJztcclxuICByZXR1cm4gb3B0aW9ucy5pZ25vcmVEZWNsYXJhdGlvbiA/ICcnIDogICc8PycgKyAneG1sJyArIHdyaXRlQXR0cmlidXRlcyhkZWNsYXJhdGlvbltvcHRpb25zLmF0dHJpYnV0ZXNLZXldLCBvcHRpb25zLCBkZXB0aCkgKyAnPz4nO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUluc3RydWN0aW9uKGluc3RydWN0aW9uLCBvcHRpb25zLCBkZXB0aCkge1xyXG4gIGlmIChvcHRpb25zLmlnbm9yZUluc3RydWN0aW9uKSB7XHJcbiAgICByZXR1cm4gJyc7XHJcbiAgfVxyXG4gIHZhciBrZXk7XHJcbiAgZm9yIChrZXkgaW4gaW5zdHJ1Y3Rpb24pIHtcclxuICAgIGlmIChpbnN0cnVjdGlvbi5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuICB2YXIgaW5zdHJ1Y3Rpb25OYW1lID0gJ2luc3RydWN0aW9uTmFtZUZuJyBpbiBvcHRpb25zID8gb3B0aW9ucy5pbnN0cnVjdGlvbk5hbWVGbihrZXksIGluc3RydWN0aW9uW2tleV0sIGN1cnJlbnRFbGVtZW50TmFtZSwgY3VycmVudEVsZW1lbnQpIDoga2V5O1xyXG4gIGlmICh0eXBlb2YgaW5zdHJ1Y3Rpb25ba2V5XSA9PT0gJ29iamVjdCcpIHtcclxuICAgIGN1cnJlbnRFbGVtZW50ID0gaW5zdHJ1Y3Rpb247XHJcbiAgICBjdXJyZW50RWxlbWVudE5hbWUgPSBpbnN0cnVjdGlvbk5hbWU7XHJcbiAgICByZXR1cm4gJzw/JyArIGluc3RydWN0aW9uTmFtZSArIHdyaXRlQXR0cmlidXRlcyhpbnN0cnVjdGlvbltrZXldW29wdGlvbnMuYXR0cmlidXRlc0tleV0sIG9wdGlvbnMsIGRlcHRoKSArICc/Pic7XHJcbiAgfSBlbHNlIHtcclxuICAgIHZhciBpbnN0cnVjdGlvblZhbHVlID0gaW5zdHJ1Y3Rpb25ba2V5XSA/IGluc3RydWN0aW9uW2tleV0gOiAnJztcclxuICAgIGlmICgnaW5zdHJ1Y3Rpb25GbicgaW4gb3B0aW9ucykgaW5zdHJ1Y3Rpb25WYWx1ZSA9IG9wdGlvbnMuaW5zdHJ1Y3Rpb25GbihpbnN0cnVjdGlvblZhbHVlLCBrZXksIGN1cnJlbnRFbGVtZW50TmFtZSwgY3VycmVudEVsZW1lbnQpO1xyXG4gICAgcmV0dXJuICc8PycgKyBpbnN0cnVjdGlvbk5hbWUgKyAoaW5zdHJ1Y3Rpb25WYWx1ZSA/ICcgJyArIGluc3RydWN0aW9uVmFsdWUgOiAnJykgKyAnPz4nO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVDb21tZW50KGNvbW1lbnQsIG9wdGlvbnMpIHtcclxuICByZXR1cm4gb3B0aW9ucy5pZ25vcmVDb21tZW50ID8gJycgOiAnPCEtLScgKyAoJ2NvbW1lbnRGbicgaW4gb3B0aW9ucyA/IG9wdGlvbnMuY29tbWVudEZuKGNvbW1lbnQsIGN1cnJlbnRFbGVtZW50TmFtZSwgY3VycmVudEVsZW1lbnQpIDogY29tbWVudCkgKyAnLS0+JztcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVDZGF0YShjZGF0YSwgb3B0aW9ucykge1xyXG4gIHJldHVybiBvcHRpb25zLmlnbm9yZUNkYXRhID8gJycgOiAnPCFbQ0RBVEFbJyArICgnY2RhdGFGbicgaW4gb3B0aW9ucyA/IG9wdGlvbnMuY2RhdGFGbihjZGF0YSwgY3VycmVudEVsZW1lbnROYW1lLCBjdXJyZW50RWxlbWVudCkgOiBjZGF0YSkgKyAnXV0+JztcclxufVxyXG5cclxuZnVuY3Rpb24gd3JpdGVEb2N0eXBlKGRvY3R5cGUsIG9wdGlvbnMpIHtcclxuICByZXR1cm4gb3B0aW9ucy5pZ25vcmVEb2N0eXBlID8gJycgOiAnPCFET0NUWVBFICcgKyAoJ2RvY3R5cGVGbicgaW4gb3B0aW9ucyA/IG9wdGlvbnMuZG9jdHlwZUZuKGRvY3R5cGUsIGN1cnJlbnRFbGVtZW50TmFtZSwgY3VycmVudEVsZW1lbnQpIDogZG9jdHlwZSkgKyAnPic7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlVGV4dCh0ZXh0LCBvcHRpb25zKSB7XHJcbiAgaWYgKG9wdGlvbnMuaWdub3JlVGV4dCkgcmV0dXJuICcnO1xyXG4gIHRleHQgPSAnJyArIHRleHQ7IC8vIGVuc3VyZSBOdW1iZXIgYW5kIEJvb2xlYW4gYXJlIGNvbnZlcnRlZCB0byBTdHJpbmdcclxuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8mYW1wOy9nLCAnJicpOyAvLyBkZXNhbml0aXplIHRvIGF2b2lkIGRvdWJsZSBzYW5pdGl6YXRpb25cclxuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC8+L2csICcmZ3Q7Jyk7XHJcbiAgcmV0dXJuICd0ZXh0Rm4nIGluIG9wdGlvbnMgPyBvcHRpb25zLnRleHRGbih0ZXh0LCBjdXJyZW50RWxlbWVudE5hbWUsIGN1cnJlbnRFbGVtZW50KSA6IHRleHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhc0NvbnRlbnQoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gIHZhciBpO1xyXG4gIGlmIChlbGVtZW50LmVsZW1lbnRzICYmIGVsZW1lbnQuZWxlbWVudHMubGVuZ3RoKSB7XHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgZWxlbWVudC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xyXG4gICAgICBzd2l0Y2ggKGVsZW1lbnQuZWxlbWVudHNbaV1bb3B0aW9ucy50eXBlS2V5XSkge1xyXG4gICAgICBjYXNlICd0ZXh0JzpcclxuICAgICAgICBpZiAob3B0aW9ucy5pbmRlbnRUZXh0KSB7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7IC8vIHNraXAgdG8gbmV4dCBrZXlcclxuICAgICAgY2FzZSAnY2RhdGEnOlxyXG4gICAgICAgIGlmIChvcHRpb25zLmluZGVudENkYXRhKSB7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7IC8vIHNraXAgdG8gbmV4dCBrZXlcclxuICAgICAgY2FzZSAnaW5zdHJ1Y3Rpb24nOlxyXG4gICAgICAgIGlmIChvcHRpb25zLmluZGVudEluc3RydWN0aW9uKSB7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7IC8vIHNraXAgdG8gbmV4dCBrZXlcclxuICAgICAgY2FzZSAnZG9jdHlwZSc6XHJcbiAgICAgIGNhc2UgJ2NvbW1lbnQnOlxyXG4gICAgICBjYXNlICdlbGVtZW50JzpcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlRWxlbWVudChlbGVtZW50LCBvcHRpb25zLCBkZXB0aCkge1xyXG4gIGN1cnJlbnRFbGVtZW50ID0gZWxlbWVudDtcclxuICBjdXJyZW50RWxlbWVudE5hbWUgPSBlbGVtZW50Lm5hbWU7XHJcbiAgdmFyIHhtbCA9ICcnLCBlbGVtZW50TmFtZSA9ICdlbGVtZW50TmFtZUZuJyBpbiBvcHRpb25zID8gb3B0aW9ucy5lbGVtZW50TmFtZUZuKGVsZW1lbnQubmFtZSwgZWxlbWVudCkgOiBlbGVtZW50Lm5hbWU7XHJcbiAgeG1sICs9ICc8JyArIGVsZW1lbnROYW1lO1xyXG4gIGlmIChlbGVtZW50W29wdGlvbnMuYXR0cmlidXRlc0tleV0pIHtcclxuICAgIHhtbCArPSB3cml0ZUF0dHJpYnV0ZXMoZWxlbWVudFtvcHRpb25zLmF0dHJpYnV0ZXNLZXldLCBvcHRpb25zLCBkZXB0aCk7XHJcbiAgfVxyXG4gIHZhciB3aXRoQ2xvc2luZ1RhZyA9IGVsZW1lbnRbb3B0aW9ucy5lbGVtZW50c0tleV0gJiYgZWxlbWVudFtvcHRpb25zLmVsZW1lbnRzS2V5XS5sZW5ndGggfHwgZWxlbWVudFtvcHRpb25zLmF0dHJpYnV0ZXNLZXldICYmIGVsZW1lbnRbb3B0aW9ucy5hdHRyaWJ1dGVzS2V5XVsneG1sOnNwYWNlJ10gPT09ICdwcmVzZXJ2ZSc7XHJcbiAgaWYgKCF3aXRoQ2xvc2luZ1RhZykge1xyXG4gICAgaWYgKCdmdWxsVGFnRW1wdHlFbGVtZW50Rm4nIGluIG9wdGlvbnMpIHtcclxuICAgICAgd2l0aENsb3NpbmdUYWcgPSBvcHRpb25zLmZ1bGxUYWdFbXB0eUVsZW1lbnRGbihlbGVtZW50Lm5hbWUsIGVsZW1lbnQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2l0aENsb3NpbmdUYWcgPSBvcHRpb25zLmZ1bGxUYWdFbXB0eUVsZW1lbnQ7XHJcbiAgICB9XHJcbiAgfVxyXG4gIGlmICh3aXRoQ2xvc2luZ1RhZykge1xyXG4gICAgeG1sICs9ICc+JztcclxuICAgIGlmIChlbGVtZW50W29wdGlvbnMuZWxlbWVudHNLZXldICYmIGVsZW1lbnRbb3B0aW9ucy5lbGVtZW50c0tleV0ubGVuZ3RoKSB7XHJcbiAgICAgIHhtbCArPSB3cml0ZUVsZW1lbnRzKGVsZW1lbnRbb3B0aW9ucy5lbGVtZW50c0tleV0sIG9wdGlvbnMsIGRlcHRoICsgMSk7XHJcbiAgICAgIGN1cnJlbnRFbGVtZW50ID0gZWxlbWVudDtcclxuICAgICAgY3VycmVudEVsZW1lbnROYW1lID0gZWxlbWVudC5uYW1lO1xyXG4gICAgfVxyXG4gICAgeG1sICs9IG9wdGlvbnMuc3BhY2VzICYmIGhhc0NvbnRlbnQoZWxlbWVudCwgb3B0aW9ucykgPyAnXFxuJyArIEFycmF5KGRlcHRoICsgMSkuam9pbihvcHRpb25zLnNwYWNlcykgOiAnJztcclxuICAgIHhtbCArPSAnPC8nICsgZWxlbWVudE5hbWUgKyAnPic7XHJcbiAgfSBlbHNlIHtcclxuICAgIHhtbCArPSAnLz4nO1xyXG4gIH1cclxuICByZXR1cm4geG1sO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cml0ZUVsZW1lbnRzKGVsZW1lbnRzLCBvcHRpb25zLCBkZXB0aCwgZmlyc3RMaW5lKSB7XHJcbiAgcmV0dXJuIGVsZW1lbnRzLnJlZHVjZShmdW5jdGlvbiAoeG1sLCBlbGVtZW50KSB7XHJcbiAgICB2YXIgaW5kZW50ID0gd3JpdGVJbmRlbnRhdGlvbihvcHRpb25zLCBkZXB0aCwgZmlyc3RMaW5lICYmICF4bWwpO1xyXG4gICAgc3dpdGNoIChlbGVtZW50LnR5cGUpIHtcclxuICAgIGNhc2UgJ2VsZW1lbnQnOiByZXR1cm4geG1sICsgaW5kZW50ICsgd3JpdGVFbGVtZW50KGVsZW1lbnQsIG9wdGlvbnMsIGRlcHRoKTtcclxuICAgIGNhc2UgJ2NvbW1lbnQnOiByZXR1cm4geG1sICsgaW5kZW50ICsgd3JpdGVDb21tZW50KGVsZW1lbnRbb3B0aW9ucy5jb21tZW50S2V5XSwgb3B0aW9ucyk7XHJcbiAgICBjYXNlICdkb2N0eXBlJzogcmV0dXJuIHhtbCArIGluZGVudCArIHdyaXRlRG9jdHlwZShlbGVtZW50W29wdGlvbnMuZG9jdHlwZUtleV0sIG9wdGlvbnMpO1xyXG4gICAgY2FzZSAnY2RhdGEnOiByZXR1cm4geG1sICsgKG9wdGlvbnMuaW5kZW50Q2RhdGEgPyBpbmRlbnQgOiAnJykgKyB3cml0ZUNkYXRhKGVsZW1lbnRbb3B0aW9ucy5jZGF0YUtleV0sIG9wdGlvbnMpO1xyXG4gICAgY2FzZSAndGV4dCc6IHJldHVybiB4bWwgKyAob3B0aW9ucy5pbmRlbnRUZXh0ID8gaW5kZW50IDogJycpICsgd3JpdGVUZXh0KGVsZW1lbnRbb3B0aW9ucy50ZXh0S2V5XSwgb3B0aW9ucyk7XHJcbiAgICBjYXNlICdpbnN0cnVjdGlvbic6XHJcbiAgICAgIHZhciBpbnN0cnVjdGlvbiA9IHt9O1xyXG4gICAgICBpbnN0cnVjdGlvbltlbGVtZW50W29wdGlvbnMubmFtZUtleV1dID0gZWxlbWVudFtvcHRpb25zLmF0dHJpYnV0ZXNLZXldID8gZWxlbWVudCA6IGVsZW1lbnRbb3B0aW9ucy5pbnN0cnVjdGlvbktleV07XHJcbiAgICAgIHJldHVybiB4bWwgKyAob3B0aW9ucy5pbmRlbnRJbnN0cnVjdGlvbiA/IGluZGVudCA6ICcnKSArIHdyaXRlSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb24sIG9wdGlvbnMsIGRlcHRoKTtcclxuICAgIH1cclxuICB9LCAnJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGhhc0NvbnRlbnRDb21wYWN0KGVsZW1lbnQsIG9wdGlvbnMsIGFueUNvbnRlbnQpIHtcclxuICB2YXIga2V5O1xyXG4gIGZvciAoa2V5IGluIGVsZW1lbnQpIHtcclxuICAgIGlmIChlbGVtZW50Lmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgc3dpdGNoIChrZXkpIHtcclxuICAgICAgY2FzZSBvcHRpb25zLnBhcmVudEtleTpcclxuICAgICAgY2FzZSBvcHRpb25zLmF0dHJpYnV0ZXNLZXk6XHJcbiAgICAgICAgYnJlYWs7IC8vIHNraXAgdG8gbmV4dCBrZXlcclxuICAgICAgY2FzZSBvcHRpb25zLnRleHRLZXk6XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5kZW50VGV4dCB8fCBhbnlDb250ZW50KSB7XHJcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7IC8vIHNraXAgdG8gbmV4dCBrZXlcclxuICAgICAgY2FzZSBvcHRpb25zLmNkYXRhS2V5OlxyXG4gICAgICAgIGlmIChvcHRpb25zLmluZGVudENkYXRhIHx8IGFueUNvbnRlbnQpIHtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhazsgLy8gc2tpcCB0byBuZXh0IGtleVxyXG4gICAgICBjYXNlIG9wdGlvbnMuaW5zdHJ1Y3Rpb25LZXk6XHJcbiAgICAgICAgaWYgKG9wdGlvbnMuaW5kZW50SW5zdHJ1Y3Rpb24gfHwgYW55Q29udGVudCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrOyAvLyBza2lwIHRvIG5leHQga2V5XHJcbiAgICAgIGNhc2Ugb3B0aW9ucy5kb2N0eXBlS2V5OlxyXG4gICAgICBjYXNlIG9wdGlvbnMuY29tbWVudEtleTpcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlRWxlbWVudENvbXBhY3QoZWxlbWVudCwgbmFtZSwgb3B0aW9ucywgZGVwdGgsIGluZGVudCkge1xyXG4gIGN1cnJlbnRFbGVtZW50ID0gZWxlbWVudDtcclxuICBjdXJyZW50RWxlbWVudE5hbWUgPSBuYW1lO1xyXG4gIHZhciBlbGVtZW50TmFtZSA9ICdlbGVtZW50TmFtZUZuJyBpbiBvcHRpb25zID8gb3B0aW9ucy5lbGVtZW50TmFtZUZuKG5hbWUsIGVsZW1lbnQpIDogbmFtZTtcclxuICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICd1bmRlZmluZWQnIHx8IGVsZW1lbnQgPT09IG51bGwpIHtcclxuICAgIHJldHVybiAnZnVsbFRhZ0VtcHR5RWxlbWVudEZuJyBpbiBvcHRpb25zICYmIG9wdGlvbnMuZnVsbFRhZ0VtcHR5RWxlbWVudEZuKG5hbWUsIGVsZW1lbnQpIHx8IG9wdGlvbnMuZnVsbFRhZ0VtcHR5RWxlbWVudCA/ICc8JyArIGVsZW1lbnROYW1lICsgJz48LycgKyBlbGVtZW50TmFtZSArICc+JyA6ICc8JyArIGVsZW1lbnROYW1lICsgJy8+JztcclxuICB9XHJcbiAgdmFyIHhtbCA9ICcnO1xyXG4gIGlmIChuYW1lKSB7XHJcbiAgICB4bWwgKz0gJzwnICsgZWxlbWVudE5hbWU7XHJcbiAgICBpZiAodHlwZW9mIGVsZW1lbnQgIT09ICdvYmplY3QnKSB7XHJcbiAgICAgIHhtbCArPSAnPicgKyB3cml0ZVRleHQoZWxlbWVudCxvcHRpb25zKSArICc8LycgKyBlbGVtZW50TmFtZSArICc+JztcclxuICAgICAgcmV0dXJuIHhtbDtcclxuICAgIH1cclxuICAgIGlmIChlbGVtZW50W29wdGlvbnMuYXR0cmlidXRlc0tleV0pIHtcclxuICAgICAgeG1sICs9IHdyaXRlQXR0cmlidXRlcyhlbGVtZW50W29wdGlvbnMuYXR0cmlidXRlc0tleV0sIG9wdGlvbnMsIGRlcHRoKTtcclxuICAgIH1cclxuICAgIHZhciB3aXRoQ2xvc2luZ1RhZyA9IGhhc0NvbnRlbnRDb21wYWN0KGVsZW1lbnQsIG9wdGlvbnMsIHRydWUpIHx8IGVsZW1lbnRbb3B0aW9ucy5hdHRyaWJ1dGVzS2V5XSAmJiBlbGVtZW50W29wdGlvbnMuYXR0cmlidXRlc0tleV1bJ3htbDpzcGFjZSddID09PSAncHJlc2VydmUnO1xyXG4gICAgaWYgKCF3aXRoQ2xvc2luZ1RhZykge1xyXG4gICAgICBpZiAoJ2Z1bGxUYWdFbXB0eUVsZW1lbnRGbicgaW4gb3B0aW9ucykge1xyXG4gICAgICAgIHdpdGhDbG9zaW5nVGFnID0gb3B0aW9ucy5mdWxsVGFnRW1wdHlFbGVtZW50Rm4obmFtZSwgZWxlbWVudCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgd2l0aENsb3NpbmdUYWcgPSBvcHRpb25zLmZ1bGxUYWdFbXB0eUVsZW1lbnQ7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh3aXRoQ2xvc2luZ1RhZykge1xyXG4gICAgICB4bWwgKz0gJz4nO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgeG1sICs9ICcvPic7XHJcbiAgICAgIHJldHVybiB4bWw7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHhtbCArPSB3cml0ZUVsZW1lbnRzQ29tcGFjdChlbGVtZW50LCBvcHRpb25zLCBkZXB0aCArIDEsIGZhbHNlKTtcclxuICBjdXJyZW50RWxlbWVudCA9IGVsZW1lbnQ7XHJcbiAgY3VycmVudEVsZW1lbnROYW1lID0gbmFtZTtcclxuICBpZiAobmFtZSkge1xyXG4gICAgeG1sICs9IChpbmRlbnQgPyB3cml0ZUluZGVudGF0aW9uKG9wdGlvbnMsIGRlcHRoLCBmYWxzZSkgOiAnJykgKyAnPC8nICsgZWxlbWVudE5hbWUgKyAnPic7XHJcbiAgfVxyXG4gIHJldHVybiB4bWw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdyaXRlRWxlbWVudHNDb21wYWN0KGVsZW1lbnQsIG9wdGlvbnMsIGRlcHRoLCBmaXJzdExpbmUpIHtcclxuICB2YXIgaSwga2V5LCBub2RlcywgeG1sID0gJyc7XHJcbiAgZm9yIChrZXkgaW4gZWxlbWVudCkge1xyXG4gICAgaWYgKGVsZW1lbnQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xyXG4gICAgICBub2RlcyA9IGlzQXJyYXkoZWxlbWVudFtrZXldKSA/IGVsZW1lbnRba2V5XSA6IFtlbGVtZW50W2tleV1dO1xyXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICBzd2l0Y2ggKGtleSkge1xyXG4gICAgICAgIGNhc2Ugb3B0aW9ucy5kZWNsYXJhdGlvbktleTogeG1sICs9IHdyaXRlRGVjbGFyYXRpb24obm9kZXNbaV0sIG9wdGlvbnMsIGRlcHRoKTsgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBvcHRpb25zLmluc3RydWN0aW9uS2V5OiB4bWwgKz0gKG9wdGlvbnMuaW5kZW50SW5zdHJ1Y3Rpb24gPyB3cml0ZUluZGVudGF0aW9uKG9wdGlvbnMsIGRlcHRoLCBmaXJzdExpbmUpIDogJycpICsgd3JpdGVJbnN0cnVjdGlvbihub2Rlc1tpXSwgb3B0aW9ucywgZGVwdGgpOyBicmVhaztcclxuICAgICAgICBjYXNlIG9wdGlvbnMuYXR0cmlidXRlc0tleTogY2FzZSBvcHRpb25zLnBhcmVudEtleTogYnJlYWs7IC8vIHNraXBcclxuICAgICAgICBjYXNlIG9wdGlvbnMudGV4dEtleTogeG1sICs9IChvcHRpb25zLmluZGVudFRleHQgPyB3cml0ZUluZGVudGF0aW9uKG9wdGlvbnMsIGRlcHRoLCBmaXJzdExpbmUpIDogJycpICsgd3JpdGVUZXh0KG5vZGVzW2ldLCBvcHRpb25zKTsgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBvcHRpb25zLmNkYXRhS2V5OiB4bWwgKz0gKG9wdGlvbnMuaW5kZW50Q2RhdGEgPyB3cml0ZUluZGVudGF0aW9uKG9wdGlvbnMsIGRlcHRoLCBmaXJzdExpbmUpIDogJycpICsgd3JpdGVDZGF0YShub2Rlc1tpXSwgb3B0aW9ucyk7IGJyZWFrO1xyXG4gICAgICAgIGNhc2Ugb3B0aW9ucy5kb2N0eXBlS2V5OiB4bWwgKz0gd3JpdGVJbmRlbnRhdGlvbihvcHRpb25zLCBkZXB0aCwgZmlyc3RMaW5lKSArIHdyaXRlRG9jdHlwZShub2Rlc1tpXSwgb3B0aW9ucyk7IGJyZWFrO1xyXG4gICAgICAgIGNhc2Ugb3B0aW9ucy5jb21tZW50S2V5OiB4bWwgKz0gd3JpdGVJbmRlbnRhdGlvbihvcHRpb25zLCBkZXB0aCwgZmlyc3RMaW5lKSArIHdyaXRlQ29tbWVudChub2Rlc1tpXSwgb3B0aW9ucyk7IGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6IHhtbCArPSB3cml0ZUluZGVudGF0aW9uKG9wdGlvbnMsIGRlcHRoLCBmaXJzdExpbmUpICsgd3JpdGVFbGVtZW50Q29tcGFjdChub2Rlc1tpXSwga2V5LCBvcHRpb25zLCBkZXB0aCwgaGFzQ29udGVudENvbXBhY3Qobm9kZXNbaV0sIG9wdGlvbnMpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmlyc3RMaW5lID0gZmlyc3RMaW5lICYmICF4bWw7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHhtbDtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoanMsIG9wdGlvbnMpIHtcclxuICBvcHRpb25zID0gdmFsaWRhdGVPcHRpb25zKG9wdGlvbnMpO1xyXG4gIHZhciB4bWwgPSAnJztcclxuICBjdXJyZW50RWxlbWVudCA9IGpzO1xyXG4gIGN1cnJlbnRFbGVtZW50TmFtZSA9ICdfcm9vdF8nO1xyXG4gIGlmIChvcHRpb25zLmNvbXBhY3QpIHtcclxuICAgIHhtbCA9IHdyaXRlRWxlbWVudHNDb21wYWN0KGpzLCBvcHRpb25zLCAwLCB0cnVlKTtcclxuICB9IGVsc2Uge1xyXG4gICAgaWYgKGpzW29wdGlvbnMuZGVjbGFyYXRpb25LZXldKSB7XHJcbiAgICAgIHhtbCArPSB3cml0ZURlY2xhcmF0aW9uKGpzW29wdGlvbnMuZGVjbGFyYXRpb25LZXldLCBvcHRpb25zLCAwKTtcclxuICAgIH1cclxuICAgIGlmIChqc1tvcHRpb25zLmVsZW1lbnRzS2V5XSAmJiBqc1tvcHRpb25zLmVsZW1lbnRzS2V5XS5sZW5ndGgpIHtcclxuICAgICAgeG1sICs9IHdyaXRlRWxlbWVudHMoanNbb3B0aW9ucy5lbGVtZW50c0tleV0sIG9wdGlvbnMsIDAsICF4bWwpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4geG1sO1xyXG59O1xyXG4iLCJ2YXIganMyeG1sID0gcmVxdWlyZSgnLi9qczJ4bWwuanMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoanNvbiwgb3B0aW9ucykge1xuICBpZiAoanNvbiBpbnN0YW5jZW9mIEJ1ZmZlcikge1xuICAgIGpzb24gPSBqc29uLnRvU3RyaW5nKCk7XG4gIH1cbiAgdmFyIGpzID0gbnVsbDtcbiAgaWYgKHR5cGVvZiAoanNvbikgPT09ICdzdHJpbmcnKSB7XG4gICAgdHJ5IHtcbiAgICAgIGpzID0gSlNPTi5wYXJzZShqc29uKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBKU09OIHN0cnVjdHVyZSBpcyBpbnZhbGlkJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGpzID0ganNvbjtcbiAgfVxuICByZXR1cm4ganMyeG1sKGpzLCBvcHRpb25zKTtcbn07XG4iLCIvKmpzbGludCBub2RlOnRydWUgKi9cblxudmFyIHhtbDJqcyA9IHJlcXVpcmUoJy4veG1sMmpzJyk7XG52YXIgeG1sMmpzb24gPSByZXF1aXJlKCcuL3htbDJqc29uJyk7XG52YXIganMyeG1sID0gcmVxdWlyZSgnLi9qczJ4bWwnKTtcbnZhciBqc29uMnhtbCA9IHJlcXVpcmUoJy4vanNvbjJ4bWwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHhtbDJqczogeG1sMmpzLFxuICB4bWwyanNvbjogeG1sMmpzb24sXG4gIGpzMnhtbDoganMyeG1sLFxuICBqc29uMnhtbDoganNvbjJ4bWxcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG4vLyBAZmxvd1xuXG4vKjo6IGltcG9ydCB0eXBlIHtcbiAgQ29tYmluYXRvclRva2VuVHlwZSxcbiAgU2VsZWN0b3JUb2tlblR5cGVcbn0gZnJvbSAnLi90eXBlcyc7Ki9cblxuXG52YXIgZXNjYXBlVmFsdWUgPSBmdW5jdGlvbiBlc2NhcGVWYWx1ZSh2YWx1ZSAvKjogc3RyaW5nKi8pIC8qOiBzdHJpbmcqLyB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG59O1xuXG52YXIgcmVuZGVyU2VsZWN0b3IgPSBmdW5jdGlvbiByZW5kZXJTZWxlY3RvcihzZWxlY3RvclRva2VuIC8qOiBTZWxlY3RvclRva2VuVHlwZSovKSB7XG4gIHZhciB0b2tlbnMgPSBzZWxlY3RvclRva2VuLmJvZHk7XG4gIHZhciBwYXJ0cyA9IFtdO1xuXG4gIHZhciBfaXRlcmF0b3JOb3JtYWxDb21wbGV0aW9uID0gdHJ1ZTtcbiAgdmFyIF9kaWRJdGVyYXRvckVycm9yID0gZmFsc2U7XG4gIHZhciBfaXRlcmF0b3JFcnJvciA9IHVuZGVmaW5lZDtcblxuICB0cnkge1xuICAgIGZvciAodmFyIF9pdGVyYXRvciA9IHRva2Vuc1tTeW1ib2wuaXRlcmF0b3JdKCksIF9zdGVwOyAhKF9pdGVyYXRvck5vcm1hbENvbXBsZXRpb24gPSAoX3N0ZXAgPSBfaXRlcmF0b3IubmV4dCgpKS5kb25lKTsgX2l0ZXJhdG9yTm9ybWFsQ29tcGxldGlvbiA9IHRydWUpIHtcbiAgICAgIHZhciB0b2tlbiA9IF9zdGVwLnZhbHVlO1xuXG4gICAgICB2YXIgcGFydCA9IHZvaWQgMDtcblxuICAgICAgaWYgKHRva2VuLnR5cGUgPT09ICd1bml2ZXJzYWxTZWxlY3RvcicpIHtcbiAgICAgICAgcGFydCA9ICcqJztcbiAgICAgIH0gZWxzZSBpZiAodG9rZW4udHlwZSA9PT0gJ3R5cGVTZWxlY3RvcicpIHtcbiAgICAgICAgcGFydCA9IHRva2VuLm5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuLnR5cGUgPT09ICdpZFNlbGVjdG9yJykge1xuICAgICAgICBwYXJ0ID0gJyMnICsgdG9rZW4ubmFtZTtcbiAgICAgIH0gZWxzZSBpZiAodG9rZW4udHlwZSA9PT0gJ2NsYXNzU2VsZWN0b3InKSB7XG4gICAgICAgIHBhcnQgPSAnLicgKyB0b2tlbi5uYW1lO1xuICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAnYXR0cmlidXRlUHJlc2VuY2VTZWxlY3RvcicpIHtcbiAgICAgICAgcGFydCA9ICdbJyArIHRva2VuLm5hbWUgKyAnXSc7XG4gICAgICB9IGVsc2UgaWYgKHRva2VuLnR5cGUgPT09ICdhdHRyaWJ1dGVWYWx1ZVNlbGVjdG9yJykge1xuICAgICAgICBwYXJ0ID0gJ1snICsgdG9rZW4ubmFtZSArIHRva2VuLm9wZXJhdG9yICsgZXNjYXBlVmFsdWUodG9rZW4udmFsdWUpICsgJ10nO1xuICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAncHNldWRvQ2xhc3NTZWxlY3RvcicpIHtcbiAgICAgICAgcGFydCA9ICc6JyArIHRva2VuLm5hbWU7XG5cbiAgICAgICAgaWYgKHRva2VuLnBhcmFtZXRlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgcGFydCArPSAnKCcgKyB0b2tlbi5wYXJhbWV0ZXJzLm1hcChlc2NhcGVWYWx1ZSkuam9pbignLCAnKSArICcpJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAncHNldWRvRWxlbWVudFNlbGVjdG9yJykge1xuICAgICAgICBwYXJ0ID0gJzo6JyArIHRva2VuLm5hbWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gdG9rZW4uJyk7XG4gICAgICB9XG5cbiAgICAgIHBhcnRzLnB1c2gocGFydCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBfZGlkSXRlcmF0b3JFcnJvciA9IHRydWU7XG4gICAgX2l0ZXJhdG9yRXJyb3IgPSBlcnI7XG4gIH0gZmluYWxseSB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICghX2l0ZXJhdG9yTm9ybWFsQ29tcGxldGlvbiAmJiBfaXRlcmF0b3IucmV0dXJuKSB7XG4gICAgICAgIF9pdGVyYXRvci5yZXR1cm4oKTtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgaWYgKF9kaWRJdGVyYXRvckVycm9yKSB7XG4gICAgICAgIHRocm93IF9pdGVyYXRvckVycm9yO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKTtcbn07XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGdlbmVyYXRlID0gZnVuY3Rpb24gZ2VuZXJhdGUodG9rZW5zIC8qOiBBcnJheTxTZWxlY3RvclRva2VuVHlwZSB8IENvbWJpbmF0b3JUb2tlblR5cGU+Ki8pIC8qOiBzdHJpbmcqLyB7XG4gICAgLyoqXG4gICAgICogQHRvZG8gVGhpbmsgb2YgYSBiZXR0ZXIgbmFtZS4gVGhpcyBhcnJheSBjb250YWlucyBzZWxlY3RvcnMgb3IgY29tYmluYXRvcnMuXG4gICAgICovXG4gICAgdmFyIHNlcXVlbmNlcyAvKjogQXJyYXk8c3RyaW5nPiovID0gW107XG5cbiAgICB2YXIgX2l0ZXJhdG9yTm9ybWFsQ29tcGxldGlvbjIgPSB0cnVlO1xuICAgIHZhciBfZGlkSXRlcmF0b3JFcnJvcjIgPSBmYWxzZTtcbiAgICB2YXIgX2l0ZXJhdG9yRXJyb3IyID0gdW5kZWZpbmVkO1xuXG4gICAgdHJ5IHtcbiAgICAgIGZvciAodmFyIF9pdGVyYXRvcjIgPSB0b2tlbnNbU3ltYm9sLml0ZXJhdG9yXSgpLCBfc3RlcDI7ICEoX2l0ZXJhdG9yTm9ybWFsQ29tcGxldGlvbjIgPSAoX3N0ZXAyID0gX2l0ZXJhdG9yMi5uZXh0KCkpLmRvbmUpOyBfaXRlcmF0b3JOb3JtYWxDb21wbGV0aW9uMiA9IHRydWUpIHtcbiAgICAgICAgdmFyIHRva2VuID0gX3N0ZXAyLnZhbHVlO1xuXG4gICAgICAgIGlmICh0b2tlbi50eXBlID09PSAnc2VsZWN0b3InKSB7XG4gICAgICAgICAgc2VxdWVuY2VzLnB1c2gocmVuZGVyU2VsZWN0b3IodG9rZW4pKTtcbiAgICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAnZGVzY2VuZGFudENvbWJpbmF0b3InKSB7XG4gICAgICAgICAgc2VxdWVuY2VzLnB1c2goJyAnKTtcbiAgICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAnY2hpbGRDb21iaW5hdG9yJykge1xuICAgICAgICAgIHNlcXVlbmNlcy5wdXNoKCcgPiAnKTtcbiAgICAgICAgfSBlbHNlIGlmICh0b2tlbi50eXBlID09PSAnYWRqYWNlbnRTaWJsaW5nQ29tYmluYXRvcicpIHtcbiAgICAgICAgICBzZXF1ZW5jZXMucHVzaCgnICsgJyk7XG4gICAgICAgIH0gZWxzZSBpZiAodG9rZW4udHlwZSA9PT0gJ2dlbmVyYWxTaWJsaW5nQ29tYmluYXRvcicpIHtcbiAgICAgICAgICBzZXF1ZW5jZXMucHVzaCgnIH4gJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHRva2VuLicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBfZGlkSXRlcmF0b3JFcnJvcjIgPSB0cnVlO1xuICAgICAgX2l0ZXJhdG9yRXJyb3IyID0gZXJyO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoIV9pdGVyYXRvck5vcm1hbENvbXBsZXRpb24yICYmIF9pdGVyYXRvcjIucmV0dXJuKSB7XG4gICAgICAgICAgX2l0ZXJhdG9yMi5yZXR1cm4oKTtcbiAgICAgICAgfVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKF9kaWRJdGVyYXRvckVycm9yMikge1xuICAgICAgICAgIHRocm93IF9pdGVyYXRvckVycm9yMjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzZXF1ZW5jZXMuam9pbignJyk7XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBnZW5lcmF0ZVxuICB9O1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNyZWF0ZUdlbmVyYXRvci5qcy5tYXAiLCIoZnVuY3Rpb24ocm9vdCwgZmFjdG9yeSkge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByb290Lm5lYXJsZXkgPSBmYWN0b3J5KCk7XG4gICAgfVxufSh0aGlzLCBmdW5jdGlvbigpIHtcblxuZnVuY3Rpb24gUnVsZShuYW1lLCBzeW1ib2xzLCBwb3N0cHJvY2Vzcykge1xuICAgIHRoaXMuaWQgPSArK1J1bGUuaGlnaGVzdElkO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5zeW1ib2xzID0gc3ltYm9sczsgICAgICAgIC8vIGEgbGlzdCBvZiBsaXRlcmFsIHwgcmVnZXggY2xhc3MgfCBub250ZXJtaW5hbFxuICAgIHRoaXMucG9zdHByb2Nlc3MgPSBwb3N0cHJvY2VzcztcbiAgICByZXR1cm4gdGhpcztcbn1cblJ1bGUuaGlnaGVzdElkID0gMDtcblxuUnVsZS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbih3aXRoQ3Vyc29yQXQpIHtcbiAgICBmdW5jdGlvbiBzdHJpbmdpZnlTeW1ib2xTZXF1ZW5jZSAoZSkge1xuICAgICAgICByZXR1cm4gZS5saXRlcmFsID8gSlNPTi5zdHJpbmdpZnkoZS5saXRlcmFsKSA6XG4gICAgICAgICAgICAgICBlLnR5cGUgPyAnJScgKyBlLnR5cGUgOiBlLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIHZhciBzeW1ib2xTZXF1ZW5jZSA9ICh0eXBlb2Ygd2l0aEN1cnNvckF0ID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgID8gdGhpcy5zeW1ib2xzLm1hcChzdHJpbmdpZnlTeW1ib2xTZXF1ZW5jZSkuam9pbignICcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgOiAoICAgdGhpcy5zeW1ib2xzLnNsaWNlKDAsIHdpdGhDdXJzb3JBdCkubWFwKHN0cmluZ2lmeVN5bWJvbFNlcXVlbmNlKS5qb2luKCcgJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyBcIiDil48gXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyB0aGlzLnN5bWJvbHMuc2xpY2Uod2l0aEN1cnNvckF0KS5tYXAoc3RyaW5naWZ5U3ltYm9sU2VxdWVuY2UpLmpvaW4oJyAnKSAgICAgKTtcbiAgICByZXR1cm4gdGhpcy5uYW1lICsgXCIg4oaSIFwiICsgc3ltYm9sU2VxdWVuY2U7XG59XG5cblxuLy8gYSBTdGF0ZSBpcyBhIHJ1bGUgYXQgYSBwb3NpdGlvbiBmcm9tIGEgZ2l2ZW4gc3RhcnRpbmcgcG9pbnQgaW4gdGhlIGlucHV0IHN0cmVhbSAocmVmZXJlbmNlKVxuZnVuY3Rpb24gU3RhdGUocnVsZSwgZG90LCByZWZlcmVuY2UsIHdhbnRlZEJ5KSB7XG4gICAgdGhpcy5ydWxlID0gcnVsZTtcbiAgICB0aGlzLmRvdCA9IGRvdDtcbiAgICB0aGlzLnJlZmVyZW5jZSA9IHJlZmVyZW5jZTtcbiAgICB0aGlzLmRhdGEgPSBbXTtcbiAgICB0aGlzLndhbnRlZEJ5ID0gd2FudGVkQnk7XG4gICAgdGhpcy5pc0NvbXBsZXRlID0gdGhpcy5kb3QgPT09IHJ1bGUuc3ltYm9scy5sZW5ndGg7XG59XG5cblN0YXRlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBcIntcIiArIHRoaXMucnVsZS50b1N0cmluZyh0aGlzLmRvdCkgKyBcIn0sIGZyb206IFwiICsgKHRoaXMucmVmZXJlbmNlIHx8IDApO1xufTtcblxuU3RhdGUucHJvdG90eXBlLm5leHRTdGF0ZSA9IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgdmFyIHN0YXRlID0gbmV3IFN0YXRlKHRoaXMucnVsZSwgdGhpcy5kb3QgKyAxLCB0aGlzLnJlZmVyZW5jZSwgdGhpcy53YW50ZWRCeSk7XG4gICAgc3RhdGUubGVmdCA9IHRoaXM7XG4gICAgc3RhdGUucmlnaHQgPSBjaGlsZDtcbiAgICBpZiAoc3RhdGUuaXNDb21wbGV0ZSkge1xuICAgICAgICBzdGF0ZS5kYXRhID0gc3RhdGUuYnVpbGQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN0YXRlO1xufTtcblxuU3RhdGUucHJvdG90eXBlLmJ1aWxkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gW107XG4gICAgdmFyIG5vZGUgPSB0aGlzO1xuICAgIGRvIHtcbiAgICAgICAgY2hpbGRyZW4ucHVzaChub2RlLnJpZ2h0LmRhdGEpO1xuICAgICAgICBub2RlID0gbm9kZS5sZWZ0O1xuICAgIH0gd2hpbGUgKG5vZGUubGVmdCk7XG4gICAgY2hpbGRyZW4ucmV2ZXJzZSgpO1xuICAgIHJldHVybiBjaGlsZHJlbjtcbn07XG5cblN0YXRlLnByb3RvdHlwZS5maW5pc2ggPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5ydWxlLnBvc3Rwcm9jZXNzKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IHRoaXMucnVsZS5wb3N0cHJvY2Vzcyh0aGlzLmRhdGEsIHRoaXMucmVmZXJlbmNlLCBQYXJzZXIuZmFpbCk7XG4gICAgfVxufTtcblxuXG5mdW5jdGlvbiBDb2x1bW4oZ3JhbW1hciwgaW5kZXgpIHtcbiAgICB0aGlzLmdyYW1tYXIgPSBncmFtbWFyO1xuICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICB0aGlzLnN0YXRlcyA9IFtdO1xuICAgIHRoaXMud2FudHMgPSB7fTsgLy8gc3RhdGVzIGluZGV4ZWQgYnkgdGhlIG5vbi10ZXJtaW5hbCB0aGV5IGV4cGVjdFxuICAgIHRoaXMuc2Nhbm5hYmxlID0gW107IC8vIGxpc3Qgb2Ygc3RhdGVzIHRoYXQgZXhwZWN0IGEgdG9rZW5cbiAgICB0aGlzLmNvbXBsZXRlZCA9IHt9OyAvLyBzdGF0ZXMgdGhhdCBhcmUgbnVsbGFibGVcbn1cblxuXG5Db2x1bW4ucHJvdG90eXBlLnByb2Nlc3MgPSBmdW5jdGlvbihuZXh0Q29sdW1uKSB7XG4gICAgdmFyIHN0YXRlcyA9IHRoaXMuc3RhdGVzO1xuICAgIHZhciB3YW50cyA9IHRoaXMud2FudHM7XG4gICAgdmFyIGNvbXBsZXRlZCA9IHRoaXMuY29tcGxldGVkO1xuXG4gICAgZm9yICh2YXIgdyA9IDA7IHcgPCBzdGF0ZXMubGVuZ3RoOyB3KyspIHsgLy8gbmIuIHdlIHB1c2goKSBkdXJpbmcgaXRlcmF0aW9uXG4gICAgICAgIHZhciBzdGF0ZSA9IHN0YXRlc1t3XTtcblxuICAgICAgICBpZiAoc3RhdGUuaXNDb21wbGV0ZSkge1xuICAgICAgICAgICAgc3RhdGUuZmluaXNoKCk7XG4gICAgICAgICAgICBpZiAoc3RhdGUuZGF0YSAhPT0gUGFyc2VyLmZhaWwpIHtcbiAgICAgICAgICAgICAgICAvLyBjb21wbGV0ZVxuICAgICAgICAgICAgICAgIHZhciB3YW50ZWRCeSA9IHN0YXRlLndhbnRlZEJ5O1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSB3YW50ZWRCeS5sZW5ndGg7IGktLTsgKSB7IC8vIHRoaXMgbGluZSBpcyBob3RcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxlZnQgPSB3YW50ZWRCeVtpXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21wbGV0ZShsZWZ0LCBzdGF0ZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc3BlY2lhbC1jYXNlIG51bGxhYmxlc1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZS5yZWZlcmVuY2UgPT09IHRoaXMuaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbWFrZSBzdXJlIGZ1dHVyZSBwcmVkaWN0b3JzIG9mIHRoaXMgcnVsZSBnZXQgY29tcGxldGVkLlxuICAgICAgICAgICAgICAgICAgICB2YXIgZXhwID0gc3RhdGUucnVsZS5uYW1lO1xuICAgICAgICAgICAgICAgICAgICAodGhpcy5jb21wbGV0ZWRbZXhwXSA9IHRoaXMuY29tcGxldGVkW2V4cF0gfHwgW10pLnB1c2goc3RhdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcXVldWUgc2Nhbm5hYmxlIHN0YXRlc1xuICAgICAgICAgICAgdmFyIGV4cCA9IHN0YXRlLnJ1bGUuc3ltYm9sc1tzdGF0ZS5kb3RdO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHAgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zY2FubmFibGUucHVzaChzdGF0ZSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHByZWRpY3RcbiAgICAgICAgICAgIGlmICh3YW50c1tleHBdKSB7XG4gICAgICAgICAgICAgICAgd2FudHNbZXhwXS5wdXNoKHN0YXRlKTtcblxuICAgICAgICAgICAgICAgIGlmIChjb21wbGV0ZWQuaGFzT3duUHJvcGVydHkoZXhwKSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgbnVsbHMgPSBjb21wbGV0ZWRbZXhwXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHJpZ2h0ID0gbnVsbHNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbXBsZXRlKHN0YXRlLCByaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHdhbnRzW2V4cF0gPSBbc3RhdGVdO1xuICAgICAgICAgICAgICAgIHRoaXMucHJlZGljdChleHApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5Db2x1bW4ucHJvdG90eXBlLnByZWRpY3QgPSBmdW5jdGlvbihleHApIHtcbiAgICB2YXIgcnVsZXMgPSB0aGlzLmdyYW1tYXIuYnlOYW1lW2V4cF0gfHwgW107XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciByID0gcnVsZXNbaV07XG4gICAgICAgIHZhciB3YW50ZWRCeSA9IHRoaXMud2FudHNbZXhwXTtcbiAgICAgICAgdmFyIHMgPSBuZXcgU3RhdGUociwgMCwgdGhpcy5pbmRleCwgd2FudGVkQnkpO1xuICAgICAgICB0aGlzLnN0YXRlcy5wdXNoKHMpO1xuICAgIH1cbn1cblxuQ29sdW1uLnByb3RvdHlwZS5jb21wbGV0ZSA9IGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgdmFyIGlucCA9IHJpZ2h0LnJ1bGUubmFtZTtcbiAgICBpZiAobGVmdC5ydWxlLnN5bWJvbHNbbGVmdC5kb3RdID09PSBpbnApIHtcbiAgICAgICAgdmFyIGNvcHkgPSBsZWZ0Lm5leHRTdGF0ZShyaWdodCk7XG4gICAgICAgIHRoaXMuc3RhdGVzLnB1c2goY29weSk7XG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIEdyYW1tYXIocnVsZXMsIHN0YXJ0KSB7XG4gICAgdGhpcy5ydWxlcyA9IHJ1bGVzO1xuICAgIHRoaXMuc3RhcnQgPSBzdGFydCB8fCB0aGlzLnJ1bGVzWzBdLm5hbWU7XG4gICAgdmFyIGJ5TmFtZSA9IHRoaXMuYnlOYW1lID0ge307XG4gICAgdGhpcy5ydWxlcy5mb3JFYWNoKGZ1bmN0aW9uKHJ1bGUpIHtcbiAgICAgICAgaWYgKCFieU5hbWUuaGFzT3duUHJvcGVydHkocnVsZS5uYW1lKSkge1xuICAgICAgICAgICAgYnlOYW1lW3J1bGUubmFtZV0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBieU5hbWVbcnVsZS5uYW1lXS5wdXNoKHJ1bGUpO1xuICAgIH0pO1xufVxuXG4vLyBTbyB3ZSBjYW4gYWxsb3cgcGFzc2luZyAocnVsZXMsIHN0YXJ0KSBkaXJlY3RseSB0byBQYXJzZXIgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG5HcmFtbWFyLmZyb21Db21waWxlZCA9IGZ1bmN0aW9uKHJ1bGVzLCBzdGFydCkge1xuICAgIHZhciBsZXhlciA9IHJ1bGVzLkxleGVyO1xuICAgIGlmIChydWxlcy5QYXJzZXJTdGFydCkge1xuICAgICAgc3RhcnQgPSBydWxlcy5QYXJzZXJTdGFydDtcbiAgICAgIHJ1bGVzID0gcnVsZXMuUGFyc2VyUnVsZXM7XG4gICAgfVxuICAgIHZhciBydWxlcyA9IHJ1bGVzLm1hcChmdW5jdGlvbiAocikgeyByZXR1cm4gKG5ldyBSdWxlKHIubmFtZSwgci5zeW1ib2xzLCByLnBvc3Rwcm9jZXNzKSk7IH0pO1xuICAgIHZhciBnID0gbmV3IEdyYW1tYXIocnVsZXMsIHN0YXJ0KTtcbiAgICBnLmxleGVyID0gbGV4ZXI7IC8vIG5iLiBzdG9yaW5nIGxleGVyIG9uIEdyYW1tYXIgaXMgaWZmeSwgYnV0IHVuYXZvaWRhYmxlXG4gICAgcmV0dXJuIGc7XG59XG5cblxuZnVuY3Rpb24gU3RyZWFtTGV4ZXIoKSB7XG4gIHRoaXMucmVzZXQoXCJcIik7XG59XG5cblN0cmVhbUxleGVyLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKGRhdGEsIHN0YXRlKSB7XG4gICAgdGhpcy5idWZmZXIgPSBkYXRhO1xuICAgIHRoaXMuaW5kZXggPSAwO1xuICAgIHRoaXMubGluZSA9IHN0YXRlID8gc3RhdGUubGluZSA6IDE7XG4gICAgdGhpcy5sYXN0TGluZUJyZWFrID0gc3RhdGUgPyAtc3RhdGUuY29sIDogMDtcbn1cblxuU3RyZWFtTGV4ZXIucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5pbmRleCA8IHRoaXMuYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICB2YXIgY2ggPSB0aGlzLmJ1ZmZlclt0aGlzLmluZGV4KytdO1xuICAgICAgICBpZiAoY2ggPT09ICdcXG4nKSB7XG4gICAgICAgICAgdGhpcy5saW5lICs9IDE7XG4gICAgICAgICAgdGhpcy5sYXN0TGluZUJyZWFrID0gdGhpcy5pbmRleDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge3ZhbHVlOiBjaH07XG4gICAgfVxufVxuXG5TdHJlYW1MZXhlci5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIGxpbmU6IHRoaXMubGluZSxcbiAgICBjb2w6IHRoaXMuaW5kZXggLSB0aGlzLmxhc3RMaW5lQnJlYWssXG4gIH1cbn1cblxuU3RyZWFtTGV4ZXIucHJvdG90eXBlLmZvcm1hdEVycm9yID0gZnVuY3Rpb24odG9rZW4sIG1lc3NhZ2UpIHtcbiAgICAvLyBuYi4gdGhpcyBnZXRzIGNhbGxlZCBhZnRlciBjb25zdW1pbmcgdGhlIG9mZmVuZGluZyB0b2tlbixcbiAgICAvLyBzbyB0aGUgY3VscHJpdCBpcyBpbmRleC0xXG4gICAgdmFyIGJ1ZmZlciA9IHRoaXMuYnVmZmVyO1xuICAgIGlmICh0eXBlb2YgYnVmZmVyID09PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgbmV4dExpbmVCcmVhayA9IGJ1ZmZlci5pbmRleE9mKCdcXG4nLCB0aGlzLmluZGV4KTtcbiAgICAgICAgaWYgKG5leHRMaW5lQnJlYWsgPT09IC0xKSBuZXh0TGluZUJyZWFrID0gYnVmZmVyLmxlbmd0aDtcbiAgICAgICAgdmFyIGxpbmUgPSBidWZmZXIuc3Vic3RyaW5nKHRoaXMubGFzdExpbmVCcmVhaywgbmV4dExpbmVCcmVhaylcbiAgICAgICAgdmFyIGNvbCA9IHRoaXMuaW5kZXggLSB0aGlzLmxhc3RMaW5lQnJlYWs7XG4gICAgICAgIG1lc3NhZ2UgKz0gXCIgYXQgbGluZSBcIiArIHRoaXMubGluZSArIFwiIGNvbCBcIiArIGNvbCArIFwiOlxcblxcblwiO1xuICAgICAgICBtZXNzYWdlICs9IFwiICBcIiArIGxpbmUgKyBcIlxcblwiXG4gICAgICAgIG1lc3NhZ2UgKz0gXCIgIFwiICsgQXJyYXkoY29sKS5qb2luKFwiIFwiKSArIFwiXlwiXG4gICAgICAgIHJldHVybiBtZXNzYWdlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBtZXNzYWdlICsgXCIgYXQgaW5kZXggXCIgKyAodGhpcy5pbmRleCAtIDEpO1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBQYXJzZXIocnVsZXMsIHN0YXJ0LCBvcHRpb25zKSB7XG4gICAgaWYgKHJ1bGVzIGluc3RhbmNlb2YgR3JhbW1hcikge1xuICAgICAgICB2YXIgZ3JhbW1hciA9IHJ1bGVzO1xuICAgICAgICB2YXIgb3B0aW9ucyA9IHN0YXJ0O1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBncmFtbWFyID0gR3JhbW1hci5mcm9tQ29tcGlsZWQocnVsZXMsIHN0YXJ0KTtcbiAgICB9XG4gICAgdGhpcy5ncmFtbWFyID0gZ3JhbW1hcjtcblxuICAgIC8vIFJlYWQgb3B0aW9uc1xuICAgIHRoaXMub3B0aW9ucyA9IHtcbiAgICAgICAga2VlcEhpc3Rvcnk6IGZhbHNlLFxuICAgICAgICBsZXhlcjogZ3JhbW1hci5sZXhlciB8fCBuZXcgU3RyZWFtTGV4ZXIsXG4gICAgfTtcbiAgICBmb3IgKHZhciBrZXkgaW4gKG9wdGlvbnMgfHwge30pKSB7XG4gICAgICAgIHRoaXMub3B0aW9uc1trZXldID0gb3B0aW9uc1trZXldO1xuICAgIH1cblxuICAgIC8vIFNldHVwIGxleGVyXG4gICAgdGhpcy5sZXhlciA9IHRoaXMub3B0aW9ucy5sZXhlcjtcbiAgICB0aGlzLmxleGVyU3RhdGUgPSB1bmRlZmluZWQ7XG5cbiAgICAvLyBTZXR1cCBhIHRhYmxlXG4gICAgdmFyIGNvbHVtbiA9IG5ldyBDb2x1bW4oZ3JhbW1hciwgMCk7XG4gICAgdmFyIHRhYmxlID0gdGhpcy50YWJsZSA9IFtjb2x1bW5dO1xuXG4gICAgLy8gSSBjb3VsZCBiZSBleHBlY3RpbmcgYW55dGhpbmcuXG4gICAgY29sdW1uLndhbnRzW2dyYW1tYXIuc3RhcnRdID0gW107XG4gICAgY29sdW1uLnByZWRpY3QoZ3JhbW1hci5zdGFydCk7XG4gICAgLy8gVE9ETyB3aGF0IGlmIHN0YXJ0IHJ1bGUgaXMgbnVsbGFibGU/XG4gICAgY29sdW1uLnByb2Nlc3MoKTtcbiAgICB0aGlzLmN1cnJlbnQgPSAwOyAvLyB0b2tlbiBpbmRleFxufVxuXG4vLyBjcmVhdGUgYSByZXNlcnZlZCB0b2tlbiBmb3IgaW5kaWNhdGluZyBhIHBhcnNlIGZhaWxcblBhcnNlci5mYWlsID0ge307XG5cblBhcnNlci5wcm90b3R5cGUuZmVlZCA9IGZ1bmN0aW9uKGNodW5rKSB7XG4gICAgdmFyIGxleGVyID0gdGhpcy5sZXhlcjtcbiAgICBsZXhlci5yZXNldChjaHVuaywgdGhpcy5sZXhlclN0YXRlKTtcblxuICAgIHZhciB0b2tlbjtcbiAgICB3aGlsZSAodG9rZW4gPSBsZXhlci5uZXh0KCkpIHtcbiAgICAgICAgLy8gV2UgYWRkIG5ldyBzdGF0ZXMgdG8gdGFibGVbY3VycmVudCsxXVxuICAgICAgICB2YXIgY29sdW1uID0gdGhpcy50YWJsZVt0aGlzLmN1cnJlbnRdO1xuXG4gICAgICAgIC8vIEdDIHVudXNlZCBzdGF0ZXNcbiAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMua2VlcEhpc3RvcnkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnRhYmxlW3RoaXMuY3VycmVudCAtIDFdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG4gPSB0aGlzLmN1cnJlbnQgKyAxO1xuICAgICAgICB2YXIgbmV4dENvbHVtbiA9IG5ldyBDb2x1bW4odGhpcy5ncmFtbWFyLCBuKTtcbiAgICAgICAgdGhpcy50YWJsZS5wdXNoKG5leHRDb2x1bW4pO1xuXG4gICAgICAgIC8vIEFkdmFuY2UgYWxsIHRva2VucyB0aGF0IGV4cGVjdCB0aGUgc3ltYm9sXG4gICAgICAgIHZhciBsaXRlcmFsID0gdG9rZW4udmFsdWU7XG4gICAgICAgIHZhciB2YWx1ZSA9IGxleGVyLmNvbnN0cnVjdG9yID09PSBTdHJlYW1MZXhlciA/IHRva2VuLnZhbHVlIDogdG9rZW47XG4gICAgICAgIHZhciBzY2FubmFibGUgPSBjb2x1bW4uc2Nhbm5hYmxlO1xuICAgICAgICBmb3IgKHZhciB3ID0gc2Nhbm5hYmxlLmxlbmd0aDsgdy0tOyApIHtcbiAgICAgICAgICAgIHZhciBzdGF0ZSA9IHNjYW5uYWJsZVt3XTtcbiAgICAgICAgICAgIHZhciBleHBlY3QgPSBzdGF0ZS5ydWxlLnN5bWJvbHNbc3RhdGUuZG90XTtcbiAgICAgICAgICAgIC8vIFRyeSB0byBjb25zdW1lIHRoZSB0b2tlblxuICAgICAgICAgICAgLy8gZWl0aGVyIHJlZ2V4IG9yIGxpdGVyYWxcbiAgICAgICAgICAgIGlmIChleHBlY3QudGVzdCA/IGV4cGVjdC50ZXN0KHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgZXhwZWN0LnR5cGUgPyBleHBlY3QudHlwZSA9PT0gdG9rZW4udHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogZXhwZWN0LmxpdGVyYWwgPT09IGxpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgaXRcbiAgICAgICAgICAgICAgICB2YXIgbmV4dCA9IHN0YXRlLm5leHRTdGF0ZSh7ZGF0YTogdmFsdWUsIHRva2VuOiB0b2tlbiwgaXNUb2tlbjogdHJ1ZSwgcmVmZXJlbmNlOiBuIC0gMX0pO1xuICAgICAgICAgICAgICAgIG5leHRDb2x1bW4uc3RhdGVzLnB1c2gobmV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOZXh0LCBmb3IgZWFjaCBvZiB0aGUgcnVsZXMsIHdlIGVpdGhlclxuICAgICAgICAvLyAoYSkgY29tcGxldGUgaXQsIGFuZCB0cnkgdG8gc2VlIGlmIHRoZSByZWZlcmVuY2Ugcm93IGV4cGVjdGVkIHRoYXRcbiAgICAgICAgLy8gICAgIHJ1bGVcbiAgICAgICAgLy8gKGIpIHByZWRpY3QgdGhlIG5leHQgbm9udGVybWluYWwgaXQgZXhwZWN0cyBieSBhZGRpbmcgdGhhdFxuICAgICAgICAvLyAgICAgbm9udGVybWluYWwncyBzdGFydCBzdGF0ZVxuICAgICAgICAvLyBUbyBwcmV2ZW50IGR1cGxpY2F0aW9uLCB3ZSBhbHNvIGtlZXAgdHJhY2sgb2YgcnVsZXMgd2UgaGF2ZSBhbHJlYWR5XG4gICAgICAgIC8vIGFkZGVkXG5cbiAgICAgICAgbmV4dENvbHVtbi5wcm9jZXNzKCk7XG5cbiAgICAgICAgLy8gSWYgbmVlZGVkLCB0aHJvdyBhbiBlcnJvcjpcbiAgICAgICAgaWYgKG5leHRDb2x1bW4uc3RhdGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgLy8gTm8gc3RhdGVzIGF0IGFsbCEgVGhpcyBpcyBub3QgZ29vZC5cbiAgICAgICAgICAgIHZhciBtZXNzYWdlID0gdGhpcy5sZXhlci5mb3JtYXRFcnJvcih0b2tlbiwgXCJpbnZhbGlkIHN5bnRheFwiKSArIFwiXFxuXCI7XG4gICAgICAgICAgICBtZXNzYWdlICs9IFwiVW5leHBlY3RlZCBcIiArICh0b2tlbi50eXBlID8gdG9rZW4udHlwZSArIFwiIHRva2VuOiBcIiA6IFwiXCIpO1xuICAgICAgICAgICAgbWVzc2FnZSArPSBKU09OLnN0cmluZ2lmeSh0b2tlbi52YWx1ZSAhPT0gdW5kZWZpbmVkID8gdG9rZW4udmFsdWUgOiB0b2tlbikgKyBcIlxcblwiO1xuICAgICAgICAgICAgdmFyIGVyciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIGVyci5vZmZzZXQgPSB0aGlzLmN1cnJlbnQ7XG4gICAgICAgICAgICBlcnIudG9rZW4gPSB0b2tlbjtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1heWJlIHNhdmUgbGV4ZXIgc3RhdGVcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5rZWVwSGlzdG9yeSkge1xuICAgICAgICAgIGNvbHVtbi5sZXhlclN0YXRlID0gbGV4ZXIuc2F2ZSgpXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmN1cnJlbnQrKztcbiAgICB9XG4gICAgaWYgKGNvbHVtbikge1xuICAgICAgdGhpcy5sZXhlclN0YXRlID0gbGV4ZXIuc2F2ZSgpXG4gICAgfVxuXG4gICAgLy8gSW5jcmVtZW50YWxseSBrZWVwIHRyYWNrIG9mIHJlc3VsdHNcbiAgICB0aGlzLnJlc3VsdHMgPSB0aGlzLmZpbmlzaCgpO1xuXG4gICAgLy8gQWxsb3cgY2hhaW5pbmcsIGZvciB3aGF0ZXZlciBpdCdzIHdvcnRoXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgY29sdW1uID0gdGhpcy50YWJsZVt0aGlzLmN1cnJlbnRdO1xuICAgIGNvbHVtbi5sZXhlclN0YXRlID0gdGhpcy5sZXhlclN0YXRlO1xuICAgIHJldHVybiBjb2x1bW47XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLnJlc3RvcmUgPSBmdW5jdGlvbihjb2x1bW4pIHtcbiAgICB2YXIgaW5kZXggPSBjb2x1bW4uaW5kZXg7XG4gICAgdGhpcy5jdXJyZW50ID0gaW5kZXg7XG4gICAgdGhpcy50YWJsZVtpbmRleF0gPSBjb2x1bW47XG4gICAgdGhpcy50YWJsZS5zcGxpY2UoaW5kZXggKyAxKTtcbiAgICB0aGlzLmxleGVyU3RhdGUgPSBjb2x1bW4ubGV4ZXJTdGF0ZTtcblxuICAgIC8vIEluY3JlbWVudGFsbHkga2VlcCB0cmFjayBvZiByZXN1bHRzXG4gICAgdGhpcy5yZXN1bHRzID0gdGhpcy5maW5pc2goKTtcbn07XG5cbi8vIG5iLiBkZXByZWNhdGVkOiB1c2Ugc2F2ZS9yZXN0b3JlIGluc3RlYWQhXG5QYXJzZXIucHJvdG90eXBlLnJld2luZCA9IGZ1bmN0aW9uKGluZGV4KSB7XG4gICAgaWYgKCF0aGlzLm9wdGlvbnMua2VlcEhpc3RvcnkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZXQgb3B0aW9uIGBrZWVwSGlzdG9yeWAgdG8gZW5hYmxlIHJld2luZGluZycpXG4gICAgfVxuICAgIC8vIG5iLiByZWNhbGwgY29sdW1uICh0YWJsZSkgaW5kaWNpZXMgZmFsbCBiZXR3ZWVuIHRva2VuIGluZGljaWVzLlxuICAgIC8vICAgICAgICBjb2wgMCAgIC0tICAgdG9rZW4gMCAgIC0tICAgY29sIDFcbiAgICB0aGlzLnJlc3RvcmUodGhpcy50YWJsZVtpbmRleF0pO1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5maW5pc2ggPSBmdW5jdGlvbigpIHtcbiAgICAvLyBSZXR1cm4gdGhlIHBvc3NpYmxlIHBhcnNpbmdzXG4gICAgdmFyIGNvbnNpZGVyYXRpb25zID0gW107XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5ncmFtbWFyLnN0YXJ0O1xuICAgIHZhciBjb2x1bW4gPSB0aGlzLnRhYmxlW3RoaXMudGFibGUubGVuZ3RoIC0gMV1cbiAgICBjb2x1bW4uc3RhdGVzLmZvckVhY2goZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgaWYgKHQucnVsZS5uYW1lID09PSBzdGFydFxuICAgICAgICAgICAgICAgICYmIHQuZG90ID09PSB0LnJ1bGUuc3ltYm9scy5sZW5ndGhcbiAgICAgICAgICAgICAgICAmJiB0LnJlZmVyZW5jZSA9PT0gMFxuICAgICAgICAgICAgICAgICYmIHQuZGF0YSAhPT0gUGFyc2VyLmZhaWwpIHtcbiAgICAgICAgICAgIGNvbnNpZGVyYXRpb25zLnB1c2godCk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gY29uc2lkZXJhdGlvbnMubWFwKGZ1bmN0aW9uKGMpIHtyZXR1cm4gYy5kYXRhOyB9KTtcbn07XG5cbnJldHVybiB7XG4gICAgUGFyc2VyOiBQYXJzZXIsXG4gICAgR3JhbW1hcjogR3JhbW1hcixcbiAgICBSdWxlOiBSdWxlLFxufTtcblxufSkpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBHZW5lcmF0ZWQgYXV0b21hdGljYWxseSBieSBuZWFybGV5XG4vLyBodHRwOi8vZ2l0aHViLmNvbS9IYXJkbWF0aDEyMy9uZWFybGV5XG4oZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBpZCh4KSB7XG4gICAgcmV0dXJuIHhbMF07XG4gIH1cblxuICB2YXIgYXBwZW5kSXRlbSA9IGZ1bmN0aW9uIGFwcGVuZEl0ZW0oYSwgYikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZCkge1xuICAgICAgcmV0dXJuIGRbYV0uY29uY2F0KFtkW2JdXSk7XG4gICAgfTtcbiAgfTtcbiAgdmFyIGFwcGVuZEl0ZW1DaGFyID0gZnVuY3Rpb24gYXBwZW5kSXRlbUNoYXIoYSwgYikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoZCkge1xuICAgICAgcmV0dXJuIGRbYV0uY29uY2F0KGRbYl0pO1xuICAgIH07XG4gIH07XG5cbiAgdmFyIGZsYXR0ZW4gPSBmdW5jdGlvbiBmbGF0dGVuKGQpIHtcbiAgICBkID0gZC5maWx0ZXIoZnVuY3Rpb24gKHIpIHtcbiAgICAgIHJldHVybiByICE9PSBudWxsO1xuICAgIH0pO1xuICAgIHJldHVybiBkLnJlZHVjZShmdW5jdGlvbiAoYSwgYikge1xuICAgICAgcmV0dXJuIGEuY29uY2F0KGIpO1xuICAgIH0sIFtdKTtcbiAgfTtcblxuICB2YXIgY29tYmluYXRvck1hcCA9IHtcbiAgICAnICc6ICdkZXNjZW5kYW50Q29tYmluYXRvcicsXG4gICAgJysnOiAnYWRqYWNlbnRTaWJsaW5nQ29tYmluYXRvcicsXG4gICAgJz4nOiAnY2hpbGRDb21iaW5hdG9yJyxcbiAgICAnfic6ICdnZW5lcmFsU2libGluZ0NvbWJpbmF0b3InXG4gIH07XG5cbiAgdmFyIGNvbmNhdFVzaW5nQ29tYmluYXRvciA9IGZ1bmN0aW9uIGNvbmNhdFVzaW5nQ29tYmluYXRvcihkKSB7XG4gICAgcmV0dXJuIChBcnJheS5pc0FycmF5KGRbMF0pID8gZFswXSA6IFtkWzBdXSkuY29uY2F0KHtcbiAgICAgIHR5cGU6IGNvbWJpbmF0b3JNYXBbZFsyXV1cbiAgICB9KS5jb25jYXQoZFs0XSk7XG4gIH07XG4gIHZhciBncmFtbWFyID0ge1xuICAgIFBhcnNlclJ1bGVzOiBbeyBcIm5hbWVcIjogXCJjb21iaW5hdG9yXCIsIFwic3ltYm9sc1wiOiBbXCJzZWxlY3RvclwiXSB9LCB7IFwibmFtZVwiOiBcImNvbWJpbmF0b3JcIiwgXCJzeW1ib2xzXCI6IFtcImNvbWJpbmF0b3JcIiwgXCJfXCIsIC9bPit+IF0vLCBcIl9cIiwgXCJzZWxlY3RvclwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBjb25jYXRVc2luZ0NvbWJpbmF0b3IgfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvclwiLCBcInN5bWJvbHNcIjogW1wic2VsZWN0b3JCb2R5XCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIHsgdHlwZTogJ3NlbGVjdG9yJywgYm9keTogZFswXSB9O1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDFcIiwgXCJzeW1ib2xzXCI6IFtcInR5cGVTZWxlY3RvclwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDFcIiwgXCJzeW1ib2xzXCI6IFtdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkMlwiLCBcInN5bWJvbHNcIjogW1wiaWRTZWxlY3RvclwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDJcIiwgXCJzeW1ib2xzXCI6IFtdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkM1wiLCBcInN5bWJvbHNcIjogW10gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQzXCIsIFwic3ltYm9sc1wiOiBbXCJjbGFzc1NlbGVjdG9yXCIsIFwic2VsZWN0b3JCb2R5JGVibmYkM1wiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQ0XCIsIFwic3ltYm9sc1wiOiBbXSB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDRcIiwgXCJzeW1ib2xzXCI6IFtcImF0dHJpYnV0ZVZhbHVlU2VsZWN0b3JcIiwgXCJzZWxlY3RvckJvZHkkZWJuZiQ0XCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIGFycmNvbmNhdChkKSB7XG4gICAgICAgIHJldHVybiBbZFswXV0uY29uY2F0KGRbMV0pO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDVcIiwgXCJzeW1ib2xzXCI6IFtdIH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkNVwiLCBcInN5bWJvbHNcIjogW1wiYXR0cmlidXRlUHJlc2VuY2VTZWxlY3RvclwiLCBcInNlbGVjdG9yQm9keSRlYm5mJDVcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gYXJyY29uY2F0KGQpIHtcbiAgICAgICAgcmV0dXJuIFtkWzBdXS5jb25jYXQoZFsxXSk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkNlwiLCBcInN5bWJvbHNcIjogW10gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQ2XCIsIFwic3ltYm9sc1wiOiBbXCJwc2V1ZG9DbGFzc1NlbGVjdG9yXCIsIFwic2VsZWN0b3JCb2R5JGVibmYkNlwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQ3XCIsIFwic3ltYm9sc1wiOiBbXCJwc2V1ZG9FbGVtZW50U2VsZWN0b3JcIl0sIFwicG9zdHByb2Nlc3NcIjogaWQgfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQ3XCIsIFwic3ltYm9sc1wiOiBbXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keVwiLCBcInN5bWJvbHNcIjogW1wic2VsZWN0b3JCb2R5JGVibmYkMVwiLCBcInNlbGVjdG9yQm9keSRlYm5mJDJcIiwgXCJzZWxlY3RvckJvZHkkZWJuZiQzXCIsIFwic2VsZWN0b3JCb2R5JGVibmYkNFwiLCBcInNlbGVjdG9yQm9keSRlYm5mJDVcIiwgXCJzZWxlY3RvckJvZHkkZWJuZiQ2XCIsIFwic2VsZWN0b3JCb2R5JGVibmYkN1wiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkLCBpLCByZWplY3QpIHtcbiAgICAgICAgdmFyIHNlbGVjdG9ycyA9IGZsYXR0ZW4oZCk7aWYgKCFzZWxlY3RvcnMubGVuZ3RoKSByZXR1cm4gcmVqZWN0O3JldHVybiBzZWxlY3RvcnM7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkOFwiLCBcInN5bWJvbHNcIjogW1wiaWRTZWxlY3RvclwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDhcIiwgXCJzeW1ib2xzXCI6IFtdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkOVwiLCBcInN5bWJvbHNcIjogW10gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQ5XCIsIFwic3ltYm9sc1wiOiBbXCJjbGFzc1NlbGVjdG9yXCIsIFwic2VsZWN0b3JCb2R5JGVibmYkOVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQxMFwiLCBcInN5bWJvbHNcIjogW10gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQxMFwiLCBcInN5bWJvbHNcIjogW1wiYXR0cmlidXRlVmFsdWVTZWxlY3RvclwiLCBcInNlbGVjdG9yQm9keSRlYm5mJDEwXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIGFycmNvbmNhdChkKSB7XG4gICAgICAgIHJldHVybiBbZFswXV0uY29uY2F0KGRbMV0pO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDExXCIsIFwic3ltYm9sc1wiOiBbXSB9LCB7IFwibmFtZVwiOiBcInNlbGVjdG9yQm9keSRlYm5mJDExXCIsIFwic3ltYm9sc1wiOiBbXCJhdHRyaWJ1dGVQcmVzZW5jZVNlbGVjdG9yXCIsIFwic2VsZWN0b3JCb2R5JGVibmYkMTFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gYXJyY29uY2F0KGQpIHtcbiAgICAgICAgcmV0dXJuIFtkWzBdXS5jb25jYXQoZFsxXSk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkMTJcIiwgXCJzeW1ib2xzXCI6IFtdIH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkMTJcIiwgXCJzeW1ib2xzXCI6IFtcInBzZXVkb0NsYXNzU2VsZWN0b3JcIiwgXCJzZWxlY3RvckJvZHkkZWJuZiQxMlwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJzZWxlY3RvckJvZHkkZWJuZiQxM1wiLCBcInN5bWJvbHNcIjogW1wicHNldWRvRWxlbWVudFNlbGVjdG9yXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGlkIH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5JGVibmYkMTNcIiwgXCJzeW1ib2xzXCI6IFtdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic2VsZWN0b3JCb2R5XCIsIFwic3ltYm9sc1wiOiBbXCJ1bml2ZXJzYWxTZWxlY3RvclwiLCBcInNlbGVjdG9yQm9keSRlYm5mJDhcIiwgXCJzZWxlY3RvckJvZHkkZWJuZiQ5XCIsIFwic2VsZWN0b3JCb2R5JGVibmYkMTBcIiwgXCJzZWxlY3RvckJvZHkkZWJuZiQxMVwiLCBcInNlbGVjdG9yQm9keSRlYm5mJDEyXCIsIFwic2VsZWN0b3JCb2R5JGVibmYkMTNcIl0sIFwicG9zdHByb2Nlc3NcIjogZmxhdHRlbiB9LCB7IFwibmFtZVwiOiBcInR5cGVTZWxlY3RvclwiLCBcInN5bWJvbHNcIjogW1wiYXR0cmlidXRlTmFtZVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiB7IHR5cGU6ICd0eXBlU2VsZWN0b3InLCBuYW1lOiBkWzBdIH07XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiY2xhc3NOYW1lJGVibmYkMVwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiLVwiIH1dLCBcInBvc3Rwcm9jZXNzXCI6IGlkIH0sIHsgXCJuYW1lXCI6IFwiY2xhc3NOYW1lJGVibmYkMVwiLCBcInN5bWJvbHNcIjogW10sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gcG9zdHByb2Nlc3MoZCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJjbGFzc05hbWUkZWJuZiQyXCIsIFwic3ltYm9sc1wiOiBbXSB9LCB7IFwibmFtZVwiOiBcImNsYXNzTmFtZSRlYm5mJDJcIiwgXCJzeW1ib2xzXCI6IFsvW19hLXpBLVowLTktXS8sIFwiY2xhc3NOYW1lJGVibmYkMlwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJjbGFzc05hbWVcIiwgXCJzeW1ib2xzXCI6IFtcImNsYXNzTmFtZSRlYm5mJDFcIiwgL1tfYS16QS1aXS8sIFwiY2xhc3NOYW1lJGVibmYkMlwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiAoZFswXSB8fCAnJykgKyBkWzFdICsgZFsyXS5qb2luKCcnKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVOYW1lJGVibmYkMVwiLCBcInN5bWJvbHNcIjogW10gfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVOYW1lJGVibmYkMVwiLCBcInN5bWJvbHNcIjogWy9bX2EtekEtWjAtOS1dLywgXCJhdHRyaWJ1dGVOYW1lJGVibmYkMVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVOYW1lXCIsIFwic3ltYm9sc1wiOiBbL1tfYS16QS1aXS8sIFwiYXR0cmlidXRlTmFtZSRlYm5mJDFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gcG9zdHByb2Nlc3MoZCkge1xuICAgICAgICByZXR1cm4gZFswXSArIGRbMV0uam9pbignJyk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiY2xhc3NTZWxlY3RvclwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiLlwiIH0sIFwiY2xhc3NOYW1lXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIHsgdHlwZTogJ2NsYXNzU2VsZWN0b3InLCBuYW1lOiBkWzFdIH07XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiaWRTZWxlY3RvclwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiI1wiIH0sIFwiYXR0cmlidXRlTmFtZVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiB7IHR5cGU6ICdpZFNlbGVjdG9yJywgbmFtZTogZFsxXSB9O1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInVuaXZlcnNhbFNlbGVjdG9yXCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCIqXCIgfV0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gcG9zdHByb2Nlc3MoZCkge1xuICAgICAgICByZXR1cm4geyB0eXBlOiAndW5pdmVyc2FsU2VsZWN0b3InIH07XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiYXR0cmlidXRlUHJlc2VuY2VTZWxlY3RvclwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiW1wiIH0sIFwiYXR0cmlidXRlTmFtZVwiLCB7IFwibGl0ZXJhbFwiOiBcIl1cIiB9XSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiB7IHR5cGU6ICdhdHRyaWJ1dGVQcmVzZW5jZVNlbGVjdG9yJywgbmFtZTogZFsxXSB9O1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZU9wZXJhdG9yXCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCI9XCIgfV0gfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVPcGVyYXRvciRzdHJpbmckMVwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiflwiIH0sIHsgXCJsaXRlcmFsXCI6IFwiPVwiIH1dLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIGpvaW5lcihkKSB7XG4gICAgICAgIHJldHVybiBkLmpvaW4oJycpO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZU9wZXJhdG9yXCIsIFwic3ltYm9sc1wiOiBbXCJhdHRyaWJ1dGVPcGVyYXRvciRzdHJpbmckMVwiXSB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZU9wZXJhdG9yJHN0cmluZyQyXCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCJ8XCIgfSwgeyBcImxpdGVyYWxcIjogXCI9XCIgfV0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gam9pbmVyKGQpIHtcbiAgICAgICAgcmV0dXJuIGQuam9pbignJyk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiYXR0cmlidXRlT3BlcmF0b3JcIiwgXCJzeW1ib2xzXCI6IFtcImF0dHJpYnV0ZU9wZXJhdG9yJHN0cmluZyQyXCJdIH0sIHsgXCJuYW1lXCI6IFwiYXR0cmlidXRlT3BlcmF0b3Ikc3RyaW5nJDNcIiwgXCJzeW1ib2xzXCI6IFt7IFwibGl0ZXJhbFwiOiBcIl5cIiB9LCB7IFwibGl0ZXJhbFwiOiBcIj1cIiB9XSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBqb2luZXIoZCkge1xuICAgICAgICByZXR1cm4gZC5qb2luKCcnKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVPcGVyYXRvclwiLCBcInN5bWJvbHNcIjogW1wiYXR0cmlidXRlT3BlcmF0b3Ikc3RyaW5nJDNcIl0gfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVPcGVyYXRvciRzdHJpbmckNFwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiJFwiIH0sIHsgXCJsaXRlcmFsXCI6IFwiPVwiIH1dLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIGpvaW5lcihkKSB7XG4gICAgICAgIHJldHVybiBkLmpvaW4oJycpO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZU9wZXJhdG9yXCIsIFwic3ltYm9sc1wiOiBbXCJhdHRyaWJ1dGVPcGVyYXRvciRzdHJpbmckNFwiXSB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZU9wZXJhdG9yJHN0cmluZyQ1XCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCIqXCIgfSwgeyBcImxpdGVyYWxcIjogXCI9XCIgfV0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gam9pbmVyKGQpIHtcbiAgICAgICAgcmV0dXJuIGQuam9pbignJyk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiYXR0cmlidXRlT3BlcmF0b3JcIiwgXCJzeW1ib2xzXCI6IFtcImF0dHJpYnV0ZU9wZXJhdG9yJHN0cmluZyQ1XCJdIH0sIHsgXCJuYW1lXCI6IFwiYXR0cmlidXRlVmFsdWVTZWxlY3RvclwiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiW1wiIH0sIFwiYXR0cmlidXRlTmFtZVwiLCBcImF0dHJpYnV0ZU9wZXJhdG9yXCIsIFwiYXR0cmlidXRlVmFsdWVcIiwgeyBcImxpdGVyYWxcIjogXCJdXCIgfV0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gcG9zdHByb2Nlc3MoZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHR5cGU6ICdhdHRyaWJ1dGVWYWx1ZVNlbGVjdG9yJyxcbiAgICAgICAgICBuYW1lOiBkWzFdLFxuICAgICAgICAgIHZhbHVlOiBkWzNdLFxuICAgICAgICAgIG9wZXJhdG9yOiBkWzJdWzBdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSwgeyBcIm5hbWVcIjogXCJhdHRyaWJ1dGVWYWx1ZVwiLCBcInN5bWJvbHNcIjogW1widW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZVZhbHVlXCIsIFwic3ltYm9sc1wiOiBbXCJzcXN0cmluZ1wiXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcImF0dHJpYnV0ZVZhbHVlXCIsIFwic3ltYm9sc1wiOiBbXCJkcXN0cmluZ1wiXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcInVucXVvdGVkQXR0cmlidXRlVmFsdWUkZWJuZiQxXCIsIFwic3ltYm9sc1wiOiBbL1teXFxbXFxdXCInLD0gXS9dIH0sIHsgXCJuYW1lXCI6IFwidW5xdW90ZWRBdHRyaWJ1dGVWYWx1ZSRlYm5mJDFcIiwgXCJzeW1ib2xzXCI6IFsvW15cXFtcXF1cIicsPSBdLywgXCJ1bnF1b3RlZEF0dHJpYnV0ZVZhbHVlJGVibmYkMVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJ1bnF1b3RlZEF0dHJpYnV0ZVZhbHVlXCIsIFwic3ltYm9sc1wiOiBbXCJ1bnF1b3RlZEF0dHJpYnV0ZVZhbHVlJGVibmYkMVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiBkWzBdLmpvaW4oJycpO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcImNsYXNzUGFyYW1ldGVyc1wiLCBcInN5bWJvbHNcIjogW10gfSwgeyBcIm5hbWVcIjogXCJjbGFzc1BhcmFtZXRlcnNcIiwgXCJzeW1ib2xzXCI6IFtcImNsYXNzUGFyYW1ldGVyXCJdIH0sIHsgXCJuYW1lXCI6IFwiY2xhc3NQYXJhbWV0ZXJzXCIsIFwic3ltYm9sc1wiOiBbXCJjbGFzc1BhcmFtZXRlcnNcIiwgeyBcImxpdGVyYWxcIjogXCIsXCIgfSwgXCJfXCIsIFwiY2xhc3NQYXJhbWV0ZXJcIl0sIFwicG9zdHByb2Nlc3NcIjogYXBwZW5kSXRlbSgwLCAzKSB9LCB7IFwibmFtZVwiOiBcImNsYXNzUGFyYW1ldGVyJGVibmYkMVwiLCBcInN5bWJvbHNcIjogWy9bXigpXCInLCBdL10gfSwgeyBcIm5hbWVcIjogXCJjbGFzc1BhcmFtZXRlciRlYm5mJDFcIiwgXCJzeW1ib2xzXCI6IFsvW14oKVwiJywgXS8sIFwiY2xhc3NQYXJhbWV0ZXIkZWJuZiQxXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIGFycmNvbmNhdChkKSB7XG4gICAgICAgIHJldHVybiBbZFswXV0uY29uY2F0KGRbMV0pO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcImNsYXNzUGFyYW1ldGVyXCIsIFwic3ltYm9sc1wiOiBbXCJjbGFzc1BhcmFtZXRlciRlYm5mJDFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gcG9zdHByb2Nlc3MoZCkge1xuICAgICAgICByZXR1cm4gZFswXS5qb2luKCcnKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJjbGFzc1BhcmFtZXRlclwiLCBcInN5bWJvbHNcIjogW1wic3FzdHJpbmdcIl0sIFwicG9zdHByb2Nlc3NcIjogaWQgfSwgeyBcIm5hbWVcIjogXCJjbGFzc1BhcmFtZXRlclwiLCBcInN5bWJvbHNcIjogW1wiZHFzdHJpbmdcIl0sIFwicG9zdHByb2Nlc3NcIjogaWQgfSwgeyBcIm5hbWVcIjogXCJwc2V1ZG9FbGVtZW50U2VsZWN0b3Ikc3RyaW5nJDFcIiwgXCJzeW1ib2xzXCI6IFt7IFwibGl0ZXJhbFwiOiBcIjpcIiB9LCB7IFwibGl0ZXJhbFwiOiBcIjpcIiB9XSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBqb2luZXIoZCkge1xuICAgICAgICByZXR1cm4gZC5qb2luKCcnKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJwc2V1ZG9FbGVtZW50U2VsZWN0b3JcIiwgXCJzeW1ib2xzXCI6IFtcInBzZXVkb0VsZW1lbnRTZWxlY3RvciRzdHJpbmckMVwiLCBcInBzZXVkb0NsYXNzU2VsZWN0b3JOYW1lXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIHsgdHlwZTogJ3BzZXVkb0VsZW1lbnRTZWxlY3RvcicsIG5hbWU6IGRbMV0gfTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJwc2V1ZG9DbGFzc1NlbGVjdG9yXCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCI6XCIgfSwgXCJwc2V1ZG9DbGFzc1NlbGVjdG9yTmFtZVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiB7IHR5cGU6ICdwc2V1ZG9DbGFzc1NlbGVjdG9yJywgbmFtZTogZFsxXSB9O1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInBzZXVkb0NsYXNzU2VsZWN0b3JcIiwgXCJzeW1ib2xzXCI6IFt7IFwibGl0ZXJhbFwiOiBcIjpcIiB9LCBcInBzZXVkb0NsYXNzU2VsZWN0b3JOYW1lXCIsIHsgXCJsaXRlcmFsXCI6IFwiKFwiIH0sIFwiY2xhc3NQYXJhbWV0ZXJzXCIsIHsgXCJsaXRlcmFsXCI6IFwiKVwiIH1dLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIHsgdHlwZTogJ3BzZXVkb0NsYXNzU2VsZWN0b3InLCBuYW1lOiBkWzFdLCBwYXJhbWV0ZXJzOiBkWzNdIH07XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwicHNldWRvQ2xhc3NTZWxlY3Rvck5hbWUkZWJuZiQxXCIsIFwic3ltYm9sc1wiOiBbL1thLXpBLVowLTktX10vXSB9LCB7IFwibmFtZVwiOiBcInBzZXVkb0NsYXNzU2VsZWN0b3JOYW1lJGVibmYkMVwiLCBcInN5bWJvbHNcIjogWy9bYS16QS1aMC05LV9dLywgXCJwc2V1ZG9DbGFzc1NlbGVjdG9yTmFtZSRlYm5mJDFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gYXJyY29uY2F0KGQpIHtcbiAgICAgICAgcmV0dXJuIFtkWzBdXS5jb25jYXQoZFsxXSk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwicHNldWRvQ2xhc3NTZWxlY3Rvck5hbWVcIiwgXCJzeW1ib2xzXCI6IFsvW2EtekEtWl0vLCBcInBzZXVkb0NsYXNzU2VsZWN0b3JOYW1lJGVibmYkMVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiBkWzBdICsgZFsxXS5qb2luKCcnKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJkcXN0cmluZyRlYm5mJDFcIiwgXCJzeW1ib2xzXCI6IFtdIH0sIHsgXCJuYW1lXCI6IFwiZHFzdHJpbmckZWJuZiQxXCIsIFwic3ltYm9sc1wiOiBbXCJkc3RyY2hhclwiLCBcImRxc3RyaW5nJGVibmYkMVwiXSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBhcnJjb25jYXQoZCkge1xuICAgICAgICByZXR1cm4gW2RbMF1dLmNvbmNhdChkWzFdKTtcbiAgICAgIH0gfSwgeyBcIm5hbWVcIjogXCJkcXN0cmluZ1wiLCBcInN5bWJvbHNcIjogW3sgXCJsaXRlcmFsXCI6IFwiXFxcIlwiIH0sIFwiZHFzdHJpbmckZWJuZiQxXCIsIHsgXCJsaXRlcmFsXCI6IFwiXFxcIlwiIH1dLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuIGRbMV0uam9pbignJyk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiZHN0cmNoYXJcIiwgXCJzeW1ib2xzXCI6IFsvW15cIl0vXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcImRzdHJjaGFyJHN0cmluZyQxXCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCJcXFxcXCIgfSwgeyBcImxpdGVyYWxcIjogXCJcXFwiXCIgfV0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gam9pbmVyKGQpIHtcbiAgICAgICAgcmV0dXJuIGQuam9pbignJyk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiZHN0cmNoYXJcIiwgXCJzeW1ib2xzXCI6IFtcImRzdHJjaGFyJHN0cmluZyQxXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuICdcIic7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic3FzdHJpbmckZWJuZiQxXCIsIFwic3ltYm9sc1wiOiBbXSB9LCB7IFwibmFtZVwiOiBcInNxc3RyaW5nJGVibmYkMVwiLCBcInN5bWJvbHNcIjogW1wic3N0cmNoYXJcIiwgXCJzcXN0cmluZyRlYm5mJDFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gYXJyY29uY2F0KGQpIHtcbiAgICAgICAgcmV0dXJuIFtkWzBdXS5jb25jYXQoZFsxXSk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic3FzdHJpbmdcIiwgXCJzeW1ib2xzXCI6IFt7IFwibGl0ZXJhbFwiOiBcIidcIiB9LCBcInNxc3RyaW5nJGVibmYkMVwiLCB7IFwibGl0ZXJhbFwiOiBcIidcIiB9XSwgXCJwb3N0cHJvY2Vzc1wiOiBmdW5jdGlvbiBwb3N0cHJvY2VzcyhkKSB7XG4gICAgICAgIHJldHVybiBkWzFdLmpvaW4oJycpO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcInNzdHJjaGFyXCIsIFwic3ltYm9sc1wiOiBbL1teJ10vXSwgXCJwb3N0cHJvY2Vzc1wiOiBpZCB9LCB7IFwibmFtZVwiOiBcInNzdHJjaGFyJHN0cmluZyQxXCIsIFwic3ltYm9sc1wiOiBbeyBcImxpdGVyYWxcIjogXCJcXFxcXCIgfSwgeyBcImxpdGVyYWxcIjogXCInXCIgfV0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gam9pbmVyKGQpIHtcbiAgICAgICAgcmV0dXJuIGQuam9pbignJyk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwic3N0cmNoYXJcIiwgXCJzeW1ib2xzXCI6IFtcInNzdHJjaGFyJHN0cmluZyQxXCJdLCBcInBvc3Rwcm9jZXNzXCI6IGZ1bmN0aW9uIHBvc3Rwcm9jZXNzKGQpIHtcbiAgICAgICAgcmV0dXJuICdcXCcnO1xuICAgICAgfSB9LCB7IFwibmFtZVwiOiBcIl8kZWJuZiQxXCIsIFwic3ltYm9sc1wiOiBbXSB9LCB7IFwibmFtZVwiOiBcIl8kZWJuZiQxXCIsIFwic3ltYm9sc1wiOiBbL1sgXS8sIFwiXyRlYm5mJDFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gYXJyY29uY2F0KGQpIHtcbiAgICAgICAgcmV0dXJuIFtkWzBdXS5jb25jYXQoZFsxXSk7XG4gICAgICB9IH0sIHsgXCJuYW1lXCI6IFwiX1wiLCBcInN5bWJvbHNcIjogW1wiXyRlYm5mJDFcIl0sIFwicG9zdHByb2Nlc3NcIjogZnVuY3Rpb24gcG9zdHByb2Nlc3MoZCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0gfV0sXG4gICAgUGFyc2VyU3RhcnQ6IFwiY29tYmluYXRvclwiXG4gIH07XG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBncmFtbWFyO1xuICB9IGVsc2Uge1xuICAgIHdpbmRvdy5ncmFtbWFyID0gZ3JhbW1hcjtcbiAgfVxufSkoKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdyYW1tYXIuanMubWFwIiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX25lYXJsZXkgPSByZXF1aXJlKCduZWFybGV5Jyk7XG5cbnZhciBfZ3JhbW1hciA9IHJlcXVpcmUoJy4vZ3JhbW1hcicpO1xuXG52YXIgX2dyYW1tYXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZ3JhbW1hcik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbi8qOjogaW1wb3J0IHR5cGUge1xuICBDb21iaW5hdG9yVG9rZW5UeXBlLFxuICBTZWxlY3RvclRva2VuVHlwZVxufSBmcm9tICcuL3R5cGVzJzsqLyAvLyBAZmxvd1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBwYXJzZSA9IGZ1bmN0aW9uIHBhcnNlKHNlbGVjdG9yIC8qOiBzdHJpbmcqLykgLyo6IEFycmF5PFNlbGVjdG9yVG9rZW5UeXBlIHwgQ29tYmluYXRvclRva2VuVHlwZT4qLyB7XG4gICAgdmFyIHBhcnNlciA9IG5ldyBfbmVhcmxleS5QYXJzZXIoX2dyYW1tYXIyLmRlZmF1bHQuUGFyc2VyUnVsZXMsIF9ncmFtbWFyMi5kZWZhdWx0LlBhcnNlclN0YXJ0KTtcblxuICAgIHZhciByZXN1bHRzID0gcGFyc2VyLmZlZWQoc2VsZWN0b3IpLnJlc3VsdHM7XG5cbiAgICBpZiAocmVzdWx0cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgbm8gcGFyc2luZ3MuJyk7XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdHMubGVuZ3RoID4gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbWJpZ3VvdXMgcmVzdWx0cy4nKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0c1swXTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIHBhcnNlXG4gIH07XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y3JlYXRlUGFyc2VyLmpzLm1hcCIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuY3JlYXRlUGFyc2VyID0gZXhwb3J0cy5jcmVhdGVHZW5lcmF0b3IgPSB1bmRlZmluZWQ7XG5cbnZhciBfY3JlYXRlR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9jcmVhdGVHZW5lcmF0b3InKTtcblxudmFyIF9jcmVhdGVHZW5lcmF0b3IyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlR2VuZXJhdG9yKTtcblxudmFyIF9jcmVhdGVQYXJzZXIgPSByZXF1aXJlKCcuL2NyZWF0ZVBhcnNlcicpO1xuXG52YXIgX2NyZWF0ZVBhcnNlcjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVQYXJzZXIpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG4vLyBAZmxvd1xuXG5leHBvcnRzLmNyZWF0ZUdlbmVyYXRvciA9IF9jcmVhdGVHZW5lcmF0b3IyLmRlZmF1bHQ7XG5leHBvcnRzLmNyZWF0ZVBhcnNlciA9IF9jcmVhdGVQYXJzZXIyLmRlZmF1bHQ7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgeG1sSnMgZnJvbSAneG1sLWpzJztcbmltcG9ydCB7IGNyZWF0ZVBhcnNlciB9IGZyb20gJ3NjYWxwZWwnO1xuaW1wb3J0IG11cmVJbnRlcmFjdGl2aXR5UnVubmVyVGV4dCBmcm9tICcuL211cmVJbnRlcmFjdGl2aXR5UnVubmVyLnRleHQuanMnOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgZGVmYXVsdFN2Z0RvY1RlbXBsYXRlIGZyb20gJy4vZGVmYXVsdC50ZXh0LnN2Zyc7XG5pbXBvcnQgbWluaW11bVN2Z0RvYyBmcm9tICcuL21pbmltdW0udGV4dC5zdmcnO1xuXG4vLyBzbmVha2lseSBlbWJlZCB0aGUgaW50ZXJhY3Rpdml0eS1ydW5uaW5nIHNjcmlwdFxuY29uc3QgZGVmYXVsdFN2Z0RvYyA9IGRlZmF1bHRTdmdEb2NUZW1wbGF0ZS5yZXBsYWNlKC9cXCR7bXVyZUludGVyYWN0aXZpdHlSdW5uZXJUZXh0fS8sIG11cmVJbnRlcmFjdGl2aXR5UnVubmVyVGV4dCk7XG5cbmNsYXNzIERvY0hhbmRsZXIge1xuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yICgpIHtcbiAgICB0aGlzLnNlbGVjdG9yUGFyc2VyID0gY3JlYXRlUGFyc2VyKCk7XG4gICAgLy8gdG9kbzogZm9yIGVmZmljaWVuY3ksIEkgc2hvdWxkIHJlbmFtZSBhbGwgb2YgeG1sLWpzJ3MgZGVmYXVsdCAobGVuZ3RoeSEpIGtleSBuYW1lc1xuICAgIHRoaXMua2V5TmFtZXMgPSB7fTtcbiAgICB0aGlzLmpzb24yeG1sU2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICdjb21wYWN0JzogZmFsc2UsXG4gICAgICAnaW5kZW50Q2RhdGEnOiB0cnVlXG4gICAgfSwgdGhpcy5rZXlOYW1lcyk7XG4gICAgdGhpcy54bWwyanNvblNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7XG4gICAgICAnY29tcGFjdCc6IGZhbHNlLFxuICAgICAgJ25hdGl2ZVR5cGUnOiB0cnVlLFxuICAgICAgJ2Fsd2F5c0FycmF5JzogdHJ1ZSxcbiAgICAgICdhZGRQYXJlbnQnOiB0cnVlXG4gICAgfSwgdGhpcy5rZXlOYW1lcyk7XG4gICAgdGhpcy5kZWZhdWx0SnNvbkRvYyA9IHRoaXMueG1sMmpzb24oZGVmYXVsdFN2Z0RvYyk7XG4gICAgdGhpcy5taW5pbXVtSnNEb2MgPSB0aGlzLnhtbDJqcyhtaW5pbXVtU3ZnRG9jKTtcbiAgfVxuICB4bWwyanMgKHRleHQpIHsgcmV0dXJuIHhtbEpzLnhtbDJqcyh0ZXh0LCB0aGlzLnhtbDJqc29uU2V0dGluZ3MpOyB9XG4gIHhtbDJqc29uICh0ZXh0KSB7IHJldHVybiB4bWxKcy54bWwyanNvbih0ZXh0LCB0aGlzLnhtbDJqc29uU2V0dGluZ3MpOyB9XG4gIGpzb24yeG1sICh0ZXh0KSB7IHJldHVybiB4bWxKcy5qc29uMnhtbCh0ZXh0LCB0aGlzLmpzb24yeG1sU2V0dGluZ3MpOyB9XG4gIGpzMnhtbCAodGV4dCkgeyByZXR1cm4geG1sSnMuanMyeG1sKHRleHQsIHRoaXMuanNvbjJ4bWxTZXR0aW5ncyk7IH1cbiAgc3RhbmRhcmRpemUgKHRlc3RPYmosIHN0YW5kYXJkT2JqKSB7XG4gICAgaWYgKCFzdGFuZGFyZE9iaikge1xuICAgICAgaWYgKCF0ZXN0T2JqLl9pZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGF0IGxlYXN0IHN1cHBseSBhbiBpZCB0byBzdGFuZGFyZGl6ZSB0aGUgZG9jdW1lbnQnKTtcbiAgICAgIH1cbiAgICAgIHRlc3RPYmouY3VycmVudFNlbGVjdGlvbiA9IHRlc3RPYmouY3VycmVudFNlbGVjdGlvbiB8fCBudWxsO1xuICAgICAgdGVzdE9iai5jb250ZW50cyA9IHRoaXMuc3RhbmRhcmRpemUodGVzdE9iai5jb250ZW50cyB8fCB7fSwgdGhpcy5taW5pbXVtSnNEb2MpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUT0RPXG4gICAgfVxuICAgIHJldHVybiB0ZXN0T2JqO1xuICB9XG4gIGl0ZXJhdGUgKG9iaiwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBub2RlcyA9IFtdO1xuICAgIG5vZGVzLnB1c2gob2JqKTtcbiAgICBkbyB7XG4gICAgICBvYmogPSBub2Rlcy5zaGlmdCgpO1xuICAgICAgY2FsbGJhY2sob2JqKTtcbiAgICAgIGlmIChvYmouZWxlbWVudHMpIHtcbiAgICAgICAgbm9kZXMudW5zaGlmdCguLi5vYmouZWxlbWVudHMpO1xuICAgICAgfVxuICAgIH0gd2hpbGUgKG5vZGVzLmxlbmd0aCA+IDApO1xuICB9XG4gIG1hdGNoT2JqZWN0IChvYmosIHF1ZXJ5VG9rZW5zKSB7XG4gICAgLy8gVE9ET1xuICB9XG4gIHNlbGVjdEFsbCAocm9vdCwgc2VsZWN0b3IpIHtcbiAgICBjb25zdCBxdWVyeVRva2VucyA9IHRoaXMuc2VsZWN0b3JQYXJzZXIucGFyc2Uoc2VsZWN0b3IpO1xuICAgIGNvbnN0IGVsZW1lbnRzID0gW107XG4gICAgdGhpcy5pdGVyYXRlKHJvb3QsIG9iaiA9PiB7XG4gICAgICBpZiAodGhpcy5tYXRjaE9iamVjdChvYmosIHF1ZXJ5VG9rZW5zKSkge1xuICAgICAgICBlbGVtZW50cy5wdXNoKG9iaik7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIGVsZW1lbnRzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBEb2NIYW5kbGVyKCk7XG4iLCJpbXBvcnQgeyBNb2RlbCB9IGZyb20gJ3VraSc7XG5pbXBvcnQgZG9jSCBmcm9tICcuLi9Eb2NIYW5kbGVyL2luZGV4LmpzJztcblxuY2xhc3MgTXVyZSBleHRlbmRzIE1vZGVsIHtcbiAgY29uc3RydWN0b3IgKFBvdWNoREIsIGQzLCBkM24pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5Qb3VjaERCID0gUG91Y2hEQjsgLy8gY291bGQgYmUgcG91Y2hkYi1ub2RlIG9yIHBvdWNoZGItYnJvd3NlclxuICAgIHRoaXMuZDMgPSBkMzsgLy8gZm9yIE5vZGUuanMsIHRoaXMgd2lsbCBiZSBmcm9tIGQzLW5vZGUsIG5vdCB0aGUgcmVndWxhciBvbmVcblxuICAgIC8vIHRvIHJ1biB0ZXN0cywgd2UgYWxzbyBuZWVkIGFjY2VzcyB0byB0aGUgZDMtbm9kZSB3cmFwcGVyICh3ZSBkb24ndFxuICAgIC8vIGltcG9ydCBpdCBkaXJlY3RseSBpbnRvIHRoZSB0ZXN0cyB0byBtYWtlIHN1cmUgdGhhdCB0aGUgbmFtZXNwYWNlXG4gICAgLy8gYWRkaXRpb24gYmVsb3cgd29ya3MpXG4gICAgdGhpcy5kM24gPSBkM247XG5cbiAgICAvLyBUaGUgbmFtZXNwYWNlIHN0cmluZyBmb3Igb3VyIGN1c3RvbSBYTUxcbiAgICB0aGlzLk5TU3RyaW5nID0gJ2h0dHA6Ly9tdXJlLWFwcHMuZ2l0aHViLmlvJztcbiAgICB0aGlzLmQzLm5hbWVzcGFjZXMubXVyZSA9IHRoaXMuTlNTdHJpbmc7XG5cbiAgICAvLyBFbnVtZXJhdGlvbnMuLi5cbiAgICB0aGlzLkNPTlRFTlRfRk9STUFUUyA9IHtcbiAgICAgIGV4Y2x1ZGU6IDAsXG4gICAgICBibG9iOiAxLFxuICAgICAgZG9tOiAyLFxuICAgICAgYmFzZTY0OiAzXG4gICAgfTtcblxuICAgIC8vIENyZWF0ZSAvIGxvYWQgdGhlIGxvY2FsIGRhdGFiYXNlIG9mIGZpbGVzXG4gICAgdGhpcy5kYiA9IG5ldyB0aGlzLlBvdWNoREIoJ211cmUnKTtcblxuICAgIC8vIGRlZmF1bHQgZXJyb3IgaGFuZGxpbmcgKGFwcHMgY2FuIGxpc3RlbiBmb3IgLyBkaXNwbGF5IGVycm9yIG1lc3NhZ2VzIGluIGFkZGl0aW9uIHRvIHRoaXMpOlxuICAgIHRoaXMub24oJ2Vycm9yJywgZXJyb3JNZXNzYWdlID0+IHtcbiAgICAgIGNvbnNvbGUud2FybihlcnJvck1lc3NhZ2UpO1xuICAgIH0pO1xuICAgIHRoaXMuY2F0Y2hEYkVycm9yID0gZXJyb3JPYmogPT4ge1xuICAgICAgdGhpcy50cmlnZ2VyKCdlcnJvcicsICdVbmV4cGVjdGVkIGVycm9yIHJlYWRpbmcgUG91Y2hEQjogJyArIGVycm9yT2JqLm1lc3NhZ2UgKyAnXFxuJyArIGVycm9yT2JqLnN0YWNrKTtcbiAgICB9O1xuXG4gICAgLy8gaW4gdGhlIGFic2VuY2Ugb2YgYSBjdXN0b20gZGlhbG9ncywganVzdCB1c2Ugd2luZG93LmFsZXJ0LCB3aW5kb3cuY29uZmlybSBhbmQgd2luZG93LnByb21wdDpcbiAgICB0aGlzLmFsZXJ0ID0gKG1lc3NhZ2UpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHdpbmRvdy5hbGVydChtZXNzYWdlKTtcbiAgICAgICAgcmVzb2x2ZSh0cnVlKTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgdGhpcy5jb25maXJtID0gKG1lc3NhZ2UpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUod2luZG93LmNvbmZpcm0obWVzc2FnZSkpO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICB0aGlzLnByb21wdCA9IChtZXNzYWdlLCBkZWZhdWx0VmFsdWUpID0+IHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIHJlc29sdmUod2luZG93LnByb21wdChtZXNzYWdlLCBkZWZhdWx0VmFsdWUpKTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cbiAgY3VzdG9taXplQWxlcnREaWFsb2cgKHNob3dEaWFsb2dGdW5jdGlvbikge1xuICAgIHRoaXMuYWxlcnQgPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgY3VzdG9taXplQ29uZmlybURpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5jb25maXJtID0gc2hvd0RpYWxvZ0Z1bmN0aW9uO1xuICB9XG4gIGN1c3RvbWl6ZVByb21wdERpYWxvZyAoc2hvd0RpYWxvZ0Z1bmN0aW9uKSB7XG4gICAgdGhpcy5wcm9tcHQgPSBzaG93RGlhbG9nRnVuY3Rpb247XG4gIH1cbiAgb3BlbkFwcCAoYXBwTmFtZSwgbmV3VGFiKSB7XG4gICAgaWYgKG5ld1RhYikge1xuICAgICAgd2luZG93Lm9wZW4oJy8nICsgYXBwTmFtZSwgJ19ibGFuaycpO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUgPSAnLycgKyBhcHBOYW1lO1xuICAgIH1cbiAgfVxuICBnZXRPckluaXREYiAoKSB7XG4gICAgbGV0IGRiID0gbmV3IHRoaXMuUG91Y2hEQignbXVyZScpO1xuICAgIGxldCBjb3VjaERiVXJsID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKCdjb3VjaERiVXJsJyk7XG4gICAgaWYgKGNvdWNoRGJVcmwpIHtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIGxldCBjb3VjaERiID0gbmV3IHRoaXMuUG91Y2hEQihjb3VjaERiVXJsLCB7c2tpcF9zZXR1cDogdHJ1ZX0pO1xuICAgICAgICByZXR1cm4gZGIuc3luYyhjb3VjaERiLCB7bGl2ZTogdHJ1ZSwgcmV0cnk6IHRydWV9KTtcbiAgICAgIH0pKCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgdGhpcy5hbGVydCgnRXJyb3Igc3luY2luZyB3aXRoICcgKyBjb3VjaERiVXJsICsgJzogJyArXG4gICAgICAgICAgZXJyLm1lc3NhZ2UpO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBkYjtcbiAgfVxuICAvKipcbiAgICogQSB3cmFwcGVyIGFyb3VuZCBQb3VjaERCLmdldCgpIHRoYXQgZW5zdXJlcyB0aGF0IHRoZSByZXR1cm5lZCBkb2N1bWVudFxuICAgKiBleGlzdHMgKHVzZXMgZGVmYXVsdC50ZXh0LnN2ZyB3aGVuIGl0IGRvZXNuJ3QpLCBhbmQgaGFzIGF0IGxlYXN0IHRoZVxuICAgKiBlbGVtZW50cyBzcGVjaWZpZWQgYnkgbWluaW11bS50ZXh0LnN2Z1xuICAgKiBAcmV0dXJuIHtvYmplY3R9IEEgUG91Y2hEQiBkb2N1bWVudFxuICAgKi9cbiAgZ2V0U3RhbmRhcmRpemVkRG9jIChkb2NJZCkge1xuICAgIHJldHVybiB0aGlzLmRiLmdldChkb2NJZClcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICBpZiAoZXJyLm5hbWUgPT09ICdub3RfZm91bmQnKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIF9pZDogZG9jSWQsXG4gICAgICAgICAgICBjdXJyZW50U2VsZWN0aW9uOiBudWxsLFxuICAgICAgICAgICAgY29udGVudHM6IEpTT04ucGFyc2UoZG9jSC5kZWZhdWx0SnNvbkRvYylcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgfSkudGhlbihkb2MgPT4ge1xuICAgICAgICByZXR1cm4gZG9jSC5zdGFuZGFyZGl6ZShkb2MpO1xuICAgICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqXG4gICAqL1xuICBhc3luYyBkb3dubG9hZERvYyAoZG9jSWQpIHtcbiAgICByZXR1cm4gdGhpcy5kYi5nZXQoZG9jSWQpXG4gICAgICAudGhlbihkb2MgPT4ge1xuICAgICAgICBsZXQgeG1sVGV4dCA9IGRvY0guanMyeG1sKGRvYy5jb250ZW50cyk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGEgZmFrZSBsaW5rIHRvIGluaXRpYXRlIHRoZSBkb3dubG9hZFxuICAgICAgICBsZXQgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgYS5zdHlsZSA9ICdkaXNwbGF5Om5vbmUnO1xuICAgICAgICBsZXQgdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwobmV3IHdpbmRvdy5CbG9iKFt4bWxUZXh0XSwgeyB0eXBlOiAnaW1hZ2Uvc3ZnK3htbCcgfSkpO1xuICAgICAgICBhLmhyZWYgPSB1cmw7XG4gICAgICAgIGEuZG93bmxvYWQgPSBkb2MuX2lkO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGEpO1xuICAgICAgICBhLmNsaWNrKCk7XG4gICAgICAgIHdpbmRvdy5VUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgIGEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhKTtcbiAgICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE11cmU7XG4iLCJpbXBvcnQgTXVyZSBmcm9tICcuL011cmUvaW5kZXguanMnO1xuaW1wb3J0ICogYXMgZDMgZnJvbSAnZDMnO1xudmFyIFBvdWNoREIgPSByZXF1aXJlKCdwb3VjaGRiLWJyb3dzZXInKVxuICAucGx1Z2luKHJlcXVpcmUoJ3BvdWNoZGItYXV0aGVudGljYXRpb24nKSk7XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBNdXJlKFBvdWNoREIsIGQzKTtcbiJdLCJuYW1lcyI6WyJnbG9iYWwiLCJyZWFkIiwid3JpdGUiLCJiYXNlNjQuZnJvbUJ5dGVBcnJheSIsImllZWU3NTQucmVhZCIsImllZWU3NTQud3JpdGUiLCJiYXNlNjQudG9CeXRlQXJyYXkiLCJzYXgiLCJwYXJzZXIiLCJzdHJpY3QiLCJvcHQiLCJTQVhQYXJzZXIiLCJTQVhTdHJlYW0iLCJjcmVhdGVTdHJlYW0iLCJNQVhfQlVGRkVSX0xFTkdUSCIsImJ1ZmZlcnMiLCJFVkVOVFMiLCJxIiwiYyIsImJ1ZmZlckNoZWNrUG9zaXRpb24iLCJsb3dlcmNhc2UiLCJsb3dlcmNhc2V0YWdzIiwibG9vc2VDYXNlIiwidGFncyIsImNsb3NlZCIsImNsb3NlZFJvb3QiLCJzYXdSb290IiwidGFnIiwiZXJyb3IiLCJub3NjcmlwdCIsInN0YXRlIiwiUyIsIkJFR0lOIiwic3RyaWN0RW50aXRpZXMiLCJFTlRJVElFUyIsIk9iamVjdCIsImNyZWF0ZSIsIlhNTF9FTlRJVElFUyIsImF0dHJpYkxpc3QiLCJ4bWxucyIsIm5zIiwicm9vdE5TIiwidHJhY2tQb3NpdGlvbiIsInBvc2l0aW9uIiwibGluZSIsImNvbHVtbiIsIm8iLCJGIiwicHJvdG90eXBlIiwibmV3ZiIsImtleXMiLCJhIiwiaSIsImhhc093blByb3BlcnR5IiwicHVzaCIsImNoZWNrQnVmZmVyTGVuZ3RoIiwibWF4QWxsb3dlZCIsIk1hdGgiLCJtYXgiLCJtYXhBY3R1YWwiLCJsIiwibGVuZ3RoIiwibGVuIiwiY2RhdGEiLCJzY3JpcHQiLCJtIiwiY2xlYXJCdWZmZXJzIiwiZmx1c2hCdWZmZXJzIiwiU3RyZWFtIiwicmVxdWlyZSIsImV4Iiwic3RyZWFtV3JhcHMiLCJmaWx0ZXIiLCJldiIsImFwcGx5IiwiX3BhcnNlciIsIndyaXRhYmxlIiwicmVhZGFibGUiLCJtZSIsIm9uZW5kIiwiZW1pdCIsIm9uZXJyb3IiLCJlciIsIl9kZWNvZGVyIiwiZm9yRWFjaCIsImRlZmluZVByb3BlcnR5IiwiaCIsInJlbW92ZUFsbExpc3RlbmVycyIsIm9uIiwiZGF0YSIsIkJ1ZmZlciIsIlNEIiwiU3RyaW5nRGVjb2RlciIsInRvU3RyaW5nIiwiZW5kIiwiY2h1bmsiLCJoYW5kbGVyIiwiaW5kZXhPZiIsImFyZ3MiLCJhcmd1bWVudHMiLCJBcnJheSIsInNwbGljZSIsImNhbGwiLCJDREFUQSIsIkRPQ1RZUEUiLCJYTUxfTkFNRVNQQUNFIiwiWE1MTlNfTkFNRVNQQUNFIiwieG1sIiwibmFtZVN0YXJ0IiwibmFtZUJvZHkiLCJlbnRpdHlTdGFydCIsImVudGl0eUJvZHkiLCJpc1doaXRlc3BhY2UiLCJpc1F1b3RlIiwiaXNBdHRyaWJFbmQiLCJpc01hdGNoIiwicmVnZXgiLCJ0ZXN0Iiwibm90TWF0Y2giLCJTVEFURSIsImtleSIsImUiLCJzIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiZXZlbnQiLCJlbWl0Tm9kZSIsIm5vZGVUeXBlIiwidGV4dE5vZGUiLCJjbG9zZVRleHQiLCJ0ZXh0b3B0cyIsInRleHQiLCJ0cmltIiwibm9ybWFsaXplIiwicmVwbGFjZSIsIkVycm9yIiwic3RyaWN0RmFpbCIsIkJFR0lOX1dISVRFU1BBQ0UiLCJURVhUIiwibWVzc2FnZSIsIm5ld1RhZyIsInRhZ05hbWUiLCJwYXJlbnQiLCJuYW1lIiwiYXR0cmlidXRlcyIsInFuYW1lIiwiYXR0cmlidXRlIiwicXVhbE5hbWUiLCJzcGxpdCIsInByZWZpeCIsImxvY2FsIiwiYXR0cmliIiwiYXR0cmliTmFtZSIsImF0dHJpYlZhbHVlIiwicW4iLCJvcGVuVGFnIiwic2VsZkNsb3NpbmciLCJ1cmkiLCJKU09OIiwic3RyaW5naWZ5IiwicCIsIm52IiwidmFsdWUiLCJpc1NlbGZDbG9zaW5nIiwidG9Mb3dlckNhc2UiLCJTQ1JJUFQiLCJjbG9zZVRhZyIsInQiLCJjbG9zZVRvIiwiY2xvc2UiLCJwb3AiLCJ4IiwibiIsInBhcnNlRW50aXR5IiwiZW50aXR5IiwiZW50aXR5TEMiLCJudW0iLCJudW1TdHIiLCJjaGFyQXQiLCJzbGljZSIsInBhcnNlSW50IiwiaXNOYU4iLCJmcm9tQ29kZVBvaW50IiwiYmVnaW5XaGl0ZVNwYWNlIiwiT1BFTl9XQUtBIiwic3RhcnRUYWdQb3NpdGlvbiIsInJlc3VsdCIsInN0YXJ0aSIsInN1YnN0cmluZyIsIlRFWFRfRU5USVRZIiwiU0NSSVBUX0VORElORyIsIkNMT1NFX1RBRyIsIlNHTUxfREVDTCIsInNnbWxEZWNsIiwiT1BFTl9UQUciLCJQUk9DX0lOU1QiLCJwcm9jSW5zdE5hbWUiLCJwcm9jSW5zdEJvZHkiLCJwYWQiLCJqb2luIiwidG9VcHBlckNhc2UiLCJDT01NRU5UIiwiY29tbWVudCIsImRvY3R5cGUiLCJTR01MX0RFQ0xfUVVPVEVEIiwiRE9DVFlQRV9EVEQiLCJET0NUWVBFX1FVT1RFRCIsIkRPQ1RZUEVfRFREX1FVT1RFRCIsIkNPTU1FTlRfRU5ESU5HIiwiQ09NTUVOVF9FTkRFRCIsIkNEQVRBX0VORElORyIsIkNEQVRBX0VORElOR18yIiwiUFJPQ19JTlNUX0VORElORyIsIlBST0NfSU5TVF9CT0RZIiwiT1BFTl9UQUdfU0xBU0giLCJBVFRSSUIiLCJBVFRSSUJfTkFNRSIsIkFUVFJJQl9WQUxVRSIsIkFUVFJJQl9OQU1FX1NBV19XSElURSIsIkFUVFJJQl9WQUxVRV9RVU9URUQiLCJBVFRSSUJfVkFMVUVfVU5RVU9URUQiLCJBVFRSSUJfVkFMVUVfRU5USVRZX1EiLCJBVFRSSUJfVkFMVUVfQ0xPU0VEIiwiQVRUUklCX1ZBTFVFX0VOVElUWV9VIiwiQ0xPU0VfVEFHX1NBV19XSElURSIsInJldHVyblN0YXRlIiwiYnVmZmVyIiwic3RyaW5nRnJvbUNoYXJDb2RlIiwiZmxvb3IiLCJNQVhfU0laRSIsImNvZGVVbml0cyIsImhpZ2hTdXJyb2dhdGUiLCJsb3dTdXJyb2dhdGUiLCJpbmRleCIsImNvZGVQb2ludCIsIk51bWJlciIsImlzRmluaXRlIiwiUmFuZ2VFcnJvciIsImV4cG9ydHMiLCJ3aW5kb3ciLCJpc0FycmF5IiwicmVxdWlyZSQkMCIsImhlbHBlciIsInZhbGlkYXRlT3B0aW9ucyIsImN1cnJlbnRFbGVtZW50IiwianMyeG1sIiwidGhpcyIsIl9ncmFtbWFyIiwiX25lYXJsZXkiLCJfY3JlYXRlR2VuZXJhdG9yIiwiX2NyZWF0ZVBhcnNlciIsImRlZmF1bHRTdmdEb2MiLCJkZWZhdWx0U3ZnRG9jVGVtcGxhdGUiLCJtdXJlSW50ZXJhY3Rpdml0eVJ1bm5lclRleHQiLCJEb2NIYW5kbGVyIiwic2VsZWN0b3JQYXJzZXIiLCJjcmVhdGVQYXJzZXIiLCJrZXlOYW1lcyIsImpzb24yeG1sU2V0dGluZ3MiLCJhc3NpZ24iLCJ4bWwyanNvblNldHRpbmdzIiwiZGVmYXVsdEpzb25Eb2MiLCJ4bWwyanNvbiIsIm1pbmltdW1Kc0RvYyIsInhtbDJqcyIsIm1pbmltdW1TdmdEb2MiLCJ4bWxKcyIsImpzb24yeG1sIiwidGVzdE9iaiIsInN0YW5kYXJkT2JqIiwiX2lkIiwiY3VycmVudFNlbGVjdGlvbiIsImNvbnRlbnRzIiwic3RhbmRhcmRpemUiLCJvYmoiLCJjYWxsYmFjayIsIm5vZGVzIiwic2hpZnQiLCJlbGVtZW50cyIsInVuc2hpZnQiLCJxdWVyeVRva2VucyIsInJvb3QiLCJzZWxlY3RvciIsInBhcnNlIiwiaXRlcmF0ZSIsIm1hdGNoT2JqZWN0IiwiTXVyZSIsIk1vZGVsIiwiUG91Y2hEQiIsImQzIiwiZDNuIiwiTlNTdHJpbmciLCJuYW1lc3BhY2VzIiwibXVyZSIsIkNPTlRFTlRfRk9STUFUUyIsImRiIiwiZXJyb3JNZXNzYWdlIiwid2FybiIsImNhdGNoRGJFcnJvciIsImVycm9yT2JqIiwidHJpZ2dlciIsInN0YWNrIiwiYWxlcnQiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImNvbmZpcm0iLCJwcm9tcHQiLCJkZWZhdWx0VmFsdWUiLCJzaG93RGlhbG9nRnVuY3Rpb24iLCJhcHBOYW1lIiwibmV3VGFiIiwib3BlbiIsImxvY2F0aW9uIiwicGF0aG5hbWUiLCJjb3VjaERiVXJsIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsImNvdWNoRGIiLCJza2lwX3NldHVwIiwic3luYyIsImxpdmUiLCJyZXRyeSIsImNhdGNoIiwiZXJyIiwiZG9jSWQiLCJnZXQiLCJkb2NIIiwidGhlbiIsImRvYyIsImRvd25sb2FkRG9jIiwieG1sVGV4dCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwidXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiQmxvYiIsInR5cGUiLCJocmVmIiwiZG93bmxvYWQiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJjbGljayIsInJldm9rZU9iamVjdFVSTCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsInBsdWdpbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsTUFBTSxhQUFhLENBQUM7RUFDbEIsaUJBQWlCLENBQUMsQ0FBQyxVQUFVLEVBQUU7SUFDN0IsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUk7TUFDdEIsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssU0FBUyxFQUFFO1FBQ3pCLE1BQU0sSUFBSSxTQUFTLENBQUMsQ0FBQyxHQUFHLDBCQUEwQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7T0FDN0U7S0FDRixDQUFDLENBQUM7R0FDSjtDQUNGOztBQUVELE1BQU0sS0FBSyxTQUFTLGFBQWEsQ0FBQztFQUNoQyxXQUFXLENBQUMsR0FBRztJQUNiLEtBQUssRUFBRSxDQUFDO0lBQ1IsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7R0FDekI7RUFDRCxFQUFFLENBQUMsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLHVCQUF1QixFQUFFO0lBQ2hELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO01BQ2xDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO0tBQ3BDO0lBQ0QsSUFBSSxDQUFDLHVCQUF1QixFQUFFO01BQzVCLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7UUFDMUQsT0FBTztPQUNSO0tBQ0Y7SUFDRCxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztHQUM5QztFQUNELEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUU7SUFDeEIsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO01BQ2pDLElBQUksQ0FBQyxRQUFRLEVBQUU7UUFDYixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7T0FDdEMsTUFBTTtRQUNMLElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVELElBQUksS0FBSyxJQUFJLENBQUMsRUFBRTtVQUNkLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztTQUNoRDtPQUNGO0tBQ0Y7R0FDRjtFQUNELE9BQU8sQ0FBQyxHQUFHO0lBQ1QsSUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzdCLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDcEQsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxFQUFFO01BQ2pDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSTtRQUNoRCxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU07VUFDdEIsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDNUIsRUFBRSxDQUFDLENBQUMsQ0FBQztPQUNQLENBQUMsQ0FBQztLQUNKO0dBQ0Y7Q0FDRjs7QUNqREQsZUFBZSxPQUFPLE1BQU0sS0FBSyxXQUFXLEdBQUcsTUFBTTtZQUN6QyxPQUFPLElBQUksS0FBSyxXQUFXLEdBQUcsSUFBSTtZQUNsQyxPQUFPLE1BQU0sS0FBSyxXQUFXLEdBQUcsTUFBTSxHQUFHLEVBQUU7O0FDRHZELElBQUksTUFBTSxHQUFHLEdBQUU7QUFDZixJQUFJLFNBQVMsR0FBRyxHQUFFO0FBQ2xCLElBQUksR0FBRyxHQUFHLE9BQU8sVUFBVSxLQUFLLFdBQVcsR0FBRyxVQUFVLEdBQUcsTUFBSztBQUNoRSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUM7QUFDbkIsU0FBUyxJQUFJLElBQUk7RUFDZixNQUFNLEdBQUcsSUFBSSxDQUFDO0VBQ2QsSUFBSSxJQUFJLEdBQUcsbUVBQWtFO0VBQzdFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUU7SUFDL0MsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLEVBQUM7SUFDbkIsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFDO0dBQ2xDOztFQUVELFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRTtFQUNqQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUU7Q0FDbEM7O0FBRUQsQUFBTyxTQUFTLFdBQVcsRUFBRSxHQUFHLEVBQUU7RUFDaEMsSUFBSSxDQUFDLE1BQU0sRUFBRTtJQUNYLElBQUksRUFBRSxDQUFDO0dBQ1I7RUFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQUUsSUFBRztFQUNuQyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTTs7RUFFcEIsSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtJQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0RBQWdELENBQUM7R0FDbEU7Ozs7Ozs7RUFPRCxZQUFZLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFDOzs7RUFHdEUsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFlBQVksRUFBQzs7O0VBR3pDLENBQUMsR0FBRyxZQUFZLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBRzs7RUFFcEMsSUFBSSxDQUFDLEdBQUcsRUFBQzs7RUFFVCxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRTtJQUN4QyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUM7SUFDbEssR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRSxJQUFJLEtBQUk7SUFDN0IsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUk7SUFDNUIsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLEtBQUk7R0FDdEI7O0VBRUQsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFO0lBQ3RCLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBQztJQUNuRixHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEdBQUcsS0FBSTtHQUN0QixNQUFNLElBQUksWUFBWSxLQUFLLENBQUMsRUFBRTtJQUM3QixHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUM7SUFDOUgsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUk7SUFDNUIsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLEtBQUk7R0FDdEI7O0VBRUQsT0FBTyxHQUFH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LEVBQUUsTUFBTSxFQUFFO0VBQ3hELElBQUksQ0FBQyxFQUFFLEVBQUM7RUFDUixJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFDO0VBQ2hDLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFDO0VBQzFCLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxFQUFDO0VBQ3JCLElBQUksS0FBSyxHQUFHLENBQUMsRUFBQztFQUNkLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUM7RUFDL0IsSUFBSSxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUM7RUFDckIsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUM7O0VBRTFCLENBQUMsSUFBSSxFQUFDOztFQUVOLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUM7RUFDN0IsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFDO0VBQ2QsS0FBSyxJQUFJLEtBQUk7RUFDYixPQUFPLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLEVBQUUsRUFBRTs7RUFFMUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBQztFQUM3QixDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUM7RUFDZCxLQUFLLElBQUksS0FBSTtFQUNiLE9BQU8sS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxJ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QUMsTUFBTSxHQUFHLEVBQUUsVUFBVSxFQUFDO0VBQ3JDLElBQUksR0FBRyxHQUFHLEVBQUM7RUFDWCxPQUFPLFVBQVUsR0FBRyxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxFQUFFO0lBQ3ZDLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsVUFBVSxDQUFDLEdBQUcsSUFBRztHQUN6Qzs7RUFFRCxPQUFPLEdBQUc7RUFDWDs7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxTQUFTLFNBQVMsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQ2pFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7RUFDcEI7O0FBRUQsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtFQUN2RSxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUM7RUFDbEQsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDOUM7O0FBRUQsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtFQUN2RSxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUM7RUFDbEQsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7RUFDOUM7O0FBRUQsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEdBQUcsU0FBUyxZQUFZLEVBQUUs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LENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxTQUFTLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQy9ELElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQ2pELFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztFQUN4Qzs7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFdBQVcsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQ3JFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUM7RUFDaEQsT0FBTyxDQUFDLEdBQUcsR0FBRyxNQUFNLElBQUksR0FBRyxHQUFHLFVBQVUsR0FBRyxHQUFHO0VBQy9DOztBQUVELE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLFNBQVMsV0FBVyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7RUFDckUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDO0VBQ2xELElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQztFQUNoRCxPQUFPLENBQUMsR0FBRyxHQUFHLE1BQU0sSUFBSSxHQUFHLEdBQUcsVUFBVSxHQUFHLEdBQUc7RUFDL0M7O0FBRUQsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsU0FBUyxXQUFXLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtFQUNyRSxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUM7O0VBRWxELE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO0tBQ2pCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0tBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0VBQzNCOztBQUVELE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxHQUFHLFNBQVMsV0FBVyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7RUFDckUsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDOztFQUVsRCxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUU7S0FDdkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDdkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDdEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztFQUNyQjs7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFdBQVcsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQ3JFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxPQUFPQyxJQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztFQUMvQzs7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxTQUFTLFdBQVcsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQ3JFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxPQUFPQSxJQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztFQUNoRDs7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFlBQVksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQ3ZFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxPQUFPQSxJQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztFQUMvQzs7QUFFRCxNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFlBQVksRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO0VBQ3ZFLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztFQUNsRCxPQUFPQSxJQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztFQUNoRDs7QUFFRCxTQUFTLFFBQVEsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRTtFQUNwRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxJQUFJLFNBQVMsQ0FBQyw2Q0FBNkMsQ0FBQztFQUM5RixJQUFJLEtBQUssR0FBRyxHQUFHLElBQUksS0FBSyxHQUFHLEdB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Q0gsR0FuQ0c7Y0FvQ0gsR0FwQ0c7YUFxQ0osR0FyQ0k7YUFzQ0osR0F0Q0k7Y0F1Q0gsR0F2Q0c7YUF3Q0osR0F4Q0k7Y0F5Q0gsR0F6Q0c7WUEwQ0wsR0ExQ0s7Y0EyQ0gsR0EzQ0c7Y0E0Q0gsR0E1Q0c7YUE2Q0osR0E3Q0k7Y0E4Q0gsR0E5Q0c7V0ErQ04sR0EvQ007WUFnREwsR0FoREs7Y0FpREgsR0FqREc7YUFrREosR0FsREk7Y0FtREgsR0FuREc7WUFvREwsR0FwREs7Y0FxREgsR0FyREc7Y0FzREgsR0F0REc7YUF1REosR0F2REk7Y0F3REgsR0F4REc7Y0F5REgsR0F6REc7Y0EwREgsR0ExREc7WUEyREwsR0EzREs7YUE0REosR0E1REk7YUE2REosR0E3REk7Y0E4REgsR0E5REc7YUErREosR0EvREk7Y0FnRUgsR0FoRUc7WUFpRUwsR0FqRUs7Y0FrRUgsR0FsRUc7WUFtRUwsR0FuRUs7WUFvRUwsR0FwRUs7V0FxRU4sR0FyRU07WUFzRUwsR0F0RUs7YUF1RUosR0F2RUk7WUF3RUwsR0F4RUs7YUF5RUosR0F6RUk7Y0EwRUgsR0ExRUc7V0EyRU4sR0EzRU07Y0E0RUgsR0E1RUc7WUE2RUwsR0E3RUs7V0E4RU4sR0E5RU07WUErRUwsR0EvRUs7YUFnRkosR0FoRkk7V0FpRk4sR0FqRk07V0FrRk4sR0FsRk07WUFtRkwsR0FuRks7V0FvRk4sR0FwRk07Y0FxRkgsR0FyRkc7WUFzRkwsR0F0Rks7WUF1RkwsR0F2Rks7WUF3RkwsR0F4Rks7YUF5RkosR0F6Rkk7YUEwRkosR0ExRkk7WUEyRkwsR0EzRks7Y0E0RkgsR0E1Rkc7YUE2RkosR0E3Rkk7WUE4RkwsR0E5Rks7YUErRkosR0EvRkk7Y0FnR0gsR0FoR0c7Y0FpR0gsR0FqR0c7Y0FrR0gsR0FsR0c7Y0FtR0gsR0FuR0c7YUFvR0osR0FwR0k7Y0FxR0gsR0FyR0c7YUFzR0osR0F0R0k7YUF1R0osR0F2R0k7Y0F3R0gsR0F4R0c7Y0F5R0gsR0F6R0c7WUEwR0wsR0ExR0s7WUEyR0wsR0EzR0s7WUE0R0wsR0E1R0s7YUE2R0osR0E3R0k7YUE4R0osR0E5R0k7WUErR0wsR0EvR0s7YUFnSEosR0FoSEk7YUFpSEosR0FqSEk7ZUFrSEYsR0FsSEU7WUFtSEwsR0FuSEs7V0FvSE4sR0FwSE07YUFxSEosR0FySEk7WUFzSEwsR0F0SEs7YUF1SEosR0F2SEk7Y0F3SEgsR0F4SEc7VUF5SFAsR0F6SE87VUEwSFAsR0ExSE87VUEySFAsR0EzSE87ZUE0SEYsR0E1SEU7VUE2SFAsR0E3SE87V0E4SE4sR0E5SE07YUErSEosR0EvSEk7V0FnSU4sR0FoSU07ZUFpSUYsR0FqSUU7V0FrSU4sR0FsSU07V0FtSU4sR0FuSU07V0FvSU4sR0FwSU07YUFxSUosR0FySUk7YUFzSUosR0F0SUk7WUF1SUwsR0F2SUs7YUF3SUosR0F4SUk7YUF5SUosR0F6SUk7ZUEwSUYsR0ExSUU7WUEySUwsR0EzSUs7V0E0SU4sR0E1SU07YUE2SUosR0E3SUk7WUE4SUwsR0E5SUs7YUErSUosR0EvSUk7Y0FnSkgsR0FoSkc7VUFpSlAsR0FqSk87VUFrSlAsR0FsSk87VUFtSlAsR0FuSk87ZUFvSkYsR0FwSkU7VUFxSlAsR0FySk87V0FzSk4sR0F0Sk07Y0F1SkgsR0F2Skc7YUF3SkosR0F4Skk7V0F5Sk4sR0F6Sk07ZUEwSkYsR0ExSkU7V0EySk4sR0EzSk07V0E0Sk4sR0E1Sk07V0E2Sk4sR0E3Sk07YUE4SkosR0E5Skk7Z0JBK0pELEdBL0pDO2FBZ0tKLEdBaEtJO1dBaUtOLEdBaktNO1lBa0tMLElBbEtLO1lBbUtMLElBbktLO2NBb0tILElBcEtHO1lBcUtMLElBcktLO1dBc0tOLElBdEtNO1dBdUtOLElBdktNO1dBd0tOLElBeEtNO2FBeUtKLElBektJO2FBMEtKLElBMUtJO2FBMktKLElBM0tJO2FBNEtKLElBNUtJO2FBNktKLElBN0tJO2FBOEtKLElBOUtJO2FBK0tKLElBL0tJO2FBZ0xKLElBaExJO2NBaUxILElBakxHO2NBa0xILElBbExHO1lBbUxMLElBbkxLO2NBb0xILElBcExHO2NBcUxILElBckxHO2FBc0xKLElBdExJO2FBdUxKLElBdkxJO2NBd0xILElBeExHO2NBeUxILElBekxHO2FBMExKLElBMUxJO2FBMkxKLElBM0xJO1lBNExMLElBNUxLO2FBNkxKLElBN0xJO2NBOExILElBOUxHO1lBK0xMLElBL0xLO2FBZ01KLElBaE1JO2VBaU1GLElBak1FO1lBa01MLElBbE1LO1lBbU1MLElBbk1LO1lBb01MLElBcE1LO1lBcU1MLElBck1LO1lBc01MLElBdE1LO2FBdU1KLElBdk1JO1lBd01MLElBeE1LO1lBeU1MLElBek1LO1lBME1MLElBMU1LO1lBMk1MLElBM01LO1lBNE1MLElBNU1LO2NBNk1ILElBN01HO1lBOE1MLElBOU1LO2FBK01KLElBL01JO2FBZ05KLElBaE5JO2FBaU5KLElBak5JO1lBa05MLElBbE5LO2FBbU5KLElBbk5JO1VBb05QLElBcE5PO1lBcU5MLElBck5LO1dBc05OLElBdE5NO2FBdU5KLElBdk5JO2NBd05ILElBeE5HO2FBeU5KLElBek5JO1lBME5MLElBMU5LO2FBMk5KLElBM05JO1dBNE5OLElBNU5NO1dBNk5OLElBN05NO1VBOE5QLElBOU5PO1dBK05OLElBL05NO1dBZ09OLElBaE9NO1dBaU9OLElBak9NO2NBa09ILElBbE9HO1dBbU9OLElBbk9NO1lBb09MLElBcE9LO2FBcU9KLElBck9JO1VBc09QLElBdE9PO2FBdU9KLElBdk9JO1VBd09QLElBeE9PO1VBeU9QLElBek9PO1dBME9OLElBMU9NO1dBMk9OLElBM09NO1lBNE9MLElBNU9LO1lBNk9MLElBN09LO1lBOE9MLElBOU9LO2FBK09KLElBL09JO2NBZ1BILElBaFBHO1lBaVBMLElBalBLO1lBa1BMLElBbFBLO2FBbVBKLElBblBJO2FBb1BKLElBcFBJO2NBcVBILElBclBHO2NBc1BILElBdFBHO1lBdVBMLElBdlBLO1lBd1BMLElBeFBLO1dBeVBOLElBelBNO2NBMFBILElBMVBHO2FBMlBKLElBM1BJO2NBNFBILElBNVBHO2FBNlBKO0dBN1BYOztTQWdRT2dCLElBQVAsQ0FBWTNDLElBQUkyQixRQUFoQixFQUEwQmtELE9BQTFCLENBQWtDLFVBQVVvQyxHQUFWLEVBQWU7UUFD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
