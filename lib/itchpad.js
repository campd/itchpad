const { Class } = require("sdk/core/heritage");
const { LocalStore } = require("stores/local");
const { TreeView } = require("views/tree");
const { EditorList } = require("views/editors");


var Itchpad = Class({
  initialize: function(document) {
    this.document = document;
    this.stores = [];

    this.editors = new EditorList(document);
    document.getElementById("editors").appendChild(this.editors.elt);

    this.tree = new TreeView(this.document, {
      nodeFormatter: this.formatNode.bind(this),
    });
    this.tree.on("selection", node => {
      if (!node.isDir) {
        this.editors.open(node);
      }
    });
    document.getElementById("sources").appendChild(this.tree.elt);

    this.editors.on("dirty-changed", (editor) => {
      this.tree.updateNode(editor.node);
    });

    this.addStore(new LocalStore("/Users/dcamp/git/itchpad"));
  },

  formatNode: function(node, elt) {
    let text = node.displayName;
    let editor = this.editors.editorFor(node);
    if (editor && editor.dirty) {
      text += "*";
    }
    elt.textContent = text;
  },

  addStore: function(store) {
    this.stores.push(store);
    store.refresh().then(() => this.tree.addModel(store)).then(null, console.error);
  },

  get currentEditor() { return this.editors.currentEditor },

  saveFile: function() {
    this.currentEditor.save().then(() => { console.log ("saved!") });
  }
});

exports.Itchpad = Itchpad;
