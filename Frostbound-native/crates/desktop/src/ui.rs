use crate::{Desktop, Screen, Simulation, load_game, report, save_game};
use bevy::prelude::*;
use frostbound_core::{Game, Mode, Resource as Item, rng::parse_seed};
use std::time::{Duration, Instant};

const INK: Color = Color::srgb(0.055, 0.12, 0.16);
const PAPER: Color = Color::srgb(0.94, 0.93, 0.86);
const MUTED: Color = Color::srgb(0.69, 0.79, 0.81);
const AMBER: Color = Color::srgb(0.88, 0.65, 0.36);
#[derive(Resource)]
pub(super) struct Type(Handle<Font>);
#[derive(Component)]
pub(super) struct Hud;
#[derive(Component)]
pub(super) struct Status;
#[derive(Component)]
pub(super) struct Overlay;
#[derive(Component, Clone, Copy)]
pub(super) enum Action {
    Begin,
    Load,
    Settings,
    Resume,
    Save,
    Title,
    NewSeed,
    Mode,
    Recover,
    Fish,
    Meat,
    Budget,
    Fps,
    Quit,
}
#[derive(Component)]
pub(super) struct ActionButton(Action);
#[derive(Resource, Default)]
pub(super) struct PanelState {
    revision: Option<u64>,
    focus: usize,
}
#[derive(Resource)]
pub(super) struct Fps {
    start: Instant,
    frames: u32,
    value: f64,
    last_frame: Instant,
}

pub fn setup(mut commands: Commands, assets: Res<AssetServer>) {
    let font = assets.load("fonts/Oxanium.ttf");
    commands.insert_resource(Type(font.clone()));
    commands.init_resource::<PanelState>();
    commands.insert_resource(Fps {
        start: Instant::now(),
        frames: 0,
        value: 0.0,
        last_frame: Instant::now(),
    });
    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: px(24),
                top: px(20),
                padding: UiRect::all(px(16)),
                max_width: percent(68),
                ..default()
            },
            BackgroundColor(INK),
            Hud,
        ))
        .with_child((
            Text::new("FROSTBOUND"),
            TextFont {
                font: font.clone(),
                font_size: 18.0,
                ..default()
            },
            TextColor(PAPER),
        ));
    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: px(24),
                bottom: px(20),
                padding: UiRect::all(px(14)),
                max_width: percent(85),
                ..default()
            },
            BackgroundColor(INK),
            Status,
        ))
        .with_child((
            Text::new("Preparing terrain"),
            TextFont {
                font,
                font_size: 16.0,
                ..default()
            },
            TextColor(PAPER),
        ));
}

pub fn buttons(
    mut interactions: Query<
        (
            &Interaction,
            &ActionButton,
            &mut BackgroundColor,
            &mut BorderColor,
        ),
        Changed<Interaction>,
    >,
    keys: Res<ButtonInput<KeyCode>>,
    mut sim: ResMut<Simulation>,
    mut desktop: ResMut<Desktop>,
    mut panel: ResMut<PanelState>,
    mut exit: MessageWriter<AppExit>,
    buttons: Query<&ActionButton>,
) {
    let mut selected = None;
    for (interaction, button, mut background, mut border) in &mut interactions {
        match interaction {
            Interaction::Pressed => selected = Some(button.0),
            Interaction::Hovered => {
                *background = BackgroundColor(Color::srgb(0.23, 0.34, 0.37));
                *border = BorderColor::all(AMBER)
            }
            Interaction::None => {
                *background = BackgroundColor(Color::srgb(0.12, 0.22, 0.27));
                *border = BorderColor::all(Color::srgb(0.39, 0.5, 0.53))
            }
        }
    }
    let available: Vec<_> = buttons.iter().map(|b| b.0).collect();
    if keys.just_pressed(KeyCode::Tab) && !available.is_empty() {
        panel.focus = (panel.focus + 1) % available.len();
        sim.0.message = format!(
            "Keyboard selection: {}. Enter activates; Tab selects next.",
            label(available[panel.focus], &sim)
        );
    }
    if keys.just_pressed(KeyCode::Enter) && !available.is_empty() {
        selected = Some(available[panel.focus.min(available.len() - 1)])
    }
    let Some(action) = selected else { return };
    match action {
        Action::Begin => desktop.screen(Screen::Play),
        Action::Load => load_game(&mut sim, &mut desktop),
        Action::Resume => desktop.screen(Screen::Play),
        Action::Settings => desktop.screen(Screen::Settings),
        Action::Save => save_game(&mut sim, &desktop),
        Action::Title => {
            save_game(&mut sim, &desktop);
            desktop.screen(Screen::Title)
        }
        Action::NewSeed => {
            let next = sim.0.state.seed.wrapping_add(1);
            desktop.seed = next.to_string();
            sim.0 = Game::new(next, desktop.mode);
            desktop.revision += 1;
        }
        Action::Mode => {
            desktop.mode = match desktop.mode {
                Mode::Easy => Mode::Normal,
                Mode::Normal => Mode::Hard,
                Mode::Hard => Mode::Easy,
            };
            let seed = parse_seed(&desktop.seed).unwrap_or(42);
            sim.0 = Game::new(seed, desktop.mode);
            desktop.revision += 1;
        }
        Action::Recover => {
            sim.0.recover();
            desktop.screen(Screen::Play)
        }
        Action::Fish => {
            let result = sim.0.eat(Item::Fish);
            report(&mut sim, result);
            desktop.revision += 1
        }
        Action::Meat => {
            let result = sim.0.eat(Item::Meat);
            report(&mut sim, result);
            desktop.revision += 1
        }
        Action::Budget => {
            sim.0.state.budget = !sim.0.state.budget;
            desktop.revision += 1;
        }
        Action::Fps => {
            sim.0.state.show_fps = !sim.0.state.show_fps;
            desktop.revision += 1;
        }
        Action::Quit => {
            exit.write(AppExit::Success);
        }
    }
}
fn label(action: Action, sim: &Simulation) -> String {
    match action {
        Action::Begin => "Enter expedition".into(),
        Action::Load => "Load native save / F9".into(),
        Action::Settings => "Settings".into(),
        Action::Resume => "Resume expedition / Esc".into(),
        Action::Save => "Save locally / F5".into(),
        Action::Title => "Save and return to title".into(),
        Action::NewSeed => "Next world seed".into(),
        Action::Mode => "Cycle starting preset".into(),
        Action::Recover => "Go back / lose half carried supplies".into(),
        Action::Fish => format!(
            "Eat fish / {} left / +2 hunger, +5 HP",
            sim.0.state.pack.get(Item::Fish)
        ),
        Action::Meat => format!(
            "Eat meat / {} left / +3 hunger, +5 HP",
            sim.0.state.pack.get(Item::Meat)
        ),
        Action::Budget => format!(
            "Budget Meal Mode: {} / 30 FPS cap",
            if sim.0.state.budget { "On" } else { "Off" }
        ),
        Action::Fps => format!(
            "Measured FPS display: {}",
            if sim.0.state.show_fps { "On" } else { "Off" }
        ),
        Action::Quit => "Quit desktop game".into(),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn refresh(
    mut commands: Commands,
    sim: Res<Simulation>,
    desktop: Res<Desktop>,
    font: Res<Type>,
    mut panel: ResMut<PanelState>,
    mut fps: ResMut<Fps>,
    mut text: Query<&mut Text>,
    hud: Query<&Children, With<Hud>>,
    status: Query<&Children, With<Status>>,
    overlays: Query<Entity, With<Overlay>>,
) {
    fps.frames += 1;
    let now = Instant::now();
    let duration = now.duration_since(fps.start).as_secs_f64();
    if duration >= 0.75 {
        fps.value = fps.frames as f64 / duration;
        fps.frames = 0;
        fps.start = now;
    }
    let state = &sim.0.state;
    let p = &state.player;
    let pack = Item::ALL
        .map(|r| format!("{} {}", r.name(), state.pack.get(r)))
        .join("   ");
    let measured = if state.show_fps {
        format!("  |  {:.0} FPS", fps.value)
    } else {
        String::new()
    };
    let warm = if sim.0.heated(p.at) {
        "Furnace protection"
    } else if sim.0.terrain.water(p.at) {
        "River / movement -90%"
    } else {
        "Exposed"
    };
    if let Ok(children) = hud.single() {
        for child in children {
            if let Ok(mut value) = text.get_mut(*child) {
                let next = format!(
                    "FROSTBOUND  /  NATIVE PREVIEW  /  Seed {}{}\n{}\nHP {:.0}/{}   Warmth {:.0}%   Hunger {:.0}/20  |  {}\nFurnace Lv {}   Fuel {:.0}s   Range {:.0}m  |  {}",
                    state.seed,
                    measured,
                    pack,
                    p.hp,
                    if p.hunger < 5.0 { 50 } else { 100 },
                    p.warmth,
                    p.hunger,
                    warm,
                    state.furnace.level,
                    state.furnace.wood_fuel + state.furnace.charcoal_fuel,
                    state.furnace.radius(),
                    if state.storm { "Snowstorm" } else { "Sunny" }
                );
                if value.0 != next {
                    value.0 = next;
                }
            }
        }
    }
    if let Ok(children) = status.single() {
        for child in children {
            if let Ok(mut value) = text.get_mut(*child) {
                let next = format!(
                    "{}\nWASD move   Shift sprint   F gather/fuel   T upgrade   B hut   E inventory   Space punch   Esc pause",
                    sim.0.message
                );
                if value.0 != next {
                    value.0 = next;
                }
            }
        }
    }
    if panel.revision == Some(desktop.revision) {
        return;
    }
    panel.revision = Some(desktop.revision);
    panel.focus = 0;
    for entity in &overlays {
        commands.entity(entity).despawn();
    }
    if desktop.screen == Screen::Play {
        return;
    }
    let(title,description,actions)=match desktop.screen{
  Screen::Title=>("Frostbound",format!("Native desktop preview\nSeed {} / {:?} starting preset\n\nThis is the first Rust migration milestone. Villages, workers, trading and browser-save import are still pending.\n\nEnter continues this world. Next seed and starting preset create a fresh native world. Use --seed \"your text\" when launching to choose a text seed.",desktop.seed,desktop.mode),vec![Action::Begin,Action::Load,Action::NewSeed,Action::Mode,Action::Settings,Action::Quit]),
  Screen::Pause=>("Expedition paused","Fire, hunger and encounters wait while this menu is open.\n\nMouse: right-drag to orbit, wheel to zoom.\nTab selects a button; Enter activates it.\nF5 saves; F9 restores the native save.".into(),vec![Action::Resume,Action::Save,Action::Settings,Action::Title]),
  Screen::Inventory=>("Field supplies",format!("{}\n\nHP {:.0} / Hunger {:.0} of 20\nFood restores hunger immediately and heals 5 HP.\nShared cooldown: {:.1}s of unpaused gameplay.\nResume to advance it. Eating at full stats spends a portion.",pack,p.hp,p.hunger,p.food_cooldown),vec![Action::Fish,Action::Meat,Action::Resume]),
  Screen::Settings=>("Expedition settings","Budget Meal Mode caps the native update/render loop at 30 FPS. The simulation uses a separate 60 Hz fixed clock.\n\nStarting presets apply to fresh worlds. This preview ports their starting HP, supplies and fuel, and gentler Easy hunger. Full difficulty parity is pending.\n\nPreferences are included in native saves.".into(),vec![Action::Budget,Action::Fps,Action::Save,Action::Title,Action::Resume]),
  Screen::Death=>("The cold country claimed you.","Your native world remains. Recover at the furnace with half your carried supplies, or save and return to title.".into(),vec![Action::Recover,Action::Title]),
  Screen::Play=>unreachable!(),
 };
    commands
        .spawn((
            Overlay,
            Node {
                position_type: PositionType::Absolute,
                width: percent(100),
                height: percent(100),
                align_items: AlignItems::Center,
                justify_content: JustifyContent::Center,
                ..default()
            },
            BackgroundColor(Color::srgba(0.025, 0.06, 0.08, 0.72)),
        ))
        .with_children(|root| {
            root.spawn((
                Node {
                    width: px(670),
                    max_width: percent(92),
                    max_height: percent(90),
                    padding: UiRect::all(px(26)),
                    flex_direction: FlexDirection::Column,
                    row_gap: px(12),
                    overflow: Overflow::scroll_y(),
                    ..default()
                },
                BackgroundColor(INK),
            ))
            .with_children(|panel| {
                panel.spawn((
                    Text::new(title),
                    TextFont {
                        font: font.0.clone(),
                        font_size: 32.0,
                        ..default()
                    },
                    TextColor(AMBER),
                ));
                panel.spawn((
                    Text::new(description),
                    TextFont {
                        font: font.0.clone(),
                        font_size: 16.0,
                        ..default()
                    },
                    TextColor(PAPER),
                ));
                for action in actions {
                    panel
                        .spawn((
                            Button,
                            ActionButton(action),
                            Node {
                                min_height: px(44),
                                padding: UiRect::axes(px(14), px(10)),
                                border: UiRect::all(px(1)),
                                align_items: AlignItems::Center,
                                ..default()
                            },
                            BackgroundColor(Color::srgb(0.12, 0.22, 0.27)),
                            BorderColor::all(Color::srgb(0.39, 0.5, 0.53)),
                        ))
                        .with_child((
                            Text::new(label(action, &sim)),
                            TextFont {
                                font: font.0.clone(),
                                font_size: 16.0,
                                ..default()
                            },
                            TextColor(PAPER),
                        ));
                }
                panel.spawn((
                    Text::new("Tab: select next button  /  Enter: activate  /  Esc: resume"),
                    TextFont {
                        font: font.0.clone(),
                        font_size: 13.0,
                        ..default()
                    },
                    TextColor(MUTED),
                ));
            });
        });
}

pub fn frame_limit(sim: Res<Simulation>, mut fps: ResMut<Fps>) {
    if sim.0.state.budget {
        let remaining =
            Duration::from_secs_f64(1.0 / 30.0).saturating_sub(fps.last_frame.elapsed());
        if !remaining.is_zero() {
            std::thread::sleep(remaining)
        }
    }
    fps.last_frame = Instant::now();
}
