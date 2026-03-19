/**
 * customProductConfiguratorFooter
 *
 * Replacement for dataManagerCapture.
 * Receives Data-Manager outputs via @api setter/getter pairs.
 *
 * The HTML renders ONLY a sticky footer bar with a "Finish" button aligned to the
 * right — no property debug display.
 *
 * On Finish click the component:
 *   1. Publishes all five captured properties over a Lightning Message Channel
 *      (ProductConfiguratorResult__c) so that any subscriber (e.g.
 *      categoryAndProductDuplicate) can receive them without waiting for the
 *      flow's FINISHED event.
 *   2. Fires FlowNavigationFinishEvent to close / complete the flow.
 *
 * Auto-Attribute Update feature:
 *   - Receives autoAttributeUpdatesJSON from the flow (sourced from
 *     Auto_Attribute_Update__mdt via the parent LWC).
 *   - Subscribes to the productConfigurator_notification channel to log
 *     VALUE_CHANGE events for debugging.
 *   - Once salesTransactionItems loads, publishes VALUE_CHANGE events on the
 *     configurator notification channel to auto-set attribute values.
 *
 * Properties captured:
 *   - salesTransactionItems
 *   - transactionRecord
 *   - attributeCategories
 *   - optionGroups
 *   - summary
 *   - autoAttributeUpdatesJSON
 */
import { LightningElement, api, wire } from 'lwc';
import { FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import PRODUCT_CONFIGURATOR_RESULT
    from '@salesforce/messageChannel/ProductConfiguratorResult__c';
import CONFIGR_CHANNEL
    from '@salesforce/messageChannel/lightning__productConfigurator_notification';

/* ── Constants mirroring the Data Manager LMS event/field contracts ────── */
const LMS_EVENTS = Object.freeze({
    VALUE_CHANGE: 'valueChanged',
    UPDATE_PRICES: 'updatePrices'
});

const STATE_FIELDS = Object.freeze({
    ATTRIBUTE_FIELD: 'AttributeField'
});

export default class CustomProductConfiguratorFooter extends LightningElement {

    // ── LMS wire ────────────────────────────────────────────────────────────
    @wire(MessageContext)
    messageContext;

    // ── Loading state ────────────────────────────────────────────────────────
    get isLoading() {
        return !this._salesTransactionItems || this._waitingForAutoAttributeResponse;
    }

    // ── Private backing fields ──────────────────────────────────────────────
    _salesTransactionItems;
    _transactionRecord;
    _attributeCategories;
    _optionGroups;
    _summary;
    _autoAttributeUpdatesJSON;

    /** Flag to ensure we only fire the auto-attribute update once */
    _hasPublishedAutoAttributes = false;

    /**
     * Flag that stays true from the moment we publish the auto-attribute
     * VALUE_CHANGE until the configurator responds by pushing a fresh
     * attributeCategories update.  Keeps the loading spinner visible so
     * the user sees the page only after the attribute value is applied.
     */
    _waitingForAutoAttributeResponse = false;

    /** LMS subscription handle for productConfigurator_notification */
    _configrSubscription = null;

    // ─── salesTransactionItems ──────────────────────────────────────────────

    @api
    get salesTransactionItems() {
        return this._salesTransactionItems;
    }

    set salesTransactionItems(value) {
        console.log('[customProductConfiguratorFooter] salesTransactionItems SET — value:', JSON.stringify(value));
        this._salesTransactionItems = value;

        // Once salesTransactionItems is available, attempt the auto-attribute publish
        if (value) {
            this._attemptAutoAttributePublish();
        }
    }

    // ─── transactionRecord ──────────────────────────────────────────────────

    @api
    get transactionRecord() {
        return this._transactionRecord;
    }

    set transactionRecord(value) {
        this._transactionRecord = value;
    }

    // ─── attributeCategories ────────────────────────────────────────────────

    @api
    get attributeCategories() {
        return this._attributeCategories;
    }

    set attributeCategories(value) {
        console.log('[customProductConfiguratorFooter] attributeCategories SET — value:', JSON.stringify(value));
        this._attributeCategories = value;

        // If we were waiting for the configurator to respond after our
        // auto-attribute publish, this re-push of attributeCategories means
        // it has processed the VALUE_CHANGE.  Clear the waiting flag so the
        // spinner hides and the user sees the updated attribute values.
        if (this._waitingForAutoAttributeResponse && this._hasPublishedAutoAttributes) {
            console.log('[customProductConfiguratorFooter] Configurator responded after auto-attribute publish — clearing loading state.');
            this._waitingForAutoAttributeResponse = false;
            if (this._autoAttributeTimeout) {
                clearTimeout(this._autoAttributeTimeout);
                this._autoAttributeTimeout = null;
            }
        }

        // attributeCategories may arrive after salesTransactionItems — re-attempt
        if (value) {
            this._attemptAutoAttributePublish();
        }
    }

    // ─── optionGroups ───────────────────────────────────────────────────────

    @api
    get optionGroups() {
        return this._optionGroups;
    }

    set optionGroups(value) {
        this._optionGroups = value;
    }

    // ─── summary ────────────────────────────────────────────────────────────

    @api
    get summary() {
        return this._summary;
    }

    set summary(value) {
        this._summary = value;
    }

    // ─── autoAttributeUpdatesJSON ───────────────────────────────────────────

    @api
    get autoAttributeUpdatesJSON() {
        return this._autoAttributeUpdatesJSON;
    }

    set autoAttributeUpdatesJSON(value) {
        console.log('[customProductConfiguratorFooter] autoAttributeUpdatesJSON SET — value:', value);
        this._autoAttributeUpdatesJSON = value;
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────────

    connectedCallback() {
        this._subscribeToConfigrChannel();
    }

    disconnectedCallback() {
        if (this._autoAttributeTimeout) {
            clearTimeout(this._autoAttributeTimeout);
            this._autoAttributeTimeout = null;
        }
    }

    // ─── Subscribe to productConfigurator_notification (debug listener) ─────

    _subscribeToConfigrChannel() {
        if (this._configrSubscription) return;
        this._configrSubscription = subscribe(
            this.messageContext,
            CONFIGR_CHANNEL,
            (message) => this._handleConfigrMessage(message)
        );
        console.log('[customProductConfiguratorFooter] Subscribed to productConfigurator_notification channel');
    }

    /**
     * Handler for ALL messages on the configurator notification channel.
     * Logs every event so we can inspect the payload structure of VALUE_CHANGE
     * and other events during debugging.
     */
    _handleConfigrMessage(message) {
        console.log('[customProductConfiguratorFooter] ── CONFIGR_CHANNEL message received ──');
        console.log('[customProductConfiguratorFooter] action:', message?.action);
        console.log('[customProductConfiguratorFooter] full payload:', JSON.stringify(message));

        if (message?.action === LMS_EVENTS.VALUE_CHANGE) {
            console.log('[customProductConfiguratorFooter] VALUE_CHANGE data:', JSON.stringify(message?.data));
        }
    }

    // ─── Auto-Attribute Publish Logic ───────────────────────────────────────

    /**
     * Attempts to publish VALUE_CHANGE events for each auto-attribute update
     * entry. Only fires once (guarded by _hasPublishedAutoAttributes).
     *
     * Prerequisites (all must be truthy before we fire):
     *   1. autoAttributeUpdatesJSON — the JSON from the flow variable
     *   2. salesTransactionItems    — loaded from Data Manager (gives us the item key / ref id)
     *   3. attributeCategories      — loaded from Data Manager (gives us code→ID resolution)
     *
     * Resolution logic:
     *   - The metadata stores attribute CODES (e.g. CCC_ATT_DOWNLOAD_SPEED)
     *     and picklist value CODES (e.g. CCC_PKLVAL_DOWNLOAD_SPEED_1000).
     *   - The VALUE_CHANGE payload requires Salesforce record IDs.
     *   - We scan attributeCategories to find the matching attribute by code,
     *     then scan its picklist values to find the matching value by code.
     */
    _attemptAutoAttributePublish() {
        if (this._hasPublishedAutoAttributes) {
            console.log('[customProductConfiguratorFooter] Auto-attribute updates already published — skipping.');
            return;
        }

        if (!this._autoAttributeUpdatesJSON) {
            console.log('[customProductConfiguratorFooter] No autoAttributeUpdatesJSON provided — nothing to auto-update.');
            return;
        }

        if (!this._salesTransactionItems || !Array.isArray(this._salesTransactionItems) || this._salesTransactionItems.length === 0) {
            console.log('[customProductConfiguratorFooter] salesTransactionItems not yet available — deferring auto-attribute publish.');
            return;
        }

        if (!this._attributeCategories || !Array.isArray(this._attributeCategories) || this._attributeCategories.length === 0) {
            console.log('[customProductConfiguratorFooter] attributeCategories not yet available — deferring auto-attribute publish.');
            return;
        }

        console.log('[customProductConfiguratorFooter] ── Beginning auto-attribute publish ──');
        console.log('[customProductConfiguratorFooter] salesTransactionItems count:', this._salesTransactionItems.length);
        console.log('[customProductConfiguratorFooter] salesTransactionItems[0] id:', this._salesTransactionItems[0]?.id);
        console.log('[customProductConfiguratorFooter] salesTransactionItems[0] ProductCode:', this._salesTransactionItems[0]?.ProductCode);
        console.log('[customProductConfiguratorFooter] attributeCategories count:', this._attributeCategories.length);

        // ── Parse auto-update entries ────────────────────────────────────
        let autoUpdates;
        try {
            autoUpdates = JSON.parse(this._autoAttributeUpdatesJSON);
            console.log('[customProductConfiguratorFooter] Parsed autoUpdates:', JSON.stringify(autoUpdates));
        } catch (e) {
            console.error('[customProductConfiguratorFooter] Failed to parse autoAttributeUpdatesJSON:', e);
            return;
        }

        if (!Array.isArray(autoUpdates) || autoUpdates.length === 0) {
            console.log('[customProductConfiguratorFooter] autoUpdates array is empty — nothing to publish.');
            return;
        }

        // ── Build a lookup map: attributeCode → { attributeId, productKey, valueCodeToId } ──
        // Flatten all attributes across all categories for easy lookup.
        // IMPORTANT: Each attribute carries a `productKey` array which contains the
        // correct ref ID(s) for the transaction line item that owns the attribute.
        // This is the key we MUST use in the VALUE_CHANGE payload — NOT
        // salesTransactionItems[0].id, because [0] may be a child item (e.g.
        // "Instant Connect") rather than the root product.
        const attributeLookup = {};
        for (const category of this._attributeCategories) {
            console.log('[customProductConfiguratorFooter] Scanning category:', category.code, '(', category.name, ')');
            if (!category.attributes) continue;

            for (const attr of category.attributes) {
                console.log('[customProductConfiguratorFooter]   Attribute code:', attr.code, '→ id:', attr.id, ', productKey:', JSON.stringify(attr.productKey));

                const valueMap = {};
                if (attr.attributePicklist?.values) {
                    for (const pv of attr.attributePicklist.values) {
                        console.log('[customProductConfiguratorFooter]     Picklist value code:', pv.code, '→ id:', pv.id);
                        valueMap[pv.code] = pv.id;
                    }
                }

                attributeLookup[attr.code] = {
                    attributeId: attr.id,
                    productKey: attr.productKey,  // e.g. ["ref_7702dcc8-..."]
                    valueCodeToId: valueMap
                };
            }
        }

        console.log('[customProductConfiguratorFooter] attributeLookup built:', JSON.stringify(attributeLookup));

        // ── Also find the root product item by matching ProductCode from metadata ──
        // This is a fallback — the primary key source is attributeCategories.productKey
        for (const item of this._salesTransactionItems) {
            console.log('[customProductConfiguratorFooter] salesTransactionItem — id:', item?.id, ', ProductCode:', item?.ProductCode);
        }

        // ── Resolve each auto-update entry to IDs and build payloads ─────
        const payloads = [];
        for (const update of autoUpdates) {
            console.log('[customProductConfiguratorFooter] Processing auto-update entry:', JSON.stringify(update));

            const attrEntry = attributeLookup[update.attributeCode];
            if (!attrEntry) {
                console.error('[customProductConfiguratorFooter] ✘ Could not find attribute with code "' + update.attributeCode + '" in attributeCategories. Skipping this entry.');
                continue;
            }

            const resolvedAttributeId = attrEntry.attributeId;
            const resolvedValueId = attrEntry.valueCodeToId[update.attributeValueCode];

            // Determine the correct key from the attribute's productKey.
            // The native configurator VALUE_CHANGE uses key as an ARRAY of ref IDs,
            // e.g. ["ref_02ca7908-a4e8-47b2-b1ec-ce6ddfbde82a"].
            // The productKey on each attribute in attributeCategories is already in
            // that exact format, so we use it directly.
            let targetKey = null;
            const rawProductKey = attrEntry.productKey;

            console.log('[customProductConfiguratorFooter] Resolved attributeCode "' + update.attributeCode + '" → attributeId:', resolvedAttributeId);
            console.log('[customProductConfiguratorFooter] Resolved attributeValueCode "' + update.attributeValueCode + '" → valueId:', resolvedValueId);
            console.log('[customProductConfiguratorFooter] Raw productKey from attribute:', JSON.stringify(rawProductKey));

            if (rawProductKey && Array.isArray(rawProductKey) && rawProductKey.length > 0) {
                targetKey = rawProductKey;  // Keep as array — matches native VALUE_CHANGE format
                console.log('[customProductConfiguratorFooter] Using productKey array as targetKey:', JSON.stringify(targetKey));
            }

            if (!targetKey) {
                // Fallback: find the salesTransactionItem whose ProductCode matches
                console.warn('[customProductConfiguratorFooter] No productKey on attribute — falling back to ProductCode match in salesTransactionItems.');
                const matchingItem = this._salesTransactionItems.find(
                    item => item?.ProductCode === update.productCode
                );
                if (matchingItem) {
                    targetKey = [matchingItem.id || matchingItem.Id];  // Wrap in array to match native format
                    console.log('[customProductConfiguratorFooter] Fallback: matched ProductCode "' + update.productCode + '" → key:', JSON.stringify(targetKey));
                } else {
                    console.error('[customProductConfiguratorFooter] ✘ Fallback failed — no salesTransactionItem with ProductCode "' + update.productCode + '". Skipping.');
                    continue;
                }
            }

            if (!resolvedValueId) {
                console.error('[customProductConfiguratorFooter] ✘ Could not find picklist value with code "' + update.attributeValueCode + '" for attribute "' + update.attributeCode + '". Skipping.');
                console.log('[customProductConfiguratorFooter] Available value codes for this attribute:', Object.keys(attrEntry.valueCodeToId));
                continue;
            }

            const payload = {
                key: targetKey,
                field: STATE_FIELDS.ATTRIBUTE_FIELD,
                attributeId: resolvedAttributeId,
                value: resolvedValueId
            };

            console.log('[customProductConfiguratorFooter] ✔ Built VALUE_CHANGE payload:', JSON.stringify(payload));
            payloads.push(payload);
        }

        // ── Publish ──────────────────────────────────────────────────────
        if (payloads.length > 0) {
            console.log('[customProductConfiguratorFooter] Publishing VALUE_CHANGE with', payloads.length, 'attribute update(s)');
            console.log('[customProductConfiguratorFooter] Full publish message:', JSON.stringify({
                action: LMS_EVENTS.VALUE_CHANGE,
                data: payloads
            }));

            // Keep the loading spinner visible until the configurator responds
            // with an updated attributeCategories push.
            this._waitingForAutoAttributeResponse = true;

            publish(this.messageContext, CONFIGR_CHANNEL, {
                action: LMS_EVENTS.VALUE_CHANGE,
                data: payloads
            });

            console.log('[customProductConfiguratorFooter] ✔ VALUE_CHANGE published successfully. Waiting for configurator response...');
            this._hasPublishedAutoAttributes = true;

            // Safety-net: if the configurator never pushes back attributeCategories
            // (e.g. the event was silently dropped), clear the spinner after 10 s
            // so the user is not stuck indefinitely.
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            this._autoAttributeTimeout = setTimeout(() => {
                if (this._waitingForAutoAttributeResponse) {
                    console.warn('[customProductConfiguratorFooter] Timed out waiting for configurator response after auto-attribute publish. Clearing loading state.');
                    this._waitingForAutoAttributeResponse = false;
                }
            }, 10000);
        } else {
            console.warn('[customProductConfiguratorFooter] No valid payloads could be built from the auto-update entries. Nothing published.');
        }
    }

    // ─── Finish handler ─────────────────────────────────────────────────────

    handleFinish() {
        // 1. Publish all captured properties over the message channel
        const payload = {
            salesTransactionItems: this._salesTransactionItems,
            transactionRecord:     this._transactionRecord,
            attributeCategories:   this._attributeCategories,
            optionGroups:          this._optionGroups,
            summary:               this._summary
        };

        console.log('[customProductConfiguratorFooter] Publishing LMS payload:', JSON.stringify(payload));
        publish(this.messageContext, PRODUCT_CONFIGURATOR_RESULT, payload);

        // 2. Finish the flow
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}
