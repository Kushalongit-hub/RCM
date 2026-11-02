# Eight-car asset notes

## Pipeline and reconstruction scope

This project uses Three.js r186, JavaScript ES modules, MeshStandardMaterial/PBR, ACES tone mapping, and a custom server-authoritative arcade driving model. Coordinates are metres, +Y up, +Z forward, +X vehicle right; the vehicle origin is on the ground at the wheelbase centre. There was no GLB import or car-selection system before this change: the old car was assembled directly in `race3d.js`.

Blender is not installed. The editable source is the reproducible native Three.js modelling pipeline in `public/vehicle-meshes.js`, with dimensions and handling in `public/vehicle-catalog.js`. Gameplay instantiates these native meshes directly. `npm run assets:build` uses the installed Three.js GLTFExporter to produce eight independent, self-contained GLBs. `public/vehicles/manifest.json` records actual triangle counts and file sizes. No new package is required.

These are stylized procedural reconstructions from a single front three-quarter image per car. They preserve the main category, silhouette, red/white/graphite regions, wing type, glazing, wheel placement and visible identifiers. They are simpler and more angular than the supplied artwork. Precise physical dimensions cannot be recovered from these perspectives; the lengths, widths and wheelbases below are chosen game dimensions, not measurements of an actual vehicle. Rear surfaces, underbodies, exhausts, taillamps, unseen suspension attachments, interior details and physics are inferred. They are not exact 1:1 reconstructions.

## Reference assignment and visible specification

The latest Downloads attachments map as follows; preserved copies are in `public/references/` and are shown beside the corresponding live model in `/garage`. The prior clipboard images show the same categories in reverse order and are not additional cars.

| ID / asset | Supplied Downloads file | Visible reference features / modelling decisions | Game length × width / wheelbase | Triangles |
| --- | --- | --- | --- | --- |
| 01 `formula.glb` / Formula 27 | `b5172e14-c4e9-40d4-b773-9de09f842afa.png` | Long tapered low white nose, red centre stripe, black 27; exposed dark wishbones and wheels; broad multi-element black/red front wing with white slash; black recessed open cockpit and halo; white/red sidepods with black intake mouths; high airbox/camera and tall black rear wing with red endplates. Rear tyres are larger and wider-looking than the fronts. | 6.3 × 3.16 m / 3.51 m | 4,517 |
| 02 `endurance.glb` / Endurance 27 | `efad956a-3bfd-4610-a59e-a9451293be43.png` | Low central nose numbered 27 between taller enclosed front fenders, stacked endurance LED lights, narrow enclosed canopy, red roof scoop and antenna, hollow-looking side channels, large high wing, white/red angular fender paint. The canopy, shark-fin rear and diffuser are coherent approximations. | 5.9 × 2.7 m / 3.40 m | 5,068 |
| 03 `drift.glb` / Sideways 34 | `aa76d7f3-7e43-48da-93d2-9cdfebe486f8.png` | Taller front-engine coupe glasshouse, long dark bonnet with angular accents, white riveted bolt-on arch lips, red side slashes, door 34, deep dark rims, side skirts, aggressive grille/bumper and high rear wing. Interior seats/harnesses are simplified; opaque dark glass replaces the reference's more transparent windshield. | 5.6 × 2.66 m / 3.24 m | 6,289 |
| 04 `gt3.glb` / Apex 27 | `d82b82b4-02dc-4b6d-9b6d-2294c34d612d.png` | Lower production-coupe roofline, broad swept headlamps and front shoulders, large central intake split by white bumper bridges, bonnet vents, nose/door 27, flared arches, wing mirrors and high rear wing. Front bumper/vent geometry is deliberately distinct from the drift grille. | 5.8 × 2.7 m / 3.37 m | 5,780 |
| 05 `stock.glb` / Stock 42 | `41359513-c568-44e1-95d3-483d7e86f204.png` | Broad boxier body, long bonnet, stock-car glasshouse, roof and door 42, black window net, windshield braces, red/white centre stripe, inset grille and low rear spoiler. Squared shoulders and taller roof distinguish it from GT3. | 5.8 × 2.64 m / 3.38 m | 6,491 |
| 06 `wedge.glb` / Vektor | `8469e4be-71de-43e2-aefa-3e1f3cac8e88.png` | Cab-forward low wedge, sharply pointed hood, wide swept lamps, two-strip LED signatures, diagonal red front intake blades, dark side intakes, broad faceted rear haunches and mid-height wing. Broad low roof and front cabin position are unique to this model. | 5.7 × 2.68 m / 3.32 m | 5,735 |
| 07 `hyper.glb` / Stratos | `77e03a18-0259-42b1-b1c8-d22525ae72eb.png` | Central narrow canopy, pronounced fender shoulders, stacked/slashed lights, deep side airflow regions, roof intake, tall wing and flying rear buttresses. Narrow central nose keel and narrower glasshouse distinguish it from Vektor. | 5.9 × 2.74 m / 3.42 m | 5,788 |
| 08 `tourer.glb` / Grand Tourer | `1b805703-6281-492c-81af-af27d475bf84.png` | Rearward wider cabin behind longer dark bonnet, central red stripe bordered by white, swept angular headlamps, large red-edged side intake, broad GT shoulders, lower rear wing and split front ducts. The engine location is inferred from the front-engine category requested, not proven by the image. | 5.7 × 2.68 m / 3.29 m | 5,735 |

Across all eight: faceted 16-segment bevel-profile tyres, dark multi-spoke rims, red rim rings/centre locks, white/red mirrors, matte charcoal aero, darker faceted glass. Body panels, arches, wings, lips, vents, stripe regions and numbers are actual mesh geometry. Shading is flat with restrained per-face vertex-colour variation. There are no projected reference images, sprite cars, painted image cards or external texture/font dependencies. Material-only assets intentionally do not need UV unwraps. Number outlines are approximate angular glyphs.

## Rig, colliders and animation

Each asset contains `VehicleRoot_<id>`, `VisualBody`, four named `FrontLeft/FrontRight/RearLeft/RearRightWheelPivot` groups containing independently spinning `*WheelMesh` groups, `CollisionGeometry`, `CenterOfMassReference`, `CameraAnchor`, and `EffectsAnchors`. The body and each wheel are separate from one another. Components are merged by material within the body or an individual wheel to keep draw calls low; edit the source construction functions and regenerate to change individual panels.

Front pivots steer around local Y. Wheel meshes roll around local X at signed forward speed / tyre radius, including reverse; rear pivots remain straight. Ground slope and steering load tilt the visual body. Cached geometry/materials are shared, while each car receives its own transform hierarchy. Unit normals, finite positions, bounds, consistent scale, independent rigs and GLB re-imports are checked by `test/vehicles.test.js`.

`CollisionGeometry` is a named native collider descriptor exported in GLB node extras, with an oriented-box shape, centre and half extents. It is independent of the display mesh. The server uses those same dimensions from the catalog (half width = width × 0.43, half length = length × 0.44), a vertical contact threshold, and four-axis SAT collision resolution. Mass weights collision displacement/impulse. The visual body can overhang the conservative collider at wings and small aero details.

The existing engine is arcade physics: it does not simulate independent spring/damper suspension or tyre contact patches. Centre-of-mass height informs visual roll; class mass informs braking/collision response. Other class tuning includes acceleration, top speed, steering response, normal lateral grip and drift grip. These are editable catalog values. The existing drift, brake/reverse, ERS, LAN protocol and maximum four human views remain available. LODs were not added: each asset is approximately 4.5–6.5k triangles, with per-material mesh batching; no actual low-end-device profiling was performed.

## Selection and gameplay integration

`server.js` stores a validated `vehicleId` on each player and carries it into race snapshots. `vehicle` messages only change the sending player's car while in the lobby; unknown IDs are rejected, mid-race changes are rejected, and invalid initial IDs fall back to Formula. A returning lobby retains each connected player's choice. Bots cycle through the catalog. Their `bot`/`human` flags and player colours still determine takeover, stable split-screen ordering and player identification.

Host/keyboard: choose **Your car** in the lobby before or after joining. Phone: choose **Your car** before joining, or **Wheel & car setup → Car (lobby only)** afterwards. The choice is locked during races. The Formula-shaped phone controller and sideways fallback remain unchanged in their purpose and controls.

## Verification and visual review

- `npm run assets:build`: eight independent GLBs generated locally; all re-import with Three.js GLTFLoader.
- `npm test`: 15 checks pass, including finite/unit-normal geometry, bounds, independent wheel rigs, steering/spin, all eight cars accelerating/braking, all eight AI cars finishing three laps within 200 simulated seconds, mass/length-aware contact, lobby switching, unknown IDs, race-time selection locking, and existing LAN/auth/gyro/HTTPS behavior.
- Browser: all eight selections spawned in the actual race renderer; individual captures and HUD evidence are in `vehicle-renders/race-<id>.png` and `spawn-checks.json`.
- Browser: four distinct human cars rendered simultaneously in four equal viewports; keyboard driving reached 136 km/h in the Grand Tourer. `../preview-eight-cars-racing.png` records the test. Browser warning/error log was empty for that run.
- Browser: phone selection changed from Stock to Stratos and propagated to the shared lobby; sideways landscape layout and car setup were checked in a 360×740 portrait viewport. Actual physical phone gyro/multi-touch behavior was not retested as part of this asset task.
- Formula benchmark was rendered before the seven other bodies, then revised for tyre size, wheel rim/bevel, camera angle, lighting and number shape. The drift/GT3 fronts were revised after comparison; front supercar duct placement was fixed after front-view inspection.
- `vehicle-renders/<id>-three-quarter.png`, `-front.png`, `-side.png`, `-rear.png`, `-top.png`: 40 saved reference/model comparison screenshots. `contact-<view>.png`: five contact sheets. `../preview-eight-cars.png`: final three-quarter contact sheet.

Reproduce review at `http://localhost:3000/garage`: select a vehicle, choose each of the five views, and inspect the supplied image beside its mesh. **Contact sheet** renders all eight from the selected view; changing the view updates it. **Animate wheels** demonstrates spin and steering in the single-car view. The screen comparisons remain the evidence of the current visual approximation, rather than export success alone.

Remaining visible differences: fewer and larger body facets, simpler roof curvature and glazing, reduced bumper/intake depth, broader simplified livery regions, approximate lettering, simpler rims/interiors, and inferred rear aero/lighting. Matching complex individual panels more precisely would require further mesh sculpting from additional side/rear/top references; the current assets are fully 3D and playable with the supplied single-angle information.

## Proportion revision — 23 October 2026

Rebuilt the enclosed bodies as continuous multi-section surfaces with shaped wheel openings, curved roof/windscreen profiles, sloping shoulders and recessed duct walls. Enclosed-car body widths are now 2.64–2.74 m at approximately 5.6–5.9 m length, with roof crowns at 1.43–1.78 m rather than the previous tall rectangular cabins. Fenders blend into the bonnet and quarter panels. The prototype has separate sculpted pontoons with actual wheel openings. The Formula car now has a longer/narrower silhouette and aligned axle pivots, with bevelled monocoque and sidepod sections. Headlamp corners follow the new body surfaces; hood number panels and wings were resized.

These dimensions are visual estimates from the supplied perspectives, not recovered engineering drawings. A new runnable check guards overall height/length, enclosed width/length, and glazing height against the earlier boxy proportions. Final GLBs, manifest counts, five-view captures and contact sheets have been regenerated. The earlier contact sheet remains at `../preview-cars-before-proportions.png` for comparison.
