# Markdown Example Project

This project demonstrates how a `README.md` file within a `proj.` folder can be used as the project's content.

## Features

*   The main application fetches this Markdown file.
*   It uses the `marked` library to convert it to HTML.
*   The resulting HTML is displayed in the content area using `iframe.srcdoc`.

## How it Works

The `app.js` script checks for `index.html` first. If not found, it looks for `README.md`.

```javascript
// Simplified logic in app.js
async function fetchProjectContent(projectPath) {
  // ... fetch directory contents ...

  const indexHtml = findFile('index.html');
  if (indexHtml) {
    return { type: 'html', url: getFileUrl(indexHtml) };
  }

  const readmeMd = findFile('readme.md');
  if (readmeMd) {
    const markdown = await fetchFileContent(readmeMd);
    const html = await marked(markdown);
    return { type: 'markdown', data: html };
  }

  return { type: 'empty', data: 'No content found.' };
}

