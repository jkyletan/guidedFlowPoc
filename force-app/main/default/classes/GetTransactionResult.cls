/**
 * Invocable Action: GetTransactionResult
 *
 * PURPOSE
 * -------
 * Populates a ProductConfig__ConfiguratorContext Apex-Defined variable on
 * flow load — the same pattern used by the native CPQ configurator flow.
 *
 * HOW TO USE IN FLOW BUILDER
 * --------------------------
 * 1. Create a Flow variable:
 *      API Name  : configuratorContext
 *      Data Type : Apex-Defined
 *      Apex Class: ProductConfig__ConfiguratorContext
 *      ☑ Available for input   (mirrors the native ConfiguratorContext pattern)
 *
 * 2. As the VERY FIRST element after Start, add an Action element:
 *      Action    : "Get Transaction Result"
 *      Input     : Record Id → {!recordId}   (optional)
 *      Store the output "Configurator Context" → {!configuratorContext}
 *
 * This fires immediately when the flow loads, giving every downstream Screen
 * element access to a fully-populated ProductConfig__ConfiguratorContext —
 * exactly as the managed-package configurator flow injects it at launch.
 *
 * Replace buildMockContext() with a real callout/query when ready.
 */
public with sharing class GetTransactionResult {

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
        @InvocableVariable(label='Configurator Context')
        public ProductConfig__ConfiguratorContext configuratorContext;
    }

    /* =========================================
       INVOCABLE METHOD
    ========================================= */
    @InvocableMethod(
        label       = 'Get Transaction Result'
        description = 'Populates a ProductConfig__ConfiguratorContext Apex-Defined Variable on flow load. Place as the first Action element in the flow.'
        category    = 'Quote'
    )
    public static List<FlowOutput> execute(List<FlowInput> inputs) {

        List<FlowOutput> outputs = new List<FlowOutput>();

        for (FlowInput input : inputs) {
            FlowOutput output       = new FlowOutput();
            // TODO: pass input.recordId to a real service when ready
            output.configuratorContext = buildMockContext(input.recordId);
            outputs.add(output);
        }

        return outputs;
    }

    /* =========================================
       PRIVATE: MOCK BUILDER
       Replace this method body with a real
       callout or query when ready.
    ========================================= */
    private static ProductConfig__ConfiguratorContext buildMockContext(String recordId) {

        ProductConfig__ConfiguratorContext ctx = new ProductConfig__ConfiguratorContext();

        // ----- Identity fields -----
        ctx.currentTransactionLineId = recordId != null
            ? recordId
            : 'ref_ce62f961_6af6_4f5a_aa81_b890155bcb1a';

        ctx.transactionLineId        = ctx.currentTransactionLineId;
        ctx.currentTransaction       = ctx.currentTransactionLineId;
        ctx.transactionId            = '0Q0d50000012YoDCAU';

        // ----- Context metadata -----
        ctx.origin                   = 'Quote';
        ctx.parentName               = 'Quote';
        ctx.transactionLineGroupId   = '1C9d50000000aOTCAY';
        ctx.userContext              = null;

        // ----- Node list -----
        ctx.addedNodes               = new List<Object>();

        return ctx;
    }
}
