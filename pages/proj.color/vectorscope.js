import { config } from './config.js';

// Vectorscope - Shows color distribution in chrominance space
export function updateVectorscope() {
    const vectorscopeCanvas = document.getElementById('vectorscope-canvas');
    const ctx = vectorscopeCanvas.getContext('2d');
    const width = vectorscopeCanvas.width = vectorscopeCanvas.parentElement.clientWidth;
    const height = vectorscopeCanvas.height = 250;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.85;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    if (!window.imageData) {
        drawNoImageMessage(ctx, width, height);
        return;
    }
    
    // Draw guides first (background)
    if (config.vectorscope.drawGuides) {
        drawVectorscopeGuides(ctx, centerX, centerY, radius);
    }
    
    // Plot pixels
    const data = window.imageData.data;
    
    // Prepare a 2D density map for the vectorscope
    const densityMap = createDensityMap(width, height);
    
    // Sample pixels (not every pixel for performance)
    const pixelCount = data.length / 4;
    const pixelStep = Math.max(1, Math.floor(pixelCount / 100000));
    
    // Collect UV values
    for (let i = 0; i < data.length; i += 4 * pixelStep) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Convert RGB to YUV (using BT.601 matrix)
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const u = (b - y) * 0.565; // Scaled for display
        const v = (r - y) * 0.713; // Scaled for display
        
        // Scale and center
        const x = Math.round(centerX + (u / 127) * radius);
        const y2 = Math.round(centerY - (v / 127) * radius);
        
        // Skip if outside bounds
        if (x < 0 || x >= width || y2 < 0 || y2 >= height) continue;
        
        // Increment the density at this point
        densityMap[y2][x]++;
    }
    
    // Draw the density map
    drawDensityMap(ctx, densityMap, width, height);
    
    // Draw skin tone line (optional)
    drawSkinToneLine(ctx, centerX, centerY, radius);
    
    // Add labels on top
    if (config.vectorscope.drawGuides) {
        drawVectorscopeLabels(ctx, centerX, centerY, radius);
    }
}

function createDensityMap(width, height) {
    // Initialize a 2D array to store pixel density
    return Array(height).fill().map(() => Array(width).fill(0));
}

function drawDensityMap(ctx, densityMap, width, height) {
    // Find the maximum density value for normalization
    let maxDensity = 1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            maxDensity = Math.max(maxDensity, densityMap[y][x]);
        }
    }
    
    // Create a temporary canvas for the heatmap
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    const imageData = tempCtx.createImageData(width, height);
    
    // Fill the image data based on density
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const density = densityMap[y][x];
            if (density === 0) continue;
            
            // Calculate opacity based on density (non-linear scale for better visualization)
            const normalizedDensity = Math.pow(density / maxDensity, 0.4);
            
            // Create a color based on density (using a "heat" color scale)
            // Blue -> Cyan -> Green -> Yellow -> Red
            let r, g, b;
            
            // Adjust these values to tweak the color gradient
            if (normalizedDensity < 0.25) {
                // Blue to Cyan
                r = 0;
                g = normalizedDensity * 4 * 255;
                b = 255;
            } else if (normalizedDensity < 0.5) {
                // Cyan to Green
                r = 0;
                g = 255;
                b = 255 - (normalizedDensity - 0.25) * 4 * 255;
            } else if (normalizedDensity < 0.75) {
                // Green to Yellow
                r = (normalizedDensity - 0.5) * 4 * 255;
                g = 255;
                b = 0;
            } else {
                // Yellow to Red
                r = 255;
                g = 255 - (normalizedDensity - 0.75) * 4 * 255;
                b = 0;
            }
            
            // Set pixel in the image data
            const i = (y * width + x) * 4;
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255 * normalizedDensity * config.vectorscope.opacity;
        }
    }
    
    // Put the image data on the temporary canvas
    tempCtx.putImageData(imageData, 0, 0);
    
    // Draw the temporary canvas onto the main canvas
    ctx.drawImage(tempCanvas, 0, 0);
}

function drawVectorscopeGuides(ctx, centerX, centerY, radius) {
    // Draw circles
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    
    // Draw concentric circles at 25%, 50%, 75%, and 100% of radius
    for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * (i / 4), 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();
    
    // Draw color targets at standard angles
    drawColorTarget(ctx, centerX, centerY, radius, 0, 'R', '#f00'); // Red
    drawColorTarget(ctx, centerX, centerY, radius, 60, 'Y', '#ff0'); // Yellow
    drawColorTarget(ctx, centerX, centerY, radius, 120, 'G', '#0f0'); // Green
    drawColorTarget(ctx, centerX, centerY, radius, 180, 'C', '#0ff'); // Cyan
    drawColorTarget(ctx, centerX, centerY, radius, 240, 'B', '#00f'); // Blue
    drawColorTarget(ctx, centerX, centerY, radius, 300, 'M', '#f0f'); // Magenta
}

function drawColorTarget(ctx, centerX, centerY, radius, angle, label, color) {
    const radians = (angle * Math.PI) / 180;
    // Position at 75% of the radius
    const x = centerX + Math.cos(radians) * radius * 0.75;
    const y = centerY - Math.sin(radians) * radius * 0.75;
    
    // Draw small circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw label
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Position label outside the circle at full radius
    const labelX = centerX + Math.cos(radians) * (radius + 15);
    const labelY = centerY - Math.sin(radians) * (radius + 15);
    ctx.fillText(label, labelX, labelY);
}

function drawVectorscopeLabels(ctx, centerX, centerY, radius) {
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Vectorscope', centerX, 5);
    
    // Add U/V labels
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('U', centerX + radius + 5, centerY);
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('V', centerX, centerY + radius + 5);
}

function drawSkinToneLine(ctx, centerX, centerY, radius) {
    // Draw the skin tone line (I/Q at approx. 123 degrees)
    const angle1 = 123 * Math.PI / 180;
    const angle2 = (angle1 + Math.PI) % (2 * Math.PI);
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 180, 180, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    
    ctx.moveTo(
        centerX + Math.cos(angle1) * radius,
        centerY - Math.sin(angle1) * radius
    );
    ctx.lineTo(
        centerX + Math.cos(angle2) * radius,
        centerY - Math.sin(angle2) * radius
    );
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label the skin tone line
    const labelX = centerX + Math.cos(angle1) * (radius * 0.6);
    const labelY = centerY - Math.sin(angle1) * (radius * 0.6);
    
    ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
    ctx.font = 'italic 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('skin tone', labelX, labelY);
}

function drawNoImageMessage(ctx, width, height) {
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Load an image to view the vectorscope', width / 2, height / 2);
}