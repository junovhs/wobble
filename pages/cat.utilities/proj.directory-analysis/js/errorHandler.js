// Error Handler module to handle and display meaningful error messages

const errorTypes = {
    NoModificationAllowedError: {
        title: "Permission Denied: Cannot Modify Files",
        message: "The browser was denied permission to modify the file system.",
        suggestions: [
            "Try selecting a different folder that your browser has permissions to access.",
            "Some system folders and protected locations cannot be modified by web apps.",
            "For Chrome/Edge: Enable full access to the file system in chrome://flags/#file-system-access-api .",
            "Use drag and drop instead of the file picker if you were using the picker, or vice versa."
        ]
    },
    NotFoundError: {
        title: "File or Directory Not Found",
        message: "The requested file or directory could not be found.",
        suggestions: [
            "Check if the folder still exists and hasn't been moved or deleted.",
            "Refresh the browser and try again."
        ]
    },
    NotReadableError: {
        title: "Cannot Read File or Directory",
        message: "The browser was denied permission to read the file system.",
        suggestions: [
            "Check folder permissions - the browser needs read access.",
            "Try a different folder."
        ]
    },
    SecurityError: {
        title: "Security Restriction",
        message: "A security violation occurred while trying to access the file system.",
        suggestions: [
            "You may be trying to access a protected system location.",
            "Try selecting a user folder instead of a system folder."
        ]
    },
    AbortError: {
        title: "Operation Aborted",
        message: "The file system operation was aborted.",
        suggestions: [
            "This could happen if you canceled a dialog or if the browser interrupted the operation.",
            "Try again, ensuring you complete all browser prompts."
        ]
    },
    // Default fallback for unknown errors
    default: {
        title: "Unexpected Error",
        message: "An unexpected error occurred while accessing the file system.",
        suggestions: [
            "Try refreshing the page and attempt the operation again.",
            "Check browser console (F12) for more technical details."
        ]
    }
};

// Show error details in the error panel
export function showError(error) {
    const errorPanel = document.getElementById('errorReport');
    const errorTitle = errorPanel.querySelector('.error-title');
    const errorMessage = errorPanel.querySelector('.error-message');
    const errorDetails = errorPanel.querySelector('.error-details');
    const errorSuggestions = errorPanel.querySelector('.error-suggestions');
    
    // Determine error type and get appropriate messages
    const errorInfo = errorTypes[error.name] || errorTypes.default;
    
    // Set error information
    errorTitle.textContent = errorInfo.title;
    errorMessage.textContent = errorInfo.message;
    errorDetails.textContent = `Error Type: ${error.name}\nDetails: ${error.message}\nPath: ${error.path || 'Unknown'}\nStack: ${error.stack || 'Not available'}`;
    
    // Clear previous suggestions
    errorSuggestions.innerHTML = '<strong>Suggestions:</strong>';
    const list = document.createElement('ul');
    errorInfo.suggestions.forEach(suggestion => {
        const item = document.createElement('li');
        item.textContent = suggestion;
        list.appendChild(item);
    });
    errorSuggestions.appendChild(list);
    
    // Show the error panel
    errorPanel.style.display = 'block';
    
    // Also log to console for debugging
    console.error('Detailed error:', error);
}

// Initialize error handler events
export function initErrorHandlers() {
    // Close error panel button
    document.getElementById('closeErrorBtn').addEventListener('click', () => {
        document.getElementById('errorReport').style.display = 'none';
    });
    
    // Global error handler for uncaught exceptions
    window.addEventListener('error', (event) => {
        showError(event.error || {
            name: 'UnknownError',
            message: event.message,
            stack: 'See browser console for details'
        });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        showError(event.reason || {
            name: 'PromiseRejection',
            message: 'Unhandled Promise rejection',
            stack: event.reason?.stack || 'No stack trace available'
        });
    });
}