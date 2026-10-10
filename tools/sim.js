// Сценарные проверки правил и прогон серии ботом до зажжённого маяка.
// Запуск: node tools/sim.js  (читает правила игры из logic.js)
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'logic.js'), 'utf8');
const names = 'MAX_SKILL,MAX_ENERGY,REGEN_MS,MERCHANT_EVERY,MERCHANT_STAY,RESPAWN_MS,PACK_SIZE,ENCH_COST,MAX_ENCH,REPAIR_ORE,REPAIR_GOLD,FISH,WATERS,RECIPES,GEAR,CELLS,TIERS,CHANCE,newState,recipeById,colorOf,waterOpen,slipChance,merchant,callMerchant,regen,spendCast,rollFish,landFish,canCook,cook,eat,priceOf,sell,recipeStatus,buyRecipe,buyGear,cellState,prunePack,packLeft,heroPower,tripChance,deathRisk,depart,resolveHero,disenchant,enchant,repair';
const L = new Function(code + `; return {${names}};`)();
const ok = (cond, msg) => { if (!cond) { console.log('ПРОВАЛ:', msg); process.exitCode = 1; } };

/* ---- сценарии ---- */
{
  const t = 1e12, s = L.newState(t);
  ok(L.heroPower(s, []).total === 5, 'стартовая сила 5');
  ok(L.tripChance(s, 'zavod', []) === 60, 'заводь на старте 60%');
  ok(L.cellState(s, 'zavod') === 'near' && L.cellState(s, 'roscha') === 'fog' && L.cellState(s, 'brod') === 'near', 'туман: соседи дома доступны');
  s.dishes.r1 = 2; s.pack = ['r1', 'r1', 'r1']; L.prunePack(s);
  ok(s.pack.length === 2, 'припасов не больше, чем блюд');
  ok(L.tripChance(s, 'zavod') === 80, 'два карася дают 80%');
  ok(L.depart(s, 'zavod', t) && s.dishes.r1 === 0 && s.hero.status === 'away', 'выход съедает припасы');
  ok(!L.spendCast(s, t), 'пока герой в пути, рыбачить нельзя');
  ok(L.resolveHero(s, t + 1000) === null, 'раньше срока не возвращается');
  ok(L.resolveHero(s, t + 60000, () => 0) === 'win' && s.opened.includes('zavod') && s.trophies.length === 1 && s.gold >= 15, 'успех открывает клетку и даёт добычу');
  ok(L.cellState(s, 'roscha') === 'near', 'после заводи открывается путь в рощу');
  const d = L.disenchant(s, null); ok(d === 2 && s.dust === 2 && !s.trophies.length, 'распыление даёт пыль');
  s.dust = 4; ok(L.enchant(s, 'armor') && s.armor.ench === 1 && L.heroPower(s, []).total === 6, 'чары брони +1 силы');
  // гибель
  s.buffs = {skill:7, luck:3}; s.ore = 0; s.gold = 0;
  L.depart(s, 'brod', t + 70000);
  { const seq = [0.995, 0]; ok(L.resolveHero(s, t + 70000 + 120000, () => seq.shift()) === 'death', 'бросок 100, затем бросок на гибель — герой погибает'); }
  ok(s.armor.broken && s.buffs.skill === 0 && s.hero.status === 'dead' && s.fishing === 1, 'гибель: броня сломана, бафы сброшены, навыки на месте');
  ok(L.heroPower(s, []).total === 2, 'сломанная броня не даёт силы и чар');
  ok(!L.depart(s, 'brod', t + 200000), 'мёртвый герой не уходит на вылазку');
  ok(L.resolveHero(s, t + 70000 + 120000 + L.RESPAWN_MS) === 'revived' && s.hero.status === 'home', 'герой возрождается');
  ok(!L.repair(s, 'ore') && !L.repair(s, 'gold'), 'без руды и золота не починить');
  s.ore = 2; ok(L.repair(s, 'ore') && !s.armor.broken && L.heroPower(s, []).total === 6, 'починка рудой возвращает силу и чары');
  // торговец
  const absent = Math.floor(t / L.MERCHANT_EVERY) * L.MERCHANT_EVERY + L.MERCHANT_STAY + 1000;
  s.fish.karas = 5;
  ok(!L.merchant(s, absent).present && L.sell(s, 'fish', 'karas', 5, absent) === 0, 'без торговца продать нельзя');
  const here = absent + L.MERCHANT_EVERY - L.MERCHANT_STAY;
  ok(L.merchant(s, here).present && L.sell(s, 'fish', 'karas', 5, here) >= 5, 'при торговце продаётся');
  const announced = L.merchant(s, absent).wants.map(g => g.id).join(), came = L.merchant(s, here).wants.map(g => g.id).join();
  ok(announced === came, 'торговец приносит объявленный спрос');
  L.callMerchant(s, absent); ok(L.merchant(s, absent + 1).present, 'тестовый вызов торговца');
}

/* ---- бот ---- */
function run(hookRate){
  let t = 1e9 + Math.floor(Math.random() * 1e6);
  const t0 = t, s = L.newState(t), log = {};
  const mark = k => { if (!log[k]) log[k] = (t - t0) / 60000; };
  let guard = 0, trips = 0;
  while (!s.won && guard++ < 400000){
    L.regen(s, t); L.resolveHero(s, t);
    if (s.report){ if (s.report.outcome === 'win' && s.report.first) mark(s.report.id); s.report = null; trips++; }
    L.disenchant(s, null);
    if (s.armor.broken && !L.repair(s, 'ore')) L.repair(s, 'gold');
    while (L.enchant(s, 'armor')); while (s.armor.ench >= L.MAX_ENCH && L.enchant(s, 'rod'));
    const m = L.merchant(s, t);
    if (m.present){
      for (const r of L.RECIPES) L.buyRecipe(s, r, t);
      if (L.RECIPES.every(r => s.known.includes(r.id) || s.cooking < r.skill)) for (const g of L.GEAR) L.buyGear(s, g, t);
    }
    const known = L.RECIPES.filter(r => s.known.includes(r.id))
      .map(r => ({r, ch: s.cooking < L.MAX_SKILL ? L.CHANCE[L.colorOf(r, s.cooking)] : 0}))
      .sort((a, b) => b.ch - a.ch || b.r.power - a.r.power);
    const cookable = known.find(k => k.ch > 0 && L.canCook(s, k.r)) || known.find(k => L.canCook(s, k.r) && k.r.power >= 3);
    if (cookable){ L.cook(s, cookable.r); t += 700; continue; }
    if (s.dishes.r4 > 0 && s.energy <= L.MAX_ENERGY - 5 && s.hero.status === 'home'){ L.eat(s, 'r4', t); continue; }

    // вылазка: ближайшая неразведанная клетка, лучшие три блюда; идём при шансе от 70%
    if (s.hero.status === 'home' && !s.armor.broken){
      const near = Object.keys(L.CELLS).filter(id => L.cellState(s, id) === 'near').sort((a, b) => L.CELLS[a].d - L.CELLS[b].d);
      const target = near.includes('mayak') && L.CELLS[near[0]].d > 12 ? 'mayak' : near[0];
      if (target){
        const stock = L.RECIPES.filter(r => r.id !== 'r4').flatMap(r => Array(s.dishes[r.id] || 0).fill(r.id)).sort((a, b) => L.recipeById(b).power - L.recipeById(a).power);
        s.pack = stock.slice(0, L.PACK_SIZE);
        if (L.tripChance(s, target) >= 70){ L.depart(s, target, t); continue; }
        s.pack = [];
      }
    }
    // продаём только лишнее: дешёвые блюда сверх запаса на дорогу и рыбу, которая не нужна рецептам
    if (m.present){
      const needed = new Set(known.filter(k => k.ch > 0 || k.r.power >= 3).flatMap(k => Object.keys(k.r.needs)));
      for (const f of Object.keys(L.FISH)) if (!needed.has(f) && s.fish[f] > 0) L.sell(s, 'fish', f, Infinity, t);
      for (const id of ['r1', 'r2']) if (s.dishes[id] > 4) L.sell(s, 'dish', id, s.dishes[id] - 4, t);
    }
    if (s.hero.status !== 'home'){ t = Math.max(t + 1000, Math.min(s.hero.until, t + 30000)); continue; }
    if (s.energy <= 0){ t += Math.min(s.energyAt + L.REGEN_MS - t, 30000); continue; }
    let water = Object.keys(L.WATERS).filter(id => L.waterOpen(s, id)).pop();
    const want = known.find(k => (k.ch > 0 || k.r.power >= 3) && Object.keys(k.r.needs).every(f => L.waterOpen(s, L.FISH[f].water)));
    if (want){ const miss = Object.entries(want.r.needs).find(([f, n]) => (s.fish[f] || 0) < n); if (miss) water = L.FISH[miss[0]].water; }
    L.spendCast(s, t); t += 7500;
    if (Math.random() < hookRate) L.landFish(s, L.rollFish(s, water, Math.random, t));
  }
  return {hours: (t - t0) / 3600000, deaths: s.deaths, trips, casts: s.casts, fishing: s.fishing, cooking: s.cooking, won: s.won, log};
}
const N = 40, runs = Array.from({length: N}, () => run(0.85));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const done = runs.filter(r => r.won);
console.log('серия пройдена в', done.length, 'из', N);
console.log('часов до маяка:', avg(done.map(r => r.hours)).toFixed(1), '| вылазок', avg(done.map(r => r.trips)).toFixed(1), '| гибелей', avg(done.map(r => r.deaths)).toFixed(1), '| забросов', Math.round(avg(done.map(r => r.casts))), '| навыки в конце', Math.round(avg(done.map(r => r.fishing))), '/', Math.round(avg(done.map(r => r.cooking))));
for (const k of Object.keys(L.CELLS).filter(k => k !== 'home').sort((a, b) => L.CELLS[a].d - L.CELLS[b].d)){
  const hit = runs.filter(r => r.log[k] !== undefined);
  console.log(L.CELLS[k].name.padEnd(18), 'сложность', String(L.CELLS[k].d).padStart(2), '| открыта в', String(hit.length).padStart(3), 'из', N, '| минута', avg(hit.map(r => r.log[k])).toFixed(0).padStart(4));
}
if (!process.exitCode) console.log('сценарии: все проверки прошли');
