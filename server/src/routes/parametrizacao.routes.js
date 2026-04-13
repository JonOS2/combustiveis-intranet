const { Router } = require('express');
const { getSerie } = require('../controllers/parametrizacao.controller');

const router = Router();

router.get('/serie/:codigo', getSerie);

module.exports = router;