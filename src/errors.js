const { WWW_URL } = require("./config");
const C = require("./colors");

function handleError(err) {
  //console.log(err);

  const code = err.code?.startsWith("N42E-")
      ? err.code.slice(5)
      : undefined;

  const message = err.message;

  const url = code
    ? `${WWW_URL}/errors?code=${code}`
    : `${WWW_URL}/errors`;
  //console.log(url);

  if (message) {
    console.error(`\r${C.RED}${err.message}${C.RESET}\nSee details: ${C.BOLD}${url}${C.RESET}\n`);
  } else {
    console.error(`\rSee details: ${C.BOLD}${url}${C.RESET}\n`);
  }
}

module.exports = { handleError };