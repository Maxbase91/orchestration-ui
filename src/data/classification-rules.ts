export const classificationRules = {
  catalogue: {
    description: "Pre-approved items available for direct ordering. No sourcing or additional approval needed. Fast track 2-3 days.",
    examples: [
      "Office supplies: paper, pens, toner, folders, sticky notes, binder clips, whiteboard markers, desk organizers",
      "IT peripherals: keyboards, mice, headsets, webcams, cables, USB hubs, monitor arms, docking stations",
      "Standard monitors under €500",
      "Catering & pantry: coffee, tea, water, cups, snack boxes",
      "Safety equipment: gloves, hard hats, vests, first aid kits, safety glasses",
      "Print & stationery: business cards, envelopes, letterheads, stamps, laminating pouches",
      "Standard furniture under €500: desk organizers, monitor arms, small shelving",
      "Standard laptops (e.g. ThinkPad T14) when no custom configuration needed",
    ],
    threshold: "Individual items under €500, total order under €5,000",
    notCatalogue: "Custom specifications, bulk orders >€5K, items requiring IT configuration, bespoke furniture",
  },
  goods: {
    description: "Physical products requiring a formal procurement process. Not available in catalogue or above catalogue thresholds.",
    examples: [
      "Bulk laptop orders (>5 units or requiring custom configuration)",
      "Servers, workstations, networking equipment",
      "Custom furniture: standing desks, ergonomic chairs, bulk office fit-outs",
      "Industrial equipment: sensors, IoT devices, machinery, tools",
      "Vehicles, warehouse racking, large equipment",
      "Specialized lab or medical equipment",
    ],
    threshold: "Items >€500 per unit, requiring specification, custom configuration, or bulk orders",
    buyingChannel: "Under €25K: business-led. €25K-€100K: procurement-led. >€100K: procurement-led + VP approval",
  },
  services: {
    description: "Ongoing operational services delivered by external providers. NOT one-off advisory work.",
    examples: [
      "Facilities management: cleaning, maintenance, security, reception",
      "Catering services: contract catering, event catering",
      "Travel management, fleet management",
      "Managed print services, document management",
      "Waste management, energy management, recycling",
      "Training and professional development programmes",
      "Logistics, warehousing, distribution services",
    ],
    notServices: "One-off advisory or strategy work = consulting. Staff augmentation = contingent labour.",
  },
  software: {
    description: "Software licences, SaaS subscriptions, cloud services, and IT platforms.",
    examples: [
      "SaaS platforms: Salesforce, SAP, ServiceNow, Databricks, Workday",
      "Cloud infrastructure: AWS, Azure, GCP hosting and compute",
      "Software licences: Microsoft 365, Adobe Creative Suite, Atlassian",
      "Development tools, databases, API platforms, middleware",
      "Cybersecurity tools, SIEM, monitoring platforms",
      "Data analytics and BI platforms",
    ],
    notSoftware: "IT consulting or system implementation services = consulting. Hardware = goods.",
  },
  consulting: {
    description: "Professional advisory, strategy, and project-based intellectual services. The provider brings their own methodology and expertise.",
    examples: [
      "Management consulting: strategy, transformation, operating model design",
      "IT consulting: system implementation, architecture review, digital transformation",
      "Business consulting: process improvement, change management, organizational design",
      "Financial advisory: audit support, due diligence, tax advisory, transfer pricing",
      "Legal advisory: regulatory, compliance, M&A support",
      "Market research, benchmarking studies, competitive analysis",
      "ESG advisory, sustainability consulting",
    ],
    notConsulting: "Ongoing managed services = services. Staff working under your direction = contingent labour.",
  },
  'contingent-labour': {
    description: "Temporary workers, contractors, or freelancers working under the company's direction and management.",
    examples: [
      "IT contractors: developers, architects, testers, project managers",
      "Interim managers, acting roles covering leave or vacancy",
      "Administrative temps, reception cover, data entry",
      "Seasonal workers, event staff, warehouse operatives",
    ],
    notContingentLabour: "Consulting firms delivering a project with their own methodology = consulting.",
  },
  'contract-renewal': {
    description: "Extending or renewing an existing supplier contract that is expiring or has expired.",
    examples: [
      "Renewing a supplier agreement",
      "Extending a contract term for another year",
      "Renegotiating contract terms and pricing",
      "Annual contract renewal process",
    ],
  },
  'supplier-onboarding': {
    description: "Registering and qualifying a new supplier/vendor that is not yet in the system.",
    examples: [
      "Adding a new vendor to the approved supplier list",
      "Onboarding a supplier for the first time",
      "Registering a new service provider or consultant firm",
    ],
  },
};

// Formatted for LLM prompt inclusion
export function getClassificationPrompt(): string {
  const lines: string[] = ['PROCUREMENT CATEGORY CLASSIFICATION RULES:\n'];

  for (const [key, rule] of Object.entries(classificationRules)) {
    lines.push(`## ${key.toUpperCase()}`);
    lines.push(rule.description);
    lines.push('Examples: ' + rule.examples.join('; '));
    if ('threshold' in rule && rule.threshold) lines.push('Threshold: ' + rule.threshold);
    if ('notCatalogue' in rule && rule.notCatalogue) lines.push('NOT this category: ' + rule.notCatalogue);
    if ('notServices' in rule && rule.notServices) lines.push('NOT this category: ' + rule.notServices);
    if ('notSoftware' in rule && rule.notSoftware) lines.push('NOT this category: ' + rule.notSoftware);
    if ('notConsulting' in rule && rule.notConsulting) lines.push('NOT this category: ' + rule.notConsulting);
    if ('notContingentLabour' in rule && rule.notContingentLabour) lines.push('NOT this category: ' + rule.notContingentLabour);
    if ('buyingChannel' in rule && rule.buyingChannel) lines.push('Buying channel: ' + rule.buyingChannel);
    lines.push('');
  }

  lines.push('KEY DISTINCTIONS:');
  lines.push('- "business consulting" = CONSULTING (not goods)');
  lines.push('- "IT consulting" = CONSULTING (not software)');
  lines.push('- "I need a laptop" = CATALOGUE (standard ThinkPad available)');
  lines.push('- "50 custom laptops" = GOODS (bulk/custom)');
  lines.push('- "office supplies" = CATALOGUE');
  lines.push('- "cleaning service" = SERVICES');
  lines.push('- "SAP license" = SOFTWARE');
  lines.push('- "temp developer" = CONTINGENT-LABOUR');

  return lines.join('\n');
}
