const cron = require('node-cron');
const { sincronizar } = require('./sync.worker');

/* =========================
   AGENDAMENTO
   Formato cron: 'segundo minuto hora dia mês diaDaSemana'
   - '0 0 7 * * *'  → todo dia às 07:00
   - '0 0 13 * * *' → todo dia às 13:00
   - '0 0 18 * * *' → todo dia às 18:00
========================= */
const iniciarJobs = () => {
  // 07:00
  cron.schedule('0 0 7 * * *', () => {
    console.log('⏰ [CRON] Disparando sincronização das 07:00');
    sincronizar();
  }, { timezone: 'America/Maceio' });

  // 13:00
  cron.schedule('0 0 13 * * *', () => {
    console.log('⏰ [CRON] Disparando sincronização das 13:00');
    sincronizar();
  }, { timezone: 'America/Maceio' });

  // 18:00
  cron.schedule('0 0 18 * * *', () => {
    console.log('⏰ [CRON] Disparando sincronização das 18:00');
    sincronizar();
  }, { timezone: 'America/Maceio' });

  console.log('✅ [CRON] Jobs agendados: 07:00, 13:00 e 18:00 (America/Maceio)');
};

module.exports = { iniciarJobs };
