import { initializeDatabase, getDb } from './services/database.service.js';

// Each entry: [name, rate, color]
// Same base project → same color
const projects: [string, string, string][] = [
  // Admin & Orga — 7 Sätze (alle gleiche Farbe)
  ['Admin & Orga', 'Intern (ohne Berechnung)', '#6366f1'],
  ['Admin & Orga', 'Reisezeit (ohne Berechnung)', '#6366f1'],
  ['Admin & Orga', 'Kundenbetreuung (ohne Berechnung)', '#6366f1'],
  ['Admin & Orga', 'Beraterbetreuung (ohne Berechnung)', '#6366f1'],
  ['Admin & Orga', 'Ausschreibungsprüfung (ohne Berechnung)', '#6366f1'],
  ['Admin & Orga', 'Ausschreibungsbearbeitung (ohne Berechnung)', '#6366f1'],
  ['Admin & Orga', 'Strategie & Leitung (ohne Berechnung)', '#6366f1'],

  // Einzelprojekte
  ['KI-Coding Training', '', '#8b5cf6'],
  ['Erweiterung des Zeugnisgenerators', 'AIP-54', '#a855f7'],
  ['Vorlage für Confluence - Selbstpräsentation', 'AIP-9', '#d946ef'],
  ['Personas für Homepage', 'AIP-44', '#ec4899'],
  ['Internes RAG', 'AIP-7', '#f43f5e'],
  ['Schulung: Management-Kommunikation', 'AIP-33', '#ef4444'],
  ['Schulung: GenAI-Basics für anwendende Berater', 'AIP-50', '#f97316'],
  ['Automatisierter Zugriff auf Kundenauftragsdaten aus Collmex', 'AIP-52', '#f59e0b'],
  ['Weiterentwicklung und Wissensverankerung CokeConverter', 'AIP-49', '#eab308'],
  ['genAI-Fitness für atra.consulting – Kompetenzaufbau und Positionierung', 'AIP-57', '#84cc16'],
  ['Automatisierte Standardisierung von Beraterprofilen ("Profilgenerator")', 'AIP-47', '#22c55e'],
  ['Zeugnisgenerator 1.0', 'AIP-6', '#10b981'],
  ['IT-Basic-Schulung', 'AIP-8', '#14b8a6'],
  ['Unsere Positionierung als atra.consulting', 'AIP-42', '#06b6d4'],
  ['Schnittstelle DATEV - Collmex für Gehaltsbuchungen', 'AIP-48', '#0ea5e9'],
  ['Positionierung zur Barrierefreiheit', 'AIP-10', '#3b82f6'],
  ['Homepage 3.0', 'AIP-1', '#2563eb'],
  ['Einführung Wiki und Aufgaben-Management', '', '#4f46e5'],
  ['Vertrieb', '', '#7c3aed'],
  ['Projektbegleitung für die KI Werkstatt', '', '#0d9488'],
  ['PoC VERA', '', '#059669'],
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
