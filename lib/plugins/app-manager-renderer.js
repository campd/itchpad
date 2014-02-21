var { Class } = require("sdk/core/heritage");
var { registerPlugin, Plugin } = require("plugins/core");

var AppManagerRenderer = Class({
  extends: Plugin,

  onAnnotate: function(node, editor, elt) {
    if (node.parent) {
      return;
    }

    let doc = elt.ownerDocument;
    let image = doc.createElement("image");
    let label = doc.createElement("label");
    let versionLabel = doc.createElement("label");

    label.className = "project-name-label";
    versionLabel.className = "project-version-label";
    image.className = "project-image";

    let name = node.basename;
    let version = "v0.0.1";
    let url = "icon-sample.png"

    label.textContent = name;
    versionLabel.textContent = version;
    image.setAttribute("src", "icon-sample.png");

    elt.innerHTML = "";
    elt.appendChild(image);
    elt.appendChild(label);
    elt.appendChild(versionLabel);
    return true;
  },

  onEditorCreated: function(editor) { console.log("APP MANAGER editor created: " + editor) },
  onEditorDestroyed: function(editor) { console.log("APP MANAGER editor destroyed: " + editor )},

  onEditorSave: function(editor) { console.log("APP MANAGER editor saved: " + editor) },
  onEditorLoad: function(editor) { console.log("APP MANAGER editor loaded: " + editor) },

  onEditorActivated: function(editor) { console.log("APP MANAGER editor focused: " + editor )},
  onEditorDeactivated: function(editor) { console.log("APP MANAGER editor blur: " + editor )},

  onEditorChange: function(editor) { console.log("APP MANAGER editor changed: " + editor )},

  onCommand: function(cmd) { console.log("Command: " + cmd); }

});
exports.AppManagerRenderer = AppManagerRenderer;

registerPlugin(AppManagerRenderer);
