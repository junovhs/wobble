// githubApi.js
// Handles interactions with the GitHub API

import { githubOwner, githubRepo, pagesFolder } from './config.js';

const GITHUB_API_BASE = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/`;
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Recursively fetches directory contents from the GitHub API.
 * @param {string} path - The API path to fetch (relative to repo root).
 * @returns {Promise<Array|object>} Array of items or error object.
 */
async function fetchDirectoryContents(path) {
    const apiUrl = GITHUB_API_BASE + path;
    console.log(`Fetching directory contents from: ${apiUrl}`);
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Directory not found at ${apiUrl}.`);
                return { error: true, status: 404, message: `Folder ('${path}') not found.` };
            } else if (response.status === 403) {
                console.warn(`Rate limit exceeded or private repo? URL: ${apiUrl}`);
                return { error: true, status: 403, message: 'GitHub API rate limit likely exceeded or repository is private.' };
            } else {
                throw new Error(`GitHub API Error: ${response.status} - ${response.statusText}`);
            }
        }
        const items = await response.json();
        // Ensure items is an array (API returns object for single file, array for directory)
        return Array.isArray(items) ? items : [items];
    } catch (error) {
        console.error(`Error fetching directory contents for path "${path}":`, error);
        return { error: true, message: `Failed to fetch contents for '${path}'. ${error.message}` };
    }
}

/**
 * Processes fetched items, identifying projects and categories, and recursively fetching categories.
 * @param {Array} items - Array of file/directory items from GitHub API.
 * @param {string} currentPath - The path prefix for these items (e.g., 'pages' or 'pages/cat.art').
 * @returns {Promise<Array>} A promise resolving to an array of processed project/category objects.
 */
async function processDirectoryItems(items, currentPath) {
    const processedItems = [];

    for (const item of items) {
        if (item.type === 'dir') {
            if (item.name.startsWith('proj.')) {
                // It's a project directory
                processedItems.push({
                    type: 'project',
                    id: item.name, // Use the full folder name as ID
                    name: item.name.substring(5).replace(/[-_]/g, ' '), // User-friendly name
                    path: item.path, // Full path from repo root
                    url: item.url // API URL for the directory contents
                });
            } else if (item.name.startsWith('cat.')) {
                // It's a category directory, fetch its contents recursively
                console.log(`Found category: ${item.name}, fetching contents...`);
                const categoryPath = item.path;
                const categoryContents = await fetchDirectoryContents(categoryPath);

                if (categoryContents.error) {
                     console.warn(`Skipping category '${item.name}' due to fetch error: ${categoryContents.message}`);
                     // Optionally add an error node or just skip
                     continue;
                }

                 const children = await processDirectoryItems(categoryContents, categoryPath);
                 // Only add category if it has children (projects or sub-categories)
                 if (children.length > 0) {
                     processedItems.push({
                         type: 'category',
                         id: item.name,
                         name: item.name.substring(4).replace(/[-_]/g, ' '),
                         path: item.path,
                         children: children.sort((a, b) => a.name.localeCompare(b.name)) // Sort children
                     });
                 } else {
                    console.log(`Category '${item.name}' is empty or contains no valid projects/subcategories. Skipping.`);
                 }
            }
            // Ignore other directories not starting with proj. or cat.
        }
        // Ignore files at the root of 'pages' or within category folders unless needed later
    }
    return processedItems;
}

/**
 * Fetches the list of projects and categories from the specified pages folder.
 * Structures the result hierarchically based on `cat.` folders.
 * @returns {Promise<Array|object>} A promise that resolves to an array of project/category objects or an error object.
 */
export async function fetchProjects() {
    console.log('Fetching projects and categories from GitHub API...');
    const rootPath = pagesFolder || ''; // Use pagesFolder or repo root
    const initialItems = await fetchDirectoryContents(rootPath);

    // Handle initial fetch errors (e.g., pagesFolder not found, rate limit)
    if (initialItems.error) {
        // Add specific message for 404 on the root folder fetch
        if (initialItems.status === 404) {
            initialItems.message = `Configured 'pagesFolder' ("${pagesFolder || 'Repo Root'}") not found in repo '${githubOwner}/${githubRepo}'. Check 'pagesFolder' in config.js and your repository structure.`;
        }
        return initialItems; // Return the error object
    }

    try {
        const structuredItems = await processDirectoryItems(initialItems, rootPath);
        // Sort top-level items alphabetically by name
        structuredItems.sort((a, b) => a.name.localeCompare(b.name));
        console.log('Projects and categories structured:', structuredItems);
        return structuredItems;
    } catch (error) {
         console.error('Error processing directory items:', error);
         return { error: true, message: `Failed to process project structure. ${error.message}` };
    }
}

/**
 * Fetches the content of a specific project directory.
 * Looks for standard files like index.html, README.md.
 * @param {string} projectPath - The full path to the project folder from the repo root.
 * @returns {Promise<object>} A promise that resolves to a content object { type: 'html'|'markdown'|'empty'|'error', data/url: string }.
 */
export async function fetchProjectContent(projectPath) {
    console.log(`Fetching content for project path: ${projectPath}`);
    const apiUrl = GITHUB_API_BASE + projectPath;
    let content = { type: 'empty', data: 'No suitable content file found (index.html or README.md).' };

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`GitHub API Error: ${response.status} fetching directory ${projectPath}`);
        const items = await response.json();

        // Ensure items is an array
        const directoryItems = Array.isArray(items) ? items : [items];

        // Prioritize index.html
        const indexHtml = directoryItems.find(item => item.name.toLowerCase() === 'index.html' && item.type === 'file');
        if (indexHtml) {
             console.log('Found index.html');
            // Construct the relative URL path for serving
            content = { type: 'html', url: `./${indexHtml.path}` };

             console.log(`index.html relative URL: ${content.url}`);
             return content;
        }

        // Fallback to README.md
        const readmeMd = directoryItems.find(item => item.name.toLowerCase() === 'readme.md' && item.type === 'file');
        if (readmeMd) {
            console.log('Found README.md, fetching content...');
            // Import marked dynamically only when needed
            const { marked } = await import('marked');
            const readmeResponse = await fetch(readmeMd.download_url);
            if (!readmeResponse.ok) throw new Error(`Failed to download README.md from ${readmeMd.download_url} - Status: ${readmeResponse.status}`);
            const markdown = await readmeResponse.text();
            const html = marked.parse(markdown); // Use marked.parse
            content = { type: 'markdown', data: html };
            console.log('README.md processed.');
            return content;
        }

         console.log('No index.html or README.md found in', projectPath);


    } catch (error) {
        console.error(`Error fetching content for ${projectPath}:`, error);
        content = { type: 'error', data: `Error loading project content for '${projectPath}'. ${error.message}` };
    }

    return content;
}