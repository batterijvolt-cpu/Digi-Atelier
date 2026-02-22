#!/usr/bin/env node
import fs from 'node:fs/promises';

const ROOT = '/home/klaas/.openclaw/workspace/data/master';

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

function now() { return new Date().toISOString(); }

async function writeJson(path, data) {
  await fs.mkdir(path.split('/').slice(0, -1).join('/'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2));
}

async function main() {
  const ts = now();

  // 1) Supplier product catalog (partially sourced)
  const engieUrl = 'https://www.engie.be/nl/energie/elektriciteit-gas/prijzen-voorwaarden/';
  const engieHtml = await fetchText(engieUrl);
  const productMatches = [...engieHtml.matchAll(/>(Easy|Flow|Direct Online|Dynamic|Empower|Basic Online)</g)].map(m => m[1]);
  const engieProducts = [...new Set(productMatches)].map(name => ({
    supplier: 'ENGIE',
    product: name,
    contract_type: /Dynamic/i.test(name) ? 'dynamisch' : /Empower|Easy/.test(name) ? 'vast/variabel' : 'variabel',
    source_url: engieUrl,
    source_date: ts.slice(0, 10),
    source_type: 'official_supplier_page',
    confidence_level: 'high'
  }));

  const productCatalog = {
    dataset: 'supplier_product_catalog_flanders',
    updated_at_utc: ts,
    fill_status: 'partial',
    notes: 'Starter fill with per-record source_url/source_date and confidence_level; replace starter records when richer official fiches are available.',
    records: [
      ...engieProducts,
      { supplier: 'Luminus', product: 'Comfy', contract_type: 'vast', source_url: 'https://www.luminus.be/nl/prive/', source_date: ts.slice(0, 10), source_type: 'official_supplier_page', confidence_level: 'medium' },
      { supplier: 'Luminus', product: 'ComfyFlex', contract_type: 'variabel', source_url: 'https://www.luminus.be/nl/prive/', source_date: ts.slice(0, 10), source_type: 'official_supplier_page', confidence_level: 'medium' },
      { supplier: 'Luminus', product: 'Dynamic Online', contract_type: 'dynamisch', source_url: 'https://www.luminus.be/nl/prive/', source_date: ts.slice(0, 10), source_type: 'official_supplier_page', confidence_level: 'medium' },
      { supplier: 'TotalEnergies', product: 'myDynamic', contract_type: 'dynamisch', source_url: 'https://www.totalenergies.be', source_date: ts.slice(0, 10), source_type: 'starter_manual_tag', confidence_level: 'starter' },
      { supplier: 'Mega', product: 'Zen Fixed', contract_type: 'vast', source_url: 'https://www.mega.be', source_date: ts.slice(0, 10), source_type: 'starter_manual_tag', confidence_level: 'starter' }
    ]
  };

  // 2) Meter regimes (regulatory/technical ruleset)
  const meterRegimes = {
    dataset: 'meter_regimes',
    updated_at_utc: ts,
    fill_status: 'seeded',
    records: [
      { regime: 'enkel', digital_meter_required: false, resolution: 'monthly', suited_for_dynamic_contract: false, source_type: 'domain_rules' },
      { regime: 'dag_nacht', digital_meter_required: false, resolution: 'monthly', suited_for_dynamic_contract: false, source_type: 'domain_rules' },
      { regime: 'dynamisch', digital_meter_required: true, resolution: 'quarter_hour', suited_for_dynamic_contract: true, source_type: 'market_rules' }
    ],
    sources: [
      'https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/energiecontracten-en-leveranciers/energiecontracten'
    ]
  };

  // 3) Calendar blocks
  const calendarBlocks = {
    dataset: 'calendar_timeblocks_be',
    updated_at_utc: ts,
    fill_status: 'seeded',
    records: [
      { block: 'nacht', start: '22:00', end: '07:00', scope: 'default_analysis_block' },
      { block: 'dag', start: '07:00', end: '22:00', scope: 'default_analysis_block' },
      { block: 'weekend', start: 'Saturday 00:00', end: 'Sunday 23:59', scope: 'default_analysis_block' }
    ]
  };

  // 4) Battery defaults
  const batteryDefaults = {
    dataset: 'battery_parameters_defaults',
    updated_at_utc: ts,
    fill_status: 'seeded',
    records: [
      { chemistry: 'LFP', roundtrip_efficiency: 0.92, dod_range: '0.8-0.95', lifecycle_cycles_range: '4000-7000', source_type: 'engineering_defaults' },
      { chemistry: 'NMC', roundtrip_efficiency: 0.9, dod_range: '0.8-0.9', lifecycle_cycles_range: '3000-6000', source_type: 'engineering_defaults' }
    ]
  };

  // 5) PV defaults
  const pvDefaults = {
    dataset: 'pv_profiles_be_defaults',
    updated_at_utc: ts,
    fill_status: 'seeded',
    records: [
      { profile: 'PV_SOUTH_35', orientation: 'south', yearly_index: 1.0 },
      { profile: 'PV_EAST_WEST_20', orientation: 'east-west', yearly_index: 0.92 },
      { profile: 'PV_FLAT_10', orientation: 'flat', yearly_index: 0.9 }
    ]
  };

  // 6) SLP defaults
  const slpDefaults = {
    dataset: 'slp_profiles',
    updated_at_utc: ts,
    fill_status: 'seeded',
    records: [
      { profile: 'SLP_RES_BASE', segment: 'residential', purpose: 'default household profile' },
      { profile: 'SLP_RES_HEATPUMP', segment: 'residential', purpose: 'heat-pump-heavy profile' },
      { profile: 'SLP_RES_EV', segment: 'residential', purpose: 'EV charging load profile' }
    ]
  };

  // 7) Levies and VAT starter
  const levies = {
    dataset: 'levies_vat_rules_be',
    updated_at_utc: ts,
    fill_status: 'partial',
    records: [
      {
        rule: 'btw_elektriciteit_residentieel_pct',
        value: 6,
        unit: '%',
        valid_from: '2026-01-01',
        source_type: 'regulatory_context',
        source_url: 'https://www.creg.be/nl/consumenten/prijzen-en-tarieven',
        source_date: ts.slice(0, 10),
        confidence_level: 'starter',
        notes: 'Confirm legal scope/timebox on fiscal legal publication before settlement.'
      },
      {
        rule: 'btw_elektriciteit_standaard_pct',
        value: 21,
        unit: '%',
        valid_from: '2026-01-01',
        source_type: 'regulatory_context',
        source_url: 'https://www.creg.be/nl/consumenten/prijzen-en-tarieven',
        source_date: ts.slice(0, 10),
        confidence_level: 'starter'
      },
      {
        rule: 'federale_bijdrage_elektriciteit',
        value: 'active',
        valid_from: '2026-01-01',
        source_type: 'regulatory_context',
        source_url: 'https://www.creg.be/nl/consumenten/prijzen-en-tarieven',
        source_date: ts.slice(0, 10),
        confidence_level: 'starter',
        notes: 'Exact €/kWh values not yet sourced in this starter fill.'
      }
    ],
    sources: ['https://www.creg.be/nl/consumenten/prijzen-en-tarieven']
  };

  // 8) Net tariffs starter
  const netTariffs = {
    dataset: 'net_tariffs_flanders',
    updated_at_utc: ts,
    fill_status: 'partial',
    records: [
      { dnb: 'Fluvius Antwerpen', tariff_year: 2026, capacity_tariff_active: true, source_type: 'regulatory_context', source_url: 'https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/nettarieven', source_date: ts.slice(0, 10), confidence_level: 'medium' },
      { dnb: 'Fluvius Limburg', tariff_year: 2026, capacity_tariff_active: true, source_type: 'regulatory_context', source_url: 'https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/nettarieven', source_date: ts.slice(0, 10), confidence_level: 'medium' },
      { dnb: 'Fluvius West', tariff_year: 2026, capacity_tariff_active: true, source_type: 'regulatory_context', source_url: 'https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/nettarieven', source_date: ts.slice(0, 10), confidence_level: 'medium' }
    ],
    sources: ['https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/nettarieven']
  };

  // 9) Injection tariffs starter
  const injection = {
    dataset: 'injection_tariffs_flanders',
    updated_at_utc: ts,
    fill_status: 'partial',
    records: [
      { supplier: 'ENGIE', product: 'Flow', tariff_type: 'variabel', source_type: 'supplier_product_context', source_url: 'https://www.engie.be/nl/energie/elektriciteit-gas/prijzen-voorwaarden/', source_date: ts.slice(0, 10), confidence_level: 'medium' },
      { supplier: 'Luminus', product: 'ComfyFlex', tariff_type: 'variabel', source_type: 'official_supplier_page', source_url: 'https://www.luminus.be/nl/prive/', source_date: ts.slice(0, 10), confidence_level: 'starter' },
      { supplier: 'Eneco', product: 'Zon & Wind', tariff_type: 'variabel', source_type: 'starter_manual_tag', source_url: 'https://www.eneco.be/nl/', source_date: ts.slice(0, 10), confidence_level: 'starter' }
    ],
    sources: [
      'https://www.engie.be/nl/energie/elektriciteit-gas/prijzen-voorwaarden/',
      'https://www.luminus.be/nl/prive/',
      'https://www.eneco.be/nl/'
    ]
  };

  await writeJson(`${ROOT}/products/curated/supplier_product_catalog_flanders.json`, productCatalog);
  await writeJson(`${ROOT}/meter/curated/meter_regimes.json`, meterRegimes);
  await writeJson(`${ROOT}/calendar/curated/calendar_timeblocks_be.json`, calendarBlocks);
  await writeJson(`${ROOT}/battery/curated/battery_parameters_defaults.json`, batteryDefaults);
  await writeJson(`${ROOT}/pv/curated/pv_profiles_be_defaults.json`, pvDefaults);
  await writeJson(`${ROOT}/slp/curated/slp_profiles.json`, slpDefaults);
  await writeJson(`${ROOT}/levies/curated/levies_vat_rules_be.json`, levies);
  await writeJson(`${ROOT}/net/curated/net_tariffs_flanders.json`, netTariffs);
  await writeJson(`${ROOT}/injection/curated/injection_tariffs_flanders.json`, injection);

  console.log(JSON.stringify({ ok: true, datasets_written: 9 }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
