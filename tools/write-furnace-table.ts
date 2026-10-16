import {writeFileSync} from 'node:fs';
import {furnaceCost,fuelInterval} from '../src/data/furnaces';
import {RESOURCE_IDS} from '../src/data/definitions';
const rows=Array.from({length:49},(_,i)=>{const level=i+2,cost=furnaceCost(level);return `| ${level-1} > ${level} | ${RESOURCE_IDS.map(r=>cost[r]??'-').join(' | ')} | ${fuelInterval(level).toFixed(1)}s |`;});
writeFileSync('docs/FURNACE_UPGRADES.md',`# Furnace progression

Generated from src/data/furnaces.ts with npx tsx tools/write-furnace-table.ts. Costs use stored resources first, then carried resources. Meat and fish provision the builders. Wood gives 10 base fuel seconds; charcoal gives 30, is selected first, and uses the same level-adjusted burn interval. Level 1 consumes one fuel unit per second; each additional level adds 0.2 seconds to that interval. Snow multiplies consumption by three. Radius increases by 8 per level through level 20 (164 units), then remains fixed through level 50. Model reinforcements still change every five levels.

| Upgrade | Wood | Stone | Meat | Fish | Metal | Gold | Charcoal | Burn interval |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}
`);
