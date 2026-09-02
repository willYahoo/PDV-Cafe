const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'desenvolvimento-altere-esta-chave';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) return res.status(401).json({ msg: 'Acesso não autorizado' });

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (_) {
    res.status(401).json({ msg: 'Sessão inválida ou expirada' });
  }
};

auth.allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) return res.status(403).json({ msg: 'Você não tem permissão para esta ação' });
  next();
};

module.exports = auth;
