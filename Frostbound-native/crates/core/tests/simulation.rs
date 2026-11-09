use frostbound_core::{rng::*, save, world::Terrain, *};
fn advance(g: &mut Game, seconds: f64, input: Input) {
    for _ in 0..(seconds / STEP).round() as u32 {
        g.step(input, STEP)
    }
}
#[test]
fn transactions_are_atomic_and_aggregate_duplicate_costs() {
    let mut p = Pack([4, 2, 0, 0, 0, 0, 0]);
    let before = p.clone();
    assert!(!p.pay(&[(Resource::Wood, 3), (Resource::Wood, 2)]));
    assert_eq!(p, before);
    assert!(p.pay(&[(Resource::Wood, 4)]));
    assert_eq!(p.get(Resource::Wood), 0);
    p.0[0] = i32::MAX as u32;
    assert!(!p.add(Resource::Wood, 1));
}
#[test]
fn food_effects_apply_once_and_cooldown_pauses() {
    let mut g = Game::new(42, Mode::Normal);
    g.state.player.hp = 50.0;
    g.state.player.hunger = 8.0;
    assert!(g.eat(Resource::Fish).is_ok());
    assert_eq!(g.state.player.hp, 55.0);
    assert_eq!(g.state.player.hunger, 10.0);
    assert_eq!(g.state.pack.get(Resource::Fish), 2);
    for _ in 0..20 {
        assert!(g.eat(Resource::Fish).is_err())
    }
    g.paused = true;
    advance(&mut g, 4.0, Input::default());
    assert_eq!(g.state.player.food_cooldown, 3.0);
    g.paused = false;
    advance(&mut g, 3.0, Input::default());
    assert!(g.eat(Resource::Fish).is_ok());
    assert_eq!(g.state.pack.get(Resource::Fish), 1);
}
#[test]
fn full_stats_still_spend_food_and_missing_food_is_rejected() {
    let mut g = Game::new(42, Mode::Normal);
    g.eat(Resource::Fish).unwrap();
    assert_eq!(g.state.player.hp, 100.0);
    assert_eq!(g.state.player.hunger, 20.0);
    assert_eq!(g.state.pack.get(Resource::Fish), 2);
    g.state.player.food_cooldown = 0.0;
    assert!(g.eat(Resource::Meat).is_err());
    assert!(g.eat(Resource::Wood).is_err());
}
#[test]
fn gathering_timing_yield_and_interruptions() {
    let mut g = Game::new(42, Mode::Normal);
    g.state.player.at = Point { x: 4.5, z: 4.0 };
    let input = Input {
        gather: true,
        ..Default::default()
    };
    let before = g.state.pack.get(Resource::Wood);
    advance(&mut g, 0.28333, input);
    assert_eq!(g.state.pack.get(Resource::Wood), before);
    g.step(input, STEP);
    assert_eq!(g.state.pack.get(Resource::Wood), before + 1);
    g.step(input, STEP);
    g.step(Input::default(), STEP);
    assert!(g.gathering.is_none());
    assert_eq!(g.state.pack.get(Resource::Wood), before + 1);
    assert_eq!(
        [
            Resource::Wood.seconds(),
            Resource::Stone.seconds(),
            Resource::Metal.seconds(),
            Resource::Gold.seconds()
        ],
        [0.3, 0.7, 1.1, 2.2]
    );
}
#[test]
fn depleted_resource_is_finite_and_survives_save() {
    let mut g = Game::new(42, Mode::Normal);
    g.state.player.at = Point { x: 4.5, z: 4.0 };
    advance(
        &mut g,
        9.0,
        Input {
            gather: true,
            ..Default::default()
        },
    );
    assert_eq!(g.state.depleted.get("starter:wood"), Some(&30));
    let restored = Game::from_state(save::decode(&save::encode(&g.state).unwrap()).unwrap());
    let source = restored
        .nearby_sources()
        .into_iter()
        .find(|s| s.id == "starter:wood")
        .unwrap();
    assert_eq!(restored.remaining(&source), 0);
}
#[test]
fn furnace_fuel_priority_storm_and_milestones() {
    let mut g = Game::new(42, Mode::Normal);
    g.state.pack.add(Resource::Charcoal, 1);
    g.feed().unwrap();
    assert_eq!(g.state.furnace.charcoal_fuel, 30.0);
    assert_eq!(g.state.pack.get(Resource::Wood), 12);
    advance(&mut g, 1.0, Input::default());
    assert!((g.state.furnace.charcoal_fuel - 29.0).abs() < 1e-8);
    assert_eq!(g.state.furnace.wood_fuel, 60.0);
    g.state.storm = true;
    advance(&mut g, 1.0, Input::default());
    assert!((g.state.furnace.charcoal_fuel - 26.0).abs() < 1e-8);
    for (level, radius) in [(1, 12.0), (5, 20.0), (10, 28.0), (20, 36.0), (50, 36.0)] {
        g.state.furnace.level = level;
        assert_eq!(g.state.furnace.radius(), radius)
    }
    g.state.furnace.level = 50;
    let before = g.state.pack.clone();
    assert!(g.upgrade().is_err());
    assert_eq!(g.state.pack, before);
}
#[test]
fn hunger_uses_movement_not_idle_clock() {
    let mut g = Game::new(42, Mode::Normal);
    advance(&mut g, 31.0, Input::default());
    assert_eq!(g.state.player.hunger, 20.0);
    advance(
        &mut g,
        30.0,
        Input {
            x: 1.0,
            ..Default::default()
        },
    );
    assert_eq!(g.state.player.hunger, 19.0);
    advance(
        &mut g,
        15.0,
        Input {
            x: 1.0,
            sprint: true,
            ..Default::default()
        },
    );
    assert_eq!(g.state.player.hunger, 17.0);
}
#[test]
fn healing_requires_three_seconds_inside_active_heat() {
    let mut g = Game::new(42, Mode::Normal);
    g.state.player.hp = 20.0;
    advance(&mut g, 3.0, Input::default());
    assert_eq!(g.state.player.hp, 45.0);
    g.state.player.recent_damage = 3.0;
    g.state.player.heat_clock = 2.9;
    advance(&mut g, 0.1, Input::default());
    assert_eq!(g.state.player.hp, 55.0);
}
#[test]
fn budget_preference_does_not_change_simulation() {
    let mut a = Game::new(42, Mode::Normal);
    let mut b = Game::new(42, Mode::Normal);
    b.state.budget = true;
    let input = Input {
        x: 0.5,
        z: 0.5,
        sprint: true,
        ..Default::default()
    };
    for _ in 0..900 {
        a.step(input, STEP);
        b.step(input, STEP)
    }
    b.state.budget = false;
    assert_eq!(
        save::encode(&a.state).unwrap(),
        save::encode(&b.state).unwrap()
    );
}
#[test]
fn saves_reject_invalid_values_duplicates_and_browser_documents() {
    let g = Game::new(42, Mode::Normal);
    let text = save::encode(&g.state).unwrap();
    assert!(save::decode(&text).is_ok());
    let mut doc: serde_json::Value = serde_json::from_str(&text).unwrap();
    doc["state"]["pack"] = serde_json::json!([2147483648u64, 0, 0, 0, 0, 0, 0]);
    assert!(save::decode(&doc.to_string()).is_err());
    assert!(save::decode(r#"{"format":"frostbound","formatVersion":3}"#).is_err());
    let mut state = g.state.clone();
    state.player.at.x = f64::NAN;
    assert!(save::encode(&state).is_err());
    state = g.state;
    state.regions = vec!["bear:0:0".into(), "bear:0:0".into()];
    assert!(save::encode(&state).is_err());
}
#[test]
fn generation_is_deterministic_across_reentry() {
    let a = Terrain::new(42);
    let b = Terrain::new(42);
    assert_eq!(
        a.height(Point { x: 200.0, z: 64.0 }),
        b.height(Point { x: 200.0, z: 64.0 })
    );
    assert_eq!(
        serde_json::to_string(&a.sources(2, -1)).unwrap(),
        serde_json::to_string(&b.sources(2, -1)).unwrap()
    );
    for source in a.sources(2, -1).iter().filter(|s| s.tree) {
        assert!(a.slope(source.at) <= 0.3);
        assert!(!a.water(source.at));
    }
}
#[test]
fn save_load_does_not_duplicate_encounters() {
    let mut g = Game::new(42, Mode::Normal);
    advance(&mut g, 12.1, Input::default());
    let count = g.state.bears.len();
    assert!(count > 0);
    let mut restored = Game::from_state(save::decode(&save::encode(&g.state).unwrap()).unwrap());
    advance(&mut restored, 0.1, Input::default());
    assert_eq!(restored.state.bears.len(), count);
}
#[test]
fn death_recovery_deducts_half_and_restores_protection() {
    let mut g = Game::new(42, Mode::Normal);
    g.state.player.hp = 0.0;
    g.state.pack.0[0] = 13;
    g.recover();
    assert_eq!(g.state.pack.get(Resource::Wood), 6);
    assert_eq!(g.state.player.hp, 100.0);
    assert_eq!(g.state.player.protection, 12.0);
}
#[test]
fn rng_matches_browser_reference() {
    let fixtures: serde_json::Value =
        serde_json::from_str(include_str!("../../../fixtures/rng.json")).unwrap();
    for sample in fixtures["derive"].as_array().unwrap() {
        assert_eq!(
            derive(
                sample["seed"].as_u64().unwrap() as u32,
                sample["label"].as_str().unwrap(),
                sample["x"].as_i64().unwrap() as i32,
                sample["z"].as_i64().unwrap() as i32
            ),
            sample["result"].as_u64().unwrap() as u32
        )
    }
    for sample in fixtures["rng"].as_array().unwrap() {
        let mut rng = Rng(sample["seed"].as_u64().unwrap() as u32);
        for n in sample["values"].as_array().unwrap() {
            assert_eq!(rng.next_f64(), n.as_f64().unwrap());
        }
    }
}

#[test]
fn native_slot_keeps_backup_and_rejects_invalid_replacement() {
    let dir = std::env::temp_dir().join(format!("frostbound-native-test-{}", std::process::id()));
    let path = dir.join("world.json");
    let mut g = Game::new(42, Mode::Normal);
    save::write(&path, &g.state).unwrap();
    g.state.pack.0[0] = 99;
    save::write(&path, &g.state).unwrap();
    assert_eq!(save::read(&path).unwrap().pack.0[0], 99);
    assert_eq!(
        save::read(&path.with_extension("json.bak")).unwrap().pack.0[0],
        12
    );
    g.state.player.hp = f64::NAN;
    assert!(save::write(&path, &g.state).is_err());
    assert_eq!(save::read(&path).unwrap().pack.0[0], 99);
    std::fs::remove_file(&path).unwrap();
    std::fs::remove_file(path.with_extension("json.bak")).unwrap();
    std::fs::remove_dir(dir).unwrap();
}
