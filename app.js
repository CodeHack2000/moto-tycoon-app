/* =========================================================
   MOTO TYCOON · Terminal Bancário, Garagem Digital & Leilão
   Vanilla JS · offline-first · estado guardado em localStorage
   ========================================================= */
'use strict';

/* ---------- Configuração ---------- */
const STORAGE_KEY = 'motoTycoon.banker.v1';
const QR_PREFIX = 'MOTO_PLAYER_';
const MAX_PLAYERS = 4;
const DEFAULT_BALANCE = 7500;
const QR_LIB_CDN = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
const CATALOG = typeof MOTAS !== 'undefined' ? MOTAS : [];

const PAWN_COLORS = ['#2ec4b6', '#ff007f', '#ffd23f', '#9b5de5', '#ff8c42', '#3a86ff', '#7ae582', '#f1f1f1'];

const AMOUNT_CHIPS = [100, 500, 1000, 5000];

const TRANSFER_REASONS = ['Aposta de corrida', 'Taxa de vaga (10%)', 'Compra no Leilão', 'Leilão de falência'];

/* ---------- Regras do jogo (Manual v2) ---------- */
const PARTIDA_BASE = 1000;
const PARTIDA_TEN_PCT = 10;
const CLASSIC_APPS_BONUS = 20;
const CLASSIC_PARTIDA_BONUS = { Normal: 100, Rara: 250, 'Épica': 500, 'Lendária': 1000 };
const ACHADO_DISCOUNT = 30;
const BANKRUPT_BANK_PCT = 50;
const VAGA_FEE_PCT = 10;
const RACE_BONUS_MID = 1000;

const AVARIAS = {
  E: { nome: 'Estética', valor: 10, rendimento: 0, nivel: 1, tone: 'orange' },
  M: { nome: 'Moderada', valor: 25, rendimento: 50, nivel: 2, tone: 'yellow' },
  C: { nome: 'Crítica', valor: 50, rendimento: 100, nivel: 3, tone: 'red' },
};

const REPAIR_COST = {
  Normal: { E: 150, M: 400, C: 1000 },
  Rara: { E: 400, M: 1000, C: 2500 },
  'Épica': { E: 1000, M: 2500, C: 6000 },
  'Lendária': { E: 3000, M: 8000, C: 20000 },
};

const RACE_RULES = {
  Normal: { dados: 5, relancamentos: 0, maxBanco: 1000 },
  Rara: { dados: 5, relancamentos: 1, maxBanco: 3000 },
  'Épica': { dados: 6, relancamentos: 1, maxBanco: 8000 },
  'Lendária': { dados: 6, relancamentos: 2, maxBanco: 20000 },
};

const HAND_TIERS = [
  { value: 'low', title: 'Carta Alta, Par ou Dois Pares', sub: 'Ganha a aposta', tone: 'fair' },
  { value: 'mid', title: 'Trio ou Full House', sub: 'Aposta + 1.000 € do Banco', tone: 'hot' },
  { value: 'high', title: 'Sequência, Quadra ou Poker', sub: 'O dobro da aposta', tone: 'weak' },
];

const APP_SLOTS = [
  { casa: 3, nome: 'UBER EATS' },
  { casa: 7, nome: 'GLOVO' },
  { casa: 10, nome: 'TVDE' },
  { casa: 17, nome: 'UBER EATS' },
  { casa: 19, nome: 'GLOVO' },
  { casa: 23, nome: 'TVDE' },
];

const DAMAGE_LEVELS = [
  { value: 0, title: 'Nenhuma', sub: '0%', tone: 'none' },
  { value: 10, title: 'Estética', sub: 'Laranja · −10%', tone: 'orange' },
  { value: 25, title: 'Moderada', sub: 'Amarela · −25%', tone: 'yellow' },
  { value: 50, title: 'Crítica', sub: 'Vermelha · −50%', tone: 'red' },
];

const MARKET_LEVELS = [
  { value: 80, title: '80% · Mercado Fraco', sub: 'Carta Alta (sem combinação)', tone: 'weak' },
  { value: 100, title: '100% · Oferta Justa', sub: 'Par ou Dois Pares', tone: 'fair' },
  { value: 120, title: '120% · Guerra de Licitações', sub: 'Trio, Full House, Sequência, Quadra ou Poker', tone: 'hot' },
];

const VICTORY_MODES = [
  { value: 'imperio-100', title: 'Império · Rápido', sub: 'Primeiro a 100.000 € de Património Líquido', chip: 'Império · 100.000 €', target: 100000, tone: 'hot' },
  { value: 'imperio-200', title: 'Império · Padrão', sub: 'Primeiro a 200.000 € de Património Líquido', chip: 'Império · 200.000 €', target: 200000, tone: 'hot' },
  { value: 'imperio-400', title: 'Império · Magnata', sub: 'Primeiro a 400.000 € de Património Líquido', chip: 'Império · 400.000 €', target: 400000, tone: 'hot' },
  { value: 'restauro', title: 'Mestre do Restauro', sub: 'Comprar, restaurar e vender no Leilão uma Clássica Lendária', chip: 'Mestre do Restauro', tone: 'yellow' },
  { value: 'cronometro', title: 'Cronómetro · 45 min', sub: 'Maior Património Líquido quando o tempo acabar', chip: 'Cronómetro · 45 min', tone: 'weak' },
];
const DEFAULT_VICTORY = 'imperio-100';
const TIMER_MINUTES = 45;

const RARITY_CLASS = { Normal: 'rar-normal', Rara: 'rar-rara', 'Épica': 'rar-epica', 'Lendária': 'rar-lendaria' };

/* ---------- Utilitários ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const formatNumber = (n) => Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const formatMoney = (n) => (n < 0 ? '−' : '') + formatNumber(n) + ' €';
const formatSigned = (n) => (n < 0 ? '−' : '+') + formatNumber(n) + ' €';
const parseAmount = (str) => {
  const digits = String(str).replace(/\D/g, '');
  return digits ? Math.min(parseInt(digits, 10), 999999999) : 0;
};
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatTime = (ts) => new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
const normalizeText = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cardNum = (id) => `#${String(id).padStart(2, '0')}`;
const motoLabel = (card) => `${cardNum(card.id)} ${card.nome}`;
const newUid = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Reformata um campo de dinheiro enquanto se escreve (7500 → 7.500). */
function bindMoneyInput(input, onChange) {
  input.addEventListener('input', () => {
    const n = parseAmount(input.value);
    input.value = n ? formatNumber(n) : '';
    if (onChange) onChange(n);
  });
}

function restartAnimation(el, className) {
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

/* ---------- Estado ---------- */
function defaultSetup() {
  return {
    count: MAX_PLAYERS,
    startBalance: DEFAULT_BALANCE,
    victory: DEFAULT_VICTORY,
    order: Array.from({ length: MAX_PLAYERS }, (_, i) => i),
    players: Array.from({ length: MAX_PLAYERS }, (_, i) => ({ name: `Jogador ${i + 1}`, color: PAWN_COLORS[i] })),
  };
}

function freshState(lastSetup = defaultSetup()) {
  return { started: false, startBalance: DEFAULT_BALANCE, players: [], log: [], lastSetup };
}

/** Completa estados guardados por versões anteriores da app. */
function normalizeState(s) {
  s.lastSetup = { ...defaultSetup(), ...(s.lastSetup || {}) };
  s.players.forEach((p) => {
    p.motos = p.motos || [];
    p.prisonTurns = p.prisonTurns || 0;
    p.licenseTurns = p.licenseTurns || 0;
  });
  if (s.started) {
    s.victory = s.victory || DEFAULT_VICTORY;
    s.turn = s.turn || { order: s.players.map((p) => p.id), index: 0, round: 1 };
  }
  return s;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.players) && Array.isArray(saved.log)) return normalizeState(saved);
  } catch { /* storage indisponível ou corrompido */ }
  return freshState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* modo privado / storage cheio: o jogo continua em memória */ }
}

let state = loadState();
const getPlayer = (id) => state.players.find((p) => p.id === id);
const activePlayers = () => state.players.filter((p) => !p.eliminated);
const getVictory = (value) => VICTORY_MODES.find((v) => v.value === value) || VICTORY_MODES[0];

/* =========================================================
   REGRAS: MOTAS, AVARIAS, VALORES
   ========================================================= */
const cardOf = (moto) => CATALOG.find((c) => c.id === moto.cardId);
const getMoto = (playerId, uid) => {
  const p = getPlayer(playerId);
  return p ? p.motos.find((m) => m.uid === uid) : null;
};
const isStopped = (m) => m.avarias.includes('C');
const canRace = (m) => !isStopped(m) && !m.apreendida;
const appSlot = (casa) => APP_SLOTS.find((s) => s.casa === casa);
const slotLabel = (casa) => `${appSlot(casa).nome} (${String(casa).padStart(2, '0')})`;

/** Desconto no valor (somam-se, no máximo 100%). */
const damagePct = (m) => Math.min(100, m.avarias.reduce((s, a) => s + AVARIAS[a].valor, 0));
/** Percentagem do rendimento nas Apps que a mota ainda gera. */
const incomePct = (m) => Math.max(0, 100 - m.avarias.reduce((s, a) => s + AVARIAS[a].rendimento, 0));

/** Rendimento nas Apps por volta (com avarias e bónus de Clássica). */
function appIncome(m) {
  const card = cardOf(m);
  const classic = card.classica ? 1 + CLASSIC_APPS_BONUS / 100 : 1;
  return Math.round((card.apps * incomePct(m) / 100) * classic);
}

/** 10% do rendimento indicado na carta, já com o desconto das avarias. */
const partidaTenPct = (m) => Math.round(cardOf(m).apps * incomePct(m) / 100 * PARTIDA_TEN_PCT / 100);
/** Valor da mota no património: Preço de Aquisição − avarias. */
const motoValue = (m) => Math.round(cardOf(m).aquisicao * (100 - damagePct(m)) / 100);
const bankPrice = (m) => Math.round(motoValue(m) * BANKRUPT_BANK_PCT / 100);
const patrimony = (p) => p.balance + p.motos.reduce((s, m) => s + motoValue(m), 0);
const repairCost = (m, tipo) => REPAIR_COST[cardOf(m).raridade][tipo];
const rescueCost = (m) => Math.round(cardOf(m).aquisicao * m.apreendida.pct / 100);

function ownerOfCard(cardId) {
  return activePlayers().find((p) => p.motos.some((m) => m.cardId === cardId)) || null;
}

function slotOccupant(casa) {
  for (const p of activePlayers()) {
    const moto = p.motos.find((m) => m.app && m.app.casa === casa);
    if (moto) return { player: p, moto };
  }
  return null;
}

/** Multa da Operação Stop de uma mota: 50% da reparação de cada avaria; a Clássica ignora a mais cara. */
function stopFineDetail(m) {
  const card = cardOf(m);
  const lines = m.avarias.map((a) => ({ tipo: a, fine: REPAIR_COST[card.raridade][a] / 2, ignored: false }));
  if (card.classica && lines.length) {
    const top = lines.reduce((best, l) => (l.fine > best.fine ? l : best), lines[0]);
    top.ignored = true;
  }
  return { lines, total: lines.filter((l) => !l.ignored).reduce((s, l) => s + l.fine, 0) };
}

/**
 * Aplica uma nova avaria seguindo o limite de 2:
 * se a mota já tiver 2, a nova substitui a mais leve quando é mais grave; senão volta ao baralho.
 */
function applyAvaria(m, tipo) {
  if (m.avarias.length < 2) {
    m.avarias.push(tipo);
    return { result: 'added' };
  }
  const lightest = m.avarias.reduce((low, a) => (AVARIAS[a].nivel < AVARIAS[low].nivel ? a : low), m.avarias[0]);
  if (AVARIAS[tipo].nivel > AVARIAS[lightest].nivel) {
    m.avarias.splice(m.avarias.indexOf(lightest), 1, tipo);
    return { result: 'replaced', removed: lightest };
  }
  return { result: 'discarded' };
}

/** Adiciona uma avaria, avisa o banqueiro e tira a mota da App se ficar parada. */
function addAvariaTo(player, m, tipo, motivo) {
  const card = cardOf(m);
  const { result, removed } = applyAvaria(m, tipo);
  const name = AVARIAS[tipo].nome;
  if (result === 'discarded') {
    addSystemLog(`${player.name} · ${motoLabel(card)}: avaria ${name} descartada (já tem 2 avarias iguais ou mais graves).`);
    toast(`Avaria ${name} volta ao fundo do baralho (limite de 2).`);
  } else {
    const extra = result === 'replaced' ? ` (substituiu a ${AVARIAS[removed].nome}, que volta ao baralho)` : '';
    addSystemLog(`${player.name} · ${motoLabel(card)}: +avaria ${name}${extra}${motivo ? ` · ${motivo}` : ''}.`);
    toast(`💥 ${motoLabel(card)}: avaria ${name}${extra}`);
  }
  if (isStopped(m) && m.app) {
    const casa = m.app.casa;
    m.app = null;
    addSystemLog(`${motoLabel(card)} ficou parada e saiu da ${slotLabel(casa)}.`);
    notify(`🔴 ${motoLabel(card)} está parada: sai da ${slotLabel(casa)}. Tira a carta do tabuleiro.`);
  }
  refresh();
}

/* ---------- Som & vibração ---------- */
let audioCtx = null;

function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { audioCtx = null; }
}

function tone(freq, start, duration, type = 'square', volume = 0.2) {
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function sfx(kind) {
  unlockAudio();
  if (audioCtx) {
    try {
      if (kind === 'scan') tone(1760, 0, 0.14, 'square', 0.18);
      if (kind === 'error') { tone(220, 0, 0.16, 'sawtooth', 0.15); tone(180, 0.18, 0.2, 'sawtooth', 0.15); }
      if (kind === 'credit') { tone(880, 0, 0.09, 'sine', 0.25); tone(1320, 0.09, 0.16, 'sine', 0.25); }
      if (kind === 'debit') { tone(660, 0, 0.09, 'sine', 0.25); tone(440, 0.09, 0.18, 'sine', 0.25); }
      if (kind === 'turn') { tone(523, 0, 0.08, 'triangle', 0.22); tone(784, 0.08, 0.14, 'triangle', 0.22); }
      if (kind === 'notify') { tone(1046, 0, 0.1, 'triangle', 0.25); tone(1318, 0.12, 0.1, 'triangle', 0.25); tone(1568, 0.24, 0.18, 'triangle', 0.25); }
      if (kind === 'alarm') { [0, 0.3, 0.6].forEach((s) => { tone(988, s, 0.12, 'square', 0.2); tone(740, s + 0.13, 0.12, 'square', 0.2); }); }
      if (kind === 'siren') { [0, 0.35].forEach((s) => { tone(660, s, 0.17, 'sawtooth', 0.14); tone(880, s + 0.17, 0.17, 'sawtooth', 0.14); }); }
    } catch { /* sem áudio */ }
  }
  if (navigator.vibrate) navigator.vibrate(['error', 'alarm', 'notify', 'siren'].includes(kind) ? [70, 50, 70] : 40);
}

/* ---------- Toast ---------- */
const toastEl = $('#toast');
let toastTimer = null;

function toast(message, isError = false, duration = 2600) {
  // Os <dialog> modais ficam na "top layer": o toast tem de viver dentro do dialog aberto para ser visível.
  const openDialogs = $$('dialog[open]');
  (openDialogs[openDialogs.length - 1] || document.body).appendChild(toastEl);
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

/** Aviso importante: som + toast longo. */
function notify(message) {
  sfx('notify');
  toast(message, false, 6000);
}

/* ---------- Diálogos de confirmação e escolha ---------- */
const confirmModal = $('#confirmModal');

function confirmDialog(title, message, okText = 'Confirmar') {
  $('#confirmTitle').textContent = title;
  $('#confirmMsg').textContent = message;
  $('#confirmOk').textContent = okText;
  confirmModal.returnValue = '';
  if (!confirmModal.open) confirmModal.showModal();
  return new Promise((resolve) => {
    confirmModal.addEventListener('close', () => resolve(confirmModal.returnValue === 'ok'), { once: true });
  });
}

const choiceModal = $('#choiceModal');

/** Mostra uma lista de opções e devolve o value escolhido (ou null). options = [{ value, title, sub }] */
function choiceDialog(title, message, options) {
  $('#choiceTitle').textContent = title;
  $('#choiceMsg').textContent = message || '';
  $('#choiceMsg').hidden = !message;
  $('#choiceList').innerHTML = options.map((o, i) => `
    <button type="button" class="choice-btn ${o.tone ? `tone-${o.tone}` : ''}" data-choice="${i}" ${o.disabled ? 'disabled' : ''}>
      <span class="choice-title">${o.title}</span>${o.sub ? `<span class="choice-sub">${o.sub}</span>` : ''}
    </button>`).join('');
  choiceModal.returnValue = '';
  choiceModal.showModal();
  return new Promise((resolve) => {
    choiceModal.addEventListener('close', () => {
      const chosen = options[Number(choiceModal.returnValue)];
      resolve(choiceModal.returnValue !== '' && chosen ? chosen.value : null);
    }, { once: true });
  });
}

function choiceHtml(name, options, checkedValue) {
  return options.map((o) => `
    <label class="choice tone-${o.tone}">
      <input type="radio" name="${name}" value="${o.value}" ${o.value === checkedValue ? 'checked' : ''}>
      <span class="choice-body">
        <span class="choice-title">${o.title}</span>
        <span class="choice-sub">${o.sub}</span>
      </span>
    </label>`).join('');
}

/* ---------- Pequenos blocos de HTML reutilizados ---------- */
function rarityBadges(card) {
  return `<span class="rar ${RARITY_CLASS[card.raridade] || ''}">${card.raridade}</span>` +
    (card.classica ? '<span class="rar rar-classica">Clássica</span>' : '');
}

function avariaPills(m) {
  if (!m.avarias.length) return '<span class="av av-none">Sem avarias</span>';
  return m.avarias.map((a) => `<span class="av av-${AVARIAS[a].tone}">${AVARIAS[a].nome}</span>`).join('');
}

function motoStateText(m) {
  if (m.apreendida) return `🅿️ Apreendida · resgate ${formatMoney(rescueCost(m))}`;
  if (m.app) return `📱 ${slotLabel(m.app.casa)} · ${plural(m.app.laps, 'volta', 'voltas')}`;
  if (isStopped(m)) return '🔴 Parada';
  return '🏠 Na garagem';
}

function playerChipsHtml(players, selectedId, disabledIds = []) {
  return players.map((p) => `
    <button type="button" class="chip chip-player ${p.id === selectedId ? 'is-active' : ''}" style="--pc:${p.color}"
      data-pick="${p.id}" ${disabledIds.includes(p.id) ? 'disabled' : ''}>
      <span class="pawn"></span>${escapeHtml(p.name)}
    </button>`).join('');
}

/** Botão compacto para escolher uma mota da garagem. */
function motoOptionHtml(m, selected, attr = 'data-uid') {
  const card = cardOf(m);
  return `
    <button type="button" class="moto-opt ${selected ? 'is-active' : ''}" ${attr}="${m.uid}">
      <img src="${card.imagem}" alt="" width="120" height="72">
      <span class="moto-info">
        <span class="moto-name"><span class="moto-num">${cardNum(card.id)}</span> ${escapeHtml(card.nome)}</span>
        <span class="moto-badges">${rarityBadges(card)}${avariaPills(m)}</span>
      </span>
    </button>`;
}

function statusBadges(p) {
  const badges = [];
  if (p.eliminated) badges.push('<span class="sb sb-out">☠️ Eliminado</span>');
  if (p.prisonTurns > 0) badges.push(`<span class="sb sb-red">🚔 Preso · ${plural(p.prisonTurns, 'turno', 'turnos')}</span>`);
  if (p.licenseTurns > 0) badges.push(`<span class="sb sb-yellow">🪪 Sem carta · ${plural(p.licenseTurns, 'turno', 'turnos')}</span>`);
  if (!p.eliminated && p.balance < 0) badges.push('<span class="sb sb-red">⚠️ Falência</span>');
  if (state.winner === p.id) badges.push('<span class="sb sb-gold">🏆 Vencedor</span>');
  return badges.join('');
}

/* =========================================================
   1. CONFIGURAÇÃO DO JOGO
   ========================================================= */
let setupDraft = null;

/** Mantém a ordem de jogo coerente com o número de jogadores escolhido. */
function syncSetupOrder() {
  const kept = setupDraft.order.filter((i) => i < setupDraft.count);
  const missing = Array.from({ length: setupDraft.count }, (_, i) => i).filter((i) => !kept.includes(i));
  setupDraft.order = [...kept, ...missing];
}

function renderSetupOrder() {
  $('#setupOrder').innerHTML = setupDraft.order.map((i, pos) => {
    const p = setupDraft.players[i];
    return `
      <li class="order-item" style="--pc:${p.color}">
        <span class="order-pos">${pos + 1}º</span>
        <span class="pawn"></span>
        <span class="order-name">${escapeHtml(p.name.trim() || `Jogador ${i + 1}`)}${pos === 0 ? ' <em>· começa</em>' : ''}</span>
        <button type="button" class="icon-btn icon-btn-sm" data-move="-1" data-pos="${pos}" aria-label="Subir" ${pos === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn icon-btn-sm" data-move="1" data-pos="${pos}" aria-label="Descer" ${pos === setupDraft.order.length - 1 ? 'disabled' : ''}>↓</button>
      </li>`;
  }).join('');
}

function renderSetup() {
  $('#setupBalance').value = formatNumber(setupDraft.startBalance);

  $$('#setupCount button').forEach((btn) => {
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(Number(btn.dataset.count) === setupDraft.count));
  });

  $('#setupPlayers').innerHTML = setupDraft.players.slice(0, setupDraft.count).map((p, i) => `
    <div class="setup-player" style="--pc:${p.color}" data-index="${i}">
      <div class="setup-player-head">
        <strong>JOGADOR ${i + 1}</strong>
        <span class="qr-tag">${QR_PREFIX}${i + 1}</span>
      </div>
      <input class="input-plain" type="text" maxlength="18" value="${escapeHtml(p.name)}" placeholder="Jogador ${i + 1}" data-name>
      <div class="swatches" role="group" aria-label="Cor do peão">
        ${PAWN_COLORS.map((c) => `<button type="button" class="swatch" style="--sw:${c}" data-color="${c}" aria-label="Cor ${c}" aria-pressed="${c === p.color}"></button>`).join('')}
      </div>
    </div>`).join('');

  $('#setupVictory').innerHTML = choiceHtml('victory', VICTORY_MODES, setupDraft.victory);
  syncSetupOrder();
  renderSetupOrder();
}

function initSetup() {
  bindMoneyInput($('#setupBalance'), (n) => { setupDraft.startBalance = n; });

  $('#setupCount').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-count]');
    if (!btn) return;
    setupDraft.count = Number(btn.dataset.count);
    renderSetup();
  });

  $('#setupPlayers').addEventListener('input', (e) => {
    if (!e.target.matches('[data-name]')) return;
    const i = Number(e.target.closest('.setup-player').dataset.index);
    setupDraft.players[i].name = e.target.value;
    renderSetupOrder();
  });

  $('#setupPlayers').addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (!sw) return;
    const card = sw.closest('.setup-player');
    const i = Number(card.dataset.index);
    setupDraft.players[i].color = sw.dataset.color;
    card.style.setProperty('--pc', sw.dataset.color);
    $$('.swatch', card).forEach((b) => b.setAttribute('aria-pressed', String(b === sw)));
    renderSetupOrder();
  });

  $('#setupVictory').addEventListener('change', (e) => {
    if (e.target.name === 'victory') setupDraft.victory = e.target.value;
  });

  $('#setupOrder').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn) return;
    const pos = Number(btn.dataset.pos);
    const target = pos + Number(btn.dataset.move);
    if (target < 0 || target >= setupDraft.order.length) return;
    [setupDraft.order[pos], setupDraft.order[target]] = [setupDraft.order[target], setupDraft.order[pos]];
    renderSetupOrder();
  });

  $('#startGameBtn').addEventListener('click', startGame);
}

function startGame() {
  unlockAudio();
  const startBalance = setupDraft.startBalance || DEFAULT_BALANCE;
  const players = setupDraft.players.slice(0, setupDraft.count).map((p, i) => ({
    id: i + 1,
    code: QR_PREFIX + (i + 1),
    name: p.name.trim() || `Jogador ${i + 1}`,
    color: p.color,
    balance: startBalance,
    motos: [],
    prisonTurns: 0,
    licenseTurns: 0,
  }));
  const victory = setupDraft.victory || DEFAULT_VICTORY;

  state = {
    started: true,
    startBalance,
    players,
    victory,
    turn: { order: setupDraft.order.map((i) => i + 1), index: 0, round: 1 },
    timer: victory === 'cronometro'
      ? { durationMs: TIMER_MINUTES * 60000, elapsedMs: 0, runningSince: Date.now(), expired: false }
      : null,
    finished: false,
    winner: null,
    log: [],
    lastSetup: { ...setupDraft, startBalance, players: setupDraft.players.map((p) => ({ ...p })), order: [...setupDraft.order] },
  };
  const first = getPlayer(state.turn.order[0]);
  addSystemLog(`Jogo iniciado · ${players.length} jogadores · ${formatMoney(startBalance)} cada · ${getVictory(victory).chip} · Começa ${first.name}`);
  saveState();
  showGame();
  toast(`Jogo iniciado. Começa ${first.name}! Adiciona a mota inicial de cada jogador na Garagem. 🏍️`, false, 5000);
}

/* =========================================================
   2. ORDEM DE JOGO, CRONÓMETRO & VITÓRIA
   ========================================================= */
const currentTurnPlayer = () => getPlayer(state.turn.order[state.turn.index]);
const nextTurnPlayer = () => getPlayer(state.turn.order[(state.turn.index + 1) % state.turn.order.length]);

function turnAlerts(p) {
  const alerts = [];
  if (p.balance < 0) alerts.push('⚠️ Saldo negativo: tem de vender motas (Garagem) ou ser eliminado.');
  p.motos.forEach((m) => {
    const card = cardOf(m);
    if (m.app && m.app.laps === 1) alerts.push(`📋 Na próxima Partida acaba o contrato de ${motoLabel(card)} na ${slotLabel(m.app.casa)}.`);
    if (m.apreendida) alerts.push(`🅿️ ${motoLabel(card)} está apreendida (resgate ${formatMoney(rescueCost(m))}).`);
  });
  return alerts;
}

function renderTurn() {
  const player = currentTurnPlayer();
  if (!player) return;
  const card = $('#turnCard');
  card.style.setProperty('--pc', player.color);
  card.classList.toggle('is-finished', Boolean(state.finished));
  $('#turnRound').textContent = state.finished ? '🏁 Jogo terminado' : `Ronda ${state.turn.round}`;
  const winner = state.winner && getPlayer(state.winner);
  $('#victoryChip').textContent = winner ? `🏆 Venceu: ${winner.name}` : `🏆 ${getVictory(state.victory).chip}`;
  $('#turnName').textContent = player.name;
  $('#turnStatus').innerHTML = statusBadges(player);

  const next = nextTurnPlayer();
  const lastOfRound = state.turn.index === state.turn.order.length - 1;
  let hint = `A seguir: ${next.name}`;
  if (state.timer && state.timer.expired && !state.finished) hint = lastOfRound ? '⏱️ Último turno do jogo!' : `⏱️ Última ronda · a seguir: ${next.name}`;
  if (state.finished) hint = 'Vence quem tiver o maior Património Líquido.';
  $('#turnNext').textContent = hint;
  $('#turnAlerts').innerHTML = state.finished ? '' : turnAlerts(player).map((a) => `<li>${escapeHtml(a)}</li>`).join('');
  $('#turnNextBtn').disabled = Boolean(state.finished);
  $('#turnBack').disabled = state.turn.round === 1 && state.turn.index === 0 && !state.finished;
}

/** Avança o índice; devolve false se o jogo acabou (cronómetro esgotado no fim da ronda). */
function advanceTurnIndex() {
  const t = state.turn;
  const wraps = t.index >= t.order.length - 1;
  if (wraps && state.timer && state.timer.expired) return false;
  t.index = wraps ? 0 : t.index + 1;
  if (wraps) t.round += 1;
  return true;
}

let lastTurnAt = 0;

function nextTurn() {
  // Um toque duplo acidental não pode saltar um jogador
  if (state.finished || Date.now() - lastTurnAt < 800) return;
  lastTurnAt = Date.now();

  // A carta apreendida conta os turnos jogados em liberdade (não conta o turno em que foi apanhado)
  const cur = currentTurnPlayer();
  if (cur && !cur.jailedThisTurn && !cur.prisonTurns && cur.licenseTurns > 0) {
    cur.licenseTurns -= 1;
    if (!cur.licenseTurns) addSystemLog(`🪪 ${cur.name} recuperou a Carta de Condução.`);
  }
  state.players.forEach((p) => { p.jailedThisTurn = false; });

  // Quem está preso perde a vez
  const skipped = [];
  for (let i = 0; i <= state.turn.order.length; i++) {
    if (!advanceTurnIndex()) return finishGame();
    const p = currentTurnPlayer();
    if (p.prisonTurns > 0) {
      p.prisonTurns -= 1;
      skipped.push(p.name);
      addSystemLog(`🚔 ${p.name} está preso e perde a vez.`);
      continue;
    }
    break;
  }

  refresh();
  sfx('turn');
  const who = `🎲 Vez de ${currentTurnPlayer().name}`;
  toast(skipped.length ? `🚔 ${skipped.join(', ')} perde a vez · ${who}` : who, false, skipped.length ? 4000 : 2600);
}

function prevTurn() {
  const t = state.turn;
  if (state.finished) {
    state.finished = false;
  } else if (t.index > 0) {
    t.index -= 1;
  } else if (t.round > 1) {
    t.index = t.order.length - 1;
    t.round -= 1;
  }
  refresh();
}

function finishGame() {
  state.finished = true;
  pauseTimer();
  addSystemLog('⏱️ Fim do jogo (Modo Cronómetro): todos jogaram o mesmo número de turnos.');
  const ranking = [...activePlayers()].sort((a, b) => patrimony(b) - patrimony(a));
  if (ranking[0] && !state.winner) {
    declareWinner(ranking[0].id, `maior Património Líquido quando o tempo acabou (${formatMoney(patrimony(ranking[0]))})`);
  }
  refresh();
}

let timerInterval = null;

function timerRemainingMs() {
  const t = state.timer;
  if (!t) return 0;
  const running = t.runningSince ? Date.now() - t.runningSince : 0;
  return Math.max(0, t.durationMs - t.elapsedMs - running);
}

function pauseTimer() {
  const t = state.timer;
  if (!t || !t.runningSince) return;
  t.elapsedMs += Date.now() - t.runningSince;
  t.runningSince = null;
}

function renderTimer() {
  const t = state.timer;
  $('#timerBox').hidden = !t;
  if (!t) return;

  const remaining = timerRemainingMs();
  if (remaining === 0 && !t.expired) {
    t.expired = true;
    pauseTimer();
    addSystemLog('⏱️ Tempo esgotado: termina-se a ronda em curso.');
    refresh();
    sfx('alarm');
    toast('⏱️ Tempo esgotado! Terminem a ronda atual.', true, 5000);
  }

  const totalSec = Math.ceil(remaining / 1000);
  $('#timerValue').textContent = `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
  $('#timerBox').classList.toggle('is-low', remaining < 5 * 60000);
  const toggle = $('#timerToggle');
  toggle.hidden = t.expired;
  toggle.textContent = t.runningSince ? '⏸ Pausar' : '▶ Retomar';
}

function startTimerLoop() {
  clearInterval(timerInterval);
  renderTimer();
  if (state.timer) timerInterval = setInterval(renderTimer, 1000);
}

function declareWinner(playerId, why) {
  if (state.winner) return;
  const p = getPlayer(playerId);
  state.winner = playerId;
  addSystemLog(`🏆 ${p.name} venceu: ${why}.`);
  saveState();
  renderTurn();
  renderPlayers();
  renderLogs();
  sfx('alarm');
  setTimeout(() => {
    confirmDialog('🏆 Temos um MOTO TYCOON!', `${p.name} venceu: ${why}. Podem continuar a jogar se quiserem.`, 'Boa!');
  }, 300);
}

function checkVictory() {
  if (!state.started || state.winner) return;
  const target = getVictory(state.victory).target;
  if (target) {
    const leader = activePlayers().filter((p) => patrimony(p) >= target).sort((a, b) => patrimony(b) - patrimony(a))[0];
    if (leader) declareWinner(leader.id, `atingiu ${formatMoney(target)} de Património Líquido`);
  }
  const alive = activePlayers();
  if (alive.length === 1 && state.players.length > 1) declareWinner(alive[0].id, 'é o último jogador em jogo');
}

/** Verifica a vitória no Modo Mestre do Restauro quando uma mota é vendida no Leilão. */
function checkRestauroSale(sellerId, m) {
  const card = cardOf(m);
  if (state.victory === 'restauro' && card.classica && card.raridade === 'Lendária' && m.avarias.length === 0) {
    declareWinner(sellerId, `vendeu no Leilão a Clássica Lendária ${motoLabel(card)} restaurada a 100%`);
  }
}

function initTurns() {
  $('#turnNextBtn').addEventListener('click', nextTurn);
  $('#turnBack').addEventListener('click', prevTurn);
  $('#turnPlayer').addEventListener('click', () => openPlayer(currentTurnPlayer().id));
  $('#timerToggle').addEventListener('click', () => {
    const t = state.timer;
    if (!t || t.expired) return;
    if (t.runningSince) pauseTimer();
    else t.runningSince = Date.now();
    saveState();
    renderTimer();
  });
  $$('[data-turn-tool]').forEach((b) => b.addEventListener('click', () => {
    const id = currentTurnPlayer().id;
    if (b.dataset.turnTool === 'partida') openPartida(id);
    if (b.dataset.turnTool === 'race') openRace({ mode: 'race', aId: id });
    if (b.dataset.turnTool === 'stop') openStop(id);
  }));
}

/* =========================================================
   3. TRANSAÇÕES & HISTÓRICO
   ========================================================= */
let lastActionAt = 0;

function addSystemLog(text) {
  state.log.push({ id: Date.now() + Math.random(), ts: Date.now(), playerId: null, text });
}

/** Proteção contra duplo toque acidental em botões que mexem em dinheiro. */
function guardDoubleTap() {
  const now = Date.now();
  if (now - lastActionAt < 400) return false;
  lastActionAt = now;
  return true;
}

/** Volta a desenhar tudo o que depende do estado e guarda-o. */
function refresh() {
  saveState();
  renderPlayers();
  renderLogs();
  renderTurn();
  renderApps();
  if (playerModal.open) renderPlayerModal();
  if (motoSheet.open) renderMotoSheet();
  checkVictory();
}

function showDelta(playerId, delta) {
  if (currentPlayerId !== playerId || !playerModal.open) return;
  const deltaEl = $('#pmDelta');
  deltaEl.textContent = formatSigned(delta);
  deltaEl.className = 'balance-delta';
  restartAnimation(deltaEl, delta > 0 ? 'up' : 'down');
}

/** Aplica um crédito (delta > 0) ou débito (delta < 0) ao jogador. */
function transact(playerId, delta, reason) {
  const player = getPlayer(playerId);
  if (!player || !delta) return false;
  player.balance += delta;
  state.log.push({ id: Date.now() + Math.random(), ts: Date.now(), playerId, delta, reason, balanceAfter: player.balance });
  sfx(delta > 0 ? 'credit' : 'debit');
  refresh();
  showDelta(playerId, delta);
  return true;
}

/** Passa dinheiro de um jogador para outro numa só operação. */
function transfer(fromId, toId, amount, reason) {
  const from = getPlayer(fromId);
  const to = getPlayer(toId);
  if (!from || !to || fromId === toId || amount <= 0) return false;
  from.balance -= amount;
  to.balance += amount;
  state.log.push({ id: Date.now() + Math.random(), ts: Date.now(), kind: 'transfer', fromId, toId, amount, reason });
  sfx('credit');
  refresh();
  showDelta(fromId, -amount);
  showDelta(toId, amount);
  return true;
}

const isMoneyEntry = (e) => e.playerId || e.kind === 'transfer';

async function undoLast() {
  const entry = [...state.log].reverse().find((e) => isMoneyEntry(e) && !e.undone);
  if (!entry) return toast('Não há transações para anular.', true);

  let summary;
  if (entry.kind === 'transfer') {
    const from = getPlayer(entry.fromId);
    const to = getPlayer(entry.toId);
    summary = `${formatMoney(entry.amount)} de ${from ? from.name : '?'} para ${to ? to.name : '?'} (${entry.reason}).`;
  } else {
    const player = getPlayer(entry.playerId);
    summary = `${formatSigned(entry.delta)} · ${player ? player.name : '?'} (${entry.reason}).`;
  }
  const ok = await confirmDialog('Anular última transação?', `${summary} Os saldos serão repostos. A garagem não é alterada.`, 'Anular');
  if (!ok) return;

  if (entry.kind === 'transfer') {
    const from = getPlayer(entry.fromId);
    const to = getPlayer(entry.toId);
    if (from) from.balance += entry.amount;
    if (to) to.balance -= entry.amount;
  } else {
    const player = getPlayer(entry.playerId);
    if (player) player.balance -= entry.delta;
  }
  entry.undone = true;
  refresh();
  toast('Transação anulada.');
}

function playerTag(id) {
  const player = getPlayer(id);
  const name = player ? player.name : `Jogador ${id}`;
  const color = player ? player.color : 'var(--muted)';
  return `<b style="color:${color}">${escapeHtml(name)}</b>`;
}

function logItemHtml(entry) {
  if (entry.kind === 'transfer') {
    return `
    <li class="log-item transfer ${entry.undone ? 'undone' : ''}">
      <span class="log-time">${formatTime(entry.ts)}</span>
      <span class="log-text">${playerTag(entry.fromId)} pagou <b>${formatMoney(entry.amount)}</b> → ${playerTag(entry.toId)}
        <em>(${escapeHtml(entry.reason)})</em>${entry.undone ? ' <em>· anulada</em>' : ''}</span>
      <span class="log-amount">⇄ ${formatNumber(entry.amount)} €</span>
    </li>`;
  }
  if (!entry.playerId) {
    return `<li class="log-item system"><span class="log-time">${formatTime(entry.ts)}</span><span class="log-text">${escapeHtml(entry.text)}</span><span></span></li>`;
  }
  const isCredit = entry.delta > 0;
  const verb = isCredit ? 'creditou' : 'debitou';
  const arrow = isCredit ? '→' : '←';
  return `
    <li class="log-item ${isCredit ? 'credit' : 'debit'} ${entry.undone ? 'undone' : ''}">
      <span class="log-time">${formatTime(entry.ts)}</span>
      <span class="log-text">Banqueiro ${verb} <b>${formatMoney(Math.abs(entry.delta))}</b> ${arrow}
        ${playerTag(entry.playerId)} <em>(${escapeHtml(entry.reason)})</em>${entry.undone ? ' <em>· anulada</em>' : ''}</span>
      <span class="log-amount">${formatSigned(entry.delta)}</span>
    </li>`;
}

function renderLogs() {
  const newestFirst = [...state.log].reverse();
  const empty = '<li class="log-empty">Ainda sem transações.</li>';
  $('#recentLog').innerHTML = newestFirst.slice(0, 5).map(logItemHtml).join('') || empty;
  $('#fullLog').innerHTML = newestFirst.slice(0, 500).map(logItemHtml).join('') || empty;
}

/* =========================================================
   4. JOGADORES & FICHA DO JOGADOR
   ========================================================= */
const playerModal = $('#playerModal');
let currentPlayerId = null;
let currentPlayerTab = 'money';
let quickActions = [];

function renderPlayers() {
  if (!state.started) return;
  const turnId = state.turn ? state.turn.order[state.turn.index] : null;
  const target = getVictory(state.victory).target;
  const ordered = [
    ...state.turn.order.map(getPlayer).filter(Boolean),
    ...state.players.filter((p) => p.eliminated),
  ];
  $('#playerGrid').innerHTML = ordered.map((p) => {
    const pat = patrimony(p);
    const progress = target ? Math.min(100, Math.max(0, (pat / target) * 100)) : 0;
    return `
    <button type="button" class="player-card ${p.id === turnId ? 'is-turn' : ''} ${p.eliminated ? 'is-out' : ''}" style="--pc:${p.color}" data-player="${p.id}">
      <span class="pc-top"><span class="pawn"></span><span class="pc-name">${escapeHtml(p.name)}</span></span>
      <span class="pc-balance ${p.balance < 0 ? 'is-negative' : ''}">${formatMoney(p.balance)}</span>
      <span class="pc-pat">Património <b>${formatMoney(pat)}</b> · ${plural(p.motos.length, 'mota', 'motas')}</span>
      ${target ? `<span class="pc-progress" title="${Math.round(progress)}% da meta"><span style="width:${progress}%"></span></span>` : ''}
      <span class="status-badges">${statusBadges(p)}</span>
      <span class="pc-code">${p.id === turnId && !state.finished ? '🎲 a jogar' : p.code}</span>
    </button>`;
  }).join('');
}

function openPlayer(id, tab = 'money') {
  currentPlayerId = id;
  currentPlayerTab = tab;
  $('#pmDelta').className = 'balance-delta';
  $('#pmAmount').value = '';
  $('#pmReason').value = '';
  renderPlayerModal();
  if (!playerModal.open) playerModal.showModal();
}

function buildQuickActions(p) {
  const inGarage = p.motos.filter((m) => !m.app && !m.apreendida).length;
  const inApps = p.motos.filter((m) => m.app).length;
  return [
    { amount: 1500, reason: 'Subvenção de Combustível', label: 'Subvenção Combustível' },
    { amount: 2000, reason: 'Patrocínio Akrapovič', label: 'Patrocínio Akrapovič' },
    { amount: -1000, reason: 'Radar / Combustíveis', label: 'Radar · Combustíveis' },
    { amount: -1500, reason: 'Apreensão de Escape', label: 'Apreensão de Escape' },
    { amount: -500 * inGarage, reason: `Inspeção de Finanças (${inGarage} na garagem)`, label: `Inspeção · ${inGarage} na garagem` },
    { amount: -300 * inApps, reason: `Comissão de Plataforma (${inApps} nas Apps)`, label: `Comissão · ${inApps} nas Apps` },
  ];
}

function renderPlayerModal() {
  const p = getPlayer(currentPlayerId);
  if (!p) return;
  playerModal.style.setProperty('--pc', p.color);
  $('#pmName').textContent = p.name;
  $('#pmCode').textContent = `Cartão ${p.code}`;
  $('#pmStatus').innerHTML = statusBadges(p);

  $$('[data-pm-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.pmTab === currentPlayerTab)));
  $('#pmPanelMoney').hidden = currentPlayerTab !== 'money';
  $('#pmPanelGarage').hidden = currentPlayerTab !== 'garage';
  $('#pmGarageCount').textContent = p.motos.length ? `(${p.motos.length})` : '';

  const bal = $('#pmBalance');
  bal.textContent = formatMoney(p.balance);
  bal.classList.toggle('is-negative', p.balance < 0);
  $('#pmPatrimony').textContent = `Património ${formatMoney(patrimony(p))}`;

  quickActions = buildQuickActions(p);
  $('#pmQuick').innerHTML = quickActions.map((a, i) => `
    <button type="button" class="qa ${a.amount > 0 ? 'plus' : 'minus'}" data-quick="${i}" ${a.amount ? '' : 'disabled'}>
      ${a.amount ? formatSigned(a.amount) : '0 €'}<small>${escapeHtml(a.label)}</small>
    </button>`).join('');

  renderGarage(p);
}

function renderGarage(p) {
  const value = p.motos.reduce((s, m) => s + motoValue(m), 0);
  $('#gsCount').textContent = p.motos.length;
  $('#gsValue').textContent = formatMoney(value);
  $('#gsPatrimony').textContent = formatMoney(patrimony(p));
  $('#pmEliminate').hidden = !(p.balance < 0 && !p.eliminated);
  $('#pmAddMoto').hidden = Boolean(p.eliminated);

  $('#pmGarage').innerHTML = p.motos.map((m) => {
    const card = cardOf(m);
    return `
    <li>
      <button type="button" class="moto-row ${isStopped(m) ? 'is-stopped' : ''}" data-open-moto="${m.uid}">
        <img src="${card.imagem}" alt="" width="120" height="72" loading="lazy">
        <span class="moto-info">
          <span class="moto-name"><span class="moto-num">${cardNum(card.id)}</span> ${escapeHtml(card.nome)}</span>
          <span class="moto-badges">${rarityBadges(card)}${avariaPills(m)}</span>
          <span class="moto-values">${motoStateText(m)} · vale ${formatMoney(motoValue(m))}</span>
        </span>
      </button>
    </li>`;
  }).join('') || '<li class="log-empty">Garagem vazia. Adiciona a mota inicial ou uma compra.</li>';
}

/** Fluxo de compra / registo de uma mota na garagem. */
function addMotoFlow(playerId) {
  openMotoPicker(async (card) => {
    const owner = ownerOfCard(card.id);
    if (owner) return toast(`${motoLabel(card)} já está na garagem de ${owner.name}.`, true, 4000);
    const p = getPlayer(playerId);
    const achado = Math.round(card.aquisicao * (100 - ACHADO_DISCOUNT) / 100);
    const origin = await choiceDialog(`Adicionar ${motoLabel(card)}`, `Saldo de ${p.name}: ${formatMoney(p.balance)}`, [
      { value: { price: card.aquisicao, label: 'Compra na Sucata / Feira' }, title: `🛒 Sucata / Feira · ${formatMoney(card.aquisicao)}`, sub: 'Depois marca as 2 avarias tiradas do baralho', tone: 'hot' },
      { value: { price: achado, label: 'Achado de Garagem (−30%)' }, title: `🍀 Achado de Garagem · ${formatMoney(achado)}`, sub: 'Carta de Sorte: −30% (com as 2 avarias)', tone: 'hot' },
      { value: { price: 0, label: 'Mota inicial' }, title: '🏁 Mota inicial · grátis', sub: 'Marca a avaria inicial (se sair Crítica, volta ao baralho)', tone: 'fair' },
      { value: { price: 0, label: 'Registo sem pagamento' }, title: '📝 Sem pagamento', sub: 'Já foi paga noutro sítio', tone: 'none' },
    ]);
    if (!origin) return;
    if (origin.price > p.balance) {
      const ok = await confirmDialog('Saldo insuficiente', `${p.name} só tem ${formatMoney(p.balance)} e a mota custa ${formatMoney(origin.price)}. Registar mesmo assim?`, 'Registar');
      if (!ok) return;
    }
    // Cada carta só existe uma vez (pode ter sido registada entretanto)
    if (ownerOfCard(card.id)) return toast(`${motoLabel(card)} já está numa garagem.`, true);
    const moto = { uid: newUid(), cardId: card.id, avarias: [], app: null, apreendida: null };
    p.motos.push(moto);
    addSystemLog(`${p.name} · ${origin.label}: ${motoLabel(card)}.`);
    if (origin.price) transact(p.id, -origin.price, `${origin.label} · ${motoLabel(card)}`);
    else refresh();
    openMotoSheet(p.id, moto.uid, origin.price || origin.label === 'Mota inicial' ? 'Marca agora as avarias tiradas do baralho.' : '');
  });
}

async function eliminatePlayer(playerId) {
  const p = getPlayer(playerId);
  const ok = await confirmDialog(
    `Eliminar ${p.name}?`,
    'As motas voltam ao baralho de motas, as avarias ao baralho de avarias e as cartas de Sorte/Azar ao baralho de eventos. Baralhem os 3 baralhos.',
    'Eliminar',
  );
  if (!ok) return;
  p.eliminated = true;
  p.motos = [];
  p.prisonTurns = 0;
  p.licenseTurns = 0;
  const t = state.turn;
  const pos = t.order.indexOf(p.id);
  if (pos !== -1) {
    t.order.splice(pos, 1);
    if (pos < t.index) t.index -= 1;
    if (t.index >= t.order.length) t.index = 0;
  }
  addSystemLog(`☠️ ${p.name} foi eliminado (falência). Baralhem os 3 baralhos.`);
  playerModal.close();
  refresh();
  sfx('alarm');
}

function initPlayerModal() {
  $('#pmChips').innerHTML =
    AMOUNT_CHIPS.map((v) => `<button type="button" class="chip" data-chip="${v}">+${formatNumber(v)}</button>`).join('') +
    '<button type="button" class="chip" data-chip="clear">C</button>';

  $$('[data-pm-tab]').forEach((t) => t.addEventListener('click', () => {
    currentPlayerTab = t.dataset.pmTab;
    renderPlayerModal();
  }));

  $('#pmQuick').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick]');
    if (!btn || !guardDoubleTap()) return;
    const action = quickActions[Number(btn.dataset.quick)];
    if (action && action.amount) transact(currentPlayerId, action.amount, action.reason);
  });

  $$('[data-pm-tool]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.pmTool === 'partida') openPartida(currentPlayerId);
    if (b.dataset.pmTool === 'stop') openStop(currentPlayerId);
    if (b.dataset.pmTool === 'race') openRace({ mode: 'race', aId: currentPlayerId });
  }));

  const amountInput = $('#pmAmount');
  bindMoneyInput(amountInput);
  bindAmountChips($('#pmChips'), amountInput);

  const applyCustom = (sign) => {
    const amount = parseAmount(amountInput.value);
    if (!amount) {
      restartAnimation(amountInput.parentElement, 'shake');
      return toast('Introduz um valor primeiro.', true);
    }
    if (!guardDoubleTap()) return;
    const reason = $('#pmReason').value.trim() || (sign > 0 ? 'Crédito manual' : 'Débito manual');
    if (transact(currentPlayerId, sign * amount, reason)) {
      amountInput.value = '';
      $('#pmReason').value = '';
    }
  };
  $('#pmAdd').addEventListener('click', () => applyCustom(1));
  $('#pmSub').addEventListener('click', () => applyCustom(-1));
  $('#pmTransfer').addEventListener('click', () => openTransfer({ from: currentPlayerId }));

  $('#pmAddMoto').addEventListener('click', () => addMotoFlow(currentPlayerId));
  $('#pmGarage').addEventListener('click', (e) => {
    const row = e.target.closest('[data-open-moto]');
    if (row) openMotoSheet(currentPlayerId, row.dataset.openMoto);
  });
  $('#pmEliminate').addEventListener('click', () => eliminatePlayer(currentPlayerId));

  playerModal.addEventListener('close', () => { currentPlayerId = null; });
}

/** Botões +100/+500/... que somam ao valor de um campo. */
function bindAmountChips(container, input, onChange) {
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    const next = chip.dataset.chip === 'clear' ? 0 : parseAmount(input.value) + Number(chip.dataset.chip);
    input.value = next ? formatNumber(next) : '';
    if (onChange) onChange();
  });
}

/* =========================================================
   5. FICHA DA MOTA
   ========================================================= */
const motoSheet = $('#motoSheet');
let motoCtx = null;

function openMotoSheet(playerId, uid, hint = '') {
  motoCtx = { playerId, uid, hint };
  renderMotoSheet();
  if (!motoSheet.open) motoSheet.showModal();
}

function allocBlockReason(p, m) {
  if (m.apreendida) return 'A mota está apreendida.';
  if (isStopped(m)) return 'Mota parada (avaria Crítica): repara-a primeiro.';
  if (p.licenseTurns > 0) return 'Carta de Condução apreendida: não pode alocar motas.';
  if (p.prisonTurns > 0) return 'Jogador preso.';
  if (APP_SLOTS.every((s) => slotOccupant(s.casa))) return 'Todas as vagas estão ocupadas.';
  return '';
}

function renderMotoSheet() {
  const p = motoCtx && getPlayer(motoCtx.playerId);
  const m = p && getMoto(p.id, motoCtx.uid);
  if (!m) {
    if (motoSheet.open) motoSheet.close();
    return;
  }
  const card = cardOf(m);
  const rules = RACE_RULES[card.raridade];
  $('#msName').textContent = motoLabel(card);
  $('#msOwner').innerHTML = `Garagem de ${playerTag(p.id)}`;

  const blocked = allocBlockReason(p, m);
  const bankrupt = p.balance < 0;
  const debt = Math.max(0, -p.balance);

  let appSection;
  if (m.apreendida) {
    appSection = `
      <p class="ms-state">🅿️ Apreendida no parque da Polícia.</p>
      <button type="button" class="btn btn-plus btn-xl" data-ms="rescue">🔓 Resgatar · ${formatMoney(rescueCost(m))}</button>
      <p class="hint">Só ao sair da prisão ou ao parar exatamente na casa POLÍCIA (15).</p>`;
  } else if (m.app) {
    appSection = `
      <p class="ms-state">📱 A trabalhar na <b>${slotLabel(m.app.casa)}</b> · rende ${formatMoney(appIncome(m))}/volta</p>
      <div class="laps-row">
        <span>Voltas de contrato</span>
        <button type="button" class="icon-btn icon-btn-sm" data-ms="laps-" aria-label="Menos uma volta">−</button>
        <strong>${m.app.laps}</strong>
        <button type="button" class="icon-btn icon-btn-sm" data-ms="laps+" aria-label="Mais uma volta">+</button>
      </div>
      <button type="button" class="btn btn-ghost btn-xl" data-ms="unalloc">↩ Tirar da App (volta à garagem)</button>`;
  } else {
    appSection = `
      <p class="ms-state">${isStopped(m) ? '🔴 Parada na garagem' : '🏠 Na garagem'}</p>
      <button type="button" class="btn btn-primary btn-xl" data-ms="alloc" ${blocked ? 'disabled' : ''}>📱 Pôr a trabalhar numa App</button>
      ${blocked ? `<p class="hint">${escapeHtml(blocked)}</p>` : ''}`;
  }

  $('#msBody').innerHTML = `
    ${motoCtx.hint ? `<p class="ms-hint">👉 ${escapeHtml(motoCtx.hint)}</p>` : ''}
    <div class="ms-hero">
      <img src="${card.imagem}" alt="" width="240" height="144">
      <div class="moto-badges">${rarityBadges(card)}</div>
    </div>
    <div class="breakdown ms-values">
      <div><span>Preço de Aquisição</span><strong>${formatMoney(card.aquisicao)}</strong></div>
      <div><span>Valor de Venda (Leilão)</span><strong>${formatMoney(card.venda)}</strong></div>
      <div><span>Rendimento nas Apps</span><strong>${formatMoney(appIncome(m))} / volta</strong></div>
      <div><span>Valor no património</span><strong>${formatMoney(motoValue(m))}</strong></div>
      <div><span>Corridas</span><strong>${rules.dados} dados · ${rules.relancamentos} relanç.</strong></div>
    </div>

    <h3 class="section-title ms-title">Avarias (${m.avarias.length}/2)</h3>
    <ul class="av-list">
      ${m.avarias.map((a, i) => `
        <li class="av-item av-${AVARIAS[a].tone}">
          <span><b>${AVARIAS[a].nome}</b> · −${AVARIAS[a].valor}% valor${AVARIAS[a].rendimento ? ` · −${AVARIAS[a].rendimento}% Apps` : ''}</span>
          <button type="button" class="btn btn-sm" data-ms="repair" data-i="${i}">🔧 Reparar · ${formatMoney(repairCost(m, a))}</button>
        </li>`).join('') || '<li class="log-empty">Sem avarias 🎉</li>'}
    </ul>
    <span class="field-label">Tirou uma carta de avaria? Marca-a:</span>
    <div class="av-add">
      ${Object.entries(AVARIAS).map(([k, a]) => `<button type="button" class="btn btn-sm av-btn av-${a.tone}" data-ms="avaria" data-tipo="${k}">＋ ${a.nome}</button>`).join('')}
    </div>

    <h3 class="section-title ms-title">Trabalho</h3>
    ${appSection}

    <h3 class="section-title ms-title">Vender</h3>
    <button type="button" class="btn btn-xl" data-ms="auction" ${m.apreendida ? 'disabled' : ''}>🔨 Vender no Leilão</button>
    ${bankrupt ? `
      <div class="ms-bankrupt">
        <p>⚠️ ${escapeHtml(p.name)} está em falência (dívida ${formatMoney(debt)}).</p>
        <button type="button" class="btn btn-primary btn-xl" data-ms="bank-sell">🏦 Vender ao Banco · ${formatMoney(bankPrice(m))}</button>
        <button type="button" class="btn btn-transfer btn-xl" data-ms="bankrupt-auction">⚡ Leilão de falência · base ${formatMoney(Math.max(debt, bankPrice(m)))}</button>
      </div>` : ''}

    <button type="button" class="link-btn link-danger" data-ms="remove">🗑️ Remover da garagem (corrigir engano)</button>`;
}

async function repairFlow(p, m, index) {
  const tipo = m.avarias[index];
  const card = cardOf(m);
  const cost = repairCost(m, tipo);
  const options = [
    { value: cost, title: `💶 Pagar ao Banco · ${formatMoney(cost)}`, sub: 'Reparação na Oficina', tone: 'hot' },
    { value: 0, title: '🆓 Grátis', sub: 'Garagem do Amigo · Vale de Reparação · Reparação Manual (Trio ou superior)', tone: 'fair' },
  ];
  if (tipo === 'M') options.push({ value: cost / 2, title: `🧰 Mecânico Amigo · ${formatMoney(cost / 2)}`, sub: 'Carta de Sorte: Moderada a metade do preço', tone: 'yellow' });
  const price = await choiceDialog(`Reparar ${AVARIAS[tipo].nome}`, motoLabel(card), options);
  if (price === null) return;
  m.avarias.splice(index, 1);
  addSystemLog(`🔧 ${p.name} reparou a avaria ${AVARIAS[tipo].nome} de ${motoLabel(card)}${price ? '' : ' (grátis)'}.`);
  if (price) transact(p.id, -price, `Reparação ${AVARIAS[tipo].nome} · ${motoLabel(card)}`);
  else refresh();
  toast(`✅ ${AVARIAS[tipo].nome} reparada. A carta volta ao fundo do baralho.`);
}

function removeMoto(p, uid) {
  p.motos = p.motos.filter((m) => m.uid !== uid);
}

/** Passa uma mota (com as avarias) para a garagem de outro jogador. */
function moveMoto(fromId, uid, toId) {
  const from = getPlayer(fromId);
  const to = getPlayer(toId);
  const m = getMoto(fromId, uid);
  if (!m || !to) return;
  removeMoto(from, uid);
  m.app = null;
  to.motos.push(m);
}

async function motoAction(action, el) {
  const p = getPlayer(motoCtx.playerId);
  const m = getMoto(p.id, motoCtx.uid);
  if (!m) return;
  const card = cardOf(m);
  motoCtx.hint = '';

  if (action === 'avaria') return addAvariaTo(p, m, el.dataset.tipo, 'marcada pelo banqueiro');
  if (action === 'repair') return repairFlow(p, m, Number(el.dataset.i));
  if (action === 'alloc') return openAlloc({ playerId: p.id, uid: m.uid });
  if (action === 'laps-' || action === 'laps+') {
    m.app.laps = Math.max(1, Math.min(6, m.app.laps + (action === 'laps+' ? 1 : -1)));
    return refresh();
  }
  if (action === 'unalloc') {
    addSystemLog(`${p.name}: ${motoLabel(card)} saiu da ${slotLabel(m.app.casa)}.`);
    m.app = null;
    return refresh();
  }
  if (action === 'rescue') {
    if (!guardDoubleTap()) return;
    const cost = rescueCost(m);
    m.apreendida = null;
    addSystemLog(`🔓 ${p.name} resgatou ${motoLabel(card)}.`);
    return transact(p.id, -cost, `Resgate da mota apreendida · ${motoLabel(card)}`);
  }
  if (action === 'auction') {
    startAuctionFor(p.id, m.uid);
    return;
  }
  if (action === 'bank-sell') {
    const price = bankPrice(m);
    const ok = await confirmDialog(`Vender ao Banco?`, `${motoLabel(card)} por ${formatMoney(price)} (50% do Preço de Aquisição com avarias).`, 'Vender');
    if (!ok) return;
    removeMoto(p, m.uid);
    addSystemLog(`🏦 ${p.name} vendeu ${motoLabel(card)} ao Banco (falência).`);
    transact(p.id, price, `Venda ao Banco (falência) · ${motoLabel(card)}`);
    return;
  }
  if (action === 'bankrupt-auction') {
    const base = Math.max(Math.max(0, -p.balance), bankPrice(m));
    openTransfer({
      to: p.id,
      lockTo: true,
      amount: base,
      minAmount: base,
      reason: `Leilão de falência · ${motoLabel(card)}`,
      subtitle: 'Quem paga é o comprador. Se ninguém licitar, vende ao Banco.',
      onDone: (buyerId) => {
        moveMoto(p.id, m.uid, buyerId);
        addSystemLog(`⚡ ${motoLabel(card)} passou para ${getPlayer(buyerId).name} (leilão de falência).`);
        refresh();
      },
    });
    return;
  }
  if (action === 'remove') {
    const ok = await confirmDialog('Remover da garagem?', `${motoLabel(card)} sai da garagem sem mexer no dinheiro. Usa só para corrigir enganos.`, 'Remover');
    if (!ok) return;
    removeMoto(p, m.uid);
    addSystemLog(`🗑️ ${motoLabel(card)} removida da garagem de ${p.name} (correção).`);
    refresh();
  }
}

function initMotoSheet() {
  $('#msBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ms]');
    if (btn) motoAction(btn.dataset.ms, btn);
  });
}

/* =========================================================
   6. PARTIDA
   ========================================================= */
const partidaSheet = $('#partidaSheet');
let partidaDraft = null;

function partidaBreakdown(p, { rain, vipUid }) {
  const owned = p.motos.filter((m) => !m.apreendida);
  const ten = owned.reduce((s, m) => s + partidaTenPct(m), 0);
  const apps = p.motos.filter((m) => m.app).map((m) => {
    const base = rain ? 0 : appIncome(m);
    return { m, value: m.uid === vipUid ? base * 2 : base };
  });
  const classic = owned.filter((m) => cardOf(m).classica).reduce((s, m) => s + CLASSIC_PARTIDA_BONUS[cardOf(m).raridade], 0);
  const appsTotal = apps.reduce((s, a) => s + a.value, 0);
  return { base: PARTIDA_BASE, ten, apps, appsTotal, classic, total: PARTIDA_BASE + ten + appsTotal + classic, ownedCount: owned.length };
}

function openPartida(playerId) {
  partidaDraft = { playerId, rain: false, vipUid: null };
  renderPartida();
  partidaSheet.showModal();
}

function renderPartida() {
  const p = getPlayer(partidaDraft.playerId);
  const b = partidaBreakdown(p, partidaDraft);
  $('#ptPlayer').innerHTML = playerTag(p.id);
  const appMotos = p.motos.filter((m) => m.app);

  $('#ptBody').innerHTML = `
    <div class="breakdown pt-lines">
      <div><span>Subvenção de manutenção</span><strong>${formatMoney(b.base)}</strong></div>
      <div><span>10% das motas (${b.ownedCount})</span><strong>${formatMoney(b.ten)}</strong></div>
      ${b.apps.map((a) => {
        const card = cardOf(a.m);
        const after = a.m.app.laps - 1;
        return `<div><span>📱 ${escapeHtml(motoLabel(card))}<br><small>${slotLabel(a.m.app.casa)} · ${after > 0 ? `faltam ${plural(after, 'volta', 'voltas')}` : '<b class="t-yellow">contrato termina</b>'}</small></span><strong>${formatMoney(a.value)}</strong></div>`;
      }).join('')}
      ${b.classic ? `<div><span>Valorização das Clássicas</span><strong>${formatMoney(b.classic)}</strong></div>` : ''}
    </div>

    ${appMotos.length ? `
      <span class="field-label">Cartas de evento</span>
      <div class="chips">
        <button type="button" class="chip ${partidaDraft.rain ? 'is-active' : ''}" data-pt="rain">☔ Chuva: sem rendimento das Apps</button>
      </div>
      <span class="field-label pt-vip">⭐ Cliente VIP (dobra o rendimento de 1 mota)</span>
      <div class="chips">
        <button type="button" class="chip ${!partidaDraft.vipUid ? 'is-active' : ''}" data-pt="vip" data-uid="">Nenhuma</button>
        ${appMotos.map((m) => `<button type="button" class="chip ${partidaDraft.vipUid === m.uid ? 'is-active' : ''}" data-pt="vip" data-uid="${m.uid}">${cardNum(m.cardId)}</button>`).join('')}
      </div>` : ''}

    <div class="pt-total">
      <span>Total a receber</span>
      <strong>${formatMoney(b.total)}</strong>
    </div>
    <button type="button" class="btn btn-primary btn-xl" data-pt="pay">💶 Pagar ${formatMoney(b.total)}${appMotos.length ? ' e descontar 1 volta' : ''}</button>`;
}

function applyPartida() {
  if (!guardDoubleTap()) return;
  const p = getPlayer(partidaDraft.playerId);
  const b = partidaBreakdown(p, partidaDraft);
  const ended = [];
  p.motos.filter((m) => m.app).forEach((m) => {
    m.app.laps -= 1;
    if (m.app.laps <= 0) {
      ended.push(`${motoLabel(cardOf(m))} · ${slotLabel(m.app.casa)}`);
      addSystemLog(`📋 Fim de contrato: ${motoLabel(cardOf(m))} saiu da ${slotLabel(m.app.casa)} e voltou à garagem de ${p.name}.`);
      m.app = null;
    }
  });
  if (partidaDraft.rain) addSystemLog(`☔ ${p.name}: Chuva Intensa, sem rendimento das Apps nesta volta.`);
  partidaSheet.close();
  transact(p.id, b.total, 'Passou na Partida');
  if (ended.length) {
    setTimeout(() => notify(`📋 Contrato terminado: ${ended.join(' · ')}. Tira a carta do tabuleiro e devolve-a à garagem.`), 400);
  } else {
    toast(`🏁 ${p.name} recebeu ${formatMoney(b.total)}`);
  }
}

function initPartida() {
  $('#ptBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pt]');
    if (!btn) return;
    if (btn.dataset.pt === 'rain') partidaDraft.rain = !partidaDraft.rain;
    if (btn.dataset.pt === 'vip') partidaDraft.vipUid = btn.dataset.uid || null;
    if (btn.dataset.pt === 'pay') return applyPartida();
    renderPartida();
  });
}

/* =========================================================
   7. OPERAÇÃO STOP
   ========================================================= */
const stopSheet = $('#stopSheet');
let stopPlayerId = null;

function stopBreakdown(p) {
  const motos = p.motos.filter((m) => !m.apreendida && m.avarias.length).map((m) => ({ m, ...stopFineDetail(m) }));
  const subtotal = motos.reduce((s, x) => s + x.total, 0);
  const reincid = p.licenseTurns > 0;
  return { motos, subtotal, reincid, total: reincid ? subtotal * 2 : subtotal };
}

function openStop(playerId) {
  stopPlayerId = playerId;
  renderStop();
  stopSheet.showModal();
}

function renderStop() {
  const p = getPlayer(stopPlayerId);
  const b = stopBreakdown(p);
  $('#stPlayer').innerHTML = playerTag(p.id);
  if (!b.total) {
    $('#stBody').innerHTML = `
      <p class="ms-state">✅ Nenhuma avaria por reparar: não há multa.</p>
      <button type="button" class="btn btn-ghost btn-xl" data-close-stop>Fechar</button>`;
    return;
  }
  $('#stBody').innerHTML = `
    <div class="breakdown pt-lines">
      ${b.motos.map((x) => `
        <div><span>${escapeHtml(motoLabel(cardOf(x.m)))}<br><small>${x.lines.map((l) => `${AVARIAS[l.tipo].nome} ${l.ignored ? '<s>' : ''}${formatMoney(l.fine)}${l.ignored ? '</s> (Clássica ignora)' : ''}`).join(' · ')}</small></span><strong>${formatMoney(x.total)}</strong></div>`).join('')}
      ${b.reincid ? `<div><span>⚖️ Reincidência: carta apreendida</span><strong>× 2</strong></div>` : ''}
    </div>
    <div class="pt-total"><span>Multa total</span><strong>${formatMoney(b.total)}</strong></div>
    <button type="button" class="btn btn-minus btn-xl" data-stop="pay">💸 Pagar ${formatMoney(b.total)}</button>
    <button type="button" class="btn btn-ghost btn-xl st-habeas" data-stop="habeas">📜 Usar Habeas Corpus (cancela a multa)</button>`;
}

function initStop() {
  $('#stBody').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-stop]')) return stopSheet.close();
    const btn = e.target.closest('[data-stop]');
    if (!btn || !guardDoubleTap()) return;
    const p = getPlayer(stopPlayerId);
    const b = stopBreakdown(p);
    stopSheet.close();
    if (btn.dataset.stop === 'pay') {
      transact(p.id, -b.total, `Operação Stop${b.reincid ? ' (reincidência ×2)' : ''}`);
    } else {
      addSystemLog(`📜 ${p.name} usou Habeas Corpus e cancelou a multa da Operação Stop (${formatMoney(b.total)}).`);
      refresh();
      toast('📜 Multa cancelada. A carta volta ao baralho.');
    }
  });
}

/* =========================================================
   8. CORRIDAS & POLÍCIA
   ========================================================= */
const raceSheet = $('#raceSheet');
let race = null;

/**
 * Abre o assistente de corrida.
 * opts = { mode: 'race', aId }                  → Corrida Ilegal
 * opts = { mode: 'dispute', aId, casa }         → Disputa de vaga numa App
 */
function openRace(opts) {
  race = { mode: opts.mode, aId: opts.aId || null, aUid: null, opp: null, bUid: null, casa: opts.casa || null, winner: null, tier: null, bet: 0, phase: 'setup', police: {} };
  if (race.mode === 'dispute') {
    const occ = slotOccupant(race.casa);
    if (!occ) return toast('A vaga já está livre.', true);
    race.opp = occ.player.id;
    race.bUid = occ.moto.uid;
    if (race.aId === race.opp) race.aId = null;
  }
  renderRace();
  raceSheet.showModal();
}

function raceEligible(p) {
  return p.motos.filter((m) => canRace(m) && (race.mode === 'race' || !m.app));
}

function raceCap() {
  const a = getPlayer(race.aId);
  const aMoto = a && getMoto(a.id, race.aUid);
  if (!aMoto) return 0;
  if (race.opp === 'bank') return Math.max(0, Math.min(RACE_RULES[cardOf(aMoto).raridade].maxBanco, a.balance));
  const b = getPlayer(race.opp);
  return b ? Math.max(0, Math.min(a.balance, b.balance)) : 0;
}

function diceText(m) {
  const r = RACE_RULES[cardOf(m).raridade];
  return `${r.dados} dados · ${r.relancamentos ? plural(r.relancamentos, 'relançamento', 'relançamentos') : 'sem relançar'}`;
}

function raceReady() {
  if (!race.aId || !race.aUid || !race.opp) return false;
  if (race.opp !== 'bank' && !race.bUid) return false;
  if (!race.winner) return false;
  if (race.winner === 'tie') return true;
  if (race.mode === 'race') return race.bet > 0 && race.bet <= raceCap() && Boolean(race.tier);
  return true;
}

function renderRace() {
  const isDispute = race.mode === 'dispute';
  $('#rcTitle').textContent = isDispute ? '⚔️ Disputa de vaga' : '🏎️ Corrida Ilegal';
  $('#rcSubtitle').textContent = isDispute ? `${slotLabel(race.casa)} · sem apostas: quem perde paga 10%` : 'Contra o Banco ou outro jogador';
  if (race.phase === 'police') return renderPolice();

  const a = getPlayer(race.aId);
  const aMoto = a && getMoto(a.id, race.aUid);
  const opp = race.opp === 'bank' ? null : getPlayer(race.opp);
  const bMoto = opp && getMoto(opp.id, race.bUid);
  const challengers = activePlayers().filter((p) => !isDispute || p.id !== race.opp);
  const cap = raceCap();

  let html = `
    <span class="field-label">${isDispute ? 'Quem desafia' : 'Quem corre'}</span>
    <div class="chips chips-fill" data-rc="a">${playerChipsHtml(challengers, race.aId)}</div>`;

  if (a) {
    const motos = raceEligible(a);
    html += `
      <span class="field-label">Mota de ${escapeHtml(a.name)}${isDispute ? ' (da garagem, sem Crítica)' : ''}</span>
      <div class="moto-opts" data-rc="aMoto">${motos.map((m) => motoOptionHtml(m, m.uid === race.aUid)).join('') || '<p class="hint">Sem motas que possam correr.</p>'}</div>`;
  }

  if (isDispute) {
    const occ = getMoto(race.opp, race.bUid);
    html += `
      <span class="field-label">Dono da vaga: ${playerTag(race.opp)}</span>
      <div class="moto-opts">${motoOptionHtml(occ, true)}</div>`;
    if (a && !raceEligible(a).length) {
      html += `<p class="hint t-yellow">Sem mota sem Crítica na garagem: ${escapeHtml(a.name)} só pode pagar a taxa de 10% (${formatMoney(vagaFee(race.casa))}).</p>`;
    }
  } else if (a) {
    html += `
      <span class="field-label">Contra</span>
      <div class="chips chips-fill" data-rc="opp">
        <button type="button" class="chip ${race.opp === 'bank' ? 'is-active' : ''}" data-pick="bank">🏦 Banco</button>
        ${playerChipsHtml(activePlayers().filter((p) => p.id !== a.id), race.opp)}
      </div>`;
    if (opp) {
      html += `
        <span class="field-label">Mota de ${escapeHtml(opp.name)}</span>
        <div class="moto-opts" data-rc="bMoto">${raceEligible(opp).map((m) => motoOptionHtml(m, m.uid === race.bUid)).join('') || '<p class="hint">Sem motas que possam correr.</p>'}</div>`;
    }
  }

  if (aMoto && race.opp && (race.opp === 'bank' || bMoto)) {
    html += `<p class="rc-dice">🎲 ${escapeHtml(a.name)}: ${diceText(aMoto)} · ${race.opp === 'bank' ? `Banco: ${diceText(aMoto)}` : `${escapeHtml(opp.name)}: ${diceText(bMoto)}`}</p>`;
    if (!isDispute) {
      html += `
        <span class="field-label">Aposta (máximo ${formatMoney(cap)}${race.opp === 'bank' ? ` · limite ${cardOf(aMoto).raridade}` : ' · saldo do mais pobre'})</span>
        <div class="bet-row">
          <span class="input-money"><input id="rcBet" type="text" inputmode="numeric" placeholder="0" value="${race.bet ? formatNumber(race.bet) : ''}"><span class="input-suffix">€</span></span>
          <button type="button" class="btn" data-rc-max>Máx.</button>
        </div>`;
    }
    const bName = race.opp === 'bank' ? '🏦 Banco' : escapeHtml(opp.name);
    html += `
      <span class="field-label">Quem ganhou?</span>
      <div class="chips chips-fill" data-rc="winner">
        <button type="button" class="chip ${race.winner === 'a' ? 'is-active' : ''}" data-pick="a">${escapeHtml(a.name)}</button>
        <button type="button" class="chip ${race.winner === 'b' ? 'is-active' : ''}" data-pick="b">${bName}</button>
        <button type="button" class="chip ${race.winner === 'tie' ? 'is-active' : ''}" data-pick="tie">Empate total</button>
      </div>`;
    if (!isDispute && race.winner && race.winner !== 'tie') {
      html += `
        <span class="field-label">Mão vencedora</span>
        <div class="choice-grid" data-rc="tier">
          ${HAND_TIERS.map((t) => `<button type="button" class="choice-btn tone-${t.tone} ${race.tier === t.value ? 'is-active' : ''}" data-pick="${t.value}"><span class="choice-title">${t.title}</span><span class="choice-sub">${t.sub}</span></button>`).join('')}
        </div>`;
    }
    html += `<button type="button" class="btn btn-primary btn-xl rc-submit" data-rc-submit ${raceReady() ? '' : 'disabled'}>Registar resultado</button>`;
  }

  $('#rcBody').innerHTML = html;
  const betInput = $('#rcBet');
  if (betInput) {
    bindMoneyInput(betInput, (n) => {
      race.bet = n;
      $('[data-rc-submit]').disabled = !raceReady();
    });
  }
}

const vagaFee = (casa) => {
  const occ = slotOccupant(casa);
  return occ ? Math.round(appIncome(occ.moto) * VAGA_FEE_PCT / 100) : 0;
};

async function submitRace() {
  if (!raceReady() || !guardDoubleTap()) return;
  const a = getPlayer(race.aId);
  const aMoto = getMoto(a.id, race.aUid);
  const aCard = cardOf(aMoto);

  if (race.mode === 'race') {
    const bet = race.bet;
    const tierLabel = race.tier ? HAND_TIERS.find((t) => t.value === race.tier).title : '';
    if (race.winner === 'tie') {
      addSystemLog(`🏁 Corrida empatada (${a.name}): aposta anulada.`);
      refresh();
    } else if (race.opp === 'bank') {
      if (race.winner === 'a') {
        const total = bet + (race.tier === 'mid' ? RACE_BONUS_MID : 0) + (race.tier === 'high' ? bet : 0);
        transact(a.id, total, `Corrida ganha ao Banco · ${tierLabel}`);
      } else {
        transact(a.id, -bet, 'Corrida perdida para o Banco');
      }
    } else {
      const b = getPlayer(race.opp);
      const [winner, loser] = race.winner === 'a' ? [a, b] : [b, a];
      transfer(loser.id, winner.id, bet, `Aposta de corrida · ${tierLabel}`);
      if (race.tier === 'mid') transact(winner.id, RACE_BONUS_MID, 'Bónus do Banco (Trio / Full House)');
      if (race.tier === 'high') transact(winner.id, bet, 'Bónus do Banco (Sequência, Quadra ou Poker)');
    }
  } else {
    const owner = getPlayer(race.opp);
    const ownerMoto = getMoto(owner.id, race.bUid);
    if (race.winner === 'a') {
      ownerMoto.app = null;
      addSystemLog(`⚔️ ${a.name} ganhou a disputa da ${slotLabel(race.casa)}: ${motoLabel(cardOf(ownerMoto))} de ${owner.name} foi expulsa.`);
      refresh();
      notify(`⚔️ ${motoLabel(cardOf(ownerMoto))} sai da ${slotLabel(race.casa)}. Devolve a carta a ${owner.name}.`);
      if (a.licenseTurns > 0) {
        toast(`${a.name} tem a carta apreendida: não pode ocupar a vaga.`, true, 4000);
      } else {
        const laps = await choiceDialog(`Ocupar a ${slotLabel(race.casa)}?`, `Com ${motoLabel(aCard)}. Lança 1 dado para o contrato.`, [
          ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, title: `🎲 ${n} · ${plural(n, 'volta', 'voltas')}`, tone: 'hot' })),
          { value: 0, title: 'Não ocupar', tone: 'none' },
        ]);
        if (laps) {
          aMoto.app = { casa: race.casa, laps };
          addSystemLog(`📱 ${a.name} pôs ${motoLabel(aCard)} na ${slotLabel(race.casa)} (${plural(laps, 'volta', 'voltas')}).`);
          refresh();
        }
      }
    } else if (race.winner === 'b') {
      const fee = Math.round(appIncome(ownerMoto) * VAGA_FEE_PCT / 100);
      addSystemLog(`⚔️ ${a.name} perdeu a disputa da ${slotLabel(race.casa)}.`);
      if (fee) transfer(a.id, owner.id, fee, `Taxa de vaga · disputa perdida · ${slotLabel(race.casa)}`);
    } else {
      addSystemLog(`⚔️ Disputa da ${slotLabel(race.casa)} empatada: anulada.`);
      refresh();
    }
  }

  // Dado da Polícia: cada jogador que correu; na disputa só quem desafia
  race.police = { [a.id]: { uid: race.aUid, stage: 'roll', text: '' } };
  if (race.mode === 'race' && race.opp !== 'bank') race.police[race.opp] = { uid: race.bUid, stage: 'roll', text: '' };
  race.phase = 'police';
  renderRace();
}

function renderPolice() {
  const rows = Object.entries(race.police).map(([pid, po]) => {
    const p = getPlayer(Number(pid));
    const m = getMoto(p.id, po.uid);
    const label = m ? motoLabel(cardOf(m)) : 'mota';
    let actions = '';
    if (po.stage === 'roll') {
      actions = `
        <div class="police-btns">
          <button type="button" class="btn btn-minus" data-po="1" data-pid="${pid}">1 · 🚨 Polícia</button>
          <button type="button" class="btn btn-transfer" data-po="2" data-pid="${pid}">2 · 💥 Acidente</button>
          <button type="button" class="btn btn-plus" data-po="ok" data-pid="${pid}">3–6 · ✓</button>
        </div>`;
    } else if (po.stage === 'intercept') {
      actions = `
        <p class="hint">${p.licenseTurns > 0 ? '⚖️ Reincidência: está sem carta, as penas duplicam.' : 'Escolhe antes de qualquer outra ação:'}</p>
        <div class="police-btns">
          <button type="button" class="btn" data-po="surrender" data-pid="${pid}">🙌 Entregar-se</button>
          <button type="button" class="btn btn-plus" data-po="escaped" data-pid="${pid}">🏍️ Fugiu (4–6)</button>
          <button type="button" class="btn btn-minus" data-po="caught" data-pid="${pid}">🚔 Fuga falhou (1–3)</button>
        </div>`;
    } else if (po.stage === 'accident') {
      actions = `
        <p class="hint">Tira 1 carta do baralho de avarias:</p>
        <div class="police-btns">
          ${Object.entries(AVARIAS).map(([k, a]) => `<button type="button" class="btn av-btn av-${a.tone}" data-po="av" data-tipo="${k}" data-pid="${pid}">${a.nome}</button>`).join('')}
        </div>`;
    } else {
      actions = `<p class="po-done">${escapeHtml(po.text)}</p>`;
    }
    return `
      <div class="police-row" style="--pc:${p.color}">
        <div class="police-who"><span class="pawn"></span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(label)}</small></div>
        ${actions}
      </div>`;
  }).join('');
  const allDone = Object.values(race.police).every((po) => po.stage === 'done');
  $('#rcBody').innerHTML = `
    <p class="rc-dice">🎲 Dado da Polícia: cada jogador lança 1 dado (o Banco não lança).</p>
    ${rows}
    <button type="button" class="btn btn-primary btn-xl" data-rc-close ${allDone ? '' : 'disabled'}>Concluir</button>`;
}

/** Interceção policial: entregar-se ou fuga falhada (com apreensão da mota). */
function intercept(p, uid, caught) {
  const reincid = p.licenseTurns > 0;
  const recalled = p.motos.filter((m) => m.app);
  recalled.forEach((m) => { m.app = null; });
  p.prisonTurns = reincid ? 2 : 1;
  p.licenseTurns = reincid ? 4 : 2;
  p.jailedThisTurn = true;
  const m = getMoto(p.id, uid);
  if (caught && m) m.apreendida = { pct: reincid ? 40 : 20 };
  const parts = [
    `${plural(p.prisonTurns, 'turno', 'turnos')} sem jogar`,
    `carta apreendida ${plural(p.licenseTurns, 'turno', 'turnos')}`,
  ];
  if (recalled.length) parts.push(`${plural(recalled.length, 'mota saiu', 'motas saíram')} das Apps`);
  if (caught && m) parts.push(`${motoLabel(cardOf(m))} apreendida (resgate ${m.apreendida.pct}%)`);
  addSystemLog(`🚔 ${p.name} ${caught ? 'falhou a fuga' : 'entregou-se'}${reincid ? ' (reincidência)' : ''}: ${parts.join(', ')}.`);
  refresh();
  sfx('siren');
  return `🚔 ${parts.join(' · ')}. Peão para a POLÍCIA (15); se passar pela Partida, recebe só o valor base.`;
}

function policeAction(btn) {
  const pid = Number(btn.dataset.pid);
  const po = race.police[pid];
  const p = getPlayer(pid);
  const action = btn.dataset.po;
  if (action === '1') { po.stage = 'intercept'; sfx('siren'); }
  if (action === '2') po.stage = 'accident';
  if (action === 'ok') { po.stage = 'done'; po.text = '✓ Nada aconteceu.'; }
  if (action === 'av') {
    const m = getMoto(pid, po.uid);
    if (m) addAvariaTo(p, m, btn.dataset.tipo, 'acidente na corrida');
    po.stage = 'done';
    po.text = `💥 Avaria ${AVARIAS[btn.dataset.tipo].nome} na mota da corrida.`;
  }
  if (action === 'escaped') {
    const m = getMoto(pid, po.uid);
    if (m) addAvariaTo(p, m, 'E', 'fuga à polícia');
    po.stage = 'done';
    po.text = '🏍️ Escapou! A mota ganhou 1 avaria Estética.';
  }
  if (action === 'surrender' || action === 'caught') {
    po.stage = 'done';
    po.text = intercept(p, po.uid, action === 'caught');
  }
  renderRace();
}

function initRace() {
  $('#rcBody').addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-rc-close]')) return raceSheet.close();
    if (t.closest('[data-rc-submit]')) return submitRace();
    const po = t.closest('[data-po]');
    if (po) return policeAction(po);
    if (t.closest('[data-rc-max]')) {
      race.bet = raceCap();
      return renderRace();
    }
    const group = t.closest('[data-rc]');
    if (!group) return;
    const pick = t.closest('[data-pick]');
    const opt = t.closest('[data-uid]');
    const kind = group.dataset.rc;
    if (kind === 'a' && pick) { race.aId = Number(pick.dataset.pick); race.aUid = null; if (race.mode === 'race') { race.opp = null; race.bUid = null; } }
    if (kind === 'aMoto' && opt) race.aUid = opt.dataset.uid;
    if (kind === 'opp' && pick) { race.opp = pick.dataset.pick === 'bank' ? 'bank' : Number(pick.dataset.pick); race.bUid = null; }
    if (kind === 'bMoto' && opt) race.bUid = opt.dataset.uid;
    if (kind === 'winner' && pick) race.winner = pick.dataset.pick;
    if (kind === 'tier' && pick) race.tier = pick.dataset.pick;
    if (race.bet > raceCap()) race.bet = raceCap();
    renderRace();
  });
}

/* =========================================================
   9. CASAS DE APLICAÇÕES
   ========================================================= */
const allocSheet = $('#allocSheet');
let alloc = null;

function renderApps() {
  if (!state.started) return;
  $('#appSlots').innerHTML = APP_SLOTS.map((s) => {
    const occ = slotOccupant(s.casa);
    const head = `<div class="slot-head"><b>${s.nome}</b><span>casa ${String(s.casa).padStart(2, '0')}</span></div>`;
    if (!occ) {
      return `<div class="slot-card is-free">${head}
        <p class="slot-free">Vaga livre</p>
        <button type="button" class="btn btn-plus" data-slot="alloc" data-casa="${s.casa}">＋ Alocar mota</button>
      </div>`;
    }
    const card = cardOf(occ.moto);
    const fee = Math.round(appIncome(occ.moto) * VAGA_FEE_PCT / 100);
    return `<div class="slot-card" style="--pc:${occ.player.color}">${head}
      <button type="button" class="slot-moto" data-slot="open" data-casa="${s.casa}">
        <img src="${card.imagem}" alt="" width="120" height="72">
        <span class="moto-info">
          <span class="moto-name">${escapeHtml(card.nome)}</span>
          <span class="slot-owner"><span class="pawn"></span>${escapeHtml(occ.player.name)}</span>
          <span class="moto-values">${formatMoney(appIncome(occ.moto))}/volta · ${plural(occ.moto.app.laps, 'volta', 'voltas')}</span>
        </span>
      </button>
      <div class="slot-actions">
        <button type="button" class="btn btn-sm btn-transfer" data-slot="fee" data-casa="${s.casa}">💶 Taxa ${formatMoney(fee)}</button>
        <button type="button" class="btn btn-sm" data-slot="dispute" data-casa="${s.casa}">⚔️ Disputa</button>
      </div>
    </div>`;
  }).join('');
}

function openAlloc(opts = {}) {
  alloc = { casa: opts.casa || null, playerId: opts.playerId || null, uid: opts.uid || null, laps: null, lockMoto: Boolean(opts.uid) };
  if (!alloc.playerId && !alloc.lockMoto) {
    const cur = currentTurnPlayer();
    if (cur && !cur.licenseTurns && !cur.prisonTurns) alloc.playerId = cur.id;
  }
  renderAlloc();
  allocSheet.showModal();
}

function renderAlloc() {
  const free = APP_SLOTS.filter((s) => !slotOccupant(s.casa));
  const p = getPlayer(alloc.playerId);
  const blockedIds = activePlayers().filter((x) => x.licenseTurns > 0 || x.prisonTurns > 0).map((x) => x.id);
  const motos = p ? p.motos.filter((m) => !m.app && canRace(m)) : [];
  const ready = alloc.casa && p && alloc.uid && alloc.laps;

  $('#alBody').innerHTML = `
    <span class="field-label">Vaga</span>
    <div class="chips" data-al="slot">
      ${free.map((s) => `<button type="button" class="chip ${alloc.casa === s.casa ? 'is-active' : ''}" data-pick="${s.casa}">${slotLabel(s.casa)}</button>`).join('') || '<p class="hint">Todas as vagas estão ocupadas.</p>'}
    </div>
    ${alloc.lockMoto ? '' : `
      <span class="field-label">Jogador</span>
      <div class="chips chips-fill" data-al="player">${playerChipsHtml(activePlayers(), alloc.playerId, blockedIds)}</div>
      ${blockedIds.length ? '<p class="hint">Jogadores presos ou sem carta não podem alocar motas.</p>' : ''}`}
    ${p ? `
      <span class="field-label">Mota (sem Crítica, na garagem)</span>
      <div class="moto-opts" data-al="moto">${motos.map((m) => motoOptionHtml(m, m.uid === alloc.uid)).join('') || '<p class="hint">Sem motas disponíveis.</p>'}</div>` : ''}
    <span class="field-label">Dado do contrato (voltas)</span>
    <div class="chips chips-fill" data-al="laps">
      ${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="chip ${alloc.laps === n ? 'is-active' : ''}" data-pick="${n}">🎲 ${n}</button>`).join('')}
    </div>
    <button type="button" class="btn btn-primary btn-xl al-submit" data-al-submit ${ready ? '' : 'disabled'}>📱 Alocar</button>`;
}

function submitAlloc() {
  const p = getPlayer(alloc.playerId);
  const m = p && getMoto(p.id, alloc.uid);
  if (!m || !alloc.casa || !alloc.laps) return;
  if (slotOccupant(alloc.casa)) return toast('Essa vaga já está ocupada.', true);
  m.app = { casa: alloc.casa, laps: alloc.laps };
  addSystemLog(`📱 ${p.name} pôs ${motoLabel(cardOf(m))} na ${slotLabel(alloc.casa)} (${plural(alloc.laps, 'volta', 'voltas')}).`);
  allocSheet.close();
  refresh();
  toast(`📱 ${motoLabel(cardOf(m))} a trabalhar na ${slotLabel(alloc.casa)}`);
}

async function slotAction(btn) {
  const casa = Number(btn.dataset.casa);
  const action = btn.dataset.slot;
  const cur = currentTurnPlayer();
  if (action === 'alloc') return openAlloc({ casa });
  const occ = slotOccupant(casa);
  if (!occ) return;
  if (action === 'open') return openMotoSheet(occ.player.id, occ.moto.uid);
  if (action === 'fee') {
    openTransfer({
      from: cur && cur.id !== occ.player.id ? cur.id : null,
      to: occ.player.id,
      lockTo: true,
      amount: vagaFee(casa),
      reason: `Taxa de vaga (10%) · ${slotLabel(casa)}`,
      subtitle: `Quem parou na vaga paga 10% do rendimento a ${occ.player.name}`,
    });
  }
  if (action === 'dispute') openRace({ mode: 'dispute', casa, aId: cur && cur.id !== occ.player.id ? cur.id : null });
}

function initApps() {
  $('#appSlots').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-slot]');
    if (btn) slotAction(btn);
  });
  $('#alBody').addEventListener('click', (e) => {
    if (e.target.closest('[data-al-submit]')) return submitAlloc();
    const group = e.target.closest('[data-al]');
    if (!group) return;
    const pick = e.target.closest('[data-pick]');
    const opt = e.target.closest('[data-uid]');
    const kind = group.dataset.al;
    if (kind === 'slot' && pick) alloc.casa = Number(pick.dataset.pick);
    if (kind === 'player' && pick) { alloc.playerId = Number(pick.dataset.pick); alloc.uid = null; }
    if (kind === 'moto' && opt) alloc.uid = opt.dataset.uid;
    if (kind === 'laps' && pick) alloc.laps = Number(pick.dataset.pick);
    renderAlloc();
  });
}

/* =========================================================
   10. TRANSFERÊNCIAS ENTRE JOGADORES
   ========================================================= */
const transferModal = $('#transferModal');
let transferDraft = null;

/**
 * Abre a transferência.
 * opts = { from, to, lockTo, amount, minAmount, reason, subtitle, onDone(fromId, toId, amount) }
 */
function openTransfer(opts = {}) {
  transferDraft = { from: null, to: null, lockTo: false, minAmount: 0, onDone: null, ...opts };
  $('#trAmount').value = opts.amount ? formatNumber(opts.amount) : '';
  $('#trReason').value = opts.reason || '';
  $('#trSubtitle').textContent = opts.subtitle || 'Dinheiro de um jogador para outro';
  renderTransfer();
  transferModal.showModal();
}

function renderTransfer() {
  const d = transferDraft;
  const players = activePlayers();
  const lockedOut = d.lockTo ? players.filter((p) => p.id !== d.to).map((p) => p.id) : [];
  $('#trFrom').innerHTML = playerChipsHtml(players, d.from, d.to ? [d.to] : []);
  $('#trTo').innerHTML = playerChipsHtml(players, d.to, [...(d.from ? [d.from] : []), ...lockedOut]);
  $$('#trReasons [data-reason]').forEach((c) => c.classList.toggle('is-active', c.dataset.reason === $('#trReason').value));

  const amount = parseAmount($('#trAmount').value);
  const from = getPlayer(d.from);
  const to = getPlayer(d.to);
  const summary = $('#trSummary');
  summary.classList.remove('error');
  if (!from || !to || !amount) {
    summary.textContent = 'Escolhe quem paga, quem recebe e o valor.';
  } else if (amount < d.minAmount) {
    summary.textContent = `O valor mínimo é ${formatMoney(d.minAmount)}.`;
    summary.classList.add('error');
  } else {
    const after = from.balance - amount;
    summary.innerHTML = `${playerTag(from.id)} paga <b>${formatMoney(amount)}</b> a ${playerTag(to.id)}` +
      ` · saldo de ${escapeHtml(from.name)} fica <b class="${after < 0 ? 'is-negative' : ''}">${formatMoney(after)}</b>`;
  }
}

async function confirmTransfer() {
  const d = transferDraft;
  const amount = parseAmount($('#trAmount').value);
  const from = getPlayer(d.from);
  if (!from || !d.to) return toast('Escolhe quem paga e quem recebe.', true);
  if (!amount) {
    restartAnimation($('#trAmount').parentElement, 'shake');
    return toast('Introduz um valor primeiro.', true);
  }
  if (amount < d.minAmount) return toast(`O valor mínimo é ${formatMoney(d.minAmount)}.`, true);
  if (!guardDoubleTap()) return;
  if (amount > from.balance) {
    const ok = await confirmDialog(
      'Saldo insuficiente',
      `${from.name} só tem ${formatMoney(from.balance)}. Pelas regras, tem de vender motas (Falência) antes de pagar. Registar mesmo assim?`,
      'Registar',
    );
    if (!ok) return;
  }

  const reason = $('#trReason').value.trim() || 'Transferência';
  if (!transfer(d.from, d.to, amount, reason)) return;
  transferModal.close();
  toast(`${formatMoney(amount)} de ${from.name} para ${getPlayer(d.to).name}`);
  if (d.onDone) d.onDone(d.from, d.to, amount);
}

function initTransfer() {
  $('#trChips').innerHTML =
    AMOUNT_CHIPS.map((v) => `<button type="button" class="chip" data-chip="${v}">+${formatNumber(v)}</button>`).join('') +
    '<button type="button" class="chip" data-chip="clear">C</button>';
  $('#trReasons').innerHTML = TRANSFER_REASONS
    .map((r) => `<button type="button" class="chip" data-reason="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('');

  const amountInput = $('#trAmount');
  bindMoneyInput(amountInput, renderTransfer);
  bindAmountChips($('#trChips'), amountInput, renderTransfer);

  $('#trFrom').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    transferDraft.from = Number(btn.dataset.pick);
    renderTransfer();
  });
  $('#trTo').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn || transferDraft.lockTo) return;
    transferDraft.to = Number(btn.dataset.pick);
    renderTransfer();
  });
  $('#trReasons').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-reason]');
    if (!chip) return;
    $('#trReason').value = chip.dataset.reason;
    renderTransfer();
  });
  $('#trReason').addEventListener('input', renderTransfer);
  $('#trConfirm').addEventListener('click', confirmTransfer);
  $('#bankTransferBtn').addEventListener('click', () => openTransfer());
}

/* =========================================================
   11. CATÁLOGO DE MOTAS
   ========================================================= */
const motoModal = $('#motoModal');
let motoPickCallback = null;

function searchMotos(query) {
  const q = normalizeText(query.trim().replace(/^#/, ''));
  if (!q) return CATALOG;
  if (/^\d+$/.test(q)) {
    const n = Number(q);
    return CATALOG
      .filter((m) => String(m.id).startsWith(String(n)) || String(m.id).padStart(2, '0').startsWith(q))
      .sort((a, b) => (b.id === n) - (a.id === n) || a.id - b.id);
  }
  return CATALOG.filter((m) =>
    normalizeText(`${m.nome} ${m.raridade} ${m.classica ? 'classica' : ''}`).includes(q));
}

function renderMotoList() {
  const results = searchMotos($('#motoSearch').value);
  $('#motoList').innerHTML = results.map((m) => {
    const owner = state.started ? ownerOfCard(m.id) : null;
    return `
    <li>
      <button type="button" class="moto-row" data-moto="${m.id}">
        <img src="${m.imagem}" alt="" width="120" height="72" loading="lazy">
        <span class="moto-info">
          <span class="moto-name"><span class="moto-num">${cardNum(m.id)}</span> ${escapeHtml(m.nome)}</span>
          <span class="moto-badges">${rarityBadges(m)}${owner ? `<span class="rar rar-owner" style="--rar:${owner.color}">${escapeHtml(owner.name)}</span>` : ''}</span>
          <span class="moto-values">Compra ${formatMoney(m.aquisicao)} · Venda ${formatMoney(m.venda)} · Apps ${formatMoney(m.apps)}</span>
        </span>
      </button>
    </li>`;
  }).join('') || '<li class="log-empty">Nenhuma mota encontrada.</li>';
}

function openMotoPicker(onPick) {
  motoPickCallback = onPick;
  $('#motoSearch').value = '';
  renderMotoList();
  motoModal.showModal();
  $('#motoSearch').focus();
}

function pickMoto(id) {
  const moto = CATALOG.find((m) => m.id === id);
  if (!moto) return;
  motoModal.close();
  if (motoPickCallback) motoPickCallback(moto);
}

function initMotoPicker() {
  $('#motoSearch').addEventListener('input', renderMotoList);
  $('#motoSearch').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const results = searchMotos(e.target.value);
    const q = e.target.value.trim().replace(/^#/, '');
    const exact = /^\d+$/.test(q) && results.find((m) => m.id === Number(q));
    if (exact || results.length === 1) pickMoto((exact || results[0]).id);
  });
  $('#motoList').addEventListener('click', (e) => {
    const row = e.target.closest('[data-moto]');
    if (row) pickMoto(Number(row.dataset.moto));
  });
}

/* =========================================================
   12. SCANNER DE QR CODE
   ========================================================= */
const scanModal = $('#scanModal');
let qrScanner = null;
let scanContext = null;
let scanHandled = false;
let lastInvalidAt = 0;

function ensureQrLib() {
  if (window.Html5Qrcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = QR_LIB_CDN;
    s.onload = () => (window.Html5Qrcode ? resolve() : reject(new Error('qr-lib')));
    s.onerror = () => reject(new Error('qr-lib'));
    document.head.appendChild(s);
  });
}

function setScanMsg(text, isError = false) {
  const el = $('#scanMsg');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function cameraErrorMessage(err) {
  const msg = String(err && (err.name || err.message) ? `${err.name} ${err.message}` : err);
  if (msg.includes('insecure')) return '⚠️ A câmara só funciona em HTTPS ou localhost. Usa a escolha manual abaixo.';
  if (msg.includes('qr-lib')) return '⚠️ Biblioteca do scanner indisponível. Usa a escolha manual abaixo.';
  if (/NotAllowed|Permission/i.test(msg)) return '⚠️ Permissão da câmara negada. Autoriza a câmara nas definições do browser.';
  if (/NotFound|Requested device not found|DevicesNotFound/i.test(msg)) return '⚠️ Nenhuma câmara encontrada neste dispositivo.';
  if (/NotReadable|in use/i.test(msg)) return '⚠️ A câmara está a ser usada por outra aplicação.';
  return '⚠️ Não foi possível iniciar a câmara. Usa a escolha manual abaixo.';
}

/**
 * Abre o scanner.
 * ctx = { mode: 'open' }                               → abre a ficha do jogador
 * ctx = { mode: 'credit', amount, reason }             → credita o valor e abre a ficha
 */
async function openScanner(ctx = { mode: 'open' }) {
  unlockAudio();
  scanContext = ctx;
  scanHandled = false;

  const isCredit = ctx.mode === 'credit';
  $('#scanTitle').textContent = isCredit ? `Creditar ${formatMoney(ctx.amount)}` : 'Ler Cartão';
  $('#scanSubtitle').textContent = isCredit
    ? 'Lê o cartão do jogador que vendeu a mota'
    : 'Aponta a câmara para o QR Code do cartão';
  $('#scanManual').innerHTML = playerChipsHtml(activePlayers(), null);

  setScanMsg('A iniciar a câmara…');
  scanModal.showModal();

  try {
    if (!window.isSecureContext) throw new Error('insecure');
    await ensureQrLib();
    if (!scanModal.open) return;

    const scanner = new Html5Qrcode('reader', {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    qrScanner = scanner;
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 12,
        qrbox: (w, h) => {
          const size = Math.max(150, Math.floor(Math.min(w, h) * 0.72));
          return { width: size, height: size };
        },
      },
      onScanSuccess,
      () => { /* frame sem QR: ignorar */ },
    );
    // O utilizador pode ter fechado o modal enquanto a câmara arrancava
    if (!scanModal.open || qrScanner !== scanner) {
      await stopScanner(scanner);
      return;
    }
    setScanMsg('Aponta a câmara para o QR Code do cartão.');
  } catch (err) {
    if (scanModal.open) setScanMsg(cameraErrorMessage(err), true);
    await stopScanner();
  }
}

async function stopScanner(instance = qrScanner) {
  if (!instance) return;
  if (instance === qrScanner) qrScanner = null;
  try { if (instance.isScanning) await instance.stop(); } catch { /* já parado */ }
  try { instance.clear(); } catch { /* nada a limpar */ }
}

function parsePlayerCode(text) {
  const match = String(text).trim().toUpperCase().match(/^MOTO_PLAYER_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function onScanSuccess(decodedText) {
  if (scanHandled) return;
  const id = parsePlayerCode(decodedText);
  const player = id && getPlayer(id);

  if (!player || player.eliminated) {
    // Evita repetir o erro a cada frame enquanto o código inválido está à frente da câmara
    if (Date.now() - lastInvalidAt > 1500) {
      lastInvalidAt = Date.now();
      sfx('error');
      setScanMsg(id
        ? `Cartão ${QR_PREFIX}${id} não está neste jogo.`
        : `Código não reconhecido: "${String(decodedText).slice(0, 32)}"`, true);
    }
    return;
  }

  scanHandled = true;
  sfx('scan');
  completeScan(player.id);
}

async function completeScan(playerId) {
  const ctx = scanContext;
  scanContext = null;
  await stopScanner();
  if (scanModal.open) scanModal.close();

  openPlayer(playerId);
  if (ctx && ctx.mode === 'credit') {
    if (transact(playerId, ctx.amount, ctx.reason)) {
      toast(`${formatMoney(ctx.amount)} creditados a ${getPlayer(playerId).name}`);
      resetAuction();
    }
  }
}

function initScanner() {
  $('#scanBtn').addEventListener('click', () => openScanner({ mode: 'open' }));

  $('#scanManual').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn || scanHandled) return;
    scanHandled = true;
    completeScan(Number(btn.dataset.pick));
  });

  scanModal.addEventListener('close', () => { stopScanner(); });
}

/* =========================================================
   13. VENDA NO LEILÃO
   ========================================================= */
const auctionForm = $('#auctionForm');
let auctionFinal = 0;
let auctionMoto = null;
/** Venda de uma mota da garagem: { sellerId, uid } */
let auctionCtx = null;

function renderAuctionMoto() {
  const btn = $('#aucPickMoto');
  if (!auctionMoto) {
    btn.innerHTML = '<span class="moto-pick-empty">🏍️ Escolher mota (nº ou nome)</span>';
  } else {
    const m = auctionMoto;
    btn.innerHTML = `
      <img src="${m.imagem}" alt="" width="120" height="72">
      <span class="moto-info">
        <span class="moto-name"><span class="moto-num">${cardNum(m.id)}</span> ${escapeHtml(m.nome)}</span>
        <span class="moto-badges">${rarityBadges(m)}</span>
        <span class="moto-values">Valor de Venda ${formatMoney(m.venda)} · <u>trocar</u></span>
      </span>`;
  }
  const ctxEl = $('#aucCtx');
  ctxEl.hidden = !auctionCtx;
  if (auctionCtx) {
    ctxEl.innerHTML = `<span>Vendedor: ${playerTag(auctionCtx.sellerId)} · a mota sai da garagem ao vender</span>
      <button type="button" class="link-btn" data-auc-ctx-clear>✕</button>`;
  }
}

function calcAuction() {
  const base = parseAmount($('#aucBase').value);
  const dmg1 = Number(auctionForm.elements.dmg1.value);
  const dmg2 = Number(auctionForm.elements.dmg2.value);
  const market = Number(auctionForm.elements.market.value);

  // Valor Ajustado = Valor de Venda × (1 − Avaria 1 − Avaria 2)
  const conditionPct = Math.max(0, 100 - dmg1 - dmg2);
  const adjusted = (base * conditionPct) / 100;

  // Valor base do leilão = Valor Ajustado × resultado dos dados
  const final = Math.round((base * conditionPct * market) / 10000);

  $('#bdBase').textContent = formatMoney(base);
  $('#bdDamage').textContent = dmg1 + dmg2 ? `−${dmg1 + dmg2}%` : '0%';
  $('#bdAdjusted').textContent = formatMoney(adjusted);
  $('#bdFactor').textContent = `× ${(market / 100).toFixed(2).replace('.', ',')}`;

  const out = $('#aucFinal');
  if (final !== auctionFinal) restartAnimation(out, 'pop');
  auctionFinal = final;
  out.textContent = formatMoney(final);
  $('#aucBankBtn').disabled = final <= 0;
  $('#aucPlayerBtn').disabled = final <= 0;
}

function resetAuction() {
  auctionMoto = null;
  auctionCtx = null;
  renderAuctionMoto();
  $('#aucBase').value = '';
  auctionForm.elements.dmg1.value = '0';
  auctionForm.elements.dmg2.value = '0';
  auctionForm.elements.market.value = '100';
  calcAuction();
}

/** Prepara o leilão de uma mota da garagem, já com as avarias dela. */
function startAuctionFor(sellerId, uid) {
  const m = getMoto(sellerId, uid);
  if (!m) return;
  resetAuction();
  auctionCtx = { sellerId, uid };
  auctionMoto = cardOf(m);
  $('#aucBase').value = formatNumber(auctionMoto.venda);
  auctionForm.elements.dmg1.value = String(m.avarias[0] ? AVARIAS[m.avarias[0]].valor : 0);
  auctionForm.elements.dmg2.value = String(m.avarias[1] ? AVARIAS[m.avarias[1]].valor : 0);
  renderAuctionMoto();
  calcAuction();
  $$('dialog[open]').forEach((d) => d.close());
  switchTab('auction');
  toast('Lança os 5 dados e escolhe o resultado.');
}

const auctionReason = (prefix) => `${prefix} · ${auctionMoto ? motoLabel(auctionMoto) : 'mota'}`;

/** Conclui a venda de uma mota da garagem (Banco ou outro jogador). */
function finishGarageSale(buyerId) {
  const { sellerId, uid } = auctionCtx;
  const seller = getPlayer(sellerId);
  const m = getMoto(sellerId, uid);
  if (!m) return;
  const card = cardOf(m);
  if (buyerId) {
    moveMoto(sellerId, uid, buyerId);
    addSystemLog(`🔨 ${motoLabel(card)} passou de ${seller.name} para ${getPlayer(buyerId).name} (Leilão).`);
  } else {
    removeMoto(seller, uid);
    addSystemLog(`🔨 ${seller.name} vendeu ${motoLabel(card)} ao Banco (Leilão). A carta vai para o fundo do baralho.`);
  }
  checkRestauroSale(sellerId, m);
  refresh();
}

function initAuction() {
  $('#aucDmg1').innerHTML = choiceHtml('dmg1', DAMAGE_LEVELS, 0);
  $('#aucDmg2').innerHTML = choiceHtml('dmg2', DAMAGE_LEVELS, 0);
  $('#aucMarket').innerHTML = choiceHtml('market', MARKET_LEVELS, 100);
  renderAuctionMoto();

  $('#aucPickMoto').addEventListener('click', () => openMotoPicker((moto) => {
    auctionCtx = null;
    auctionMoto = moto;
    $('#aucBase').value = formatNumber(moto.venda);
    renderAuctionMoto();
    calcAuction();
  }));

  // Escrever o valor à mão desliga a mota escolhida do catálogo
  bindMoneyInput($('#aucBase'), () => {
    if (auctionMoto) {
      auctionMoto = null;
      auctionCtx = null;
      renderAuctionMoto();
    }
  });
  auctionForm.addEventListener('input', calcAuction);
  auctionForm.addEventListener('change', calcAuction);

  $('#aucClear').addEventListener('click', resetAuction);
  $('#aucCtx').addEventListener('click', (e) => {
    if (!e.target.closest('[data-auc-ctx-clear]')) return;
    auctionCtx = null;
    renderAuctionMoto();
  });

  $('#aucBankBtn').addEventListener('click', () => {
    if (auctionFinal <= 0) return;
    if (auctionCtx) {
      if (!guardDoubleTap()) return;
      const amount = auctionFinal;
      const sellerId = auctionCtx.sellerId;
      finishGarageSale(null);
      transact(sellerId, amount, auctionReason('Venda ao Banco'));
      toast(`🏦 ${formatMoney(amount)} creditados a ${getPlayer(sellerId).name}`);
      resetAuction();
      return;
    }
    openScanner({ mode: 'credit', amount: auctionFinal, reason: auctionReason('Venda ao Banco') });
  });
  $('#aucPlayerBtn').addEventListener('click', () => {
    if (auctionFinal <= 0) return;
    const ctx = auctionCtx;
    openTransfer({
      to: ctx ? ctx.sellerId : null,
      lockTo: Boolean(ctx),
      amount: auctionFinal,
      minAmount: auctionFinal,
      reason: auctionReason('Compra no Leilão'),
      subtitle: 'Quem paga é o comprador; quem recebe é o vendedor. Mínimo: o valor base.',
      onDone: (buyerId) => {
        if (ctx) {
          auctionCtx = ctx;
          finishGarageSale(buyerId);
        }
        resetAuction();
      },
    });
  });

  calcAuction();
}

/* =========================================================
   NAVEGAÇÃO, RESET & ARRANQUE
   ========================================================= */
function switchTab(name) {
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  $$('.tab-panel').forEach((p) => { p.hidden = p.id !== `tab-${name}`; });
  window.scrollTo({ top: 0 });
}

async function resetGame() {
  const ok = await confirmDialog(
    'Reiniciar o jogo?',
    'Todos os saldos, garagens e o histórico serão apagados. Esta ação não pode ser desfeita.',
    'Reiniciar',
  );
  if (!ok) return;
  clearInterval(timerInterval);
  state = freshState(state.lastSetup);
  saveState();
  resetAuction();
  showSetup();
  toast('Jogo reiniciado.');
}

function showSetup() {
  setupDraft = JSON.parse(JSON.stringify({ ...defaultSetup(), ...(state.lastSetup || {}) }));
  renderSetup();
  $('#gameView').hidden = true;
  $('#setupView').hidden = false;
  window.scrollTo({ top: 0 });
}

function showGame() {
  refresh();
  startTimerLoop();
  switchTab('bank');
  $('#setupView').hidden = true;
  $('#gameView').hidden = false;
  keepScreenAwake();
}

/** Mantém o ecrã ligado durante o jogo (quando suportado). */
async function keepScreenAwake() {
  try {
    if (state.started && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      await navigator.wakeLock.request('screen');
    }
  } catch { /* não suportado / recusado */ }
}

function init() {
  initSetup();
  initTurns();
  initPlayerModal();
  initMotoSheet();
  initPartida();
  initStop();
  initRace();
  initApps();
  initTransfer();
  initMotoPicker();
  initScanner();
  initAuction();

  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.goto)));
  $('#playerGrid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-player]');
    if (card) openPlayer(Number(card.dataset.player));
  });
  $('#undoBtn').addEventListener('click', undoLast);
  $('#resetBtn').addEventListener('click', resetGame);
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('#choiceList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-choice]');
    if (btn) choiceModal.close(btn.dataset.choice);
  });

  // Fechar bottom-sheets ao tocar no fundo escurecido
  $$('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) d.close();
  }));

  document.addEventListener('visibilitychange', keepScreenAwake);

  if (state.started) showGame();
  else showSetup();

  // Offline-first: service worker (só funciona em http/https, não em file://)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
