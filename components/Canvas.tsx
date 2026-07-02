
import React, { useRef, useEffect } from 'react';
import { BackgroundState } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  return [((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255];
};

// ─── WebGL: Fluid Mesh ────────────────────────────────────────────────────────

interface FluidMeshProps {
  colors: { color1: string; color2: string; color3: string };
  speed: 'slow' | 'normal' | 'fast';
  complexity: number;
  turbulence: number;
  zoom: number;
  contrast: number;
  frequency: number;
}

const FluidMeshGL: React.FC<FluidMeshProps> = ({ colors, speed, complexity, turbulence, zoom, contrast, frequency }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vsSource = `attribute vec4 aVertexPosition; void main() { gl_Position = aVertexPosition; }`;
    const fsSource = `
      precision highp float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uComplexity;
      uniform float uTurbulence;
      uniform float uZoom;
      uniform float uContrast;
      uniform float uFrequency;
      void main() {
        vec2 st = (gl_FragCoord.xy / uResolution.xy) * uZoom;
        st.x *= uResolution.x / uResolution.y;
        float t = uTime;
        vec2 p = st;
        for(float i = 1.0; i < 20.0; i++){
          if(i > uComplexity) break;
          float amp = uTurbulence / i;
          p.x += amp * sin(i * uFrequency * p.y + t + cos((t / (12. * i)) * i));
          p.y += amp * cos(i * uFrequency * p.x + t + sin((t / (12. * i)) * i));
        }
        float r = 0.5 + 0.5 * sin(p.x + p.y + 1.0);
        float g = 0.5 + 0.5 * sin(p.x + p.y + 1.0 + 2.0);
        r = clamp((r - 0.5) * uContrast + 0.5, 0.0, 1.0);
        g = clamp((g - 0.5) * uContrast + 0.5, 0.0, 1.0);
        vec3 col = mix(uColor1, uColor2, smoothstep(0.0, 1.0, r));
        col = mix(col, uColor3, smoothstep(0.0, 1.0, g * 0.8));
        col *= 1.1;
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const loadShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };

    const vs = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    const locs = {
      pos: gl.getAttribLocation(prog, 'aVertexPosition'),
      res: gl.getUniformLocation(prog, 'uResolution'),
      time: gl.getUniformLocation(prog, 'uTime'),
      c1: gl.getUniformLocation(prog, 'uColor1'),
      c2: gl.getUniformLocation(prog, 'uColor2'),
      c3: gl.getUniformLocation(prog, 'uColor3'),
      complexity: gl.getUniformLocation(prog, 'uComplexity'),
      turbulence: gl.getUniformLocation(prog, 'uTurbulence'),
      zoom: gl.getUniformLocation(prog, 'uZoom'),
      contrast: gl.getUniformLocation(prog, 'uContrast'),
      frequency: gl.getUniformLocation(prog, 'uFrequency'),
    };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);

    const start = Date.now();
    const mult = speed === 'slow' ? 0.2 : speed === 'fast' ? 1.0 : 0.5;

    const render = () => {
      if (canvas.width !== canvas.parentElement?.clientWidth || canvas.height !== canvas.parentElement?.clientHeight) {
        canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(locs.pos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(locs.pos);
      const t = (Date.now() - start) * 0.001 * mult;
      const c1 = hexToRgb(colors.color1), c2 = hexToRgb(colors.color2), c3 = hexToRgb(colors.color3);
      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, t);
      gl.uniform3f(locs.c1, ...c1); gl.uniform3f(locs.c2, ...c2); gl.uniform3f(locs.c3, ...c3);
      gl.uniform1f(locs.complexity, complexity);
      gl.uniform1f(locs.turbulence, turbulence);
      gl.uniform1f(locs.zoom, zoom);
      gl.uniform1f(locs.contrast, contrast);
      gl.uniform1f(locs.frequency, frequency);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frameIdRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [colors, speed, complexity, turbulence, zoom, contrast, frequency]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-80 mix-blend-hard-light" />;
};

// ─── WebGL: Volumetric Fog ────────────────────────────────────────────────────

const VolumetricFogGL: React.FC<{ colors: { color1: string; color2: string; color3: string }; density: number; speed: number }> = ({ colors, density, speed }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vs = `attribute vec4 aVertexPosition; void main() { gl_Position = aVertexPosition; }`;
    const fs = `
      precision highp float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uDensity;

      float random(in vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
      float noise(in vec2 st) {
        vec2 i = floor(st), f = fract(st);
        float a = random(i), b = random(i + vec2(1,0)), c = random(i + vec2(0,1)), d = random(i + vec2(1,1));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }
      #define OCTAVES 5
      float fbm(in vec2 st) {
        float v = 0.0, a = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for(int i=0;i<OCTAVES;i++){ v += a*noise(st); st = rot*st*2.0+shift; a*=0.5; }
        return v;
      }
      void main() {
        vec2 st = gl_FragCoord.xy/uResolution.xy*3.0;
        st.x *= uResolution.x/uResolution.y;
        vec2 q = vec2(fbm(st+0.0*uTime), fbm(st+vec2(1.0)));
        vec2 r = vec2(fbm(st+1.0*q+vec2(1.7,9.2)+0.15*uTime), fbm(st+1.0*q+vec2(8.3,2.8)+0.126*uTime));
        float f = fbm(st+r);
        vec3 color = mix(vec3(0.0), uColor1, clamp(f*f*4.0,0.0,1.0));
        color = mix(color, uColor2, clamp(length(q),0.0,1.0));
        color = mix(color, uColor3, clamp(length(r.x),0.0,1.0));
        float alpha = f*uDensity + length(q)*0.2;
        alpha = clamp(alpha, 0.0, 1.0);
        vec2 center = gl_FragCoord.xy/uResolution.xy - 0.5;
        alpha *= (1.0 - smoothstep(0.4, 1.0, length(center)));
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const makeShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    };
    const vShader = makeShader(gl.VERTEX_SHADER, vs);
    const fShader = makeShader(gl.FRAGMENT_SHADER, fs);
    if (!vShader || !fShader) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vShader); gl.attachShader(prog, fShader); gl.linkProgram(prog);

    const locs = {
      pos: gl.getAttribLocation(prog, 'aVertexPosition'),
      res: gl.getUniformLocation(prog, 'uResolution'),
      time: gl.getUniformLocation(prog, 'uTime'),
      c1: gl.getUniformLocation(prog, 'uColor1'),
      c2: gl.getUniformLocation(prog, 'uColor2'),
      c3: gl.getUniformLocation(prog, 'uColor3'),
      density: gl.getUniformLocation(prog, 'uDensity'),
    };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const start = Date.now();
    const render = () => {
      if (canvas.width !== canvas.parentElement?.clientWidth || canvas.height !== canvas.parentElement?.clientHeight) {
        canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(locs.pos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(locs.pos);
      const t = (Date.now() - start) * 0.001 * speed;
      const c1 = hexToRgb(colors.color1), c2 = hexToRgb(colors.color2), c3 = hexToRgb(colors.color3);
      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, t);
      gl.uniform3f(locs.c1, ...c1); gl.uniform3f(locs.c2, ...c2); gl.uniform3f(locs.c3, ...c3);
      gl.uniform1f(locs.density, density);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frameIdRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [colors, density, speed]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};

// ─── WebGL: Molten Orb ────────────────────────────────────────────────────────

const MoltenOrbGL: React.FC<{ colors: { color1: string; color2: string; color3: string }; roughness: number; distortion: number }> = ({ colors, roughness, distortion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vs = `attribute vec4 aVertexPosition; void main() { gl_Position = aVertexPosition; }`;
    const fs = `
      precision highp float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform float uRoughness;
      uniform float uDistortion;

      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
        vec2 i = floor(v+dot(v,C.yy));
        vec2 x0 = v-i+dot(i,C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
        vec4 x12 = x0.xyxy+C.xxzz; x12.xy -= i1;
        i = mod(i,289.0);
        vec3 p = permute(permute(i.y+vec3(0,i1.y,1))+i.x+vec3(0,i1.x,1));
        vec3 m = max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
        m = m*m; m = m*m;
        vec3 x = 2.0*fract(p*C.www)-1.0;
        vec3 h = abs(x)-0.5;
        vec3 ox = floor(x+0.5);
        vec3 a0 = x-ox;
        m *= 1.79284291400159-0.85373472095314*(a0*a0+h*h);
        vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
        return 130.0*dot(m,g);
      }
      void main() {
        vec2 st = gl_FragCoord.xy/uResolution.xy;
        st.x *= uResolution.x/uResolution.y;
        float t = uTime*0.2;
        float nv = snoise(st*(3.0+uDistortion)+t);
        float d = distance(st, vec2(0.5*(uResolution.x/uResolution.y),0.5));
        float liquid = smoothstep(0.4+(uRoughness*0.2),0.38,d+nv*0.1);
        vec3 col = mix(uColor1, uColor2, st.y+nv);
        col = mix(col, uColor3, liquid);
        gl_FragColor = vec4(col, liquid*0.8);
      }
    `;

    const makeShader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    };
    const vs2 = makeShader(gl.VERTEX_SHADER, vs);
    const fs2 = makeShader(gl.FRAGMENT_SHADER, fs);
    if (!vs2 || !fs2) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs2); gl.attachShader(prog, fs2); gl.linkProgram(prog);

    const locs = {
      pos: gl.getAttribLocation(prog, 'aVertexPosition'),
      res: gl.getUniformLocation(prog, 'uResolution'),
      time: gl.getUniformLocation(prog, 'uTime'),
      c1: gl.getUniformLocation(prog, 'uColor1'),
      c2: gl.getUniformLocation(prog, 'uColor2'),
      c3: gl.getUniformLocation(prog, 'uColor3'),
      roughness: gl.getUniformLocation(prog, 'uRoughness'),
      distortion: gl.getUniformLocation(prog, 'uDistortion'),
    };

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const start = Date.now();
    const render = () => {
      if (canvas.width !== canvas.parentElement?.clientWidth || canvas.height !== canvas.parentElement?.clientHeight) {
        canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(locs.pos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(locs.pos);
      const t = (Date.now() - start) * 0.001;
      const c1 = hexToRgb(colors.color1), c2 = hexToRgb(colors.color2), c3 = hexToRgb(colors.color3);
      gl.uniform2f(locs.res, canvas.width, canvas.height);
      gl.uniform1f(locs.time, t);
      gl.uniform3f(locs.c1, ...c1); gl.uniform3f(locs.c2, ...c2); gl.uniform3f(locs.c3, ...c3);
      gl.uniform1f(locs.roughness, roughness);
      gl.uniform1f(locs.distortion, distortion);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frameIdRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [colors, roughness, distortion]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 mix-blend-screen opacity-80" />;
};

// ─── Canvas2D: Kinetic Flow ───────────────────────────────────────────────────

const KineticFlowCanvas: React.FC<{ colors: { color1: string; color2: string; color3: string }; speed: number; trailLength: number; chaos: number }> = ({ colors, speed, trailLength, chaos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let particles: any[] = [];
    const COUNT = 400;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      init();
    };

    const init = () => {
      particles = [];
      const palette = [colors.color1, colors.color2, colors.color3];
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          history: [],
          color: palette[Math.floor(Math.random() * palette.length)],
          size: Math.random() * 2 + 0.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = Date.now() * 0.0005 * speed;
      const scale = 0.003 * chaos;

      particles.forEach(p => {
        const angle = (Math.cos(p.x * scale + t) + Math.sin(p.y * scale + t)) * Math.PI;
        p.x += Math.cos(angle) * (2 * speed);
        p.y += Math.sin(angle) * (2 * speed);
        if (p.x < 0) { p.x = canvas.width; p.history = []; }
        if (p.x > canvas.width) { p.x = 0; p.history = []; }
        if (p.y < 0) { p.y = canvas.height; p.history = []; }
        if (p.y > canvas.height) { p.y = 0; p.history = []; }

        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > trailLength) p.history.shift();

        if (p.history.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.history[0].x, p.history[0].y);
          for (let i = 1; i < p.history.length; i++) ctx.lineTo(p.history[i].x, p.history[i].y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      });

      frameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frameId); };
  }, [colors, speed, trailLength, chaos]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen" />;
};

// ─── Canvas2D: Generative ─────────────────────────────────────────────────────

const GenerativeCanvas: React.FC<{ preset: string; colors: { color1: string; color2: string; color3: string } }> = ({ preset, colors }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (r) mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    let particles: any[] = [];
    let time = 0;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      init();
    };

    const init = () => {
      particles = [];
      const w = canvas.width, h = canvas.height;
      if (preset === 'orbital') {
        for (let i = 0; i < 50; i++) particles.push({ x: w/2, y: h/2, radius: Math.random()*2+1, color: Math.random()>.5?colors.color1:colors.color2, angle: Math.random()*Math.PI*2, speed: Math.random()*0.02+0.005, orbitRadius: Math.random()*200+50 });
      } else if (preset === 'particles') {
        for (let i = 0; i < 80; i++) particles.push({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-.5)*.5, vy: (Math.random()-.5)*.5, size: Math.random()*3, color: i%3===0?colors.color1:i%3===1?colors.color2:colors.color3 });
      } else if (preset === 'matrix') {
        const cols = Math.floor(w / 14);
        for (let i = 0; i < cols; i++) particles[i] = 1;
      } else if (preset === 'fluid-grid') {
        const sp = 40;
        for (let x = 0; x < w; x += sp) for (let y = 0; y < h; y += sp) particles.push({ x, y, ox: x, oy: y, vx: 0, vy: 0 });
      } else if (preset === 'noise-field') {
        for (let i = 0; i < 300; i++) particles.push({ x: Math.random()*w, y: Math.random()*h, vx: 0, vy: 0, life: Math.random()*100, maxLife: 100+Math.random()*100, color: Math.random()>.5?colors.color1:colors.color3 });
      }
    };

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      if (preset === 'matrix' || preset === 'noise-field') {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.clearRect(0, 0, w, h);
      }

      if (preset === 'orbital') {
        const cx = w/2, cy = h/2;
        particles.forEach(p => {
          p.angle += p.speed;
          p.x = cx + Math.cos(p.angle)*p.orbitRadius;
          p.y = cy + Math.sin(p.angle)*p.orbitRadius;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
          ctx.fillStyle = p.color; ctx.globalAlpha = 0.6; ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(p.x,p.y);
          ctx.strokeStyle = p.color; ctx.globalAlpha = 0.05; ctx.stroke();
        });
      } else if (preset === 'particles') {
        particles.forEach((p,i) => {
          p.x += p.vx; p.y += p.vy;
          if (p.x<0||p.x>w) p.vx*=-1;
          if (p.y<0||p.y>h) p.vy*=-1;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
          ctx.fillStyle=p.color; ctx.globalAlpha=0.7; ctx.fill();
          for (let j=i+1;j<particles.length;j++) {
            const q=particles[j], dx=p.x-q.x, dy=p.y-q.y, dist=Math.sqrt(dx*dx+dy*dy);
            if (dist<100) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.strokeStyle=p.color; ctx.globalAlpha=1-(dist/100); ctx.lineWidth=0.5; ctx.stroke(); }
          }
        });
      } else if (preset === 'matrix') {
        ctx.fillStyle = colors.color1; ctx.font = '14px monospace';
        for (let i=0;i<particles.length;i++) {
          ctx.fillText(String.fromCharCode(0x30A0+Math.random()*96), i*14, particles[i]*14);
          if (particles[i]*14>h && Math.random()>0.975) particles[i]=0;
          particles[i]++;
        }
      } else if (preset === 'fluid-grid') {
        ctx.fillStyle = colors.color1;
        particles.forEach(p => {
          const dx=mouseRef.current.x-p.x, dy=mouseRef.current.y-p.y, dist=Math.sqrt(dx*dx+dy*dy), minD=150;
          if (dist<minD) { const f=(minD-dist)/minD, a=Math.atan2(dy,dx); p.vx-=Math.cos(a)*f*2; p.vy-=Math.sin(a)*f*2; }
          p.vx+=(p.ox-p.x)*0.05; p.vy+=(p.oy-p.y)*0.05;
          p.x+=p.vx; p.y+=p.vy; p.vx*=0.85; p.vy*=0.85;
          ctx.beginPath(); ctx.arc(p.x,p.y,1.5,0,Math.PI*2); ctx.globalAlpha=0.6; ctx.fill();
        });
        ctx.strokeStyle=colors.color2; ctx.lineWidth=0.5;
        for (let i=0;i<particles.length;i++) {
          const p=particles[i];
          particles.forEach((q,j) => {
            if (j<=i) return;
            const dx=p.x-q.x, dy=p.y-q.y;
            if (Math.abs(dx)<60&&Math.abs(dy)<60&&(Math.abs(dx)+Math.abs(dy))<80) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.globalAlpha=0.2; ctx.stroke(); }
          });
        }
      } else if (preset === 'noise-field') {
        const ns=0.005;
        ctx.strokeStyle=colors.color1; ctx.lineWidth=1;
        particles.forEach(p => {
          const a=(Math.sin(p.x*ns)+Math.cos(p.y*ns)+time*0.002)*Math.PI*2;
          p.vx=Math.cos(a)*2; p.vy=Math.sin(a)*2;
          ctx.beginPath(); ctx.moveTo(p.x,p.y);
          p.x+=p.vx; p.y+=p.vy;
          ctx.lineTo(p.x,p.y); ctx.globalAlpha=Math.sin((p.life/p.maxLife)*Math.PI)*0.5; ctx.stroke();
          p.life++;
          if (p.life>p.maxLife||p.x<0||p.x>w||p.y<0||p.y>h) { p.x=Math.random()*w; p.y=Math.random()*h; p.life=0; }
        });
      }

      ctx.globalAlpha = 1;
      time++;
      frameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize(); draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frameId); };
  }, [preset, colors]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-60" />;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Draw an image to a canvas with CSS object-cover (centre-crop) semantics */
const drawObjectCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
  const scale = Math.max(w / img.width, h / img.height);
  const sw    = img.width  * scale;
  const sh    = img.height * scale;
  ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
};

// ─── Color grade transforms (per pixel, each returns [R,G,B]) ────────────────

type GradePreset =
  | 'teal-orange' | 'golden-hour' | 'arctic' | 'noir' | 'moody' | 'vellichor'
  | 'polaroid' | 'kodachrome' | 'cross-process' | 'lomo' | 'faded' | 'vhs';

const GRADES: Record<GradePreset, (r: number, g: number, b: number) => [number, number, number]> = {
  // ── Cinematic ─────────────────────────────────────────────────────────────
  'teal-orange': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114, warmth = r - b;
    if (lum < 85)    return [clamp(r - 18), clamp(g + 10), clamp(b + 28)];
    if (warmth > 12) return [clamp(r + 22), clamp(g + 4),  clamp(b - 28)];
    if (warmth < -8) return [clamp(r - 10), clamp(g + 6),  clamp(b + 18)];
    return [r, g, b];
  },
  'golden-hour': (r, g, b) => [clamp(r * 1.12 + 22), clamp(g * 1.02 + 8), clamp(b * 0.72 - 18)],
  'arctic': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    return [clamp(r * 0.6 + lum * 0.4 - 12), clamp(g * 0.7 + lum * 0.3 + 2), clamp(b * 1.1 + 28)];
  },
  'noir': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114, con = clamp((lum - 128) * 1.45 + 128);
    const warm = lum > 185 ? 10 : 0;
    return [clamp(con + warm), clamp(con), clamp(con - warm - 5)];
  },
  'moody': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114, sat = 0.48;
    const nr = r * sat + lum * (1 - sat), ng = g * sat + lum * (1 - sat), nb = b * sat + lum * (1 - sat);
    const lift = lum < 55 ? (55 - lum) * 0.35 : 0;
    return [clamp(nr * 0.92 + lift), clamp(ng * 0.94 + lift), clamp(nb * 1.08 + lift + 12)];
  },
  'vellichor': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114, sat = 0.62;
    const nr = r * sat + lum * (1 - sat), ng = g * sat + lum * (1 - sat), nb = b * sat + lum * (1 - sat);
    const lift = Math.max(0, 65 - lum) * 0.38;
    return [clamp(nr + lift * 1.3 + 12), clamp(ng + lift * 0.9 + 6), clamp(nb + lift * 0.4 - 12)];
  },

  // ── Vintage ───────────────────────────────────────────────────────────────
  'polaroid': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    // Lift blacks, warm yellow cast, slight overexposure
    const lift = lum < 40 ? (40 - lum) * 0.6 : 0;
    return [clamp(r * 1.06 + lift + 18), clamp(g * 1.01 + lift + 10), clamp(b * 0.88 + lift + 2)];
  },
  'kodachrome': (r, g, b) => {
    // Rich reds, punchy contrast, warm
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const con = (v: number) => clamp((v - 128) * 1.25 + 128);
    return [clamp(con(r) * 1.1 + 10), clamp(con(g) * 0.96), clamp(con(b) * 0.85 - 8)];
  },
  'cross-process': (r, g, b) => {
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    // Green shadows, red/yellow highlights, high contrast
    const shadow = lum < 80;
    const highlight = lum > 175;
    return [
      clamp(highlight ? r * 1.15 + 15 : r * 0.9),
      clamp(shadow ? g * 1.2 + 20 : g * 0.95),
      clamp(shadow ? b * 0.7 - 15 : b * 0.85 - 10),
    ];
  },
  'lomo': (r, g, b) => {
    // Over-saturated, strong colours, colour cast
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const sat = 1.5;
    const nr = r * sat + lum * (1 - sat), ng = g * sat + lum * (1 - sat), nb = b * sat + lum * (1 - sat);
    return [clamp(nr * 1.05 + 8), clamp(ng * 0.98), clamp(nb * 0.9 - 10)];
  },
  'faded': (r, g, b) => {
    // Washed, low contrast, lifted blacks, slight blue-green
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const sat = 0.55;
    const nr = r * sat + lum * (1 - sat), ng = g * sat + lum * (1 - sat), nb = b * sat + lum * (1 - sat);
    return [clamp(nr * 0.78 + 35), clamp(ng * 0.82 + 30), clamp(nb * 0.9 + 28)];
  },
  'vhs': (r, g, b) => {
    // Green/yellow cast, slight colour offset feel, noisy
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    const noise = (Math.random() - 0.5) * 12;
    return [clamp(r * 0.88 + noise * 0.5), clamp(g * 1.05 + 8 + noise * 0.3), clamp(b * 0.82 - 5 + noise * 0.5)];
  },
};

const applyGrade = (data: Uint8ClampedArray, preset: GradePreset, strength: number): Uint8ClampedArray => {
  const fn  = GRADES[preset];
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [nr, ng, nb] = fn(data[i], data[i + 1], data[i + 2]);
    out[i]     = clamp(data[i]     + (nr - data[i])     * strength);
    out[i + 1] = clamp(data[i + 1] + (ng - data[i + 1]) * strength);
    out[i + 2] = clamp(data[i + 2] + (nb - data[i + 2]) * strength);
    out[i + 3] = data[i + 3];
  }
  return out;
};

// ─── Pixel sort ──────────────────────────────────────────────────────────────

type SortMode = 'brightness' | 'hue' | 'saturation';
type SortDir  = 'up' | 'down' | 'left' | 'right';

const getSortValue = (data: Uint8ClampedArray, i: number, mode: SortMode): number => {
  const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
  if (mode === 'brightness') return r * 0.299 + g * 0.587 + b * 0.114;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (mode === 'saturation') {
    if (max === 0) return 0;
    return d / max;
  }
  // hue
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return h / 6;
};

const applyPixelSort = (
  data: Uint8ClampedArray, w: number, h: number,
  threshold: number, direction: SortDir, mode: SortMode,
): Uint8ClampedArray => {
  const out    = new Uint8ClampedArray(data);
  const thresh = threshold / 255;
  const isHoriz = direction === 'left' || direction === 'right';
  const outer  = isHoriz ? h : w;
  const inner  = isHoriz ? w : h;
  const rev    = direction === 'up' || direction === 'left';

  for (let a = 0; a < outer; a++) {
    // Collect pixel indices for this row/column
    const indices: number[] = [];
    for (let b2 = 0; b2 < inner; b2++) {
      const x = isHoriz ? b2 : a;
      const y = isHoriz ? a  : b2;
      indices.push((y * w + x) * 4);
    }

    // Find runs above brightness threshold and sort them
    let inRun = false, runStart = 0;
    const flush = (end: number) => {
      if (end - runStart < 2) return;
      const run    = indices.slice(runStart, end);
      const sorted = [...run].sort((ia, ib) => getSortValue(data, ia, mode) - getSortValue(data, ib, mode));
      if (rev) sorted.reverse();
      for (let k = 0; k < run.length; k++) {
        out[run[k]]     = data[sorted[k]];
        out[run[k] + 1] = data[sorted[k] + 1];
        out[run[k] + 2] = data[sorted[k] + 2];
        out[run[k] + 3] = data[sorted[k] + 3];
      }
    };

    for (let bi = 0; bi < indices.length; bi++) {
      const bright = getSortValue(data, indices[bi], 'brightness');
      if (bright > thresh && !inRun) { inRun = true; runStart = bi; }
      else if (bright <= thresh && inRun) { inRun = false; flush(bi); }
    }
    if (inRun) flush(indices.length);
  }
  return out;
};

// ─── Dispersion ──────────────────────────────────────────────────────────────

type DispersionDir = 'up' | 'right' | 'down' | 'chaos' | 'radial';

const applyDispersion = (
  data: Uint8ClampedArray, w: number, h: number,
  threshold: number, strength: number,
  direction: DispersionDir, spread: number,
): Uint8ClampedArray => {
  const thresh = threshold / 255;

  // ── Sobel — magnitude + outward gradient angle ────────────────────────────
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114) / 255;
  }

  const GX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const GY = [ 1, 2, 1,  0, 0, 0, -1,-2,-1];
  const edges  = new Float32Array(w * h);
  const gAngle = new Float32Array(w * h);
  let maxMag = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = lum[(y + dy) * w + (x + dx)];
          gx += GX[k] * v; gy += GY[k] * v; k++;
        }
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * w + x]  = mag;
      gAngle[y * w + x] = Math.atan2(gy, gx); // naturally points toward background
      if (mag > maxMag) maxMag = mag;
    }
  }
  if (maxMag > 0) for (let i = 0; i < edges.length; i++) edges[i] /= maxMag;

  // ── Build base: original image with edge pixels dissolved ─────────────────
  const offCanvas = document.createElement('canvas');
  offCanvas.width  = w;
  offCanvas.height = h;
  const ctx = offCanvas.getContext('2d')!;

  const base = new Uint8ClampedArray(data.length);
  for (let i = 0; i < w * h; i++) {
    const si = i * 4;
    const edge = edges[i];
    if (edge >= thresh) {
      const ef      = (edge - thresh) / (1 - thresh);
      const dissolve = ef * ef * ef; // cubic — dramatic vanish at strong edges
      base[si]     = clamp(data[si]     * (1 - dissolve));
      base[si + 1] = clamp(data[si + 1] * (1 - dissolve));
      base[si + 2] = clamp(data[si + 2] * (1 - dissolve));
      base[si + 3] = data[si + 3];
    } else {
      base[si] = data[si]; base[si+1] = data[si+1];
      base[si+2] = data[si+2]; base[si+3] = data[si+3];
    }
  }
  ctx.putImageData(new ImageData(base, w, h), 0, 0);

  // ── Draw particles as anti-aliased canvas arcs ────────────────────────────
  // Canvas2D arcs give sub-pixel positioning, anti-aliasing, and natural
  // alpha accumulation where multiple particles overlap — far more visible
  // than writing individual pixels to a buffer.
  const cx = w / 2, cy = h / 2;
  const FIXED: Record<string, number> = {
    up: -Math.PI / 2, right: 0, down: Math.PI / 2, chaos: 0, radial: 0,
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i    = y * w + x;
      const edge = edges[i];
      if (edge < thresh) continue;

      const ef = (edge - thresh) / (1 - thresh);
      if (ef < 0.06) continue; // skip very weak edges

      const nx = (x / w) * 5, ny = (y / h) * 5;
      const noise = fbm(nx, ny, 3); // –1 to 1

      let angle: number;
      if (direction === 'chaos') {
        angle = noise * Math.PI * 2;
      } else if (direction === 'radial') {
        angle = Math.atan2(y - cy, x - cx) + noise * Math.PI * 0.4 * spread;
      } else {
        // Blend: gradient-outward (natural) ↔ fixed direction, via spread
        const gradDir  = gAngle[i];
        const fixedDir = FIXED[direction];
        angle = gradDir  * (1 - spread * 0.65) +
                fixedDir * spread * 0.65 +
                noise * Math.PI * 0.55 * spread;
      }

      const distNoise = fbm(nx + 9.1, ny + 3.7, 2) * 0.4 + 0.6;
      const dist      = ef * strength * distNoise;
      const px        = x + Math.cos(angle) * dist;
      const py        = y + Math.sin(angle) * dist;
      if (px < 0 || px > w || py < 0 || py > h) continue;

      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const radius = 1.0 + ef * 2.8; // 1 → 3.8 px — visibly scattered particles

      ctx.globalAlpha = Math.min(0.92, ef * 0.88 + 0.08);
      ctx.fillStyle   = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  return new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
};

// ─── Canvas-based dithering ───────────────────────────────────────────────────
// All three algorithms read actual pixel values so they export correctly.
// Scale controls Bayer cell size (ordered) or quantisation levels (error diffusion).

// Bayer matrix generator — standard recursive construction, n must be a power
// of two. Verified against the previous hardcoded 4×4 table (identical output),
// generalised so users can pick pattern coarseness: 2×2 = very coarse/graphic,
// 16×16 = fine, near-photographic ordered dither.
const bayerMatrixCache = new Map<number, number[][]>();
const buildBayerMatrix = (n: number): number[][] => {
  const cached = bayerMatrixCache.get(n);
  if (cached) return cached;
  if (n <= 1) { const m = [[0]]; bayerMatrixCache.set(1, m); return m; }
  const half   = buildBayerMatrix(n / 2);
  const halfN  = n / 2;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let y = 0; y < halfN; y++) {
    for (let x = 0; x < halfN; x++) {
      const v = half[y][x] * 4;
      m[y][x]                     = v;
      m[y][x + halfN]             = v + 2;
      m[y + halfN][x]             = v + 3;
      m[y + halfN][x + halfN]     = v + 1;
    }
  }
  bayerMatrixCache.set(n, m);
  return m;
};

const applyCanvasDither = (
  data: Uint8ClampedArray, w: number, h: number,
  style: 'bayer' | 'floyd-steinberg' | 'atkinson', scale: number,
  matrixSize: number = 4,
): Uint8ClampedArray => {
  // Quantisation levels: scale 1→8 levels, scale 8→2 levels
  const levels = Math.max(2, Math.round(10 - scale * 1.0));
  const step   = 255 / (levels - 1);

  // ── Bayer ordered dither ──────────────────────────────────────────────────
  if (style === 'bayer') {
    const n      = Math.max(2, matrixSize);
    const matrix = buildBayerMatrix(n);
    const denom  = n * n;
    const out = new Uint8ClampedArray(data);
    // Scale the per-cell pixel footprint inversely with matrix size (4×4 is
    // the baseline, so behaviour at the default matrix size is unchanged).
    // Without this, a bigger matrix only grows the pattern's invisible repeat
    // period — the visible dot size never shrinks, so 8×8/16×16 look almost
    // identical to 4×4 at normal viewing size. This makes bigger matrices
    // genuinely render finer, more detailed dithering.
    const cellSize = Math.max(1, Math.round(scale * (4 / n)));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        const mx = Math.floor(x / cellSize) % n;
        const my = Math.floor(y / cellSize) % n;
        const t  = (matrix[my][mx] / denom - 0.5) * step; // signed offset
        for (let c = 0; c < 3; c++) {
          out[i + c] = clamp(Math.round((data[i + c] + t) / step) * step);
        }
      }
    }
    return out;
  }

  // ── Error diffusion (Floyd-Steinberg and Atkinson) ────────────────────────
  const buf = new Float32Array(w * h * 4);
  for (let i = 0; i < data.length; i++) buf[i] = data[i];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const old = Math.max(0, Math.min(255, buf[i + c]));
        const nw  = Math.round(old / step) * step;
        buf[i + c] = nw;
        const err = old - nw;

        if (style === 'floyd-steinberg') {
          if (x + 1 < w)               buf[(y * w + x + 1) * 4 + c]       += err * 7 / 16;
          if (y + 1 < h) {
            if (x > 0)                  buf[((y+1)*w + x-1) * 4 + c]       += err * 3 / 16;
                                        buf[((y+1)*w + x  ) * 4 + c]       += err * 5 / 16;
            if (x + 1 < w)             buf[((y+1)*w + x+1) * 4 + c]       += err * 1 / 16;
          }
        } else {
          // Atkinson — distributes 6/8 of error (creates lighter, more open look)
          const e = err / 8;
          if (x + 1 < w)               buf[(y * w + x + 1) * 4 + c]       += e;
          if (x + 2 < w)               buf[(y * w + x + 2) * 4 + c]       += e;
          if (y + 1 < h) {
            if (x > 0)                  buf[((y+1)*w + x-1) * 4 + c]       += e;
                                        buf[((y+1)*w + x  ) * 4 + c]       += e;
            if (x + 1 < w)             buf[((y+1)*w + x+1) * 4 + c]       += e;
          }
          if (y + 2 < h)               buf[((y+2)*w + x  ) * 4 + c]       += e;
        }
      }
    }
  }

  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i]     = clamp(Math.round(buf[i]));
    out[i + 1] = clamp(Math.round(buf[i + 1]));
    out[i + 2] = clamp(Math.round(buf[i + 2]));
    out[i + 3] = data[i + 3];
  }
  return out;
};

// ─── Duotone dithering ────────────────────────────────────────────────────────
// Dithers on luminance only (single channel, not per-RGB), then maps the
// quantised tone through two custom colors instead of grayscale. This is the
// halftone screen-print / Risograph look — dot/error-diffusion density creates
// the illusion of intermediate tones using only two flat ink colors.

const applyDuotoneDither = (
  data: Uint8ClampedArray, w: number, h: number,
  style: 'bayer' | 'floyd-steinberg' | 'atkinson', scale: number,
  shadowColor: string, highlightColor: string,
  // levels: explicit tonal steps, independent of the dot-cell/scale size.
  //   2 = classic pure two-ink halftone (single dot density curve).
  //   3-8 = a richer duotone with visible intermediate density bands —
  //   still just two flat colors, but the dithering shows more gradation.
  levels: number = 2,
  invert: boolean = false,
  matrixSize: number = 4,
): Uint8ClampedArray => {
  const parseHex = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
  };
  const [sr, sg, sb] = parseHex(shadowColor);
  const [hr, hg, hb] = parseHex(highlightColor);

  const lvl  = Math.max(2, Math.min(16, Math.round(levels)));
  const step = 255 / (lvl - 1);

  // Per-pixel luminance — this is what gets dithered/quantised, not RGB
  const lum = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    lum[p] = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
  }

  const out = new Uint8ClampedArray(data);
  const mapTone = (rawT: number, i: number) => {
    const t = invert ? 1 - rawT : rawT;
    out[i]   = clamp(sr + (hr - sr) * t);
    out[i+1] = clamp(sg + (hg - sg) * t);
    out[i+2] = clamp(sb + (hb - sb) * t);
  };

  if (style === 'bayer') {
    const n      = Math.max(2, matrixSize);
    const matrix = buildBayerMatrix(n);
    const denom  = n * n;
    // Same 4×4-baseline inverse scaling as applyCanvasDither — see comment there.
    const cellSize = Math.max(1, Math.round(scale * (4 / n)));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p  = y * w + x, i = p * 4;
        const mx = Math.floor(x / cellSize) % n;
        const my = Math.floor(y / cellSize) % n;
        const t  = (matrix[my][mx] / denom - 0.5) * step;
        const q  = clamp(Math.round((lum[p] + t) / step) * step);
        mapTone(q / 255, i);
      }
    }
    return out;
  }

  // Error diffusion — propagated across the single luminance buffer
  const buf = new Float32Array(lum);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      const old = Math.max(0, Math.min(255, buf[p]));
      const nw  = Math.round(old / step) * step;
      buf[p] = nw;
      const err = old - nw;
      mapTone(nw / 255, i);

      if (style === 'floyd-steinberg') {
        if (x + 1 < w)               buf[p + 1]     += err * 7 / 16;
        if (y + 1 < h) {
          if (x > 0)                  buf[p + w - 1] += err * 3 / 16;
                                      buf[p + w]     += err * 5 / 16;
          if (x + 1 < w)             buf[p + w + 1] += err * 1 / 16;
        }
      } else {
        // Atkinson — distributes 6/8 of error (lighter, more open dot pattern)
        const e = err / 8;
        if (x + 1 < w)               buf[p + 1]     += e;
        if (x + 2 < w)               buf[p + 2]     += e;
        if (y + 1 < h) {
          if (x > 0)                  buf[p + w - 1] += e;
                                      buf[p + w]     += e;
          if (x + 1 < w)             buf[p + w + 1] += e;
        }
        if (y + 2 < h)               buf[p + 2 * w] += e;
      }
    }
  }
  return out;
};

// ─── ASCII dithering ───────────────────────────────────────────────────────────
// Samples average color/luminance per grid cell and renders a monospace
// character from a density ramp instead of a dot — classic terminal/code-art.
// Text can only be rasterised via Canvas2D fillText, so this draws onto an
// offscreen canvas and reads the pixels back out as a Uint8ClampedArray, which
// keeps the same function shape as every other effect in this pipeline.
// Reuses the duotone color state: when Duotone is on, characters are drawn in
// a single ink color over a flat background (poster look). When off, each
// character is colorized with its own cell's average source color — full
// color ASCII mosaic on black, closer to classic BBS/demoscene art.

const ASCII_RAMP = ' .:-=+*#%@'; // light → dark, 10 density steps

const applyAsciiDither = (
  data: Uint8ClampedArray, w: number, h: number,
  charSize: number,  // px — independent of the shared dot/cell Scale, needs to
                      // be legible (6px reads as static, 12-20px reads as glyphs)
  brightness: number, // -100..100 — biases luminance before ramp mapping, so
                       // shadow-heavy source images don't collapse into a flat
                       // black void (the ramp's bottom two steps are near-empty)
  duotone: boolean, shadowColor: string, highlightColor: string, invert: boolean,
): Uint8ClampedArray => {
  const cellPx = Math.max(4, Math.round(charSize));

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d')!;

  const bg = duotone ? (invert ? highlightColor : shadowColor) : '#000000';
  octx.fillStyle = bg;
  octx.fillRect(0, 0, w, h);

  octx.font = `700 ${cellPx}px monospace`;
  octx.textBaseline = 'top';

  const cols = Math.ceil(w / cellPx);
  const rows = Math.ceil(h / cellPx);

  for (let ry = 0; ry < rows; ry++) {
    const cy = ry * cellPx;
    const cellH = Math.min(cellPx, h - cy);
    if (cellH <= 0) continue;

    for (let rx = 0; rx < cols; rx++) {
      const cx = rx * cellPx;
      const cellW = Math.min(cellPx, w - cx);
      if (cellW <= 0) continue;

      // Sample directly from the source pixel array (no getImageData calls
      // per cell — those are expensive). Subsample large cells with a stride
      // so bigger character sizes don't cost proportionally more.
      let rSum = 0, gSum = 0, bSum = 0, n = 0;
      const strideX = Math.max(1, Math.floor(cellW / 4));
      const strideY = Math.max(1, Math.floor(cellH / 4));
      for (let y = 0; y < cellH; y += strideY) {
        for (let x = 0; x < cellW; x += strideX) {
          const i = ((cy + y) * w + (cx + x)) * 4;
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
          n++;
        }
      }
      if (n === 0) continue;
      const ar = rSum / n, ag = gSum / n, ab = bSum / n;
      // Brightness bias applied in 0-255 space before normalising — pulls
      // shadow regions up into visible glyph territory instead of leaving
      // them as flat background with zero dot/character texture.
      const lumRaw = Math.max(0, Math.min(255, ar * 0.299 + ag * 0.587 + ab * 0.114 + brightness));
      const lum = lumRaw / 255;
      const t = invert ? 1 - lum : lum;

      const idx   = Math.min(ASCII_RAMP.length - 1, Math.floor(t * ASCII_RAMP.length));
      const glyph = ASCII_RAMP[idx];
      if (glyph === ' ') continue; // skip drawing — leaves the background showing

      octx.fillStyle = duotone
        ? (invert ? shadowColor : highlightColor)
        : `rgb(${Math.round(ar)},${Math.round(ag)},${Math.round(ab)})`;
      octx.fillText(glyph, cx, cy);
    }
  }

  return new Uint8ClampedArray(octx.getImageData(0, 0, w, h).data);
};

// ─── CMYK Separation ───────────────────────────────────────────────────────────
// Converts the source to CMYK and renders each of the four plates as its own
// halftone dot layer at the classic print-production screen angles (C 15°,
// M 75°, Y 0°, K 45° — staggered specifically to avoid moiré between plates,
// exactly as real offset-press separations are set up).
//
// Dots are rasterised directly into a Uint8ClampedArray (bounding-box +
// distance-check per circle) rather than via Canvas2D arc()/fill() calls.
// Canvas draw calls carry real per-call overhead (path tessellation,
// compositing) — at four full-canvas dot-grid passes that overhead was
// enough to stall the main thread for seconds. Plain array writes are the
// same technique every other effect in this pipeline already uses and cost
// a fraction of the time for the same visual result.

const applyCmykSeparation = (
  data: Uint8ClampedArray, w: number, h: number,
  dotSize: number, spacing: number,
): Uint8ClampedArray => {
  // Per-pixel CMYK conversion — naive/non-color-managed, which is standard
  // and sufficient for a stylistic print-reproduction effect like this.
  const C = new Float32Array(w * h), M = new Float32Array(w * h);
  const Y = new Float32Array(w * h), K = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    const r = data[i] / 255, g = data[i+1] / 255, b = data[i+2] / 255;
    let c = 1 - r, m = 1 - g, y = 1 - b;
    const k = Math.min(c, m, y);
    if (k < 1) { c = (c - k) / (1 - k); m = (m - k) / (1 - k); y = (y - k) / (1 - k); }
    else { c = 0; m = 0; y = 0; }
    C[p] = c; M[p] = m; Y[p] = y; K[p] = k;
  }

  // Output starts as white paper
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255; out[i+1] = 255; out[i+2] = 255; out[i+3] = 255;
  }

  const sample = (arr: Float32Array) => (x: number, y: number) => {
    const px = Math.max(0, Math.min(w - 1, Math.round(x)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y)));
    return arr[py * w + px];
  };

  // One plate = one rotated dot-grid pass. Each dot is rasterised straight
  // into `out` with a multiply blend, so overprinting plates darken exactly
  // like real ink layers — same math as the canvas version, no canvas API.
  const drawPlate = (getAmount: (x: number, y: number) => number, ink: [number, number, number], angleDeg: number) => {
    const [ir, ig, ib] = ink;
    const rad  = (angleDeg * Math.PI) / 180;
    const cos  = Math.cos(rad), sin = Math.sin(rad);
    const cx   = w / 2, cy = h / 2;
    const diag = Math.sqrt(w * w + h * h);
    const half = diag / 2;

    for (let v = -half; v <= half; v += spacing) {
      for (let u = -half; u <= half; u += spacing) {
        const sx = cx + u * cos - v * sin;
        const sy = cy + u * sin + v * cos;
        // Slightly loose bounds (±dotSize) so dots straddling the edge don't clip
        if (sx < -dotSize || sx >= w + dotSize || sy < -dotSize || sy >= h + dotSize) continue;

        const amt = getAmount(Math.max(0, Math.min(w - 1, sx)), Math.max(0, Math.min(h - 1, sy)));
        const r = amt * dotSize;
        if (r <= 0.3) continue;

        const r2   = r * r;
        const minX = Math.max(0, Math.floor(sx - r)), maxX = Math.min(w - 1, Math.ceil(sx + r));
        const minY = Math.max(0, Math.floor(sy - r)), maxY = Math.min(h - 1, Math.ceil(sy + r));
        for (let py = minY; py <= maxY; py++) {
          const dy = py - sy;
          for (let px = minX; px <= maxX; px++) {
            const dx = px - sx;
            if (dx * dx + dy * dy > r2) continue;
            const oi = (py * w + px) * 4;
            out[oi]   = clamp(out[oi]   * ir / 255);
            out[oi+1] = clamp(out[oi+1] * ig / 255);
            out[oi+2] = clamp(out[oi+2] * ib / 255);
          }
        }
      }
    }
  };

  drawPlate(sample(C), [0, 174, 239], 15);   // cyan    #00AEEF
  drawPlate(sample(M), [236, 0, 140], 75);   // magenta #EC008C
  drawPlate(sample(Y), [255, 242, 0], 0);    // yellow  #FFF200
  drawPlate(sample(K), [26, 25, 23], 45);    // black (warm-black, matches HeroKit's ink tone)

  return out;
};

// ─── Halftone ───────────────────────────────────────────────────────────────────
// Was previously a separate CSS mix-blend-mode:multiply overlay canvas that
// sampled the raw source image directly — entirely outside the main pixel
// pipeline, which is why it never respected Effect Mask (or reacted to any
// other effect stacked before it, like Color Grade). Ported to pure array
// compositing using the same bounding-box circle-stamp technique as CMYK
// Separation: reads from `data` (whatever the pipeline has produced so far),
// multiply-blends the ink color in directly, no Canvas2D draw calls.

const applyHalftonePixels = (
  data: Uint8ClampedArray, w: number, h: number,
  pattern: 'dot' | 'line' | 'crosshatch',
  dotSize: number, spacing: number, angle: number,
  color: string, opacity: number, invert: boolean,
  // Duotone mode: instead of multiply-blending the ink color over the source
  // image, the whole frame is first flattened to `bgColor`, then the ink
  // color is stamped in as flat opaque coverage — the two-flat-ink screen
  // print look (dot size still modulated by the source image's brightness,
  // exactly like the standard mode, just no third color from the photo
  // showing through).
  duotone: boolean = false, bgColor: string = '#ebf2b5',
): Uint8ClampedArray => {
  const parseHex = (hex: string): [number, number, number] => {
    const h2 = hex.replace('#', '');
    return [parseInt(h2.slice(0,2),16)||0, parseInt(h2.slice(2,4),16)||0, parseInt(h2.slice(4,6),16)||0];
  };
  const [cr, cg, cb] = parseHex(color);
  const out = new Uint8ClampedArray(data);

  const getBrightness = (x: number, y: number): number => {
    const px = Math.max(0, Math.min(w - 1, Math.round(x)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y)));
    const i  = (py * w + px) * 4;
    return (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
  };

  if (duotone) {
    const [br, bgc, bb] = parseHex(bgColor);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      out[i] = br; out[i+1] = bgc; out[i+2] = bb;
    }
  }

  // Standard mode multiply-blends the ink color into `out` at full coverage,
  // scaled by opacity (matches the old CSS mix-blend-mode: multiply
  // behaviour). Duotone mode lerps straight toward the flat ink color
  // instead, since `out` is now the flattened background, not photo detail.
  const drawCircle = (cx: number, cy: number, r: number) => {
    if (r <= 0.2) return;
    const minX = Math.max(0, Math.floor(cx - r)), maxX = Math.min(w - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r)), maxY = Math.min(h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let py = minY; py <= maxY; py++) {
      const dy = py - cy;
      for (let px = minX; px <= maxX; px++) {
        const dx = px - cx;
        if (dx * dx + dy * dy > r2) continue;
        const i = (py * w + px) * 4;
        if (duotone) {
          out[i]   = out[i]   * (1 - opacity) + cr * opacity;
          out[i+1] = out[i+1] * (1 - opacity) + cg * opacity;
          out[i+2] = out[i+2] * (1 - opacity) + cb * opacity;
        } else {
          out[i]   = out[i]   * (1 - opacity) + (out[i]   * cr / 255) * opacity;
          out[i+1] = out[i+1] * (1 - opacity) + (out[i+1] * cg / 255) * opacity;
          out[i+2] = out[i+2] * (1 - opacity) + (out[i+2] * cb / 255) * opacity;
        }
      }
    }
  };

  if (pattern === 'dot') {
    for (let row = 0; row * spacing <= h + spacing; row++) {
      const yc   = row * spacing;
      const xOff = row % 2 === 1 ? spacing / 2 : 0;
      for (let col = -1; col * spacing <= w + spacing; col++) {
        const xc = col * spacing + xOff;
        if (xc < -dotSize || xc > w + dotSize || yc < -dotSize || yc > h + dotSize) continue;
        const brightness = getBrightness(xc, yc);
        const t = invert ? brightness : 1 - brightness;
        drawCircle(xc, yc, Math.max(0, t * dotSize));
      }
    }
  } else {
    // Line / crosshatch — sample a rotated grid, stamping small overlapping
    // circles along each line (a "stamp brush" approach) instead of rotating
    // the whole canvas transform, so this stays pure array math throughout.
    const angles = pattern === 'crosshatch' ? [angle, angle + 90] : [angle];
    angles.forEach(a => {
      const rad  = (a * Math.PI) / 180;
      const cos  = Math.cos(rad), sin = Math.sin(rad);
      const cx   = w / 2, cy = h / 2;
      const diag = Math.sqrt(w * w + h * h);
      const half = diag / 2;
      const lineStep = Math.max(1.5, spacing / 5);

      for (let v = -half; v <= half; v += spacing) {
        for (let u = -half; u <= half; u += lineStep) {
          const sx = cx + u * cos - v * sin;
          const sy = cy + u * sin + v * cos;
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
          const brightness = getBrightness(sx, sy);
          const t = invert ? brightness : 1 - brightness;
          const thickness = Math.max(0, t * dotSize);
          if (thickness > 0.3) drawCircle(sx, sy, thickness / 2);
        }
      }
    });
  }

  return out;
};

// ─── RGB Channel Smear ───────────────────────────────────────────────────────

const sortOneChannel = (
  data: Uint8ClampedArray, w: number, h: number,
  channel: 0 | 1 | 2,
  direction: 'up' | 'down' | 'left' | 'right',
  threshold: number,
): Float32Array => {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = data[i * 4 + channel];

  const isHoriz = direction === 'left' || direction === 'right';
  const outer   = isHoriz ? h : w;
  const inner   = isHoriz ? w : h;
  const rev     = direction === 'up' || direction === 'left';

  for (let a = 0; a < outer; a++) {
    const idx = (b: number) => isHoriz ? a * w + b : b * w + a;
    let inRun = false, runStart = 0;

    const flush = (end: number) => {
      if (end - runStart < 2) return;
      const indices: number[] = [];
      for (let b = runStart; b < end; b++) indices.push(idx(b));
      const vals = indices.map(i => out[i]);
      vals.sort((a, b) => a - b);
      if (rev) vals.reverse();
      for (let i = 0; i < indices.length; i++) out[indices[i]] = vals[i];
    };

    for (let b = 0; b < inner; b++) {
      const val = out[idx(b)];
      if (val > threshold && !inRun)  { inRun = true;  runStart = b; }
      else if (val <= threshold && inRun) { inRun = false; flush(b); }
    }
    if (inRun) flush(inner);
  }
  return out;
};

const applyChannelSmear = (
  data: Uint8ClampedArray, w: number, h: number, threshold: number,
  rDir: 'up'|'down'|'left'|'right',
  gDir: 'up'|'down'|'left'|'right',
  bDir: 'up'|'down'|'left'|'right',
): Uint8ClampedArray => {
  const r = sortOneChannel(data, w, h, 0, rDir, threshold);
  const g = sortOneChannel(data, w, h, 1, gDir, threshold);
  const b = sortOneChannel(data, w, h, 2, bDir, threshold);
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < w * h; i++) {
    out[i * 4]     = r[i];
    out[i * 4 + 1] = g[i];
    out[i * 4 + 2] = b[i];
    out[i * 4 + 3] = data[i * 4 + 3];
  }
  return out;
};

// ─── Image Glitch ────────────────────────────────────────────────────────────

type GlitchStyle = 'digital' | 'corrupt' | 'signal';

const applyImageGlitch = (
  data: Uint8ClampedArray, w: number, h: number,
  intensity: number, shift: number, rgbSplit: number,
  style: GlitchStyle,
): Uint8ClampedArray => {
  const out   = new Uint8ClampedArray(data);
  const chance = intensity / 100;

  // Fast seeded PRNG (Mulberry32) so each render is reproducible but unique per call
  let s = (Math.random() * 0xffffffff) | 0;
  const rand = (): number => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const copyRow = (
    srcY: number, dstY: number, hShift: number,
    rShift: number, bShift: number,
  ) => {
    if (srcY < 0 || srcY >= h || dstY < 0 || dstY >= h) return;
    for (let x = 0; x < w; x++) {
      const di  = (dstY * w + x) * 4;
      const gx  = Math.max(0, Math.min(w - 1, x + hShift | 0));
      const rx  = Math.max(0, Math.min(w - 1, x + hShift + rShift | 0));
      const bx  = Math.max(0, Math.min(w - 1, x + hShift - bShift | 0));
      out[di]     = data[(srcY * w + rx) * 4];
      out[di + 1] = data[(srcY * w + gx) * 4 + 1];
      out[di + 2] = data[(srcY * w + bx) * 4 + 2];
      out[di + 3] = data[(srcY * w + gx) * 4 + 3];
    }
  };

  if (style === 'digital' || style === 'signal') {
    let y = 0;
    while (y < h) {
      const glitch = rand() < chance;
      const blockH = (rand() * 10 + 1) | 0; // 1–10 rows per block

      if (glitch) {
        const hShift  = (rand() * 2 - 1) * shift;
        const hasRgb  = rand() < 0.55;
        const rShift  = hasRgb ? rand() * rgbSplit : 0;
        const bShift  = hasRgb ? rand() * rgbSplit : 0;
        const hasColor = style === 'signal' && rand() < 0.35;
        const cr = rand() * 255, cg = rand() * 255, cb = rand() * 255;
        const cm = 0.15 + rand() * 0.25;

        for (let dy = 0; dy < blockH && y + dy < h; dy++) {
          copyRow(y + dy, y + dy, hShift | 0, rShift | 0, bShift | 0);
          if (hasColor) {
            for (let x = 0; x < w; x++) {
              const di = ((y + dy) * w + x) * 4;
              out[di]     = clamp(out[di]     * (1 - cm) + cr * cm);
              out[di + 1] = clamp(out[di + 1] * (1 - cm) + cg * cm);
              out[di + 2] = clamp(out[di + 2] * (1 - cm) + cb * cm);
            }
          }
        }
      }
      y += blockH;
    }
  }

  if (style === 'corrupt') {
    const blockH = Math.max(2, (h * 0.025) | 0);
    for (let by = 0; by < h; by += blockH) {
      if (rand() > chance) continue;
      const srcY   = Math.max(0, Math.min(h - blockH, (by + (rand() * 2 - 1) * h * 0.12) | 0));
      const hShift = (rand() * 2 - 1) * shift;
      const rShift = rand() < 0.5 ? rand() * rgbSplit : 0;
      const bShift = rand() < 0.5 ? rand() * rgbSplit : 0;

      for (let dy = 0; dy < blockH && by + dy < h; dy++) {
        copyRow(srcY + dy, by + dy, hShift | 0, rShift | 0, bShift | 0);
      }
    }
  }

  return out;
};

// ─── Edge Glow / Neon ────────────────────────────────────────────────────────
// Sobel edge detection → colorise edges → gaussian bloom → composite over base

const applyEdgeGlow = (
  data: Uint8ClampedArray, w: number, h: number,
  color: string, intensity: number, bloom: number, darken: number,
): Uint8ClampedArray => {
  // Sobel edges on luminance
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114) / 255;
  }
  const GX = [-1,0,1,-2,0,2,-1,0,1], GY = [1,2,1,0,0,0,-1,-2,-1];
  const edges = new Float32Array(w * h);
  let mx = 0;
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      let gx = 0, gy = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const v = lum[(y+dy)*w + (x+dx)]; gx += GX[k]*v; gy += GY[k]*v; k++;
      }
      const mag = Math.sqrt(gx*gx + gy*gy); edges[y*w+x] = mag; if (mag > mx) mx = mag;
    }
  }
  if (mx > 0) for (let i = 0; i < edges.length; i++) edges[i] /= mx;

  const hex = color.replace('#','');
  const cr = parseInt(hex.slice(0,2),16)||0, cg = parseInt(hex.slice(2,4),16)||255, cb = parseInt(hex.slice(4,6),16)||255;
  const str = intensity / 100;

  // Build edge glow canvas then blur it
  const glowOff = document.createElement('canvas'); glowOff.width = w; glowOff.height = h;
  const gCtx = glowOff.getContext('2d')!;
  const gImg = gCtx.createImageData(w, h);
  for (let i = 0; i < w*h; i++) {
    gImg.data[i*4]   = cr; gImg.data[i*4+1] = cg; gImg.data[i*4+2] = cb;
    gImg.data[i*4+3] = Math.round(edges[i] * str * 255);
  }
  gCtx.putImageData(gImg, 0, 0);

  // Bloom: draw edge layer blurred
  const bloomOff = document.createElement('canvas'); bloomOff.width = w; bloomOff.height = h;
  const bCtx = bloomOff.getContext('2d')!;
  bCtx.filter = `blur(${bloom}px)`; bCtx.drawImage(glowOff, 0, 0); bCtx.filter = 'none';
  // Second glow pass (tighter, brighter core)
  bCtx.globalAlpha = 0.6; bCtx.drawImage(glowOff, 0, 0); bCtx.globalAlpha = 1;

  // Composite: darken base then screen-blend the glow
  const compOff = document.createElement('canvas'); compOff.width = w; compOff.height = h;
  const cCtx = compOff.getContext('2d')!;

  // Darkened base
  const darkened = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    darkened[i]   = clamp(data[i]   * (1 - darken));
    darkened[i+1] = clamp(data[i+1] * (1 - darken));
    darkened[i+2] = clamp(data[i+2] * (1 - darken));
    darkened[i+3] = data[i+3];
  }
  cCtx.putImageData(new ImageData(darkened, w, h), 0, 0);
  cCtx.globalCompositeOperation = 'screen';
  cCtx.drawImage(bloomOff, 0, 0);
  cCtx.globalCompositeOperation = 'source-over';

  return new Uint8ClampedArray(cCtx.getImageData(0, 0, w, h).data);
};

// ─── Split Tone ───────────────────────────────────────────────────────────────
// Maps shadow tones to one colour and highlight tones to another

const applySplitTone = (
  data: Uint8ClampedArray, w: number, h: number,
  shadowColor: string, highlightColor: string, strength: number, balance: number,
): Uint8ClampedArray => {
  const parseHex = (hex: string): [number,number,number] => {
    const h = hex.replace('#','');
    return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
  };
  const [sr,sg,sb] = parseHex(shadowColor);
  const [hr,hg,hb] = parseHex(highlightColor);
  const str = strength / 100;
  const mid = 0.5 + (balance / 100) * 0.3; // balance shifts midpoint

  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const lum = (r*0.299 + g*0.587 + b*0.114) / 255;

    // Smooth influence zones — no hard cutoff
    const sInf = Math.max(0, 1 - lum / Math.max(0.001, mid)) * str;
    const hInf = Math.max(0, (lum - mid) / Math.max(0.001, 1 - mid)) * str;

    out[i]   = clamp(r + (sr - r) * sInf + (hr - r) * hInf);
    out[i+1] = clamp(g + (sg - g) * sInf + (hg - g) * hInf);
    out[i+2] = clamp(b + (sb - b) * sInf + (hb - b) * hInf);
  }
  return out;
};

// ─── Riso Print ─────────────────────────────────────────────────────────────
// Simulates Risograph duplicator printing: two flat spot-color ink layers,
// each independently halftone-dithered from the source luminance, offset from
// each other by a few pixels (real riso masters never register perfectly),
// and multiply-composited onto white paper (overlap darkens, like real ink
// overprint). Grain jitters the dither threshold near dot edges so coverage
// looks organic rather than perfectly crisp — real riso ink deposit varies.

const applyRisoPrint = (
  data: Uint8ClampedArray, w: number, h: number,
  scale: number, color1: string, color2: string,
  offset: number, grain: number,
): Uint8ClampedArray => {
  const parseHex = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16)||0, parseInt(h.slice(2,4),16)||0, parseInt(h.slice(4,6),16)||0];
  };
  const [r1, g1, b1] = parseHex(color1);
  const [r2, g2, b2] = parseHex(color2);

  // Per-pixel luminance from the source — this is what each ink plate dithers
  const lum = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    lum[p] = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
  }
  const sampleLum = (x: number, y: number): number => {
    const px = Math.max(0, Math.min(w - 1, Math.round(x)));
    const py = Math.max(0, Math.min(h - 1, Math.round(y)));
    return lum[py * w + px];
  };

  const cellSize = Math.max(1, Math.round(scale));
  const matrix   = buildBayerMatrix(4);
  const denom    = 16;
  const jitterAmt = (grain / 100) * 0.35;

  // Layers offset diagonally in opposite directions — visible misregistration
  const dx1 = -offset, dy1 = -offset * 0.6;
  const dx2 =  offset, dy2 =  offset * 0.6;

  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i  = (y * w + x) * 4;
      const mx = Math.floor(x / cellSize) % 4;
      const my = Math.floor(y / cellSize) % 4;
      const thresholdA = matrix[my][mx] / denom;
      // Half-cell phase shift for layer B — different screen phase per plate,
      // like real CMYK/riso plates avoid identical dot alignment (moiré).
      const mx2 = Math.floor((x + cellSize / 2) / cellSize) % 4;
      const my2 = Math.floor((y + cellSize / 2) / cellSize) % 4;
      const thresholdB = matrix[my2][mx2] / denom;

      const jA = (Math.random() - 0.5) * jitterAmt;
      const jB = (Math.random() - 0.5) * jitterAmt;

      const darknessA = 1 - sampleLum(x + dx1, y + dy1) / 255;
      const darknessB = 1 - sampleLum(x + dx2, y + dy2) / 255;
      const inkA = (darknessA + jA) > thresholdA;
      const inkB = (darknessB + jB) > thresholdB;

      // Multiply blend onto white paper — sequential multiplies simulate ink overprint
      let r = 255, g = 255, b = 255;
      if (inkA) { r = r * r1 / 255; g = g * g1 / 255; b = b * b1 / 255; }
      if (inkB) { r = r * r2 / 255; g = g * g2 / 255; b = b * b2 / 255; }

      out[i]   = clamp(r);
      out[i+1] = clamp(g);
      out[i+2] = clamp(b);
      out[i+3] = data[i+3];
    }
  }
  return out;
};

// ─── Chromatic Aberration ────────────────────────────────────────────────────
// Radial CA: R channel expands outward from centre, B contracts inward.
// Effect is zero at the centre and maximum at the corners — exactly like a real lens.

const applyCA = (
  data: Uint8ClampedArray, w: number, h: number, strength: number
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data.length);
  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const len  = dist || 1;
      const nx   = dx / len, ny = dy / len;

      // Shift scales linearly with distance (0 at centre → strength px at corner)
      const shift = (dist / maxDist) * strength;

      const rx = Math.max(0, Math.min(w - 1, x + nx * shift));
      const ry = Math.max(0, Math.min(h - 1, y + ny * shift));
      const bx = Math.max(0, Math.min(w - 1, x - nx * shift));
      const by = Math.max(0, Math.min(h - 1, y - ny * shift));

      const di = (y * w + x) * 4;
      out[di]     = bilinearSample(data, w, h, rx, ry, 0); // R — pushed out
      out[di + 1] = data[di + 1];                           // G — unchanged
      out[di + 2] = bilinearSample(data, w, h, bx, by, 2); // B — pushed in
      out[di + 3] = data[di + 3];
    }
  }
  return out;
};

// ─── Effect Mask ────────────────────────────────────────────────────────────────
// Restricts the entire active effect stack to a user-painted region — outside
// it, the original unprocessed image shows through. Strokes are stored as
// resolution-independent relative coordinates (not a bitmap — keeps state
// small and avoids the localStorage bloat that base64 image data caused
// elsewhere), then rasterised at the current render size on every frame.

const rasterizeEffectMask = (
  strokes: import('../types').MaskStroke[], w: number, h: number, feather: number,
): Uint8ClampedArray => {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const scale = Math.min(w, h);
  strokes.forEach(stroke => {
    const r = stroke.size * scale;
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (stroke.points.length > 1) {
      ctx.lineWidth = r * 2;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
      }
      ctx.stroke();
    }
  });

  if (feather > 0) {
    const blurred = document.createElement('canvas');
    blurred.width = w; blurred.height = h;
    const bctx = blurred.getContext('2d')!;
    bctx.filter = `blur(${feather}px)`;
    bctx.drawImage(canvas, 0, 0);
    return new Uint8ClampedArray(bctx.getImageData(0, 0, w, h).data);
  }
  return new Uint8ClampedArray(ctx.getImageData(0, 0, w, h).data);
};

// Blends `processed` (fully effects-applied) against `original` per-pixel
// using the mask's alpha channel as a feathered stencil — 0 = original shows,
// 255 = processed shows, anything between is a soft blend at painted edges.
const compositeEffectMask = (
  processed: Uint8ClampedArray, original: Uint8ClampedArray,
  maskBuf: Uint8ClampedArray, invert: boolean,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(processed.length);
  for (let i = 0; i < processed.length; i += 4) {
    let t = maskBuf[i + 3] / 255;
    if (invert) t = 1 - t;
    out[i]     = original[i]     + (processed[i]     - original[i])     * t;
    out[i + 1] = original[i + 1] + (processed[i + 1] - original[i + 1]) * t;
    out[i + 2] = original[i + 2] + (processed[i + 2] - original[i + 2]) * t;
    out[i + 3] = processed[i + 3];
  }
  return out;
};

// ─── Displacement Warp ───────────────────────────────────────────────────────

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const hash2D = (ix: number, iy: number): number => {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

const valueNoise = (x: number, y: number): number => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
  const a = hash2D(ix,     iy),     b = hash2D(ix + 1, iy);
  const c = hash2D(ix,     iy + 1), d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

/** Fractional Brownian Motion — stacked octaves for organic detail */
const fbm = (x: number, y: number, octaves: number): number => {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += (valueNoise(x * freq, y * freq) - 0.5) * amp;
    amp  *= 0.5;
    freq *= 2.1; // slight non-integer to break harmonic patterns
  }
  return val * 2; // approx -1 to +1
};

/** Bilinear sample — smoother than nearest-neighbour for sub-pixel accuracy */
const bilinearSample = (data: Uint8ClampedArray, w: number, h: number, x: number, y: number, ch: number): number => {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0, fy = y - y0;
  const a = data[(y0 * w + x0) * 4 + ch];
  const b = data[(y0 * w + x1) * 4 + ch];
  const c = data[(y1 * w + x0) * 4 + ch];
  const d = data[(y1 * w + x1) * 4 + ch];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

const applyDisplacementWarp = (
  data: Uint8ClampedArray, w: number, h: number,
  strength: number, scale: number, octaves: number,
  style: 'warp' | 'swirl' | 'flow',
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * scale;
      const ny = (y / h) * scale;

      let dx = 0, dy = 0;

      if (style === 'warp') {
        dx = fbm(nx,       ny,       octaves) * strength;
        dy = fbm(nx + 3.7, ny + 2.1, octaves) * strength;
      } else if (style === 'swirl') {
        const n = fbm(nx, ny, octaves);
        const angle = n * Math.PI * 6;
        const r = strength * (0.4 + Math.abs(n) * 0.6);
        dx = Math.cos(angle) * r;
        dy = Math.sin(angle) * r;
      } else { // flow
        dx = fbm(nx,        ny,        octaves) * strength;
        dy = fbm(nx + 100,  ny + 100,  octaves) * strength * 0.25;
      }

      const sx = Math.max(0, Math.min(w - 1, x + dx));
      const sy = Math.max(0, Math.min(h - 1, y + dy));
      const di = (y * w + x) * 4;

      out[di]     = bilinearSample(data, w, h, sx, sy, 0);
      out[di + 1] = bilinearSample(data, w, h, sx, sy, 1);
      out[di + 2] = bilinearSample(data, w, h, sx, sy, 2);
      out[di + 3] = bilinearSample(data, w, h, sx, sy, 3);
    }
  }
  return out;
};

// ─── Motion blur helper ───────────────────────────────────────────────────────

const applyMotionBlur = (
  src: HTMLCanvasElement, w: number, h: number,
  type: 'horizontal' | 'vertical' | 'zoom', strength: number,
): HTMLCanvasElement => {
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d')!;
  const steps = Math.max(4, Math.ceil(strength * 0.8));

  for (let i = 0; i < steps; i++) {
    ctx.globalAlpha = 1 / steps;
    if (type === 'horizontal') {
      const offset = -strength / 2 + (i / (steps - 1)) * strength;
      ctx.drawImage(src, offset, 0, w, h);
    } else if (type === 'vertical') {
      const offset = -strength / 2 + (i / (steps - 1)) * strength;
      ctx.drawImage(src, 0, offset, w, h);
    } else {
      // zoom burst from centre
      const scale = 1 + (i / steps) * (strength / 120);
      const dx = (w - w * scale) / 2, dy = (h - h * scale) / 2;
      ctx.drawImage(src, dx, dy, w * scale, h * scale);
    }
  }
  ctx.globalAlpha = 1;
  return out;
};

// ─── Spot blur helper ─────────────────────────────────────────────────────────

interface SpotData { id: string; x: number; y: number; radius: number }

const applySpotBlur = (
  src: HTMLCanvasElement, w: number, h: number,
  blurRadius: number, spots: SpotData[],
): HTMLCanvasElement => {
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d')!;

  // Blurred base — draw image larger than canvas to prevent white-edge fringing from the blur
  const pad = blurRadius * 3;
  const blurOff = document.createElement('canvas');
  blurOff.width = w; blurOff.height = h;
  const bCtx = blurOff.getContext('2d')!;
  bCtx.filter = `blur(${blurRadius}px)`;
  bCtx.drawImage(src, -pad, -pad, w + pad * 2, h + pad * 2);
  bCtx.filter = 'none';

  // Focus mask — TRANSPARENT background so destination-in uses alpha, not luminance
  // White opaque = keep sharp image | Transparent = show blurred image
  const maskOff = document.createElement('canvas');
  maskOff.width = w; maskOff.height = h;
  const mCtx = maskOff.getContext('2d')!;
  // clearRect leaves it fully transparent (alpha=0) — don't fill black
  spots.forEach(spot => {
    const cx = spot.x * w, cy = spot.y * h;
    const r  = spot.radius * Math.min(w, h) * 0.55;
    const g  = mCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,    'rgba(255,255,255,1.0)'); // sharp at centre
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); // soft hold
    g.addColorStop(1,    'rgba(255,255,255,0.0)'); // fully transparent at edge → blurred
    mCtx.globalCompositeOperation = 'source-over';
    mCtx.fillStyle = g;
    mCtx.beginPath();
    mCtx.arc(cx, cy, r, 0, Math.PI * 2);
    mCtx.fill();
  });

  // Apply focus mask to sharp image — destination-in keeps sharp where mask is opaque
  const sharpMasked = document.createElement('canvas');
  sharpMasked.width = w; sharpMasked.height = h;
  const smCtx = sharpMasked.getContext('2d')!;
  smCtx.drawImage(src, 0, 0);
  smCtx.globalCompositeOperation = 'destination-in';
  smCtx.drawImage(maskOff, 0, 0);

  // Composite: blurred everywhere, sharp only in focus spots
  ctx.drawImage(blurOff, 0, 0);
  ctx.drawImage(sharpMasked, 0, 0);  // source-over is default
  return out;
};

// ─── ProcessedImageCanvas — replaces <img> when any image effect is active ───

interface ProcessedImageProps {
  imageUrl: string;
  colorGradeEnabled: boolean;
  colorGradePreset: GradePreset;
  colorGradeStrength: number;
  warpEnabled: boolean;
  warpStrength: number;
  warpScale: number;
  warpOctaves: number;
  warpStyle: 'warp' | 'swirl' | 'flow';
  layers: import('../types').ImageLayer[];
  edgeGlowEnabled: boolean; edgeGlowColor: string; edgeGlowIntensity: number; edgeGlowBloom: number; edgeGlowDarken: number;
  splitToneEnabled: boolean; splitToneShadowColor: string; splitToneHighlightColor: string; splitToneStrength: number; splitToneBalance: number;
  caStrength: number;
  canvasDitherStyle: 'none' | 'bayer' | 'floyd-steinberg' | 'atkinson' | 'ascii';
  canvasDitherScale: number;
  ditherDuotoneEnabled: boolean;
  ditherDuotoneShadowColor: string;
  ditherDuotoneHighlightColor: string;
  ditherDuotoneLevels: number;
  ditherDuotoneInvert: boolean;
  ditherAsciiCharSize: number;
  ditherAsciiBrightness: number;
  ditherMatrixSize: number;
  risoEnabled: boolean;
  risoScale: number;
  risoColor1: string;
  risoColor2: string;
  risoOffset: number;
  risoGrain: number;
  cmykSeparationEnabled: boolean;
  cmykDotSize: number;
  cmykSpacing: number;
  halftoneEnabled: boolean;
  halftonePattern: 'dot' | 'line' | 'crosshatch';
  halftoneDotSize: number;
  halftoneSpacing: number;
  halftoneAngle: number;
  halftoneColor: string;
  halftoneOpacity: number;
  halftoneInvert: boolean;
  halftoneDuotoneEnabled: boolean;
  halftoneBgColor: string;
  effectMaskEnabled: boolean;
  effectMaskStrokes: import('../types').MaskStroke[];
  effectMaskFeather: number;
  effectMaskInvert: boolean;
  imageGlitchEnabled: boolean;
  imageGlitchStyle: GlitchStyle;
  imageGlitchIntensity: number;
  imageGlitchShift: number;
  imageGlitchRgbSplit: number;
  dispersionEnabled: boolean;
  dispersionStrength: number;
  dispersionThreshold: number;
  dispersionDirection: DispersionDir;
  dispersionSpread: number;
  channelSmearEnabled: boolean;
  channelSmearThreshold: number;
  channelSmearRDir: 'up'|'down'|'left'|'right';
  channelSmearGDir: 'up'|'down'|'left'|'right';
  channelSmearBDir: 'up'|'down'|'left'|'right';
  pixelSortEnabled: boolean;
  pixelSortThreshold: number;
  pixelSortDirection: SortDir;
  pixelSortMode: SortMode;
  motionBlurEnabled: boolean;
  motionBlurType: 'horizontal' | 'vertical' | 'zoom';
  motionBlurStrength: number;
  spotBlurEnabled: boolean;
  spotBlurRadius: number;
  blurSpots: SpotData[];
}

const ProcessedImageCanvas: React.FC<ProcessedImageProps> = (props) => {
  const {
    imageUrl, layers,
    edgeGlowEnabled, edgeGlowColor, edgeGlowIntensity, edgeGlowBloom, edgeGlowDarken,
    splitToneEnabled, splitToneShadowColor, splitToneHighlightColor, splitToneStrength, splitToneBalance,
    colorGradeEnabled, colorGradePreset, colorGradeStrength,
    caStrength,
    canvasDitherStyle, canvasDitherScale,
    ditherDuotoneEnabled, ditherDuotoneShadowColor, ditherDuotoneHighlightColor,
    ditherDuotoneLevels, ditherDuotoneInvert,
    ditherAsciiCharSize, ditherAsciiBrightness,
    ditherMatrixSize,
    risoEnabled, risoScale, risoColor1, risoColor2, risoOffset, risoGrain,
    cmykSeparationEnabled, cmykDotSize, cmykSpacing,
    halftoneEnabled, halftonePattern, halftoneDotSize, halftoneSpacing, halftoneAngle, halftoneColor, halftoneOpacity, halftoneInvert,
    halftoneDuotoneEnabled, halftoneBgColor,
    effectMaskEnabled, effectMaskStrokes, effectMaskFeather, effectMaskInvert,
    imageGlitchEnabled, imageGlitchStyle, imageGlitchIntensity, imageGlitchShift, imageGlitchRgbSplit,
    dispersionEnabled, dispersionStrength, dispersionThreshold, dispersionDirection, dispersionSpread,
    warpEnabled, warpStrength, warpScale, warpOctaves, warpStyle,
    channelSmearEnabled, channelSmearThreshold, channelSmearRDir, channelSmearGDir, channelSmearBDir,
    pixelSortEnabled, pixelSortThreshold, pixelSortDirection, pixelSortMode,
    motionBlurEnabled, motionBlurType, motionBlurStrength,
    spotBlurEnabled, spotBlurRadius, blurSpots,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const [processing, setProcessing] = React.useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap || !imageUrl) return;
    let cancelled = false;

    const loadImg = (url: string) => new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });

    const render = () => {
      const w = wrap.clientWidth  || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;

      // Load primary image + all layer images concurrently
      const layerUrls = layers.filter(l => l.imageUrl).map(l => l.imageUrl!);
      Promise.all([loadImg(imageUrl), ...layerUrls.map(loadImg)])
        .then(([img, ...layerImgs]) => {
        if (cancelled) return;
        setProcessing(true);

        setTimeout(() => {
          if (cancelled) return;
          try {
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d')!;

          // Step 1: composite primary + additional layers onto offscreen canvas
          const off = document.createElement('canvas');
          off.width = w; off.height = h;
          const offCtx = off.getContext('2d')!;
          drawObjectCover(offCtx, img, w, h);

          // Blend additional layers on top
          layers.filter(l => l.imageUrl).forEach((layer, i) => {
            if (!layerImgs[i]) return;
            offCtx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
            offCtx.globalAlpha = layer.opacity;
            drawObjectCover(offCtx, layerImgs[i], w, h);
          });
          offCtx.globalCompositeOperation = 'source-over';
          offCtx.globalAlpha = 1;

          // Step 2: per-pixel transforms (grade + sort)
          let { data } = offCtx.getImageData(0, 0, w, h);
          let processed = new Uint8ClampedArray(data);
          if (colorGradeEnabled)   processed = applyGrade(processed, colorGradePreset, colorGradeStrength);
          if (splitToneEnabled)    processed = applySplitTone(processed, w, h, splitToneShadowColor, splitToneHighlightColor, splitToneStrength, splitToneBalance);
          if (edgeGlowEnabled)     processed = applyEdgeGlow(processed, w, h, edgeGlowColor, edgeGlowIntensity, edgeGlowBloom, edgeGlowDarken);
          if (imageGlitchEnabled)  processed = applyImageGlitch(processed, w, h, imageGlitchIntensity, imageGlitchShift, imageGlitchRgbSplit, imageGlitchStyle);
          if (dispersionEnabled)   processed = applyDispersion(processed, w, h, dispersionThreshold, dispersionStrength, dispersionDirection, dispersionSpread);
          if (warpEnabled)         processed = applyDisplacementWarp(processed, w, h, warpStrength, warpScale, warpOctaves, warpStyle);
          if (channelSmearEnabled) processed = applyChannelSmear(processed, w, h, channelSmearThreshold, channelSmearRDir, channelSmearGDir, channelSmearBDir);
          if (pixelSortEnabled)    processed = applyPixelSort(processed, w, h, pixelSortThreshold, pixelSortDirection, pixelSortMode);
          if (risoEnabled)         processed = applyRisoPrint(processed, w, h, risoScale, risoColor1, risoColor2, risoOffset, risoGrain);
          if (cmykSeparationEnabled) processed = applyCmykSeparation(processed, w, h, cmykDotSize, cmykSpacing);
          if (halftoneEnabled)     processed = applyHalftonePixels(processed, w, h, halftonePattern ?? 'dot', halftoneDotSize, halftoneSpacing, halftoneAngle ?? 45, halftoneColor, halftoneOpacity ?? 1, halftoneInvert, halftoneDuotoneEnabled ?? false, halftoneBgColor ?? '#ebf2b5');
          if (canvasDitherStyle === 'ascii') {
            processed = applyAsciiDither(processed, w, h, ditherAsciiCharSize, ditherAsciiBrightness, ditherDuotoneEnabled, ditherDuotoneShadowColor, ditherDuotoneHighlightColor, ditherDuotoneInvert);
          } else if (canvasDitherStyle !== 'none') {
            processed = ditherDuotoneEnabled
              ? applyDuotoneDither(processed, w, h, canvasDitherStyle as 'bayer'|'floyd-steinberg'|'atkinson', canvasDitherScale, ditherDuotoneShadowColor, ditherDuotoneHighlightColor, ditherDuotoneLevels, ditherDuotoneInvert, ditherMatrixSize)
              : applyCanvasDither(processed, w, h, canvasDitherStyle as 'bayer'|'floyd-steinberg'|'atkinson', canvasDitherScale, ditherMatrixSize);
          }
          // CA last — applied over the fully processed image, strongest at corners
          if (caStrength > 0)      processed = applyCA(processed, w, h, caStrength);
          // Effect Mask — genuinely last: composites the fully-processed result
          // against the pristine `data` buffer, restricting every effect above
          // to the painted region in one pass rather than gating each individually.
          if (effectMaskEnabled && effectMaskStrokes.length > 0) {
            const maskBuf = rasterizeEffectMask(effectMaskStrokes, w, h, effectMaskFeather);
            processed = compositeEffectMask(processed, data, maskBuf, effectMaskInvert);
          }
          offCtx.putImageData(new ImageData(processed, w, h), 0, 0);

          // Step 3: motion blur (multi-pass accumulation)
          let current: HTMLCanvasElement = off;
          if (motionBlurEnabled && motionBlurStrength > 0) {
            current = applyMotionBlur(current, w, h, motionBlurType, motionBlurStrength);
          }

          // Step 4: spot blur (selective focus compositing)
          if (spotBlurEnabled && blurSpots.length > 0) {
            current = applySpotBlur(current, w, h, spotBlurRadius, blurSpots);
          }

          ctx.drawImage(current, 0, 0);
          setProcessing(false);
          } catch (err) {
            console.warn('ProcessedImageCanvas error:', err);
            canvas.width = w; canvas.height = h;
            const ctx2 = canvas.getContext('2d')!;
            drawObjectCover(ctx2, img, w, h);
            setProcessing(false);
          }
        }, 0);
      }).catch(() => setProcessing(false));
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => { cancelled = true; ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, JSON.stringify(layers),
      edgeGlowEnabled, edgeGlowColor, edgeGlowIntensity, edgeGlowBloom, edgeGlowDarken,
      splitToneEnabled, splitToneShadowColor, splitToneHighlightColor, splitToneStrength, splitToneBalance,
      colorGradeEnabled, colorGradePreset, colorGradeStrength,
      caStrength, canvasDitherStyle, canvasDitherScale,
      ditherDuotoneEnabled, ditherDuotoneShadowColor, ditherDuotoneHighlightColor,
      ditherDuotoneLevels, ditherDuotoneInvert,
      ditherAsciiCharSize, ditherAsciiBrightness,
      ditherMatrixSize,
      risoEnabled, risoScale, risoColor1, risoColor2, risoOffset, risoGrain,
      cmykSeparationEnabled, cmykDotSize, cmykSpacing,
      halftoneEnabled, halftonePattern, halftoneDotSize, halftoneSpacing, halftoneAngle, halftoneColor, halftoneOpacity, halftoneInvert,
      halftoneDuotoneEnabled, halftoneBgColor,
      effectMaskEnabled, JSON.stringify(effectMaskStrokes), effectMaskFeather, effectMaskInvert,
      imageGlitchEnabled, imageGlitchStyle, imageGlitchIntensity, imageGlitchShift, imageGlitchRgbSplit,
      dispersionEnabled, dispersionStrength, dispersionThreshold, dispersionDirection, dispersionSpread,
      warpEnabled, warpStrength, warpScale, warpOctaves, warpStyle,
      channelSmearEnabled, channelSmearThreshold, channelSmearRDir, channelSmearGDir, channelSmearBDir,
      pixelSortEnabled, pixelSortThreshold, pixelSortDirection, pixelSortMode,
      motionBlurEnabled, motionBlurType, motionBlurStrength,
      spotBlurEnabled, spotBlurRadius, blurSpots]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="w-full h-full" />
      {processing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full">
            <i className="ph ph-spinner animate-spin text-white text-sm" />
            <span className="text-white text-xs">Processing…</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── CSS: Aurora ─────────────────────────────────────────────────────────────

const AuroraEffect: React.FC<{ colors: { color1: string; color2: string; color3: string }; speed: 'slow' | 'normal' | 'fast' }> = ({ colors, speed }) => {
  const dur = speed === 'slow' ? 14 : speed === 'fast' ? 5 : 8;
  return (
    <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes aurora-a { 0%,100%{transform:translate(-20%,-10%) rotate(-8deg) scale(1.6);} 50%{transform:translate(20%,10%) rotate(8deg) scale(2);} }
        @keyframes aurora-b { 0%,100%{transform:translate(15%,5%) rotate(12deg) scale(1.8);} 50%{transform:translate(-15%,-5%) rotate(-12deg) scale(1.5);} }
        @keyframes aurora-c { 0%,100%{transform:translate(-5%,15%) rotate(-5deg) scale(1.4);} 50%{transform:translate(5%,-15%) rotate(5deg) scale(1.9);} }
      `}} />
      <div style={{ position:'absolute', inset:'-50%', width:'200%', height:'200%', background:`radial-gradient(ellipse 80% 50% at 30% 50%, ${colors.color1}70, transparent 70%)`, filter:'blur(50px)', animation:`aurora-a ${dur}s ease-in-out infinite`, mixBlendMode:'screen' }} />
      <div style={{ position:'absolute', inset:'-50%', width:'200%', height:'200%', background:`radial-gradient(ellipse 60% 70% at 70% 40%, ${colors.color2}55, transparent 65%)`, filter:'blur(70px)', animation:`aurora-b ${dur * 0.75}s ease-in-out infinite`, mixBlendMode:'screen' }} />
      <div style={{ position:'absolute', inset:'-50%', width:'200%', height:'200%', background:`radial-gradient(ellipse 90% 40% at 50% 70%, ${colors.color3}45, transparent 70%)`, filter:'blur(90px)', animation:`aurora-c ${dur * 1.2}s ease-in-out infinite`, mixBlendMode:'screen' }} />
    </div>
  );
};

// ─── CSS: Light Leak ──────────────────────────────────────────────────────────

const LightLeakEffect: React.FC<{ colors: { color1: string; color2: string; color3: string } }> = ({ colors }) => (
  <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
    <div style={{ position:'absolute', top:'-10%', right:'-10%', width:'55%', height:'55%', background:`radial-gradient(ellipse at top right, ${colors.color1}90, transparent 70%)`, filter:'blur(35px)', mixBlendMode:'screen' }} />
    <div style={{ position:'absolute', bottom:'-5%', left:'-5%', width:'35%', height:'35%', background:`radial-gradient(ellipse at bottom left, ${colors.color2}60, transparent 70%)`, filter:'blur(50px)', mixBlendMode:'screen' }} />
    <div style={{ position:'absolute', top:'40%', right:'15%', width:'20%', height:'40%', background:`linear-gradient(180deg, ${colors.color1}30, transparent)`, filter:'blur(25px)', mixBlendMode:'screen', transform:'rotate(15deg)' }} />
  </div>
);

// ─── CSS: Shimmer ─────────────────────────────────────────────────────────────

const ShimmerEffect: React.FC<{ colors: { color1: string; color2: string; color3: string }; speed: 'slow' | 'normal' | 'fast' }> = ({ colors, speed }) => {
  const dur = speed === 'slow' ? 6 : speed === 'fast' ? 2 : 3.5;
  return (
    <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer-sweep { 0%{transform:translateX(-150%) skewX(-20deg);} 100%{transform:translateX(250%) skewX(-20deg);} }
        @keyframes shimmer-sweep2 { 0%{transform:translateX(-150%) skewX(-20deg);} 100%{transform:translateX(250%) skewX(-20deg);} }
      `}} />
      <div style={{ position:'absolute', top:0, left:0, width:'25%', height:'100%', background:`linear-gradient(to right, transparent, ${colors.color1}50, ${colors.color2}30, transparent)`, animation:`shimmer-sweep ${dur}s ease-in-out infinite`, filter:'blur(12px)' }} />
      <div style={{ position:'absolute', top:0, left:0, width:'10%', height:'100%', background:`linear-gradient(to right, transparent, #ffffff25, transparent)`, animation:`shimmer-sweep2 ${dur}s ease-in-out infinite`, animationDelay:'0.3s', filter:'blur(4px)' }} />
    </div>
  );
};

// ─── CSS: Glitch ──────────────────────────────────────────────────────────────

const GlitchEffect: React.FC<{ colors: { color1: string; color2: string; color3: string } }> = ({ colors }) => (
  <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes glitch-slice-1 {
        0%,79%,100%{opacity:0;transform:none;}
        80%{opacity:0.8;clip-path:polygon(0 15%,100% 15%,100% 30%,0 30%);transform:translateX(-10px);}
        82%{opacity:0.8;clip-path:polygon(0 55%,100% 55%,100% 65%,0 65%);transform:translateX(8px);}
        84%{opacity:0.8;clip-path:polygon(0 5%,100% 5%,100% 20%,0 20%);transform:translateX(-5px);}
        86%{opacity:0;}
      }
      @keyframes glitch-slice-2 {
        0%,84%,100%{opacity:0;transform:none;}
        85%{opacity:0.6;clip-path:polygon(0 70%,100% 70%,100% 80%,0 80%);transform:translateX(12px);}
        87%{opacity:0.6;clip-path:polygon(0 40%,100% 40%,100% 55%,0 55%);transform:translateX(-8px);}
        89%{opacity:0;}
      }
    `}} />
    <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, ${colors.color1}cc, ${colors.color2}99)`, animation:'glitch-slice-1 5s ease-in-out infinite', mixBlendMode:'exclusion' }} />
    <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, ${colors.color3}99, ${colors.color1}cc)`, animation:'glitch-slice-2 5s ease-in-out infinite', animationDelay:'0.5s', mixBlendMode:'exclusion' }} />
  </div>
);

// ─── Canvas-based film grain ─────────────────────────────────────────────────
// CSS mask-image with SVG turbulence is invisible in html-to-image exports.
// A canvas element renders grain as actual pixels — captured correctly every time.

const NoiseCanvas: React.FC<{ opacity: number; color: string }> = React.memo(({ opacity, color }) => {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap   = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const generate = () => {
      // Render at the ACTUAL display resolution so grain is 1:1 pixel — no upscale, no TV static
      const w = wrap.clientWidth  || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      const d   = img.data;

      const hex = color.replace('#', '');
      const cr  = parseInt(hex.slice(0, 2), 16) || 255;
      const cg  = parseInt(hex.slice(2, 4), 16) || 255;
      const cb  = parseInt(hex.slice(4, 6), 16) || 255;

      for (let i = 0; i < d.length; i += 4) {
        // Sparse film grain: ~35% of pixels visible, at varying intensity
        const v     = Math.random();
        const alpha = v > 0.65 ? ((v - 0.65) / 0.35) * 255 : 0;
        d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = alpha | 0;
      }
      ctx.putImageData(img, 0, 0);
    };

    generate();
    // Regenerate if the canvas area resizes (e.g. panel open/close)
    const ro = new ResizeObserver(generate);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [color]);

  return (
    <div ref={wrapRef} className="absolute inset-0 pointer-events-none z-[2]">
      <canvas ref={canvasRef} className="w-full h-full" style={{ opacity }} />
    </div>
  );
});

// ─── Main Canvas Component ────────────────────────────────────────────────────

interface CanvasProps {
  state: BackgroundState;
  hideEffects?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ state, hideEffects = false }) => {
  const {
    bgColor, maskColor, imageUrl, videoUrl,
    imageFilter, imageBlur, imageMask, imageOpacity, tintColor, chromaticAberration,
    ditherStyle, ditherScale,
    ditherDuotoneEnabled, ditherDuotoneShadowColor, ditherDuotoneHighlightColor,
    ditherDuotoneLevels, ditherDuotoneInvert,
    ditherAsciiCharSize, ditherAsciiBrightness,
    ditherMatrixSize,
    risoEnabled, risoScale, risoColor1, risoColor2, risoOffset, risoGrain,
    cmykSeparationEnabled, cmykDotSize, cmykSpacing,
    effectMaskEnabled, effectMaskStrokes, effectMaskFeather, effectMaskInvert,
    atmosphereStyle, meshColors,
    meshSpeed, meshComplexity, meshTurbulence, meshZoom, meshContrast, meshFrequency,
    kineticSpeed, kineticTrailLength, kineticChaos,
    moltenRoughness, moltenDistortion,
    fogDensity, fogSpeed,
    generativePreset,
    overlayOpacity, noiseOpacity, noiseColor,
    patternStyle, patternOpacity, patternColor, patternBlendMode,
    ambientLightIntensity, ambientLightColor, ambientLightPosition,
    vignetteStrength,
    effectsOpacity,
    halftoneEnabled, halftoneDotSize, halftoneSpacing, halftoneColor, halftoneInvert,
    halftonePattern, halftoneAngle, halftoneOpacity,
    halftoneDuotoneEnabled, halftoneBgColor,
    layers,
    edgeGlowEnabled, edgeGlowColor, edgeGlowIntensity, edgeGlowBloom, edgeGlowDarken,
    splitToneEnabled, splitToneShadowColor, splitToneHighlightColor, splitToneStrength, splitToneBalance,
    colorGradeEnabled, colorGradePreset, colorGradeStrength,
    imageGlitchEnabled, imageGlitchStyle, imageGlitchIntensity, imageGlitchShift, imageGlitchRgbSplit,
    dispersionEnabled, dispersionStrength, dispersionThreshold, dispersionDirection, dispersionSpread,
    channelSmearEnabled, channelSmearThreshold, channelSmearRDir, channelSmearGDir, channelSmearBDir,
    warpEnabled, warpStrength, warpScale, warpOctaves, warpStyle,
    pixelSortEnabled, pixelSortThreshold, pixelSortDirection, pixelSortMode,
    motionBlurEnabled, motionBlurType, motionBlurStrength,
    spotBlurEnabled, spotBlurRadius, blurSpots,
  } = state;

  // Bypass mode — show raw source instantly, no effects
  if (hideEffects) {
    return (
      <div id="heroken-canvas" className="absolute inset-0 overflow-hidden" style={{ backgroundColor: bgColor }}>
        {videoUrl && <video src={videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />}
        {imageUrl && !videoUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
      </div>
    );
  }

  const useProcessedCanvas = !!imageUrl && (
    (layers.some(l => l.imageUrl)) ||
    (edgeGlowEnabled ?? false) || (splitToneEnabled ?? false) ||
    (chromaticAberration > 0) ||
    (ditherStyle !== 'none') ||
    (imageGlitchEnabled ?? false) ||
    (colorGradeEnabled ?? false) || (dispersionEnabled ?? false) ||
    (warpEnabled ?? false) || (channelSmearEnabled ?? false) || (pixelSortEnabled ?? false) ||
    (motionBlurEnabled ?? false) || (spotBlurEnabled ?? false) ||
    (risoEnabled ?? false) || (cmykSeparationEnabled ?? false) || (halftoneEnabled ?? false)
  );

  const hasSource = !!(imageUrl || videoUrl);

  // Build CSS filter string for source image/video
  const buildCssFilter = () => {
    const parts: string[] = [];
    if (imageFilter === 'grayscale') parts.push('grayscale(100%)');
    else if (imageFilter === 'desaturate') parts.push('saturate(0%) opacity(0.6)');
    else if (imageFilter === 'tint' || imageFilter === 'duotone') parts.push('grayscale(100%)');
    else if (imageFilter === 'frosted') parts.push('blur(12px) contrast(1.2) brightness(1.1)');
    if (imageBlur > 0) parts.push(`blur(${imageBlur}px)`);
    return parts.join(' ');
  };

  // Mask image CSS
  const maskImageCss = (): string => {
    switch (imageMask) {
      case 'fade-bottom': return 'linear-gradient(to bottom, black 50%, transparent 100%)';
      case 'fade-left': return 'linear-gradient(to left, black 50%, transparent 100%)';
      case 'fade-right': return 'linear-gradient(to right, black 50%, transparent 100%)';
      case 'radial': return 'radial-gradient(circle at center, black 40%, transparent 100%)';
      case 'soft-edges': return 'radial-gradient(ellipse at center, black 70%, transparent 100%)';
      default: return '';
    }
  };

  // Pattern SVG data URL
  const patternSvg = (): string => {
    const c = encodeURIComponent(patternColor);
    if (patternStyle === 'grid') return `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='none' stroke='${c}' stroke-opacity='0.5' stroke-width='1'/%3E%3C/svg%3E`;
    if (patternStyle === 'dot') return `data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='${c}'/%3E%3C/svg%3E`;
    if (patternStyle === 'iso-grid') return `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' stroke='${c}' stroke-width='1' fill='none'/%3E%3C/svg%3E`;
    if (patternStyle === 'scanline') return `data:image/svg+xml,%3Csvg width='100%25' height='4' viewBox='0 0 100 4' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cline x1='0' y1='2' x2='100' y2='2' stroke='${c}' stroke-width='1' vector-effect='non-scaling-stroke'/%3E%3C/svg%3E`;
    if (patternStyle === 'hex') return `data:image/svg+xml,%3Csvg width='56' height='100' viewBox='0 0 56 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100' fill='none' stroke='${c}' stroke-width='1'/%3E%3C/svg%3E`;
    if (patternStyle === 'waves') return `data:image/svg+xml,%3Csvg width='40' height='20' viewBox='0 0 40 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q10 0 20 10 T40 10' fill='none' stroke='${c}' stroke-width='1'/%3E%3C/svg%3E`;
    if (patternStyle === 'plus') return `data:image/svg+xml,%3Csvg width='30' height='30' viewBox='0 0 30 30' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15 5v20M5 15h20' stroke='${c}' stroke-width='1' stroke-linecap='round'/%3E%3C/svg%3E`;
    return '';
  };

  // Ambient light position → CSS gradient position
  const ambientGradientPos = (): string => {
    const map: Record<string, string> = { tl:'top left',tc:'top center',tr:'top right',ml:'center left',mc:'center center',mr:'center right',bl:'bottom left',bc:'bottom center',br:'bottom right' };
    return map[ambientLightPosition] || 'top right';
  };

  const noiseSvg = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='nf'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.95' numOctaves='1' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23nf)' opacity='1'/%3E%3C/svg%3E`;

  const maskStyle = imageMask !== 'none' ? { maskImage: maskImageCss(), WebkitMaskImage: maskImageCss() } : {};
  const cssFilter = buildCssFilter();

  return (
    <div
      id="heroken-canvas"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* Mask reveal backdrop — only rendered when a mask is active. Sits behind
          the masked image so its fade reveals maskColor, not the empty-canvas
          bgColor (those are deliberately separate — bgColor stays theme-light,
          maskColor defaults dark since that's what most photographic fades need). */}
      {imageMask !== 'none' && (
        <div className="absolute inset-0 z-0" style={{ backgroundColor: maskColor }} />
      )}

      {/* Layer 1: Source image / video */}
      {hasSource && (
        <div className="absolute inset-0 z-0" style={{ opacity: imageOpacity, ...maskStyle }}>
          <div className="absolute inset-0 overflow-hidden">
            {videoUrl ? (
              <video src={videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" style={{ filter: cssFilter }} />
            ) : imageUrl && useProcessedCanvas ? (
              <ProcessedImageCanvas
                imageUrl={imageUrl}
                colorGradeEnabled={colorGradeEnabled ?? false}
                colorGradePreset={(colorGradePreset ?? 'teal-orange') as GradePreset}
                colorGradeStrength={colorGradeStrength ?? 1}
                layers={layers ?? []}
                edgeGlowEnabled={edgeGlowEnabled ?? false} edgeGlowColor={edgeGlowColor ?? '#00ffff'} edgeGlowIntensity={edgeGlowIntensity ?? 60} edgeGlowBloom={edgeGlowBloom ?? 8} edgeGlowDarken={edgeGlowDarken ?? 0.5}
                splitToneEnabled={splitToneEnabled ?? false} splitToneShadowColor={splitToneShadowColor ?? '#1a237e'} splitToneHighlightColor={splitToneHighlightColor ?? '#ff6d00'} splitToneStrength={splitToneStrength ?? 60} splitToneBalance={splitToneBalance ?? 0}
                caStrength={chromaticAberration ?? 0}
                canvasDitherStyle={ditherStyle === 'none' ? 'none' : (ditherStyle as 'bayer'|'floyd-steinberg'|'atkinson'|'ascii')}
                canvasDitherScale={ditherScale ?? 4}
                ditherDuotoneEnabled={ditherDuotoneEnabled ?? false}
                ditherDuotoneShadowColor={ditherDuotoneShadowColor ?? '#10193f'}
                ditherDuotoneHighlightColor={ditherDuotoneHighlightColor ?? '#f4e4b8'}
                ditherDuotoneLevels={ditherDuotoneLevels ?? 2}
                ditherDuotoneInvert={ditherDuotoneInvert ?? false}
                ditherAsciiCharSize={ditherAsciiCharSize ?? 14}
                ditherAsciiBrightness={ditherAsciiBrightness ?? 20}
                ditherMatrixSize={ditherMatrixSize ?? 4}
                risoEnabled={risoEnabled ?? false}
                risoScale={risoScale ?? 4}
                risoColor1={risoColor1 ?? '#ff48b0'}
                risoColor2={risoColor2 ?? '#0078bf'}
                risoOffset={risoOffset ?? 3}
                risoGrain={risoGrain ?? 40}
                cmykSeparationEnabled={cmykSeparationEnabled ?? false}
                cmykDotSize={cmykDotSize ?? 4}
                cmykSpacing={cmykSpacing ?? 8}
                halftoneEnabled={halftoneEnabled ?? false}
                halftonePattern={halftonePattern ?? 'dot'}
                halftoneDotSize={halftoneDotSize ?? 4}
                halftoneSpacing={halftoneSpacing ?? 8}
                halftoneAngle={halftoneAngle ?? 45}
                halftoneColor={halftoneColor ?? '#000000'}
                halftoneOpacity={halftoneOpacity ?? 1}
                halftoneInvert={halftoneInvert ?? false}
                halftoneDuotoneEnabled={halftoneDuotoneEnabled ?? false}
                halftoneBgColor={halftoneBgColor ?? '#ebf2b5'}
                effectMaskEnabled={effectMaskEnabled ?? false}
                effectMaskStrokes={effectMaskStrokes ?? []}
                effectMaskFeather={effectMaskFeather ?? 20}
                effectMaskInvert={effectMaskInvert ?? false}
                imageGlitchEnabled={imageGlitchEnabled ?? false}
                imageGlitchStyle={(imageGlitchStyle ?? 'digital') as GlitchStyle}
                imageGlitchIntensity={imageGlitchIntensity ?? 40}
                imageGlitchShift={imageGlitchShift ?? 30}
                imageGlitchRgbSplit={imageGlitchRgbSplit ?? 5}
                dispersionEnabled={dispersionEnabled ?? false}
                dispersionStrength={dispersionStrength ?? 60}
                dispersionThreshold={dispersionThreshold ?? 80}
                dispersionDirection={(dispersionDirection ?? 'up') as DispersionDir}
                dispersionSpread={dispersionSpread ?? 0.6}
                warpEnabled={warpEnabled ?? false}
                warpStrength={warpStrength ?? 30}
                warpScale={warpScale ?? 3}
                warpOctaves={warpOctaves ?? 3}
                warpStyle={warpStyle ?? 'warp'}
                channelSmearEnabled={channelSmearEnabled ?? false}
                channelSmearThreshold={channelSmearThreshold ?? 80}
                channelSmearRDir={channelSmearRDir ?? 'up'}
                channelSmearGDir={channelSmearGDir ?? 'left'}
                channelSmearBDir={channelSmearBDir ?? 'right'}
                pixelSortEnabled={pixelSortEnabled ?? false}
                pixelSortThreshold={pixelSortThreshold ?? 128}
                pixelSortDirection={(pixelSortDirection ?? 'up') as SortDir}
                pixelSortMode={(pixelSortMode ?? 'brightness') as SortMode}
                motionBlurEnabled={motionBlurEnabled ?? false}
                motionBlurType={motionBlurType ?? 'horizontal'}
                motionBlurStrength={motionBlurStrength ?? 20}
                spotBlurEnabled={spotBlurEnabled ?? false}
                spotBlurRadius={spotBlurRadius ?? 18}
                blurSpots={blurSpots ?? []}
              />
            ) : imageUrl ? (
              <img src={imageUrl} alt="" crossOrigin="anonymous" className="w-full h-full object-cover" style={{ filter: cssFilter }} />
            ) : null}

            {/* Tint / duotone colour overlay */}
            {(imageFilter === 'tint') && (
              <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundColor: tintColor }} />
            )}
            {(imageFilter === 'duotone') && (
              <div className="absolute inset-0 mix-blend-multiply" style={{ backgroundColor: tintColor }} />
            )}
            {(imageFilter === 'frosted') && (
              <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
            )}

            {/* Dithering is now canvas-based in ProcessedImageCanvas — no CSS overlay */}
          </div>
        </div>
      )}

      {/* Layer 2: Global dark overlay */}
      {overlayOpacity > 0 && (
        <div className="absolute inset-0 z-[3] pointer-events-none" style={{ backgroundColor: '#000', opacity: overlayOpacity }} />
      )}

      {/* Layer 3: Atmosphere — wrapped with effectsOpacity */}
      {atmosphereStyle !== 'none' && (
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: effectsOpacity ?? 1 }}>
          {atmosphereStyle === 'fluid-mesh' && (
            <FluidMeshGL colors={meshColors} speed={meshSpeed} complexity={meshComplexity} turbulence={meshTurbulence} zoom={meshZoom} contrast={meshContrast} frequency={meshFrequency} />
          )}
          {atmosphereStyle === 'volumetric-fog' && (
            <VolumetricFogGL colors={meshColors} density={fogDensity} speed={fogSpeed} />
          )}
          {atmosphereStyle === 'molten-orb' && (
            <MoltenOrbGL colors={meshColors} roughness={moltenRoughness} distortion={moltenDistortion} />
          )}
          {atmosphereStyle === 'kinetic-flow' && (
            <KineticFlowCanvas colors={meshColors} speed={kineticSpeed} trailLength={kineticTrailLength} chaos={kineticChaos} />
          )}
          {atmosphereStyle === 'generative' && (
            <GenerativeCanvas preset={generativePreset} colors={meshColors} />
          )}
          {atmosphereStyle === 'aurora' && (
            <AuroraEffect colors={meshColors} speed={meshSpeed} />
          )}
          {atmosphereStyle === 'light-leak' && (
            <LightLeakEffect colors={meshColors} />
          )}
          {atmosphereStyle === 'shimmer' && (
            <ShimmerEffect colors={meshColors} speed={meshSpeed} />
          )}
          {atmosphereStyle === 'glitch' && (
            <GlitchEffect colors={meshColors} />
          )}
          {atmosphereStyle === 'glow' && (
            <div className="absolute inset-0 z-[1]" style={{ background: `radial-gradient(circle at 50% 40%, ${meshColors.color1}40 0%, transparent 60%)`, filter: 'blur(60px)', mixBlendMode: 'screen' }} />
          )}
          {atmosphereStyle === 'mesh-accent' && (
            <div className="absolute inset-0 z-[1] opacity-50" style={{ backgroundImage: `radial-gradient(at 0% 0%, ${meshColors.color1} 0px, transparent 50%), radial-gradient(at 100% 0%, ${meshColors.color2} 0px, transparent 50%), radial-gradient(at 100% 100%, ${meshColors.color1} 0px, transparent 50%), radial-gradient(at 0% 100%, ${meshColors.color2} 0px, transparent 50%)`, filter: 'blur(80px)', mixBlendMode: 'screen' }} />
          )}
          {atmosphereStyle === 'animated-mesh' && (
            <div className="absolute inset-0 z-[1] overflow-hidden opacity-40 mix-blend-screen">
              <div className="absolute inset-[-50%] w-[200%] h-[200%]" style={{ background: `conic-gradient(from 0deg at 50% 50%, ${meshColors.color1}, ${meshColors.color2}, ${meshColors.color3}, ${meshColors.color1})`, filter: 'blur(100px)', animation: `heroken-spin ${meshSpeed === 'fast' ? '10s' : meshSpeed === 'slow' ? '30s' : '20s'} linear infinite` }} />
              <style dangerouslySetInnerHTML={{ __html: `@keyframes heroken-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` }} />
            </div>
          )}
          {atmosphereStyle === 'fade-bottom' && (
            <div className="absolute inset-0 z-[1]" style={{ background: `linear-gradient(to top, ${meshColors.color1} 0%, transparent 100%)` }} />
          )}
        </div>
      )}

      {/* Layer 4: Pattern */}
      {patternStyle !== 'none' && patternOpacity > 0 && (
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{ opacity: patternOpacity, backgroundImage: `url("${patternSvg()}")`, backgroundSize: patternStyle === 'scanline' ? '100% 4px' : 'auto', mixBlendMode: (patternBlendMode as any) || 'normal' }} />
      )}

      {/* Layer 5: Film grain — canvas-rendered so html-to-image exports it correctly */}
      {noiseOpacity > 0 && <NoiseCanvas opacity={noiseOpacity} color={noiseColor} />}

      {/* Halftone now runs inside the pixel pipeline (see applyHalftonePixels)
          so it participates in Effect Mask like every other effect — it's no
          longer rendered as a separate overlay layer here. */}

      {/* Layer 7: Vignette */}
      {vignetteStrength > 0 && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${vignetteStrength}) 100%)` }} />
      )}

      {/* Layer 8: Ambient light */}
      {ambientLightIntensity > 0 && (
        <div className="absolute inset-0 z-10 pointer-events-none mix-blend-screen" style={{ background: `radial-gradient(circle at ${ambientGradientPos()}, ${ambientLightColor} 0%, transparent 60%)`, opacity: ambientLightIntensity }} />
      )}
    </div>
  );
};

export default Canvas;
