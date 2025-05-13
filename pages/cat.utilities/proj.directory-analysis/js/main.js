import * as fileSystem from 'fileSystem';
import * as uiManager from 'uiManager';
import * as treeView from 'treeView';
import * as statsManager from 'statsManager';
import * as reportGenerator from 'reportGenerator';
import * as combineMode from 'combineMode';
import * as utils from 'utils';
import * as notificationSystem from 'notificationSystem';
import * as themeManager from 'themeManager';
import * as errorHandler from 'errorHandler';

// Global app state
export const appState = {
    isCombineMode: false, 
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false, 
    crtMode: true,
    processingInProgress: false
};

// DOM Element References
export const elements = {
    dropZone: document.getElementById('dropZone'),
    folderInput: document.getElementById('folderInput'),
    treeContainer: document.getElementById('treeContainer'),
    globalStatsDiv: document.getElementById('globalStats'),
    selectionSummaryDiv: document.getElementById('selectionSummary'),
    fileTypeTableBody: document.querySelector('#fileTypeTable tbody'),
    mainContainer: document.querySelector('.main-container'),
    globalStatsPanel: document.getElementById('globalStatsPanel'),
    toolsContainer: document.getElementById('toolsContainer'),
    loader: document.getElementById('loader'),
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
    filePreview: document.getElementById('filePreview'),
    filePreviewTitle: document.getElementById('filePreviewTitle'),
    filePreviewContent: document.getElementById('filePreviewContent'),
    closePreview: document.getElementById('closePreview'),
    crtToggle: document.getElementById('crtToggle'),
    textOutputContainerOuter: document.getElementById('textOutputContainerOuter'),
    notification: document.getElementById('notification'),
    errorReport: document.getElementById('errorReport')
};

// Set up event listeners
function setupEventListeners() {
    // Drop zone
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);
    elements.dropZone.addEventListener('drop', handleFileDrop);
    elements.folderInput.addEventListener('change', handleFolderSelect);
    
    // Tool buttons
    elements.selectAllBtn.addEventListener('click', () => treeView.setAllSelections(true));
    elements.deselectAllBtn.addEventListener('click', () => treeView.setAllSelections(false));
    elements.commitSelectionsBtn.addEventListener('click', commitSelections);
    elements.viewModeToggleBtn.addEventListener('click', () => uiManager.setViewModeUI(!appState.isCombineMode));
    
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
    
    // CRT mode toggle
    elements.crtToggle.addEventListener('click', toggleCRTMode);
}

// Event handlers
function handleDragOver(e) {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
}

function handleDragLeave() {
    elements.dropZone.classList.remove('dragover');
}

// Handle folder selection from file input
async function handleFolderSelect(event) {
    if (appState.processingInProgress) return;
    
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Get all directories by checking if files have common parent directories
    const paths = Array.from(files).map(file => file.webkitRelativePath.split('/')[0]);
    const uniqueRootDirs = [...new Set(paths)];
    
    if (uniqueRootDirs.length > 1) {
        errorHandler.showError({
            name: "MultipleRootError", 
            message: "Multiple root directories selected. Please select a single directory."
        });
        return;
    }
    
    // Process as a virtual directory
    await processSelectedFolder(files, uniqueRootDirs[0]);
    
    // Reset input to allow selecting the same directory again
    elements.folderInput.value = '';
}

// Process selected folder from file input
async function processSelectedFolder(files, rootDirName) {
    resetUIForProcessing();
    appState.processingInProgress = true;
    
    try {
        // Show loader
        elements.loader.classList.add('visible');
        
        // Create a virtual directory structure from the files
        const virtualDirectory = createVirtualDirectoryFromFiles(files, rootDirName);
        
        // Set the scan data and update UI
        appState.fullScanData = virtualDirectory;
        treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        
        // By default, all items are initially "committed"
        const allInitiallySelectedPaths = new Set();
        appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
        appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));
        
        appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
        appState.selectionCommitted = true;
        
        // Update UI components
        uiManager.refreshAllUI();
        enableUIControls();
        
        // Show main containers
        elements.mainContainer.style.display = 'flex';
        elements.globalStatsPanel.style.display = 'block';
        elements.toolsContainer.style.display = 'flex';
    } catch (err) {
        console.error("ERROR PROCESSING DIRECTORY:", err);
        errorHandler.showError(err);
        showFailedUI();
    } finally {
        elements.loader.classList.remove('visible');
        appState.processingInProgress = false;
    }
}

// Create a virtual directory structure from file input files
function createVirtualDirectoryFromFiles(files, rootDirName) {
    const allFilesList = [];
    const allFoldersList = [];
    const folderMap = new Map();
    const rootPath = rootDirName;
    
    // Create the root folder
    const rootFolder = {
        name: rootDirName,
        path: rootPath,
        type: 'folder',
        depth: 0,
        children: [],
        fileCount: 0,
        dirCount: 0,
        totalSize: 0,
        fileTypes: {},
        entryHandle: null
    };
    
    folderMap.set(rootPath, rootFolder);
    allFoldersList.push({ name: rootDirName, path: rootPath, entryHandle: null });
    
    // Process each file and build the directory structure
    Array.from(files).forEach(file => {
        const parts = file.webkitRelativePath.split('/');
        const fileName = parts.pop();
        let currentPath = '';
        let parentPath = '';
        let maxDepth = 0;
        
        // Create folder hierarchy
        for (let i = 0; i < parts.length; i++) {
            const folderName = parts[i];
            parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            
            if (!folderMap.has(currentPath)) {
                const folderDepth = i;
                if (folderDepth > maxDepth) maxDepth = folderDepth;
                
                const folder = {
                    name: folderName,
                    path: currentPath,
                    type: 'folder',
                    depth: folderDepth,
                    children: [],
                    fileCount: 0,
                    dirCount: 0,
                    totalSize: 0,
                    fileTypes: {},
                    entryHandle: null
                };
                
                folderMap.set(currentPath, folder);
                allFoldersList.push({ name: folderName, path: currentPath, entryHandle: null });
                
                // Add to parent folder's children
                if (parentPath) {
                    const parentFolder = folderMap.get(parentPath);
                    if (parentFolder) {
                        parentFolder.children.push(folder);
                        parentFolder.dirCount++;
                    }
                }
            }
        }
        
        // Add file to its parent folder
        const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '(no ext)';
        const filePath = `${currentPath}/${fileName}`;
        const fileInfo = {
            name: fileName,
            type: 'file',
            size: file.size,
            path: filePath,
            extension: ext,
            depth: parts.length,
            entryHandle: file
        };
        
        allFilesList.push({
            name: fileName,
            path: filePath,
            size: file.size,
            extension: ext,
            entryHandle: file
        });
        
        // Add file to parent folder
        const parentFolder = folderMap.get(currentPath);
        if (parentFolder) {
            parentFolder.children.push(fileInfo);
            parentFolder.fileCount++;
            parentFolder.totalSize += file.size;
            
            // Update file type stats
            if (!parentFolder.fileTypes[ext]) parentFolder.fileTypes[ext] = { count: 0, size: 0 };
            parentFolder.fileTypes[ext].count++;
            parentFolder.fileTypes[ext].size += file.size;
            
            // Update stats up the folder hierarchy
            let path = currentPath;
            while (path !== rootPath && path) {
                const lastSlash = path.lastIndexOf('/');
                if (lastSlash === -1) break;
                
                const parentPath = path.substring(0, lastSlash);
                const parent = folderMap.get(parentPath);
                if (parent) {
                    parent.fileCount++;
                    parent.totalSize += file.size;
                    if (!parent.fileTypes[ext]) parent.fileTypes[ext] = { count: 0, size: 0 };
                    parent.fileTypes[ext].count++;
                    parent.fileTypes[ext].size += file.size;
                }
                path = parentPath;
            }
            
            // Update root folder stats too
            if (currentPath !== rootPath) {
                const root = folderMap.get(rootPath);
                root.fileCount++;
                root.totalSize += file.size;
                if (!root.fileTypes[ext]) root.fileTypes[ext] = { count: 0, size: 0 };
                root.fileTypes[ext].count++;
                root.fileTypes[ext].size += file.size;
            }
        }
    });
    
    // Calculate empty directories
    let emptyDirCount = 0;
    folderMap.forEach(folder => {
        if (folder.children.length === 0) emptyDirCount++;
    });
    
    return {
        directoryData: rootFolder,
        allFilesList,
        allFoldersList,
        maxDepth: getMaxDepth(rootFolder),
        deepestPathExample: getDeepestPath(rootFolder),
        emptyDirCount
    };
}

// Get the maximum depth in the directory structure
function getMaxDepth(node, currentDepth = 0) {
    if (!node) return currentDepth;
    
    let maxDepth = currentDepth;
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            const childDepth = getMaxDepth(child, currentDepth + 1);
            maxDepth = Math.max(maxDepth, childDepth);
        }
    }
    return maxDepth;
}

// Get the deepest path example
function getDeepestPath(node, currentDepth = 0) {
    if (!node || !node.children || node.children.length === 0) {
        return node ? node.path : '';
    }
    
    let deepestPath = '';
    let maxDepth = currentDepth;
    
    for (const child of node.children) {
        const childPath = getDeepestPath(child, currentDepth + 1);
        const childParts = childPath.split('/').length;
        
        if (childParts > maxDepth) {
            maxDepth = childParts;
            deepestPath = childPath;
        }
    }
    
    return deepestPath || node.path;
}

async function handleFileDrop(event) {
    event.preventDefault();
    if (appState.processingInProgress) return;
    
    elements.dropZone.classList.remove('dragover');
    
    resetUIForProcessing();
    appState.processingInProgress = true;
    
    // Show loader
    elements.loader.classList.add('visible');
    
    const items = event.dataTransfer.items;
    if (items && items.length) {
        const entry = items[0].webkitGetAsEntry();
        if (entry && entry.isDirectory) {
            try {
                appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(entry, entry.name, 0);
                treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
                
                // By default, after scan, all items are "committed"
                const allInitiallySelectedPaths = new Set();
                appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
                appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));
                
                appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
                appState.selectionCommitted = true;
                
                uiManager.refreshAllUI();
                enableUIControls();

                elements.mainContainer.style.display = 'flex';
                elements.globalStatsPanel.style.display = 'block';
                elements.toolsContainer.style.display = 'flex';
            } catch (err) {
                console.error("ERROR PROCESSING DIRECTORY:", err);
                errorHandler.showError(err);
                showFailedUI();
            } finally {
                elements.loader.classList.remove('visible');
                appState.processingInProgress = false;
            }
        } else {
            errorHandler.showError({
                name: "InvalidTargetError",
                message: "Please drop a folder, not an individual file."
            });
            elements.loader.classList.remove('visible');
            appState.processingInProgress = false;
        }
    }
}

function resetUIForProcessing() {
    // Reset UI
    elements.mainContainer.style.display = 'none';
    elements.globalStatsPanel.style.display = 'none';
    elements.toolsContainer.style.display = 'none';
    elements.treeContainer.innerHTML = '';
    elements.globalStatsDiv.innerHTML = '';
    elements.fileTypeTableBody.innerHTML = '';
    elements.textOutputEl.textContent = '';
    elements.selectionSummaryDiv.style.display = 'none';
    elements.selectionSummaryDiv.textContent = '';
    
    // Reset state
    appState.fullScanData = null;
    appState.committedScanData = null;
    appState.selectionCommitted = false;
    uiManager.setViewModeUI(false);
    combineMode.updateCombineModeListDisplay();
    disableUIControls();
}

function enableUIControls() {
    elements.selectAllBtn.disabled = false;
    elements.deselectAllBtn.disabled = false;
    elements.commitSelectionsBtn.disabled = false;
    elements.expandAllBtn.disabled = false;
    elements.collapseAllBtn.disabled = false;
    elements.viewModeToggleBtn.disabled = false;
    elements.copyReportButton.disabled = false;
    elements.copySelectedBtn.disabled = appState.committedScanData?.allFilesList.length === 0;
}

function disableUIControls() {
    elements.selectAllBtn.disabled = true;
    elements.deselectAllBtn.disabled = true;
    elements.commitSelectionsBtn.disabled = true;
    elements.expandAllBtn.disabled = true;
    elements.collapseAllBtn.disabled = true;
    elements.viewModeToggleBtn.disabled = true;
    elements.copyReportButton.disabled = true;
    elements.copySelectedBtn.disabled = true;
}

function showFailedUI() {
    elements.textOutputEl.textContent = "SCAN FAILED - SEE ERROR REPORT";
    elements.mainContainer.style.display = 'flex';
    document.getElementById('visualOutputContainer').style.display = 'none';
    elements.globalStatsPanel.style.display = 'none';
    elements.toolsContainer.style.display = 'none';
}

function commitSelections() {
    if (!appState.fullScanData) {
        errorHandler.showError({
            name: "NoDataError",
            message: "No directory scanned yet."
        });
        return;
    }
    
    const currentSelectedPaths = new Set();
    elements.treeContainer.querySelectorAll('li').forEach(li => {
        if (li.dataset.selected === "true") {
            currentSelectedPaths.add(li.dataset.path);
        }
    });
    
    appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, currentSelectedPaths);
    appState.selectionCommitted = true;
    
    uiManager.refreshAllUI();
    notificationSystem.showNotification("Selections committed successfully");
}

function copyReport() {
    if (elements.textOutputEl.textContent) {
        navigator.clipboard.writeText(elements.textOutputEl.textContent)
            .then(() => notificationSystem.showNotification('Report copied to clipboard!'))
            .catch(err => {
                console.error('Failed to copy report: ', err);
                errorHandler.showError({
                    name: "ClipboardError",
                    message: "Failed to copy to clipboard.",
                    stack: err.stack
                });
            });
    } else {
        notificationSystem.showNotification('No report generated to copy.');
    }
}

function toggleCRTMode() {
    appState.crtMode = !appState.crtMode;
    document.body.classList.toggle('crt-on', appState.crtMode);
    elements.crtToggle.textContent = appState.crtMode ? 'CRT: ON' : 'CRT: OFF';
}

// Initialize app
function initApp() {
    // Initialize all modules
    notificationSystem.initNotificationSystem();
    themeManager.initThemeManager();
    errorHandler.initErrorHandlers();
    
    // Set initial UI state
    document.body.classList.toggle('crt-on', appState.crtMode);
    elements.crtToggle.textContent = appState.crtMode ? 'CRT: ON' : 'CRT: OFF';
    disableUIControls();
    elements.mainContainer.style.display = 'none';
    elements.globalStatsPanel.style.display = 'none';
    elements.toolsContainer.style.display = 'none';
    elements.selectionSummaryDiv.style.display = 'none';
    uiManager.setViewModeUI(false);
    
    // Setup event listeners
    setupEventListeners();
}

// Start the application
document.addEventListener('DOMContentLoaded', initApp);