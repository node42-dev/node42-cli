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

  const link = `\u001B]8;;${url}\u0007View Details\u001B]8;;\u0007`;

  if (message) {
    console.error(`\r${C.BOLD}Error: ${code}${C.RESET} ${C.BLUE}[${link}]${C.RESET}\n\n${C.RED}${err.message}${C.RESET}\n`);
  } else {
    console.error(`\r${C.BOLD}Error: ${code}${C.RESET} ${C.BLUE}[${url}]${C.RESET}\n\nFor details, see the documentation.\n`);
  }
}

module.exports = { handleError };