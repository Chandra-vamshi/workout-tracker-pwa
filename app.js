const STORAGE_KEY = 'workout-tracker-v1';
const RECOVERY_STORAGE_KEY = 'workoutTrackerRecoveryBackup';
const BACKUP_FORMAT_VERSION = 2;

/*
  Previous keys are checked only for safe import.

  They are not deleted automatically.
*/
const PREVIOUS_STORAGE_KEYS = [
  'workoutTrackerWorkouts',
  'workout-tracker-workouts',
  'workoutTrackerData'
];

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

const cardioMachines = [
  'Treadmill',
  'Elliptical',
  'Cycle'
];

const state = {
  workouts: [],
  incompleteWorkoutId: null,
  editingWorkoutId: null
};

const els = {};

function cacheElements() {
  els.tabs = document.querySelectorAll('.tab');
  els.panels = document.querySelectorAll('.panel');
  els.form = document.querySelector('#workoutForm');
  els.completeWorkoutForm = document.querySelector('#completeWorkoutForm');
  els.date = document.querySelector('#date');
  els.workoutType = document.querySelector('#workoutType');
  els.exerciseList = document.querySelector('#exerciseList');
  els.cardioList = document.querySelector('#cardioList');
  els.historyList = document.querySelector('#historyList');
  els.csvPreview = document.querySelector('#csvPreview');
  els.installDialog = document.querySelector('#installDialog');
  els.completeIncompleteWorkoutBtn = document.querySelector(
    '#completeIncompleteWorkoutBtn'
  );
  els.dashboardActions = document.querySelector('#dashboardActions');
  els.completeWorkoutMessage = document.querySelector(
    '#completeWorkoutMessage'
  );
  els.completeSleepHours = document.querySelector('#completeSleepHours');
  els.completeSleepMinutes = document.querySelector('#completeSleepMinutes');
  els.completeEnergy = document.querySelector('#completeEnergy');
  els.completeSoreness = document.querySelector('#completeSoreness');
  els.saveWorkoutBtn = document.querySelector('#saveWorkoutBtn');
  els.logHeading = document.querySelector('#log-heading');
  els.appMessage = document.querySelector('#appMessage');
  els.backupFileInput = document.querySelector('#backupFileInput');
}

function todayISO() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function safeString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function parseStoredArray(storageKey) {
  const raw = localStorage.getItem(storageKey);

  if (raw === null) {
    return {
      exists: false,
      valid: true,
      workouts: []
    };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        exists: true,
        valid: false,
        workouts: []
      };
    }

    return {
      exists: true,
      valid: true,
      workouts: parsed
    };
  } catch {
    return {
      exists: true,
      valid: false,
      workouts: []
    };
  }
}

function createRecoverySnapshot(workouts, reason = 'safety-snapshot') {
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return false;
  }

  try {
    const snapshot = {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      reason,
      workouts: deepClone(workouts)
    };

    localStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify(snapshot)
    );

    return true;
  } catch {
    return false;
  }
}

function normalizeSet(setValue) {
  if (!isPlainObject(setValue)) {
    return {
      weight: '',
      reps: ''
    };
  }

  return {
    ...setValue,
    weight: safeString(setValue.weight),
    reps: safeString(setValue.reps)
  };
}

function migrateExercise(exerciseValue) {
  if (!isPlainObject(exerciseValue)) {
    return {
      name: safeString(exerciseValue),
      sets: []
    };
  }

  const migrated = {
    ...exerciseValue,
    name: safeString(exerciseValue.name)
  };

  if (Array.isArray(exerciseValue.sets)) {
    migrated.sets = exerciseValue.sets.map(normalizeSet);
    return migrated;
  }

  const legacySetCount = Number.parseInt(
    safeString(exerciseValue.sets),
    10
  );

  const legacyWeight = safeString(exerciseValue.weight);
  const legacyReps = safeString(exerciseValue.reps);

  if (
    Number.isFinite(legacySetCount) &&
    legacySetCount > 0
  ) {
    const safeCount = Math.min(legacySetCount, 100);

    migrated.sets = Array.from(
      { length: safeCount },
      () => ({
        weight: legacyWeight,
        reps: legacyReps
      })
    );

    return migrated;
  }

  if (legacyWeight !== '' || legacyReps !== '') {
    migrated.sets = [
      {
        weight: legacyWeight,
        reps: legacyReps
      }
    ];

    return migrated;
  }

  if (
    exerciseValue.sets !== undefined &&
    exerciseValue.sets !== null &&
    exerciseValue.sets !== ''
  ) {
    migrated.legacySetsValue = exerciseValue.sets;
  }

  migrated.sets = [];
  return migrated;
}

function migrateCardio(cardioValue) {
  if (!isPlainObject(cardioValue)) {
    return {
      machine: safeString(cardioValue),
      timeMinutes: '',
      intensity: '',
      incline: ''
    };
  }

  return {
    ...cardioValue,
    machine: safeString(cardioValue.machine),
    timeMinutes: safeString(cardioValue.timeMinutes),
    intensity: safeString(cardioValue.intensity),
    incline: safeString(cardioValue.incline)
  };
}

function migrateWorkout(workoutValue) {
  if (!isPlainObject(workoutValue)) {
    return {
      id: uid(),
      createdAt: new Date().toISOString(),
      date: '',
      workoutType: 'Full Body',
      exercises: [],
      cardio: [],
      energy: '',
      soreness: '',
      sleepHours: '',
      sleepMinutes: '',
      notes: '',
      legacyValue: workoutValue
    };
  }

  const exercises = Array.isArray(workoutValue.exercises)
    ? workoutValue.exercises.map(migrateExercise)
    : [];

  const cardio = Array.isArray(workoutValue.cardio)
    ? workoutValue.cardio.map(migrateCardio)
    : [];

  return {
    ...workoutValue,
    id: safeString(workoutValue.id) || uid(),
    createdAt:
      safeString(workoutValue.createdAt) ||
      new Date().toISOString(),
    date: safeString(workoutValue.date),
    workoutType:
      safeString(workoutValue.workoutType) ||
      'Full Body',
    exercises,
    cardio,
    energy: safeString(workoutValue.energy),
    soreness: safeString(workoutValue.soreness),
    sleepHours: safeString(workoutValue.sleepHours),
    sleepMinutes: safeString(workoutValue.sleepMinutes),
    notes: safeString(workoutValue.notes)
  };
}

function migrateWorkouts(workouts) {
  if (!Array.isArray(workouts)) {
    throw new Error('Workout history is not a valid list.');
  }

  return workouts.map(migrateWorkout);
}

function stableWorkoutComparisonValue(workout) {
  const normalized = migrateWorkout(workout);

  return JSON.stringify({
    date: normalized.date,
    workoutType: normalized.workoutType,
    exercises: normalized.exercises.map(exercise => ({
      name: exercise.name,
      sets: exercise.sets.map(set => ({
        weight: safeString(set.weight),
        reps: safeString(set.reps)
      }))
    })),
    cardio: normalized.cardio.map(cardio => ({
      machine: cardio.machine,
      timeMinutes: cardio.timeMinutes,
      intensity: cardio.intensity,
      incline: cardio.incline
    })),
    energy: normalized.energy,
    soreness: normalized.soreness,
    sleepHours: normalized.sleepHours,
    sleepMinutes: normalized.sleepMinutes,
    notes: normalized.notes
  });
}

function workoutsAreSame(firstWorkout, secondWorkout) {
  const firstId = safeString(firstWorkout?.id);
  const secondId = safeString(secondWorkout?.id);

  if (firstId && secondId) {
    return firstId === secondId;
  }

  return (
    stableWorkoutComparisonValue(firstWorkout) ===
    stableWorkoutComparisonValue(secondWorkout)
  );
}

function mergeWorkoutLists(existingWorkouts, incomingWorkouts) {
  const merged = existingWorkouts.map(workout => deepClone(workout));
  let importedCount = 0;

  incomingWorkouts.forEach(incomingWorkout => {
    const duplicate = merged.some(existingWorkout =>
      workoutsAreSame(existingWorkout, incomingWorkout)
    );

    if (!duplicate) {
      merged.push(deepClone(incomingWorkout));
      importedCount += 1;
    }
  });

  return {
    workouts: merged,
    importedCount
  };
}

function saveWorkouts(workouts = state.workouts) {
  if (!Array.isArray(workouts)) {
    throw new Error('Workout data could not be saved.');
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(workouts)
  );
}

function loadAndMigrateWorkouts() {
  const stableSource = parseStoredArray(STORAGE_KEY);

  if (stableSource.exists && !stableSource.valid) {
    throw new Error(
      'Saved workout data could not be read. The original data was left unchanged.'
    );
  }

  let mergedRawWorkouts = stableSource.workouts.map(
    workout => deepClone(workout)
  );

  for (const previousKey of PREVIOUS_STORAGE_KEYS) {
    const previousSource = parseStoredArray(previousKey);

    if (!previousSource.exists) {
      continue;
    }

    if (!previousSource.valid) {
      continue;
    }

    const mergedResult = mergeWorkoutLists(
      mergedRawWorkouts,
      previousSource.workouts
    );

    mergedRawWorkouts = mergedResult.workouts;
  }

  const migratedWorkouts = migrateWorkouts(mergedRawWorkouts);

  const originalSerialized = JSON.stringify(stableSource.workouts);
  const migratedSerialized = JSON.stringify(migratedWorkouts);

  const requiresWrite =
    migratedSerialized !== originalSerialized ||
    mergedRawWorkouts.length !== stableSource.workouts.length;

  if (requiresWrite) {
    if (mergedRawWorkouts.length > 0) {
      createRecoverySnapshot(
        mergedRawWorkouts,
        'before-workout-model-migration'
      );
    }

    saveWorkouts(migratedWorkouts);
  }

  return migratedWorkouts;
}

function showMessage(message, type = 'success') {
  els.appMessage.textContent = message;
  els.appMessage.className = `app-message ${type}`;
  els.appMessage.hidden = false;

  window.clearTimeout(showMessage.timeoutId);

  showMessage.timeoutId = window.setTimeout(() => {
    els.appMessage.hidden = true;
  }, 5000);
}

function fillSelect(select, options) {
  select.innerHTML = options
    .map(option => `<option>${escapeHtml(option)}</option>`)
    .join('');
}

function sortWorkoutsNewestFirst(firstWorkout, secondWorkout) {
  const dateCompare = safeString(secondWorkout.date)
    .localeCompare(safeString(firstWorkout.date));

  if (dateCompare) {
    return dateCompare;
  }

  return safeString(secondWorkout.createdAt)
    .localeCompare(safeString(firstWorkout.createdAt));
}

function findWorkoutById(id) {
  return state.workouts.find(
    workout => workout.id === id
  ) || null;
}

function getExerciseSets(exercise) {
  if (Array.isArray(exercise?.sets)) {
    return exercise.sets.map(normalizeSet);
  }

  return migrateExercise(exercise).sets;
}

function findMostRecentExerciseOccurrence(
  exerciseName,
  options = {}
) {
  const excludeWorkoutId = options.excludeWorkoutId || null;

  const sortedWorkouts = [...state.workouts]
    .sort(sortWorkoutsNewestFirst);

  for (const workout of sortedWorkouts) {
    if (
      excludeWorkoutId &&
      workout.id === excludeWorkoutId
    ) {
      continue;
    }

    const exercises = Array.isArray(workout.exercises)
      ? workout.exercises
      : [];

    for (const exercise of exercises) {
      if (exercise.name === exerciseName) {
        return {
          workout,
          exercise: migrateExercise(exercise)
        };
      }
    }
  }

  return null;
}

function formatSetSummary(set) {
  const weight = safeString(set.weight) || '-';
  const reps = safeString(set.reps) || '-';

  return `${weight} lb × ${reps}`;
}

function formatPreviousExercise(exercise) {
  const sets = getExerciseSets(exercise);

  if (!sets.length) {
    return 'No previous data';
  }

  const allSetsMatch = sets.every(set =>
    safeString(set.weight) === safeString(sets[0].weight) &&
    safeString(set.reps) === safeString(sets[0].reps)
  );

  if (allSetsMatch) {
    return `Last: ${sets.length} × ${safeString(sets[0].reps) || '-'} @ ${safeString(sets[0].weight) || '-'} lb`;
  }

  const detailedSets = sets
    .map((set, index) =>
      `Set ${index + 1}: ${formatSetSummary(set)}`
    )
    .join(' • ');

  return `Last: ${detailedSets}`;
}

function renumberSets(exerciseEntry) {
  const setRows = exerciseEntry.querySelectorAll('.set-row');

  setRows.forEach((setRow, index) => {
    setRow.querySelector('.set-number').textContent =
      `Set ${index + 1}`;
  });
}

function addSet(exerciseEntry, setData = {}, options = {}) {
  const setNode = document
    .querySelector('#setTemplate')
    .content
    .firstElementChild
    .cloneNode(true);

  const setsList = exerciseEntry.querySelector(
    '.exercise-sets-list'
  );

  let initialData = normalizeSet(setData);

  if (options.copyPrevious) {
    const previousSet = setsList.lastElementChild;

    if (previousSet) {
      initialData = {
        weight: previousSet
          .querySelector('.set-weight')
          .value
          .trim(),
        reps: previousSet
          .querySelector('.set-reps')
          .value
          .trim()
      };
    }
  }

  setNode.querySelector('.set-weight').value =
    initialData.weight;

  setNode.querySelector('.set-reps').value =
    initialData.reps;

  setNode
    .querySelector('.remove-set-btn')
    .addEventListener('click', () => {
      setNode.remove();
      renumberSets(exerciseEntry);
    });

  setsList.appendChild(setNode);
  renumberSets(exerciseEntry);
}

function replaceExerciseSets(exerciseEntry, sets) {
  const setsList = exerciseEntry.querySelector(
    '.exercise-sets-list'
  );

  setsList.innerHTML = '';

  if (Array.isArray(sets) && sets.length) {
    sets.forEach(set => addSet(exerciseEntry, set));
  } else {
    addSet(exerciseEntry);
  }
}

function updatePreviousExerciseInfo(
  exerciseEntry,
  options = {}
) {
  const exerciseName = exerciseEntry
    .querySelector('.exercise-name')
    .value;

  const previous = findMostRecentExerciseOccurrence(
    exerciseName,
    {
      excludeWorkoutId: options.excludeWorkoutId
    }
  );

  const previousText = exerciseEntry.querySelector(
    '.previous-exercise-values'
  );

  if (!previous) {
    previousText.textContent = 'No previous data';

    if (options.prefill) {
      replaceExerciseSets(exerciseEntry, []);
    }

    return;
  }

  previousText.textContent =
    formatPreviousExercise(previous.exercise);

  if (options.prefill) {
    replaceExerciseSets(
      exerciseEntry,
      getExerciseSets(previous.exercise)
    );
  }
}

function addExercise(data = {}, options = {}) {
  const settings = {
    prefill: options.prefill ?? true,
    excludeWorkoutId:
      options.excludeWorkoutId || null
  };

  const exerciseNode = document
    .querySelector('#exerciseTemplate')
    .content
    .firstElementChild
    .cloneNode(true);

  const nameSelect = exerciseNode.querySelector(
    '.exercise-name'
  );

  fillSelect(nameSelect, strengthExercises);

  const requestedName =
    safeString(data.name) || strengthExercises[0];

  if (!strengthExercises.includes(requestedName)) {
    const customOption = document.createElement('option');
    customOption.value = requestedName;
    customOption.textContent = requestedName;
    nameSelect.appendChild(customOption);
  }

  nameSelect.value = requestedName;

  exerciseNode
    .querySelector('.remove-entry')
    .addEventListener('click', () => {
      exerciseNode.remove();
    });

  exerciseNode
    .querySelector('.add-set-btn')
    .addEventListener('click', () => {
      addSet(
        exerciseNode,
        {},
        {
          copyPrevious: true
        }
      );
    });

  nameSelect.addEventListener('change', () => {
    updatePreviousExerciseInfo(
      exerciseNode,
      {
        prefill: true,
        excludeWorkoutId:
          settings.excludeWorkoutId
      }
    );
  });

  els.exerciseList.appendChild(exerciseNode);

  const providedSets = getExerciseSets(data);
  const hasProvidedExerciseData =
    safeString(data.name) !== '' ||
    providedSets.length > 0;

  if (hasProvidedExerciseData) {
    replaceExerciseSets(
      exerciseNode,
      providedSets
    );

    updatePreviousExerciseInfo(
      exerciseNode,
      {
        prefill: false,
        excludeWorkoutId:
          settings.excludeWorkoutId
      }
    );
  } else {
    updatePreviousExerciseInfo(
      exerciseNode,
      settings
    );
  }
}

function addCardio(data = {}) {
  const cardioNode = document
    .querySelector('#cardioTemplate')
    .content
    .firstElementChild
    .cloneNode(true);

  const machineSelect = cardioNode.querySelector(
    '.cardio-machine'
  );

  fillSelect(machineSelect, cardioMachines);

  const requestedMachine =
    safeString(data.machine) || cardioMachines[0];

  if (!cardioMachines.includes(requestedMachine)) {
    const customOption = document.createElement('option');
    customOption.value = requestedMachine;
    customOption.textContent = requestedMachine;
    machineSelect.appendChild(customOption);
  }

  machineSelect.value = requestedMachine;

  cardioNode.querySelector('.cardio-time').value =
    safeString(data.timeMinutes);

  cardioNode.querySelector('.cardio-intensity').value =
    safeString(data.intensity);

  cardioNode.querySelector('.cardio-incline').value =
    safeString(data.incline);

  cardioNode
    .querySelector('.remove-entry')
    .addEventListener('click', () => {
      cardioNode.remove();
    });

  els.cardioList.appendChild(cardioNode);
}

function collectExercise(exerciseEntry) {
  const sets = [
    ...exerciseEntry.querySelectorAll('.set-row')
  ]
    .map(setRow => ({
      weight: setRow
        .querySelector('.set-weight')
        .value
        .trim(),
      reps: setRow
        .querySelector('.set-reps')
        .value
        .trim()
    }))
    .filter(set =>
      set.weight !== '' ||
      set.reps !== ''
    );

  return {
    name: exerciseEntry
      .querySelector('.exercise-name')
      .value,
    sets
  };
}

function collectWorkout() {
  const exercises = [
    ...els.exerciseList.querySelectorAll(
      '.exercise-entry'
    )
  ]
    .map(collectExercise)
    .filter(exercise => exercise.sets.length > 0);

  const cardio = [
    ...els.cardioList.querySelectorAll('.cardio-entry')
  ]
    .map(entry => ({
      machine: entry
        .querySelector('.cardio-machine')
        .value,
      timeMinutes: entry
        .querySelector('.cardio-time')
        .value
        .trim(),
      intensity: entry
        .querySelector('.cardio-intensity')
        .value
        .trim(),
      incline: entry
        .querySelector('.cardio-incline')
        .value
        .trim()
    }))
    .filter(item =>
      item.timeMinutes ||
      item.intensity ||
      item.incline
    );

  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    date: els.date.value,
    workoutType: els.workoutType.value,
    exercises,
    cardio,
    energy: document
      .querySelector('#energy')
      .value
      .trim(),
    soreness: document
      .querySelector('#soreness')
      .value
      .trim(),
    sleepHours: document
      .querySelector('#sleepHours')
      .value
      .trim(),
    sleepMinutes: document
      .querySelector('#sleepMinutes')
      .value
      .trim(),
    notes: document
      .querySelector('#notes')
      .value
      .trim()
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

  els.date.value = options.useToday
    ? todayISO()
    : safeString(workout.date) || todayISO();

  els.workoutType.value =
    safeString(workout.workoutType) || 'Full Body';

  document.querySelector('#energy').value =
    safeString(workout.energy);

  document.querySelector('#soreness').value =
    safeString(workout.soreness);

  document.querySelector('#sleepHours').value =
    safeString(workout.sleepHours);

  document.querySelector('#sleepMinutes').value =
    safeString(workout.sleepMinutes);

  document.querySelector('#notes').value =
    safeString(workout.notes);

  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises
    : [];

  if (exercises.length) {
    exercises.forEach(exercise => {
      addExercise(
        migrateExercise(exercise),
        {
          prefill: false,
          excludeWorkoutId:
            options.excludeWorkoutId || null
        }
      );
    });
  } else {
    addExercise(
      {},
      {
        prefill: true,
        excludeWorkoutId:
          options.excludeWorkoutId || null
      }
    );
  }

  const cardio = Array.isArray(workout.cardio)
    ? workout.cardio
    : [];

  cardio.forEach(cardioEntry => {
    addCardio(migrateCardio(cardioEntry));
  });
}

function hasSleep(workout) {
  const hours = safeString(workout.sleepHours).trim();
  const minutes = safeString(workout.sleepMinutes).trim();

  return hours !== '' || minutes !== '';
}

function findMostRecentIncompleteWorkout() {
  return [...state.workouts]
    .filter(workout => !hasSleep(workout))
    .sort(sortWorkoutsNewestFirst)[0] || null;
}

function updateIncompleteButton() {
  const incompleteWorkout =
    findMostRecentIncompleteWorkout();

  const shouldShow = Boolean(incompleteWorkout);

  els.completeIncompleteWorkoutBtn.hidden =
    !shouldShow;

  els.dashboardActions.hidden =
    !shouldShow;
}

function showDashboardForm() {
  state.incompleteWorkoutId = null;

  els.completeWorkoutForm.hidden = true;
  els.form.hidden = false;

  updateIncompleteButton();
}

function showCompleteWorkoutForm(workoutId = null) {
  const workout = workoutId
    ? findWorkoutById(workoutId)
    : findMostRecentIncompleteWorkout();

  if (!workout || hasSleep(workout)) {
    showMessage(
      'All workouts are complete.',
      'success'
    );

    showDashboardForm();
    return;
  }

  state.incompleteWorkoutId = workout.id;

  els.form.hidden = true;
  els.dashboardActions.hidden = true;
  els.completeWorkoutForm.hidden = false;

  els.completeWorkoutMessage.textContent =
    `${workout.date || 'Workout'} · ${workout.workoutType || 'Workout'}`;

  els.completeSleepHours.value =
    safeString(workout.sleepHours);

  els.completeSleepMinutes.value =
    safeString(workout.sleepMinutes);

  els.completeEnergy.value =
    safeString(workout.energy);

  els.completeSoreness.value =
    safeString(workout.soreness);

  switchTab(
    'log',
    {
      keepCompleteForm: true
    }
  );

  els.completeSleepHours.focus();
}

function saveCompletedWorkout(event) {
  event.preventDefault();

  const workout = findWorkoutById(
    state.incompleteWorkoutId
  );

  if (!workout) {
    showMessage(
      'The workout could not be found.',
      'error'
    );

    showDashboardForm();
    return;
  }

  workout.sleepHours =
    els.completeSleepHours.value.trim();

  workout.sleepMinutes =
    els.completeSleepMinutes.value.trim();

  workout.energy =
    els.completeEnergy.value.trim();

  workout.soreness =
    els.completeSoreness.value.trim();

  try {
    saveWorkouts();

    renderAll();
    showDashboardForm();
    switchTab('history');

    showMessage(
      'Workout completed successfully.',
      'success'
    );
  } catch {
    showMessage(
      'The workout could not be updated. Your existing data was left unchanged.',
      'error'
    );
  }
}

function editWorkout(workoutId) {
  const workout = findWorkoutById(workoutId);

  if (!workout) {
    return;
  }

  state.editingWorkoutId = workout.id;

  populateWorkoutForm(
    workout,
    {
      useToday: false,
      excludeWorkoutId: workout.id
    }
  );

  els.logHeading.textContent = 'Edit workout';
  els.saveWorkoutBtn.textContent = 'Update workout';

  showDashboardForm();
  switchTab('log');

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function duplicateWorkout(workoutId) {
  const workout = findWorkoutById(workoutId);

  if (!workout) {
    return;
  }

  state.editingWorkoutId = null;

  populateWorkoutForm(
    workout,
    {
      useToday: true
    }
  );

  els.logHeading.textContent = 'New workout';
  els.saveWorkoutBtn.textContent = 'Save workout';

  showDashboardForm();
  switchTab('log');

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function saveWorkoutFromForm(event) {
  event.preventDefault();

  const formWorkout = collectWorkout();

  try {
    if (state.editingWorkoutId) {
      const existingWorkout = findWorkoutById(
        state.editingWorkoutId
      );

      if (!existingWorkout) {
        showMessage(
          'The workout could not be found.',
          'error'
        );

        state.editingWorkoutId = null;
        return;
      }

      const preservedId = existingWorkout.id;
      const preservedCreatedAt =
        existingWorkout.createdAt;

      Object.assign(
        existingWorkout,
        formWorkout,
        {
          id: preservedId,
          createdAt: preservedCreatedAt
        }
      );

      saveWorkouts();
      resetForm();
      renderAll();
      switchTab('history');

      showMessage(
        'Workout updated successfully.',
        'success'
      );

      return;
    }

    state.workouts.push(formWorkout);

    saveWorkouts();
    resetForm();
    renderAll();
    switchTab('history');

    showMessage(
      'Workout saved successfully.',
      'success'
    );
  } catch {
    showMessage(
      'The workout could not be saved. Your existing history was left unchanged.',
      'error'
    );
  }
}

function switchTab(tabName, options = {}) {
  els.tabs.forEach(tab => {
    tab.classList.toggle(
      'active',
      tab.dataset.tab === tabName
    );
  });

  els.panels.forEach(panel => {
    panel.classList.toggle(
      'active',
      panel.id === tabName
    );
  });

  if (tabName !== 'log') {
    showDashboardForm();
  }

  if (
    tabName === 'log' &&
    !options.keepCompleteForm &&
    els.completeWorkoutForm.hidden
  ) {
    updateIncompleteButton();
  }

  if (tabName === 'history') {
    renderHistory();
  }

  if (tabName === 'export') {
    renderCsv();
  }
}

function getCardioSummary(workout) {
  const cardio = Array.isArray(workout.cardio)
    ? workout.cardio
    : [];

  if (!cardio.length) {
    return '';
  }

  return cardio
    .map(cardioEntry => {
      const time = cardioEntry.timeMinutes
        ? `${cardioEntry.timeMinutes} min`
        : 'cardio';

      return `${cardioEntry.machine || 'Cardio'} • ${time}`;
    })
    .join(' · ');
}

function getMaximumExerciseWeight(exercise) {
  const weights = getExerciseSets(exercise)
    .map(set => Number(set.weight))
    .filter(weight =>
      Number.isFinite(weight)
    );

  if (!weights.length) {
    return null;
  }

  return Math.max(...weights);
}

function workoutHasWeightIncrease(workout) {
  const sortedWorkouts = [...state.workouts]
    .sort(sortWorkoutsNewestFirst);

  const currentIndex = sortedWorkouts.findIndex(
    item => item.id === workout.id
  );

  if (currentIndex < 0) {
    return false;
  }

  const olderWorkouts = sortedWorkouts.slice(
    currentIndex + 1
  );

  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises
    : [];

  return exercises.some(exercise => {
    const currentWeight =
      getMaximumExerciseWeight(exercise);

    if (currentWeight === null) {
      return false;
    }

    for (const olderWorkout of olderWorkouts) {
      const previousExercise = (
        olderWorkout.exercises || []
      ).find(item =>
        item.name === exercise.name
      );

      if (!previousExercise) {
        continue;
      }

      const previousWeight =
        getMaximumExerciseWeight(previousExercise);

      if (previousWeight === null) {
        return false;
      }

      return currentWeight > previousWeight;
    }

    return false;
  });
}

function renderHistory() {
  if (!state.workouts.length) {
    els.historyList.innerHTML =
      '<p class="muted">No workouts saved yet.</p>';

    updateIncompleteButton();
    return;
  }

  const sorted = [...state.workouts]
    .sort(sortWorkoutsNewestFirst);

  els.historyList.innerHTML = sorted
    .map(workout => {
      const complete = hasSleep(workout);

      const exerciseCount = Array.isArray(
        workout.exercises
      )
        ? workout.exercises.length
        : 0;

      const setCount = (workout.exercises || [])
        .reduce(
          (total, exercise) =>
            total + getExerciseSets(exercise).length,
          0
        );

      const cardioSummary =
        getCardioSummary(workout);

      const statusClass = complete
        ? 'complete'
        : 'incomplete';

      const statusText = complete
        ? '🟢 Complete'
        : '🟡 Incomplete';

      const increaseNote =
        workoutHasWeightIncrease(workout)
          ? '<div class="increase-note">⬆ Increased from last time</div>'
          : '';

      return `
        <article class="history-item">
          <div class="history-card-header">
            <div>
              <h3>${escapeHtml(workout.workoutType || 'Workout')}</h3>
              <p class="history-date">${escapeHtml(workout.date || '')}</p>
            </div>

            <span class="status ${statusClass}">
              ${statusText}
            </span>
          </div>

          <div class="history-summary">
            <div>
              ${exerciseCount}
              exercise${exerciseCount === 1 ? '' : 's'}
              ·
              ${setCount}
              set${setCount === 1 ? '' : 's'}
            </div>

            ${cardioSummary
              ? `<div>${escapeHtml(cardioSummary)}</div>`
              : ''
            }

            <div>
              Energy:
              ${escapeHtml(workout.energy || '-')} /10
              ·
              Soreness:
              ${escapeHtml(workout.soreness || '-')} /10
            </div>

            ${increaseNote}
          </div>

          <div class="history-actions">
            <button
              class="secondary"
              data-edit="${escapeHtml(workout.id)}"
              type="button"
            >
              Edit
            </button>

            <button
              class="secondary"
              data-duplicate="${escapeHtml(workout.id)}"
              type="button"
            >
              Duplicate
            </button>

            ${complete
              ? ''
              : `
                <button
                  class="primary"
                  data-complete="${escapeHtml(workout.id)}"
                  type="button"
                >
                  Complete
                </button>
              `
            }

            <button
              class="danger"
              data-delete="${escapeHtml(workout.id)}"
              type="button"
            >
              Delete
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  els.historyList
    .querySelectorAll('[data-edit]')
    .forEach(button => {
      button.addEventListener('click', () => {
        editWorkout(button.dataset.edit);
      });
    });

  els.historyList
    .querySelectorAll('[data-duplicate]')
    .forEach(button => {
      button.addEventListener('click', () => {
        duplicateWorkout(
          button.dataset.duplicate
        );
      });
    });

  els.historyList
    .querySelectorAll('[data-complete]')
    .forEach(button => {
      button.addEventListener('click', () => {
        showCompleteWorkoutForm(
          button.dataset.complete
        );
      });
    });

  els.historyList
    .querySelectorAll('[data-delete]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const confirmed = window.confirm(
          'Delete this workout?'
        );

        if (!confirmed) {
          return;
        }

        const nextWorkouts = state.workouts.filter(
          workout =>
            workout.id !== button.dataset.delete
        );

        try {
          saveWorkouts(nextWorkouts);
          state.workouts = nextWorkouts;
          renderAll();

          showMessage(
            'Workout deleted.',
            'success'
          );
        } catch {
          showMessage(
            'The workout could not be deleted.',
            'error'
          );
        }
      });
    });

  updateIncompleteButton();
}

function csvEscape(value) {
  const text = safeString(value);

  return /[",\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function toCsvRows() {
  const headers = [
    'date',
    'workout_type',
    'entry_type',
    'name',
    'set_number',
    'reps',
    'weight',
    'cardio_time_minutes',
    'speed_or_resistance',
    'incline',
    'energy_10',
    'soreness_10',
    'sleep_hours',
    'sleep_minutes',
    'notes'
  ];

  const rows = [headers];

  state.workouts.forEach(workout => {
    const exercises = Array.isArray(workout.exercises)
      ? workout.exercises
      : [];

    const cardio = Array.isArray(workout.cardio)
      ? workout.cardio
      : [];

    exercises.forEach(exercise => {
      const sets = getExerciseSets(exercise);

      sets.forEach((set, index) => {
        rows.push([
          workout.date,
          workout.workoutType,
          'strength_set',
          exercise.name,
          index + 1,
          set.reps,
          set.weight,
          '',
          '',
          '',
          workout.energy,
          workout.soreness,
          workout.sleepHours,
          workout.sleepMinutes,
          workout.notes
        ]);
      });
    });

    cardio.forEach(cardioEntry => {
      rows.push([
        workout.date,
        workout.workoutType,
        'cardio',
        cardioEntry.machine,
        '',
        '',
        '',
        cardioEntry.timeMinutes,
        cardioEntry.intensity,
        cardioEntry.incline,
        workout.energy,
        workout.soreness,
        workout.sleepHours,
        workout.sleepMinutes,
        workout.notes
      ]);
    });

    if (!exercises.length && !cardio.length) {
      rows.push([
        workout.date,
        workout.workoutType,
        'workout',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        workout.energy,
        workout.soreness,
        workout.sleepHours,
        workout.sleepMinutes,
        workout.notes
      ]);
    }
  });

  return rows
    .map(row =>
      row.map(csvEscape).join(',')
    )
    .join('\n');
}

function renderCsv() {
  els.csvPreview.value = toCsvRows();
}

function downloadTextFile(
  contents,
  filename,
  mimeType
) {
  const blob = new Blob(
    [contents],
    {
      type: mimeType
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function downloadCsv() {
  downloadTextFile(
    toCsvRows(),
    `workout-export-${todayISO()}.csv`,
    'text/csv;charset=utf-8'
  );
}

function createBackupPayload() {
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    app: 'Workout Tracker PWA',
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    workouts: deepClone(state.workouts)
  };
}

function exportBackup() {
  try {
    const backupPayload =
      createBackupPayload();

    downloadTextFile(
      JSON.stringify(
        backupPayload,
        null,
        2
      ),
      `workout-tracker-backup-${todayISO()}.json`,
      'application/json;charset=utf-8'
    );

    showMessage(
      `Backup exported with ${state.workouts.length} workout${state.workouts.length === 1 ? '' : 's'}.`,
      'success'
    );
  } catch {
    showMessage(
      'The backup could not be created.',
      'error'
    );
  }
}

function validateBackupPayload(payload) {
  if (!isPlainObject(payload)) {
    throw new Error(
      'This file is not a valid Workout Tracker backup.'
    );
  }

  if (
    !Number.isInteger(payload.backupFormatVersion) ||
    payload.backupFormatVersion < 1
  ) {
    throw new Error(
      'This backup does not contain a valid format version.'
    );
  }

  if (!Array.isArray(payload.workouts)) {
    throw new Error(
      'This backup does not contain a valid workout list.'
    );
  }

  return migrateWorkouts(payload.workouts);
}

function askImportMode() {
  const choice = window.prompt(
    'Type MERGE to keep existing workouts and add missing workouts.\n\nType REPLACE to replace existing workouts with this backup.\n\nTap Cancel to stop.'
  );

  if (choice === null) {
    return 'cancel';
  }

  const normalizedChoice =
    choice.trim().toUpperCase();

  if (normalizedChoice === 'MERGE') {
    return 'merge';
  }

  if (normalizedChoice === 'REPLACE') {
    return 'replace';
  }

  return 'invalid';
}

async function importBackupFile(file) {
  if (!file) {
    return;
  }

  let parsedBackup;
  let importedWorkouts;

  try {
    const fileText = await file.text();
    parsedBackup = JSON.parse(fileText);
    importedWorkouts =
      validateBackupPayload(parsedBackup);
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : 'The selected backup is invalid.',
      'error'
    );

    return;
  }

  const importMode = askImportMode();

  if (importMode === 'cancel') {
    return;
  }

  if (importMode === 'invalid') {
    showMessage(
      'Import cancelled. Enter MERGE or REPLACE when choosing an import option.',
      'error'
    );

    return;
  }

  try {
    if (importMode === 'merge') {
      const mergeResult = mergeWorkoutLists(
        state.workouts,
        importedWorkouts
      );

      saveWorkouts(mergeResult.workouts);
      state.workouts = mergeResult.workouts;

      renderAll();
      resetForm();

      showMessage(
        `Backup imported successfully. ${mergeResult.importedCount} workout${mergeResult.importedCount === 1 ? '' : 's'} imported.`,
        'success'
      );

      return;
    }

    const replaceConfirmed = window.confirm(
      `Replace all current workout history with ${importedWorkouts.length} workout${importedWorkouts.length === 1 ? '' : 's'} from this backup?\n\nA recovery snapshot will be created first.`
    );

    if (!replaceConfirmed) {
      return;
    }

    if (state.workouts.length > 0) {
      const snapshotCreated =
        createRecoverySnapshot(
          state.workouts,
          'before-replace-import'
        );

      if (!snapshotCreated) {
        throw new Error(
          'A recovery snapshot could not be created. Replace import was cancelled.'
        );
      }
    }

    saveWorkouts(importedWorkouts);
    state.workouts = importedWorkouts;

    renderAll();
    resetForm();

    showMessage(
      `Backup restored successfully. ${importedWorkouts.length} workout${importedWorkouts.length === 1 ? '' : 's'} imported.`,
      'success'
    );
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : 'The backup could not be imported. Existing data was left unchanged.',
      'error'
    );
  }
}

function renderAll() {
  renderHistory();
  renderCsv();
  updateIncompleteButton();
}

function escapeHtml(value) {
  return safeString(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function registerEventListeners() {
  els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  document
    .querySelector('#addExerciseBtn')
    .addEventListener('click', () => {
      addExercise();
    });

  document
    .querySelector('#addCardioBtn')
    .addEventListener('click', () => {
      addCardio();
    });

  els.completeIncompleteWorkoutBtn
    .addEventListener('click', () => {
      showCompleteWorkoutForm();
    });

  els.completeWorkoutForm
    .addEventListener(
      'submit',
      saveCompletedWorkout
    );

  document
    .querySelector('#cancelCompleteWorkoutBtn')
    .addEventListener(
      'click',
      showDashboardForm
    );

  document
    .querySelector('#resetFormBtn')
    .addEventListener('click', resetForm);

  document
    .querySelector('#downloadCsvBtn')
    .addEventListener('click', downloadCsv);

  document
    .querySelector('#copyCsvBtn')
    .addEventListener(
      'click',
      async () => {
        renderCsv();

        try {
          await navigator.clipboard.writeText(
            els.csvPreview.value
          );

          showMessage(
            'CSV copied to the clipboard.',
            'success'
          );
        } catch {
          els.csvPreview.focus();
          els.csvPreview.select();

          showMessage(
            'CSV is selected. Use Copy from the phone menu.',
            'error'
          );
        }
      }
    );

  document
    .querySelector('#exportBackupBtn')
    .addEventListener(
      'click',
      exportBackup
    );

  document
    .querySelector('#importBackupBtn')
    .addEventListener('click', () => {
      els.backupFileInput.value = '';
      els.backupFileInput.click();
    });

  els.backupFileInput
    .addEventListener(
      'change',
      async event => {
        const file = event.target.files?.[0];
        await importBackupFile(file);
        event.target.value = '';
      }
    );

  document
    .querySelector('#clearAllBtn')
    .addEventListener('click', () => {
      if (!state.workouts.length) {
        return;
      }

      const confirmed = window.confirm(
        'Delete all saved workouts from this device? Export a backup first if you may need them later.'
      );

      if (!confirmed) {
        return;
      }

      const snapshotCreated =
        createRecoverySnapshot(
          state.workouts,
          'before-clear-all'
        );

      if (!snapshotCreated) {
        showMessage(
          'A recovery snapshot could not be created. Clear all was cancelled.',
          'error'
        );

        return;
      }

      try {
        saveWorkouts([]);
        state.workouts = [];
        resetForm();
        renderAll();
        showDashboardForm();

        showMessage(
          'All workouts were cleared. A recovery snapshot was saved.',
          'success'
        );
      } catch {
        showMessage(
          'Workout history could not be cleared.',
          'error'
        );
      }
    });

  document
    .querySelector('#installHintBtn')
    .addEventListener('click', () => {
      els.installDialog.showModal();
    });

  document
    .querySelector('#closeInstallDialog')
    .addEventListener('click', () => {
      els.installDialog.close();
    });

  els.form.addEventListener(
    'submit',
    saveWorkoutFromForm
  );
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register('./service-worker.js')
    .catch(() => {
      showMessage(
        'Offline support could not be updated, but workout data is still available.',
        'error'
      );
    });
}

function init() {
  cacheElements();

  try {
    state.workouts = loadAndMigrateWorkouts();
  } catch (error) {
    state.workouts = [];

    showMessage(
      error instanceof Error
        ? error.message
        : 'Saved workout history could not be loaded. The original data was left unchanged.',
      'error'
    );
  }

  els.date.value = todayISO();

  addExercise();
  renderAll();
  registerEventListeners();
  registerServiceWorker();
}

document.addEventListener(
  'DOMContentLoaded',
  init
);
