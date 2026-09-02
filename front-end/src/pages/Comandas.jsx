import { useEffect, useMemo, useState } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';

const formatMoney = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const formatQuantity = (item) => `${Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${item.unidadeVenda || 'un'}`;

export default function Comandas() {
  const [comandas, setComandas] = useState([]);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newCommand, setNewCommand] = useState({ mesa: '', clienteNome: '', observacao: '' });
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentError, setPaymentError] = useState(false);
  const { showToast } = useToast();

  const load = async () => {
    try {
      const [commands, catalog] = await Promise.all([api.get('/comandas?status=aberta'), api.get('/products')]);
      setComandas(commands.data);
      setProducts(catalog.data);
      setSelected((current) => commands.data.find((command) => command._id === current?._id) || commands.data[0] || null);
    } catch { showToast('Não foi possível carregar as comandas', 'error'); }
  };
  useEffect(() => { load(); }, []);
  const subtotal = useMemo(() => (selected?.itens || []).reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0), [selected]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const create = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/comandas', newCommand);
      setNewCommand({ mesa: '', clienteNome: '', observacao: '' }); setSelected(data); showToast('Comanda aberta', 'success'); load();
    } catch (error) { showToast(error.response?.data?.msg || 'Erro ao abrir comanda', 'error'); }
  };
  const addItem = async (event) => {
    event.preventDefault();
    if (!selected || !productId) return;
    try { await api.post(`/comandas/${selected._id}/itens`, { produtoId: productId, quantidade: Number(quantity) }); setProductId(''); setQuantity('1'); load(); }
    catch (error) { showToast(error.response?.data?.msg || 'Erro ao adicionar item', 'error'); }
  };
  const removeItem = async (itemId) => { await api.delete(`/comandas/${selected._id}/itens/${itemId}`); load(); };
  const cancel = async () => {
    if (!selected || !window.confirm(`Cancelar a comanda #${selected.numero}?`)) return;
    try { await api.patch(`/comandas/${selected._id}/cancelar`); showToast('Comanda cancelada', 'warning'); load(); }
    catch (error) { showToast(error.response?.data?.msg || 'Erro ao cancelar comanda', 'error'); }
  };
  const close = async () => {
    if (!selected || !window.confirm(`Fechar a comanda #${selected.numero}?`)) return;
    if (!paymentMethod) { setPaymentError(true); showToast('Escolha a forma de pagamento para fechar a comanda', 'warning'); return; }
    try { const { data } = await api.post(`/comandas/${selected._id}/fechar`, { desconto: Number(discount), metodoPagamento: paymentMethod }); showToast(`Comanda fechada: pedido #${data.pedido.numero}`, 'success'); setDiscount('0'); setPaymentMethod(''); setPaymentError(false); load(); }
    catch (error) { showToast(error.response?.data?.msg || 'Erro ao fechar comanda', 'error'); }
  };

  return <div className="comandas-page">
    <div className="page-heading"><h1>☕ Comandas</h1><p>Abra mesas, lance consumos e feche no caixa.</p></div>
    <form onSubmit={create} className="comandas-open-form">
      <input className="comandas-field" placeholder="Mesa / balcão" value={newCommand.mesa} onChange={(e) => setNewCommand({ ...newCommand, mesa: e.target.value })} />
      <input className="comandas-field" placeholder="Nome do cliente" value={newCommand.clienteNome} onChange={(e) => setNewCommand({ ...newCommand, clienteNome: e.target.value })} />
      <input className="comandas-field" placeholder="Observação" value={newCommand.observacao} onChange={(e) => setNewCommand({ ...newCommand, observacao: e.target.value })} />
      <button type="submit">Abrir comanda</button>
    </form>
    <div className="comandas-columns">
      <section className="comandas-card comandas-list-card">
        <div className="comandas-card-heading"><div><h2>Em aberto</h2><p>Selecione uma comanda para editar.</p></div><span className="comandas-count">{comandas.length}</span></div>
        <div className="comandas-quick-products"><strong>Lançamento rápido</strong><div>{products.slice(0, 8).map((product) => <button key={product._id} type="button" onClick={() => { setProductId(product._id); setQuantity('1'); }} className={productId === product._id ? 'selected' : ''}>{product.nome}</button>)}</div></div>
        {comandas.map((command) => <button className="comanda-select-button" key={command._id} onClick={() => setSelected(command)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 8, padding: 12, border: selected?._id === command._id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
          <b>#{command.numero}</b> {command.mesa && `• ${command.mesa}`}<br /><small>{command.clienteNome} · {command.itens.length} itens</small>
        </button>)}
      </section>
      <section className="comandas-card comandas-detail-card">
        {!selected ? <p>Selecione ou abra uma comanda.</p> : <><h2 style={{ marginTop: 0 }}>Comanda #{selected.numero} {selected.mesa && `— ${selected.mesa}`}</h2>
          <form onSubmit={addItem} className="comandas-add-form">
            <select className="comandas-field" required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Adicionar produto…</option>{products.map((product) => <option key={product._id} value={product._id}>{product.nome} — {formatMoney(product.preco)}</option>)}</select>
            <input className="comandas-field quantity-field" required type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <button type="submit" className="comandas-secondary-button">Adicionar</button>
          </form>
          {(selected.itens || []).map((item) => <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border-color)', padding: '10px 0' }}><span><b>{item.nome}</b><br /><small>{formatQuantity(item)} × {formatMoney(item.precoUnitario)}</small>{item.modificadores?.length > 0 && <><br /><small style={{ color: 'var(--accent-primary)' }}>☕ {item.modificadores.join(' · ')}</small></>}</span><span>{formatMoney(item.quantidade * item.precoUnitario)} <button onClick={() => removeItem(item._id)} aria-label={`Remover ${item.nome}`}>×</button></span></div>)}
          <div className="comandas-checkout"><div><small style={{ display: 'block', color: 'var(--text-secondary)' }}>Total da comanda</small><b style={{ fontSize: 20, color: 'var(--accent-primary)' }}>{formatMoney(total)}</b></div><input className="comandas-field discount-field" type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} title="Desconto" /><select className="comandas-field" required value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPaymentError(false); }} aria-label="Forma de pagamento" style={{ borderColor: paymentError ? 'var(--error-bg)' : undefined }}><option value="">Forma de pagamento</option><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="credito_loja">Crédito na loja</option></select><button onClick={close} className="comandas-primary-button">Fechar comanda</button><button onClick={cancel} className="comandas-cancel-button">Cancelar</button></div>
        </>}
      </section>
    </div>
    <style>{`
      .comandas-page { width: 100%; max-width: 1180px; margin: 0 auto; }
      .page-heading { margin-bottom: 20px; }
      .page-heading h1 { margin: 0 0 4px; font-size: 22px; color: var(--text-primary); }
      .page-heading p, .comandas-card-heading p { margin: 0; color: var(--text-secondary); font-size: 13px; }
      .comandas-open-form, .comandas-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: var(--shadow-sm); }
      .comandas-open-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; padding: 18px; margin-bottom: 16px; }
      .comandas-field { width: 100%; min-height: 48px; padding: 12px 14px; border: 1.5px solid var(--border-color); border-radius: 10px; background: var(--input-bg); color: var(--input-text); font: inherit; box-sizing: border-box; }
      .comandas-open-form button, .comandas-primary-button { min-height: 48px; border: 0; border-radius: 10px; background: var(--accent-primary); color: #fff; font-weight: 800; cursor: pointer; }
      .comandas-secondary-button { min-height: 48px; padding: 10px 16px; border: 1px solid var(--accent-border); border-radius: 10px; background: var(--accent-light); color: var(--accent-primary); font-weight: 800; cursor: pointer; }
      .comandas-columns { display: grid; grid-template-columns: minmax(230px, .85fr) minmax(320px, 1.6fr); gap: 16px; }
      .comandas-card { padding: 18px; }
      .comandas-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
      .comandas-card-heading h2 { margin: 0; font-size: 16px; color: var(--text-primary); }
      .comandas-count { min-width: 30px; padding: 5px 9px; border-radius: 20px; background: var(--accent-light); color: var(--accent-primary); font-weight: 800; text-align: center; }
      .comanda-select-button { background: var(--bg-tertiary) !important; border-radius: 10px !important; min-height: 58px; color: var(--text-primary); cursor: pointer; }
      .comanda-select-button:hover { border-color: var(--accent-primary) !important; background: var(--accent-light) !important; }
      .comandas-add-form { display: grid; grid-template-columns: minmax(0, 1fr) 90px auto; gap: 8px; margin-bottom: 16px; }
      .comandas-checkout { border-top: 2px solid var(--accent-primary); padding-top: 14px; margin-top: 8px; display: flex; align-items: flex-end; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .discount-field { width: 90px; }
      .comandas-cancel-button { min-height: 48px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-tertiary); color: var(--error-bg); font-weight: 800; cursor: pointer; }
      .comandas-quick-products { padding: 12px; margin-bottom: 12px; border-radius: 10px; background: var(--accent-light); color: var(--text-secondary); font-size: 11px; }
      .comandas-quick-products > div { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
      .comandas-quick-products button { min-height: 42px; padding: 6px 8px; border: 1px solid var(--accent-border); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); text-align: left; font-size: 11px; cursor: pointer; }
      .comandas-quick-products button.selected { border: 2px solid var(--accent-primary); color: var(--accent-primary); }
      @media (max-width: 760px) { .comandas-columns { grid-template-columns: 1fr; } .comandas-detail-card { min-width: 0; } .comandas-add-form { grid-template-columns: minmax(0, 1fr) 82px; } .comandas-add-form button { grid-column: 1 / -1; } }
      @media (max-width: 520px) { .comandas-open-form, .comandas-card { padding: 14px; } .comandas-checkout { align-items: stretch; flex-direction: column; } .comandas-checkout .comandas-field, .comandas-checkout button { width: 100%; } .discount-field { width: 100%; } }
    `}</style>
  </div>;
}
