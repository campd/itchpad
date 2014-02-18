

  // Wrote a script in the morning to show a screen comp on top of other content.
  // This code is terrible...

  var addComp = (function () {

      function getLocalStorage() {
        var coords = [];
        try {
          coords = JSON.parse(localStorage["compcoords"]);
        }
        catch (e) {

        }
        return coords;
      }
      function setLocalStorage(i, x, y) {
        var coords = getLocalStorage();
        coords[i] = { top: y, left: x };
        try {
          localStorage["compcoords"] = JSON.stringify(coords);
        }
        catch(e) {

        }

      }

      var startX = 0; var startY = 0;
      draggable(document.body, function (currentX, currentY) {

          [ ].forEach.call(document.querySelectorAll(".comp-overlay"), function (img, i) {
              var y = (parseInt(img.dataset["starty"]) - startY + currentY);
              img.style.top = y + "px";

              var x = (parseInt(img.dataset["startx"]) - startX + currentX);
              img.style.left = x + "px";

              setLocalStorage(i, x, y);
          });

      }, function (e) {
          startX = e.pageX;
          startY = e.pageY;

          [ ].forEach.call(document.querySelectorAll(".comp-overlay"), function (img, i) {
              img.dataset["starty"] = parseInt(img.style.top) || 0;
              img.dataset["startx"] = parseInt(img.style.left) || 0;
          });
      });

      function draggable(element, onmove, onstart, onstop) {
          onmove = onmove || function () { };
          onstart = onstart || function () { };
          onstop = onstop || function () { };
          var doc = element.ownerDocument || document;
          var dragging = false;
          var offset = {};
          var maxHeight = 0;
          var maxWidth = 0;

          var duringDragEvents = {
              "selectstart": prevent,
              "dragstart": prevent,
              "mousemove": move,
              "mouseup": stop
          };


          function prevent(e) {
              if (e.stopPropagation) {
                  e.stopPropagation();
              }
              if (e.preventDefault) {
                  e.preventDefault();
              }
              e.returnValue = false;
          }

          function move(e) {
              if (dragging) {
                  var pageX = e.pageX;
                  var pageY = e.pageY;

                  onmove.apply(element, [pageX, pageY]);
              }
          }
          function start(e) {
              var rightclick = (e.which) ? (e.which == 3) : (e.button == 2);

              if (window._comps && !rightclick && !dragging) {
                  if (onstart.apply(element, arguments) !== false) {
                      dragging = true;

                      for (var i in duringDragEvents) {
                          if (duringDragEvents.hasOwnProperty(i)) {
                              document.addEventListener(i, duringDragEvents[i], false);
                          }
                      }

                      move(e);
                      prevent(e);
                  }
              }
          }
          function stop() {
              if (dragging) {
                  for (var i in duringDragEvents) {
                      if (duringDragEvents.hasOwnProperty(i)) {
                          document.removeEventListener(i, duringDragEvents[i], false);
                      }
                  }

                  onstop.apply(element, arguments);
              }
              dragging = false;
          }

          element.addEventListener("mousedown", start);
      }

      function toggleVisibility() {

              [ ].forEach.call(document.querySelectorAll(".comp-overlay"), function (e) {
                  e.style.display = (window._comps) ? "block" : "none";
              });

              [ ].forEach.call(document.querySelectorAll(".comp-notification"), function (e) {
                  e.style.display = "none";
              });

      }
      document.body.addEventListener("mousedown", function (e) {
        if (e.target.className === "comp-notification") {
              window._comps = !window._comps;
              toggleVisibility();
        }
      }, false);
      document.body.addEventListener("keydown", function (e) {

          var codes = { UP: 38, RIGHT: 39, DOWN: 40, LEFT: 37, ENTER: 13, ESC: 27 };
          var code = e.keyCode;

          if (code === codes.ENTER) {
              window._comps = !window._comps;
              toggleVisibility();
          }
          if (code === codes.ESC) {
              window._comps = false;
              toggleVisibility();
          }

          if (window._comps) {

              var modifier = (e.shiftKey) ? 10 : 1;
              modifier = (code === codes.LEFT || code === codes.UP) ? -modifier : modifier;

              [ ].forEach.call(document.querySelectorAll(".comp-overlay"), function (img, i) {
                  var y = (parseInt(img.style.top) || 0);
                  var x = (parseInt(img.style.left) || 0);
                  if (code === codes.UP || code === codes.DOWN) {
                      y = y + modifier;
                      img.style.top = y + "px";
                      e.preventDefault();
                  }
                  if (code === codes.LEFT || code === codes.RIGHT) {
                      x = x + modifier;
                      img.style.left = x + "px";
                      e.preventDefault();
                  }

                  setLocalStorage(i, x, y);
              });

          }
      }, false);

      return function(src) {
        var img = new Image();
        img.src = src;
        img.className = "comp-overlay";

        img.style.cssText = "display:none; pointer-events:none;position:absolute; max-width: none; max-height: none; z-index: 10000; opacity: .5; top:0; left:0;";

        document.body.appendChild(img);


        var notification = document.createElement("div");
        notification.className = "comp-notification";
        notification.innerHTML = "<br />Press<br />Enter";

        notification.style.cssText = "position:absolute;text-align: center;top:0;right:0;background:orangered; z-index: 100000; width: 80px; height: 80px; border-radius: 50%;opacity: .9;";

        document.body.appendChild(notification);


          var loadedCoords = getLocalStorage();
          [ ].forEach.call(document.querySelectorAll(".comp-overlay"), function (img, i) {
              var coords = loadedCoords[i];
              if (coords) {
                img.style.top = coords.top + "px";
                img.style.left = coords.left + "px";
              }
          });
      }

  })();

  addComp("../home-page/img/warm-soup.jpg");