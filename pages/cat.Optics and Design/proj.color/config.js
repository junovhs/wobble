export const config = {
    // Histogram configuration
    histogram: {
        binCount: 256,
        rgbColor: 'rgba(150, 150, 150, 0.8)',
        redColor: 'rgba(255, 0, 0, 0.8)',
        greenColor: 'rgba(0, 255, 0, 0.8)',
        blueColor: 'rgba(0, 0, 255, 0.8)',
        luminanceColor: 'rgba(255, 255, 0, 0.8)',
        lineWidth: 2,
        drawMode: 'line',       // 'line' or 'fill'
        useLogScale: false,     // Use logarithmic scaling for better visualization
        showStats: true,        // Show statistics in the histogram
        showZones: true         // Show shadows/midtones/highlights zones
    },
    
    // Waveform configuration
    waveform: {
        height: 256,
        lineWidth: 1,
        redColor: 'rgba(255, 0, 0, 0.5)',
        greenColor: 'rgba(0, 255, 0, 0.5)',
        blueColor: 'rgba(0, 0, 255, 0.5)',
        showEnvelope: true,
        showDensity: true
    },
    
    // Vectorscope configuration
    vectorscope: {
        radius: 128,
        dotSize: 1,
        opacity: 0.5,
        drawGuides: true,
        showSkinToneLine: true,
        heatmapColors: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
    },
    
    // Threshold values for suggestions
    thresholds: {
        contrastLow: 1.5,
        contrastHigh: 4.5,
        saturationLow: 0.2,
        saturationHigh: 0.8,
        brightnessDark: 0.3,
        brightnessLight: 0.7,
        underexposed: 0.2,
        overexposed: 0.8
    }
};