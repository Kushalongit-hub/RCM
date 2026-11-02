# Room Rally GP

A local 3D racer for **one to four human players**, with phones as gyro steering wheels. Eight selectable low-poly vehicles (Formula, endurance prototype, drift coupe, GT3, stock car and three supercars) race across 25 circuits (24 new tracks plus original Coastal), with primary body paint selection, pit buildings, grid markings, kerbs and barriers. Each driver can enable their own phone audio mix. There are no item pickups, weapons, shields or drift turbo rewards.

## Run

Requires Node.js 22+ and a computer browser with WebGL 2 and hardware acceleration.

```sh
npm install
npm start
```

Open **http://localhost:3000/** on the game computer, or the Host link printed in the terminal. Localhost recovers display authorization for audio QR management. The first joined driver is HOST; only that driver can change race settings and start. Everyone must tap Ready first. A display tab does not itself become a racer or race host. Keep that terminal running. The shared screen uses HTTP port **3000**; secure phone controllers use HTTPS port **3443**, with the same game room on both ports. `PORT`, `HTTPS_PORT` and `LAN_HOST` can override these values.

Join on phones via the lobby QR, or click **Drive on this computer** for a keyboard driver. Bots fill the field to four cars in Circuit Race; Time Trial and Drift Challenge use only joined drivers. The server rejects a fifth player. One driver gets the full screen, two get top/bottom halves, three get equal left/middle/right columns, and four get equal quarters. Player numbers and views remain stable during a race, including when a disconnected driver becomes an AI car.

A Start click on the game computer requests native fullscreen. A phone-hosted Start fills the display browser window; tap the display fullscreen button beforehand for native fullscreen. If browser fullscreen is unavailable, the race still fills the browser panel. The phone driving controls fit landscape screens down to 640×320 without page scrolling; settings open over the controls and can be closed again.

## Eight-car garage

Choose **Your car** before joining on the host or phone. Joined phone drivers can change cars from **Wheel & car setup** while in the lobby; a keyboard driver uses the lobby selector. Selection is locked during a race. Each driver chooses one of 16 named body paints. The primary body paint changes per instance; original red/black trim, tires and glass remain intact. The lobby renders your actual selected car and paint. Bots use a rotating selection of vehicles.

Open **Explore all eight cars** or **http://localhost:3000/garage** for reference comparisons, five camera angles, animated wheels, and contact sheets. Editable procedural meshes live in `public/vehicle-meshes.js`; independent GLBs are in `public/vehicles/`. Rebuild exports with `npm run assets:build`. See [vehicle notes](docs/VEHICLES.md) for reference mapping, triangle counts, tuning, and reconstruction limits.

## One-time gyro setup on each phone

Browser motion sensors require a **trusted HTTPS connection**. A LAN IP served over plain HTTP cannot provide gyro steering. The app creates a local CA and a LAN server certificate in the git-ignored `.local-certs/` directory. It does **not** install or trust a certificate on any device automatically.

1. Connect the phone and computer to the same Wi-Fi.
2. Open **Gyro HTTPS setup** beside the QR on the shared display, then open that setup link on the phone. This opens an HTTP setup page without a certificate warning.
3. Compare its SHA-256 fingerprint with the setup page on the computer. Download the **Room Rally Local Game CA** public certificate.
4. Install/trust that certificate on your phone, following the on-screen iOS/Android instructions. Installing a CA adds a trust authority to your device: use only your own trusted computer and remove the CA after use if desired. Never share `.local-certs/ca-key.pem` or `server-key.pem`.
5. Open **secure controller** from the setup page, or rescan the lobby QR. If a certificate warning appears, fix certificate trust rather than bypassing it.
6. Join, tap **Enable gyro steering**, and allow Motion & Orientation if prompted. Hold the phone sideways, screen facing you, and keep it still for centering. Turn it like a steering wheel. Tap **Center wheel** whenever your holding position changes.

iOS: install the downloaded profile in Settings, then enable it in General → About → Certificate Trust Settings. Android: search Settings for “Install a certificate”, choose CA certificate, and select the downloaded file; names vary by device. The setup page includes these steps and the fingerprint. The public certificate is downloadable; private keys have no HTTP route.

**Touch wheel** is the default controller mode. Brake and forward are stacked on the left; drag the Formula wheel on the right to steer. Releasing the wheel centers steering. Drift, ERS and Return sit beneath the wheel. Choose Gyro steering explicitly to use phone motion instead.

## Controls

| Action | Phone | Computer keyboard |
| --- | --- | --- |
| Steer | Rotate the phone left/right | A/D or arrows |
| Forward | Hold FORWARD | W / Up |
| Brake, then reverse | Hold BRAKE | S / Down |
| Drift | Hold DRIFT, or choose tap-to-toggle in settings | Shift |
| ERS boost | Hold ERS / OVERTAKE | B or Space |
| Rescue | RESCUE | R |

Brake overrides forward if both are pressed. Drift starts only once you steer at speed and changes tyre grip; it awards no turbo or energy bonus. ERS deploys only while its button and accelerator are held, consumes stored energy and regenerates faster under braking. Gyro steering has calibration, a 2° dead zone, smoothing, adjustable full-lock angle (15–50°), and inversion. Both landscape directions are supported using screen-relative gravity projection. A flat phone has no stable steering-wheel reference: hold its screen toward you. Pedals work independently of gyro permission and calibration. Unavailable gyro readings center steering; enable/calibrate gyro or choose Touch wheel to steer. Sensor loss, tab hiding, focus loss and server input timeout release driving inputs. Returning to a gyro controller requires recentering.

The landscape controller resembles a Formula steering wheel, with carbon-fibre body, textured side grips, coloured thumb buttons, rev LEDs and a central display. Gear, speed, RPM and ERS energy follow the server's live car state; gears/RPM come from an authoritative virtual gearbox using speed and throttle; they drive audio as well as the display, without changing physics. The rotary graphics are decorative. In gyro mode, brake and forward are on the side grips with drift, ERS and Return on the centre controls. Touch mode separates pedals on the left from the turning wheel and actions on the right. Wheel setup contains gyro sensitivity, inversion and hold/toggle drift settings.

HOST chooses any of 25 tracks, Circuit Race / Time Trial / Drift Challenge, and 1–20 laps. Circuit Race has a 40-second finish window after the first finisher and a track-length-scaled overall limit. Time Trial ranks best valid lap with car contact disabled; Drift Challenge scores clean controlled slides for 120 seconds. Each circuit has ordered, track-specific checkpoints. **Back to lobby** cancels; **Race again** returns from standings. The Formula-style circuit has no kart jump ramps or road boost pads.

## LAN troubleshooting

Allow Node.js on private networks if Windows Firewall prompts; both **3000** and **3443** must be reachable. Guest Wi-Fi/client isolation can block device communication. The QR prefers private Wi-Fi/Ethernet addresses over virtual adapters. To choose the Wi-Fi adapter explicitly:

```powershell
$env:LAN_HOST = '192.168.1.42'
npm start
```

Restarting automatically refreshes the server certificate if LAN addresses change, retaining the existing CA. No cloud service, CDN, account or internet connection is needed after installing packages. Use a trusted LAN. Display authorization permits issuing audio QR links; race settings/start/reset require the current joined HOST. Losing a controller gives its car to AI. A two-minute session-resume window restores the same driver and car when the race still exists; when the room becomes empty it resets. Host transfers to the earliest remaining driver.

## Verification

```sh
npm test
```

Tests cover orientation math, both landscape directions, neutral/dead-zone/inverted steering, exact split-screen coverage, free driving, drift handling without power-ups, ERS deployment/regeneration, AI lap completion, reverse checkpoint protection, car collisions, four-player capacity, host authorization, disconnect takeover, trusted HTTPS certificate validation, secure WebSocket room sharing and private-key route denial.

This is a Formula-inspired arcade game rather than an F1 vehicle simulator. Real-device gyro accuracy, sensor permissions, Wi-Fi latency and multi-touch require checking on the actual phones; synthetic orientation math and local browser/network integration are verified separately.

The controller always fills a landscape wheel layout after joining. If the phone browser stays in portrait (including rotation lock), the wheel turns sideways automatically. Turn the phone to read it. Tap **Landscape ⛶** to request fullscreen and native landscape locking where supported. Layout/orientation changes release held inputs and recenter active gyro steering.

## Tracks, lobby and personal audio

Open `/tracks` for all 25 maps and actual 3D previews; open `/audio-lab` for the eight engines, live RPM/load/slip controls and comparison clips. On each controller choose **Lobby / Ready → Enable Audio**. Keyboard/gamepad drivers can use their **Audio QR** to attach a separate phone without consuming a driver slot. Tap Enable Audio on that phone. The mix uses in-game position, with your own car prominent and opponents fading out by 60 m.

The eight voices use original layered synthesis; the included confirmation cue is Kenney CC0. AudioWorklet is used on supporting secure browsers, with a cached WAV fallback. Phones may suspend sound when locked or backgrounded. Physical mobile-speaker/gyro/gamepad and sustained thermal testing remains unverified.

See [racing expansion](docs/RACING_EXPANSION.md), [personal audio](docs/PERSONAL_AUDIO.md), and [asset sources](AUDIO_SOURCES.md). Rebuild with `npm run assets:build`, `npm run tracks:build`, and `npm run audio:build`; re-download the licensed cue with `npm run audio:acquire`. `npm run tracks:validate` writes the actual 200-pair compatibility report.
#   R C M  
 