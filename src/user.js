const db = require("./db");

function getUserWithIndex(index) {
  const users = db.get("user");
  return users.length ? users[index] : {
      "id": "n/a",
      "userName": "n/a",
      "userMail": "n/a",
      "role": "n/a"
    };
}

function getUserWithId(userId) {
  const database = db.load();

  const u = database.user.find(x => x.id === userId);
  if (!u) {
    return {
      "id": "n/a",
      "userName": "n/a",
      "userMail": "n/a",
      "role": "n/a"
    }
  }
  return u;
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

module.exports = { getUserWithIndex, getUserWithId, getUserUsage, setUserUsage };