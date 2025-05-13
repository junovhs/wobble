// Notification system to replace alerts with non-blocking notifications

const defaults = {
    duration: 2000, // Default duration in milliseconds
    position: 'top-right'
};

// Show a notification message that automatically disappears
export function showNotification(message, options = {}) {
    const settings = { ...defaults, ...options };
    const notificationEl = document.getElementById('notification');
    
    // Remove any existing animations and classes
    notificationEl.classList.remove('show');
    void notificationEl.offsetWidth; // Force reflow to restart animation
    
    // Set notification content and show it
    notificationEl.textContent = message;
    notificationEl.classList.add('show');
    
    // If a duration is specified other than 'permanent', auto-remove
    if (settings.duration !== 'permanent') {
        // The CSS animation handles the timing
    }
    
    return notificationEl; // Return element in case caller wants to manipulate it
}

// Initialize notification system
export function initNotificationSystem() {
    // Create notification element if it doesn't exist
    if (!document.getElementById('notification')) {
        const notificationEl = document.createElement('div');
        notificationEl.id = 'notification';
        notificationEl.className = 'notification';
        document.body.appendChild(notificationEl);
    }
}