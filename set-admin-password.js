/* Usage: node set-admin-password.js <newpassword> */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const newPassword = process.argv[2];
if (!newPassword) {
  console.error("Usage: node set-admin-password.js <newpassword>");
  process.exit(1);
}

const configPath = path.join(__dirname, "admin-config.json");
const salt = crypto.randomBytes(16).toString("hex");
const passwordHash = crypto.scryptSync(newPassword, salt, 64).toString("hex");
fs.writeFileSync(configPath, JSON.stringify({ salt, passwordHash }, null, 2));
console.log("Admin password updated. Restart the server for it to take effect.");
