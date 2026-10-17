import * as THREE from './vendor/three.module.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform vec2 uImageSize;
  uniform vec2 uPointer;
  uniform float uLens;
  uniform float uTime;
  uniform float uMotion;
  uniform float uEtch;
  varying vec2 vUv;

  float heroLuma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
  float hash(float x) { return fract(sin(x * 91.137 + 17.73) * 43211.67); }

  vec2 coverUv(vec2 uv) {
    float viewAspect = uResolution.x / max(uResolution.y, 1.0);
    float imageAspect = uImageSize.x / max(uImageSize.y, 1.0);
    vec2 cover = vec2(min(viewAspect / imageAspect, 1.0), min(imageAspect / viewAspect, 1.0));
    vec2 drift = (uPointer - .5) * vec2(.008, .005) * uMotion;
    return .5 + ((uv - .5) / 1.024 + drift) * cover;
  }

  vec3 photo(vec2 uv) { return texture2D(uImage, clamp(uv, .001, .999)).rgb; }

  vec3 heroGrade(vec3 source) {
    float light = heroLuma(source);
    float peak = max(source.r, max(source.g, source.b));
    float redDominance = (source.r - max(source.g, source.b)) / max(peak, .03);
    float hardWarmLight = smoothstep(.32, .68, redDominance) * smoothstep(.025, .22, peak);
    vec3 restrained = mix(vec3(light), source, .62);
    vec3 steel = light * vec3(.86, 1.015, 1.055);
    vec3 graded = mix(restrained, steel, hardWarmLight * .94);
    float shadow = 1.0 - smoothstep(.012, .25, light);
    graded *= mix(vec3(1.0), vec3(.91, .985, 1.055), shadow);
    return graded / (1.0 + max(light - .55, 0.0) * .22);
  }

  vec3 drawing(vec2 uv) {
    vec2 t = 1.35 / uImageSize;
    float nw = heroLuma(photo(uv + t * vec2(-1., 1.)));
    float n  = heroLuma(photo(uv + t * vec2( 0., 1.)));
    float ne = heroLuma(photo(uv + t * vec2( 1., 1.)));
    float w  = heroLuma(photo(uv + t * vec2(-1., 0.)));
    float e  = heroLuma(photo(uv + t * vec2( 1., 0.)));
    float sw = heroLuma(photo(uv + t * vec2(-1.,-1.)));
    float s  = heroLuma(photo(uv + t * vec2( 0.,-1.)));
    float se = heroLuma(photo(uv + t * vec2( 1.,-1.)));
    float gx = -nw - 2. * w - sw + ne + 2. * e + se;
    float gy = nw + 2. * n + ne - sw - 2. * s - se;
    float edge = smoothstep(.025, .57, length(vec2(gx, gy)));
    float shade = heroLuma(photo(uv));
    vec3 ink = vec3(.012, .018, .026) + shade * vec3(.12, .145, .16);
    return ink + edge * vec3(.30, .35, .38);
  }

  float rain(vec2 px, float time, float scale) {
    px *= scale;
    px.x += px.y * .075;
    float column = floor(px.x / 31.0);
    float seed = hash(column);
    float x = mod(px.x, 31.0) - (6.0 + seed * 19.0);
    float y = fract((px.y + time * (130.0 + seed * 110.0)) / 189.0 + seed);
    float slender = 1.0 - smoothstep(.20, .95, abs(x));
    float tail = (1.0 - smoothstep(.0, .18, y)) * smoothstep(.0, .012, y);
    return slender * tail * (.25 + seed * .55);
  }

  void main() {
    vec2 uv = coverUv(vUv);
    vec3 color = uEtch > .5 ? drawing(uv) : heroGrade(photo(uv));

    vec2 lensLocal = (vUv - uPointer) * uResolution / min(uResolution.x, uResolution.y);
    float squareDistance = max(abs(lensLocal.x), abs(lensLocal.y));
    float mask = (1.0 - smoothstep(.125, .132, squareDistance)) * uLens * uMotion;
    if (mask > .001) {
      float radius = dot(lensLocal, lensLocal);
      vec2 bend = lensLocal * (.026 - radius * .32);
      vec2 bentUv = coverUv(vUv - bend);
      float fringe = smoothstep(.025, .13, squareDistance) * .0007;
      vec2 separation = normalize(lensLocal + vec2(.0001)) * fringe;
      vec3 refracted;
      if (uEtch > .5) {
        refracted = drawing(bentUv);
      } else {
        // Inside the lens the photo keeps its own colour, so the red glass shows through.
        refracted = vec3(photo(bentUv + separation).r, photo(bentUv).g, photo(bentUv - separation).b);
      }
      color = mix(color, refracted * 1.018, mask);
      float rim = (1.0 - smoothstep(.001, .0035, abs(squareDistance - .128))) * uLens * uMotion;
      color += vec3(.025, .038, .045) * rim;
    }

    vec2 pixels = vUv * uResolution;
    float rainfall = rain(pixels, uTime, 1.0) + rain(pixels + vec2(71., 39.), uTime * .83, 1.71) * .35;
    color += rainfall * vec3(.052, .064, .073) * uMotion;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Mount a decorative image treatment while retaining an ordinary image fallback. */
export function mountHero(host, { image = '/static/city-art.png' } = {}) {
  if (!(host instanceof HTMLElement)) return { dispose() {}, setMode() {} };

  let disposed = false;
  let renderer;
  let texture;
  let scene;
  let camera;
  let geometry;
  let material;
  let frame = 0;
  let ready = false;
  let visible = true;
  let elapsed = 0;
  let lastTime = 0;
  let pointerInside = false;
  let mode = 'neon';
  let resizeObserver;
  let intersectionObserver;
  let mutationObserver;
  const target = new THREE.Vector2(.5, .5);
  const pointer = new THREE.Vector2(.5, .5);
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  host.dataset.renderState = 'loading';
  host.dataset.artMode = mode;
  const originalPosition = host.style.position;
  const positionedHost = getComputedStyle(host).position === 'static';
  if (positionedHost) host.style.position = 'relative';

  let fallback = host.querySelector('img');
  const createdFallback = !fallback;
  if (!fallback) {
    fallback = document.createElement('img');
    fallback.src = image;
    fallback.alt = '';
    fallback.setAttribute('aria-hidden', 'true');
    Object.assign(fallback.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'
    });
    host.prepend(fallback);
  }

  const motionAllowed = () => !media.matches && document.documentElement.dataset.motion !== 'off';
  const canAnimate = () => !disposed && ready && visible && !document.hidden && motionAllowed();
  const listen = (element, event, callback, options) => {
    element.addEventListener(event, callback, options);
    listeners.push(() => element.removeEventListener(event, callback, options));
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  };
  const fail = (stage, error) => {
    ready = false;
    stop();
    if (renderer) renderer.domElement.style.opacity = '0';
    host.dataset.renderState = `fallback-${stage}`;
    host.dataset.renderError = stage;
    console.error(`[hero-art] ${stage}`, error);
  };

  const render = () => {
    if (!ready || disposed || !visible || document.hidden) return;
    try {
      renderer.render(scene, camera);
      if (ready) {
        renderer.domElement.style.opacity = '1';
        host.dataset.renderState = 'ready';
        delete host.dataset.renderError;
      }
    } catch (error) {
      fail('render-error', error);
    }
  };
  const tick = (now) => {
    frame = 0;
    if (!canAnimate()) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1 / 60;
    lastTime = now;
    elapsed += dt;
    const ease = 1 - Math.exp(-9 * dt);
    pointer.lerp(target, ease);
    material.uniforms.uPointer.value.copy(pointer);
    material.uniforms.uLens.value += ((pointerInside ? 1 : 0) - material.uniforms.uLens.value) * ease;
    material.uniforms.uTime.value = elapsed;
    render();
    if (canAnimate()) frame = requestAnimationFrame(tick);
  };
  const syncActivity = () => {
    if (disposed || !ready) return;
    const motion = motionAllowed();
    host.dataset.animationState = !motion ? 'still' : document.hidden ? 'background' : !visible ? 'offscreen' : 'running';
    material.uniforms.uMotion.value = motion ? 1 : 0;
    if (!motion) {
      pointerInside = false;
      target.set(.5, .5);
      pointer.copy(target);
      material.uniforms.uPointer.value.copy(pointer);
      material.uniforms.uLens.value = 0;
    }
    stop();
    render();
    if (canAnimate()) frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    if (!renderer || disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(Math.ceil(width), Math.ceil(height), false);
    material.uniforms.uResolution.value.set(width, height);
    render();
  };
  const trackPointer = (event) => {
    if (!motionAllowed()) return;
    if (event.pointerType === 'touch' && event.type === 'pointermove' && !event.buttons) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    target.set(
      THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1),
      THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1)
    );
    pointerInside = true;
  };
  const leavePointer = () => {
    pointerInside = false;
    target.set(.5, .5);
  };

  const api = {
    setMode(nextMode) {
      if (disposed) return;
      mode = nextMode === 'etch' ? 'etch' : 'neon';
      host.dataset.artMode = mode;
      if (material) {
        material.uniforms.uEtch.value = mode === 'etch' ? 1 : 0;
        render();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      listeners.forEach(remove => remove());
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      mutationObserver?.disconnect();
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      if (renderer) {
        renderer.domElement.remove();
        renderer.dispose();
      }
      if (createdFallback) fallback.remove();
      if (positionedHost) host.style.position = originalPosition;
      delete host.dataset.artMode;
      host.dataset.renderState = 'disposed';
      delete host.dataset.animationState;
    }
  };

  try {
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x081016, 1);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    Object.assign(renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      display: 'block', pointerEvents: 'none', opacity: '0'
    });
    scene = new THREE.Scene();
    camera = new THREE.Camera();
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uImage: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uImageSize: { value: new THREE.Vector2(16, 9) },
        uPointer: { value: pointer.clone() },
        uLens: { value: 0 },
        uTime: { value: 0 },
        uMotion: { value: motionAllowed() ? 1 : 0 },
        uEtch: { value: mode === 'etch' ? 1 : 0 }
      }
    });
    scene.add(new THREE.Mesh(geometry, material));
    host.append(renderer.domElement);
    // A shader compilation error must reveal the image instead of a blank canvas.
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      fail('shader-error', {
        program: gl.getProgramInfoLog(program),
        vertex: gl.getShaderInfoLog(vertex),
        fragment: gl.getShaderInfoLog(fragment)
      });
    };

    listen(host, 'pointerenter', trackPointer, { passive: true });
    listen(host, 'pointermove', trackPointer, { passive: true });
    listen(host, 'pointerdown', trackPointer, { passive: true });
    listen(host, 'pointerleave', leavePointer, { passive: true });
    listen(host, 'pointercancel', leavePointer, { passive: true });
    listen(host, 'pointerup', event => { if (event.pointerType !== 'mouse') leavePointer(); }, { passive: true });
    listen(document, 'visibilitychange', syncActivity);
    listen(media, 'change', syncActivity);
    listen(renderer.domElement, 'webglcontextlost', event => {
      event.preventDefault();
      fail('context-lost', 'WebGL context was lost; the source image remains visible.');
    });
    listen(renderer.domElement, 'webglcontextrestored', () => {
      if (disposed || !texture) return;
      ready = true;
      resize();
      syncActivity();
    });
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      syncActivity();
    }, { threshold: 0 });
    intersectionObserver.observe(host);
    mutationObserver = new MutationObserver(syncActivity);
    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    resize();

    new THREE.TextureLoader().load(image, loaded => {
      if (disposed) { loaded.dispose(); return; }
      texture = loaded;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      material.uniforms.uImage.value = texture;
      material.uniforms.uImageSize.value.set(texture.image.width, texture.image.height);
      ready = true;
      resize();
      syncActivity();
    }, undefined, error => {
      if (!disposed) fail('image-error', error);
    });
  } catch (error) {
    fail('initialization-error', error);
    listeners.forEach(remove => remove());
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    mutationObserver?.disconnect();
    geometry?.dispose();
    material?.dispose();
    renderer?.domElement.remove();
    renderer?.dispose();
  }
  return api;
}
