const loaderState = {
    canvas: null,
    ctx: null,
    animationFrame: null,
    resizeHandler: null,
    band: null,
    clusters: [],
    distantStars: [],
    particles: [],
    speed: 15,
    targetSpeed: 15,
    time: 0,
    progress: 0,
    active: false,
    statusOverride: null,
    progressBar: null,
    progressText: null,
    statusText: null,
    messageDisplay: null,
    cta: null,
    awaitingDismiss: false,
    poemLines: [
        {
            id: 'poemLineZh',
            text: '你此刻的意识，是宇宙亿万年间最珍贵的一束火花。它无法被复制，也无需永恒——它本身就已不可思议。'
        },
        {
            id: 'poemLineEn',
            text: 'In this instant your awareness is the rarest ember the cosmos has kindled across the eons. It cannot be copied nor long for forever—the miracle is that it simply exists.'
        }
    ],
    typingIndex: 0,
    typingCharIndex: 0,
    typingTimer: null,
    statuses: [
        'Entering galactic plane...',
        'Passing star clusters...',
        'Crossing spiral arms...',
        'Approaching galactic core...',
        'Dense stellar region...',
        'Stabilizing near core...',
        'Outer spiral transit...',
        'Leaving the galaxy...',
        'Journey complete!'
    ]
};

class MilkyWayBand {
    draw(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, height * 0.28, width, height * 0.7);
        gradient.addColorStop(0, 'rgba(26, 32, 56, 0)');
        gradient.addColorStop(0.25, 'rgba(58, 82, 126, 0.15)');
        gradient.addColorStop(0.5, 'rgba(98, 122, 166, 0.25)');
        gradient.addColorStop(0.75, 'rgba(58, 82, 126, 0.15)');
        gradient.addColorStop(1, 'rgba(26, 32, 56, 0)');

        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}

class GalaxyCluster {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.width;
        this.y = this.height * 0.3 + Math.random() * this.height * 0.4;
        this.size = Math.random() * 160 + 80;
        this.density = Math.random() * 120 + 60;
        this.speed = Math.random() * 0.22 + 0.06;
    }

    update() {
        this.x -= this.speed;
        if (this.x < -this.size) {
            this.x = this.width + this.size;
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.density; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * this.size * 0.55;
            const sx = this.x + Math.cos(angle) * radius;
            const sy = this.y + Math.sin(angle) * radius;
            const brightness = 1 - (radius / (this.size * 0.55));

            ctx.fillStyle = `rgba(255, 255, 255, ${brightness * 0.28})`;
            ctx.fillRect(sx, sy, 1, 1);
        }
    }
}

class DistantStar {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.width;
        this.y = Math.random() * this.height;
        this.size = Math.random() * 1.1 + 0.4;
        this.brightness = Math.random() * 0.6 + 0.3;
        this.twinkle = Math.random() * 0.02 + 0.01;
        this.phase = Math.random() * Math.PI * 2;
    }

    update(time) {
        this.brightness = 0.35 + Math.sin(time * this.twinkle + this.phase) * 0.35;
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class MicroParticle {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.reset();
    }

    reset() {
        this.z = Math.random() * 2000 + 1000;
        this.x = (Math.random() - 0.5) * 2.2;
        this.y = (Math.random() - 0.5) * 2.2;
        this.size = Math.random() * 0.4 + 0.2;
        this.brightness = Math.random() * 0.5 + 0.3;
        this.pz = this.z;
    }

    update(speed) {
        this.pz = this.z;
        this.z -= speed;
        if (this.z < 1) {
            this.reset();
        }
    }

    draw(ctx, speed, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;

        const scale = 1000 / this.z;
        const x = this.x * scale * width + centerX;
        const y = this.y * scale * height + centerY;

        const pscale = 1000 / this.pz;
        const px = this.x * pscale * width + centerX;
        const py = this.y * pscale * height + centerY;

        const pSize = (1 - this.z / 3000) * this.size * 2.4;
        const trailOpacity = Math.min(speed / 28, 0.85) * this.brightness;

        ctx.strokeStyle = `rgba(255, 255, 255, ${trailOpacity * 0.6})`;
        ctx.lineWidth = Math.max(pSize * 0.4, 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (pSize > 0.8) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, pSize * 1.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness})`;
        ctx.beginPath();
        ctx.arc(x, y, pSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

function resizeCanvas() {
    if (!loaderState.canvas) return;
    loaderState.canvas.width = window.innerWidth;
    loaderState.canvas.height = window.innerHeight;
}

function animate() {
    if (!loaderState.active || !loaderState.ctx) return;
    loaderState.animationFrame = requestAnimationFrame(animate);

    const ctx = loaderState.ctx;
    const width = loaderState.canvas.width;
    const height = loaderState.canvas.height;

    loaderState.time += 1;
    loaderState.speed += (loaderState.targetSpeed - loaderState.speed) * 0.05;

    ctx.fillStyle = 'rgba(1, 3, 11, 0.18)';
    ctx.fillRect(0, 0, width, height);

    loaderState.band.draw(ctx, width, height);

    loaderState.clusters.forEach(cluster => {
        cluster.update();
        cluster.draw(ctx);
    });

    loaderState.distantStars.forEach(star => {
        star.update(loaderState.time);
        star.draw(ctx);
    });

    loaderState.particles.forEach(particle => {
        particle.update(loaderState.speed);
        particle.draw(ctx, loaderState.speed, width, height);
    });
}

export function initGalaxyLoader() {
    const canvas = document.getElementById('loadingCanvas');
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;

    const screen = document.getElementById('loadingScreen');
    if (screen) {
        screen.classList.remove('hidden', 'ready');
    }

    loaderState.canvas = canvas;
    loaderState.ctx = ctx;
    loaderState.progressBar = document.getElementById('progressBar');
    loaderState.progressText = document.getElementById('progressText');
    loaderState.statusText = document.getElementById('statusText');
    loaderState.messageDisplay = document.getElementById('messageDisplay');
    loaderState.cta = document.getElementById('loadingCta');
    if (loaderState.cta) {
        loaderState.cta.style.pointerEvents = 'none';
    }
    loaderState.poemLines.forEach((line, index) => {
        const el = document.getElementById(line.id);
        if (el) {
            el.textContent = '';
            el.classList.remove('typing-active');
        }
    });
    loaderState.typingIndex = 0;
    loaderState.typingCharIndex = 0;
    if (loaderState.typingTimer) {
        clearTimeout(loaderState.typingTimer);
        loaderState.typingTimer = null;
    }
    loaderState.band = new MilkyWayBand();

    loaderState.resizeHandler = resizeCanvas;
    resizeCanvas();
    window.addEventListener('resize', loaderState.resizeHandler);

    loaderState.clusters = Array.from({ length: 5 }, () => new GalaxyCluster(canvas.width, canvas.height));
    loaderState.distantStars = Array.from({ length: 320 }, () => new DistantStar(canvas.width, canvas.height));
    loaderState.particles = Array.from({ length: 2600 }, () => new MicroParticle(canvas.width, canvas.height));

    loaderState.speed = 15;
    loaderState.targetSpeed = 15;
    loaderState.time = 0;
    loaderState.progress = 0;
    loaderState.statusOverride = null;
    loaderState.active = true;
    animate();

    loaderState.typingTimer = setTimeout(startTypewriter, 320);
}

export function setGalaxyLoaderStatus(text) {
    loaderState.statusOverride = text || null;
    if (loaderState.statusText && loaderState.statusOverride) {
        loaderState.statusText.textContent = loaderState.statusOverride;
    }
}

export function updateGalaxyLoaderProgress(progress, status) {
    if (!loaderState.canvas) return;

    loaderState.progress = Math.min(Math.max(progress ?? 0, 0), 100);
    if (loaderState.progressBar) {
        loaderState.progressBar.style.width = `${loaderState.progress}%`;
    }
    if (loaderState.progressText) {
        loaderState.progressText.textContent = `${Math.floor(loaderState.progress)}%`;
    }

    if (typeof status === 'string') {
        setGalaxyLoaderStatus(status);
    } else if (!loaderState.statusOverride && loaderState.statusText) {
        const index = Math.min(
            Math.floor((loaderState.progress / 100) * loaderState.statuses.length),
            loaderState.statuses.length - 1
        );
        loaderState.statusText.textContent = loaderState.statuses[index];
    }

    if (loaderState.messageDisplay) {
        const distance = (loaderState.progress / 100) * 105;
        loaderState.messageDisplay.textContent = `${distance.toFixed(1)} kly`;
    }

    if (loaderState.progress < 20) {
        loaderState.targetSpeed = 12 + loaderState.progress * 0.4;
    } else if (loaderState.progress < 80) {
        loaderState.targetSpeed = 22 + Math.sin(loaderState.progress * 0.12) * 5;
    } else {
        loaderState.targetSpeed = Math.max(10, 30 - (loaderState.progress - 80));
    }
}

export function completeGalaxyLoader() {
    if (!loaderState.canvas) return;
    updateGalaxyLoaderProgress(100, 'Journey complete!');

    const screen = document.getElementById('loadingScreen');
    if (screen) {
        screen.classList.add('ready');
    }
    if (loaderState.cta) {
        loaderState.cta.style.pointerEvents = 'auto';
    }
    loaderState.awaitingDismiss = true;
}

export function dismissGalaxyLoader() {
    if (!loaderState.awaitingDismiss) return;
    loaderState.awaitingDismiss = false;
    const screen = document.getElementById('loadingScreen');
    if (screen) {
        screen.classList.add('hidden');
        screen.classList.remove('ready');
    }
    if (loaderState.cta) {
        loaderState.cta.style.pointerEvents = 'none';
    }

    loaderState.active = false;
    if (loaderState.animationFrame) {
        cancelAnimationFrame(loaderState.animationFrame);
        loaderState.animationFrame = null;
    }
    if (loaderState.resizeHandler) {
        window.removeEventListener('resize', loaderState.resizeHandler);
        loaderState.resizeHandler = null;
    }

    if (loaderState.typingTimer) {
        clearTimeout(loaderState.typingTimer);
        loaderState.typingTimer = null;
    }

    loaderState.poemLines.forEach(line => {
        const el = document.getElementById(line.id);
        if (el) {
            el.textContent = line.text;
            el.classList.remove('typing-active');
        }
    });
}

function startTypewriter() {
    const zh = loaderState.poemLines[0];
    const en = loaderState.poemLines[1];
    const zhEl = document.getElementById(zh.id);
    const enEl = document.getElementById(en.id);
    if (!zhEl || !enEl) {
        loaderState.typingTimer = null;
        return;
    }

    const step = loaderState.typingCharIndex;
    const zhChar = zh.text.slice(0, step + 1);
    const enChar = en.text.slice(0, step + 1);

    zhEl.textContent = zhChar;
    enEl.textContent = enChar;

    zhEl.classList.toggle('typing-active', zhChar.length < zh.text.length);
    enEl.classList.toggle('typing-active', enChar.length < en.text.length);

    loaderState.typingCharIndex += 1;

    const maxLen = Math.max(zh.text.length, en.text.length);
    if (loaderState.typingCharIndex > maxLen) {
        zhEl.textContent = zh.text;
        enEl.textContent = en.text;
        zhEl.classList.remove('typing-active');
        enEl.classList.remove('typing-active');
        loaderState.typingTimer = null;
        return;
    }

    loaderState.typingTimer = setTimeout(startTypewriter, 48);
}

export function skipGalaxyLoader() {
    const navEntries = performance.getEntriesByType ? performance.getEntriesByType('navigation') : [];
    const navType = navEntries && navEntries.length ? navEntries[0].type : (performance.navigation ? performance.navigation.type === 2 ? 'back_forward' : 'navigate' : 'navigate');
    const isBack = navType === 'back_forward';
    if (!isBack) return false;

    loaderState.active = false;
    loaderState.awaitingDismiss = false;
    if (loaderState.typingTimer) {
        clearTimeout(loaderState.typingTimer);
        loaderState.typingTimer = null;
    }
    loaderState.typingCharIndex = 0;
    const screen = document.getElementById('loadingScreen');
    if (screen) {
        screen.classList.add('hidden');
        screen.classList.remove('ready');
    }

    loaderState.poemLines.forEach(line => {
        const el = document.getElementById(line.id);
        if (el) {
            el.textContent = line.text;
            el.classList.remove('typing-active');
        }
    });

    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '100%';
    const progressText = document.getElementById('progressText');
    if (progressText) progressText.textContent = '100%';
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'Welcome back.';
    const messageDisplay = document.getElementById('messageDisplay');
    if (messageDisplay) messageDisplay.textContent = 'Ready';

    return true;
}
