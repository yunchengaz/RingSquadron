/**
 * Custom Level Manager
 *
 * Loads and plays custom levels created in the Map Editor.
 * Spawns entities based on wave definitions and tracks progress.
 *
 * @module systems/customlevel
 */
import { CONFIG } from '../utils/config.js';
import { Ring } from '../entities/ring.js';
import { Enemy } from '../entities/enemy.js';
import { Wall } from '../entities/wall.js';
import { SwarmBoss } from '../entities/swarmboss.js';
import { PowerupCrate } from '../entities/powerupcrate.js';
import { EditorSystem } from './editor.js';

export class CustomLevelManager {
    constructor() {
        this.currentLevel = null;
        this.currentWaveIndex = 0;
        this.waveStartTime = 0;
        this.waveSpawned = false;

        this.levelComplete = false;
        this.levelFailed = false;

        // Track spawned entities for wave completion check
        this.waveRings = [];
        this.waveEnemies = [];
        this.waveWalls = [];

        // Pending spawns with delays
        this.pendingSpawns = [];
    }

    // Load a level by name from LocalStorage
    loadLevel(name) {
        const levels = EditorSystem.getSavedLevels();
        if (levels[name]) {
            return this.loadLevelData(name, levels[name]);
        }
        return false;
    }

    // Load level from provided data (for global levels)
    loadLevelData(name, levelData) {
        if (!levelData || !levelData.waves) return false;

        this.currentLevel = levelData;
        this.currentLevel.name = name;
        this.currentWaveIndex = 0;
        this.waveStartTime = 0;
        this.waveSpawned = false;
        this.levelComplete = false;
        this.levelFailed = false;
        this.reset();
        return true;
    }

    // Reset tracking for new wave
    reset() {
        this.waveRings = [];
        this.waveEnemies = [];
        this.waveWalls = [];
        this.pendingSpawns = [];
    }

    // Get current wave data
    getCurrentWave() {
        if (!this.currentLevel) return null;
        if (this.currentWaveIndex >= this.currentLevel.waves.length) return null;
        return this.currentLevel.waves[this.currentWaveIndex];
    }

    // Main update - call each frame during custom level play
    update(currentTime, rings, enemies, walls, player) {
        if (!this.currentLevel || this.levelComplete || this.levelFailed) return;

        const wave = this.getCurrentWave();
        if (!wave) {
            this.levelComplete = true;
            return;
        }

        // Initialize wave start time
        if (this.waveStartTime === 0) {
            this.waveStartTime = currentTime;
        }

        const waveElapsed = currentTime - this.waveStartTime;

        // Spawn wave entities after delay
        if (!this.waveSpawned && waveElapsed >= wave.delay) {
            this.spawnWaveEntities(wave, rings, enemies, walls, currentTime);
            this.waveSpawned = true;
        }

        // Process pending spawns - entities spawn progressively based on Y position
        this.processPendingSpawns(currentTime, rings, enemies, walls);

        // Check if wave is complete
        if (this.waveSpawned && this.isWaveComplete(enemies)) {
            this.advanceWave(currentTime);
        }

        // Check for player death (level failed)
        if (!player.active) {
            this.levelFailed = true;
        }
    }

    // Queue all entities for progressive spawning based on Y position
    // Y positions in editor represent spawn order - higher Y = spawns later
    spawnWaveEntities(wave, rings, enemies, walls, currentTime) {
        // Use FULL game width for spawning - editor normalizes X to 0-1 range
        const gameWidth = CONFIG.GAME_WIDTH;

        // Calculate spawn delay based on Y position
        // Higher Y = later spawn. Use scroll speed to determine timing.
        const scrollSpeed = CONFIG.RING_SPEED * 60; // pixels per second (speed * fps)

        // Queue rings for spawning
        if (wave.rings) {
            for (const ringDef of wave.rings) {
                const spawnDelay = ((ringDef.y || 0) / scrollSpeed) * 1000; // ms
                this.pendingSpawns.push({
                    type: 'ring',
                    spawnTime: currentTime + spawnDelay,
                    def: ringDef,
                    x: ringDef.x * gameWidth
                });
            }
        }

        // Queue gates for spawning
        if (wave.gates) {
            for (const gateDef of wave.gates) {
                const spawnDelay = ((gateDef.y || 0) / scrollSpeed) * 1000;
                this.pendingSpawns.push({
                    type: 'gate',
                    spawnTime: currentTime + spawnDelay,
                    def: gateDef,
                    x: gateDef.x * gameWidth
                });
            }
        }

        // Queue enemies for spawning
        if (wave.enemies) {
            for (const enemyDef of wave.enemies) {
                const spawnDelay = ((enemyDef.y || 0) / scrollSpeed) * 1000;
                this.pendingSpawns.push({
                    type: 'enemy',
                    spawnTime: currentTime + spawnDelay,
                    def: enemyDef,
                    x: enemyDef.x * gameWidth
                });
            }
        }

        // Queue walls for spawning
        if (wave.walls) {
            for (const wallDef of wave.walls) {
                const spawnDelay = ((wallDef.y || 0) / scrollSpeed) * 1000;
                const laneWidth = gameWidth / 5;
                this.pendingSpawns.push({
                    type: 'wall',
                    spawnTime: currentTime + spawnDelay,
                    def: wallDef,
                    x: laneWidth * wallDef.lane + laneWidth / 2
                });
            }
        }

        // Queue crates for spawning
        if (wave.crates) {
            for (const crateDef of wave.crates) {
                const spawnDelay = ((crateDef.y || 0) / scrollSpeed) * 1000;
                this.pendingSpawns.push({
                    type: 'crate',
                    spawnTime: currentTime + spawnDelay,
                    def: crateDef,
                    x: crateDef.x * gameWidth  // Normalized X to actual X
                });
            }
        }

        // Sort by spawn time so earlier spawns are processed first
        this.pendingSpawns.sort((a, b) => a.spawnTime - b.spawnTime);
    }

    // Process pending spawns - spawn entities when their time comes
    processPendingSpawns(currentTime, rings, enemies, walls) {
        while (this.pendingSpawns.length > 0 && this.pendingSpawns[0].spawnTime <= currentTime) {
            const spawn = this.pendingSpawns.shift();

            switch (spawn.type) {
                case 'ring': {
                    const ring = new Ring(spawn.x, -50, spawn.def.value);
                    if (spawn.def.path && spawn.def.path !== 'straight') {
                        ring.setPath(spawn.def.path, spawn.def.params || {});
                    }
                    rings.push(ring);
                    this.waveRings.push(ring);
                    break;
                }
                case 'gate': {
                    const ring = new Ring(spawn.x, -50, 0);
                    ring.setMultiplierGate(spawn.def.type);
                    rings.push(ring);
                    this.waveRings.push(ring);
                    break;
                }
                case 'enemy': {
                    let enemy;
                    if (spawn.def.type === 'SWARM_BOSS') {
                        const health = spawn.def.health || 100;  // Use custom health or default to 100
                        enemy = new SwarmBoss(spawn.x, -50, health, false);
                    } else {
                        enemy = new Enemy(spawn.x, -50, spawn.def.type);
                    }
                    enemies.push(enemy);
                    this.waveEnemies.push(enemy);
                    break;
                }
                case 'wall': {
                    const wall = new Wall(
                        spawn.x,
                        -50,
                        spawn.def.lane,
                        spawn.def.type || 'SOLID',
                        spawn.def.value || null,  // hitsRequired for DESTRUCTIBLE/HIT_COUNTER_PUSH
                        spawn.def.width || 1.0,   // widthMultiplier (0.5 = half, 1.0 = full)
                        5                         // laneCount = 5 for custom levels
                    );
                    walls.push(wall);
                    this.waveWalls.push(wall);
                    break;
                }
                case 'crate': {
                    const crate = new PowerupCrate(
                        spawn.x,
                        spawn.def.type,
                        spawn.def.hits || 15
                    );
                    walls.push(crate);  // Add to walls array (they're both obstacles)
                    break;
                }
            }
        }
    }

    // Check if current wave is complete
    isWaveComplete(allEnemies) {
        // Still have pending spawns
        if (this.pendingSpawns.length > 0) return false;

        // All wave enemies must be dead
        const waveEnemiesAlive = this.waveEnemies.filter(e => e.active).length;
        if (waveEnemiesAlive > 0) return false;

        // All wave rings must be collected or off screen
        const waveRingsActive = this.waveRings.filter(r => r.active).length;
        if (waveRingsActive > 0) return false;

        // All wave walls must be off screen
        const waveWallsActive = this.waveWalls.filter(w => w.active).length;
        if (waveWallsActive > 0) return false;

        return true;
    }

    // Move to next wave
    advanceWave(currentTime) {
        this.currentWaveIndex++;
        this.waveStartTime = currentTime;
        this.waveSpawned = false;
        this.reset();

        // Check if level is complete
        if (this.currentWaveIndex >= this.currentLevel.waves.length) {
            this.levelComplete = true;
        }
    }

    // Get current progress info
    getProgress() {
        if (!this.currentLevel) return null;

        return {
            levelName: this.currentLevel.name,
            wave: this.currentWaveIndex + 1,
            totalWaves: this.currentLevel.waves.length,
            complete: this.levelComplete,
            failed: this.levelFailed
        };
    }

    isComplete() {
        return this.levelComplete;
    }

    isFailed() {
        return this.levelFailed;
    }

    isActive() {
        return this.currentLevel !== null && !this.levelComplete && !this.levelFailed;
    }
}
