'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface VoiceSphereProps {
  onRotationChange?: (rotation: { x: number; y: number }) => void
}

export function VoiceSphere({ onRotationChange }: VoiceSphereProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Store reference to container for cleanup
    const container = containerRef.current

    // Remove any existing canvases (fixes back button navigation issue)
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    // Scene setup
    const scene = new THREE.Scene()
    // No background - transparent
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    camera.position.z = 3

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(500, 500)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Create main sphere with custom shader - bigger size
    const sphereGeometry = new THREE.IcosahedronGeometry(1.3, 64)

    const vertexShader = `
      uniform float uTime;
      uniform float uFrequency;
      uniform vec2 uMouse;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDisplacement;
      varying float vNoise;

      //	Simplex 3D Noise
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 =   v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1. + 3.0 * C.xxx;
        i = mod(i, 289.0 );
        vec4 p = permute( permute( permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      void main() {
        vNormal = normal;
        vPosition = position;

        // Very smooth, gentle displacement
        float noise1 = snoise(position * 0.8 + uTime * 0.1) * 0.06;
        float noise2 = snoise(position * 1.5 + uTime * 0.05) * 0.03;

        // Slow breathing
        float breath = sin(uTime * 0.4) * 0.02;

        // Mouse attraction
        vec3 mouseDir = normalize(vec3(uMouse.x, uMouse.y, 0.3));
        float mouseInfluence = max(0.0, dot(normalize(position), mouseDir));
        mouseInfluence = pow(mouseInfluence, 3.0) * 0.08;

        float displacement = noise1 + noise2 + breath + mouseInfluence;
        displacement *= uFrequency;
        vDisplacement = displacement;
        vNoise = noise1;

        vec3 newPosition = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `

    const fragmentShader = `
      uniform float uTime;
      uniform vec2 uMouse;
      uniform vec3 uTouchPoints[5];
      uniform float uTouchIntensities[5];
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vDisplacement;
      varying float vNoise;

      void main() {
        // Smooth, elegant color palette
        vec3 dark = vec3(0.05, 0.03, 0.06);
        vec3 amber = vec3(0.7, 0.4, 0.15);
        vec3 gold = vec3(0.9, 0.6, 0.2);
        vec3 touchGlow = vec3(1.0, 0.8, 0.4);

        // Fresnel for edge glow
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);

        // Smooth gradient from dark core to glowing edge
        vec3 color = mix(dark, amber, fresnel * 0.8);
        color = mix(color, gold, pow(fresnel, 3.0) * 0.6);

        // Touch illumination
        float totalTouchGlow = 0.0;
        for (int i = 0; i < 5; i++) {
          if (uTouchIntensities[i] > 0.01) {
            vec3 touchDir = normalize(uTouchPoints[i]);
            vec3 surfaceDir = normalize(vPosition);
            float touchProximity = max(0.0, dot(surfaceDir, touchDir));
            touchProximity = pow(touchProximity, 32.0);
            totalTouchGlow += touchProximity * uTouchIntensities[i];
          }
        }
        totalTouchGlow = min(totalTouchGlow, 1.0);

        // Apply touch glow
        color = mix(color, touchGlow, totalTouchGlow * 0.8);
        color += touchGlow * totalTouchGlow * 0.2;

        // Subtle edge glow
        color += amber * pow(fresnel, 2.0) * 0.3;

        // Gentle breathing
        float breath = sin(uTime * 0.3) * 0.05 + 0.95;
        color *= breath;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    // Touch points array for fading glow effect
    const touchPoints = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 1),
    ]
    const touchIntensities = [0, 0, 0, 0, 0]
    let currentTouchIndex = 0
    let lastTouchTime = 0

    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uFrequency: { value: 1.0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uTouchPoints: { value: touchPoints },
        uTouchIntensities: { value: touchIntensities },
      },
      transparent: false,
      side: THREE.FrontSide,
    })

    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
    scene.add(sphere)

    // Mouse interaction
    const mouse = { x: 0, y: 0 }
    const targetRotation = { x: 0, y: 0 }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      // Normalize mouse position relative to container (-1 to 1)
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      // Set target rotation based on mouse position
      targetRotation.x = mouse.y * 0.5
      targetRotation.y = mouse.x * 0.5
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Create particle ring system
    const particleCount = 2000
    const particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const velocities = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.3 + Math.random() * 0.5

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      velocities[i * 3] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01

      sizes[i] = Math.random() * 3 + 1
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const particleVertexShader = `
      attribute float size;
      uniform float uTime;
      varying float vAlpha;

      void main() {
        vec3 pos = position;

        // Orbit animation
        float angle = uTime * 0.3 + length(position) * 2.0;
        float s = sin(angle);
        float c = cos(angle);
        pos.xz = mat2(c, -s, s, c) * pos.xz;

        // Pulse outward
        float pulse = sin(uTime * 2.0 + length(position) * 5.0) * 0.1;
        pos *= 1.0 + pulse;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;

        vAlpha = 0.6 + pulse;
      }
    `

    const particleFragmentShader = `
      varying float vAlpha;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
        vec3 amber = vec3(0.96, 0.62, 0.18);

        gl_FragColor = vec4(amber, alpha * 0.6);
      }
    `

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })

    // Disabled particles - causing rendering issues
    // const particles = new THREE.Points(particleGeometry, particleMaterial)
    // scene.add(particles)

    // Orbital rings disabled
    // const ringCount = 3
    // const rings: THREE.Mesh[] = []
    // for (let r = 0; r < ringCount; r++) {
    //   const ringGeometry = new THREE.TorusGeometry(1.4 + r * 0.2, 0.008, 16, 100)
    //   const ringMaterial = new THREE.MeshBasicMaterial({
    //     color: new THREE.Color(0.96, 0.62, 0.18),
    //     transparent: true,
    //     opacity: 0.4 - r * 0.1,
    //   })
    //   const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    //   ring.rotation.x = Math.PI / 2 + r * 0.3
    //   ring.rotation.y = r * 0.5
    //   ring.userData = { baseRotationX: ring.rotation.x, baseRotationY: ring.rotation.y, index: r }
    //   rings.push(ring)
    //   scene.add(ring)
    // }

    // Animation
    let time = 0
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      time += 0.016

      // Update sphere
      sphereMaterial.uniforms.uTime.value = time
      sphereMaterial.uniforms.uMouse.value.set(mouse.x, mouse.y)

      // Calculate touch point from mouse position
      // Convert mouse to 3D direction on sphere surface
      const touchDir = new THREE.Vector3(mouse.x, mouse.y, 0.5).normalize()

      // Apply inverse sphere rotation to get local touch position
      const inverseRotation = new THREE.Euler(-sphere.rotation.x, -sphere.rotation.y, 0)
      touchDir.applyEuler(inverseRotation)

      // Record new touch point periodically (every 100ms)
      if (time - lastTouchTime > 0.1 && (Math.abs(mouse.x) > 0.1 || Math.abs(mouse.y) > 0.1)) {
        touchPoints[currentTouchIndex].copy(touchDir)
        touchIntensities[currentTouchIndex] = 1.0
        currentTouchIndex = (currentTouchIndex + 1) % 5
        lastTouchTime = time
      }

      // Fade all touch intensities slowly
      for (let i = 0; i < 5; i++) {
        touchIntensities[i] *= 0.985 // Slow fade
      }

      // Update touch uniforms
      sphereMaterial.uniforms.uTouchPoints.value = touchPoints
      sphereMaterial.uniforms.uTouchIntensities.value = touchIntensities

      // Slow, mysterious activity - like deep breathing
      const activity = Math.sin(time * 0.4) * 0.15 + 0.85 + Math.sin(time * 0.7) * 0.1
      sphereMaterial.uniforms.uFrequency.value = activity

      // Slower, more deliberate rotation towards mouse
      sphere.rotation.x += (targetRotation.x - sphere.rotation.x) * 0.02
      sphere.rotation.y += (targetRotation.y - sphere.rotation.y) * 0.02

      // Very slow idle rotation - contemplative
      sphere.rotation.y += 0.0008

      // Report rotation to parent
      if (onRotationChange) {
        onRotationChange({
          x: sphere.rotation.x,
          y: sphere.rotation.y % (Math.PI * 2),
        })
      }

      // Rotate rings (disabled)
      // scene.children.forEach((child) => {
      //   if (child.userData.index !== undefined) {
      //     child.rotation.z = time * (0.2 + child.userData.index * 0.1)
      //   }
      // })

      renderer.render(scene, camera)
    }

    animate()

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return
      const size = Math.min(containerRef.current.offsetWidth, 500)
      renderer.setSize(size, size)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationId)
      // Use stored container reference for reliable cleanup
      if (container && renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
      sphereGeometry.dispose()
      sphereMaterial.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
    }
  }, [onRotationChange])

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
    />
  )
}
