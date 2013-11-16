const { Class } = require("sdk/core/heritage");

const { LocalStore, ScratchStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { PairChooser } = require("views/pair");
const { ShellDeck } = require("shells");
const { Resource } = require("stores/base");
const { ResourceMap } = require("resource-map");
const { registeredPlugins } = require("plugins/core");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { merge } = require("sdk/util/object");

const { Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

var Itchpad = Class({
  extends: EventTarget,

  initialize: function(document, toolbox) {
    this.document = document;
    this.toolbox = toolbox;
    this.stores = [];

    this.resourceMap = new ResourceMap();

    this.shells = new ShellDeck(document);
    this.onEditorCreated = this.onEditorCreated.bind(this);
    this.shells.on("editor-created", this.onEditorCreated);

    this.onEditorActivated = this.onEditorActivated.bind(this);
    this.shells.on("editor-activated", this.onEditorActivated);

    this.commands = document.getElementById("itchpad-commandset");
    this.commands.addEventListener("command", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      this._pluginDispatch("onCommand", evt.target.id, evt.target);
    });

    document.getElementById("shells").appendChild(this.shells.elt);

    this.pairChooser = new PairChooser(this.document);

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

    this.scratch = new ScratchStore();
    this.addScratchStore(this.scratch);
    this.addProjectStore(new LocalStore("/Users/dcamp/git/mechanic"));
    this.addProjectStore(new LocalStore("/Users/dcamp/git/addon-sdk"));

    this.styles = new StylesStore(toolbox ? toolbox.target : null);
    this.addLiveStore(this.styles);
    this.loadPlugins();
  },

  get activeTree() {
    return this.document.getElementById("sources-tabs").selectedPanel.tree;
  },

  onNodeSelection: function(resource) {
    if (resource.isDir) {
      return;
    }
    let pair = this.resourceMap.pair(resource);
    let shell = this.shells.open(pair, resource);
    this.pairChooser.setShell(shell);
  },

  addCommand: function(definition) {
    let command = this.document.createElement("command");
    command.setAttribute("id", definition.id);
    if (definition.key) {
      let key = doc.createElement("key");
      key.id = "key_" + definition.id;

      let keyName = definition.key;
      if (keyName.startsWith("VK_")) {
        key.setAttribute("keycode", keyName);
      } else {
        key.setAttribute("key", keyName);
      }
      key.setAttribute("modifiers", definition.modifiers);
      key.setAttribute("oncommand", "void(0);"); // needed. See bug 371900
      this.document.getElementById("itchpad-keyset").appendChild(key);
    }
    this.document.getElementById("itchpad-commandset").appendChild(command);
    return command;
  },

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
        parent = this.document.getElementById(parent);
      }
      parent.appendChild(elt);
    }

    return elt;
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

  loadPlugins: function() {
    this.plugins = [];

    for (let plugin of registeredPlugins) {
      this.plugins.push(plugin(this));
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

  _pluginDispatch: function(handler, ...args) {
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
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  _editorListen: function(editor, event, handler) {
    if (!editor.editor) {
      return;
    }
    editor.editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  setTarget: function(target) {
    this.target = target;
    return target.makeRemote().then(() => {
      // XXX: replace styles store?
      for (let store of this.stores) {
        if ("setTarget" in store) {
          store.setTarget(target);
        }
      }
      emit(this, "target-changed");
    }).then(null, console.error);
  },

  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    emit(this, "toolbox-changed");
  },

  // Find a shell for either a resource or a pair
  shellFor: function(resource) {
    if (resource instanceof Resource) {
      resource = this.resourceMap.pair(resource);
    }
    return this.shells.shellFor(resource);
  },

  // Returns the Editor for a given resource.
  editorFor: function(resource) {
    let shell = this.shellFor(resource);
    return shell ? shell.editors[resource.aspect] : shell;
  },

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
    this.stores.push(store);
    this.liveTree.addModel(store);
    this.resourceMap.addLiveStore(store);
  },

  addScratchStore: function(store) {
    this.stores.push(store);
    this.projectTree.addModel(store);
    this.resourceMap.addProjectStore(store, { noAutoPair: true });
  },

  addProjectStore: function(store) {
    this.stores.push(store);
    this.projectTree.addModel(store);
    this.resourceMap.addProjectStore(store);
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
