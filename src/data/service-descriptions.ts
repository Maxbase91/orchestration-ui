// Seed data only — not read by the runtime app.
// Service descriptions moved to Supabase in Wave 1.

export interface ServiceDescriptionRecord {
  requestId: string;
  objective: string;
  scope: string;
  deliverables: string;
  timeline: string;
  resources: string;
  acceptanceCriteria: string;
  pricingModel: string;
  location: string;
  dependencies: string;
  narrative: string;
}

export const serviceDescriptions: ServiceDescriptionRecord[] = [
  {
    requestId: 'REQ-2024-0001',
    objective: 'Migrate on-premise infrastructure to AWS cloud to reduce operational costs and improve scalability for the digital transformation programme.',
    scope: 'In scope: assessment of current infrastructure, migration planning, execution of migration for 45 workloads, post-migration validation. Out of scope: application refactoring, end-user training.',
    deliverables: '1) Infrastructure assessment report, 2) Migration strategy and roadmap, 3) Migration execution for all workloads, 4) Post-migration validation report, 5) Operational runbook for cloud management.',
    timeline: '6 months: Discovery (weeks 1-4), Planning (weeks 5-8), Migration waves 1-3 (weeks 9-20), Validation and handover (weeks 21-24).',
    resources: 'AWS Certified Solutions Architect (lead), 2 Cloud Engineers, DevOps specialist, Project Manager. Client-side: IT Operations team availability for knowledge transfer.',
    acceptanceCriteria: 'All 45 workloads migrated and operational. Zero data loss. Performance baseline met or exceeded. Operational runbook accepted by IT Operations team.',
    pricingModel: 'Fixed price for discovery and planning phases. T&M for migration execution with monthly cap. AWS infrastructure costs passed through at cost.',
    location: 'Hybrid — on-site at Berlin HQ for discovery workshops, remote for migration execution.',
    dependencies: 'Access to current infrastructure documentation. Maintenance windows for migration. AWS account provisioned with required permissions.',
    narrative: 'The organisation requires cloud migration services to transition 45 on-premise workloads to AWS as part of the digital transformation programme. The engagement covers end-to-end migration including infrastructure assessment, strategy development, phased execution, and post-migration validation.\n\nThe selected provider will deliver a comprehensive infrastructure assessment, migration roadmap, execute three migration waves over 24 weeks, and produce operational documentation for ongoing cloud management. The team will comprise an AWS Certified Solutions Architect, Cloud Engineers, and a DevOps specialist working in a hybrid model.\n\nSuccess will be measured by complete migration with zero data loss and performance parity. The engagement follows a fixed-price model for planning with T&M for execution, ensuring flexibility while maintaining cost control.',
  },
  {
    requestId: 'REQ-2024-0002',
    objective: 'Renew and optimise the SAP S/4HANA enterprise license agreement to support expanded business operations and achieve volume discount savings.',
    scope: 'In scope: license audit, usage optimisation analysis, contract renegotiation, volume discount negotiation. Out of scope: system implementation, user training, customisation.',
    deliverables: '1) License utilisation audit report, 2) Optimisation recommendations, 3) Negotiated license agreement, 4) Cost comparison analysis (current vs proposed).',
    timeline: '8 weeks: License audit (weeks 1-3), Optimisation analysis (weeks 4-5), Negotiation (weeks 6-7), Contract execution (week 8).',
    resources: 'SAP Licensing specialist, Commercial negotiator, Finance analyst for cost modelling.',
    acceptanceCriteria: 'Minimum 5% cost reduction achieved. All required licenses covered. Agreement term aligned with business planning cycle.',
    pricingModel: 'Annual subscription with volume discount tiers. 3-year commitment for maximum discount.',
    location: 'Remote with on-site meetings for negotiation sessions.',
    dependencies: 'Access to current SAP license metrics. Finance team availability for budget approval. SAP account manager engagement.',
    narrative: 'This engagement covers the renewal and optimisation of the SAP S/4HANA enterprise license agreement. The primary objective is to achieve cost savings through volume discount negotiation while ensuring license coverage supports the organisation\'s expanded operations.\n\nThe provider will conduct a thorough license utilisation audit, identify optimisation opportunities, and lead commercial negotiations with SAP. Deliverables include an audit report, cost comparison analysis, and an executed license agreement with improved terms.\n\nThe 8-week engagement targets a minimum 5% cost reduction through a 3-year commitment structure, balancing long-term savings with operational flexibility.',
  },
  {
    requestId: 'REQ-2024-0004',
    objective: 'Develop and execute an integrated marketing campaign strategy for Q3-Q4 to increase brand awareness and generate qualified leads in the DACH region.',
    scope: 'In scope: campaign strategy, creative development, media planning and buying, performance tracking. Out of scope: website redesign, CRM implementation, sales enablement.',
    deliverables: '1) Campaign strategy document, 2) Creative assets (digital and print), 3) Media plan with budget allocation, 4) Monthly performance reports, 5) End-of-campaign effectiveness report.',
    timeline: '6 months: Strategy (month 1), Creative development (month 2), Campaign launch and execution (months 3-5), Reporting and optimisation (month 6).',
    resources: 'Senior Account Director, Creative Director, Media Planner, Digital Marketing Specialist, Analytics Manager.',
    acceptanceCriteria: '15% increase in brand awareness (measured by survey). 500 marketing qualified leads generated. Campaign ROI exceeding 3:1.',
    pricingModel: 'Retainer fee for agency services. Media spend managed on pass-through basis with 5% management fee.',
    location: 'Remote with monthly in-person review meetings at client office.',
    dependencies: 'Brand guidelines and approved messaging. Marketing budget confirmed. Access to analytics platforms.',
    narrative: 'The organisation seeks a marketing agency partner to develop and execute an integrated campaign strategy targeting the DACH region for Q3-Q4. The engagement covers full-service campaign delivery from strategy through execution and measurement.\n\nThe agency will provide a dedicated team including a Senior Account Director, Creative Director, and specialists in media planning and digital marketing. Deliverables span strategy documentation, creative asset production, media planning and buying, and comprehensive performance reporting.\n\nSuccess metrics include a 15% increase in brand awareness, generation of 500 qualified leads, and a campaign ROI exceeding 3:1. The engagement operates on a retainer model with media costs managed on a pass-through basis.',
  },
  {
    requestId: 'REQ-2024-0005',
    objective: 'Engage data engineering and analytics contractors to build the enterprise data lakehouse platform on Databricks, supporting the data-driven decision making initiative.',
    scope: 'In scope: data lakehouse architecture design, ETL pipeline development, dashboard creation, data governance setup. Out of scope: source system modifications, end-user analytics training.',
    deliverables: '1) Lakehouse architecture design document, 2) ETL pipelines for 12 data sources, 3) 8 executive dashboards, 4) Data governance framework, 5) Technical documentation and handover.',
    timeline: '9 months: Architecture (months 1-2), Pipeline development (months 3-6), Dashboard development (months 7-8), Governance and handover (month 9).',
    resources: '2 Senior Data Engineers, 1 Analytics Engineer, 1 Data Architect, Project Manager. All with Databricks certification preferred.',
    acceptanceCriteria: 'All 12 data sources integrated. Dashboards operational with <30 second refresh time. Data governance policies implemented and documented.',
    pricingModel: 'T&M with monthly invoicing. Rate card applied per role. Volume discount for 9-month commitment.',
    location: 'Hybrid — 3 days remote, 2 days on-site at Berlin HQ per week.',
    dependencies: 'Databricks workspace provisioned. Access to source systems granted. Data stewards identified for governance workstream.',
    narrative: 'The organisation requires specialist data engineering and analytics resources to build an enterprise data lakehouse platform on Databricks. This initiative is a cornerstone of the data-driven decision making strategy, consolidating 12 data sources into a unified analytics platform.\n\nThe engagement comprises a team of Senior Data Engineers, an Analytics Engineer, and a Data Architect working over 9 months to deliver architecture design, ETL pipeline development, executive dashboards, and a data governance framework.\n\nThe team will work in a hybrid model with deliverables measured against specific quality criteria including data source integration completeness and dashboard performance benchmarks. Pricing follows a T&M model with volume discounts for the full engagement duration.',
  },
  {
    requestId: 'REQ-2024-0009',
    objective: 'Conduct a comprehensive cybersecurity audit to identify vulnerabilities, assess risk posture, and provide remediation recommendations aligned with ISO 27001 standards.',
    scope: 'In scope: network security assessment, application security testing, access control review, incident response evaluation. Out of scope: remediation implementation, ongoing monitoring setup.',
    deliverables: '1) Vulnerability assessment report, 2) Penetration testing results, 3) Risk assessment matrix, 4) Remediation roadmap with prioritisation, 5) Executive summary presentation.',
    timeline: '8 weeks: Scoping (week 1), Assessment (weeks 2-5), Analysis and reporting (weeks 6-7), Executive presentation (week 8).',
    resources: 'Lead Security Consultant (CISSP), Penetration Tester (OSCP), Security Analyst, GRC Specialist.',
    acceptanceCriteria: 'All critical and high-severity findings documented with remediation guidance. Report accepted by CISO. Findings mapped to ISO 27001 controls.',
    pricingModel: 'Fixed price for defined scope. Additional testing (if required) priced separately.',
    location: 'On-site for network assessment, remote for analysis and reporting.',
    dependencies: 'Network access credentials provided. Testing windows agreed. Legal authorisation for penetration testing signed.',
    narrative: 'A comprehensive cybersecurity audit engagement to assess the organisation\'s security posture against ISO 27001 standards. The audit covers network security, application testing, access controls, and incident response capabilities.\n\nA specialist team including CISSP and OSCP certified professionals will conduct vulnerability assessments and penetration testing over 8 weeks, producing a detailed risk assessment matrix and prioritised remediation roadmap.\n\nAll findings will be mapped to ISO 27001 controls with clear remediation guidance. The fixed-price engagement requires on-site access for network assessment phases with legal authorisation for penetration testing.',
  },
];

export function getServiceDescription(requestId: string): ServiceDescriptionRecord | undefined {
  return serviceDescriptions.find((sd) => sd.requestId === requestId);
}
