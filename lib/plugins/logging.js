var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

var LoggingPlugin = Class({
  extends: Plugin,

  // Editor state lifetime...
  onEditorCreated: function(editor) { console.log("editor created: " + editor) },
  onEditorDestroyed: function(editor) { console.log("editor destroyed: " + editor )},

  onEditorSave: function(editor) { console.log("editor saved: " + editor) },
  onEditorLoad: function(editor) { console.log("editor loaded: " + editor) },

  onEditorActivated: function(editor) { console.log("editor focused: " + editor )},
  onEditorDeactivated: function(editor) { console.log("editor blur: " + editor )},

  onEditorChange: function(editor) { console.log("editor changed: " + editor )},

  onCommand: function(cmd) { console.log("Command: " + cmd); }
});
exports.LoggingPlugin = LoggingPlugin;

registerPlugin(LoggingPlugin);
