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
 * Parses a single directory/file name segment (e.g., "proj.MyProject" or "cat.MyCategory")
 * and derives type, id, and display name.
 * @param {string} segmentName - The name of the segment (e.g., "proj.MyProject").
 * @returns {object | null} Object with id, type, name, or null if not a valid segment.
 */
function parseSegmentName(segmentName) {
    if (segmentName.startsWith('proj.')) {
        const name = segmentName.substring(5);
        return {
            id: segmentName, // Unique ID is the folder name
            type: 'project',
            name: name.replace(/[-_]/g, ' '),
        };
    } else if (segmentName.startsWith('cat.')) {
        const name = segmentName.substring(4);
        return {
            id: segmentName, // Unique ID is the folder name
            type: 'category',
            name: name.replace(/[-_]/g, ' '),
        };
    }
    return null;
}

/**
 * Builds the hierarchical project/category structure from a flat list of project paths.
 * Each path in projectPaths is assumed to point to a project folder (ending in proj.*).
 * Categories are inferred from the path structure.
 * @param {string[]} projectPaths - Array of valid project paths (e.g., ['pages/cat.B/proj.C', 'pages/cat.A/cat.D/proj.E']).
 * @returns {Array} The nested structure [{ type: 'project'|'category', name: ..., id: ..., path: ..., children?: [...] }].
 */
function buildStructureFromPaths(projectPaths) {
    const rootItems = [];
    const structureMap = new Map(); // Maps full path of a category to its node object
    structureMap.set('', { type: 'root', path: '', children: rootItems, id: 'root', name: 'Root' });

    projectPaths.forEach(fullProjectPath => {
        // Example: "pages/cat.TravelPerks/cat.Design/proj.list-cleaning"
        const segments = fullProjectPath.split('/'); // ["pages", "cat.TravelPerks", "cat.Design", "proj.list-cleaning"]
        let currentParentNode = structureMap.get('');
        let currentPathAccumulator = "";

        for (let i = 0; i < segments.length; i++) {
            const segmentName = segments[i];
            const isLastSegment = (i === segments.length - 1);
            const previousPathAccumulator = currentPathAccumulator; // Path of parent
            currentPathAccumulator = currentPathAccumulator ? `${currentPathAccumulator}/${segmentName}` : segmentName;

            // Segments like 'pages' are ignored for node creation unless explicitly a cat. or proj.
            if (!segmentName.startsWith('cat.') && !segmentName.startsWith('proj.')) {
                // If "pages" is encountered, and we have existing mapped node for "pages", use it as parent.
                // Otherwise currentParentNode remains (e.g. root for "pages/cat.A")
                if (structureMap.has(currentPathAccumulator)) {
                     currentParentNode = structureMap.get(currentPathAccumulator);
                }
                // else currentParentNode from previous iteration is correct.
                continue; // Move to next segment
            }

            const parsedData = parseSegmentName(segmentName);
            if (!parsedData) continue; // Should not happen if check above is correct

            let currentNode = structureMap.get(currentPathAccumulator);

            if (!currentNode) { // Node doesn't exist, create it
                if (parsedData.type === 'project') {
                    if (!isLastSegment) {
                        console.warn(`Project segment "${segmentName}" found mid-path in "${fullProjectPath}". Projects must be leaf nodes. Skipping subsequent parts.`);
                        // Add project and stop processing this path further for nesting
                         currentNode = { ...parsedData, path: fullProjectPath };
                         structureMap.set(currentPathAccumulator, currentNode);
                         if (currentParentNode && currentParentNode.children && !currentParentNode.children.some(child => child.id === currentNode.id)) {
                            currentParentNode.children.push(currentNode);
                         }
                        break; // Stop processing segments for this projectPath
                    }
                    currentNode = {
                        ...parsedData,
                        path: fullProjectPath // Full path to the project directory itself
                    };
                } else if (parsedData.type === 'category') {
                    currentNode = {
                        ...parsedData,
                        path: currentPathAccumulator, // Path to this category directory
                        children: []
                    };
                }
                structureMap.set(currentPathAccumulator, currentNode);

                // Link to parent
                 if (currentParentNode && currentParentNode.children && !currentParentNode.children.some(child => child.id === currentNode.id)) {
                    currentParentNode.children.push(currentNode);
                } else if (!currentParentNode || !currentParentNode.children) {
                     console.error("Error: Parent node or parent's children array is undefined for path segment:", currentPathAccumulator, "Parent was:", currentParentNode);
                     break; // Critical error in path logic
                }
            }
            currentParentNode = currentNode; // The new node becomes parent for next segment
        }
    });

    function sortRecursive(items) {
        items.sort((a, b) => {
            if (a.type === 'category' && b.type === 'project') return -1;
            if (a.type === 'project' && b.type === 'category') return 1;
            return a.name.localeCompare(b.name);
        });
        items.forEach(item => {
            if (item.type === 'category' && item.children) {
                sortRecursive(item.children);
            }
        });
    }
    sortRecursive(rootItems);
    console.log('Built projects structure:', rootItems);
    return rootItems;
}

export async function fetchProjects() {
    console.log(`Fetching project list from: ${projectsListFile}`);
    const fileContentResult = await fetchRawFileContent(projectsListFile);

    if (fileContentResult.error) {
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
        return [];
    }

    const lines = fileContentResult.text.split('\n');
    const projectPaths = lines
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .filter(line => line.split('/').pop().startsWith('proj.'));

     if (projectPaths.length === 0) {
          console.warn(`No valid project paths found in '${projectsListFile}'. Ensure paths point to 'proj.*' folders (e.g., pages/cat.A/proj.B).`);
     }

    try {
        const structure = buildStructureFromPaths(projectPaths);
        return structure;
    } catch (error) {
        console.error('Error building structure from paths:', error);
        return { error: true, message: `Failed to build project structure from '${projectsListFile}'. ${error.message}` };
    }
}

export async function fetchProjectContent(projectPath) {
    console.log(`Fetching content for project path: ${projectPath}`);
    let content = { type: 'empty', data: `No suitable content file found in '${projectPath}' (checked for index.html, README.md).` };

    const indexHtmlPath = `${projectPath}/index.html`;
    const indexHtmlResult = await fetchRawFileContent(indexHtmlPath);

    if (indexHtmlResult.status === 200) {
        console.log(`Found index.html at: ${indexHtmlPath}`);
        content = { type: 'html', url: `./${indexHtmlPath}` };
        return content;
    } else if (indexHtmlResult.status !== 404) {
        console.error(`Error checking for index.html: ${indexHtmlResult.error || indexHtmlResult.status}`);
    }

    const readmeMdPath = `${projectPath}/README.md`;
    const readmeMdResult = await fetchRawFileContent(readmeMdPath);

    if (readmeMdResult.status === 200 && readmeMdResult.text !== null) {
         console.log(`Found README.md at: ${readmeMdPath}, processing...`);
        try {
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
        // If index.html also failed with non-404, and it wasn't successful (200)
        if(indexHtmlResult.status !== 404 && indexHtmlResult.status !== 200) {
             content = { type: 'error', data: `Error loading project content for '${projectPath}'. Failed to check for index.html: ${indexHtmlResult.error || indexHtmlResult.status}` };
        } else {
             content = { type: 'error', data: `Error loading project content for '${projectPath}'. Failed to check for README.md: ${readmeMdResult.error || readmeMdResult.status}` };
        }
         return content;
    } else if (readmeMdResult.status === 404 && indexHtmlResult.status === 404) {
         // Both are 404, return the 'empty' message set initially.
         console.log(`Neither index.html nor README.md found in ${projectPath}`);
    }
    return content;
}