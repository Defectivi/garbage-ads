use crate::State;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Document {
    format: String,
    version: u32,
    state: State,
}
pub fn encode(state: &State) -> Result<String, String> {
    validate(state)?;
    serde_json::to_string_pretty(&Document {
        format: "frostbound-native".into(),
        version: 1,
        state: state.clone(),
    })
    .map_err(|e| e.to_string())
}
pub fn decode(text: &str) -> Result<State, String> {
    if text.len() > 12_000_000 {
        return Err("Save exceeds 12 MB.".into());
    }
    let doc: Document = serde_json::from_str(text).map_err(|e| {
        format!("Invalid native save: {e}. Browser JSON import is not implemented.")
    })?;
    if doc.format != "frostbound-native" || doc.version != 1 {
        return Err("Unsupported native save format.".into());
    }
    validate(&doc.state)?;
    Ok(doc.state)
}
pub fn validate(s: &State) -> Result<(), String> {
    let number = |v: f64, max: f64| v.is_finite() && v >= 0.0 && v <= max;
    let point = |p: crate::Point| {
        p.x.is_finite() && p.z.is_finite() && p.x.abs() <= 1_000_000.0 && p.z.abs() <= 1_000_000.0
    };
    let p = &s.player;
    let f = &s.furnace;
    if !point(p.at)
        || !point(f.at)
        || !p.heading.is_finite()
        || !number(s.elapsed, 1e12)
        || !number(p.hp, 100.0)
        || !number(p.hunger, 20.0)
        || !number(p.warmth, 100.0)
        || !number(p.food_cooldown, 3.0)
        || !number(p.protection, 12.0)
        || !number(p.heat_clock, 3.0)
        || !number(p.walk_clock, 30.0)
        || !number(p.sprint_clock, 15.0)
        || !number(p.recent_damage, 3.0)
        || !number(s.weather_clock, 300.0)
        || !(1..=50).contains(&f.level)
        || !number(f.wood_fuel, 1e12)
        || !number(f.charcoal_fuel, 1e12)
        || s.pack.0.iter().any(|n| *n > i32::MAX as u32)
    {
        return Err("Save has invalid player, inventory or furnace values.".into());
    }
    if s.depleted.len() > 50_000
        || s.bears.len() > 10_000
        || s.regions.len() > 10_000
        || s.huts.len() > 2000
    {
        return Err("Save exceeds entity limits.".into());
    }
    let mut ids = std::collections::HashSet::new();
    for b in &s.bears {
        if !point(b.at)
            || !number(b.hp, 50.0)
            || !number(b.cooldown, 1.5)
            || !number(b.heat_tick, 1.0)
            || !ids.insert(&b.id)
        {
            return Err("Invalid or duplicate bear.".into());
        }
    }
    let mut regions = std::collections::HashSet::new();
    if s.regions
        .iter()
        .any(|id| id.len() > 120 || !regions.insert(id))
    {
        return Err("Invalid or duplicate encounter regions.".into());
    }
    if s.depleted.iter().any(|(id, n)| id.len() > 120 || *n > 1000)
        || s.huts
            .iter()
            .any(|h| !point(h.at) || !number(h.hp, 1000.0) || !number(h.construction, 10.0))
    {
        return Err("Invalid resource or building state.".into());
    }
    Ok(())
}
pub fn write(path: &Path, state: &State) -> Result<(), String> {
    let text = encode(state)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?
    }
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, text).map_err(|e| e.to_string())?;
    // Windows rename cannot replace an existing file. Retain the previous validated slot as backup.
    let backup = path.with_extension("json.bak");
    if path.exists() {
        if backup.exists() {
            fs::remove_file(&backup).map_err(|e| e.to_string())?
        }
        fs::rename(path, &backup).map_err(|e| e.to_string())?
    }
    if let Err(e) = fs::rename(&temp, path) {
        if backup.exists() {
            let _ = fs::rename(&backup, path);
        }
        return Err(e.to_string());
    }
    Ok(())
}
pub fn read(path: &Path) -> Result<State, String> {
    let size = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > 12_000_000 {
        return Err("Save exceeds 12 MB.".into());
    }
    decode(&fs::read_to_string(path).map_err(|e| e.to_string())?)
}
