import { config } from './config.js';

// Waveform - RGB parade visualization showing color distribution across the image
export function updateWaveform() {
    const waveformCanvas = document.getElementById('waveform-canvas');
    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.width = waveformCanvas.parentElement.clientWidth;
    const height = waveformCanvas.height = 250;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    if (!window.imageData || !window.originalImage) {
        drawNoImageMessage(ctx, width, height);
        return;
    }
    
    const data = window.imageData.data;
    
    // Draw background and grid
    drawWaveformGrid(ctx, width, height);
    
    const imgWidth = window.originalImage.width;
    const imgHeight = window.originalImage.height;
    const scaleX = width / imgWidth;
    
    // Arrays for each channel's values at each x position
    const redValues = Array(width).fill().map(() => []);
    const greenValues = Array(width).fill().map(() => []);
    const blueValues = Array(width).fill().map(() => []);
    
    // Collect values by column
    for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
            const i = (y * imgWidth + x) * 4;
            const screenX = Math.floor(x * scaleX);
            
            if (screenX < 0 || screenX >= width) continue;
            
            redValues[screenX].push(data[i]);       // Red
            greenValues[screenX].push(data[i + 1]); // Green
            blueValues[screenX].push(data[i + 2]);  // Blue
        }
    }
    
    // Draw waveforms with histogram-like density visualization
    drawWaveformChannel(ctx, width, height, redValues, config.waveform.redColor);
    drawWaveformChannel(ctx, width, height, greenValues, config.waveform.greenColor);
    drawWaveformChannel(ctx, width, height, blueValues, config.waveform.blueColor);
    
    // Add labels
    drawWaveformLabels(ctx, width, height);
}

function drawWaveformGrid(ctx, width, height) {
    // Draw grid
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines with labels (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
        const y = height * (i / 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Add percentage labels
        ctx.fillStyle = '#999';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${100 - i * 25}%`, 5, y + 12);
    }
    
    // Vertical grid lines
    for (let i = 1; i < 4; i++) {
        const x = width * (i / 4);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
}

function drawWaveformChannel(ctx, width, height, values, color) {
    // Create a heat map representing density
    const alphaBase = 0.01;  // Base alpha value for single pixels
    const maxAlpha = 0.8;    // Maximum alpha for highest density
    
    // Get the color components from the rgba string
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([.\d]+)\)/);
    const r = rgbaMatch[1];
    const g = rgbaMatch[2];
    const b = rgbaMatch[3];
    
    // Find max frequency for scaling
    let maxFreq = 0;
    for (let x = 0; x < width; x++) {
        if (!values[x]) continue;
        
        const histogram = new Array(256).fill(0);
        values[x].forEach(val => histogram[val]++);
        maxFreq = Math.max(maxFreq, ...histogram);
    }
    
    // Draw each column
    for (let x = 0; x < width; x++) {
        if (!values[x] || values[x].length === 0) continue;
        
        // Create a frequency histogram for this column
        const histogram = new Array(256).fill(0);
        values[x].forEach(val => histogram[val]++);
        
        // Draw the histogram as vertical lines with varying opacity
        for (let y = 0; y < 256; y++) {
            const count = histogram[y];
            if (count === 0) continue;
            
            // Calculate opacity based on frequency
            const alpha = Math.min(maxAlpha, alphaBase * count * 5);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            
            // Calculate y-position (invert y since 0 is top in canvas)
            const yPos = Math.round(height * (1 - y / 255));
            
            // Draw a dot or line
            const dotSize = Math.max(1, config.waveform.lineWidth);
            ctx.fillRect(x, yPos, 1, dotSize);
        }
    }
    
    // Add min/max envelope
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    
    // Draw min envelope
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
        if (!values[x] || values[x].length === 0) continue;
        
        const min = Math.min(...values[x]);
        const y = height * (1 - min / 255);
        
        if (x === 0 || !values[x-1] || values[x-1].length === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // Draw max envelope
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
        if (!values[x] || values[x].length === 0) continue;
        
        const max = Math.max(...values[x]);
        const y = height * (1 - max / 255);
        
        if (x === 0 || !values[x-1] || values[x-1].length === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
}

function drawWaveformLabels(ctx, width, height) {
    // Add channel labels
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    
    // R, G, B channel indicators
    ctx.fillStyle = config.waveform.redColor.replace(/[^,]+$/, "1)");
    ctx.fillText("R", width - 30, 20);
    
    ctx.fillStyle = config.waveform.greenColor.replace(/[^,]+$/, "1)");
    ctx.fillText("G", width - 30, 40);
    
    ctx.fillStyle = config.waveform.blueColor.replace(/[^,]+$/, "1)");
    ctx.fillText("B", width - 30, 60);
    
    // Title
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText("RGB Parade", width / 2, 15);
}

function drawNoImageMessage(ctx, width, height) {
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Load an image to view the waveform', width / 2, height / 2);
}