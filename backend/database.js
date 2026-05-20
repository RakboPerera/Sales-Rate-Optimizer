// sql.js wrapper with async init + autosave.
// Pattern from JKH skill §8.

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYSTEM_PROFILES } from './lib/defaultRules.js';
import { BU_SCENARIOS } from './lib/buScenarios.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, 'storage');
const DB_PATH = path.join(DB_DIR, 'data.db');

class DatabaseWrapper {
  constructor(db, savePath) {
    this.db = db;
    this.savePath = savePath;
  }

  save() {
    try {
      const bytes = this.db.export();
      fs.writeFileSync(this.savePath, Buffer.from(bytes));
    } catch (e) {
      console.error('DB save failed:', e.message);
    }
  }

  prepare(sql) {
    const wrapper = this;
    return {
      run: (...params) => {
        const stmt = wrapper.db.prepare(sql);
        try {
          stmt.bind(params);
          stmt.step();
          // Capture last_insert_rowid before any further writes
          const res = wrapper.db.exec('SELECT last_insert_rowid() AS id, changes() AS chg');
          const id = res[0]?.values?.[0]?.[0] ?? null;
          const chg = res[0]?.values?.[0]?.[1] ?? 0;
          stmt.free();
          wrapper.save();
          return { lastInsertRowid: id, changes: chg };
        } catch (e) {
          stmt.free();
          throw e;
        }
      },
      get: (...params) => {
        const stmt = wrapper.db.prepare(sql);
        try {
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          stmt.free();
          throw e;
        }
      },
      all: (...params) => {
        const stmt = wrapper.db.prepare(sql);
        try {
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        } catch (e) {
          stmt.free();
          throw e;
        }
      },
    };
  }

  exec(sql) {
    this.db.exec(sql);
    this.save();
  }
}

function nowIso() {
  return new Date().toISOString();
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      operator_label TEXT NOT NULL DEFAULT 'Operator',
      inputs_json TEXT NOT NULL,
      rules_json TEXT,
      rule_profile_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rule_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      rules_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedSystemProfiles(wrapper) {
  const existing = wrapper.prepare('SELECT COUNT(*) AS c FROM rule_profiles WHERE is_system = 1').get();
  if (existing && existing.c > 0) return;
  const ts = nowIso();
  for (const profile of SYSTEM_PROFILES) {
    wrapper
      .prepare(
        `INSERT INTO rule_profiles (name, description, is_system, rules_json, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?)`
      )
      .run(profile.name, profile.description, JSON.stringify(profile.rules), ts, ts);
  }
}

// Seed the 12 BU reference scenarios so users can load any of them from the
// Scenarios tab on first open. Only inserts entries that don't already exist
// (matched by name), so user-modified or user-deleted records are respected.
function seedBuScenarios(wrapper) {
  const ts = nowIso();
  for (const sc of BU_SCENARIOS) {
    const existing = wrapper
      .prepare('SELECT id FROM scenarios WHERE name = ?')
      .get(sc.name);
    if (existing) continue;
    wrapper
      .prepare(
        `INSERT INTO scenarios (name, description, operator_label, inputs_json, rules_json, rule_profile_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        sc.name,
        sc.description,
        sc.inputs.operator_label || 'Operator',
        JSON.stringify(sc.inputs),
        null, // use default rules
        ts,
        ts
      );
  }
}

export async function getDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  initSchema(db);
  const wrapper = new DatabaseWrapper(db, DB_PATH);
  wrapper.save();
  seedSystemProfiles(wrapper);
  seedBuScenarios(wrapper);
  return wrapper;
}
