const { WWW_URL } = require("./config");


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
    console.error(`\r${err.message}\nSee details: ${url}\n`);
  } else {
    console.error(`\rSee details: ${url}\n`);
  }
}

module.exports = { handleError };