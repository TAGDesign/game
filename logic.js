const MAX_SKILL = 50;
const MAX_ENERGY = 20;            // запас забросов
const REGEN_MS = 120000;          // заброс возвращается раз в 2 минуты
const HOUR_MS = 240000;           // «час» клёва в прототипе длится 4 минуты
const MERCHANT_EVERY = 300000;    // в прототипе торговец приходит каждые 5 минут…
const MERCHANT_STAY = 120000;     // …и остаётся на 2 минуты; в игре это будет несколько визитов в день по часам
const RESPAWN_MS = 90000;         // сколько герой возрождается после гибели
const BUFF_CASTS = 10, BUFF_SKILL = 5, ENERGY_FOOD = 5;
const HOT_BITE = 2.5, HOT_PRICE = 2;
const PACK_SIZE = 3, BASE_POWER = 2, ARMOR_POWER = 3, MAX_ENCH = 5;
const REPAIR_ORE = 2, REPAIR_GOLD = 40;
const ENCH_COST = {armor:[4, 8, 12, 16, 20], rod:[3, 6, 9, 12, 15]};

const FISH = {
  karas:   {name:'Карась',       water:'pond',  weight:60, rare:false, price:1},
  okun:    {name:'Окунь',        water:'pond',  weight:30, rare:false, price:3},
  karp:    {name:'Золотой карп', water:'pond',  weight:10, rare:true,  price:15},
  forel:   {name:'Форель',       water:'river', weight:55, rare:false, price:5},
  shchuka: {name:'Щука',         water:'river', weight:33, rare:false, price:8},
  osetr:   {name:'Осётр',        water:'river', weight:12, rare:true,  price:40},
  sig:     {name:'Сиг',          water:'lake',  weight:55, rare:false, price:10},
  sudak:   {name:'Судак',        water:'lake',  weight:33, rare:false, price:15},
  taimen:  {name:'Таймень',      water:'lake',  weight:12, rare:true,  price:80},
};
// open — с какого рыболовства пускает; comfort — с какого рыба перестаёт срываться;
// yellow / green / grey — с какого навыка улов здесь качает рыболовство реже
const WATERS = {
  pond:  {name:'Пруд',  open:1,  comfort:1,  yellow:12, green:20, grey:28},
  river: {name:'Река',  open:15, comfort:25, yellow:27, green:35, grey:43},
  lake:  {name:'Озеро', open:30, comfort:40, yellow:42, green:47, grey:51},
};
// power — сколько силы блюдо даёт герою, если взять его в дорогу
const RECIPES = [
  {id:'r1', name:'Жареный карась',  short:'Карась', needs:{karas:2},                skill:1,  cost:0,   sell:5,   power:1, yellow:10, green:18, grey:26},
  {id:'r2', name:'Рыбацкая уха',    short:'Уха',    needs:{okun:1, karas:1},        skill:6,  cost:25,  sell:8,   power:1, yellow:15, green:23, grey:31, eat:'skill'},
  {id:'r3', name:'Карп в меду',     short:'Карп',   needs:{karp:1, okun:1},         skill:12, cost:60,  sell:35,  power:2, yellow:24, green:32, grey:40, eat:'luck'},
  {id:'r4', name:'Копчёная форель', short:'Форель', needs:{forel:2},                skill:18, cost:100, sell:20,  power:2, yellow:28, green:36, grey:44, eat:'energy'},
  {id:'r5', name:'Щучьи котлеты',   short:'Котлеты',needs:{shchuka:1, forel:1},     skill:25, cost:180, sell:30,  power:3, yellow:35, green:42, grey:48},
  {id:'r6', name:'Осётр по-царски', short:'Осётр',  needs:{osetr:1, shchuka:1},     skill:32, cost:300, sell:110, power:6, yellow:42, green:47, grey:51},
  {id:'r7', name:'Сиг на углях',    short:'Сиг',    needs:{sig:2},                  skill:38, cost:350, sell:45,  power:4, yellow:48, green:51, grey:51},
  {id:'r8', name:'Тройная уха',     short:'Тройная',needs:{sudak:1, sig:1, okun:1}, skill:44, cost:500, sell:90,  power:7, yellow:51, green:51, grey:51},
];
const GEAR = [
  {id:'rod',  name:'Бамбуковая удочка', cost:150, text:'На подсечку на треть больше времени'},
  {id:'lure', name:'Блесна',            cost:250, text:'Редкая рыба клюёт в полтора раза чаще'},
];
const EAT_TEXT = {
  skill:  `+${BUFF_SKILL} к рыболовству на ${BUFF_CASTS} забросов`,
  luck:   `редкая рыба клюёт вдвое чаще, ${BUFF_CASTS} забросов`,
  energy: `+${ENERGY_FOOD} забросов сразу`,
};
const EAT_SHORT = {skill:`+${BUFF_SKILL} рыболовства`, luck:'удача ×2', energy:`+${ENERGY_FOOD} забросов`};
const CHANCE = {orange:1, yellow:0.6, green:0.25, grey:0};          // кулинария: шанс роста за блюдо
const FISH_CHANCE = {orange:0.5, yellow:0.3, green:0.12, grey:0};  // рыболовство: шанс роста за рыбу, редкая растит всегда
const QUALITY_TEXT = {
  orange:'Кулинария растёт всегда',
  yellow:'Кулинария растёт часто',
  green:'Кулинария растёт редко',
  grey:'Кулинария больше не растёт',
};

/* карта серии: 3 колонки, 4 ряда, дом внизу по центру, цель наверху */
const SERIES = {name:'Серия 1. Зажги маяк', goal:'mayak'};
const CELLS = {
  ozero:   {name:'Соляное озеро',     r:0, c:0, d:15, tier:3, text:'Берег белый от соли. В лодке у воды лежит завёрнутая в парусину линза для маяка.'},
  mayak:   {name:'Маяк',              r:0, c:1, d:20, tier:4, goal:true, text:'Ты поднимаешься наверх, ставишь линзу и зажигаешь огонь. Луч проходит над морем, и вдали проступает берег, которого нет ни на одной карте.'},
  bashnya: {name:'Сторожевая башня',  r:0, c:2, d:16, tier:3, text:'С башни смотрителю подавали знаки. На столе его последняя записка: «Ушёл за маслом, вернусь к огню».'},
  krug:    {name:'Каменный круг',     r:1, c:0, d:11, tier:3, text:'Камни стоят кольцом. В центре выбита карта побережья, и маяк на ней обведён дважды.'},
  pereval: {name:'Перевал',           r:1, c:1, d:12, tier:3, text:'С перевала видно море и тёмную башню маяка. Огня на ней нет уже много лет.'},
  rudnik:  {name:'Рудник',            r:1, c:2, d:10, tier:3, text:'Заброшенный рудник. В вагонетке лежат слитки и записка: «Линзу отлили, осталось донести».'},
  roscha:  {name:'Берёзовая роща',    r:2, c:0, d:7,  tier:2, text:'На стволах висят потухшие фонари. Кто-то отмечал ими дорогу к маяку.'},
  brod:    {name:'Брод',              r:2, c:1, d:6,  tier:2, text:'Брод выложен плоскими камнями. На том берегу начинается тропа, по которой давно никто не ходил.'},
  paseka:  {name:'Пасека',            r:2, c:2, d:8,  tier:2, text:'Ульи пусты, но в одном спрятан ключ с биркой «верхняя дверь».'},
  zavod:   {name:'Заводь',            r:3, c:0, d:4,  tier:1, text:'Тихая заводь за камышами. На старых мостках кто-то вырезал стрелку на север и слово «свет».'},
  home:    {name:'Дом',               r:3, c:1},
  melnica: {name:'Мельница',          r:3, c:2, d:5,  tier:1, text:'Мельница давно стоит, но жернова целы. В ларе лежит журнал смотрителя маяка, последняя запись обрывается на полуслове.'},
};
const TIERS = {
  1:{ms:60000,  gold:[15, 25],   ore:[1, 2], trophies:[1, 1]},
  2:{ms:120000, gold:[40, 60],   ore:[1, 2], trophies:[1, 2]},
  3:{ms:180000, gold:[90, 130],  ore:[2, 3], trophies:[2, 2]},
  4:{ms:240000, gold:[250, 300], ore:[3, 4], trophies:[3, 3]},
};
const TROPHIES = {
  1:['Ржавый крючок', 'Старый сапог', 'Погнутая подкова'],
  2:['Потускневший амулет', 'Обломок клинка'],
  3:['Резной оберег', 'Рунный камень'],
};

function newState(now = Date.now()){
  return {fishing:1, cooking:1, gold:0, fish:{}, dishes:{}, known:['r1'], gear:[], water:'pond', caught:{},
          casts:0, energy:MAX_ENERGY, energyAt:now, buffs:{skill:0, luck:0}, cur:{bonus:0, luck:false}, sound:true,
          hero:{status:'home'}, opened:['home'], armor:{broken:false, ench:0}, rodEnch:0, ore:0, dust:0, trophies:[],
          pack:[], report:null, fresh:null, won:false, deaths:0, merchantUntil:0, merchantSlot:0};
}
const recipeById = id => RECIPES.find(r => r.id === id);
function colorOf(t, skill){
  return skill < t.yellow ? 'orange' : skill < t.green ? 'yellow' : skill < t.grey ? 'green' : 'grey';
}
function effFishing(s){ return s.fishing + (s.buffs.skill > 0 ? BUFF_SKILL : 0); }
function waterOpen(s, id){ return effFishing(s) >= WATERS[id].open; }
function slipChance(s, waterId, bonus){
  return Math.max(0, Math.min(0.4, (WATERS[waterId].comfort - (s.fishing + bonus)) * 0.04));
}
function hash(n){ n = Math.imul(n ^ (n >>> 15), 2246822519); n = Math.imul(n ^ (n >>> 13), 3266489917); return (n ^ (n >>> 16)) >>> 0; }
function openFish(s){ return Object.keys(FISH).filter(f => s.fishing >= WATERS[FISH[f].water].open); }

/* клёв часа: одна рыба клюёт чаще */
function biteEvent(s, now = Date.now()){
  const slot = Math.floor(now / HOUR_MS), pool = openFish(s);
  return {fish: pool[hash(slot * 2 + 1) % pool.length], endsAt: (slot + 1) * HOUR_MS};
}

/* торговец: приходит по расписанию, заранее известно, что он купит вдвое дороже */
function wantsFor(s, slot){
  const pool = openFish(s).map(id => ({kind:'fish', id})).concat(s.known.map(id => ({kind:'dish', id})));
  const a = pool[hash(slot * 3 + 1) % pool.length];
  const rest = pool.filter(g => g !== a);
  return rest.length ? [a, rest[hash(slot * 3 + 2) % rest.length]] : [a];
}
function merchant(s, now = Date.now()){
  const slot = Math.floor(now / MERCHANT_EVERY), since = now - slot * MERCHANT_EVERY;
  if (s.merchantUntil > now) return {present:true, endsAt:s.merchantUntil, wants:wantsFor(s, s.merchantSlot)};
  if (since < MERCHANT_STAY) return {present:true, endsAt:slot * MERCHANT_EVERY + MERCHANT_STAY, wants:wantsFor(s, slot)};
  return {present:false, nextAt:(slot + 1) * MERCHANT_EVERY, wants:wantsFor(s, slot + 1)};
}
function callMerchant(s, now = Date.now()){
  s.merchantSlot = Math.floor(now / MERCHANT_EVERY) + 1;
  s.merchantUntil = now + MERCHANT_STAY;
}
const wanted = (m, kind, id) => m.wants.some(g => g.kind === kind && g.id === id);

/* забросы */
function regen(s, now = Date.now()){
  if (s.energy >= MAX_ENERGY) return;
  const n = Math.floor((now - s.energyAt) / REGEN_MS);
  if (n > 0){ s.energy = Math.min(MAX_ENERGY, s.energy + n); s.energyAt += n * REGEN_MS; }
}
function spendCast(s, now = Date.now()){
  regen(s, now);
  if (s.energy <= 0 || s.hero.status !== 'home') return false;
  const wasFull = s.energy >= MAX_ENERGY;
  s.energy--; s.casts++;
  if (wasFull && s.energy < MAX_ENERGY) s.energyAt = now;
  s.cur = {bonus: s.buffs.skill > 0 ? BUFF_SKILL : 0, luck: s.buffs.luck > 0};
  if (s.buffs.skill > 0) s.buffs.skill--;
  if (s.buffs.luck > 0) s.buffs.luck--;
  return true;
}
function rollFish(s, waterId, rnd = Math.random, now = Date.now()){
  const hot = biteEvent(s, now).fish;
  const pool = Object.entries(FISH).filter(([, f]) => f.water === waterId).map(([id, f]) => {
    let w = f.weight;
    if (f.rare) w *= (s.cur.luck ? 2 : 1) * (s.gear.includes('lure') ? 1.5 : 1);
    if (id === hot) w *= HOT_BITE;
    return [id, w];
  });
  let x = rnd() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of pool){ x -= w; if (x < 0) return id; }
  return pool[0][0];
}
function hookWindow(s, fishId){
  return (FISH[fishId].rare ? 640 : 880) * (s.gear.includes('rod') ? 1.35 : 1) * (1 + 0.08 * s.rodEnch);
}
function landFish(s, id, rnd = Math.random){
  const f = FISH[id];
  if (rnd() < slipChance(s, f.water, s.cur.bonus)) return {slipped:true};
  const first = !s.caught[id];
  s.fish[id] = (s.fish[id] || 0) + 1;
  s.caught[id] = (s.caught[id] || 0) + 1;
  const up = s.fishing < MAX_SKILL && (f.rare || rnd() < FISH_CHANCE[colorOf(WATERS[f.water], s.fishing)]);
  if (up) s.fishing++;
  return {slipped:false, up, first};
}

/* кухня */
function canCook(s, r){
  return Object.entries(r.needs).every(([f, n]) => (s.fish[f] || 0) >= n);
}
function cook(s, r, rnd = Math.random){
  if (!s.known.includes(r.id) || !canCook(s, r)) return null;
  for (const [f, n] of Object.entries(r.needs)) s.fish[f] -= n;
  s.dishes[r.id] = (s.dishes[r.id] || 0) + 1;
  const color = colorOf(r, s.cooking);
  const up = s.cooking < MAX_SKILL && rnd() < CHANCE[color];
  if (up) s.cooking++;
  return {up, color};
}
function eat(s, id, now = Date.now()){
  const r = recipeById(id);
  if (!r || !r.eat || !(s.dishes[id] > 0)) return false;
  s.dishes[id]--;
  if (r.eat === 'skill') s.buffs.skill = BUFF_CASTS;
  else if (r.eat === 'luck') s.buffs.luck = BUFF_CASTS;
  else { regen(s, now); s.energy += ENERGY_FOOD; }
  prunePack(s);
  return true;
}

/* торговля: только пока торговец здесь */
function priceOf(s, kind, id, now = Date.now()){
  const base = kind === 'fish' ? FISH[id].price : recipeById(id).sell;
  const m = merchant(s, now);
  return base * (wanted(m, kind, id) ? HOT_PRICE : 1);
}
function sell(s, kind, id, n, now = Date.now()){
  if (!merchant(s, now).present) return 0;
  const store = kind === 'fish' ? s.fish : s.dishes;
  n = Math.min(n, store[id] || 0);
  if (n <= 0) return 0;
  store[id] -= n;
  const sum = n * priceOf(s, kind, id, now);
  s.gold += sum;
  prunePack(s);
  return sum;
}
function recipeStatus(s, r){
  if (s.known.includes(r.id)) return 'known';
  if (s.cooking < r.skill) return 'locked';
  return s.gold >= r.cost ? 'buyable' : 'poor';
}
function buyRecipe(s, r, now = Date.now()){
  if (!merchant(s, now).present || recipeStatus(s, r) !== 'buyable') return false;
  s.gold -= r.cost; s.known.push(r.id); return true;
}
function buyGear(s, g, now = Date.now()){
  if (!merchant(s, now).present || s.gear.includes(g.id) || s.gold < g.cost) return false;
  s.gold -= g.cost; s.gear.push(g.id); return true;
}

/* герой, карта и вылазки */
function cellState(s, id){
  if (id === 'home') return 'home';
  if (s.opened.includes(id)) return 'open';
  const c = CELLS[id];
  const near = s.opened.some(o => Math.abs(CELLS[o].r - c.r) + Math.abs(CELLS[o].c - c.c) === 1);
  return near ? 'near' : 'fog';
}
function prunePack(s){
  const left = Object.assign({}, s.dishes);
  s.pack = s.pack.filter(id => (left[id] || 0) > 0 && left[id]--).slice(0, PACK_SIZE);
}
function packLeft(s, id){ return (s.dishes[id] || 0) - s.pack.filter(x => x === id).length; }
function heroPower(s, pack = s.pack){
  const parts = [{label:'Основа', v:BASE_POWER}];
  parts.push(s.armor.broken ? {label:'Броня сломана', v:0} : {label:'Броня', v:ARMOR_POWER});
  if (!s.armor.broken && s.armor.ench) parts.push({label:'Чары', v:s.armor.ench});
  parts.push({label:'Навыки', v:Math.floor(s.fishing / 10) + Math.floor(s.cooking / 10)});
  const food = pack.reduce((a, id) => a + recipeById(id).power, 0);
  if (food) parts.push({label:'Припасы', v:food});
  return {parts, total: parts.reduce((a, p) => a + p.v, 0)};
}
function tripChance(s, id, pack = s.pack){
  return Math.max(5, Math.min(95, 50 + (heroPower(s, pack).total - CELLS[id].d) * 10));
}
// чем меньше шанс, тем чаще неудача заканчивается гибелью
const deathRisk = chance => Math.round((100 - chance) * (100 - chance) / 100);
function depart(s, id, now = Date.now()){
  const st = cellState(s, id);
  if (s.hero.status !== 'home' || (st !== 'near' && st !== 'open')) return false;
  prunePack(s);
  const chance = tripChance(s, id);
  for (const d of s.pack) s.dishes[d]--;
  s.pack = []; s.fresh = null;
  s.hero = {status:'away', target:id, chance, start:now, until:now + TIERS[CELLS[id].tier].ms};
  return true;
}
const between = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));
function resolveHero(s, now = Date.now(), rnd = Math.random){
  const h = s.hero;
  if (h.status === 'dead' && now >= h.until){ s.hero = {status:'home'}; return 'revived'; }
  if (h.status !== 'away' || now < h.until) return null;
  const id = h.target, cell = CELLS[id], tier = TIERS[cell.tier];
  const roll = 1 + Math.floor(rnd() * 100);
  if (roll <= h.chance){
    const first = !s.opened.includes(id);
    const loot = {gold:between(rnd, tier.gold), ore:between(rnd, tier.ore), trophies:[]};
    const names = TROPHIES[Math.min(3, cell.tier)];
    for (let i = between(rnd, tier.trophies); i > 0; i--) loot.trophies.push({n:names[Math.floor(rnd() * names.length)], t:Math.min(3, cell.tier)});
    s.gold += loot.gold; s.ore += loot.ore; s.trophies.push(...loot.trophies);
    s.fresh = {gold:loot.gold, ore:loot.ore, names:loot.trophies.map(t => t.n)};
    if (first) s.opened.push(id);
    if (first && cell.goal) s.won = true;
    s.hero = {status:'home'};
    s.report = {outcome:'win', id, roll, chance:h.chance, first, loot};
    return 'win';
  }
  if (rnd() * 100 < 100 - h.chance){
    s.armor.broken = true; s.buffs = {skill:0, luck:0}; s.deaths++;
    s.hero = {status:'dead', start:now, until:now + RESPAWN_MS};
    s.report = {outcome:'death', id, roll, chance:h.chance};
    return 'death';
  }
  s.hero = {status:'home'};
  s.report = {outcome:'retreat', id, roll, chance:h.chance};
  return 'retreat';
}
function disenchant(s, name){
  const take = s.trophies.filter(t => !name || t.n === name);
  if (!take.length) return 0;
  const dust = take.reduce((a, t) => a + t.t * 2, 0);
  s.trophies = s.trophies.filter(t => name && t.n !== name);
  s.dust += dust;
  return dust;
}
function enchLevel(s, what){ return what === 'armor' ? s.armor.ench : s.rodEnch; }
function enchant(s, what){
  const lvl = enchLevel(s, what);
  if (lvl >= MAX_ENCH || (what === 'armor' && s.armor.broken) || s.dust < ENCH_COST[what][lvl]) return false;
  s.dust -= ENCH_COST[what][lvl];
  if (what === 'armor') s.armor.ench++; else s.rodEnch++;
  return true;
}
function repair(s, how){
  if (!s.armor.broken) return false;
  if (how === 'ore'){ if (s.ore < REPAIR_ORE) return false; s.ore -= REPAIR_ORE; }
  else { if (s.gold < REPAIR_GOLD) return false; s.gold -= REPAIR_GOLD; }
  s.armor.broken = false;
  return true;
}
