/* ============ NEON RUSH — particle system ============ */
class Particle {
  constructor(x, y, vx, vy, life, size, color, opts = {}) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.color = color;
    this.drag = opts.drag ?? 0.96;
    this.gravity = opts.gravity ?? 0;
    this.glow = opts.glow ?? true;
    this.shape = opts.shape ?? 'circle'; // circle | spark | ring
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpd = (Math.random() - 0.5) * 0.3;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity * dt;
    this.rot += this.rotSpd;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.globalAlpha = Math.min(1, t * 1.5);
    if (this.glow) {
      ctx.shadowBlur = this.size * 3;
      ctx.shadowColor = this.color;
    }
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * t, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === 'spark') {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.atan2(this.vy, this.vx));
      ctx.fillRect(-this.size * 2 * t, -this.size * 0.35, this.size * 4 * t, this.size * 0.7);
      ctx.restore();
    } else if (this.shape === 'ring') {
      ctx.lineWidth = 2 + 2 * t;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (1.6 - t), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

class ParticleSystem {
  constructor() { this.list = []; }

  burst(x, y, color, count = 14, speed = 220, size = 4, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.list.push(new Particle(
        x, y, Math.cos(a) * s, Math.sin(a) * s,
        0.35 + Math.random() * 0.45,
        size * (0.5 + Math.random()),
        color, opts
      ));
    }
  }

  explosion(x, y, color) {
    this.burst(x, y, color, 22, 320, 5, { shape: 'spark' });
    this.burst(x, y, '#ffffff', 8, 160, 3);
    // shockwave ring
    this.list.push(new Particle(x, y, 0, 0, 0.4, 42, color, { shape: 'ring', drag: 1 }));
  }

  trail(x, y, color, size = 3) {
    this.list.push(new Particle(
      x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30,
      0.25 + Math.random() * 0.2, size, color
    ));
  }

  update(dt) {
    this.list = this.list.filter(p => p.update(dt));
    if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
  }

  draw(ctx) {
    for (const p of this.list) p.draw(ctx);
  }
}

/* Floating score text */
class FloatText {
  constructor(x, y, text, color = '#fff') {
    this.x = x; this.y = y;
    this.text = text; this.color = color;
    this.life = 0.8; this.maxLife = 0.8;
  }
  update(dt) { this.y -= 46 * dt; this.life -= dt; return this.life > 0; }
  draw(ctx) {
    const t = this.life / this.maxLife;
    ctx.globalAlpha = t;
    ctx.font = "700 16px 'Orbitron', sans-serif";
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
