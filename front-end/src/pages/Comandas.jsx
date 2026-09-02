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
  const chosenProduct = products.find((product) => product._id === productId);

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
  const close = async () => {
    if (!selected || !window.confirm(`Fechar a comanda #${selected.numero}?`)) return;
    if (!paymentMethod) { setPaymentError(true); showToast('Escolha a forma de pagamento para fechar a comanda', 'warning'); return; }
    try { const { data } = await api.post(`/comandas/${selected._id}/fechar`, { desconto: Number(discount), metodoPagamento: paymentMethod }); showToast(`Comanda fechada: pedido #${data.pedido.numero}`, 'success'); setDiscount('0'); setPaymentMethod(''); setPaymentError(false); load(); }
    catch (error) { showToast(error.response?.data?.msg || 'Erro ao fechar comanda', 'error'); }
  };

  return <div>
    <div style={{ marginBottom: 16 }}><h1 style={{ margin: 0, fontSize: 22 }}>Comandas</h1><p style={{ color: 'var(--text-secondary)' }}>Abra mesas, lance consumos e feche no caixa.</p></div>
    <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, padding: 16, border: '1px solid var(--border-color)', borderRadius: 14, marginBottom: 16 }}>
      <input placeholder="Mesa / balcão" value={newCommand.mesa} onChange={(e) => setNewCommand({ ...newCommand, mesa: e.target.value })} />
      <input placeholder="Nome do cliente" value={newCommand.clienteNome} onChange={(e) => setNewCommand({ ...newCommand, clienteNome: e.target.value })} />
      <input placeholder="Observação" value={newCommand.observacao} onChange={(e) => setNewCommand({ ...newCommand, observacao: e.target.value })} />
      <button type="submit">Abrir comanda</button>
    </form>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(300px, 2fr)', gap: 16 }}>
      <section style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: 12 }}>
        <strong>Em aberto ({comandas.length})</strong>
        {comandas.map((command) => <button key={command._id} onClick={() => setSelected(command)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 8, padding: 12, border: selected?._id === command._id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
          <b>#{command.numero}</b> {command.mesa && `• ${command.mesa}`}<br /><small>{command.clienteNome} · {command.itens.length} itens</small>
        </button>)}
      </section>
      <section style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: 16 }}>
        {!selected ? <p>Selecione ou abra uma comanda.</p> : <><h2 style={{ marginTop: 0 }}>Comanda #{selected.numero} {selected.mesa && `— ${selected.mesa}`}</h2>
          <form onSubmit={addItem} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <select required value={productId} onChange={(e) => setProductId(e.target.value)} style={{ flex: 1 }}><option value="">Adicionar produto…</option>{products.map((product) => <option key={product._id} value={product._id}>{product.nome} — {formatMoney(product.preco)}/{product.unidadeVenda || 'un'}</option>)}</select>
            <input required type="number" min="0.001" step={chosenProduct?.vendidoFracionado ? '0.001' : '1'} value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: 90 }} />
            <button type="submit">Adicionar</button>
          </form>
          {(selected.itens || []).map((item) => <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border-color)', padding: '10px 0' }}><span><b>{item.nome}</b><br /><small>{formatQuantity(item)} × {formatMoney(item.precoUnitario)}</small>{item.modificadores?.length > 0 && <><br /><small style={{ color: 'var(--accent-primary)' }}>☕ {item.modificadores.join(' · ')}</small></>}</span><span>{formatMoney(item.quantidade * item.precoUnitario)} <button onClick={() => removeItem(item._id)} aria-label={`Remover ${item.nome}`}>×</button></span></div>)}
          <div style={{ borderTop: '2px solid var(--accent-primary)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><div><small style={{ display: 'block', color: 'var(--text-secondary)' }}>Total da comanda</small><b style={{ fontSize: 20, color: 'var(--accent-primary)' }}>{formatMoney(total)}</b></div><input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} title="Desconto" style={{ width: 85 }} /><select required value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPaymentError(false); }} aria-label="Forma de pagamento" style={{ minHeight: 40, borderColor: paymentError ? 'var(--error-bg)' : 'var(--input-border)' }}><option value="">Forma de pagamento</option><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="credito_loja">Crédito na loja</option></select><button onClick={close} style={{ background: 'var(--accent-primary)', color: '#fff', fontWeight: 700 }}>Fechar comanda</button></div>
        </>}
      </section>
    </div>
  </div>;
}
