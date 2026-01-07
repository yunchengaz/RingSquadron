/**
 * Level Editor UI
 *
 * Provides the visual interface for the level editor:
 * - Grid overlay for placement
 * - Tool selection toolbar (bottom)
 * - Wave navigation sidebar (right)
 * - Preview of placed elements
 * - Scroll/pan to navigate wave height
 *
 * @module systems/editorui
 */
import { CONFIG } from '../utils/config.js';
import { EditorSystem } from './editor.js';
import { WALL_TYPES } from '../entities/wall.js';

export class EditorUI {
    constructor(editor) {
        this.editor = editor;
        this.visible = false;

        // Layout dimensions - narrower sidebar to not overlap lanes
        this.toolbarHeight = 70;
        this.sidebarWidth = 75;

        // Calculate edit area (excludes sidebar)
        this.editAreaWidth = CONFIG.GAME_WIDTH - this.sidebarWidth;
        this.editAreaHeight = CONFIG.GAME_HEIGHT - this.toolbarHeight;

        // Tool definitions
        this.tools = [
            { key: 'ring', icon: 'O', label: 'Ring', color: '#44aaff' },
            { key: 'enemy', icon: 'X', label: 'Enemy', color: '#ff4444' },
            { key: 'wall', icon: '#', label: 'Wall', color: '#888888' },
            { key: 'gate_x2', icon: '*', label: 'x2', color: '#ffdd00' },
            { key: 'gate_div', icon: '/', label: '/2', color: '#aa2222' },
            { key: 'erase', icon: '-', label: 'Erase', color: '#ff6666' }
        ];

        // Animation
        this.animTime = 0;
        this.saveFlash = 0;

        // Page-based scrolling (no drag - just buttons)
        this.pageHeight = this.editAreaHeight; // One screen per page

        // Load level mode
        this.showingLoadList = false;
        this.loadListLevels = [];
        this.loadListScroll = 0;
    }

    show() {
        this.visible = true;
        this.animTime = 0;
        this.editor.scrollOffset = 0;
    }

    hide() {
        this.visible = false;
    }

    update(deltaTime) {
        this.animTime += deltaTime / 1000;
        if (this.saveFlash > 0) {
            this.saveFlash -= deltaTime / 1000;
        }
    }

    // Handle mouse wheel for scrolling (desktop only)
    handleWheel(deltaY) {
        if (!this.visible) return;
        this.editor.scroll(-deltaY * 0.5);
    }

    // Simple tap handler - no drag detection needed
    handleTap(x, y) {
        if (!this.visible) return null;

        // If showing load list, handle tap on list
        if (this.showingLoadList) {
            return this.handleLoadListTap(x, y);
        }

        // Check toolbar (bottom)
        if (y > CONFIG.GAME_HEIGHT - this.toolbarHeight) {
            return this.handleToolbarTap(x, y);
        }

        // Check sidebar (right)
        if (x > this.editAreaWidth) {
            const relativeX = x - this.editAreaWidth;
            return this.handleSidebarTap(y, relativeX);
        }

        // Grid area - place element
        if (x < this.editAreaWidth && y < CONFIG.GAME_HEIGHT - this.toolbarHeight) {
            this.editor.placeElement(x, y, this.editAreaWidth, this.editAreaHeight);
            return 'placed';
        }

        return null;
    }

    // Page navigation
    pageUp() {
        this.editor.scroll(this.pageHeight);
    }

    pageDown() {
        this.editor.scroll(-this.pageHeight);
    }

    // Show the load level list
    showLoadList() {
        this.loadListLevels = Object.keys(EditorSystem.getSavedLevels());
        this.showingLoadList = true;
        this.loadListScroll = 0;
    }

    // Hide load list
    hideLoadList() {
        this.showingLoadList = false;
    }

    // Handle tap on load list
    handleLoadListTap(x, y) {
        const listX = 30;
        const listY = 80;
        const listWidth = CONFIG.GAME_WIDTH - 60;
        const listHeight = CONFIG.GAME_HEIGHT - 160;
        const itemHeight = 45;

        // Check cancel button (top right)
        if (x > CONFIG.GAME_WIDTH - 80 && y < 70) {
            this.hideLoadList();
            return 'load_cancel';
        }

        // Check if tap is in the list area
        if (x >= listX && x <= listX + listWidth && y >= listY && y <= listY + listHeight) {
            const relativeY = y - listY + this.loadListScroll;
            const index = Math.floor(relativeY / itemHeight);

            if (index >= 0 && index < this.loadListLevels.length) {
                const levelName = this.loadListLevels[index];
                this.editor.loadLevel(levelName);
                this.hideLoadList();
                return 'level_loaded';
            }
        }

        return null;
    }

    handleToolbarTap(x, y) {
        const toolWidth = this.editAreaWidth / this.tools.length;
        const toolIndex = Math.floor(x / toolWidth);

        if (toolIndex >= 0 && toolIndex < this.tools.length) {
            this.editor.selectedTool = this.tools[toolIndex].key;
            return 'tool_selected';
        }
        return null;
    }

    handleSidebarTap(y, relativeX = 37) {
        const sw = this.sidebarWidth;

        // Wave navigation buttons
        if (y >= 65 && y < 90) {
            this.editor.prevWave();
            return 'prev_wave';
        }
        if (y >= 95 && y < 120) {
            this.editor.nextWave();
            return 'next_wave';
        }
        if (y >= 130 && y < 155) {
            this.editor.addWave();
            return 'add_wave';
        }
        if (y >= 160 && y < 185) {
            this.editor.removeWave();
            return 'remove_wave';
        }

        // Value controls at y=230
        if (y >= 230 && y < 255) {
            const isLeftButton = relativeX < sw / 2;
            if (this.editor.selectedTool === 'ring') {
                if (isLeftButton) {
                    this.editor.decrementRingValue();
                } else {
                    this.editor.incrementRingValue();
                }
            } else if (this.editor.selectedTool === 'enemy') {
                this.editor.cycleEnemyType(isLeftButton ? -1 : 1);
            } else if (this.editor.selectedTool === 'wall') {
                this.editor.cycleWallType(isLeftButton ? -1 : 1);
            }
            return isLeftButton ? 'value_down' : 'value_up';
        }

        // Level name (tap to edit) at y=275
        if (y >= 265 && y < 295) {
            const newName = prompt('Enter level name:', this.editor.levelName);
            if (newName !== null && newName.trim()) {
                this.editor.setLevelName(newName.trim());
            }
            return 'edit_name';
        }

        // Save button at y=305
        if (y >= 305 && y < 333) {
            this.editor.saveLevel();
            this.saveFlash = 1;
            return 'save';
        }

        // Load button at y=340
        if (y >= 340 && y < 368) {
            this.showLoadList();
            return 'show_load';
        }

        // Clear button at y=375
        if (y >= 375 && y < 400) {
            this.editor.clearCurrentWave();
            return 'clear';
        }

        // Settings toggles
        if (y >= 445 && y < 465) {
            this.editor.toggleChaseMode();
            return 'toggle_chase';
        }
        if (y >= 470 && y < 490) {
            this.editor.toggleVerticalMovement();
            return 'toggle_vertical';
        }

        // Page navigation buttons (side by side)
        if (y >= 500 && y < 522) {
            const btnWidth = (this.sidebarWidth - 9) / 2;
            if (x < CONFIG.GAME_WIDTH - this.sidebarWidth + 3 + btnWidth + 1.5) {
                // Left button (↑ Page Up)
                this.pageUp();
                return 'page_up';
            } else {
                // Right button (↓ Page Down)
                this.pageDown();
                return 'page_down';
            }
        }

        // Save & Play button
        if (y >= 552 && y < 580) {
            return 'save_and_play';
        }

        // Exit button
        if (y >= 585 && y < 613) {
            return 'exit';
        }

        return null;
    }

    draw(ctx) {
        if (!this.visible) return;

        // Draw grid
        this.drawGrid(ctx);

        // Draw lane dividers
        this.drawLanes(ctx);

        // Draw placed elements preview
        this.drawPreview(ctx);

        // Draw toolbar
        this.drawToolbar(ctx);

        // Draw sidebar
        this.drawSidebar(ctx);

        // Draw scroll indicator
        this.drawScrollIndicator(ctx);

        // Save flash effect
        if (this.saveFlash > 0) {
            ctx.fillStyle = `rgba(0, 255, 100, ${this.saveFlash * 0.3})`;
            ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        }

        // Draw load list overlay if showing
        if (this.showingLoadList) {
            this.drawLoadList(ctx);
        }
    }

    drawLoadList(ctx) {
        // Darken background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 20px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('LOAD LEVEL', CONFIG.GAME_WIDTH / 2, 45);

        // Cancel button
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold 14px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText('CANCEL', CONFIG.GAME_WIDTH - 20, 45);

        const listX = 30;
        const listY = 80;
        const listWidth = CONFIG.GAME_WIDTH - 60;
        const listHeight = CONFIG.GAME_HEIGHT - 160;
        const itemHeight = 45;

        // List background
        ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
        ctx.fillRect(listX, listY, listWidth, listHeight);
        ctx.strokeStyle = '#444466';
        ctx.lineWidth = 2;
        ctx.strokeRect(listX, listY, listWidth, listHeight);

        if (this.loadListLevels.length === 0) {
            ctx.fillStyle = '#666666';
            ctx.font = `14px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.fillText('No saved levels', CONFIG.GAME_WIDTH / 2, listY + listHeight / 2);
        } else {
            // Clip to list area
            ctx.save();
            ctx.beginPath();
            ctx.rect(listX, listY, listWidth, listHeight);
            ctx.clip();

            // Draw level items
            this.loadListLevels.forEach((name, i) => {
                const itemY = listY + i * itemHeight - this.loadListScroll;

                if (itemY > listY - itemHeight && itemY < listY + listHeight) {
                    // Item background
                    ctx.fillStyle = i % 2 === 0 ? 'rgba(50, 50, 80, 0.5)' : 'rgba(40, 40, 70, 0.5)';
                    ctx.fillRect(listX + 5, itemY + 2, listWidth - 10, itemHeight - 4);

                    // Level name
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `bold 14px ${CONFIG.FONT_FAMILY}`;
                    ctx.textAlign = 'left';
                    ctx.fillText(name, listX + 15, itemY + 28);

                    // Load indicator
                    ctx.fillStyle = '#44aaff';
                    ctx.font = `12px ${CONFIG.FONT_FAMILY}`;
                    ctx.textAlign = 'right';
                    ctx.fillText('TAP TO LOAD', listX + listWidth - 15, itemY + 28);
                }
            });

            ctx.restore();
        }

        // Instructions
        ctx.fillStyle = '#666666';
        ctx.font = `10px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('Tap a level to load it into the editor', CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT - 50);

        ctx.textAlign = 'left';
    }

    drawGrid(ctx) {
        const gridSize = this.editor.gridSize;
        const editHeight = this.editAreaHeight;
        const scrollOffset = this.editor.scrollOffset;

        ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= this.editAreaWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, editHeight);
            ctx.stroke();
        }

        // Horizontal lines (flipped Y axis)
        // Convert worldY grid lines to screen coordinates
        const startWorldY = Math.floor(scrollOffset / gridSize) * gridSize;
        const endWorldY = scrollOffset + editHeight + gridSize;

        for (let worldY = startWorldY; worldY <= endWorldY; worldY += gridSize) {
            const screenY = editHeight - worldY + scrollOffset;
            if (screenY >= 0 && screenY <= editHeight) {
                ctx.beginPath();
                ctx.moveTo(0, screenY);
                ctx.lineTo(this.editAreaWidth, screenY);
                ctx.stroke();
            }
        }
    }

    drawLanes(ctx) {
        const laneWidth = this.editAreaWidth / 5;
        const editHeight = this.editAreaHeight;

        ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);

        for (let i = 1; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(laneWidth * i, 0);
            ctx.lineTo(laneWidth * i, editHeight);
            ctx.stroke();
        }

        ctx.setLineDash([]);

        // Lane labels at top
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.font = `10px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('1', laneWidth * 0.5, 15);
        ctx.fillText('2', laneWidth * 1.5, 15);
        ctx.fillText('3', laneWidth * 2.5, 15);
        ctx.fillText('4', laneWidth * 3.5, 15);
        ctx.fillText('5', laneWidth * 4.5, 15);

        // Orientation labels (flipped Y: top = later, bottom = earlier)
        ctx.fillStyle = 'rgba(100, 200, 100, 0.6)';
        ctx.font = `bold 9px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText('↑ LATER IN WAVE', this.editAreaWidth / 2, 30);

        ctx.fillStyle = 'rgba(200, 150, 100, 0.6)';
        ctx.fillText('↓ EARLIER IN WAVE', this.editAreaWidth / 2, editHeight - 10);

        ctx.textAlign = 'left';
    }

    drawPreview(ctx) {
        const wave = this.editor.getCurrentWave();
        const scrollOffset = this.editor.scrollOffset;
        const editHeight = this.editAreaHeight;
        const laneWidth = this.editAreaWidth / 5;

        // Clip to edit area
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.editAreaWidth, editHeight);
        ctx.clip();

        // Y transformation: higher worldY = higher on screen (flipped)
        // screenY = editHeight - worldY + scrollOffset
        const toScreenY = (worldY) => editHeight - worldY + scrollOffset;

        // Draw walls at their Y positions
        wave.walls.forEach(w => {
            const x = laneWidth * w.lane + laneWidth / 2;
            const screenY = toScreenY(w.y || 60);
            const widthMultiplier = w.width || 1.0;
            const width = (laneWidth - 20) * widthMultiplier;
            const wallType = WALL_TYPES[w.type] || WALL_TYPES.SOLID;

            // Only draw if visible
            if (screenY > -40 && screenY < editHeight + 40) {
                ctx.fillStyle = wallType.color;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(x - width / 2, screenY - 15, width, 30);
                ctx.globalAlpha = 1;

                // Stripes on edges
                ctx.fillStyle = wallType.stripeColor;
                ctx.fillRect(x - width / 2, screenY - 15, 6, 30);
                ctx.fillRect(x + width / 2 - 6, screenY - 15, 6, 30);

                ctx.strokeStyle = wallType.stripeColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(x - width / 2, screenY - 15, width, 30);

                ctx.fillStyle = wallType.textColor;
                ctx.font = `bold 8px ${CONFIG.FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(wallType.text, x, screenY);
            }
        });

        // Draw rings at their Y positions
        wave.rings.forEach(r => {
            const x = r.x * this.editAreaWidth;
            const screenY = toScreenY(r.y);

            if (screenY > -20 && screenY < editHeight + 20) {
                const color = r.value >= 0 ? '#44aaff' : '#ff4466';

                ctx.beginPath();
                ctx.arc(x, screenY, 15, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.font = `bold 10px ${CONFIG.FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const text = r.value >= 0 ? `+${r.value}` : `${r.value}`;
                ctx.fillText(text, x, screenY);
            }
        });

        // Draw gates at their Y positions
        wave.gates.forEach(g => {
            const x = g.x * this.editAreaWidth;
            const screenY = toScreenY(g.y);

            if (screenY > -20 && screenY < editHeight + 20) {
                const color = g.type === 'multiply' ? '#ffdd00' : '#aa2222';
                const text = g.type === 'multiply' ? 'x2' : '/2';

                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(x - 20, screenY - 12, 40, 24);

                ctx.fillStyle = color;
                ctx.font = `bold 14px ${CONFIG.FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, x, screenY);
            }
        });

        // Draw enemies at their Y positions
        wave.enemies.forEach(e => {
            const x = e.x * this.editAreaWidth;
            const screenY = toScreenY(e.y || 40);

            if (screenY > -20 && screenY < editHeight + 20) {
                // Enemy marker
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.moveTo(x, screenY - 12);
                ctx.lineTo(x + 10, screenY + 8);
                ctx.lineTo(x - 10, screenY + 8);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = `bold 8px ${CONFIG.FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(e.type.charAt(0), x, screenY);
            }
        });

        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    drawScrollIndicator(ctx) {
        const editHeight = CONFIG.GAME_HEIGHT - this.toolbarHeight;
        const maxScroll = this.editor.maxWaveHeight - 400;
        const scrollPercent = this.editor.scrollOffset / maxScroll;

        // Draw scroll bar on right edge of edit area
        const barX = this.editAreaWidth - 8;
        const barHeight = editHeight - 40;
        const thumbHeight = Math.max(30, barHeight * (editHeight / this.editor.maxWaveHeight));
        const thumbY = 20 + scrollPercent * (barHeight - thumbHeight);

        // Track
        ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
        ctx.fillRect(barX, 20, 6, barHeight);

        // Thumb
        ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
        ctx.fillRect(barX, thumbY, 6, thumbHeight);

        // Height indicator
        ctx.fillStyle = '#888888';
        ctx.font = `9px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'right';
        ctx.fillText(`Y:${Math.round(this.editor.scrollOffset)}`, barX - 5, 25);
        ctx.textAlign = 'left';
    }

    drawToolbar(ctx) {
        const y = CONFIG.GAME_HEIGHT - this.toolbarHeight;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, y, this.editAreaWidth, this.toolbarHeight);

        // Border
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.editAreaWidth, y);
        ctx.stroke();

        // Tools
        const toolWidth = this.editAreaWidth / this.tools.length;
        this.tools.forEach((tool, i) => {
            const x = i * toolWidth;
            const isSelected = this.editor.selectedTool === tool.key;

            // Highlight selected
            if (isSelected) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.fillRect(x, y, toolWidth, this.toolbarHeight);

                ctx.strokeStyle = tool.color;
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 2, y + 2, toolWidth - 4, this.toolbarHeight - 4);
            }

            // Icon
            ctx.fillStyle = isSelected ? tool.color : '#666666';
            ctx.font = `bold 20px ${CONFIG.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.fillText(tool.icon, x + toolWidth / 2, y + 26);

            // Label
            ctx.fillStyle = isSelected ? '#ffffff' : '#888888';
            ctx.font = `9px ${CONFIG.FONT_FAMILY}`;
            ctx.fillText(tool.label, x + toolWidth / 2, y + 48);
        });

        ctx.textAlign = 'left';
    }

    drawSidebar(ctx) {
        const x = this.editAreaWidth;
        const sw = this.sidebarWidth;
        const centerX = x + sw / 2;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(x, 0, sw, CONFIG.GAME_HEIGHT);

        // Border
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.GAME_HEIGHT);
        ctx.stroke();

        // Wave info
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 10px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('WAVE', centerX, 25);
        ctx.font = `bold 14px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText(`${this.editor.currentWaveIndex + 1}/${this.editor.waves.length}`, centerX, 45);

        // Navigation buttons (compact)
        this.drawButton(ctx, x + 3, 65, sw - 6, 22, '< Prev', '#555555');
        this.drawButton(ctx, x + 3, 95, sw - 6, 22, 'Next >', '#555555');
        this.drawButton(ctx, x + 3, 130, sw - 6, 22, '+ Add', '#336633');
        this.drawButton(ctx, x + 3, 160, sw - 6, 22, '- Del', '#663333');

        // Value controls (for ring/enemy/wall)
        ctx.fillStyle = '#888888';
        ctx.font = `9px ${CONFIG.FONT_FAMILY}`;

        if (this.editor.selectedTool === 'ring') {
            ctx.fillText('Value:', centerX, 200);
            ctx.font = `bold 16px ${CONFIG.FONT_FAMILY}`;
            ctx.fillStyle = this.editor.selectedRingValue >= 0 ? '#44aaff' : '#ff4466';
            const valText = this.editor.selectedRingValue >= 0 ? `+${this.editor.selectedRingValue}` : `${this.editor.selectedRingValue}`;
            ctx.fillText(valText, centerX, 218);
            this.drawButton(ctx, x + 3, 230, sw/2 - 5, 22, '-', '#555555');
            this.drawButton(ctx, x + sw/2 + 2, 230, sw/2 - 5, 22, '+', '#555555');
        } else if (this.editor.selectedTool === 'enemy') {
            ctx.fillText('Type:', centerX, 200);
            ctx.font = `bold 10px ${CONFIG.FONT_FAMILY}`;
            ctx.fillStyle = '#ff4444';
            ctx.fillText(this.editor.selectedEnemyType, centerX, 218);
            this.drawButton(ctx, x + 3, 230, sw/2 - 5, 22, '<', '#555555');
            this.drawButton(ctx, x + sw/2 + 2, 230, sw/2 - 5, 22, '>', '#555555');
        } else if (this.editor.selectedTool === 'wall') {
            const wallInfo = this.editor.getWallTypeInfo();
            ctx.fillText('Type:', centerX, 200);
            ctx.font = `bold 9px ${CONFIG.FONT_FAMILY}`;
            ctx.fillStyle = wallInfo.stripeColor;
            ctx.fillText(this.editor.selectedWallType, centerX, 218);
            this.drawButton(ctx, x + 3, 230, sw/2 - 5, 22, '<', '#555555');
            this.drawButton(ctx, x + sw/2 + 2, 230, sw/2 - 5, 22, '>', '#555555');
        } else {
            ctx.fillStyle = '#555555';
            ctx.fillText('Select tool', centerX, 200);
            ctx.fillText('for options', centerX, 215);
        }

        // Level name (editable)
        ctx.fillStyle = '#666666';
        ctx.font = `8px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText('NAME:', centerX, 260);

        // Name box (tap to edit)
        ctx.fillStyle = 'rgba(50, 50, 80, 0.5)';
        ctx.fillRect(x + 3, 267, sw - 6, 22);
        ctx.strokeStyle = '#666688';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 3, 267, sw - 6, 22);

        ctx.fillStyle = '#aaaaff';
        ctx.font = `bold 9px ${CONFIG.FONT_FAMILY}`;
        // Truncate name if too long
        let displayName = this.editor.levelName;
        if (displayName.length > 8) {
            displayName = displayName.substring(0, 7) + '…';
        }
        ctx.fillText(displayName, centerX, 281);

        // Save/Load/Clear buttons
        const saveColor = this.saveFlash > 0 ? '#00ff88' : '#4488ff';
        this.drawButton(ctx, x + 3, 305, sw - 6, 25, 'SAVE', saveColor);
        this.drawButton(ctx, x + 3, 340, sw - 6, 25, 'LOAD', '#aa8800');
        this.drawButton(ctx, x + 3, 375, sw - 6, 22, 'Clear', '#663333');

        // Stats
        const stats = this.editor.getWaveStats();
        ctx.fillStyle = '#555555';
        ctx.font = `8px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText(`R:${stats.rings} E:${stats.enemies}`, centerX, 405);
        ctx.fillText(`W:${stats.walls} G:${stats.gates}`, centerX, 417);

        // Level settings toggles
        ctx.fillStyle = '#666666';
        ctx.font = `7px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText('SETTINGS', centerX, 437);

        // Chase mode toggle
        const chaseColor = this.editor.chaseMode ? '#ff3333' : '#555555';
        this.drawButton(ctx, x + 3, 445, sw - 6, 20, this.editor.chaseMode ? '✓Chase' : 'Chase', chaseColor);

        // Vertical movement toggle
        const vertColor = this.editor.allowVerticalMovement ? '#44ff88' : '#555555';
        this.drawButton(ctx, x + 3, 470, sw - 6, 20, this.editor.allowVerticalMovement ? '✓Vert' : 'Vert', vertColor);

        // Page navigation buttons (side by side)
        const btnWidth = (sw - 9) / 2;  // Two buttons with 3px gap between
        this.drawButton(ctx, x + 3, 500, btnWidth, 22, '↑', '#446688');
        this.drawButton(ctx, x + 3 + btnWidth + 3, 500, btnWidth, 22, '↓', '#446688');

        // Current page indicator
        const currentPage = Math.floor(this.editor.scrollOffset / this.pageHeight) + 1;
        const maxPage = Math.ceil(this.editor.maxWaveHeight / this.pageHeight);
        ctx.fillStyle = '#666666';
        ctx.font = `8px ${CONFIG.FONT_FAMILY}`;
        ctx.fillText(`Page ${currentPage}/${maxPage}`, centerX, 545);

        // Save & Play button
        this.drawButton(ctx, x + 3, 552, sw - 6, 28, 'SAVE&PLAY', '#44aa44');

        // Exit button
        this.drawButton(ctx, x + 3, 585, sw - 6, 28, 'EXIT', '#aa3333');

        ctx.textAlign = 'left';
    }

    drawButton(ctx, x, y, width, height, text, color) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, y, width, height);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 10px ${CONFIG.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + width / 2, y + height / 2);
        ctx.textBaseline = 'top';
    }
}
