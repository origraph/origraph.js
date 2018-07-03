export default (superclass) => class extends superclass {
  constructor (mure) {
    super(mure);
    this.acceptsInputOptions = false;
  }
};
