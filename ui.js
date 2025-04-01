// ui.js
// Handles UI updates and DOM manipulation (excluding navigation rendering)

// Import config only if needed, basePath is needed here for link generation
import { basePath } from './config.js';

// DOM Elements (cache them)
const contentFrame = document.getElementById('content-frame');
const welcomeScreen = document.getElementById('welcome-screen');
const themeToggleButton = document.getElementById('theme-toggle');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const sidebarFooter = document.getElementById('sidebar-footer'); // Sidebar footer
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

    // Create error container if it doesn't exist
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'error-container';
        errorContainer.classList.add('error-message-box'); // Add a class for styling

        const contentArea = document.getElementById('content-area');
         if (contentArea) {
             contentArea.insertBefore(errorContainer, contentFrame);
         } else {
             console.error("Cannot find #content-area to display error.");
             alert(`Error: ${message}`);
             return;
         }
    }
    errorContainer.innerHTML = `
        <h2 style="color: #dc3545; margin-bottom: 10px;">Error</h2>
        <p style="margin: 0;">${message}</p>
        ${message.includes("config.js") || message.includes("repository structure") ? '<p style="margin-top: 15px; font-size: 0.9em;">Please verify the <code>githubOwner</code>, <code>githubRepo</code>, and <code>pagesFolder</code> values in <code>config.js</code> match your repository structure.</p>' : ''}
         ${message.includes("rate limit") ? '<p style="margin-top: 15px; font-size: 0.9em;">Check the browser\'s developer console (Network tab) for details. You may need to wait a while or use a GitHub token if making many requests.</p>' : ''}
    `;
    errorContainer.style.display = 'block'; // Ensure it's visible
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

    const isCurrentContentSrcDoc = !!(contentFrame && contentFrame.srcdoc);
    if (isCurrentContentSrcDoc) {
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
 * @param {boolean} isSrcDoc - Whether the content is from srcdoc.
 */
export function displayContentFrame(show, isSrcDoc = false) {
    if (!contentFrame) return;
    if (show) {
        hideError(); 
        if (isSrcDoc) {
            setTimeout(() => contentFrame.classList.remove('hidden'), 50);
        } else {
             contentFrame.classList.remove('hidden');
        }
    } else {
        contentFrame.classList.add('hidden');
        contentFrame.removeAttribute('srcdoc');
        contentFrame.src = 'about:blank';
    }
}

/**
 * Sets the content of the iframe (either src or srcdoc).
 * @param {object} content - The content object from fetchProjectContent.
 * @param {object} project - The project object { name, id, path, routePath, ... }.
 */
export function setFrameContent(content, project) {
     if (!contentFrame) return Promise.reject("Content frame not found"); 

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
                                    body > header:first-of-type, body > footer:last-of-type { display: none !important; }
                                    body { margin: 0; padding: 0; box-sizing: border-box; }
                                    html { overflow-y: auto; }
                                `;
                                doc.head.appendChild(style);
                                console.log("Injected styles into iframe.");
                            } else {
                                console.warn("Could not access iframe document to inject styles.");
                            }
                        } catch (e) {
                            console.warn('Could not inject CSS into iframe (cross-origin restriction?):', e.message);
                        } finally {
                            displayContentFrame(true, false); 
                             contentFrame.onload = null; 
                             resolve(); 
                        }
                    };
                    contentFrame.onerror = () => {
                         console.error(`Error loading iframe source: ${content.url}`);
                         const errorMsg = `Failed to load project content from ${content.url}. Check browser console (Network tab) for 404 or other errors.`;
                         showError(errorMsg);
                         displayContentFrame(false); 
                         contentFrame.onerror = null; 
                         reject(new Error(errorMsg)); 
                    }
                    contentFrame.removeAttribute('srcdoc'); 

                    contentFrame.src = content.url;
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
                             <link rel="stylesheet" href="style.css"> 
                        </head>
                        <body class="markdown-body" data-theme="${currentTheme}">
                            ${content.data}
                         </body>
                        </html>
                    `;
                    contentFrame.removeAttribute('src'); 
                    contentFrame.srcdoc = htmlContent;
                    displayContentFrame(true, true); 
                    console.log('Iframe with Markdown content is now visible.');
                    resolve(); 

                } else if (content.type === 'empty' || content.type === 'error') {
                    console.log(`Project content type: ${content.type}`);
                    showError(content.data); 
                    displayContentFrame(false); 
                    if (content.type === 'error') {
                         reject(new Error(content.data));
                    } else {
                         resolve(); 
                    }
                } else {
                     const unknownMsg = `Unknown content type received for project '${project.name}'.`;
                     console.warn(`Unknown content type: ${content.type}`);
                     showError(unknownMsg);
                     displayContentFrame(false);
                     reject(new Error(unknownMsg)); 
                }
             } catch (e) {
                 console.error("Error in setFrameContent:", e);
                 showError(`An unexpected error occurred while trying to display project '${project.name}'.`);
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
          if (sidebarFooter) sidebarFooter.classList.remove('hidden'); 
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false'); 
          return;
     }

    const shouldBeCollapsed = forceState === undefined
        ? !appElement.classList.contains('sidebar-collapsed')
        : !forceState; 

    if (shouldBeCollapsed) {
        appElement.classList.add('sidebar-collapsed');
        sidebarToggleButton.setAttribute('title', 'Expand sidebar');
        if (sidebarFooter) sidebarFooter.classList.add('hidden'); 
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
        console.log('Sidebar collapsed');
    } else {
        appElement.classList.remove('sidebar-collapsed');
        sidebarToggleButton.setAttribute('title', 'Collapse sidebar');
        if (sidebarFooter) sidebarFooter.classList.remove('hidden'); 
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
               if (appElement.classList.contains('sidebar-collapsed')) {
                    toggleSidebarCollapse(true); 
               } else {
                    if (sidebarFooter) sidebarFooter.classList.remove('hidden'); 
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