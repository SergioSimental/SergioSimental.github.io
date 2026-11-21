// Mobile menu: the ☰ button opens and closes the nav on small screens.
(function () {
  var header = document.querySelector("[data-menu]");
  var button = document.querySelector("[data-menu-button]");
  if (!header || !button) return;

  function setOpen(open) {
    header.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  button.addEventListener("click", function () {
    setOpen(!header.classList.contains("is-open"));
  });

  // Close with Escape, or when the screen gets wide enough for the full nav.
  header.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && header.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });
  window.matchMedia("(min-width: 760px)").addEventListener("change", function (e) {
    if (e.matches) setOpen(false);
  });
})();

// Demo videos: show the preview image until someone presses "Play demo",
// then swap in the video so nothing heavy loads up front.
document.querySelectorAll("[data-demo]").forEach(function (media) {
  var play = media.querySelector("[data-demo-play]");
  if (!play) return;
  play.addEventListener("click", function () {
    var video = document.createElement("video");
    video.src = media.getAttribute("data-demo");
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-label", media.getAttribute("data-demo-label") || "Demo video");
    Array.prototype.slice.call(media.children).forEach(function (child) {
      if (!child.classList.contains("project-card__badge")) child.remove();
    });
    media.insertBefore(video, media.firstChild);
    video.focus();
  });
});
