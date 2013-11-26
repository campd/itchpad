const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");

const VISIBLE_RESULTS = 10;

var Search = Class({
  extends: Plugin,

  init: function(host) {
    this.command = this.host.addCommand({
      id: "search-files",
      key: "p",
      modifiers: "accel"
    });

    this.searchBox = this.host.createElement("textbox", {
      parent: "#plugin-toolbar-right",
      type: "search",
      timeout: "50",
      class: "devtools-searchinput",
    });

    this.panel = this.host.createElement("panel", {
      parent: "window",
      class: "results-panel",
      level: "top",
      noautofocus: "true",
      consumeoutsideclicks: "false",
      hidden: "true"
    });

    this.noMatches = this.host.createElement("div", {
      parent: this.panel
    });
    this.noMatches.textContent = "No results.";

    this.onSearchFocus = this.onSearchFocus.bind(this);
    this.onSearchInput = this.onSearchInput.bind(this);
    this.onSearchKey = this.onSearchKey.bind(this);

    this.searchBox.addEventListener("focus", this.onSearchFocus, true);
    this.searchBox.addEventListener("input", this.onSearchInput, true);
    this.searchBox.addEventListener("keypress", this.onSearchKey, true);
  },

  onSearchFocus: function() {
    this.selectedIndex = undefined;
  },

  onSearchInput: function() {
    let index = this.host.project.index;

    let results = index.fuzzyMatchPath(this.searchBox.value);
    this.populate(results);
    this.showPanel();
    this.select(0);
  },

  onSearchKey: function(e) {
    switch (e.keyCode) {
      case e.DOM_VK_RETURN:
      case e.DOM_VK_ENTER: {
        this.finish();
        break;
      }
      case e.DOM_VK_DOWN: {
        let index = this.selectedIndex === undefined ? 0 : this.selectedIndex + 1;
        this.select(index);
        break;
      }
      case e.DOM_VK_UP: {
        let index = this.selectedIndex === undefined ? 0 : this.selectedIndex - 1;
        this.select(index);
        break;
      }
    }
  },

  select: function(index) {
    if (this.results.length < 1) {
      return;
    }

    if (index < 0) {
      index = 0;
    }
    if (index >= this.results.length) {
      index = this.results.length - 1;
    }

    if (this.selectedIndex !== undefined) {
      this.cards[this.selectedIndex].classList.remove("selected");
    }
    this.selectedIndex = index;
    this.cards[index].classList.add("selected");
    this.host.openResource(this.results[index].resource);
  },

  finish: function() {
    if (this.selectedIndex === undefined && this.results && this.results.length > 0) {
      this.selectedIndex = 0;
    }
    if (this.selectedIndex !== undefined) {
      this.host.openResource(this.results[this.selectedIndex].resource);
    }
    this.panel.hidePopup();
    this.searchBox.value = "";
    this.host.currentEditor.editor.focus();
  },

  populateHistory: function() {
    let history = this.host.shells.history;
    let results = [];
    for (let i = history.items.length - 2; i >= 0; i--) {
      let shell = history.items[i];
      let project = shell.pair.project;
      if (project) {
        results.push({ score: 1, resource: project });
      }
    }
    this.populate(results);
  },

  populate: function(searchResults) {
    this.results = searchResults;
    this.cards = [];

    while (this.panel.firstChild) {
      this.panel.removeChild(this.panel.firstChild);
    }

    for (let i = 0; i < VISIBLE_RESULTS && i < searchResults.length; i++) {
      let result = searchResults[i];
      let card = this.cardFor(result.resource);
      this.panel.appendChild(card);
      this.cards.push(card);
    }
  },

  cardFor: function(resource) {
    let card = this.host.createElement("vbox", {
      class: "light results-panel-item list-widget-item"
    });

    let name = this.host.createElement("label", {
      parent: card,
      class: "plain results-panel-item-name",
      value: resource.basename
    });

    let details = this.host.createElement("label", {
      parent: card,
      class: "plain results-panel-item-details",
      value: resource.relativePath()
    });

    return card;
  },

  showPanel: function() {
    this.panel.hidden = false;
    this.panel.openPopup(this.searchBox, "after_start", 0, 0);
  },

  onCommand: function(cmd, target) {
    if (target === this.command) {
      this.searchBox.focus();
      this.searchBox.select();
      this.populateHistory();
      if (this.results.length > 0) {
        this.showPanel();
      }
    }
  }
});

exports.Search = Search;
registerPlugin(Search);
