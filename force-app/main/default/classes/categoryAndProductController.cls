public with sharing class categoryAndProductController {

    /* =========================================
       ROW FOR LWC
    ========================================= */
    public class CategoryProductRow {
        @AuraEnabled public String categoryId;
        @AuraEnabled public String categoryName;
        @AuraEnabled public Id productId;
    }


    /* =========================================
       LOAD CATEGORY + PRODUCT IDS
    ========================================= */
    @AuraEnabled(cacheable=true)
    public static List<CategoryProductRow> getCategoriesWithProducts(String rootCategoryId){

        List<CategoryProductRow> rows = new List<CategoryProductRow>();

        List<CategoryAndProduct.Category> cats =
            CategoryAndProduct.getAllCategoryHierarchy(rootCategoryId);

        System.debug('═══ getCategoriesWithProducts — category count: ' + cats.size());

        for(CategoryAndProduct.Category c : cats){

            System.debug('  Category: id=' + c.id + ' name=' + c.name
                + ' productIds=' + c.productIds
                + ' productIds.size=' + (c.productIds != null ? c.productIds.size() : -1));

            if(c.productIds == null) continue;

            for(Integer i = 0; i < c.productIds.size(); i++){
                Id pid = c.productIds[i];
                System.debug('    productIds[' + i + '] = ' + pid + ' (null? ' + (pid == null) + ')');

                if(pid == null){
                    System.debug('    ⚠ Skipping null productId at index ' + i + ' in category ' + c.name);
                    continue;
                }

                CategoryProductRow r = new CategoryProductRow();
                r.categoryId = c.id;
                r.categoryName = c.name;
                r.productId = pid;

                rows.add(r);
            }
        }

        System.debug('═══ getCategoriesWithProducts — final row count: ' + rows.size());
        for(Integer i = 0; i < rows.size(); i++){
            System.debug('  row[' + i + '] categoryName=' + rows[i].categoryName
                + ' productId=' + rows[i].productId);
        }

        return rows;
    }


    /* =========================================
       PRODUCT DETAILS (CALL SERVICE CLASS)
    ========================================= */
    @AuraEnabled
    public static List<getMultipleProductDetails.ProductInfo>
    getProductDetails(List<Id> productIds){

        return getMultipleProductDetails.getProductDetails(productIds);
    }
}