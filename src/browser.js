const open = require("open").default;
let browserOpened = false;

async function openOnce(target) {
  if (browserOpened) return;
  browserOpened = true;
  await open(target, { wait: false });
}

module.exports = { openOnce };