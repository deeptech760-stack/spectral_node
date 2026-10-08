export default class PCBTraceAnimation {
    constructor(traceElement, options = {}) {
        this.traceElement = traceElement;
        this.options = {
            traceColor: options.traceColor || options.color || "#000",
            viaColor: options.viaColor || options.color || "#000",
            autoResize: options.autoResize !== undefined ? options.autoResize : true,
            speed: options.speed || 4,
            gridResolution: options.gridResolution || Math.max(2, options.lineWidth || 3),
            lineSpacing: options.lineSpacing || 10,
            minLength: options.minLength || 10,
            lineWidth: options.lineWidth || 3,
            lineMargin: options.lineMargin || 10,
            lineAngleVariation: options.lineAngleVariation || 0.008,
            lineEndCoefficient: options.lineEndCoefficient || 0.005
        };

        this.lines = [];
        this.history = []; // initial drawLine

        this.ctx = traceElement.getContext('2d');
        this.width = 0;
        this.height = 0;

        this.grid = null;
        this.gridCols = 0;
        this.gridRows = 0;

        this.PIQ = Math.PI / 4;
        this.PIT = 2 * Math.PI;
        this.PIH = Math.PI / 2;
        this.animationFrameId = null;
        this.running = false;
        this.resizeObserver = null;
    }

    initCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.traceElement.width = this.width;
        this.traceElement.height = this.height;
        this.ctx.lineCap = "round";

        this.gridCols = Math.ceil(this.width / this.options.gridResolution);
        this.gridRows = Math.ceil(this.height / this.options.gridResolution);
        this.grid = new Uint8Array(this.gridCols * this.gridRows);
    }

    restart() {
        this.initCanvas();

        this.lines = [];

        this.history.forEach(args => {
            this._drawTrace(...args);
        });
    }

    markGrid(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const gx = (x / this.options.gridResolution) | 0;
        const gy = (y / this.options.gridResolution) | 0;
        if (gx >= 0 && gx < this.gridCols && gy >= 0 && gy < this.gridRows) {
            this.grid[gy * this.gridCols + gx] = 1;
        }
    }

    getGridCoords(x, y) {
        return {
            gx: (x / this.options.gridResolution) | 0,
            gy: (y / this.options.gridResolution) | 0
        };
    }

    isColliding(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
        const gx = (x / this.options.gridResolution) | 0;
        const gy = (y / this.options.gridResolution) | 0;
        if (gx >= 0 && gx < this.gridCols && gy >= 0 && gy < this.gridRows) {
            return this.grid[gy * this.gridCols + gx] === 1;
        }
        return true;
    }

    markLineSegment(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.ceil(dist / (this.options.gridResolution * 0.8));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            this.markGrid(px, py);
        }
    }

    drawVia(x, y) {
        this.ctx.fillStyle = this.options.viaColor;
        this.ctx.beginPath();
        const radius = this.options.lineWidth;
        this.ctx.arc(x, y, radius, 0, this.PIT);
        this.ctx.fill();
    }

    drawLine(posX, posY, length, isHorizontal = true, isInverted = false) {
        this.history.push([posX, posY, length, isHorizontal, isInverted]);
        this._drawTrace(posX, posY, length, isHorizontal, isInverted);
    }
    _drawTrace(posX, posY, length, isHorizontal, isInverted) {
        const startX = this.width * posX;
        const startY = this.height * posY;
        const lineLength = (isHorizontal) ? this.width * length : this.height * length;
        const endX = startX + (isHorizontal ? lineLength : 0);
        const endY = startY + (isHorizontal ? 0 : lineLength);

        this.ctx.strokeStyle = this.options.traceColor;
        this.ctx.lineWidth = this.options.lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        this.markLineSegment(startX, startY, endX, endY);

        const lineContent = this.options.lineSpacing + this.options.lineWidth;
        const lineAmount = (lineLength - this.options.lineMargin) / lineContent;

        let lineActPos = this.options.lineMargin + (isHorizontal ? startX : startY);

        for (let line = 0; line < lineAmount; line++) {
            const lx = isHorizontal ? lineActPos : startX;
            const ly = isHorizontal ? startY : lineActPos;

            this.markGrid(lx, ly);

            this.lines.push({
                x: lx,
                y: ly,
                angle: (isInverted ? Math.PI : 0) + (isHorizontal ? this.PIH : 0),
            });
            lineActPos += lineContent;
        }
    }

    frame() {
        for (let i = this.lines.length - 1; i >= 0; i--) {
            const line = this.lines[i];

            const dx = Math.cos(line.angle) * this.options.speed;
            const dy = Math.sin(line.angle) * this.options.speed;

            const newX = line.x + dx;
            const newY = line.y + dy;

            const lookAheadDist = this.options.speed + (this.options.gridResolution / 2);
            const lookAheadX = line.x + (Math.cos(line.angle) * lookAheadDist);
            const lookAheadY = line.y + (Math.sin(line.angle) * lookAheadDist);

            const currentGrid = this.getGridCoords(line.x, line.y);
            const nextGrid = this.getGridCoords(lookAheadX, lookAheadY);

            const isMovingToNewCell = (currentGrid.gx !== nextGrid.gx || currentGrid.gy !== nextGrid.gy);

            if (isMovingToNewCell && this.isColliding(lookAheadX, lookAheadY)) {
                this.lines.splice(i, 1);
                continue;
            }

            this.ctx.strokeStyle = this.options.traceColor;
            this.ctx.lineWidth = this.options.lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(line.x, line.y);
            this.ctx.lineTo(newX, newY);
            this.ctx.stroke();

            this.markLineSegment(line.x, line.y, newX, newY);
            line.x = newX;
            line.y = newY;

            if (Math.random() < this.options.lineAngleVariation) {
                const delta = (Math.random() < 0.5 ? -this.PIQ : this.PIQ);
                line.angle = (line.angle + delta + this.PIT) % this.PIT;
            }

            if (Math.random() < this.options.lineEndCoefficient) {
                this.lines.splice(i, 1);
                this.drawVia(line.x, line.y);
            }
        }
    }

    start() {
        if (this.running) return;
        this.initCanvas();

        if (this.options.autoResize && typeof ResizeObserver !== 'undefined') {
            if (this.resizeObserver) this.resizeObserver.disconnect();

            this.resizeObserver = new ResizeObserver(() => {
                if (this.running) this.restart();
            });
            this.resizeObserver.observe(this.traceElement);
        }

        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this.frame();
            this.animationFrameId = requestAnimationFrame(loop);
        };
        loop();
    }

    stop() {
        this.running = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        if (this.resizeObserver) this.resizeObserver.disconnect();
    }
}