#!/usr/bin/env node
import fs from 'node:fs/promises';

const ROOT = '/home/klaas/.openclaw/workspace';

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

function isoNow(){ return new Date().toISOString(); }

async function main() {
  const belpex = await readJson(`${ROOT}/website/projects/masterdata/belpex-latest-24h.json`);
  const fixed = await readJson(`${ROOT}/website/projects/masterdata/fixed-contract-tariff-matrix-vlaanderen.json`);
  const dynamic = await readJson(`${ROOT}/website/projects/masterdata/dynamic-contract-tariff-matrix-vlaanderen.json`);
  const dynamicCost = await readJson(`${ROOT}/website/projects/masterdata/dynamic-cost-benchmarks-vlaanderen.json`);
  const hefbomen = await readJson(`${ROOT}/data/master/battery/curated/batterij_hefbomen_matrix.json`);

  const registry = {
    generated_at_utc: isoNow(),
    tables: [
      {
        id: 'belpex_prices_be_24h',
        title: 'Belpex prijzen (BE) - laatste 24u',
        description: 'Day-ahead elektriciteitsprijzen, 96 kwartieren.',
        what_we_see: 'Belgische day-ahead elektriciteitsprijzen (laatste 24u, kwartierdata).',
        update_frequency: 'Dagelijks 16:00 Europe/Brussels',
        max_age_hours: 30,
        last_update: belpex.updated_at_utc,
        status: 'ok',
        preview: {
          columns: ['timestamp_brussels', 'price_eur_mwh'],
          rows: (belpex.points || []).slice(-8).map(r => [r.timestamp_brussels, r.price_eur_mwh])
        },
        usage: [
          { project: 'Masterdata', how: 'Grafiek + KPI voor spotprijsmonitoring.' },
          { project: '€Volt', how: 'Input voor laad/ontlaad-arbitrage en simulaties.' },
          { project: 'Fluvius Analyzer', how: 'Referentie voor dynamische contractscenario\'s.' }
        ]
      },
      {
        id: 'fixed_contract_tariff_matrix_vlaanderen',
        title: 'Vaste contractcomponenten - Vlaanderen',
        description: 'Matrix van factuurcomponenten per leverancier.',
        what_we_see: 'Vaste contractcomponenten op rij en leveranciers per kolom.',
        update_frequency: 'Wekelijks maandag 16:10 Europe/Brussels',
        max_age_hours: 24 * 8,
        last_update: fixed.updated_at_utc,
        status: 'ok',
        preview: {
          columns: ['component', 'voorbeeld leveranciers'],
          rows: (fixed.components || []).slice(0,6).map(c => [c, 'JA* / n.v.t.'])
        },
        usage: [
          { project: 'Masterdata', how: 'Vergelijking vaste tariefstructuur.' },
          { project: 'Fluvius Analyzer', how: 'Modelkeuze vast vs dynamisch.' }
        ]
      },
      {
        id: 'dynamic_contract_tariff_matrix_vlaanderen',
        title: 'Dynamische contractcomponenten - Vlaanderen',
        description: 'Matrix van dynamische/variabele contractcomponenten per leverancier.',
        what_we_see: 'Dynamische/variabele contractcomponenten op rij en leveranciers per kolom.',
        update_frequency: 'Wekelijks maandag 16:20 Europe/Brussels',
        max_age_hours: 24 * 8,
        last_update: dynamic.updated_at_utc,
        status: 'ok',
        preview: {
          columns: ['component', 'voorbeeld leveranciers'],
          rows: (dynamic.components || []).slice(0,6).map(c => [c, 'JA* / n.v.t.'])
        },
        usage: [
          { project: 'Masterdata', how: 'Structuurmonitor dynamische contracten.' },
          { project: '€Volt', how: 'Input voor marktvolgende batterijstrategie.' },
          { project: 'Fluvius Analyzer', how: 'Scenariovergelijking op contracttype.' }
        ]
      },
      {
        id: 'dynamic_cost_benchmarks_vlaanderen',
        title: 'Dynamische contractcomponenten (Tabel 304) - Vlaanderen',
        description: 'Conservatieve kostenbenchmarks voor dynamische contractcomponenten met strict confidence gating.',
        what_we_see: 'Per dynamische component: waarde, eenheid, confidence en bronmetadata (source_url + source_date).',
        update_frequency: 'Maandelijks (1x/maand volstaat voor deze tabel)',
        max_age_hours: 24 * 35,
        last_update: dynamicCost.updated_at_utc,
        status: 'ok',
        preview: {
          columns: ['component', 'waarde', 'eenheid', 'confidence'],
          rows: (dynamicCost.rows || []).slice(0,6).map(r => [r.component, r.confidence === 'high' ? r.value : '?', r.unit, r.confidence || 'starter'])
        },
        usage: [
          { project: 'Masterdata', how: 'Compact overzicht voor Tabel 304 met confidence-gating.' },
          { project: '€Volt', how: 'Input voor dynamische all-in kostsimulatie met bronverwijzing.' },
          { project: 'Fluvius Analyzer', how: 'Dynamische contractcomponenten met expliciete onzekerheidsmarkering (\'?\').' }
        ]
      },
      {
        id: 'batterij_rendementshefbomen_matrix',
        title: 'Batterij-rendementshefbomen per contractcomponent',
        description: 'Koppelt batterij-rendementshefbomen aan contractkosten en impactrichting.',
        what_we_see: 'Welke rendementshefboom op welke kostcomponent werkt, en in welke richting.',
        update_frequency: 'Maandelijks (of bij modelwijziging)',
        max_age_hours: 24 * 35,
        last_update: hefbomen.updated_at_utc,
        status: 'ok',
        preview: {
          columns: ['hefboom', 'component', 'impact'],
          rows: (hefbomen.records || []).slice(0,6).map(r => [r.hefboom, r.contract_component, r.impact_direction])
        },
        usage: [
          { project: 'Masterdata', how: 'Overzichtskaart van batterij-rendementshefbomen.' },
          { project: '€Volt', how: 'Visuele uitleg van rendementspaden voor klanten.' },
          { project: 'Fluvius Analyzer', how: 'Link tussen factuurcomponent en simulatiehefboom.' }
        ]
      },
      {
        id: 'net_tariffs_flanders',
        title: 'Nettarieven Vlaanderen (starter)',
        description: 'DNB-gerelateerde nettariefcomponenten en capaciteitstariefcontext.',
        what_we_see: 'Nettariefcontext per DNB en tariefjaar.',
        update_frequency: 'Maandelijks (1e maandag 16:30)',
        max_age_hours: 24 * 35,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['dnb', 'tariefjaar', 'capaciteitstarief_actief'],
          rows: [
            ['Fluvius Antwerpen', '2026', 'ja'],
            ['Fluvius Limburg', '2026', 'ja'],
            ['Fluvius West', '2026', 'ja']
          ]
        },
        usage: [
          { project: 'Fluvius Analyzer', how: 'Berekening netkosten in totaalfactuur.' }
        ]
      },
      {
        id: 'levies_vat_rules_be',
        title: 'Heffingen en btw-regels (BE)',
        description: 'Overzicht toeslagen/btw-structuur voor simulatie.',
        what_we_see: 'Fiscale en reglementaire componenten voor all-in kost.',
        update_frequency: 'Maandelijks (1e maandag 16:35)',
        max_age_hours: 24 * 35,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['regel', 'waarde', 'geldig_vanaf'],
          rows: [
            ['btw_elektriciteit_pct', '6/21 afhankelijk beleid', '2026-01-01'],
            ['federale_bijdrage', 'actief', '2026-01-01'],
            ['openbare_dienstverplichting', 'actief', '2026-01-01']
          ]
        },
        usage: [
          { project: 'Fluvius Analyzer', how: 'Correcte all-in factuurberekening.' },
          { project: '€Volt', how: 'Realistische businesscase met fiscaliteit.' }
        ]
      },
      {
        id: 'supplier_product_catalog_flanders',
        title: 'Leveranciersproductcatalogus (starter)',
        description: 'Productmatrix met contracttype, vaste vergoeding en prijslogica.',
        what_we_see: 'Productoverzicht per leverancier met contracttype.',
        update_frequency: 'Wekelijks',
        max_age_hours: 24 * 8,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['leverancier', 'product', 'contracttype'],
          rows: [
            ['ENGIE', 'Easy', 'vast/variabel'],
            ['Luminus', 'Comfy', 'vast/variabel'],
            ['TotalEnergies', 'myDynamic', 'dynamisch']
          ]
        },
        usage: [
          { project: 'Fluvius Analyzer', how: 'Selectie en vergelijking contractproducten.' }
        ]
      },
      {
        id: 'injection_tariffs_flanders',
        title: 'Injectietarieven per leverancier (starter)',
        description: 'Vergoeding voor geïnjecteerde energie per product/leverancier.',
        what_we_see: 'Injectievergoeding per leverancier/product.',
        update_frequency: 'Wekelijks',
        max_age_hours: 24 * 8,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['leverancier', 'product', 'injectietarief_type'],
          rows: [
            ['ENGIE', 'Flow', 'variabel'],
            ['Luminus', 'OptiPower', 'variabel'],
            ['Eneco', 'Zon & Wind', 'variabel']
          ]
        },
        usage: [
          { project: '€Volt', how: 'PV/batterij rendement en terugleveranalyse.' },
          { project: 'Fluvius Analyzer', how: 'Netto energiekost met injectiecorrectie.' }
        ]
      },
      {
        id: 'meter_regimes',
        title: 'Meterregimes en validatieregels',
        description: 'Technische voorwaarden per tariefregime.',
        what_we_see: 'Toelaatbaarheid en meetresolutie per meterregime.',
        update_frequency: 'Per kwartaal',
        max_age_hours: 24 * 100,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['regime', 'digitale_meter_verplicht', 'meetresolutie'],
          rows: [
            ['enkel', 'nee', 'maand/jaar'],
            ['dag_nacht', 'nee', 'maand/jaar'],
            ['dynamisch', 'ja', 'kwartier']
          ]
        },
        usage: [
          { project: 'Fluvius Analyzer', how: 'Datavalidatie en contracttoelaatbaarheid.' }
        ]
      },
      {
        id: 'battery_parameters_defaults',
        title: 'Batterijparameters (default set)',
        description: 'Standaard techno-economische parameters per technologie.',
        what_we_see: 'Default efficiency/DoD/lifecycle voor batterijsimulaties.',
        update_frequency: 'Per kwartaal',
        max_age_hours: 24 * 100,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['type', 'roundtrip_eff', 'dod', 'lifecycle_cycles'],
          rows: [
            ['Li-ion LFP', '0.92', '0.8-0.95', '4000-7000'],
            ['Li-ion NMC', '0.9', '0.8-0.9', '3000-6000'],
            ['HV stack', '0.9-0.94', '0.8-0.95', '4000-8000']
          ]
        },
        usage: [
          { project: '€Volt', how: 'Sizing en lifecycle-kostberekeningen.' },
          { project: 'Fluvius Analyzer', how: 'Simulatie van opslagscenario\'s.' }
        ]
      },
      {
        id: 'pv_profiles_be_defaults',
        title: 'PV-profielen (default)',
        description: 'Indicatieve productieprofielen per oriëntatie en seizoen.',
        what_we_see: 'Generieke PV-productieprofielen voor simulaties zonder meetdata.',
        update_frequency: 'Per kwartaal',
        max_age_hours: 24 * 100,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['profiel', 'oriëntatie', 'jaaropbrengst_index'],
          rows: [
            ['PV_SOUTH_35', 'zuid', '1.00'],
            ['PV_EAST_WEST_20', 'oost-west', '0.92'],
            ['PV_FLAT_10', 'plat', '0.9']
          ]
        },
        usage: [
          { project: '€Volt', how: 'Schatting productie bij ontbrekende meetdata.' },
          { project: 'Fluvius Analyzer', how: 'Scenario met/zonder PV-data.' }
        ]
      },
      {
        id: 'slp_profiles',
        title: 'SLP verbruiksprofielen',
        description: 'Standaard loadprofielen bij afwezigheid van kwartierdata.',
        what_we_see: 'Default verbruiksprofielen per huishoudtype.',
        update_frequency: 'Per kwartaal',
        max_age_hours: 24 * 100,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['profiel', 'type', 'toepassing'],
          rows: [
            ['SLP_RES_BASE', 'residentieel', 'algemeen huishouden'],
            ['SLP_RES_HEATPUMP', 'residentieel', 'warmtepomp'],
            ['SLP_RES_EV', 'residentieel', 'EV-lading']
          ]
        },
        usage: [
          { project: 'Fluvius Analyzer', how: 'Proxy-simulatie zonder volledige meterhistoriek.' }
        ]
      },
      {
        id: 'calendar_timeblocks_be',
        title: 'Kalender en tijdsblokken (BE)',
        description: 'Werkdag/weekend/feestdag + tijdsvensters voor analyses.',
        what_we_see: 'Tijdsblokken voor tarief- en piekanalyses.',
        update_frequency: 'Jaarlijks + wijzigingstabel ad hoc',
        max_age_hours: 24 * 400,
        last_update: isoNow(),
        status: 'ok',
        preview: {
          columns: ['block', 'start', 'end'],
          rows: [
            ['nacht', '22:00', '07:00'],
            ['dag', '07:00', '22:00'],
            ['weekend', 'za 00:00', 'zo 23:59']
          ]
        },
        usage: [
          { project: 'Fluvius Analyzer', how: 'Tariefblokken en piekanalyse per tijdsvenster.' },
          { project: '€Volt', how: 'Strategie voor slim laden/ontladen.' }
        ]
      }
    ]
  };

  await fs.mkdir(`${ROOT}/data/master/catalog/curated`, { recursive: true });
  await fs.mkdir(`${ROOT}/website/projects/masterdata`, { recursive: true });

  await fs.writeFile(`${ROOT}/data/master/catalog/curated/masterdata_registry.json`, JSON.stringify(registry, null, 2));
  await fs.writeFile(`${ROOT}/website/projects/masterdata/masterdata-registry.json`, JSON.stringify(registry, null, 2));

  console.log(JSON.stringify({ ok: true, tables: registry.tables.length }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
