import { Router } from 'express';
import { getPolicyConfig, updatePolicyConfig } from '../gateway/policy-config.js';

const router = Router();

router.get('/policy', (_req, res) => {
  const config = getPolicyConfig('default');
  res.json(config);
});

router.patch('/policy', (req, res) => {
  const updates = req.body;
  const updated = updatePolicyConfig('default', updates);
  res.json(updated);
});

export default router;
