const fs = require('fs');
const path = require('path');

// Copy @electron/llm utility files to .vite/utility
const utilitySourceDir = path.join(__dirname, '../node_modules/@electron/llm/dist/utility');
const utilityTargetDir = path.join(__dirname, '../.vite/utility');

// Copy @electron/llm preload file to .vite/preload
const preloadSourceFile = path.join(__dirname, '../node_modules/@electron/llm/dist/preload/index.js');
const preloadTargetDir = path.join(__dirname, '../.vite/preload');
const preloadTargetFile = path.join(preloadTargetDir, 'index.js');

// Create target directories if they don't exist
if (!fs.existsSync(utilityTargetDir)) {
  fs.mkdirSync(utilityTargetDir, { recursive: true });
}
if (!fs.existsSync(preloadTargetDir)) {
  fs.mkdirSync(preloadTargetDir, { recursive: true });
}

// Copy utility files
const utilityFiles = fs.readdirSync(utilitySourceDir);
utilityFiles.forEach(file => {
  const sourcePath = path.join(utilitySourceDir, file);
  const targetPath = path.join(utilityTargetDir, file);
  
  if (fs.statSync(sourcePath).isFile()) {
    let content = fs.readFileSync(sourcePath, 'utf8');
    
    // Fix call-ai-model-entry-point.js to handle undefined options
    if (file === 'call-ai-model-entry-point.js') {
      content = content.replace(
        /const options = abortSignalManager\.getWithSignalFromPromptOptions\(data\.options\);/g,
        `const options = abortSignalManager.getWithSignalFromPromptOptions(data.options || {});`
      );
    }
    
    // Fix abortmanager.js to handle undefined input
    if (file === 'abortmanager.js') {
      content = content.replace(
        /getWithSignalFromPromptOptions\(input\) \{\s*const \{ requestUUID, \.\.\.rest \} = input;/g,
        `getWithSignalFromPromptOptions(input) {
        if (!input) {
            return {};
        }
        const { requestUUID, ...rest } = input;`
      );
    }
    
    fs.writeFileSync(targetPath, content, 'utf8');
  }
});

// Copy preload file
if (fs.existsSync(preloadSourceFile)) {
  fs.copyFileSync(preloadSourceFile, preloadTargetFile);
}

// Copy required dependencies for utility process
// The utility process requires ../interfaces.js and ../language-model.js
const distDir = path.join(__dirname, '../node_modules/@electron/llm/dist');
const viteDir = path.join(__dirname, '../.vite');

const requiredFiles = ['interfaces.js', 'language-model.js', 'constants.js'];
const requiredDirs = ['common'];

// Copy required files
requiredFiles.forEach(file => {
  const sourceFile = path.join(distDir, file);
  const targetFile = path.join(viteDir, file);
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
  }
});

// Copy required directories
requiredDirs.forEach(dir => {
  const sourceDir = path.join(distDir, dir);
  const targetDir = path.join(viteDir, dir);
  if (fs.existsSync(sourceDir)) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }
});

// Create symlink to node_modules so utility process can resolve native modules
const viteNodeModules = path.join(__dirname, '../.vite/node_modules');
if (!fs.existsSync(viteNodeModules)) {
  try {
    fs.mkdirSync(viteNodeModules, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Create symlink to node-llama-cpp from nested location
const nodeLlamaCppLink = path.join(viteNodeModules, 'node-llama-cpp');
const nodeLlamaCppTarget = path.join(__dirname, '../node_modules/@electron/llm/node_modules/node-llama-cpp');
if (fs.existsSync(nodeLlamaCppTarget) && !fs.existsSync(nodeLlamaCppLink)) {
  try {
    fs.symlinkSync(nodeLlamaCppTarget, nodeLlamaCppLink, 'dir');
    console.log('Created symlink to node-llama-cpp');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.warn('Could not create node-llama-cpp symlink:', error.message);
    }
  }
}

console.log('@electron/llm utility, preload, and dependency files copied successfully');

