const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/tokenController');

const router = express.Router();
router.use(authenticate, authorize('admin'));
router.get('/wallet', controller.getWallet);
router.get('/ledger', controller.listLedger);
router.get('/packages', controller.listPackages);
router.post('/checkout', controller.createReloadCheckout);
router.get('/department-upgrade', controller.getDepartmentUpgrade);
router.post('/department-upgrade', controller.createDepartmentUpgrade);

module.exports = router;
