import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, ChefHat, ChevronLeft, ChevronRight, Clock, RefreshCw, UtensilsCrossed, WifiOff } from 'lucide-react';
import { kitchenDesktopQuery, kitchenPage, type KitchenOrder, type KitchenState } from './kitchen-model';
import './kitchen-queue.css';

export function KitchenQueue({ notify, onAccessChanged, onConnectionChanged }: { notify: (message: string) => void; onAccessChanged: () => Promise<void>; onConnectionChanged: (connected: boolean) => void }) {
  const [data, setData] = useState<KitchenState | null>(null);
  const [pageSize, setPageSize] = useState<2 | 4>(() => window.matchMedia(kitchenDesktopQuery).matches ? 4 : 2);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false), loading = useRef(false), sequence = useRef(0), applied = useRef(0), offset = useRef(0);
  const accept = useCallback((value: KitchenState, number: number) => {
    if (number < applied.current) return;
    applied.current = number; offset.current = value.serverTime - Date.now();
    setData(value); setNow(value.serverTime); setConnected(true); onConnectionChanged(true); setError('');
  }, [onConnectionChanged]);
  const load = useCallback(async () => {
    if (loading.current || busyRef.current) return;
    loading.current = true; const number = ++sequence.current;
    try {
      const response = await fetch('/api/kitchen', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const value = await response.json() as KitchenState & { error?: string };
      if (!response.ok) { if (response.status === 401 || response.status === 403) void onAccessChanged(); throw new Error(value.error || 'Não foi possível consultar a fila.'); }
      accept(value, number);
    } catch (e) {
      if (number >= applied.current) { setConnected(false); onConnectionChanged(false); setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'A fila está sem conexão. Tente atualizar.'); }
    } finally { loading.current = false; }
  }, [accept, onAccessChanged, onConnectionChanged]);
  useEffect(() => {
    void load(); const interval = setInterval(() => void load(), 3000);
    const focus = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', focus); window.addEventListener('online', load);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', focus); window.removeEventListener('online', load); };
  }, [load]);
  useEffect(() => { const interval = setInterval(() => setNow(Date.now() + offset.current), 1000); return () => clearInterval(interval); }, []);
  useEffect(() => {
    const media = window.matchMedia(kitchenDesktopQuery);
    const resize = () => { setPageSize(media.matches ? 4 : 2); setPage(0); };
    media.addEventListener('change', resize); return () => media.removeEventListener('change', resize);
  }, []);
  const callWaiter = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const number = ++sequence.current; applied.current = number;
    try {
      const response = await fetch('/api/kitchen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'kitchen-call' }), signal: AbortSignal.timeout(15000) });
      const value = await response.json() as KitchenState & { error?: string };
      if (!response.ok) { if (response.status === 401 || response.status === 403) void onAccessChanged(); throw new Error(value.error || 'Não foi possível chamar o garçom.'); }
      accept(value, number); notify('Garçons avisados para comparecer à cozinha.');
    } catch (e) {
      const message = e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Sem confirmação. Atualize a fila antes de tentar novamente.';
      setError(message); notify(message);
    } finally { busyRef.current = false; setBusy(false); void load(); }
  };
  const result = kitchenPage(data?.orders ?? [], page, pageSize);
  useEffect(() => { if (page !== result.page) setPage(result.page); }, [page, result.page]);
  const disabled = busy || !connected || data?.operationStatus === 'closed';
  return <section className="kitchen-queue" aria-label="Fila de pedidos da cozinha">
    <div className="queue-heading"><div><span className="eyebrow">PEDIDOS DO SALÃO</span><h1>Cozinha <span>{data?.orders.length ?? '—'}</span></h1><p>Fila de pedidos · {pageSize} por página</p></div><div className="queue-heading-actions"><button className="btn secondary queue-refresh" onClick={() => void load()} disabled={busy} aria-label="Atualizar fila"><RefreshCw size={17} /></button><button className="btn primary" onClick={() => void callWaiter()} disabled={disabled || !data || data.callPending}><Bell size={17} /><span>{data?.callPending ? 'Garçom avisado' : 'Chamar garçom'}</span></button></div></div>
    {error && <div className="queue-error" role="alert">{connected ? <AlertTriangle size={17} /> : <WifiOff size={17} />}<span>{error}</span><button onClick={() => void load()} disabled={busy}>Atualizar</button></div>}
    {data?.operationStatus === 'closed' && <p className="queue-closed"><CheckCircle2 size={17} />Expediente encerrado. Aguarde a administração iniciar o próximo.</p>}
    {!data ? <div className="queue-empty"><RefreshCw size={28} /><h2>{error ? 'Aguardando conexão.' : 'Buscando os pedidos.'}</h2><p>{error ? 'Atualize para consultar a fila atual.' : 'Carregando a fila da cozinha.'}</p></div> : !result.orders.length ? <div className="queue-empty"><ChefHat size={35} /><h2>Sem pedidos na fila.</h2><p>Novos pedidos aparecem aqui automaticamente.</p></div> : <div className={'queue-grid queue-page-' + pageSize}>{result.orders.map(order => <KitchenTicket key={order.id} order={order} now={now} />)}</div>}
    <div className="queue-pagination"><span role="status" aria-live="polite">{result.total ? `${result.start + 1}–${result.start + result.orders.length} de ${result.total} pedidos` : '0 pedidos'}<small>Atualização automática</small></span><div><button className="btn secondary" aria-label="Página anterior de pedidos" disabled={result.page === 0 || busy} onClick={() => setPage(result.page - 1)}><ChevronLeft size={18} /></button><strong>{result.page + 1} / {result.pageCount}</strong><button className="btn secondary" aria-label="Próxima página de pedidos" disabled={result.page + 1 >= result.pageCount || busy} onClick={() => setPage(result.page + 1)}><ChevronRight size={18} /></button></div></div>
  </section>;
}

function KitchenTicket({ order, now }: { order: KitchenOrder; now: number }) {
  const minutes = Math.max(0, Math.floor((now - order.created_at) / 60000));
  return <article className="queue-ticket" aria-label={'Pedido ' + order.number}>
    <div className="queue-ticket-heading"><div><span>Pedido</span><strong>#{order.number}</strong></div><div className="queue-ticket-status"><span className={minutes >= 20 ? 'queue-wait-long' : ''}><Clock size={13} />{minutes} min</span></div></div>
    <div className="queue-ticket-table"><UtensilsCrossed size={16} /><strong>Mesa {order.table_label}</strong><span>Assento {order.seat}</span></div>
    <ul className="queue-ticket-items" tabIndex={0} aria-label={'Itens do pedido ' + order.number}>{order.items.map((item, index) => <li key={index}><b>{item.quantity}×</b><span>{item.name}</span></li>)}</ul>
    {order.notes && <div className="queue-ticket-notes" tabIndex={0}><AlertTriangle size={14} /><p><strong>Observações</strong>{order.notes}</p></div>}
    <div className="queue-ticket-footer"><small>Garçom: <strong>{order.waiter}</strong></small><span className="queue-item-count">{order.items.reduce((sum, item) => sum + item.quantity, 0)} itens</span></div>
  </article>;
}
