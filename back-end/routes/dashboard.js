const express = require('express');
const Order = require('../models/Order');
const Comanda = require('../models/Comanda');
const auth = require('../middleware/auth');

const router = express.Router();

const inicioDoPeriodo = (periodo) => {
  const agora = new Date();
  const inicio = new Date(agora);
  if (periodo === 'dia') inicio.setHours(0, 0, 0, 0);
  if (periodo === 'semana') {
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - inicio.getDay());
  }
  if (periodo === 'mes') {
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(1);
  }
  return inicio;
};

router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Acesso restrito ao administrador' });
  next();
});

router.get('/', async (req, res) => {
  try {
    const periodos = ['dia', 'semana', 'mes'];
    const [periodMetrics, openCommands, pedidosHoje] = await Promise.all([
      Promise.all(periodos.map(async (periodo) => {
        const pedidos = await Order.find({ createdAt: { $gte: inicioDoPeriodo(periodo) }, status: { $ne: 'cancelado' } }).select('total itens createdAt');
        const total = pedidos.reduce((sum, pedido) => sum + Number(pedido.total || 0), 0);
        const itens = pedidos.reduce((sum, pedido) => sum + (pedido.itens || []).reduce((itemSum, item) => itemSum + Number(item.quantidade || 0), 0), 0);
        const produtos = new Map();
        pedidos.forEach((pedido) => (pedido.itens || []).forEach((item) => produtos.set(item.nome, (produtos.get(item.nome) || 0) + Number(item.quantidade || 0))));
        const maisVendidos = [...produtos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, quantidade]) => ({ nome, quantidade }));
        return { periodo, total, pedidos: pedidos.length, itens, ticketMedio: pedidos.length ? total / pedidos.length : 0, maisVendidos };
      })),
      Comanda.countDocuments({ status: 'aberta' }),
      Order.find({ createdAt: { $gte: inicioDoPeriodo('dia') } }).sort({ createdAt: -1 }).limit(30).select('numero total status clienteNome createdAt itens'),
    ]);
    res.json({ periodos: Object.fromEntries(periodMetrics.map((metric) => [metric.periodo, metric])), comandasAbertas: openCommands, pedidosHoje, atualizadoEm: new Date() });
  } catch (error) { res.status(500).json({ msg: error.message }); }
});

module.exports = router;