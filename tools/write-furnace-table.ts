import {writeFileSync} from 'node:fs';
import {furnaceCost,fuelInterval,furnaceRadius} from '../src/data/furnaces';
import {RESOURCE_IDS} from '../src/data/definitions';
const rows=Array.from({length:49},(_,i)=>{const level=i+2,cost=furnaceCost(level);return `| ${level-1} > ${level} | ${RESOURCE_IDS.map(r=>cost[r]??'-').join(' | ')} | ${fuelInterval(level).toFixed(1)}s | ${furnaceRadius(level)} |`;});
writeFileSync('docs/FURNACE_UPGRADES.md',`# Furnace progression

Generated from src/data/furnaces.ts with npx tsx tools/write-furnace-table.ts. Costs use stored resources first, then carried resources. Meat and fish provision the builders. Wood gives 10 base fuel seconds; charcoal gives 30, is selected first, and uses the same level-adjusted burn interval. Level 1 consumes one fuel unit per second; each additional level adds 0.2 seconds to that interval. Snow multiplies consumption by three. Radius starts at 12 units and expands by 8 only upon reaching levels 5, 10 and 20: 20, 28 and 36 units. Three expansions maximum; levels 21-50 improve fuel efficiency only. Saved furnaces derive their radius from their level using the same milestones. Model reinforcements still change every five levels.

| Upgrade | Wood | Stone | Meat | Fish | Metal | Gold | Charcoal | Burn interval | Heat radius |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}
`);
