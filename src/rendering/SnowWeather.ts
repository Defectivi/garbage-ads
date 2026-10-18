import * as T from 'three';
import { SeededRNG } from '../utils/SeededRNG';

/** Independently wrapped flakes: no whole-cloud teleport or global-time discontinuity. */
export class SnowWeather {
  readonly points:T.Points;
  private positions=new Float32Array(900*3);
  private intensity=0;
  constructor(){
    const rng=new SeededRNG(1938);for(let i=0;i<900;i++){this.positions[i*3]=rng.range(-44,44);this.positions[i*3+1]=rng.range(0,44);this.positions[i*3+2]=rng.range(-44,44);}
    const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=255;pixels[i+3]=Math.round(Math.max(0,1-Math.hypot(x-7.5,y-7.5)/7.5)**1.5*255);}
    const texture=new T.DataTexture(pixels,16,16);texture.needsUpdate=true;
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));
    this.points=new T.Points(geometry,new T.PointsMaterial({color:0xf1f8ff,map:texture,size:.19,transparent:true,opacity:.8,depthWrite:false,alphaTest:.015}));this.points.name='weather-snow';this.points.frustumCulled=false;
  }
  update(dt:number,storm:boolean,point:{x:number;z:number},height:number,reduced=false,budget=false){
    const step=Math.min(.1,Math.max(0,dt));this.intensity+=(Number(storm)-this.intensity)*(1-Math.exp(-step*2));
    const material=this.points.material as T.PointsMaterial;material.opacity=.2+this.intensity*.65;material.size=.09+this.intensity*.16;
    const count=Math.round(100+this.intensity*(reduced?120:budget?350:800));this.points.geometry.setDrawRange(0,count);
    this.points.position.set(point.x,height,point.z);
    if(!reduced)for(let i=0;i<(budget?count:900);i++){
      const at=i*3,speed=1.2+this.intensity*5+(i%7)*.2;
      this.positions[at]=T.MathUtils.euclideanModulo(this.positions[at]+44+step*(.7+this.intensity*3),88)-44;
      this.positions[at+1]=T.MathUtils.euclideanModulo(this.positions[at+1]-step*speed,44);
      this.positions[at+2]=T.MathUtils.euclideanModulo(this.positions[at+2]+44+step*(.2+this.intensity),88)-44;
    }
    this.points.geometry.attributes.position.needsUpdate=true;
    this.points.userData.intensity=this.intensity;
  }
}
