/**
 * AutoAttributeUpdateController
 *
 * Queries Auto_Attribute_Update__mdt custom metadata records and returns them
 * to the categoryAndProductDuplicate LWC so it can build the flow input
 * variable that tells the footer component which attributes to auto-populate.
 */
public with sharing class AutoAttributeUpdateController {

    /**
     * Returns all Auto_Attribute_Update__mdt records filtered by product code and step.
     *
     * @param productCode  The Product2.ProductCode of the product being configured
     * @param step         The current guided-flow step number (1-based)
     * @return             List of matching metadata records
     */
    @AuraEnabled(cacheable=true)
    public static List<Auto_Attribute_Update__mdt> getAutoAttributeUpdates(
            String productCode,
            Integer step
    ) {
        System.debug('[AutoAttributeUpdateController] getAutoAttributeUpdates called — productCode=' + productCode + ', step=' + step);

        List<Auto_Attribute_Update__mdt> records = [
            SELECT MasterLabel,
                   DeveloperName,
                   Attribute_Code__c,
                   Attribute_Value_Code__c,
                   Product_Code__c,
                   Step__c
              FROM Auto_Attribute_Update__mdt
             WHERE Product_Code__c = :productCode
               AND Step__c = :step
        ];

        System.debug('[AutoAttributeUpdateController] Returning ' + records.size() + ' record(s): ' + JSON.serialize(records));
        return records;
    }

    /**
     * Returns ALL Auto_Attribute_Update__mdt records (no filter).
     * Useful when the parent LWC wants to cache the full set client-side
     * and filter by product/step in JavaScript.
     */
    @AuraEnabled(cacheable=true)
    public static List<Auto_Attribute_Update__mdt> getAllAutoAttributeUpdates() {
        System.debug('[AutoAttributeUpdateController] getAllAutoAttributeUpdates called');

        List<Auto_Attribute_Update__mdt> records = [
            SELECT MasterLabel,
                   DeveloperName,
                   Attribute_Code__c,
                   Attribute_Value_Code__c,
                   Product_Code__c,
                   Step__c
              FROM Auto_Attribute_Update__mdt
        ];

        System.debug('[AutoAttributeUpdateController] Returning ' + records.size() + ' record(s): ' + JSON.serialize(records));
        return records;
    }
}
