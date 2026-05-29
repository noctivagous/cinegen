export declare const AGENT_STATIC_ROUTES: {
  readonly HEALTH: '/api/agents/health';
  readonly SCRIPT_ANALYZE: '/api/agents/script/analyze';
  readonly VISUAL_IDENTIFY: '/api/agents/visual/identify';
  readonly VISUAL_EXTRACT_COLORS: '/api/agents/visual/extract-colors';
  readonly SCRIPT_GENERATE_OUTLINE: '/api/agents/script/generate-outline';
  readonly CONCEPT_GENERATE_CONCEPTS: '/api/agents/concept/generate-concepts';
  readonly CONCEPT_GENERATE_IMAGE: '/api/agents/concept/generate-image';
  readonly CASTING_BUILD_GUIDES: '/api/agents/casting/build-guides';
  readonly PRODUCTION_DESIGN_BUILD_GUIDES: '/api/agents/production-design/build-guides';
  readonly STORYBOARD_GENERATE: '/api/agents/storyboard/generate';
  readonly BEAT_BOARD_GENERATE_OUTLINE: '/api/agents/beat-board/generate-outline';
  readonly CINEMATOGRAPHY_BUILD_PROMPT: '/api/agents/cinematography/build-prompt';
  readonly CINEMATOGRAPHY_ROUTE_SHOT: '/api/agents/cinematography/route-shot';
  readonly CINEMATOGRAPHY_AUDIT_CLIP: '/api/agents/cinematography/audit-clip';
  readonly CINEMATOGRAPHY_ANNOTATE_SPATIAL: '/api/agents/cinematography/annotate-spatial';
  readonly SOUND_PREPARE_AUDIO: '/api/agents/sound/prepare-audio';
  readonly POST_ASSEMBLE_SEQUENCE: '/api/agents/post/assemble-sequence';
  readonly POST_COLOR_GRADE: '/api/agents/post/color-grade';
};

export declare function projectContextPath(projectId: string): string;
export declare function projectReviewQueuePath(projectId: string): string;
export declare function projectReviewApprovePath(projectId: string, itemId: string): string;
export declare function projectReviewRejectPath(projectId: string, itemId: string): string;
