// This is the core plugin API.

const { Class } = require("sdk/core/heritage");

var Plugin = Class({
  initialize: function(host) {
    this.host = host;
    this.init(host);
  },

  init: function(host) {},

  priv: function(item) {
    if (!this._privData) {
      this._privData = new WeakMap();
    }
    if (!this._privData.has(item)) {
       this._privData.set(item, {});
    }
    return this._privData.get(item);
  },

  selectNode: function(editor, p) {
    if (!editor) {
      return null;
    }
    return editor.pair.select(p, editor.source);
  },

  // Editor state lifetime...
  onEditorCreated: function(editor) {},
  onEditorDestroyed: function(editor) {},

  onEditorActivated: function(editor) {},
  onEditorDeactivated: function(editor) {},

  onEditorLoad: function(editor) {},
  onEditorSave: function(editor) {},
  onEditorChange: function(editor) {},
});
exports.Plugin = Plugin;

function registerPlugin(constr) {
  exports.registeredPlugins.push(constr);
}
exports.registerPlugin = registerPlugin;

exports.registeredPlugins = [];





