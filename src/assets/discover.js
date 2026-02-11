const apiUrl = "https://api.node42.dev";
const wwwUrl = "https://www.node42.dev";

let terminal;
let discoveryTrace;

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

function addSvgClickListener() {
  const bubble = document.getElementById("bubble");
  const svgEl = bubble.querySelector("svg");

  svgEl.addEventListener("click", function (e) {
  const link = e.target.closest("a");
    if (link) {
      e.preventDefault();
      const url = link.getAttribute("href");
      
      if (url.includes("issues?code=")) {
        window.open(url, '_blank');
      }
      else {
        if (!url.startsWith("#")) {
          terminal.open({
              url: url,
              method: "GET"
          });
        }
        else {
          let itemUrl = null;

          const item = url.replace("#", "");
          switch (item) {
            case "DISCOVERY": {
              const discoveryId = link.getAttribute("data-discovery");
              console.log("discoveryId: " + discoveryId);
              
              terminal.show({
                  command: "trace",
                  run: true
              });
              break;
            }

            case "N42": {
              itemUrl = link.getAttribute("data-n42-url");
              break;
            }

            case "BCARD": {
              itemUrl = link.getAttribute("data-bcard-url");
              break;
            }

            case "NAPTR": {
              const naptrUrl = link.getAttribute("data-naptr-url");
              console.log("naptr: " + naptrUrl);
              break;
            }

            case "SMP": {
              itemUrl = link.getAttribute("data-smp-url");
              break;
            }

            case "SMP-SG": {
              //itemUrl = link.getAttribute("data-smp-sg-url");
              const trace = discoveryTrace.find(t => t.step === "smp.serviceGroup.url");
              itemUrl = trace.data.url;
              break;
            }

            case "SMP-SM": {
              //itemUrl = link.getAttribute("data-smp-sm-url");
              const trace = discoveryTrace.find(t => t.step === "smp.serviceMetadata.url");
              itemUrl = trace.data.url;
              break;
            }

            case "AP": {
              itemUrl = link.getAttribute("data-ap-url");
              break;
            }

            case "EP": {
              itemUrl = link.getAttribute("data-ep-url");
              break;
            }

            case "TLS": {
              itemUrl = link.getAttribute("data-tls-url");
              break;
            }
          }

          if (itemUrl && itemUrl.length) {
            terminal.open({
              url: itemUrl,
              method: "GET"
            });
          }
        }
      }
    }
  });
}

function _getDiscoveryTrace() {
  const bubble = document.getElementById("bubble");
  const svgEl = bubble.querySelector("svg");

  if (!svgEl) return null;

  const svgString = new XMLSerializer().serializeToString(svgEl);
  const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");

  const meta = doc.getElementsByTagName("metadata")[0];
  if (!meta) return null;

  try {
    return JSON.parse(meta.textContent);
  } catch (e) {
    console.error("Invalid metadata JSON", e);
    return null;
  }
}

function getDiscoveryTrace() {
  const meta = document.querySelector("#bubble svg metadata");
  return meta ? JSON.parse(meta.textContent) : null;
}

document.addEventListener("DOMContentLoaded", () => {
  formatSvg();
  addDownloadLinkListener();
  
  terminal = new Terminal({
      title: "Terminal",
      theme: "light",
      pkgVersion: "0.3.65"
  });

  addSvgClickListener();
  discoveryTrace = getDiscoveryTrace();
});