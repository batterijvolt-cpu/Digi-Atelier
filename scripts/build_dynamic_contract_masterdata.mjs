#!/usr/bin/env node
import fs from 'node:fs/promises';

const OUT_DIR = '/home/klaas/.openclaw/workspace/data/master/contracts/curated';
const WEB_DIR = '/home/klaas/.openclaw/workspace/website/projects/masterdata';

const suppliers = [
  { name: 'Alix bv', electricity: true },
  { name: 'Aspiravi Energy nv', electricity: true },
  { name: 'Axpo Benelux nv', electricity: true },
  { name: 'Belgian Eco Energy nv', electricity: true },
  { name: 'Belvus bv', electricity: true },
  { name: 'Bolt Energie bv', electricity: true },
  { name: 'Codel bv', electricity: false },
  { name: 'Dats 24 nv', electricity: true },
  { name: 'Dots Energy bv', electricity: true },
  { name: 'Ecofix Gas & Power bv', electricity: true },
  { name: 'Ecopower cv', electricity: true },
  { name: 'Electrabel nv (ENGIE Electrabel)', electricity: true },
  { name: 'Elegant bv', electricity: true },
  { name: 'Elektriciteitsbedrijf Merksplas bv', electricity: true },
  { name: 'Elexys nv', electricity: true },
  { name: 'Elindus nv/bv', electricity: true },
  { name: 'Eneco Belgium nv', electricity: true },
  { name: 'Energie.be nv', electricity: true },
  { name: 'EnergyVision nv', electricity: true },
  { name: 'Energy Knights bv', electricity: true },
  { name: 'Energy Together bv', electricity: true },
  { name: 'Eni S.p.A.', electricity: false },
  { name: 'Enwyse Belgium bv', electricity: true },
  { name: 'Frank Energie België bv', electricity: true },
  { name: 'GETEC Energie GmbH', electricity: true },
  { name: 'Luminus nv', electricity: true },
  { name: 'OCTA+ Energie nv', electricity: true },
  { name: 'Power Online nv (Mega)', electricity: true },
  { name: 'RWE Supply & Trading GmbH', electricity: true },
  { name: 'Scholt Energy nv', electricity: true },
  { name: 'SEFE Energy GmbH', electricity: false },
  { name: 'TotalEnergies Gas & Power Western Europe nv', electricity: true },
  { name: 'TotalEnergies Gas & Power Limited', electricity: true },
  { name: 'TotalEnergies Power & Gas Belgium nv', electricity: true },
  { name: 'Trevion nv', electricity: true },
  { name: 'Ukko Energy nv', electricity: true },
  { name: 'Vlaams Energiebedrijf nv', electricity: true },
  { name: 'Wase Wind cv', electricity: true },
  { name: 'Yuso bv', electricity: true }
].sort((a,b)=>a.name.localeCompare(b.name,'nl'));

const components = [
  'Energieprijs gekoppeld aan marktindex of kwartierprijs',
  'Indexatie-/afrekenfrequentie (maandelijks of kwartier)',
  'Vaste jaarlijkse vergoeding (abonnement)',
  'Nettarieven (distributie + transmissie)',
  'Capaciteitstariefcomponent in nettarief',
  'Heffingen en toeslagen',
  'BTW',
  'Meterregime: enkel of dag/nacht (bij variabel); digitale meter vereist voor dynamisch'
];

const matrix = {};
for (const c of components) {
  matrix[c] = Object.fromEntries(suppliers.map(s => [s.name, s.electricity ? 'JA*' : 'n.v.t. (geen elektriciteitsvergunning)']));
}

const payload = {
  dataset: 'dynamic_contract_tariff_matrix_vlaanderen',
  updated_at_utc: new Date().toISOString(),
  scope: 'Vlaanderen - leveranciers met leveringsvergunning (snapshot VNR)',
  source: {
    name: 'Vlaamse Nutsregulator (VNR) + marktpraktijk leveranciersfiches',
    url: 'https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/energiecontracten-en-leveranciers/overzicht-energieleveranciers-met-leveringsvergunning',
    note: 'Deze matrix geeft het factuurmodel voor dynamische/variabele elektriciteitscontracten. Commerciële beschikbaarheid per leverancier kan afwijken.'
  },
  legend: {
    'JA*': 'Onderdeel van het dynamische/variabele contractmodel voor elektriciteit.',
    'n.v.t.': 'Niet van toepassing voor elektriciteit (geen elektriciteitsvergunning in snapshot).'
  },
  suppliers,
  components,
  matrix
};

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.mkdir(WEB_DIR, { recursive: true });

await fs.writeFile(`${OUT_DIR}/dynamic_contract_tariff_matrix_vlaanderen.json`, JSON.stringify(payload, null, 2));
await fs.writeFile(`${WEB_DIR}/dynamic-contract-tariff-matrix-vlaanderen.json`, JSON.stringify(payload, null, 2));

console.log(JSON.stringify({ ok: true, suppliers: suppliers.length, components: components.length }, null, 2));
