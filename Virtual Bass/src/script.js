const ctx = new (window.AudioContext || window.webkitAudioContext)();
const board = document.getElementById('board');
const notes = 'C,C#,D,D#,E,F,F#,G,G#,A,A#,B'.split(',');

const keyMap = {
  G: '1234567890',
  D: 'qwertyuiop',
  A: 'asdfghjkl;',
  E: 'zxcvbnm,./'
};

const scaleMap = {
  maj: '0,2,4,5,7,9,11',
  min: '0,2,3,5,7,8,10',
  minP: '0,3,5,7,10',
  majP: '0,2,4,7,9',
  blu: '0,3,5,6,7,10'
};

const lickMap = {
  funk: 'E:0:0,D:2:220,E:0:440,E:3:660,A:0:880,A:2:1100,D:2:1320,A:2:1540,E:0:1760',
  blues: 'A:0:0,A:4:280,D:2:560,D:4:840,D:5:1120,D:4:1400,D:2:1680,A:4:1960,A:0:2240',
  rock: 'E:3:0,E:3:200,E:3:400,E:3:600,A:3:800,A:3:1000,A:5:1200,A:5:1400,E:3:1600',
  reggae: 'A:3:0,G:5:400,D:5:600,A:3:1000,A:1:1400,E:3:1600,A:3:2000'
};

const cells = new Map();
const keys = new Map();

let slide = null;
let timers = new Array();
let drumId = null;
let step = 0;
let isRec = false;
let recStart = 0;
let recData = new Array();
let recLen = 0;
let loopId = null;

const selRoot = document.getElementById('selRoot');
notes.forEach(n => {
  const opt = document.createElement('option');
  opt.value = n;
  opt.textContent = n;
  selRoot.appendChild(opt);
});

function playNote(freq) {
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  const now = ctx.currentTime;
  const mode = document.getElementById('selSound').value;
  const tone = +document.getElementById('rngTone').value;
  const sus = +document.getElementById('rngSus').value;

  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const flt = ctx.createBiquadFilter();
  const g = ctx.createGain();

  o1.frequency.value = freq;
  o2.frequency.value = mode === 'synth' ? freq / 2 : freq;
  flt.type = 'lowpass';

  if (mode === 'finger') {
    o1.type = 'triangle';
    o2.type = 'sine';
    flt.frequency.value = tone;
  } else if (mode === 'pick') {
    o1.type = 'sawtooth';
    o2.type = 'triangle';
    flt.frequency.setValueAtTime(tone * 2, now);
    flt.frequency.exponentialRampToValueAtTime(tone * 0.7, now + 0.3);
  } else if (mode === 'slap') {
    o1.type = 'sawtooth';
    o2.type = 'square';
    flt.Q.value = 5;
    flt.frequency.setValueAtTime(tone * 3, now);
    flt.frequency.exponentialRampToValueAtTime(tone * 0.5, now + 0.15);
  } else {
    o1.type = 'sawtooth';
    o2.type = 'square';
    flt.Q.value = 4;
    flt.frequency.setValueAtTime(tone * 1.8, now);
    flt.frequency.exponentialRampToValueAtTime(tone * 0.4, now + 0.4);
  }

  g.gain.setValueAtTime(0.9, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + sus);

  o1.connect(flt);
  o2.connect(flt);
  flt.connect(g);
  g.connect(ctx.destination);

  o1.start(now);
  o2.start(now);
  o1.stop(now + sus);
  o2.stop(now + sus);

  return { o1, o2, mode };
}

function trigger(cell, rec = true) {
  if (!cell) {
    return null;
  }
  const v = playNote(+cell.dataset.freq);
  cell.classList.add('hit');
  setTimeout(() => {
    cell.classList.remove('hit');
  }, 220);

  if (isRec && rec) {
    recData.push({
      id: cell.dataset.id,
      t: performance.now() - recStart
    });
  }
  return v;
}

function build() {
  board.innerHTML = '';
  cells.clear();
  keys.clear();

  const strs = new Array(
    { n: 'G', f: 98.00, i: 7 },
    { n: 'D', f: 73.42, i: 2 },
    { n: 'A', f: 55.00, i: 9 },
    { n: 'E', f: 41.20, i: 4 }
  );

  if (document.getElementById('chk5Str').checked) {
    strs.push({ n: 'B', f: 30.87, i: 11 });
  }

  const hdr = document.createElement('div');
  hdr.className = 'header';
  for (let f = 0; f <= 12; f++) {
    const d = document.createElement('div');
    d.className = f === 0 ? 'cell open' : 'cell';
    d.textContent = f === 0 ? 'OPEN' : f;
    hdr.appendChild(d);
  }
  board.appendChild(hdr);

  strs.forEach((s, si) => {
    const row = document.createElement('div');
    row.className = 'row s-' + s.n;
    const km = keyMap[s.n] || '';

    for (let f = 0; f <= 12; f++) {
      const c = document.createElement('div');
      c.className = f === 0 ? 'cell open' : 'cell';
      const note = notes.at((s.i + f) % 12);
      const id = s.n + ':' + f;

      c.dataset.id = id;
      c.dataset.str = s.n;
      c.dataset.fret = f;
      c.dataset.freq = s.f * Math.pow(2, f / 12);
      c.dataset.note = note;
      cells.set(id, c);

      c.innerHTML = `<div class="wire"></div><span class="note">${note}</span>`;

      if (f < km.length) {
        const k = km.charAt(f);
        keys.set(k, c);
        c.innerHTML += `<span class="key">${k.toUpperCase()}</span>`;
      }

      if (si === 1 && (f === 3 || f === 5 || f === 7 || f === 9)) {
        c.innerHTML += `<div class="dot" style="bottom:-6px"></div>`;
      }
      if (si === 1 && f === 12) {
        c.innerHTML += `<div class="dot" style="top:-6px"></div><div class="dot" style="bottom:-6px"></div>`;
      }

      c.addEventListener('pointerdown', e => {
        e.preventDefault();
        slide = {
          str: s.n,
          fret: f,
          v: trigger(c, true)
        };
      });

      row.appendChild(c);
    }
    board.appendChild(row);
  });

  updateScale();
}

window.addEventListener('pointermove', e => {
  if (!slide) {
    return;
  }
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const c = el ? el.closest('.cell') : null;
  if (c && c.dataset.str === slide.str && +c.dataset.fret !== slide.fret) {
    slide.fret = +c.dataset.fret;
    const nf = +c.dataset.freq;
    const now = ctx.currentTime;
    slide.v.o1.frequency.linearRampToValueAtTime(nf, now + 0.05);
    slide.v.o2.frequency.linearRampToValueAtTime(slide.v.mode === 'synth' ? nf / 2 : nf, now + 0.05);
    c.classList.add('hit');
    setTimeout(() => {
      c.classList.remove('hit');
    }, 220);
  }
});

window.addEventListener('pointerup', () => {
  slide = null;
});

window.addEventListener('keydown', e => {
  if (e.repeat || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
    return;
  }
  const c = keys.get(e.key.toLowerCase());
  if (c) {
    e.preventDefault();
    trigger(c, true);
  }
});

function updateScale() {
  const r = selRoot.value;
  const sc = document.getElementById('selScale').value;
  cells.forEach(c => {
    c.classList.remove('scale', 'root');
  });
  if (r === 'none') {
    return;
  }
  const ri = notes.indexOf(r);
  const valid = new Set(scaleMap[sc].split(',').map(x => notes.at((ri + +x) % 12)));
  cells.forEach(c => {
    if (c.dataset.note === r) {
      c.classList.add('root');
    } else if (valid.has(c.dataset.note)) {
      c.classList.add('scale');
    }
  });
}

document.getElementById('chkNotes').onchange = e => {
  board.classList.toggle('show-notes', e.target.checked);
};

document.getElementById('chkKeys').onchange = e => {
  board.classList.toggle('show-keys', e.target.checked);
};

document.getElementById('chk5Str').onchange = build;
selRoot.onchange = updateScale;
document.getElementById('selScale').onchange = updateScale;

const btnLick = document.getElementById('btnLick');

function stopLick() {
  timers.forEach(clearTimeout);
  timers = new Array();
  btnLick.textContent = 'Play';
  btnLick.classList.remove('active');
}

btnLick.onclick = () => {
  if (btnLick.classList.contains('active')) {
    return stopLick();
  }
  btnLick.textContent = 'Stop';
  btnLick.classList.add('active');
  let max = 0;

  lickMap[document.getElementById('selLick').value].split(',').forEach(s => {
    const p = s.split(':');
    const d = +p.at(2);
    if (d > max) {
      max = d;
    }
    timers.push(setTimeout(() => {
      trigger(cells.get(p.at(0) + ':' + p.at(1)), false);
    }, d));
  });

  timers.push(setTimeout(stopLick, max + 400));
};

function drumHit(type) {
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  const now = ctx.currentTime;
  if (type === 'kick' || type === 'click') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(type === 'kick' ? 140 : 1000, now);
    if (type === 'kick') {
      o.frequency.exponentialRampToValueAtTime(38, now + 0.14);
    }
    g.gain.setValueAtTime(type === 'kick' ? 0.9 : 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.2);
  } else {
    const len = Math.floor(ctx.sampleRate * (type === 'snare' ? 0.14 : 0.05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    buf.copyToChannel(Float32Array.from({ length: len }, () => Math.random() * 2 - 1), 0);
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    f.type = 'highpass';
    f.frequency.value = type === 'snare' ? 900 : 6500;
    g.gain.setValueAtTime(type === 'snare' ? 0.5 : 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (type === 'snare' ? 0.14 : 0.05));
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start(now);
  }
}

const btnDrum = document.getElementById('btnDrum');
const rngBpm = document.getElementById('rngBpm');

rngBpm.oninput = () => {
  document.getElementById('txtBpm').textContent = rngBpm.value;
  if (drumId) {
    stopDrum();
    startDrum();
  }
};

function stopDrum() {
  clearInterval(drumId);
  drumId = null;
  btnDrum.textContent = 'Beat';
  btnDrum.classList.remove('active');
}

function startDrum() {
  step = 0;
  btnDrum.textContent = 'Stop';
  btnDrum.classList.add('active');

  const tick = () => {
    const st = document.getElementById('selDrum').value;
    if (st === 'rock') {
      drumHit('hat');
      if (step === 0 || step === 4 || step === 5) drumHit('kick');
      if (step === 2 || step === 6) drumHit('snare');
    } else if (st === 'funk') {
      drumHit('hat');
      if (step === 0 || step === 3 || step === 5) drumHit('kick');
      if (step === 2 || step === 6) drumHit('snare');
    } else if (st === 'reggae') {
      if (step % 2 === 0) drumHit('hat');
      if (step === 4) {
        drumHit('kick');
        drumHit('snare');
      }
    } else if (step % 2 === 0) {
      drumHit('click');
    }
    step = (step + 1) % 8;
  };

  tick();
  drumId = setInterval(tick, (60 / +rngBpm.value / 2) * 1000);
}

btnDrum.onclick = () => {
  if (drumId) {
    stopDrum();
  } else {
    startDrum();
  }
};

const btnRec = document.getElementById('btnRec');
const btnLoop = document.getElementById('btnLoop');

function stopLoop() {
  clearInterval(loopId);
  loopId = null;
  btnLoop.textContent = 'Loop';
  btnLoop.classList.remove('active');
}

btnRec.onclick = () => {
  if (!isRec) {
    stopLoop();
    recData = new Array();
    isRec = true;
    recStart = performance.now();
    btnRec.textContent = 'Stop';
    btnRec.classList.add('active');
    btnLoop.disabled = true;
  } else {
    isRec = false;
    recLen = Math.max(performance.now() - recStart, 400);
    btnRec.textContent = 'Rec';
    btnRec.classList.remove('active');
    btnLoop.disabled = recData.length === 0;
  }
};

btnLoop.onclick = () => {
  if (loopId) {
    return stopLoop();
  }
  btnLoop.textContent = 'Stop';
  btnLoop.classList.add('active');

  const run = () => {
    recData.forEach(ev => {
      setTimeout(() => {
        trigger(cells.get(ev.id), false);
      }, ev.t);
    });
  };

  run();
  loopId = setInterval(run, recLen);
};

build();
