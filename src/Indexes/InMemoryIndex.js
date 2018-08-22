class InMemoryIndex {
  constructor () {
    this.entries = {};
    this.complete = false;
  }
  async * iterEntries () {
    for (const [hash, valueList] of Object.entries(this.entries)) {
      yield { hash, valueList };
    }
  }
  async * iterHashes () {
    for (const hash of Object.keys(this.entries)) {
      yield hash;
    }
  }
  async * iterValueLists () {
    for (const valueList of Object.values(this.entries)) {
      yield valueList;
    }
  }
  async getValueList (hash) {
    return this.entries[hash] || [];
  }
  async addValue (hash, value) {
    // TODO: add some kind of warning if this is getting big?
    this.entries[hash] = await this.getValueList(hash);
    this.entries[hash].push(value);
  }
}
export default InMemoryIndex;
