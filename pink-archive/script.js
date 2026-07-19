/**
 * ### 版画 21234 ### — Main Script
 * ==========================================
 * [Features]
 * - Web Audio API: ambient BGM (경계곡 느낌 — 드론 + 프린팅 프레스)
 * - Hover sound: dry stamp tap
 * - Modal open sound: deep ink press + reverb bloom
 * - Modal close: filter shifts back
 * - Stamp interaction: cards physically "press" like a printing plate
 * - Proximity reveal: artworks fade in near mouse
 * - Project group highlight with project-specific psychedelic effects
 * ==========================================
 */

// ==========================================
// Project Config (no emoji)
// ==========================================
const PROJECT_CONFIG = {
  kaomoji: {
    label: "顔文字 / シルクスクリーン",
    tagClass: "tag-kaomoji",
    decoSymbols: ["(*'w'*)", "###", "---", "(^_^)", "***", "~~~"],
    ambientSymbols: ["###", "***", "---", "~~~", "(^.^)"],
    psychoClass: "psycho-kaomoji",
  },
  kyuukurarin: {
    label: "きゅうくらりん / リノリウム版画",
    tagClass: "tag-kyuukurarin",
    decoSymbols: ["---", "~~~", "...", "***", "///", "---"],
    ambientSymbols: ["---", "...", "~~~", "///"],
    psychoClass: "psycho-kyuukurarin",
  },
  homulilly: {
    label: "ホムリリィ / 紙版画",
    tagClass: "tag-homulilly",
    decoSymbols: ["###", "///", "---", "***", "...", "///"],
    ambientSymbols: ["###", "---", "///", "***"],
    psychoClass: "psycho-homulilly",
  },
  animal_crossing: {
    label: "どうぶつの森 / ドライポイント",
    tagClass: "tag-animal_crossing",
    decoSymbols: ["~~~", "...", "---", "***", "~~~", "..."],
    ambientSymbols: ["~~~", "...", "---", "***"],
    psychoClass: "psycho-animal_crossing",
  },
  other: {
    label: "その他",
    tagClass: "",
    decoSymbols: ["---", "***", "///"],
    ambientSymbols: ["---"],
    psychoClass: "",
  }
};

// ==========================================
// Audio Engine
// ==========================================
class PrintingPressAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgGain = null;
    this.sfxGain = null;
    this.masterFilter = null; // LPF: changes when modal opens
    this.reverbNode = null;
    this.oscillators = [];
    this.isPlaying = false;
    this.isMuted = false;
    this.modalOpen = false;
  }

  async init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();

    // Master chain: masterFilter -> masterGain -> destination
    this.masterGain   = this.ctx.createGain();
    this.masterFilter = this.ctx.createBiquadFilter();
    this.bgGain       = this.ctx.createGain();
    this.sfxGain      = this.ctx.createGain();

    this.masterFilter.type = "lowpass";
    this.masterFilter.frequency.value = 18000; // wide open by default
    this.masterFilter.Q.value = 0.5;

    this.masterGain.gain.value = 0.0;
    this.bgGain.gain.value     = 0.7;
    this.sfxGain.gain.value    = 1.0;

    // Build reverb
    this.reverbNode = await this._buildReverb(2.2);

    // Routing
    this.bgGain.connect(this.masterFilter);
    this.sfxGain.connect(this.masterFilter);
    this.masterFilter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._startBGM();

    // Fade in
    this.masterGain.gain.setTargetAtTime(0.55, this.ctx.currentTime, 1.2);
    this.isPlaying = true;
  }

  // ----------------------------------------
  // BGM: 경계곡 — Drone + slow LFO + rhythmic pulse
  // ----------------------------------------
  _startBGM() {
    const t = this.ctx.currentTime;

    // --- Layer 1: Root drone (low fundamental) ---
    this._addDrone(41.2,  0.16, "sine",     t, 0);      // low E
    this._addDrone(41.2,  0.06, "sawtooth", t, 0.2);    // slight grit
    this._addDrone(82.4,  0.08, "sine",     t, 0);      // octave up
    this._addDrone(123.5, 0.04, "sine",     t, 0.5);    // 3rd harmonic

    // --- Layer 2: High shimmer (printing press harmonics) ---
    this._addDrone(329.6, 0.018, "sine", t, 0.1);
    this._addDrone(493.9, 0.012, "sine", t, 0.3);

    // --- Layer 3: Filtered noise (paper texture hiss) ---
    this._addNoiseLayer(0.04, t);

    // --- Layer 4: Rhythmic pulse (printing press beat) ---
    // Fires every ~3.2 seconds
    this._schedulePulse(t);
  }

  _addDrone(freq, gain, type, startTime, detune) {
    const osc  = this.ctx.createOscillator();
    const gn   = this.ctx.createGain();
    const lfo  = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune * 100;
    gn.gain.value = gain;

    // Slow tremolo LFO
    lfo.frequency.value = 0.05 + Math.random() * 0.08;
    lfoG.gain.value = freq * 0.003;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);

    // Reverb send
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0.4;

    osc.connect(gn);
    gn.connect(this.bgGain);

    osc.connect(reverbSend);
    reverbSend.connect(this.reverbNode);
    this.reverbNode.connect(this.bgGain);

    osc.start(startTime);
    lfo.start(startTime);

    this.oscillators.push(osc, lfo);
  }

  _addNoiseLayer(gainVal, startTime) {
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source  = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop   = true;

    const filter  = this.ctx.createBiquadFilter();
    filter.type   = "bandpass";
    filter.frequency.value = 200 + Math.random() * 300;
    filter.Q.value = 0.8;

    const gn = this.ctx.createGain();
    gn.gain.value = gainVal;

    source.connect(filter);
    filter.connect(gn);
    gn.connect(this.bgGain);

    source.start(startTime);
    this.oscillators.push(source);
  }

  _schedulePulse(startTime) {
    const interval = 3.1 + Math.random() * 1.4;
    const playAt   = startTime + interval;

    this._playPressTick(playAt, 0.06);

    // Recursive: schedule next pulse
    const delay = (interval + 0.1) * 1000;
    this._pulseTimer = setTimeout(() => {
      if (this.isPlaying && !this.isMuted) {
        this._schedulePulse(this.ctx.currentTime);
      }
    }, delay);
  }

  // ----------------------------------------
  // Stamp / Press Sounds
  // ----------------------------------------

  // Short tick (printing press piston)
  _playPressTick(time, gain = 0.08) {
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const src  = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type  = "bandpass";
    filter.frequency.value = 180;
    filter.Q.value = 3;

    const gn = this.ctx.createGain();
    gn.gain.value = gain;

    src.connect(filter);
    filter.connect(gn);
    gn.connect(this.sfxGain);
    src.start(time);
  }

  // Stamp tap on card hover (dry, tactile)
  playStampTap() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Body impact
    const bufLen = Math.floor(this.ctx.sampleRate * 0.08);
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const d      = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.1));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bpf = this.ctx.createBiquadFilter();
    bpf.type  = "bandpass";
    bpf.frequency.value = 400 + Math.random() * 200;
    bpf.Q.value = 2;

    const gn = this.ctx.createGain();
    gn.gain.value = 0.18;
    gn.gain.setTargetAtTime(0, t + 0.01, 0.04);

    src.connect(bpf);
    bpf.connect(gn);
    gn.connect(this.sfxGain);
    src.start(t);
  }

  // Deep ink press on modal open (thud + reverb bloom)
  playModalOpen() {
    if (!this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // --- Impact thud ---
    const bufLen = Math.floor(this.ctx.sampleRate * 0.18);
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const d      = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.12));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const lpf = this.ctx.createBiquadFilter();
    lpf.type  = "lowpass";
    lpf.frequency.value = 280;
    lpf.Q.value = 1.5;

    const gn = this.ctx.createGain();
    gn.gain.value = 0.55;
    gn.gain.setTargetAtTime(0, t + 0.05, 0.15);

    const rvbSend = this.ctx.createGain();
    rvbSend.gain.value = 0.7;

    src.connect(lpf);
    lpf.connect(gn);
    gn.connect(this.sfxGain);

    src.connect(rvbSend);
    rvbSend.connect(this.reverbNode);

    src.start(t);

    // --- Overtone ping (metallic ring of the printing plate) ---
    const pingOsc = this.ctx.createOscillator();
    const pingGn  = this.ctx.createGain();
    pingOsc.type  = "sine";
    pingOsc.frequency.value = 880;
    pingGn.gain.value = 0.0;
    pingGn.gain.setValueAtTime(0.12, t + 0.02);
    pingGn.gain.setTargetAtTime(0, t + 0.05, 0.4);

    const pingSend = this.ctx.createGain();
    pingSend.gain.value = 1.2;

    pingOsc.connect(pingGn);
    pingGn.connect(this.sfxGain);
    pingGn.connect(pingSend);
    pingSend.connect(this.reverbNode);

    pingOsc.start(t + 0.02);
    pingOsc.stop(t + 2.5);

    // --- Filter shift: BGM becomes more muffled (heard through paper) ---
    this.masterFilter.frequency.setTargetAtTime(800, t, 0.3);
    this.modalOpen = true;
  }

  // Restore filter on modal close
  playModalClose() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Quick dry click
    this._playPressTick(t, 0.05);

    // Restore filter
    this.masterFilter.frequency.setTargetAtTime(18000, t, 0.5);
    this.modalOpen = false;
  }

  // ----------------------------------------
  // Reverb builder (impulse response synthesis)
  // ----------------------------------------
  async _buildReverb(duration) {
    const sampleRate = this.ctx.sampleRate;
    const length     = Math.floor(sampleRate * duration);
    const impulse    = this.ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const c = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
      }
    }

    const convolver  = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  // ----------------------------------------
  // Mute / Unmute / Resume
  // ----------------------------------------
  async resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  toggleMute() {
    if (!this.ctx) return;
    this.isMuted = !this.isMuted;
    const t = this.ctx.currentTime;
    if (this.isMuted) {
      this.masterGain.gain.setTargetAtTime(0, t, 0.3);
    } else {
      this.masterGain.gain.setTargetAtTime(0.55, t, 0.5);
    }
    return this.isMuted;
  }

  destroy() {
    this.isPlaying = false;
    clearTimeout(this._pulseTimer);
    this.oscillators.forEach(o => { try { o.stop(); } catch(_) {} });
    if (this.ctx) this.ctx.close();
  }
}

// ==========================================
// Global audio instance
// ==========================================
const audio = new PrintingPressAudio();
let audioStarted = false;

async function startAudioOnInteraction() {
  if (audioStarted) {
    await audio.resume();
    return;
  }
  audioStarted = true;
  await audio.init();
}

// ==========================================
// Init
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  if (typeof worksData === "undefined" || !Array.isArray(worksData)) {
    console.error("worksData が見つかりません。works.js を確認してください。");
    return;
  }

  initAmbientBackground();
  initFloatingArtworks();
  initProximityReveal();
  initModalEvents();
  initAudioButton();

  // Start audio on first interaction
  document.addEventListener("click",     () => startAudioOnInteraction(), { once: true });
  document.addEventListener("mousemove", () => startAudioOnInteraction(), { once: true });
});

// ==========================================
// Ambient Background Particles (no emoji)
// ==========================================
function initAmbientBackground() {
  const bgLayer  = document.getElementById("bgLayer");
  const symbols  = ["###", "---", "***", "///", "~~~", "...", "&&&"];
  const floatAnims = ["float-A", "float-B", "float-C", "float-D"];

  for (let i = 0; i < 10; i++) {
    const el  = document.createElement("span");
    el.className = "ambient-particle";
    el.textContent = symbols[i % symbols.length];

    el.style.left = `${5 + Math.random() * 88}%`;
    el.style.top  = `${5 + Math.random() * 88}%`;

    const anim  = floatAnims[Math.floor(Math.random() * floatAnims.length)];
    const dur   = 22 + Math.random() * 20;
    const delay = -(Math.random() * dur);

    el.style.animationName      = anim;
    el.style.animationDuration  = `${dur}s`;
    el.style.animationDelay     = `${delay}s`;
    el.style.fontSize           = `${0.55 + Math.random() * 0.45}rem`;
    el.style.letterSpacing      = "0.1em";

    bgLayer.appendChild(el);
  }
}

// ==========================================
// Floating Artworks
// ==========================================
function initFloatingArtworks() {
  const canvas     = document.getElementById("archiveCanvas");
  const total      = worksData.length;
  if (total === 0) return;

  const cols = 5;
  const rows = Math.ceil(total / cols) + 1;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({ col: c, row: r });
  shuffleArray(cells);

  const floatAnims = ["float-A", "float-B", "float-C", "float-D"];

  worksData.forEach((work, i) => {
    const cell = cells[i % cells.length];
    const card = document.createElement("article");
    card.className  = `artwork-card project-${work.project}`;
    card.id         = `work-${work.id}`;
    card.dataset.project = work.project;

    card.innerHTML = `
      <div class="card-media">
        <img class="card-image" src="${work.image}" alt="${work.title}" loading="lazy">
      </div>
      <div class="card-info">
        <p class="card-title">${work.title}</p>
      </div>
    `;

    // Organic: randomize card width so artworks feel scattered, not grid-aligned
    const cardWidth = 120 + Math.floor(Math.random() * 80); // 120–200px
    card.style.width = `${cardWidth}px`;

    // Spread across canvas
    const baseLeft = (cell.col / cols) * 76 + 12;
    const baseTop  = (cell.row / rows) * 62 + 18;
    const jX = (Math.random() - 0.5) * 6;
    const jY = (Math.random() - 0.5) * 6;
    card.style.left = `${baseLeft + jX}%`;
    card.style.top  = `${baseTop  + jY}%`;

    // Float animation
    const anim  = floatAnims[Math.floor(Math.random() * floatAnims.length)];
    const dur   = 16 + Math.random() * 14;
    const delay = -(Math.random() * dur);
    const rot   = (Math.random() - 0.5) * 14; // slightly wider rotation range

    card.style.animation = `${anim} ${dur}s ease-in-out ${delay}s infinite alternate`;
    card.style.transform = `rotate(${rot}deg)`;

    // Hover: reveal project group
    card.addEventListener("mouseenter", () => {
      activateProject(work.project);
      audio.playStampTap();
    });
    card.addEventListener("mouseleave", () => {
      deactivateProject();
      // restore original rotation (float animation handles the rest)
      card.style.transform = `rotate(${rot}deg)`;
    });

    // Click: stamp press visual + modal
    card.addEventListener("click", () => {
      triggerStampPress(card, () => openModal(work));
    });

    canvas.appendChild(card);
  });
}

// ==========================================
// Stamp Press Interaction
// 판화 찍어내는 물리적 느낌
// ==========================================
function triggerStampPress(card, callback) {
  // Visual: brief press animation on card
  card.classList.add("stamp-triggered");

  // Screen ink flash
  const flash = document.getElementById("stampFlash");
  flash.classList.remove("flash");
  // Force reflow
  void flash.offsetWidth;
  flash.classList.add("flash");

  // Audio: deep press
  audio.playModalOpen();

  // After stamp animation, open modal
  setTimeout(() => {
    card.classList.remove("stamp-triggered");
    callback();
  }, 200);
}

// ==========================================
// Proximity Reveal — opacity only, painterly fade
// filter/blend handled entirely by CSS
// ==========================================
function initProximityReveal() {
  const RADIUS       = 260;
  const BASE_OPACITY = 0.055;

  function handleMove(cx, cy) {
    const hasActive = document.querySelector(".active-project") !== null;

    document.querySelectorAll(".artwork-card").forEach(card => {
      if (hasActive) {
        // CSS class handles everything; clear inline overrides
        card.style.opacity = "";
        return;
      }

      const rect = card.getBoundingClientRect();
      const dx   = cx - (rect.left + rect.width  / 2);
      const dy   = cy - (rect.top  + rect.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < RADIUS) {
        const prox    = 1 - dist / RADIUS;
        // Quadratic ease so it feels like ink seeping in
        const opacity = BASE_OPACITY + Math.pow(prox, 1.6) * (0.88 - BASE_OPACITY);
        card.style.opacity      = opacity.toFixed(3);
        card.style.pointerEvents = opacity > 0.20 ? "auto" : "none";
      } else {
        card.style.opacity      = BASE_OPACITY.toString();
        card.style.pointerEvents = "none";
      }
    });
  }

  document.addEventListener("mousemove", e => handleMove(e.clientX, e.clientY));
  document.addEventListener("touchmove", e => {
    if (e.touches?.[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
}

// ==========================================
// Project Highlight
// ==========================================
function activateProject(project) {
  const cfg = PROJECT_CONFIG[project] || PROJECT_CONFIG.other;

  document.querySelectorAll(".artwork-card").forEach(card => {
    // Clear any inline opacity override so CSS classes take over
    card.style.opacity = "";
    card.style.filter  = "";

    if (card.dataset.project === project) {
      card.classList.add("active-project");
      card.classList.remove("inactive-project");
      // NO transform override — let float animation own the position
    } else {
      card.classList.add("inactive-project");
      card.classList.remove("active-project");
    }
  });

  // Psychedelic body class
  document.body.classList.remove(
    ...Object.values(PROJECT_CONFIG).map(c => c.psychoClass).filter(Boolean)
  );
  if (cfg.psychoClass) document.body.classList.add(cfg.psychoClass);

  // Title
  const title = document.getElementById("siteTitle");
  title.classList.remove(
    ...Object.values(PROJECT_CONFIG).map(c => c.psychoClass).filter(Boolean)
  );
  if (cfg.psychoClass) title.classList.add(cfg.psychoClass);

  // Reg marks activate
  document.getElementById("regMarks").classList.add("active");

  // Burst symbols
  burstSymbols(project, cfg.decoSymbols);
}

function deactivateProject() {
  document.querySelectorAll(".artwork-card").forEach(card => {
    card.classList.remove("active-project", "inactive-project");
    card.style.transform = ""; // let float animation resume naturally
    card.style.opacity   = "";
    card.style.filter    = "";
  });

  document.body.classList.remove(
    ...Object.values(PROJECT_CONFIG).map(c => c.psychoClass).filter(Boolean)
  );

  const title = document.getElementById("siteTitle");
  title.classList.remove(
    ...Object.values(PROJECT_CONFIG).map(c => c.psychoClass).filter(Boolean)
  );

  document.getElementById("regMarks").classList.remove("active");
  document.querySelectorAll(".burst-symbol").forEach(el => el.remove());
}

// ==========================================
// Symbol Burst (text-only, no emoji)
// ==========================================
function burstSymbols(project, symbols) {
  document.querySelectorAll(".burst-symbol").forEach(el => el.remove());

  const color = getBurstColor(project);

  for (let i = 0; i < 9; i++) {
    const el = document.createElement("span");
    el.className = "burst-symbol";
    el.textContent = symbols[i % symbols.length];

    const x = 8 + Math.random() * 82;
    const y = 8 + Math.random() * 82;

    el.style.cssText = `
      position: fixed;
      left: ${x}vw;
      top: ${y}vh;
      font-family: 'Share Tech Mono', 'DotGothic16', monospace;
      font-size: ${0.6 + Math.random() * 0.65}rem;
      letter-spacing: 0.08em;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      color: ${color};
      animation: burst-in 0.45s ${i * 0.055}s forwards,
                 burst-float 2.8s ${i * 0.055 + 0.45}s ease-in-out infinite alternate;
    `;

    document.body.appendChild(el);
  }

  if (!document.getElementById("burst-style")) {
    const style = document.createElement("style");
    style.id = "burst-style";
    style.textContent = `
      @keyframes burst-in {
        from { opacity:0; transform: scale(0.6) translateY(6px); }
        to   { opacity:1; transform: scale(1)   translateY(0); }
      }
      @keyframes burst-float {
        from { transform: translateY(0)    rotate(0deg);  opacity:0.85; }
        to   { transform: translateY(-10px) rotate(6deg); opacity:0.4; }
      }
    `;
    document.head.appendChild(style);
  }
}

function getBurstColor(project) {
  return { kaomoji:"#ff85a1", kyuukurarin:"#9575cd", homulilly:"#7c6b8a", animal_crossing:"#5ea070" }[project] || "#f0b8c0";
}

// ==========================================
// Modal
// ==========================================
function initModalEvents() {
  const dialog   = document.getElementById("artworkDialog");
  const btnClose = document.getElementById("btnCloseDialog");
  const img      = document.getElementById("modalImg");

  btnClose.addEventListener("click", closeModal);

  dialog.addEventListener("click", e => {
    const rect    = dialog.getBoundingClientRect();
    const outside = e.clientX < rect.left || e.clientX > rect.right ||
                    e.clientY < rect.top  || e.clientY > rect.bottom;
    if (outside) closeModal();
  });

  dialog.addEventListener("cancel", closeModal);

  img.addEventListener("click", () => {
    if (img.src) window.open(img.src, "_blank");
  });
}

function openModal(work) {
  const dialog    = document.getElementById("artworkDialog");
  const img       = document.getElementById("modalImg");
  const title     = document.getElementById("modalTitle");
  const technique = document.getElementById("modalTechnique");
  const desc      = document.getElementById("modalDescription");
  const tag       = document.getElementById("modalProjectTag");
  const deco      = document.getElementById("modalDeco");

  const cfg = PROJECT_CONFIG[work.project] || PROJECT_CONFIG.other;

  img.src  = work.image;
  img.alt  = work.title;
  title.textContent     = work.title;
  technique.textContent = work.technique;
  desc.textContent      = work.description;

  tag.textContent = cfg.label;
  tag.className   = `info-project-tag ${cfg.tagClass}`;

  // Deco: text-only symbols
  deco.innerHTML = cfg.decoSymbols.slice(0, 4)
    .map(s => `<span>${s}</span>`).join("  ");

  // Reset stamp-in animation
  img.style.animation = "none";
  void img.offsetWidth;
  img.style.animation = "";

  dialog.showModal();
}

function closeModal() {
  const dialog = document.getElementById("artworkDialog");
  audio.playModalClose();
  dialog.close();
}

// ==========================================
// Audio Button
// ==========================================
function initAudioButton() {
  const btn  = document.getElementById("btnAudio");
  const icon = document.getElementById("audioIcon");

  btn.addEventListener("click", async () => {
    await startAudioOnInteraction();
    const muted = audio.toggleMute();
    btn.classList.toggle("muted", muted);
    icon.textContent = muted ? "&#9834;" : "&#9834;"; // same symbol, opacity via .muted
    btn.title = muted ? "ミュート中" : "音楽オン/オフ";
  });
}

// ==========================================
// Utility
// ==========================================
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
