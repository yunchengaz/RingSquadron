/**
 * Ring Squadron - Game Configuration
 *
 * Central configuration file for all game constants.
 * Modify values here to tune game balance without changing code.
 *
 * @module config
 */

export const CONFIG = {
    // ========================================
    // CANVAS & DISPLAY
    // ========================================
    GAME_WIDTH: 400,
    GAME_HEIGHT: 700,

    // Player settings
    PLAYER_HEALTH: 100,
    PLAYER_SPEED: 8,
    PLAYER_FIRE_RATE: 220, // ms between shots (slower for smoother feel)
    PLAYER_BULLET_DAMAGE: 10,
    PLAYER_BULLET_SPEED: 8, // Slower bullets

    // Ally settings
    ALLY_HEALTH: 30,
    ALLY_FIRE_RATE: 400, // Slower ally firing
    ALLY_BULLET_DAMAGE: 5,
    ALLY_FORMATION_SPACING: 15, // Tighter for cloud formation
    ALLY_SCALE: 0.125, // 1/8th size
    ALLY_DISPLAY_CAP: 200, // Max allies to render
    ALLY_DAMAGE_SCALE_START: 200, // Start scaling damage after this many
    ALLY_DAMAGE_SCALE_FACTOR: 0.005, // Damage multiplier per ally over cap

    // Enemy settings - Slower speeds for smoother gameplay
    ENEMY_TYPES: {
        BASIC: {
            health: 20,
            speed: 1.5,      // Slower, smoother movement
            fireRate: 0,     // No firing - collision threat only
            bulletDamage: 0,
            gold: 10,
            score: 100,
            special: 'ram'   // Just rams player
        },
        BUS: {
            health: 100,
            speed: 0.3,      // Slow approach
            chargeSpeed: 6,  // Slower charge
            fireRate: 0,     // No shooting
            bulletDamage: 0,
            gold: 75,
            score: 500,
            special: 'charge',
            ramDamage: 40    // Heavy collision damage
        },
        FAST: {
            health: 15,
            speed: 2.5,      // Reduced from 4
            fireRate: 3200,  // Slower firing
            bulletDamage: 8,
            gold: 15,
            score: 150
        },
        TANK: {
            health: 50,
            speed: 0.6,      // Slower
            fireRate: 2200,  // Slower firing
            bulletDamage: 18,
            gold: 30,
            score: 300
        },
        BOMBER: {
            health: 25,
            speed: 1.0,      // Slower
            fireRate: 4500,  // Slower firing
            bulletDamage: 25,
            gold: 25,
            score: 200,
            special: 'bomb'
        },
        SNIPER: {
            health: 12,
            speed: 0.4,      // Slower
            fireRate: 4000,  // Slower firing
            bulletDamage: 30,
            gold: 20,
            score: 250,
            special: 'aimed'
        },
        SWARM: {
            health: 8,
            speed: 2.0,      // Slower
            fireRate: 0,
            bulletDamage: 10,
            gold: 5,
            score: 50,
            special: 'kamikaze'
        },
        SHIELD: {
            health: 40,
            speed: 1.0,      // Slower
            fireRate: 3200,  // Slower firing
            bulletDamage: 12,
            gold: 35,
            score: 350,
            special: 'shield'
        },
        CARRIER: {
            health: 60,
            speed: 0.5,      // Slower
            fireRate: 0,
            bulletDamage: 0,
            gold: 50,
            score: 400,
            special: 'spawn'
        },
        DRONE: {
            health: 10,
            speed: 1.8,      // Slower
            fireRate: 3000,  // Slower firing
            bulletDamage: 6,
            gold: 5,
            score: 75
        }
    },

    // Endless mode scaling
    ENDLESS_SCALING: {
        healthPerWave: 0.15,      // +15% enemy health per wave
        speedPerWave: 0.03,       // +3% enemy speed per wave
        damagePerWave: 0.08,      // +8% enemy damage per wave
        spawnRatePerWave: 0.05,   // +5% spawn rate per wave
        maxSpeedMultiplier: 3,    // Cap speed at 3x
        maxHealthMultiplier: 20,  // Cap health at 20x
        eliteChancePerWave: 0.02, // +2% elite spawn chance per wave
        eliteHealthBonus: 2,      // Elites have 2x health
        eliteDamageBonus: 1.5     // Elites deal 1.5x damage
    },

    // Ring settings
    RING_BASE_VALUE: 1,
    RING_SPEED: 1.0, // Slower rings for smoother feel

    // Spawning
    ENEMY_SPAWN_INTERVAL: 2000,
    RING_SPAWN_INTERVAL: 3000,

    // Colors
    COLORS: {
        BACKGROUND: '#0a0a12',
        PLAYER: '#00ff88',
        ALLY: '#00cc66',
        ENEMY: '#ff4444',
        ENEMY_BULLET: '#ff6666',
        PLAYER_BULLET: '#88ffff',
        RING: '#44aaff',           // Positive rings are blue
        RING_NEGATIVE: '#ff4466',  // Negative rings are red
        RING_TEXT: '#ffffff',
        HUD: '#ffffff',
        GOLD: '#ffd700',
        HEALTH_BAR: '#00ff00',
        HEALTH_BAR_BG: '#333333',
        STAR_NEAR: '#ffffff',
        STAR_MID: '#888899',
        STAR_FAR: '#444455'
    },

    // Font - smaller for zoom out effect
    FONT_SIZE: 8,
    FONT_SIZE_HUD: 14,
    FONT_FAMILY: 'Courier New, monospace',

    // ========================================
    // PARALLAX STARS
    // ========================================
    STAR_LAYERS: [
        { count: 30, speed: 0.08, size: 1, color: 'FAR' },
        { count: 20, speed: 0.15, size: 1.5, color: 'MID' },
        { count: 10, speed: 0.3, size: 2, color: 'NEAR' }
    ],

    // ========================================
    // TIMING & INTERVALS
    // ========================================
    SHOOTING_STAR_INTERVAL: 3000,    // ms between shooting stars on menu
    GAME_OVER_DELAY: 1500,           // ms before allowing restart
    BOSS_MISSILE_DELAY: 200,         // ms between boss missile spawns

    // ========================================
    // EFFECTS & RANGES
    // ========================================
    MAGNET_RANGE: 150,               // Power-up magnet attraction range
    POWERUP_DROP_CHANCE: 0.08,       // 8% chance to drop power-up

    // ========================================
    // RING SETTINGS
    // ========================================
    RING_MAX_VALUE: 99,              // Maximum ring value cap
    RING_MIN_VALUE: -99,             // Minimum ring value cap
    RING_BULLET_PADDING: 5,          // Collision padding for bullets

    // ========================================
    // BOSS SETTINGS
    // ========================================
    BOSS_BULLET_DAMAGE: 15,          // Default boss bullet damage
    BOSS_BULLET_SPEED: 2.5,          // Slower boss bullets for smoother feel

    // ========================================
    // CARRIER ENEMY
    // ========================================
    CARRIER_SPAWN_COOLDOWN: 5000,    // ms between carrier drone spawns

    // ========================================
    // CHASE MODE SETTINGS
    // ========================================
    CHASE_MODE: {
        // Wave Configuration
        totalWaves: 12,                 // 12 waves = ~2-3 mins
        waveDuration: 12000,            // 12 seconds per wave

        // Red Box
        redBoxStartY: 665,              // Start at bottom 5% of screen (700 * 0.95 = 665)
        redBoxSafetyTime: 5000,         // 5s grace period
        redBoxBaseGrowthRate: 0.08,     // Base pixels/frame
        redBoxWaveScaling: 0.015,       // +1.5% speed per wave
        redBoxMaxHeight: 630,           // Can go up to 90% of screen (700 - 70 = 630)
        redBoxMinY: 70,                 // Upper limit: 10% from top (90% of screen)
        redBoxMaxY: 665,                // Lower limit: bottom 5% of screen
        redBoxDamageSlowdown: 0.5,      // 50% speed when hit
        redBoxSlowDuration: 2000,       // 2s slowdown
        redBoxFlashDuration: 300,       // Visual flash
        redBoxPushAmount: 50,           // Pixels to push down on regular boost

        // Cargo Ships
        cargoShipBaseInterval: 5000,    // Base spawn interval
        cargoShipMinInterval: 2000,     // Min (late waves)
        cargoShipEngineHealth: 30,      // Base health
        cargoShipDamage: 25,            // Collision damage
        cargoShipDriftSpeed: 0.8,       // Drift down speed
        cargoShipLockY: 100,            // Lock position
        cargoShipScore: 50,             // Score reward
        cargoShipHealthPerWave: 3,      // +3 HP per wave

        // Boost Pads
        boostPadInterval: 4000,         // Regular every 4s
        goldenBoostInterval: 25000,     // Golden every 25s
        goldenBoostChance: 0.6,         // 60% when timer up

        // Difficulty
        spawnRateIncrease: 0.08         // -8% interval per wave
    },

    // ========================================
    // SWARM MODE
    // ========================================
    SWARM_MODE: {
        // Small enemies
        swarmEnemySize: 3,
        swarmEnemySpeed: 1.2,
        swarmEnemyHomingThreshold: 0.3,  // 30% down screen
        swarmSpawnRate: 50,              // ms between spawns (20 per second)
        swarmPerSpawn: 10,               // Enemies per spawn

        // Bosses
        bossSpawnInterval: 15000,        // 15s between bosses after #2
        bossHealthBase: 100,
        bossHealthScaling: 2,            // Exponential multiplier

        // Lives
        playerLives: 5,

        // Multiplier gate
        gateWidth: 0.2,                  // 20% of screen
        gateSpeed: 2,
        gateMultiplier: 2,

        // Scores
        swarmEnemyScore: 10,
        swarmBossScore: 1000
    },

    // ========================================
    // CHASE SWARM MODE (Hybrid)
    // ========================================
    CHASE_SWARM_MODE: {
        // Red Box (from Chase mode)
        redBoxStartY: 665,               // Start at bottom 5% of screen (700 * 0.95 = 665)
        redBoxSafetyTime: 5000,          // 5s grace period
        redBoxBaseGrowthRate: 0.18,      // Faster base growth (was 0.08)
        redBoxWaveScaling: 0.015,
        redBoxMaxHeight: 630,            // Can go up to 90% of screen (700 - 70 = 630)
        redBoxMinY: 70,                  // Upper limit: 10% from top (90% of screen)
        redBoxMaxY: 665,                 // Lower limit: bottom 5% of screen
        redBoxPushAmount: 25,            // Reduced 50% for less player push

        // Poise Gauge System
        poiseMax: 100,                   // Maximum poise value (both positive and negative)
        poiseDecayRate: 0.008,           // Slower natural decay towards center per frame
        poiseEnemyImpact: -1.5,          // Regular enemy reaching bottom (reduced from -5)
        poiseBossImpact: -8,             // Boss/elite enemy reaching bottom (reduced from -25)
        poiseShootImpact: 2,             // Player bullet hitting red box (reduced from 8)
        poiseNegativeSpeedMult: 2.5,     // Red box moves 2.5x faster when negative
        poisePositiveSpeedMult: 0.5,     // Red box moves 0.5x speed when positive (was 0.3)
        poiseMaxNegativeJump: 100,       // Pixels to jump up when reaching full negative
        poiseMaxPositiveKnockdown: 120,  // Pixels to knock down when reaching full positive (increased)

        // Red Box speed increase from enemies (legacy - now handled by poise)
        enemySpeedBoost: 0.02,           // +2% speed per enemy that reaches box
        bossSpeedBoost: 0.1,             // +10% speed per boss that reaches box

        // Cargo Ships (trucks)
        cargoShipBaseInterval: 8000,     // Slower spawn rate
        cargoShipMinInterval: 4000,
        cargoShipEngineHealth: 30,
        cargoShipDamage: 25,
        cargoShipDriftSpeed: 0.8,
        cargoShipFallSpeedMultiplier: 3.9, // 3.9x faster fall when engine destroyed (30% faster than 3x)

        // Swarm enemies (from Swarm mode)
        swarmSpawnRate: 50,
        swarmPerSpawn: 10,
        swarmEnemySpeed: 1.2,
        swarmEnemyNoHoming: true,        // Don't track player

        // Bosses
        bossSpawnInterval: 20000,        // 20s between bosses
        bossHealthBase: 100,
        bossHealthScaling: 2,
        bossNoHoming: true,              // Don't track player

        // Push walls
        pushWallInterval: 12000,         // 12s between push walls
        pushWallWidthMultiplier: 1.15,   // 15% wider

        // Boost pads
        boostPadInterval: 6000,

        // Lives
        playerLives: 5
    }
};
