const PRIMARY_FLOORS = [8, -2];
const LAST_PRIMARY_KEY = 'elevatorlog.lastPrimaryFloor';
const USER_NAME_KEY = 'elevatorlog.userName';

// -2, -1, 0 share a row (they're all "near ground"), then 1-16 fill two even
// rows of 8 below.
function buildFloorGrid(container, { markedValues = [] } = {}) {
  container.innerHTML = '';
  const chips = new Map();
  const cells = [];
  for (const v of [-2, -1, 0]) cells.push({ value: v, span: 8 });
  for (let v = 1; v <= 16; v++) cells.push({ value: v, span: 3 });

  for (const { value, span } of cells) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip fp-span-${span}`;
    btn.textContent = String(value);
    btn.dataset.value = String(value);
    if (markedValues.includes(value)) btn.classList.add('marked');
    container.appendChild(btn);
    chips.set(value, btn);
  }
  return chips;
}

// Packed two-wide grid mirroring a real elevator button panel: pairs count
// down from (15,16) to (1,2), then a final row of (0,-1,-2).
function buildElevatorGrid(container) {
  container.innerHTML = '';
  const chips = new Map();
  const cells = [];
  for (let k = 8; k >= 1; k--) {
    cells.push({ value: 2 * k - 1, span: 3 });
    cells.push({ value: 2 * k, span: 3 });
  }
  cells.push({ value: 0, span: 2 }, { value: -1, span: 2 }, { value: -2, span: 2 });

  for (const { value, span } of cells) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip chip-span-${span}`;
    btn.textContent = String(value);
    btn.dataset.value = String(value);
    container.appendChild(btn);
    chips.set(value, btn);
  }
  return chips;
}

function selectChip(chips, value, { scroll = true, axis = 'x' } = {}) {
  for (const [v, el] of chips) {
    el.classList.toggle('selected', v === value);
  }
  if (scroll && chips.has(value)) {
    chips.get(value).scrollIntoView(
      axis === 'y' ? { block: 'center', inline: 'nearest' } : { inline: 'center', block: 'nearest' }
    );
  }
}

function showToast(el, text) {
  el.textContent = text;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 200);
  }, 1200);
}

async function main() {
  const floorStrip = document.getElementById('floorStrip');
  const stripSmall = document.getElementById('stripSmall');
  const stripLarge = document.getElementById('stripLarge');
  const valSmall = document.getElementById('valSmall');
  const valLarge = document.getElementById('valLarge');
  const logBtn = document.getElementById('logBtn');
  const toast = document.getElementById('toast');
  const userChip = document.getElementById('userChip');
  const nameModal = document.getElementById('nameModal');
  const nameInput = document.getElementById('nameInput');
  const nameSaveBtn = document.getElementById('nameSaveBtn');

  const floorChips = buildFloorGrid(floorStrip, { markedValues: PRIMARY_FLOORS });
  const chipsSmall = buildElevatorGrid(stripSmall);
  const chipsLarge = buildElevatorGrid(stripLarge);

  const state = {
    floor: null,
    small: null,
    large: null,
    user: localStorage.getItem(USER_NAME_KEY) || '',
  };

  function refreshUserChip() {
    userChip.textContent = state.user || 'Set name';
  }

  function openNameModal() {
    nameInput.value = state.user;
    nameModal.hidden = false;
    nameInput.focus();
  }

  userChip.addEventListener('click', openNameModal);

  nameSaveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    state.user = name;
    localStorage.setItem(USER_NAME_KEY, name);
    refreshUserChip();
    nameModal.hidden = true;
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameSaveBtn.click();
  });

  refreshUserChip();
  if (!state.user) openNameModal();

  function prefillFloor() {
    const last = localStorage.getItem(LAST_PRIMARY_KEY);
    const next = last === '8' ? -2 : 8; // default to 8 on first run (last === null)
    state.floor = next;
    selectChip(floorChips, next, { scroll: false });
  }

  function updateLogEnabled() {
    logBtn.disabled = !(state.small !== null && state.large !== null);
  }

  floorStrip.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.floor = Number(btn.dataset.value);
    selectChip(floorChips, state.floor, { scroll: false });
  });

  stripSmall.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.small = Number(btn.dataset.value);
    selectChip(chipsSmall, state.small, { scroll: false });
    valSmall.textContent = String(state.small);
    updateLogEnabled();
  });

  stripLarge.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.large = Number(btn.dataset.value);
    selectChip(chipsLarge, state.large, { scroll: false });
    valLarge.textContent = String(state.large);
    updateLogEnabled();
  });

  logBtn.addEventListener('click', async () => {
    if (logBtn.disabled) return;
    const record = {
      timestamp: Date.now(),
      floor: state.floor,
      small: state.small,
      large: state.large,
      user: state.user,
    };
    logBtn.disabled = true;
    try {
      await ElevatorDB.addLog(record);
      if (record.floor === 8 || record.floor === -2) {
        localStorage.setItem(LAST_PRIMARY_KEY, String(record.floor));
      }
      if (navigator.vibrate) navigator.vibrate(30);
      showToast(toast, `Logged: floor ${record.floor} · Small ${record.small} · Large ${record.large}`);
    } catch (err) {
      showToast(toast, 'Save failed — try again');
      console.error(err);
    }
    // Reset elevator picks for the next observation; re-prefill floor alternation.
    state.small = null;
    state.large = null;
    valSmall.textContent = '–';
    valLarge.textContent = '–';
    selectChip(chipsSmall, null, { scroll: false });
    selectChip(chipsLarge, null, { scroll: false });
    prefillFloor();
    updateLogEnabled();
  });

  prefillFloor();
  updateLogEnabled();
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
