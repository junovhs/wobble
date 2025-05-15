// --- FILE: js/treeView.js --- //
import { elements, appState } from './main.js';
import * as fileSystem from 'fileSystem';
import * as fileEditor from 'fileEditor';
import { isLikelyTextFile, formatBytes, getFileExtension } from './utils.js';

// Helper to find a node in the appState.fullScanData.directoryData or a similar tree structure
function findNodeInData(currentNode, path) {
    if (!currentNode) return null;
    if (currentNode.path === path) return currentNode;
    if (currentNode.children) {
        for (const child of currentNode.children) {
            const found = findNodeInData(child, path);
            if (found) return found;
        }
    }
    return null;
}

// Render the tree view from directory data (initial rendering)
export function renderTree(node, parentULElement) {
    const li = createNodeElement(node);
    parentULElement.appendChild(li);

    if (node.type === 'folder' && node.children && node.children.length > 0) {
        const ul = document.createElement('ul');
        node.children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        })
        .forEach(child => renderTree(child, ul));
        li.appendChild(ul);
    }
}

function createNodeElement(nodeInfo) {
    const li = document.createElement('li');
    li.classList.add(nodeInfo.type);
    if (nodeInfo.type === 'folder' && (!nodeInfo.children || nodeInfo.children.length === 0) && (nodeInfo.fileCount === 0 || nodeInfo.fileCount === undefined) ) {
         li.classList.add('empty-folder-visual');
    }
    li.dataset.path = nodeInfo.path;
    li.dataset.selected = "true";

    const itemLine = document.createElement('div');
    itemLine.className = 'item-line';

    const itemPrefix = document.createElement('span');
    itemPrefix.className = 'item-prefix';

    const selector = document.createElement('input');
    selector.type = 'checkbox';
    selector.className = 'selector';
    selector.checked = true;
    selector.dataset.path = nodeInfo.path;
    itemPrefix.appendChild(selector);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    itemPrefix.appendChild(iconSpan);
    itemLine.appendChild(itemPrefix);

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('name');
    nameSpan.textContent = nodeInfo.name;
    itemLine.appendChild(nameSpan);

    selector.addEventListener('change', (e) => {
        updateSelectionState(li, e.target.checked);
        updateParentCheckboxStates(li.parentElement.closest('li.folder'));
    });

    if (nodeInfo.type === 'file') {
        nameSpan.addEventListener('click', (e) => {
            if (isLikelyTextFile(nodeInfo.path)) {
                fileEditor.openFileInEditor(nodeInfo);
            } else {
                fileSystem.previewFile(nodeInfo.entryHandle, nodeInfo.path);
            }
        });
    } else { // Folder
        nameSpan.addEventListener('click', (e) => {
            selector.checked = !selector.checked;
            selector.dispatchEvent(new Event('change'));
        });
        iconSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            li.classList.toggle('collapsed');
        });
    }

    const statsSpan = document.createElement('span');
    statsSpan.classList.add('stats');
    if (nodeInfo.type === 'folder') {
        statsSpan.textContent = `(${(nodeInfo.fileCount || 0)} files, ${(nodeInfo.dirCount || 0)} subdirs, ${formatBytes(nodeInfo.totalSize || 0)})`;
    } else {
        statsSpan.textContent = `(${formatBytes(nodeInfo.size || 0)})`;
    }
    itemLine.appendChild(statsSpan);

    if (nodeInfo.type === 'file') {
        const actionSpan = document.createElement('span');
        actionSpan.className = 'file-actions';

        if (isLikelyTextFile(nodeInfo.path)) {
            const editBtn = document.createElement('span');
            editBtn.className = 'edit-btn';
            editBtn.title = 'Edit file';
            editBtn.textContent = '✏️';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileEditor.openFileInEditor(nodeInfo);
            });
            actionSpan.appendChild(editBtn);
        }
        const previewBtn = document.createElement('span');
        previewBtn.className = 'preview-btn';
        previewBtn.title = 'Preview file';
        previewBtn.textContent = '👁️';
        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileSystem.previewFile(nodeInfo.entryHandle, nodeInfo.path);
        });
        actionSpan.appendChild(previewBtn);

        if (actionSpan.children.length > 0) {
            itemLine.appendChild(actionSpan);
        }
    }
    li.appendChild(itemLine);
    return li;
}

export function addFileToTree(fileInfo) { // fileInfo is the newFileEntry
    if (fileInfo.type !== 'file') {
        console.warn("addFileToTree is intended for files.");
        return;
    }

    const pathParts = fileInfo.path.split('/');
    const fileName = fileInfo.name; // Use fileInfo.name directly
    pathParts.pop(); // Remove filename to get parent path parts
    const parentPath = pathParts.join('/');

    let parentLiElement;
    let parentDataNode;

    // Find the parent data node in appState.fullScanData.directoryData
    if (parentPath === appState.fullScanData.directoryData.path || (pathParts.length === 1 && pathParts[0] === appState.fullScanData.directoryData.name && parentPath === pathParts[0])) {
        parentDataNode = appState.fullScanData.directoryData;
        parentLiElement = elements.treeContainer.querySelector(`:scope > li[data-path="${parentDataNode.path}"]`);
    } else {
        parentDataNode = findNodeInData(appState.fullScanData.directoryData, parentPath);
        if (parentDataNode) {
            parentLiElement = elements.treeContainer.querySelector(`li[data-path="${parentPath}"]`);
        }
    }

    if (!parentDataNode) {
        console.error(`Parent data node not found for path: '${parentPath}'. Cannot update directoryData tree for report.`);
        // If parent data node isn't found, we might still try to add to DOM if parentLiElement was somehow found,
        // but the report based on directoryData will be missing it.
        // For DOM addition only:
        if (!parentLiElement) {
             parentLiElement = elements.treeContainer.querySelector(`li[data-path="${appState.fullScanData?.directoryData.name}"]`) || elements.treeContainer.children[0];
        }
    }
     if (!parentLiElement) { // Fallback for parent DOM element if still not found
        console.error(`Parent <li> element not found for path: '${parentPath}' after data node search. Cannot add '${fileName}' to visual tree.`);
        return; // Cannot proceed with visual update
    }


    // Add to the parentDataNode's children array for reportGenerator
    if (parentDataNode) {
        if (!parentDataNode.children) {
            parentDataNode.children = [];
        }
        // Avoid duplicates if this function is somehow called multiple times for the same file info
        if (!parentDataNode.children.find(child => child.path === fileInfo.path)) {
            parentDataNode.children.push(fileInfo);
            // Sort children in the data model to match visual sort order potentially
            parentDataNode.children.sort((a, b) => {
                if (a.type === 'folder' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name);
            });

            // Update parentDataNode's counts and size (visual update is separate)
            parentDataNode.fileCount = (parentDataNode.fileCount || 0) + 1;
            parentDataNode.totalSize = (parentDataNode.totalSize || 0) + (fileInfo.size || 0);
        }
    }


    // Proceed with DOM update
    let parentUlElement = parentLiElement.querySelector(':scope > ul');
    if (!parentUlElement) {
        parentUlElement = document.createElement('ul');
        parentLiElement.appendChild(parentUlElement);
        parentLiElement.classList.remove('empty-folder-visual');
    }

    const newFileLiElement = createNodeElement(fileInfo);

    let inserted = false;
    const siblings = Array.from(parentUlElement.children);
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        const siblingNameElement = sibling.querySelector(':scope > .item-line > .name');
        if (!siblingNameElement) continue;
        const siblingName = siblingNameElement.textContent;
        const siblingIsFile = sibling.classList.contains('file');

        if (siblingIsFile && fileName.localeCompare(siblingName) < 0) {
            parentUlElement.insertBefore(newFileLiElement, sibling);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        parentUlElement.appendChild(newFileLiElement);
    }

    updateParentCheckboxStates(parentLiElement);

    // Update visual stats of parent in DOM
    const parentStatsSpan = parentLiElement.querySelector(':scope > .item-line > .stats');
    if (parentStatsSpan && parentDataNode) { // Check parentDataNode again as it's used for stats
        parentStatsSpan.textContent = `(${(parentDataNode.fileCount || 0)} files, ${(parentDataNode.dirCount || 0)} subdirs, ${formatBytes(parentDataNode.totalSize || 0)})`;
    }
    // Recursively update stats for all ancestors up to the root
    let currentAncestorDataNode = parentDataNode;
    let currentAncestorLiElement = parentLiElement;
    while(currentAncestorDataNode && currentAncestorDataNode.path !== appState.fullScanData.directoryData.path) {
        const ancestorPathParts = currentAncestorDataNode.path.split('/');
        ancestorPathParts.pop();
        const grandParentPath = ancestorPathParts.join('/');
        if (!grandParentPath) break;

        const grandParentDataNode = findNodeInData(appState.fullScanData.directoryData, grandParentPath);
        const grandParentLiElement = elements.treeContainer.querySelector(`li[data-path="${grandParentPath}"]`);

        if (grandParentDataNode && grandParentLiElement) {
            grandParentDataNode.fileCount = (grandParentDataNode.fileCount || 0) + 1; // This might double count if not careful, assumes fileInfo is a new addition
            grandParentDataNode.totalSize = (grandParentDataNode.totalSize || 0) + (fileInfo.size || 0);
            
            const grandParentStatsSpan = grandParentLiElement.querySelector(':scope > .item-line > .stats');
            if (grandParentStatsSpan) {
                 grandParentStatsSpan.textContent = `(${(grandParentDataNode.fileCount || 0)} files, ${(grandParentDataNode.dirCount || 0)} subdirs, ${formatBytes(grandParentDataNode.totalSize || 0)})`;
            }
            currentAncestorDataNode = grandParentDataNode;
            currentAncestorLiElement = grandParentLiElement;
        } else {
            break; // Stop if we can't find the grandparent
        }
    }
     // Finally, update the root node's stats in the DOM if it was affected
    if (appState.fullScanData && appState.fullScanData.directoryData && parentDataNode !== appState.fullScanData.directoryData) {
         const rootLi = elements.treeContainer.querySelector(`li[data-path="${appState.fullScanData.directoryData.path}"]`);
         const rootStatsSpan = rootLi ? rootLi.querySelector(':scope > .item-line > .stats') : null;
         if(rootStatsSpan) {
             // Recalculate root stats by summing children, or simply update based on existing values if only one file added.
             // For now, a simple update (assuming fileCount and totalSize have been updated on the rootDataNode if this new file belongs to it)
             // This part needs careful consideration of how stats are propagated.
             // Safest: Let commitSelections or uiManager.refreshAllUI() handle full stats refresh for reports.
             // The incremental update of stats up the tree is tricky and error-prone.
             // The initial simple update for the direct parent is okay for immediate visual feedback.
         }
    }


}
// ... (rest of treeView.js remains the same) ...

export function updateSelectionState(listItem, isSelected) {
    listItem.dataset.selected = isSelected.toString();
    const checkbox = listItem.querySelector(':scope > .item-line > .item-prefix > .selector');
    if (checkbox) {
        checkbox.checked = isSelected;
        checkbox.indeterminate = false;
    }
    const childLIs = listItem.querySelectorAll(':scope > ul > li');
    childLIs.forEach(childLi => updateSelectionState(childLi, isSelected));
}

export function updateParentCheckboxStates(parentListItem) {
    if (!parentListItem) return;

    const childSelectors = Array.from(parentListItem.querySelectorAll(':scope > ul > li > .item-line > .item-prefix > .selector'));
    const parentSelector = parentListItem.querySelector(':scope > .item-line > .item-prefix > .selector');

    if (childSelectors.length > 0 && parentSelector) {
        const numChecked = childSelectors.filter(s => s.checked && !s.indeterminate).length;
        const numIndeterminate = childSelectors.filter(s => s.indeterminate).length;
        const numSelectedViaDataset = Array.from(parentListItem.querySelectorAll(':scope > ul > li[data-selected="true"]')).length;

        if (numSelectedViaDataset === 0) { 
            parentSelector.checked = false;
            parentSelector.indeterminate = false;
            parentListItem.dataset.selected = "false";
        } else if (numSelectedViaDataset === childSelectors.length) { 
            if (numChecked === childSelectors.length && numIndeterminate === 0) {
                parentSelector.checked = true;
                parentSelector.indeterminate = false;
            } else {
                parentSelector.checked = false; 
                parentSelector.indeterminate = true;
            }
            parentListItem.dataset.selected = "true";
        } else { 
            parentSelector.checked = false;
            parentSelector.indeterminate = true;
            parentListItem.dataset.selected = "true";
        }
    } else if (parentSelector) { 
        parentSelector.indeterminate = false; 
        parentListItem.dataset.selected = parentSelector.checked.toString();
    }
    updateParentCheckboxStates(parentListItem.parentElement.closest('li.folder'));
}

export function setAllSelections(isSelected) {
    const allListItems = elements.treeContainer.querySelectorAll('li');
    allListItems.forEach(li => {
        li.dataset.selected = isSelected.toString();
        const checkbox = li.querySelector(':scope > .item-line > .item-prefix > .selector');
        if (checkbox) {
            checkbox.checked = isSelected;
            checkbox.indeterminate = false;
        }
    });
}

export function toggleAllFolders(collapse) {
    elements.treeContainer.querySelectorAll('.tree .folder').forEach(folderLi => {
        folderLi.classList.toggle('collapsed', collapse);
    });
}