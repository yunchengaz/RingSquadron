/**
 * Wall Entity
 *
 * Various wall types with different behaviors:
 * - SOLID: Blocks everything, indestructible
 * - BOOST: Speed boost track, doesn't block bullets
 * - ENEMY_PASS: Blocks player bullets, lets enemy bullets through
 * - PLAYER_PASS: Blocks enemy bullets, lets player bullets through
 * - DESTRUCTIBLE: Has health, can be destroyed
 * - PUSHABLE: Gets pushed up when hit, accelerates
 *
 * @module entities/wall
 */
import { CONFIG } from '../utils/config.js';

// Wall type definitions
export const WALL_TYPES = {
    SOLID: {
        name: 'Solid',
        color: '#505064',
        stripeColor: '#ff4444',
        text: 'DANGER',
        textColor: '#ffaaaa',
        blocksPlayerBullets: true,
        blocksEnemyBullets: true,
        blocksPlayer: true,
        blocksEnemies: true,
        destructible: false,
        pushable: false,
        boosts: false
    },
    BOOST: {
        name: 'Boost',
        color: '#225522',
        stripeColor: '#44ff44',
        text: 'BOOST',
        textColor: '#88ff88',
        blocksPlayerBullets: false,
        blocksEnemyBullets: false,
        blocksPlayer: false,
        blocksEnemies: false,
        destructible: false,
        pushable: false,
        boosts: true,
        boostAmount: 1.5, // Boost level added (stacks up to 5)
        pushesRedBox: true,
        redBoxPushAmount: 50
    },
    ENEMY_PASS: {
        name: 'Enemy Pass',
        color: '#442244',
        stripeColor: '#aa44aa',
        text: 'ENEMY',
        textColor: '#dd88dd',
        blocksPlayerBullets: true,
        blocksEnemyBullets: false,
        blocksPlayer: true,
        blocksEnemies: false,
        destructible: false,
        pushable: false,
        boosts: false
    },
    PLAYER_PASS: {
        name: 'Player Pass',
        color: '#224444',
        stripeColor: '#44aaaa',
        text: 'ALLY',
        textColor: '#88dddd',
        blocksPlayerBullets: false,
        blocksEnemyBullets: true,
        blocksPlayer: false,
        blocksEnemies: true,
        destructible: false,
        pushable: false,
        boosts: false
    },
    DESTRUCTIBLE: {
        name: 'Destructible',
        color: '#444422',
        stripeColor: '#aaaa44',
        text: 'BREAK',
        textColor: '#dddd88',
        blocksPlayerBullets: true,
        blocksEnemyBullets: true,
        blocksPlayer: true,
        blocksEnemies: true,
        destructible: true,
        pushable: false,
        boosts: false,
        maxHealth: 5
    },
    PUSHABLE: {
        name: 'Pushable',
        color: '#443322',
        stripeColor: '#aa8844',
        text: 'PUSH',
        textColor: '#ddbb88',
        blocksPlayerBullets: true,
        blocksEnemyBullets: true,
        blocksPlayer: true,
        blocksEnemies: true,
        destructible: false,
        pushable: true,
        boosts: false
    },
    GOLDEN_BOOST: {
        name: 'Golden Boost',
        color: '#aa7700',
        stripeColor: '#ffdd00',
        text: '★GOLD★',
        textColor: '#ffff88',
        blocksPlayerBullets: false,
        blocksEnemyBullets: false,
        blocksPlayer: false,
        blocksEnemies: false,
        destructible: false,
        pushable: false,
        boosts: true,
        boostAmount: 3,  // Much stronger boost
        isGolden: true,
        invincibilityDuration: 3000,  // 3 seconds
        resetsRedBox: true
    },
    HIT_COUNTER_PUSH: {
        name: 'Hit Counter Push',
        color: '#ff9933',
        stripeColor: '#ffdd44',
        text: 'PUSH',
        textColor: '#ffff99',
        blocksPlayerBullets: false,  // Bullets pass through and count
        blocksEnemyBullets: false,
        blocksPlayer: true,
        blocksEnemies: true,
        destructible: false,
        pushable: true,
        boosts: false,
        hitCounter: true,
        hitsRequired: 15  // Default, can be overridden in constructor
    }
};

export class Wall {
    constructor(x, y, lane, type = 'SOLID', hitsRequired = null, widthMultiplier = 1.0, laneCount = 3) {
        this.x = x;
        this.y = y;
        this.lane = lane; // 0 = left, 1 = center, 2 = right (or 0-4 for 5-lane custom levels)
        this.active = true;
        this.type = type;
        this.typeData = WALL_TYPES[type] || WALL_TYPES.SOLID;
        this.laneCount = laneCount; // Number of lanes (3 for normal modes, 5 for custom editor)

        // Dimensions - span most of the lane width
        const laneWidth = CONFIG.GAME_WIDTH / laneCount;
        this.width = (laneWidth - 20) * widthMultiplier; // Leave small gaps between lanes, apply multiplier
        this.height = 30;

        // Movement - same speed as rings
        this.speed = CONFIG.RING_SPEED * 1.2;
        this.vy = this.speed; // Vertical velocity (for pushable walls)

        // Health for destructible walls
        this.health = this.typeData.destructible ? this.typeData.maxHealth : Infinity;
        this.maxHealth = this.health;

        // Pushable wall state
        this.pushVelocity = 0; // Upward velocity from being pushed

        // Hit counter for push walls (Swarm mode)
        this.hitCount = 0;
        this.hitsRequired = hitsRequired || this.typeData.hitsRequired || 0;
        this.triggered = false;

        // Visual effects
        this.pulseTimer = 0;
        this.hitFlash = 0;
        this.warningShown = false;

        // Track if boost has been collected (prevent multiple triggers)
        this.boostCollected = false;
    }

    update(deltaTime, realDeltaTime = null) {
        if (!this.active) return;

        const dt = deltaTime / 16;
        // Use real time for animations (not affected by boost)
        const realDt = (realDeltaTime !== null ? realDeltaTime : deltaTime) / 16;

        // Auto-push when hit threshold reached (Swarm mode hit-counter walls)
        if (this.typeData.hitCounter && !this.triggered && this.hitCount >= this.hitsRequired) {
            this.triggered = true;
            this.pushVelocity = 3;  // Strong initial push
        }

        // Pushable walls have special velocity handling
        if (this.typeData.pushable && this.pushVelocity !== 0) {
            // Move upward with push velocity
            this.y -= this.pushVelocity * dt;
            // Gradually slow down push (friction)
            this.pushVelocity *= 0.995;
            if (Math.abs(this.pushVelocity) < 0.1) {
                this.pushVelocity = 0;
            }
            // If pushed off top of screen, deactivate
            if (this.y < -50) {
                this.active = false;
                return;
            }
        } else if (!this.typeData.pushable || !this.triggered) {
            // Normal downward movement (only if not being pushed)
            this.y += this.speed * dt;
        }
        // Note: Triggered push walls with no velocity don't move (waiting for hits)

        // Pulse animation uses real time (not affected by boost)
        this.pulseTimer += 0.08 * realDt;

        // Hit flash decay
        if (this.hitFlash > 0) {
            this.hitFlash -= 0.1 * dt;
        }

        // Deactivate when off screen
        if (this.y > CONFIG.GAME_HEIGHT + 50) {
            this.active = false;
        }
    }

    // Take damage (for destructible walls)
    takeDamage(amount = 1) {
        if (!this.typeData.destructible) return false;

        this.health -= amount;
        this.hitFlash = 1;

        if (this.health <= 0) {
            this.active = false;
            return true; // Destroyed
        }
        return false;
    }

    // Push the wall upward (for pushable walls)
    push(force = 2) {
        if (!this.typeData.pushable) return;

        // Each hit adds velocity
        this.pushVelocity += force;
        this.hitFlash = 1;
    }

    // Register bullet hit for hit-counter walls (Swarm mode)
    registerBulletHit() {
        if (this.typeData.hitCounter && !this.triggered) {
            this.hitCount++;
            this.hitFlash = 1;
            return this.hitCount >= this.hitsRequired;  // Returns true when triggered
        }
        return false;
    }

    // Check if wall collided with another immovable wall
    checkWallCollision(otherWall) {
        if (!this.typeData.pushable || !this.active || !otherWall.active) return false;
        if (this === otherWall) return false;

        // Only check if we're moving upward
        if (this.pushVelocity <= 0) return false;

        // Check if other wall is immovable (solid or another type that blocks)
        if (!otherWall.typeData.pushable) {
            const bounds = this.getBounds();
            const otherBounds = otherWall.getBounds();

            // AABB collision
            if (bounds.x < otherBounds.x + otherBounds.width &&
                bounds.x + bounds.width > otherBounds.x &&
                bounds.y < otherBounds.y + otherBounds.height &&
                bounds.y + bounds.height > otherBounds.y) {
                // Stop at the collision point
                this.y = otherBounds.y + otherBounds.height + this.height / 2 + 1;
                this.pushVelocity = 0;
                return true;
            }
        }
        return false;
    }

    draw(renderer) {
        if (!this.active) return;

        const ctx = renderer.ctx;
        const left = this.x - this.width / 2;
        const top = this.y - this.height / 2;
        const typeData = this.typeData;

        // Pulse effect
        const pulse = Math.sin(this.pulseTimer * 4) * 0.15 + 0.85;

        // Hit flash effect
        const flashMod = this.hitFlash > 0 ? 1 + this.hitFlash * 0.5 : 1;

        // Main wall body
        if (this.hitFlash > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = this.adjustBrightness(typeData.color, pulse);
        }
        ctx.fillRect(left, top, this.width, this.height);

        // Border
        ctx.strokeStyle = this.adjustBrightness(typeData.color, 1.3);
        ctx.lineWidth = 2;
        ctx.strokeRect(left, top, this.width, this.height);

        // Hazard stripes on edges
        const stripeWidth = 8;
        ctx.fillStyle = typeData.stripeColor;
        ctx.fillRect(left, top, stripeWidth, this.height);
        ctx.fillRect(left + this.width - stripeWidth, top, stripeWidth, this.height);

        // Boost track has arrows instead of text
        if (typeData.boosts) {
            this.drawBoostArrows(ctx, left, top);
        } else if (typeData.hitCounter && !this.triggered) {
            // Hit counter for hit-counter push walls (Swarm mode) - replaces text
            // Center line pattern
            ctx.strokeStyle = this.adjustBrightness(typeData.color, 0.7);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(left + stripeWidth + 5, this.y);
            ctx.lineTo(left + this.width - stripeWidth - 5, this.y);
            ctx.stroke();

            // Display hits remaining instead of "PUSH" text
            const remaining = this.hitsRequired - this.hitCount;
            ctx.fillStyle = '#ffff00';
            ctx.font = `bold 18px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(remaining, this.x, this.y);
        } else {
            // Center line pattern
            ctx.strokeStyle = this.adjustBrightness(typeData.color, 0.7);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(left + stripeWidth + 5, this.y);
            ctx.lineTo(left + this.width - stripeWidth - 5, this.y);
            ctx.stroke();

            // Type text
            ctx.fillStyle = typeData.textColor;
            ctx.font = `bold 10px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(typeData.text, this.x, this.y);
        }

        // Health bar for destructible walls
        if (typeData.destructible && this.health < this.maxHealth) {
            this.drawHealthBar(ctx, left, top);
        }

        // Push velocity indicator for pushable walls (when active)
        if (typeData.pushable && this.pushVelocity > 0) {
            ctx.fillStyle = `rgba(255, 200, 100, ${Math.min(1, this.pushVelocity / 5)})`;
            ctx.font = `bold 8px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`↑${this.pushVelocity.toFixed(1)}`, this.x, this.y - 20);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    drawBoostArrows(ctx, left, top) {
        // Arrows move from bottom to top to show boost direction
        const arrowOffset = (this.pulseTimer * 80) % 20; // Faster animation, moving upward
        ctx.strokeStyle = this.typeData.stripeColor;
        ctx.lineWidth = 3;

        // Draw multiple upward-pointing chevrons
        for (let i = -1; i < 3; i++) {
            const arrowX = this.x;
            // Start from bottom and move upward (subtract offset to go up)
            const arrowY = top + this.height - 8 - i * 20 - arrowOffset;

            if (arrowY > top + 2 && arrowY < top + this.height - 2) {
                // Draw upward chevron (^)
                ctx.beginPath();
                ctx.moveTo(arrowX - 12, arrowY + 6);
                ctx.lineTo(arrowX, arrowY - 6);
                ctx.lineTo(arrowX + 12, arrowY + 6);
                ctx.stroke();
            }
        }
    }

    drawHealthBar(ctx, left, top) {
        const barWidth = this.width - 20;
        const barHeight = 4;
        const barX = left + 10;
        const barY = top - 8;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : (healthPercent > 0.25 ? '#ffaa00' : '#ff4444');
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    adjustBrightness(hexColor, factor) {
        const r = Math.min(255, Math.floor(parseInt(hexColor.slice(1, 3), 16) * factor));
        const g = Math.min(255, Math.floor(parseInt(hexColor.slice(3, 5), 16) * factor));
        const b = Math.min(255, Math.floor(parseInt(hexColor.slice(5, 7), 16) * factor));
        return `rgb(${r}, ${g}, ${b})`;
    }

    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    // Helper getters for collision system
    blocksPlayerBullets() {
        return this.typeData.blocksPlayerBullets;
    }

    blocksEnemyBullets() {
        return this.typeData.blocksEnemyBullets;
    }

    blocksPlayer() {
        return this.typeData.blocksPlayer;
    }

    blocksEnemies() {
        return this.typeData.blocksEnemies;
    }

    isBoost() {
        return this.typeData.boosts;
    }

    getBoostAmount() {
        return this.typeData.boostAmount || 1;
    }

    /**
     * Get the center X position for a given lane
     * @param {number} lane - Lane index
     * @param {number} laneCount - Total number of lanes (default 3)
     * @returns {number} Center X position
     */
    static getLaneX(lane, laneCount = 3) {
        const laneWidth = CONFIG.GAME_WIDTH / laneCount;
        return laneWidth * lane + laneWidth / 2;
    }

    /**
     * Get the lane index for a given X position
     * @param {number} x - X position
     * @param {number} laneCount - Total number of lanes (default 3)
     * @returns {number} Lane index
     */
    static getLaneFromX(x, laneCount = 3) {
        const laneWidth = CONFIG.GAME_WIDTH / laneCount;
        return Math.floor(x / laneWidth);
    }

    /**
     * Get list of all wall type keys
     */
    static getTypes() {
        return Object.keys(WALL_TYPES);
    }
}
