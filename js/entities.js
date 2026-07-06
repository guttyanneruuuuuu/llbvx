/* ============ NEON RUSH — entities ============ */

/* ---------- Player ---------- */
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 16;
    this.speed = 260;
    this.hp = 100; this.maxHp = 100;
    this.angle = -Math.PI / 2;
    this.fireCd = 0;
    this.fireRate = 0.16;
    this.dashCd = 0;
    this.dashTime = 0;
    this.dashVx = 0; this.dashVy = 0;
    this.invuln = 0;
    this.hitFlash = 0;
  }

  get dashing() { return this.dashTime > 0; }

  update(dt, input, game) {
    this.fireCd -= dt;
    this.dashCd -= dt;
    this.invuln -= dt;
    this.hitFlash -= dt;

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.x += this.dashVx * dt;
      this.y += this.dashVy * dt;
      game.particles.trail(this.x, this.y, '#29f0ff', 4);
      game.particles.trail(this.x, this.y, '#ffffff', 2);
    } else {
      const mx = input.moveX, my = input.moveY;
      const mag = Math.hypot(mx, my);
      if (mag > 0.12) {
        const s = this.speed * Math.min(1, mag);
        this.x += (mx / (mag || 1)) * s * dt;
        this.y += (my / (mag || 1)) * s * dt;
        this.angle = Math.atan2(my, mx);
        if (Math.random() < 0.4) game.particles.trail(this.x - Math.cos(this.angle) * 14, this.y - Math.sin(this.angle) * 14, 'rgba(41,240,255,.8)', 2.5);
      }
    }

    // clamp to arena
    this.x = Math.max(this.r, Math.min(game.w - this.r, this.x));
    this.y = Math.max(this.r, Math.min(game.h - this.r, this.y));

    // auto-aim shooting
    const target = game.nearestEnemy(this.x, this.y);
    if (target && this.fireCd <= 0 && !this.dashing) {
      const a = Math.atan2(target.y - this.y, target.x - this.x);
      this.angle = a;
      game.bullets.push(new Bullet(this.x + Math.cos(a) * 18, this.y + Math.sin(a) * 18, a, 620, true));
      this.fireCd = this.fireRate;
      SFX.shoot();
      game.shake(1.5, 0.05);
    }
  }

  dash(dirX, dirY, game) {
    if (this.dashCd > 0 || this.dashing) return false;
    let dx = dirX, dy = dirY;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.12) { dx = Math.cos(this.angle); dy = Math.sin(this.angle); }
    else { dx /= mag; dy /= mag; }
    this.dashVx = dx * 760;
    this.dashVy = dy * 760;
    this.dashTime = 0.18;
    this.dashCd = 0.9;
    this.invuln = Math.max(this.invuln, 0.3);
    SFX.dash();
    game.particles.burst(this.x, this.y, '#29f0ff', 10, 180, 3);
    return true;
  }

  takeDamage(dmg, game) {
    if (this.invuln > 0) return;
    this.hp -= dmg;
    this.invuln = 0.6;
    this.hitFlash = 0.25;
    SFX.hurt();
    game.shake(9, 0.3);
    game.flash = 0.35;
    game.particles.burst(this.x, this.y, '#ff2d6a', 16, 260, 4);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // invuln blink
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.4;

    // outer glow ring
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#29f0ff';

    // ship body (triangle)
    ctx.rotate(this.angle + Math.PI / 2);
    const g = ctx.createLinearGradient(0, -18, 0, 14);
    g.addColorStop(0, '#bff9ff');
    g.addColorStop(0.5, '#29f0ff');
    g.addColorStop(1, '#0a5f8f');
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : g;
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(13, 13);
    ctx.lineTo(0, 6);
    ctx.lineTo(-13, 13);
    ctx.closePath();
    ctx.fill();

    // core
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/* ---------- Bullet ---------- */
class Bullet {
  constructor(x, y, angle, speed, friendly, color) {
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.friendly = friendly;
    this.r = friendly ? 4 : 6;
    this.color = color || (friendly ? '#29f0ff' : '#ff2d6a');
    this.dead = false;
  }
  update(dt, game) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < -30 || this.x > game.w + 30 || this.y < -30 || this.y > game.h + 30) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.shadowBlur = 14;
    ctx.shadowColor = this.color;
    ctx.fillStyle = '#ffffff';
    // elongated core
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r * 2.4, this.r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(-this.r, 0, this.r * 3.2, this.r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- Enemies ---------- */
const ENEMY_TYPES = {
  chaser:  { hp: 20,  speed: 110, r: 15, color: '#ff2d6a', score: 100 },
  speeder: { hp: 10,  speed: 210, r: 11, color: '#ff9d2d', score: 150 },
  tank:    { hp: 70,  speed: 55,  r: 24, color: '#b44dff', score: 300 },
  shooter: { hp: 25,  speed: 80,  r: 15, color: '#4dff88', score: 200 },
};

class Enemy {
  constructor(type, x, y, waveScale = 1) {
    const t = ENEMY_TYPES[type];
    this.type = type;
    this.x = x; this.y = y;
    this.hp = t.hp * waveScale;
    this.maxHp = this.hp;
    this.speed = t.speed * (0.9 + Math.random() * 0.25);
    this.r = t.r;
    this.color = t.color;
    this.score = t.score;
    this.hitFlash = 0;
    this.fireCd = 1 + Math.random() * 1.5;
    this.wobble = Math.random() * Math.PI * 2;
    this.spawnT = 0.5; // spawn animation
    this.dead = false;
  }

  update(dt, game) {
    this.hitFlash -= dt;
    this.wobble += dt * 4;
    if (this.spawnT > 0) { this.spawnT -= dt; return; }

    const p = game.player;
    const a = Math.atan2(p.y - this.y, p.x - this.x);

    if (this.type === 'shooter') {
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist > 230) {
        this.x += Math.cos(a) * this.speed * dt;
        this.y += Math.sin(a) * this.speed * dt;
      } else if (dist < 170) {
        this.x -= Math.cos(a) * this.speed * 0.7 * dt;
        this.y -= Math.sin(a) * this.speed * 0.7 * dt;
      }
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        game.bullets.push(new Bullet(this.x, this.y, a, 240, false, '#4dff88'));
        this.fireCd = 1.6 + Math.random() * 0.8;
      }
    } else {
      const wob = this.type === 'speeder' ? Math.sin(this.wobble) * 0.6 : 0;
      this.x += Math.cos(a + wob) * this.speed * dt;
      this.y += Math.sin(a + wob) * this.speed * dt;
    }
  }

  takeDamage(dmg, game) {
    this.hp -= dmg;
    this.hitFlash = 0.08;
    SFX.hit();
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      return true;
    }
    return false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    let scale = 1;
    if (this.spawnT > 0) {
      const t = 1 - this.spawnT / 0.5;
      scale = t;
      ctx.globalAlpha = t;
      // spawn ring
      ctx.strokeStyle = this.color;
      ctx.shadowBlur = 16;
      ctx.shadowColor = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.r * (2.2 - t * 1.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.scale(scale, scale);

    ctx.shadowBlur = 18;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : this.color;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.5;

    const w = Math.sin(this.wobble) * 0.15;
    ctx.rotate(w);

    if (this.type === 'chaser') {
      // diamond
      this.poly(ctx, 4, this.r, Math.PI / 4 + this.wobble * 0.15);
    } else if (this.type === 'speeder') {
      // sharp triangle
      this.poly(ctx, 3, this.r, this.wobble * 0.3);
    } else if (this.type === 'tank') {
      // hexagon
      this.poly(ctx, 6, this.r, this.wobble * 0.05);
      // inner core
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(0, 0, this.r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'shooter') {
      // pentagon
      this.poly(ctx, 5, this.r, -this.wobble * 0.2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // hp bar for damaged tanks
    if (this.type === 'tank' && this.hp < this.maxHp) {
      ctx.rotate(-w);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(-18, -this.r - 12, 36, 4);
      ctx.fillStyle = this.color;
      ctx.fillRect(-18, -this.r - 12, 36 * Math.max(0, this.hp / this.maxHp), 4);
    }

    ctx.restore();
  }

  poly(ctx, n, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/* ---------- Pickup (heal orb) ---------- */
class Pickup {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 10;
    this.t = 0;
    this.life = 8;
    this.dead = false;
  }
  update(dt, game) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    // magnet toward player when close
    const p = game.player;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (d < 110) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      this.x += Math.cos(a) * 240 * dt;
      this.y += Math.sin(a) * 240 * dt;
    }
  }
  draw(ctx) {
    const pulse = 1 + Math.sin(this.t * 6) * 0.18;
    const blink = this.life < 2 && Math.floor(this.t * 8) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#4dff88';
    ctx.strokeStyle = '#4dff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#bfffdd';
    // cross
    ctx.fillRect(-2, -6, 4, 12);
    ctx.fillRect(-6, -2, 12, 4);
    ctx.restore();
  }
}
