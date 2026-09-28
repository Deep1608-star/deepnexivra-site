# Execution Core — Blender workflow

This folder contains the source generator for the portfolio's real Blender asset.

## Build the asset

1. Install Blender from blender.org.
2. Open Blender and save a new file as `execution-core.blend` inside this folder.
3. Open the **Scripting** workspace.
4. Open `execution_core.py` in Blender's text editor.
5. Click **Run Script**.
6. Blender creates the Execution Core, adds a looping 240-frame animation, and exports `execution-core.glb` next to the `.blend` file.

## Website target

Place the exported file at:

`public/models/execution-core.glb`

The current website uses a lightweight procedural Three.js version so the portfolio can be reviewed immediately. The next integration step is to load this GLB in the same canvas and keep the existing HUD, mouse response, mobile behavior, and performance fallbacks.

## Design intent

The asset represents operations as the common layer across business functions:

- central core = flow / operating system
- rings = strategy, systems, execution
- nodes = strategy, revenue, product, projects, people, delivery
- connections = handoffs and information flow

This is intentionally not an AI logo or Career OS visualization. The object is the visual identity for Deep Patel / Deep Nexivra's operations positioning.
