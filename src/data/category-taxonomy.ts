// Canonical default category taxonomy — the single source of truth for the
// out-of-the-box demand categories. The data-driven path (the
// `procurement_categories` store, edited in Admin → Categories) overrides this
// at runtime; this module is the fallback and the seed.
//
// Standardised / white-label: these are generic procurement categories with no
// organisation- or industry-specific framing. A deployment can replace the set
// entirely through Admin without code changes.
//
// PURE DATA — no runtime imports, so the server-side seed can import this.
//
// The order (sortOrder) is the classifier's precedence: consulting outranks the
// broad services bucket, goods comes last because it is the default.

import type { ProcurementCategory } from '../lib/db/procurement-categories.js';

/**
 * Canonical default taxonomy, in display order.
 *
 * `catalogueEligible` says whether demand in the category can be fulfilled from
 * the catalogue — only `catalogue` and `goods` can. It gates the intake funnel's
 * catalogue stage, so a consulting or services demand is never offered a
 * catalogue item (see `lib/procurement/intake-routing.ts`).
 */
// `supplierTags` were a hard-coded map in the supplier recommender, and
// `commodityCodes` / `defaultCode` two tables in lib/procurement/category-code.ts;
// both are seeded here with the same values and edited in /admin/categories.
export const DEFAULT_CATEGORY_TAXONOMY: ProcurementCategory[] = [
  { id: 'catalogue', label: "Catalogue Purchase", description: "Standard items ordered from the catalogue — office supplies, peripherals, stationery. A catalogue order is placed from a real catalogue item; this category marks the demand as catalogue-type.", sortOrder: 5, keywords: ["paper", "pens", "ballpoint", "toner", "cable", "headset", "mouse", "mice", "keyboard", "office supplies", "stationery"], active: true, catalogueEligible: true, supplierTags: [],
    commodityCodes: [],
    defaultCode: { code: '44120000', label: 'Office supplies and stationery' } },
  { id: 'goods', label: "Goods", description: "Physical products: hardware, equipment, furniture, raw materials, branded merchandise. Outcome = a physical item.", sortOrder: 6, keywords: ["hardware", "equipment", "laptop", "computer", "workstation", "monitor", "furniture", "desk", "chair", "sensor", "network switch", "router", "shelving", "racking"], active: true, catalogueEligible: true, supplierTags: ['Hardware', 'Equipment', 'Goods'],
    commodityCodes: [
      { code: '43211500', label: 'Laptop computers', keywords: ['laptop', 'computer', 'workstation', 'pc'] },
      { code: '56101500', label: 'Office furniture', keywords: ['furniture', 'desk', 'chair', 'table'] },
      { code: '41113600', label: 'Industrial sensors', keywords: ['sensor', 'iot', 'industrial'] },
      { code: '43222600', label: 'Network switches', keywords: ['network', 'switch', 'router', 'cisco'] },
      { code: '24102000', label: 'Industrial shelving and racking', keywords: ['warehouse', 'racking', 'storage', 'shelving'] },
    ],
    defaultCode: { code: '31160000', label: 'General hardware and goods' } },
  { id: 'services', label: "Services", description: "Ongoing operational service delivery: cleaning, catering, facilities management, security, translation, travel management, HR admin, managed print, maintenance, payroll. Outcome = recurring output from a service provider.", sortOrder: 2, keywords: ["service", "cleaning", "catering", "maintenance", "travel", "translation", "managed print", "managed service", "facilities", "security guard", "payroll", "hr admin", "helpdesk"], active: true, catalogueEligible: false, supplierTags: ['Services', 'Facilities', 'Marketing'],
    commodityCodes: [
      { code: '81111800', label: 'Information security', keywords: ['security', 'audit', 'penetration', 'cyber'] },
      { code: '80141600', label: 'Marketing campaign management', keywords: ['marketing', 'campaign', 'brand', 'advertising'] },
      { code: '90101600', label: 'Catering services', keywords: ['catering', 'food', 'meal', 'canteen'] },
      { code: '76111500', label: 'Cleaning services', keywords: ['cleaning', 'janitorial', 'housekeeping'] },
      { code: '44103100', label: 'Managed print services', keywords: ['print', 'printer', 'copier', 'scan'] },
      { code: '90121500', label: 'Travel management services', keywords: ['travel', 'flight', 'hotel', 'booking'] },
      { code: '84131500', label: 'Insurance services', keywords: ['insurance', 'policy', 'coverage', 'indemnity'] },
      { code: '82121500', label: 'Translation services', keywords: ['translation', 'localisation', 'language'] },
      { code: '80131500', label: 'Facilities management', keywords: ['facility', 'building', 'maintenance'] },
      { code: '83101800', label: 'Renewable energy services', keywords: ['energy', 'renewable', 'solar', 'wind'] },
      { code: '80141800', label: 'Event management', keywords: ['event', 'venue', 'conference', 'summit'] },
      { code: '80161500', label: 'Records management', keywords: ['records', 'archive', 'document', 'storage'] },
    ],
    defaultCode: { code: '80100000', label: 'Business and professional services' } },
  { id: 'software', label: "Software / IT", description: "Software licences, SaaS and PaaS, cloud platforms, subscriptions, APIs and IT tools. Outcome = access or capability, delivered digitally.", sortOrder: 3, keywords: ["software", "saas", "licence", "license", "cloud", "platform", "subscription", "apps", "mobile app", "web app", "application"], active: true, catalogueEligible: false, supplierTags: ['Software', 'Cloud', 'SaaS', 'Licensing'],
    commodityCodes: [
      { code: '81112200', label: 'Cloud computing services', keywords: ['cloud', 'hosting', 'aws', 'azure'] },
      { code: '43231500', label: 'Enterprise application software', keywords: ['sap', 'erp', 'enterprise software'] },
      { code: '43232100', label: 'Data analytics platforms', keywords: ['data', 'analytics', 'ml', 'ai', 'databricks'] },
      { code: '43231500', label: 'CRM software', keywords: ['crm', 'salesforce', 'customer'] },
      { code: '43232300', label: 'Integration middleware', keywords: ['integration', 'middleware', 'api'] },
    ],
    defaultCode: { code: '43230000', label: 'Software' } },
  { id: 'consulting', label: "Consulting", description: "Advisory and project work: strategy, target operating model, transformation, organisational design, change and programme management, business cases, assessments, audits, due diligence, feasibility studies. Outcome = recommendations, a design or a roadmap from consultants.", sortOrder: 1, keywords: ["consult", "advisory", "strategy", "audit", "transformation", "operating model", "organisational", "organizational", "change management", "programme management", "program management", "due diligence", "feasibility", "business case", "maturity assessment", "roadmap", "target state"], active: true, catalogueEligible: false, supplierTags: ['Consulting', 'Advisory', 'Strategy', 'Transformation'],
    commodityCodes: [
      { code: '80101600', label: 'Management consulting', keywords: ['consulting', 'advisory', 'strategy'] },
      { code: '84111500', label: 'Tax advisory services', keywords: ['tax', 'accounting', 'transfer pricing'] },
    ],
    defaultCode: { code: '80101600', label: 'Management consulting' } },
  { id: 'contingent-labour', label: "Contingent Labour", description: "Temporary staff, contractors, developers for hire, interim roles and IT staffing, working under your direction. Outcome = headcount or capacity.", sortOrder: 4, keywords: ["temporary", "temps", "temp staff", "contractor", "staff", "developer", "freelance", "hire", "interim"], active: true, catalogueEligible: false, supplierTags: ['Contingent Labour', 'Staffing', 'Recruitment'],
    commodityCodes: [
      { code: '80111600', label: 'Temporary IT staffing', keywords: ['temp', 'contractor', 'staffing', 'contingent'] },
    ],
    defaultCode: { code: '80111600', label: 'Temporary staffing services' } },
];
