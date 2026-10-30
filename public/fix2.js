const fs = require("fs");
const p = "C:\\Users\\israe\\Downloads\\firebase-deploy\\public\\index.html";
let c = fs.readFileSync(p, "utf8");
c = c.replace(/onclick="doLogin\(\)"/g, "");
c = c.replace(/onkeydown="if\(event\.key===.Enter.\)doLogin\(\)"/g, "");
const marker = "// ==================== AUTH ====================";
const idx = c.indexOf(marker);
if(idx===-1){console.log("marker no encontrado");process.exit(1);}
const code = 'var _lb=document.querySelector("#login-screen .btn-primary");if(_lb)_lb.addEventListener("click",function(){doLogin();});var _lp=document.getElementById("login-pass");if(_lp)_lp.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});\n';
c = c.slice(0,idx)+code+c.slice(idx);
fs.writeFileSync(p, c);
console.log("Listo");
