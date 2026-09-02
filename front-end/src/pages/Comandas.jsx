import { useEffect, useMemo, useState } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';
import { buildNotaVendaHtml, compartilharNotaWhatsApp } from '../utils/notaVenda.js';

const formatMoney = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const formatQuantity = (item) => `${Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${item.unidadeVenda || 'un'}`;

// ─── helpers de cupom / whatsapp ─────────────────────────────────────────────

function buildCupomHtml(pedido, comanda) {
  return buildNotaVendaHtml(pedido, { comandaNumero: comanda?.numero });
  /* modelo antigo mantido abaixo apenas como referência de compatibilidade */
  const data = new Date(pedido.createdAt).toLocaleString('pt-BR');
  const pagTipo = pedido.pagamentos?.[0]?.tipo || '';
  const labelPag = {
    pix: 'Pix', dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    credito_loja: 'Crédito na Loja',
  }[pagTipo] || pagTipo;

  const itensHtml = pedido.itens.map(item => `
    <div style="display:flex;justify-content:space-between;border-bottom:1px dashed #000;padding:4px 0;">
      <div style="flex:1;margin-right:8px;">
        <div style="font-weight:bold;">${item.nome}</div>
        <div style="font-size:10px;">Cod: ${item.codigo} | Qtd: ${item.quantidade} × R$ ${item.precoUnitario.toFixed(2).replace('.', ',')}</div>
        ${item.modificadores?.length ? `<div style="font-size:10px;color:#7c4b1e;">☕ ${item.modificadores.join(' · ')}</div>` : ''}
      </div>
      <div style="font-weight:bold;white-space:nowrap;">R$ ${(item.quantidade * item.precoUnitario).toFixed(2).replace('.', ',')}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><title>Cupom #${pedido.numero}</title>
  <style>
    * { font-family: 'Courier New', monospace; font-size: 12px; }
    body { width: 76mm; margin: 0; padding: 4mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .linha-dupla { border-top: 2px dashed #000; margin: 8px 0; }
    @media print { @page { margin: 0; size: 80mm auto; } body { margin: 4mm; } }
  </style></head><body>
  <div class="center bold" style="font-size:14px;">SABOR DE ABRAÇO</div>
  <div class="center" style="font-size:10px;">Cupom Não Fiscal</div>
  <div class="linha-dupla"></div>
  <div><span class="bold">Pedido:</span> #${pedido.numero}</div>
  <div><span class="bold">Comanda:</span> #${comanda.numero}</div>
  <div><span class="bold">Data:</span> ${data}</div>
  <div><span class="bold">Atendente:</span> ${pedido.atendente}</div>
  <div><span class="bold">Cliente:</span> ${pedido.clienteNome}</div>
  <div class="linha-dupla"></div>
  <div class="bold" style="text-align:center;">=== ITENS DO PEDIDO ===</div>
  ${itensHtml}
  <div class="linha-dupla"></div>
  <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>R$ ${pedido.subtotal.toFixed(2).replace('.', ',')}</span></div>
  ${pedido.desconto > 0 ? `<div style="display:flex;justify-content:space-between;color:#16a34a;"><span>Desconto:</span><span>-R$ ${pedido.desconto.toFixed(2).replace('.', ',')}</span></div>` : ''}
  <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;border-top:2px solid #000;padding-top:8px;margin-top:8px;">
    <span>TOTAL:</span><span>R$ ${pedido.total.toFixed(2).replace('.', ',')}</span>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;">
    <span>Pagamento:</span><span>${labelPag}</span>
  </div>
  <div class="linha-dupla"></div>
  <div class="center" style="font-size:10px;">Obrigado pela preferência!<br>Volte sempre!</div>
  <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500);}</script>
  </body></html>`;
}

function imprimirCupom(pedido, comanda) {
  if (!pedido) return;
  const janela = window.open('', '_blank', 'width=350,height=600');
  janela.document.write(buildCupomHtml(pedido, comanda));
  janela.document.close();
}

async function enviarWhatsApp(pedido, comanda, telefone) {
  if (!pedido) return;
  await compartilharNotaWhatsApp(pedido, { comandaNumero: comanda?.numero }, telefone);
  return;
  const data = new Date(pedido.createdAt).toLocaleString('pt-BR');
  const itensTexto = pedido.itens.map(item =>
    `• ${item.nome}${item.modificadores?.length ? ` (${item.modificadores.join(', ')})` : ''}\n  ${item.quantidade} × R$ ${item.precoUnitario.toFixed(2).replace('.', ',')} = R$ ${(item.quantidade * item.precoUnitario).toFixed(2).replace('.', ',')}`
  ).join('\n');

  const texto = encodeURIComponent(
`🛒 *PEDIDO* #${pedido.numero} | Comanda #${comanda.numero}
📅 ${data}
👤 Cliente: ${pedido.clienteNome}
💼 Atendente: ${pedido.atendente}
━━━━━━━━━━━━━━━━
📦 *ITENS:*
${itensTexto}
━━━━━━━━━━━━━━━━
💰 Subtotal: R$ ${pedido.subtotal.toFixed(2).replace('.', ',')}
${pedido.desconto > 0 ? `🎁 Desconto: -R$ ${pedido.desconto.toFixed(2).replace('.', ',')}\n` : ''}💵 *TOTAL: R$ ${pedido.total.toFixed(2).replace('.', ',')}*
Obrigado pela preferência! 🙏`
  );

  const fone = telefone ? telefone.replace(/\D/g, '') : '';
  const url = fone ? `https://wa.me/55${fone}?text=${texto}` : `https://wa.me/?text=${texto}`;
  window.open(url, '_blank');
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function Comandas() {
  const [comandas, setComandas] = useState([]);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [newCommand, setNewCommand] = useState({ clienteNome: '', observacao: '' });
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');

  // modal de fechamento
  const [modalFechamento, setModalFechamento] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentError, setPaymentError] = useState(false);
  const [telefoneModal, setTelefoneModal] = useState('');

  // modal de sucesso pós-fechamento
  const [modalSucesso, setModalSucesso] = useState(null); // { pedido, comanda, telefone }

  const { showToast } = useToast();

  const load = async () => {
    try {
      const [commands, catalog] = await Promise.all([api.get('/comandas?status=aberta'), api.get('/products')]);
      setComandas(commands.data);
      setProducts(catalog.data);
      setSelected((current) => commands.data.find((c) => c._id === current?._id) || commands.data[0] || null);
    } catch { showToast('Não foi possível carregar as comandas', 'error'); }
  };
  useEffect(() => { load(); }, []);

  const subtotal = useMemo(() => (selected?.itens || []).reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0), [selected]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const create = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.post('/comandas', newCommand);
      setNewCommand({ clienteNome: '', observacao: '' }); setSelected(data); showToast('Comanda aberta', 'success'); load();
    } catch (error) { showToast(error.response?.data?.msg || 'Erro ao abrir comanda', 'error'); }
  };

  const produtoSelecionado = products.find((product) => product._id === productId);

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

  const abrirModalFechamento = () => {
    if (!selected) return;
    if (!selected.itens.length) { showToast('A comanda não tem itens', 'warning'); return; }
    setDiscount('0');
    setPaymentMethod('');
    setPaymentError(false);
    setTelefoneModal('');
    setModalFechamento(true);
  };

  const confirmarFechamento = async () => {
    if (!paymentMethod) { setPaymentError(true); showToast('Escolha a forma de pagamento', 'warning'); return; }
    const comandaFechada = selected;
    try {
      const { data } = await api.post(`/comandas/${selected._id}/fechar`, { desconto: Number(discount), metodoPagamento: paymentMethod });
      setModalFechamento(false);
      setDiscount('0'); setPaymentMethod(''); setPaymentError(false);
      setModalSucesso({ pedido: data.pedido, comanda: comandaFechada, telefone: telefoneModal });
      showToast(`Comanda #${comandaFechada.numero} fechada → Pedido #${data.pedido.numero}`, 'success');
      load();
    } catch (error) { showToast(error.response?.data?.msg || 'Erro ao fechar comanda', 'error'); }
  };

  // verifica se o cliente da comanda tem telefone registrado
  const clienteTemTelefone = selected?.clienteId; // clientes cadastrados têm telefone via Customer

  return (
    <div className="comandas-page">
      <div className="page-heading"><h1>☕ Comandas</h1><p>Abra comandas, lance consumos e feche no caixa.</p></div>
      <form onSubmit={create} className="comandas-open-form">
        <input className="comandas-field" placeholder="Nome do cliente" value={newCommand.clienteNome} onChange={(e) => setNewCommand({ ...newCommand, clienteNome: e.target.value })} />
        <input className="comandas-field" placeholder="Observação" value={newCommand.observacao} onChange={(e) => setNewCommand({ ...newCommand, observacao: e.target.value })} />
        <button type="submit">Abrir comanda</button>
      </form>

      <div className="comandas-columns">
        <section className="comandas-card comandas-list-card">
          <div className="comandas-card-heading"><div><h2>Em aberto</h2><p>Selecione uma comanda para editar.</p></div><span className="comandas-count">{comandas.length}</span></div>
          <div className="comandas-quick-products"><strong>Lançamento rápido</strong><div>{products.slice(0, 8).map((product) => <button key={product._id} type="button" onClick={() => { setProductId(product._id); setQuantity('1'); }} className={productId === product._id ? 'selected' : ''}>{product.nome}</button>)}</div></div>
          {comandas.map((command) => <button className="comanda-select-button" key={command._id} onClick={() => setSelected(command)} style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 8, padding: 12, border: selected?._id === command._id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
            <b>#{command.numero}</b><br /><small>{command.clienteNome} · {command.itens.length} itens</small>
          </button>)}
        </section>

        <section className="comandas-card comandas-detail-card">
          {!selected ? <p>Selecione ou abra uma comanda.</p> : <>
            <h2 style={{ marginTop: 0 }}>Comanda #{selected.numero} <small style={{ fontWeight: 400, fontSize: 14, color: 'var(--text-secondary)' }}>— {selected.clienteNome}</small></h2>
            <form onSubmit={addItem} className="comandas-add-form">
              <select className="comandas-field" required value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Adicionar produto…</option>{products.map((product) => <option key={product._id} value={product._id}>{product.nome} — {formatMoney(product.preco)}</option>)}</select>
              <input className="comandas-field quantity-field" required type="number" min={produtoSelecionado?.vendidoFracionado ? '0.001' : '1'} step={produtoSelecionado?.vendidoFracionado ? '0.001' : '1'} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <button type="submit" className="comandas-secondary-button">Adicionar</button>
            </form>
            {(selected.itens || []).map((item) => <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--border-color)', padding: '10px 0' }}><span><b>{item.nome}</b><br /><small>{formatQuantity(item)} × {formatMoney(item.precoUnitario)}</small>{item.modificadores?.length > 0 && <><br /><small style={{ color: 'var(--accent-primary)' }}>☕ {item.modificadores.join(' · ')}</small></>}</span><span>{formatMoney(item.quantidade * item.precoUnitario)} <button onClick={() => removeItem(item._id)} aria-label={`Remover ${item.nome}`}>×</button></span></div>)}
            <div className="comandas-checkout">
              <div><small style={{ display: 'block', color: 'var(--text-secondary)' }}>Total da comanda</small><b style={{ fontSize: 20, color: 'var(--accent-primary)' }}>{formatMoney(subtotal)}</b></div>
              <button onClick={abrirModalFechamento} className="comandas-primary-button">Fechar comanda</button>
              <button onClick={cancel} className="comandas-cancel-button">Cancelar</button>
            </div>
          </>}
        </section>
      </div>

      {/* ── MODAL DE FECHAMENTO ───────────────────────────────────────────── */}
      {modalFechamento && selected && (
        <div onClick={() => setModalFechamento(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 18, padding: 24, boxShadow: 'var(--shadow-lg)', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '.08em' }}>FECHAR COMANDA</span>
                <h2 style={{ margin: '4px 0 0', fontSize: 20 }}>#{selected.numero} — {selected.clienteNome}</h2>
              </div>
              <button onClick={() => setModalFechamento(false)} style={{ border: 0, background: 'transparent', fontSize: 22, cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>

            {/* itens resumo */}
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, maxHeight: 200, overflowY: 'auto' }}>
              {selected.itens.map(item => (
                <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                  <span>{item.quantidade}× {item.nome}{item.modificadores?.length ? <span style={{ color: 'var(--accent-primary)', fontSize: 11 }}> ({item.modificadores.join(', ')})</span> : ''}</span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(item.quantidade * item.precoUnitario)}</span>
                </div>
              ))}
            </div>

            {/* desconto */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Desconto (R$)</label>
                <input type="number" min="0" max={subtotal} step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                  className="comandas-field" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total a cobrar</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-primary)' }}>{formatMoney(total)}</span>
              </div>
            </div>

            {/* forma de pagamento */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Forma de pagamento</label>
              <select className="comandas-field" value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value); setPaymentError(false); }}
                style={{ width: '100%', borderColor: paymentError ? 'var(--error-bg)' : undefined }}>
                <option value="">Selecione…</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="credito_loja">Crédito na Loja</option>
              </select>
            </div>

            {/* telefone (só para clientes não cadastrados) */}
            {!clienteTemTelefone && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  📱 WhatsApp do cliente <span style={{ fontWeight: 400 }}>(opcional — para envio do comprovante)</span>
                </label>
                <input type="tel" placeholder="(00) 00000-0000" value={telefoneModal} onChange={e => setTelefoneModal(e.target.value)}
                  className="comandas-field" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}

            <button onClick={confirmarFechamento} style={{ width: '100%', minHeight: 50, border: 0, borderRadius: 12, background: 'var(--accent-primary)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>
              ✅ Confirmar Fechamento
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE SUCESSO ──────────────────────────────────────────────── */}
      {modalSucesso && (
        <div onClick={() => setModalSucesso(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9001, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 28, textAlign: 'center', boxShadow: 'var(--shadow-lg)', color: 'var(--text-primary)' }}>
            <div style={{ width: 68, height: 68, borderRadius: '50%', margin: '0 auto 14px', background: 'rgba(16,185,129,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>✅</div>
            <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>Comanda Fechada!</h3>
            <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--text-secondary)' }}>
              Comanda <strong style={{ color: 'var(--text-primary)' }}>#{modalSucesso.comanda.numero}</strong> →{' '}
              Pedido <strong style={{ color: 'var(--text-primary)' }}>#{modalSucesso.pedido.numero}</strong>
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, color: 'var(--accent-primary)' }}>
              {formatMoney(modalSucesso.pedido.total)}
            </p>

            {/* campo de telefone no modal de sucesso (se não preencheu antes) */}
            {!clienteTemTelefone && (
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  📱 WhatsApp para enviar comprovante
                </label>
                <input type="tel" placeholder="(00) 00000-0000"
                  value={modalSucesso.telefone || ''}
                  onChange={e => setModalSucesso(prev => ({ ...prev, telefone: e.target.value }))}
                  className="comandas-field" style={{ width: '100%', boxSizing: 'border-box' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-light)', paddingTop: 18 }}>
              <button onClick={() => imprimirCupom(modalSucesso.pedido, modalSucesso.comanda)}
                style={{ width: '100%', padding: '13px', background: 'var(--brand-brown, #7c4b1e)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                🖨️ Imprimir Cupom
              </button>
              <button onClick={() => enviarWhatsApp(modalSucesso.pedido, modalSucesso.comanda, modalSucesso.telefone)}
                style={{ width: '100%', padding: '13px', background: '#25d366', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                💬 Enviar pelo WhatsApp
              </button>
              <button onClick={() => setModalSucesso(null)}
                style={{ width: '100%', padding: '11px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 42 }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .comandas-page { width: 100%; max-width: 1180px; margin: 0 auto; }
        .page-heading { margin-bottom: 20px; }
        .page-heading h1 { margin: 0 0 4px; font-size: 22px; color: var(--text-primary); }
        .page-heading p, .comandas-card-heading p { margin: 0; color: var(--text-secondary); font-size: 13px; }
        .comandas-open-form, .comandas-card { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; box-shadow: var(--shadow-sm); }
        .comandas-open-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; padding: 18px; margin-bottom: 16px; }
        .comandas-field { width: 100%; min-height: 48px; padding: 12px 14px; border: 1.5px solid var(--border-color); border-radius: 10px; background: var(--input-bg); color: var(--input-text); font: inherit; box-sizing: border-box; }
        .comandas-open-form button, .comandas-primary-button { min-height: 48px; padding: 10px 18px; border: 0; border-radius: 10px; background: var(--accent-primary); color: #fff; font-weight: 800; cursor: pointer; }
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
        .comandas-cancel-button { min-height: 48px; padding: 10px 14px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-tertiary); color: var(--error-bg); font-weight: 800; cursor: pointer; }
        .comandas-quick-products { padding: 12px; margin-bottom: 12px; border-radius: 10px; background: var(--accent-light); color: var(--text-secondary); font-size: 11px; }
        .comandas-quick-products > div { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
        .comandas-quick-products button { min-height: 42px; padding: 6px 8px; border: 1px solid var(--accent-border); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); text-align: left; font-size: 11px; cursor: pointer; }
        .comandas-quick-products button.selected { border: 2px solid var(--accent-primary); color: var(--accent-primary); }
        @media (max-width: 760px) { .comandas-columns { grid-template-columns: 1fr; } .comandas-detail-card { min-width: 0; } .comandas-add-form { grid-template-columns: minmax(0, 1fr) 82px; } .comandas-add-form button { grid-column: 1 / -1; } }
        @media (max-width: 520px) { .comandas-open-form, .comandas-card { padding: 14px; } .comandas-checkout { align-items: stretch; flex-direction: column; } .comandas-checkout .comandas-field, .comandas-checkout button { width: 100%; } }
      `}</style>
    </div>
  );
}
