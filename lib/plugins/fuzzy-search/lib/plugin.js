const { Class } = require("sdk/core/heritage");
const { registerPlugin, Plugin } = require("plugins/core");
const match = require("path-match");

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
      hidden: true,
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

    this.onSearchFocus = this.onSearchFocus.bind(this);
    this.onSearchInput = this.onSearchInput.bind(this);
    this.onSearchKey = this.onSearchKey.bind(this);

    this.searchBox.addEventListener("focus", this.onSearchFocus, true);
    this.searchBox.addEventListener("input", this.onSearchInput, true);
    this.searchBox.addEventListener("keypress", this.onSearchKey, true);
  },

  populateHistory: function() {
    let history = this.host.shells.history || { items: [] };
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

  populate: function(searchResults, search) {
    this.results = searchResults;
    this.cards = [];

    while (this.panel.firstChild) {
      this.panel.removeChild(this.panel.firstChild);
    }

    let searchExpression = search ? match.pathMatchExpression(search) : null;

    for (let i = 0; i < VISIBLE_RESULTS && i < searchResults.length; i++) {
      let result = searchResults[i];
      let card = this.cardFor(result.resource, searchExpression);
      this.panel.appendChild(card);
      this.cards.push(card);
      let selectIndex = i;
      card.addEventListener("click", () => {
        this.select(selectIndex);
        this.finish();
      }, true);
    }
  },

  onSearchFocus: function() {
    this.selectedIndex = undefined;
  },

  onSearchInput: function() {
    let index = this.host.project.index;

    let search = this.searchBox.value;
    let results = index.fuzzyMatchPath(this.searchBox.value);

    results = results.sort((a, b) => {
      let diff = b.score - a.score;
      if (diff !== 0) return diff;
      // Prefer longer URI matches
      diff = b.resource.path.length - a.resource.path.length;
      if (diff !== 0) return diff;
      return a.resource.path.localeCompare(b.resource.path);
    });

    this.populate(results, search);
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
      case e.DOM_VK_ESCAPE: {
        this.finish();
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
    if (this.results[this.selectedIndex]) {
      this.host.openResource(this.results[this.selectedIndex].resource);
    }
    this.panel.hidePopup();
    this.searchBox.value = "";
    this.searchBox.setAttribute("hidden", "true");
    this.host.currentEditor.editor.focus();
  },

  cardFor: function(resource, search) {
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
    });

    let displayPath = resource.relativePath();
    let annotated = search ? match.annotate(search, displayPath) : null;
    if (annotated) {
      for (let fragment of annotated) {
        let span = this.host.createElement("span", {
          parent: details,
          class: fragment.matched ? "results-panel-item-match" : "",
        });
        span.textContent = fragment.fragment;
      }
    } else {
      details.setAttribute("value", resource.relativePath());
    }

    return card;
  },

  showPanel: function() {
    this.panel.hidden = false;
    this.panel.openPopup(this.searchBox, "after_start", 0, 0);
  },

  onCommand: function(cmd, target) {
    if (cmd === "search-files") {
      this.searchBox.removeAttribute("hidden");
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
