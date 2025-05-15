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
    PatchParseError: {
        title: "AI Patch Parsing Error",
        message: "The provided AI patch instructions could not be parsed or are invalid.",
        suggestions: [
            "Ensure the patch is valid JSON.",
            "Check that each instruction has 'file', 'operation', and other required fields.",
            "Verify line numbers and content are correctly formatted."
        ]
    },
    // Default fallback for unknown errors
    default: {
        title: "Unexpected Error",
        message: "An unexpected error occurred.",
        suggestions: [
            "Try refreshing the page and attempt the operation again.",
            "Check browser console (F12) for more technical details."
        ]
    }
};

// Show error details in the error panel
export function showError(error) {
    const errorPanel = document.getElementById('errorReport');
    const errorTitleEl = errorPanel.querySelector('.error-title');
    const errorMessageEl = errorPanel.querySelector('.error-message');
    const errorDetailsEl = errorPanel.querySelector('.error-details');
    const errorSuggestionsEl = errorPanel.querySelector('.error-suggestions');
    
    // Determine error type and get appropriate messages
    const errorInfo = errorTypes[error.name] || errorTypes.default;
    
    // Set error information
    errorTitleEl.textContent = errorInfo.title;
    errorMessageEl.textContent = error.message || errorInfo.message; // Prefer specific error message
    errorDetailsEl.textContent = `Error Type: ${error.name}\nDetails: ${error.message}\nPath: ${error.path || 'N/A'}\nStack: ${error.stack || 'Not available'}`;
    
    // Clear previous suggestions
    errorSuggestionsEl.innerHTML = '<strong>Suggestions:</strong>';
    const list = document.createElement('ul');
    errorInfo.suggestions.forEach(suggestion => {
        const item = document.createElement('li');
        item.textContent = suggestion;
        list.appendChild(item);
    });
    errorSuggestionsEl.appendChild(list);
    
    // Show the error panel
    errorPanel.style.display = 'block';
    
    // Also log to console for debugging
    console.error('Detailed error reported to UI:', error);
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
            name: 'GlobalError',
            message: event.message || "An unknown error occurred in the window.",
            stack: (event.error && event.error.stack) ? event.error.stack : 'See browser console for details'
        });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason || {};
        showError({
            name: reason.name || 'PromiseRejection',
            message: reason.message || 'Unhandled Promise rejection. See console.',
            stack: reason.stack || (event.reason && typeof event.reason === 'string' ? event.reason : 'No stack trace available')
        });
    });
}