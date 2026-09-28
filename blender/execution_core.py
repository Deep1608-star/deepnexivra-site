import bpy
import math
from mathutils import Vector

# Deep Nexivra — Execution Core v1
# Run inside Blender's Scripting workspace.
# Save the .blend file first, then run this script.
# The generated GLB exports next to the .blend file as execution-core.glb.

FPS = 30
START_FRAME = 1
END_FRAME = 240


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def make_material(name, base_color, metallic=0.5, roughness=0.25, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if emission is not None:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        strength_input = bsdf.inputs.get("Emission Strength")
        if strength_input:
            strength_input.default_value = emission_strength

    return mat


def add_icosphere(name, radius, location, material, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_torus(name, major_radius, minor_radius, rotation, material):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=72,
        minor_segments=10,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_connection(name, start, end, material, radius=0.012):
    curve_data = bpy.data.curves.new(name=f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 1
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 2

    spline = curve_data.splines.new("POLY")
    spline.points.add(1)
    spline.points[0].co = (*start, 1.0)
    spline.points[1].co = (*end, 1.0)

    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    curve_data.materials.append(material)
    return obj


def animate_rotation(obj, start_rotation, end_rotation):
    obj.rotation_euler = start_rotation
    obj.keyframe_insert(data_path="rotation_euler", frame=START_FRAME)
    obj.rotation_euler = end_rotation
    obj.keyframe_insert(data_path="rotation_euler", frame=END_FRAME)

    if obj.animation_data and obj.animation_data.action:
        for fcurve in obj.animation_data.action.fcurves:
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = "LINEAR"


def build_core():
    clear_scene()

    scene = bpy.context.scene
    scene.frame_start = START_FRAME
    scene.frame_end = END_FRAME
    scene.render.fps = FPS
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.world.color = (0.004, 0.006, 0.011)

    core_mat = make_material(
        "CoreMetal",
        (0.34, 0.46, 0.68),
        metallic=0.82,
        roughness=0.18,
        emission=(0.025, 0.07, 0.16),
        emission_strength=1.1,
    )
    ring_mat = make_material("RingMetal", (0.22, 0.33, 0.52), metallic=0.9, roughness=0.22)
    node_mat = make_material(
        "NodeMetal",
        (0.60, 0.72, 0.92),
        metallic=0.65,
        roughness=0.2,
        emission=(0.055, 0.16, 0.36),
        emission_strength=1.6,
    )
    line_mat = make_material(
        "ConnectionMetal",
        (0.16, 0.28, 0.47),
        metallic=0.65,
        roughness=0.3,
        emission=(0.025, 0.09, 0.22),
        emission_strength=0.7,
    )

    root = bpy.data.objects.new("ExecutionCore_ROOT", None)
    bpy.context.collection.objects.link(root)

    core = add_icosphere("Core_FLOW", 0.72, (0, 0, 0), core_mat, subdivisions=4)
    core.parent = root

    ring_a = add_torus("Ring_Strategy", 1.35, 0.026, (math.radians(64), 0.0, math.radians(10)), ring_mat)
    ring_b = add_torus("Ring_Systems", 1.72, 0.021, (math.radians(16), math.radians(66), math.radians(-12)), ring_mat)
    ring_c = add_torus("Ring_Execution", 2.06, 0.018, (math.radians(84), math.radians(24), math.radians(42)), ring_mat)

    for ring in (ring_a, ring_b, ring_c):
        ring.parent = root

    animate_rotation(
        ring_a,
        ring_a.rotation_euler.copy(),
        (ring_a.rotation_euler.x, ring_a.rotation_euler.y, ring_a.rotation_euler.z + math.tau),
    )
    animate_rotation(
        ring_b,
        ring_b.rotation_euler.copy(),
        (ring_b.rotation_euler.x, ring_b.rotation_euler.y, ring_b.rotation_euler.z - math.tau),
    )
    animate_rotation(
        ring_c,
        ring_c.rotation_euler.copy(),
        (ring_c.rotation_euler.x, ring_c.rotation_euler.y + math.tau, ring_c.rotation_euler.z),
    )

    nodes = {
        "Strategy": Vector((0.0, 2.08, 0.12)),
        "Revenue": Vector((1.80, 1.02, 0.32)),
        "Product": Vector((1.72, -1.08, -0.28)),
        "Projects": Vector((0.0, -2.08, 0.18)),
        "People": Vector((-1.74, -1.02, -0.34)),
        "Delivery": Vector((-1.80, 1.02, 0.28)),
    }

    for index, (label, position) in enumerate(nodes.items()):
        radius = 0.13 if index % 2 == 0 else 0.11
        node = add_icosphere(f"Node_{label}", radius, position, node_mat, subdivisions=2)
        node.parent = root
        add_connection(f"Link_{label}", Vector((0, 0, 0)), position * 0.94, line_mat, radius=0.011).parent = root

    root.rotation_euler = (math.radians(-6), math.radians(8), 0)

    # Studio lights are useful when inspecting the .blend file.
    bpy.ops.object.light_add(type="AREA", location=(3.8, 4.4, 5.3))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 4.0

    bpy.ops.object.light_add(type="AREA", location=(-4.0, -2.8, 2.2))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 650
    rim.data.size = 3.0

    bpy.ops.object.camera_add(location=(0, 0, 7.6), rotation=(0, 0, 0))
    camera = bpy.context.active_object
    camera.name = "Portfolio_Camera"
    camera.data.lens = 52
    scene.camera = camera

    scene.frame_set(START_FRAME)

    glb_path = bpy.path.abspath("//execution-core.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_apply=True,
        export_animations=True,
        export_cameras=False,
        export_lights=False,
    )

    print(f"Execution Core exported to: {glb_path}")


if __name__ == "__main__":
    build_core()
