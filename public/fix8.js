const fs=require("fs"),p="C:\\Users\\israe\\Downloads\\firebase-deploy\\public\\index.html";
let c=fs.readFileSync(p,"utf8");
c=c.replace(/window\.doLogin=doLogin;\n/g,"");
const old='onclick="doLogin()"';
const nv="onclick=\"(function(){var i=document.querySelectorAll('#login-screen input'),e=i[0]?i[0].value:'',pw=document.querySelector('#login-screen input[type=password]');pw=pw?pw.value:'';firebase.auth().signInWithEmailAndPassword(e,pw).catch(function(err){var el=document.getElementById('login-error');if(el){el.textContent=err.message;el.style.display='block';}});})()\"";
if(!c.includes(old)){console.log("ERROR: boton no encontrado");process.exit(1);}
c=c.replace(old,nv);
fs.writeFileSync(p,c);
console.log("Listo");
