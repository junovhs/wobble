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
// Import new nav functions
import { renderNav, updateNavActiveState, flattenProjects } from './nav.js';

// DOM Elements
const projectNavElement = document.getElementById('project-nav');
const themeToggleButton = document.getElementById('theme-toggle');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const appElement = document.getElementById('app');

// State
let navStructure = []; // Hierarchical structure from fetchProjects
let flatProjectList = []; // Flat list generated from navStructure
let currentProject = null;
let isLoading = false;

/**
 * Extracts the project route part (e.g., "category/my-project") from the full pathname.
 * Handles the base path.
 * @returns {string|null} The route part relative to the base path, or null if it's the base path.
 */
function getRouteFromPathname() {
    const path = window.location.pathname;
    // Ensure base path ends with '/' if it's not just '/'
    const normalizedBasePath = basePath === '/' ? '/' : (basePath.endsWith('/') ? basePath : basePath + '/');

    if (path.startsWith(normalizedBasePath)) {
        const routePart = path.substring(normalizedBasePath.length);
        // Return null for the root/base path itself, otherwise return the route part
        return routePart === '' ? null : routePart;
    } else if (path === basePath && basePath !== '/') {
         // Handle case like /wobble (no trailing slash) as root
         return null;
    }
    // If path doesn't start with basePath (shouldn't happen on GH pages but good practice)
    // Or if it's the absolute root '/' and basePath is not '/'
    console.warn(`Pathname "${path}" does not align with expected base path "${basePath}". Treating as root.`);
    return null; // Treat unexpected paths as root/welcome screen
}

/**
 * Finds a project object in the potentially nested structure by its route path suffix.
 * @param {string} routeSuffix - The part of the path after the basePath (e.g., "art/color").
 * @param {Array} structure - The hierarchical navigation structure.
 * @returns {object|null} The found project object or null.
 */
function findProjectByRouteSuffix(routeSuffix, structure) {
    if (!routeSuffix || !structure) return null;

     // Use the pre-generated flat list for efficient lookup
     // Need to match routeSuffix against the part of project.routePath *after* the basePath
     const normalizedBasePath = basePath === '/' ? '/' : (basePath.endsWith('/') ? basePath : basePath + '/');
     const expectedRoutePath = normalizedBasePath + routeSuffix;

     return flatProjectList.find(p => p.routePath === expectedRoutePath);
}

/**
 * Loads and displays the selected project's content.
 * @param {string|null} routeSuffix - The route suffix (e.g., "art/color") or null for the welcome screen.
 */
async function loadProject(routeSuffix) {
     if (isLoading) {
          console.log("Already loading a project, aborting new request for route:", routeSuffix);
          return;
     }
     if (!routeSuffix) {
          console.log("No route suffix provided, showing welcome screen.");
          showWelcomeScreen();
          currentProject = null;
          updateNavActiveState(null); // Update nav styling
          // No need to manipulate history, path should be at root
          return;
     }

     isLoading = true;
     hideError(); // Clear previous errors

     console.log(`Attempting to load project for route suffix: ${routeSuffix}`);
     // Find project data using the route suffix
     const project = findProjectByRouteSuffix(routeSuffix, navStructure);

     if (!project) {
          console.warn(`Project for route suffix "${routeSuffix}" not found.`);
          showError(`Project '${routeSuffix.replace('/', ' / ')}' not found. It might have been removed, renamed, or the URL is incorrect.`);
          hideWelcomeScreen(); // Ensure welcome is hidden
          displayContentFrame(false); // Hide frame
          currentProject = null;
          updateNavActiveState(null);
          isLoading = false;
          // Don't manipulate history here, let the browser/user handle invalid paths
          return;
     }

     // If already showing this project, do nothing extra but ensure frame is visible
     if (currentProject?.id === project.id) {
          console.log(`Project ${project.name} (ID: ${project.id}) is already loaded.`);
          if (!document.getElementById('welcome-screen').classList.contains('hidden')) {
               hideWelcomeScreen();
               // SetFrameContent would have handled showing the frame initially
               // displayContentFrame(true, !!contentFrame?.srcdoc); // Re-ensure visibility? setFrame handles this.
          }
           isLoading = false; // Was already loaded
          return;
     }

     console.log(`Loading project: ${project.name} (ID: ${project.id})`);
     hideWelcomeScreen(); // Hide welcome screen
     displayContentFrame(false); // Hide frame while loading

     currentProject = project; // Set current project immediately
     updateNavActiveState(currentProject.id); // Update nav highlighting immediately

     try {
          const content = await fetchProjectContent(project.path); // Fetch using the *full* path
          await setFrameContent(content, project); // setFrameContent handles showing the frame on success/error
          // Update nav state again, passing whether it's srcdoc for theme updates
          const isSrcDoc = content.type === 'markdown';
          updateNavActiveState(currentProject.id, isSrcDoc);
     } catch (error) {
          console.error(`Unhandled error loading project ${project.id}:`, error);
          showError(`Failed to load project '${project.name}': ${error.message}`);
          displayContentFrame(false);
          currentProject = null; // Reset current project on error
          updateNavActiveState(null); // Update nav styling
          // Don't manipulate history here
     } finally {
          isLoading = false;
     }
}

/**
 * Handles route changes based on the current pathname (called on load, popstate, and link clicks).
 */
function handleRouteChange() {
    const routeSuffix = getRouteFromPathname();
    console.log(`Route changed/detected. Suffix: "${routeSuffix || '(root)'}" from path: ${window.location.pathname}`);

    // Load project only if the derived route suffix is different from the current one
    // Need to handle null/undefined cases carefully
    const currentProjectRouteSuffix = currentProject ? getRouteFromPathname() : null; // Get suffix for current project if it exists

    if (routeSuffix !== currentProjectRouteSuffix) {
         loadProject(routeSuffix);
    } else {
         console.log("Route suffix matches current project, no load needed.");
         // Ensure welcome screen is hidden if we are on a project route but somehow it became visible
         if (routeSuffix && !welcomeScreen.classList.contains('hidden')) {
             hideWelcomeScreen();
             // Frame visibility is handled by loadProject/setFrameContent initially
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
    applyTheme(newTheme); // applyTheme handles updating iframe if needed
}

/**
 * Initializes the application.
 */
async function initialize() {
    console.log('Initializing application...');
    isLoading = true; // Prevent route changes during init

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
    const fetchedData = await fetchProjects();

    // Check if fetchProjects returned an error object
    if (fetchedData.error) {
         showError(fetchedData.message);
         projectNavElement.innerHTML = `<p class="nav-message">Error loading projects.</p>`;
         showWelcomeScreen(); // Show welcome screen below error
         isLoading = false;
         return; // Stop initialization if projects can't be loaded
    }

    // Store fetched structure and generate flat list
    navStructure = fetchedData;
    flatProjectList = flattenProjects(navStructure); // Use helper from nav.js

    // Render initial nav
    if (navStructure.length === 0) {
        projectNavElement.innerHTML = '<p class="nav-message">No projects found.</p>';
        // showError("No projects (folders starting with 'proj.') found in the configured 'pages' directory."); // Optional content area message
    } else {
         renderNav(navStructure, null); // Render nav without active item initially
    }

    // --- Routing Setup ---
    window.addEventListener('popstate', handleRouteChange); // Handle browser back/forward

    // Add navigation link interceptor (delegate to app container)
    appElement.addEventListener('click', (event) => {
        const targetLink = event.target.closest('a'); // Check links within the app

         // Check if it's an internal navigation link managed by our router
         // It should have a data-project-id or be within the sidebar nav
         // And its href should start with the basePath
         if (targetLink && targetLink.closest('#sidebar') && targetLink.pathname.startsWith(basePath)) {
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
        // Allow clicks on category toggles (buttons) to pass through
        else if (event.target.closest('button.category-toggle')) {
             return;
        }
        // Potentially handle other link clicks within the app if needed
    });

    // Trigger initial load based on current path *after* event listeners are set up
    handleRouteChange(); // Load project based on current path or show welcome

    isLoading = false;
    console.log('Initialization complete.');
}

// --- Start Application ---
initialize();