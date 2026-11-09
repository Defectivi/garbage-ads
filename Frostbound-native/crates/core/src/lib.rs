pub mod rng;
pub mod save;
pub mod world;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use world::{CHUNK, Source, Terrain};

pub const STEP: f64 = 1.0 / 60.0;
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Point {
    pub x: f64,
    pub z: f64,
}
impl Point {
    pub fn distance(self, p: Self) -> f64 {
        (self.x - p.x).hypot(self.z - p.z)
    }
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Resource {
    Wood,
    Stone,
    Meat,
    Fish,
    Metal,
    Gold,
    Charcoal,
}
impl Resource {
    pub const ALL: [Self; 7] = [
        Self::Wood,
        Self::Stone,
        Self::Meat,
        Self::Fish,
        Self::Metal,
        Self::Gold,
        Self::Charcoal,
    ];
    pub fn seconds(self) -> f64 {
        match self {
            Self::Wood => 0.3,
            Self::Stone => 0.7,
            Self::Metal => 1.1,
            Self::Gold => 2.2,
            _ => 1.0,
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Self::Wood => "Wood",
            Self::Stone => "Stone",
            Self::Meat => "Meat",
            Self::Fish => "Fish",
            Self::Metal => "Metal",
            Self::Gold => "Gold",
            Self::Charcoal => "Charcoal",
        }
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct Pack(pub [u32; 7]);
impl Pack {
    pub fn get(&self, r: Resource) -> u32 {
        self.0[r as usize]
    }
    pub fn add(&mut self, r: Resource, n: u32) -> bool {
        let Some(v) = self.get(r).checked_add(n) else {
            return false;
        };
        if v > i32::MAX as u32 {
            return false;
        }
        self.0[r as usize] = v;
        true
    }
    pub fn pay(&mut self, cost: &[(Resource, u32)]) -> bool {
        let mut totals = [0u64; 7];
        for (r, n) in cost {
            totals[*r as usize] += *n as u64
        }
        if totals
            .iter()
            .enumerate()
            .any(|(i, n)| *n > self.0[i] as u64)
        {
            return false;
        }
        for (i, n) in totals.into_iter().enumerate() {
            self.0[i] -= n as u32
        }
        true
    }
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum Mode {
    Easy,
    Normal,
    Hard,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Player {
    pub at: Point,
    pub heading: f64,
    pub hp: f64,
    pub warmth: f64,
    pub hunger: f64,
    pub food_cooldown: f64,
    pub walk_clock: f64,
    pub sprint_clock: f64,
    pub heat_clock: f64,
    pub protection: f64,
    pub recent_damage: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Furnace {
    pub at: Point,
    pub level: u32,
    pub wood_fuel: f64,
    pub charcoal_fuel: f64,
}
impl Furnace {
    pub fn radius(&self) -> f64 {
        12.0 + [5, 10, 20].iter().filter(|n| self.level >= **n).count() as f64 * 8.0
    }
    pub fn active(&self) -> bool {
        self.wood_fuel + self.charcoal_fuel > 0.0
    }
}
pub fn upgrade_cost(level: u32) -> Vec<(Resource, u32)> {
    use Resource::*;
    if !(2..=50).contains(&level) {
        return vec![];
    }
    if level <= 5 {
        return vec![(
            Wood,
            match level {
                2 => 30,
                3 => 60,
                _ => 90,
            },
        )];
    }
    if level <= 10 {
        return vec![
            (Wood, 100 + (level - 6) * 10),
            (Metal, if level <= 7 { 10 } else { 20 }),
        ];
    }
    let tier = (level - 11) / 5;
    let step = (level - 11) % 5;
    let mut c = vec![
        (Wood, 150 + tier * 50 + step * 10),
        (Stone, 20 + tier * 25 + step * 5),
        (Metal, 25 + tier * 25 + step * 5),
        (Charcoal, 5 + tier * 5),
    ];
    if level >= 16 {
        c.push((Gold, 5 + (tier - 1) * 5 + step))
    }
    if level >= 21 {
        c.extend([
            (Meat, 5 + (tier - 2) * 5 + step),
            (Fish, 5 + (tier - 2) * 5 + step),
        ])
    }
    c
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Bear {
    pub id: String,
    pub at: Point,
    pub hp: f64,
    pub cooldown: f64,
    pub heat_tick: f64,
    pub in_heat: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Hut {
    pub at: Point,
    pub hp: f64,
    pub construction: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct State {
    pub seed: u32,
    pub mode: Mode,
    pub elapsed: f64,
    pub player: Player,
    pub pack: Pack,
    pub furnace: Furnace,
    pub depleted: BTreeMap<String, u32>,
    pub bears: Vec<Bear>,
    pub regions: Vec<String>,
    pub huts: Vec<Hut>,
    pub storm: bool,
    pub weather_clock: f64,
    pub budget: bool,
    pub show_fps: bool,
}
#[derive(Clone, Copy, Default)]
pub struct Input {
    pub x: f64,
    pub z: f64,
    pub sprint: bool,
    pub gather: bool,
    pub attack: bool,
}
pub struct Gathering {
    pub source: Source,
    pub remaining: f64,
}
pub struct Game {
    pub state: State,
    pub terrain: Terrain,
    pub paused: bool,
    pub gathering: Option<Gathering>,
    pub message: String,
    pub attack_time: f64,
    attack_cooldown: f64,
}
impl Game {
    pub fn new(seed: u32, mode: Mode) -> Self {
        let mut pack = Pack([12, 0, 0, 3, 0, 0, 0]);
        if mode == Mode::Easy {
            for n in &mut pack.0 {
                *n += 20
            }
        }
        Self::from_state(State {
            seed,
            mode,
            elapsed: 0.0,
            player: Player {
                at: Point { x: 0.0, z: 4.0 },
                heading: 0.0,
                hp: if mode == Mode::Hard { 80.0 } else { 100.0 },
                warmth: 100.0,
                hunger: 20.0,
                food_cooldown: 0.0,
                walk_clock: 0.0,
                sprint_clock: 0.0,
                heat_clock: 0.0,
                protection: 12.0,
                recent_damage: 0.0,
            },
            pack,
            furnace: Furnace {
                at: Point::default(),
                level: 1,
                wood_fuel: if mode == Mode::Easy { 120.0 } else { 60.0 },
                charcoal_fuel: 0.0,
            },
            depleted: BTreeMap::new(),
            bears: vec![],
            regions: vec![],
            huts: vec![Hut {
                at: Point { x: -6.0, z: -5.0 },
                hp: 500.0,
                construction: 0.0,
            }],
            storm: false,
            weather_clock: 90.0,
            budget: false,
            show_fps: true,
        })
    }
    pub fn from_state(state: State) -> Self {
        let terrain = Terrain::new(state.seed);
        Self {
            state,
            terrain,
            paused: false,
            gathering: None,
            message: "F gathers nearby supplies. Keep the furnace burning.".into(),
            attack_time: -100.0,
            attack_cooldown: 0.0,
        }
    }
    pub fn dead(&self) -> bool {
        self.state.player.hp <= 0.0
    }
    pub fn heated(&self, p: Point) -> bool {
        self.state.furnace.active()
            && p.distance(self.state.furnace.at) < self.state.furnace.radius()
    }
    pub fn nearby_sources(&self) -> Vec<Source> {
        let p = self.state.player.at;
        let cx = (p.x / CHUNK).floor() as i32;
        let cz = (p.z / CHUNK).floor() as i32;
        let mut out = vec![];
        for x in cx - 1..=cx + 1 {
            for z in cz - 1..=cz + 1 {
                out.extend(self.terrain.sources(x, z))
            }
        }
        out
    }
    pub fn remaining(&self, s: &Source) -> u32 {
        s.amount
            .saturating_sub(*self.state.depleted.get(&s.id).unwrap_or(&0))
    }
    pub fn eat(&mut self, r: Resource) -> Result<(), String> {
        if self.dead() {
            return Err("Cannot eat after death.".into());
        }
        if ![Resource::Fish, Resource::Meat].contains(&r) {
            return Err("This item is not food.".into());
        }
        if self.state.player.food_cooldown > 1e-8 {
            return Err(format!(
                "Next meal in {:0.1}s of unpaused time.",
                self.state.player.food_cooldown
            ));
        }
        if !self.state.pack.pay(&[(r, 1)]) {
            return Err(format!("No {} in your pack.", r.name()));
        }
        let p = &mut self.state.player;
        p.hunger = (p.hunger + if r == Resource::Meat { 3.0 } else { 2.0 }).min(20.0);
        p.hp = (p.hp + 5.0).min(if p.hunger < 5.0 { 50.0 } else { 100.0 });
        p.food_cooldown = 3.0;
        self.message = format!(
            "Ate {}. Hunger +{}, HP +5 (up to current limits).",
            r.name(),
            if r == Resource::Meat { 3 } else { 2 }
        );
        Ok(())
    }
    pub fn feed(&mut self) -> Result<(), String> {
        if self.state.player.at.distance(self.state.furnace.at) > 4.0 {
            return Err("Move within 4m of the furnace.".into());
        }
        let r = if self.state.pack.get(Resource::Charcoal) > 0 {
            Resource::Charcoal
        } else {
            Resource::Wood
        };
        if !self.state.pack.pay(&[(r, 1)]) {
            return Err("Gather wood or charcoal first.".into());
        }
        if r == Resource::Charcoal {
            self.state.furnace.charcoal_fuel += 30.0
        } else {
            self.state.furnace.wood_fuel += 10.0
        }
        self.message = format!("Added {} to the furnace.", r.name());
        Ok(())
    }
    pub fn upgrade(&mut self) -> Result<(), String> {
        let f = &self.state.furnace;
        if self.state.player.at.distance(f.at) > 5.0 {
            return Err("Move within 5m of the furnace.".into());
        }
        if f.level >= 50 {
            return Err("Furnace is already level 50.".into());
        }
        let cost = upgrade_cost(f.level + 1);
        if !self.state.pack.pay(&cost) {
            return Err(format!(
                "Need {}.",
                cost.iter()
                    .map(|(r, n)| format!("{n} {}", r.name()))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        self.state.furnace.level += 1;
        self.message = format!(
            "Furnace level {}. Radius {:0.0}m.",
            self.state.furnace.level,
            self.state.furnace.radius()
        );
        Ok(())
    }
    pub fn build_hut(&mut self) -> Result<(), String> {
        let p = self.state.player.at;
        let at = Point {
            x: p.x,
            z: p.z + 4.0,
        };
        if !self.heated(at)
            || at.distance(self.state.furnace.at) + 2.4 > self.state.furnace.radius()
        {
            return Err("The hut must fit inside active furnace warmth.".into());
        }
        if self.terrain.water(at)
            || self.terrain.slope(at) > 0.3
            || self.state.huts.iter().any(|h| h.at.distance(at) < 5.0)
        {
            return Err("Hut needs clear, dry, gentle ground.".into());
        }
        if !self.state.pack.pay(&[(Resource::Wood, 20)]) {
            return Err("Need 20 wood.".into());
        }
        self.state.huts.push(Hut {
            at,
            hp: 1000.0,
            construction: 10.0,
        });
        self.message =
            "Hut construction started (10 seconds). Worker simulation has not been ported yet."
                .into();
        Ok(())
    }
    pub fn recover(&mut self) {
        for n in &mut self.state.pack.0 {
            *n /= 2
        }
        let p = &mut self.state.player;
        p.at = Point { x: 0.0, z: 4.0 };
        p.hp = 100.0;
        p.hunger = 20.0;
        p.warmth = 100.0;
        p.protection = 12.0;
        p.heat_clock = 0.0;
        self.gathering = None;
        self.message = "Recovered at home. Half your carried supplies were lost.".into()
    }
    pub fn step(&mut self, input: Input, dt: f64) {
        if self.paused || self.dead() || !dt.is_finite() || dt <= 0.0 {
            return;
        }
        let dt = dt.min(0.1);
        self.state.elapsed += dt;
        self.attack_cooldown = (self.attack_cooldown - dt).max(0.0);
        let p = &mut self.state.player;
        p.food_cooldown = (p.food_cooldown - dt).max(0.0);
        p.protection = (p.protection - dt).max(0.0);
        p.recent_damage = (p.recent_damage - dt).max(0.0);
        let length = input.x.hypot(input.z);
        let moving = length > 1e-6;
        if moving {
            let speed =
                if input.sprint { 9.0 } else { 6.0 } * if p.hunger < 10.0 { 0.8 } else { 1.0 };
            let speed = speed * if self.terrain.water(p.at) { 0.1 } else { 1.0 };
            let len = length.max(1.0);
            let next = Point {
                x: p.at.x + input.x / len * speed * dt,
                z: p.at.z + input.z / len * speed * dt,
            };
            p.at = next;
            p.heading = input.x.atan2(input.z);
            self.gathering = None;
            let rate = if self.state.mode == Mode::Easy {
                0.5
            } else {
                1.0
            };
            if input.sprint {
                p.sprint_clock += dt * rate;
                while p.sprint_clock >= 15.0 - 1e-8 {
                    p.sprint_clock = (p.sprint_clock - 15.0).max(0.0);
                    p.hunger = (p.hunger - 2.0).max(0.0)
                }
            } else {
                p.walk_clock += dt * rate;
                while p.walk_clock >= 30.0 - 1e-8 {
                    p.walk_clock = (p.walk_clock - 30.0).max(0.0);
                    p.hunger = (p.hunger - 1.0).max(0.0)
                }
            }
        }
        self.state.weather_clock -= dt;
        if self.state.weather_clock <= 0.0 {
            self.state.storm = !self.state.storm;
            self.state.weather_clock = if self.state.storm { 55.0 } else { 120.0 };
        }
        let f = &mut self.state.furnace;
        let consume =
            dt * if self.state.storm { 3.0 } else { 1.0 } / (1.0 + (f.level - 1) as f64 * 0.2);
        let used = f.charcoal_fuel.min(consume);
        f.charcoal_fuel -= used;
        f.wood_fuel = (f.wood_fuel - (consume - used)).max(0.0);
        let heated = self.heated(self.state.player.at);
        let p = &mut self.state.player;
        let max_hp = if p.hunger < 5.0 { 50.0 } else { 100.0 };
        p.hp = p.hp.min(max_hp);
        if heated {
            p.warmth = (p.warmth + 12.0 * dt).min(100.0);
            p.heat_clock += dt;
            while p.heat_clock >= 3.0 - 1e-8 {
                p.heat_clock = (p.heat_clock - 3.0).max(0.0);
                p.hp = (p.hp + if p.recent_damage > 0.0 { 10.0 } else { 25.0 }).min(max_hp)
            }
        } else {
            p.heat_clock = 0.0;
            p.warmth = (p.warmth - dt * 0.88 * if input.sprint { 2.0 } else { 1.0 }).max(0.0)
        }
        if p.hunger <= 0.0 {
            p.hp = (p.hp - 15.0 * dt).max(0.0)
        }
        for hut in &mut self.state.huts {
            hut.construction = (hut.construction - dt).max(0.0)
        }
        if input.gather && !moving {
            if self.gathering.is_none() {
                let p = self.state.player.at;
                if let Some(source) = self
                    .nearby_sources()
                    .into_iter()
                    .filter(|s| self.remaining(s) > 0 && s.at.distance(p) < 3.0)
                    .min_by(|a, b| a.at.distance(p).total_cmp(&b.at.distance(p)))
                {
                    let remaining = source.resource.seconds();
                    self.gathering = Some(Gathering { source, remaining });
                }
            }
            if let Some(mut task) = self.gathering.take()
                && self.remaining(&task.source) > 0
                && task.source.at.distance(self.state.player.at) < 3.0
            {
                task.remaining -= dt;
                if task.remaining <= 1e-8 {
                    if self.state.pack.add(task.source.resource, 1) {
                        *self.state.depleted.entry(task.source.id).or_default() += 1;
                        self.message = format!("Collected 1 {}.", task.source.resource.name())
                    }
                } else {
                    self.gathering = Some(task)
                }
            }
        } else {
            self.gathering = None
        }
        if self.state.player.protection <= 0.0 {
            self.encounters()
        }
        if input.attack && self.attack_cooldown <= 0.0 {
            self.attack_cooldown = 1.0;
            self.attack_time = self.state.elapsed;
            let p = self.state.player.at;
            if let Some(b) = self
                .state
                .bears
                .iter_mut()
                .filter(|b| b.hp > 0.0 && b.at.distance(p) < 2.0)
                .min_by(|a, b| a.at.distance(p).total_cmp(&b.at.distance(p)))
            {
                b.hp = (b.hp - 2.0 * if heated { 2.0 } else { 1.0 }).max(0.0);
                self.message = "Punch hit: 2 damage.".into();
            }
        }
        let p = self.state.player.at;
        let radius = self.state.furnace.radius();
        let heat_active = self.state.furnace.active();
        let center = self.state.furnace.at;
        for b in &mut self.state.bears {
            if b.hp <= 0.0 {
                continue;
            }
            let inside = heat_active && b.at.distance(center) < radius;
            if inside && !b.in_heat {
                b.hp = (b.hp - 5.0).max(0.0)
            }
            b.in_heat = inside;
            if inside {
                b.heat_tick += dt;
                while b.heat_tick >= 1.0 {
                    b.heat_tick -= 1.0;
                    b.hp = (b.hp - 12.0).max(0.0)
                }
            } else {
                b.heat_tick = 0.0
            }
            if b.hp <= 0.0 {
                continue;
            }
            let d = b.at.distance(p);
            b.cooldown = (b.cooldown - dt).max(0.0);
            if d > 45.0 || self.state.player.protection > 0.0 || self.state.mode == Mode::Easy {
                continue;
            }
            if d > 1.4 {
                let step = (1.8 * dt * if inside { 0.5 } else { 1.0 }).min(d - 1.4);
                b.at.x += (p.x - b.at.x) / d * step;
                b.at.z += (p.z - b.at.z) / d * step
            } else if b.cooldown <= 0.0 {
                b.cooldown = 1.5;
                self.state.player.hp =
                    (self.state.player.hp - 15.0 * if heated { 0.5 } else { 1.0 }).max(0.0);
                self.state.player.recent_damage = 3.0;
            }
        }
    }
    fn encounters(&mut self) {
        let p = self.state.player.at;
        let cx = (p.x / 64.0).floor() as i32;
        let cz = (p.z / 64.0).floor() as i32;
        for x in cx - 1..=cx + 1 {
            for z in cz - 1..=cz + 1 {
                let key = format!("bear:{x}:{z}");
                if self.state.regions.contains(&key) {
                    continue;
                }
                self.state.regions.push(key.clone());
                let mut rng = rng::Rng(rng::derive(self.state.seed, "native-bears", x, z));
                let at = Point {
                    x: x as f64 * 64.0 + rng.range(20.0, 48.0),
                    z: z as f64 * 64.0 + rng.range(20.0, 48.0),
                };
                self.state.bears.push(Bear {
                    id: key,
                    at,
                    hp: if self.state.mode == Mode::Easy {
                        35.0
                    } else {
                        50.0
                    },
                    cooldown: 0.0,
                    heat_tick: 0.0,
                    in_heat: false,
                });
            }
        }
    }
}
