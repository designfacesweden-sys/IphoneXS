import { getAllItems, putItem, deleteItem } from './db.js';
import { lookupProduct, fetchRecipes } from './api.js';
import { startScanner, stopScanner } from './scanner.js';
import { openDateCapture, captureAndReadDate, closeDateCapture } from './dateCapture.js';
import { estimatePrice, estimateExpiryDate } from './priceEstimate.js';

const screens = document.querySelectorAll('.screen');
const tabs = document.querySelectorAll('.tab');
const clockEl = document.getElementById('clock');

let pendingProduct = null; // product looked up, awaiting expiry + save

// ---- navigation ----
function showScreen(name) {
  screens.forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.screen === name));
  if (name !== 'scan') {
    stopScanner();
    resetScanUI();
  }
  if (name === 'report') {
    renderReport();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
});

// ---- clock ----
function tickClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 15000);

// ---- inventory ----
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

function statusClass(days) {
  if (days === null) return 'status-fresh';
  if (days < 0) return 'status-expired';
  if (days <= 1) return 'status-urgent';
  if (days <= 4) return 'status-soon';
  return 'status-fresh';
}

function expiryLabel(days) {
  if (days === null) return 'No date set';
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days}d`;
}

async function renderInventory() {
  const list = document.getElementById('inventory-list');
  const empty = document.getElementById('inventory-empty');
  const items = await getAllItems();

  items.sort((a, b) => {
    const da = daysUntil(a.expiryDate);
    const db_ = daysUntil(b.expiryDate);
    if (da === null) return 1;
    if (db_ === null) return -1;
    return da - db_;
  });

  list.innerHTML = '';
  empty.hidden = items.length > 0;

  for (const item of items) {
    const days = daysUntil(item.expiryDate);
    const li = document.createElement('li');
    li.className = `inventory-item ${statusClass(days)}`;
    li.innerHTML = `
      ${item.imageUrl ? `<img src="${item.imageUrl}" alt="" />` : '<img alt="" />'}
      <div class="info">
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="expiry">${expiryLabel(days)}</div>
      </div>
      <button class="remove" data-id="${item.id}">×</button>
    `;
    list.appendChild(li);
  }

  list.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteItem(btn.dataset.id);
      renderInventory();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- scan flow ----
const scanIdle = document.getElementById('scan-idle');
const readerEl = document.getElementById('reader');
const scanResult = document.getElementById('scan-result');
const scanError = document.getElementById('scan-error');
const scanStatus = document.getElementById('scan-status');
const dateCapture = document.getElementById('date-capture');
const dateCaptureStatus = document.getElementById('date-capture-status');

function resetScanUI() {
  scanIdle.hidden = false;
  readerEl.hidden = true;
  scanResult.hidden = true;
  scanError.hidden = true;
  scanStatus.hidden = true;
  scanStatus.textContent = '';
  closeDateCapture();
  dateCapture.hidden = true;
  dateCaptureStatus.textContent = '';
  pendingProduct = null;
}

document.getElementById('scan-date-btn').addEventListener('click', async () => {
  dateCapture.hidden = false;
  dateCaptureStatus.textContent = 'Starting camera…';
  try {
    const camera = await openDateCapture('date-capture-reader');
    dateCaptureStatus.textContent = `${camera?.label || 'Camera'} ready — aim at the printed date, tap Capture`;
  } catch (err) {
    dateCaptureStatus.textContent = `Camera error: ${err?.message || err}`;
  }
});

document.getElementById('date-capture-shot').addEventListener('click', async () => {
  dateCaptureStatus.textContent = 'Reading…';
  try {
    const date = await captureAndReadDate();
    if (date) {
      document.getElementById('expiry-input').value = date;
      dateCaptureStatus.textContent = `Found: ${date} — check it looks right`;
      closeDateCapture();
      dateCapture.hidden = true;
    } else {
      dateCaptureStatus.textContent = "Couldn't find a date in that shot — try again, or type it manually.";
    }
  } catch (err) {
    dateCaptureStatus.textContent = `Read error: ${err?.message || err}`;
  }
});

document.getElementById('date-capture-cancel').addEventListener('click', () => {
  closeDateCapture();
  dateCapture.hidden = true;
});

document.getElementById('start-scan').addEventListener('click', async () => {
  scanError.hidden = true;
  scanIdle.hidden = true;
  readerEl.hidden = false;
  scanStatus.hidden = false;
  scanStatus.textContent = 'Starting camera…';
  try {
    await startScanner('reader', onBarcodeDetected, (text) => {
      scanStatus.textContent = text;
    });
  } catch (err) {
    console.error('Camera start failed:', err);
    readerEl.hidden = true;
    scanIdle.hidden = false;
    scanError.hidden = false;
    scanError.textContent =
      err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Enable it in Settings → Safari → Camera, then reload.'
        : `Camera error: ${err?.message || err}`;
  }
});

let handlingDetection = false;

async function onBarcodeDetected(barcode) {
  if (handlingDetection) return;
  handlingDetection = true;

  await stopScanner();
  readerEl.hidden = true;
  scanStatus.hidden = true;

  try {
    const product = await lookupProduct(barcode);
    pendingProduct = {
      id: barcode + '-' + Date.now(),
      barcode,
      name: product?.name || `Item ${barcode}`,
      brand: product?.brand || '',
      imageUrl: product?.imageUrl || '',
      categories: product?.categories || '',
      nutriScore: product?.nutriScore || null,
    };

    document.getElementById('result-name').textContent = pendingProduct.name;
    document.getElementById('result-brand').textContent = pendingProduct.brand;
    const img = document.getElementById('result-image');
    if (pendingProduct.imageUrl) {
      img.src = pendingProduct.imageUrl;
      img.style.display = '';
    } else {
      img.style.display = 'none';
    }
    document.getElementById('expiry-input').value = estimateExpiryDate(pendingProduct);
    document.getElementById('price-input').value = estimatePrice(pendingProduct);
    scanResult.hidden = false;
  } catch (err) {
    console.error('Product lookup failed:', err);
    scanIdle.hidden = false;
    scanError.hidden = false;
    scanError.textContent = `Lookup failed: ${err?.message || err}`;
  } finally {
    handlingDetection = false;
  }
}

document.getElementById('save-item').addEventListener('click', async () => {
  if (!pendingProduct) return;
  const expiryDate = document.getElementById('expiry-input').value || null;
  const price = Number(document.getElementById('price-input').value) || 0;
  await putItem({ ...pendingProduct, expiryDate, price, addedAt: Date.now() });
  resetScanUI();
  showScreen('inventory');
  renderInventory();
});

document.getElementById('cancel-item').addEventListener('click', () => {
  resetScanUI();
});

// ---- recipes ----
document.getElementById('get-recipes').addEventListener('click', async () => {
  const loading = document.getElementById('recipes-loading');
  const list = document.getElementById('recipes-list');
  const preferences = document.getElementById('preferences-input').value;

  const items = await getAllItems();
  if (items.length === 0) {
    list.innerHTML = '<div class="hint">Scan some items into the fridge first.</div>';
    return;
  }

  loading.hidden = false;
  list.innerHTML = '';

  const payload = items.map((it) => ({
    name: it.name,
    brand: it.brand,
    daysUntilExpiry: daysUntil(it.expiryDate),
  }));

  try {
    const { recipes = [] } = await fetchRecipes(payload, preferences);
    list.innerHTML = recipes
      .map(
        (r) => `
      <div class="recipe-card">
        <div class="r-title">${escapeHtml(r.title)}</div>
        <div class="r-meta">${r.estimatedMinutes ? `${r.estimatedMinutes} min` : ''}${
          r.usesExpiringSoon?.length ? ` · rescues ${r.usesExpiringSoon.map(escapeHtml).join(', ')}` : ''
        }</div>
        <div class="r-section-label">Ingredients</div>
        <ul>${(r.ingredients || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
        <div class="r-section-label">Steps</div>
        <ul>${(r.steps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
      </div>`
      )
      .join('');
  } catch {
    list.innerHTML = '<div class="hint">Could not reach the recipe service.</div>';
  } finally {
    loading.hidden = true;
  }
});

// ---- weekly report ----
const NUTRI_SCORE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1 };

async function renderReport() {
  const items = await getAllItems();
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = items.filter((it) => (it.addedAt || 0) >= weekAgo);

  const totalSpend = recent.reduce((sum, it) => sum + (it.price || 0), 0);
  document.getElementById('report-spend').textContent = `${Math.round(totalSpend)} kr`;
  document.getElementById('report-items-count').textContent = `${recent.length} item${
    recent.length === 1 ? '' : 's'
  } scanned this week`;

  const scored = recent.filter((it) => it.nutriScore && NUTRI_SCORE_POINTS[it.nutriScore]);
  const scoreEl = document.getElementById('report-score');
  if (scored.length === 0) {
    scoreEl.textContent = '—';
  } else {
    const avg = scored.reduce((sum, it) => sum + NUTRI_SCORE_POINTS[it.nutriScore], 0) / scored.length;
    const letter = Object.keys(NUTRI_SCORE_POINTS).find(
      (k) => NUTRI_SCORE_POINTS[k] === Math.round(avg)
    );
    scoreEl.textContent = letter || '—';
  }

  const breakdown = document.getElementById('report-breakdown');
  breakdown.innerHTML = recent
    .slice()
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .map((it) => {
      const badgeClass = it.nutriScore ? `nutri-${it.nutriScore}` : 'nutri-unknown';
      const badgeLabel = it.nutriScore || '?';
      return `
        <div class="report-row">
          <span class="nutri-badge ${badgeClass}">${badgeLabel}</span>
          <span class="r-name">${escapeHtml(it.name)}</span>
          <span class="r-price">${Math.round(it.price || 0)} kr</span>
        </div>`;
    })
    .join('');
}

// ---- init ----
renderInventory();
