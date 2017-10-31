Encoding Notes
==============

For a given svg container element (whether or not it is bound to data), our objective is to create a template for its children that can be used to:
- Generate new graphics elements for unbound data items
- Correct (i.e. override) existing bound elements
- Infer bindings? (some day in the future)

We want to "learn" (better word: infer) this template based on graphics that already exist. Once a parent is identified, we can look at its immediate children to auto-construct + assist the user in creating its associated template.

Beginning with each child element of the chosen SVG root, we collect what is common to all children, and *branch* when variation is discovered:

- We branch (and DON'T regroup after) for differing *child lists*. A child list is defined as the specific order that SVG tag names OR SVG path commands (letters) appear within the current element.

- We branch, and then regroup, for differing attribute values; we treat:
  - transform parameters
  - channels in rgba()-like values
  - anchor and handle coordinates in SVG path commands
  as distinct attribute values

The user's task at each branch:
- select a constant value for the template OR
- a data-based rule can be learned:
  - basic rules:
    - linear regression
    - simple value-value lookup table
  - advanced rules:
    - log, polynomial, etc. regressions
    - discover patterns in a histogram of the keys of the simple lookup table that can be used for more intelligent binning (e.g. non-overlapping numeric ranges)
    - discover and merge similar lookup tables (e.g. multiple child elements with the same data-driven fills), possibly from other templates (e.g. ids -> locations for nodes and edges)

To assist the user in this task:
- We calculate and visualize a histogram of each observed variation
- Initially, the system will auto-construct a template based on heuristics:
  - TODO
