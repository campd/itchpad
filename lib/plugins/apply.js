var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");
const timers = require("sdk/timers");

const DEFAULT_THROTTLE_DELAY = 500;

var ApplyPlugin = Class({
  extends: Plugin,

  init: function(host) {
    this.needsUpdate = new Set();
  },

  getAutoApplier: function(editor) {
    return this.selectResource(editor, resource => resource.canAutoApply);
  },
  getApplier: function(editor) {
    return this.selectResource(editor, resource => 'apply' in resource);
  },

  onEditorChange: function(editor) {
    this.update(editor);
  },

  onCommand: function(cmd) {
    // If we haven't been auto-applying, at least apply on save (not
    // sure this is great behavior, but I'm gonna try it)
    if (cmd === "cmd-save") {
      let editor = this.host.currentEditor;
      this.needsUpdate.add(editor);
      this.apply();
    }
  },

  update: function(editor) {
    let pair = editor.pair;
    let applyResource = this.getAutoApplier(editor);
    if (!applyResource) {
      return;
    }

    this.needsUpdate.add(editor);
    if (this._updateTask) {
      timers.clearTimeout(this._updateTask);
    }

    this._updateTask = timers.setTimeout(this.apply.bind(this), DEFAULT_THROTTLE_DELAY);
  },

  apply: function() {
    if (this._updateTask) {
      timers.clearTimeout(this._updateTask);
      this._updateTask = null;
    }

    for (editor of this.needsUpdate) {
      let applier = this.getApplier(editor);
      if (applier) {
        applier.apply(editor.editor.getText());
      }
    }
    this.needsUpdate = new Set();
  }
});
exports.ApplyPlugin = ApplyPlugin;
registerPlugin(ApplyPlugin);
