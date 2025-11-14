document.addEventListener('DOMContentLoaded', () => {
    const trackingForm = document.getElementById('tracking-form');
    const trackingNumberInput = document.getElementById('tracking-number-input');
    const statusElement = document.getElementById('tracking-status');
    const submitButton = trackingForm.querySelector('button[type="submit"]');

    trackingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const trackingNumber = trackingNumberInput.value.trim();

        if (!trackingNumber) {
            statusElement.textContent = 'Please enter a tracking number.';
            return;
        }

        window.location.href = `track-result.html?trackingNumber=${trackingNumber}`;
    });
});