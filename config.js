// Configuration settings for the project showcase

// GitHub repository details
// Replace with your GitHub username and repository name
export const githubOwner = 'junovhs';
export const githubRepo  = 'wobble'; // The repository *hosting* this showcase app
export const githubBranch = 'main'; // The default branch

// Base URL for raw content access
export const githubRawBaseUrl = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${githubBranch}/`;

// Path to the file listing project folders relative to the repo root
export const projectsListFile = 'config/project_paths.txt';

// Folder within the repository where project folders are located
// (Still useful for context, though paths are absolute in the list file)
export const pagesFolder = 'pages';

// Base path for the application when hosted on GitHub Pages
// Typically '/<repository-name>/' or '/' if using a custom domain
export const basePath = '/wobble';

// Other configuration options can be added here
// e.g., export const defaultTheme = 'light';