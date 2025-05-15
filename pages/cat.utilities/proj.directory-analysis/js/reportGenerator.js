// --- ENDFILE: index.html --- //
// --- FILE: js/reportGenerator.js --- //
import { formatBytes } from './utils.js';
import * as fileEditor from 'fileEditor'; // To check for edited content
import { appState } from './main.js'; // Import appState

// Generate a comprehensive text report
// NOTE: This report generator currently DOES NOT reflect live edits from the editor or AI Patcher.
// It reports on the state of the files as per the *committed selection* from the initial scan.
// Modifying this to include live edits would require it to fetch content similarly to combineMode.
export function generateTextReport(currentDisplayData) {
    if (!currentDisplayData || !currentDisplayData.directoryData) {
        return "// NO DATA AVAILABLE FOR REPORT (Selection might be empty or not committed) //";
    }
    const rootNode = currentDisplayData.directoryData;

    let report = `//--- DIRANALYSE MATRIX REPORT (v3.1) ---//\n`;
    report += `// Timestamp: ${new Date().toISOString()}\n`;
    report += `// Root Path Scanned: ${rootNode.name}\n`;
    
    // Check if the displayed data is a filtered subset of the original full scan
    // This heuristic might need refinement if appState.fullScanData can be null after a scan.
    // A better check would be if currentDisplayData is !== appState.fullScanData (if fullScanData is always present post-scan)
    if (appState.fullScanData && (currentDisplayData.allFilesList.length !== appState.fullScanData.allFilesList.length || currentDisplayData.allFoldersList.length !== appState.fullScanData.allFoldersList.length)) {
        report += `// Filter: Committed user selection is active.\n`;
    } else {
        report += `// Filter: Displaying full scanned directory (or committed selection matches full scan).\n`;
    }
    report += `// NOTE: This report reflects the structure and original sizes. For combined content including edits, use 'Copy Committed Files'.\n`;
    
    report += `//\n`;
    report += `//--- [ DIRECTORY STRUCTURE (Current View) ] ---\n`;
    
    report += buildTextTreeRecursive(rootNode, "");
    
    if (!rootNode.children || rootNode.children.length === 0 && rootNode.fileCount === 0) {
        report += (rootNode.name ? rootNode.name : "(Root)") + " is empty or all contents filtered out.\n";
    }
    
    report += `//\n`;
    report += `//--- [ SUMMARY (Current View) ] ---\n`;
    const totalSizeFromList = currentDisplayData.allFilesList.reduce((s, f) => s + f.size, 0); // Use original sizes from scan
    report += `Total Files: ${currentDisplayData.allFilesList.length}\n`;
    report += `Total Folders: ${currentDisplayData.allFoldersList.length}\n`;
    report += `Total Size (Original Files in View): ${formatBytes(totalSizeFromList)}\n`;
    report += `//\n`;
    report += `//--- END OF REPORT ---//`;
    
    return report;
}

// Build text tree recursively for report
function buildTextTreeRecursive(node, indent = "") {
    let entryString = indent;
    if (node.type === 'folder') {
        // For folders, fileCount, dirCount, totalSize are from the (potentially filtered) node data.
        entryString += `[DIR] ${node.name} (Files: ${node.fileCount}, Subdirs: ${node.dirCount}, Size: ${formatBytes(node.totalSize)})\n`;
        const children = [...(node.children || [])].sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1));
        children.forEach((child, index) => {
            const newIndentPrefix = indent.replace("┣", "┃").replace("┗", " ");
            const connector = (index === children.length - 1) ? "┗━ " : "┣━ ";
            entryString += buildTextTreeRecursive(child, newIndentPrefix + connector);
        });
    } else { // file
        // For files, size is from the (potentially filtered) node data, which is the original size.
        entryString += `[FILE] ${node.name} (Size: ${formatBytes(node.size)}, Ext: ${node.extension})\n`;
    }
    return entryString;
}
// --- ENDFILE: js/reportGenerator.js --- //