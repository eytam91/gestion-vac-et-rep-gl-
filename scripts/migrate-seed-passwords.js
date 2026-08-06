#!/usr/bin/env node
/*
  scripts/migrate-seed-passwords.js
  Idempotent script to ensure seeded users' passwords are stored as bcrypt hashes.

  Usage:
    # dry run - shows what would change
    node scripts/migrate-seed-passwords.js --dry-run

    # apply changes
    node scripts/migrate-seed-passwords.js

  Requires environment variables:
    SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME, SQL_PORT (optional)
*/

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run') || argv.includes('-n');

const seededEmails = ['admin@local.app','user1@local.app','user2@local.app','user3@local.app','user4@local.app'];

function getClient() {
  return new Client({
    host: process.env.SQL_HOST || 'localhost',
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  });
}

async function run() {
  if (!process.env.SQL_USER || !process.env.SQL_DB_NAME) {
    console.error('Missing required env vars. Please set SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME.');
    process.exit(1);
  }

  const client = getClient();
  await client.connect();

  try {
    const res = await client.query('SELECT uid, email, password FROM users WHERE email = ANY($1)', [seededEmails]);
    if (res.rows.length === 0) {
      console.log('No seeded users found. Nothing to do.');
      return;
    }

    for (const row of res.rows) {
      const { uid, email, password } = row;
      const stored = password || '';
      const looksHashed = typeof stored === 'string' && stored.startsWith('$2');

      if (looksHashed) {
        // Verify that the hash matches the known seeded plaintext if we know it
        // We only know the seeded plaintexts for the default accounts.
        const plain = email === 'admin@local.app' ? 'admin123' : 'user123';
        const ok = await bcrypt.compare(plain, stored).catch(() => false);
        if (ok) {
          console.log(`${email}: already hashed and matches known seed password — OK.`);
        } else {
          console.log(`${email}: already hashed but does not match known seed password — leaving as-is.`);
        }
      } else {
        const plain = email === 'admin@local.app' ? 'admin123' : 'user123';
        const hashed = await bcrypt.hash(plain, 10);
        if (dryRun) {
          console.log(`[dry-run] Would replace plaintext password for ${email} with bcrypt hash.`);
        } else {
          await client.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, email]);
          console.log(`${email}: password hashed and updated.`);
        }
      }
    }

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(2);
  } finally {
    await client.end();
  }
}

run();
