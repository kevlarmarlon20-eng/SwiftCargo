document.addEventListener('DOMContentLoaded', () => {
    const trackingForm = document.getElementById('tracking-form');
    const trackingNumberInput = document.getElementById('tracking-number-input');
    const statusElement = document.getElementById('tracking-status');
    const trackFormSection = document.querySelector('.track-form-section');
    const trackingResultsSection = document.getElementById('tracking-results');

    const summaryTrackingNumber = document.getElementById('summary-tracking-number');
    const summaryStatusText = document.getElementById('summary-status-text');
    const summaryDeliveryDate = document.getElementById('summary-delivery-date');
    const progressBar = trackingResultsSection.querySelector('.progress');
    const summaryOriginAddress = document.getElementById('summary-origin-address');
    const summaryDestinationAddress = document.getElementById('summary-destination-address');
    const shipmentTimeline = document.getElementById('shipment-timeline');
    const alertMessage = document.getElementById('alert-message');
    const trackingAlert = trackingResultsSection.querySelector('.track-alert');

    const detailService = document.getElementById('detail-service');
    const detailWeight = document.getElementById('detail-weight');
    const detailDimensions = document.getElementById('detail-dimensions');
    const detailContents = document.getElementById('detail-contents');
    const detailReference = document.getElementById('detail-reference');
    const detailCarrier = document.getElementById('detail-carrier');

    const senderName = document.getElementById('sender-name');
    const senderAddress = document.getElementById('sender-address');
    const senderPhone = document.getElementById('sender-phone');
    const receiverName = document.getElementById('receiver-name');
    const receiverAddress = document.getElementById('receiver-address');
    const receiverPhone = document.getElementById('receiver-phone');

    const showDetailsToggle = trackingResultsSection.querySelector('.show-details-toggle');
    const additionalDetails = trackingResultsSection.querySelector('.additional-details');

    // Simulate fetching tracking data
    async function fetchTrackingData(trackingNumber) {
        // In a real application, you would make an API call here.
        // For this example, we'll return dummy data.
        return new Promise(resolve => {
            setTimeout(() => {
                const dummyData = {
                    trackingNumber: trackingNumber,
                    status: 'In Transit',
                    estimatedDelivery: 'Nov 20, 2025',
                    progress: 75, // Percentage
                    origin: 'Los Angeles, CA, USA',
                    destination: 'New York, NY, USA',
                    alert: {
                        show: false,
                        message: 'Your package might be delayed due to unforeseen circumstances.'
                    },
                    history: [
                        { status: 'Package delivered', location: 'New York, NY, USA', date: 'Nov 15, 2025 10:30 AM' },
                        { status: 'Out for delivery', location: 'New York, NY, USA', date: 'Nov 15, 2025 08:00 AM' },
                        { status: 'In transit - Arrived at sorting facility', location: 'Chicago, IL, USA', date: 'Nov 14, 2025 06:00 PM' },
                        { status: 'Shipment picked up', location: 'Los Angeles, CA, USA', date: 'Nov 12, 2025 02:00 PM' },
                    ],
                    packageDetails: {
                        service: 'Express Shipping',
                        weight: '2.5 kg',
                        dimensions: '30x20x15 cm',
                        contents: 'Electronics',
                        reference: 'PO-98765',
                        carrier: 'SwiftCargo Logistics',
                    },
                    senderInfo: {
                        name: 'John Doe',
                        address: '123 Main St, Anytown, USA',
                        phone: '+1 (555) 123-4567'
                    },
                    receiverInfo: {
                        name: 'Jane Smith',
                        address: '456 Oak Ave, Otherville, USA',
                        phone: '+1 (555) 987-6543'
                    }
                };
                resolve(dummyData);
            }, 1000); // Simulate network delay
        });
    }

    function populateTrackingData(data) {
        summaryTrackingNumber.textContent = data.trackingNumber;
        summaryStatusText.textContent = data.status;
        summaryDeliveryDate.textContent = data.estimatedDelivery;
        progressBar.style.width = `${data.progress}%`;
        summaryOriginAddress.textContent = data.origin;
        summaryDestinationAddress.textContent = data.destination;

        // Populate timeline
        shipmentTimeline.innerHTML = ''; // Clear existing
        data.history.forEach(item => {
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item';
            timelineItem.innerHTML = `
                <span class="timeline-status">${item.status}</span>
                <span class="timeline-location">${item.location}</span>
                <span class="timeline-date">${item.date}</span>
            `;
            shipmentTimeline.appendChild(timelineItem);
        });

        // Handle alert
        if (data.alert.show) {
            trackingAlert.style.display = 'flex';
            alertMessage.textContent = data.alert.message;
        } else {
            trackingAlert.style.display = 'none';
        }

        // Populate package details
        detailService.textContent = data.packageDetails.service;
        detailWeight.textContent = data.packageDetails.weight;
        detailDimensions.textContent = data.packageDetails.dimensions;
        detailContents.textContent = data.packageDetails.contents;
        detailReference.textContent = data.packageDetails.reference;
        detailCarrier.textContent = data.packageDetails.carrier;

        // Populate sender/receiver info
        senderName.textContent = data.senderInfo.name;
        senderAddress.textContent = data.senderInfo.address;
        senderPhone.textContent = data.senderInfo.phone;
        receiverName.textContent = data.receiverInfo.name;
        receiverAddress.textContent = data.receiverInfo.address;
        receiverPhone.textContent = data.receiverInfo.phone;
    }

    trackingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const trackingNumber = trackingNumberInput.value.trim();

        if (!trackingNumber) {
            statusElement.textContent = 'Please enter a tracking number.';
            statusElement.className = 'form-status error';
            return;
        }

        statusElement.textContent = 'Tracking your package...';
        statusElement.className = 'form-status'; // Reset class

        try {
            const data = await fetchTrackingData(trackingNumber);
            populateTrackingData(data);

            trackFormSection.style.display = 'none';
            trackingResultsSection.style.display = 'block';
            statusElement.textContent = ''; // Clear status message
        } catch (error) {
            statusElement.textContent = `Error: ${error.message}`;
            statusElement.className = 'form-status error';
            trackingResultsSection.style.display = 'none';
            trackFormSection.style.display = 'block';
        }
    });

    // Toggle additional details
    showDetailsToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (additionalDetails.classList.contains('show')) {
            additionalDetails.classList.remove('show');
            showDetailsToggle.innerHTML = 'Show More Details &darr;';
        } else {
            additionalDetails.classList.add('show');
            showDetailsToggle.innerHTML = 'Show Less Details &uarr;';
        }
    });
});