/*

// Add the following in vite.config.js

import BayPlugin from './bay-vite.js';
export default {
  plugins: [BayPlugin()]
};

*/

import fs from 'fs';
import path from 'path';

export default function BayPlugin() {
  return {
    name: 'bay-vite',
    async load(id) {
      if (id.endsWith('.bay')) {
        const resolvedPath = path.resolve(__dirname, id);
        try {
          const content = await fs.promises.readFile(resolvedPath, 'utf-8');
          return {
            code: `export default ${JSON.stringify(content)}`,
            map: null
          };
        } catch (error) {
          console.error('Error reading .bay file:', error);
          return null;
        }
      }
    }
  };
}