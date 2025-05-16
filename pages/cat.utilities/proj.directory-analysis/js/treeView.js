// --- FILE: js/treeView.js --- //
import { elements, appState } from './main.js';
import * as fileSystem from 'fileSystem';
import * as fileEditor from 'fileEditor';
import { isLikelyTextFile, formatBytes, getFileExtension } from './utils.js';

// SVG icons for file types
const ICONS = {
    folder: `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    js: `<svg viewBox="0 0 24 24"><path d="M20 20.25q-.45 0-.8-.225t-.5-.625L16.85 16.1q-.15-.2-.15-.425t.15-.425l2.1-2.55q.15-.2.35-.2t.35.2l2.1 2.55q.15.2.15.425t-.15.425L20.15 19.4q-.15.2-.35.2Zm-15.75 0V3.75H16.5v5.8h1.5V3.75q0-.625-.438-1.062T16.5 2.25H4.25q-.625 0-1.062.438T2.75 3.75v16.5q0 .625.438 1.063T4.25 21.75h7.4v-1.5Z"/></svg>`,
    html: `<svg viewBox="0 0 24 24"><path d="M4.00002 3L5.41911 18.1857L12 21L18.5809 18.1857L20 3H4.00002ZM17.0521 16.4286L12 17.9571L6.94791 16.4286L6.57202 12.2857H9.25002V14.2143L12 15.0143L14.75 14.2143V12.2857H9.01717L8.74331 9.14286H15.2567L15.6483 5.14285H8.35174L8.22045 4.14285H15.7796L15.9108 5.14285L15.6483 5.14285H17.7796L17.4283 9.14286H15.2567L15.0883 12.2857H17.6483L17.0521 16.4286Z"/></svg>`,
    css: `<svg viewBox="0 0 24 24"><path d="M4 3l1.42 15.26L12 21l6.58-2.74L20 3H4zm13.12 12.47L12 17.94l-5.12-2.47-.35-3.73h2.58l.19 1.97L12 15.01l2.7-.99.28-2.88H9.24l-.19-1.96h8.07l-.19 1.96h-2.58l-.14 1.34z"/></svg>`,
    json: `<svg viewBox="0 0 24 24"><path d="M6 15h3v3H6v-3m9 0h3v3h-3v-3M6 6h3v3H6V6m9 3h3v3h-3V9m-5 2c0 .95.31 1.77.94 2.45.63.7 1.43 1.05 2.41 1.05.98 0 1.78-.35 2.41-1.05.63-.68.94-1.5.94-2.45V9h-1.9v2.1c0 .59-.2.99-.59 1.24-.39.24-.89.36-1.51.36-.62 0-1.12-.12-1.51-.36-.39-.25-.59-.65-.59-1.24V9H10v2Z"/></svg>`,
    md: `<svg viewBox="0 0 24 24"><path d="M20 6H4c-1.11 0-2 .89-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM4 15.5V8.5c.01-.28.21-.5.49-.5h15.02c.28 0 .49.22.49.5v7c0 .28-.22.5-.49.5H4.49c-.28 0-.49-.22-.49-.5zm2-2.5h2V11h2v2h2v-1.5H8.5v-1H10V11H8.5v1H7V9.5h1.5v1H10V12h2v-1.5h1.5V12H12v1.5h3.5c.28 0 .5-.22.5-.5v-3c0-.28-.22-.5-.5-.5H14v1.5h-2V9.5H9.5V11H8v2H6v-1.5z"/></svg>`,
    py: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 19.88a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3m-7-14.76a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3m.03-2.16h2.83v2.79h-2.83zM8.5 19.88a1.5 1.5 0 1 0 0-3a1.5 1.5 0 0 0 0 3m-.03.84H5.65v-2.79h2.83zM12.38 12h-2.76V5.62H6.84v2.76H4.06V3h11.88v2.62h-2.71v9.16a2.75 2.75 0 0 0 2.75 2.75h2.83v2.79h-2.83a5.52 5.52 0 0 1-5.52-5.52zm2.79.03V9.24h2.76v2.79zm.03-5.16h2.83v2.79h-2.83z"/></svg>`,
};

function getIconSvg(nodeInfo) {
    if (nodeInfo.type === 'folder') return ICONS.folder;
    switch (nodeInfo.extension) {
        case '.js': case '.mjs': return ICONS.js;
        case '.html': case '.htm': return ICONS.html;
        case '.css': return ICONS.css;
        case '.json': return ICONS.json;
        case '.md': return ICONS.md;
        case '.py': return ICONS.py;
        default: return ICONS.file;
    }
}

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
    if (nodeInfo.extension) {
        li.classList.add(`icon-${nodeInfo.extension.substring(1)}`);
    }
    if (nodeInfo.type === 'folder') { // Initially collapsed for new/empty, or respect saved state
        li.classList.add('collapsed'); // Default new folders to collapsed for cleaner look
        if ((!nodeInfo.children || nodeInfo.children.length === 0) && (nodeInfo.fileCount === 0 || nodeInfo.fileCount === undefined)) {
            li.classList.add('empty-folder-visual');
        }
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

    if (nodeInfo.type === 'folder') {
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'folder-toggle';
        toggleSpan.textContent = '▸'; // Collapsed by default
        itemPrefix.appendChild(toggleSpan);
        toggleSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            li.classList.toggle('collapsed');
            toggleSpan.textContent = li.classList.contains('collapsed') ? '▸' : '▾';
        });
    }

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.innerHTML = getIconSvg(nodeInfo);
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
        nameSpan.addEventListener('click', (e) => { // Click on name toggles checkbox
            selector.checked = !selector.checked;
            selector.dispatchEvent(new Event('change'));
        });
        // Icon click is now handled by the toggleSpan for collapsing
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
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); fileEditor.openFileInEditor(nodeInfo); });
            actionSpan.appendChild(editBtn);
        }
        const previewBtn = document.createElement('span');
        previewBtn.className = 'preview-btn';
        previewBtn.title = 'Preview file';
        previewBtn.textContent = '👁️';
        previewBtn.addEventListener('click', (e) => { e.stopPropagation(); fileSystem.previewFile(nodeInfo.entryHandle, nodeInfo.path); });
        actionSpan.appendChild(previewBtn);
        if (actionSpan.children.length > 0) itemLine.appendChild(actionSpan);
    }
    li.appendChild(itemLine);
    return li;
}

// addFileToTree, updateSelectionState, updateParentCheckboxStates, setAllSelections remain the same
// toggleAllFolders should update the textContent of .folder-toggle as well
export function toggleAllFolders(collapse) {
    elements.treeContainer.querySelectorAll('.tree .folder').forEach(folderLi => {
        folderLi.classList.toggle('collapsed', collapse);
        const toggle = folderLi.querySelector('.folder-toggle');
        if (toggle) {
            toggle.textContent = collapse ? '▸' : '▾';
        }
    });
}


// --- (Rest of the functions: addFileToTree, updateSelectionState, updateParentCheckboxStates, setAllSelections) ---
// Minor change in addFileToTree to update toggle text if parent was collapsed
export function addFileToTree(fileInfo) {
    if (fileInfo.type !== 'file') {
        console.warn("addFileToTree is intended for files.");
        return;
    }

    const pathParts = fileInfo.path.split('/');
    const fileName = fileInfo.name;
    pathParts.pop();
    const parentPath = pathParts.join('/');

    let parentLiElement;
    let parentDataNode;

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
        if (!parentLiElement) {
             parentLiElement = elements.treeContainer.querySelector(`li[data-path="${appState.fullScanData?.directoryData.name}"]`) || elements.treeContainer.children[0];
        }
    }
     if (!parentLiElement) {
        console.error(`Parent <li> element not found for path: '${parentPath}' after data node search. Cannot add '${fileName}' to visual tree.`);
        return;
    }

    if (parentDataNode) {
        if (!parentDataNode.children) parentDataNode.children = [];
        if (!parentDataNode.children.find(child => child.path === fileInfo.path)) {
            parentDataNode.children.push(fileInfo);
            parentDataNode.children.sort((a, b) => {
                if (a.type === 'folder' && b.type === 'file') return -1;
                if (a.type === 'file' && b.type === 'folder') return 1;
                return a.name.localeCompare(b.name);
            });
            parentDataNode.fileCount = (parentDataNode.fileCount || 0) + 1;
            parentDataNode.totalSize = (parentDataNode.totalSize || 0) + (fileInfo.size || 0);
        }
    }

    let parentUlElement = parentLiElement.querySelector(':scope > ul');
    if (!parentUlElement) {
        parentUlElement = document.createElement('ul');
        parentLiElement.appendChild(parentUlElement);
        parentLiElement.classList.remove('empty-folder-visual');
        // If parent was collapsed and we added a UL, expand it and update toggle
        if (parentLiElement.classList.contains('collapsed')) {
            parentLiElement.classList.remove('collapsed');
            const toggle = parentLiElement.querySelector('.folder-toggle');
            if (toggle) toggle.textContent = '▾';
        }
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
    if (!inserted) parentUlElement.appendChild(newFileLiElement);

    updateParentCheckboxStates(parentLiElement);
    const parentStatsSpan = parentLiElement.querySelector(':scope > .item-line > .stats');
    if (parentStatsSpan && parentDataNode) {
        parentStatsSpan.textContent = `(${(parentDataNode.fileCount || 0)} files, ${(parentDataNode.dirCount || 0)} subdirs, ${formatBytes(parentDataNode.totalSize || 0)})`;
    }

    let currentAncestorDataNode = parentDataNode;
    while(currentAncestorDataNode && currentAncestorDataNode.path !== appState.fullScanData.directoryData.path) {
        const ancestorPathParts = currentAncestorDataNode.path.split('/');
        ancestorPathParts.pop();
        const grandParentPath = ancestorPathParts.join('/');
        if (!grandParentPath && appState.fullScanData.directoryData.path !== currentAncestorDataNode.path) { // Handle if parent is root
             if (currentAncestorDataNode === appState.fullScanData.directoryData) break; // Already at root
             const rootDataNode = appState.fullScanData.directoryData;
             const rootLiElement = elements.treeContainer.querySelector(`li[data-path="${rootDataNode.path}"]`);
             if(rootDataNode && rootLiElement) {
                if (!rootDataNode.children.find(c => c.path === fileInfo.path)) {
                    rootDataNode.fileCount = (rootDataNode.fileCount || 0) + 1;
                    rootDataNode.totalSize = (rootDataNode.totalSize || 0) + (fileInfo.size || 0);
                }
                const rootStatsSpan = rootLiElement.querySelector(':scope > .item-line > .stats');
                if (rootStatsSpan) {
                    rootStatsSpan.textContent = `(${(rootDataNode.fileCount || 0)} files, ${(rootDataNode.dirCount || 0)} subdirs, ${formatBytes(rootDataNode.totalSize || 0)})`;
                }
             }
             break;
        }
        if (!grandParentPath) break;


        const grandParentDataNode = findNodeInData(appState.fullScanData.directoryData, grandParentPath);
        const grandParentLiElement = elements.treeContainer.querySelector(`li[data-path="${grandParentPath}"]`);

        if (grandParentDataNode && grandParentLiElement) {
            if (!grandParentDataNode.children.find(c => c.path === fileInfo.path)) {
                grandParentDataNode.fileCount = (grandParentDataNode.fileCount || 0) + 1;
                grandParentDataNode.totalSize = (grandParentDataNode.totalSize || 0) + (fileInfo.size || 0);
            }
            const grandParentStatsSpan = grandParentLiElement.querySelector(':scope > .item-line > .stats');
            if (grandParentStatsSpan) {
                 grandParentStatsSpan.textContent = `(${(grandParentDataNode.fileCount || 0)} files, ${(grandParentDataNode.dirCount || 0)} subdirs, ${formatBytes(grandParentDataNode.totalSize || 0)})`;
            }
            currentAncestorDataNode = grandParentDataNode;
        } else {
            break;
        }
    }
}

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
// --- ENDFILE: js/treeView.js --- //