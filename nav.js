// nav.js
// Handles rendering and state updates for the navigation sidebar

import { basePath } from './config.js';

const projectNav = document.getElementById('project-nav'); // Cache nav element
// contentFrame is not directly needed in nav.js anymore for theme updates

/**
 * Helper to check if an item is the target project or a category containing it.
 * @param {object} item - The nav item (category or project).
 * @param {string} targetProjectId - The ID of the project to find.
 * @returns {boolean}
 */
function isProjectOrContainsProject(item, targetProjectId) {
    if (item.type === 'project' && item.id === targetProjectId) {
        return true;
    }
    if (item.type === 'category' && item.children) {
        return item.children.some(child => isProjectOrContainsProject(child, targetProjectId));
    }
    return false;
}


/**
 * Recursively renders navigation items (projects and categories).
 * @param {HTMLElement} parentElement - The UL element to append items to.
 * @param {Array} items - Array of project/category objects.
 * @param {object|null} currentProject - The currently active project object.
 * @param {number} level - The current nesting level (0 for top level).
 */
function renderNavItems(parentElement, items, currentProject, level = 0) {
    items.forEach(item => {
        const li = document.createElement('li');
        // Apply nesting level as a CSS custom property for styling
        li.style.setProperty('--nesting-level', level.toString());

        if (item.type === 'category') {
            li.classList.add('category-item');

            const headerDiv = document.createElement('div');
            headerDiv.classList.add('category-header');
            headerDiv.setAttribute('role', 'button');
            headerDiv.setAttribute('aria-expanded', 'false'); // Start collapsed
            headerDiv.setAttribute('tabindex', '0'); // Make focusable
            headerDiv.dataset.categoryId = item.id;

            const iconSpan = document.createElement('span');
            iconSpan.classList.add('category-toggle-icon');
            iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"></polyline></svg>`;
            headerDiv.appendChild(iconSpan);

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('category-name');
            nameSpan.textContent = item.name;
            headerDiv.appendChild(nameSpan);

            li.appendChild(headerDiv);

            const childrenUl = document.createElement('ul');
            childrenUl.classList.add('category-children');
            if (item.children && item.children.length > 0) {
                renderNavItems(childrenUl, item.children, currentProject, level + 1);
            } else {
                const emptyMsgLi = document.createElement('li');
                emptyMsgLi.classList.add('nav-message-empty-category');
                // Apply dynamic padding based on level for empty category message
                emptyMsgLi.style.paddingLeft = `calc(var(--base-padding-left, 15px) + ${(level + 1)} * var(--indent-size, 20px))`;
                emptyMsgLi.innerHTML = `<em>(empty)</em>`;
                childrenUl.appendChild(emptyMsgLi);
            }
            li.appendChild(childrenUl);

            headerDiv.addEventListener('click', () => {
                const isExpanded = headerDiv.getAttribute('aria-expanded') === 'true';
                headerDiv.setAttribute('aria-expanded', String(!isExpanded));
                childrenUl.classList.toggle('expanded', !isExpanded);
            });
             headerDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    headerDiv.click();
                }
            });

            // Auto-expand if this category contains the active project
            if (currentProject && item.children && item.children.some(child => isProjectOrContainsProject(child, currentProject.id))) {
                 headerDiv.setAttribute('aria-expanded', 'true');
                 childrenUl.classList.add('expanded');
            }

        } else if (item.type === 'project') {
            li.classList.add('project-link');
            const a = document.createElement('a');
            const projectUrlSuffix = item.id.substring(5); // e.g., "example-html" from "proj.example-html"
            a.href = `${basePath}/${projectUrlSuffix}`;
            a.textContent = item.name;
            a.dataset.projectId = item.id;

            if (currentProject && currentProject.id === item.id) {
                a.classList.add('active');
            }
            li.appendChild(a);
        }
        parentElement.appendChild(li);
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
    renderNavItems(ul, projects, currentProject, 0); // Start at level 0
    projectNav.appendChild(ul);
}


/**
 * Updates the 'active' class on navigation links and ensures ancestors are expanded.
 * @param {string|null} currentProjectId - The ID of the currently active project, or null.
 * @param {boolean} [isSrcDocContent=false] - This parameter is no longer used here for theme updates.
 */
export function updateNavActiveState(currentProjectId, isSrcDocContent = false) {
    if (!projectNav) return;
    const links = projectNav.querySelectorAll('a[data-project-id]');
    
    // Remove active class from all links first
    links.forEach(link => link.classList.remove('active'));

    // Find and activate the current link
    if (currentProjectId) {
        const activeLinkElement = projectNav.querySelector(`a[data-project-id="${currentProjectId}"]`);
        if (activeLinkElement) {
            activeLinkElement.classList.add('active');

            // Expand ancestor categories
            let parentLi = activeLinkElement.closest('li.project-link');
            if (parentLi) {
                 let categoryItem = parentLi.parentElement.closest('li.category-item'); 
                 while (categoryItem) {
                     const header = categoryItem.querySelector('.category-header');
                     const childrenList = categoryItem.querySelector('.category-children');
                     if (header && childrenList && header.getAttribute('aria-expanded') === 'false') {
                         header.setAttribute('aria-expanded', 'true');
                         childrenList.classList.add('expanded');
                     }
                     // Move up to the parent of current category-item's UL, then find closest category-item
                     const grandParentUl = categoryItem.parentElement;
                     if (grandParentUl) {
                         categoryItem = grandParentUl.closest('li.category-item');
                     } else {
                         categoryItem = null; // Should not happen in well-formed list
                     }
                 }
            }
        } else {
            console.warn(`Could not find nav link element for project ID: ${currentProjectId}`);
        }
    }
    // Theme updates for iframes are handled by ui.js (applyTheme and setFrameContent).
}