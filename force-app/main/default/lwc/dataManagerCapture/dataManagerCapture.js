/**
 * dataManagerCapture
 *
 * Receives every Data Manager output as a direct flow input property
 * (passed via inputParameters in the flow screen field) and displays
 * all values for debugging / downstream use.
 *
 * No LMS subscription needed — the flow screen runtime keeps these
 * @api props in sync automatically whenever the Data Manager updates.
 *
 * Input property → Data Manager output it mirrors
 * ─────────────────────────────────────────────────
 * dm_header                    ← S01_DataManager.header
 * dm_transactionRecord         ← S01_DataManager.transactionRecord
 * dm_summary                   ← S01_DataManager.summary
 * dm_userContext               ← S01_DataManager.userContext
 * dm_salesTransactionItems     ← S01_DataManager.salesTransactionItems
 * dm_optionGroups              ← S01_DataManager.optionGroups
 * dm_navigationRoute           ← S01_DataManager.navigationRoute
 * dm_messages                  ← S01_DataManager.messages
 * dm_areMessagesFixed          ← S01_DataManager.areMessagesFixed
 * dm_attributeCategories       ← S01_DataManager.attributeCategories
 * dm_eligiblePromotions        ← S01_DataManager.eligiblePromotions
 * dm_currencyCode              ← S01_DataManager.currencyCode
 * dm_layoutMode                ← S01_DataManager.layoutMode
 * dm_tabs                      ← S01_DataManager.tabs
 * dm_searchInfo                ← S01_DataManager.searchInfo
 * dm_contextMetadata           ← S01_DataManager.contextMetadata
 * dm_headerTitle               ← S01_DataManager.headerTitle
 * dm_rootProductId             ← S01_DataManager.rootProductId
 * dm_currentGroupName          ← S01_DataManager.currentGroupName
 * dm_searchResultOptionId      ← S01_DataManager.searchResultOptionId
 * dm_isInstantPricingToggleEnabled ← S01_DataManager.isInstantPricingToggleEnabled
 * dm_explainabilityEnabled     ← S01_DataManager.explainabilityEnabled
 * dm_favoriteData              ← S01_DataManager.favoriteData
 * dm_isDesignTime              ← S01_DataManager.isDesignTime
 * dm_showPrices                ← S01_DataManager.showPrices
 * dm_isInstantPricingEnabled   ← S01_DataManager.isInstantPricingEnabled
 * dm_isApiInProgress           ← S01_DataManager.isApiInProgress
 * dm_isNonBlockingEnabled      ← S01_DataManager.isNonBlockingEnabled
 * dm_isPriceRampEnabled        ← S01_DataManager.isPriceRampEnabled
 * dm_isGroupRampEnabled        ← S01_DataManager.isGroupRampEnabled
 * dm_isConfiguratorDisabled    ← S01_DataManager.isConfiguratorDisabled
 * dm_isClassContext             ← S01_DataManager.isClassContext
 * dm_showSummaryTotalSection   ← S01_DataManager.showSummaryTotalSection
 */
import { LightningElement, api } from 'lwc';

// Display label for each input property
const DISPLAY_ROWS = [
    { prop: 'dm_header',                        label: 'header'                        },
    { prop: 'dm_transactionRecord',             label: 'transactionRecord'             },
    { prop: 'dm_summary',                       label: 'summary'                       },
    { prop: 'dm_userContext',                   label: 'userContext'                   },
    { prop: 'dm_salesTransactionItems',         label: 'salesTransactionItems'         },
    { prop: 'dm_optionGroups',                  label: 'optionGroups'                  },
    { prop: 'dm_navigationRoute',               label: 'navigationRoute'               },
    { prop: 'dm_messages',                      label: 'messages'                      },
    { prop: 'dm_areMessagesFixed',              label: 'areMessagesFixed'              },
    { prop: 'dm_attributeCategories',           label: 'attributeCategories'           },
    { prop: 'dm_eligiblePromotions',            label: 'eligiblePromotions'            },
    { prop: 'dm_currencyCode',                  label: 'currencyCode'                  },
    { prop: 'dm_layoutMode',                    label: 'layoutMode'                    },
    { prop: 'dm_tabs',                          label: 'tabs'                          },
    { prop: 'dm_searchInfo',                    label: 'searchInfo'                    },
    { prop: 'dm_contextMetadata',               label: 'contextMetadata'               },
    { prop: 'dm_headerTitle',                   label: 'headerTitle'                   },
    { prop: 'dm_rootProductId',                 label: 'rootProductId'                 },
    { prop: 'dm_currentGroupName',              label: 'currentGroupName'              },
    { prop: 'dm_searchResultOptionId',          label: 'searchResultOptionId'          },
    { prop: 'dm_isInstantPricingToggleEnabled', label: 'isInstantPricingToggleEnabled' },
    { prop: 'dm_explainabilityEnabled',         label: 'explainabilityEnabled'         },
    { prop: 'dm_favoriteData',                  label: 'favoriteData'                  },
    { prop: 'dm_isDesignTime',                  label: 'isDesignTime'                  },
    { prop: 'dm_showPrices',                    label: 'showPrices'                    },
    { prop: 'dm_isInstantPricingEnabled',       label: 'isInstantPricingEnabled'       },
    { prop: 'dm_isApiInProgress',               label: 'isApiInProgress'               },
    { prop: 'dm_isNonBlockingEnabled',          label: 'isNonBlockingEnabled'          },
    { prop: 'dm_isPriceRampEnabled',            label: 'isPriceRampEnabled'            },
    { prop: 'dm_isGroupRampEnabled',            label: 'isGroupRampEnabled'            },
    { prop: 'dm_isConfiguratorDisabled',        label: 'isConfiguratorDisabled'        },
    { prop: 'dm_isClassContext',                label: 'isClassContext'                },
    { prop: 'dm_showSummaryTotalSection',       label: 'showSummaryTotalSection'       },
];

export default class DataManagerCapture extends LightningElement {

    // ─── Input properties (fed directly from the flow screen field) ─────────
    @api dm_header;
    @api dm_transactionRecord;
    @api dm_summary;
    @api dm_userContext;
    @api dm_salesTransactionItems;
    @api dm_optionGroups;
    @api dm_navigationRoute;
    @api dm_messages;
    @api dm_areMessagesFixed;
    @api dm_attributeCategories;
    @api dm_eligiblePromotions;
    @api dm_currencyCode;
    @api dm_layoutMode;
    @api dm_tabs;
    @api dm_searchInfo;
    @api dm_contextMetadata;
    @api dm_headerTitle;
    @api dm_rootProductId;
    @api dm_currentGroupName;
    @api dm_searchResultOptionId;
    @api dm_isInstantPricingToggleEnabled;
    @api dm_explainabilityEnabled;
    @api dm_favoriteData;
    @api dm_isDesignTime;
    @api dm_showPrices;
    @api dm_isInstantPricingEnabled;
    @api dm_isApiInProgress;
    @api dm_isNonBlockingEnabled;
    @api dm_isPriceRampEnabled;
    @api dm_isGroupRampEnabled;
    @api dm_isConfiguratorDisabled;
    @api dm_isClassContext;
    @api dm_showSummaryTotalSection;

    // ─── Display helpers ─────────────────────────────────────────────────────
    get displayRows() {
        return DISPLAY_ROWS.map(({ prop, label }) => {
            const value = this[prop];
            const hasValue = value !== undefined && value !== null;
            return {
                key: prop,
                label,
                value: this._format(value),
                hasValue,
                dotClass: hasValue ? 'dot dot-green' : 'dot dot-grey'
            };
        });
    }

    _format(value) {
        if (value === null || value === undefined) return '(not set)';
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            return String(value);
        }
    }

    // ─── Back button ─────────────────────────────────────────────────────────
    /**
     * Fires a bubbling, composed custom event so the parent component
     * (categoryAndProductDuplicate) can listen via ondmcaptureback and
     * navigate back to the product list.
     */
    handleBack() {
        this.dispatchEvent(new CustomEvent('dmcaptureback', { bubbles: true, composed: true }));
    }
}
