/**
 * Inverse Invader - Tactical Extermination
 * User controls the Mothership.
 * Goal: Destroy all enemies (Fighter + 4 Bunkers) OR land a Minion.
 * Loss: Mothership destroyed.
 */

// --- Constants ---
const FPS = 60;
const CANVAS_WIDTH_PCT = 1.0;
const CANVAS_HEIGHT_PCT = 1.0;

// Colors
const COLOR_MOTHERSHIP = '#0f0'; // Green
const COLOR_MINION = '#0fa'; // Cyan-ish Green
const COLOR_FIGHTER = '#f00'; // Red
const COLOR_BUNKER = '#f80'; // Orange
const COLOR_BULLET_PLAYER = '#b0f'; // Purple
const COLOR_BULLET_ENEMY = '#ff0'; // Yellow

// Game Config
const MOTHERSHIP_LIFE = 30;
const MOTHERSHIP_COOLDOWN = 120; // 2 seconds at 60fps
const MINION_STOCK_INTERVAL = 120; // 3 seconds
const FIGHTER_LIFE = 3;
const BUNKER_LIFE = 3;
const BUNKER_COUNT = 4;

const ASSETS = {
    mothership: { src: 'mothership_green_scifi.png', img: null },
    minion: { src: 'minion_bio_unit.png', img: null },
    fighter: { src: 'fighter_red_jet.png', img: null },
    bunker: { src: 'bunker_heavy_defense.png', img: null }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.lastTime = 0;
        this.gameActive = false;
        this.gameOver = false;
        this.score = 0;
        this.assetsLoaded = false;

        // Entities
        this.player = null; // Mothership
        this.minions = [];
        this.enemies = []; // Fighter + Bunkers
        this.projectiles = [];
        this.particles = [];
        this.stars = [];

        // Input
        this.keys = {};

        // UI Elements
        this.ui = {
            playerLife: document.getElementById('player-life'),
            minionActive: document.getElementById('minion-active'),
            minionStock: document.getElementById('minion-stock'),
            stockReady: document.getElementById('stock-ready'),
            score: document.getElementById('score'),
            fighterLife: document.getElementById('fighter-life'),
            bunkerLife: document.getElementById('bunker-life'),
            finalScore: document.getElementById('final-score'),
            resultTitle: document.getElementById('result-title'),
            resultReason: document.getElementById('result-reason'),
            cooldownBar: document.getElementById('cooldown-bar'),
            startScreen: document.getElementById('start-screen'),
            gameOverScreen: document.getElementById('game-over-screen')
        };

        // Event Listeners
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', e => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        document.getElementById('start-btn').addEventListener('click', (e) => {
            e.target.blur();
            if (this.assetsLoaded) this.start();
        });
        document.getElementById('restart-btn').addEventListener('click', (e) => {
            e.target.blur();
            if (this.assetsLoaded) this.reset();
        });

        this.initStars();
        this.loadAssets(); // Load images
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    loadAssets() {
        let loadedCount = 0;
        const total = Object.keys(ASSETS).length;
        const onLoaded = () => {
            loadedCount++;
            if (loadedCount >= total) {
                this.assetsLoaded = true;
                console.log("Assets Loaded");
                // Enable start button logic if needed, but we check flag in click handler
            }
        };

        for (let key in ASSETS) {
            const img = new Image();
            img.src = ASSETS[key].src;
            img.onload = onLoaded;
            img.onerror = () => {
                console.warn(`Failed to load ${ASSETS[key].src}`);
                onLoaded(); // Count as loaded even on error to allow fallback
            };
            ASSETS[key].img = img;
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.initStars();
        if (this.player) {
            this.player.y = 80;
            if (this.player.x > this.width) this.player.x = this.width / 2;
        }
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2,
                speed: Math.random() * 0.5 + 0.1
            });
        }
    }

    start() {
        this.gameActive = true;
        this.gameOver = false;
        this.score = 0;
        this.projectiles = [];
        this.particles = [];
        this.minions = [];
        this.enemies = [];

        // Spawn Player
        this.player = new Mothership(this);

        // Spawn Enemies
        // 1 Fighter
        this.enemies.push(new Fighter(this));

        // 4 Bunkers
        const margin = this.width * 0.1;
        const availableWidth = this.width - margin * 2;
        const spacing = availableWidth / (BUNKER_COUNT - 1);

        for (let i = 0; i < BUNKER_COUNT; i++) {
            this.enemies.push(new Bunker(this, margin + i * spacing, this.height - 130)); // Moved up to avoid UI
        }

        this.ui.startScreen.classList.remove('active');
        this.ui.gameOverScreen.classList.remove('active');
        this.updateUI();
    }

    reset() {
        this.start();
    }

    endGame(win, reason) {
        this.gameActive = false;
        this.gameOver = true;
        this.ui.finalScore.innerText = this.score;
        this.ui.resultTitle.innerText = win ? "MISSION ACCOMPLISHED" : "MISSION FAILED";
        this.ui.resultTitle.style.color = win ? COLOR_MOTHERSHIP : COLOR_FIGHTER;
        this.ui.resultReason.innerText = reason;
        this.ui.gameOverScreen.classList.add('active');
    }

    loop(timeStamp) {
        const deltaTime = timeStamp - this.lastTime;
        this.lastTime = timeStamp;

        // Clear & Draw BG
        this.ctx.fillStyle = 'rgba(5, 5, 16, 0.5)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.updateStars();

        if (this.gameActive && !this.gameOver) {
            this.update(deltaTime);
            this.draw();
        }

        requestAnimationFrame(this.loop);
    }

    updateStars() {
        this.ctx.fillStyle = '#fff';
        this.stars.forEach(star => {
            star.y -= star.speed * 2; // Moving up (Descent illusion)
            if (star.y < 0) {
                star.y = this.height;
                star.x = Math.random() * this.width;
            }
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    update(deltaTime) {
        // Player
        this.player.update(this.keys);

        // Minions
        this.minions.forEach(minion => minion.update());
        this.minions = this.minions.filter(m => !m.markedForDeletion);

        // Check Minion Win Condition
        if (this.minions.some(m => m.y > this.height)) {
            this.endGame(true, "Minion breached defenses!");
            return;
        }

        // Enemies
        this.enemies.forEach(enemy => enemy.update());
        // Filter dead enemies (but keep references for arrays if needed, actually let's just mark dead)
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);

        if (this.enemies.length === 0) {
            this.endGame(true, "All hostiles eliminated!");
            return;
        }

        // Projectiles
        this.projectiles.forEach(p => p.update());
        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);

        // Particles
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => !p.markedForDeletion);

        this.checkCollisions();
        this.updateUI(); // Move to a timer if performance issues? 60fps UI update is fine for this simple game.

        if (this.player.life <= 0) {
            this.endGame(false, "Mothership destroyed.");
        }
    }

    draw() {
        this.player.draw(this.ctx);
        this.minions.forEach(m => m.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
    }

    checkCollisions() {
        this.projectiles.forEach(proj => {
            if (proj.friendly) {
                // Hitting Enemies
                this.enemies.forEach(enemy => {
                    if (!proj.markedForDeletion && this.checkCollision(proj, enemy)) {
                        proj.markedForDeletion = true;
                        enemy.takeDamage(1);
                        this.createExplosion(proj.x, proj.y, COLOR_BULLET_PLAYER, 5);
                        this.score += 50;
                    }
                });

                // Friendly Fire on Minions!
                this.minions.forEach(minion => {
                    if (this.checkCollision(proj, minion)) {
                        proj.markedForDeletion = true;
                        minion.takeDamage(1); // Minions die in 1 hit
                        this.createExplosion(minion.x, minion.y, COLOR_MINION, 10);
                    }
                });

            } else {
                // Enemy Projectiles
                // Hitting Player
                if (this.checkCollision(proj, this.player)) {
                    proj.markedForDeletion = true;
                    this.player.takeDamage(1);
                    this.createExplosion(proj.x, proj.y, '#fff', 5);
                }

                // Hitting Minions
                this.minions.forEach(minion => {
                    if (this.checkCollision(proj, minion)) {
                        proj.markedForDeletion = true;
                        minion.takeDamage(1);
                        this.createExplosion(minion.x, minion.y, COLOR_MINION, 10);
                    }
                });
            }
        });

        // Minions crashing into Enemies (Kamikaze)
        this.minions.forEach(minion => {
            this.enemies.forEach(enemy => {
                if (this.checkCollision(minion, enemy)) {
                    minion.takeDamage(1); // Die
                    enemy.takeDamage(1); // Hurt enemy
                    this.createExplosion(minion.x, minion.y, COLOR_MINION, 15);
                    this.score += 100;
                }
            });
        });
    }

    checkCollision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    createExplosion(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(this, x, y, color));
        }
    }

    updateUI() {
        if (!this.player) return;

        this.ui.playerLife.innerText = this.player.life;
        this.ui.minionActive.innerText = this.minions.length;
        this.ui.minionStock.innerText = this.player.stock;

        if (this.player.stock > 0) {
            this.ui.stockReady.style.display = 'inline';
        } else {
            this.ui.stockReady.style.display = 'none';
        }

        this.ui.score.innerText = this.score;

        // Enemy stats
        const fighter = this.enemies.find(e => e instanceof Fighter);
        this.ui.fighterLife.innerText = fighter ? fighter.life : "DESTROYED";

        const bunkerCount = this.enemies.filter(e => e instanceof Bunker).length;
        this.ui.bunkerLife.innerText = bunkerCount;

        // Cooldown Bar
        const pct = Math.max(0, (MOTHERSHIP_COOLDOWN - this.player.cooldownTimer) / MOTHERSHIP_COOLDOWN);
        this.ui.cooldownBar.style.transform = `scaleX(${pct})`;
        this.ui.cooldownBar.style.backgroundColor = pct === 1 ? '#0f0' : '#550';
    }
}

class Mothership {
    constructor(game) {
        this.game = game;
        this.width = 100;
        this.height = 50;
        this.x = game.width / 2 - this.width / 2;
        this.y = 50;
        this.speed = 6;
        this.life = MOTHERSHIP_LIFE;

        this.cooldownTimer = 0; // 0 means ready
        this.stock = 0;
        this.stockTimer = 0;
    }

    update(input) {
        // Move Left/Right
        if (input['ArrowLeft'] && this.x > 0) this.x -= this.speed;
        if (input['ArrowRight'] && this.x < this.game.width - this.width) this.x += this.speed;

        // Fire Missile
        if (input['Space']) {
            if (this.cooldownTimer <= 0) {
                this.shoot();
                this.cooldownTimer = MOTHERSHIP_COOLDOWN;
            }
        }
        if (this.cooldownTimer > 0) this.cooldownTimer--;

        // Stock Generation
        this.stockTimer++;
        if (this.stockTimer >= MINION_STOCK_INTERVAL) {
            this.stock++;
            this.stockTimer = 0;
        }

        // Deploy Minions
        if (input['KeyZ'] || input['ShiftLeft'] || input['ShiftRight']) {
            if (this.stock > 0) {
                this.deployMinions();
            }
        }
    }

    shoot() {
        this.game.projectiles.push(new Projectile(this.game, this.x + this.width / 2, this.y + this.height, 15, true));
    }

    deployMinions() {
        // Deploy all stock
        for (let i = 0; i < this.stock; i++) {
            // Slight offset for each minion so they don't stack perfectly
            const offsetX = (i % 5) * 10 - 25;
            const offsetY = Math.floor(i / 5) * 20;
            this.game.minions.push(new Minion(this.game, this.x + this.width / 2 + offsetX, this.y + this.height + offsetY));
        }
        this.stock = 0;
        this.game.createExplosion(this.x + this.width / 2, this.y + this.height, COLOR_MINION, 10); // Visual effect for spawn
    }

    takeDamage(amount) {
        this.life -= amount;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLOR_MOTHERSHIP;

        const img = ASSETS.mothership.img;
        if (img && img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            // Fallback
            ctx.fillStyle = COLOR_MOTHERSHIP;

            // Mothership Shape
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.lineTo(this.x + this.width - 20, this.y + this.height);
            ctx.lineTo(this.x + 20, this.y + this.height);
            ctx.closePath();
            ctx.fill();

            // Cockpit
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + 10, 15, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Minion {
    constructor(game, x, y) {
        this.game = game;
        this.width = 20;
        this.height = 20;
        this.x = x;
        this.y = y;
        this.speedY = 0.25; // Descent speed (Half of 0.5)
        this.speedX = 0.5 + Math.random() * 2.5; // Random speed 0.5-3
        this.direction = Math.random() < 0.5 ? 1 : -1;
        this.moveTimer = 0;
        this.moveTimerLimit = 20 + Math.random() * 100; // Wider random switch time
        this.markedForDeletion = false;
    }

    update() {
        this.y += this.speedY;
        this.x += this.speedX * this.direction;

        // Zigzag logic
        this.moveTimer++;
        if (this.moveTimer > this.moveTimerLimit) {
            this.direction *= -1;
            this.moveTimer = 0;
        }

        // Keep bounds (bounce)
        if (this.x < 0) { this.x = 0; this.direction *= -1; }
        if (this.x > this.game.width - this.width) { this.x = this.game.width - this.width; this.direction *= -1; }
    }

    takeDamage(amount) {
        this.markedForDeletion = true; // Minions are 1-hit kill basically
    }

    draw(ctx) {
        ctx.save();

        const img = ASSETS.minion.img;
        if (img && img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            // Enhanced Fallback Minion (Bio-Drone)
            ctx.fillStyle = COLOR_MINION;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            // Core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 4, 0, Math.PI * 2);
            ctx.fill();
            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_MINION;
        }
        ctx.restore();
    }
}

class Fighter {
    constructor(game) {
        this.game = game;
        this.width = 40;
        this.height = 40;
        this.y = game.height - 150; // Fly above bunkers
        this.x = game.width / 2;
        this.speed = 4;
        this.life = FIGHTER_LIFE;
        this.shootTimer = 0;
        this.markedForDeletion = false;
    }

    update() {
        // AI: Avoid player missiles
        let danger = null;
        // Look for incoming friendly projectiles
        this.game.projectiles.forEach(p => {
            if (p.friendly && p.y < this.y && p.y > 0 && Math.abs(p.x - (this.x + this.width / 2)) < 100) {
                danger = p;
            }
        });

        // AI: Target Minions if no danger
        let targetMinion = null;
        if (!danger) {
            let maxY = -1;
            this.game.minions.forEach(m => {
                if (m.y > maxY) {
                    maxY = m.y;
                    targetMinion = m;
                }
            });
        }

        if (danger) {
            // Evade
            if (danger.x < this.x + this.width / 2) {
                this.x += this.speed; // Move Right
            } else {
                this.x -= this.speed; // Move Left
            }
        } else if (targetMinion) {
            // Intercept Minion
            const fighterCenter = this.x + this.width / 2;
            const minionCenter = targetMinion.x + targetMinion.width / 2;

            if (fighterCenter < minionCenter - 5) {
                this.x += this.speed;
            } else if (fighterCenter > minionCenter + 5) {
                this.x -= this.speed;
            }

            // Shoot if aligned
            if (Math.abs(fighterCenter - minionCenter) < 30) {
                // Higher chance to shoot when aligned
                if (this.shootTimer > 30 && Math.random() < 0.1) {
                    this.shoot();
                    this.shootTimer = 0;
                }
            }
        } else {
            // Idle Movement
            this.x += Math.sin(Date.now() / 500) * 2;
        }

        // Clamp
        if (this.x < 0) this.x = 0;
        if (this.x > this.game.width - this.width) this.x = this.game.width - this.width;

        // Shoot
        this.shootTimer++;
        if (this.shootTimer > 200) { // Every 0.5 sec approx (Speed up)
            if (Math.random() < 0.05) this.shoot();
        }
    }

    shoot() {
        this.game.projectiles.push(new Projectile(this.game, this.x + this.width / 2, this.y, -8, false));
    }

    takeDamage(amount) {
        this.life -= amount;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();

        const img = ASSETS.fighter.img;
        if (img && img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            // Enhanced Fallback Fighter (Red Jet)
            ctx.fillStyle = COLOR_FIGHTER;
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y); // Nose
            ctx.lineTo(this.x + this.width, this.y + this.height); // Right Wing
            ctx.lineTo(this.x + this.width / 2, this.y + this.height - 10); // Engine notch
            ctx.lineTo(this.x, this.y + this.height); // Left Wing
            ctx.closePath();
            ctx.fill();

            // Cockpit
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y + 10);
            ctx.lineTo(this.x + this.width / 2 + 5, this.y + 25);
            ctx.lineTo(this.x + this.width / 2 - 5, this.y + 25);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Bunker {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 40;
        this.life = BUNKER_LIFE;
        this.markedForDeletion = false;
        this.shootTimer = 0;
    }

    update() {
        // Fixed position
        this.shootTimer++;
        if (this.shootTimer > 200) { // Slower fire rate (Halved from 100)
            if (Math.random() < 0.014) this.shoot(); // Reduced to 70% of 0.02
        }
    }

    shoot() {
        this.game.projectiles.push(new Projectile(this.game, this.x + this.width / 2, this.y, -5, false));
    }

    takeDamage(amount) {
        this.life -= amount;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();

        const img = ASSETS.bunker.img;
        if (img && img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            // Enhanced Fallback Bunker (Heavy Turret)
            ctx.fillStyle = '#555'; // Base
            ctx.fillRect(this.x, this.y + 10, this.width, this.height - 10);

            ctx.fillStyle = COLOR_BUNKER; // Turret
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + 20, 15, Math.PI, 0);
            ctx.fill();

            // Barrel
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x + this.width / 2 - 4, this.y, 8, 20);
        }
        // Life bar tiny (Always draw on top)
        ctx.fillStyle = '#0f0';
        const hpPct = this.life / BUNKER_LIFE;
        ctx.fillRect(this.x, this.y - 5, this.width * hpPct, 3);
        ctx.restore();
    }
}

class Projectile {
    constructor(game, x, y, speed, friendly) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = 6;
        this.height = 15;
        this.speed = speed;
        this.friendly = friendly;
        this.markedForDeletion = false;
        this.color = friendly ? COLOR_BULLET_PLAYER : COLOR_BULLET_ENEMY;
    }

    update() {
        this.y += this.speed;
        if (this.y < -50 || this.y > this.game.height + 50) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;

        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);

        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        if (this.speed > 0) { // Moving down
            ctx.moveTo(this.x - this.width / 2, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x, this.y - this.height * 3);
        } else { // Moving up
            ctx.moveTo(this.x - this.width / 2, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height);
            ctx.lineTo(this.x, this.y + this.height * 3);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(game, x, y, color) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.color = color;
        this.life = 100;
        this.markedForDeletion = false;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 4;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / 100);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Start Game
window.onload = function () {
    const game = new Game();
};
