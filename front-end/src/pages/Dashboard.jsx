import { useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import { AuthContext } from '../context/AuthContextDefinition.jsx';

const money = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const labels = { dia: 'Hoje', semana: 'Esta semana', mes: 'Este mês' };

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (user?.role !== 'admin') return;
    Promise.all([api.get('/dashboard'), api.get('/products')])
      .then(([dashboardResponse, productsResponse]) => {
        setData(dashboardResponse.data);
        setProdutos(productsResponse.data);
      })
      .catch((error) => showToast(error.response?.data?.msg || 'Não foi possível carregar o dashboard', 'error'));
  }, [user?.role]);

  if (user?.role !== 'admin') return <Navigate to="/pdv" replace />;

  if (!data) return <div className="dashboard-page"><div className="dashboard-loading">☕ Carregando acompanhamento...</div></div>;
  const pedidosHoje = data.pedidosHoje || [];
  const estoque = [...produtos].sort((a, b) => Number(a.estoque || 0) - Number(b.estoque || 0));
  const estoquePorCategoria = estoque.reduce((grupos, produto) => {
    const categoria = produto.categoria || 'Outros';
    grupos[categoria] = [...(grupos[categoria] || []), produto];
    return grupos;
  }, {});
  const percentualEstoque = (produto) => Math.min(100, Math.round((Number(produto.estoque || 0) / Math.max(0.001, Number(produto.estoqueMaximo || 100))) * 100));
  const classeEstoque = (percentual) => percentual > 60 ? 'stock-good' : percentual >= 25 ? 'stock-warning' : 'stock-danger';

  return <div className="dashboard-page">
    <div className="dashboard-heading"><div><span className="dashboard-eyebrow">GESTÃO DA CASA</span><h1>Dashboard</h1><p>Acompanhe o ritmo do Sabor de Abraço.</p></div><div className="dashboard-open">{data.comandasAbertas} comandas abertas</div></div>
    <div className="dashboard-periods">{['dia', 'semana', 'mes'].map((periodo) => { const metric = data.periodos[periodo]; return <section className="dashboard-period" key={periodo}><div className="dashboard-period-title"><h2>{labels[periodo]}</h2><span>{metric.pedidos} pedidos</span></div><strong className="dashboard-total">{money(metric.total)}</strong><div className="dashboard-stats"><span><b>{metric.itens}</b> itens</span><span><b>{money(metric.ticketMedio)}</b> ticket médio</span></div><div className="dashboard-products"><h3>Mais pedidos</h3>{metric.maisVendidos.length ? metric.maisVendidos.map((product) => <div className="dashboard-product" key={product.nome}><span>{product.nome}</span><b>{product.quantidade}</b></div>) : <p>Nenhum pedido no período.</p>}</div></section>; })}</div>
    <section className="dashboard-stock"><div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">CONTROLE DE ESTOQUE</span><h2>Posição de estoque</h2><p>Acompanhamento por categoria e percentual disponível.</p></div><span className="dashboard-orders-count">{produtos.length}</span></div><div className="dashboard-stock-legend"><span><i className="stock-good" /> Acima de 60%</span><span><i className="stock-warning" /> De 25% a 60%</span><span><i className="stock-danger" /> Abaixo de 25%</span></div>{estoque.length ? <div className="dashboard-stock-categories">{Object.entries(estoquePorCategoria).map(([categoria, itens]) => <div className="dashboard-stock-category" key={categoria}><h3>{categoria}<small>{itens.length} produto(s)</small></h3><div className="dashboard-stock-list">{itens.map((produto) => { const percentual = percentualEstoque(produto); return <div className="dashboard-stock-item" key={produto._id}><div><strong>{produto.nome}</strong><small>Código {produto.codigo} · {produto.estoque} de {produto.estoqueMaximo || 100} un.</small><div className="dashboard-stock-bar"><span className={classeEstoque(percentual)} style={{ width: `${percentual}%` }} /></div></div><b className={classeEstoque(percentual)}>{percentual}%</b></div>; })}</div></div>)}</div> : <p className="dashboard-empty-orders">Nenhum produto cadastrado.</p>}</section>
    <section className="dashboard-orders"><div className="dashboard-section-heading"><div><span className="dashboard-eyebrow">ACOMPANHAMENTO DO DIA</span><h2>Pedidos de hoje</h2><p>Veja o movimento mais recente da casa.</p></div><span className="dashboard-orders-count">{pedidosHoje.length}</span></div>{pedidosHoje.length ? <div className="dashboard-orders-list">{pedidosHoje.map((pedido) => <div className="dashboard-order" key={pedido._id}><div><strong>#{pedido.numero}</strong><span>{pedido.clienteNome || 'Cliente não identificado'}</span><small>{new Date(pedido.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {pedido.itens?.length || 0} itens</small></div><div><b>{money(pedido.total)}</b><span className={`dashboard-order-status status-${pedido.status}`}>{pedido.status}</span></div></div>)}</div> : <p className="dashboard-empty-orders">Nenhum pedido registrado hoje.</p>}</section>
    <style>{`
      .dashboard-page { color: var(--text-primary); }
      .dashboard-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:22px; }
      .dashboard-eyebrow { color:var(--accent-primary); font-size:10px; font-weight:800; letter-spacing:.1em; }
      .dashboard-heading h1 { margin:4px 0; font-size:26px; font-family:var(--font-heading); color:var(--brand-brown); }
      .dashboard-heading p { margin:0; color:var(--text-secondary); font-size:13px; }
      .dashboard-open { padding:10px 13px; border:1px solid var(--accent-border); border-radius:10px; background:var(--accent-light); color:var(--accent-primary); font-size:12px; font-weight:800; }
      .dashboard-periods { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
      .dashboard-period { background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:16px; padding:18px; box-shadow:var(--shadow-sm); }
      .dashboard-period-title { display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .dashboard-period-title h2 { margin:0; font-size:16px; color:var(--text-primary); }
      .dashboard-period-title span { color:var(--text-secondary); font-size:11px; }
      .dashboard-total { display:block; margin:18px 0 12px; color:var(--accent-primary); font-size:28px; font-variant-numeric:tabular-nums; }
      .dashboard-stats { display:flex; gap:14px; padding-bottom:16px; border-bottom:1px solid var(--border-light); color:var(--text-secondary); font-size:11px; }
      .dashboard-stats b { display:block; color:var(--text-primary); font-size:14px; }
      .dashboard-products h3 { margin:16px 0 8px; font-size:12px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.06em; }
      .dashboard-product { display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--border-light); font-size:12px; }
      .dashboard-product b { color:var(--accent-primary); }
      .dashboard-products p, .dashboard-loading { color:var(--text-secondary); font-size:13px; }
      .dashboard-orders { margin-top:16px; padding:18px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:16px; box-shadow:var(--shadow-sm); }
      .dashboard-stock { margin-top:16px; padding:18px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:16px; box-shadow:var(--shadow-sm); }
      .dashboard-stock-list { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px; }
      .dashboard-stock-item { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; border:1px solid var(--border-light); border-radius:10px; background:var(--bg-tertiary); }
      .dashboard-stock-item strong, .dashboard-stock-item small { display:block; }
      .dashboard-stock-item strong { color:var(--text-primary); font-size:13px; }
      .dashboard-stock-item small { margin-top:4px; color:var(--text-secondary); font-size:11px; }
      .dashboard-stock-item b { color:var(--accent-primary); white-space:nowrap; }
      .dashboard-stock-category h3 { display:flex; justify-content:space-between; margin:0 0 8px; color:var(--text-primary); font-size:13px; }
      .dashboard-stock-category h3 small { color:var(--text-secondary); font-size:11px; font-weight:400; }
      .dashboard-stock-categories { display:grid; gap:18px; }
      .dashboard-stock-legend { display:flex; flex-wrap:wrap; gap:12px; margin:-4px 0 16px; color:var(--text-secondary); font-size:11px; }
      .dashboard-stock-legend span { display:flex; align-items:center; gap:5px; }
      .dashboard-stock-legend i { width:9px; height:9px; border-radius:50%; display:inline-block; }
      .dashboard-stock-legend .stock-good { background:var(--success-bg); }
      .dashboard-stock-legend .stock-warning { background:var(--warning-bg); }
      .dashboard-stock-legend .stock-danger { background:var(--error-bg); }
      .dashboard-stock-bar { height:6px; margin-top:7px; overflow:hidden; border-radius:6px; background:var(--border-light); }
      .dashboard-stock-bar span { display:block; height:100%; border-radius:inherit; }
      .dashboard-stock-item .stock-good { color:var(--success-bg); background:var(--success-bg); }
      .dashboard-stock-item .stock-warning { color:var(--warning-bg); background:var(--warning-bg); }
      .dashboard-stock-item .stock-danger { color:var(--error-bg); background:var(--error-bg); }
      .dashboard-section-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
      .dashboard-section-heading h2 { margin:4px 0; font-size:18px; color:var(--text-primary); }
      .dashboard-section-heading p { margin:0; color:var(--text-secondary); font-size:12px; }
      .dashboard-orders-count { min-width:30px; padding:5px 9px; border-radius:20px; background:var(--accent-light); color:var(--accent-primary); font-weight:800; text-align:center; }
      .dashboard-orders-list { display:grid; gap:8px; }
      .dashboard-order { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px; border:1px solid var(--border-light); border-radius:10px; background:var(--bg-tertiary); }
      .dashboard-order > div { display:flex; align-items:center; gap:10px; min-width:0; }
      .dashboard-order > div:first-child { flex:1; }
      .dashboard-order strong { color:var(--accent-primary); }
      .dashboard-order span { color:var(--text-primary); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dashboard-order small { color:var(--text-secondary); font-size:11px; }
      .dashboard-order b { color:var(--accent-primary); white-space:nowrap; }
      .dashboard-order-status { padding:4px 8px; border-radius:20px; background:var(--accent-light); color:var(--accent-primary) !important; font-size:10px !important; font-weight:800; }
      .status-pago { background:rgba(22,163,74,.12); color:var(--success-bg) !important; }
      .status-cancelado { background:rgba(220,38,38,.12); color:var(--error-bg) !important; }
      .dashboard-empty-orders { margin:0; color:var(--text-secondary); font-size:13px; }
      .dashboard-loading { padding:40px; text-align:center; }
      @media (max-width:900px) { .dashboard-periods { grid-template-columns:1fr; } }
      @media (max-width:520px) { .dashboard-heading { align-items:flex-start; flex-direction:column; } .dashboard-order { align-items:flex-start; flex-direction:column; gap:8px; } .dashboard-order > div:last-child { width:100%; justify-content:space-between; } }
    `}</style>
  </div>;
}
