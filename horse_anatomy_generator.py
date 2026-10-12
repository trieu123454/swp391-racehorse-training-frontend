"""Build an equine anatomy study in Blender 4.x from the bundled rigged horse.

Run from the repository root with:
    blender --background --python horse_anatomy_generator.py

The detailed source horse remains real mesh geometry. Anatomy overlays are
separate mesh objects in matching coordinates and can be shown independently.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parent
SOURCE_GLB = ROOT / "public" / "models" / "injury-horse.glb"
OUTPUT_DIR = ROOT / "output" / "horse_anatomy"
WITHERS_HEIGHT_M = 1.55
# Approximate withers height as a fraction of the imported mesh's total height.
WITHERS_FRACTION = 0.72

COLLECTION_NAMES = (
    "01_OUTER_BODY",
    "02_MUSCLES",
    "03_SKELETON",
    "04_ORGANS",
    "MANE_TAIL",
    "EYES",
    "HOOVES",
    "CAMERAS",
    "LIGHTS",
    "HELPERS",
)

COLLECTIONS: dict[str, bpy.types.Collection] = {}
MATERIALS: dict[str, bpy.types.Material] = {}
IMPORTED: list[bpy.types.Object] = []
ARMATURE: bpy.types.Object | None = None
MODEL_BOUNDS: tuple[Vector, Vector] | None = None


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)


def create_collections() -> None:
    master = bpy.data.collections.new("HORSE_MASTER")
    bpy.context.scene.collection.children.link(master)
    COLLECTIONS["HORSE_MASTER"] = master
    for name in COLLECTION_NAMES:
        collection = bpy.data.collections.new(name)
        master.children.link(collection)
        COLLECTIONS[name] = collection


def move_to_collection(obj: bpy.types.Object, collection_name: str) -> None:
    collection = COLLECTIONS[collection_name]
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(name: str, color: tuple[float, float, float, float], roughness: float) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader:
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = roughness
    return material


def create_materials() -> None:
    coat = bpy.data.materials.new("MAT_DarkBay_ProceduralCoat")
    coat.diffuse_color = (0.24, 0.09, 0.035, 1)
    coat.use_nodes = True
    nodes = coat.node_tree.nodes
    links = coat.node_tree.links
    shader = nodes.get("Principled BSDF")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5.0
    noise.inputs["Detail"].default_value = 3.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.2
    ramp.color_ramp.elements[0].color = (0.12, 0.035, 0.012, 1)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (0.34, 0.13, 0.045, 1)
    if shader:
        shader.inputs["Roughness"].default_value = 0.4
        if "Coat Weight" in shader.inputs:
            shader.inputs["Coat Weight"].default_value = 0.18
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    if shader:
        links.new(ramp.outputs["Color"], shader.inputs["Base Color"])

    MATERIALS.update({
        "coat": coat,
        "muscle_a": make_material("MAT_Muscle_Rose", (0.55, 0.13, 0.16, 1), 0.68),
        "muscle_b": make_material("MAT_Muscle_DeepRed", (0.39, 0.075, 0.105, 1), 0.72),
        "bone": make_material("MAT_Bone_Ivory", (0.83, 0.75, 0.59, 1), 0.82),
        "organ_a": make_material("MAT_Organ_Warm", (0.67, 0.18, 0.21, 1), 0.7),
        "organ_b": make_material("MAT_Organ_Tan", (0.57, 0.29, 0.16, 1), 0.72),
        "vein_red": make_material("MAT_Vessel_Artery", (0.62, 0.045, 0.055, 1), 0.55),
        "vein_blue": make_material("MAT_Vessel_Vein", (0.035, 0.18, 0.42, 1), 0.55),
        "sock": make_material("MAT_White_Sock", (0.86, 0.82, 0.7, 1), 0.48),
        "floor": make_material("MAT_StudioFloor", (0.72, 0.68, 0.6, 1), 0.9),
    })


def object_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        raise RuntimeError("No visible horse meshes were imported.")
    minimum = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    maximum = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return minimum, maximum


def pose_bone_world(name: str) -> Vector | None:
    if not ARMATURE or name not in ARMATURE.pose.bones:
        return None
    return ARMATURE.matrix_world @ ARMATURE.pose.bones[name].head


def align_and_scale_source(objects: list[bpy.types.Object]) -> None:
    """Infer forward/up from the rig, then map the horse to Blender X-forward/Z-up."""
    global MODEL_BOUNDS
    minimum, maximum = object_bounds(objects)
    size = maximum - minimum
    center = (minimum + maximum) * 0.5
    head = pose_bone_world("head_019")
    hoof = pose_bone_world("foot_l_0407")
    if hoof is None:
        hoof = pose_bone_world("foot_r_0476")

    if head is not None and hoof is not None:
        vertical_index = max(range(3), key=lambda axis: abs(head[axis] - hoof[axis]))
        up_sign = 1.0 if head[vertical_index] >= hoof[vertical_index] else -1.0
    else:
        vertical_index = sorted(range(3), key=lambda axis: size[axis])[1]
        up_sign = 1.0

    horizontal = [axis for axis in range(3) if axis != vertical_index]
    long_index = max(horizontal, key=lambda axis: size[axis])
    if head is not None:
        long_sign = 1.0 if head[long_index] >= center[long_index] else -1.0
    else:
        long_sign = 1.0

    forward = Vector((0, 0, 0))
    forward[long_index] = long_sign
    up = Vector((0, 0, 0))
    up[vertical_index] = up_sign
    lateral = up.cross(forward)
    rotation = Matrix((forward, lateral, up)).to_4x4()
    for obj in objects:
        obj.matrix_world = rotation @ obj.matrix_world
    bpy.context.view_layer.update()

    minimum, maximum = object_bounds(objects)
    center = (minimum + maximum) * 0.5
    size = maximum - minimum
    scale = WITHERS_HEIGHT_M / max(0.01, size.z * WITHERS_FRACTION)
    normalize = Matrix.Scale(scale, 4) @ Matrix.Translation(-center)
    for obj in objects:
        obj.matrix_world = normalize @ obj.matrix_world
    bpy.context.view_layer.update()
    minimum, maximum = object_bounds(objects)
    MODEL_BOUNDS = (minimum, maximum)


def build_horse_blockout() -> None:
    global IMPORTED, ARMATURE
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(f"Horse source GLB is missing: {SOURCE_GLB}")
    before_import = {obj.name for obj in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    IMPORTED = [obj for obj in bpy.data.objects if obj.name not in before_import]
    if not IMPORTED:
        raise RuntimeError("Blender imported no objects from the source GLB.")

    for obj in list(IMPORTED):
        label = f"{obj.name} {obj.data.name if obj.data else ''}"
        if obj.type == "MESH" and ("saddle" in label.lower() or "tack" in label.lower()):
            bpy.data.objects.remove(obj, do_unlink=True)
            IMPORTED.remove(obj)
            continue
        if obj.type == "ARMATURE":
            ARMATURE = obj
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
            if "body" in (obj.data.name if obj.data else "").lower() and len(obj.data.materials) == 0:
                obj.data.materials.append(MATERIALS["coat"])
        label = f"{obj.name} {obj.data.name if obj.data else ''}".lower()
        target = "MANE_TAIL" if "hair" in label else "EYES" if "eye" in label else "01_OUTER_BODY"
        move_to_collection(obj, target)

    align_and_scale_source(IMPORTED)


def find_bone_world(name: str) -> Vector | None:
    return pose_bone_world(name)


def add_ellipsoid(
    name: str,
    location: Vector,
    radii: tuple[float, float, float],
    material: bpy.types.Material,
    collection: str,
    direction: Vector | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radii
    if direction is not None and direction.length > 0.0001:
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_segment_mesh(
    name: str,
    start: Vector,
    end: Vector,
    radius_start: float,
    radius_end: float,
    material: bpy.types.Material,
    collection: str,
    vertices: int = 16,
) -> bpy.types.Object | None:
    direction = end - start
    length = direction.length
    if length < 0.015:
        return None
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_start,
        radius2=radius_end,
        depth=length,
        location=(start + end) * 0.5,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.materials.append(material)
    move_to_collection(obj, collection)
    return obj


def add_curve(name: str, points: list[Vector], bevel: float, material: bpy.types.Material, collection: str) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    COLLECTIONS[collection].objects.link(obj)
    obj.data.materials.append(material)
    return obj


def build_head() -> None:
    if ARMATURE and "head_019" in ARMATURE.data.bones:
        ARMATURE.data.bones["head_019"]["anatomy_region"] = "skull and head"
    for obj in IMPORTED:
        if obj.type == "MESH" and "body" in obj.name.lower():
            obj["anatomy_regions"] = "head, muzzle, neck, torso, limbs"


def build_neck() -> None:
    if ARMATURE:
        for bone in ARMATURE.data.bones:
            if bone.name.startswith("neck_"):
                bone["anatomy_region"] = "cervical neck"


def build_torso() -> None:
    if ARMATURE:
        for name in ("pelvis_08", "spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012", "hips_0366"):
            if name in ARMATURE.data.bones:
                ARMATURE.data.bones[name]["anatomy_region"] = "torso and pelvis"


def build_front_leg() -> None:
    if ARMATURE:
        for bone in ARMATURE.data.bones:
            if any(token in bone.name for token in ("clavicle_", "upperarm_", "lowerarm_", "hand_")):
                bone["anatomy_region"] = "forelimb"


def build_hind_leg() -> None:
    if ARMATURE:
        for bone in ARMATURE.data.bones:
            if any(token in bone.name for token in ("upperleg_", "lowerleg_", "foot_")):
                bone["anatomy_region"] = "hindlimb"


def build_hooves() -> None:
    # Keep the source hoof meshes; add a single reference-style white hind sock.
    foot = find_bone_world("foot_l_0407")
    fetlock = find_bone_world("lowerleg_l_0406")
    if foot is None or fetlock is None:
        return
    direction = fetlock - foot
    start = foot + direction * 0.14
    end = foot + direction * 0.38
    sock = add_segment_mesh("BODY_WhiteSock_HindLeft", start, end, 0.075, 0.064, MATERIALS["sock"], "01_OUTER_BODY")
    if sock:
        sock["reference_detail"] = "one white hind-leg sock above hoof"


def build_mane() -> None:
    for obj in IMPORTED:
        if obj.type == "MESH" and "hair" in f"{obj.name} {obj.data.name if obj.data else ''}".lower():
            obj["anatomy_region"] = "mane and tail geometry"


def build_tail() -> None:
    if ARMATURE:
        for bone in ARMATURE.data.bones:
            if bone.name.startswith("tail_"):
                bone["anatomy_region"] = "tail"


def add_muscle(name: str, start_name: str, end_name: str, width: float, depth: float, material_key: str = "muscle_a") -> None:
    start = find_bone_world(start_name)
    end = find_bone_world(end_name)
    if start is None or end is None:
        return
    direction = end - start
    length = direction.length
    if length < 0.025:
        return
    # Fusiform geometry follows each muscle's fiber direction; width varies by group.
    add_ellipsoid(name, (start + end) * 0.5, (width, depth, length * 0.61), MATERIALS[material_key], "02_MUSCLES", direction)


def build_muscular_system() -> None:
    pairs = [
        ("MUS_Longissimus_Dorsi", "spine_01_09", "spine_04_012", 0.16, 0.12, "muscle_a"),
        ("MUS_Brachiocephalicus", "neck_01_014", "head_019", 0.12, 0.1, "muscle_b"),
        ("MUS_Splenius", "neck_02_015", "neck_05_018", 0.105, 0.09, "muscle_a"),
        ("MUS_Trapezius", "spine_04_012", "clavicle_l_0203", 0.12, 0.075, "muscle_b"),
        ("MUS_Gluteal_Left", "hips_0366", "upperleg_l_0405", 0.15, 0.12, "muscle_a"),
        ("MUS_Gluteal_Right", "hips_0366", "upperleg_r_0474", 0.15, 0.12, "muscle_b"),
        ("MUS_Quadriceps_Left", "upperleg_l_0405", "lowerleg_l_0406", 0.095, 0.075, "muscle_a"),
        ("MUS_Quadriceps_Right", "upperleg_r_0474", "lowerleg_r_0475", 0.095, 0.075, "muscle_b"),
        ("MUS_Triceps_Left", "clavicle_l_0203", "lowerarm_l_0205", 0.11, 0.085, "muscle_a"),
        ("MUS_Triceps_Right", "clavicle_r_0269", "lowerarm_r_0271", 0.11, 0.085, "muscle_b"),
        ("MUS_Flexor_Left", "lowerarm_l_0205", "hand_l_0206", 0.045, 0.04, "muscle_a"),
        ("MUS_Flexor_Right", "lowerarm_r_0271", "hand_r_0272", 0.045, 0.04, "muscle_b"),
        ("MUS_Semitendinosus_Left", "upperleg_l_0405", "foot_l_0407", 0.08, 0.065, "muscle_b"),
        ("MUS_Semitendinosus_Right", "upperleg_r_0474", "foot_r_0476", 0.08, 0.065, "muscle_a"),
    ]
    for name, start, end, width, depth, material in pairs:
        add_muscle(name, start, end, width, depth, material)

    if MODEL_BOUNDS:
        minimum, maximum = MODEL_BOUNDS
        height = maximum.z - minimum.z
        center = (minimum + maximum) * 0.5
        # Paired pectoral and abdominal masses add broad forms between the rig lines.
        add_ellipsoid("MUS_Pectorals", Vector((center.x + 0.34, center.y, minimum.z + height * 0.48)), (0.24, 0.22, 0.22), MATERIALS["muscle_b"], "02_MUSCLES")
        add_ellipsoid("MUS_Abdominal_Wall", Vector((center.x - 0.04, center.y, minimum.z + height * 0.45)), (0.36, 0.19, 0.12), MATERIALS["muscle_a"], "02_MUSCLES")


def add_bone_chain(chain: list[str]) -> None:
    points = [(name, find_bone_world(name)) for name in chain]
    points = [(name, point) for name, point in points if point is not None]
    for index, (name, start) in enumerate(points[:-1]):
        next_name, end = points[index + 1]
        scale = 0.034 if any(word in name.lower() for word in ("arm", "leg", "foot", "hand")) else 0.026
        add_segment_mesh(f"BONE_{name}_to_{next_name}", start, end, scale, scale * 0.72, MATERIALS["bone"], "03_SKELETON")
        add_ellipsoid(f"BONE_JOINT_{name}", start, (scale * 1.35,) * 3, MATERIALS["bone"], "03_SKELETON")


def build_skeleton() -> None:
    chains = [
        ["pelvis_08", "spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012", "neck_01_014", "neck_02_015", "neck_03_016", "neck_04_017", "neck_05_018", "head_019"],
        ["spine_04_012", "clavicle_l_0203", "upperarm_l_0204", "lowerarm_l_0205", "hand_l_0206"],
        ["spine_04_012", "clavicle_r_0269", "upperarm_r_0270", "lowerarm_r_0271", "hand_r_0272"],
        ["hips_0366", "upperleg_l_0405", "lowerleg_l_0406", "foot_l_0407"],
        ["hips_0366", "upperleg_r_0474", "lowerleg_r_0475", "foot_r_0476"],
        ["tail_01_0367", "tail_02_0368", "tail_03_0369", "tail_04_0370", "tail_05_0371"],
    ]
    for chain in chains:
        add_bone_chain(chain)

    thoracic = [find_bone_world(name) for name in ("spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012")]
    thoracic = [point for point in thoracic if point is not None]
    if len(thoracic) >= 2:
        for rib_index in range(8):
            t = (rib_index + 0.5) / 8
            segment = min(int(t * (len(thoracic) - 1)), len(thoracic) - 2)
            local_t = t * (len(thoracic) - 1) - segment
            root = thoracic[segment].lerp(thoracic[segment + 1], local_t)
            for sign in (-1, 1):
                rib_points = [
                    root,
                    root + Vector((0, sign * 0.16, -0.08)),
                    root + Vector((0, sign * 0.28, -0.22)),
                    root + Vector((0, sign * 0.22, -0.36)),
                ]
                add_curve(f"BONE_Rib_{rib_index + 1:02d}_{'L' if sign < 0 else 'R'}", rib_points, 0.012, MATERIALS["bone"], "03_SKELETON")

    skull = find_bone_world("head_019")
    if skull:
        add_ellipsoid("BONE_Skull_Cranium", skull, (0.13, 0.095, 0.12), MATERIALS["bone"], "03_SKELETON")


def build_organs() -> None:
    if not MODEL_BOUNDS:
        return
    minimum, maximum = MODEL_BOUNDS
    center = (minimum + maximum) * 0.5
    height = maximum.z - minimum.z
    rib_center = Vector((center.x + 0.12, center.y, minimum.z + height * 0.51))
    add_ellipsoid("ORG_Lung_Left", rib_center + Vector((0, -0.12, 0.03)), (0.32, 0.13, 0.22), MATERIALS["organ_a"], "04_ORGANS")
    add_ellipsoid("ORG_Lung_Right", rib_center + Vector((0, 0.12, 0.03)), (0.32, 0.13, 0.22), MATERIALS["organ_b"], "04_ORGANS")
    add_ellipsoid("ORG_Heart", rib_center + Vector((0.2, 0, -0.12)), (0.12, 0.105, 0.15), MATERIALS["organ_a"], "04_ORGANS")
    add_ellipsoid("ORG_Liver", rib_center + Vector((-0.23, 0.03, 0)), (0.22, 0.13, 0.16), MATERIALS["organ_b"], "04_ORGANS")
    add_ellipsoid("ORG_Stomach", rib_center + Vector((-0.28, 0.03, -0.17)), (0.2, 0.13, 0.15), MATERIALS["organ_b"], "04_ORGANS")
    add_ellipsoid("ORG_Kidney_Left", rib_center + Vector((-0.4, -0.09, 0.03)), (0.075, 0.055, 0.1), MATERIALS["organ_a"], "04_ORGANS")
    add_ellipsoid("ORG_Kidney_Right", rib_center + Vector((-0.4, 0.09, 0.03)), (0.075, 0.055, 0.1), MATERIALS["organ_a"], "04_ORGANS")
    add_ellipsoid("ORG_Bladder", rib_center + Vector((-0.48, 0, -0.25)), (0.09, 0.08, 0.1), MATERIALS["organ_b"], "04_ORGANS")

    for loop in range(4):
        points = []
        for index in range(13):
            t = index / 12
            wave = math.sin(t * math.pi * 4 + loop * 0.75)
            points.append(rib_center + Vector((-0.15 - t * 0.32, wave * 0.09, -0.22 + (loop - 1.5) * 0.055)))
        add_curve(f"ORG_Intestinal_Loop_{loop + 1}", points, 0.025, MATERIALS["organ_b"], "04_ORGANS")


def build_blood_vessels() -> None:
    if not MODEL_BOUNDS:
        return
    minimum, maximum = MODEL_BOUNDS
    center = (minimum + maximum) * 0.5
    height = maximum.z - minimum.z
    start = Vector((center.x + 0.23, center.y - 0.02, minimum.z + height * 0.52))
    add_curve("ORG_Aorta", [start, start + Vector((0.12, 0, 0.12)), start + Vector((-0.06, 0, 0.2))], 0.018, MATERIALS["vein_red"], "04_ORGANS")
    add_curve("ORG_Vena_Cava", [start + Vector((-0.05, 0.025, -0.04)), start + Vector((-0.16, 0.025, 0.03)), start + Vector((-0.27, 0.025, 0.07))], 0.016, MATERIALS["vein_blue"], "04_ORGANS")


def refine_outer_body() -> None:
    for obj in IMPORTED:
        if obj.type == "MESH":
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
    # Preserve source silhouette; avoid extra subdivision that would bloat the GLB.


def setup_cameras() -> None:
    if not MODEL_BOUNDS:
        return
    minimum, maximum = MODEL_BOUNDS
    target = (minimum + maximum) * 0.5
    target.z = minimum.z + (maximum.z - minimum.z) * 0.48
    views = {
        "CAM_Side": (Vector((target.x, target.y + 5.5, target.z)), "ORTHO", 3.8),
        "CAM_Front": (Vector((target.x + 4.7, target.y, target.z)), "ORTHO", 2.7),
        "CAM_Back": (Vector((target.x - 4.7, target.y, target.z)), "ORTHO", 2.7),
        "CAM_ThreeQuarter": (Vector((target.x + 3.6, target.y - 4.2, target.z + 1.2)), "PERSP", 0),
    }
    for name, (location, camera_type, ortho_scale) in views.items():
        camera_data = bpy.data.cameras.new(name)
        camera = bpy.data.objects.new(name, camera_data)
        COLLECTIONS["CAMERAS"].objects.link(camera)
        camera.location = location
        camera.rotation_euler = (target - location).to_track_quat("-Z", "Y").to_euler()
        camera_data.type = camera_type
        if camera_type == "ORTHO":
            camera_data.ortho_scale = ortho_scale
        camera_data.lens = 55
        if name == "CAM_Side":
            bpy.context.scene.camera = camera


def setup_lighting() -> None:
    if not MODEL_BOUNDS:
        return
    minimum, maximum = MODEL_BOUNDS
    center = (minimum + maximum) * 0.5
    height = maximum.z - minimum.z
    bpy.ops.mesh.primitive_plane_add(size=200, location=(center.x, center.y, minimum.z - 0.015))
    floor = bpy.context.object
    floor.name = "HELPER_StudioFloor"
    floor.data.materials.append(MATERIALS["floor"])
    move_to_collection(floor, "HELPERS")

    lights = [
        ("LIGHT_Key", Vector((center.x + 1.4, center.y - 3.3, minimum.z + height * 1.25)), 1100, 4.0, (1.0, 0.88, 0.72)),
        ("LIGHT_Fill", Vector((center.x + 0.4, center.y + 3.4, minimum.z + height * 0.82)), 720, 3.5, (0.78, 0.86, 1.0)),
        ("LIGHT_Rim", Vector((center.x - 2.6, center.y + 0.5, minimum.z + height * 1.15)), 950, 3.0, (1.0, 0.94, 0.82)),
    ]
    for name, location, power, size, color in lights:
        data = bpy.data.lights.new(name, "AREA")
        data.energy = power
        data.shape = "DISK"
        data.size = size
        data.color = color
        light = bpy.data.objects.new(name, data)
        COLLECTIONS["LIGHTS"].objects.link(light)
        light.location = location
        light.rotation_euler = (Vector((center.x, center.y, minimum.z + height * 0.52)) - location).to_track_quat("-Z", "Y").to_euler()


def setup_world() -> None:
    world = bpy.data.worlds.new("World_Warm_Neutral") if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.72, 0.68, 0.6, 1)
        background.inputs["Strength"].default_value = 0.7


def validate_scene() -> None:
    required = ("01_OUTER_BODY", "02_MUSCLES", "03_SKELETON", "04_ORGANS")
    empty = [name for name in required if not COLLECTIONS[name].objects]
    if empty:
        raise RuntimeError("Generated collections are empty: " + ", ".join(empty))
    if not COLLECTIONS["01_OUTER_BODY"].objects:
        raise RuntimeError("No outer horse objects were generated.")


def export_objects(objects: list[bpy.types.Object], filepath: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    if objects:
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.export_scene.gltf(filepath=str(filepath), export_format="GLB", use_selection=True)
    bpy.ops.object.select_all(action="DESELECT")


def export_collection(collection_name: str, filepath: Path) -> None:
    export_objects(list(COLLECTIONS[collection_name].all_objects), filepath)


def export_files() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    engine_ids = bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys()
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engine_ids else "BLENDER_EEVEE"
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.camera = bpy.data.objects.get("CAM_Side")

    # The requested side-profile render is the clean outer silhouette first.
    for name in ("02_MUSCLES", "03_SKELETON", "04_ORGANS"):
        COLLECTIONS[name].hide_render = True
    scene.render.filepath = str(OUTPUT_DIR / "horse_side_profile.png")
    bpy.ops.render.render(write_still=True)
    for name in ("02_MUSCLES", "03_SKELETON", "04_ORGANS"):
        COLLECTIONS[name].hide_render = False

    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_DIR / "horse_anatomy_4_layers.blend"))
    outer_objects = []
    for name in ("01_OUTER_BODY", "MANE_TAIL", "EYES", "HOOVES"):
        outer_objects.extend(COLLECTIONS[name].all_objects)
    outer_objects = list({obj.name: obj for obj in outer_objects}.values())
    export_objects(outer_objects, OUTPUT_DIR / "horse_outer.glb")
    export_collection("02_MUSCLES", OUTPUT_DIR / "horse_muscles.glb")
    export_collection("03_SKELETON", OUTPUT_DIR / "horse_skeleton.glb")
    export_collection("04_ORGANS", OUTPUT_DIR / "horse_organs.glb")

    bpy.ops.object.select_all(action="DESELECT")
    complete = [obj for obj in COLLECTIONS["HORSE_MASTER"].all_objects if obj.type not in {"CAMERA", "LIGHT"} and obj.name != "HELPER_StudioFloor"]
    for obj in complete:
        obj.select_set(True)
    if complete:
        bpy.context.view_layer.objects.active = complete[0]
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT_DIR / "horse_complete.glb"), export_format="GLB", use_selection=True)
    bpy.ops.object.select_all(action="DESELECT")


def main() -> None:
    clear_scene()
    create_collections()
    create_materials()
    build_horse_blockout()
    build_head()
    build_neck()
    build_torso()
    build_front_leg()
    build_hind_leg()
    build_hooves()
    build_mane()
    build_tail()
    refine_outer_body()
    build_muscular_system()
    build_skeleton()
    build_organs()
    build_blood_vessels()
    setup_cameras()
    setup_lighting()
    setup_world()
    validate_scene()
    export_files()
    print(f"Horse anatomy project exported to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
