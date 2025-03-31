// Import dependencies
import { fetchProjects, fetchProjectContent } from './githubApi.js';
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

// State
let projects = [];
let currentProject = null;
let isLoading = false; // Prevent concurrent loads


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
          updateNavActiveState(null);
          if (window.location.hash) window.location.hash = ''; // Clear hash
          return;
     }
     // Find project data (already fetched)
     const project = projects.find(p => p.id === projectId);

     if (!project) {
        console.warn(`Project with id "${projectId}" not found in fetched list.`);
        showError(`Project '${projectId.replace('proj.', '')}' not found. It might have been removed or renamed.`);
        currentProject = null;
        updateNavActiveState(null);
        // Clear hash if it points to a non-existent project
        if (window.location.hash === `#${projectId}`) window.location.hash = '';
        return;
     }

     // If already showing this project, do nothing
     if (currentProject?.id === projectId) {
          console.log(`Project ${projectId} is already loaded.`);
          // Ensure frame is visible if welcome screen was shown before
          if (!document.getElementById('welcome-screen').classList.contains('hidden')) {
               hideWelcomeScreen();
               displayContentFrame(true, contentFrame?.srcdoc !== '');
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
          // Update nav state again, potentially including iframe theme
          updateNavActiveState(currentProject.id, content.type === 'markdown');
     } catch (error) {
          console.error(`Unhandled error loading project ${projectId}:`, error);
          showError(`Failed to load project '${project.name}': ${error.message}`);
          displayContentFrame(false);
          currentProject = null; // Reset current project on error
          updateNavActiveState(null); // Update nav styling
          // Clear hash if loading failed critically
           if (window.location.hash === `#${projectId}`) window.location.hash = '';
     } finally {
          isLoading = false;
     }
}


/**
 * Handles hash changes in the URL to navigate projects.
 */
function handleHashChange() {
    const projectId = window.location.hash.substring(1);
    console.log(`Hash changed to: #${projectId}`);
    // Only load if the hash points to a different project than the current one, or if no project is current
    if (projectId && projectId !== (currentProject?.id || '')) {
        loadProject(projectId);
    } else if (!projectId && currentProject) {
        // Hash cleared, show welcome screen
        loadProject(null); // Use loadProject(null) to handle state update and UI
    } else if (!projectId && !currentProject) {
         // Hash cleared or empty initially, and no project loaded, ensure welcome screen is shown
         showWelcomeScreen();
         updateNavActiveState(null);
         hideError();
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


    // --- Initial Load / Routing ---
    // Add listeners before initial load check
    window.addEventListener('hashchange', handleHashChange);
    projectNavElement.addEventListener('click', (event) => {
        const targetLink = event.target.closest('a'); // Find nearest anchor tag
        if (targetLink && targetLink.dataset.projectId) {
             // Let the hashchange listener handle the loadProject call naturally
            console.log(`Nav link clicked for project: ${targetLink.dataset.projectId}`);
            // No preventDefault needed as we rely on hash change
        }
    });

    // Trigger initial load based on hash *after* event listeners are set up
    handleHashChange(); // Load project based on current hash or show welcome

    isLoading = false;
    console.log('Initialization complete.');
}

// --- Start Application ---
initialize();