const { Class } = require("sdk/core/heritage");
const { EventTarget } = require("sdk/event/target");

var Scope = Class({
  initialize: function(owner) {
    this.owner = owner;
  },

  on: function(target, event, handler) {
    this.listeners = this.listeners || [];
    this.listeners.push({
      target: target,
      event: event,
      handler: handler
    });
    target.on(event, handler);
  },

  off: function(t, e, h) {
    if (!this.listeners) return;
    this.listeners = this.listeners.filter(({ target, event, handler }) => {
      return !(target === t && event === e && handler === h);
    });
    target.off(event, handler);
  },

  clear: function(clearTarget) {
    if (!this.listeners) return;
    this.listeners = this.listeners.filter(({ target, event, handler }) => {
      if (target === clearTarget) {
        target.off(event, handler);
        return false;
      }
      return true;
    });
  },
  destroy: function() {
    this.owner = undefined;
    if (!this.listeners) return;
    this.listeners.forEach(({ target, event, handler }) => {
      target.off(event, handler);
    });
    this.listeners = undefined;
  }
});

var scopes = new WeakMap();
function scope(owner) {
  if (!scopes.has(owner)) {
    let scope = new Scope(owner);
    scopes.set(owner, scope);
    return scope;
  }
  return scopes.get(owner);
}
exports.scope = scope;

exports.on = function(owner, target, event, handler) {
  if (!target) return;
  scope(owner).on(target, event, handler);
}

exports.off = function(owner, target, event, handler) {
  if (!target) return;
  scope(owner).off(target, event, handler);
}

exports.forget = function(owner, target) {
  scope(owner).clear(target);
}

exports.done = function(owner) {
  scope(owner).destroy();
  scopes.delete(owner);
}

