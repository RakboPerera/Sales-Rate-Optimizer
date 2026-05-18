import { Router } from 'express';
import { validateScenario } from '../lib/validation.js';

function nowIso() {
  return new Date().toISOString();
}

function parseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    operator_label: row.operator_label,
    inputs: row.inputs_json ? JSON.parse(row.inputs_json) : null,
    rules: row.rules_json ? JSON.parse(row.rules_json) : null,
    rule_profile_id: row.rule_profile_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createScenariosRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT s.*, p.name AS rule_profile_name
         FROM scenarios s
         LEFT JOIN rule_profiles p ON p.id = s.rule_profile_id
         ORDER BY s.updated_at DESC`
      )
      .all();
    res.json(
      rows.map((r) => ({
        ...parseRow(r),
        rule_profile_name: r.rule_profile_name || null,
      }))
    );
  });

  router.get('/:id', (req, res) => {
    const row = db
      .prepare(
        `SELECT s.*, p.name AS rule_profile_name
         FROM scenarios s
         LEFT JOIN rule_profiles p ON p.id = s.rule_profile_id
         WHERE s.id = ?`
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ field: 'id', message: 'Scenario not found.' });
    res.json({ ...parseRow(row), rule_profile_name: row.rule_profile_name || null });
  });

  router.post('/', (req, res) => {
    const body = req.body || {};
    const violation = validateScenario(body);
    if (violation) return res.status(400).json(violation);
    const ts = nowIso();
    const result = db
      .prepare(
        `INSERT INTO scenarios (name, description, operator_label, inputs_json, rules_json, rule_profile_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        body.name.trim(),
        body.description || null,
        body.operator_label || 'Operator',
        JSON.stringify(body.inputs),
        body.rules ? JSON.stringify(body.rules) : null,
        body.rule_profile_id || null,
        ts,
        ts
      );
    const row = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(parseRow(row));
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ field: 'id', message: 'Scenario not found.' });
    const body = req.body || {};
    const violation = validateScenario(body);
    if (violation) return res.status(400).json(violation);
    db.prepare(
      `UPDATE scenarios
       SET name = ?, description = ?, operator_label = ?, inputs_json = ?, rules_json = ?, rule_profile_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      body.name.trim(),
      body.description || null,
      body.operator_label || 'Operator',
      JSON.stringify(body.inputs),
      body.rules ? JSON.stringify(body.rules) : null,
      body.rule_profile_id || null,
      nowIso(),
      req.params.id
    );
    const row = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id);
    res.json(parseRow(row));
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ field: 'id', message: 'Scenario not found.' });
    db.prepare('DELETE FROM scenarios WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
