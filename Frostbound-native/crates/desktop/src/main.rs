#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod graphics;
mod ui;
use bevy::{
    input::mouse::{AccumulatedMouseMotion, AccumulatedMouseScroll},
    prelude::*,
    window::PrimaryWindow,
};
use frostbound_core::{Game, Input, Mode, Resource as Item, STEP, save};
use std::path::PathBuf;

#[derive(Resource)]
struct Simulation(Game);
#[derive(Resource, Default)]
struct Controls(Input);
#[derive(Clone, Copy, PartialEq, Eq, Default, Debug)]
enum Screen {
    #[default]
    Title,
    Play,
    Pause,
    Inventory,
    Settings,
    Death,
}
#[derive(Resource)]
struct Desktop {
    screen: Screen,
    revision: u64,
    seed: String,
    mode: Mode,
    orbit: f32,
    zoom: f32,
    save_path: PathBuf,
    smoke: bool,
    smoke_stage: u32,
    smoke_time: f32,
}
impl Desktop {
    fn screen(&mut self, screen: Screen) {
        self.screen = screen;
        self.revision += 1
    }
}

fn main() {
    let args: Vec<_> = std::env::args().collect();
    let seed = args
        .windows(2)
        .find(|a| a[0] == "--seed")
        .map(|a| a[1].clone())
        .unwrap_or("42".into());
    let parsed = frostbound_core::rng::parse_seed(&seed).unwrap_or_else(|e| {
        eprintln!("{e}");
        std::process::exit(2)
    });
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let exe_assets = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join("assets")));
    let asset_dir = exe_assets
        .filter(|p| p.is_dir())
        .unwrap_or_else(|| root.join("assets"));
    let save_dir = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("saves"))
        .join("FYWS-Frostbound-native");
    let mut game = Game::new(parsed, Mode::Normal);
    game.state.budget = args.iter().any(|a| a == "--budget");
    let gpu = bevy::render::settings::WgpuSettings {
        backends: if cfg!(target_os = "windows") {
            Some(bevy::render::settings::Backends::DX12)
        } else {
            None
        },
        ..default()
    };
    App::new()
        .insert_resource(Simulation(game))
        .insert_resource(Desktop {
            screen: Screen::Title,
            revision: 0,
            seed,
            mode: Mode::Normal,
            orbit: 0.55,
            zoom: 23.0,
            save_path: save_dir.join("world.json"),
            smoke: args.iter().any(|a| a == "--smoke"),
            smoke_stage: 0,
            smoke_time: 0.0,
        })
        .init_resource::<Controls>()
        .insert_resource(Time::<Fixed>::from_hz(60.0))
        .insert_resource(ClearColor(Color::srgb_u8(183, 204, 213)))
        .insert_resource(AmbientLight {
            color: Color::srgb_u8(204, 224, 238),
            brightness: 500.0,
            ..default()
        })
        .add_plugins(
            DefaultPlugins
                .set(bevy::render::RenderPlugin {
                    render_creation: bevy::render::settings::RenderCreation::Automatic(gpu),
                    ..default()
                })
                .set(AssetPlugin {
                    file_path: asset_dir.to_string_lossy().into_owned(),
                    ..default()
                })
                .set(WindowPlugin {
                    primary_window: Some(Window {
                        title: "FYWS: Frostbound | Native Preview".into(),
                        resolution: (1280, 800).into(),
                        ..default()
                    }),
                    ..default()
                }),
        )
        .register_type::<Transform>()
        .register_type::<GlobalTransform>()
        .register_type::<bevy::transform::components::TransformTreeChanged>()
        .register_type::<Visibility>()
        .register_type::<InheritedVisibility>()
        .register_type::<ViewVisibility>()
        .register_type::<Name>()
        .register_type::<ChildOf>()
        .register_type::<Children>()
        .register_type::<Mesh3d>()
        .register_type::<MeshMaterial3d<StandardMaterial>>()
        .register_type::<bevy::camera::primitives::Aabb>()
        .register_type::<bevy::mesh::skinning::SkinnedMesh>()
        .register_type::<bevy::animation::AnimationTarget>()
        .register_type::<AnimationPlayer>()
        .register_type::<bevy::gltf::GltfExtras>()
        .register_type::<bevy::gltf::GltfMeshExtras>()
        .register_type::<bevy::gltf::GltfMaterialExtras>()
        .register_type::<bevy::gltf::GltfSceneExtras>()
        .register_type::<bevy::gltf::GltfMeshName>()
        .register_type::<bevy::gltf::GltfMaterialName>()
        .add_systems(Startup, (graphics::setup, ui::setup))
        .add_systems(
            Update,
            (
                keyboard,
                ui::buttons,
                graphics::stream_world,
                graphics::sync_world,
                graphics::animate,
                ui::refresh,
                smoke,
            )
                .chain(),
        )
        .add_systems(Last, ui::frame_limit)
        .add_systems(FixedUpdate, simulate)
        .run();
}

fn simulate(mut sim: ResMut<Simulation>, controls: Res<Controls>, desktop: Res<Desktop>) {
    sim.0.paused = desktop.screen != Screen::Play;
    sim.0.step(controls.0, STEP);
}
fn report(sim: &mut Simulation, result: Result<(), String>) {
    if let Err(e) = result {
        sim.0.message = e
    }
}
fn save_game(sim: &mut Simulation, desktop: &Desktop) {
    match save::write(&desktop.save_path, &sim.0.state) {
        Ok(()) => sim.0.message = format!("Saved to {}", desktop.save_path.display()),
        Err(e) => sim.0.message = format!("Save failed: {e}"),
    }
}
fn load_game(sim: &mut Simulation, desktop: &mut Desktop) {
    match save::read(&desktop.save_path) {
        Ok(state) => {
            sim.0 = Game::from_state(state);
            desktop.screen(Screen::Play)
        }
        Err(e) => sim.0.message = format!("Load failed: {e}"),
    }
}
#[allow(clippy::too_many_arguments)]
fn keyboard(
    keys: Res<ButtonInput<KeyCode>>,
    mouse: Res<ButtonInput<MouseButton>>,
    motion: Res<AccumulatedMouseMotion>,
    scroll: Res<AccumulatedMouseScroll>,
    mut sim: ResMut<Simulation>,
    mut controls: ResMut<Controls>,
    mut desktop: ResMut<Desktop>,
    windows: Query<&Window, With<PrimaryWindow>>,
) {
    if keys.just_pressed(KeyCode::Escape) {
        let next = match desktop.screen {
            Screen::Play => Screen::Pause,
            Screen::Pause | Screen::Inventory | Screen::Settings => Screen::Play,
            _ => desktop.screen,
        };
        desktop.screen(next);
        controls.0 = Input::default();
    }
    if keys.just_pressed(KeyCode::F5) {
        save_game(&mut sim, &desktop)
    }
    if keys.just_pressed(KeyCode::F9) {
        load_game(&mut sim, &mut desktop)
    }
    if desktop.screen == Screen::Play && sim.0.dead() {
        desktop.screen(Screen::Death)
    }
    if (desktop.screen == Screen::Play || desktop.screen == Screen::Inventory)
        && keys.just_pressed(KeyCode::KeyE)
    {
        let next = if desktop.screen == Screen::Inventory {
            Screen::Play
        } else {
            Screen::Inventory
        };
        desktop.screen(next)
    }
    if keys.just_pressed(KeyCode::KeyQ)
        && [Screen::Play, Screen::Inventory].contains(&desktop.screen)
    {
        let result = sim.0.eat(Item::Fish);
        report(&mut sim, result)
    }
    if desktop.screen != Screen::Play {
        controls.0 = Input::default();
        return;
    }
    if keys.just_pressed(KeyCode::KeyT) {
        let result = sim.0.upgrade();
        report(&mut sim, result)
    }
    if keys.just_pressed(KeyCode::KeyB) {
        let result = sim.0.build_hut();
        report(&mut sim, result)
    }
    if keys.just_pressed(KeyCode::KeyF)
        && sim.0.state.player.at.distance(sim.0.state.furnace.at) < 4.0
    {
        let result = sim.0.feed();
        report(&mut sim, result)
    }
    if mouse.pressed(MouseButton::Right) {
        desktop.orbit -= motion.delta.x * 0.008
    }
    desktop.zoom = (desktop.zoom - scroll.delta.y * 1.5).clamp(10.0, 45.0);
    let focused = windows.single().is_ok_and(|w| w.focused);
    if !focused && !desktop.smoke {
        desktop.screen(Screen::Pause);
        controls.0 = Input::default();
        return;
    }
    let axis = |a: KeyCode, b: KeyCode| i32::from(keys.pressed(a)) - i32::from(keys.pressed(b));
    let x = (axis(KeyCode::KeyD, KeyCode::KeyA) + axis(KeyCode::ArrowRight, KeyCode::ArrowLeft))
        .clamp(-1, 1) as f64;
    let z = (axis(KeyCode::KeyS, KeyCode::KeyW) + axis(KeyCode::ArrowDown, KeyCode::ArrowUp))
        .clamp(-1, 1) as f64;
    let a = desktop.orbit as f64;
    controls.0 = Input {
        x: x * a.cos() + z * a.sin(),
        z: -x * a.sin() + z * a.cos(),
        sprint: keys.pressed(KeyCode::ShiftLeft) || keys.pressed(KeyCode::ShiftRight),
        gather: keys.pressed(KeyCode::KeyF)
            && sim.0.state.player.at.distance(sim.0.state.furnace.at) >= 4.0,
        attack: keys.pressed(KeyCode::Space) || mouse.pressed(MouseButton::Left),
    };
}

fn smoke(
    mut desktop: ResMut<Desktop>,
    time: Res<Time<Real>>,
    mut sim: ResMut<Simulation>,
    mut commands: Commands,
    mut exit: MessageWriter<AppExit>,
) {
    if !desktop.smoke {
        return;
    }
    desktop.smoke_time += time.delta_secs();
    let t = desktop.smoke_time;
    if desktop.smoke_stage == 0 && t > 5.0 {
        desktop.screen(Screen::Play);
        desktop.smoke_stage = 1;
        desktop.smoke_time = 0.0;
    } else if desktop.smoke_stage == 1 && t > 5.0 {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../captures");
        let _ = std::fs::create_dir_all(&root);
        commands
            .spawn(bevy::render::view::screenshot::Screenshot::primary_window())
            .observe(bevy::render::view::screenshot::save_to_disk(
                root.join("native-gameplay.png"),
            ));
        let path = root.join("smoke-save.json");
        let result = save::write(&path, &sim.0.state).and_then(|_| save::read(&path).map(|_| ()));
        report(&mut sim, result);
        desktop.smoke_stage = 2;
        desktop.smoke_time = 0.0;
    } else if desktop.smoke_stage == 2 && t > 2.0 {
        desktop.screen(Screen::Inventory);
        desktop.smoke_stage = 3;
        desktop.smoke_time = 0.0;
    } else if desktop.smoke_stage == 3 && t > 2.0 {
        let path =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../captures/native-inventory.png");
        commands
            .spawn(bevy::render::view::screenshot::Screenshot::primary_window())
            .observe(bevy::render::view::screenshot::save_to_disk(path));
        desktop.smoke_stage = 4;
        desktop.smoke_time = 0.0;
    } else if desktop.smoke_stage == 4 && t > 3.0 {
        info!(
            "NATIVE_SMOKE_COMPLETE elapsed={:.3}, seed={}",
            sim.0.state.elapsed, sim.0.state.seed
        );
        exit.write(AppExit::Success);
    }
}
