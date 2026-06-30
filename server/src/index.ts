import express from 'express';
import cors from 'cors';
import { api } from './api/routes';

const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/api', api);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[conseal-review] backend listening on http://localhost:${PORT}`);
});
