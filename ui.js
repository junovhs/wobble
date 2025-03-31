// ui.js
// Handles UI updates and DOM manipulation

// DOM Elements (cache them)
const projectNav = document.getElementById('project-nav');
const contentFrame = document.getElementById('content-frame');
const welcomeScreen = document.getElementById('welcome-screen');
const themeToggleButton = document.getElementById('theme-toggle');
const sidebarHeader = document.querySelector('#sidebar header'); // For potential future use
const appElement = document.getElementById('app'); // For theme attribute

let errorContainer = null; // Cache error container element

/**
 * Renders the project navigation sidebar.
 * @param {Array} projects - Array of project objects.
 * @param {object|null} currentProject - The currently selected project object.
 */
export function renderNav(projects, currentProject) {
    if (!projectNav) return;
    projectNav.innerHTML = ''; // Clear previous nav

    if (!projects || projects.length === 0) {
        // Keep the "No projects found." message logic within the calling function (app.js)
        // based on the result of fetchProjects, including potential error messages.
        // This function just renders what it's given.
        // projectNav.innerHTML = '<p style="padding: 15px; text-align: center; color: var(--text-color);">No projects found.</p>';
        return;
    }

    const ul = document.createElement('ul');
    projects.forEach(project => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${project.id}`;
        a.textContent = project.name;
        a.dataset.projectId = project.id; // Store project ID
        if (currentProject && currentProject.id === project.id) {
            a.classList.add('active');
        }
        li.appendChild(a);
        ul.appendChild(li);
    });
    projectNav.appendChild(ul);
}

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
        errorContainer.style.padding = '20px';
        errorContainer.style.color = 'var(--text-color)'; // Use text color, border indicates error
        errorContainer.style.textAlign = 'center';
        errorContainer.style.position = 'absolute';
        errorContainer.style.top = '40%'; // Adjust vertical position
        errorContainer.style.left = '50%';
        errorContainer.style.transform = 'translate(-50%, -50%)';
        errorContainer.style.backgroundColor = 'var(--secondary-color)'; // Use secondary color for bg
        errorContainer.style.border = '2px solid #dc3545'; // Red border for error
        errorContainer.style.borderRadius = '8px';
        errorContainer.style.maxWidth = '80%';
        errorContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        errorContainer.style.zIndex = '60'; // Above welcome/iframe
        const contentArea = document.getElementById('content-area');
         if (contentArea) {
             contentArea.appendChild(errorContainer);
         } else {
             console.error("Cannot find #content-area to display error.");
             // Fallback: alert
             alert(`Error: ${message}`);
             return;
         }
    }
    // Improved formatting for error message
    errorContainer.innerHTML = `
        <h2 style="color: #dc3545; margin-bottom: 10px;">Error</h2>
        <p style="margin: 0;">${message}</p>
        ${message.includes("config.js") ? '<p style="margin-top: 15px; font-size: 0.9em;">Please verify the <code>githubOwner</code>, <code>githubRepo</code>, and <code>pagesFolder</code> values in <code>config.js</code> match your repository structure.</p>' : ''}
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
 * Updates the 'active' class on the navigation links.
 * Also updates the theme attribute on srcdoc iframes.
 * @param {string|null} currentProjectId - The ID of the currently active project, or null.
 * @param {boolean} isSrcDoc - Indicates if the current content is from srcdoc (markdown).
 */
export function updateNavActiveState(currentProjectId, isSrcDoc = false) {
    if (!projectNav) return;
    const links = projectNav.querySelectorAll('a');
    links.forEach(link => {
        if (currentProjectId && link.dataset.projectId === currentProjectId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update iframe theme if it's srcdoc
     if (isSrcDoc && contentFrame && contentFrame.contentDocument) {
          try {
            const iframeDoc = contentFrame.contentDocument || contentFrame.contentWindow.document;
            if (iframeDoc && iframeDoc.body) {
                 const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                 iframeDoc.documentElement.setAttribute('data-theme', currentTheme); // Apply to html element
                 iframeDoc.body.setAttribute('data-theme', currentTheme); // Apply to body as well for compatibility
                 console.log("Updated srcdoc iframe theme to:", currentTheme);
            }
          } catch (e) {
               console.warn("Could not update srcdoc iframe theme:", e.message);
          }
     }
     // Update theme for HTML iframe content if possible (less reliable due to cross-origin)
     else if (!isSrcDoc && contentFrame && contentFrame.contentWindow) {
        // Attempt to send a message post-load (needs listener in iframe)
        // Or try direct access if same-origin (unlikely for different projects)
     }
}


/**
 * Applies the chosen theme (light/dark) to the document.
 * @param {'light' | 'dark'} theme - The theme to apply.
 */
export function applyTheme(theme) {
    const newTheme = theme === 'dark' ? 'dark' : 'light'; // Sanitize
    document.documentElement.setAttribute('data-theme', newTheme);
    // Update theme for any active srcdoc iframe immediately
    updateNavActiveState(null, contentFrame?.srcdoc !== ''); // Pass null for projectId, check if srcdoc exists
}


/**
 * Shows/Hides the content iframe.
 * @param {boolean} show - Whether to show or hide the iframe.
 * @param {boolean} isSrcDoc - Whether the content is from srcdoc.
 */
export function displayContentFrame(show, isSrcDoc = false) {
    if (!contentFrame) return;
    if (show) {
        // Use a slight delay for srcdoc to ensure it renders before showing
        if (isSrcDoc) {
            setTimeout(() => contentFrame.classList.remove('hidden'), 50);
        } else {
            // For src URLs, visibility is handled by onload/onerror usually,
            // but we ensure it's not hidden if called explicitly.
             contentFrame.classList.remove('hidden');
        }
    } else {
        contentFrame.classList.add('hidden');
        // Clear content when hiding to prevent flashes or state issues
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
     if (!contentFrame) return;

     // Clear previous content and hide frame initially
     displayContentFrame(false); // Hide and clear src/srcdoc
     contentFrame.onload = null; // Clear previous handlers
     contentFrame.onerror = null;

    // Use a small delay before setting src/srcdoc to ensure the 'hidden' class takes effect
     return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        if (content.type === 'html') {
            console.log(`Setting iframe source to: ${content.url}`);
             // Inject CSS to hide potential GitHub headers in the iframe
             contentFrame.onload = () => {
                console.log("Iframe loaded:", content.url);
                try {
                    const doc = contentFrame.contentDocument || contentFrame.contentWindow.document;
                    if(doc) {
                        const style = doc.createElement('style');
                        style.textContent = `
                            /* Try to hide common GH Pages header/footer */
                            body > header:first-of-type, body > footer:last-of-type { display: none !important; }
                            /* Basic reset */
                            body { margin: 0; padding: 0; }
                        `;
                        doc.head.appendChild(style);
                        console.log("Injected styles into iframe.");
                        displayContentFrame(true, false); // Show iframe after load and styling
                    } else {
                         console.warn("Could not access iframe document to inject styles.");
                         displayContentFrame(true, false); // Still show iframe
                    }
                } catch (e) {
                    console.warn('Could not inject CSS into iframe (cross-origin restriction?):', e.message);
                    displayContentFrame(true, false); // Still show iframe
                }
                 contentFrame.onload = null; // Clear handler
            };
            contentFrame.onerror = () => {
                 console.error(`Error loading iframe source: ${content.url}`);
                 showError(`Failed to load project content from ${content.url}. Check browser console and network tab for details.`);
                 displayContentFrame(false); // Hide broken iframe
            }
            contentFrame.removeAttribute('srcdoc'); // Ensure srcdoc is not set
            contentFrame.src = content.url;
            // Visibility is handled by onload/onerror

        } else if (content.type === 'markdown') {
            console.log('Setting iframe srcdoc with Markdown content.');
            // Use srcdoc for self-contained HTML generated from Markdown
             const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
             const htmlContent = `
                <!DOCTYPE html>
                <html lang="en" data-theme="${currentTheme}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${project.name}</title>
                    <style>
                        /* Basic styles matching main page */
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

                         /* Markdown specific styles */
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
            contentFrame.removeAttribute('src'); // Ensure src is not set when using srcdoc
            contentFrame.srcdoc = htmlContent;
            displayContentFrame(true, true); // Show iframe immediately for srcdoc
            console.log('Iframe with Markdown content is now visible.');

        } else if (content.type === 'empty' || content.type === 'error') {
            console.log(`Project content type: ${content.type}`);
            showError(content.data); // Display the message from content.data
            displayContentFrame(false); // Keep frame hidden
        } else {
             console.warn(`Unknown content type: ${content.type}`);
             showError(`Unknown content type received for project '${project.name}'.`);
             displayContentFrame(false);
        }
     });
}