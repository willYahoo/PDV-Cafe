module.exports = function (req, res, next) {
  const role = req.headers['x-pdv-role'] === 'admin' ? 'admin' : 'operador';
  req.user = { username: role === 'admin' ? 'admin' : 'operador', role };
  next();
};