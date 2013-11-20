var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

// Handles the save command.
var SavePlugin = Class({
  extends: Plugin,

  init: function(host) {
    this.host.createMenuItem({
      parent: "file-menu-popup",
      label: "Save",
      command: "cmd-save",
      key: "key-save"
    });
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-save") {
      let editor = this.host.currentEditor;
      let project = editor.pair.project;
      if (!project) {
        return;
      }
      // If this wasn't the project editor, update the project
      // editor.
      let text = -1;
      let projectEditor = editor.shell.editors.project;
      if (projectEditor && projectEditor != editor) {
        text = editor.editor.getText();
      }
      editor.save(project).then(() => {
        if (text != -1) {
          projectEditor.setText(text);
        }
      });
    }
  }
})
exports.SavePlugin = SavePlugin;
registerPlugin(SavePlugin);
