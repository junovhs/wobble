// Theme Manager to handle theme switching

const themes = {
    retro: 'theme-retro',
    modern: 'theme-modern',
    minimal: 'theme-minimal'
};

// Initialize theme from local storage or default to retro
export function initThemeManager() {
    const savedTheme = localStorage.getItem('diranalyse-theme') || 'retro';
    setTheme(savedTheme);
    
    // Set up event listeners for theme buttons
    document.getElementById('retroTheme').addEventListener('click', () => setTheme('retro'));
    document.getElementById('modernTheme').addEventListener('click', () => setTheme('modern'));
    document.getElementById('minimalTheme').addEventListener('click', () => setTheme('minimal'));
    
    // Set CRT toggle visibility based on theme
    updateCRTToggleVisibility(savedTheme);
}

// Set the current theme
export function setTheme(themeName) {
    if (!themes[themeName]) {
        console.error(`Theme "${themeName}" not found!`);
        return;
    }
    
    // Remove all theme classes
    document.body.classList.remove(...Object.values(themes));
    
    // Add the selected theme class
    document.body.classList.add(themes[themeName]);
    
    // Save to localStorage
    localStorage.setItem('diranalyse-theme', themeName);
    
    // Update theme buttons
    updateThemeButtons(themeName);
    
    // Update CRT toggle visibility
    updateCRTToggleVisibility(themeName);
}

// Update theme button states
function updateThemeButtons(activeTheme) {
    document.querySelectorAll('.theme-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Add active class to the current theme button
    const buttonId = `${activeTheme}Theme`;
    const activeButton = document.getElementById(buttonId);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Show or hide CRT toggle based on theme
function updateCRTToggleVisibility(theme) {
    const crtToggle = document.getElementById('crtToggle');
    if (crtToggle) {
        crtToggle.style.display = (theme === 'retro') ? 'block' : 'none';
    }
}

// Get current theme
export function getCurrentTheme() {
    return localStorage.getItem('diranalyse-theme') || 'retro';
}