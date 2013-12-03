const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const tabs = require("sdk/tabs");
const { viewFor } = require('sdk/view/core');

// When a manifest.webapp file is updated, update the manifest on any app
// managers viewing the manifest.

var ManifestSave = Class({
  extends: Plugin,

  onEditorSave: function(editor) {
    let project = this.host.projectFor(editor);
    if (project.basename === "manifest.webapp") {
      // Trigger a reload in the app manager.
      for (let tab of tabs) {
        if (tab.url === "about:app-manager") {
          viewFor(tab).linkedBrowser.contentWindow.UI.refreshManifest(project.path);
        }
      }
    }
  }
});
exports.ManifestSave = ManifestSave;
registerPlugin(ManifestSave);
