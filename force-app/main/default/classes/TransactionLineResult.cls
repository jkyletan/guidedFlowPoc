/**
 * Apex-Defined Variable: TransactionLineResult
 *
 * This class defines the shape of the Flow variable (Data Type = Apex-Defined,
 * Apex Class = TransactionLineResult).  It mirrors the ProductConfig__ConfiguratorContext
 * pattern where the variable is declared in the Flow as "Available for input" and
 * populated at launch time — in our case by the GetTransactionLineResult invocable
 * action placed as the very first element in the flow.
 *
 * Outer class  → TransactionLineResult   (the root object / flow variable type)
 * Inner class  → AddedNode               (each element in addedNodes)
 */
public with sharing class TransactionLineResult {

    /* =========================================
       INNER CLASS: AddedNode
    ========================================= */
    public class AddedNode {

        @AuraEnabled public Decimal  unitPrice;
        @AuraEnabled public Integer  subscriptionTerm;
        @AuraEnabled public String   sellingModelType;
        @AuraEnabled public Decimal  quantity;
        @AuraEnabled public String   productSellingModel;
        @AuraEnabled public String   productName;
        @AuraEnabled public String   productCode;
        @AuraEnabled public String   productBasedOn;
        @AuraEnabled public String   product;
        @AuraEnabled public String   pricingTermUnit;
        @AuraEnabled public String   pricebookEntry;
        @AuraEnabled public String   id;
        @AuraEnabled public String   businessObjectType;
    }

    /* =========================================
       ROOT FIELDS
    ========================================= */
    @AuraEnabled public String          transactionLineId;
    @AuraEnabled public String          transactionId;
    @AuraEnabled public String          parentName;
    @AuraEnabled public String          origin;
    @AuraEnabled public Boolean         explainabilityEnabled;
    @AuraEnabled public List<AddedNode> addedNodes;

    public TransactionLineResult() {
        addedNodes = new List<AddedNode>();
    }
}
