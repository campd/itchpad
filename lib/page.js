const { Class } = require("sdk/core/heritage");
const { StoreCollection } = require("store-collection");
const { StylesStore } = require("stores/styles");

// This is a bad name for the collection of stores tied to the live target.
// Target was already taken, Live didn't sound right.  A rename would be
// welcome.
var PageCollection = Class({
  extends: StoreCollection,

  initialize: function() {
    StoreCollection.prototype.initialize.call(this);

    this.styles = new StylesStore();
    this.addStore(this.styles);
  },

  setTarget: function(target) {
    for (let store of this.stores) {
      store.setTarget(target);
    }
  }
});

exports.PageCollection = PageCollection;
