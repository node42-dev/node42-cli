const fs = require("fs");
const { NODE42_DIR, USER_FILE, USAGE_FILE } = require("./config");

function updateUserInfo(user) {
  fs.mkdirSync(NODE42_DIR, { recursive: true });

  fs.writeFileSync(
    USER_FILE,
    JSON.stringify(user, null, 2)
  );  
}

function getUserInfo() {
  try {
    if (!fs.existsSync(USER_FILE)) {
      return {
        userName: "n/a",
        userMail: "n/a",
        role: "n/a"
      };
    }
    return JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
  } catch {
    return {
        userName: "n/a",
        userMail: "n/a",
        role: "n/a"
    };
  }
}

function updateUserUsage(usage) {
  fs.mkdirSync(NODE42_DIR, { recursive: true });

  fs.writeFileSync(
    USAGE_FILE,
    JSON.stringify(usage, null, 2)
  );
}

function getUserUsage() {
  try {
    if (!fs.existsSync(USAGE_FILE)) {
      return {
        serviceUsage: {
          discovery: {},
          validation: {},
          transactions: {}
        }
      };
    }
    return JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
  } catch {
    return {
      serviceUsage: {
        discovery: {},
        validation: {},
        transactions: {}
      }
    };
  }
}

module.exports = { updateUserInfo, getUserInfo, updateUserUsage, getUserUsage };