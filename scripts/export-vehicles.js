import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {VEHICLES} from '../public/vehicle-catalog.js';
import {createVehicle,triangleCount} from '../public/vehicle-meshes.js';
// GLTFExporter uses the browser FileReader interface for packing a Blob; Node supplies Blob natively.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}).catch(error=>this.onerror?.(error));}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result='data:application/octet-stream;base64,'+Buffer.from(result).toString('base64');this.onloadend?.();}).catch(error=>this.onerror?.(error));}};
await mkdir(new URL('../public/vehicles/',import.meta.url),{recursive:true});const manifest=[];
for(const spec of VEHICLES.filter(v=>!process.argv[2]||v.id===process.argv[2])){
  const root=createVehicle(spec.id);delete root.userData.body;delete root.userData.wheels;
  const triangles=triangleCount(root);const glb=await new GLTFExporter().parseAsync(root,{binary:true});
  await writeFile(new URL('../public/vehicles/'+spec.id+'.glb',import.meta.url),Buffer.from(glb));manifest.push({id:spec.id,name:spec.name,triangles,bytes:glb.byteLength});
}
await writeFile(new URL('../public/vehicles/manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');console.table(manifest);
