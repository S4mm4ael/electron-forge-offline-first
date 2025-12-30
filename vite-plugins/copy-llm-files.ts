import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function copyLlmFiles(): Plugin {
  return {
    name: 'copy-llm-files',
    writeBundle() {
      // This runs after the bundle is written
      // Use process.cwd() to get the project root (where package.json is)
      const projectRoot = process.cwd();
      const utilitySourceDir = path.join(projectRoot, 'node_modules/@electron/llm/dist/utility');
      const utilityTargetDir = path.join(projectRoot, '.vite/utility');
      
      const preloadSourceFile = path.join(projectRoot, 'node_modules/@electron/llm/dist/preload/index.js');
      const preloadTargetDir = path.join(projectRoot, '.vite/preload');
      const preloadTargetFile = path.join(preloadTargetDir, 'index.js');
      
      // Create target directories
      if (!fs.existsSync(utilityTargetDir)) {
        fs.mkdirSync(utilityTargetDir, { recursive: true });
      }
      if (!fs.existsSync(preloadTargetDir)) {
        fs.mkdirSync(preloadTargetDir, { recursive: true });
      }
      
      // Copy utility files
      if (fs.existsSync(utilitySourceDir)) {
        const utilityFiles = fs.readdirSync(utilitySourceDir);
        utilityFiles.forEach(file => {
          const sourcePath = path.join(utilitySourceDir, file);
          const targetPath = path.join(utilityTargetDir, file);
          
          if (fs.statSync(sourcePath).isFile()) {
            let content = fs.readFileSync(sourcePath, 'utf8');
            
            // Fix call-ai-model-entry-point.js to handle undefined options
            if (file === 'call-ai-model-entry-point.js') {
              // Ensure data.options is always an object, even if undefined
              content = content.replace(
                /const options = abortSignalManager\.getWithSignalFromPromptOptions\(data\.options\);/g,
                `const options = abortSignalManager.getWithSignalFromPromptOptions(data.options || {});`
              );
            }
            
            // Fix abortmanager.js to handle undefined input
            if (file === 'abortmanager.js') {
              // Add null check before destructuring in getWithSignalFromPromptOptions
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
      }
      
      // Copy preload file
      if (fs.existsSync(preloadSourceFile)) {
        fs.copyFileSync(preloadSourceFile, preloadTargetFile);
      }
      
      // Copy required dependencies for utility process
      // The utility process requires ../interfaces.js and ../language-model.js
      const distDir = path.join(projectRoot, 'node_modules/@electron/llm/dist');
      const viteDir = path.join(projectRoot, '.vite');
      
      const requiredFiles = ['interfaces.js', 'language-model.js', 'constants.js'];
      const requiredDirs = ['common'];
      
      // Copy required files
      requiredFiles.forEach(file => {
        const sourceFile = path.join(distDir, file);
        const targetFile = path.join(viteDir, file);
        if (fs.existsSync(sourceFile)) {
          let content = fs.readFileSync(sourceFile, 'utf8');
          
          // Modify language-model.js to resolve node-llama-cpp from nested location
          if (file === 'language-model.js') {
            // Replace the import with code that resolves the module from the project root
            // ES modules need the actual entry point file, not the directory
            const nodeLlamaCppNestedPath = path.join(projectRoot, 'node_modules/@electron/llm/node_modules/node-llama-cpp/dist/index.js');
            // Use file:// URL for ES module import
            const fileUrl = `file://${nodeLlamaCppNestedPath}`;
            content = content.replace(
              /_llamaCpp = await import\('node-llama-cpp'\);/g,
              `_llamaCpp = await import('${fileUrl}');`
            );
          }
          
          fs.writeFileSync(targetFile, content, 'utf8');
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
      const viteNodeModules = path.join(viteDir, 'node_modules');
      const projectNodeModules = path.join(projectRoot, 'node_modules');
      if (!fs.existsSync(viteNodeModules)) {
        try {
          fs.mkdirSync(viteNodeModules, { recursive: true });
        } catch (error: any) {
          // Directory might already exist
        }
      }
      
      // Create symlink to node-llama-cpp from nested location
      const nodeLlamaCppLink = path.join(viteNodeModules, 'node-llama-cpp');
      const nodeLlamaCppTarget = path.join(projectRoot, 'node_modules/@electron/llm/node_modules/node-llama-cpp');
      if (fs.existsSync(nodeLlamaCppTarget) && !fs.existsSync(nodeLlamaCppLink)) {
        try {
          fs.symlinkSync(nodeLlamaCppTarget, nodeLlamaCppLink, 'dir');
          console.log('[@electron/llm] Created symlink to node-llama-cpp');
        } catch (error: any) {
          if (error.code !== 'EEXIST') {
            console.warn('[@electron/llm] Could not create node-llama-cpp symlink:', error.message);
          }
        }
      }
      
      console.log('[@electron/llm] Copied utility, preload, and dependency files');
    },
  };
}

