const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const promise = require("helpers/promise");
var { registerPlugin, Plugin } = require("plugins/core");
const { AppProjectEditor } = require("./app-project-editor");


var AppManagerRenderer = Class({
  extends: Plugin,

  projectType: "APP_MANAGER",

  isAppManagerProject: function() {
    return this.host.project.projectType === "APP_MANAGER";
  },
  editorForResource: function(node) {
    if (!node.parent && this.isAppManagerProject()) {
      return AppProjectEditor;
    }
  },
  onAnnotate: function(node, editor, elt) {
    if (node.parent || !this.isAppManagerProject()) {
      return;
    }

    let {customOpts} = this.host.project;
    let doc = elt.ownerDocument;
    let image = doc.createElement("image");
    let label = doc.createElement("label");
    let versionLabel = doc.createElement("label");

    label.className = "project-name-label";
    versionLabel.className = "project-version-label";
    image.className = "project-image";

    let name = customOpts.name || node.basename;
    let version = customOpts.version || "v0.0.1";
    let url = customOpts.iconUrl || "icon-sample.png";

    label.textContent = name;
    versionLabel.textContent = version;
    image.setAttribute("src", url);

    elt.innerHTML = "";
    elt.appendChild(image);
    elt.appendChild(label);
    elt.appendChild(versionLabel);
    return true;
  },

  // onEditorCreated: function(editor) { console.log("APP MANAGER editor created: " + editor) },
  // onEditorDestroyed: function(editor) { console.log("APP MANAGER editor destroyed: " + editor )},

  // onEditorSave: function(editor) { console.log("APP MANAGER editor saved: " + editor) },
  // onEditorLoad: function(editor) { console.log("APP MANAGER editor loaded: " + editor) },

  // onEditorActivated: function(editor) { console.log("APP MANAGER editor focused: " + editor )},
  // onEditorDeactivated: function(editor) { console.log("APP MANAGER editor blur: " + editor )},

  // onEditorChange: function(editor) { console.log("APP MANAGER editor changed: " + editor )},

  // onCommand: function(cmd) { console.log("APP MANAGER command: " + cmd); }

});

exports.AppManagerRenderer = AppManagerRenderer;
registerPlugin(AppManagerRenderer);
