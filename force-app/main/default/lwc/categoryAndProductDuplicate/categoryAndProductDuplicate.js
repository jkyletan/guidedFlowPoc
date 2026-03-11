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
    ============================ */
    get flowInputVariables() {
        return [
            {
                name: 'productId',
                type: 'String',
                value: this.selectedProductId
            }
        ];
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
            const result = await getProductDetails({ productIds });

            // Map Apex ProductInfo to products array
            this.products = rows.map((row, index) => {
                const info = result[index] || {};
                const isInCart = this.cart?.some(
                    cartItem => cartItem.productId === row.productId
                );
                return {
                    productId: row.productId,
                    productName: info.productName || row.productName || 'Product',
                    description: info.description || '',
                    price: info.price || 0,
                    displayUrl: info.displayUrl || '',
                    sellingModel: info.sellingModelName || '',
                    selected: isInCart,
                    cardClass: isInCart
                        ? 'product-card selected'
                        : 'product-card',
                    category: this.currentCategory
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
        const productId = event.target.dataset.id;

        this.selectedProductId = productId;
        this.showFlow = true;   // open modal
    }
    /* ============================
      FLOW STATUS HANDLER
   ============================ */
    handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED' || event.detail.status === 'FINISHED_SCREEN') {
            this.showFlow = false; // close modal
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