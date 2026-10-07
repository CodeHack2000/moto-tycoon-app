/* =========================================================
   MOTO TYCOON · Terminal Bancário & Calculadora de Leilão
   Vanilla JS · offline-first · estado guardado em localStorage
   ========================================================= */
'use strict';

/* ---------- Configuração ---------- */
const STORAGE_KEY = 'motoTycoon.banker.v1';
const QR_PREFIX = 'MOTO_PLAYER_';
const MAX_PLAYERS = 4;
const DEFAULT_BALANCE = 7500;
const QR_LIB_CDN = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

const PAWN_COLORS = ['#2ec4b6', '#ff007f', '#ffd23f', '#9b5de5', '#ff8c42', '#3a86ff', '#7ae582', '#f1f1f1'];

const QUICK_ACTIONS = [
  { amount: 1000, reason: 'Passou na Partida', label: 'Passou na Partida' },
  { amount: -1000, reason: 'STOP / Multa / Fiança', label: 'STOP · Multa · Fiança' },
  { amount: 1500, reason: 'Subvenção de Combustível', label: 'Subvenção Combustível' },
];

const AMOUNT_CHIPS = [100, 500, 1000, 5000];

const DAMAGE_LEVELS = [
  { value: 0, title: 'Nenhuma', sub: '0%', tone: 'none' },
  { value: 10, title: 'Estética', sub: 'Laranja · −10%', tone: 'orange' },
  { value: 25, title: 'Moderada', sub: 'Amarela · −25%', tone: 'yellow' },
  { value: 50, title: 'Crítica', sub: 'Vermelha · −50%', tone: 'red' },
];

const MARKET_LEVELS = [
  { value: 80, title: '80% · Mercado Fraco', sub: 'Sem pares / combinação', tone: 'weak' },
  { value: 100, title: '100% · Oferta Justa', sub: '1 ou 2 pares', tone: 'fair' },
  { value: 120, title: '120% · Comprador Entusiasta', sub: 'Trio, Full House, Sequência ou Poker', tone: 'hot' },
];

const BONUS_PRESETS = [
  { value: 0, label: 'Sem bónus' },
  { value: 20, label: '+20% Clássica' },
  { value: -30, label: '−30% Achado de Garagem' },
];

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
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatTime = (ts) => new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

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
    players: Array.from({ length: MAX_PLAYERS }, (_, i) => ({ name: `Jogador ${i + 1}`, color: PAWN_COLORS[i] })),
  };
}

function freshState(lastSetup = defaultSetup()) {
  return { started: false, startBalance: DEFAULT_BALANCE, players: [], log: [], lastSetup };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.players) && Array.isArray(saved.log)) {
      saved.lastSetup = saved.lastSetup || defaultSetup();
      return saved;
    }
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
    } catch { /* sem áudio */ }
  }
  if (navigator.vibrate) navigator.vibrate(kind === 'error' ? [70, 50, 70] : 40);
}

/* ---------- Toast ---------- */
const toastEl = $('#toast');
let toastTimer = null;

function toast(message, isError = false) {
  // Os <dialog> modais ficam na "top layer": o toast tem de viver dentro do dialog aberto para ser visível.
  const openDialogs = $$('dialog[open]');
  (openDialogs[openDialogs.length - 1] || document.body).appendChild(toastEl);
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ---------- Diálogo de confirmação ---------- */
const confirmModal = $('#confirmModal');

function confirmDialog(title, message, okText = 'Confirmar') {
  $('#confirmTitle').textContent = title;
  $('#confirmMsg').textContent = message;
  $('#confirmOk').textContent = okText;
  confirmModal.returnValue = '';
  confirmModal.showModal();
  return new Promise((resolve) => {
    confirmModal.addEventListener('close', () => resolve(confirmModal.returnValue === 'ok'), { once: true });
  });
}

/* =========================================================
   1. CONFIGURAÇÃO DO JOGO
   ========================================================= */
let setupDraft = null;

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
  });

  $('#setupPlayers').addEventListener('click', (e) => {
    const sw = e.target.closest('[data-color]');
    if (!sw) return;
    const card = sw.closest('.setup-player');
    const i = Number(card.dataset.index);
    setupDraft.players[i].color = sw.dataset.color;
    card.style.setProperty('--pc', sw.dataset.color);
    $$('.swatch', card).forEach((b) => b.setAttribute('aria-pressed', String(b === sw)));
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
  }));

  state = {
    started: true,
    startBalance,
    players,
    log: [],
    lastSetup: { ...setupDraft, startBalance, players: setupDraft.players.map((p) => ({ ...p })) },
  };
  addSystemLog(`Jogo iniciado · ${players.length} jogadores · ${formatMoney(startBalance)} cada`);
  saveState();
  showGame();
  toast('Jogo iniciado. Boa corrida! 🏍️');
}

/* =========================================================
   2. TRANSAÇÕES & HISTÓRICO
   ========================================================= */
let lastActionAt = 0;

function addSystemLog(text) {
  state.log.push({ id: Date.now() + Math.random(), ts: Date.now(), playerId: null, text });
}

/** Aplica um crédito (delta > 0) ou débito (delta < 0) ao jogador. */
function transact(playerId, delta, reason) {
  const player = getPlayer(playerId);
  if (!player || !delta) return false;

  // Proteção contra duplo toque acidental
  const now = Date.now();
  if (now - lastActionAt < 350) return false;
  lastActionAt = now;

  player.balance += delta;
  state.log.push({ id: now + Math.random(), ts: now, playerId, delta, reason, balanceAfter: player.balance });
  saveState();

  sfx(delta > 0 ? 'credit' : 'debit');
  renderPlayers();
  renderLogs();
  if (currentPlayerId === playerId) {
    renderPlayerModal();
    const deltaEl = $('#pmDelta');
    deltaEl.textContent = formatSigned(delta);
    deltaEl.className = 'balance-delta';
    restartAnimation(deltaEl, delta > 0 ? 'up' : 'down');
  }
  return true;
}

async function undoLast() {
  const entry = [...state.log].reverse().find((e) => e.playerId && !e.undone);
  if (!entry) return toast('Não há transações para anular.', true);
  const player = getPlayer(entry.playerId);
  const ok = await confirmDialog(
    'Anular última transação?',
    `${formatSigned(entry.delta)} · ${player ? player.name : '?'} (${entry.reason}). O saldo será reposto.`,
    'Anular',
  );
  if (!ok) return;
  if (player) player.balance -= entry.delta;
  entry.undone = true;
  saveState();
  renderPlayers();
  renderLogs();
  toast('Transação anulada.');
}

function logItemHtml(entry) {
  if (!entry.playerId) {
    return `<li class="log-item system"><span class="log-time">${formatTime(entry.ts)}</span><span class="log-text">${escapeHtml(entry.text)}</span><span></span></li>`;
  }
  const player = getPlayer(entry.playerId);
  const name = player ? player.name : `Jogador ${entry.playerId}`;
  const color = player ? player.color : 'var(--muted)';
  const isCredit = entry.delta > 0;
  const verb = isCredit ? 'creditou' : 'debitou';
  const arrow = isCredit ? '→' : '←';
  return `
    <li class="log-item ${isCredit ? 'credit' : 'debit'} ${entry.undone ? 'undone' : ''}">
      <span class="log-time">${formatTime(entry.ts)}</span>
      <span class="log-text">Banqueiro ${verb} <b>${formatMoney(Math.abs(entry.delta))}</b> ${arrow}
        <b style="color:${color}">${escapeHtml(name)}</b> <em>(${escapeHtml(entry.reason)})</em>${entry.undone ? ' <em>· anulada</em>' : ''}</span>
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
   3. JOGADORES & FICHA DO JOGADOR
   ========================================================= */
const playerModal = $('#playerModal');
let currentPlayerId = null;

function renderPlayers() {
  $('#playerGrid').innerHTML = state.players.map((p) => `
    <button type="button" class="player-card" style="--pc:${p.color}" data-player="${p.id}">
      <span class="pc-top"><span class="pawn"></span><span class="pc-name">${escapeHtml(p.name)}</span></span>
      <span class="pc-balance ${p.balance < 0 ? 'is-negative' : ''}">${formatMoney(p.balance)}</span>
      <span class="pc-code">${p.code}</span>
    </button>`).join('');
}

function openPlayer(id) {
  currentPlayerId = id;
  $('#pmDelta').className = 'balance-delta';
  $('#pmAmount').value = '';
  $('#pmReason').value = '';
  renderPlayerModal();
  if (!playerModal.open) playerModal.showModal();
}

function renderPlayerModal() {
  const p = getPlayer(currentPlayerId);
  if (!p) return;
  playerModal.style.setProperty('--pc', p.color);
  $('#pmName').textContent = p.name;
  $('#pmCode').textContent = `Cartão ${p.code}`;
  const bal = $('#pmBalance');
  bal.textContent = formatMoney(p.balance);
  bal.classList.toggle('is-negative', p.balance < 0);
}

function initPlayerModal() {
  $('#pmQuick').innerHTML = QUICK_ACTIONS.map((a, i) => `
    <button type="button" class="qa ${a.amount > 0 ? 'plus' : 'minus'}" data-quick="${i}">
      ${formatSigned(a.amount)}<small>${a.label}</small>
    </button>`).join('');

  $('#pmChips').innerHTML =
    AMOUNT_CHIPS.map((v) => `<button type="button" class="chip" data-chip="${v}">+${formatNumber(v)}</button>`).join('') +
    '<button type="button" class="chip" data-chip="clear">C</button>';

  $('#pmQuick').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick]');
    if (!btn) return;
    const action = QUICK_ACTIONS[Number(btn.dataset.quick)];
    transact(currentPlayerId, action.amount, action.reason);
  });

  const amountInput = $('#pmAmount');
  bindMoneyInput(amountInput);

  $('#pmChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]');
    if (!chip) return;
    const next = chip.dataset.chip === 'clear' ? 0 : parseAmount(amountInput.value) + Number(chip.dataset.chip);
    amountInput.value = next ? formatNumber(next) : '';
  });

  const applyCustom = (sign) => {
    const amount = parseAmount(amountInput.value);
    if (!amount) {
      restartAnimation(amountInput.parentElement, 'shake');
      return toast('Introduz um valor primeiro.', true);
    }
    const reason = $('#pmReason').value.trim() || (sign > 0 ? 'Crédito manual' : 'Débito manual');
    if (transact(currentPlayerId, sign * amount, reason)) {
      amountInput.value = '';
      $('#pmReason').value = '';
    }
  };
  $('#pmAdd').addEventListener('click', () => applyCustom(1));
  $('#pmSub').addEventListener('click', () => applyCustom(-1));

  playerModal.addEventListener('close', () => { currentPlayerId = null; });
}

/* =========================================================
   4. SCANNER DE QR CODE
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
  $('#scanManual').innerHTML = state.players.map((p) => `
    <button type="button" class="chip chip-player" style="--pc:${p.color}" data-pick="${p.id}">
      <span class="pawn"></span>${escapeHtml(p.name)}
    </button>`).join('');

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

  if (!player) {
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
    lastActionAt = 0;
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
   5. CALCULADORA DE VENDA / LEILÃO
   ========================================================= */
const auctionForm = $('#auctionForm');
let auctionFinal = 0;

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

function calcAuction() {
  const base = parseAmount($('#aucBase').value);
  const dmg1 = Number(auctionForm.elements.dmg1.value);
  const dmg2 = Number(auctionForm.elements.dmg2.value);
  const market = Number(auctionForm.elements.market.value);
  const bonus = clamp(parseInt($('#aucBonus').value, 10) || 0, -100, 200);

  // Valor Ajustado = Preço Base × (1 − Avaria 1 − Avaria 2)
  const conditionPct = Math.max(0, 100 - dmg1 - dmg2);
  const adjusted = (base * conditionPct) / 100;

  // Valor Final = Valor Ajustado × (Multiplicador Leilão + Bónus Extra)
  const factorPct = Math.max(0, market + bonus);
  const final = Math.round((base * conditionPct * factorPct) / 10000);

  $('#bdBase').textContent = formatMoney(base);
  $('#bdDamage').textContent = dmg1 + dmg2 ? `−${dmg1 + dmg2}%` : '0%';
  $('#bdAdjusted').textContent = formatMoney(adjusted);
  $('#bdFactor').textContent = `${market}% ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)}% = × ${(factorPct / 100).toFixed(2).replace('.', ',')}`;

  $$('#aucBonusPresets [data-bonus]').forEach((c) => c.classList.toggle('is-active', Number(c.dataset.bonus) === bonus));

  const out = $('#aucFinal');
  if (final !== auctionFinal) restartAnimation(out, 'pop');
  auctionFinal = final;
  out.textContent = formatMoney(final);
  $('#aucCreditBtn').disabled = final <= 0;
}

function resetAuction() {
  $('#aucBase').value = '';
  auctionForm.elements.dmg1.value = '0';
  auctionForm.elements.dmg2.value = '0';
  auctionForm.elements.market.value = '100';
  $('#aucBonus').value = '0';
  calcAuction();
}

function initAuction() {
  $('#aucDmg1').innerHTML = choiceHtml('dmg1', DAMAGE_LEVELS, 0);
  $('#aucDmg2').innerHTML = choiceHtml('dmg2', DAMAGE_LEVELS, 0);
  $('#aucMarket').innerHTML = choiceHtml('market', MARKET_LEVELS, 100);
  $('#aucBonusPresets').innerHTML = BONUS_PRESETS
    .map((b) => `<button type="button" class="chip" data-bonus="${b.value}">${b.label}</button>`).join('');

  bindMoneyInput($('#aucBase'));
  auctionForm.addEventListener('input', calcAuction);
  auctionForm.addEventListener('change', calcAuction);

  auctionForm.addEventListener('click', (e) => {
    const step = e.target.closest('[data-bonus-step]');
    const preset = e.target.closest('[data-bonus]');
    const bonusInput = $('#aucBonus');
    if (step) bonusInput.value = clamp((parseInt(bonusInput.value, 10) || 0) + Number(step.dataset.bonusStep), -100, 200);
    if (preset) bonusInput.value = preset.dataset.bonus;
    if (step || preset) calcAuction();
  });

  $('#aucClear').addEventListener('click', resetAuction);

  $('#aucCreditBtn').addEventListener('click', () => {
    if (auctionFinal > 0) openScanner({ mode: 'credit', amount: auctionFinal, reason: 'Venda Leilão' });
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
    'Todos os saldos e o histórico serão apagados. Esta ação não pode ser desfeita.',
    'Reiniciar',
  );
  if (!ok) return;
  state = freshState(state.lastSetup);
  saveState();
  resetAuction();
  showSetup();
  toast('Jogo reiniciado.');
}

function showSetup() {
  setupDraft = JSON.parse(JSON.stringify(state.lastSetup || defaultSetup()));
  renderSetup();
  $('#gameView').hidden = true;
  $('#setupView').hidden = false;
  window.scrollTo({ top: 0 });
}

function showGame() {
  renderPlayers();
  renderLogs();
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
  initPlayerModal();
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
