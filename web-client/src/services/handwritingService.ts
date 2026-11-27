/**
 * The candidates of the handwriting pad (#476). The matcher runs on the
 * device, with no network call, against `/handwriting/templates.json`, which
 * `npm run build:dict` writes. The pad loads the file when it opens for the
 * first time, and the HTTP cache keeps it.
 */
import {
  match,
  parseTemplates,
  prepareTemplates,
  PreparedTemplate,
  Stroke,
  TemplateFile,
} from '../utils/handwriting';
import { CANDIDATE_COUNT, orderCandidates } from '../utils/candidateOrder';

/**
 * The matches that the order rule reads. More than the strip shows, so a
 * ranked character just past the eighth can still move into its band.
 */
const MATCH_COUNT = CANDIDATE_COUNT * 3;

/** The load of this session. A failed load leaves it, so the next call tries again. */
let templates: Promise<PreparedTemplate[]> | null = null;

async function fetchTemplates(): Promise<PreparedTemplate[]> {
  const response = await fetch('/handwriting/templates.json');
  if (!response.ok) throw new Error(`Handwriting templates: HTTP ${response.status}`);
  const file = (await response.json()) as TemplateFile;
  return prepareTemplates(parseTemplates(file));
}

/** Load the templates. The pad calls this when it opens. */
export function loadTemplates(): Promise<PreparedTemplate[]> {
  if (!templates) {
    templates = fetchTemplates();
    templates.catch(() => {
      templates = null;
    });
  }
  return templates;
}

/** The candidates for the strokes so far, best first, at most CANDIDATE_COUNT. */
export async function candidatesFor(strokes: Stroke[]): Promise<string[]> {
  if (strokes.length === 0) return [];
  return orderCandidates(match(strokes, await loadTemplates(), MATCH_COUNT));
}
