const { enviarMensagemTelegram } = require('../services/telegram.service');
const { montarMensagemTopPostos } = require('../jobs/telegram.job');

const responderValor = async (chatId) => {
  try {
    const { texto, parseMode } = await montarMensagemTopPostos();
    await enviarMensagemTelegram({ texto, chatId, parseMode });
  } catch (error) {
    console.error('Erro ao responder /valor no Telegram:', error);
  }
};

const handleTelegramWebhook = (req, res) => {
  const message = req.body?.message || req.body?.edited_message;
  const texto = message?.text?.trim();

  if (!texto || !texto.toLowerCase().startsWith('/valor')) {
    return res.json({ ok: true });
  }

  const chatId = message?.chat?.id;
  res.json({ ok: true });
  void responderValor(chatId);
};

module.exports = { handleTelegramWebhook };
