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
    let project = editor.pair.project;
    if (!project
        || editor.pair.live
        || project.store !== this.host.scratch
        || project.contentCategory !== "css") {
      return;
    }

    console.log("Unlinked scratch css!  This will not do!");

    this.host.styles.rootResource.addChild(project.basename, editor.editor.getText()).then(resource => {
      dump("UPDATING PAIR\n");
      editor.pair.live = resource;
      dump("UPDATED PAIR: " + editor.pair);
    });
  },
});

exports.ScratchpadStyleLink = ScratchpadStyleLink;
registerPlugin(ScratchpadStyleLink);
