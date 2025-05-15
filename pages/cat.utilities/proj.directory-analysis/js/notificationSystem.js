const defaults = {
    duration: 3000, // Default duration in milliseconds
    position: 'top-right' // (Currently CSS handles position)
};

// Show a notification message that automatically disappears
export function showNotification(message, options = {}) {
    const settings = { ...defaults, ...options };
    const notificationEl = document.getElementById('notification');
    
    if (!notificationEl) {
        console.warn("Notification element not found in DOM.");
        return;
    }
    
    // Clear any existing timer to prevent premature hiding if called rapidly
    if (notificationEl.timerId) {
        clearTimeout(notificationEl.timerId);
    }

    // Remove animation classes to reset
    notificationEl.classList.remove('show', 'hide'); 
    void notificationEl.offsetWidth; // Force reflow to restart animation if applicable

    // Set notification content and show it
    notificationEl.textContent = message;
    notificationEl.classList.add('show');
    
    // CSS animation handles showing and then starting the hide after its own delay
    // The CSS `animation: slideDown 0.3s forwards, slideUp 0.3s forwards 3s;`
    // means the slideUp (hide) starts after 3 seconds.
    // If a different duration is needed dynamically, JS timeouts would be better.
    // For simplicity, current CSS handles a fixed visibility period.
    // If settings.duration is different, we'd need to adjust animation or use JS timeouts.
    if (settings.duration && settings.duration !== 3000) { // Example for dynamic duration
        notificationEl.style.animation = 'none'; // Temporarily remove CSS animation
        void notificationEl.offsetWidth; // Reflow
        notificationEl.style.animation = `slideDown 0.3s forwards, slideUp 0.3s forwards ${settings.duration/1000}s`;
    }

}

// Initialize notification system
export function initNotificationSystem() {
    if (!document.getElementById('notification')) {
        const notificationEl = document.createElement('div');
        notificationEl.id = 'notification';
        notificationEl.className = 'notification'; // Ensure class for styling
        document.body.appendChild(notificationEl);
    }
}