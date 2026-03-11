import { LightningElement, api, track } from 'lwc';

export default class LocationSelector extends LightningElement {

    @api locations;
    @api selectedLocationJSON;
    @api initialSelectedLocationJSON;

    @track processedLocations = [];

    // connectedCallback() {
    //     if (this.locations) {
    //         this.processedLocations = this.locations.map(loc => {
    //             return {
    //                 ...loc,
    //                 cardClass: 'location-card'
    //             };
    //         });

    //         this.locations = this.processedLocations;
    //     }
    // }
    connectedCallback() {
        let preselectedId = null;

        console.log('Initial seleted location details: '+JSON.stringify(this.initialSelectedLocationJSON));

        // If Flow already passed a selected value
        if (this.initialSelectedLocationJSON) {
            try {
                const parsed = JSON.parse(this.initialSelectedLocationJSON);
                preselectedId = parsed?.Id;
            } catch (e) {
                console.error('Invalid JSON passed:', e);   
            }
        }

        if (this.locations) {
            this.locations = this.locations.map(loc => {
                const isSelected = loc.Id === preselectedId;

                return {
                    ...loc,
                    selected: isSelected,
                    cardClass: isSelected
                        ? 'location-card selected'
                        : 'location-card'
                };
            });
        }
    }

    handleSelect(event) {
        const selectedId = event.currentTarget.dataset.id;
        let selectedRecord;

        this.locations = this.locations.map(loc => {
            const isSelected = loc.Id === selectedId;

            if (isSelected) {
                selectedRecord = loc;
            }
            return {
                ...loc,
                selected: isSelected,
                cardClass: loc.Id === selectedId
                    ? 'location-card selected'
                    : 'location-card'
            };
        });

        const recordDetails = {
            Id: selectedRecord?.Id,
            Name: selectedRecord?.Name,
            ServiceStreet: selectedRecord?.ServiceStreet,
            ServiceCity: selectedRecord?.ServiceCity,
            ServiceState: selectedRecord?.ServiceState,
            ServiceCountry: selectedRecord?.ServiceCountry,
            ServicePostalCode: selectedRecord?.ServicePostalCode
        };

        if (selectedRecord) {
            this.selectedLocationJSON = JSON.stringify(recordDetails);
        }
        console.log('Selected Location: ' + this.selectedLocationJSON);
    }
}