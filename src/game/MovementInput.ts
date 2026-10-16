import { MOVEMENT } from './GameConfig';

/** Convert screen axes to world axes without changing the analog magnitude. */
export function cameraRelativeMovement(x: number, z: number, yaw: number) {
  const length = Math.max(1, Math.hypot(x, z));
  return { x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / length, z: (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length };
}

/** A radial dead zone prevents resting fingers from moving the survivor. */
export function joystickMovement(x: number, z: number) {
  const length = Math.hypot(x, z), normalized = Math.min(1, length / MOVEMENT.joystickRadius);
  if (normalized <= MOVEMENT.joystickDeadZone) return { x: 0, z: 0 };
  const strength = (normalized - MOVEMENT.joystickDeadZone) / (1 - MOVEMENT.joystickDeadZone);
  return { x: x / length * strength, z: z / length * strength };
}
