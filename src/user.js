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

function getUserUsage(userId, service, month) {
  const database = db.load();

  const u = database.user.find(x => x.id === userId);
  if (!u) return;

  u.serviceUsage[service] ??= {};
  const usage = u.serviceUsage[service][month];
  return usage;
}


function setUserUsage(userId, service, month, value) {
  const database = db.load();

  const u = database.user.find(x => x.id === userId);
  if (!u) return;

  u.serviceUsage[service] ??= {};
  u.serviceUsage[service][month] = value;

  db.save(database);
}

module.exports = { getUser, getUserUsage, setUserUsage };