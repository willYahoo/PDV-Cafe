const express = require('express');
const Order = require('../models/Order');
const Comanda = require('../models/Comanda');
const Customer = require('../models/Customer');
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

const fimDoMesAtual = () => {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
};

router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Acesso restrito ao administrador' });
  next();
});

router.get('/', async (req, res) => {
  try {
    const periodos = ['dia', 'semana', 'mes'];
    const [periodMetrics, openCommands, pedidosDia, pedidosMes, recebimentosDia, recebimentosMes, clientesCadastrados, clientesRecentes] = await Promise.all([
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
      Order.find({ createdAt: { $gte: inicioDoPeriodo('dia') } }).sort({ createdAt: -1 }).select('numero total status clienteNome createdAt itens pagamentos'),
      Order.find({ createdAt: { $gte: inicioDoPeriodo('mes'), $lt: fimDoMesAtual() } }).select('numero total subtotal desconto status clienteId clienteNome createdAt itens pagamentos'),
      Order.find({ 'pagamentos.dataPagamento': { $gte: inicioDoPeriodo('dia') } }).select('pagamentos'),
      Order.find({ 'pagamentos.dataPagamento': { $gte: inicioDoPeriodo('mes'), $lt: fimDoMesAtual() } }).select('pagamentos'),
      Customer.countDocuments(),
      Customer.find().sort({ createdAt: -1 }).limit(8).select('nome telefone createdAt cafesFidelidade'),
    ]);
    const vendasHoje = pedidosDia.filter((pedido) => pedido.status !== 'cancelado');
    const vendasHojeTotal = vendasHoje.reduce((total, pedido) => total + Number(pedido.total || 0), 0);
    const vendasHojeItens = vendasHoje.reduce((total, pedido) => total + (pedido.itens || []).reduce((itens, item) => itens + Number(item.quantidade || 0), 0), 0);
    const vendasHojeRecebido = recebimentosDia.reduce((total, pedido) => total + (pedido.pagamentos || []).filter((pagamento) => new Date(pagamento.dataPagamento) >= inicioDoPeriodo('dia')).reduce((soma, pagamento) => soma + Number(pagamento.valorRecebido || 0), 0), 0);
    const vendasHojePendente = Math.max(0, vendasHojeTotal - vendasHojeRecebido);
    const vendasMes = pedidosMes.filter((pedido) => pedido.status !== 'cancelado');
    const pagamentosMes = new Map();
    const produtosMes = new Map();
    const clientesMes = new Set();
    const vendasPorDia = new Map();
    vendasMes.forEach((pedido) => {
      if (pedido.clienteNome) clientesMes.add(pedido.clienteNome);
      const dia = new Date(pedido.createdAt).toLocaleDateString('pt-BR');
      vendasPorDia.set(dia, (vendasPorDia.get(dia) || 0) + Number(pedido.total || 0));
      (pedido.itens || []).forEach((item) => {
        const atual = produtosMes.get(item.nome) || { nome: item.nome, quantidade: 0, total: 0 };
        atual.quantidade += Number(item.quantidade || 0);
        atual.total += Number(item.quantidade || 0) * Number(item.precoUnitario || 0);
        produtosMes.set(item.nome, atual);
      });
    });
    recebimentosMes.forEach((pedido) => (pedido.pagamentos || []).filter((pagamento) => new Date(pagamento.dataPagamento) >= inicioDoPeriodo('mes') && new Date(pagamento.dataPagamento) < fimDoMesAtual()).forEach((pagamento) => pagamentosMes.set(pagamento.tipo, (pagamentosMes.get(pagamento.tipo) || 0) + Number(pagamento.valorRecebido || 0))));
    const totalMes = vendasMes.reduce((total, pedido) => total + Number(pedido.total || 0), 0);
    const recebidoMes = vendasMes.reduce((total, pedido) => total + (pedido.pagamentos || []).reduce((soma, pagamento) => soma + Number(pagamento.valorRecebido || 0), 0), 0);
    const statusMes = pedidosMes.reduce((status, pedido) => { status[pedido.status] = (status[pedido.status] || 0) + 1; return status; }, {});
    const clientesRelatorio = new Map(clientesRecentes.map((cliente) => [String(cliente._id), {
      id: cliente._id,
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      pedidos: 0,
      total: 0,
      recebido: 0,
      ultimaCompra: null,
    }]));
    const todosClientes = await Customer.find().sort({ nome: 1 }).select('nome telefone createdAt cafesFidelidade');
    todosClientes.forEach((cliente) => {
      if (!clientesRelatorio.has(String(cliente._id))) clientesRelatorio.set(String(cliente._id), { id: cliente._id, nome: cliente.nome, telefone: cliente.telefone || '', pedidos: 0, total: 0, recebido: 0, ultimaCompra: null });
    });
    vendasMes.forEach((pedido) => {
      const chave = pedido.clienteId ? String(pedido.clienteId) : `nome:${pedido.clienteNome || ''}`;
      if (!clientesRelatorio.has(chave)) clientesRelatorio.set(chave, { id: pedido.clienteId || chave, nome: pedido.clienteNome || 'Cliente não identificado', telefone: '', pedidos: 0, total: 0, recebido: 0, ultimaCompra: null });
      const cliente = clientesRelatorio.get(chave);
      cliente.pedidos += 1;
      cliente.total += Number(pedido.total || 0);
      cliente.recebido += (pedido.pagamentos || []).reduce((total, pagamento) => total + Number(pagamento.valorRecebido || 0), 0);
      if (!cliente.ultimaCompra || new Date(pedido.createdAt) > new Date(cliente.ultimaCompra)) cliente.ultimaCompra = pedido.createdAt;
    });
    const relatorioClientes = [...clientesRelatorio.values()].map((cliente) => ({ ...cliente, pendente: Math.max(0, cliente.total - cliente.recebido) })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
    const relatorioMes = {
      periodo: `${inicioDoPeriodo('mes').toLocaleDateString('pt-BR')} a ${new Date(fimDoMesAtual().getTime() - 1).toLocaleDateString('pt-BR')}`,
      pedidos: pedidosMes.length,
      vendas: vendasMes.length,
      itens: vendasMes.reduce((total, pedido) => total + (pedido.itens || []).reduce((soma, item) => soma + Number(item.quantidade || 0), 0), 0),
      total: totalMes,
      recebido: recebidoMes,
      pendente: Math.max(0, totalMes - recebidoMes),
      ticketMedio: vendasMes.length ? totalMes / vendasMes.length : 0,
      status: statusMes,
      pagamentos: [...pagamentosMes.entries()].map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
      produtos: [...produtosMes.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, 10),
      clientes: clientesMes.size,
      vendasPorDia: [...vendasPorDia.entries()].map(([dia, total]) => ({ dia, total })),
    };
    res.json({ periodos: Object.fromEntries(periodMetrics.map((metric) => [metric.periodo, metric])), comandasAbertas: openCommands, pedidosHoje: pedidosDia.slice(0, 30), clientesCadastrados, clientesRecentes, vendasHoje: { pedidos: vendasHoje.length, itens: vendasHojeItens, total: vendasHojeTotal, recebido: vendasHojeRecebido, pendente: vendasHojePendente }, relatorioMes, relatorioClientes: { periodo: relatorioMes.periodo, totalCadastrados: todosClientes.length, clientesComCompra: relatorioClientes.filter((cliente) => cliente.pedidos > 0).length, totalVendido: relatorioClientes.reduce((total, cliente) => total + cliente.total, 0), totalRecebido: relatorioClientes.reduce((total, cliente) => total + cliente.recebido, 0), totalPendente: relatorioClientes.reduce((total, cliente) => total + cliente.pendente, 0), clientes: relatorioClientes }, atualizadoEm: new Date() });
  } catch (error) { res.status(500).json({ msg: error.message }); }
});

module.exports = router;