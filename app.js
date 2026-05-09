'use strict';

// ─────────────────────────────────────────────
//  定数
// ─────────────────────────────────────────────
const STORAGE_KEY    = 'household-stock-v1';
const DRIVE_FILE_NAME = 'household-stock-data.json';
const DRIVE_SCOPE    = 'https://www.googleapis.com/auth/drive.file';
const CATEGORIES = [
  { id: 'all',          label: 'すべて', icon: '📋' },
  { id: 'refrigerator', label: '冷蔵庫', icon: '🧊' },
  { id: 'pantry',       label: '常温',   icon: '🏠' },
  { id: 'daily',        label: '日用雑貨', icon: '🧺' },
  { id: 'medicine',     label: '薬',     icon: '💊' },
  { id: 'other',        label: 'その他', icon: '📦' },
];

const SUBCATEGORIES = {
  refrigerator: [
    { id: 'chilled', label: '冷蔵', icon: '🥛' },
    { id: 'frozen',  label: '冷凍', icon: '🧊' },
    { id: 'fresh',   label: '生鮮', icon: '🥬' },
    { id: 'drink',   label: '飲み物', icon: '🧃' },
  ],
  pantry: [
    { id: 'food',      label: '食品', icon: '🍚' },
    { id: 'seasoning', label: '調味料', icon: '🧂' },
    { id: 'snack',     label: 'おやつ', icon: '🍪' },
    { id: 'drink',     label: '飲み物', icon: '☕' },
  ],
  daily: [
    { id: 'paper',    label: '紙類', icon: '🧻' },
    { id: 'cleaning', label: '掃除', icon: '🧽' },
    { id: 'hygiene',  label: '衛生', icon: '🪥' },
    { id: 'bath',     label: 'バス', icon: '🧴' },
  ],
  medicine: [
    { id: 'medicine', label: '薬', icon: '💊' },
    { id: 'firstaid', label: '救急', icon: '🩹' },
    { id: 'care',     label: 'ケア用品', icon: '🌡️' },
  ],
  other: [
    { id: 'stock', label: '備品', icon: '📦' },
    { id: 'pet',   label: 'ペット', icon: '🐾' },
    { id: 'other', label: 'その他', icon: '✨' },
  ],
};

const SORT_OPTIONS = [
  { id: 'priority', label: '期限・在庫優先' },
  { id: 'name',     label: '名前順' },
  { id: 'quantity', label: '在庫少ない順' },
  { id: 'category', label: '分類順' },
  { id: 'date',     label: '日付順' },
];

const UNITS = ['個', '本', '袋', '缶', '箱', '枚', 'セット', 'パック', 'g', 'kg', 'ml', 'L', '冊', '錠', '包'];

const CHAR = {
  arteGentle: 'assets/chibi_inventory_icons/Arte/Arte_01_gentle_standing.png',
  arteSmile: 'assets/chibi_inventory_icons/Arte/Arte_02_smiling_hands.png',
  arteCheck: 'assets/chibi_inventory_icons/Arte/Arte_03_clipboard_check.png',
  arteWave: 'assets/chibi_inventory_icons/Arte/Arte_04_waving.png',
  arteHappy: 'assets/chibi_inventory_icons/Arte/Arte_05_happy_clasped.png',
  arteDone: 'assets/chibi_inventory_icons/Arte/Arte_13_clipboard_done.png',
  arteBasket: 'assets/chibi_inventory_icons/Arte/Arte_09_carrying_basket.png',
  arteBox: 'assets/chibi_inventory_icons/Arte/Arte_06_carrying_supplies_box.png',
  arteSort: 'assets/chibi_inventory_icons/Arte/Arte_11_sorting_boxes.png',
  arteShelf: 'assets/chibi_inventory_icons/Arte/Arte_12_stocking_shelf.png',
  risolArms: 'assets/chibi_inventory_icons/Risol/Risol_01_arms_crossed.png',
  risolSmug: 'assets/chibi_inventory_icons/Risol/Risol_02_smug_pose.png',
  risolComplain: 'assets/chibi_inventory_icons/Risol/Risol_04_complaining.png',
  risolAnnoyed: 'assets/chibi_inventory_icons/Risol/Risol_05_annoyed_arms_crossed.png',
  risolCheck: 'assets/chibi_inventory_icons/Risol/Risol_06_clipboard_check.png',
  risolWarn: 'assets/chibi_inventory_icons/Risol/Risol_10_stop_warning.png',
  risolThink: 'assets/chibi_inventory_icons/Risol/Risol_07_thinking.png',
  risolBox: 'assets/chibi_inventory_icons/Risol/Risol_08_carrying_box.png',
  risolShelf: 'assets/chibi_inventory_icons/Risol/Risol_11_stocking_shelf.png',
  risolSupplies: 'assets/chibi_inventory_icons/Risol/Risol_12_holding_bottle_and_can.png',
  coupleCheck: 'assets/chibi_inventory_icons/Couple/Couple_01_clipboard_together.png',
  coupleList: 'assets/chibi_inventory_icons/Couple/Couple_03_discussing_list.png',
  coupleBasket: 'assets/chibi_inventory_icons/Couple/Couple_05_carrying_basket.png',
};

const CHARACTER_LINES = {
  emptyStock: [
    { speaker: 'arte', text: 'まずはよく使うものから、でどうかな', icon: CHAR.arteWave },
    { speaker: 'arte', text: '目についたものを、少しずつ置いていきましょ。', icon: CHAR.arteGentle },
    { speaker: 'risol', text: '最初は少なくていいよ。続かなかったら意味ないし。', icon: CHAR.risolArms },
  ],
  expiring: [
    { speaker: 'risol', text: count => `期限が近いものが${count}件あるよ。早く補充したほうがいいんじゃない？`, icon: CHAR.risolWarn, tone: 'warn' },
    { speaker: 'risol', text: count => `${count}件、期限が近い。見落としてたわけじゃないよね？`, icon: CHAR.risolComplain, tone: 'warn' },
    { speaker: 'arte', text: count => `期限が近いものが${count}件あるみたい。今日のうちに見ておこっか。`, icon: CHAR.arteCheck, tone: 'warn' },
  ],
  lowStock: [
    { speaker: 'risol', text: count => `在庫少なめが${count}件。あとで困ってもオレ知らないよ？`, icon: CHAR.risolThink, tone: 'warn' },
    { speaker: 'risol', text: count => `${count}件、そろそろ補充したほうがいいんじゃない？`, icon: CHAR.risolAnnoyed, tone: 'warn' },
    { speaker: 'arte', text: count => `少なくなってるものが${count}件あるね。買い物リストも見てみよ。`, icon: CHAR.arteBasket, tone: 'warn' },
  ],
  tidy: [
    { speaker: 'arte', text: 'きれいに整ってるね。この調子で、のんびり続けましょ。', icon: CHAR.arteDone },
    { speaker: 'arte', text: '今日のストック、とっても見やすいね。', icon: CHAR.arteHappy },
    { speaker: 'risol', text: 'まあまあ整ってるじゃん。このまま崩さないでよね。', icon: CHAR.risolSmug },
  ],
  emptyAll: [
    { speaker: 'arte', text: '目についたものからいっこずつ、ね', icon: CHAR.arteBox },
    { speaker: 'arte', text: '最初のひとつ、わたしと一緒に登録しよ。', icon: CHAR.arteWave },
    { speaker: 'risol', text: '空っぽだと管理も何もないでしょ。ひとつ入れよ。', icon: CHAR.risolBox },
  ],
  emptyCategory: [
    { speaker: 'risol', text: 'ここは空っぽ。追加するなら今だよ？', icon: CHAR.risolBox },
    { speaker: 'risol', text: 'この棚、まだ何もないね。別に寂しくはないけど。', icon: CHAR.risolArms },
    { speaker: 'arte', text: 'この種類のもの、見つけたらここに置いておこうね。', icon: CHAR.arteSort },
  ],
  emptyShopping: [
    { speaker: 'arte', text: '必要なものが出たら、わたしが一緒に確認するね', icon: CHAR.arteBasket },
    { speaker: 'arte', text: '買うものがない日は、ちょっと安心だね。', icon: CHAR.arteHappy },
    { speaker: 'risol', text: '今は買い物なし。余計なもの買わなくて済むじゃん。', icon: CHAR.risolSmug },
  ],
  idle: [
    { speaker: 'arte', text: 'ひと休み中かな？無理しないでね。', icon: CHAR.arteGentle },
    { speaker: 'risol', text: 'ちょっと、開いたまま忘れてない？', icon: CHAR.risolComplain },
    { speaker: 'arte', text: '戻ってきたら、続きからで大丈夫だよ。', icon: CHAR.arteWave },
  ],
  return: [
    { speaker: 'arte', text: 'おかえり。続き、見ていこっか。', icon: CHAR.arteWave },
    { speaker: 'risol', text: '戻ってきたんだ。じゃ、確認するよ。', icon: CHAR.risolCheck },
    { speaker: 'arte', text: 'また来てくれてうれしいな。', icon: CHAR.arteSmile },
  ],
  stockTab: [
    { speaker: 'risol', text: '在庫チェックね。見落とし、ないように。', icon: CHAR.risolCheck },
    { speaker: 'arte', text: '今あるものを、ゆっくり見ていこうね。', icon: CHAR.arteShelf },
  ],
  shoppingTab: [
    { speaker: 'arte', text: '買い物リスト、一緒に確認するね。', icon: CHAR.arteBasket },
    { speaker: 'risol', text: '買い忘れ、あとで言い訳しないでよ？', icon: CHAR.risolSupplies },
  ],
  settingsTab: [
    { speaker: 'arte', text: '設定は焦らずで大丈夫だよ。', icon: CHAR.arteCheck },
    { speaker: 'risol', text: '同期まわり、ちゃんと見といたほうがいいよ。', icon: CHAR.risolThink },
  ],
};

// ─────────────────────────────────────────────
//  状態
// ─────────────────────────────────────────────
let state           = loadState();
let currentTab      = 'stock';
let currentCategory = 'all';
let currentSubcategory = 'all';
let currentSort = 'priority';
let driveToken      = null;
let driveTokenExpiresAt = 0;
let driveTokenClient = null;
let saveTimer       = null;
let editingItemId   = null;
let idleTimer       = null;
let peekTimer       = null;
let lastPeekAt      = 0;
let wasAway         = false;

// ─────────────────────────────────────────────
//  状態の永続化
// ─────────────────────────────────────────────
function createInitialState() {
  return {
    items: [],
    shoppingList: [],
    settings: { driveClientId: '', driveFileId: null },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const s = JSON.parse(raw);
    if (!s.settings)      s.settings = { driveClientId: '', driveFileId: null };
    if (!s.shoppingList)  s.shoppingList = [];
    if (!s.items)         s.items = [];
    s.items.forEach(normalizeItem);
    return s;
  } catch {
    return createInitialState();
  }
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveState() {
  persistLocal();
}

// ─────────────────────────────────────────────
//  Google Drive 連携
// ─────────────────────────────────────────────
function hasDriveToken() {
  return Boolean(driveToken && Date.now() < driveTokenExpiresAt - 60000);
}

function ensureDriveToken(forceConsent = false) {
  if (!forceConsent && hasDriveToken()) return Promise.resolve(driveToken);
  const clientId = state.settings.driveClientId;
  if (!clientId) return Promise.reject(new Error('Client ID が設定されていません'));
  if (!window.google?.accounts?.oauth2)
    return Promise.reject(new Error('Google Identity Services が読み込まれていません'));

  return new Promise((resolve, reject) => {
    // Client IDが変わった場合は再生成
    if (!driveTokenClient) {
      driveTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback(response) {
          if (response.error) { reject(new Error(response.error)); return; }
          driveToken = response.access_token;
          driveTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
          resolve(driveToken);
        },
        error_callback() { reject(new Error('Drive 認証がキャンセルされました')); },
      });
    }
    // 初回接続は必ず同意画面を出す、以降はサイレント
    driveTokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
  });
}

async function driveGet(url) {
  const token = await ensureDriveToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  return res;
}

async function findDriveFile() {
  const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
  const res = await driveGet(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`
  );
  const data = await res.json();
  return data.files?.[0] || null;
}

async function loadFromDrive() {
  try {
    const token = await ensureDriveToken();
    let fileId = state.settings.driveFileId;
    if (!fileId) {
      const file = await findDriveFile();
      if (!file) { showToast('Driveにデータがありません。新規保存します'); return; }
      fileId = file.id;
      state.settings.driveFileId = fileId;
      persistLocal();
    }
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.items        = data.items        || [];
    state.shoppingList = data.shoppingList || [];
    state.items.forEach(normalizeItem);
    persistLocal();
    renderAll();
    showToast('☁️ Driveから読み込みました');
  } catch (e) {
    console.warn('Drive load:', e);
    showToast('Drive読み込み失敗: ' + e.message, true);
  }
}

async function saveToDrive() {
  if (!state.settings.driveClientId) return;
  try {
    const token = await ensureDriveToken();
    const payload  = JSON.stringify({ items: state.items, shoppingList: state.shoppingList });
    const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('media',    new Blob([payload],                  { type: 'application/json' }));

    const fileId = state.settings.driveFileId;
    const url    = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
    const method = fileId ? 'PATCH' : 'POST';

    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body: form });
    if (res.status === 404) {
      // ファイルが削除されていたら再作成
      state.settings.driveFileId = null;
      persistLocal();
      return saveToDrive();
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    if (result.id && result.id !== state.settings.driveFileId) {
      state.settings.driveFileId = result.id;
      persistLocal();
    }
    updateSyncIcon('saved');
  } catch (e) {
    console.warn('Drive save:', e);
    updateSyncIcon('error');
  }
}

function scheduleDriveSave() {
  if (!state.settings.driveClientId) return;
  updateSyncIcon('saved');
}

// ─────────────────────────────────────────────
//  ユーティリティ
// ─────────────────────────────────────────────
function uid() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date(todayStr())) / 86400000);
}

function expiryClass(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null)  return '';
  if (d < 0)       return 'expired';
  if (d <= 3)      return 'expiring-soon';
  if (d <= 7)      return 'expiring-week';
  return '';
}

function expiryLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null)  return '';
  if (d < 0)       return `期限切れ（${Math.abs(d)}日前）`;
  if (d === 0)     return '今日が期限';
  if (d === 1)     return '明日が期限';
  return `あと${d}日`;
}

function catInfo(id) {
  const normalized = id === 'bathroom' ? 'daily' : id;
  return CATEGORIES.find(c => c.id === normalized) || CATEGORIES[CATEGORIES.length - 1];
}

function subcategoryList(category) {
  return SUBCATEGORIES[catInfo(category).id] || SUBCATEGORIES.other;
}

function defaultSubcategory(category) {
  return subcategoryList(category)[0]?.id || 'other';
}

function subcatInfo(category, subcategory) {
  return subcategoryList(category).find(s => s.id === subcategory) || subcategoryList(category)[0] || { id: 'other', label: 'その他', icon: '✨' };
}

function normalizeItem(item) {
  if (!item) return item;
  if (item.category === 'bathroom') item.category = 'daily';
  if (!item.category) item.category = 'other';
  item.category = catInfo(item.category).id;
  if (!item.subcategory) item.subcategory = defaultSubcategory(item.category);
  if (item.category === 'daily' && item.subcategory === 'other') item.subcategory = 'bath';
  if (!item.dateType) item.dateType = 'expiry';
  if (item.dateType !== 'start') item.dateType = 'expiry';
  if (!item.stockMode) item.stockMode = 'count';
  if (item.stockMode !== 'amount') item.stockMode = 'count';
  if (item.stockMode === 'amount') {
    item.amountPercent = Number.isFinite(Number(item.amountPercent))
      ? Math.min(100, Math.max(0, Number(item.amountPercent)))
      : 100;
  }
  return item;
}

function itemDate(item) {
  return item.expiryDate || item.date || null;
}

function itemDateClass(item) {
  if (!itemDate(item) || item.dateType === 'start') return '';
  return expiryClass(itemDate(item));
}

function itemDateLabel(item) {
  const date = itemDate(item);
  if (!date) return '';
  if (item.dateType === 'start') {
    const d = daysUntil(date);
    if (d === null) return '';
    if (d === 0) return '今日から使用';
    if (d < 0) return `使用開始から${Math.abs(d)}日`;
    return `使用開始予定: あと${d}日`;
  }
  return expiryLabel(date);
}

function itemStockLabel(item) {
  if (item.stockMode === 'amount') {
    const amount = Number.isFinite(Number(item.amountPercent)) ? Math.round(Number(item.amountPercent)) : 0;
    return `<span class="amount-left">残${amount}%</span><span class="amount-plus">+</span>${esc(item.quantity)}<span class="qty-unit">${esc(item.unit)}</span>`;
  }
  return `${esc(item.quantity)}<span class="qty-unit">${esc(item.unit)}</span>`;
}

function isItemLow(item) {
  const countLow = item.minQuantity > 0 && item.quantity <= item.minQuantity;
  // 残量モード: 在庫0 かつ 残量% が閾値以下でリスト入り
  const threshold = Number.isFinite(Number(item.minAmountPercent)) ? Number(item.minAmountPercent) : 10;
  const amountLow = item.stockMode === 'amount'
    && item.quantity <= 0
    && Number(item.amountPercent ?? 100) <= threshold;
  return countLow || amountLow;
}

function $(id)  { return document.getElementById(id); }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function lineText(line, value) {
  return typeof line.text === 'function' ? line.text(value) : line.text;
}

function lineFor(key, value) {
  const line = pick(CHARACTER_LINES[key]);
  return { ...line, text: lineText(line, value) };
}

function showToast(msg, isError = false) {
  const el = $('toast');
  const speaker = isError ? 'risol' : 'arte';
  const icon = isError ? CHAR.risolWarn : CHAR.arteDone;
  el.innerHTML = `
    <img class="toast-avatar" src="${icon}" alt="">
    <span class="toast-message">${esc(msg)}</span>`;
  el.className = `toast show ${speaker}` + (isError ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function characterLine(speaker, text, icon, tone = '') {
  return `
    <div class="character-tip-inner ${speaker} ${tone}">
      <img class="character-avatar" src="${icon}" alt="">
      <div class="speech">
        <p>${esc(text)}</p>
      </div>
    </div>`;
}

function renderCharacterTip() {
  const el = $('characterTip');
  if (!el) return;
  const lowCount = state.items.filter(isItemLow).length;
  const expiryCount = state.items.filter(i => {
    const d = daysUntil(i.expiryDate);
    return d !== null && d <= 3;
  }).length;
  const line = !state.items.length ? lineFor('emptyStock')
    : expiryCount ? lineFor('expiring', expiryCount)
    : lowCount ? lineFor('lowStock', lowCount)
    : lineFor('tidy');
  el.innerHTML = characterLine(line.speaker, line.text, line.icon, line.tone || '');
}

function updateSyncIcon(status) {
  const btn = $('syncBtn');
  if (!btn) return;
  btn.textContent = { saved: '☁️', pending: '⏳', error: '⚠️' }[status] || '☁️';
  btn.title       = { saved: '同期済み', pending: '保存中…', error: '同期エラー（タップで再試行）' }[status] || '';
}

// ─────────────────────────────────────────────
//  在庫不足 → 買い物リスト自動追加
// ─────────────────────────────────────────────
function syncAutoShoppingItems() {
  const lowItems = state.items.filter(isItemLow);
  for (const item of lowItems) {
    const already = state.shoppingList.find(s => s.itemId === item.id && !s.checked);
    if (!already) {
      state.shoppingList.push({
        id: uid(), itemId: item.id,
        name: item.name,
        quantity: Math.max(1, item.minQuantity - item.quantity + 1),
        unit: item.unit,
        checked: false,
        addedAt: new Date().toISOString(),
        auto: true,
      });
    }
  }
}

// ─────────────────────────────────────────────
//  レンダリング
// ─────────────────────────────────────────────
function renderAll() {
  if (currentTab === 'stock')    renderStock();
  if (currentTab === 'shopping') renderShopping();
  if (currentTab === 'settings') renderSettings();
}

function compareItems(a, b) {
  const lowA = isItemLow(a) ? 0 : 1;
  const lowB = isItemLow(b) ? 0 : 1;
  const dateA = daysUntil(a.dateType === 'start' ? null : itemDate(a)) ?? 9999;
  const dateB = daysUntil(b.dateType === 'start' ? null : itemDate(b)) ?? 9999;
  if (currentSort === 'name') return a.name.localeCompare(b.name, 'ja');
  if (currentSort === 'quantity') {
    const amountA = a.stockMode === 'amount' ? Number(a.amountPercent ?? 100) : 100;
    const amountB = b.stockMode === 'amount' ? Number(b.amountPercent ?? 100) : 100;
    return (amountA - amountB) || (a.quantity - b.quantity) || a.name.localeCompare(b.name, 'ja');
  }
  if (currentSort === 'category') {
    return catInfo(a.category).label.localeCompare(catInfo(b.category).label, 'ja')
      || subcatInfo(a.category, a.subcategory).label.localeCompare(subcatInfo(b.category, b.subcategory).label, 'ja')
      || a.name.localeCompare(b.name, 'ja');
  }
  if (currentSort === 'date') {
    const rawA = itemDate(a) || '9999-12-31';
    const rawB = itemDate(b) || '9999-12-31';
    return rawA.localeCompare(rawB) || a.name.localeCompare(b.name, 'ja');
  }
  return dateA - dateB || lowA - lowB || a.name.localeCompare(b.name, 'ja');
}

function renderSubcategoryChips() {
  const chips = $('subcatChips');
  if (!chips) return;
  if (currentCategory === 'all') {
    chips.innerHTML = '';
    chips.classList.add('hidden');
    currentSubcategory = 'all';
    return;
  }
  chips.classList.remove('hidden');
  const options = [{ id: 'all', label: 'すべて', icon: '✨' }, ...subcategoryList(currentCategory)];
  chips.innerHTML = options.map(s =>
    `<button class="subcat-chip ${s.id === currentSubcategory ? 'active' : ''}" data-subcat="${s.id}"
       onclick="switchSubcategory('${s.id}')">${s.icon} ${s.label}</button>`
  ).join('');
}

/* ── 在庫一覧 ── */
function renderStock() {
  renderCharacterTip();
  renderSubcategoryChips();
  const list = $('stockList');
  if (!list) return;

  let items = currentCategory === 'all'
    ? [...state.items]
    : state.items.filter(i => i.category === currentCategory);
  if (currentSubcategory !== 'all') {
    items = items.filter(i => i.subcategory === currentSubcategory);
  }

  items.sort(compareItems);

  if (!items.length) {
    const emptyLine = currentCategory === 'all' ? lineFor('emptyAll') : lineFor('emptyCategory');
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${emptyLine.icon}" alt="">
        <p>${currentCategory === 'all' ? 'まだ品目がありません' : 'この種類の品目はありません'}</p>
        <p class="empty-hint">${esc(emptyLine.text)}</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map(item => {
    const cat   = catInfo(item.category);
    const subcat = subcatInfo(item.category, item.subcategory);
    const expCl = itemDateClass(item);
    const expLb = itemDateLabel(item);
    const isLow = isItemLow(item);
    const alertIcon = expCl === 'expired' || expCl === 'expiring-soon'
      ? pick([CHAR.risolWarn, CHAR.risolComplain, CHAR.arteCheck])
      : isLow ? pick([CHAR.risolThink, CHAR.risolAnnoyed, CHAR.arteBasket]) : '';
    return `
      <div class="item-card cat-${cat.id} ${expCl} ${isLow ? 'low-stock' : ''}" data-id="${item.id}">
        <div class="item-cat-icon">${cat.icon}</div>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-subcat">${subcat.icon} ${esc(subcat.label)}</div>
          ${expLb ? `<div class="item-expiry ${expCl}">${expLb}</div>` : ''}
          ${item.note ? `<div class="item-note">${esc(item.note)}</div>` : ''}
          ${isLow ? `<div class="item-low">⚠️ 在庫少（最小${item.minQuantity}${esc(item.unit)}）</div>` : ''}
        </div>
        ${alertIcon ? `<img class="item-alert-character" src="${alertIcon}" alt="">` : ''}
        <div class="item-qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
          <span class="qty-value ${item.stockMode === 'amount' ? 'amount-mode' : ''}">${itemStockLabel(item)}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}',1)">＋</button>
        </div>
        <button class="item-edit-btn" onclick="openEditItem('${item.id}')" aria-label="編集">✏️</button>
      </div>`;
  }).join('');
}

/* ── 買い物リスト ── */
function renderShopping() {
  syncAutoShoppingItems();
  const list = $('shoppingList');
  if (!list) return;

  if (!state.shoppingList.length) {
    const emptyLine = lineFor('emptyShopping');
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${emptyLine.icon}" alt="">
        <p>買い物リストは空です</p>
        <p class="empty-hint">${esc(emptyLine.text)}</p>
      </div>`;
    return;
  }

  const unchecked = state.shoppingList.filter(s => !s.checked);
  const checked   = state.shoppingList.filter(s => s.checked);

  const row = s => `
    <div class="shop-item ${s.checked ? 'checked' : ''}" data-id="${s.id}">
      <button class="shop-check" onclick="toggleShopItem('${s.id}')">${s.checked ? '✅' : '⬜'}</button>
      <div class="shop-body">
        <span class="shop-name">${esc(s.name)}</span>
        <span class="shop-qty">${s.quantity}${esc(s.unit)}</span>
        ${s.auto ? '<span class="shop-auto">自動</span>' : ''}
      </div>
      <button class="shop-del" onclick="deleteShopItem('${s.id}')" aria-label="削除">🗑️</button>
    </div>`;

  let html = unchecked.map(row).join('');
  if (checked.length) {
    html += `<div class="shop-section-label">購入済み（${checked.length}件）</div>`;
    html += checked.map(row).join('');
  }
  list.innerHTML = html;
}

/* ── 設定 ── */
function renderSettings() {
  const inp = $('settingsClientId');
  if (inp) inp.value = state.settings.driveClientId || '';
  const st = $('driveStatusText');
  if (st) {
    if (hasDriveToken())                   st.textContent = '接続中 ✅';
    else if (state.settings.driveClientId) st.textContent = '未接続';
    else                                   st.textContent = '未設定';
  }
  // インストールボタン表示制御
  const btn    = $('installBtn');
  const status = $('installStatus');
  if (!btn || !status) return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (isStandalone) {
    btn.style.display    = 'none';
    status.style.display = '';
    status.textContent   = '✅ すでにインストール済みです';
  } else if (_installPrompt) {
    btn.style.display    = '';
    status.style.display = 'none';
  } else {
    btn.style.display    = 'none';
    status.style.display = '';
    status.textContent   = 'iPhoneはSafariの「共有 → ホーム画面に追加」からインストールできます。';
  }
}

// ─────────────────────────────────────────────
//  ナビゲーション
// ─────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));

  // FAB 表示制御
  const stockFab   = $('stockFab');
  const shoppingFab = $('shoppingFab');
  if (stockFab)    stockFab.classList.toggle('hidden', tab !== 'stock');
  if (shoppingFab) shoppingFab.classList.toggle('hidden', tab !== 'shopping');

  renderAll();
  const lineKey = { stock: 'stockTab', shopping: 'shoppingTab', settings: 'settingsTab' }[tab];
  if (lineKey) showCharacterPeek(lineFor(lineKey));
}

function switchCategory(cat) {
  currentCategory = cat;
  currentSubcategory = 'all';
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
  renderStock();
}

function switchSubcategory(subcat) {
  currentSubcategory = subcat;
  document.querySelectorAll('.subcat-chip').forEach(c => c.classList.toggle('active', c.dataset.subcat === subcat));
  renderStock();
}

function switchSort(sort) {
  currentSort = sort;
  renderStock();
}

function updateSubcategorySelect(category) {
  const sel = $('itemSubcategory');
  if (!sel) return;
  sel.innerHTML = subcategoryList(category).map(s => `<option value="${s.id}">${s.icon} ${s.label}</option>`).join('');
}

function updateDateTypeLabel() {
  const label = $('itemDateLabel');
  const input = $('itemExpiry');
  if (!label) return;
  const isStart = $('itemDateType')?.value === 'start';
  label.textContent = isStart ? '使用開始日時' : '消費期限';
  if (input) input.type = isStart ? 'datetime-local' : 'date';
}

function updateStockModeFields() {
  const mode = $('itemStockMode')?.value || 'count';
  $('itemAmountRow')?.classList.toggle('hidden', mode !== 'amount');
  $('itemMinAmountRow')?.classList.toggle('hidden', mode !== 'amount');
  // 残量モードに切り替えたとき、最小在庫数の初期値を0にする
  if (mode === 'amount') {
    const minQtyEl = $('itemMinQty');
    if (minQtyEl && (minQtyEl.value === '' || Number(minQtyEl.value) === 1)) {
      minQtyEl.value = '0';
    }
  }
}

// ─────────────────────────────────────────────
//  品目 CRUD
// ─────────────────────────────────────────────
function changeQty(itemId, delta) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  item.quantity = Math.max(0, item.quantity + delta);
  item.updatedAt = new Date().toISOString();
  saveState();
  renderStock();
  // 在庫が最小数以下になったらバッジ更新
  updateShoppingBadge();
}

function openAddItem() {
  editingItemId = null;
  $('modalTitle').textContent = '品目を追加';
  $('itemName').value     = '';
  $('itemCategory').value = currentCategory !== 'all' ? currentCategory : 'refrigerator';
  updateSubcategorySelect($('itemCategory').value);
  $('itemSubcategory').value = currentSubcategory !== 'all' ? currentSubcategory : defaultSubcategory($('itemCategory').value);
  $('itemStockMode').value = 'count';
  $('itemAmountPercent').value = '100';
  $('itemMinAmountPercent').value = '10';
  updateStockModeFields();
  $('itemQty').value      = '1';
  $('itemUnit').value     = '個';
  $('itemMinQty').value   = '1';
  $('itemDateType').value = 'expiry';
  updateDateTypeLabel();
  $('itemExpiry').value   = '';
  $('itemNote').value     = '';
  $('deleteItemBtn').classList.add('hidden');
  openModal('itemModal');
  setTimeout(() => $('itemName').focus(), 80);
}

function openEditItem(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  editingItemId = itemId;
  $('modalTitle').textContent = '品目を編集';
  $('itemName').value     = item.name;
  $('itemCategory').value = item.category;
  updateSubcategorySelect(item.category);
  $('itemSubcategory').value = item.subcategory || defaultSubcategory(item.category);
  $('itemStockMode').value = item.stockMode || 'count';
  $('itemAmountPercent').value = Number.isFinite(Number(item.amountPercent)) ? item.amountPercent : 100;
  $('itemMinAmountPercent').value = Number.isFinite(Number(item.minAmountPercent)) ? item.minAmountPercent : 10;
  updateStockModeFields();
  $('itemQty').value      = item.quantity;
  $('itemUnit').value     = item.unit;
  $('itemMinQty').value   = item.minQuantity;
  $('itemDateType').value = item.dateType || 'expiry';
  updateDateTypeLabel();
  const dateValue = itemDate(item) || '';
  $('itemExpiry').value   = item.dateType === 'start' && dateValue.length === 10 ? `${dateValue}T00:00` : dateValue;
  $('itemNote').value     = item.note || '';
  $('deleteItemBtn').classList.remove('hidden');
  openModal('itemModal');
}

function saveItem() {
  const name = $('itemName').value.trim();
  if (!name) { showToast('品名を入力してください', true); return; }

  const qty    = parseFloat($('itemQty').value)    || 0;
  const minQty = parseFloat($('itemMinQty').value) || 0;
  const now    = new Date().toISOString();

  if (editingItemId) {
    const item = state.items.find(i => i.id === editingItemId);
    if (item) {
      item.name        = name;
      item.category    = $('itemCategory').value;
      item.subcategory = $('itemSubcategory').value || defaultSubcategory(item.category);
      item.stockMode        = $('itemStockMode').value;
      item.amountPercent    = item.stockMode === 'amount' ? Math.min(100, Math.max(0, parseFloat($('itemAmountPercent').value) || 0)) : null;
      item.minAmountPercent = item.stockMode === 'amount' ? Math.min(100, Math.max(0, parseFloat($('itemMinAmountPercent').value) || 10)) : null;
      item.quantity    = qty;
      item.unit        = $('itemUnit').value;
      item.minQuantity = minQty;
      item.dateType    = $('itemDateType').value;
      item.expiryDate  = $('itemExpiry').value || null;
      item.note        = $('itemNote').value.trim();
      item.updatedAt   = now;
    }
  } else {
    state.items.push({
      id: uid(), name,
      category:    $('itemCategory').value,
      subcategory: $('itemSubcategory').value || defaultSubcategory($('itemCategory').value),
      stockMode:        $('itemStockMode').value,
      amountPercent:    $('itemStockMode').value === 'amount' ? Math.min(100, Math.max(0, parseFloat($('itemAmountPercent').value) || 0)) : null,
      minAmountPercent: $('itemStockMode').value === 'amount' ? Math.min(100, Math.max(0, parseFloat($('itemMinAmountPercent').value) || 10)) : null,
      quantity:    qty,
      unit:        $('itemUnit').value,
      minQuantity: minQty,
      dateType:    $('itemDateType').value,
      expiryDate:  $('itemExpiry').value || null,
      note:        $('itemNote').value.trim(),
      createdAt:   now,
      updatedAt:   now,
    });
  }

  closeModal('itemModal');
  saveState();
  renderAll();
  updateShoppingBadge();
  showToast(editingItemId ? '更新しました ✅' : '追加しました ✅');
}

function deleteItem() {
  if (!editingItemId) return;
  if (!confirm('この品目を削除しますか？')) return;
  state.items        = state.items.filter(i => i.id !== editingItemId);
  state.shoppingList = state.shoppingList.filter(s => s.itemId !== editingItemId);
  closeModal('itemModal');
  saveState();
  renderAll();
  showToast('削除しました');
}

// ─────────────────────────────────────────────
//  買い物リスト
// ─────────────────────────────────────────────
function toggleShopItem(shopId) {
  const shop = state.shoppingList.find(s => s.id === shopId);
  if (!shop) return;
  shop.checked = !shop.checked;

  if (shop.itemId) {
    const item = state.items.find(i => i.id === shop.itemId);
    if (item) {
      // チェック→在庫補充 / アンチェック→在庫を戻す
      item.quantity  += shop.checked ? shop.quantity : -shop.quantity;
      item.quantity   = Math.max(0, item.quantity);
      item.updatedAt  = new Date().toISOString();
    }
  }

  saveState();
  renderShopping();
  updateShoppingBadge();
}

function deleteShopItem(shopId) {
  state.shoppingList = state.shoppingList.filter(s => s.id !== shopId);
  saveState();
  renderShopping();
  updateShoppingBadge();
}

function clearCheckedShopItems() {
  state.shoppingList = state.shoppingList.filter(s => !s.checked);
  saveState();
  renderShopping();
  updateShoppingBadge();
  showToast('購入済みを削除しました');
}

function openAddShopItem() {
  $('shopItemName').value = '';
  $('shopItemQty').value  = '1';
  $('shopItemUnit').value = '個';
  openModal('shopModal');
  setTimeout(() => $('shopItemName').focus(), 80);
}

function saveShopItem() {
  const name = $('shopItemName').value.trim();
  if (!name) { showToast('品名を入力してください', true); return; }
  state.shoppingList.push({
    id: uid(), itemId: null, name,
    quantity:  parseFloat($('shopItemQty').value) || 1,
    unit:      $('shopItemUnit').value,
    checked:   false,
    addedAt:   new Date().toISOString(),
    auto:      false,
  });
  closeModal('shopModal');
  saveState();
  renderShopping();
  updateShoppingBadge();
  showToast('追加しました ✅');
}

// 買い物リストの未購入数をタブバッジに表示
function updateShoppingBadge() {
  syncAutoShoppingItems();
  const count = state.shoppingList.filter(s => !s.checked).length;
  const badge = $('shoppingBadge');
  if (!badge) return;
  badge.textContent = count || '';
  badge.classList.toggle('hidden', !count);
}

// ─────────────────────────────────────────────
//  キャラクターのひょっこり演出
// ─────────────────────────────────────────────
function showCharacterPeek(line, force = false) {
  const el = $('characterPeek');
  if (!el || !line) return;
  const now = Date.now();
  if (!force && now - lastPeekAt < 18000) return;
  lastPeekAt = now;
  clearTimeout(peekTimer);
  el.innerHTML = `
    <img class="peek-avatar" src="${line.icon}" alt="">
    <div class="peek-bubble">
      <p>${esc(line.text)}</p>
    </div>`;
  el.className = `character-peek show ${line.speaker}`;
  Object.assign(el.style, {
    position: 'fixed',
    top: `${Math.max(310, window.innerHeight - 170)}px`,
    bottom: 'auto',
    left: `${Math.max(10, (window.innerWidth - 540) / 2 + 10)}px`,
    zIndex: '99999',
    opacity: '1',
    marginLeft: '0',
  });
  setTimeout(() => {
    el.style.left = `${Math.max(10, (window.innerWidth - 540) / 2 + 10)}px`;
  }, 40);
  peekTimer = setTimeout(() => {
    el.classList.remove('show');
    el.style.opacity = '0';
    el.style.marginLeft = '-350px';
  }, 5200);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!document.hidden && !document.querySelector('.modal-overlay.open')) {
      showCharacterPeek(lineFor('idle'));
    }
  }, 45000);
}

function setupCharacterPeek() {
  ['click', 'keydown', 'pointerdown', 'scroll', 'touchstart'].forEach(eventName => {
    document.addEventListener(eventName, resetIdleTimer, { passive: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasAway = true;
      return;
    }
    resetIdleTimer();
    if (wasAway) {
      wasAway = false;
      showCharacterPeek(lineFor('return'), true);
    }
  });
  window.addEventListener('blur', () => { wasAway = true; });
  window.addEventListener('focus', () => {
    resetIdleTimer();
    if (wasAway) {
      wasAway = false;
      showCharacterPeek(lineFor('return'), true);
    }
  });
  resetIdleTimer();
}

// ─────────────────────────────────────────────
//  モーダル
// ─────────────────────────────────────────────
function openModal(id)  {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  $(id).classList.remove('open');
  document.body.style.overflow = '';
}

// オーバーレイタップで閉じる
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ─────────────────────────────────────────────
//  設定 / Drive
// ─────────────────────────────────────────────
function saveSettings() {
  const clientId = $('settingsClientId').value.trim();
  state.settings.driveClientId = clientId;
  state.settings.driveFileId   = null;
  driveToken         = null;
  driveTokenExpiresAt = 0;
  driveTokenClient   = null;
  persistLocal();
  renderSettings();
  showToast('設定を保存しました');
}

async function connectDrive() {
  try {
    await ensureDriveToken(true); // 初回は必ず同意画面を表示
    renderSettings();
    showToast('Drive に接続しました ☁️');
    await loadFromDrive();
  } catch (e) {
    showToast('接続失敗: ' + e.message, true);
  }
}

async function syncNow() {
  if (!state.settings.driveClientId) {
    showToast('設定タブで Drive Client ID を設定してください', true);
    return;
  }
  try {
    updateSyncIcon('pending');
    await saveToDrive();
    showToast('☁️ Driveに保存しました');
  } catch (e) {
    showToast('保存失敗: ' + e.message, true);
  }
}

// ─────────────────────────────────────────────
//  Service Worker
// ─────────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
  }
}

// ─────────────────────────────────────────────
//  PWA インストール
// ─────────────────────────────────────────────
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _installPrompt = e;
  // ボタンを表示
  const btn = $('installBtn');
  if (btn) btn.style.display = '';
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  const btn    = $('installBtn');
  const status = $('installStatus');
  if (btn)    btn.style.display = 'none';
  if (status) { status.style.display = ''; status.textContent = '✅ インストール済みです'; }
});

async function triggerInstall() {
  if (!_installPrompt) {
    // すでにインストール済み or iOSなど非対応
    const status = $('installStatus');
    if (status) {
      status.style.display = '';
      status.textContent = 'iPhoneはSafariの「共有 → ホーム画面に追加」からインストールできます。';
    }
    return;
  }
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === 'accepted') {
    _installPrompt = null;
    const btn = $('installBtn');
    if (btn) btn.style.display = 'none';
  }
}

// ─────────────────────────────────────────────
//  初期化
// ─────────────────────────────────────────────
function init() {
  registerSW();

  // カテゴリチップを生成
  const chips = $('catChips');
  if (chips) {
    chips.innerHTML = CATEGORIES.map(c =>
      `<button class="cat-chip ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}"
         onclick="switchCategory('${c.id}')">${c.icon} ${c.label}</button>`
    ).join('');
  }

  const sortSelect = $('sortSelect');
  if (sortSelect) {
    sortSelect.innerHTML = SORT_OPTIONS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', () => switchSort(sortSelect.value));
  }

  const itemCategory = $('itemCategory');
  if (itemCategory) {
    itemCategory.innerHTML = CATEGORIES.filter(c => c.id !== 'all')
      .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
    itemCategory.addEventListener('change', () => {
      updateSubcategorySelect(itemCategory.value);
      $('itemSubcategory').value = defaultSubcategory(itemCategory.value);
    });
    updateSubcategorySelect(itemCategory.value || 'refrigerator');
  }

  $('itemDateType')?.addEventListener('change', updateDateTypeLabel);
  $('itemStockMode')?.addEventListener('change', updateStockModeFields);

  // ユニット選択肢を生成
  document.querySelectorAll('.unit-select').forEach(sel => {
    sel.innerHTML = UNITS.map(u => `<option value="${u}">${u}</option>`).join('');
  });

  // タブボタン
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 同期ボタン
  $('syncBtn')?.addEventListener('click', syncNow);
  setupCharacterPeek();

  // 初期バッジ
  updateShoppingBadge();

  // 初期描画
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
