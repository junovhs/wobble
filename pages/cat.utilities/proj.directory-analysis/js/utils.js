// Format bytes to human-readable format
export function formatBytes(bytes, decimals = 2) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes < 0) return '0 Bytes'; // Robust check
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']; // Added PB
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    // Ensure 'i' is within the bounds of the 'sizes' array
    const BoundedI = Math.min(i, sizes.length -1);

    return parseFloat((bytes / Math.pow(k, BoundedI)).toFixed(dm)) + ' ' + sizes[BoundedI];
}

// Check if a file is likely a text file based on its extension or name
export function isLikelyTextFile(filepath) {
    if (!filepath || typeof filepath !== 'string') return false;

    const textExtensions = [
        // Code & Markup
        '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.html', '.htm', '.xhtml', '.css', '.js', '.mjs', '.jsx', '.ts', '.tsx',
        '.php', '.phtml', '.rb', '.py', '.pyw', '.java', '.jsp', '.c', '.cpp', '.h', '.hpp', '.cs', '.vb', '.go', '.rs', '.swift', 
        '.kt', '.kts', '.scala', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd', '.sql', '.r', '.m', '.mm', '.f', '.f90', '.for',
        '.hs', '.lhs', '.pl', '.pm', '.t', '.lua', '.tcl', '.groovy', '.gvy', '.gradle', '.dart', '.elm', '.erl', '.hrl', 
        '.ex', '.exs', '.clj', '.cljs', '.cljc', '.edn', '.coffee', '.litcoffee', '.ls', '.jade', '.pug', '.haml', '.slim', 
        '.ejs', '.asp', '.aspx', '.ascx', '.master', '.erb', '.hbs', '.mustache', '.handlebars', '.vue', '.svelte', '.glsl', '.frag', '.vert',
        
        // Config
        '.ini', '.conf', '.cfg', '.config', '.properties', '.prop', '.toml', '.env', '.editorconfig', '.gitattributes',
        '.gitconfig', '.gitignore', '.npmrc', '.yarnrc', '.babelrc', '.eslintrc', '.prettierrc', '.stylelintrc', '.tf', '.tfvars',
        
        // Docs & Data
        '.log', '.rst', '.tex', '.bib', '.adoc', '.asciidoc', '.textile', '.wiki', '.mediawiki', '.org', '.creole', '.asc',
        '.rtf', '.srt', '.vtt', '.sub', '.po', '.pot', '.svg', '.geojson', '.kml', '.gpx', '.url', '.webloc', '.desktop',
        '.less', '.sass', '.scss', '.styl', '.postcss', '.pcss', '.plist', '.diff', '.patch', '.xslt', '.xsd', '.wsdl', '.webmanifest',
        '.ics', '.ifb', '.vcf', '.vcard', '.appcache', '.manifest', '.map' // Source maps
    ];

    const textFilenames = [
        'makefile', 'dockerfile', 'gemfile', 'procfile', 'rakefile', 'license', 'readme', 'copying', 'authors', 'contributing',
        'changelog', 'news', 'install', 'todo', 'notice', 'manifest', 'requirements', 'pipfile', 'gradlew', 'mvnw',
        'vercel.json', 'netlify.toml', 'now.json', '.bash_profile', '.bashrc', '.zshrc', '.profile', '.vimrc', '.tmux.conf'
    ];

    const lowerPath = filepath.toLowerCase();
    const filename = lowerPath.substring(lowerPath.lastIndexOf('/') + 1);
    
    if (textFilenames.includes(filename)) {
        return true;
    }

    // Check for extension match
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex !== 0 && lastDotIndex !== filename.length - 1) { // Ensure dot is not first or last char
        const extension = filename.substring(lastDotIndex);
        if (textExtensions.includes(extension)) {
            return true;
        }
    }
    
    // Default to false if no known text pattern matches
    return false;
}
export function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '(no ext)';
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
        return '(no ext)';
    }
    return filename.substring(lastDot).toLowerCase();
}