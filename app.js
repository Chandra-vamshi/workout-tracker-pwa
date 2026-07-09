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
  incompleteWorkoutId: null,
  editingWorkoutId: null
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
  completeSoreness: document.querySelector('#completeSoreness'),
  saveWorkoutBtn: document.querySelector('#saveWorkoutBtn'),
  logHeading: document.querySelector('#log-heading')
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
  state.editingWorkoutId = null;
  els.form.reset();
  els.date.value = todayISO();
  els.exerciseList.innerHTML = '';
  els.cardioList.innerHTML = '';
  els.logHeading.textContent = 'New workout';
  els.saveWorkoutBtn.textContent = 'Save workout';
  addExercise();
}

function populateWorkoutForm(workout, options = {}) {
  els.form.reset();
  els.exerciseList.innerHTML = '';
  els.cardioList.innerHTML = '';

  els.date.value = options.useToday ? todayISO() : workout.date || todayISO();
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
    .sort(sortWorkoutsNewestFirst)[0] || null;
}

function sortWorkoutsNewestFirst(a, b) {
  const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
  if (dateCompare) return dateCompare;
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
}

function findWorkoutById(id) {
  return state.workouts.find(workout => workout.id === id) || null;
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
  updateIncompleteButton();
}

function showCompleteWorkoutForm(workoutId = null) {
  const workout = workoutId ? findWorkoutById(workoutId) : findMostRecentIncompleteWorkout();

  if (!workout || hasSleep(workout)) {
    alert('All workouts are complete.');
    showDashboardForm();
    return;
  }

  state.incompleteWorkoutId = workout.id;
  els.form.hidden = true;
  els.dashboardActions.hidden = true;
  els.completeWorkoutForm.hidden = false;

  els.completeWorkoutMessage.textContent = `${workout.date || 'Workout'} · ${workout.workoutType || 'Workout'}`;
  els.completeSleepHours.value = workout.sleepHours || '';
  els.completeSleepMinutes.value = workout.sleepMinutes || '';
  els.completeEnergy.value = workout.energy || '';
  els.completeSoreness.value = workout.soreness || '';

  switchTab('log', { keepCompleteForm: true });
  els.completeSleepHours.focus();
}

function saveCompletedWorkout(event) {
  event.preventDefault();

  const workout = findWorkoutById(state.incompleteWorkoutId);

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
  switchTab('history');
}

function editWorkout(workoutId) {
  const workout = findWorkoutById(workoutId);
  if (!workout) return;

  state.editingWorkoutId = workout.id;
  populateWorkoutForm(workout, { useToday: false });
  els.logHeading.textContent = 'Edit workout';
  els.saveWorkoutBtn.textContent = 'Update workout';
  showDashboardForm();
  switchTab('log');
}

function duplicateWorkout(workoutId) {
  const workout = findWorkoutById(workoutId);
  if (!workout) return;

  state.editingWorkoutId = null;
  populateWorkoutForm(workout, { useToday: true });
  els.logHeading.textContent = 'New workout';
  els.saveWorkoutBtn.textContent = 'Save workout';
  showDashboardForm();
  switchTab('log');
}

function saveWorkoutFromForm(event) {
  event.preventDefault();
  const formWorkout = collectWorkout();

  if (state.editingWorkoutId) {
    const existingWorkout = findWorkoutById(state.editingWorkoutId);
    if (!existingWorkout) {
      state.editingWorkoutId = null;
      return;
    }

    existingWorkout.date = formWorkout.date;
    existingWorkout.workoutType = formWorkout.workoutType;
    existingWorkout.exercises = formWorkout.exercises;
    existingWorkout.cardio = formWorkout.cardio;
    existingWorkout.energy = formWorkout.energy;
    existingWorkout.soreness = formWorkout.soreness;
    existingWorkout.sleepHours = formWorkout.sleepHours;
    existingWorkout.sleepMinutes = formWorkout.sleepMinutes;
    existingWorkout.notes = formWorkout.notes;

    saveWorkouts();
    resetForm();
    renderHistory();
    renderCsv();
    updateIncompleteButton();
    switchTab('history');
    return;
  }

  state.workouts.push(formWorkout);
  saveWorkouts();
  resetForm();
  renderHistory();
  renderCsv();
  updateIncompleteButton();
  switchTab('history');
}

function switchTab(tabName, options = {}) {
  els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  els.panels.forEach(panel => panel.classList.toggle('active', panel.id === tabName));

  if (tabName !== 'log') {
    showDashboardForm();
  }

  if (tabName === 'log' && !options.keepCompleteForm && els.completeWorkoutForm.hidden) {
    updateIncompleteButton();
  }

  if (tabName === 'history') renderHistory();
  if (tabName === 'export') renderCsv();
}

function getCardioSummary(workout) {
  if (!workout.cardio || !workout.cardio.length) return '';

  return workout.cardio
    .map(cardio => {
      const time = cardio.timeMinutes ? `${cardio.timeMinutes} min` : 'cardio';
      return `${cardio.machine || 'Cardio'} • ${time}`;
    })
    .join(' · ');
}

function renderHistory() {
  if (!state.workouts.length) {
    els.historyList.innerHTML = '<p class="muted">No workouts saved yet.</p>';
    updateIncompleteButton();
    return;
  }

  const sorted = [...state.workouts].sort(sortWorkoutsNewestFirst);

  els.historyList.innerHTML = sorted.map(workout => {
    const complete = hasSleep(workout);
    const exerciseCount = workout.exercises ? workout.exercises.length : 0;
    const cardioSummary = getCardioSummary(workout);
    const status = complete ? '🟢 Complete' : '🟡 Incomplete';

    return `
      <article class="history-item">
        <h3>${escapeHtml(workout.workoutType || 'Workout')}</h3>
        <div class="history-meta">
          <div>${escapeHtml(workout.date || '')}</div>
          <div>${status}</div>
          <div>${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}${cardioSummary ? ` · ${escapeHtml(cardioSummary)}` : ''}</div>
          <div>Energy: ${escapeHtml(workout.energy || '-')} /10 · Soreness: ${escapeHtml(workout.soreness || '-')} /10</div>
        </div>
        <div class="history-actions">
          <button class="secondary" data-edit="${workout.id}" type="button">Edit</button>
          <button class="secondary" data-duplicate="${workout.id}" type="button">Duplicate</button>
          ${complete ? '' : `<button class="primary" data-complete="${workout.id}" type="button">Complete</button>`}
          <button class="danger" data-delete="${workout.id}" type="button">Delete</button>
        </div>
      </article>
    `;
  }).join('');

  els.historyList.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => editWorkout(button.dataset.edit));
  });

  els.historyList.querySelectorAll('[data-duplicate]').forEach(button => {
    button.addEventListener('click', () => duplicateWorkout(button.dataset.duplicate));
  });

  els.historyList.querySelectorAll('[data-complete]').forEach(button => {
    button.addEventListener('click', () => showCompleteWorkoutForm(button.dataset.complete));
  });

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
  document.querySelector('#completeIncompleteWorkoutBtn').addEventListener('click', () => showCompleteWorkoutForm());
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
  els.form.addEventListener('submit', saveWorkoutFromForm);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }
}

document.addEventListener('DOMContentLoaded', init);
