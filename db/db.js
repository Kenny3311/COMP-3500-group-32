const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.resolve(__dirname, "restaurant.db");

const db = new Database(dbPath);

module.exports = db;
