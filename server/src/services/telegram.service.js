const axios = require('axios');

const enviarMensagemTelegram = async ({ texto, chatId, parseMode }) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const destinoChatId = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !destinoChatId) {
    throw new Error('TELEGRAM_CONFIG_INCOMPLETA');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: destinoChatId,
    text: texto,
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  await axios.post(url, payload);
};

module.exports = { enviarMensagemTelegram };
