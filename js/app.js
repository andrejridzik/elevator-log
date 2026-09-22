const LAST_PRIMARY_KEY = 'elevatorlog.lastPrimaryFloor';
const USER_NAME_KEY = 'elevatorlog.userName';
const PRIMARY_FLOORS_KEY = 'elevatorlog.primaryFloors';

function getPrimaryFloors() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRIMARY_FLOORS_KEY));
    if (Array.isArray(parsed) && parsed.length === 2 &&
        parsed.every(isValidFloor) && parsed[0] !== parsed[1]) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

function setPrimaryFloors(a, b) {
  localStorage.setItem(PRIMARY_FLOORS_KEY, JSON.stringify([a, b]));
}

function populateFloorSelect(select) {
  for (let v = FLOOR_MIN; v <= FLOOR_MAX; v++) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    select.appendChild(opt);
  }
}

// -2, -1, 0 share a row (they're all "near ground"), then 1-16 fill two even
// rows of 8 below.
function buildFloorGrid(container, { markedValues = [] } = {}) {
  container.innerHTML = '';
  const chips = new Map();
  const cells = [];
  for (const v of [-2, -1, 0]) cells.push({ value: v, span: 8 });
  for (let v = 1; v <= FLOOR_MAX; v++) cells.push({ value: v, span: 3 });

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
  const setupModal = document.getElementById('setupModal');
  const nameInput = document.getElementById('nameInput');
  const floorASelect = document.getElementById('floorASelect');
  const floorBSelect = document.getElementById('floorBSelect');
  const setupError = document.getElementById('setupError');
  const setupSaveBtn = document.getElementById('setupSaveBtn');

  populateFloorSelect(floorASelect);
  populateFloorSelect(floorBSelect);

  let primaryFloors = getPrimaryFloors();
  let floorChips = buildFloorGrid(floorStrip, { markedValues: primaryFloors || [] });
  const chipsSmall = buildElevatorGrid(stripSmall);
  const chipsLarge = buildElevatorGrid(stripLarge);

  const state = {
    floor: null,
    small: null,
    large: null,
    user: localStorage.getItem(USER_NAME_KEY) || '',
  };

  function refreshUserChip() {
    userChip.textContent = state.user || 'Set up';
  }

  function openSetupModal() {
    nameInput.value = state.user;
    if (primaryFloors) {
      floorASelect.value = String(primaryFloors[0]);
      floorBSelect.value = String(primaryFloors[1]);
    } else {
      floorASelect.selectedIndex = 0;
      floorBSelect.selectedIndex = floorBSelect.options.length - 1;
    }
    setupError.hidden = true;
    setupModal.hidden = false;
    nameInput.focus();
  }

  userChip.addEventListener('click', openSetupModal);

  setupSaveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const a = Number(floorASelect.value);
    const b = Number(floorBSelect.value);
    if (!name || a === b) {
      setupError.hidden = false;
      return;
    }
    state.user = name;
    localStorage.setItem(USER_NAME_KEY, name);
    primaryFloors = [a, b];
    setPrimaryFloors(a, b);
    refreshUserChip();
    floorChips = buildFloorGrid(floorStrip, { markedValues: primaryFloors });
    await prefillFloor();
    setupModal.hidden = true;
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setupSaveBtn.click();
  });

  refreshUserChip();
  if (!state.user || !primaryFloors) openSetupModal();

  async function prefillFloor() {
    if (!primaryFloors) return;
    const [a, b] = primaryFloors;
    let last = localStorage.getItem(LAST_PRIMARY_KEY);
    if (last === null) {
      // localStorage lost the "last primary floor" marker (cleared, private
      // browsing, storage eviction) — fall back to the real last log rather
      // than blindly guessing `a`.
      const lastLog = await ElevatorDB.getLastLog();
      if (lastLog && primaryFloors.includes(lastLog.floor)) {
        last = String(lastLog.floor);
      }
    }
    const next = last === String(a) ? b : a;
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
      if (primaryFloors && primaryFloors.includes(record.floor)) {
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
    await prefillFloor();
    updateLogEnabled();
  });

  await prefillFloor();
  updateLogEnabled();
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
