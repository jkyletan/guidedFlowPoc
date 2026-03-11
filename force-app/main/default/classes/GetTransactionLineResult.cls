/**
 * Invocable Action: GetTransactionLineResult
 *
 * PURPOSE
 * -------
 * Simulates the ProductConfig__ConfiguratorContext pattern where a Flow
 * Apex-Defined Variable is pre-populated before the first Screen element.
 *
 * HOW TO USE IN FLOW BUILDER
 * --------------------------
 * 1. Create a Flow variable:
 *      API Name  : transactionLineResult
 *      Data Type : Apex-Defined
 *      Apex Class: TransactionLineResult
 *      ☑ Available for input   (mirrors the ConfiguratorContext pattern)
 *
 * 2. As the VERY FIRST element after Start, add an Action element:
 *      Action    : "Get Transaction Line Result"
 *      Store the output "Transaction Line Result" → {!transactionLineResult}
 *
 * This fires immediately when the flow loads, giving every downstream Screen
 * element access to a fully-populated TransactionLineResult variable —
 * exactly as ProductConfig__ConfiguratorContext is injected at launch.
 *
 * Replace buildMockResult() with a real callout/query when ready.
 */
public with sharing class GetTransactionLineResult {

    /* =========================================
       INPUT WRAPPER
       No required inputs — fires on flow load.
       Add fields here (e.g. recordId) when
       wiring up a real data source.
    ========================================= */
    public class FlowInput {
        @InvocableVariable(label='Record Id' required=false)
        public String recordId;
    }

    /* =========================================
       OUTPUT WRAPPER
       The single output is stored directly into
       the Flow's Apex-Defined variable.
    ========================================= */
    public class FlowOutput {
        @InvocableVariable(label='Transaction Line Result')
        public TransactionLineResult transactionLineResult;
    }

    /* =========================================
       INVOCABLE METHOD
    ========================================= */
    @InvocableMethod(
        label       = 'Get Transaction Line Result'
        description = 'Populates the TransactionLineResult Apex-Defined Variable on flow load. Place as the first Action element in the flow.'
        category    = 'Quote'
    )
    public static List<FlowOutput> execute(List<FlowInput> inputs) {

        List<FlowOutput> outputs = new List<FlowOutput>();

        for (FlowInput input : inputs) {
            FlowOutput output        = new FlowOutput();
            // TODO: pass input.recordId to a real service when ready
            output.transactionLineResult = buildMockResult();
            outputs.add(output);
        }

        return outputs;
    }

    /* =========================================
       PRIVATE: MOCK BUILDER
       Replace this method body with a real
       callout or query when ready.
    ========================================= */
    private static TransactionLineResult buildMockResult() {

        // ----- Root object -----
        TransactionLineResult result       = new TransactionLineResult();
        result.transactionLineId           = 'ref_ce62f961_6af6_4f5a_aa81_b890155bcb1a';
        result.transactionId               = '0Q0d50000012YoDCAU';
        result.parentName                  = 'Quote';
        result.origin                      = 'Quote';
        result.explainabilityEnabled       = false;

        // ----- Added node -----
        TransactionLineResult.AddedNode node = new TransactionLineResult.AddedNode();
        node.unitPrice           = 30.0;
        node.subscriptionTerm    = 1;
        node.sellingModelType    = 'Evergreen';
        node.quantity            = 1.0;
        node.productSellingModel = '0jPd50000000rAnEAI';
        node.productName         = 'Fibre Broadband Bronze';
        node.productCode         = 'CCC_FIBER_BROADBAND_BRONZE';
        node.productBasedOn      = '11Bd5000005gs5zEAA';
        node.product             = '01td5000004LI9LAAW';
        node.pricingTermUnit     = 'Months';
        node.pricebookEntry      = '01ud5000000Ujz4AAC';
        node.id                  = 'ref_ce62f961_6af6_4f5a_aa81_b890155bcb1a';
        node.businessObjectType  = 'QuoteLineItem';

        result.addedNodes.add(node);

        return result;
    }
}
