const { OS } = Components.utils.import("resource://gre/modules/osfile.jsm", {});

function editClick(thing, location) {
  var wrapper = Components.classes["@mozilla.org/devtools/itchpad;1"].getService(Components.interfaces.nsISupports);
  var service = wrapper.wrappedJSObject;

  service.openPath(OS.Path.join(location, "manifest.webapp"));
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
  }

  projects.addEventListener("load", doModifyProjects);
}

//addPanel();
modifyProjects();
