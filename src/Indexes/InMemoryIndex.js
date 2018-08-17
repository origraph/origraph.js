class InMemoryIndex {
  constructor () {
    this.entries = {};
    this.complete = false;
  }
  * iterValues (key) {
    for (let value of (this.entries[key] || [])) {
      yield value;
    }
  }
  getValues (key) {
    return this.entries[key] || [];
  }
  addValue (key, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[key] = this.getValues(key);
    this.entries[key].push(value);
  }
}
export default InMemoryIndex;
