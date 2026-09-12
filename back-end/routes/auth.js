const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();
const jwtSecret = process.env.JWT_SECRET || 'desenvolvimento-altere-esta-chave';

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

// @route   POST api/auth/login
// @desc    Login e retornar token
// @access  Público
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = typeof username === 'string' ? username.toLowerCase().trim() : '';
  const user = await User.findOne({ username: normalizedUsername }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ msg: 'Usuário ou senha inválidos' });
  }
  const publicUser = { id: user.id, username: user.username, role: user.role };
  const token = jwt.sign(publicUser, jwtSecret, { expiresIn: '24h' });
  res.json({ user: publicUser, token });
});

// @route   GET api/auth/me
// @desc    Informar o operador da sessão pública
// @access  Público durante a fase sem login
router.get('/me', auth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

router.post('/register', auth, auth.allowRoles('admin'), async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.toLowerCase().trim() : '';
    const password = req.body.password;
    const role = req.body.role === 'admin' ? 'admin' : 'operador';
    if (username.length < 2 || typeof password !== 'string' || password.length < 4) return res.status(400).json({ msg: 'Informe usuário e senha com pelo menos 4 caracteres' });
    if (await User.exists({ username })) return res.status(409).json({ msg: 'Este usuário já existe' });
    const user = await User.create({ username, password, role });
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (err) { res.status(400).json({ msg: err.message }); }
});

router.post('/logout', (req, res) => {
  const clearCookieOptions = { ...cookieOptions };
  delete clearCookieOptions.maxAge;
  res.clearCookie('pdv_token', clearCookieOptions);
  res.status(204).end();
});

module.exports = router;
