import jsQR from 'jsqr';

/** Read the full image, then bounded overlapping regions to avoid receipt text
 * being mistaken for QR finder patterns. No pixels leave the device. */
export function readQrPixels(data:Uint8ClampedArray,width:number,height:number,scanEdges=true):string|null {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||data.length!==width*height*4)return null;
  const full=jsQR(data,width,height,{inversionAttempts:'attemptBoth'});
  if(full?.data)return full.data;
  const tried=new Set<string>();
  const readRegion=(x:number,y:number,size:number)=>{
    const key=x+':'+y+':'+size;if(tried.has(key))return null;tried.add(key);
    const region=new Uint8ClampedArray(size*size*4);
    for(let row=0;row<size;row++)region.set(data.subarray(((y+row)*width+x)*4,((y+row)*width+x+size)*4),row*size*4);
    return jsQR(region,size,size,{inversionAttempts:'attemptBoth'})?.data||null;
  };
  for(const fraction of [.7,.4]) {
    const size=Math.max(1,Math.round(Math.min(width,height)*fraction));
    const result=readRegion(Math.floor((width-size)/2),Math.floor((height-size)/2),size);
    if(result)return result;
  }
  if(scanEdges){
    const size=Math.max(1,Math.round(Math.min(width,height)*.55));
    for(const fy of [0,.5,1])for(const fx of [0,.5,1]){
      const result=readRegion(Math.round((width-size)*fx),Math.round((height-size)*fy),size);
      if(result)return result;
    }
  }
  return null;
}
