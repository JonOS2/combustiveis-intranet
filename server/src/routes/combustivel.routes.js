const { Router } = require('express');
const { getCombustiveis, exportarExcel } = require('../controllers/combustivel.controller');

const router = Router();

router.post('/', getCombustiveis);
router.post('/excel', exportarExcel);

module.exports = router;