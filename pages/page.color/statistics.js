import { config } from './config.js';

// Statistics
export function updateStatistics() {
    const colorStats = document.getElementById('color-stats');
    
    if (!window.imageData) {
        return; // Exit if no image is loaded
    }
    
    const data = window.imageData.data;
    const pixelCount = data.length / 4;
    
    // Initialize
    let rSum = 0, gSum = 0, bSum = 0;
    let rMin = 255, gMin = 255, bMin = 255;
    let rMax = 0, gMax = 0, bMax = 0;
    let luminanceSum = 0;
    let saturationSum = 0;
    let hueSum = 0;
    
    let darkPixels = 0;
    let midPixels = 0;
    let brightPixels = 0;
    
    // Calculate statistics
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // RGB stats
        rSum += r;
        gSum += g;
        bSum += b;
        
        rMin = Math.min(rMin, r);
        gMin = Math.min(gMin, g);
        bMin = Math.min(bMin, b);
        
        rMax = Math.max(rMax, r);
        gMax = Math.max(gMax, g);
        bMax = Math.max(bMax, b);
        
        // Calculate luminance (perceived brightness)
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        luminanceSum += luminance;
        
        // Count pixels by brightness
        if (luminance < 64) {
            darkPixels++;
        } else if (luminance < 192) {
            midPixels++;
        } else {
            brightPixels++;
        }
        
        // Calculate HSL
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        
        // Hue calculation
        let hue = 0;
        if (chroma !== 0) {
            if (max === r) {
                hue = ((g - b) / chroma) % 6;
            } else if (max === g) {
                hue = (b - r) / chroma + 2;
            } else {
                hue = (r - g) / chroma + 4;
            }
            hue = hue * 60;
            if (hue < 0) hue += 360;
        }
        hueSum += hue;
        
        // Saturation calculation
        const lightness = (max + min) / 2;
        let saturation = 0;
        if (chroma !== 0) {
            saturation = chroma / (1 - Math.abs(2 * lightness / 255 - 1));
        }
        saturationSum += saturation;
    }
    
    // Calculate averages
    const rAvg = rSum / pixelCount;
    const gAvg = gSum / pixelCount;
    const bAvg = bSum / pixelCount;
    const luminanceAvg = luminanceSum / pixelCount;
    const saturationAvg = saturationSum / pixelCount;
    const hueAvg = hueSum / pixelCount;
    
    // Calculate contrast
    const luminanceStdDev = Math.sqrt(Array.from({ length: data.length / 4 }, (_, i) => {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return Math.pow(lum - luminanceAvg, 2);
    }).reduce((sum, val) => sum + val, 0) / pixelCount);
    
    const contrast = luminanceStdDev / luminanceAvg;
    
    // Display statistics
    colorStats.innerHTML = `
        <div class="stat-item">
            <div class="stat-title">RGB Averages</div>
            <div>Red: ${rAvg.toFixed(2)}</div>
            <div>Green: ${gAvg.toFixed(2)}</div>
            <div>Blue: ${bAvg.toFixed(2)}</div>
        </div>
        
        <div class="stat-item">
            <div class="stat-title">RGB Range</div>
            <div>Red: ${rMin} - ${rMax}</div>
            <div>Green: ${gMin} - ${gMax}</div>
            <div>Blue: ${bMin} - ${bMax}</div>
        </div>
        
        <div class="stat-item">
            <div class="stat-title">Brightness</div>
            <div>Average: ${luminanceAvg.toFixed(2)}</div>
            <div>Dark pixels: ${(darkPixels / pixelCount * 100).toFixed(1)}%</div>
            <div>Mid pixels: ${(midPixels / pixelCount * 100).toFixed(1)}%</div>
            <div>Bright pixels: ${(brightPixels / pixelCount * 100).toFixed(1)}%</div>
        </div>
        
        <div class="stat-item">
            <div class="stat-title">Color Properties</div>
            <div>Avg Hue: ${hueAvg.toFixed(2)}°</div>
            <div>Avg Saturation: ${(saturationAvg * 100).toFixed(1)}%</div>
            <div>Contrast ratio: ${contrast.toFixed(2)}</div>
        </div>
    `;
}

// Suggestions
export function generateSuggestions() {
    const suggestionsContent = document.getElementById('suggestions-content');
    
    if (!window.imageData) {
        return; // Exit if no image is loaded
    }
    
    const data = window.imageData.data;
    const pixelCount = data.length / 4;
    
    // Calculate statistics for suggestions
    let rSum = 0, gSum = 0, bSum = 0;
    let luminanceSum = 0;
    let saturationSum = 0;
    
    let overexposedCount = 0;
    let underexposedCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        rSum += r;
        gSum += g;
        bSum += b;
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        luminanceSum += luminance;
        
        // Calculate saturation
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let saturation = 0;
        if (max !== 0) {
            saturation = delta / max;
        }
        saturationSum += saturation;
        
        // Check exposure
        if (luminance < config.thresholds.underexposed) {
            underexposedCount++;
        } else if (luminance > config.thresholds.overexposed) {
            overexposedCount++;
        }
    }
    
    const avgLuminance = luminanceSum / pixelCount;
    const avgSaturation = saturationSum / pixelCount;
    
    // Calculate contrast
    const luminanceStdDev = Math.sqrt(Array.from({ length: data.length / 4 }, (_, i) => {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return Math.pow(lum - avgLuminance, 2);
    }).reduce((sum, val) => sum + val, 0) / pixelCount);
    
    const contrast = luminanceStdDev / avgLuminance;
    
    // Generate suggestions
    const suggestions = [];
    
    // Brightness suggestions
    if (avgLuminance < config.thresholds.brightnessDark) {
        suggestions.push({
            title: 'Low Brightness',
            desc: 'The image appears quite dark. Consider increasing exposure or brightness in post-processing.'
        });
    } else if (avgLuminance > config.thresholds.brightnessLight) {
        suggestions.push({
            title: 'High Brightness',
            desc: 'The image appears quite bright. Consider decreasing exposure or brightness in post-processing.'
        });
    }
    
    // Contrast suggestions
    if (contrast < config.thresholds.contrastLow) {
        suggestions.push({
            title: 'Low Contrast',
            desc: 'The image has low contrast. Consider increasing contrast to make it more dynamic.'
        });
    } else if (contrast > config.thresholds.contrastHigh) {
        suggestions.push({
            title: 'High Contrast',
            desc: 'The image has very high contrast. Consider reducing contrast if details are being lost in shadows or highlights.'
        });
    }
    
    // Saturation suggestions
    if (avgSaturation < config.thresholds.saturationLow) {
        suggestions.push({
            title: 'Low Saturation',
            desc: 'The image colors appear desaturated. Consider increasing saturation for more vibrant colors.'
        });
    } else if (avgSaturation > config.thresholds.saturationHigh) {
        suggestions.push({
            title: 'High Saturation',
            desc: 'The image colors are highly saturated. Consider reducing saturation for a more natural look.'
        });
    }
    
    // Exposure suggestions
    const underexposedPercent = underexposedCount / pixelCount * 100;
    const overexposedPercent = overexposedCount / pixelCount * 100;
    
    if (underexposedPercent > 10) {
        suggestions.push({
            title: 'Underexposed Areas',
            desc: `${underexposedPercent.toFixed(1)}% of the image is underexposed. Consider recovering shadow details.`
        });
    }
    
    if (overexposedPercent > 5) {
        suggestions.push({
            title: 'Overexposed Areas',
            desc: `${overexposedPercent.toFixed(1)}% of the image is overexposed. Check for clipped highlights.`
        });
    }
    
    // Color balance suggestions
    const rAvg = rSum / pixelCount;
    const gAvg = gSum / pixelCount;
    const bAvg = bSum / pixelCount;
    
    const maxComponent = Math.max(rAvg, gAvg, bAvg);
    const minComponent = Math.min(rAvg, gAvg, bAvg);
    const colorDifference = maxComponent - minComponent;
    
    if (colorDifference > 30) {
        let colorCast = '';
        if (rAvg === maxComponent) colorCast = 'red';
        else if (gAvg === maxComponent) colorCast = 'green';
        else colorCast = 'blue';
        
        suggestions.push({
            title: 'Color Balance',
            desc: `The image appears to have a ${colorCast} color cast. Consider adjusting white balance.`
        });
    }
    
    // Display suggestions
    if (suggestions.length === 0) {
        suggestionsContent.innerHTML = '<div class="suggestion-item"><h3>Balanced Image</h3><p>Your image appears well-balanced with good exposure, contrast, and color properties.</p></div>';
    } else {
        suggestionsContent.innerHTML = suggestions.map(suggestion => 
            `<div class="suggestion-item">
                <h3>${suggestion.title}</h3>
                <p>${suggestion.desc}</p>
            </div>`
        ).join('');
    }
}