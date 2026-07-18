// The smooth-camera height construction -- the floating-point port of Java's
// cam_follow/cam_scan (CONTEXT.md section 7g):
//
//   sline(i)  = the recorded rail profile, PRE-SMOOTHED over +/-s columns
//   maxLine   = max of sline over the SYMMETRIC [i-wmax-1 .. i+wmax] window
//   height    = max( softmin(maxLine, sline(i)+lift, k),  rawLine(i) )
//
// The camera is built from two lines: the "higher-ground" line `maxLine` (the
// flat/crest it rides toward, rising just before a slope) and the parallel
// line `sline+lift` (exactly `lift` above the rail). Their lower envelope
// min(maxLine, sline+lift) is the ideal path: level on flats (maxLine == sline
// there), parallel `+lift` mid-slope, and it holds the flat OVER a convex top
// (a descent lip) with NO vertical overshoot -- `lift` is the clearance budget.
//
// TWO things are smoothed, because a ramp has two kinds of corner and both must
// ease with a HORIZONTAL tangent:
//   * the CONVEX corners (a descent top / ascent top) are where `maxLine` and
//     `sline+lift` CROSS -- a `softmin` rounds that crossing without cutting
//     below it, so the camera launches off the lip level and eases onto the
//     slope (no notch, no rail-hug);
//   * the CONCAVE corners (a descent bottom / ascent bottom) are where the two
//     lines' OWN kinks live (maxLine's rolling-max edge, and sline+lift where
//     the rail flattens) -- PRE-SMOOTHING the profile (`sline`) rounds those,
//     so the camera decelerates onto the flat instead of riding a hard edge
//     down and slamming level.
// A single soft-min alone fixes only the convex corners and leaves the concave
// ones landing hard (the "upside-down"/vertical-lift bottom); the pre-smooth is
// what makes the bottom a real landing. The final floor is at the RAW rail line
// (never the smoothed one), so flats stay exactly level and the rig never sinks
// into the track.
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

// Smooth minimum (Inigo Quilez's polynomial smin): rounds the corner where a
// and b cross, staying at or below min(a,b) by up to k/4 and reproducing
// min(a,b) exactly once they are more than k apart. k <= 0 => a hard min.
function softmin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function camHeight({ trackY, index, fx, lift10, blend }) {
  const maxi = trackY.length - 1;
  const lineAt = (i) => {
    const a = trackY[Math.min(Math.max(i, 0), maxi)];
    const b = trackY[Math.min(Math.max(i + 1, 0), maxi)];
    return a * (1 - fx) + b * fx;
  };

  const lift = lift10 / 10;
  const wmax = Math.floor(lift10 / 10) + 2;
  // From CAMBLEND: k = the soft-min corner half-width (rounds the convex
  // crossing), s = the profile pre-smoothing radius (rounds the concave
  // corners). Default 6 -> k = 1.5, s = 2.
  const k = blend / 4;
  const s = Math.round(blend / 4);
  // The profile pre-smoothed over +/-s columns (a plain box average). On flats
  // and straight slopes this is identical to the raw line (an average of a
  // constant or a line is itself), so it only rounds the corners.
  const sline = (i) => {
    if (s <= 0) return lineAt(i);
    let sum = 0;
    for (let j = -s; j <= s; j++) sum += lineAt(i + j);
    return sum / (2 * s + 1);
  };

  // maxLine over the symmetric window, taken on the SMOOTHED profile.
  let mx = -Infinity;
  for (let kk = -wmax - 1; kk <= wmax; kk++) {
    const v = sline(index + kk);
    if (v > mx) mx = v;
  }

  const c1 = softmin(mx, sline(index) + lift, k);
  const line = lineAt(index); // RAW rail for the floor
  return { sy: Math.max(c1, line), line };
}
