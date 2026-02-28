// --- Setup & Configuration ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// UI Selection
const scoreDisplay = document.getElementById('score-display');
const heartsDisplay = document.getElementById('hearts-display');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreDisplay = document.getElementById('final-score');
const playerNameInput = document.getElementById('player-name');
const leaderboardBody = document.getElementById('leaderboard-body');

// Supabase Config
const SUPABASE_URL = 'https://yfrtgfvxhlzkuprmoluw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmcnRnZnZ4aGx6a3Vwcm1vbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ0NjEsImV4cCI6MjA4Nzc4MDQ2MX0.cxiExZZQFIgavUXjBvy8_GyBQwHdDVvupycU4_5Lrio';


// Mobile Buttons
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnFire = document.getElementById('btn-fire');

let GAME_STATE = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let currentPlayerName = 'Player1';
const maxHearts = 10;
let hearts = maxHearts;
let lastTime = 0;

// Handle dynamic resizing
function resize() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Sound Engine (Web Audio API) ---
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'explosion') {
        // Noise like explosion using low freq sawtooth
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'gameover') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 1.5);
        osc.start(now);
        osc.stop(now + 1.5);
    }
}

// --- Input Subsystem ---
const keys = { left: false, right: false, fire: false };

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space') keys.fire = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space') keys.fire = false;
});

// Touch controls mappings
function bindTouch(element, keyName) {
    if (!element) return;
    element.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
    element.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
    element.addEventListener('touchcancel', (e) => { e.preventDefault(); keys[keyName] = false; });
}
bindTouch(btnLeft, 'left');
bindTouch(btnRight, 'right');
bindTouch(btnFire, 'fire');

// --- Procedural Pixel Art Generator ---
// We create sprites programmatically via an offscreen canvas.
// This is perfect for single-file, zero-asset GitHub Pages.
const scale = 3;
const spriteDefinitions = {
    player: {
        colors: { 'R': '#f00', 'W': '#fff', 'C': '#0ff', 'B': '#00f', 'D': '#444' },
        data: [
            "     C     ",
            "    CCC    ",
            "    CCC    ",
            "   WWWWW   ",
            "  WRRRRRW  ",
            " WRRRRRRRW ",
            "WRRBBBBBRRW",
            "WRRBBBBBRRW",
            "WRRRRRRRRRW",
            "WDD     DDW",
            "W         W"
        ]
    },
    enemy: {
        colors: { 'G': '#0f0', 'W': '#fff', 'M': '#f0f' },
        data: [
            "WW       WW",
            " WGGGGGGGW ",
            " GGGMMMGMM ",
            " GGGGGGGGG ",
            " MGGMMMGMM ",
            "  GGGGGGG  ",
            "   GGGGG   ",
            "  G  G  G  ",
            " G       G ",
            "G         G"
        ]
    }
};

const sprites = {};

function buildSprites() {
    for (const [name, def] of Object.entries(spriteDefinitions)) {
        const height = def.data.length;
        const width = def.data[0].length;

        const c = document.createElement('canvas');
        c.width = width * scale;
        c.height = height * scale;
        const cx = c.getContext('2d');

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = def.data[y][x];
                if (char !== ' ') {
                    cx.fillStyle = def.colors[char];
                    cx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }
        sprites[name] = { img: c, width: c.width, height: c.height };
    }
}
buildSprites();

// --- Game Object Classes ---

class Player {
    constructor() {
        this.width = sprites.player.width;
        this.height = sprites.player.height;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 100; // Offset above thumbs
        this.speed = 250;
        this.cooldown = 0;
        this.fireRate = 0.2;
    }

    update(dt) {
        if (keys.left) this.x -= this.speed * dt;
        if (keys.right) this.x += this.speed * dt;

        // Boundaries
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width - this.width) this.x = canvas.width - this.width;

        if (this.cooldown > 0) this.cooldown -= dt;

        if (keys.fire && this.cooldown <= 0) {
            this.shoot();
            this.cooldown = this.fireRate;
        }
    }

    shoot() {
        // Shoot two lasers from the wings
        bullets.push(new Bullet(this.x + 4, this.y, -400, '#0ff'));
        bullets.push(new Bullet(this.x + this.width - 8, this.y, -400, '#0ff'));
        playSound('shoot');
    }

    draw(ctx) {
        // Thruster flame effect
        ctx.fillStyle = Math.random() > 0.5 ? '#f90' : '#f00';
        ctx.fillRect(this.x + this.width / 2 - 6, this.y + this.height, 4, 10 + Math.random() * 10);
        ctx.fillRect(this.x + this.width / 2 + 2, this.y + this.height, 4, 10 + Math.random() * 10);

        // Draw ship
        ctx.drawImage(sprites.player.img, this.x, this.y);
    }
}

class Bullet {
    constructor(x, y, vy, color) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 16;
        this.vy = vy;
        this.color = color;
        this.active = true;
    }

    update(dt) {
        this.y += this.vy * dt;
        if (this.y < -this.height || this.y > canvas.height) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 1, this.y + 2, this.width + 2, this.height - 4);
    }
}

class Enemy {
    constructor() {
        this.width = sprites.enemy.width;
        this.height = sprites.enemy.height;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        // Increase base speed slightly with score
        this.speed = 80 + Math.random() * 50 + (score * 1.5);
        this.active = true;
        this.hp = 1;

        // Sine wave movement
        this.startX = this.x;
        this.waveOffset = Math.random() * Math.PI * 2;
        this.waveFreq = 0.05 + Math.random() * 0.05;
        this.amp = 20 + Math.random() * 30;

        this.shootTimer = 1 + Math.random() * 2;
    }

    update(dt) {
        this.y += this.speed * dt;
        // Swerve left and right
        this.x = this.startX + Math.sin(this.y * this.waveFreq + this.waveOffset) * this.amp;

        // Wrap X around bounds to prevent enemy from sliding completely off screen
        if (this.x < -this.width) this.startX += canvas.width;
        if (this.x > canvas.width) this.startX -= canvas.width;

        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shoot();
            this.shootTimer = 2 + Math.random() * 3;
        }

        if (this.y > canvas.height) {
            this.active = false; // Escaped
            if (GAME_STATE === 'PLAYING') {
                loseHeart();
            }
        }
    }

    shoot() {
        enemyBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y + this.height, 300, '#f00'));
        // We could play a separate sound for enemy shooting, but it might get noisy.
    }

    draw(ctx) {
        ctx.drawImage(sprites.enemy.img, this.x, this.y);
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 150 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2; // Particle lasts 0.5s
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class Starfield {
    constructor() {
        this.stars = [];
        for (let i = 0; i < 80; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() > 0.9 ? 2 : 1, // Occasional big star
                speed: Math.random() * 40 + 10 // Multi-parallax
            });
        }
    }
    update(dt) {
        this.stars.forEach(s => {
            // Stars move faster when player moves up? Just constant speed for space
            s.y += s.speed * dt;
            if (s.y > canvas.height) {
                s.y = 0;
                s.x = Math.random() * canvas.width;
            }
        });
    }
    draw(ctx) {
        ctx.fillStyle = '#fff';
        this.stars.forEach(s => {
            const opacity = s.speed / 50;
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, opacity)})`;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        });
    }
}

// --- Engine State ---
let player;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let starfield;
let enemySpawnTimer = 0;

// --- API Integration (Supabase) ---
async function submitScore(name, finalScore) {
    if (finalScore === 0) return; // Don't submit 0 scores
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/leaderboards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ player_name: name, score: finalScore })
        });
    } catch (e) {
        console.error("Error submitting score:", e);
    }
}

async function fetchLeaderboards() {
    leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center">Loading...</td></tr>';
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/leaderboards?select=player_name,score&order=score.desc&limit=5`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await res.json();

        leaderboardBody.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach((entry, index) => {
                const tr = document.createElement('tr');

                const rankTd = document.createElement('td');
                rankTd.innerText = index + 1;

                const nameTd = document.createElement('td');
                nameTd.innerText = entry.player_name;

                const scoreTd = document.createElement('td');
                scoreTd.innerText = entry.score;

                tr.appendChild(rankTd);
                tr.appendChild(nameTd);
                tr.appendChild(scoreTd);
                leaderboardBody.appendChild(tr);
            });
        } else {
            leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No scores yet!</td></tr>';
        }
    } catch (e) {
        console.error("Error fetching leaderboards:", e);
        leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#f00;">Error loading data</td></tr>';
    }
}

function spawnExplosion(x, y, primaryColor) {
    playSound('explosion');
    for (let i = 0; i < 20; i++) {
        // mixed sparks
        const color = Math.random() > 0.5 ? primaryColor : (Math.random() > 0.5 ? '#fff' : '#ff0');
        particles.push(new Particle(x, y, color));
    }
}

function initGame() {
    initAudio();
    player = new Player();
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    score = 0;
    hearts = maxHearts;
    updateScore();
    updateHearts();
    enemySpawnTimer = 1;
}

function updateScore() {
    scoreDisplay.innerText = `SCORE: ${score}`;
}

function updateHearts() {
    let html = '';
    for (let i = 0; i < maxHearts; i++) {
        if (i < hearts) html += '<span class="heart">♥</span>';
        else html += '<span class="heart empty">♥</span>';
    }
    heartsDisplay.innerHTML = html;
}

function loseHeart() {
    hearts--;
    updateHearts();
    spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, '#f00');
    if (hearts <= 0) {
        gameOver();
    }
}

function checkCollisions() {
    // Player bullets hit Enemies
    bullets.forEach(b => {
        if (!b.active) return;
        enemies.forEach(e => {
            if (!e.active) return;
            // AABB Collision
            if (b.x < e.x + e.width &&
                b.x + b.width > e.x &&
                b.y < e.y + e.height &&
                b.y + b.height > e.y) {

                b.active = false;
                e.hp--;
                if (e.hp <= 0) {
                    e.active = false;
                    score += 10;
                    updateScore();
                    spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, '#0f0');
                }
            }
        });
    });

    // Enemies hit Player
    enemies.forEach(e => {
        if (!e.active) return;
        // make hitbox slightly smaller than sprite for fairness
        const shrink = 4;
        if (player.x + shrink < e.x + e.width - shrink &&
            player.x + player.width - shrink > e.x + shrink &&
            player.y + shrink < e.y + e.height - shrink &&
            player.y + player.height - shrink > e.y + shrink) {

            e.active = false;
            spawnExplosion(e.x + e.width / 2, e.y + e.height / 2, '#0f0');
            loseHeart();
        }
    });

    // Enemy bullets hit Player
    enemyBullets.forEach(b => {
        if (!b.active) return;
        const shrink = 4;
        if (b.x < player.x + player.width - shrink &&
            b.x + b.width > player.x + shrink &&
            b.y < player.y + player.height - shrink &&
            b.y + b.height > player.y + shrink) {

            b.active = false;
            loseHeart();
        }
    });
}

function startGame() {
    let nameVal = playerNameInput.value.trim();
    currentPlayerName = nameVal === '' ? 'Player1' : nameVal;

    GAME_STATE = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    initGame();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    GAME_STATE = 'GAMEOVER';
    playSound('gameover');
    spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, '#0ff');

    // Submit score and then refresh the leaderboard UI
    submitScore(currentPlayerName, score).then(() => {
        fetchLeaderboards();
    });

    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
        finalScoreDisplay.innerText = score;
    }, 1000);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initialize background
starfield = new Starfield();

// --- Main Loop ---
function gameLoop(timestamp) {
    // Delta time in seconds, clamped to max 0.1s to prevent huge jumps from tab switching
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // Clear and draw background space
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    starfield.update(dt);
    starfield.draw(ctx);

    if (GAME_STATE === 'PLAYING') {
        // Spawner logic
        enemySpawnTimer -= dt;
        if (enemySpawnTimer <= 0) {
            enemies.push(new Enemy());
            // Difficulty curve
            const respawnRate = Math.max(0.3, 1.5 - (score * 0.005));
            enemySpawnTimer = respawnRate;
        }

        player.update(dt);
        bullets.forEach(b => b.update(dt));
        enemyBullets.forEach(b => b.update(dt));
        enemies.forEach(e => e.update(dt));
        particles.forEach(p => p.update(dt));

        checkCollisions();

        // Cleanup inactive entities
        bullets = bullets.filter(b => b.active);
        enemyBullets = enemyBullets.filter(b => b.active);
        enemies = enemies.filter(e => e.active);
        particles = particles.filter(p => p.life > 0);

        // Rendering order: player behind bullets, particles on top
        player.draw(ctx);
        bullets.forEach(b => b.draw(ctx));
        enemyBullets.forEach(b => b.draw(ctx));
        enemies.forEach(e => e.draw(ctx));
        particles.forEach(p => p.draw(ctx));

    } else if (GAME_STATE === 'GAMEOVER') {
        // Keep doing particle physics over dead player
        particles.forEach(p => p.update(dt));
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => p.draw(ctx));

        // Keep existing entities frozen but drawn beneath the modal
        enemies.forEach(e => e.draw(ctx));
    }

    requestAnimationFrame(gameLoop);
}

// Start idle background animation until START is pressed
requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(gameLoop); });
