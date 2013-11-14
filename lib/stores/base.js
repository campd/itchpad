const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const URL = require("sdk/url");

var ProjectStore = Class({
  extends: EventTarget,

  // Should be called during initialize() of a subclass.
  initStore: function() {
    this.nodes = new Map();
  },

  refresh: function() {
    return Promise.resolve();
  },

  root: function() {
    throw new Error("root() is not implemented by this project store.");
  }
});
exports.ProjectStore = ProjectStore;

var ProjectNode = Class({
  extends: EventTarget,

  set uri(uri) {
    this._uriBasename = uriBasename(uri);
  },
  get uri() { throw new Error("Subclass doesn't provide a uri member.")},

  get basename() { return this._uriBasename },

  get title() { return this.basename },
  get displayName() { return this.basename },

  get isDir() { return false; },
  get hasChildren() { return false; },
});
exports.ProjectNode = ProjectNode;

// Surely there's a better way to do this.
function uriBasename(uri) {
  var basename = uri.path;

  let idx = uri.path.lastIndexOf("/", basename.length - 2);
  if (idx > -1) {
    basename = uri.path.substring(idx + 1);
  }

  if (basename[basename.length - 1] === "/") {
    basename = basename.substring(0, basename.length - 1);
  }

  return basename;
}

