import { initializeDatabase, getDb } from './services/database.service.js';

// Each entry: [name, rate, color]
// Same base project → same color
const projects: [string, string, string][] = [
  // Admin & Orga — 7 Sätze (Grüntöne)
  ['Admin & Orga', 'Intern', '#4ade80'],
  ['Admin & Orga', 'Reisezeit', '#22c55e'],
  ['Admin & Orga', 'Kundenbetreuung', '#16a34a'],
  ['Admin & Orga', 'Beraterbetreuung', '#15803d'],
  ['Admin & Orga', 'Ausschreibungsprüfung', '#10b981'],
  ['Admin & Orga', 'Ausschreibungsbearbeitung', '#059669'],
  ['Admin & Orga', 'Strategie & Leitung', '#047857'],

  // Einzelprojekte (jeweils individuelle Farbe)
  ['KI-Coding Training', '', '#8b5cf6'],
  ['Erweiterung des Zeugnisgenerators', 'AIP-54', '#d946ef'],
  ['Vorlage für Confluence - Selbstpräsentation', 'AIP-9', '#ec4899'],
  ['Personas für Homepage', 'AIP-44', '#f43f5e'],
  ['Internes RAG', 'AIP-7', '#ef4444'],
  ['Schulung: Management-Kommunikation', 'AIP-33', '#b91c1c'],
  ['Schulung: GenAI-Basics für anwendende Berater', 'AIP-50', '#f97316'],
  ['Automatisierter Zugriff auf Kundenauftragsdaten aus Collmex', 'AIP-52', '#f59e0b'],
  ['Weiterentwicklung und Wissensverankerung CokeConverter', 'AIP-49', '#eab308'],
  ['genAI-Fitness für atra.consulting – Kompetenzaufbau und Positionierung', 'AIP-57', '#84cc16'],
  ['Automatisierte Standardisierung von Beraterprofilen ("Profilgenerator")', 'AIP-47', '#06b6d4'],
  ['Zeugnisgenerator 1.0', 'AIP-6', '#0ea5e9'],
  ['IT-Basic-Schulung', 'AIP-8', '#3b82f6'],
  ['Unsere Positionierung als atra.consulting', 'AIP-42', '#14b8a6'],
  ['Schnittstelle DATEV - Collmex für Gehaltsbuchungen', 'AIP-48', '#6366f1'],
  ['Positionierung zur Barrierefreiheit', 'AIP-10', '#0f766e'],
  ['Homepage 3.0', 'AIP-1', '#1e3a5f'],
  ['Einführung Wiki und Aufgaben-Management', '', '#a855f7'],
  ['Vertrieb', '', '#92400e'],
  ['Projektbegleitung für die KI Werkstatt', '', '#7e22ce'],
  ['PoC VERA', '', '#0891b2'],
  ['Allianz: Tribe NOVA Leben/FirmenOnline Los 3', '', '#004A94'],
];

async function seed() {
  await initializeDatabase();
  const db = await getDb();

  // Clear existing projects and recurring mappings
  await db.query('DELETE FROM recurring_project_mappings');
  await db.query('DELETE FROM projects');

  console.log('Cleared existing projects and mappings.');

  for (let i = 0; i < projects.length; i++) {
    const [name, rate, color] = projects[i];
    await db.query(
      `INSERT INTO projects (name, rate, color, archived, "order")
       VALUES ($1, $2, $3, false, $4)`,
      [name, rate, color, i]
    );
    console.log(`  + ${name}${rate ? ` / ${rate}` : ''}`);
  }

  console.log(`\nDone. ${projects.length} projects inserted.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
