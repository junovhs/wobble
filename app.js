// Import dependencies
import { fetchProjects, fetchProjectContent } from './githubApi.js';
import { basePath } from './config.js'; // Import basePath
import {
    renderNav,
    showError,
    hideError,
    showWelcomeScreen,
    hideWelcomeScreen,
    updateNavActiveState,
    applyTheme,
    displayContentFrame,
    setFrameContent
} from './ui.js';

// DOM Elements
const projectNavElement = document.getElementById('project-nav'); // Renamed to avoid conflict
const themeToggleButton = document.getElementById('theme-toggle');
const appElement = document.getElementById('app'); // Needed for link interception

// State
let projects = [];
let currentProject = null;
let isLoading = false; // Prevent concurrent loads


/**
 * Extracts the project route part (e.g., "my-project") from the full pathname.
 * Handles the base path.
 * @returns {string|null} The route part or null if it's the base path or invalid.
 */
function getRouteFromPathname() {
    const path = window.location.pathname;
    const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';

    if (path.startsWith(normalizedBasePath)) {
        const routePart = path.substring(normalizedBasePath.length);
        // Return null for the root/base path itself, otherwise return the route part
        return routePart === '' ? null : routePart;
    } else if (path === basePath) {
        // Handle '/wobble' without trailing slash as root
        return null;
    }
    // If path doesn't start with basePath (shouldn't happen on GH pages but good practice)
    console.warn(`Pathname "${path}" does not match expected base path "${basePath}".`);
    return null; // Or handle as an error/redirect
}


/**
 * Loads and displays the selected project's content.
 * @param {string} projectId - The ID of the project to load (e.g., "proj.my-project").
 */
async function loadProject(projectId) {
     if (isLoading) {
          console.log("Already loading a project, aborting new request for:", projectId);
          return;
     }
     if (!projectId) {
          console.log("No project ID provided, showing welcome screen.");
          showWelcomeScreen();
          currentProject = null;
          updateNavActiveState(null); // Update nav styling
          // No need to clear hash, path is handled by history API
          return;
     }
     // Find project data (already fetched)
     const project = projects.find(p => p.id === projectId);

     if (!project) {
          console.warn(`Project with id "${projectId}" not found in fetched list.`);
          // Extract readable name from projectId
          const readableName = projectId.startsWith('proj.') ? projectId.substring(5) : projectId;
          showError(`Project '${readableName}' not found. It might have been removed, renamed, or the URL is incorrect.`);
          currentProject = null;
          updateNavActiveState(null);
          // Don't manipulate history here, let the browser/user handle invalid paths
          return;
     }

     // If already showing this project, do nothing
     if (currentProject?.id === projectId) {
          console.log(`Project ${projectId} is already loaded.`);
          // Ensure frame is visible if welcome screen was shown before
          if (!document.getElementById('welcome-screen').classList.contains('hidden')) {
               hideWelcomeScreen();
               displayContentFrame(true, !!contentFrame?.srcdoc);
          }
          return;
     }

     console.log(`Loading project: ${project.name} (ID: ${project.id})`);
     isLoading = true;
     hideError(); // Clear previous errors
     hideWelcomeScreen(); // Hide welcome screen
     displayContentFrame(false); // Hide frame while loading

     currentProject = project;
     updateNavActiveState(currentProject.id); // Update nav highlighting immediately

     try {
          const content = await fetchProjectContent(project.path);
          await setFrameContent(content, project); // setFrameContent handles showing the frame on success/error
          // Update nav state again
          updateNavActiveState(currentProject.id, content.type === 'markdown');
     } catch (error) {
          console.error(`Unhandled error loading project ${projectId}:`, error);
          showError(`Failed to load project '${project.name}': ${error.message}`);
          displayContentFrame(false);
          currentProject = null; // Reset current project on error
          updateNavActiveState(null); // Update nav styling
          // Don't manipulate history here, let the browser/user handle invalid paths
     } finally {
          isLoading = false;
     }
}


/**
 * Handles route changes based on the current pathname (called on load, popstate, and link clicks).
 */
function handleRouteChange() {
    const routePart = getRouteFromPathname();
    console.log(`Route changed/detected: "${routePart || '(root)'}" from path: ${window.location.pathname}`);

    // Map route part back to projectId (Option A)
    const projectId = routePart ? `proj.${routePart}` : null;

    // Load project only if the derived projectId is different from the current one
    if (projectId !== (currentProject?.id || null)) {
        loadProject(projectId);
    }
}


/**
 * Toggles between light and dark themes.
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
     // Re-apply theme to srcdoc iframe if needed, handled within applyTheme->updateNavActiveState
}


/**
 * Initializes the application.
 */
async function initialize() {
    console.log('Initializing application...');
    isLoading = true; // Prevent hash changes during init

    // --- Theme Setup ---
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    themeToggleButton.addEventListener('click', toggleTheme);

    // --- Fetch Projects and Render Nav ---
    const fetchedData = await fetchProjects();

    // Check if fetchProjects returned an error object
    if (fetchedData.error) {
         showError(fetchedData.message);
         // Display specific message for 404
         if(fetchedData.status === 404) {
              projectNavElement.innerHTML = `<p style="padding: 15px; text-align: center; color: var(--text-color);">Could not find projects folder.</p>`;
         } else {
             projectNavElement.innerHTML = `<p style="padding: 15px; text-align: center; color: var(--text-color);">Error loading projects.</p>`;
         }
         showWelcomeScreen(); // Show welcome screen below error
         isLoading = false;
         return; // Stop initialization if projects can't be loaded
    }

    // Store fetched projects
    projects = fetchedData;

    // Render initial nav
    if (projects.length === 0) {
        projectNavElement.innerHTML = '<p style="padding: 15px; text-align: center; color: var(--text-color);">No projects found.</p>';
        // Optionally show a specific message in the content area too
        // showError("No projects (folders starting with 'proj.') found in the configured 'pages' directory.");
    } else {
         renderNav(projects, null); // Render nav without active item initially
    }

    // --- Routing Setup ---
    window.addEventListener('popstate', handleRouteChange); // Handle browser back/forward

    // Add navigation link interceptor (delegate to app container)
    appElement.addEventListener('click', (event) => {
        const targetLink = event.target.closest('a');

        // Check if it's an internal navigation link managed by our router
        if (targetLink && targetLink.pathname.startsWith(basePath)) {
            // Ignore links specifically designed to open in new tabs or external links
             if (targetLink.target === '_blank' || targetLink.origin !== window.location.origin) {
                return;
            }

            event.preventDefault(); // Prevent default browser navigation
            console.log(`Intercepted navigation to: ${targetLink.href}`);

            // Update URL if it's different
            if (targetLink.href !== window.location.href) {
                history.pushState({}, '', targetLink.href); // Update URL bar
                handleRouteChange(); // Trigger content load for the new state
            }
        }
    });

    // Trigger initial load based on current path *after* event listeners are set up
    handleRouteChange(); // Load project based on current path or show welcome

    isLoading = false;
    console.log('Initialization complete.');
}

// --- Start Application ---
initialize();
