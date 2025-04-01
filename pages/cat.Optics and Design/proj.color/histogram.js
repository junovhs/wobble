import { config } from './config.js';

// Histogram
export function updateHistogram() {
    const histogramCanvas = document.getElementById('histogram-canvas');
    const ctx = histogramCanvas.getContext('2d');
    const width = histogramCanvas.width = histogramCanvas.parentElement.clientWidth;
    const height = histogramCanvas.height = 250;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    if (!window.imageData) {
        drawNoImageMessage(ctx, width, height);
        return;
    }
    
    const data = window.imageData.data;
    const binCount = config.histogram.binCount;
    const binWidth = width / binCount;
    
    // Initialize histograms
    const histR = new Array(binCount).fill(0);
    const histG = new Array(binCount).fill(0);
    const histB = new Array(binCount).fill(0);
    const histRGB = new Array(binCount).fill(0);
    const histLuminance = new Array(binCount).fill(0);
    
    // Calculate histograms
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate luminance (perceived brightness)
        const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        
        // Use bin index for proper binning when binCount != 256
        const rBin = Math.min(binCount - 1, Math.floor(r / 256 * binCount));
        const gBin = Math.min(binCount - 1, Math.floor(g / 256 * binCount));
        const bBin = Math.min(binCount - 1, Math.floor(b / 256 * binCount));
        const rgbBin = Math.min(binCount - 1, Math.floor((r + g + b) / 3 / 256 * binCount));
        const lumBin = Math.min(binCount - 1, Math.floor(luminance / 256 * binCount));
        
        histR[rBin]++;
        histG[gBin]++;
        histB[bBin]++;
        histRGB[rgbBin]++;
        histLuminance[lumBin]++;
    }
    
    // Apply logarithmic scaling for better visualization (optional)
    const useLogScale = config.histogram.useLogScale;
    if (useLogScale) {
        [histR, histG, histB, histRGB, histLuminance].forEach(hist => {
            for (let i = 0; i < hist.length; i++) {
                if (hist[i] > 0) hist[i] = Math.log(hist[i]);
            }
        });
    }
    
    // Find maximum value for scaling
    const maxR = Math.max(...histR);
    const maxG = Math.max(...histG);
    const maxB = Math.max(...histB);
    const maxRGB = Math.max(...histRGB);
    const maxLuminance = Math.max(...histLuminance);
    const maxValue = Math.max(maxR, maxG, maxB, maxRGB, maxLuminance);
    
    // Draw background with shading
    drawHistogramBackground(ctx, width, height);
    
    // Draw zone indicators (shadows, midtones, highlights)
    drawZoneIndicators(ctx, width, height);
    
    // Get active channels
    const channelToggles = document.querySelectorAll('.channel-toggles input');
    const activeChannels = Array.from(channelToggles)
        .filter(toggle => toggle.checked)
        .map(toggle => toggle.dataset.channel);
    
    // Draw histograms based on active channels
    // Draw luminance first (if active) so it's behind RGB/individual channels
    if (activeChannels.includes('luminance')) {
        drawHistogram(histLuminance, maxValue, config.histogram.luminanceColor, 'fill');
    }
    
    if (activeChannels.includes('rgb')) {
        drawHistogram(histRGB, maxValue, config.histogram.rgbColor, 'fill');
    }
    
    // Individual channels as lines so they're more visible on top
    const drawMode = config.histogram.drawMode || 'line';
    
    if (activeChannels.includes('r')) {
        drawHistogram(histR, maxValue, config.histogram.redColor, drawMode);
    }
    
    if (activeChannels.includes('g')) {
        drawHistogram(histG, maxValue, config.histogram.greenColor, drawMode);
    }
    
    if (activeChannels.includes('b')) {
        drawHistogram(histB, maxValue, config.histogram.blueColor, drawMode);
    }
    
    // Draw extra details
    drawHistogramDetails(ctx, width, height);
    
    // Draw statistics if configured
    if (config.histogram.showStats) {
        drawHistogramStats(ctx, width, height, { histR, histG, histB, histRGB, histLuminance }, activeChannels);
    }
    
    function drawHistogram(histogram, maxValue, color, mode = 'line') {
        ctx.beginPath();
        
        if (mode === 'line') {
            ctx.strokeStyle = color;
            ctx.lineWidth = config.histogram.lineWidth || 2;
            
            for (let i = 0; i < binCount; i++) {
                const x = i * binWidth;
                const normalizedHeight = histogram[i] / maxValue;
                const y = height - (normalizedHeight * height * 0.9);
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
        } else {
            // Fill mode
            ctx.fillStyle = color;
            
            for (let i = 0; i < binCount; i++) {
                const x = i * binWidth;
                const normalizedHeight = histogram[i] / maxValue;
                const barHeight = normalizedHeight * height * 0.9;
                
                ctx.fillRect(x, height - barHeight, binWidth - 0.5, barHeight);
            }
        }
    }
}

function drawHistogramBackground(ctx, width, height) {
    // Draw grid background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
        const y = height * (i / 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Vertical grid lines (at 0, 64, 128, 192, 255 positions)
    for (let i = 0; i <= 4; i++) {
        const x = width * (i / 4);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Subtle horizontal markers at 25%, 50%, 75% height
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 1; i <= 3; i++) {
        const y = height * (i / 4);
        ctx.fillRect(0, y - 1, width, 1);
    }
}

function drawZoneIndicators(ctx, width, height) {
    // Draw zones (shadows, midtones, highlights)
    const zones = [
        { name: 'Shadows', color: 'rgba(0,0,0,0.05)', start: 0, end: 0.33 },
        { name: 'Midtones', color: 'rgba(128,128,128,0.05)', start: 0.33, end: 0.67 },
        { name: 'Highlights', color: 'rgba(255,255,255,0.05)', start: 0.67, end: 1 }
    ];
    
    zones.forEach(zone => {
        // Draw zone background
        ctx.fillStyle = zone.color;
        ctx.fillRect(Math.floor(width * zone.start), 0, Math.ceil(width * (zone.end - zone.start)), height);
        
        // Add subtle zone label
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        const x = width * (zone.start + (zone.end - zone.start) / 2);
        ctx.fillText(zone.name, x, height - 5);
    });
}

function drawHistogramDetails(ctx, width, height) {
    // Add value markers (0, 64, 128, 192, 255)
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    const labels = ['0', '64', '128', '192', '255'];
    labels.forEach((label, i) => {
        const x = width * (i / 4);
        ctx.fillText(label, x, height - 5);
    });
    
    // Draw histogram border
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
    
    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Histogram', width / 2, 12);
}

function drawHistogramStats(ctx, width, height, histograms, activeChannels) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(4, 16, 120, 66);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(4, 16, 120, 66);
    
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333';
    
    let yPos = 28;
    const channelMap = {
        'rgb': { color: config.histogram.rgbColor, name: 'RGB' },
        'r': { color: config.histogram.redColor, name: 'Red' },
        'g': { color: config.histogram.greenColor, name: 'Green' },
        'b': { color: config.histogram.blueColor, name: 'Blue' },
        'luminance': { color: config.histogram.luminanceColor, name: 'Luma' }
    };
    
    activeChannels.forEach(channel => {
        const hist = channel === 'r' ? histograms.histR : 
                    channel === 'g' ? histograms.histG :
                    channel === 'b' ? histograms.histB :
                    channel === 'rgb' ? histograms.histRGB :
                    histograms.histLuminance;
        
        // Calculate mean and median
        let sum = 0;
        let count = 0;
        for (let i = 0; i < hist.length; i++) {
            sum += i * hist[i];
            count += hist[i];
        }
        const mean = sum / count;
        
        ctx.fillStyle = channelMap[channel].color.replace(/[^,]+$/, "1)");
        ctx.fillText(`${channelMap[channel].name}: μ=${mean.toFixed(1)}`, 8, yPos);
        yPos += 13;
    });
}

function drawNoImageMessage(ctx, width, height) {
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Load an image to view the histogram', width / 2, height / 2);
}