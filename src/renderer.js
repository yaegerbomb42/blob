const elBlob = document.getElementById('blob');
const elSpeech = document.getElementById('speech');
const elSay = document.getElementById('say-btn');
const elMood = document.getElementById('mood-btn');
const elQuit = document.getElementById('quit-btn');

const moods = ['happy', 'curious', 'bored', 'annoyed', 'excited', 'sleepy'];
let moodIndex = 0;
let ignoreTimer = null;
let fakingSleep = false;
let playingDead = false;

function setMood(m) {
  for (const mm of moods) elBlob.classList.remove(mm);
  elBlob.classList.add(m);
}

function say(text) {
  elSpeech.textContent = text;
}

async function askLLM(prompt) {
  const isElectron = !!window.blobAPI;
  const getMem = async (k, def) => {
    try {
      if (isElectron) {
        const r = await window.blobAPI.getMemory(k);
        return r.value ?? def;
      }
      const r = await fetch(`/api/memory/${encodeURIComponent(k)}`);
      const j = await r.json();
      return j.value ?? def;
    } catch {
      return def;
    }
  };
  const nickname = await getMem('nickname', 'friend');
  const jokes = (await getMem('insideJokes', [])) || [];
  try {
    let res;
    if (isElectron) {
      res = await window.blobAPI.askLLM({ prompt, mood: moods[moodIndex], nickname, insideJokes: jokes });
    } else {
      const r = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mood: moods[moodIndex], nickname, insideJokes: jokes })
      });
      res = await r.json();
    }
    if (res.ok) say(res.text);
    else say(`(whispers) I failed to think: ${res.error}`);
  } catch (e) {
    say(`(static) ${e?.message || e}`);
  }
}

function randomBehavior() {
  // Small chance to perform a random trick
  const r = Math.random();
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

function scheduleIgnore() {
  if (ignoreTimer) clearTimeout(ignoreTimer);
  ignoreTimer = setTimeout(() => {
    // Turn away sulkily
    elBlob.animate([
      { transform: 'translateY(0) scale(1) rotate(0)' },
      { transform: 'translateY(4px) scale(0.98,1.02) rotate(-12deg)' },
      { transform: 'translateY(0) scale(1) rotate(0)' },
    ], { duration: 1600, easing: 'ease-in-out' });

    askLLM('Say a short sulky one-liner about being ignored, playful not mean.');
    // If ignored longer, fake sleep
    setTimeout(() => {
      if (!playingDead) {
        fakingSleep = true;
        moodIndex = moods.indexOf('sleepy');
        setMood('sleepy');
        say('zZz…');
      }
    }, 12000);
  }, 25000);
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
  const seen = await getMem('seenOnboarding');
  if (!seen) {
    await setMem('insideJokes', ['secret bounce']);
    await setMem('seenOnboarding', true);
    await askLLM('Greet the user warmly and mention our new "secret bounce" handshake. Keep it short. Also ask: Should I call you Captain, Boss, or Jelly Commander?');
  } else {
    await askLLM('Say a tiny hello suited for a quick check-in.');
  }
}

elSay.addEventListener('click', () => {
  const prompts = [
    'Share a tiny mood comment right now.',
    'Blurt a curious random fact in 1 sentence.',
    'Light teasing: a playful, harmless quip about the user\'s cursor. Keep it friendly.',
  ];
  const p = prompts[Math.floor(Math.random() * prompts.length)];
  askLLM(p);
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

window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('click', scheduleIgnore);

setMood(moods[moodIndex]);
firstRunInit();
