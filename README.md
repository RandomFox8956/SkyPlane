# Sky Plane

All project files live together in this folder, with no subfolders. Open `index.html` to play. In Blender, use `runpy.run_path` with the full path to `build_cockpit.py` to rebuild the model alongside the script.

Drag in chase view to orbit the aircraft; double-click the flight view to recenter the camera. Flight controls remain independent of camera dragging.

The enclosed two-seat cockpit is modeled in Blender, with framed glazing, a ceiling and overhead switches, rear door, dual yokes, and a centre console. Its editable source is `skyplane-cockpit.blend`; `build_cockpit.py` builds the geometry and exports `cockpit.js` for the offline canvas renderer. The instrument faces in `world.js` use live flight values. Press **C** to reach Cockpit view or Full cockpit view; drag in either view for full 360-degree horizontal look-around and to look up or down. Cycling cameras resets the view forward. To rebuild the asset, run the Python script in Blender.

A single-player airport business game with a low-poly 3D flight simulator. Built with plain HTML, CSS, and JavaScript. No installation, build step, accounts, dependencies, downloads, tracking, or backend is required to play.

## Play

Open **index.html** in a modern browser. Or, if Node.js is installed, run:

```
node server.js
```

Then open http://127.0.0.1:4173. Start with **Flight school** in the sidebar. **Your first flight** opens a guided mission briefing.

## Host anywhere

Upload these thirteen files together to any static web host, retaining their names:

```
index.html
style.css
core.js
navigation.js
airport.js
airport-assets.js
render3d.js
jobs.js
workplace.js
worlds.js
cockpit.js
world.js
app.js
```

There are no absolute asset paths, remote fonts, CDNs, API keys, databases, or server-side requirements. The game can live in a subfolder. The optional server is for local preview, not a production hosting requirement. Use your school's permitted hosting and browser arrangements.

## Worlds and play modes

Every world is created with a name, a play mode, and a world type. Mode and type are locked once the world exists; you can keep as many worlds as you like and switch between them from the main menu.

| Play mode | What it is |
| --- | --- |
| **Airport business** | Run the airport: buildings, staff, finances, roles, and every mission. |
| **Flight only** | A fully equipped airport and every mission, with no money, wages, or management. |
| **Competitive** | A time trial. One track, one timer, no missions or business. Finish the race to set a record; beating it saves a new one. Once you have a record, a translucent **ghost aircraft** flies your best lap beside you and each gate shows how far ahead or behind you are. |
| **Free flight** | All twenty islands generated in one open world around your home island, no missions, no timer, no business. Touch down on any runway and your tanks fill without the flight ending; take off again and keep exploring. |

### Flying between islands

In business and flight-only worlds the passenger, cargo, and emergency missions are **crossings**: the game generates your island plus one random other island 10–12 km away and routes you across the water into a proper approach on the destination's matching runway (the route steers around high ground automatically). Training, the air rally, and the coastline patrol remain circuits around the island you are on.

- **Flight only:** after landing you are parked on that island. Your next flights start there — circuits fly around it, crossings go on to yet another island — and a **Homeward bound** flight on the mission list takes you back to your own island.
- **Business:** you only fly out; the next flight always starts back at your own airport.

There are **20 maps** in four world types, five per type. Every map has its own landmasses, mountains or mesas, vegetation, airport setting, and a distinct race circuit with its own default track. Every airport has **three runways** — two north–south and one east–west strip — laid out in a **different position on each island** (at most one pair ever crosses). Each mission departs and lands on the runway assigned to it. The flight rules never change.

**Runway assignments:** the mission type supplies a preferred departure runway. The route planner checks broad turns, terrain clearance, climb gradients and final approach, and can select another runway when necessary. Local circuits land on a different runway from their departure runway. The flight HUD identifies the assigned runway; all flights start at A1, and missions finish at the arrival airport's A1 stand.

| World type | Maps |
| --- | --- |
| **Island** | Seabreeze Island (bay circuit), Crescent Atoll (loop over the lagoon), Longshore Peninsula (slalom along the spine), Twin Harbours (figure-eight across the strait), Ember Peak (climbing spiral around a volcano) |
| **Desert** | Dunes & Mesas (bay circuit), Red Canyon (slalom between mesa walls), Palm Oasis (loop around the oasis), Salt Flats (fast figure-eight), Mesa Country (climbing spiral) |
| **Alpine** | Alpine Valley (bay circuit), Glacier Lake (loop over the lake), Ridge Run (valley slalom), Summit Circuit (climbing spiral), Highland Meadows (figure-eight) |
| **Arctic** | Polar Outpost (bay circuit), Frozen Fjord (fjord slalom), Ice Shelf (figure-eight), Glacier Bay (loop between icebergs), Aurora Peak (climbing spiral under violet skies) |

**Design a race** still lets you change the number of gates, size, altitude, and direction of any map's circuit; the route retains the map’s loop, figure-eight, slalom or climbing-circuit character using smooth arcs. Terrain clearance can alter the connecting route.

## What you can do

- Run an airport with a $24,000 starting investment, employee wages, upkeep, flight costs, ticket revenue, loans, grants, and a transaction ledger.
- Expand terminals, hangars, runway length, radar, fuel storage, and emergency facilities. Each expansion changes the economy or flight rewards and adds to the 3D airport.
- Hire and dismiss staff. Flights pass through check-in, security, ground handling, and boarding. Missing staff create real bottlenecks.
- Switch between manager, pilot, check-in receptionist, security guard, cabin crew, ground crew, and engineer. Service roles have rotating interactive tasks; correct answers pay bonuses and relevant tasks advance waiting flights.
- Fly training, passenger, fragile cargo, unarmed military patrol, medical-delivery, and time-trial racing missions. Follow navigation gates, land on your mission's runway (yours or a neighbouring island's), and taxi to parking gate A1 to collect the mission reward.
- Choose aircraft paint, clear skies, overcast, storms, or golden hour; design a race route; switch between chase, cockpit, and cinematic cameras; watch a replay of the last 60 seconds.
- Read eight tutorial lessons plus a full controls guide.
- Save locally and export/import JSON backups to move your airport between computers.

## Flight controls

| Control | Action |
| --- | --- |
| W / Up arrow | Nose down |
| S / Down arrow | Nose up |
| A / D or Left / Right | Bank |
| Q / E | Rudder / ground steering |
| + / Shift | Increase throttle |
| − / Ctrl | Decrease throttle |
| F | Cycle flaps: 0°, 15°, 30° |
| G | Landing gear |
| B | Wheel brakes / cancel taxi assist |
| T | Taxi assistance between gate and runway |
| C | Change camera |
| Esc / P | Pause |

Takeoff: select 15° flaps, full throttle, rotate gently at 65–70 knots. Retract gear above 100 ft and raise flaps once climbing. Landing: gear down, 30° flaps, 65–80 knots, level wings, gentle descent. Reduce throttle and brake after touchdown.

Pitch controls can be reversed. Touch controls appear on narrow screens and can be forced on in Settings.

## Performance and saves

High graphics is the default for this visual update. The WebGL renderer uses depth testing, smooth Blender normals, directional lighting and filtered sunlight shadows. Low quality disables shadows and reduces resolution, with a 30 FPS cap. Medium uses full resolution at 30 FPS; High increases resolution and caps at 60 FPS. Flight simulation always uses a fixed 60 Hz step, independent of graphics quality.

One real minute is one game hour. Employees work during missions and other pages. Simulation pauses while the browser tab is hidden, while a dialog is open, during replays, or when explicitly paused. There are no offline charges.

The game autosaves to `localStorage` every 10 seconds and after important actions. Saves are per browser and origin. Incognito mode, school policies, and browser cleanup may remove them: **export a backup before leaving**. Flights in progress and replay footage are not persisted; the business and completed rewards are.

## Scope of this version

This is a playable small game, not an aviation training tool. The flight model approximates lift, drag, gravity, angle of attack, stalls, wind, flaps, gear, fuel, and reduced engine power. Passenger jets, cargo planes, patrol aircraft, rescue planes, and trainers have procedural visual variants. All share one simplified light-trainer physical model. It has no arcade physics toggle.

Airport building placement is predefined; upgrades grow a procedural island. Custom race courses are parameter-based and included in save exports, as is your race record (and, in competitive worlds, its ghost trace, about 50–100 KB for a full lap). Changing the course clears both. There is no full terrain editor, online community sharing service, combat, or multiplayer. The airport is walkable and all seven roles use equipment in the full-screen 3D world. Service jobs operate equipment directly rather than answering multiple-choice prompts. Mountains, hills, mesas, buildings, trees, parked aircraft, boats, and airport fixtures are solid: contact ends the flight. Scenery collision uses the visible meshes, with swept fuselage and wing checks. Mission and race gates are always placed clear of the scenery (routes are lifted over high ground automatically), and each map's missions follow that map's own circuit. The locally generated Blender assets are included and work offline.


Airport and flight update:
- In business mode, choose **Enter airport**. WASD moves, arrow keys turn, dragging looks around, Shift walks faster, and E works at your selected role's station. The floor plan marks that station. Check-in, security, cabin, engineering and ground jobs retain their rewards and cooldowns; the manager hires staff and expands the terminal using desk controls, and the pilot dispatches flights from the physical operations board.
- Every flight starts at parking gate A1. T enables taxi assistance, which stops at the runway for manual takeoff. B cancels assistance. After the checkpoints, land on the assigned arrival runway, brake below 19 knots, and press T to taxi to A1 and complete the flight. You can also taxi manually and park at A1 with idle throttle and B.
- Gate totals now include departure and final checkpoints. The separate pale navigation trail follows broad turns and a straight final approach. Same-island circuits use a different arrival runway. Terrain clearance takes priority when assigning runways.
- Previous race records are reset once because the route and gate-to-gate timing have changed.
- `navigation.js` contains route and taxi geometry; `airport.js` contains the shared terminal model and pedestrian collision plan. Both are required for offline play.


## Blender airport and hands-on jobs

`skyplane-airport.blend` is the editable source for the vaulted terminal, furnishings, service buildings, passenger characters and trainer/airliner/cargo/patrol aircraft. Run `build_airport.py` in Blender to regenerate `airport-assets.js`. The cockpit retains its separate Blender source. Everything stays in this one folder.

Choose **Enter airport**, select a role and walk to the marked workstation. Press **E** to clock in, then aim at a physical object and press **E** or click it. Drag to look and walk between equipment; the airport stays visible while you work. Check-in scans documents, weighs and tags bags and prints boarding passes. Security operates an X-ray scanner and retains restricted items. Ground crew carries cases to the aircraft holds, stops the fuel gauge in its target band and times pushback clearance. Cabin crew secures belts, trays and bins. Engineers inspect a tyre, fit a replacement and torque four bolts. The manager uses the airport control desk; pilots dispatch flights from their operations desk.

Difficulty now changes flight handling. Relaxed adds gentle takeoff rotation, stronger roll stabilisation, reduced wind and forgiving stalls/landings. Standard needs manual rotation and normal landing precision. Challenging increases wind, reduces stabilisation and tightens stall/landing margins. Accelerating at a parking gate is limited to taxi speed; a takeoff excursion is only evaluated after a genuine runway takeoff roll, with a difficulty-dependent recovery interval. Failure guidance distinguishes takeoff, ground movement, terrain and landing.

## Living terminal and physical workstations

`workplace.js` adds eighteen passengers and seven coworkers with jointed arm/leg animation, turning, collision-aware routes, pauses and multiple destinations. Passengers visit check-in, security, the cafe, information and different gates. Check-in and security serve a named person who approaches the desk, waits during service and walks onward afterward. Each workstation has a uniformed coworker.

Passports, boarding tickets, printed passes, tagged suitcases, inspection items, scales, conveyors, the fuel cart, service aircraft and wheel assembly are 3D objects. The small focus caption shows the item you are looking at, its document details and feedback. The randomized checks, timing challenges, increasing difficulty and graded pay remain; physical shifts allow extra time for walking. Premature cabin/security release never fixes missed work automatically.

At gate A2, cabin crew can board a curved, glazed cabin, walk the aisle, assist twelve seated passengers, stow trays, fasten belts and close lockers before using the galley interphone. Use the door control to return to the terminal. Workstation tasks do not open a modal or replace the walking scene. All runtime files remain in one folder and work offline.

### Workstation coaching and revised shifts

Every role now has an automatic in-world tutorial checklist, a glowing next target and a **Show me where** direction button. **H** toggles tips. **E** or a click operates equipment; **Space** also operates timed controls. Fuel, torque and pushback have a large on-screen meter, more forgiving timing and clocks that freeze while paused or away from the workstation.

Check-in includes choosing a seat and handing over the printed pass. Security requires inspecting and sorting permitted and restricted belongings. Ground crew handles wheel chocks and can put a carried bag back. Cabin crew serves requested drinks and can start another shift without leaving the cabin. Engineering includes raising and lowering a jack. Managers review departures before staffing or expansion; pilots select a flight, review weather and aircraft/fuel, then board. Existing mistakes, grades, rewards and job progression remain.

### Living shifts

Every job reacts in the 3D world: synthesised sound effects, floating score pop-ups, streak counters, confetti when a shift finishes, and **★ PERFECT** bonuses for dead-centre timing (each adds a little to the grade). Cabin announcements and ATC clearances are spoken aloud when sound is on and the browser supports speech.

- **Check-in** — the passport shows a photo; from the second shift onward some travellers are impostors whose photo doesn't match the person at your desk. Customers greet you, show a patience meter and tip you for fast service. The scale counts up each bag's weight, and checked bags ride the belt through the curtain.
- **Security** — belongings ride out of the scanner one by one. The X-ray monitor above the arch colours each numbered item by material, and an innocent-looking item (toiletry bag, hairdryer, shoe box) can hide a blade that only the monitor reveals. The alarm beacon flashes until every threat is handled.
- **Ground crew** — bags swing up into the hold, beacons flash once clearance is armed, and signalling ready makes the tug push the aircraft back off its stand.
- **Cabin crew** — call bells light up during the shift, and passengers ask for help. At the front of the cabin you perform the safety demonstration: listen to the announcement and hold up the matching prop (seat belt, oxygen mask, life vest, exits). The cabin applauds when you finish.
- **Engineer** — the jack visibly lifts the strut, the damaged tyre rolls away and the new wheel slides in. Bolts must be torqued in a real cross pattern (after each bolt, the diagonally opposite one), nuts spin under the wrench, and the release check spin-tests the wheel.
- **Manager** — a live departures board, plus an incident desk where situations arrive (storms, jammed belts, influencers, fuel price spikes, lost children, birds on the runway). Every choice trades cash against reputation, and some are gambles.
- **Pilot** — a weather radar sweeps storm cells that match the airport's weather. ATC reads out your clearance; memorise the squawk code and read it back. It is only shown for a few seconds, and **Say again** repeats it. A clean first readback earns a small bonus.
