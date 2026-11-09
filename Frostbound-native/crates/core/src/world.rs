use crate::{
    Point, Resource,
    rng::{Rng, derive, noise, smooth},
};
use serde::{Deserialize, Serialize};

pub const CHUNK: f64 = 32.0;
pub const SITES: [Point; 3] = [
    Point { x: 128.0, z: 8.0 },
    Point {
        x: -144.0,
        z: -32.0,
    },
    Point { x: 192.0, z: 176.0 },
];
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Source {
    pub id: String,
    pub at: Point,
    pub resource: Resource,
    pub amount: u32,
    pub tree: bool,
}
pub struct Terrain {
    pub seed: u32,
    terrain: u32,
    rivers: u32,
    biomes: u32,
    resources: u32,
}
impl Terrain {
    pub fn new(seed: u32) -> Self {
        let stream = |label| {
            let n = derive(seed, label, 0, 0);
            if seed <= 65535 { n & 65535 } else { n }
        };
        Self {
            seed,
            terrain: stream("terrain"),
            rivers: stream("rivers"),
            biomes: stream("biomes"),
            resources: stream("resources"),
        }
    }
    pub fn channels(&self, x: f64, z: f64) -> Vec<(f64, f64, i32)> {
        let row = ((z - 48.0) / 128.0).round() as i32;
        let mut out = Vec::with_capacity(6);
        for i in row - 1..=row + 1 {
            let center = 48.0
                + i as f64 * 128.0
                + (x / 31.0 + self.rivers as f64 * 0.01).sin() * 6.0
                + (x / 83.0 + self.terrain as f64 * 0.01).sin() * 10.0;
            out.push((
                self.avoid_village(x, center, 34.0, 30.0),
                3.4 + noise(self.rivers, x / 38.0, i as f64) * 1.8,
                i,
            ));
        }
        let slope = if derive(self.rivers, "tributary-direction", 0, 0) % 2 == 1 {
            1.0
        } else {
            -1.0
        } * (0.35 + (derive(self.rivers, "tributary-slope", 0, 0) % 30) as f64 / 100.0);
        let wave = (x / 67.0 + self.terrain as f64 * 0.01).sin() * 14.0;
        let row = ((z - 92.0 - slope * x - wave) / 256.0).round() as i32;
        for i in row - 1..=row + 1 {
            out.push((
                self.avoid_village(x, 92.0 + i as f64 * 256.0 + slope * x + wave, 38.0, 32.0),
                2.8 + noise(self.rivers ^ 1837, x / 47.0, i as f64) * 1.6,
                1_000_000 + i,
            ));
        }
        out
    }
    fn avoid_village(&self, x: f64, mut center: f64, span: f64, clear: f64) -> f64 {
        for p in SITES {
            if (x - p.x).abs() < span && (center - p.z).abs() < clear {
                center += if center >= p.z { 1.0 } else { -1.0 }
                    * (clear - (center - p.z).abs())
                    * smooth((span - (x - p.x).abs()) / 8.0)
            }
        }
        center
    }
    pub fn river(&self, x: f64, z: f64) -> (f64, f64, i32) {
        self.channels(x, z)
            .into_iter()
            .min_by(|a, b| ((z - a.0).abs() - a.1).total_cmp(&((z - b.0).abs() - b.1)))
            .unwrap()
    }
    pub fn bridge(&self, p: Point) -> Option<Point> {
        let x = (p.x / 64.0).round() * 64.0;
        if (p.x - x).abs() > 2.35 {
            return None;
        }
        let (c, w, id) = self.river(x, p.z);
        if (p.z - c).abs() > w + 1.5 {
            return None;
        }
        if self
            .channels(x, p.z)
            .iter()
            .any(|r| r.2 != id && (r.0 - c).abs() < w + r.1 + 8.0)
        {
            return None;
        }
        Some(Point { x, z: c })
    }
    pub fn water(&self, p: Point) -> bool {
        if self.bridge(p).is_some() {
            return false;
        }
        let (c, w, _) = self.river(p.x, p.z);
        (p.z - c).abs() < w + 0.2
    }
    pub fn height(&self, p: Point) -> f64 {
        if self.bridge(p).is_some() {
            return 0.65;
        }
        let x = p.x;
        let z = p.z;
        let mut raw = (noise(self.terrain, x / 62.0, z / 62.0) - 0.4) * 8.0
            + noise(self.terrain ^ 5182, x / 17.0, z / 17.0) * 1.5;
        raw += (noise(self.terrain ^ 30917, x / 85.0, z / 85.0) - 0.42).max(0.0) * 38.0
            + (noise(self.terrain ^ 51039, x / 34.0, z / 34.0) - 0.6).max(0.0) * 12.0;
        let cx = (x / 192.0).floor() as i32;
        let cz = (z / 192.0).floor() as i32;
        for a in cx - 1..=cx + 1 {
            for b in cz - 1..=cz + 1 {
                let mut rng = Rng(derive(self.terrain, "highlands", a, b));
                if rng.next_f64() > 0.68 {
                    continue;
                }
                let mountain = rng.next_f64() < 0.7;
                let hx = (a as f64 + rng.range(0.25, 0.75)) * 192.0;
                let hz = (b as f64 + rng.range(0.25, 0.75)) * 192.0;
                let radius = rng.range(48.0, 80.0);
                let h = if mountain {
                    rng.range(32.0, 66.0)
                } else {
                    rng.range(10.0, 20.0)
                };
                let stretch = rng.range(0.8, 1.4);
                let angle = rng.range(0.0, std::f64::consts::PI);
                let dx = x - hx;
                let dz = z - hz;
                let r = ((dx * angle.cos() + dz * angle.sin()) / radius)
                    .hypot((-dx * angle.sin() + dz * angle.cos()) / (radius * stretch));
                if r < 1.0 {
                    raw += h * (1.0 - r * r).powf(1.65)
                }
            }
        }
        let home = smooth((x.hypot(z) - 10.0) / 18.0);
        let mut base = 0.8 * (1.0 - home) + raw * home;
        for site in SITES {
            let edge = smooth((site.distance(p) - 15.0) / 8.0);
            base = 0.8 * (1.0 - edge) + base * edge
        }
        let (c, w, _) = self.river(x, z);
        let d = (z - c).abs();
        let bank = smooth((d - w) / 9.0);
        (-1.1 + (d / w).min(1.0) * 0.8) * (1.0 - bank) + base * bank
    }
    pub fn slope(&self, p: Point) -> f64 {
        let d = 1.25;
        (self.height(Point { x: p.x + d, ..p }) - self.height(Point { x: p.x - d, ..p }))
            .hypot(self.height(Point { z: p.z + d, ..p }) - self.height(Point { z: p.z - d, ..p }))
            / (2.0 * d)
    }
    pub fn sources(&self, cx: i32, cz: i32) -> Vec<Source> {
        let mut out = Vec::new();
        let mut rng = Rng(derive(self.resources, "chunk-nodes", cx, cz));
        for i in 0..14 {
            let at = Point {
                x: cx as f64 * CHUNK + rng.range(1.0, 31.0),
                z: cz as f64 * CHUNK + rng.range(1.0, 31.0),
            };
            let amount = 5 + (rng.next_f64() * 7.0).floor() as u32;
            let resource = if i % 5 == 0 {
                Resource::Metal
            } else if i % 2 == 1 {
                Resource::Wood
            } else {
                Resource::Stone
            };
            if at.x.hypot(at.z) >= 6.0 && !self.water(at) {
                out.push(Source {
                    id: format!("node:{cx}:{cz}:{i}"),
                    at,
                    resource,
                    amount,
                    tree: false,
                });
            }
        }
        if (cx, cz) == (0, 0) {
            out.push(Source {
                id: "starter:wood".into(),
                at: Point { x: 3.8, z: 4.0 },
                resource: Resource::Wood,
                amount: 30,
                tree: false,
            })
        }
        if (cx, cz) == (-1, 0) {
            out.push(Source {
                id: "starter:stone".into(),
                at: Point { x: -4.0, z: 3.0 },
                resource: Resource::Stone,
                amount: 25,
                tree: false,
            })
        }
        let mut rng = Rng(derive(self.biomes, "trees", cx, cz));
        let mut index = 0;
        for _ in 0..35 {
            let at = Point {
                x: cx as f64 * CHUNK + rng.range(0.7, 31.3),
                z: cz as f64 * CHUNK + rng.range(0.7, 31.3),
            };
            let scale = rng.range(0.8, 1.5);
            let sparse = rng.next_f64();
            if at.x.hypot(at.z) < 13.0
                || self.water(at)
                || self.bridge(at).is_some()
                || self.slope(at) > 0.3
                || SITES.iter().any(|s| s.distance(at) < 19.0)
                || (noise(self.biomes, at.x / 70.0, at.z / 70.0) <= 0.56 && sparse > 0.35)
            {
                continue;
            }
            out.push(Source {
                id: format!("tree:{cx}:{cz}:{index}"),
                at,
                resource: Resource::Wood,
                amount: 3 + (scale * 2.0).floor() as u32,
                tree: true,
            });
            index += 1;
        }
        out
    }
}
