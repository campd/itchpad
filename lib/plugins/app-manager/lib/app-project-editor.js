const { Cu } = require("chrome");
const { Class } = require("sdk/core/heritage");
const promise = require("helpers/promise");
const { ItchEditor } = require("editors");

var AppProjectEditor = Class({
  extends: ItchEditor,

  hidesToolbar: true,

  initialize: function(document, host) {
    ItchEditor.prototype.initialize.call(this, document);
    this.appended = promise.resolve();
    this.host = host;
  },

  load: function(resource) {
    this.elt.textContent = "";
    let {customOpts} = this.host.project;
    let iframe = this.elt.ownerDocument.createElement("iframe");
    iframe.setAttribute("flex", "1");
    iframe.setAttribute("src", customOpts.iframeSrc);
    this.elt.appendChild(iframe);
  }
});

exports.AppProjectEditor = AppProjectEditor;
