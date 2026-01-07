/**
 * Enemy and Ring Spawning System
 *
 * Manages wave-based enemy spawning and ring pattern generation.
 * Difficulty scales based on:
 * - Wave number (enemies get stronger each wave)
 * - Player ally count (more allies = harder enemies)
 *
 * Ring Patterns (Last War style):
 * - TwoChoice: Left/right gate decision
 * - ThreeChoice: Three options with varying values
 * - ShootToWin: Negative ring that becomes positive when shot
 * - Gauntlet: Multiple rows of choices
 * - FakeChoice: Both bad - must shoot to improve
 * - Escalation: Vertically stacked improving rings
 * - RiskReward: Safe small gain vs dangerous big gain
 * - NarrowPath: Navigate between bad rings
 *
 * @module systems/spawner
 */
import { CONFIG } from '../utils/config.js';
import { Enemy } from '../entities/enemy.js';
import { Ring } from '../entities/ring.js';
import { Wall } from '../entities/wall.js';

export class SpawnerSystem {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.lastEnemySpawn = 0;
        this.lastRingSpawn = 0;
        this.lastWaveSpawn = 0;
        this.waveNumber = 1;
        this.enemiesSpawnedInWave = 0;
        this.enemiesPerWave = 5;

        // Pattern tracking
        this.ringPattern = 0;
        this.ringPatternStep = 0;
        this.pathTime = 0;

        // Wave spawning
        this.waveSpawnInterval = 4000; // Spawn a wave every 4 seconds
        this.waveFormations = ['v', 'line', 'diamond', 'stagger', 'pincer'];
        this.currentFormation = 0;
        this.lastBusSpawn = 0;
        this.busSpawnInterval = 15000; // BUS every 15 seconds after wave 3

        // Wall spawning (for Wall Mode)
        this.lastWallSpawn = 0;
        this.wallSpawnInterval = 2500; // Base interval between wall spawns
        this.lastWallLanes = []; // Track which lanes had walls last time

        // Endless mode scaling
        this.endlessMode = true;

        // Chase mode timers
        this.lastBoostSpawn = 0;
        this.lastGoldenBoostSpawn = 0;
        this.lastCargoShipSpawn = 0;
        this.lastEnemySpawn = 0;

        // Swarm mode timers
        this.swarmSpawnTimer = 0;
        this.lastBossSpawn = 0;
        this.bossIndex = 0;
        this.lastCrateSpawn = 0;
        this.lastPushWallSpawn = 0;
        this.cratesSpawned = 0;
        this.spreadShotSpawned = false;
        this.rocketSpawned = false;
        this.pushWallLane = 1;  // Start with center lane, rotate 1->0->2->1...
    }

    update(currentTime, enemies, rings, difficulty = 1, allyCount = 0, modeSpawnMult = 1, walls = null, hasWalls = false, noAllyRings = false) {
        // Apply endless scaling to spawn rate
        const scaling = CONFIG.ENDLESS_SCALING;
        const spawnMult = (1 + (this.waveNumber - 1) * scaling.spawnRatePerWave) * modeSpawnMult;

        // Scale difficulty based on player's ally count too
        // More allies = more enemies spawn faster
        const allyPowerScale = 1 + Math.floor(allyCount / 20) * 0.1; // +10% per 20 allies

        // Wave-based enemy spawning (Galaga style)
        const waveInterval = Math.max(2000, this.waveSpawnInterval / spawnMult - difficulty * 200);
        if (currentTime - this.lastWaveSpawn >= waveInterval) {
            this.spawnEnemyWave(enemies, difficulty, allyCount);
            this.lastWaveSpawn = currentTime;
        }

        // BUS enemy spawning - starts at wave 3, one lane at a time (not in wall mode)
        if (!hasWalls && this.waveNumber >= 3 && currentTime - this.lastBusSpawn >= this.busSpawnInterval) {
            this.spawnBusEnemy(enemies, difficulty, allyCount);
            this.lastBusSpawn = currentTime;
        }

        // Wall spawning (Wall Mode only)
        if (hasWalls && walls !== null) {
            const wallInterval = Math.max(1800, this.wallSpawnInterval - difficulty * 80);
            if (currentTime - this.lastWallSpawn >= wallInterval) {
                this.spawnWalls(walls, difficulty);
                this.lastWallSpawn = currentTime;
            }
        }

        // Spawn rings with paths - skip if noAllyRings flag is set
        if (!noAllyRings) {
            const ringInterval = Math.max(800, CONFIG.RING_SPAWN_INTERVAL - difficulty * 150);
            if (currentTime - this.lastRingSpawn >= ringInterval) {
                this.spawnRingPattern(rings, difficulty, allyCount);
                this.lastRingSpawn = currentTime;
            }
        }
    }

    // Spawn walls in 1-3 of 5 lanes (never all 5)
    spawnWalls(walls, difficulty) {
        const laneCount = 5;  // Use 5 lanes for Wall Mode
        const availableLanes = [0, 1, 2, 3, 4];

        // Avoid spawning in the same lanes as last time (for variety)
        const preferredLanes = availableLanes.filter(l => !this.lastWallLanes.includes(l));

        // More walls as difficulty increases: 1-3 walls, never all 5 lanes
        let wallCount = 1;
        if (difficulty > 5) {
            wallCount = Math.random() > 0.5 ? 3 : 2;
        } else if (difficulty > 2) {
            wallCount = Math.random() > 0.6 ? 2 : 1;
        }

        const selectedLanes = [];

        for (let i = 0; i < wallCount; i++) {
            const sourceArray = preferredLanes.length > 0 ? preferredLanes : availableLanes;
            const idx = Math.floor(Math.random() * sourceArray.length);
            const lane = sourceArray.splice(idx, 1)[0];

            // Also remove from preferredLanes if it was there
            const prefIdx = preferredLanes.indexOf(lane);
            if (prefIdx > -1) preferredLanes.splice(prefIdx, 1);

            // Remove from availableLanes too
            const availIdx = availableLanes.indexOf(lane);
            if (availIdx > -1) availableLanes.splice(availIdx, 1);

            selectedLanes.push(lane);
        }

        // Create walls in selected lanes with type variety
        selectedLanes.forEach(lane => {
            const x = Wall.getLaneX(lane, laneCount);
            const wallType = this.getRandomWallType(difficulty);
            const wall = new Wall(x, -40, lane, wallType, null, 1.0, laneCount);
            walls.push(wall);
        });

        this.lastWallLanes = selectedLanes;
    }

    // Get a random wall type based on difficulty
    getRandomWallType(difficulty) {
        const roll = Math.random();

        // Higher difficulty = more special wall types
        // Base distribution:
        // - 50% SOLID (always dangerous)
        // - 15% DESTRUCTIBLE (can shoot through)
        // - 12% BOOST (speed boost, safe)
        // - 10% PUSHABLE (can push away)
        // - 8% PLAYER_PASS (player bullets pass)
        // - 5% ENEMY_PASS (enemy bullets pass - very dangerous!)

        if (roll < 0.50) return 'SOLID';
        if (roll < 0.65) return 'DESTRUCTIBLE';
        if (roll < 0.77) return 'BOOST';
        if (roll < 0.87) return 'PUSHABLE';
        if (roll < 0.95) return 'PLAYER_PASS';
        return 'ENEMY_PASS';
    }

    spawnEnemyWave(enemies, difficulty, allyCount = 0) {
        const formation = this.waveFormations[this.currentFormation % this.waveFormations.length];
        const enemyCount = Math.min(6, 3 + Math.floor(this.waveNumber / 2));
        const type = this.getEnemyType(difficulty, allyCount);
        const isElite = this.checkElite(difficulty, allyCount);

        // Get formation positions
        const positions = this.getFormationPositions(formation, enemyCount);
        const entryPaths = this.getEntryPaths(formation, enemyCount);

        positions.forEach((pos, i) => {
            const enemy = new Enemy(pos.x, -50, type);

            // Set entry animation
            enemy.setEntryPath(entryPaths[i], pos.targetY);
            enemy.baseX = pos.x;

            // Apply endless scaling
            if (this.endlessMode) {
                this.applyEndlessScaling(enemy, allyCount);
            }

            if (isElite) {
                this.makeElite(enemy);
            }

            enemies.push(enemy);
        });

        this.enemiesSpawnedInWave += enemyCount;
        this.currentFormation++;

        // Track wave progression
        if (this.enemiesSpawnedInWave >= this.enemiesPerWave) {
            this.waveNumber++;
            this.enemiesSpawnedInWave = 0;
            this.enemiesPerWave = Math.min(30, 5 + Math.floor(this.waveNumber * 1.5));
        }
    }

    getFormationPositions(formation, count) {
        const positions = [];
        const centerX = this.gameWidth / 2;
        const spacing = 50;

        switch (formation) {
            case 'v':
                // V formation pointing down
                for (let i = 0; i < count; i++) {
                    const row = Math.floor(i / 2);
                    const side = i % 2 === 0 ? -1 : 1;
                    positions.push({
                        x: centerX + side * (row + 1) * spacing,
                        targetY: 80 + row * 40
                    });
                }
                break;

            case 'line':
                // Horizontal line
                const startX = centerX - ((count - 1) * spacing) / 2;
                for (let i = 0; i < count; i++) {
                    positions.push({
                        x: startX + i * spacing,
                        targetY: 80
                    });
                }
                break;

            case 'diamond':
                // Diamond shape
                const diamondPattern = [
                    { x: 0, y: 0 },
                    { x: -1, y: 1 }, { x: 1, y: 1 },
                    { x: -2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 2 }
                ];
                for (let i = 0; i < Math.min(count, diamondPattern.length); i++) {
                    positions.push({
                        x: centerX + diamondPattern[i].x * spacing,
                        targetY: 60 + diamondPattern[i].y * 35
                    });
                }
                break;

            case 'stagger':
                // Staggered rows
                for (let i = 0; i < count; i++) {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const offset = row % 2 === 0 ? 0 : spacing / 2;
                    positions.push({
                        x: 80 + col * 120 + offset,
                        targetY: 70 + row * 50
                    });
                }
                break;

            case 'pincer':
                // Split into two groups coming from sides
                const halfCount = Math.ceil(count / 2);
                for (let i = 0; i < count; i++) {
                    const side = i < halfCount ? 0 : 1;
                    const idx = i < halfCount ? i : i - halfCount;
                    positions.push({
                        x: side === 0 ? 60 + idx * 40 : this.gameWidth - 60 - idx * 40,
                        targetY: 80 + idx * 30
                    });
                }
                break;

            default:
                // Random
                for (let i = 0; i < count; i++) {
                    positions.push({
                        x: 60 + Math.random() * (this.gameWidth - 120),
                        targetY: 60 + Math.random() * 80
                    });
                }
        }

        return positions;
    }

    getEntryPaths(formation, count) {
        const paths = [];
        const pathTypes = ['straight', 'swoop', 'spiral', 'zigzag'];

        switch (formation) {
            case 'v':
                // Swoop in from sides
                for (let i = 0; i < count; i++) {
                    paths.push(i % 2 === 0 ? 'swoop' : 'swoop');
                }
                break;

            case 'pincer':
                // Spiral in from sides
                for (let i = 0; i < count; i++) {
                    paths.push('spiral');
                }
                break;

            case 'diamond':
                // Mix of paths
                for (let i = 0; i < count; i++) {
                    paths.push(i === 0 ? 'straight' : 'zigzag');
                }
                break;

            default:
                // Random mix
                for (let i = 0; i < count; i++) {
                    paths.push(pathTypes[Math.floor(Math.random() * pathTypes.length)]);
                }
        }

        return paths;
    }

    spawnBusEnemy(enemies, difficulty, allyCount = 0) {
        // Pick a random lane (0, 1, or 2)
        const lane = Math.floor(Math.random() * 3);
        const laneWidth = this.gameWidth / 3;
        const x = laneWidth * lane + laneWidth / 2;

        const enemy = new Enemy(x, -80, 'BUS');

        // BUS doesn't do entry animation - goes straight into approach
        enemy.entering = false;

        // Apply scaling
        if (this.endlessMode) {
            this.applyEndlessScaling(enemy, allyCount);
        }

        enemies.push(enemy);
    }

    spawnEnemy(enemies, difficulty, allyCount = 0) {
        const type = this.getEnemyType(difficulty, allyCount);
        const isElite = this.checkElite(difficulty, allyCount);

        const padding = 60;
        const x = padding + Math.random() * (this.gameWidth - padding * 2);
        const y = -50;

        const enemy = new Enemy(x, y, type);

        // Apply endless scaling to enemy stats - scale with player power too
        if (this.endlessMode) {
            this.applyEndlessScaling(enemy, allyCount);
        }

        // Elite enemies are stronger
        if (isElite) {
            this.makeElite(enemy);
        }

        enemies.push(enemy);
        this.enemiesSpawnedInWave++;

        if (this.enemiesSpawnedInWave >= this.enemiesPerWave) {
            this.waveNumber++;
            this.enemiesSpawnedInWave = 0;
            // More enemies per wave as game progresses
            this.enemiesPerWave = Math.min(30, 5 + Math.floor(this.waveNumber * 1.5));
        }
    }

    getEnemyType(difficulty, allyCount = 0) {
        const roll = Math.random();
        const wave = this.waveNumber;

        // Unlock enemy types faster based on player power
        const allyBonus = Math.floor(allyCount / 10); // Every 10 allies = -1 wave requirement
        const effectiveWave = wave + allyBonus;

        // Progressively unlock enemy types - unlock faster if player is strong
        if (effectiveWave >= 12 && roll < 0.10) return 'CARRIER';
        if (effectiveWave >= 10 && roll < 0.18) return 'SHIELD';
        if (effectiveWave >= 8 && roll < 0.15) return 'BOMBER';
        if (effectiveWave >= 6 && roll < 0.18) return 'SNIPER';
        if (effectiveWave >= 4 && roll < 0.25) return 'SWARM';
        if (effectiveWave >= 2 && roll < 0.18) return 'TANK';
        if (effectiveWave >= 1 && roll < 0.30) return 'FAST';

        return 'BASIC';
    }

    checkElite(difficulty, allyCount = 0) {
        const scaling = CONFIG.ENDLESS_SCALING;
        // Elite chance increases with both wave and player power
        const allyBonus = allyCount * 0.001; // +0.1% per ally
        const eliteChance = (this.waveNumber - 3) * scaling.eliteChancePerWave + allyBonus;
        return Math.random() < eliteChance;
    }

    applyEndlessScaling(enemy, allyCount = 0) {
        const scaling = CONFIG.ENDLESS_SCALING;
        const wave = this.waveNumber;

        // Scale enemy power based on both wave AND player power
        const allyPowerMult = 1 + (allyCount / 100); // +1% per ally

        // Calculate multipliers (with caps)
        const healthMult = Math.min(
            scaling.maxHealthMultiplier,
            (1 + (wave - 1) * scaling.healthPerWave) * allyPowerMult
        );
        const speedMult = Math.min(
            scaling.maxSpeedMultiplier,
            1 + (wave - 1) * scaling.speedPerWave
        );
        const damageMult = (1 + (wave - 1) * scaling.damagePerWave) * Math.sqrt(allyPowerMult);

        // Apply scaling
        enemy.health = Math.floor(enemy.health * healthMult);
        enemy.maxHealth = enemy.health;
        enemy.speed = enemy.speed * speedMult;
        enemy.bulletDamage = Math.floor(enemy.bulletDamage * damageMult);

        // Also scale rewards - more for harder enemies
        enemy.gold = Math.floor(enemy.gold * (1 + (wave - 1) * 0.08));
        enemy.score = Math.floor(enemy.score * (1 + (wave - 1) * 0.15));
    }

    makeElite(enemy) {
        const scaling = CONFIG.ENDLESS_SCALING;
        enemy.health = Math.floor(enemy.health * scaling.eliteHealthBonus);
        enemy.maxHealth = enemy.health;
        enemy.bulletDamage = Math.floor(enemy.bulletDamage * scaling.eliteDamageBonus);
        enemy.gold = Math.floor(enemy.gold * 2);
        enemy.score = Math.floor(enemy.score * 2);
        enemy.isElite = true;
    }

    // Calculate starting value based on wave AND player power - rings get more challenging
    getStartingValue(difficulty, allyCount = 0) {
        // Start aggressive with negative values much quicker
        // Player power also affects ring values - strong players get harder rings
        const allyPenalty = Math.floor(allyCount / 15); // Every 15 allies = -1 to ring value

        // Wave 1: start around -3 to 0
        // Wave 2+: increasingly negative
        // Much more aggressive negative scaling
        const baseValue = -2 - Math.floor(difficulty * 1.5) - allyPenalty;
        const variance = Math.floor(Math.random() * 4) - 1; // -1 to +2
        const value = baseValue + variance;

        // Clamp to reasonable range - allow much larger negatives
        return Math.max(-25, Math.min(5, value));
    }

    spawnRingPattern(rings, difficulty, allyCount = 0) {
        // Last War style: side-by-side gate choices that force player to pick a path
        const patterns = [
            this.patternTwoChoice.bind(this),
            this.patternThreeChoice.bind(this),
            this.patternShootToWin.bind(this),
            this.patternGauntlet.bind(this),
            this.patternFakeChoice.bind(this),
            this.patternEscalation.bind(this),
            this.patternRiskReward.bind(this),
            this.patternNarrowPath.bind(this),
            this.patternMultiplierChoice.bind(this),
            this.patternRiskyMultiplier.bind(this)
        ];

        const pattern = patterns[this.ringPattern % patterns.length];
        pattern(rings, difficulty, allyCount);
        this.ringPattern++;
    }

    // Two gates side by side - clear good vs bad choice
    patternTwoChoice(rings, difficulty, allyCount = 0) {
        const badValue = -5 - Math.floor(difficulty * 2) - Math.floor(allyCount / 20);
        const goodValue = Math.max(-3, 2 - Math.floor(difficulty));

        // Randomize which side is good
        const goodOnLeft = Math.random() > 0.5;

        const leftRing = new Ring(this.gameWidth * 0.25, -30, goodOnLeft ? goodValue : badValue);
        leftRing.setPath('straight');
        rings.push(leftRing);

        const rightRing = new Ring(this.gameWidth * 0.75, -30, goodOnLeft ? badValue : goodValue);
        rightRing.setPath('straight');
        rings.push(rightRing);
    }

    // Three gates - one good, two bad (or varying degrees of bad)
    patternThreeChoice(rings, difficulty, allyCount = 0) {
        const terribleValue = -10 - Math.floor(difficulty * 2) - Math.floor(allyCount / 15);
        const badValue = -5 - Math.floor(difficulty);
        const okValue = Math.max(-2, 1 - Math.floor(difficulty / 2));

        // Randomize positions
        const positions = [0.2, 0.5, 0.8];
        const values = [terribleValue, badValue, okValue];

        // Shuffle values
        for (let i = values.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [values[i], values[j]] = [values[j], values[i]];
        }

        positions.forEach((pos, i) => {
            const ring = new Ring(this.gameWidth * pos, -30, values[i]);
            ring.setPath('straight');
            rings.push(ring);
        });
    }

    // Shoot-to-win: bad ring that becomes good if you shoot it enough
    patternShootToWin(rings, difficulty, allyCount = 0) {
        // Start very negative, but shooting adds +1 each hit
        // Player needs to shoot it 5-10 times to make it positive
        const startValue = -8 - Math.floor(difficulty);

        const ring = new Ring(this.gameWidth / 2, -60, startValue);
        ring.setPath('sine', { amplitude: 80, frequency: 0.005 });
        rings.push(ring);

        // Also spawn a safer but less rewarding side option
        const safeValue = -2;
        const safeRing = new Ring(this.gameWidth * 0.15, -30, safeValue);
        safeRing.setPath('straight');
        rings.push(safeRing);
    }

    // Gauntlet: multiple rows of choices
    patternGauntlet(rings, difficulty, allyCount = 0) {
        const badValue = -6 - Math.floor(difficulty) - Math.floor(allyCount / 25);
        const okValue = Math.max(-3, 0 - Math.floor(difficulty / 2));

        // Row 1: two bad, one ok
        const row1Positions = [0.2, 0.5, 0.8];
        const row1Good = Math.floor(Math.random() * 3);
        row1Positions.forEach((pos, i) => {
            const ring = new Ring(this.gameWidth * pos, -30, i === row1Good ? okValue : badValue);
            ring.setPath('straight');
            rings.push(ring);
        });

        // Row 2: shifted positions, different good spot
        const row2Positions = [0.35, 0.65];
        const row2Good = Math.floor(Math.random() * 2);
        row2Positions.forEach((pos, i) => {
            const ring = new Ring(this.gameWidth * pos, -120, i === row2Good ? okValue : badValue);
            ring.setPath('straight');
            rings.push(ring);
        });
    }

    // Fake choice: both options are bad, must shoot to improve
    patternFakeChoice(rings, difficulty, allyCount = 0) {
        const badValue1 = -6 - Math.floor(difficulty);
        const badValue2 = -8 - Math.floor(difficulty);

        // Both are bad - player must shoot one to make it acceptable
        const leftRing = new Ring(this.gameWidth * 0.3, -50, badValue1);
        leftRing.setPath('straight');
        rings.push(leftRing);

        const rightRing = new Ring(this.gameWidth * 0.7, -50, badValue2);
        rightRing.setPath('straight');
        rings.push(rightRing);
    }

    // Escalation: series of gates getting progressively better/worse
    patternEscalation(rings, difficulty, allyCount = 0) {
        const baseValue = -10 - Math.floor(difficulty);

        // Three rings in a column, getting better as you go
        // But later ones are harder to reach (more time to shoot earlier ones)
        for (let i = 0; i < 3; i++) {
            const value = baseValue + (i * 4); // -10, -6, -2 (or worse with difficulty)
            const ring = new Ring(this.gameWidth / 2, -30 - i * 100, value);
            ring.setPath('sine', { amplitude: 40 + i * 30, frequency: 0.008 });
            rings.push(ring);
        }
    }

    // Risk/Reward: safe small gain vs dangerous big gain
    patternRiskReward(rings, difficulty, allyCount = 0) {
        const safeValue = 1; // Small positive
        const riskyValue = 5 + Math.floor(difficulty); // Big positive
        const dangerValue = -15 - Math.floor(difficulty * 2); // Very negative

        // Safe path on one side
        const safeRing = new Ring(this.gameWidth * 0.2, -30, safeValue);
        safeRing.setPath('straight');
        rings.push(safeRing);

        // Risky path: must navigate between two danger rings
        const dangerRing1 = new Ring(this.gameWidth * 0.55, -30, dangerValue);
        dangerRing1.setPath('straight');
        rings.push(dangerRing1);

        const rewardRing = new Ring(this.gameWidth * 0.75, -30, riskyValue);
        rewardRing.setPath('straight');
        rings.push(rewardRing);

        const dangerRing2 = new Ring(this.gameWidth * 0.95, -30, dangerValue);
        dangerRing2.setPath('straight');
        rings.push(dangerRing2);
    }

    // Narrow path: must stay in center to avoid bad rings on sides
    patternNarrowPath(rings, difficulty, allyCount = 0) {
        const badValue = -8 - Math.floor(difficulty) - Math.floor(allyCount / 20);
        const goodValue = Math.max(-1, 2 - Math.floor(difficulty / 2));

        // Bad rings on left
        const leftRing = new Ring(this.gameWidth * 0.15, -30, badValue);
        leftRing.setPath('straight');
        rings.push(leftRing);

        // Good ring in center
        const centerRing = new Ring(this.gameWidth * 0.5, -30, goodValue);
        centerRing.setPath('straight');
        rings.push(centerRing);

        // Bad ring on right
        const rightRing = new Ring(this.gameWidth * 0.85, -30, badValue);
        rightRing.setPath('straight');
        rings.push(rightRing);
    }

    // Multiplier choice: x2 on one side, /2 on the other - high stakes!
    patternMultiplierChoice(rings, difficulty, allyCount = 0) {
        const x2OnLeft = Math.random() > 0.5;

        const leftRing = new Ring(this.gameWidth * 0.3, -30, 0);
        leftRing.setMultiplierGate(x2OnLeft ? 'multiply' : 'divide');
        leftRing.setPath('straight');
        rings.push(leftRing);

        const rightRing = new Ring(this.gameWidth * 0.7, -30, 0);
        rightRing.setMultiplierGate(x2OnLeft ? 'divide' : 'multiply');
        rightRing.setPath('straight');
        rings.push(rightRing);
    }

    // Risky multiplier: safe normal ring vs risky x2 gate with /2 blocker
    patternRiskyMultiplier(rings, difficulty, allyCount = 0) {
        const safeValue = Math.max(1, 3 - Math.floor(difficulty / 2));

        // Safe option on left
        const safeRing = new Ring(this.gameWidth * 0.25, -30, safeValue);
        safeRing.setPath('straight');
        rings.push(safeRing);

        // x2 gate in center (tempting!)
        const x2Ring = new Ring(this.gameWidth * 0.5, -30, 0);
        x2Ring.setMultiplierGate('multiply');
        x2Ring.setPath('straight');
        rings.push(x2Ring);

        // /2 gate blocking the easy path to x2
        const divideRing = new Ring(this.gameWidth * 0.65, -80, 0);
        divideRing.setMultiplierGate('divide');
        divideRing.setPath('sine', { amplitude: 40, frequency: 0.008 });
        rings.push(divideRing);
    }

    reset() {
        this.lastEnemySpawn = 0;
        this.lastRingSpawn = 0;
        this.lastWaveSpawn = 0;
        this.lastBusSpawn = 0;
        this.lastWallSpawn = 0;
        this.lastWallLanes = [];
        this.waveNumber = 1;
        this.enemiesSpawnedInWave = 0;
        this.enemiesPerWave = 5;
        this.ringPattern = 0;
        this.ringPatternStep = 0;
        this.pathTime = 0;
        this.currentFormation = 0;

        // Chase mode timers
        this.lastBoostSpawn = 0;
        this.lastGoldenBoostSpawn = 0;
        this.lastCargoShipSpawn = 0;
        this.lastEnemySpawn = 0;

        // Swarm mode timers
        this.swarmSpawnTimer = 0;
        this.lastBossSpawn = 0;
        this.bossIndex = 0;
        this.lastCrateSpawn = 0;
        this.lastPushWallSpawn = 0;
        this.cratesSpawned = 0;
        this.spreadShotSpawned = false;
        this.rocketSpawned = false;
        this.pushWallLane = 1;  // Start with center lane, rotate 1->0->2->1...
    }

    getDifficulty() {
        return 1 + (this.waveNumber - 1) * 0.3;
    }

    // ========================================
    // CHASE MODE SPAWNING
    // ========================================

    /**
     * Update Chase mode spawning - boost pads, cargo ships, and enemies
     */
    updateChaseMode(currentTime, walls, cargoShips, enemies, waveNumber, difficulty) {
        const cfg = CONFIG.CHASE_MODE;

        // Spawn regular boost pads
        if (currentTime - this.lastBoostSpawn >= cfg.boostPadInterval) {
            this.spawnBoostPad(walls, false);
            this.lastBoostSpawn = currentTime;
        }

        // Spawn golden boost pads (rare)
        if (currentTime - this.lastGoldenBoostSpawn >= cfg.goldenBoostInterval) {
            if (Math.random() < cfg.goldenBoostChance) {
                this.spawnBoostPad(walls, true);
            }
            this.lastGoldenBoostSpawn = currentTime;
        }

        // Spawn cargo ships (gets faster each wave)
        const cargoShipInterval = Math.max(
            cfg.cargoShipMinInterval,
            cfg.cargoShipBaseInterval * (1 - waveNumber * cfg.spawnRateIncrease)
        );

        if (currentTime - this.lastCargoShipSpawn >= cargoShipInterval) {
            this.spawnCargoShip(cargoShips, waveNumber);
            this.lastCargoShipSpawn = currentTime;
        }

        // Spawn regular enemies (gets faster each wave)
        const enemyInterval = Math.max(
            1500, // Min 1.5 seconds
            3000 * (1 - waveNumber * 0.05) // Start at 3s, gets faster
        );

        if (currentTime - this.lastEnemySpawn >= enemyInterval) {
            this.spawnChaseEnemy(enemies, waveNumber, difficulty);
            this.lastEnemySpawn = currentTime;
        }
    }

    /**
     * Spawn a boost pad in a random lane
     */
    spawnBoostPad(walls, isGolden) {
        const lane = Math.floor(Math.random() * 3);
        const laneWidth = this.gameWidth / 3;
        const x = laneWidth * lane + laneWidth / 2;

        const wallType = isGolden ? 'GOLDEN_BOOST' : 'BOOST';
        const wall = new Wall(x, -40, lane, wallType, null, 1.0, 3);  // 3 lanes for Chase mode
        walls.push(wall);
    }

    /**
     * Spawn a cargo ship in a random lane
     */
    spawnCargoShip(cargoShips, waveNumber) {
        const lane = Math.floor(Math.random() * 3);
        const laneWidth = this.gameWidth / 3;
        const x = laneWidth * lane + laneWidth / 2;

        // Import CargoShip dynamically to avoid circular dependency
        import('../entities/cargoship.js').then(module => {
            const CargoShip = module.CargoShip;
            const ship = new CargoShip(x, lane, waveNumber);
            cargoShips.push(ship);
        });
    }

    /**
     * Spawn a regular enemy in Chase mode
     */
    spawnChaseEnemy(enemies, waveNumber, difficulty) {
        // Random X position
        const x = Math.random() * (this.gameWidth - 80) + 40;

        // Choose enemy type - favor simpler enemies in Chase mode
        const rand = Math.random();
        let type;

        if (waveNumber < 3) {
            // Early waves: mostly BASIC and FAST
            type = rand < 0.7 ? 'BASIC' : 'FAST';
        } else if (waveNumber < 6) {
            // Mid waves: add TANK and BOMBER
            if (rand < 0.4) type = 'BASIC';
            else if (rand < 0.7) type = 'FAST';
            else if (rand < 0.85) type = 'TANK';
            else type = 'BOMBER';
        } else {
            // Late waves: all types
            if (rand < 0.3) type = 'BASIC';
            else if (rand < 0.5) type = 'FAST';
            else if (rand < 0.65) type = 'TANK';
            else if (rand < 0.8) type = 'BOMBER';
            else if (rand < 0.9) type = 'SNIPER';
            else type = 'SWARM';
        }

        // Create enemy (Enemy already imported at top of file)
        const enemy = new Enemy(x, -50, type);

        // Scale with difficulty and wave
        enemy.health *= (1 + difficulty * 0.2 + waveNumber * 0.1);
        enemy.maxHealth = enemy.health;

        enemies.push(enemy);
    }

    // ========================================
    // SWARM MODE SPAWNING
    // ========================================

    /**
     * Update Swarm mode spawning - swarm enemies, bosses, crates, push walls, multiplier gates
     */
    updateSwarmMode(currentTime, swarmEnemies, swarmBosses, crates, pushWalls, multiplierGates) {
        const playTime = currentTime; // Milliseconds since start

        // Spawn small swarm enemies continuously (every 50ms = 20 per second)
        this.swarmSpawnTimer += 16; // Approximate frame time
        if (this.swarmSpawnTimer >= 50) {
            this.spawnSwarmWave(swarmEnemies);
            this.swarmSpawnTimer = 0;
        }

        // Spawn wingmen powerups spread over 20 seconds (17 total)
        // Tighter distribution around center (36%-64% of screen width)
        const wingmanSchedule = [
            { time: 0, x: 0.5, hits: 5 },       // Center
            { time: 1000, x: 0.42, hits: 3 },   // Left-center
            { time: 2000, x: 0.58, hits: 3 },   // Right-center
            { time: 3000, x: 0.46, hits: 4 },   // Left-center
            { time: 4000, x: 0.54, hits: 4 },   // Right-center
            { time: 5000, x: 0.38, hits: 5 },   // Left
            { time: 6000, x: 0.62, hits: 5 },   // Right
            { time: 7000, x: 0.5, hits: 6 },    // Center
            { time: 8000, x: 0.44, hits: 4 },   // Left-center
            { time: 9000, x: 0.56, hits: 4 },   // Right-center
            { time: 10000, x: 0.40, hits: 5 },  // Left
            { time: 11000, x: 0.60, hits: 5 },  // Right
            { time: 12000, x: 0.5, hits: 7 },   // Center
            { time: 14000, x: 0.48, hits: 6 },  // Left-center
            { time: 16000, x: 0.52, hits: 6 },  // Right-center
            { time: 18000, x: 0.36, hits: 8 },  // Left
            { time: 20000, x: 0.64, hits: 8 }   // Right
        ];

        for (let i = 0; i < wingmanSchedule.length; i++) {
            const spawn = wingmanSchedule[i];
            if (playTime >= spawn.time && this.cratesSpawned === i) {
                this.spawnPowerupCrate(crates, this.gameWidth * spawn.x, 'wingman', spawn.hits);
                this.cratesSpawned++;
                break; // Only spawn one per frame
            }
        }

        // Push walls every 8 seconds, rotating through lanes (center, left, right)
        const pushWallInterval = 8000;
        const timeSinceLastPushWall = playTime - this.lastPushWallSpawn;
        if (this.lastPushWallSpawn === 0 && playTime >= 3000) {
            // First push wall at 3s in center lane
            this.spawnPushWall(pushWalls, 15, this.pushWallLane);
            this.lastPushWallSpawn = playTime;
            // Rotate lane: 1->0->2->1...
            this.pushWallLane = (this.pushWallLane === 1) ? 0 : (this.pushWallLane === 0) ? 2 : 1;
        } else if (timeSinceLastPushWall >= pushWallInterval && this.lastPushWallSpawn > 0) {
            // Subsequent push walls every 8s, rotating lanes
            const wallCount = Math.floor((playTime - 3000) / pushWallInterval);
            this.spawnPushWall(pushWalls, 15 + wallCount * 5, this.pushWallLane);
            this.lastPushWallSpawn = playTime;
            // Rotate lane: 1->0->2->1...
            this.pushWallLane = (this.pushWallLane === 1) ? 0 : (this.pushWallLane === 0) ? 2 : 1;
        }

        // Spawn first boss (T=22000ms, 50 hits)
        if (playTime >= 22000 && this.bossIndex === 0) {
            this.spawnSwarmBoss(swarmBosses, 50);
            this.bossIndex++;
            this.lastBossSpawn = playTime;
        }

        // Spawn spread shot crate (T=6000ms)
        if (playTime >= 6000 && !this.spreadShotSpawned) {
            this.spawnPowerupCrate(crates, this.gameWidth * 0.5, 'spreadshot', 50);
            this.spreadShotSpawned = true;
        }

        // Spawn rocket launcher crate (T=15000ms)
        if (playTime >= 15000 && !this.rocketSpawned) {
            this.spawnPowerupCrate(crates, this.gameWidth * 0.5, 'rocket', 100);
            this.rocketSpawned = true;
        }

        // Spawn second boss (T=25000ms, 250 hits)
        if (playTime >= 25000 && this.bossIndex === 1) {
            this.spawnSwarmBoss(swarmBosses, 250);
            this.bossIndex++;
            this.lastBossSpawn = playTime;
        }

        // Continue spawning bosses exponentially (every 15s after second boss)
        if (this.bossIndex >= 2 && playTime - this.lastBossSpawn >= 15000) {
            const health = Math.pow(2, this.bossIndex - 1) * 250;  // 500, 1000, 2000...
            this.spawnSwarmBoss(swarmBosses, health);
            this.bossIndex++;
            this.lastBossSpawn = playTime;
        }

        // Spawn multiplier gate (once, at start)
        if (multiplierGates.length === 0) {
            // Import MultiplierGate dynamically
            import('../entities/multipliergate.js').then(module => {
                const MultiplierGate = module.MultiplierGate;
                multiplierGates.push(new MultiplierGate(this.gameWidth, this.gameHeight, 2));
            });
        }
    }

    /**
     * Spawn a wave of small swarm enemies across the top
     */
    spawnSwarmWave(swarmEnemies) {
        // Import SwarmEnemy dynamically
        import('../entities/swarmenemy.js').then(module => {
            const SwarmEnemy = module.SwarmEnemy;
            // Spawn 10 enemies across the top
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * this.gameWidth;
                const y = -10;
                swarmEnemies.push(new SwarmEnemy(x, y));
            }
        });
    }

    /**
     * Spawn a swarm boss with specified health
     */
    spawnSwarmBoss(swarmBosses, health) {
        // Import SwarmBoss dynamically
        import('../entities/swarmboss.js').then(module => {
            const SwarmBoss = module.SwarmBoss;
            const x = this.gameWidth / 2;
            const y = -50;
            swarmBosses.push(new SwarmBoss(x, y, health));
        });
    }

    /**
     * Spawn a powerup crate
     */
    spawnPowerupCrate(crates, x, type, hitsRequired) {
        // Import PowerupCrate dynamically
        import('../entities/powerupcrate.js').then(module => {
            const PowerupCrate = module.PowerupCrate;
            crates.push(new PowerupCrate(x, type, hitsRequired));
        });
    }

    /**
     * Spawn a hit-counter push wall in specified lane
     */
    spawnPushWall(pushWalls, hitsRequired, lane, widthMultiplier = 1.0) {
        const laneCount = 3;  // Swarm/Chase Swarm use 3 lanes
        const laneWidth = this.gameWidth / laneCount;
        const x = laneWidth * lane + laneWidth / 2;
        const wall = new Wall(x, -40, lane, 'HIT_COUNTER_PUSH', hitsRequired, widthMultiplier, laneCount);
        pushWalls.push(wall);
    }

    // ========================================
    // CHASE SWARM MODE SPAWNING
    // ========================================

    /**
     * Update Chase Swarm mode spawning - combines Chase and Swarm mechanics
     */
    updateChaseSwarmSpawning(currentTime, swarmEnemies, swarmBosses, cargoShips, pushWalls, crates, multiplierGates) {
        const cfg = CONFIG.CHASE_SWARM_MODE;
        const playTime = currentTime;

        // Stop spawning new enemies after 30 seconds
        const stopSpawningTime = 30000; // 30 seconds

        // Spawn swarm enemies continuously (every 50ms) - stop at 30s
        if (playTime < stopSpawningTime) {
            this.swarmSpawnTimer += 16;
            if (this.swarmSpawnTimer >= cfg.swarmSpawnRate) {
                this.spawnChaseSwarmWave(swarmEnemies);
                this.swarmSpawnTimer = 0;
            }
        }

        // Spawn cargo ships (trucks) periodically - stop at 30s
        if (!this.lastCargoSpawn) this.lastCargoSpawn = 0;
        if (playTime < stopSpawningTime && playTime - this.lastCargoSpawn >= cfg.cargoShipBaseInterval) {
            this.spawnCargoShip(cargoShips, 1);
            this.lastCargoSpawn = playTime;
        }

        // Spawn push walls every 8 seconds, rotating through lanes (center, left, right)
        const pushWallInterval = 8000;
        const timeSinceLastPushWall = playTime - this.lastPushWallSpawn;
        if (this.lastPushWallSpawn === 0 && playTime >= 3000) {
            // First push wall at 3s in center lane
            this.spawnPushWall(pushWalls, 15, this.pushWallLane, cfg.pushWallWidthMultiplier);
            this.lastPushWallSpawn = playTime;
            // Rotate lane: 1->0->2->1...
            this.pushWallLane = (this.pushWallLane === 1) ? 0 : (this.pushWallLane === 0) ? 2 : 1;
        } else if (timeSinceLastPushWall >= pushWallInterval && this.lastPushWallSpawn > 0) {
            // Subsequent push walls every 8s, rotating lanes
            const wallCount = Math.floor((playTime - 3000) / pushWallInterval);
            this.spawnPushWall(pushWalls, 15 + wallCount * 5, this.pushWallLane, cfg.pushWallWidthMultiplier);
            this.lastPushWallSpawn = playTime;
            // Rotate lane: 1->0->2->1...
            this.pushWallLane = (this.pushWallLane === 1) ? 0 : (this.pushWallLane === 0) ? 2 : 1;
        }

        // Spawn wingmen powerups spread over 20 seconds (17 total)
        const wingmanSchedule = [
            { time: 0, x: 0.5, hits: 5 },       // Center
            { time: 1000, x: 0.42, hits: 3 },   // Left-center
            { time: 2000, x: 0.58, hits: 3 },   // Right-center
            { time: 3000, x: 0.46, hits: 4 },   // Left-center
            { time: 4000, x: 0.54, hits: 4 },   // Right-center
            { time: 5000, x: 0.38, hits: 5 },   // Left
            { time: 6000, x: 0.62, hits: 5 },   // Right
            { time: 7000, x: 0.5, hits: 6 },    // Center
            { time: 8000, x: 0.44, hits: 4 },   // Left-center
            { time: 9000, x: 0.56, hits: 4 },   // Right-center
            { time: 10000, x: 0.40, hits: 5 },  // Left
            { time: 11000, x: 0.60, hits: 5 },  // Right
            { time: 12000, x: 0.5, hits: 7 },   // Center
            { time: 14000, x: 0.48, hits: 6 },  // Left-center
            { time: 16000, x: 0.52, hits: 6 },  // Right-center
            { time: 18000, x: 0.36, hits: 8 },  // Left
            { time: 20000, x: 0.64, hits: 8 }   // Right
        ];

        for (let i = 0; i < wingmanSchedule.length; i++) {
            const spawn = wingmanSchedule[i];
            if (playTime >= spawn.time && this.cratesSpawned === i) {
                this.spawnPowerupCrate(crates, this.gameWidth * spawn.x, 'wingman', spawn.hits);
                this.cratesSpawned++;
                break; // Only spawn one per frame
            }
        }

        // Spawn spread shot crate (T=6000ms)
        if (playTime >= 6000 && !this.spreadShotSpawned) {
            this.spawnPowerupCrate(crates, this.gameWidth * 0.5, 'spreadshot', 50);
            this.spreadShotSpawned = true;
        }

        // Spawn rocket launcher crate (T=15000ms)
        if (playTime >= 15000 && !this.rocketSpawned) {
            this.spawnPowerupCrate(crates, this.gameWidth * 0.5, 'rocket', 100);
            this.rocketSpawned = true;
        }

        // Spawn first boss (T=22000ms, 50 hits) - only if before 30s
        if (playTime >= 22000 && playTime < stopSpawningTime && this.bossIndex === 0) {
            this.spawnChaseSwarmBoss(swarmBosses, 50);
            this.bossIndex++;
            this.lastBossSpawn = playTime;
        }

        // Spawn second boss (T=25000ms, 250 hits) - only if before 30s
        if (playTime >= 25000 && playTime < stopSpawningTime && this.bossIndex === 1) {
            this.spawnChaseSwarmBoss(swarmBosses, 250);
            this.bossIndex++;
            this.lastBossSpawn = playTime;
        }

        // Continue spawning bosses exponentially (every 15s after second boss) - stop at 30s
        if (this.bossIndex >= 2 && playTime < stopSpawningTime && playTime - this.lastBossSpawn >= 15000) {
            const health = Math.pow(2, this.bossIndex - 1) * 250;  // 500, 1000, 2000...
            this.spawnChaseSwarmBoss(swarmBosses, health);
            this.bossIndex++;
            this.lastBossSpawn = playTime;
        }

        // Spawn multiplier gate (once, at start)
        if (multiplierGates.length === 0) {
            // Import MultiplierGate dynamically
            import('../entities/multipliergate.js').then(module => {
                const MultiplierGate = module.MultiplierGate;
                multiplierGates.push(new MultiplierGate(this.gameWidth, this.gameHeight, 2));
            });
        }
    }

    /**
     * Spawn a wave of swarm enemies (with homing disabled)
     */
    spawnChaseSwarmWave(swarmEnemies) {
        import('../entities/swarmenemy.js').then(module => {
            const SwarmEnemy = module.SwarmEnemy;
            const cfg = CONFIG.CHASE_SWARM_MODE;
            for (let i = 0; i < cfg.swarmPerSpawn; i++) {
                const x = Math.random() * this.gameWidth;
                const y = -10;
                swarmEnemies.push(new SwarmEnemy(x, y, true)); // true = disable homing
            }
        });
    }

    /**
     * Spawn a Chase Swarm boss (with homing disabled)
     */
    spawnChaseSwarmBoss(swarmBosses, health) {
        import('../entities/swarmboss.js').then(module => {
            const SwarmBoss = module.SwarmBoss;
            const x = this.gameWidth / 2;
            const y = -50;
            swarmBosses.push(new SwarmBoss(x, y, health, true)); // true = disable homing
        });
    }

    /**
     * Spawn a cargo ship in a random lane
     */
    spawnCargoShip(cargoShips, waveNumber) {
        import('../entities/cargoship.js').then(module => {
            const CargoShip = module.CargoShip;
            const cfg = CONFIG.CHASE_SWARM_MODE;
            const lane = Math.floor(Math.random() * 3);
            const laneWidth = this.gameWidth / 3;
            const x = laneWidth * lane + laneWidth / 2;
            cargoShips.push(new CargoShip(x, lane, waveNumber, cfg.cargoShipFallSpeedMultiplier));
        });
    }

}
