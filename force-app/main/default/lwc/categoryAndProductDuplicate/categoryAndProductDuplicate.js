import { LightningElement, track, api, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { subscribe, MessageContext } from 'lightning/messageService';
import PRODUCT_CONFIGURATOR_RESULT
    from '@salesforce/messageChannel/ProductConfiguratorResult__c';
import getCategoriesWithProducts
    from '@salesforce/apex/categoryAndProductController.getCategoriesWithProducts';
import getProductDetails
    from '@salesforce/apex/getMultipleProductDetails.getProductDetails';
import getAutoAttributeUpdates
    from '@salesforce/apex/AutoAttributeUpdateController.getAutoAttributeUpdates';

export default class CpqConfigurator extends LightningElement {

    @api rootCategoryId;
    @api selectedLocationJSON;

    @track categoryProductMap = {};
    @track categories = [];
    @track currentStep = 1;
    @track products = [];
    @track cart = [];
    @track isReview = false;
    @track isLoading = false;

    @track showFlow = false;
    @track selectedProductId;

    // ── Selected product details (populated when Configure is clicked) ───────
    @track selectedProduct = null;

    // ── Data Manager captured variables (set when flow finishes) ─────────────
    @track capturedDmData = null;
    @track showCapturedData = false;

    // ── LMS: Product Configurator Result subscription ────────────────────────
    @wire(MessageContext)
    messageContext;

    // ── CurrentPageReference: provides recordId (transactionId) ──────────────
    _pageRef;
    @wire(CurrentPageReference)
    wiredPageRef(ref) {
        this._pageRef = ref;
    }

    /** The recordId from the current page (Quote or Order Id) */
    get recordId() {
        return this._pageRef?.state?.recordId
            || this._pageRef?.attributes?.recordId
            || null;
    }

    _lmsSubscription = null;

    /** Data received via LMS from customProductConfiguratorFooter */
    @track lmsReceivedData = null;
    @track showLmsReceivedData = false;

    /** JSON string of auto-attribute updates to pass into the flow */
    @track autoAttributeUpdatesJSON = null;

    get totalSteps() { return this.categories?.length || 0; }
    get currentCategory() {
        if (!this.categories || this.categories.length === 0) return null;
        return this.categories[this.currentStep - 1];
    }
    get isLastStep() { return this.currentStep === this.totalSteps; }
    get isFirstStep() { return this.currentStep === 1; }
    get hasProducts() { return this.products && this.products.length > 0; }

    connectedCallback() {
        this._subscribeToLms();
        this.loadCategoryProducts();
    }

    // ── LMS subscription ─────────────────────────────────────────────────────
    _subscribeToLms() {
        if (this._lmsSubscription) return; // already subscribed
        this._lmsSubscription = subscribe(
            this.messageContext,
            PRODUCT_CONFIGURATOR_RESULT,
            (message) => this._handleLmsMessage(message)
        );
        console.log('[categoryAndProductDuplicate] Subscribed to ProductConfiguratorResult LMS channel');
    }

    _handleLmsMessage(message) {
        console.log('[categoryAndProductDuplicate] LMS message received:', JSON.stringify(message));

        // Store the received product configuration data for future use
        this.lmsReceivedData = {
            salesTransactionItems: message.salesTransactionItems,
            transactionRecord:     message.transactionRecord,
            attributeCategories:   message.attributeCategories,
            optionGroups:          message.optionGroups,
            summary:               message.summary
        };
        this.showLmsReceivedData = true;

        // Close the flow modal — return user to the category/product view
        this.showFlow = false;
    }

    /** Converts lmsReceivedData into displayable rows for the debug panel */
    get lmsReceivedRows() {
        if (!this.lmsReceivedData) return [];
        return Object.keys(this.lmsReceivedData).map(key => ({
            key,
            value: this._formatDmValue(this.lmsReceivedData[key])
        }));
    }
    /* ============================
       FLOW INPUT VARIABLES
       Builds the configuratorContext Apex-defined variable directly and
       passes it as a single input to the flow.  This eliminates the old
       In_AddedNode_* / In_Cfg_* flat primitives and the two Decision +
       two Assignment nodes in the flow that reassembled them.
    ============================ */
    get flowInputVariables() {
        const p = this.selectedProduct || {};

        console.log('[categoryAndProductDuplicate] flowInputVariables — selectedProduct:', JSON.stringify(p));

        // ref_ id is generated fresh each time so the flow sees a unique line ref
        const refId = 'ref_' + this._generateUUID();

        // Derive businessObjectType from the parent/origin
        const origin = 'Quote';
        const businessObjectType = origin === 'Quote' ? 'QuoteLineItem' : 'OrderItem';

        // Build the configuratorContext object matching ProductConfig__ConfiguratorContext
        const configuratorContext = {
            transactionId:         this.recordId,
            transactionLineId:     refId,
            parentName:            origin,
            origin:                origin,
            explainabilityEnabled: false,
            addedNodes: [
                {
                    product:              p.productId             || null,
                    productName:          p.productName           || null,
                    productCode:          p.productCode           || null,
                    unitPrice:            p.price != null ? p.price : null,
                    quantity:             1,
                    pricebookEntry:       p.pricebookEntryId      || null,
                    productSellingModel:  p.productSellingModelId || null,
                    sellingModelType:     p.sellingModelType      || null,
                    pricingTermUnit:      p.pricingTermUnit       || null,
                    subscriptionTerm:     p.subscriptionTerm      || null,
                    id:                   refId,
                    productBasedOn:       null,
                    businessObjectType:   businessObjectType
                }
            ]
        };

        console.log('[categoryAndProductDuplicate] configuratorContext:', JSON.stringify(configuratorContext));

        const inputs = [
            {
                name: 'configuratorContext',
                type: 'SObject',
                value: configuratorContext
            }
        ];

        // ── Pass auto-attribute updates JSON into the flow ───────────────
        if (this.autoAttributeUpdatesJSON) {
            inputs.push({
                name: 'autoAttributeUpdatesJSON',
                type: 'String',
                value: this.autoAttributeUpdatesJSON
            });
            console.log('[categoryAndProductDuplicate] Adding autoAttributeUpdatesJSON to flow inputs:', this.autoAttributeUpdatesJSON);
        } else {
            console.log('[categoryAndProductDuplicate] No autoAttributeUpdatesJSON to pass to flow.');
        }

        return inputs;
    }

    /** Simple UUID v4 generator used for ref_ ids */
    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
    }

    /** Converts the capturedDmData map into an array of { key, value } rows for display */
    get capturedDmRows() {
        if (!this.capturedDmData) return [];
        return Object.keys(this.capturedDmData).map(key => ({
            key,
            value: this._formatDmValue(this.capturedDmData[key])
        }));
    }

    _formatDmValue(value) {
        if (value === null || value === undefined) return '(not set)';
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            return String(value);
        }
    }

    get steps() {
        return Array.from({ length: this.totalSteps }, (_, i) => ({
            number: i + 1,
            cssClass: i + 1 <= this.currentStep
                ? 'step-dot active'
                : 'step-dot'
        }));
    }

    async loadCategoryProducts() {
        try {
            this.isLoading = true;
            const result = await getCategoriesWithProducts({ rootCategoryId: this.rootCategoryId });
            if (!result || result.length === 0) {
                this.categoryProductMap = {};
                this.categories = [];
                return;
            }

            let map = {};
            result.forEach(row => {
                if (!row || !row.categoryName) return;
                if (!map[row.categoryName]) map[row.categoryName] = [];
                map[row.categoryName].push(row);
            });

            this.categoryProductMap = map;
            this.categories = Object.keys(map);

            if (this.categories.length > 0) await this.loadProductDetails();
        } catch (error) {
            console.error('Category load failed', error);
        } finally {
            this.isLoading = false;
        }
    }

    async loadProductDetails() {
        try {
            this.isLoading = true;

            const rows = this.categoryProductMap[this.currentCategory] || [];
            if (!rows.length) {
                this.products = [];
                return;
            }

            const productIds = rows.map(r => r.productId);
            console.log('[loadProductDetails] rows from categoryProductMap:', JSON.stringify(rows));
            console.log('[loadProductDetails] productIds being sent to Apex:', JSON.stringify(productIds));
            console.log('[loadProductDetails] any nulls?', productIds.some(id => id == null));
            const result = await getProductDetails({ productIds });
            console.log('[loadProductDetails] raw result from Apex:', JSON.stringify(result));

            // Map Apex ProductInfo to products array
            this.products = rows.map((row, index) => {
                const info = result[index] || {};
                const isInCart = this.cart?.some(
                    cartItem => cartItem.productId === row.productId
                );
                return {
                    productId:             row.productId,
                    productName:           info.productName || row.productName || 'Product',
                    productCode:           info.productCode || '',
                    description:           info.description || '',
                    price:                 info.price || 0,
                    pricebookEntryId:      info.pricebookEntryId || '',
                    displayUrl:            info.displayUrl || '',
                    sellingModel:          info.sellingModelName || '',
                    productSellingModelId: info.productSellingModelId || '',
                    sellingModelType:      info.sellingModelType || '',
                    pricingTermUnit:       info.pricingTermUnit || '',
                    subscriptionTerm:      info.subscriptionTerm || '',
                    selected:  isInCart,
                    cardClass: isInCart ? 'product-card selected' : 'product-card',
                    category:  this.currentCategory
                };
            });

        } catch (error) {
            console.error('Product load failed', error);
            this.products = [];
        } finally {
            this.isLoading = false;
            console.log('products: ' + JSON.stringify(this.products));
        }
    }

    // Select product — toggles selection and updates cart
    handleSelectCheckbox(event) {
        const productId = event.currentTarget.dataset.id;

        let clickedProduct;

        // Toggle selection
        this.products = this.products.map(prod => {
            if (prod.productId === productId) {
                const newSelected = !prod.selected;

                clickedProduct = {
                    ...prod,
                    selected: newSelected,
                    cardClass: newSelected
                        ? 'product-card selected'
                        : 'product-card'
                };

                return clickedProduct;
            }

            return prod;
        });

        // Update cart
        const alreadyInCart = this.cart.some(p => p.productId === productId);

        if (alreadyInCart) {
            // Remove from cart
            this.cart = this.cart.filter(p => p.productId !== productId);
        } else if (clickedProduct?.selected) {
            // Add to cart
            this.cart = [...this.cart, clickedProduct];
        }
    }

    stopPropagation(event) {
        event.stopPropagation();
    }

    async handleConfigure(event) {
        event.stopPropagation();
        const productId = event.target.dataset.id;

        this.selectedProductId = productId;
        // Save full product details so flowInputVariables can map them
        this.selectedProduct = this.products.find(p => p.productId === productId) || null;
        console.log('[categoryAndProductDuplicate] handleConfigure — selectedProduct:', JSON.stringify(this.selectedProduct));

        // ── Query Auto_Attribute_Update__mdt for this product / step ─────
        this.autoAttributeUpdatesJSON = null;
        try {
            const productCode = this.selectedProduct?.productCode || '';
            const step = this.currentStep;
            console.log('[categoryAndProductDuplicate] Querying Auto_Attribute_Update__mdt — productCode:', productCode, ', step:', step);

            const records = await getAutoAttributeUpdates({ productCode, step });
            console.log('[categoryAndProductDuplicate] Auto attribute update records returned:', JSON.stringify(records));

            if (records && records.length > 0) {
                const mapped = records.map(r => ({
                    attributeCode: r.Attribute_Code__c,
                    attributeValueCode: r.Attribute_Value_Code__c,
                    productCode: r.Product_Code__c,
                    step: r.Step__c
                }));
                this.autoAttributeUpdatesJSON = JSON.stringify(mapped);
                console.log('[categoryAndProductDuplicate] autoAttributeUpdatesJSON set:', this.autoAttributeUpdatesJSON);
            } else {
                console.log('[categoryAndProductDuplicate] No auto attribute update records found for this product/step.');
                this.autoAttributeUpdatesJSON = null;
            }
        } catch (error) {
            console.error('[categoryAndProductDuplicate] Error querying Auto_Attribute_Update__mdt:', error);
            this.autoAttributeUpdatesJSON = null;
        }

        this.capturedDmData = null;
        this.showCapturedData = false;
        this.showFlow = true;   // open modal
    }
    /* ============================
      FLOW STATUS HANDLER
   ============================ */
    handleFlowStatusChange(event) {
        const status = event.detail.status;

        if (status === 'FINISHED' || status === 'FINISHED_SCREEN') {
            this.showFlow = false; // close modal, return to product list

            // ── Capture all output variables from the flow ─────────────────
            const outputVars = event.detail.outputVariables || [];
            console.log('[categoryAndProductDuplicate] Flow finished — raw outputVariables:', JSON.stringify(outputVars));

            if (outputVars.length > 0) {
                const dmData = {};
                outputVars.forEach(v => {
                    dmData[v.name] = v.value;
                });
                this.capturedDmData = dmData;
                this.showCapturedData = true;
                console.log('[categoryAndProductDuplicate] Captured DM data:', JSON.stringify(dmData));
            } else {
                console.warn('[categoryAndProductDuplicate] No output variables returned from the flow. ' +
                    'Ensure the flow variables you want exposed have isOutput=true.');
            }
        }
    }

    /* ============================
       CLOSE MODAL MANUALLY
    ============================ */
    closeFlow() {
        this.showFlow = false;
    }

    async handleNext() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            await this.loadProductDetails();
        }
    }

    async handleBack() {
        if (this.currentStep > 1) {
            this.currentStep--;
            await this.loadProductDetails();
        }
    }

    showReview() {
        this.isReview = true;
        console.log('cart details: ' + JSON.stringify(this.cart));
    }

    submitQuote() {
        console.log('Selected Cart', JSON.stringify(this.cart));
        alert('Quote Submitted');
    }
}