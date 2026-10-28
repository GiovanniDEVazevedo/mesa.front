import { type State, type Order, orderTotal, labels } from './model';

export type Period = 'today' | '7days' | '30days' | 'all' | 'custom';
export function dayKey(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(timestamp);
  const value = (type: string) => parts.find(p=>p.type===type)!.value;
  return value('year')+'-'+value('month')+'-'+value('day');
}
function shiftDay(day: string, amount: number) {
  return new Date(Date.parse(day+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
}
export function periodBounds(period: Period, now: number, customFrom = '', customTo = '') {
  const today = dayKey(now);
  if (period === 'custom') return {from:customFrom,to:customTo};
  return {from:period === 'all' ? '' : shiftDay(today,period === 'today' ? 0 : period === '7days' ? -6 : -29),to:today};
}
export function buildReport(state: State, bounds: {from:string;to:string}) {
  const inRange = (time: number) => { const key=dayKey(time); return (!bounds.from || key>=bounds.from) && (!bounds.to || key<=bounds.to); };
  const orders = state.orders.filter(o=>inRange(o.created_at));
  const valid = orders.filter(o=>o.status!=='canceled');
  const value = valid.reduce((s,o)=>s+orderTotal(o),0);
  const paid = state.accounts.filter(a=>a.status==='paid'&&a.paid_at!==null&&inRange(a.paid_at));
  const received = paid.reduce((s,a)=>s+(a.paid_total||0),0);
  const productMap = new Map<string,{id:string;name:string;quantity:number;value:number}>();
  const waiterMap = new Map<string,{name:string;count:number;value:number}>();
  for (const order of valid) {
    const name=state.accounts.find(a=>a.id===order.account_id)?.waiter || 'Sem garçom';
    const owner=waiterMap.get(name)||{name,count:0,value:0};owner.count++;owner.value+=orderTotal(order);waiterMap.set(name,owner);
    for (const i of order.items) {
      const p=productMap.get(i.product_id)||{id:i.product_id,name:i.name,quantity:0,value:0};
      p.quantity+=i.quantity;p.value+=i.price*i.quantity;productMap.set(i.product_id,p);
    }
  }
  const counts = ['pending','preparing','ready','collected','delivered','canceled'].map(status=>({status,count:orders.filter(o=>o.status===status).length}));
  const first=bounds.from || (orders.length ? orders.map(o=>dayKey(o.created_at)).sort()[0] : shiftDay(bounds.to||dayKey(Date.now()),-6));
  const last=bounds.to || dayKey(Date.now());
  const days=Math.max(0,Math.round((Date.parse(last+'T12:00:00Z')-Date.parse(first+'T12:00:00Z'))/86400000));
  const volume:{date:string;label:string;count:number}[]=[];
  if (days<=31) {
    for(let n=0;n<=days;n++) { const date=shiftDay(first,n);volume.push({date,label:date.slice(8,10)+'/'+date.slice(5,7),count:orders.filter(o=>dayKey(o.created_at)===date).length}); }
  } else {
    let date=first.slice(0,7);
    while(date<=last.slice(0,7) && volume.length<600) {
      volume.push({date,label:date.slice(5,7)+'/'+date.slice(0,4),count:orders.filter(o=>dayKey(o.created_at).startsWith(date)).length});
      const [year,month]=date.split('-').map(Number);date=new Date(Date.UTC(year,month,1)).toISOString().slice(0,7);
    }
  }
  return {orders,valid,value,received,paidCount:paid.length,average:valid.length?Math.round(value/valid.length):0,counts,products:[...productMap.values()].sort((a,b)=>b.quantity-a.quantity||b.value-a.value),waiters:[...waiterMap.values()].sort((a,b)=>b.value-a.value),volume,monthly:days>31};
}
export function buildOrdersCsv(state: State, orders: Order[]) {
  const cell=(value: unknown) => {
    const raw=String(value??'');
    return '"'+(/^\s*[=+\-@]/.test(raw) ? "'"+raw : raw).replaceAll('"','""')+'"';
  };
  const rows = [['Pedido','Data e hora (São Paulo)','Mesa','Assento','Cliente','Garçom','Status','Itens','Valor bruto (R$)','Valor considerado (R$)'],...orders.map(o=>{
    const a=state.accounts.find(a=>a.id===o.account_id),table=state.tables.find(t=>t.id===a?.table_id);
    const total=orderTotal(o);
    return [o.number,new Date(o.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),table?.label,a?.seat,a?.name,a?.waiter,labels[o.status],o.items.map(i=>i.quantity+'x '+i.name).join(' | '),(total/100).toFixed(2).replace('.',','),((o.status==='canceled'?0:total)/100).toFixed(2).replace('.',',')];
  })];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}
