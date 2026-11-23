/* FATEBREAKER – Spieldaten
   Eigenes Slot-Autobattler-Spiel: Die Welt hinter der Leere (Fortsetzung der Kräuterhöhle). */
'use strict';

const TESTMODE = /[?&]test\b/.test(location.search);

/* ---------- Klassen (Walzen-Symbole) ---------- */
// hp, atk = Grundwerte; spd = Angriffe pro Sekunde; range in Pixeln; ms = Laufgeschwindigkeit
const CLASSES = {
  klinge: {n:'Klinge',  icon:'sym_klinge', col:'#ff6a5a', hp:70,  atk:9,  spd:1.0, range:34,  ms:62, melee:true,  role:'Nahkampf'},
  schild: {n:'Schild',  icon:'sym_schild', col:'#6aa8ff', hp:125, atk:5,  spd:0.8, range:30,  ms:50, melee:true,  role:'Verteidiger'},
  bogen:  {n:'Bogen',   icon:'sym_bogen',  col:'#7fe07a', hp:46,  atk:8,  spd:1.0, range:240, ms:55, melee:false, role:'Fernkampf', proj:'arrow'},
  stab:   {n:'Stab',    icon:'sym_stab',   col:'#b98cff', hp:40,  atk:11, spd:0.7, range:210, ms:50, melee:false, role:'Magie', proj:'orb'},
  faust:  {n:'Faust',   icon:'sym_faust',  col:'#ffb04a', hp:76,  atk:6,  spd:1.6, range:28,  ms:70, melee:true,  role:'Kampfkunst'},
  sense:  {n:'Sense',   icon:'sym_sense',  col:'#5ad8d0', hp:62,  atk:10, spd:0.8, range:40,  ms:58, melee:true,  role:'Seelenschnitter', cleave:2},
  klaue:  {n:'Klaue',   icon:'sym_klaue',  col:'#d8a060', hp:86,  atk:8,  spd:1.0, range:32,  ms:78, melee:true,  role:'Bestien'},
};
const CLASS_KEYS = Object.keys(CLASSES);

/* ---------- Seltenheiten ---------- */
const RARITY = [
  {id:'c', n:'Gewöhnlich',   col:'#c8ccd4', mul:1.00, slots:1, xp:1},
  {id:'u', n:'Ungewöhnlich', col:'#5ee07a', mul:1.40, slots:2, xp:2},
  {id:'r', n:'Selten',       col:'#4aa8ff', mul:1.90, slots:3, xp:3},
  {id:'e', n:'Episch',       col:'#c06aff', mul:2.50, slots:4, xp:4},
  {id:'l', n:'Legendär',     col:'#ffc83a', mul:3.20, slots:5, xp:6},
];

/* ---------- Fraktionen (Synergien bei 2 / 4 Helden) ---------- */
const FACTIONS = {
  orden:      {n:'Orden',      icon:'fac_orden',      b2:'+15% Heilung & Barrieren',        b4:'Alle Helden +12% LP'},
  wildnis:    {n:'Wildnis',    icon:'fac_wildnis',    b2:'+10% Angriffstempo',             b4:'Beschwörungen +60% LP & Schaden'},
  arkan:      {n:'Arkan',      icon:'fac_arkan',      b2:'+15% Fähigkeitsschaden',          b4:'+25% Manaaufladung'},
  schatten:   {n:'Schatten',   icon:'fac_schatten',   b2:'+10% kritische Trefferchance',    b4:'Kritische Treffer ×2,5 statt ×2'},
  kampfkunst: {n:'Kampfkunst', icon:'fac_kampfkunst', b2:'+15% LP',                         b4:'Treffer betäuben mit 8% Chance'},
  leere:      {n:'Leere',      icon:'fac_leere',      b2:'+10% Schaden',                    b4:'Gegner starten mit −10% LP'},
};

/* ---------- Prägungen (werden beim Verschmelzen weitergegeben, Stufe 1–5) ---------- */
const TRAITS = {
  wirbel:     {n:'Klingenwirbel', icon:'tr_wirbel',     d:l=>`Jeder Treffer auf dasselbe Ziel: +${4*l}% Angriffstempo (bis 5×).`},
  bollwerk:   {n:'Bollwerk',      icon:'tr_bollwerk',   d:l=>`${6*l}% Chance, einen Angriff vollständig zu blocken.`},
  durchbohren:{n:'Durchbohren',   icon:'tr_durchbohren',d:l=>`Angriffe treffen ${l} weitere${l>1?'':'n'} Gegner dahinter (50% Schaden).`},
  funken:     {n:'Funkenflug',    icon:'tr_funken',     d:l=>`${15*l}% Chance, dass ein Treffer auf einen weiteren Gegner überspringt.`},
  chi:        {n:'Chi-Fluss',     icon:'tr_chi',        d:l=>`+${15*l}% Manaaufladung.`},
  ernte:      {n:'Seelenernte',   icon:'tr_ernte',      d:l=>`Tötungen heilen ${4*l}% der max. LP.`},
  raubtier:   {n:'Raubtier',      icon:'tr_raubtier',   d:l=>`Treffer lassen bluten: ${12*l}% des Schadens über 3 Sek.`},
  duell:      {n:'Duell',         icon:'tr_duell',      d:l=>`+${10*l}% Schaden gegen Elite und Bosse.`},
  schildwall: {n:'Schildwall',    icon:'tr_schildwall', d:l=>`Kampfbeginn: Barriere in Höhe von ${8*l}% der LP.`},
  segen:      {n:'Segen',         icon:'tr_segen',      d:l=>`Jeder Angriff heilt den schwächsten Verbündeten um ${1.5*l}% seiner LP.`},
  feuer:      {n:'Glut',          icon:'tr_feuer',      d:l=>`Treffer verbrennen: ${10*l}% des Schadens pro Sek. für 3 Sek.`},
  frost:      {n:'Frost',         icon:'tr_frost',      d:l=>`Treffer verlangsamen um ${8*l}% für 2 Sek.`},
  gift:       {n:'Gift',          icon:'tr_gift',       d:l=>`${12*l}% Chance zu vergiften: ${0.4*l}% der max. LP pro Sek. (4 Sek.).`},
  betaeuben:  {n:'Wucht',         icon:'tr_betaeuben',  d:l=>`${5*l}% Chance, das Ziel 0,7 Sek. zu betäuben.`},
  blendung:   {n:'Blendung',      icon:'tr_blendung',   d:l=>`Getroffene Gegner verfehlen ${6*l}% ihrer Angriffe (3 Sek.).`},
  lebensraub: {n:'Lebensraub',    icon:'tr_lebensraub', d:l=>`${5*l}% des Schadens als Heilung.`},
  krit:       {n:'Präzision',     icon:'tr_krit',       d:l=>`+${7*l}% kritische Trefferchance.`},
  rueckstoss: {n:'Rückstoß',      icon:'tr_rueckstoss', d:l=>`${8*l}% Chance, Gegner zurückzustoßen.`},
  leerenriss: {n:'Leerenriss',    icon:'tr_leerenriss', d:l=>`Gegner unter ${4+2*l}% LP werden sofort vernichtet (keine Bosse).`},
  dornen:     {n:'Dornen',        icon:'tr_dornen',     d:l=>`Wirft ${10*l}% des erlittenen Nahkampfschadens zurück.`},
  rausch:     {n:'Kampfrausch',   icon:'tr_rausch',     d:l=>`+${3*l}% Schaden pro fehlenden 10% LP.`},
  rudel:      {n:'Rudelführer',   icon:'tr_rudel',      d:l=>`Beschwörungen +${20*l}% Werte; alle 12 Sek. ein Wolf (bis ${Math.ceil(l/2)}).`},
  heilig:     {n:'Heiliges Licht',icon:'tr_heilig',     d:l=>`Alle 6 Sek.: Barriere ${4*l}% für den schwächsten Verbündeten.`},
  sternfall:  {n:'Sternfall',     icon:'tr_sternfall',  d:l=>`${10*l}% Chance auf einen Stern: +80% Schaden in kleinem Umkreis.`},
};

/* ---------- Fähigkeiten (Mana voll → wird gewirkt) ----------
   t: strike | aoe | multi | heal | barrier | block | taunt | summon | buff | execute
   m = Schadensmultiplikator, n = Ziele, pick = nearest|lowest|highest|back|random */
const SK = (n, t, o) => Object.assign({n, t}, o);

/* ---------- Helden ----------
   line: c1 → c2a/c2b → c3a/c3b (gewöhnlich), u1 → u2 → u3 (ab ungewöhnlich), leg (legendär)
   tier: Werte-Multiplikator; gift: Prägung, die diese Form beim Verschmelzen weitergibt; fac: Fraktionen */
const HEROES = [
  // KLINGE
  {id:'k1',  cls:'klinge', line:'c1', tier:1.0, n:'Rekrut',            gift:'wirbel',     fac:['kampfkunst'], sk:SK('Kraftschlag','strike',{m:1.8})},
  {id:'k2a', cls:'klinge', line:'c2', tier:1.55,n:'Duellant',          gift:'duell',      fac:['schatten'],   sk:SK('Klingentanz','multi',{m:0.75, hits:3, pick:'nearest'}), next:'k3a'},
  {id:'k2b', cls:'klinge', line:'c2', tier:1.55,n:'Söldner',           gift:'rausch',     fac:['kampfkunst'], sk:SK('Breitseite','aoe',{m:1.5, r:60}), next:'k3b'},
  {id:'k3a', cls:'klinge', line:'c3', tier:2.25,n:'Klingenmeister',    gift:'krit',       fac:['schatten'],   sk:SK('Klingensturm','aoe',{m:1.2, r:80, ticks:3})},
  {id:'k3b', cls:'klinge', line:'c3', tier:2.25,n:'Blutfechter',       gift:'lebensraub', fac:['kampfkunst','leere'], sk:SK('Blutschnitt','strike',{m:2.6, heal:0.5})},
  {id:'ku1', cls:'klinge', line:'u1', tier:1.0, n:'Schattenklinge',    gift:'leerenriss', fac:['schatten'],   sk:SK('Meucheln','strike',{m:2.2, pick:'lowest'})},
  {id:'ku2', cls:'klinge', line:'u2', tier:1.55,n:'Nachtfechterin',    gift:'blendung',   fac:['schatten'],   sk:SK('Schattenschritt','strike',{m:2.8, pick:'back', blink:true})},
  {id:'ku3', cls:'klinge', line:'u3', tier:2.25,n:'Mondschwert-Assassine', gift:'sternfall', fac:['schatten','arkan'], sk:SK('Mondfall','multi',{m:2.0, hits:4, pick:'random'})},
  {id:'kl',  cls:'klinge', line:'leg',tier:2.4, n:'Aurelion, Klinge der Morgenröte', gift:'heilig', fac:['orden','kampfkunst'], sk:SK('Sonnenklinge','aoe',{m:3.0, r:110, buff:{atk:0.25, dur:5}})},
  // SCHILD
  {id:'s1',  cls:'schild', line:'c1', tier:1.0, n:'Wachmann',          gift:'bollwerk',   fac:['orden'],      sk:SK('Schild hoch','block',{dur:1.0})},
  {id:'s2a', cls:'schild', line:'c2', tier:1.55,n:'Schildträger',      gift:'schildwall', fac:['orden'],      sk:SK('Herausforderung','taunt',{dur:3, red:0.3}), next:'s3a'},
  {id:'s2b', cls:'schild', line:'c2', tier:1.55,n:'Ordensnovize',      gift:'heilig',     fac:['orden'],      sk:SK('Schutzsegen','barrier',{pct:0.25, cnt:1}), next:'s3b'},
  {id:'s3a', cls:'schild', line:'c3', tier:2.25,n:'Bollwerk',          gift:'dornen',     fac:['orden','kampfkunst'], sk:SK('Festung','block',{dur:2.0, reflect:1.0})},
  {id:'s3b', cls:'schild', line:'c3', tier:2.25,n:'Lichtpaladin',      gift:'segen',      fac:['orden'],      sk:SK('Heiliges Licht','heal',{pct:0.12, all:true, barrier:0.1})},
  {id:'su1', cls:'schild', line:'u1', tier:1.0, n:'Runenwächter',      gift:'rueckstoss', fac:['arkan'],      sk:SK('Steinhaut','buff',{red:0.5, dur:3})},
  {id:'su2', cls:'schild', line:'u2', tier:1.55,n:'Golemritter',       gift:'betaeuben',  fac:['arkan','wildnis'], sk:SK('Erdstoß','aoe',{m:1.2, r:90, stun:0.8})},
  {id:'su3', cls:'schild', line:'u3', tier:2.25,n:'Titanenwächter',    gift:'schildwall', fac:['arkan','orden'], sk:SK('Titanenruf','taunt',{dur:3, red:0.35, barrier:0.3})},
  {id:'sl',  cls:'schild', line:'leg',tier:2.4, n:'Valdris, die Unbrechbare', gift:'bollwerk', fac:['orden'], sk:SK('Ägide','barrier',{pct:0.25, all:true, block:1.0})},
  // BOGEN
  {id:'b1',  cls:'bogen',  line:'c1', tier:1.0, n:'Jäger',             gift:'durchbohren',fac:['wildnis'],    sk:SK('Gezielter Schuss','strike',{m:2.0})},
  {id:'b2a', cls:'bogen',  line:'c2', tier:1.55,n:'Waldläufer',        gift:'gift',       fac:['wildnis'],    sk:SK('Pfeilhagel','multi',{m:1.0, hits:3, pick:'random'}), next:'b3a'},
  {id:'b2b', cls:'bogen',  line:'c2', tier:1.55,n:'Armbrustschütze',   gift:'rueckstoss', fac:['kampfkunst'], sk:SK('Schwerer Bolzen','strike',{m:2.8, pierce:3})},
  {id:'b3a', cls:'bogen',  line:'c3', tier:2.25,n:'Sturmläuferin',     gift:'funken',     fac:['wildnis','arkan'], sk:SK('Donnerpfeil','multi',{m:1.5, hits:4, chain:true})},
  {id:'b3b', cls:'bogen',  line:'c3', tier:2.25,n:'Ballistenmeister',  gift:'krit',       fac:['kampfkunst'], sk:SK('Ballista','strike',{m:4.0, pick:'highest', pierce:5})},
  {id:'bu1', cls:'bogen',  line:'u1', tier:1.0, n:'Elfenspäherin',     gift:'blendung',   fac:['wildnis'],    sk:SK('Rankenschuss','strike',{m:1.5, root:1.5})},
  {id:'bu2', cls:'bogen',  line:'u2', tier:1.55,n:'Mondbogen',         gift:'frost',      fac:['wildnis','arkan'], sk:SK('Mondpfeile','multi',{m:1.1, hits:4, pick:'random', slow:0.35})},
  {id:'bu3', cls:'bogen',  line:'u3', tier:2.25,n:'Sternenjägerin',    gift:'sternfall',  fac:['wildnis','arkan'], sk:SK('Sternenregen','multi',{m:1.2, hits:6, pick:'random'})},
  {id:'bl',  cls:'bogen',  line:'leg',tier:2.4, n:'Sylwen, Herz des Waldes', gift:'rudel', fac:['wildnis'], sk:SK('Zorn des Waldes','aoe',{m:2.0, r:999, root:1.5})},
  // STAB
  {id:'m1',  cls:'stab',   line:'c1', tier:1.0, n:'Lehrling',          gift:'funken',     fac:['arkan'],      sk:SK('Arkanblitz','strike',{m:2.0, splash:40})},
  {id:'m2a', cls:'stab',   line:'c2', tier:1.55,n:'Feuermagier',       gift:'feuer',      fac:['arkan'],      sk:SK('Feuerball','strike',{m:2.2, splash:70, burn:true}), next:'m3a'},
  {id:'m2b', cls:'stab',   line:'c2', tier:1.55,n:'Heilerin',          gift:'segen',      fac:['orden'],      sk:SK('Heilkreis','heal',{pct:0.2, cnt:3}), next:'m3b'},
  {id:'m3a', cls:'stab',   line:'c3', tier:2.25,n:'Flammenfürst',      gift:'feuer',      fac:['arkan'],      sk:SK('Meteor','strike',{m:3.5, splash:110, burn:true, pick:'highest'})},
  {id:'m3b', cls:'stab',   line:'c3', tier:2.25,n:'Hohepriesterin',    gift:'heilig',     fac:['orden','arkan'], sk:SK('Heiligtum','heal',{pct:0.2, all:true, cleanse:true})},
  {id:'mu1', cls:'stab',   line:'u1', tier:1.0, n:'Frostweberin',      gift:'frost',      fac:['arkan'],      sk:SK('Eisnadel','strike',{m:1.8, slow:0.4})},
  {id:'mu2', cls:'stab',   line:'u2', tier:1.55,n:'Eishexe',           gift:'betaeuben',  fac:['arkan'],      sk:SK('Blizzard','aoe',{m:1.2, r:100, slow:0.4, ticks:3})},
  {id:'mu3', cls:'stab',   line:'u3', tier:2.25,n:'Gletscherkönigin',  gift:'frost',      fac:['arkan'],      sk:SK('Ewiges Eis','aoe',{m:2.0, r:999, stun:1.5})},
  {id:'ml',  cls:'stab',   line:'leg',tier:2.4, n:'Ilmara, Hüterin der Sterne', gift:'sternfall', fac:['arkan','orden'], sk:SK('Sternenfall','multi',{m:2.5, hits:6, pick:'random', splash:50})},
  // FAUST
  {id:'f1',  cls:'faust',  line:'c1', tier:1.0, n:'Novize',            gift:'chi',        fac:['kampfkunst'], sk:SK('Faustkombo','multi',{m:0.6, hits:3, pick:'nearest'})},
  {id:'f2a', cls:'faust',  line:'c2', tier:1.55,n:'Kampfmönch',        gift:'rueckstoss', fac:['kampfkunst'], sk:SK('Donnerpalme','strike',{m:2.0, knock:60}), next:'f3a'},
  {id:'f2b', cls:'faust',  line:'c2', tier:1.55,n:'Chi-Meisterin',     gift:'chi',        fac:['kampfkunst','arkan'], sk:SK('Chi-Welle','aoe',{m:1.5, r:70, selfheal:0.15}), next:'f3b'},
  {id:'f3a', cls:'faust',  line:'c3', tier:2.25,n:'Eisenfaust',        gift:'betaeuben',  fac:['kampfkunst'], sk:SK('Eiserne Faust','strike',{m:4.0, stun:1.0})},
  {id:'f3b', cls:'faust',  line:'c3', tier:2.25,n:'Erleuchtete',       gift:'segen',      fac:['kampfkunst','orden'], sk:SK('Erleuchtung','buff',{mana:40, team:true, heal:0.12})},
  {id:'fu1', cls:'faust',  line:'u1', tier:1.0, n:'Tigerschüler',      gift:'raubtier',   fac:['kampfkunst','wildnis'], sk:SK('Tigerklaue','multi',{m:0.8, hits:3, pick:'nearest', bleed:true})},
  {id:'fu2', cls:'faust',  line:'u2', tier:1.55,n:'Drachenfaust',      gift:'feuer',      fac:['kampfkunst'], sk:SK('Drachenatem','aoe',{m:2.5, r:80, burn:true})},
  {id:'fu3', cls:'faust',  line:'u3', tier:2.25,n:'Himmelsdrache',     gift:'wirbel',     fac:['kampfkunst','arkan'], sk:SK('Drachengeist','aoe',{m:3.0, r:120, stun:0.8})},
  {id:'fl',  cls:'faust',  line:'leg',tier:2.4, n:'Shen-Ra, die Goldene Faust', gift:'chi', fac:['kampfkunst','orden'], sk:SK('Goldene Fäuste','multi',{m:2.0, hits:5, pick:'random', splash:40})},
  // SENSE
  {id:'r1',  cls:'sense',  line:'c1', tier:1.0, n:'Totengräber',       gift:'ernte',      fac:['leere'],      sk:SK('Sensenschwung','aoe',{m:1.4, r:60})},
  {id:'r2a', cls:'sense',  line:'c2', tier:1.55,n:'Grauer Schnitter',  gift:'leerenriss', fac:['leere','schatten'], sk:SK('Todesmal','strike',{m:2.5, exec:0.15}), next:'r3a'},
  {id:'r2b', cls:'sense',  line:'c2', tier:1.55,n:'Knochenruferin',    gift:'gift',       fac:['leere','arkan'], sk:SK('Gruftruf','summon',{kind:'skelett', cnt:2}), next:'r3b'},
  {id:'r3a', cls:'sense',  line:'c3', tier:2.25,n:'Seelensturm',       gift:'ernte',      fac:['leere'],      sk:SK('Seelensturm','aoe',{m:0.9, r:110, ticks:4})},
  {id:'r3b', cls:'sense',  line:'c3', tier:2.25,n:'Lichfürst',         gift:'lebensraub', fac:['leere','arkan'], sk:SK('Untote Armee','summon',{kind:'skelett', cnt:3, drain:true})},
  {id:'ru1', cls:'sense',  line:'u1', tier:1.0, n:'Phantomtänzerin',   gift:'blendung',   fac:['schatten'],   sk:SK('Phantomtanz','buff',{dodge:0.6, dur:2, m:2.0})},
  {id:'ru2', cls:'sense',  line:'u2', tier:1.55,n:'Leerenwandler',     gift:'leerenriss', fac:['leere','schatten'], sk:SK('Leerenriss','aoe',{m:2.2, r:80, slow:0.3})},
  {id:'ru3', cls:'sense',  line:'u3', tier:2.25,n:'Leerenfürst',       gift:'leerenriss', fac:['leere'],      sk:SK('Schwarzes Loch','aoe',{m:3.0, r:130, pull:true})},
  {id:'rl',  cls:'sense',  line:'leg',tier:2.4, n:'Morvek, der Letzte Atem', gift:'ernte', fac:['leere','schatten'], sk:SK('Letzter Atem','aoe',{m:3.0, r:999, exec:0.2})},
  // KLAUE
  {id:'w1',  cls:'klaue',  line:'c1', tier:1.0, n:'Wildfänger',        gift:'rudel',      fac:['wildnis'],    sk:SK('Wolfsruf','summon',{kind:'wolf', cnt:1})},
  {id:'w2a', cls:'klaue',  line:'c2', tier:1.55,n:'Raptorreiter',      gift:'raubtier',   fac:['wildnis'],    sk:SK('Raptorsprung','strike',{m:2.2, bleed:true, leap:true}), next:'w3a'},
  {id:'w2b', cls:'klaue',  line:'c2', tier:1.55,n:'Wolfsbändiger',     gift:'rudel',      fac:['wildnis'],    sk:SK('Rudelruf','summon',{kind:'wolf', cnt:2}), next:'w3b'},
  {id:'w3a', cls:'klaue',  line:'c3', tier:2.25,n:'Dino-Rammer',       gift:'rueckstoss', fac:['wildnis','kampfkunst'], sk:SK('Sturmangriff','aoe',{m:3.0, r:90, knock:80, stun:0.8})},
  {id:'w3b', cls:'klaue',  line:'c3', tier:2.25,n:'Alpha-Werwolf',     gift:'lebensraub', fac:['wildnis','schatten'], sk:SK('Blutrausch','buff',{spd:0.6, dur:4, lifesteal:0.3})},
  {id:'wu1', cls:'klaue',  line:'u1', tier:1.0, n:'Bestienruferin',    gift:'raubtier',   fac:['wildnis'],    sk:SK('Falkenschwarm','multi',{m:0.9, hits:4, pick:'back'})},
  {id:'wu2', cls:'klaue',  line:'u2', tier:1.55,n:'Drachenreiterin',   gift:'feuer',      fac:['wildnis','arkan'], sk:SK('Wyvernatem','aoe',{m:2.2, r:90, burn:true})},
  {id:'wu3', cls:'klaue',  line:'u3', tier:2.25,n:'Wyrmlord',          gift:'rausch',     fac:['wildnis','leere'], sk:SK('Inferno','aoe',{m:3.5, r:140, burn:true})},
  {id:'wl',  cls:'klaue',  line:'leg',tier:2.4, n:'Ugra, Mutter der Bestien', gift:'rudel', fac:['wildnis'], sk:SK('Stampede','aoe',{m:2.0, r:999, knock:60, summon:{kind:'wolf', n:2}})},
];
const HERO = {}; HEROES.forEach(h => HERO[h.id] = h);
// Startform je Klasse und Linie
const LINE_START = {};
CLASS_KEYS.forEach(c => { LINE_START[c] = {
  c: HEROES.find(h => h.cls === c && h.line === 'c1').id,
  u: HEROES.find(h => h.cls === c && h.line === 'u1').id,
  leg: HEROES.find(h => h.cls === c && h.line === 'leg').id }; });
// Entwicklung: Stufe 5 → Tier 2, Stufe 10 → Tier 3
function evoOptions(h){
  if(h.line === 'c1') return HEROES.filter(x => x.cls === h.cls && x.line === 'c2').map(x => x.id);
  if(h.line === 'c2') return [h.next];
  if(h.line === 'u1') return [HEROES.find(x => x.cls === h.cls && x.line === 'u2').id];
  if(h.line === 'u2') return [HEROES.find(x => x.cls === h.cls && x.line === 'u3').id];
  return [];
}
const EVO_LEVELS = [5, 10];
const MAX_LEVEL = 20;

/* Beschwörungen */
const SUMMONS = {
  wolf:    {n:'Wolf',    hp:0.45, atk:0.45, spd:1.2, range:26, ms:90, sprite:null, col:'#9a9aa8'},
  skelett: {n:'Skelett', hp:0.40, atk:0.50, spd:0.9, range:28, ms:55, sprite:null, col:'#e8e0c8'},
};

/* ---------- Relikte ---------- */
// r: Seltenheit 0–3 (Preis), cls: Klassenbezug
const RELICS = [
  {id:'re_schaerfstein', n:'Schärfstein',        r:0, d:'Alle Helden +8% Schaden.'},
  {id:'re_kriegshorn',   n:'Kriegshorn',         r:0, d:'Klingen-Helden +15% Angriffstempo.', cls:'klinge'},
  {id:'re_turmwappen',   n:'Turmwappen',         r:0, d:'Schild-Helden +25% LP.', cls:'schild'},
  {id:'re_elfenfeder',   n:'Elfenfeder',         r:0, d:'Bogen-Helden +15% Schaden und durchbohren 1 Gegner.', cls:'bogen'},
  {id:'re_linse',        n:'Arkane Linse',       r:0, d:'Stab-Helden +18% Schaden.', cls:'stab'},
  {id:'re_perlen',       n:'Gebetsperlen',       r:0, d:'Faust-Helden +25% Manaaufladung.', cls:'faust'},
  {id:'re_laterne',      n:'Seelenlaterne',      r:0, d:'Sensen-Helden heilen sich bei Tötungen um 5%.', cls:'sense'},
  {id:'re_kette',        n:'Fangzahnkette',      r:0, d:'Klauen-Helden +15% Schaden, Beschwörungen +30% LP.', cls:'klaue'},
  {id:'re_muenze',       n:'Glücksmünze',        r:1, d:'Nach einer Niete kostet die nächste Drehung 30% weniger.'},
  {id:'re_wuerfel',      n:'Schicksalswürfel',   r:1, d:'Bringt die erste Drehung einer Welle nichts, wird sie kostenlos wiederholt.'},
  {id:'re_jokerstern',   n:'Jokerstern',         r:1, d:'Jede 5. Drehung enthält garantiert einen Joker.'},
  {id:'re_hebel',        n:'Goldener Hebel',     r:2, d:'+1 Drehung pro Welle.'},
  {id:'re_zinsbeutel',   n:'Zinsbeutel',         r:1, d:'Wellenbeginn: +10 Gold pro 100 Gold im Besitz (max. 60).'},
  {id:'re_sieb',         n:'Kristallsieb',       r:0, d:'Gegner lassen doppelt so oft Kristalle fallen.'},
  {id:'re_phoenix',      n:'Phönixfeder',        r:2, d:'Der erste fallende Held jedes Kampfes steht mit 40% LP wieder auf.'},
  {id:'re_banner',       n:'Frontbanner',        r:1, d:'Der vorderste Held erleidet 20% weniger Schaden.'},
  {id:'re_quelle',       n:'Heilquelle',         r:1, d:'Alle 6 Sek.: Der schwächste Held heilt 10% LP.'},
  {id:'re_barriere',     n:'Barrierenrune',      r:1, d:'Kampfbeginn: Alle Helden erhalten 10% LP als Barriere.'},
  {id:'re_trommel',      n:'Kriegstrommel',      r:0, d:'Die erste Tötung jeder Welle: Der nächste Angriff aller Helden +60%.'},
  {id:'re_kelch',        n:'Blutkelch',          r:1, d:'Alle Helden 5% Lebensraub.'},
  {id:'re_gift',         n:'Giftphiole',         r:1, d:'Treffer vergiften mit 8% Chance (0,5% max. LP/Sek.).'},
  {id:'re_frost',        n:'Frostsplitter',      r:0, d:'Treffer verlangsamen Gegner um 10%.'},
  {id:'re_sturm',        n:'Sturmamulett',       r:2, d:'Alle 5 Sek. trifft ein Blitz 3 Gegner.'},
  {id:'re_auge',         n:'Leerenauge',         r:2, d:'Bosse und Elite starten mit −12% LP.'},
  {id:'re_juwel',        n:'Kronenjuwel',        r:2, d:'Kronen erscheinen doppelt so oft.'},
  {id:'re_rache',        n:'Rache der Gefallenen',r:1, d:'Jeder gefallene Held gibt den übrigen +8% Schaden.'},
  {id:'re_dornen',       n:'Dornenpanzer',       r:1, d:'Alle Helden werfen 12% des Nahkampfschadens zurück.'},
  {id:'re_mana',         n:'Manakristall',       r:1, d:'Helden starten mit 40% Mana.'},
  {id:'re_schwerter',    n:'Wächterschwerter',   r:3, d:'Zwei Schwerter schweben um den Helden mit der höchsten Stufe und greifen mit an.'},
  {id:'re_turm',         n:'Turm der Weisen',    r:2, d:'Dein hinterster Fernkämpfer: +60% Reichweite, wird zuletzt angegriffen.'},
  {id:'re_griff',        n:'Absorptionsgriff',   r:1, d:'Verschmelzen gibt +1 zusätzliche Stufe.'},
  {id:'re_vertrag',      n:'Söldnervertrag',     r:2, d:'Einmal pro Welle: Wähle für 150 Gold einen von 3 gewöhnlichen Helden.'},
  {id:'re_fokus',        n:'Rote Fokuslinse',    r:1, d:'Der Gegner mit den meisten LP erleidet +15% Schaden.'},
  {id:'re_bernstein',    n:'Bernsteinamulett',   r:0, d:'Elite- und Bosswellen geben +50% Gold.'},
  {id:'re_sanduhr',      n:'Zeitsanduhr',        r:1, d:'+15% Manaaufladung für alle.'},
  {id:'re_glocke',       n:'Echoglocke',         r:3, d:'Fähigkeiten werden mit 15% Chance doppelt gewirkt.'},
  {id:'re_faecher',      n:'Klingenfächer',      r:1, d:'Nahkämpfer treffen mit 30% Chance einen weiteren Gegner.'},
  {id:'re_falke',        n:'Falkenauge',         r:1, d:'Fernkämpfer +15% Reichweite und +8% kritische Trefferchance.'},
  {id:'re_ruinenstein',  n:'Ruinenstein',        r:3, d:'+1 Platz auf dem Schlachtfeld.'},
  {id:'re_sternkarte',   n:'Sternenkarte',       r:2, d:'Höhere Seltenheiten erscheinen 50% häufiger.'},
];
const RELIC = {}; RELICS.forEach(r => RELIC[r.id] = r);
const RELIC_PRICE = [3, 4, 6, 8];

/* ---------- Gegner ---------- */
// hp/dmg werden mit der Welle und dem Gebiet skaliert; kind: melee|ranged|runner|tank
const ENEMIES = {
  e_goblin:  {n:'Aschegoblin',       hp:42,  dmg:6,  spd:1.0, range:30,  ms:42, kind:'melee'},
  e_wolf:    {n:'Rußwolf',           hp:30,  dmg:5,  spd:1.4, range:28,  ms:78, kind:'melee'},
  e_shaman:  {n:'Glutschamane',      hp:30,  dmg:7,  spd:0.7, range:190, ms:36, kind:'ranged', proj:'fire'},
  e_golem:   {n:'Moorgolem',         hp:140, dmg:10, spd:0.6, range:34,  ms:26, kind:'tank'},
  e_knight:  {n:'Aschenritter',      hp:260, dmg:16, spd:0.8, range:36,  ms:34, kind:'melee', elite:true},
  e_spider:  {n:'Kristallspinne',    hp:48,  dmg:7,  spd:1.1, range:30,  ms:52, kind:'melee'},
  e_bat:     {n:'Splitterfledermaus',hp:26,  dmg:4,  spd:1.0, range:24,  ms:90, kind:'runner', fly:true},
  e_wisp:    {n:'Eisgeist',          hp:36,  dmg:8,  spd:0.7, range:200, ms:34, kind:'ranged', proj:'ice', fly:true},
  e_colossus:{n:'Quarzkoloss',       hp:170, dmg:12, spd:0.55,range:36,  ms:24, kind:'tank'},
  e_prism:   {n:'Prismawächter',     hp:300, dmg:18, spd:0.8, range:40,  ms:32, kind:'melee', elite:true},
  e_cultist: {n:'Leerenkultist',     hp:40,  dmg:9,  spd:0.7, range:200, ms:34, kind:'ranged', proj:'void'},
  e_hound:   {n:'Schattenhund',      hp:44,  dmg:7,  spd:1.4, range:28,  ms:84, kind:'melee'},
  e_eater:   {n:'Seelenfresser',     hp:70,  dmg:10, spd:1.0, range:30,  ms:46, kind:'melee', drain:0.3},
  e_abyss:   {n:'Abgrundritter',     hp:200, dmg:14, spd:0.6, range:38,  ms:26, kind:'tank'},
  e_prophet: {n:'Leerenprophet',     hp:280, dmg:14, spd:0.6, range:210, ms:28, kind:'ranged', proj:'void', elite:true, summon:'e_imp'},
  e_imp:     {n:'Leerenwichtel',     hp:22,  dmg:4,  spd:1.0, range:24,  ms:92, kind:'runner', fly:true},
};
const BOSSES = {
  b_ent:    {n:'Glutholz-Ent',            hp:2600,  dmg:24, spd:0.5, range:60,  ms:16, abil:['slam','burn']},
  b_mini1:  {n:'Aschenhexe',              hp:2200,  dmg:20, spd:0.6, range:210, ms:20, abil:['firerain','summon:e_wolf']},
  b_varnok: {n:'Varnok, Herr der Asche',  hp:6200,  dmg:34, spd:0.55,range:64,  ms:18, abil:['slam','firerain','enrage']},
  b_wyrm:   {n:'Kristallwyrm',            hp:7400,  dmg:36, spd:0.5, range:70,  ms:16, abil:['breath','slam']},
  b_mirror: {n:'Die Spiegelkönigin',      hp:12000, dmg:42, spd:0.6, range:220, ms:18, abil:['mirror','firerain','summon:e_bat']},
  b_mini2:  {n:'Abgrundbestie',           hp:15000, dmg:48, spd:0.55,range:60,  ms:20, abil:['slam','enrage']},
  b_seraph: {n:'Der Gefallene Seraph',    hp:19000, dmg:52, spd:0.6, range:90,  ms:20, abil:['spear','firerain','summon:e_imp']},
  b_nyx:    {n:"Nyx'thar, Auge der Leere",hp:30000, dmg:60, spd:0.5, range:240, ms:12, abil:['beam','summon:e_cultist','pull','enrage']},
};

/* ---------- Gebiete ---------- */
const REGIONS = [
  {id:'r1', n:'Aschenhain',          bg:'bg_r1', mul:1.0,  pool:['e_goblin','e_wolf','e_shaman','e_golem'],      elite:'e_knight',  boss10:'b_ent',    boss20:'b_varnok', d:'Ein verbrannter Wald direkt hinter der Leere. Hier seid ihr gelandet.'},
  {id:'r2', n:'Kristallschlund',     bg:'bg_r2', mul:2.6,  pool:['e_spider','e_bat','e_wisp','e_colossus'],      elite:'e_prism',   boss10:'b_wyrm',   boss20:'b_mirror', d:'Eine riesige Kristallhöhle. Das Licht bricht sich in tausend Splittern.'},
  {id:'r3', n:'Zitadelle der Leere', bg:'bg_r3', mul:6.5,  pool:['e_cultist','e_hound','e_eater','e_abyss','e_imp'], elite:'e_prophet', boss10:'b_seraph', boss20:'b_nyx', d:'Das Herz dieser Welt. Von hier aus frisst die Leere alles auf.'},
];
const DIFFS = [
  {id:'easy',   n:'Leicht', waves:10, mul:1.0,  runes:1},
  {id:'normal', n:'Normal', waves:20, mul:1.25, runes:2},
];

/* ---------- Spielautomat ---------- */
const SYMBOLS = CLASS_KEYS.concat(['joker', 'krone']);
const SYM_ICON = {joker:'sym_joker', krone:'sym_krone'}; CLASS_KEYS.forEach(c => SYM_ICON[c] = CLASSES[c].icon);
const LINES = [[[0,0],[0,1],[0,2]], [[1,0],[1,1],[1,2]], [[2,0],[2,1],[2,2]], [[0,0],[1,1],[2,2]], [[2,0],[1,1],[0,2]]]; // [reihe, walze]

/* ---------- Balance ---------- */
const BAL = {
  startGold: 500, spinCost: 100, stick: 0.45, spinsPerWave: 6, waveGold: 150, killGold: 3,
  bench: 8, field: 4, hearts: 5, crystalChance: 0.05, levelStat: 0.10,
  manaPerHit: 12, manaPerHurt: 4, manaMax: 100,
  enemyHpPerWave: 0.11, enemyDmgPerWave: 0.08, eHp: 0.5, eDmg: 0.35, bHp: 0.26, bDmg: 0.8,
};

/* ---------- Talentbaum (Runen) ---------- */
// x/y: Position im Baum (Raster), req: Voraussetzung, max: Stufen, cost: Preis je Stufe
const TALENTS = [
  {id:'t_start',  x:0,  y:0,  n:'Siegel der Leere',     d:'Öffnet den Talentbaum.', cost:[1], icon:'ic_portal'},
  {id:'t_unc',    x:0,  y:-1, req:'t_start', n:'Grüner Funke',      d:'Ungewöhnliche Helden können erscheinen (5%).', cost:[8], icon:'sym_joker'},
  {id:'t_unc2',   x:0,  y:-2, req:'t_unc',   n:'Grünes Feuer',      d:'+5% ungewöhnliche Helden.', cost:[20, 35], max:2, icon:'sym_joker'},
  {id:'t_rare',   x:0,  y:-3, req:'t_unc2',  n:'Blauer Stern',      d:'Seltene Helden können erscheinen (2%).', cost:[60], icon:'sym_joker'},
  {id:'t_rare2',  x:0,  y:-4, req:'t_rare',  n:'Blaues Feuer',      d:'+1,5% seltene Helden.', cost:[90, 140], max:2, icon:'sym_joker'},
  {id:'t_epic',   x:0,  y:-5, req:'t_rare2', n:'Violette Krone',    d:'Epische Helden können erscheinen (1%).', cost:[200], icon:'sym_krone'},
  {id:'t_leg',    x:0,  y:-6, req:'t_epic',  n:'Goldenes Schicksal',d:'Legendäre Helden können erscheinen (0,4%).', cost:[400], icon:'sym_krone'},
  {id:'t_field',  x:1,  y:0,  req:'t_start', n:'Weites Feld',       d:'+1 Platz auf dem Schlachtfeld.', cost:[12, 45, 120, 260], max:4, icon:'ic_level'},
  {id:'t_gold',   x:2,  y:0,  req:'t_field', n:'Kriegskasse',       d:'+50 Startgold.', cost:[6, 18, 40], max:3, icon:'ic_gold'},
  {id:'t_spin',   x:2,  y:-1, req:'t_gold',  n:'Zweiter Atem',      d:'+1 Drehung pro Welle.', cost:[70, 220], max:2, icon:'ic_hebel'},
  {id:'t_nudge',  x:3,  y:0,  req:'t_gold',  n:'Schicksalsstoß',    d:'+1 Walzenstoß pro Welle.', cost:[50], icon:'ic_hebel'},
  {id:'t_joker',  x:3,  y:-1, req:'t_nudge', n:'Wilde Karte',       d:'Joker erscheinen 60% häufiger.', cost:[40, 90], max:2, icon:'sym_joker'},
  {id:'t_crown',  x:4,  y:-1, req:'t_joker', n:'Königsrecht',       d:'Kronen erscheinen auf den Walzen (freie Heldenwahl).', cost:[70], icon:'sym_krone'},
  {id:'t_blast',  x:4,  y:0,  req:'t_nudge', n:'Sprengwalze',       d:'Einmal pro Welle: alle Symbole einer Sorte sprengen, neue fallen nach.', cost:[110], icon:'sym_bombe'},
  {id:'t_heart',  x:-1, y:0,  req:'t_start', n:'Zähes Herz',        d:'+1 Leben.', cost:[10, 40], max:2, icon:'ic_herz'},
  {id:'t_relic',  x:-2, y:0,  req:'t_heart', n:'Reliktbeutel',      d:'+1 Reliktplatz.', cost:[35, 120], max:2, icon:'ic_truhe'},
  {id:'t_reroll', x:-2, y:-1, req:'t_relic', n:'Feilscher',         d:'Laden-Erneuern kostet 1 Kristall weniger (min. 0 beim ersten Mal).', cost:[30], icon:'ic_kristall'},
  {id:'t_crys',   x:-3, y:0,  req:'t_relic', n:'Kristallader',      d:'Start mit +2 Kristallen.', cost:[15, 40], max:2, icon:'ic_kristall'},
  {id:'t_fac',    x:-1, y:-1, req:'t_heart', n:'Bündnisse',         d:'Schaltet Fraktions-Synergien frei.', cost:[25], icon:'fac_orden'},
  {id:'t_fac2',   x:-1, y:-2, req:'t_fac',   n:'Treue Schwüre',     d:'Fraktions-Boni +50%.', cost:[150], icon:'fac_arkan'},
  {id:'t_xp',     x:1,  y:-1, req:'t_field', n:'Seelenbund',        d:'Verschmelzen gibt +1 zusätzliche Stufe (jedes 2. Mal).', cost:[45], icon:'ic_level'},
  {id:'t_merc',   x:1,  y:-2, req:'t_xp',    n:'Söldnergilde',      d:'Startet jeden Lauf mit dem Relikt „Söldnervertrag“.', cost:[80], icon:'re_vertrag'},
  {id:'t_safe',   x:-3, y:-1, req:'t_crys',  n:'Schonfrist',        d:'In den ersten 3 Wellen verlierst du keine Leben.', cost:[20], icon:'ic_herz'},
  {id:'t_runes',  x:-4, y:0,  req:'t_crys',  n:'Runenjäger',        d:'+20% Runen aus Elite- und Bosswellen.', cost:[60, 160], max:2, icon:'ic_rune'},
];
const TALENT = {}; TALENTS.forEach(t => TALENT[t.id] = t);
