export const AGENT_STATIC_ROUTES = {
  HEALTH: '/api/agents/health',
  SCRIPT_ANALYZE: '/api/agents/script/analyze',
  VISUAL_IDENTIFY: '/api/agents/visual/identify',
  VISUAL_EXTRACT_COLORS: '/api/agents/visual/extract-colors',
  SCRIPT_GENERATE_OUTLINE: '/api/agents/script/generate-outline',
  CONCEPT_GENERATE_CONCEPTS: '/api/agents/concept/generate-concepts',
  CONCEPT_GENERATE_IMAGE: '/api/agents/concept/generate-image',
  CASTING_BUILD_BIBLES: '/api/agents/casting/build-bibles',
  PRODUCTION_DESIGN_BUILD_BIBLES: '/api/agents/production-design/build-bibles',
  STORYBOARD_GENERATE: '/api/agents/storyboard/generate',
  BEAT_BOARD_GENERATE_OUTLINE: '/api/agents/beat-board/generate-outline',
  CINEMATOGRAPHY_BUILD_PROMPT: '/api/agents/cinematography/build-prompt',
  CINEMATOGRAPHY_ROUTE_SHOT: '/api/agents/cinematography/route-shot',
  CINEMATOGRAPHY_AUDIT_CLIP: '/api/agents/cinematography/audit-clip',
  CINEMATOGRAPHY_ANNOTATE_SPATIAL: '/api/agents/cinematography/annotate-spatial',
  SOUND_PREPARE_AUDIO: '/api/agents/sound/prepare-audio',
  POST_ASSEMBLE_SEQUENCE: '/api/agents/post/assemble-sequence',
  POST_COLOR_GRADE: '/api/agents/post/color-grade',
};

export function projectContextPath(projectId) {
  return `/api/agents/project/${encodeURIComponent(projectId)}/context`;
}

export function projectReviewQueuePath(projectId) {
  return `/api/agents/project/${encodeURIComponent(projectId)}/review-queue`;
}

export function projectReviewApprovePath(projectId, itemId) {
  return `/api/agents/project/${encodeURIComponent(projectId)}/review/${encodeURIComponent(itemId)}/approve`;
}

export function projectReviewRejectPath(projectId, itemId) {
  return `/api/agents/project/${encodeURIComponent(projectId)}/review/${encodeURIComponent(itemId)}/reject`;
}
