const fs=require("fs"),p="C:\\Users\\israe\\Downloads\\firebase-deploy\\public\\index.html";
let c=fs.readFileSync(p,"utf8");
const r=/<script(\s[^>]*)data-cfasync[^>]*>/g;
let m,pos=-1,tag="";
while((m=r.exec(c))!==null){if(!m[0].includes("src=")){tag=m[0];pos=m.index;break;}}
if(pos===-1){console.log("ERROR");process.exit(1);}
const js=pos+tag.length;
console.log("tag:"+tag.substring(0,60));
c=c.substring(0,js)+"window.doLogin=doLogin;\n"+c.substring(js);
const s='class="btn btn-primary btn-full">Iniciar Ses';
const n='class="btn btn-primary btn-full" onclick="doLogin()">Iniciar Ses';
if(c.includes(n)){console.log("onclick ya estaba");}
else{c=c.replace(s,n);console.log("onclick restaurado");}
fs.writeFileSync(p,c);
console.log("Listo");
