/**
 * Hastily-written local file backend for ItchPad
 */

const { Cc, Ci, Cu, ChromeWorker } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { TextEncoder, TextDecoder } = require('sdk/io/buffer')
const { emit } = require("sdk/event/core");
const { ProjectStore, Resource } = require("stores/base");
const task = require("helpers/task");
const data = require("sdk/self").data;
const promise = require("helpers/promise");
const Task = require("helpers/task");
const URL = require("sdk/url");
const OS = require("helpers/osfile");
const { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const mimeService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);


const CHECK_LINKED_DIRECTORY_DELAY = 5000;
const SHOULD_LIVE_REFRESH = true;
const spawn = Task.spawn;

const gDecoder = new TextDecoder();
const gEncoder = new TextEncoder();

// XXX: Ignores should probably be handled differently.
const IGNORE_REGEX = /(^\.)|(\~$)|(^node_modules$)/;

var LocalStore = Class({
  extends: ProjectStore,

  defaultCategory: "js",

  initialize: function(path) {
    this.initStore();
    this.window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
    this.path = OS.Path.normalize(path);
    this.rootPath = this.path;
    this.displayName = this.path;
    this.setRoot(this._forPath(this.path));
    this.refreshLoop = this.refreshLoop.bind(this);
    this.refreshLoop();
  },

  destroy: function() {
    this.window.clearTimeout(this._refreshTimeout);
    this._refreshTimeout = null;
    this.window = null;
  },

  toString: function() { return "[LocalStore:" + this.path + "]" },

  /**
   * Return a FileResource object for the given path.  If a FileInfo
   * is provided, the resource will use it, otherwise the FileResource
   * might not have full information until the next refresh.
   */
  _forPath: function(path, info=null) {
    if (this.resources.has(path)) {
      return this.resources.get(path);
    }

    let resource = FileResource(this, path, info);
    this.resources.set(path, resource);
    return resource;
  },

  /**
   * Return a promise that resolves to a fully-functional FileResource
   * within this project.  This will hit the disk for stat info.
   * options:
   *   create: If true, a resource will be created even if the underlying
   *     file doesn't exist.
   */
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

      let resource = this._forPath(path, info);
      parent.addChild(resource);
      throw new Task.Result(resource);
    }.bind(this));
  },

  refreshLoop: function() {
    // XXX: should we only refresh if the project is active?
    this.refresh().then(() => {
      if (SHOULD_LIVE_REFRESH) {
        this._refreshTimeout = this.window.setTimeout(this.refreshLoop,
          CHECK_LINKED_DIRECTORY_DELAY);
      }
    });
  },

  _refreshTimeout: null,
  _refreshPromise: null,

  /**
   * Refresh the directory structure.
   */
  refresh: function(path=this.rootPath) {
    if (this._refreshPromise) {
      return this._refreshPromise.promise;
    }

    this._refreshPromise = promise.defer();

    let worker = new ChromeWorker(data.url("readdir.js"));
    let start = Date.now();

    worker.onmessage = evt => {
      // console.log("Directory read finished in " + ( Date.now() - start ) +"ms", evt);
      for (path in evt.data) {
        let info = evt.data[path];
        info.path = path;

        let resource = this._forPath(path, info);
        resource.info = info;
        if (info.isDir) {
          let newChildren = new Set();
          for (let childPath of info.children) {
            childInfo = evt.data[childPath];
            newChildren.add(this._forPath(childPath, childInfo));
          }
          resource.setChildren(newChildren);
        }
        resource.info.children = null;
      }

      worker = null;
      this._refreshPromise.resolve();
      this._refreshPromise = null;
    };
    worker.onerror = ex => {
      console.error(ex);
      worker = null;
      this._refreshPromise.reject(ex);
      this._refreshPromise = null;
    }
    worker.postMessage({ path: this.rootPath, ignore: IGNORE_REGEX });
    return this._refreshPromise.promise;
  },

  /**
   * Returns true if the given path would be a child of the store's
   * root directory.
   */
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
  }
});
exports.LocalStore = LocalStore;

var FileResource = Class({
  extends: Resource,

  initialize: function(store, path, info) {
    this.store = store;
    this.path = path;

    this.setURI(URL.URL(URL.fromFilename(path)));
    this._lastReadModification = undefined;

    this.info = info;
    this.parent = null;
  },

  toString: function() {
    return "[FileResource:" + this.path + "]";
  },

  refresh: function() {
    console.log("Starting refresh");
    return OS.File.stat(this.path).then(info => {
      console.log("refresh complete!");
      this.info = info;
      return this;
    });
  },

  get displayName() { return this.basename + (this.isDir ? "/" : "") },

  get isDir() {
    if (!this.info) { return false; }
    return this.info.isDir && !this.info.isSymLink;
  },

  /**
   * Returns the path relative to the store.  This is used for
   * project search, there might be a better approach.
   */
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

  /**
   * Returns the text of the file as a promise.
   */
  load: function() {
    return OS.File.read(this.path).then(bytes => {
      return gDecoder.decode(bytes);
    });
  },

  createChild: function(name, initial="") {
    console.log("CREATING " + name);
    if (!this.isDir) {
      return promise.reject(new Error("Cannot add child to a regular file"));
    }

    let newPath = OS.Path.join(this.path, name);

    let buffer = initial ? gEncoder.encode(initial) : "";
    return OS.File.writeAtomic(newPath, buffer, {
      noOverwrite: true
    }).then(() => {
      return this.store.refresh();
    }).then(() => {
      let resource = this.store.resources.get(newPath);
      if (!resource) {
        throw new Error("Error creating " + newPath);
      }
      return resource;
    });
  },

  /**
   * Write a string to the file.
   */
  save: function(str) {
    let buffer = gEncoder.encode(str);
    let path = this.path;

    // XXX: This was losing permissions on save
    // return OS.File.writeAtomic(this.path, buffer, { tmpPath: this.path + ".tmp" });

    return task.spawn(function*() {
        let pfh = yield OS.File.open(path, {truncate: true});
        yield pfh.write(buffer);
        yield pfh.close();
    });
  },

  get contentType() {
    if (this._contentType) {
      return this._contentType;
    }
    if (this.isDir) {
      return "x-directory/normal";
    }
    try {
      this._contentType = mimeService.getTypeFromFile(new FileUtils.File(this.path));
    } catch(ex) {
      console.error(ex);
      this._contentType = null;
    }
    return this._contentType;
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
    this.setRoot(ScratchRoot(this, this.rootPath));
    this.resources.set(path, this.root);

    OS.File.makeDir(path, {
      ignoreExisting: true
    }).then(() => {
      this.refresh();
    });
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
    this.setRoot(OpenRoot(this));
  },

  toString: function() { return "[OpenStore]"; },

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
      let resource = this._forPath(path, info);
      this.root.addChild(resource);
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
});

