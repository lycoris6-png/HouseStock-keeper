'use strict';

// ─────────────────────────────────────────────
//  定数
// ─────────────────────────────────────────────
const STORAGE_KEY    = 'household-stock-v1';
const DRIVE_FILE_NAME = 'household-stock-data.json';
const DRIVE_SCOPE    = 'https://www.googleapis.com/auth/drive.file';
const SAVE_DEBOUNCE  = 2500; // ms

const CATEGORIES = [
  { id: 'all',          label: 'すべて', icon: '📋' },
  { id: 'refrigerator', label: '冷蔵庫', icon: '🧊' },
  { id: 'pantry',       label: '常温',   icon: '🏠' },
  { id: 'bathroom',     label: '水回り', icon: '🚿' },
  { id: 'medicine',     label: '薬',     icon: '💊' },
  { id: 'other',        label: 'その他', icon: '📦' },
];

const UNITS = ['個', '本', '袋', '缶', '箱', '枚', 'セット', 'パック', 'g', 'kg', 'ml', 'L', '冊', '錠', '包'];

const CHAR = {
  arteWave: 'assets/chibi_inventory_icons/Arte/Arte_04_waving.png',
  arteDone: 'assets/chibi_inventory_icons/Arte/Arte_13_clipboard_done.png',
  arteBasket: 'assets/chibi_inventory_icons/Arte/Arte_09_carrying_basket.png',
  arteBox: 'assets/chibi_inventory_icons/Arte/Arte_06_carrying_supplies_box.png',
  risolSmug: 'assets/chibi_inventory_icons/Risol/Risol_02_smug_pose.png',
  risolWarn: 'assets/chibi_inventory_icons/Risol/Risol_10_stop_warning.png',
  risolThink: 'assets/chibi_inventory_icons/Risol/Risol_07_thinking.png',
  risolBox: 'assets/chibi_inventory_icons/Risol/Risol_08_carrying_box.png',
  coupleCheck: 'assets/chibi_inventory_icons/Couple/Couple_01_clipboard_together.png',
};

// ─────────────────────────────────────────────
//  状態
// ─────────────────────────────────────────────
let state           = loadState();
let currentTab      = 'stock';
let currentCategory = 'all';
let driveToken      = null;
let driveTokenExpiresAt = 0;
let driveTokenClient = null;
let saveTimer       = null;
let editingItemId   = null;

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
  scheduleDriveSave();
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
  clearTimeout(saveTimer);
  updateSyncIcon('pending');
  saveTimer = setTimeout(() => saveToDrive(), SAVE_DEBOUNCE);
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
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function $(id)  { return document.getElementById(id); }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, isError = false) {
  const el = $('toast');
  const speaker = isError ? 'risol' : 'arte';
  const icon = isError ? CHAR.risolWarn : CHAR.arteDone;
  el.innerHTML = `
    <img class="toast-avatar" src="${icon}" alt="">
    <span class="toast-speaker">${speaker === 'risol' ? 'リソル' : 'アーテ'}</span>
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
        <span class="speaker-name">${speaker === 'risol' ? 'リソル' : 'アーテ'}</span>
        <p>${esc(text)}</p>
      </div>
    </div>`;
}

function renderCharacterTip() {
  const el = $('characterTip');
  if (!el) return;
  const lowCount = state.items.filter(i => i.minQuantity > 0 && i.quantity <= i.minQuantity).length;
  const expiryCount = state.items.filter(i => {
    const d = daysUntil(i.expiryDate);
    return d !== null && d <= 3;
  }).length;
  if (!state.items.length) {
    el.innerHTML = characterLine('arte', 'まずはよく使うものから、ゆっくり登録していきましょうね。', CHAR.arteWave);
  } else if (expiryCount) {
    el.innerHTML = characterLine('risol', `期限が近いものが${expiryCount}件あるぞ。べ、別に心配してるわけじゃないからな。`, CHAR.risolWarn, 'warn');
  } else if (lowCount) {
    el.innerHTML = characterLine('risol', `在庫少なめが${lowCount}件だ。買い忘れたら困るだろ、早めに見とけよ。`, CHAR.risolThink, 'warn');
  } else {
    el.innerHTML = characterLine('arte', 'きれいに整っていますね。この調子で、のんびり続けましょう。', CHAR.arteDone);
  }
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
  const lowItems = state.items.filter(i => i.minQuantity > 0 && i.quantity <= i.minQuantity);
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
  renderCharacterTip();
  if (currentTab === 'stock')    renderStock();
  if (currentTab === 'shopping') renderShopping();
  if (currentTab === 'settings') renderSettings();
}

/* ── 在庫一覧 ── */
function renderStock() {
  renderCharacterTip();
  const list = $('stockList');
  if (!list) return;

  let items = currentCategory === 'all'
    ? [...state.items]
    : state.items.filter(i => i.category === currentCategory);

  // ソート：期限切れ→期限近い→在庫少→名前順
  items.sort((a, b) => {
    const da = daysUntil(a.expiryDate) ?? 9999;
    const db = daysUntil(b.expiryDate) ?? 9999;
    return da - db || a.name.localeCompare(b.name, 'ja');
  });

  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${currentCategory === 'all' ? CHAR.arteBox : CHAR.risolBox}" alt="">
        <p>${currentCategory === 'all' ? 'まだ品目がありません' : 'この種類の品目はありません'}</p>
        <p class="empty-hint">${currentCategory === 'all' ? 'アーテ「ひとつずつ、登録していきましょうね」' : 'リソル「ここは空っぽだな。追加するなら今だぞ」'}</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map(item => {
    const cat   = catInfo(item.category);
    const expCl = expiryClass(item.expiryDate);
    const expLb = expiryLabel(item.expiryDate);
    const isLow = item.minQuantity > 0 && item.quantity <= item.minQuantity;
    return `
      <div class="item-card cat-${cat.id} ${expCl} ${isLow ? 'low-stock' : ''}" data-id="${item.id}">
        <div class="item-cat-icon">${cat.icon}</div>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
          ${expLb ? `<div class="item-expiry ${expCl}">${expLb}</div>` : ''}
          ${item.note ? `<div class="item-note">${esc(item.note)}</div>` : ''}
          ${isLow ? `<div class="item-low">⚠️ 在庫少（最小${item.minQuantity}${esc(item.unit)}）</div>` : ''}
        </div>
        ${(isLow || expCl === 'expired' || expCl === 'expiring-soon') ? `<img class="item-alert-character" src="${CHAR.risolWarn}" alt="">` : ''}
        <div class="item-qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
          <span class="qty-value">${item.quantity}<span class="qty-unit">${esc(item.unit)}</span></span>
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
    list.innerHTML = `
      <div class="empty-state character-empty">
        <img class="empty-character" src="${CHAR.arteBasket}" alt="">
        <p>買い物リストは空です</p>
        <p class="empty-hint">アーテ「必要なものが出たら、わたしが一緒に確認しますね」</p>
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
    if (hasDriveToken())               st.textContent = '接続中 ✅';
    else if (state.settings.driveClientId) st.textContent = '未接続';
    else                               st.textContent = '未設定';
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
}

function switchCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === cat));
  renderStock();
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
  $('itemQty').value      = '1';
  $('itemUnit').value     = '個';
  $('itemMinQty').value   = '1';
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
  $('itemQty').value      = item.quantity;
  $('itemUnit').value     = item.unit;
  $('itemMinQty').value   = item.minQuantity;
  $('itemExpiry').value   = item.expiryDate || '';
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
      item.quantity    = qty;
      item.unit        = $('itemUnit').value;
      item.minQuantity = minQty;
      item.expiryDate  = $('itemExpiry').value || null;
      item.note        = $('itemNote').value.trim();
      item.updatedAt   = now;
    }
  } else {
    state.items.push({
      id: uid(), name,
      category:    $('itemCategory').value,
      quantity:    qty,
      unit:        $('itemUnit').value,
      minQuantity: minQty,
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

  // 初期バッジ
  updateShoppingBadge();

  // 初期描画
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
