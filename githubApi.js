// githubApi.js
// Handles interactions with the GitHub API

import { githubOwner, githubRepo, pagesFolder } from './config.js';

const GITHUB_API_BASE = `https://api.github.com/repos/${githubOwner}/${githubRepo}/contents/`;
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Fetches the list of projects (directories starting with PROJECT_PREFIX)
 * from the specified pages folder in the GitHub repository.
 * @returns {Promise<Array>} A promise that resolves to an array of project objects or an empty array on error.
 * @throws {Error} If a non-404/403 network or API error occurs.
 */
export async function fetchProjects() {
    console.log('Fetching projects from GitHub API...');
    let projectDirs = [];
    // Use pagesFolder directly if provided, otherwise fetch from root
    const apiUrl = pagesFolder ? GITHUB_API_BASE + pagesFolder : GITHUB_API_BASE;
    console.log(`Fetching directory contents from: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Configured 'pagesFolder' ("${pagesFolder || 'Repo Root'}") not found at ${apiUrl}.`);
                // Specific error object for UI handling
                return { error: true, status: 404, message: `Project folder ('${pagesFolder || 'Repo Root'}') not found in repo '${githubOwner}/${githubRepo}'. Check 'pagesFolder' in config.js and your repository structure.` };
            } else if (response.status === 403) {
                 console.warn(`Rate limit exceeded or private repo? URL: ${apiUrl}`);
                 // Specific error object for UI handling
                 return { error: true, status: 403, message: 'GitHub API rate limit likely exceeded or repository is private. Try again later or check repository permissions.' };
            }
             else {
                // Throw for other errors to be caught below
                throw new Error(`GitHub API Error: ${response.status} - ${response.statusText}`);
            }
        }
        const items = await response.json();

        // Ensure items is an array (API returns object for single file, array for directory)
        const directoryItems = Array.isArray(items) ? items : [items];

        // Filter for directories starting with the project prefix
        projectDirs = directoryItems
            .filter(item => item.type === 'dir' && item.name.startsWith('proj.'))
            .map(item => ({
                id: item.name, // Use the full folder name as ID
                name: item.name.substring(5).replace(/[-_]/g, ' '), // User-friendly name
                path: item.path, // Full path from repo root
                url: item.url // API URL for the directory contents
            }))
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

        console.log('Projects found:', projectDirs);

    } catch (error) {
        console.error('Error fetching projects:', error);
        // Return generic error object for other fetch issues
        return { error: true, message: `Failed to fetch projects. ${error.message}` };
    }
    return projectDirs; // Return the array of project objects
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
            const readmeResponse = await fetch(readmeMd.download_url);
            if (!readmeResponse.ok) throw new Error(`Failed to download README.md from ${readmeMd.download_url} - Status: ${readmeResponse.status}`);
            const markdown = await readmeResponse.text();
            const html = marked(markdown); 
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