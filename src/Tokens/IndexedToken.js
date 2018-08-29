import BaseToken from './BaseToken.js';

class IndexedToken extends BaseToken {
  async wrap ({ wrappedParent, rawItem, hashes = {} }) {
    const wrappedItem = await super.wrap({ wrappedParent, rawItem });
    for (const [ hashFuncName, hash ] of Object.entries(hashes)) {
      const index = this.stream.getIndex(hashFuncName, this);
      await index.addValue(hash, wrappedItem);
    }
    return wrappedItem;
  }
}
export default IndexedToken;
