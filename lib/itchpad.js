const { Class } = require("sdk/core/heritage");
const { LocalStore } = require("stores/local");
const { StylesStore } = require("stores/styles");
const { TreeView } = require("views/tree");
const { EditorPane } = require("views/editor-pane");

const { Cu } = require("chrome");
const { ViewHelpers } = Cu.import("resource:///modules/devtools/ViewHelpers.jsm", {});

var Itchpad = Class({
  initialize: function(document) {
    this.document = document;
    this.stores = [];

    this.editorPane = new EditorPane(document);
    document.getElementById("editors").appendChild(this.editorPane.elt);

    this.tree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this),
    });
    this.tree.on("selection", node => {
      if (!node.isDir) {
        this.editorPane.open(node);
      }
    });
    document.getElementById("sources").appendChild(this.tree.elt);

    this.sourceToggle = document.getElementById("toggle-sources");

    this.editorPane.on("dirty-changed", (editor) => {
      this.tree.updateNode(editor.node);
    });

    this.addStore(new LocalStore("/Users/dcamp/git/itchpad"));
  },

  setToolbox: function(toolbox) {
    this.toolbox = toolbox;
    toolbox.target.makeRemote().then(() => {
      this.addStore(new StylesStore(this.toolbox.target));
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

  addStore: function(store) {
    this.stores.push(store);
    store.refresh().then(() => this.tree.addModel(store)).then(null, console.error);
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
