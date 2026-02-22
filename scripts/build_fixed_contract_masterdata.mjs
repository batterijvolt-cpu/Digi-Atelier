#!/usr/bin/env node
import fs from 'node:fs/promises';

const OUT_DIR = '/home/klaas/.openclaw/workspace/data/master/contracts/curated';
const WEB_DIR = '/home/klaas/.openclaw/workspace/website/projects/masterdata';

const suppliers = [
  { name: 'Alix bv', electricity: true, gas: false },
  { name: 'Aspiravi Energy nv', electricity: true, gas: false },
  { name: 'Axpo Benelux nv', electricity: true, gas: true },
  { name: 'Belgian Eco Energy nv', electricity: true, gas: true },
  { name: 'Belvus bv', electricity: true, gas: true },
  { name: 'Bolt Energie bv', electricity: true, gas: true },
  { name: 'Codel bv', electricity: false, gas: true },
  { name: 'Dats 24 nv', electricity: true, gas: true },
  { name: 'Dots Energy bv', electricity: true, gas: true },
  { name: 'Ecofix Gas & Power bv', electricity: true, gas: true },
  { name: 'Ecopower cv', electricity: true, gas: false },
  { name: 'Electrabel nv (ENGIE Electrabel)', electricity: true, gas: true },
  { name: 'Elegant bv', electricity: true, gas: true },
  { name: 'Elektriciteitsbedrijf Merksplas bv', electricity: true, gas: true },
  { name: 'Elexys nv', electricity: true, gas: true },
  { name: 'Elindus nv/bv', electricity: true, gas: true },
  { name: 'Eneco Belgium nv', electricity: true, gas: true },
  { name: 'Energie.be nv', electricity: true, gas: true },
  { name: 'EnergyVision nv', electricity: true, gas: true },
  { name: 'Energy Knights bv', electricity: true, gas: false },
  { name: 'Energy Together bv', electricity: true, gas: true },
  { name: 'Eni S.p.A.', electricity: false, gas: true },
  { name: 'Enwyse Belgium bv', electricity: true, gas: true },
  { name: 'Frank Energie België bv', electricity: true, gas: true },
  { name: 'GETEC Energie GmbH', electricity: true, gas: true },
  { name: 'Luminus nv', electricity: true, gas: true },
  { name: 'OCTA+ Energie nv', electricity: true, gas: true },
  { name: 'Power Online nv (Mega)', electricity: true, gas: true },
  { name: 'RWE Supply & Trading GmbH', electricity: true, gas: true },
  { name: 'Scholt Energy nv', electricity: true, gas: true },
  { name: 'SEFE Energy GmbH', electricity: false, gas: true },
  { name: 'TotalEnergies Gas & Power Western Europe nv', electricity: true, gas: false },
  { name: 'TotalEnergies Gas & Power Limited', electricity: true, gas: false },
  { name: 'TotalEnergies Power & Gas Belgium nv', electricity: true, gas: true },
  { name: 'Trevion nv', electricity: true, gas: true },
  { name: 'Ukko Energy nv', electricity: true, gas: false },
  { name: 'Vlaams Energiebedrijf nv', electricity: true, gas: true },
  { name: 'Wase Wind cv', electricity: true, gas: false },
  { name: 'Yuso bv', electricity: true, gas: false }
].sort((a,b)=>a.name.localeCompare(b.name,'nl'));

const components = [
  'Vaste energieprijs (€/kWh)',
  'Vaste jaarlijkse vergoeding (abonnement)',
  'Nettarieven (distributie + transmissie)',
  'Capaciteitstariefcomponent in nettarief',
  'Heffingen en toeslagen',
  'BTW',
  'Meterregime: enkel of dag/nacht'
];

const matrix = {};
for (const c of components) {
  matrix[c] = Object.fromEntries(suppliers.map(s => [s.name, s.electricity ? 'JA*' : 'n.v.t. (geen elektriciteitsvergunning)']));
}

const payload = {
  dataset: 'fixed_contract_tariff_matrix_vlaanderen',
  updated_at_utc: new Date().toISOString(),
  scope: 'Vlaanderen - leveranciers met leveringsvergunning (snapshot VNR)',
  source: {
    name: 'Vlaamse Nutsregulator (VNR)',
    url: 'https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/energiecontracten-en-leveranciers/overzicht-energieleveranciers-met-leveringsvergunning',
    note: 'Deze matrix geeft het tariefMODEL voor vaste elektriciteitscontracten. Commerciële beschikbaarheid per leverancier/product kan afwijken.'
  },
  legend: {
    'JA*': 'Onderdeel van het vaste-contract factuurmodel voor elektriciteit.',
    'n.v.t.': 'Niet van toepassing voor elektriciteit (geen elektriciteitsvergunning in snapshot).'
  },
  suppliers,
  components,
  matrix
};

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.mkdir(WEB_DIR, { recursive: true });

await fs.writeFile(`${OUT_DIR}/fixed_contract_tariff_matrix_vlaanderen.json`, JSON.stringify(payload, null, 2));
await fs.writeFile(`${WEB_DIR}/fixed-contract-tariff-matrix-vlaanderen.json`, JSON.stringify(payload, null, 2));

console.log(JSON.stringify({ ok: true, suppliers: suppliers.length, components: components.length }, null, 2));
