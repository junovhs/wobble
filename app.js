// app.js

// Import dependencies
import { fetchProjects, fetchProjectContent } from './githubApi.js';
import { basePath } from './config.js'; // Import basePath
import {
    showError,
    hideError,
    showWelcomeScreen,
    hideWelcomeScreen,
    applyTheme,
    displayContentFrame,
    setFrameContent,
    toggleSidebarCollapse,
    initializeSidebarState
} from './ui.js';
// Import navigation specific functions
import { renderNav, updateNavActiveState } from './nav.js';

// DOM Elements
const projectNavElement = document.getElementById('project-nav');
const themeToggleButton = document.getElementById('theme-toggle');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const appElement = document.getElementById('app'); // Needed for link interception and collapse class
const contentFrame = document.getElementById('content-frame'); // Cache content frame
const welcomeScreen = document.getElementById('welcome-screen'); // Cache welcome screen

// State
let projects = []; // Can be nested now
let currentProject = null;
let isLoading = false; // Prevent concurrent loads

/**
 * Recursively searches the nested projects array for a project by its ID.
 * @param {Array} items - The array of projects/categories to search.
 * @param {string} id - The project ID to find.
 * @returns {object|null} The project object or null if not found.
 */
function findProjectById(items, id) {
    if (!items || !Array.isArray(items)) {
        return null; // Guard against non-array input
    }
    for (const item of items) {
        if (item.type === 'project' && item.id === id) {
            return item;
        }
        if (item.type === 'category' && item.children) {
            const foundInChildren = findProjectById(item.children, id);
            if (foundInChildren) {
                return foundInChildren;
            }
        }
    }
    return null;
}

/**
 * Extracts the project route part (e.g., "my-project") from the full pathname.
 * Handles the base path.
 * @returns {string|null} The route part or null if it's the base path or invalid.
 */
function getRouteFromPathname() {
    const path = window.location.pathname;
    // Ensure basePath ends with a slash for accurate comparison and substringing
    const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';

    if (path.startsWith(normalizedBasePath)) {
        const routePart = path.substring(normalizedBasePath.length);
        // Return null for the root/base path itself, otherwise return the route part
        return routePart === '' ? null : routePart;
    } else if (path === basePath.replace(/\/$/, '')) { // Handle case where path is '/wobble' (no trailing slash)
        return null; // It's the base path
    }
    // If path doesn't start with basePath (shouldn't happen on GH pages but good practice)
    console.warn(`Pathname "${path}" does not match expected base path "${basePath}". Treating as root.`);
    return null; // Or handle as an error/redirect
}

/**
 * Loads and displays the selected project's content.
 * @param {string|null} projectId - The ID of the project to load (e.g., "proj.my-project"), or null for welcome screen.
 */
async function loadProject(projectId) {
     if (isLoading) {
          console.log(`Already loading a project, aborting new request for: "${projectId || 'welcome screen'}"`);
          return;
     }
     if (!projectId) {
          console.log("No project ID provided, showing welcome screen.");
          hideError(); // Clear errors when showing welcome
          showWelcomeScreen();
          currentProject = null;
          updateNavActiveState(null); // Update nav styling
          // No need to clear hash, path is handled by history API
          return;
     }

     // Find project data using recursive search
     const project = findProjectById(projects, projectId); // Use nested search

     if (!project || project.type !== 'project') { // Ensure it's a project, not category
          const readableName = projectId.startsWith('proj.') ? projectId.substring(5).replace(/[-_]/g, ' ') : projectId;
          console.warn(`Project with id "${projectId}" not found or is not a project type.`);
          showError(`Project '${readableName}' not found. It might have been removed, renamed, or the URL is incorrect.`);
          hideWelcomeScreen(); // Hide welcome if shown
          displayContentFrame(false); // Hide frame
          currentProject = null;
          updateNavActiveState(null);
          // Don't manipulate history here, let the browser/user handle invalid paths
          return;
     }

     // If already showing this project, do nothing special (unless welcome was visible)
     if (currentProject?.id === projectId) {
          console.log(`Project ${projectId} is already loaded.`);
          // Ensure frame is visible if welcome screen was shown before
          if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
               hideWelcomeScreen();
               displayContentFrame(true, !!contentFrame?.srcdoc);
          }
          return;
     }

     console.log(`Loading project: ${project.name} (ID: ${project.id})`);
     isLoading = true; // Set loading flag HERE, before async operations
     hideError(); // Clear previous errors
     hideWelcomeScreen(); // Hide welcome screen
     displayContentFrame(false); // Hide frame while loading

     currentProject = project;
     updateNavActiveState(currentProject.id); // Update nav highlighting immediately

     try {
          const content = await fetchProjectContent(project.path);
          // await setFrameContent(content, project); // setFrameContent handles showing the frame - this returns a promise now
          await setFrameContent(content, project); // Await the promise from setFrameContent
          // Update nav state again - determines if theme needs update for srcdoc
          const isSrcDoc = content.type === 'markdown';
          updateNavActiveState(currentProject.id, isSrcDoc); // Ensure nav updates after content load attempt
     } catch (error) {
          console.error(`Unhandled error loading project ${projectId}:`, error);
          showError(`Failed to load project '${project.name}': ${error.message}`);
          displayContentFrame(false);
          currentProject = null; // Reset current project on error
          updateNavActiveState(null); // Update nav styling
          // Don't manipulate history here, let the browser/user handle invalid paths
     } finally {
          isLoading = false; // Unset loading flag when done (success or error)
     }
}

/**
 * Handles route changes based on the current pathname (called on load, popstate, and link clicks).
 */
function handleRouteChange() {
    const routePart = getRouteFromPathname();
    console.log(`Route changed/detected: "${routePart || '(root)'}" from path: ${window.location.pathname}`);

    // Map route part back to projectId (Assumes route is 'proj-name' and ID is 'proj.proj-name')
    // Make sure this matches the actual structure/logic used in nav link creation
    const projectId = routePart ? `proj.${routePart}` : null;

    // Load project only if the derived projectId is different from the current one
    // Use null explicitly for comparison when no project is loaded
    if (projectId !== (currentProject?.id || null)) {
        loadProject(projectId);
    } else {
        console.log(`Route matches current project (${projectId}), no load needed.`);
         // Ensure frame/welcome is visible if route matches but state was weird
         if (!projectId) {
              showWelcomeScreen();
         } else if (contentFrame && contentFrame.classList.contains('hidden') && !welcomeScreen?.classList.contains('hidden')) {
              // If frame is hidden but welcome isn't, means project should be showing
              hideWelcomeScreen();
              displayContentFrame(true, !!contentFrame.srcdoc);
         }
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
     // Re-apply theme to srcdoc iframe if needed, handled within applyTheme which calls updateNavActiveState -> checks iframe
}

/**
 * Initializes the application.
 */
async function initialize() {
    console.log('Initializing application...');
    // Set isLoading true initially, but reset it before the first route change
    // This prevents subsequent clicks during the init fetch from triggering loads
    isLoading = true;

    // --- Sidebar Collapse Setup ---
    if (sidebarToggleButton) {
        sidebarToggleButton.addEventListener('click', () => toggleSidebarCollapse());
        initializeSidebarState(); // Apply saved preference on load
    } else {
        console.warn("Sidebar toggle button not found.");
    }

    // --- Theme Setup ---
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    } else {
        console.warn("Theme toggle button not found.");
    }


    // --- Fetch Projects and Render Nav ---
    let fetchedData;
    try {
        fetchedData = await fetchProjects();
        // Store fetched projects (potentially nested) only if not an error
        if (!fetchedData.error) {
            projects = fetchedData;
        }
    } catch (fetchError) {
        // Catch potential errors in fetchProjects itself (e.g., network issues before API call)
        console.error("Critical error fetching project structure:", fetchError);
        fetchedData = { error: true, message: `Failed to initialize project fetching: ${fetchError.message}` };
        projects = []; // Ensure projects is empty on critical fetch error
    }

    // Check if fetchProjects returned an error object
    if (fetchedData.error) {
         showError(fetchedData.message);
         // Display specific message for 404 or other errors
         if (projectNavElement) {
            projectNavElement.innerHTML = `<p class="nav-message">${fetchedData.message.includes('404') ? 'Could not find projects list file.' : 'Error loading project structure.'}</p>`;
         }
         showWelcomeScreen(); // Show welcome screen below error
         isLoading = false; // Ensure loading stops if init fails here
         return; // Stop initialization if projects can't be loaded
    }

    // Render initial nav
    if (projectNavElement) {
        if (!projects || projects.length === 0) {
            projectNavElement.innerHTML = '<p class="nav-message">No projects found or list file is empty.</p>';
        } else {
             renderNav(projects, null); // Render potentially nested nav
        }
    } else {
        console.warn("Project navigation element (#project-nav) not found.");
    }

    // --- Routing Setup ---
    window.addEventListener('popstate', handleRouteChange); // Handle browser back/forward

    // Add navigation link interceptor (delegate to app container)
    if (appElement) {
        appElement.addEventListener('click', (event) => {
            const targetLink = event.target.closest('a');

            // Check if it's an internal navigation link managed by our router
            // Ensure targetLink and targetLink.pathname exist
            if (targetLink && targetLink.pathname && targetLink.pathname.startsWith(basePath)) {
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
                } else {
                    console.log("Clicked link matches current URL, possibly re-triggering load.");
                    // Optionally force reload if needed, but handleRouteChange should manage state
                    handleRouteChange(); // Call again to ensure state consistency if needed
                }
            }
        });
    } else {
        console.warn("App element (#app) not found for link interception.");
    }


    // ***** FIX APPLIED HERE *****
    // Mark initialization technically complete BEFORE the first route change attempt
    isLoading = false;
    console.log('Initialization setup complete. Performing initial route handling...');

    // Now trigger the initial load based on the current URL
    handleRouteChange();
    // ***** END FIX *****

}

// --- Start Application ---
// Use DOMContentLoaded to ensure all elements are available
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // DOM is already ready
    initialize();
}