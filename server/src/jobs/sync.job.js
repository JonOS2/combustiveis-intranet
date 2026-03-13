const cron = require('node-cron');
const { sincronizar } = require('./sync.worker');

/* =========================
   AGENDAMENTO
   Formato cron: 'segundo minuto hora dia mês diaDaSemana'
   - '0 0 4 * * *'  → todo dia às 04:00 (madrugada, API estável)
   - '0 0 12 * * *' → todo dia às 12:00 (meio-dia, cobre manhã)
   - '0 0 18 * * *' → todo dia às 18:00 (fim do expediente)
========================= */
const iniciarJobs = () => {
  // 04:00 — madrugada, API mais estável
  cron.schedule('0 0 4 * * *', () => {
    console.log('⏰ [CRON] Disparando sincronização das 04:00');
    sincronizar();
  }, { timezone: 'America/Maceio' });

  // 12:00 — meio-dia, cobre atualizações da manhã
  cron.schedule('0 0 12 * * *', () => {
    console.log('⏰ [CRON] Disparando sincronização das 12:00');
    sincronizar();
  }, { timezone: 'America/Maceio' });

  // 18:00 — fim do expediente, captura alterações do dia
  cron.schedule('0 0 18 * * *', () => {
    console.log('⏰ [CRON] Disparando sincronização das 18:00');
    sincronizar();
  }, { timezone: 'America/Maceio' });

  console.log('✅ [CRON] Jobs agendados: 04:00, 12:00 e 18:00 (America/Maceio)');
};

module.exports = { iniciarJobs };