import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleFrom = file => import('data:text/javascript;base64,' + Buffer.from(compile(file)).toString('base64'));
const { kitchenPage } = await moduleFrom('src/kitchen-model.ts');
const { canAct } = await moduleFrom('src/access-model.ts');
const orders = Array.from({ length: 9 }, (_, i) => ({ id: 'pedido-' + i, number: 100 + i, created_at: i < 2 ? 1000 : 1000 + i, status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'preparing' : 'ready' })).reverse();
let count = 0;
function check(name, test) { test(); count++; console.log('PASS ' + name); }
check('Celular mostra no máximo dois pedidos por página sem perder pedidos entre páginas', () => {
  const pages = Array.from({ length: 5 }, (_, page) => kitchenPage(orders, 'all', page, 2));
  assert.deepEqual(pages.map(p => p.orders.length), [2, 2, 2, 2, 1]);
  assert.deepEqual(pages.flatMap(p => p.orders.map(o => o.number)), Array.from({ length: 9 }, (_, i) => 100 + i));
});
check('Monitor mostra quatro pedidos por página com a mesma ordem de chegada', () => {
  const pages = Array.from({ length: 3 }, (_, page) => kitchenPage(orders, 'all', page, 4));
  assert.deepEqual(pages.map(p => p.orders.length), [4, 4, 1]);
  assert.deepEqual(pages.flatMap(p => p.orders.map(o => o.number)), Array.from({ length: 9 }, (_, i) => 100 + i));
});
check('Filtros mantêm contagem e paginação apenas da etapa escolhida', () => {
  const result = kitchenPage(orders, 'ready', 1, 2);
  assert.equal(result.total, 3); assert.equal(result.pageCount, 2); assert.deepEqual(result.orders.map(o => o.number), [108]);
});
check('Remover pedidos da última página ajusta a página sem esconder o restante da fila', () => {
  const result = kitchenPage(orders.slice(3), 'all', 4, 2);
  assert.equal(result.page, 2); assert.equal(result.orders.length, 2);
});
check('Mudança de tamanho, fila vazia e páginas inválidas mantêm navegação válida', () => {
  assert.equal(kitchenPage(orders, 'all', 4, 4).page, 2);
  const empty = kitchenPage([], 'all', 4, 2); assert.equal(empty.page, 0); assert.equal(empty.pageCount, 1); assert.equal(empty.total, 0); assert.deepEqual(empty.orders, []);
  assert.equal(kitchenPage(orders, 'all', -5, 2).page, 0);
});
check('Atualização da fila não reordena ou modifica o estado original', () => {
  const original = structuredClone(orders); kitchenPage(orders, 'all', 0, 4); assert.deepEqual(orders, original);
});
check('Cozinha não herda ações do garçom ou administrador', () => {
  assert.equal(canAct('kitchen', 'order-status'), true); assert.equal(canAct('kitchen', 'kitchen-call'), true);
  for (const action of ['pay-account', 'open-account', 'create-order', 'pickup-order', 'deliver-order', 'save-product', 'add-table', 'admin-cancel-order']) assert.equal(canAct('kitchen', action), false, action);
  assert.equal(canAct('invalid-role', 'open-account'), false);
  assert.equal(canAct('toString', 'open-account'), false);
});
console.log('\n' + count + ' cenários de fila e permissões da interface aprovados.');
