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
 * Properties captured:
 *   - salesTransactionItems
 *   - transactionRecord
 *   - attributeCategories
 *   - optionGroups
 *   - summary
 */
import { LightningElement, api, wire } from 'lwc';
import { FlowNavigationFinishEvent } from 'lightning/flowSupport';
import { publish, MessageContext } from 'lightning/messageService';
import PRODUCT_CONFIGURATOR_RESULT
    from '@salesforce/messageChannel/ProductConfiguratorResult__c';

export default class CustomProductConfiguratorFooter extends LightningElement {

    // ── LMS wire ────────────────────────────────────────────────────────────
    @wire(MessageContext)
    messageContext;

    // ── Loading state ────────────────────────────────────────────────────────
    get isLoading() {
        return !this._salesTransactionItems;
    }

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
        this._attributeCategories = value;
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
