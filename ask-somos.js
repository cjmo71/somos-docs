/* Ask Somos launcher on the manual (docs.somosincontrol.com).
 * Mintlify runs every .js file in this folder once per visit, on every page
 * (https://mintlify.com/docs/customize/custom-scripts — "Custom JavaScript").
 * This loads the same widget every somosincontrol.com page loads, so the manual gets the same
 * bottom-right Ask Somos launcher, its calm nudge and the chat. The widget itself lives in the
 * somos-guide Worker (~/Projects/somos-docs-helper, widget/somos-guide.js); change it there, not here. */
(function () {
  if (typeof window === "undefined" || window.__somosGuide || document.getElementById("somos-guide-loader")) return;
  var s = document.createElement("script");
  s.id = "somos-guide-loader";
  s.src = "https://somos-guide.somos-poll.workers.dev/widget.js";
  s.defer = true;
  document.head.appendChild(s);
})();
