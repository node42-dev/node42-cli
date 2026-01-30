const db = require("./db");

function getUser() {
  const users = db.get("user");
  return users.length ? users[0] : {
      "id": "n/a",
      "userName": "n/a",
      "userMail": "n/a",
      "role": "n/a"
    };
}

function getUserUsage() {
  const usage = db.get("serviceUsage");

  if (usage && usage.serviceUsage) return usage;

  return {
    serviceUsage: {
      discovery: {},
      validation: {},
      transactions: {}
    }
  };
}

module.exports = { getUser, getUserUsage };