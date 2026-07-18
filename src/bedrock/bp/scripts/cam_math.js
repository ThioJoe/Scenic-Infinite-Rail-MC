// The smooth-camera height construction -- the floating-point port of Java's
// cam_follow/cam_scan (CONTEXT.md section 7g):
//
//   line(i)   = the recorded rail profile, interpolated by the pace fraction
//   maxRail   = max of line over the SYMMETRIC [i-wmax-1 .. i+wmax] window
//   height    = max( softmin(maxRail, line(i)+lift, k),  line(i) )
//
// The two lines the camera is built from are the "higher-ground" line
// `maxRail` (the flat/crest the camera rides toward, rising just before a
// slope) and the parallel line `line+lift` (exactly `lift` above the rail).
// Their lower envelope min(maxRail, line+lift) is the ideal path: level on
// flats (maxRail == line there), parallel `+lift` mid-slope (line+lift is the
// lower one), and it holds the flat OVER a convex top (the descent lip) with
// NO vertical overshoot -- `lift` is the clearance budget. The one flaw of
// that envelope is a hard corner where the two lines cross; a SOFT-min rounds
// that corner into a sigmoid WITHOUT cutting below it, so a descent launches
// off the lip with a horizontal tangent and eases onto the parallel line
// instead of kinking down into the rail. `k` (the corner half-width, from
// CAMBLEND) sets how long that ease is. A final floor at the rail line keeps
// the rig from ever sinking into the track.
//
// Why a soft-min and not the old box-average: a mean smooths corners but is
// ONE-SIDED -- it cuts convex corners (a descent top) DOWN while filling
// concave ones (the bottom) UP, so the floor turned the cut into a visible
// notch that hugged the descending rail for ~0.2 block right at the lip (the
// "bump"/clip at descent tops). The soft-min rounds both corner directions
// symmetrically and never undershoots the envelope, so tops and bottoms are
// treated identically.
//
// STATELESS AND SYMMETRIC BY CONSTRUCTION: the height at a rig position is a
// pure function of that position and the fixed recorded profile -- no time
// state, no travel-direction term -- so REVERSE retraces the exact path
// FORWARD took over the same terrain (max |fwd-rev| == 0). maxRail is a
// symmetric window (it looks the same distance each way), so a climb and a
// descent are treated identically: the camera floats `lift` above the rail on
// any slope, arcs over corners and valleys, and rides flats exactly on the
// line.
//
// This file is deliberately engine-free (no @minecraft/server import): it is
// used by scripts/main.js in-game AND imported by tests/simulate.mjs, so the
// regression test exercises the exact math that ships.

// Smooth minimum (Inigo Quilez's polynomial smin): rounds the corner where a
// and b cross, staying at or below min(a,b) by up to k/4 and reproducing
// min(a,b) exactly once they are more than k apart. k <= 0 degrades to a hard
// min (no rounding).
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
  // Corner half-width. Derived from CAMBLEND so the knob keeps its "blend
  // length" meaning (default 6 -> k = 1.5, a ~3-block ease on a 45-degree
  // slope); higher = a longer, gentler ease-in/out.
  const k = blend / 4;

  const lineHere = lineAt(index);

  // maxRail: the highest interpolated rail over the symmetric window. Scanning
  // further than the lift cap can reach is pointless, which is why the window
  // is only wmax wide.
  let mx = -Infinity;
  for (let kk = -wmax - 1; kk <= wmax; kk++) {
    const v = lineAt(index + kk);
    if (v > mx) mx = v;
  }

  const c1 = softmin(mx, lineHere + lift, k);
  return { sy: Math.max(c1, lineHere), line: lineHere };
}
