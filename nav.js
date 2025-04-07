// nav.js
// Handles rendering and state updates for the navigation sidebar

import { basePath } from './config.js';

const projectNav = document.getElementById('project-nav'); // Cache nav element
const contentFrame = document.getElementById('content-frame'); // Needed for theme updates

/**
 * Recursively renders navigation items (projects and categories).
 * @param {HTMLElement} parentElement - The UL element to append items to.
 * @param {Array} items - Array of project/category objects.
 * @param {object|null} currentProject - The currently active project object.
 * @param {number} level - The current nesting level (0 for top level).
 */
function renderNavItems(parentElement, items, currentProject, level = 0) {
    items.forEach(item => {
        if (item.type === 'category') {
            const categoryLi = document.createElement('li');
            categoryLi.classList.add('category-item');

            // Header (clickable)
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('category-header');
            headerDiv.setAttribute('role', 'button');
            headerDiv.setAttribute('aria-expanded', 'false'); // Start collapsed
            headerDiv.setAttribute('tabindex', '0'); // Make focusable
            headerDiv.dataset.categoryId = item.id; // Store category ID if needed

            // Toggle Icon (e.g., SVG chevron)
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('category-toggle-icon');
            // Simple SVG Chevron - replace with more complex if needed
            iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"></polyline></svg>`;
            headerDiv.appendChild(iconSpan);

            // Category Name
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name');
            nameSpan.textContent = item.name;
            headerDiv.appendChild(nameSpan);

            categoryLi.appendChild(headerDiv);

            // Children List (initially hidden)
            const childrenUl = document.createElement('ul');
            childrenUl.classList.add('category-children');
            // Recursively render children
            renderNavItems(childrenUl, item.children, currentProject, level + 1);
            categoryLi.appendChild(childrenUl);

            // Toggle Functionality
            headerDiv.addEventListener('click', () => {
                const isExpanded = headerDiv.getAttribute('aria-expanded') === 'true';
                headerDiv.setAttribute('aria-expanded', !isExpanded);
                childrenUl.classList.toggle('expanded', !isExpanded); // Use class to toggle max-height
            });
             // Allow Enter/Space key to toggle
            headerDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    headerDiv.click();
                }
            });


            parentElement.appendChild(categoryLi);

        } else if (item.type === 'project') {
            const li = document.createElement('li');
            li.classList.add('project-link'); // Add class for potential styling
            const a = document.createElement('a');
            // Generate path-based URL
            const projectUrlSuffix = item.id.substring(5); // e.g., "example-html" from "proj.example-html"
            a.href = `${basePath}/${projectUrlSuffix}`;
            a.textContent = item.name;
            a.dataset.projectId = item.id; // Store project ID

            // Check if this project is the currently active one
            if (currentProject && currentProject.id === item.id) {
                a.classList.add('active');
                // Expand ancestor categories if this item is active on initial load
                 let parent = li.closest('.category-item');
                 while(parent) {
                     const header = parent.querySelector('.category-header');
                     const childrenList = parent.querySelector('.category-children');
                     if(header && childrenList && header.getAttribute('aria-expanded') === 'false') {
                        header.setAttribute('aria-expanded', 'true');
                        childrenList.classList.add('expanded');
                     }
                     parent = parent.parentElement.closest('.category-item'); // Move up hierarchy
                 }
            }

            li.appendChild(a);
            parentElement.appendChild(li);
        }
    });
}


/**
 * Renders the entire project navigation sidebar.
 * @param {Array} projects - Array of project/category objects (potentially nested).
 * @param {object|null} currentProject - The currently selected project object.
 */
export function renderNav(projects, currentProject) {
    if (!projectNav) return;
    projectNav.innerHTML = ''; // Clear previous nav

    if (!projects || projects.length === 0) {
        projectNav.innerHTML = '<p class="nav-message">No projects found.</p>';
        return;
    }

    const ul = document.createElement('ul');
    renderNavItems(ul, projects, currentProject); // Use recursive renderer
    projectNav.appendChild(ul);
}


/**
 * Updates the 'active' class on navigation links and ensures ancestors are expanded.
 * Also updates the theme attribute on srcdoc iframes if necessary.
 * @param {string|null} currentProjectId - The ID of the currently active project, or null.
 * @param {boolean} [isSrcDoc=false] - Indicates if the current content is from srcdoc (markdown).
 */
export function updateNavActiveState(currentProjectId, isSrcDoc = false) {
    if (!projectNav) return;
    const links = projectNav.querySelectorAll('a[data-project-id]');
    let activeLinkElement = null;

    // Remove active class from all links first
    links.forEach(link => link.classList.remove('active'));

    // Find and activate the current link
    if (currentProjectId) {
        // Use dataset.projectId for reliable selection
        activeLinkElement = projectNav.querySelector(`a[data-project-id="${currentProjectId}"]`);
        if (activeLinkElement) {
            activeLinkElement.classList.add('active');

            // Expand ancestor categories
             let parentLi = activeLinkElement.closest('li'); // Start from the link's li
             let categoryItem = parentLi ? parentLi.closest('.category-item') : null;
             while (categoryItem) {
                 const header = categoryItem.querySelector('.category-header');
                 const childrenList = categoryItem.querySelector('.category-children');
                 if (header && childrenList && header.getAttribute('aria-expanded') === 'false') {
                     header.setAttribute('aria-expanded', 'true');
                     childrenList.classList.add('expanded');
                 }
                  // Move up to the next parent category item
                 categoryItem = categoryItem.parentElement.closest('.category-item');
             }
        } else {
            console.warn(`Could not find nav link element for project ID: ${currentProjectId}`);
        }
    }

    // Update iframe theme if it's srcdoc
     if (isSrcDoc && contentFrame && contentFrame.contentDocument) {
          try {
            const iframeDoc = contentFrame.contentDocument || contentFrame.contentWindow.document;
            if(iframeDoc && iframeDoc.documentElement) { // Check documentElement
                 const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
                 iframeDoc.documentElement.setAttribute('data-theme', currentTheme); // Apply to html element
                // Body might not exist immediately, but applying to html is often enough
                 if (iframeDoc.body) {
                    iframeDoc.body.setAttribute('data-theme', currentTheme);
                 }
                 console.log("Updated srcdoc iframe theme to:", currentTheme);
            } else {
                console.warn("Could not access srcdoc iframe documentElement to update theme.");
            }
          } catch (e) {
               console.warn("Could not update srcdoc iframe theme (cross-origin or timing issue?):", e.message);
          }
     }
     // Theme update for HTML iframe content is generally not feasible due to cross-origin
}