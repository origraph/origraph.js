class ParseFailure extends Error {
  constructor (fileFormat) {
    super(`Failed to parse format: ${fileFormat.constructor.name}`);
  }
}
export default ParseFailure;
