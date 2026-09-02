import { useState, useEffect } from 'react';
import api from '../services/api.jsx';
import { useToast } from '../components/Toast.jsx';


const categorias = ['Bebidas Quentes', 'Bebidas geladas', 'Salgados', 'Doces', 'Café da manhã', 'Grãos e insumos', 'Outros'];


export default function Products() {
  const [produtos, setProdutos] = useState([]);
  const vazio = { codigo: '', nome: '', categoria: 'Bebidas Quentes', preco: '', estoque: '', unidadeVenda: 'un', vendidoFracionado: false };
  const [form, setForm] = useState(vazio);
  const [editing, setEditing] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const { showToast } = useToast();


  useEffect(() => { carregar(); }, []);

  // Gera próximo código automaticamente
  useEffect(() => {
    if (!editing && produtos.length > 0) {
      gerarProximoCodigo();
    }
  }, [produtos, editing]);

  const carregar = async () => {
    const res = await api.get('/products');
    setProdutos(res.data);
  };

  const gerarProximoCodigo = () => {
    if (produtos.length === 0) {
      setForm(prev => ({ ...prev, codigo: '1' }));
      return;
    }
    const maiorCodigo = produtos.reduce((maior, p) => {
      const cod = parseInt(p.codigo) || 0;
      return cod > maior ? cod : maior;
    }, 0);
    setForm(prev => ({ ...prev, codigo: String(maiorCodigo + 1) }));
  };

  // 🔒 Verifica duplicidade de CÓDIGO
  const codigoJaExiste = (codigo, idEdicao = null) => {
    return produtos.some(p => 
      String(p.codigo) === String(codigo) && p._id !== idEdicao
    );
  };


  const submit = async (e) => {
    e.preventDefault();

    // ✅ Verifica duplicidade
    if (codigoJaExiste(form.codigo, editing?._id)) {
      return showToast('⚠️ Este código já está cadastrado! Use outro.', 'warning');
    }

    const dados = { ...form, preco: parseFloat(form.preco), estoque: parseFloat(form.estoque) || 0, unidadeVenda: 'un', vendidoFracionado: false };
    try {
      editing ? await api.put(`/products/${editing._id}`, dados) : await api.post('/products', dados);
      showToast(editing ? '✅ Produto atualizado!' : '✅ Produto cadastrado!', 'success');
      setForm(vazio);
      setEditing(null);
      carregar();
    } catch (err) {
      showToast(err.response?.data?.msg || '❌ Erro ao salvar', 'error');
    }
  };


  const alterar = (p) => {
    setEditing(p);
    setForm({ codigo: p.codigo, nome: p.nome, categoria: p.categoria, preco: p.preco, estoque: p.estoque, unidadeVenda: 'un', vendidoFracionado: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const remover = async (id) => {
    if (!window.confirm('Excluir este produto?')) return;
    await api.delete(`/products/${id}`);
    showToast('Produto removido', 'warning');
    carregar();
  };


  const cancelar = () => {
    setEditing(null);
    setForm(vazio);
  };


  const filtrados = produtos.filter(p =>
    (categoriaFiltro === 'Todas' || p.categoria === categoriaFiltro) &&
    (p.nome.toLowerCase().includes(filtro.toLowerCase()) || String(p.codigo).includes(filtro))
  );


  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>📦 Cadastro de Produtos</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>Gerencie seu catálogo de produtos</p>
      </div>


      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 16, padding: 16, marginBottom: 16
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)' }}>
          {editing ? '✏️ Editar Produto' : '➕ Novo Produto'}
        </h3>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }} className="form-grid-prod">
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }}>
                Código {!editing && <span style={{ color: 'var(--success-bg)', fontSize: 11 }}>(automático)</span>}
              </label>
              <input 
                placeholder="Automático" 
                value={form.codigo} 
                readOnly={!editing}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                style={{
                  ...inputStyle,
                  background: !editing ? 'var(--bg-tertiary)' : 'var(--input-bg)',
                  cursor: !editing ? 'not-allowed' : 'text'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }}>Nome *</label>
              <input placeholder="Nome do produto" value={form.nome} required
                onChange={e => setForm({ ...form, nome: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }}>Categoria</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={inputStyle}>
                {categorias.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }}>Preço (R$) *</label>
              <input type="number" step="0.01" min={0} placeholder="0.00" value={form.preco} required
                onChange={e => setForm({ ...form, preco: e.target.value })}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }}>Estoque</label>
              <input type="number" step="0.001" min={0} placeholder="0" value={form.estoque}
                onChange={e => setForm({ ...form, estoque: e.target.value })}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button type="submit" style={{
              flex: 1, padding: '12px', background: 'var(--accent-primary)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', minHeight: 46
            }}>{editing ? 'Atualizar' : 'Cadastrar'}</button>
            {editing && <button type="button" onClick={cancelar} style={{
              padding: '12px 20px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              border: '1.5px solid var(--border-color)', borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 46
            }}>Cancelar</button>}
          </div>
        </form>
      </div>


      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 16, padding: 16
      }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 4 }}>
          {['Todas', ...categorias].map(categoria => <button key={categoria} onClick={() => setCategoriaFiltro(categoria)} style={{ flexShrink: 0, minHeight: 40, padding: '8px 13px', borderRadius: 20, border: categoriaFiltro === categoria ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)', background: categoriaFiltro === categoria ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: categoriaFiltro === categoria ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{categoria}</button>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Cadastrados
            <span style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              {filtrados.length}
            </span>
          </h3>
          <input placeholder="Filtrar..." value={filtro}
            onChange={e => setFiltro(e.target.value)}
            style={{ ...inputStyle, width: 180, padding: '8px 12px', minHeight: 40 }} />
        </div>


        {filtrados.length === 0 ? <div style={{ textAlign: 'center', padding: 36, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum produto nesta categoria</div> : <div className="product-admin-grid">{filtrados.map(p => { const cat = corCategoria[p.categoria] || corCategoria.Outros; return <article key={p._id} className="product-admin-card"><div><span style={{ background: cat.bg, color: cat.txt, padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{p.categoria}</span><h4>{p.nome}</h4><span className="product-code">Código {p.codigo}</span></div><div className="product-admin-footer"><div><strong>R$ {Number(p.preco).toFixed(2).replace('.', ',')}</strong><small className={p.estoque <= 5 ? 'low-stock' : ''}>{p.estoque} em estoque</small></div><div className="product-card-actions"><button onClick={() => alterar(p)} style={btnTable}>Editar</button><button onClick={() => remover(p._id)} style={{ ...btnTable, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-bg)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>Excluir</button></div></div></article>; })}</div>}
      </div>


      <style>{`
        @media (min-width: 640px) {
          .form-grid-prod { grid-template-columns: 1fr 1fr !important; }
        }
        @media (min-width: 1024px) {
          .form-grid-prod { grid-template-columns: 1fr 2fr 1fr 1fr 1fr 1fr !important; }
        }
        .product-admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
        .product-admin-card { min-height: 150px; display: flex; flex-direction: column; padding: 14px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--bg-tertiary); }
        .product-admin-card h4 { margin: 12px 0 4px; color: var(--text-primary); font-size: 14px; line-height: 1.3; }
        .product-code { color: var(--text-secondary); font-family: monospace; font-size: 11px; }
        .product-admin-footer { display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin-top: auto; padding-top: 16px; }
        .product-admin-footer > div:first-child { min-height: 38px; display: flex; flex-direction: column; justify-content: flex-end; }
        .product-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
        .product-card-actions button { width: 100%; min-height: 36px; margin: 0 !important; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; }
        .product-admin-footer strong { display: block; color: var(--accent-primary); font-size: 17px; }
        .product-admin-footer small { display: block; color: var(--text-secondary); font-size: 11px; margin-top: 3px; }
        .product-admin-footer .low-stock { color: var(--error-bg); font-weight: 700; }
      `}</style>
    </div>
  );
}


const corCategoria = {
  'Bebidas Quentes': { bg: 'rgba(169,79,43,.14)', txt: '#8f3f20' },
  'Bebidas geladas': { bg: 'rgba(61,139,140,.14)', txt: '#267477' },
  Salgados: { bg: 'rgba(210,137,48,.16)', txt: '#9a6417' },
  Doces: { bg: 'rgba(190,104,120,.14)', txt: '#9d4e61' },
  'Café da manhã': { bg: 'rgba(126,157,107,.16)', txt: '#547642' },
  'Grãos e insumos': { bg: 'rgba(117,93,69,.14)', txt: '#73583f' },
  Outros: { bg: 'rgba(100,116,139,.12)', txt: '#64748b' }
};


const inputStyle = {
  width: '100%', padding: '12px 14px', border: '1.5px solid var(--border-color)',
  borderRadius: 10, fontSize: 16, boxSizing: 'border-box',
  outline: 'none', background: 'var(--input-bg)', color: 'var(--input-text)', minHeight: 48
};


const btnTable = {
  padding: '6px 12px', margin: '0 3px', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12,
  fontWeight: 600, cursor: 'pointer', minHeight: 34
};
