const STORAGE_KEY = 'workout-tracker-v1';

const strengthExercises = [
  'Chest Press',
  'Shoulder Press',
  'Lat Pulldown',
  'Mid Row',
  'Bicep Curl',
  'Tricep Extension',
  'Leg Extension',
  'Hamstring Curl',
  'Leg Press'
];

const cardioMachines = ['Treadmill', 'Elliptical', 'Cycle'];

const state = {
  workouts: loadWorkouts(),
  incompleteWorkoutId: null
};

const els = {
  tabs: document.querySelectorAll('.tab'),
  panels: document.querySelectorAll('.panel'),
  form: document.querySelector('#workoutForm'),
  completeWorkoutForm: document.querySelector('#completeWorkoutForm'),
  date: document.querySelector('#date'),
  workoutType: document.querySelector('#workoutType'),
  exerciseList: document.querySelector('#exerciseList'),
  cardioList: document.querySelector('#cardioList'),
  historyList: document.querySelector('#historyList'),
  csvPreview: document.querySelector('#csvPreview'),
  installDialog: document.querySelector('#installDialog'),
  completeIncompleteWorkoutBtn: document.querySelector('#completeIncompleteWorkoutBtn'),
  dashboardActions: document.querySelector('#dashboardActions'),
  completeWorkoutMessage: document.querySelector('#completeWorkoutMessage'),
  completeSleepHours: document.querySelector('#completeSleepHours'),
  completeSleepMinutes: document.querySelector('#completeSleepMinutes'),
  completeEnergy: document.querySelector('#completeEnergy'),
  completeSoreness: document.querySelector('#completeSoreness')
};

function todayISO() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadWorkouts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workouts));
}

function fillSelect(select, options) {
  select.innerHTML = options.map(option => `<option>${option}</option>`).join('');
}

function addExercise(data = {}) {
  const node = document.querySelector('#exerciseTemplate').content.firstElementChild.cloneNode(true);
  fillSelect(node.querySelector('.exercise-name'), strengthExercises);
  node.querySelector('.exercise-name').value = data.name || strengthExercises[0];
  node.querySelector('.exercise-sets').value = data.sets || '';
  node.querySelector('.exercise-reps').value = data.reps || '';
  node.querySelector('.exercise-weight').value = data.weight || '';
  node.querySelector('.remove-entry').addEventListener('click', () => node.remove());
  els.exerciseList.appendChild(node);
}

function addCardio(data = {}) {
  const node = document.querySelector('#cardioTemplate').content.firstElementChild.cloneNode(true);
  fillSelect(node.querySelector('.cardio-machine'), cardioMachines);
  node.querySelector('.cardio-machine').value = data.machine || cardioMachines[0];
  node.querySelector('.cardio-time').value = data.timeMinutes || '';
  node.querySelector('.cardio-intensity').value = data.intensity || '';
  node.querySelector('.cardio-incline').value = data.incline || '';
  node.querySelector('.remove-entry').addEventListener('click', () => node.remove());
  els.cardioList.appendChild(node);
}

function collectWorkout() {
  const exercises = [...els.exerciseList.querySelectorAll('.exercise-entry')]
    .map(entry => ({
      name: entry.querySelector('.exercise-name').value,
      sets: entry.querySelector('.exercise-sets').value.trim(),
      reps: entry.querySelector('.exercise-reps').value.trim(),
      weight: entry.querySelector('.exercise-weight').value.trim()
    }))
    .filter(item => item.sets || item.reps || item.weight);

  const cardio = [...els.cardioList.querySelectorAll('.cardio-entry')]
    .map(entry => ({
      machine: entry.querySelector('.cardio-machine').value,
      timeMinutes: entry.querySelector('.cardio-time').value.trim(),
      intensity: entry.querySelector('.cardio-intensity').value.trim(),
      incline: entry.querySelector('.cardio-incline').value.trim()
    }))
    .filter(item => item.timeMinutes || item.intensity || item.incline);

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    date: els.date.value,
    workoutType: els.workoutType.value,
    exercises,
    cardio,
    energy: document.querySelector('#energy').value.trim(),
    soreness: document.querySelector('#soreness').value.trim(),
    sleepHours: document.querySelector('#sleepHours').value.trim(),
    sleepMinutes: document.querySelector('#sleepMinutes').value.trim(),
    notes: document.querySelector('#notes').value.trim()
  };
}

function resetForm() {
  els.form.reset();
  els.date.value = todayISO();
  els.exerciseList.innerHTML = '';
  els.cardioList.innerHTML = '';
  addExercise();
}

function populateWorkoutForm(workout) {
  els.form.reset();
  els.exerciseList.innerHTML = '';
  els.cardioList.innerHTML = '';

  els.date.value = todayISO();
  els.workoutType.value = workout.workoutType || 'Full Body';

  document.querySelector('#energy').value = workout.energy || '';
  document.querySelector('#soreness').value = workout.soreness || '';
  document.querySelector('#sleepHours').value = workout.sleepHours || '';
  document.querySelector('#sleepMinutes').value = workout.sleepMinutes || '';
  document.querySelector('#notes').value = workout.notes || '';

  if (workout.exercises && workout.exercises.length) {
    workout.exercises.forEach(exercise => addExercise(exercise));
  } else {
    addExercise();
  }

  if (workout.cardio && workout.cardio.length) {
    workout.cardio.forEach(cardio => addCardio(cardio));
  }
}

function hasSleep(workout) {
  const hours = String(workout.sleepHours ?? '').trim();
  const minutes = String(workout.sleepMinutes ?? '').trim();
  return hours !== '' || minutes !== '';
}

function findMostRecentIncompleteWorkout() {
  return [...state.workouts]
    .filter(workout => !hasSleep(workout))
    .sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCompare) return dateCompare;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    })[0] || null;
}

function updateIncompleteButton() {
  const incompleteWorkout = findMostRecentIncompleteWorkout();
  els.completeIncompleteWorkoutBtn.hidden = !incompleteWorkout;
  els.dashboardActions.hidden = !incompleteWorkout;
}

function showDashboardForm() {
  state.incompleteWorkoutId = null;
  els.completeWorkoutForm.hidden = true;
  els.form.hidden = false;
  document.querySelector('#duplicateLastWorkoutBtn').hidden = false;
  updateIncompleteButton();
}

function showCompleteWorkoutForm() {
  const workout = findMostRecentIncompleteWorkout();

  if (!workout) {
    alert('All workouts are complete.');
    showDashboardForm();
    return;
  }

  state.incompleteWorkoutId = workout.id;
  els.form.hidden = true;
  els.dashboardActions.hidden = true;
  document.querySelector('#duplicateLastWorkoutBtn').hidden = true;
  els.completeWorkoutForm.hidden = false;

  els.completeWorkoutMessage.textContent = `${workout.date || 'Workout'} · ${workout.workoutType || 'Workout'}`;
  els.completeSleepHours.value = workout.sleepHours || '';
  els.completeSleepMinutes.value = workout.sleepMinutes || '';
  els.completeEnergy.value = workout.energy || '';
  els.completeSoreness.value = workout.soreness || '';

  els.completeSleepHours.focus();
}

function saveCompletedWorkout(event) {
  event.preventDefault();

  const workout = state.workouts.find(item => item.id === state.incompleteWorkoutId);

  if (!workout) {
    alert('All workouts are complete.');
    showDashboardForm();
    return;
  }

  workout.sleepHours = els.completeSleepHours.value.trim();
  workout.sleepMinutes = els.completeSleepMinutes.value.trim();
  workout.energy = els.completeEnergy.value.trim();
  workout.soreness = els.completeSoreness.value.trim();

  saveWorkouts();
  renderHistory();
  renderCsv();
  showDashboardForm();
  switchTab('log');
}

function duplicateLastWorkout() {
  if (!state.workouts.length) {
    alert('No previous workout found.');
    return;
  }

  const sorted = [...state.workouts].sort((a, b) => {
    const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCompare) return dateCompare;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });

  const lastWorkout = sorted[0];
  populateWorkoutForm(lastWorkout);
  switchTab('log');
}

function switchTab(tabName) {
  els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  els.panels.forEach(panel => panel.classList.toggle('active', panel.id === tabName));

  if (tabName !== 'log') {
    showDashboardForm();
  }

  if (tabName === 'history') renderHistory();
  if (tabName === 'export') renderCsv();
}

function summarizeWorkout(workout) {
  const strength = workout.exercises.map(ex => `${ex.name}: ${ex.sets || '-'}x${ex.reps || '-'} @ ${ex.weight || '-'} lb`);
  const cardio = workout.cardio.map(c => `${c.machine}: ${c.timeMinutes || '-'} min, ${c.intensity || '-'}${c.incline ? `, incline ${c.incline}` : ''}`);
  return [...strength, ...cardio];
}

function renderHistory() {
  if (!state.workouts.length) {
    els.historyList.innerHTML = '<p class="muted">No workouts saved yet.</p>';
    updateIncompleteButton();
    return;
  }

  const sorted = [...state.workouts].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  els.historyList.innerHTML = sorted.map(workout => {
    const summary = summarizeWorkout(workout).map(line => `<div>${escapeHtml(line)}</div>`).join('') || '<div>No exercise details saved.</div>';
    const sleep = hasSleep(workout) ? [workout.sleepHours || 0, 'h ', workout.sleepMinutes || 0, 'm'].join('') : 'Incomplete';
    return `
      <article class="history-item">
        <h3>${escapeHtml(workout.date)} · ${escapeHtml(workout.workoutType)}</h3>
        <div class="history-meta">
          ${summary}
          <div>Energy: ${escapeHtml(workout.energy || '-')} /10 · Soreness: ${escapeHtml(workout.soreness || '-')} /10 · Sleep: ${escapeHtml(sleep)}</div>
          ${workout.notes ? `<div>Notes: ${escapeHtml(workout.notes)}</div>` : ''}
        </div>
        <div class="history-actions"><button class="danger" data-delete="${workout.id}" type="button">Delete</button></div>
      </article>
    `;
  }).join('');

  els.historyList.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      state.workouts = state.workouts.filter(workout => workout.id !== button.dataset.delete);
      saveWorkouts();
      renderHistory();
      renderCsv();
      updateIncompleteButton();
    });
  });

  updateIncompleteButton();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsvRows() {
  const headers = [
    'date', 'workout_type', 'entry_type', 'name', 'sets', 'reps', 'weight',
    'cardio_time_minutes', 'speed_or_resistance', 'incline', 'energy_10',
    'soreness_10', 'sleep_hours', 'sleep_minutes', 'notes'
  ];

  const rows = [headers];
  state.workouts.forEach(workout => {
    workout.exercises.forEach(ex => rows.push([
      workout.date, workout.workoutType, 'strength', ex.name, ex.sets, ex.reps, ex.weight,
      '', '', '', workout.energy, workout.soreness, workout.sleepHours, workout.sleepMinutes, workout.notes
    ]));
    workout.cardio.forEach(c => rows.push([
      workout.date, workout.workoutType, 'cardio', c.machine, '', '', '', c.timeMinutes,
      c.intensity, c.incline, workout.energy, workout.soreness, workout.sleepHours, workout.sleepMinutes, workout.notes
    ]));
    if (!workout.exercises.length && !workout.cardio.length) {
      rows.push([workout.date, workout.workoutType, 'workout', '', '', '', '', '', '', '', workout.energy, workout.soreness, workout.sleepHours, workout.sleepMinutes, workout.notes]);
    }
  });
  return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

function renderCsv() {
  els.csvPreview.value = toCsvRows();
}

function downloadCsv() {
  const blob = new Blob([toCsvRows()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workout-export-${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function init() {
  els.date.value = todayISO();
  addExercise();
  renderHistory();
  renderCsv();
  updateIncompleteButton();

  els.tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
  document.querySelector('#addExerciseBtn').addEventListener('click', () => addExercise());
  document.querySelector('#addCardioBtn').addEventListener('click', () => addCardio());
  document.querySelector('#duplicateLastWorkoutBtn').addEventListener('click', duplicateLastWorkout);
  document.querySelector('#completeIncompleteWorkoutBtn').addEventListener('click', showCompleteWorkoutForm);
  document.querySelector('#completeWorkoutForm').addEventListener('submit', saveCompletedWorkout);
  document.querySelector('#cancelCompleteWorkoutBtn').addEventListener('click', showDashboardForm);
  document.querySelector('#resetFormBtn').addEventListener('click', resetForm);
  document.querySelector('#downloadCsvBtn').addEventListener('click', downloadCsv);
  document.querySelector('#copyCsvBtn').addEventListener('click', async () => {
    renderCsv();
    await navigator.clipboard.writeText(els.csvPreview.value);
  });
  document.querySelector('#clearAllBtn').addEventListener('click', () => {
    if (!state.workouts.length) return;
    if (confirm('Delete all saved workouts from this device?')) {
      state.workouts = [];
      saveWorkouts();
      renderHistory();
      renderCsv();
      updateIncompleteButton();
      showDashboardForm();
    }
  });
  document.querySelector('#installHintBtn').addEventListener('click', () => els.installDialog.showModal());
  document.querySelector('#closeInstallDialog').addEventListener('click', () => els.installDialog.close());

  els.form.addEventListener('submit', event => {
    event.preventDefault();
    const workout = collectWorkout();
    state.workouts.push(workout);
    saveWorkouts();
    resetForm();
    renderHistory();
    renderCsv();
    updateIncompleteButton();
    switchTab('history');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }
}

document.addEventListener('DOMContentLoaded', init);
