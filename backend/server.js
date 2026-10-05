const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const publicRoot=path.resolve(__dirname,'..','frontend');
const port=Number(process.env.PORT)||5000;
const mimeTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

const server=http.createServer((request,response)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname)}catch{response.writeHead(400);response.end('คำขอไม่ถูกต้อง');return}
  if(/^\/(?:admin|owner)(?:\/|$)/.test(pathname)||['/pages/login.html','/pages/register.html','/pages/my-bookings.html','/js/auth.js','/js/admin.js','/js/owner.js'].includes(pathname)){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('เว็บไซต์นี้ไม่ใช้ระบบบัญชีผู้ใช้');return}
  if(pathname==='/')pathname='/index.html';
  const filename=path.resolve(publicRoot,`.${pathname}`);
  if(filename!==publicRoot&&!filename.startsWith(`${publicRoot}${path.sep}`)){response.writeHead(403);response.end('ไม่มีสิทธิ์เข้าถึง');return}
  fs.stat(filename,(error,stats)=>{
    if(error||!stats.isFile()){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('ไม่พบหน้าที่ต้องการ');return}
    response.writeHead(200,{'Content-Type':mimeTypes[path.extname(filename).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
    fs.createReadStream(filename).pipe(response);
  });
});

server.listen(port,()=>console.log(`Boat Booking website is available at http://localhost:${port}`));
