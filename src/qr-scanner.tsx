'use client';
import { useEffect,useRef,useState } from 'react';
import { Camera,ImagePlus,ScanLine,VideoOff } from 'lucide-react';

export function QrScanner({onRead,disabled}:{onRead:(value:string)=>void;disabled:boolean}) {
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),input=useRef<HTMLInputElement>(null);
  const [active,setActive]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const release=()=>{generation.current++;if(timer.current)clearTimeout(timer.current);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;};
  const stop=()=>{release();setActive(false);setLoading(false);};
  useEffect(()=>{const hidden=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hidden);return()=>{release();document.removeEventListener('visibilitychange',hidden);};},[]);
  const start=async()=>{
    stop();setError('');setLoading(true);
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){setLoading(false);setError('A câmera precisa de HTTPS e de um navegador compatível. Use uma foto do QR Code ou cole o link.');return;}
    const run=++generation.current;
    try{
      const {readQrPixels}=await import('./qr-reader');
      if(run!==generation.current)return;
      const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
      if(run!==generation.current){camera.getTracks().forEach(t=>t.stop());return;}
      stream.current=camera;setActive(true);setLoading(false);
      const element=video.current;
      if(!element){camera.getTracks().forEach(t=>t.stop());return;}
      element.srcObject=camera;await element.play();
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
      if(!context)throw new Error('Canvas indisponível');
      const frame=()=>{
        if(run!==generation.current)return;
        if(element.readyState>=2&&element.videoWidth){
          const scale=Math.min(1,960/element.videoWidth);canvas.width=Math.round(element.videoWidth*scale);canvas.height=Math.round(element.videoHeight*scale);
          context.drawImage(element,0,0,canvas.width,canvas.height);
          const pixels=context.getImageData(0,0,canvas.width,canvas.height),code=readQrPixels(pixels.data,canvas.width,canvas.height,false);
          if(code){stop();onRead(code);return;}
        }
        timer.current=setTimeout(frame,240);
      };
      frame();
    }catch{if(run===generation.current){stop();setError('Não foi possível abrir a câmera. Confira a permissão do navegador ou use uma foto do QR Code.');}}
  };
  const readImage=async(file:File)=>{
    stop();setLoading(true);setError('');
    if(file.size>10000000){setError('Escolha uma imagem de até 10 MB.');setLoading(false);return;}
    const run=++generation.current,url=URL.createObjectURL(file);
    try{
      const [{readQrPixels},image]=await Promise.all([import('./qr-reader'),new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;})]);
      const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
      if(run!==generation.current)return;
      if(!context)throw new Error('Canvas indisponível');
      const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height),code=readQrPixels(pixels.data,canvas.width,canvas.height);
      if(!code)throw new Error('QR ilegível');
      setLoading(false);onRead(code);
    }catch{if(run===generation.current){setError('Não encontrei um QR Code legível. Aproxime a foto do código, evite reflexos ou cole o link da nota.');setLoading(false);}}
    finally{URL.revokeObjectURL(url);}
  };
  return <div className="qr-scanner">
    <div className={'scanner-view '+(active?'camera-active':'')}>
      <video ref={video} autoPlay playsInline muted aria-label="Câmera para leitura do QR Code"/>
      {!active&&<div className="scanner-placeholder"><div className="scanner-target"><ScanLine size={39} strokeWidth={1.3}/><i/><i/><i/><i/></div><strong>{loading?'Preparando leitura…':'Aponte para o QR Code da nota'}</strong><p>Ou escolha uma foto nítida do código.<br/>A imagem é lida neste dispositivo.</p></div>}
      {active&&<span className="scanner-guide">Centralize o QR Code dentro da imagem</span>}
    </div>
    <div className="scanner-actions"><button type="button" className="btn dark" disabled={disabled||loading} onClick={()=>active?stop():void start()}>{active?<VideoOff size={17}/>:<Camera size={17}/>} {active?'Parar câmera':'Abrir câmera'}</button><button type="button" className="btn secondary" disabled={disabled||loading} onClick={()=>input.current?.click()}><ImagePlus size={17}/>Foto do QR Code</button><input className="file-input-hidden" aria-label="Selecionar imagem do QR Code" type="file" accept="image/*" ref={input} onChange={e=>{const file=e.target.files?.[0];if(file)void readImage(file);e.target.value='';}}/></div>
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>;
}
