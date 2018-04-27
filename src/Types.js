import createEnum from './createEnum.js';
const TYPES = createEnum([
  'boolean',
  'number',
  'string',
  'date',
  'undefined',
  'null',
  'reference',
  'container',
  'document',
  'root'
]);

const INTERPRETATIONS = createEnum([
  'ignore',
  'node',
  'edge'
]);

const RESERVED_OBJ_KEYS = {
  '_id': true,
  '$wasArray': true,
  '$tags': true,
  '$members': true,
  '$edges': true,
  '$nodes': true,
  '$nextLabel': true
};

export { TYPES, INTERPRETATIONS, RESERVED_OBJ_KEYS };
