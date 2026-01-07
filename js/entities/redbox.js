/**
 * Red Box Entity - Chase Mode
 *
 * The rising death zone that chases the player from below.
 * Cannot be destroyed, grows over time, slows when hit by cargo ships.
 *
 * @module entities/redbox
 */
import { CONFIG } from '../utils/config.js';

export class RedBox {
    constructor(gameWidth, gameHeight, configKey = 'CHASE_MODE') {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;

        const cfg = CONFIG[configKey];

        // Position and size
        this.x = gameWidth / 2;
        this.y = cfg.redBoxStartY;
        this.width = gameWidth;
        this.height = 50;  // Starting height
        this.initialY = cfg.redBoxStartY;

        // Growth mechanics
        this.safetyTimer = cfg.redBoxSafetyTime;
        this.baseGrowthRate = cfg.redBoxBaseGrowthRate;
        this.maxHeight = cfg.redBoxMaxHeight;
        this.minY = cfg.redBoxMinY;
        this.maxY = cfg.redBoxMaxY || gameHeight;  // Lower limit (bottom of screen)

        // Store config key for update method
        this.configKey = configKey;

        // Damage system
        this.damageCount = 0;
        this.slowdownMultiplier = 1.0;
        this.slowdownTimer = 0;
        this.flashTimer = 0;

        // Poise Gauge System (only for CHASE_SWARM_MODE)
        this.poiseValue = 0;  // -100 to +100, 0 is center
        this.poiseMax = cfg.poiseMax || 100;
        this.poiseJustTriggeredNegative = false;  // Prevent repeated triggers
        this.poiseJustTriggeredPositive = false;

        // State
        this.active = true;
        this.playTime = 0;
        this.unstoppable = false;  // Boss touched red box - game over mode
    }

    update(deltaTime, waveNumber, isSlowedDown, playerBoostLevel, enemySpeedBoost = 1.0) {
        const cfg = CONFIG[this.configKey];
        const dt = deltaTime / 16; // Normalize to ~60fps

        this.playTime += deltaTime;

        // Update slowdown effect
        if (isSlowedDown) {
            this.slowdownMultiplier = cfg.redBoxDamageSlowdown;
        } else {
            this.slowdownMultiplier = 1.0;
        }

        // Update flash effect
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
        }

        // Safety period - don't move
        if (this.safetyTimer > 0) {
            this.safetyTimer -= deltaTime;
            return;
        }

        // Unstoppable mode - boss reached red box, game over
        if (this.unstoppable) {
            // Rapidly fill the screen (5x normal speed)
            const unstoppableRate = this.baseGrowthRate * 5;
            this.y -= unstoppableRate * dt;

            // Clamp to top of screen
            if (this.y < 0) {
                this.y = 0;
            }
            return;
        }

        // Calculate poise-based speed multiplier and check extremes BEFORE decay
        let poiseSpeedMult = 1.0;
        if (cfg.poiseMax) {
            // Check for reaching extremes FIRST (before decay reduces the value)
            if (this.poiseValue <= -this.poiseMax && !this.poiseJustTriggeredNegative) {
                // Full negative: jump up by large margin
                const jumpAmount = cfg.poiseMaxNegativeJump || 100;
                this.y -= jumpAmount;
                this.poiseJustTriggeredNegative = true;
                this.poiseValue = 0;  // Reset gauge to center after triggering
                this.flashTimer = 500;  // Long flash for dramatic effect
            } else if (this.poiseValue > -this.poiseMax * 0.5) {
                this.poiseJustTriggeredNegative = false;
            }

            if (this.poiseValue >= this.poiseMax && !this.poiseJustTriggeredPositive) {
                // Full positive: knock down the red block!
                const knockdownAmount = cfg.poiseMaxPositiveKnockdown || 120;
                this.y += knockdownAmount;
                this.poiseJustTriggeredPositive = true;
                this.poiseValue = 0;  // Reset gauge to center after triggering
                this.flashTimer = 600;  // Longer flash for positive effect (green)
                this.lastKnockdownTime = this.playTime;  // Track for visual effect
            } else if (this.poiseValue < this.poiseMax * 0.5) {
                this.poiseJustTriggeredPositive = false;
            }

            // Calculate speed multiplier based on current poise
            const normalizedPoise = this.poiseValue / this.poiseMax;  // -1 to +1
            if (normalizedPoise < 0) {
                // Negative: lerp from 1.0 to negativeSpeedMult
                const negMult = cfg.poiseNegativeSpeedMult || 2.5;
                poiseSpeedMult = 1.0 + (-normalizedPoise) * (negMult - 1.0);
            } else if (normalizedPoise > 0) {
                // Positive: lerp from 1.0 to positiveSpeedMult
                const posMult = cfg.poisePositiveSpeedMult || 0.5;
                poiseSpeedMult = 1.0 - normalizedPoise * (1.0 - posMult);
            }
        }

        // Natural poise decay towards center AFTER checking extremes
        if (cfg.poiseDecayRate && this.poiseValue !== 0) {
            const decayAmount = cfg.poiseDecayRate * dt;
            if (this.poiseValue > 0) {
                this.poiseValue = Math.max(0, this.poiseValue - decayAmount);
            } else {
                this.poiseValue = Math.min(0, this.poiseValue + decayAmount);
            }
        }

        // Calculate growth rate with wave scaling and enemy speed boost
        const waveMultiplier = 1 + (waveNumber * cfg.redBoxWaveScaling);
        const effectiveGrowthRate = this.baseGrowthRate * waveMultiplier * this.slowdownMultiplier * enemySpeedBoost * poiseSpeedMult;

        // Calculate shrink rate from player boost (negative growth = shrinking)
        // Each boost level adds 0.15 pixels/frame of shrinkage
        const boostShrinkRate = playerBoostLevel * 0.15;

        // Net movement: growth - shrink
        const netRate = effectiveGrowthRate - boostShrinkRate;

        // Move upward (decrease Y) or downward (increase Y) based on net rate
        this.y -= netRate * dt;

        // Apply limits
        // Min Y is the configured minimum (can reach up to 90% screen coverage)
        if (this.y < this.minY) {
            this.y = this.minY;
        }

        // Max Y is the lower limit (bottom 5% of screen)
        if (this.y > this.maxY) {
            this.y = this.maxY;
        }
    }

    // Add poise value (negative for enemies reaching bottom, positive for shooting red box)
    addPoise(amount) {
        this.poiseValue = Math.max(-this.poiseMax, Math.min(this.poiseMax, this.poiseValue + amount));
    }

    takeDamage(amount) {
        const cfg = CONFIG[this.configKey];
        this.damageCount += amount;
        this.flashTimer = cfg.redBoxFlashDuration || 300;  // Default 300ms if not in config

        // Audio and visual feedback handled by caller
        return false; // Never dies
    }

    reset() {
        // Reset to starting position (golden boost effect)
        const cfg = CONFIG[this.configKey];
        this.y = cfg.redBoxStartY;
    }

    makeUnstoppable() {
        // Boss reached red box - trigger game over mode
        this.unstoppable = true;
        this.flashTimer = 1000;  // Long flash for dramatic effect
    }

    getBounds() {
        // Red box fills from bottom of screen upward
        // Y represents the TOP edge of the red box
        return {
            x: 0,
            y: this.y,
            width: this.width,
            height: this.gameHeight - this.y
        };
    }

    checkPlayerCollision(player) {
        if (!player.active) return false;

        const playerBounds = player.getBounds();
        const boxBounds = this.getBounds();

        // Check if player touches red box
        return (
            playerBounds.x < boxBounds.x + boxBounds.width &&
            playerBounds.x + playerBounds.width > boxBounds.x &&
            playerBounds.y + playerBounds.height > boxBounds.y &&
            playerBounds.y < boxBounds.y + boxBounds.height
        );
    }

    draw(renderer) {
        const ctx = renderer.ctx;
        const cfg = CONFIG[this.configKey];

        // Red box fills from bottom of screen upward
        // this.y is the TOP edge, it fills down to gameHeight
        const topY = this.y;
        const bottomY = this.gameHeight;
        const height = bottomY - topY;

        // Flash color based on state
        const isFlashing = this.flashTimer > 0;
        let baseColor;
        if (this.unstoppable) {
            baseColor = isFlashing ? '#ff0000' : '#660000';  // Dark red when unstoppable
        } else if (isFlashing && this.lastKnockdownTime && this.playTime - this.lastKnockdownTime < 700) {
            baseColor = '#44ff44';  // Green flash when knocked down by positive poise
        } else {
            baseColor = isFlashing ? '#ffffff' : '#cc0000';
        }

        // Draw main red box (from top edge down to bottom of screen)
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, topY, this.gameWidth, height);

        // Gradient top edge (danger zone)
        if (!isFlashing && height > 0) {
            const gradientHeight = Math.min(30, height);
            const gradient = ctx.createLinearGradient(0, topY, 0, topY + gradientHeight);
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(204, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, topY, this.gameWidth, gradientHeight);
        }

        // Danger stripes on top edge
        if (!isFlashing && height > 0) {
            ctx.fillStyle = '#ffff00';
            const stripeWidth = 20;
            const stripeHeight = 4;
            const stripeY = topY + 2;

            for (let x = 0; x < this.gameWidth; x += stripeWidth * 2) {
                ctx.fillRect(x, stripeY, stripeWidth, stripeHeight);
            }
        }

        // Pulsing effect on top edge
        if (this.safetyTimer <= 0 && height > 0) {
            const pulse = Math.sin(this.playTime / 200) * 0.2 + 0.8;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, topY, this.gameWidth, 2);
            ctx.globalAlpha = 1;
        }

        // Safety period indicator
        if (this.safetyTimer > 0) {
            const secondsLeft = Math.ceil(this.safetyTimer / 1000);
            ctx.fillStyle = '#ffffff';
            ctx.font = `${CONFIG.FONT_SIZE_HUD}px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.fillText(`SAFE: ${secondsLeft}s`, this.gameWidth / 2, topY - 20);
        }

        // Draw Poise Gauge (only for Chase Swarm mode with poise system)
        if (cfg.poiseMax) {
            this.drawPoiseGauge(ctx);
        }
    }

    drawPoiseGauge(ctx) {
        const cfg = CONFIG[this.configKey];
        const gaugeWidth = this.gameWidth - 40;
        const gaugeHeight = 16;
        const gaugeX = 20;
        const gaugeY = this.gameHeight - 28;  // At the very bottom of screen

        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(gaugeX - 5, gaugeY - 5, gaugeWidth + 10, gaugeHeight + 10);

        // Gradient background for negative (left) and positive (right) sides
        const gradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0);
        gradient.addColorStop(0, '#880000');      // Deep red (negative extreme)
        gradient.addColorStop(0.35, '#552222');   // Dark red
        gradient.addColorStop(0.5, '#333333');    // Neutral center (dark gray)
        gradient.addColorStop(0.65, '#225522');   // Dark green
        gradient.addColorStop(1, '#008800');      // Deep green (positive extreme)
        ctx.fillStyle = gradient;
        ctx.fillRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);

        // Draw center line (neutral point)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gaugeX + gaugeWidth / 2, gaugeY - 2);
        ctx.lineTo(gaugeX + gaugeWidth / 2, gaugeY + gaugeHeight + 2);
        ctx.stroke();

        // Draw tick marks
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 10; i++) {
            if (i === 5) continue;  // Skip center
            const tickX = gaugeX + (gaugeWidth * i / 10);
            ctx.beginPath();
            ctx.moveTo(tickX, gaugeY);
            ctx.lineTo(tickX, gaugeY + gaugeHeight);
            ctx.stroke();
        }

        // Calculate marker position
        // poiseValue: -poiseMax to +poiseMax
        // Map to: 0 to gaugeWidth
        const normalizedPoise = (this.poiseValue + this.poiseMax) / (this.poiseMax * 2);
        const markerX = gaugeX + normalizedPoise * gaugeWidth;

        // Marker color based on poise state
        let markerColor;
        if (this.poiseValue < -this.poiseMax * 0.5) {
            markerColor = '#ff4444';  // Danger red when very negative
        } else if (this.poiseValue > this.poiseMax * 0.5) {
            markerColor = '#44ff44';  // Good green when very positive
        } else {
            markerColor = '#ffffff';  // Neutral white
        }

        // Pulsing effect when at extremes
        let markerAlpha = 1.0;
        if (Math.abs(this.poiseValue) > this.poiseMax * 0.8) {
            markerAlpha = 0.7 + Math.sin(this.playTime / 100) * 0.3;
        }
        ctx.globalAlpha = markerAlpha;

        // Draw marker (triangle pointer)
        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.moveTo(markerX, gaugeY - 4);
        ctx.lineTo(markerX - 6, gaugeY - 10);
        ctx.lineTo(markerX + 6, gaugeY - 10);
        ctx.closePath();
        ctx.fill();

        // Draw marker line through gauge
        ctx.strokeStyle = markerColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(markerX, gaugeY);
        ctx.lineTo(markerX, gaugeY + gaugeHeight);
        ctx.stroke();

        // Draw bottom pointer
        ctx.fillStyle = markerColor;
        ctx.beginPath();
        ctx.moveTo(markerX, gaugeY + gaugeHeight + 4);
        ctx.lineTo(markerX - 6, gaugeY + gaugeHeight + 10);
        ctx.lineTo(markerX + 6, gaugeY + gaugeHeight + 10);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 1.0;

        // Draw labels
        ctx.font = `bold 9px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Negative label (DANGER)
        ctx.fillStyle = '#ff6666';
        ctx.fillText('DANGER', gaugeX + 35, gaugeY + gaugeHeight / 2);

        // Positive label (SAFE)
        ctx.fillStyle = '#66ff66';
        ctx.fillText('SAFE', gaugeX + gaugeWidth - 30, gaugeY + gaugeHeight / 2);

        // Speed indicator text
        ctx.font = `bold 8px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let speedText = '';
        if (this.poiseValue < -this.poiseMax * 0.5) {
            speedText = '⚠ FAST';
            ctx.fillStyle = '#ff4444';
        } else if (this.poiseValue > this.poiseMax * 0.5) {
            speedText = '✓ SLOW';
            ctx.fillStyle = '#44ff44';
        }
        if (speedText) {
            ctx.fillText(speedText, gaugeX + gaugeWidth / 2 - 18, gaugeY - 18);
        }

        // Reset text alignment
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Draw border
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.strokeRect(gaugeX, gaugeY, gaugeWidth, gaugeHeight);
    }
}
