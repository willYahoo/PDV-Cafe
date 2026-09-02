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
  const { showToast } = useToast();

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/dashboard').then((response) => setData(response.data)).catch((error) => showToast(error.response?.data?.msg || 'Não foi possível carregar o dashboard', 'error'));
  }, [user?.role]);

  if (user?.role !== 'admin') return <Navigate to="/pdv" replace />;

  if (!data) return <div className="dashboard-page"><div className="dashboard-loading">☕ Carregando acompanhamento...</div></div>;

  return <div className="dashboard-page">
    <div className="dashboard-heading"><div><span className="dashboard-eyebrow">GESTÃO DA CASA</span><h1>Dashboard</h1><p>Acompanhe o ritmo do Sabor de Abraço.</p></div><div className="dashboard-open">{data.comandasAbertas} comandas abertas</div></div>
    <div className="dashboard-periods">{['dia', 'semana', 'mes'].map((periodo) => { const metric = data.periodos[periodo]; return <section className="dashboard-period" key={periodo}><div className="dashboard-period-title"><h2>{labels[periodo]}</h2><span>{metric.pedidos} pedidos</span></div><strong className="dashboard-total">{money(metric.total)}</strong><div className="dashboard-stats"><span><b>{metric.itens}</b> itens</span><span><b>{money(metric.ticketMedio)}</b> ticket médio</span></div><div className="dashboard-products"><h3>Mais pedidos</h3>{metric.maisVendidos.length ? metric.maisVendidos.map((product) => <div className="dashboard-product" key={product.nome}><span>{product.nome}</span><b>{product.quantidade}</b></div>) : <p>Nenhum pedido no período.</p>}</div></section>; })}</div>
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
      .dashboard-loading { padding:40px; text-align:center; }
      @media (max-width:900px) { .dashboard-periods { grid-template-columns:1fr; } }
      @media (max-width:520px) { .dashboard-heading { align-items:flex-start; flex-direction:column; } }
    `}</style>
  </div>;
}
