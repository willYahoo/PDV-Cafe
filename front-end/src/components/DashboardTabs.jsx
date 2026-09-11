export default function DashboardTabs({ value, onChange }) {
  return <nav className="dashboard-tabs" aria-label="Visão do dashboard">
    <button type="button" className={value === 'vendas' ? 'active' : ''} onClick={() => onChange('vendas')}>Vendas</button>
    <button type="button" className={value === 'producao' ? 'active' : ''} onClick={() => onChange('producao')}>Produção</button>
  </nav>;
}
