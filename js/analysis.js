function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtDay(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

let allLogs = [];
let freqMode = 'perElevator'; // 'perElevator' | 'aggregated'

async function renderAll() {
  allLogs = await ElevatorDB.getAllLogs(); // newest first
  populateUserFilter(allLogs);
  applyFilterAndRender();
}

function populateUserFilter(logs) {
  const select = document.getElementById('userFilter');
  const filterRow = document.getElementById('userFilterRow');
  const users = Array.from(new Set(logs.map((l) => l.user || 'Unknown'))).sort();

  filterRow.hidden = users.length <= 1;

  const prevValue = select.value || 'all';
  select.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = 'Everyone';
  select.appendChild(allOpt);
  for (const u of users) {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    select.appendChild(opt);
  }
  select.value = Array.from(select.options).some((o) => o.value === prevValue) ? prevValue : 'all';
}

function applyFilterAndRender() {
  const selected = document.getElementById('userFilter').value || 'all';
  const filtered = selected === 'all'
    ? allLogs
    : allLogs.filter((l) => (l.user || 'Unknown') === selected);

  renderStats(filtered);
  renderFrequencyChart(filtered);
  renderHourChart(filtered);
  renderTable(filtered);
}

function renderStats(logs) {
  const total = document.getElementById('statTotal');
  const first = document.getElementById('statFirst');
  const last = document.getElementById('statLast');
  total.textContent = String(logs.length);
  if (logs.length === 0) {
    first.textContent = '–';
    last.textContent = '–';
    return;
  }
  const oldest = logs[logs.length - 1];
  const newest = logs[0];
  first.textContent = fmtDay(oldest.timestamp);
  last.textContent = fmtDay(newest.timestamp);
}

function renderFrequencyChart(logs) {
  const container = document.getElementById('freqChart');
  const empty = document.getElementById('freqEmpty');
  const legend = document.getElementById('freqLegend');
  if (logs.length === 0) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const categories = [];
  for (let f = 16; f >= -2; f--) categories.push(f);

  if (freqMode === 'aggregated') {
    const counts = new Map();
    for (const row of logs) {
      counts.set(row.small, (counts.get(row.small) || 0) + 1);
      counts.set(row.large, (counts.get(row.large) || 0) + 1);
    }
    legend.innerHTML = '<span class="legend-item"><span class="legend-swatch" style="background:var(--accent)"></span>Both elevators</span>';
    renderHorizontalGroupedBars(container, {
      categories,
      series: [
        { key: 'both', name: 'Both elevators', color: 'var(--accent)', values: counts },
      ],
    });
    return;
  }

  const countsSmall = new Map();
  const countsLarge = new Map();
  for (const row of logs) {
    countsSmall.set(row.small, (countsSmall.get(row.small) || 0) + 1);
    countsLarge.set(row.large, (countsLarge.get(row.large) || 0) + 1);
  }

  legend.innerHTML = `
    <span class="legend-item"><span class="legend-swatch" style="background:var(--series-a)"></span>Small</span>
    <span class="legend-item"><span class="legend-swatch" style="background:var(--series-b)"></span>Large</span>
  `;
  renderHorizontalGroupedBars(container, {
    categories,
    series: [
      { key: 'small', name: 'Small', color: 'var(--series-a)', values: countsSmall },
      { key: 'large', name: 'Large', color: 'var(--series-b)', values: countsLarge },
    ],
  });
}

function setFreqMode(mode) {
  if (mode === freqMode) return;
  freqMode = mode;
  document.getElementById('freqModePerElevator').classList.toggle('is-active', mode === 'perElevator');
  document.getElementById('freqModePerElevator').setAttribute('aria-pressed', String(mode === 'perElevator'));
  document.getElementById('freqModeAggregated').classList.toggle('is-active', mode === 'aggregated');
  document.getElementById('freqModeAggregated').setAttribute('aria-pressed', String(mode === 'aggregated'));
  applyFilterAndRender();
}

function renderHourChart(logs) {
  const container = document.getElementById('hourChart');
  const empty = document.getElementById('hourEmpty');
  if (logs.length === 0) {
    container.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const sums = new Array(24).fill(0);
  const counts = new Array(24).fill(0);
  for (const row of logs) {
    const hour = new Date(row.timestamp).getHours();
    const dist = Math.min(Math.abs(row.floor - row.small), Math.abs(row.floor - row.large));
    sums[hour] += dist;
    counts[hour] += 1;
  }
  const categories = Array.from({ length: 24 }, (_, h) => h);
  const values = categories.map((h) => (counts[h] > 0 ? sums[h] / counts[h] : null));

  renderColumnChart(container, {
    categories,
    values,
    counts,
    color: 'var(--series-a)',
    valueFormatter: (v) => `${v.toFixed(1)} floors`,
  });
}

function clampFloor(v) {
  return Math.max(FLOOR_MIN, Math.min(FLOOR_MAX, Math.round(v)));
}

function buildLogRow(row) {
  const tr = document.createElement('tr');

  const tdWhen = document.createElement('td');
  tdWhen.textContent = fmtDate(row.timestamp);
  tr.appendChild(tdWhen);

  const tdUser = document.createElement('td');
  tdUser.textContent = row.user || 'Unknown';
  tr.appendChild(tdUser);

  const tdFloor = document.createElement('td');
  const tdSmall = document.createElement('td');
  const tdLarge = document.createElement('td');
  const tdActions = document.createElement('td');
  tr.appendChild(tdFloor);
  tr.appendChild(tdSmall);
  tr.appendChild(tdLarge);
  tr.appendChild(tdActions);

  function showView() {
    tdFloor.textContent = String(row.floor);
    tdSmall.textContent = String(row.small);
    tdLarge.textContent = String(row.large);

    tdActions.innerHTML = '';
    const editBtn = document.createElement('button');
    editBtn.className = 'row-action';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Edit entry');
    editBtn.addEventListener('click', showEdit);

    const delBtn = document.createElement('button');
    delBtn.className = 'row-action row-delete';
    delBtn.textContent = '🗑';
    delBtn.setAttribute('aria-label', 'Delete entry');
    delBtn.addEventListener('click', async () => {
      try {
        await ElevatorDB.deleteLog(row.id);
        await renderAll();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    });

    tdActions.append(editBtn, delBtn);
  }

  function numberInput(value) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'row-edit-input';
    input.value = String(value);
    input.min = String(FLOOR_MIN);
    input.max = String(FLOOR_MAX);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') showView();
    });
    return input;
  }

  async function save() {
    const rawFloor = floorInput.value.trim();
    const rawSmall = smallInput.value.trim();
    const rawLarge = largeInput.value.trim();
    if (rawFloor === '' || rawSmall === '' || rawLarge === '') {
      alert('Enter a value for every field.');
      return;
    }
    const floor = clampFloor(Number(rawFloor));
    const small = clampFloor(Number(rawSmall));
    const large = clampFloor(Number(rawLarge));
    if ([floor, small, large].some((v) => Number.isNaN(v))) {
      alert('Enter valid numbers.');
      return;
    }
    try {
      const updated = await ElevatorDB.updateLog(row.id, { floor, small, large });
      if (!updated) {
        alert('This entry no longer exists — it may have been deleted elsewhere.');
        await renderAll();
        return;
      }
      row.floor = floor;
      row.small = small;
      row.large = large;
      applyFilterAndRender();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }

  let floorInput, smallInput, largeInput;

  function showEdit() {
    floorInput = numberInput(row.floor);
    smallInput = numberInput(row.small);
    largeInput = numberInput(row.large);

    tdFloor.innerHTML = ''; tdFloor.appendChild(floorInput);
    tdSmall.innerHTML = ''; tdSmall.appendChild(smallInput);
    tdLarge.innerHTML = ''; tdLarge.appendChild(largeInput);

    tdActions.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'row-action';
    saveBtn.textContent = '✔️';
    saveBtn.setAttribute('aria-label', 'Save changes');
    saveBtn.addEventListener('click', save);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'row-action';
    cancelBtn.textContent = '✖️';
    cancelBtn.setAttribute('aria-label', 'Cancel edit');
    cancelBtn.addEventListener('click', showView);

    tdActions.append(saveBtn, cancelBtn);
    floorInput.focus();
  }

  showView();
  return tr;
}

function renderTable(logs) {
  const tbody = document.getElementById('logTableBody');
  const empty = document.getElementById('tableEmpty');
  tbody.innerHTML = '';
  if (logs.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const row of logs) {
    tbody.appendChild(buildLogRow(row));
  }
}

function setupDataActions() {
  document.getElementById('exportBtn').addEventListener('click', async () => {
    const json = await ElevatorDB.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `elevator-log-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById('importInput');
  document.getElementById('importBtn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { added, skipped } = await ElevatorDB.importJson(text);
      await renderAll();
      if (skipped > 0) {
        alert(`Imported ${added} entr${added === 1 ? 'y' : 'ies'}. Skipped ${skipped} row${skipped === 1 ? '' : 's'} with missing or invalid data (e.g. from an older export format).`);
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    importInput.value = '';
  });

  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (!confirm('Delete all logged entries? This cannot be undone.')) return;
    try {
      await ElevatorDB.clearAll();
      await renderAll();
    } catch (err) {
      alert('Clear failed: ' + err.message);
    }
  });
}

document.getElementById('userFilter').addEventListener('change', applyFilterAndRender);
document.getElementById('freqModePerElevator').addEventListener('click', () => setFreqMode('perElevator'));
document.getElementById('freqModeAggregated').addEventListener('click', () => setFreqMode('aggregated'));

window.addEventListener('resize', () => {
  clearTimeout(window._resizeT);
  window._resizeT = setTimeout(applyFilterAndRender, 150);
});

setupDataActions();
renderAll();
