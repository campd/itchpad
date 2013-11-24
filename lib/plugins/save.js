const { Cu, Cc, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm", {});

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
    this.host.createMenuItem({
      parent: "file-menu-popup",
      label: "Save As",
      command: "cmd-saveas",
    });
  },

  onCommand: function(cmd) {
    if (cmd === "cmd-save") {
      this.save();
    } else if (cmd === "cmd-saveas") {
      this.saveAs();
    }
  },

  saveAs: function() {
    let editor = this.host.currentEditor;
    let project = editor.pair.project;

    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

    if (project && project.parent) {
      try {
        fp.displayDirectory = FileUtils.File(project.parent.path);
      } catch(ex) {
        console.warn(ex);
      }
    }
    fp.defaultString = project.basename;

    fp.init(this.host.window, "Select a File", Ci.nsIFilePicker.modeSave);
    let result = fp.show();
    if (result === Ci.nsIFilePicker.returnOK || result === Ci.nsIFilePicker.returnReplace) {
      let resource;
      this.createResource(fp.file.path).then(res => {
        resource = res;
        return this.saveResource(editor, resource);
      }).then(() => {
        this.host.openResource(resource);
      }).then(null, console.error);
    }
  },

  save: function() {
    let editor = this.host.currentEditor;
    let project = editor.pair.project;
    if (!project) {
      return this.saveAs();
    }

    return this.saveResource(editor, project);
  },

  createResource: function(path) {
    let store = this.host.project.storeContaining(path);
    if (!store) {
      store = this.host.openStore;
    }

    return store.resourceFor(path, { create: true })
  },

  saveResource: function(editor, resource) {
    // If this wasn't a project editor, update the project
    // editor.
    let shell = this.host.shellFor(resource);
    let projectEditor = shell ? shell.editors.project : null;
    let text = -1;
    if (projectEditor && projectEditor !== editor) {
      text = editor.editor.getText();
    }
    return editor.save(resource).then(() => {
      if (text != -1) {
        projectEditor.editor.setText(text);
      }
    });
  }
})
exports.SavePlugin = SavePlugin;
registerPlugin(SavePlugin);
