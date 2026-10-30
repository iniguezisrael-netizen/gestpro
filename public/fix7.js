const fs=require("fs"),p="C:\\Users\\israe\\Downloads\\firebase-deploy\\public\\index.html";
let c=fs.readFileSync(p,"utf8");
c=c.replace(/window\.doLogin=doLogin;\n/g,"");
const auth="// ==================== AUTH ====================";
const idx=c.indexOf(auth);
if(idx===-1){console.log("ERROR: no encontro AUTH");process.exit(1);}
const cl="document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#login-screen .btn-primary'))doLogin();});\n";
c=c.substring(0,idx)+cl+c.substring(idx);
fs.writeFileSync(p,c);
console.log("Listo");
