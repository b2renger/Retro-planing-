import { User, Workspace, Project, Notification, HardwareItem, MediaAssetItem } from '../types';
import { initialsAvatar } from '../state/avatar';

export const MOCK_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Berenger Recoules',
    email: 'lead@example.com',
    avatar: initialsAvatar('Berenger Recoules', '#3B82F6'),
    role: 'Creative Director & Spatial Designer',
    color: '#3B82F6',
    status: 'active',
  },
  {
    id: 'user-2',
    name: 'Elena Rostova',
    email: 'elena.rostova@media-art.io',
    avatar: initialsAvatar('Elena Rostova', '#8B5CF6'),
    role: 'Lead Visual Artist & Motion Director',
    color: '#8B5CF6',
    status: 'active',
  },
  {
    id: 'user-3',
    name: 'Marcus Vance',
    email: 'marcus.vance@sound-lab.io',
    avatar: initialsAvatar('Marcus Vance', '#EC4899'),
    role: 'Spatial Audio Designer & Sound Engineer',
    color: '#EC4899',
    status: 'reviewing',
  },
  {
    id: 'user-4',
    name: 'Sora Chen',
    email: 'sora.chen@av-systems.io',
    avatar: initialsAvatar('Sora Chen', '#10B981'),
    role: 'AV Systems & TouchDesigner Specialist',
    color: '#10B981',
    status: 'crunching',
  },
];

// HARDWARE INVENTORY MANIFEST
export const MEDIA_INSTALLATION_HARDWARE: HardwareItem[] = [
  {
    id: 'hw-1',
    name: 'Panasonic PT-RQ25K 4K Laser Projector',
    category: 'Projection',
    quantity: 2,
    specs: '20,000 Lumens, 3-Chip DLP, Native 4K (3840x2160), 24,000:1 Dynamic Contrast, Dual SDI/HDMI 2.0 inputs',
    status: 'booked',
    vendor: 'ProAV Solutions Europe',
    notes: 'Booked for Oct 29 - Nov 22. Includes rigging cage & flying hardware.',
  },
  {
    id: 'hw-2',
    name: 'Panasonic ET-EMW300 Ultra-Short Throw Zoom Lens',
    category: 'Projection',
    quantity: 2,
    specs: 'Throw ratio: 0.370 - 0.414:1, Motorized focus & optical lens shift, zero geometric chromatic aberration',
    status: 'booked',
    vendor: 'ProAV Solutions Europe',
    notes: 'Allows 18m wide projection mapping from only 6.8m throw distance.',
  },
  {
    id: 'hw-3',
    name: 'Genelec 8040B Active Studio Monitors (8-Channel Ring)',
    category: 'Audio',
    quantity: 8,
    specs: 'Bi-amplified 90W + 90W, 41Hz - 25kHz, Directivity Control Waveguide, Iso-Pod isolation stands',
    status: 'booked',
    vendor: 'Acoustic Sound Labs Paris',
    notes: 'Configured in octagonal perimeter ring for 360° spatial immersion.',
  },
  {
    id: 'hw-4',
    name: 'Genelec 7380A SAM Studio Subwoofers',
    category: 'Audio',
    quantity: 2,
    specs: '800W Class D, 16Hz - 120Hz, 123 dB SPL, Laminar Spiral Enclosure, GLM calibration network',
    status: 'booked',
    vendor: 'Acoustic Sound Labs Paris',
    notes: 'Placed in corner boundary positions for sub-bass visceral resonance.',
  },
  {
    id: 'hw-5',
    name: 'Focusrite RedNet PCIeR Dante Audio Interface + 8-ch DAC',
    category: 'Audio',
    quantity: 1,
    specs: 'Dante AoIP Gigabit network, 24-bit/192kHz, <1.6ms roundtrip latency, redundant etherCON ports',
    status: 'booked',
    vendor: 'Acoustic Sound Labs Paris',
    notes: 'Direct CAT6 network connection to TouchDesigner media server.',
  },
  {
    id: 'hw-6',
    name: 'Custom RTX 4090 Media Server Playback Rack',
    category: 'Media Server & Network',
    quantity: 1,
    specs: 'Intel Core i9-14900K, 64GB DDR5, NVIDIA RTX 4090 24GB, 4TB NVMe SSD, TouchDesigner Pro license',
    status: 'delivered',
    vendor: 'Studio Internal AV Rack',
    notes: 'Dual 4K 60Hz outputs configured with hardware frame lock and GPU EDID emulation.',
  },
  {
    id: 'hw-7',
    name: 'Slamtec RPLIDAR S2 Laser Range Scanner (Audience Tracking)',
    category: 'Media Server & Network',
    quantity: 1,
    specs: '30-meter radius, 32kHz sample rate, IP65 rated, Ethernet interface for real-time OSC tracking',
    status: 'delivered',
    vendor: 'Robotics Sensors Direct',
    notes: 'Ceiling mounted over the entrance to track attendee spatial density and trigger real-time sound cues.',
  },
  {
    id: 'hw-8',
    name: 'Global Truss F34 Rigging Box Grid (18m x 12m)',
    category: 'Rigging & Power',
    quantity: 1,
    specs: '290mm square truss, 50mm tube, EN 1090 certified, rated for 850kg distributed AV load',
    status: 'booked',
    vendor: 'Rigging Masters Event Corp',
    notes: 'Includes certified safety cables, half-couplers, and 4x D8+ electric chain hoists.',
  },
  {
    id: 'hw-9',
    name: 'Neutrik OpticalCON DUO 4K SDI Fiber Reels (100m)',
    category: 'Rigging & Power',
    quantity: 4,
    specs: 'Ruggedized tactical fiber cable, 12G-SDI zero-loss video transmission over 100 meters',
    status: 'delivered',
    vendor: 'Studio Cable Inventory',
    notes: 'Runs along perimeter cable trays from server rack to projector truss.',
  },
  {
    id: 'hw-10',
    name: '32A 3-Phase Power Distribution Unit & DMX Relays',
    category: 'Rigging & Power',
    quantity: 1,
    specs: 'CEE 32A 400V input, 6x 16A Schuko RCBO protected circuits, automated DMX sequential power on/off',
    status: 'booked',
    vendor: 'Rigging Masters Event Corp',
    notes: 'Protects laser projector bulbs and active speakers against power spikes.',
  },
];

// MEDIA PRODUCTION ROSTER (Videos & Sound)
export const MEDIA_INSTALLATION_ASSETS: MediaAssetItem[] = [
  {
    id: 'media-v1',
    title: 'Visual Sequence 01: "Atmospheric Horizon & Particle Fluid"',
    type: 'video',
    format: '3840x2160 (4K UHD) @ 60fps ProRes 422HQ',
    duration: '03:30 (Seamless Loop)',
    status: 'approved',
    description: 'Generative fluid dynamics and cosmic particle mesh rendered in Houdini & Unreal Engine 5.4. Master projection base layer.',
  },
  {
    id: 'media-v2',
    title: 'Visual Sequence 02: "Architectural Geometry & Corner Warp"',
    type: 'video',
    format: '3840x2160 (4K UHD) @ 60fps ProRes 422HQ',
    duration: '02:15 (Seamless Loop)',
    status: 'in-production',
    description: 'High-contrast monochrome geometric lines designed to align with room architectural beams and corner pillars.',
  },
  {
    id: 'media-v3',
    title: 'Visual Sequence 03: "Real-time Generative GLSL Particle Field"',
    type: 'video',
    format: 'Real-time TouchDesigner GLSL Engine (60fps lock)',
    duration: 'Infinite Dynamic Loop',
    status: 'approved',
    description: 'Interactive shader responding to LiDAR audience density, causing particles to disperse and reform as visitors move.',
  },
  {
    id: 'media-s1',
    title: 'Sound Design 01: "Spatial 8.1 Ambient Drone & Resonances"',
    type: 'sound',
    format: '8-Channel Discrete (24-bit / 48kHz Uncompressed WAV)',
    duration: '05:45 (Seamless Loop)',
    status: 'approved',
    description: 'Evolving modular synthesizer soundscape panned circularly through the 8 perimeter speakers with binaural depth.',
  },
  {
    id: 'media-s2',
    title: 'Sound Design 02: "Sub-Harmonic Physical Impact Stems"',
    type: 'sound',
    format: 'Stereo LFE (28Hz - 60Hz Sub-bass Stems, 24-bit / 48kHz)',
    duration: '03:30 (Synchronized to Visual Loop 01)',
    status: 'in-production',
    description: 'Visceral low-frequency pulses routed exclusively to the 2x Genelec 7380A subwoofers for physical bodily sensation.',
  },
  {
    id: 'media-s3',
    title: 'Sound Design 03: "Interactive Granular Audio Cues (16 Stems)"',
    type: 'sound',
    format: '16x Mono WAV Stems (24-bit / 48kHz)',
    duration: '00:04 each (Triggered via OSC)',
    status: 'rendered',
    description: 'Crystalline acoustic chimes and organic wood knocks triggered in real-time when visitors enter specific room zones.',
  },
];

// PRIMARY MEDIA INSTALLATION PROJECT
export const MEDIA_INSTALLATION_PROJECT: Project = {
  id: 'proj-media-installation',
  workspaceId: 'ws-1',
  title: 'Immersive Media Installation: Echoes & Light (Projection & 8.1 Sound)',
  clientName: 'Grand Palais Éphémère / Contemporary Art Center',
  description: 'Immersive audiovisual exhibition featuring dual 20,000-lumen laser projection mapping, 8.1 discrete spatial audio composition, on-site Dante network tuning, and audience-reactive LiDAR tracking.',
  status: 'on-track',
  retroplanningScore: 94,
  targetDeliveryDate: '2026-11-20', // Opening Night
  startDate: '2026-09-15',
  isTutorialTemplate: true,
  tags: ['Projection Mapping', 'Spatial Audio', 'TouchDesigner', 'Media Installation', 'Opening Night'],
  hardwareItems: MEDIA_INSTALLATION_HARDWARE,
  mediaAssets: MEDIA_INSTALLATION_ASSETS,
  phases: [
    {
      id: 'p1-booking',
      name: '1. Booking & Procurement (Venue, Hardware & Rigging)',
      color: '#3B82F6',
      startDate: '2026-09-15',
      endDate: '2026-10-05',
      order: 1,
      bufferDays: 4,
      isCriticalPath: true,
    },
    {
      id: 'p2-media',
      name: '2. Media Creation (4K Videos & 8.1 Spatial Sound)',
      color: '#8B5CF6',
      startDate: '2026-10-06',
      endDate: '2026-10-28',
      order: 2,
      bufferDays: 5,
      isCriticalPath: true,
    },
    {
      id: 'p3-testing',
      name: '3. Setup & On-Site Testing (Checklist of To-Dos)',
      color: '#EC4899',
      startDate: '2026-10-29',
      endDate: '2026-11-12',
      order: 3,
      bufferDays: 4,
      isCriticalPath: true,
    },
    {
      id: 'p4-review',
      name: '4. Rehearsal & Stakeholder Review (Opening Night Freeze)',
      color: '#10B981',
      startDate: '2026-11-13',
      endDate: '2026-11-20',
      order: 4,
      bufferDays: 6,
      isCriticalPath: true,
    },
  ],
  milestones: [
    {
      id: 'm1-booking-done',
      title: 'Venue & Hardware Bookings Confirmed',
      targetDate: '2026-10-05',
      isHardDeadline: true,
      completed: true,
      description: 'Venue lease signed, 2x 20K laser projectors reserved, Genelec 8.1 speaker package locked with rental supplier.',
      deliverableCount: 4,
    },
    {
      id: 'm2-media-lock',
      title: 'Media Creation & Stems Master Lock',
      targetDate: '2026-10-28',
      isHardDeadline: true,
      completed: false,
      description: 'All 4K video loops rendered in ProRes 422HQ and 8.1 channel sound stems mixed and normalized at -24 LUFS.',
      deliverableCount: 6,
    },
    {
      id: 'm3-testing-signoff',
      title: 'On-Site Calibration & 4h Stress Test Passed',
      targetDate: '2026-11-12',
      isHardDeadline: true,
      completed: false,
      description: 'Dual projector edge-blending calibrated, Dante audio speaker delays aligned, and 4-hour zero-drop stress test validated.',
      deliverableCount: 5,
    },
    {
      id: 'm4-opening-night',
      title: 'Exhibition Opening Night & VIP Vernissage',
      targetDate: '2026-11-20',
      isHardDeadline: true,
      completed: false,
      description: 'Public opening of Echoes & Light media installation with full automated daily operation timers active.',
      deliverableCount: 8,
    },
  ],
  tasks: [
    // Phase 1: Booking
    {
      id: 'task-b1',
      projectId: 'proj-media-installation',
      phaseId: 'p1-booking',
      title: 'Venue Booking & Electrical Power Survey (32A 3-Phase)',
      description: 'Sign contract for Main Gallery (18m x 12m x 6m ceiling). Verify 32A 3-phase power drops, blackout curtains, and floor weight limits.',
      status: 'done',
      priority: 'urgent',
      assigneeId: 'user-1',
      startDate: '2026-09-15',
      dueDate: '2026-09-24',
      estimatedHours: 16,
      actualHours: 14,
      dependencies: [],
      deliverables: ['Signed Venue Contract.pdf', 'Electrical Power Layout Diagram.dwg'],
      checklist: [
        { id: 'cb1', text: 'Confirm 18m x 12m clear projection wall surface', completed: true },
        { id: 'cb2', text: 'Measure ambient lux (<5 lux required for deep black levels)', completed: true },
        { id: 'cb3', text: 'Verify 32A 400V 3-phase power drop in server control room', completed: true },
        { id: 'cb4', text: 'Confirm ceiling load capacity for 850kg truss grid', completed: true },
      ],
      tags: ['Venue', 'Booking', 'Power'],
      isCriticalPath: true,
    },
    {
      id: 'task-b2',
      projectId: 'proj-media-installation',
      phaseId: 'p1-booking',
      title: 'Projectors & Optical Lenses Rental Reservation',
      description: 'Reserve 2x Panasonic PT-RQ25K 20,000-lumen 4K Laser Projectors with ET-EMW300 ultra-short-throw lenses (0.37:1 ratio).',
      status: 'done',
      priority: 'urgent',
      assigneeId: 'user-4',
      startDate: '2026-09-20',
      dueDate: '2026-09-30',
      estimatedHours: 12,
      actualHours: 10,
      dependencies: ['task-b1'],
      deliverables: ['Projector Rental Confirmation Invoice.pdf', 'Lens Throw Calculation Sheet.xlsx'],
      checklist: [
        { id: 'cb5', text: 'Confirm 2x 20K lumen 4K laser projector serial reservations', completed: true },
        { id: 'cb6', text: 'Reserve 2x 0.37:1 UST lenses with optical vertical/horizontal shift', completed: true },
        { id: 'cb7', text: 'Include flying rigging cages and secondary safety steel wires', completed: true },
      ],
      tags: ['Projection', 'Hardware', 'Rental'],
      isCriticalPath: true,
    },
    {
      id: 'task-b3',
      projectId: 'proj-media-installation',
      phaseId: 'p1-booking',
      title: 'Spatial Audio System & Dante Rack Hardware Booking',
      description: 'Book 8x Genelec 8040B active studio monitors, 2x Genelec 7380A subwoofers, and Focusrite RedNet PCIe Dante audio interface.',
      status: 'done',
      priority: 'high',
      assigneeId: 'user-3',
      startDate: '2026-09-22',
      dueDate: '2026-10-04',
      estimatedHours: 14,
      actualHours: 12,
      dependencies: ['task-b1'],
      deliverables: ['Sound Gear Delivery Schedule.pdf', 'Dante Audio Routing Map.png'],
      checklist: [
        { id: 'cb8', text: 'Reserve 8x Genelec 8040B active monitors for perimeter ring', completed: true },
        { id: 'cb9', text: 'Reserve 2x Genelec 7380A studio subwoofers with GLM calibration', completed: true },
        { id: 'cb10', text: 'Confirm Focusrite RedNet Dante audio interface and Cat6 etherCON reels', completed: true },
      ],
      tags: ['Audio', 'Dante', 'Hardware'],
      isCriticalPath: false,
    },

    // Phase 2: Media Creation
    {
      id: 'task-m1',
      projectId: 'proj-media-installation',
      phaseId: 'p2-media',
      title: '4K Projection Video Loop: "Atmospheric Continuum"',
      description: 'Render master 3840x2160 @ 60fps ProRes 422HQ video loop featuring cosmic generative fluid dynamics and organic particle ribbons.',
      status: 'done',
      priority: 'urgent',
      assigneeId: 'user-2',
      startDate: '2026-10-06',
      dueDate: '2026-10-18',
      estimatedHours: 32,
      actualHours: 30,
      dependencies: ['task-b2'],
      deliverables: ['Atmospheric_Continuum_4K_60fps.mov', 'Houdini Project Files & Geometry Caches.zip'],
      checklist: [
        { id: 'cm1', text: 'Render 3:30 seamless loop with zero seam jump cuts', completed: true },
        { id: 'cm2', text: 'Color grade in Rec.709 with high dynamic contrast for 20K laser', completed: true },
        { id: 'cm3', text: 'Validate 60fps frame rate lock without stutter or dropped frames', completed: true },
      ],
      tags: ['Video', '4K', 'Render'],
      isCriticalPath: true,
    },
    {
      id: 'task-m2',
      projectId: 'proj-media-installation',
      phaseId: 'p2-media',
      title: '4K Architectural Geometry Warp & Pillar Highlights',
      description: 'Create high-contrast structural projection content aligned to room beams and corner pillars to augment physical architecture.',
      status: 'in-progress',
      priority: 'high',
      assigneeId: 'user-2',
      startDate: '2026-10-12',
      dueDate: '2026-10-24',
      estimatedHours: 24,
      dependencies: ['task-m1'],
      deliverables: ['Architectural_Geometry_Warp_v3.mov', 'Corner_Mapping_Alpha_Masks.png'],
      checklist: [
        { id: 'cm4', text: 'Design 2:15 architectural line choreography', completed: true },
        { id: 'cm5', text: 'Export alpha-channel masks for room architectural corners', completed: true },
        { id: 'cm6', text: 'Render final ProRes 422HQ master', completed: false },
      ],
      tags: ['Video', 'Projection Mapping'],
      isCriticalPath: false,
    },
    {
      id: 'task-m3',
      projectId: 'proj-media-installation',
      phaseId: 'p2-media',
      title: '8.1 Discrete Spatial Audio Composition & Sub-Bass Stems',
      description: 'Compose multi-channel spatial music soundscape. 8 discrete channel feeds + dedicated 28Hz-60Hz LFE sub-bass tactile impacts.',
      status: 'in-progress',
      priority: 'urgent',
      assigneeId: 'user-3',
      startDate: '2026-10-10',
      dueDate: '2026-10-26',
      estimatedHours: 36,
      dependencies: ['task-b3'],
      deliverables: ['8ch_Spatial_Soundscape_Master.wav', 'Sub_Bass_LFE_Pulse_Stems.wav'],
      checklist: [
        { id: 'cm7', text: 'Produce 8-channel perimeter surround panning choreography', completed: true },
        { id: 'cm8', text: 'Design sub-harmonic 28Hz tactile pulses for bodily resonance', completed: true },
        { id: 'cm9', text: 'Normalize total integrated loudness to -24 LUFS for gallery comfort', completed: false },
      ],
      tags: ['Audio', 'Spatial', '8.1'],
      isCriticalPath: true,
    },
    {
      id: 'task-m4',
      projectId: 'proj-media-installation',
      phaseId: 'p2-media',
      title: 'TouchDesigner Interactive Shader & LiDAR Sensor Integration',
      description: 'Program real-time GLSL particle shader that responds to audience proximity data streamed via OSC from the Slamtec LiDAR sensor.',
      status: 'in-review',
      priority: 'high',
      assigneeId: 'user-4',
      startDate: '2026-10-15',
      dueDate: '2026-10-28',
      estimatedHours: 28,
      dependencies: ['task-m1', 'task-m3'],
      deliverables: ['Echoes_Interactive_Main.toe', 'LiDAR_OSC_Parser_Network.tox'],
      checklist: [
        { id: 'cm10', text: 'Build real-time particle simulation in TouchDesigner GLSL', completed: true },
        { id: 'cm11', text: 'Implement OSC input parser for 32kHz LiDAR point-cloud coordinates', completed: true },
        { id: 'cm12', text: 'Add automatic idle fallback mode when room is empty', completed: true },
      ],
      tags: ['TouchDesigner', 'GLSL', 'LiDAR'],
      isCriticalPath: false,
    },

    // Phase 3: Setup & Testing (To-Dos)
    {
      id: 'task-t1',
      projectId: 'proj-media-installation',
      phaseId: 'p3-testing',
      title: 'Projector Rigging, Edge-Blending & Geometric Warping Calibration',
      description: 'Mount dual 20K laser projectors to truss. Calibrate 15% overlap edge-blending curve, black-level compensation, and geometric warping.',
      status: 'todo',
      priority: 'urgent',
      assigneeId: 'user-4',
      startDate: '2026-10-29',
      dueDate: '2026-11-04',
      estimatedHours: 24,
      dependencies: ['task-m1', 'task-m2'],
      deliverables: ['TouchDesigner Warp Grid Preset.xml', 'Edge Blend Gamma Calibration Profile.json'],
      checklist: [
        { id: 'ct1', text: 'Mount projectors on F34 truss grid at 4.5m elevation with secondary steel cables', completed: false },
        { id: 'ct2', text: 'Project test grid pattern and align 15% central blend overlap zone', completed: false },
        { id: 'ct3', text: 'Apply bezier warp grid to correct wall surface irregularities', completed: false },
        { id: 'ct4', text: 'Calibrate gamma curve and black-level matching between projector A and B', completed: false },
      ],
      tags: ['Testing', 'Edge-Blending', 'Projectors'],
      isCriticalPath: true,
    },
    {
      id: 'task-t2',
      projectId: 'proj-media-installation',
      phaseId: 'p3-testing',
      title: 'Acoustic Alignment, Dante Network Delay & Subwoofer Tuning',
      description: 'Configure Gigabit Dante AoIP network. Measure room impulse responses and set precise millisecond speaker delay compensation.',
      status: 'todo',
      priority: 'high',
      assigneeId: 'user-3',
      startDate: '2026-11-02',
      dueDate: '2026-11-08',
      estimatedHours: 20,
      dependencies: ['task-m3', 'task-t1'],
      deliverables: ['Dante Controller Routing Preset.xml', 'Room Acoustic Impulse Response Report.pdf'],
      checklist: [
        { id: 'ct5', text: 'Assign static IP addresses to RedNet interface and 8-channel DAC rack', completed: false },
        { id: 'ct6', text: 'Run Genelec GLM acoustic room calibration measurement sweeps', completed: false },
        { id: 'ct7', text: 'Align speaker time delays relative to central audience sweet spot (ms precision)', completed: false },
        { id: 'ct8', text: 'Set 80Hz Linkwitz-Riley 24dB/octave crossover for 7380A subwoofers', completed: false },
      ],
      tags: ['Testing', 'Audio', 'Dante'],
      isCriticalPath: false,
    },
    {
      id: 'task-t3',
      projectId: 'proj-media-installation',
      phaseId: 'p3-testing',
      title: '4-Hour Continuous Playback Stress Test & Thermal Stability Run',
      description: 'Run full installation in continuous loop for 4 hours. Monitor GPU/CPU thermals, RAM leaks, frame pacing, and automated recovery.',
      status: 'todo',
      priority: 'urgent',
      assigneeId: 'user-4',
      startDate: '2026-11-08',
      dueDate: '2026-11-12',
      estimatedHours: 16,
      dependencies: ['task-t1', 'task-t2'],
      deliverables: ['4-Hour Stress Test Telemetry Log.csv', 'Thermal Stability Certification.pdf'],
      checklist: [
        { id: 'ct9', text: 'Execute continuous 4-hour looped video and 8.1 sound playback', completed: false },
        { id: 'ct10', text: 'Verify RTX 4090 GPU thermals remain below 72°C under full load', completed: false },
        { id: 'ct11', text: 'Confirm zero frame drops over 864,000 continuous rendered frames (60.0 fps)', completed: false },
        { id: 'ct12', text: 'Test simulated power cut recovery and auto-reboot TouchDesigner start script', completed: false },
      ],
      tags: ['Testing', 'Stress Test', 'QA'],
      isCriticalPath: true,
    },

    // Phase 4: Review
    {
      id: 'task-r1',
      projectId: 'proj-media-installation',
      phaseId: 'p4-review',
      title: 'Artist Creative Walkthrough & Visual/Audio Balance Tuning',
      description: 'Full walkthrough with exhibition curators and artists. Adjust projection brightness balance, sound volume envelope, and spatial panning.',
      status: 'todo',
      priority: 'urgent',
      assigneeId: 'user-1',
      startDate: '2026-11-13',
      dueDate: '2026-11-16',
      estimatedHours: 18,
      dependencies: ['task-t3'],
      deliverables: ['Artist Signoff Protocol.pdf', 'Final AV Preset Backup.json'],
      checklist: [
        { id: 'cr1', text: 'Conduct full 30-minute immersive walkthrough with lead artist & curators', completed: false },
        { id: 'cr2', text: 'Fine-tune ambient light levels and entrance tunnel darkness transition', completed: false },
        { id: 'cr3', text: 'Adjust master sound pressure level to adhere to 82 dBA gallery comfort standard', completed: false },
      ],
      tags: ['Review', 'Artist', 'Curators'],
      isCriticalPath: true,
    },
    {
      id: 'task-r2',
      projectId: 'proj-media-installation',
      phaseId: 'p4-review',
      title: 'Final Safety Inspection, Venue Sign-Off & Opening Vernissage',
      description: 'Safety check on cable trays, emergency illuminated exit signage, electrical breaker certification, and automated daily power scheduler.',
      status: 'todo',
      priority: 'urgent',
      assigneeId: 'user-1',
      startDate: '2026-11-17',
      dueDate: '2026-11-20',
      estimatedHours: 12,
      dependencies: ['task-r1'],
      deliverables: ['Safety & Fire Compliance Certificate.pdf', 'Daily Start_Stop Schedule Config.json'],
      checklist: [
        { id: 'cr4', text: 'Inspect all rigging truss safety secondary steel links and clamps', completed: false },
        { id: 'cr5', text: 'Ensure illuminated emergency exit path does not wash out projection wall', completed: false },
        { id: 'cr6', text: 'Program automated daily start (09:30 AM) and shutdown (10:30 PM) DMX relays', completed: false },
        { id: 'cr7', text: 'Open doors for VIP Vernissage and public exhibition premiere', completed: false },
      ],
      tags: ['Review', 'Safety', 'Opening Night'],
      isCriticalPath: true,
    },
  ],
  documents: [
    {
      id: 'doc-brief',
      title: '01_Media_Installation_Brief.md',
      path: 'briefs/01_Media_Installation_Brief.md',
      tags: ['Brief', 'Artistic Specs', 'Projection', 'Audio'],
      lastModified: '2026-09-20T08:30:00Z',
      lastModifiedBy: 'Berenger Recoules',
      content: `# Immersive Media Installation: "Echoes & Light"
**Location:** Grand Palais Éphémère / Contemporary Art Center  
**Target Opening Night:** November 20, 2026  
**Curator / Creative Lead:** Berenger Recoules  
**Technical Lead:** Sora Chen  

---

## 1. Artistic Concept & Vision
"Echoes & Light" is a 360-degree sensory immersion exploring the collision of cosmic architecture, fluid geometry, and physical acoustic resonance. Visitors step into a pitch-black gallery room where visual particle ribbons morph across dual edge-blended 4K projection surfaces while an 8.1 discrete spatial audio ring pans organic drones and visceral sub-bass pulses around the space.

---

## 2. Venue & Spatial Parameters
- **Gallery Dimensions:** 18.0m (Length) x 12.0m (Width) x 6.0m (Clear Ceiling Height)
- **Projection Surface:** Matte white projection canvas (18m wide x 5.2m high)
- **Ambient Lighting:** Complete blackout (<3 lux), indirect low-glare floor strip lighting along walkways
- **Power Provisioning:** Dedicated 32A 400V 3-phase supply (CEE 32A socket in server control booth)
- **Audience Capacity:** 45 simultaneous visitors in flow rotation

---

## 3. Technical Architecture Overview
1. **Visual Engine:** Dual Panasonic PT-RQ25K (20,000 lm each) with 0.37:1 UST lenses edge-blended into a single seamless 7680x2160 ultra-wide projection canvas.
2. **Audio Engine:** 8x Genelec 8040B active studio monitors placed in an equidistant circular ring, coupled with 2x Genelec 7380A subwoofers tuned for 28Hz-60Hz tactile sub-bass resonance.
3. **Control & Playback:** Custom RTX 4090 media server running TouchDesigner Pro with Dante AoIP PCIe interface.
4. **Interactivity:** Slamtec LiDAR scanner ceiling-mounted over the threshold to track real-time spatial density and modulate GLSL particle dispersion.
`,
    },
    {
      id: 'doc-hardware',
      title: '02_Hardware_Equipment_Manifest.md',
      path: 'hardware/02_Hardware_Equipment_Manifest.md',
      tags: ['Hardware', 'Manifest', 'Rental', 'Logistics'],
      lastModified: '2026-09-20T09:15:00Z',
      lastModifiedBy: 'Sora Chen',
      content: `# Hardware Equipment Manifest & Rental Logistics
**Project:** Echoes & Light (Media Installation)  
**Installation Load-In:** October 29, 2026  
**Exhibition Run:** November 20, 2026 – January 15, 2027  

---

## Projection & Optics (Rental: ProAV Solutions)
| Item | Model | Qty | Key Specs | Status |
|---|---|---|---|---|
| Projector A | Panasonic PT-RQ25K | 1 | 20,000 Lumens, 4K DLP, Dual SDI/HDMI | Booked |
| Projector B | Panasonic PT-RQ25K | 1 | 20,000 Lumens, 4K DLP, Dual SDI/HDMI | Booked |
| UST Lens A | Panasonic ET-EMW300 | 1 | 0.37 - 0.41:1 UST Zoom, Motorized Shift | Booked |
| UST Lens B | Panasonic ET-EMW300 | 1 | 0.37 - 0.41:1 UST Zoom, Motorized Shift | Booked |
| Rigging Cage | FlyFrame RQ25K | 2 | TÜV Certified flying cage with micro-adjusters | Booked |

---

## Spatial Audio & Dante Network (Rental: Acoustic Labs Paris)
| Item | Model | Qty | Key Specs | Status |
|---|---|---|---|---|
| Surround Ring | Genelec 8040B | 8 | 90W+90W Active Bi-Amp, DCW Waveguide | Booked |
| Subwoofers | Genelec 7380A | 2 | 800W Class D, 16Hz - 120Hz, SAM GLM | Booked |
| Audio Interface | Focusrite RedNet PCIeR | 1 | Dante Gigabit AoIP, <1.6ms Latency | Booked |
| D/A Converter | RedNet A16R MkII | 1 | 16-channel 24-bit 192kHz DAC | Booked |

---

## Server Rack & Rigging (Studio Inventory & Rigging Masters)
- **Media Server:** Intel i9-14900K / 64GB DDR5 / NVIDIA RTX 4090 24GB (Status: Delivered & Prepped)
- **Interactive Sensor:** Slamtec RPLIDAR S2 (30m radius, 32kHz sample rate) (Status: Delivered)
- **Truss Grid:** Global Truss F34 (18m x 12m perimeter box grid, 850kg safe load) (Status: Booked)
- **Fiber Video Cables:** 4x 100m Neutrik OpticalCON DUO 12G-SDI Reels (Status: Delivered)
- **Power Distro:** 32A 3-Phase PDU with automated DMX sequential power switch (Status: Booked)
`,
    },
    {
      id: 'doc-media',
      title: '03_Media_Production_Roster.md',
      path: 'media/03_Media_Production_Roster.md',
      tags: ['Media Assets', 'Video', 'Sound', 'Roster'],
      lastModified: '2026-09-20T09:20:00Z',
      lastModifiedBy: 'Elena Rostova',
      content: `# Media Production Roster (Videos & Audio Stems)
**Resolution Standards:** 3840x2160 (4K UHD) @ 60.00 fps  
**Audio Standards:** 24-bit / 48.00 kHz Linear PCM WAV  

---

## Video Assets
1. **Atmospheric Continuum (Master Base Layer)**
   - *Resolution:* 3840x2160 @ 60fps
   - *Codec:* Apple ProRes 422HQ (Bitrate: ~440 Mbps)
   - *Duration:* 03:30 (Seamless loop, color matched to 20K laser contrast)
   - *Status:* Master Approved

2. **Architectural Geometry Warp & Corner Highlights**
   - *Resolution:* 3840x2160 @ 60fps
   - *Codec:* Apple ProRes 422HQ
   - *Duration:* 02:15 (Seamless loop)
   - *Status:* In Production (Alpha masking in progress)

3. **TouchDesigner Real-Time GLSL Particle Field**
   - *Type:* Real-time compute shader
   - *Performance:* Locked 60.0 fps at 7680x2160 combined output
   - *Interactivity:* LiDAR audience proximity trigger
   - *Status:* Approved

---

## Audio Assets
1. **Spatial 8.1 Ambient Drone & Resonant Harmonics**
   - *Layout:* 8 Discrete Channels (Ch 1: Front L, Ch 2: Front R, Ch 3: Side L, Ch 4: Side R, Ch 5: Rear L, Ch 6: Rear R, Ch 7: Center Front, Ch 8: Center Rear)
   - *Duration:* 05:45 (Loop)
   - *Integrated Loudness:* -24.0 LUFS (True Peak: -1.5 dBTP)
   - *Status:* Master Approved

2. **Sub-Bass 28Hz-60Hz Tactile Resonance Stems**
   - *Layout:* Dual Mono Subwoofer Feed (Ch 9 & 10)
   - *Status:* In Production

3. **Interactive Granular Audio Trigger Library (16 Stems)**
   - *Layout:* 16 Mono WAV files triggered by OSC coordinates
   - *Status:* Rendered & Staged
`,
    },
    {
      id: 'doc-testing',
      title: '04_OnSite_Testing_and_QA_Checklist.md',
      path: 'testing/04_OnSite_Testing_and_QA_Checklist.md',
      tags: ['Testing', 'Checklist', 'Edge-Blending', 'Dante', 'QA'],
      lastModified: '2026-09-20T09:25:00Z',
      lastModifiedBy: 'Marcus Vance',
      content: `# On-Site Testing Phase: Comprehensive To-Do Checklist
**Testing Window:** October 29 – November 12, 2026  
**Signoff Engineers:** Sora Chen (Video/Sensors), Marcus Vance (Acoustics/Dante)  

---

## 1. Projector Rigging & Edge-Blending Calibration
- [ ] Rig 2x Panasonic PT-RQ25K projectors on F34 truss at 4.50m elevation
- [ ] Connect secondary steel safety cables (rated 250kg)
- [ ] Power on laser light engine and warm up for 20 minutes
- [ ] Align 15% overlap zone on central wall canvas
- [ ] Apply TouchDesigner 33x33 Bezier warp grid to compensate for wall curvature
- [ ] Match projector black levels and laser phosphor color temperature (6500K)

---

## 2. Acoustic Alignment & Dante Network Configuration
- [ ] Connect Focusrite RedNet interface via redundant CAT6 etherCON cables
- [ ] Verify Gigabit clock sync in Dante Controller (PTP Leader clock locked)
- [ ] Position 8x Genelec 8040B monitors at ear height (1.65m) around room perimeter
- [ ] Place 2x Genelec 7380A subwoofers in diagonal room corners
- [ ] Execute Genelec GLM frequency response calibration sweep
- [ ] Set delay compensation: Ch 1-2 (0ms), Ch 3-4 (12.4ms), Ch 5-6 (24.8ms), Ch 7-8 (18.2ms)
- [ ] Tune 80Hz subwoofer crossover and verify absence of low-frequency phase cancellation

---

## 3. 4-Hour Stress Test & Thermal Stability Run
- [ ] Run continuous full-resolution playback for 4 hours non-stop
- [ ] Confirm zero frame drops across 864,000 rendered video frames (60.0 fps steady)
- [ ] Verify RTX 4090 GPU core temperature < 72°C and CPU < 68°C
- [ ] Simulate accidental power loss: verify TouchDesigner restarts cleanly upon power restoration
- [ ] Validate automated DMX relays shut down projectors safely with cooling cycle
`,
    },
  ],
  comments: [
    {
      id: 'c1',
      authorId: 'user-2',
      authorName: 'Elena Rostova',
      authorAvatar: initialsAvatar('Elena Rostova', '#8B5CF6'),
      timestamp: '2026-09-20T08:30:00Z',
      content: 'Atmospheric Continuum 4K ProRes master is uploaded to Drive folder. Zero seam artifacts on loop test!',
      targetType: 'task',
      targetId: 'task-m1',
    },
    {
      id: 'c2',
      authorId: 'user-3',
      authorName: 'Marcus Vance',
      authorAvatar: initialsAvatar('Marcus Vance', '#EC4899'),
      timestamp: '2026-09-20T08:55:00Z',
      content: 'Sub-bass 28Hz stems are dialed in. The low-frequency physical rumble feels incredible without overpowering the room speech intelligibility.',
      targetType: 'project',
      targetId: 'proj-media-installation',
    },
  ],
  history: [
    {
      id: 'h1',
      timestamp: '2026-09-20T09:15:00Z',
      userId: 'user-1',
      userName: 'Berenger Recoules',
      userAvatar: initialsAvatar('Berenger Recoules', '#3B82F6'),
      actionType: 'retroplan_shift',
      targetType: 'timeline',
      targetTitle: 'Opening Night Milestone',
      description: 'Locked the opening night milestone to November 20, 2026.',
    },
    {
      id: 'h2',
      timestamp: '2026-09-20T08:45:00Z',
      userId: 'user-4',
      userName: 'Sora Chen',
      userAvatar: initialsAvatar('Sora Chen', '#10B981'),
      actionType: 'status_change',
      targetType: 'task',
      targetTitle: 'Projectors & Optical Lenses Rental Reservation',
      description: 'Updated task status from "in-progress" to "done" (2x Panasonic 20K laser projectors booked).',
      diff: {
        field: 'status',
        oldVal: 'in-progress',
        newVal: 'done',
      },
    },
  ],
  clarificationQuestions: [
    {
      id: 'q1',
      question: 'Should the projector edge-blend use hardware optical blend masks or TouchDesigner software gamma blending?',
      reason: 'Software blending provides easier on-site warping adjustments, while hardware optical blending offers darker black levels.',
      suggestedOptions: ['TouchDesigner Software Gamma Blending (Recommended)', 'Hardware Optical Blend Masks', 'Hybrid Approach'],
      resolved: true,
      userResponse: 'TouchDesigner Software Gamma Blending (Recommended)',
    },
    {
      id: 'q2',
      question: 'Confirm whether the 8-channel surround audio should have an emergency microphone override for venue security?',
      reason: 'Venue safety regulations require automated audio ducking if fire alarm or emergency announcement triggers.',
      suggestedOptions: ['Dante Automated Priority Ducking (-20dB on Alarm)', 'Manual Mute Switch at Control Booth', 'No Override Needed'],
      resolved: true,
      userResponse: 'Dante Automated Priority Ducking (-20dB on Alarm)',
    },
  ],
};

export const INITIAL_PROJECTS: Project[] = [
  MEDIA_INSTALLATION_PROJECT,
];

export const TUTORIAL_PROJECT: Project = MEDIA_INSTALLATION_PROJECT;

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    title: '2x 20K Laser Projectors Reserved',
    message: 'ProAV Solutions confirmed reservation of dual Panasonic PT-RQ25K projectors and UST lenses for load-in on Oct 29.',
    timestamp: '2026-09-20T09:20:00Z',
    type: 'status_update',
    read: false,
    projectId: 'proj-media-installation',
  },
  {
    id: 'notif-2',
    title: '8.1 Spatial Audio Stems Staged',
    message: 'Marcus staged 8-channel discrete surround masters in Google Drive project folder.',
    timestamp: '2026-09-20T08:45:00Z',
    type: 'ai_insight',
    read: false,
    projectId: 'proj-media-installation',
  },
  {
    id: 'notif-3',
    title: 'Critical Path Alert: On-Site Edge Blending',
    message: 'On-site warping calibration is scheduled for Nov 2. 4 days of safety buffer remain before rehearsal freeze.',
    timestamp: '2026-09-20T07:30:00Z',
    type: 'deadline_warning',
    read: true,
    projectId: 'proj-media-installation',
  },
];

export const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws-1',
    name: 'Spatial Media & Audiovisual Lab',
    description: 'Immersive projection mapping, spatial soundscapes, and interactive AV installation projects.',
    icon: 'Sparkles',
    color: '#3B82F6',
    projectIds: ['proj-media-installation'],
    members: MOCK_USERS,
  },
];
