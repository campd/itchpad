/**
 * Hastily-written local file backend for ItchPad
 */

const { Cc, Ci, Cu, ChromeWorker } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { TextEncoder, TextDecoder } = require('sdk/io/buffer')
const { emit } = require("sdk/event/core");
const { ProjectStore, Resource } = require("stores/base");
const data = require("sdk/self").data;
const promise = require("helpers/promise");
const Task = require("helpers/task");
const URL = require("sdk/url");
const OS = require("helpers/osfile");

const spawn = Task.spawn;

const { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});
const { XPCOMUtils } = Cu.import("resource://gre/modules/XPCOMUtils.jsm", {});

XPCOMUtils.defineLazyServiceGetter(this, "mimeService", "@mozilla.org/mime;1", "nsIMIMEService");

const gDecoder = new TextDecoder();
const gEncoder = new TextEncoder();

const IGNORE_REGEX = /(^\.)|(\~$)|(^node_modules$)/;

var LocalStore = Class({
  extends: ProjectStore,

  defaultCategory: "js",

  initialize: function(path) {
    this.initStore();
    this.path = OS.Path.normalize(path);
    this.rootPath = this.path;
    this.displayName = this.path;
    this.rootResource = this.forPath(this.path);
    this.refresh();
  },

  toString: function() { return "[LocalStore:" + this.path + "]" },

  forPath: function(path, info=null) {
    if (this.resources.has(path)) {
      return this.resources.get(path);
    }

    let resource = FileResource(this, path, info);
    this.resources.set(path, resource);
    this.notifyAdd(resource);
    return resource;
  },

  resourceFor: function(path, options) {
    path = OS.Path.normalize(path);
    if (this.resources.has(path)) {
      return promise.resolve(this.resources.get(path));
    }

    if (!this.contains(path)) {
      return promise.reject(new Error(path + " does not belong to " + this.path));
    }

    return spawn(function() {
      let parent = yield this.resourceFor(OS.Path.dirname(path));

      let info;
      try {
        info = yield OS.File.stat(path);
      } catch (ex if ex instanceof OS.File.Error && ex.becauseNoSuchFile) {
        if (!options.create) {
          throw ex;
        }
      }

      let resource = this.forPath(path, info);
      resource.parent = parent;
      parent.children.add(resource);
      emit(parent, "children-changed", parent);
      throw new Task.Result(resource);
    }.bind(this));
  },

  refresh: function(path=this.rootPath) {
    let deferred = promise.defer();

    let worker = new ChromeWorker(data.url("readdir.js"));
    let start = Date.now();
    worker.onmessage = evt => {
      for (path in evt.data) {
        let info = evt.data[path];
        info.path = path;

        let resource = this.forPath(path, info);
        resource.info = info;
        if (info.isDir) {
          let newChildren = new Set();
          for (let childPath of info.children) {
            childInfo = evt.data[childPath];
            let child = this.forPath(childPath, childInfo);
            child.parent = resource;
            newChildren.add(child);
          }
          this.notifyMissing(resource.children, newChildren);
          resource.children = newChildren;
          emit(resource, "children-changed", resource);
        }
        resource.info.children = null;
      }

      deferred.resolve();
    };
    worker.onerror = ex => {
      console.error(ex);
      deferred.reject(ex);
    }
    worker.postMessage({ path: this.rootPath, ignore: IGNORE_REGEX });
    return deferred.promise;
  },

  contains: function(path) {
    path = OS.Path.normalize(path);
    let thisPath = OS.Path.split(this.rootPath);
    let thatPath = OS.Path.split(path)

    if (!(thisPath.absolute && thatPath.absolute)) {
      throw new Error("Contains only works with absolute paths.");
    }

    if (thisPath.winDrive && (thisPath.winDrive != thatPath.winDrive)) {
      return false;
    }

    if (thatPath.components.length <= thisPath.components.length) {
      return false;
    }

    for (let i = 0; i < thisPath.components.length; i++) {
      if (thisPath.components[i] != thatPath.components[i]) {
        return false;
      }
    }
    return true;
  },

  root: function() {
    return OS.File.stat(this.rootPath).then(info => {
      this.forPath(this.rootPath, info);
      this.rootResource.info = info;
      return this.rootResource;
    });
  },
});
exports.LocalStore = LocalStore;

var FileResource = Class({
  extends: Resource,

  initialize: function(store, path, info) {
    this.store = store;
    this.path = path;

    this.uri = URL.URL(URL.fromFilename(path));
    this.children = new Set();
    this._lastReadModification = undefined;

    this.info = info;
    this.parent = null;
  },

  toString: function() {
    return "[FileResource:" + this.path + "]";
  },

  // Returns the path relative to the store.
  relativePath: function() {
    if (!this._relativePath) {
      if (this.path.startsWith(this.store.path)) {
        this._relativePath = OS.Path.basename(this.store.path) + this.path.substring(this.store.path.length);
      } else {
        this._relativePath = this.path;
      }
    }
    return this._relativePath;
  },

  get displayName() { return this.basename + (this.isDir ? "/" : "") },

  get isDir() {
    if (!this.info) { return false; }
    return this.info.isDir && !this.info.isSymLink
  },
  get hasChildren() { return this.children.size > 0 },

  refresh: function() {
    return this.updateChildren();
  },

  load: function() {
    return OS.File.read(this.path).then(bytes => {
      return gDecoder.decode(bytes);
    });
  },

  addChild: function(name, initial="") {
    if (!this.isDir) {
      return promise.reject(new Error("Cannot add child to a regular file"));
    }

    let newPath = OS.Path.join(this.path, name);

    let buffer = initial ? gEncoder.encode(initial) : "";
    return OS.File.writeAtomic(newPath, buffer, {
      noOverwrite: true
    }).then(() => {
      return this.refresh();
    }).then(() => {
      let resource = this.store.resources.get(newPath);
      if (!resource) {
        throw new Error("Error creating " + newPath);
      }
      return resource;
    }).then(null, console.error);
  },

  /**
   * Write a string to the file.
   */
  save: function(str) {
    let buffer = gEncoder.encode(str);
    return OS.File.writeAtomic(this.path, buffer, { tmpPath: this.path + ".tmp" });
  },

  get contentType() {
    if (this._contentType) {
      return this._contentType;
    }
    try {
      this._contentType = mimeService.getTypeFromFile(new FileUtils.File(this.path));
    } catch(ex) {
      console.error(ex);
      this._contentType = null;
    }
    return this._contentType;
  },

  updateChildren: function() {
    return this.store.refresh(this.path);
  }
});

var ScratchStore = Class({
  extends: LocalStore,

  initialize: function() {
    let path = OS.Path.join(OS.Constants.Path.profileDir, "Scratch");
    this.path = path;
    this.initStore();
    this.rootPath = path;
    this.displayName = "Scratch";

    this._rootPromise = OS.File.makeDir(path, {
      ignoreExisting: true
    }).then(() => {
      return OS.File.stat(this.rootPath);
    }).then(info => {
      this.rootResource = ScratchRoot(this, path, info);
      this.resources.set(path, this.rootResource);
      this.refresh();
      return this.rootResource;
    });
  },

  root: function() {
    return this._rootPromise;
  }
});
exports.ScratchStore = ScratchStore;

var ScratchRoot = Class({
  extends: FileResource,

  initialize: function(store, path, info) {
    FileResource.prototype.initialize.call(this, store, path, info);
  },

  get displayName() { return "Scratch" }
});

var OpenStore = Class({
  extends: LocalStore,

  initialize: function() {
    this.initStore();
    this.displayName = "Open";
    this.rootResource = OpenRoot(this);
  },

  toString: function() { return "[OpenStore]"; },

  root: function() {
    return promise.resolve(this.rootResource);
  },

  resourceFor: function(path, options) {
    path = OS.Path.normalize(path);

    if (this.resources.has(path)) {
      return promise.resolve(this.resources.get(path));
    }

    return spawn(function() {
      let info;
      try {
        info = yield OS.File.stat(path);
      } catch (ex if ex instanceof OS.File.Error && ex.becauseNoSuchFile) {
        if (!options.create) {
          throw ex;
        }
      }
      let resource = this.forPath(path, info);
      this.rootResource.add(resource);
      throw new Task.Result(resource);
    }.bind(this));
  }
});
exports.OpenStore = OpenStore;

var OpenRoot = Class({
  extends: FileResource,

  initialize: function(store) {
    this.store = store;
    this.children = new Set();
  },

  toString: function() { return "[OpenStore Root]"; },

  get displayName() { return "Open Files" },
  get isDir() { return true; },
  get hasChildren() { return this.children.size > 0 },

  add: function(resource) {
    resource.parent = this;
    this.children.add(resource);
    emit(this, "children-changed", this);
  }
});

