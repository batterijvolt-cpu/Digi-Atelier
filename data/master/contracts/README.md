# Masterdata — Contracttarieven Vlaanderen

Datasets:
- `fixed_contract_tariff_matrix_vlaanderen`
- `dynamic_contract_tariff_matrix_vlaanderen`

## Inhoud

Matrices met:
- rijen = tariefcomponenten van vaste of dynamische/variabele elektriciteitscontracten
- kolommen = leveranciers (snapshot leveringsvergunningen Vlaanderen)

## Bronsnapshot

- Vlaamse Nutsregulator (VNR)
- https://www.vlaamsenutsregulator.be/elektriciteit-en-aardgas/energiecontracten-en-leveranciers/overzicht-energieleveranciers-met-leveringsvergunning

## Bestand

- `curated/fixed_contract_tariff_matrix_vlaanderen.json`

## Build

```bash
node scripts/build_fixed_contract_masterdata.mjs
node scripts/build_dynamic_contract_masterdata.mjs
```

> Let op: dit zijn **tariefmodellen**. Niet elke leverancier biedt op elk moment elk residentieel product actief aan.
