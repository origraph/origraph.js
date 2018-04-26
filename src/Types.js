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
export { TYPES };

const INTERPRETATIONS = createEnum([
  'ignore',
  'node',
  'edge'
]);
export { INTERPRETATIONS };
