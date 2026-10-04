'use strict';
const fs=require('node:fs');
const roots=['/usr/local/lib/node_modules/n8n/node_modules/n8n-core/dist','/usr/local/lib/node_modules/n8n/dist'];
const results=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())walk(path);else if(entry.name.endsWith('.js')){const source=fs.readFileSync(path,'utf8');if(source.includes('requestOptions')&&(source.includes('displayName')||path.includes('loader')))results.push({path,context:source.slice(Math.max(0,source.indexOf('requestOptions')-200),source.indexOf('requestOptions')+1500)});}}}
roots.forEach(walk);
process.stdout.write(JSON.stringify(results,null,2));
