// ==========================================
// Family Dashboard - Main Application
// ==========================================

// Display dynamic version
(function setVersion() {
  const el = document.getElementById('app-version');
  if (el && typeof APP_VERSION_DISPLAY !== 'undefined') {
    el.textContent = APP_VERSION_DISPLAY;
  }
})();

// ==========================================
// CONSTANTS
// ==========================================

const DB_NAME = 'FamilyDashboardDB';
const DB_VERSION = 1;

const AVATARS = [
  '\u{1F468}', '\u{1F469}', '\u{1F466}', '\u{1F467}',
  '\u{1F474}', '\u{1F475}', '\u{1F476}', '\u{1F9D1}',
  '\u{1F431}', '\u{1F436}', '\u{1F984}', '\u{1F47B}',
  '\u{1F916}', '\u{1F31F}', '\u{1F3C6}', '\u{1F680}'
];

const COLORS = [
  '#4285f4', '#34a853', '#ea4335', '#fbbc04',
  '#9c27b0', '#ff5722', '#00bcd4', '#e91e63',
  '#607d8b', '#795548', '#3f51b5', '#009688'
];

const CATEGORY_LABELS = {
  kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom',
  living_room: 'Living Room', garden: 'Garden', laundry: 'Laundry',
  shopping: 'Shopping', pets: 'Pets', general: 'General', other: 'Other'
};

const FREQUENCY_LABELS = {
  once: 'One Time', daily: 'Daily', every_x_days: 'Every X Days',
  weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly'
};

const EFFORT_LABELS = {
  quick: 'Quick (< 15 min)', medium: 'Medium (15-45 min)', long: 'Long (45+ min)'
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ==========================================
// STATE
// ==========================================

let db = null;
let familyMembers = [];
let chores = [];
let completions = [];
let currentView = 'dashboard';
let editingChoreId = null;
let completingChoreId = null;
let selectedAvatar = AVATARS[0];
let selectedColor = COLORS[0];

// ==========================================
// DATABASE LAYER
// ==========================================

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains('familyMembers')) {
        const fmStore = database.createObjectStore('familyMembers', { keyPath: 'id', autoIncrement: true });
        fmStore.createIndex('name', 'name', { unique: false });
      }

      if (!database.objectStoreNames.contains('chores')) {
        const choreStore = database.createObjectStore('chores', { keyPath: 'id', autoIncrement: true });
        choreStore.createIndex('status', 'status', { unique: false });
        choreStore.createIndex('nextDue', 'nextDue', { unique: false });
        choreStore.createIndex('assignedTo', 'assignedTo', { unique: false });
        choreStore.createIndex('category', 'category', { unique: false });
      }

      if (!database.objectStoreNames.contains('completions')) {
        const compStore = database.createObjectStore('completions', { keyPath: 'id', autoIncrement: true });
        compStore.createIndex('choreId', 'choreId', { unique: false });
        compStore.createIndex('completedBy', 'completedBy', { unique: false });
        compStore.createIndex('completedAt', 'completedAt', { unique: false });
      }
    };
  });
}

function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// DATA LOADING
// ==========================================

async function loadAllData() {
  familyMembers = await dbGetAll('familyMembers');
  chores = await dbGetAll('chores');
  completions = await dbGetAll('completions');
}

function getMemberById(id) {
  return familyMembers.find(m => m.id === id) || null;
}

// ==========================================
// DATE UTILITIES
// ==========================================

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(str) {
  const parts = str.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(date2);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = parseDate(dateStr);
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-GB', options);
}

function formatDateTime(isoStr) {
  if (!isoStr) return 'N/A';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getStartOfWeek() {
  const d = today();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

// ==========================================
// SCHEDULING ENGINE
// ==========================================

function calculateInitialNextDue(choreData) {
  const startDate = choreData.startDate ? parseDate(choreData.startDate) : today();

  switch (choreData.frequency) {
    case 'once':
    case 'daily':
    case 'every_x_days':
    case 'biweekly':
      return toDateStr(startDate);

    case 'weekly': {
      const weeklyDays = choreData.weeklyDays || [];
      if (weeklyDays.length === 0) return toDateStr(startDate);
      for (let i = 0; i <= 7; i++) {
        const candidate = new Date(startDate);
        candidate.setDate(candidate.getDate() + i);
        if (weeklyDays.includes(candidate.getDay())) {
          return toDateStr(candidate);
        }
      }
      return toDateStr(startDate);
    }

    case 'monthly': {
      const monthly = new Date(startDate);
      const targetDay = choreData.monthlyDay || 1;
      if (monthly.getDate() > targetDay) {
        monthly.setMonth(monthly.getMonth() + 1);
      }
      const maxDay = daysInMonth(monthly.getFullYear(), monthly.getMonth());
      monthly.setDate(Math.min(targetDay, maxDay));
      return toDateStr(monthly);
    }

    default:
      return toDateStr(startDate);
  }
}

function calculateNextDue(chore, afterDate) {
  const from = afterDate ? parseDate(afterDate) : today();

  switch (chore.frequency) {
    case 'once':
      return null; // one-time chores don't recur

    case 'daily': {
      const next = new Date(from);
      next.setDate(next.getDate() + 1);
      return toDateStr(next);
    }

    case 'every_x_days': {
      const next = new Date(from);
      next.setDate(next.getDate() + (chore.intervalDays || 3));
      return toDateStr(next);
    }

    case 'weekly': {
      const weeklyDays = chore.weeklyDays || [];
      if (weeklyDays.length === 0) return null;
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(from);
        candidate.setDate(candidate.getDate() + i);
        if (weeklyDays.includes(candidate.getDay())) {
          return toDateStr(candidate);
        }
      }
      return null;
    }

    case 'biweekly': {
      const next = new Date(from);
      next.setDate(next.getDate() + 14);
      return toDateStr(next);
    }

    case 'monthly': {
      const next = new Date(from);
      next.setMonth(next.getMonth() + 1);
      const targetDay = chore.monthlyDay || 1;
      const maxDay = daysInMonth(next.getFullYear(), next.getMonth());
      next.setDate(Math.min(targetDay, maxDay));
      return toDateStr(next);
    }

    default:
      return null;
  }
}

function getChoreStatus(chore) {
  if (chore.status === 'paused') return 'paused';
  if (chore.status === 'completed') return 'completed';
  if (!chore.nextDue) return 'no-date';

  const daysUntil = daysBetween(today(), parseDate(chore.nextDue));

  if (daysUntil > 0) return 'upcoming';
  if (daysUntil === 0) return 'due-today';
  // Past due
  const daysLate = Math.abs(daysUntil);
  if (daysLate <= (chore.slackDays || 0)) return 'grace-period';
  return 'overdue';
}

function getDueStatusText(chore) {
  const status = getChoreStatus(chore);
  if (!chore.nextDue) return { text: 'No date', cssClass: '' };
  const daysUntil = daysBetween(today(), parseDate(chore.nextDue));

  switch (status) {
    case 'overdue': {
      const daysLate = Math.abs(daysUntil);
      return {
        text: daysLate === 1 ? '1 day overdue' : `${daysLate} days overdue`,
        cssClass: 'due-overdue'
      };
    }
    case 'grace-period': {
      const daysLate = Math.abs(daysUntil);
      const remaining = (chore.slackDays || 0) - daysLate;
      return {
        text: `Grace period (${remaining}d left)`,
        cssClass: 'due-grace'
      };
    }
    case 'due-today':
      return { text: 'Due today', cssClass: 'due-today' };
    case 'upcoming': {
      if (daysUntil === 1) return { text: 'Due tomorrow', cssClass: 'due-upcoming' };
      return { text: `Due in ${daysUntil} days`, cssClass: 'due-upcoming' };
    }
    case 'paused':
      return { text: 'Paused', cssClass: '' };
    case 'completed':
      return { text: 'Completed', cssClass: '' };
    default:
      return { text: '', cssClass: '' };
  }
}

// ==========================================
// CHORE OPERATIONS
// ==========================================

async function saveChore(choreData) {
  choreData.updatedAt = new Date().toISOString();

  if (choreData.id) {
    await dbPut('chores', choreData);
  } else {
    choreData.createdAt = new Date().toISOString();
    choreData.completionCount = 0;
    choreData.currentStreak = 0;
    choreData.bestStreak = 0;
    choreData.currentPostponeStreak = 0;
    choreData.lastCompleted = null;
    choreData.status = 'active';
    choreData.rotationIndex = 0;
    choreData.nextDue = calculateInitialNextDue(choreData);
    choreData.id = await dbAdd('chores', choreData);
  }

  await loadAllData();
  renderCurrentView();
}

async function deleteChore(id) {
  await dbDelete('chores', id);
  await loadAllData();
  renderCurrentView();
}

async function completeChore(choreId, memberId, notes) {
  const chore = chores.find(c => c.id === choreId);
  if (!chore) return;

  const todayStr = toDateStr(today());
  const wasOnTime = chore.nextDue ? daysBetween(parseDate(chore.nextDue), today()) <= 0 : true;
  const wasInGrace = getChoreStatus(chore) === 'grace-period';
  const wasPostponed = chore.currentPostponeStreak > 0;

  // Record completion
  const completion = {
    choreId: choreId,
    completedBy: memberId,
    completedAt: new Date().toISOString(),
    scheduledFor: chore.nextDue || todayStr,
    wasOnTime: wasOnTime && !wasInGrace,
    wasPostponed: wasPostponed,
    postponeCount: chore.currentPostponeStreak,
    notes: notes || '',
    pointsAwarded: calculatePoints(chore, wasOnTime && !wasInGrace)
  };
  await dbAdd('completions', completion);

  // Update chore
  chore.lastCompleted = todayStr;
  chore.completionCount = (chore.completionCount || 0) + 1;
  chore.currentPostponeStreak = 0;

  // Streak tracking
  if (wasOnTime && !wasInGrace) {
    chore.currentStreak = (chore.currentStreak || 0) + 1;
    if (chore.currentStreak > (chore.bestStreak || 0)) {
      chore.bestStreak = chore.currentStreak;
    }
  } else {
    chore.currentStreak = 0;
  }

  // Rotation
  if (chore.rotationEnabled && chore.rotationMembers && chore.rotationMembers.length > 0) {
    chore.rotationIndex = ((chore.rotationIndex || 0) + 1) % chore.rotationMembers.length;
    chore.assignedTo = chore.rotationMembers[chore.rotationIndex];
  }

  // Calculate next due
  if (chore.frequency === 'once') {
    chore.status = 'completed';
    chore.nextDue = null;
  } else {
    const nextDue = calculateNextDue(chore, todayStr);
    chore.nextDue = nextDue;
  }

  chore.updatedAt = new Date().toISOString();
  await dbPut('chores', chore);

  await loadAllData();
  renderCurrentView();
}

function calculatePoints(chore, wasOnTime) {
  let points = chore.points || 0;

  if (chore.bonusEarly && wasOnTime) {
    points = Math.round(points * 1.5);
  }

  if (chore.streakBonus && wasOnTime) {
    points += (chore.currentStreak || 0);
  }

  return points;
}

async function postponeChore(choreId) {
  const chore = chores.find(c => c.id === choreId);
  if (!chore) return;

  // Check postpone limit
  if (chore.maxPostpones !== -1 && chore.currentPostponeStreak >= chore.maxPostpones) {
    alert(`Cannot postpone: max consecutive postpones (${chore.maxPostpones}) reached. Complete this chore first!`);
    return;
  }

  chore.currentPostponeStreak = (chore.currentPostponeStreak || 0) + 1;

  if (chore.autoReschedule && chore.nextDue) {
    const snoozeDays = chore.snoozeDays || 1;
    const currentDue = parseDate(chore.nextDue);
    currentDue.setDate(currentDue.getDate() + snoozeDays);
    chore.nextDue = toDateStr(currentDue);
  }

  // Break the streak on postpone
  chore.currentStreak = 0;
  chore.updatedAt = new Date().toISOString();
  await dbPut('chores', chore);

  await loadAllData();
  renderCurrentView();
}

async function togglePauseChore(choreId) {
  const chore = chores.find(c => c.id === choreId);
  if (!chore) return;

  if (chore.status === 'paused') {
    chore.status = 'active';
    // Reschedule from today if the old due date is past
    if (chore.nextDue && daysBetween(today(), parseDate(chore.nextDue)) < 0) {
      chore.nextDue = toDateStr(today());
    }
  } else {
    chore.status = 'paused';
  }

  chore.updatedAt = new Date().toISOString();
  await dbPut('chores', chore);

  await loadAllData();
  renderCurrentView();
}

// ==========================================
// FAMILY MEMBER OPERATIONS
// ==========================================

async function saveFamilyMember(data) {
  if (data.id) {
    await dbPut('familyMembers', data);
  } else {
    data.createdAt = new Date().toISOString();
    data.id = await dbAdd('familyMembers', data);
  }
  await loadAllData();
  renderCurrentView();
  populateMemberDropdowns();
}

async function deleteFamilyMember(id) {
  await dbDelete('familyMembers', id);
  await loadAllData();
  renderCurrentView();
  populateMemberDropdowns();
}

function getMemberPoints(memberId, sinceDate) {
  return completions
    .filter(c => c.completedBy === memberId && (!sinceDate || new Date(c.completedAt) >= sinceDate))
    .reduce((sum, c) => sum + (c.pointsAwarded || 0), 0);
}

function getMemberCompletionCount(memberId, sinceDate) {
  return completions
    .filter(c => c.completedBy === memberId && (!sinceDate || new Date(c.completedAt) >= sinceDate))
    .length;
}

// ==========================================
// NAVIGATION
// ==========================================

function switchView(viewName) {
  currentView = viewName;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${viewName}`);
  });

  renderCurrentView();
}

function renderCurrentView() {
  switch (currentView) {
    case 'dashboard': renderDashboard(); break;
    case 'chores': renderChoresList(); break;
    case 'family': renderFamilyView(); break;
    case 'dev': renderDevView(); break;
  }
}

// ==========================================
// DASHBOARD RENDERING
// ==========================================

function renderDashboard() {
  const todayStr = toDateStr(today());
  const activeChores = chores.filter(c => c.status === 'active');

  // Categorize chores
  const overdueChores = [];
  const todayChores = [];
  const upcomingChores = [];

  activeChores.forEach(c => {
    const status = getChoreStatus(c);
    if (status === 'overdue') overdueChores.push(c);
    else if (status === 'due-today' || status === 'grace-period') todayChores.push(c);
    else if (status === 'upcoming') {
      const daysUntil = daysBetween(today(), parseDate(c.nextDue));
      if (daysUntil <= 7) upcomingChores.push(c);
    }
  });

  // Sort by priority
  const sortByPriority = (a, b) => (PRIORITY_ORDER[a.priority] || 2) - (PRIORITY_ORDER[b.priority] || 2);
  overdueChores.sort(sortByPriority);
  todayChores.sort(sortByPriority);
  upcomingChores.sort((a, b) => {
    const dateCompare = a.nextDue.localeCompare(b.nextDue);
    return dateCompare !== 0 ? dateCompare : sortByPriority(a, b);
  });

  // Stats
  const todayCompletions = completions.filter(c => toDateStr(new Date(c.completedAt)) === todayStr);
  const bestStreak = chores.reduce((max, c) => Math.max(max, c.bestStreak || 0), 0);

  document.getElementById('stat-today').textContent = todayChores.length;
  document.getElementById('stat-overdue').textContent = overdueChores.length;
  document.getElementById('stat-done-today').textContent = todayCompletions.length;
  document.getElementById('stat-streak').textContent = bestStreak;

  // Render overdue
  const overdueSection = document.getElementById('section-overdue');
  const overdueContainer = document.getElementById('dashboard-overdue');
  if (overdueChores.length > 0) {
    overdueSection.style.display = '';
    overdueContainer.innerHTML = overdueChores.map(c => renderChoreCard(c)).join('');
  } else {
    overdueSection.style.display = 'none';
  }

  // Render today
  const todayContainer = document.getElementById('dashboard-today');
  const todayEmpty = document.getElementById('today-empty');
  if (todayChores.length > 0) {
    todayContainer.innerHTML = todayChores.map(c => renderChoreCard(c)).join('');
    todayEmpty.style.display = 'none';
  } else {
    todayContainer.innerHTML = '';
    todayEmpty.style.display = '';
  }

  // Render upcoming
  const upcomingContainer = document.getElementById('dashboard-upcoming');
  const upcomingEmpty = document.getElementById('upcoming-empty');
  if (upcomingChores.length > 0) {
    upcomingContainer.innerHTML = upcomingChores.map(c => renderChoreCard(c)).join('');
    upcomingEmpty.style.display = 'none';
  } else {
    upcomingContainer.innerHTML = '';
    upcomingEmpty.style.display = '';
  }

  // Render leaderboard
  renderLeaderboard();
}

function renderLeaderboard() {
  const container = document.getElementById('dashboard-leaderboard');
  const empty = document.getElementById('leaderboard-empty');

  if (familyMembers.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  const weekStart = getStartOfWeek();

  const memberStats = familyMembers.map(member => {
    const points = getMemberPoints(member.id, weekStart);
    const count = getMemberCompletionCount(member.id, weekStart);
    return { member, points, count };
  }).sort((a, b) => b.points - a.points);

  container.innerHTML = memberStats.map((stat, index) => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank ${index < 3 ? 'rank-' + (index + 1) : ''}">#${index + 1}</div>
      <div class="leaderboard-avatar" style="background:${stat.member.color}">${stat.member.avatar}</div>
      <div class="leaderboard-info">
        <div class="leaderboard-name">${escapeHtml(stat.member.name)}</div>
        <div class="leaderboard-stats">${stat.count} chore${stat.count !== 1 ? 's' : ''} completed this week</div>
      </div>
      <div class="leaderboard-points">${stat.points} pts</div>
    </div>
  `).join('');
}

// ==========================================
// CHORE CARD RENDERING
// ==========================================

function renderChoreCard(chore) {
  const status = getChoreStatus(chore);
  const dueStatus = getDueStatusText(chore);
  const member = chore.assignedTo ? getMemberById(chore.assignedTo) : null;
  const catLabel = CATEGORY_LABELS[chore.category] || chore.category;

  let statusClass = '';
  if (status === 'overdue') statusClass = 'status-overdue';
  else if (status === 'grace-period') statusClass = 'status-grace';

  const canPostpone = chore.maxPostpones === -1 || (chore.currentPostponeStreak || 0) < chore.maxPostpones;

  let actions = '';
  if (chore.status === 'paused') {
    actions = `<button class="chore-action-btn btn-resume" onclick="event.stopPropagation(); togglePauseChore(${chore.id})">Resume</button>`;
  } else if (chore.status === 'active') {
    actions = `
      <button class="chore-action-btn btn-complete" onclick="event.stopPropagation(); openCompleteModal(${chore.id})">Done</button>
      ${canPostpone && chore.maxPostpones !== 0 ? `<button class="chore-action-btn btn-postpone" onclick="event.stopPropagation(); postponeChore(${chore.id})">Later</button>` : ''}
    `;
  }

  const avatarHtml = member
    ? `<div class="chore-assigned-avatar" style="background:${member.color}" title="${escapeHtml(member.name)}">${member.avatar}</div>`
    : '';

  return `
    <div class="chore-card priority-${chore.priority} ${statusClass}" onclick="openDetailModal(${chore.id})">
      ${avatarHtml}
      <div class="chore-card-body">
        <div class="chore-card-top">
          <span class="chore-card-title">${escapeHtml(chore.title)}</span>
          <span class="chore-badge badge-category badge-cat-${chore.category}">${catLabel}</span>
          ${chore.currentStreak > 0 ? `<span class="chore-card-streak">${chore.currentStreak} streak</span>` : ''}
        </div>
        <div class="chore-card-meta">
          <span class="chore-due-status ${dueStatus.cssClass}">${dueStatus.text}</span>
          ${chore.nextDue ? `<span>${formatDate(chore.nextDue)}</span>` : ''}
          <span class="chore-card-points">${chore.points || 0} pts</span>
          ${chore.preferredTime !== 'anytime' ? `<span>${chore.preferredTime}</span>` : ''}
          ${member ? `<span>${escapeHtml(member.name)}</span>` : '<span>Anyone</span>'}
        </div>
      </div>
      <div class="chore-card-actions">
        ${actions}
      </div>
    </div>
  `;
}

// ==========================================
// CHORES LIST RENDERING
// ==========================================

function renderChoresList() {
  const filterStatus = document.getElementById('filter-status').value;
  const filterMember = document.getElementById('filter-member').value;
  const filterCategory = document.getElementById('filter-category').value;
  const filterPriority = document.getElementById('filter-priority').value;

  let filtered = chores.filter(c => {
    // Status filter
    if (filterStatus === 'all' && c.status !== 'active') return false;
    if (filterStatus === 'paused' && c.status !== 'paused') return false;
    if (filterStatus !== 'all' && filterStatus !== 'paused' && c.status !== 'active') return false;

    if (filterStatus === 'today') {
      const s = getChoreStatus(c);
      if (s !== 'due-today' && s !== 'grace-period') return false;
    }
    if (filterStatus === 'overdue' && getChoreStatus(c) !== 'overdue') return false;
    if (filterStatus === 'grace' && getChoreStatus(c) !== 'grace-period') return false;
    if (filterStatus === 'upcoming') {
      if (!c.nextDue) return false;
      const daysUntil = daysBetween(today(), parseDate(c.nextDue));
      if (daysUntil < 0 || daysUntil > 7) return false;
    }

    // Member filter
    if (filterMember !== 'all') {
      const memberId = parseInt(filterMember);
      if (c.assignedTo !== memberId) return false;
    }

    // Category filter
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;

    // Priority filter
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;

    return true;
  });

  // Sort: overdue first, then by priority, then by due date
  filtered.sort((a, b) => {
    const statusA = getChoreStatus(a);
    const statusB = getChoreStatus(b);
    const statusOrder = { 'overdue': 0, 'grace-period': 1, 'due-today': 2, 'upcoming': 3, 'paused': 4 };
    const sA = statusOrder[statusA] !== undefined ? statusOrder[statusA] : 5;
    const sB = statusOrder[statusB] !== undefined ? statusOrder[statusB] : 5;
    if (sA !== sB) return sA - sB;

    const pA = PRIORITY_ORDER[a.priority] || 2;
    const pB = PRIORITY_ORDER[b.priority] || 2;
    if (pA !== pB) return pA - pB;

    if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue);
    return 0;
  });

  const container = document.getElementById('chores-list');
  const empty = document.getElementById('chores-empty');

  if (filtered.length > 0) {
    container.innerHTML = filtered.map(c => renderChoreCard(c)).join('');
    empty.style.display = 'none';
  } else {
    container.innerHTML = '';
    empty.style.display = '';
  }
}

// ==========================================
// FAMILY VIEW RENDERING
// ==========================================

function renderFamilyView() {
  const container = document.getElementById('family-list');
  const empty = document.getElementById('family-empty');

  if (familyMembers.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  const weekStart = getStartOfWeek();

  container.innerHTML = familyMembers.map(member => {
    const weekPoints = getMemberPoints(member.id, weekStart);
    const totalPoints = getMemberPoints(member.id, null);
    const weekCount = getMemberCompletionCount(member.id, weekStart);
    const assignedCount = chores.filter(c => c.assignedTo === member.id && c.status === 'active').length;

    return `
      <div class="family-card" onclick="openEditFamilyModal(${member.id})">
        <div class="family-avatar" style="background:${member.color}">${member.avatar}</div>
        <div class="family-info">
          <div class="family-name">${escapeHtml(member.name)}</div>
          <div class="family-role">${member.role}</div>
          <div class="family-stats">
            <span class="family-stat"><span class="family-stat-value">${assignedCount}</span> assigned</span>
            <span class="family-stat"><span class="family-stat-value">${weekCount}</span> this week</span>
            <span class="family-stat"><span class="family-stat-value">${weekPoints}</span> pts/wk</span>
            <span class="family-stat"><span class="family-stat-value">${totalPoints}</span> total pts</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// CHORE MODAL
// ==========================================

function openChoreModal(choreId) {
  editingChoreId = choreId || null;
  const modal = document.getElementById('chore-modal');
  const title = document.getElementById('chore-modal-title');
  const deleteBtn = document.getElementById('chore-delete-btn');
  const form = document.getElementById('chore-form');

  populateChoreFormDropdowns();

  if (choreId) {
    title.textContent = 'Edit Chore';
    deleteBtn.style.display = '';
    const chore = chores.find(c => c.id === choreId);
    if (chore) populateChoreForm(chore);
  } else {
    title.textContent = 'New Chore';
    deleteBtn.style.display = 'none';
    form.reset();
    document.getElementById('chore-start-date').value = toDateStr(today());
    document.getElementById('chore-slack').value = '1';
    document.getElementById('chore-max-postpones').value = '3';
    document.getElementById('chore-auto-reschedule').checked = true;
    document.getElementById('chore-snooze-days').value = '1';
    document.getElementById('chore-points').value = '10';
    document.getElementById('chore-streak-bonus').checked = true;
    document.getElementById('chore-bonus-early').checked = false;
    document.getElementById('chore-rotation').checked = false;
    document.getElementById('chore-priority').value = 'medium';
    document.getElementById('chore-effort').value = 'medium';
    updateFrequencyFields();
    updateRotationFields();
  }

  modal.style.display = 'flex';
}

function populateChoreForm(chore) {
  document.getElementById('chore-id').value = chore.id;
  document.getElementById('chore-title').value = chore.title || '';
  document.getElementById('chore-description').value = chore.description || '';
  document.getElementById('chore-category').value = chore.category || 'general';
  document.getElementById('chore-priority').value = chore.priority || 'medium';
  document.getElementById('chore-assigned').value = chore.assignedTo || '';
  document.getElementById('chore-rotation').checked = !!chore.rotationEnabled;
  document.getElementById('chore-frequency').value = chore.frequency || 'daily';
  document.getElementById('chore-interval').value = chore.intervalDays || 3;
  document.getElementById('chore-monthly-day').value = chore.monthlyDay || 1;
  document.getElementById('chore-start-date').value = chore.startDate || chore.nextDue || '';
  document.getElementById('chore-preferred-time').value = chore.preferredTime || 'anytime';
  document.getElementById('chore-slack').value = chore.slackDays !== undefined ? chore.slackDays : 1;
  document.getElementById('chore-max-postpones').value = chore.maxPostpones !== undefined ? chore.maxPostpones : 3;
  document.getElementById('chore-auto-reschedule').checked = chore.autoReschedule !== false;
  document.getElementById('chore-snooze-days').value = chore.snoozeDays || 1;
  document.getElementById('chore-effort').value = chore.effortLevel || 'medium';
  document.getElementById('chore-points').value = chore.points !== undefined ? chore.points : 10;
  document.getElementById('chore-bonus-early').checked = !!chore.bonusEarly;
  document.getElementById('chore-streak-bonus').checked = chore.streakBonus !== false;
  document.getElementById('chore-notes').value = chore.notes || '';

  // Weekly days
  document.querySelectorAll('[name="weekday"]').forEach(cb => {
    cb.checked = (chore.weeklyDays || []).includes(parseInt(cb.value));
  });

  // Rotation members
  updateRotationFields();
  if (chore.rotationMembers) {
    document.querySelectorAll('[name="rotation-member"]').forEach(cb => {
      cb.checked = chore.rotationMembers.includes(parseInt(cb.value));
    });
  }

  updateFrequencyFields();
  updateRotationFields();
}

function populateChoreFormDropdowns() {
  // Assigned to dropdown
  const assignedSelect = document.getElementById('chore-assigned');
  const currentVal = assignedSelect.value;
  assignedSelect.innerHTML = '<option value="">Anyone</option>' +
    familyMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  assignedSelect.value = currentVal;

  // Rotation members
  const rotationList = document.getElementById('rotation-members-list');
  rotationList.innerHTML = familyMembers.map(m =>
    `<label><input type="checkbox" name="rotation-member" value="${m.id}"> ${escapeHtml(m.name)}</label>`
  ).join('');
}

function updateFrequencyFields() {
  const freq = document.getElementById('chore-frequency').value;
  document.getElementById('frequency-interval-group').style.display = freq === 'every_x_days' ? '' : 'none';
  document.getElementById('frequency-weekly-group').style.display = freq === 'weekly' ? '' : 'none';
  document.getElementById('frequency-monthly-group').style.display = freq === 'monthly' ? '' : 'none';
}

function updateRotationFields() {
  const rotation = document.getElementById('chore-rotation').checked;
  document.getElementById('rotation-members-group').style.display = rotation ? '' : 'none';
}

function getChoreFormData() {
  const idStr = document.getElementById('chore-id').value;
  const existing = idStr ? chores.find(c => c.id === parseInt(idStr)) : null;

  const weeklyDays = [];
  document.querySelectorAll('[name="weekday"]:checked').forEach(cb => {
    weeklyDays.push(parseInt(cb.value));
  });

  const rotationMembers = [];
  document.querySelectorAll('[name="rotation-member"]:checked').forEach(cb => {
    rotationMembers.push(parseInt(cb.value));
  });

  const assignedVal = document.getElementById('chore-assigned').value;

  const data = {
    title: document.getElementById('chore-title').value.trim(),
    description: document.getElementById('chore-description').value.trim(),
    category: document.getElementById('chore-category').value,
    priority: document.getElementById('chore-priority').value,
    assignedTo: assignedVal ? parseInt(assignedVal) : null,
    rotationEnabled: document.getElementById('chore-rotation').checked,
    rotationMembers: rotationMembers,
    frequency: document.getElementById('chore-frequency').value,
    intervalDays: parseInt(document.getElementById('chore-interval').value) || 3,
    weeklyDays: weeklyDays,
    monthlyDay: parseInt(document.getElementById('chore-monthly-day').value) || 1,
    startDate: document.getElementById('chore-start-date').value || toDateStr(today()),
    preferredTime: document.getElementById('chore-preferred-time').value,
    slackDays: parseInt(document.getElementById('chore-slack').value) || 0,
    maxPostpones: parseInt(document.getElementById('chore-max-postpones').value),
    autoReschedule: document.getElementById('chore-auto-reschedule').checked,
    snoozeDays: parseInt(document.getElementById('chore-snooze-days').value) || 1,
    effortLevel: document.getElementById('chore-effort').value,
    points: parseInt(document.getElementById('chore-points').value) || 0,
    bonusEarly: document.getElementById('chore-bonus-early').checked,
    streakBonus: document.getElementById('chore-streak-bonus').checked,
    notes: document.getElementById('chore-notes').value.trim()
  };

  if (isNaN(data.maxPostpones)) data.maxPostpones = 3;

  // Preserve existing fields when editing
  if (existing) {
    data.id = existing.id;
    data.status = existing.status;
    data.completionCount = existing.completionCount;
    data.currentStreak = existing.currentStreak;
    data.bestStreak = existing.bestStreak;
    data.currentPostponeStreak = existing.currentPostponeStreak;
    data.lastCompleted = existing.lastCompleted;
    data.rotationIndex = existing.rotationIndex;
    data.createdAt = existing.createdAt;
    // Recalculate nextDue if frequency changed
    if (existing.frequency !== data.frequency || existing.startDate !== data.startDate) {
      data.nextDue = calculateInitialNextDue(data);
    } else {
      data.nextDue = existing.nextDue;
    }
  }

  return data;
}

function closeChoreModal() {
  document.getElementById('chore-modal').style.display = 'none';
  editingChoreId = null;
}

// ==========================================
// FAMILY MODAL
// ==========================================

function openFamilyModal() {
  document.getElementById('family-modal').style.display = 'flex';
  document.getElementById('family-modal-title').textContent = 'Add Family Member';
  document.getElementById('family-delete-btn').style.display = 'none';
  document.getElementById('family-form').reset();
  document.getElementById('member-id').value = '';
  selectedAvatar = AVATARS[0];
  selectedColor = COLORS[0];
  renderAvatarPicker();
  renderColorPicker();
}

function openEditFamilyModal(memberId) {
  const member = getMemberById(memberId);
  if (!member) return;

  document.getElementById('family-modal').style.display = 'flex';
  document.getElementById('family-modal-title').textContent = 'Edit Family Member';
  document.getElementById('family-delete-btn').style.display = '';
  document.getElementById('member-id').value = member.id;
  document.getElementById('member-name').value = member.name;
  document.getElementById('member-role').value = member.role;
  selectedAvatar = member.avatar;
  selectedColor = member.color;
  renderAvatarPicker();
  renderColorPicker();
}

function closeFamilyModal() {
  document.getElementById('family-modal').style.display = 'none';
}

function renderAvatarPicker() {
  const container = document.getElementById('avatar-picker');
  container.innerHTML = AVATARS.map(a =>
    `<div class="avatar-option ${a === selectedAvatar ? 'selected' : ''}" onclick="selectAvatar('${a}')">${a}</div>`
  ).join('');
}

function renderColorPicker() {
  const container = document.getElementById('color-picker');
  container.innerHTML = COLORS.map(c =>
    `<div class="color-option ${c === selectedColor ? 'selected' : ''}" style="background:${c}" onclick="selectColor('${c}')"></div>`
  ).join('');
}

window.selectAvatar = function(avatar) {
  selectedAvatar = avatar;
  renderAvatarPicker();
};

window.selectColor = function(color) {
  selectedColor = color;
  renderColorPicker();
};

// ==========================================
// COMPLETE MODAL
// ==========================================

function openCompleteModal(choreId) {
  completingChoreId = choreId;
  const chore = chores.find(c => c.id === choreId);
  if (!chore) return;

  document.getElementById('complete-chore-title').textContent = chore.title;
  document.getElementById('complete-notes').value = '';

  // Populate member dropdown
  const select = document.getElementById('complete-member');
  select.innerHTML = '<option value="">-- Select who completed it --</option>' +
    familyMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');

  // Pre-select assigned member
  if (chore.assignedTo) {
    select.value = chore.assignedTo;
  }

  document.getElementById('complete-modal').style.display = 'flex';
}

function closeCompleteModal() {
  document.getElementById('complete-modal').style.display = 'none';
  completingChoreId = null;
}

// ==========================================
// DETAIL MODAL
// ==========================================

function openDetailModal(choreId) {
  const chore = chores.find(c => c.id === choreId);
  if (!chore) return;

  document.getElementById('detail-modal-title').textContent = chore.title;
  document.getElementById('detail-modal-edit').onclick = () => {
    closeDetailModal();
    openChoreModal(choreId);
  };

  const member = chore.assignedTo ? getMemberById(chore.assignedTo) : null;
  const dueStatus = getDueStatusText(chore);
  const choreCompletions = completions
    .filter(c => c.choreId === choreId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 20);

  const freqLabel = FREQUENCY_LABELS[chore.frequency] || chore.frequency;
  let freqDetail = freqLabel;
  if (chore.frequency === 'every_x_days') freqDetail = `Every ${chore.intervalDays} days`;
  if (chore.frequency === 'weekly') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    freqDetail = 'Weekly: ' + (chore.weeklyDays || []).map(d => dayNames[d]).join(', ');
  }
  if (chore.frequency === 'monthly') freqDetail = `Monthly on day ${chore.monthlyDay}`;

  const body = document.getElementById('detail-modal-body');
  body.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Overview</div>
      <div class="detail-grid">
        <span class="detail-label">Status</span>
        <span class="detail-value ${dueStatus.cssClass}">${dueStatus.text}</span>
        <span class="detail-label">Category</span>
        <span class="detail-value">${CATEGORY_LABELS[chore.category] || chore.category}</span>
        <span class="detail-label">Priority</span>
        <span class="detail-value" style="text-transform:capitalize">${chore.priority}</span>
        <span class="detail-label">Assigned To</span>
        <span class="detail-value">${member ? escapeHtml(member.name) : 'Anyone'}</span>
        ${chore.description ? `
          <span class="detail-label">Description</span>
          <span class="detail-value">${escapeHtml(chore.description)}</span>
        ` : ''}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Schedule</div>
      <div class="detail-grid">
        <span class="detail-label">Frequency</span>
        <span class="detail-value">${freqDetail}</span>
        <span class="detail-label">Next Due</span>
        <span class="detail-value">${chore.nextDue ? formatDate(chore.nextDue) : 'N/A'}</span>
        <span class="detail-label">Preferred Time</span>
        <span class="detail-value" style="text-transform:capitalize">${chore.preferredTime || 'anytime'}</span>
        <span class="detail-label">Last Completed</span>
        <span class="detail-value">${chore.lastCompleted ? formatDate(chore.lastCompleted) : 'Never'}</span>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Flexibility</div>
      <div class="detail-grid">
        <span class="detail-label">Grace Period</span>
        <span class="detail-value">${chore.slackDays || 0} day${(chore.slackDays || 0) !== 1 ? 's' : ''}</span>
        <span class="detail-label">Max Postpones</span>
        <span class="detail-value">${chore.maxPostpones === -1 ? 'Unlimited' : (chore.maxPostpones === 0 ? 'None' : chore.maxPostpones)}</span>
        <span class="detail-label">Postpones Used</span>
        <span class="detail-value">${chore.currentPostponeStreak || 0}</span>
        <span class="detail-label">Postpone Duration</span>
        <span class="detail-value">${chore.snoozeDays || 1} day${(chore.snoozeDays || 1) !== 1 ? 's' : ''}</span>
        <span class="detail-label">Auto-reschedule</span>
        <span class="detail-value">${chore.autoReschedule !== false ? 'Yes' : 'No'}</span>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Effort & Points</div>
      <div class="detail-grid">
        <span class="detail-label">Effort</span>
        <span class="detail-value">${EFFORT_LABELS[chore.effortLevel] || chore.effortLevel}</span>
        <span class="detail-label">Points</span>
        <span class="detail-value">${chore.points || 0}</span>
        <span class="detail-label">Early Bonus</span>
        <span class="detail-value">${chore.bonusEarly ? 'Yes (+50%)' : 'No'}</span>
        <span class="detail-label">Streak Bonus</span>
        <span class="detail-value">${chore.streakBonus !== false ? 'Yes (+1/streak)' : 'No'}</span>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Stats</div>
      <div class="detail-grid">
        <span class="detail-label">Completions</span>
        <span class="detail-value">${chore.completionCount || 0}</span>
        <span class="detail-label">Current Streak</span>
        <span class="detail-value">${chore.currentStreak || 0}</span>
        <span class="detail-label">Best Streak</span>
        <span class="detail-value">${chore.bestStreak || 0}</span>
        ${chore.rotationEnabled ? `
          <span class="detail-label">Rotation</span>
          <span class="detail-value">${(chore.rotationMembers || []).map(id => {
            const m = getMemberById(id);
            return m ? escapeHtml(m.name) : 'Unknown';
          }).join(' → ')}</span>
        ` : ''}
      </div>
    </div>
    ${chore.notes ? `
      <div class="detail-section">
        <div class="detail-section-title">Notes</div>
        <p style="font-size:0.9rem;color:var(--text)">${escapeHtml(chore.notes)}</p>
      </div>
    ` : ''}
    ${choreCompletions.length > 0 ? `
      <div class="detail-section">
        <div class="detail-section-title">Recent Completions</div>
        <div class="detail-history">
          ${choreCompletions.map(c => {
            const who = getMemberById(c.completedBy);
            return `
              <div class="detail-history-item">
                <span>${who ? escapeHtml(who.name) : 'Unknown'} ${c.wasOnTime ? '(on time)' : '(late)'}</span>
                <span>${formatDateTime(c.completedAt)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;

  document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
  document.getElementById('detail-modal').style.display = 'none';
}

// ==========================================
// DROPDOWN POPULATORS
// ==========================================

function populateMemberDropdowns() {
  // Chore filter member dropdown
  const filterMember = document.getElementById('filter-member');
  const currentFilter = filterMember.value;
  filterMember.innerHTML = '<option value="all">All Members</option>' +
    familyMembers.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  filterMember.value = currentFilter;
}

// ==========================================
// UTILITY
// ==========================================

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Init DB and load data
  try {
    await initDB();
    await loadAllData();
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }

  populateMemberDropdowns();
  renderCurrentView();

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // FAB
  document.getElementById('fab-add').addEventListener('click', () => openChoreModal());

  // Chore modal events
  document.getElementById('chore-modal-close').addEventListener('click', closeChoreModal);
  document.getElementById('chore-modal-cancel').addEventListener('click', closeChoreModal);
  document.getElementById('chore-modal-save').addEventListener('click', async () => {
    const title = document.getElementById('chore-title').value.trim();
    if (!title) {
      alert('Please enter a title for the chore.');
      return;
    }
    const data = getChoreFormData();
    await saveChore(data);
    closeChoreModal();
  });
  document.getElementById('chore-delete-btn').addEventListener('click', async () => {
    if (editingChoreId && confirm('Delete this chore? This cannot be undone.')) {
      await deleteChore(editingChoreId);
      closeChoreModal();
    }
  });

  // Frequency change
  document.getElementById('chore-frequency').addEventListener('change', updateFrequencyFields);
  document.getElementById('chore-rotation').addEventListener('change', updateRotationFields);

  // Family modal events
  document.getElementById('btn-add-member').addEventListener('click', openFamilyModal);
  document.getElementById('family-modal-close').addEventListener('click', closeFamilyModal);
  document.getElementById('family-modal-cancel').addEventListener('click', closeFamilyModal);
  document.getElementById('family-modal-save').addEventListener('click', async () => {
    const name = document.getElementById('member-name').value.trim();
    if (!name) {
      alert('Please enter a name.');
      return;
    }
    const idStr = document.getElementById('member-id').value;
    const data = {
      name: name,
      avatar: selectedAvatar,
      color: selectedColor,
      role: document.getElementById('member-role').value
    };
    if (idStr) {
      data.id = parseInt(idStr);
      const existing = getMemberById(data.id);
      if (existing) data.createdAt = existing.createdAt;
    }
    await saveFamilyMember(data);
    closeFamilyModal();
  });
  document.getElementById('family-delete-btn').addEventListener('click', async () => {
    const idStr = document.getElementById('member-id').value;
    if (idStr && confirm('Delete this family member?')) {
      await deleteFamilyMember(parseInt(idStr));
      closeFamilyModal();
    }
  });

  // Complete modal events
  document.getElementById('complete-modal-close').addEventListener('click', closeCompleteModal);
  document.getElementById('complete-modal-cancel').addEventListener('click', closeCompleteModal);
  document.getElementById('complete-modal-save').addEventListener('click', async () => {
    const memberVal = document.getElementById('complete-member').value;
    if (!memberVal) {
      alert('Please select who completed this chore.');
      return;
    }
    const notes = document.getElementById('complete-notes').value.trim();
    await completeChore(completingChoreId, parseInt(memberVal), notes);
    closeCompleteModal();
  });

  // Detail modal events
  document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);
  document.getElementById('detail-modal-ok').addEventListener('click', closeDetailModal);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });

  // Filters
  document.getElementById('filter-status').addEventListener('change', renderChoresList);
  document.getElementById('filter-member').addEventListener('change', renderChoresList);
  document.getElementById('filter-category').addEventListener('change', renderChoresList);
  document.getElementById('filter-priority').addEventListener('change', renderChoresList);

  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');
      console.log('Service Worker registered:', reg.scope);
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }

  // PWA install
  let deferredPrompt;
  const installBtn = document.getElementById('install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = '';
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.style.display = 'none';
      }
    });
  }
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
  });
});

// Expose functions needed by onclick handlers in rendered HTML
window.openCompleteModal = openCompleteModal;
window.postponeChore = postponeChore;
window.togglePauseChore = togglePauseChore;
window.openDetailModal = openDetailModal;
window.openEditFamilyModal = openEditFamilyModal;
window.openChoreModal = openChoreModal;

// ==========================================
// EDIT FAMILY MODAL (exposed globally)
// ==========================================

function openEditFamilyModal(memberId) {
  const member = getMemberById(memberId);
  if (!member) return;

  document.getElementById('family-modal').style.display = 'flex';
  document.getElementById('family-modal-title').textContent = 'Edit Family Member';
  document.getElementById('family-delete-btn').style.display = '';
  document.getElementById('member-id').value = member.id;
  document.getElementById('member-name').value = member.name;
  document.getElementById('member-role').value = member.role;
  selectedAvatar = member.avatar;
  selectedColor = member.color;
  renderAvatarPicker();
  renderColorPicker();
}

// ==========================================
// DEV TOOLS
// ==========================================

function devLog(msg, level) {
  level = level || 'info';
  const el = document.getElementById('dev-log-content');
  if (!el) return;
  const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const cls = 'log-' + level;
  el.innerHTML += '\n<span class="' + cls + '">[' + ts + '] ' + escapeHtml(msg) + '</span>';
  el.scrollTop = el.scrollHeight;
}

window.devClearLog = function() {
  const el = document.getElementById('dev-log-content');
  if (el) el.innerHTML = 'Log cleared.';
};

// --- Dev View Render ---

function renderDevView() {
  devRefreshStats();
  devUpdateNotifStatus();
}

window.devRefreshStats = function() {
  const container = document.getElementById('dev-stats');
  if (!container) return;

  const activeChores = chores.filter(c => c.status === 'active').length;
  const pausedChores = chores.filter(c => c.status === 'paused').length;
  const completedChores = chores.filter(c => c.status === 'completed').length;
  const overdueCount = chores.filter(c => getChoreStatus(c) === 'overdue').length;
  const graceCount = chores.filter(c => getChoreStatus(c) === 'grace-period').length;
  const todayCount = chores.filter(c => getChoreStatus(c) === 'due-today').length;

  container.innerHTML = [
    { n: familyMembers.length, l: 'Family Members' },
    { n: chores.length, l: 'Total Chores' },
    { n: activeChores, l: 'Active' },
    { n: pausedChores, l: 'Paused' },
    { n: completedChores, l: 'One-Time Done' },
    { n: overdueCount, l: 'Overdue' },
    { n: graceCount, l: 'Grace Period' },
    { n: todayCount, l: 'Due Today' },
    { n: completions.length, l: 'Completions' }
  ].map(s =>
    '<div class="dev-stat-card"><div class="dev-stat-number">' + s.n + '</div><div class="dev-stat-label">' + s.l + '</div></div>'
  ).join('');
};

function devUpdateNotifStatus() {
  const el = document.getElementById('dev-notif-status');
  if (!el) return;
  if (!('Notification' in window)) {
    el.className = 'dev-notif-status dev-notif-denied';
    el.textContent = 'Notifications not supported in this browser.';
    return;
  }
  const perm = Notification.permission;
  el.className = 'dev-notif-status dev-notif-' + perm;
  const labels = { granted: 'Granted - notifications will show', denied: 'Denied - user blocked notifications', 'default': 'Not yet asked - click Request Permission' };
  el.textContent = 'Permission: ' + perm + ' - ' + (labels[perm] || perm);
}

// --- Sample Data ---

const SAMPLE_FAMILY = [
  { name: 'Mum', avatar: '\u{1F469}', color: '#e91e63', role: 'parent' },
  { name: 'Dad', avatar: '\u{1F468}', color: '#4285f4', role: 'parent' },
  { name: 'Alex', avatar: '\u{1F466}', color: '#34a853', role: 'child' },
  { name: 'Sophie', avatar: '\u{1F467}', color: '#9c27b0', role: 'child' }
];

const SAMPLE_CHORES = [
  { title: 'Wash dishes', category: 'kitchen', frequency: 'daily', priority: 'high', effort: 'medium', points: 15, preferredTime: 'evening', slackDays: 0, desc: 'Wash all dishes and wipe down counters' },
  { title: 'Take out bins', category: 'kitchen', frequency: 'weekly', priority: 'high', effort: 'quick', points: 10, weeklyDays: [2, 5], slackDays: 0, desc: 'All bins to the curb before 7am' },
  { title: 'Hoover living room', category: 'living_room', frequency: 'every_x_days', priority: 'medium', effort: 'medium', points: 15, intervalDays: 3, slackDays: 1 },
  { title: 'Clean bathroom', category: 'bathroom', frequency: 'weekly', priority: 'high', effort: 'long', points: 25, weeklyDays: [6], slackDays: 1, desc: 'Toilet, sink, shower, floor, mirror' },
  { title: 'Do laundry', category: 'laundry', frequency: 'every_x_days', priority: 'medium', effort: 'medium', points: 15, intervalDays: 2, slackDays: 1 },
  { title: 'Water garden plants', category: 'garden', frequency: 'every_x_days', priority: 'medium', effort: 'quick', points: 8, intervalDays: 2, slackDays: 2, preferredTime: 'morning' },
  { title: 'Feed the cat', category: 'pets', frequency: 'daily', priority: 'critical', effort: 'quick', points: 5, slackDays: 0, preferredTime: 'morning', desc: 'Wet food in morning, dry food top-up' },
  { title: 'Weekly food shop', category: 'shopping', frequency: 'weekly', priority: 'high', effort: 'long', points: 30, weeklyDays: [6], slackDays: 1 },
  { title: 'Tidy bedrooms', category: 'bedroom', frequency: 'weekly', priority: 'low', effort: 'medium', points: 12, weeklyDays: [0], slackDays: 2 },
  { title: 'Mop kitchen floor', category: 'kitchen', frequency: 'weekly', priority: 'medium', effort: 'medium', points: 15, weeklyDays: [3], slackDays: 1 },
  { title: 'Change bed sheets', category: 'bedroom', frequency: 'biweekly', priority: 'medium', effort: 'medium', points: 20, slackDays: 3 },
  { title: 'Clean fridge', category: 'kitchen', frequency: 'monthly', priority: 'low', effort: 'long', points: 25, monthlyDay: 1, slackDays: 5 },
  { title: 'Mow the lawn', category: 'garden', frequency: 'biweekly', priority: 'low', effort: 'long', points: 30, slackDays: 3, preferredTime: 'afternoon' },
  { title: 'Wipe kitchen surfaces', category: 'kitchen', frequency: 'daily', priority: 'medium', effort: 'quick', points: 5, slackDays: 0, preferredTime: 'evening' },
  { title: 'Sort recycling', category: 'general', frequency: 'weekly', priority: 'medium', effort: 'quick', points: 8, weeklyDays: [1], slackDays: 1 }
];

const RANDOM_CHORE_NAMES = [
  'Dust shelves', 'Organise cupboard', 'Clean windows', 'Empty dishwasher',
  'Descale kettle', 'Wipe light switches', 'Clean oven', 'Wash car',
  'Sweep patio', 'Trim hedges', 'Iron clothes', 'Fold laundry',
  'Scrub shower tiles', 'Clean microwave', 'Organise garage',
  'Polish furniture', 'Vacuum stairs', 'Clear gutters', 'Fix squeaky door',
  'Deep clean carpet', 'Organise fridge', 'Clean BBQ', 'Wash windows outside',
  'Tidy garden shed', 'Repot plants', 'Clean pet bowl', 'Walk the dog',
  'Brush the cat', 'Take out compost', 'Check smoke alarms',
  'Wipe skirting boards', 'Clean doorstep', 'Tidy porch', 'Clear junk drawer',
  'Sharpen kitchen knives', 'Clean under sofa', 'Wash curtains',
  'Check tyre pressure', 'Backup computer files', 'Update family calendar'
];

// --- Seed Functions ---

window.devSeedFamily = async function() {
  devLog('Seeding sample family members...');
  let added = 0;
  for (const m of SAMPLE_FAMILY) {
    const exists = familyMembers.find(f => f.name === m.name);
    if (!exists) {
      await saveFamilyMember({ name: m.name, avatar: m.avatar, color: m.color, role: m.role });
      added++;
    }
  }
  await loadAllData();
  populateMemberDropdowns();
  renderCurrentView();
  devLog('Added ' + added + ' family members (' + (SAMPLE_FAMILY.length - added) + ' already existed).', 'success');
};

window.devSeedChores = async function() {
  devLog('Seeding sample chores...');
  const memberIds = familyMembers.map(m => m.id);
  let count = 0;

  for (const sc of SAMPLE_CHORES) {
    const choreData = {
      title: sc.title,
      description: sc.desc || '',
      category: sc.category,
      priority: sc.priority,
      assignedTo: memberIds.length > 0 ? memberIds[count % memberIds.length] : null,
      rotationEnabled: false,
      rotationMembers: [],
      frequency: sc.frequency,
      intervalDays: sc.intervalDays || 3,
      weeklyDays: sc.weeklyDays || [1],
      monthlyDay: sc.monthlyDay || 1,
      startDate: toDateStr(today()),
      preferredTime: sc.preferredTime || 'anytime',
      slackDays: sc.slackDays !== undefined ? sc.slackDays : 1,
      maxPostpones: 3,
      autoReschedule: true,
      snoozeDays: 1,
      effortLevel: sc.effort || 'medium',
      points: sc.points || 10,
      bonusEarly: count % 3 === 0,
      streakBonus: true,
      notes: ''
    };
    await saveChore(choreData);
    count++;
  }

  devLog('Added ' + count + ' sample chores.', 'success');
};

window.devSeedAll = async function() {
  await window.devSeedFamily();
  await window.devSeedChores();
  devLog('Full seed complete!', 'success');
};

// --- Bulk Chore Generation ---

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

window.devAddRandomChores = async function(count) {
  devLog('Generating ' + count + ' random chores...');
  const categories = Object.keys(CATEGORY_LABELS);
  const priorities = ['low', 'medium', 'high', 'critical'];
  const efforts = ['quick', 'medium', 'long'];
  const frequencies = ['daily', 'every_x_days', 'weekly', 'biweekly', 'monthly', 'once'];
  const times = ['anytime', 'morning', 'afternoon', 'evening'];
  const memberIds = familyMembers.map(m => m.id);
  const usedNames = new Set(chores.map(c => c.title));

  let added = 0;
  for (let i = 0; i < count; i++) {
    let name = randomPick(RANDOM_CHORE_NAMES);
    // Avoid duplicates by appending a number
    if (usedNames.has(name)) name = name + ' #' + randomInt(2, 99);
    usedNames.add(name);

    const freq = randomPick(frequencies);
    const choreData = {
      title: name,
      description: '',
      category: randomPick(categories),
      priority: randomPick(priorities),
      assignedTo: memberIds.length > 0 ? randomPick(memberIds) : null,
      rotationEnabled: false,
      rotationMembers: [],
      frequency: freq,
      intervalDays: randomInt(2, 7),
      weeklyDays: freq === 'weekly' ? [randomInt(0, 6)] : [1],
      monthlyDay: randomInt(1, 28),
      startDate: toDateStr(today()),
      preferredTime: randomPick(times),
      slackDays: randomInt(0, 3),
      maxPostpones: randomPick([-1, 0, 1, 3, 5]),
      autoReschedule: Math.random() > 0.3,
      snoozeDays: randomPick([1, 1, 1, 2, 3]),
      effortLevel: randomPick(efforts),
      points: randomPick([5, 8, 10, 12, 15, 20, 25, 30]),
      bonusEarly: Math.random() > 0.6,
      streakBonus: Math.random() > 0.3,
      notes: ''
    };
    await saveChore(choreData);
    added++;
  }

  devLog('Added ' + added + ' random chores.', 'success');
};

window.devAddOverdueChores = async function(count) {
  devLog('Adding ' + count + ' overdue chores...');
  const categories = Object.keys(CATEGORY_LABELS);
  const memberIds = familyMembers.map(m => m.id);
  let added = 0;

  for (let i = 0; i < count; i++) {
    const daysAgo = randomInt(3, 14);
    const dueDate = new Date(today());
    dueDate.setDate(dueDate.getDate() - daysAgo);

    const choreData = {
      title: 'Overdue: ' + randomPick(RANDOM_CHORE_NAMES),
      description: 'Test overdue chore, ' + daysAgo + ' days late',
      category: randomPick(categories),
      priority: randomPick(['high', 'critical']),
      assignedTo: memberIds.length > 0 ? randomPick(memberIds) : null,
      rotationEnabled: false, rotationMembers: [],
      frequency: 'daily',
      intervalDays: 3, weeklyDays: [1], monthlyDay: 1,
      startDate: toDateStr(dueDate),
      preferredTime: 'anytime',
      slackDays: Math.max(0, daysAgo - randomInt(3, 5)),
      maxPostpones: 3, autoReschedule: true, snoozeDays: 1,
      effortLevel: 'medium', points: 15,
      bonusEarly: false, streakBonus: true, notes: ''
    };

    // We need to manually set nextDue to be in the past
    choreData.createdAt = new Date().toISOString();
    choreData.updatedAt = new Date().toISOString();
    choreData.completionCount = 0;
    choreData.currentStreak = 0;
    choreData.bestStreak = 0;
    choreData.currentPostponeStreak = 0;
    choreData.lastCompleted = null;
    choreData.status = 'active';
    choreData.rotationIndex = 0;
    choreData.nextDue = toDateStr(dueDate);
    await dbAdd('chores', choreData);
    added++;
  }

  await loadAllData();
  renderCurrentView();
  devLog('Added ' + added + ' overdue chores.', 'success');
};

window.devAddTodayChores = async function(count) {
  devLog('Adding ' + count + ' due-today chores...');
  const categories = Object.keys(CATEGORY_LABELS);
  const memberIds = familyMembers.map(m => m.id);
  let added = 0;

  for (let i = 0; i < count; i++) {
    const choreData = {
      title: 'Today: ' + randomPick(RANDOM_CHORE_NAMES),
      description: 'Test chore due today',
      category: randomPick(categories),
      priority: randomPick(['medium', 'high']),
      assignedTo: memberIds.length > 0 ? randomPick(memberIds) : null,
      rotationEnabled: false, rotationMembers: [],
      frequency: 'daily',
      intervalDays: 3, weeklyDays: [1], monthlyDay: 1,
      startDate: toDateStr(today()),
      preferredTime: randomPick(['morning', 'afternoon', 'evening']),
      slackDays: 1, maxPostpones: 3, autoReschedule: true, snoozeDays: 1,
      effortLevel: randomPick(['quick', 'medium']), points: 10,
      bonusEarly: false, streakBonus: true, notes: ''
    };
    await saveChore(choreData);
    added++;
  }

  devLog('Added ' + added + ' due-today chores.', 'success');
};

window.devAddGracePeriodChores = async function(count) {
  devLog('Adding ' + count + ' grace-period chores...');
  const categories = Object.keys(CATEGORY_LABELS);
  const memberIds = familyMembers.map(m => m.id);
  let added = 0;

  for (let i = 0; i < count; i++) {
    const slackDays = randomInt(2, 5);
    const daysLate = randomInt(1, slackDays);
    const dueDate = new Date(today());
    dueDate.setDate(dueDate.getDate() - daysLate);

    const choreData = {
      title: 'Grace: ' + randomPick(RANDOM_CHORE_NAMES),
      description: 'Test grace period chore, ' + daysLate + 'd late with ' + slackDays + 'd slack',
      category: randomPick(categories),
      priority: 'medium',
      assignedTo: memberIds.length > 0 ? randomPick(memberIds) : null,
      rotationEnabled: false, rotationMembers: [],
      frequency: 'daily',
      intervalDays: 3, weeklyDays: [1], monthlyDay: 1,
      startDate: toDateStr(dueDate),
      preferredTime: 'anytime',
      slackDays: slackDays,
      maxPostpones: 3, autoReschedule: true, snoozeDays: 1,
      effortLevel: 'medium', points: 12,
      bonusEarly: false, streakBonus: true, notes: ''
    };

    choreData.createdAt = new Date().toISOString();
    choreData.updatedAt = new Date().toISOString();
    choreData.completionCount = 0;
    choreData.currentStreak = 0;
    choreData.bestStreak = 0;
    choreData.currentPostponeStreak = 0;
    choreData.lastCompleted = null;
    choreData.status = 'active';
    choreData.rotationIndex = 0;
    choreData.nextDue = toDateStr(dueDate);
    await dbAdd('chores', choreData);
    added++;
  }

  await loadAllData();
  renderCurrentView();
  devLog('Added ' + added + ' grace-period chores.', 'success');
};

// --- Simulate Activity ---

window.devSimulateCompletions = async function(count) {
  if (familyMembers.length === 0) {
    devLog('No family members! Seed family first.', 'error');
    return;
  }
  if (chores.length === 0) {
    devLog('No chores! Seed chores first.', 'error');
    return;
  }

  devLog('Simulating ' + count + ' completions...');
  const memberIds = familyMembers.map(m => m.id);
  const activeChores = chores.filter(c => c.status === 'active');
  if (activeChores.length === 0) {
    devLog('No active chores to complete!', 'warn');
    return;
  }

  let added = 0;
  for (let i = 0; i < count; i++) {
    const chore = randomPick(activeChores);
    const memberId = randomPick(memberIds);
    const daysAgo = randomInt(0, 6);
    const completedDate = new Date();
    completedDate.setDate(completedDate.getDate() - daysAgo);
    completedDate.setHours(randomInt(7, 21), randomInt(0, 59), 0, 0);

    const wasOnTime = Math.random() > 0.3;
    const pts = calculatePoints(chore, wasOnTime);

    const completion = {
      choreId: chore.id,
      completedBy: memberId,
      completedAt: completedDate.toISOString(),
      scheduledFor: chore.nextDue || toDateStr(completedDate),
      wasOnTime: wasOnTime,
      wasPostponed: Math.random() > 0.7,
      postponeCount: wasOnTime ? 0 : randomInt(1, 3),
      notes: '',
      pointsAwarded: pts
    };
    await dbAdd('completions', completion);
    added++;
  }

  await loadAllData();
  renderCurrentView();
  devLog('Added ' + added + ' simulated completions.', 'success');
};

window.devCompleteAllToday = async function() {
  if (familyMembers.length === 0) {
    devLog('No family members! Seed family first.', 'error');
    return;
  }

  const todayChores = chores.filter(c => {
    const s = getChoreStatus(c);
    return s === 'due-today' || s === 'grace-period' || s === 'overdue';
  });

  if (todayChores.length === 0) {
    devLog('No chores due today/overdue to complete.', 'warn');
    return;
  }

  devLog('Completing ' + todayChores.length + ' chores...');
  const memberIds = familyMembers.map(m => m.id);

  for (const chore of todayChores) {
    const memberId = chore.assignedTo || randomPick(memberIds);
    await completeChore(chore.id, memberId, 'Auto-completed by dev tools');
  }

  devLog('Completed ' + todayChores.length + ' chores!', 'success');
};

window.devPostponeAllToday = async function() {
  const todayChores = chores.filter(c => {
    const s = getChoreStatus(c);
    return s === 'due-today' || s === 'grace-period';
  });

  if (todayChores.length === 0) {
    devLog('No chores due today to postpone.', 'warn');
    return;
  }

  devLog('Postponing ' + todayChores.length + ' chores...');
  for (const chore of todayChores) {
    await postponeChore(chore.id);
  }
  devLog('Postponed ' + todayChores.length + ' chores.', 'success');
};

// --- Notifications ---
// All notifications use ServiceWorker.showNotification() for PWA compatibility.
// The direct `new Notification()` constructor does not work reliably in PWA contexts.

async function showNotif(title, options) {
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, options);
  } else {
    new Notification(title, options);
  }
}

function checkNotifPermission() {
  if (!('Notification' in window)) {
    devLog('Notification API not supported.', 'error');
    return false;
  }
  if (Notification.permission !== 'granted') {
    devLog('Permission not granted. Current: ' + Notification.permission + '. Click "Request Permission" first.', 'warn');
    return false;
  }
  return true;
}

window.devRequestNotifPermission = async function() {
  if (!('Notification' in window)) {
    devLog('Notification API not supported in this browser.', 'error');
    return;
  }
  devLog('Requesting notification permission...');
  try {
    const perm = await Notification.requestPermission();
    devLog('Permission result: ' + perm, perm === 'granted' ? 'success' : 'warn');
  } catch (err) {
    devLog('Permission request failed: ' + err.message, 'error');
  }
  devUpdateNotifStatus();
};

window.devFireBasicNotif = async function() {
  if (!checkNotifPermission()) return;
  devLog('Firing basic notification...');
  try {
    await showNotif('Family Dashboard', {
      body: 'This is a test notification from the dev tools!',
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: 'dev-test-basic'
    });
    devLog('Basic notification fired.', 'success');
  } catch (err) {
    devLog('Basic notification failed: ' + err.message, 'error');
  }
};

window.devFireChoreReminder = async function() {
  if (!checkNotifPermission()) return;

  const activeChores = chores.filter(c => c.status === 'active');
  let choreTitle = 'Wash the dishes';
  let assigned = 'everyone';
  if (activeChores.length > 0) {
    const c = randomPick(activeChores);
    choreTitle = c.title;
    const m = c.assignedTo ? getMemberById(c.assignedTo) : null;
    assigned = m ? m.name : 'everyone';
  }

  devLog('Firing chore reminder notification...');
  try {
    await showNotif('Chore Reminder', {
      body: choreTitle + ' is due today! Assigned to ' + assigned + '.',
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: 'chore-reminder-' + Date.now(),
      vibrate: [200, 100, 200],
      requireInteraction: false
    });
    devLog('Chore reminder fired for: ' + choreTitle, 'success');
  } catch (err) {
    devLog('Chore reminder failed: ' + err.message, 'error');
  }
};

window.devFireOverdueAlert = async function() {
  if (!checkNotifPermission()) return;

  const overdueChores = chores.filter(c => getChoreStatus(c) === 'overdue');
  let body = 'You have overdue chores! Time to get on top of things.';
  if (overdueChores.length > 0) {
    const names = overdueChores.slice(0, 3).map(c => c.title).join(', ');
    body = overdueChores.length + ' chore(s) overdue: ' + names;
    if (overdueChores.length > 3) body += ' and ' + (overdueChores.length - 3) + ' more';
  }

  devLog('Firing overdue alert...');
  try {
    await showNotif('Overdue Alert!', {
      body: body,
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: 'overdue-alert-' + Date.now(),
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true
    });
    devLog('Overdue alert fired.', 'success');
  } catch (err) {
    devLog('Overdue alert failed: ' + err.message, 'error');
  }
};

window.devFireSWNotif = async function() {
  if (!('serviceWorker' in navigator)) {
    devLog('Service Worker not supported.', 'error');
    return;
  }
  if (!checkNotifPermission()) return;

  devLog('Firing notification via Service Worker...');
  try {
    await showNotif('Family Dashboard (via SW)', {
      body: 'This notification came through the Service Worker!',
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: 'dev-sw-test-' + Date.now(),
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
    devLog('Service Worker notification fired.', 'success');
  } catch (err) {
    devLog('SW notification failed: ' + err.message, 'error');
  }
};

window.devFireCustomNotif = async function() {
  if (!checkNotifPermission()) return;

  const title = document.getElementById('dev-notif-title').value || 'Test';
  const body = document.getElementById('dev-notif-body').value || 'Test body';
  const tag = document.getElementById('dev-notif-tag').value || 'test';
  const requireInteraction = document.getElementById('dev-notif-require-interaction').checked;
  const vibrate = document.getElementById('dev-notif-vibrate').checked;

  devLog('Firing custom notification: "' + title + '"...');
  try {
    await showNotif(title, {
      body: body,
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: tag + '-' + Date.now(),
      requireInteraction: requireInteraction,
      vibrate: vibrate ? [200, 100, 200] : undefined
    });
    devLog('Custom notification fired.', 'success');
  } catch (err) {
    devLog('Custom notification failed: ' + err.message, 'error');
  }
};

window.devFireCustomViaSW = async function() {
  if (!('serviceWorker' in navigator)) {
    devLog('Service Worker not supported.', 'error');
    return;
  }
  if (!checkNotifPermission()) return;

  const title = document.getElementById('dev-notif-title').value || 'Test';
  const body = document.getElementById('dev-notif-body').value || 'Test body';
  const tag = document.getElementById('dev-notif-tag').value || 'test';
  const requireInteraction = document.getElementById('dev-notif-require-interaction').checked;
  const vibrate = document.getElementById('dev-notif-vibrate').checked;

  devLog('Firing custom notification via SW: "' + title + '"...');
  try {
    await showNotif(title, {
      body: body,
      icon: './icon-192x192.png',
      badge: './icon-192x192.png',
      tag: tag + '-sw-' + Date.now(),
      requireInteraction: requireInteraction,
      vibrate: vibrate ? [200, 100, 200] : undefined,
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
    devLog('Custom SW notification fired.', 'success');
  } catch (err) {
    devLog('Custom SW notification failed: ' + err.message, 'error');
  }
};

window.devFireNotifBurst = async function(count) {
  if (!checkNotifPermission()) return;
  devLog('Firing burst of ' + count + ' notifications...');

  const messages = [
    'Wash dishes is overdue!', 'Take out bins - due today',
    'Hoover the living room', 'Feed the cat NOW!',
    'Weekly shop reminder', 'Time to mop the floor',
    'Laundry needs doing', 'Water the garden plants',
    'Clean the bathroom', 'Tidy your bedroom'
  ];

  for (let i = 0; i < count; i++) {
    const msg = messages[i % messages.length];
    const delay = i * 800;

    setTimeout(async () => {
      try {
        await showNotif('Family Dashboard', {
          body: '(' + (i + 1) + '/' + count + ') ' + msg,
          icon: './icon-192x192.png',
          tag: 'burst-' + Date.now() + '-' + i,
          vibrate: [100]
        });
      } catch (err) {
        devLog('Burst notification ' + (i + 1) + ' failed: ' + err.message, 'error');
      }
    }, delay);
  }

  devLog('Burst scheduled: ' + count + ' notifications over ' + ((count * 800) / 1000).toFixed(1) + 's.', 'success');
};

// --- Data Management ---

function devClearStore(storeName, label) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => {
      devLog('Cleared all ' + label + '.', 'success');
      resolve();
    };
    request.onerror = () => {
      devLog('Failed to clear ' + label + ': ' + request.error, 'error');
      reject(request.error);
    };
  });
}

window.devClearChores = async function() {
  if (!confirm('Clear ALL chores? This cannot be undone.')) return;
  await devClearStore('chores', 'chores');
  await loadAllData();
  renderCurrentView();
};

window.devClearCompletions = async function() {
  if (!confirm('Clear ALL completion history?')) return;
  await devClearStore('completions', 'completions');
  await loadAllData();
  renderCurrentView();
};

window.devClearFamily = async function() {
  if (!confirm('Clear ALL family members?')) return;
  await devClearStore('familyMembers', 'family members');
  await loadAllData();
  populateMemberDropdowns();
  renderCurrentView();
};

window.devNuclearReset = async function() {
  if (!confirm('NUCLEAR RESET: Delete ALL data (chores, completions, family members)? This CANNOT be undone!')) return;
  if (!confirm('Are you really sure? Everything will be gone.')) return;

  await devClearStore('chores', 'chores');
  await devClearStore('completions', 'completions');
  await devClearStore('familyMembers', 'family members');
  await loadAllData();
  populateMemberDropdowns();
  renderCurrentView();
  devLog('Nuclear reset complete. All data wiped.', 'warn');
};

window.devExportJSON = function() {
  const data = {
    exportedAt: new Date().toISOString(),
    familyMembers: familyMembers,
    chores: chores,
    completions: completions
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'family-dashboard-export-' + toDateStr(today()) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  devLog('Exported ' + familyMembers.length + ' members, ' + chores.length + ' chores, ' + completions.length + ' completions.', 'success');
};
