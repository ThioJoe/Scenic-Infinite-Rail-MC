// The smooth-camera height construction -- the floating-point port of Java's
// cam_follow/cam_blend/cam_scan/cam_sample (CONTEXT.md section 7g):
//
//   line(i)   = the recorded rail profile, interpolated by the pace fraction
//   lifted(j) = min( max of line over [j-wmax-1 .. j+wmax],  line(j) + lift )
//   c1        = average of lifted() over the symmetric +/-blend/2 window
//   height    = max(c1, line(rig))               (never below the rail line)
//
// STATELESS AND SYMMETRIC BY CONSTRUCTION: the height at a rig position is a
// pure function of that position and the fixed recorded profile -- no time
// state, no travel-direction term -- so REVERSE retraces the exact path
// FORWARD took over the same terrain (max |fwd-rev| == 0). The lifted() max
// is symmetric (it looks the same distance each way), so a climb and a
// descent are treated identically: the camera floats `lift` above the rail
// on any slope, arcing over corners and valleys, and rides flats exactly on
// the line. This replaced an earlier design whose descents were carried by a
// reactive exponential chaser (`c2`, eased toward the line by 1/CAMSMOOTH per
// tick): that term was the ONE piece of state, and it made a forward descent
// float high while the reverse pass over it collapsed onto the bare rail line
// and clipped the track (the "reverse sinks into descents" report). Dropping
// it -- and widening the max to a symmetric window so descents still float --
// makes the two directions identical.
//
// This file is deliberately engine-free (no @minecraft/server import): it is
// used by scripts/main.js in-game AND imported by tests/simulate.mjs, so the
// regression test exercises the exact math that ships.

export function camHeight({ trackY, index, fx, lift10, blend }) {
  const maxi = trackY.length - 1;
  const lineAt = (i) => {
    const a = trackY[Math.min(Math.max(i, 0), maxi)];
    const b = trackY[Math.min(Math.max(i + 1, 0), maxi)];
    return a * (1 - fx) + b * fx;
  };

  const lift = lift10 / 10;
  const wmax = Math.floor(lift10 / 10) + 2;
  const half = Math.floor(blend / 2);

  const lineHere = lineAt(index);

  let sum = 0, n = 0;
  for (let j = -half; j <= half; j++) {
    let mx = -Infinity;
    for (let k = -wmax - 1; k <= wmax; k++) {   // SYMMETRIC max (both directions)
      const v = lineAt(index + j + k);
      if (v > mx) mx = v;
    }
    sum += Math.min(mx, lineAt(index + j) + lift);
    n += 1;
  }
  const c1 = sum / n;

  return { sy: Math.max(c1, lineHere), line: lineHere };
}
