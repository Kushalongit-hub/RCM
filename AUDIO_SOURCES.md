# Audio sources and reproduction

The Stock 42 engine uses the user-supplied Vehicle SFX Free recordings. The other seven engine voices use original stylized DSP authored in this project. They are not recordings of branded racing cars. Original generated audio files and DSP configuration are dedicated to CC0-1.0 for reuse with the game. The Stock recordings and derived comparisons retain CC BY 4.0. No ripped or unknown-license engine recordings are included.

| Files | Creator / source | License | Processing |
|---|---|---|---|
| Non-Stock `public/audio/*-loop.wav`, `*-comparison.wav` | Original project synthesis: `public/engine-dsp.js`, `public/audio-presets.js`, `scripts/build-audio.js` | CC0-1.0 | 24 kHz mono PCM16; deterministic pulse/harmonic/noise layers; DC removal; peak cap 0.72; fallback engine loops overlap 50 ms at the seam; comparison/effect ends fade |
| `crash.wav`, `shift.wav`, `tire.wav`, `wind.wav`, `air.wav`, `pop.wav` | Original project synthesis in `scripts/build-audio.js` | CC0-1.0 | Deterministic noise, resonances and transient envelopes; DC removal and peak cap |
| `ui-confirm.ogg` | Kenney, **Interface Sounds 1.0**, original `Audio/confirmation_001.ogg` | CC0-1.0 | Original OGG retained; decoded and gain-controlled in Web Audio |

Verified official source: [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds). The individual pack page lists Creative Commons CC0. The downloaded archive contains the same license and explicitly permits personal, educational and commercial use. The included notice is preserved in `public/audio/Kenney-License.txt`. Credit: **Kenney (kenney.nl)**.

Official download: <https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip>. See `public/audio/acquisition.json` for the actual acquisition timestamp and archive SHA-256, and `public/audio/manifest.json` for every shipped asset's source, license and SHA-256. The source archive is staged under `.scratch/audio-sources/`; only the selected sound and license are shipped.

Run `npm run audio:acquire` on Windows to download the official archive, extract with the built-in archive utility, check its license notice, and copy the selected cue. The script stops if the license notice changes. Run `npm run audio:build` to reproduce original loops, comparison clips, shared effects and the manifest. The game works with the included bank without internet access. The acquisition step is optional when rebuilding original DSP.

Why synthesis for engines: each class needs a coherent RPM/load response and a distributable source. Original synthesis gives eight tunable identities without misrepresenting generic clips as recordings of a particular engine. Listening and phone-speaker tuning remain useful follow-up work; synthesis here is deliberately an arcade interpretation.

## Stock 42 recorded engine

Vehicle SFX Free by heyheythere - https://heyheythere.itch.io/vehicle-sfx-free - CC BY 4.0

Source: user-supplied vehicle-sfx-free-assets.zip, WAV/engines/car_idle_loop.wav and car_mid_loop.wav. Imported copies are in assets/vehicle-sfx with the original license. Public stock-idle.wav, stock-loop.wav and stock-comparison.wav are resampled to 24 kHz mono PCM16, DC corrected and peak limited. The live Stock engine crossfades idle and mid loops with RPM and applies throttle load, shift cut and spatial gain/pan/Doppler in both worklet and fallback playback. These generic car samples are not recordings of a real Formula racing engine. The credit and full license are available in the in-game audio panel.
