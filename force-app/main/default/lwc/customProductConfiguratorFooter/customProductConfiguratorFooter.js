/**
 * customProductConfiguratorFooter
 *
 * Replacement for dataManagerCapture.
 * Receives Data-Manager outputs via @api setter/getter pairs and fires
 * FlowAttributeChangeEvent to populate the flow's Out_* variables reactively.
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
 * Properties captured (same as dataManagerCapture):
 *   - salesTransactionItems  → Out_salesTransactionItems
 *   - transactionRecord      → Out_transactionRecord
 *   - attributeCategories    → Out_attributeCategories
 *   - optionGroups           → Out_optionGroups
 *   - summary                → Out_summary
 */
import { LightningElement, api, wire } from 'lwc';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CONFIGURATOR_RESULT
    from '@salesforce/messageChannel/ProductConfiguratorResult__c';

export default class CustomProductConfiguratorFooter extends LightningElement {

    // ── LMS wire ────────────────────────────────────────────────────────────
    @wire(MessageContext)
    messageContext;

    // ── Private backing fields ──────────────────────────────────────────────
    _salesTransactionItems;
    _transactionRecord;
    _attributeCategories;
    _optionGroups;
    _summary;

    // ─── salesTransactionItems ──────────────────────────────────────────────

    @api
    get salesTransactionItems() {
        return this._salesTransactionItems;
    }

    set salesTransactionItems(value) {
        this._salesTransactionItems = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_salesTransactionItems', value));
    }

    @api Out_salesTransactionItems;

    // ─── transactionRecord ──────────────────────────────────────────────────

    @api
    get transactionRecord() {
        return this._transactionRecord;
    }

    set transactionRecord(value) {
        this._transactionRecord = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_transactionRecord', value));
    }

    @api Out_transactionRecord;

    // ─── attributeCategories ────────────────────────────────────────────────

    @api
    get attributeCategories() {
        return this._attributeCategories;
    }

    set attributeCategories(value) {
        this._attributeCategories = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_attributeCategories', value));
    }

    @api Out_attributeCategories;

    // ─── optionGroups ───────────────────────────────────────────────────────

    @api
    get optionGroups() {
        return this._optionGroups;
    }

    set optionGroups(value) {
        this._optionGroups = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_optionGroups', value));
    }

    @api Out_optionGroups;

    // ─── summary ────────────────────────────────────────────────────────────

    @api
    get summary() {
        return this._summary;
    }

    set summary(value) {
        this._summary = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_summary', value));
    }

    @api Out_summary;

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
