import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {X509Certificate} from 'node:crypto';
import {isIP} from 'node:net';
import selfsigned from 'selfsigned';

// Creates local files only. Trusting the CA on a device is an explicit user action.
export async function localTLS(addresses,directory=new URL('./.local-certs/',import.meta.url)){
  await mkdir(directory,{recursive:true});
  const path=name=>new URL(name,directory);
  let ca;
  try{ca={key:await readFile(path('ca-key.pem'),'utf8'),cert:await readFile(path('room-rally-ca.crt'),'utf8')};if(Date.parse(new X509Certificate(ca.cert).validTo)<Date.now()+86400000)throw Error('Expired CA');}
  catch(error){if(error.code!=='ENOENT'&&error.message!=='Expired CA')throw error;const generated=await selfsigned.generate([{name:'commonName',value:'Room Rally Local Game CA'}],{algorithm:'sha256',keySize:2048,notAfterDate:new Date(Date.now()+365*86400000),extensions:[{name:'basicConstraints',cA:true,pathLenConstraint:0,critical:true},{name:'keyUsage',keyCertSign:true,cRLSign:true,critical:true}]});ca={key:generated.private,cert:generated.cert};await writeFile(path('ca-key.pem'),ca.key,{mode:0o600});await writeFile(path('room-rally-ca.crt'),ca.cert);}
  const names=[...new Set(['127.0.0.1',...addresses.filter(a=>isIP(a))])].sort();
  let cert,key;
  try{cert=await readFile(path('server.pem'),'utf8');key=await readFile(path('server-key.pem'),'utf8');const x509=new X509Certificate(cert);if(Date.parse(x509.validTo)<Date.now()+86400000||!x509.verify(new X509Certificate(ca.cert).publicKey)||!names.every(ip=>x509.checkIP(ip)))throw Error('Renew server certificate');}
  catch(error){if(error.code!=='ENOENT'&&error.message!=='Renew server certificate')throw error;const leaf=await selfsigned.generate([{name:'commonName',value:'Room Rally LAN'}],{algorithm:'sha256',keySize:2048,notAfterDate:new Date(Date.now()+90*86400000),ca,extensions:[{name:'basicConstraints',cA:false,critical:true},{name:'keyUsage',digitalSignature:true,keyEncipherment:true,critical:true},{name:'extKeyUsage',serverAuth:true},{name:'subjectAltName',altNames:[{type:2,value:'localhost'},...names.map(ip=>({type:7,ip}))]}]});cert=leaf.cert;key=leaf.private;await writeFile(path('server.pem'),cert);await writeFile(path('server-key.pem'),key,{mode:0o600});}
  return {key,cert,ca:ca.cert,fingerprint:new X509Certificate(ca.cert).fingerprint256};
}
