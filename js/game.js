// Five Nights at Lucha - Shooter top-down
// Estructura inspirada en Froot Wars, pero sin Box2D.

// Namespace principal
var game = {
    canvas: null,
    ctx: null,
    width: 800,
    height: 480,

    mode: "menu", // menu | playing | paused | ended
    lastTime: 0,

    // Entidades
    player: null,
    bullets: [],
    zombies: [],
    obstacles: [],
    powerUps: [],

    // Oleadas
    wave: 1,
    maxWaves: 3,
    waveDuration: 60, // segundos
    waveTimer: 60,
    spawnCooldown: 0,

    // Estado
    score: 0,
    highScore: 0,
    isMuted: false,

    // Inputs
    keys: {},
    mouse: { x: 0, y: 0, down: false },

    // Power-ups activos
    effects: {
        speed: { active: false, until: 0 },
        double: { active: false, until: 0 },
        shield: { active: false, until: 0 }
    },

    init: function () {
        this.canvas = document.getElementById("gamecanvas");
        this.ctx = this.canvas.getContext("2d");
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.loadHighScore();
        this.setupEvents();
        this.setupObstacles();

        this.showScreen("mainscreen");
        this.updateHighscoreLabel();

        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    },

    showScreen: function (id) {
        $(".gamelayer").hide();
        if (id) {
            $("#" + id).show();
        }
    },

    startGame: function () {
        // Reset estado completo
        this.mode = "playing";
        this.score = 0;
        this.wave = 1;
        this.waveTimer = this.waveDuration;
        this.spawnCooldown = 0;
        this.bullets = [];
        this.zombies = [];
        this.powerUps = [];
        this.resetEffects();

        this.player = {
            x: this.width / 2,
            y: this.height / 2,
            radius: 14,
            baseSpeed: 160,
            speed: 160,
            health: 100,
            maxHealth: 100
        };

        this.showScreen(null);
        $("#hud").show();
        this.updateHUD();
    },

    backToMenu: function () {
        this.mode = "menu";
        $("#hud").hide();
        this.showScreen("mainscreen");
        this.updateHighscoreLabel();
    },

    togglePause: function () {
        if (this.mode === "playing") {
            this.mode = "paused";
            this.showScreen("pausescreen");
        } else if (this.mode === "paused") {
            this.mode = "playing";
            this.showScreen(null);
            $("#hud").show();
        }
    },

    toggleMute: function () {
        this.isMuted = !this.isMuted;
        // Aquí luego conectas audio real.
    },

    endGame: function (reason) {
        this.mode = "ended";

        // High score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem("fnal_highscore", this.highScore.toString());
        }

        var title = (reason === "victory") ? "¡Sobreviviste!" : "Game Over";
        var msg = "";

        if (reason === "victory") {
            msg = "Has sobrevivido las 3 oleadas. Buen trabajo...";
        } else if (reason === "dead") {
            msg = "Los zombis lograron alcanzarte.";
        } else {
            msg = "La partida ha finalizado.";
        }

        document.getElementById("ending-title").textContent = title;
        document.getElementById("endingmessage").textContent = msg;
        document.getElementById("ending-score").textContent = this.score;
        document.getElementById("ending-highscore").textContent = this.highScore;

        $("#hud").hide();
        this.showScreen("endingscreen");
    },

    // Bucle principal
    loop: function (timestamp) {
        var dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.05) dt = 0.05;
        this.lastTime = timestamp;

        if (this.mode === "playing") {
            this.update(dt);
            this.render();
        } else if (this.mode === "menu" || this.mode === "ended" || this.mode === "paused") {
            // Opcional: dibujar fondo tenue
            this.renderStatic();
        }

        requestAnimationFrame(this.loop.bind(this));
    },

    update: function (dt) {
        this.handleInput(dt);
        this.updateEffects();
        this.updateBullets(dt);
        this.updateZombies(dt);
        this.updatePowerUps(dt);
        this.handleSpawning(dt);
        this.handleCollisions();

        // Oleadas y fin de juego
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
            if (this.wave < this.maxWaves) {
                this.wave++;
                this.waveTimer = this.waveDuration;
            } else {
                // Sin más oleadas -> victoria (aunque queden zombis, se puede decidir limpiar)
                if (this.zombies.length === 0) {
                    this.endGame("victory");
                }
            }
        }

        if (this.player.health <= 0) {
            this.endGame("dead");
        }

        this.updateHUD();
    },

    renderStatic: function () {
        // Fondo base cuando no se está jugando
        var ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, this.width, this.height);
    },

    render: function () {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Fondo (puedes cambiar a imagen)
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, this.width, this.height);

        // Obstáculos
        ctx.fillStyle = "#555";
        this.obstacles.forEach(function (o) {
            ctx.fillRect(o.x, o.y, o.w, o.h);
        });

        // Power-ups
        this.powerUps.forEach(function (p) {
            if (p.type === "speed") ctx.fillStyle = "#1abc9c";
            else if (p.type === "double") ctx.fillStyle = "#f1c40f";
            else if (p.type === "shield") ctx.fillStyle = "#3498db";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
        });

        // Balas
        ctx.fillStyle = "#ecf0f1";
        this.bullets.forEach(function (b) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Zombis
        this.zombies.forEach(function (z) {
            if (z.type === "walker") ctx.fillStyle = "#27ae60";
            else if (z.type === "runner") ctx.fillStyle = "#e67e22";
            else ctx.fillStyle = "#8e44ad";

            ctx.beginPath();
            ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Player
        ctx.save();
        // Rotar hacia el mouse
        var angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x);
        ctx.translate(this.player.x, this.player.y);
        ctx.rotate(angle);
        ctx.fillStyle = this.effects.shield.active ? "#00ffff" : "#3498db";
        ctx.beginPath();
        ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
        ctx.fill();
        // "Arma"
        ctx.fillStyle = "#ecf0f1";
        ctx.fillRect(0, -3, this.player.radius + 6, 6);
        ctx.restore();
    },

    // ---------------- Lógica auxiliar ----------------

    setupEvents: function () {
        var self = this;

        window.addEventListener("keydown", function (e) {
            self.keys[e.code] = true;
        });

        window.addEventListener("keyup", function (e) {
            self.keys[e.code] = false;
        });

        this.canvas.addEventListener("mousemove", function (e) {
            var rect = self.canvas.getBoundingClientRect();
            self.mouse.x = e.clientX - rect.left;
            self.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener("mousedown", function (e) {
            if (e.button === 0) {
                self.mouse.down = true;
                self.shoot();
            }
        });

        this.canvas.addEventListener("mouseup", function (e) {
            if (e.button === 0) {
                self.mouse.down = false;
            }
        });
    },

    handleInput: function (dt) {
        var p = this.player;
        if (!p) return;

        var vx = 0, vy = 0;
        if (this.keys["KeyW"] || this.keys["ArrowUp"]) vy -= 1;
        if (this.keys["KeyS"] || this.keys["ArrowDown"]) vy += 1;
        if (this.keys["KeyA"] || this.keys["ArrowLeft"]) vx -= 1;
        if (this.keys["KeyD"] || this.keys["ArrowRight"]) vx += 1;

        var len = Math.hypot(vx, vy);
        if (len > 0) {
            vx /= len;
            vy /= len;
        }

        var speed = p.baseSpeed * (this.effects.speed.active ? 2 : 1);
        p.speed = speed;

        var nx = p.x + vx * speed * dt;
        var ny = p.y + vy * speed * dt;

        // Límites
        nx = Math.max(p.radius, Math.min(this.width - p.radius, nx));
        ny = Math.max(p.radius, Math.min(this.height - p.radius, ny));

        // Chequeo simple de colisión con obstáculos
        if (!this.collidesWithObstacles(nx, ny, p.radius)) {
            p.x = nx;
            p.y = ny;
        }
    },

    shoot: function () {
        if (!this.player || this.mode !== "playing") return;

        var createBullet = (angleOffset) => {
            var angle = Math.atan2(this.mouse.y - this.player.y, this.mouse.x - this.player.x) + angleOffset;
            var speed = 420;
            this.bullets.push({
                x: this.player.x + Math.cos(angle) * (this.player.radius + 4),
                y: this.player.y + Math.sin(angle) * (this.player.radius + 4),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0
            });
        };

        if (this.effects.double.active) {
            createBullet(-0.08);
            createBullet(0.08);
        } else {
            createBullet(0);
        }

        // Aquí disparas audio de disparo si quieres.
    },

    updateBullets: function (dt) {
        var self = this;
        this.bullets = this.bullets.filter(function (b) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;
            return b.life > 0 &&
                b.x >= 0 && b.x <= self.width &&
                b.y >= 0 && b.y <= self.height;
        });
    },

    spawnZombie: function () {
        // Selección según oleada
        var r = Math.random();
        var type;

        if (this.wave === 1) {
            type = "walker";
        } else if (this.wave === 2) {
            type = (r < 0.7) ? "walker" : "runner";
        } else {
            if (r < 0.5) type = "runner";
            else if (r < 0.8) type = "walker";
            else type = "brute";
        }

        // Spawnear en bordes
        var side = Math.floor(Math.random() * 4); // 0 top,1 right,2 bottom,3 left
        var x, y;
        if (side === 0) { x = Math.random() * this.width; y = -20; }
        else if (side === 1) { x = this.width + 20; y = Math.random() * this.height; }
        else if (side === 2) { x = Math.random() * this.width; y = this.height + 20; }
        else { x = -20; y = Math.random() * this.height; }

        var config = {
            walker: { radius: 12, speed: 40, health: 20, damage: 5, score: 10 },
            runner: { radius: 10, speed: 80, health: 25, damage: 10, score: 20 },
            brute:  { radius: 18, speed: 25, health: 70, damage: 25, score: 40 }
        }[type];

        this.zombies.push({
            type: type,
            x: x,
            y: y,
            radius: config.radius,
            speed: config.speed,
            health: config.health,
            damage: config.damage,
            scoreValue: config.score
        });
    },

    updateZombies: function (dt) {
        var self = this;
        var p = this.player;
        this.zombies.forEach(function (z) {
            var dx = p.x - z.x;
            var dy = p.y - z.y;
            var len = Math.hypot(dx, dy) || 1;
            var vx = dx / len;
            var vy = dy / len;

            var nx = z.x + vx * z.speed * dt;
            var ny = z.y + vy * z.speed * dt;

            // No atraviesan obstáculos de forma sencilla
            if (!self.collidesWithObstacles(nx, ny, z.radius)) {
                z.x = nx;
                z.y = ny;
            }
        });
    },

    handleSpawning: function (dt) {
        this.spawnCooldown -= dt;
        if (this.spawnCooldown > 0) return;

        // Frecuencia según oleada
        var interval;
        if (this.wave === 1) interval = 1.3;
        else if (this.wave === 2) interval = 0.9;
        else interval = 0.6;

        this.spawnZombie();
        this.spawnCooldown = interval;

        // Chance de power-up ocasional
        if (Math.random() < 0.12) {
            this.spawnPowerUp();
        }
    },

    spawnPowerUp: function () {
        var types = ["speed", "double", "shield"];
        var type = types[Math.floor(Math.random() * types.length)];
        var x = 40 + Math.random() * (this.width - 80);
        var y = 40 + Math.random() * (this.height - 80);

        this.powerUps.push({
            type: type,
            x: x,
            y: y,
            radius: 10,
            life: 10 // segundos en el suelo
        });
    },

    updatePowerUps: function (dt) {
        this.powerUps = this.powerUps.filter(function (p) {
            p.life -= dt;
            return p.life > 0;
        });
    },

    handleCollisions: function () {
        var self = this;

        // Balas vs zombis
        this.bullets.forEach(function (b) {
            self.zombies.forEach(function (z) {
                if (z.health > 0) {
                    var dx = z.x - b.x;
                    var dy = z.y - b.y;
                    var dist = Math.hypot(dx, dy);
                    if (dist < z.radius + 3) {
                        z.health -= 25;
                        b.life = 0;
                        if (z.health <= 0) {
                            self.score += z.scoreValue;
                        }
                    }
                }
            });
        });

        // Limpiar zombis muertos
        this.zombies = this.zombies.filter(function (z) {
            return z.health > 0;
        });

        // Zombis vs jugador
        var p = this.player;
        if (p) {
            this.zombies.forEach(function (z) {
                var dx = z.x - p.x;
                var dy = z.y - p.y;
                var dist = Math.hypot(dx, dy);
                if (dist < z.radius + p.radius) {
                    if (!self.effects.shield.active) {
                        p.health -= z.damage;
                    }
                    // Pequeño empujón para que no quede pegado
                    var nx = dx / (dist || 1);
                    var ny = dy / (dist || 1);
                    z.x += nx * 5;
                    z.y += ny * 5;
                }
            });
        }

        // Jugador vs power-ups
        this.powerUps = this.powerUps.filter(function (pup) {
            var dx = pup.x - self.player.x;
            var dy = pup.y - self.player.y;
            var dist = Math.hypot(dx, dy);
            if (dist < pup.radius + self.player.radius) {
                self.activatePowerUp(pup.type);
                return false;
            }
            return true;
        });
    },

    activatePowerUp: function (type) {
        var now = performance.now() / 1000;
        if (type === "speed") {
            this.effects.speed.active = true;
            this.effects.speed.until = now + 6;
            $("#hud-powerup").text("Velocidad x2");
        } else if (type === "double") {
            this.effects.double.active = true;
            this.effects.double.until = now + 8;
            $("#hud-powerup").text("Doble disparo");
        } else if (type === "shield") {
            this.effects.shield.active = true;
            this.effects.shield.until = now + 4;
            $("#hud-powerup").text("Inmunidad");
        }
    },

    updateEffects: function () {
        var now = performance.now() / 1000;

        ["speed", "double", "shield"].forEach(type => {
            var e = this.effects[type];
            if (e.active && now >= e.until) {
                e.active = false;
            }
        });

        if (!this.effects.speed.active &&
            !this.effects.double.active &&
            !this.effects.shield.active) {
            $("#hud-powerup").text("-");
        }
    },

    resetEffects: function () {
        this.effects.speed.active = false;
        this.effects.double.active = false;
        this.effects.shield.active = false;
        $("#hud-powerup").text("-");
    },

    setupObstacles: function () {
        // Obstáculos simples; ajustas según arte del mapa
        this.obstacles = [
            { x: 220, y: 160, w: 80, h: 30 },
            { x: 480, y: 260, w: 90, h: 30 },
            { x: 340, y: 340, w: 120, h: 30 }
        ];
    },

    collidesWithObstacles: function (x, y, r) {
        return this.obstacles.some(function (o) {
            var closestX = Math.max(o.x, Math.min(x, o.x + o.w));
            var closestY = Math.max(o.y, Math.min(y, o.y + o.h));
            var dx = x - closestX;
            var dy = y - closestY;
            return (dx * dx + dy * dy) < (r * r);
        });
    },

    updateHUD: function () {
        $("#hud-health").text(Math.max(0, Math.round(this.player.health)));
        $("#hud-wave").text(this.wave + " / " + this.maxWaves);
        $("#hud-time").text(Math.max(0, Math.floor(this.waveTimer)));
        $("#hud-score").text(this.score);
    },

    loadHighScore: function () {
        var v = parseInt(localStorage.getItem("fnal_highscore") || "0", 10);
        this.highScore = isNaN(v) ? 0 : v;
    },

    updateHighscoreLabel: function () {
        $("#highscore-value").text(this.highScore);
    }
};

// Iniciar cuando el DOM esté listo
$(function () {
    game.init();
});
