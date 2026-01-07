/**
 * Ring Squadron - Main Game Entry Point
 *
 * This is the core game orchestrator that manages:
 * - Game state machine (menu, modeSelect, playing, shop, gameover)
 * - Entity lifecycle (player, allies, enemies, bullets, rings, powerups)
 * - System coordination (collision, spawning, particles, audio)
 * - Save/load functionality
 *
 * Architecture:
 * - Game class is the main controller
 * - Entities are managed in arrays and updated each frame
 * - Systems are instantiated once and called as needed
 * - State machine controls game flow
 *
 * @module main
 */
import { CONFIG } from './utils/config.js';
import { SPRITES } from './utils/sprites.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input.js';
import { AudioManager } from './audio.js';
import { Player } from './entities/player.js';
import { Ally } from './entities/ally.js';
import { Enemy } from './entities/enemy.js';
import { Bullet } from './entities/bullet.js';
import { CollisionSystem } from './systems/collision.js';
import { FormationSystem } from './systems/formation.js';
import { SpawnerSystem } from './systems/spawner.js';
import { ParticleSystem, ScreenEffects } from './systems/particles.js';
import { ShopSystem, ShopUI } from './systems/shop.js';
import { PowerUp, PowerUpManager, POWERUP_TYPES } from './entities/powerup.js';
import { Boss, BossAttacks, getBossForWave } from './entities/boss.js';
import { ComboSystem } from './systems/combo.js';
import { SaveSystem, HighScoreUI } from './systems/save.js';
import { WeaponSystem, WeaponSelectUI, WEAPONS } from './systems/weapons.js';
import { HapticSystem } from './systems/haptics.js';
import { GameModeManager, ModeSelectUI, GAME_MODES } from './systems/gamemode.js';
import { CampaignManager, CAMPAIGN_LEVELS } from './systems/campaign.js';
import { MusicSystem } from './systems/music.js';
import { FloatingTextSystem } from './systems/floatingtext.js';
import { EditorSystem } from './systems/editor.js';
import { EditorUI } from './systems/editorui.js';
import { CustomLevelManager } from './systems/customlevel.js';
import { LevelSelectUI } from './systems/levelselect.js';
import { GameOverUI } from './systems/gameoverui.js';
import { RedBox } from './entities/redbox.js';
import { CargoShip } from './entities/cargoship.js';
import { SwarmEnemy } from './entities/swarmenemy.js';
import { SwarmBoss } from './entities/swarmboss.js';
import { MultiplierGate } from './entities/multipliergate.js';
import { PowerupCrate } from './entities/powerupcrate.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.setupCanvas();

        // Initialize core systems
        this.renderer = new Renderer(this.canvas);
        this.input = new InputHandler(this.canvas);
        this.audio = new AudioManager();
        this.formation = new FormationSystem();
        this.spawner = new SpawnerSystem(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        this.particles = new ParticleSystem();
        this.screenFx = new ScreenEffects();

        // New systems
        this.shop = new ShopSystem();
        this.shopUI = new ShopUI(this.shop);
        this.powerUpManager = new PowerUpManager();
        this.combo = new ComboSystem();
        this.save = new SaveSystem();
        this.weapons = new WeaponSystem();
        this.weaponSelectUI = new WeaponSelectUI(this.weapons);
        this.haptics = new HapticSystem();
        this.gameMode = new GameModeManager();
        this.modeSelectUI = new ModeSelectUI();
        this.music = new MusicSystem();
        this.highScoreUI = new HighScoreUI(this.save);
        this.floatingText = new FloatingTextSystem();

        // Editor and custom level systems
        this.editor = new EditorSystem();
        this.editorUI = new EditorUI(this.editor);
        this.customLevel = new CustomLevelManager();
        this.levelSelectUI = new LevelSelectUI();
        this.gameOverUI = new GameOverUI();

        // Game state
        this.state = 'menu'; // menu, modeSelect, playing, paused, shop, gameover, editor, levelSelect, customPlaying
        this.isPaused = false; // Pause overlay active during gameplay
        this.score = 0;
        this.gold = 0;
        this.totalGold = 0;
        this.kills = 0;
        this.ringsCollected = 0;
        this.alliesRecruited = 0;
        this.currentWave = 0;
        this.waveAnnouncement = null;
        this.waveAnnouncementTimer = 0;
        this.playTime = 0; // Time spent in current game (seconds)
        this.isNewLevelHighScore = false; // Flag for displaying "NEW HIGH SCORE!"
        this.bossDefeated = false; // Track if boss was defeated this run
        this.victoryAchieved = false; // Flag to prevent death after victory

        // Entities
        this.player = new Player(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        this.allies = [];
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.rings = [];
        this.walls = [];
        this.powerUps = [];
        this.boss = null;
        this.bossActive = false;
        this.pendingBossBullets = []; // Queue for time-delayed boss bullets

        // Chase mode entities
        this.redBox = null;
        this.cargoShips = [];
        this.playerInvincible = false;
        this.playerInvincibilityTimer = 0;
        this.redBoxSlowdownTimer = 0;
        this.waveTimer = 0;  // Track wave progression in Chase mode

        // Swarm mode entities
        this.swarmEnemies = [];
        this.swarmBosses = [];
        this.powerupCrates = [];
        this.pushWalls = [];
        this.multiplierGates = [];
        this.rocketExplosions = [];  // Visual explosion radius indicators
        this.swarmLives = 5;
        this.permanentUpgrades = {
            wingmen: 0,
            hasSpreadShot: false,
            hasRocketLauncher: false
        };
        this.powerUpSpeedBonus = 0; // Cumulative speed increase from power-ups in Chase Swarm mode

        // Timing
        this.lastTime = 0;
        this.shootingStarTimer = 0;
        this.gameOverTimer = 0;
        this.menuAnimTimer = 0; // For animated menu effects

        // Visual effects
        this.explosions = [];

        // Load saved progress
        this.loadProgress();

        // Bind game loop
        this.gameLoop = this.gameLoop.bind(this);

        // Start
        this.renderer.drawStartScreen();
    }

    setupCanvas() {
        this.canvas.width = CONFIG.GAME_WIDTH;
        this.canvas.height = CONFIG.GAME_HEIGHT;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Wheel event for editor scrolling
        this.canvas.addEventListener('wheel', (e) => {
            if (this.state === 'editor') {
                e.preventDefault();
                this.editorUI.handleWheel(e.deltaY);
            }
        }, { passive: false });
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        const gameAspect = CONFIG.GAME_WIDTH / CONFIG.GAME_HEIGHT;
        const containerAspect = containerWidth / containerHeight;

        let displayWidth, displayHeight;

        if (containerAspect > gameAspect) {
            displayHeight = containerHeight;
            displayWidth = displayHeight * gameAspect;
        } else {
            displayWidth = containerWidth;
            displayHeight = displayWidth / gameAspect;
        }

        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;
    }

    start() {
        this.audio.init();
        this.audio.resume();
        this.music.init();
        this.music.resume();

        const rules = this.gameMode.getRules();

        // Handle special modes
        if (rules.isEditor) {
            this.state = 'editor';
            this.editor.reset();
            this.editorUI.show();
            return;
        }

        if (rules.isCustom) {
            this.state = 'levelSelect';
            this.levelSelectUI.show();
            return;
        }

        this.reset();
        this.state = 'playing';
        // Don't call requestAnimationFrame here - gameLoop is already running
        this.music.startNormalMusic();
    }

    reset() {
        this.score = 0;
        this.kills = 0;
        this.ringsCollected = 0;
        this.alliesRecruited = 0;
        this.currentWave = 0;
        this.waveAnnouncement = null;
        this.playTime = 0;
        this.gameStartTime = 0;  // Will be set on first frame
        this.isNewLevelHighScore = false;
        this.bossDefeated = false;
        this.victoryAchieved = false;
        this.player.reset(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        this.allies = [];
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.rings = [];
        this.walls = [];
        this.powerUps = [];
        this.boss = null;
        this.bossActive = false;
        this.pendingBossBullets = [];
        this.explosions = [];
        this.particles.clear();
        this.spawner.reset();
        this.input.reset();
        this.combo.reset();
        this.powerUpManager.clear();
        this.gameMode.reset();

        // Initialize Chase mode entities
        const rules = this.gameMode.getRules();
        if (rules.isChase) {
            this.redBox = new RedBox(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
            this.cargoShips = [];
            this.playerInvincible = false;
            this.playerInvincibilityTimer = 0;
            this.redBoxSlowdownTimer = 0;
            this.waveTimer = 0;
            this.walls = [];  // For boost pads
            this.currentWave = 1;  // Start at wave 1 for Chase mode
            this.player.allowVerticalMovement = true;  // Enable vertical movement
        } else {
            this.redBox = null;
            this.cargoShips = [];
            this.player.allowVerticalMovement = false;  // Disable vertical movement
        }

        // Initialize Swarm mode entities
        if (rules.isSwarm) {
            this.swarmEnemies = [];
            this.swarmBosses = [];
            this.powerupCrates = [];
            this.pushWalls = [];
            this.multiplierGates = [];
            this.swarmLives = 5;
            this.permanentUpgrades = { wingmen: 0, hasSpreadShot: false, hasRocketLauncher: false };
            this.powerUpSpeedBonus = 0;
            this.player.health = 1;  // 1 HP, lives system
            this.player.allowVerticalMovement = true;  // Allow full movement in Swarm mode
            // Double fire rate (100% faster shooting)
            this.player.fireRate = CONFIG.PLAYER_FIRE_RATE / 2;
        } else {
            this.swarmEnemies = [];
            this.swarmBosses = [];
            this.powerupCrates = [];
            this.pushWalls = [];
            this.multiplierGates = [];
            this.powerUpSpeedBonus = 0;
            // Reset fire rate to default for non-Swarm modes
            this.player.fireRate = CONFIG.PLAYER_FIRE_RATE;
        }

        // Initialize Chase Swarm mode entities (hybrid mode)
        if (rules.isChaseSwarm) {
            this.redBox = new RedBox(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT, 'CHASE_SWARM_MODE');
            this.cargoShips = [];
            this.swarmEnemies = [];
            this.swarmBosses = [];
            this.pushWalls = [];
            this.powerupCrates = [];
            this.multiplierGates = [];
            this.swarmLives = 5;
            this.redBoxEnemySpeedBoost = 1.0;  // Tracks speed boost from enemies reaching red box
            this.permanentUpgrades = { wingmen: 0, hasSpreadShot: false, hasRocketLauncher: false };
            this.powerUpSpeedBonus = 0;
            this.player.health = 1;  // 1 HP, lives system
            this.player.allowVerticalMovement = true;
            this.player.allowShipRotation = true;  // Enable ship rotation for Chase Swarm
            this.player.fireRate = CONFIG.PLAYER_FIRE_RATE / 2;  // Double fire rate
        }

        // Apply upgrades to player
        this.shop.applyUpgrades(this.player);
    }

    loadProgress() {
        const progress = this.save.loadProgress();
        if (progress) {
            this.gold = progress.gold || 0;
            this.totalGold = progress.totalGold || 0;
            this.shop.deserialize(progress.upgrades);
            this.weapons.deserialize(progress);
            this.combo.deserialize(progress);
        }
    }

    saveProgress() {
        this.save.saveProgress({
            gold: this.gold,
            totalGold: this.totalGold,
            upgrades: this.shop.serialize(),
            unlockedWeapons: this.weapons.unlockedWeapons,
            maxCombo: this.combo.maxCombo,
            highestWave: Math.max(this.currentWave, this.save.loadProgress()?.highestWave || 0)
        });
    }

    openShop() {
        if (this.gameMode.canUseShop()) {
            this.state = 'shop';
            this.shopUI.show();
            this.music.setIntensity(0.2);
        }
    }

    closeShop() {
        this.state = 'playing';
        this.shopUI.hide();
        this.music.setIntensity(0.5);
    }

    // Pause game
    pauseGame() {
        this.isPaused = true;
        this.music.setIntensity(0.1);
    }

    // Resume game
    resumeGame() {
        this.isPaused = false;
        this.music.setIntensity(0.5);
        this.input.reset(); // Clear input state to prevent ghost inputs
    }

    // Quit to menu from pause
    quitToMenu() {
        this.isPaused = false;
        this.state = 'menu';
        this.music.stop();
        this.input.reset();
    }

    // Update while paused - handle pause menu interactions
    updatePaused() {
        if (this.input.checkTap()) {
            const target = this.input.getTarget();
            if (target) {
                const bounds = this.renderer.getPauseMenuBounds();

                // Check resume button
                if (this.isPointInBounds(target, bounds.resume)) {
                    this.haptics.light();
                    this.resumeGame();
                    return;
                }

                // Check quit button
                if (this.isPointInBounds(target, bounds.quit)) {
                    this.haptics.medium();
                    this.quitToMenu();
                    return;
                }
            }
        }
    }

    // Check if pause button was tapped
    checkPauseButtonTap(target) {
        if (!target) return false;
        const bounds = this.renderer.getPauseButtonBounds();
        return this.isPointInBounds(target, bounds);
    }

    // Helper to check if point is in bounds
    isPointInBounds(point, bounds) {
        return point.x >= bounds.x &&
               point.x <= bounds.x + bounds.width &&
               point.y >= bounds.y &&
               point.y <= bounds.y + bounds.height;
    }

    purchaseUpgrade() {
        const selected = this.shopUI.getSelectedUpgrade();
        if (selected && this.shop.canAfford(selected.key, this.gold)) {
            const cost = this.shop.purchase(selected.key, this.gold);
            if (cost > 0) {
                this.gold -= cost;
                this.shop.applyUpgrades(this.player);
                this.audio.playPowerUp();
                this.haptics.purchase();
                this.saveProgress();
            }
        }
    }

    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Apply time scale from screen effects
        const scaledDelta = deltaTime * this.screenFx.getTimeScale();

        // Always update stars and screen effects (use player boost speed)
        const starSpeedMultiplier = this.player ? (this.player.getSpeedMultiplier() + this.powerUpSpeedBonus) : 1.0;
        this.renderer.updateStars(scaledDelta, starSpeedMultiplier);
        this.screenFx.update(scaledDelta);
        this.particles.update(scaledDelta);
        this.combo.update(scaledDelta);
        this.powerUpManager.update();
        this.floatingText.update(scaledDelta);

        switch (this.state) {
            case 'menu':
            case 'modeSelect':
                this.updateMenu(scaledDelta);
                this.renderMenu();
                break;
            case 'playing':
                if (this.isPaused) {
                    this.updatePaused();
                    this.render();
                    this.renderer.drawPauseMenu();
                } else {
                    this.update(scaledDelta, currentTime);
                    this.render();
                }
                break;
            case 'shop':
                this.updateShop(scaledDelta);
                this.render();
                break;
            case 'gameover':
                this.updateGameOver(scaledDelta);
                this.render();
                break;
            case 'editor':
                this.updateEditor(scaledDelta);
                this.renderEditor();
                break;
            case 'levelSelect':
                this.updateLevelSelect(scaledDelta);
                this.renderLevelSelect();
                break;
            case 'customPlaying':
                if (this.isPaused) {
                    this.updatePaused();
                    this.render();
                    this.renderer.drawPauseMenu();
                } else {
                    this.updateCustomPlaying(scaledDelta, currentTime);
                    this.render();
                }
                break;
        }

        requestAnimationFrame(this.gameLoop);
    }

    updateMenu(deltaTime) {
        // Update menu animation timer
        this.menuAnimTimer += deltaTime / 1000; // Convert to seconds

        // Occasional shooting star on menu
        this.shootingStarTimer += deltaTime;
        if (this.shootingStarTimer > 3000) {
            this.particles.shootingStar(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
            this.shootingStarTimer = 0;
        }

        // Update mode select UI animations
        this.modeSelectUI.update(deltaTime);

        // Handle touch/press states for button animations
        const target = this.input.getTarget();
        const hover = this.input.getHoverPosition();

        // Update hover from mouse position
        if (hover) {
            this.modeSelectUI.updateHover(hover.y);
        } else if (target) {
            this.modeSelectUI.updateHover(target.y);
        } else {
            this.modeSelectUI.updateHover(null);
        }

        // Handle press state (mouse click or touch)
        if (target && this.input.isPressed()) {
            this.modeSelectUI.onPressStart(target.y);
        } else {
            this.modeSelectUI.onPressEnd();
        }

        // Check for tap to select a mode
        if (this.input.checkTap()) {
            if (target) {
                const selectedMode = this.modeSelectUI.getModeAtY(target.y);

                if (selectedMode) {
                    this.gameMode.setMode(selectedMode);
                    this.screenFx.flash('#ffffff', 0.3);
                    this.haptics.medium();
                    this.start();
                }
            }
        }
    }

    // Legacy support - redirect to menu
    updateModeSelect(deltaTime) {
        this.state = 'menu';
        this.updateMenu(deltaTime);
    }

    renderMenu() {
        // Get stats for display
        const savedStats = this.save.getStatistics();
        const highScores = this.save.getHighScores();
        const stats = {
            highScore: highScores.length > 0 ? highScores[0].score : 0,
            totalKills: savedStats.totalKills || 0,
            gamesPlayed: savedStats.gamesPlayed || 0
        };

        // Get touch/hover position for hover effects
        const hover = this.input.getHoverPosition();
        const target = this.input.getTarget();
        const hoverY = hover ? hover.y : (target ? target.y : null);

        // Render menu with integrated mode selection
        this.renderer.drawStartScreen(this.menuAnimTimer, stats, this.modeSelectUI, hoverY);
        this.particles.draw(this.canvas.getContext('2d'));
    }

    updateShop(deltaTime) {
        if (this.input.checkTap()) {
            // Check if tap is on an upgrade
            this.purchaseUpgrade();
        }

        // Simple escape from shop
        const target = this.input.getTarget();
        if (target && target.y > CONFIG.GAME_HEIGHT - 80) {
            this.closeShop();
        }
    }

    updateGameOver(deltaTime) {
        // Wait for delay before allowing interaction
        if (this.gameOverTimer > 0) {
            this.gameOverTimer -= deltaTime;
            this.input.checkTap(); // Consume any taps during delay
            return;
        }

        // Show the game over UI if not visible
        if (!this.gameOverUI.visible) {
            // Determine if this is a victory
            const isVictory = this.victoryAchieved ||
                this.customLevel.isComplete() ||
                (this.gameMode.getRules().isCampaign && this.bossDefeated);

            // Save high score first
            if (this.gameMode.canSaveHighScore()) {
                const rank = this.save.saveHighScore({
                    score: this.score,
                    wave: this.currentWave,
                    kills: this.kills,
                    gameMode: this.gameMode.currentMode
                });

                const levelId = this.gameMode.currentMode === 'campaign'
                    ? (this.campaign ? this.campaign.currentLevelIndex : 0)
                    : 'default';
                this.isNewLevelHighScore = this.save.saveLevelScore(
                    this.gameMode.currentMode,
                    levelId,
                    {
                        score: this.score,
                        wave: this.currentWave,
                        kills: this.kills,
                        time: this.playTime || 0,
                        bossDefeated: this.bossDefeated || false,
                        healthRemaining: this.player ? Math.floor((this.player.health / this.player.maxHealth) * 100) : 0
                    }
                );
            }

            // Update statistics
            this.save.updateStatistics({
                goldEarned: this.totalGold,
                kills: this.kills,
                ringsCollected: this.ringsCollected,
                wave: this.currentWave,
                maxCombo: this.combo.maxCombo
            });

            this.saveProgress();

            // Show the UI with stats
            this.gameOverUI.show(isVictory, {
                score: this.score,
                wave: this.currentWave,
                kills: this.kills,
                alliesRecruited: this.alliesRecruited,
                maxCombo: this.combo.maxCombo,
                playTime: this.playTime,
                goldEarned: this.totalGold,
                isNewHighScore: this.isNewLevelHighScore
            });
        }

        // Update UI animations
        this.gameOverUI.update(deltaTime);

        // Handle hover/press states
        const target = this.input.getTarget();
        const hover = this.input.getHoverPosition();

        if (hover) {
            this.gameOverUI.updateHover(hover.x, hover.y);
        } else if (target) {
            this.gameOverUI.updateHover(target.x, target.y);
        }

        if (target && this.input.isPressed()) {
            this.gameOverUI.onPressStart(target.x, target.y);
        } else {
            this.gameOverUI.onPressEnd();
        }

        // Handle tap
        if (this.input.checkTap()) {
            if (target) {
                const action = this.gameOverUI.handleTap(target.x, target.y);

                if (action === 'restart') {
                    this.screenFx.flash('#ffffff', 0.3);
                    this.haptics.light();
                    this.gameOverUI.hide();
                    this.start();
                } else if (action === 'menu') {
                    this.screenFx.flash('#ffffff', 0.3);
                    this.haptics.light();
                    this.gameOverUI.hide();
                    this.state = 'menu';
                    this.music.stop();
                }
            }
        }
    }

    // ========================================
    // EDITOR MODE
    // ========================================

    updateEditor(deltaTime) {
        this.editorUI.update(deltaTime);

        // Simple tap handling - no drag detection needed
        if (this.input.checkTap()) {
            const target = this.input.getTarget();
            if (target) {
                const result = this.editorUI.handleTap(target.x, target.y);
                if (result === 'exit') {
                    this.exitEditor();
                } else if (result === 'save_and_play') {
                    const levelInfo = this.editor.saveAndPlay();
                    this.audio.playPowerUp();
                    // Load and start playing the level immediately
                    if (this.customLevel.loadLevelData(levelInfo.name, levelInfo.data)) {
                        this.editorUI.hide();
                        this.reset();
                        this.state = 'customPlaying';
                        this.music.startNormalMusic();
                    }
                } else if (result === 'save') {
                    this.audio.playPowerUp();
                } else if (result === 'placed') {
                    this.haptics.light();
                } else if (result === 'level_loaded') {
                    this.audio.playPowerUp();
                }
            }
        }
    }

    renderEditor() {
        const ctx = this.canvas.getContext('2d');

        // Clear with dark background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);

        // Draw editor UI
        this.editorUI.draw(ctx);
    }

    exitEditor() {
        // Check for unsaved changes
        if (this.editor.hasUnsavedChanges()) {
            const save = confirm(`"${this.editor.levelName}" has unsaved changes.\n\nSave before exiting?`);
            if (save) {
                this.editor.saveLevel();
                this.audio.playPowerUp();
            }
        }
        this.editorUI.hide();
        this.state = 'menu';
    }

    // ========================================
    // LEVEL SELECT MODE
    // ========================================

    updateLevelSelect(deltaTime) {
        this.levelSelectUI.update(deltaTime);

        if (this.input.checkTap()) {
            const target = this.input.getTarget();
            if (target) {
                const result = this.levelSelectUI.handleTap(target.x, target.y);
                if (result === 'back') {
                    this.exitLevelSelect();
                } else if (result && result !== 'back') {
                    // Level was selected - load and start it
                    this.startCustomLevel(result);
                }
            }
        }
    }

    renderLevelSelect() {
        const ctx = this.canvas.getContext('2d');

        // Clear with dark background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);

        // Draw level select UI
        this.levelSelectUI.draw(ctx);
    }

    exitLevelSelect() {
        this.levelSelectUI.hide();
        this.state = 'menu';
    }

    startCustomLevel(levelName) {
        // Try to get level data from levelSelectUI (includes global levels)
        const levelData = this.levelSelectUI.getLevelData(levelName);
        if (levelData && this.customLevel.loadLevelData(levelName, levelData)) {
            this.levelSelectUI.hide();
            this.reset();
            this.state = 'customPlaying';
            this.music.startNormalMusic();
        }
    }

    // ========================================
    // CUSTOM LEVEL PLAYING
    // ========================================

    updateCustomPlaying(deltaTime, currentTime) {
        const dt = Math.min(deltaTime, 50);

        // Calculate boosted dt for scrolling entities
        const speedMultiplier = this.player.getSpeedMultiplier() + this.powerUpSpeedBonus;
        const boostedDt = dt * speedMultiplier;

        // Check for pause button tap first
        if (this.input.checkTap()) {
            const target = this.input.getTarget();
            if (this.checkPauseButtonTap(target)) {
                this.haptics.light();
                this.pauseGame();
                return;
            }
        }

        // Track play time
        this.playTime += dt / 1000;

        // Update custom level manager
        this.customLevel.update(currentTime, this.rings, this.enemies, this.walls, this.player);

        // Check for level complete
        if (this.customLevel.isComplete()) {
            this.floatingText.add(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2 - 50, 'LEVEL COMPLETE!', '#00ff88', 16);
            this.audio.playWaveStart();
            this.state = 'gameover';
            this.gameOverTimer = CONFIG.GAME_OVER_DELAY;
            return;
        }

        // Check for level failed
        if (this.customLevel.isFailed()) {
            this.state = 'gameover';
            this.gameOverTimer = CONFIG.GAME_OVER_DELAY;
            return;
        }

        // Get power-up modifiers
        const fireRateMult = this.powerUpManager.getFireRateMultiplier();
        const hasSpread = this.powerUpManager.hasSpreadShot();

        // Update player
        const target = this.input.isActive() ? this.input.getTarget() : null;
        this.player.update(dt, target, currentTime);

        // Fire using weapon system
        if (this.weapons.canFire(currentTime, fireRateMult)) {
            const bullets = this.weapons.fire(
                this.player.x,
                this.player.y - this.player.height / 2,
                currentTime,
                this.player.bulletDamage - CONFIG.PLAYER_BULLET_DAMAGE,
                hasSpread
            );
            this.playerBullets.push(...bullets);
            this.audio.playShoot();
            this.haptics.light();
        }

        // Update allies
        for (const ally of this.allies) {
            if (!ally.active) continue;

            const formationPos = this.formation.getFormationPosition(
                this.player.x,
                this.player.y,
                ally.formationIndex
            );
            const allyBullets = ally.update(dt, formationPos.x, formationPos.y, currentTime, true);
            if (allyBullets.length > 0) {
                this.playerBullets.push(...allyBullets);
            }
        }

        // Update enemies (using boostedDt for scroll speed)
        const spawnCallback = this.spawnEnemy.bind(this);
        for (const enemy of this.enemies) {
            const enemyBullets = enemy.update(boostedDt, currentTime, this.player.x, this.player.y, spawnCallback);
            if (enemyBullets.length > 0) {
                this.enemyBullets.push(...enemyBullets);
            }
        }

        // Update bullets (normal dt - not boosted)
        for (const bullet of this.playerBullets) {
            bullet.update(dt);
        }
        for (const bullet of this.enemyBullets) {
            if (bullet.update) bullet.update(dt, this.player);
        }

        // Update rings (using boostedDt for scroll speed)
        for (const ring of this.rings) {
            ring.update(boostedDt);
        }

        // Update walls (boostedDt for movement, dt for animations)
        for (const wall of this.walls) {
            wall.update(boostedDt, dt);
        }

        // Update power-ups (using boostedDt for scroll speed)
        for (const powerUp of this.powerUps) {
            powerUp.update(boostedDt);
        }

        this.handleCollisions();
        this.cleanup();

        // Check player death
        if (!this.player.active) {
            if (this.gameMode.loseLife()) {
                // Respawn with remaining lives
                this.player.reset(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
                this.shop.applyUpgrades(this.player);
                this.floatingText.add(CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2, `${this.gameMode.getLives()} LIVES LEFT`, '#ffdd00', 14);
            } else {
                // Game over
                this.state = 'gameover';
                this.gameOverTimer = CONFIG.GAME_OVER_DELAY;
                this.audio.playDamage();
                this.screenFx.flash('#ff0000', 0.5);
            }
        }
    }

    spawnEnemy(x, y, type) {
        const enemy = new Enemy(x, y, type);
        this.enemies.push(enemy);
    }

    update(deltaTime, currentTime) {
        const dt = Math.min(deltaTime, 50);

        // Set game start time on first frame
        if (this.gameStartTime === 0) {
            this.gameStartTime = currentTime;
        }

        // Calculate relative time since game started (for spawner timing)
        const gameTime = currentTime - this.gameStartTime;

        // Calculate boosted dt for scrolling entities (enemies, rings, walls)
        // This makes everything scroll faster when boosted
        const speedMultiplier = this.player.getSpeedMultiplier() + this.powerUpSpeedBonus;
        const boostedDt = dt * speedMultiplier;

        // Check for pause button tap first
        if (this.input.checkTap()) {
            const target = this.input.getTarget();
            if (this.checkPauseButtonTap(target)) {
                this.haptics.light();
                this.pauseGame();
                return; // Don't process other taps this frame
            }
        }

        // Track play time (in seconds)
        this.playTime += dt / 1000;

        // Check for wave change
        const newWave = this.spawner.waveNumber;
        if (newWave !== this.currentWave) {
            this.currentWave = newWave;
            this.waveAnnouncement = `WAVE ${this.currentWave}`;
            this.waveAnnouncementTimer = 2000;
            this.particles.waveStart(CONFIG.GAME_WIDTH);
            this.screenFx.flash('#4488ff', 0.2, 0.03);
            this.audio.playWaveStart();
            this.haptics.waveComplete();

            // Check for boss wave
            if (this.gameMode.shouldSpawnBoss(this.currentWave)) {
                this.spawnBoss();
            }

            // Open shop between waves (every 3 waves)
            if (this.currentWave > 1 && this.currentWave % 3 === 1 && this.gameMode.canUseShop()) {
                // Could show shop prompt here
            }
        }

        // Update wave announcement
        if (this.waveAnnouncementTimer > 0) {
            this.waveAnnouncementTimer -= dt;
            if (this.waveAnnouncementTimer <= 0) {
                this.waveAnnouncement = null;
            }
        }

        // Occasional shooting star
        this.shootingStarTimer += dt;
        if (this.shootingStarTimer > 5000 + Math.random() * 5000) {
            this.particles.shootingStar(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
            this.shootingStarTimer = 0;
        }

        // Update music intensity
        this.music.updateGameplayIntensity(this.currentWave, this.enemies.length, this.bossActive);

        // Update spawner (skip if boss is active)
        const rules = this.gameMode.getRules();
        if (rules.isChase) {
            // Chase mode: Update red box and cargo ships
            if (this.redBox) {
                const isSlowed = this.redBoxSlowdownTimer > 0;
                this.redBox.update(dt, this.currentWave, isSlowed, this.player.boostLevel);

                if (this.redBoxSlowdownTimer > 0) {
                    this.redBoxSlowdownTimer -= dt;
                }

                // Check collision with player - only if not in victory state
                if (this.redBox.checkPlayerCollision(this.player) && !this.victoryAchieved) {
                    if (!this.playerInvincible && !this.gameMode.isInvincible()) {
                        // Player dies from red box
                        this.player.health = 0;
                        this.player.active = false;
                        this.audio.playExplosion();
                        this.particles.explosion(this.player.x, this.player.y, 2);
                        this.screenFx.shake(20, 0.5);
                        this.screenFx.flash('#ff0000', 0.4, 0.05);
                        this.haptics.heavy();
                    }
                }
            }

            // Update cargo ships
            for (let i = this.cargoShips.length - 1; i >= 0; i--) {
                const ship = this.cargoShips[i];
                ship.update(dt, boostedDt, this.player.y);

                // Remove if off screen
                if (!ship.active || ship.y > CONFIG.GAME_HEIGHT + 100) {
                    this.cargoShips.splice(i, 1);
                }
            }

            // Chase mode spawning
            this.spawner.updateChaseMode(
                currentTime,
                this.walls,
                this.cargoShips,
                this.enemies,
                this.currentWave,
                this.spawner.getDifficulty()
            );

            // Update invincibility
            if (this.playerInvincible) {
                this.playerInvincibilityTimer -= dt;
                if (this.playerInvincibilityTimer <= 0) {
                    this.playerInvincible = false;
                }
            }

            // Update wave timer for Chase mode
            this.waveTimer += dt;
            if (this.waveTimer >= CONFIG.CHASE_MODE.waveDuration) {
                this.nextWaveChase();
            }
        } else if (rules.isSwarm) {
            // Swarm mode: Update swarm enemies, bosses, crates, push walls, multiplier gates

            // Update swarm enemies
            for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                const enemy = this.swarmEnemies[i];
                enemy.update(dt, this.player.x, this.player.y);
                if (!enemy.active) {
                    this.swarmEnemies.splice(i, 1);
                }
            }

            // Update swarm bosses
            for (let i = this.swarmBosses.length - 1; i >= 0; i--) {
                const boss = this.swarmBosses[i];
                boss.update(dt, this.player.x, this.player.y);
                if (!boss.active) {
                    this.swarmBosses.splice(i, 1);
                }
            }

            // Update powerup crates
            for (let i = this.powerupCrates.length - 1; i >= 0; i--) {
                const crate = this.powerupCrates[i];
                crate.update(dt);
                if (!crate.active) {
                    this.powerupCrates.splice(i, 1);
                }
            }

            // Update push walls
            for (let i = this.pushWalls.length - 1; i >= 0; i--) {
                const wall = this.pushWalls[i];
                wall.update(dt, dt);
                if (!wall.active) {
                    this.pushWalls.splice(i, 1);
                }
            }

            // Update multiplier gates
            for (const gate of this.multiplierGates) {
                gate.update(dt);
            }

            // Swarm spawning
            this.spawner.updateSwarmMode(
                gameTime,
                this.swarmEnemies,
                this.swarmBosses,
                this.powerupCrates,
                this.pushWalls,
                this.multiplierGates
            );

            // Enable bullet bouncing for player bullets
            for (const bullet of this.playerBullets) {
                bullet.canBounce = true;
            }

            // Update rocket explosion visuals
            for (let i = this.rocketExplosions.length - 1; i >= 0; i--) {
                const explosion = this.rocketExplosions[i];
                explosion.time += dt;
                explosion.radius = explosion.maxRadius * Math.min(explosion.time / 10, 1);  // Expand over 10 frames
                explosion.alpha = Math.max(0, 1 - explosion.time / 15);  // Fade out over 15 frames

                if (explosion.alpha <= 0) {
                    this.rocketExplosions.splice(i, 1);
                }
            }
        } else if (rules.isChaseSwarm) {
            // Chase Swarm mode: Hybrid of Chase and Swarm mechanics

            // Update red box with enemy speed boost
            if (this.redBox) {
                const isSlowed = false;  // No slowdown mechanic in Chase Swarm
                this.redBox.update(dt, 1, isSlowed, 0, this.redBoxEnemySpeedBoost);
            }

            // Update cargo ships
            for (let i = this.cargoShips.length - 1; i >= 0; i--) {
                const ship = this.cargoShips[i];
                ship.update(dt, dt, this.player.y);
                if (!ship.active) {
                    this.cargoShips.splice(i, 1);
                }
            }

            // Update swarm enemies (no homing)
            for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                const enemy = this.swarmEnemies[i];
                enemy.update(dt, this.player.x, this.player.y);

                // Check if enemy reached red box
                if (this.redBox && enemy.y >= this.redBox.y) {
                    const cfg = CONFIG.CHASE_SWARM_MODE;
                    this.redBoxEnemySpeedBoost += cfg.enemySpeedBoost;
                    enemy.active = false;
                }

                if (!enemy.active) {
                    this.swarmEnemies.splice(i, 1);
                }
            }

            // Update swarm bosses (no homing)
            for (let i = this.swarmBosses.length - 1; i >= 0; i--) {
                const boss = this.swarmBosses[i];
                boss.update(dt, this.player.x, this.player.y);

                // Check if boss reached red box - INSTANT GAME OVER
                if (this.redBox && boss.y >= this.redBox.y) {
                    this.redBox.makeUnstoppable();
                    this.audio.playExplosion();
                    this.particles.explosion(boss.x, boss.y, 5);
                    this.screenFx.shake(30, 1.0);
                    this.screenFx.flash('#ff0000', 0.8, 0.1);
                    boss.active = false;
                }

                if (!boss.active) {
                    this.swarmBosses.splice(i, 1);
                }
            }

            // Update push walls
            for (let i = this.pushWalls.length - 1; i >= 0; i--) {
                const wall = this.pushWalls[i];
                wall.update(dt, dt);
                if (!wall.active) {
                    this.pushWalls.splice(i, 1);
                }
            }

            // Update powerup crates
            for (let i = this.powerupCrates.length - 1; i >= 0; i--) {
                const crate = this.powerupCrates[i];
                crate.update(dt);
                if (!crate.active) {
                    this.powerupCrates.splice(i, 1);
                }
            }

            // Update multiplier gates
            for (const gate of this.multiplierGates) {
                gate.update(dt);
            }

            // Chase Swarm spawning
            this.spawner.updateChaseSwarmSpawning(
                gameTime,
                this.swarmEnemies,
                this.swarmBosses,
                this.cargoShips,
                this.pushWalls,
                this.powerupCrates,
                this.multiplierGates
            );

            // Check for victory condition: after 30 seconds, all enemies defeated
            if (gameTime >= 30000 &&
                this.swarmEnemies.length === 0 &&
                this.swarmBosses.length === 0 &&
                this.cargoShips.length === 0) {
                this.handleVictory();
            }

            // Enable bullet bouncing for player bullets
            for (const bullet of this.playerBullets) {
                bullet.canBounce = true;
            }

            // Update rocket explosion visuals
            for (let i = this.rocketExplosions.length - 1; i >= 0; i--) {
                const explosion = this.rocketExplosions[i];
                explosion.time += dt;
                explosion.radius = explosion.maxRadius * Math.min(explosion.time / 10, 1);  // Expand over 10 frames
                explosion.alpha = Math.max(0, 1 - explosion.time / 15);  // Fade out over 15 frames

                if (explosion.alpha <= 0) {
                    this.rocketExplosions.splice(i, 1);
                }
            }
        } else if (!this.bossActive) {
            // Normal mode spawning
            const difficulty = this.spawner.getDifficulty() * this.gameMode.getDifficultyMultiplier(this.currentWave);
            const allyCount = this.allies.filter(a => a.active).length;
            const spawnRateMult = this.gameMode.getSpawnRateMultiplier();
            this.spawner.update(
                currentTime,
                this.enemies,
                this.rings,
                difficulty,
                allyCount,
                spawnRateMult,
                this.walls,
                rules.hasWalls || false,
                rules.noAllyRings || false
            );
        }

        // Update boss
        if (this.boss && this.boss.active) {
            this.boss.update(dt);
            this.updateBossAttacks(currentTime);
        }

        // Process pending boss bullets (game-time scheduling)
        this.processPendingBossBullets(dt);

        // Get power-up modifiers
        const fireRateMult = this.powerUpManager.getFireRateMultiplier();
        const hasSpread = this.powerUpManager.hasSpreadShot();

        // Update player with weapon system - only move while dragging
        const target = this.input.isActive() ? this.input.getTarget() : null;
        const playerBullets = this.player.update(dt, target, currentTime);

        // In Swarm mode, collect auto-fire bullets from player.update()
        if (rules.isSwarm && playerBullets.length > 0) {
            // Apply spread shot if unlocked
            if (this.permanentUpgrades.hasSpreadShot) {
                // Replace single bullet with spread3 pattern
                const singleBullet = playerBullets[0];
                const firingDown = singleBullet.firingDown || false;
                playerBullets.length = 0; // Clear array

                // Create spread3: left, center, right
                const angles = [-0.3, 0, 0.3]; // Spread angles in radians
                const vyDirection = firingDown ? 8 : -8;  // Down or up based on player facing
                for (const angle of angles) {
                    const vx = Math.sin(angle) * 8;
                    const vy = vyDirection;
                    const bullet = new Bullet(singleBullet.x, singleBullet.y, true, singleBullet.damage, vx, vy);
                    bullet.canBounce = true;
                    bullet.firingDown = firingDown;
                    playerBullets.push(bullet);
                }
            } else {
                // Enable bouncing for single bullet
                for (const bullet of playerBullets) {
                    bullet.canBounce = true;
                }
            }

            // Apply rocket launcher if unlocked
            if (this.permanentUpgrades.hasRocketLauncher) {
                for (const bullet of playerBullets) {
                    bullet.isRocket = true;
                    bullet.splashRadius = 20;  // Explosion radius (75% smaller)
                }
            }

            this.playerBullets.push(...playerBullets);
            this.audio.playShoot();
            this.haptics.light();
        } else if (rules.isChaseSwarm && playerBullets.length > 0) {
            // Apply spread shot if unlocked
            if (this.permanentUpgrades.hasSpreadShot) {
                // Replace single bullet with spread3 pattern
                const singleBullet = playerBullets[0];
                const firingDown = singleBullet.firingDown || false;
                playerBullets.length = 0; // Clear array

                // Create spread3: left, center, right
                const angles = [-0.3, 0, 0.3]; // Spread angles in radians
                const vyDirection = firingDown ? 8 : -8;  // Down or up based on player facing
                for (const angle of angles) {
                    const vx = Math.sin(angle) * 8;
                    const vy = vyDirection;
                    const bullet = new Bullet(singleBullet.x, singleBullet.y, true, singleBullet.damage, vx, vy);
                    bullet.canBounce = true;
                    bullet.firingDown = firingDown;
                    playerBullets.push(bullet);
                }
            } else {
                // Enable bouncing for single bullet
                for (const bullet of playerBullets) {
                    bullet.canBounce = true;
                }
            }

            // Apply rocket launcher if unlocked
            if (this.permanentUpgrades.hasRocketLauncher) {
                for (const bullet of playerBullets) {
                    bullet.isRocket = true;
                    bullet.splashRadius = 20;  // Explosion radius (75% smaller)
                }
            }

            this.playerBullets.push(...playerBullets);
            this.audio.playShoot();
            this.haptics.light();
        } else if (!rules.isSwarm && !rules.isChaseSwarm) {
            // Check for swipe to cycle weapons (non-Swarm modes)
            const swipeDir = this.input.checkHorizontalSwipe();
            if (swipeDir !== 0) {
                this.weapons.cycleWeapon(swipeDir);
                this.floatingText.add(this.player.x, this.player.y - 40, this.weapons.getCurrentWeapon().name, {
                    color: '#00ffff',
                    size: 12,
                    duration: 1000
                });
                this.audio.playPowerUp();
            }

            // Fire using weapon system (Chase and other modes)
            if (this.weapons.canFire(currentTime, fireRateMult)) {
                const bullets = this.weapons.fire(
                    this.player.x,
                    this.player.y - this.player.height / 2,
                    currentTime,
                    this.player.bulletDamage - CONFIG.PLAYER_BULLET_DAMAGE, // Upgrade bonus
                    hasSpread
                );
                this.playerBullets.push(...bullets);
                this.audio.playShoot();
                this.haptics.light();
            }
        }

        // Player engine trail (centered at bottom of ship)
        if (this.player.active && Math.random() > 0.5) {
            this.particles.engineTrail(
                this.player.x,
                this.player.y + this.player.height / 2,
                '#00aaff'
            );
        }

        // Update allies with engine trails
        // Calculate damage multiplier for large ally counts
        const allyDamageMult = this.getAllyDamageMultiplier();
        const activeAllyCount = this.allies.filter(a => a.active).length;

        // Determine if allies should rotate with player (only Chase Swarm mode)
        const allyFacingUp = rules.isChaseSwarm ? this.player.facingUp : true;

        // Only update/fire from displayed allies (capped at ALLY_DISPLAY_CAP)
        // Excess allies contribute to damage multiplier but don't fire
        let updatedAllies = 0;
        for (const ally of this.allies) {
            if (!ally.active) continue;

            // Only update allies within display cap
            if (updatedAllies >= CONFIG.ALLY_DISPLAY_CAP) {
                // Move excess allies to follow formation but don't fire
                const formationPos = this.formation.getFormationPosition(
                    this.player.x,
                    this.player.y,
                    ally.formationIndex
                );
                ally.x = formationPos.x;
                ally.y = formationPos.y;
                updatedAllies++;
                continue;
            }

            const formationPos = this.formation.getFormationPosition(
                this.player.x,
                this.player.y,
                ally.formationIndex
            );
            const allyBullets = ally.update(dt, formationPos.x, formationPos.y, currentTime, allyFacingUp);
            if (allyBullets.length > 0) {
                // Apply damage multiplier from ally count scaling
                for (const bullet of allyBullets) {
                    bullet.damage = Math.floor(bullet.damage * allyDamageMult);
                }
                this.playerBullets.push(...allyBullets);
            }

            // Ally engine trails (less frequent, centered at bottom)
            if (Math.random() > 0.8) {
                this.particles.engineTrail(ally.x, ally.y + ally.height / 2, '#00ff88', 0.5);
            }
            updatedAllies++;
        }

        // Update enemies (using boostedDt for scroll speed)
        const spawnCallback = this.spawnEnemy.bind(this);
        for (const enemy of this.enemies) {
            const enemyBullets = enemy.update(boostedDt, currentTime, this.player.x, this.player.y, spawnCallback);
            if (enemyBullets.length > 0) {
                this.enemyBullets.push(...enemyBullets);
                // Play type-specific enemy sounds
                this.playEnemyTypeSound(enemy);
            }

            // Enemy engine trails (inverted - going down)
            if (enemy.onScreen && Math.random() > 0.85) {
                this.particles.addParticle(enemy.x, enemy.y - 15, {
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: -1 - Math.random(),
                    life: 0.2,
                    decay: 0.04,
                    size: 1.5,
                    color: '#ff4444',
                    friction: 0.95
                });
            }
        }

        // Update power-ups (using boostedDt for scroll speed)
        for (const powerUp of this.powerUps) {
            powerUp.update(boostedDt);

            // Magnet effect - attract power-ups to player
            if (this.powerUpManager.hasMagnet()) {
                const dx = this.player.x - powerUp.x;
                const dy = this.player.y - powerUp.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150 && dist > 0) {
                    powerUp.x += (dx / dist) * 3;
                    powerUp.y += (dy / dist) * 3;
                }
            }
        }

        // Update bullets with trails
        for (const bullet of this.playerBullets) {
            bullet.update(dt);
            if (bullet.active && Math.random() > 0.7) {
                this.particles.bulletTrail(bullet.x, bullet.y, true);
            }
        }
        for (const bullet of this.enemyBullets) {
            bullet.update(dt);
            if (bullet.active && Math.random() > 0.7) {
                this.particles.bulletTrail(bullet.x, bullet.y, false);
            }
        }

        // Update rings (using boostedDt for scroll speed)
        for (const ring of this.rings) {
            ring.update(boostedDt);
        }

        // Update walls (boostedDt for movement, dt for animations)
        for (const wall of this.walls) {
            wall.update(boostedDt, dt);
        }

        this.handleCollisions();
        this.cleanup();

        // Check player death
        if (!this.player.active) {
            // Check if we have extra lives
            if (this.gameMode.loseLife()) {
                // Respawn player with remaining lives
                this.player.reset(CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
                this.shop.applyUpgrades(this.player);
                this.screenFx.flash('#ffffff', 0.3);
                this.floatingText.add(this.player.x, this.player.y - 40, `${this.gameMode.getLives()} LIVES LEFT`, {
                    color: '#ffdd00',
                    size: 14,
                    duration: 2000
                });
                // Brief invincibility after respawn
                this.player.invincibleTimer = 2000;
            } else {
                // No lives left - game over
                this.state = 'gameover';
                this.gameOverTimer = 1500; // 1.5 second delay before allowing restart
                this.audio.playGameOver();
                this.screenFx.shake(15, 0.5);
                this.screenFx.flash('#ff0000', 0.5, 0.02);
                this.particles.explosion(this.player.x, this.player.y, 2);
                // Reset input to prevent accidental immediate restart
                this.input.reset();
            }
        }
    }

    handleCollisions() {
        // Player bullets vs boss
        if (this.boss && this.boss.active) {
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;
                const bossBounds = this.boss.getBounds();
                const bulletBounds = bullet.getBounds();
                if (CollisionSystem.checkAABB(bossBounds, bulletBounds)) {
                    bullet.active = bullet.piercing || false;
                    const killed = this.boss.takeDamage(bullet.damage);
                    this.particles.spark(bullet.x, bullet.y, '#ffff00');
                    this.haptics.medium();

                    if (killed) {
                        this.onBossDefeated();
                    }
                }
            }
        }

        // Player bullets vs enemies
        CollisionSystem.checkBulletCollisions(
            this.playerBullets,
            this.enemies,
            (bullet, enemy) => {
                // Check if shield absorbed the hit
                const hadShield = enemy.shieldActive;
                const killed = enemy.takeDamage(bullet.damage);
                this.particles.spark(bullet.x, bullet.y, '#ffff00');

                // Play shield hit sound if shield absorbed
                if (hadShield && !killed) {
                    this.audio.playShieldHit();
                }

                if (killed) {
                    // Apply combo and multipliers
                    const comboMult = this.combo.addKill();
                    const goldMult = this.gameMode.getGoldMultiplier() * this.powerUpManager.getGoldMultiplier() * this.combo.getGoldMultiplier();

                    this.score += Math.floor(enemy.score * comboMult);
                    const goldEarned = Math.floor(enemy.gold * goldMult);
                    this.gold += goldEarned;
                    this.totalGold += goldEarned;
                    this.kills++;

                    // Floating text for gold earned
                    this.floatingText.gold(enemy.x, enemy.y, goldEarned);

                    // Show combo if notable
                    if (this.combo.count >= 5) {
                        this.floatingText.combo(enemy.x, enemy.y - 20, this.combo.count);
                    }

                    this.audio.playExplosion();
                    this.haptics.enemyKill();
                    this.particles.explosion(enemy.x, enemy.y, enemy.type === 'TANK' ? 1.5 : 1);
                    this.screenFx.shake(3, 0.15);

                    // Chance to drop power-up
                    if (Math.random() < 0.08) {
                        this.spawnPowerUp(enemy.x, enemy.y);
                    }

                    // Bonus: small flash on kill
                    if (enemy.type === 'TANK' || enemy.type === 'CARRIER') {
                        this.screenFx.flash('#ff8800', 0.15, 0.05);
                    }
                }
            }
        );

        // Player bullets vs rings
        CollisionSystem.checkBulletRingCollisions(
            this.playerBullets,
            this.rings,
            (bullet, ring) => {
                if (ring.increaseValue()) {
                    this.audio.playRingIncrease();
                    this.particles.spark(bullet.x, bullet.y, '#ffdd00');
                    this.floatingText.ringIncrease(ring.x, ring.y - 15, ring.value);
                }
            }
        );

        // Player vs rings
        CollisionSystem.checkEntityRingCollisions(
            [this.player],
            this.rings,
            (player, ring) => {
                // Handle multiplier gates (x2 or /2)
                if (ring.isMultiplierGate()) {
                    ring.collect();
                    this.ringsCollected++;
                    const currentAllies = this.allies.filter(a => a.active).length;

                    if (ring.gateType === 'multiply') {
                        // x2 gate - double allies
                        this.audio.playPowerUp();
                        this.particles.ringCollect(ring.x, ring.y, true);
                        this.screenFx.flash('#ffdd00', 0.2, 0.04);
                        this.haptics.allyJoin();

                        const toAdd = currentAllies; // Double means add same amount
                        for (let i = 0; i < toAdd; i++) {
                            const ally = new Ally(this.allies.length);
                            ally.setSpawnPosition(ring.x, ring.y);
                            this.allies.push(ally);
                            this.alliesRecruited++;
                        }
                        if (toAdd > 0) {
                            this.particles.allyJoin(ring.x, ring.y);
                            this.floatingText.add(ring.x, ring.y - 20, `x2 = +${toAdd}`, {
                                color: '#ffdd00',
                                size: 14,
                                duration: 1500
                            });
                        } else {
                            this.floatingText.add(ring.x, ring.y - 20, 'x2', {
                                color: '#ffdd00',
                                size: 14,
                                duration: 1000
                            });
                        }
                    } else {
                        // /2 gate - halve allies
                        this.audio.playAllyLost();
                        this.particles.ringCollect(ring.x, ring.y, false);
                        this.screenFx.shake(6, 0.3);
                        this.screenFx.flash('#aa2222', 0.2, 0.04);
                        this.haptics.allyLost();

                        const toRemove = Math.floor(currentAllies / 2);
                        let removed = 0;
                        for (let i = this.allies.length - 1; i >= 0 && removed < toRemove; i--) {
                            if (this.allies[i].active) {
                                this.particles.allyLost(this.allies[i].x, this.allies[i].y);
                                this.allies[i].active = false;
                                removed++;
                            }
                        }
                        this.formation.reassignFormations(this.allies);
                        this.floatingText.add(ring.x, ring.y - 20, `/2 = -${removed}`, {
                            color: '#ff4444',
                            size: 14,
                            duration: 1500
                        });
                    }
                    return;
                }

                // Normal ring handling
                const value = ring.collect();
                this.ringsCollected++;
                this.haptics.ringCollect();

                if (value >= 0) {
                    this.audio.playRingCollect();
                    this.particles.ringCollect(ring.x, ring.y, true);
                    this.screenFx.flash('#ffdd00', 0.1, 0.04);

                    for (let i = 0; i < value; i++) {
                        const ally = new Ally(this.allies.length);
                        ally.setSpawnPosition(ring.x, ring.y);
                        this.allies.push(ally);
                        this.alliesRecruited++;
                        this.particles.allyJoin(ring.x, ring.y);
                    }
                    if (value > 0) {
                        this.audio.playAllyJoin();
                        this.haptics.allyJoin();
                        this.floatingText.allyGained(ring.x, ring.y, value);
                    }
                } else {
                    this.audio.playAllyLost();
                    this.particles.ringCollect(ring.x, ring.y, false);
                    this.screenFx.shake(4, 0.2);
                    this.screenFx.flash('#ff4466', 0.15, 0.04);
                    this.haptics.allyLost();

                    const toRemove = Math.min(Math.abs(value), this.allies.filter(a => a.active).length);
                    let removed = 0;
                    for (let i = this.allies.length - 1; i >= 0 && removed < toRemove; i--) {
                        if (this.allies[i].active) {
                            this.particles.allyLost(this.allies[i].x, this.allies[i].y);
                            this.allies[i].active = false;
                            removed++;
                        }
                    }
                    this.formation.reassignFormations(this.allies);
                    this.floatingText.allyLost(ring.x, ring.y, removed);
                }
            }
        );

        // Player vs power-ups
        for (const powerUp of this.powerUps) {
            if (!powerUp.active) continue;
            const playerBounds = this.player.getBounds();
            const powerUpBounds = powerUp.getBounds();
            if (CollisionSystem.checkAABB(playerBounds, powerUpBounds)) {
                const collected = powerUp.collect();
                this.applyPowerUp(collected.type, collected.duration);
            }
        }

        // Enemy bullets vs player/allies
        CollisionSystem.checkEnemyBulletCollisions(
            this.enemyBullets,
            this.player,
            this.allies,
            (bullet) => {
                // Check for shield power-up
                if (this.powerUpManager.consumeShieldHit()) {
                    this.audio.playPowerUp();
                    this.particles.spark(this.player.x, this.player.y, '#00ffff');
                    this.haptics.light();
                    return;
                }

                // Check for invincibility (practice mode)
                if (this.gameMode.isInvincible()) {
                    return;
                }

                const died = this.player.takeDamage(bullet.damage);
                this.audio.playDamage();
                this.haptics.playerHit();
                this.particles.damageHit(this.player.x, this.player.y);
                this.screenFx.shake(4, 0.1);
                this.screenFx.flash('#ff0000', 0.2, 0.06);
                this.floatingText.damage(this.player.x, this.player.y - 20, bullet.damage);

                if (died) {
                    this.particles.explosion(this.player.x, this.player.y, 1.5);
                }
            },
            (bullet, ally) => {
                // Check for ally shield power-up
                if (this.powerUpManager.hasAllyShield()) {
                    this.particles.spark(ally.x, ally.y, '#00ff88');
                    return;
                }

                const died = ally.takeDamage(bullet.damage);
                this.audio.playDamage();
                this.particles.spark(ally.x, ally.y, '#ff6666');

                if (died) {
                    this.particles.explosion(ally.x, ally.y, 0.5);
                    this.formation.reassignFormations(this.allies);
                }
            }
        );

        // Enemy collision with player/allies
        CollisionSystem.checkEnemyEntityCollisions(
            this.enemies,
            this.player,
            this.allies,
            (enemy) => {
                // Skip collision during entry animation
                if (enemy.entering) return;
                if (enemy.onScreen) {
                    // Check for invincibility (practice mode)
                    if (!this.gameMode.isInvincible()) {
                        // Use enemy's ramDamage if available (e.g., BUS), otherwise default 30
                        const damage = enemy.ramDamage || 30;
                        this.player.takeDamage(damage);
                        this.audio.playDamage();
                        this.screenFx.shake(8, 0.2);
                        this.screenFx.flash('#ff4400', 0.25, 0.04);
                    }
                    enemy.takeDamage(enemy.health);
                    this.audio.playExplosion();
                    this.particles.explosion(enemy.x, enemy.y, 1);
                }
            },
            (enemy, ally) => {
                // Skip collision during entry animation
                if (enemy.entering) return;
                if (enemy.onScreen) {
                    ally.takeDamage(ally.health);
                    // BUS barely takes damage from ramming allies - it's a tank
                    const selfDamage = enemy.type === 'BUS' ? 1 : 20;
                    enemy.takeDamage(selfDamage);
                    this.audio.playExplosion();
                    this.particles.explosion(ally.x, ally.y, 0.6);
                    this.formation.reassignFormations(this.allies);
                }
            }
        );

        // Wall collisions (Wall Mode or custom levels with walls)
        if ((this.gameMode.getRules().hasWalls || this.walls.length > 0) && this.walls.length > 0) {
            // Player bullets vs walls (with effects for destructible/pushable)
            CollisionSystem.checkPlayerBulletWallCollisions(this.playerBullets, this.walls, (bullet, wall, destroyed) => {
                this.particles.spark(bullet.x, bullet.y, wall.typeData.stripeColor);
                if (destroyed) {
                    this.particles.explosion(wall.x, wall.y, 0.8);
                    this.audio.playExplosion();
                    this.floatingText.add(wall.x, wall.y, 'DESTROYED', '#ffff00', 12);
                }
            });

            // Enemy bullets vs walls
            CollisionSystem.checkEnemyBulletWallCollisions(this.enemyBullets, this.walls, (bullet, wall) => {
                this.particles.spark(bullet.x, bullet.y, '#ff6666');
            });

            // Wall-to-wall collisions (for pushable walls hitting solid walls)
            CollisionSystem.checkWallWallCollisions(this.walls);

            // Player vs wall collision (death or boost)
            const wallResult = CollisionSystem.checkPlayerWallCollision(this.player, this.walls);
            if (wallResult.hit) {
                if (!this.gameMode.isInvincible()) {
                    this.player.health = 0;
                    this.player.active = false;
                    this.audio.playExplosion();
                    this.particles.explosion(this.player.x, this.player.y, 2);
                    this.screenFx.shake(20, 0.5);
                    this.screenFx.flash('#ff0000', 0.4, 0.05);
                    this.haptics.heavy();
                }
            } else if (wallResult.boost && wallResult.wall && !wallResult.wall.boostCollected) {
                // Apply boost effect - stacks! Only trigger once per wall.
                wallResult.wall.boostCollected = true;
                wallResult.wall.active = false; // Despawn boost pad after collection

                const boostAmount = wallResult.wall.getBoostAmount();
                this.player.applyBoost(boostAmount);

                // Golden boost special effects (Chase mode)
                if (wallResult.wall.typeData.isGolden) {
                    this.playerInvincible = true;
                    this.playerInvincibilityTimer = wallResult.wall.typeData.invincibilityDuration;

                    if (this.redBox) {
                        this.redBox.reset();
                    }

                    this.particles.explosion(this.player.x, this.player.y, 3, '#ffdd00');
                    this.screenFx.flash('#ffdd00', 0.5);
                    this.haptics.heavy();
                    this.audio.playPowerUp();

                    this.floatingText.add(this.player.x, this.player.y - 40, 'GOLDEN BOOST!', {
                        color: '#ffdd00',
                        size: 16,
                        duration: 2000
                    });
                } else {
                    // Regular boost - red box shrinks gradually based on player boost level
                    this.particles.spark(this.player.x, this.player.y, '#44ff44');
                    this.haptics.light();

                    // Show speed multiplier
                    const speedMult = this.player.getSpeedMultiplier() + this.powerUpSpeedBonus;
                    this.floatingText.add(this.player.x, this.player.y - 30, `${speedMult.toFixed(1)}x SPEED`, {
                        color: '#88ff88',
                        size: 12,
                        duration: 800
                    });
                }
            }

            // Allies destroyed by blocking walls
            let alliesLost = false;
            CollisionSystem.checkAllyWallCollisions(this.allies, this.walls, (ally, wall) => {
                ally.active = false;
                this.particles.explosion(ally.x, ally.y, 0.4);
                alliesLost = true;
            });
            if (alliesLost) {
                this.formation.reassignFormations(this.allies);
            }
        }

        // Chase mode collisions
        const rules = this.gameMode.getRules();
        if (rules.isChase) {
            // Player bullets vs cargo ship engines
            for (let i = this.playerBullets.length - 1; i >= 0; i--) {
                const bullet = this.playerBullets[i];
                if (!bullet.active) continue;

                for (const ship of this.cargoShips) {
                    if (!ship.active) continue;

                    const bulletBounds = bullet.getBounds();

                    // Check if engine still exists and can be hit
                    if (!ship.engineDestroyed) {
                        const engineBounds = ship.getEngineBounds();
                        if (CollisionSystem.checkAABB(bulletBounds, engineBounds)) {
                            bullet.active = false;
                            const destroyed = ship.takeDamage(bullet.damage || 10, bullet.x, bullet.y);

                            if (destroyed) {
                                this.score += CONFIG.CHASE_MODE.cargoShipScore;
                                this.audio.playExplosion();
                                this.particles.explosion(ship.x, ship.y + 30, 1);
                                this.floatingText.add(ship.x, ship.y, '+50', {
                                    color: '#ffff00',
                                    size: 12
                                });
                            }
                            break;
                        }
                    } else {
                        // Ship is destroyed - apply rotational impulse when hit
                        const shipBounds = ship.getBounds();
                        if (CollisionSystem.checkAABB(bulletBounds, shipBounds)) {
                            bullet.active = false;
                            ship.applyHitImpulse(bullet.x, bullet.y);
                            this.particles.spark(bullet.x, bullet.y, '#ff9900');
                            break;
                        }
                    }
                }
            }

            // Cargo ships vs red box
            for (let i = this.cargoShips.length - 1; i >= 0; i--) {
                const ship = this.cargoShips[i];
                if (!ship.active) continue;

                if (ship.checkRedBoxCollision(this.redBox)) {
                    this.cargoShips.splice(i, 1);
                    this.redBox.takeDamage(1);
                    this.redBoxSlowdownTimer = CONFIG.CHASE_MODE.redBoxSlowDuration;

                    this.particles.explosion(ship.x, ship.y, 1);
                    this.screenFx.flash('#ffffff', 0.2);
                    this.audio.playExplosion();
                }
            }

            // Boost pads vs red box - destroy pads that touch red box
            if (this.redBox) {
                for (let i = this.walls.length - 1; i >= 0; i--) {
                    const wall = this.walls[i];
                    if (!wall.active) continue;
                    if (!wall.typeData.boosts) continue; // Only check boost pads

                    const wallBounds = wall.getBounds();
                    const boxBounds = this.redBox.getBounds();

                    // Check if wall touches red box
                    if (wallBounds.y + wallBounds.height >= boxBounds.y) {
                        this.walls.splice(i, 1);
                        this.particles.spark(wall.x, boxBounds.y, '#ff4444');
                    }
                }
            }

            // Player vs cargo ships
            for (const ship of this.cargoShips) {
                if (!ship.active) continue;

                const playerBounds = this.player.getBounds();
                const shipBounds = ship.getBounds();

                if (CollisionSystem.checkAABB(playerBounds, shipBounds)) {
                    if (!this.playerInvincible) {
                        this.player.takeDamage(CONFIG.CHASE_MODE.cargoShipDamage);
                        this.audio.playDamage();
                        this.haptics.playerHit();
                        this.particles.damageHit(this.player.x, this.player.y);
                        this.screenFx.shake(8, 0.2);
                    }
                }
            }
        }

        // Swarm mode collisions
        if (rules.isSwarm) {
            // Player bullets vs swarm enemies
            for (let i = this.playerBullets.length - 1; i >= 0; i--) {
                const bullet = this.playerBullets[i];
                if (!bullet.active) continue;

                for (const enemy of this.swarmEnemies) {
                    if (!enemy.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), enemy.getBounds())) {
                        bullet.active = false;
                        enemy.takeDamage();
                        this.score += 10;

                        // Rocket splash damage
                        if (bullet.isRocket && bullet.splashRadius) {
                            this.particles.explosion(enemy.x, enemy.y, 2);
                            this.audio.playExplosion();
                            this.screenFx.shake(5, 0.2);

                            // Visual explosion radius indicator
                            this.rocketExplosions.push({
                                x: enemy.x,
                                y: enemy.y,
                                radius: 0,
                                maxRadius: bullet.splashRadius,
                                alpha: 1.0,
                                time: 0
                            });

                            // Damage all enemies in splash radius
                            for (let j = this.swarmEnemies.length - 1; j >= 0; j--) {
                                const splashEnemy = this.swarmEnemies[j];
                                if (!splashEnemy.active) continue;
                                const dx = splashEnemy.x - enemy.x;
                                const dy = splashEnemy.y - enemy.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist <= bullet.splashRadius) {
                                    splashEnemy.takeDamage();
                                    this.score += 10;
                                    this.particles.spark(splashEnemy.x, splashEnemy.y, '#ff9900');
                                }
                            }
                        } else {
                            this.particles.spark(enemy.x, enemy.y, '#ff6666');
                        }
                        break;
                    }
                }
            }

            // Player bullets vs swarm bosses
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;

                for (const boss of this.swarmBosses) {
                    if (!boss.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), boss.getBounds())) {
                        bullet.active = false;
                        const killed = boss.takeDamage(1);  // Always 1 damage per hit (hit counter)
                        if (killed) {
                            this.score += 1000;
                            this.particles.explosion(boss.x, boss.y, 3);
                            this.audio.playExplosion();
                            this.screenFx.shake(10, 0.3);
                        }
                        break;
                    }
                }
            }

            // Player bullets vs powerup crates
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;

                for (const crate of this.powerupCrates) {
                    if (!crate.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), crate.getBounds())) {
                        bullet.active = false;
                        const unlocked = crate.takeDamage();
                        if (unlocked) {
                            this.unlockPermanentUpgrade(crate.type);
                            this.particles.explosion(crate.x, crate.y, 2);
                            this.audio.playPowerUp();
                            this.screenFx.flash('#ffaa00', 0.2);
                        }
                        break;
                    }
                }
            }

            // Player bullets vs push walls (count hits and push)
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;

                for (const wall of this.pushWalls) {
                    if (!wall.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), wall.getBounds())) {
                        bullet.active = false;

                        if (!wall.triggered) {
                            // Count hits until triggered
                            const triggered = wall.registerBulletHit();
                            if (triggered) {
                                this.audio.playPowerUp();
                                this.screenFx.shake(5, 0.2);
                            }
                        } else {
                            // After triggered, continue pushing
                            wall.push(2);
                        }
                        break;
                    }
                }
            }

            // Multiplier gate bullet duplication
            for (const gate of this.multiplierGates) {
                // Store the current bullet count to avoid processing newly created bullets in the same frame
                const bulletCount = this.playerBullets.length;
                for (let i = 0; i < bulletCount; i++) {
                    const bullet = this.playerBullets[i];
                    if (!bullet.active || bullet.duplicated) continue;

                    if (gate.checkBulletPassThrough(bullet)) {
                        bullet.duplicated = true;  // Mark to prevent re-duplication

                        // Create duplicates with offset
                        for (let j = 1; j < gate.multiplier; j++) {
                            const offset = j * 8 - (gate.multiplier - 1) * 4;  // Spread them out
                            const newBullet = new (Object.getPrototypeOf(bullet).constructor)(
                                bullet.x + offset,
                                bullet.y,
                                true,
                                bullet.damage,
                                bullet.vx,
                                bullet.vy
                            );
                            newBullet.canBounce = true;
                            newBullet.duplicated = true;  // Mark new bullets as duplicated too
                            this.playerBullets.push(newBullet);
                        }

                        this.particles.spark(gate.x, gate.y, '#dd88ff');
                    }
                }
            }

            // Push walls vs enemies (kill on contact)
            for (const wall of this.pushWalls) {
                if (!wall.triggered || wall.pushVelocity <= 0) continue;

                for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                    const enemy = this.swarmEnemies[i];
                    if (CollisionSystem.checkAABB(wall.getBounds(), enemy.getBounds())) {
                        this.swarmEnemies.splice(i, 1);
                        this.particles.explosion(enemy.x, enemy.y, 1);
                        this.score += 10;
                    }
                }

                for (const boss of this.swarmBosses) {
                    if (CollisionSystem.checkAABB(wall.getBounds(), boss.getBounds())) {
                        // Deal 50% of max health as damage instead of instant kill
                        const damage = Math.floor(boss.maxHealth * 0.5);
                        const killed = boss.takeDamage(damage);
                        if (killed) {
                            this.score += 1000;
                            this.particles.explosion(boss.x, boss.y, 3);
                            this.audio.playExplosion();
                            this.screenFx.shake(10, 0.3);
                        } else {
                            this.particles.spark(boss.x, boss.y, '#ff9900');
                        }
                    }
                }
            }

            // Swarm enemies vs player (deal 1 damage, die)
            for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                const enemy = this.swarmEnemies[i];
                if (CollisionSystem.checkAABB(this.player.getBounds(), enemy.getBounds())) {
                    this.swarmEnemies.splice(i, 1);
                    this.swarmLives--;
                    this.particles.damageHit(this.player.x, this.player.y);
                    this.audio.playDamage();
                    this.screenFx.shake(10, 0.3);
                    this.floatingText.add(this.player.x, this.player.y - 40, `${this.swarmLives} LIVES`, {
                        color: '#ffdd00',
                        size: 14,
                        duration: 1000
                    });

                    if (this.swarmLives <= 0) {
                        this.player.active = false;
                        this.state = 'gameover';
                    }
                }
            }

            // Swarm boss vs player (instant kill)
            for (const boss of this.swarmBosses) {
                if (CollisionSystem.checkAABB(this.player.getBounds(), boss.getBounds())) {
                    this.player.active = false;
                    this.state = 'gameover';
                    this.particles.explosion(this.player.x, this.player.y, 3);
                    this.audio.playExplosion();
                    this.screenFx.shake(30, 1.0);
                }
            }
        }

        // Chase Swarm mode collisions
        if (rules.isChaseSwarm) {
            // Player bullets vs swarm enemies
            for (let i = this.playerBullets.length - 1; i >= 0; i--) {
                const bullet = this.playerBullets[i];
                if (!bullet.active) continue;

                for (const enemy of this.swarmEnemies) {
                    if (!enemy.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), enemy.getBounds())) {
                        bullet.active = false;
                        enemy.takeDamage();
                        this.score += 10;

                        // Rocket splash damage
                        if (bullet.isRocket && bullet.splashRadius) {
                            this.particles.explosion(enemy.x, enemy.y, 2);
                            this.audio.playExplosion();
                            this.screenFx.shake(5, 0.2);

                            // Visual explosion radius indicator
                            this.rocketExplosions.push({
                                x: enemy.x,
                                y: enemy.y,
                                radius: 0,
                                maxRadius: bullet.splashRadius,
                                alpha: 1.0,
                                time: 0
                            });

                            // Damage all enemies in splash radius
                            for (let j = this.swarmEnemies.length - 1; j >= 0; j--) {
                                const splashEnemy = this.swarmEnemies[j];
                                if (!splashEnemy.active) continue;
                                const dx = splashEnemy.x - enemy.x;
                                const dy = splashEnemy.y - enemy.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist <= bullet.splashRadius) {
                                    splashEnemy.takeDamage();
                                    this.score += 10;
                                    this.particles.spark(splashEnemy.x, splashEnemy.y, '#ff9900');
                                }
                            }
                        } else {
                            this.particles.spark(enemy.x, enemy.y, '#ff6666');
                        }
                        break;
                    }
                }
            }

            // Player bullets vs swarm bosses
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;

                for (const boss of this.swarmBosses) {
                    if (!boss.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), boss.getBounds())) {
                        bullet.active = false;
                        const killed = boss.takeDamage(1);
                        if (killed) {
                            this.score += 1000;
                            this.particles.explosion(boss.x, boss.y, 3);
                            this.audio.playExplosion();
                            this.screenFx.shake(10, 0.3);
                        }
                        break;
                    }
                }
            }

            // Player bullets vs cargo ship engines (ONLY engines)
            for (let i = this.playerBullets.length - 1; i >= 0; i--) {
                const bullet = this.playerBullets[i];
                if (!bullet.active) continue;

                for (const ship of this.cargoShips) {
                    if (!ship.active) continue;

                    const bulletBounds = bullet.getBounds();

                    // Check if engine still exists and can be hit
                    if (!ship.engineDestroyed) {
                        const engineBounds = ship.getEngineBounds();
                        if (CollisionSystem.checkAABB(bulletBounds, engineBounds)) {
                            bullet.active = false;
                            const destroyed = ship.takeDamage(bullet.damage || 10, bullet.x, bullet.y);
                            if (destroyed) {
                                this.score += 50;
                                this.particles.explosion(ship.x, ship.y, 2);
                                this.audio.playExplosion();
                            }
                            break;
                        }
                    } else {
                        // Ship is destroyed - apply rotational impulse when hit
                        const shipBounds = ship.getBounds();
                        if (CollisionSystem.checkAABB(bulletBounds, shipBounds)) {
                            bullet.active = false;
                            ship.applyHitImpulse(bullet.x, bullet.y);
                            this.particles.spark(bullet.x, bullet.y, '#ff9900');
                            break;
                        }
                    }
                }
            }

            // Player bullets vs powerup crates
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;

                for (const crate of this.powerupCrates) {
                    if (!crate.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), crate.getBounds())) {
                        bullet.active = false;
                        const unlocked = crate.takeDamage();
                        if (unlocked) {
                            this.unlockPermanentUpgrade(crate.type);
                            this.particles.explosion(crate.x, crate.y, 2);
                            this.audio.playPowerUp();
                            this.screenFx.flash('#ffaa00', 0.2);
                        }
                        break;
                    }
                }
            }

            // Player bullets vs push walls (count hits and push)
            for (const bullet of this.playerBullets) {
                if (!bullet.active) continue;

                for (const wall of this.pushWalls) {
                    if (!wall.active) continue;
                    if (CollisionSystem.checkAABB(bullet.getBounds(), wall.getBounds())) {
                        bullet.active = false;

                        if (!wall.triggered) {
                            const triggered = wall.registerBulletHit();
                            if (triggered) {
                                this.audio.playPowerUp();
                                this.screenFx.shake(5, 0.2);
                            }
                        } else {
                            wall.push(2);
                        }
                        break;
                    }
                }
            }

            // Push walls vs swarm enemies (kill on contact)
            for (const wall of this.pushWalls) {
                if (!wall.triggered || wall.pushVelocity <= 0) continue;

                for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                    const enemy = this.swarmEnemies[i];
                    if (CollisionSystem.checkAABB(wall.getBounds(), enemy.getBounds())) {
                        this.swarmEnemies.splice(i, 1);
                        this.particles.explosion(enemy.x, enemy.y, 1);
                        this.score += 10;
                    }
                }

                for (const boss of this.swarmBosses) {
                    if (CollisionSystem.checkAABB(wall.getBounds(), boss.getBounds())) {
                        // Deal 50% of max health as damage instead of instant kill
                        const damage = Math.floor(boss.maxHealth * 0.5);
                        const killed = boss.takeDamage(damage);
                        if (killed) {
                            this.score += 1000;
                            this.particles.explosion(boss.x, boss.y, 3);
                            this.audio.playExplosion();
                            this.screenFx.shake(10, 0.3);
                        } else {
                            this.particles.spark(boss.x, boss.y, '#ff9900');
                        }
                    }
                }
            }

            // Push walls vs cargo ship engines (destroy engine only)
            for (const wall of this.pushWalls) {
                if (!wall.triggered || wall.pushVelocity <= 0) continue;

                for (const ship of this.cargoShips) {
                    if (!ship.active || ship.engineDestroyed) continue;
                    const engineBounds = ship.getEngineBounds();
                    const wallBounds = wall.getBounds();
                    if (CollisionSystem.checkAABB(wallBounds, engineBounds)) {
                        // Pass wall center as hit position
                        const wallCenterX = wallBounds.x + wallBounds.width / 2;
                        const wallCenterY = wallBounds.y + wallBounds.height / 2;
                        ship.takeDamage(ship.engineHealth, wallCenterX, wallCenterY);  // Destroy engine
                        this.particles.explosion(ship.x, ship.y, 2);
                        this.audio.playExplosion();

                        // Apply initial spin from the push wall impact
                        ship.applyHitImpulse(wallCenterX, wallCenterY);
                    }
                }
            }

            // Multiplier gate bullet duplication
            for (const gate of this.multiplierGates) {
                // Store the current bullet count to avoid processing newly created bullets in the same frame
                const bulletCount = this.playerBullets.length;
                for (let i = 0; i < bulletCount; i++) {
                    const bullet = this.playerBullets[i];
                    if (!bullet.active || bullet.duplicated) continue;

                    if (gate.checkBulletPassThrough(bullet)) {
                        bullet.duplicated = true;  // Mark to prevent re-duplication

                        // Create duplicates with offset
                        for (let j = 1; j < gate.multiplier; j++) {
                            const offset = j * 8 - (gate.multiplier - 1) * 4;  // Spread them out
                            const newBullet = new (Object.getPrototypeOf(bullet).constructor)(
                                bullet.x + offset,
                                bullet.y,
                                true,
                                bullet.damage,
                                bullet.vx,
                                bullet.vy
                            );
                            newBullet.canBounce = true;
                            newBullet.duplicated = true;  // Mark new bullets as duplicated too
                            // Copy rocket properties if present
                            if (bullet.isRocket) {
                                newBullet.isRocket = true;
                                newBullet.splashRadius = bullet.splashRadius;
                            }
                            this.playerBullets.push(newBullet);
                        }

                        this.particles.spark(gate.x, gate.y, '#dd88ff');
                    }
                }
            }

            // Downward-firing bullets vs red box (push it down)
            for (let i = this.playerBullets.length - 1; i >= 0; i--) {
                const bullet = this.playerBullets[i];
                if (!bullet.active || !bullet.firingDown) continue;
                if (!this.redBox) continue;

                const bulletBounds = bullet.getBounds();
                const redBoxBounds = this.redBox.getBounds();
                if (CollisionSystem.checkAABB(bulletBounds, redBoxBounds)) {
                    bullet.active = false;

                    // Can't push if unstoppable
                    if (!this.redBox.unstoppable) {
                        const cfg = CONFIG.CHASE_SWARM_MODE;
                        this.redBox.y += cfg.redBoxPushAmount;
                        if (this.redBox.y > CONFIG.GAME_HEIGHT) {
                            this.redBox.y = CONFIG.GAME_HEIGHT;
                        }
                        this.particles.spark(bullet.x, bullet.y, '#44ff44');
                    } else {
                        // Bullets just disappear, no effect
                        this.particles.spark(bullet.x, bullet.y, '#ff0000');
                    }
                }
            }

            // Player vs red box (game over) - only if not already achieved victory
            if (this.redBox && this.redBox.checkPlayerCollision(this.player) && !this.victoryAchieved) {
                this.player.active = false;
                this.state = 'gameover';
                this.particles.explosion(this.player.x, this.player.y, 3);
                this.audio.playExplosion();
                this.screenFx.shake(30, 1.0);
            }

            // Cargo ships vs red box (push down or speed up based on engine state)
            for (let i = this.cargoShips.length - 1; i >= 0; i--) {
                const ship = this.cargoShips[i];
                if (!ship.active || !this.redBox) continue;

                if (ship.checkRedBoxCollision(this.redBox)) {
                    if (!this.redBox.unstoppable) {
                        if (ship.engineDestroyed) {
                            // Engine destroyed: push red box down
                            const cfg = CONFIG.CHASE_SWARM_MODE;
                            this.redBox.y += cfg.redBoxPushAmount;
                            if (this.redBox.y > CONFIG.GAME_HEIGHT) {
                                this.redBox.y = CONFIG.GAME_HEIGHT;
                            }
                            this.particles.explosion(ship.x, ship.y, 2);
                        } else {
                            // Engine intact: speed up red box
                            const cfg = CONFIG.CHASE_SWARM_MODE;
                            this.redBoxEnemySpeedBoost += cfg.enemySpeedBoost * 2;  // 2x boost for cargo ships
                        }
                    }
                    ship.active = false;
                }
            }

            // Swarm enemies vs player
            for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                const enemy = this.swarmEnemies[i];
                if (CollisionSystem.checkAABB(this.player.getBounds(), enemy.getBounds())) {
                    this.swarmEnemies.splice(i, 1);
                    this.swarmLives--;
                    this.particles.damageHit(this.player.x, this.player.y);
                    this.audio.playDamage();
                    this.screenFx.shake(10, 0.3);
                    this.floatingText.add(this.player.x, this.player.y - 40, `${this.swarmLives} LIVES`, {
                        color: '#ffdd00',
                        size: 14,
                        duration: 1000
                    });

                    if (this.swarmLives <= 0 && !this.victoryAchieved) {
                        this.player.active = false;
                        this.state = 'gameover';
                    }
                }
            }

            // Swarm boss vs player
            for (const boss of this.swarmBosses) {
                if (CollisionSystem.checkAABB(this.player.getBounds(), boss.getBounds()) && !this.victoryAchieved) {
                    this.player.active = false;
                    this.state = 'gameover';
                    this.particles.explosion(this.player.x, this.player.y, 3);
                    this.audio.playExplosion();
                    this.screenFx.shake(30, 1.0);
                }
            }

            // Falling cargo ships (engine destroyed) vs player
            for (const ship of this.cargoShips) {
                if (!ship.active || !ship.engineDestroyed) continue;
                if (CollisionSystem.checkAABB(this.player.getBounds(), ship.getBounds())) {
                    this.swarmLives--;
                    ship.active = false;
                    this.particles.explosion(ship.x, ship.y, 3);
                    this.audio.playExplosion();
                    this.screenFx.shake(15, 0.5);
                    this.floatingText.add(this.player.x, this.player.y - 40, `${this.swarmLives} LIVES`, {
                        color: '#ffdd00',
                        size: 14,
                        duration: 1000
                    });

                    if (this.swarmLives <= 0 && !this.victoryAchieved) {
                        this.player.active = false;
                        this.state = 'gameover';
                    }
                }
            }

            // Falling cargo ships (engine destroyed) vs swarm enemies
            for (const ship of this.cargoShips) {
                if (!ship.active || !ship.engineDestroyed) continue;

                for (let i = this.swarmEnemies.length - 1; i >= 0; i--) {
                    const enemy = this.swarmEnemies[i];
                    if (CollisionSystem.checkAABB(ship.getBounds(), enemy.getBounds())) {
                        this.swarmEnemies.splice(i, 1);
                        this.particles.explosion(enemy.x, enemy.y, 2);
                        this.score += 10;
                    }
                }
            }

            // Falling cargo ships pass through bosses (no collision)
        }
    }

    // Calculate ally damage multiplier based on total ally count
    // At 200 allies: 1x damage, at 400 allies: 2x damage
    getAllyDamageMultiplier() {
        const activeAllies = this.allies.filter(a => a.active).length;
        if (activeAllies <= CONFIG.ALLY_DAMAGE_SCALE_START) {
            return 1;
        }
        const excessAllies = activeAllies - CONFIG.ALLY_DAMAGE_SCALE_START;
        return 1 + excessAllies * CONFIG.ALLY_DAMAGE_SCALE_FACTOR;
    }

    // Play enemy type-specific shooting sounds
    playEnemyTypeSound(enemy) {
        if (enemy.isElite) {
            this.audio.playEliteShoot();
            return;
        }

        switch (enemy.type) {
            case 'TANK':
                this.audio.playTankShoot();
                break;
            case 'SNIPER':
                this.audio.playSniperShoot();
                break;
            case 'BOMBER':
                this.audio.playBomberShoot();
                break;
            case 'SHIELD':
                this.audio.playShieldShoot();
                break;
            default:
                this.audio.playEnemyShoot();
        }
    }

    cleanup() {
        this.playerBullets = this.playerBullets.filter(b => b.active);
        this.enemyBullets = this.enemyBullets.filter(b => b.active);
        this.enemies = this.enemies.filter(e => e.active);
        this.allies = this.allies.filter(a => a.active);
        this.rings = this.rings.filter(r => r.active);
        this.walls = this.walls.filter(w => w.active);
        this.powerUps = this.powerUps.filter(p => p.active);

        // Clean up boss
        if (this.boss && !this.boss.active) {
            this.boss = null;
            this.bossActive = false;
        }

        this.explosions = this.explosions.filter(exp => {
            exp.timer++;
            if (exp.timer > 5) {
                exp.timer = 0;
                exp.frame++;
            }
            return exp.frame < 4;
        });
    }

    // Boss methods
    spawnBoss() {
        const bossType = getBossForWave(this.currentWave);
        this.boss = new Boss(bossType, this.currentWave);
        this.bossActive = true;
        this.waveAnnouncement = `BOSS: ${this.boss.typeData.name}`;
        this.waveAnnouncementTimer = 3000;
        this.music.startBossMusic();
        this.haptics.bossAppear();
        this.screenFx.shake(10, 0.5);
        this.screenFx.flash('#ff0000', 0.3, 0.02);
    }

    updateBossAttacks(currentTime) {
        if (!this.boss || !this.boss.active || this.boss.entering) return;

        if (this.boss.shouldAttack()) {
            const attackType = this.boss.getAttack();
            const positions = this.boss.getGunPositions();

            switch (attackType) {
                case 'spread':
                    BossAttacks.spread(this.boss, this.enemyBullets, (x, y, isPlayer, damage) => {
                        // Create boss bullet with proper properties for collision detection
                        const bullet = {
                            x, y,
                            vx: 0,
                            vy: CONFIG.BOSS_BULLET_SPEED,
                            damage: damage || CONFIG.BOSS_BULLET_DAMAGE,
                            active: true,
                            isPlayer: false,
                            isPlayerBullet: false, // Required for collision system
                            update(dt) {
                                this.x += this.vx * dt;
                                this.y += this.vy * dt;
                                if (this.y > CONFIG.GAME_HEIGHT + 20) this.active = false;
                            },
                            draw(renderer) {
                                renderer.ctx.fillStyle = '#ff6666';
                                renderer.ctx.fillRect(this.x - 2, this.y - 4, 4, 8);
                            },
                            getBounds() {
                                return { x: this.x - 2, y: this.y - 4, width: 4, height: 8 };
                            }
                        };
                        return bullet;
                    });
                    break;
                case 'missiles':
                    // Queue missiles with game-time delays instead of setTimeout
                    positions.forEach((pos, i) => {
                        this.pendingBossBullets.push({
                            delay: i * CONFIG.BOSS_MISSILE_DELAY, // ms until spawn
                            spawnX: pos.x,
                            spawnY: pos.y,
                            targetX: this.player.x,
                            targetY: this.player.y
                        });
                    });
                    break;
                case 'spawn':
                    for (let i = 0; i < 3; i++) {
                        const x = this.boss.x - 60 + i * 60;
                        this.spawnEnemy(x, this.boss.y + 50, 'DRONE');
                    }
                    break;
            }
            this.audio.playEnemyShoot();
        }
    }

    /**
     * Process pending boss bullets using game-time scheduling
     * Replaces setTimeout for frame-perfect timing
     */
    processPendingBossBullets(deltaTime) {
        if (this.pendingBossBullets.length === 0) return;

        // Process each pending bullet
        for (let i = this.pendingBossBullets.length - 1; i >= 0; i--) {
            const pending = this.pendingBossBullets[i];
            pending.delay -= deltaTime;

            // Spawn when delay reaches zero
            if (pending.delay <= 0) {
                // Only spawn if boss is still active
                if (this.boss && this.boss.active) {
                    this.enemyBullets.push({
                        x: pending.spawnX,
                        y: pending.spawnY,
                        vx: 0,
                        vy: 2,
                        targetX: pending.targetX,
                        targetY: pending.targetY,
                        homing: true,
                        damage: 20,
                        active: true,
                        isPlayer: false,
                        isPlayerBullet: false,
                        update(dt) {
                            if (this.homing) {
                                const dx = this.targetX - this.x;
                                const dy = this.targetY - this.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist > 0) {
                                    this.vx += (dx / dist) * 0.15 * dt;
                                    this.vy += (dy / dist) * 0.15 * dt;
                                }
                            }
                            this.x += this.vx * dt;
                            this.y += this.vy * dt;
                            if (this.y > CONFIG.GAME_HEIGHT + 20) this.active = false;
                        },
                        draw(renderer) {
                            renderer.ctx.fillStyle = '#ff8800';
                            renderer.ctx.fillRect(this.x - 3, this.y - 5, 6, 10);
                        },
                        getBounds() {
                            return { x: this.x - 3, y: this.y - 5, width: 6, height: 10 };
                        }
                    });
                }
                // Remove from queue
                this.pendingBossBullets.splice(i, 1);
            }
        }
    }

    onBossDefeated() {
        this.bossDefeated = true;
        const bossGold = this.boss.typeData.goldReward;
        this.score += bossGold * 10;
        this.gold += bossGold;
        this.totalGold += bossGold;

        // Floating text for boss gold
        this.floatingText.gold(this.boss.x, this.boss.y - 40, bossGold);
        this.floatingText.add(this.boss.x, this.boss.y - 60, 'BOSS DEFEATED!', {
            color: '#ff8800',
            size: 18,
            duration: 2000,
            outline: true
        });

        // Big explosion
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (this.boss) {
                    const ox = (Math.random() - 0.5) * this.boss.width;
                    const oy = (Math.random() - 0.5) * this.boss.height;
                    this.particles.explosion(this.boss.x + ox, this.boss.y + oy, 1.5);
                    this.audio.playExplosion();
                }
            }, i * 150);
        }

        this.haptics.bossDefeated();
        this.screenFx.shake(15, 0.5);
        this.screenFx.flash('#ffffff', 0.5, 0.03);
        this.music.startNormalMusic();

        // Drop multiple power-ups
        for (let i = 0; i < 3; i++) {
            this.spawnPowerUp(
                this.boss.x + (Math.random() - 0.5) * 100,
                this.boss.y + (Math.random() - 0.5) * 50
            );
        }
    }

    // Power-up methods
    spawnPowerUp(x, y, type = null) {
        const powerUp = new PowerUp(x, y, type);
        this.powerUps.push(powerUp);
    }

    applyPowerUp(type, duration) {
        this.audio.playPowerUp();
        this.haptics.doubleTap();
        this.screenFx.flash(POWERUP_TYPES[type].color, 0.2, 0.05);
        this.particles.ringCollect(this.player.x, this.player.y, true);

        switch (type) {
            case 'NUKE':
                // Destroy all enemies
                this.haptics.nuke();
                this.screenFx.flash('#ffffff', 0.8, 0.03);
                this.screenFx.shake(10, 0.3);
                for (const enemy of this.enemies) {
                    if (enemy.active) {
                        this.particles.explosion(enemy.x, enemy.y, 0.8);
                        this.score += enemy.score;
                        this.gold += enemy.gold;
                        this.totalGold += enemy.gold;
                        this.kills++;
                        enemy.active = false;
                    }
                }
                this.audio.playExplosion();
                break;

            case 'HEAL':
                const healAmount = 30;
                this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount);
                this.floatingText.heal(this.player.x, this.player.y - 20, healAmount);
                break;

            default:
                this.powerUpManager.activate(type, duration);
        }
    }

    // Swarm mode permanent upgrade unlocking
    unlockPermanentUpgrade(type) {
        switch (type) {
            case 'wingman':
                this.permanentUpgrades.wingmen++;
                // Spawn a new ally
                const ally = new Ally(this.allies.length);
                ally.setSpawnPosition(this.player.x, this.player.y);
                this.allies.push(ally);
                this.alliesRecruited++;
                this.floatingText.add(this.player.x, this.player.y - 40, 'WINGMAN!', {
                    color: '#00ff88',
                    size: 16
                });
                this.particles.allyJoin(this.player.x, this.player.y);
                break;

            case 'spreadshot':
                this.permanentUpgrades.hasSpreadShot = true;
                this.floatingText.add(this.player.x, this.player.y - 40, 'SPREAD SHOT!', {
                    color: '#ffaa00',
                    size: 16
                });
                break;

            case 'rocket':
                this.permanentUpgrades.hasRocketLauncher = true;
                this.floatingText.add(this.player.x, this.player.y - 40, 'ROCKET LAUNCHER!', {
                    color: '#ff3300',
                    size: 16
                });
                this.screenFx.flash('#ff3300', 0.3);
                break;
        }

        // In Chase Swarm mode, increase game speed by 3% for each power-up collected
        if (this.gameMode.getRules().isChaseSwarm) {
            this.powerUpSpeedBonus += 0.03;
        }

        this.audio.playPowerUp();
    }

    render() {
        const ctx = this.canvas.getContext('2d');

        // Save context state
        ctx.save();

        // Apply screen shake
        this.screenFx.applyShake(ctx);

        // Clear screen (includes stars)
        this.renderer.clear();

        // Draw particles (behind entities)
        this.particles.draw(ctx);

        // Draw floating text
        this.floatingText.draw(ctx);

        // Draw red box (Chase mode - lowest layer)
        if (this.redBox && this.redBox.active) {
            this.redBox.draw(this.renderer);
        }

        // Draw rings
        for (const ring of this.rings) {
            ring.draw(this.renderer);
        }

        // Draw walls
        for (const wall of this.walls) {
            wall.draw(this.renderer);
        }

        // Draw power-ups
        for (const powerUp of this.powerUps) {
            powerUp.draw(this.renderer);
        }

        // Draw bullets
        for (const bullet of this.playerBullets) {
            bullet.draw(this.renderer);
        }
        for (const bullet of this.enemyBullets) {
            if (bullet.draw) bullet.draw(this.renderer);
        }

        // Draw enemies
        for (const enemy of this.enemies) {
            enemy.draw(this.renderer);
        }

        // Draw boss
        if (this.boss && this.boss.active) {
            this.boss.draw(this.renderer);
        }

        // Draw cargo ships (Chase mode)
        for (const ship of this.cargoShips) {
            if (ship.active) {
                ship.draw(this.renderer);
            }
        }

        // Draw Swarm mode entities
        const rules = this.gameMode.getRules();
        if (rules.isSwarm) {
            // Draw multiplier gates (lowest layer)
            for (const gate of this.multiplierGates) {
                gate.draw(this.renderer);
            }

            // Draw swarm enemies (below push walls and powerups)
            for (const enemy of this.swarmEnemies) {
                enemy.draw(this.renderer);
            }

            // Draw swarm bosses
            for (const boss of this.swarmBosses) {
                boss.draw(this.renderer);
            }

            // Draw push walls
            for (const wall of this.pushWalls) {
                wall.draw(this.renderer);
            }

            // Draw powerup crates
            for (const crate of this.powerupCrates) {
                crate.draw(this.renderer);
            }

            // Draw rocket explosion radius indicators
            const ctx = this.renderer.ctx;
            for (const explosion of this.rocketExplosions) {
                ctx.save();
                ctx.strokeStyle = `rgba(255, 100, 0, ${explosion.alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
                ctx.stroke();

                // Inner ring for more visibility
                ctx.strokeStyle = `rgba(255, 200, 100, ${explosion.alpha * 0.6})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, explosion.radius * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Draw Chase Swarm mode entities
        if (rules.isChaseSwarm) {
            // Draw red box (lowest layer)
            if (this.redBox) {
                this.redBox.draw(this.renderer);
            }

            // Draw cargo ships
            for (const ship of this.cargoShips) {
                ship.draw(this.renderer);
            }

            // Draw multiplier gates (lowest layer)
            for (const gate of this.multiplierGates) {
                gate.draw(this.renderer);
            }

            // Draw swarm enemies (below push walls and powerups)
            for (const enemy of this.swarmEnemies) {
                enemy.draw(this.renderer);
            }

            // Draw swarm bosses
            for (const boss of this.swarmBosses) {
                boss.draw(this.renderer);
            }

            // Draw push walls
            for (const wall of this.pushWalls) {
                wall.draw(this.renderer);
            }

            // Draw powerup crates
            for (const crate of this.powerupCrates) {
                crate.draw(this.renderer);
            }

            // Draw rocket explosion radius indicators
            const ctx = this.renderer.ctx;
            for (const explosion of this.rocketExplosions) {
                ctx.save();
                ctx.strokeStyle = `rgba(255, 100, 0, ${explosion.alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
                ctx.stroke();

                // Inner ring for more visibility
                ctx.strokeStyle = `rgba(255, 200, 100, ${explosion.alpha * 0.6})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(explosion.x, explosion.y, explosion.radius * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // Draw allies (capped at ALLY_DISPLAY_CAP for performance)
        let drawnAllies = 0;
        for (const ally of this.allies) {
            if (!ally.active) continue;
            if (drawnAllies >= CONFIG.ALLY_DISPLAY_CAP) break;
            ally.draw(this.renderer);
            drawnAllies++;
        }

        // Draw player
        this.player.draw(this.renderer);

        // Draw shield effect around player if active
        if (this.powerUpManager.hasShield()) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.player.x, this.player.y, 25, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw invincibility effect (Chase mode)
        if (this.playerInvincible) {
            ctx.strokeStyle = '#ffdd00';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
            const bounds = this.player.getBounds();
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.globalAlpha = 1;
        }

        // Draw ASCII explosions (legacy, on top of particles)
        for (const exp of this.explosions) {
            if (SPRITES.EXPLOSION[exp.frame]) {
                this.renderer.drawSpriteCentered(
                    SPRITES.EXPLOSION[exp.frame],
                    exp.x,
                    exp.y,
                    '#ff8800'
                );
            }
        }

        // Draw screen flash
        this.screenFx.drawFlash(ctx, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);

        // Restore context
        ctx.restore();

        // Draw HUD (not affected by shake)
        const activeAllies = this.allies.filter(a => a.active).length;
        const allyDamageMult = this.getAllyDamageMultiplier();
        this.renderer.drawHUD(
            this.gold,
            this.score,
            this.player.health,
            this.player.maxHealth,
            activeAllies,
            allyDamageMult,
            this.player.boostLevel,
            this.player.maxBoostLevel
        );

        // Draw combo
        this.combo.draw(ctx, CONFIG.GAME_WIDTH - 10, 80);

        // Draw active power-up effects
        this.drawActivePowerUps(ctx);

        // Draw wave announcement
        if (this.waveAnnouncement) {
            const alpha = Math.min(1, this.waveAnnouncementTimer / 500);
            ctx.globalAlpha = alpha;
            this.renderer.drawTextCentered(
                this.waveAnnouncement,
                CONFIG.GAME_WIDTH / 2,
                CONFIG.GAME_HEIGHT / 2 - 50,
                '#ffffff',
                24
            );
            ctx.globalAlpha = 1;
        }

        // Draw Swarm lives counter
        if (rules.isSwarm || rules.isChaseSwarm) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold 16px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'right';
            ctx.fillText(`LIVES: ${this.swarmLives}`, CONFIG.GAME_WIDTH - 10, 25);
            ctx.textAlign = 'left'; // Reset to default
        }

        // Draw UI overlays
        if (this.state === 'shop') {
            this.shopUI.draw(ctx, this.gold, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        }

        // Draw game over overlay
        if (this.state === 'gameover') {
            this.gameOverUI.draw(ctx);
        }
    }

    drawActivePowerUps(ctx) {
        const active = this.powerUpManager.getActiveEffects();
        if (active.length === 0) return;

        let y = CONFIG.GAME_HEIGHT - 30;
        ctx.font = `10px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'left';

        active.forEach(effect => {
            const seconds = Math.ceil(effect.remaining / 1000);
            ctx.fillStyle = effect.data.color;
            ctx.fillText(`${effect.data.char} ${effect.data.name}: ${seconds}s`, 10, y);
            y -= 15;
        });
    }

    // Chase mode wave progression
    nextWaveChase() {
        this.waveTimer = 0;
        this.currentWave++;

        // Check for victory
        const rules = this.gameMode.getRules();
        if (this.currentWave > rules.waves) {
            this.handleVictory();
            return;
        }

        // Wave announcement
        this.waveAnnouncement = `WAVE ${this.currentWave}`;
        this.waveAnnouncementTimer = 2000;
        this.haptics.medium();
        this.audio.playWaveStart();
    }

    // Chase mode victory
    handleVictory() {
        this.victoryAchieved = true; // Set victory flag to prevent death
        this.state = 'gameover'; // Reuse gameover state but show victory
        this.audio.playVictory();
        this.screenFx.flash('#00ff00', 1.0);
        this.haptics.heavy();

        // Save high score
        const rank = this.save.saveHighScore({
            score: this.score,
            wave: this.currentWave,
            kills: this.kills,
            gameMode: this.gameMode.currentMode
        });
        if (rank > 0 && rank <= 10) {
            this.isNewLevelHighScore = true;
        }
        this.saveProgress();

        // Show victory message
        this.waveAnnouncement = 'VICTORY!';
        this.waveAnnouncementTimer = 5000;
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();

    // Start the single unified game loop
    window.game.lastTime = performance.now();
    requestAnimationFrame(window.game.gameLoop);
});
