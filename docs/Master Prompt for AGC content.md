You are scaffolding the foundational architecture for a deterministic AI-assisted media operating system.

This is NOT a generic “AI video generator.”

The system architecture must prioritize:

* deterministic rendering
* semantic orchestration
* reusable media compilation
* renderer abstraction
* AI-assisted planning
* human-directable outputs

The long-term goal is:
Natural language intent
→ semantic scene graph
→ deterministic scene compiler
→ renderer adapters
→ final media outputs

This system will generate:

* short-form educational videos
* social reels
* onboarding videos
* carousels
* motion graphics
* AI-assisted cinematic inserts

CORE PRINCIPLES

1. Generative systems produce assets.
2. Deterministic systems produce compositions.
3. Renderers are implementation details.
4. Semantic intent must remain renderer-agnostic.
5. Human override capability must exist throughout the pipeline.
6. AI planning must NEVER directly generate renderer-specific code.
7. Frame math should only exist at renderer compilation level.

==================================================
PRIMARY ARCHITECTURE
====================

PLANNING LAYER
Claude Code

SEMANTIC LAYER
TypeScript semantic scene graph

SCENE COMPILER
Node.js orchestration layer

PRIMARY RENDERER
Remotion
https://github.com/remotion-dev/remotion

MOTION ENGINE
Motion Canvas
https://github.com/motion-canvas/motion-canvas

TIMELINE / KEYFRAME ENGINE
Theatre.js
https://github.com/theatre-js/theatre

3D / SHADER / PARTICLE LAYER
React Three Fiber
https://github.com/pmndrs/react-three-fiber

STATIC EXPORTS
Puppeteer
https://github.com/puppeteer/puppeteer

VIDEO POST PROCESSING
FFmpeg-python
https://github.com/kkroening/ffmpeg-python

GENERATIVE VIDEO ASSET ENGINE
LongCat
https://github.com/meituan-longcat/LongCat-Video

GPU EXECUTION
RunPod
https://github.com/runpod/runpod-python

AUDIO / SFX
Stable Audio Tools
https://github.com/Stability-AI/stable-audio-tools

AudioCraft
https://github.com/facebookresearch/audiocraft

==================================================
OBJECTIVE
=========

Create a NEW project scaffold implementing the foundational semantic media compiler architecture.

The system must build THESE FIRST before renderer implementation details:

1. Semantic scene graph schema
2. Temporal abstraction layer
3. Audio event model
4. Asset registry
5. Creative constraint system
6. Scene compiler abstraction

ONLY AFTER THESE EXIST:

* Remotion
* Motion Canvas
* Theatre.js
  become renderer implementations.

==================================================
IMPORTANT ARCHITECTURAL RULES
=============================

DO NOT:

* tightly couple planning to renderers
* expose frame math to semantic planning
* generate arbitrary JSX from LLMs
* hardcode transitions everywhere
* hardcode SFX triggers directly into components
* allow renderer-specific logic into the semantic layer

INSTEAD:

* build semantic intent abstractions
* compile semantic timing into renderer timing
* compile semantic emphasis into animation systems
* compile semantic events into audio triggers

==================================================
PHASE 1 — FOUNDATIONAL SCHEMA SYSTEM
====================================

Create:

/core/schema/
/core/compiler/
/core/timing/
/core/audio/
/core/assets/
/core/constraints/
/core/renderers/
/core/scenes/

Implement TypeScript interfaces for:

1. SemanticScene
2. TemporalIntent
3. AudioEvent
4. AssetReference
5. CreativeConstraintProfile
6. RenderIntent
7. MotionIntent
8. TransitionIntent
9. CaptionIntent
10. SceneCompilationResult

==================================================
SEMANTIC SCENE GRAPH REQUIREMENTS
=================================

Scenes must support:

* scene purpose
* semantic pacing
* emotional intensity
* educational emphasis
* voiceover intent
* caption intent
* transition intent
* motion intent
* asset references
* override capability
* platform targeting

DO NOT USE:

* raw frame counts in semantic layer

USE:

* semantic timing abstractions

Example:

{
"sceneType": "hook",
"semanticDuration": "fast",
"estimatedReadTime": 2.5,
"energy": 0.8,
"motionStyle": "kinetic-educational"
}

==================================================
PHASE 2 — TEMPORAL ABSTRACTION LAYER
====================================

Create a universal timing abstraction system.

Purpose:
Renderer-independent timing semantics.

The timing layer must:

* convert semantic pacing into renderer timing
* compile into Remotion frames
* compile into Motion Canvas timing
* support future renderer adapters

Implement:

* semanticDuration
* emphasisCurve
* transitionEnergy
* estimatedReadTime
* pacing profiles

==================================================
PHASE 3 — AUDIO EVENT SYSTEM
============================

Create a semantic audio event architecture.

Audio categories:

* voice
* music
* sfx
* ambience
* transitions
* reactive events

Audio events must be semantic.

BAD:
playWhoosh()

GOOD:
{
"event": "scene-impact",
"preset": "soft-bass-hit"
}

Audio engine should map:
semantic event
→ audio asset

==================================================
PHASE 4 — ASSET REGISTRY
========================

Create a centralized asset registry.

Support:

* generated assets
* illustrations
* audio
* stock footage
* LongCat generations
* motion graphics assets

Asset registry fields:

* assetId
* type
* source
* approved
* tags
* duration
* metadata
* path

==================================================
PHASE 5 — CREATIVE CONSTRAINT SYSTEM
====================================

Create a deterministic creative grammar system.

This controls:

* motion language
* transition vocabulary
* typography hierarchy
* pacing rules
* audio intensity
* energy ceilings
* educational readability

Implement:

CreativeConstraintProfile.ts

Support:

* allowed transitions
* caption styles
* motion families
* energy ranges
* pacing rules
* audio policies

==================================================
PHASE 6 — SCENE COMPILER
========================

Build a renderer-agnostic scene compiler.

Input:
semantic scene graph

Output:
renderer-ready scene structures

Compiler responsibilities:

* timing compilation
* motion compilation
* transition compilation
* audio event mapping
* asset injection
* renderer adapter translation

IMPORTANT:
LLMs NEVER generate renderer code directly.

==================================================
PHASE 7 — REMOTION RENDERER
===========================

Create a renderer adapter for Remotion.

Remotion is the FINAL composition engine.

Responsibilities:

* final timeline assembly
* composition rendering
* caption rendering
* audio mixing
* motion assembly
* output generation

Create:

/renderers/remotion/

Implement:

* renderer adapter
* sequence compiler
* composition generator

==================================================
PHASE 8 — MOTION CANVAS INTEGRATION
===================================

Create Motion Canvas integration as:

* motion primitive layer
  NOT:
* orchestration layer

Purpose:

* particles
* procedural motion
* compositional animation
* advanced transitions

==================================================
PHASE 9 — THEATRE.JS INTEGRATION
================================

Integrate Theatre.js for:

* editable timelines
* keyframe systems
* directable animation states
* human override support

==================================================
PHASE 10 — PUPPETEER CAROUSEL ENGINE
====================================

Build deterministic HTML-to-image carousel renderer.

Requirements:

* consume semantic scene data
* render social carousels
* screenshot slides
* support illustrations
* support typography constraints

==================================================
PHASE 11 — PROJECT STRUCTURE
============================

Create a clean scalable architecture.

Recommended structure:

/core
/renderers
/motion
/audio
/assets
/generated
/templates
/projects
/output
/scripts
/config
/docs

==================================================
PHASE 12 — DOCUMENTATION
========================

Generate:

* architecture.md
* rendering-pipeline.md
* semantic-scene-graph.md
* audio-event-system.md
* creative-constraints.md

Explain:

* architectural philosophy
* deterministic vs generative separation
* renderer abstraction philosophy
* semantic compilation model

==================================================
IMPORTANT IMPLEMENTATION NOTES
==============================

This project is optimized for:

* educational social content
* onboarding systems
* programmable motion graphics
* AI-assisted media generation
* deterministic scalability

Human override capability is mandatory.

The system must remain:

* modular
* composable
* renderer-agnostic
* deterministic-first

Begin by scaffolding the entire architecture and installing dependencies for:

* Remotion
* Motion Canvas
* Theatre.js
* React Three Fiber
* Puppeteer
* ffmpeg-python

Use TypeScript throughout.

Focus on architectural correctness over flashy visuals.
