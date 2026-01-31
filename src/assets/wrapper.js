function formatSvg() {
  const bubble = document.getElementById("bubble");
  const svgEl = bubble.querySelector("svg");
  
  if (svgEl) {
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svgEl.style.removeProperty('width');
    svgEl.style.removeProperty('height');

    const svgTitleEl = svgEl.querySelector("title");
    if (svgTitleEl) {
      svgTitleEl.remove();
    }
  }
}

function addDownloadLinkListener() {
  const bubble = document.getElementById("bubble");
  const svgEl = bubble.querySelector("svg");
  const svg = new XMLSerializer().serializeToString(svgEl);
  const refId = bubble.dataset.uuid;

  const linkEl = document.getElementById("link");
  linkEl.addEventListener("click", (e) => {
    e.preventDefault();

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.id = `discovery-${refId}`; 
    a.download = `discovery${refId ? "-" + refId : ""}.svg`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  formatSvg();
  addDownloadLinkListener();
});