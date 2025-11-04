import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import {
    initGalaxyLoader,
    updateGalaxyLoaderProgress,
    setGalaxyLoaderStatus,
    completeGalaxyLoader,
    dismissGalaxyLoader,
    skipGalaxyLoader
} from './galaxy_loader.js';

// Global state
let scene, camera, renderer, controls;
let composer, bloomPass;
let sun, sunLight, sunMaterial, sunCoronaMaterial;
let planets = [];
let orbitLines = [];
let atmosphereMeshes = [];
let comets = [];
let time = 0;
let animationSpeed = 0.5;
let isPaused = false;
let focusedObject = null;
let starParticles = null;

const textures = {};
let loadingManager;

const SUN_ORIGIN = new THREE.Vector3(0, 0, 0);
const COMET_BASE_DIRECTION = new THREE.Vector3(-1, 0, 0);
const TEMP_VEC3 = new THREE.Vector3();
const TEMP_ROLL_QUATERNION = new THREE.Quaternion();
const TEMP_ORIENTATION_QUATERNION = new THREE.Quaternion();
const textureScrollEntries = [];
const registeredScrollTextures = new Set();
const dynamicSurfaceOverlays = [];
const meteors = [];

let meteorGeometry = null;
let loaderWasSkipped = false;

function registerTextureScroll(texture, speedX, speedY = 0) {
    if (!texture || !texture.isTexture) return;
    if (Math.abs(speedX) < 1e-6 && Math.abs(speedY) < 1e-6) return;
    const id = texture.uuid;
    if (!registeredScrollTextures.has(id)) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        textureScrollEntries.push({
            texture,
            speed: new THREE.Vector2(speedX, speedY)
        });
        registeredScrollTextures.add(id);
    }
}

const TEX_BASE = 'https://www.solarsystemscope.com/textures/';
const TEX_HQ = {
    sun: TEX_BASE + '8k_sun.jpg',
    mercury: TEX_BASE + '8k_mercury.jpg',
    venus: TEX_BASE + '8k_venus_surface.jpg',
    earth_day: TEX_BASE + '8k_earth_daymap.jpg',
    earth_clouds: TEX_BASE + '8k_earth_clouds.jpg',
    earth_normal: TEX_BASE + '8k_earth_normal_map.jpg',
    earth_specular: TEX_BASE + '8k_earth_specular_map.jpg',
    moon: TEX_BASE + '8k_moon.jpg',
    mars: TEX_BASE + '8k_mars.jpg',
    jupiter: TEX_BASE + '8k_jupiter.jpg',
    saturn: TEX_BASE + '8k_saturn.jpg',
    saturn_ring: TEX_BASE + '8k_saturn_ring_alpha.png',
    uranus: TEX_BASE + '2k_uranus.jpg',
    neptune: TEX_BASE + '2k_neptune.jpg',
    stars: TEX_BASE + '8k_stars_milky_way.jpg',
};

const LOCAL_TEXTURES = {
    sun: './assets/textures/planets/sun.jpg',
    mercury: './assets/textures/planets/mercury.jpg',
    venus: './assets/textures/planets/venus.jpg',
    earth_day: './assets/textures/planets/earth_day.jpg',
    earth_clouds: './assets/textures/planets/earth_clouds.jpg',
    earth_normal: './assets/textures/planets/earth_normal.jpg',
    earth_specular: './assets/textures/planets/earth_specular.jpg',
    moon: './assets/textures/planets/moon.jpg',
    mars: './assets/textures/planets/mars.jpg',
    jupiter: './assets/textures/planets/jupiter.jpg',
    saturn: './assets/textures/planets/saturn.jpg',
    saturn_ring: './assets/textures/planets/saturn_ring_alpha.jpg',
    uranus: './assets/textures/planets/uranus.jpg',
    neptune: './assets/textures/planets/neptune.jpg',
    flare0: './assets/textures/lensflare/lensflare0.png',
    flare3: './assets/textures/lensflare/lensflare3.png'
};

const TEX_FLARE_BASE = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r165/examples/textures/lensflare/';
const TEX_FLARE = {
    flare0: TEX_FLARE_BASE + 'lensflare0.png',
    flare3: TEX_FLARE_BASE + 'lensflare3.png'
};

const PLANET_DATA = {
    mercury: { name: 'Mercury', radius: 0.40, distance: 20, speed: 4.74, rotationSpeed: 0.01 },
    venus: { name: 'Venus', radius: 0.95, distance: 30, speed: 3.50, rotationSpeed: 0.004, hasAtmosphere: true, atmosphereColor: 0xffe4b5 },
    earth: { name: 'Earth', radius: 1.00, distance: 45, speed: 2.98, rotationSpeed: 1.00, hasAtmosphere: true, atmosphereColor: 0x4d94ff },
    mars: { name: 'Mars', radius: 0.53, distance: 60, speed: 2.41, rotationSpeed: 0.97, hasAtmosphere: true, atmosphereColor: 0xff4500 },
    jupiter: { name: 'Jupiter', radius: 4.50, distance: 100, speed: 1.31, rotationSpeed: 2.40 },
    saturn: { name: 'Saturn', radius: 4.00, distance: 140, speed: 0.97, rotationSpeed: 2.20, hasRings: true },
    uranus: { name: 'Uranus', radius: 2.00, distance: 180, speed: 0.68, rotationSpeed: 1.40 },
    neptune: { name: 'Neptune', radius: 1.90, distance: 210, speed: 0.54, rotationSpeed: 1.50 },
};

const PROJECT_TIMELINE = {
    sun: {
        bubbleColor: '#ffb347',
        title: 'Generative Adversarial Network for Human Action Generation',
        shortTitle: 'Capstone Thesis',
        term: 'Fall 2025',
        focus: 'Text-to-motion generation research',
        role: 'Lead researcher',
        team: 'Individual project',
        summary: 'Built a hybrid ST-GCN and DST-Transformer pipeline that turns open-ended text into coherent human motion while balancing fidelity and controllability.',
        order: 8,
        page: 'capstone.html',
        buttonLabel: 'Capstone',
        buttonIcon: '🡪',
        contributions: [
            'Combined ST-GCN generators with DST-Transformer critics to capture local joint dynamics and global semantics.',
            'Created an evaluation suite with Reality Gap, FGD, and APE to expose where metrics diverge from perceived motion quality.',
            'Packaged insights into interactive dashboards and videos for faculty and industry reviewers.'
        ],
        technologies: 'PyTorch | ST-GCN | Transformers | Python | Linux'
    },
    mercury: {
        bubbleColor: '#b2b2b2',
        title: 'TETRECS Multiplayer',
        shortTitle: 'TETRECS',
        term: 'Fall 2023',
        focus: 'Realtime JavaFX game development',
        role: 'Solo developer',
        team: 'Individual project',
        summary: 'Built a JavaFX spin on Tetris with polished single-player controls and a social multiplayer lobby where friends battle in real time.',
        order: 1,
        page: 'tetrecs.html',
        buttonLabel: 'Play Demo',
        buttonIcon: '🎮',
        contributions: [
            'Coded smooth block movement, rotation, and scoring loops so single-player feels as responsive as the original classics.',
            'Added realtime multiplayer: players host rooms, chat, and watch incoming garbage lines as they attack each other.',
            'Designed an intuitive JavaFX UI with keyboard shortcuts, tooltips, and onboarding screens for new players.'
        ],
        technologies: 'Java | JavaFX | Realtime networking | UI design'
    },
    venus: {
        bubbleColor: '#ffd27f',
        title: 'Interaction Design Coursework: Energy Garden',
        shortTitle: 'Interaction Design Coursework',
        term: 'Spring 2024',
        focus: 'Behaviour-change UX research',
        role: 'Design researcher & prototyper',
        team: '3-person studio team',
        summary: 'Researched household energy habits and prototyped a gamified “Energy Garden” app that rewards sustainable routines without sacrificing comfort.',
        order: 2,
        page: 'interaction_design.html',
        buttonLabel: 'View Case Study',
        buttonIcon: '🌱',
        contributions: [
            'Interviewed renters and families, mapped themes around convenience, comfort, cost, scheduling, cognition, and environmental motivation.',
            'Framed the core problem as behaviour change over automation and storyboarded motivational loops (streaks, forest health, battery bank).',
            'Built iterative Figma prototypes and system flows that link smart-meter data to playful progress visualisations.'
        ],
        technologies: 'Figma | Miro | User interviews | Storyboarding | Behavioural design'
    },
    earth: {
        bubbleColor: '#4da6ff',
        title: 'Ad Auction Intelligence Dashboard',
        shortTitle: 'Ad Auction Dashboard',
        term: 'Spring 2024',
        focus: 'Campaign analytics & visualization',
        role: 'Data dashboard engineer',
        team: '4 developers',
        summary: 'Delivered a role-based web dashboard that ingests campaign logs, visualizes auction KPIs, and lets marketing teams explore results with rich filters.',
        order: 3,
        page: 'ad_auction_dashboard.html',
        buttonLabel: 'View Dashboard',
        buttonIcon: '📊',
        contributions: [
            'Parsed server, impression, and click logs from uploaded zip files, joining them into a unified metrics model.',
            'Implemented filters for age, user ID, context, and date so analysts can slice performance in seconds.',
            'Built role-specific workflows: admins manage users and campaigns, editors tweak filters, and viewers explore charts and export CSV/PNG reports.'
        ],
        technologies: 'Python | Flask | React | D3.js | Role-based access control'
    },
    mars: {
        bubbleColor: '#ee8156',
        title: 'Distributed File System',
        shortTitle: 'Distributed Storage Service',
        term: 'Fall 2024',
        focus: 'Fault-tolerant storage design',
        role: 'Systems engineer',
        team: 'Individual project',
        summary: 'Implemented a Java-based controller plus Dstores that replicate, rebalance, and serve files concurrently over TCP.',
        order: 4,
        page: 'distributed_file_system.html',
        contributions: [
            'Implemented controller and Dstores with a mixed text/binary protocol, timeouts, and acknowledgements for reliable messaging.',
            'Designed lifecycle index states ("store in progress", "store complete", "remove in progress") to ensure correctness under concurrency.',
            'Balanced file placement with R-way replication, periodic rebalancing, and JOIN handling for new Dstores.',
            'Added recovery flows for dropped Dstores and ran multi-client concurrency tests on OpenJDK 21.'
        ],
        technologies: 'Java | TCP sockets | Multithreading | Data structures | Linux'
    },
    jupiter: {
        bubbleColor: '#c28f5b',
        title: 'MYKEY Graph Query Language',
        shortTitle: 'PL Concepts',
        term: 'Fall 2024',
        focus: 'DSL design & static analysis',
        role: 'Language designer & implementer',
        team: 'Individual project',
        summary: 'Specified and implemented MYKEY, a declarative query language for Neo4j graphs with static scoping, strict typing, and rich graph operators.',
        order: 5,
        page: 'programming_language_concepts.html',
        buttonLabel: 'Case Study',
        buttonIcon: '🧠',
        contributions: [
            'Defined grammar, lexer, and parser rules for nodes, relationships, optional matches, and custom operators such as EACH/BY and NOT IN.',
            'Implemented static scoping and type checking to guarantee boolean WHERE clauses, well-typed property updates, and safe aggregations before runtime.',
            'Engineered graph conversion structures and informative compiler errors to bridge CSV imports with Neo4j-oriented execution.'
        ],
        technologies: 'Haskell | Parser combinators | Static analysis | Neo4j | DSL design'
    },
    saturn: {
        bubbleColor: '#f2d4a3',
        title: 'K-Means Cluster Selection Study',
        shortTitle: 'Machine Learning Techniques',
        term: 'Fall 2025',
        focus: 'Unsupervised NLP analysis',
        role: 'Research author',
        team: 'Individual study',
        summary: 'Evaluated K-Means variants on high-frequency word co-occurrence matrices to determine an optimal cluster strategy guided by Occam’s Razor.',
        order: 7,
        page: 'machine_learning_report.html',
        buttonLabel: 'Report',
        buttonIcon: '📄',
        contributions: [
            'Preprocessed corpora with stemming, stop-word removal, and frequency curation to isolate 10k salient tokens.',
            'Constructed and normalised co-occurrence matrices (window size 15) to stabilise distance metrics for clustering.',
            'Benchmarked K values 2-9 via KMeans++ initialisation, K-fold Silhouette/WCSS analysis, and selected K=4 as the simplest performant model.'
        ],
        technologies: 'Python | Scikit-learn | NLP preprocessing | K-Means | Data visualisation'
    },
    uranus: {
        bubbleColor: '#7de3f5',
        title: 'Cloud Application Development',
        shortTitle: 'Cloud App Development',
        term: 'Fall 2025',
        focus: 'Cloud-native full-stack service',
        role: 'Full-stack engineer',
        team: 'Cross-functional team',
        summary: 'Developed and deployed a cross-platform web app with an Azure backend, GCP frontend, and LLM-powered personalization.',
        order: 6,
        page: 'cloud_application_development.html',
        buttonLabel: 'Launch',
        buttonIcon: '🚀',
        contributions: [
            'Designed and implemented a RESTful Python API with authentication, validation, and rate limiting.',
            'Integrated CORS policies and CI/CD pipelines so multiple clients could consume the API securely.',
            'Containerized services, deploying the backend on Azure and the frontend on GCP for low-latency coverage.',
            'Hooked LLM APIs into the service layer to deliver tailored recommendations and summaries.'
        ],
        technologies: 'Python | REST APIs | Vue.js | JavaScript | Azure | GCP | Docker | CI/CD | LLM APIs'
    }
};

// ============================================================================
// ============================================================================

const VertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
        vUv = uv;
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const SunFragmentShader = `
    uniform sampler2D sunTexture;
    uniform float time;
    uniform vec3 glowColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    float noise(vec2 p) {
        return sin(p.x * 10.0 + time * 0.4) * cos(p.y * 10.0 - time * 0.35);
    }

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
        vec2 uv = vUv;
        
        vec2 displacement = vec2(noise(uv * 2.5) * 0.02, noise(uv * 2.5 + 0.5) * 0.015);
        vec4 texColor = texture2D(sunTexture, uv + displacement);
        
        float brightness = 2.2;
        vec3 color = pow(texColor.rgb, vec3(0.75)) * brightness;
        
        float wave = sin((uv.x + time * 0.28) * 16.0) * 0.08 +
                     sin((uv.y - time * 0.24) * 18.0) * 0.07;
        color += color * wave;
        
        float flareNoise = sin((uv.x * 34.0) + time * 3.6) * sin((uv.y * 28.0) - time * 3.1);
        flareNoise = pow(max(flareNoise, 0.0), 2.0);
        float flareSpots = hash(uv * 40.0 + time * 0.7);
        flareSpots = smoothstep(0.75, 1.0, flareSpots) * 0.6;
        color += vec3(1.3, 0.95, 0.55) * (flareNoise + flareSpots * 0.8);
        
        float coreIntensity = 1.0 - length(vUv - vec2(0.5)) * 2.0;
        coreIntensity = pow(max(0.0, coreIntensity), 2.5);
        color += vec3(1.0, 0.95, 0.7) * coreIntensity * 0.6;

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - dot(vNormal, viewDirection), 3.0);
        vec3 glow = glowColor * fresnel * 1.6;

        float pulse = sin(time * 2.6) * 0.12 + 1.0;
        float burst = pow(max(0.0, sin(time * 0.9) * sin(time * 0.5)), 3.0) * 0.35;
        color *= (pulse + burst);

        color = clamp(color, 0.0, 4.0);

        gl_FragColor = vec4(color + glow, 1.0);
    }
`;

const CoronaVertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const CoronaFragmentShader = `
    uniform vec3 innerColor;
    uniform vec3 outerColor;
    uniform float time;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 4.0);

        float band = sin((vNormal.x * 10.0) + time * 2.4) * 0.25 +
                     sin((vNormal.y * 15.0) - time * 2.0) * 0.2;

        float radialNoise = hash(normalize(vWorldPosition) * 5.0 + time * 0.2);
        float radialRipples = sin(length(vWorldPosition) * 0.35 - time * 3.0) * 0.2;
        float intensity = clamp(fresnel * (1.1 + band + radialNoise * 0.5 + radialRipples), 0.0, 1.0);

        vec3 color = mix(innerColor, outerColor, intensity * 1.15);
        float alpha = intensity * 0.95;

        if (alpha < 0.02) discard;
        gl_FragColor = vec4(color, alpha);
    }
`;

const DynamicSurfaceVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const DynamicSurfaceFragmentShader = `
    uniform vec3 tintA;
    uniform vec3 tintB;
    uniform float time;
    uniform float frequency;
    uniform float strength;
    uniform vec2 flowDirection;
    uniform float opacity;
    varying vec2 vUv;
    varying vec3 vNormal;

    float noise(vec2 p) {
        return sin(p.x + time * 0.6) * sin(p.y - time * 0.5);
    }

    float fbm(vec2 p) {
        float total = 0.0;
        float amplitude = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 4; i++) {
            total += amplitude * noise(p * freq);
            freq *= 2.05;
            amplitude *= 0.55;
        }
        return total;
    }

    void main() {
        vec2 uv = vUv;
        float flow = dot(flowDirection, uv) * frequency;
        float bands = sin(flow + time) * 0.5 + 0.5;
        float turbulence = fbm(uv * frequency * 0.8 + time * 0.4);
        float intensity = clamp(bands + turbulence * strength, 0.0, 1.0);
        vec3 color = mix(tintA, tintB, intensity);
        float alpha = opacity * intensity;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(color, alpha);
    }
`;

const MeteorVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const MeteorFragmentShader = `
    uniform vec3 headColor;
    uniform vec3 tailColor;
    uniform float opacity;
    uniform float tailSharpness;
    varying vec2 vUv;

    void main() {
        float fade = pow(1.0 - vUv.y, tailSharpness);
        vec3 color = mix(tailColor, headColor, 1.0 - fade);
        float alpha = fade * opacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, alpha);
    }
`;

const AtmosphereFragmentShader = `
    uniform vec3 glowColor;
    uniform vec3 sunDirection;
    uniform float time;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - dot(vNormal, viewDirection), 3.0);
        float intensity = smoothstep(0.0, 1.0, fresnel);
        
        float lightFactor = max(0.0, dot(vNormal, sunDirection));
        float wave = sin(dot(vNormal.xy, vec2(12.0, 9.0)) + time * 1.5) * 0.1 +
                     sin(dot(vNormal.yz, vec2(7.0, 5.0)) - time * 2.0) * 0.08;
        lightFactor = pow(lightFactor, 0.5) * (0.65 + wave) + 0.35;
        
        float aurora = pow(max(0.0, sin(vWorldPosition.y * 0.2 + time * 0.8)), 3.0) * 0.25;
        
        vec3 color = glowColor * (lightFactor + aurora);
        float alpha = intensity * 0.85;
        
        gl_FragColor = vec4(color, alpha);
    }
`;

const CometTailVertexShader = `
    varying vec2 vUv;
    varying float vDistance;
    void main() {
        vUv = uv;
        vDistance = length(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const CometTailFragmentShader = `
    uniform vec3 tailColor;
    uniform float opacity;
    varying vec2 vUv;
    varying float vDistance;

    void main() {
        float fade = 1.0 - vUv.x;
        fade = pow(fade, 2.0);
        
        float radial = 1.0 - abs(vUv.y - 0.5) * 2.0;
        radial = pow(radial, 1.5);
        
        float alpha = fade * radial * opacity;
        gl_FragColor = vec4(tailColor, alpha);
    }
`;

// ============================================
// ============================================
function init() {
    console.log("🚀 Initializing cinematic solar system...");
    loaderWasSkipped = skipGalaxyLoader();
    if (!loaderWasSkipped) {
        initGalaxyLoader();
        updateGalaxyLoaderProgress(0);
        setGalaxyLoaderStatus(null);
    }
    setupLoadingManager();
    setupSceneAndRenderer();
    loadTextures();
}

function setupLoadingManager() {
    loadingManager = new THREE.LoadingManager(
        () => {
            console.log("✅ Assets loaded, building scene.");
            if (!loaderWasSkipped) {
                updateGalaxyLoaderProgress(100, 'Journey complete!');
                completeGalaxyLoader();
                setGalaxyLoaderStatus('Click anywhere to enter the system.');

                const enterExperience = () => {
                    dismissGalaxyLoader();
                    document.removeEventListener('pointerdown', enterExperience);
                    document.removeEventListener('keydown', enterViaKeyboard);
                };
                const enterViaKeyboard = (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        enterExperience();
                    }
                };
                document.addEventListener('pointerdown', enterExperience);
                document.addEventListener('keydown', enterViaKeyboard);
            }

            buildScene();
            animate();
        },
        (url, loaded, total) => {
            const percent = total ? Math.round((loaded / total) * 100) : 100;
            if (!loaderWasSkipped) {
                updateGalaxyLoaderProgress(percent);
            }
        },
        (url) => {
            console.error('Resource failed to load:', url);
            if (!loaderWasSkipped) {
                setGalaxyLoaderStatus(`Failed to load ${url}`);
            }
        }
    );
}

function setupSceneAndRenderer() {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000011, 500, 10000);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true,
        alpha: false,
        premultipliedAlpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) canvasContainer.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50000);
    camera.position.set(0, 80, 250);
}

function loadTextures() {
    const textureLoader = new THREE.TextureLoader(loadingManager);
    textureLoader.setCrossOrigin('anonymous');

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const configureTexture = (key, texture, url) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        if (!key.includes('normal') && !key.includes('specular')) {
            texture.colorSpace = THREE.SRGBColorSpace;
        }
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;

        console.log(`✅ Texture loaded: ${key} (${url})`);
    };

    const tryLoad = (key, sources, index = 0) => {
        if (!sources.length) {
            console.warn(`⚠️ No texture source provided for ${key}; using fallback texture.`);
            textures[key] = createFallbackTexture(key);
            return;
        }

        if (index >= sources.length) {
            console.warn(`⚠️ All sources failed for ${key}; using fallback texture.`);
            textures[key] = createFallbackTexture(key);
            return;
        }

        const url = sources[index];
        textures[key] = textureLoader.load(
            url,
            (texture) => configureTexture(key, texture, url),
            undefined,
            (error) => {
                console.warn(`⚠️ Texture failed to load ${key} (${url}):`, error);
                tryLoad(key, sources, index + 1);
            }
        );
    };

    const textureSources = {};

    Object.keys(TEX_HQ).forEach(key => {
        const sources = [];
        if (LOCAL_TEXTURES[key]) sources.push(LOCAL_TEXTURES[key]);
        sources.push(TEX_HQ[key]);
        textureSources[key] = sources;
    });

    textureSources.flare0 = [
        LOCAL_TEXTURES.flare0,
        TEX_FLARE.flare0
    ];
    textureSources.flare3 = [
        LOCAL_TEXTURES.flare3,
        TEX_FLARE.flare3
    ];

    const priorityKeys = ['sun', 'earth_day'];
    priorityKeys.forEach(key => {
        if (textureSources[key]) {
            tryLoad(key, textureSources[key].filter(Boolean));
            delete textureSources[key];
        }
    });

    Object.entries(textureSources).forEach(([key, sources]) => {
        tryLoad(key, sources.filter(Boolean));
    });
}

function createFallbackTexture(key) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const colors = {
        sun: ['#FDB813', '#FF6B00'],
        mercury: ['#B8B8B8', '#6E6E6E'],
        venus: ['#FFC649', '#D4A051'],
        earth_day: ['#4DA6FF', '#2E7CB8'],
        mars: ['#E27B58', '#C1440E'],
        jupiter: ['#C88B3A', '#E8C9A0'],
        saturn: ['#FAD5A5', '#E6B96C'],
        uranus: ['#7DE3F5', '#4FA8B8'],
        neptune: ['#5B5DDF', '#2E3F8F'],
        moon: ['#C0C0C0', '#808080']
    };

    const planetKey = key.split('_')[0];
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);

    if (colors[planetKey]) {
        gradient.addColorStop(0, colors[planetKey][0]);
        gradient.addColorStop(1, colors[planetKey][1]);
    } else {
        gradient.addColorStop(0, '#888888');
        gradient.addColorStop(1, '#444444');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    return new THREE.CanvasTexture(canvas);
}

// ============================================
// ============================================
function buildScene() {
    createStarfield();
    createParticleStars();
    setupLighting();
    createSun();
    createPlanetsAndOrbits();
    createMoon();
    createComets();
    createMeteors();
    setupPostProcessing();
    setupControls();
    setupInteractions();
    window.addEventListener('resize', onWindowResize);
    updateStats();
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x2a2a4a, 0.4);
    scene.add(ambientLight);

    sunLight = new THREE.PointLight(0xffffff, 140000);
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = true;
    sunLight.decay = 2;

    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.bias = 0.0002;
    sunLight.shadow.normalBias = 0.05;

    scene.add(sunLight);

    const fillLight = new THREE.HemisphereLight(0x6d8dc4, 0x1a1a2a, 0.25);
    scene.add(fillLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.15);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);
}

function createStarfield() {
    const geometry = new THREE.SphereGeometry(20000, 64, 64);
    const material = new THREE.MeshBasicMaterial({
        map: textures.stars,
        side: THREE.BackSide,
        color: new THREE.Color(1.2, 1.2, 1.3),
    });
    const starfield = new THREE.Mesh(geometry, material);
    scene.add(starfield);
}

function createParticleStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 100000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;

        let radius, theta, phi;

        if (i < starCount * 0.3) {
            radius = 500 + Math.random() * 5000;
        } else if (i < starCount * 0.7) {
            radius = 5000 + Math.random() * 10000;
        } else {
            radius = 15000 + Math.random() * 5000;
        }

        theta = Math.random() * Math.PI * 2;
        phi = Math.random() * Math.PI;

        if (Math.random() < 0.3) {
            phi = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        }

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);

        const colorVariation = Math.random();
        if (colorVariation < 0.5) {
            colors[i3] = 1.0;
            colors[i3 + 1] = 1.0;
            colors[i3 + 2] = 1.0;
        } else if (colorVariation < 0.7) {
            colors[i3] = 0.85 + Math.random() * 0.15;
            colors[i3 + 1] = 0.9 + Math.random() * 0.1;
            colors[i3 + 2] = 1.0;
        } else if (colorVariation < 0.85) {
            colors[i3] = 1.0;
            colors[i3 + 1] = 0.95 + Math.random() * 0.05;
            colors[i3 + 2] = 0.8 + Math.random() * 0.2;
        } else if (colorVariation < 0.95) {
            colors[i3] = 1.0;
            colors[i3 + 1] = 0.8 + Math.random() * 0.1;
            colors[i3 + 2] = 0.5 + Math.random() * 0.2;
        } else {
            colors[i3] = 1.0;
            colors[i3 + 1] = 0.6 + Math.random() * 0.2;
            colors[i3 + 2] = 0.4 + Math.random() * 0.2;
        }

        const distanceFactor = 1 - (radius - 500) / 19500;
        sizes[i] = (Math.random() * 3 + 0.5) * (0.5 + distanceFactor * 1.5);
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starsMaterial = new THREE.PointsMaterial({
        size: 4,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        map: createStarTexture()
    });

    starParticles = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starParticles);

    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = 50000;
    const dustPositions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
        const i3 = i * 3;
        const radius = 1000 + Math.random() * 19000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;

        dustPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        dustPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        dustPositions[i3 + 2] = radius * Math.cos(phi);
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

    const dustMaterial = new THREE.PointsMaterial({
        size: 0.5,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const starDust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(starDust);
}

function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    return new THREE.CanvasTexture(canvas);
}

function createMeteorMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            headColor: { value: new THREE.Color(1.2, 1.1, 1.0) },
            tailColor: { value: new THREE.Color(1.0, 0.8, 0.4) },
            opacity: { value: 0.0 },
            tailSharpness: { value: 2.5 }
        },
        vertexShader: MeteorVertexShader,
        fragmentShader: MeteorFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
}

function ensureMeteorGeometry() {
    if (meteorGeometry) return;
    meteorGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    meteorGeometry.translate(0, -0.5, 0); // head at origin, tail extends backward
}

function spawnMeteor(meteor) {
    meteor.active = true;
    meteor.maxLife = 3.0 + Math.random() * 3.0;
    meteor.life = meteor.maxLife;
    meteor.opacity = 0.8 + Math.random() * 0.2;
    meteor.tailLengthBase = 200 + Math.random() * 300;
    meteor.tailWidth = 2.0 + Math.random() * 2.5;
    meteor.mesh.material.uniforms.tailSharpness.value = 1.8 + Math.random() * 1.2;

    const startRadius = 1200 + Math.random() * 1200;
    const startDir = new THREE.Vector3().randomDirection();
    meteor.position.copy(startDir).multiplyScalar(startRadius);

    const tangent = new THREE.Vector3().crossVectors(startDir, new THREE.Vector3(0, 1, 0));
    if (tangent.lengthSq() < 0.0001) tangent.set(1, 0, 0);
    tangent.normalize();

    const velocityDir = startDir.clone().multiplyScalar(-1).add(tangent.multiplyScalar((Math.random() - 0.5) * 0.6));
    velocityDir.normalize();

    meteor.velocity.copy(velocityDir).multiplyScalar(320 + Math.random() * 180);
    meteor.mesh.visible = true;
    meteor.mesh.material.uniforms.opacity.value = 0.0;
    meteor.mesh.material.uniforms.headColor.value.setHSL(0.1 + Math.random() * 0.08, 1.0, 0.95);
    meteor.mesh.material.uniforms.tailColor.value.setHSL(0.08 + Math.random() * 0.05, 0.9, 0.65);
    meteor.mesh.position.copy(meteor.position);
    const dir = meteor.velocity.clone().normalize();
    meteor.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    meteor.mesh.scale.set(meteor.tailWidth, meteor.tailLengthBase, 1);
}

function resetMeteor(meteor) {
    meteor.active = false;
    meteor.spawnDelay = 1.5 + Math.random() * 4.0;
    meteor.mesh.visible = false;
    meteor.mesh.material.uniforms.opacity.value = 0.0;
}

function createMeteors(count = 150) {
    ensureMeteorGeometry();
    for (let i = 0; i < count; i++) {
        const material = createMeteorMaterial();
        const mesh = new THREE.Mesh(meteorGeometry, material);
        mesh.visible = false;
        scene.add(mesh);

        const meteor = {
            mesh,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            life: 0,
            maxLife: 0,
            spawnDelay: Math.random() * 3 + 0.5,
            opacity: 0,
            tailLengthBase: 0,
            tailWidth: 0,
            active: false
        };
        meteors.push(meteor);
    }
}

function createSun() {
    const sunRadius = 10;
    const sunGroup = new THREE.Group();

    const coreGeometry = new THREE.SphereGeometry(sunRadius * 0.98, 128, 128);
    let coreMaterial;

    if (textures.sun && textures.sun.image !== undefined) {
        coreMaterial = new THREE.MeshBasicMaterial({
            map: textures.sun,
            color: new THREE.Color(2.5, 2.2, 1.8),
        });
    } else {
        coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
        });
    }

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    sunGroup.add(core);

    const glowGeometry = new THREE.SphereGeometry(sunRadius, 128, 128);

    if (textures.sun && textures.sun.image !== undefined) {
        sunMaterial = new THREE.ShaderMaterial({
            uniforms: {
                sunTexture: { value: textures.sun },
                time: { value: 0.0 },
                glowColor: { value: new THREE.Color(0xffd14a) }
            },
            vertexShader: VertexShader,
            fragmentShader: SunFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowMesh = new THREE.Mesh(glowGeometry, sunMaterial);
        sunGroup.add(glowMesh);
    }

    const coronaGeometry = new THREE.SphereGeometry(sunRadius * 1.7, 128, 128);
    sunCoronaMaterial = new THREE.ShaderMaterial({
        uniforms: {
            innerColor: { value: new THREE.Color(1.15, 0.75, 0.35) },
            outerColor: { value: new THREE.Color(1.0, 0.98, 0.9) },
            time: { value: 0.0 }
        },
        vertexShader: CoronaVertexShader,
        fragmentShader: CoronaFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });
    const corona = new THREE.Mesh(coronaGeometry, sunCoronaMaterial);
    sunGroup.add(corona);

    sun = sunGroup;
    const sunProject = PROJECT_TIMELINE.sun;
    sun.userData = {
        key: 'sun',
        radius: sunRadius,
        project: sunProject,
        order: sunProject?.order,
        name: 'Sun',
        planetName: 'Sun'
    };
    scene.add(sun);
    createPlanetListItem('sun', sun.userData, sun);

    if (textures.flare0 && textures.flare3) {
        const lensflare = new Lensflare();
        const flareColor = new THREE.Color(1.0, 0.85, 0.6);
        lensflare.addElement(new LensflareElement(textures.flare0, 500, 0, flareColor));
        lensflare.addElement(new LensflareElement(textures.flare3, 50, 0.4));
        lensflare.addElement(new LensflareElement(textures.flare3, 70, 0.6));
        lensflare.addElement(new LensflareElement(textures.flare3, 90, 0.8));
        lensflare.addElement(new LensflareElement(textures.flare3, 110, 0.95));
        sunLight.add(lensflare);
    }
}

function createPlanetsAndOrbits() {
    Object.keys(PLANET_DATA).forEach(key => {
        const data = PLANET_DATA[key];

        createOrbit(data.distance);

        const geometry = new THREE.SphereGeometry(data.radius, 128, 128);

        const distanceFactor = Math.min(1, data.distance / 100);

        let material;

        if (key === 'earth') {
            const earthTexture = textures.earth_day || createFallbackTexture('earth_day');

            const matOptions = {
                map: earthTexture,
                roughness: 0.4,
                metalness: 0.1,
            };
            registerTextureScroll(earthTexture, 0.0001);

            if (textures.earth_normal && textures.earth_normal.image) {
                matOptions.normalMap = textures.earth_normal;
                matOptions.normalScale = new THREE.Vector2(0.5, 0.5);
                registerTextureScroll(textures.earth_normal, 0.00015);
            }

            if (textures.earth_specular && textures.earth_specular.image) {
                matOptions.metalnessMap = textures.earth_specular;
                matOptions.roughnessMap = textures.earth_specular;
                registerTextureScroll(textures.earth_specular, 0.00015);
            }

            material = new THREE.MeshStandardMaterial(matOptions);

        } else {
            const planetTexture = textures[key] || textures[key + '_day'] || createFallbackTexture(key);

            const matOptions = {
                map: planetTexture,
                roughness: 0.5 + distanceFactor * 0.4,
                metalness: 0.1 - distanceFactor * 0.1,
            };
            registerTextureScroll(planetTexture, 0.0);

            if (key === 'venus') {
                matOptions.roughness = 0.3;
                matOptions.metalness = 0.05;
            } else if (key === 'jupiter' || key === 'saturn') {
                matOptions.roughness = 0.6;
                matOptions.metalness = 0.02;
                registerTextureScroll(planetTexture, key === 'jupiter' ? 0.0008 : 0.0006);
            } else if (key === 'mars') {
                matOptions.roughness = 0.8;
                matOptions.metalness = 0.0;
            }

            material = new THREE.MeshStandardMaterial(matOptions);
        }

        const planet = new THREE.Mesh(geometry, material);
        planet.castShadow = true;
        planet.receiveShadow = true;

        const angle = Math.random() * Math.PI * 2;
        planet.position.set(Math.cos(angle) * data.distance, 0, Math.sin(angle) * data.distance);

        const project = PROJECT_TIMELINE[key];
        planet.userData = { ...data, key: key, angle: angle, project, planetName: data.name || key };
        if (project?.order !== undefined) {
            planet.userData.order = project.order;
        }
        scene.add(planet);
        planets.push(planet);
        const listData = { ...data, name: planet.userData.planetName || data.name, planetName: planet.userData.planetName || data.name };
        listData.color = project?.bubbleColor;
        createPlanetListItem(key, listData, planet);

        if (key === 'earth') {
            createClouds(planet, data.radius);
            createDynamicSurfaceOverlay(planet, data.radius, {
                tintA: 0x99d6ff,
                tintB: 0xffffff,
                frequency: 8.0,
                strength: 0.22,
                flowDirection: new THREE.Vector2(0.3, 1.0),
                opacity: 0.18,
                radiusOffset: 0.012,
                speedMultiplier: 0.9,
                blending: THREE.AdditiveBlending
            });
        }

        if (data.hasAtmosphere) {
            createLightAwareAtmosphere(planet, data.radius, data.atmosphereColor);
        }

        if (data.hasRings && key === 'saturn') {
            createSaturnRings(planet, data.radius);
        }

        if (key === 'jupiter') {
            createDynamicSurfaceOverlay(planet, data.radius, {
                tintA: 0xb36b32,
                tintB: 0xf8d6a1,
                frequency: 5.0,
                strength: 0.4,
                flowDirection: new THREE.Vector2(1.0, 0.15),
                opacity: 0.28,
                radiusOffset: 0.008,
                speedMultiplier: 1.4,
                blending: THREE.AdditiveBlending
            });
        } else if (key === 'saturn') {
            createDynamicSurfaceOverlay(planet, data.radius, {
                tintA: 0xcaa871,
                tintB: 0xfbe5b6,
                frequency: 6.0,
                strength: 0.35,
                flowDirection: new THREE.Vector2(1.0, 0.05),
                opacity: 0.24,
                radiusOffset: 0.008,
                speedMultiplier: 1.1,
                blending: THREE.AdditiveBlending
            });
        } else if (key === 'neptune' || key === 'uranus') {
            createDynamicSurfaceOverlay(planet, data.radius, {
                tintA: key === 'neptune' ? 0x1a4bff : 0x4cc9ff,
                tintB: key === 'neptune' ? 0x7fb9ff : 0xa0f4ff,
                frequency: 7.0,
                strength: 0.26,
                flowDirection: new THREE.Vector2(0.2, 1.0),
                opacity: 0.2,
                radiusOffset: 0.01,
                speedMultiplier: 1.2,
                blending: THREE.AdditiveBlending
            });
        } else if (key === 'mars') {
            createDynamicSurfaceOverlay(planet, data.radius, {
                tintA: 0x9b4b2a,
                tintB: 0xffa366,
                frequency: 9.0,
                strength: 0.18,
                flowDirection: new THREE.Vector2(0.6, 0.4),
                opacity: 0.14,
                radiusOffset: 0.006,
                speedMultiplier: 0.7,
                blending: THREE.AdditiveBlending
            });
        }
    });
}

function createLightAwareAtmosphere(planet, radius, color) {
    const geometry = new THREE.SphereGeometry(radius * 1.05, 128, 128);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            glowColor: { value: new THREE.Color(color) },
            sunDirection: { value: new THREE.Vector3(1, 0, 0) },
            time: { value: 0.0 }
        },
        vertexShader: VertexShader,
        fragmentShader: AtmosphereFragmentShader,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
    });

    const atmosphere = new THREE.Mesh(geometry, material);
    scene.add(atmosphere);
    atmosphereMeshes.push({ mesh: atmosphere, parent: planet });
}

function createDynamicSurfaceOverlay(planet, radius, options) {
    const {
        tintA = 0xffffff,
        tintB = 0xffffff,
        frequency = 6.0,
        strength = 0.4,
        flowDirection = new THREE.Vector2(1, 0),
        opacity = 0.35,
        radiusOffset = 0.01,
        speedMultiplier = 1.0,
        blending = THREE.AdditiveBlending
    } = options || {};

    const geometry = new THREE.SphereGeometry(radius * (1 + radiusOffset), 128, 128);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            tintA: { value: new THREE.Color(tintA) },
            tintB: { value: new THREE.Color(tintB) },
            time: { value: 0.0 },
            frequency: { value: frequency },
            strength: { value: strength },
            flowDirection: { value: flowDirection.clone().normalize() },
            opacity: { value: opacity }
        },
        vertexShader: DynamicSurfaceVertexShader,
        fragmentShader: DynamicSurfaceFragmentShader,
        transparent: true,
        depthWrite: false,
        blending
    });

    const overlay = new THREE.Mesh(geometry, material);
    overlay.userData = { parent: planet, speedMultiplier };
    scene.add(overlay);
    dynamicSurfaceOverlays.push(overlay);
}

function createOrbit(distance) {
    const points = [];
    const segments = 256;

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        ));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    curve.closed = true;

    const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.08, 8, true);

    const material = new THREE.MeshBasicMaterial({
        color: 0x6688cc,
        transparent: true,
        opacity: 0.05,
        emissive: 0x4466aa,
        emissiveIntensity: 0.2
    });

    const orbit = new THREE.Mesh(tubeGeometry, material);
    scene.add(orbit);
    orbitLines.push(orbit);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x8899ff,
        transparent: true,
        opacity: 0.3,
        linewidth: 2
    });

    const orbitLine = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(orbitLine);
    orbitLines.push(orbitLine);
}

function createClouds(planet, radius) {
    if (!textures.earth_clouds || !textures.earth_clouds.image) {
        console.warn('Cloud texture unavailable, skipping clouds.');
        return;
    }

    const geometry = new THREE.SphereGeometry(radius * 1.01, 128, 128);
    const material = new THREE.MeshStandardMaterial({
        map: textures.earth_clouds,
        transparent: true,
        opacity: 0.6,
        alphaMap: textures.earth_clouds,
        depthWrite: false,
        side: THREE.FrontSide
    });
    registerTextureScroll(textures.earth_clouds, 0.0025);
    const clouds = new THREE.Mesh(geometry, material);
    clouds.userData.rotationSpeed = 0.3;
    planet.add(clouds);
}

function createSaturnRings(planet, radius) {
    const texture = textures.saturn_ring || createFallbackTexture('saturn_ring');
    const innerRadius = radius * 1.2;
    const outerRadius = radius * 2.5;
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 256, 1);

    const pos = geometry.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v3.fromBufferAttribute(pos, i);
        const uv = (v3.length() - innerRadius) / (outerRadius - innerRadius);
        geometry.attributes.uv.setXY(i, uv, 0);
    }

    const material = new THREE.MeshStandardMaterial({
        map: texture,
        alphaMap: texture,
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.8,
        metalness: 0.1
    });
    registerTextureScroll(texture, 0.0009);

    const rings = new THREE.Mesh(geometry, material);
    rings.rotation.x = Math.PI / 2.1;
    rings.castShadow = true;
    rings.receiveShadow = true;
    planet.add(rings);
}

function createMoon() {
    const earth = planets.find(p => p.userData.key === 'earth');
    if (!earth) return;
    const radius = 0.27;
    const distance = 4;
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshStandardMaterial({
        map: textures.moon || createFallbackTexture('moon'),
        roughness: 0.9,
        metalness: 0.0
    });
    const moon = new THREE.Mesh(geometry, material);
    moon.castShadow = true;
    moon.receiveShadow = true;
    moon.userData = {
        name: 'Moon',
        key: 'moon',
        parent: earth,
        radius: radius,
        distanceToEarth: distance,
        speed: 10,
        rotationSpeed: 0.5,
        angle: 0
    };
    scene.add(moon);
    planets.push(moon);
    createPlanetListItem('moon', moon.userData, moon);
}

// ============================================================================
// ============================================================================

function createComets() {
    console.log('🌟 Creating comet system...');

    const cometConfigs = [
        {
            name: 'Halley Comet',
            distance: 180,
            speed: 0.3,
            inclination: 15,
            eccentricity: 0.7,
            coreColor: 0xccddff,
            tailColor: new THREE.Color(0.7, 0.8, 1.0)
        },
        {
            name: 'Wirtanen Comet',
            distance: 120,
            speed: 0.5,
            inclination: -20,
            eccentricity: 0.65,
            coreColor: 0xaaffaa,
            tailColor: new THREE.Color(0.6, 1.0, 0.7)
        },
        {
            name: 'Swift-Tuttle Comet',
            distance: 240,
            speed: 0.25,
            inclination: 25,
            eccentricity: 0.8,
            coreColor: 0xffffaa,
            tailColor: new THREE.Color(1.0, 0.95, 0.6)
        }
    ];

    cometConfigs.forEach(config => {
        const comet = createComet(config);
        comets.push(comet);
        scene.add(comet);
    });
}

function createComet(config) {
    const cometGroup = new THREE.Group();

    const coreBaseColor = new THREE.Color(config.coreColor);

    const coreGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const coreMaterial = new THREE.MeshStandardMaterial({
        color: coreBaseColor.clone().multiplyScalar(0.45),
        emissive: coreBaseColor,
        emissiveIntensity: 2.5,
        roughness: 0.25,
        metalness: 0.0
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.userData.isCometCore = true;
    cometGroup.add(core);

    const comaGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const comaMaterial = new THREE.MeshBasicMaterial({
        color: config.coreColor,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const coma = new THREE.Mesh(comaGeometry, comaMaterial);
    cometGroup.add(coma);

    const ionTailGeometry = createTailGeometry(20, 0.5);
    const ionTailMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tailColor: { value: config.tailColor },
            opacity: { value: 0.6 }
        },
        vertexShader: CometTailVertexShader,
        fragmentShader: CometTailFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const ionTail = new THREE.Mesh(ionTailGeometry, ionTailMaterial);
    ionTail.position.x = -10;
    cometGroup.add(ionTail);

    const dustTailGeometry = createTailGeometry(15, 0.8);
    const dustTailMaterial = new THREE.ShaderMaterial({
        uniforms: {
            tailColor: { value: new THREE.Color(1.0, 0.9, 0.7) },
            opacity: { value: 0.4 }
        },
        vertexShader: CometTailVertexShader,
        fragmentShader: CometTailFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const dustTail = new THREE.Mesh(dustTailGeometry, dustTailMaterial);
    dustTail.position.x = -7;
    dustTail.position.y = -2;
    dustTail.rotation.z = -0.3;
    cometGroup.add(dustTail);

    const cometLight = new THREE.PointLight(config.coreColor, 100, 20);
    cometGroup.add(cometLight);

    cometGroup.userData = {
        ...config,
        angle: Math.random() * Math.PI * 2,
        isComet: true,
        roll: Math.random() * Math.PI * 2,
        core
    };

    return cometGroup;
}

function createTailGeometry(length, width) {
    const geometry = new THREE.PlaneGeometry(length, width, 32, 8);

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);

        const xFactor = (x + length / 2) / length;

        positions.setY(i, y * (1 - xFactor * 0.7));
    }

    geometry.attributes.position.needsUpdate = true;
    return geometry;
}

// ============================================================================
// ============================================================================

function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.3,
        0.4,
        0.85
    );
    bloomPass.renderToScreen = false;
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 1000;
}

function setupInteractions() {
    document.getElementById('speedControl')?.addEventListener('input', (e) => {
        animationSpeed = parseFloat(e.target.value);
        const speedValue = document.getElementById('speedValue');
        if (speedValue) speedValue.textContent = animationSpeed.toFixed(1) + 'x';
    });

    const pauseBtn = document.getElementById('pauseBtn');
    const togglePause = () => {
        isPaused = !isPaused;
        if (pauseBtn) pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
    };
    pauseBtn?.addEventListener('click', togglePause);
    document.getElementById('resetBtn')?.addEventListener('click', resetView);

    document.getElementById('bloomToggle')?.addEventListener('change', (e) => bloomPass.enabled = e.target.checked);
    document.getElementById('orbitsToggle')?.addEventListener('change', (e) => orbitLines.forEach(o => o.visible = e.target.checked));
    document.getElementById('atmosphereToggle')?.addEventListener('change', (e) => atmosphereMeshes.forEach(a => a.mesh.visible = e.target.checked));

    document.getElementById('infoClose')?.addEventListener('click', () => {
        document.getElementById('infoPanel')?.classList.remove('active');
        focusedObject = null;
        controls.enableZoom = true;
    });

    renderer.domElement.addEventListener('click', onPlanetClick);
    const isTypingTarget = (element) => {
        if (!element) return false;
        const tag = element.tagName;
        const editable = element.isContentEditable;
        if (editable) return true;
        if (!tag) return false;
        return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
    };

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isTypingTarget(document.activeElement)) {
            e.preventDefault();
            togglePause();
        }
    });

    setupControlPanelToggle();
    setupSearchWidget();
}

function setupControlPanelToggle() {
    const panel = document.getElementById('controlPanel');
    const toggle = document.getElementById('controlPanelToggle');
    const controlsHint = document.querySelector('.controls-hint');
    const panelBody = panel.querySelector('.control-panel-body');
    if (!panel || !toggle) return;

    if (panel.classList.contains('collapsed')) {
        controlsHint?.classList.add('is-hidden');
        controlsHint?.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Expand control panel');
        panelBody?.setAttribute('inert', '');
        panelBody?.setAttribute('aria-hidden', 'true');
    } else {
        panelBody?.removeAttribute('inert');
        panelBody?.setAttribute('aria-hidden', 'false');
        controlsHint?.setAttribute('aria-hidden', 'false');
    }

    toggle.addEventListener('click', () => {
        const collapsed = panel.classList.toggle('collapsed');
        toggle.setAttribute('aria-expanded', (!collapsed).toString());
        toggle.setAttribute('aria-label', collapsed ? 'Expand control panel' : 'Collapse control panel');
        controlsHint?.classList.toggle('is-hidden', collapsed);
        controlsHint?.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
        if (collapsed) {
            panelBody?.setAttribute('inert', '');
            panelBody?.setAttribute('aria-hidden', 'true');
        } else {
            panelBody?.removeAttribute('inert');
            panelBody?.setAttribute('aria-hidden', 'false');
        }
    });
}

function setupSearchWidget() {
    const form = document.getElementById('planetSearchForm');
    const input = document.getElementById('planetSearchInput');
    const feedback = document.getElementById('planetSearchFeedback');
    if (!form || !input) return;

    const toggle = form.querySelector('.search-toggle');

    const searchIndex = Object.entries(PROJECT_TIMELINE).map(([key, project]) => ({
        key,
        text: [
            key,
            project.title,
            project.shortTitle,
            project.focus,
            project.term,
            project.team,
            project.summary
        ].filter(Boolean).join(' ').toLowerCase()
    }));

    const updateFeedback = (message) => {
        if (feedback) feedback.textContent = message || '';
    };

    const runSearch = () => {
        const rawTerm = input.value.trim();
        const term = rawTerm.toLowerCase();
        if (!term) {
            updateFeedback('');
            return;
        }
        const match = searchIndex.find(entry => entry.text.includes(term));
        if (match && focusOnPlanetByKey(match.key)) {
            const project = PROJECT_TIMELINE[match.key];
            const label = project.shortTitle || project.title;
            updateFeedback(`Focused on ${label}.`);
        } else {
            updateFeedback(`No project matched "${rawTerm}".`);
        }
    };

    toggle?.addEventListener('click', (event) => {
        event.preventDefault();
        input.focus();
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        runSearch();
    });

    input.addEventListener('input', () => {
        if (!input.value.trim()) {
            updateFeedback('');
        }
    });
}

function resetView() {
    focusedObject = null;
    controls.enableZoom = true;
    controls.target.set(0, 0, 0);
    camera.position.set(0, 80, 250);

    document.getElementById('infoPanel')?.classList.remove('active');
    document.querySelectorAll('.planet-item').forEach(i => i.classList.remove('active'));
}

function onPlanetClick(e) {
    if (controls.state !== -1) return;

    const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...planets, sun], true);

    if (intersects.length > 0) {
        let target = intersects[0].object;
        while (target.parent && target.parent !== scene) {
            if (planets.includes(target.parent) || target.parent === sun) {
                target = target.parent;
                break;
            }
            target = target.parent;
        }
        if (target.userData && target.userData.key) {
            focusOnObject(target);
        }
    }
}

function focusOnObject(obj) {
    focusedObject = obj;
    showObjectInfo(obj);
    controls.enableZoom = false;

    document.querySelectorAll('.planet-item').forEach(i => i.classList.remove('active'));
    const el = document.querySelector('.planet-item-' + obj.userData.key);
    if (el) el.classList.add('active');
}

function focusOnPlanetByKey(key) {
    if (!key) return false;
    if (key === 'sun' && sun) {
        focusOnObject(sun);
        return true;
    }
    const planet = planets.find(p => p.userData?.key === key);
    if (planet) {
        focusOnObject(planet);
        return true;
    }
    return false;
}

function showObjectInfo(obj) {
    const data = obj.userData || {};
    const project = data.project || PROJECT_TIMELINE[data.key];
    const planetNameEl = document.getElementById('planetName');
    const planetStatsEl = document.getElementById('planetStats');
    const planetDescEl = document.getElementById('planetDescription');

    if (project) {
        if (planetNameEl) planetNameEl.textContent = project.title;

        let statsHtml = '';
        if (project.term) statsHtml += `<p><strong>Term:</strong> ${project.term}</p>`;
        if (project.focus) statsHtml += `<p><strong>Focus:</strong> ${project.focus}</p>`;
        if (project.role) statsHtml += `<p><strong>Role:</strong> ${project.role}</p>`;
        if (project.team) statsHtml += `<p><strong>Team:</strong> ${project.team}</p>`;
        if (planetStatsEl) planetStatsEl.innerHTML = statsHtml || '<p><strong>Term:</strong> —</p>';

        if (planetDescEl) {
            let descHtml = '';
            if (project.summary) descHtml += `<p>${project.summary}</p>`;
            if (Array.isArray(project.contributions) && project.contributions.length > 0) {
                descHtml += '<ul>' + project.contributions.map(item => `<li>${item}</li>`).join('') + '</ul>';
            }
            if (project.technologies) {
                descHtml += `<p><strong>Technologies:</strong> ${project.technologies}</p>`;
            }
            if (project.page) {
                const label = project.buttonLabel || 'Open';
                const icon = project.buttonIcon || '🔗';
                descHtml += `<a class="project-link-btn" href="${project.page}"><span class="btn-icon">${icon}</span>${label}</a>`;
            }
            planetDescEl.innerHTML = descHtml || '<p>This project is still being documented.</p>';
        }
    } else {
        if (planetNameEl) planetNameEl.textContent = data.name || 'Unknown';

        let statsHtml = '';
        if (typeof data.radius === 'number') {
            statsHtml += `<p><strong>Radius (relative to Earth):</strong> ${data.radius.toFixed(2)}</p>`;
        }
        if (typeof data.distance === 'number') {
            statsHtml += `<p><strong>Distance (sim units):</strong> ${data.distance.toFixed(2)}</p>`;
        }
        if (planetStatsEl) planetStatsEl.innerHTML = statsHtml;

        if (planetDescEl) {
            planetDescEl.innerHTML = `<p style="text-align: center; color: rgba(255,255,255,0.5); font-style: italic;">"Each planet represents a journey through my academic universe"</p>`;
        }
    }

    document.getElementById('infoPanel')?.classList.add('active');
}

function createPlanetListItem(key, data, obj) {
    const container = document.getElementById('planetItems');
    if (!container) return;

    if (container.querySelector('.planet-entry-' + key)) return;

    if (key === 'moon') return; // Moon does not host a portfolio project

    const project = PROJECT_TIMELINE[key] || obj?.userData?.project;
    if (!project) return;

    const planetName = data.planetName || data.name || obj?.userData?.planetName || obj?.userData?.name || key;
    const projectTitle = project.title || project.shortTitle || planetName;
    const labelText = planetName.toUpperCase();
    const orderValue = project.order ?? 0;

    const entry = document.createElement('div');
    entry.className = 'planet-entry planet-entry-' + key;
    entry.dataset.order = orderValue;
    entry.tabIndex = 0;

    const bubble = document.createElement('div');
    bubble.className = 'planet-item planet-item-' + key;
    bubble.title = projectTitle;
    bubble.dataset.projectTitle = projectTitle;
    bubble.dataset.planet = key;
    bubble.onclick = () => focusOnObject(obj);

    const label = document.createElement('span');
    label.className = 'planet-label';
    label.textContent = labelText;
    if (project?.bubbleColor) label.style.color = project.bubbleColor;

    entry.appendChild(bubble);
    entry.appendChild(label);

    const children = Array.from(container.children);
    const target = children.find(child => Number(child.dataset.order || 0) < orderValue);
    if (target) {
        container.insertBefore(entry, target);
    } else {
        container.appendChild(entry);
    }
}

// ============================================
// ============================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (!isPaused) {
        time += delta * animationSpeed;
        updateScene(delta);
    }

    updateCameraFocus(delta);

    controls.update(delta);
    updateStats();
    composer.render(delta);
}

function updateScene(delta) {
    const speedFactor = delta * animationSpeed * 50;
    const textureScrollDelta = delta * animationSpeed;

    textureScrollEntries.forEach(({ texture, speed }) => {
        const offsetX = texture.offset.x + speed.x * textureScrollDelta;
        const offsetY = texture.offset.y + speed.y * textureScrollDelta;
        texture.offset.x = offsetX - Math.floor(offsetX);
        texture.offset.y = offsetY - Math.floor(offsetY);
    });

    if (starParticles) {
        starParticles.rotation.y += 0.0001 * animationSpeed;
    }

    planets.forEach(p => {
        const data = p.userData;

        if (data.key === 'moon') {
            const earth = data.parent;
            if (!earth) return;
            data.angle += data.speed * 0.001 * speedFactor;
            p.position.x = earth.position.x + Math.cos(data.angle) * data.distanceToEarth;
            p.position.z = earth.position.z + Math.sin(data.angle) * data.distanceToEarth;
            p.rotation.y += data.rotationSpeed * 0.01 * speedFactor;
        } else {
            data.angle += data.speed * 0.0005 * speedFactor;
            p.position.x = Math.cos(data.angle) * data.distance;
            p.position.z = Math.sin(data.angle) * data.distance;
            p.rotation.y += data.rotationSpeed * 0.01 * speedFactor;

            p.children.forEach(c => {
                if (c.userData.rotationSpeed) {
                    c.rotation.y += c.userData.rotationSpeed * 0.01 * speedFactor;
                }
            });
        }
    });

    comets.forEach(comet => {
        const data = comet.userData;

        data.angle += data.speed * 0.0003 * speedFactor;

        const a = data.distance;
        const e = data.eccentricity;
        const theta = data.angle;

        const r = a * (1 - e * e) / (1 + e * Math.cos(theta));

        comet.position.x = r * Math.cos(theta);
        comet.position.z = r * Math.sin(theta);
        comet.position.y = Math.sin(theta) * Math.sin(data.inclination * Math.PI / 180) * data.distance * 0.3;

        TEMP_VEC3.copy(comet.position);
        const distanceSq = TEMP_VEC3.lengthSq();
        if (distanceSq > 1e-6) {
            TEMP_VEC3.normalize();
            TEMP_ORIENTATION_QUATERNION.setFromUnitVectors(COMET_BASE_DIRECTION, TEMP_VEC3);

            const roll = data.roll ?? 0;
            TEMP_ROLL_QUATERNION.setFromAxisAngle(TEMP_VEC3, roll);
            TEMP_ORIENTATION_QUATERNION.multiply(TEMP_ROLL_QUATERNION);
            comet.quaternion.copy(TEMP_ORIENTATION_QUATERNION);
        }

        if (data.core) {
            data.core.rotation.y += 0.01 * speedFactor;
        }
    });

    const sunPosition = SUN_ORIGIN;
    atmosphereMeshes.forEach(atmoData => {
        atmoData.mesh.position.copy(atmoData.parent.position);
        const sunDir = atmoData.mesh.material.uniforms.sunDirection.value;
        sunDir.copy(sunPosition).sub(atmoData.parent.position).normalize();
        atmoData.mesh.material.uniforms.time.value = time * 0.6;
    });

    dynamicSurfaceOverlays.forEach(overlay => {
        const parent = overlay.userData.parent;
        if (!parent) return;
        overlay.position.copy(parent.position);
        overlay.rotation.copy(parent.rotation);
        overlay.material.uniforms.time.value = time * overlay.userData.speedMultiplier;
    });

    meteors.forEach(meteor => {
        if (!meteor.active) {
            meteor.spawnDelay -= delta * animationSpeed;
            if (meteor.spawnDelay <= 0) {
                spawnMeteor(meteor);
            }
            return;
        }

        meteor.life -= delta * animationSpeed;
        if (meteor.life <= 0) {
            resetMeteor(meteor);
            return;
        }

        meteor.position.addScaledVector(meteor.velocity, delta * animationSpeed);
        if (meteor.position.lengthSq() > 16000000) {
            resetMeteor(meteor);
            return;
        }

        meteor.mesh.position.copy(meteor.position);
        const direction = meteor.velocity.clone().normalize();
        meteor.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

        const lifeRatio = meteor.life / meteor.maxLife;
        const length = meteor.tailLengthBase * (1.0 + (1.0 - lifeRatio) * 0.9);
        meteor.mesh.scale.set(meteor.tailWidth, length, 1);

        const opacity = Math.sin((1.0 - lifeRatio) * Math.PI) * meteor.opacity;
        meteor.mesh.material.uniforms.opacity.value = opacity;
    });

    if (sunMaterial) {
        sunMaterial.uniforms.time.value = time;
    }
    if (sunCoronaMaterial) {
        sunCoronaMaterial.uniforms.time.value = time * 0.7;
    }
    if (sun) {
        sun.rotation.y += 0.0005 * animationSpeed;
        sun.children.forEach(child => {
            if (child.type === 'Mesh') {
                child.rotation.y += 0.0002 * animationSpeed;
            }
        });
    }

    const timeDisplay = document.getElementById('timeDisplay');
    if (timeDisplay) timeDisplay.textContent = Math.floor(time * 10) + ' days';
}

function updateCameraFocus(delta) {
    if (focusedObject) {
        const targetPos = focusedObject.position;
        controls.target.lerp(targetPos, delta * 3);

        const distance = focusedObject.userData.radius * 4 + 5;

        const offset = camera.position.clone().sub(controls.target);
        const desiredCameraPos = controls.target.clone().add(offset.setLength(distance));

        camera.position.lerp(desiredCameraPos, delta * 3);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    updateStats();
}

let lastFrameTime = performance.now();
let frameCount = 0;
function updateStats() {
    const now = performance.now();
    frameCount++;
    if (now > lastFrameTime + 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        const fpsDisplay = document.getElementById('fpsDisplay');
        if (fpsDisplay) fpsDisplay.textContent = fps;
        lastFrameTime = now;
        frameCount = 0;
    }

    const pixelRatio = renderer.getPixelRatio();
    const width = Math.round(window.innerWidth * pixelRatio);
    const height = Math.round(window.innerHeight * pixelRatio);
    const resolutionDisplay = document.getElementById('resolutionDisplay');
    if (resolutionDisplay) resolutionDisplay.textContent = `${width}x${height}`;
}

init();

console.log(`
🌟 ================================
   Cinematic solar system ready!
   ================================
   
   ✅ Highlights:
   1. Brighter solar shading
   2. Orbit lines dimmed (opacity 0.15)
   3. Starfield density doubled (100,000 particles)
   4. Three dynamic comet systems
   5. 🌠 Meteor upgrades:
      - Count: 70 → 150
      - Brightness: +33%
      - Size: +50%
      - Speed: -20% (easier to observe)
      - Spawn rate: +60%
   
   🎮 Controls:
   - Left mouse to orbit
   - Right mouse to pan
   - Scroll to zoom
   - Click a planet for project info  
   - Space toggles pause
   
   ================================
`);
