document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const searchField = document.getElementById('searchField');
    const sourceCheckboxes = document.querySelectorAll('input[name="source"]');
    const searchResultsContainer = document.getElementById('searchResults');
    const orderListContainer = document.getElementById('orderList');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');
    const orderCountElement = document.getElementById('orderCount');
    const productCountElement = document.getElementById('productCount');
    const columnSelectorBtn = document.getElementById('columnSelectorBtn');
    const columnSelectorDropdown = document.getElementById('columnSelectorDropdown');
    const columnCheckboxesContainer = document.getElementById('columnCheckboxes');

    // State
    let dataFolkestone = [], dataVendome = [], dataWashington = [];
    let currentData = [], orderList = [], lastSearchResults = [];
    let allHeaders = [], visibleColumns = [];

    // --- INITIALISATION ---
    Promise.all([
        fetch('data/mercuriale-folkestone.json').then(r => r.json()),
        fetch('data/mercuriale-vendome.json').then(r => r.json()),
        fetch('data/mercuriale-washington.json').then(r => r.json())
    ])
    .then(([folkestone, vendome, washington]) => {
        dataFolkestone = folkestone.map(x => ({...x, _source: 'Folkestone'}));
        dataVendome = vendome.map(x => ({...x, _source: 'Vendôme'}));
        dataWashington = washington.map(x => ({...x, _source: 'Washington'}));
        
        if (dataFolkestone.length > 0) {
            allHeaders = Object.keys(dataFolkestone[0]).filter(h => h !== '_source');
            // Colonnes visibles par défaut
            visibleColumns = ['Libellé produit', 'Marque', 'Prix'];
            populateColumnSelector();
        }
        
        updateCurrentData();
        updateProductCount();
    })
    .catch(error => {
        console.error("Erreur de chargement des fichiers JSON:", error);
        searchResultsContainer.innerHTML = `<div class="bg-red-50 border-l-4 border-red-400 p-4"><p class="text-sm text-red-700">Erreur : Impossible de charger les données.</p></div>`;
    });

    // --- GESTIONNAIRES D'ÉVÉNEMENTS ---
    sourceCheckboxes.forEach(cb => cb.addEventListener('change', () => {
        updateCurrentData();
        performSearch();
        updateProductCount();
    }));
    
    searchField.addEventListener('change', performSearch);
    searchInput.addEventListener('input', performSearch);

    // Colonnes
    columnSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        columnSelectorDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => columnSelectorDropdown.classList.add('hidden'));
    columnSelectorDropdown.addEventListener('click', e => e.stopPropagation());

    // Ajout / Retrait
    searchResultsContainer.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.btn-add');
        if (addBtn) addProductToOrder(addBtn.dataset.code, addBtn.dataset.source);
        const removeBtn = e.target.closest('.btn-remove-from-search');
        if (removeBtn) removeProductFromOrder(removeBtn.dataset.code, removeBtn.dataset.source);
    });
    
    orderListContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove');
        if (removeBtn) removeProductFromOrder(removeBtn.dataset.code, removeBtn.dataset.source);
    });

    // Export
    downloadCsvBtn.addEventListener('click', downloadOrderAsCSV);
    downloadXlsxBtn.addEventListener('click', downloadOrderAsXLSX);

    // --- FONCTIONS PRINCIPALES ---

    /** Remplit la liste déroulante avec les cases à cocher pour chaque colonne */
    function populateColumnSelector() {
        columnCheckboxesContainer.innerHTML = '';
        allHeaders.forEach(header => {
            const isChecked = visibleColumns.includes(header);
            const checkboxHTML = `
                <label class="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-md cursor-pointer">
                    <input type="checkbox" value="${header}" ${isChecked ? 'checked' : ''}
                           class="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 column-checkbox">
                    <span class="text-sm text-gray-700">${header}</span>
                </label>`;
            columnCheckboxesContainer.insertAdjacentHTML('beforeend', checkboxHTML);
        });
        
        document.querySelectorAll('.column-checkbox').forEach(cb => cb.addEventListener('change', handleColumnSelectionChange));
    }
    
    /** Met à jour la liste des colonnes visibles et rafraîchit les tables */
    function handleColumnSelectionChange(e) {
        const { value, checked } = e.target;
        if (checked) {
            visibleColumns.push(value);
        } else {
            visibleColumns = visibleColumns.filter(col => col !== value);
        }
        // Rafraîchir les deux tables avec la nouvelle sélection de colonnes
        displaySearchResults(lastSearchResults, searchInput.value.trim().toLowerCase());
        renderOrderList();
    }
    
    /** Filtre les données et met à jour les résultats de recherche */
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            lastSearchResults = [];
            displaySearchResults([], query);
            return;
        }
        const field = searchField.value;
        lastSearchResults = currentData.filter(item => {
            if (field === "all") return Object.values(item).some(val => String(val).toLowerCase().includes(query));
            else return (item[field]?.toString().toLowerCase() || '').includes(query);
        });
        displaySearchResults(lastSearchResults, query);
    }
    
    /** Crée le HTML pour une table de données avec les colonnes sélectionnées */
    function createTableHTML(data, type, query = '') {
        return `
            <div class="custom-scrollbar" style="max-height: 400px; overflow-y: auto;">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">Source</th>
                            ${visibleColumns.map(header => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">${header}</th>`).join('')}
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${data.map(item => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSourceColor(item._source)}">${item._source}</span></td>
                                ${visibleColumns.map(header => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${highlightText(item[header], query)}</td>`).join('')}
                                <td class="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                    ${getActionButtonHTML(item, type)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    /** Affiche les résultats de la recherche */
    function displaySearchResults(results, query) {
        if (results.length === 0) {
            if (query.length >= 2) searchResultsContainer.innerHTML = `<div class="text-center py-8 px-4"><p class="text-gray-500">Aucun résultat pour "<strong>${query}</strong>"</p></div>`;
            else updatePlaceholder();
            return;
        }
        searchResultsContainer.innerHTML = createTableHTML(results, 'search', query);
    }

    /** Affiche la liste de commande */
    function renderOrderList() {
        orderCountElement.textContent = orderList.length;
        if (orderList.length === 0) {
            orderListContainer.innerHTML = `<p class="text-center text-gray-500 py-8 px-4">Aucun article ajouté.</p>`;
            downloadCsvBtn.disabled = true;
            downloadXlsxBtn.disabled = true;
            return;
        }
        orderListContainer.innerHTML = createTableHTML(orderList, 'order');
        downloadCsvBtn.disabled = false;
        downloadXlsxBtn.disabled = false;
    }

    // --- FONCTIONS UTILITAIRES ---
    function updateCurrentData() {
        const selectedSources = Array.from(sourceCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
        currentData = [];
        if (selectedSources.includes('folkestone')) currentData.push(...dataFolkestone);
        if (selectedSources.includes('vendome')) currentData.push(...dataVendome);
        if (selectedSources.includes('washington')) currentData.push(...dataWashington);
    }
    
    function addProductToOrder(code, source) { /* ... */ } // Logique reste la même
    function removeProductFromOrder(code, source) { /* ... */ } // Logique reste la même
    
    // --- FONCTIONS D'EXPORT MISES À JOUR ---
    function downloadOrderAsCSV() {
        const headers = ['Source', ...visibleColumns];
        const csvContent = [
            headers.join(';'),
            ...orderList.map(row => 
                [row._source, ...visibleColumns.map(h => {
                    let cell = row[h] ?? '';
                    cell = cell.toString().replace(/"/g, '""');
                    return /[";\n]/.test(cell) ? `"${cell}"` : cell;
                })].join(';')
            )
        ].join('\n');
        
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `commande_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    function downloadOrderAsXLSX() {
        const headers = ['Source', ...visibleColumns];
        const wsData = [ headers, ...orderList.map(row => [row._source, ...visibleColumns.map(h => row[h] || '')]) ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Commande");
        XLSX.writeFile(wb, `commande_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    // --- Fonctions auxiliaires inchangées ou mineures ---
    function getActionButtonHTML(item, type) {
        const dataAttrs = `data-code="${item["Code Produit"]}" data-source="${item._source}"`;
        if (type === 'search') {
            return `<div class="flex items-center space-x-2">
                <button class="btn-primary text-white px-3 py-1 rounded-md text-xs flex items-center btn-add" ${dataAttrs}><i class="fas fa-plus mr-1"></i>Ajouter</button>
                <button class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-xs flex items-center btn-remove-from-search" ${dataAttrs}><i class="fas fa-minus mr-1"></i>Retirer</button>
            </div>`;
        }
        return `<button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs flex items-center btn-remove" ${dataAttrs}><i class="fas fa-trash-alt mr-1"></i>Retirer</button>`;
    }
    
    function addProductToOrder(code, source) {
        if (orderList.some(p => p["Code Produit"] == code && p._source === source)) {
            showNotification(`Cet article est déjà dans la commande.`, 'warning'); return;
        }
        const product = currentData.find(p => p["Code Produit"] == code && p._source === source);
        if (product) {
            orderList.push({...product});
            renderOrderList();
            showNotification('Article ajouté', 'success');
        }
    }

    function removeProductFromOrder(code, source) {
        const initialLength = orderList.length;
        orderList = orderList.filter(p => !(p["Code Produit"] == code && p._source === source));
        if (orderList.length < initialLength) {
            renderOrderList();
            showNotification('Article retiré', 'info');
        }
    }

    function updateProductCount() { productCountElement.textContent = `${currentData.length} produits`; }
    function highlightText(text, query) { if (!query || !text) return text ?? ''; return String(text).replace(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'), '<span class="search-highlight">$1</span>'); }
    function getSourceColor(source) { switch(source) { case 'Folkestone': return 'bg-blue-100 text-blue-800'; case 'Vendôme': return 'bg-purple-100 text-purple-800'; default: return 'bg-green-100 text-green-800'; } }
    function updatePlaceholder() { searchResultsContainer.innerHTML = `<div class="text-center py-8 px-4"><p class="text-gray-500">Commencez à taper pour rechercher...</p></div>`; }
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const icons = {'success': 'fa-check-circle', 'error': 'fa-exclamation-circle', 'warning': 'fa-exclamation-triangle', 'info': 'fa-info-circle'};
        const colors = {'success': 'bg-green-500', 'error': 'bg-red-500', 'warning': 'bg-yellow-500', 'info': 'bg-blue-500'};
        notification.className = `fixed bottom-4 right-4 text-white px-4 py-3 rounded-md shadow-lg flex items-center z-50 transition-all duration-300 transform translate-y-16 opacity-0`;
        notification.innerHTML = `<i class="fas ${icons[type] || icons['info']} mr-2"></i><span>${message}</span>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.remove('translate-y-16', 'opacity-0'), 10);
        setTimeout(() => { notification.classList.add('opacity-0'); setTimeout(() => notification.remove(), 300); }, 3000);
    }
});
