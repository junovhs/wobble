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
import * as utils from 'utils'; // Make sure utils is imported if not already

export const appState = {
    isCombineMode: false,
    fullScanData: null,
    committedScanData: null,
    selectionCommitted: false,
    processingInProgress: false,
    currentEditingFile: null,
    initialLoadComplete: false,
    editorInstance: null,
    previewEditorInstance: null,
    isLoadingFileContent: false,
};

export let elements = {}; // Will be populated by populateElements

function populateElements() {
    const elementIds = {
        pageLoader: 'pageLoader',
        dropZone: 'dropZone',
        folderInput: 'folderInput',
        treeContainer: 'treeContainer',
        globalStatsDiv: 'globalStats',
        selectionSummaryDiv: 'selectionSummary',
        appContainer: 'appContainer',
        sidebar: 'sidebar',
        mainContentArea: 'mainContentArea',
        globalStatsPanel: 'globalStatsPanel',
        sidebarToolsContainer: 'sidebarToolsContainer',
        loader: 'loader',
        textOutputEl: 'textOutput',
        copyReportButton: 'copyReportButton',
        combineModePanel: 'combineModePanel',
        selectedFilesContainer: 'selectedFilesContainer',
        copySelectedBtn: 'copySelectedBtn',
        selectAllBtn: 'selectAllBtn',
        deselectAllBtn: 'deselectAllBtn',
        commitSelectionsBtn: 'commitSelectionsBtn',
        viewModeToggleBtn: 'viewModeToggleBtn',
        expandAllBtn: 'expandAllBtn',
        collapseAllBtn: 'collapseAllBtn',
        downloadProjectBtn: 'downloadProjectBtn',
        clearProjectBtn: 'clearProjectBtn', // This ID should now exist in HTML
        filePreview: 'filePreview',
        filePreviewTitle: 'filePreviewTitle',
        filePreviewContentWrapper: 'filePreviewContentWrapper',
        filePreviewContent: 'filePreviewContent',
        closePreview: 'closePreview',
        textOutputContainerOuter: 'textOutputContainerOuter',
        visualOutputContainer: 'visualOutputContainer',
        notification: 'notification',
        errorReport: 'errorReport',
        fileEditor: 'fileEditor',
        editorFileTitle: 'editorFileTitle',
        editorContent: 'editorContent', // Div for CodeMirror
        saveEditorBtn: 'saveEditorBtn',
        closeEditorBtn: 'closeEditorBtn',
        editorStatus: 'editorStatus',
        editorInfo: 'editorInfo',
        aiPatchPanel: 'aiPatchPanel',
        aiPatchInput: 'aiPatchInput',
        applyAiPatchBtn: 'applyAiPatchBtn',
        aiPatchOutputLog: 'aiPatchOutputLog',
        aiPatchDiffModal: 'aiPatchDiffModal',
        diffFilePath: 'diffFilePath',
        diffOutputContainer: 'diffOutputContainer',
        closeAiPatchDiffModal: 'closeAiPatchDiffModal',
        confirmApplyPatchChanges: 'confirmApplyPatchChanges',
        skipPatchChanges: 'skipPatchChanges',
        cancelAllPatchChanges: 'cancelAllPatchChanges',
        mainActionDiv: 'mainAction'
    };

    for (const key in elementIds) {
        elements[key] = document.getElementById(elementIds[key]);
        if (!elements[key]) {
            console.warn(`[populateElements] Element with ID '${elementIds[key]}' not found for key '${key}'.`);
        }
    }

    // QuerySelector elements (handle separately as they don't use getElementById)
    elements.fileTypeTableBody = document.querySelector('#fileTypeTable tbody');
    if (!elements.fileTypeTableBody) {
        console.warn("[populateElements] Element '#fileTypeTable tbody' not found.");
    }
    // Add any other querySelector-based elements here with similar checks
}


function setupEventListeners() {
    // Helper to safely add event listeners
    const safeAddEventListener = (element, event, handler, elementName) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`[setupEventListeners] Element '${elementName}' not found. Cannot attach '${event}' listener.`);
        }
    };

    // Drop zone
    safeAddEventListener(elements.dropZone, 'dragover', handleDragOver, 'dropZone');
    safeAddEventListener(elements.dropZone, 'dragleave', handleDragLeave, 'dropZone');
    safeAddEventListener(elements.dropZone, 'drop', handleFileDrop, 'dropZone');
    safeAddEventListener(elements.dropZone, 'click', () => { if (elements.folderInput) elements.folderInput.click(); }, 'dropZone (for folderInput click)');
    safeAddEventListener(elements.folderInput, 'change', handleFolderSelect, 'folderInput');

    // Tool buttons
    safeAddEventListener(elements.selectAllBtn, 'click', () => treeView.setAllSelections(true), 'selectAllBtn');
    safeAddEventListener(elements.deselectAllBtn, 'click', () => treeView.setAllSelections(false), 'deselectAllBtn');
    safeAddEventListener(elements.commitSelectionsBtn, 'click', commitSelections, 'commitSelectionsBtn');
    safeAddEventListener(elements.viewModeToggleBtn, 'click', () => uiManager.setViewModeUI(!appState.isCombineMode), 'viewModeToggleBtn');
    safeAddEventListener(elements.downloadProjectBtn, 'click', zipManager.downloadProjectAsZip, 'downloadProjectBtn');
    safeAddEventListener(elements.clearProjectBtn, 'click', clearProjectData, 'clearProjectBtn'); // Listener for the now existing button

    // Tree manipulation
    safeAddEventListener(elements.expandAllBtn, 'click', () => treeView.toggleAllFolders(false), 'expandAllBtn');
    safeAddEventListener(elements.collapseAllBtn, 'click', () => treeView.toggleAllFolders(true), 'collapseAllBtn');

    // File preview
    safeAddEventListener(elements.closePreview, 'click', () => {
        if (elements.filePreview) elements.filePreview.style.display = 'none';
        if (appState.previewEditorInstance) {
            appState.previewEditorInstance.setValue('');
        }
    }, 'closePreview');

    // Copy buttons
    safeAddEventListener(elements.copyReportButton, 'click', copyReport, 'copyReportButton');
    safeAddEventListener(elements.copySelectedBtn, 'click', combineMode.copySelectedFiles, 'copySelectedBtn');

    // AI Patcher buttons
    // These are better initialized within aiPatcher.js's initAiPatcher function if it exists and is called.
    // For now, assuming they might still be here based on original structure or for directness.
    safeAddEventListener(elements.applyAiPatchBtn, 'click', () => {
        const patchJson = elements.aiPatchInput ? elements.aiPatchInput.value : '';
        if (!patchJson.trim()) {
            notificationSystem.showNotification("Patch input is empty.", {duration: 3000});
            if (elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = "Patch input empty.";
            return;
        }
        const parsedInstructions = aiPatcher.parsePatchInstructions ? aiPatcher.parsePatchInstructions(patchJson) : JSON.parse(patchJson);
        if (parsedInstructions && aiPatcher.processPatches) {
            aiPatcher.processPatches(parsedInstructions);
        } else {
             if (elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = "Failed to parse or process CAPCA patches.";
        }
    }, 'applyAiPatchBtn');

    safeAddEventListener(elements.closeAiPatchDiffModal, 'click', () => {
        if(aiPatcher.closeDiffModalAndProceed) aiPatcher.closeDiffModalAndProceed(false);
    }, 'closeAiPatchDiffModal');
    safeAddEventListener(elements.confirmApplyPatchChanges, 'click', () => {
        if(aiPatcher.closeDiffModalAndProceed) aiPatcher.closeDiffModalAndProceed(true);
    }, 'confirmApplyPatchChanges');
    safeAddEventListener(elements.skipPatchChanges, 'click', () => {
         if(aiPatcher.closeDiffModalAndProceed) aiPatcher.closeDiffModalAndProceed(false);
    }, 'skipPatchChanges');
    safeAddEventListener(elements.cancelAllPatchChanges, 'click', () => {
        // Assuming aiPatcher might export a function like cancelAllPatches or handle this via closeDiffModalAndProceed
        if(aiPatcher.patchQueue) aiPatcher.patchQueue = []; // Direct manipulation if no dedicated function
        if(aiPatcher.closeDiffModalAndProceed) aiPatcher.closeDiffModalAndProceed(false);
        if(elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent += "\n\nUser ACTION: Cancelled all remaining patches.\n";
        notificationSystem.showNotification("All remaining patches cancelled.", { duration: 3000 });
    }, 'cancelAllPatchChanges');


    // File Editor buttons (these should ideally be in fileEditor.js's init function)
    safeAddEventListener(elements.saveEditorBtn, 'click', () => { if(fileEditor.saveFileChanges) fileEditor.saveFileChanges(); }, 'saveEditorBtn');
    safeAddEventListener(elements.closeEditorBtn, 'click', () => { if(fileEditor.closeEditor) fileEditor.closeEditor(); }, 'closeEditorBtn');
}

function handleDragOver(e) { e.preventDefault(); if (elements.dropZone) elements.dropZone.classList.add('dragover'); }
function handleDragLeave() { if (elements.dropZone) elements.dropZone.classList.remove('dragover'); }

async function handleFolderSelect(event) {
    if (appState.processingInProgress) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const firstFileRelativePath = files[0].webkitRelativePath;
    const rootDirName = firstFileRelativePath.split('/')[0] || 'selected_folder';
    await processSelectedFolderViaInput(files, rootDirName);
    if (elements.folderInput) elements.folderInput.value = '';
}

async function processSelectedFolderViaInput(files, rootDirName) {
    resetUIForProcessing(`Processing '${rootDirName}'...`);
    appState.processingInProgress = true;
    try {
        const virtualDirData = createVirtualDirectoryFromFiles(files, rootDirName);
        appState.fullScanData = virtualDirData;
        if (appState.fullScanData.directoryData && elements.treeContainer) {
             treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
        } else {
            throw new Error("Failed to construct directory data from selected files or treeContainer is missing.");
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

        if(elements.globalStatsPanel) elements.globalStatsPanel.style.display = 'block';
        if(elements.sidebarToolsContainer) elements.sidebarToolsContainer.style.display = 'flex';
        if(elements.visualOutputContainer) elements.visualOutputContainer.style.display = 'flex';
        if(elements.textOutputContainerOuter) elements.textOutputContainerOuter.style.display = 'flex';
        if(elements.aiPatchPanel) elements.aiPatchPanel.style.display = 'block';

        uiManager.refreshAllUI();
        enableUIControls();

    } catch (err) {
        console.error("ERROR PROCESSING FOLDER INPUT:", err);
        errorHandler.showError(err);
        showFailedUI("Folder processing failed.");
    } finally {
        if(elements.loader) elements.loader.classList.remove('visible');
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
            entryHandle: file // Keep the File object as the handle for input type=file
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
    if (elements.dropZone) elements.dropZone.classList.remove('dragover');
    resetUIForProcessing("Processing dropped folder...");
    appState.processingInProgress = true;
    const items = event.dataTransfer.items;
    if (items && items.length) {
        const entry = items[0].webkitGetAsEntry();
        if (entry && entry.isDirectory) {
            try {
                appState.fullScanData = await fileSystem.processDirectoryEntryRecursive(entry, entry.name, 0);
                if (appState.fullScanData.directoryData && elements.treeContainer) {
                     treeView.renderTree(appState.fullScanData.directoryData, elements.treeContainer);
                } else {
                     throw new Error("processDirectoryEntryRecursive failed to return directoryData or treeContainer missing.");
                }
                const allInitiallySelectedPaths = new Set();
                if(appState.fullScanData.allFilesList) appState.fullScanData.allFilesList.forEach(f => allInitiallySelectedPaths.add(f.path));
                if(appState.fullScanData.allFoldersList) appState.fullScanData.allFoldersList.forEach(f => allInitiallySelectedPaths.add(f.path));

                appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, allInitiallySelectedPaths);
                appState.selectionCommitted = true;

                if(elements.globalStatsPanel) elements.globalStatsPanel.style.display = 'block';
                if(elements.sidebarToolsContainer) elements.sidebarToolsContainer.style.display = 'flex';
                if(elements.visualOutputContainer) elements.visualOutputContainer.style.display = 'flex';
                if(elements.textOutputContainerOuter) elements.textOutputContainerOuter.style.display = 'flex';
                if(elements.aiPatchPanel) elements.aiPatchPanel.style.display = 'block';

                uiManager.refreshAllUI();
                enableUIControls();

            } catch (err) {
                console.error("ERROR PROCESSING DIRECTORY (DROP):", err);
                errorHandler.showError(err);
                showFailedUI("Directory processing failed. Check console and error report.");
            } finally {
                if(elements.loader) elements.loader.classList.remove('visible');
                appState.processingInProgress = false;
            }
        } else {
            errorHandler.showError({ name: "InvalidTargetError", message: "Please drop a folder, not an individual file(s)." });
            if(elements.loader) elements.loader.classList.remove('visible');
            appState.processingInProgress = false;
        }
    } else {
        if(elements.loader) elements.loader.classList.remove('visible');
        appState.processingInProgress = false;
    }
}

function resetUIForProcessing(loaderMsg = "ANALYSING...") {
    if (elements.loader) {
        elements.loader.textContent = loaderMsg;
        elements.loader.classList.add('visible');
    }

    const panelsToHide = [
        elements.globalStatsPanel, elements.visualOutputContainer,
        elements.textOutputContainerOuter, elements.combineModePanel,
        elements.aiPatchPanel, elements.sidebarToolsContainer,
        elements.selectionSummaryDiv, elements.fileEditor
    ];
    panelsToHide.forEach(panel => { if (panel) panel.style.display = 'none'; });


    if(elements.aiPatchInput) elements.aiPatchInput.value = '';
    if(elements.aiPatchOutputLog) elements.aiPatchOutputLog.textContent = 'Awaiting patch application...';
    if(elements.aiPatchDiffModal) elements.aiPatchDiffModal.style.display = 'none';
    if(elements.diffOutputContainer) elements.diffOutputContainer.innerHTML = '';

    if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';
    if (elements.globalStatsDiv) elements.globalStatsDiv.innerHTML = '';
    if (elements.fileTypeTableBody) elements.fileTypeTableBody.innerHTML = '';
    if (elements.textOutputEl) elements.textOutputEl.textContent = '';
    if (elements.selectionSummaryDiv) elements.selectionSummaryDiv.textContent = '';

    if(appState.editorInstance) appState.editorInstance.setValue('');
    if(appState.previewEditorInstance) appState.previewEditorInstance.setValue('');

    appState.fullScanData = null; appState.committedScanData = null;
    appState.selectionCommitted = false; appState.currentEditingFile = null;
    if (fileEditor.getAllEditedFiles && typeof fileEditor.getAllEditedFiles === 'function') {
        const editedFilesMap = fileEditor.getAllEditedFiles();
        if (editedFilesMap && typeof editedFilesMap.clear === 'function') {
            editedFilesMap.clear();
        }
    }
    uiManager.setViewModeUI(false);
    combineMode.updateCombineModeListDisplay();
    disableUIControls();
    if (elements.mainActionDiv) elements.mainActionDiv.style.display = 'flex';
}

function enableUIControls() {
    const buttonsToEnable = [
        elements.selectAllBtn, elements.deselectAllBtn, elements.commitSelectionsBtn,
        elements.expandAllBtn, elements.collapseAllBtn, elements.viewModeToggleBtn,
        elements.downloadProjectBtn, elements.clearProjectBtn, elements.copyReportButton,
        elements.applyAiPatchBtn
    ];
    buttonsToEnable.forEach(btn => { if (btn) btn.disabled = false; });

    if (elements.copySelectedBtn) {
        // CORRECTED LINE: Use utils.isLikelyTextFile
        elements.copySelectedBtn.disabled = !(appState.committedScanData?.allFilesList.length > 0 && appState.committedScanData.allFilesList.some(f => utils.isLikelyTextFile(f.path)));
    }
}

function disableUIControls() {
     const buttonsToDisable = [
        elements.selectAllBtn, elements.deselectAllBtn, elements.commitSelectionsBtn,
        elements.expandAllBtn, elements.collapseAllBtn, elements.viewModeToggleBtn,
        elements.downloadProjectBtn, elements.clearProjectBtn, elements.copyReportButton,
        elements.copySelectedBtn, elements.applyAiPatchBtn
    ];
    buttonsToDisable.forEach(btn => { if (btn) btn.disabled = true; });
}

function showFailedUI(message = "SCAN FAILED - SEE ERROR REPORT") {
    if(elements.textOutputEl) elements.textOutputEl.textContent = message;
    if(elements.visualOutputContainer) elements.visualOutputContainer.style.display = 'none';
    if(elements.textOutputContainerOuter) elements.textOutputContainerOuter.style.display = 'flex';
    if(elements.globalStatsPanel) elements.globalStatsPanel.style.display = 'none';
    if(elements.aiPatchPanel) elements.aiPatchPanel.style.display = 'none';
    if(elements.sidebarToolsContainer) elements.sidebarToolsContainer.style.display = 'none';
    if(elements.loader) elements.loader.classList.remove('visible');
    if(elements.mainActionDiv) elements.mainActionDiv.style.display = 'flex';
    if(elements.clearProjectBtn) elements.clearProjectBtn.disabled = true; // Ensure clear is disabled on fail
}


function commitSelections() {
    if (!appState.fullScanData) {
        errorHandler.showError({ name: "NoDataError", message: "No directory scanned yet." });
        return;
    }

    const currentSelectedPaths = new Set();
    if (elements.treeContainer) {
        elements.treeContainer.querySelectorAll('li').forEach(li => {
            if (li.dataset.selected === "true") {
                currentSelectedPaths.add(li.dataset.path);
            }
        });
    }


    if (currentSelectedPaths.size === 0 && appState.fullScanData.allFilesList && appState.fullScanData.allFilesList.length > 0) {
        notificationSystem.showNotification("Cannot commit: No files or folders are selected in the tree.", { duration: 3500 });
        return;
    }

    appState.committedScanData = fileSystem.filterScanData(appState.fullScanData, currentSelectedPaths);

    if (appState.fullScanData && appState.fullScanData.allFilesList && appState.committedScanData && appState.fullScanData.directoryData) {
        const editedFileMap = fileEditor.getAllEditedFiles();
        editedFileMap.forEach((fileState, filePath) => {
            const originalFileFromFullScan = appState.fullScanData.allFilesList.find(f => f.path === filePath);
            if ((!originalFileFromFullScan || !originalFileFromFullScan.entryHandle) && currentSelectedPaths.has(filePath)) {
                if (!appState.committedScanData.allFilesList.find(committedFile => committedFile.path === filePath)) {
                    const name = filePath.substring(filePath.lastIndexOf('/') + 1);
                    const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : '(no ext)';

                    let depth = 0;
                    const rootPath = appState.fullScanData.directoryData.path;
                    if (filePath.startsWith(rootPath + '/')) {
                        depth = (filePath.substring(rootPath.length + 1).match(/\//g) || []).length +1;
                    } else if (filePath.startsWith(rootPath) && !filePath.includes('/')) {
                         depth = 1;
                    } else {
                        const rootPartsCount = (rootPath.match(/\//g) || []).length;
                        const filePartsCount = (filePath.match(/\//g) || []).length;
                        depth = Math.max(1, filePartsCount - rootPartsCount + (rootPath.includes('/') ? 0:1) );
                    }


                    appState.committedScanData.allFilesList.push({
                        name: name,
                        path: filePath,
                        size: fileState.content.length,
                        extension: extension,
                        type: 'file',
                        depth: depth,
                        entryHandle: null
                    });
                }
            }
        });
        if (appState.committedScanData.allFilesList) {
           appState.committedScanData.allFilesList.sort((a,b) => a.path.localeCompare(b.path));
        }
    }

    appState.selectionCommitted = true;
    uiManager.refreshAllUI();
    if(currentSelectedPaths.size > 0) {
        notificationSystem.showNotification("Selections committed successfully");
    } else if (appState.fullScanData.allFilesList && appState.fullScanData.allFilesList.length === 0) {
        notificationSystem.showNotification("No items to commit from empty scan.");
    }
}

function clearProjectData() {
    notificationSystem.showNotification("Project data cleared.", {duration: 2000});
    resetUIForProcessing("DROP A FOLDER OR SELECT ONE TO BEGIN.");
    if(elements.loader) elements.loader.classList.remove('visible');
    if(elements.mainActionDiv) elements.mainActionDiv.style.display = 'flex';
    if(elements.sidebarToolsContainer) elements.sidebarToolsContainer.style.display = 'none';
    disableUIControls();
    if(elements.clearProjectBtn) elements.clearProjectBtn.disabled = true;
}

function copyReport() {
    if (elements.textOutputEl && elements.textOutputEl.textContent && elements.textOutputEl.textContent.trim() !== "" && !elements.textOutputEl.textContent.startsWith("// NO DATA AVAILABLE") && !elements.textOutputEl.textContent.startsWith("// NO ITEMS IN CURRENT VIEW")) {
        navigator.clipboard.writeText(elements.textOutputEl.textContent)
            .then(() => notificationSystem.showNotification('Report copied to clipboard!'))
            .catch(err => { console.error('Failed to copy report: ', err); errorHandler.showError({ name: "ClipboardError", message: "Failed to copy to clipboard.", stack: err.stack }); });
    } else { notificationSystem.showNotification('No report generated or report is empty.'); }
}


function initApp() {
    populateElements();

    notificationSystem.initNotificationSystem();
    errorHandler.initErrorHandlers();
    fileEditor.initFileEditor();
    aiPatcher.initAiPatcher();
    document.body.className = '';

    if (elements.sidebar) elements.sidebar.style.display = 'flex';
    if (elements.mainActionDiv) elements.mainActionDiv.style.display = 'flex';
    if (elements.loader) elements.loader.classList.remove('visible');

    const panelsToHideOnInit = [
        elements.globalStatsPanel, elements.visualOutputContainer,
        elements.textOutputContainerOuter, elements.combineModePanel,
        elements.aiPatchPanel, elements.sidebarToolsContainer,
        elements.selectionSummaryDiv, elements.fileEditor, elements.aiPatchDiffModal
    ];
    panelsToHideOnInit.forEach(panel => { if (panel) panel.style.display = 'none'; });

    if (elements.treeContainer) elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';

    disableUIControls();
    uiManager.setViewModeUI(false);
    setupEventListeners();

    if (elements.pageLoader) elements.pageLoader.classList.add('hidden');
    document.body.classList.add('loaded');

    appState.initialLoadComplete = true;
    console.log("DirAnalyse Matrix Initialized. Element population deferred. CodeMirror integration started.");
    console.info("CodeMirror library is loaded via CDN. Internet connection required for syntax highlighting.");
    console.info("Performance Profiling: Please use your browser's developer tools to profile initial load and identify any specific bottlenecks for further optimization.");
}
document.addEventListener('DOMContentLoaded', initApp);
// --- ENDFILE: js/main.js --- //