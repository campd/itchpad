const { Class } = require("sdk/core/heritage");
const { LocalStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { PairChooser } = require("views/pair");
const { EditorPane } = require("views/editor-pane");
const { ResourceMap } = require("resource-map");
const timers = require("sdk/timers");

const { Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

const DEFAULT_THROTTLE_DELAY = 500;

var AutoApplier = Class({
  initialize: function(editor, throttle=DEFAULT_THROTTLE_DELAY) {
    this.editor = editor;
    this.throttle = throttle;
    this.update = this.update.bind(this);

    if (editor.canApply) {
      console.log("listening for change");
      editor.on("change", this.update);
    }
  },

  update: function(immediate) {
    console.log("got a change!");
    if (this._updateTask) {
      timers.clearTimeout(this._updateTask);
    }
    if (immediate) {
      this.editor.apply();
    } else {
      this._updateTask = timers.setTimeout(this.editor.apply.bind(this.editor), this.throttle);
    }
  }
});


var Itchpad = Class({
  initialize: function(document) {
    this.document = document;
    this.stores = [];
    this.resourceMap = new ResourceMap();

    this.editorPane = new EditorPane(document);
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
        if (!editor.applier) {
          editor.applier = AutoApplier(editor);
        }
        this.pairChooser.setEditor(editor);

      }
    });
    document.getElementById("sources").appendChild(this.tree.elt);

    this.sourceToggle = document.getElementById("toggle-sources");

    this.editorPane.on("dirty-changed", (editor) => {
      this.tree.updateNode(editor.node);
    });

    this.addLocalStore(new LocalStore("/Users/dcamp/git/mechanic"));
  },

  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    toolbox.target.makeRemote().then(() => {
      this.addRemoteStore(new StylesStore(this.toolbox.target));
    }).then(null, console.error);
  },

  formatNode: function(node, elt) {
    let text = node.displayName;
    let editor = this.editorPane.editorFor(node);
    if (editor && editor.dirty) {
      text += "*";
    }
    elt.textContent = text;
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

  get currentEditor() { return this.editorPane.currentEditor },

  saveFile: function() {
    this.currentEditor.save().then(() => { console.log ("saved!") });
  }
});

exports.Itchpad = Itchpad;
