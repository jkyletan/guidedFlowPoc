/**
 * dataManagerCapture
 *
 * Receives properties from the Data Manager (S01_DataManager) via flow screen
 * inputParameter bindings. Every setter fires a FlowAttributeChangeEvent to
 * write the value into the corresponding Out_* flow output variable immediately,
 * so no assignment node is needed in the flow.
 *
 * Properties captured:
 *   - salesTransactionItems  → Out_salesTransactionItems  (ProductConfig__SalesTransactionItem[])
 *   - transactionRecord      → Out_transactionRecord      (ProductConfig__TransactionRecord)
 *   - attributeCategories    → Out_attributeCategories    (ProductConfig__AttributeCategory[])
 *   - optionGroups           → Out_optionGroups           (ProductConfig__OptionGroup[])
 *   - summary                → Out_summary                (ProductConfig__PricingSummary)
 */
import { LightningElement, api } from 'lwc';
import { FlowAttributeChangeEvent, FlowNavigationFinishEvent } from 'lightning/flowSupport';

export default class DataManagerCapture extends LightningElement {

    _salesTransactionItems;
    _transactionRecord;
    _attributeCategories;
    _optionGroups;
    _summary;

    // ─── salesTransactionItems ───────────────────────────────────────────────

    @api
    get salesTransactionItems() {
        return this._salesTransactionItems;
    }

    set salesTransactionItems(value) {
        this._salesTransactionItems = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_salesTransactionItems', value));
    }

    @api Out_salesTransactionItems;

    // ─── transactionRecord ───────────────────────────────────────────────────

    @api
    get transactionRecord() {
        return this._transactionRecord;
    }

    set transactionRecord(value) {
        this._transactionRecord = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_transactionRecord', value));
    }

    @api Out_transactionRecord;

    // ─── attributeCategories ─────────────────────────────────────────────────

    @api
    get attributeCategories() {
        return this._attributeCategories;
    }

    set attributeCategories(value) {
        this._attributeCategories = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_attributeCategories', value));
    }

    @api Out_attributeCategories;

    // ─── optionGroups ────────────────────────────────────────────────────────

    @api
    get optionGroups() {
        return this._optionGroups;
    }

    set optionGroups(value) {
        this._optionGroups = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_optionGroups', value));
    }

    @api Out_optionGroups;

    // ─── summary ─────────────────────────────────────────────────────────────

    @api
    get summary() {
        return this._summary;
    }

    set summary(value) {
        this._summary = value;
        this.dispatchEvent(new FlowAttributeChangeEvent('Out_summary', value));
    }

    @api Out_summary;

    // ─── display helpers ─────────────────────────────────────────────────────

    _fmt(value) {
        if (value === null || value === undefined) return '(not set)';
        try { return JSON.stringify(value, null, 2); } catch (e) { return String(value); }
    }

    get displaySalesTransactionItems() { return this._fmt(this._salesTransactionItems); }
    get displayTransactionRecord()     { return this._fmt(this._transactionRecord); }
    get displayAttributeCategories()   { return this._fmt(this._attributeCategories); }
    get displayOptionGroups()          { return this._fmt(this._optionGroups); }
    get displaySummary()               { return this._fmt(this._summary); }

    handleFinish() {
        this.dispatchEvent(new FlowNavigationFinishEvent());
    }
}
