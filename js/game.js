'use strict';
/* ============ utilidades ============ */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rnd=(a,b)=>a+Math.random()*(b-a);
const fmtT=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const fmtN=(v,d=1)=>v.toFixed(d).replace('.',',');
const IC={
 pin:'<circle cx="8" cy="8" r="4.5"/><path d="M11.5 11.5L21 21M17 17l2-2"/>',
 target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
 lever:'<path d="M3 9l9-4 8 3-2 4-6-2-7 3z"/><path d="M8 18h9"/>',
 sweep:'<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
 warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
 alarm:'<path d="M6 17v-6a6 6 0 0112 0v6l2 2H4z"/><path d="M10 21h4"/>',
 exit:'<path d="M14 4h6v16h-6M3 12h11M10 8l4 4-4 4"/>',
 clock:'<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 2h6"/>',
 flame:'<path d="M12 2c1 4 6 6 6 12a6 6 0 01-12 0c0-3 2-4 3-7 1 1 2 2 2 3 1-2 1-5 1-8z"/>',
 ext:'<rect x="8" y="9" width="8" height="13" rx="2"/><path d="M10 9V6h5l3-2M11 4h3"/>',
 snd:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
 mute:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 up:'<path d="M5 15l7-7 7 7"/>', dn:'<path d="M5 9l7 7 7-7"/>',
 smoke:'<path d="M6 18a4 4 0 010-8 5 5 0 019-1 4 4 0 011 9z"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>', cross:'<path d="M6 6l12 12M18 6L6 18"/>',
 bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', ruler:'<path d="M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2"/>',
};
const ico=(n,s)=>`<svg class="i" viewBox="0 0 24 24"${s?` style="width:${s}px;height:${s}px"`:''}>${IC[n]}</svg>`;

/* ============ progreso ============ */
let SAVE={unlocked:1,stars:[0,0,0,0,0]};
try{const s=JSON.parse(localStorage.getItem('apaga-el-fuego')||'null');if(s&&s.unlocked)SAVE=s}catch(e){}
const persist=()=>{try{localStorage.setItem('apaga-el-fuego',JSON.stringify(SAVE))}catch(e){}};

/* ============ datos ============ */
const AG={
 abc:{n:'Polvo ABC',col:'#efe1d6',lab:'#2f6fd6',tx:'ABC',l2:'POLVO SECO',hint:'Polvo químico seco',freq:3000},
 agua:{n:'Agua',col:'#a8d7ff',lab:'#3aa0ff',tx:'H₂O',l2:'AGUA',hint:'Agua a presión',freq:1500},
 co2:{n:'CO₂',col:'#eef6ff',lab:'#2b2b2b',tx:'CO₂',l2:'GAS',hint:'Dióxido de carbono',freq:4600,horn:true},
 k:{n:'Clase K',col:'#fff0b0',lab:'#f2c500',tx:'K',l2:'COCINAS',hint:'Para grasas de cocina',freq:2300}
};
const EFF={
 A:{abc:{e:1,rk:1}},
 C:{co2:{e:1,rk:.7},abc:{e:.85,rk:1,note:'abc_c'},agua:{fail:'elec'}},
 K:{k:{e:1.1,rk:.35},abc:{e:.5,rk:2.4,note:'abc_k'},agua:{fail:'flare'}},
 B:{abc:{e:1,rk:1},co2:{e:.65,rk:1.7,note:'co2_b'},agua:{fail:'spread'}}
};
const KIND={
 A:{h:120,w:1,c0:'rgba(214,48,10,.93)',c1:'rgba(255,142,22,.95)',c2:'rgba(255,230,130,.97)'},
 C:{h:95,w:.85,c0:'rgba(226,66,20,.93)',c1:'rgba(255,170,40,.95)',c2:'rgba(190,226,255,.97)'},
 K:{h:150,w:1.15,c0:'rgba(210,58,10,.93)',c1:'rgba(255,172,30,.95)',c2:'rgba(255,242,150,.97)'},
 B:{h:105,w:1.22,c0:'rgba(150,26,10,.94)',c1:'rgba(238,96,18,.95)',c2:'rgba(255,200,90,.96)'}
};
const row=(n,x0,dx,by,lit)=>Array.from({length:n},(_,i)=>[x0+i*dx,by,lit[i]||0]);
const LV=[
 {id:1,name:'Oficina',sub:'Papelero en llamas',cls:'A',scene:'office',time:45,charge:12,g:.055,gre:.09,spread:.18,rek:.10,lose:.62,dist:4.2,cx:-20,opts:['abc'],
  cells:[[-150,56,.5],[-118,56,.55],[-86,56,.45],[-8,14,0],[26,14,0],[60,14,0],[94,14,0]],
  intro:'Se incendió el papelero de la oficina.'},
 {id:2,name:'Sala de servidores',sub:'Humo en un rack',cls:'C',scene:'dc',time:40,charge:10,g:.07,gre:.08,spread:.2,rek:.12,lose:.6,dist:4.4,cx:-60,opts:['agua','abc','co2'],
  cells:row(6,-130,30,30,[0,0,.5,.55,0,0]),
  intro:'Sale fuego de un rack que sigue energizado. ¿Qué extintor tomas?'},
 {id:3,name:'Casino · cocina',sub:'Sartén con aceite',cls:'K',scene:'kitchen',time:40,charge:10,g:.08,gre:.10,spread:.2,rek:.14,lose:.6,dist:4.2,cx:-30,opts:['agua','abc','k'],
  cells:[[-95,8,.55],[-65,8,.6],[-35,8,.5],[12,26,0],[46,26,0]],
  intro:'Una sartén con aceite caliente se incendió en la cocina. ¿Qué extintor tomas?'},
 {id:4,name:'Taller',sub:'Líquido inflamable',cls:'B',scene:'shop',time:45,charge:12,g:.085,gre:.16,spread:.26,rek:.28,lose:.6,dist:4.5,cx:-118,opts:['agua','abc','co2'],
  cells:row(8,-230,32,104,[0,0,0,.5,.55,0,0,0]),
  intro:'Se derramó un líquido inflamable en el piso y prendió. ¿Qué extintor tomas?'},
 {id:5,name:'Bodega con humo',sub:'¿Apagar o evacuar?',cls:'A',scene:'wh',time:40,charge:8,g:.11,gre:.12,spread:.5,rek:.2,lose:.97,dist:4.4,cx:40,opts:['abc'],smoke:true,
  cells:row(8,-170,34,78,[0,0,.4,.55,.5,0,0,0]),
  intro:'Hay fuego en cajas y mucho humo. La salida de emergencia está a tu derecha: decide si apagar o evacuar.'}
];

/* ============ canvas ============ */
const cv=$('#cv'),ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,S=1,HY=0,CX=0,portrait=false;
function resize(){
  W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);
  cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
  portrait=H>W;S=Math.min(W/520,H/560);HY=H*(portrait?.36:.4);CX=W/2;
}
addEventListener('resize',resize);resize();

function mkSprite(sz,stops){const c=document.createElement('canvas');c.width=c.height=sz;const g=c.getContext('2d');
  const r=g.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,sz/2);stops.forEach(s=>r.addColorStop(s[0],s[1]));g.fillStyle=r;g.fillRect(0,0,sz,sz);return c}
const hex2=(h,a)=>{const n=parseInt(h.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`};
const SPR={
 glow:mkSprite(128,[[0,'rgba(255,190,90,.9)'],[.4,'rgba(255,110,30,.35)'],[1,'rgba(255,60,0,0)']]),
 glowB:mkSprite(128,[[0,'rgba(190,225,255,.8)'],[.4,'rgba(255,130,50,.3)'],[1,'rgba(255,60,0,0)']]),
 smoke:mkSprite(64,[[0,'rgba(70,70,74,.6)'],[1,'rgba(70,70,74,0)']]),
 spark:mkSprite(16,[[0,'rgba(255,240,180,1)'],[1,'rgba(255,160,40,0)']]),
 arc:mkSprite(16,[[0,'rgba(210,235,255,1)'],[1,'rgba(120,180,255,0)']])
};
for(const k in AG)SPR['ag_'+k]=mkSprite(64,[[0,hex2(AG[k].col,1)],[.5,hex2(AG[k].col,.6)],[1,hex2(AG[k].col,0)]]);

/* ============ audio ============ */
const A={ctx:null,muted:false,t:0};
function audioInit(){
  if(A.ctx){if(A.ctx.state==='suspended')A.ctx.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const c=A.ctx=new AC();
  A.master=c.createGain();A.master.gain.value=A.muted?0:1;
  const comp=c.createDynamicsCompressor();comp.threshold.value=-28;comp.knee.value=20;comp.ratio.value=10;comp.attack.value=.004;comp.release.value=.2;
  const mk=c.createGain();mk.gain.value=2.4;
  const lim=c.createDynamicsCompressor();lim.threshold.value=-4;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.001;lim.release.value=.1;
  A.master.connect(comp);comp.connect(mk);mk.connect(lim);lim.connect(c.destination);
  const len=c.sampleRate*2,wb=c.createBuffer(1,len,c.sampleRate),bb=c.createBuffer(1,len,c.sampleRate);
  const d=wb.getChannelData(0),d2=bb.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;d[i]=w;last=(last+.02*w)/1.02;d2[i]=last*3.5}
  A.wb=wb;
  const loop=b=>{const s=c.createBufferSource();s.buffer=b;s.loop=true;s.start();return s};
  const chain=(src,type,f,q,g)=>{const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const gn=c.createGain();gn.gain.value=0;src.connect(fl);fl.connect(gn);gn.connect(A.master);return{fl,gn}};
  A.fire=chain(loop(bb),'lowpass',700,.7);
  A.crk=chain(loop(wb),'bandpass',2600,.7);
  A.ext=chain(loop(wb),'bandpass',3000,.6);
  const o=c.createOscillator();o.type='square';o.frequency.value=900;
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2400;
  A.alG=c.createGain();A.alG.gain.value=0;o.connect(lp);lp.connect(A.alG);A.alG.connect(A.master);o.start();A.alO=o;
}
function tone(f,d,type='sine',v=.25,delay=0,slide=0){
  if(!A.ctx)return;const c=A.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g);g.connect(A.master);o.start(t);o.stop(t+d+.05);
}
function burst(d,f,v,type='bandpass'){
  if(!A.ctx)return;const c=A.ctx,t=c.currentTime,s=c.createBufferSource();s.buffer=A.wb;
  const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;const g=c.createGain();
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(fl);fl.connect(g);g.connect(A.master);s.start(t);s.stop(t+d+.05);
}
const SFX={
 pin(){tone(1900,.08,'square',.12);tone(1300,.1,'square',.1,.06);burst(.08,5000,.2)},
 lever(){tone(300,.06,'square',.15);burst(.05,2000,.15)},
 win(){[523,659,784,1046].forEach((f,i)=>tone(f,.28,'triangle',.28,i*.11))},
 lose(){tone(330,.5,'sawtooth',.2,0,-160);tone(220,.7,'sawtooth',.2,.25,-100)},
 zap(){burst(.5,3500,.6,'highpass');tone(120,.5,'sawtooth',.3,0,-60);tone(60,.6,'square',.25)},
 flare(){burst(1.1,500,.8,'lowpass');tone(90,.9,'sawtooth',.25,0,-40)},
 warn(){tone(700,.09,'triangle',.18)},
 door(){tone(520,.12,'triangle',.2);tone(780,.2,'triangle',.2,.1)}
};
function audioTick(dt,g){
  if(!A.ctx)return;const c=A.ctx,t=c.currentTime;A.t+=dt;
  const play=mode==='play'&&g&&!g.over;
  const frac=g?clamp(g.sum/g.N,0,1):0;
  A.fire.gn.gain.setTargetAtTime((mode==='play'&&g)?.04+frac*.5:.06,t,.1);
  A.crk.gn.gain.setTargetAtTime(0,t,.02);
  if(mode==='play'&&g&&Math.random()<frac*dt*30){A.crk.gn.gain.setValueAtTime(rnd(.08,.3)*(.4+frac),t);A.crk.gn.gain.exponentialRampToValueAtTime(.001,t+.05)}
  const on=mode==='play'&&g&&g.disch;
  if(on){A.ext.fl.frequency.setTargetAtTime(AG[g.agent].freq,t,.03)}
  A.ext.gn.gain.setTargetAtTime(on?.55:0,t,.03);
  const al=mode==='play'&&g&&!g.over;
  A.alO.frequency.setTargetAtTime(Math.floor(A.t*2)%2?760:980,t,.005);
  A.alG.gain.setTargetAtTime(al?(g.L.smoke?.1:.06):0,t,.05);
}
function setMuted(m){
  A.muted=m;if(A.master)A.master.gain.value=m?0:1;
  if(m&&'speechSynthesis' in window)try{speechSynthesis.cancel()}catch(e){}
  $('#bMute').innerHTML=ico(m?'mute':'snd');$('#bMute2').innerHTML=ico(m?'mute':'snd',20);
}

/* ============ voz ============ */
let VOICE=null,lastSay=0;
function pickVoice(){
  if(!('speechSynthesis' in window))return;const vs=speechSynthesis.getVoices();
  VOICE=vs.find(v=>v.lang.replace('_','-')==='es-CL')||vs.find(v=>/^es-(419|US|MX|AR)/i.test(v.lang))||vs.find(v=>/^es/i.test(v.lang))||null;
}
if('speechSynthesis' in window){pickVoice();speechSynthesis.onvoiceschanged=pickVoice}
function say(txt,force){
  if(A.muted||!('speechSynthesis' in window))return;
  const n=performance.now();if(!force&&n-lastSay<1700)return;lastSay=n;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(txt);u.lang=VOICE?VOICE.lang:'es-CL';if(VOICE)u.voice=VOICE;u.rate=1.08;u.volume=1;speechSynthesis.speak(u)}catch(e){}
}

/* ============ escenas ============ */
const R=(c,x,y,w,h,f)=>{c.fillStyle=f;c.fillRect(x,y,w,h)};
function RR(c,x,y,w,h,r,f,s){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();if(f){c.fillStyle=f;c.fill()}if(s){c.strokeStyle=s;c.stroke()}}
function LG(c,x0,y0,x1,y1,st){const g=c.createLinearGradient(x0,y0,x1,y1);st.forEach(s=>g.addColorStop(s[0],s[1]));return g}
function floorGrid(c,col){c.strokeStyle=col;c.lineWidth=2;c.beginPath();for(let k=-14;k<=14;k++){c.moveTo(k*160,1300);c.lineTo(k*160*(40/1300),40)}
  for(let i=1;i<9;i++){const y=40+Math.pow(i/8,1.7)*1260;c.moveTo(-1500,y);c.lineTo(1500,y)}c.stroke()}
function wallFloor(c,wallA,wallB,base,fA,fB,grid){
  R(c,-1500,-1400,3000,1440,LG(c,0,-700,0,40,[[0,wallA],[1,wallB]]));
  R(c,-1500,26,3000,14,base);R(c,-1500,40,3000,1400,LG(c,0,40,0,700,[[0,fA],[1,fB]]));floorGrid(c,grid);
}
function exitSign(c,t,glow){
  const p=.75+.25*Math.sin(t*3);
  if(glow){const g=c.createRadialGradient(280,-70,5,280,-70,150);g.addColorStop(0,`rgba(80,255,150,${.5*p})`);g.addColorStop(1,'rgba(80,255,150,0)');c.fillStyle=g;c.fillRect(100,-250,360,360)}
  R(c,240,-98,80,30,'#0d6b3a');R(c,243,-95,74,24,'#16a35b');
  c.fillStyle='#fff';c.font='bold 15px sans-serif';c.textAlign='center';c.fillText('SALIDA',280,-78);
}
const SC={
 office:{
  bg(c,t){
    wallFloor(c,'#8da09e','#a8b8b4','#5a6968','#3c4650','#2a323a','rgba(255,255,255,.05)');
    R(c,190,-250,180,200,'#d7dcdf');R(c,198,-242,164,184,LG(c,0,-242,0,-58,[[0,'#8fbce3'],[1,'#dff0fb']]));
    for(let i=0;i<9;i++)R(c,198,-242+i*21,164,3,'rgba(255,255,255,.55)');
    R(c,-400,-215,190,125,'#bfc6c6');R(c,-394,-209,178,113,'#eceeee');
    c.strokeStyle='#3a6ea5';c.lineWidth=3;c.beginPath();c.moveTo(-380,-185);c.lineTo(-300,-185);c.moveTo(-380,-160);c.lineTo(-330,-160);c.stroke();
    c.strokeStyle='#c0392b';c.beginPath();c.moveTo(-380,-130);c.lineTo(-290,-120);c.stroke();
    c.fillStyle='#f4f4f0';c.beginPath();c.arc(-50,-170,24,0,7);c.fill();c.strokeStyle='#333';c.lineWidth=3;c.stroke();
    c.beginPath();c.moveTo(-50,-170);c.lineTo(-50,-188);c.moveTo(-50,-170);c.lineTo(-38,-164);c.stroke();
  },
  mid(c){
    R(c,-30,-60,14,90,'#2b3138');RR(c,-60,-70,70,70,10,'#353d45');
    R(c,-40,24,380,12,'#7c5c3b');R(c,-40,12,380,12,'#93724c');R(c,-32,36,364,74,'#6a4d31');
    R(c,-28,44,110,58,'#5d422a');R(c,86,44,110,58,'#5d422a');R(c,200,44,126,58,'#5d422a');
    R(c,26,68,22,5,'#c9ccd0');R(c,130,68,22,5,'#c9ccd0');R(c,250,68,22,5,'#c9ccd0');
    R(c,190,-76,70,64,'#15191d');R(c,196,-70,58,50,LG(c,0,-70,0,-20,[[0,'#2b6a9b'],[1,'#17405f']]));R(c,215,-12,20,14,'#2a2f35');R(c,200,0,50,6,'#2a2f35');
    R(c,120,6,60,7,'#20252a');
    R(c,-30,6,95,6,'#f2f2ee');R(c,-26,2,88,5,'#e6e4d8');
    RR(c,300,-4,18,18,3,'#c0392b');
    // papelero
    c.beginPath();c.moveTo(-160,52);c.lineTo(-76,52);c.lineTo(-84,110);c.lineTo(-152,110);c.closePath();c.fillStyle=LG(c,-160,0,-76,0,[[0,'#59616c'],[.5,'#8a929c'],[1,'#4d555f']]);c.fill();
    c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=2;c.beginPath();for(let x=-146;x<-84;x+=10){c.moveTo(x,60);c.lineTo(x+1,104)}c.stroke();
    R(c,-164,49,92,6,'#3f464e');
  }
 },
 dc:{
  bg(c,t){
    wallFloor(c,'#10151b','#1b222b','#0b0e12','#27303a','#161c23','rgba(120,170,220,.10)');
    for(let i=0;i<7;i++)R(c,-700+i*230,-330,120,8,'#2c343e');
    const p=.5+.5*Math.sin(t*5);
    const g=c.createRadialGradient(0,-80,10,0,-80,620);g.addColorStop(0,`rgba(255,40,30,${.12+.10*p})`);g.addColorStop(1,'rgba(255,40,30,0)');c.fillStyle=g;c.fillRect(-900,-600,1800,1000);
  },
  mid(c,t){
    for(let r=0;r<4;r++){
      const x=-260+r*110;
      R(c,x,-190,105,300,LG(c,x,0,x+105,0,[[0,'#1c2229'],[.5,'#2c353f'],[1,'#1c2229']]));
      R(c,x+7,-182,91,286,'#121619');
      for(let u=0;u<14;u++){const y=-176+u*20;R(c,x+10,y,85,16,u%3===0?'#222a32':'#1a2027');
        const on=Math.sin(t*3+u*1.7+r*2.3)>-.2;R(c,x+14,y+6,4,4,on?'#42e07a':'#1c5c36');R(c,x+22,y+6,4,4,(u+r)%4===0&&Math.sin(t*6+u)>0?'#ffb32a':'#5a4310');
        c.strokeStyle='rgba(255,255,255,.07)';c.beginPath();c.moveTo(x+40,y+8);c.lineTo(x+92,y+8);c.stroke()}
    }
    R(c,-262,-196,5,310,'#0c0f12');
  }
 },
 kitchen:{
  bg(c){
    wallFloor(c,'#c3ccce','#dde4e5','#7d878b','#6d3f33','#4b2a22','rgba(0,0,0,.18)');
    c.strokeStyle='rgba(0,0,0,.12)';c.lineWidth=2;c.beginPath();for(let y=-300;y<26;y+=26){c.moveTo(-1500,y);c.lineTo(1500,y)}for(let x=-1400;x<1400;x+=52){c.moveTo(x,-300);c.lineTo(x,26)}c.stroke();
    R(c,70,-170,270,6,'#8a949a');R(c,80,-196,28,26,'#9aa3a8');R(c,120,-206,24,36,'#b0b8bc');R(c,160,-190,30,20,'#9aa3a8');
  },
  mid(c,t){
    c.beginPath();c.moveTo(-210,-190);c.lineTo(60,-190);c.lineTo(76,-120);c.lineTo(-226,-120);c.closePath();c.fillStyle=LG(c,-220,0,70,0,[[0,'#7f898f'],[.5,'#c4ccd0'],[1,'#7f898f']]);c.fill();
    R(c,-140,-330,120,140,'#8c969b');
    R(c,-190,26,260,84,LG(c,-190,0,70,0,[[0,'#8d979d'],[.5,'#d2d8db'],[1,'#8d979d']]));R(c,-190,22,260,8,'#5d666b');
    for(let i=0;i<4;i++){R(c,-176+i*24+ (i>1?22:0),60,14,14,'#262b2f')}
    R(c,-190,30,260,3,'rgba(0,0,0,.25)');
    RR(c,-112,12,86,16,5,'#1c1e21');R(c,-26,15,40,6,'#1c1e21');R(c,-108,10,78,5,'#3a2a14');
    R(c,70,26,270,84,LG(c,70,0,340,0,[[0,'#7b858b'],[.5,'#b4bcc0'],[1,'#7b858b']]));R(c,70,22,270,8,'#a77d4f');
    RR(c,6,10,16,16,3,'#e8e4dc');RR(c,40,16,40,10,3,'#c8453a');R(c,110,6,50,16,'#cfd6d9');R(c,115,0,10,6,'#e0e4e6');
  }
 },
 shop:{
  bg(c){
    wallFloor(c,'#80847f','#9a9d97','#4c504d','#575c5e','#3f4446','rgba(0,0,0,.2)');
    R(c,-1500,40,3000,16,'rgba(242,197,0,.5)');
    R(c,-420,-230,230,130,'#5a5f5c');
    c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=2;c.beginPath();for(let x=-410;x<-200;x+=18){c.moveTo(x,-225);c.lineTo(x,-105)}c.stroke();
    R(c,-380,-200,6,60,'#c9ced0');R(c,-340,-200,10,40,'#e0b44a');R(c,-290,-205,30,24,'#a8aeb0');R(c,-240,-200,8,70,'#c9ced0');
    R(c,40,-200,300,8,'#4d5256');R(c,40,-120,300,8,'#4d5256');R(c,50,-190,36,70,'#b8452e');R(c,100,-170,40,50,'#d9a62c');R(c,160,-180,30,60,'#4a76a8');
  },
  mid(c){
    R(c,90,24,260,12,'#6b7378');R(c,96,36,248,74,'#3d4348');R(c,100,40,100,60,'#2f3438');R(c,214,40,100,60,'#2f3438');
    R(c,250,-8,38,32,'#7e868b');R(c,262,-24,14,18,'#a8afb2');
    for(let i=0;i<2;i++){const x=-340-i*66;R(c,x,-4,58,114,LG(c,x,0,x+58,0,[[0,'#1f4f8f'],[.5,'#3d78c4'],[1,'#1f4f8f']]));R(c,x-2,-2,62,8,'#27292b');R(c,x-2,60,62,6,'#27292b')}
    c.save();c.translate(-6,98);c.rotate(-.3);R(c,-16,-10,32,24,'#c0392b');R(c,-6,-18,12,8,'#a8aeb0');c.restore();
    const gg=c.createLinearGradient(-250,0,10,0);gg.addColorStop(0,'rgba(20,20,34,.9)');gg.addColorStop(.5,'rgba(52,44,74,.9)');gg.addColorStop(1,'rgba(20,20,34,.9)');
    c.fillStyle=gg;c.beginPath();c.ellipse(-120,106,135,10,0,0,7);c.fill();
    c.fillStyle='rgba(120,200,160,.18)';c.beginPath();c.ellipse(-150,104,50,3,0,0,7);c.fill();
  }
 },
 wh:{
  bg(c,t){
    wallFloor(c,'#2b3035','#3c4248','#1f2327','#454b50','#2d3236','rgba(255,255,255,.06)');
    c.strokeStyle='rgba(0,0,0,.28)';c.lineWidth=3;c.beginPath();for(let x=-1400;x<1400;x+=40){c.moveTo(x,-700);c.lineTo(x,26)}c.stroke();
    for(let i=0;i<4;i++){const x=-420+i*260;R(c,x,-280,110,10,'#e9e2c6');const g=c.createRadialGradient(x+55,-275,5,x+55,-275,220);g.addColorStop(0,'rgba(255,240,200,.18)');g.addColorStop(1,'rgba(255,240,200,0)');c.fillStyle=g;c.fillRect(x-170,-290,390,360)}
    c.fillStyle='rgba(242,197,0,.55)';c.beginPath();c.moveTo(250,42);c.lineTo(330,42);c.lineTo(420,640);c.lineTo(260,640);c.closePath();c.fill();
    R(c,235,-40,95,70,'#10482c');R(c,244,-32,77,62,'#1d7a4a');R(c,288,-6,5,5,'#e0e0e0');
    exitSign(c,t,false);
  },
  mid(c){
    const boxes=[[-190,0],[-150,0],[-110,0],[-70,0],[-30,0],[10,0],[50,0]];
    R(c,-196,96,282,12,'#7a5a36');R(c,-196,108,282,5,'#5e4528');
    boxes.forEach((b,i)=>{R(c,b[0],96-40-(i%3)*0,38,40,i%2?'#a98056':'#b88c5e');R(c,b[0]+16,56,6,40,'rgba(255,255,255,.2)')});
    R(c,-150,16,38,40,'#a98056');R(c,-100,16,40,40,'#b88c5e');R(c,-20,16,38,40,'#a98056');R(c,24,16,40,40,'#b88c5e');R(c,-196,20,6,80,'#6b4c2c');
    RR(c,120,52,44,58,6,'#2f5aa0');RR(c,172,52,44,58,6,'#b8452e');R(c,120,66,44,5,'rgba(0,0,0,.3)');R(c,172,66,44,5,'rgba(0,0,0,.3)');
  }
 }
};

/* ============ estado ============ */
let mode='menu',G=null,selLevel=1;
let dist=4.2,aim={x:0,y:0},aimT={x:0,y:0},PL={f:1,sc:1,ox:0,oy:0},offx=0,offy=0,shake=0,flash=null;
const held={near:false,far:false},lever={btn:false,mouse:false,key:false},keys={up:false,dn:false};
const parts=[],stream=[],cloud=[],pinFly=[];
function plane(){const L=G?G.L:LV[selLevel-1];const f=Math.pow(2.5/dist,.7);
  const sx=shake?rnd(-1,1)*shake*14:0,sy=shake?rnd(-1,1)*shake*14:0;
  offx=-(aim.x-CX)*.05+sx;offy=-(aim.y-HY)*.02+sy;
  PL={f,sc:S*f,ox:CX-L.cx*S*f+offx,oy:HY+offy}}
const toWorld=(x,y)=>({x:(x-PL.ox)/PL.sc,y:(y-PL.oy)/PL.sc});
const toScreen=(x,y)=>({x:PL.ox+x*PL.sc,y:PL.oy+y*PL.sc});
const leverHeld=()=>lever.btn||lever.mouse||lever.key;

function newGame(n,agent){
  const L=LV[n-1];
  const cells=L.cells.map(c=>({x:c[0],by:c[1],lit:c[2]>0,ever:c[2]>0,life:c[2],heat:0,cover:0,seed:Math.random()*20}));
  const sum=cells.reduce((a,c)=>a+c.life,0);
  return {n,L,agent,cells,N:cells.length,sum,sum0:sum,charge:L.charge,timeLeft:L.time,t:0,over:false,pend:null,
    pinOut:false,pinAt:null,aimed:false,usedLever:false,disch:false,vS:0,pa:{x:0,y:0},ai:{},baseT:0,
    smoke:0,wt:{off:0,far:0,still:0},nag:{},warn:null,winT:0,failT:0,fail:null,note:null,
    st:{dis:0,base:0,high:0,off:0,far:0,near:0,good:0,still:0,sweep:0,rek:0,nagPin:0,empty:false},sweepDone:false,evac:null};
}
function startLevel(n,agent){
  audioInit();
  G=newGame(n,agent);dist=G.L.dist;shake=0;flash=null;parts.length=stream.length=cloud.length=pinFly.length=0;
  plane();const f=G.cells.filter(c=>c.lit);const mx=f.reduce((a,c)=>a+c.x,0)/f.length,my=f.reduce((a,c)=>a+c.by,0)/f.length;
  const s=toScreen(mx,my-60);aim.x=aimT.x=s.x;aim.y=aimT.y=s.y;G.pa={x:aim.x,y:aim.y};
  mode='play';show(null);document.body.classList.add('playing');
  $('#bEvac').classList.toggle('show',!!G.L.smoke);$('#hSmoke').style.display=G.L.smoke?'inline-flex':'none';
  $('#bPin').classList.remove('done');
  lastToast='';setStep(true);say('¡Fuego! Saca el pasador.',true);
}
function previewLevel(n){G=newGame(n,LV[n-1].opts[0]);G.over=true;dist=G.L.dist;parts.length=stream.length=cloud.length=0;selLevel=n}

/* ============ aviso (toast) ============ */
let lastToast='';
function toast(kind,icon,text,dots){
  const key=kind+icon+text+dots;if(key===lastToast)return;lastToast=key;
  const el=$('#toast');el.className='chip '+(kind==='info'?'':kind);
  el.innerHTML=(dots>=0?`<span class="dots">${[0,1,2,3].map(i=>`<i class="${i<dots?'on':''}"></i>`).join('')}</span>`:'')+`<span class="ic">${ico(icon)}</span><span>${text}</span>`;
}
function note(kind,icon,text,ms,voice){G.warn={kind,icon,text,until:performance.now()+ms};if(voice)say(voice);SFX.warn()}
const STEPTX=[['pin','Saca el pasador'],['target','Apunta a la base del fuego'],['lever','Aprieta la palanca'],['sweep','Barre de lado a lado, a 2–3 m']];
let lastStep=0;
function curStep(g){return !g.pinOut?1:!g.aimed?2:!g.usedLever?3:4}
function setStep(force){
  const g=G;if(!g)return;const s=curStep(g);
  const done=(g.pinOut?1:0)+(g.aimed?1:0)+(g.usedLever?1:0)+(g.sweepDone?1:0);
  if(g.warn&&performance.now()<g.warn.until){toast(g.warn.kind,g.warn.icon,g.warn.text,done);return}
  if(g.L.smoke&&g.smoke>.55&&!g.over){toast('warn','smoke','Mucho humo: evacúa',done);return}
  toast('info',STEPTX[s-1][0],`${s} · ${STEPTX[s-1][1]}`,done);
  if(s!==lastStep||force){lastStep=s;if(!force)say(STEPTX[s-1][1])}
}
function nag(key,icon,text,voice,cool=3.5){
  const g=G;if(g.nag[key]!==undefined&&g.t-g.nag[key]<cool)return;g.nag[key]=g.t;note('warn',icon,text,1700,voice||text);
}

/* ============ física del juego ============ */
const rAim=d=>52+d*9;
function qHeight(dy){if(dy<-14)return lerp(1,.07,clamp((-14-dy)/60,0,1));if(dy>30)return lerp(1,.15,clamp((dy-30)/80,0,1));return 1}
function qDist(d){const T=[[1,.35],[1.5,.6],[2,1],[3,1],[3.6,.75],[4.5,.35],[6,.1]];
  for(let i=1;i<T.length;i++)if(d<=T[i][0])return lerp(T[i-1][1],T[i][1],(d-T[i-1][0])/(T[i][0]-T[i-1][0]));return .1}
function qSweep(v){let a=clamp((v-12)/55,0,1);a=a*a*(3-2*a);let q=.1+.9*a;if(v>380)q*=lerp(1,.5,clamp((v-380)/300,0,1));return q}
const DMG=.28;

function pullPin(){
  if(mode!=='play'||!G||G.over||G.pinOut)return;
  G.pinOut=true;G.pinAt=G.t;SFX.pin();$('#bPin').classList.add('done');
  const e=ext_e();pinFly.push({x:CX+W*.07-36*e,y:H-210*e-44*e,vx:-90,vy:-160,r:0,l:.9,e});
  setStep();
}
function evacuate(){
  if(mode!=='play'||!G||G.over||!G.L.smoke)return;
  G.over=true;G.evac=0;SFX.door();say('Evacuando por la salida de emergencia.',true);
  G.pend={win:true,reason:'evac',delay:1.4};
}
function finish(win,reason){
  const g=G,L=g.L;mode='end';document.body.classList.remove('playing');
  try{speechSynthesis.cancel()}catch(e){}
  const tUsed=L.time-g.timeLeft;let stars=0;
  if(win){
    if(reason==='evac'){stars=g.smoke<=.3?3:g.smoke<=.55?2:1}
    else{stars=1;if(tUsed<=L.time*.6)stars++;if(g.charge>=L.charge*.3)stars++;if(g.note)stars=Math.min(stars,2);if(L.smoke)stars=g.smoke<.35?2:1}
    SAVE.stars[L.id-1]=Math.max(SAVE.stars[L.id-1]||0,stars);SAVE.unlocked=Math.max(SAVE.unlocked,Math.min(5,L.id+1));persist();SFX.win();say('¡Bien! Fuego controlado.',true);
  }else{SFX.lose()}
  const titles={time:'Se acabó el tiempo',empty:'Sin carga',out:'El fuego se salió de control',elec:'Error grave: descarga eléctrica',flare:'Error grave: llamarada',spread:'Error grave: el fuego se propagó',smoke:'El humo te alcanzó'};
  $('#enT').textContent=win?(reason==='evac'?(g.smoke<=.55?'Evacuaste a tiempo':'Evacuaste, pero tarde'):'¡Fuego apagado!'):titles[reason]||'Intento fallido';
  $('#enStars').innerHTML=[1,2,3].map(i=>`<span class="${i<=stars?'':'off'}">★</span>`).join('');
  $('#enMeta').textContent=win?(reason==='evac'?`Salida en ${fmtT(tUsed)} · humo ${Math.round(g.smoke*100)}%`:`Tiempo usado ${fmtT(tUsed)} · carga restante ${fmtN(g.charge)} s`):`${L.name} · intento ${fmtT(tUsed)}`;
  const fb=buildFeedback(win,reason);
  $('#enFb').innerHTML=fb.map(f=>`<li><span class="${f.ok?'ok':'no'}">${ico(f.ok?'check':'cross')}</span><span>${f.t}</span></li>`).join('');
  $('#enNext').hidden=!(win&&L.id<5);$('#enAl').innerHTML=ico('alarm',22);
  $('#scrEnd').dataset.n=L.id;show('scrEnd');
}
function buildFeedback(win,reason){
  const g=G,L=g.L,s=g.st,neg=[],pos=[];const d=Math.max(s.dis,.001);
  if(reason==='elec')neg.push('El agua conduce electricidad: en equipos energizados usa CO₂ o polvo ABC.');
  if(reason==='flare')neg.push('El agua sobre aceite caliente provoca una llamarada: usa un extintor Clase K.');
  if(reason==='spread')neg.push('El agua esparce el líquido inflamable y propaga el fuego: usa polvo ABC o CO₂.');
  if(g.note==='abc_c')neg.push('El polvo ABC apaga, pero daña los equipos: en eléctrico es mejor CO₂.');
  if(g.note==='abc_k')neg.push('El polvo ABC no enfría la grasa caliente y el fuego rebrota: usa Clase K.');
  if(g.note==='co2_b')neg.push('El CO₂ rinde poco en derrames de líquido: el polvo ABC es mejor.');
  if(reason==='smoke')neg.push('Con tanto humo había que evacuar antes: la vida vale más que el fuego.');
  if(reason==='evac'&&g.smoke>.55)neg.push('Evacuaste, pero tarde: decide antes de que el humo sea denso.');
  if(L.smoke&&win&&reason!=='evac'&&g.smoke>.35)neg.push('Lo lograste, pero con mucho humo. Evacuar era lo más seguro.');
  if(reason==='evac'){}else if(g.pinAt===null)neg.push('No sacaste el pasador: sin pasador el extintor no descarga.');
  else if(g.pinAt>7)neg.push('Demoraste en sacar el pasador.');
  if(g.pinAt!==null&&s.dis<.5&&!L.smoke)neg.push('Casi no descargaste el extintor.');
  if(s.dis>.5){
    if(s.high/d>.22)neg.push('Apuntaste muy alto: hay que apuntar a la base.');
    if(s.still/d>.3)neg.push('No barriste: te quedaste en un solo punto.');
    if(s.far/d>.3)neg.push('Estabas muy lejos del fuego.');
    if(s.near/d>.25)neg.push('Te acercaste demasiado.');
    if(s.off/d>.25)neg.push('Descargaste fuera del fuego.');
    if(s.rek>0&&!win)neg.push('El fuego rebrotó: barre toda la base, incluso los bordes.');
  }
  if(reason==='empty')neg.push('Se acabó la carga: descarga en ráfagas cortas y solo sobre el fuego.');
  if(reason==='time')neg.push('Se acabó el tiempo: actúa más rápido.');
  if(reason==='out'&&!neg.length)neg.push('El fuego se propagó: no te demores en descargar.');
  if(s.dis>.5){
    if(s.base/d>.6)pos.push('Apuntaste a la base del fuego.');
    if(s.sweep/d>.5)pos.push('Barriste bien de lado a lado.');
    if(s.good/d>.6)pos.push('Mantuviste una buena distancia (2 a 3 m).');
  }
  if(win&&g.charge>=L.charge*.3&&!L.smoke)pos.push('Cuidaste la carga del extintor.');
  if(win&&!g.note&&L.opts.length>1)pos.push('Elegiste el extintor correcto.');
  if(win&&reason==='evac'&&g.smoke<=.55)pos.push('Priorizaste tu seguridad: evacuaste a tiempo.');
  if(win&&L.smoke&&reason==='done'&&g.smoke<=.35)pos.push('Actuaste rápido, con poco humo todavía.');
  const out=neg.slice(0,3).map(t=>({ok:false,t}));
  pos.slice(0,Math.max(1,4-out.length)).forEach(t=>out.push({ok:true,t}));
  return out.slice(0,4);
}

function update(dt){
  const g=G,L=g.L;
  g.t+=dt;if(shake>0)shake=Math.max(0,shake-dt*1.6);
  const dv=(held.near||keys.up?-1:0)+(held.far||keys.dn?1:0);if(dv)dist=clamp(dist+dv*1.3*dt,1,6);
  const k=Math.min(1,dt*20);aim.x+=(aimT.x-aim.x)*k;aim.y+=(aimT.y-aim.y)*k;
  plane();const w=toWorld(aim.x,aim.y);
  const vraw=Math.hypot(aim.x-g.pa.x,0)/Math.max(dt,1e-3)/PL.sc;g.pa={x:aim.x,y:aim.y};g.vS+=(vraw-g.vS)*Math.min(1,dt*7);
  const R_=rAim(dist),qd=qDist(dist),qs=qSweep(g.vS);
  // información de apuntado
  let near=null,nd=1e9;
  for(const c of g.cells){if(c.lit&&c.life>.03){const d=Math.abs(w.x-c.x);if(d<nd){nd=d;near=c}}}
  const ai=g.ai={off:false,high:false,base:false};
  if(near){ai.off=nd>R_;const dy=w.y-near.by;ai.base=!ai.off&&qHeight(dy)>.7;ai.high=!ai.off&&dy<-30}
  if(ai.base&&!g.aimed){g.baseT+=dt;if(g.baseT>.4&&g.pinOut)g.aimed=true}
  // descarga
  g.disch=false;
  if(!g.over&&leverHeld()){
    if(!g.pinOut){if(g.nag.pin===undefined||g.t-g.nag.pin>2.5){g.nag.pin=g.t;g.st.nagPin++;note('warn','pin','Saca el pasador primero',1800,'Saca el pasador primero')}}
    else if(g.charge>0){
      g.disch=true;g.usedLever=true;g.charge=Math.max(0,g.charge-dt);
      if(g.charge===0){g.disch=false;g.st.empty=true;g.emptyAt=g.t;note('bad','warn','Sin carga',2600,'Sin carga')}
    }
  }
  const EF=EFF[L.cls][g.agent]||{e:.2,rk:1};
  const hitNow=new Set();
  if(g.disch){
    const s=g.st;
    if(near){s.dis+=dt;
    if(ai.off)s.off+=dt;else{if(ai.high)s.high+=dt;if(ai.base)s.base+=dt}
    if(dist>3.6)s.far+=dt;if(dist<1.7)s.near+=dt;if(dist>=2&&dist<=3.2)s.good+=dt;
    if(g.vS<12)s.still+=dt;if(qs>.75){s.sweep+=dt;g.sweepT=(g.sweepT||0)+dt;if(g.sweepT>1.5)g.sweepDone=true}}
    g.wt.off=ai.off?g.wt.off+dt:0;g.wt.far=dist>3.8?g.wt.far+dt:0;g.wt.still=g.vS<10?g.wt.still+dt:0;g.wt.high=ai.high?(g.wt.high||0)+dt:0;g.wt.near=dist<1.6?(g.wt.near||0)+dt:0;
    if(g.wt.off>.7)nag('off','target','Apunta al fuego');
    else if(g.wt.near>.5)nag('near','ruler','Aléjate un poco','Aléjate un poco');
    else if(g.wt.far>.7)nag('far','ruler','Acércate un poco','Acércate un poco');
    else if(g.wt.high>.6)nag('high','target','Apunta a la base');
    else if(g.wt.still>1)nag('still','sweep','Barre de lado a lado');
    if(EF.note&&!g.note&&ai.base)g.note=EF.note;
    let failHit=false;
    for(const c of g.cells){
      const dx=w.x-c.x;if(Math.abs(dx)>R_)continue;
      const qx=1-(dx/R_)*(dx/R_),qh=qHeight(w.y-c.by);
      if(EF.fail){if(c.lit&&qh>.3&&qx>.2)failHit=true;continue}
      const q=qh*qd*qs*qx*EF.e;hitNow.add(c);
      c.cover=Math.min(1,c.cover+1.3*qh*qd*qx*EF.e*(.5+.5*qs)*dt);
      if(c.lit)c.life-=DMG*q*dt;
    }
    if(EF.fail){g.failT=failHit?g.failT+dt:Math.max(0,g.failT-dt);if(g.failT>.45&&!g.over)triggerFail(EF.fail)}
  }
  // dinámica del fuego
  let sum=0;const cs=g.cells;
  for(let i=0;i<cs.length;i++){
    const c=cs[i];
    if(!hitNow.has(c))c.cover=Math.max(0,c.cover-.06*dt);
    if(c.lit){
      if(c.life<.02){c.lit=false;c.life=0;c.cover=Math.max(c.cover,.4);c.heat=0;continue}
      const rate=L.g+L.gre*EF.rk*(1-c.cover)*(c.life<.5?1:.35);
      c.life=Math.min(1,c.life+rate*(1-c.life)*dt);sum+=c.life;
    }else{
      let src=0;if(i>0&&cs[i-1].lit)src=Math.max(src,cs[i-1].life);if(i<cs.length-1&&cs[i+1].lit)src=Math.max(src,cs[i+1].life);
      if(src>.3){
        const r=c.ever?L.rek*EF.rk*src*(1-c.cover):L.spread*src*(1-c.cover*.5);
        c.heat+=r*dt;
        if(c.heat>=1){c.lit=true;c.life=.15;c.heat=0;if(c.ever)g.st.rek++;c.ever=true;for(let j=0;j<5;j++)parts.push({k:'spark',x:c.x,y:c.by-10,vx:rnd(-40,40),vy:rnd(-90,-30),a:0,l:.6})}
      }else c.heat=Math.max(0,c.heat-.2*dt);
    }
  }
  g.sum=sum;
  if(L.smoke){g.smoke=clamp(g.smoke+dt*((.012+.07*sum/g.N)-(sum<.05?.03:0)),0,1)}
  if(!g.over){
    g.timeLeft-=dt;
    const anyLit=cs.some(c=>c.lit);
    if(!anyLit){g.winT+=dt;if(g.winT>.5){g.over=true;g.pend={win:true,reason:'done',delay:.5};}}
    else g.winT=0;
    if(!g.over){
      if(sum>=L.lose*g.N){g.over=true;g.pend={win:false,reason:'out',delay:.8}}
      else if(g.timeLeft<=0){g.timeLeft=0;g.over=true;g.pend={win:false,reason:'time',delay:.6};say('Se acabó el tiempo.',true)}
      else if(g.charge<=0&&g.emptyAt!==undefined&&g.t-g.emptyAt>1.4){g.over=true;g.pend={win:false,reason:'empty',delay:.4}}
      else if(L.smoke&&g.smoke>=1){g.over=true;g.pend={win:false,reason:'smoke',delay:.6};say('Demasiado humo.',true)}
      else if(L.smoke&&g.smoke>.55&&!g.nag.evac){g.nag.evac=g.t;SFX.warn();say('Mucho humo. Evacúa ahora.',true)}
    }
  }
  if(g.pend){g.pend.delay-=dt;if(g.pend.delay<=0){const p=g.pend;g.pend=null;finish(p.win,p.reason)}}
  if(g.evac!==null)g.evac+=dt;
  if(flash){flash.t+=dt;if(flash.t>flash.d)flash=null}
  setStep();
}
function triggerFail(kind){
  const g=G;g.over=true;g.disch=false;shake=.8;
  if(kind==='elec'){SFX.zap();flash={t:0,d:.9,col:'200,230,255'};say('¡Descarga eléctrica! No uses agua.',true)}
  else{SFX.flare();flash={t:0,d:1.1,col:'255,170,60'};for(const c of g.cells){c.lit=true;c.life=Math.max(c.life,.95);c.ever=true}
    say(kind==='flare'?'¡Llamarada! No uses agua en aceite.':'¡El agua esparció el fuego!',true)}
  g.pend={win:false,reason:kind,delay:1.5};
}

/* ============ efectos ============ */
function updateFx(dt){
  const g=G;if(!g)return;
  const kd=KIND[g.L.cls];
  for(const c of g.cells){
    if(c.lit){
      if(Math.random()<dt*7*c.life)parts.push({k:'smoke',x:c.x+rnd(-8,8),y:c.by-20-c.life*60,vx:rnd(-8,8),vy:rnd(-40,-22),a:0,l:rnd(1.2,2),s:rnd(16,30)});
      if(g.L.cls==='C'&&Math.random()<dt*5*c.life)parts.push({k:'arc',x:c.x+rnd(-14,14),y:c.by-rnd(5,40),vx:rnd(-80,80),vy:rnd(-120,-20),a:0,l:rnd(.15,.35)});
      else if(Math.random()<dt*4*c.life)parts.push({k:'spark',x:c.x+rnd(-8,8),y:c.by-30*c.life,vx:rnd(-25,25),vy:rnd(-100,-50),a:0,l:rnd(.4,.9)});
    }
  }
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.a+=dt;if(p.a>=p.l){parts.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.k==='smoke'){p.vx+=rnd(-10,10)*dt}if(p.k==='spark')p.vy+=60*dt}
  if(parts.length>260)parts.splice(0,parts.length-260);
  const e=ext_e(),nz=nozzle(e);
  if(mode==='play'&&g.disch){
    const ag=g.agent,rate=ag==='agua'?130:ag==='co2'?200:170;let n=rate*dt;
    while(n>0&&(n>=1||Math.random()<n)){n--;stream.push({a:0,l:rnd(.32,.5),sx:rnd(-1,1),sy:rnd(-1,1),sz:rnd(.7,1.2)})}
    if(Math.random()<dt*45)cloud.push({x:aim.x+rnd(-1,1)*20*S*PL.f*(1+dist*.2),y:aim.y+rnd(-.6,.6)*14*S*PL.f,vx:rnd(-10,10),vy:rnd(-34,-8),a:0,l:rnd(.7,1.1),s:rnd(44,86)*S*PL.f*.9});
  }
  for(let i=stream.length-1;i>=0;i--){stream[i].a+=dt;if(stream[i].a>=stream[i].l)stream.splice(i,1)}
  for(let i=cloud.length-1;i>=0;i--){const p=cloud[i];p.a+=dt;if(p.a>=p.l){cloud.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt}
  for(let i=pinFly.length-1;i>=0;i--){const p=pinFly[i];p.l-=dt;if(p.l<=0){pinFly.splice(i,1);continue}p.vy+=700*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=dt*9}
}

/* ============ dibujo ============ */
function flame(c,x,by,life,t,seed,K){
  const h=(12+life*K.h)*(.9+.1*Math.sin(t*9+seed)),w=(10+life*16)*K.w,tilt=Math.sin(t*2.6+seed*1.7)*7*life;
  const Ls=[[1,K.c0,1],[.72,K.c1,.78],[.42,K.c2,.52]];
  for(const [s,col,hs] of Ls){
    const hh=h*hs*(1+.08*Math.sin(t*14+seed*2+s*5)),ww=w*s;c.fillStyle=col;c.beginPath();c.moveTo(x-ww,by);
    c.bezierCurveTo(x-ww*1.05,by-hh*.35,x+tilt*.4-ww*.35,by-hh*.62,x+tilt,by-hh);
    c.bezierCurveTo(x+tilt*.4+ww*.35,by-hh*.62,x+ww*1.05,by-hh*.35,x+ww,by);c.closePath();c.fill();
  }
}
function ext_e(){return clamp(Math.min(W,H)/520,.62,1.25)}
function nozzle(e){const bx=CX+W*.07;return{x:bx-70*e,y:H-210*e-95*e+10*e}}
function render(now,dt){
  const t=now/1000;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
  const g=G;if(!g){ctx.fillStyle='#14181d';ctx.fillRect(0,0,W,H);return}
  const L=g.L,sc=SC[L.scene];plane();
  const fw=1+(PL.f-1)*.55;
  // fondo
  ctx.save();ctx.translate(CX-L.cx*S*fw*.8+offx*.5,HY+offy*.5);ctx.scale(S*fw,S*fw);sc.bg(ctx,t);ctx.restore();
  // plano del fuego
  ctx.save();ctx.translate(PL.ox,PL.oy);ctx.scale(PL.sc,PL.sc);
  sc.mid(ctx,t);
  const K=KIND[L.cls];
  ctx.globalCompositeOperation='lighter';
  for(const c of g.cells)if(c.lit){const r=30+c.life*70;ctx.globalAlpha=.55*Math.min(1,c.life*1.6);ctx.drawImage(L.cls==='C'?SPR.glowB:SPR.glow,c.x-r,c.by-r*.8-c.life*20,r*2,r*2)}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  for(const c of g.cells)if(c.lit){
    flame(ctx,c.x-7,c.by,c.life*.85,t,c.seed,K);flame(ctx,c.x+8,c.by,c.life*.78,t+.3,c.seed+3,K);flame(ctx,c.x,c.by,c.life,t,c.seed+7,K);
  }
  for(const p of parts){
    const u=p.a/p.l;
    if(p.k==='smoke'){const s=p.s*(1+u*1.4);ctx.globalAlpha=(1-u)*(L.cls==='B'?1:.7);ctx.drawImage(SPR.smoke,p.x-s/2,p.y-s/2,s,s)}
    else if(p.k==='arc'){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-u;ctx.drawImage(SPR.arc,p.x-5,p.y-5,10,10);ctx.globalCompositeOperation='source-over'}
    else{ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-u;ctx.drawImage(SPR.spark,p.x-3,p.y-3,6,6);ctx.globalCompositeOperation='source-over'}
  }
  ctx.globalAlpha=1;
  // marcador de base (guía)
  if(mode==='play'&&!g.aimed&&!g.over){
    const lit=g.cells.filter(c=>c.lit);if(lit.length){
      const mx=lit.reduce((a,c)=>a+c.x,0)/lit.length,my=lit.reduce((a,c)=>a+c.by,0)/lit.length;const b=Math.sin(t*5)*4;
      ctx.fillStyle='rgba(242,197,0,.95)';ctx.beginPath();ctx.moveTo(mx,my+8+b);ctx.lineTo(mx-11,my+24+b);ctx.lineTo(mx+11,my+24+b);ctx.closePath();ctx.fill();
      ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('BASE',mx,my+40+b)}
  }
  ctx.restore();
  // humo (nivel 5)
  if(L.smoke){
    const s=g.smoke;
    ctx.fillStyle=`rgba(58,60,64,${.78*s})`;ctx.fillRect(0,0,W,H);
    const gr=ctx.createRadialGradient(aim.x,aim.y,60*S+20,aim.x,aim.y,Math.max(W,H)*.65);
    gr.addColorStop(0,'rgba(20,20,24,0)');gr.addColorStop(1,`rgba(12,12,15,${.97*s})`);ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);
    const gt=ctx.createLinearGradient(0,0,0,H*.7);gt.addColorStop(0,`rgba(30,30,34,${.85*s})`);gt.addColorStop(1,'rgba(30,30,34,0)');ctx.fillStyle=gt;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(CX-L.cx*S*fw*.8+offx*.5,HY+offy*.5);ctx.scale(S*fw,S*fw);exitSign(ctx,t,true);ctx.restore();
  }
  // chorro y nube
  const e=ext_e(),nz=nozzle(e);
  const ang=Math.atan2(aim.y-nz.y,aim.x-nz.x),tip={x:nz.x+Math.cos(ang)*(g.agent==='co2'?44:26)*e,y:nz.y+Math.sin(ang)*(g.agent==='co2'?44:26)*e};
  const sp=(16+dist*5)*S*PL.f*.7;
  const ag=g.agent,spr=SPR['ag_'+ag];
  for(const p of cloud){const u=p.a/p.l;ctx.globalAlpha=.42*(1-u);const s=p.s*(.6+u);ctx.drawImage(spr,p.x-s/2,p.y-s/2,s,s)}
  for(const p of stream){
    const u=p.a/p.l;const x=tip.x+(aim.x-tip.x)*u+p.sx*u*sp,y=tip.y+(aim.y-tip.y)*u+p.sy*u*sp*.7+(ag==='agua'?u*u*26*e:0);
    const s=(ag==='agua'?7:lerp(7,34,u))*p.sz*e;ctx.globalAlpha=ag==='agua'?.8:.6*(1-u*.8);ctx.drawImage(spr,x-s/2,y-s/2,s,s);
  }
  ctx.globalAlpha=1;
  // viñeta de calor
  if(dist<1.9&&g.sum>0){const a=clamp((1.9-dist)/.9,0,1)*.5*clamp(g.sum/g.N*2,0,1);const v=ctx.createRadialGradient(CX,H*.5,Math.min(W,H)*.3,CX,H*.5,Math.max(W,H)*.75);v.addColorStop(0,'rgba(255,60,0,0)');v.addColorStop(1,`rgba(255,60,0,${a})`);ctx.fillStyle=v;ctx.fillRect(0,0,W,H)}
  // retícula
  if(mode==='play'&&!g.over){
    const good=g.ai.base,col=g.ai.off?'rgba(255,255,255,.75)':good?'#4cc582':'#ffa21f';const r=17*e*(1+(g.disch?.12*Math.sin(t*30):0));
    ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(aim.x,aim.y,r,0,7);ctx.moveTo(aim.x-r-7,aim.y);ctx.lineTo(aim.x-r+4,aim.y);ctx.moveTo(aim.x+r-4,aim.y);ctx.lineTo(aim.x+r+7,aim.y);ctx.stroke();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(aim.x,aim.y,2.5,0,7);ctx.fill();
  }
  if(mode==='play')drawExt(ctx,t,e,nz,ang);
  if(g.evac!==null){ctx.fillStyle=`rgba(10,40,24,${clamp(g.evac/1.1,0,1)})`;ctx.fillRect(0,0,W,H)}
  if(flash){ctx.fillStyle=`rgba(${flash.col},${.9*(1-flash.t/flash.d)})`;ctx.fillRect(0,0,W,H)}
}
function drawExt(c,t,e,nz,ang){
  const g=G,ag=AG[g.agent];const bx=CX+W*.07,by=H+18*e,bw=82*e,bh=210*e;
  c.save();c.translate(bx,by);c.rotate(clamp((aim.x-CX)/W,-.5,.5)*.2);
  RR(c,-bw/2,-bh,bw,bh,22*e,LG(c,-bw/2,0,bw/2,0,[[0,'#8d1610'],[.35,'#e0382c'],[.7,'#c52a1f'],[1,'#7c110c']]));
  RR(c,-bw/2+7*e,-bh*.66,bw-14*e,bh*.3,6*e,'#f2ede0');R(c,-bw/2+7*e,-bh*.66,bw-14*e,7*e,ag.lab);
  c.fillStyle='#222';c.font=`800 ${15*e}px sans-serif`;c.textAlign='center';c.fillText(ag.tx,0,-bh*.5);c.font=`600 ${8*e}px sans-serif`;c.fillText(ag.l2,0,-bh*.42);
  RR(c,-20*e,-bh-18*e,40*e,22*e,4*e,'#2a2d31');
  RR(c,-36*e,-bh-46*e,72*e,30*e,10*e,'#34383d');
  c.fillStyle='#f4f4f0';c.beginPath();c.arc(18*e,-bh-31*e,9*e,0,7);c.fill();c.fillStyle='#3bb273';c.fillRect(14*e,-bh-38*e,9*e,7*e);
  const press=g.disch||leverHeld()&&g.pinOut?1:0;
  c.save();c.translate(-30*e,-bh-46*e);c.rotate(press?.22:0);R(c,0,-8*e,60*e,7*e,'#17191c');c.restore();
  R(c,-34*e,-bh-56*e,64*e,7*e,'#1c1f23');
  if(!g.pinOut){c.strokeStyle='#f2c500';c.lineWidth=3*e;c.beginPath();c.arc(-40*e,-bh-34*e,8*e,0,7);c.stroke();c.beginPath();c.moveTo(-32*e,-bh-34*e);c.lineTo(-18*e,-bh-40*e);c.stroke()}
  c.restore();
  // manguera
  c.strokeStyle='#14161a';c.lineWidth=9*e;c.lineCap='round';c.beginPath();c.moveTo(bx-30*e,by-bh-30*e);
  c.bezierCurveTo(bx-96*e,by-bh-10*e,nz.x-40*e,nz.y+70*e,nz.x,nz.y+8*e);c.stroke();
  c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=2*e;c.stroke();
  // boquilla
  c.save();c.translate(nz.x,nz.y);c.rotate(ang);
  if(ag.horn){c.fillStyle='#17191c';c.beginPath();c.moveTo(0,-5*e);c.lineTo(44*e,-14*e);c.lineTo(44*e,14*e);c.lineTo(0,5*e);c.closePath();c.fill()}
  else{RR(c,-4*e,-6*e,30*e,12*e,5*e,'#2a2d31')}
  c.restore();
  // guantes
  RR(c,nz.x-22*e,nz.y+4*e,34*e,28*e,10*e,'#d99a1c');R(c,nz.x-20*e,nz.y+26*e,30*e,12*e,'#2a2c30');
  RR(c,bx-22*e,by-bh-72*e,62*e,32*e,12*e,'#d99a1c');R(c,bx-14*e,by-bh-42*e,40*e,14*e,'#2a2c30');
  for(const p of pinFly){c.save();c.translate(p.x,p.y);c.rotate(p.r);c.globalAlpha=clamp(p.l*2,0,1);c.strokeStyle='#f2c500';c.lineWidth=3*p.e;c.beginPath();c.arc(0,0,8*p.e,0,7);c.moveTo(8*p.e,0);c.lineTo(24*p.e,0);c.stroke();c.restore()}
}

/* ============ HUD ============ */
let hc={};
function hud(){
  const g=G;if(!g||mode!=='play')return;
  const set=(id,html,key)=>{if(hc[id]!==key){hc[id]=key;$(id).innerHTML=html}};
  const tl=Math.ceil(g.timeLeft);set('#hTime',ico('clock')+fmtT(g.timeLeft),tl);$('#hTime').classList.toggle('low',g.timeLeft<10);
  const fp=g.sum<=.001?0:Math.max(1,Math.round(100*g.sum/g.sum0));const fpt=fp>999?'999+':fp;set('#hFire',ico('flame')+fpt+'%',fp);
  if(g.L.smoke){const sp=Math.round(g.smoke*100);set('#hSmoke',ico('smoke')+sp+'%',sp)}
  const cs=Math.round(g.charge*10);set('#hCharge',`${ico('ext')}<span class="bar"><i style="transform:scaleX(${g.charge/g.L.charge})"></i></span><span>${fmtN(g.charge)} s</span>`,cs);
  $('#hCharge').classList.toggle('low',g.charge/g.L.charge<.25);
  const d=$('#dist');d.textContent=fmtN(dist)+' m';d.classList.toggle('ok',dist>=2&&dist<=3.2);
  $('#bLever').classList.toggle('dn',leverHeld());
}

/* ============ pantallas ============ */
function show(id){document.querySelectorAll('.scr').forEach(s=>s.classList.toggle('on',s.id===id))}
function buildLevels(){
  $('#lvls').innerHTML=LV.map(l=>{const lock=l.id>SAVE.unlocked,st=SAVE.stars[l.id-1]||0;
    return `<button class="lv${l.id===selLevel?' sel':''}" data-n="${l.id}" ${lock?'disabled':''}><b>${l.id}</b><span>${l.name}</span><i class="st">${lock?'🔒':'★'.repeat(st)+'☆'.repeat(3-st)}</i></button>`}).join('');
  $('#lvls').querySelectorAll('.lv').forEach(b=>b.onclick=()=>{selLevel=+b.dataset.n;previewLevel(selLevel);buildLevels()});
}
function openMenu(){mode='menu';document.body.classList.remove('playing');selLevel=Math.min(selLevel,SAVE.unlocked);previewLevel(selLevel);buildLevels();show('scrStart');try{speechSynthesis.cancel()}catch(e){}}
function goLevel(n){
  selLevel=n;const L=LV[n-1];
  if(L.opts.length<2){startLevel(n,L.opts[0]);return}
  previewLevel(n);mode='pick';$('#pkT').textContent=`Nivel ${n} · ${L.name}`;$('#pkD').textContent=L.intro;
  const o=[...L.opts].sort(()=>Math.random()-.5);
  $('#pkOpts').innerHTML=o.map(k=>`<button class="opt" data-k="${k}"><svg viewBox="0 0 40 60" width="38" height="56"><rect x="9" y="18" width="22" height="38" rx="7" fill="#d6352a"/><rect x="11" y="28" width="18" height="12" rx="2" fill="#f2ede0"/><rect x="11" y="28" width="18" height="3" fill="${AG[k].lab}"/><rect x="12" y="8" width="16" height="9" rx="3" fill="#2f3338"/><path d="M12 11L4 16" stroke="#17191c" stroke-width="3" stroke-linecap="round"/></svg>${AG[k].n}<small>${AG[k].hint}</small></button>`).join('');
  $('#pkOpts').querySelectorAll('.opt').forEach(b=>b.onclick=()=>startLevel(n,b.dataset.k));
  show('scrPick');
}
$('#bStart').onclick=()=>{audioInit();goLevel(selLevel)};
$('#pkBack').onclick=openMenu;
$('#enMenu').onclick=openMenu;
$('#enRetry').onclick=()=>goLevel(G.L.id);
$('#enNext').onclick=()=>goLevel(Math.min(5,G.L.id+1));
$('#bExit').onclick=openMenu;
const mt=()=>{audioInit();setMuted(!A.muted)};$('#bMute').onclick=mt;$('#bMute2').onclick=mt;
$('#bExit').innerHTML=ico('x');$('#bNear').innerHTML=ico('up');$('#bFar').innerHTML=ico('dn');
$('#bPin').innerHTML=ico('pin')+'Sacar pasador';$('#bEvac').innerHTML=ico('exit')+'Evacuar';
$('#bLever').innerHTML=ico('lever')+'<span>Apretar</span>';
setMuted(false);

/* ============ entrada ============ */
const noFocus=e=>e.preventDefault();
function holdBtn(el,on,off){
  el.addEventListener('pointerdown',e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(_){}on();el.classList.add('dn')});
  const up=()=>{off();el.classList.remove('dn')};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
holdBtn($('#bLever'),()=>{lever.btn=true;SFX.lever()},()=>lever.btn=false);
holdBtn($('#bNear'),()=>held.near=true,()=>held.near=false);
holdBtn($('#bFar'),()=>held.far=true,()=>held.far=false);
$('#bPin').addEventListener('pointerdown',e=>{e.preventDefault();pullPin()});
$('#bEvac').addEventListener('pointerdown',e=>{e.preventDefault();evacuate()});
['#bMute','#bExit'].forEach(s=>$(s).addEventListener('pointerdown',noFocus));
let ptr=null;
const clampAim=()=>{aimT.x=clamp(aimT.x,8,W-8);aimT.y=clamp(aimT.y,60,H-8)};
cv.addEventListener('pointerdown',e=>{
  if(mode!=='play')return;e.preventDefault();
  if(e.pointerType==='mouse'){if(e.button===0){lever.mouse=true;SFX.lever()}aimT.x=e.clientX;aimT.y=e.clientY;clampAim();try{cv.setPointerCapture(e.pointerId)}catch(_){}}
  else if(!ptr){ptr={id:e.pointerId,x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId)}catch(_){}}
});
cv.addEventListener('pointermove',e=>{
  if(mode!=='play')return;
  if(e.pointerType==='mouse'){aimT.x=e.clientX;aimT.y=e.clientY;clampAim()}
  else if(ptr&&ptr.id===e.pointerId){aimT.x+=(e.clientX-ptr.x)*1.7;aimT.y+=(e.clientY-ptr.y)*1.7;ptr.x=e.clientX;ptr.y=e.clientY;clampAim()}
});
const pup=e=>{if(e.pointerType==='mouse')lever.mouse=false;else if(ptr&&ptr.id===e.pointerId)ptr=null};
cv.addEventListener('pointerup',pup);cv.addEventListener('pointercancel',pup);
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{if(mode==='play'){e.preventDefault();dist=clamp(dist+Math.sign(e.deltaY)*.3,1,6)}},{passive:false});
addEventListener('keydown',e=>{
  if(mode!=='play')return;
  if(e.code==='Space'){e.preventDefault();if(!lever.key){lever.key=true;SFX.lever()}}
  else if(e.code==='KeyP'||e.code==='Enter'){e.preventDefault();pullPin()}
  else if(e.code==='ArrowUp'||e.code==='KeyW'){e.preventDefault();keys.up=true}
  else if(e.code==='ArrowDown'||e.code==='KeyS'){e.preventDefault();keys.dn=true}
  else if(e.code==='KeyM')mt();
  else if(e.code==='KeyE')evacuate();
});
addEventListener('keyup',e=>{if(e.code==='Space')lever.key=false;else if(e.code==='ArrowUp'||e.code==='KeyW')keys.up=false;else if(e.code==='ArrowDown'||e.code==='KeyS')keys.dn=false});
addEventListener('blur',()=>{lever.btn=lever.mouse=lever.key=false;held.near=held.far=false;keys.up=keys.dn=false});

/* ============ bucle ============ */
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(mode==='play'&&G)update(dt);
  updateFx(dt);audioTick(dt,mode==='play'?G:null);
  render(now,dt);hud();
}
window.__sg={get G(){return G},get mode(){return mode},startLevel,goLevel,update,updateFx,pullPin,evacuate,
  setAimWorld(x,y){plane();const s=toScreen(x,y);aim.x=aimT.x=s.x;aim.y=aimT.y=s.y},setDist(d){dist=d},lever,get dist(){return dist},openMenu,resize};
previewLevel(1);buildLevels();
requestAnimationFrame(frame);
