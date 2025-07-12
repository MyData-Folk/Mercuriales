document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const orderList = document.getElementById('orderList');
    const orderCount = document.getElementById('orderCount');
    const csvBtn = document.getElementById('downloadCsvBtn');
    const xlsxBtn = document.getElementById('downloadXlsxBtn');

    let orderItems = [];

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        searchResults.innerHTML = query ? `<div class='p-4'>Résultat fictif pour "<strong>${query}</strong>" <button class='ml-2 px-2 py-1 bg-indigo-500 text-white text-xs rounded add-btn'>Ajouter</button></div>` : '';
    });

    searchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-btn')) {
            const itemText = e.target.parentElement.textContent.replace('Ajouter', '').trim();
            if (!orderItems.includes(itemText)) {
                orderItems.push(itemText);
                updateOrderList();
            }
        }
    });

    orderList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const item = e.target.dataset.item;
            orderItems = orderItems.filter(i => i !== item);
            updateOrderList();
        }
    });

    function updateOrderList() {
        orderCount.textContent = orderItems.length;
        if (orderItems.length === 0) {
            orderList.innerHTML = '<div class="p-4 text-gray-500 text-center">Aucun article ajouté.</div>';
            csvBtn.disabled = true;
            xlsxBtn.disabled = true;
            return;
        }
        csvBtn.disabled = false;
        xlsxBtn.disabled = false;
        orderList.innerHTML = orderItems.map(item => `<div class='p-2 border-b flex justify-between items-center'><span>${item}</span><button class='remove-btn text-sm text-red-500' data-item="${item}">Retirer</button></div>`).join('');
    }
});