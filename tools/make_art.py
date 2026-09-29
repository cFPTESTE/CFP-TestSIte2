"""Generates the decorative SVG illustrations in src/_includes/art/ (run once; output is committed)."""
import math, os
OUT=os.path.join(os.path.dirname(__file__),'..','src','_includes','art')
S=400
def f(x): return f'{x:.1f}'

# 1. Quantum materials
def hex_lines(theta, a, cx, cy, R):
    out=[]
    for k in range(3):
        ang=theta+k*math.pi/3
        dx,dy=math.cos(ang),math.sin(ang)       # line direction
        nx,ny=-dy,dx                               # normal
        n=int(R/a)+1
        for i in range(-n,n+1):
            ox,oy=cx+nx*i*a,cy+ny*i*a
            out.append(f'M{f(ox-dx*R)} {f(oy-dy*R)}L{f(ox+dx*R)} {f(oy+dy*R)}')
    return ''.join(out)
# twisted bilayer graphene: two honeycomb bond patterns, the top one slowly changing its twist
d=8.5; w=d*math.sqrt(3); hh=3*d
def honey(id,ang,color,anim):
    segs=f'M0 {f(d/2)}L{f(w/2)} 0L{f(w)} {f(d/2)}M0 {f(d/2)}V{f(1.5*d)}M{f(w)} {f(d/2)}V{f(1.5*d)}M0 {f(1.5*d)}L{f(w/2)} {f(2*d)}L{f(w)} {f(1.5*d)}M{f(w/2)} {f(2*d)}V{f(3*d)}'
    a=(f'<animateTransform attributeName="patternTransform" type="rotate" values="{ang} 200 200;{ang-2.5} 200 200;{ang} 200 200" dur="28s" repeatCount="indefinite"/>' if anim else '')
    return (f'<pattern id="{id}" width="{f(w)}" height="{f(hh)}" patternUnits="userSpaceOnUse" patternTransform="rotate({ang} 200 200)">'
            f'<path d="{segs}" fill="none" stroke="{color}" stroke-width="1.1"/>{a}</pattern>')
moire=(f'<svg class="art" width="{S}" height="{S}" viewBox="0 0 {S} {S}" aria-hidden="true"><defs>{honey("tbg-l1",0,"var(--art-a)",False)}{honey("tbg-l2",4.5,"var(--art-b)",True)}</defs>'
 f'<circle cx="200" cy="200" r="190" fill="url(#tbg-l1)" opacity=".75"/><circle cx="200" cy="200" r="190" fill="url(#tbg-l2)" opacity=".9"/>'
 f'<circle cx="200" cy="200" r="190" fill="none" stroke="var(--art-a)" stroke-width="1.5" opacity=".5"/></svg>')

# 2. QFT & holography: Poincaré disk with geodesics
R=180;C=200
def geodesic(t1,t2):
    # circle orthogonal to unit circle through boundary points at angles t1,t2
    d=(t2-t1)%(2*math.pi)
    if abs(d-math.pi)<1e-6:
        return f'M{f(C+R*math.cos(t1))} {f(C+R*math.sin(t1))}L{f(C+R*math.cos(t2))} {f(C+R*math.sin(t2))}'
    r=R*abs(math.tan(d/2))
    sweep=0 if d<math.pi else 1
    return f'M{f(C+R*math.cos(t1))} {f(C+R*math.sin(t1))}A{f(r)} {f(r)} 0 0 {sweep} {f(C+R*math.cos(t2))} {f(C+R*math.sin(t2))}'
paths=[]
n=21
for k in range(n):
    t=2*math.pi*k/n
    for m,op in [(3,'.9'),(5,'.55'),(8,'.3')]:
        paths.append(f'<path d="{geodesic(t,t+2*math.pi*m/n)}" opacity="{op}"/>')
# static background (faint geodesics + boundary) with a canvas on top where
# src/assets/js/witten.js animates a Witten exchange diagram
ads=(f'<div class="art art-stack" data-art="witten"><svg viewBox="0 0 {S} {S}" aria-hidden="true"><g fill="none" stroke="var(--art-a)" stroke-width="1" opacity=".35">{"".join(paths)}</g>'
     f'<circle cx="{C}" cy="{C}" r="{R}" fill="none" stroke="var(--art-b)" stroke-width="2.5"/></svg><canvas aria-hidden="true"></canvas></div>')

# 3. Gravitation: warped spacetime grid (embedding diagram) in oblique projection
def z(x,y): return -95/math.sqrt((x*x+y*y)/900+1)
def proj(x,y):
    zz=z(x,y); a=math.radians(28)
    px=200+(x-y)*math.cos(a)*1.05
    py=235+(x+y)*math.sin(a)*1.05-zz
    return px,py
lines=[]
rng=[i*14 for i in range(-11,12)]
for g in rng:
    pts=[proj(g,t/2) for t in range(-308,309,6)]; lines.append('M'+'L'.join(f'{f(x)} {f(y)}' for x,y in pts))
    pts=[proj(t/2,g) for t in range(-308,309,6)]; lines.append('M'+'L'.join(f'{f(x)} {f(y)}' for x,y in pts))
bx,by=proj(0,0)
grav=(f'<svg class="art" width="{S}" height="{S}" viewBox="0 0 {S} {S}" aria-hidden="true"><defs><radialGradient id="gv-fade" cx="50%" cy="55%" r="55%"><stop offset="60%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></radialGradient>'
      f'<mask id="gv-mask"><rect width="{S}" height="{S}" fill="url(#gv-fade)"/></mask></defs>'
      f'<g mask="url(#gv-mask)"><path d="{"".join(lines)}" fill="none" stroke="var(--art-a)" stroke-width="1" opacity=".8"/></g>'
      + ''.join(f'<ellipse cx="{f(bx)}" cy="{f(by-24)}" rx="16" ry="7" fill="none" stroke="var(--art-b)" opacity="0"><animate attributeName="rx" values="18;150" dur="6s" begin="{k*2}s" repeatCount="indefinite"/><animate attributeName="ry" values="8;66" dur="6s" begin="{k*2}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;0" dur="6s" begin="{k*2}s" repeatCount="indefinite"/></ellipse>' for k in range(3))
      + f'<ellipse cx="{f(bx)}" cy="{f(by-24)}" rx="92" ry="36" fill="none" stroke="var(--art-a)" stroke-dasharray="2 5" opacity=".6"/>'
      f'<circle cx="{f(bx)}" cy="{f(by-24)}" r="16" fill="var(--art-b)"/>'
      f'<circle r="6" fill="var(--art-a)"><animateMotion dur="9s" repeatCount="indefinite" path="M{f(bx+92)} {f(by-24)}A92 36 0 1 1 {f(bx-92)} {f(by-24)}A92 36 0 1 1 {f(bx+92)} {f(by-24)}"/></circle></svg>')

# 4. Quantum computation: small circuit
wires=[90,160,230,300]
el=[f'<path d="M30 {y}H370" stroke="var(--art-a)" stroke-width="1.5" opacity=".7"/>' for y in wires]
def box(x,y,t): return f'<rect x="{x-20}" y="{y-20}" width="40" height="40" rx="4" fill="var(--art-bg)" stroke="var(--art-b)" stroke-width="2"/><text x="{x}" y="{y+7}" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="700" font-size="19" fill="var(--art-b)">{t}</text>'
def cnot(x,c,t): return (f'<path d="M{x} {c}V{t+16 if t>c else t-16}" stroke="var(--art-b)" stroke-width="2"/><circle cx="{x}" cy="{c}" r="6" fill="var(--art-b)"/>'
                         f'<circle cx="{x}" cy="{t}" r="16" fill="var(--art-bg)" stroke="var(--art-b)" stroke-width="2"/><path d="M{x-16} {t}H{x+16}M{x} {t-16}V{t+16}" stroke="var(--art-b)" stroke-width="2"/>')
for y in wires: el.append(box(75,y,'H'))
el.append(cnot(145,90,160)); el.append(cnot(205,160,230)); el.append(cnot(265,230,300))
el.append(box(325,90,'R')); el.append(box(325,300,'U'))
for k,y in enumerate(wires):
    el.append(f'<circle r="4.5" fill="var(--art-a)"><animateMotion path="M30 {y}H370" dur="5s" begin="{k*0.45}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.9;1" dur="5s" begin="{k*0.45}s" repeatCount="indefinite"/></circle>')
qc=f'<svg class="art" width="{S}" height="{S}" viewBox="0 0 {S} {S}" aria-hidden="true">{"".join(el)}</svg>'

for n,s in [('quantum-materials',moire),('qft-holography',ads),('gravitation-cosmology',grav),('quantum-computation',qc)]:
    open(os.path.join(OUT,n+'.njk'),'w').write(s)
print('ok')
