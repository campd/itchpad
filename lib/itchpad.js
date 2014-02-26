const { Class } = require("sdk/core/heritage");

const { Project } = require("project");
const { PageCollection } = require("page");
const { TreeView } = require("tree");
const { ShellDeck } = require("shells");
const { Resource } = require("stores/base");
const { ResourceMap, Pair } = require("resource-map");
const { registeredPlugins } = require("plugins/core");
const { EventTarget } = require("sdk/event/target");
const { on, forget } = require("event/scope");
const { emit } = require("sdk/event/core");
const { merge } = require("sdk/util/object");
const promise = require("helpers/promise");
const { ToolSidebar } = require("devtools/framework/sidebar");

const { Cc, Ci, Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

/**
 * This is the main class tying together an instance of the pad.  It is
 * created in itchpad.xul.
 *
 * It mediates access to a few resources:
 * - The list of plugins for this instance.
 * - The tree view that views file trees.
 * - The ShellDeck that contains all editors for this instance.
 * - The Project that includes local resources for the instance.
 * - The list of Live Stores for the instance.
 * - The ResourceMap that ties Live resources to Project resources.
 * - The Target associated with this instance, if any.
 * - The toolbox associated with this instance, if any.
 */
var Itchpad = Class({
  extends: EventTarget,

  initialize: function(window, project, toolbox) {
    let document = window.document;

    this.window = window;
    this.document = window.document;
    this.toolbox = toolbox;
    this.stores = new Set();

    // Create the sources sidebar
    this.onNodeSelection = this.onNodeSelection.bind(this);
    this.projectTree = new CollectionTree(this.document, {
      nodeVisible: this.nodeVisible.bind(this),
      nodeFormatter: this.formatNode.bind(this)
    });
    this.projectTree.on("selection", this.onNodeSelection);

    document.querySelector("#sources").appendChild(this.projectTree.elt);
    document.defaultView.addEventListener("unload", this.destroy.bind(this));
    // Plugin/inspection sidebar

    let tabbox = document.getElementById("sidebar");
    this.sidebar = new ToolSidebar(tabbox, this, "itchpad");
    ViewHelpers.togglePane({
      visible: false,
      delayed: false,
      animated: false
    }, document.getElementById("sidebar-box"));

    // Editor management
    this.shells = new ShellDeck(document, this);
    this.onEditorCreated = this.onEditorCreated.bind(this);
    this.shells.on("editor-created", this.onEditorCreated);

    this.onEditorActivated = this.onEditorActivated.bind(this);
    this.shells.on("editor-activated", this.onEditorActivated);

    document.getElementById("shells-deck-container").appendChild(this.shells.elt);

    // Store/Resource management
    this.resourceMap = new ResourceMap();

    if (!project) {
      project = new Project({
        id: "Test",
        name: "App",
        directories: [],
        openFiles: []
      });
    }
    this.setProject(project);
    this.setPage(new PageCollection());

    // Plugin management.
    this.commands = document.getElementById("itchpad-commandset");
    this.commands.addEventListener("command", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      this.pluginDispatch("onCommand", evt.target.id, evt.target);
    });
    this.pluginMethods = {};
    this.loadPlugins();
  },

  destroy: function() {
    this._plugins.forEach(plugin => { plugin.destroy(); });
  },

  // Set the current project viewed by the itchpad.
  setProject: function(project) {
    this.project = project;
    this.resourceMap.setProject(project);
    this.projectTree.setCollection(project);
  },

  setProjectToSinglePath: function(path, opts) {
    let existingPaths = [...this.projectTree.models].map(model=>model.path);
    console.log(
      "Setting project to single path: " + path,
      "Existing paths: ", existingPaths.join(", ")
    );
    this.project.customOpts = opts;
    this.project.projectType = "APP_MANAGER";
    this.project.removePaths(existingPaths);
    this.project.addPath(path);
    this.project.save();
  },

  setPage: function(page) {
    this.page = page;
    this.resourceMap.setPage(page);
  },

  openResource: function(resource) {
    let pair = this.resourceMap.pair(resource);
    let shell = this.shells.open(pair, resource);

    this.projectTree.select(resource);
  },

  // When a node is selected in the tree, open its associated editor.
  onNodeSelection: function(resource) {
    // XXX: Should check to see if there is a suitable editor rather
    // than blacklisting these types
    if (resource.isDir && resource.parent) {
      return;
    }
    this.openResource(resource);
  },

  /**
   * Plugin UI commands.  These aren't really great, we should rethink these.
   */

  createElement: function(type, options) {
    let elt = this.document.createElement(type);

    let parent;

    for (let opt in options) {
      if (opt === "command") {
        let command = typeof(options.command) === "string" ? options.command : options.command.id;
        elt.setAttribute("command", command);
      } else if (opt === "parent") {
        continue;
      } else {
        elt.setAttribute(opt, options[opt]);
      }
    }

    if (options.parent) {
      let parent = options.parent;
      if (typeof(parent) === "string") {
        parent = this.document.querySelector(parent);
      }
      parent.appendChild(elt);
    }

    return elt;
  },

  addCommand: function(definition) {
    let command = this.document.createElement("command");
    command.setAttribute("id", definition.id);
    if (definition.key) {
      let key = this.document.createElement("key");
      key.id = "key_" + definition.id;

      let keyName = definition.key;
      if (keyName.startsWith("VK_")) {
        key.setAttribute("keycode", keyName);
      } else {
        key.setAttribute("key", keyName);
      }
      key.setAttribute("modifiers", definition.modifiers);
      key.setAttribute("command", definition.id);
      this.document.getElementById("itchpad-keyset").appendChild(key);
    }
    command.setAttribute("oncommand", "void(0);"); // needed. See bug 371900
    this.document.getElementById("itchpad-commandset").appendChild(command);
    return command;
  },


  createMenuItem: function(options) {
    return this.createElement("menuitem", options);
  },

  createToolbarGroup: function(options) {
    return this.createElement("hbox", merge({
      class: "devtools-toolbarbutton-group"
    }, options));
  },

  createToolbarButton: function(options) {
    return this.createElement("toolbarbutton", merge({
      class: "devtools-toolbarbutton"
    }, options));
  },

  addSidebar: function(name, url) {
    let deferred = promise.defer();

    this.sidebar.once(name + "-ready", () => {
      deferred.resolve(this.sidebar.getWindowForTab(name));
    });
    this.sidebar.addTab(name, url, false);

    return deferred.promise;
  },

  showSidebar: function(name) {
    this.sidebar.select(name);
    let sidebar = this.document.getElementById("sidebar-box");
    ViewHelpers.togglePane({ visible: true, animated: true, delayed: true }, sidebar);
  },

  hideSidebar: function() {
    let sidebar = this.document.getElementById("sidebar-box");
    ViewHelpers.togglePane({ visible: false, animated: true, delayed: true }, sidebar);
  },

  loadPlugins: function() {
    this._plugins = [];

    for (let plugin of registeredPlugins) {
      try {
        this._plugins.push(plugin(this));
      } catch(ex) {
        console.exception(ex);
      }
    }

    this.pluginDispatch("lateInit");
  },

  getPlugin: function(pluginType) {
    for (let plugin of this.plugins) {
      if (plugin.constructor === pluginType) {
        return plugin;
      }
    }
    return null;
  },

  get plugins() {
    if (!this._plugins) {
      console.log("plugins requested before _plugins was set");
      return [];
    }
    return this._plugins.filter(plugin => {
      return !this.project.projectType ||
             !plugin.projectType ||
             this.project.projectType === plugin.projectType;
    });
  },

  onEditorCreated: function(editor) {
    this.plugins.forEach(plugin => plugin.onEditorCreated(editor));
    this._editorListen(editor, "change", "onEditorChange");
    this._editorListen(editor, "cursorActivity", "onEditorCursorActivity");
    this._containerListen(editor, "load", "onEditorLoad");
    this._containerListen(editor, "save", "onEditorSave");
  },

  onEditorActivated: function(editor) {
    editor.setToolbarVisibility();
    this.plugins.forEach(plugin => plugin.onEditorActivated(editor));
  },

  /**
   * Call a method on all plugins that implement the method.
   */
  pluginDispatch: function(handler, ...args) {
    this.plugins.forEach(plugin => {
      try {
        if (handler in plugin) plugin[handler](...args);
      } catch(ex) {
        console.error(ex);
      }
    })
  },

  _containerListen: function(editor, event, handler) {
    editor.on(event, (...args) => {
      this.pluginDispatch(handler, editor, ...args);
    });
  },

  _editorListen: function(editor, event, handler) {
    if (!editor.editor) {
      return;
    }
    editor.editor.on(event, (...args) => {
      this.pluginDispatch(handler, editor, ...args);
    });
  },

  /**
   * Set the current devtools target for the pad.
   */
  setTarget: function(target, own=false) {
    if (target === this.target) {
      return promise.resolve();
    }

    if (this.ownsTarget && this.target) {
      this.target.destroy();
    }

    this._webConsolePromise = null;
    this.ownsTarget = own;
    this.target = target;

    let remote = target ? target.makeRemote() : promise.resolve();

    return remote.then(() => {
      this.page.setTarget(target);
      emit(this, "target-changed");
    }).then(null, console.error);
  },

  /**
   * Get a WebConsoleClient for communicating with the current target.
   */
  getWebConsoleClient: function() {
    if (this._webConsolePromise) {
      return this._webConsolePromise;
    }
    let deferred = promise.defer();
    this.target.client.attachConsole(this.target.form.consoleActor, [], (response, consoleClient) => {
      try {
        if (response.error) {
          deferred.reject(response.error);
          return;
        }
        deferred.resolve(consoleClient);
      } catch(ex) {
        console.error(ex);
      }
    });
    this._webConsolePromise = deferred.promise;
    return deferred.promise
  },

  /**
   * Associate this pad with a toolbox.
   */
  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    if (this.toolbox) {
      // Menu doesn't really make sense in the toolbox...
      this.document.getElementById("itchpad-menubar").setAttribute("hidden", "true");
    } else {
      this.document.getElementById("itchpad-menubar").removeAttribute("hidden");
    }
    emit(this, "toolbox-changed");
  },

  /**
   * Find a shell for an editor, pair, or resource.
   */
  shellFor: function(resource) {
    let pair = this.pairFor(resource);
    return this.shells.shellFor(pair);
  },

  /**
   * Returns the Editor for a given resource.
   */
  editorFor: function(resource) {
    let shell = this.shellFor(resource);
    return shell ? shell.editor : shell;
  },

  /**
   * Returns the Pair that matches a given editor, pair, or resource.
   */
  pairFor: function(thing) {
    if (thing instanceof Pair) {
      return thing;
    }
    if (thing instanceof Resource) {
      return this.resourceMap.pair(thing);
    }
    if (thing.pair) {
      return thing.pair;
    }
    throw new Error("Don't know how to get a pair associated with: " + thing);
  },

  /**
   * Returns a live resource for the given editor, pair, or resource.
   */
  liveFor: function(thing) {
    let pair = this.pairFor(thing);
    return pair ? pair.live : null;
  },

  /**
   * Returns a project resource for the given editor, pair, or resource.
   */
  projectFor: function(thing) {
    let pair = this.pairFor(thing);
    return pair ? pair.project : null;
  },

  /**
   * Decide whether a given node should be hidden in the tree.
   */
  nodeVisible: function(node) {
    // if (node === this.project.openStore.root) {
    //   return node.hasChildren;
    // }
    return true;
  },

  /**
   * Format the given node for display in the resource tree.
   */
  formatNode: function(node, elt) {
    let editor = this.editorFor(node);
    let renderedByPlugin = false;

    if (this.plugins) {
      this.plugins.forEach(plugin => {
        if (!plugin.onAnnotate) {
          return;
        }
        if (plugin.onAnnotate(node, editor, elt)) {
          renderedByPlugin = true;
        }
      });
    }

    if (!renderedByPlugin) {
      elt.textContent = node.displayName;
    }
  },

  get sourcesVisible() {
    return this.sourceToggle.hasAttribute("pane-collapsed");
  },

  get currentShell() {
    return this.shells.currentShell;
  },

  get currentEditor() {
    return this.shells.currentEditor;
  },
});

var CollectionTree = Class({
  extends: TreeView,

  initialize: function(document, options) {
    TreeView.prototype.initialize.call(this, document, options);
  },

  setCollection: function(coll) {
    if (this.coll) {
      forget(this, this.coll);
      for (let store of this.coll.allStores()) {
        this.removeModel(store);
      }
    }
    this.coll = coll;
    if (this.coll) {
      on(this, coll, "store-added", this.addModel.bind(this));
      on(this, coll, "store-removed", this.removeModel.bind(this));
      on(this, coll, "project-saved", this.refresh.bind(this));
      this.refresh();
    }
  },

  refresh: function() {
    for (let store of this.coll.allStores()) {
      this.addModel(store);
    }
  }
});

exports.Itchpad = Itchpad;
