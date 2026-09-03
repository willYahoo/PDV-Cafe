const express = require('express');
const mongoose = require('mongoose');
const Comanda = require('../models/Comanda');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const auth = require('../middleware/auth');

const router = express.Router();
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

async function ajustarEstoque(itens, operacao, session) {
  const totais = new Map();
  itens.forEach((item) => totais.set(String(item.produtoId), (totais.get(String(item.produtoId)) || 0) + Number(item.quantidade || 0)));
  for (const [produtoId, quantidade] of totais) {
    if (operacao === 'baixar') {
      const product = await Product.findOneAndUpdate({ _id: produtoId, estoque: { $gte: quantidade } }, { $inc: { estoque: -quantidade } }, { new: true, session });
      if (!product) throw new Error(`Estoque insuficiente para o produto ${produtoId}`);
    } else {
      await Product.findByIdAndUpdate(produtoId, { $inc: { estoque: quantidade } }, { session });
    }
  }
}

router.get('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    res.json(await Comanda.find(filter).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.post('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const itens = [];
    for (const item of Array.isArray(req.body.itens) ? req.body.itens : []) {
      const quantidade = Number(item.quantidade);
      const product = await Product.findById(item.produtoId).session(session);
      if (!product || !Number.isFinite(quantidade) || quantidade < 0.001) throw new Error('Item inválido');
      if (!product.vendidoFracionado && !Number.isInteger(quantidade)) throw new Error(`O produto "${product.nome}" é vendido somente por unidade`);
      const modificadores = Array.isArray(item.modificadores)
        ? item.modificadores.filter((value) => typeof value === 'string').slice(0, 10)
        : [];
      itens.push({ produtoId: product.id, codigo: product.codigo, nome: product.nome, precoUnitario: product.preco, quantidade, unidadeVenda: product.unidadeVenda, modificadores });
    }
    await ajustarEstoque(itens, 'baixar', session);
    const [comanda] = await Comanda.create([{ clienteId: req.body.clienteId || undefined, clienteNome: req.body.clienteNome || 'Cliente não identificado', observacao: req.body.observacao, itens, estoqueBaixado: itens.length > 0, atendente: req.user.username }], { session });
    await session.commitTransaction();
    res.status(201).json(comanda);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.post('/:id/itens', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comanda = await Comanda.findById(req.params.id).session(session);
    const quantidade = Number(req.body.quantidade);
    const product = await Product.findById(req.body.produtoId).session(session);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    if (!product || !Number.isFinite(quantidade) || quantidade < 0.001) return res.status(400).json({ msg: 'Item inválido' });
    if (!product.vendidoFracionado && !Number.isInteger(quantidade)) return res.status(400).json({ msg: 'Este produto é vendido por unidade' });
    const modificadores = Array.isArray(req.body.modificadores)
      ? req.body.modificadores.filter((item) => typeof item === 'string').slice(0, 10)
      : [];
    await ajustarEstoque([{ produtoId: product.id, quantidade }], 'baixar', session);
    comanda.itens.push({ produtoId: product.id, codigo: product.codigo, nome: product.nome, precoUnitario: product.preco, quantidade, unidadeVenda: product.unidadeVenda, modificadores });
    comanda.estoqueBaixado = true;
    await comanda.save({ session });
    await session.commitTransaction();
    res.json(comanda);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.patch('/:id/itens/:itemId', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comanda = await Comanda.findById(req.params.id).session(session);
    const quantidade = Number(req.body.quantidade);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    const item = comanda.itens.id(req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Item não encontrado' });
    if (!Number.isFinite(quantidade) || quantidade < 0.001) return res.status(400).json({ msg: 'Quantidade inválida' });
    const product = await Product.findById(item.produtoId).session(session);
    if (product && !product.vendidoFracionado && !Number.isInteger(quantidade)) return res.status(400).json({ msg: 'Este produto é vendido por unidade' });
    const diferenca = quantidade - Number(item.quantidade || 0);
    if (diferenca > 0) await ajustarEstoque([{ produtoId: item.produtoId, quantidade: diferenca }], 'baixar', session);
    if (diferenca < 0) await ajustarEstoque([{ produtoId: item.produtoId, quantidade: Math.abs(diferenca) }], 'devolver', session);
    item.quantidade = quantidade;
    await comanda.save({ session });
    await session.commitTransaction();
    res.json(comanda);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.delete('/:id/itens/:itemId', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comanda = await Comanda.findById(req.params.id).session(session);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    const item = comanda.itens.id(req.params.itemId);
    if (!item) return res.status(404).json({ msg: 'Item não encontrado' });
    if (comanda.estoqueBaixado) await ajustarEstoque([{ produtoId: item.produtoId, quantidade: item.quantidade }], 'devolver', session);
    comanda.itens.pull(req.params.itemId);
    await comanda.save({ session });
    await session.commitTransaction();
    res.json(comanda);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.patch('/:id/cancelar', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comanda = await Comanda.findById(req.params.id).session(session);
    if (!comanda || comanda.status !== 'aberta') return res.status(400).json({ msg: 'Comanda não está aberta' });
    if (comanda.estoqueBaixado) await ajustarEstoque(comanda.itens, 'devolver', session);
    comanda.status = 'cancelada';
    await comanda.save({ session });
    await session.commitTransaction();
    res.json(comanda);
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    res.status(400).json({ msg: err.message });
  } finally { await session.endSession(); }
});

router.post('/:id/fechar', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const comanda = await Comanda.findById(req.params.id).session(session);
    if (!comanda || comanda.status !== 'aberta' || !comanda.itens.length) throw new Error('Comanda sem itens ou já fechada');
    const metodoPagamento = req.body.metodoPagamento;
    if (!['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'credito_loja'].includes(metodoPagamento)) throw new Error('Selecione uma forma de pagamento');
    if (!comanda.estoqueBaixado) await ajustarEstoque(comanda.itens, 'baixar', session);
    const subtotal = money(comanda.itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0));
    const discount = money(req.body.desconto || 0);
    if (discount < 0 || discount > subtotal) throw new Error('Desconto inválido');
    const total = money(subtotal - discount);
    const creditoLoja = metodoPagamento === 'credito_loja';
    const customer = comanda.clienteId ? await Customer.findById(comanda.clienteId).session(session) : null;
    const order = new Order({
      itens: comanda.itens,
      subtotal,
      desconto: discount,
      total,
      clienteId: comanda.clienteId,
      clienteNome: comanda.clienteNome,
      clienteTelefone: customer?.telefone || '',
      atendente: req.user.username,
      comandaId: comanda.id,
      status: creditoLoja ? 'pendente' : 'pago',
      pagamentos: creditoLoja ? [] : [{ tipo: metodoPagamento, valorRecebido: total, dataPagamento: new Date(), quitado: true }],
    });
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
