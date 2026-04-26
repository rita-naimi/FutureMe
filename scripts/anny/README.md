# Meror Anny Mesh Pipeline

The app-facing digital twin uses live Three.js geometry today so simulation sliders can update instantly in the browser.
This folder is the handoff point for higher-fidelity Anny meshes from `naver/anny`.

Intended pipeline:

1. Install Anny in a separate Python environment.
2. Generate two template meshes: `female.glb` and `male.glb`.
3. Generate or morph variants from Meror parameters:
   - sex: female or male template
   - biological age: age blend / posture / skin-detail variant
   - BMI: body-mass scale
   - exercise and diet: musculature scale
   - sleep and stress: posture / vitality scale
   - smoking and alcohol: risk aura material
4. Export browser-ready `.glb` files into `public/models/anny/`.

The React component at `components/twin/BehaviorTwinModel.tsx` already uses the same parameter names, so replacing the procedural mesh with loaded Anny `.glb` assets should not require changes to the simulation logic.
