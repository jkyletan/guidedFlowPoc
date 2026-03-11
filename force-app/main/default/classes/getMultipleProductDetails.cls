public with sharing class getMultipleProductDetails {

    /* ===============================
       OUTPUT WRAPPER
    =============================== */
    public class ProductInfo {
        @AuraEnabled public String productName;
        @AuraEnabled public Decimal price;
        @AuraEnabled public String description;
        @AuraEnabled public String displayUrl;
        @AuraEnabled public String sellingModelName;
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

        /* ===============================
           PREPARE BUSINESS API INPUT
        =============================== */
        Invocable.Action action =
            Invocable.Action.createStandardAction('getMultipleProductDetails');

        List<runtime_industries_cpq.BulkProductDetailsInputBody> productDataList =
            new List<runtime_industries_cpq.BulkProductDetailsInputBody>();

        for(Id prodId : productIds){
            runtime_industries_cpq.BulkProductDetailsInputBody body =
                new runtime_industries_cpq.BulkProductDetailsInputBody();
            body.productId = (String)prodId;
            productDataList.add(body);
        }

        runtime_industries_cpq.BulkProductDetailsInputBodyList productList =
            new runtime_industries_cpq.BulkProductDetailsInputBodyList();
        productList.productData = productDataList;

        action.setInvocationParameter('productDataInputs', productList);

        /* ===============================
           INVOKE API
        =============================== */
        List<Invocable.Action.Result> results = action.invoke();

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

                /* DESCRIPTION */
                info.description = product.description;

                /* DISPLAY URL */
                info.displayUrl = product.displayUrl;

                /* PRODUCT PRICE */
                if(product.prices != null && !product.prices.isEmpty()){
                    info.price = product.prices[0].price;
                }

                /* SELLING MODEL NAME */
                if(product.productSellingModelOptions != null &&
                   !product.productSellingModelOptions.isEmpty()){

                    runtime_industries_cpq.ProductSellingModelOptionOutputRepresentation opt =
                        product.productSellingModelOptions[0];

                    if(opt.productSellingModel != null){
                        info.sellingModelName = opt.productSellingModel.name;
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