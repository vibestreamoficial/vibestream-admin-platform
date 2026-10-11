const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.join(__dirname, 'data');
fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(path.join(dbDir, 'platform.db'));

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.exec(
      `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `,
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
};

module.exports = { db, initializeDatabase };
