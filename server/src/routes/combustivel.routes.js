const { Router } = require('express');
const { getCombustiveis, exportarExcel, syncManual, getStatus } = require('../controllers/combustivel.controller');

const router = Router();

router.post('/', getCombustiveis);
router.post('/excel', exportarExcel);
router.post('/sync', syncManual);
router.get('/status', getStatus);

module.exports = router;