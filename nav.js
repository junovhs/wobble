// nav.js
// Handles rendering and interaction for the sidebar navigation

import { basePath } from './config.js';

// DOM Elements
const projectNav = document.getElementById('project-nav');

// State for expanded categories
const expandedCategories = new Set();

/**
 * Toggles the expansion state of a category.
 * @param {string} categoryId - The ID of the category (e.g., "cat.art").
 * @param {HTMLButtonElement} button - The button element that was clicked.
 */
function toggleCategory(categoryId, button) {
    const subList = button.nextElementSibling; // Assuming <ul> follows the button
    const icon = button.querySelector('.category-icon');

    if (expandedCategories.has(categoryId)) {
        expandedCategories.delete(categoryId);
        if (subList) subList.style.display = 'none';
        if (icon) icon.classList.remove('expanded');
        button.setAttribute('aria-expanded', 'false');
    } else {
        expandedCategories.add(categoryId);
        if (subList) subList.style.display = 'block';
        if (icon) icon.classList.add('expanded');
        button.setAttribute('aria-expanded', 'true');
    }
    // Optional: Save state to sessionStorage/localStorage
}

/**
 * Recursively renders navigation items (categories and projects).
 * @param {Array} items - Array of project or category objects.
 * @param {HTMLElement} parentElement - The HTML element (ul) to append items to.
 * @param {string|null} currentProjectId - The ID of the currently active project.
 * @param {number} level - The nesting level (0 for top level).
 */
function renderNavItems(items, parentElement, currentProjectId, level = 0) {
    items.forEach(item => {
        const li = document.createElement('li');
        li.classList.add(`nav-level-${level}`);

        if (item.type === 'project') {
            const a = document.createElement('a');
            a.href = item.routePath; // Use pre-generated route path
            a.textContent = item.name;
            a.dataset.projectId = item.id; // Store project ID for identification
            if (currentProjectId === item.id) {
                a.classList.add('active');
            }
            li.appendChild(a);
        } else if (item.type === 'category') {
            // Use a button for accessibility and event handling
            const button = document.createElement('button');
            button.classList.add('category-toggle');
            button.setAttribute('aria-expanded', expandedCategories.has(item.id) ? 'true' : 'false');
            button.setAttribute('aria-controls', `category-${item.id}-list`); // For accessibility

            // Add icon and text
            button.innerHTML = `
                <svg class="category-icon ${expandedCategories.has(item.id) ? 'expanded' : ''}" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                <span>${item.name}</span>
            `;

            button.addEventListener('click', () => toggleCategory(item.id, button));
            li.appendChild(button);

            const subUl = document.createElement('ul');
            subUl.id = `category-${item.id}-list`;
            subUl.style.display = expandedCategories.has(item.id) ? 'block' : 'none'; // Initial state
            renderNavItems(item.projects, subUl, currentProjectId, level + 1); // Recursive call for nested projects
            li.appendChild(subUl);
        }
        parentElement.appendChild(li);
    });
}

/**
 * Renders the entire project navigation sidebar.
 * @param {Array} navStructure - Hierarchical array of project and category objects.
 * @param {string|null} currentProjectId - The ID of the currently selected project object.
 */
export function renderNav(navStructure, currentProjectId) {
    if (!projectNav) return;
    projectNav.innerHTML = ''; // Clear previous nav

    if (!navStructure || navStructure.length === 0) {
        // Message is handled in app.js based on fetch results
        return;
    }

    const topUl = document.createElement('ul');
    renderNavItems(navStructure, topUl, currentProjectId, 0); // Start rendering at level 0
    projectNav.appendChild(topUl);
}


/**
 * Flattens the hierarchical navigation structure into a flat list of projects.
 * Useful for searching for a project by ID or routePath.
 * @param {Array} navStructure - The hierarchical navigation structure.
 * @returns {Array} A flat array of project objects.
 */
export function flattenProjects(navStructure) {
    let flatList = [];
    navStructure.forEach(item => {
        if (item.type === 'project') {
            flatList.push(item);
        } else if (item.type === 'category' && item.projects) {
            // Recursively flatten projects within categories
            flatList = flatList.concat(item.projects); // Assumes projects in categories are always type 'project'
        }
    });
    return flatList;
}


/**
 * Updates the 'active' class on the navigation links.
 * Also updates the theme attribute on srcdoc iframes if necessary.
 * @param {string|null} currentProjectId - The ID of the currently active project, or null.
 * @param {boolean} isSrcDoc - Indicates if the current content is from srcdoc (markdown).
 */
export function updateNavActiveState(currentProjectId, isSrcDoc = false) {
    if (!projectNav) return;
    const links = projectNav.querySelectorAll('a[data-project-id]'); // Select only project links

    // Deactivate all links first
    links.forEach(link => link.classList.remove('active'));

    // Activate the current one if found
    if (currentProjectId) {
        const activeLink = projectNav.querySelector(`a[data-project-id="${currentProjectId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');

            // Ensure parent categories are expanded if the active link is inside a collapsed one
            let parent = activeLink.closest('ul');
            while (parent && parent.id && parent.id.startsWith('category-')) {
                 const categoryId = parent.id.substring(9, parent.id.lastIndexOf('-list')); // Extract cat.id
                 const toggleButton = parent.previousElementSibling; // The button controlling this ul
                 if (toggleButton && toggleButton.classList.contains('category-toggle') && !expandedCategories.has(categoryId)) {
                     // Programmatically toggle if not already expanded
                     toggleCategory(categoryId, toggleButton);
                     console.log(`Auto-expanded category ${categoryId} for active project.`);
                 }
                 // Move up to the next potential parent category list
                 parent = parent.closest('li.nav-level-') ?.parentElement ?.closest('ul');
            }
        } else {
            console.warn(`Could not find nav link for active project ID: ${currentProjectId}`);
        }
    }

    // --- Update iframe theme logic (remains the same as before) ---
    const contentFrame = document.getElementById('content-frame'); // Need to get reference here

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
    } else if (!isSrcDoc && contentFrame && contentFrame.contentWindow) {
        // Attempt to send a message post-load (needs listener in iframe)
        // Or try direct access if same-origin (unlikely for different projects)
    }
}