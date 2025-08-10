const elBlob = document.getElementById('blob');
const elSpeech = document.getElementById('speech');
const elSay = document.getElementById('say-btn');
const elMood = document.getElementById('mood-btn');
const elQuit = document.getElementById('quit-btn');
const elStreak = document.getElementById('streak-pill');
const elSettingsBtn = document.getElementById('settings-btn');
const dlgSettings = document.getElementById('settings');
const inNickname = document.getElementById('nickname-input');
const chkTeasing = document.getElementById('toggle-teasing');
const chkShowoff = document.getElementById('toggle-showoff');
const chkClingy = document.getElementById('toggle-clingy');
const btnSaveSettings = document.getElementById('save-settings');

const moods = ['happy', 'curious', 'bored', 'annoyed', 'excited', 'sleepy'];
let moodIndex = 0;
let ignoreTimer = null;
let fakingSleep = false;
let playingDead = false;
let allowTeasing = true;
let allowShowoff = true;
let allowClingy = false;
let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let prefetchQueue = [];
let prefetching = false;
let lastActivitySavedAt = 0;
const isElectron = !!window.blobAPI;

// Memory helpers
async function setMemGlobal(key, value) {
  try {
    if (isElectron) return await window.blobAPI.setMemory(key, value);
    await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
  } catch {}
}
async function getMemGlobal(key, def) {
  try {
    if (isElectron) {
      const r = await window.blobAPI.getMemory(key);
      return r?.value ?? def;
    }
    const r = await fetch(`/api/memory/${encodeURIComponent(key)}`);
    const j = await r.json();
    return j?.value ?? def;
  } catch { return def; }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function updateLastInteraction(kind = 'move') {
  const now = Date.now();
  // throttle saves to once per 60s
  if (now - lastActivitySavedAt < 60000 && kind !== 'click') return;
  lastActivitySavedAt = now;
  await setMemGlobal('lastInteractionAt', now);
  await setMemGlobal('lastInteractionDay', todayStr());
}

function selectInsideJokes(jokes = [], usageMap = {}, max = 2) {
  const enriched = jokes.map(text => {
    const u = usageMap?.[text] || {};
    return { text, count: u.count || 0, lastUsed: u.lastUsed || 0 };
  });
  enriched.sort((a, b) => (a.lastUsed - b.lastUsed) || (a.count - b.count));
  return enriched.slice(0, max).map(j => j.text);
}

async function bumpJokeUsage(usedJokes = []) {
  if (!usedJokes?.length) return;
  const usage = await getMemGlobal('insideJokesUsage', {});
  const now = Date.now();
  for (const j of usedJokes) {
    if (!usage[j]) usage[j] = { count: 0, lastUsed: 0 };
    usage[j].count += 1;
    usage[j].lastUsed = now;
  }
  await setMemGlobal('insideJokesUsage', usage);
}

function setMood(m) {
  for (const mm of moods) elBlob.classList.remove(mm);
  elBlob.classList.add(m);
}

function say(text) {
  elSpeech.textContent = text;
}

async function askLLM(prompt) {
  const nickname = await getMemGlobal('nickname', 'friend');
  const jokes = (await getMemGlobal('insideJokes', [])) || [];
  const usage = (await getMemGlobal('insideJokesUsage', {})) || {};
  const pickedJokes = selectInsideJokes(jokes, usage, 2);
  try {
    let res;
    if (isElectron) {
      res = await window.blobAPI.askLLM({ prompt, mood: moods[moodIndex], nickname, insideJokes: pickedJokes });
    } else {
      const r = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mood: moods[moodIndex], nickname, insideJokes: pickedJokes })
      });
      res = await r.json();
    }
    if (res.ok) {
      say(res.text);
      bumpJokeUsage(pickedJokes);
    }
    else say(`(whispers) I failed to think: ${res.error}`);
  } catch (e) {
    say(`(static) ${e?.message || e}`);
  }
}

async function fetchQuip() {
  try {
    const nickname = await getMemGlobal('nickname', 'friend');
    const jokes = (await getMemGlobal('insideJokes', [])) || [];
    const usage = (await getMemGlobal('insideJokesUsage', {})) || {};
    const pickedJokes = selectInsideJokes(jokes, usage, 2);
    let res;
    if (isElectron) {
      res = await window.blobAPI.askLLM({ prompt: 'Make a playful one-liner suitable for a quick quip; keep 1 short sentence.', mood: moods[moodIndex], nickname, insideJokes: pickedJokes });
    } else {
      const r = await fetch('/api/llm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Make a playful one-liner suitable for a quick quip; keep 1 short sentence.', mood: moods[moodIndex], nickname, insideJokes: pickedJokes }) });
      res = await r.json();
    }
    if (res?.ok && res.text) {
      await bumpJokeUsage(pickedJokes);
      return res.text;
    }
  } catch {}
  return null;
}

async function prefetchQuips(n = 2) {
  if (prefetching) return;
  prefetching = true;
  try {
    const promises = [];
    for (let i = 0; i < n; i++) promises.push(fetchQuip());
    const results = await Promise.all(promises);
    for (const t of results) if (t) prefetchQueue.push(t);
  } finally {
    prefetching = false;
  }
}

function randomBehavior() {
  // Small chance to perform a random trick
  const r = Math.random();
  if (!allowShowoff) return;
  if (r < 0.15) {
    elBlob.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-20px) rotate(10deg) scale(1.05,0.95)' },
      { transform: 'translateY(0) rotate(0) scale(1)' },
    ], { duration: 600, easing: 'ease-out' });
  } else if (r < 0.3) {
    // Wave
    elBlob.animate([
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.2)' },
      { filter: 'brightness(1)' },
    ], { duration: 500, easing: 'ease-out' });
  }
}

async function scheduleIgnore() {
  if (ignoreTimer) clearTimeout(ignoreTimer);
  const streak = await getMemGlobal('ignoredStreakDays', 0);
  // Higher streak => quicker sulk, more clingy vibe
  const sulkDelay = Math.max(8000, 25000 - (streak * 2000)); // floor at 8s
  const sleepDelay = Math.max(6000, 12000 - (streak * 1000)); // floor at 6s
  ignoreTimer = setTimeout(() => {
    // Turn away sulkily
    elBlob.animate([
      { transform: 'translateY(0) scale(1) rotate(0)' },
      { transform: 'translateY(4px) scale(0.98,1.02) rotate(-12deg)' },
      { transform: 'translateY(0) scale(1) rotate(0)' },
    ], { duration: 1600, easing: 'ease-in-out' });

    if (allowTeasing) {
      const vibe = streak >= 3 ? 'clingy and dramatic (but sweet)' : 'playful not mean';
      askLLM(`Say a short sulky one-liner about being ignored, ${vibe}.`);
    }
    // If ignored longer, fake sleep
    setTimeout(() => {
      if (!playingDead && allowClingy) {
        fakingSleep = true;
        moodIndex = moods.indexOf('sleepy');
        setMood('sleepy');
        say('zZz…');
      }
    }, sleepDelay);
  }, sulkDelay);
  // Keep a small pool of prefetched quips
  if (prefetchQueue.length < 2) prefetchQuips(2 - prefetchQueue.length);
}

function handleMouseMove(e) {
  scheduleIgnore();
  const rect = elBlob.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;
  const dist = Math.hypot(dx, dy);

  if (moods[moodIndex] === 'curious' && dist > 40) {
    // subtly lean toward cursor
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    elBlob.style.transform = `translateY(-6px) rotate(${angle * 0.05}deg)`;
  } else if (moods[moodIndex] === 'annoyed' && dist < 140) {
    // move away slightly
    const awayX = -dx * 0.05;
    const awayY = -dy * 0.05;
    elBlob.style.transform = `translate(${awayX}px, ${awayY - 6}px)`;
  } else {
    elBlob.style.transform = '';
  }
}

async function firstRunInit() {
  const isElectron = !!window.blobAPI;
  async function setMem(key, value) {
    if (isElectron) return window.blobAPI.setMemory(key, value);
    await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
  }
  async function getMem(key) {
    if (isElectron) return (await window.blobAPI.getMemory(key)).value;
    const r = await fetch(`/api/memory/${encodeURIComponent(key)}`);
    const j = await r.json();
    return j.value;
  }
  // Load settings
  allowTeasing = (await getMem('allowTeasing')) ?? true;
  allowShowoff = (await getMem('allowShowoff')) ?? true;
  allowClingy = (await getMem('allowClingy')) ?? false;
  const savedNickname = await getMem('nickname');
  if (savedNickname) inNickname.value = savedNickname;
  chkTeasing.checked = allowTeasing;
  chkShowoff.checked = allowShowoff;
  chkClingy.checked = allowClingy;

  const seen = await getMem('seenOnboarding');
  if (!seen) {
    await setMem('insideJokes', ['secret bounce']);
    await setMem('seenOnboarding', true);
    await askLLM('Greet the user warmly and mention our new "secret bounce" handshake. Keep it short. Also ask: Should I call you Captain, Boss, or Jelly Commander?');
  } else {
    await askLLM('Say a tiny hello suited for a quick check-in.');
  }

  // Prefetch a one-liner to reduce latency later
  llmPrefetch = askLLM('Prepare a playful one-liner but do not say it yet; keep it a single short sentence.');
}

elSay.addEventListener('click', () => {
  // Use prefetched if available; else ask on-demand
  if (prefetchQueue.length) {
    const next = prefetchQueue.shift();
    say(next);
    // Top up the queue in background
    if (prefetchQueue.length < 2) prefetchQuips(1);
  } else {
    const prompts = [
      'Share a tiny mood comment right now.',
      'Blurt a curious random fact in 1 sentence.',
      'Light teasing: a playful, harmless quip about the user\'s cursor. Keep it friendly.',
    ];
    const p = prompts[Math.floor(Math.random() * prompts.length)];
    askLLM(p);
  }
});

elMood.addEventListener('click', () => {
  moodIndex = (moodIndex + 1) % moods.length;
  setMood(moods[moodIndex]);
  randomBehavior();
});

// Hover wave
elBlob.addEventListener('mouseenter', () => {
  elBlob.animate([
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-8px) scale(1.03,0.97)' },
    { transform: 'translateY(0) scale(1)' },
  ], { duration: 400, easing: 'ease-out' });
});

// Click to wake from fake sleep or perform a playful pop
elBlob.addEventListener('click', () => {
  if (fakingSleep) {
    fakingSleep = false;
    setMood('happy');
    say('I was totally awake. Obviously.');
  } else if (!playingDead) {
    elBlob.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-14px) scale(1.06,0.94)' },
      { transform: 'translateY(0) scale(1)' },
    ], { duration: 380, easing: 'ease-out' });
  }
});

// Double click: play dead and pop back
elBlob.addEventListener('dblclick', () => {
  if (playingDead) return;
  playingDead = true;
  const oldAnim = elBlob.style.animation;
  elBlob.style.animation = 'none';
  elBlob.style.transform = 'scale(1.2, 0.2)';
  say('x_x');
  setTimeout(() => {
    elBlob.style.transform = '';
    elBlob.style.animation = oldAnim || '';
    playingDead = false;
    say('Gotcha.');
    randomBehavior();
  }, 1600);
});

elQuit.addEventListener('click', async () => {
  const isElectron = !!window.blobAPI;
  let bye = { ok: true, text: 'Bye!' };
  try {
    if (isElectron) bye = await window.blobAPI.goodbye();
    else {
      const r = await fetch('/api/goodbye', { method: 'POST' });
      bye = await r.json();
    }
  } catch {}
  if (bye.ok) say(bye.text);
  setTimeout(async () => {
    if (isElectron) window.blobAPI.invokeQuit?.();
    else await fetch('/api/quit', { method: 'POST' });
  }, 900);
});

window.addEventListener('mousemove', (e) => { handleMouseMove(e); updateLastInteraction('move'); });
window.addEventListener('click', () => { scheduleIgnore(); updateLastInteraction('click'); });

setMood(moods[moodIndex]);
firstRunInit();

// On startup, update ignored streak days if last interaction was a while ago
(async () => {
  const lastAt = await getMemGlobal('lastInteractionAt', 0);
  const lastDay = await getMemGlobal('lastInteractionDay', '');
  const now = Date.now();
  const curDay = todayStr();
  let streak = await getMemGlobal('ignoredStreakDays', 0);
  // If a new day and user hasn't interacted in >6 hours, bump streak
  if (lastDay && lastDay !== curDay && (!lastAt || now - lastAt > 6 * 60 * 60 * 1000)) {
    streak += 1;
    await setMemGlobal('ignoredStreakDays', streak);
  }
  // Update streak pill
  if (streak > 0) {
    elStreak.textContent = `${streak}d`;
    elStreak.hidden = false;
  } else {
    elStreak.hidden = true;
  }
  // Start with a couple prefetched quips
  prefetchQuips(2);
})();

// Settings UI
elSettingsBtn.addEventListener('click', () => {
  dlgSettings.showModal();
});

btnSaveSettings.addEventListener('click', async (e) => {
  e.preventDefault();
  const isElectron = !!window.blobAPI;
  const setMem = async (k, v) => {
    if (isElectron) return window.blobAPI.setMemory(k, v);
    await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k, value: v }) });
  };
  allowTeasing = !!chkTeasing.checked;
  allowShowoff = !!chkShowoff.checked;
  allowClingy = !!chkClingy.checked;
  const nickname = inNickname.value?.trim();
  await setMem('allowTeasing', allowTeasing);
  await setMem('allowShowoff', allowShowoff);
  await setMem('allowClingy', allowClingy);
  if (nickname) await setMem('nickname', nickname);
  dlgSettings.close();
  say('Settings tucked away.');
});

// Reduced motion: dampen animations
if (reducedMotion) {
  document.documentElement.style.setProperty('--motion-scale', '0.5');
}
