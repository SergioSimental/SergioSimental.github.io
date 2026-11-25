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
