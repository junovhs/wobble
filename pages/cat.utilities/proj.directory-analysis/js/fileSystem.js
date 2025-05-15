// --- FILE: js/fileSystem.js --- //
import { elements, appState } from './main.js'; // Added appState to use in readFileContent for new files
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';

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
                }
            }
        }
        return depth === 0 ? { directoryData: dirData, ...aggregator } : { directoryData: dirData };
    } catch (err) {
        err.path = currentPath;
        throw err;
    }
}

export function filterScanData(fullData, selectedPathsSet) {
    // ... (This function remains the same)
    if (!fullData || !fullData.directoryData) {
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }
    
    function filterNodeRecursive(node) {
        if (node.type === 'file') {
            return selectedPathsSet.has(node.path) ? { ...node } : null;
        }

        const filteredChildren = node.children
            .map(child => filterNodeRecursive(child))
            .filter(child => child !== null);

        if (!selectedPathsSet.has(node.path) && filteredChildren.length === 0) {
            return null;
        }

        const filteredFolder = { ...node, children: filteredChildren };
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
            } else { 
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
    if (!filteredDirectoryData) { 
        return { directoryData: null, allFilesList: [], allFoldersList: [], maxDepth: 0, deepestPathExample: '', emptyDirCount: 0 };
    }
    
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
        maxDepth: fullData.maxDepth,
        deepestPathExample: fullData.deepestPathExample,
        emptyDirCount: fullData.emptyDirCount 
    };
}

// Read file content for previewing or editing
export async function readFileContent(fileEntryOrHandle, filePathForEditedCheck = null) {
    const pathKey = filePathForEditedCheck || fileEntryOrHandle?.path || fileEntryOrHandle?.fullPath || fileEntryOrHandle?.name;

    try {
        // **HIGHEST PRIORITY**: If content is in fileEditor, always use that.
        // This includes newly created files (which won't have an entryHandle) and patched/edited files.
        if (pathKey && fileEditor.hasEditedContent(pathKey)) {
            return fileEditor.getEditedContent(pathKey);
        }

        // If not in fileEditor, then it must be an original file from scan, so entryHandle MUST exist.
        if (!fileEntryOrHandle) {
            // This case should ideally not be hit if called for a file that was *only* virtual,
            // as the check above should have caught it. This is a safeguard.
            throw new Error(`Invalid file entry or handle provided for '${pathKey}' (it's null/undefined and not in editor).`);
        }

        // Proceed to read from file system using the handle
        if (fileEntryOrHandle instanceof File) { // From <input type="file">
            return await fileEntryOrHandle.text();
        } else if (typeof fileEntryOrHandle.file === 'function') { // FileEntry from drag/drop or FileSystemFileHandle
            return new Promise((resolve, reject) => {
                fileEntryOrHandle.file(
                    async (fileObject) => {
                        try {
                            const text = await fileObject.text();
                            resolve(text);
                        } catch (err) { reject(err); }
                    },
                    (err) => { reject(err); }
                );
            });
        } else {
            // Should be caught by the !fileEntryOrHandle check above, but as an ultimate fallback.
            throw new Error("Unsupported file entry or handle type.");
        }
    } catch (err) {
        console.error(`Error in readFileContent for ${pathKey}:`, err);
        // Augment error with path if not already there.
        if (!err.path) err.path = pathKey;
        throw err; // Re-throw for higher-level handlers
    }
}

// Preview a file by showing its content in a modal
export async function previewFile(fileEntryOrHandle, filePathForEditedCheck = null) {
    const pathKey = filePathForEditedCheck || fileEntryOrHandle?.path || fileEntryOrHandle?.fullPath || fileEntryOrHandle?.name;
    const displayName = fileEntryOrHandle?.name || pathKey.substring(pathKey.lastIndexOf('/') + 1); // Get file name part for display
    try {
        // readFileContent will correctly prioritize fileEditor or use the handle
        const content = await readFileContent(fileEntryOrHandle, pathKey);
        elements.filePreviewTitle.textContent = `PREVIEW: ${displayName}`;
        elements.filePreviewContent.textContent = content;
        elements.filePreview.style.display = 'block';
    } catch (err) {
        console.error(`Error previewing file ${displayName}:`, err);
        errorHandler.showError({
            name: err.name || "PreviewError",
            message: `Failed to preview file: ${displayName}. ${err.message}`,
            stack: err.stack,
            cause: err
        });
    }
}
// --- ENDFILE: js/fileSystem.js --- //