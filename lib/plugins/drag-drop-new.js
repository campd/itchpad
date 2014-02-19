const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const promise = require("helpers/promise");
const Editor  = require("devtools/sourceeditor/editor");
const { Cu } = require("chrome");
const { VariablesView } = Cu.import("resource:///modules/devtools/VariablesView.jsm", {});
const { ObjectClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});
const { EnvironmentClient } = Cu.import("resource://gre/modules/devtools/dbg-client.jsm", {});
const OS = require("helpers/osfile");

var DragDropNew = Class({
  extends: Plugin,

  init: function(host) {
    console.log("Drag drop files", host, host.document);

    let dropzone = host.document.querySelector("#main-deck");
    dropzone.addEventListener("dragover", function(event) {
      event.preventDefault();
    }, true);
    dropzone.addEventListener("drop", function(event) {
      event.preventDefault();
      // Ready to do something with the dropped object
    }, true);
    dropzone.addEventListener("drop", function(event) {
      event.preventDefault();
      // Ready to do something with the dropped object
      var allTheFiles = event.dataTransfer.files;

      [...allTheFiles].forEach(function(file) {
        console.log(file);
        // DONT COPY, ADD A NEW DIR TO PROJECT?
        // OS.File.copy(file.mozFullPath, )
      });

    }, true);
  }

});

exports.DragDropNew = DragDropNew;

registerPlugin(DragDropNew);
