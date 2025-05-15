// --- FILE: js/lib-wrappers/dmp-wrapper.js --- //
// This file assumes diff_match_patch.js has been loaded and DiffMatchPatch is global
// or it exports DiffMatchPatch if it's an IIFE that exposes it.
// If diff_match_patch.js IS an ES module, you don't need this wrapper.

// Check if it's already defined (e.g. by a <script> tag)
if (typeof DiffMatchPatch === 'undefined') {
    // This is a placeholder. You'd ideally have diff_match_patch.js structured
    // as an ES module or use a build step.
    // For now, this will likely fail if not loaded globally.
    // If you downloaded it from Google's repo, it's often a global.
    console.error("DiffMatchPatch global not found. Ensure js/lib/diff_match_patch.js is loaded before modules or is an ES module itself.");
    // Fallback to a dummy object to prevent hard crashes on import
    window.DiffMatchPatch = function() {
        this.diff_main = () => [];
        this.patch_make = () => [];
        this.patch_apply = () => ["", []];
        this.diff_prettyHtml = () => "Diff library not properly loaded.";
    };
}
export const DMP = window.DiffMatchPatch;
// --- ENDFILE: js/lib-wrappers/dmp-wrapper.js --- //