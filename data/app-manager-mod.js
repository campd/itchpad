const { OS } = Components.utils.import("resource://gre/modules/osfile.jsm", {});

function editClick(thing, location) {
  var wrapper = Components.classes["@mozilla.org/devtools/itchpad;1"].getService(Components.interfaces.nsISupports);
  var service = wrapper.wrappedJSObject;

  service.openManifest(OS.Path.join(location, "manifest.webapp"));
}

window.UI.targetsForManifest = new Map();

window.UI.refreshManifest = function(path) {
  let projects = document.querySelector(".projects-panel");
  // XXX: fix the button
  projects.contentWindow.UI.update({}, OS.Path.dirname(path));
}

function modifyProjects() {
  let projects = document.querySelector(".projects-panel");

  function doModifyProjects(event) {
    projects.removeEventListener("load", doModifyProjects);

    projects.contentWindow.itchpadEditClick = editClick;

    let doc = projects.contentDocument;
    let buttons = doc.querySelector("#lense-template .project-buttons");

    let edit = doc.createElement("button");
    edit.setAttribute("class", "project-button-update");
    edit.setAttribute("onclick", "itchpadEditClick(this, this.dataset.location)");
    edit.setAttribute("template", '{"type":"attribute","path":"location","name":"data-location"}');
    edit.textContent = "Edit";

    buttons.insertBefore(edit, buttons.firstChild);

    // This is really hacky, but I really don't want to edit firefox
    // right now.  Will file an app-manager bug to make this less
    // hacky.
    let projectsUI = projects.contentWindow.UI;
    let topUI = window.UI;


    let realStart = projectsUI.start;
    let realOpen = topUI.openAndShowToolboxForTarget;

    projectsUI.start = function(project) {
      let manifest = OS.Path.join(OS.Path.normalize(project.location), "manifest.webapp");

      topUI.openAndShowToolboxForTarget = function(target, name, icon) {
        window.UI.targetsForManifest.set(manifest, target);
        let event = new CustomEvent("NewTarget");
        window.document.dispatchEvent(event);

        topUI.openAndShowToolboxForTarget = realOpen;
        return topUI.openAndShowToolboxForTarget(target, name, icon);
      };

      return realStart.call(projectsUI, project);
    }
  }

  projects.addEventListener("load", doModifyProjects);
}

//addPanel();
modifyProjects();
