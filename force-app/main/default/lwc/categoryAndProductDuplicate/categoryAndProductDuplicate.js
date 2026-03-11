import { LightningElement, track, api } from 'lwc';
import getCategoriesWithProducts
    from '@salesforce/apex/categoryAndProductController.getCategoriesWithProducts';
import getProductDetails
    from '@salesforce/apex/getMultipleProductDetails.getProductDetails';

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

    get totalSteps() { return this.categories?.length || 0; }
    get currentCategory() {
        if (!this.categories || this.categories.length === 0) return null;
        return this.categories[this.currentStep - 1];
    }
    get isLastStep() { return this.currentStep === this.totalSteps; }
    get isFirstStep() { return this.currentStep === 1; }
    get hasProducts() { return this.products && this.products.length > 0; }

    connectedCallback() {
        this.loadCategoryProducts();
    }
    /* ============================
       FLOW INPUT VARIABLES
       Maps the selected product's data onto the
       Custom_Product_Configurator_Flow input variables.

       Variables that are KNOWN are mapped directly from this.selectedProduct.
       Variables that are UNKNOWN are logged so you can identify the correct
       values and complete the mapping later.
    ============================ */
    get flowInputVariables() {
        const p = this.selectedProduct || {};

        console.log('[categoryAndProductDuplicate] flowInputVariables — selectedProduct:', JSON.stringify(p));

        // ── Test/fallback values taken directly from the flow's own defaults ──
        // Replace each TEST_* constant with a real dynamic value once available.
        const TEST_TRANSACTION_ID      = '0Q0d50000012YoDCAU';        // TODO: real Quote/Order recordId
        const TEST_PRODUCT_BASED_ON    = '11Bd5000005gs5zEAA';        // TODO: productClassification.id from Apex
        const TEST_BUSINESS_OBJECT_TYPE = 'QuoteLineItem';            // TODO: derive from parent object type

        // ref_ id is generated fresh each time so the flow sees a unique line ref
        const refId = 'ref_' + this._generateUUID();

        return [
            // ── AddedNode inputs ──────────────────────────────────────────
            {
                name: 'In_AddedNode_Product',
                type: 'String',
                value: p.productId || '01td5000004LI9LAAW'             // TEST: Bronze product Id
            },
            {
                name: 'In_AddedNode_ProductName',
                type: 'String',
                value: p.productName || 'Fibre Broadband Bronze'       // TEST
            },
            {
                name: 'In_AddedNode_ProductCode',
                type: 'String',
                value: p.productCode || 'CCC_FIBER_BROADBAND_BRONZE'   // TEST
            },
            {
                name: 'In_AddedNode_UnitPrice',
                type: 'Number',
                value: p.price != null ? p.price : 30.0               // TEST
            },
            {
                name: 'In_AddedNode_Quantity',
                type: 'Number',
                value: 1
            },
            {
                name: 'In_AddedNode_PricebookEntry',
                type: 'String',
                value: p.pricebookEntryId || '01ud5000000Ujz4AAC'      // TEST: Bronze pricebook entry
            },
            {
                name: 'In_AddedNode_ProductSellingModel',
                type: 'String',
                value: p.productSellingModelId || '0jPd50000000rAnEAI' // TEST: Evergreen - Monthly
            },
            {
                name: 'In_AddedNode_SellingModelType',
                type: 'String',
                value: p.sellingModelType || 'Evergreen'               // TEST
            },
            {
                name: 'In_AddedNode_PricingTermUnit',
                type: 'String',
                value: p.pricingTermUnit || 'Months'                   // TEST
            },
            {
                name: 'In_AddedNode_SubscriptionTerm',
                type: 'Number',
                value: p.subscriptionTerm || 1                         // TEST
            },
            {
                name: 'In_AddedNode_Id',
                type: 'String',
                value: refId
            },
            {
                name: 'In_AddedNode_ProductBasedOn',
                type: 'String',
                value: TEST_PRODUCT_BASED_ON                           // TODO: productClassification.id from Apex
            },
            {
                name: 'In_AddedNode_BusinessObjectType',
                type: 'String',
                value: TEST_BUSINESS_OBJECT_TYPE
            },
            // ── ConfiguratorContext inputs ────────────────────────────────
            {
                name: 'In_Cfg_TransactionId',
                type: 'String',
                value: TEST_TRANSACTION_ID
            },
            {
                name: 'In_Cfg_TransactionLineId',
                type: 'String',
                value: refId                                           // reuse the same ref_ id as the line
            },
            {
                name: 'In_Cfg_ParentName',
                type: 'String',
                value: 'Quote'
            },
            {
                name: 'In_Cfg_Origin',
                type: 'String',
                value: 'Quote'
            },
            {
                name: 'In_Cfg_ExplainabilityEnabled',
                type: 'Boolean',
                value: false
            }
        ];
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

    // Select product for quote
    // handleSelectCheckbox(event) {
    //     const productId = event.target.dataset.id;
    //     const checked = event.target.checked;

    //     this.products = this.products.map(p => {
    //         if (p.productId === productId) return { ...p, selected: checked };
    //         return p;
    //     });

    //     const product = this.products.find(p => p.productId === productId);
    //     if (!product) return;

    //     if (checked) {
    //         if (!this.cart.some(p => p.productId === productId)) {
    //             this.cart = [...this.cart, product];
    //         }
    //     } else {
    //         this.cart = this.cart.filter(p => p.productId !== productId);
    //     }
    // }
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

    handleConfigure(event) {
        event.stopPropagation();
        const productId = event.target.dataset.id;

        this.selectedProductId = productId;
        // Save full product details so flowInputVariables can map them
        this.selectedProduct = this.products.find(p => p.productId === productId) || null;
        console.log('[categoryAndProductDuplicate] handleConfigure — selectedProduct:', JSON.stringify(this.selectedProduct));

        this.capturedDmData = null;
        this.showCapturedData = false;
        this.showFlow = true;   // open modal
    }
    /* ============================
      FLOW STATUS HANDLER
   ============================ */
    handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED' || event.detail.status === 'FINISHED_SCREEN') {
            this.showFlow = false; // close modal

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
                    'Ensure the flow variables you want exposed have isOutput=true, ' +
                    'or capture them via the dataManagerCapture component inside the flow.');
            }
        }
    }

    /* ============================
       BACK FROM DATA MANAGER CAPTURE
       Fired when the user clicks "Back" inside the
       dataManagerCapture LWC (embedded in the flow screen).
       We re-open the flow modal so the user can continue configuring.
    ============================ */
    handleDmCaptureBack() {
        this.showCapturedData = false;
        this.showFlow = true;
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