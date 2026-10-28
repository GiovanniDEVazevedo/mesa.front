export const stockUnits = ['kg','L','un','pct','cx'] as const;
export type StockUnit = typeof stockUnits[number];
export const defaultStockCategories = [
  {id:'meat',name:'Carnes',icon:'beef'}, {id:'grocery',name:'Mercearia',icon:'wheat'},
  {id:'produce',name:'Hortifruti',icon:'carrot'}, {id:'dairy',name:'Laticínios e ovos',icon:'milk'},
  {id:'drinks',name:'Bebidas',icon:'cup'}, {id:'frozen',name:'Congelados',icon:'snow'},
  {id:'bakery',name:'Padaria',icon:'bread'}, {id:'supplies',name:'Limpeza e descartáveis',icon:'box'},
  {id:'other',name:'Outros',icon:'box'},
];
export type StockCategory = {id:string;name:string;icon:string;normalized_name:string};
export type StockItem = {id:string;name:string;normalized_name:string;category_id:string;unit:StockUnit;quantity_milli:number;minimum_milli:number;value_cents:number;version:number};
export type StockPreset = {id:string;label:string;item_id:string|null;item_name:string;category_id:string;unit:StockUnit;quantity_milli:number;cost_cents:number|null;minimum_milli:number;supplier:string;reason:string;version:number;use_count:number;last_used_at:number|null};
export const defaultStockPresets = [
  {id:'preset-rice',label:'Arroz · compra de 5 kg',itemName:'Arroz branco',categoryId:'grocery',unit:'kg',quantity:5},
  {id:'preset-beans',label:'Feijão · compra de 1 kg',itemName:'Feijão carioca',categoryId:'grocery',unit:'kg',quantity:1},
  {id:'preset-chicken',label:'Frango · compra de 1 kg',itemName:'Peito de frango',categoryId:'meat',unit:'kg',quantity:1},
  {id:'preset-milk',label:'Leite · compra de 1 L',itemName:'Leite integral',categoryId:'dairy',unit:'L',quantity:1},
  {id:'preset-oil',label:'Óleo · compra de 1 L',itemName:'Óleo de soja',categoryId:'grocery',unit:'L',quantity:1},
  {id:'preset-eggs',label:'Ovos · compra de 12 un',itemName:'Ovos',categoryId:'dairy',unit:'un',quantity:12},
] as const;
export function itemForPreset(items:StockItem[],preset:StockPreset) { return items.find(i=>preset.item_id?i.id===preset.item_id:i.normalized_name===normalizeStockName(preset.item_name)&&i.unit===preset.unit); }
export type StockDocument = {id:string;source:string;access_key:string|null;supplier:string;issued_at:string;total_cents:number;line_count:number;created_at:number;preset_id?:string|null};
export type StockMovement = {id:string;document_id:string|null;stock_item_id:string;kind:string;quantity_milli:number;cost_cents:number;reason:string;fiscal_name:string;fiscal_quantity:string;fiscal_unit:string;created_at:number};
export type InventoryState = {categories:StockCategory[];items:StockItem[];presets:StockPreset[];movements:StockMovement[];documents:StockDocument[];serverTime:number};
export type ReceiptLine = {fiscalName:string;fiscalCode:string;fiscalQuantity:number;fiscalUnit:string;totalCents:number;categoryId:string;quantity:number;unit:StockUnit;warning:string};
export type ReceiptIntegrity = {declaredLineCount:number|null;parsedLineCount:number;itemsTotalCents:number;receiptTotalCents:number|null;totalsMatch:boolean|null};
export type ReceiptPreview = {source:'qr'|'xml';accessKey:string;supplier:string;issuedAt:string;sourceUrl:string;totalCents:number|null;lines:ReceiptLine[];warnings:string[];integrity?:ReceiptIntegrity};
export type IntakeLine = {itemId:string;name:string;categoryId:string;unit:StockUnit;quantity:number;totalCents:number;minimum:number;fiscalName?:string;fiscalQuantity?:string;fiscalUnit?:string};
export const normalizeStockName=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const stockQuantity=(milli:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(milli/1000);
export function stockStatus(item:StockItem) { return item.quantity_milli===0?'empty':item.minimum_milli>0&&item.quantity_milli<=item.minimum_milli?'low':'ok'; }
export function suggestStockCategory(name:string) {
  const s=normalizeStockName(name);
  const rules:[string,RegExp][]=[
    ['supplies',/\b(detergente|sabao|sabonete|desinfetante|alvejante|papel|guardanapo|saco de lixo|esponja|descartavel)\b/],
    ['drinks',/\b(agua|mineral|refrigerante|suco|cerveja|vinho|energetico|bebida)\b/],
    ['grocery',/\b(leite de coco|arroz|feijao|acucar|farinha|macarrao|massa|azeite|oleo|cafe|sal|molho|extrato|milho|ervilha|grao|lentilha|tempero|biscoito|chocolate)\b/],
    ['meat',/\b(carne|bovina|bovino|suina|suino|frango|peito|coxa|sobrecoxa|file|picanha|patinho|acem|alcatra|costela|linguica|salsicha|bacon|presunto|peixe|salmao|tilapia)\b/],
    ['dairy',/\b(leite|queijo|manteiga|mussarela|iogurte|requeijao|creme de leite|ovo|ovos)\b/],
    ['produce',/\b(tomate|cebola|alho|batata|cenoura|alface|banana|maca|laranja|limao|salsa|cebolinha|abobrinha|brocolis|pepino)\b/],
    ['frozen',/\b(congelado|congelada|sorvete|polpa|nuggets)\b/],
    ['bakery',/\b(pao|paes|bolo|brioche|torrada|croissant)\b/],
  ];
  return rules.find(([,rule])=>rule.test(s))?.[0]||'other';
}
export function mapFiscalUnit(unit:string,quantity:number):{unit:StockUnit;quantity:number;warning:string} {
  const key=unit.toUpperCase().replace(/[.\s]/g,'');
  if(['KG','KGM','QUILO'].includes(key))return{unit:'kg',quantity,warning:''};
  if(['G','GR','GRAMA'].includes(key))return{unit:'kg',quantity:quantity/1000,warning:'Quantidade convertida de gramas para kg. Confira o arredondamento.'};
  if(['L','LT','LTR','LITRO'].includes(key))return{unit:'L',quantity,warning:''};
  if(['ML','MILILITRO'].includes(key))return{unit:'L',quantity:quantity/1000,warning:'Quantidade convertida de ml para litros. Confira o arredondamento.'};
  if(['UN','UND','UNID','UNIDADE','PC'].includes(key))return{unit:'un',quantity,warning:''};
  if(['PCT','PAC','PACOTE'].includes(key))return{unit:'pct',quantity,warning:''};
  if(['CX','CAIXA'].includes(key))return{unit:'cx',quantity,warning:''};
  return{unit:'un',quantity,warning:'Unidade fiscal '+(unit||'não informada')+' precisa de conferência. Ajuste a unidade do estoque.'};
}
