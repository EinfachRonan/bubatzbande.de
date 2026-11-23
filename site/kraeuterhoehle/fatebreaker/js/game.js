/* FATEBREAKER – Spiellogik */
'use strict';
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('de-DE');

/* ================= Speicher ================= */
const SAVE_KEY = TESTMODE ? 'fatebreaker_test' : 'fatebreaker_v1';
function defMeta(){ return {runes:0, tal:{}, seen:{}, clear:{}, best:{}, intro:false, runs:0}; }
let META = (() => { try{ const r = localStorage.getItem(SAVE_KEY); if(r) return Object.assign(defMeta(), JSON.parse(r)); }catch(e){} return defMeta(); })();
if(TESTMODE){ META.runes = Math.max(META.runes, 99999); }
function saveMeta(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(META)); }catch(e){} }
const tl = id => META.tal[id] || 0;

/* ================= Bilder ================= */
const IMGS = {};
function img(path){ if(!IMGS[path]){ const i = new Image(); i.src = path; IMGS[path] = i; } return IMGS[path]; }
const heroImg = id => img('assets/h/' + id + '.png');
const iconSrc = id => 'assets/i/' + id + '.png';
function sheet(path){ const i = img(path); return i; }
// Vorladen
HEROES.forEach(h => { heroImg(h.id); sheet('assets/h/' + h.id + '_idle.png'); sheet('assets/h/' + h.id + '_atk.png'); });
Object.keys(ENEMIES).forEach(k => { img('assets/e/' + k + '.png'); sheet('assets/e/' + k + '_walk.png'); sheet('assets/e/' + k + '_atk.png'); });
Object.keys(BOSSES).forEach(k => { img('assets/b/' + k + '.png'); sheet('assets/b/' + k + '_idle.png'); sheet('assets/b/' + k + '_atk.png'); });
REGIONS.forEach(r => img('assets/bg/' + r.bg + '.png'));

/* ================= Skalierung der Bühne ================= */
function fit(){ const s = Math.min(innerWidth / 1280, innerHeight / 720); $('#stage').style.transform = `scale(${s})`; }
addEventListener('resize', fit); fit();
function stagePt(e){ const r = $('#stage').getBoundingClientRect(), s = r.width / 1280; return {x:(e.clientX - r.left) / s, y:(e.clientY - r.top) / s}; }

/* ================= Hilfen ================= */
function toast(msg, col){ const t = $('#toast'); t.innerHTML = msg; t.style.color = col || '#e6f4ff'; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => t.style.opacity = 0, 2200); }
function banner(b1, b2){ const b = $('#banner'); b.innerHTML = `<div class="b1">${b1}</div><div class="b2">${b2 || ''}</div>`; b.classList.remove('bannerAnim'); void b.offsetWidth; b.classList.add('bannerAnim'); }
function modal(html){ const m = $('#modal'); m.innerHTML = `<div class="box pnl">${html}</div>`; m.classList.remove('hidden'); return m; }
function closeModal(){ $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }

/* ================= Lauf-Zustand ================= */
let RUN = null, UID = 1;
const FIELD_CELLS = []; // 3 Spalten × 3 Reihen, Spalte 2 = vorne
for(let c = 0; c < 3; c++) for(let r = 0; r < 3; r++) FIELD_CELLS.push({c, r, x:86 + c * 104 + r * 14, y:312 + r * 44});
function fieldCap(){ return BAL.field + tl('t_field') + (hasRelic('re_ruinenstein') ? 1 : 0); }
function relicCap(){ return 6 + tl('t_relic'); }
function hasRelic(id){ return RUN && RUN.relics.includes(id); }
function rarOf(u){ return RARITY[u.rar]; }

function newRun(regIdx, diffIdx){
  const reg = REGIONS[regIdx], diff = DIFFS[diffIdx];
  RUN = {reg, regIdx, diff, diffIdx, wave:1, gold:BAL.startGold + 50 * tl('t_gold'), hearts:5 + tl('t_heart'), crystals:2 * tl('t_crys'),
    runes:0, spins:0, nudges:0, blasts:0, spinCount:0, units:[], relics:[], shop:[], shopFree:0, phase:'prep',
    grid:null, peek:null, lastWin:[], cheap:false, firstSpinDone:false, mercUsed:false, mvp:{}, speed:1};
  if(tl('t_merc')) RUN.relics.push('re_vertrag');
  META.runs++; saveMeta();
  // Startwalze
  RUN.grid = [[0,0,0],[0,0,0],[0,0,0]].map(row => row.map(() => rollSym(true)));
  RUN.peek = [0,0,0].map(() => rollSym(true));
  // Starthelden: 2 gewöhnliche
  const a = pick(CLASS_KEYS); let b = pick(CLASS_KEYS); if(b === a) b = pick(CLASS_KEYS);
  addUnit(makeUnit(a, 0)); addUnit(makeUnit(b, 0));
  $('#hub').classList.add('hidden');
  startPrep(true);
}

/* ================= Einheiten ================= */
function makeUnit(cls, rar){
  const line = rar === 4 ? 'leg' : rar >= 1 ? 'u' : 'c';
  const form = LINE_START[cls][line];
  META.seen[form] = 1;
  return {uid:UID++, form, cls, rar, level:1, traits:{}, fuse:0, where:'bench', pos:-1};
}
function benchFree(){ for(let i = 0; i < BAL.bench; i++) if(!RUN.units.some(u => u.where === 'bench' && u.pos === i)) return i; return -1; }
function cellFree(){ const cap = fieldCap(); const used = RUN.units.filter(u => u.where === 'field').length; if(used >= cap) return -1;
  const order = [7, 4, 1, 6, 3, 0, 8, 5, 2].map(i => i); // vorne Mitte zuerst
  for(const i of [4, 1, 7, 3, 0, 6, 5, 2, 8]) if(!RUN.units.some(u => u.where === 'field' && u.pos === i)) return i; return -1; }
function addUnit(u){
  let c = cellFree();
  if(c >= 0){ u.where = 'field'; u.pos = c; RUN.units.push(u); return true; }
  const b = benchFree();
  if(b >= 0){ u.where = 'bench'; u.pos = b; RUN.units.push(u); return true; }
  RUN.gold += 30; toast('Reserve voll – der Held wurde gegen 30 Gold eingetauscht.', '#ffd25a'); return false;
}
function unitStats(u){
  const h = HERO[u.form], c = CLASSES[u.cls], r = RARITY[u.rar];
  const lv = 1 + BAL.levelStat * (u.level - 1);
  let hp = c.hp * h.tier * r.mul * lv, atk = c.atk * h.tier * r.mul * lv, spd = c.spd, range = c.range, ms = c.ms;
  // Relikte & Synergien
  if(hasRelic('re_schaerfstein')) atk *= 1.08;
  if(u.cls === 'klinge' && hasRelic('re_kriegshorn')) spd *= 1.15;
  if(u.cls === 'schild' && hasRelic('re_turmwappen')) hp *= 1.25;
  if(u.cls === 'bogen' && hasRelic('re_elfenfeder')) atk *= 1.15;
  if(u.cls === 'stab' && hasRelic('re_linse')) atk *= 1.18;
  if(u.cls === 'klaue' && hasRelic('re_kette')) atk *= 1.15;
  if(!c.melee && hasRelic('re_falke')) range *= 1.15;
  const S = synergies();
  if(S.kampfkunst >= 2 && h.fac.includes('kampfkunst')) hp *= 1 + 0.15 * facMul();
  if(S.orden >= 4) hp *= 1 + 0.12 * facMul();
  if(S.wildnis >= 2 && h.fac.includes('wildnis')) spd *= 1 + 0.1 * facMul();
  if(S.leere >= 2 && h.fac.includes('leere')) atk *= 1 + 0.1 * facMul();
  return {hp, atk, spd, range, ms, melee:c.melee};
}
function facMul(){ return tl('t_fac2') ? 1.5 : 1; }
function synergies(){
  const S = {}; if(!RUN || !tl('t_fac')) return S;
  const seen = new Set();
  RUN.units.filter(u => u.where === 'field').forEach(u => { const key = u.form; if(seen.has(key)) return; seen.add(key); HERO[u.form].fac.forEach(f => S[f] = (S[f] || 0) + 1); });
  return S;
}

/* ================= Spielautomat ================= */
function rarityRoll(){
  const w = [100, 0, 0, 0, 0];
  if(tl('t_unc')) w[1] = 5 + 5 * tl('t_unc2');
  if(tl('t_rare')) w[2] = 2 + 1.5 * tl('t_rare2');
  if(tl('t_epic')) w[3] = 1;
  if(tl('t_leg')) w[4] = 0.4;
  if(hasRelic('re_sternkarte')) for(let i = 1; i < 5; i++) w[i] *= 1.5;
  if(TESTMODE && RUN && RUN.testRar) for(let i = 1; i < 5; i++) w[i] *= 6;
  let s = w.reduce((a, b) => a + b, 0), x = Math.random() * s;
  for(let i = 0; i < 5; i++){ if(x < w[i]) return i; x -= w[i]; } return 0;
}
function rollSym(noSpecial){
  const w = {}; CLASS_KEYS.forEach(c => w[c] = 10);
  if(!noSpecial){ w.joker = 1.2 * (1 + 0.6 * tl('t_joker')); if(tl('t_crown')) w.krone = 0.9 * (hasRelic('re_juwel') ? 2 : 1); }
  let s = 0; for(const k in w) s += w[k]; let x = Math.random() * s;
  for(const k in w){ if(x < w[k]) return k; x -= w[k]; } return 'klinge';
}
function lineWins(grid){
  const wins = [];
  LINES.forEach((L, li) => {
    const syms = L.map(([r, c]) => grid[r][c]);
    let base = syms.find(s => s !== 'joker');
    if(!base) base = 'joker';
    if(syms.every(s => s === base || s === 'joker')) wins.push({li, sym:base, cells:L});
  });
  return wins;
}
function spinCost(){ let c = BAL.spinCost; if(RUN.cheap) c = Math.round(c * 0.7); return c; }
function spinsMax(){ return BAL.spinsPerWave + tl('t_spin') + (hasRelic('re_hebel') ? 1 : 0); }

let spinning = false;
function doSpin(){
  if(spinning || !RUN || RUN.phase !== 'prep') return;
  if(RUN.spins <= 0){ toast('Keine Drehungen mehr in dieser Welle.'); return; }
  const cost = spinCost();
  if(RUN.gold < cost){ toast('Nicht genug Gold.', '#ff6a6a'); return; }
  RUN.gold -= cost; RUN.spins--; RUN.spinCount++; RUN.cheap = false;
  spinning = true;
  // Walzenbänder: Symbole hängen in Reihen oft zusammen (wie bei echten Automaten)
  const g = [[0,0,0],[0,0,0],[0,0,0]].map(row => row.map(() => rollSym()));
  for(let r = 0; r < 3; r++) for(let c = 1; c < 3; c++) if(Math.random() < BAL.stick && g[r][c - 1] !== 'krone') g[r][c] = g[r][c - 1];
  for(let c = 0; c < 3; c++) for(let r = 1; r < 3; r++) if(Math.random() < BAL.stick * 0.25) g[r][c] = g[r - 1][c];
  if(hasRelic('re_jokerstern') && RUN.spinCount % 5 === 0) g[1][1] = 'joker';
  RUN.peek = [0,0,0].map(() => rollSym());
  RUN.grid = g; RUN.lastWin = [];
  renderReels(true);
  const cells = [...document.querySelectorAll('#reels .cell')];
  cells.forEach(c => c.classList.add('spin'));
  [0, 1, 2].forEach(col => setTimeout(() => { cells.filter(c => +c.dataset.c === col).forEach(c => c.classList.remove('spin')); renderReels(false); }, 380 + col * 230));
  setTimeout(() => {
    spinning = false;
    const wins = lineWins(RUN.grid);
    if(!wins.length){
      if(hasRelic('re_wuerfel') && !RUN.firstSpinDone){ RUN.firstSpinDone = true; RUN.spins++; RUN.spinCount--; RUN.gold += cost; toast('Schicksalswürfel: Die Drehung wird wiederholt!', '#c06aff'); updateUI(); setTimeout(doSpinFree, 400); return; }
      if(hasRelic('re_muenze')) RUN.cheap = true;
    }
    RUN.firstSpinDone = true;
    payWins(wins);
    updateUI();
  }, 1000);
  updateUI();
}
function doSpinFree(){ RUN.gold += spinCost(); doSpin(); }
function payWins(wins, prev){
  const prevKeys = new Set((prev || []).map(w => w.li + ':' + w.sym));
  const fresh = wins.filter(w => !prevKeys.has(w.li + ':' + w.sym));
  RUN.lastWin = wins;
  renderReels(false);
  let delay = 0;
  fresh.forEach(w => {
    setTimeout(() => {
      if(w.sym === 'krone') return crownPick();
      const cls = w.sym === 'joker' ? pick(CLASS_KEYS) : w.sym;
      let rar = rarityRoll(); if(w.sym === 'joker') rar = Math.min(4, rar + 1);
      const u = makeUnit(cls, rar);
      if(addUnit(u)){ const h = HERO[u.form]; toast(`<span style="color:${RARITY[rar].col}">${RARITY[rar].n}</span> · ${h.n} beschworen!`, RARITY[rar].col); if(rar >= 2) banner(RARITY[rar].n.toUpperCase(), h.n); }
      updateUI();
    }, delay);
    delay += 380;
  });
}
function nudge(col){
  if(!RUN || RUN.phase !== 'prep' || spinning) return;
  if(RUN.nudges <= 0){ toast('Kein Walzenstoß mehr übrig.'); return; }
  if(!RUN.spinCount){ toast('Erst einmal drehen.'); return; }
  RUN.nudges--;
  const prev = lineWins(RUN.grid), g = RUN.grid;
  g[2][col] = g[1][col]; g[1][col] = g[0][col]; g[0][col] = RUN.peek[col]; RUN.peek[col] = rollSym();
  payWins(lineWins(g), prev); updateUI();
}
let blastMode = false;
function toggleBlast(){ if(!RUN || RUN.blasts <= 0 || !RUN.spinCount) return toast('Sprengen ist gerade nicht möglich.'); blastMode = !blastMode; renderReels(false); toast(blastMode ? 'Wähle ein Symbol: alle Symbole dieser Sorte werden gesprengt.' : 'Sprengen abgebrochen.', '#c06aff'); }
function blast(sym){
  blastMode = false; RUN.blasts--;
  const prev = lineWins(RUN.grid), g = RUN.grid;
  for(let c = 0; c < 3; c++){
    const keep = [g[0][c], g[1][c], g[2][c]].filter(s => s !== sym);
    while(keep.length < 3) keep.unshift(rollSym());
    for(let r = 0; r < 3; r++) g[r][c] = keep[r];
  }
  const cells = [...document.querySelectorAll('#reels .cell')]; cells.forEach(c => c.classList.add('blast'));
  setTimeout(() => { payWins(lineWins(g), prev); updateUI(); }, 300);
}
function crownPick(){
  const rar = Math.min(4, rarityRoll() + 1), opts = [];
  const cl = [...CLASS_KEYS].sort(() => Math.random() - .5).slice(0, 3);
  cl.forEach(c => opts.push(makeUnit(c, rar)));
  showPick('KÖNIGSRECHT', 'Wähle einen Helden', opts, u => { addUnit(u); updateUI(); });
}
function mercPick(){
  if(RUN.mercUsed) return toast('Der Söldnervertrag wurde in dieser Welle schon genutzt.');
  if(RUN.gold < 150) return toast('Nicht genug Gold (150).', '#ff6a6a');
  RUN.gold -= 150; RUN.mercUsed = true;
  const opts = [...CLASS_KEYS].sort(() => Math.random() - .5).slice(0, 3).map(c => makeUnit(c, 0));
  showPick('SÖLDNERVERTRAG', 'Wähle einen Söldner', opts, u => { addUnit(u); updateUI(); });
}
function showPick(sys, title, opts, cb){
  const m = modal(`<div class="sys">${sys}</div><h2>${title}</h2><div class="cards">${opts.map((u, i) => heroCard(u, i)).join('')}</div>`);
  m.querySelectorAll('.card').forEach(el => el.onclick = () => { closeModal(); cb(opts[+el.dataset.i]); });
}
function heroCard(u, i, formOverride){
  const f = formOverride || u.form, h = HERO[f], r = RARITY[u.rar], c = CLASSES[h.cls];
  const st = unitStats(Object.assign({}, u, {form:f}));
  return `<div class="card" data-i="${i}" style="border-color:${r.col}">
    <div style="font:800 13px 'Pixelify Sans';letter-spacing:3px;color:${u.rar ? r.col : '#5a4a38'};text-shadow:${u.rar ? '0 1px 0 rgba(0,0,0,.45)' : 'none'}">${r.n.toUpperCase()} · ${c.n.toUpperCase()}</div>
    <img class="big px" src="assets/h/${f}.png" alt="">
    <div style="font:600 20px 'Pixelify Sans'">${h.n}</div>
    <div class="stat"><span>❤ ${fmt(st.hp)}</span><span>⚔ ${fmt(st.atk)}</span><span>» ${st.spd.toFixed(2)}/s</span><span>◎ ${Math.round(st.range)}</span></div>
    <div class="small" style="margin-top:4px"><b style="color:var(--acc)">${h.sk.n}</b> – ${skillText(h.sk)}</div>
    <div class="ic-row" style="justify-content:center;margin-top:6px">${h.fac.map(fc => `<img class="px" src="${iconSrc(FACTIONS[fc].icon)}" title="${FACTIONS[fc].n}">`).join('')}
      <img class="px" src="${iconSrc(TRAITS[h.gift].icon)}" title="Gibt: ${TRAITS[h.gift].n}"></div>
  </div>`;
}
function skillText(s){
  const p = v => Math.round(v * 100) + '%';
  switch(s.t){
    case 'strike': return `${p(s.m)} Schaden${s.pick === 'lowest' ? ' am schwächsten Gegner' : s.pick === 'highest' ? ' am stärksten Gegner' : s.pick === 'back' ? ' am hintersten Gegner' : ''}${s.splash ? ' im Umkreis' : ''}${s.stun ? `, betäubt ${s.stun}s` : ''}${s.root ? `, fesselt ${s.root}s` : ''}${s.slow ? ', verlangsamt' : ''}${s.burn ? ', verbrennt' : ''}${s.bleed ? ', Blutung' : ''}${s.heal ? `, heilt ${p(s.heal)} des Schadens` : ''}${s.exec ? `, vernichtet unter ${p(s.exec)} LP` : ''}${s.pierce ? `, durchbohrt ${s.pierce}` : ''}.`;
    case 'multi': return `${s.hits}× ${p(s.m)} Schaden${s.pick === 'random' ? ' auf zufällige Gegner' : ''}${s.chain ? ' (springt über)' : ''}${s.slow ? ', verlangsamt' : ''}${s.bleed ? ', Blutung' : ''}.`;
    case 'aoe': return `${p(s.m)} Flächenschaden${s.r >= 999 ? ' an allen Gegnern' : ''}${s.ticks ? ` (${s.ticks}×)` : ''}${s.stun ? `, betäubt ${s.stun}s` : ''}${s.root ? `, fesselt ${s.root}s` : ''}${s.slow ? ', verlangsamt' : ''}${s.burn ? ', verbrennt' : ''}${s.knock ? ', stößt zurück' : ''}${s.exec ? `, vernichtet unter ${p(s.exec)} LP` : ''}${s.pull ? ', zieht Gegner heran' : ''}${s.buff ? `, Team +${p(s.buff.atk)} Schaden` : ''}${s.summon ? ', ruft Wölfe' : ''}.`;
    case 'heal': return `Heilt ${s.all ? 'alle Helden' : s.cnt + ' schwächste Helden'} um ${p(s.pct)}${s.barrier ? ` + Barriere ${p(s.barrier)}` : ''}${s.cleanse ? ', entfernt Schwächungen' : ''}.`;
    case 'barrier': return `Barriere ${p(s.pct)} ${s.all ? 'für alle Helden' : 'für den schwächsten Helden'}${s.block ? `, alle blocken ${s.block}s` : ''}.`;
    case 'block': return `Blockt ${s.dur}s jeden Schaden${s.reflect ? ' und wirft ihn danach zurück' : ''}.`;
    case 'taunt': return `Zieht ${s.dur}s alle Gegner auf sich, −${p(s.red)} Schaden${s.barrier ? `, Barriere ${p(s.barrier)}` : ''}.`;
    case 'summon': return `Ruft ${s.cnt} ${SUMMONS[s.kind].n}${s.cnt > 1 ? 'e' : ''}.`;
    case 'buff': return s.team ? `Team +${s.mana} Mana, heilt ${p(s.heal)}.` : s.dodge ? `Weicht ${s.dur}s ${p(s.dodge)} aller Angriffe aus, dann ${p(s.m)} Schaden.` : s.red ? `−${p(s.red)} erlittener Schaden für ${s.dur}s.` : `+${p(s.spd)} Angriffstempo und ${p(s.lifesteal)} Lebensraub für ${s.dur}s.`;
  }
  return '';
}

/* ================= Verschmelzen & Entwicklung ================= */
function absorb(target, src){
  if(target === src) return;
  if(RUN.phase !== 'prep') return toast('Verschmelzen geht nur zwischen den Kämpfen.');
  const sh = HERO[src.form], gift = sh.gift;
  let xp = 1 + Math.floor(src.level / 2) + RARITY[src.rar].xp - 1;
  let learned = '';
  if(target.traits[gift]){ if(target.traits[gift] < 5){ target.traits[gift]++; learned = `${TRAITS[gift].n} → Stufe ${target.traits[gift]}`; xp = Math.max(1, Math.floor(xp / 2)); } }
  else if(Object.keys(target.traits).length < RARITY[target.rar].slots){ target.traits[gift] = 1; learned = `lernt ${TRAITS[gift].n}`; }
  if(hasRelic('re_griff')) xp++;
  target.fuse++; if(tl('t_xp') && target.fuse % 2 === 0) xp++;
  RUN.units = RUN.units.filter(u => u !== src);
  const before = target.level; target.level = Math.min(MAX_LEVEL, target.level + xp);
  toast(`${HERO[target.form].n}: Stufe ${before} → ${target.level}${learned ? ' · ' + learned : ''}`, '#5ef0ff');
  checkEvolve(target, before);
  updateUI();
}
function checkEvolve(u, before){
  const h = HERO[u.form];
  for(const L of EVO_LEVELS){
    if(before < L && u.level >= L){
      const opts = evoOptions(h); if(!opts.length) return;
      if(opts.length === 1){ evolveTo(u, opts[0]); continue; }
      const m = modal(`<div class="sys">◆ KLASSENAUFSTIEG ◆</div><h2>${h.n} entwickelt sich</h2><div class="cards">${opts.map((f, i) => heroCard(u, i, f)).join('')}</div>`);
      m.querySelectorAll('.card').forEach(el => el.onclick = () => { closeModal(); evolveTo(u, opts[+el.dataset.i]); if(u.level >= 10 && L === 5) checkEvolve(u, 9); });
      return;
    }
  }
}
function evolveTo(u, f){ u.form = f; META.seen[f] = 1; saveMeta(); banner('AUFSTIEG', HERO[f].n); updateUI(); }

/* ================= Wellen ================= */
function waveType(w){ const W = RUN.diff.waves; if(w === 10 || w === W) return 'boss'; if(w % 5 === 0) return 'elite'; return 'normal'; }
function buildWave(w){
  const reg = RUN.reg, type = waveType(w), list = [];
  const n = Math.round(4 + w * 1.0 + (RUN.diffIdx ? 2 : 0));
  const pool = reg.pool.filter((k, i) => !(ENEMIES[k].kind === 'tank' && w < 3));
  for(let i = 0; i < n; i++){
    let k = pick(pool);
    if(ENEMIES[k].kind === 'tank' && Math.random() < 0.5) k = pick(pool);
    list.push({k, t:i * rnd(0.7, 1.1)});
  }
  if(type === 'elite') list.push({k:reg.elite, t:n * 0.6}), w >= 15 && list.push({k:reg.elite, t:n * 0.9});
  if(type === 'boss'){ list.push({k:w === RUN.diff.waves && w === 20 ? reg.boss20 : reg.boss10, boss:true, t:2}); }
  return list.sort((a, b) => a.t - b.t);
}

/* ================= Phasen ================= */
function startPrep(first){
  RUN.phase = 'prep'; RUN.spins = spinsMax(); RUN.nudges = 1 + tl('t_nudge'); RUN.blasts = tl('t_blast') ? 1 : 0;
  RUN.firstSpinDone = false; RUN.mercUsed = false; RUN.shopFree = tl('t_reroll') ? 1 : 0;
  if(!first){
    if(hasRelic('re_zinsbeutel')) RUN.gold += Math.min(60, Math.floor(RUN.gold / 100) * 10);
  }
  rollShop(); B = null; resetBattleView();
  updateUI();
  const t = waveType(RUN.wave);
  banner(`WELLE ${RUN.wave}`, t === 'boss' ? 'BOSSWELLE' : t === 'elite' ? 'PRÜFUNGSWELLE' : RUN.reg.n.toUpperCase());
}
function startBattle(){
  if(!RUN || RUN.phase !== 'prep' || spinning) return;
  const field = RUN.units.filter(u => u.where === 'field');
  if(!field.length) return toast('Stelle mindestens einen Helden aufs Feld.', '#ff6a6a');
  closeModal(); RUN.phase = 'battle'; blastMode = false; SEL = null; $('#unitpanel').classList.add('hidden');
  initBattle(buildWave(RUN.wave));
  updateUI();
}
function endBattle(won, leaked){
  RUN.phase = 'reward';
  const type = waveType(RUN.wave);
  if(!won){
    if(type !== 'normal'){ return runOver(false); }
    if(!(tl('t_safe') && RUN.wave <= 3)) RUN.hearts -= 1;
    if(RUN.hearts <= 0) return runOver(false);
    banner('NIEDERLAGE', '−1 Leben');
  } else {
    let g = BAL.waveGold + 15 * RUN.wave; if(type !== 'normal' && hasRelic('re_bernstein')) g *= 1.5;
    RUN.gold += Math.round(g);
    let runes = type === 'elite' ? 4 : type === 'boss' ? (RUN.wave >= 20 ? 14 : 8) : 1;
    runes = Math.round(runes * RUN.diff.runes * (1 + RUN.regIdx * 0.6) * (1 + 0.2 * tl('t_runes')));
    const key = RUN.reg.id + '-' + RUN.diff.id + '-' + RUN.wave;
    if(type !== 'normal' && !META.clear[key]){ runes *= 2; META.clear[key] = 1; }
    RUN.runes += runes; META.runes += runes; saveMeta();
    banner('SIEG', `+${Math.round(g)} Gold${runes ? ' · +' + runes + ' Runen' : ''}`);
  }
  if(won && RUN.wave >= RUN.diff.waves) return setTimeout(() => runOver(true), 1600);
  RUN.wave++;
  setTimeout(() => startPrep(false), 1700);
}
function runOver(won){
  RUN.phase = 'over';
  const key = RUN.reg.id + '-' + RUN.diff.id;
  META.best[key] = Math.max(META.best[key] || 0, RUN.wave - (won ? 0 : 1));
  if(won){ META.clear[key] = 1; }
  saveMeta();
  const mvp = Object.entries(RUN.mvp).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const m = modal(`<div class="sys">◆ SYSTEM ◆</div><h2 style="color:${won ? '#ffd25a' : '#ff6a6a'}">${won ? 'GEBIET BEFREIT' : 'DER LAUF IST VORBEI'}</h2>
    <div style="text-align:center;font:600 18px 'Pixelify Sans'">${RUN.reg.n} · ${RUN.diff.n} · Welle ${RUN.wave}/${RUN.diff.waves}</div>
    <div style="text-align:center;font:700 22px 'Pixelify Sans';margin:10px 0"><img class="px" src="${iconSrc('ic_rune')}" style="width:28px;vertical-align:middle"> +${RUN.runes} Runen</div>
    ${mvp.length ? `<div class="sys" style="margin-top:6px">MVP</div><div class="cards">${mvp.map(([f, d]) => `<div style="text-align:center"><img class="px" src="assets/h/${f}.png" style="width:72px"><div class="small">${HERO[f].n}<br>${fmt(d)} Schaden</div></div>`).join('')}</div>` : ''}
    <div style="text-align:center;margin-top:14px"><button class="btn gold big" id="toHub">Zurück</button></div>`);
  m.querySelector('#toHub').onclick = () => { closeModal(); RUN = null; B = null; showHub(); };
}

/* ================= Laden ================= */
function rollShop(){
  const pool = RELICS.filter(r => !RUN.relics.includes(r.id));
  RUN.shop = pool.sort(() => Math.random() - .5).slice(0, 3).map(r => r.id);
}
function openShop(){
  if(!RUN || RUN.phase !== 'prep') return toast('Der Laden ist nur zwischen den Kämpfen geöffnet.');
  const cost = RUN.shopFree > 0 ? 0 : 1;
  const m = modal(`<div class="sys">◆ HÄNDLER DER LEERE ◆</div><h2>Relikte</h2>
    <div style="text-align:center;font:700 18px 'Pixelify Sans'"><img class="px" src="${iconSrc('ic_kristall')}" style="width:22px;vertical-align:middle"> ${RUN.crystals} Kristalle · Plätze ${RUN.relics.length}/${relicCap()}</div>
    <div class="cards">${RUN.shop.map((id, i) => { const r = RELIC[id], p = RELIC_PRICE[r.r]; return `<div class="card" data-i="${i}" style="border-color:${['#c8ccd4','#5ee07a','#4aa8ff','#ffc83a'][r.r]}">
      <img class="px" src="${iconSrc(id)}" style="width:64px;height:64px"><div style="font:600 18px 'Pixelify Sans';margin:4px 0">${r.n}</div><div class="small">${r.d}</div>
      <div style="margin-top:8px;font:700 18px 'Pixelify Sans'"><img class="px" src="${iconSrc('ic_kristall')}" style="width:18px;vertical-align:middle"> ${p}</div></div>`; }).join('') || '<div class="small">Ausverkauft.</div>'}</div>
    <div style="text-align:center;margin-top:14px;display:flex;gap:10px;justify-content:center">
      <button class="btn" id="reroll">Erneuern (${cost} 💎)</button>
      ${hasRelic('re_vertrag') ? `<button class="btn" id="merc" ${RUN.mercUsed ? 'disabled' : ''}>Söldner (150 Gold)</button>` : ''}
      <button class="btn gold" id="close">Schließen</button></div>`);
  m.querySelectorAll('.card').forEach(el => el.onclick = () => {
    const id = RUN.shop[+el.dataset.i], p = RELIC_PRICE[RELIC[id].r];
    if(RUN.relics.length >= relicCap()) return toast('Keine freien Reliktplätze.', '#ff6a6a');
    if(RUN.crystals < p) return toast('Nicht genug Kristalle.', '#ff6a6a');
    RUN.crystals -= p; RUN.relics.push(id); RUN.shop.splice(+el.dataset.i, 1); toast(`${RELIC[id].n} erworben!`, '#ffd25a'); updateUI(); openShop();
  });
  m.querySelector('#reroll').onclick = () => { if(RUN.shopFree > 0) RUN.shopFree--; else { if(RUN.crystals < 1) return toast('Nicht genug Kristalle.'); RUN.crystals--; } rollShop(); updateUI(); openShop(); };
  const mb = m.querySelector('#merc'); if(mb) mb.onclick = () => { closeModal(); mercPick(); };
  m.querySelector('#close').onclick = closeModal;
}
function sellRelic(id){
  if(!RUN || RUN.phase !== 'prep') return;
  const r = RELIC[id], back = Math.max(1, Math.floor(RELIC_PRICE[r.r] / 2));
  if(!confirm(`${r.n} für ${back} Kristalle verkaufen?`)) return;
  RUN.relics = RUN.relics.filter(x => x !== id); RUN.crystals += back; updateUI();
}

/* ================= UI ================= */
function renderReels(anim){
  if(!RUN) return;
  const winCells = new Set(); (RUN.lastWin || []).forEach(w => w.cells.forEach(([r, c]) => winCells.add(r + ',' + c)));
  $('#reels').innerHTML = RUN.grid.map((row, r) => row.map((s, c) => `<div class="cell ${winCells.has(r + ',' + c) ? 'win' : ''} ${blastMode ? 'blast' : ''}" data-r="${r}" data-c="${c}"><img class="px" src="${iconSrc(SYM_ICON[s])}" alt=""></div>`).join('')).join('');
  $('#peek').innerHTML = RUN.peek.map(s => `<div title="Fällt beim Walzenstoß nach">▾<img src="${iconSrc(SYM_ICON[s])}"></div>`).join('');
  document.querySelectorAll('#reels .cell').forEach(el => el.onclick = () => { if(blastMode) blast(RUN.grid[+el.dataset.r][+el.dataset.c]); });
}
function updateUI(){
  if(!RUN) return;
  $('#gold').textContent = fmt(RUN.gold); $('#hearts').textContent = RUN.hearts; $('#crys').textContent = RUN.crystals; $('#runesrun').textContent = RUN.runes;
  $('#fieldcnt').textContent = RUN.units.filter(u => u.where === 'field').length + '/' + fieldCap();
  $('#regname').textContent = `${RUN.reg.n} · ${RUN.diff.n}`;
  $('#spinsleft').textContent = `${RUN.spins}/${spinsMax()}`;
  const prep = RUN.phase === 'prep';
  $('#spinbtn').disabled = !prep || RUN.spins <= 0 || spinning; $('#spinbtn').innerHTML = `Drehen <span class="num" style="font-size:20px">${spinCost()}</span>`;
  $('#spininfo').innerHTML = `Stoß ${RUN.nudges}${RUN.blasts ? `<br><button class="btn" id="blastbtn" style="padding:2px 8px;font-size:13px;margin-top:4px">Sprengen (${RUN.blasts})</button>` : ''}`;
  const bb = $('#blastbtn'); if(bb) bb.onclick = toggleBlast;
  $('#nudges').innerHTML = [0, 1, 2].map(c => `<button class="btn" data-c="${c}" ${(!prep || !RUN.nudges || !RUN.spinCount) ? 'disabled' : ''}>▼ Stoß</button>`).join('');
  document.querySelectorAll('#nudges button').forEach(b => b.onclick = () => nudge(+b.dataset.c));
  $('#fightbtn').disabled = !prep; $('#shopbtn').disabled = !prep;
  // Wellenleiste
  const W = RUN.diff.waves, from = Math.max(1, Math.min(RUN.wave - 3, W - 6));
  let wb = ''; for(let w = from; w < from + 7 && w <= W; w++){ const t = waveType(w); wb += `<div class="wv ${w < RUN.wave ? 'done' : w === RUN.wave ? 'cur' : ''} ${t}"><span>${w}</span></div>`; }
  const nb = []; for(let w = RUN.wave; w <= W; w++) if(waveType(w) === 'boss'){ nb.push(w); break; }
  $('#wavebar').innerHTML = wb + `<span style="margin-left:6px">${nb.length ? (nb[0] === RUN.wave ? '☠ BOSS!' : `☠ in ${nb[0] - RUN.wave}`) : ''}</span>`;
  // Reserve
  let bh = ''; for(let i = 0; i < BAL.bench; i++){ const u = RUN.units.find(x => x.where === 'bench' && x.pos === i); bh += `<div class="slot ${u && SEL === u.uid ? 'hl' : ''}" data-bench="${i}">${u ? unitSlotHtml(u) : ''}</div>`; }
  $('#benchslots').innerHTML = bh;
  // Relikte
  let rh = ''; for(let i = 0; i < relicCap(); i++){ const id = RUN.relics[i]; rh += `<div class="rel" ${id ? `data-relic="${id}"` : ''}>${id ? `<img class="px" src="${iconSrc(id)}">` : ''}</div>`; }
  $('#relicslots').innerHTML = rh; $('#relcnt').textContent = RUN.relics.length + '/' + relicCap();
  document.querySelectorAll('#relicslots .rel[data-relic]').forEach(el => { el.onmouseenter = e => showRelicInfo(el.dataset.relic, e); el.onmouseleave = hideInfo; el.oncontextmenu = e => { e.preventDefault(); sellRelic(el.dataset.relic); }; });
  // Synergien
  const S = synergies();
  $('#syn').innerHTML = tl('t_fac') ? Object.keys(FACTIONS).filter(f => S[f]).map(f => `<div class="syn ${S[f] >= 2 ? 'on' : ''}" title="${FACTIONS[f].n}: (2) ${FACTIONS[f].b2} · (4) ${FACTIONS[f].b4}"><img class="px" src="${iconSrc(FACTIONS[f].icon)}">${S[f]}</div>`).join('') : '';
  $('#tip').textContent = prep ? (RUN.spinCount ? 'Helden aufeinander ziehen = verschmelzen.' : '3 gleiche Symbole in Reihe oder Diagonale = Held.') : RUN.phase === 'battle' ? 'Der Kampf läuft …' : '';
  renderReels(false);
}
function unitSlotHtml(u){
  const r = RARITY[u.rar];
  return `<img class="u px" src="assets/h/${u.form}.png" alt=""><div class="lv">Lv${u.level}</div><div class="rar" style="background:${r.col};box-shadow:0 0 6px ${r.col}"></div>
    <div class="trs">${Object.keys(u.traits).map(t => `<img class="px" src="${iconSrc(TRAITS[t].icon)}">`).join('')}</div>`;
}
let SEL = null;
function showUnitTip(u, x, y){
  const h = HERO[u.form], r = RARITY[u.rar], st = unitStats(u);
  $('#info').innerHTML = `<div class="tipbox"><div class="h" style="color:${r.col}">${h.n}</div>
    <div class="ic-row">❤ ${fmt(st.hp)}</div><div class="ic-row">⚔ ${fmt(st.atk)}</div><div class="ic-row">» ${st.spd.toFixed(2)}/s</div><div class="ic-row">◎ ${Math.round(st.range)}</div>
    <div class="small">Lv ${u.level} · ${r.n}</div></div>`;
  const el = $('#info'); el.classList.remove('hidden'); el.style.left = clamp(x + 18, 4, 1130) + 'px'; el.style.top = clamp(y - 150, 4, 560) + 'px';
}
function showUnitInfo(u){
  const h = HERO[u.form], r = RARITY[u.rar], st = unitStats(u), c = CLASSES[u.cls];
  const nextEvo = evoOptions(h).length ? EVO_LEVELS.find(L => L > u.level) : null, cap = nextEvo || MAX_LEVEL;
  const tr = Object.entries(u.traits); let rows = '';
  for(let i = 0; i < 5; i++){
    if(i < tr.length){ const [t, l] = tr[i]; rows += `<div class="tslot" title="${TRAITS[t].d(l)}"><div class="ib"><img src="${iconSrc(TRAITS[t].icon)}"></div><div><div class="tn2">${TRAITS[t].n} ${'I'.repeat(Math.min(l, 3))}${l > 3 ? l : ''}</div><div class="td">${TRAITS[t].d(l)}</div></div></div>`; }
    else if(i < r.slots) rows += `<div class="tslot"><div class="ib"></div><div class="tn2" style="color:var(--mut)">Leer</div></div>`;
    else rows += `<div class="tslot lock"><div class="ib"></div><div class="tn2">Gesperrt</div></div>`;
  }
  const P = $('#unitpanel'); P.classList.remove('hidden');
  P.innerHTML = `<button class="btn" id="uclose">✕</button>
    <div class="uname"><img src="${iconSrc(c.icon)}"><span style="color:${u.rar ? r.col : 'var(--txt)'}">${h.n}</span></div>
    <div class="ulv"><span>LV. ${u.level}</span><img src="assets/h/${u.form}.png" style="width:72px;height:72px;margin:-14px 0 -8px"></div>
    <div class="urow"><span>${u.level}/${cap}${nextEvo ? ' bis Aufstieg' : ''}</span><span style="color:${r.col}">${r.n}</span></div>
    <div class="xpbar"><div style="width:${Math.min(100, u.level / cap * 100)}%"></div></div>
    <div class="stat" style="margin-top:6px"><span>❤ ${fmt(st.hp)}</span><span>⚔ ${fmt(st.atk)}</span><span>» ${st.spd.toFixed(2)}/s</span><span>◎ ${Math.round(st.range)}</span></div>
    <div style="padding:2px 6px"><span style="font:500 20px 'Pixelify Sans';color:var(--acc)">${h.sk.n}</span><div class="small">${skillText(h.sk)}</div></div>
    ${rows}
    <div class="small" style="padding:2px 6px">${h.fac.map(f => `<img src="${iconSrc(FACTIONS[f].icon)}" style="width:18px;vertical-align:middle"> ${FACTIONS[f].n}`).join(' · ')}</div>
    <div class="small" style="padding:2px 6px">Gibt beim Verschmelzen: <img src="${iconSrc(TRAITS[h.gift].icon)}" style="width:16px;vertical-align:middle"> <span style="color:var(--txt)">${TRAITS[h.gift].n}</span></div>`;
  $('#uclose').onclick = () => { SEL = null; P.classList.add('hidden'); updateUI(); };
}
function showRelicInfo(id, e){ const r = RELIC[id], p = stagePt(e); $('#info').innerHTML = `<div class="tipbox" style="max-width:280px"><div class="ic-row"><img class="px" src="${iconSrc(id)}" style="width:40px;height:40px"><b style="font:600 18px 'Pixelify Sans'">${r.n}</b></div><div class="small">${r.d}</div><div class="small" style="margin-top:4px">Rechtsklick: verkaufen</div></div>`; placeInfo(p.x, p.y); }
function placeInfo(x, y){ const el = $('#info'); el.classList.remove('hidden'); const w = 290, h = el.offsetHeight || 300; el.style.left = clamp(x + 16, 4, 1276 - w) + 'px'; el.style.top = clamp(y - h - 10, 4, 716 - h) + 'px'; if(y - h - 10 < 4) el.style.top = clamp(y + 20, 4, 716 - h) + 'px'; }
function hideInfo(){ $('#info').classList.add('hidden'); }

/* ================= Ziehen & Ablegen ================= */
let DRAG = null;
function unitAtStage(p){
  // Reserve
  const el = document.elementFromPoint(...clientFromStage(p));
  const slot = el && el.closest && el.closest('[data-bench]');
  if(slot){ const i = +slot.dataset.bench; return {kind:'bench', i, u:RUN.units.find(x => x.where === 'bench' && x.pos === i)}; }
  // Feld
  const fr = $('#fieldwrap').getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(), s = sr.width / 1280;
  const fx = p.x - (fr.left - sr.left) / s - 3, fy = p.y - (fr.top - sr.top) / s - 3;
  if(fx >= 0 && fy >= 0 && fx <= 872 && fy <= 446){
    let best = null, bd = 1e9;
    FIELD_CELLS.forEach((c, i) => { const d = Math.hypot(c.x - fx, (c.y - 30) - fy); if(d < bd){ bd = d; best = i; } });
    if(bd < 48) return {kind:'field', i:best, u:RUN.units.find(x => x.where === 'field' && x.pos === best)};
    return {kind:'fieldbg'};
  }
  return null;
}
function clientFromStage(p){ const r = $('#stage').getBoundingClientRect(), s = r.width / 1280; return [r.left + p.x * s, r.top + p.y * s]; }
$('#stage').addEventListener('pointerdown', e => {
  if(!RUN || e.button === 2) return;
  if(e.target.closest('#modal') || e.target.closest('#hub') || e.target.closest('button')) return;
  const p = stagePt(e), hit = unitAtStage(p);
  if(hit && hit.u){ DRAG = {u:hit.u, from:hit, start:p, moved:false}; }
});
addEventListener('pointermove', e => {
  if(!RUN) return;
  const p = stagePt(e);
  if(DRAG){
    if(!DRAG.moved && Math.hypot(p.x - DRAG.start.x, p.y - DRAG.start.y) > 6){
      if(RUN.phase !== 'prep'){ DRAG = null; return; }
      DRAG.moved = true; const d = $('#drag'); d.src = 'assets/h/' + DRAG.u.form + '.png'; d.classList.remove('hidden'); hideInfo();
    }
    if(DRAG && DRAG.moved){ const d = $('#drag'); d.style.left = (p.x - 40) + 'px'; d.style.top = (p.y - 60) + 'px'; HOVERCELL = unitAtStage(p); }
    return;
  }
  const hit = unitAtStage(p);
  if(hit && hit.u){ showUnitTip(hit.u, p.x, p.y); }
  else if(hit && hit.kind === 'fieldbg' && B){ const en = enemyAt(p); if(en) showEnemyInfo(en, p.x, p.y); else hideInfo(); }
  else if(!(e.target.closest && e.target.closest('#relicslots'))) hideInfo();
});
let HOVERCELL = null;
addEventListener('pointerup', e => {
  if(!DRAG) return;
  const d = DRAG; DRAG = null; HOVERCELL = null; $('#drag').classList.add('hidden');
  if(!d.moved){ SEL = SEL === d.u.uid ? null : d.u.uid; if(SEL) showUnitInfo(d.u); else $('#unitpanel').classList.add('hidden'); updateUI(); return; }
  const hit = unitAtStage(stagePt(e)); if(!hit || hit.kind === 'fieldbg') return;
  if(hit.u && hit.u !== d.u){ absorb(hit.u, d.u); return; }
  if(hit.u) return;
  if(hit.kind === 'field'){
    const used = RUN.units.filter(u => u.where === 'field').length;
    if(d.u.where !== 'field' && used >= fieldCap()) return toast(`Das Feld ist voll (${fieldCap()} Plätze).`, '#ff6a6a');
    d.u.where = 'field'; d.u.pos = hit.i;
  } else if(hit.kind === 'bench'){ d.u.where = 'bench'; d.u.pos = hit.i; }
  updateUI();
});
$('#stage').addEventListener('contextmenu', e => e.preventDefault());

/* ================= Kampf ================= */
const cv = $('#cv'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
let B = null;
function resetBattleView(){ B = null; }
const LANE_Y = [308, 354, 400];
function heroEntity(u){
  const st = unitStats(u), h = HERO[u.form], c = CLASSES[u.cls], cell = FIELD_CELLS[u.pos];
  const e = {side:'h', u, form:u.form, cls:u.cls, x:cell.x, y:cell.y, hx:cell.x, hy:cell.y, max:st.hp, hp:st.hp, atk:st.atk, spd:st.spd, range:st.range, ms:st.ms, melee:st.melee,
    mana:hasRelic('re_mana') ? 40 : 0, cd:rnd(0, 0.4), tr:Object.assign({}, u.traits), st:{}, anim:'idle', at:0, face:1, barrier:0, scale:1.5, stack:0, lastT:null, sk:h.sk, fac:h.fac, dot:[]};
  if(e.tr.schildwall) e.barrier += e.max * 0.08 * e.tr.schildwall;
  if(hasRelic('re_barriere')) e.barrier += e.max * 0.1;
  return e;
}
function enemyEntity(spec){
  const boss = !!spec.boss, def = boss ? BOSSES[spec.k] : ENEMIES[spec.k];
  const w = RUN.wave, rm = RUN.reg.mul * RUN.diff.mul;
  let hp = def.hp * rm * (boss ? BAL.bHp : BAL.eHp * (1 + BAL.enemyHpPerWave * (w - 1)));
  const dmg = def.dmg * BAL.eDmg * (boss ? BAL.bDmg : 1) * Math.pow(rm, 0.85) * (boss ? 1 + 0.02 * w : 1 + BAL.enemyDmgPerWave * (w - 1));
  if((boss || def.elite) && hasRelic('re_auge')) hp *= 0.88;
  if(synergiesCache.leere >= 4) hp *= 0.9;
  const lane = Math.floor(Math.random() * 3);
  return {side:'e', k:spec.k, def, boss, elite:!!def.elite || boss, x:boss ? 940 : 900 + rnd(0, 30), y:boss ? LANE_Y[1] + 8 : LANE_Y[lane] + rnd(-6, 6), max:hp, hp, atk:dmg, spd:def.spd, range:def.range, ms:def.ms,
    kind:boss ? 'boss' : def.kind, cd:rnd(0.2, 0.8), st:{}, anim:'walk', at:rnd(0, 1), face:-1, scale:boss ? 1.6 : 1.4, dot:[], fly:!!def.fly, abilT:6, enraged:false};
}
let synergiesCache = {};
function initBattle(spawns){
  synergiesCache = synergies();
  const H = RUN.units.filter(u => u.where === 'field').map(heroEntity);
  B = {H, E:[], P:[], FX:[], T:[], spawns, t:0, killDrum:false, drumBuff:false, phoenix:hasRelic('re_phoenix'), fallen:0, stormT:5, springT:6, leaked:0, done:false};
  if(hasRelic('re_schwerter')){ const top = H.slice().sort((a, b) => b.u.level - a.u.level)[0]; if(top) top.swords = true; }
  if(hasRelic('re_turm')){ const rg = H.filter(h => !h.melee).sort((a, b) => a.x - b.x)[0]; if(rg){ rg.range *= 1.6; rg.tower = true; } }
  H.forEach(h => { if(h.tr.rudel) h.wolfT = 4; });
}
function alive(arr){ return arr.filter(e => e.hp > 0); }
function heroes(){ return B.H.filter(h => h.hp > 0); }
function enemies(){ return B.E.filter(e => e.hp > 0); }
function dist(a, b){ return Math.hypot(a.x - b.x, (a.y - b.y) * 1.4); }
function txt(x, y, s, col, size){ B.T.push({x, y, s, col, size:size || 16, t:0}); }
function fx(o){ B.FX.push(Object.assign({t:0}, o)); }

function critChance(a){
  let c = 0.05; if(a.tr.krit) c += 0.07 * a.tr.krit;
  if(!a.melee && hasRelic('re_falke')) c += 0.08;
  if(synergiesCache.schatten >= 2 && a.fac && a.fac.includes('schatten')) c += 0.1 * facMul();
  return c;
}
function heal(t, amt, src){
  if(!t || t.hp <= 0) return; let m = 1; if(synergiesCache.orden >= 2) m *= 1 + 0.15 * facMul();
  const before = t.hp; t.hp = Math.min(t.max, t.hp + amt * m); const d = t.hp - before; if(d >= 1) txt(t.x, t.y - 70, '+' + Math.round(d), '#5ee07a', 14);
}
function addBarrier(t, amt){ let m = 1; if(synergiesCache.orden >= 2) m *= 1 + 0.15 * facMul(); t.barrier = Math.min(t.max * 1.2, (t.barrier || 0) + amt * m); }

function damage(src, tgt, amt, o){
  o = o || {};
  if(!tgt || tgt.hp <= 0) return 0;
  // Ausweichen / Blocken / Verfehlen
  if(tgt.side === 'h'){
    if(tgt.st.block > 0){ txt(tgt.x, tgt.y - 70, 'Block', '#9fe0ff', 13); if(tgt.st.reflect) tgt.st.stored = (tgt.st.stored || 0) + amt; return 0; }
    if(tgt.tr.bollwerk && Math.random() < 0.06 * tgt.tr.bollwerk){ txt(tgt.x, tgt.y - 70, 'Block', '#9fe0ff', 13); return 0; }
    if(tgt.st.dodge > 0 && Math.random() < tgt.st.dodgeP){ txt(tgt.x, tgt.y - 70, 'Ausweichen', '#c8d8ff', 13); return 0; }
    if(src && src.st && src.st.blind > 0 && Math.random() < src.st.blindP){ txt(tgt.x, tgt.y - 70, 'Verfehlt', '#fff', 13); return 0; }
    let red = 0; if(tgt.st.red > 0) red = Math.max(red, tgt.st.redP);
    if(hasRelic('re_banner')){ const front = heroes().sort((a, b) => b.x - a.x)[0]; if(front === tgt) amt *= 0.8; }
    amt *= 1 - red;
    if(src && src.side === 'e' && (src.range || 0) < 80){ let refl = 0; if(tgt.tr.dornen) refl += 0.1 * tgt.tr.dornen; if(hasRelic('re_dornen')) refl += 0.12; if(refl) damage(tgt, src, amt * refl, {noTrait:true}); }
  }
  let crit = false;
  if(src && src.side === 'h' && !o.noCrit){
    if(Math.random() < critChance(src)){ crit = true; amt *= synergiesCache.schatten >= 4 && src.fac.includes('schatten') ? 2.5 : 2; }
    if(src.tr.duell && tgt.elite) amt *= 1 + 0.1 * src.tr.duell;
    if(src.tr.rausch) amt *= 1 + 0.03 * src.tr.rausch * Math.floor((1 - src.hp / src.max) * 10);
    if(src.buffAtk > 0) amt *= 1 + src.buffAtkP;
    if(B.drumBuff) amt *= 1.6;
    if(B.fallen && hasRelic('re_rache')) amt *= 1 + 0.08 * B.fallen;
    if(hasRelic('re_fokus')){ const top = enemies().sort((a, b) => b.hp - a.hp)[0]; if(top === tgt) amt *= 1.15; }
    if(o.skill && synergiesCache.arkan >= 2 && src.fac.includes('arkan')) amt *= 1 + 0.15 * facMul();
  }
  // Barriere
  if(tgt.barrier > 0){ const a = Math.min(tgt.barrier, amt); tgt.barrier -= a; amt -= a; }
  tgt.hp -= amt;
  if(src && src.side === 'h' && src.u){ RUN.mvp[src.form] = (RUN.mvp[src.form] || 0) + amt; }
  if(tgt.side === 'h'){ tgt.mana = Math.min(BAL.manaMax, tgt.mana + BAL.manaPerHurt); }
  txt(tgt.x + rnd(-10, 10), tgt.y - (tgt.boss ? 150 : 80), (crit ? '✦' : '') + fmt(amt), tgt.side === 'h' ? '#ff6a6a' : crit ? '#ffd25a' : '#ffffff', crit ? 19 : 15);
  tgt.hit = 0.12;
  // Treffer-Effekte der Helden
  if(src && src.side === 'h' && !o.noTrait && tgt.hp > 0){ onHitTraits(src, tgt, amt); }
  if(src && src.side === 'h' && src.tr.lebensraub) heal(src, amt * 0.05 * src.tr.lebensraub);
  if(src && src.side === 'h' && hasRelic('re_kelch')) heal(src, amt * 0.05);
  if(src && src.side === 'h' && src.lifesteal > 0) heal(src, amt * src.lifesteal);
  if(src && src.side === 'e' && src.def && src.def.drain) heal(src, amt * src.def.drain);
  if(tgt.hp <= 0) onDeath(tgt, src);
  return amt;
}
function onHitTraits(a, t, amt){
  const T = a.tr;
  if(T.raubtier) t.dot.push({k:'bleed', dps:amt * 0.12 * T.raubtier / 3, t:3, src:a});
  if(T.feuer) t.dot.push({k:'burn', dps:amt * 0.1 * T.feuer, t:3, src:a});
  if(T.frost) setSlow(t, 0.08 * T.frost, 2);
  if(hasRelic('re_frost')) setSlow(t, 0.1, 2);
  if(T.gift && Math.random() < 0.12 * T.gift) t.dot.push({k:'poison', dps:t.max * 0.004 * T.gift, t:4, src:a});
  if(hasRelic('re_gift') && Math.random() < 0.08) t.dot.push({k:'poison', dps:t.max * 0.005, t:4, src:a});
  if(T.betaeuben && Math.random() < 0.05 * T.betaeuben) stun(t, 0.7);
  if(synergiesCache.kampfkunst >= 4 && a.fac.includes('kampfkunst') && Math.random() < 0.08) stun(t, 0.6);
  if(T.blendung){ t.st.blind = 3; t.st.blindP = 0.06 * T.blendung; }
  if(T.rueckstoss && Math.random() < 0.08 * T.rueckstoss && !t.boss) t.x += 30;
  if(T.leerenriss && !t.boss && t.hp / t.max < (0.04 + 0.02 * T.leerenriss)){ txt(t.x, t.y - 90, 'VERNICHTET', '#c06aff', 14); t.hp = 0; onDeath(t, a); return; }
  if(T.funken && Math.random() < 0.15 * T.funken){ const o = nearestEnemy(t, e => e !== t); if(o && dist(o, t) < 160){ fx({k:'zap', x1:t.x, y1:t.y - 30, x2:o.x, y2:o.y - 30, life:0.25}); damage(a, o, amt * 0.6, {noTrait:true}); } }
  if(T.sternfall && Math.random() < 0.1 * T.sternfall){ fx({k:'ring', x:t.x, y:t.y - 20, r:50, col:'#ffe27a', life:0.4}); enemies().filter(e => dist(e, t) < 60).forEach(e => damage(a, e, amt * 0.8, {noTrait:true})); }
}
function setSlow(t, p, d){ if(t.boss) p *= 0.5; t.st.slow = Math.max(t.st.slow || 0, d); t.st.slowP = Math.max(t.st.slow > 0 ? (t.st.slowP || 0) : 0, p); }
function stun(t, d){ if(t.boss) d *= 0.4; t.st.stun = Math.max(t.st.stun || 0, d); }
function onDeath(t, src){
  if(t.dead) return; t.dead = true;
  fx({k:'poof', x:t.x, y:t.y - 30, life:0.5, col:t.side === 'h' ? '#ff6a6a' : '#c06aff'});
  if(t.side === 'e'){
    if(!t.summoned){ RUN.gold += BAL.killGold * (t.elite ? 8 : 1); if(Math.random() < BAL.crystalChance * (hasRelic('re_sieb') ? 2 : 1) * (t.elite ? 6 : 1)){ RUN.crystals++; txt(t.x, t.y - 100, '+1 Kristall', '#5ef0ff', 14); } }
    if(src && src.side === 'h'){
      if(src.tr.ernte) heal(src, src.max * 0.04 * src.tr.ernte);
      if(src.cls === 'sense' && hasRelic('re_laterne')) heal(src, src.max * 0.05);
      if(!B.killDrum && hasRelic('re_trommel')){ B.killDrum = true; B.drumBuff = true; setTimeout(() => B && (B.drumBuff = false), 1500); txt(436, 120, 'KRIEGSTROMMEL', '#ffd25a', 18); }
    }
  } else if(!t.summon){
    if(B.phoenix){ B.phoenix = false; t.dead = false; t.hp = t.max * 0.4; fx({k:'ring', x:t.x, y:t.y - 30, r:60, col:'#ff9a3a', life:0.6}); txt(t.x, t.y - 90, 'PHÖNIX!', '#ff9a3a', 18); return; }
    B.fallen++;
  }
}
function nearestEnemy(from, filt){ let best = null, bd = 1e9; for(const e of B.E){ if(e.hp <= 0 || (filt && !filt(e))) continue; const d = dist(from, e); if(d < bd){ bd = d; best = e; } } return best; }
function nearestHero(from, maxD){
  const H = heroes(); let best = null, bd = 1e9;
  const taunt = H.filter(h => h.st.taunt > 0); const pool = taunt.length ? taunt : H.filter(h => !h.tower || H.length === 1);
  for(const h of pool){ const d = dist(from, h); if(d < bd){ bd = d; best = h; } }
  if(!best) for(const h of H){ const d = dist(from, h); if(d < bd){ bd = d; best = h; } }
  return maxD && bd > maxD ? null : best;
}
function pickTarget(a, mode){
  const E = enemies(); if(!E.length) return null;
  if(mode === 'lowest') return E.sort((x, y) => x.hp - y.hp)[0];
  if(mode === 'highest') return E.sort((x, y) => y.hp - x.hp)[0];
  if(mode === 'back') return E.sort((x, y) => y.x - x.x)[0];
  if(mode === 'random') return pick(E);
  return nearestEnemy(a);
}

/* ---- Fähigkeiten ---- */
function castSkill(a){
  const s = a.sk; if(!s) return;
  a.anim = 'atk'; a.at = 0;
  txt(a.x, a.y - 100, s.n, '#ffd25a', 15);
  fx({k:'ring', x:a.x, y:a.y - 30, r:38, col:CLASSES[a.cls].col, life:0.35});
  const dmg = a.atk;
  const twice = hasRelic('re_glocke') && Math.random() < 0.15;
  for(let rep = 0; rep < (twice ? 2 : 1); rep++){
  switch(s.t){
    case 'strike': { const t = pickTarget(a, s.pick); if(!t) break;
      if(s.blink){ a.x = Math.max(a.x, t.x - 30); a.y = t.y; }
      const hit = (tt, m) => { const d = damage(a, tt, dmg * m, {skill:true}); if(s.heal) heal(a, d * s.heal); if(s.stun) stun(tt, s.stun); if(s.root){ tt.st.root = s.root; } if(s.slow) setSlow(tt, s.slow, 3); if(s.burn) tt.dot.push({k:'burn', dps:dmg * 0.4, t:3, src:a}); if(s.bleed) tt.dot.push({k:'bleed', dps:dmg * 0.4, t:3, src:a}); if(s.knock && !tt.boss) tt.x += s.knock; if(s.exec && !tt.boss && tt.hp > 0 && tt.hp / tt.max < s.exec){ tt.hp = 0; onDeath(tt, a); txt(tt.x, tt.y - 90, 'HINRICHTUNG', '#c06aff', 14); } };
      if(!a.melee) fx({k:'beam', x1:a.x + 20, y1:a.y - 40, x2:t.x, y2:t.y - 30, col:CLASSES[a.cls].col, life:0.25});
      else fx({k:'slash', x:t.x, y:t.y - 30, col:CLASSES[a.cls].col, life:0.3});
      hit(t, s.m);
      if(s.splash) enemies().filter(e => e !== t && dist(e, t) < s.splash).forEach(e => hit(e, s.m * 0.6)), fx({k:'ring', x:t.x, y:t.y - 20, r:s.splash, col:'#ffb04a', life:0.4});
      if(s.pierce) enemies().filter(e => e !== t && e.x > t.x && Math.abs(e.y - t.y) < 40).slice(0, s.pierce).forEach(e => hit(e, s.m * 0.7));
      break; }
    case 'multi': { let last = a;
      for(let i = 0; i < s.hits; i++){ const t = s.chain ? nearestEnemy(last, e => e !== last) : pickTarget(a, s.pick || 'random'); if(!t) break;
        setTimeout(() => { if(!B || t.hp <= 0) return; fx({k:a.melee ? 'slash' : 'beam', x:t.x, y:t.y - 30, x1:a.x + 20, y1:a.y - 40, x2:t.x, y2:t.y - 30, col:CLASSES[a.cls].col, life:0.25}); damage(a, t, dmg * s.m, {skill:true}); if(s.slow) setSlow(t, s.slow, 2); if(s.bleed) t.dot.push({k:'bleed', dps:dmg * 0.3, t:3, src:a}); if(s.splash) enemies().filter(e => e !== t && dist(e, t) < s.splash).forEach(e => damage(a, e, dmg * s.m * 0.5, {skill:true, noTrait:true})); }, i * 110 / RUN.speed);
        last = t; }
      break; }
    case 'aoe': {
      const center = s.r >= 999 ? null : (a.melee ? a : (pickTarget(a, 'nearest') || a));
      const ticks = s.ticks || 1;
      for(let k = 0; k < ticks; k++) setTimeout(() => { if(!B) return;
        const tg = s.r >= 999 ? enemies() : enemies().filter(e => dist(e, center) < s.r);
        fx({k:'ring', x:center ? center.x : 600, y:center ? center.y - 20 : 330, r:s.r >= 999 ? 440 : s.r, col:CLASSES[a.cls].col, life:0.45});
        tg.forEach(e => { damage(a, e, dmg * s.m, {skill:true}); if(s.stun) stun(e, s.stun); if(s.root) e.st.root = s.root; if(s.slow) setSlow(e, s.slow, 3); if(s.burn) e.dot.push({k:'burn', dps:dmg * 0.35, t:3, src:a}); if(s.knock && !e.boss) e.x += s.knock; if(s.pull && center && !e.boss) e.x += (center.x - e.x) * 0.4; if(s.exec && !e.boss && e.hp > 0 && e.hp / e.max < s.exec){ e.hp = 0; onDeath(e, a); } });
      }, k * 380 / RUN.speed);
      if(s.buff) heroes().forEach(h => { h.buffAtk = s.buff.dur; h.buffAtkP = s.buff.atk; });
      if(s.summon) for(let i = 0; i < s.summon.n; i++) summon(a, s.summon.kind);
      break; }
    case 'heal': { const H = heroes(); const tg = s.all ? H : H.sort((x, y) => x.hp / x.max - y.hp / y.max).slice(0, s.cnt);
      tg.forEach(h => { heal(h, h.max * s.pct, a); if(s.barrier) addBarrier(h, h.max * s.barrier); if(s.cleanse){ h.st.slow = 0; h.st.stun = 0; h.dot = []; } fx({k:'ring', x:h.x, y:h.y - 30, r:30, col:'#5ee07a', life:0.4}); });
      break; }
    case 'barrier': { const H = heroes(); const tg = s.all ? H : H.sort((x, y) => x.hp / x.max - y.hp / y.max).slice(0, s.cnt || 1);
      tg.forEach(h => { addBarrier(h, h.max * s.pct); if(s.block) h.st.block = s.block; fx({k:'ring', x:h.x, y:h.y - 30, r:32, col:'#9fe0ff', life:0.4}); });
      break; }
    case 'block': a.st.block = s.dur; if(s.reflect){ a.st.reflect = true; a.st.stored = 0; setTimeout(() => { if(!B || a.hp <= 0) return; const st = (a.st.stored || 0) * s.reflect + a.atk * 1.5; a.st.reflect = false; enemies().filter(e => dist(e, a) < 90).forEach(e => damage(a, e, st, {skill:true})); fx({k:'ring', x:a.x, y:a.y - 30, r:90, col:'#9fe0ff', life:0.4}); }, s.dur * 1000 / RUN.speed); } break;
    case 'taunt': a.st.taunt = s.dur; a.st.red = s.dur; a.st.redP = s.red; if(s.barrier) addBarrier(a, a.max * s.barrier); fx({k:'ring', x:a.x, y:a.y - 30, r:120, col:'#ff9a3a', life:0.5}); break;
    case 'summon': for(let i = 0; i < s.cnt; i++) summon(a, s.kind); if(s.drain) enemies().slice(0, 3).forEach(e => { const d = damage(a, e, dmg, {skill:true}); heal(a, d); }); break;
    case 'buff':
      if(s.team){ heroes().forEach(h => { h.mana = Math.min(BAL.manaMax - 1, h.mana + s.mana); heal(h, h.max * s.heal); }); }
      else if(s.dodge){ a.st.dodge = s.dur; a.st.dodgeP = s.dodge; const t = pickTarget(a, 'nearest'); if(t) damage(a, t, dmg * s.m, {skill:true}); }
      else if(s.red){ a.st.red = s.dur; a.st.redP = s.red; }
      else { a.buffSpd = s.dur; a.buffSpdP = s.spd; a.lifesteal = s.lifesteal; setTimeout(() => { if(a) a.lifesteal = 0; }, s.dur * 1000 / RUN.speed); }
      break;
  }}
}
function summon(owner, kind){
  const S = SUMMONS[kind], lv = owner.tr.rudel || 0, wild = synergiesCache.wildnis >= 4 ? 1.6 : 1, kette = hasRelic('re_kette') ? 1.3 : 1;
  if(B.H.filter(h => h.summon && h.hp > 0).length >= 8) return;
  const mul = (1 + 0.2 * lv) * wild;
  const e = {side:'h', summon:true, kind, form:null, cls:owner.cls, x:owner.x + 20, y:clamp(owner.y + rnd(-20, 20), LANE_Y[0], LANE_Y[2]), max:owner.max * S.hp * mul * kette, atk:owner.atk * S.atk * mul, spd:S.spd, range:S.range, ms:S.ms, melee:true,
    mana:0, cd:0.3, tr:{}, st:{}, anim:'idle', at:0, face:1, barrier:0, scale:1, dot:[], fac:[], life:20};
  e.hp = e.max; B.H.push(e); fx({k:'ring', x:e.x, y:e.y - 20, r:28, col:S.col, life:0.4});
}

/* ---- Boss-Fähigkeiten ---- */
function bossAbility(b){
  const A = b.def.abil, a = pick(A.filter(x => x !== 'enrage'));
  const H = heroes(); if(!H.length) return;
  txt(b.x, b.y - 190, ({slam:'Erdbeben', burn:'Glutwelle', firerain:'Feuerregen', breath:'Kristallatem', mirror:'Spiegelbilder', spear:'Leerenspeer', beam:'Blick der Leere', pull:'Sog der Leere'})[a] || 'Ruf der Leere', '#ff6a6a', 18);
  b.anim = 'atk'; b.at = 0;
  if(a === 'slam'){ H.filter(h => Math.abs(h.x - b.x) < 220).forEach(h => { damage(b, h, b.atk * 1.4); stun(h, 0.8); }); fx({k:'ring', x:b.x - 60, y:b.y, r:220, col:'#ff6a3a', life:0.6}); }
  else if(a === 'burn' || a === 'breath'){ H.sort((x, y) => y.x - x.x).slice(0, 4).forEach(h => { damage(b, h, b.atk * 1.1); h.dot.push({k:'burn', dps:b.atk * 0.2, t:3}); }); fx({k:'cone', x:b.x - 40, y:b.y - 60, col:a === 'breath' ? '#7fd8ff' : '#ff7a2a', life:0.6}); }
  else if(a === 'firerain'){ for(let i = 0; i < 3; i++){ const t = pick(H); fx({k:'ring', x:t.x, y:t.y, r:60, col:'#ff9a3a', life:0.6}); H.filter(h => dist(h, t) < 60).forEach(h => damage(b, h, b.atk * 0.9)); } }
  else if(a === 'mirror'){ for(let i = 0; i < 2; i++){ const m = enemyEntity({k:'e_prism'}); m.hp = m.max = b.max * 0.08; m.summoned = true; m.x = b.x - 40; B.E.push(m); } }
  else if(a === 'spear'){ const t = H.sort((x, y) => x.x - y.x)[0]; H.filter(h => Math.abs(h.y - t.y) < 30).forEach(h => damage(b, h, b.atk * 1.6)); fx({k:'beam', x1:b.x - 40, y1:b.y - 80, x2:0, y2:t.y - 30, col:'#c06aff', life:0.4}); }
  else if(a === 'beam'){ const t = H.sort((x, y) => y.max - x.max)[0]; damage(b, t, b.atk * 3); fx({k:'beam', x1:b.x - 30, y1:b.y - 110, x2:t.x, y2:t.y - 30, col:'#c06aff', life:0.5}); }
  else if(a === 'pull'){ H.forEach(h => { h.x += (b.x - h.x) * 0.25; }); }
  else if(a.startsWith('summon:')){ const k = a.split(':')[1]; for(let i = 0; i < 3; i++){ const m = enemyEntity({k}); m.x = b.x - 20; m.summoned = true; B.E.push(m); } }
}

/* ---- Schritt ---- */
let last = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  try{
    if(B && RUN && RUN.phase === 'battle'){ for(let i = 0; i < RUN.speed; i++) step(dt); }
    draw(dt);
  }catch(err){ console.error(err); }
}
function step(dt){
  B.t += dt;
  // Spawns
  while(B.spawns.length && B.spawns[0].t <= B.t){ const s = B.spawns.shift(); const e = enemyEntity(s); B.E.push(e); if(s.boss){ banner(e.def.n.toUpperCase(), 'BOSS'); } }
  // Relikt-Timer
  if(hasRelic('re_sturm')){ B.stormT -= dt; if(B.stormT <= 0){ B.stormT = 5; const top = heroes().sort((a, b) => b.atk - a.atk)[0]; enemies().sort(() => Math.random() - .5).slice(0, 3).forEach(e => { fx({k:'bolt', x:e.x, y:e.y, life:0.3}); if(top) damage(top, e, top.atk * 1.2, {noTrait:true}); }); } }
  if(hasRelic('re_quelle')){ B.springT -= dt; if(B.springT <= 0){ B.springT = 6; const w = heroes().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if(w) heal(w, w.max * 0.1); } }
  // Helden
  for(const a of B.H){
    if(a.hp <= 0) continue;
    tickStatus(a, dt);
    if(a.summon){ a.life -= dt; if(a.life <= 0){ a.hp = 0; continue; } }
    if(a.tr.rudel && !a.summon){ a.wolfT -= dt; if(a.wolfT <= 0){ a.wolfT = 12; if(B.H.filter(h => h.summon && h.kind === 'wolf' && h.hp > 0).length < Math.ceil(a.tr.rudel / 2)) summon(a, 'wolf'); } }
    if(a.tr.heilig && !a.summon){ a.holyT = (a.holyT || 6) - dt; if(a.holyT <= 0){ a.holyT = 6; const w = heroes().sort((x, y) => x.hp / x.max - y.hp / y.max)[0]; if(w) addBarrier(w, w.max * 0.04 * a.tr.heilig); } }
    if(a.buffAtk > 0) a.buffAtk -= dt; if(a.buffSpd > 0) a.buffSpd -= dt;
    if(a.st.stun > 0) continue;
    let t = a.lastT && a.lastT.hp > 0 && dist(a, a.lastT) < a.range + 60 ? a.lastT : nearestEnemy(a);
    if(!t){ // zurück in Formation
      if(!a.summon && Math.abs(a.x - a.hx) > 4){ a.x += Math.sign(a.hx - a.x) * a.ms * dt; a.anim = 'idle'; }
      continue;
    }
    if(t !== a.lastT){ a.stack = 0; a.lastT = t; }
    a.face = t.x >= a.x ? 1 : -1;
    const d = dist(a, t), reach = a.range + (t.boss ? 40 : 10);
    if(d > reach){
      if(a.st.root > 0) continue;
      if(a.melee || a.x < 470){ const ms = a.ms * (a.st.slow > 0 ? 1 - a.st.slowP : 1);
        const dx = t.x - a.x, dy = (t.y - a.y), L = Math.hypot(dx, dy) || 1;
        if(a.melee){ a.x += dx / L * ms * dt; a.y += dy / L * ms * dt * 0.8; } else { a.x += ms * dt * 0.6; }
        a.y = clamp(a.y, LANE_Y[0] - 10, LANE_Y[2] + 10);
        if(a.anim !== 'atk') a.anim = 'walk'; }
      continue;
    }
    if(a.anim === 'walk') a.anim = 'idle';
    a.cd -= dt * (1 + (a.stack || 0) * 0.04 * (a.tr.wirbel || 0)) * (a.buffSpd > 0 ? 1 + a.buffSpdP : 1);
    if(a.cd <= 0){
      a.cd = 1 / a.spd;
      if(a.mana >= BAL.manaMax && a.sk){ a.mana = 0; castSkill(a); continue; }
      a.anim = 'atk'; a.at = 0;
      let manaGain = BAL.manaPerHit * (1 + 0.15 * (a.tr.chi || 0)) * (a.cls === 'faust' && hasRelic('re_perlen') ? 1.25 : 1) * (hasRelic('re_sanduhr') ? 1.15 : 1) * (synergiesCache.arkan >= 4 ? 1.25 : 1);
      if(!a.summon) a.mana = Math.min(BAL.manaMax, a.mana + manaGain);
      if(a.tr.wirbel) a.stack = Math.min(5, (a.stack || 0) + 1);
      if(a.tr.segen){ const w = heroes().sort((x, y) => x.hp / x.max - y.hp / y.max)[0]; if(w) heal(w, w.max * 0.015 * a.tr.segen); }
      if(a.melee){
        fx({k:'slash', x:t.x, y:t.y - 30, col:CLASSES[a.cls].col, life:0.2});
        damage(a, t, a.atk);
        const cleave = (CLASSES[a.cls].cleave || 1) - 1 + (hasRelic('re_faecher') && Math.random() < 0.3 ? 1 : 0);
        if(cleave > 0) enemies().filter(e => e !== t && dist(e, t) < 50).slice(0, cleave).forEach(e => damage(a, e, a.atk * 0.6, {noTrait:true}));
      } else {
        const pierce = (a.tr.durchbohren || 0) + (a.cls === 'bogen' && hasRelic('re_elfenfeder') ? 1 : 0);
        B.P.push({src:a, t, x:a.x + 20, y:a.y - 44, kind:CLASSES[a.cls].proj || 'orb', col:CLASSES[a.cls].col, sp:520, dmg:a.atk, pierce, hit:new Set(), splash:a.cls === 'stab' ? 30 : 0});
      }
      if(a.swords){ const e2 = nearestEnemy(a); if(e2 && dist(e2, a) < 160){ damage(a, e2, a.atk * 0.35, {noTrait:true}); fx({k:'slash', x:e2.x, y:e2.y - 40, col:'#9fe0ff', life:0.2}); } }
    }
  }
  // Gegner
  for(const e of B.E){
    if(e.hp <= 0) continue;
    tickStatus(e, dt);
    if(e.boss){ e.abilT -= dt; if(e.abilT <= 0){ e.abilT = e.enraged ? 5 : 7.5; bossAbility(e); }
      if(!e.enraged && e.def.abil.includes('enrage') && e.hp < e.max * 0.3){ e.enraged = true; e.spd *= 1.5; txt(e.x, e.y - 200, 'RASEREI!', '#ff3a3a', 22); } }
    if(e.def.summon){ e.sumT = (e.sumT || 6) - dt; if(e.sumT <= 0){ e.sumT = 7; for(let i = 0; i < 2; i++){ const m = enemyEntity({k:e.def.summon}); m.x = e.x - 10; m.summoned = true; B.E.push(m); } } }
    if(e.st.stun > 0) continue;
    const ms = e.ms * (e.st.slow > 0 ? 1 - e.st.slowP : 1) * (e.st.root > 0 ? 0 : 1);
    if(e.kind === 'runner'){ e.x -= ms * dt; e.anim = 'walk'; }
    else {
      const h = nearestHero(e, e.range + (e.range > 80 ? 40 : 120));
      if(h && dist(e, h) <= e.range + 14){
        e.face = h.x <= e.x ? -1 : 1; if(e.anim === 'walk') e.anim = 'idle';
        e.cd -= dt;
        if(e.cd <= 0){ e.cd = 1 / e.spd; e.anim = 'atk'; e.at = 0;
          if(e.range > 80) B.P.push({src:e, t:h, x:e.x - 20, y:e.y - 40, kind:e.def.proj || 'void', col:e.def.proj === 'fire' ? '#ff8a3a' : e.def.proj === 'ice' ? '#9fe0ff' : '#c06aff', sp:360, dmg:e.atk, hit:new Set(), enemy:true});
          else damage(e, h, e.atk);
        }
      } else if(h){ // auf Held zugehen
        const dx = h.x - e.x, dy = h.y - e.y, L = Math.hypot(dx, dy) || 1; e.x += dx / L * ms * dt; e.y += dy / L * ms * dt * 0.7; e.anim = 'walk'; e.face = -1;
      } else { e.x -= ms * dt; e.anim = 'walk'; e.face = -1; }
    }
    e.y = clamp(e.y, LANE_Y[0] - 12, LANE_Y[2] + 12);
    if(e.x < -20){ e.hp = 0; e.dead = true; if(e.boss) { B.bossLeak = true; } B.leaked++; if(!(tl('t_safe') && RUN.wave <= 3)){ RUN.hearts--; } toast('Ein Gegner ist durchgebrochen! −1 Leben', '#ff6a6a'); updateUI(); }
  }
  // Geschosse
  for(const p of B.P){
    if(p.done) continue;
    const t = p.t && p.t.hp > 0 ? p.t : (p.enemy ? nearestHero(p) : nearestEnemy(p));
    if(!t){ p.done = true; continue; }
    const dx = t.x - p.x, dy = (t.y - 34) - p.y, L = Math.hypot(dx, dy);
    if(L < 14){
      if(p.enemy) damage(p.src, t, p.dmg);
      else { damage(p.src, t, p.dmg); if(p.splash) enemies().filter(e => e !== t && dist(e, t) < p.splash).forEach(e => damage(p.src, e, p.dmg * 0.5, {noTrait:true}));
        if(p.pierce > 0){ p.pierce--; p.hit.add(t); const n = nearestEnemy(t, e => !p.hit.has(e) && e.x > t.x - 10); if(n){ p.t = n; p.dmg *= 0.5; continue; } } }
      p.done = true; fx({k:'spark', x:t.x, y:t.y - 34, col:p.col, life:0.2});
    } else { p.x += dx / L * p.sp * dt; p.y += dy / L * p.sp * dt; p.ang = Math.atan2(dy, dx); }
  }
  B.P = B.P.filter(p => !p.done);
  // Ende?
  if(!B.done){
    const E = enemies(), H = B.H.filter(h => h.hp > 0 && !h.summon);
    if(B.bossLeak || RUN.hearts <= 0){ B.done = true; endBattle(false); return; }
    if(!B.spawns.length && !E.length){ B.done = true; endBattle(true); return; }
    if(!H.length){ B.done = true; endBattle(false); return; }
  }
}
function tickStatus(a, dt){
  for(const k of ['stun', 'slow', 'root', 'blind', 'block', 'taunt', 'red', 'dodge']) if(a.st[k] > 0) a.st[k] -= dt;
  if(a.hit > 0) a.hit -= dt;
  if(a.dot.length){ for(const d of a.dot){ d.t -= dt; a.hp -= d.dps * dt; if(d.src && d.src.form) RUN.mvp[d.src.form] = (RUN.mvp[d.src.form] || 0) + d.dps * dt; } a.dot = a.dot.filter(d => d.t > 0);
    if(a.hp <= 0) onDeath(a, a.dot[0] && a.dot[0].src); }
  a.at += dt;
}

/* ================= Zeichnen ================= */
function frameOf(path, t, fps, loopIt){
  const im = IMGS[path]; if(!im || !im.complete || !im.naturalWidth) return null;
  const fw = im.naturalHeight, n = Math.max(1, Math.round(im.naturalWidth / fw));
  let f = Math.floor(t * fps); if(loopIt) f %= n; else f = Math.min(n - 1, f);
  return {im, sx:f * fw, fw, n, done:!loopIt && t * fps >= n};
}
function drawEntity(a){
  let path, base, fps = 10, loopIt = true;
  if(a.side === 'h'){
    if(a.summon){ drawSummon(a); return; }
    base = 'assets/h/' + a.form;
    if(a.anim === 'atk'){ path = base + '_atk.png'; fps = 18; loopIt = false; } else path = base + '_idle.png';
    if(a.anim === 'walk') { path = base + '_idle.png'; fps = 14; }
  } else if(a.boss){ base = 'assets/b/' + a.k; path = a.anim === 'atk' ? base + '_atk.png' : base + '_idle.png'; fps = a.anim === 'atk' ? 12 : 7; loopIt = a.anim !== 'atk'; }
  else { base = 'assets/e/' + a.k; path = a.anim === 'atk' ? base + '_atk.png' : base + '_walk.png'; fps = a.anim === 'atk' ? 14 : 9; loopIt = a.anim !== 'atk'; }
  let fr = frameOf(path, a.at, fps, loopIt);
  if(fr && fr.done && a.anim === 'atk'){ a.anim = a.side === 'e' ? 'walk' : 'idle'; a.at = 0; fr = frameOf(a.side === 'h' ? base + '_idle.png' : a.boss ? base + '_idle.png' : base + '_walk.png', 0, 10, true); }
  const still = IMGS[base + '.png'];
  const sz = (a.boss ? 128 : 64) * a.scale;
  const flip = a.side === 'h' ? a.face < 0 : a.face > 0;
  ctx.save(); ctx.translate(Math.round(a.x), Math.round(a.y)); if(flip) ctx.scale(-1, 1);
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.26, sz * 0.07, 0, 0, 7); ctx.fill();
  if(a.side === 'h' && a.u){ const rc = RARITY[a.u.rar].col; if(a.u.rar > 0){ ctx.strokeStyle = rc; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.28, sz * 0.08, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }
  if(a.hit > 0) ctx.filter = 'brightness(2.2)';
  if(a.st && a.st.stun > 0) ctx.filter = 'grayscale(.7)';
  const yOff = a.fly ? -18 + Math.sin(B ? B.t * 4 : 0) * 4 : 0;
  if(fr) ctx.drawImage(fr.im, fr.sx, 0, fr.fw, fr.fw, -sz / 2, -sz + sz * 0.06 + yOff, sz, sz);
  else if(still && still.complete) ctx.drawImage(still, -sz / 2, -sz + sz * 0.06 + yOff, sz, sz);
  ctx.filter = 'none'; ctx.restore();
  // Leisten
  if(B && a.hp > 0 && (a.hp < a.max || a.side === 'h' || a.boss)){
    const w = a.boss ? 120 : 44, y = a.y - sz * 0.92 + yOff, x = a.x - w / 2;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = a.side === 'h' ? '#5ee07a' : a.boss ? '#ff3a5a' : '#ff6a6a'; ctx.fillRect(x, y, w * clamp(a.hp / a.max, 0, 1), 4);
    if(a.barrier > 0){ ctx.fillStyle = '#d8f4ff'; ctx.fillRect(x, y, w * clamp(a.barrier / a.max, 0, 1), 2); }
    if(a.side === 'h' && !a.summon){ ctx.fillStyle = '#123'; ctx.fillRect(x, y + 5, w, 2); ctx.fillStyle = '#ffd25a'; ctx.fillRect(x, y + 5, w * a.mana / BAL.manaMax, 2); }
    if(a.st && a.st.block > 0){ ctx.strokeStyle = '#9fe0ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y - sz * 0.45, sz * 0.38, 0, 7); ctx.stroke(); }
    if(a.st && a.st.taunt > 0){ ctx.strokeStyle = 'rgba(255,154,58,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(a.x, a.y, sz * 0.4, sz * 0.12, 0, 0, 7); ctx.stroke(); }
  }
  if(a.swords && B){ for(let k = 0; k < 2; k++){ const an = B.t * 3 + k * Math.PI; ctx.fillStyle = '#9fe0ff'; ctx.save(); ctx.translate(a.x + Math.cos(an) * 34, a.y - 50 + Math.sin(an) * 10); ctx.rotate(an); ctx.fillRect(-2, -12, 4, 24); ctx.restore(); } }
}
function drawSummon(a){
  const S = SUMMONS[a.kind];
  ctx.save(); ctx.translate(a.x, a.y); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 4, 0, 0, 7); ctx.fill();
  const bob = Math.sin((B ? B.t : 0) * 10 + a.x) * 2;
  if(a.kind === 'wolf'){ ctx.fillStyle = S.col; ctx.fillRect(-14, -18 + bob, 26, 12); ctx.fillRect(8, -24 + bob, 10, 10); ctx.fillStyle = '#ffd25a'; ctx.fillRect(14, -21 + bob, 2, 2); ctx.fillStyle = S.col; ctx.fillRect(-12, -6, 4, 6); ctx.fillRect(6, -6, 4, 6); }
  else { ctx.fillStyle = S.col; ctx.fillRect(-5, -30 + bob, 10, 10); ctx.fillRect(-6, -20 + bob, 12, 14); ctx.fillRect(-5, -6, 3, 6); ctx.fillRect(2, -6, 3, 6); ctx.fillStyle = '#c06aff'; ctx.fillRect(-3, -27 + bob, 2, 2); ctx.fillRect(1, -27 + bob, 2, 2); }
  ctx.restore();
  const w = 30; ctx.fillStyle = '#000'; ctx.fillRect(a.x - w / 2, a.y - 40, w, 3); ctx.fillStyle = '#5ee07a'; ctx.fillRect(a.x - w / 2, a.y - 40, w * a.hp / a.max, 3);
}
function drawBG(){
  const reg = RUN ? RUN.reg : REGIONS[0], im = IMGS['assets/bg/' + reg.bg + '.png'];
  if(im && im.complete && im.naturalWidth){ const s = 872 / im.naturalWidth, h = im.naturalHeight * s; ctx.drawImage(im, 0, 446 - h, 872, h); }
  else { ctx.fillStyle = '#1c1824'; ctx.fillRect(0, 0, 872, 446); }
  const g = ctx.createLinearGradient(0, 0, 0, 446); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 872, 446);
}
function draw(dt){
  ctx.imageSmoothingEnabled = false;
  drawBG();
  if(!RUN) return;
  if(!B || RUN.phase !== 'battle'){
    // Formation
    const cap = fieldCap(), used = RUN.units.filter(u => u.where === 'field');
    FIELD_CELLS.forEach((c, i) => {
      const occ = used.find(u => u.pos === i), hov = HOVERCELL && HOVERCELL.kind === 'field' && HOVERCELL.i === i;
      ctx.save(); ctx.translate(c.x, c.y); ctx.strokeStyle = hov ? '#ffd25a' : occ ? 'rgba(230,190,100,.55)' : used.length < cap ? 'rgba(230,190,100,.25)' : 'rgba(120,140,160,.12)'; ctx.lineWidth = hov ? 2.5 : 1.5;
      ctx.beginPath(); for(let k = 0; k < 6; k++){ const an = k * Math.PI / 3; ctx.lineTo(Math.cos(an) * 30, Math.sin(an) * 10); } ctx.closePath(); ctx.stroke(); ctx.restore();
    });
    const now = performance.now() / 1000;
    used.slice().sort((a, b) => FIELD_CELLS[a.pos].y - FIELD_CELLS[b.pos].y).forEach(u => {
      const c = FIELD_CELLS[u.pos]; drawEntity({side:'h', u, form:u.form, x:c.x, y:c.y, anim:'idle', at:now + u.uid, face:1, scale:1.5, hp:1, max:1, st:{}, mana:0});
      ctx.fillStyle = '#fff'; ctx.font = '700 12px "Pixelify Sans"'; ctx.textAlign = 'center'; ctx.fillText('Lv' + u.level, c.x, c.y + 14);
      if(SEL === u.uid){ ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(c.x, c.y, 30, 10, 0, 0, 7); ctx.stroke(); }
    });
    ctx.textAlign = 'center'; ctx.font = '700 13px "Pixelify Sans"'; ctx.fillStyle = 'rgba(230,190,100,.7)'; ctx.fillText('FORMATION  ·  vorne →', 230, 30);
    return;
  }
  // Kampf
  const all = B.H.filter(h => h.hp > 0).concat(B.E.filter(e => e.hp > 0)).sort((a, b) => a.y - b.y);
  all.forEach(drawEntity);
  // Geschosse
  for(const p of B.P){ ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
    if(p.kind === 'arrow'){ ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-10, -1, 16, 2); ctx.fillStyle = p.col; ctx.fillRect(4, -2, 4, 4); }
    else { ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill(); }
    ctx.restore(); }
  // Effekte
  for(const f of B.FX){ f.t += dt * RUN.speed; const k = f.t / f.life; if(k >= 1) continue; ctx.save(); ctx.globalAlpha = 1 - k;
    if(f.k === 'ring'){ ctx.strokeStyle = f.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.5 + k * 0.5), f.r * (0.5 + k * 0.5) * 0.35, 0, 0, 7); ctx.stroke(); }
    else if(f.k === 'slash'){ ctx.strokeStyle = f.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 20, -1.2 + k, 0.6 + k); ctx.stroke(); }
    else if(f.k === 'beam' || f.k === 'zap'){ ctx.strokeStyle = f.col || '#bfe8ff'; ctx.lineWidth = f.k === 'zap' ? 2 : 4; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(f.x1, f.y1); ctx.lineTo(f.x2, f.y2); ctx.stroke(); }
    else if(f.k === 'bolt'){ ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x, 0); ctx.lineTo(f.x + 10, f.y * 0.5); ctx.lineTo(f.x - 6, f.y * 0.75); ctx.lineTo(f.x, f.y - 20); ctx.stroke(); }
    else if(f.k === 'cone'){ ctx.fillStyle = f.col; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - 300, f.y - 60); ctx.lineTo(f.x - 300, f.y + 110); ctx.closePath(); ctx.fill(); }
    else if(f.k === 'poof' || f.k === 'spark'){ ctx.fillStyle = f.col; for(let i = 0; i < 6; i++){ const an = i * 1.05; ctx.fillRect(f.x + Math.cos(an) * k * 24, f.y + Math.sin(an) * k * 16, 3, 3); } }
    ctx.restore(); }
  B.FX = B.FX.filter(f => f.t < f.life);
  // Zahlen
  ctx.textAlign = 'center';
  for(const t of B.T){ t.t += dt * RUN.speed; const k = t.t / 0.9; if(k >= 1) continue; ctx.globalAlpha = 1 - k * k; ctx.font = `700 ${t.size}px 'Pixelify Sans'`; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(t.s, t.x, t.y - k * 26); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x, t.y - k * 26); }
  ctx.globalAlpha = 1; B.T = B.T.filter(t => t.t < 0.9);
  // Boss-Leiste
  const boss = B.E.find(e => e.boss && e.hp > 0);
  if(boss){ ctx.fillStyle = '#0c0a10'; ctx.fillRect(234, 16, 404, 16); ctx.fillStyle = boss.enraged ? '#ff2a2a' : '#c03a5a'; ctx.fillRect(236, 18, 400 * boss.hp / boss.max, 12);
    ctx.font = '700 14px "Pixelify Sans"'; ctx.fillStyle = '#fff'; ctx.fillText(boss.def.n + ' · ' + Math.ceil(boss.hp / boss.max * 100) + '%', 436, 50); }
  // Restgegner
  ctx.textAlign = 'right'; ctx.font = '700 14px "Pixelify Sans"'; ctx.fillStyle = 'rgba(230,244,255,.8)'; ctx.fillText(`Gegner: ${enemies().length + B.spawns.length}`, 856, 30);
}
function enemyAt(p){
  const fr = $('#fieldwrap').getBoundingClientRect(), sr = $('#stage').getBoundingClientRect(), s = sr.width / 1280;
  const fx2 = p.x - (fr.left - sr.left) / s - 3, fy2 = p.y - (fr.top - sr.top) / s - 3;
  return B.E.find(e => e.hp > 0 && Math.abs(e.x - fx2) < (e.boss ? 80 : 30) && fy2 < e.y && fy2 > e.y - (e.boss ? 200 : 90));
}
function showEnemyInfo(e, x, y){ $('#info').innerHTML = `<div class="tipbox" style="max-width:280px"><b style="font:600 18px 'Pixelify Sans';color:${e.boss ? '#ff6a6a' : e.elite ? '#c06aff' : '#fff'}">${e.def.n}</b><div class="stat"><span>❤ ${fmt(e.hp)}/${fmt(e.max)}</span><span>⚔ ${fmt(e.atk)}</span></div>${e.kind === 'runner' ? '<div class="small">Ignoriert Helden und stürmt zur Basis.</div>' : ''}${e.boss ? `<div class="small">Fähigkeiten: ${e.def.abil.join(', ')}</div>` : ''}</div>`; placeInfo(x, y); }
requestAnimationFrame(loop);

/* ================= Knöpfe ================= */
$('#spinbtn').onclick = doSpin;
$('#fightbtn').onclick = startBattle;
$('#shopbtn').onclick = openShop;
$('#speed').onclick = () => { if(!RUN) return; RUN.speed = RUN.speed >= 3 ? 1 : RUN.speed + 1; $('#speed').textContent = RUN.speed + '×'; };
$('#dismissbtn').onclick = () => {
  if(!RUN || RUN.phase !== 'prep') return; const u = RUN.units.find(x => x.uid === SEL); if(!u) return toast('Wähle zuerst einen Helden aus (anklicken).');
  if(RUN.units.length <= 1) return toast('Du brauchst mindestens einen Helden.');
  const g = 25 * (u.rar + 1); RUN.units = RUN.units.filter(x => x !== u); RUN.gold += g; SEL = null; toast(`${HERO[u.form].n} entlassen: +${g} Gold`); updateUI();
};
$('#quit').onclick = () => { if(!RUN) return; if(confirm('Lauf aufgeben? Bereits verdiente Runen behältst du.')) runOver(false); };
addEventListener('keydown', e => { if(!RUN) return; if(e.code === 'Space' && RUN.phase === 'prep'){ e.preventDefault(); doSpin(); } if(e.key === 'Enter' && RUN.phase === 'prep') startBattle(); });

/* ================= Hub ================= */
const INTRO = [
  'Ihr seid durch die Leere gefallen … und doch lebt ihr noch. Willkommen in der Welt hinter der Leere.',
  'Ich bin Lyra. Man nennt mich Schicksalsbrecherin. Hier herrscht kein König – hier herrscht das Rad des Schicksals.',
  'Die Schicksalswalze ruft Helden aus allen Zeiten. Drei gleiche Zeichen in einer Linie – und ein Held tritt an deine Seite.',
  'Verschmelze deine Helden, damit sie wachsen. Wer stark genug wird, steigt in eine neue Klasse auf.',
  'Vernichte die Wellen der Leere, sammle Runen und brich dein Schicksal. Die Zitadelle der Leere wartet.',
];
function showHub(){
  $('#hub').classList.remove('hidden'); closeModal(); hideInfo();
  $('#hubstats').innerHTML = `<span><img class="px" src="${iconSrc('ic_rune')}"> ${fmt(META.runes)}</span><span><img class="px" src="${iconSrc('ic_skull')}"> ${META.runs}</span>`;
  $('#hubmenu').innerHTML = `<button class="btn gold big" id="h_play">Abenteuer</button><button class="btn big" id="h_tree">Talentbaum</button><button class="btn big" id="h_codex">Heldenkodex</button><button class="btn" id="h_story">Lyras Geschichte</button><a class="btn" href="../index.html${TESTMODE ? '?test' : ''}" style="text-align:center;text-decoration:none">Zurück zur Kräuterhöhle</a>`;
  $('#h_play').onclick = showRegions; $('#h_tree').onclick = showTree; $('#h_codex').onclick = showCodex; $('#h_story').onclick = () => story(0);
  if(!META.intro) story(0);
}
function story(i){
  const d = $('#dialog'); if(i >= INTRO.length){ d.classList.add('hidden'); META.intro = true; saveMeta(); return; }
  d.classList.remove('hidden'); d.innerHTML = `<div class="who">LYRA · SCHICKSALSBRECHERIN</div><div id="dtext"></div><div class="small" style="text-align:right">Klicken ▶</div>`;
  const s = INTRO[i]; let k = 0; const el = $('#dtext'); clearInterval(d._h); d._h = setInterval(() => { k += 2; el.textContent = s.slice(0, k); if(k >= s.length) clearInterval(d._h); }, 18);
  d.onclick = () => { if(k < s.length){ k = s.length; el.textContent = s; clearInterval(d._h); return; } story(i + 1); };
}
function regionUnlocked(i){ if(TESTMODE || i === 0) return true; return !!META.clear[REGIONS[i - 1].id + '-normal']; }
function showRegions(){
  const m = modal(`<div class="sys">◆ WELT HINTER DER LEERE ◆</div><h2>Wähle dein Ziel</h2><div class="cards">${REGIONS.map((r, i) => {
    const un = regionUnlocked(i);
    return `<div class="card reg" style="${un ? '' : 'opacity:.45;cursor:default'}"><img class="px" src="assets/bg/${r.bg}.png" alt=""><div class="p"><div style="font:600 20px 'Pixelify Sans'">${r.n}</div><div class="small">${r.d}</div>
      ${un ? DIFFS.map((d, j) => { const ok = j === 0 || META.clear[r.id + '-easy'] || TESTMODE; const best = META.best[r.id + '-' + d.id] || 0; return `<button class="btn ${ok ? '' : ''}" style="margin:6px 4px 0;font-size:14px" data-r="${i}" data-d="${j}" ${ok ? '' : 'disabled'}>${d.n} · ${d.waves} Wellen ${META.clear[r.id + '-' + d.id] ? '✓' : best ? '(' + best + ')' : ''}</button>`; }).join('') : '<div class="small" style="margin-top:8px">🔒 Schließe das vorherige Gebiet auf „Normal“ ab.</div>'}</div></div>`; }).join('')}</div>
    <div style="text-align:center;margin-top:12px"><button class="btn" id="back">Zurück</button></div>`);
  m.querySelectorAll('button[data-r]').forEach(b => b.onclick = () => { closeModal(); newRun(+b.dataset.r, +b.dataset.d); });
  m.querySelector('#back').onclick = closeModal;
}
function showTree(){
  const cx = 470, cy = 430, gx = 104, gy = 76;
  const can = t => !tl(t.id) || (t.max && tl(t.id) < t.max);
  const reqOk = t => !t.req || tl(t.req);
  const lines = TALENTS.filter(t => t.req).map(t => { const a = TALENT[t.req]; return `<line x1="${cx + a.x * gx}" y1="${cy + a.y * gy}" x2="${cx + t.x * gx}" y2="${cy + t.y * gy}" stroke="${tl(t.id) ? '#ffd25a' : 'rgba(230,190,100,.35)'}" stroke-width="2"/>`; }).join('');
  const nodes = TALENTS.filter(t => reqOk(t) || tl(t.id) || (t.req && reqOk(TALENT[t.req]))).map(t => {
    const lv = tl(t.id), max = t.max || 1, price = t.cost[Math.min(lv, t.cost.length - 1)];
    const cls = lv ? 'own' : reqOk(t) && META.runes >= price ? 'can' : reqOk(t) ? '' : 'lock';
    return `<div class="tn ${cls}" data-t="${t.id}" style="left:${cx + t.x * gx - 31}px;top:${cy + t.y * gy - 31}px"><img class="px" src="${iconSrc(t.icon)}"><span class="c">${lv}/${max}</span></div>`; }).join('');
  const m = modal(`<div class="sys">◆ TALENTBAUM ◆</div><h2>Runenschmiede</h2><div style="text-align:center;font:700 18px 'Pixelify Sans'"><img class="px" src="${iconSrc('ic_rune')}" style="width:22px;vertical-align:middle"> ${fmt(META.runes)} Runen</div>
    <div id="tree"><svg width="980" height="520" style="position:absolute;left:0;top:0">${lines}</svg>${nodes}</div>
    <div id="tinfo" class="small" style="min-height:40px;text-align:center;margin-top:6px">Fahre über ein Talent.</div>
    <div style="text-align:center;margin-top:8px"><button class="btn" id="back">Zurück</button></div>`);
  m.querySelectorAll('.tn').forEach(el => {
    const t = TALENT[el.dataset.t], lv = tl(t.id), max = t.max || 1;
    el.onmouseenter = () => { const price = t.cost[Math.min(lv, t.cost.length - 1)]; $('#tinfo').innerHTML = `<b style="color:#e6f4ff;font-size:16px">${t.n}</b> (${lv}/${max}) – ${t.d}${lv < max ? ` · Kosten: <b style="color:#ff6a6a">${price} Runen</b>` : ' · <b style="color:#ffd25a">gemeistert</b>'}`; };
    el.onclick = () => { if(lv >= max || !reqOk(t)) return; const price = t.cost[Math.min(lv, t.cost.length - 1)]; if(META.runes < price) return toast('Nicht genug Runen.', '#ff6a6a'); META.runes -= price; META.tal[t.id] = lv + 1; saveMeta(); showTree(); showHubStats(); };
  });
  m.querySelector('#back').onclick = () => { closeModal(); showHub(); };
}
function showHubStats(){ $('#hubstats').innerHTML = `<span><img class="px" src="${iconSrc('ic_rune')}"> ${fmt(META.runes)}</span><span><img class="px" src="${iconSrc('ic_skull')}"> ${META.runs}</span>`; }
function showCodex(){
  const seen = HEROES.filter(h => META.seen[h.id]).length;
  const m = modal(`<div class="sys">◆ HELDENKODEX ◆</div><h2>${seen}/${HEROES.length} Helden entdeckt</h2><div id="codex">${HEROES.map(h => `<div class="cx ${META.seen[h.id] || TESTMODE ? '' : 'unseen'}" title="${META.seen[h.id] || TESTMODE ? h.n + ' – ' + h.sk.n + ': ' + skillText(h.sk) : '???'}"><img class="px" src="assets/h/${h.id}.png"><div>${META.seen[h.id] || TESTMODE ? h.n : '???'}</div></div>`).join('')}</div>
    <div style="text-align:center;margin-top:10px"><button class="btn" id="back">Zurück</button></div>`);
  m.querySelector('#back').onclick = closeModal;
}
showHub();
