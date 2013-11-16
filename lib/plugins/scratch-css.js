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
    let local = editor.pair.local;
    if (!local) {
      console.log("no local!");
    }
    if (editor.pair.remote) {
      console.log("Already paired: " + editor.pair.remote);
    }
    if (!local
        || editor.pair.remote
        || local.store !== this.host.scratch
        || local.contentCategory !== "css") {
      return;
    }

    console.log("Unlinked scratch css!  This will not do!");

    this.host.styles.rootResource.addChild(local.basename, editor.editor.getText()).then(resource => {
      dump("UPDATING PAIR\n");
      editor.pair.remote = resource;
      dump("UPDATED PAIR: " + editor.pair);
    });
  },
});

exports.ScratchpadStyleLink = ScratchpadStyleLink;
registerPlugin(ScratchpadStyleLink);
