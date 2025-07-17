// Admin dashboard logic: manage products, inventory, and customer accounts

let currentProducts = [];
let currentOutOfStockProducts = [];
// Use the API_BASE from config.js
const API_BASE = window.API_BASE;

// Helper function to get authenticated fetch options
function getAuthHeaders(method = 'GET', body = null) {
    const options = {
        method,
        credentials: 'include' // Always send cookies, do not send Authorization header
    };
    
    if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }
    
    return options;
}

// --- Fix: Combined search and filter state ---
let currentSearchQuery = '';
let currentCategoryFilter = 'all';
let currentOutOfStockSearchQuery = '';
let currentOutOfStockCategoryFilter = 'all';

let productIdToDelete = null;
let accountIdToDelete = null;

function showDeleteConfirmModal(productId) {
    productIdToDelete = productId;
    document.getElementById('delete-confirm-modal').classList.remove('hidden');
}

function hideDeleteConfirmModal() {
    productIdToDelete = null;
    document.getElementById('delete-confirm-modal').classList.add('hidden');
}

function showDeleteAccountConfirmModal(accountId) {
    accountIdToDelete = accountId;
    document.getElementById('delete-account-confirm-modal').classList.remove('hidden');
}

function hideDeleteAccountConfirmModal() {
    accountIdToDelete = null;
    document.getElementById('delete-account-confirm-modal').classList.add('hidden');
}

document.getElementById('delete-cancel-btn').onclick = hideDeleteConfirmModal;
document.getElementById('delete-confirm-btn').onclick = async function() {
    if (!productIdToDelete) return;
    await actuallyDeleteProduct(productIdToDelete);
    hideDeleteConfirmModal();
};

document.getElementById('delete-account-cancel-btn').onclick = hideDeleteAccountConfirmModal;
document.getElementById('delete-account-confirm-btn').onclick = async function() {
    if (!accountIdToDelete) return;
    await actuallyDeleteCustomerAccount(accountIdToDelete);
    hideDeleteAccountConfirmModal();
};

async function actuallyDeleteProduct(productId) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE}/products/${productId}`, { 
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!res.ok) {
        showNotification('Delete failed', 'error');
        return;
    }
    await loadProducts();
    await loadOutOfStockProducts();
    showNotification('Product deleted successfully!', 'success');
}

// Replace deleteProduct to use the modal
window.deleteProduct = function(productId) {
    showDeleteConfirmModal(productId);
};

function openAccountsModal() {
    const modal = document.getElementById('accounts-modal');
    modal.classList.remove('hidden');
    fetchAndDisplayAccounts();
}

function closeAccountsModal() {
    document.getElementById('accounts-modal').classList.add('hidden');
}

async function fetchAndDisplayAccounts() {
    try {
        const res = await fetch('http://localhost:4000/customers');
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const accounts = await res.json();
        const tableBody = document.getElementById('accounts-table-body');
        if (!accounts.length) {
            tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">No customer accounts found.</td></tr>`;
            return;
        }
        tableBody.innerHTML = accounts.map(acc => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${acc.firstName}</td>
                <td class="px-6 py-4 whitespace-nowrap">${acc.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">${acc.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="delete-customer-btn text-red-600 hover:text-red-900" data-id="${acc._id}"><i class="fas fa-trash"></i> Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        document.getElementById('accounts-table-body').innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Error loading accounts</td></tr>`;
    }
}

async function actuallyDeleteCustomerAccount(customerId) {
    try {
        const res = await fetch(`http://localhost:4000/customers/${customerId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete account');
        showNotification('Customer account deleted!', 'success');
        fetchAndDisplayAccounts();
    } catch (err) {
        showNotification('Failed to delete account', 'error');
    }
}

function deleteCustomerAccount(customerId) {
    showDeleteAccountConfirmModal(customerId);
}

// --- Add these handler functions near the top-level (after global variables, before initializeAdmin) ---
function handleTableActionClick(event) {
    const productId = event.target.closest('button')?.getAttribute('data-product-id');
    if (!productId) return;
    if (event.target.closest('.edit-images-btn')) {
        openEditImagesModal(productId);
    } else if (event.target.closest('.edit-product-btn')) {
        editProduct(productId);
    } else if (event.target.closest('.delete-product-btn')) {
        deleteProduct(productId);
    } else if (event.target.closest('.toggle-featured-btn')) {
        toggleFeatured(productId);
    }
}

function handleMobileCardActionClick(event) {
    const productId = event.target.closest('button')?.getAttribute('data-product-id');
    if (!productId) return;
    if (event.target.closest('.edit-images-btn')) {
        openEditImagesModal(productId);
    } else if (event.target.closest('.edit-product-btn')) {
        editProduct(productId);
    } else if (event.target.closest('.delete-product-btn')) {
        deleteProduct(productId);
    } else if (event.target.closest('.toggle-featured-btn')) {
        toggleFeatured(productId);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    initializeAdmin();
    // Manage Accounts button
    const manageAccountsBtn = document.getElementById('manage-accounts-btn');
    if (manageAccountsBtn) {
        manageAccountsBtn.addEventListener('click', function() {
            openAccountsModal();
        });
    } else {
        showNotification('Manage Accounts button not found', 'error');
    }
    // Enforce 6 digit limit on price input
    const priceInput = document.getElementById('product-price');
    if (priceInput) {
        priceInput.addEventListener('input', function() {
            if (this.value.length > 6) {
                this.value = this.value.slice(0, 6);
            }
        });
    }
    // Edit Modal Cancel
    const editModalCancelBtn = document.getElementById('edit-modal-cancel-btn');
    if (editModalCancelBtn) editModalCancelBtn.addEventListener('click', closeEditModal);
    // Accounts Modal Close
    const accountsModalCloseBtn = document.getElementById('accounts-modal-close-btn');
    if (accountsModalCloseBtn) accountsModalCloseBtn.addEventListener('click', closeAccountsModal);
    // Edit Images Modal Cancel
    const editImagesCancelBtn = document.getElementById('edit-images-cancel-btn');
    if (editImagesCancelBtn) editImagesCancelBtn.addEventListener('click', closeEditImagesModal);
    // Edit Images Modal Save
    const editImagesSaveBtn = document.getElementById('edit-images-save-btn');
    if (editImagesSaveBtn) editImagesSaveBtn.addEventListener('click', saveEditImages);
    // Edit Images Upload
    const editImagesUpload = document.getElementById('edit-images-upload');
    if (editImagesUpload) editImagesUpload.addEventListener('change', handleEditImagesUpload);
    // Delete Confirm Modal
    const deleteCancelBtn = document.getElementById('delete-cancel-btn');
    if (deleteCancelBtn) deleteCancelBtn.addEventListener('click', function() {
      document.getElementById('delete-confirm-modal').classList.add('hidden');
    });
    // Delete Account Confirm Modal
    const deleteAccountCancelBtn = document.getElementById('delete-account-cancel-btn');
    if (deleteAccountCancelBtn) deleteAccountCancelBtn.addEventListener('click', function() {
      document.getElementById('delete-account-confirm-modal').classList.add('hidden');
    });
    // Attach logout event handler
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    // Attach edit images upload handler
    const editImagesUploadInput = document.getElementById('edit-images-upload');
    if (editImagesUploadInput) {
        editImagesUploadInput.addEventListener('change', handleEditImagesUpload);
    }
    // Attach input event handler for product description character counter
    const productDescription = document.getElementById('product-description');
    const descCounter = document.getElementById('desc-counter');
    if (productDescription && descCounter) {
        productDescription.addEventListener('input', function() {
            descCounter.textContent = this.value.length + '/400';
        });
    }
    // Attach mobile logout event handler
    const logoutBtnMobile = document.getElementById('admin-logout-btn-mobile');
    if (logoutBtnMobile) {
        logoutBtnMobile.addEventListener('click', logout);
    }
    // Attach edit images modal close event handler
    const editImagesCloseBtn = document.getElementById('edit-images-close-btn');
    if (editImagesCloseBtn) {
        editImagesCloseBtn.addEventListener('click', closeEditImagesModal);
    }
    // Event delegation for customer account delete buttons
    const accountsTableBody = document.getElementById('accounts-table-body');
    if (accountsTableBody) {
        accountsTableBody.addEventListener('click', function(event) {
            const btn = event.target.closest('.delete-customer-btn');
            if (btn) {
                const id = btn.getAttribute('data-id');
                if (id) deleteCustomerAccount(id);
            }
        });
    }
    // Event delegation for out-of-stock table actions (desktop and filtered)
    const outOfStockTableBody = document.getElementById('out-of-stock-table-body');
    if (outOfStockTableBody) {
        outOfStockTableBody.addEventListener('click', function(event) {
            const restoreBtn = event.target.closest('.restore-outofstock-btn');
            if (restoreBtn) {
                const id = restoreBtn.getAttribute('data-id');
                if (id) {
                    restoreFromOutOfStock(id);
                }
                return;
            }
            const deleteBtn = event.target.closest('.delete-product-btn');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-product-id');
                if (id) deleteProduct(id);
            }
        });
    }
    // Event delegation for filtered out-of-stock table
    const filteredOutOfStockTableBody = document.getElementById('out-of-stock-table-body');
    if (filteredOutOfStockTableBody) {
        filteredOutOfStockTableBody.addEventListener('click', function(event) {
            const restoreBtn = event.target.closest('.restore-outofstock-btn');
            if (restoreBtn) {
                const id = restoreBtn.getAttribute('data-id');
                if (id) {
                    restoreFromOutOfStock(id);
                }
                return;
            }
            const deleteBtn = event.target.closest('.delete-product-btn');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-product-id');
                if (id) deleteProduct(id);
            }
        });
    }
    // Event delegation for filtered out-of-stock mobile cards
    const filteredOutOfStockMobileCards = document.getElementById('mobile-out-of-stock-cards');
    if (filteredOutOfStockMobileCards) {
        filteredOutOfStockMobileCards.addEventListener('click', function(event) {
            const restoreBtn = event.target.closest('.restore-outofstock-btn');
            if (restoreBtn) {
                const id = restoreBtn.getAttribute('data-id');
                if (id) {
                    restoreFromOutOfStock(id);
                }
                return;
            }
            const deleteBtn = event.target.closest('.delete-product-btn');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-product-id');
                if (id) deleteProduct(id);
            }
        });
    }
    // Event delegation for main products mobile cards
    const mainProductsMobileCards = document.getElementById('mobile-products-cards');
    if (mainProductsMobileCards) {
        mainProductsMobileCards.addEventListener('click', function(event) {
            const deleteBtn = event.target.closest('.delete-product-btn');
            if (deleteBtn) {
                const id = deleteBtn.getAttribute('data-product-id');
                if (id) deleteProduct(id);
            }
            // Add similar handlers for edit, toggle, etc. if needed
        });
    }
});

// Check admin authentication
async function checkAdminAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/not-an-admin-login';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/verify-token`, {
            credentials: 'include' // Always send cookies
        });
        
        if (!response.ok) {
            localStorage.removeItem('admin_token');
            window.location.href = '/not-an-admin-login';
            return;
        }
        
        const data = await response.json();
        // Set admin info
    const adminNameElement = document.getElementById('admin-name');
    if (adminNameElement) {
            adminNameElement.textContent = data.admin.username;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('admin_token');
        window.location.href = '/not-an-admin-login';
    }
}

// Initialize admin dashboard
function initializeAdmin() {
    loadProducts();
    loadOutOfStockProducts();
    initializeForms();
    initializeSearch();
    initializeFilters();
    initializeOutOfStockSearch();
    initializeOutOfStockFilters();
    updateStats();
    // Attach event listeners ONCE here
    const tableBody = document.getElementById('products-table-body');
    const mobileCards = document.getElementById('mobile-products-cards');
    if (tableBody) tableBody.addEventListener('click', handleTableActionClick);
    if (mobileCards) mobileCards.addEventListener('click', handleMobileCardActionClick);
}

// Fetch and display products from backend
async function loadProducts() {
    const res = await fetch(`${API_BASE}/products`, getAuthHeaders());
    const allProducts = await res.json();
    // Filter out out-of-stock products from the main manage products section
    currentProducts = allProducts.filter(product => !product.outOfStock);
    displayProductsTable();
    updateStats();
}

// Fetch and display out of stock products from backend
async function loadOutOfStockProducts() {
    const res = await fetch(`${API_BASE}/products/out-of-stock`, getAuthHeaders());
    currentOutOfStockProducts = await res.json();
    displayOutOfStockProductsTable();
}

// Display products in table
function displayProductsTable() {
    const tableBody = document.getElementById('products-table-body');
    const mobileCards = document.getElementById('mobile-products-cards');
    
    if (currentProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                    No products found. Add your first product above.
                </td>
            </tr>
        `;
        mobileCards.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                No products found. Add your first product above.
            </div>
        `;
        return;
    }
    
    // In displayProductsTable, refactor to use event delegation for action buttons
    // Desktop table
    tableBody.innerHTML = currentProducts.map(product => `
        <tr class="hover:bg-gray-50" data-product-id="${product._id}">
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <button class="edit-images-btn" title="Edit Images" data-product-id="${product._id}">
                    <i class="fas fa-image text-xl text-gray-600 hover:text-black"></i>
                </button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center w-24">
                ${product.images && product.images.length > 0 && product.images[0].url ? `<img src="${product.images[0].url}" alt="Product Image" class="h-12 w-12 object-cover rounded mx-auto" />` : ''}
            </td>
            <td class="px-6 py-4 whitespace-normal break-words max-w-xs">
                ${product.name}
                ${product.outOfStock ? '<span class="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Out of Stock</span>' : ''}
            </td>
            <td class="px-2 py-4 whitespace-nowrap">
                <div class="flex flex-col space-y-1">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                                product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                                'bg-purple-100 text-purple-800'}">
                        ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                    </span>
                    ${product.featured ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Featured</span>' : ''}
                </div>
            </td>
            <td class="px-2 py-4 whitespace-nowrap">₹${product.price}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                    ${product.sizes && product.sizes.length > 0 ? product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('') : '<span class="text-gray-400 text-xs">No sizes</span>'}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <div class="flex flex-col space-y-2">
                    <button class="edit-product-btn text-blue-600 hover:text-blue-900 p-1" data-product-id="${product._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900 p-1" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="toggle-featured-btn ${product.featured ? 'text-yellow-600' : 'text-gray-400'} hover:text-yellow-600 p-1" data-product-id="${product._id}">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    // Event delegation for desktop table
    // tableBody.removeEventListener('click', handleTableActionClick); // REMOVED
    // tableBody.addEventListener('click', handleTableActionClick); // REMOVED
}

// Display out of stock products in table
function displayOutOfStockProductsTable() {
    const tableBody = document.getElementById('out-of-stock-table-body');
    const mobileCards = document.getElementById('mobile-out-of-stock-cards');
    
    if (currentOutOfStockProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    No out of stock products found.
                </td>
            </tr>
        `;
        mobileCards.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                No out of stock products found.
            </div>
        `;
        return;
    }
    
    // Desktop table
    tableBody.innerHTML = currentOutOfStockProducts.map(product => `
        <tr class="hover:bg-gray-50" data-product-id="${product._id}">
            <td class="px-6 py-4 whitespace-nowrap text-center w-24">
                ${product.images && product.images.length > 0 && product.images[0].url ? `<img src="${product.images[0].url}" alt="Product Image" class="h-12 w-12 object-cover rounded mx-auto" />` : ''}
            </td>
            <td class="px-6 py-4 whitespace-normal break-words max-w-xs">${product.name}</td>
            <td class="px-2 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                             ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                               product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                               'bg-purple-100 text-purple-800'}">
                    ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                </span>
            </td>
            <td class="px-2 py-4 whitespace-nowrap">₹ ${product.price.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                    ${product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('')}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                    <button class="restore-outofstock-btn text-green-600 hover:text-green-900" data-id="${product._id}" title="Restore to Available">
                        <i class="fas fa-box"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Mobile cards
    mobileCards.innerHTML = currentOutOfStockProducts.map(product => `
        <div class="bg-white rounded-lg shadow-md p-4 border" data-product-id="${product._id}">
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    ${product.images && product.images.length > 0 && product.images[0].url ? 
                        `<img src="${product.images[0].url}" alt="Product Image" class="h-16 w-16 object-cover rounded" />` : 
                        `<div class="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                            <i class="fas fa-image text-gray-400"></i>
                        </div>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium text-gray-900 truncate">${product.name}</h3>
                    <p class="text-sm text-gray-500">₹ ${product.price.toFixed(2)}</p>
                    <div class="flex items-center space-x-2 mt-1">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                   ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                                     product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                                     'bg-purple-100 text-purple-800'}">
                            ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                        </span>
                    </div>
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('')}
                    </div>
                </div>
                <div class="flex flex-col space-y-2">
                    <button class="restore-outofstock-btn text-green-600 hover:text-green-900 p-2" data-id="${product._id}" title="Restore to Available">
                        <i class="fas fa-box"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900 p-2" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Initialize forms
function initializeForms() {
    // Add product form
    const addForm = document.getElementById('add-product-form');
    addForm.addEventListener('submit', handleAddProduct);
    
    // Edit product form
    const editForm = document.getElementById('edit-product-form');
    editForm.addEventListener('submit', handleEditProduct);
    
    // Out of stock button
    const outOfStockBtn = document.getElementById('out-of-stock-btn');
    if (outOfStockBtn) {
        outOfStockBtn.addEventListener('click', function() {
            const productId = document.getElementById('edit-product-id').value;
            if (productId) {
                toggleOutOfStock(productId);
                closeEditModal();
            }
        });
    }
    
    // Removed call to initializeImageUploads();
}

// Add product via backend
async function handleAddProduct(event) {
    event.preventDefault();
    // Collect checked sizes
    const sizeCheckboxes = document.querySelectorAll('input[name="sizes"]:checked');
    const sizes = Array.from(sizeCheckboxes).map(cb => cb.value);
    const productData = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        price: document.getElementById('product-price').value,
        description: document.getElementById('product-description').value,
        sizes,
        images: []
    };
    const res = await fetch(`${API_BASE}/products`, getAuthHeaders('POST', productData));
    if (!res.ok) {
        showNotification('Product creation failed', 'error');
        return;
    }
    await loadProducts();
    event.target.reset();
    showNotification('Item added successfully', 'success');
}

// Handle edit product
async function handleEditProduct(event) {
    event.preventDefault();
    const productId = document.getElementById('edit-product-id').value;
    const sizeCheckboxes = document.querySelectorAll('#edit-sizes-checkboxes input[type="checkbox"]:checked');
    const sizes = Array.from(sizeCheckboxes).map(cb => cb.value);
    const updates = {
        name: document.getElementById('edit-product-name').value,
        category: document.getElementById('edit-product-category').value,
        price: document.getElementById('edit-product-price').value,
        description: document.getElementById('edit-product-description').value,
        sizes,
        fabricComposition: document.getElementById('edit-fabric-composition').value,
        fit: document.getElementById('edit-fit').value,
        countryOfOrigin: document.getElementById('edit-country-of-origin').value,
        careInstruction: document.getElementById('edit-care-instruction').value
    };
    // Validate product
    if (!validateProduct(updates)) {
        return;
    }
    // Disable submit button
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    // Send PATCH request to backend
    try {
        const res = await fetch(`${API_BASE}/products/${productId}`, getAuthHeaders('PATCH', updates));
        if (!res.ok) throw new Error('Failed to update product');
        await loadProducts();
        closeEditModal();
        showNotification('Product updated successfully!', 'success');
    } catch (err) {
        showNotification('Product update failed', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Validate product data
function validateProduct(product) {
    if (!product.name || !product.category || !product.price || !product.description || !product.sizes.length) {
        showNotification('Please fill in all fields.', 'error');
        return false;
    }
    
    if (product.price <= 0) {
        showNotification('Price must be greater than 0.', 'error');
        return false;
    }
    
    // Removed image validation
    return true;
}

// Edit product
function editProduct(productId) {
    const product = currentProducts.find(p => p._id === productId);
    if (!product) return;
    // Fill edit form
    document.getElementById('edit-product-id').value = product._id;
    document.getElementById('edit-product-name').value = product.name;
    document.getElementById('edit-product-category').value = product.category;
    document.getElementById('edit-product-price').value = product.price;
    document.getElementById('edit-product-description').value = product.description;
    // Set sizes checkboxes
    const sizes = product.sizes || [];
    document.querySelectorAll('#edit-sizes-checkboxes input[type="checkbox"]').forEach(cb => {
        cb.checked = sizes.includes(cb.value);
    });
    // Set specification fields
    document.getElementById('edit-fabric-composition').value = product.fabricComposition || '';
    document.getElementById('edit-fit').value = product.fit || '';
    document.getElementById('edit-country-of-origin').value = product.countryOfOrigin || '';
    document.getElementById('edit-care-instruction').value = product.careInstruction || '';
    // Show modal
    const modal = document.getElementById('edit-modal');
    modal.classList.remove('hidden');
    // Scroll modal content to top
    const modalContent = modal.querySelector('div.bg-white');
    if (modalContent) modalContent.scrollTop = 0;
}

// Close edit modal
function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

// Toggle featured status
async function toggleFeatured(productId) {
    try {
        const res = await fetch(`${API_BASE}/products/${productId}/featured`, getAuthHeaders('PATCH'));
        
        if (!res.ok) throw new Error('Failed to toggle featured status');
        
        await loadProducts();
        showNotification('Featured status updated successfully!', 'success');
    } catch (err) {
        showNotification('Failed to update featured status', 'error');
    }
}

// Make toggleFeatured globally accessible
window.toggleFeatured = toggleFeatured;

// Toggle out of stock status
async function toggleOutOfStock(productId) {
    try {
        const res = await fetch(`${API_BASE}/products/${productId}/out-of-stock`, getAuthHeaders('PATCH'));
        
        if (!res.ok) throw new Error('Failed to toggle out of stock status');
        
        await loadProducts();
        await loadOutOfStockProducts();
        showNotification('Out of stock status updated successfully!', 'success');
    } catch (err) {
        showNotification('Failed to update out of stock status', 'error');
    }
}

// Restore product from out of stock
async function restoreFromOutOfStock(productId) {
    try {
        const res = await fetch(`${API_BASE}/products/${productId}/out-of-stock`, getAuthHeaders('PATCH'));
        
        if (!res.ok) throw new Error('Failed to restore product');
        
        await loadProducts();
        await loadOutOfStockProducts();
        showNotification('Product restored to available inventory!', 'success');
    } catch (err) {
        showNotification('Failed to restore product', 'error');
    }
}

// Make functions globally accessible
window.toggleOutOfStock = toggleOutOfStock;
window.restoreFromOutOfStock = restoreFromOutOfStock;

function openEditImagesModal(productId) {
    const product = currentProducts.find(p => p._id === productId);
    if (!product) return;
    // Show the modal
    document.getElementById('edit-images-modal').classList.remove('hidden');
    // Load and display images for this product
    displayEditImages(product);
    // Store the productId for later use (e.g., saving changes)
    document.getElementById('edit-images-modal').setAttribute('data-product-id', productId);
}

function closeEditImagesModal() {
    document.getElementById('edit-images-modal').classList.add('hidden');
    document.getElementById('edit-images-modal').removeAttribute('data-product-id');
}

function displayEditImages(product) {
    const preview = document.getElementById('edit-images-preview');
    if (!preview) return;
    if (!product.images || product.images.length === 0) {
        preview.innerHTML = `<div class='w-full flex flex-col items-center justify-center py-8'><i class='fas fa-image text-5xl text-gray-400 mb-2'></i><p class='text-gray-500'>No images uploaded yet.</p></div>`;
    } else {
        preview.innerHTML = product.images.map((img, idx) => `
            <div class='relative m-2 inline-block'>
                <img src='${img.url}' alt='Product Image ${idx + 1}' class='w-32 h-32 object-cover rounded border'>
                <button class='absolute top-1 right-1 bg-white bg-opacity-80 rounded-full p-1 text-red-600 hover:text-red-800' onclick='removeEditImage(${idx})' title='Delete'><i class='fas fa-trash'></i></button>
            </div>
        `).join('');
    }
    document.getElementById('edit-images-count').textContent = `${product.images ? product.images.length : 0}/6`;
}

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('search-products');
    if (!searchInput) {
        showNotification('Search input not found', 'error');
        return;
    }
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearchQuery = this.value.trim();
            filterProducts(currentSearchQuery, currentCategoryFilter);
        }, 300);
    });
}

// Initialize filters
function initializeFilters() {
    const filterSelect = document.getElementById('filter-category');
    if (!filterSelect) {
        showNotification('Category filter not found', 'error');
        return;
    }
    filterSelect.addEventListener('change', function() {
        currentCategoryFilter = this.value;
        filterProducts(currentSearchQuery, currentCategoryFilter);
    });
}

function initializeOutOfStockSearch() {
    const searchInput = document.getElementById('search-out-of-stock');
    if (!searchInput) {
        return;
    }
    searchInput.addEventListener('input', function() {
        currentOutOfStockSearchQuery = this.value.trim();
        filterOutOfStockProducts(currentOutOfStockSearchQuery, currentOutOfStockCategoryFilter);
    });
}

function initializeOutOfStockFilters() {
    const filterSelect = document.getElementById('filter-out-of-stock-category');
    if (!filterSelect) {
        return;
    }
    filterSelect.addEventListener('change', function() {
        currentOutOfStockCategoryFilter = this.value;
        filterOutOfStockProducts(currentOutOfStockSearchQuery, currentOutOfStockCategoryFilter);
    });
}

// Filter out of stock products
function filterOutOfStockProducts(query = '', category = 'all') {
    let filtered = [...currentOutOfStockProducts];
    
    // Filter by search query
    if (query) {
        filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase())
        );
    }
    
    // Filter by category
    if (category !== 'all') {
        filtered = filtered.filter(product => product.category === category);
    }
    
    // Update table with filtered products
    displayFilteredOutOfStockProducts(filtered);
}

// Display filtered out of stock products
function displayFilteredOutOfStockProducts(filteredProducts) {
    const tableBody = document.getElementById('out-of-stock-table-body');
    const mobileCards = document.getElementById('mobile-out-of-stock-cards');
    
    if (filteredProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    No out of stock products found matching your criteria.
                </td>
            </tr>
        `;
        mobileCards.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                No out of stock products found matching your criteria.
            </div>
        `;
        return;
    }
    
    // Desktop table
    tableBody.innerHTML = filteredProducts.map(product => `
        <tr class="hover:bg-gray-50" data-product-id="${product._id}">
            <td class="px-6 py-4 whitespace-nowrap text-center w-24">
                ${product.images && product.images.length > 0 && product.images[0].url ? `<img src="${product.images[0].url}" alt="Product Image" class="h-12 w-12 object-cover rounded mx-auto" />` : ''}
            </td>
            <td class="px-6 py-4 whitespace-normal break-words max-w-xs">${product.name}</td>
            <td class="px-2 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                             ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                               product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                               'bg-purple-100 text-purple-800'}">
                    ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                </span>
            </td>
            <td class="px-2 py-4 whitespace-nowrap">₹ ${product.price.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                    ${product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('')}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                    <button class="restore-outofstock-btn text-green-600 hover:text-green-900" data-id="${product._id}" title="Restore to Available">
                        <i class="fas fa-box"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Mobile cards
    mobileCards.innerHTML = filteredProducts.map(product => `
        <div class="bg-white rounded-lg shadow-md p-4 border" data-product-id="${product._id}">
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    ${product.images && product.images.length > 0 && product.images[0].url ? 
                        `<img src="${product.images[0].url}" alt="Product Image" class="h-16 w-16 object-cover rounded" />` : 
                        `<div class="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                            <i class="fas fa-image text-gray-400"></i>
                        </div>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium text-gray-900 truncate">${product.name}</h3>
                    <p class="text-sm text-gray-500">₹ ${product.price.toFixed(2)}</p>
                    <div class="flex items-center space-x-2 mt-1">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                   ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                                     product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                                     'bg-purple-100 text-purple-800'}">
                            ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                        </span>
                    </div>
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('')}
                    </div>
                </div>
                <div class="flex flex-col space-y-2">
                    <button class="restore-outofstock-btn text-green-600 hover:text-green-900 p-2" data-id="${product._id}" title="Restore to Available">
                        <i class="fas fa-box"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900 p-2" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Filter products
function filterProducts(query = '', category = 'all') {
    let filtered = [...currentProducts];
    
    // Filter by search query
    if (query) {
        filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase())
        );
    }
    
    // Filter by category
    if (category !== 'all') {
        filtered = filtered.filter(product => product.category === category);
    }
    
    // Update table with filtered products
    displayFilteredProducts(filtered);
}

// Display filtered products
function displayFilteredProducts(filteredProducts) {
    const tableBody = document.getElementById('products-table-body');
    const mobileCards = document.getElementById('mobile-products-cards');
    
    // Filter out out-of-stock products from filtered results
    const availableProducts = filteredProducts.filter(product => !product.outOfStock);
    
    if (availableProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                    No products found matching your criteria.
                </td>
            </tr>
        `;
        mobileCards.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                No products found matching your criteria.
            </div>
        `;
        return;
    }
    
    // Desktop table
    tableBody.innerHTML = availableProducts.map(product => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-center">
                <button class="edit-images-btn" title="Edit Images" data-product-id="${product._id}">
                    <i class="fas fa-image text-xl text-gray-600 hover:text-black"></i>
                </button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center w-24">
                ${product.images && product.images.length > 0 && product.images[0].url ? `<img src="${product.images[0].url}" alt="Product Image" class="h-12 w-12 object-cover rounded mx-auto" />` : ''}
            </td>
            <td class="px-6 py-4 whitespace-normal break-words max-w-xs">
                ${product.name}
                ${product.outOfStock ? '<span class="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Out of Stock</span>' : ''}
            </td>
            <td class="px-2 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                             ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                               product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                               'bg-purple-100 text-purple-800'}">
                    ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                </span>
            </td>
            <td class="px-2 py-4 whitespace-nowrap">₹ ${product.price.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex flex-wrap gap-1">
                    ${product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('')}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex space-x-2">
                    <button class="edit-product-btn text-blue-600 hover:text-blue-900" data-product-id="${product._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="toggle-featured-btn ${product.featured ? 'text-yellow-600' : 'text-gray-400'} hover:text-yellow-600" data-product-id="${product._id}">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Mobile cards
    mobileCards.innerHTML = availableProducts.map(product => `
        <div class="bg-white rounded-lg shadow-md p-4 border">
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    ${product.images && product.images.length > 0 && product.images[0].url ? 
                        `<img src="${product.images[0].url}" alt="Product Image" class="h-16 w-16 object-cover rounded" />` : 
                        `<div class="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                            <i class="fas fa-image text-gray-400"></i>
                        </div>`
                    }
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium text-gray-900 truncate">${product.name}</h3>
                    <p class="text-sm text-gray-500">₹ ${product.price.toFixed(2)}</p>
                    <div class="flex items-center space-x-2 mt-1">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                   ${product.category === 'shirts' ? 'bg-blue-100 text-blue-800' : 
                                     product.category === 'polo-tshirt' ? 'bg-green-100 text-green-800' : 
                                     'bg-purple-100 text-purple-800'}">
                            ${product.category === 'trousers' ? 'Trousers' : product.category === 'shirts' ? 'Shirt' : product.category === 'polo-tshirt' ? 'Polos' : product.category}
                        </span>
                        ${product.featured ? '<span class="text-yellow-500"><i class="fas fa-star"></i></span>' : ''}
                    </div>
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${product.sizes.map(size => `<span class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">${size}</span>`).join('')}
                    </div>
                </div>
                <div class="flex flex-col space-y-2">
                    <button class="edit-images-btn text-gray-600 hover:text-black p-1" data-product-id="${product._id}">
                        <i class="fas fa-image"></i>
                    </button>
                    <button class="edit-product-btn text-blue-600 hover:text-blue-900 p-1" data-product-id="${product._id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-product-btn text-red-600 hover:text-red-900 p-1" data-product-id="${product._id}">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="toggle-featured-btn ${product.featured ? 'text-yellow-600' : 'text-gray-400'} hover:text-yellow-600 p-1" data-product-id="${product._id}">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update statistics
function updateStats() {
    const totalProducts = currentProducts.length;
    const totalShirts = currentProducts.filter(p => p.category === 'shirts').length;
    const totalPoloTshirts = currentProducts.filter(p => p.category === 'polo-tshirt').length;
    const totalTrousers = currentProducts.filter(p => p.category === 'trousers').length;
    
    document.getElementById('total-products').textContent = totalProducts;
    document.getElementById('total-shirts').textContent = totalShirts;
    document.getElementById('total-polos').textContent = totalPoloTshirts;
    document.getElementById('total-trousers').textContent = totalTrousers;
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg max-w-sm transform transition-all duration-300 translate-x-full`;
    
    // Set notification content based on type
    let bgColor, textColor, icon;
    switch (type) {
        case 'success':
            bgColor = 'bg-green-500';
            textColor = 'text-white';
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            bgColor = 'bg-red-500';
            textColor = 'text-white';
            icon = 'fas fa-exclamation-circle';
            break;
        default:
            bgColor = 'bg-blue-500';
            textColor = 'text-white';
            icon = 'fas fa-info-circle';
    }
    
    notification.className += ` ${bgColor} ${textColor}`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="${icon} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    // Add to page
    document.body.appendChild(notification);
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

window.deleteCustomerAccount = deleteCustomerAccount;

// Image upload preview for Edit Images modal
const editImagesUploadInput = document.getElementById('edit-images-upload');
if (editImagesUploadInput) {
    editImagesUploadInput.addEventListener('change', function(event) {
        const files = Array.from(event.target.files);
        const preview = document.getElementById('edit-images-preview');
        if (!preview) return;
        // Show previews for selected files
        let html = '';
        files.forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            html += `<div class='relative m-2 inline-block'>
                <img src='${url}' alt='Preview ${idx + 1}' class='w-32 h-32 object-cover rounded border'>
                <span class='absolute top-1 left-1 bg-white bg-opacity-80 rounded-full p-1 text-xs text-gray-700'>Preview</span>
            </div>`;
        });
        // If there are already uploaded images, show them too
        const productId = document.getElementById('edit-images-modal').getAttribute('data-product-id');
        const product = currentProducts.find(p => p._id === productId);
        if (product && product.images && product.images.length > 0) {
            html += product.images.map((img, idx) => `
                <div class='relative m-2 inline-block'>
                    <img src='${img.url}' alt='Product Image ${idx + 1}' class='w-32 h-32 object-cover rounded border'>
                </div>
            `).join('');
        }
        preview.innerHTML = html;
    });
}

async function saveEditImages() {
    const modal = document.getElementById('edit-images-modal');
    const productId = modal.getAttribute('data-product-id');
    const input = document.getElementById('edit-images-upload');
    const files = Array.from(input.files);
    const progressContainer = document.getElementById('edit-images-progress-container');
    const progressBar = document.getElementById('edit-images-progress-bar');
    const statusMsg = document.getElementById('edit-images-status');
    if (!productId) return;
    // Show loading bar
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    statusMsg.textContent = 'Uploading images...';
    let uploadedImages = [];
    try {
        // Upload each file to Cloudinary
        for (let i = 0; i < files.length; i++) {
            const formData = new FormData();
            formData.append('image', files[i]);
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            uploadedImages.push({ url: data.url, public_id: data.public_id });
            // Update progress bar
            progressBar.style.width = `${Math.round(((i + 1) / files.length) * 100)}%`;
            statusMsg.textContent = `Uploaded ${i + 1} of ${files.length} images...`;
        }
        // Get existing images for this product
        const product = currentProducts.find(p => p._id === productId);
        let newImages = uploadedImages;
        if (product && product.images && product.images.length > 0) {
            // Keep existing images and add new ones, up to 6
            newImages = product.images.concat(uploadedImages).slice(0, 6);
        }
        // Update product images in backend
        statusMsg.textContent = 'Updating product...';
        const updateRes = await fetch(`${API_BASE}/products/${productId}/images`, getAuthHeaders('PATCH', { images: newImages }));
        if (!updateRes.ok) throw new Error('Failed to update product images');
        // Hide loading bar and show success
        progressBar.style.width = '100%';
        statusMsg.textContent = 'Done!';
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            statusMsg.textContent = '';
            closeEditImagesModal();
            showNotification('Images updated successfully!', 'success');
            loadProducts();
        }, 800);
    } catch (err) {
        progressContainer.classList.add('hidden');
        statusMsg.textContent = '';
        showNotification('Image upload failed', 'error');
    }
}
window.saveEditImages = saveEditImages;

async function removeEditImage(idx) {
    const modal = document.getElementById('edit-images-modal');
    const productId = modal.getAttribute('data-product-id');
    if (!productId) return;
    const product = currentProducts.find(p => p._id === productId);
    if (!product || !product.images || product.images.length <= idx) return;
    // Remove the image at idx
    const newImages = product.images.slice(0, idx).concat(product.images.slice(idx + 1));
    try {
        const updateRes = await fetch(`${API_BASE}/products/${productId}/images`, getAuthHeaders('PATCH', { images: newImages }));
        if (!updateRes.ok) throw new Error('Failed to delete image');
        showNotification('Image deleted successfully!', 'success');
        // Update local product and refresh modal
        product.images = newImages;
        displayEditImages(product);
        loadProducts();
    } catch (err) {
        showNotification('Failed to delete image', 'error');
    }
}
window.removeEditImage = removeEditImage;

// Define handleEditImagesUpload for edit images upload input
function handleEditImagesUpload(event) {
    // Implement your logic here or leave as a stub
}

// Fix logout: Add console.log and ensure window.logout is set at the end
async function logout() {
    console.log('[ADMIN] Logout function called');
    try {
        await fetch(`${API_BASE}/admin/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        document.cookie.split(';').forEach(function(c) {
            document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
        });
        localStorage.clear();
        showNotification('You have been logged out', 'info');
        setTimeout(() => {
            window.location.href = '/not-an-admin-login';
        }, 1200);
    }
}

// Clear cookies and localStorage when closing the admin page
window.addEventListener('beforeunload', function() {
    document.cookie.split(';').forEach(function(c) {
        document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
    });
    localStorage.clear();
});
window.logout = logout;