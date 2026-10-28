'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Dialog, newId } from './ui';
import { AdminPanel, ReportsPanel } from './admin';
import { StockPanel } from './inventory';
import { AccessScreen, AccessPanel, DeliveriesPanel, KitchenPanel } from './operation-panels';
import type { Session, StaffUser } from './access-model';
import {
  LayoutGrid, ChefHat, ReceiptText, BookOpen, Bell, Plus, ChevronRight, Search, Users, Clock,
  Check, Armchair, ArrowRight, X, Minus, Send, WifiOff, RefreshCw, Volume2, VolumeX,
  CheckCircle2, CircleDollarSign, Coffee, Salad, Beef, Fish, Soup, GlassWater, Cookie,
  UtensilsCrossed, Flame, ArrowUpRight, HelpCircle, CreditCard, Banknote, ScanLine, MapPin, ShieldCheck, BarChart3, Pencil, Package, Smartphone, LogOut, CalendarCheck,
} from 'lucide-react';
import { type State, type Table, type Account, type Order, type Product, money, accountTotal, orderTotal, labels } from './model';

type View = 'salon' | 'kitchen' | 'accounts' | 'menu' | 'admin' | 'reports' | 'stock' | 'service' | 'access';
type Modal = { kind: 'guest'; tableId: string; seat: number } | { kind: 'order' } | { kind: 'account'; id: string } | { kind: 'pay'; id: string } | { kind: 'call' } | { kind: 'calls' } | { kind: 'help' } | { kind: 'table' } | null;
type Line = { productId: string; quantity: number };
type ApiResponse = State & { error?: string; result?: { id?: string } };
const nav = [
  { id: 'salon' as View, name: 'Salão e mesas', icon: LayoutGrid },
  { id: 'service' as View, name: 'Entregas', icon: Smartphone },
  { id: 'kitchen' as View, name: 'Botão da cozinha', icon: Bell },
  { id: 'accounts' as View, name: 'Comandas', icon: ReceiptText },
  { id: 'menu' as View, name: 'Cardápio', icon: BookOpen },
  { id: 'stock' as View, name: 'Estoque', icon: Package },
  { id: 'admin' as View, name: 'Admin', icon: ShieldCheck },
  { id: 'reports' as View, name: 'Relatórios', icon: BarChart3 },
  { id: 'access' as View, name: 'Equipe e botão', icon: Users },
];
const categories = ['Todos', 'Entradas', 'Principais', 'Bebidas', 'Sobremesas'];
const empty: State = { tables: [], accounts: [], orders: [], products: [], calls: [], audit: [], serverTime: 0 };
function elapsed(time: number, now: number) { return Math.max(0, Math.floor((now - time) / 60000)); }
function initials(name: string) { return name.slice(0, 2).toUpperCase(); }
function FoodIcon({ product }: { product: Product }) {
  const Icon = product.category === 'Bebidas' ? (product.id === 'p9' ? GlassWater : Coffee) : product.category === 'Sobremesas' ? Cookie : product.id === 'p6' ? Fish : product.id === 'p5' ? Soup : product.category === 'Entradas' ? Salad : Beef;
  return <div className={'food-art food-' + product.category}><Icon size={33} strokeWidth={1.4} /><span className="food-dot" /><span className="food-ring" /></div>;
}
export default function Home() {
  const [session,setSession]=useState<Session|null>(null);
  const refreshSession=useCallback(async()=>{try{const response=await fetch('/api/session',{cache:'no-store',signal:AbortSignal.timeout(12000)});const data=await response.json() as Session;setSession(data);}catch{setSession({status:'error',error:'Confira sua conexão e tente novamente.'});}},[]);
  useEffect(()=>{void refreshSession();const interval=setInterval(()=>void refreshSession(),15000);return()=>clearInterval(interval);},[refreshSession]);
  if(session?.status!=='active')return <AccessScreen session={session} retry={()=>void refreshSession()}/>;
  return <Operation key={session.user.id+session.user.role} user={session.user} onAccessChanged={refreshSession}/>;
}
function Operation({user,onAccessChanged}:{user:StaffUser;onAccessChanged:()=>Promise<void>}) {
  const [state, setState] = useState<State>(empty);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>('salon');
  const [tableId, setTableId] = useState('t03');
  const person=user.name;
  const isAdmin=user.role==='admin';
  const allowedNav=nav.filter(n=>isAdmin||['salon','service','accounts','menu'].includes(n.id));
  const waiters=Array.from(new Set([person,...(state.staffNames||[]),...state.accounts.map(a=>a.waiter)]));
  const draftKey='mesa-draft-v2:'+user.id;
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState('');
  const [area, setArea] = useState('Todos os ambientes');
  const [tableFilter, setTableFilter] = useState('Todas');
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('Abertas');
  const [category, setCategory] = useState('Todos');
  const [cart, setCart] = useState<Line[]>([]);
  const [cartAccount, setCartAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const busyRef = useRef(false);
  const loading = useRef(false);
  const seq = useRef(0);
  const applied = useRef(0);
  const audio = useRef<AudioContext | null>(null);
  const callsSeen = useRef<Set<string> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftId = useRef('');

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 6000);
  }, []);
  const beep = useCallback(() => {
    const context = audio.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(0.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.5);
  }, []);
  const load = useCallback(async () => {
    if (loading.current || busyRef.current) return;
    loading.current = true;
    const number = ++seq.current;
    try {
      const result = await fetch('/api/restaurant', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const data = await result.json() as ApiResponse;
      if (!result.ok) {if(result.status===401||result.status===403)void onAccessChanged();throw new Error(data.error);}
      if (number >= applied.current) { applied.current = number; setState(data); setLoaded(true); setOnline(true); }
    } catch { if (number >= applied.current) setOnline(false); }
    finally { loading.current = false; }
  }, [onAccessChanged]);
  useEffect(() => {
    void load();
    const interval = setInterval(() => { setNow(Date.now()); void load(); }, 3000);
    const focus = () => { if (!document.hidden) void load(); };
    window.addEventListener('online', load);
    document.addEventListener('visibilitychange', focus);
    return () => { clearInterval(interval); window.removeEventListener('online', load); document.removeEventListener('visibilitychange', focus); };
  }, [load]);
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft && Array.isArray(draft.cart)) { setCart(draft.cart); setCartAccount(draft.account || ''); setNotes(draft.notes || ''); draftId.current = draft.id || ''; }
    } catch { /* A damaged local draft must never prevent access to the operation. */ }
    setDraftReady(true);
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ cart, account: cartAccount, notes, id: draftId.current })); } catch { /* Server-side records are unaffected by device storage availability. */ }
  }, [cart, cartAccount, notes, draftReady, draftKey]);
  useEffect(() => {
    if (!loaded) return;
    const pending = state.calls.filter(c => c.status === 'pending');
    const fresh = callsSeen.current && pending.filter(c => !callsSeen.current!.has(c.id) && (c.waiter === person || c.waiter === 'Todos'));
    callsSeen.current = new Set(state.calls.map(c => c.id));
    if (fresh && fresh.length) { notify('Novo chamado da operação. Confira os avisos.'); if (sound) beep(); }
  }, [state.calls, loaded, person, sound, beep, notify]);
  const close = useCallback(() => { if (!busyRef.current) setModal(null); }, []);
  const mutate = async (body: Record<string, unknown>, message?: string): Promise<any> => {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(true);
    const number = ++seq.current;
    try {
      const result = await fetch('/api/restaurant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(16000) });
      const data = await result.json() as ApiResponse;
      if (!result.ok) {if(result.status===401||result.status===403)void onAccessChanged();throw new Error(data.error || 'Não foi possível confirmar a operação.');}
      applied.current = number; setState(data); setOnline(true);
      if (message) notify(message);
      return data.result || {};
    } catch (error) { notify(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Sem confirmação do servidor. Seu rascunho foi mantido; tente novamente.'); return null; }
    finally { busyRef.current = false; setBusy(false); void load(); }
  };
  const active = state.accounts.filter(a => a.status === 'open');
  const selectedTable = state.tables.find(t => t.id === tableId) || state.tables[0];
  const tableAccounts = active.filter(a => a.table_id === selectedTable?.id).sort((a,b) => a.seat-b.seat);
  const pendingCalls = state.calls.filter(c => c.status === 'pending');
  const myCalls = pendingCalls.filter(c => c.waiter === person || c.waiter === 'Todos');
  const activeOrders = state.orders.filter(o => ['pending','preparing','ready','collected'].includes(o.status));
  const usedTables = new Set(active.map(a => a.table_id)).size;
  const readyOrders = state.orders.filter(o => o.status === 'ready');
  const openTotal = active.reduce((sum,a) => sum + accountTotal(state,a.id),0);
  const totalSeats = state.tables.reduce((n,t) => n+t.seats,0);
  const displayTables = state.tables.filter(t => {
    const people = active.filter(a => a.table_id === t.id);
    return (area === 'Todos os ambientes' || t.area === area) && (tableFilter === 'Todas' || (tableFilter === 'Disponíveis' ? people.length < t.seats : people.length > 0)) && (!search || (t.label + ' mesa ' + people.map(a => a.name).join(' ')).toLowerCase().includes(search.toLowerCase()));
  });
  const tableLabel = (id: string) => state.tables.find(t => t.id === id)?.label || '—';
  const changeStatus = (order: Order, status: string) => mutate({ action: status==='collected'?'pickup-order':status==='delivered'?'deliver-order':'order-status', id: order.id, status, version: order.version }, status === 'ready' ? 'Pedido pronto. O garçom foi avisado.' : status === 'delivered' ? 'Entrega confirmada.' : status === 'canceled' ? 'Pedido cancelado antes do preparo.' : 'Preparo iniciado.');
  const startOrder = (account?: string) => {
    const candidate = account || (cart.length && active.some(a => a.id === cartAccount) ? cartAccount : tableAccounts[0]?.id || active[0]?.id || '');
    if (!candidate) { setModal({ kind: 'guest', tableId: selectedTable?.id || '', seat: 1 }); return; }
    if (candidate !== cartAccount) draftId.current = '';
    setCartAccount(candidate); setModal({ kind: 'order' });
  };
  const adjustCart = (id: string, delta: number) => {
    draftId.current = '';
    setCart(current => {
      const line = current.find(i => i.productId === id);
      if (!line && delta > 0) return [...current, { productId: id, quantity: 1 }];
      return current.map(i => i.productId === id ? { ...i, quantity: Math.min(20, i.quantity + delta) } : i).filter(i => i.quantity > 0);
    });
  };
  const toggleSound = async () => {
    if (!sound) {
      try { if (!audio.current) audio.current = new AudioContext(); await audio.current.resume(); setSound(true); notify('Aviso sonoro ativado neste dispositivo.'); }
      catch { notify('Este navegador não permitiu ativar o som.'); }
    } else setSound(false);
  };
  const pageTitles: Record<View, [string,string]> = {
    salon: ['Seu salão, em sintonia.', 'Cada mesa no seu ritmo. Cada cliente com a sua conta.'],
    kitchen: ['Um toque conecta a equipe.', 'O chamado nasce na cozinha. A retirada e a entrega ficam com o garçom.'],
    service: ['Cada prato, no lugar certo.', 'Confira a mesa, retire na cozinha e registre a entrega ao cliente.'],
    access: ['Sua equipe, suas responsabilidades.', 'Acessos por pessoa e conexão do botão da cozinha.'],
    accounts: ['Cada cliente, sua comanda.', 'Consumo individual, mesmo quando a mesa é compartilhada.'],
    menu: ['O que a casa tem de melhor.', isAdmin?'Consulte o cardápio e ajuste a disponibilidade dos produtos.':'Consulte os produtos e os preços para anotar o pedido.'],
    admin: ['A casa, do seu jeito.', 'Cardápio, pedidos e alterações. Tudo sob controle.'],
    reports: ['Seu movimento, em números.', 'Pedidos, produtos e recebimentos para decidir com clareza.'],
    stock: ['Da compra à cozinha.', 'Seus insumos organizados, do mercado à próxima receita.'],
  };
  const dayClosed=state.operationStatus==='closed';
  const disabled = busy || !online || (dayClosed&&['salon','service','accounts','menu','kitchen'].includes(view));
  const navigate = (next: View) => { setView(next); setSearch(''); window.scrollTo({top:0,behavior:'auto'}); };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="mesa, início"><span className="brand-symbol"><UtensilsCrossed size={23} /></span>mesa<span className="brand-point">.</span></a>
      <div className="restaurant"><span className="restaurant-icon"><Flame size={20} /></span><div><strong>Seu restaurante</strong><span>Ambiente de validação</span></div><ChevronRight size={16} /></div>
      <span className="nav-label">OPERAÇÃO</span>
      <nav aria-label="Navegação principal">{allowedNav.map(n => <button key={n.id} className={'nav-item ' + (view === n.id ? 'active' : '')} onClick={() => navigate(n.id)}><n.icon size={20} /><span>{n.name}</span>{n.id === 'kitchen' && activeOrders.length > 0 && <b>{activeOrders.length}</b>}{view === n.id && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-note"><span className="small-logo"><Armchair size={22} /></span><h3>Uma mesa.<br />Várias possibilidades.</h3><p>Clientes diferentes, lugares definidos e contas independentes.</p><button onClick={() => setModal({ kind: 'help' })}>Conheça o fluxo <ArrowUpRight size={15} /></button></div>
      <div className="sidebar-bottom"><button className="help-link" onClick={() => setModal({ kind: 'help' })}><HelpCircle size={18} />Como funciona</button><div className="sidebar-status"><span className={online ? 'live-dot' : 'offline-dot'} /><span>{online ? 'Operação conectada' : 'Conexão interrompida'}</span></div><span className="sidebar-version">mesa. / salão & gestão</span></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">Operação <ChevronRight size={13} /><strong>{nav.find(n => n.id === view)?.name}</strong></div><div className="topbar-right"><span className="demo-label">OPERAÇÃO MESA</span><button className={'sound-btn icon-btn ' + (sound ? 'sound-on' : '')} onClick={toggleSound} aria-label={sound ? 'Desativar aviso sonoro' : 'Ativar aviso sonoro'} title="Aviso sonoro neste dispositivo">{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><button className="notification-btn icon-btn" onClick={() => setModal({ kind: 'calls' })} aria-label={'Chamados da cozinha: ' + pendingCalls.length}><Bell size={20} />{pendingCalls.length > 0 && <span className="notification-dot" />}</button><span className="topbar-divider" /><div className="operator-avatar">{initials(person)}</div><div className="operator-label"><span>{isAdmin?'Administrador':'Garçom'}</span><strong>{person}</strong></div><a className="icon-btn signout-btn" href="/auth/logout" target="_top" aria-label="Sair da conta"><LogOut size={18}/></a></div></header>

      <div className="main-content">
        {dayClosed&&<div className="operation-closed-banner"><CalendarCheck size={20}/><div><strong>Expediente finalizado.</strong><span>O administrador pode iniciar um novo expediente em Admin → Fechamento do dia. O relatório anterior permanece salvo.</span></div></div>}
        {!online && <div className="network-banner"><WifiOff size={19} /><div><strong>Não conseguimos confirmar a conexão.</strong><span>Os pedidos só são enviados com confirmação. Seu rascunho fica salvo neste dispositivo.</span></div><button onClick={() => void load()}><RefreshCw size={15} />Reconectar</button></div>}
        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot" />{new Date(now).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })}</div><h1>{pageTitles[view][0]}</h1><p>{pageTitles[view][1]}</p></div>{!['admin','reports','stock','access','service','kitchen'].includes(view) && <button className="btn primary" disabled={!loaded || disabled} onClick={() => view === 'kitchen' ? setModal({ kind: 'call' }) : startOrder()}>{view === 'kitchen' ? <Bell size={18} /> : <Plus size={19} />}{view === 'kitchen' ? 'Chamar garçom' : 'Novo pedido'}{cart.length > 0 && view !== 'kitchen' && <span className="cart-count">{cart.reduce((s,i) => s+i.quantity,0)}</span>}</button>}</div>

        {myCalls.length > 0 && !['kitchen','admin','reports','stock','access'].includes(view) && <button className="call-banner" onClick={() => setModal({ kind: 'calls' })}><span className="call-banner-icon"><Bell size={18} /></span><span><strong>Você tem um chamado</strong><span>{myCalls[0].reason}{myCalls[0].table_id && ' · Mesa ' + tableLabel(myCalls[0].table_id)}</span></span><span className="call-banner-cta">Ver chamado <ArrowRight size={16} /></span></button>}

        {!['admin','reports','stock','access','service','kitchen'].includes(view) && <section className="stats" aria-label="Resumo da operação">
          <div className="stat"><div className="stat-label">Mesas em uso<span className="stat-icon orange"><LayoutGrid size={18} /></span></div><strong>{loaded ? usedTables : '—'}<small>/ {state.tables.length || '—'}</small></strong><span className="stat-caption"><span className="tiny-dot green" />{loaded ? state.tables.length-usedTables : '—'} mesas livres</span></div>
          <div className="stat"><div className="stat-label">Clientes no salão<span className="stat-icon blue"><Users size={18} /></span></div><strong>{loaded ? String(active.length).padStart(2,'0') : '—'}<small>pessoas</small></strong><span className="stat-caption">{loaded ? totalSeats-active.length : '—'} assentos disponíveis</span></div>
          <div className="stat"><div className="stat-label">Pedidos em andamento<span className="stat-icon yellow"><ChefHat size={19} /></span></div><strong>{loaded ? String(activeOrders.length).padStart(2,'0') : '—'}<small>pedidos</small></strong><button className="stat-link" onClick={() => navigate('service')}>{readyOrders.length} prontos para servir <ArrowUpRight size={13} /></button></div>
          <div className="stat"><div className="stat-label">Total em aberto<span className="stat-icon green"><ReceiptText size={18} /></span></div><strong className="stat-money">{loaded ? money(openTotal) : '—'}</strong><span className="stat-caption">{active.length} comandas individuais</span></div>
        </section>}

        {!loaded ? <div className="loading-panel"><span className="loader" /><h3>{online ? 'Preparando o salão…' : 'Aguardando conexão'}</h3><p>{online ? 'Conectando mesas, comandas e cozinha.' : 'Use Reconectar para tentar novamente.'}</p></div> : <>
          {view === 'admin' && <AdminPanel state={state} disabled={disabled} mutate={mutate} onAccount={id => setModal({kind:'account',id})} onReports={() => navigate('reports')} onOperationChanged={()=>void load()} />}
          {view === 'reports' && <ReportsPanel state={state} now={now} />}
          {view === 'stock' && <StockPanel />}
          {view === 'salon' && <section className="salon-layout"><div className="floor">
            <div className="section-heading"><div><h2>Mapa de mesas <span className="count-pill">{state.tables.length}</span></h2><p>Selecione uma mesa ou toque em um assento.</p></div><div className="map-legend"><span><i className="legend-free" />Livre</span><span><i className="legend-used" />Ocupado</span></div></div>
            <div className="floor-toolbar"><div className="segments">{['Todas','Em uso','Disponíveis'].map(f => <button key={f} className={tableFilter === f ? 'selected' : ''} onClick={() => setTableFilter(f)}>{f}</button>)}</div><label className="search"><Search size={16} /><input aria-label="Buscar mesa ou cliente" placeholder="Buscar mesa…" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
            <div className="area-tabs">{['Todos os ambientes', ...new Set(state.tables.map(t => t.area))].map(a => <button key={a} className={area === a ? 'active' : ''} onClick={() => setArea(a)}>{a}</button>)}</div>
            <div className="table-grid">{displayTables.map(table => {
              const people = active.filter(a => a.table_id === table.id), count = people.length, full = count === table.seats;
              const amount = people.reduce((s,a) => s+accountTotal(state,a.id),0);
              const top = Math.ceil(table.seats/2);
              const chair = (seat: number) => {
                const account = people.find(a => a.seat === seat);
                return <button key={seat} className={'seat ' + (account ? 'occupied' : 'free')} title={'Assento ' + seat + (account ? ' · ' + account.name : ' · Livre')} aria-label={'Mesa ' + table.label + ', assento ' + seat + (account ? ', ' + account.name : ', livre')} disabled={disabled} onClick={e => { e.stopPropagation(); setTableId(table.id); setModal(account ? { kind: 'account', id: account.id } : { kind: 'guest', tableId: table.id, seat }); }}>{seat}</button>;
              };
              return <article key={table.id} className={'table-card ' + (table.id === selectedTable?.id ? 'table-selected' : '')} onClick={() => setTableId(table.id)}>
                <div className="table-card-head"><span className={'occupancy-label ' + (count ? 'in-use' : 'is-free')}><i />{full ? 'Completa' : count ? 'Em uso' : 'Livre'}</span><button className="table-detail-btn" aria-label={'Selecionar mesa ' + table.label} onClick={() => setTableId(table.id)}><ArrowUpRight size={15} /></button></div>
                <div className="table-plan"><div className="seat-row">{Array.from({ length: top },(_,i) => chair(i+1))}</div><button className="table-surface" onClick={() => setTableId(table.id)} aria-label={'Detalhes da mesa ' + table.label}><span>MESA</span><strong>{table.label}</strong>{count > 1 && <span className="table-shared"><Users size={10} />Compartilhada</span>}</button><div className="seat-row bottom-seats">{Array.from({ length: table.seats-top },(_,i) => chair(top+i+1))}</div></div>
                <div className="table-card-foot"><span><Users size={13} />{count}/{table.seats} lugares</span><strong>{count ? money(amount) : <span className="available-caption">Disponível</span>}</strong></div>
              </article>;
            })}{isAdmin&&<button className="new-table" disabled={disabled} onClick={() => setModal({ kind: 'table' })}><span><Plus size={22} /></span><strong>Adicionar mesa</strong><small>Organize seu espaço</small></button>}</div>
            {displayTables.length === 0 && <div className="empty-state"><Search size={28} /><h3>Nenhuma mesa encontrada</h3><p>Experimente outro filtro ou nome de cliente.</p></div>}
            <div className="floor-foot"><MapPin size={14} /><span>{totalSeats} assentos em {state.tables.length} mesas</span><span className="sync-note"><span className={online ? 'live-dot' : 'offline-dot'} />{online ? 'Sincronização a cada 3 s' : 'Sem conexão'}</span></div>
          </div>
          {selectedTable && <aside className="table-panel"><div className="detail-header"><div><span className="eyebrow">VISÃO DA MESA</span><h2>Mesa {selectedTable.label}</h2><p>{selectedTable.area} <span>·</span> {selectedTable.seats} lugares</p></div><span className="detail-table-icon"><Armchair size={25} strokeWidth={1.4} /></span></div>
            <div className="capacity-meter"><div><span>{tableAccounts.length} ocupados</span><strong>{selectedTable.seats-tableAccounts.length} livres</strong></div><div className="capacity-track">{Array.from({ length: selectedTable.seats },(_,i) => <span key={i} className={i < tableAccounts.length ? 'filled' : ''} />)}</div></div>
            <div className="panel-section-title"><h3>Contas desta mesa</h3><span>{tableAccounts.length} abertas</span></div>
            <div className="seat-list">{Array.from({ length: selectedTable.seats },(_,i) => {
              const account = tableAccounts.find(a => a.seat === i+1);
              const ready = account && state.orders.some(o => o.account_id === account.id && o.status === 'ready');
              return <button key={i} className={'seat-person ' + (!account ? 'seat-person-free' : '')} disabled={disabled} onClick={() => setModal(account ? { kind: 'account', id: account.id } : { kind: 'guest', tableId: selectedTable.id, seat: i+1 })}><span className={'seat-avatar ' + (!account ? 'empty-avatar' : '')}>{account ? initials(account.name) : <Plus size={15} />}</span><span><strong>{account?.name || 'Assento livre'}</strong><small>Assento {String(i+1).padStart(2,'0')}{ready && <span className="ready-dot"> · Pronto para servir</span>}</small></span><span className="seat-person-value">{account ? money(accountTotal(state,account.id)) : 'Adicionar'}<ChevronRight size={14} /></span></button>;
            })}</div>
            <div className="individual-note"><ReceiptText size={17} /><p>Cada assento tem uma comanda.<br /><strong>Mesma mesa, contas separadas.</strong></p></div>
            <div className="table-summary"><span>Total da mesa</span><strong>{money(tableAccounts.reduce((s,a) => s+accountTotal(state,a.id),0))}</strong></div>
            <button className="btn primary full" disabled={disabled} onClick={() => startOrder(tableAccounts[0]?.id)}><Plus size={17} />{tableAccounts.length ? 'Fazer pedido nesta mesa' : 'Adicionar primeiro cliente'}</button>
          </aside>}
          </section>}

          {view==='kitchen'&&isAdmin&&<KitchenPanel disabled={disabled} mutate={mutate} pending={pendingCalls.some(c=>!c.table_id&&c.waiter==='Todos')} onSetup={()=>navigate('access')}/>}
          {view==='service'&&<DeliveriesPanel state={state} user={user} disabled={disabled} mutate={mutate}/>}
          {view==='access'&&isAdmin&&<AccessPanel user={user} notify={notify}/>}

          {view === 'accounts' && <section><div className="section-heading"><div><h2>Comandas individuais</h2><p>O fechamento libera somente o assento daquele cliente.</p></div><label className="search account-search"><Search size={16} /><input placeholder="Cliente ou mesa…" aria-label="Buscar comanda por cliente ou mesa" value={search} onChange={e => setSearch(e.target.value)} /></label></div><div className="account-toolbar"><div className="segments">{['Abertas','Encerradas'].map(f => <button key={f} className={accountFilter === f ? 'selected' : ''} onClick={() => setAccountFilter(f)}>{f}<span>{state.accounts.filter(a => (f === 'Abertas' ? a.status === 'open' : a.status === 'paid')).length}</span></button>)}</div><span className="muted"><ReceiptText size={15} />Contas sempre separadas por cliente</span></div><div className="account-grid">{state.accounts.filter(a => (accountFilter === 'Abertas' ? a.status === 'open' : a.status === 'paid') && (!search || (a.name + ' mesa ' + tableLabel(a.table_id)).toLowerCase().includes(search.toLowerCase()))).map(a => {
            const orders = state.orders.filter(o => o.account_id === a.id && o.status !== 'canceled'), inProgress = orders.filter(o => !['delivered','canceled'].includes(o.status)).length;
            return <article className="account-card" key={a.id}><div className="account-card-top"><span className="seat-avatar">{initials(a.name)}</span><span className={'badge ' + (a.status === 'open' ? 'pending' : 'delivered')}><span />{a.status === 'open' ? 'Em aberto' : 'Encerrada'}</span></div><h3>{a.name}</h3><p>Mesa {tableLabel(a.table_id)}<span>·</span>Assento {String(a.seat).padStart(2,'0')}</p><div className="account-card-summary"><span>{orders.reduce((s,o) => s+o.items.reduce((n,i) => n+i.quantity,0),0)} itens consumidos</span><strong>{money(a.paid_total ?? accountTotal(state,a.id))}</strong></div><div className="account-card-meta"><span><Users size={13} />{a.waiter}</span><span>{a.status === 'paid' ? a.payment_method : inProgress ? inProgress + ' pedido(s) em andamento' : 'Sem pedidos pendentes'}</span></div><button className="btn secondary full" onClick={() => setModal({ kind: 'account', id: a.id })}>Ver comanda <ArrowRight size={15} /></button></article>;
          })}</div>{state.accounts.filter(a => accountFilter === 'Abertas' ? a.status === 'open' : a.status === 'paid').length === 0 && <div className="empty-state"><ReceiptText size={32} /><h3>Nenhuma comanda por aqui</h3><p>{accountFilter === 'Abertas' ? 'Adicione um cliente a um assento para começar.' : 'Os pagamentos registrados aparecerão aqui.'}</p></div>}</section>}

          {view === 'menu' && <section><div className="section-heading"><div><h2>Cardápio da casa <span className="count-pill">{state.products.length}</span></h2><p>Um item indisponível deixa de aceitar novos pedidos.</p></div><span className="muted"><CheckCircle2 size={16} />Preços por unidade</span></div><div className="category-tabs">{categories.map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="menu-grid">{state.products.filter(p => category === 'Todos' || p.category === category).map(product => <article key={product.id} className={'menu-card ' + (!product.available ? 'unavailable' : '')}><FoodIcon product={product} /><div className="menu-category">{product.category}</div><h3>{product.name}</h3><p>{product.description}</p><div className="menu-card-bottom"><strong>{money(product.price)}</strong><button role="switch" aria-checked={Boolean(product.available)} aria-label={'Disponibilidade de ' + product.name} className={'availability ' + (product.available ? 'on' : '')} disabled={disabled||!isAdmin} onClick={() => void mutate({ action: 'product-availability', id: product.id, available: !product.available },product.available ? 'Item pausado no cardápio.' : 'Item disponível para novos pedidos.')}><span /><small>{product.available ? 'Disponível' : 'Pausado'}</small></button></div></article>)}</div></section>}
        </>}
        <footer className="main-footer"><span className="footer-brand">mesa.</span><span>Mais conexão. Menos idas e vindas.</span><span className="footer-right">Salão & cozinha, juntos.</span></footer>
      </div>
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel">{allowedNav.map(n => <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><n.icon size={21} /><span>{n.id === 'salon' ? 'Salão' : n.name}</span></button>)}</nav>
    {toast && <div className="toast" role="status"><CheckCircle2 size={19} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dispensar aviso"><X size={16} /></button></div>}

    {modal?.kind === 'guest' && <GuestDialog state={state} initial={modal} person={person} waiterOptions={waiters} canAssign={isAdmin} close={close} disabled={disabled} onSave={async data => { const result = await mutate(data,'Cliente adicionado. A comanda individual está aberta.'); if (result) { setTableId(String(data.tableId)); setModal({ kind: 'account', id: result.id }); } }} />}
    {modal?.kind === 'table' && <TableDialog close={close} disabled={disabled} onSave={async data => { const result = await mutate(data,'Mesa adicionada ao salão.'); if (result) { setTableId(result.id); setModal(null); setArea('Todos os ambientes'); } }} />}
    {modal?.kind === 'order' && <Dialog title="Um novo pedido, no lugar certo." eyebrow="DO SALÃO PARA A COZINHA" onClose={close} wide><div className="order-dialog-layout"><div className="order-catalog"><label className="field">Cliente e assento<select value={cartAccount} onChange={e => { setCartAccount(e.target.value); draftId.current = ''; }}><option value="">Selecione o cliente</option>{active.map(a => <option key={a.id} value={a.id}>{a.name} · Mesa {tableLabel(a.table_id)} · Assento {a.seat}</option>)}</select></label><div className="category-tabs compact">{categories.map(c => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><div className="catalog-list">{state.products.filter(p => category === 'Todos' || p.category === category).map(p => { const quantity = cart.find(i => i.productId === p.id)?.quantity || 0; return <div className={'catalog-product ' + (!p.available ? 'unavailable' : '')} key={p.id}><FoodIcon product={p} /><div><strong>{p.name}</strong><small>{p.available ? p.description : 'Indisponível no momento'}</small><b>{money(p.price)}</b></div>{quantity ? <div className="quantity"><button aria-label={'Diminuir ' + p.name} onClick={() => adjustCart(p.id,-1)}><Minus size={13} /></button><span>{quantity}</span><button aria-label={'Aumentar ' + p.name} disabled={quantity >= 20 || !p.available} onClick={() => adjustCart(p.id,1)}><Plus size={13} /></button></div> : <button className="add-product" aria-label={'Adicionar ' + p.name} disabled={!p.available} onClick={() => adjustCart(p.id,1)}><Plus size={17} /></button>}</div>; })}</div></div><div className="order-cart"><span className="eyebrow">RESUMO DO PEDIDO</span><h3>{active.find(a => a.id === cartAccount)?.name || 'Selecione o cliente'}</h3>{cart.length ? <div className="cart-items">{cart.map(i => { const p = state.products.find(p => p.id === i.productId); if (!p) return null; return <div key={i.productId}><span><b>{i.quantity}×</b>{p.name}</span><strong>{money(p.price*i.quantity)}</strong></div>; })}</div> : <div className="cart-empty"><UtensilsCrossed size={28} strokeWidth={1.3} /><p>O próximo prato<br />começa com a sua escolha.</p></div>}<label className="field">Observações para a cozinha<textarea maxLength={400} rows={3} value={notes} onChange={e => { setNotes(e.target.value); draftId.current = ''; }} placeholder="Ex.: sem cebola, ponto da carne…" /></label><div className="cart-total"><span>Total do pedido</span><strong>{money(cart.reduce((s,i) => s+(state.products.find(p => p.id === i.productId)?.price || 0)*i.quantity,0))}</strong></div><button className="btn primary full" disabled={disabled || !cart.length || !active.some(a => a.id === cartAccount)} onClick={async () => {
      if (!draftId.current) draftId.current = newId();
      try { localStorage.setItem(draftKey,JSON.stringify({ cart, account: cartAccount, notes, id: draftId.current })); } catch { /* The current tab keeps the draft in memory. */ }
      const result = await mutate({ action: 'create-order', id: draftId.current, accountId: cartAccount, items: cart, notes },'Pedido recebido na fila da cozinha.');
      if (result) { setCart([]); setNotes(''); draftId.current = ''; setModal(null); }
    }}><Send size={16} />{busy ? 'Confirmando envio…' : 'Enviar para a cozinha'}</button><span className="cart-note">A conta será vinculada somente a este cliente.</span></div></div></Dialog>}
    {modal?.kind === 'account' && (() => {
      const a = state.accounts.find(a => a.id === modal.id); if (!a) return null;
      const orders = state.orders.filter(o => o.account_id === a.id), total = accountTotal(state,a.id);
      const outstanding = orders.some(o => ['pending','preparing','ready','collected'].includes(o.status));
      return <Dialog title={a.name} eyebrow={'MESA ' + tableLabel(a.table_id) + ' · ASSENTO ' + String(a.seat).padStart(2,'0')} onClose={close}><div className="account-detail-info"><span><Users size={15} />Atendimento: {a.waiter}</span><span className={'badge ' + (a.status === 'open' ? 'pending' : 'delivered')}><span />{a.status === 'open' ? 'Conta em aberto' : 'Conta encerrada'}</span></div><div className="account-orders">{orders.length === 0 && <div className="empty-state small"><ReceiptText size={28} /><h3>Uma comanda novinha.</h3><p>O consumo deste cliente aparecerá aqui.</p></div>}{orders.map(o => <div key={o.id} className={'account-order ' + (o.status === 'canceled' ? 'canceled-order' : '')}><div className="account-order-head"><strong>Pedido #{o.number}</strong><Badge status={o.status} /></div>{o.items.map(i => <div key={i.id} className="bill-line"><span>{i.quantity}× {i.name}</span><b>{money(i.price*i.quantity)}</b></div>)}{o.notes && <p className="bill-notes">{o.notes}</p>}{['pending','preparing','ready'].includes(o.status) && <button className="btn success full" disabled={disabled} onClick={() => {setModal(null);navigate('service');}}><ChefHat size={16} />Conferir retirada</button>}{o.status==='collected'&&(isAdmin||o.picked_by===user.id)&&<button className="btn success full" disabled={disabled} onClick={()=>{setModal(null);navigate('service');}}>Conferir entrega na mesa</button>}{isAdmin && o.status === 'pending' && <button className="cancel-order" disabled={disabled} onClick={() => void changeStatus(o,'canceled')}>Cancelar pedido ainda na fila</button>}</div>)}</div><div className="bill-total"><span>Total individual<strong>Somente o consumo de {a.name}</strong></span><b>{money(a.paid_total ?? total)}</b></div>{a.status === 'open' ? <><div className="dialog-actions"><button className="btn secondary" disabled={disabled} onClick={() => startOrder(a.id)}><Plus size={16} />Mais itens</button><button className="btn primary" disabled={disabled || outstanding} onClick={() => setModal({ kind: 'pay', id: a.id })}><CircleDollarSign size={17} />{total ? 'Fechar comanda' : 'Liberar assento'}</button></div>{outstanding && <p className="payment-hint">Confirme as entregas ou cancele os pedidos ainda na fila para fechar esta conta.</p>}</> : <div className="paid-note"><CheckCircle2 size={19} /><span>{a.paid_total ? 'Pagamento registrado' : 'Encerrada sem consumo'} · {a.payment_method}<small>{a.paid_at && new Date(a.paid_at).toLocaleString('pt-BR',{ timeZone: 'America/Sao_Paulo' })}</small></span></div>}</Dialog>;
    })()}
    {modal?.kind === 'pay' && (() => { const account = state.accounts.find(a => a.id === modal.id); return account ? <PayDialog account={account} total={accountTotal(state,account.id)} table={tableLabel(account.table_id)} close={close} disabled={disabled} onPay={async method => { if (await mutate({ action: 'pay-account', id: account.id, method },'Comanda encerrada. Somente este assento foi liberado.')) setModal({ kind: 'account', id: account.id }); }} /> : null; })()}
    {modal?.kind === 'call' && <CallDialog state={state} close={close} disabled={disabled} onCall={async data => { if (await mutate(data,'Chamado enviado. Ele permanece visível até ser confirmado.')) setModal(null); }} />}
    {modal?.kind === 'calls' && <Dialog title="Chamados da operação." eyebrow="CONEXÃO COM A EQUIPE" onClose={close}><p className="dialog-subtitle">O primeiro garçom que confirmar assume o chamado. Depois, confira a retirada na área Entregas.</p><div className="calls-list">{pendingCalls.map(c => <article key={c.id} className="call-item"><span className="call-item-icon"><Bell size={19} /></span><div><strong>{c.reason}</strong><p>{c.table_id ? 'Mesa ' + tableLabel(c.table_id) + ' · ' : ''}{c.waiter === 'Todos' ? 'Qualquer garçom' : c.waiter} <span>· {elapsed(c.created_at,now)} min</span></p><button className="btn secondary" disabled={disabled} onClick={() => void mutate({ action: 'acknowledge-call', id: c.id },'Você assumiu o chamado. Confira os pedidos na área Entregas.')}><Check size={15} />Estou a caminho</button></div></article>)}{pendingCalls.length === 0 && <div className="empty-state"><CheckCircle2 size={34} /><h3>Equipe em sintonia.</h3><p>Nenhum chamado aguardando atendimento.</p></div>}</div></Dialog>}
    {modal?.kind === 'help' && <Dialog title="Do assento ao último prato." eyebrow="BEM-VINDO AO MESA." onClose={close}><p className="dialog-subtitle">Uma primeira versão para experimentar o fluxo completo do restaurante.</p><div className="help-steps">{[['01','Receba e acomode','No mapa, toque em um assento livre. Identifique o cliente e o garçom. Uma comanda individual será aberta.'],['02','Anote pelo celular','Escolha o cliente, adicione os pratos e envie. A cozinha recebe o pedido com mesa, assento e observações.'],['03','Prepare e chame','A cozinha usa um único botão para chamar um garçom. O chamado é geral e não altera nenhum pedido.'],['04','Sirva e feche','Na área Entregas, confira os pratos, registre a retirada e confirme ao servir na mesa. Feche cada comanda separadamente.']].map(s => <div key={s[0]}><span>{s[0]}</span><div><h3>{s[1]}</h3><p>{s[2]}</p></div></div>)}</div><div className="help-note"><strong>Para validar a operação</strong><p>Os registros ficam no servidor e as telas consultam atualizações a cada 3 segundos. Cada pessoa entra com sua própria conta. Garçons acessam o atendimento; administradores acessam toda a gestão. O botão físico exige equipamento e instalação. Pagamentos são registrados manualmente.</p></div><button className="btn primary full" onClick={close}>Vamos para o salão <ArrowRight size={16} /></button></Dialog>}
  </div>;
}

function GuestDialog({ state, initial, person, waiterOptions, canAssign, close, disabled, onSave }: { state: State; initial: { tableId: string; seat: number }; person: string; waiterOptions:string[]; canAssign:boolean; close: () => void; disabled: boolean; onSave: (data: Record<string, unknown>) => Promise<void> }) {
  const [name,setName] = useState(''), [tableId,setTableId] = useState(initial.tableId), [seat,setSeat] = useState(initial.seat), [owner,setOwner] = useState(person);
  const [id] = useState(() => newId());
  const table = state.tables.find(t => t.id === tableId);
  const taken = (number: number) => state.accounts.some(a => a.table_id === tableId && a.seat === number && a.status === 'open');
  return <Dialog title="Um lugar para cada cliente." eyebrow="ABRIR COMANDA INDIVIDUAL" onClose={close}><form onSubmit={e => { e.preventDefault(); void onSave({ action: 'open-account', id, name, tableId, seat, waiter: owner }); }}><label className="field">Nome do cliente<input autoComplete="off" placeholder="Como podemos chamar este cliente?" value={name} onChange={e => setName(e.target.value)} required maxLength={50} /></label><div className="form-row"><label className="field">Mesa<select value={tableId} onChange={e => { setTableId(e.target.value); const free = Array.from({length: state.tables.find(t => t.id === e.target.value)?.seats || 0},(_,i) => i+1).find(i => !state.accounts.some(a => a.table_id === e.target.value && a.seat === i && a.status === 'open')); setSeat(free || 0); }}>{state.tables.map(t => <option key={t.id} value={t.id}>Mesa {t.label} · {t.area}</option>)}</select></label><label className="field">Garçom responsável<select value={owner} disabled={!canAssign} onChange={e => setOwner(e.target.value)}>{waiterOptions.map(w => <option key={w}>{w}</option>)}</select></label></div><span className="field-label">Selecione o assento</span><div className="guest-seat-picker">{Array.from({length: table?.seats || 0},(_,i) => <button type="button" key={i} className={'guest-seat ' + (seat === i+1 ? 'selected' : '')} disabled={taken(i+1)} onClick={() => setSeat(i+1)}><Armchair size={22} /><strong>{String(i+1).padStart(2,'0')}</strong><small>{taken(i+1) ? 'Ocupado' : 'Livre'}</small></button>)}</div><div className="individual-note"><ReceiptText size={18} /><p>O consumo será registrado somente nesta comanda, mesmo com outros clientes na mesa.</p></div><button className="btn primary full" type="submit" disabled={disabled || !name.trim() || !seat || taken(seat)}><Plus size={17} />Abrir comanda e ocupar assento</button></form></Dialog>;
}
function TableDialog({ close, disabled, onSave }: { close: () => void; disabled: boolean; onSave: (data: Record<string,unknown>) => Promise<void> }) {
  const [label,setLabel] = useState(''), [seats,setSeats] = useState(4), [area,setArea] = useState('Salão principal');
  return <Dialog title="Mais espaço à mesa." eyebrow="CONFIGURAR SALÃO" onClose={close}><form onSubmit={e => { e.preventDefault(); void onSave({ action: 'add-table', label, seats, area }); }}><div className="form-row"><label className="field">Número da mesa<input type="number" min={1} max={99} required placeholder="Ex.: 09" value={label} onChange={e => setLabel(e.target.value)} /></label><label className="field">Quantidade de assentos<select value={seats} onChange={e => setSeats(Number(e.target.value))}>{[2,4,6,8].map(n => <option value={n} key={n}>{n} lugares</option>)}</select></label></div><label className="field">Ambiente<input value={area} required maxLength={40} onChange={e => setArea(e.target.value)} placeholder="Salão principal, varanda…" /></label><div className="individual-note"><Armchair size={18} /><p>Os assentos serão numerados e poderão receber clientes com contas separadas.</p></div><button type="submit" className="btn primary full" disabled={disabled}>Adicionar mesa <Plus size={17} /></button></form></Dialog>;
}
function PayDialog({ account, total, table, close, disabled, onPay }: { account: Account; total: number; table: string; close: () => void; disabled: boolean; onPay: (method: string) => Promise<void> }) {
  const [method,setMethod] = useState(total ? 'Pix' : 'Sem consumo');
  return <Dialog title={total ? 'Uma conta, um fechamento.' : 'Liberar este assento?'} eyebrow={'MESA ' + table + ' · ASSENTO ' + String(account.seat).padStart(2,'0')} onClose={close}><div className="payment-total"><span>{account.name}</span><strong>{money(total)}</strong><small>Consumo individual, sem taxa de serviço.</small></div>{total > 0 && <><span className="field-label">Forma de pagamento recebido</span><div className="payment-methods">{[{name:'Pix',icon:ScanLine},{name:'Cartão',icon:CreditCard},{name:'Dinheiro',icon:Banknote}].map(m => <button key={m.name} className={method === m.name ? 'selected' : ''} onClick={() => setMethod(m.name)}><m.icon size={23} />{m.name}{method === m.name && <Check size={13} />}</button>)}</div><p className="payment-hint">Registro manual: confirme o recebimento no Pix, na maquininha ou no caixa antes de continuar.</p></>}<div className="individual-note"><Armchair size={18} /><p>Apenas o assento de <strong>{account.name}</strong> será liberado. As outras comandas continuam abertas.</p></div><button className="btn primary full" disabled={disabled} onClick={() => void onPay(method)}><CheckCircle2 size={18} />{total ? 'Confirmar pagamento e liberar assento' : 'Encerrar sem consumo e liberar'}</button></Dialog>;
}
function CallDialog({ state, close, disabled, onCall }: { state: State; close: () => void; disabled: boolean; onCall: (data: Record<string,unknown>) => Promise<void> }) {
  const [tableId,setTableId] = useState(''), [owner,setOwner] = useState('Todos'), [reason,setReason] = useState('Preciso de apoio na cozinha');
  return <Dialog title="Pode vir à cozinha?" eyebrow="CHAMAR GARÇOM" onClose={close}><form onSubmit={e => { e.preventDefault(); void onCall({ action: 'call-waiter', tableId, waiter: owner, reason }); }}><div className="form-row"><label className="field">Quem você precisa?<select value={owner} onChange={e => setOwner(e.target.value)}>{['Todos',...Array.from(new Set(state.accounts.map(a=>a.waiter)))].map(w => <option key={w} value={w}>{w === 'Todos' ? 'Qualquer garçom' : w}</option>)}</select></label><label className="field">Mesa relacionada<select value={tableId} onChange={e => setTableId(e.target.value)}><option value="">Sem mesa específica</option>{state.tables.map(t => <option key={t.id} value={t.id}>Mesa {t.label}</option>)}</select></label></div><label className="field">Motivo do chamado<textarea rows={3} required maxLength={160} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="reason-presets">{['Pedido pronto para retirada','Confirmar uma observação','Preciso de apoio na cozinha'].map(r => <button key={r} type="button" className={r === reason ? 'selected' : ''} onClick={() => setReason(r)}>{r}</button>)}</div><p className="payment-hint">O aviso fica na tela do salão até um garçom confirmar que está a caminho.</p><button className="btn primary full" type="submit" disabled={disabled || !reason.trim()}><Bell size={18} />Enviar chamado</button></form></Dialog>;
}
