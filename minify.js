const fs = require("fs");
const { execSync } = require('child_process');
const bayFile = fs.readFileSync('./bay.mjs');
let bay = bayFile.toString();
bay = bay.replace('export default bay;', 'bay();');
fs.writeFileSync('./bay.js', bay);
execSync('npx terser bay.mjs --compress --mangle --output  bay.min.mjs');
execSync('npx terser bay.js --compress --mangle --output  bay.min.js');
console.log('Minification complete: bay.min.mjs and bay.min.js');