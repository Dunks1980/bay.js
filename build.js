const fs = require("fs");
const path = require('path');

var dir = './dist';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

const bayFile = fs.readFileSync('./bay.min.js');
const bay = bayFile.toString();

fs.readdir(path.join(__dirname, 'src'), (error, files) => {
  if (error) {
    console.log(error);
    return;
  }
  files.forEach( file => {
    console.log(file);
    const templateFile = fs.readFileSync('./src/' + file);
    const template = '\n' + templateFile.toString().replaceAll('`', '\\`').replaceAll('${', '\\${');
    let filename = file.split('.')[0];
    if (filename.indexOf('-') === -1) filename = `bay-${filename}`;
    const outputFile = `(function(){${bay} window.requestAnimationFrame(function () {var ea=[];var e=document.querySelector('${filename}');if (e) {ea = Array.from(e.attributes).map(a => a.name);}bay.create('${filename}',\`${template}\`,ea); });}())`;
    fs.writeFileSync(`dist/${filename}.js`, outputFile);
  });
});
