// Experience-mode contract: presentation density is role-aware and never an authorization boundary.
import { canUseSimpleExperience, defaultExperienceMode, normalizeExperienceMode } from '../../src/lib/experience-mode.ts';

const checks = [];
function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

check('requesters default to simple', defaultExperienceMode('service-owner') === 'simple');
check('operational roles default to expert', defaultExperienceMode('procurement-manager') === 'expert');
check('invalid preferences are ignored', normalizeExperienceMode('dense') === undefined);
check('valid simple preference is accepted', normalizeExperienceMode('simple') === 'simple');
check('valid expert preference is accepted', normalizeExperienceMode('expert') === 'expert');
check('simple pilot is available with no allowlist', canUseSimpleExperience('user-1', 'service-owner'));

const failed = checks.filter((item) => !item.condition);
for (const item of checks) console.log(`${item.condition ? 'PASS' : 'FAIL'} ${item.name}`);
if (failed.length > 0) process.exit(1);
console.log(`Experience mode checks passed (${checks.length})`);
