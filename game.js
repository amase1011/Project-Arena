'use strict';

const $ = id => document.getElementById(id);
const canvas = $('battleCanvas');
const ctx = canvas.getContext('2d');

const ATTRS = {
  none: { name: '無', icon: '○' },
  fire: { name: '火', icon: '🔥' },
  wood: { name: '木', icon: '🌳' },
  earth: { name: '土', icon: '🪨' },
  lightning: { name: '雷', icon: '⚡' },
  water: { name: '水', icon: '💧' }
};
const ADV = { fire: 'wood', wood: 'earth', earth: 'lightning', lightning: 'water', water: 'fire' };

const DIFFICULTIES = {
  easy: {
    label: '初級', randomPick: 0.52, jitter: 24,
    attrBase: 48, counterBonus: 9, dangerPenalty: 6,
    doubleFactor: 2.1, rerollThreshold: -Infinity
  },
  normal: {
    label: '中級', randomPick: 0.12, jitter: 10,
    attrBase: 68, counterBonus: 25, dangerPenalty: 18,
    doubleFactor: 4.0, rerollThreshold: 61
  },
  hard: {
    label: '上級', randomPick: 0, jitter: 2.5,
    attrBase: 76, counterBonus: 38, dangerPenalty: 30,
    doubleFactor: 5.4, rerollThreshold: 72
  }
};

const UNITS = {
  shield:   { name: '盾兵',       role: 'タンク',       lane: 'front', count: 2, hp: 220, atk: 15, range: 17, speed: 31, rate: 1.28 },
  golem:    { name: 'ゴーレム',   role: 'タンク',       lane: 'front', count: 1, hp: 405, atk: 31, range: 19, speed: 19, rate: 1.82 },
  bomber:   { name: '爆弾獣',     role: '特攻',         lane: 'front', count: 3, hp: 45,  atk: 102,range: 8,  speed: 52, rate: 99, bomb: true, detect: 58 },
  knight:   { name: 'ナイト',     role: 'ナイト',       lane: 'mid',   count: 2, hp: 150, atk: 38, range: 19, speed: 53, rate: 1.08 },
  wolf:     { name: 'ウルフ',     role: 'ナイト',       lane: 'mid',   count: 3, hp: 80,  atk: 24, range: 15, speed: 88, rate: 0.69 },
  assassin: { name: 'アサシン',   role: 'アサシン',     lane: 'mid',   count: 1, hp: 88,  atk: 50, range: 14, speed: 86, rate: 1.62, backline: true },
  archer:   { name: 'アーチャー', role: 'アーチャー',   lane: 'back',  count: 2, hp: 74,  atk: 31, range: 96, speed: 38, rate: 1.22, projectile: 'arrow' },
  ranger:   { name: 'レンジャー', role: 'レンジャー',   lane: 'back',  count: 2, hp: 84,  atk: 24, range: 92, speed: 46, rate: 0.94, projectile: 'orb' },
  priest:   { name: 'プリースト', role: 'サポーター',   lane: 'back',  count: 1, hp: 98,  atk: 10, range: 90, speed: 37, rate: 1.70, projectile: 'light', heal: true }
};

const ATTACK_PROFILE = {
  shield:   { duration: 0.46, hitAt: 0.62 },
  golem:    { duration: 0.58, hitAt: 0.68 },
  bomber:   { duration: 0.52, hitAt: 1.00 },
  knight:   { duration: 0.48, hitAt: 0.58 },
  wolf:     { duration: 0.38, hitAt: 0.54 },
  assassin: { duration: 0.34, hitAt: 0.48 },
  archer:   { duration: 0.52, hitAt: 0.64 },
  ranger:   { duration: 0.48, hitAt: 0.58 },
  priest:   { duration: 0.56, hitAt: 0.68 }
};

const unitCards = Object.keys(UNITS).map(id => ({
  id: `u_${id}`, type: 'unit', unit: id, name: UNITS[id].name,
  tag: UNITS[id].role, desc: `${UNITS[id].count}体召喚`
}));
const buffs = [
  { id: 'b_hp',   type: 'buff', name: '鉄壁訓練', tag: '強化',     desc: '全ユニット耐久 +15%', stat: 'hp',   value: 0.15, icon: '♥' },
  { id: 'b_atk',  type: 'buff', name: '猛攻訓練', tag: '強化',     desc: '全ユニット攻撃 +15%', stat: 'atk',  value: 0.15, icon: '⚔' },
  { id: 'b_spd',  type: 'buff', name: '迅速訓練', tag: '強化',     desc: '攻撃間隔 -12%',       stat: 'rate', value: 0.12, icon: '➤' },
  { id: 'b_bomb', type: 'buff', name: '火薬調整', tag: '特攻強化', desc: '爆発威力 +25%',       stat: 'bomb', value: 0.25, icon: '●' }
];
const attrCards = Object.keys(ATTRS).map(k => ({
  id: `a_${k}`, type: 'attr', attr: k, name: `${ATTRS[k].icon} ${ATTRS[k].name}属性`,
  tag: '属性', desc: 'ラウンド開始まで双方非公開'
}));
const doubleCards = Object.keys(UNITS).map(id => ({
  id: `d_${id}`, type: 'double', unit: id,
  name: `${UNITS[id].name}部隊2倍`, tag: '増援 ×2',
  desc: `現在いる${UNITS[id].name}と同じ数を追加召喚`
}));
const rares = [
  { id: 'r_life',  type: 'rare', name: 'レアカード（？）', tag: 'レア（？）', desc: 'ラウンド開始時に開封', effect: 'life' },
  { id: 'r_swap',  type: 'rare', name: 'レアカード（？）', tag: 'レア（？）', desc: 'ラウンド開始時に開封', effect: 'swap' },
  { id: 'r_blank', type: 'rare', name: 'レアカード（？）', tag: 'レア（？）', desc: 'ラウンド開始時に開封', effect: 'blank' }
];

const IMAGE_CACHE = new Map();
function imagePath(id, side = 'neutral') { return `assets/units/${side}/${id}.png`; }
function getImage(id, side = 'neutral') {
  const key = `${side}:${id}`;
  if (IMAGE_CACHE.has(key)) return IMAGE_CACHE.get(key);
  const img = new Image();
  img.src = imagePath(id, side);
  IMAGE_CACHE.set(key, img);
  return img;
}
for (const id of Object.keys(UNITS)) {
  for (const side of ['neutral', 'blue', 'red']) getImage(id, side);
}

const LANE_ORDER = ['front', 'mid', 'back'];
const UNIT_FORMATION_ORDER = {
  front: ['bomber', 'shield', 'golem'],
  mid: ['knight', 'wolf', 'assassin'],
  back: ['archer', 'ranger', 'priest']
};
const UNIT_FORMATION_INDEX = new Map(
  Object.values(UNIT_FORMATION_ORDER).flat().map((type, index) => [type, index])
);
const LANE_CENTER = {
  npc: { front: 232, mid: 170, back: 108 },
  you: { front: 408, mid: 470, back: 532 }
};
const SIDE_FORMATION_AREA = {
  npc: { min: 72, max: 292, verticalOrder: ['back', 'mid', 'front'], anchor: 'front' },
  you: { min: 348, max: 568, verticalOrder: ['front', 'mid', 'back'], anchor: 'front' }
};
const FIELD_CENTER_X = 210;
const FORMATION_WIDTH = 330;
const FORMATION_UNITS_PER_ROW = 15;
const FORMATION_X_SPACING = 22;
const FORMATION_ROW_SPACING = 29;
const FORMATION_LANE_GAP = 38;
const FORMATION_TYPE_GAP = 4;
const FORMATION_SCALE = 0.72;
const TIMING = {
  cardExit: 175,
  summonSettle: 610,
  npcStep: 110,
  npcBetween: 125,
  layoutExisting: 420,
  layoutNew: 520,
  resultHoldBeforeLoss: 900,
  resultHoldAfterLoss: 1500
};

let state;
let previewRaf = 0;
let selectedDifficulty = 'normal';
const DEFAULT_SETTINGS = { showAffinityGuide: true };
let settings = loadSettings();

function freshPlayer() {
  return { life: 5, attr: 'none', army: [], buff: { hp: 0, atk: 0, rate: 0, bomb: 0 }, rare: [], pendingAttr: [] };
}
function fresh() {
  return {
    round: 1, you: freshPlayer(), npc: freshPlayer(), loser: null,
    difficulty: selectedDifficulty,
    pick: 0, picksNeeded: 3, rerolled: false, timeLeft: 30, timer: null,
    npcPickCount: 0, npcPicksNeeded: 3, npcRerolled: false,
    phase: 'draft', previewUnits: [], summonFx: [], battle: null
  };
}
function hearts(n) { return '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, 5 - n)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('projectArenaSettings') || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function saveSettings() {
  try { localStorage.setItem('projectArenaSettings', JSON.stringify(settings)); } catch {}
}
function syncSettingsUi() {
  if ($('affinityToggle')) $('affinityToggle').checked = Boolean(settings.showAffinityGuide);
  updateAffinityGuide();
}
function updateAffinityGuide() {
  const guide = $('affinityGuide');
  if (!guide) return;
  const gameVisible = !$('gameView').classList.contains('hidden');
  const visible = Boolean(settings.showAffinityGuide && gameVisible && state?.phase === 'draft');
  guide.classList.toggle('hidden', !visible);
}

function showHome() {
  clearInterval(state?.timer);
  stopPreviewLoop();
  if (state?.battle) state.battle.done = true;
  $('revealOverlay').classList.add('hidden');
  $('gameView').classList.add('hidden');
  $('homeView').classList.remove('hidden');
  $('settingsPanel').classList.add('hidden');
  updateAffinityGuide();
}

function startGame(difficulty) {
  selectedDifficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
  $('difficultyLabel').textContent = DIFFICULTIES[selectedDifficulty].label;
  $('homeView').classList.add('hidden');
  $('gameView').classList.remove('hidden');
  init();
  syncSettingsUi();
}

function init() {
  clearInterval(state?.timer);
  stopPreviewLoop();
  if (state?.battle) state.battle.done = true;
  state = fresh();
  $('difficultyLabel').textContent = DIFFICULTIES[state.difficulty].label;
  $('gameOverView').classList.add('hidden');
  $('resultPanel').classList.add('hidden');
  syncSettingsUi();
  nextDraft();
}

function updateHud(hidden = true) {
  $('youLife').textContent = hearts(state.you.life);
  $('npcLife').textContent = hearts(state.npc.life);
  $('youAttr').textContent = hidden ? '？？？' : ATTRS[state.you.attr].icon + ATTRS[state.you.attr].name;
  $('npcAttr').textContent = hidden ? '？？？' : ATTRS[state.npc.attr].icon + ATTRS[state.npc.attr].name;
}

function availableDoubleCards(side) {
  const owned = new Set(state[side].army);
  return doubleCards.filter(card => owned.has(card.unit));
}

function weightedCard(round, side = 'you') {
  const r = Math.random();
  if (r < 0.01) return rand(rares);                  // 1% total rare
  if (r < 0.045) return rand(attrCards);             // keep attribute rate at 3.5%
  if (round > 1 && r < 0.095) {                      // 5% total reinforcement
    const eligible = availableDoubleCards(side);
    if (eligible.length) return rand(eligible);
  }
  return rand(round === 1 ? unitCards : [...unitCards, ...buffs]);
}
function offers(side = 'you') {
  const result = [];
  let guard = 0;
  while (result.length < 3 && guard++ < 80) {
    const card = weightedCard(state.round, side);
    if (!result.some(x => x.id === card.id)) result.push(card);
  }
  return result;
}

function nextDraft() {
  clearInterval(state.timer);
  state.phase = 'draft';
  state.pick = 0;
  state.picksNeeded = state.loser === 'you' ? 4 : 3;
  state.rerolled = false;
  state.npcPickCount = 0;
  state.npcPicksNeeded = state.loser === 'npc' ? 4 : 3;
  state.npcRerolled = false;
  $('phase').textContent = 'DRAFT';
  $('draftPanel').classList.remove('hidden', 'summoning');
  $('resultPanel').classList.add('hidden');
  $('rerollBtn').classList.remove('hidden');
  updateHud(true);
  rebuildPreview(false);
  renderOffers(offers('you'));
  startTimer();
  startPreviewLoop();
  updateAffinityGuide();
}

const TIMER_CIRC = 150.796;
function updateTimerRing() {
  const progress = clamp((30 - state.timeLeft) / 30, 0, 1);
  $('timerProgress').style.strokeDashoffset = String(TIMER_CIRC * (1 - progress));
}
function startTimer() {
  clearInterval(state.timer);
  state.timeLeft = 30;
  $('timer').textContent = '30';
  updateTimerRing();
  state.timer = setInterval(() => {
    state.timeLeft--;
    $('timer').textContent = String(Math.max(0, state.timeLeft));
    updateTimerRing();
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      const cards = [...document.querySelectorAll('.card')];
      if (cards.length) rand(cards).click();
    }
  }, 1000);
}

function renderOffers(cards) {
  const root = $('cards');
  root.innerHTML = '';
  $('draftTitle').textContent = `カード選択 ${state.pick + 1}/${state.picksNeeded}`;
  $('draftHelp').textContent = '同じユニットごとに中央揃えで自動整列します';
  cards.forEach(card => {
    const button = document.createElement('button');
    button.className = `card ${card.type}`;
    button.innerHTML = `<span class="tag">${card.tag}</span><div class="card-art">${cardArt(card)}</div><h3>${card.name}</h3><p>${card.desc}</p>`;
    button.onclick = () => pick(card);
    root.appendChild(button);
  });
}
function cardArt(card) {
  if (card.type === 'unit' || card.type === 'double') return `<img src="${imagePath(card.unit, 'neutral')}" alt="${card.name}">`;
  if (card.type === 'attr') {
    const a = ATTRS[card.attr];
    return `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="45" fill="#fff6" stroke="#e8bc54" stroke-width="5"/><text x="60" y="76" text-anchor="middle" font-size="48">${a.icon}</text></svg>`;
  }
  if (card.type === 'rare') return '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="45" fill="#bc74ff55" stroke="#b05cff" stroke-width="5"/><text x="60" y="79" text-anchor="middle" font-size="62" font-weight="900" fill="#7e38bd">?</text></svg>';
  return `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="45" fill="#6ed0a455" stroke="#54bb87" stroke-width="5"/><text x="60" y="80" text-anchor="middle" font-size="58" fill="#326e54">${card.icon}</text></svg>`;
}

async function pick(card) {
  if (state.phase !== 'draft') return;
  clearInterval(state.timer);
  state.phase = 'summon';
  updateAffinityGuide();
  $('draftPanel').classList.add('summoning');
  await wait(TIMING.cardExit);
  $('draftPanel').classList.add('hidden');
  $('draftPanel').classList.remove('summoning');
  applyCard(state.you, card, 'you');
  await revealNpcStep();
  state.pick++;
  const playerMessage = card.type === 'unit'
    ? `${card.name} 召喚！`
    : card.type === 'double' ? `${card.name}！` : card.name;
  showBanner(playerMessage, 590);
  await wait(TIMING.summonSettle);
  if (state.pick >= state.picksNeeded) {
    $('rerollBtn').classList.add('hidden');
    await completeNpcDraft();
    beginRound();
    return;
  }
  state.phase = 'draft';
  updateAffinityGuide();
  $('draftPanel').classList.remove('hidden');
  renderOffers(offers('you'));
  startTimer();
}

function applyCard(player, card, side) {
  if (card.type === 'unit') {
    player.army.push(card.unit);
    rebuildPreview(true);
  } else if (card.type === 'double') {
    const groups = player.army.filter(type => type === card.unit).length;
    if (groups > 0) {
      player.army.push(...Array(groups).fill(card.unit));
      rebuildPreview(true);
      showBanner(`${side === 'you' ? 'YOU' : 'NPC'}：${UNITS[card.unit].name}が2倍！`, 480);
    }
  } else if (card.type === 'buff') {
    player.buff[card.stat] += card.value;
    showBanner(`${side === 'you' ? 'YOU' : 'NPC'}：${card.name}`, 400);
  } else if (card.type === 'attr') {
    player.pendingAttr = [card.attr];
    summonHiddenToken(side, 'attr');
  } else if (card.type === 'rare') {
    player.rare.push(card.effect);
    summonHiddenToken(side, 'rare');
  }
}

function individualCount(player, unitId) {
  return player.army.reduce((sum, type) => sum + (type === unitId ? UNITS[unitId].count : 0), 0);
}
function laneCount(player, lane) {
  return player.army.reduce((sum, type) => sum + (UNITS[type].lane === lane ? UNITS[type].count : 0), 0);
}
function totalIndividuals(player) {
  return player.army.reduce((sum, type) => sum + UNITS[type].count, 0);
}

function chooseNpc(cards) {
  const difficulty = DIFFICULTIES[state.difficulty];
  if (Math.random() < difficulty.randomPick) return rand(cards);
  return [...cards]
    .map(card => ({ card, score: scoreNpc(card) }))
    .sort((a, b) => b.score - a.score)[0].card;
}

function scoreNpc(card) {
  const difficulty = DIFFICULTIES[state.difficulty];
  const npc = state.npc;
  const you = state.you;
  const jitter = (Math.random() - 0.5) * difficulty.jitter;

  if (card.type === 'rare') return 84 + jitter;

  if (card.type === 'attr') {
    let score = difficulty.attrBase;
    const opponentAttr = you.attr; // previous round's public attribute only
    const currentAttr = npc.pendingAttr.length ? npc.pendingAttr[npc.pendingAttr.length - 1] : npc.attr;
    if (card.attr === 'none') score -= state.difficulty === 'easy' ? 4 : 13;
    else score += state.difficulty === 'easy' ? 3 : 9;
    if (currentAttr === 'none' && card.attr !== 'none') score += state.difficulty === 'hard' ? 15 : 8;
    if (card.attr === currentAttr) score -= state.difficulty === 'hard' ? 16 : 9;
    if (opponentAttr !== 'none') {
      if (ADV[card.attr] === opponentAttr) score += difficulty.counterBonus;
      if (ADV[opponentAttr] === card.attr) score -= difficulty.dangerPenalty;
      if (ADV[opponentAttr] === currentAttr && ADV[card.attr] === opponentAttr) score += state.difficulty === 'hard' ? 12 : 6;
    }
    return score + jitter;
  }

  if (card.type === 'double') {
    const count = individualCount(npc, card.unit);
    if (!count) return -100;
    let score = 49 + Math.min(58, count * difficulty.doubleFactor);
    if (UNITS[card.unit].lane === 'front' && laneCount(npc, 'front') < laneCount(npc, 'back')) score += 7;
    if (card.unit === 'priest' && count >= 2) score -= 5;
    return score + jitter;
  }

  if (card.type === 'unit') {
    let score = 55;
    const total = totalIndividuals(npc);
    const lane = UNITS[card.unit].lane;
    const ownLane = laneCount(npc, lane);
    const minLane = Math.min(...LANE_ORDER.map(name => laneCount(npc, name)));
    if (total < 6) score += 17;
    if (ownLane === minLane) score += state.difficulty === 'hard' ? 16 : 9;
    if (ownLane === 0) score += 8;
    if (['shield', 'golem'].includes(card.unit) && laneCount(npc, 'front') < 4) score += 11;
    if (card.unit === 'priest' && individualCount(npc, 'priest') === 0 && total >= 5) score += 12;
    if (card.unit === 'assassin' && laneCount(you, 'back') >= 4) score += state.difficulty === 'hard' ? 16 : 8;
    if (['archer', 'ranger'].includes(card.unit) && laneCount(you, 'front') >= 5) score += 8;
    if (card.unit === 'bomber' && totalIndividuals(you) >= 9) score += 8;
    return score + jitter;
  }

  if (card.type === 'buff') {
    if (!npc.army.length) return 15 + jitter;
    let score = 58 + Math.min(16, totalIndividuals(npc) * 0.8);
    if (card.stat === 'bomb' && individualCount(npc, 'bomber') === 0) score -= 28;
    if (card.stat === 'bomb' && individualCount(npc, 'bomber') >= 3) score += 10;
    return score + jitter;
  }
  return 20 + jitter;
}

function npcBestScore(cards) {
  return Math.max(...cards.map(card => scoreNpc(card)));
}
function npcOffersForTurn() {
  let cards = offers('npc');
  const threshold = DIFFICULTIES[state.difficulty].rerollThreshold;
  if (!state.npcRerolled && npcBestScore(cards) < threshold) {
    state.npcRerolled = true;
    cards = offers('npc');
  }
  return cards;
}
async function revealNpcStep() {
  if (state.npcPickCount >= state.npcPicksNeeded) return;
  const card = chooseNpc(npcOffersForTurn());
  state.npcPickCount++;
  applyCard(state.npc, card, 'npc');
  await wait(TIMING.npcStep);
}
async function completeNpcDraft() {
  while (state.npcPickCount < state.npcPicksNeeded) {
    await revealNpcStep();
    await wait(TIMING.npcBetween);
  }
}
$('rerollBtn').onclick = () => {
  if (state.rerolled) return;
  state.rerolled = true;
  $('rerollBtn').classList.add('hidden');
  renderOffers(offers('you'));
  startTimer();
};

function expandArmy(side) {
  const counts = {};
  const list = [];
  for (const type of state[side].army) {
    const unit = UNITS[type];
    for (let i = 0; i < unit.count; i++) {
      const ordinal = counts[type] || 0;
      counts[type] = ordinal + 1;
      list.push({ key: `${side}:${type}:${ordinal}`, side, type, lane: unit.lane, ordinal });
    }
  }
  return list;
}

function buildGroupedRows(group) {
  const rows = [];
  let current = [];
  const grouped = new Map();
  for (const descriptor of group) {
    if (!grouped.has(descriptor.type)) grouped.set(descriptor.type, []);
    grouped.get(descriptor.type).push(descriptor);
  }

  const orderedTypes = [...grouped.keys()].sort((a, b) =>
    (UNIT_FORMATION_INDEX.get(a) ?? 99) - (UNIT_FORMATION_INDEX.get(b) ?? 99)
  );

  for (const type of orderedTypes) {
    const units = grouped.get(type).sort((a, b) => a.ordinal - b.ordinal);
    while (units.length) {
      const capacity = FORMATION_UNITS_PER_ROW - current.length;
      if (current.length && units.length > capacity) {
        rows.push(current);
        current = [];
        continue;
      }
      const take = Math.min(FORMATION_UNITS_PER_ROW - current.length, units.length);
      current.push(...units.splice(0, take));
      if (current.length === FORMATION_UNITS_PER_ROW) {
        rows.push(current);
        current = [];
      }
    }
  }
  if (current.length) rows.push(current);
  return rows;
}

function formationFor(side, descriptors) {
  const result = new Map();
  const laneGroups = Object.fromEntries(LANE_ORDER.map(lane => [
    lane,
    descriptors
      .filter(unit => unit.lane === lane)
      .sort((a, b) => (UNIT_FORMATION_INDEX.get(a.type) ?? 99) - (UNIT_FORMATION_INDEX.get(b.type) ?? 99) || a.ordinal - b.ordinal)
  ]));
  const laneRows = Object.fromEntries(LANE_ORDER.map(lane => [lane, buildGroupedRows(laneGroups[lane])]));
  const area = SIDE_FORMATION_AREA[side];
  const blocks = [];

  for (const lane of area.verticalOrder) {
    const rows = laneRows[lane];
    if (!rows.length) continue;
    const span = (rows.length - 1) * FORMATION_ROW_SPACING;
    blocks.push({ lane, rows, span, min: LANE_CENTER[side][lane] - span / 2, max: LANE_CENTER[side][lane] + span / 2 });
  }

  // 前衛・中衛・後衛の順番は固定。密度が上がった場合も縮小せず、
  // 同じユニットを連続配置した追加行を後方へ伸ばす。
  for (let i = 1; i < blocks.length; i++) {
    const requiredMin = blocks[i - 1].max + FORMATION_LANE_GAP;
    if (blocks[i].min < requiredMin) {
      const shift = requiredMin - blocks[i].min;
      blocks[i].min += shift;
      blocks[i].max += shift;
    }
  }

  if (blocks.length) {
    const totalMin = blocks[0].min;
    const totalMax = blocks[blocks.length - 1].max;
    const totalSpan = totalMax - totalMin;
    const available = area.max - area.min;
    let shift = 0;
    if (totalSpan <= available) {
      if (totalMin < area.min) shift = area.min - totalMin;
      if (totalMax + shift > area.max) shift += area.max - (totalMax + shift);
    } else if (side === 'npc') {
      shift = area.max - totalMax;
    } else {
      shift = area.min - totalMin;
    }
    for (const block of blocks) {
      block.min += shift;
      block.max += shift;
    }
  }

  for (const block of blocks) {
    block.rows.forEach((rowUnits, row) => {
      let rowWidth = Math.max(0, rowUnits.length - 1) * FORMATION_X_SPACING;
      for (let i = 1; i < rowUnits.length; i++) {
        if (rowUnits[i - 1].type !== rowUnits[i].type) rowWidth += FORMATION_TYPE_GAP;
      }
      let x = FIELD_CENTER_X - rowWidth / 2;
      const y = block.min + row * FORMATION_ROW_SPACING;
      rowUnits.forEach((unit, col) => {
        if (col > 0) {
          x += FORMATION_X_SPACING;
          if (rowUnits[col - 1].type !== unit.type) x += FORMATION_TYPE_GAP;
        }
        result.set(unit.key, {
          x, y, scale: FORMATION_SCALE, lane: block.lane, row,
          rows: block.rows.length, rowCount: rowUnits.length, group: unit.type
        });
      });
    });
  }
  return result;
}

function updatePreviewPose(unit, now = performance.now()) {
  if (!unit.layoutStart) return;
  const q = clamp((now - unit.layoutStart) / unit.layoutDuration, 0, 1);
  const e = easeOutCubic(q);
  unit.x = lerp(unit.fromX, unit.toX, e);
  unit.y = lerp(unit.fromY, unit.toY, e);
  unit.scale = lerp(unit.fromScale, unit.toScale, e);
  unit.alpha = lerp(unit.fromAlpha, 1, Math.min(1, q * 1.8));
  unit.bounce = Math.sin(Math.PI * q) * 5;
  if (q >= 1) {
    unit.layoutStart = 0;
    unit.x = unit.toX;
    unit.y = unit.toY;
    unit.scale = unit.toScale;
    unit.alpha = 1;
    unit.bounce = 0;
  }
}

function rebuildPreview(animate = false) {
  const now = performance.now();
  const oldMap = new Map(state.previewUnits.map(unit => {
    updatePreviewPose(unit, now);
    return [unit.key, unit];
  }));
  const next = [];

  for (const side of ['npc', 'you']) {
    const descriptors = expandArmy(side);
    const positions = formationFor(side, descriptors);
    for (const descriptor of descriptors) {
      const target = positions.get(descriptor.key);
      const old = oldMap.get(descriptor.key);
      const spawnY = side === 'you' ? 615 : 25;
      const unit = old || {
        ...descriptor,
        x: FIELD_CENTER_X,
        y: spawnY,
        scale: target.scale * 0.72,
        alpha: animate ? 0 : 1,
        bounce: 0,
        seed: Math.random() * Math.PI * 2,
        look: side === 'you' ? -1 : 1
      };
      Object.assign(unit, descriptor);
      if (animate) {
        unit.fromX = unit.x;
        unit.fromY = unit.y;
        unit.fromScale = unit.scale || target.scale;
        unit.fromAlpha = old ? 1 : 0;
        unit.toX = target.x;
        unit.toY = target.y;
        unit.toScale = target.scale;
        unit.layoutStart = now;
        unit.layoutDuration = old ? TIMING.layoutExisting : TIMING.layoutNew;
      } else {
        unit.x = target.x;
        unit.y = target.y;
        unit.scale = target.scale;
        unit.alpha = 1;
        unit.bounce = 0;
        unit.layoutStart = 0;
      }
      next.push(unit);
    }
  }
  state.previewUnits = next;
}

function summonHiddenToken(side, kind) { state.summonFx.push({ token: true, side, kind, t: 0 }); }

async function beginRound() {
  clearInterval(state.timer);
  $('draftPanel').classList.add('hidden');
  state.phase = 'reveal';
  updateAffinityGuide();
  $('phase').textContent = 'REVEAL';
  if (!state.you.army.length) state.you.army.push('knight');
  if (!state.npc.army.length) state.npc.army.push('knight');
  rebuildPreview(true);
  await revealPending('npc');
  await revealPending('you');
  rebuildPreview(true);
  await wait(360);
  $('phase').textContent = 'BATTLE';
  updateHud(false);
  showBanner(`${ATTRS[state.npc.attr].icon} NPC　VS　YOU ${ATTRS[state.you.attr].icon}`, 650);
  await wait(700);
  startBattle();
}

async function revealPending(side) {
  const player = state[side];
  if (player.pendingAttr.length) {
    const attr = player.pendingAttr[player.pendingAttr.length - 1];
    player.pendingAttr = [];
    await revealCard('attribute', '属性カード開封', `${side === 'you' ? 'YOU' : 'NPC'}：${ATTRS[attr].icon} ${ATTRS[attr].name}属性`);
    player.attr = attr;
    updateHud(true);
  }
  while (player.rare.length) {
    const effect = player.rare.shift();
    let text = '';
    if (effect === 'life') {
      player.life++;
      text = `${side === 'you' ? 'YOU' : 'NPC'}：ライフ +1`;
      updateHud(true);
    } else if (effect === 'swap') {
      const other = side === 'you' ? 'npc' : 'you';
      if (player.army.length && state[other].army.length) {
        const a = Math.floor(Math.random() * player.army.length);
        const b = Math.floor(Math.random() * state[other].army.length);
        [player.army[a], state[other].army[b]] = [state[other].army[b], player.army[a]];
        text = '両軍のユニットが1体入れ替わった';
      } else text = '入れ替えるユニットがいなかった';
    } else text = '……何も起こらなかった';
    await revealCard('rare', 'レアカード開封', text);
  }
}

async function revealCard(kind, title, result) {
  $('revealCard').className = `reveal-card ${kind === 'attribute' ? 'attribute' : ''}`;
  $('revealSeal').textContent = '?';
  $('revealTitle').textContent = title;
  $('revealResult').textContent = '';
  $('revealOverlay').classList.remove('hidden');
  await wait(320);
  $('revealSeal').textContent = kind === 'attribute' ? '✦' : '★';
  $('revealResult').textContent = result;
  await wait(700);
  $('revealOverlay').classList.add('hidden');
}

function makeFighters(side) {
  const player = state[side];
  const descriptors = expandArmy(side);
  const positions = formationFor(side, descriptors);
  return descriptors.map(descriptor => {
    const unit = UNITS[descriptor.type];
    const pos = positions.get(descriptor.key);
    const hp = unit.hp * (1 + player.buff.hp);
    return {
      ...descriptor,
      x: pos.x, y: pos.y, vx: 0, vy: 0,
      scale: pos.scale, formationScale: pos.scale,
      hp, maxHp: hp,
      atk: unit.atk * (1 + player.buff.atk),
      range: unit.range, speed: unit.speed,
      rate: Math.max(0.32, unit.rate * (1 - player.buff.rate)),
      cool: Math.random() * Math.max(0.5, unit.rate),
      alive: true, target: null, backline: unit.backline,
      heal: unit.heal, bomb: unit.bomb, bombMult: 1 + player.buff.bomb,
      detect: unit.detect || unit.range, hit: 0, moving: false,
      radius: Math.max(4.2, 10 * pos.scale), walk: Math.random() * Math.PI * 2,
      look: side === 'you' ? -1 : 1, exploded: false,
      fusing: false, fuseElapsed: 0, fuseDuration: ATTACK_PROFILE.bomber.duration,
      attackState: null, alpha: 1, seed: Math.random() * Math.PI * 2
    };
  });
}

function startBattle() {
  stopPreviewLoop();
  state.phase = 'battle';
  $('phase').textContent = 'BATTLE';
  updateAffinityGuide();
  state.battle = {
    units: [...makeFighters('npc'), ...makeFighters('you')],
    projectiles: [], effects: [], last: performance.now(), done: false,
    lastDamageSide: null
  };
  requestAnimationFrame(battleLoop);
}

function battleLoop(now) {
  if (!state.battle || state.battle.done) return;
  const dt = Math.min(0.034, (now - state.battle.last) / 1000);
  state.battle.last = now;
  updateBattle(dt);
  drawScene();
  if (!state.battle.done) requestAnimationFrame(battleLoop);
}

function attrMult(a, b) {
  if (ADV[a] === b) return 1.25;
  if (ADV[b] === a) return 0.8;
  return 1;
}
function nearest(unit, foes) {
  let list = foes;
  if (unit.backline) {
    const back = foes.filter(foe => ['archer', 'ranger', 'priest'].includes(foe.type));
    if (back.length) list = back;
  }
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of list) {
    const distance = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }
  return best;
}

function damage(attacker, target, amount) {
  if (!target?.alive) return;
  target.hp -= amount * attrMult(state[attacker.side].attr, state[target.side].attr);
  target.hit = 0.14;
  state.battle.lastDamageSide = attacker.side;
  if (target.hp <= 0) {
    target.alive = false;
    state.battle.effects.push({ kind: 'poof', x: target.x, y: target.y, t: 0 });
    if (target.bomb) explode(target);
  }
}

function explode(unit) {
  if (unit.exploded) return;
  unit.exploded = true;
  unit.alive = false;
  state.battle.effects.push({ kind: 'boom', x: unit.x, y: unit.y, t: 0 });
  for (const enemy of state.battle.units.filter(other => other.alive && other.side !== unit.side && Math.hypot(other.x - unit.x, other.y - unit.y) < 38)) {
    damage({ side: unit.side }, enemy, unit.atk * unit.bombMult);
  }
}

function beginAttack(unit, target, mode = 'damage') {
  const profile = ATTACK_PROFILE[unit.type];
  unit.attackState = {
    elapsed: 0,
    duration: profile.duration,
    hitAt: profile.hitAt,
    hitApplied: false,
    target,
    mode
  };
  unit.cool = unit.rate;
  unit.moving = false;
  unit.vx = 0;
  unit.vy = 0;
}

function resolveAttack(unit, attack) {
  const target = attack.target;
  if (!target?.alive) return;
  if (attack.mode === 'heal') {
    target.hp = Math.min(target.maxHp, target.hp + 24);
    state.battle.effects.push({ kind: 'heal', x: target.x, y: target.y, t: 0 });
    return;
  }

  const projectile = UNITS[unit.type].projectile;
  if (projectile) {
    state.battle.projectiles.push({
      kind: projectile, side: unit.side,
      x: unit.x + unit.look * 7, y: unit.y - 12,
      target, damage: unit.atk,
      speed: projectile === 'arrow' ? 230 : projectile === 'light' ? 205 : 185,
      trail: []
    });
  } else {
    damage(unit, target, unit.atk);
    state.battle.effects.push({ kind: unit.type === 'golem' ? 'slam' : 'impact', x: target.x, y: target.y, t: 0, side: unit.side });
  }
}

function updateAttack(unit, dt) {
  const attack = unit.attackState;
  if (!attack) return false;
  attack.elapsed += dt;
  const progress = clamp(attack.elapsed / attack.duration, 0, 1);
  if (!attack.hitApplied && progress >= attack.hitAt) {
    attack.hitApplied = true;
    resolveAttack(unit, attack);
  }
  if (progress >= 1) unit.attackState = null;
  return true;
}

function updateBattle(dt) {
  const units = state.battle.units;
  for (const unit of units) {
    if (!unit.alive) continue;
    unit.cool -= dt;
    unit.hit = Math.max(0, unit.hit - dt);
    unit.walk += dt * (unit.moving ? 9.2 : 6.8);

    const foes = units.filter(other => other.alive && other.side !== unit.side);
    if (!foes.length) {
      finishBattle(unit.side);
      return;
    }

    if (updateAttack(unit, dt)) continue;

    if (unit.bomb && unit.fusing) {
      unit.moving = false;
      unit.vx = unit.vy = 0;
      unit.fuseElapsed += dt;
      if (unit.fuseElapsed >= unit.fuseDuration) explode(unit);
      continue;
    }

    if (unit.heal && unit.cool <= 0) {
      const wounded = units
        .filter(other => other.alive && other.side === unit.side && other.hp < other.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (wounded.length) {
        beginAttack(unit, wounded[0], 'heal');
        continue;
      }
    }

    if (!unit.target || !unit.target.alive) unit.target = nearest(unit, foes);
    const target = unit.target;
    if (!target) continue;

    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.hypot(dx, dy) || 1;
    unit.look = Math.abs(dx) > 5 ? (dx > 0 ? 1 : -1) : unit.look;
    const engage = unit.range + unit.radius + target.radius;

    if (unit.bomb && distance <= unit.detect) {
      unit.fusing = true;
      unit.fuseElapsed = 0;
      unit.moving = false;
      unit.vx = unit.vy = 0;
      continue;
    }

    if (distance <= engage) {
      unit.moving = false;
      unit.vx = unit.vy = 0;
      if (unit.cool <= 0) beginAttack(unit, target, 'damage');
      continue;
    }

    unit.moving = true;
    let desiredSpeed = unit.speed;
    if (['archer', 'ranger', 'priest'].includes(unit.type) && distance < 66) desiredSpeed = -unit.speed * 0.55;
    let moveX = dx / distance;
    let moveY = dy / distance;
    const allies = units.filter(other => other.alive && other.side === unit.side && other !== unit);
    const blocker = allies.find(other => Math.abs(other.x - unit.x) < unit.radius + other.radius + 4 && Math.abs(other.y - unit.y) < 28);
    if (blocker && unit.speed > blocker.speed + 7) {
      moveX += (unit.x < FIELD_CENTER_X ? -1 : 1) * 0.85;
      moveY *= 0.55;
    }
    const targetVx = moveX * desiredSpeed;
    const targetVy = moveY * desiredSpeed;
    unit.vx += (targetVx - unit.vx) * Math.min(1, dt * 8);
    unit.vy += (targetVy - unit.vy) * Math.min(1, dt * 8);
    unit.x = clamp(unit.x + unit.vx * dt, 18, 402);
    unit.y = clamp(unit.y + unit.vy * dt, 24, 616);
  }

  separateUnits(units);
  updateProjectiles(dt);
  for (const effect of state.battle.effects) effect.t += dt;
  state.battle.effects = state.battle.effects.filter(effect => effect.t < 0.82);
}

function updateProjectiles(dt) {
  for (const projectile of state.battle.projectiles) {
    if (!projectile.target?.alive) {
      projectile.dead = true;
      continue;
    }
    const dx = projectile.target.x - projectile.x;
    const dy = projectile.target.y - projectile.y;
    const distance = Math.hypot(dx, dy) || 1;
    projectile.trail.push({ x: projectile.x, y: projectile.y });
    if (projectile.trail.length > 5) projectile.trail.shift();
    projectile.x += dx / distance * projectile.speed * dt;
    projectile.y += dy / distance * projectile.speed * dt;
    if (distance < 12) {
      damage({ side: projectile.side }, projectile.target, projectile.damage);
      state.battle.effects.push({ kind: 'impact', x: projectile.target.x, y: projectile.target.y, t: 0, side: projectile.side });
      projectile.dead = true;
    }
  }
  state.battle.projectiles = state.battle.projectiles.filter(projectile => !projectile.dead);
}

function separateUnits(units) {
  const alive = units.filter(unit => unit.alive);
  const cellSize = 26;
  const buckets = new Map();
  for (const unit of alive) {
    const cx = Math.floor(unit.x / cellSize);
    const cy = Math.floor(unit.y / cellSize);
    const key = `${unit.side}:${cx}:${cy}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(unit);
  }
  const checked = new Set();
  for (const a of alive) {
    const cx = Math.floor(a.x / cellSize);
    const cy = Math.floor(a.y / cellSize);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const nearby = buckets.get(`${a.side}:${cx + ox}:${cy + oy}`) || [];
        for (const b of nearby) {
          if (a === b) continue;
          const pair = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`;
          if (checked.has(pair)) continue;
          checked.add(pair);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.001;
          const minimum = (a.radius + b.radius) * 0.92;
          if (distance < minimum) {
            const overlap = minimum - distance;
            const nx = dx / distance;
            const ny = dy / distance;
            a.x -= nx * overlap * 0.45;
            a.y -= ny * overlap * 0.45;
            b.x += nx * overlap * 0.45;
            b.y += ny * overlap * 0.45;
          }
        }
      }
    }
  }
}

function finishBattle(winner) {
  if (state.battle.done) return;
  state.battle.done = true;
  const loser = winner === 'you' ? 'npc' : 'you';
  state.loser = loser;
  setTimeout(() => showRoundResult(winner, loser), 420);
}

async function showRoundResult(winner, loser) {
  state.phase = 'result';
  $('phase').textContent = 'RESULT';
  updateAffinityGuide();
  $('resultNpcLife').innerHTML = heartSpans(state.npc.life);
  $('resultYouLife').innerHTML = heartSpans(state.you.life);
  $('resultText').innerHTML = `<small>ROUND ${state.round}</small><strong>${winner === 'you' ? 'YOU WIN' : 'NPC WIN'}</strong>`;
  $('resultPanel').classList.remove('hidden');
  await wait(TIMING.resultHoldBeforeLoss);
  state[loser].life--;
  const target = loser === 'you' ? $('resultYouLife') : $('resultNpcLife');
  const lost = [...target.querySelectorAll('span')].reverse().find(element => element.textContent === '♥');
  if (lost) lost.classList.add('heart-loss');
  updateHud(false);
  await wait(TIMING.resultHoldAfterLoss);
  if (state[loser].life <= 0) {
    $('resultPanel').classList.add('hidden');
    gameOver(winner);
    return;
  }
  $('resultPanel').classList.add('hidden');
  state.round++;
  state.battle = null;
  nextDraft();
}
function heartSpans(n) { return Array.from({ length: 5 }, (_, i) => `<span>${i < n ? '♥' : '♡'}</span>`).join(''); }

function startPreviewLoop() {
  if (previewRaf) return;
  const frame = () => {
    previewRaf = 0;
    if (!state || state.phase === 'battle' || state.phase === 'result') return;
    drawScene();
    previewRaf = requestAnimationFrame(frame);
  };
  previewRaf = requestAnimationFrame(frame);
}
function stopPreviewLoop() {
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = 0;
}

function drawScene() {
  drawField();
  if (state.phase === 'battle' && state.battle) drawBattleUnits();
  else drawPreviewUnits();
  drawTokens();
  drawFx();
}

function drawField() {
  ctx.clearRect(0, 0, 420, 640);
  const gradient = ctx.createLinearGradient(0, 0, 0, 640);
  gradient.addColorStop(0, '#9bdc72');
  gradient.addColorStop(0.42, '#8ed06a');
  gradient.addColorStop(1, '#6daf52');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 420, 640);
  ctx.fillStyle = '#b9e88b';
  ctx.fillRect(0, 272, 420, 96);
  ctx.fillStyle = '#ffffff20';
  ctx.fillRect(0, 318, 420, 3);
  ctx.strokeStyle = '#ffffff16';
  for (let y = 54; y < 620; y += 52) {
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(402, y);
    ctx.stroke();
  }
  if (state.phase !== 'battle') drawFormationGuides();
  drawScenery();
}

function drawFormationGuides() {
  ctx.save();
  ctx.setLineDash([5, 8]);
  ctx.lineWidth = 1;
  for (const side of ['npc', 'you']) {
    ctx.strokeStyle = side === 'you' ? '#287dff20' : '#f13d5420';
    for (const lane of LANE_ORDER) {
      const y = LANE_CENTER[side][lane];
      ctx.beginPath();
      ctx.moveTo(35, y + 17);
      ctx.lineTo(385, y + 17);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawScenery() {
  const scenery = [[24, 93, 'tree'], [394, 135, 'tree'], [28, 520, 'rock'], [388, 557, 'tree'], [69, 301, 'flower'], [350, 331, 'flower'], [187, 35, 'rock'], [241, 604, 'flower']];
  for (const [x, y, kind] of scenery) {
    if (kind === 'tree') {
      ctx.fillStyle = '#64452e';
      ctx.fillRect(x - 3, y, 6, 14);
      ctx.fillStyle = '#3e9548';
      ctx.beginPath();
      ctx.arc(x, y - 3, 13, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'rock') {
      ctx.fillStyle = '#758276';
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff4a0';
      for (let a = 0; a < 5; a++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(a * 1.256) * 4, y + Math.sin(a * 1.256) * 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPreviewUnits() {
  const now = performance.now();
  const units = [...state.previewUnits].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const unit of units) {
    updatePreviewPose(unit, now);
    const phase = now / 140 + unit.seed;
    drawSprite(unit.x, unit.y - unit.bounce, unit, phase, false, true);
  }
}

function drawTokens() {
  for (const side of ['npc', 'you']) {
    const y = side === 'you' ? 594 : 46;
    if (state[side].pendingAttr.length) drawHiddenToken(48, y, '属性', state[side].pendingAttr.length, '#e7c452');
    if (state[side].rare.length) drawHiddenToken(372, y, 'レア', state[side].rare.length, '#bd69ef');
  }
}
function drawHiddenToken(x, y, label, count, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff0d8e8';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-29, -17, 58, 34, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6d4728';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${label}(?)`, 0, -1);
  ctx.fillText(`×${count}`, 0, 12);
  ctx.restore();
}

function drawBattleUnits() {
  drawProjectiles();
  const units = state.battle.units.filter(unit => unit.alive).sort((a, b) => a.y - b.y);
  for (const unit of units) {
    drawAttackAccent(unit);
    drawSprite(unit.x, unit.y, unit, unit.walk, unit.moving, !unit.moving && !unit.attackState && !unit.fusing);
  }
}

function drawProjectiles() {
  for (const projectile of state.battle.projectiles) {
    const color = projectile.side === 'you' ? '#4fb9ff' : '#ff5368';
    ctx.save();
    if (projectile.kind === 'arrow') {
      const target = projectile.target;
      const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(angle);
      ctx.strokeStyle = '#5a351e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(3, -3);
      ctx.lineTo(3, 3);
      ctx.closePath();
      ctx.fill();
    } else {
      for (let i = 0; i < projectile.trail.length; i++) {
        const point = projectile.trail[i];
        ctx.globalAlpha = (i + 1) / projectile.trail.length * 0.22;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2 + i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fillStyle = projectile.kind === 'light' ? '#fff9b0' : color;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.kind === 'light' ? 4.5 : 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function attackProgress(unit) {
  if (!unit.attackState) return 0;
  return clamp(unit.attackState.elapsed / unit.attackState.duration, 0, 1);
}

function drawAttackAccent(unit) {
  const p = attackProgress(unit);
  const face = unit.look || (unit.side === 'you' ? -1 : 1);
  if (unit.fusing) {
    const q = clamp(unit.fuseElapsed / unit.fuseDuration, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.18 + q * 0.42;
    ctx.strokeStyle = unit.side === 'you' ? '#4fb9ff' : '#ff5368';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y - 7, 13 + q * 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (!p) return;
  const hitPulse = Math.max(0, Math.sin(clamp((p - 0.34) / 0.55, 0, 1) * Math.PI));
  ctx.save();
  ctx.lineCap = 'round';
  if (unit.type === 'knight') {
    ctx.globalAlpha = hitPulse * 0.8;
    ctx.strokeStyle = '#fff5b0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(unit.x + face * 11, unit.y - 11, 15, face > 0 ? -1.5 : 1.5, face > 0 ? 1.2 : 4.8, face < 0);
    ctx.stroke();
  } else if (unit.type === 'shield') {
    ctx.globalAlpha = hitPulse * 0.7;
    ctx.fillStyle = unit.side === 'you' ? '#56c8ff' : '#ff6677';
    ctx.beginPath();
    ctx.ellipse(unit.x + face * 15, unit.y - 7, 8 + hitPulse * 5, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (unit.type === 'golem') {
    ctx.globalAlpha = hitPulse * 0.6;
    ctx.strokeStyle = '#e9d7a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(unit.x + face * 7, unit.y + 11, 11 + hitPulse * 16, 4 + hitPulse * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (unit.type === 'wolf') {
    ctx.globalAlpha = hitPulse * 0.6;
    ctx.strokeStyle = '#eef7ff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(unit.x - face * (8 + i * 5), unit.y - 8 + i * 4);
      ctx.lineTo(unit.x - face * (22 + i * 5), unit.y - 8 + i * 4);
      ctx.stroke();
    }
  } else if (unit.type === 'assassin') {
    ctx.globalAlpha = hitPulse * 0.85;
    ctx.strokeStyle = unit.side === 'you' ? '#77ddff' : '#ff8190';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(unit.x - 10, unit.y - 22);
    ctx.lineTo(unit.x + 14, unit.y + 2);
    ctx.moveTo(unit.x + 12, unit.y - 22);
    ctx.lineTo(unit.x - 12, unit.y + 2);
    ctx.stroke();
  } else if (unit.type === 'archer') {
    ctx.globalAlpha = hitPulse * 0.7;
    ctx.strokeStyle = '#fff5c2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(unit.x - face * 7, unit.y - 19);
    ctx.lineTo(unit.x + face * 18, unit.y - 12);
    ctx.stroke();
  } else if (unit.type === 'ranger') {
    ctx.globalAlpha = hitPulse * 0.8;
    ctx.fillStyle = unit.side === 'you' ? '#4fc1ff' : '#ff5368';
    ctx.shadowBlur = 12;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(unit.x + face * 15, unit.y - 13, 3 + hitPulse * 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (unit.type === 'priest') {
    ctx.globalAlpha = 0.25 + hitPulse * 0.55;
    ctx.strokeStyle = unit.attackState?.mode === 'heal' ? '#7cffad' : '#fff1a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(unit.x, unit.y - 22, 7 + hitPulse * 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(unit.x - 7, unit.y - 22);
    ctx.lineTo(unit.x + 7, unit.y - 22);
    ctx.moveTo(unit.x, unit.y - 29);
    ctx.lineTo(unit.x, unit.y - 15);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSprite(x, y, unit, phase = 0, moving = false, idle = false) {
  const img = getImage(unit.type, unit.side === 'you' ? 'blue' : 'red');
  const sourceFacesLeft = true;
  const face = unit.look || (unit.side === 'you' ? -1 : 1);
  const flip = sourceFacesLeft ? (face > 0 ? -1 : 1) : 1;
  const p = attackProgress(unit);
  let ox = 0;
  let oy = 0;
  let rotation = 0;
  let sx = 1;
  let sy = 1;
  let extraAlpha = 1;

  if (moving) {
    oy -= Math.abs(Math.sin(phase)) * 2.8;
    rotation += Math.sin(phase) * 0.035;
  } else if (idle) {
    oy -= Math.abs(Math.sin(phase)) * 1.4;
    rotation += Math.sin(phase) * 0.045;
  }

  if (unit.fusing) {
    const q = clamp(unit.fuseElapsed / unit.fuseDuration, 0, 1);
    sx += Math.sin(q * Math.PI * 8) * (0.04 + q * 0.06);
    sy -= Math.sin(q * Math.PI * 8) * (0.03 + q * 0.04);
    oy += q * 2;
  } else if (p > 0) {
    const swing = Math.sin(p * Math.PI);
    const snap = Math.sin(clamp((p - 0.32) / 0.68, 0, 1) * Math.PI);
    switch (unit.type) {
      case 'knight':
        ox += face * (-6 * Math.sin(Math.min(1, p / 0.34) * Math.PI / 2) + 18 * snap);
        rotation += face * (-0.26 * (p < 0.34 ? p / 0.34 : 0) + 0.48 * snap);
        break;
      case 'shield':
        ox += face * (-5 * Math.sin(Math.min(1, p / 0.32) * Math.PI / 2) + 17 * snap);
        sx += snap * 0.13;
        sy -= snap * 0.06;
        break;
      case 'golem':
        oy -= p < 0.52 ? 10 * Math.sin((p / 0.52) * Math.PI / 2) : 10 * (1 - (p - 0.52) / 0.48);
        sy -= p < 0.52 ? 0.08 * (p / 0.52) : -0.16 * snap;
        sx += snap * 0.13;
        rotation += face * (p < 0.52 ? -0.12 * p / 0.52 : 0.14 * snap);
        break;
      case 'wolf':
        sx += (p < 0.32 ? -0.14 * p / 0.32 : 0.12 * snap);
        sy += (p < 0.32 ? 0.12 * p / 0.32 : -0.10 * snap);
        ox += face * 21 * snap;
        oy -= 8 * snap;
        break;
      case 'assassin':
        ox += face * 25 * snap;
        rotation += face * 0.22 * snap;
        extraAlpha = p > 0.18 && p < 0.48 ? 0.42 : 1;
        break;
      case 'archer':
        ox -= face * 6 * Math.sin(Math.min(1, p / 0.58) * Math.PI);
        rotation -= face * 0.08 * swing;
        sx -= 0.05 * swing;
        break;
      case 'ranger':
        oy -= 4 * swing;
        rotation -= face * 0.16 * swing;
        ox -= face * 4 * swing;
        break;
      case 'priest':
        oy -= 9 * swing;
        sx += 0.08 * swing;
        sy += 0.08 * swing;
        rotation += Math.sin(p * Math.PI * 2) * 0.04;
        break;
    }
  }

  const scale = unit.scale || 1;
  ctx.save();
  ctx.translate(x + ox, y + oy);
  ctx.rotate(rotation);
  ctx.scale(flip * sx * scale, sy * scale);
  ctx.globalAlpha = (unit.alpha ?? 1) * extraAlpha;
  if (unit.hit > 0) ctx.globalAlpha *= 0.68;
  if (unit.type === 'bomber' && unit.fusing && Math.sin(performance.now() / Math.max(25, 70 - unit.fuseElapsed * 85)) > 0) {
    ctx.filter = 'brightness(2.8) saturate(.25)';
  }
  ctx.fillStyle = '#0003';
  ctx.beginPath();
  ctx.ellipse(0, 15, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img.complete && img.naturalWidth) {
    const maxW = 48;
    const maxH = 52;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * ratio;
    const h = img.naturalHeight * ratio;
    ctx.drawImage(img, -w / 2, -h + 17, w, h);
  }
  ctx.restore();
  ctx.filter = 'none';
}

function drawFx() {
  if (!state.battle) return;
  for (const effect of state.battle.effects) {
    const q = effect.t / 0.82;
    if (effect.kind === 'boom') {
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = '#ffd04e';
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 10 + q * 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7356';
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 6 + q * 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (effect.kind === 'poof') {
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = '#f4f0df';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(effect.x + Math.cos(i) * q * 22, effect.y + Math.sin(i) * q * 15, 6 * (1 - q), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (effect.kind === 'heal') {
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.fillStyle = '#72ff9e';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✚', effect.x, effect.y - q * 35);
      ctx.restore();
    } else if (effect.kind === 'impact') {
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = effect.side === 'you' ? '#85dfff' : '#ff9aa5';
      ctx.lineWidth = 3 * (1 - q);
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(effect.x + Math.cos(angle) * 4, effect.y + Math.sin(angle) * 4);
        ctx.lineTo(effect.x + Math.cos(angle) * (8 + q * 15), effect.y + Math.sin(angle) * (8 + q * 15));
        ctx.stroke();
      }
      ctx.restore();
    } else if (effect.kind === 'slam') {
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = '#d8c697';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y + 12, 8 + q * 28, 3 + q * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function showBanner(text, ms = 500) {
  $('centerBanner').textContent = text;
  $('centerBanner').classList.remove('hidden');
  setTimeout(() => $('centerBanner').classList.add('hidden'), ms);
}
function gameOver(winner) {
  updateAffinityGuide();
  $('gameOverView').classList.remove('hidden');
  $('gameOverText').textContent = winner === 'you' ? 'YOU WIN!' : 'YOU LOSE';
  $('gameOverDifficulty').textContent = `NPC難易度：${DIFFICULTIES[state.difficulty].label}`;
}

document.querySelectorAll('[data-difficulty]').forEach(button => {
  button.addEventListener('click', () => startGame(button.dataset.difficulty));
});
$('restartBtn').onclick = showHome;
$('againBtn').onclick = init;
$('homeBtn').onclick = showHome;
$('settingsBtn').onclick = () => $('settingsPanel').classList.toggle('hidden');
$('closeSettingsBtn').onclick = () => $('settingsPanel').classList.add('hidden');
$('affinityToggle').addEventListener('change', event => {
  settings.showAffinityGuide = event.target.checked;
  saveSettings();
  updateAffinityGuide();
});
syncSettingsUi();

// Lightweight hooks used by the bundled smoke test; they do not affect normal play.
window.__arenaDebug = {
  getState: () => state,
  formationFor,
  expandArmy,
  startBattle,
  rebuildPreview,
  stepBattle: updateBattle,
  drawScene,
  unitIds: Object.keys(UNITS),
  offers,
  scoreNpc,
  chooseNpc,
  applyCard,
  revealNpcStep,
  completeNpcDraft,
  individualCount,
  startGame,
  showHome,
  difficulties: DIFFICULTIES,
  units: UNITS,
  settings: () => ({ ...settings }),
  updateAffinityGuide
};

showHome();
