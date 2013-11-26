const { Class } = require("sdk/core/heritage");

const { Project } = require("project");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("tree");
const { ShellDeck } = require("shells");
const { Resource } = require("stores/base");
const { ResourceMap, Pair } = require("resource-map");
const { registeredPlugins } = require("plugins/core");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { merge } = require("sdk/util/object");
const promise = require("helpers/promise");
const { ToolSidebar } = require("devtools/framework/sidebar");

const { Cu } = require("chrome");
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

  initialize: function(window, toolbox) {
    let document = window.document;

    this.window = window;
    this.document = window.document;
    this.toolbox = toolbox;
    this.stores = new Set();

    // Create the sources sidebar

    this.onNodeSelection = this.onNodeSelection.bind(this);
    this.projectTree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this)
    });
    this.projectTree.on("selection", this.onNodeSelection);
    document.querySelector("#sources-tabs > tabpanels").appendChild(this.projectTree.elt);

    this.liveTree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this)
    });
    this.liveTree.on("selection", this.onNodeSelection);

    document.querySelector("#sources-tabs > tabpanels").appendChild(this.liveTree.elt);

    document.getElementById("sources-tabs").selectedPanel = this.projectTree.elt;

    // Plugin/inspection sidebar

    let tabbox = document.getElementById("sidebar");
    this.sidebar = new ToolSidebar(tabbox, this, "itchpad");
    ViewHelpers.togglePane({
      visible: false,
      delayed: false,
      animated: false
    }, document.getElementById("sidebar-box"));

    // Editor management
    this.shells = new ShellDeck(document);
    this.onEditorCreated = this.onEditorCreated.bind(this);
    this.shells.on("editor-created", this.onEditorCreated);

    this.onEditorActivated = this.onEditorActivated.bind(this);
    this.shells.on("editor-activated", this.onEditorActivated);

    this.shells.elt.setAttribute("flex", "4");
    document.getElementById("shells").appendChild(this.shells.elt);

    // Store/Resource management
    this.resourceMap = new ResourceMap();
    
    this.onProjectStoreAdded = this.onProjectStoreAdded.bind(this);
    this.onProjectStoreRemoved = this.onProjectStoreRemoved.bind(this);    

    let project = new Project();
    project.loadPref();
    this.setProject(project);

    this.styles = new StylesStore(toolbox ? toolbox.target : null);
    this.addLiveStore(this.styles);

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

  destroy: function() { },

  // Set the current project viewed by the itchpad.
  setProject: function(project) {
    if (this.project) {
      for (let store of this.project.allStores()) {
        this.onProjectStoreRemoved(store);
      }
      this.project.off("store-added", this.onProjectStoreAdded);
      this.project.on("store-removed", this.onProjectStoreRemoved);
    }
    this.project = project;
    this.resourceMap.setProject(project);
    if (this.project) {
      this.project.on("store-added", this.onProjectStoreAdded);
      this.project.on("store-removed", this.onProjectStoreRemoved);
      for (let store of this.project.allStores()) {
        this.onProjectStoreAdded(store);
      }
    }
  },

  // Get the currently active tree view object (either the Project or Live)
  get activeTree() {
    return this.document.getElementById("sources-tabs").selectedPanel.tree;
  },

  set activeTree(tree) {
    return this.document.getElementById("sources-tabs").selectedPanel = tree.elt;
  },

  openResource: function(resource) {
    let pair = this.resourceMap.pair(resource);
    let shell = this.shells.open(pair, resource);

    if (resource.isProject) {
      this.projectTree.select(resource);
      this.activeTree = this.projectTree;
    } else {
      this.liveTree.select(resource);
      this.activeTree = this.liveTree;
    }
  },

  // When a node is selected in the tree, open its associated editor.
  onNodeSelection: function(resource) {
    if (resource.isDir) {
      return;
    }
    this.openResource(resource);
  },

  onProjectStoreAdded: function(store) {
    this.projectTree.addModel(store);
  },

  onProjectStoreRemoved: function(store) {
    this.projectTree.removeModel(store);
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
      class: "toolbar-group"
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
    this.plugins = [];

    for (let plugin of registeredPlugins) {
      try {
        this.plugins.push(plugin(this));
      } catch(ex) {
        console.exception(ex);
      }
    }
  },

  onEditorCreated: function(editor) {
    this.plugins.forEach(plugin => plugin.onEditorCreated(editor));
    this._editorListen(editor, "change", "onEditorChange");
    this._containerListen(editor, "load", "onEditorLoad");
    this._containerListen(editor, "save", "onEditorSave");
  },

  onEditorActivated: function(editor) {
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
  setTarget: function(target) {
    if (target === this.target) {
      return promise.resolve();
    }
    this._webConsolePromise = null;
    this.target = target;
    return target.makeRemote().then(() => {
      for (let store of this.stores) {
        if ("setTarget" in store) {
          store.setTarget(target);
        }
      }
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
    return shell ? shell.editors[resource.aspect] : shell;
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
   * Returns the currently-instantiated editor editing the live
   * resource associated with an editor, pair, or resource.
   *
   * If such an editor hasn't been created yet, this method will not
   * create one.
   */
  liveEditor: function(thing) {
    let shell = this.shellFor(thing);
    return shell.editors.live;
  },

  /**
   * Returns the currently-instantiated editor editing the project
   * resource associated with an editor, pair, or resource.
   *
   * If such an editor hasn't been created yet, this method will not
   * create one.
   */
  liveEditor: function(thing) {
    let shell = this.shellFor(thing);
    return shell.editors.live;
  },


  /**
   * Returns a project resource for the given editor, pair, or resource.
   */
  projectFor: function(thing) {
    let pair = this.pairFor(thing);
    return pair ? pair.project : null;
  },

  /**
   * Returns the resource loaded in a given editor.  Usually you'll
   * want 'live' or 'project'.
   */
  loadedResource: function(editor) {
    let pair = this.pairFor(editor);
    return pair[editor.aspect];
  },

  /**
   * Format the given node for display in the resource tree.
   */
  formatNode: function(node, elt) {
    let text = [node.displayName];

    let editor = this.editorFor(node);

    if (this.plugins) {
      let annotations;
      this.plugins.forEach(plugin => {
        if (!plugin.onAnnotate) {
          return;
        }
        text = (text || []).concat(plugin.onAnnotate(node, editor));
      });
    }

    elt.textContent = text.join('');
  },

  addLiveStore: function(store) {
    this.stores.add(store);
    this.liveTree.addModel(store);
    this.resourceMap.addLiveStore(store);
  },

  removeLiveStore: function(store) {
    this.stores.delete(store);
    this.liveTree.removeModel(store);
    this.resourceMap.removeLiveStore(store);
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

exports.Itchpad = Itchpad;
