var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

// Handles the save command.
var SavePlugin = Class({
  extends: Plugin,

  init: function(host) { },

  getSaver: function(editor) {
    return this.selectResource(editor, resource => 'save' in resource);
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-save") {
      let editor = this.host.currentEditor;
      let saver = this.getSaver(editor);
      if (!saver) {
        return;
      }

      editor.save(saver);
    }
  }
})
exports.SavePlugin = SavePlugin;
registerPlugin(SavePlugin);
