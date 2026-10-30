const fs = require("fs");
const p = "C:\\Users\\israe\\Downloads\\firebase-deploy\\public\\index.html";
let c = fs.readFileSync(p, "utf8");
c = c.replace(/ onclick="doLogin\(\)"/g, "");
c = c.replace(/ onkeydown="[^"]*doLogin[^"]*"/g, "");
fs.writeFileSync(p, c);
console.log("Listo");
