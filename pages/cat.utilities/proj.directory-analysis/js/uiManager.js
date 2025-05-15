// --- FILE: js/uiManager.js --- //
import { appState, elements } from './main.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as combineMode from './combineMode.js';
import * as utils from './utils.js';
import * as fileEditor from './fileEditor.js'; // ADDED

// Set the view mode UI (standard or combine)
export function setViewModeUI(isCombine) {
    appState.isCombineMode = isCombine;
    elements.viewModeToggleBtn.textContent = appState.isCombineMode ? 'SWITCH TO STANDARD VIEW' : 'SWITCH TO COMBINE VIEW';
    elements.textOutputContainerOuter.style.display = appState.isCombineMode ? 'none' : 'flex';
    elements.combineModePanel.style.display = appState.isCombineMode ? 'flex' : 'none';
    
    if (appState.isCombineMode) {
        combineMode.updateCombineModeListDisplay(); 
    }
}

export function refreshAllUI() {
    if (!appState.fullScanData) {
         elements.treeContainer.innerHTML = '<div class="empty-notice">DROP A FOLDER OR SELECT ONE TO BEGIN.</div>';
        return;
    }
    
    const displayData = appState.selectionCommitted ? appState.committedScanData : appState.fullScanData;
    
    if (!displayData || !displayData.directoryData || (displayData.allFilesList.length === 0 && displayData.allFoldersList.length === 0 && (!displayData.directoryData.children || displayData.directoryData.children.length === 0)) ) { 
        elements.treeContainer.innerHTML = '<div class="empty-notice">NO ITEMS IN CURRENT VIEW / SELECTION.</div>';
        elements.globalStatsDiv.innerHTML = '<div class="empty-notice">NO DATA FOR STATS.</div>';
        elements.selectionSummaryDiv.style.display = 'none';
        elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';
        elements.textOutputEl.textContent = "// NO ITEMS IN CURRENT VIEW / SELECTION //";
        if (appState.isCombineMode) combineMode.updateCombineModeListDisplay();
        elements.copyReportButton.disabled = true;
        elements.copySelectedBtn.disabled = true;
        elements.aiPatchPanel.style.display = appState.fullScanData ? 'block' : 'none';
        return;
    }

    updateVisualTreeFiltering();
    statsManager.displayGlobalStats(displayData, appState.fullScanData);
    elements.textOutputEl.textContent = reportGenerator.generateTextReport(displayData);
    
    if (appState.isCombineMode) {
        combineMode.updateCombineModeListDisplay();
    }
    
    elements.copyReportButton.disabled = false;
    const textFilesInCommitted = appState.committedScanData?.allFilesList.filter(file => utils.isLikelyTextFile(file.path)).length > 0;
    elements.copySelectedBtn.disabled = !(appState.isCombineMode && appState.selectionCommitted && textFilesInCommitted);
    elements.aiPatchPanel.style.display = 'block';

    // ADD THIS BLOCK to re-evaluate editor status if a file is open
    if (appState.currentEditingFile && elements.fileEditor.style.display === 'flex') {
        // We need to call setEditorStatus based on the most current state from editedFiles
        const currentFileState = fileEditor.getAllEditedFiles().get(appState.currentEditingFile.path);
        if (currentFileState) {
            if (currentFileState.savedInSession) {
                fileEditor.setEditorStatus(currentFileState.isPatched ? 'patched_saved' : 'saved');
            } else {
                // Determine if it's unchanged, unsaved, or patched_unsaved
                // This logic is simplified; openFileInEditor has more detailed comparison
                if (currentFileState.isPatched) {
                    fileEditor.setEditorStatus('patched_unsaved');
                } else {
                     // A more robust check here would re-compare against original content
                     // if entryHandle exists. For now, if not savedInSession and not patched,
                     // assume it's 'unsaved' if content differs from a baseline (harder to get here)
                     // or just set to 'unsaved' generally.
                     // Let's use the more detailed logic by re-opening (conceptually) the file info
                     // to get the correct status
                     (async () => {
                        // Construct a minimal file object for openFileInEditor to re-evaluate status
                        // Need to get the actual file object from appState.fullScanData.allFilesList
                        const fileToRecheck = appState.fullScanData.allFilesList.find(f => f.path === appState.currentEditingFile.path);
                        if(fileToRecheck){
                            // Temporarily nullify currentEditingFile to force openFileInEditor to reload status
                            const tempCurrentFile = appState.currentEditingFile;
                            appState.currentEditingFile = null;
                            await fileEditor.openFileInEditor(fileToRecheck);
                            appState.currentEditingFile = tempCurrentFile; // Restore
                        } else {
                             fileEditor.setEditorStatus('unsaved'); // Fallback
                        }
                     })();
                }
            }
        }
    }
}

function updateVisualTreeFiltering() {
    if (!appState.fullScanData) return;

    const committedPaths = new Set();
    if (appState.selectionCommitted && appState.committedScanData?.directoryData) {
         function collectPaths(node) {
            if (!node) return;
            committedPaths.add(node.path);
            if (node.children) node.children.forEach(collectPaths);
        }
        collectPaths(appState.committedScanData.directoryData);
    }

    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const path = li.dataset.path;
        const isInCommittedView = !appState.selectionCommitted || committedPaths.has(path);
        li.classList.toggle('filtered-out', !isInCommittedView);
    });
}
// --- ENDFILE: js/uiManager.js --- //