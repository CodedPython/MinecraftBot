// file: parseCreds.js
const fs = require('fs').promises;
const path = require('path');

/**
 * Parse a credentials file containing lines of "username:password".
 * - Ignores blank lines and lines starting with '#'
 * - Trims whitespace around username/password
 * - Throws if a non-comment, non-blank line doesn't contain exactly one ':'
 *
 * @param {string} filepath - path to cred file
 * @returns {Promise<Array<{username:string,password:string}>>}
 */
async function parseCredsFile(filepath) {
  const txt = await fs.readFile(filepath, 'utf8');
  const lines = txt.split(/\r?\n/);
  const creds = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#')) continue;

    const parts = raw.split(':');
    if (parts.length !== 2) {
      // include line number for easier debug
      throw new Error(`Malformed credential on line ${i + 1}: "${lines[i]}"`);
    }

    const username = parts[0].trim();
    const password = parts[1].trim();

    if (!username) throw new Error(`Empty username on line ${i + 1}`);
    // note: password can be empty if you want to allow that; change check if not allowed
    creds.push({ username, password });
  }

  return creds;
}

module.exports = { parseCredsFile };
