import { LightningElement, api } from 'lwc';

export default class FlowMiniCartChild extends LightningElement {
    _selectionJson = '{}';
    _items = [];

    @api title = 'Mini-cart';
    @api scope = 'all';       // 'all' | 'current'
    @api instanceKey = 'default';

    @api cartItems;
    @api selectedLocation;

    ServiceLocationDetails = [];

    @api
    get selectionJson() {
        return this._selectionJson;
    }
    set selectionJson(value) {
        this._selectionJson = (typeof value === 'string' && value.trim() !== '') ? value : '{}';
        this.rebuild();
        console.log('selectionJson: ' + JSON.stringify(this.selectionJson));
    }

    get hasItems() {
        // return this._items.length > 0;
        return this.cartItems.length > 0;
    }

    get items() {
        // return this._items;
        return this.cartItems;
    }

    get itemsCount() {
        // return this._items.length;
        return this.cartItems.length;
    }

    // get totalCost() {
    //     return this._items.reduce((sum, item) => {
    //         return sum + (item.price || 0) * (item.qty || 0);
    //     }, 0);
    // }

    // get totalCost() {
    //     return this._items.reduce((sum, item) => {
    //         const isMonthly =
    //             item.parentProductSellingModel === 'Term Based - Monthly';

    //         const price = isMonthly ? (item.price || 0) : 0;
    //         const qty = item.qty || 1;

    //         return sum + (price * qty);
    //     }, 0);
    // }
    get totalCost() {
        return this.cartItems.reduce((sum, item) => {
            const isMonthly =
                item.sellingModel === 'Term Based - Monthly';

            const price = isMonthly ? (item.price || 0) : 0;
            const qty = item?.qty || 1;

            return sum + (price * qty);
        }, 0);
    }

    // get oneTimeTotal() {
    //     return this._items.reduce((sum, item) => {
    //         let itemTotal = 0;

    //         const qty = Number(item.qty) || 1;
    //         console.log('item.parentProductSellingModel: '+item.parentProductSellingModel);

    //         if (item.parentProductSellingModel === 'One Time') {
    //             itemTotal += (Number(item.price) || 0) * qty;
    //         }

    //         if (item.childProductSellingModel === 'One Time') {
    //             itemTotal += (Number(item.ChildProductPrice) || 0);
    //         }

    //         return sum + itemTotal;
    //     }, 0);
    // }
    get oneTimeTotal() {
        return this.cartItems.reduce((sum, item) => {
            let itemTotal = 0;

            const qty = Number(item.qty) || 1;

            if (item.sellingModel === 'One Time') {
                itemTotal += (Number(item.price) || 0) * qty;
            }

            // if (item.childProductSellingModel === 'One Time') {
            //     itemTotal += (Number(item.ChildProductPrice) || 0);
            // }

            return sum + itemTotal;
        }, 0);
    }

    get formattedTotal() {
        return `$${(Number(this.totalCost.toFixed(2)) + Number(this.oneTimeTotal.toFixed(2))).toFixed(2)}`;
    }

    get formattedMRC() {
        return `$${this.totalCost.toFixed(2)}`;
    }

    get formattedOneTimeTotal() {
        return `$${this.oneTimeTotal.toFixed(2)}`;
    }

    get hasMonthlyTotal() {
        return this.totalCost > 0;
    }

    get hasOneTimeTotal() {
        return this.oneTimeTotal > 0;
    }

    get selectedServiceLocation() {
        return this.selectedLocation
            ? JSON.parse(this.selectedLocation)
            : null;
    }

    rebuild() {
        let parsed = {};
        this.ServiceLocationDetails = [];
        try {
            parsed = JSON.parse(this._selectionJson || '{}');
        } catch (e) {
            parsed = {};
        }

        // Gather all selected items across keys (running cart)
        let all = [];
        if (this.scope === 'current') {
            const arr = Array.isArray(parsed?.[this.instanceKey]) ? parsed[this.instanceKey] : [];
            all = arr;
        } else {
            /*for (const key of Object.keys(parsed || {})) {
                const arr = Array.isArray(parsed?.[key]) ? parsed[key] : [];
                all = all.concat(arr);
            }*/
            // for (const jsonKey of Object.keys(parsed || {})) {

            //     const arr = Array.isArray(parsed?.[jsonKey]) ? parsed[jsonKey] : [];

            //     console.log('arr: '+JSON.stringify(arr));

            //     if (jsonKey === 'SelectedLocation') {
            //         this.ServiceLocationDetails = this.ServiceLocationDetails.concat(arr);
            //         continue;
            //     }

            //     if (jsonKey === 'Selected Catalog') {
            //         continue;
            //     }

            //     all = all.concat(arr);
            // }
            for (const jsonKey of Object.keys(parsed || {})) {

                const arr = Array.isArray(parsed?.[jsonKey]) ? parsed[jsonKey] : [];

                for (const x of arr) {

                    if (!x || x.selected !== true || !x.id) continue;

                    if (jsonKey === 'SelectedLocation') {
                        this.ServiceLocationDetails.push(x);
                        continue;
                    }

                    if (jsonKey === 'Selected Catalog') {
                        continue;
                    }

                    all.push(x);
                }
            }
        }

        // Keep hierarchy: group by id + indentLevel (so duplicates at different levels stay separate)
        const groups = new Map();

        for (const x of all) {
            if (!x || x.selected !== true || !x.id) continue;

            const id = String(x.id);
            const name = x.name || '';

            const level = Math.max(0, Math.trunc(Number(x.indentLevel) || 0));

            const qtyRaw = x.qty;
            const qty =
                (qtyRaw === null || qtyRaw === undefined || qtyRaw === '')
                    ? null
                    : Number(qtyRaw);

            // Suppress only explicit 0 qty
            if (qty !== null && Number.isFinite(qty) && qty <= 0) continue;

            const key = `${id}::${level}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    id,
                    name,
                    level,
                    qty: Number.isFinite(qty) ? qty : 1,
                    price: Number.isFinite(x?.price) ? x?.price : null,
                    ChildProductName: x?.ChildProductName ? x?.ChildProductName : null,
                    ChildProductPrice: x?.ChildProductPrice ? x?.ChildProductPrice : null,
                    parentProductSellingModel: x?.parentProductSellingModel ? x?.parentProductSellingModel : null,
                    childProductSellingModel: x?.childProductSellingModel ? x?.childProductSellingModel : null
                });
                continue;
            }

            const existing = groups.get(key);

            // Prefer non-empty name
            if (!existing.name && name) existing.name = name;

            // Sum only if both are numeric; otherwise keep null
            const a = existing.qty;
            const b = Number.isFinite(qty) ? qty : null;

            if (a === null || b === null) existing.qty = null;
            else existing.qty = a + b;
        }

        this._items = Array.from(groups.values())
            // Sort by level then name (feels hierarchical)
            .sort((a, b) => (a.level - b.level) || (a.name || '').localeCompare(b.name || ''))
            .map((it) => ({
                ...it,
                prefix: it.level > 0 ? Array(it.level).fill('—').join(' ') + ' ' : ''
            }));
        console.log('this._ite: ' + JSON.stringify(this._items));
        console.log('this.ServiceLocationDetails: ' + JSON.stringify(this.ServiceLocationDetails));
    }
}