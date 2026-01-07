/**
 * Cargo Ship Entity - Chase Mode
 *
 * Upward-flying enemy with destructible engine.
 * Spawns from top, drifts down continuously reacting to player boost speed.
 * When engine destroyed, drifts faster toward red box.
 *
 * @module entities/cargoship
 */
import { CONFIG } from '../utils/config.js';
import { SPRITES } from '../utils/sprites.js';

export class CargoShip {
    constructor(x, lane, waveNumber, fallSpeedMultiplier = 1.5) {
        const cfg = CONFIG.CHASE_MODE;

        this.x = x;
        this.y = -100;  // Spawn above screen
        this.lane = lane;

        // Size
        this.width = 60;
        this.height = 80;

        // Engine properties
        this.engineHealth = cfg.cargoShipEngineHealth + (waveNumber * cfg.cargoShipHealthPerWave);
        this.maxEngineHealth = this.engineHealth;
        this.engineDestroyed = false;
        this.engineWidth = 40;
        this.engineHeight = 20;

        // Movement states
        this.state = 'spawning';  // spawning -> drifting -> locked -> destroyed
        this.driftSpeed = cfg.cargoShipDriftSpeed;
        this.lockY = cfg.cargoShipLockY;
        this.fallSpeedMultiplier = fallSpeedMultiplier;  // Multiplier for fall speed when destroyed

        // Visual
        this.flashTimer = 0;

        // Rotation physics (for when falling)
        this.angle = 0;  // Current rotation in radians
        this.angularVelocity = 0;  // Rotation speed (rad/frame)
        this.angularDamping = 0.98;  // Slow down rotation over time

        // Linear physics (for juggling when destroyed)
        this.velocityX = 0;
        this.velocityY = 0;
        this.gravity = 0.15;  // Downward acceleration per frame
        this.maxFallSpeed = 8;  // Terminal velocity
        this.horizontalDrag = 0.96;  // Slow down horizontal movement

        // State
        this.active = true;
    }

    update(deltaTime, boostedDt, playerY) {
        const dt = deltaTime / 16; // Normalize to ~60fps
        const boostedDtNormalized = boostedDt / 16; // Use boosted delta for movement

        // Update flash effect
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
        }

        // Update rotation (only when destroyed)
        if (this.state === 'destroyed') {
            this.angle += this.angularVelocity;
            this.angularVelocity *= this.angularDamping;  // Gradually slow down rotation
        }

        switch (this.state) {
            case 'spawning':
                // Drift down slowly, reacting to player boost
                this.y += this.driftSpeed * boostedDtNormalized;

                // Once fully visible, start drifting
                if (this.y >= 0) {
                    this.state = 'drifting';
                }
                break;

            case 'drifting':
                // Continue drifting down continuously, reacting to player boost
                this.y += this.driftSpeed * boostedDtNormalized;
                // No longer lock in place - always drift
                break;

            case 'destroyed':
                // Physics-based movement for juggling
                // Apply gravity
                this.velocityY += this.gravity * dt;
                
                // Cap fall speed
                if (this.velocityY > this.maxFallSpeed) {
                    this.velocityY = this.maxFallSpeed;
                }
                
                // Apply horizontal drag
                this.velocityX *= this.horizontalDrag;
                
                // Update position based on velocity
                this.x += this.velocityX * boostedDtNormalized;
                this.y += this.velocityY * boostedDtNormalized;
                
                // Keep within screen bounds
                const halfWidth = this.width / 2;
                const halfHeight = this.height / 2;
                
                // Horizontal bounds - bounce off left/right edges
                if (this.x < halfWidth) {
                    this.x = halfWidth;
                    this.velocityX = Math.abs(this.velocityX) * 0.5;  // Bounce off wall
                } else if (this.x > CONFIG.GAME_WIDTH - halfWidth) {
                    this.x = CONFIG.GAME_WIDTH - halfWidth;
                    this.velocityX = -Math.abs(this.velocityX) * 0.5;  // Bounce off wall
                }
                
                // Top bound - bounce off top edge (can't go above screen)
                if (this.y < halfHeight) {
                    this.y = halfHeight;
                    this.velocityY = Math.abs(this.velocityY) * 0.3;  // Bounce down with damping
                }
                break;
        }

        // Deactivate if off screen bottom
        if (this.y > CONFIG.GAME_HEIGHT + 100) {
            this.active = false;
        }
    }

    takeDamage(amount, hitX = null, hitY = null) {
        if (this.engineDestroyed) return false;

        this.engineHealth -= amount;
        this.flashTimer = 100;

        if (this.engineHealth <= 0) {
            this.engineHealth = 0;
            this.engineDestroyed = true;
            this.state = 'destroyed';
            
            // Initialize physics with current drift converted to velocity
            this.velocityY = this.driftSpeed * this.fallSpeedMultiplier;
            this.velocityX = 0;
            
            return true;  // Engine destroyed
        }

        return false;
    }

    // Apply impulse from bullet hit (only when destroyed)
    // Enables juggling by applying upward force and rotation
    applyHitImpulse(hitX, hitY, bulletDamage = 10) {
        if (!this.engineDestroyed) return;

        // Calculate offset from center
        const offsetX = hitX - this.x;
        const offsetY = hitY - this.y;

        // === ROTATIONAL IMPULSE ===
        // Calculate torque based on horizontal distance from center
        const torque = offsetX * 0.0005;  // Scale factor for rotation intensity
        this.angularVelocity += torque;

        // Cap max rotation speed
        const maxAngularVelocity = 0.15;
        if (this.angularVelocity > maxAngularVelocity) {
            this.angularVelocity = maxAngularVelocity;
        } else if (this.angularVelocity < -maxAngularVelocity) {
            this.angularVelocity = -maxAngularVelocity;
        }

        // === LINEAR IMPULSE (for juggling) ===
        // Upward force - bullets push the ship up
        const upwardForce = -1.0;  // Negative = upward in screen coords (reduced from -1.8)
        this.velocityY += upwardForce;
        
        // Cap upward velocity (can't push too high)
        const maxUpwardVelocity = -4;
        if (this.velocityY < maxUpwardVelocity) {
            this.velocityY = maxUpwardVelocity;
        }

        // Horizontal push based on where the bullet hit
        // Hitting left side pushes right, hitting right side pushes left
        const horizontalPush = -offsetX * 0.05;  // Scale factor for horizontal push (reduced from 0.08)
        this.velocityX += horizontalPush;
        
        // Cap horizontal velocity
        const maxHorizontalVelocity = 3;
        if (this.velocityX > maxHorizontalVelocity) {
            this.velocityX = maxHorizontalVelocity;
        } else if (this.velocityX < -maxHorizontalVelocity) {
            this.velocityX = -maxHorizontalVelocity;
        }
    }

    getBounds() {
        // Ship body collision
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    getEngineBounds() {
        // Engine at bottom of ship
        const engineY = this.y + this.height / 2 - this.engineHeight;

        return {
            x: this.x - this.engineWidth / 2,
            y: engineY,
            width: this.engineWidth,
            height: this.engineHeight
        };
    }

    checkRedBoxCollision(redBox) {
        if (!redBox || !redBox.active) return false;

        const shipBounds = this.getBounds();
        const boxBounds = redBox.getBounds();

        // Check if ship touches red box (regardless of engine state)
        return (
            shipBounds.y + shipBounds.height >= boxBounds.y
        );
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        const bounds = this.getBounds();
        const engineBounds = this.getEngineBounds();

        // Flash white when hit
        const isFlashing = this.flashTimer > 0;

        ctx.save();

        // Apply rotation if destroyed and spinning
        if (this.engineDestroyed && Math.abs(this.angle) > 0.01) {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.translate(-this.x, -this.y);
        }

        // Draw ship body
        ctx.fillStyle = isFlashing ? '#ffffff' : '#8888aa';
        ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Draw windows
        if (!isFlashing) {
            ctx.fillStyle = '#444466';
            const windowSize = 6;
            const windowSpacing = 12;

            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    const wx = bounds.x + 10 + col * windowSpacing;
                    const wy = bounds.y + 10 + row * windowSpacing;
                    ctx.fillRect(wx, wy, windowSize, windowSize);
                }
            }
        }

        // Draw engine (if not destroyed)
        if (!this.engineDestroyed) {
            // Engine health determines color
            const healthPercent = this.engineHealth / this.maxEngineHealth;
            let engineColor = '#ffaa00'; // Orange (healthy)

            if (healthPercent < 0.3) {
                engineColor = '#ff0000'; // Red (damaged)
            } else if (healthPercent < 0.6) {
                engineColor = '#ff6600'; // Orange-red (hurt)
            }

            if (isFlashing) {
                engineColor = '#ffffff';
            }

            ctx.fillStyle = engineColor;
            ctx.fillRect(engineBounds.x, engineBounds.y, engineBounds.width, engineBounds.height);

            // Engine glow effect
            if (!isFlashing) {
                ctx.shadowColor = engineColor;
                ctx.shadowBlur = 10;
                ctx.fillRect(engineBounds.x, engineBounds.y, engineBounds.width, engineBounds.height);
                ctx.shadowBlur = 0;
            }

            // Engine health bar (small)
            const barWidth = this.engineWidth;
            const barHeight = 3;
            const barX = engineBounds.x;
            const barY = engineBounds.y - 6;

            // Background
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Health
            ctx.fillStyle = engineColor;
            const healthWidth = barWidth * healthPercent;
            ctx.fillRect(barX, barY, healthWidth, barHeight);
        } else {
            // Destroyed engine - show smoke/damage
            ctx.fillStyle = '#333333';
            ctx.fillRect(engineBounds.x, engineBounds.y, engineBounds.width, engineBounds.height);

            // Sparks/damage effect
            const sparkCount = 3;
            for (let i = 0; i < sparkCount; i++) {
                const sparkX = engineBounds.x + Math.random() * engineBounds.width;
                const sparkY = engineBounds.y + Math.random() * engineBounds.height;
                ctx.fillStyle = Math.random() > 0.5 ? '#ff4444' : '#ffaa00';
                ctx.fillRect(sparkX, sparkY, 2, 2);
            }
        }

        // Draw outline
        if (!isFlashing) {
            ctx.strokeStyle = '#555566';
            ctx.lineWidth = 2;
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        ctx.restore();
    }
}
