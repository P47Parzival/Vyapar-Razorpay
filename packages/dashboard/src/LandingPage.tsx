import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './landing.css';
import razorpayLogo from '../assets/razorpay_logo.png';
import vyaparLogo from '../assets/vyapar_logo.png';

interface GalaxyParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  opacity: number;
  z: number;
}

interface InflowParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface DataCenter {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  opacity: number;
  points: { x: number; y: number; z: number }[];
}

interface DataPacket {
  fromX: number;
  fromY: number;
  progress: number;
  speed: number;
  size: number;
}

interface DustParticle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  vx: number;
  vy: number;
}

function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext('2d');
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const cx = W / 2;
    const cy = H * 0.6;

    // Galaxy ring particles
    const galaxyParticles: GalaxyParticle[] = [];
    for (let i = 0; i < 3200; i++) {
      const ringRadius = 60 + Math.random() * 220;
      galaxyParticles.push({
        angle: Math.random() * Math.PI * 2,
        radius: ringRadius + (Math.random() - 0.5) * 50,
        speed: (0.0002 + Math.random() * 0.0005) * (ringRadius < 140 ? 1.4 : 1),
        size: 0.4 + Math.random() * 1.8,
        opacity: 0.2 + Math.random() * 0.8,
        z: (Math.random() - 0.5) * 0.25,
      });
    }

    // Inflow particles - spawn at edges, move toward center
    const inflowParticles: InflowParticle[] = [];
    function spawnInflow() {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 200;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist * 0.4;
      const dx = cx - sx;
      const dy = cy - sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.4 + Math.random() * 0.8;
      inflowParticles.push({
        x: sx,
        y: sy,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed,
        size: 0.8 + Math.random() * 1.2,
        opacity: 0.5 + Math.random() * 0.5,
        life: 0,
        maxLife: len / speed,
      });
    }
    for (let i = 0; i < 60; i++) spawnInflow();

    // Data center wireframe cubes (particle-rendered)
    const dataCenters: DataCenter[] = [];
    const dcPositions = [
      { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.52 },
      { x: 0.18, y: 0.78 }, { x: 0.82, y: 0.8 },
      { x: 0.05, y: 0.35 }, { x: 0.95, y: 0.35 },
      { x: 0.3, y: 0.85 }, { x: 0.7, y: 0.82 },
    ];
    for (const pos of dcPositions) {
      const size = 25 + Math.random() * 35;
      const points: { x: number; y: number; z: number }[] = [];
      // Generate points along cube edges
      const edges = [
        // Front face
        [[-1,-1,-1],[1,-1,-1]], [[-1,1,-1],[1,1,-1]],
        [[-1,-1,-1],[-1,1,-1]], [[1,-1,-1],[1,1,-1]],
        // Back face
        [[-1,-1,1],[1,-1,1]], [[-1,1,1],[1,1,1]],
        [[-1,-1,1],[-1,1,1]], [[1,-1,1],[1,1,1]],
        // Connectors
        [[-1,-1,-1],[-1,-1,1]], [[1,-1,-1],[1,-1,1]],
        [[-1,1,-1],[-1,1,1]], [[1,1,-1],[1,1,1]],
      ];
      for (const [a, b] of edges) {
        const steps = 6 + Math.floor(Math.random() * 4);
        for (let t = 0; t <= steps; t++) {
          const frac = t / steps;
          points.push({
            x: a[0] + (b[0] - a[0]) * frac + (Math.random() - 0.5) * 0.15,
            y: a[1] + (b[1] - a[1]) * frac + (Math.random() - 0.5) * 0.15,
            z: a[2] + (b[2] - a[2]) * frac + (Math.random() - 0.5) * 0.15,
          });
        }
      }
      dataCenters.push({
        x: pos.x * W,
        y: pos.y * H,
        size,
        rotation: Math.random() * Math.PI,
        rotSpeed: 0.003 + Math.random() * 0.005,
        opacity: 0.3 + Math.random() * 0.3,
        points,
      });
    }

    // Data packets traveling from data centers to center
    const dataPackets: DataPacket[] = [];
    for (let i = 0; i < dataCenters.length * 2; i++) {
      const pkt: DataPacket = {
        fromX: dataCenters[i % dataCenters.length].x,
        fromY: dataCenters[i % dataCenters.length].y,
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
        size: 1.5 + Math.random() * 2,
      };
      dataPackets.push(pkt);
    }

    // Background dust
    const dustParticles: DustParticle[] = [];
    for (let i = 0; i < 150; i++) {
      dustParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 0.4 + Math.random() * 1.2,
        opacity: 0.08 + Math.random() * 0.25,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.08,
      });
    }

    let frameCount = 0;

    function animate() {
      frameCount++;
      ctx.clearRect(0, 0, W, H);

      // Connection lines from data centers to center
      for (const dc of dataCenters) {
        ctx.beginPath();
        ctx.moveTo(dc.x, dc.y);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = `rgba(100, 170, 255, 0.06)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Radial lines from center
      const lineCount = 32;
      for (let i = 0; i < lineCount; i++) {
        const a = (i / lineCount) * Math.PI * 2 + frameCount * 0.0002;
        const len = 180 + Math.sin(frameCount * 0.008 + i * 0.5) * 40;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len * 2, cy + Math.sin(a) * len * 0.55);
        ctx.strokeStyle = `rgba(180, 210, 255, ${0.025 + Math.sin(frameCount * 0.005 + i) * 0.015})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // Concentric orbit rings
      for (let r = 80; r <= 300; r += 45) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 1.8, r * 0.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(80, 150, 255, 0.035)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Galaxy particles
      for (const p of galaxyParticles) {
        p.angle += p.speed;
        const px = cx + Math.cos(p.angle) * p.radius * 1.8;
        const py = cy + Math.sin(p.angle) * p.radius * 0.5 + p.z * p.radius * 0.15;

        const distFromCenter = Math.sqrt((px - cx) ** 2 + ((py - cy) * 2.2) ** 2);
        const brightness = Math.max(0, 1 - distFromCenter / 600);

        const r = 170 + brightness * 85;
        const g = 200 + brightness * 55;
        const b = 255;
        const alpha = p.opacity * (0.3 + brightness * 0.7);

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      // Center neutron star glow
      const grad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
      grad1.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      grad1.addColorStop(0.2, 'rgba(200, 230, 255, 0.3)');
      grad1.addColorStop(0.5, 'rgba(100, 180, 255, 0.1)');
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.fillRect(cx - 30, cy - 30, 60, 60);

      // Outer glow pulse
      const pulse = 0.5 + Math.sin(frameCount * 0.02) * 0.3;
      const grad2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
      grad2.addColorStop(0, `rgba(150, 200, 255, ${0.15 * pulse})`);
      grad2.addColorStop(0.4, `rgba(80, 150, 255, ${0.06 * pulse})`);
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(cx - 100, cy - 100, 200, 200);

      // Inflow particles
      for (let i = inflowParticles.length - 1; i >= 0; i--) {
        const p = inflowParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        // Accelerate toward center
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          p.vx += (dx / dist) * 0.02;
          p.vy += (dy / dist) * 0.02;
        }

        const lifeRatio = p.life / p.maxLife;
        const fadeIn = Math.min(1, lifeRatio * 4);
        const fadeOut = dist < 30 ? dist / 30 : 1;
        const alpha = p.opacity * fadeIn * fadeOut;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fadeOut, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        ctx.fill();

        if (dist < 8 || p.life > p.maxLife * 1.5) {
          inflowParticles.splice(i, 1);
          spawnInflow();
        }
      }

      // Data center wireframes
      for (const dc of dataCenters) {
        dc.rotation += dc.rotSpeed;
        const cosR = Math.cos(dc.rotation);
        const sinR = Math.sin(dc.rotation);

        for (const pt of dc.points) {
          // Rotate point
          const rx = pt.x * cosR - pt.z * sinR;
          const rz = pt.x * sinR + pt.z * cosR;
          const ry = pt.y;

          // Project
          const scale = 1 / (1 + rz * 0.2);
          const px = dc.x + rx * dc.size * scale;
          const py = dc.y + ry * dc.size * scale;

          const depth = 0.6 + rz * 0.2;
          ctx.beginPath();
          ctx.arc(px, py, 1 * scale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(150, 200, 255, ${dc.opacity * depth})`;
          ctx.fill();
        }
      }

      // Data packets moving along connection lines
      for (const pkt of dataPackets) {
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1) {
          pkt.progress = 0;
          const dcIdx = Math.floor(Math.random() * dataCenters.length);
          pkt.fromX = dataCenters[dcIdx].x;
          pkt.fromY = dataCenters[dcIdx].y;
        }

        const px = pkt.fromX + (cx - pkt.fromX) * pkt.progress;
        const py = pkt.fromY + (cy - pkt.fromY) * pkt.progress;
        const alpha = Math.sin(pkt.progress * Math.PI) * 0.8;

        ctx.beginPath();
        ctx.arc(px, py, pkt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.fill();

        // Small trail
        const trailX = pkt.fromX + (cx - pkt.fromX) * (pkt.progress - 0.03);
        const trailY = pkt.fromY + (cy - pkt.fromY) * (pkt.progress - 0.03);
        ctx.beginPath();
        ctx.arc(trailX, trailY, pkt.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.4})`;
        ctx.fill();
      }

      // Dust
      for (const d of dustParticles) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0) d.x = W;
        if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H;
        if (d.y > H) d.y = 0;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160, 200, 255, ${d.opacity})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      const c = canvas.getContext('2d');
      if (c) c.scale(dpr, dpr);
    };

    resize();
    drawScene();

    const onResize = () => {
      cancelAnimationFrame(animFrameRef.current);
      resize();
      drawScene();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [drawScene]);

  return (
    <div className="landing-root">
      <canvas ref={canvasRef} className="landing-canvas" />

      {/* Hero content */}
      <div className="landing-hero">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.6, duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="landing-logos"
        >
          <img src={razorpayLogo} alt="Razorpay" className="landing-logo" />
          <span className="landing-logo-x">&times;</span>
          <img src={vyaparLogo} alt="Vyapar" className="landing-logo" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="landing-subtitle"
        >
          Make your business AI Transactable, Discoverable and Accountable.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/dashboard')}
          className="landing-cta"
        >
          <span>Get Started</span>
        </motion.button>
      </div>
    </div>
  );
}

export default LandingPage;
