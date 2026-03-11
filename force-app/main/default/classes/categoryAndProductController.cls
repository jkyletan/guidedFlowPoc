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

        for(CategoryAndProduct.Category c : cats){

            if(c.productIds == null) continue;

            for(Id pid : c.productIds){

                CategoryProductRow r = new CategoryProductRow();
                r.categoryId = c.id;
                r.categoryName = c.name;
                r.productId = pid;

                rows.add(r);
            }
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