import * as THREE from 'three';
import type { SystemState } from './simulation';
import { statusColor } from './simulation';

const DISTRICTS = [
  new THREE.Vector3(-5,0,-3), new THREE.Vector3(0,0,-1),
  new THREE.Vector3(4,0,2), new THREE.Vector3(8,0,-2)
];

export class PulseCity {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(44, 1, .1, 100);
  private clock = new THREE.Clock();
  private frame = 0;
  private running = true;
  private root = new THREE.Group();
  private particles: THREE.Points;
  private particleData: { route:number; offset:number; speed:number }[] = [];
  private routes: THREE.CatmullRomCurve3[] = [];
  private core: THREE.Mesh;
  private buildingMaterial: THREE.MeshStandardMaterial;
  private accentMaterial: THREE.MeshStandardMaterial;
  private target = new THREE.Vector3(1, 0, 0);
  private pointerDown = false;
  private pointerX = 0;
  private yaw = 0;

  constructor(private canvas: HTMLCanvasElement, reducedMotion: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.fog = new THREE.FogExp2(0x05090b, .038);
    this.camera.position.set(14, 11, 18);
    this.camera.lookAt(this.target);

    this.buildingMaterial = new THREE.MeshStandardMaterial({ color:0x102a31, metalness:.72, roughness:.34, emissive:0x06252a, emissiveIntensity:.35 });
    this.accentMaterial = new THREE.MeshStandardMaterial({ color:0x55f7e4, emissive:0x55f7e4, emissiveIntensity:2.2, metalness:.2, roughness:.2 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), this.accentMaterial);
    this.particles = this.createParticles();
    this.composeCity();
    this.bindEvents();
    this.setMotion(!reducedMotion);
    this.resize();
  }

  private composeCity() {
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0x6be8ff,0x031014,1.1));
    const key = new THREE.DirectionalLight(0x96fff2, 2.5); key.position.set(-6,12,7); this.scene.add(key);
    const rim = new THREE.PointLight(0x8b62ff, 30, 28); rim.position.set(4,5,-2); this.scene.add(rim);

    const grid = new THREE.GridHelper(48, 48, 0x1b5e66, 0x0b282d);
    (grid.material as THREE.Material).transparent=true; (grid.material as THREE.Material).opacity=.45;
    this.root.add(grid);

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(12,14,.45,8), new THREE.MeshStandardMaterial({color:0x071316,metalness:.8,roughness:.62}));
    platform.position.y=-.3; this.root.add(platform);
    this.core.position.set(1,2.4,0); this.root.add(this.core);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.75,.025,8,96), this.accentMaterial); coreRing.rotation.x=Math.PI/2; coreRing.position.copy(this.core.position); this.root.add(coreRing);

    const towerGeo = new THREE.BoxGeometry(1,1,1);
    DISTRICTS.forEach((center,district) => {
      for(let i=0;i<13;i++){
        const angle=i*2.399 + district; const radius=1.25+(i%4)*.45; const height=1.1+((i*7+district*3)%9)*.42;
        const tower = new THREE.Mesh(towerGeo, this.buildingMaterial.clone());
        tower.scale.set(.45+(i%3)*.16,height,.45+((i+1)%3)*.13);
        tower.position.set(center.x+Math.cos(angle)*radius,height/2,center.z+Math.sin(angle)*radius);
        tower.userData.district=district;
        this.root.add(tower);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(tower.scale.x*1.08,.045,tower.scale.z*1.08), this.accentMaterial.clone());
        cap.position.set(tower.position.x,height+.03,tower.position.z); cap.userData.district=district; this.root.add(cap);
      }
      const beacon = new THREE.Mesh(new THREE.TorusGeometry(.7,.035,6,50), this.accentMaterial.clone());
      beacon.position.set(center.x,4.9,center.z); beacon.rotation.x=Math.PI/2; beacon.userData.district=district; this.root.add(beacon);
    });

    const routePoints = [
      [new THREE.Vector3(-13,.25,-6),new THREE.Vector3(-5,.7,-3),new THREE.Vector3(0,1,-1),new THREE.Vector3(4,.7,2),new THREE.Vector3(11,.3,-2)],
      [new THREE.Vector3(-12,.2,5),new THREE.Vector3(-5,.5,-3),new THREE.Vector3(1,2.4,0),new THREE.Vector3(8,.5,-2)],
      [new THREE.Vector3(-3,.2,-11),new THREE.Vector3(0,.5,-1),new THREE.Vector3(4,.8,2),new THREE.Vector3(12,.2,5)]
    ];
    routePoints.forEach(points=>{
      const curve=new THREE.CatmullRomCurve3(points); this.routes.push(curve);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)),new THREE.LineBasicMaterial({color:0x2a8d91,transparent:true,opacity:.38}));
      this.root.add(line);
    });
    this.root.add(this.particles);
    this.root.rotation.y=-.12;
  }

  private createParticles(): THREE.Points {
    const count = innerWidth < 720 ? 260 : 520;
    const positions = new Float32Array(count*3);
    for(let i=0;i<count;i++) this.particleData.push({route:i%3,offset:(i*0.618033)%1,speed:.022+(i%7)*.002});
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    return new THREE.Points(geo,new THREE.PointsMaterial({color:0x55f7e4,size:.095,transparent:true,opacity:.94,blending:THREE.AdditiveBlending,depthWrite:false}));
  }

  private updateParticles(elapsed:number){
    const position=this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.particleData.forEach((particle,i)=>{
      const curve=this.routes[particle.route]; if(!curve) return;
      const p=curve.getPointAt((particle.offset+elapsed*particle.speed)%1);
      position.setXYZ(i,p.x,p.y,p.z);
    });
    position.needsUpdate=true;
  }

  setState(state:SystemState){
    const color=new THREE.Color(statusColor(state));
    this.accentMaterial.color.copy(color); this.accentMaterial.emissive.copy(color);
    (this.particles.material as THREE.PointsMaterial).color.copy(color);
    this.root.traverse(object=>{ const material=(object as THREE.Mesh).material; if(material instanceof THREE.MeshStandardMaterial && object!==this.core && material!==this.buildingMaterial && material.emissiveIntensity>1){material.color.copy(color);material.emissive.copy(color);} });
    this.render();
  }

  focusDistrict(index:number){
    const district=DISTRICTS[index]; if(!district) return;
    this.target.copy(district); this.camera.position.set(district.x+8,7,district.z+10); this.camera.lookAt(this.target); this.render();
  }

  setMotion(enabled:boolean){
    this.running=enabled;
    cancelAnimationFrame(this.frame);
    if(enabled){ this.clock.start(); this.animate(); } else { this.render(); }
  }

  private animate=()=>{
    if(!this.running) return;
    this.frame=requestAnimationFrame(this.animate);
    const elapsed=this.clock.getElapsedTime();
    this.updateParticles(elapsed);
    this.core.rotation.y=elapsed*.28; this.core.rotation.x=elapsed*.12;
    const desiredYaw=this.pointerDown?this.pointerX*.0015:Math.sin(elapsed*.08)*.035;
    this.yaw += (desiredYaw-this.yaw)*.04; this.root.rotation.y=-.12+this.yaw;
    this.render();
  };
  private render(){this.renderer.render(this.scene,this.camera);}
  private resize=()=>{const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<720?1.25:1.75));this.renderer.setSize(w,h,false);this.render();};
  private bindEvents(){
    addEventListener('resize',this.resize,{passive:true});
    this.canvas.addEventListener('pointerdown',e=>{this.pointerDown=true;this.pointerX=e.clientX;this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{if(this.pointerDown)this.pointerX=e.clientX-innerWidth/2;});
    this.canvas.addEventListener('pointerup',e=>{this.pointerDown=false;this.canvas.releasePointerCapture(e.pointerId);});
  }
  destroy(){cancelAnimationFrame(this.frame);removeEventListener('resize',this.resize);this.renderer.dispose();}
}

export function supportsWebGL():boolean{
  try{
    const probe=document.createElement('canvas');
    return Boolean(probe.getContext('webgl2')||probe.getContext('webgl'));
  }catch{return false;}
}
