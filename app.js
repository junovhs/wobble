// app.js

// Import dependencies
import { fetchProjects, fetchProjectContent } from './githubApi.js';
import { basePath } from './config.js'; 
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
import { renderNav, updateNavActiveState } from './nav.js';

// DOM Elements
const projectNavElement = document.getElementById('project-nav');
const themeToggleButton = document.getElementById('theme-toggle');
const sidebarToggleButton = document.getElementById('sidebar-toggle');
const appElement = document.getElementById('app'); 
const contentFrame = document.getElementById('content-frame'); 
const welcomeScreenElement = document.getElementById('welcome-screen'); // Use this consistent name

// State
let projects = []; 
let currentProject = null;
let isLoading = false;

/**
 * Recursively searches the nested projects array for a project by its ID.
 * @param {Array} items - The array of projects/categories to search.
 * @param {string} id - The project ID to find.
 * @returns {object|null} The project object or null if not found.
 */
function findProjectById(items, id) {
    if (!items || !Array.isArray(items)) {
        return null; 
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
 * Extracts the project route part from the full pathname.
 * @returns {string|null} The route part or null.
 */
function getRouteFromPathname() {
    const path = window.location.pathname;
    const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';

    if (path.startsWith(normalizedBasePath)) {
        const routePart = path.substring(normalizedBasePath.length);
        return routePart === '' ? null : routePart;
    } else if (path === basePath.replace(/\/$/, '')) { 
        return null;
    }
    console.warn(`Pathname "${path}" does not match expected base path "${basePath}". Treating as root.`);
    return null;
}

/**
 * Loads and displays the selected project's content or welcome screen.
 * @param {string|null} projectId - The ID of the project to load, or null for welcome screen.
 */
async function loadProject(projectId) {
     if (isLoading) {
          console.log(`Already loading, aborting request for: "${projectId || 'welcome screen'}"`);
          return;
     }
     isLoading = true; // Set loading flag early

     if (!projectId) {
          console.log("No project ID, showing welcome screen.");
          hideError(); 
          if(welcomeScreenElement) showWelcomeScreen(); // Call imported showWelcomeScreen
          displayContentFrame(false); // Ensure iframe is hidden
          currentProject = null;
          updateNavActiveState(null); 
          // If animations are in an inline script triggered by DOMContentLoaded and welcome not hidden, they should run.
          // If welcome screen has class 'hidden', animations inside it won't auto-run from the inline script's check.
          // If we need to re-trigger animations here when showing welcome dynamically:
          // This is complex because inline scripts run once. Consider moving animation logic to a function.
          // For now, assume the inline script handles its initial run.
          isLoading = false;
          return;
     }

     const project = findProjectById(projects, projectId);

     if (!project || project.type !== 'project') {
          const readableName = projectId.startsWith('proj.') ? projectId.substring(5).replace(/[-_]/g, ' ') : projectId;
          console.warn(`Project with id "${projectId}" not found or is not a project type.`);
          showError(`Project '${readableName}' not found.`);
          if(welcomeScreenElement) hideWelcomeScreen(); 
          displayContentFrame(false); 
          currentProject = null;
          updateNavActiveState(null);
          isLoading = false;
          return;
     }

     if (currentProject?.id === projectId && !contentFrame.classList.contains('hidden')) {
          console.log(`Project ${projectId} is already loaded and visible.`);
          if (welcomeScreenElement && !welcomeScreenElement.classList.contains('hidden')) {
               hideWelcomeScreen(); // Still ensure welcome is hidden
          }
          isLoading = false;
          return;
     }

     console.log(`Loading project: ${project.name} (ID: ${project.id})`);
     hideError(); 
     if(welcomeScreenElement) hideWelcomeScreen(); 
     // Display frame will be handled by setFrameContent after content is ready

     currentProject = project;
     updateNavActiveState(currentProject.id); 

     try {
          // Temporarily hide frame until content is set, to prevent FOUC of old content
          displayContentFrame(false); 
          const content = await fetchProjectContent(project.path);
          await setFrameContent(content, project); // This handles showing the frame on success
          // updateNavActiveState might need to be called after setFrameContent if theming depends on it,
          // but currently nav theming is just for active link.
     } catch (error) {
          console.error(`Error loading project ${projectId}:`, error);
          showError(`Failed to load project '${project.name}': ${error.message}`);
          displayContentFrame(false);
          currentProject = null; 
          updateNavActiveState(null); 
     } finally {
          isLoading = false; 
     }
}

/**
 * Handles route changes.
 */
function handleRouteChange() {
    const routePart = getRouteFromPathname();
    console.log(`Route changed/detected: "${routePart || '(root)'}" from path: ${window.location.pathname}`);
    const projectId = routePart ? `proj.${routePart}` : null;

    if (projectId !== (currentProject?.id || null) || 
        (projectId === null && (currentProject !== null || welcomeScreenElement?.classList.contains('hidden')) ) || // Force welcome if navigating to root and not already on it
        (projectId !== null && contentFrame?.classList.contains('hidden') && !isLoading ) // Force project load if it should be visible but isn't
    ) {
        loadProject(projectId);
    } else {
        console.log(`Route matches current project (${projectId || 'welcome screen'}), no new load needed.`);
        // Ensure correct visibility if something went awry
        if (!projectId && welcomeScreenElement) {
            if(contentFrame) displayContentFrame(false);
            showWelcomeScreen();
        } else if (projectId && contentFrame && welcomeScreenElement) {
            hideWelcomeScreen();
            if (!contentFrame.src && !contentFrame.srcdoc && currentProject) { // If frame is blank but should show project
                 console.log("Frame is blank, attempting to reload current project data.");
                 loadProject(currentProject.id); // Try to reload it
            } else if (contentFrame.classList.contains('hidden')) {
                displayContentFrame(true, !!contentFrame.srcdoc);
            }
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
    applyTheme(newTheme); // applyTheme in ui.js should handle iframe theme updates
}

/**
 * Initializes the application.
 */
async function initialize() {
    console.log('Initializing application...');
    isLoading = true;

    if (sidebarToggleButton) {
        sidebarToggleButton.addEventListener('click', () => toggleSidebarCollapse());
        initializeSidebarState(); 
    } else {
        console.warn("Sidebar toggle button not found.");
    }

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    } else {
        console.warn("Theme toggle button not found.");
    }
    
    // --- "My Projects" Header Click to Home View ---
    const siteTitleHeader = document.querySelector('#sidebar header h1');
    if (siteTitleHeader) {
        // siteTitleHeader.style.cursor = 'pointer'; // CSS should handle this now
        siteTitleHeader.addEventListener('click', (event) => {
            event.preventDefault(); 
            console.log('Site title clicked, navigating to home/welcome screen.');
            
            if (currentProject === null && welcomeScreenElement && !welcomeScreenElement.classList.contains('hidden') && !isLoading) {
                console.log('Already on welcome screen or navigating there.');
                return;
            }
            if (window.location.pathname === basePath || window.location.pathname === basePath + '/') {
                 if(currentProject === null) return; // Already at root and showing welcome.
            }

            history.pushState({}, '', basePath + '/'); 
            handleRouteChange(); 
        });
    }
    // --- END OF "My Projects" Click ---

    let fetchedData;
    try {
        fetchedData = await fetchProjects();
        if (fetchedData && !fetchedData.error) { // Ensure fetchedData itself isn't an error.
            projects = fetchedData;
        } else if (fetchedData && fetchedData.error) { // Handle error object from fetchProjects
            throw new Error(fetchedData.message); // Propagate error message
        } else { // Handle unexpected return like null/undefined
            throw new Error("Failed to fetch project data: Unknown error.");
        }
    } catch (fetchError) {
        console.error("Critical error fetching project structure:", fetchError);
        showError(fetchError.message || "Failed to initialize project fetching.");
        if (projectNavElement) {
           projectNavElement.innerHTML = `<p class="nav-message">${fetchError.message.includes('404') || fetchError.message.includes('not found') ? 'Could not find projects list file.' : 'Error loading project structure.'}</p>`;
        }
        if(welcomeScreenElement) showWelcomeScreen(); // Show welcome screen below error
        isLoading = false; 
        return; 
    }

    if (projectNavElement) {
        if (!projects || projects.length === 0) {
            projectNavElement.innerHTML = '<p class="nav-message">No projects found or list file is empty.</p>';
        } else {
             renderNav(projects, null); 
        }
    } else {
        console.warn("Project navigation element (#project-nav) not found.");
    }

    window.addEventListener('popstate', handleRouteChange);

    if (appElement) {
        appElement.addEventListener('click', (event) => {
            const targetLink = event.target.closest('a');
            if (targetLink && targetLink.pathname && targetLink.pathname.startsWith(basePath)) {
                 if (targetLink.target === '_blank' || targetLink.origin !== window.location.origin || targetLink.hasAttribute('download')) {
                    return; // Let browser handle external links, new tabs, or downloads
                }
                // Check if it's one of the footer links inside welcome screen. If so, let it behave normally if it's mailto.
                if (targetLink.closest('#welcome-screen .welcome-footer-info') && targetLink.href.startsWith('mailto:')) {
                    return;
                }


                event.preventDefault();
                console.log(`Intercepted navigation to: ${targetLink.href}`);
                if (targetLink.href !== window.location.href) {
                    history.pushState({}, '', targetLink.href);
                    handleRouteChange();
                } else if (!targetLink.href.endsWith('#') && targetLink.getAttribute('href') !== '#') { // Avoid re-triggering for empty hrefs
                    console.log("Clicked link matches current URL. Re-evaluating route.");
                    handleRouteChange(); 
                }
            }
        });
    } else {
        console.warn("App element (#app) not found for link interception.");
    }

    isLoading = false;
    console.log('Initialization setup complete. Performing initial route handling...');
    handleRouteChange();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}