import { initializeDatabase, getDb } from './services/database.service.js';

const projects = [
  { name: 'Admin & Orga', rate: '', color: '#6366f1' },
  { name: 'KI-Coding Training', rate: '', color: '#8b5cf6' },
  { name: 'Erweiterung des Zeugnisgenerators', rate: 'AIP-54', color: '#a855f7' },
  { name: 'Vorlage für Confluence - Selbstpräsentation', rate: 'AIP-9', color: '#d946ef' },
  { name: 'Personas für Homepage', rate: 'AIP-44', color: '#ec4899' },
  { name: 'Internes RAG', rate: 'AIP-7', color: '#f43f5e' },
  { name: 'Schulung: Management-Kommunikation', rate: 'AIP-33', color: '#ef4444' },
  { name: 'Schulung: GenAI-Basics für anwendende Berater', rate: 'AIP-50', color: '#f97316' },
  { name: 'Automatisierter Zugriff auf Kundenauftragsdaten aus Collmex', rate: 'AIP-52', color: '#f59e0b' },
  { name: 'Weiterentwicklung und Wissensverankerung CokeConverter', rate: 'AIP-49', color: '#eab308' },
  { name: 'genAI-Fitness für atra.consulting – Kompetenzaufbau und Positionierung', rate: 'AIP-57', color: '#84cc16' },
  { name: 'Automatisierte Standardisierung von Beraterprofilen ("Profilgenerator")', rate: 'AIP-47', color: '#22c55e' },
  { name: 'Zeugnisgenerator 1.0', rate: 'AIP-6', color: '#10b981' },
  { name: 'IT-Basic-Schulung', rate: 'AIP-8', color: '#14b8a6' },
  { name: 'Unsere Positionierung als atra.consulting', rate: 'AIP-42', color: '#06b6d4' },
  { name: 'Schnittstelle DATEV - Collmex für Gehaltsbuchungen', rate: 'AIP-48', color: '#0ea5e9' },
  { name: 'Positionierung zur Barrierefreiheit', rate: 'AIP-10', color: '#3b82f6' },
  { name: 'Homepage 3.0', rate: 'AIP-1', color: '#2563eb' },
  { name: 'Einführung Wiki und Aufgaben-Management', rate: '', color: '#4f46e5' },
  { name: 'Vertrieb', rate: '', color: '#7c3aed' },
  { name: 'Projektbegleitung für die KI Werkstatt', rate: '', color: '#0d9488' },
  { name: 'PoC VERA (Justizministerium BW)', rate: '', color: '#059669' },
  { name: 'Allianz: Tribe NOVA Leben/FirmenOnline Los 3', rate: '', color: '#b45309' },
];

async function seed() {
  await initializeDatabase();
  const db = await getDb();

  // Clear existing projects and recurring mappings
  await db.query('DELETE FROM recurring_project_mappings');
  await db.query('DELETE FROM projects');

  console.log('Cleared existing projects and mappings.');

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    await db.query(
      `INSERT INTO projects (name, rate, color, archived, "order")
       VALUES ($1, $2, $3, false, $4)`,
      [p.name, p.rate, p.color, i]
    );
    console.log(`  + ${p.name}${p.rate ? ` / ${p.rate}` : ''}`);
  }

  console.log(`\nDone. ${projects.length} projects inserted.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
