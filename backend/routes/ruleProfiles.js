import { Router } from 'express';
import { validateRuleProfile } from '../lib/validation.js';
import { DEFAULT_RULES } from '../lib/defaultRules.js';

function nowIso() {
  return new Date().toISOString();
}

function parseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    is_system: row.is_system === 1,
    rules: row.rules_json ? JSON.parse(row.rules_json) : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createRuleProfilesRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const rows = db
      .prepare('SELECT * FROM rule_profiles ORDER BY is_system DESC, name ASC')
      .all();
    res.json(rows.map(parseRow));
  });

  router.get('/defaults', (req, res) => {
    res.json({ rules: DEFAULT_RULES });
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM rule_profiles WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ field: 'id', message: 'Profile not found.' });
    res.json(parseRow(row));
  });

  router.post('/', (req, res) => {
    const body = req.body || {};
    const violation = validateRuleProfile(body);
    if (violation) return res.status(400).json(violation);
    const ts = nowIso();
    const result = db
      .prepare(
        `INSERT INTO rule_profiles (name, description, is_system, rules_json, created_at, updated_at)
         VALUES (?, ?, 0, ?, ?, ?)`
      )
      .run(
        body.name.trim(),
        body.description || null,
        JSON.stringify({ ...DEFAULT_RULES, ...(body.rules || {}) }),
        ts,
        ts
      );
    const row = db.prepare('SELECT * FROM rule_profiles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseRow(row));
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM rule_profiles WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ field: 'id', message: 'Profile not found.' });
    const body = req.body || {};

    if (existing.is_system === 1) {
      // System profiles: allow only name/description changes
      const name = (body.name || existing.name).toString().trim();
      const description = body.description !== undefined ? body.description : existing.description;
      if (!name) return res.status(400).json({ field: 'name', message: 'Name required.' });
      db.prepare(
        'UPDATE rule_profiles SET name = ?, description = ?, updated_at = ? WHERE id = ?'
      ).run(name, description, nowIso(), req.params.id);
    } else {
      const violation = validateRuleProfile(body);
      if (violation) return res.status(400).json(violation);
      db.prepare(
        `UPDATE rule_profiles
         SET name = ?, description = ?, rules_json = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        body.name.trim(),
        body.description || null,
        JSON.stringify({ ...DEFAULT_RULES, ...(body.rules || {}) }),
        nowIso(),
        req.params.id
      );
    }
    const row = db.prepare('SELECT * FROM rule_profiles WHERE id = ?').get(req.params.id);
    res.json(parseRow(row));
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM rule_profiles WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ field: 'id', message: 'Profile not found.' });
    if (existing.is_system === 1) {
      return res
        .status(400)
        .json({ field: 'id', message: 'System profiles cannot be deleted.' });
    }
    db.prepare('DELETE FROM rule_profiles WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
