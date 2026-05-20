# FDD structure

This project is organized around the catalog feature instead of technical layers.
It follows a Feature-Driven Development approach: each improvement is delivered as an independent, testable, and composable feature slice.

## Feature slices

1. `Catalog discovery`
- global search
- category tree navigation
- filters by brand, category, type, and assets
- pagination

2. `Product card`
- image preview
- SKU
- PDF badge
- open product details

3. `Product details`
- large preview
- downloads for images and documents
- brief attributes
- collapsible technical sheet

4. `Catalog settings`
- generic settings modal
- view / downloads / categories / data notes

5. `Saved views`
- persist filter combinations locally
- save, apply, and delete catalog views
- keep repeat usage fast for internal users
- generate shareable links for the current view

6. `Recent searches`
- store recent search terms locally
- let users re-run a search quickly from the header
- keep the search loop efficient for repeat catalog use

7. `Category tree filter`
- render categories as an expandable tree
- include search inside the category tree
- allow selecting parent nodes and leaf categories
- keep category filtering fast and readable

8. `Category taxonomy labels`
- derive readable category names from product groups
- show those names in filters, cards, and the product sheet

## Code layout

- `src/features/catalog/`
  - `catalogTypes.ts`
  - `catalogUtils.ts`
  - `useCatalog.ts`
- `src/components/`
  - visual components for the catalog

## Delivery rule

Each new improvement should be shipped as one feature slice first, then composed into the catalog page.

## Backlog

- [FDD-backlog.md](C:/Users/novic/OneDrive/Escritorio/conector/ContentStore/BTV-CS-main/BTV-CS-main/FDD-backlog.md)
