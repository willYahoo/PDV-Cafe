const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');

const router = express.Router();
const units = ['un', 'kg', 'g', 'l', 'ml'];
const dataLocal = () => { const agora = new Date(); return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`; };
const antesDasOito = () => new Date().getHours() < 8;
const validations = [body('codigo').trim().notEmpty(), body('nome').trim().notEmpty(), body('preco').isFloat({ min: 0 }), body('custo').optional().isFloat({ min: 0 }), body('estoque').optional().isFloat({ min: 0 }), body('estoqueInsumos').optional().isFloat({ min: 0 }), body('estoqueMaximo').optional().isFloat({ min: 0.001 }), body('estoqueMinimoInsumos').optional().isFloat({ min: 0 }), body('unidadeVenda').optional().isIn(units), body('vendidoFracionado').optional().isBoolean(), body('aFazer').optional().isBoolean(), body('producaoPropria').optional().isBoolean(), body('controladoComoInsumo').optional().isBoolean()];

router.get('/', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const { search, categoria } = req.query;
    const query = {};
    if (search) query.$or = [{ nome: { $regex: search, $options: 'i' } }, { codigo: { $regex: search, $options: 'i' } }];
    if (categoria) query.categoria = categoria;
    res.json(await Product.find(query).sort({ nome: 1 }));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.get('/mais-vendidos', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const limite = Math.min(Math.max(Number(req.query.limite) || 8, 1), 20);
    const ranking = await Order.aggregate([
      { $match: { status: { $ne: 'cancelado' } } },
      { $unwind: '$itens' },
      { $group: { _id: '$itens.produtoId', quantidade: { $sum: '$itens.quantidade' } } },
      { $sort: { quantidade: -1 } },
      { $limit: limite },
    ]);
    res.json(ranking.map((item) => ({ produtoId: item._id, quantidade: item.quantidade })));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.get('/:id', auth, auth.allowRoles('admin', 'operador'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
    res.json(product);
  } catch (_) { res.status(404).json({ msg: 'Produto não encontrado' }); }
});

router.post('/', auth, auth.allowRoles('admin'), validations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const data = req.body;
    const exists = await Product.findOne({ codigo: { $regex: new RegExp(`^${data.codigo.trim()}$`, 'i') } });
    if (exists) return res.status(400).json({ msg: 'Já existe um produto com este código' });
    const estoque = Number(data.estoque) || 0;
    const estoqueInsumos = Number(data.estoqueInsumos) || 0;
    const product = await Product.create({ codigo: data.codigo.trim(), nome: data.nome.trim(), categoria: data.categoria || 'Outros', preco: Number(data.preco), custo: Number(data.custo) || 0, estoque, estoqueInsumos, estoqueInicialDia: estoque, estoqueInicialData: dataLocal(), estoqueInsumosInicial: estoqueInsumos, estoqueInsumosInicialData: dataLocal(), estoqueMinimoInsumos: Number(data.estoqueMinimoInsumos) || 0, unidadeVenda: data.unidadeVenda || 'un', vendidoFracionado: Boolean(data.vendidoFracionado), aFazer: Boolean(data.aFazer), producaoPropria: Boolean(data.producaoPropria), controladoComoInsumo: Boolean(data.controladoComoInsumo), createdBy: req.user.id });
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ msg: err.code === 11000 ? 'Código duplicado' : err.message }); }
});

router.put('/:id', auth, auth.allowRoles('admin'), [body('codigo').optional().trim().notEmpty(), body('nome').optional().trim().notEmpty(), body('preco').optional().isFloat({ min: 0 }), body('estoque').optional().isFloat({ min: 0 }), body('estoqueMaximo').optional().isFloat({ min: 0.001 }), body('unidadeVenda').optional().isIn(units), body('vendidoFracionado').optional().isBoolean()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const data = req.body;
    if (data.codigo) {
      const duplicate = await Product.findOne({ codigo: { $regex: new RegExp(`^${data.codigo.trim()}$`, 'i') }, _id: { $ne: req.params.id } });
      if (duplicate) return res.status(400).json({ msg: 'Já existe um produto com este código' });
    }
    const fields = {};
    ['codigo', 'nome', 'categoria', 'unidadeVenda'].forEach((key) => { if (data[key] !== undefined) fields[key] = String(data[key]).trim(); });
    ['preco', 'custo', 'estoque', 'estoqueInsumos', 'estoqueMaximo', 'estoqueMinimoInsumos'].forEach((key) => { if (data[key] !== undefined) fields[key] = Number(data[key]); });
    ['vendidoFracionado', 'aFazer', 'producaoPropria', 'controladoComoInsumo'].forEach((key) => { if (data[key] !== undefined) fields[key] = Boolean(data[key]); });
    if (data.estoque !== undefined && antesDasOito()) {
      fields.estoqueInicialDia = Number(data.estoque);
      fields.estoqueInicialData = dataLocal();
    }
    if (data.estoqueInsumos !== undefined && antesDasOito()) {
      fields.estoqueInsumosInicial = Number(data.estoqueInsumos);
      fields.estoqueInsumosInicialData = dataLocal();
    }
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
    res.json(product);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.delete('/:id', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
    res.json({ msg: 'Produto removido com sucesso' });
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

module.exports = router;
