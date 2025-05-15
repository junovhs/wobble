// --- FILE: js/zipManager.js --- //
import { appState } from './main.js';
import * as fileEditor from 'fileEditor';
import * as fileSystem from 'fileSystem'; // To read original file content if not edited
import * as notificationSystem from 'notificationSystem';
import * as errorHandler from 'errorHandler';

// Utility function to trigger browser download
function triggerDownload(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

export async function downloadProjectAsZip() {
    if (typeof JSZip === 'undefined') {
        errorHandler.showError({
            name: "LibraryMissingError",
            message: "JSZip library is not loaded. Cannot create ZIP file."
        });
        console.error("JSZip library not found!");
        return;
    }

    if (!appState.fullScanData || !appState.fullScanData.directoryData || !appState.fullScanData.allFilesList) {
        notificationSystem.showNotification("No project data available to download.", {duration: 3000});
        return;
    }

    const zip = new JSZip();
    const rootFolderName = appState.fullScanData.directoryData.name;
    // let projectFolder = zip.folder(rootFolderName); // Creates a root folder in the zip

    notificationSystem.showNotification("Preparing ZIP file...", {duration: 2000});

    try {
        for (const fileInfo of appState.fullScanData.allFilesList) {
            let content;
            let isBinary = false; // We might need to handle binary files differently (e.g. as base64 or ArrayBuffer)
                               // For now, assuming text content for simplicity and because CAPCA focuses on text.

            if (fileEditor.hasEditedContent(fileInfo.path)) {
                content = fileEditor.getEditedContent(fileInfo.path);
                 // console.log(`[ZIP] Using edited content for: ${fileInfo.path}`);
            } else if (fileInfo.entryHandle) { // Original file, not edited, has an entryHandle
                try {
                    // fileSystem.readFileContent handles File or FileEntry and returns text
                    // Important: Ensure readFileContent doesn't re-check fileEditor if we only want original here.
                    // The current fileSystem.readFileContent *does* check fileEditor first.
                    // We need a way to get raw original content if not edited.
                    // Let's assume for now a simple re-read using the handle if not in editor:
                    if (fileInfo.entryHandle instanceof File) { // From input type=file
                        content = await fileInfo.entryHandle.text();
                    } else if (typeof fileInfo.entryHandle.file === 'function') { // FileEntry from drag/drop
                        content = await new Promise((resolve, reject) => {
                            fileInfo.entryHandle.file(async (fileObject) => {
                                try { resolve(await fileObject.text()); }
                                catch (err) { reject(err); }
                            }, reject);
                        });
                    } else {
                        console.warn(`[ZIP] Unknown entryHandle type for: ${fileInfo.path}. Skipping.`);
                        continue;
                    }
                    // console.log(`[ZIP] Using original content for: ${fileInfo.path}`);
                } catch (readError) {
                    console.error(`[ZIP] Error reading original content for ${fileInfo.path}:`, readError);
                    // Add a placeholder for this file in the ZIP or skip it
                    zip.file(fileInfo.path, `Error reading file: ${readError.message}`);
                    continue;
                }
            } else {
                // This case would be for a file listed in allFilesList but without an entryHandle
                // (e.g., if a CAPCA-created file wasn't properly added to fileEditor)
                // However, CAPCA-created files are in fileEditor, so this shouldn't be common.
                console.warn(`[ZIP] File ${fileInfo.path} has no entryHandle and no edited content. Skipping.`);
                continue;
            }
            
            // fileInfo.path already includes the root folder name as per current scan logic
            // e.g., "test_for_ai_patcher/readme.md"
            zip.file(fileInfo.path, content);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        triggerDownload(zipBlob, rootFolderName + '.zip');
        notificationSystem.showNotification("Project ZIP generated and download started!", {duration: 3500});

    } catch (error) {
        console.error("Error generating ZIP file:", error);
        errorHandler.showError({
            name: "ZipGenerationError",
            message: `Failed to generate ZIP file: ${error.message}`,
            stack: error.stack
        });
        notificationSystem.showNotification("Error generating ZIP file.", {duration: 3000});
    }
}

// --- ENDFILE: js/zipManager.js --- //