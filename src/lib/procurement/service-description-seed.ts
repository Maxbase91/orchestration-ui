// Turning a service description into the starting point for downstream work.
//
// The description is the most carefully captured artefact the front door
// produces — a conversation, an LLM pass and a quality score — and until now it
// reached exactly two screens. A sourcing event raised from the very request
// that produced it started from `requirements: []` and `criteria: []`, so the
// buyer retyped what the requester had already been asked.
//
// Pure and DB-free so both the request page and the New Event wizard can seed
// from the same rule, and so it is testable without a database.

import type {
  ConfiguredSection,
  ServiceDescriptionTemplate,
} from './service-description-config';

/** The sections of a stored service description, by id. */
export type SectionValues = Record<string, string | undefined>;

/**
 * Narrow a stored service-description record to its TEXT sections.
 *
 * A record carries more than prose: a quality score (number), quality checks
 * and required sections (arrays), signals and capture flags (objects). Callers
 * used to cast the whole record to `SectionValues` and walk it — a cast that
 * TypeScript accepts and the runtime does not. The first non-string value hit
 * `value?.trim()` and threw "trim is not a function", taking down the request
 * detail whenever a workflow step with a pre-populated form was opened.
 *
 * Use this at the boundary instead of casting.
 */
export function sectionValuesOf(record: object | null | undefined): SectionValues {
  // `object` rather than `Record<string, unknown>`: an interface without an
  // index signature is not assignable to the latter, and these callers all pass
  // one. Nothing here needs the index signature — Object.entries works on any
  // object, and every value is type-checked on the way out.
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/**
 * Seed a sourcing event's requirements from the description.
 *
 * Each nominated section becomes one labelled requirement, which is the shape
 * `sourcing_events.requirements` already stores (`string[]`) and the New Event
 * wizard already renders. An empty section contributes nothing rather than an
 * empty bullet — a requirement a supplier cannot respond to is worse than one
 * fewer requirement.
 */
export function seedRequirementsFromDescription(
  sections: SectionValues,
  template: Pick<ServiceDescriptionTemplate, 'sourcingRequirementSections' | 'sections'>,
): string[] {
  const labelFor = (id: string) =>
    template.sections.find((s: ConfiguredSection) => s.id === id)?.label ?? id;

  return template.sourcingRequirementSections
    .map((id) => {
      const body = sections[id]?.trim();
      return body ? `${labelFor(id)}: ${body}` : null;
    })
    .filter((r): r is string => r !== null);
}

/**
 * Seed a sourcing event's evaluation criteria.
 *
 * Returned as-is from config rather than derived from the description: what a
 * bid is scored against is a procurement policy decision, not something the
 * requester's answers should determine. The weights must total 100 or the
 * wizard blocks publishing, so a template configured otherwise is reported
 * rather than silently shipped.
 */
export function seedCriteriaFromTemplate(
  template: Pick<ServiceDescriptionTemplate, 'defaultCriteria'>,
): { criteria: { id: string; label: string; weight: number }[]; weightsValid: boolean } {
  const criteria = template.defaultCriteria.map((c) => ({ ...c }));
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  return { criteria, weightsValid: total === 100 };
}

/**
 * The description fields a risk form pre-populates from.
 *
 * Keyed by the `prePopulateFrom` token an admin picks in the Form Builder, so a
 * risk form triggered on the risk stage can start from what was already
 * captured instead of asking the same thing twice.
 */
export function sowPrePopulateValues(
  sections: SectionValues,
  narrative: string | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(sections)) {
    // Type-checked rather than trusted: `SectionValues` promises strings, but
    // this is exported and callers have passed wider objects.
    if (typeof value === 'string' && value.trim()) out[`sow.${id}`] = value.trim();
  }
  if (typeof narrative === 'string' && narrative.trim()) out['sow.narrative'] = narrative.trim();
  return out;
}
