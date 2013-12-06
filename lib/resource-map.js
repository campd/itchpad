const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");
const timers = require("sdk/timers");
const { on, off, forget } = require("event/scope");

var Pair = Class({
  extends: EventTarget,

  initialize: function(map, project=null, live=null) {
    this.map = map;
    this._updateSource("project", project, false);
    this._updateSource("live", live, false);
  },

  toString: function() {
    return "[Pair " + this._project + ":" + this._live + "]";
  },

  get project() { return this._project },
  set project(resource) {
    this._updateSource("project", resource, true);
  },

  get live() { return this._live },
  set live(resource) {
    this._updateSource("live", resource, true);
  },

  _updateSource: function(aspect, resource, notify) {
    let val = "_" + aspect;
    let map = this.map;

    if (resource === this[val]) {
      return;
    }

    if (resource) {
      // No other pair can own this.
      let other = map.pairs.get(resource);
      if (other) {
        other[aspect] = null;
      }
    }

    if (this[val]) {
      map.pairs.delete(this[val]);
    }

    this[val] = resource;

    if (resource) {
      map.pairs.set(resource, this);
    }

    if (notify) {
      emit(this, "changed", aspect);
    }
  }
});

exports.Pair = Pair;

// Maintains the list of pairs.
var ResourceMap = Class({
  initialize: function() {
    this.liveStores = new Set();
    this.pairs = new Map();
    this.manualPairs = new Map();

    this.scheduleRebuild = this.scheduleRebuild.bind(this);
  },

  setProject: function(project) {
    this.unwatchCollection(this.project);
    this.project = project;
    this.watchCollection(this.project);
    this.scheduleRebuild();
  },

  setPage: function(page) {
    this.unwatchCollection(this.page);
    this.page = page;
    this.watchCollection(this.page);
    this.scheduleRebuild();
  },

  watchCollection: function(collection) {
    on(this, collection, "resource-added", this.scheduleRebuild);
    on(this, collection, "resource-removed", this.scheduleRebuild);
  },

  unwatchCollection: function(collection) {
    forget(this, collection);
  },

  scheduleRebuild: function() {
    if (this._scheduledRebuild) {
      timers.clearTimeout(this._scheduledRebuild);
    }
    this._scheduledRebuild = timers.setTimeout(this.rebuild.bind(this), 100);
  },

  manualPair: function(project, live) {
    let pair;

    let pair = this.pairs.get(project);
    if (!pair) {
      pair = this.pairs.get(live);
    }
    if (!pair) {
      pair = new Pair(this, project, live);
    }
    pair.project = project;
    pair.live = live;

    // XXX: Manual pairs should probably be by path, otherwise
    // they won't last through a refresh.  Will fix that later.
    this.manualPairs.set(live, pair);
    this.rebuild();
  },

  /**
   * Rebuild the project pairings.
   */
  rebuild: function() {
    if (this._scheduledRebuild) {
      timers.clearTimeout(this._scheduledRebuild);
      this._scheduledRebuild = null;
    }
    let start = Date.now();
    // Rules:
    // - Pairs stay with the local resource if they change.

    let newPairs = new Map();

    // Walk through all live resources...
    for (let live of this.page.allResources()) {
      if (live.isDir) {
        continue;
      }

      // If there's a manual pair, just trust it.
      if (this.manualPairs.has(live)) {
        let manual = this.manualPairs.get(live);
        newPairs.set(manual.project, manual);
        newPairs.set(manual.live, manual);
        continue;
      }

      // Find a project resource for this resource...
      let project = this._findPair(live);

      if (!project) {
        // No paired resource, no need to save a pair, but do
        // keep the one-sided pair around if there is one.
        let oldPair = this.pairs.get(live);
        if (oldPair) {
          // Just in case.
          oldPair.project = null;

          newPairs.set(live, oldPair);
        }
        continue;
      }

      // We have a real pair.  Update it if it already exists.
      // XXX: This could leave us with an empty pair, make
      // sure editors close properly...
      let pair = this.pairs.get(project);
      if (pair) {
        pair.live = live;
      } else {
        pair = new Pair(this, project, live);
      }
      newPairs.set(live, pair);
      newPairs.set(project, pair);

      // Remove the project link from the map so the next pass
      // doesn't pick it up.
      this.pairs.delete(project);
    }

    // Now newPairs has pairs for all live resources that
    // need them (either because they already had a single-sided pair
    // in the wild or because they found a real pair)
    // Now make sure that any project resources with an outstanding pair
    // are included.
    for (let project of this.project.allResources()) {
      let newPair = newPairs.get(project);
      if (newPair) {
        // Already taken care of.
        continue;
      }
      let oldPair = this.pairs.get(project);
      if (oldPair) {
        oldPair.live = null;
        newPairs.set(project, oldPair);
      }
    }

    this.pairs = newPairs;
    let end = Date.now();
    console.log("Rebuilt project map in " + (end - start) + "ms");
  },

  pair: function(resource) {
    if (this.pairs.has(resource)) {
      return this.pairs.get(resource);
    }

    // Didn't find a pair in the project map, go ahead and create
    // a one-sided pair.
    let pair;
    if (resource.isProject) {
      pair = new Pair(this, resource, null);
    } else {
      pair = new Pair(this, null, resource);
    }
    this.pairs.set(resource, pair);
    return pair;
  },

  /**
   * Find the best project pair for a given live resource.
   *
   * Right now we only have one strategy, but new strategies
   * can be added here.
   */
  _findPair: function(live) {
    return this._fuzzyStrategy(live);
  },

  /**
   * The default fuzzy match strategy for finding a live pairing.
   * Finds a project resources with the same basename, and chooses
   * the one with the most path component matches.
   */
  _fuzzyStrategy: function(resource) {
    let matches = this._findBasenameMatches(resource.basename);
    if (matches.length < 1) {
      return null;
    }

    let searchPath = resource.uri.path.split('/').filter(item => !!item);
    searchPath.reverse();

    let bestMatch = null;
    let bestMatchComponents = 0;
    let bestMatchExtra = 1000;
    for (let match of matches) {
      let matchPath = match.uri.path.split('/').filter(item => !!item);
      matchPath.reverse();
      let i;
      for (i = 0; i < matchPath.length && i < searchPath.length; i++) {
        if (matchPath[i] != searchPath[i]) {
          break;
        }
      }

      // In case of a tie in matched components, arbitrarily assume that
      // resources closer to the project root are correct.
      let remaining = matchPath.length - i;
      if (i > bestMatchComponents ||
          (i === bestMatchComponents && remaining < bestMatchExtra)) {
        bestMatch = match;
        bestMatchComponents = i;
        bestMatchExtra = remaining;
      }
    }

    return bestMatch;
  },

  _findBasenameMatches: function(basename) {
    let matches = [];
    for (let resource of this.project.index.findBasename(basename)) {
      if (!resource.store.canPair) {
        continue;
      }
      matches.push(resource);
    }
    return matches;
  }
});
exports.ResourceMap = ResourceMap;


