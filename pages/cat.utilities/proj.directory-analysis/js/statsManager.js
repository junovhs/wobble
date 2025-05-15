import { elements, appState } from './main.js'; // Added appState for originalFullData context
import { formatBytes } from './utils.js';

// Display global statistics based on the provided data
export function displayGlobalStats(currentDisplayData, originalFullData) {
    if (!currentDisplayData || !currentDisplayData.directoryData) {
        elements.globalStatsDiv.innerHTML = "<div class='stat-item'>No data to display for current selection.</div>";
        elements.selectionSummaryDiv.style.display = 'none';
        elements.fileTypeTableBody.innerHTML = "<tr><td colspan='3'>No files in current selection.</td></tr>";
        return;
    }
    
    const rootNode = currentDisplayData.directoryData;
    const allFiles = currentDisplayData.allFilesList;
    const allFolders = currentDisplayData.allFoldersList;

    const selectedFileCount = allFiles.length;
    const selectedDirCount = allFolders.length; // This is count of folder *entries* in the view
    const selectedTotalSize = allFiles.reduce((sum, f) => sum + f.size, 0); // Original sizes
    const avgFileSize = selectedFileCount > 0 ? selectedTotalSize / selectedFileCount : 0;

    // Use appState.fullScanData as the definitive originalFullData if not explicitly passed or different.
    const actualOriginalData = originalFullData || appState.fullScanData;

    if (actualOriginalData && (currentDisplayData !== actualOriginalData && appState.selectionCommitted)) {
        const omittedFileCount = actualOriginalData.allFilesList.length - selectedFileCount;
        const omittedTotalSize = actualOriginalData.directoryData.totalSize - selectedTotalSize;
        // dirCount in actualOriginalData.directoryData refers to subdirectories within it, not the flat list.
        // For omitted dir entries, use the flat list counts.
        const omittedDirCount = actualOriginalData.allFoldersList.length - selectedDirCount;
        
        elements.selectionSummaryDiv.innerHTML = `Displaying stats for <strong>${selectedFileCount} selected files</strong> (${formatBytes(selectedTotalSize)}) and <strong>${selectedDirCount} selected folder entries</strong>.<br>
        ${omittedFileCount} files (${formatBytes(omittedTotalSize)}) and ${omittedDirCount} folder entries were omitted from view.`;
        elements.selectionSummaryDiv.style.display = 'block';
    } else {
         elements.selectionSummaryDiv.innerHTML = `Displaying stats for all ${selectedFileCount} scanned files (${formatBytes(selectedTotalSize)}) and ${selectedDirCount} folder entries.`;
        elements.selectionSummaryDiv.style.display = 'block';
    }
    
    elements.globalStatsDiv.innerHTML = `
        <div class="stat-item"><strong>Root Folder:</strong> ${rootNode.name}</div>
        <div class="stat-item"><strong>Files in View:</strong> ${selectedFileCount}</div>
        <div class="stat-item"><strong>Folders in View (Entries):</strong> ${selectedDirCount}</div>
        <div class="stat-item"><strong>Total Size (Original Files in View):</strong> ${formatBytes(selectedTotalSize)}</div>
        <hr style="border-color: var(--border-color);">
        <div class="stat-item"><strong>Deepest Level (Original Scan):</strong> ${actualOriginalData?.maxDepth || 'N/A'}</div>
        <div class="stat-item"><strong>Avg. File Size (View, Original):</strong> ${formatBytes(avgFileSize)}</div>
        <div class="stat-item"><strong>Empty Dirs (Original Scan):</strong> ${actualOriginalData?.emptyDirCount || 'N/A'}</div>
    `;

    updateFileTypeTable(allFiles); // Uses original file sizes from the list
}

// Update the file type breakdown table
function updateFileTypeTable(filesList) {
    const selectedFileTypes = {};
    filesList.forEach(file => {
        if (!selectedFileTypes[file.extension]) selectedFileTypes[file.extension] = { count: 0, size: 0 };
        selectedFileTypes[file.extension].count++;
        selectedFileTypes[file.extension].size += file.size; // Uses original size
    });
    
    const sortedFileTypes = Object.entries(selectedFileTypes).sort(([,a],[,b]) => b.size - a.size); 
    elements.fileTypeTableBody.innerHTML = ''; 
    
    if (sortedFileTypes.length === 0) {
        elements.fileTypeTableBody.innerHTML = `<tr><td colspan="3">${filesList.length > 0 ? 'No files with extensions in current view.' : 'No files in current view.'}</td></tr>`;
    } else {
        sortedFileTypes.forEach(([ext, data]) => {
            const row = elements.fileTypeTableBody.insertRow();
            row.innerHTML = `<td>${ext}</td><td>${data.count}</td><td>${formatBytes(data.size)}</td>`;
        });
    }
}