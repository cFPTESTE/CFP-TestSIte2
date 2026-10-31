/* Witten exchange diagram in the Poincaré disk (Euclidean AdS2 slice).
   Four boundary operators O(x_i) connect through bulk-to-boundary propagators to two bulk
   vertices, joined by a bulk-to-bulk propagator. All lines are hyperbolic geodesics. */
(()=>{
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R0 = 0.45;                                  // disk radius relative to the canvas (matches the SVG)
  const inv = ([x,y]) => { const r2 = x*x+y*y || 1e-9; return [x/r2, y/r2]; };
  function circum(a,b,c){                           // circle through three points (null if collinear)
    const d = 2*(a[0]*(b[1]-c[1]) + b[0]*(c[1]-a[1]) + c[0]*(a[1]-b[1]));
    if (Math.abs(d) < 1e-6) return null;
    const A=a[0]**2+a[1]**2, B=b[0]**2+b[1]**2, Cc=c[0]**2+c[1]**2;
    const ux=(A*(b[1]-c[1])+B*(c[1]-a[1])+Cc*(a[1]-b[1]))/d, uy=(A*(c[0]-b[0])+B*(a[0]-c[0])+Cc*(b[0]-a[0]))/d;
    return {c:[ux,uy], r:Math.hypot(a[0]-ux,a[1]-uy)};
  }
  // sampled hyperbolic geodesic from p to q (p may lie on the boundary)
  function geodesic(p,q,n=40){
    const bulk = (p[0]**2+p[1]**2) < 0.999 ? p : q;
    const circ = circum(p,q,inv(bulk));
    const pts = [];
    if (!circ || circ.r > 60){ for(let i=0;i<=n;i++){const t=i/n;pts.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);} return pts; }
    const {c,r} = circ;
    let a1=Math.atan2(p[1]-c[1],p[0]-c[0]), a2=Math.atan2(q[1]-c[1],q[0]-c[0]);
    let da=a2-a1; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
    const mid=[c[0]+r*Math.cos(a1+da/2), c[1]+r*Math.sin(a1+da/2)];
    if (mid[0]**2+mid[1]**2 > 1) da = da>0 ? da-2*Math.PI : da+2*Math.PI;   // take the arc inside the disk
    for(let i=0;i<=n;i++){const a=a1+da*i/n;pts.push([c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]);}
    return pts;
  }
  const at = (pts,f) => { f=Math.min(1,Math.max(0,f)); const k=f*(pts.length-1), i=Math.floor(k), t=k-i, a=pts[i], b=pts[Math.min(i+1,pts.length-1)]; return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; };

  function setup(box){
    const cv = box.querySelector("canvas"); if (!cv) return;
    const ctx = cv.getContext("2d");
    let W=0, dpr=1, visible=true; const t0=performance.now();
    const size=()=>{ dpr=Math.min(devicePixelRatio||1,2); W=cv.clientWidth; cv.width=W*dpr; cv.height=W*dpr; };
    const col=()=>{ const s=getComputedStyle(box); return [s.getPropertyValue("--art-a").trim()||"#C8D6E5", s.getPropertyValue("--art-b").trim()||"#92C1E9"]; };
    function frame(now){
      const t=Math.max(0,(now-t0)/1000), [A,B]=col(), S=W*R0, C=W/2;
      const P=([x,y])=>[C+x*S, C+y*S];
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,W);
      // boundary insertions drift slowly around the circle
      const th=[0.35,1.75,3.45,4.95].map((a,i)=>a+0.28*Math.sin(t*0.17+i*1.9));
      const x=th.map(a=>[Math.cos(a),Math.sin(a)]);
      // two bulk vertices wander between their pairs of operators
      const v=(i,j,ph)=>{ const a=(th[i]+th[j])/2 + 0.25*Math.sin(t*0.23+ph), r=0.34+0.14*Math.sin(t*0.31+ph*2); return [r*Math.cos(a), r*Math.sin(a)]; };
      const y1=v(0,1,0), y2=v(2,3,2.1);
      const lines=[geodesic(x[0],y1),geodesic(x[1],y1),geodesic(x[2],y2),geodesic(x[3],y2)], bulk=geodesic(y1,y2);
      ctx.lineCap="round";
      ctx.strokeStyle=A; ctx.lineWidth=Math.max(1.4,W/220); ctx.globalAlpha=.95;
      for(const l of lines){ ctx.beginPath(); l.forEach((p,i)=>{const [X,Y]=P(p); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}); ctx.stroke(); }
      // exchanged field: dashed, in the accent colour
      ctx.strokeStyle=B; ctx.setLineDash([W/60,W/90]); ctx.lineDashOffset=-t*W/25; ctx.beginPath();
      bulk.forEach((p,i)=>{const [X,Y]=P(p); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y);}); ctx.stroke(); ctx.setLineDash([]);
      // signals travelling from the boundary into the bulk
      ctx.fillStyle=B;
      lines.forEach((l,i)=>{ const f=((t*0.35+i*0.23)%1); const [X,Y]=P(at(l,f)); ctx.globalAlpha=Math.sin(Math.PI*f); ctx.beginPath(); ctx.arc(X,Y,W/110,0,7); ctx.fill(); });
      ctx.globalAlpha=1;
      // operators on the boundary, with a soft pulse
      x.forEach((p,i)=>{ const [X,Y]=P(p), k=(t*0.6+i*0.25)%1;
        ctx.fillStyle=B; ctx.beginPath(); ctx.arc(X,Y,W/70,0,7); ctx.fill();
        ctx.strokeStyle=B; ctx.globalAlpha=1-k; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(X,Y,W/70+k*W/18,0,7); ctx.stroke(); ctx.globalAlpha=1; });
      // bulk vertices
      [y1,y2].forEach(p=>{ const [X,Y]=P(p); ctx.fillStyle=B; ctx.beginPath(); ctx.arc(X,Y,W/80,0,7); ctx.fill(); });
      if(!still && visible) requestAnimationFrame(frame);
    }
    size(); addEventListener("resize",()=>{ size(); if(still||!visible) frame(performance.now()); });
    new IntersectionObserver(es=>{ const v=es[0].isIntersecting; if(v && !visible && !still){ visible=true; requestAnimationFrame(frame);} visible=v; }).observe(box);
    requestAnimationFrame(frame);
  }
  document.querySelectorAll('[data-art="witten"]').forEach(setup);
})();
