import path from 'node:path';
import fs from 'node:fs';
import { Archiver } from 'archiver';
import yauzl from 'yauzl';
import {
  PROJECTS_DIR,
  CINE_DOC_RE,
  json,
  corsHeaders,
} from './proxy-utils.js';

export function writeDocumentsAtomic(dirPath, docs, manifest) {
  const stagingPath = `${dirPath}.staging`;
  const backupPath = `${dirPath}.backup`;

  if (fs.existsSync(backupPath)) {
    if (!fs.existsSync(dirPath)) {
      try { fs.renameSync(backupPath, dirPath); } catch { /* best-effort */ }
    } else {
      try { fs.rmSync(backupPath, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
  }
  if (fs.existsSync(stagingPath)) {
    try { fs.rmSync(stagingPath, { recursive: true, force: true }); } catch { /* best-effort */ }
  }

  fs.mkdirSync(stagingPath, { recursive: true });

  if (fs.existsSync(dirPath)) {
    const existing = fs.readdirSync(dirPath);
    for (const fname of existing) {
      const src = path.join(dirPath, fname);
      const dst = path.join(stagingPath, fname);
      try {
        fs.copyFileSync(src, dst);
      } catch { /* skip unreadable files */ }
    }
  }

  const written = [];
  for (const [fname, content] of Object.entries(docs)) {
    if (!CINE_DOC_RE.test(fname)) continue;
    const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    fs.writeFileSync(path.join(stagingPath, fname), data, 'utf-8');
    written.push(fname);
  }

  if (manifest) {
    fs.writeFileSync(
      path.join(stagingPath, 'cine.manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
  }

  try {
    if (fs.existsSync(dirPath)) fs.renameSync(dirPath, backupPath);
    fs.renameSync(stagingPath, dirPath);
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
  } catch (swapErr) {
    if (!fs.existsSync(dirPath) && fs.existsSync(backupPath)) {
      try { fs.renameSync(backupPath, dirPath); } catch { /* leave for next write's recovery */ }
    }
    throw swapErr;
  }

  return written;
}

function ensureProjectsDir() {
  try {
    if (!fs.existsSync(PROJECTS_DIR)) {
      fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    }
  } catch { /* ignore */ }
}

export function listServerProjects() {
  ensureProjectsDir();
  const entries = [];
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
    for (const dirent of dirs) {
      if (!dirent.isDirectory() || !dirent.name.endsWith('.cine')) continue;
      const manifestPath = path.join(PROJECTS_DIR, dirent.name, 'cine.manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const stat = fs.statSync(manifestPath);
        entries.push({
          id: manifest.id || dirent.name.replace(/\.cine$/, ''),
          name: manifest.name || dirent.name,
          lastModified: stat.mtime.toISOString(),
          writable: true,
          dir: dirent.name,
        });
      } catch { /* skip corrupt manifest */ }
    }
  } catch { /* ignore readdir fail */ }
  return entries;
}

function estimateDirSize(dirPath) {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += estimateDirSize(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    }
  } catch { /* ignore */ }
  return total;
}

export function handleProjectsApi(req, res) {
  const origin = req.headers['origin'] || '*';
  const url = req.url || '';
  const method = req.method || 'GET';

  if (url === '/api/projects' && method === 'GET') {
    const serverOnes = listServerProjects();
    json(res, 200, { projects: serverOnes });
    return;
  }

  if (url === '/api/projects' && method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const name = String(payload.name || '').trim() || 'Untitled Production';
        const id = String(payload.id || '').trim() || `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const dirName = `${id}.cine`;
        const dirPath = path.join(PROJECTS_DIR, dirName);

        if (fs.existsSync(dirPath)) {
          json(res, 409, { error: 'Project already exists', id });
          return;
        }

        fs.mkdirSync(dirPath, { recursive: true });

        const manifest = {
          format: 'cinegen-package',
          version: 2,
          id,
          name,
          documents: {
            screenplay: 'screenplay.cinescript',
            treatment: 'treatment.cinetreatment',
            storyboard: 'storyboard.cinestoryboard',
            scenes: 'scenes.cinescenes',
            breakdown: 'breakdown.cinebreakdown',
            characters: 'characters.cinecharacters',
            locations: 'locations.cinelocations',
            referenceImages: 'references.cinereferenceimages',
            style: 'style.cinestyle',
            features: 'features.cinefeatures',
          },
        };

        const defaultMoodBoardId = `mb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const minimalDocs = {
          'screenplay.cinescript': { format: 'fountain', text: payload.screenplay || '' },
          'treatment.cinetreatment': {},
          'storyboard.cinestoryboard': {
            frames: [],
            deletedFrames: [],
            selectedFrameId: null,
            visibility: { scene: true, frame: true, notes: true },
            referenceBank: { characters: [], locations: [], interiors: [], exteriors: [] },
            sceneReferenceOverrides: {},
            referenceGenerationStatus: 'idle',
          },
          'scenes.cinescenes': {},
          'breakdown.cinebreakdown': [],
          'characters.cinecharacters': [],
          'locations.cinelocations': [],
          'references.cinereferenceimages': {
            moodBoards: [
              {
                id: defaultMoodBoardId,
                name: 'Visual DNA',
                items: [],
                viewMode: 'grid',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
            activeMoodBoardId: defaultMoodBoardId,
          },
          'style.cinestyle': {
            colorPalette: [],
            lightingMood: '',
            lensStyle: '',
            visualTone: '',
            styleReference: '',
          },
          'features.cinefeatures': {
            version: 1,
            enabled: { 'mood-boards': true },
            order: ['mood-boards'],
          },
        };

        writeDocumentsAtomic(dirPath, minimalDocs, manifest);

        json(res, 201, {
          id,
          name,
          writable: true,
          lastModified: new Date().toISOString(),
        });
      } catch (e) {
        json(res, 500, { error: 'Failed to create project', detail: e.message });
      }
    });
    return;
  }

  if (url.startsWith('/api/projects/') && url.endsWith('/load') && method === 'GET') {
    const id = url.split('/')[3];
    const proj = listServerProjects().find((p) => p.id === id);
    if (!proj) {
      json(res, 404, { error: 'Project not found' });
      return;
    }
    const dirPath = path.join(PROJECTS_DIR, proj.dir);
    let applied = null;
    try {
      const manifestRaw = fs.readFileSync(path.join(dirPath, 'cine.manifest.json'), 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      const docs = manifest.documents || {};

      function readDoc(relPath) {
        if (!relPath) return null;
        const p = path.join(dirPath, relPath);
        if (!fs.existsSync(p)) return null;
        try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
      }

      const screenplayDoc = readDoc(docs.screenplay) || {};
      const treatmentDoc = readDoc(docs.treatment) || {};
      const storyboardDoc = readDoc(docs.storyboard) || {};
      const scenesDoc = readDoc(docs.scenes) || {};
      const breakdownDoc = readDoc(docs.breakdown) || [];
      const charactersDoc = readDoc(docs.characters) || [];
      const locationsDoc = readDoc(docs.locations) || [];
      const refImagesDoc = readDoc(docs.referenceImages) || {};
      const styleDoc = readDoc(docs.style) || {};
      const featuresDoc = readDoc(docs.features) || null;

      applied = {
        projectScreenplay: { format: 'fountain', text: screenplayDoc.text || '' },
        projectData: { name: manifest.name || proj.name, type: 'project', icon: 'fa-film', expanded: true, children: [] },
        projectTreatment: treatmentDoc,
        currentSceneData: scenesDoc,
        storyboardFrames: storyboardDoc.frames || [],
        deletedStoryboardFrames: storyboardDoc.deletedFrames || [],
        selectedStoryboardFrameId: storyboardDoc.selectedFrameId ?? null,
        storyboardVisibility: storyboardDoc.visibility || { scene: true, frame: true, notes: true },
        storyboardReferenceBank: storyboardDoc.referenceBank || { characters: [], locations: [], interiors: [], exteriors: [] },
        sceneReferenceOverrides: storyboardDoc.sceneReferenceOverrides || {},
        referenceGenerationStatus: storyboardDoc.referenceGenerationStatus || 'idle',
        previsSelectionState: storyboardDoc.previsSelection || { sceneId: null, shotId: null, frameId: null, scriptRange: null, timelineItemId: null },
        assetLibrary: {
          characters: Array.isArray(charactersDoc) ? charactersDoc : [],
          locations: Array.isArray(locationsDoc) ? locationsDoc : [],
          costumes: [], props: [], vehicles: [], effects: [], audio: [], production: [],
        },
        locationLibrary: Array.isArray(locationsDoc) ? locationsDoc : [],
        generationQueue: [],
        reviewQueue: [],
        generationLog: [],
        agentLog: [],
        styleGuide: styleDoc || { colorPalette: [], lightingMood: '', lensStyle: '', visualTone: '', styleReference: '' },
        breakdownData: Array.isArray(breakdownDoc) ? breakdownDoc : [],
        assetDetailData: {},
        referenceImages: {
          moodBoards: Array.isArray(refImagesDoc.moodBoards) ? refImagesDoc.moodBoards : [],
          activeMoodBoardId: refImagesDoc.activeMoodBoardId ?? null,
        },
        projectFeatures: featuresDoc && featuresDoc.version === 1 ? featuresDoc : undefined,
      };
    } catch (e) {
      json(res, 500, { error: 'Failed to load project documents', detail: e.message });
      return;
    }
    json(res, 200, { applied, meta: { id: proj.id, name: proj.name, writable: true } });
    return;
  }

  if (url.startsWith('/api/projects/') && url.includes('/documents') && method === 'POST') {
    const parts = url.split('/');
    const id = parts[3];
    if (!id) {
      json(res, 400, { error: 'Missing project id in /documents path' });
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const docs = payload.documents || payload;
        if (!docs || typeof docs !== 'object') {
          json(res, 400, { error: 'Invalid body: expected document map' });
          return;
        }

        const dirPath = path.join(PROJECTS_DIR, `${id}.cine`);
        fs.mkdirSync(dirPath, { recursive: true });

        const written = writeDocumentsAtomic(dirPath, docs, payload.manifest);

        json(res, 200, { ok: true, written, projectId: id });
      } catch (e) {
        json(res, 500, { error: 'Failed to write documents', detail: e.message });
      }
    });
    return;
  }

  const exportManifestMatch = url.match(/^\/api\/projects\/([^/]+)\/export\/manifest$/);
  if (exportManifestMatch && method === 'GET') {
    const id = exportManifestMatch[1];
    const proj = listServerProjects().find((p) => p.id === id);
    if (!proj) {
      json(res, 404, { error: 'Project not found' });
      return;
    }
    try {
      const dirPath = path.join(PROJECTS_DIR, proj.dir);
      const manifestRaw = JSON.parse(fs.readFileSync(path.join(dirPath, 'cine.manifest.json'), 'utf-8'));
      const docs = manifestRaw.documents || {};

      let sceneCount = 0;
      let shotCount = 0;
      let frameCount = 0;
      let charCount = 0;
      let locCount = 0;
      let propCount = 0;

      if (docs.scenes) {
        const scenes = JSON.parse(fs.readFileSync(path.join(dirPath, docs.scenes), 'utf-8'));
        sceneCount = Object.keys(scenes || {}).length;
        for (const s of Object.values(scenes || {})) {
          if (s.coverage && Array.isArray(s.coverage)) shotCount += s.coverage.length;
        }
      }
      if (docs.storyboard) {
        const sb = JSON.parse(fs.readFileSync(path.join(dirPath, docs.storyboard), 'utf-8'));
        frameCount = (sb.frames && Array.isArray(sb.frames)) ? sb.frames.length : 0;
      }
      if (docs.characters) {
        const chars = JSON.parse(fs.readFileSync(path.join(dirPath, docs.characters), 'utf-8'));
        charCount = Array.isArray(chars) ? chars.length : 0;
      }
      if (docs.locations) {
        const locs = JSON.parse(fs.readFileSync(path.join(dirPath, docs.locations), 'utf-8'));
        locCount = Array.isArray(locs) ? locs.length : 0;
      }
      if (docs.props && fs.existsSync(path.join(dirPath, docs.props))) {
        const props = JSON.parse(fs.readFileSync(path.join(dirPath, docs.props), 'utf-8'));
        propCount = Array.isArray(props) ? props.length : 0;
      }

      const exportSize = estimateDirSize(dirPath);
      json(res, 200, {
        projectId: id,
        name: manifestRaw.name || proj.name,
        format: manifestRaw.format,
        version: manifestRaw.version,
        sceneCount,
        shotCount,
        frameCount,
        charCount,
        locCount,
        propCount,
        exportSize,
        externalUrls: [],
      });
    } catch (e) {
      json(res, 500, { error: 'Failed to read export manifest', detail: e.message });
    }
    return;
  }

  const exportMatch = url.match(/^\/api\/projects\/([^/]+)\/export$/);
  if (exportMatch && method === 'GET') {
    const id = exportMatch[1];
    const proj = listServerProjects().find((p) => p.id === id);
    if (!proj) {
      json(res, 404, { error: 'Project not found' });
      return;
    }
    const dirPath = path.join(PROJECTS_DIR, proj.dir);
    if (!fs.existsSync(dirPath)) {
      json(res, 404, { error: 'Project directory not found on disk' });
      return;
    }

    res.writeHead(200, {
      ...corsHeaders('*'),
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(proj.name || 'project')}.cine.zip"`,
      'Transfer-Encoding': 'chunked',
    });

    const archive = new Archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    archive.directory(dirPath, false);
    archive.finalize().catch((e) => {
      /* stream error — client may have disconnected */
    });
    return;
  }

  if (url === '/api/projects/import' && method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try {
        const zipBuffer = Buffer.concat(chunks);
        if (zipBuffer.length < 20) {
          json(res, 400, { error: 'Empty or invalid zip file' });
          return;
        }

        const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(PROJECTS_DIR), 'import-'));
        let manifestId = '';
        let manifestName = '';
        const extractedFiles = [];

        await new Promise((resolve, reject) => {
          yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
            if (err) { reject(err); return; }
            zipfile.readEntry();
            zipfile.on('entry', (entry) => {
              if (/\/$/.test(entry.fileName)) {
                const dirPath = path.join(tmpDir, entry.fileName);
                fs.mkdirSync(dirPath, { recursive: true });
                zipfile.readEntry();
                return;
              }
              const filePath = path.join(tmpDir, entry.fileName);
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              zipfile.openReadStream(entry, (openErr, readStream) => {
                if (openErr) { reject(openErr); return; }
                const writeStream = fs.createWriteStream(filePath);
                readStream.pipe(writeStream);
                writeStream.on('finish', () => {
                  extractedFiles.push(entry.fileName);
                  zipfile.readEntry();
                });
                writeStream.on('error', reject);
              });
            });
            zipfile.on('end', () => resolve());
            zipfile.on('error', reject);
          });
        });

        const manifestPath = path.join(tmpDir, 'cine.manifest.json');
        if (!fs.existsSync(manifestPath)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          json(res, 400, { error: 'Missing cine.manifest.json — not a valid .cine package' });
          return;
        }

        let manifest;
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        } catch {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          json(res, 400, { error: 'Invalid cine.manifest.json — could not parse JSON' });
          return;
        }

        if (manifest.format !== 'cinegen-package') {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          json(res, 400, { error: `Unrecognized format "${manifest.format}". Expected "cinegen-package".` });
          return;
        }

        if (manifest.version > 2) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          json(res, 400, { error: `Project version ${manifest.version} is newer than current (2). Please update CineGen.` });
          return;
        }

        const docs = manifest.documents || {};
        const missingDocs = [];
        for (const [key, relPath] of Object.entries(docs)) {
          if (typeof relPath !== 'string') continue;
          const fullPath = path.join(tmpDir, relPath);
          if (!fs.existsSync(fullPath)) {
            missingDocs.push(`${key}: ${relPath}`);
          }
        }
        if (missingDocs.length) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          json(res, 400, { error: 'Missing document files', missing: missingDocs });
          return;
        }

        manifestId = manifest.id || `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        manifestName = manifest.name || 'Imported Project';
        const destDirName = `${manifestId}.cine`;
        let destPath = path.join(PROJECTS_DIR, destDirName);

        if (fs.existsSync(destPath)) {
          manifestId = `${manifestId}-${Date.now().toString(36)}`;
          destPath = path.join(PROJECTS_DIR, `${manifestId}.cine`);
        }

        manifest.id = manifestId;
        manifest.name = manifestName;
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

        fs.renameSync(tmpDir, destPath);

        const stat = fs.statSync(path.join(destPath, 'cine.manifest.json'));
        json(res, 201, {
          id: manifestId,
          name: manifestName,
          writable: true,
          lastModified: stat.mtime.toISOString(),
        });
      } catch (e) {
        json(res, 500, { error: 'Failed to import project', detail: e.message });
      }
    });
    return;
  }

  json(res, 405, { error: 'Method not allowed for projects API' });
}
