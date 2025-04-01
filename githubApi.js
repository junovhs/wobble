// githubApi.js
// Handles interactions with the GitHub API

import { githubOwner, githubRepo, pagesFolder, basePath } from './config.js';

const GITHUB_API_BASE = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/`;
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Fetches directory contents from the GitHub API.
 * @param {string} path - The path relative to the repository root (e.g., 'pages' or 'pages/cat.art').
 * @returns {Promise<Array>} A promise that resolves to an array of directory items.
 * @throws {Error} If the fetch fails or returns a non-OK status (excluding 404 for the initial fetch).
 */
async function fetchDirectoryContents(path) {
    const apiUrl = GITHUB_API_BASE + path;
    console.log(`Fetching directory contents from: ${apiUrl}`);
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            // Allow 404 specifically for the *initial* call to fetchProjects
            // but throw for subsequent calls (e.g., fetching a category's content)
            if (response.status === 404 && path !== pagesFolder) {
                 console.warn(`Directory not found: ${apiUrl}`);
                 return []; // Return empty array if a sub-directory isn't found
            }
            // Handle common errors for the initial fetch (or any fetch)
            if (response.status === 404 && path === pagesFolder) {
                console.warn(`Configured 'pagesFolder' ("${pagesFolder || 'Repo Root'}") not found at ${apiUrl}.`);
                throw { error: true, status: 404, message: `Project folder ('${pagesFolder || 'Repo Root'}') not found in repo '${githubOwner}/${githubRepo}'. Check 'pagesFolder' in config.js and your repository structure.` };
            } else if (response.status === 403) {
                 console.warn(`Rate limit exceeded or private repo? URL: ${apiUrl}`);
                 throw { error: true, status: 403, message: 'GitHub API rate limit likely exceeded or repository is private. Try again later or check repository permissions.' };
            } else {
                // Throw for other errors
                throw new Error(`GitHub API Error: ${response.status} - ${response.statusText} for path ${path}`);
            }
        }
        const items = await response.json();
        // Ensure items is an array
        return Array.isArray(items) ? items : [items];
    } catch (error) {
         // Re-throw specific error objects or wrap generic errors
         if (error.error) throw error; // Re-throw specific error objects
         console.error(`Error fetching directory ${path}:`, error);
         throw new Error(`Failed to fetch directory contents for '${path}'. ${error.message}`);
    }
}


/**
 * Generates a user-friendly name from an ID (e.g., "proj.my-project" -> "My Project").
 * @param {string} id - The project or category ID.
 * @param {string} type - 'project' or 'category'.
 * @returns {string} The formatted name.
 */
function formatName(id, type) {
    const prefix = type === 'project' ? 'proj.' : 'cat.';
    return id.substring(prefix.length)
             .replace(/[-_]/g, ' ')
             .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
}

/**
 * Generates the client-side route path for a project.
 * @param {string} projectPath - The full path from the repo root (e.g., "pages/cat.art/proj.color").
 * @returns {string} The route path (e.g., "/wobble/art/color").
 */
function generateRoutePath(projectPath) {
    // Remove the base 'pages/' folder and the 'proj.'/'cat.' prefixes from segments
    const parts = projectPath.substring(pagesFolder.length + 1).split('/'); // +1 for the '/'
    const routeSegments = parts.map(part => {
        if (part.startsWith('proj.') || part.startsWith('cat.')) {
            return part.substring(part.indexOf('.') + 1);
        }
        return part; // Should not happen if structure is correct
    });
    // Ensure base path ends with '/' if it's not just '/'
    const normalizedBasePath = basePath === '/' ? '/' : (basePath.endsWith('/') ? basePath : basePath + '/');
    return normalizedBasePath + routeSegments.join('/');
}


/**
 * Fetches the list of projects and categories from the specified pages folder.
 * Handles nested categories.
 * @returns {Promise<Array>} A promise that resolves to a hierarchical array of project/category objects or an error object.
 * @throws {Error} If a non-404/403 network or API error occurs during the initial fetch.
 */
export async function fetchProjects() {
    console.log('Fetching projects and categories from GitHub API...');
    let navStructure = [];

    try {
        // Fetch top-level items in the pagesFolder
        const topLevelItems = await fetchDirectoryContents(pagesFolder);

        // Process top-level items concurrently
        const processingPromises = topLevelItems.map(async (item) => {
            if (item.type === 'dir') {
                if (item.name.startsWith('proj.')) {
                    // Top-level project
                    return {
                        type: 'project',
                        id: item.name,
                        name: formatName(item.name, 'project'),
                        path: item.path, // Full path like 'pages/proj.my-project'
                        url: item.url,
                        routePath: generateRoutePath(item.path) // e.g., /wobble/my-project
                    };
                } else if (item.name.startsWith('cat.')) {
                    // Category folder - fetch its contents
                    console.log(`Found category: ${item.name}, fetching contents...`);
                    const categoryItems = await fetchDirectoryContents(item.path);
                    const categoryProjects = categoryItems
                        .filter(subItem => subItem.type === 'dir' && subItem.name.startsWith('proj.'))
                        .map(projItem => ({
                            type: 'project',
                            id: projItem.name,
                            name: formatName(projItem.name, 'project'),
                            path: projItem.path, // Full path like 'pages/cat.art/proj.color'
                            url: projItem.url,
                            routePath: generateRoutePath(projItem.path) // e.g., /wobble/art/color
                        }))
                        .sort((a, b) => a.name.localeCompare(b.name)); // Sort projects within category

                    if (categoryProjects.length > 0) {
                        return {
                            type: 'category',
                            id: item.name,
                            name: formatName(item.name, 'category'),
                            projects: categoryProjects
                        };
                    } else {
                         console.log(`Category ${item.name} has no 'proj.' subfolders.`);
                         return null; // Skip empty categories
                    }
                }
            }
            return null; // Ignore files and non-prefixed folders at top level
        });

        // Wait for all processing to complete
        const results = await Promise.all(processingPromises);

        // Filter out null results (non-project/non-category items, empty categories)
        navStructure = results.filter(item => item !== null);

        // Sort top-level items (categories and projects mixed)
        navStructure.sort((a, b) => a.name.localeCompare(b.name));

        console.log('Navigation structure:', navStructure);

    } catch (error) {
        // Catch specific errors thrown by fetchDirectoryContents or other errors
        if (error.error) {
             console.error('Error fetching projects:', error.message);
             return error; // Return the specific error object { error: true, status?, message }
        } else {
             console.error('Unexpected error fetching projects:', error);
             return { error: true, message: `Failed to fetch projects. ${error.message}` };
        }
    }
    return navStructure; // Return the hierarchical structure
}


/**
 * Fetches the content of a specific project directory.
 * Looks for standard files like index.html, README.md.
 * @param {string} projectPath - The full path to the project folder from the repo root (e.g., 'pages/cat.art/proj.color').
 * @returns {Promise<object>} A promise that resolves to a content object { type: 'html'|'markdown'|'empty'|'error', data/url: string }.
 */
export async function fetchProjectContent(projectPath) {
    console.log(`Fetching content for project path: ${projectPath}`);
    let content = { type: 'empty', data: 'No suitable content file found (index.html or README.md).' };

    try {
        // Fetch directory contents for the specific project path
        const projectItems = await fetchDirectoryContents(projectPath);

        // Prioritize index.html
        const indexHtml = projectItems.find(item => item.name.toLowerCase() === 'index.html' && item.type === 'file');
        if (indexHtml) {
            console.log('Found index.html');
            // Construct the relative URL path for serving via iframe src
            // Path needs to be relative to the *application root* (index.html/404.html)
            const relativeUrl = `./${indexHtml.path}`; // e.g., ./pages/cat.art/proj.color/index.html
            content = { type: 'html', url: relativeUrl };
            console.log(`index.html relative URL for iframe: ${content.url}`);
            return content;
        }

        // Fallback to README.md
        const readmeMd = projectItems.find(item => item.name.toLowerCase() === 'readme.md' && item.type === 'file');
        if (readmeMd) {
            console.log('Found README.md, fetching content...');
            // Fetching raw content using download_url
            const readmeResponse = await fetch(readmeMd.download_url);
            if (!readmeResponse.ok) throw new Error(`Failed to download README.md from ${readmeMd.download_url} - Status: ${readmeResponse.status}`);
            const markdown = await readmeResponse.text();

            // Dynamically import marked only when needed
            const { marked } = await import('marked');
            const html = marked(markdown); // Convert markdown to HTML

            content = { type: 'markdown', data: html };
            console.log('README.md processed.');
            return content;
        }

        console.log('No index.html or README.md found in', projectPath);

    } catch (error) {
         // Check if it's one of our specific error objects from fetchDirectoryContents
         if (error.error) {
              console.error(`Error fetching content for ${projectPath}:`, error.message);
              content = { type: 'error', data: `Error loading project content for '${projectPath}'. ${error.message}` };
         } else {
            // Generic error
             console.error(`Unexpected error fetching content for ${projectPath}:`, error);
             content = { type: 'error', data: `Error loading project content for '${projectPath}'. ${error.message}` };
         }
    }

    return content;
}