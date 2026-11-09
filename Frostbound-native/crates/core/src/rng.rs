pub fn derive(seed: u32, label: &str, x: i32, z: i32) -> u32 {
    let mut h = 2_166_136_261_u32 ^ seed;
    // JS for-of visits Unicode scalars, then charCodeAt(0) reads their first UTF-16 unit.
    for c in format!("{label}:{x}:{z}").chars() {
        h ^= c.encode_utf16(&mut [0; 2])[0] as u32;
        h = h.wrapping_mul(16_777_619);
    }
    h ^= h >> 16;
    h = h.wrapping_mul(0x85ebca6b);
    h ^= h >> 13;
    h ^ (h >> 16)
}

pub struct Rng(pub u32);
impl Rng {
    pub fn next_f64(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b79f5);
        let mut t = (self.0 ^ (self.0 >> 15)).wrapping_mul(self.0 | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        ((t ^ (t >> 14)) as f64) / 4_294_967_296.0
    }
    pub fn range(&mut self, a: f64, b: f64) -> f64 {
        a + self.next_f64() * (b - a)
    }
}
pub fn smooth(n: f64) -> f64 {
    let t = n.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
pub fn noise(seed: u32, x: f64, z: f64) -> f64 {
    let ix = x.floor() as i32;
    let iz = z.floor() as i32;
    let fx = smooth(x - x.floor());
    let fz = smooth(z - z.floor());
    let v = |dx, dz| derive(seed, "noise", ix + dx, iz + dz) as f64 / 4_294_967_296.0;
    (v(0, 0) * (1.0 - fx) + v(1, 0) * fx) * (1.0 - fz) + (v(0, 1) * (1.0 - fx) + v(1, 1) * fx) * fz
}
pub fn parse_seed(text: &str) -> Result<u32, String> {
    let text = text.trim();
    if text.is_empty() || text.encode_utf16().count() > 128 {
        return Err("Use a seed of 1-128 characters.".into());
    }
    if let Ok(n) = text.parse::<f64>() {
        return if n.is_finite() && n.fract() == 0.0 && (0.0..=u32::MAX as f64).contains(&n) {
            Ok(n as u32)
        } else {
            Err("Numeric seed must be 0-4294967295.".into())
        };
    }
    let mut h = 2_166_136_261_u32;
    for c in text.encode_utf16() {
        h = (h ^ c as u32).wrapping_mul(16_777_619)
    }
    Ok(derive(h, "text-seed", 0, 0))
}
