import { elements } from './main.js';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';

// Process a directory entry recursively and build directory data structure
export async function processDirectoryEntryRecursive(dirEntry, currentPath, depth, parentAggregator = null) {
    try {
        const reader = dirEntry.createReader();
        let entries = [];
        let readEntries = await new Promise((res, rej) => reader.readEntries(res, rej));
        while (readEntries.length > 0) {
            entries = entries.concat(readEntries);
            readEntries = await new Promise((res, rej) => reader.readEntries(res, rej));
        }

        const dirData = { 
            name: dirEntry.name, 
            path: currentPath, 
            type: 'folder', 
            depth, 
            children: [], 
            fileCount: 0, 
            dirCount: 0, 
            totalSize: 0, 
            fileTypes: {}, 
            entryHandle: dirEntry 
        };
        
        let aggregator = parentAggregator || { 
            allFilesList: [], 
            allFoldersList: [], 
            maxDepth: depth, 
            deepestPathExample: currentPath, 
            emptyDirCount: 0 
        };
        
        if (depth > aggregator.maxDepth) { 
            aggregator.maxDepth = depth; 
            aggregator.deepestPathExample = currentPath; 
        }
        
        if (entries.length === 0 && depth > 0) aggregator.emptyDirCount++;
        aggregator.allFoldersList.push({ name: dirData.name, path: dirData.path, entryHandle: dirData.entryHandle });

        for (const entry of entries) {
            const entryPath = `${currentPath}/${entry.name}`;
            if (entry.isFile) {
                try {
                    const file = await new Promise((res, rej) => entry.file(res, rej));
                    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '(no ext)';
                    const fileInfo = { 
                        name: file.name, 
                        type: 'file', 
                        size: file.size, 
                        path: entryPath, 
                        extension: ext, 
                        depth: depth + 1, 
                        entryHandle: entry 
                    };
                    dirData.children.push(fileInfo);
                    dirData.fileCount++;
                    dirData.totalSize += file.size;
                    aggregator.allFilesList.push({ 
                        name: file.name, 
                        path: entryPath, 
                        size: file.size, 
                        extension: ext, 
                        entryHandle: entry 
                    });
                    if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                    dirData.fileTypes[ext].count++;
                    dirData.fileTypes[ext].size += file.size;
                } catch (err) {
                    console.warn(`Skipping file ${entry.name}: ${err.message}`);
                    // Don't throw here, just skip problematic files
                }
            } else if (entry.isDirectory) {
                try {
                    const subResults = await processDirectoryEntryRecursive(entry, entryPath, depth + 1, aggregator);
                    dirData.children.push(subResults.directoryData);
                    dirData.dirCount++;
                    dirData.fileCount += subResults.directoryData.fileCount;
                    dirData.dirCount += subResults.directoryData.dirCount;
                    dirData.totalSize += subResults.directoryData.totalSize;
                    Object.entries(subResults.directoryData.fileTypes).forEach(([ext, data]) => {
                        if (!dirData.fileTypes[ext]) dirData.fileTypes[ext] = { count: 0, size: 0 };
                        dirData.fileTypes[ext].count += data.count;
                        dirData.fileTypes[ext].size += data.size;
                    });
                } catch (err) {
                    console.warn(`Skipping directory ${entry.name}: ${err.message}`);
                    // Don't throw here, just skip problematic directories
                }
            }
        }
        return depth === 0 ? { directoryData: dirData, ...aggregator } : { directoryData: dirData };
    } catch (err) {
        // Enhance error with more context for better error reporting
        err.path = currentPath;
        throw err;
    }
}

// Filter scan data based on selected paths
export function filterScanData(fullData, selectedPathsSet) {
    if (!fullData || !fullData.directoryData) {
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }
    
    function filterNodeRecursive(node) {
        if (node.type === 'file') {
            return selectedPathsSet.has(node.path) ? { ...node } : null;
        }

        // It's a folder
        const filteredChildren = node.children
            .map(child => filterNodeRecursive(child))
            .filter(child => child !== null);

        // A folder is included if it's directly selected OR if it has any selected children
        if (!selectedPathsSet.has(node.path) && filteredChildren.length === 0) {
            return null;
        }

        const filteredFolder = { ...node, children: filteredChildren };
        // Recalculate stats for this filteredFolder
        filteredFolder.fileCount = 0;
        filteredFolder.dirCount = 0;
        filteredFolder.totalSize = 0;
        filteredFolder.fileTypes = {};
        filteredChildren.forEach(fc => {
            if (fc.type === 'file') {
                filteredFolder.fileCount++;
                filteredFolder.totalSize += fc.size;
                if (!filteredFolder.fileTypes[fc.extension]) filteredFolder.fileTypes[fc.extension] = { count: 0, size: 0 };
                filteredFolder.fileTypes[fc.extension].count++;
                filteredFolder.fileTypes[fc.extension].size += fc.size;
            } else { // folder
                filteredFolder.dirCount++;
                filteredFolder.dirCount += fc.dirCount;
                filteredFolder.fileCount += fc.fileCount;
                filteredFolder.totalSize += fc.totalSize;
                Object.entries(fc.fileTypes).forEach(([ext, data]) => {
                    if (!filteredFolder.fileTypes[ext]) filteredFolder.fileTypes[ext] = { count: 0, size: 0 };
                    filteredFolder.fileTypes[ext].count += data.count;
                    filteredFolder.fileTypes[ext].size += data.size;
                });
            }
        });
        return filteredFolder;
    }

    const filteredDirectoryData = filterNodeRecursive(fullData.directoryData);
    if (!filteredDirectoryData) { // Nothing selected
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }
    
    // Rebuild allFilesList and allFoldersList from the filteredDirectoryData
    const filteredAllFiles = [];
    const filteredAllFolders = [];
    function collectFiltered(node, filesArr, foldersArr) {
        if (!node) return;
        if (node.type === 'file') {
            filesArr.push({ ...node }); 
        } else { 
            foldersArr.push({ name: node.name, path: node.path, entryHandle: node.entryHandle });
            if (node.children) node.children.forEach(child => collectFiltered(child, filesArr, foldersArr));
        }
    }
    collectFiltered(filteredDirectoryData, filteredAllFiles, filteredAllFolders);

    return {
        directoryData: filteredDirectoryData,
        allFilesList: filteredAllFiles,
        allFoldersList: filteredAllFolders,
        // Aggregate stats like maxDepth, deepestPath are harder to correctly filter.
        // We'll use original fullScanData's for these or mark them.
        maxDepth: fullData.maxDepth,
        deepestPathExample: fullData.deepestPathExample,
        emptyDirCount: fullData.emptyDirCount // This also becomes less meaningful for a filtered view
    };
}

// Read file content for previewing
export async function readFileContent(fileEntry) { 
    try {
        if (fileEntry instanceof File) {
            // For files selected via input[type=file]
            return await fileEntry.text();
        } else {
            // For files from drag and drop webkitGetAsEntry
            return new Promise((resolve, reject) => {
                fileEntry.file(
                    async (fileObject) => { 
                        try {
                            const text = await fileObject.text();
                            resolve(text);
                        } catch (err) { reject(err); }
                    }, (err) => { reject(err); }
                );
            });
        }
    } catch (err) {
        err.path = fileEntry.name || fileEntry.fullPath;
        throw err;
    }
}

// Preview a file by showing its content in a modal
export async function previewFile(fileEntry) { 
    try {
        const content = await readFileContent(fileEntry); 
        elements.filePreviewTitle.textContent = `PREVIEW: ${fileEntry.fullPath || fileEntry.name}`;
        elements.filePreviewContent.textContent = content;
        elements.filePreview.style.display = 'block';
    } catch (err) {
        console.error(`Error previewing file ${fileEntry.name}:`, err);
        errorHandler.showError({
            name: "PreviewError",
            message: `Failed to preview file: ${fileEntry.name || fileEntry.fullPath}`,
            stack: err.stack,
            cause: err
        });
    }
}