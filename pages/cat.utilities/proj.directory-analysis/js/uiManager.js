import { appState, elements } from './main.js';
import * as treeView from './treeView.js';
import * as statsManager from './statsManager.js';
import * as reportGenerator from './reportGenerator.js';
import * as combineMode from './combineMode.js';

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

// Refresh all UI components based on current state
export function refreshAllUI() {
    if (!appState.fullScanData) return;
    
    // Determine which data to use for display
    const displayData = appState.selectionCommitted ? appState.committedScanData : appState.fullScanData;
    if (!displayData || !displayData.directoryData) { // Handle if filtering results in nothing
        elements.treeContainer.innerHTML = '<div class="empty-notice">NO ITEMS IN CURRENT VIEW / SELECTION.</div>';
        elements.globalStatsDiv.innerHTML = '<div class="empty-notice">NO DATA FOR STATS.</div>';
        elements.selectionSummaryDiv.style.display = 'none';
        elements.fileTypeTableBody.innerHTML = '<tr><td colspan="3">No data.</td></tr>';
        elements.textOutputEl.textContent = "// NO ITEMS IN CURRENT VIEW / SELECTION //";
        combineMode.updateCombineModeListDisplay(); // Will show empty message
        elements.copyReportButton.disabled = true;
        elements.copySelectedBtn.disabled = true;
        return;
    }

    updateVisualTreeFiltering();
    statsManager.displayGlobalStats(displayData, appState.fullScanData);
    elements.textOutputEl.textContent = reportGenerator.generateTextReport(displayData);
    combineMode.updateCombineModeListDisplay();
    elements.copyReportButton.disabled = false;
    elements.copySelectedBtn.disabled = displayData.allFilesList.length === 0;
}

// Update visual tree filtering based on committed selections
function updateVisualTreeFiltering() {
    if (!appState.selectionCommitted || !appState.committedScanData) return; // Only dim if filter is active

    const committedPaths = new Set();
    if (appState.committedScanData.directoryData) { // Check if directoryData is not null
         function collectPaths(node) {
            if (!node) return;
            committedPaths.add(node.path);
            if (node.children) node.children.forEach(collectPaths);
        }
        collectPaths(appState.committedScanData.directoryData);
    }

    elements.treeContainer.querySelectorAll('li').forEach(li => {
        const path = li.dataset.path;
        let isEffectivelyInCommitted = false;

        // Check if the item itself or any of its ancestors are in the committed set
        let currentPath = path;
        while(currentPath){
            if(committedPaths.has(currentPath)){
                isEffectivelyInCommitted = true;
                break;
            }
            const lastSlash = currentPath.lastIndexOf('/');
            if(lastSlash === -1) break;
            currentPath = currentPath.substring(0, lastSlash);
        }
        li.classList.toggle('filtered-out', !isEffectivelyInCommitted);
    });
}