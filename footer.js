document.addEventListener("DOMContentLoaded", function () {
  // YouTube background loader
  const yt = document.querySelector(".hbd-yt-bg iframe");
  if (!yt) return;

  yt.addEventListener("load", () => {
    yt.parentElement.classList.add("loaded");
  });
});
