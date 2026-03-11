import { LightningElement, api, track } from 'lwc';

export default class FlowOrderSummary extends LightningElement {

    @api inputJson; // Flow input

    data;
    sections = [];

    oneTimeTotal = 0;
    monthlyTotal = 0;
    grandTotal = 0;
    totalUnits = 0;
    totalAccessPoints = 0;
    totalGateways = 0;
    totalSwitchunits = 0;

    connectedCallback() {
        try {
            if (this.inputJson) {
                // this.data = JSON.parse(this.inputJson);
                this.data = this.inputJson;
                this.processData();
            }
        } catch (e) {
            console.log('Error: ' + e?.message);
        }

    }

    // processData() {
    //     this.totalGateways = this.data?.gateways?.length || 0;
    //     this.totalSwitchunits = this.data?.switches?.length || 0;

    //     const sectionMap = {
    //         gateways: 'Gateways / Routers',
    //         switches: 'Switches',
    //         indooraps: 'Indoor Access Points',
    //         outdooraps: 'Outdoor Access Points',
    //         addons: 'Add-ons'
    //     };

    //     this.sections = [];

    //     Object.keys(sectionMap).forEach(key => {
    //         if (this.data[key]) {
    //             const items = this.data[key].map(item => {
    //                 const qty = item.qty ? item.qty : 1;
    //                 const price = item.price ? item.price : 0;
    //                 const lineTotal = qty * price;

    //                 this.totalUnits += qty;

    //                 if (key === 'indooraps' || key === 'outdooraps') {
    //                     this.totalAccessPoints += qty;
    //                 }

    //                 if (item.parentProductSellingModel === 'One Time') {
    //                     this.oneTimeTotal += lineTotal;
    //                 } else {
    //                     this.monthlyTotal += lineTotal;
    //                 }

    //                 if (item.ChildProductPrice) {
    //                     this.oneTimeTotal += item.ChildProductPrice;
    //                 }

    //                 return {
    //                     ...item,
    //                     qtyDisplay: qty,
    //                     displayPrice: lineTotal.toFixed(2),
    //                     sellingModel: item.parentProductSellingModel,
    //                     childFee: item.ChildProductPrice
    //                         ? {
    //                             name: item.ChildProductName,
    //                             price: item.ChildProductPrice
    //                         }
    //                         : null
    //                 };
    //             });

    //             this.sections.push({
    //                 key: key,
    //                 label: sectionMap[key],
    //                 items: items
    //             });
    //         }
    //     });

    //     this.grandTotal = (this.oneTimeTotal + this.monthlyTotal).toFixed(2);
    //     this.oneTimeTotal = this.oneTimeTotal.toFixed(2);
    //     this.monthlyTotal = this.monthlyTotal.toFixed(2);
    // }
    processData() {
        // Reset totals
        this.sections = [];
        this.totalUnits = 0;
        this.totalAccessPoints = 0;
        this.oneTimeTotal = 0;
        this.monthlyTotal = 0;

        if (!Array.isArray(this.data)) {
            return;
        }

        // Category → Section Label mapping
        const categoryMap = {
            'Advanced Gateway / Router': 'Gateways / Routers',
            'Advanced Indoor AP': 'Indoor Access Points',
            'Advanced Outdoor AP': 'Outdoor Access Points',
            'Advanced Add-Ons': 'Add-ons',
            'Advanced Switches': 'Switches'
        };

        // Group products by category
        const groupedData = {};

        this.data.forEach(item => {
            const category = item.category || 'Others';

            if (!groupedData[category]) {
                groupedData[category] = [];
            }

            const qty = item.qty ? item.qty : 1;
            const price = item.price ? item.price : 0;
            const lineTotal = qty * price;

            this.totalUnits += qty;

            if (category === 'Advanced Indoor AP' || category === 'Advanced Outdoor AP') {
                this.totalAccessPoints += qty;
            }

            if (item.sellingModel === 'One Time') {
                this.oneTimeTotal += lineTotal;
            } else {
                this.monthlyTotal += lineTotal;
            }

            groupedData[category].push({
                ...item,
                qtyDisplay: qty,
                displayPrice: lineTotal.toFixed(2),
                sellingModel: item.sellingModel,
                id: item.productId,
                name: item.productName,
            });
        });

        // Build sections
        Object.keys(groupedData).forEach(category => {
            this.sections.push({
                key: category,
                label: categoryMap[category] || category,
                items: groupedData[category]
            });
        });

        // Final totals
        this.oneTimeTotal = this.oneTimeTotal.toFixed(2);
        this.monthlyTotal = this.monthlyTotal.toFixed(2);
        this.grandTotal = (
            parseFloat(this.oneTimeTotal) +
            parseFloat(this.monthlyTotal)
        ).toFixed(2);

        // Gateway & Switch count (optional if needed)
        this.totalGateways = groupedData['Advanced Gateway / Router']?.length || 0;
        this.totalSwitchunits = groupedData['Advanced Switches']?.length || 0;
    }
}