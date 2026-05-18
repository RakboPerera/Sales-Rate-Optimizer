import { Router } from 'express';
import { runOptimizer } from '../lib/optimizer.js';
import { validateOptimizerRequest } from '../lib/validation.js';

export function createOptimizeRouter(db) {
  const router = Router();

  router.post('/', (req, res) => {
    try {
      const payload = req.body || {};

      // Resolve rule_profile_id → rules object (rules in body override profile)
      if (payload.rule_profile_id && db) {
        const profile = db
          .prepare('SELECT rules_json FROM rule_profiles WHERE id = ?')
          .get(payload.rule_profile_id);
        if (profile) {
          const fromProfile = JSON.parse(profile.rules_json);
          payload.rules = { ...fromProfile, ...(payload.rules || {}) };
        }
      }

      const violation = validateOptimizerRequest(payload);
      if (violation) {
        return res.status(400).json(violation);
      }

      const t0 = Date.now();
      const result = runOptimizer(payload);
      result.compute_ms = Date.now() - t0;
      res.json(result);
    } catch (e) {
      console.error('Optimize error:', e);
      res.status(500).json({ field: 'server', message: e.message || 'Internal error.' });
    }
  });

  return router;
}
