import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { seedDatabase } from './db/seed.js';
import catalogRouter from './catalog/catalog-api.js';
import apiRouter from './api/routes.js';

seedDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'vyapar-server' });
});

app.use('/api', catalogRouter);
app.use('/api', apiRouter);

app.listen(PORT, () => {
  console.log(`Vyapar server running on http://localhost:${PORT}`);
});

export default app;
