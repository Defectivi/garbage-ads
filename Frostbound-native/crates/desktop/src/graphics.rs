use crate::{Controls, Desktop, Screen, Simulation};
use bevy::{
    asset::RenderAssetUsages, mesh::Indices, prelude::*,
    render::render_resource::PrimitiveTopology, scene::SceneInstanceReady,
};
use frostbound_core::{
    Point, Resource as Item,
    world::{CHUNK, Source},
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Component)]
pub(super) struct Survivor;
#[derive(Component)]
pub(super) struct Follow;
#[derive(Component)]
pub(super) struct Camp;
#[derive(Component)]
pub(super) struct BearVisual(String);
#[derive(Component)]
pub(super) struct SourceVisual(Source);
#[derive(Component)]
pub(super) struct ChunkGround(Handle<Mesh>);
#[derive(Component)]
pub(super) struct HutVisual;
#[derive(Component)]
pub(super) struct Flames;
#[derive(Component)]
pub(super) struct FireGlow;
#[derive(Component)]
pub(super) struct HeatRing;
#[derive(Component)]
pub(super) struct Animated {
    graph: Handle<AnimationGraph>,
    nodes: Vec<AnimationNodeIndex>,
    bear: bool,
}
#[derive(Component)]
pub(super) struct MotionClip {
    nodes: Vec<AnimationNodeIndex>,
    bear: bool,
    current: usize,
}
#[derive(Resource, Default)]
pub struct Streaming {
    chunks: BTreeMap<(i32, i32), Entity>,
    seed: Option<u32>,
    huts: usize,
    bears: BTreeSet<String>,
}
#[derive(Resource)]
pub struct Art {
    cube: Handle<Mesh>,
    trunk: Handle<Mesh>,
    crown: Handle<Mesh>,
    rock: Handle<Mesh>,
    snow: Handle<StandardMaterial>,
    wood: Handle<StandardMaterial>,
    slate: Handle<StandardMaterial>,
    fire: Handle<StandardMaterial>,
    water: Handle<StandardMaterial>,
    amber: Handle<StandardMaterial>,
    metal: Handle<StandardMaterial>,
}

pub fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    assets: Res<AssetServer>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
) {
    let matte = |color| StandardMaterial {
        base_color: color,
        perceptual_roughness: 0.9,
        ..default()
    };
    let art = Art {
        cube: meshes.add(Cuboid::new(1.0, 1.0, 1.0)),
        trunk: meshes.add(Cylinder::new(0.22, 2.0)),
        crown: meshes.add(Cone::new(1.7, 2.8)),
        rock: meshes.add(Sphere::new(0.65).mesh().ico(1).unwrap()),
        snow: materials.add(matte(Color::srgb_u8(224, 234, 238))),
        wood: materials.add(matte(Color::srgb_u8(125, 86, 52))),
        slate: materials.add(matte(Color::srgb_u8(50, 75, 85))),
        metal: materials.add(matte(Color::srgb_u8(125, 154, 165))),
        fire: materials.add(StandardMaterial {
            base_color: Color::srgb_u8(255, 169, 67),
            emissive: LinearRgba::rgb(6.0, 1.5, 0.1),
            ..default()
        }),
        water: materials.add(StandardMaterial {
            base_color: Color::srgb_u8(48, 111, 143),
            perceptual_roughness: 0.3,
            ..default()
        }),
        amber: materials.add(StandardMaterial {
            base_color: Color::srgba(0.95, 0.65, 0.25, 0.24),
            alpha_mode: AlphaMode::Blend,
            unlit: true,
            ..default()
        }),
    };
    commands.spawn((
        Camera3d::default(),
        bevy::core_pipeline::tonemapping::Tonemapping::AcesFitted,
        // wgpu 26's DX12 indirect-batch validation asserted on this adapter.
        bevy::render::view::NoIndirectDrawing,
        Transform::from_xyz(16.0, 23.0, 25.0).looking_at(Vec3::ZERO, Vec3::Y),
        Follow,
    ));
    commands.spawn((
        DirectionalLight {
            illuminance: 11000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_rotation(Quat::from_euler(EulerRot::XYZ, -0.9, -0.5, 0.0)),
    ));
    let (graph, nodes) = AnimationGraph::from_clips(
        (0..16)
            .map(|i| assets.load(GltfAssetLabel::Animation(i).from_asset("models/wayfarer.glb"))),
    );
    commands
        .spawn((
            Survivor,
            Transform::from_xyz(0.0, 0.8, 4.0),
            SceneRoot(assets.load(GltfAssetLabel::Scene(0).from_asset("models/wayfarer.glb"))),
            Animated {
                graph: graphs.add(graph),
                nodes,
                bear: false,
            },
        ))
        .observe(animation_ready);
    commands
        .spawn((Camp, Transform::default(), Visibility::default()))
        .with_children(|p| {
            p.spawn((
                Mesh3d(art.trunk.clone()),
                MeshMaterial3d(art.slate.clone()),
                Transform::from_xyz(0.0, 2.2, 0.0).with_scale(Vec3::new(5.0, 2.2, 5.0)),
            ));
            p.spawn((
                Mesh3d(art.trunk.clone()),
                MeshMaterial3d(art.metal.clone()),
                Transform::from_xyz(0.0, 5.0, 0.0).with_scale(Vec3::new(1.5, 1.6, 1.5)),
            ));
            p.spawn((
                Mesh3d(art.rock.clone()),
                MeshMaterial3d(art.fire.clone()),
                Transform::from_xyz(0.0, 1.3, 0.9).with_scale(Vec3::new(0.8, 1.5, 0.7)),
                Flames,
            ));
            p.spawn((
                FireGlow,
                PointLight {
                    color: Color::srgb_u8(255, 167, 70),
                    intensity: 120_000.0,
                    range: 24.0,
                    ..default()
                },
                Transform::from_xyz(0.0, 2.0, 0.0),
            ));
        });
    commands.spawn((
        Mesh3d(meshes.add(Annulus::new(11.85, 12.05).mesh().resolution(96))),
        MeshMaterial3d(art.amber.clone()),
        Transform::from_xyz(0.0, 0.87, 0.0)
            .with_rotation(Quat::from_rotation_x(-std::f32::consts::FRAC_PI_2)),
        HeatRing,
    ));
    commands.insert_resource(art);
    commands.init_resource::<Streaming>();
}
fn animation_ready(
    event: On<SceneInstanceReady>,
    mut commands: Commands,
    children: Query<&Children>,
    roots: Query<&Animated>,
    mut players: Query<&mut AnimationPlayer>,
) {
    if let Ok(root) = roots.get(event.entity) {
        for child in children.iter_descendants(event.entity) {
            if let Ok(mut player) = players.get_mut(child) {
                player.play(root.nodes[0]).repeat();
                commands.entity(child).insert((
                    AnimationGraphHandle(root.graph.clone()),
                    MotionClip {
                        nodes: root.nodes.clone(),
                        bear: root.bear,
                        current: 0,
                    },
                ));
            }
        }
    }
}

fn terrain_mesh(sim: &Simulation, cx: i32, cz: i32) -> Mesh {
    let mut vertices = vec![];
    let mut colors = vec![];
    let mut indices = vec![];
    for z in 0..=16 {
        for x in 0..=16 {
            let p = Point {
                x: cx as f64 * CHUNK + x as f64 * 2.0,
                z: cz as f64 * CHUNK + z as f64 * 2.0,
            };
            let h = sim.0.terrain.height(p);
            vertices.push([p.x as f32, h as f32, p.z as f32]);
            let tint = (1.0 - h.max(0.0) as f32 * 0.005).max(0.5);
            colors.push([0.82 * tint, 0.89 * tint, 0.92 * tint, 1.0]);
        }
    }
    for z in 0..16u32 {
        for x in 0..16u32 {
            let a = z * 17 + x;
            indices.extend([a, a + 17, a + 1, a + 1, a + 17, a + 18])
        }
    }
    let mut mesh = Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, vertices)
    .with_inserted_attribute(Mesh::ATTRIBUTE_COLOR, colors)
    .with_inserted_indices(Indices::U32(indices));
    mesh.compute_smooth_normals();
    mesh
}
pub fn stream_world(
    mut commands: Commands,
    sim: Res<Simulation>,
    mut streaming: ResMut<Streaming>,
    art: Res<Art>,
    mut meshes: ResMut<Assets<Mesh>>,
    ground: Query<&ChunkGround>,
) {
    if streaming.seed != Some(sim.0.state.seed) {
        for e in streaming.chunks.values() {
            if let Ok(g) = ground.get(*e) {
                meshes.remove(g.0.id());
            }
            commands.entity(*e).despawn();
        }
        streaming.chunks.clear();
        streaming.seed = Some(sim.0.state.seed);
    }
    let p = sim.0.state.player.at;
    let cx = (p.x / CHUNK).floor() as i32;
    let cz = (p.z / CHUNK).floor() as i32;
    let old: Vec<_> = streaming
        .chunks
        .keys()
        .copied()
        .filter(|(x, z)| (x - cx).abs() > 2 || (z - cz).abs() > 2)
        .collect();
    for key in old {
        let e = streaming.chunks.remove(&key).unwrap();
        if let Ok(g) = ground.get(e) {
            meshes.remove(g.0.id());
        }
        commands.entity(e).despawn();
    }
    let mut coords: Vec<_> = (-2..=2)
        .flat_map(|x| (-2..=2).map(move |z| (cx + x, cz + z)))
        .collect();
    coords.sort_by_key(|(x, z)| (x - cx).pow(2) + (z - cz).pow(2));
    // One terrain chunk per rendered frame; simulation never waits on a complete region.
    let Some((x, z)) = coords
        .into_iter()
        .find(|c| !streaming.chunks.contains_key(c))
    else {
        return;
    };
    let mesh = meshes.add(terrain_mesh(&sim, x, z));
    let entity = commands
        .spawn((
            Mesh3d(mesh.clone()),
            MeshMaterial3d(art.snow.clone()),
            Transform::default(),
            ChunkGround(mesh),
        ))
        .with_children(|parent| {
            for source in sim.0.terrain.sources(x, z) {
                if sim.0.remaining(&source) == 0 {
                    continue;
                }
                let p = source.at;
                let y = sim.0.terrain.height(p) as f32;
                parent
                    .spawn((
                        Transform::from_xyz(p.x as f32, y, p.z as f32),
                        Visibility::default(),
                        SourceVisual(source.clone()),
                    ))
                    .with_children(|item| {
                        if source.tree {
                            item.spawn((
                                Mesh3d(art.trunk.clone()),
                                MeshMaterial3d(art.wood.clone()),
                                Transform::from_xyz(0.0, 1.0, 0.0),
                            ));
                            for i in 0..3 {
                                let scale = 1.0 - i as f32 * 0.22;
                                item.spawn((
                                    Mesh3d(art.crown.clone()),
                                    MeshMaterial3d(art.snow.clone()),
                                    Transform::from_xyz(0.0, 2.0 + i as f32 * 1.25, 0.0)
                                        .with_scale(Vec3::splat(scale)),
                                ));
                            }
                        } else {
                            let handle = if source.resource == Item::Wood {
                                art.wood.clone()
                            } else if source.resource == Item::Metal {
                                art.metal.clone()
                            } else {
                                art.slate.clone()
                            };
                            item.spawn((
                                Mesh3d(if source.resource == Item::Wood {
                                    art.trunk.clone()
                                } else {
                                    art.rock.clone()
                                }),
                                MeshMaterial3d(handle),
                                Transform::from_xyz(0.0, 0.45, 0.0).with_rotation(
                                    if source.resource == Item::Wood {
                                        Quat::from_rotation_z(1.4)
                                    } else {
                                        Quat::IDENTITY
                                    },
                                ),
                            ));
                        }
                    });
            }
            for dx in (0..32).step_by(2) {
                let wx = x as f64 * CHUNK + dx as f64;
                for (c, w, _) in sim.0.terrain.channels(wx, z as f64 * CHUNK + 16.0) {
                    let lo = (c - w).max(z as f64 * CHUNK);
                    let hi = (c + w).min((z + 1) as f64 * CHUNK);
                    if hi > lo {
                        parent.spawn((
                            Mesh3d(art.cube.clone()),
                            MeshMaterial3d(art.water.clone()),
                            Transform::from_xyz(wx as f32 + 1.0, 0.05, ((lo + hi) * 0.5) as f32)
                                .with_scale(Vec3::new(2.0, 0.08, (hi - lo) as f32)),
                        ));
                    }
                }
            }
            if x % 2 == 0 {
                let wx = x as f64 * CHUNK;
                for (c, w, _) in sim.0.terrain.channels(wx, z as f64 * CHUNK + 16.0) {
                    if c >= z as f64 * CHUNK
                        && c < (z + 1) as f64 * CHUNK
                        && sim.0.terrain.bridge(Point { x: wx, z: c }).is_some()
                    {
                        parent.spawn((
                            Mesh3d(art.cube.clone()),
                            MeshMaterial3d(art.wood.clone()),
                            Transform::from_xyz(wx as f32, 0.45, c as f32).with_scale(Vec3::new(
                                4.7,
                                0.4,
                                (w * 2.0 + 3.0) as f32,
                            )),
                        ));
                    }
                }
            }
        })
        .id();
    streaming.chunks.insert((x, z), entity);
}

// Bevy supplies these parameters; ParamSet separates mutable transform queries.
#[allow(clippy::too_many_arguments, clippy::type_complexity)]
pub fn sync_world(
    mut commands: Commands,
    sim: Res<Simulation>,
    desktop: Res<Desktop>,
    art: Res<Art>,
    assets: Res<AssetServer>,
    mut graphs: ResMut<Assets<AnimationGraph>>,
    mut streaming: ResMut<Streaming>,
    mut sets: ParamSet<(
        Query<&mut Transform, With<Survivor>>,
        Query<&mut Transform, With<Follow>>,
        Query<(&mut Transform, &mut Visibility), With<HeatRing>>,
        Query<&mut Transform, With<Camp>>,
        Query<(Entity, &BearVisual, &mut Transform)>,
    )>,
    mut sources: Query<(&SourceVisual, &mut Visibility), Without<HeatRing>>,
    huts: Query<Entity, With<HutVisual>>,
) {
    let p = sim.0.state.player.at;
    let y = sim.0.terrain.height(p) as f32;
    for mut t in &mut sets.p0() {
        t.translation = Vec3::new(p.x as f32, y, p.z as f32);
        t.rotation = Quat::from_rotation_y(sim.0.state.player.heading as f32)
    }
    let target = Vec3::new(p.x as f32, y + 1.3, p.z as f32);
    for mut t in &mut sets.p1() {
        let off = Vec3::new(
            desktop.orbit.sin() * desktop.zoom,
            desktop.zoom * 0.92,
            desktop.orbit.cos() * desktop.zoom,
        );
        *t = Transform::from_translation(target + off).looking_at(target, Vec3::Y);
    }
    for (mut t, mut v) in &mut sets.p2() {
        let r = sim.0.state.furnace.radius() as f32 / 12.0;
        t.scale = Vec3::splat(r);
        *v = if sim.0.state.furnace.active() {
            Visibility::Visible
        } else {
            Visibility::Hidden
        }
    }
    for mut t in &mut sets.p3() {
        t.translation.y = sim.0.terrain.height(sim.0.state.furnace.at) as f32;
        t.scale = Vec3::splat(1.0 + (sim.0.state.furnace.level / 5) as f32 * 0.12)
    }
    for (s, mut v) in &mut sources {
        *v = if sim.0.remaining(&s.0) > 0 {
            Visibility::Inherited
        } else {
            Visibility::Hidden
        }
    }
    if streaming.huts != sim.0.state.huts.len() {
        for e in &huts {
            commands.entity(e).despawn();
        }
        for h in &sim.0.state.huts {
            let y = sim.0.terrain.height(h.at) as f32;
            commands
                .spawn((
                    HutVisual,
                    Transform::from_xyz(h.at.x as f32, y, h.at.z as f32),
                    Visibility::default(),
                ))
                .with_children(|p| {
                    p.spawn((
                        Mesh3d(art.cube.clone()),
                        MeshMaterial3d(art.wood.clone()),
                        Transform::from_xyz(0.0, 1.3, 0.0).with_scale(Vec3::new(3.5, 2.6, 3.2)),
                    ));
                    p.spawn((
                        Mesh3d(art.crown.clone()),
                        MeshMaterial3d(art.snow.clone()),
                        Transform::from_xyz(0.0, 3.0, 0.0).with_scale(Vec3::new(1.6, 0.5, 1.6)),
                    ));
                    p.spawn((
                        Mesh3d(art.cube.clone()),
                        MeshMaterial3d(art.slate.clone()),
                        Transform::from_xyz(0.0, 0.8, 1.63).with_scale(Vec3::new(0.8, 1.6, 0.1)),
                    ));
                });
        }
        streaming.huts = sim.0.state.huts.len();
    }
    for (e, id, mut t) in &mut sets.p4() {
        if let Some(b) = sim
            .0
            .state
            .bears
            .iter()
            .find(|b| b.id == id.0 && b.hp > 0.0)
        {
            t.translation = Vec3::new(
                b.at.x as f32,
                sim.0.terrain.height(b.at) as f32,
                b.at.z as f32,
            );
            t.rotation = Quat::from_rotation_y((p.x - b.at.x).atan2(p.z - b.at.z) as f32);
        } else {
            streaming.bears.remove(&id.0);
            commands.entity(e).despawn();
        }
    }
    for b in &sim.0.state.bears {
        if b.hp <= 0.0 || b.at.distance(p) > 70.0 || streaming.bears.contains(&b.id) {
            continue;
        }
        let (graph, nodes) = AnimationGraph::from_clips((0..3).map(|i| {
            assets.load(GltfAssetLabel::Animation(i).from_asset("models/bear-ivory.glb"))
        }));
        commands
            .spawn((
                BearVisual(b.id.clone()),
                Transform::from_xyz(b.at.x as f32, 0.0, b.at.z as f32),
                SceneRoot(
                    assets.load(GltfAssetLabel::Scene(0).from_asset("models/bear-ivory.glb")),
                ),
                Animated {
                    graph: graphs.add(graph),
                    nodes,
                    bear: true,
                },
            ))
            .observe(animation_ready);
        streaming.bears.insert(b.id.clone());
    }
}
#[allow(clippy::too_many_arguments)]
pub fn animate(
    sim: Res<Simulation>,
    controls: Res<Controls>,
    desktop: Res<Desktop>,
    mut players: Query<(&mut AnimationPlayer, &mut MotionClip)>,
    mut flames: Query<(&mut Transform, &mut Visibility), With<Flames>>,
    mut virtual_time: ResMut<Time<Virtual>>,
    mut lights: Query<&mut DirectionalLight>,
    mut glow: Query<&mut PointLight, With<FireGlow>>,
) {
    let moving = controls.0.x.hypot(controls.0.z) > 0.01;
    let active = desktop.screen == Screen::Play;
    if active {
        virtual_time.unpause()
    } else {
        virtual_time.pause()
    }
    for (mut player, mut clip) in &mut players {
        let index = if clip.bear {
            if active { 1 } else { 0 }
        } else if sim.0.dead() {
            15
        } else if active && sim.0.state.elapsed - sim.0.attack_time < 0.45 {
            9
        } else if active && sim.0.gathering.is_some() {
            6
        } else if active && moving {
            if controls.0.sprint { 2 } else { 1 }
        } else {
            0
        };
        if index != clip.current && index < clip.nodes.len() {
            player.stop_all();
            player.play(clip.nodes[index]).repeat();
            clip.current = index;
        }
    }
    for (mut t, mut v) in &mut flames {
        *v = if sim.0.state.furnace.active() {
            Visibility::Inherited
        } else {
            Visibility::Hidden
        };
        t.scale.y = 1.4 + (sim.0.state.elapsed as f32 * 8.0).sin() * 0.2;
    }
    for mut light in &mut glow {
        light.intensity = if sim.0.state.furnace.active() {
            120_000.0
        } else {
            0.0
        };
    }
    for mut light in &mut lights {
        light.illuminance = if sim.0.state.storm { 6500.0 } else { 11000.0 };
    }
}
