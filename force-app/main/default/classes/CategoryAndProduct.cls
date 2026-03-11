public with sharing class CategoryAndProduct {

    /* =========================================
       CATEGORY WRAPPER (LWC SERIALIZABLE)
    ========================================= */
    public class Category {

        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String parentCategoryId;
        @AuraEnabled public String description;
        @AuraEnabled public Boolean hasSubCategories;
        @AuraEnabled public List<Id> productIds;

        public Category(){
            productIds = new List<Id>();
        }
    }


    /* =========================================
       PUBLIC ENTRY METHOD (LWC CALLABLE)
    ========================================= */
    @AuraEnabled(cacheable=true)
    public static List<Category> getAllCategoryHierarchy(String rootCategoryId) {

        System.debug('===== START CATEGORY LOAD =====');

        if (String.isBlank(rootCategoryId)) {
            return new List<Category>();
        }

        /* -----------------------------------------
           STEP 1 → LOAD ALL CATEGORIES (NO SOQL)
        ----------------------------------------- */
        Map<String, Category> categoryMap = new Map<String, Category>();
        Set<String> allCategoryIds = new Set<String>();

        fetchAllCategoriesRecursive(rootCategoryId, categoryMap, allCategoryIds);

        System.debug('Total categories found = ' + categoryMap.size());


        /* -----------------------------------------
           STEP 2 → BULK FETCH PRODUCTS (ONE SOQL)
        ----------------------------------------- */
        Map<Id, List<Id>> categoryToProducts = new Map<Id, List<Id>>();

        if (!allCategoryIds.isEmpty()) {

            for (ProductCategoryProduct mapping : [
                SELECT ProductId, ProductCategoryId
                FROM ProductCategoryProduct
                WHERE ProductCategoryId IN :allCategoryIds
            ]) {

                if (!categoryToProducts.containsKey(mapping.ProductCategoryId)) {
                    categoryToProducts.put(mapping.ProductCategoryId, new List<Id>());
                }

                categoryToProducts.get(mapping.ProductCategoryId)
                    .add(mapping.ProductId);
            }
        }

        System.debug('===== CATEGORY → PRODUCTS MAP =====');
        System.debug(categoryToProducts);


        /* -----------------------------------------
           STEP 3 → ATTACH PRODUCTS TO CATEGORY
        ----------------------------------------- */
        for (String catId : categoryMap.keySet()) {

            Id catIdAsId = Id.valueOf(catId);

            if (categoryToProducts.containsKey(catIdAsId)) {
                categoryMap.get(catId).productIds =
                    categoryToProducts.get(catIdAsId);
            }
        }

        System.debug('===== END CATEGORY LOAD =====');

        return categoryMap.values();
    }



    /* =========================================
       RECURSIVE CATEGORY FETCH
       (NO SOQL HERE)
    ========================================= */
    private static void fetchAllCategoriesRecursive(
        String categoryId,
        Map<String, Category> categoryMap,
        Set<String> allCategoryIds
    ) {

        try {

            if (categoryMap.containsKey(categoryId)) return;

            System.debug('Fetching category = ' + categoryId);

            /* ---------- BUSINESS API ---------- */
            Invocable.Action action =
                Invocable.Action.createStandardAction('getCategoryDetails');

            action.setInvocationParameter('categoryId', categoryId);

            List<Invocable.Action.Result> results = action.invoke();

            if (results == null || results.isEmpty() || !results[0].isSuccess()) {
                System.debug('Action failed for category = ' + categoryId);
                return;
            }

            Map<String,Object> output =
                (Map<String,Object>) results[0].getOutputParameters();

            if (output == null) return;

            runtime_industries_cpq.CategoryOutputRepresentation catRep =
                (runtime_industries_cpq.CategoryOutputRepresentation)
                output.get('categoryDetailsRepresentations');

            if (catRep == null) return;


            /* ---------- STORE CATEGORY ---------- */
            Category c = new Category();
            c.id = catRep.id;
            c.name = catRep.name;
            c.parentCategoryId = catRep.parentCategoryId;
            c.description = catRep.description;
            c.hasSubCategories = catRep.hasSubCategories;

            categoryMap.put(c.id, c);
            allCategoryIds.add(c.id);


            /* ---------- RECURSE CHILDREN ---------- */
            if (catRep.childCategories != null && !catRep.childCategories.isEmpty()) {

                for (runtime_industries_cpq.CategoryOutputRepresentation child : catRep.childCategories) {

                    fetchAllCategoriesRecursive(child.id, categoryMap, allCategoryIds);
                }
            }

        }
        catch (Exception ex) {
            System.debug('Error fetching category ' + categoryId);
            System.debug(ex.getMessage());
        }
    }
}