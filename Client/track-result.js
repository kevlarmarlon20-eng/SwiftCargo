document.addEventListener('DOMContentLoaded', () => {
    const resultsContainer = document.getElementById('results-container');
    const trackingNumber = new URLSearchParams(window.location.search).get('trackingNumber');

    if (!trackingNumber) {
        resultsContainer.innerHTML = '<p class="error">No tracking number provided.</p>';
        return;
    }

    resultsContainer.innerHTML = '<p>Loading tracking information...</p>';

    fetch(`/track/${trackingNumber}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Package not found');
            }
            return response.json();
        })
        .then(data => {
            const historyHtml = data.history.map(entry => `
                <li>
                    <span class="timestamp">${new Date(entry.timestamp).toLocaleString()}</span>
                    <span class="status">${entry.status}</span>
                    <span class="location">${entry.location}</span>
                </li>
            `).join('');

            resultsContainer.innerHTML = `
                <h3>Tracking Details for ${trackingNumber.toUpperCase()}</h3>
                <p><strong>Status:</strong> ${data.status}</p>
                <p><strong>Current Location:</strong> ${data.location}</p>
                <p><strong>Sender:</strong> ${data.sender.name}</p>
                <p><strong>Receiver:</strong> ${data.receiver.name}</p>
                <h4>History:</h4>
                <ul class="tracking-history">
                    ${historyHtml}
                </ul>
            `;
        })
        .catch(error => {
            resultsContainer.innerHTML = `<p class="error">${error.message}</p>`;
        });
});