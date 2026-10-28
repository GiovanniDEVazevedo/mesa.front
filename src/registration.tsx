import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock, Mail, RefreshCw, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react';
import { Dialog } from './ui';
import './registration.css';
import { roleLabels, type StaffRole } from './access-model';

type RegistrationProfile = {
  status: 'new' | 'pending' | 'approved' | 'rejected' | 'active' | 'disabled';
  email: string;
  name: string;
};
export type RegistrationRecord = { id: string; email: string; name: string; status: 'pending'; created_at: number };

export function RegistrationScreen({ email, retry }: { email: string; retry: () => void }) {
  const [profile, setProfile] = useState<RegistrationProfile | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/registration', { cache: 'no-store', signal: signal ?? AbortSignal.timeout(12000) });
      const data = await response.json() as RegistrationProfile & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível consultar seu cadastro.');
      setProfile(data); setName(data.name);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Confira sua conexão e tente novamente.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [email, load]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/registration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }), signal: AbortSignal.timeout(15000),
      });
      const data = await response.json() as RegistrationProfile & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar seu cadastro.');
      setProfile(data);
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Não recebemos a confirmação. Tente novamente; seu cadastro não será duplicado.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const pending = profile?.status === 'pending';
  const approved = profile?.status === 'active' || profile?.status === 'approved';
  const closed = profile?.status === 'rejected' || profile?.status === 'disabled';
  const title = loading ? 'Conferindo sua conta.' : pending ? 'Cadastro enviado.' : approved ? 'Sua equipe espera você.' : closed ? 'Converse com o administrador.' : 'Faça parte da equipe.';
  return <main className="access-screen registration-screen">
    <div className="access-brand">mesa<span>.</span></div>
    <article className="access-card registration-card" aria-busy={loading || busy}>
      <span className={'access-symbol ' + (pending ? 'registration-pending-icon' : '')}>{pending ? <Clock size={30} /> : approved ? <CheckCircle2 size={30} /> : <UserRoundPlus size={30} />}</span>
      <span className="eyebrow">SEU CADASTRO NO MESA</span>
      <h1>{title}</h1>
      <p>{loading ? 'Buscando os dados do seu acesso.' : pending ? 'O administrador recebeu sua solicitação. Assim que aprovar, você poderá começar seu turno.' : approved ? 'Seu acesso já foi liberado. Entre para começar.' : closed ? (profile.status === 'disabled' ? 'Seu acesso foi desativado. Somente um administrador pode liberá-lo novamente.' : 'Sua solicitação não foi aprovada. Fale com o responsável pelo restaurante.') : 'Confirme seu nome e solicite acesso ao restaurante. O administrador define sua responsabilidade.'}</p>
      {!loading && profile && <div className="registration-identity"><span className="registration-google" aria-hidden="true">G</span><div><strong>Conta Google conectada</strong><span>{profile.email}</span></div><ShieldCheck size={19} /></div>}
      {!loading && profile?.status === 'new' && <form className="registration-form" onSubmit={submit}>
        <label className="field" htmlFor="registration-name">Como você se chama?<div className="registration-input"><UserRound size={17} /><input id="registration-name" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={80} required disabled={busy} placeholder="Seu nome na equipe" /></div></label>
        <p className="registration-help">Seu e-mail vem da conta Google e não pode ser alterado neste formulário.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary full" type="submit" disabled={busy || name.trim().length < 2}>{busy ? <RefreshCw size={17} className="registration-spin" /> : <ArrowRight size={17} />}{busy ? 'Enviando cadastro…' : 'Solicitar acesso'}</button>
        <span className="registration-disclosure"><ShieldCheck size={15} />Seu cadastro só libera acesso após aprovação.</span>
      </form>}
      {!loading && profile?.status !== 'new' && <>
        {pending && <div className="registration-waiting" role="status"><span /><div><strong>Aguardando aprovação</strong><small>Você não precisa enviar outro cadastro.</small></div></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {profile && <button className="btn primary full" onClick={() => { void load(); retry(); }} disabled={busy}><RefreshCw size={16} />{approved ? 'Entrar no Mesa' : 'Verificar meu acesso'}</button>}
        {!profile && <button className="btn primary full" onClick={() => void load()}><RefreshCw size={16} />Tentar novamente</button>}
      </>}
      <a className="access-signout" href="/auth/logout" target="_top">Usar outra conta Google</a>
      <ol className="registration-steps" aria-label="Etapas do cadastro"><li className="done"><Check size={13} /><span>Conta Google</span></li><li className={pending || approved || closed ? 'done' : 'current'}><span className="step-number">2</span><span>Cadastro</span></li><li className={approved ? 'done' : ''}><span className="step-number">3</span><span>Aprovação</span></li></ol>
    </article>
    <span className="access-footnote">Seu restaurante. Cada atendimento no lugar certo.</span>
  </main>;
}

export function RegistrationRequests({ requests, busy, error, review, refresh }: {
  requests: RegistrationRecord[]; busy: boolean; error: string;
  review: (body: Record<string, unknown>) => Promise<boolean>; refresh: () => void;
}) {
  const [selected, setSelected] = useState<{ request: RegistrationRecord; approve: boolean } | null>(null);
  const [role, setRole] = useState<StaffRole>('waiter');
  const close = useCallback(() => { if (!busy) setSelected(null); }, [busy]);
  return <section className="registration-requests" aria-labelledby="registration-requests-title">
    <div className="registration-requests-heading"><div><span className="eyebrow">NOVAS PESSOAS NA EQUIPE</span><h3 id="registration-requests-title">Solicitações de cadastro <span>{requests.length}</span></h3><p>Confira a pessoa e escolha quais áreas ela poderá acessar.</p></div><button className="btn secondary" disabled={busy} onClick={refresh}><RefreshCw size={15} />Atualizar</button></div>
    {!requests.length ? <div className="registration-empty"><CheckCircle2 size={20} /><span>Nenhum cadastro aguardando análise.</span></div> : <div className="registration-request-list">{requests.map(request => <article key={request.id}>
      <span className="registration-avatar"><UserRound size={23} /></span><div className="registration-person"><strong>{request.name}</strong><span>{request.email}</span><small>Solicitado em {new Date(request.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</small></div>
      <div className="registration-request-actions"><button className="btn secondary" disabled={busy} onClick={() => setSelected({ request, approve: false })}>Recusar</button><button className="btn primary" disabled={busy} onClick={() => { setRole('waiter'); setSelected({ request, approve: true }); }}><Check size={15} />Analisar cadastro</button></div>
    </article>)}</div>}
    {selected && <Dialog title={selected.approve ? 'Liberar acesso à equipe.' : 'Recusar esta solicitação?'} eyebrow="ANÁLISE DE CADASTRO" onClose={close}>
      <div className="registration-review-person"><strong>{selected.request.name}</strong><span><Mail size={15} />{selected.request.email}</span></div>
      <form onSubmit={async event => { event.preventDefault(); if (busy) return; const ok = await review({ action: selected.approve ? 'approve-registration' : 'reject-registration', id: selected.request.id, ...(selected.approve ? { role } : {}) }); if (ok) setSelected(null); }}>
        {selected.approve ? <><label className="field" htmlFor="registration-role">Responsabilidade<select id="registration-role" value={role} onChange={e => setRole(e.target.value as StaffRole)} disabled={busy}><option value="waiter">Garçom</option><option value="kitchen">Cozinha</option><option value="admin">Administrador</option></select></label><p className="registration-role-help">{role === 'admin' ? 'Administrador acessa toda a operação, incluindo caixa, estoque, relatórios e gestão da equipe.' : role === 'kitchen' ? 'Cozinha acessa a fila de pedidos, inicia o preparo e marca pratos prontos. Não acessa caixa, estoque ou gestão da equipe.' : 'Garçom acessa mesas, comandas, consulta do cardápio, chamados e entregas.'}</p></> : <p className="dialog-subtitle">O cadastro não dará acesso ao restaurante. Você poderá cadastrar essa pessoa manualmente depois, se necessário.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className={'btn full ' + (selected.approve ? 'primary' : 'secondary')} disabled={busy}>{busy ? 'Salvando…' : selected.approve ? 'Aprovar como ' + roleLabels[role].toLowerCase() : 'Confirmar recusa'}</button>
      </form>
    </Dialog>}
  </section>;
}
