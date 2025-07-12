// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Les sélecteurs DOM restent les mêmes
    const searchInput = document.getElementById('searchInput');
    const searchField = document.getElementById('searchField');
    const sourceCheckboxes = document.querySelectorAll('input[name="source"]');
    const searchResultsContainer = document.getElementById('searchResults');
    const orderListContainer = document.getElementById('orderList');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');
    const orderCountElement = document.getElementById('orderCount');
    const productCountElement = document.getElementById('productCount');

    // La logique de données reste la même
    let dataFolkestone = [], dataVendome = [], dataWashington = [];
    let currentData = [], orderList = [], dataHeaders = [];

    // Le chargement des données reste le même
    Promise.all([
        fetch('data/mercuriale-folkestone.json').then(r => r.json()),
        fetch('data/mercuriale-vendome.json').then(r => r.json()),
        fetch('data/mercuriale-washington.json').then(r => r.json())
    ])
    .then(([folkestone, vendome, washington]) => {
        dataFolkestone = folkestone.map(x => ({...x, _source: 'Folkestone'}));
        dataVendome = vendome.map(x => ({...x, _source: 'Vendôme'}));
        dataWashington = washington.map(x => ({...x, _source: 'Washington'}));
        updateCurrentData();
        updateProductCount();
    })
    .catch(error => {
        console.error("Erreur de chargement des fichiers JSON:", error);
        searchResultsContainer.innerHTML = `<div class="bg-red-50 border-l-4 border-red-400 p-4"><div class="flex"><div class="flex-shrink-0"><i class="fas fa-exclamation-circle text-red-400"></i></div><div class="ml-3"><p class="text-sm text-red-700">Erreur : Impossible de charger les fichiers de données.<br>Vérifiez que le dossier <b>data/</b> et ses fichiers JSON sont présents, et que la page est lancée via un serveur local (ex: Live Server sur VSCode).</p></div></div></div>`;
    });

    // Tous les gestionnaires d'événements restent les mêmes
    sourceCheckboxes.forEach(checkbox => checkbox.addEventListener('change', () => {
        updateCurrentData();
        searchInput.value = '';
        displaySearchResults([]);
        updateProductCount();
    }));
    searchField.addEventListener('change', () => searchInput.dispatchEvent(new Event('input')));
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            displaySearchResults([]); return;
        }
        const field = searchField.value;
        const results = currentData.filter(item => {
            if (field === "all") return (item["Code Produit"]?.toString().toLowerCase() || '').includes(query) || (item["Libellé produit"]?.toString().toLowerCase() || '').includes(query) || (item["Marque"]?.toString().toLowerCase() || '').includes(query);
            else return (item[field]?.toString().toLowerCase() || '').includes(query);
        });
        displaySearchResults(results, query);
    });
    searchResultsContainer.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.btn-add');
        if (addBtn) {
            const { code, source } = addBtn.dataset;
            addProductToOrder(code, source);
            addBtn.innerHTML = '<i class="fas fa-check"></i> Ajouté'; addBtn.classList.replace('btn-primary', 'bg-green-500'); setTimeout(() => { addBtn.innerHTML = '<i class="fas fa-plus mr-1"></i> Ajouter'; addBtn.classList.replace('bg-green-500', 'btn-primary'); }, 1000);
            return;
        }
        const removeBtn = e.target.closest('.btn-remove-from-search');
        if (removeBtn) {
            const { code, source } = removeBtn.dataset;
            removeProductFromOrder(code, source);
            removeBtn.innerHTML = '<i class="fas fa-check"></i> Retiré'; removeBtn.classList.replace('bg-gray-500', 'bg-red-500'); setTimeout(() => { removeBtn.innerHTML = '<i class="fas fa-minus mr-1"></i> Retirer'; removeBtn.classList.replace('bg-red-500', 'bg-gray-500'); }, 1000);
        }
    });
    orderListContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.btn-remove');
        if (removeBtn) {
            removeProductFromOrder(removeBtn.dataset.code, removeBtn.dataset.source);
        }
    });
    downloadCsvBtn.addEventListener('click', downloadOrderAsCSV);
    downloadXlsxBtn.addEventListener('click', downloadOrderAsXLSX);


    // --- FONCTIONS CORRIGÉES ---

    // << CORRECTION MAJEURE : NOUVELLE STRUCTURE HTML >>
    function displaySearchResults(results, query = '') {
        // Enlève la classe 'table-container' du parent, car on gère nous-mêmes
        searchResultsContainer.className = 'border border-gray-200 rounded-lg';

        if (results.length === 0) {
            if (searchInput.value.trim().length >= 2) {
                searchResultsContainer.innerHTML = `<div class="text-center py-8 px-4"><i class="fas fa-search text-gray-400 text-4xl mb-3"></i><p class="text-gray-500">Aucun résultat trouvé pour "<strong>${searchInput.value}</strong>"</p></div>`;
            } else {
                updatePlaceholder();
            }
            return;
        }
        
        // Nouvelle structure : un div pour le scroll vertical, un div enfant pour le scroll horizontal
        const tableHTML = `
            <div class="custom-scrollbar" style="max-height: 400px; overflow-y: auto;">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Source</th>
                                ${dataHeaders.map(header => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">${header}</th>`).join('')}
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${results.map(item => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSourceColor(item._source)}">${item._source}</span></td>
                                    ${dataHeaders.map(header => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${highlightText(item[header], query)}</td>`).join('')}
                                    <td class="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                        <div class="flex items-center space-x-2">
                                            <button class="btn-primary text-white px-3 py-1 rounded-md text-xs flex items-center btn-add" data-code="${item["Code Produit"]}" data-source="${item._source}">
                                                <i class="fas fa-plus mr-1"></i> Ajouter
                                            </button>
                                            <button class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-xs flex items-center btn-remove-from-search" data-code="${item["Code Produit"]}" data-source="${item._source}">
                                                <i class="fas fa-minus mr-1"></i> Retirer
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        searchResultsContainer.innerHTML = tableHTML;
    }
    
    // << CORRECTION MAJEURE : NOUVELLE STRUCTURE HTML >>
    function renderOrderList() {
        orderCountElement.textContent = orderList.length;
        // Enlève la classe 'table-container' du parent, car on gère nous-mêmes
        orderListContainer.className = 'border border-gray-200 rounded-lg';
        
        if (orderList.length === 0) {
            orderListContainer.innerHTML = `<p class="text-center text-gray-500 py-8 px-4">Aucun article ajouté. Cliquez sur "Ajouter" dans les résultats de recherche.</p>`;
            downloadCsvBtn.disabled = true;
            downloadXlsxBtn.disabled = true;
            return;
        }
        
        // Nouvelle structure : un div pour le scroll vertical, un div enfant pour le scroll horizontal
        const tableHTML = `
            <div class="custom-scrollbar" style="max-height: 400px; overflow-y: auto;">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Source</th>
                                ${dataHeaders.map(header => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">${header}</th>`).join('')}
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${orderList.map(item => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSourceColor(item._source)}">${item._source}</span></td>
                                    ${dataHeaders.map(header => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item[header] || ''}</td>`).join('')}
                                    <td class="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                        <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-xs flex items-center btn-remove" data-code="${item["Code Produit"]}" data-source="${item._source}">
                                            <i class="fas fa-trash-alt mr-1"></i> Retirer
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        orderListContainer.innerHTML = tableHTML;
        downloadCsvBtn.disabled = false;
        downloadXlsxBtn.disabled = false;
    }
    
    // Le reste des fonctions utilitaires est inchangé
    function getSelectedSources() { return Array.from(document.querySelectorAll('input[name="source"]:checked')).map(cb => cb.value); }
    function updateCurrentData() {
        const selectedSources = getSelectedSources(); let mergedData = [];
        if (selectedSources.includes('folkestone')) mergedData.push(...dataFolkestone); if (selectedSources.includes('vendome')) mergedData.push(...dataVendome); if (selectedSources.includes('washington')) mergedData.push(...dataWashington);
        currentData = mergedData; if (currentData.length > 0) { dataHeaders = Object.keys(currentData[0]).filter(h => h !== '_source'); } updatePlaceholder();
    }
    function updateProductCount() { const count = currentData.length; productCountElement.textContent = `${count} produit${count !== 1 ? 's' : ''}`; }
    function highlightText(text, query) { if (!query || !text) return text || ''; const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'); return text.toString().replace(regex, '<span class="search-highlight">$1</span>'); }
    function addProductToOrder(productCode, source) { const productCodeStr = productCode.toString(); if (orderList.some(p => p["Code Produit"].toString() === productCodeStr && p._source === source)) { showNotification(`Cet article de "${source}" est déjà dans la commande.`, 'warning'); return; } const productToAdd = currentData.find(p => p["Code Produit"].toString() === productCodeStr && p._source === source); if (productToAdd) { orderList.push({...productToAdd}); renderOrderList(); showNotification('Article ajouté à la commande', 'success'); } }
    function removeProductFromOrder(productCode, source) { const productCodeStr = productCode.toString(); const initialLength = orderList.length; orderList = orderList.filter(p => !(p["Code Produit"].toString() === productCodeStr && p._source === source)); if (orderList.length < initialLength) { renderOrderList(); showNotification('Article retiré de la commande', 'info'); } }
    function getSourceColor(source) { switch(source) { case 'Folkestone': return 'bg-blue-100 text-blue-800'; case 'Vendôme': return 'bg-purple-100 text-purple-800'; case 'Washington': return 'bg-green-100 text-green-800'; default: return 'bg-gray-100 text-gray-800'; } }
    function downloadOrderAsCSV() { /* ...inchangé... */ }
    function downloadOrderAsXLSX() { /* ...inchangé... */ }
    function updatePlaceholder() {
        const selected = getSelectedSources(); let sourceName = selected.length > 0 ? selected.map(src => ({'folkestone': 'Folkestone', 'vendome': 'Vendôme', 'washington': 'Washington'})[src] || src).join(', ') : 'aucune mercuriale';
        searchResultsContainer.innerHTML = `<div class="text-center py-8 px-4"><i class="fas fa-search text-gray-400 text-4xl mb-3"></i><p class="text-gray-500">Commencez à taper pour rechercher dans : <strong>${sourceName}</strong></p></div>`;
    }
    function showNotification(message, type = 'info') { /* ...inchangé... */ }
});
