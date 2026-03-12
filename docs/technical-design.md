# Guided Flow POC — Technical Design Document

> **Last Updated:** March 2026  
> **Project Path:** `guidedFlowPoc/`  
> **Purpose:** A Salesforce LWC-based product configurator that drives a custom Flow  
> (`Custom_Product_Configurator_Flow`) through a modal UI, mapping CPQ product data from Apex  
> into the flow's input variables at runtime.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Inventory](#file-inventory)
4. [Data Flow — End to End](#data-flow--end-to-end)
5. [Apex Classes](#apex-classes)
6. [LWC Components](#lwc-components)
7. [Flow: `Custom_Product_Configurator_Flow`](#flow-custom_product_configurator_flow)
8. [Flow Input Variable Mapping](#flow-input-variable-mapping)
9. [Flow Output Variable Mapping](#flow-output-variable-mapping)
10. [Test / Fallback Data](#test--fallback-data)
11. [Key Decisions & Rationale](#key-decisions--rationale)
12. [Known Issues & Debug History](#known-issues--debug-history)
13. [TODO / Pending Work](#todo--pending-work)
14. [Deployment Notes](#deployment-notes)

---

## Overview

This POC demonstrates how a Salesforce LWC can:

1. **Browse product categories** (via the CPQ `getCategoryDetails` standard action, called recursively).
2. **Load product details** (price, selling model, codes) via the CPQ `getMultipleProductDetails` standard action.
3. **Launch a full-screen Flow modal** pre-populated with the selected product's data.
4. **Capture flow output variables** after the flow finishes and display them in a debug panel.

The target audience is an internal developer who needs to extend this work, wire up real IDs, or hand it off to a client environment.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LWC: categoryAndProductDuplicate                               │
│  ─────────────────────────────────────────────────────────────  │
│  • Renders category steps + product cards                       │
│  • On "Configure" click → opens fullscreen flow modal           │
│  • Builds flowInputVariables from selectedProduct               │
│  • Captures flow output variables after FINISHED event          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ calls (Apex wire-style promises)
         ┌────────────────┴──────────────────────┐
         │                                       │
         ▼                                       ▼
 Apex: categoryAndProductController    Apex: getMultipleProductDetails
   getCategoriesWithProducts()           getProductDetails(productIds)
         │                                       │
         ▼                                       ▼
 CategoryAndProduct.cls              CPQ Standard Action:
   getAllCategoryHierarchy()           getMultipleProductDetails
   → CPQ Standard Action:               (Invocable.Action)
     getCategoryDetails (recursive)      → BulkProductDetailsRepresentation
   → SOQL: ProductCategoryProduct
         │                                       │
         ▼                                       ▼
   List<CategoryProductRow>         List<ProductInfo>
   (categoryId, categoryName,       (name, code, price,
    productId)                       pricebookEntryId,
                                     sellingModel fields…)
                          │
                          ▼
              LWC: maps data into flowInputVariables[]
                          │
                          ▼
              lightning-flow (Custom_Product_Configurator_Flow)
```

---

## File Inventory

### Apex Classes

| File | Role |
|------|------|
| `CategoryAndProduct.cls` | Fetches category tree recursively via CPQ `getCategoryDetails` action; bulk-loads `ProductCategoryProduct` in a single SOQL |
| `categoryAndProductController.cls` | LWC-callable `@AuraEnabled` wrapper; null-safe product ID iteration; calls `CategoryAndProduct` and `getMultipleProductDetails` |
| `getMultipleProductDetails.cls` | Calls CPQ `getMultipleProductDetails` action once per product ID; returns rich `ProductInfo` objects |
| `TransactionLineResult.cls` | Apex-Defined Variable class that mirrors the `ProductConfig__ConfiguratorContext` pattern; used as the flow's input variable shape |
| `GetTransactionLineResult.cls` | `@InvocableMethod` action placed as the **first element** in the flow; builds/returns a `TransactionLineResult` (currently mock data, ready for real callout) |

### LWC Components

| Component | Role |
|-----------|------|
| `categoryAndProductDuplicate` | **Main configurator UI** — category stepper, product cards, flow modal, output capture panel. Subscribes to the `ProductConfiguratorResult` Lightning Message Channel on load to receive live data from the footer component and close the flow modal automatically. |
| `dataManagerCapture` | _(Superseded by `customProductConfiguratorFooter`)_ Original flow screen component. Retained in source for reference. |
| `customProductConfiguratorFooter` | Replacement for `dataManagerCapture`. Flow screen component that acts as a **sticky footer** with a **Finish** button. Receives Data Manager outputs reactively, fires `FlowAttributeChangeEvent` for each `Out_*` variable, and on Finish publishes all captured properties over the `ProductConfiguratorResult` Lightning Message Channel before firing `FlowNavigationFinishEvent`. |
| `flowOrderSummary` | Review / order summary screen shown after cart is finalized |
| `managedWiFiAdvancedFlowCart` | Side-panel cart display |

### Lightning Message Channels

| Channel | Notes |
|---------|-------|
| `ProductConfiguratorResult` | Published by `customProductConfiguratorFooter` on Finish. Carries `salesTransactionItems`, `transactionRecord`, `attributeCategories`, `optionGroups`, `summary`. Subscribed to by `categoryAndProductDuplicate`. |

### Flows

| Flow | Notes |
|------|-------|
| `Custom_Product_Configurator_Flow` | Target flow; receives 17 flat `String/Number/Boolean` input variables from the LWC |
| `QOCAL_Product_Configurator_Flow` | Reference / alternate flow |
| `Managed_Wi_fi_Advanced_New` | Used in the broader hpbxPoc / metronet workspace |

### Data Files

| File | Notes |
|------|-------|
| `data/mockConfigContext.json` | Single JSON representing the full `ConfiguratorContext` object; used as the canonical reference for all test IDs |
| `data/actualConfigContext.json` | Captured live context; compare against mock to spot drift |

---

## Data Flow — End to End

### Step 1 — Component Mounts

```
connectedCallback()
  → loadCategoryProducts()
    → getCategoriesWithProducts({ rootCategoryId })   ← Apex
      → CategoryAndProduct.getAllCategoryHierarchy()
        → CPQ getCategoryDetails (recursive)
        → SOQL ProductCategoryProduct (bulk)
      ← List<CategoryProductRow>
    → sets this.categories, this.categoryProductMap
    → loadProductDetails()
```

### Step 2 — Load Products for Current Category

```
loadProductDetails()
  → getProductDetails({ productIds })   ← Apex
    → getMultipleProductDetails.getProductDetails()
      → CPQ getMultipleProductDetails (one call per productId)
      ← List<ProductInfo>
  → maps to this.products[]  (includes all fields below)
```

**Fields returned per product (`ProductInfo`):**

| Field | Source |
|-------|--------|
| `productName` | `BulkProductDetailsRepresentation.name` |
| `productCode` | `BulkProductDetailsRepresentation.productCode` |
| `description` | `BulkProductDetailsRepresentation.description` |
| `displayUrl` | `BulkProductDetailsRepresentation.displayUrl` |
| `price` | `prices[0].price` |
| `pricebookEntryId` | `prices[0].priceBookEntryId` |
| `sellingModelName` | `productSellingModelOptions[0].productSellingModel.name` |
| `productSellingModelId` | `productSellingModelOptions[0].productSellingModel.id` |
| `sellingModelType` | `productSellingModelOptions[0].productSellingModel.sellingModelType` |
| `pricingTermUnit` | `productSellingModelOptions[0].productSellingModel.pricingTermUnit` |
| `subscriptionTerm` | _(not returned by CPQ action; defaults to 1 in LWC)_ |

### Step 3 — User Clicks "Configure"

```
handleConfigure(event)
  → this.selectedProduct = products.find(productId)
  → this.showFlow = true
  → getter: flowInputVariables   ← computed from this.selectedProduct
```

### Step 4 — Flow Launches

`lightning-flow` renders `Custom_Product_Configurator_Flow` inside the modal with the 17 input variables already set.

### Step 5 — Flow Finishes

```
handleFlowStatusChange(event)
  status === 'FINISHED' | 'FINISHED_SCREEN'
  → reads event.detail.outputVariables
  → stores in this.capturedDmData
  → shows debug capture panel
```

---

## Apex Classes

### `CategoryAndProduct.cls`

```
getAllCategoryHierarchy(rootCategoryId)
├── fetchAllCategoriesRecursive()    [no SOQL, recursive CPQ action calls]
├── SOQL: ProductCategoryProduct     [one query, bulked across all category IDs]
└── returns List<Category>           [id, name, parentCategoryId, productIds]
```

**Debug logs:** Logs category count, product map, and each row at `System.debug` level.

---

### `categoryAndProductController.cls`

- Wrapper only. Both `getCategoriesWithProducts` and `getProductDetails` delegate to their respective service classes.
- **Null guard:** Iterates over `productIds` individually; skips `null` entries with a debug warning.

---

### `getMultipleProductDetails.cls`

```
getProductDetails(productIds)
├── Validates: throws AuraHandledException if list is null/empty
├── For each non-null productId:
│   └── Invocable.Action('getMultipleProductDetails')
│       └── BulkProductDetailsInputBodyList → one product per call
├── Logs every result field (raw debug pass)
└── Extracts into List<ProductInfo>
    ├── prices[0]                → price, pricebookEntryId
    └── productSellingModelOptions[0] → sellingModel fields
```

**Important:** The CPQ action is invoked **one call per productId** to avoid the known limitation where a single multi-product call can return results in an unpredictable order. Results are then mapped back in order.

---

### `TransactionLineResult.cls`

Apex-Defined Variable used as the flow's context variable shape:

```apex
TransactionLineResult {
    transactionLineId, transactionId, parentName, origin, explainabilityEnabled,
    addedNodes: List<AddedNode> {
        unitPrice, subscriptionTerm, sellingModelType, quantity,
        productSellingModel, productName, productCode, productBasedOn,
        product, pricingTermUnit, pricebookEntry, id, businessObjectType
    }
}
```

---

### `GetTransactionLineResult.cls`

Invocable action that the flow calls as its **first element** to populate the `transactionLineResult` variable. Currently returns mock data from `buildMockResult()`; wire up to a real callout by replacing that method.

---

## LWC Components

### `categoryAndProductDuplicate`

#### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `@api rootCategoryId` | String | Root CPQ category to browse |
| `@api selectedLocationJSON` | String | Location context passed to cart |
| `@track categories` | Array | Category names extracted from map |
| `@track products` | Array | Products for the current step |
| `@track cart` | Array | Selected products |
| `@track selectedProduct` | Object | Product whose Configure button was clicked |
| `@track showFlow` | Boolean | Controls flow modal visibility |
| `@track capturedDmData` | Object | Output variables captured after flow finishes |
| `@track lmsReceivedData` | Object | Data received via LMS from `customProductConfiguratorFooter` |
| `@track showLmsReceivedData` | Boolean | Controls the LMS debug panel visibility |

#### Computed Getters

| Getter | Returns |
|--------|---------|
| `flowInputVariables` | 17-element array; maps `selectedProduct` fields to flow variable names |
| `steps` | Array of `{number, cssClass}` for the progress dot indicator |
| `capturedDmRows` | `{key, value}` pairs for the debug capture panel (flow output variables) |
| `lmsReceivedRows` | `{key, value}` pairs for the LMS debug panel (live platform event data) |

#### Modal

The flow modal uses `slds-modal slds-modal_large` with custom CSS classes (`flow-modal`, `flow-modal__container`, `flow-modal__body`) to achieve a near-fullscreen appearance:

- Container: `96vw × 94vh`, `position: fixed`, centred with `transform: translateX(-50%)`
- Body: `flex: 1 1 auto`, no `max-height` constraint
- `lightning-flow` fills the body with `height: 100%`

---

## Flow: `Custom_Product_Configurator_Flow`

The flow receives a single Apex-typed input variable — `configuratorContext` (`ProductConfig__ConfiguratorContext`) — directly from the host LWC. The LWC builds the full object (including `addedNodes`) in JavaScript and passes it via `flowInputVariables`. This eliminates the previous pattern of 18 flat primitive `In_*` variables, two Decision nodes, and two Assignment nodes that reassembled them inside the flow.

### Flow Variable Naming Convention

`configuratorContext` — the sole input variable; an Apex-defined `ProductConfig__ConfiguratorContext` object populated by the host LWC.  
Variables prefixed with `Out_` are output variables populated by `customProductConfiguratorFooter` and returned to the host LWC via `event.detail.outputVariables` on `FINISHED`.

### Flow Structure

```
Start
  └─▶ S01_ProductConfiguratorUI  (Screen)
        └─▶ [FINISH]
```

The flow goes directly from Start to the screen — no decision or assignment nodes are needed because `configuratorContext` arrives fully populated from the LWC.

Output variable population is handled by `customProductConfiguratorFooter` via `FlowAttributeChangeEvent` (see [Section 9](#flow-output-variable-mapping)).

### Screen: `S01_ProductConfiguratorUI`

The single screen hosts the following flow components in order:

| Component | Extension | Role |
|-----------|-----------|------|
| `S01_DataManager` | `runtime_industries_cfg:dataManager` | Central data orchestrator; receives `configuratorContext.*` inputs and exposes all Data Manager outputs |
| `S01_ConfigHeader` | `runtime_industries_cfg:configHeader` | Header bar with pricing toggle, favorites, tabs |
| `S01_Messages` | `runtime_industries_cfg:messages` | Validation/error message display |
| `S01_TransactionHeader` | `runtime_industries_cfg:transactionHeader` | Transaction summary row |
| `S01_BreadCrumbs` | `runtime_industries_cfg:breadcrumbs` | Navigation breadcrumbs |
| `S01_Header` | `runtime_industries_cfg:productHeader` | Product header with quantity |
| `S01_AttributesPanel` | `runtime_industries_cfg:attributes` | Attribute categories panel (tabs variant) |
| `S01_OptionGroups` | `runtime_industries_cfg:optionGroups` | Option groups panel (tabs variant) |
| `S01_CustomProductConfiguratorFooter` | `c:customProductConfiguratorFooter` | Footer component; captures Data Manager outputs, publishes them via LMS, populates `Out_*` variables, provides Finish button |

---

## Flow Input Variable Mapping

The `flowInputVariables` getter in `categoryAndProductDuplicate.js` passes a single Apex-typed variable:

| Flow Variable | Type | Description |
|--------------|------|-------------|
| `configuratorContext` | `apex://ProductConfig.ConfiguratorContext` | Fully assembled configurator context object |

The `configuratorContext` object is built in JavaScript with the following structure:

```javascript
{
    transactionId:         TEST_TRANSACTION_ID,       // TODO: real Quote/Order recordId
    transactionLineId:     refId,                     // generated ref_<UUID>
    parentName:            'Quote',
    origin:                'Quote',
    explainabilityEnabled: false,
    addedNodes: [{
        product:             selectedProduct.productId,
        productName:         selectedProduct.productName,
        productCode:         selectedProduct.productCode,
        unitPrice:           selectedProduct.price,
        quantity:            1,
        pricebookEntry:      selectedProduct.pricebookEntryId,
        productSellingModel: selectedProduct.productSellingModelId,
        sellingModelType:    selectedProduct.sellingModelType,
        pricingTermUnit:     selectedProduct.pricingTermUnit,
        subscriptionTerm:    selectedProduct.subscriptionTerm,
        id:                  refId,
        productBasedOn:      TEST_PRODUCT_BASED_ON,   // TODO
        businessObjectType:  TEST_BUSINESS_OBJECT_TYPE // TODO
    }]
}
```

> **⚠️ TODO items** — `transactionId`, `productBasedOn`, and `businessObjectType` still use test/fallback constants. Replace with real dynamic values once the parent record context (Quote ID) and product classification API are integrated.

---

## Flow Output Variable Mapping

Output variables are populated **reactively during the flow screen interaction** by the `dataManagerCapture` LWC — not by an assignment node after the screen closes. Every time the Data Manager pushes a new value to `dataManagerCapture` via its `inputParameter` binding, the corresponding `@api` setter fires a `FlowAttributeChangeEvent` which writes the value directly into the flow output variable.

### `dataManagerCapture` — Captured Properties

| `@api` Input Property | Bound to (flow `inputParameter`) | `FlowAttributeChangeEvent` → Flow Output Variable | Apex Type |
|---|---|---|---|
| `salesTransactionItems` | `S01_DataManager.salesTransactionItems` | `Out_salesTransactionItems` | `ProductConfig__SalesTransactionItem[]` |
| `transactionRecord` | `S01_DataManager.transactionRecord` | `Out_transactionRecord` | `ProductConfig__TransactionRecord` |
| `attributeCategories` | `S01_DataManager.attributeCategories` | `Out_attributeCategories` | `ProductConfig__AttributeCategory[]` |
| `optionGroups` | `S01_DataManager.optionGroups` | `Out_optionGroups` | `ProductConfig__OptionGroup[]` |
| `summary` | `S01_DataManager.summary` | `Out_summary` | `ProductConfig__PricingSummary` |

### Flow Output Variables (`isOutput=true`)

These are declared in the flow XML and returned to the host LWC in `event.detail.outputVariables` on `FINISHED`:

| Variable Name | Apex Class | Collection |
|---|---|---|
| `Out_salesTransactionItems` | `ProductConfig__SalesTransactionItem` | ✅ Yes |
| `Out_transactionRecord` | `ProductConfig__TransactionRecord` | ❌ No |
| `Out_attributeCategories` | `ProductConfig__AttributeCategory` | ✅ Yes |
| `Out_optionGroups` | `ProductConfig__OptionGroup` | ✅ Yes |
| `Out_summary` | `ProductConfig__PricingSummary` | ❌ No |

### `outputParameters` Binding (Flow XML)

Each output variable is wired to the LWC's corresponding `outputOnly` property in the flow screen field definition:

```xml
<outputParameters>
    <assignToReference>Out_salesTransactionItems</assignToReference>
    <name>Out_salesTransactionItems</name>
</outputParameters>
<!-- …repeated for Out_transactionRecord, Out_attributeCategories,
         Out_optionGroups, Out_summary -->
```

### Finish Button

`dataManagerCapture` renders a **Finish** button directly on the flow screen. Clicking it dispatches `FlowNavigationFinishEvent`, which triggers the flow's native FINISH navigation and fires `onstatuschange` (`FINISHED`) on the host `lightning-flow` element — closing the modal and delivering the output variables to `categoryAndProductDuplicate`.

---

## Test / Fallback Data

All test data originates from `data/mockConfigContext.json`, which represents a valid CPQ `ConfiguratorContext` snapshot:

```json
{
  "transactionLineId": "ref_ce62f961_6af6_4f5a_aa81_b890155bcb1a",
  "transactionId": "0Q0d50000012YoDCAU",
  "parentName": "Quote",
  "origin": "Quote",
  "explainabilityEnabled": false,
  "addedNodes": [{
    "unitPrice": 30.0,
    "subscriptionTerm": 1,
    "sellingModelType": "Evergreen",
    "quantity": 1.0,
    "productSellingModel": "0jPd50000000rAnEAI",
    "productName": "Fibre Broadband Bronze",
    "productCode": "CCC_FIBER_BROADBAND_BRONZE",
    "productBasedOn": "11Bd5000005gs5zEAA",
    "product": "01td5000004LI9LAAW",
    "pricingTermUnit": "Months",
    "pricebookEntry": "01ud5000000Ujz4AAC",
    "id": "ref_ce62f961_6af6_4f5a_aa81_b890155bcb1a",
    "businessObjectType": "QuoteLineItem"
  }]
}
```

The same data is hard-coded in `GetTransactionLineResult.buildMockResult()` and used as default fallbacks in `flowInputVariables`.

### Key Test IDs (Scratch Org)

| Label | ID |
|-------|----|
| Product (Bronze) | `01td5000004LI9LAAW` |
| PricebookEntry (Bronze) | `01ud5000000Ujz4AAC` |
| ProductSellingModel (Evergreen-Monthly) | `0jPd50000000rAnEAI` |
| Product Classification (productBasedOn) | `11Bd5000005gs5zEAA` |
| Quote (transactionId) | `0Q0d50000012YoDCAU` |

> These IDs are scratch-org specific. They **will differ** in a new scratch org or production environment.

---

## Key Decisions & Rationale

### 1. One CPQ Action Call Per Product (not Bulk)

**Decision:** `getMultipleProductDetails.cls` calls the CPQ `getMultipleProductDetails` invocable action once per product ID rather than passing all IDs in a single call.

**Rationale:** The CPQ bulk action returns results in an unpredictable internal order. By issuing one call per product, each `Invocable.Action.Result` maps deterministically back to the product that was requested.

---

### 2. Direct `configuratorContext` Injection (Apex-Typed Object, Not Flat Primitives)

**Decision:** The LWC builds the full `ProductConfig__ConfiguratorContext` object (including `addedNodes`) in JavaScript and passes it as a single Apex-typed `flowInputVariable` to the flow.

**Rationale:** The previous approach decomposed the context into 18 flat primitive `In_*` variables and relied on two Decision nodes + two Assignment nodes inside the flow to reassemble them into `configuratorContext`. Passing the object directly eliminates all intermediate variables and flow logic nodes, resulting in a simpler flow graph (`Start → Screen → FINISH`), faster flow execution, and a single source of truth for the context shape (the LWC's `flowInputVariables` getter). The `lightning-flow` component supports Apex-typed variables natively via the `type: 'apex://...'` syntax.

---

### 3. Fallback / Test Values Always Present

**Decision:** Every entry in `flowInputVariables` includes a fallback literal value (using JavaScript `||` short-circuit), even when a real dynamic value is available.

**Rationale:** During development, the flow would fail to render if any required input variable was `null` or `undefined`. Fallback values ensure the flow always launches correctly while dynamic mapping is still being validated. The fallback values mirror the exact mock context JSON so the flow is in a valid state.

---

### 4. UUID-Based `ref_` Line IDs

**Decision:** `In_AddedNode_Id` and `In_Cfg_TransactionLineId` are set to a freshly generated `ref_<UUID>` string on every Configure click.

**Rationale:** The CPQ flow uses this ID as a transaction line reference. Generating a new UUID each time prevents collision when a user configures multiple products in the same session. The same value is shared between `AddedNode.id` and `ConfiguratorContext.transactionLineId` so the flow's internal references stay consistent.

---

### 5. Fullscreen Flow Modal via CSS Overrides

**Decision:** The flow modal uses `slds-modal_large` plus custom CSS classes that override SLDS with `!important` rules to reach `96vw × 94vh`.

**Rationale:** SLDS large modal caps at ~90% width and has a max-height. To match the native Salesforce App Builder "Configure" experience (which uses a dedicated page), the modal needs to be effectively fullscreen. Direct CSS overrides with `position: fixed` and `transform: translateX(-50%)` are the most reliable cross-platform approach inside a LWC shadow DOM.

---

### 6. Null Guard on Product IDs (Both Apex and LWC)

**Decision:** Both `categoryAndProductController.cls` (Apex) and `loadProductDetails()` (LWC) explicitly skip/log null product IDs.

**Rationale:** The CPQ `getCategoryDetails` action can return category representations with mixed-null product arrays. Passing a null ID to `getMultipleProductDetails` causes an `AuraHandledException` and prevents all products from loading. The double-guard (at both layers) ensures resilience even if one layer is bypassed.

---

### 7. Output Variable Population via `FlowAttributeChangeEvent` (Not Assignment Node)

**Decision:** The `dataManagerCapture` LWC populates all `Out_*` flow output variables reactively via `FlowAttributeChangeEvent` dispatched from each `@api` setter, rather than using a dedicated `Assign_DM_Outputs` assignment node after the screen closes.

**Rationale:** An assignment node only runs once — after the screen navigates away. The `FlowAttributeChangeEvent` approach fires on every Data Manager update while the screen is still open, keeping the output variables current at all times. This also keeps the flow graph cleaner (one fewer node) and moves all output-capture logic into the LWC layer where it is easier to extend and test.

---

### 8. `dataManagerCapture` as a Multi-Property Capture Component

**Decision:** `dataManagerCapture` captures five distinct Data Manager outputs (`salesTransactionItems`, `transactionRecord`, `attributeCategories`, `optionGroups`, `summary`) rather than a single pass-through.

**Rationale:** The Data Manager exposes many output properties but the host LWC only needs a curated subset. Centralising capture in one dedicated LWC makes it straightforward to add or remove properties without touching the flow graph. Each property follows the same getter/setter + `FlowAttributeChangeEvent` pattern, making the component easy to reason about and extend.

---

### 9. Finish Button Lives in `dataManagerCapture`, Not the Modal Shell

**Decision:** The **Finish** button that fires `FlowNavigationFinishEvent` is rendered by `dataManagerCapture` (a flow screen component), not by the `categoryAndProductDuplicate` host LWC's modal footer.

**Rationale:** `FlowNavigationFinishEvent` must be dispatched from within a component that is part of the flow screen — i.e., a component whose `targets` includes `lightning__FlowScreen`. The host LWC sits outside the flow boundary and cannot directly trigger flow navigation events. Placing the button inside `dataManagerCapture` satisfies this requirement and keeps flow navigation logic co-located with the capture logic.

---

## Known Issues & Debug History

### Issue 1 — Null ProductId Causing Apex Exception

**Symptom:** `getProductDetails` threw `AuraHandledException: Product Id list cannot be empty` even though products were visible.

**Root Cause:** `CategoryAndProduct.getAllCategoryHierarchy()` returned `null` entries in the `productIds` list for categories that had no products in `ProductCategoryProduct`, but did have a `childCategories` entry with a null ID.

**Fix:** Added explicit null checks in both `categoryAndProductController.getCategoriesWithProducts()` (server-side) and `loadProductDetails()` (client-side, via `rows.map(r => r.productId)` already filtered upstream).

---

### Issue 2 — Flow Not Launching (Invalid Input Variable Type)

**Symptom:** `lightning-flow` threw a console error about invalid input variable types when `type: 'apex://...'` was used.

**Root Cause:** `dataManagerCapture.js-meta.xml` had `apex://` prefixed type declarations in its `propertyType` which are not supported as LWC property types in this context.

**Fix:** Replaced all `apex://` type references with `String` in the meta XML.

---

### Issue 3 — Flow Modal Clipped / Not Fullscreen

**Symptom:** The flow content was cut off at the bottom, only showing 40–50% of the flow screen.

**Root Cause:** SLDS `.slds-modal__content` has a hardcoded `max-height` and the `slds-modal_large` modifier still has a max-width less than viewport width.

**Fix:** Added `.flow-modal__container` and `.flow-modal__body` CSS classes with `!important` overrides for dimensions, `flex` layout for the container, and `flex: 1 1 auto; height: 100%; max-height: none` for the body.

---

### Issue 4 — Flow Output Variables Empty

**Symptom:** After flow finished, `event.detail.outputVariables` was an empty array.

**Root Cause:** Flow variables must have `isOutput = true` to be exposed to the hosting LWC through `statuschange`.

**Resolution:** Document that any flow variable you need back in the LWC must be marked `Available for output` in Flow Builder. The debug panel (`showCapturedData`) was added precisely to inspect this. The `dataManagerCapture` LWC inside the flow is the canonical capture mechanism — it fires `FlowAttributeChangeEvent` for each output variable reactively, and the flow XML wires each `Out_*` LWC property to its corresponding flow variable via `outputParameters`.

---

### Issue 5 — `Assign_DM_Outputs` Node Removed

**Symptom / Background:** The original flow had an `Assign_DM_Outputs` assignment node placed after the screen that copied `S01_DataManager.salesTransactionItems` → `Out_salesTransactionItems`. This ran only once after screen navigation and did not support multiple output properties cleanly.

**Resolution:** The assignment node was deleted. `dataManagerCapture` now owns all output variable population via `FlowAttributeChangeEvent` in each `@api` setter (Decision 7). The screen's connector to `Assign_DM_Outputs` was removed, making the screen the terminal node in the flow.

---

## TODO / Pending Work

### High Priority

- [ ] **Replace `TEST_TRANSACTION_ID`** — The flow's `In_Cfg_TransactionId` should receive the real Quote or Order record ID from the LWC's parent record page context (e.g., `@api recordId` from the parent component, passed down as a prop).

- [ ] **Replace `TEST_PRODUCT_BASED_ON`** — `In_AddedNode_ProductBasedOn` should be the product classification ID. This is typically available via a CPQ product attributes query or a SOQL on `ProductClassification` joined to the Product.

- [ ] **Replace `TEST_BUSINESS_OBJECT_TYPE`** — Derive from the parent record's `SObjectType` (Quote → `QuoteLineItem`, Order → `OrderItem`).

### Medium Priority

- [ ] **Wire `GetTransactionLineResult` into the flow** — Replace `buildMockResult()` with a real callout or SOQL query using `input.recordId` once the parent record context is available.

- [ ] **Support multi-product cart flow launches** — Currently one flow per "Configure" click. Consider whether the flow needs to be called with multiple `addedNodes` when the cart has multiple items.

- [ ] **Add `@api recordId`** to `categoryAndProductDuplicate` — Needed to dynamically resolve `transactionId` (Quote ID) from the record page.

### Low Priority

- [ ] **Remove or guard debug `System.debug` calls** — Production orgs have governor limits on debug logs. Wrap key logs in a `private static Boolean DEBUG_ENABLED = true/false;` flag.

- [ ] **Remove or reduce `console.log` in LWC** — Keep only error-level logging for production.

- [ ] **Test with real scratch org data** — Validate that IDs in `mockConfigContext.json` still match the target scratch org's products. Re-capture `actualConfigContext.json` after any org refresh.

- [ ] **Handle `subscriptionTerm` from CPQ API** — The CPQ `BulkProductDetailsRepresentation` does not surface `subscriptionTerm` directly. Investigate whether it is available on `ProductSellingModel` via SOQL (`ProductSellingModel.SubscriptionTerm`) and add a supplemental query if needed.

---

## Deployment Notes

### Deploy All Relevant Source

```bash
# From the guidedFlowPoc/ directory:
sf project deploy start --source-dir force-app --target-org <alias>
```

### Known Deployment Blockers (Already Fixed)

- `dataManagerCapture.js-meta.xml` — `type` attributes now use `apex://ProductConfig.*` syntax (e.g., `apex://ProductConfig.SalesTransactionItem[]`), matching the format expected by Flow Builder for Apex-typed screen component properties.

### Post-Deploy Verification

1. Navigate to a record page that hosts the `categoryAndProductDuplicate` component.
2. Pass the correct `rootCategoryId` as a component property.
3. Open browser DevTools → Console; look for `[loadProductDetails]` and `[categoryAndProductDuplicate]` prefixed logs.
4. Click "Configure" on any product; verify the flow modal opens fullscreen.
5. Proceed through the flow; click the **Finish** button rendered by `dataManagerCapture`.
6. After the flow finishes, inspect the **Flow Output Variables** debug panel — all five `Out_*` variables should be populated with the Data Manager's last-known values.

### CPQ Namespace

All CPQ Invocable Actions and representations use the `runtime_industries_cpq` namespace. Ensure the managed package is installed in the target org before deploying.

---

## Component Properties Reference (App Builder / Parent LWC)

To use `categoryAndProductDuplicate` on a record page:

```html
<c-category-and-product-duplicate
    root-category-id="<CPQ_ROOT_CATEGORY_ID>"
    selected-location-j-s-o-n={someLocationJson}>
</c-category-and-product-duplicate>
```

| Property | Type | Required | Notes |
|----------|------|----------|-------|
| `rootCategoryId` | String | Yes | ID of the root CPQ `ProductCategory` to browse |
| `selectedLocationJSON` | String | No | JSON string passed to the `managedWiFiAdvancedFlowCart` side panel |
