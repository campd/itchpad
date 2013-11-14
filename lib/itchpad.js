const { Class } = require("sdk/core/heritage");

const { LocalStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { PairChooser } = require("views/pair");
const { EditorPane } = require("views/editor-pane");
const { ResourceMap } = require("resource-map");
const { registeredPlugins } = require("plugins/core");

const { Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

var Itchpad = Class({
  initialize: function(document) {
    this.document = document;
    this.stores = [];

    this.resourceMap = new ResourceMap();

    this.editorPane = new EditorPane(document);
    this.onEditorCreated = this.onEditorCreated.bind(this);
    this.editorPane.on("editor-created", this.onEditorCreated);

    this.commands = document.getElementById("itchpad-commandset");
    this.commands.addEventListener("command", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      this._pluginDispatch("onCommand", evt.target.id);
    });

    document.getElementById("editors").appendChild(this.editorPane.elt);

    this.pairChooser = new PairChooser(this.document);

    this.tree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this),
    });
    this.tree.on("selection", node => {
      if (!node.isDir) {
        let pair = this.resourceMap.pair(node);
        dump("Local node: " + (pair.local ? pair.local.uri : "null") + "\n");
        dump("Remote node: " + (pair.remote ? pair.remote.uri : "null") + "\n");
        let editor = this.editorPane.open(pair, node);
        this.pairChooser.setEditor(editor);
      }
    });
    document.getElementById("sources").appendChild(this.tree.elt);

    this.sourceToggle = document.getElementById("toggle-sources");

    this.editorPane.on("dirty-changed", (editor) => {
      this.tree.updateNode(editor.node);
    });

    this.addLocalStore(new LocalStore("/Users/dcamp/git/mechanic"));
    this.loadPlugins();
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

  _pluginDispatch: function(handler, ...args) {
    this.plugins.forEach(plugin => {
      try {
        if (handler in plugin) plugin[handler](...args);
      } catch(ex) {
        console.exception(ex);
      }
    })
  },

  _containerListen: function(editor, event, handler) {
    editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  _editorListen: function(editor, event, handler) {
    editor.editor.on(event, (...args) => {
      this._pluginDispatch(handler, editor, ...args);
    });
  },

  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    toolbox.target.makeRemote().then(() => {
      this.target = toolbox.target;
      this.addRemoteStore(new StylesStore(this.toolbox.target));
    }).then(null, console.error);
  },

  formatNode: function(node, elt) {
    let text = [node.displayName];

    let editor = this.editorPane.editorFor(node);

    let annotations;
    this.plugins.forEach(plugin => {
      if (!plugin.onAnnotate) {
        return;
      }
      text = (text || []).concat(plugin.onAnnotate(node, editor));
    });

    elt.textContent = text.join('');
  },

  addRemoteStore: function(store) {
    return this._addStore(store).then(() => {
      this.resourceMap.addRemoteStore(store);
    });
  },

  addLocalStore: function(store) {
    return this._addStore(store).then(() => {
      this.resourceMap.addLocalStore(store);
    });
  },

  _addStore: function(store) {
    this.stores.push(store);
    return store.refresh().then(() => this.tree.addModel(store));
  },

  get sourcesVisible() {
    return this.sourceToggle.hasAttribute("pane-collapsed");
  },

  toggleSources: function() {
    if (this.sourcesVisible) {
      this.sourceToggle.setAttribute("tooltiptext", "Hide sources");
      this.sourceToggle.removeAttribute("pane-collapsed");
    } else {
      this.sourceToggle.setAttribute("tooltiptext", "Show sources");
      this.sourceToggle.setAttribute("pane-collapsed", "");
    }

    ViewHelpers.togglePane({
      visible: this.sourcesVisible,
      animated: true,
      callback: function() { console.log("done toggling!") }
    }, this.document.getElementById("sources"));
  },

  get currentEditor() {
    return this.editorPane.currentEditor;
  },
  get currentPairEditor() {
    return this.editorPane.currentPairEditor;
  }
});

exports.Itchpad = Itchpad;
