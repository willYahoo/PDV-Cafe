const express = require('express');
const mongoose = require('mongoose');
const Comanda = require('../models/Comanda');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');

const router = express.Router();
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

router.get('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    res.json(await Comanda.find(filter).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.post('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const itens = [];
    for (const item of Array.isArray(req.body.itens) ? req.body.itens : []) {
      const quantidade = Number(item.quantidade);
      const product = await Product.findById(item.produtoId);
      if (!product || !Number.isFinite(quantidade) || quantidade < 0.001) throw new Error('Item inválido');
      if (!product.vendidoFracionado && !Number.isInteger(quantidade)) throw new Error(`O produto "${product.nome}" é vendido somente por unidade`);
      const modificadores = Array.isArray(item.modificadores)
        ? item.modificadores.filter((value) => typeof value === 'string').slice(0, 10)
        : [];
      itens.push({ produtoId: product.id, codigo: product.codigo, nome: product.nome, precoUnitario: product.preco, quantidade, unidadeVenda: product.unidadeVenda, modificadores });
    }
    const comanda = await Comanda.create({ clienteId: req.body.clienteId || undefined, clienteNome: req.body.clienteNome || 'Cliente não identificado', observacao: req.body.observacao, itens, atendente: req.user.username });
    res.status(201).json(comanda);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.post('/:id/itens', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const comanda = await Comanda.findById(req.params.id);
    const quantity = Number(req.body.quantidade);
    const product = await Product.findById(req.body.produtoId);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    if (!product || !Number.isFinite(quantity) || quantity < 0.001) return res.status(400).json({ msg: 'Item inválido' });
    if (!Number.isInteger(quantity)) return res.status(400).json({ msg: 'Este produto é vendido por unidade' });
    const modificadores = Array.isArray(req.body.modificadores)
      ? req.body.modificadores.filter((item) => typeof item === 'string').slice(0, 10)
      : [];
    comanda.itens.push({ produtoId: product.id, codigo: product.codigo, nome: product.nome, precoUnitario: product.preco, quantidade, unidadeVenda: product.unidadeVenda, modificadores });
    await comanda.save();
    res.json(comanda);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.patch('/:id/itens/:itemId', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const comanda = await Comanda.findById(req.params.id);
    const quantity = Number(req.body.quantidade);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    const item = comanda.itens.id(req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Item não encontrado' });
    if (!Number.isFinite(quantity) || quantity < 0.001) return res.status(400).json({ msg: 'Quantidade inválida' });
    item.quantidade = quantity;
    await comanda.save();
    res.json(comanda);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.delete('/:id/itens/:itemId', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const comanda = await Comanda.findById(req.params.id);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    comanda.itens.pull(req.params.itemId);
    await comanda.save();
    res.json(comanda);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.patch('/:id/cancelar', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const comanda = await Comanda.findById(req.params.id);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    comanda.status = 'cancelada';
    await comanda.save();
    res.json(comanda);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.post('/:id/fechar', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comanda = await Comanda.findById(req.params.id).session(session);
    if (!comanda || comanda.status !== 'aberta' || !comanda.itens.length) throw new Error('Comanda sem itens ou já fechada');
    const metodoPagamento = req.body.metodoPagamento;
    if (!['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'credito_loja'].includes(metodoPagamento)) throw new Error('Selecione uma forma de pagamento');
    const totals = new Map();
    comanda.itens.forEach((item) => totals.set(String(item.produtoId), (totals.get(String(item.produtoId)) || 0) + item.quantidade));
    for (const [productId, quantity] of totals) {
      const product = await Product.findOneAndUpdate({ _id: productId, estoque: { $gte: quantity } }, { $inc: { estoque: -quantity } }, { new: true, session });
      if (!product) throw new Error('Estoque insuficiente para fechar a comanda');
    }
    const subtotal = money(comanda.itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0));
    const discount = money(req.body.desconto || 0);
    if (discount < 0 || discount > subtotal) throw new Error('Desconto inválido');
    const total = money(subtotal - discount);
    const order = new Order({ itens: comanda.itens, subtotal, desconto: discount, total, clienteNome: comanda.clienteNome, atendente: req.user.username, comandaId: comanda.id, status: 'pago', pagamentos: [{ tipo: metodoPagamento, valorRecebido: total, dataPagamento: new Date(), quitado: true }] });
    await order.save({ session });
    if (comanda.clienteId) await Customer.findByIdAndUpdate(comanda.clienteId, { $inc: { cafesFidelidade: 1 } }, { session });
    comanda.status = 'fechada'; comanda.pedidoId = order.id;
    await comanda.save({ session });
    await session.commitTransaction();
    res.json({ comanda, pedido: order });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

module.exports = router;
