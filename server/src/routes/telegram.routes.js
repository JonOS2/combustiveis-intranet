const express = require('express');
const { handleTelegramWebhook } = require('../controllers/telegram.controller');

const router = express.Router();

router.post('/webhook', handleTelegramWebhook);

module.exports = router;
