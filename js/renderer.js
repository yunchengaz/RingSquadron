// ASCII Art Canvas Renderer with Parallax Stars
import { CONFIG } from './utils/config.js';
import { VERSION } from './version.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.charWidth = 0;
        this.charHeight = 0;

        // Parallax star layers
        this.stars = [];
        this.initStars();

        this.setupCanvas();
    }

    initStars() {
        this.stars = [];
        for (const layer of CONFIG.STAR_LAYERS) {
            const layerStars = [];
            for (let i = 0; i < layer.count; i++) {
                layerStars.push({
                    x: Math.random() * CONFIG.GAME_WIDTH,
                    y: Math.random() * CONFIG.GAME_HEIGHT,
                    speed: layer.speed,
                    size: layer.size,
                    color: CONFIG.COLORS[`STAR_${layer.color}`],
                    twinkle: Math.random() * Math.PI * 2
                });
            }
            this.stars.push(layerStars);
        }
    }

    setupCanvas() {
        // Set up font with smaller size for zoom-out effect
        this.ctx.font = `${CONFIG.FONT_SIZE}px ${CONFIG.FONT_FAMILY}`;
        this.ctx.textBaseline = 'top';

        // Measure character dimensions
        const metrics = this.ctx.measureText('M');
        this.charWidth = metrics.width;
        this.charHeight = CONFIG.FONT_SIZE * 1.2;
    }

    updateStars(deltaTime, speedMultiplier = 1.0) {
        const dt = deltaTime / 16;
        for (const layer of this.stars) {
            for (const star of layer) {
                star.y += star.speed * dt * speedMultiplier;
                star.twinkle += 0.02 * dt;

                // Wrap twinkle value to prevent floating point precision issues
                if (star.twinkle > Math.PI * 2) {
                    star.twinkle -= Math.PI * 2;
                }

                // Wrap around - use modulo to prevent bunching
                if (star.y > CONFIG.GAME_HEIGHT + 5) {
                    // Reset to top with smooth distribution
                    star.y = star.y - (CONFIG.GAME_HEIGHT + 10);
                    star.x = Math.random() * CONFIG.GAME_WIDTH;
                }
            }
        }
    }

    drawStars() {
        for (const layer of this.stars) {
            for (const star of layer) {
                // Soft twinkle effect
                const twinkle = Math.sin(star.twinkle) * 0.3 + 0.7;
                this.ctx.globalAlpha = twinkle;
                this.ctx.fillStyle = star.color;

                // Draw as small circles for softer look
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        this.ctx.globalAlpha = 1;
    }

    clear() {
        this.ctx.fillStyle = CONFIG.COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw stars
        this.drawStars();

        // Draw version number in top left (subtle)
        this.drawVersion();
    }

    // Draw version number
    drawVersion() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = '#cccccc';
        this.ctx.font = `8px ${CONFIG.FONT_FAMILY}`;
        this.ctx.fillText(`v${VERSION}`, 5, 5);
        this.ctx.restore();
    }

    // Draw an ASCII sprite at given position
    drawSprite(sprite, x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.font = `${CONFIG.FONT_SIZE}px ${CONFIG.FONT_FAMILY}`;

        sprite.forEach((line, row) => {
            this.ctx.fillText(line, x, y + row * this.charHeight);
        });
    }

    // Draw sprite centered at position
    drawSpriteCentered(sprite, centerX, centerY, color) {
        const width = Math.max(...sprite.map(line => line.length)) * this.charWidth;
        const height = sprite.length * this.charHeight;
        const x = centerX - width / 2;
        const y = centerY - height / 2;
        this.drawSprite(sprite, x, y, color);
    }

    // Draw text at position
    drawText(text, x, y, color, fontSize = CONFIG.FONT_SIZE) {
        this.ctx.fillStyle = color;
        this.ctx.font = `${fontSize}px ${CONFIG.FONT_FAMILY}`;
        this.ctx.fillText(text, x, y);
    }

    // Draw centered text (horizontally centered, y is top of text)
    drawTextCentered(text, centerX, y, color, fontSize = CONFIG.FONT_SIZE) {
        this.ctx.font = `${fontSize}px ${CONFIG.FONT_FAMILY}`;
        const metrics = this.ctx.measureText(text);
        const x = centerX - metrics.width / 2;
        this.drawText(text, x, y, color, fontSize);
    }

    // Draw fully centered text (both horizontally and vertically centered at point)
    drawTextFullyCentered(text, centerX, centerY, color, fontSize = CONFIG.FONT_SIZE) {
        this.ctx.font = `${fontSize}px ${CONFIG.FONT_FAMILY}`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, centerX, centerY);
        // Reset to defaults
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
    }

    // Draw health bar
    drawHealthBar(x, y, width, height, currentHealth, maxHealth, fgColor, bgColor) {
        // Background
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(x, y, width, height);

        // Foreground (health)
        const healthWidth = (currentHealth / maxHealth) * width;
        this.ctx.fillStyle = fgColor;
        this.ctx.fillRect(x, y, healthWidth, height);

        // Border
        this.ctx.strokeStyle = fgColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
    }

    // Draw the HUD (uses larger font)
    drawHUD(gold, score, playerHealth, maxPlayerHealth, allyCount = 0, allyDamageMult = 1, boostLevel = 0, maxBoostLevel = 5) {
        const padding = 10;
        const barWidth = 80;
        const barHeight = 8;
        const fontSize = CONFIG.FONT_SIZE_HUD;

        // Score (top left)
        this.drawText(`SCORE: ${score}`, padding, padding, CONFIG.COLORS.HUD, fontSize);

        // Gold (top right)
        const goldText = `GOLD: ${gold}`;
        this.ctx.font = `${fontSize}px ${CONFIG.FONT_FAMILY}`;
        const goldWidth = this.ctx.measureText(goldText).width;
        this.drawText(goldText, this.canvas.width - goldWidth - padding, padding, CONFIG.COLORS.GOLD, fontSize);

        // Health bar (below score)
        this.drawText('HP:', padding, padding + 20, CONFIG.COLORS.HUD, 10);
        this.drawHealthBar(
            padding + 22,
            padding + 20,
            barWidth,
            barHeight,
            playerHealth,
            maxPlayerHealth,
            CONFIG.COLORS.HEALTH_BAR,
            CONFIG.COLORS.HEALTH_BAR_BG
        );

        // Ally count if any
        if (allyCount > 0) {
            let allyText = `ALLIES: ${allyCount}`;
            // Show damage multiplier if above 1
            if (allyDamageMult > 1) {
                allyText += ` (${allyDamageMult.toFixed(1)}x DMG)`;
            }
            this.drawText(allyText, padding, padding + 35, CONFIG.COLORS.ALLY, 10);
        }

        // Boost indicator (bottom left, only when boosted)
        if (boostLevel > 0.1) {
            this.drawBoostIndicator(boostLevel, maxBoostLevel);
        }

        // Pause button (top center) - small and unobtrusive
        this.drawPauseButton();
    }

    // Draw boost level indicator
    drawBoostIndicator(boostLevel, maxBoostLevel) {
        const x = 10;
        const y = this.canvas.height - 40;
        const barWidth = 60;
        const barHeight = 12;
        const speedMult = 1 + (boostLevel * 0.5);

        // Background
        this.ctx.fillStyle = 'rgba(0, 50, 0, 0.7)';
        this.ctx.fillRect(x, y, barWidth + 45, barHeight + 10);
        this.ctx.strokeStyle = '#44ff44';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, barWidth + 45, barHeight + 10);

        // Boost bar
        const fillWidth = (boostLevel / maxBoostLevel) * barWidth;
        const gradient = this.ctx.createLinearGradient(x + 5, 0, x + 5 + barWidth, 0);
        gradient.addColorStop(0, '#44ff44');
        gradient.addColorStop(1, '#88ffaa');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x + 5, y + 5, fillWidth, barHeight);

        // Bar outline
        this.ctx.strokeStyle = '#226622';
        this.ctx.strokeRect(x + 5, y + 5, barWidth, barHeight);

        // Speed text
        this.ctx.fillStyle = '#88ff88';
        this.ctx.font = `bold 10px ${CONFIG.FONT_FAMILY}`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${speedMult.toFixed(1)}x`, x + barWidth + 10, y + 14);
        this.ctx.textAlign = 'left';
    }

    // Draw pause button for in-game menu access
    drawPauseButton() {
        const btnX = this.canvas.width / 2 - 20;
        const btnY = 5;
        const btnW = 40;
        const btnH = 20;

        // Semi-transparent background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fillRect(btnX, btnY, btnW, btnH);

        // Border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(btnX, btnY, btnW, btnH);

        // Pause icon (two vertical bars)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fillRect(btnX + 14, btnY + 4, 4, 12);
        this.ctx.fillRect(btnX + 22, btnY + 4, 4, 12);
    }

    // Get pause button bounds for tap detection
    getPauseButtonBounds() {
        return {
            x: this.canvas.width / 2 - 20,
            y: 5,
            width: 40,
            height: 20
        };
    }

    // Draw pause menu overlay
    drawPauseMenu() {
        // Darken background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Title
        this.drawTextFullyCentered('PAUSED', centerX, centerY - 80, '#ffffff', 28);

        // Menu buttons
        const btnWidth = 180;
        const btnHeight = 45;
        const btnY1 = centerY - 30;
        const btnY2 = centerY + 30;
        const btnY3 = centerY + 90;

        // Resume button
        this.drawMenuButton(centerX - btnWidth / 2, btnY1, btnWidth, btnHeight, 'RESUME', '#00ff88');

        // Quit to Menu button
        this.drawMenuButton(centerX - btnWidth / 2, btnY2, btnWidth, btnHeight, 'QUIT TO MENU', '#ff6666');
    }

    // Draw a menu button
    drawMenuButton(x, y, width, height, text, color) {
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(x, y, width, height);

        // Border
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Text
        this.ctx.fillStyle = color;
        this.ctx.font = `bold 14px ${CONFIG.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, x + width / 2, y + height / 2);
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
    }

    // Get pause menu button bounds
    getPauseMenuBounds() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const btnWidth = 180;
        const btnHeight = 45;

        return {
            resume: {
                x: centerX - btnWidth / 2,
                y: centerY - 30,
                width: btnWidth,
                height: btnHeight
            },
            quit: {
                x: centerX - btnWidth / 2,
                y: centerY + 30,
                width: btnWidth,
                height: btnHeight
            }
        };
    }

    // Draw game over screen
    drawGameOver(score, gold, isNewHighScore = false, wave = 0) {
        // Darken background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Use fully centered text for proper alignment
        this.drawTextFullyCentered('GAME OVER', centerX, centerY - 80, '#ff4444', 28);

        // Show NEW HIGH SCORE! with animation if applicable
        if (isNewHighScore) {
            const pulse = Math.sin(performance.now() * 0.005) * 0.2 + 0.8;
            const size = Math.floor(20 * pulse);
            this.ctx.save();
            this.ctx.shadowColor = '#ffff00';
            this.ctx.shadowBlur = 15;
            this.drawTextFullyCentered('NEW HIGH SCORE!', centerX, centerY - 45, '#ffdd00', size);
            this.ctx.restore();
        }

        this.drawTextFullyCentered(`Final Score: ${score.toLocaleString()}`, centerX, centerY - 10, CONFIG.COLORS.HUD, 18);
        this.drawTextFullyCentered(`Wave: ${wave}`, centerX, centerY + 20, '#88aaff', 16);
        this.drawTextFullyCentered(`Gold: ${gold}`, centerX, centerY + 45, CONFIG.COLORS.GOLD, 16);
        this.drawTextFullyCentered('Tap to Restart', centerX, centerY + 90, CONFIG.COLORS.HUD, 14);
    }

    // Draw arcade-style animated title
    drawAnimatedTitle(centerX, y, time) {
        const title = 'RING SQUADRON';
        const fontSize = 28;
        const ctx = this.ctx;

        ctx.font = `bold ${fontSize}px ${CONFIG.FONT_FAMILY}`;

        // Rainbow colors cycling
        const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#00ffff', '#0088ff', '#ff00ff'];

        // Draw glow layer (larger, blurred effect)
        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20 + Math.sin(time * 3) * 10;

        // Draw each character with wave animation and rainbow color
        let totalWidth = ctx.measureText(title).width;
        let startX = centerX - totalWidth / 2;

        for (let i = 0; i < title.length; i++) {
            const char = title[i];
            const charWidth = ctx.measureText(char).width;

            // Wave animation - each character bobs up and down
            const waveOffset = Math.sin(time * 4 + i * 0.5) * 4;

            // Pulse scale
            const pulse = 1 + Math.sin(time * 2 + i * 0.3) * 0.05;

            // Rainbow color cycling
            const colorIndex = Math.floor((time * 2 + i * 0.5) % colors.length);
            const nextColorIndex = (colorIndex + 1) % colors.length;
            const blend = (time * 2 + i * 0.5) % 1;

            ctx.fillStyle = colors[colorIndex];

            // Draw character
            ctx.fillText(char, startX, y + waveOffset);
            startX += charWidth;
        }

        ctx.restore();

        // Draw scanlines effect over title area
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let scanY = y - 20; scanY < y + 20; scanY += 4) {
            if ((scanY + Math.floor(time * 50)) % 8 < 4) {
                ctx.fillRect(centerX - 150, scanY, 300, 2);
            }
        }
    }

    // Draw start screen with animated elements and integrated mode selection
    drawStartScreen(animTime = 0, stats = null, modeSelectUI = null, touchY = null) {
        this.clear();

        const centerX = this.canvas.width / 2;

        // Animated title
        this.drawAnimatedTitle(centerX, 55, animTime);

        // Decorative line
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(40, 100);
        this.ctx.lineTo(this.canvas.width - 40, 100);
        this.ctx.stroke();

        // "SELECT MODE" header
        this.ctx.save();
        const headerPulse = Math.sin(animTime * 3) * 0.1;
        this.ctx.shadowColor = '#ffdd00';
        this.ctx.shadowBlur = 5 + headerPulse * 5;
        this.drawTextFullyCentered('SELECT MODE', centerX, 122, '#ffdd00', 14);
        this.ctx.restore();

        // Draw mode selection buttons (integrated)
        if (modeSelectUI) {
            modeSelectUI.draw(this.ctx, this.canvas.width, this.canvas.height, CONFIG.FONT_FAMILY, touchY, animTime);
        }

        // Footer hint
        this.ctx.globalAlpha = 0.7;
        this.drawTextFullyCentered('Tap a mode to start', centerX, this.canvas.height - 40, '#999999', 10);
        this.ctx.globalAlpha = 1;

        // Version number (bottom - more visible on menu)
        this.ctx.globalAlpha = 0.8;
        this.drawText(`v${VERSION}`, 10, this.canvas.height - 20, '#cccccc', 8);
        this.ctx.globalAlpha = 1;
    }

    // Get sprite bounds for collision
    getSpriteBounds(sprite, centerX, centerY) {
        const width = Math.max(...sprite.map(line => line.length)) * this.charWidth;
        const height = sprite.length * this.charHeight;
        return {
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height
        };
    }
}
