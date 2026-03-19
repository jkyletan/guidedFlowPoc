# Auto-Attribute Update — Feature Documentation

## Table of Contents

- [Executive Summary](#executive-summary)
- [How It Works (Non-Technical)](#how-it-works-non-technical)
- [Technical Deep Dive](#technical-deep-dive)
  - [Architecture Overview](#architecture-overview)
  - [Custom Metadata: Auto\_Attribute\_Update\_\_mdt](#custom-metadata-auto_attribute_update__mdt)
  - [Data Pipeline: From Metadata to Event](#data-pipeline-from-metadata-to-event)
  - [Code-to-ID Resolution](#code-to-id-resolution)
  - [The VALUE\_CHANGE Event](#the-value_change-event)
  - [Timing and Lifecycle](#timing-and-lifecycle)
  - [Error Handling and Debug Logging](#error-handling-and-debug-logging)
- [File Inventory](#file-inventory)
- [Adding New Auto-Attribute Rules](#adding-new-auto-attribute-rules)
- [Lessons Learned](#lessons-learned)

---

## Executive Summary

When a user selects a product to configure (e.g. "Fibre Broadband Platinum"), certain attributes should be pre-populated automatically — for example, the Download Speed should default to 1000 MBPS. Rather than hard-coding these defaults, we use **custom metadata records** to define the rules declaratively. An admin can add, modify, or remove auto-population rules without touching any code.

---

## How It Works (Non-Technical)

Think of this feature as a "recipe card" system:

1. **The recipe card** is a custom metadata record. It says: *"When someone configures Fibre Broadband Platinum at step 1, set Download Speed to 1000 MBPS."*

2. **The chef reads the card** — when the user clicks "Configure" on a product, the system looks up all recipe cards that match the product and step.

3. **The chef prepares the dish** — the system translates the human-readable codes on the card (like "CCC_ATT_DOWNLOAD_SPEED") into the internal IDs that Salesforce understands, then sends a message to the configurator saying "set this attribute to this value."

4. **The result** — by the time the configurator finishes loading, the attribute is already set. The user sees "1000 MBPS" pre-selected without having to choose it manually.

**Key benefits:**
- **No code changes needed** to add new auto-population rules — just create a new metadata record
- **Step-aware** — different attributes can be auto-set at different steps in the guided flow
- **Product-specific** — rules only apply to the product they're configured for

---

## Technical Deep Dive

### Architecture Overview

```
┌──────────────────────────────────┐
│  Auto_Attribute_Update__mdt      │  ← Declarative rules (admin-managed)
│  (Custom Metadata)               │
└──────────────┬───────────────────┘
               │ Apex SOQL query
               ▼
┌──────────────────────────────────┐
│  AutoAttributeUpdateController   │  ← Server-side: queries metadata
│  (Apex)                          │
└──────────────┬───────────────────┘
               │ @wire / imperative call
               ▼
┌──────────────────────────────────┐
│  categoryAndProductDuplicate     │  ← Parent LWC: maps records to JSON,
│  (LWC — Parent)                  │    passes as flow input variable
└──────────────┬───────────────────┘
               │ Flow input variable: autoAttributeUpdatesJSON
               ▼
┌──────────────────────────────────┐
│  Screen Flow                     │  ← Wires the variable to the footer
│  (Custom_Product_Configurator)   │
└──────────────┬───────────────────┘
               │ @api property binding
               ▼
┌──────────────────────────────────┐
│  customProductConfiguratorFooter │  ← Footer LWC: resolves codes → IDs,
│  (LWC — Footer)                  │    publishes VALUE_CHANGE on LMS
└──────────────┬───────────────────┘
               │ LMS publish
               ▼
┌──────────────────────────────────┐
│  Product Configurator            │  ← Standard SF component: receives
│  (Data Manager / LMS listener)   │    the event, updates the attribute
└──────────────────────────────────┘
```

### Custom Metadata: Auto\_Attribute\_Update\_\_mdt

The metadata type defines **what** to auto-populate and **when**.

| Field | API Name | Type | Description | Example |
|-------|----------|------|-------------|---------|
| Label | `MasterLabel` | Text | Human-readable name | Platinum Download Speed 1000 |
| Attribute Code | `Attribute_Code__c` | Text(255) | The code of the attribute to set | `CCC_ATT_DOWNLOAD_SPEED` |
| Attribute Value Code | `Attribute_Value_Code__c` | Text(255) | The code of the picklist value to select | `CCC_PKLVAL_DOWNLOAD_SPEED_1000` |
| Product Code | `Product_Code__c` | Text(255) | The `Product2.ProductCode` this rule applies to | `CCC_FIBER_BROADBAND_PLATINUM` |
| Step | `Step__c` | Number | The guided-flow step at which to apply this rule | `1` |

**Example record:**

```xml
<CustomMetadata>
    <label>Platinum Download Speed 1000</label>
    <values>
        <field>Attribute_Code__c</field>
        <value>CCC_ATT_DOWNLOAD_SPEED</value>
    </values>
    <values>
        <field>Attribute_Value_Code__c</field>
        <value>CCC_PKLVAL_DOWNLOAD_SPEED_1000</value>
    </values>
    <values>
        <field>Product_Code__c</field>
        <value>CCC_FIBER_BROADBAND_PLATINUM</value>
    </values>
    <values>
        <field>Step__c</field>
        <value>1.0</value>
    </values>
</CustomMetadata>
```

**Why codes instead of IDs?** Attribute IDs and picklist value IDs are org-specific. Codes are stable across sandboxes and production, making the metadata portable and deployable.

### Data Pipeline: From Metadata to Event

#### Step 1 — Query (Parent LWC → Apex)

When the user clicks "Configure" on a product, `categoryAndProductDuplicate` calls:

```javascript
const records = await getAutoAttributeUpdates({ productCode, step });
```

This invokes `AutoAttributeUpdateController.getAutoAttributeUpdates()`, which runs:

```sql
SELECT MasterLabel, DeveloperName, Attribute_Code__c,
       Attribute_Value_Code__c, Product_Code__c, Step__c
  FROM Auto_Attribute_Update__mdt
 WHERE Product_Code__c = :productCode
   AND Step__c = :step
```

#### Step 2 — Transform (Parent LWC)

The Apex results are mapped to a clean JSON structure and stored as a string:

```javascript
const mapped = records.map(r => ({
    attributeCode:      r.Attribute_Code__c,       // e.g. "CCC_ATT_DOWNLOAD_SPEED"
    attributeValueCode: r.Attribute_Value_Code__c,  // e.g. "CCC_PKLVAL_DOWNLOAD_SPEED_1000"
    productCode:        r.Product_Code__c,          // e.g. "CCC_FIBER_BROADBAND_PLATINUM"
    step:               r.Step__c                   // e.g. 1
}));
this.autoAttributeUpdatesJSON = JSON.stringify(mapped);
```

#### Step 3 — Pass to Flow (Parent LWC → Flow)

The JSON string is added to `flowInputVariables`:

```javascript
{
    name: 'autoAttributeUpdatesJSON',
    type: 'String',
    value: this.autoAttributeUpdatesJSON
}
```

#### Step 4 — Wire to Footer (Flow → Footer LWC)

The flow XML wires the variable to the footer's `@api` property:

```xml
<inputParameters>
    <name>autoAttributeUpdatesJSON</name>
    <value><elementReference>autoAttributeUpdatesJSON</elementReference></value>
</inputParameters>
```

#### Step 5 — Resolve and Publish (Footer LWC)

This is where the heavy lifting happens. See the next two sections.

### Code-to-ID Resolution

The metadata stores human-readable **codes**, but the Salesforce Product Configurator's VALUE_CHANGE event requires Salesforce **record IDs**. The footer LWC resolves codes to IDs using the `attributeCategories` data that the Data Manager provides.

**`attributeCategories` structure (simplified):**

```json
[{
  "code": "CCC_ATTRCAT_BROADBAND_SPEED",
  "name": "Broadband Speed",
  "attributes": [{
    "code": "CCC_ATT_DOWNLOAD_SPEED",
    "id": "0tjd50000001jnuAAA",          ← attribute ID
    "productKey": ["ref_02ca7908-..."],   ← transaction line item ref
    "attributePicklist": {
      "values": [{
        "code": "CCC_PKLVAL_DOWNLOAD_SPEED_1000",
        "id": "0v6d50000001dxDAAQ"        ← picklist value ID
      }]
    }
  }]
}]
```

**Resolution process:**

1. Build a lookup map by scanning all categories and attributes:
   ```
   attributeCode → { attributeId, productKey[], valueCodeToId{} }
   ```

2. For each auto-update entry, look up:
   - `attributeCode` → `attributeId` (e.g. `"0tjd50000001jnuAAA"`)
   - `attributeValueCode` → `valueId` via `valueCodeToId` (e.g. `"0v6d50000001dxDAAQ"`)
   - `productKey` → the ref ID array for the transaction line item (e.g. `["ref_02ca7908-..."]`)

### The VALUE\_CHANGE Event

The footer publishes a message on the `lightning__productConfigurator_notification` LMS channel. The payload structure must **exactly match** what the native configurator produces when a user manually changes an attribute.

**Payload format:**

```json
{
  "action": "valueChanged",
  "data": [{
    "key": ["ref_02ca7908-a4e8-47b2-b1ec-ce6ddfbde82a"],
    "field": "AttributeField",
    "attributeId": "0tjd50000001jnuAAA",
    "value": "0v6d50000001dxDAAQ"
  }]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `action` | String | Must be `"valueChanged"` |
| `data` | Array | Array of change objects (supports batch updates) |
| `data[].key` | **Array of Strings** | The ref ID(s) of the transaction line item that owns the attribute. **Must be an array**, not a string — the configurator silently ignores string keys. |
| `data[].field` | String | Must be `"AttributeField"` for attribute changes |
| `data[].attributeId` | String | The Salesforce ID of the attribute definition |
| `data[].value` | String | The Salesforce ID of the picklist value to select |

> **Critical:** The `key` field must be an **array** (e.g. `["ref_..."]`), not a plain string. The `productKey` from `attributeCategories` is already in this format. Passing a string causes the configurator to silently drop the event with no error message.

### Timing and Lifecycle

The auto-attribute publish must happen **after** the Data Manager has loaded both `salesTransactionItems` and `attributeCategories`. These arrive asynchronously via `@api` setters.

```
Timeline:
────────────────────────────────────────────────────────
  autoAttributeUpdatesJSON SET    (from flow variable)
  ↓
  Subscribed to CONFIGR_CHANNEL   (connectedCallback)
  ↓
  attributeCategories SET         (from Data Manager)
    → _attemptAutoAttributePublish() → defers (no salesTransactionItems yet)
  ↓
  salesTransactionItems SET       (from Data Manager)
    → _attemptAutoAttributePublish() → ✔ all prerequisites met → PUBLISH
  ↓
  VALUE_CHANGE fires → configurator updates attribute
  ↓
  attributeCategories SET again   (configurator re-pushes after update)
    → _attemptAutoAttributePublish() → skipped (_hasPublishedAutoAttributes = true)
────────────────────────────────────────────────────────
```

**Guard mechanism:** A `_hasPublishedAutoAttributes` boolean flag ensures the auto-update only fires once, even though `attributeCategories` and `salesTransactionItems` may be set multiple times as the configurator reacts to changes.

**`_attemptAutoAttributePublish()` prerequisites (all must be truthy):**

1. `_hasPublishedAutoAttributes === false`
2. `_autoAttributeUpdatesJSON` is a non-empty string
3. `_salesTransactionItems` is a non-empty array
4. `_attributeCategories` is a non-empty array

### Error Handling and Debug Logging

Every step of the pipeline is instrumented with `console.log` / `console.error` statements prefixed with the component name for easy filtering in the browser console.

**Log prefix pattern:** `[componentName] message`

**Key log points:**
- Metadata query results
- JSON parse success/failure
- Each category and attribute scanned during lookup build
- Each code → ID resolution result (✔ success or ✘ failure)
- The final payload before publish
- Publish confirmation

**Error scenarios handled:**
| Scenario | Behavior |
|----------|----------|
| No metadata records for product/step | Logs info, no JSON passed to flow |
| JSON parse failure | Logs error, aborts |
| Attribute code not found in `attributeCategories` | Logs error, skips that entry |
| Picklist value code not found | Logs error with available codes, skips that entry |
| No `productKey` on attribute | Falls back to matching `ProductCode` in `salesTransactionItems` |
| Fallback ProductCode not found | Logs error, skips that entry |

---

## File Inventory

| File | Type | Purpose |
|------|------|---------|
| `objects/Auto_Attribute_Update__mdt/Auto_Attribute_Update__mdt.object-meta.xml` | Custom Metadata Type | Object definition |
| `objects/Auto_Attribute_Update__mdt/fields/Attribute_Code__c.field-meta.xml` | Field | Attribute code field |
| `objects/Auto_Attribute_Update__mdt/fields/Attribute_Value_Code__c.field-meta.xml` | Field | Picklist value code field |
| `objects/Auto_Attribute_Update__mdt/fields/Product_Code__c.field-meta.xml` | Field | Product code field |
| `objects/Auto_Attribute_Update__mdt/fields/Step__c.field-meta.xml` | Field | Step number field |
| `customMetadata/Auto_Attribute_Update.Platinum_Download_Speed_1000.md-meta.xml` | Metadata Record | Example: Platinum → Download Speed 1000 |
| `classes/AutoAttributeUpdateController.cls` | Apex | Queries metadata records |
| `lwc/categoryAndProductDuplicate/categoryAndProductDuplicate.js` | LWC | Queries Apex, maps to JSON, passes to flow |
| `lwc/customProductConfiguratorFooter/customProductConfiguratorFooter.js` | LWC | Resolves codes → IDs, publishes VALUE_CHANGE |
| `flows/Custom_Product_Configurator_Flow.flow-meta.xml` | Flow | Wires `autoAttributeUpdatesJSON` variable to footer |

---

## Adding New Auto-Attribute Rules

To auto-populate a new attribute for a product:

1. **Identify the codes:**
   - **Attribute Code** — find it in Setup → Attribute Definitions, or in the `attributeCategories` JSON from the configurator (the `code` field on each attribute)
   - **Attribute Value Code** — the `code` field on the picklist value within the attribute's `attributePicklist.values` array
   - **Product Code** — the `Product2.ProductCode` of the root product

2. **Create a metadata record:**
   - Go to Setup → Custom Metadata Types → Auto Attribute Update → Manage Records
   - Or create an XML file under `customMetadata/` following the existing example

3. **Deploy** — no code changes required. The system will pick up the new record automatically.

**Example:** To auto-set Upload Speed to 100 for Gold products at step 1:

| Field | Value |
|-------|-------|
| Label | Gold Upload Speed 100 |
| Attribute_Code__c | `CCC_ATT_UPLOAD_SPEED` |
| Attribute_Value_Code__c | `CCC_PKLVAL_UPLOAD_SPEED_100` |
| Product_Code__c | `CCC_FIBER_BROADBAND_GOLD` |
| Step__c | `1` |

---

## Lessons Learned

### 1. The `key` field must be an array
The VALUE_CHANGE event's `key` field must be an **array of strings** (e.g. `["ref_..."]`), not a plain string. Passing a string causes the configurator to **silently ignore** the event — no error, no update, nothing in the console. This was discovered by comparing our published payload against a native user-triggered VALUE_CHANGE event captured via LMS subscription.

### 2. `salesTransactionItems[0]` is NOT the root product
The first item in `salesTransactionItems` is often a child product (e.g. "CPE" or "Instant Connect"), not the root product. Using `salesTransactionItems[0].id` as the key causes the error *"We couldn't find the Product with key ref_..."* The correct key comes from the `productKey` array on each attribute in `attributeCategories`.

### 3. Use codes, not IDs, in metadata
Attribute IDs and picklist value IDs change between orgs. The metadata stores portable codes, and the runtime resolution uses `attributeCategories` (which the Data Manager provides with full code→ID mappings) to translate at publish time.
