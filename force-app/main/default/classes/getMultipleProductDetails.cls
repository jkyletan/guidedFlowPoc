public with sharing class getMultipleProductDetails {

    /* ===============================
       OUTPUT WRAPPER
    =============================== */
    public class ProductInfo {
        @AuraEnabled public String productName;
        @AuraEnabled public String productCode;
        @AuraEnabled public Decimal price;
        @AuraEnabled public String pricebookEntryId;
        @AuraEnabled public String description;
        @AuraEnabled public String displayUrl;
        @AuraEnabled public String sellingModelName;
        @AuraEnabled public String productSellingModelId;
        @AuraEnabled public String sellingModelType;
        @AuraEnabled public String pricingTermUnit;
        @AuraEnabled public Integer subscriptionTerm;
        @AuraEnabled public List<String> childProductNames = new List<String>();
    }


    /* ===============================
       MAIN METHOD
    =============================== */
    @AuraEnabled
    public static List<ProductInfo> getProductDetails(List<Id> productIds) {

        if(productIds == null || productIds.isEmpty()){
            throw new AuraHandledException('Product Id list cannot be empty');
        }

        System.debug('═══ getProductDetails — received productIds (' + productIds.size() + '): ' + productIds);
        for(Integer i = 0; i < productIds.size(); i++){
            System.debug('  productIds[' + i + '] = ' + productIds[i] + ' (null? ' + (productIds[i] == null) + ')');
        }

        /* ===============================
           PREPARE & INVOKE — one action call per product
        =============================== */
        List<Invocable.Action.Result> results = new List<Invocable.Action.Result>();

        for(Id prodId : productIds){
            if(prodId == null) continue;

            Invocable.Action action =
                Invocable.Action.createStandardAction('getMultipleProductDetails');

            runtime_industries_cpq.BulkProductDetailsInputBody body =
                new runtime_industries_cpq.BulkProductDetailsInputBody();
            body.productId = (String)prodId;

            runtime_industries_cpq.BulkProductDetailsInputBodyList productList =
                new runtime_industries_cpq.BulkProductDetailsInputBodyList();
            productList.productData =
                new List<runtime_industries_cpq.BulkProductDetailsInputBody>{ body };

            action.setInvocationParameter('productDataInputs', productList);

            System.debug('Invoking getMultipleProductDetails for productId: ' + prodId);
            results.addAll(action.invoke());
        }

        System.debug('═══ getMultipleProductDetails RAW RESULTS ═══');
        System.debug('Result count: ' + results.size());
        for (Integer i = 0; i < results.size(); i++) {
            Invocable.Action.Result res = results[i];
            System.debug('--- Result[' + i + '] isSuccess: ' + res.isSuccess());
            if (!res.isSuccess()) {
                System.debug('--- Result[' + i + '] errors: ' + res.getErrors());
                continue;
            }
            Map<String,Object> rawOutput = res.getOutputParameters();
            System.debug('--- Result[' + i + '] outputParameters keys: ' + rawOutput.keySet());

            List<runtime_industries_cpq.BulkProductDetailsRepresentation> rawProducts =
                (List<runtime_industries_cpq.BulkProductDetailsRepresentation>)
                rawOutput.get('productDetailsOutputRepresentation');

            if (rawProducts == null) {
                System.debug('--- Result[' + i + '] productDetailsOutputRepresentation is NULL');
                continue;
            }
            System.debug('--- Result[' + i + '] product count: ' + rawProducts.size());

            for (Integer j = 0; j < rawProducts.size(); j++) {
                runtime_industries_cpq.BulkProductDetailsRepresentation p = rawProducts[j];
                System.debug('  ── Product[' + j + '] ───────────────────────────────');
                System.debug('     id:          ' + p.id);
                System.debug('     name:        ' + p.name);
                System.debug('     productCode: ' + p.productCode);
                System.debug('     description: ' + p.description);
                System.debug('     displayUrl:  ' + p.displayUrl);

                // Prices
                if (p.prices != null) {
                    for (Integer k = 0; k < p.prices.size(); k++) {
                        System.debug('     prices[' + k + ']: ' + p.prices[k]);
                    }
                } else {
                    System.debug('     prices: NULL');
                }

                // Selling model options
                if (p.productSellingModelOptions != null) {
                    for (Integer k = 0; k < p.productSellingModelOptions.size(); k++) {
                        runtime_industries_cpq.ProductSellingModelOptionOutputRepresentation opt =
                            p.productSellingModelOptions[k];
                        System.debug('     sellingModelOption[' + k + ']:');
                        if (opt.productSellingModel != null) {
                            System.debug('       productSellingModel.id:               ' + opt.productSellingModel.id);
                            System.debug('       productSellingModel.name:             ' + opt.productSellingModel.name);
                            System.debug('       productSellingModel.sellingModelType: ' + opt.productSellingModel.sellingModelType);
                            System.debug('       productSellingModel.pricingTermUnit:  ' + opt.productSellingModel.pricingTermUnit);
                        } else {
                            System.debug('       productSellingModel: NULL');
                        }
                    }
                } else {
                    System.debug('     productSellingModelOptions: NULL');
                }
            }
        }
        System.debug('═══ END getMultipleProductDetails RAW RESULTS ═══');

        /* ===============================
           EXTRACT REQUIRED DATA
        =============================== */
        List<ProductInfo> finalOutput = new List<ProductInfo>();

        for (Invocable.Action.Result res : results) {

            if(!res.isSuccess()) continue;

            Map<String,Object> output = res.getOutputParameters();

            List<runtime_industries_cpq.BulkProductDetailsRepresentation> products =
                (List<runtime_industries_cpq.BulkProductDetailsRepresentation>)
                output.get('productDetailsOutputRepresentation');

            if(products == null) continue;

            for(runtime_industries_cpq.BulkProductDetailsRepresentation product : products){

                ProductInfo info = new ProductInfo();

                /* PRODUCT NAME */
                info.productName = product.name;

                /* PRODUCT CODE */
                info.productCode = product.productCode;

                /* DESCRIPTION */
                info.description = product.description;

                /* DISPLAY URL */
                info.displayUrl = product.displayUrl;

                /* PRODUCT PRICE + PRICEBOOK ENTRY */
                if(product.prices != null && !product.prices.isEmpty()){
                    info.price           = product.prices[0].price;
                    info.pricebookEntryId = product.prices[0].priceBookEntryId;
                }

                /* SELLING MODEL DETAILS */
                if(product.productSellingModelOptions != null &&
                   !product.productSellingModelOptions.isEmpty()){

                    runtime_industries_cpq.ProductSellingModelOptionOutputRepresentation opt =
                        product.productSellingModelOptions[0];

                    if(opt.productSellingModel != null){
                        info.sellingModelName      = opt.productSellingModel.name;
                        info.productSellingModelId = opt.productSellingModel.id;
                        info.sellingModelType      = opt.productSellingModel.sellingModelType;
                        info.pricingTermUnit       = opt.productSellingModel.pricingTermUnit;
                    }
                }

                /* CHILD PRODUCT NAMES */
                if(product.productComponentGroups != null){
                    for(runtime_industries_cpq.ProductComponentGroupRepresentation grp :
                        product.productComponentGroups){

                        if(grp.components != null){
                            for(runtime_industries_cpq.BulkProductDetailsRepresentation child :
                                grp.components){

                                info.childProductNames.add(child.name);
                            }
                        }
                    }
                }

                finalOutput.add(info);
            }
        }

        System.debug('FINAL OUTPUT → ' + finalOutput);

        return finalOutput;
    }
}