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
const welcomeScreenElement = document.getElementById('welcome-screen'); 

// State
let projects = []; 
let currentProject = null;
let isLoading = false;

function clearIframe() {
    if (contentFrame) {
        console.log("[clearIframe] Clearing iframe content and handlers."); 
        contentFrame.onload = null;
        contentFrame.onerror = null;
        contentFrame.src = 'about:blank'; 
        contentFrame.removeAttribute('srcdoc'); 
    } else {
        console.warn("[clearIframe] Attempted to clear iframe, but contentFrame element not found.");
    }
}

function findProjectById(items, id) {
    if (!items || !Array.isArray(items)) { return null; }
    for (const item of items) {
        if (item.type === 'project' && item.id === id) { return item; }
        if (item.type === 'category' && item.children) {
            const foundInChildren = findProjectById(item.children, id);
            if (foundInChildren) { return foundInChildren; }
        }
    }
    return null;
}

function getRouteFromPathname() {
    const path = window.location.pathname;
    const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
    if (path.startsWith(normalizedBasePath)) {
        const routePart = path.substring(normalizedBasePath.length);
        return routePart === '' ? null : routePart;
    } else if (path === basePath.replace(/\/$/, '')) { return null; }
    console.warn(`Pathname "${path}" does not match expected base path "${basePath}". Treating as root.`);
    return null;
}

async function loadProject(projectId) {
     if (isLoading) {
          console.log(`Already loading, aborting request for: "${projectId || 'welcome screen'}"`);
          return;
     }
     isLoading = true; 
     clearIframe(); 

     if (!projectId) {
          console.log("[loadProject] No project ID, showing welcome screen.");
          hideError(); 
          if(welcomeScreenElement) showWelcomeScreen(); 
          displayContentFrame(false); 
          currentProject = null;
          updateNavActiveState(null); 
          
          requestAnimationFrame(() => { 
             if (typeof window.runWelcomeAnimations === 'function') {
                  console.log("[loadProject] Calling runWelcomeAnimations for welcome screen."); 
                  window.runWelcomeAnimations(); 
             } else {
                  console.warn("[loadProject] runWelcomeAnimations function not found on window."); 
             }
          });
          
          isLoading = false;
          return;
     }

     const project = findProjectById(projects, projectId);

     if (!project || project.type !== 'project') {
          const readableName = projectId.startsWith('proj.') ? projectId.substring(5).replace(/[-_]/g, ' ') : projectId;
          console.warn(`[loadProject] Project with id "${projectId}" not found or is not a project type.`);
          showError(`Project '${readableName}' not found.`);
          if(welcomeScreenElement) hideWelcomeScreen(); 
          displayContentFrame(false); 
          currentProject = null;
          updateNavActiveState(null);
          isLoading = false;
          return;
     }

     if (currentProject?.id === projectId && !contentFrame?.classList.contains('hidden')) {
          console.log(`[loadProject] Project ${projectId} is already loaded and visible.`);
          if (welcomeScreenElement && !welcomeScreenElement.classList.contains('hidden')) {
               hideWelcomeScreen(); 
          }
          isLoading = false;
          return;
     }

     console.log(`[loadProject] Loading project: ${project.name} (ID: ${project.id})`);
     hideError(); 
     if(welcomeScreenElement) hideWelcomeScreen(); 
     displayContentFrame(false); 

     currentProject = project;
     updateNavActiveState(currentProject.id); 

     try {
          const content = await fetchProjectContent(project.path);
          await setFrameContent(content, project); 
     } catch (error) {
          console.error(`[loadProject] Error loading project ${projectId}:`, error);
          showError(`Failed to load project '${project.name}': ${error.message}`);
          displayContentFrame(false);
          currentProject = null; 
          updateNavActiveState(null); 
     } finally {
          isLoading = false; 
     }
}

function handleRouteChange() {
    const routePart = getRouteFromPathname();
    const projectId = routePart ? `proj.${routePart}` : null;
    console.log(`[handleRouteChange] Route changed/detected: "${routePart || '(root)'}". ProjectId: ${projectId}`); 

    let needsLoad = false;
    if (projectId !== (currentProject?.id || null)) {
        console.log("[handleRouteChange] Project ID changed."); 
        needsLoad = true;
    } else if (projectId === null && welcomeScreenElement?.classList.contains('hidden') && !isLoading) {
        console.log("[handleRouteChange] Navigating to root, but welcome screen is hidden."); 
        needsLoad = true; 
    } else if (projectId !== null && contentFrame?.classList.contains('hidden') && !isLoading) {
        console.log("[handleRouteChange] Project ID matches, but content frame is hidden."); 
        needsLoad = true; 
    }

    if (needsLoad) {
        console.log("[handleRouteChange] Triggering loadProject."); 
        loadProject(projectId);
    } else {
        console.log(`[handleRouteChange] Route matches current state (${projectId || 'welcome screen'}), no new load needed.`);
        if (!projectId && welcomeScreenElement && welcomeScreenElement.classList.contains('hidden')) {
             console.log("[handleRouteChange] Consistency check: Forcing welcome screen visible."); 
             if (contentFrame) displayContentFrame(false);
             showWelcomeScreen();
             requestAnimationFrame(() => { window.runWelcomeAnimations?.(); }); 
        } else if (projectId && contentFrame && contentFrame.classList.contains('hidden')) {
            console.log("[handleRouteChange] Consistency check: Forcing content frame visible."); 
             if (welcomeScreenElement) hideWelcomeScreen();
             displayContentFrame(true, !!contentFrame.srcdoc);
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme); 
}

async function initialize() {
    console.log('[initialize] Initializing application...');
    isLoading = true;

    if (sidebarToggleButton) {
        sidebarToggleButton.addEventListener('click', () => toggleSidebarCollapse());
        initializeSidebarState(); 
    } else { console.warn("Sidebar toggle button not found."); }

    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleTheme);
    } else { console.warn("Theme toggle button not found."); }
    
    const siteTitleHeader = document.querySelector('#sidebar header h1');
    if (siteTitleHeader) {
        siteTitleHeader.addEventListener('click', (event) => {
            event.preventDefault(); 
            const isAlreadyOnWelcome = (currentProject === null && welcomeScreenElement && !welcomeScreenElement.classList.contains('hidden'));
            console.log(`[initialize] Site title clicked. Already on welcome: ${isAlreadyOnWelcome}`); 
            
            if (isAlreadyOnWelcome && !isLoading) {
                 console.log('[initialize] Site title clicked, but already on welcome screen.');
                 return; 
            }
            
            const targetPath = basePath ? (basePath.endsWith('/') ? basePath : basePath + '/') : '/';
            if (window.location.pathname !== targetPath) { 
                 console.log(`[initialize] Site title clicked, pushing state to: ${targetPath}`);
                 history.pushState({}, '', targetPath); 
                 handleRouteChange(); 
            } else {
                 console.log("[initialize] Site title clicked, already at root path, ensuring welcome is visible.");
                 loadProject(null); 
            }
        });
    }

    let fetchedData;
    try {
        fetchedData = await fetchProjects();
        if (fetchedData && !fetchedData.error) { 
            projects = fetchedData;
        } else if (fetchedData && fetchedData.error) { 
            throw new Error(fetchedData.message); 
        } else { 
            throw new Error("Failed to fetch project data: Unknown error.");
        }
    } catch (fetchError) {
        console.error("[initialize] Critical error fetching project structure:", fetchError);
        showError(fetchError.message || "Failed to initialize project fetching.");
        if (projectNavElement) {
           projectNavElement.innerHTML = `<p class="nav-message">${fetchError.message.includes('404') || fetchError.message.includes('not found') ? 'Could not find projects list file.' : 'Error loading project structure.'}</p>`;
        }
        if(welcomeScreenElement) showWelcomeScreen(); 
        isLoading = false; 
        return; 
    }

    if (projectNavElement) {
        if (!projects || projects.length === 0) {
            projectNavElement.innerHTML = '<p class="nav-message">No projects found or list file is empty.</p>';
        } else {
             renderNav(projects, null); 
        }
    } else { console.warn("Project navigation element (#project-nav) not found."); }

    window.addEventListener('popstate', handleRouteChange);

    if (appElement) {
        appElement.addEventListener('click', (event) => {
            const targetLink = event.target.closest('a');
            if (targetLink && targetLink.href && targetLink.origin === window.location.origin) { 
                if (targetLink.target === '_blank' || targetLink.hasAttribute('download') || targetLink.href.startsWith('mailto:')) {
                    return; 
                }
                
                const isCurrentPage = targetLink.href === window.location.href;
                const isBasePathLink = targetLink.pathname === basePath || targetLink.pathname === basePath + '/';
                const isCurrentProjectNull = currentProject === null;

                if(targetLink.pathname.startsWith(basePath)) {
                    event.preventDefault();
                    console.log(`[initialize] Intercepted navigation to: ${targetLink.href}. Is current page: ${isCurrentPage}`); 

                    if (!isCurrentPage) {
                        history.pushState({}, '', targetLink.href);
                        handleRouteChange();
                    } else {
                        console.log("[initialize] Clicked link matches current URL. Re-evaluating route for potential state update.");
                        if(isBasePathLink && isCurrentProjectNull) {
                           if (typeof window.runWelcomeAnimations === 'function') {
                                window.runWelcomeAnimations(); 
                           }
                        } else {
                             handleRouteChange(); 
                        }
                    }
                }
            }
        });
    } else { console.warn("App element (#app) not found for link interception."); }

    isLoading = false;
    console.log('[initialize] Initialization setup complete. Performing initial route handling...');
    handleRouteChange();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}