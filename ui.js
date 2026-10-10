const $ = id => document.getElementById(id);
const KEY = 'klev-v2';
let state = newState();
let tab = 'map';
let sel = null;   // выбранная клетка карты

function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }

/* ---------- отклик: звук, вибрация, тосты ---------- */
let ac = null;
function tone(freq, dur, opts = {}){
  if (!state.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + (opts.delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(opts.gain || 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
const sfx = {
  cast(){ tone(520, .16, {to:180}); },
  bite(){ tone(880, .09, {type:'triangle', gain:.09}); tone(880, .09, {type:'triangle', gain:.09, delay:.12}); },
  catch(rare){ tone(523, .1); tone(659, .1, {delay:.08}); tone(rare ? 1047 : 784, .2, {delay:.16}); },
  miss(){ tone(200, .22, {to:110, type:'triangle'}); },
  cook(){ tone(330, .08, {type:'triangle'}); },
  up(){ tone(660, .1, {delay:.06}); tone(990, .18, {delay:.14}); },
  coin(){ tone(1320, .07, {type:'square', gain:.03}); tone(1760, .12, {type:'square', gain:.03, delay:.06}); },
  buy(){ tone(440, .1); tone(587, .1, {delay:.09}); tone(880, .22, {delay:.18}); },
  eat(){ tone(300, .08, {type:'triangle'}); tone(450, .14, {type:'triangle', delay:.09}); },
  go(){ tone(392, .12); tone(523, .2, {delay:.1}); },
  dust(){ tone(1500, .05, {type:'triangle', gain:.04}); tone(2000, .09, {type:'triangle', gain:.04, delay:.05}); },
};
function buzz(p){ try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
let toastTimer = null;
function toast(text){
  const el = $('toast'); el.textContent = text; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2000);
}
function pop(el){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function plusOne(box){
  const p = document.createElement('span'); p.className = 'plus'; p.textContent = '+1';
  $(box).appendChild(p); setTimeout(() => p.remove(), 900);
}
const fishSvg = id => `<svg class="fish" viewBox="0 0 40 24" style="color:var(--f-${id})" aria-hidden="true"><use href="#fish"/></svg>`;
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const goodName = g => g.kind === 'fish' ? FISH[g.id].name : recipeById(g.id).name;
const placeName = id => cellState(state, id) === 'open' || CELLS[id].goal || CELLS[id].safe ? CELLS[id].name : 'неразведанное место';
function heroStatus(now = Date.now()){
  const h = state.hero;
  if (h.status === 'away') return `Герой на вылазке: ${placeName(h.target)}, вернётся через ${clock(h.until - now)}`;
  if (h.status === 'dead') return `Герой возрождается, вернётся через ${clock(h.until - now)}`;
  return 'Герой дома и готов к вылазке';
}

/* ---------- рыбалка ---------- */
const IDLE_TEXT = 'Нажми на воду, чтобы забросить';
const CAST_MS = 10000;   // заброс длится 10 секунд, рыба клюёт в случайный момент внутри них
let phase = 'idle', timer = null, pending = null, lockUntil = 0, castStart = 0, raf = 0;
function runBar(){
  $('castFill').style.width = Math.min(100, (performance.now() - castStart) / CAST_MS * 100) + '%';
  if (phase === 'wait' || phase === 'bite') raf = requestAnimationFrame(runBar);
}
function setPhase(p, text){
  phase = p;
  const w = $('water'); w.dataset.state = p;
  if (p !== 'bite') delete w.dataset.rare;
  $('callout').textContent = text;
  if (p !== 'caught') $('catchCard').hidden = true;
}
function bestWater(){ return Object.keys(WATERS).filter(id => waterOpen(state, id)).pop(); }
function blockedText(now = Date.now()){
  if (state.hero.status !== 'home') return heroStatus(now) + '. Рыбачить пока некому';
  if (state.energy <= 0) return `Забросы кончились. Следующий через ${clock(state.energyAt + REGEN_MS - now)}`;
  return '';
}
function cast(){
  clearTimeout(timer);
  if (!waterOpen(state, state.water)){
    if (!bestWater()) return;
    state.water = bestWater();
    toast('Баф закончился, для того водоёма мало рыболовства'); renderAll();
  }
  if (!spendCast(state)){ setPhase('idle', blockedText()); sfx.miss(); return; }
  const w = $('water');
  w.style.setProperty('--bx', (18 + Math.random() * 64).toFixed(1) + '%');
  w.style.setProperty('--by', (46 + Math.random() * 18).toFixed(1) + '%');
  setPhase('wait', 'Жди поклёвки. Она случится, пока идёт полоса');
  sfx.cast();
  renderHud(); renderWaterInfo();
  pending = rollFish(state, state.water);
  castStart = performance.now(); cancelAnimationFrame(raf); runBar();
  timer = setTimeout(bite, 1000 + Math.random() * (CAST_MS - 1200 - hookWindow(state, pending)));
}
function bite(){
  const f = FISH[pending];
  setPhase('bite', f.rare ? 'Крупная! Подсекай!' : 'Подсекай!');
  if (f.rare) $('water').dataset.rare = '1';
  sfx.bite(); buzz(f.rare ? [40, 40, 40] : 30);
  timer = setTimeout(() => miss('Сорвалась. Нажми, чтобы забросить ещё'), hookWindow(state, pending));
}
function hook(){
  clearTimeout(timer);
  const id = pending, f = FISH[id];
  pending = null;
  const res = landFish(state, id);
  if (res.slipped) return miss(`Ушла у самого берега. В этом водоёме рыба срывается, пока рыболовство ниже ${WATERS[f.water].comfort}`);
  const notes = [f.rare ? 'Редкая' : '', res.first ? 'новая рыба' : '', res.up ? 'рыболовство +1' : ''].filter(Boolean);
  const card = $('catchCard');
  card.className = 'catch' + (f.rare ? ' rare' : '');
  card.innerHTML = `${fishSvg(id)}<span class="catch-name">${f.name}</span><span class="catch-sub">${notes.length ? notes.join(' · ') : 'В садке: ' + state.fish[id]}</span>`;
  card.hidden = false;
  setPhase('caught', 'Нажми, чтобы забросить ещё');
  sfx.catch(f.rare); buzz(f.rare ? [20, 30, 60] : 15);
  if (res.up){ sfx.up(); plusOne('fishBox'); }
  lockUntil = performance.now() + 260;
  save(); renderHud(); renderWaters(); renderBag();
  if (res.up) pop($('fishNum'));
}
function miss(text){
  clearTimeout(timer); pending = null;
  setPhase('miss', text);
  sfx.miss();
  lockUntil = performance.now() + 320;
  save();
}
function tapWater(){
  if (performance.now() < lockUntil) return;
  if (phase === 'wait') miss('Рано, рыба ушла. Нажми, чтобы забросить ещё');
  else if (phase === 'bite') hook();
  else cast();
}
function stopFishing(){
  clearTimeout(timer); pending = null;
  setPhase('idle', IDLE_TEXT);
}

/* ---------- отрисовка ---------- */
function renderHud(){
  $('fishNum').textContent = state.fishing;
  $('fishBuff').textContent = state.buffs.skill > 0 ? '+' + BUFF_SKILL : '';
  $('fishBar').style.width = ((state.fishing - 1) / (MAX_SKILL - 1) * 100) + '%';
  $('cookNum').textContent = state.cooking;
  $('cookBar').style.width = ((state.cooking - 1) / (MAX_SKILL - 1) * 100) + '%';
  $('goldNum').textContent = state.gold;
  renderGoal();
}
const PLACES = Object.keys(CELLS).length - 1;
// одна подсказка сверху вместо значков на вкладках: следующее действие и куда за ним идти
function hint(now = Date.now()){
  if (state.hero.status !== 'home') return {text: heroStatus(now)};
  if (state.won) return {text: 'Серия 1 пройдена. Маяк горит'};
  const lesson = tutorialCell(state);
  if (lesson) return {text: `Разведай ${CELLS[lesson].name.toLowerCase()}: нажми на него на карте`, go: 'map', cell: lesson};
  if (state.armor.broken) return {text: 'Почини броню в убежище', go: 'home'};
  if (RECIPES.some(r => state.known.includes(r.id) && canCook(state, r))) return {text: 'Приготовь улов на кухне в убежище', go: 'home'};
  if (state.energy > 0 && !RECIPES.some(r => state.dishes[r.id] > 0)){
    if (tab === 'fish') return {text: 'Налови рыбы, а потом приготовь её в убежище'};
    const place = waterPlace(state.water) || waterPlace('pond');
    return {text: `Налови рыбы: нажми на ${CELLS[place].name.toLowerCase()} на карте`, go: 'map', cell: place};
  }
  return {text: `Герой готов к вылазке. Разведано ${state.opened.length - 1} из ${PLACES}`, go: 'map'};
}
function renderGoal(now = Date.now()){
  const h = hint(now), el = $('goal');
  el.textContent = h.text;
  if (h.go && (h.go !== tab || (h.cell && h.cell !== sel))){ el.dataset.go = h.go; el.dataset.goCell = h.cell || ''; el.disabled = false; }
  else { delete el.dataset.go; el.disabled = true; }
}
function renderWaters(){
  $('fishTitle').textContent = `${WATERS[state.water].name} · рыбалка`;
  $('waters').innerHTML = Object.entries(WATERS).map(([id, w]) =>
    waterOpen(state, id)
      ? `<button id="water-${id}" data-water="${id}" aria-pressed="${state.water === id}">${w.name}</button>`
      : `<button id="water-${id}" disabled>${w.name}<small>${waterPlace(id) ? 'разведай: ' + CELLS[waterPlace(id)].name : 'с рыболовства ' + w.open}</small></button>`
  ).join('');
}
function renderWaterInfo(){
  const now = Date.now();
  regen(state, now);
  $('energyNum').textContent = state.energy;
  $('energyTimer').textContent = state.energy < MAX_ENERGY ? '+1 через ' + clock(state.energyAt + REGEN_MS - now) : '';
  const ev = biteEvent(state, now), hot = FISH[ev.fish], notes = [];
  notes.push(`Этот час лучше клюёт: ${hot.name}${hot.water !== state.water ? ' (' + WATERS[hot.water].name.toLowerCase() + ')' : ''}, ещё ${clock(ev.endsAt - now)}`);
  const slip = slipChance(state, state.water, state.buffs.skill > 0 ? BUFF_SKILL : 0);
  if (slip > 0) notes.push(`Срывается ${Math.round(slip * 100)}% рыбы, пока рыболовство ниже ${WATERS[state.water].comfort}`);
  if (state.buffs.skill > 0) notes.push(`Уха: +${BUFF_SKILL} к рыболовству, забросов: ${state.buffs.skill}`);
  if (state.buffs.luck > 0) notes.push(`Удача: редкая клюёт вдвое чаще, забросов: ${state.buffs.luck}`);
  $('wnote').innerHTML = notes.map(n => `<span>${n}</span>`).join('');
  if (phase === 'wait' || phase === 'bite') return;
  const blocked = blockedText(now);
  if (blocked) $('callout').textContent = blocked;
  else if (phase === 'idle' && $('callout').textContent !== IDLE_TEXT) $('callout').textContent = IDLE_TEXT;
}
function renderBag(){
  $('bag').innerHTML = Object.entries(FISH).filter(([, f]) => f.water === state.water).map(([id, f]) => {
    if (!state.caught[id]) return `<div class="tile"><span class="tile-q">?</span><span class="tile-name">${f.rare ? 'Редкая, ещё не поймана' : 'Ещё не поймана'}</span></div>`;
    return `<div class="tile${f.rare ? ' rare' : ''}">${fishSvg(id)}<span class="tile-name">${f.name}</span><span class="tile-count">${state.fish[id] || 0}</span></div>`;
  }).join('');
  const foods = RECIPES.filter(r => r.eat && state.dishes[r.id] > 0);
  $('food').innerHTML = foods.map(r => `<button id="eatq-${r.id}" data-eat="${r.id}" aria-label="Съесть: ${r.name}, ${EAT_TEXT[r.eat]}"><small>Съесть</small><b>${r.short} ×${state.dishes[r.id]}</b>${EAT_SHORT[r.eat]}</button>`).join('');
}
function needsHtml(r){
  return Object.entries(r.needs).map(([f, n]) => {
    const have = state.fish[f] || 0;
    return `<span class="need${have < n ? ' lack' : ''}">${fishSvg(f)}${FISH[f].name} ×${n}<span class="have">есть ${have}</span></span>`;
  }).join('');
}
function renderCook(){
  const known = RECIPES.filter(r => state.known.includes(r.id)).reverse();
  $('cookList').innerHTML = known.map(r => {
    const c = colorOf(r, state.cooking), n = state.dishes[r.id] || 0;
    return `<div class="card">
      <div class="card-head"><span class="card-name">${r.name}</span><span class="stock">${n ? 'Готово: ' + n : ''}</span></div>
      <div class="quality"><span class="dot q-${c}"></span>${state.cooking >= MAX_SKILL ? 'Кулинария на максимуме' : QUALITY_TEXT[c]}</div>
      <div class="needs">${needsHtml(r)}</div>
      <span class="meta">В дорогу: +${r.power} к силе героя. ${r.eat ? 'Если съесть: ' + EAT_TEXT[r.eat] : 'Цена у торговца ' + r.sell}</span>
      <div class="row end"><span class="btns">${r.eat ? `<button class="btn quiet" id="eat-${r.id}" data-eat="${r.id}" ${n ? '' : 'disabled'}>Съесть</button>` : ''}
      <button class="btn" id="cook-${r.id}" data-cook="${r.id}" ${canCook(state, r) ? '' : 'disabled'}>Приготовить</button></span></div>
    </div>`;
  }).join('');
}

/* дом */
function rank(){
  const n = state.opened.length - 1;
  return state.won ? 'Смотритель маяка' : n >= 6 ? 'Разведчик' : n >= 3 ? 'Следопыт' : 'Новичок';
}
function reportHtml(rep){
  const cell = CELLS[rep.id], dice = cell.safe ? '' : `Бросок ${rep.roll}, нужно было не больше ${rep.chance}.`;
  if (rep.outcome === 'win'){
    const groups = {}; rep.loot.trophies.forEach(t => groups[t.n] = (groups[t.n] || 0) + 1);
    const tro = Object.entries(groups).map(([n, k]) => n + (k > 1 ? ' ×' + k : '')).join(', ');
    return `<div class="card hot"><span class="card-name">${rep.first ? 'Разведано: ' : 'Вылазка удалась: '}${cell.name}</span>
      <span class="meta">${dice}</span>
      ${rep.first ? `<span class="story">${cell.text}</span>` : ''}
      ${rep.first && cell.goal ? '<span class="card-name">Серия пройдена. Следующая серия откроет берег за морем.</span>' : ''}
      <span class="meta">В сумке прибавилось: ${rep.loot.gold} золота${rep.loot.ore ? ', руда ×' + rep.loot.ore : ''}${tro ? ', ' + tro : ''}</span>
      ${rep.first && cell.gather && cell.gather.fish ? `<span class="meta"><b>Здесь теперь можно рыбачить. Нажми на это место на карте, чтобы порыбачить.</b></span>` : ''}
      <div class="row end"><button class="btn" id="report-ok" data-report="ok">Понятно</button></div></div>`;
  }
  if (rep.outcome === 'death')
    return `<div class="card hot"><span class="card-name">Герой погиб: ${placeName(rep.id)}</span>
      <span class="meta">${dice}</span>
      <span class="meta">Броня сломана, бафы сброшены, припасы потрачены. Навыки, золото и находки остались. Броню нужно починить, иначе она не даёт силы.</span>
      <div class="row end"><button class="btn" id="report-ok" data-report="ok">Понятно</button></div></div>`;
  return `<div class="card hot"><span class="card-name">Пришлось отступить: ${placeName(rep.id)}</span>
    <span class="meta">${dice}</span>
    <span class="meta">Герой вернулся целым, но припасы потрачены. Подготовься лучше и попробуй снова.</span>
    <div class="row end"><button class="btn" id="report-ok" data-report="ok">Понятно</button></div></div>`;
}
function enchButton(what){
  const lvl = enchLevel(state, what);
  if (lvl >= MAX_ENCH) return '<span class="done">Чары на максимуме</span>';
  const cost = ENCH_COST[what][lvl], off = state.dust < cost || (what === 'armor' && state.armor.broken);
  return `<button class="btn" id="ench-${what}" data-ench="${what}" ${off ? 'disabled' : ''}>Зачаровать за ${cost} пыли</button>`;
}
let slotSel = 'armor';   // выбранный слот снаряжения
const SLOTS = {
  left:  [['helm', 'Шлем'], ['shoulders', 'Наплечники'], ['armor', 'Броня']],
  right: [['amulet', 'Амулет'], ['rod', 'Удочка'], ['boots', 'Сапоги']],
};
const slotName = id => SLOTS.left.concat(SLOTS.right).find(x => x[0] === id)[1];
function slotHtml([id, name]){
  const a = state.armor;
  let sub = 'пусто', cls = ' empty';
  if (id === 'armor'){ sub = a.broken ? 'сломана' : `целая · чары ${a.ench}`; cls = a.broken ? ' bad' : ''; }
  if (id === 'rod'){ sub = `${state.gear.includes('rod') ? 'бамбук' : 'орех'} · чары ${state.rodEnch}`; cls = ''; }
  return `<button class="slot${cls}" id="slot-${id}" data-slot="${id}" aria-pressed="${slotSel === id}">${name}<small>${sub}</small></button>`;
}
// очертания героя: пунктир там, где пусто, сплошная заливка там, где что-то надето
function figureSvg(){
  const broken = state.armor.broken;
  return `<svg class="figure" viewBox="0 0 96 190" aria-hidden="true">
    <circle cx="48" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5 5"/>
    <path d="M22 62Q48 46 74 62L68 118H28Z" fill="${broken ? 'none' : 'var(--line)'}" stroke="${broken ? 'var(--float)' : 'currentColor'}" stroke-width="3" stroke-linejoin="round"${broken ? ' stroke-dasharray="5 5"' : ''}/>
    <path d="M22 62L11 110M74 62L85 110M36 118L32 180M60 118L64 180" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 5"/>
    <path d="M85 112L92 34" fill="none" stroke="var(--fishbar)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
function slotDetail(){
  const a = state.armor;
  if (slotSel === 'armor') return `<div class="card">
      <div class="card-head"><span class="card-name">Броня</span><span class="stock">${a.broken ? 'Сломана' : 'Целая'} · чары ${a.ench} из ${MAX_ENCH}</span></div>
      <span class="meta">Целая броня даёт ${ARMOR_POWER} силы и ещё по 1 за каждый уровень чар. Ломается, если герой гибнет.</span>
      <div class="row end"><span class="btns">${a.broken
        ? `<button class="btn" id="repair-ore" data-repair="ore" ${state.ore < REPAIR_ORE ? 'disabled' : ''}>Починить: руда ×${REPAIR_ORE}</button>
           <button class="btn quiet" id="repair-gold" data-repair="gold" ${state.gold < REPAIR_GOLD ? 'disabled' : ''}>За ${REPAIR_GOLD} золота</button>`
        : enchButton('armor')}</span></div>
    </div>`;
  if (slotSel === 'rod') return `<div class="card">
      <div class="card-head"><span class="card-name">${state.gear.includes('rod') ? 'Бамбуковая удочка' : 'Ореховая удочка'}</span><span class="stock">чары ${state.rodEnch} из ${MAX_ENCH}</span></div>
      <span class="meta">Каждый уровень чар даёт на 8% больше времени на подсечку.</span>
      <div class="row end">${enchButton('rod')}</div>
    </div>`;
  return `<div class="card">
      <div class="card-head"><span class="card-name">${slotName(slotSel)}</span><span class="stock">пусто</span></div>
      <span class="meta">Слот свободен. Снаряжение для него появится вместе с кузнечным делом.</span>
    </div>`;
}
function buffsHtml(){
  const b = [];
  if (state.buffs.skill > 0) b.push(`Уха: +${BUFF_SKILL} рыболовства · забросов ${state.buffs.skill}`);
  if (state.buffs.luck > 0) b.push(`Удача: редкая рыба ×2 · забросов ${state.buffs.luck}`);
  return b.length ? b.map(x => `<span class="need">${x}</span>`).join('') : '<span class="meta">Бафов нет. Их даёт еда с кухни.</span>';
}
function renderHome(){
  const p = heroPower(state, []), fr = state.fresh, groups = {};
  state.trophies.forEach(t => (groups[t.n] = groups[t.n] || {k:0, t:t.t}).k++);
  const trophies = Object.entries(groups).map(([n, g]) =>
    `<div class="row"><span>${n}${g.k > 1 ? ' ×' + g.k : ''}<br><span class="meta">${fr && fr.names.includes(n) ? '<b>новое</b> · ' : ''}даст пыли: ${g.k * g.t * 2}</span></span>
     <button class="btn quiet" data-dust="${n}">Распылить</button></div>`).join('');
  const dishes = RECIPES.filter(r => state.dishes[r.id] > 0).map(r => `<span class="need">${r.name} ×${state.dishes[r.id]}</span>`).join('');
  const fish = Object.keys(FISH).filter(id => state.fish[id] > 0).map(id => `<span class="need">${fishSvg(id)}${FISH[id].name} ×${state.fish[id]}</span>`).join('');
  $('homeList').innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-name">${rank()}</span><span class="stock">Сила ${p.total}</span></div>
      <div class="hero"><div class="slots">${SLOTS.left.map(slotHtml).join('')}</div>${figureSvg()}<div class="slots">${SLOTS.right.map(slotHtml).join('')}</div></div>
      <div class="needs">${buffsHtml()}</div>
      <span class="meta">Сила складывается так: ${p.parts.filter(x => x.v).map(x => x.label.toLowerCase() + ' ' + x.v).join(', ')}.${state.armor.broken ? ' Сломанная броня силы не даёт.' : ''}</span>
      <span class="meta" id="heroLine">${heroStatus()}</span>
      ${state.hero.status !== 'home' ? '<div class="bar"><i id="heroBar"></i></div>' : ''}
    </div>
    ${slotDetail()}`;
  $('bagList').innerHTML = `
    <div class="card">
      <div class="card-head"><span class="card-name">Сумка</span><span class="stock">Руда ${state.ore} · Пыль ${state.dust}</span></div>
      ${fr ? `<span class="meta"><b>С последней вылазки: +${fr.gold} золота${fr.ore ? ', руда ×' + fr.ore : ''}${fr.names.length ? ', ' + [...new Set(fr.names)].join(', ') : ''}</b></span>` : ''}
      ${trophies || '<span class="meta">Трофеев нет. Герой приносит их с вылазок, а распылённые трофеи дают пыль для чар.</span>'}
      ${state.trophies.length > 1 ? `<button class="btn wide" id="dust-all" data-dust="*">Распылить все</button>` : ''}
      <span class="meta">Еда</span>
      <div class="needs">${dishes || '<span class="meta">пусто</span>'}</div>
      <span class="meta">Улов</span>
      <div class="needs">${fish || '<span class="meta">пусто</span>'}</div>
    </div>`;
  if (!$('settings').dataset.open) $('settings').innerHTML =
    `<button class="btn quiet" id="set-sound" data-set="sound">${state.sound ? 'Звук включён' : 'Звук выключен'}</button>
     <button class="btn quiet" id="set-refill" data-set="refill">Вернуть забросы</button>
     <button class="btn quiet" id="set-skip" data-set="skip">Пропустить ожидание героя</button>
     <button class="btn quiet" id="set-call" data-set="call">Позвать торговца</button>
     <button class="btn quiet" id="set-reset" data-set="reset">Начать заново</button>`;
}

/* карта */
function defaultCell(){
  if (state.hero.status === 'away') return state.hero.target;
  const near = Object.keys(CELLS).filter(id => cellState(state, id) === 'near').sort((x, y) => CELLS[x].d - CELLS[y].d);
  return near[0] || SERIES.goal;
}
function cellHtml(id){
  const c = CELLS[id], st = cellState(state, id);
  if (st === 'home') return `<button class="cell home" id="cell-home" data-tab="home">Убежище</button>`;
  const here = state.hero.status === 'away' && state.hero.target === id;
  let top = '', sub = 'туман';
  if (st === 'open'){ top = c.name; sub = c.goal ? 'огонь горит' : c.gather && c.gather.fish ? 'рыбалка' : 'разведано'; }
  else if (c.safe){ top = c.name; sub = 'разведка'; }
  else if (c.goal){ top = c.name; sub = st === 'near' ? `цель · сложность ${c.d}` : 'цель серии'; }
  else if (st === 'near'){ top = '?'; sub = `сложность ${c.d}`; }
  return `<button class="cell ${st}${c.goal ? ' goal' : ''}" id="cell-${id}" data-cell="${id}" aria-pressed="${sel === id}" ${st === 'fog' ? 'disabled' : ''}>${top ? `<b>${top}</b>` : ''}<small>${here ? 'герой здесь' : sub}</small></button>`;
}
function renderMap(){
  prunePack(state);
  if (!sel || cellState(state, sel) === 'fog' || sel === 'home') sel = defaultCell();
  $('mapGrid').innerHTML = Object.keys(CELLS).sort((x, y) => CELLS[x].r - CELLS[y].r || CELLS[x].c - CELLS[y].c).map(cellHtml).join('');
  const c = CELLS[sel], st = cellState(state, sel), h = state.hero, tier = TIERS[c.tier];
  const p = heroPower(state), chance = tripChance(state, sel);
  const packed = state.pack.map((id, i) => `<button class="need" id="unpack-${i}" data-unpack="${i}" aria-label="Убрать из припасов: ${recipeById(id).name}">${recipeById(id).name} +${recipeById(id).power} ✕</button>`).join('');
  const addable = state.pack.length < PACK_SIZE ? RECIPES.filter(r => packLeft(state, r.id) > 0).map(r =>
    `<button class="need add" id="pack-${r.id}" data-pack="${r.id}">+ ${r.name} (+${r.power}), есть ${packLeft(state, r.id)}</button>`).join('') : '';
  const goLabel = h.status === 'away' ? 'Герой уже в пути' : h.status === 'dead' ? 'Герой возрождается' : `${c.safe ? 'Разведать' : 'Отправиться'} · ${clock(tier.ms)}`;
  const water = st === 'open' && c.gather && c.gather.fish;
  const fishBtn = water ? `<button class="btn wide" id="fish-here" data-fishat="${water}">Рыбачить: ${WATERS[water].name.toLowerCase()}</button>` : '';
  if (c.safe){
    $('mapDetail').innerHTML = st === 'open'
      ? `<div class="card"><div class="card-head"><span class="card-name">${c.name}</span><span class="stock">Разведано</span></div>
          <span class="story">${c.text}</span>${fishBtn}</div>`
      : `<div class="card"><div class="card-head"><span class="card-name">${c.name}</span><span class="stock">Первая разведка</span></div>
          <span class="meta">Разведка безопасна: герой точно вернётся и принесёт первые находки. После неё здесь можно рыбачить.</span>
          <button class="btn wide" id="depart" data-depart="${sel}" ${h.status === 'home' ? '' : 'disabled'}>${goLabel}</button></div>`;
    return;
  }
  $('mapDetail').innerHTML = `<div class="card">
    <div class="card-head"><span class="card-name">${st === 'open' || c.goal ? c.name : 'Неразведанное место'}</span><span class="stock">Сложность ${c.d}</span></div>
    ${st === 'open' ? `<span class="story">${c.text}</span>${fishBtn}<span class="meta">Сюда можно ходить повторно за золотом, рудой и трофеями.</span>` : ''}
    <div class="row"><span><span class="chance">${chance}%</span><br><span class="meta">шанс успеха</span></span>
      <span class="meta" style="text-align:right">Сила ${p.total} против сложности ${c.d}.<br>Риск гибели ${deathRisk(chance)}%.</span></div>
    <span class="meta">Каждое очко силы меняет шанс на 10%. Припасы в дорогу, до ${PACK_SIZE} блюд, съедаются при выходе:</span>
    <div class="needs">${packed || '<span class="meta">пока ничего не взято</span>'}</div>
    ${addable ? `<div class="needs">${addable}</div>` : ''}
    <button class="btn wide" id="depart" data-depart="${sel}" ${h.status === 'home' ? '' : 'disabled'}>${goLabel}</button>
  </div>`;
}

/* торговец */
function sellRow(kind, id, name, n, m){
  const hot = wanted(m, kind, id), p = priceOf(state, kind, id), off = m.present ? '' : 'disabled';
  const one = n > 1 ? `<button class="btn quiet" id="sell1-${kind}-${id}" data-sell="${kind}:${id}:1" aria-label="Продать одну: ${name}" ${off}>Одну</button>` : '';
  return `<div class="card${hot ? ' hot' : ''}"><div class="row">
    <span><span class="card-name">${name} ×${n}</span><br><span class="meta">${hot ? `<b>по ${p}, вдвое дороже</b>` : 'по ' + p}</span></span>
    <span class="btns">${one}<button class="btn" id="sell-${kind}-${id}" data-sell="${kind}:${id}:all" aria-label="Продать все: ${name}" ${off}>Все за ${p * n}</button></span></div></div>`;
}
function renderMarket(){
  const now = Date.now(), m = merchant(state, now), wants = m.wants.map(goodName).join(' и '), off = m.present ? '' : 'disabled';
  $('merchantBox').innerHTML = (m.present
    ? `<span><b>Торговец здесь</b>, уйдёт через <span id="merchantTimer">${clock(m.endsAt - now)}</span></span><span>Платит вдвое за: ${wants}</span>`
    : `<span>Торговец придёт через <span id="merchantTimer">${clock(m.nextAt - now)}</span></span><span>Ему будут нужны: ${wants}. Заплатит вдвое.</span>`)
    + '<small>Продать улов и купить рецепты можно только при нём. В прототипе он приходит каждые 5 минут на 2 минуты.</small>';
  $('marketWares').hidden = !m.present;
  if (!m.present) return;
  const fish = Object.keys(FISH).filter(id => state.fish[id] > 0).map(id => sellRow('fish', id, FISH[id].name, state.fish[id], m));
  $('fishSell').innerHTML = fish.join('') || '<div class="empty">Садок пуст.</div>';
  const dishes = RECIPES.filter(r => state.dishes[r.id] > 0).map(r => sellRow('dish', r.id, r.name, state.dishes[r.id], m));
  $('dishSell').innerHTML = dishes.join('') || '<div class="empty">Готовых блюд нет.</div>';
  $('recipeList').innerHTML = RECIPES.map(r => {
    const st = recipeStatus(state, r);
    const where = [...new Set(Object.keys(r.needs).map(f => WATERS[FISH[f].water].name.toLowerCase()))].join(' и ');
    const needs = Object.entries(r.needs).map(([f, n]) => FISH[f].name + (n > 1 ? ' ×' + n : '')).join(', ');
    const action = st === 'known' ? '<span class="done">Изучен</span>'
      : st === 'locked' ? `<span class="done">С кулинарии ${r.skill}</span>`
      : `<button class="btn" id="buy-${r.id}" data-buy="${r.id}" ${st === 'poor' || !m.present ? 'disabled' : ''}>Купить за ${r.cost}</button>`;
    return `<div class="card"><div class="row"><span class="card-name">${r.name}</span>${action}</div>
      <span class="meta">${needs} · ${where}. В дорогу +${r.power} силы${r.eat ? ', еда: ' + EAT_TEXT[r.eat] : ''}. Цена ${r.sell}</span></div>`;
  }).join('');
  $('gearList').innerHTML = GEAR.map(g => {
    const own = state.gear.includes(g.id);
    return `<div class="card"><div class="row"><span class="card-name">${g.name}</span>${own ? '<span class="done">Куплено</span>'
      : `<button class="btn" id="gear-${g.id}" data-gear="${g.id}" ${state.gold < g.cost || !m.present ? 'disabled' : ''}>Купить за ${g.cost}</button>`}</div>
      <span class="meta">${g.text}</span></div>`;
  }).join('');
}
function renderReport(){
  $('reportLayer').hidden = !state.report;
  $('reportBox').innerHTML = state.report ? reportHtml(state.report) : '';
}
function renderAll(){ renderHud(); renderHome(); renderWaters(); renderWaterInfo(); renderBag(); renderCook(); renderMap(); renderMarket(); renderReport(); }

const TABS = ['map', 'home', 'fish'];
function showTab(t){
  if (t === 'fish' && !fishingOpen(state)){ t = 'map'; toast('Сначала разведай пруд на карте'); }
  if (tab === 'fish' && t !== 'fish') stopFishing();
  tab = t;
  for (const id of TABS) $('tab-' + id).hidden = id !== t;
  for (const id of ['map', 'home']) $('tabbtn-' + id).setAttribute('aria-selected', id === t);
  $('tabs').hidden = t === 'fish';   // занятие на весь экран, назад — стрелкой

  renderAll();
}

/* ---------- действия ---------- */
function doCook(id){
  const res = cook(state, recipeById(id));
  if (!res) return;
  sfx.cook(); buzz(10);
  if (res.up){
    sfx.up(); plusOne('cookBox');
    toast(`Готово. Кулинария выросла до ${state.cooking}`);
  } else {
    toast(res.color === 'grey' || state.cooking >= MAX_SKILL ? 'Готово. Этот рецепт кулинарию уже не растит' : 'Готово. В этот раз кулинария не выросла');
  }
  save(); renderAll();
  if (res.up) pop($('cookNum'));
}
function doEat(id){
  const r = recipeById(id);
  if (!eat(state, id)) return;
  sfx.eat(); buzz(12); toast(`${r.name}: ${EAT_TEXT[r.eat]}`);
  save(); renderAll();
}
function doSell(spec){
  const [kind, id, n] = spec.split(':');
  const sum = sell(state, kind, id, n === 'all' ? Infinity : 1);
  if (!sum) return;
  sfx.coin(); buzz(10); toast(`+${sum} золота`);
  save(); renderAll(); pop($('goldNum'));
}
function doBuy(id){
  const r = recipeById(id);
  if (!buyRecipe(state, r)) return;
  sfx.buy(); buzz([15, 30, 15]); toast(`Рецепт изучен: ${r.name}`);
  save(); renderAll(); pop($('goldNum'));
}
function doGear(id){
  const g = GEAR.find(x => x.id === id);
  if (!buyGear(state, g)) return;
  sfx.buy(); buzz([15, 30, 15]); toast(`${g.name}: ${g.text.toLowerCase()}`);
  save(); renderAll(); pop($('goldNum'));
}
function doDepart(id){
  if (!depart(state, id)) return;
  sfx.go(); buzz([15, 30, 15]); toast(`Герой ушёл. Вернётся через ${clock(state.hero.until - Date.now())}`);
  save(); renderAll();
}
function doDust(name){
  const got = disenchant(state, name === '*' ? null : name);
  if (!got) return;
  sfx.dust(); buzz(10); toast(`+${got} пыли`);
  save(); renderAll();
}
function doEnchant(what){
  if (!enchant(state, what)) return;
  sfx.buy(); buzz([15, 30, 15]); toast(what === 'armor' ? `Броня зачарована: сила +1` : 'Удочка зачарована: подсекать стало проще');
  save(); renderAll();
}
function doRepair(how){
  if (!repair(state, how)) return;
  sfx.cook(); buzz(15); toast('Броня починена и снова даёт силу');
  save(); renderAll(); if (how === 'gold') pop($('goldNum'));
}
function doSet(what){
  const box = $('settings'), now = Date.now();
  if (what === 'sound'){ state.sound = !state.sound; save(); renderHome(); if (state.sound) sfx.coin(); }
  else if (what === 'refill'){ state.energy = Math.max(state.energy, MAX_ENERGY); save(); renderAll(); toast('Забросы восстановлены. Кнопка только для теста'); }
  else if (what === 'skip'){
    if (state.hero.status === 'home') return toast('Герой и так дома');
    state.hero.until = now; tick();
  }
  else if (what === 'call'){ callMerchant(state, now); save(); renderAll(); toast('Торговец пришёл. Кнопка только для теста'); }
  else if (what === 'reset'){
    box.dataset.open = '1';
    box.innerHTML = 'Весь прогресс сотрётся. <button class="btn" id="set-reset-yes" data-set="reset-yes">Стереть</button><button class="btn quiet" id="set-reset-no" data-set="reset-no">Отмена</button>';
  }
  else {
    delete box.dataset.open;
    if (what === 'reset-yes'){ const sound = state.sound; state = newState(); state.sound = sound; sel = null; save(); stopFishing(); showTab('map'); toast('Начинаем серию заново'); }
    else renderHome();
  }
}

$('water').addEventListener('pointerdown', e => { e.preventDefault(); tapWater(); });
$('water').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat){ e.preventDefault(); tapWater(); } });
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.tab) showTab(d.tab);
  else if (d.go){ if (d.goCell) sel = d.goCell; showTab(d.go); }
  else if (d.cook) doCook(d.cook);
  else if (d.eat) doEat(d.eat);
  else if (d.sell) doSell(d.sell);
  else if (d.buy) doBuy(d.buy);
  else if (d.gear) doGear(d.gear);
  else if (d.set) doSet(d.set);
  else if (d.depart) doDepart(d.depart);
  else if (d.dust) doDust(d.dust);
  else if (d.ench) doEnchant(d.ench);
  else if (d.repair) doRepair(d.repair);
  else if (d.report){ state.report = null; save(); renderAll(); }
  else if (d.slot){ slotSel = d.slot; renderHome(); }
  else if (d.cell){ sel = d.cell; renderMap(); }
  else if (d.pack){ if (state.pack.length < PACK_SIZE && packLeft(state, d.pack) > 0){ state.pack.push(d.pack); save(); renderMap(); } }
  else if (d.unpack){ state.pack.splice(+d.unpack, 1); save(); renderMap(); }
  else if (d.fishat){ state.water = d.fishat; save(); showTab('fish'); }
  else if (d.water){ state.water = d.water; stopFishing(); save(); renderAll(); }
});

/* раз в полсекунды: возврат забросов, герой, торговец и таймеры */
let lastEnergy = null, lastMerchant = null;
function tick(){
  const now = Date.now();
  let ev, changed = false;
  while ((ev = resolveHero(state, now))){
    changed = true;
    if (ev === 'win'){ sfx.catch(true); toast('Герой вернулся с добычей'); }
    else if (ev === 'death'){ sfx.miss(); buzz([60, 40, 60]); toast('Герой погиб. Броня сломана, бафы сброшены'); }
    else if (ev === 'retreat'){ sfx.miss(); toast('Герой отступил и вернулся ни с чем'); }
    else toast('Герой снова дома');
  }
  const m = merchant(state, now);
  if (lastMerchant !== null && m.present !== lastMerchant){
    changed = true;
    toast(m.present ? `Пришёл торговец. Платит вдвое за: ${m.wants.map(goodName).join(' и ')}` : 'Торговец ушёл');
    if (m.present) sfx.coin();
  }
  lastMerchant = m.present;
  if (changed){ save(); renderAll(); }
  renderWaterInfo();
  if (state.energy !== lastEnergy){ lastEnergy = state.energy; save(); }
  renderGoal(now);
  const line = $('heroLine'); if (line) line.textContent = heroStatus(now);
  const bar = $('heroBar'), h = state.hero;
  if (bar && h.until) bar.style.width = Math.min(100, (now - h.start) / (h.until - h.start) * 100) + '%';
  const mt = $('merchantTimer'); if (mt) mt.textContent = clock((m.present ? m.endsAt : m.nextAt) - now);
}

function start(data){
  const saved = (data && data.state) || load(), fresh = newState();
  state = Object.assign(fresh, saved);
  state.buffs = Object.assign({skill:0, luck:0}, state.buffs);
  state.armor = Object.assign({broken:false, ench:0}, state.armor);
  state.cur = {bonus:0, luck:false};
  // старые сохранения: Заводь стала Прудом, а кто уже рыбачил, тому пруд открыт сразу
  state.opened = state.opened.map(id => id === 'zavod' ? 'prud' : id).filter(id => CELLS[id]);
  if (!state.opened.includes('prud') && state.casts > 0) state.opened.push('prud');
  if (state.hero.target === 'zavod') state.hero.target = 'prud';
  if (state.report && !CELLS[state.report.id]) state.report = null;
  if (!WATERS[state.water] || !waterOpen(state, state.water)) state.water = bestWater() || 'pond';
  $('energyMax').textContent = MAX_ENERGY;
  renderAll(); tick();
  setInterval(tick, 500);
}
start();
