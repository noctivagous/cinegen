import type { CineGenPreferences } from '@/services/preferences';
import type { AppShellStore } from '@/stores/app-shell-store';
import type {
  analyzeScript,
  getProductionContext,
  updateProductionContext,
  getReviewQueue,
  approveReviewItem,
  rejectReviewItem,
  getAgentHealth,
  runScriptWizardStep2,
  buildCharacterGuides,
  buildLocationGuides,
  generateStoryboardFrames,
  buildGenerationPrompt,
  routeGenerationJob,
  auditGeneratedClip,
  translateSpatialAnnotations,
  prepareAudioPlan,
  assembleSequence,
  colorGradeSequence,
  identifyVisualElements,
  extractColorPalette,
  generateScriptFromVisuals,
  generateConcepts,
  generateConceptImage,
  generateOutlineFromBeats,
} from '@/services/ai/agents-service';

export type ModalityKey = 'llm' | 'video' | 'image' | 'audio';

export type InspectorType =
  | 'chip'
  | 'scene'
  | 'shot'
  | 'camera-lighting'
  | 'asset'
  | 'location'
  | 'storyboard-frame'
  | 'scrap'
  | string;

declare global {
  interface ImportMeta {
    glob: (
      pattern: string,
      options?: { eager?: boolean; query?: string; import?: string }
    ) => Record<string, unknown>;
  }

  interface Window {
    CineGen: {
      preferences: CineGenPreferences;
      savePreferences: (next: Partial<CineGenPreferences>) => CineGenPreferences;
      /** Typed shell store (prefer over raw `window.activeProjectId` in new code). */
      appShell?: AppShellStore;
      preferenceKey: string;
      loaderVersion: string;
      triggerModelActivityBlink?: (modality: ModalityKey) => void;
      getTreatmentForStoryAI?: () => unknown;
      getTreatmentForVisualAI?: () => unknown;
      lastTreatmentContext?: unknown;
      lastTreatmentVisualContext?: unknown;
      debug?: {
        clickButton: (selectorOrText: string) => boolean;
        openWindow: (name: string) => boolean;
        closeWindow: () => boolean;
        selectDropdown: (id: string, value: string) => boolean;
        typeInput: (id: string, text: string) => boolean;
        toggleSection: (name: string) => boolean;
        scanAllInteractables: () => Record<string, Array<Record<string, unknown>>>;
        readGUIState: () => Record<string, unknown>;
        readGUIContents: () => Record<string, Array<Record<string, unknown>>>;
      };
      /** CineGen Agent API — calls /api/agents/* via the Mastra agent layer. */
      agents?: {
        analyzeScript: typeof analyzeScript;
        getProductionContext: typeof getProductionContext;
        updateProductionContext: typeof updateProductionContext;
        getReviewQueue: typeof getReviewQueue;
        approveReviewItem: typeof approveReviewItem;
        rejectReviewItem: typeof rejectReviewItem;
        getAgentHealth: typeof getAgentHealth;
        runScriptWizardStep2: typeof runScriptWizardStep2;
        buildCharacterGuides: typeof buildCharacterGuides;
        buildLocationGuides: typeof buildLocationGuides;
        generateStoryboardFrames: typeof generateStoryboardFrames;
        buildGenerationPrompt: typeof buildGenerationPrompt;
        routeGenerationJob: typeof routeGenerationJob;
        auditGeneratedClip: typeof auditGeneratedClip;
        translateSpatialAnnotations: typeof translateSpatialAnnotations;
        prepareAudioPlan: typeof prepareAudioPlan;
        assembleSequence: typeof assembleSequence;
        colorGradeSequence: typeof colorGradeSequence;
        identifyVisualElements: typeof identifyVisualElements;
        extractColorPalette: typeof extractColorPalette;
        generateScriptFromVisuals: typeof generateScriptFromVisuals;
        generateConcepts: typeof generateConcepts;
        generateConceptImage: typeof generateConceptImage;
        generateOutlineFromBeats: typeof generateOutlineFromBeats;
      };
      /** Visual-First wizard state and actions */
      visualWizard?: {
        reset: () => void;
        getState: () => Record<string, unknown>;
        addImage: (file: File, category: string) => Promise<void>;
        removeImage: (id: string) => void;
        setCategory: (id: string, category: string) => void;
        getImagesByCategory: (category: string) => unknown[];
        addCharacter: (name: string) => unknown;
        removeCharacter: (id: string) => void;
        updateCharacter: (id: string, partial: Record<string, unknown>) => void;
        assignImageToChar: (charId: string, imageId: string, slot: string) => void;
        addLocation: (name: string, intExt: string) => unknown;
        removeLocation: (id: string) => void;
        updateLocation: (id: string, partial: Record<string, unknown>) => void;
        assignImageToLoc: (locId: string, imageId: string, interior: boolean) => void;
        addProp: (name: string) => unknown;
        removeProp: (id: string) => void;
        updateProp: (id: string, partial: Record<string, unknown>) => void;
        assignImageToProp: (propId: string, imageId: string) => void;
        setProjectId: (id: string) => void;
        setPalette: (palette: string[]) => void;
        setLightingMood: (mood: string) => void;
        setStyleNotes: (notes: string) => void;
        addColor: (color: string) => void;
        removeColor: (color: string) => void;
        setScriptGenerated: (outline: string) => void;
        setKitBuilt: () => void;
        setBoardsGenerated: (count: number) => void;
        buildKitPayload: () => Record<string, unknown>;
        buildOutlinePayload: () => Record<string, unknown>;
        getIdentifyImages: () => Array<{ dataUrl: string; category: string }>;
        getColorImages: () => Array<{ dataUrl: string }>;
      };
      /** Concept/Mood wizard state and actions */
      conceptWizard?: {
        reset: () => void;
        getState: () => Record<string, unknown>;
        setProjectId: (id: string) => void;
        setMoodDescription: (text: string) => void;
        setSceneSettings: (text: string) => void;
        setLightingDesc: (text: string) => void;
        setAtmosphereNotes: (text: string) => void;
        setVibe: (partial: Record<string, number>) => void;
        addAtmosphereTag: (tag: string) => void;
        removeAtmosphereTag: (tag: string) => void;
        addColor: (color: string) => void;
        removeColor: (color: string) => void;
        addImage: (file: File, category: string) => Promise<unknown>;
        removeImage: (id: string) => void;
        setImageCategory: (id: string, category: string) => void;
        getImagesByCategory: (category: string) => unknown[];
        setGenerating: (v: boolean) => void;
        applyConcepts: (data: Record<string, unknown>) => void;
        addGeneratedImage: (prompt: string, url: string, category: string) => void;
        addLocation: (name: string, intExt: string) => unknown;
        removeLocation: (id: string) => void;
        updateLocation: (id: string, partial: Record<string, unknown>) => void;
        assignPlateToLocation: (locId: string, imageId: string) => void;
        addArchetype: (archetype: string, name: string) => unknown;
        removeArchetype: (id: string) => void;
        updateArchetype: (id: string, partial: Record<string, unknown>) => void;
        setGenerationPrompts: (prompts: string[]) => void;
        setScriptOutline: (outline: string) => void;
        setKitBuilt: () => void;
        buildConceptPayload: () => Record<string, unknown>;
        buildOutlinePayload: () => Record<string, unknown>;
      };
      /** Asset Library Import wizard state and actions */
      assetWizard?: {
        reset: () => void;
        getState: () => Record<string, unknown>;
        setProjectId: (id: string) => void;
        refreshProjectList: () => void;
        selectSource: (sourceId: string) => void;
        toggleChar: (id: string) => void;
        toggleLoc: (id: string) => void;
        toggleProp: (id: string) => void;
        updateChar: (id: string, partial: Record<string, unknown>) => void;
        updateLoc: (id: string, partial: Record<string, unknown>) => void;
        updateProp: (id: string, partial: Record<string, unknown>) => void;
        removeChar: (id: string) => void;
        removeLoc: (id: string) => void;
        removeProp: (id: string) => void;
        setStyleAdopted: (v: boolean) => void;
        runGapAnalysis: (scriptText: string) => void;
        setScriptGenerated: () => void;
        setKitBuilt: () => void;
        buildOutlinePayload: () => Record<string, unknown>;
        buildImportPayload: () => Record<string, unknown>;
      };
      /** Beat Board wizard state and actions */
      beatBoard?: {
        reset: () => void;
        getState: () => Record<string, unknown>;
        setProjectId: (id: string) => void;
        addBeat: (title: string, desc: string, cameraNotes?: string) => Record<string, unknown>;
        removeBeat: (id: string) => void;
        reorderBeat: (id: string, delta: number) => void;
        updateBeat: (id: string, partial: Record<string, unknown>) => void;
        addCharacter: (name: string, desc?: string) => Record<string, unknown>;
        removeCharacter: (id: string) => void;
        addLocation: (name: string, intExt?: string) => Record<string, unknown>;
        removeLocation: (id: string) => void;
        setStyleMood: (v: string) => void;
        setLightingMood: (v: string) => void;
        setColorPalette: (colors: string[]) => void;
        runReferenceSuggestion: () => void;
        setScriptOutline: (text: string) => void;
        setStoryboardsGenerated: (count: number) => void;
        setKitBuilt: () => void;
        buildOutlinePayload: () => Record<string, unknown>;
        buildImportPayload: () => Record<string, unknown>;
      };
    };
    openSetupAssistant?: (stepIndex?: number | string) => void;
    closeSetupAssistant?: () => void;
    checkFirstLaunchSetup?: () => void;
    isSetupComplete?: () => boolean;
    setupBack?: () => void;
    fetchProviderModelsForModality?: (
      providerId: string,
      key: string,
      baseUrl: string,
      mod: string,
      signal: AbortSignal
    ) => Promise<unknown>;
    aipTestSelectedProvider?: () => Promise<void>;
    saOnProviderChange?: (mod: string) => void;
    saTestProxy?: () => Promise<void>;
    saToggleKeyReveal?: (mod: string) => void;
    saWizardAddProvider?: () => void;
    saWizardSaveManualProvider?: (vendorId: string) => void;
    saWizardRemoveProvider?: (vendorId: string) => void;
    loadAiApiSettings?: () => unknown;
    loadApiKeys?: () => { vendors?: Array<{ id: string; providerId?: string; apiKey?: string }> };
    readVendorKey?: (vendor: unknown, scope: string) => string;
    openAiProvidersModal?: (modality?: string) => void;
    escHtml?: (str: unknown) => string;
    AI_API_PROVIDERS?: Array<{ id: string; label: string }>;
    AI_API_MODEL_CATALOG?: Record<string, Record<string, Array<{ id: string; caps?: unknown }>>>;
    getAiApiModelDisplayLabel?: (
      providerId: string,
      modality: string,
      modelId: string,
      storedLabel?: string
    ) => string;
    formatCapsText?: (caps: unknown) => string;
    syncProjectSidebarToggleButton?: (visible: boolean) => void;
    syncPrevisTimelineToggleButton?: (expanded: boolean) => void;
    syncInspectorToggleButton?: (visible: boolean) => void;
    toggleProjectSidebar?: () => void;
    togglePrevisTimelineDock?: () => void;
    positionModelStatusMenu?: (modality: ModalityKey) => void;
    toggleModelStatusMenu?: (modality: ModalityKey) => void;
    testModelStatusConnection?: (modality: ModalityKey) => void;
    updateModelStatusIndicators?: () => void;
    updateSetupIncompleteStatus?: () => void;
    initModelStatusBar?: () => void;
    closeAllModelStatusMenus?: () => void;
    openModelStatusConfig?: (modality: ModalityKey) => void;
    buildModelStatusMenu?: (modality: ModalityKey) => void;
    renderInspectorChipsSection?: (
      chips: Array<{ type: string; label: string }>,
      opts?: { title?: string }
    ) => string;
    extractChipsFromTexts?: (texts: unknown[]) => Array<{ type: string; label: string }>;
    cameraLightingData?: Record<
      string,
      { icon?: string; title?: string; items?: Array<{ abbr: string; name?: string }> }
    >;
    cameraLightingSelections?: Record<string, string | null>;
    escapeHtml?: (str: unknown) => string;
    generateMasterShot?: () => void;
    regenerateShot?: (id: number) => void;
    buildCameraPrompt?: () => void;
    renderFullTree?: () => void;
    refreshProjectTree?: () => void;
    setProjectTreeSelection?: (name: string | null) => void;
    activateProjectTreeNode?: (name: string) => boolean;
    expandProjectTreeToNode?: (node: Record<string, unknown>) => boolean;
    getTreeSectionKeyForNode?: (node: Record<string, unknown>) => string | null;
    findProjectNodeByName?: (name: string) => Record<string, unknown> | null;
    selectTreeNode?: (
      element: HTMLElement | null,
      node: Record<string, unknown>,
      sectionKey?: string | null
    ) => void;
    closeSaveExportMenu?: () => void;
    renderProjectsMenu?: () => void;
    buildAiAssistToolbarMenu?: () => void;
    buildWizardsToolbarMenu?: () => void;
    launchAiAssistAction?: (kind: string, actionId: string) => void;
    launchWizardAction?: (wizardId: string) => void;
    runImportMenuAction?: (action: string) => void;
    runScriptImportExportMenuAction?: (action: string) => void;
    initScriptFountainInsertSplit?: () => void;
    syncActiveProjectName?: (name: string) => void;
    openGuide?: (sectionId: string) => void;
    closeGuideModal?: () => void;
    guideModalStep?: (delta: number) => void;
    openProjectsModal?: () => void;
    closeProjectsModal?: () => void;
    openSettingsModal?: () => void;
    closeSettingsModal?: () => void;
    openAiAssistModal?: () => void;
    openMoodBoardsModal?: () => void;
    openMoodBoardItemDetail?: (boardId: string, itemId: string) => void;
    closeAiAssistModal?: () => void;
    openDebugModal?: () => void;
    closeDebugModal?: () => void;
    openAiProviderInfoModal?: () => void;
    closeAiProviderInfoModal?: () => void;
    modelMatchesAudioCapability?: (model: any, capability: string, providerId?: string) => boolean;
    openSectionSettingsModal?: () => void;
    closeSectionSettingsModal?: () => void;
    openProjectFeaturesModal?: () => Promise<void>;
    closeProjectFeaturesModal?: () => void;
    requestProjectTreeRefresh?: () => void;
    closeAiProvidersModal?: () => void;
    saveAiProvidersModal?: () => void;
    alertCG?: (message: string) => void;
    initAiProvidersModalOnce?: () => void;
    aiProvidersAddVendor?: () => void;
    aiProvidersRemoveSelected?: () => void;
    toggleApiKeyReveal?: () => void;
    clearApiKey?: () => void;
    getDraft?: () => { selectedVendorId?: string; vendors?: Array<{ id: string; providerId?: string; apiKey?: string }> };
    syncDetailInputsToDraft?: () => void;
    vendorHasKeyForScope?: (vendor: unknown, scope: string) => boolean;
    getApiKey?: (scope: string) => string;
    refreshModalityModelOptions?: (modality: string, settings: unknown) => void;
    renderVendorList?: () => void;
    populateAiApiSettingsForm?: () => void;
    selectedStoryboardFrameId?: number | null;
    storyboardReferenceBank?: Record<string, unknown>;
    previsSelectionState?: {
      sceneId: string | null;
      shotId: number | null;
      frameId: number | null;
      scriptRange: { start: number; end: number } | null;
      timelineItemId: string | null;
    };
    sceneReferenceOverrides?: Record<string, unknown>;
    referenceGenerationStatus?: 'idle' | 'generating' | 'ready' | 'error' | string;
    highlightScriptForFrame?: (frame: unknown) => void;
    highlightScriptForShot?: (sceneId: string, shot: unknown) => void;
    selectStoryboardFrameById?: (frameId: number) => void;
    getAiApiProviderList?: () => Array<{ id: string; label: string }>;
    sanitizeAiApiVendorIdsInStoredSettings?: () => void;
    openProjectSettingsModal?: () => void;
    closeProjectSettingsModal?: () => void;
    saveProjectSettingsModal?: () => void;
    saveProject?: () => void;
    openSettings?: (tileId: string) => void;
    exportScreenplay?: () => void;
    exportPDF?: () => void;
    insertFountainSnippet?: (kind: string) => void;
    handleFDXImport?: (event: Event) => void;
    handleFountainImport?: (event: Event) => void;
    importScript?: () => void;
    openBlankProjectWizard?: () => void;
    openScriptWizardModal?: () => void;
    closeScriptWizardModal?: () => void;
    openVisualWizardModal?: () => void;
    closeVisualWizardModal?: () => void;
    openConceptWizardModal?: () => void;
    closeConceptWizardModal?: () => void;
    openAssetWizardModal?: () => void;
    closeAssetWizardModal?: () => void;
    openStoryboardWizardModal?: () => void;
    closeStoryboardWizardModal?: () => void;
    openWizardsModal?: () => void;
    closeWizardsModal?: () => void;
    parseScriptToAssets?: () => void;
    renderSceneDetail?: () => void;
    generateBoards?: () => void;
    setStoryboardGenerationMode?: (mode: 'review' | 'auto') => void;
    getStoryboardGenerationMode?: () => 'review' | 'auto';
    duplicateSelectedFrame?: () => void;
    moveSelectedFrameUp?: () => void;
    moveSelectedFrameDown?: () => void;
    restoreLastDeletedFrame?: () => void;
    generateStoryboardReferences?: () => Promise<void>;
    regenerateReferenceSlot?: (slotId: string, sceneKey?: string) => Promise<void>;
    lockReferenceSlot?: (slotId: string, sceneKey?: string) => void;
    unlockReferenceSlot?: (slotId: string, sceneKey?: string) => void;
    updateReferenceSlotField?: (
      slotId: string,
      field: 'label' | 'prompt' | 'notes',
      value: string,
      sceneKey?: string
    ) => void;
    enableReferenceSlot?: (slotId: string, enabled: boolean, sceneKey?: string) => void;
    getProjectResolutionOptionGroups?: (
      aspectValue: string
    ) => Array<{ groupLabel: string; options: Array<{ value: string; label: string }> }>;
    getActiveProjectSettings?: () => Record<string, unknown>;
    ensureProjectSettingsRecord?: (project: { settings?: Record<string, unknown> }) => void;
    normalizeProjectAspectRatio?: (value: string) => string;
    normalizeProjectResolutionForAspect?: (aspect: string, resolution: string) => string;
    updateProjectTreeHeader?: () => void;
    triggerFDXImport?: () => void;
    saveFountainFile?: () => void;
    setWorkspaceViewLabel?: (label: string) => void;
    switchSceneTab?: (tabIndex: number) => void;
    switchAssetTab?: (tab: number) => void;
    selectAsset?: (name: string) => void;
    addAssetToScene?: (name: string) => void;
    useLocation?: (id: number) => void;
    filterLocations?: () => void;
    showStoryboardContextMenu?: (frame: unknown, clientX: number, clientY: number) => void;
    hideStoryboardContextMenu?: () => void;
    scheduleFountainRender?: () => void;
    hydrateScriptEditorFromProject?: () => void;
    syncScriptEditorToProject?: () => void;
    scheduleScriptEditorProjectSync?: () => void;
    setScriptContent?: (text: string) => void;
    getProjectFountainText?: () => string;
    setProjectFountainText?: (text: string) => void;
    syncScriptRenderScroll?: () => void;
    syncScriptSelectionToStoryboard?: () => void;
    renderScriptPrevisMargin?: () => void;
    handleScriptPrevisMarginClick?: (event: Event) => void;
    handleScriptPrevisMarginDragStart?: (event: MouseEvent) => void;
    dragStart?: (e: DragEvent) => void;
    renderTimeline?: () => void;
    setPrevisSelectionState?: (next: Record<string, unknown>, opts?: { emit?: boolean }) => void;
    _saveAssetItemField?: (key: string, value: string) => void;
    syncTreatmentFromForm?: () => void;
    showOvPreview?: (el: HTMLElement, childIdx: number, itemIdx: number) => void;
    hideOvPreview?: () => void;
    setOvHoverPreview?: (checked: boolean) => void;
  }

  interface HTMLElementTagNameMap {
    'cinegen-app': import('@/components/layout/cinegen-app').CinegenApp;
    'cinegen-inspector-shell': import('@/components/layout/cinegen-inspector-shell').CinegenInspectorShell;
    'cinegen-project-sidebar': import('@/components/layout/cinegen-project-sidebar').CinegenProjectSidebar;
    'cinegen-inspector': import('@/components/panels/cinegen-inspector').CinegenInspector;
    'cinegen-model-status-bar': import('@/components/layout/cinegen-model-status-bar').CinegenModelStatusBar;
    'cinegen-status-bar': import('@/components/layout/cinegen-status-bar').CinegenStatusBar;
    'cinegen-overview-preview': import('@/components/layout/cinegen-overview-preview').CinegenOverviewPreview;
    'cinegen-previs-timeline-dock': import('@/components/layout/cinegen-previs-timeline-dock').CinegenPrevisTimelineDock;
    'cg-toolbar-button': import('@/components/primitives/cg-toolbar-button').CgToolbarButton;
    'cg-toolbar-split': import('@/components/primitives/cg-toolbar-split').CgToolbarSplit;
    'cg-segmented-control': import('@/components/primitives/cg-segmented-control').CgSegmentedControl;
    'cg-accordion': import('@/components/primitives/cg-accordion').CgAccordion;
    'cg-split-divider': import('@/components/primitives/cg-split-divider').CgSplitDivider;
    'cinegen-aip-test-connection': import('@/components/settings/cinegen-aip-test-connection').CinegenAipTestConnection;
    'cinegen-provider-catalog-sync': import('@/components/settings/cinegen-provider-catalog-sync').CinegenProviderCatalogSync;
    'cinegen-storyboard': import('@/components/panels/cinegen-storyboard').CinegenStoryboard;
    'cinegen-scene-tabs': import('@/components/panels/cinegen-scene-tabs').CinegenSceneTabs;
    'cinegen-assets-panel': import('@/components/panels/cinegen-assets-panel').CinegenAssetsPanel;
    'cinegen-location-scout': import('@/components/panels/cinegen-location-scout').CinegenLocationScout;
    'cinegen-script-editor': import('@/components/panels/cinegen-script-editor').CinegenScriptEditor;
    'cinegen-storyboard-animatic-player': import('@/components/panels/cinegen-storyboard-animatic-player').CinegenStoryboardAnimaticPlayer;
    'cinegen-timeline': import('@/components/panels/cinegen-timeline').CinegenTimeline;
    'cinegen-overview-panel': import('@/components/panels/cinegen-overview-panel').CinegenOverviewPanel;
    'cinegen-treatment-panel': import('@/components/panels/cinegen-treatment-panel').CinegenTreatmentPanel;
    'cg-context-menu': import('@/components/primitives/cg-context-menu').CgContextMenu;
    'cinegen-sa-step-host': import('@/setup-assistant/cinegen-sa-step-host').CinegenSaStepHost;
    'sa-step-welcome': import('@/setup-assistant/steps/sa-step-welcome').SaStepWelcome;
    'sa-step-providers': import('@/setup-assistant/steps/sa-step-providers').SaStepProviders;
    'sa-step-coverage': import('@/setup-assistant/steps/sa-step-coverage').SaStepCoverage;
    'sa-step-models': import('@/setup-assistant/steps/sa-step-models').SaStepModels;
    'sa-step-done': import('@/setup-assistant/steps/sa-step-done').SaStepDone;
    'cg-panel-header': import('@/components/primitives/cg-panel-header').CgPanelHeader;
    'cg-modal-shell': import('@/components/primitives/cg-modal-shell').CgModalShell;
    'cg-panel-modal': import('@/components/primitives/cg-panel-modal').CgPanelModal;
    'cg-vis-toggle': import('@/components/primitives/cg-vis-toggle').CgVisToggle;
    'cg-toggle-group': import('@/components/primitives/cg-toggle-group').CgToggleGroup;
    'cg-stepper': import('@/components/primitives/cg-stepper').CgStepper;
    'cinegen-preprod-workspace': import('@/components/panels/cinegen-preprod-workspace').CinegenPreprodWorkspace;
    'cinegen-script-pane': import('@/components/panels/cinegen-script-pane').CinegenScriptPane;
    'cinegen-script-editor-chrome': import('@/components/panels/cinegen-script-editor-chrome').CinegenScriptEditorChrome;
    'cinegen-script-info-pane': import('@/components/panels/cinegen-script-info-pane').CinegenScriptInfoPane;
    'cinegen-storyboard-pane': import('@/components/panels/cinegen-storyboard-pane').CinegenStoryboardPane;
    'cinegen-breakdown-view': import('@/components/panels/cinegen-breakdown-view').CinegenBreakdownView;
    'cinegen-scene-detail-view': import('@/components/panels/cinegen-scene-detail-view').CinegenSceneDetailView;
    'cinegen-timeline-view': import('@/components/panels/cinegen-timeline-view').CinegenTimelineView;
    'cinegen-location-scout-view': import('@/components/panels/cinegen-location-scout-view').CinegenLocationScoutView;
    'cinegen-location-guide-view': import('@/components/panels/cinegen-location-guide-view').CinegenLocationGuideView;
    'cinegen-location-plan-view': import('@/components/panels/cinegen-location-plan-view').CinegenLocationPlanView;
    'cinegen-location-camera-editor': import('@/components/panels/cinegen-location-camera-editor').CinegenLocationCameraEditor;
    'cinegen-assets-view': import('@/components/panels/cinegen-assets-view').CinegenAssetsView;
    'cinegen-camera-lighting-view': import('@/components/panels/cinegen-camera-lighting-view').CinegenCameraLightingView;
    'cinegen-casting-view': import('@/components/panels/cinegen-casting-view').CinegenCastingView;
    'cinegen-chip-global-view': import('@/components/panels/cinegen-chip-global-view').CinegenChipGlobalView;
    'cinegen-moodboards-view': import('@/components/panels/cinegen-moodboards-view').CinegenMoodboardsView;
    'cinegen-moodboards-panel': import('@/components/panels/cinegen-moodboards-panel').CinegenMoodboardsPanel;
    'cinegen-moodboards-kanban': import('@/components/panels/cinegen-moodboards-kanban').CinegenMoodboardsKanban;
    'cinegen-moodboard-item-detail': import('@/components/panels/cinegen-moodboard-item-detail').CinegenMoodboardItemDetail;
    'cinegen-moodboard-item-viewer': import('@/components/panels/cinegen-moodboard-item-viewer').CinegenMoodboardItemViewer;
    'cinegen-overview-view': import('@/components/panels/cinegen-overview-view').CinegenOverviewView;
    'cinegen-project-overview-view': import('@/components/panels/cinegen-project-overview-view').CinegenProjectOverviewView;
    'cinegen-asset-detail-view': import('@/components/panels/cinegen-asset-detail-view').CinegenAssetDetailView;
    'cinegen-workspace-empty': import('@/components/panels/cinegen-workspace-empty').CinegenWorkspaceEmpty;
    // 'cinegen-console': import('@/console/console-element').CinegenConsole;
  }
}

export {};
