const { Router } = require('express');
const { getCombustiveis, exportarExcel, syncManual } = require('../controllers/combustivel.controller');

const router = Router();

router.post('/', getCombustiveis);
router.post('/excel', exportarExcel);
router.post('/sync', syncManual);

module.exports = router;
