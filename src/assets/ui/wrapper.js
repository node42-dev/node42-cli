let appBtn;
let appMenu;


function placeMenu(menu, btn, offset) {
  menu.style.display = "block";

  const b = btn.getBoundingClientRect();
  const m = menu.getBoundingClientRect();

  const openLeft = b.left > window.innerWidth / 2;

  let left = openLeft
    ? b.left - m.width - offset   // open LEFT (user menu)
    : b.right + offset;           // open RIGHT (settings)

  left = Math.max(offset, Math.min(left, window.innerWidth - m.width - offset));

  let top = b.bottom + offset;
  const spaceBelow = window.innerHeight - b.bottom;

  if (spaceBelow < m.height + (offset + 4) && b.top > m.height + (offset + 4)) {
    top = b.top - m.height - offset;
  }

  top = Math.max(offset, Math.min(top, window.innerHeight - m.height - offset));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function toggleMenu(menu, btn, offset) {
  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
  if (!isOpen) placeMenu(menu, btn, offset);
}

function hideMenu(menu) {
  menu.style.display = "none";
}

function downloadInsomniaCollection() {
  // Create an invisible link element
  var link = document.createElement('a');
  link.href = 'https://www.node42.dev/insomnia.yaml';
  link.download = 'node42-insomnia.yaml';  // Triggered download filename
  link.click();
}

document.addEventListener("DOMContentLoaded", () => {
    appBtn = document.getElementById("appBtn");
    appMenu = document.getElementById("app-menu");
    appBtn.onclick = () => toggleMenu(appMenu, appBtn, 0);
});