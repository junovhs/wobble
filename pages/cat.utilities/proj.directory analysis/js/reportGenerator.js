import { formatBytes } from './utils.js';

// Generate a comprehensive text report
export function generateTextReport(currentDisplayData) {
    if (!currentDisplayData || !currentDisplayData.directoryData) {
        return "// NO DATA AVAILABLE FOR REPORT (Selection might be empty) //";
    }
    const rootNode = currentDisplayData.directoryData;

    let report = `//--- DIRANALYSE MATRIX REPORT (v2.2) ---//\n`;
    report += `// Timestamp: ${new Date().toISOString()}\n`;
    report += `// Root Path Scanned: ${rootNode.name}\n`;
    
    if (currentDisplayData.allFilesList.length !== rootNode.fileCount) {
        report += `// Filter: Committed user selection is active.\n`;
    } else {
        report += `// Filter: Displaying full scanned directory.\n`;
    }
    
    report += `//\n`;
    report += `//--- [ DIRECTORY STRUCTURE (Current View) ] ---\n`;
    
    report += buildTextTreeRecursive(rootNode, "");
    
    if (!rootNode.children || rootNode.children.length === 0 && rootNode.fileCount === 0) {
        report += (rootNode.name ? rootNode.name : "(Root)") + " is empty or all contents filtered out.\n";
    }
    
    report += `//\n`;
    report += `//--- [ SUMMARY (Current View) ] ---\n`;
    report += `Total Files: ${currentDisplayData.allFilesList.length}\n`;
    report += `Total Folders: ${currentDisplayData.allFoldersList.length}\n`;
    report += `Total Size (Files): ${formatBytes(currentDisplayData.allFilesList.reduce((s, f) => s + f.size, 0))}\n`;
    report += `//\n`;
    report += `//--- END OF REPORT ---//`;
    
    return report;
}

// Build text tree recursively for report
function buildTextTreeRecursive(node, indent = "") {
    let entryString = indent;
    if (node.type === 'folder') {
        entryString += `[DIR] ${node.name} (Files: ${node.fileCount}, Subdirs: ${node.dirCount}, Size: ${formatBytes(node.totalSize)})\n`;
        const children = [...(node.children || [])].sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1));
        children.forEach((child, index) => {
            const newIndentPrefix = indent.replace("┣", "┃").replace("┗", " ");
            const connector = (index === children.length - 1) ? "┗━ " : "┣━ ";
            entryString += buildTextTreeRecursive(child, newIndentPrefix + connector);
        });
    } else { // file
        entryString += `[FILE] ${node.name} (Size: ${formatBytes(node.size)}, Ext: ${node.extension})\n`;
    }
    return entryString;
}