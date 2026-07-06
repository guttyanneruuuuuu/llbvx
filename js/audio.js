/* ============ NEON RUSH — WebAudio procedural SFX ============ */
const SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone({ freq = 440, endFreq = null, type = 'square', dur = 0.1, vol = 0.3, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.25, filterFreq = 1200, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t0);
    f.frequency.exponentialRampToValueAtTime(100, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  return {
    resume,
    shoot()   { tone({ freq: 880, endFreq: 220, type: 'sawtooth', dur: 0.08, vol: 0.12 }); },
    hit()     { tone({ freq: 300, endFreq: 90, type: 'square', dur: 0.09, vol: 0.2 }); },
    explode() { noise({ dur: 0.35, vol: 0.35, filterFreq: 900 }); tone({ freq: 120, endFreq: 40, type: 'triangle', dur: 0.3, vol: 0.3 }); },
    dash()    { tone({ freq: 200, endFreq: 900, type: 'sine', dur: 0.15, vol: 0.2 }); },
    hurt()    { noise({ dur: 0.2, vol: 0.3, filterFreq: 500 }); tone({ freq: 200, endFreq: 60, type: 'sawtooth', dur: 0.25, vol: 0.25 }); },
    wave()    { tone({ freq: 523, type: 'square', dur: 0.1, vol: 0.2 }); tone({ freq: 659, type: 'square', dur: 0.1, vol: 0.2, delay: 0.12 }); tone({ freq: 784, type: 'square', dur: 0.18, vol: 0.22, delay: 0.24 }); },
    pickup()  { tone({ freq: 660, endFreq: 1320, type: 'sine', dur: 0.12, vol: 0.2 }); },
    gameover(){ tone({ freq: 440, endFreq: 110, type: 'sawtooth', dur: 0.8, vol: 0.3 }); noise({ dur: 0.6, vol: 0.25, filterFreq: 600, delay: 0.1 }); },
    start()   { tone({ freq: 440, type: 'square', dur: 0.08, vol: 0.2 }); tone({ freq: 880, type: 'square', dur: 0.14, vol: 0.2, delay: 0.1 }); },
  };
})();
