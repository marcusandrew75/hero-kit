
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

const BAYER_4 = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]] as const;

const applyCanvasDither = (
  data: Uint8ClampedArray, w: number, h: number,
  style: 'bayer' | 'floyd-steinberg' | 'atkinson', scale: number,
): Uint8ClampedArray => {
  // Quantisation levels: scale 1→8 levels, scale 8→2 levels
  const levels = Math.max(2, Math.round(10 - scale * 1.0));
  const step   = 255 / (levels - 1);

  // ── Bayer ordered dither ──────────────────────────────────────────────────
  if (style === 'bayer') {
    const out = new Uint8ClampedArray(data);
    const cellSize = Math.max(1, scale);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i  = (y * w + x) * 4;
        const mx = Math.floor(x / cellSize) % 4;
        const my = Math.floor(y / cellSize) % 4;
        const t  = (BAYER_4[my][mx] / 16 - 0.5) * step; // signed offset
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
  caStrength: number;
  canvasDitherStyle: 'none' | 'bayer' | 'floyd-steinberg' | 'atkinson';
  canvasDitherScale: number;
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
    colorGradeEnabled, colorGradePreset, colorGradeStrength,
    caStrength,
    canvasDitherStyle, canvasDitherScale,
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
          if (imageGlitchEnabled)  processed = applyImageGlitch(processed, w, h, imageGlitchIntensity, imageGlitchShift, imageGlitchRgbSplit, imageGlitchStyle);
          if (dispersionEnabled)   processed = applyDispersion(processed, w, h, dispersionThreshold, dispersionStrength, dispersionDirection, dispersionSpread);
          if (warpEnabled)         processed = applyDisplacementWarp(processed, w, h, warpStrength, warpScale, warpOctaves, warpStyle);
          if (channelSmearEnabled) processed = applyChannelSmear(processed, w, h, channelSmearThreshold, channelSmearRDir, channelSmearGDir, channelSmearBDir);
          if (pixelSortEnabled)    processed = applyPixelSort(processed, w, h, pixelSortThreshold, pixelSortDirection, pixelSortMode);
          if (canvasDitherStyle !== 'none') processed = applyCanvasDither(processed, w, h, canvasDitherStyle as 'bayer'|'floyd-steinberg'|'atkinson', canvasDitherScale);
          // CA last — applied over the fully processed image, strongest at corners
          if (caStrength > 0)      processed = applyCA(processed, w, h, caStrength);
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
      colorGradeEnabled, colorGradePreset, colorGradeStrength,
      caStrength, canvasDitherStyle, canvasDitherScale,
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

// ─── Canvas2D: Halftone ───────────────────────────────────────────────────────

interface HalftoneProps {
  imageUrl?: string;
  dotSize: number;
  spacing: number;
  color: string;
  opacity: number;
  invert: boolean;
}

const HalftoneCanvas: React.FC<HalftoneProps> = ({ imageUrl, dotSize, spacing, color, opacity, invert }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap   = wrapRef.current;
    if (!canvas || !wrap) return;

    let cancelled = false;

    const drawDots = (getBrightness: (x: number, y: number) => number, w: number, h: number) => {
      if (cancelled) return;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;

      for (let row = 0; row * spacing <= h + spacing; row++) {
        const yc   = row * spacing;
        const xOff = row % 2 === 1 ? spacing / 2 : 0;
        for (let col = -1; col * spacing <= w + spacing; col++) {
          const xc = col * spacing + xOff;
          const brightness = getBrightness(xc, yc);
          const t = invert ? brightness : 1 - brightness;
          const r = Math.max(0, t * dotSize);
          if (r > 0.2) {
            ctx.beginPath();
            ctx.arc(xc, yc, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const render = () => {
      const w = wrap.clientWidth  || window.innerWidth;
      const h = wrap.clientHeight || window.innerHeight;

      if (imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // prevent CORS canvas taint on external images
        img.onload = () => {
          if (cancelled) return;

          // Mirror CSS object-cover: scale to cover, then centre-crop
          const scale   = Math.max(w / img.width, h / img.height);
          const sw      = img.width  * scale;
          const sh      = img.height * scale;
          const sx      = (w - sw) / 2;
          const sy      = (h - sh) / 2;

          const off    = document.createElement('canvas');
          off.width    = w;
          off.height   = h;
          const offCtx = off.getContext('2d')!;
          offCtx.drawImage(img, sx, sy, sw, sh);   // ← object-cover positioning
          const { data } = offCtx.getImageData(0, 0, w, h);

          const getBrightness = (x: number, y: number) => {
            const px = Math.max(0, Math.min(w - 1, Math.round(x)));
            const py = Math.max(0, Math.min(h - 1, Math.round(y)));
            const i  = (py * w + px) * 4;
            return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          };

          drawDots(getBrightness, w, h);
        };
        img.src = imageUrl;
      } else {
        drawDots(() => 0.55, w, h);
      }
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(wrap);
    return () => { cancelled = true; ro.disconnect(); };
  }, [imageUrl, dotSize, spacing, color, opacity, invert]);

  return (
    <div ref={wrapRef} className="absolute inset-0 pointer-events-none z-20">
      <canvas ref={canvasRef} className="w-full h-full" style={{ mixBlendMode: 'multiply' }} />
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
    bgColor, imageUrl, videoUrl,
    imageFilter, imageBlur, imageMask, imageOpacity, tintColor, chromaticAberration,
    ditherStyle, ditherScale,
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
    layers,
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
    (chromaticAberration > 0) ||
    (ditherStyle !== 'none') ||
    (imageGlitchEnabled ?? false) ||
    (colorGradeEnabled ?? false) || (dispersionEnabled ?? false) ||
    (warpEnabled ?? false) || (channelSmearEnabled ?? false) || (pixelSortEnabled ?? false) ||
    (motionBlurEnabled ?? false) || (spotBlurEnabled ?? false)
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
                caStrength={chromaticAberration ?? 0}
                canvasDitherStyle={ditherStyle === 'none' ? 'none' : (ditherStyle as 'bayer'|'floyd-steinberg'|'atkinson')}
                canvasDitherScale={ditherScale ?? 4}
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

      {/* Layer 6: Halftone */}
      {halftoneEnabled && (
        <HalftoneCanvas
          imageUrl={imageUrl}
          dotSize={halftoneDotSize}
          spacing={halftoneSpacing}
          color={halftoneColor}
          opacity={state.halftoneOpacity ?? 1}
          invert={halftoneInvert}
        />
      )}

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
