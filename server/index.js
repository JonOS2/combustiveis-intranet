require('dotenv').config();
const express = require('express');
const cors = require('cors');

const combustivelRoutes = require('./src/routes/combustivel.routes');
const { iniciarJobs } = require('./src/jobs/sync.job');

/* =========================
   VALIDAÇÃO DE AMBIENTE
========================= */
if (!process.env.APP_TOKEN) {
  console.error('❌ APP_TOKEN não definido no .env');
  process.exit(1);
}

/* =========================
   APP
========================= */
const app = express();

/* =========================
   MIDDLEWARES
========================= */
app.use(cors({
  origin: '*',
  exposedHeaders: ['Content-Disposition']
}));

app.use(express.json());

/* =========================
   ROTAS
========================= */
app.use('/api/combustivel', combustivelRoutes);

/* =========================
   HEALTH CHECK
========================= */
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  iniciarJobs();
});
