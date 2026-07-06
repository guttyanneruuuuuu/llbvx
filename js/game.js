/* ============ NEON RUSH — main game ============ */
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const $ = id => document.getElementById(id);
  const hud = $('hud'), titleScreen = $('title-screen'), goScreen = $('gameover-screen');
  const hpFill = $('hp-fill'), waveLabel = $('wave-label'), scoreEl = $('score'), comboEl = $('combo');

  /* ---------- Game state ---------- */
  const game = {
    w: 0, h: 0,
    state: 'title', // title | playing | gameover
    player: null,
    enemies: [],
    bullets: [],
    pickups: [],
    particles: new ParticleSystem(),
    floats: [],
    score: 0,
    best: parseInt(localStorage.getItem('neonrush_best') || '0', 10),
    wave: 0,
    waveTimer: 0,
    spawnQueue: 0,
    spawnTimer: 0,
    combo: 0,
    comboTimer: 0,
    shakeAmt: 0, shakeDur: 0,
    flash: 0,
    time: 0,
    stars: [],
    shake(amt, dur) {
      this.shakeAmt = Math.max(this.shakeAmt, amt);
      this.shakeDur = Math.max(this.shakeDur, dur);
    },
    nearestEnemy(x, y) {
      let best = null, bd = 520; // aim range
      for (const e of this.enemies) {
        if (e.spawnT > 0) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },
  };

  /* ---------- Resize ---------- */
  function resize() {
    game.w = window.innerWidth;
    game.h = window.innerHeight;
    canvas.width = game.w * DPR;
    canvas.height = game.h * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initStars();
  }
  window.addEventListener('resize', resize);

  function initStars() {
    game.stars = [];
    const n = Math.floor((game.w * game.h) / 9000);
    for (let i = 0; i < n; i++) {
      game.stars.push({
        x: Math.random() * game.w,
        y: Math.random() * game.h,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2,
        spd: 0.5 + Math.random() * 1.5,
      });
    }
  }

  /* ---------- Input (virtual joystick + dash) ---------- */
  const input = { moveX: 0, moveY: 0 };
  let joyId = null, joyOX = 0, joyOY = 0, joyX = 0, joyY = 0;
  const JOY_R = 60;

  function onTouchStart(e) {
    if (game.state !== 'playing') return;
    for (const t of e.changedTouches) {
      if (t.clientX < game.w * 0.5 && joyId === null) {
        joyId = t.identifier;
        joyOX = t.clientX; joyOY = t.clientY;
        joyX = joyOX; joyY = joyOY;
      } else {
        // right side: dash toward current move dir (or facing)
        game.player.dash(input.moveX, input.moveY, game);
      }
    }
    e.preventDefault();
  }
  function onTouchMove(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyX = t.clientX; joyY = t.clientY;
        let dx = joyX - joyOX, dy = joyY - joyOY;
        const d = Math.hypot(dx, dy);
        if (d > JOY_R) {
          // drag origin along (floating joystick)
          joyOX = joyX - (dx / d) * JOY_R;
          joyOY = joyY - (dy / d) * JOY_R;
          dx = joyX - joyOX; dy = joyY - joyOY;
        }
        input.moveX = dx / JOY_R;
        input.moveY = dy / JOY_R;
      }
    }
    e.preventDefault();
  }
  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        input.moveX = 0; input.moveY = 0;
      }
    }
  }
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);

  // keyboard fallback (PC)
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space' && game.state === 'playing') {
      game.player.dash(input.moveX, input.moveY, game);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  function pollKeys() {
    if (joyId !== null) return;
    let x = 0, y = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) x -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) x += 1;
    if (keys['ArrowUp'] || keys['KeyW']) y -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) y += 1;
    input.moveX = x; input.moveY = y;
  }

  /* ---------- Waves ---------- */
  function startWave(n) {
    game.wave = n;
    game.spawnQueue = 4 + n * 2;
    game.spawnTimer = 0.5;
    waveLabel.textContent = `WAVE ${n}`;
    waveLabel.style.animation = 'none';
    void waveLabel.offsetWidth;
    waveLabel.style.animation = 'comboPop .4s ease';
    if (n > 1) SFX.wave();
  }

  function pickEnemyType() {
    const w = game.wave;
    const pool = [['chaser', 10]];
    if (w >= 2) pool.push(['speeder', 4 + w]);
    if (w >= 3) pool.push(['shooter', 3 + w * 0.8]);
    if (w >= 4) pool.push(['tank', 2 + w * 0.5]);
    let total = 0; for (const p of pool) total += p[1];
    let r = Math.random() * total;
    for (const p of pool) { r -= p[1]; if (r <= 0) return p[0]; }
    return 'chaser';
  }

  function spawnEnemy() {
    // spawn at edge, away from player
    let x, y, tries = 0;
    do {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = Math.random() * game.w; y = -20; }
      else if (side === 1) { x = Math.random() * game.w; y = game.h + 20; }
      else if (side === 2) { x = -20; y = Math.random() * game.h; }
      else { x = game.w + 20; y = Math.random() * game.h; }
      tries++;
    } while (Math.hypot(x - game.player.x, y - game.player.y) < 160 && tries < 8);
    const scale = 1 + (game.wave - 1) * 0.12;
    game.enemies.push(new Enemy(pickEnemyType(), x, y, scale));
  }

  /* ---------- Combo / score ---------- */
  function addKill(e) {
    game.combo++;
    game.comboTimer = 2.2;
    const mult = 1 + Math.min(game.combo - 1, 9) * 0.25;
    const pts = Math.floor(e.score * mult);
    game.score += pts;
    scoreEl.textContent = game.score.toLocaleString();
    game.floats.push(new FloatText(e.x, e.y - 14, `+${pts}`, e.color));
    if (game.combo >= 3) {
      comboEl.textContent = `${game.combo} COMBO!`;
      comboEl.classList.remove('hidden');
      comboEl.style.animation = 'none';
      void comboEl.offsetWidth;
      comboEl.style.animation = 'comboPop .3s ease';
    }
    // pickup drop chance
    if (Math.random() < 0.14 && game.player.hp < game.player.maxHp * 0.85) {
      game.pickups.push(new Pickup(e.x, e.y));
    }
  }

  /* ---------- Update ---------- */
  function update(dt) {
    game.time += dt;
    pollKeys();

    const p = game.player;
    p.update(dt, input, game);

    // spawn logic
    if (game.spawnQueue > 0) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnEnemy();
        game.spawnQueue--;
        game.spawnTimer = Math.max(0.25, 1.1 - game.wave * 0.06);
      }
    } else if (game.enemies.length === 0) {
      startWave(game.wave + 1);
    }

    // enemies
    for (const e of game.enemies) e.update(dt, game);

    // bullets
    for (const b of game.bullets) {
      b.update(dt, game);
      if (b.dead) continue;
      if (b.friendly) {
        for (const e of game.enemies) {
          if (e.spawnT > 0 || e.dead) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r + 2) {
            b.dead = true;
            game.particles.burst(b.x, b.y, e.color, 5, 140, 2.5, { shape: 'spark' });
            if (e.takeDamage(12, game)) {
              game.particles.explosion(e.x, e.y, e.color);
              SFX.explode();
              game.shake(5, 0.15);
              addKill(e);
            }
            break;
          }
        }
      } else {
        if (!p.dashing && Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r) {
          b.dead = true;
          p.takeDamage(14, game);
        }
      }
    }
    game.bullets = game.bullets.filter(b => !b.dead);
    game.enemies = game.enemies.filter(e => !e.dead);

    // enemy contact damage
    for (const e of game.enemies) {
      if (e.spawnT > 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < e.r + p.r - 2) {
        if (p.dashing) {
          // dash-kill!
          if (e.takeDamage(999, game)) {
            game.particles.explosion(e.x, e.y, e.color);
            SFX.explode();
            game.shake(6, 0.18);
            addKill(e);
          }
        } else {
          p.takeDamage(e.type === 'tank' ? 26 : 16, game);
          // knockback enemy
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          e.x += Math.cos(a) * 40; e.y += Math.sin(a) * 40;
        }
      }
    }
    game.enemies = game.enemies.filter(e => !e.dead);

    // pickups
    for (const pk of game.pickups) {
      pk.update(dt, game);
      if (!pk.dead && Math.hypot(pk.x - p.x, pk.y - p.y) < pk.r + p.r) {
        pk.dead = true;
        p.hp = Math.min(p.maxHp, p.hp + 25);
        SFX.pickup();
        game.particles.burst(pk.x, pk.y, '#4dff88', 12, 180, 3);
        game.floats.push(new FloatText(pk.x, pk.y - 14, '+25 HP', '#4dff88'));
      }
    }
    game.pickups = game.pickups.filter(pk => !pk.dead);

    // combo decay
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) {
        game.combo = 0;
        comboEl.classList.add('hidden');
      }
    }

    game.particles.update(dt);
    game.floats = game.floats.filter(f => f.update(dt));

    // HUD hp
    const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
    hpFill.style.width = hpPct + '%';
    hpFill.classList.toggle('low', hpPct < 35);

    // effects decay
    if (game.shakeDur > 0) { game.shakeDur -= dt; if (game.shakeDur <= 0) game.shakeAmt = 0; }
    if (game.flash > 0) game.flash -= dt * 2;

    if (p.hp <= 0) gameOver();
  }

  /* ---------- Draw ---------- */
  function drawBackground() {
    // deep gradient
    const grad = ctx.createRadialGradient(game.w / 2, game.h * 0.4, 0, game.w / 2, game.h * 0.4, Math.max(game.w, game.h));
    grad.addColorStop(0, '#0c1030');
    grad.addColorStop(0.6, '#070818');
    grad.addColorStop(1, '#04050c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, game.w, game.h);

    // stars
    for (const s of game.stars) {
      const a = 0.3 + 0.5 * Math.abs(Math.sin(game.time * s.spd + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // perspective grid
    ctx.strokeStyle = 'rgba(41,240,255,.08)';
    ctx.lineWidth = 1;
    const gs = 52;
    const offY = (game.time * 24) % gs;
    ctx.beginPath();
    for (let y = -gs + offY; y < game.h + gs; y += gs) {
      ctx.moveTo(0, y); ctx.lineTo(game.w, y);
    }
    for (let x = 0; x < game.w + gs; x += gs) {
      ctx.moveTo(x, 0); ctx.lineTo(x, game.h);
    }
    ctx.stroke();

    // vignette
    const vg = ctx.createRadialGradient(game.w / 2, game.h / 2, Math.min(game.w, game.h) * 0.35, game.w / 2, game.h / 2, Math.max(game.w, game.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, game.w, game.h);
  }

  function drawJoystick() {
    if (joyId === null) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#29f0ff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#29f0ff';
    ctx.beginPath();
    ctx.arc(joyOX, joyOY, JOY_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(41,240,255,.5)';
    ctx.beginPath();
    ctx.arc(joyX, joyY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDashIndicator() {
    const p = game.player;
    if (p.dashCd > 0) {
      // cooldown arc around player
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCd / 0.9));
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw() {
    ctx.save();
    // screen shake
    if (game.shakeAmt > 0) {
      ctx.translate((Math.random() - 0.5) * game.shakeAmt * 2, (Math.random() - 0.5) * game.shakeAmt * 2);
    }

    drawBackground();

    for (const pk of game.pickups) pk.draw(ctx);
    game.particles.draw(ctx);
    for (const e of game.enemies) e.draw(ctx);
    for (const b of game.bullets) b.draw(ctx);
    game.player.draw(ctx);
    drawDashIndicator();
    for (const f of game.floats) f.draw(ctx);
    drawJoystick();

    ctx.restore();

    // damage flash
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255,45,106,${game.flash * 0.35})`;
      ctx.fillRect(0, 0, game.w, game.h);
    }
  }

  /* ---------- Title background loop (idle) ---------- */
  function drawTitleIdle() {
    drawBackground();
    game.particles.update(1 / 60);
    game.particles.draw(ctx);
    if (Math.random() < 0.05) {
      game.particles.trail(Math.random() * game.w, Math.random() * game.h,
        ['#29f0ff', '#ff2d6a', '#ffe14d'][Math.floor(Math.random() * 3)], 3);
    }
  }

  /* ---------- Flow ---------- */
  function startGame() {
    SFX.resume();
    SFX.start();
    game.state = 'playing';
    game.player = new Player(game.w / 2, game.h / 2);
    game.enemies = [];
    game.bullets = [];
    game.pickups = [];
    game.floats = [];
    game.particles.list = [];
    game.score = 0;
    game.combo = 0;
    scoreEl.textContent = '0';
    comboEl.classList.add('hidden');
    titleScreen.classList.add('hidden');
    goScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    startWave(1);
  }

  function gameOver() {
    game.state = 'gameover';
    SFX.gameover();
    game.particles.explosion(game.player.x, game.player.y, '#29f0ff');
    game.particles.explosion(game.player.x, game.player.y, '#ffffff');

    const isRecord = game.score > game.best;
    if (isRecord) {
      game.best = game.score;
      localStorage.setItem('neonrush_best', String(game.best));
    }
    $('go-score').textContent = game.score.toLocaleString();
    $('go-wave').textContent = game.wave;
    $('go-best').textContent = game.best.toLocaleString();
    $('new-record').classList.toggle('hidden', !isRecord);

    setTimeout(() => {
      hud.classList.add('hidden');
      goScreen.classList.remove('hidden');
    }, 900);
  }

  function updateTitleHiscore() {
    $('hiscore-title').textContent = game.best > 0 ? `BEST SCORE  ${game.best.toLocaleString()}` : '';
  }

  $('btn-start').addEventListener('click', startGame);
  $('btn-retry').addEventListener('click', startGame);

  /* ---------- Main loop ---------- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 1 / 24);
    last = now;
    game.time += 0; // time advanced in update
    if (game.state === 'playing') {
      update(dt);
      draw();
    } else if (game.state === 'gameover') {
      game.time += dt;
      game.particles.update(dt);
      draw2Gameover();
    } else {
      game.time += dt;
      drawTitleIdle();
    }
    requestAnimationFrame(loop);
  }

  function draw2Gameover() {
    drawBackground();
    for (const e of game.enemies) e.draw(ctx);
    game.particles.draw(ctx);
  }

  resize();
  updateTitleHiscore();
  requestAnimationFrame(loop);
})();
