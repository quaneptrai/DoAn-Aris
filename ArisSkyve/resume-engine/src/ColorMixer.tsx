import { useEffect, useRef, useState } from 'react';

const swatches = ['#172c3d','#123c32','#243b69','#43318d','#6c2d55','#8b3439','#a5562b','#74613c','#27605e','#333333','#64748b','#ffffff', '#b5efce','#c6ddff','#d6c9ff','#f4c8e3','#ffd1ca','#ffdda8','#fff0b7','#dcefae','#bae6e6','#e2e8f0','#f4f1eb','#111827'];
const clamp = (x: number, max = 255) => Math.max(0, Math.min(max, Number.isFinite(x) ? x : 0));
const rgbHex = (rgb: number[]) => '#' + rgb.map(x => Math.round(clamp(x)).toString(16).padStart(2, '0')).join('');
function toRgb(value: string) { return /^#[a-f0-9]{6}$/i.test(value) ? [1,3,5].map(i => parseInt(value.slice(i,i+2),16)) : [23,44,61]; }
function toHsv(hex: string): [number, number, number] {
  const [r,g,b] = toRgb(hex).map(x => x/255); const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
  const h=delta===0?0:max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
  return [(h*60+360)%360,max===0?0:delta/max,max];
}
function fromHsv(h: number,s: number,v: number) {
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  const parts=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return rgbHex(parts.map(a=>(a+m)*255));
}

export function ColorMixer({value,label,onApply,onClose}:{value:string;label:string;onApply:(color:string)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null); const square=useRef<HTMLDivElement>(null);
  const [hsv,setHsv]=useState<[number,number,number]>(()=>toHsv(value));
  const [hexInput,setHexInput]=useState(value); const hex=fromHsv(...hsv); const rgb=toRgb(hex);
  const [recent]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('aris-recent-colors')||'[]').filter((x:unknown)=>typeof x==='string'&&/^#[a-f0-9]{6}$/i.test(x)).slice(0,8)}catch{return[]}});
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus()},[]);
  const choose=(color:string)=>{setHsv(toHsv(color));setHexInput(color)};
  const move=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=square.current!.getBoundingClientRect();const next:[number,number,number]=[hsv[0],clamp((event.clientX-rect.left)/rect.width,1),1-clamp((event.clientY-rect.top)/rect.height,1)];setHsv(next);setHexInput(fromHsv(...next))};
  const apply=()=>{try{localStorage.setItem('aris-recent-colors',JSON.stringify([hex,...recent.filter(x=>x!==hex)].slice(0,8)))}catch{}onApply(hex);onClose()};
  return <dialog className="color-dialog interactive-only" ref={dialog} onCancel={onClose} aria-labelledby="mixer-title"><header><div><small>COLOR STUDIO</small><h2 id="mixer-title">{label}</h2></div><button onClick={onClose} aria-label="Đóng bộ chọn màu">×</button></header>
    <div ref={square} className="color-plane" style={{backgroundColor:`hsl(${hsv[0]} 100% 50%)`}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);move(e)}} onPointerMove={e=>{if(e.buttons===1)move(e)}}><span style={{left:`${hsv[1]*100}%`,top:`${(1-hsv[2])*100}%`,backgroundColor:hex}}/></div>
    <label className="mixer-range">Sắc độ<input aria-label="Sắc độ" type="range" min="0" max="359" value={hsv[0]} className="hue-range" onChange={e=>{const next:[number,number,number]=[Number(e.target.value),hsv[1],hsv[2]];setHsv(next);setHexInput(fromHsv(...next))}}/></label>
    <div className="mixer-sliders"><label>Độ bão hòa<input type="range" min="0" max="100" value={hsv[1]*100} onChange={e=>{const n:[number,number,number]=[hsv[0],Number(e.target.value)/100,hsv[2]];setHsv(n);setHexInput(fromHsv(...n))}}/></label><label>Độ sáng<input type="range" min="0" max="100" value={hsv[2]*100} onChange={e=>{const n:[number,number,number]=[hsv[0],hsv[1],Number(e.target.value)/100];setHsv(n);setHexInput(fromHsv(...n))}}/></label></div>
    <div className="mixer-values"><span className="color-result" style={{background:hex}}/><label>HEX<input value={hexInput} maxLength={7} onChange={e=>{setHexInput(e.target.value);const x=e.target.value.startsWith('#')?e.target.value:`#${e.target.value}`;if(/^#[a-f0-9]{6}$/i.test(x))setHsv(toHsv(x))}} onBlur={()=>setHexInput(hex)}/></label>{['R','G','B'].map((name,i)=><label key={name}>{name}<input type="number" min="0" max="255" value={rgb[i]} onChange={e=>{const n=[...rgb];n[i]=clamp(Number(e.target.value));choose(rgbHex(n))}}/></label>)}</div>
    <div className="mixer-swatches">{swatches.map(c=><button key={c} aria-label={`Chọn ${c}`} title={c} style={{background:c}} onClick={()=>choose(c)}/>)}</div>{recent.length>0&&<><small>Màu gần đây</small><div className="mixer-swatches recent">{recent.map(c=><button key={c} aria-label={`Màu gần đây ${c}`} style={{background:c}} onClick={()=>choose(c)}/>)}</div></>}
    <footer><button onClick={onClose}>Hủy</button><button className="primary" onClick={apply}>Áp dụng màu</button></footer></dialog>;
}
