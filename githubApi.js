// githubApi.js
// Fetches project structure from a text file and project content using raw GitHub URLs.

import { githubRawBaseUrl, projectsListFile } from './config.js';

/**
 * Fetches text content from a raw GitHub URL.
 * @param {string} relativePath - The path relative to the repository root (e.g., 'config/project_paths.txt').
 * @returns {Promise<{status: number, text: string | null, error?: string}>} Result object.
 */
async function fetchRawFileContent(relativePath) {
    const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
    const url = githubRawBaseUrl + encodedPath;
    console.log(`Fetching raw content from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Raw file not found at ${url}`);
                return { status: 404, text: null, error: `File not found: ${relativePath}` };
            } else {
                throw new Error(`GitHub Raw Content Error: ${response.status} - ${response.statusText}`);
            }
        }
        const text = await response.text();
        return { status: response.status, text: text };
    } catch (error) {
        console.error(`Error fetching raw file content for path "${relativePath}":`, error);
        return { status: 0, text: null, error: `Failed to fetch raw file '${relativePath}'. ${error.message}` };
    }
}

/**
 * Parses a directory/file path string to extract structure information.
 * @param {string} pathStr - The full path string (e.g., 'pages/cat.Category/proj.Project').
 * @returns {object | null} Object with name, type ('project' or 'category'), userFriendlyName, and fullPath, or null if invalid.
 */
function parsePathSegment(pathStr) {
    const parts = pathStr.split('/');
    const lastPart = parts[parts.length - 1];

    if (lastPart.startsWith('proj.')) {
        const name = lastPart.substring(5);
        return {
            id: lastPart, // Unique ID is the folder name
            type: 'project',
            name: name.replace(/[-_]/g, ' '),
            path: pathStr,
        };
    } else if (lastPart.startsWith('cat.')) {
        const name = lastPart.substring(4);
        return {
            id: lastPart, // Unique ID is the folder name
            type: 'category',
            name: name.replace(/[-_]/g, ' '),
            path: pathStr,
        };
    }
    return null; // Not a valid project or category segment
}


/**
 * Builds the hierarchical project/category structure from a flat list of project paths.
 * @param {string[]} projectPaths - Array of valid project paths (e.g., ['pages/proj.A', 'pages/cat.B/proj.C']).
 * @returns {Array} The nested structure [{ type: 'project'|'category', name: ..., id: ..., path: ..., children?: [...] }].
 */
function buildStructureFromPaths(projectPaths) {
    const structureMap = new Map(); // Stores categories and top-level projects, keyed by path
    const rootItems = []; // Final top-level structure

    // Add implicit root node to simplify logic
    structureMap.set('', { type: 'root', path: '', children: rootItems });

    projectPaths.forEach(projectPath => {
        const pathSegments = projectPath.split('/');
        let currentPath = '';
        let parentNode = structureMap.get(''); // Start with root

        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            const segmentPath = currentPath ? `${currentPath}/${segment}` : segment;
            const parsedSegment = parsePathSegment(segmentPath);

            if (!parsedSegment) {
                 console.warn(`Skipping invalid segment "${segment}" in path "${projectPath}"`);
                 currentPath = segmentPath; // Still update currentPath to process next segment correctly
                 continue; // Skip segments that aren't proj. or cat.
            }

            let currentNode = structureMap.get(segmentPath);

            if (!currentNode) {
                // Node doesn't exist, create it
                currentNode = {
                    type: parsedSegment.type,
                    id: parsedSegment.id,
                    name: parsedSegment.name,
                    path: segmentPath,
                };
                if (parsedSegment.type === 'category') {
                    currentNode.children = []; // Categories have children
                }
                structureMap.set(segmentPath, currentNode);

                // Add to parent's children array
                if (parentNode && parentNode.children) {
                    parentNode.children.push(currentNode);
                } else {
                    // Should only happen if parent is somehow missing or not a category/root
                    console.error(`Could not find valid parent for path: ${segmentPath}`);
                    return; // Stop processing this path
                }
            }

            // Update parent for the next iteration
            parentNode = currentNode;
            currentPath = segmentPath;
        }
    });

    // Sort children within each category and the root level
    structureMap.forEach(node => {
        if (node.children) {
            node.children.sort((a, b) => a.name.localeCompare(b.name));
        }
    });

    console.log("Built structure map:", structureMap);
    console.log("Final root items:", rootItems);

    return rootItems; // Return the children of the implicit root node
}


/**
 * Fetches the list of project paths from the config file and builds the structure.
 * @returns {Promise<Array|object>} A promise that resolves to an array of project/category objects or an error object.
 */
export async function fetchProjects() {
    console.log(`Fetching project list from: ${projectsListFile}`);
    const fileContentResult = await fetchRawFileContent(projectsListFile);

    if (fileContentResult.error) {
        // Customize error message for project list file
        let message = fileContentResult.error;
        if (fileContentResult.status === 404) {
             message = `Project list file ('${projectsListFile}') not found. Please create it in your repository and ensure the path in config.js is correct.`;
        } else if (fileContentResult.status === 0) {
             message = `Network error or CORS issue fetching '${projectsListFile}'. Check network connection and repository permissions.`;
        }
        return { error: true, status: fileContentResult.status, message: message };
    }
    if (fileContentResult.text === null || fileContentResult.text.trim() === '') {
        console.warn(`Project list file '${projectsListFile}' is empty or could not be read.`);
        return []; // Return empty array if file is empty
    }

    const lines = fileContentResult.text.split('\n');
    const projectPaths = lines
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Filter empty lines and comments
        .filter(line => line.includes('/proj.')); // Ensure path points to a project folder

     if (projectPaths.length === 0) {
          console.warn(`No valid project paths found in '${projectsListFile}'. Ensure paths point to 'proj.*' folders.`);
     }

    try {
        const structure = buildStructureFromPaths(projectPaths);
        console.log('Projects structure built:', structure);
        return structure;
    } catch (error) {
        console.error('Error building structure from paths:', error);
        return { error: true, message: `Failed to build project structure from '${projectsListFile}'. ${error.message}` };
    }
}


/**
 * Fetches the content of a specific project directory using raw URLs.
 * Looks for index.html, then README.md.
 * @param {string} projectPath - The full path to the project folder from the repo root (e.g., 'pages/cat.Data/proj.viewer').
 * @returns {Promise<object>} A promise resolving to { type: 'html'|'markdown'|'empty'|'error', data/url: string }.
 */
export async function fetchProjectContent(projectPath) {
    console.log(`Fetching content for project path: ${projectPath}`);
    let content = { type: 'empty', data: `No suitable content file found in '${projectPath}' (checked for index.html, README.md).` };

    // --- 1. Check for index.html ---
    const indexHtmlPath = `${projectPath}/index.html`;
    const indexHtmlResult = await fetchRawFileContent(indexHtmlPath);

    if (indexHtmlResult.status === 200) {
        console.log(`Found index.html at: ${indexHtmlPath}`);
        // IMPORTANT: Return a *relative* URL for the iframe src, resolved from the base path.
        content = { type: 'html', url: `./${indexHtmlPath}` };
        return content;
    } else if (indexHtmlResult.status !== 404) {
        // Log error but continue to check for README.md
        console.error(`Error checking for index.html: ${indexHtmlResult.error || indexHtmlResult.status}`);
    }

    // --- 2. Check for README.md (if index.html not found) ---
    const readmeMdPath = `${projectPath}/README.md`;
    const readmeMdResult = await fetchRawFileContent(readmeMdPath);

    if (readmeMdResult.status === 200 && readmeMdResult.text !== null) {
         console.log(`Found README.md at: ${readmeMdPath}, processing...`);
        try {
            // Dynamically import marked only when needed
            const { marked } = await import('marked');
            const html = marked.parse(readmeMdResult.text);
            content = { type: 'markdown', data: html };
            console.log('README.md processed.');
            return content;
        } catch (parseError) {
            console.error(`Error parsing Markdown for ${readmeMdPath}:`, parseError);
             content = { type: 'error', data: `Error parsing README.md for '${projectPath}'. ${parseError.message}` };
             return content;
        }
    } else if (readmeMdResult.status !== 404) {
        console.error(`Error checking for README.md: ${readmeMdResult.error || readmeMdResult.status}`);
        // If index.html also failed with non-404, report the README error preferentially
        if(indexHtmlResult.status !== 404) {
             content = { type: 'error', data: `Error loading project content for '${projectPath}'. Failed to check for README.md: ${readmeMdResult.error || readmeMdResult.status}` };
        } else {
             content = { type: 'error', data: `Error loading project content for '${projectPath}'. Failed to check for index.html: ${indexHtmlResult.error || indexHtmlResult.status}` };
        }
         return content;
    } else if (readmeMdResult.status === 404 && indexHtmlResult.status === 404) {
         // Both are 404, return the 'empty' message set initially.
         console.log(`Neither index.html nor README.md found in ${projectPath}`);
    }

    // If we reach here, it means either both were 404 (content is 'empty')
    // or there was a fetch error for one/both (content is 'error')
    return content;
}