import { elements } from './main.js';

// Render the tree view from directory data
export function renderTree(node, parentULElement) {
    const li = document.createElement('li');
    li.classList.add(node.type);
    if (node.type === 'folder' && node.children.length === 0) {
         li.classList.add('empty-folder-visual');
    }
    li.dataset.path = node.path; 
    li.dataset.selected = "true"; // Initially all selected

    const itemLine = document.createElement('div');
    itemLine.className = 'item-line';

    const itemPrefix = document.createElement('span');
    itemPrefix.className = 'item-prefix';

    const selector = document.createElement('input');
    selector.type = 'checkbox';
    selector.className = 'selector';
    selector.checked = true; 
    selector.dataset.path = node.path;
    itemPrefix.appendChild(selector);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    itemPrefix.appendChild(iconSpan); 
    itemLine.appendChild(itemPrefix);

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('name');
    nameSpan.textContent = node.name;
    itemLine.appendChild(nameSpan);

    selector.addEventListener('change', (e) => {
        updateSelectionState(li, e.target.checked);
        updateParentCheckboxStates(li.parentElement.closest('li.folder'));
    });
    
    nameSpan.addEventListener('click', (e) => {
        selector.checked = !selector.checked;
        selector.dispatchEvent(new Event('change')); 
    });
    
    // Allow clicking icon to toggle folder expand/collapse without affecting selection
    if (node.type === 'folder') {
        iconSpan.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent nameSpan's click
            li.classList.toggle('collapsed');
        });
    }

    const statsSpan = document.createElement('span');
    statsSpan.classList.add('stats');
    if (node.type === 'folder') {
        statsSpan.textContent = `(${node.fileCount} files, ${node.dirCount} subdirs, ${formatBytes(node.totalSize)})`;
    } else {
        statsSpan.textContent = `(${formatBytes(node.size)})`;
    }
    itemLine.appendChild(statsSpan);
    li.appendChild(itemLine);

    if (node.type === 'folder' && node.children.length > 0) {
        const ul = document.createElement('ul');
        node.children.sort((a, b) => { 
            return (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'folder' ? -1 : 1);
        })
        .forEach(child => renderTree(child, ul));
        li.appendChild(ul);
    }
    parentULElement.appendChild(li);
}

// Update selection state of an item and its children
export function updateSelectionState(listItem, isSelected) {
    listItem.dataset.selected = isSelected.toString();
    const checkbox = listItem.querySelector(':scope > .item-line > .item-prefix > .selector');
    if (checkbox) checkbox.checked = isSelected;

    // Propagate to children
    const childLIs = listItem.querySelectorAll(':scope > ul > li');
    childLIs.forEach(childLi => updateSelectionState(childLi, isSelected));
}

// Update parent checkboxes based on children's state
export function updateParentCheckboxStates(parentListItem) {
    if (!parentListItem) return;

    const childSelectors = Array.from(parentListItem.querySelectorAll(':scope > ul > li > .item-line > .item-prefix > .selector'));
    const parentSelector = parentListItem.querySelector(':scope > .item-line > .item-prefix > .selector');

    if (childSelectors.length > 0 && parentSelector) {
        const numChecked = childSelectors.filter(s => s.checked).length;
        if (numChecked === 0) {
            parentSelector.checked = false;
            parentSelector.indeterminate = false;
            parentListItem.dataset.selected = "false";
        } else if (numChecked === childSelectors.length) {
            parentSelector.checked = true;
            parentSelector.indeterminate = false;
            parentListItem.dataset.selected = "true";
        } else {
            parentSelector.checked = false; // Set to false when indeterminate for clarity
            parentSelector.indeterminate = true;
            parentListItem.dataset.selected = "true"; // Parent is "selected" if any child is
        }
    } else if (parentSelector) { // No children, so no indeterminate state
        parentSelector.indeterminate = false;
        // Its own checked state determines its selected state
        parentListItem.dataset.selected = parentSelector.checked.toString();
    }
    updateParentCheckboxStates(parentListItem.parentElement.closest('li.folder'));
}

// Set all selections to a given state
export function setAllSelections(isSelected) {
    const allListItems = elements.treeContainer.querySelectorAll('li');
    allListItems.forEach(li => {
        // Directly set data attribute and checkbox state first
        li.dataset.selected = isSelected.toString();
        const checkbox = li.querySelector(':scope > .item-line > .item-prefix > .selector');
        if (checkbox) {
            checkbox.checked = isSelected;
            checkbox.indeterminate = false; // Reset indeterminate state
        }
    });
    
    // After all direct states are set, update parent visual states (indeterminate) from bottom up
    const allFolderItems = elements.treeContainer.querySelectorAll('li.folder');
    allFolderItems.forEach(folderLi => updateParentCheckboxStates(folderLi));
}

// Toggle all folders expanded/collapsed
export function toggleAllFolders(collapse) {
    elements.treeContainer.querySelectorAll('.tree .folder').forEach(folderLi => {
        folderLi.classList.toggle('collapsed', collapse);
    });
}

// Format bytes to human-readable format (used by tree display)
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}