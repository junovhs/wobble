// --- FILE: js/main.js --- //
import * as fileSystem from 'fileSystem';
import * as uiManager from 'uiManager';
import * as treeView from 'treeView';
import * as statsManager from 'statsManager';
import * as reportGenerator from 'reportGenerator';
import * as combineMode from 'combineMode';
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';
import * as fileEditor from 'fileEditor';
import * as aiPatcher from 'aiPatcher';
import * as zipManager from 'zipManager';

export const appState = {
    isCombineMode: false,
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false,
    processingInProgress: false,
    currentEditingFile: null,
    initialLoadComplete: false // New flag
};

export const elements = {
    pageLoader: document.getElementById('pageLoader'), // New page loader element
    dropZone: document.getElementById('dropZone'),
    folderInput: document.getElementById('folderInput'),
    treeContainer: document.getElementById('treeContainer'),
    globalStatsDiv: document.getElementById('globalStats'),
    selectionSummaryDiv: document.getElementById('selectionSummary'),
    fileTypeTableBody: document.querySelector('#fileTypeTable tbody'),
    mainContainer: document.querySelector('.main-container'),
    globalStatsPanel: document.getElementById('globalStatsPanel'),
    toolsContainer: document.getElementById('toolsContainer'),
    loader: document.getElementById('loader'), // This is the "ANALYSING SECTOR" text loader
    textOutputEl: document.getElementById('textOutput'),
    copyReportButton: document.getElementById('copyReportButton'),
    combineModePanel: document.getElementById('combineModePanel'),
    selectedFilesContainer: document.getElementById('selectedFilesContainer'),
    copySelectedBtn: document.getElementById('copySelectedBtn'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    deselectAllBtn: document.getElementById('deselectAllBtn'),
    commitSelectionsBtn: document.getElementById('commitSelectionsBtn'),
    viewModeToggleBtn: document.getElementById('viewModeToggleBtn'),
    expandAllBtn: document.getElementById('expandAllBtn'),
    collapseAllBtn: document.getElementById('collapseAllBtn'),
    downloadProjectBtn: document.getElementById('downloadProjectBtn'),
    filePreview: document.getElementById('filePreview'),
    filePreviewTitle: document.getElementById('filePreviewTitle'),
    filePreviewContent: document.getElementById('filePreviewContent'),
    closePreview: document.getElementById('closePreview'),
    textOutputContainerOuter: document.getElementById('textOutputContainerOuter'),
    notification: document.getElementById('notification'),
    errorReport: document.getElementById('errorReport'),
    fileEditor: document.getElementById('fileEditor'),
    editorFileTitle: document.getElementById('editorFileTitle'),
    editorContent: document.getElementById('editorContent'),
    saveEditorBtn: document.getElementById('saveEditorBtn'),
    closeEditorBtn: document.getElementById('closeEditorBtn'),
    editorStatus: document.getElementById('editorStatus'),
    editorInfo: document.getElementById('editorInfo'),
    aiPatchPanel: document.getElementById('aiPatchPanel'),
    aiPatchInput: document.getElementById('aiPatchInput'),
    applyAiPatchBtn: document.getElementById('applyAiPatchBtn'),
    aiPatchOutputLog: document.getElementById('aiPatchOutputLog'),
    aiPatchDiffModal: document.getElementById('aiPatchDiffModal'),
    diffFilePath: document.getElementById('diffFilePath'),
    diffOutputContainer: document.getElementById('diffOutputContainer'),
    closeAiPatchDiffModal: document.getElementById('closeAiPatchDiffModal'),
    confirmApplyPatchChanges: document.getElementById('confirmApplyPatchChanges'),
    skipPatchChanges: document.getElementById('skipPatchChanges'),
    cancelAllPatchChanges: document.getElementById('cancelAllPatchChanges'),
    mainActionDiv: document.getElementById('mainAction') // Add this for convenience
};

// --- (setupEventListeners, handleDragOver, handleDragLeave, handleFolderSelect, processSelectedFolderViaInput, createVirtualDirectoryFromFiles, getMaxDepth, getDeepestPath, countEmptyDirs, handleFileDrop remain the same for now) ---
// Paste the existing functions from your main.js here

function setupEventListeners() {
    // Drop zone
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.dropZone.addEventListener('click', () => elements.folderInput.click());
    elements.folderInput.addEventListener('change', handleFolderSelect);

    // Tool buttons
    elements.selectAllBtn.addEventListener('click', () => treeView.setAllSelections(true));
    elements.deselectAllBtn.addEventListener('click', () => treeView.setAllSelections(false));
    elements.commitSelectionsBtn.addEventListener('click', commitSelections);
    elements.viewModeToggleBtn.addEventListener('click', () => uiManager.setViewModeUI(!appState.isCombineMode));
    elements.downloadProjectBtn.addEventListener('click', zipManager.downloadProjectAsZip); 

    // Tree manipulation
    elements.expandAllBtn.addEventListener('click', () => treeView.toggleAllFolders(false));
    elements.collapseAllBtn.addEventListener('click', () => treeView.toggleAllFolders(true));

    // File preview
    elements.closePreview.addEventListener('click', () => {
        elements.filePreview.style.display = 'none';
        elements.filePreviewContent.textContent = '';
    });

    // Copy buttons
    elements.copyReportButton.addEventListener('click', copyReport);
    elements.copySelectedBtn.addEventListener('click', combineMode.copySelectedFiles);
}

function handleDragOver(e) { e.preventDefault(); elements.dropZone.classList.add('dragover'); }
function handleDragLeave() { elements.dropZone.classList.remove('dragover'); }

async function handleFolderSelect(event) {
    if (appState.processingInProgress) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const firstFileRelativePath = files[0].webkitRelativePath;
    const rootDirName = firstFileRelativePath.split('/')[0] || 'selected_folder';
    await processSelectedFolderViaInput(files, rootDirName);
    elements.folderInput.value = '';
}

async function processSelectedFolderViaInput(files, rootDirName) {
    resetUIForProcessing(`Processing '${rootDirName}'...`); // Updated loader message
    appState.processingInProgress = true;
    try {
        const virtualDirData = createVirtualDirectoryFromFiles(files, rootDirName);
        appState.fullScanData = virtualDirData;
        if (appState.fullScanData.directoryData) {
             treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        } else {
            throw new Error("Failed to construct directory data from selected files.");
        }

        const allInitiallySelectedPaths = new Set();
        if (appState.fullScanData.allFilesList) {
            appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
        }
        if (appState.fullScanData.allFoldersList) {
            appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));
        }
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
        appState.selectionCommitted = true;
        uiManager.refreshAllUI();
        enableUIControls();
        elements.mainContainer.style.display = 'flex';
        elements.globalStatsPanel.style.display = 'block';
        elements.toolsContainer.style.display = 'flex';
        elements.aiPatchPanel.style.display = 'block';
    } catch (err) {
        console.error("ERROR PROCESSING FOLDER INPUT:", err);
        errorHandler.showError(err);
        showFailedUI("Folder processing failed.");
    } finally {
        elements.loader.classList.remove('visible'); // Hide the text loader
        appState.processingInProgress = false;
    }
}

function createVirtualDirectoryFromFiles(fileList, rootName) {
    const root = {
        name: rootName, path: rootName, type: 'folder', depth: 0, children: [],
        fileCount: 0, dirCount: 0, totalSize: 0, fileTypes: {}, entryHandle: null
    };
    const allFilesList = [];
    const allFoldersList = [{ name: root.name, path: root.path, entryHandle: null }];
    const folderMap = new Map([[rootName, root]]);

    for (const file of fileList) {
        const pathParts = file.webkitRelativePath.split('/');
        const fileName = pathParts.pop();
        let currentParent = root;
        let currentPathForFolderConstruction = rootName;

        for (let i = 0; i < pathParts.length; i++) {
            const folderNamePart = pathParts[i];
             if (i === 0 && folderNamePart === rootName && pathParts.length > 1) continue; 
            if(pathParts.length === 1 && folderNamePart === rootName) { /* file directly in root dir */ }
            else {currentPathForFolderConstruction += '/' + folderNamePart;}

            if (!folderMap.has(currentPathForFolderConstruction)) {
                const newFolder = {
                    name: folderNamePart, path: currentPathForFolderConstruction, type: 'folder',
                    depth: i + 1, children: [], fileCount: 0, dirCount: 0, totalSize: 0,
                    fileTypes: {}, entryHandle: null 
                };
                folderMap.set(currentPathForFolderConstruction, newFolder);
                if (currentParent.path !== newFolder.path) {
                   currentParent.children.push(newFolder);
                }
                allFoldersList.push({ name: newFolder.name, path: newFolder.path, entryHandle: null });
                currentParent = newFolder;
            } else {
                currentParent = folderMap.get(currentPathForFolderConstruction);
            }
        }

        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase() : '(no ext)';
        const filePath = file.webkitRelativePath;
        const fileInfo = {
            name: fileName, type: 'file', size: file.size, path: filePath,
            extension: ext, depth: pathParts.length + 1, 
            entryHandle: file 
        };
        currentParent.children.push(fileInfo);
        allFilesList.push({ ...fileInfo });
    }

    function calculateFolderStats(folder) {
        folder.fileCount = 0; folder.dirCount = 0; folder.totalSize = 0; folder.fileTypes = {};
        for (const child of folder.children) {
            if (child.type === 'folder') {
                calculateFolderStats(child);
                folder.dirCount++; folder.dirCount += child.dirCount;
                folder.fileCount += child.fileCount; folder.totalSize += child.totalSize;
                Object.entries(child.fileTypes).forEach(([ext, data]) => {
                    if (!folder.fileTypes[ext]) folder.fileTypes[ext] = { count: 0, size: 0 };
                    folder.fileTypes[ext].count += data.count;
                    folder.fileTypes[ext].size += data.size;
                });
            } else {
                folder.fileCount++; folder.totalSize += child.size;
                if (!folder.fileTypes[child.extension]) folder.fileTypes[child.extension] = { count: 0, size: 0 };
                folder.fileTypes[child.extension].count++;
                folder.fileTypes[child.extension].size += child.size;
            }
        }
    }
    calculateFolderStats(root);

    return {
        directoryData: root, allFilesList, allFoldersList,
        maxDepth: getMaxDepth(root),
        deepestPathExample: getDeepestPath(root, root.name, {val:0, path:root.name}).path,
        emptyDirCount: countEmptyDirs(root)
    };
}

function getMaxDepth(node, currentDepth = 0) {
    if (!node) return currentDepth;
    node.depth = currentDepth; 
    let max = currentDepth;
    if (node.children) {
        for (const child of node.children) {
            max = Math.max(max, getMaxDepth(child, currentDepth + 1));
        }
    }
    return max;
}

function getDeepestPath(node, currentPathStr, maxDepthObj) {
    if (node.depth > maxDepthObj.val) { maxDepthObj.val = node.depth; maxDepthObj.path = currentPathStr; }
    if (node.children) {
        for (const child of node.children) { getDeepestPath(child, `${currentPathStr}/${child.name}`, maxDepthObj); }
    } return maxDepthObj;
}
function countEmptyDirs(node) {
    let count = 0;
    if (node.type === 'folder') {
        if (node.children.length === 0 && node.name !== appState.fullScanData?.directoryData.name) { 
            count = 1; 
        }
        else { for (const child of node.children) { count += countEmptyDirs(child); } }
    } return count;
}

async function handleFileDrop(event) {
    event.preventDefault();
    if (appState.processingInProgress) return;
    elements.dropZone.classList.remove('dragover');
    resetUIForProcessing("Processing dropped folder...");
    appState.processingInProgress = true;
    const items = event.dataTransfer.items;
    if (items && items.length) {
        const entry = items[0].webkitGetAsEntry();
        if (entry && entry.isDirectory) {
            try {
                appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(entry, entry.name, 0);
                if (appState.fullScanData.directoryData) { 
                     treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
                } else {
                     throw new Error("processDirectoryEntryRecursive failed to return directoryData.");
                }
                const allInitiallySelectedPaths = new Set();
                if(appState.fullScanData.allFilesList) appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
                if(appState.fullScanData.allFoldersList) appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));
                
                appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
                appState.selectionCommitted = true;
                uiManager.refreshAllUI(); enableUIControls();
                elements.mainContainer.style.display = 'flex';
                elements.globalStatsPanel.style.display = 'block';
                elements.toolsContainer.style.display = 'flex';
                elements.aiPatchPanel.style.display = 'block';
            } catch (err) {
                console.error("ERROR PROCESSING DIRECTORY (DROP):", err);
                errorHandler.showError(err);
                showFailedUI("Directory processing failed. Check console and error report.");
            } finally {
                elements.loader.classList.remove('visible'); // Hide text loader
                appState.processingInProgress = false;
            }
        } else {
            errorHandler.showError({ name: "InvalidTargetError", message: "Please drop a folder, not an individual file(s)." });
            elements.loader.classList.remove('visible'); // Hide text loader
            appState.processingInProgress = false;
        }
    } else {
        elements.loader.classList.remove('visible'); // Hide text loader
        appState.processingInProgress = false;
    }
}

function resetUIForProcessing(loaderMsg = "ANALYSING SECTOR... STAND BY...") {
    // Show the text loader for folder processing
    elements.loader.textContent = loaderMsg;
    elements.loader.classList.add('visible');

    // Hide main content areas used after scan
    elements.mainContainer.style.display = 'none';
    elements.globalStatsPanel.style.display = 'none';
    elements.toolsContainer.style.display = 'none';
    elements.aiPatchPanel.style.display = 'none';
    
    if(elements.aiPatchInput) elements.aiPatchInput.value = '';
    if(elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = 'Awaiting patch application...';
    if(elements.aiPatchDiffModal) elements.aiPatchDiffModal.style.display = 'none'; 
    if(elements.diffOutputContainer) elements.diffOutputContainer.innerHTML = '';

    elements.treeContainer.innerHTML = '';
    elements.globalStatsDiv.innerHTML = '';
    elements.fileTypeTableBody.innerHTML = '';
    elements.textOutputEl.textContent = '';
    elements.selectionSummaryDiv.style.display = 'none';
    elements.selectionSummaryDiv.textContent = '';
    elements.fileEditor.style.display = 'none';
    appState.fullScanData = null; appState.committedScanData = null;
    appState.selectionCommitted = false; appState.currentEditingFile = null;
    if (fileEditor.getAllEditedFiles && typeof fileEditor.getAllEditedFiles === 'function') {
        const editedFilesMap = fileEditor.getAllEditedFiles();
        if (editedFilesMap && typeof editedFilesMap.clear === 'function') {
            editedFilesMap.clear();
        }
    }
    uiManager.setViewModeUI(false); // Reset view mode
    combineMode.updateCombineModeListDisplay(); // Clear combine mode list
    disableUIControls(); // Disable buttons
}

function enableUIControls() {
    elements.selectAllBtn.disabled = false; elements.deselectAllBtn.disabled = false;
    elements.commitSelectionsBtn.disabled = false; elements.expandAllBtn.disabled = false;
    elements.collapseAllBtn.disabled = false; elements.viewModeToggleBtn.disabled = false;
    elements.copyReportButton.disabled = false;
    elements.downloadProjectBtn.disabled = false;
    elements.copySelectedBtn.disabled = !(appState.committedScanData?.allFilesList.length > 0);
    if (elements.applyAiPatchBtn) elements.applyAiPatchBtn.disabled = false;
}
function disableUIControls() {
    elements.selectAllBtn.disabled = true; elements.deselectAllBtn.disabled = true;
    elements.commitSelectionsBtn.disabled = true; elements.expandAllBtn.disabled = true;
    elements.collapseAllBtn.disabled = true; elements.viewModeToggleBtn.disabled = true;
    elements.copyReportButton.disabled = true; 
    elements.downloadProjectBtn.disabled = true;
    elements.copySelectedBtn.disabled = true;
    if (elements.applyAiPatchBtn) elements.applyAiPatchBtn.disabled = true;
}
function showFailedUI(message = "SCAN FAILED - SEE ERROR REPORT") {
    elements.textOutputEl.textContent = message;
    elements.mainContainer.style.display = 'flex'; // Show the main container for text report
    if(document.getElementById('visualOutputContainer')) document.getElementById('visualOutputContainer').style.display = 'none'; // Hide tree
    if(elements.textOutputContainerOuter) elements.textOutputContainerOuter.style.display = 'flex'; // Show text output
    elements.globalStatsPanel.style.display = 'none';
    elements.toolsContainer.style.display = 'none';
    elements.aiPatchPanel.style.display = 'none';
    elements.loader.classList.remove('visible'); // Hide text loader
}

function commitSelections() {
    if (!appState.fullScanData) { errorHandler.showError({ name: "NoDataError", message: "No directory scanned yet."}); return; }
    const currentSelectedPaths = new Set();
    elements.treeContainer.querySelectorAll('li').forEach(li => { if (li.dataset.selected === "true") { currentSelectedPaths.add(li.dataset.path); } });
    
    appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, currentSelectedPaths);

    if (appState.fullScanData && appState.fullScanData.allFilesList && appState.committedScanData) {
        appState.fullScanData.allFilesList.forEach(fileFromFullScan => {
            if (fileEditor.hasEditedContent(fileFromFullScan.path) && !fileFromFullScan.entryHandle) { 
                if (!appState.committedScanData.allFilesList.find(committedFile => committedFile.path === fileFromFullScan.path)) {
                    appState.committedScanData.allFilesList.push({...fileFromFullScan, content: fileEditor.getEditedContent(fileFromFullScan.path)});
                }
            }
        });
    }

    appState.selectionCommitted = true;
    uiManager.refreshAllUI();
    notificationSystem.showNotification("Selections committed successfully");
}
function copyReport() {
    if (elements.textOutputEl.textContent) {
        navigator.clipboard.writeText(elements.textOutputEl.textContent)
            .then(() => notificationSystem.showNotification('Report copied to clipboard!'))
            .catch(err => { console.error('Failed to copy report: ', err); errorHandler.showError({ name: "ClipboardError", message: "Failed to copy to clipboard.", stack: err.stack }); });
    } else { notificationSystem.showNotification('No report generated to copy.'); }
}

function initApp() {
    // Ensure pageLoader is visible initially (CSS should handle this by default)
    // elements.pageLoader.classList.remove('hidden'); // Not strictly needed if default is visible

    notificationSystem.initNotificationSystem();
    errorHandler.initErrorHandlers();
    fileEditor.initFileEditor();
    aiPatcher.initAiPatcher(); 
    document.body.className = ''; // Clear any theme classes if set initially

    // Initially hide all main content sections until loader is done
    elements.mainActionDiv.style.display = 'none'; // Drop zone area
    elements.globalStatsPanel.style.display = 'none';
    elements.toolsContainer.style.display = 'none';
    elements.mainContainer.style.display = 'none'; // Contains tree, report, combine panels
    elements.aiPatchPanel.style.display = 'none';
    elements.selectionSummaryDiv.style.display = 'none';
    elements.fileEditor.style.display = 'none';
    if(elements.aiPatchDiffModal) elements.aiPatchDiffModal.style.display = 'none'; 
    
    disableUIControls(); // Keep controls disabled until content is ready
    uiManager.setViewModeUI(false); // Set to standard view initially
    setupEventListeners();

    // Simulate some loading time for demonstration or if init has async parts.
    // In a real app, this would be at the end of all truly asynchronous setup.
    setTimeout(() => {
        elements.pageLoader.classList.add('hidden');
        document.body.classList.add('loaded'); // Signal body that loading is done
        
        // Now make the main action area (drop zone) visible
        elements.mainActionDiv.style.display = 'flex'; // Or 'block' based on its intended layout
        
        appState.initialLoadComplete = true;
        // Other elements (#globalStatsPanel, #toolsContainer, etc.) will be shown
        // by resetUIForProcessing or after a scan.
    }, 500); // Adjust timeout as needed, or remove if init is purely synchronous
}
document.addEventListener('DOMContentLoaded', initApp);
// --- ENDFILE: js/main.js --- //