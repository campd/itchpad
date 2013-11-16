const { Cc, Ci, Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const URL = require("sdk/url");

const { devtoolsRequire } = require("devtools");
const NetworkHelper = devtoolsRequire("devtools/toolkit/webconsole/network-helper");

var Store = Class({
  extends: EventTarget,

  // Should be called during initialize() of a subclass.
  initStore: function() {
    this.resources = new Map();
  },

  refresh: function() {
    return Promise.resolve();
  },

  // This isn't well-thought-through at all.
  updateIndex: function() {
    let idx = new Map();
    for (let [key, resource] of this.resources) {
      let name = resource.basename;
      if (!idx.has(name)) {
        idx.set(name, []);
      }
      idx.get(name).push(resource);
    }
    this._basenameIndex = idx;
  },

  findBasename: function(basename) {
    if (!this._basenameIndex) {
      return [];
    }
    return this._basenameIndex.get(basename) || [];
  },

  root: function() {
    throw new Error("root() is not implemented by this project store.");
  }
});

ProjectStore = Class({
  extends: Store,
  isProject: true,
  isLive: false,
  aspect: "project"
});
exports.ProjectStore = ProjectStore;

LiveStore = Class({
  extends: Store,
  isProject: false,
  isLive: true,
  aspect: "live"
});
exports.LiveStore = LiveStore;

// rename: Resource
var Resource = Class({
  extends: EventTarget,

  get isProject() { return this.store.isProject },
  get aspect() { return this.store.aspect },

  set uri(uri) {
    this._uriBasename = uriBasename(uri);
    this._uri = uri;
  },
  get uri() { return this._uri },

  get basename() { return this._uriBasename },

  get title() { return this.basename },
  get displayName() { return this.basename },

  get isDir() { return false; },
  get hasChildren() { return false; },

  get contentType() { return "text/plain" },
  get contentCategory() { return NetworkHelper.mimeCategoryMap[this.contentType] || "txt" },
});

exports.Resource = Resource;

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

