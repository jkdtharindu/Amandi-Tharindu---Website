// USAGE: node render-pdf.js "<abs path to guide.html>" "<abs path to output.pdf>"
// Renders the guide HTML to A4 PDF using the CSS @page rules inside the HTML.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(800);
await p.pdf({path:process.argv[3],format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
await b.close()})();
