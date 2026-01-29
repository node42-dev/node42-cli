const { WWW_URL } = require("./config");


async function handleError(err) {
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
    console.error(`${err.message}\nSee details: ${url}\n`);
  } else {
    console.error(`See details: ${url}\n`);
  }
}

module.exports = { handleError };