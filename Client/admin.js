// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

  // --- Authentication ---
  const TOKEN_KEY = 'adminSecretToken';
  let adminToken = sessionStorage.getItem(TOKEN_KEY);

  // --- Element Selectors ---
  const loginContainer = document.getElementById('login-container');
  const loginForm = document.getElementById('login-form');
  const loginStatus = document.getElementById('login-status');
  const mainContainer = document.querySelector('.container');
  const header = document.querySelector('header');

  const registerForm = document.getElementById('register-package-form');
  const updateForm = document.getElementById('update-status-form');
  const registerStatus = document.getElementById('register-form-status');
  const updateStatus = document.getElementById('update-form-status');
  const logoutButton = document.getElementById('logout-button');
  
  const packageListStatus = document.getElementById('package-list-status');
  const packageListBody = document.getElementById('package-list-body');
  const refreshButton = document.getElementById('refresh-packages-btn');
  const editModal = document.getElementById('edit-modal');
  const editForm = document.getElementById('edit-package-form');
  const editFormStatus = document.getElementById('edit-form-status');
  const closeModalButton = document.getElementById('modal-close-btn');

  // --- State ---
  let packagesCache = []; // To hold the fetched package data

  // --- Initialization ---
  checkTokenAndInitialize();

  function setFormsEnabled(enabled, forms) {
    forms.forEach(form => {
      if (form) {
        const elements = form.querySelectorAll('input, select, textarea, button');
        elements.forEach(element => element.disabled = !enabled);
      }
    });
  }

  function checkTokenAndInitialize() {
    if (adminToken) {
      loginContainer.style.display = 'none';
      mainContainer.style.display = 'block';
      header.style.display = 'flex';
      setFormsEnabled(true, [registerForm, updateForm, editForm]);
      showStatus(registerStatus, 'Authenticated. Ready to manage packages.', false);
      fetchAndDisplayPackages();
    } else {
      loginContainer.style.display = 'flex';
      mainContainer.style.display = 'none';
      header.style.display = 'none';
    }
  }

  // --- Event Listeners ---
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const tokenInput = document.getElementById('admin-token');
      const token = tokenInput.value;
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        adminToken = token;
        checkTokenAndInitialize();
      } else {
        showStatus(loginStatus, 'Please enter a token.', true);
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      sessionStorage.removeItem(TOKEN_KEY);
      adminToken = null;
      window.location.reload();
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearStatus(registerStatus);
      const data = Object.fromEntries(new FormData(registerForm).entries());

      try {
        const result = await apiRequest('/register-package', 'POST', data);
        showStatus(registerStatus, `Success! New Tracking ID: ${result.trackingNumber}`, false);
        registerForm.reset();
        await fetchAndDisplayPackages();
      } catch (error) {
        showStatus(registerStatus, `Error: ${error.message}`, true);
      }
    });
  }

  if (updateForm) {
    updateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearStatus(updateStatus);
      const data = Object.fromEntries(new FormData(updateForm).entries());

      try {
        const result = await apiRequest('/update-status', 'POST', data);
        showStatus(updateStatus, `Success: ${result.message}`, false);
        updateForm.reset();
        await fetchAndDisplayPackages();
      } catch (error) {
        showStatus(updateStatus, `Error: ${error.message}`, true);
      }
    });
  }
  
  if (refreshButton) {
    refreshButton.addEventListener('click', fetchAndDisplayPackages);
  }

  if (packageListBody) {
    packageListBody.addEventListener('click', e => {
      const editBtn = e.target.closest('.edit-btn');
      const deleteBtn = e.target.closest('.delete-btn');
      
      if (editBtn) {
        const row = editBtn.closest('tr');
        const trackingNumber = row.dataset.trackingNumber;
        handleEdit(trackingNumber);
      } else if (deleteBtn) {
        const row = deleteBtn.closest('tr');
        const trackingNumber = row.dataset.trackingNumber;
        handleDelete(trackingNumber);
      }
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', handleEditFormSubmit);
  }

  if (closeModalButton) closeModalButton.addEventListener('click', closeModal);
  if (editModal) editModal.addEventListener('click', e => {
    if (e.target === editModal) closeModal(); // Click on overlay
  });

  // --- Package List Management ---
  async function fetchAndDisplayPackages() {
    showStatus(packageListStatus, 'Loading packages...', false);
    try {
      const packages = await apiRequest('/admin/packages', 'GET');
      packagesCache = packages;
      renderPackageList(packages);
      clearStatus(packageListStatus);
    } catch (error) {
      showStatus(packageListStatus, `Error fetching packages: ${error.message}`, true);
      packageListBody.innerHTML = '<tr><td colspan="6">Could not load packages.</td></tr>';
    }
  }

  function renderPackageList(packages) {
    packageListBody.innerHTML = '';
    if (!packages || packages.length === 0) {
      packageListBody.innerHTML = '<tr><td colspan="6">No packages have been registered yet.</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();
    packages.forEach(pkg => {
      const etaDate = new Date(pkg.shipmentinfo.eta).toISOString().split('T')[0];
      const row = document.createElement('tr');
      row.setAttribute('data-tracking-number', pkg.trackingnumber);

      row.innerHTML = `
        <td>${sanitizeHTML(pkg.trackingnumber)}</td>
        <td>${sanitizeHTML(pkg.sender.name)}</td>
        <td>${sanitizeHTML(pkg.receiver.name)}</td>
        <td>${sanitizeHTML(pkg.status)}</td>
        <td>${sanitizeHTML(etaDate)}</td>
        <td class="actions">
          <button class="btn-icon edit-btn" title="Edit"><i class="fas fa-pencil-alt"></i></button>
          <button class="btn-icon delete-btn" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      fragment.appendChild(row);
    });
    packageListBody.appendChild(fragment);
  }

  // --- Edit and Delete Logic ---
  async function handleDelete(trackingNumber) {
    if (confirm(`Are you sure you want to permanently delete package ${trackingNumber}? This cannot be undone.`)) {
      try {
        await apiRequest(`/admin/package/${trackingNumber}`, 'DELETE');
        showStatus(packageListStatus, 'Package deleted successfully.', false);
        // Manually remove from cache and DOM for faster UI response
        packagesCache = packagesCache.filter(p => p.trackingnumber !== trackingNumber);
        const row = packageListBody.querySelector(`tr[data-tracking-number="${trackingNumber}"]`);
        if(row) row.remove();
      } catch (error) {
        showStatus(packageListStatus, `Error deleting package: ${error.message}`, true);
      }
    }
  }
  
  function handleEdit(trackingNumber) {
    const packageData = packagesCache.find(p => p.trackingnumber === trackingNumber);
    if (packageData) {
      populateEditForm(packageData);
      openModal();
    } else {
      showStatus(packageListStatus, 'Error: Could not find package data to edit.', true);
    }
  }

  // --- Modal Handling ---
  function populateEditForm(pkg) {
    editForm.querySelector('#edit-tracking-number').value = pkg.trackingnumber;
    editForm.querySelector('#edit-sender-name').value = pkg.sender.name;
    editForm.querySelector('#edit-sender-email').value = pkg.sender.email;
    editForm.querySelector('#edit-sender-phone').value = pkg.sender.phone;
    editForm.querySelector('#edit-sender-address').value = pkg.sender.address;
    editForm.querySelector('#edit-receiver-name').value = pkg.receiver.name;
    editForm.querySelector('#edit-receiver-email').value = pkg.receiver.email;
    editForm.querySelector('#edit-receiver-phone').value = pkg.receiver.phone;
    editForm.querySelector('#edit-receiver-address').value = pkg.receiver.address;
    editForm.querySelector('#edit-origin').value = pkg.shipmentinfo.origin;
    editForm.querySelector('#edit-destination').value = pkg.shipmentinfo.destination;
    editForm.querySelector('#edit-weight').value = pkg.shipmentinfo.weight;
    editForm.querySelector('#edit-eta').value = new Date(pkg.shipmentinfo.eta).toISOString().split('T')[0];
  }
  
  async function handleEditFormSubmit(e) {
    e.preventDefault();
    clearStatus(editFormStatus);
    const trackingNumber = editForm.querySelector('#edit-tracking-number').value;
    
    const payload = {
      sender: {
        name: editForm.querySelector('#edit-sender-name').value,
        email: editForm.querySelector('#edit-sender-email').value,
        phone: editForm.querySelector('#edit-sender-phone').value,
        address: editForm.querySelector('#edit-sender-address').value,
      },
      receiver: {
        name: editForm.querySelector('#edit-receiver-name').value,
        email: editForm.querySelector('#edit-receiver-email').value,
        phone: editForm.querySelector('#edit-receiver-phone').value,
        address: editForm.querySelector('#edit-receiver-address').value,
      },
      shipmentinfo: {
        origin: editForm.querySelector('#edit-origin').value,
        destination: editForm.querySelector('#edit-destination').value,
        weight: parseFloat(editForm.querySelector('#edit-weight').value),
        eta: editForm.querySelector('#edit-eta').value,
      }
    };

    try {
      await apiRequest(`/admin/package/${trackingNumber}`, 'PUT', payload);
      showStatus(editFormStatus, 'Package updated successfully!', false);
      setTimeout(async () => {
        closeModal();
        await fetchAndDisplayPackages();
      }, 1000);
    } catch (error) {
      showStatus(editFormStatus, `Error updating package: ${error.message}`, true);
    }
  }
  
  function openModal() {
    if (editModal) editModal.style.display = 'flex';
  }

  function closeModal() {
    if (editModal) {
      editModal.style.display = 'none';
      editForm.reset();
      clearStatus(editFormStatus);
    }
  }

  // --- API & Helper Functions ---
  async function apiRequest(url, method, body = null) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` };
    const config = { method, headers, body: body ? JSON.stringify(body) : null };

    try {
      const response = await fetch(url, config);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'An unknown API error occurred.');
      }
      return result;
    } catch (error) {
      console.error(`API Error (${method} ${url}):`, error);
      throw error;
    }
  }

  function showStatus(element, message, isError) {
    if (!element) return;
    element.textContent = message;
    element.className = 'form-status';
    element.classList.add(isError ? 'error' : 'success');
  }

  function clearStatus(element) {
    if (!element) return;
    element.textContent = '';
    element.className = 'form-status';
  }

  function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }
});