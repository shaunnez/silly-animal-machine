"""Shared local-space clips for the Pocket biped rig.

Fitted meshes share names/rest-axis conventions. These curves deliberately contain
no travel: the garden owns paths and synchronizes contact with props. Different
proportions still require fitting and visual review, especially knees and faces.
"""
import math
import bpy

CLIP_SECONDS = {"Idle": 4.8, "Walk": 1.2, "Eat": 3.2, "Play": 1.2, "Magic": 3.2, "Celebrate": 1.6}


def pulse(t: float, center: float, width: float) -> float:
    return .5 + .5 * math.cos(math.pi * min(1.0, abs(t - center) / width))


def build_clips(rig: bpy.types.Object, closed_jaw: float = .29, motion_scale: float = 1, jaw_motion: float = .29) -> list[bpy.types.Action]:
    """Author six clips against the fitted Pocket biped skeleton at 30 FPS."""
    clips = []
    for name, duration in CLIP_SECONDS.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        end = round(duration * 30) + 1
        for frame in range(1, end + 1):
            seconds = (frame - 1) / 30
            t = seconds / duration
            wave = math.sin(t * math.tau)
            envelope = math.sin(t * math.pi) ** 2
            p = rig.pose.bones
            for bone in p:
                bone.rotation_mode = "XYZ"
                bone.rotation_euler = (0, 0, 0)
                bone.location = (0, 0, 0)
                bone.scale = (1, 1, 1)
            p["Jaw"].rotation_euler.x = closed_jaw
            p["Head"].rotation_euler.y = .045 * wave
            p["Tail"].rotation_euler.z = .09 * wave
            p["TailTip"].rotation_euler.z = .12 * math.sin(t * math.tau - .3) * envelope
            p["Spine"].scale.y = 1 + .015 * wave
            blink = pulse(seconds, duration * .67, .14)
            if name == "Walk":
                # Two alternating steps per 1.2 seconds; local bone Y is vertical.
                for side, sign in [("L", 1), ("R", -1)]:
                    stride = wave * sign
                    p[f"Leg_{side}"].rotation_euler.x = .32 * stride
                    p[f"Foot_{side}"].rotation_euler.x = -.10 * max(0, stride)
                    p[f"Arm_{side}"].rotation_euler.x = -.20 * stride
                p["Root"].location.y = .012 * (1 - math.cos(t * math.tau * 2))
                p["Pelvis"].rotation_euler.z = .045 * wave
                p["Head"].rotation_euler.x = .035 * math.sin(t * math.tau * 2)
            elif name == "Eat":
                reach = math.sin(min(seconds / .6, 1) * math.pi / 2) * min(1, (duration - seconds) / .4)
                p["Arm_L"].rotation_euler.x = .32 * reach
                p["Arm_R"].rotation_euler.x = .32 * reach
                p["Head"].rotation_euler.x = .10 * envelope
                # Open as the apple arrives, chew, and close again before returning.
                chew = sum(pulse(seconds, c, .22) for c in [1.0, 1.55, 2.1])
                opening = min(1, seconds / .45) * min(1, (duration - seconds) / .6)
                p["Jaw"].rotation_euler.x = closed_jaw - jaw_motion * opening * (1 - chew)
                blink = max(blink, .5 * chew)
            elif name == "Play":
                # Foot contact at .45 seconds, then follow-through and recovery.
                kick = pulse(seconds, .45, .42)
                p["Leg_L"].rotation_euler.x = -.45 * kick
                p["Foot_L"].rotation_euler.x = .10 * kick
                p["Root"].location.y = .012 * kick
                p["Spine"].rotation_euler.x = -.075 * kick
                p["Arm_L"].rotation_euler.z = .20 * envelope
                p["Arm_R"].rotation_euler.z = -.20 * envelope
            elif name == "Celebrate":
                p["Head"].rotation_euler.z = .10 * wave
                p["Arm_L"].rotation_euler.z = .25 * envelope
                p["Arm_R"].rotation_euler.z = -.25 * envelope
                p["Tail"].rotation_euler.z = .24 * math.sin(t * math.tau * 2)
                blink = max(blink, .6 * envelope)
            elif name == "Magic":
                p["Head"].rotation_euler.x = -.08 * envelope
                p["Arm_L"].rotation_euler.z = .22 * envelope
                p["Arm_R"].rotation_euler.z = -.22 * envelope
                p["Jaw"].rotation_euler.x = closed_jaw - jaw_motion * .83 * envelope
            for side in ["L", "R"]:
                p[f"Eye_{side}"].scale.y = 1 - .94 * blink
            for bone in p:
                if bone.name != 'Jaw':
                    bone.rotation_euler = tuple(v * motion_scale for v in bone.rotation_euler)
                for path in ["rotation_euler", "location", "scale"]:
                    bone.keyframe_insert(data_path=path, frame=frame, group=bone.name)
        action.use_frame_range = True
        action.frame_start = 1
        action.frame_end = end
        clips.append(action)
    return clips
