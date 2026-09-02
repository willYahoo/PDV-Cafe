const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');

const router = express.Router();
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function buildOrderItems(rawItems, session) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error('O pedido precisa ter pelo menos um item');
  const totals = new Map();
  for (const item of rawItems) {
    const quantity = Number(item.quantidade);
    if (!mongoose.isValidObjectId(item.produtoId) || !Number.isFinite(quantity) || quantity < 0.001) throw new Error('Item de pedido inválido');
    totals.set(String(item.produtoId), money((totals.get(String(item.produtoId)) || 0) + quantity));
  }
  const products = await Product.find({ _id: { $in: [...totals.keys()] } }).session(session);
  const byId = new Map(products.map((product) => [product.id, product]));
  const items = rawItems.map((item) => {
    const product = byId.get(String(item.produtoId));
    const quantity = Number(item.quantidade);
    if (!product) throw new Error('Produto não encontrado');
    if (!product.vendidoFracionado && !Number.isInteger(quantity)) throw new Error(`O produto "${product.nome}" é vendido somente por unidade`);
    return { produtoId: product.id, codigo: product.codigo, nome: product.nome, precoUnitario: product.preco, quantidade, unidadeVenda: product.unidadeVenda };
  });
  for (const [productId, quantity] of totals) {
    const updated = await Product.findOneAndUpdate({ _id: productId, estoque: { $gte: quantity } }, { $inc: { estoque: -quantity } }, { new: true, session });
    if (!updated) throw new Error(`Estoque insuficiente para "${byId.get(productId)?.nome || productId}"`);
  }
  return items;
}

router.post('/', auth, auth.allowRoles('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const items = await buildOrderItems(req.body.itens, session);
    const subtotal = money(items.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0));
    const discount = money(req.body.desconto || 0);
    if (discount < 0 || discount > subtotal) throw new Error('Desconto inválido');
    const order = new Order({ itens: items, subtotal, desconto: discount, total: money(subtotal - discount), clienteId: req.body.clienteId || undefined, clienteNome: req.body.clienteNome || 'Cliente não identificado', clienteTelefone: req.body.clienteTelefone || '', atendente: req.user.username, comandaId: req.body.comandaId || undefined });
    await order.save({ session });
    await session.commitTransaction();
    res.status(201).json(order);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.get('/', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    const { clienteId, status, inicio, fim } = req.query;
    const filter = {};
    if (clienteId) filter.clienteId = clienteId;
    if (status) filter.status = status;
    if (inicio && fim) filter.createdAt = { $gte: new Date(inicio), $lte: new Date(new Date(fim).setHours(23, 59, 59)) };
    res.json(await Order.find(filter).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.get('/:id', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ msg: 'Pedido não encontrado' });
    res.json(order);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.patch('/:id/pagar', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !['pendente', 'parcial'].includes(order.status)) return res.status(400).json({ msg: 'Este pedido não aceita novos pagamentos' });
    const paid = order.pagamentos.reduce((sum, payment) => sum + (payment.valorRecebido || 0), 0);
    const balance = money(order.total - paid);
    const value = money(req.body.valorRecebido);
    if (!['dinheiro', 'pix', 'credito_loja', 'cartao_credito', 'cartao_debito'].includes(req.body.tipo || 'dinheiro')) return res.status(400).json({ msg: 'Forma de pagamento inválida' });
    if (value !== balance || balance <= 0) return res.status(400).json({ msg: 'O recebimento deve quitar o saldo total do pedido' });
    order.pagamentos.push({ tipo: req.body.tipo || 'dinheiro', valorRecebido: balance, dataPagamento: new Date(), quitado: true, observacao: req.body.observacao });
    order.status = 'pago';
    await order.save();
    res.json(order);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.patch('/:id/quitar', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || !['pendente', 'parcial'].includes(order.status)) return res.status(400).json({ msg: 'Este pedido não aceita quitação' });
    const paid = order.pagamentos.reduce((sum, payment) => sum + (Number(payment.valorRecebido) || 0), 0);
    const balance = money(order.total - paid);
    if (balance <= 0) return res.status(400).json({ msg: 'Pedido já está quitado' });
    order.pagamentos.push({ tipo: 'dinheiro', valorRecebido: balance, dataPagamento: new Date(), quitado: true, observacao: 'Quitação total' });
    order.status = 'pago';
    await order.save();
    res.json(order);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.patch('/cliente/:clienteId/quitar', auth, auth.allowRoles('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const pedidos = await Order.find({ clienteId: req.params.clienteId, status: { $in: ['pendente', 'parcial'] } }).session(session);
    if (!pedidos.length) throw new Error('Este cliente não possui pendências');
    const tipo = req.body.tipo || 'dinheiro';
    const tiposAceitos = ['dinheiro', 'pix', 'credito_loja', 'cartao_credito', 'cartao_debito'];
    if (!tiposAceitos.includes(tipo)) throw new Error('Forma de pagamento inválida');
    pedidos.forEach((order) => {
      const pago = order.pagamentos.reduce((sum, payment) => sum + (Number(payment.valorRecebido) || 0), 0);
      const saldo = money(order.total - pago);
      if (saldo <= 0) return;
      order.pagamentos.push({ tipo, valorRecebido: saldo, dataPagamento: new Date(), quitado: true, observacao: req.body.observacao || 'Quitação total do cliente' });
      order.status = 'pago';
    });
    await Promise.all(pedidos.map((order) => order.save({ session })));
    await session.commitTransaction();
    res.json({ pedidos });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.patch('/:id/cancelar', auth, auth.allowRoles('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const order = await Order.findById(req.params.id).session(session);
    if (!order || !['pendente', 'parcial'].includes(order.status)) throw new Error('Somente pedidos pendentes ou parciais podem ser cancelados');
    for (const item of order.itens) await Product.findByIdAndUpdate(item.produtoId, { $inc: { estoque: item.quantidade } }, { session });
    order.status = 'cancelado';
    await order.save({ session });
    await session.commitTransaction();
    res.json(order);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

module.exports = router;
