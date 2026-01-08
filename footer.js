document.addEventListener("DOMContentLoaded", function () {
  // Home page hero title tweak
  if (location.pathname === "/" || location.pathname.includes("index.php")) {
    const wrap = document.querySelector(".cover-title-inner");
    if (!wrap) return;

    const h1 = wrap.querySelector("h1");
    if (h1) h1.textContent = "Darci Margeson";

    const p = wrap.querySelector("p");
    if (p) p.textContent = "Southern Key Realty • White Glove Service • Treasure Coast Expert";
  }
});
