import { config } from './config.js';
import { updateHistogram } from './histogram.js';
import { updateWaveform } from './waveform.js';
import { updateVectorscope } from './vectorscope.js';
import { updateStatistics, generateSuggestions } from './statistics.js';

// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileInput');
const analysisContainer = document.getElementById('analysis-container');
const imageDisplay = document.getElementById('image-display');
const channelToggles = document.querySelectorAll('.channel-toggles input');

// Global variables - making them accessible via window for other modules
window.originalImage = null;
window.imageData = null;

// Initialize
initApp();

function initApp() {
    // Set up event listeners
    dropArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    dropArea.addEventListener('dragover', handleDragOver);
    dropArea.addEventListener('drop', handleDrop);
    document.addEventListener('paste', handlePaste);
    
    // Channel toggles for histogram
    channelToggles.forEach(toggle => {
        toggle.addEventListener('change', updateHistogram);
    });
}

// Event handlers
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.match('image.*')) {
        processImage(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.style.borderColor = '#3498db';
    dropArea.style.backgroundColor = '#f0f8ff';
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropArea.style.borderColor = '#ccc';
    dropArea.style.backgroundColor = '#fff';
    
    if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        if (file.type.match('image.*')) {
            processImage(file);
        }
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            processImage(blob);
            break;
        }
    }
}

// Image processing
function processImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            window.originalImage = img;
            
            // Display the image
            imageDisplay.innerHTML = '';
            imageDisplay.appendChild(img.cloneNode());
            
            // Get image data
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            window.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Show analysis container
            analysisContainer.classList.remove('hidden');
            
            // Perform analysis
            analyzeImage();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function analyzeImage() {
    // Update all analysis tools
    updateHistogram();
    updateWaveform();
    updateVectorscope();
    updateStatistics();
    generateSuggestions();
}