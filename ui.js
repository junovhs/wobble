// ui.js
// Handles UI updates and DOM manipulation (excluding navigation rendering)

// Import config only if needed, basePath is needed here for iframe url resolution
import { basePath } from './config.js';

// DOM Elements (cache them)
const contentFrame = document.getElementById('content-frame');
const welcomeScreen = document.getElementById('welcome-screen');
const themeToggleButton = document.getElementById('theme-toggle');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const appElement = document.getElementById('app'); // For theme attribute and collapse class

let errorContainer = null; // Cache error container element
const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed'; // localStorage key

/**
 * Displays the initial welcome message.
 */
export function showWelcomeScreen() {
    if(welcomeScreen) welcomeScreen.classList.remove('hidden');
    if(contentFrame) contentFrame.classList.add('hidden');
    hideError(); // Hide errors when showing welcome
}

/**
 * Hides the welcome message.
 */
export function hideWelcomeScreen() {
     if(welcomeScreen) welcomeScreen.classList.add('hidden');
}

/**
 * Displays an error message in a dedicated container within the content area.
 * @param {string} message - The error message to display.
 */
export function showError(message) {
     console.error("Displaying error:", message);
     hideWelcomeScreen();
     if(contentFrame) {
        contentFrame.classList.add('hidden'); // Hide iframe
        contentFrame.src = 'about:blank'; // Clear iframe source
     }

    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.style.padding = '20px';
        errorContainer.style.color = 'var(--text-color)'; 
        errorContainer.style.textAlign = 'center';
        errorContainer.style.position = 'absolute';
        errorContainer.style.top = '40%'; 
        errorContainer.style.left = '50%';
        errorContainer.style.transform = 'translate(-50%, -50%)';
        errorContainer.style.backgroundColor = 'var(--secondary-color)'; 
        errorContainer.style.border = '2px solid #dc3545'; 
        errorContainer.style.borderRadius = '8px';
        errorContainer.style.maxWidth = '80%';
        errorContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        errorContainer.style.zIndex = '60'; 
        const contentArea = document.getElementById('content-area');
         if (contentArea) {
             contentArea.appendChild(errorContainer);
         } else {
             console.error("Cannot find #content-area to display error.");
             alert(`Error: ${message}`);
             return;
         }
    }
    errorContainer.innerHTML = `
        <h2 style="color: #dc3545; margin-bottom: 10px;">Error</h2>
        <p style="margin: 0;">${message}</p>
        ${message.includes("config.js") ? '<p style="margin-top: 15px; font-size: 0.9em;">Please verify the <code>githubOwner</code>, <code>githubRepo</code>, and <code>pagesFolder</code> values in <code>config.js</code> match your repository structure.</p>' : ''}
        ${message.includes("project list file") || message.includes("project_paths.txt") ? '<p style="margin-top: 15px; font-size: 0.9em;">Please verify the <code>projectsListFile</code> path in <code>config.js</code> and ensure the file exists and contains valid project paths.</p>' : ''}
        ${message.includes("index.html") || message.includes("README.md") ? '<p style="margin-top: 15px; font-size: 0.9em;">Ensure the project folder contains either an <code>index.html</code> or a <code>README.md</code> file.</p>' : ''}
    `;
    errorContainer.style.display = 'block';
}

/**
* Hides the error message container.
*/
export function hideError() {
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
}

/**
 * Applies the chosen theme (light/dark) to the document.
 * Handles updating icons via CSS data attributes.
 * @param {'light' | 'dark'} theme - The theme to apply.
 */
export function applyTheme(theme) {
    const newTheme = theme === 'dark' ? 'dark' : 'light'; // Sanitize
    document.documentElement.setAttribute('data-theme', newTheme);
    console.log(`Theme applied: ${newTheme}`);

    // Update srcdoc iframe theme if needed
    if (contentFrame && contentFrame.srcdoc) { // Check if iframe currently has srcdoc content
        try {
            const iframeDoc = contentFrame.contentDocument || contentFrame.contentWindow.document;
            if (iframeDoc && iframeDoc.documentElement) {
                iframeDoc.documentElement.setAttribute('data-theme', newTheme);
                if (iframeDoc.body) {
                     iframeDoc.body.setAttribute('data-theme', newTheme); // Apply to body as well
                }
                console.log("Updated srcdoc iframe theme to:", newTheme);
            }
        } catch (e) {
            console.warn("Could not update srcdoc iframe theme:", e.message);
        }
    }
}

/**
 * Shows/Hides the content iframe.
 * @param {boolean} show - Whether to show or hide the iframe.
 * @param {boolean} [isSrcDoc=false] - Indicates if the content is from srcdoc. (This param is mostly for internal logic)
 */
export function displayContentFrame(show, isSrcDoc = false) {
    if (!contentFrame) return;
    if (show) {
        setTimeout(() => contentFrame.classList.remove('hidden'), 50);
    } else {
        contentFrame.classList.add('hidden');
        contentFrame.removeAttribute('srcdoc');
        contentFrame.src = 'about:blank';
    }
}

/**
 * Sets the content of the iframe (either src or srcdoc).
 * @param {object} content - The content object from fetchProjectContent.
 * @param {object} project - The project object { name, id, ... }.
 */
export function setFrameContent(content, project) {
     if (!contentFrame) return Promise.reject(new Error("contentFrame not found"));

     displayContentFrame(false);
     contentFrame.onload = null;
     contentFrame.onerror = null;

     return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                if (content.type === 'html') {
                    console.log(`Setting iframe source to: ${content.url}`);
                    contentFrame.onload = () => {
                        console.log("Iframe loaded:", content.url);
                        try {
                            const doc = contentFrame.contentDocument || contentFrame.contentWindow.document;
                            if(doc) {
                                const style = doc.createElement('style');
                                style.textContent = `
                                    body { margin: 0; padding: 0; }
                                `;
                                doc.head.appendChild(style);
                                console.log("Injected basic styles into HTML iframe.");
                            } else {
                                console.warn("Could not access HTML iframe document to inject styles.");
                            }
                        } catch (e) {
                            console.warn('Could not inject CSS into HTML iframe (cross-origin?):', e.message);
                        }
                        displayContentFrame(true, false);
                        resolve();
                    };
                    contentFrame.onerror = () => {
                        const errorMsg = `Failed to load iframe source: ${content.url}. Check network tab & file path.`;
                        console.error(errorMsg);
                        showError(errorMsg);
                        displayContentFrame(false);
                        reject(new Error(errorMsg));
                    }
                    contentFrame.removeAttribute('srcdoc');
                    const resolvedUrl = new URL(content.url, `${window.location.origin}${basePath}/`).href;
                    contentFrame.src = resolvedUrl;

                } else if (content.type === 'markdown') {
                    console.log('Setting iframe srcdoc with Markdown content.');
                    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                    const htmlContent = `
                        <!DOCTYPE html>
                        <html lang="en" data-theme="${currentTheme}">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>${project.name}</title>
                            <style>
                                :root {
                                --bg-color-light: #ffffff; --text-color-light: #212529; --secondary-color-light: #e9ecef; --border-color-light: #dee2e6;
                                --bg-color-dark: #121212; --text-color-dark: #e0e0e0; --secondary-color-dark: #2a2a2a; --border-color-dark: #333333;
                                }
                                html[data-theme="dark"] { color-scheme: dark; }
                                body {
                                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                                padding: 25px; line-height: 1.7; margin: 0;
                                background-color: var(--bg-color-light); color: var(--text-color-light);
                                transition: background-color 0.2s, color 0.2s;
                                }
                                html[data-theme="dark"] body { background-color: var(--bg-color-dark); color: var(--text-color-dark); }
                                pre, code { font-family: monospace; }
                                pre { padding: 1em; border-radius: 5px; overflow-x: auto; background-color: var(--secondary-color-light); }
                                code:not(pre > code) { background-color: var(--secondary-color-light); padding: 0.2em 0.4em; border-radius: 3px; }
                                html[data-theme="dark"] pre { background-color: var(--secondary-color-dark); }
                                html[data-theme="dark"] code:not(pre > code) { background-color: var(--secondary-color-dark); }
                                blockquote { border-left: 4px solid var(--border-color-light); padding-left: 1em; margin-left: 0; color: #6c757d; }
                                html[data-theme="dark"] blockquote { border-left-color: var(--border-color-dark); color: #adb5bd; }
                                img { max-width: 100%; height: auto; border-radius: 4px; }
                                a { color: #007bff; }
                                html[data-theme="dark"] a { color: #64b5f6; }
                                hr { border: none; height: 1px; background-color: var(--border-color-light); margin: 1.5em 0; }
                                html[data-theme="dark"] hr { background-color: var(--border-color-dark); }
                                table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                                th, td { border: 1px solid var(--border-color-light); padding: 0.5em; text-align: left; }
                                html[data-theme="dark"] th, html[data-theme="dark"] td { border-color: var(--border-color-dark); }
                                th { background-color: var(--secondary-color-light); }
                                html[data-theme="dark"] th { background-color: var(--secondary-color-dark); }
                            </style>
                        </head>
                        <body data-theme="${currentTheme}">
                            ${content.data}
                        </body>
                        </html>
                    `;
                    contentFrame.removeAttribute('src');
                    contentFrame.srcdoc = htmlContent;
                    displayContentFrame(true, true);
                    resolve();

                } else if (content.type === 'empty' || content.type === 'error') {
                    const errorMsg = content.data || `Unknown error loading project '${project.name}'.`;
                    console.log(`Project content type: ${content.type}, Message: ${errorMsg}`);
                    showError(errorMsg);
                    displayContentFrame(false);
                    resolve(); // Resolve even on error/empty

                } else {
                    const errorMsg = `Unknown content type '${content.type}' received for project '${project.name}'.`;
                    console.warn(errorMsg);
                    showError(errorMsg);
                    displayContentFrame(false);
                    reject(new Error(errorMsg));
                }
            } catch (e) {
                 const errorMsg = `Error setting frame content: ${e.message}`;
                 console.error(errorMsg, e);
                 showError(errorMsg);
                 displayContentFrame(false);
                 reject(e);
            }
        }, 10);
    });
}

/**
 * Toggles the collapsed state of the sidebar.
 * @param {boolean} [forceState] - Optional. If true, forces sidebar open. If false, forces closed. If undefined, toggles.
 */
export function toggleSidebarCollapse(forceState) {
    if (!appElement || !sidebarToggleButton) return;

     if (window.innerWidth <= 768) {
          console.log("Sidebar collapse ignored on small screen.");
          appElement.classList.remove('sidebar-collapsed');
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
          return;
     }

    const shouldBeCollapsed = forceState === undefined
        ? !appElement.classList.contains('sidebar-collapsed')
        : !forceState;

    if (shouldBeCollapsed) {
        appElement.classList.add('sidebar-collapsed');
        sidebarToggleButton.setAttribute('title', 'Expand sidebar');
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
        console.log('Sidebar collapsed');
    } else {
        appElement.classList.remove('sidebar-collapsed');
        sidebarToggleButton.setAttribute('title', 'Collapse sidebar');
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
        console.log('Sidebar expanded');
    }
}

/**
 * Initializes the sidebar state based on localStorage preference.
 * Handles window resize events to prevent collapsed state on small screens.
 */
export function initializeSidebarState() {
     const applyInitialState = () => {
          if (window.innerWidth <= 768) {
               if (appElement && appElement.classList.contains('sidebar-collapsed')) {
                    toggleSidebarCollapse(true); // Force open
               }
               return;
          }
          const savedState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
          const shouldBeCollapsed = savedState === 'true';
          toggleSidebarCollapse(!shouldBeCollapsed);
     };

     applyInitialState();

     let resizeTimeout;
     window.addEventListener('resize', () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
               console.log("Window resized, checking sidebar state.");
               applyInitialState();
          }, 150);
     });
}