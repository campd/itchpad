const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const { EventTarget } = require("sdk/event/target");
const { merge } = require("sdk/util/object");

const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var Container = Class({
  initialize: function(tree, node) {
    this.tree = tree;
    this.node = node;
    this.elt = null;
    this.expander = null;
    this.children = null;

    let doc = tree.doc;

    this.elt = doc.createElementNS(HTML_NS, "li");
    this.elt.classList.add("child");

    this.line = doc.createElementNS(HTML_NS, "div");
    this.line.classList.add("tag-line");
    this.elt.appendChild(this.line);

    this.highlighter = doc.createElementNS(HTML_NS, "span");
    this.highlighter.classList.add("highlighter");
    this.line.appendChild(this.highlighter);

    this.expander = doc.createElementNS(HTML_NS, "span");
    this.expander.className = "theme-twisty expander";
    this.line.appendChild(this.expander);

    this.label = doc.createElementNS(HTML_NS, "span");
    this.line.appendChild(this.label);

    this.children = doc.createElementNS(HTML_NS, "ul");
    this.children.classList.add("children");

    this.elt.appendChild(this.children);

    this.line.addEventListener("click", (evt) => {
      if (!this.selected) {
        this.select();
        this.expanded = true;
        evt.stopPropagation();
      }
    }, false);
    this.expander.addEventListener("click", (evt) => {
      this.expanded = !this.expanded;
      this.select();
      evt.stopPropagation();
    }, true);

    this.update();
  },

  update: function() {
    // XXX: let the node create cooler display
    this.label.textContent = this.node.displayName;
    this.expander.style.visibility = this.node.hasChildren ? "visible" : "hidden";
  },

  select: function() {
    this.tree.selectContainer(this);
  },

  get selected() {
    return this.line.classList.contains("theme-selected");
  },
  set selected(v) {
    if (v) {
      this.line.classList.add("theme-selected");
    } else {
      this.line.classList.remove("theme-selected");
    }
  },

  get expanded() {
    return !this.elt.classList.contains("collapsed");
  },

  set expanded(v) {
    if (v) {
      dump("uncollapsing\n");
      this.elt.classList.remove("collapsed");
    } else {
      dump("collapsing!\n")
      this.elt.classList.add("collapsed");
    }
  }
});

var TreeView = Class({
  extends: EventTarget,

  initialize: function(document, options) {
    this.doc = document;
    this.options = merge({}, options);
    this.models = new Set();
    this.roots = new Set();
    this._containers = new Map();
    this.elt = document.createElementNS(HTML_NS, "ul");
  },

  addModel: function(model) {
    this.models.add(model);
    model.root().then(root => {
      dump("DONE GETTING ROOT\n");
      this.roots.add(root);
      let container = this.importNode(root);
      this.selectContainer(container);
      this.elt.appendChild(container.elt);
      dump("Appended child.\n");
    }).then(null, console.error);
  },

  selectContainer: function(container) {
    if (this.selectedContainer) {
      this.selectedContainer.selected = false;
    }
    this.selectedContainer = container;
    container.selected = true;
    emit(this, "selection", container.node);
  },

  importNode: function(node) {
    if (!node) {
      return null;
    }

    if (this._containers.has(node)) {
      return this._containers.get(node);
    }

    var container = Container(this, node);
    this._containers.set(node, container);
    this._updateChildren(container);

    // XXX: watch for updates from the model.

    return container;
  },

  _updateChildren: function(container) {
    let node = container.node;

    let fragment = this.doc.createDocumentFragment();

    for (let child of node.children) {
      let childContainer = this.importNode(child);
      fragment.appendChild(childContainer.elt);
    }

    while (container.children.firstChild) {
      container.children.removeChild(container.children.firstChild);
    }

    container.elt.appendChild(fragment);
  }
});

exports.TreeView = TreeView;
