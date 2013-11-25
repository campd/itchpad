const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const timers = require("sdk/timers");

// When css files are opened in the scratch area, go ahead and
// link them to the page automatically.
var ScratchpadStyleLink = Class({
  extends: Plugin,

  init: function(host) {},

  onEditorActivated: function(editor) {
    console.log("Checking editor activation!");
    let live = this.host.liveFor(editor);
    let project = this.host.projectFor(editor);
    if (!project
        || live
        || !this.host.project.isScratchStore(project.store)
        || project.contentCategory !== "css"
        || project._cssPairChecked) {
      return;
    }

    project._cssPairChecked = true;

    this.host.styles.rootResource.addChild(project.basename, editor.editor.getText()).then(resource => {
      this.host.resourceMap.manualPair(project, resource);
    });
  },
});

exports.ScratchpadStyleLink = ScratchpadStyleLink;
registerPlugin(ScratchpadStyleLink);
