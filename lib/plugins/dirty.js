var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

var DirtyPlugin = Class({
  extends: Plugin,

  onEditorSave: function(editor) { this.onEditorChange(editor); },
  onEditorLoad: function(editor) { this.onEditorChange(editor); },

  onEditorChange: function(editor) {
    let tree = this.host.tree;

    // Dont' force a refresh unless the dirty state has changed...
    let priv = this.priv(editor);
    let clean = editor.editor.isClean();
    if (priv.isClean !== clean) {
      this.host.tree.updateNode(editor.pair[editor.source]);
      priv.isClean = clean;
    }
  },

  onAnnotate: function(node, editor) {
    if (editor && !editor.editor.isClean()) {
      return '*';
    }
  }
});
exports.DirtyPlugin = DirtyPlugin;

registerPlugin(DirtyPlugin);
