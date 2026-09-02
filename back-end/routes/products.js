const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Product = require('../models/Product');

const router = express.Router();
const units = ['un'];
const validations = [body('codigo').trim().notEmpty(), body('nome').trim().notEmpty(), body('preco').isFloat({ min: 0 }), body('estoque').optional().isFloat({ min: 0 }), body('unidadeVenda').optional().isIn(units), body('vendidoFracionado').optional().isBoolean()];

router.get('/', auth, async (req, res) => {
  try {
    const { search, categoria } = req.query;
    const query = {};
    if (search) query.$or = [{ nome: { $regex: search, $options: 'i' } }, { codigo: { $regex: search, $options: 'i' } }];
    if (categoria) query.categoria = categoria;
    res.json(await Product.find(query).sort({ nome: 1 }));
  } catch (err) { res.status(500).json({ msg: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
    res.json(product);
  } catch (_) { res.status(404).json({ msg: 'Produto não encontrado' }); }
});

router.post('/', auth, validations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const data = req.body;
    const exists = await Product.findOne({ codigo: { $regex: new RegExp(`^${data.codigo.trim()}$`, 'i') } });
    if (exists) return res.status(400).json({ msg: 'Já existe um produto com este código' });
    const product = await Product.create({ codigo: data.codigo.trim(), nome: data.nome.trim(), categoria: data.categoria || 'Outros', preco: Number(data.preco), estoque: Number(data.estoque) || 0, unidadeVenda: 'un', vendidoFracionado: false, createdBy: req.user.id });
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ msg: err.code === 11000 ? 'Código duplicado' : err.message }); }
});

router.put('/:id', auth, [body('codigo').optional().trim().notEmpty(), body('nome').optional().trim().notEmpty(), body('preco').optional().isFloat({ min: 0 }), body('estoque').optional().isFloat({ min: 0 }), body('unidadeVenda').optional().isIn(units), body('vendidoFracionado').optional().isBoolean()], async (req, res) => {
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
    ['preco', 'estoque'].forEach((key) => { if (data[key] !== undefined) fields[key] = Number(data[key]); });
    fields.unidadeVenda = 'un';
    fields.vendidoFracionado = false;
    const product = await Product.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
    res.json(product);
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Produto não encontrado' });
    res.json({ msg: 'Produto removido com sucesso' });
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

module.exports = router;
