// The smooth-camera height construction -- the floating-point port of Java's
// cam_follow/cam_blend/cam_scan/cam_sample (CONTEXT.md section 7g):
//
//   line(i)   = the recorded rail profile, interpolated by the pace fraction
//   lifted(j) = min( max of line over [j .. j+wmax+1],  line(j) + lift )
//   c1        = average of lifted() over the symmetric +/-blend/2 window
//   s2       += (line(rig) - s2) / smooth        (reactive descent chaser)
//   height    = max(c1, s2, line(rig))           (never below the rail line)
//
// This file is deliberately engine-free (no @minecraft/server import): it is
// used by scripts/main.js in-game AND imported by tests/simulate.mjs, so the
// regression test exercises the exact math that ships.

export function camHeight({ trackY, index, fx, lift10, blend, smooth, s2 }) {
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
    let fmx = -Infinity;
    for (let k = 0; k <= wmax; k++) {
      const v = lineAt(index + j + k);
      if (v > fmx) fmx = v;
    }
    sum += Math.min(fmx, lineAt(index + j) + lift);
    n += 1;
  }
  const c1 = sum / n;

  const s2n = s2 + (lineHere - s2) / Math.max(smooth, 1);

  return { sy: Math.max(c1, s2n, lineHere), s2: s2n, line: lineHere };
}
