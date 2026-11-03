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
    { id: 'seasoning', label: '調味料', icon: '🧂' },
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
    { id: 'kitchen',  label: 'キッチン', icon: '🍳' },
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

// お気に入りは通常カテゴリではなく、チップ上だけの絞り込み
const FAVORITE_FILTER = { id: 'fav', label: 'お気に入り', icon: '⭐' };

// 在庫は個数ではなく3段階だけで持つ。少ない・なしで買い物リスト入り
const STOCK_LEVELS = [
  { id: 'ok',  label: 'ある' },
  { id: 'low', label: '少ない' },
  { id: 'out', label: 'なし' },
];

const SORT_OPTIONS = [
  { id: 'priority', label: '期限・在庫優先' },
  { id: 'name',     label: '名前順' },
  { id: 'quantity', label: '在庫少ない順' },
  { id: 'category', label: '分類順' },
  { id: 'date',     label: '日付順' },
];

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
  emptyFavorites: [
    { speaker: 'arte', text: 'よく使うものの ☆ を押すと、ここに集まるよ。', icon: CHAR.arteHappy },
    { speaker: 'risol', text: '毎回さがすの面倒でしょ。☆ 押しときなよ。', icon: CHAR.risolArms },
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
  menusTab: [
    { speaker: 'arte', text: '今日のごはん、あるもので作れるか見てみよ。', icon: CHAR.arteBasket },
    { speaker: 'risol', text: '作るって決めたなら、足りないもの確認しときなよ。', icon: CHAR.risolCheck },
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
let stockSearchQuery = '';
let driveToken      = null;
let driveTokenExpiresAt = 0;
let driveTokenClient = null;
let saveTimer       = null;
let editingItemId   = null;
let idleTimer       = null;
let peekTimer       = null;
let lastPeekAt      = 0;
let wasAway         = false;
let itemStockDraft  = 'ok';
let editingMenuId   = null;
let menuIngredientDraft = [];
let expandedMenuIds = new Set();
let choosingIngredientRowId = null;
let ingredientPickerQuery = '';
let pendingMenuIngredientLink = null;
let itemFavoriteDraft = false;

// ─────────────────────────────────────────────
//  状態の永続化
// ─────────────────────────────────────────────
function createInitialState() {
  return {
    items: [],
    menus: [],
    shoppingList: [],
    settings: { driveClientId: '', driveFileId: null, startOnFavorites: true },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const s = JSON.parse(raw);
    if (!s.settings)      s.settings = { driveClientId: '', driveFileId: null, startOnFavorites: true };
    if (s.settings.startOnFavorites === undefined) s.settings.startOnFavorites = true;
    if (!s.shoppingList)  s.shoppingList = [];
    if (!s.items)         s.items = [];
    if (!s.menus)         s.menus = [];
    s.items.forEach(normalizeItem);
    s.menus.forEach(normalizeMenu);
    return s;
  } catch {
    return createInitialState();
  }
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('persistLocal:', e);
    showToast('保存に失敗しました。端末の空き容量を確認してください', true);
  }
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
    state.menus        = data.menus        || [];
    state.shoppingList = data.shoppingList || [];
    state.items.forEach(normalizeItem);
    state.menus.forEach(normalizeMenu);
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
    const payload  = JSON.stringify({ items: state.items, menus: state.menus, shoppingList: state.shoppingList });
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
    throw e;
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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

/* ── 置き場所（複数カテゴリ対応） ── */
function locationKey(loc) {
  return `${loc.category}/${loc.subcategory}`;
}

function normalizeLocation(loc) {
  if (!loc) return null;
  const category = catInfo(loc.category === 'bathroom' ? 'daily' : loc.category).id;
  let subcategory = loc.subcategory;
  if (category === 'daily' && subcategory === 'other') subcategory = 'bath';
  if (!subcategoryList(category).some(s => s.id === subcategory)) subcategory = defaultSubcategory(category);
  return { category, subcategory };
}

function dedupeLocations(locations) {
  const seen = new Set();
  const result = [];
  for (const loc of locations) {
    const normalized = normalizeLocation(loc);
    if (!normalized) continue;
    const key = locationKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function itemLocations(item) {
  if (Array.isArray(item.locations) && item.locations.length) return item.locations;
  return [{ category: item.category, subcategory: item.subcategory }];
}

function locationLabel(loc) {
  const cat = catInfo(loc.category);
  const sub = subcatInfo(loc.category, loc.subcategory);
  return `${cat.icon}${cat.label} / ${sub.icon}${sub.label}`;
}

function normalizeItem(item) {
  if (!item) return item;
  if (item.category === 'bathroom') item.category = 'daily';
  if (!item.category) item.category = 'other';
  item.category = catInfo(item.category).id;
  if (!item.subcategory) item.subcategory = defaultSubcategory(item.category);
  if (item.category === 'daily' && item.subcategory === 'other') item.subcategory = 'bath';
  // 置き場所は locations が正。無い旧データは category/subcategory から作る
  const rawLocations = Array.isArray(item.locations) && item.locations.length
    ? item.locations
    : [{ category: item.category, subcategory: item.subcategory }];
  item.locations = dedupeLocations(rawLocations);
  if (!item.locations.length) item.locations = [normalizeLocation({ category: item.category, subcategory: item.subcategory })];
  item.category    = item.locations[0].category;
  item.subcategory = item.locations[0].subcategory;
  item.favorite = item.favorite === true;
  if (!item.dateType) item.dateType = 'expiry';
  if (item.dateType !== 'start') item.dateType = 'expiry';
  if (!STOCK_LEVELS.some(l => l.id === item.stock)) item.stock = legacyStockLevel(item);
  // 個数・残量・写真の時代の項目は使わないので片付ける（写真は容量も食う）
  for (const key of ['quantity', 'unit', 'minQuantity', 'stockMode', 'amountPercent', 'minAmountPercent', 'locationPhoto']) {
    delete item[key];
  }
  return item;
}

// 個数で管理していた頃のデータを3段階に読み替える
function legacyStockLevel(item) {
  const qty = Number(item.quantity) || 0;
  const amountMode = item.stockMode === 'amount';
  const percent = Number(item.amountPercent ?? 100);
  if (qty <= 0 && (!amountMode || percent <= 0)) return item.quantity === undefined ? 'ok' : 'out';
  const threshold = Number.isFinite(Number(item.minAmountPercent)) ? Number(item.minAmountPercent) : 10;
  const countLow = item.minQuantity > 0 && qty <= item.minQuantity;
  const amountLow = amountMode && qty <= 0 && percent <= threshold;
  return countLow || amountLow ? 'low' : 'ok';
}

function stockLevelInfo(id) {
  return STOCK_LEVELS.find(l => l.id === id) || STOCK_LEVELS[0];
}

function normalizeMenu(menu) {
  if (!menu) return menu;
  if (!Array.isArray(menu.ingredients)) menu.ingredients = [];
  menu.ingredients = menu.ingredients.map(ingredient => ({
    itemId: ingredient.itemId || '',
    name: ingredient.name || '',
  }));
  if (!menu.note) menu.note = '';
  return menu;
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

function stockSegmentHtml(item) {
  return `<div class="stock-seg" role="group" aria-label="在庫の状態">${STOCK_LEVELS.map(l => `
    <button type="button" class="stock-seg-btn level-${l.id} ${item.stock === l.id ? 'on' : ''}"
      data-action="stock" data-value="${l.id}" aria-pressed="${item.stock === l.id}">${l.label}</button>`).join('')}
  </div>`;
}

function isItemLow(item) {
  return item.stock === 'low' || item.stock === 'out';
}

/* ── 使い切り判定と期限の自動リセット ── */
function isItemEmpty(item) {
  return item.stock === 'out';
}

// 使い切って0になったら消費期限を自動で消す（使用開始日は残す）
function clearExpiryWhenEmpty(item) {
  if (!isItemEmpty(item)) return false;
  if (item.dateType !== 'expiry') return false;
  if (!itemDate(item)) return false;
  item.expiryDate = null;
  item.date = null;
  item.expiryClearedAt = new Date().toISOString();
  return true;
}

function $(id)  { return document.getElementById(id); }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 同じ品目では毎回同じ絵柄になるように（再描画でチラつかせない）
function pickFor(list, seed) {
  let hash = 0;
  for (let i = 0; i < String(seed).length; i++) hash = (hash * 31 + String(seed).charCodeAt(i)) >>> 0;
  return list[hash % list.length];
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
    if (i.dateType === 'start') return false;
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
  let changed = false;
  for (const item of lowItems) {
    const already = state.shoppingList.find(s => s.itemId === item.id && !s.checked);
    if (!already) {
      state.shoppingList.push({
        id: uid(), itemId: item.id,
        name: item.name,
        checked: false,
        addedAt: new Date().toISOString(),
        auto: true,
      });
      changed = true;
    }
  }
  // 一覧で「ある」に戻したものは、未購入の自動追加分をリストから外す
  const before = state.shoppingList.length;
  state.shoppingList = state.shoppingList.filter(s => {
    if (!s.auto || s.checked || !s.itemId) return true;
    const item = state.items.find(i => i.id === s.itemId);
    return item && isItemLow(item);
  });
  if (changed || state.shoppingList.length !== before) persistLocal();
}

// ─────────────────────────────────────────────
//  レンダリング
// ─────────────────────────────────────────────
function renderAll() {
  if (currentTab === 'stock')    renderStock();
  if (currentTab === 'menus')    renderMenus();
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
    const rank = { out: 0, low: 1, ok: 2 };
    return (rank[a.stock] - rank[b.stock]) || a.name.localeCompare(b.name, 'ja');
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

function renderCategoryChips() {
  const chips = $('catChips');
  if (!chips) return;
  const favCount = state.items.filter(i => i.favorite).length;
  const options = [FAVORITE_FILTER, ...CATEGORIES];
  const scrollLeft = chips.scrollLeft;
  chips.innerHTML = options.map(c => {
    const badge = c.id === 'fav' && favCount ? `<span class="chip-count">${favCount}</span>` : '';
    return `<button class="cat-chip ${c.id === 'fav' ? 'fav-chip ' : ''}${c.id === currentCategory ? 'active' : ''}"
      data-cat="${c.id}" onclick="switchCategory('${c.id}')">${c.icon} ${c.label}${badge}</button>`;
  }).join('');
  chips.scrollLeft = scrollLeft;
}

function renderSubcategoryChips() {
  const chips = $('subcatChips');
  if (!chips) return;
  if (currentCategory === 'all' || currentCategory === 'fav') {
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
// 品目が現在の絞り込みに含まれるか（複数の置き場所のどれかが一致すればOK）
function itemMatchesFilter(item, category = currentCategory, subcategory = currentSubcategory) {
  if (category === 'fav') return item.favorite === true;
  if (category === 'all') return true;
  return itemLocations(item).some(loc =>
    loc.category === category && (subcategory === 'all' || loc.subcategory === subcategory));
}

function stockCardHtml(item) {
  const cat    = catInfo(item.category);
  const locs   = itemLocations(item);
  const expCl  = itemDateClass(item);
  const expLb  = itemDateLabel(item);
  const isLow  = isItemLow(item);
  const alertIcon = expCl === 'expired' || expCl === 'expiring-soon'
    ? pickFor([CHAR.risolWarn, CHAR.risolComplain, CHAR.arteCheck], item.id)
    : isLow ? pickFor([CHAR.risolThink, CHAR.risolAnnoyed, CHAR.arteBasket], item.id + 'low') : '';
  // 置き場所はメインだけ出し、複数あるときは「＋n」で示す（全部はタップして編集画面で）
  const mainSub = subcatInfo(locs[0].category, locs[0].subcategory);
  const locHtml = `<span class="item-loc">${mainSub.icon} ${esc(mainSub.label)}</span>`
    + (locs.length > 1 ? `<span class="item-loc-more" title="${esc(locs.map(locationLabel).join(' / '))}">＋${locs.length - 1}</span>` : '');
  return `
      <div class="item-card cat-${cat.id} ${expCl} ${isLow ? 'low-stock' : ''} stock-${item.stock} ${item.favorite ? 'is-favorite' : ''}"
        data-id="${item.id}" role="button" tabindex="0" aria-label="${esc(item.name)}を編集">
        <div class="item-cat-icon">${cat.icon}</div>
        <div class="item-body">
          <div class="item-name">${item.favorite ? '<span class="item-fav-mark">⭐</span>' : ''}${esc(item.name)}</div>
          <div class="item-subcat">${locHtml}</div>
          ${expLb ? `<div class="item-expiry ${expCl}">${expLb}</div>` : ''}
          ${item.note ? `<div class="item-note">${esc(item.note)}</div>` : ''}
          ${isLow ? '<div class="item-low">🛒 買い物リストに入っています</div>' : ''}
        </div>
        ${alertIcon ? `<img class="item-alert-character" src="${alertIcon}" alt="">` : ''}
        ${stockSegmentHtml(item)}
        <button class="item-fav-btn ${item.favorite ? 'on' : ''}" data-action="fav"
          aria-pressed="${item.favorite ? 'true' : 'false'}"
          aria-label="${item.favorite ? 'お気に入りから外す' : 'お気に入りに登録'}">${item.favorite ? '⭐' : '☆'}</button>
      </div>`;
}

function renderStock() {
  renderCharacterTip();
  renderCategoryChips();
  renderSubcategoryChips();
  const list = $('stockList');
  if (!list) return;

  const query = stockSearchQuery.trim().toLocaleLowerCase('ja');
  // 検索中は絞り込みを越えて全品目から探す（フィルタのせいで見つからないのを防ぐ）
  let items = query
    ? state.items.filter(i => `${i.name} ${i.note || ''}`.toLocaleLowerCase('ja').includes(query))
    : state.items.filter(i => itemMatchesFilter(i));

  items.sort(compareItems);
  const searchNote = query && currentCategory !== 'all'
    ? '<div class="search-scope-note">🔍 すべての分類から検索しています</div>'
    : '';

  if (!items.length) {
    if (query) {
      list.innerHTML = `
        <div class="empty-state character-empty">
          <img class="empty-character" src="${CHAR.risolThink}" alt="">
          <p>「${esc(stockSearchQuery.trim())}」に一致する品目はありません</p>
          <button class="empty-cta" onclick="clearStockSearch()">検索をクリア</button>
        </div>`;
      return;
    }
    if (currentCategory === 'fav') {
      const favLine = lineFor('emptyFavorites');
      list.innerHTML = `
        <div class="empty-state character-empty">
          <img class="empty-character" src="${favLine.icon}" alt="">
          <p>お気に入りはまだありません</p>
          <p class="empty-hint">${esc(favLine.text)}</p>
          <button class="empty-cta" onclick="switchCategory('all')">📋 すべての在庫を見る</button>
        </div>`;
      return;
    }
    const emptyLine = currentCategory === 'all' ? lineFor('emptyAll') : lineFor('emptyCategory');
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${emptyLine.icon}" alt="">
        <p>${currentCategory === 'all' ? 'まだ品目がありません' : 'この種類の品目はありません'}</p>
        <p class="empty-hint">${esc(emptyLine.text)}</p>
        <button class="empty-cta" onclick="openAddItem()">＋ 品目を追加する</button>
      </div>`;
    return;
  }

  list.innerHTML = searchNote + items.map(stockCardHtml).join('');
}

function clearStockSearch() {
  stockSearchQuery = '';
  const input = $('stockSearch');
  if (input) input.value = '';
  renderStock();
}

// お気に入りの登録／解除
function toggleFavorite(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  item.favorite = !item.favorite;
  item.updatedAt = new Date().toISOString();
  saveState();
  showToast(item.favorite ? `⭐ ${item.name} をお気に入りに登録しました` : 'お気に入りから外しました');
  // お気に入り表示中に外したらカードごと消えるので、一覧を作り直す
  if (currentCategory === 'fav') renderStock();
  else { updateStockCard(item); renderCategoryChips(); }
}

/* ── 料理メニュー ── */
// 食材は「なし」か在庫未登録なら不足扱い。「少ない」はまだ作れる
function menuIngredientStatus(ingredient) {
  const item = state.items.find(i => i.id === ingredient.itemId);
  if (!item) {
    return {
      item: null,
      name: ingredient.name || '未設定の食材',
      missing: true,
      availableText: '在庫との紐付けなし',
    };
  }
  return {
    item, name: item.name,
    missing: item.stock === 'out',
    availableText: stockLevelInfo(item.stock).label,
  };
}

function renderMenus() {
  const list = $('menuList');
  if (!list) return;
  if (!state.menus.length) {
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${CHAR.coupleBasket}" alt="">
        <p>まだメニューがありません</p>
        <p class="empty-hint">作りたい料理を登録して、食材を確認しようね。</p>
        <button class="empty-cta" onclick="openAddMenu()">＋ メニューを追加する</button>
      </div>`;
    return;
  }
  list.innerHTML = state.menus.map(menu => {
    const statuses = menu.ingredients.map(menuIngredientStatus);
    const missing = statuses.filter(status => status.missing);
    const statusClass = missing.length ? 'shortage' : 'ready';
    const statusLabel = missing.length ? `不足 ${missing.length}品` : '作れる';
    const expanded = expandedMenuIds.has(menu.id);
    const ingredients = statuses.map((status, index) => `
      <div class="menu-stock-row ${status.missing ? 'missing' : 'available'}">
        <span class="menu-stock-mark">${status.missing ? '！' : '✓'}</span>
        <span class="menu-stock-name">${esc(status.name)}</span>
        <span class="menu-stock-current">${esc(status.availableText)}</span>
        ${!status.item ? `<button class="menu-register-btn" onclick="registerMenuIngredient('${menu.id}',${index})">在庫に登録</button>` : ''}
      </div>`).join('');
    return `
      <article class="menu-card ${statusClass}" data-id="${menu.id}">
        <div class="menu-card-head">
          <h3>${esc(menu.name)}</h3>
          <span class="menu-status ${statusClass}">${statusLabel}</span>
          <button class="menu-edit-btn" onclick="openEditMenu('${menu.id}')" aria-label="編集">✏️</button>
          <button class="menu-toggle-btn" onclick="toggleMenuDetails('${menu.id}')" aria-expanded="${expanded}" aria-label="${expanded ? '詳細を閉じる' : '詳細を開く'}">${expanded ? '⌃' : '⌄'}</button>
        </div>
        ${expanded ? `
          <div class="menu-card-details">
            ${menu.note ? `<p class="menu-note">${esc(menu.note)}</p>` : ''}
            <div class="menu-stock-list">${ingredients}</div>
            ${missing.length ? `<button class="menu-shop-btn" onclick="addMissingMenuItemsToShopping('${menu.id}')">🛒 不足分を買い物リストへ</button>` : ''}
          </div>` : ''}
      </article>`;
  }).join('');
}

function toggleMenuDetails(menuId) {
  if (expandedMenuIds.has(menuId)) {
    expandedMenuIds.delete(menuId);
  } else {
    expandedMenuIds.add(menuId);
  }
  renderMenus();
}

/* ── 買い物リスト ── */
function renderShopping() {
  syncAutoShoppingItems();
  const list = $('shoppingList');
  if (!list) return;

  const checkedCount = state.shoppingList.filter(s => s.checked).length;
  $('clearCheckedBtn')?.classList.toggle('hidden', !checkedCount);

  if (!state.shoppingList.length) {
    const emptyLine = lineFor('emptyShopping');
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${emptyLine.icon}" alt="">
        <p>買い物リストは空です</p>
        <p class="empty-hint">${esc(emptyLine.text)}</p>
        <button class="empty-cta" onclick="openAddShopItem()">＋ 買うものを追加する</button>
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
        ${Number(s.quantity) > 1 && s.unit ? `<span class="shop-qty">${s.quantity}${esc(s.unit)}</span>` : ''}
        ${s.auto ? '<span class="shop-auto">自動</span>' : ''}
        ${s.fromMenu ? '<span class="shop-menu">メニュー</span>' : ''}
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
function toggleStartOnFavorites(checked) {
  state.settings.startOnFavorites = Boolean(checked);
  persistLocal();
  showToast(checked ? '起動時にお気に入りを表示します ⭐' : '起動時はすべての在庫を表示します');
}

function renderSettings() {
  const favToggle = $('startOnFavorites');
  if (favToggle) favToggle.checked = state.settings.startOnFavorites !== false;
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
  } else {
    // プロンプトの有無に関わらずボタンは常に表示
    btn.style.display    = '';
    btn.textContent      = _installPrompt ? '📲 ホーム画面にインストール' : '📲 インストール方法を確認';
    status.style.display = 'none';
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
  const menuFab = $('menuFab');
  const shoppingFab = $('shoppingFab');
  if (stockFab)    stockFab.classList.toggle('hidden', tab !== 'stock');
  if (menuFab)     menuFab.classList.toggle('hidden', tab !== 'menus');
  if (shoppingFab) shoppingFab.classList.toggle('hidden', tab !== 'shopping');

  renderAll();
  const lineKey = { stock: 'stockTab', menus: 'menusTab', shopping: 'shoppingTab', settings: 'settingsTab' }[tab];
  if (lineKey) showCharacterPeek(lineFor(lineKey));
}

function switchCategory(cat) {
  currentCategory = cat;
  currentSubcategory = 'all';
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

function updateDateTypeLabel() {
  const label = $('itemDateLabel');
  const input = $('itemExpiry');
  if (!label) return;
  const isStart = $('itemDateType')?.value === 'start';
  label.textContent = isStart ? '使用開始日時' : '消費期限';
  if (input) input.type = isStart ? 'datetime-local' : 'date';
}

// ─────────────────────────────────────────────
//  品目 CRUD
// ─────────────────────────────────────────────
// 一覧の「ある・少ない・なし」はタップした瞬間に保存する
function setStock(itemId, level) {
  const item = state.items.find(i => i.id === itemId);
  if (!item || item.stock === level) return;
  item.stock = level;
  item.updatedAt = new Date().toISOString();
  // 使い切ったら消費期限を自動リセット
  const cleared = clearExpiryWhenEmpty(item);
  saveState();
  // 並び替えでカードが飛ばないよう、該当カードだけ更新する
  updateStockCard(item);
  document.querySelector(`.item-card[data-id="${item.id}"]`)?.classList.add('just-saved');
  renderCharacterTip();
  updateShoppingBadge();
  if (cleared) showToast(`${item.name} を使い切ったので消費期限を消しました 🗓️`);
  else showToast(`${item.name}：${stockLevelInfo(level).label} ✅`);
}

function updateStockCard(item) {
  const card = document.querySelector(`.item-card[data-id="${item.id}"]`);
  if (!card) { renderStock(); return; }
  card.outerHTML = stockCardHtml(item);
}

/* ── 置き場所（モーダル内） ── */
function fillLocationSelects(loc) {
  const catSel = $('itemLocCategory');
  if (!catSel) return;
  catSel.value = loc.category;
  updateLocationPickerSubcats();
  $('itemLocSubcategory').value = loc.subcategory;
}

function updateLocationPickerSubcats() {
  const catSel = $('itemLocCategory');
  const subSel = $('itemLocSubcategory');
  if (!catSel || !subSel) return;
  subSel.innerHTML = subcategoryList(catSel.value)
    .map(s => `<option value="${s.id}">${s.icon} ${s.label}</option>`).join('');
}

/* ── 在庫の状態（モーダル内） ── */
function setStockDraft(level) {
  itemStockDraft = level;
  renderStockDraft();
}

function renderStockDraft() {
  document.querySelectorAll('#itemStockSeg .stock-seg-btn').forEach(btn => {
    const on = btn.dataset.value === itemStockDraft;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/* ── お気に入り（モーダル内） ── */
function toggleDraftFavorite() {
  itemFavoriteDraft = !itemFavoriteDraft;
  renderDraftFavorite();
}

function renderDraftFavorite() {
  const btn = $('itemFavToggle');
  if (!btn) return;
  btn.classList.toggle('on', itemFavoriteDraft);
  btn.setAttribute('aria-pressed', itemFavoriteDraft ? 'true' : 'false');
  btn.textContent = itemFavoriteDraft ? '⭐ お気に入り登録中' : '☆ お気に入りに登録';
}

function openAddItem(menuLink = null) {
  pendingMenuIngredientLink = menuLink;
  editingItemId = null;
  $('modalTitle').textContent = '品目を追加';
  $('itemName').value     = '';
  const baseCategory = currentCategory !== 'all' && currentCategory !== 'fav' ? currentCategory : 'refrigerator';
  fillLocationSelects({
    category: baseCategory,
    subcategory: currentSubcategory !== 'all' ? currentSubcategory : defaultSubcategory(baseCategory),
  });
  itemFavoriteDraft = false;
  renderDraftFavorite();
  setStockDraft('ok');
  const advanced = $('itemAdvanced');
  if (advanced) advanced.open = false;
  $('itemDateType').value = 'expiry';
  updateDateTypeLabel();
  $('itemExpiry').value   = '';
  $('itemNote').value     = '';
  $('deleteItemBtn').classList.add('hidden');
  $('itemSaveHint').textContent = '入力したら右上の「追加」か Enter で登録';
  $('itemSaveBtn').textContent = '追加';
  if (menuLink) {
    const menu = state.menus.find(entry => entry.id === menuLink.menuId);
    const ingredient = menu?.ingredients[menuLink.ingredientIndex];
    if (ingredient) {
      $('modalTitle').textContent = '食材を在庫に登録';
      $('itemName').value = ingredient.name;
      setStockDraft('out');
    }
  }
  openModal('itemModal');
  setTimeout(() => $('itemName').focus(), 80);
}

function openEditItem(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  pendingMenuIngredientLink = null;
  editingItemId = itemId;
  $('modalTitle').textContent = '品目を編集';
  $('itemName').value     = item.name;
  fillLocationSelects(itemLocations(item)[0]);
  itemFavoriteDraft = item.favorite === true;
  renderDraftFavorite();
  setStockDraft(item.stock);
  const advanced = $('itemAdvanced');
  // 何か設定済みなら詳細を開いた状態で見せる
  if (advanced) advanced.open = Boolean(itemDate(item) || item.note);
  $('itemDateType').value = item.dateType || 'expiry';
  updateDateTypeLabel();
  const dateValue = itemDate(item) || '';
  $('itemExpiry').value   = item.dateType === 'start' && dateValue.length === 10 ? `${dateValue}T00:00` : dateValue;
  $('itemNote').value     = item.note || '';
  $('deleteItemBtn').classList.remove('hidden');
  $('itemSaveHint').textContent = '閉じると自動で保存されます';
  $('itemSaveBtn').textContent = '保存';
  openModal('itemModal');
}

// 編集中は ✕・背景タップ・Esc で閉じても保存する（保存し忘れ防止）
function closeItemModal() {
  if (editingItemId && $('itemName').value.trim()) saveItem();
  else closeModal('itemModal');
}

function saveItem() {
  const name = $('itemName').value.trim();
  if (!name) { showToast('品名を入力してください', true); return; }

  const now = new Date().toISOString();
  const location = normalizeLocation({
    category:    $('itemLocCategory').value,
    subcategory: $('itemLocSubcategory').value,
  });
  const fields = {
    name,
    locations:   [location],
    category:    location.category,
    subcategory: location.subcategory,
    favorite:    itemFavoriteDraft,
    stock:       itemStockDraft,
    dateType:    $('itemDateType').value,
    expiryDate:  $('itemExpiry').value || null,
    note:        $('itemNote').value.trim(),
  };
  let savedItem = null;
  let changed = true;

  if (editingItemId) {
    const item = state.items.find(i => i.id === editingItemId);
    if (item) {
      savedItem = item;
      changed = JSON.stringify(Object.keys(fields).map(k => item[k] ?? null))
        !== JSON.stringify(Object.keys(fields).map(k => fields[k] ?? null));
      if (changed) Object.assign(item, fields, { updatedAt: now });
    }
  } else {
    const addedItem = { id: uid(), ...fields, createdAt: now, updatedAt: now };
    state.items.push(addedItem);
    savedItem = addedItem;
    if (pendingMenuIngredientLink) {
      const menu = state.menus.find(entry => entry.id === pendingMenuIngredientLink.menuId);
      const ingredient = menu?.ingredients[pendingMenuIngredientLink.ingredientIndex];
      if (ingredient) {
        ingredient.itemId = addedItem.id;
        ingredient.name = addedItem.name;
        menu.updatedAt = now;
        expandedMenuIds.add(menu.id);
      }
    }
  }
  if (savedItem) clearExpiryWhenEmpty(savedItem);

  const wasEditing = Boolean(editingItemId);
  pendingMenuIngredientLink = null;
  closeModal('itemModal');
  if (!changed) return;
  saveState();
  // 保存した品目が今の絞り込みで隠れてしまうときは、見える場所へ戻す
  if (savedItem && currentTab === 'stock' && !itemMatchesFilter(savedItem)) {
    currentCategory = savedItem.category;
    currentSubcategory = 'all';
    stockSearchQuery = '';
    if ($('stockSearch')) $('stockSearch').value = '';
  }
  renderAll();
  updateShoppingBadge();
  showToast(wasEditing ? '保存しました ✅' : '追加しました ✅');
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
//  料理メニュー
// ─────────────────────────────────────────────
function matchingMenuItems(query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase('ja');
  return state.items.filter(item => {
    if (!normalizedQuery) return true;
    const category = catInfo(item.category).label;
    const subcategory = subcatInfo(item.category, item.subcategory).label;
    return `${item.name} ${category} ${subcategory}`.toLocaleLowerCase('ja').includes(normalizedQuery);
  });
}

function renderMenuIngredientRows() {
  const rows = $('menuIngredientRows');
  if (!rows) return;
  if (!menuIngredientDraft.length) {
    rows.innerHTML = '<p class="ingredient-empty">食材を追加してください</p>';
    return;
  }
  rows.innerHTML = menuIngredientDraft.map(row => {
    const item = state.items.find(i => i.id === row.itemId);
    const label = item?.name || row.name || '食材を選択';
    const emptyClass = item ? '' : row.name ? ' unregistered' : ' empty';
    return `
      <div class="menu-ingredient-row">
        <button type="button" class="ingredient-select${emptyClass}"
          onclick="openIngredientPicker('${row.id}')">${esc(label)}<span>⌄</span></button>
        <button type="button" class="ingredient-remove" onclick="removeMenuIngredientRow('${row.id}')" aria-label="食材を外す">✕</button>
      </div>`;
  }).join('');
  renderIngredientPicker();
}

function addMenuIngredientRow(ingredient = null) {
  const row = {
    id: uid(),
    itemId: ingredient?.itemId || '',
    name: ingredient?.name || '',
  };
  menuIngredientDraft.push(row);
  if (!ingredient) {
    choosingIngredientRowId = row.id;
    ingredientPickerQuery = '';
  }
  renderMenuIngredientRows();
}

function openIngredientPicker(rowId) {
  choosingIngredientRowId = choosingIngredientRowId === rowId ? null : rowId;
  ingredientPickerQuery = '';
  renderIngredientPicker();
  if (choosingIngredientRowId) setTimeout(() => $('ingredientPickerSearch')?.focus(), 40);
}

function ingredientResultsHtml() {
  const candidates = matchingMenuItems(ingredientPickerQuery);
  const existingResults = candidates.length
    ? candidates.map(item => `
      <button type="button" class="ingredient-result" onclick="chooseMenuIngredient('${item.id}')">
        <strong>${esc(item.name)}</strong>
        <span>${esc(catInfo(item.category).label)} / ${esc(subcatInfo(item.category, item.subcategory).label)}　${stockLevelInfo(item.stock).label}</span>
      </button>`).join('')
    : '<p class="ingredient-no-result">一致する在庫品がありません</p>';
  const name = ingredientPickerQuery.trim();
  const newIngredient = name
    ? `<button type="button" class="ingredient-new-result" onclick="chooseUnregisteredIngredient()">
         ＋ 「${esc(name)}」を未登録食材として追加
       </button>`
    : '';
  return existingResults + newIngredient;
}

function renderIngredientPicker() {
  const panel = $('menuIngredientPicker');
  if (!panel) return;
  if (!choosingIngredientRowId) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    return;
  }
  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="ingredient-picker-head">
      <input id="ingredientPickerSearch" type="search" value="${esc(ingredientPickerQuery)}"
        placeholder="食材名や分類で検索" aria-label="食材を検索"
        oninput="filterMenuIngredients(this.value)">
      <button type="button" onclick="closeIngredientPicker()" aria-label="閉じる">✕</button>
    </div>
    <div id="ingredientResults" class="ingredient-results">${ingredientResultsHtml()}</div>`;
}

function filterMenuIngredients(query) {
  ingredientPickerQuery = query;
  const results = $('ingredientResults');
  if (results) results.innerHTML = ingredientResultsHtml();
}

function chooseMenuIngredient(itemId) {
  updateMenuIngredient(choosingIngredientRowId, 'itemId', itemId);
  closeIngredientPicker();
}

function chooseUnregisteredIngredient() {
  const row = menuIngredientDraft.find(ingredient => ingredient.id === choosingIngredientRowId);
  const name = ingredientPickerQuery.trim();
  if (!row || !name) return;
  row.itemId = '';
  row.name = name;
  closeIngredientPicker();
  renderMenuIngredientRows();
}

function closeIngredientPicker() {
  choosingIngredientRowId = null;
  ingredientPickerQuery = '';
  renderIngredientPicker();
}

function updateMenuIngredient(rowId, field, value) {
  const row = menuIngredientDraft.find(ingredient => ingredient.id === rowId);
  if (!row) return;
  row.itemId = value;
  const item = state.items.find(i => i.id === value);
  if (item) row.name = item.name;
  renderMenuIngredientRows();
}

function removeMenuIngredientRow(rowId) {
  menuIngredientDraft = menuIngredientDraft.filter(ingredient => ingredient.id !== rowId);
  if (choosingIngredientRowId === rowId) closeIngredientPicker();
  renderMenuIngredientRows();
}

function openAddMenu() {
  editingMenuId = null;
  $('menuModalTitle').textContent = 'メニューを追加';
  $('menuName').value = '';
  $('menuNote').value = '';
  menuIngredientDraft = [];
  choosingIngredientRowId = null;
  addMenuIngredientRow();
  $('deleteMenuBtn').classList.add('hidden');
  openModal('menuModal');
  setTimeout(() => $('menuName').focus(), 80);
}

function openEditMenu(menuId) {
  const menu = state.menus.find(entry => entry.id === menuId);
  if (!menu) return;
  editingMenuId = menuId;
  $('menuModalTitle').textContent = 'メニューを編集';
  $('menuName').value = menu.name;
  $('menuNote').value = menu.note || '';
  menuIngredientDraft = [];
  choosingIngredientRowId = null;
  ingredientPickerQuery = '';
  menu.ingredients.forEach(ingredient => addMenuIngredientRow(ingredient));
  if (!menuIngredientDraft.length) addMenuIngredientRow();
  $('deleteMenuBtn').classList.remove('hidden');
  openModal('menuModal');
}

function saveMenu() {
  const name = $('menuName').value.trim();
  if (!name) { showToast('料理名を入力してください', true); return; }
  const ingredients = menuIngredientDraft.filter(ingredient => ingredient.itemId || (ingredient.name || '').trim()).map(ingredient => {
    const item = state.items.find(i => i.id === ingredient.itemId);
    return {
      itemId: item?.id || '',
      name: item?.name || ingredient.name,
    };
  });
  if (!ingredients.length) { showToast('必要な食材を追加してください', true); return; }
  const ingredientKeys = ingredients.map(ingredient => ingredient.itemId || `name:${ingredient.name.trim().toLocaleLowerCase('ja')}`);
  if (new Set(ingredientKeys).size !== ingredients.length) { showToast('同じ食材が重複しています', true); return; }
  const now = new Date().toISOString();
  let savedMenuId = editingMenuId;
  if (editingMenuId) {
    const menu = state.menus.find(entry => entry.id === editingMenuId);
    if (!menu) return;
    menu.name = name;
    menu.note = $('menuNote').value.trim();
    menu.ingredients = ingredients;
    menu.updatedAt = now;
  } else {
    savedMenuId = uid();
    state.menus.push({
      id: savedMenuId,
      name,
      note: $('menuNote').value.trim(),
      ingredients,
      createdAt: now,
      updatedAt: now,
    });
  }
  expandedMenuIds.add(savedMenuId);
  closeModal('menuModal');
  saveState();
  renderMenus();
  showToast(editingMenuId ? 'メニューを更新しました ✅' : 'メニューを追加しました ✅');
}

function deleteMenu() {
  if (!editingMenuId) return;
  if (!confirm('このメニューを削除しますか？')) return;
  state.menus = state.menus.filter(menu => menu.id !== editingMenuId);
  expandedMenuIds.delete(editingMenuId);
  closeModal('menuModal');
  saveState();
  renderMenus();
  showToast('メニューを削除しました');
}

function registerMenuIngredient(menuId, ingredientIndex) {
  const menu = state.menus.find(entry => entry.id === menuId);
  const ingredient = menu?.ingredients[ingredientIndex];
  if (!ingredient || ingredient.itemId) return;
  openAddItem({ menuId, ingredientIndex });
}

function addMissingMenuItemsToShopping(menuId) {
  const menu = state.menus.find(entry => entry.id === menuId);
  if (!menu) return;
  let added = 0;
  let unresolved = 0;
  menu.ingredients.map(menuIngredientStatus).forEach(status => {
    if (!status.missing) return;
    if (!status.item) {
      unresolved += 1;
      return;
    }
    if (state.shoppingList.some(shop => shop.itemId === status.item.id && !shop.checked)) return;
    state.shoppingList.push({
      id: uid(),
      itemId: status.item.id,
      name: status.item.name,
      checked: false,
      addedAt: new Date().toISOString(),
      auto: false,
      fromMenu: true,
    });
    added += 1;
  });
  saveState();
  updateShoppingBadge();
  if (added) showToast('不足分を買い物リストに追加しました 🛒');
  else if (unresolved) showToast('先に未登録食材を在庫に登録してください', true);
  else showToast('不足分はすでに買い物リストにあります');
}

// ─────────────────────────────────────────────
//  買い物リスト
// ─────────────────────────────────────────────
function toggleShopItem(shopId) {
  const shop = state.shoppingList.find(s => s.id === shopId);
  if (!shop) return;
  shop.checked = !shop.checked;

  let restockedItem = null;
  if (shop.itemId) {
    const item = state.items.find(i => i.id === shop.itemId);
    if (item) {
      // チェック→「ある」に戻す / アンチェック→チェック前の状態に戻す
      if (shop.checked) {
        shop.prevStock = item.stock;
        item.stock = 'ok';
        restockedItem = item;
      } else {
        item.stock = shop.prevStock || 'low';
      }
      item.updatedAt = new Date().toISOString();
    }
  }

  saveState();
  renderShopping();
  updateShoppingBadge();
  if (restockedItem) showToast(`${restockedItem.name} を「ある」に戻しました ✅`);
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
  openModal('shopModal');
  setTimeout(() => $('shopItemName').focus(), 80);
}

function saveShopItem() {
  const name = $('shopItemName').value.trim();
  if (!name) { showToast('品名を入力してください', true); return; }
  state.shoppingList.push({
    id: uid(), itemId: null, name,
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

// オーバーレイタップで閉じる（品目の編集中は保存してから閉じる）
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    if (e.target.id === 'itemModal') closeItemModal();
    else closeModal(e.target.id);
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
//  JSON バックアップ
// ─────────────────────────────────────────────
function exportData() {
  const payload = JSON.stringify(
    { items: state.items, menus: state.menus, shoppingList: state.shoppingList },
    null, 2
  );
  const blob = new Blob([payload], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `household-stock-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('バックアップを書き出しました 💾');
}

function importData(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.items)) throw new Error('バックアップファイルの形式が違います');
      if (!confirm(`現在のデータをバックアップの内容（品目${data.items.length}件）で置き換えますか？`)) return;
      state.items        = data.items;
      state.menus        = Array.isArray(data.menus) ? data.menus : [];
      state.shoppingList = Array.isArray(data.shoppingList) ? data.shoppingList : [];
      state.items.forEach(normalizeItem);
      state.menus.forEach(normalizeMenu);
      saveState();
      renderAll();
      updateShoppingBadge();
      showToast('バックアップを読み込みました ✅');
    } catch (e) {
      showToast('読み込み失敗: ' + e.message, true);
    }
  };
  reader.onerror = () => showToast('ファイルを読み込めませんでした', true);
  reader.readAsText(file);
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
  if (_installPrompt) {
    // Chromeがプロンプトを持っている場合はそのまま表示
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === 'accepted') {
      _installPrompt = null;
    }
    renderSettings();
    return;
  }
  // プロンプトがない場合はブラウザ別の手順を案内
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const status = $('installStatus');
  if (!status) return;
  status.style.display = '';
  if (isIOS) {
    status.textContent = 'Safariで開き「共有ボタン（□↑）→ ホーム画面に追加」でインストールできます。';
  } else {
    status.textContent = 'Chromeのメニュー（⋮）→「アプリをインストール」または「ホーム画面に追加」をお試しください。';
  }
}

// ─────────────────────────────────────────────
//  在庫カードの操作（カードをタップ＝編集）
// ─────────────────────────────────────────────
function setupStockListActions() {
  const list = $('stockList');
  if (!list) return;
  list.addEventListener('click', e => {
    const card = e.target.closest('.item-card');
    if (!card) return;
    const itemId = card.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'stock') { setStock(itemId, e.target.closest('[data-action]').dataset.value); return; }
    if (action === 'fav')  { toggleFavorite(itemId); return; }
    openEditItem(itemId);
  });
  list.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.item-card');
    if (!card || e.target !== card) return;
    e.preventDefault();
    openEditItem(card.dataset.id);
  });
}

// ─────────────────────────────────────────────
//  モーダルのキーボード操作
// ─────────────────────────────────────────────
const MODAL_SAVE_ACTIONS = { itemModal: saveItem, menuModal: saveMenu, shopModal: saveShopItem };

function openModalId() {
  return document.querySelector('.modal-overlay.open')?.id || null;
}

function setupModalKeys() {
  document.addEventListener('keydown', e => {
    const modalId = openModalId();
    if (!modalId) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (modalId === 'itemModal') closeItemModal();
      else closeModal(modalId);
      return;
    }
    // 1行テキスト入力での Enter は保存（テキストエリアや検索欄は除く）
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement
        && ['text', 'number', 'date', 'datetime-local'].includes(e.target.type)) {
      e.preventDefault();
      MODAL_SAVE_ACTIONS[modalId]?.();
    }
  });
}

// ─────────────────────────────────────────────
//  初期化
// ─────────────────────────────────────────────
function init() {
  registerSW();

  // 起動時にお気に入りを最初に表示（お気に入りが1件でもあるときだけ）
  if (state.settings.startOnFavorites !== false && state.items.some(i => i.favorite)) {
    currentCategory = 'fav';
  }
  renderCategoryChips();
  setupStockListActions();

  const stockSearch = $('stockSearch');
  if (stockSearch) {
    stockSearch.addEventListener('input', () => {
      stockSearchQuery = stockSearch.value;
      renderStock();
    });
  }

  const sortSelect = $('sortSelect');
  if (sortSelect) {
    sortSelect.innerHTML = SORT_OPTIONS.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', () => switchSort(sortSelect.value));
  }

  // 置き場所のカテゴリ選択肢
  const locCategory = $('itemLocCategory');
  if (locCategory) {
    locCategory.innerHTML = CATEGORIES.filter(c => c.id !== 'all')
      .map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('');
    locCategory.addEventListener('change', updateLocationPickerSubcats);
    updateLocationPickerSubcats();
  }

  // モーダル内の在庫状態ボタン
  const stockSeg = $('itemStockSeg');
  if (stockSeg) {
    stockSeg.innerHTML = STOCK_LEVELS.map(l =>
      `<button type="button" class="stock-seg-btn level-${l.id}" data-value="${l.id}" onclick="setStockDraft('${l.id}')">${l.label}</button>`
    ).join('');
  }

  $('itemDateType')?.addEventListener('change', updateDateTypeLabel);

  // タブボタン
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 同期ボタン
  $('syncBtn')?.addEventListener('click', syncNow);
  setupModalKeys();
  setupCharacterPeek();

  // 初期バッジ
  updateShoppingBadge();

  // 初期描画
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
