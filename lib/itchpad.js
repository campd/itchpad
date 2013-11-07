const { Class } = require("sdk/core/heritage");
const { LocalStore } = require("stores/local");
const { TreeView } = require("views/tree");
const { EditorList } = require("views/editors");

var Itchpad = Class({
  initialize: function(document) {
    this.document = document;
    this.stores = [];

    this.tree = new TreeView(this.document);
    this.tree.on("selection", node => {
      if (!node.isDir) {
        this.editors.open(node);
      }
    });
    document.getElementById("sources").appendChild(this.tree.elt);

    this.editors = new EditorList(document);
    document.getElementById("editors").appendChild(this.editors.elt);

    this.addStore(new LocalStore("/Users/dcamp/git/itchpad"));
    this.addStore(new LocalStore("/Users/dcamp/git/addon-sdk"));
  },

  addStore: function(store) {
    this.stores.push(store);
    store.refresh().then(() => this.tree.addModel(store)).then(null, console.error);
  }
});

exports.Itchpad = Itchpad;
