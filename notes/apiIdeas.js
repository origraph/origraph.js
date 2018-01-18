/* globals d3, mure, mureEdit */

/*****************************/
/** mure.js Runtime Library **/
/*****************************/

/** Models **/
mure.enterModels = {
  myStructureBuildingModel: function (data, index) {
    // append() elements based on a learned pattern;
    // this function would be auto-generated
    let a = d3.select(this).append('g');
    a.append('rect');
    let b = a.append('text');
    b.append('tspan');
    b.append('tspan');
  }
};
mure.updateModels = {
  myStandardStateModel: function (data, index) {
    // set attributes based on a learned pattern;
    // this function would be auto-generated
    let a = d3.select(this);
    a.select('rect')
      .attr('x', 100 + 20 * index)
      .attr('y', 500 - 10 * data['GDP']);
  },
  myInitialStateModel: function (data, index) {
    // this one might, for example, set up the rectangles with a height of zero,
    // and fills in / places the tspan elements
  },
  myFinalStateModel: function (data, index) {
    // this one might, for example, set the group's opacity to zero
  }
};

/** Model usage examples **/
let selection = d3.selectAll('...').data([]);
let selectionEnter = selection.enter();

// Use enter models on enter selections - these only .append() stuff
selectionEnter.each(mure.enterModels['myStructureBuildingModel']);

// Use update models on anything - these never .append() stuff
let t = d3.transition();
selectionEnter
  .each(mure.updateModels['myInitialStateModel']);
selection.exit().transition(t)
  .each(mure.updateModels['myFinalStateModel']);
selection = selection.merge(selectionEnter);
selection.transition(t)
  .each(mure.updateModels['myStandardStateModel']);

/*********************************/
/** mure-edit.js Editor Library **/
/*********************************/

mureEdit.db = { /* direct access to PouchDB (auto-initialized) */ };
// all apps should use native functions for creating / changing / deleting
// documents, and have their own settings for how to most appropriately
// respond to these events. Some apps (e.g. Illustrator) might want to
// open all documents that the user has interacted with / interpret
// creating / closing files in specific ways

// All apps should note that figuring out whether a document is new
// vs simply updated is non-trivial... but the solution should be app-dependent
// (i.e. should there be a "current document?" In some cases, yes, but others
// maybe no)

/** Convenience functions that enforce conventions for PouchDB documents **/

// change the selection in a standard way (so it can be synced across apps)
mureEdit.select = async function (fileId, selector) {};

// add data to the document in a standardized way
mureEdit.addDataset = async function (fileId, dataObj) {};

/** Utility functions **/

// calculates a selector that captures exactly the objects listed
mureEdit.calculateSelector = function (documentObj, objectList) {};

// conversion functions
mureEdit.getAsSvgText = function (fileID) {};
mureEdit.putAsSvgText = function (fileID) {};
// others? DOM conversion?

/*******************************************************************************/
/** Stuff that should probably be relegated to specific apps... but maybe not **/
/*******************************************************************************/

mureEdit.syncToFrame = function (fileId, frameElement) {};
