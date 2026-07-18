// The smooth-camera height construction -- the floating-point port of Java's
// cam_follow/cam_kernel/cam_maxlift/cam_sample (CONTEXT.md section 7g):
//
//   lifted(i) = min( max of the rail over [i-W .. i+W],  rail(i) + lift )   (W = lift columns)
//   height    = triangle_smooth( lifted )               floored at the RAW rail
//
// ONE continuous operation. `lifted` is the ideal envelope -- level on flats
// (there the max == the rail, so the min is the rail), parallel `+lift`
// mid-slope (there rail+lift is the lower one), and it holds the flat OVER a
// convex top (a descent lip) with no vertical overshoot, `lift` being the
// clearance budget. It has hard corners; a single **triangle-kernel
// convolution** (weights H-|j|, H = CAMBLEND/2) rounds ALL of them at once
// into one smooth curve. Because it is a single symmetric smoothing, every
// ramp end -- top and bottom, climb and descent -- eases with the same shape
// and a horizontal tangent: launch level off the top, ride parallel, then
// DECELERATE onto the flat at the bottom. No seam, no notch, no hard landing.
//
// The two knobs that make it clean:
//   * the max window is +/-W with W = lift COLUMNS (CAMLIFT/10), i.e. it looks
//     exactly `lift` ahead -- just enough to establish the float on a 45-degree
//     slope. The old +2 margin over-anticipated and bulged the ramp bottoms.
//   * the floor is the RAW rail (never the smoothed curve), so flats stay
//     exactly level and the rig can never sink into the track.
//
// STATELESS AND SYMMETRIC BY CONSTRUCTION: the height at a rig position is a
// pure function of that position and the fixed recorded profile -- no time
// state, no travel-direction term -- so REVERSE retraces the exact path
// FORWARD took (max |fwd-rev| == 0), and the symmetric windows treat a climb
// and a descent identically.
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
  const W = Math.floor(lift10 / 10);       // max window = lift, in columns
  const H = Math.max(1, Math.floor(blend / 2)); // triangle half-width (H=1 -> no smoothing)

  // The lifted envelope at column i: rail raised to `lift` on slopes, the max
  // over +/-W holding the flat level over convex tops.
  const lifted = (i) => {
    let mx = -Infinity;
    for (let k = -W; k <= W; k++) {
      const v = lineAt(i + k);
      if (v > mx) mx = v;
    }
    return Math.min(mx, lineAt(i) + lift);
  };

  // Triangle-kernel convolution (weights H-|j|), the single smoothing pass.
  let num = 0, den = 0;
  for (let j = -(H - 1); j <= H - 1; j++) {
    const w = H - Math.abs(j);
    num += w * lifted(index + j);
    den += w;
  }
  const c1 = num / den;

  const line = lineAt(index); // RAW rail for the floor
  return { sy: Math.max(c1, line), line };
}
