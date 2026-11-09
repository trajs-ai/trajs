// @ts-nocheck

// Property metadata is only used in Figma Design, so this is a no-op.
function defineProperties(
  _component: unknown,
  _properties: unknown,
): void {}

export default function Effect() { }
export function setup(device, frame) {
    var wgsl = `
diagnostic(off,derivative_uniformity);
struct Uniforms {
  frameData: vec4f,
  inputDimsData: vec4f,
  coral: vec4f,
  apricot: vec4f,
  golden: vec4f,
  fieldLayout: vec4f,
  cloudStrength: vec4f,
  cloudScale: vec4f,
  cloudSoftness: vec4f,
  grainStrength: vec4f,
  grainSize: vec4f,
  seed: vec4f,
  composition: vec4f,
  motion: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn hazeHash(p: vec2f) -> f32 {

  var q = fract(vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973));

  q = q + dot(q, q.yzx + 33.33);

  return fract((q.x + q.y) * q.z);

}

fn hazeNoise(p: vec2f) -> f32 {

  let cell = floor(p);

  let f = fract(p);

  let w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  return mix(mix(hazeHash(cell), hazeHash(cell + vec2f(1.0, 0.0)), w.x),

             mix(hazeHash(cell + vec2f(0.0, 1.0)), hazeHash(cell + vec2f(1.0)), w.x), w.y);

}

fn hazeCloud(p: vec2f, softness: f32) -> f32 {

  var pos = p;

  var weight = 0.55;

  var total = 0.0;

  var norm = 0.0;

  let persistence = mix(0.57, 0.23, softness);

  for (var i = 0; i < 5; i = i + 1) {

    total = total + weight * hazeNoise(pos);

    norm = norm + weight;

    pos = mat2x2f(0.8, 0.6, -0.6, 0.8) * pos * 2.07 + vec2f(17.1, 9.2);

    weight = weight * persistence;

  }

  return total / norm - 0.5;

}

// Smooth deposited pigment, not a contour / threshold noise pattern.
fn washMask(p: vec2f, center: vec2f, radii: vec2f, angle: f32,
            bloom: f32, edge: f32) -> f32 {
  let d = p - center;
  let r = vec2f(cos(angle) * d.x + sin(angle) * d.y,
               -sin(angle) * d.x + cos(angle) * d.y) / radii;
  let distanceField = dot(r, r);
  return exp(-distanceField * mix(1.55, 0.95, edge)) *
         clamp(0.82 + bloom * 1.3, 0.16, 1.35);
}

// Internal compositing is premultiplied; final fill output is straight alpha.
fn glaze(base: vec4f, pigment: vec4f, coverage: f32) -> vec4f {
  let a = clamp(coverage * pigment.a, 0.0, 0.94);
  return vec4f(pigment.rgb * a, a) + base * (1.0 - a);
}

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv_in: vec2f) -> @location(0) vec4f {
  let dims = max(u.frameData.yz, vec2f(1.0));
  let uv = outputUv_in;
  let coral = u.coral;
  let apricot = u.apricot;
  let golden = u.golden;
  let fieldLayout = u.fieldLayout;
  let strength = clamp(u.cloudStrength.x, 0.0, 1.0);
  let cloudScale = max(u.cloudScale.x, 0.15);
  let softness = clamp(u.cloudSoftness.x, 0.0, 1.0);
  let seed = u.seed.x;
  let preset = i32(u.composition.x + 0.5);
  let flow = u.composition.y;
  let layering = u.composition.z;
  let motionSpeed = clamp(u.motion.x, 0.0, 4.0);
  let driftAmount = clamp(u.motion.y, 0.0, 1.5);
  let dirAngle = radians(u.motion.z);
  let clock = max(u.frameData.x, 0.0) * motionSpeed;
  let dr = driftAmount;
  // One dominant current: every layer is advected along the same heading at its
  // own rate, so the paint streams steadily downstream and keeps reshaping
  // instead of sloshing back and forth in place.
  let flowDir = vec2f(cos(dirAngle), sin(dirAngle));
  let flowDirB = vec2f(cos(dirAngle + 0.22), sin(dirAngle + 0.22));
  let flowDirC = vec2f(cos(dirAngle - 0.17), sin(dirAngle - 0.17));
  let travel = clock * (0.10 + dr * 0.16);
  let shortSide = min(dims.x, dims.y);
  let p = (uv * dims - fieldLayout.xy / 100.0 * dims) / shortSide;
  let angle = radians(fieldLayout.w);
  let local = vec2f(cos(angle) * p.x + sin(angle) * p.y,
                   -sin(angle) * p.x + cos(angle) * p.y);
  let spread = max(fieldLayout.z / 100.0, 0.1);
  let q = local / spread;
  let seedOffset = vec2f(seed * 1.731 + 13.7, seed * 0.917 + 41.3);
  let npos = q / cloudScale;
  let macroWarp = vec2f(hazeCloud(npos * 2.1 + seedOffset - flowDir * travel * 1.30, 0.82),
                    hazeCloud(npos * 2.1 + seedOffset + vec2f(21.8, 9.1) - flowDirB * travel * 1.05, 0.82));
  // A real compositional warp exists even on old nodes at strength=.35.
  let bent = q + macroWarp * (0.23 + strength * 0.75);
  let across = (bent.x + bent.y) * 0.7071068;
  let along = (bent.x - bent.y) * 0.7071068;
  let drift = vec2f(across * (7.0 + flow * 8.0), along * 1.8) / cloudScale;
  let wisps = hazeCloud(drift + seedOffset + vec2f(31.0) - flowDirB * travel * 2.0, softness);
  let bloom = hazeCloud(npos * 8.0 + macroWarp * 2.0 + seedOffset - flowDirC * travel * 1.35, softness);
  let fine = hazeCloud(npos * 37.0 + seedOffset + macroWarp - flowDir * travel * 0.35, 0.45);
  let activity = strength * (0.65 + layering * 0.65);
  let edgeNoise = bloom * activity + fine * activity * (0.16 + 0.23 * (1.0 - softness));
  let field = bent + vec2f(wisps, -wisps) * flow * (0.08 + 0.22 * strength);

  // Light underpainting is derived from the editable pigments, not fixed white.
  var ground = mix(apricot, golden, 0.24);
  if (preset == 1) { ground = mix(coral, golden, 0.56); }
  if (preset == 2) { ground = mix(apricot, coral, 0.65); }
  let groundRgb = mix(ground.rgb, vec3f(1.0, 0.985, 0.97), 0.18);
  var paint = vec4f(groundRgb * ground.a, ground.a);

  if (preset == 2) {
    // Broad yellow/blue diagonal with a muted mixing body, broken by dry wisps.
    let front = across + 0.10 * sin(along * 3.4 + seed * 0.13 - travel * 0.9) +
                bloom * strength * 0.32 + wisps * flow * 0.34;
    let yellowBody = 1.0 - smoothstep(-0.54, 0.24, front);
    let blueBody = smoothstep(-0.18, 0.65, front);
    paint = glaze(paint, golden, yellowBody * 0.93);
    paint = glaze(paint, coral, blueBody * 0.91);
    let mixingBody = exp(-pow((front + 0.06) / 0.39, 2.0));
    paint = glaze(paint, apricot, mixingBody * (0.52 + bloom * activity));
    let pulled = hazeCloud(vec2f(across * 24.0, along * 2.3) / cloudScale + seedOffset, softness);
    let dragged = exp(-pow((front - 0.08 - pulled * 0.46) / 0.23, 2.0));
    paint = glaze(paint, mix(apricot, coral, 0.72), dragged * (0.12 + 0.36 * layering) *
                  clamp(0.65 + pulled + fine * strength, 0.0, 1.0));
  }

  // Nine deliberately placed overlapping deposits; each preset changes geometry,
  // recurrence, transparency and stroke direction, not only endpoint colors.
  for (var i = 0; i < 9; i = i + 1) {
    var center = vec2f(0.0);
    var radii = vec2f(0.6);
    var turn = 0.0;
    var pigment = apricot;
    var opacity = 0.65;
    if (preset == 0) {
      if (i == 0) { center = vec2f(-0.48, -0.31); radii = vec2f(0.94, 0.70); turn = 0.45; }
      if (i == 1) { center = vec2f(0.43, -0.43); radii = vec2f(0.80, 0.72); pigment = coral; }
      if (i == 2) { center = vec2f(-0.34, 0.64); radii = vec2f(0.99, 0.58); pigment = golden; turn = 0.25; opacity = 0.79; }
      if (i == 3) { center = vec2f(0.26, 0.02); radii = vec2f(0.44, 0.62); pigment = coral; turn = -0.55; opacity = 0.46; }
      if (i == 4) { center = vec2f(-0.52, 0.03); radii = vec2f(0.34, 0.67); pigment = golden; turn = -0.4; opacity = 0.48; }
      if (i == 5) { center = vec2f(0.60, 0.51); radii = vec2f(0.56, 0.31); turn = 0.62; opacity = 0.51; }
      if (i == 6) { center = vec2f(-0.10, 0.20); radii = vec2f(0.67, 0.22); turn = 0.7; opacity = 0.44; }
      if (i == 7) { center = vec2f(0.20, 0.73); radii = vec2f(0.66, 0.40); pigment = golden; opacity = 0.64; }
      if (i == 8) { center = vec2f(0.70, -0.04); radii = vec2f(0.38, 0.68); pigment = coral; turn = -0.3; opacity = 0.48; }
    } else if (preset == 1) {
      if (i == 0) { center = vec2f(-0.60, -0.25); radii = vec2f(0.65, 0.96); pigment = apricot; opacity = 0.83; turn = 0.25; }
      if (i == 1) { center = vec2f(0.13, -0.50); radii = vec2f(0.72, 0.43); pigment = coral; turn = -0.55; }
      if (i == 2) { center = vec2f(0.52, 0.12); radii = vec2f(0.62, 0.63); pigment = golden; opacity = 0.84; }
      if (i == 3) { center = vec2f(-0.14, 0.12); radii = vec2f(0.35, 0.83); pigment = coral; turn = -0.75; opacity = 0.49; }
      if (i == 4) { center = vec2f(-0.43, 0.65); radii = vec2f(0.69, 0.32); pigment = golden; turn = -0.65; opacity = 0.67; }
      if (i == 5) { center = vec2f(0.69, 0.69); radii = vec2f(0.70, 0.32); pigment = coral; turn = -0.62; opacity = 0.80; }
      if (i == 6) { center = vec2f(-0.59, 0.04); radii = vec2f(0.22, 0.58); pigment = apricot; turn = -0.6; opacity = 0.56; }
      if (i == 7) { center = vec2f(0.29, 0.38); radii = vec2f(0.24, 0.74); pigment = golden; turn = -0.8; opacity = 0.49; }
      if (i == 8) { center = vec2f(-0.06, 0.53); radii = vec2f(0.36, 0.19); pigment = coral; turn = -0.6; opacity = 0.25; }
    } else {
      let index = f32(i);
      center = vec2f(-0.54 + index * 0.14, 0.37 - index * 0.10);
      center = center + vec2f(hazeHash(vec2f(index, seed)), hazeHash(vec2f(seed, index))) * 0.24 - 0.12;
      radii = vec2f(0.63 + 0.20 * hazeHash(vec2f(index + 4.0, seed)), 0.075 + 0.08 * hazeHash(vec2f(seed, index + 3.0)));
      turn = -0.80;
      pigment = mix(apricot, coral, 0.48);
      if (i == 1 || i == 5) { pigment = golden; center = center - vec2f(0.24); }
      if (i == 3 || i == 7) { pigment = coral; center = center + vec2f(0.21); }
      opacity = 0.13 + layering * 0.18;
    }
    let index = f32(i);
    // A barely-there drift per deposit keeps the masses from looking frozen,
    // but the visible movement comes from the current shaping each of them.
    center = center + flowDir * (0.006 + 0.014 * dr) * sin(clock * 0.13 + index * 1.1);
    let layerNoise = hazeCloud(npos * (5.0 + index * 0.31) + seedOffset + vec2f(index * 9.7, index * 3.9) -
                               flowDirC * travel * (0.60 + index * 0.045), softness);
    let feather = edgeNoise + layerNoise * activity * 0.48 + wisps * flow * 0.12;
    let deposit = washMask(field, center, radii, turn, feather, softness);
    let thickness = clamp(0.76 + layerNoise * (0.48 + strength) + fine * activity * 0.22, 0.12, 1.15);
    paint = glaze(paint, pigment, deposit * opacity * thickness * (0.64 + layering * 0.58));
  }

  // Small uneven areas of diluted binder open the composition; not a vignette.
  let breathing = washMask(field, select(vec2f(-0.23, -0.12), vec2f(0.43, 0.03), preset == 1),
                            vec2f(0.24, 0.63), -0.66, bloom * activity, softness);
  let lightPigment = vec4f(mix(groundRgb, vec3f(1.0, 0.99, 0.97), 0.32), ground.a);
  paint = glaze(paint, lightPigment, breathing * (0.10 + layering * 0.12));
  let renderScale = max(u.frameData.w, 0.001);
  let size = max(u.grainSize.x, 0.25);
  let grainPos = uv * dims / (renderScale * size);
  let grain = hazeNoise(grainPos + seedOffset * 3.1) - 0.5;
  let grainVisible = smoothstep(0.25, 1.0, size * renderScale);
  let microVisible = smoothstep(0.8, 1.8, size * renderScale);
  let micro = hazeHash(floor(grainPos * 1.71) + seedOffset) - 0.5;
  // Granulation darkens deposited pigment and opens small paper flecks, with
  // coverage-dependent amplitude. No blanket white-noise layer.
  let tooth = (grain * grainVisible * 0.8 + micro * microVisible * 0.2);
  // Constant coverage factor: a spatially varying mask that also drifts reads
  // as dirt crawling over the wash, so the grain amplitude stays uniform.
  let granulation = (fine * strength * 0.042 + tooth * u.grainStrength.x * 0.105) * 0.85;
  let straight = paint.rgb / max(paint.a, 0.00001);
  let rgb = clamp(straight + granulation * (vec3f(0.34) + (1.0 - straight) * 0.68), vec3f(0.0), vec3f(1.0));
  return vec4f(rgb, paint.a);
}
`;
    frame.state.module = device.createShaderModule({ code: wgsl });
    frame.state.pipeline = null;
    frame.state.pipelineFormat = null;
    frame.state.quad = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(frame.state.quad.getMappedRange()).set([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
    ]);
    frame.state.quad.unmap();
    frame.state.uniformBuf = device.createBuffer({
        size: 224,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
}
export function render(device, frame) {
    var params = frame.params || {};
    function finiteNumber(value, fallback) {
        var num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }
    function numberParam(name, fallback) {
        return finiteNumber(params[name], fallback);
    }
    function boolParam(name, fallback) {
        if (typeof params[name] === 'boolean')
            return params[name] ? 1 : 0;
        return fallback ? 1 : 0;
    }
    function selectParam(name, count, fallbackIndex) {
        // A select is a numeric dropdown: params[name] is the chosen option's index.
        var index = Math.round(Number(params[name]));
        return Number.isFinite(index) && index >= 0 && index < count ? index : fallbackIndex;
    }
    function colorParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.r, fallback[0]),
            finiteNumber(value.g, fallback[1]),
            finiteNumber(value.b, fallback[2]),
            finiteNumber(value.a, fallback[3]),
        ];
    }
    function pointParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
        ];
    }
    function pointRadiusParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.radius, fallback[2]),
        ];
    }
    function pointPointLineParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.x2, fallback[2]),
            finiteNumber(value.y2, fallback[3]),
        ];
    }
    function pointAngleRadiusParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.radius, fallback[2]),
            finiteNumber(value.angle, fallback[3]),
        ];
    }
    function colorPointParam(name, fallback) {
        var value = params[name] || {};
        var color = value.color || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            0,
            0,
            finiteNumber(color.r, fallback[2]),
            finiteNumber(color.g, fallback[3]),
            finiteNumber(color.b, fallback[4]),
            finiteNumber(color.a, fallback[5]),
        ];
    }
    function gradientParam(name, fallback) {
        var value = params[name] || {};
        var stops = Array.isArray(value.stops) && value.stops.length > 0 ? value.stops : fallback;
        // Layout: 8 stop colors (rgba), then 8 positions packed 4-per-vec4, then the live count.
        var out = new Array(44).fill(0);
        var count = Math.min(stops.length, 8);
        for (var i = 0; i < count; i++) {
            var stop = stops[i] || {};
            var color = stop.color || {};
            out[i * 4] = finiteNumber(color.r, 0);
            out[i * 4 + 1] = finiteNumber(color.g, 0);
            out[i * 4 + 2] = finiteNumber(color.b, 0);
            out[i * 4 + 3] = finiteNumber(color.a, 1);
            out[32 + i] = finiteNumber(stop.position, 0);
        }
        out[40] = count;
        return out;
    }
    var output = frame.output || {};
    var width = Math.max(1, finiteNumber(output.physicalWidth, finiteNumber(output.width, 1)));
    var height = Math.max(1, finiteNumber(output.physicalHeight, finiteNumber(output.height, 1)));
    var renderScale = Math.max(0.001, finiteNumber(frame.renderScale, 1));
    var preset = selectParam("preset", 3, 0);
    // Untouched legacy colors get reference-appropriate preset palettes. Each
    // manually changed pigment is used literally, including its alpha. This also
    // works on previously serialized nodes without reapplication or state writes.
    function pigmentParam(name, original, cool, diagonal) {
        var value = colorParam(name, original);
        var unchanged = true;
        for (var c = 0; c < 4; c++) {
            if (Math.abs(value[c] - original[c]) > 0.0005)
                unchanged = false;
        }
        if (preset === 0 || !unchanged)
            return value;
        return preset === 1 ? cool : diagonal;
    }
    var time = Number(frame.time) * 0.001;
    var inputWidth = width;
    var inputHeight = height;
    device.queue.writeBuffer(frame.state.uniformBuf, 0, new Float32Array([
        time, width, height, renderScale,
        inputWidth, inputHeight, 0, 0,
        ...pigmentParam("coral", [1, 0.565, 0.548, 1], [0.34, 0.43, 0.91, 1], [0.08, 0.43, 0.72, 1]),
        ...pigmentParam("apricot", [1, 0.701, 0.469, 1], [0.20, 0.75, 0.94, 1], [0.43, 0.59, 0.57, 1]),
        ...pigmentParam("golden", [1, 0.824, 0.105, 1], [0.74, 0.60, 0.96, 1], [0.96, 0.80, 0.12, 1]),
        ...pointAngleRadiusParam("fieldLayout", [50, 43, 65, 0]),
        numberParam("cloudStrength", 0.35), 0, 0, 0,
        numberParam("cloudScale", 1), 0, 0, 0,
        numberParam("cloudSoftness", 0.72), 0, 0, 0,
        numberParam("grainStrength", 0.18), 0, 0, 0,
        numberParam("grainSize", 0.7), 0, 0, 0,
        numberParam("seed", 7), 0, 0, 0,
        preset, numberParam("flow", 0.6), numberParam("layering", 0.65), 0,
        numberParam("motionSpeed", 3), numberParam("driftAmount", 1), numberParam("flowDirection", 32), 0,
    ]));
    var outputFormat = frame.output.format;
    if (frame.state.pipeline == null || frame.state.pipelineFormat !== outputFormat) {
        frame.state.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: frame.state.module,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 16,
                        attributes: [
                            { shaderLocation: 0, format: 'float32x2', offset: 0 },
                            { shaderLocation: 1, format: 'float32x2', offset: 8 },
                        ],
                    }],
            },
            fragment: {
                module: frame.state.module,
                entryPoint: 'fs_main',
                targets: [{ format: outputFormat }],
            },
            primitive: { topology: 'triangle-list' },
        });
        frame.state.pipelineFormat = outputFormat;
    }
    var bindGroup = device.createBindGroup({
        layout: frame.state.pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: frame.state.uniformBuf } },
        ],
    });
    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: frame.output.createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store',
            }],
    });
    pass.setPipeline(frame.state.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, frame.state.quad);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
defineProperties(Effect, {
    "preset": {
        type: "number",
        label: "Composition / palette",
        defaultValue: 0,
        control: "select",
        options: [
            { value: 0, label: "Warm pigment haze" },
            { value: 1, label: "Cool luminous veils" },
            { value: 2, label: "Diagonal yellow/blue flow" },
        ],
    },
    "coral": {
        type: "color",
        label: "Pigment 1 / coral override",
        defaultValue: { "r": 1, "g": 0.565, "b": 0.548, "a": 1 },
    },
    "apricot": {
        type: "color",
        label: "Pigment 2 / apricot override",
        defaultValue: { "r": 1, "g": 0.701, "b": 0.469, "a": 1 },
    },
    "golden": {
        type: "color",
        label: "Pigment 3 / golden override",
        defaultValue: { "r": 1, "g": 0.824, "b": 0.105, "a": 1 },
    },
    "fieldLayout": {
        type: "point-angle-radius",
        label: "Color field",
        defaultValue: { "x": 50, "y": 43, "radius": 65, "angle": 0 },
        mode: "canvas_and_ui",
        positionUnit: "%",
        radiusUnit: "%",
        minRadius: 10,
        maxRadius: 180,
    },
    "cloudStrength": {
        type: "number",
        label: "Cloud variation",
        defaultValue: 0.35,
        control: "slider",
        min: 0,
        max: 1,
        step: 0.01,
    },
    "flow": {
        type: "number",
        label: "Directional flow",
        defaultValue: 0.6,
        control: "slider",
        min: 0,
        max: 1,
        step: 0.01,
    },
    "layering": {
        type: "number",
        label: "Pigment layering",
        defaultValue: 0.65,
        control: "slider",
        min: 0,
        max: 1,
        step: 0.01,
    },
    "cloudScale": {
        type: "number",
        label: "Cloud scale",
        defaultValue: 1,
        control: "slider",
        min: 0.2,
        max: 4,
        step: 0.01,
    },
    "cloudSoftness": {
        type: "number",
        label: "Cloud softness",
        defaultValue: 0.72,
        control: "slider",
        min: 0,
        max: 1,
        step: 0.01,
    },
    "grainStrength": {
        type: "number",
        label: "Fine grain",
        defaultValue: 0.18,
        control: "slider",
        min: 0,
        max: 1,
        step: 0.01,
    },
    "grainSize": {
        type: "number",
        label: "Grain size",
        defaultValue: 0.7,
        control: "slider",
        min: 0.25,
        max: 3,
        step: 0.05,
    },
    "seed": {
        type: "number",
        label: "Random seed",
        defaultValue: 7,
        control: "input",
        min: 0,
        max: 9999,
        step: 1,
    },
    "motionSpeed": {
        type: "number",
        label: "Motion speed",
        defaultValue: 3,
        control: "slider",
        min: 0,
        max: 4,
        step: 0.01,
    },
    "driftAmount": {
        type: "number",
        label: "Drift amount",
        defaultValue: 1,
        control: "slider",
        min: 0,
        max: 1.5,
        step: 0.01,
    },
    "flowDirection": {
        type: "number",
        label: "Flow direction (°)",
        defaultValue: 32,
        control: "slider",
        min: 0,
        max: 360,
        step: 1,
    },
});

export const manifest = {
  "isAnimated": true,
  "name": "Apricot haze — drift",
  "usesMouse": false,
  "version": 2
}

