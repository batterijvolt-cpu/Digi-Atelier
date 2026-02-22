# Masterdata — Belpex prijs (BE)

Dit is de masterdata-map voor Belgische day-ahead stroomprijzen (Belpex/EPEX referentie voor BE bidding zone).

## Structuur (best practice)

- `raw/` → immutable bronbestanden (nooit handmatig wijzigen)
- `curated/` → opgeschoonde/tabulaire datasets voor gebruik
- `metadata/` → data dictionary + herkomst + kwaliteit
- `logs/` → ingest-run logs (NDJSON)

## Bron

- Provider: Energy-Charts API
- Endpoint: `https://api.energy-charts.info/price`
- Parameter: `bzn=BE`
- Unit: EUR/MWh
- License: zie `metadata/belpex_prices_be_data_dictionary.json`

## Vernieuwen

```bash
node scripts/fetch_belpex_master.mjs
```

Optioneel met expliciet bereik:

```bash
node scripts/fetch_belpex_master.mjs 2026-02-21 2025-01-01
```

> Formaat: `node scripts/fetch_belpex_master.mjs <end> <start>`

## Data contract

Curated tabel: `curated/belpex_prices_be.csv`

Kolommen:
- `timestamp_utc` (ISO-8601, UTC)
- `timestamp_brussels` (Europe/Brussels)
- `price_eur_mwh` (numeric)
- `bzn` (BE)
- `source` (energy-charts)
