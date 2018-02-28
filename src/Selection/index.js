import { createParser } from 'scalpel';

class Selection {
  constructor (selector) {
    let parser = createParser();
    this.queryTokens = parser.parse(selector);
  }
}
export default Selection;
