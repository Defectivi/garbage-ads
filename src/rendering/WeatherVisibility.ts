export function weatherVisibility(zoom:number,renderDistance:number,intensity:number){
 const clearFar=renderDistance===1?56:110,stormFar=Math.min(clearFar,Math.hypot(zoom,zoom*.92)+9),stormNear=Math.max(6,stormFar-24),t=Math.max(0,Math.min(1,intensity));
 return{near:42+(stormNear-42)*t,far:clearFar+(stormFar-clearFar)*t};
}
