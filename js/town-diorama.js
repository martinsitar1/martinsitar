/**
 * Sant Cugat 3D Isometric Miniature Diorama Animation
 * Renders a smooth 60fps looping 3D-styled animation on top of the light/dark
 * transparent town renders (commuter train, miniature cars, walking pedestrians,
 * foreground tree/roof/catenary occlusion, and volumetric 3D clouds + cloud shadows).
 */
(function () {
  const canvas = document.getElementById('town-diorama');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Logical coordinate system of all paths & geometry
  const W = 2048;
  const H = 2048;

  // Tight viewport crop around the 3D miniature island so it fills the exact
  // page content width without excess whitespace
  const VIEW_X = 44;
  const VIEW_Y = 124;
  const VIEW_W = 1860;
  const VIEW_H = 1784;

  // Efficient Retina canvas buffer size (1.5x of 768px content column)
  const CW = 1152;
  const CH = 1105;
  canvas.width = CW;
  canvas.height = CH;

  // Offscreen foreground occluder resolution (matches 1200x1200 source images)
  const OCC_SIZE = 1200;

  // Lazy-loaded light and dark transparent town renders (~305KB AVIF with PNG fallback)
  const imgLight = new Image();
  const imgDark = new Image();
  let lightRequested = false;
  let darkRequested = false;
  let lightReady = false;
  let darkReady = false;

  // Offscreen foreground occluder canvases (trees, Mercat Vell roof, upper forest)
  let fgLightCanvas = null;
  let fgDarkCanvas = null;

  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
  let isDark = darkMedia.matches;

  function requestThemeImage(dark) {
    if (dark && !darkRequested) {
      darkRequested = true;
      imgDark.onerror = () => {
        imgDark.onerror = null;
        imgDark.src = 'img/cg-blk-nobg.png';
      };
      imgDark.src = 'img/cg-blk-nobg.avif';
    } else if (!dark && !lightRequested) {
      lightRequested = true;
      imgLight.onerror = () => {
        imgLight.onerror = null;
        imgLight.src = 'img/cg-wht-nobg.png';
      };
      imgLight.src = 'img/cg-wht-nobg.avif';
    }
  }

  darkMedia.addEventListener('change', (e) => {
    isDark = e.matches;
    requestThemeImage(isDark);
  });

  imgLight.onload = () => {
    lightReady = true;
    fgLightCanvas = buildForegroundOccluder(imgLight);
  };
  imgDark.onload = () => {
    darkReady = true;
    fgDarkCanvas = buildForegroundOccluder(imgDark);
  };

  // Only fetch the active theme image on initial page load (~305KB)
  requestThemeImage(isDark);

  /**
   * Builds an offscreen canvas containing only the foreground elements that should
   * naturally occlude the animated train, cars, and pedestrians:
   *  1. Upper-left cypress tree & hillside forest (where the train enters/exits)
   *  2. Lower train track wooden portal arch
   *  3. Mercat Vell building & dark pitched roof (occluding Monastery Street behind it)
   *  4. Outer roadside verge & tree canopies along the main perimeter road
   *  5. Deciduous tree canopies in the cobblestone plaza
   */
  function buildForegroundOccluder(sourceImg) {
    const off = document.createElement('canvas');
    off.width = OCC_SIZE;
    off.height = OCC_SIZE;
    const octx = off.getContext('2d');
    const sc = OCC_SIZE / W;

    // Read source pixels in the plaza/roadside sub-region to extract green tree canopy tips
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = OCC_SIZE;
    srcCanvas.height = OCC_SIZE;
    const sctx = srcCanvas.getContext('2d');
    sctx.drawImage(sourceImg, 0, 0, OCC_SIZE, OCC_SIZE);

    function clipPolygon(pts) {
      octx.save();
      octx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) octx.moveTo(pts[i][0] * sc, pts[i][1] * sc);
        else octx.lineTo(pts[i][0] * sc, pts[i][1] * sc);
      }
      octx.closePath();
      octx.clip();
      octx.drawImage(sourceImg, 0, 0, OCC_SIZE, OCC_SIZE);
      octx.restore();
    }

    // 1. Cypress tree + upper hillside forest occluding the train track top entry
    clipPolygon([
      [325, 410],
      [510, 410],
      [510, 600],
      [336, 590],
      [333, 558],
      [325, 515]
    ]);

    // 2. Wooden portal beam & right post at the bottom of the train track
    clipPolygon([
      [86, 1183],
      [135, 1183],
      [135, 1194],
      [86, 1194]
    ]);
    clipPolygon([
      [123, 1183],
      [136, 1183],
      [136, 1218],
      [123, 1218]
    ]);

    // 3. Mercat Vell building & roof (occluding Monastery Street behind it)
    clipPolygon([
      [1140, 1275],
      [1185, 1215],
      [1298, 1205],
      [1432, 1280],
      [1432, 1465],
      [1195, 1595],
      [995, 1490]
    ]);

    // 4. Outer roadside verge & tree clusters below the main perimeter road curb
    clipPolygon([
      [220, 1380],
      [500, 1510],
      [920, 1712],
      [955, 1724],
      [990, 1728],
      [1025, 1724],
      [1065, 1712],
      [1195, 1660],
      [1350, 1584],
      [1535, 1490],
      [1615, 1471],
      [1700, 1442],
      [1900, 1352],
      [1900, 1895],
      [220, 1895]
    ]);

    // 5. Extract green tree canopy foliage in the plaza & roadside zones
    const boxX = Math.floor(220 * sc);
    const boxY = Math.floor(1020 * sc);
    const boxW = Math.ceil(1675 * sc);
    const boxH = Math.ceil(740 * sc);
    const srcData = sctx.getImageData(boxX, boxY, boxW, boxH);
    const dstData = octx.getImageData(boxX, boxY, boxW, boxH);
    const s = srcData.data;
    const d = dstData.data;

    for (let i = 0; i < s.length; i += 4) {
      const r = s[i], g = s[i + 1], b = s[i + 2], a = s[i + 3];
      if (a > 120 && g > r + 4 && g > b + 9) {
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = a;
      }
    }
    octx.putImageData(dstData, boxX, boxY);

    return off;
  }

  // ============================================================================
  // SPLINE & ARC-LENGTH PATH UTILITIES
  // ============================================================================
  function createArcLengthSpline(points, tension = 0.5, samples = 800) {
    // Catmull-Rom spline evaluation
    function evalCatmullRom(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      const f0 = -tension * t3 + 2 * tension * t2 - tension * t;
      const f1 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
      const f2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t;
      const f3 = tension * t3 - tension * t2;
      return [
        f0 * p0[0] + f1 * p1[0] + f2 * p2[0] + f3 * p3[0],
        f0 * p0[1] + f1 * p1[1] + f2 * p2[1] + f3 * p3[1]
      ];
    }

    const n = points.length - 1;
    const lut = [];
    let totalLen = 0;
    let prev = points[0];
    lut.push({ s: 0, x: prev[0], y: prev[1], tx: 0, ty: 1 });

    for (let i = 1; i <= samples; i++) {
      const u = (i / samples) * n;
      const seg = Math.min(n - 1, Math.floor(u));
      const localT = u - seg;
      const p0 = points[Math.max(0, seg - 1)];
      const p1 = points[seg];
      const p2 = points[Math.min(n, seg + 1)];
      const p3 = points[Math.min(n, seg + 2)];
      const pt = evalCatmullRom(p0, p1, p2, p3, localT);
      const dx = pt[0] - prev[0];
      const dy = pt[1] - prev[1];
      const dist = Math.hypot(dx, dy);
      totalLen += dist;
      lut.push({ s: totalLen, x: pt[0], y: pt[1], tx: dx, ty: dy });
      prev = pt;
    }

    // Normalize tangents
    for (let i = 0; i < lut.length; i++) {
      const prevPt = lut[Math.max(0, i - 1)];
      const nextPt = lut[Math.min(lut.length - 1, i + 1)];
      const dx = nextPt.x - prevPt.x;
      const dy = nextPt.y - prevPt.y;
      const len = Math.hypot(dx, dy) || 1;
      lut[i].tx = dx / len;
      lut[i].ty = dy / len;
    }

    return {
      totalLength: totalLen,
      getPointAt(s) {
        if (s <= 0) return lut[0];
        if (s >= totalLen) return lut[lut.length - 1];
        // Binary search in LUT
        let lo = 0, hi = lut.length - 1;
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1;
          if (lut[mid].s < s) lo = mid;
          else hi = mid;
        }
        const a = lut[lo];
        const b = lut[hi];
        const t = (s - a.s) / ((b.s - a.s) || 1);
        const tx = a.tx + (b.tx - a.tx) * t;
        const ty = a.ty + (b.ty - a.ty) * t;
        const tLen = Math.hypot(tx, ty) || 1;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          tx: tx / tLen,
          ty: ty / tLen
        };
      }
    };
  }

  // ============================================================================
  // 1. COMMUTER TRAIN (FGC Catalan Style 3-Car Articulated EMU)
  // ============================================================================
  const trainTrackSpline = createArcLengthSpline([
    [475, 464],
    [425, 498],
    [380, 528],
    [335, 558],
    [318, 570],
    [248, 618],
    [190, 665],
    [148, 715],
    [123, 765],
    [113, 820],
    [110, 880],
    [110, 950],
    [111, 1025],
    [112, 1100],
    [112, 1170]
  ]);

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function drawCommuterTrain(timeSec) {
    // 26-second smooth shuttle cycle:
    // 0..10s: emerges from upper forest and glides down to terminus station
    // 10..13s: stopped at terminus station
    // 13..23s: departs station and glides smoothly back up into the forest
    // 23..26s: hidden inside upper forest before next arrival
    const period = 26.0;
    const phase = (timeSec % period) / period;

    const sHiddenTop = 105; // Completely behind the cypress tree & forest
    const sStationStop = trainTrackSpline.totalLength - 8;

    let headS = sHiddenTop;
    let movingForward = true; // true = moving down toward station, false = moving up toward forest

    if (phase < 0.38) {
      const p = easeInOutCubic(phase / 0.38);
      headS = sHiddenTop + p * (sStationStop - sHiddenTop);
      movingForward = true;
    } else if (phase < 0.50) {
      headS = sStationStop;
      movingForward = false;
    } else if (phase < 0.88) {
      const p = easeInOutCubic((phase - 0.50) / 0.38);
      headS = sStationStop - p * (sStationStop - sHiddenTop);
      movingForward = false;
    } else {
      return; // Completely inside the forest tunnel
    }

    const numCars = 3;
    const carLen = 46;
    const carGap = 6;
    const carStride = carLen + carGap;
    const halfW = 7.4;
    const wallH = 12.5;
    const roofH = 15.0;

    // Collect cars with bogie positions
    const cars = [];
    for (let c = 0; c < numCars; c++) {
      const centerS = headS - c * carStride;
      const frontBogie = trainTrackSpline.getPointAt(centerS + carLen * 0.34);
      const rearBogie = trainTrackSpline.getPointAt(centerS - carLen * 0.34);
      const cx = (frontBogie.x + rearBogie.x) * 0.5;
      const cy = (frontBogie.y + rearBogie.y) * 0.5;
      let tx = frontBogie.x - rearBogie.x;
      let ty = frontBogie.y - rearBogie.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      // Normal pointing to the right-hand side of the track (toward town/east)
      const nx = -ty;
      const ny = tx;
      cars.push({ c, centerS, cx, cy, tx, ty, nx, ny });
    }

    // Sort back-to-front by screen Y so isometric overlap is accurate
    const sortedCars = cars.slice().sort((a, b) => a.cy - b.cy);

    // 1. Cast shadows on track ballast
    ctx.save();
    for (const car of sortedCars) {
      if (car.centerS < 45) continue;
      ctx.beginPath();
      const sOffX = 7.5, sOffY = 4.5;
      const hl = carLen * 0.52;
      const hw = halfW + 1.2;
      const pFL = [car.cx + car.tx * hl - car.nx * hw + sOffX, car.cy + car.ty * hl - car.ny * hw + sOffY];
      const pFR = [car.cx + car.tx * hl + car.nx * hw + sOffX, car.cy + car.ty * hl + car.ny * hw + sOffY];
      const pRR = [car.cx - car.tx * hl + car.nx * hw + sOffX, car.cy - car.ty * hl + car.ny * hw + sOffY];
      const pRL = [car.cx - car.tx * hl - car.nx * hw + sOffX, car.cy - car.ty * hl - car.ny * hw + sOffY];
      ctx.moveTo(pFL[0], pFL[1]);
      ctx.lineTo(pFR[0], pFR[1]);
      ctx.lineTo(pRR[0], pRR[1]);
      ctx.lineTo(pRL[0], pRL[1]);
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.52)' : 'rgba(28, 24, 18, 0.34)';
      ctx.fill();
    }
    ctx.restore();

    // 2. Headlight beam on tracks ahead of leading car
    const leadCar = movingForward ? cars[0] : cars[numCars - 1];
    const beamDir = movingForward ? 1 : -1;
    if (leadCar.centerS > 75) {
      const noseX = leadCar.cx + leadCar.tx * (carLen * 0.52 * beamDir);
      const noseY = leadCar.cy + leadCar.ty * (carLen * 0.52 * beamDir);
      const beamX = noseX + leadCar.tx * (44 * beamDir);
      const beamY = noseY + leadCar.ty * (44 * beamDir);
      const grad = ctx.createLinearGradient(noseX, noseY, beamX, beamY);
      grad.addColorStop(0, isDark ? 'rgba(255, 232, 165, 0.42)' : 'rgba(255, 240, 190, 0.25)');
      grad.addColorStop(1, 'rgba(255, 232, 165, 0)');
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(noseX - leadCar.nx * 4, noseY - leadCar.ny * 4);
      ctx.lineTo(beamX - leadCar.nx * 14, beamY - leadCar.ny * 14);
      ctx.lineTo(beamX + leadCar.nx * 14, beamY + leadCar.ny * 14);
      ctx.lineTo(noseX + leadCar.nx * 4, noseY + leadCar.ny * 4);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // Helper to map local car coordinates (u along length, v across width, z height)
    function pt3D(car, u, v, z) {
      return [
        car.cx + car.tx * u + car.nx * v,
        car.cy + car.ty * u + car.ny * v - z
      ];
    }

    function fillQuad(p1, p2, p3, p4, color, strokeColor) {
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }

    // 3. Draw coupled gangway bellows & cars back-to-front
    for (const car of sortedCars) {
      if (car.centerS < 45) continue;

      const hl = carLen * 0.5;
      const hw = halfW;

      // Draw articulated dark accordion gangway to previous car if applicable
      if (car.c > 0) {
        const prevCar = cars[car.c - 1];
        const g1L = pt3D(car, hl, -hw * 0.78, 2);
        const g1R = pt3D(car, hl, hw * 0.78, 2);
        const g2R = pt3D(prevCar, -hl, hw * 0.78, 2);
        const g2L = pt3D(prevCar, -hl, -hw * 0.78, 2);
        const g1Lt = pt3D(car, hl, -hw * 0.72, wallH + 1);
        const g1Rt = pt3D(car, hl, hw * 0.72, wallH + 1);
        const g2Rt = pt3D(prevCar, -hl, hw * 0.72, wallH + 1);
        const g2Lt = pt3D(prevCar, -hl, -hw * 0.72, wallH + 1);
        fillQuad(g1L, g1R, g2R, g2L, '#2c2f34');
        fillQuad(g1L, g2L, g2Lt, g1Lt, '#3f434a');
        fillQuad(g1R, g2R, g2Rt, g1Rt, '#272a2f');
        fillQuad(g1Lt, g1Rt, g2Rt, g2Lt, '#52565e');
      }

      // Undercarriage / wheel bogies
      for (const bU of [-hl * 0.62, hl * 0.62]) {
        const b1 = pt3D(car, bU - 5.5, -hw * 0.92, 0.5);
        const b2 = pt3D(car, bU + 5.5, -hw * 0.92, 0.5);
        const b3 = pt3D(car, bU + 5.5, hw * 0.92, 0.5);
        const b4 = pt3D(car, bU - 5.5, hw * 0.92, 0.5);
        fillQuad(b1, b2, b3, b4, '#25282c');
      }

      // Determine which side faces are visible and draw back-to-front
      // Left side is v = -hw (outer curve, facing top-left sun -> brightly lit!)
      // Right side is v = +hw (inner curve, facing town/bottom-right -> shaded!)
      const leftWallColor = isDark ? '#ded6c9' : '#f2ece1';
      const rightWallColor = isDark ? '#b8afa2' : '#d2c8ba';
      const endWallColor = isDark ? '#cac1b4' : '#e4dcd0';
      const roofColor = isDark ? '#e6dfd3' : '#faf6ee';
      const stripeLit = '#df5b26';
      const stripeShade = '#b44519';
      const winColor = isDark ? '#f2c678' : '#2b3540';

      // Draw both long sides sorted by screen depth of their midpoint
      const midLeft = pt3D(car, 0, -hw, wallH * 0.5);
      const midRight = pt3D(car, 0, hw, wallH * 0.5);

      const drawSideWall = (vSign) => {
        const v = vSign * hw;
        const isSunlit = vSign < 0;
        const bodyCol = isSunlit ? leftWallColor : rightWallColor;
        const stripeCol = isSunlit ? stripeLit : stripeShade;

        // Main lower wall
        fillQuad(
          pt3D(car, -hl, v, 2.0),
          pt3D(car, hl, v, 2.0),
          pt3D(car, hl, v, wallH),
          pt3D(car, -hl, v, wallH),
          bodyCol,
          'rgba(90, 80, 68, 0.25)'
        );

        // Dark gray bottom skirt
        fillQuad(
          pt3D(car, -hl, v, 1.8),
          pt3D(car, hl, v, 1.8),
          pt3D(car, hl, v, 3.6),
          pt3D(car, -hl, v, 3.6),
          isSunlit ? '#4c5158' : '#35393f'
        );

        // Signature FGC terracotta-orange waist stripe
        fillQuad(
          pt3D(car, -hl + 0.5, v, 3.6),
          pt3D(car, hl - 0.5, v, 3.6),
          pt3D(car, hl - 0.5, v, 6.2),
          pt3D(car, -hl + 0.5, v, 6.2),
          stripeCol
        );

        // Continuous dark window band + glowing windows
        fillQuad(
          pt3D(car, -hl + 2.2, v, 6.6),
          pt3D(car, hl - 2.2, v, 6.6),
          pt3D(car, hl - 2.2, v, 10.6),
          pt3D(car, -hl + 2.2, v, 10.6),
          '#232b33'
        );

        // Individual window panes & passenger doors
        const bays = [-16, -9, 0, 9, 16];
        for (let b = 0; b < bays.length; b++) {
          const u0 = bays[b] - 2.6;
          const u1 = bays[b] + 2.6;
          if (b === 1 || b === 3) {
            // Double sliding door in contrasting warm silver/orange
            fillQuad(
              pt3D(car, u0, v, 2.8),
              pt3D(car, u1, v, 2.8),
              pt3D(car, u1, v, 11.0),
              pt3D(car, u0, v, 11.0),
              isSunlit ? '#e2dad0' : '#c2b9ad'
            );
            fillQuad(
              pt3D(car, u0 + 0.8, v, 6.6),
              pt3D(car, u1 - 0.8, v, 6.6),
              pt3D(car, u1 - 0.8, v, 10.2),
              pt3D(car, u0 + 0.8, v, 10.2),
              winColor
            );
          } else {
            fillQuad(
              pt3D(car, u0, v, 7.0),
              pt3D(car, u1, v, 7.0),
              pt3D(car, u1, v, 10.2),
              pt3D(car, u0, v, 10.2),
              winColor
            );
          }
        }
      };

      if (midLeft[1] < midRight[1]) {
        drawSideWall(-1);
        drawSideWall(1);
      } else {
        drawSideWall(1);
        drawSideWall(-1);
      }

      // Draw front and rear end faces sorted by screen Y
      const frontMid = pt3D(car, hl, 0, wallH * 0.5);
      const rearMid = pt3D(car, -hl, 0, wallH * 0.5);

      const drawEndFace = (uSign) => {
        const u = uSign * hl;
        const isCabNose = (uSign > 0 && car.c === 0) || (uSign < 0 && car.c === numCars - 1);
        const noseTipU = u + uSign * (isCabNose ? 3.2 : 0.4);

        // Beveled aerodynamic cab nose or flat car end
        fillQuad(
          pt3D(car, u, -hw, 2.0),
          pt3D(car, u, hw, 2.0),
          pt3D(car, noseTipU, hw * 0.88, 6.2),
          pt3D(car, noseTipU, -hw * 0.88, 6.2),
          endWallColor
        );
        fillQuad(
          pt3D(car, noseTipU, -hw * 0.88, 6.2),
          pt3D(car, noseTipU, hw * 0.88, 6.2),
          pt3D(car, u, hw * 0.86, wallH),
          pt3D(car, u, -hw * 0.86, wallH),
          endWallColor
        );

        if (isCabNose) {
          // Orange front/rear nose band
          fillQuad(
            pt3D(car, u, -hw, 3.6),
            pt3D(car, u, hw, 3.6),
            pt3D(car, noseTipU, hw * 0.88, 6.0),
            pt3D(car, noseTipU, -hw * 0.88, 6.0),
            stripeLit
          );
          // Dark driver cab windshield
          fillQuad(
            pt3D(car, noseTipU, -hw * 0.72, 6.6),
            pt3D(car, noseTipU, hw * 0.72, 6.6),
            pt3D(car, u, hw * 0.68, 10.8),
            pt3D(car, u, -hw * 0.68, 10.8),
            '#222a32'
          );

          // Headlights or taillights depending on travel direction
          const isLeadingEnd = (uSign > 0 && movingForward) || (uSign < 0 && !movingForward);
          const lightCol = isLeadingEnd ? '#fff6c2' : '#ff3b2f';
          for (const lv of [-hw * 0.56, hw * 0.56]) {
            const lp = pt3D(car, noseTipU, lv, 4.6);
            ctx.beginPath();
            ctx.arc(lp[0], lp[1], 1.35, 0, Math.PI * 2);
            ctx.fillStyle = lightCol;
            ctx.fill();
          }
        }
      };

      if (frontMid[1] < rearMid[1]) {
        drawEndFace(1);
        drawEndFace(-1);
      } else {
        drawEndFace(-1);
        drawEndFace(1);
      }

      // Chamfered 3D Roof
      const rIn = 0.82;
      // Left roof chamfer (sunlit)
      fillQuad(
        pt3D(car, -hl, -hw, wallH),
        pt3D(car, hl, -hw, wallH),
        pt3D(car, hl * 0.96, -hw * rIn, roofH),
        pt3D(car, -hl * 0.96, -hw * rIn, roofH),
        '#ffffff'
      );
      // Right roof chamfer
      fillQuad(
        pt3D(car, -hl, hw, wallH),
        pt3D(car, hl, hw, wallH),
        pt3D(car, hl * 0.96, hw * rIn, roofH),
        pt3D(car, -hl * 0.96, hw * rIn, roofH),
        isDark ? '#cfc7ba' : '#e6dfd3'
      );
      // Center roof deck
      fillQuad(
        pt3D(car, -hl * 0.96, -hw * rIn, roofH),
        pt3D(car, hl * 0.96, -hw * rIn, roofH),
        pt3D(car, hl * 0.96, hw * rIn, roofH),
        pt3D(car, -hl * 0.96, hw * rIn, roofH),
        roofColor,
        'rgba(120, 110, 95, 0.25)'
      );

      // Raised 3D HVAC air-conditioning pods on the roof
      for (const podU of [-11, 11]) {
        const pW = 3.8, pL = 5.2, pH = roofH + 1.6;
        // Top of pod
        fillQuad(
          pt3D(car, podU - pL, -pW, pH),
          pt3D(car, podU + pL, -pW, pH),
          pt3D(car, podU + pL, pW, pH),
          pt3D(car, podU - pL, pW, pH),
          isDark ? '#dcd4c8' : '#f4efe6',
          'rgba(90, 82, 70, 0.35)'
        );
        // Shaded side of pod
        fillQuad(
          pt3D(car, podU - pL, pW, roofH),
          pt3D(car, podU + pL, pW, roofH),
          pt3D(car, podU + pL, pW, pH),
          pt3D(car, podU - pL, pW, pH),
          '#b5aca0'
        );
      }

      // Pantograph on middle car reaching toward overhead catenary wire
      if (car.c === 1) {
        const pBase = pt3D(car, 0, 0, roofH + 0.5);
        const pElbow = pt3D(car, -3.5, -1.5, roofH + 6.5);
        const pContact = pt3D(car, 0, 0, roofH + 12.0);
        ctx.save();
        ctx.strokeStyle = isDark ? '#9ca3af' : '#525860';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(pBase[0], pBase[1]);
        ctx.lineTo(pElbow[0], pElbow[1]);
        ctx.lineTo(pContact[0], pContact[1]);
        ctx.moveTo(pContact[0] - car.nx * 3.5, pContact[1] - car.ny * 3.5);
        ctx.lineTo(pContact[0] + car.nx * 3.5, pContact[1] + car.ny * 3.5);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Draw overhead catenary wire & support arms over the train track
  function drawOverheadCatenaryWire() {
    ctx.save();
    // Cantilever support arms from masts across the track
    const masts = [
      { base: [156, 540], tip: [194, 560] },
      { base: [96, 775], tip: [132, 775] },
      { base: [97, 930], tip: [132, 930] },
      { base: [97, 1088], tip: [132, 1088] }
    ];
    ctx.strokeStyle = isDark ? 'rgba(160, 168, 178, 0.65)' : 'rgba(75, 82, 90, 0.72)';
    ctx.lineWidth = 1.3;
    for (const m of masts) {
      ctx.beginPath();
      ctx.moveTo(m.base[0], m.base[1]);
      ctx.lineTo(m.tip[0], m.tip[1]);
      ctx.stroke();
    }

    // Contact wire suspended above the centerline of the track
    ctx.strokeStyle = isDark ? 'rgba(175, 182, 192, 0.45)' : 'rgba(65, 70, 78, 0.52)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let s = 95; s <= trainTrackSpline.totalLength; s += 16) {
      const pt = trainTrackSpline.getPointAt(s);
      const wx = pt.x;
      const wy = pt.y - 27;
      if (s === 95) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ============================================================================
  // 2. MINIATURE 3D CARS ON THE ROADS
  // ============================================================================
  // Route 1: Left-to-Right along Main Perimeter Avenue (outer lane)
  const roadLeftToRight = createArcLengthSpline([
    [235, 1372],
    [360, 1432],
    [500, 1500],
    [750, 1620],
    [920, 1700],
    [955, 1713],
    [990, 1717],
    [1025, 1713],
    [1065, 1701],
    [1195, 1649],
    [1350, 1573],
    [1535, 1479],
    [1575, 1466],
    [1615, 1460],
    [1655, 1450],
    [1700, 1431],
    [1890, 1343]
  ]);

  // Route 2: Right-to-Left along Main Perimeter Avenue (inner lane)
  const roadRightToLeft = createArcLengthSpline([
    [1886, 1332],
    [1696, 1420],
    [1650, 1438],
    [1610, 1448],
    [1570, 1454],
    [1530, 1467],
    [1345, 1561],
    [1190, 1637],
    [1062, 1689],
    [1022, 1701],
    [990, 1705],
    [958, 1701],
    [924, 1688],
    [754, 1608],
    [504, 1488],
    [364, 1420],
    [240, 1360]
  ]);

  // Route 3: Right edge -> Junction -> up Monastery Street behind Mercat Vell -> Monastery Portal
  const roadToMonastery = createArcLengthSpline([
    [1886, 1332],
    [1698, 1421],
    [1635, 1445],
    [1590, 1453],
    [1552, 1443],
    [1515, 1425],
    [1350, 1346],
    [1150, 1246],
    [965, 1152],
    [912, 1125]
  ]);

  const carDefinitions = [
    {
      spline: roadLeftToRight,
      period: 21.0,
      phaseOffset: 0.08,
      bodyTop: '#f4ede1',
      bodyLit: '#e8dfd0',
      bodyShade: '#c4b9a8',
      roofTop: '#faf6ef',
      len: 21,
      wid: 10.5,
      hBody: 4.6,
      hCab: 8.2
    },
    {
      spline: roadLeftToRight,
      period: 21.0,
      phaseOffset: 0.56,
      bodyTop: '#5b7a91',
      bodyLit: '#4d6a80',
      bodyShade: '#374e5e',
      roofTop: '#6c8ca3',
      len: 22,
      wid: 10.8,
      hBody: 4.8,
      hCab: 8.4
    },
    {
      spline: roadRightToLeft,
      period: 23.0,
      phaseOffset: 0.22,
      bodyTop: '#c45443',
      bodyLit: '#b34737',
      bodyShade: '#873326',
      roofTop: '#d16453',
      len: 20.5,
      wid: 10.4,
      hBody: 4.5,
      hCab: 8.1
    },
    {
      spline: roadRightToLeft,
      period: 23.0,
      phaseOffset: 0.74,
      bodyTop: '#768663',
      bodyLit: '#667554',
      bodyShade: '#4a573c',
      roofTop: '#859672',
      len: 22,
      wid: 10.8,
      hBody: 4.8,
      hCab: 8.4
    },
    {
      spline: roadToMonastery,
      period: 19.0,
      phaseOffset: 0.35,
      bodyTop: '#d6a145',
      bodyLit: '#c28e36',
      bodyShade: '#966b24',
      roofTop: '#e3b056',
      len: 20.5,
      wid: 10.4,
      hBody: 4.5,
      hCab: 8.0
    }
  ];

  function drawMiniatureCar(car, s, alpha) {
    const pt = car.spline.getPointAt(s);
    const cx = pt.x;
    const cy = pt.y;
    const tx = pt.tx;
    const ty = pt.ty;
    const nx = -ty;
    const ny = tx;

    const hl = car.len * 0.5;
    const hw = car.wid * 0.5;
    const hb = car.hBody;
    const hc = car.hCab;

    function p3(u, v, z) {
      return [cx + tx * u + nx * v, cy + ty * u + ny * v - z];
    }

    function quad(p1, p2, p3, p4, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Soft directional ground shadow (+5, +3)
    const sOffX = 4.8, sOffY = 3.0;
    ctx.beginPath();
    const s1 = p3(-hl - 1, -hw - 0.8, 0);
    const s2 = p3(hl + 1, -hw - 0.8, 0);
    const s3 = p3(hl + 1, hw + 0.8, 0);
    const s4 = p3(-hl - 1, hw + 0.8, 0);
    ctx.moveTo(s1[0] + sOffX, s1[1] + sOffY);
    ctx.lineTo(s2[0] + sOffX, s2[1] + sOffY);
    ctx.lineTo(s3[0] + sOffX, s3[1] + sOffY);
    ctx.lineTo(s4[0] + sOffX, s4[1] + sOffY);
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(25, 22, 18, 0.34)';
    ctx.fill();

    // 2. Subtle warm headlight glow ahead
    const nose = p3(hl, 0, 2);
    const beam = p3(hl + 18, 0, 0);
    const grad = ctx.createLinearGradient(nose[0], nose[1], beam[0], beam[1]);
    grad.addColorStop(0, isDark ? 'rgba(255, 232, 165, 0.38)' : 'rgba(255, 240, 190, 0.16)');
    grad.addColorStop(1, 'rgba(255, 232, 165, 0)');
    const b1 = p3(hl, -hw * 0.7, 0);
    const b2 = p3(hl + 18, -hw * 1.6, 0);
    const b3 = p3(hl + 18, hw * 1.6, 0);
    const b4 = p3(hl, hw * 0.7, 0);
    quad(b1, b2, b3, b4, grad);

    // 3. Wheels
    for (const wu of [-hl * 0.58, hl * 0.58]) {
      for (const wv of [-hw * 0.96, hw * 0.96]) {
        const wp = p3(wu, wv, 1.5);
        ctx.beginPath();
        ctx.arc(wp[0], wp[1], 1.9, 0, Math.PI * 2);
        ctx.fillStyle = '#22252a';
        ctx.fill();
      }
    }

    // 4. Lower 3D car body: sort 4 vertical walls by depth (screen Y of midpoint)
    const walls = [
      {
        y: (p3(-hl, -hw, 2)[1] + p3(hl, -hw, 2)[1]) * 0.5,
        p: [p3(-hl, -hw, 1.4), p3(hl, -hw, 1.4), p3(hl, -hw, hb), p3(-hl, -hw, hb)],
        col: ny < 0 ? car.bodyLit : car.bodyShade
      },
      {
        y: (p3(-hl, hw, 2)[1] + p3(hl, hw, 2)[1]) * 0.5,
        p: [p3(-hl, hw, 1.4), p3(hl, hw, 1.4), p3(hl, hw, hb), p3(-hl, hw, hb)],
        col: ny >= 0 ? car.bodyLit : car.bodyShade
      },
      {
        y: p3(hl, 0, 2)[1],
        p: [p3(hl, -hw, 1.4), p3(hl, hw, 1.4), p3(hl, hw, hb), p3(hl, -hw, hb)],
        col: tx < 0 ? car.bodyLit : car.bodyShade,
        isFront: true
      },
      {
        y: p3(-hl, 0, 2)[1],
        p: [p3(-hl, -hw, 1.4), p3(-hl, hw, 1.4), p3(-hl, hw, hb), p3(-hl, -hw, hb)],
        col: tx >= 0 ? car.bodyLit : car.bodyShade,
        isRear: true
      }
    ];
    walls.sort((a, b) => a.y - b.y);
    for (const w of walls) {
      quad(w.p[0], w.p[1], w.p[2], w.p[3], w.col, 'rgba(30, 25, 20, 0.22)');
      if (w.isFront) {
        for (const lv of [-hw * 0.62, hw * 0.62]) {
          const lp = p3(hl + 0.2, lv, hb * 0.65);
          ctx.beginPath();
          ctx.arc(lp[0], lp[1], 0.95, 0, Math.PI * 2);
          ctx.fillStyle = '#fff5b8';
          ctx.fill();
        }
      }
      if (w.isRear) {
        for (const lv of [-hw * 0.62, hw * 0.62]) {
          const lp = p3(-hl - 0.2, lv, hb * 0.65);
          ctx.beginPath();
          ctx.arc(lp[0], lp[1], 0.95, 0, Math.PI * 2);
          ctx.fillStyle = '#e83b2e';
          ctx.fill();
        }
      }
    }

    // Top deck of lower body (hood & trunk)
    quad(
      p3(-hl, -hw, hb),
      p3(hl, -hw, hb),
      p3(hl, hw, hb),
      p3(-hl, hw, hb),
      car.bodyTop,
      'rgba(40, 35, 28, 0.2)'
    );

    // 5. Upper cabin / greenhouse (windshield, side windows, rear window, roof)
    const cFrontBot = hl * 0.38;
    const cFrontTop = hl * 0.16;
    const cRearBot = -hl * 0.56;
    const cRearTop = -hl * 0.38;
    const cwBot = hw * 0.86;
    const cwTop = hw * 0.74;
    const winFill = isDark ? '#323e4a' : '#26313b';

    const cabFaces = [
      {
        y: p3(0, -cwBot, hb)[1],
        p: [p3(cRearBot, -cwBot, hb), p3(cFrontBot, -cwBot, hb), p3(cFrontTop, -cwTop, hc), p3(cRearTop, -cwTop, hc)],
        col: winFill
      },
      {
        y: p3(0, cwBot, hb)[1],
        p: [p3(cRearBot, cwBot, hb), p3(cFrontBot, cwBot, hb), p3(cFrontTop, cwTop, hc), p3(cRearTop, cwTop, hc)],
        col: winFill
      },
      {
        y: p3(cFrontBot, 0, hb)[1],
        p: [p3(cFrontBot, -cwBot, hb), p3(cFrontBot, cwBot, hb), p3(cFrontTop, cwTop, hc), p3(cFrontTop, -cwTop, hc)],
        col: '#2d3945'
      },
      {
        y: p3(cRearBot, 0, hb)[1],
        p: [p3(cRearBot, -cwBot, hb), p3(cRearBot, cwBot, hb), p3(cRearTop, cwTop, hc), p3(cRearTop, -cwTop, hc)],
        col: '#232c35'
      }
    ];
    cabFaces.sort((a, b) => a.y - b.y);
    for (const f of cabFaces) {
      quad(f.p[0], f.p[1], f.p[2], f.p[3], f.col, car.bodyTop);
    }

    // Cabin roof
    quad(
      p3(cRearTop, -cwTop, hc),
      p3(cFrontTop, -cwTop, hc),
      p3(cFrontTop, cwTop, hc),
      p3(cRearTop, cwTop, hc),
      car.roofTop,
      'rgba(40, 35, 28, 0.22)'
    );

    ctx.restore();
  }

  function drawAllCars(timeSec) {
    const activeCars = [];
    for (const car of carDefinitions) {
      const u = ((timeSec / car.period) + car.phaseOffset) % 1.0;
      const total = car.spline.totalLength;
      const s = u * total;

      // Smooth fade-in/out at road endpoints
      const edgeDist = Math.min(s, total - s);
      const alpha = Math.max(0, Math.min(1, edgeDist / 38));
      if (alpha > 0.02) {
        const pt = car.spline.getPointAt(s);
        activeCars.push({ car, s, alpha, y: pt.y });
      }
    }
    // Sort by screen Y for depth ordering
    activeCars.sort((a, b) => a.y - b.y);
    for (const item of activeCars) {
      drawMiniatureCar(item.car, item.s, item.alpha);
    }
  }

  // ============================================================================
  // 3. MINIATURE 3D PEDESTRIANS WALKING AROUND
  // ============================================================================
  const pedestrianWalks = [
    // 1. Monastery forecourt strollers (in front of the rose window & main portal)
    {
      pts: [[980, 1110], [1075, 1162], [1165, 1212], [1075, 1162]],
      period: 28,
      offset: 0.1,
      coat: '#b84b39',
      hat: '#f3ead8'
    },
    {
      pts: [[986, 1116], [1081, 1168], [1171, 1218], [1081, 1168]],
      period: 28,
      offset: 0.115,
      coat: '#3d5a73',
      hat: '#4a3525'
    },
    // 2. Central plaza tree avenue promenade
    {
      pts: [[1040, 1265], [890, 1378], [735, 1492], [890, 1378]],
      period: 34,
      offset: 0.25,
      coat: '#d49a3d',
      hat: '#3b2d22'
    },
    {
      pts: [[750, 1485], [885, 1385], [1025, 1280], [885, 1385]],
      period: 31,
      offset: 0.62,
      coat: '#5c7358',
      hat: '#e8dec8'
    },
    {
      pts: [[758, 1490], [893, 1390], [1033, 1285], [893, 1390]],
      period: 31,
      offset: 0.635,
      coat: '#e6ded0',
      hat: '#594130'
    },
    // 3. Sunny cobblestone plaza loop near the colorful row houses & cafes
    {
      pts: [[565, 1485], [735, 1572], [865, 1495], [705, 1412], [565, 1485]],
      period: 36,
      offset: 0.05,
      coat: '#48637a',
      hat: '#2e2620'
    },
    {
      pts: [[565, 1485], [735, 1572], [865, 1495], [705, 1412], [565, 1485]],
      period: 36,
      offset: 0.52,
      coat: '#c45b47',
      hat: '#f0e6d2'
    },
    // 4. Mercat Vell market shoppers (near the yellow & blue stalls)
    {
      pts: [[955, 1645], [1055, 1595], [1120, 1590], [1055, 1595]],
      period: 25,
      offset: 0.4,
      coat: '#7a5264',
      hat: '#382c24'
    },
    {
      pts: [[1020, 1510], [955, 1565], [885, 1615], [955, 1565]],
      period: 27,
      offset: 0.78,
      coat: '#d98b3a',
      hat: '#f4ecdc'
    },
    // 5. Celler Modernista brick promenade strollers
    {
      pts: [[1505, 1365], [1625, 1418], [1745, 1372], [1625, 1418]],
      period: 29,
      offset: 0.18,
      coat: '#4d6b5d',
      hat: '#332820'
    },
    {
      pts: [[1512, 1370], [1632, 1423], [1752, 1377], [1632, 1423]],
      period: 29,
      offset: 0.195,
      coat: '#e3d9c6',
      hat: '#614632'
    },
    // 6. Pi d'en Xandri park path walker (top right near the great pine tree)
    {
      pts: [[1385, 560], [1440, 582], [1495, 588], [1440, 582]],
      period: 24,
      offset: 0.33,
      coat: '#c9563c',
      hat: '#f2ead8'
    }
  ];

  function drawPedestrians(timeSec) {
    const list = [];
    for (let i = 0; i < pedestrianWalks.length; i++) {
      const p = pedestrianWalks[i];
      const u = ((timeSec / p.period) + p.offset) % 1.0;
      const segs = p.pts.length - 1;
      const f = u * segs;
      const idx = Math.min(segs - 1, Math.floor(f));
      const t = f - idx;
      // Smooth step near turnarounds
      const a = p.pts[idx];
      const b = p.pts[idx + 1];
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const stride = Math.sin(timeSec * 7.5 + i * 1.9);
      list.push({
        x,
        y,
        tx: dx / len,
        ty: dy / len,
        stride,
        coat: p.coat,
        hat: p.hat
      });
    }

    list.sort((a, b) => a.y - b.y);

    for (const p of list) {
      const bob = Math.abs(p.stride) * 0.7;
      const legSwing = p.stride * 1.6;

      ctx.save();
      // 1. Long cast shadow to bottom-right matching the render's sun angle (+7.5, +4.2)
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 7.8, p.y + 4.4);
      ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(28, 24, 18, 0.36)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Two animated walking legs
      ctx.strokeStyle = '#2a2f37';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.moveTo(p.x - 0.7, p.y - 3.8 - bob);
      ctx.lineTo(p.x - 0.7 + p.tx * legSwing, p.y + p.ty * legSwing * 0.5);
      ctx.moveTo(p.x + 0.7, p.y - 3.8 - bob);
      ctx.lineTo(p.x + 0.7 - p.tx * legSwing, p.y - p.ty * legSwing * 0.5);
      ctx.stroke();

      // 3. 3D shaded miniature torso / coat
      ctx.beginPath();
      ctx.roundRect(p.x - 1.9, p.y - 8.4 - bob, 3.8, 4.8, 1.5);
      ctx.fillStyle = p.coat;
      ctx.fill();

      // Sunlit shoulder highlight on top-left
      ctx.beginPath();
      ctx.roundRect(p.x - 1.9, p.y - 8.4 - bob, 2.1, 4.2, 1.2);
      ctx.fillStyle = 'rgba(255, 250, 235, 0.22)';
      ctx.fill();

      // 4. Tiny 3D head & sunlit hair/hat
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10.0 - bob, 1.65, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c3a5';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x - 0.2, p.y - 10.4 - bob, 1.55, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fillStyle = p.hat;
      ctx.fill();

      ctx.restore();
    }
  }

  // ============================================================================
  // 4. PBR VOLUMETRIC 3D CLOUDS & GENTLE LIFELIKE GROUND SHADOWS
  // ============================================================================
  // Each cloud drifts within [startX, endX] over the isometric island so it
  // smoothly condenses into view and dissolves out before ever reaching the canvas edge.
  const clouds = [
    {
      startX: 480,
      endX: 1520,
      baseY: 285,
      driftY: 45,
      duration: 68.0,
      phase: 0.12,
      scale: 0.96,
      bobPhase: 0.0,
      lobes: [
        [-64, 14, 28],
        [-38, 4, 38],
        [-8, -10, 46],
        [26, -8, 42],
        [56, 4, 34],
        [80, 14, 24],
        [-22, 16, 36],
        [14, 15, 38],
        [44, 16, 30]
      ],
      crowns: [
        [-44, -6, 22],
        [-18, -20, 28],
        [10, -22, 30],
        [36, -14, 24],
        [-4, -6, 26],
        [24, -2, 22]
      ]
    },
    {
      startX: 310,
      endX: 1620,
      baseY: 560,
      driftY: 60,
      duration: 82.0,
      phase: 0.58,
      scale: 1.04,
      bobPhase: 2.1,
      lobes: [
        [-72, 14, 27],
        [-44, 2, 39],
        [-12, -12, 48],
        [24, -10, 44],
        [56, 2, 36],
        [84, 12, 25],
        [-26, 16, 38],
        [10, 16, 40],
        [46, 15, 32]
      ],
      crowns: [
        [-50, -6, 22],
        [-22, -22, 30],
        [8, -24, 32],
        [36, -16, 26],
        [-6, -8, 28],
        [26, -4, 24]
      ]
    },
    {
      startX: 290,
      endX: 1610,
      baseY: 880,
      driftY: 55,
      duration: 74.0,
      phase: 0.34,
      scale: 0.86,
      bobPhase: 4.0,
      lobes: [
        [-56, 12, 25],
        [-28, -2, 36],
        [4, -10, 42],
        [36, -4, 36],
        [62, 10, 26],
        [-12, 14, 34],
        [22, 14, 32]
      ],
      crowns: [
        [-34, -10, 22],
        [-6, -20, 27],
        [22, -16, 25],
        [8, -6, 24]
      ]
    },
    {
      startX: 360,
      endX: 1560,
      baseY: 1180,
      driftY: 50,
      duration: 78.0,
      phase: 0.81,
      scale: 0.90,
      bobPhase: 1.3,
      lobes: [
        [-60, 12, 26],
        [-30, -2, 37],
        [4, -11, 44],
        [38, -4, 37],
        [66, 10, 26],
        [-14, 15, 35],
        [22, 15, 34]
      ],
      crowns: [
        [-36, -10, 22],
        [-6, -21, 28],
        [24, -16, 26],
        [6, -6, 25]
      ]
    }
  ];

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function getCloudState(cloud, timeSec) {
    const u = ((timeSec / cloud.duration) + cloud.phase) % 1.0;
    const x = cloud.startX + (cloud.endX - cloud.startX) * u;
    const y =
      cloud.baseY +
      cloud.driftY * (u - 0.5) +
      Math.sin(timeSec * 0.45 + cloud.bobPhase) * 4.5;

    // Gentle, lifelike fade-in over the first 26% of its path and fade-out over the last 26%
    // so clouds materialize softly over the island and dissolve completely before leaving the scene
    const fadeIn = smoothstep(0.0, 0.26, u);
    const fadeOut = smoothstep(1.0, 0.74, u);
    const alpha = fadeIn * fadeOut;

    // Subtle volumetric condensation/dissipation scale as the cloud forms and dissolves
    const breath = 0.86 + 0.14 * alpha;
    return { x, y, u, alpha, scale: cloud.scale * breath };
  }

  /**
   * Synthesizes a physically-based 3D volumetric cloud sprite for the given cloud definition
   * and theme (light or dark), matching the upper-left warm Mediterranean key light (-0.65, -0.76),
   * Rayleigh sky ambient fill, Beer-Lambert core self-shadowing, and warm terracotta/limestone
   * ground bounce light from the miniature town below.
   */
  const cloudSpriteCache = new Map();

  function getCloudSprites(cloud, dark) {
    const key = `${ clouds.indexOf(cloud) }_${ dark ? 'dark' : 'light' }`;
    if (cloudSpriteCache.has(key)) return cloudSpriteCache.get(key);

    const W_SP = 320;
    const H_SP = 200;
    const cx = W_SP * 0.5;
    const cy = H_SP * 0.54;

    function renderSprite(isWispLayer) {
      const off = document.createElement('canvas');
      off.width = W_SP;
      off.height = H_SP;
      const c = off.getContext('2d');

      // Palette matched to the Sant Cugat 3D tilt-shift render lighting
      const pal = dark
        ? {
            deepShadow: [58, 62, 76],
            groundBounce: [92, 82, 78],
            aoCrevice: [74, 78, 92],
            midBody: [138, 143, 158],
            sssLit: [178, 182, 196],
            sunCrown: [216, 218, 228],
            rimGlow: [238, 236, 244]
          }
        : {
            deepShadow: [168, 160, 152],
            groundBounce: [212, 196, 180],
            aoCrevice: [184, 176, 168],
            midBody: [236, 230, 222],
            sssLit: [248, 244, 237],
            sunCrown: [255, 252, 246],
            rimGlow: [255, 254, 250]
          };

      function rgba(rgb, a) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
      }

      const sourceLobes = isWispLayer ? cloud.crowns : cloud.lobes;

      // Pass 1: Soft Beer-Lambert optical depth & warm limestone/terracotta ground-bounce belly
      for (const p of sourceLobes) {
        const px = cx + p[0] + (isWispLayer ? 0 : 7);
        const py = cy + p[1] * 0.78 + (isWispLayer ? 2 : 10);
        const pr = p[2] * (isWispLayer ? 1.15 : 1.28);

        const g = c.createRadialGradient(
          px - pr * 0.15,
          py - pr * 0.15,
          pr * 0.05,
          px,
          py,
          pr
        );
        g.addColorStop(0.0, rgba(pal.deepShadow, isWispLayer ? 0.22 : 0.42));
        g.addColorStop(0.48, rgba(pal.groundBounce, isWispLayer ? 0.16 : 0.30));
        g.addColorStop(0.78, rgba(pal.groundBounce, isWispLayer ? 0.06 : 0.10));
        g.addColorStop(1.0, rgba(pal.groundBounce, 0.0));

        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, pr, 0, Math.PI * 2);
        c.fill();
      }

      // Pass 2: 3D Spherical PBR lobes with directional upper-left lighting & crevice AO
      for (const p of sourceLobes) {
        const px = cx + p[0];
        const py = cy + p[1] * 0.76;
        const pr = p[2] * (isWispLayer ? 1.05 : 1.16);

        // Ambient occlusion pocket at lobe base
        const aoGrad = c.createRadialGradient(
          px + pr * 0.18,
          py + pr * 0.22,
          pr * 0.05,
          px + pr * 0.12,
          py + pr * 0.18,
          pr * 0.95
        );
        aoGrad.addColorStop(0.0, rgba(pal.aoCrevice, isWispLayer ? 0.18 : 0.30));
        aoGrad.addColorStop(0.6, rgba(pal.aoCrevice, 0.08));
        aoGrad.addColorStop(1.0, rgba(pal.aoCrevice, 0.0));
        c.fillStyle = aoGrad;
        c.beginPath();
        c.arc(px + pr * 0.12, py + pr * 0.18, pr * 0.95, 0, Math.PI * 2);
        c.fill();

        // Subsurface-scattered spherical lobe lit from upper-left (-0.65, -0.76)
        const lobeGrad = c.createRadialGradient(
          px - pr * 0.34,
          py - pr * 0.36,
          pr * 0.04,
          px,
          py,
          pr
        );
        lobeGrad.addColorStop(0.0, rgba(pal.sunCrown, isWispLayer ? 0.55 : 0.76));
        lobeGrad.addColorStop(0.34, rgba(pal.sssLit, isWispLayer ? 0.44 : 0.64));
        lobeGrad.addColorStop(0.66, rgba(pal.midBody, isWispLayer ? 0.24 : 0.38));
        lobeGrad.addColorStop(0.86, rgba(pal.groundBounce, isWispLayer ? 0.08 : 0.14));
        lobeGrad.addColorStop(1.0, rgba(pal.groundBounce, 0.0));

        c.fillStyle = lobeGrad;
        c.beginPath();
        c.arc(px, py, pr, 0, Math.PI * 2);
        c.fill();
      }

      // Pass 3: Fine cauliflower cumulus crowns & forward-scattered golden sun rim on upper-left
      for (const p of cloud.crowns) {
        const px = cx + p[0] - (isWispLayer ? 2 : 5);
        const py = cy + p[1] * 0.76 - (isWispLayer ? 2 : 5);
        const pr = p[2] * (isWispLayer ? 0.95 : 1.08);

        const crownGrad = c.createRadialGradient(
          px - pr * 0.36,
          py - pr * 0.38,
          pr * 0.02,
          px,
          py,
          pr
        );
        crownGrad.addColorStop(0.0, rgba(pal.rimGlow, isWispLayer ? 0.52 : 0.72));
        crownGrad.addColorStop(0.42, rgba(pal.sunCrown, isWispLayer ? 0.36 : 0.52));
        crownGrad.addColorStop(0.75, rgba(pal.sssLit, isWispLayer ? 0.12 : 0.20));
        crownGrad.addColorStop(1.0, rgba(pal.sssLit, 0.0));

        c.fillStyle = crownGrad;
        c.beginPath();
        c.arc(px, py, pr, 0, Math.PI * 2);
        c.fill();
      }

      return off;
    }

    const sprites = {
      body: renderSprite(false),
      wisp: renderSprite(true),
      w: W_SP,
      h: H_SP,
      cx,
      cy
    };
    cloudSpriteCache.set(key, sprites);
    return sprites;
  }

  // Compact 384x384 offscreen canvas for soft ground cloud shadows clipped to the island silhouette
  const SH_SIZE = 384;
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = SH_SIZE;
  shadowCanvas.height = SH_SIZE;
  const shCtx = shadowCanvas.getContext('2d');

  function drawCloudShadowsOnIsland(timeSec, activeImg) {
    if (!activeImg) return;
    const shScale = SH_SIZE / W;
    shCtx.setTransform(1, 0, 0, 1, 0, 0);
    shCtx.clearRect(0, 0, SH_SIZE, SH_SIZE);
    shCtx.setTransform(shScale, 0, 0, shScale, 0, 0);

    for (const cloud of clouds) {
      const st = getCloudState(cloud, timeSec);
      if (st.alpha <= 0.005) continue;

      // Shadow projects down-right along the warm Mediterranean sunlight angle (+140, +215)
      const sx = st.x + 140;
      const sy = st.y + 215;
      const sc = st.scale;
      const baseStrength = st.alpha * (isDark ? 0.15 : 0.075);

      shCtx.save();
      for (const p of cloud.lobes) {
        const px = sx + p[0] * sc * 1.08;
        const py = sy + p[1] * sc * 0.68;
        const pr = p[2] * sc * 1.65;

        // Soft diffused penumbra gradient (no hard circular shadow edges)
        const g = shCtx.createRadialGradient(px, py, pr * 0.08, px, py, pr);
        g.addColorStop(0.0, `rgba(22, 16, 12, ${baseStrength})`);
        g.addColorStop(0.5, `rgba(22, 16, 12, ${baseStrength * 0.55})`);
        g.addColorStop(1.0, 'rgba(22, 16, 12, 0)');

        shCtx.fillStyle = g;
        shCtx.beginPath();
        shCtx.arc(px, py, pr, 0, Math.PI * 2);
        shCtx.fill();
      }
      shCtx.restore();
    }

    // Mask shadows to the island silhouette using activeImg's alpha channel
    shCtx.save();
    shCtx.setTransform(1, 0, 0, 1, 0, 0);
    shCtx.globalCompositeOperation = 'destination-in';
    shCtx.drawImage(activeImg, 0, 0, SH_SIZE, SH_SIZE);
    shCtx.restore();

    ctx.drawImage(shadowCanvas, 0, 0, W, H);
  }

  function drawVolumetricClouds(timeSec) {
    for (const cloud of clouds) {
      const st = getCloudState(cloud, timeSec);
      if (st.alpha <= 0.005) continue;

      const sprites = getCloudSprites(cloud, isDark);
      const sc = st.scale;

      ctx.save();
      // Gentle translucent volumetric presence so the clouds feel integrated into the miniature atmosphere
      ctx.globalAlpha = st.alpha * (isDark ? 0.76 : 0.86);

      // 1. Primary PBR 3D volumetric cloud body
      ctx.drawImage(
        sprites.body,
        st.x - sprites.cx * sc,
        st.y - sprites.cy * sc,
        sprites.w * sc,
        sprites.h * sc
      );

      // 2. Subtle evolving upper cumulus wisp layer that gently shifts in 3D as the cloud drifts
      const wispShiftX = Math.sin(timeSec * 0.38 + cloud.bobPhase) * 7.5 * sc;
      const wispShiftY = Math.cos(timeSec * 0.31 + cloud.bobPhase) * 3.5 * sc;
      ctx.globalAlpha = st.alpha * (isDark ? 0.55 : 0.68);
      ctx.drawImage(
        sprites.wisp,
        st.x - sprites.cx * sc + wispShiftX,
        st.y - sprites.cy * sc + wispShiftY,
        sprites.w * sc,
        sprites.h * sc
      );

      ctx.restore();
    }
  }

  // ============================================================================
  // MAIN ANIMATION LOOP (pauses automatically when scrolled out of view or hidden)
  // ============================================================================
  let startTime = null;
  let rafId = null;
  let isVisible = true;

  function updateLoopState() {
    const shouldRun = isVisible && !document.hidden;
    if (shouldRun && !rafId) {
      rafId = requestAnimationFrame(renderFrame);
    } else if (!shouldRun && rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        isVisible = entry.isIntersecting;
      }
      updateLoopState();
    }, { threshold: 0.01 });
    observer.observe(canvas);
  }
  document.addEventListener('visibilitychange', updateLoopState);

  function renderFrame(timestamp) {
    rafId = null;
    if (!startTime) startTime = timestamp;
    const timeSec = (timestamp - startTime) * 0.001 + 12.0; // Start mid-cycle so train & cars are immediately in view

    const activeImg = isDark
      ? (darkReady ? imgDark : (lightReady ? imgLight : null))
      : (lightReady ? imgLight : (darkReady ? imgDark : null));

    const activeFg = isDark
      ? (fgDarkCanvas || fgLightCanvas)
      : (fgLightCanvas || fgDarkCanvas);

    if (activeImg) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, CW, CH);

      // Map logical 2048x2048 island coordinates into the cropped 1152x1105 canvas
      const scaleX = CW / VIEW_W;
      const scaleY = CH / VIEW_H;
      ctx.setTransform(scaleX, 0, 0, scaleY, -VIEW_X * scaleX, -VIEW_Y * scaleY);

      // Layer 0: Base transparent 3D town render (light or dark)
      ctx.drawImage(activeImg, 0, 0, W, H);

      // Layer 1: Animated 3D elements on tracks, roads, and walkways
      drawCommuterTrain(timeSec);
      drawAllCars(timeSec);
      drawPedestrians(timeSec);

      // Layer 2: Foreground occlusion (trees, Mercat Vell roof, upper forest, catenary wires)
      if (activeFg) {
        ctx.drawImage(activeFg, 0, 0, W, H);
      }
      drawOverheadCatenaryWire();

      // Layer 3: Soft moving cloud shadows on the island + 3D volumetric clouds above
      drawCloudShadowsOnIsland(timeSec, activeImg);
      drawVolumetricClouds(timeSec);
    }

    updateLoopState();
  }

  updateLoopState();
})();
