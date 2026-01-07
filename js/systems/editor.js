/**
 * Level Editor System
 *
 * Allows players to create custom levels with:
 * - Walls (in 3 lanes)
 * - Enemies (various types)
 * - Rings (positive/negative values)
 * - Multiplier gates (x2, /2)
 *
 * Levels are organized into waves and saved to LocalStorage.
 *
 * @module systems/editor
 */
import { CONFIG } from '../utils/config.js';
import { Wall, WALL_TYPES } from '../entities/wall.js';

export class EditorSystem {
    constructor() {
        this.levelName = 'Untitled';
        this.waves = [this.createEmptyWave()];
        this.currentWaveIndex = 0;
        this.isDirty = false;  // Track unsaved changes

        // Level settings
        this.chaseMode = false;  // Enable Chase mode (red box)
        this.allowVerticalMovement = false;  // Allow player Y dragging
        this.swarmMode = false;  // Enable continuous swarm enemy spawning
        this.ricochetMode = false;  // Bullets bounce off solid walls and screen edges
        this.fingerUpTurnAround = false;  // Turn around to shoot backwards when finger lifts

        // Tool selection
        this.selectedTool = 'ring';  // 'ring', 'enemy', 'wall', 'gate_x2', 'gate_div', 'crate', 'erase'
        this.selectedEnemyType = 'BASIC';
        this.selectedRingValue = 3;
        this.selectedWallType = 'SOLID';
        this.selectedWallValue = 15;  // For DESTRUCTIBLE/HIT_COUNTER_PUSH
        this.selectedWallWidth = 1.0;  // 1.0 = full width, 0.5 = half width
        this.selectedCrateType = 'wingman';  // 'wingman', 'spread', 'rocket'
        this.selectedCrateHits = 15;  // Hits required to unlock

        // Grid settings
        this.gridSize = 40;
        this.laneWidth = CONFIG.GAME_WIDTH / 5;

        // Scroll/pan settings
        this.scrollOffset = 0;  // How far scrolled down (positive = looking further up the wave)
        this.maxWaveHeight = 2000;  // Maximum spawn height per wave

        // Available enemy types for the editor
        this.enemyTypes = ['BASIC', 'FAST', 'TANK', 'SNIPER', 'BOMBER', 'SWARM', 'SHIELD', 'CARGO_SHIP', 'SWARM_BOSS'];
        this.selectedBossHealth = 100;  // Custom health for boss enemies

        // Available wall types
        this.wallTypes = Object.keys(WALL_TYPES);
    }

    // Check if there are unsaved changes
    hasUnsavedChanges() {
        return this.isDirty;
    }

    createEmptyWave() {
        return {
            delay: 0,  // Delay before this wave starts (ms) - instant start for custom levels
            rings: [],    // { x: 0-1 normalized, y: spawn Y, value: number, path: string }
            enemies: [],  // { x: 0-1 normalized, y: spawn Y, type: string }
            walls: [],    // { lane: 0-4, y: spawn Y }
            gates: [],    // { x: 0-1 normalized, y: spawn Y, type: 'multiply' | 'divide' }
            crates: []    // { x: 0-1 normalized, y: spawn Y, type: 'wingman'|'spread'|'rocket', hits: number }
        };
    }

    getCurrentWave() {
        return this.waves[this.currentWaveIndex];
    }

    addWave() {
        this.waves.push(this.createEmptyWave());
        this.currentWaveIndex = this.waves.length - 1;
        this.isDirty = true;
    }

    removeWave() {
        if (this.waves.length > 1) {
            this.waves.splice(this.currentWaveIndex, 1);
            this.currentWaveIndex = Math.min(this.currentWaveIndex, this.waves.length - 1);
            this.isDirty = true;
        }
    }

    nextWave() {
        if (this.currentWaveIndex < this.waves.length - 1) {
            this.currentWaveIndex++;
            this.scrollOffset = 0;  // Reset scroll on wave change
        }
    }

    prevWave() {
        if (this.currentWaveIndex > 0) {
            this.currentWaveIndex--;
            this.scrollOffset = 0;  // Reset scroll on wave change
        }
    }

    // Scroll the view (positive = scroll down to see higher Y values)
    scroll(delta) {
        this.scrollOffset = Math.max(0, Math.min(
            this.maxWaveHeight - 400,  // Leave some visible area
            this.scrollOffset + delta
        ));
    }

    // Place an element at the given screen coordinates
    // editAreaHeight is needed for flipped Y axis calculation
    placeElement(x, y, editAreaWidth, editAreaHeight = 530) {
        const wave = this.getCurrentWave();

        // Normalize X to 0-1 range (relative to edit area, not full width)
        const normalizedX = Math.min(1, Math.max(0, x / editAreaWidth));

        // Convert screen Y to world Y (flipped: higher on screen = higher worldY = spawns later)
        // Formula: worldY = editAreaHeight - screenY + scrollOffset
        const worldY = editAreaHeight - y + this.scrollOffset;

        // Snap Y to grid
        const snappedY = Math.round(worldY / this.gridSize) * this.gridSize;

        // Clamp to valid range
        if (snappedY < 0 || snappedY > this.maxWaveHeight) return;

        switch (this.selectedTool) {
            case 'ring':
                // Check for existing ring at this position
                const existingRing = wave.rings.findIndex(r =>
                    Math.abs(r.x - normalizedX) < 0.1 && Math.abs(r.y - snappedY) < 30
                );
                if (existingRing >= 0) {
                    // Update existing ring value
                    wave.rings[existingRing].value = this.selectedRingValue;
                } else {
                    wave.rings.push({
                        x: normalizedX,
                        y: snappedY,
                        value: this.selectedRingValue,
                        path: 'straight'
                    });
                }
                break;

            case 'enemy':
                // Check for existing enemy at this position
                const existingEnemy = wave.enemies.findIndex(e =>
                    Math.abs(e.x - normalizedX) < 0.1 && Math.abs(e.y - snappedY) < 30
                );
                if (existingEnemy < 0) {
                    const enemyData = {
                        x: normalizedX,
                        y: snappedY,
                        type: this.selectedEnemyType
                    };
                    // Store custom health for bosses
                    if (this.selectedEnemyType === 'SWARM_BOSS') {
                        enemyData.health = this.selectedBossHealth;
                    }
                    wave.enemies.push(enemyData);
                }
                break;

            case 'wall':
                const lane = Math.floor(normalizedX * 5);
                // Check if wall already exists at this lane AND Y position
                const existingWall = wave.walls.findIndex(w =>
                    w.lane === lane && Math.abs(w.y - snappedY) < 30
                );
                if (existingWall >= 0) {
                    // Update existing wall type, value, and width
                    wave.walls[existingWall].type = this.selectedWallType;
                    wave.walls[existingWall].value = this.selectedWallValue;
                    wave.walls[existingWall].width = this.selectedWallWidth;
                } else {
                    wave.walls.push({
                        lane,
                        y: snappedY,
                        type: this.selectedWallType,
                        value: this.selectedWallValue,
                        width: this.selectedWallWidth
                    });
                }
                break;

            case 'gate_x2':
                wave.gates.push({
                    x: normalizedX,
                    y: snappedY,
                    type: 'multiply'
                });
                break;

            case 'gate_div':
                wave.gates.push({
                    x: normalizedX,
                    y: snappedY,
                    type: 'divide'
                });
                break;

            case 'crate':
                // Check for existing crate at this position
                const existingCrate = wave.crates.findIndex(c =>
                    Math.abs(c.x - normalizedX) < 0.1 && Math.abs(c.y - snappedY) < 30
                );
                if (existingCrate < 0) {
                    wave.crates.push({
                        x: normalizedX,
                        y: snappedY,
                        type: this.selectedCrateType,
                        hits: this.selectedCrateHits
                    });
                }
                break;

            case 'erase':
                this.eraseAt(x, y, editAreaWidth, editAreaHeight);
                break;
        }
        this.isDirty = true;
    }

    // Erase element at position
    // editAreaHeight is needed for flipped Y axis calculation
    eraseAt(x, y, editAreaWidth, editAreaHeight = 530) {
        const wave = this.getCurrentWave();
        const normalizedX = x / editAreaWidth;
        // Flipped Y: worldY = editAreaHeight - screenY + scrollOffset
        const worldY = editAreaHeight - y + this.scrollOffset;
        const tolerance = 0.15;
        const yTolerance = 40;

        // Erase rings
        wave.rings = wave.rings.filter(r =>
            Math.abs(r.x - normalizedX) > tolerance || Math.abs(r.y - worldY) > yTolerance
        );

        // Erase gates
        wave.gates = wave.gates.filter(g =>
            Math.abs(g.x - normalizedX) > tolerance || Math.abs(g.y - worldY) > yTolerance
        );

        // Erase enemies
        wave.enemies = wave.enemies.filter(e =>
            Math.abs(e.x - normalizedX) > tolerance || Math.abs(e.y - worldY) > yTolerance
        );

        // Erase walls by lane AND Y position
        const lane = Math.floor(normalizedX * 5);
        wave.walls = wave.walls.filter(w =>
            w.lane !== lane || Math.abs(w.y - worldY) > yTolerance
        );

        // Erase crates
        wave.crates = wave.crates.filter(c =>
            Math.abs(c.x - normalizedX) > tolerance || Math.abs(c.y - worldY) > yTolerance
        );
    }

    // Clear current wave
    clearCurrentWave() {
        this.waves[this.currentWaveIndex] = this.createEmptyWave();
        this.isDirty = true;
    }

    // Set ring value for placement
    setRingValue(value) {
        this.selectedRingValue = Math.max(-9999, Math.min(9999, value));
    }

    // Set ring value directly (for text input)
    setRingValueDirect(value) {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            this.setRingValue(numValue);
            this.isDirty = true;
        }
    }

    incrementRingValue() {
        this.setRingValue(this.selectedRingValue + 1);
    }

    decrementRingValue() {
        this.setRingValue(this.selectedRingValue - 1);
    }

    // Cycle through enemy types
    cycleEnemyType(direction = 1) {
        const currentIndex = this.enemyTypes.indexOf(this.selectedEnemyType);
        const newIndex = (currentIndex + direction + this.enemyTypes.length) % this.enemyTypes.length;
        this.selectedEnemyType = this.enemyTypes[newIndex];
        // Set default health for boss
        if (this.selectedEnemyType === 'SWARM_BOSS') {
            this.selectedBossHealth = 100;
        }
    }

    // Set boss health
    setBossHealth(value) {
        this.selectedBossHealth = Math.max(10, Math.min(9999, value));
    }

    incrementBossHealth() {
        this.setBossHealth(this.selectedBossHealth + 10);
    }

    decrementBossHealth() {
        this.setBossHealth(this.selectedBossHealth - 10);
    }

    // Cycle through wall types
    cycleWallType(direction = 1) {
        const currentIndex = this.wallTypes.indexOf(this.selectedWallType);
        const newIndex = (currentIndex + direction + this.wallTypes.length) % this.wallTypes.length;
        this.selectedWallType = this.wallTypes[newIndex];
        // Set default value based on wall type
        if (this.selectedWallType === 'DESTRUCTIBLE') {
            this.selectedWallValue = 5;
        } else if (this.selectedWallType === 'HIT_COUNTER_PUSH') {
            this.selectedWallValue = 15;
        }
    }

    // Get wall type display info
    getWallTypeInfo() {
        return WALL_TYPES[this.selectedWallType] || WALL_TYPES.SOLID;
    }

    // Set wall value (for DESTRUCTIBLE and HIT_COUNTER_PUSH)
    setWallValue(value) {
        this.selectedWallValue = Math.max(1, Math.min(9999, value));
    }

    incrementWallValue() {
        this.setWallValue(this.selectedWallValue + 1);
    }

    decrementWallValue() {
        this.setWallValue(this.selectedWallValue - 1);
    }

    // Toggle wall width (full/half)
    toggleWallWidth() {
        this.selectedWallWidth = this.selectedWallWidth === 1.0 ? 0.5 : 1.0;
    }

    // Cycle through crate types
    cycleCrateType(direction = 1) {
        const types = ['wingman', 'spread', 'rocket'];
        const currentIndex = types.indexOf(this.selectedCrateType);
        const newIndex = (currentIndex + direction + types.length) % types.length;
        this.selectedCrateType = types[newIndex];
    }

    // Set crate hits required
    setCrateHits(value) {
        this.selectedCrateHits = Math.max(1, Math.min(999, value));
    }

    incrementCrateHits() {
        this.setCrateHits(this.selectedCrateHits + 5);
    }

    decrementCrateHits() {
        this.setCrateHits(this.selectedCrateHits - 5);
    }

    // Set level name
    setLevelName(name) {
        this.levelName = name.trim() || 'Untitled';
        this.isDirty = true;
    }

    // Toggle Chase mode
    toggleChaseMode() {
        this.chaseMode = !this.chaseMode;
        this.isDirty = true;
        return this.chaseMode;
    }

    // Toggle vertical movement
    toggleVerticalMovement() {
        this.allowVerticalMovement = !this.allowVerticalMovement;
        this.isDirty = true;
        return this.allowVerticalMovement;
    }

    // Toggle swarm mode
    toggleSwarmMode() {
        this.swarmMode = !this.swarmMode;
        this.isDirty = true;
        return this.swarmMode;
    }

    // Toggle ricochet mode
    toggleRicochetMode() {
        this.ricochetMode = !this.ricochetMode;
        this.isDirty = true;
        return this.ricochetMode;
    }

    // Toggle finger up turn around
    toggleFingerUpTurnAround() {
        this.fingerUpTurnAround = !this.fingerUpTurnAround;
        this.isDirty = true;
        return this.fingerUpTurnAround;
    }

    // Serialize level for storage
    serialize() {
        return {
            version: 2,  // Version 2: 5-lane system
            name: this.levelName,
            waves: this.waves.map(wave => ({
                delay: wave.delay,
                rings: [...wave.rings],
                enemies: [...wave.enemies],
                walls: [...wave.walls],
                gates: [...wave.gates],
                crates: [...(wave.crates || [])]
            })),
            settings: {
                chaseMode: this.chaseMode,
                allowVerticalMovement: this.allowVerticalMovement,
                swarmMode: this.swarmMode,
                ricochetMode: this.ricochetMode,
                fingerUpTurnAround: this.fingerUpTurnAround
            },
            createdAt: Date.now()
        };
    }

    // Load from serialized data
    deserialize(data) {
        if (!data) return false;

        // Migrate old 3-lane levels (version 1) to 5-lane system (version 2)
        if (!data.version || data.version === 1) {
            console.log(`Migrating "${data.name}" from 3-lane to 5-lane system...`);

            // Migrate walls: shift lanes 0→1, 1→2, 2→3 to center them in 5-lane system
            if (data.waves) {
                data.waves.forEach(wave => {
                    if (wave.walls) {
                        wave.walls = wave.walls.map(w => ({
                            ...w,
                            lane: w.lane + 1  // Shift to center lanes
                        }));
                    }
                });
            }

            data.version = 2;
        }

        this.levelName = data.name || 'Untitled';
        this.waves = data.waves.map(wave => ({
            delay: wave.delay !== undefined ? wave.delay : 0,  // Use saved delay or 0 for instant start
            rings: wave.rings || [],
            enemies: wave.enemies || [],
            walls: wave.walls || [],
            gates: wave.gates || [],
            crates: wave.crates || []
        }));

        // Load level settings (with defaults for backward compatibility)
        this.chaseMode = data.settings?.chaseMode || false;
        this.allowVerticalMovement = data.settings?.allowVerticalMovement || false;
        this.swarmMode = data.settings?.swarmMode || false;
        this.ricochetMode = data.settings?.ricochetMode || false;
        this.fingerUpTurnAround = data.settings?.fingerUpTurnAround || false;

        this.currentWaveIndex = 0;
        this.isDirty = false;
        return true;
    }

    // Save level to LocalStorage
    // If name contains "(G)", also show JSON for adding to global-levels.json
    saveLevel() {
        const levels = EditorSystem.getSavedLevels();
        const levelData = this.serialize();
        levels[this.levelName] = levelData;
        localStorage.setItem('ringSquadron_customLevels', JSON.stringify(levels));
        this.isDirty = false;

        // If name contains "(G)", show JSON for global sharing
        if (this.levelName.includes('(G)')) {
            const jsonStr = JSON.stringify(levelData, null, 2);
            // Copy to clipboard if available
            if (navigator.clipboard) {
                navigator.clipboard.writeText(`"${this.levelName}": ${jsonStr}`).then(() => {
                    alert(`Global level saved!\n\nJSON copied to clipboard.\nAdd it to global-levels.json in the repo.`);
                }).catch(() => {
                    prompt('Copy this JSON to add to global-levels.json:', `"${this.levelName}": ${jsonStr}`);
                });
            } else {
                prompt('Copy this JSON to add to global-levels.json:', `"${this.levelName}": ${jsonStr}`);
            }
        }

        return true;
    }

    // Save level and return data for immediate playback
    saveAndPlay() {
        this.saveLevel();
        return {
            name: this.levelName,
            data: this.serialize()
        };
    }

    // Load level from LocalStorage
    loadLevel(name) {
        const levels = EditorSystem.getSavedLevels();
        if (levels[name]) {
            return this.deserialize(levels[name]);
        }
        return false;
    }

    // Get list of saved levels
    static getSavedLevels() {
        try {
            return JSON.parse(localStorage.getItem('ringSquadron_customLevels') || '{}');
        } catch (e) {
            return {};
        }
    }

    // Delete a saved level
    static deleteLevel(name) {
        const levels = EditorSystem.getSavedLevels();
        delete levels[name];
        localStorage.setItem('ringSquadron_customLevels', JSON.stringify(levels));
    }

    // Get count of elements in current wave
    getWaveStats() {
        const wave = this.getCurrentWave();
        return {
            rings: wave.rings.length,
            enemies: wave.enemies.length,
            walls: wave.walls.length,
            gates: wave.gates.length,
            crates: wave.crates.length
        };
    }

    // Reset editor to blank state
    reset() {
        this.levelName = 'Untitled';
        this.waves = [this.createEmptyWave()];
        this.currentWaveIndex = 0;
        this.selectedTool = 'ring';
        this.selectedEnemyType = 'BASIC';
        this.selectedRingValue = 3;
        this.selectedWallType = 'SOLID';
        this.scrollOffset = 0;
        this.isDirty = false;
    }
}
