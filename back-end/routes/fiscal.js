const express = require('express');
const auth = require('../middleware/auth');
const Order = require('../models/Order');

const router = express.Router();

router.get('/config', auth, auth.allowRoles('admin'), (req, res) => res.json({
  habilitado: Boolean(process.env.FISCAL_PROVIDER),
  provider: process.env.FISCAL_PROVIDER || null,
  ambiente: process.env.FISCAL_AMBIENTE || 'homologacao',
  aviso: 'Configure um provedor fiscal e as credenciais no servidor para habilitar a emissão.',
}));

router.post('/orders/:id/emitir', auth, auth.allowRoles('admin'), async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ msg: 'Pedido não encontrado' });
  if (!process.env.FISCAL_PROVIDER) return res.status(409).json({ msg: 'Integração fiscal não configurada. Nenhum documento foi emitido.' });
  return res.status(501).json({ msg: `Adaptador para ${process.env.FISCAL_PROVIDER} ainda não foi instalado.` });
});

module.exports = router;
