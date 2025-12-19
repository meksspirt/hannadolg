let debtChartInstance = null;
let allDisplayTransactions = [];
let transactionsVisible = true;
let currentFilter = 'all';
let searchQuery = '';
let currentPage = 1;
const itemsPerPage = 10;
let sortOrder = 'desc'; // По умолчанию сначала новые

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initTheme();
    loadFromDatabase(); // Загружаем данные при старте
});

async function loadFromDatabase() {
    const emptyState = document.getElementById('empty-state');
    const analyticsSection = document.getElementById('analytics-section');
    const quickStats = document.getElementById('quick-stats');

    try {
        const response = await fetch('/api/get-transactions');
        if (!response.ok) throw new Error('Ошибка связи с сервером');

        const data = await response.json();
        if (data && data.length > 0) {
            processData(data, true); // true означает данные из БД (snake_case)
            analyticsSection.style.display = 'block';
            emptyState.style.display = 'none';
            quickStats.style.display = 'grid';
        }
    } catch (e) {
        console.log('Пока данных в базе нет или ошибка:', e.message);
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.className = savedTheme + '-theme';
    document.getElementById('themeToggle').textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

function setupEventListeners() {
    document.getElementById('processButton').addEventListener('click', handleFileUpload);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('toggleTransactionsButton').addEventListener('click', toggleTransactionsVisibility);

    // Обработка выбора файла (показ имени)
    document.getElementById('csvFileInput').addEventListener('change', function (e) {
        const fileName = e.target.files[0]?.name;
        if (fileName) {
            const label = document.querySelector('label[for="csvFileInput"]');
            label.textContent = 'Выбран файл: ' + fileName;
            label.style.borderColor = 'var(--success-color)';
            label.style.color = 'var(--success-color)';
        }
    });

    // Фильтры
    document.getElementById('filterAll').addEventListener('click', () => setFilter('all'));
    document.getElementById('filterGiven').addEventListener('click', () => setFilter('given'));
    document.getElementById('filterReceived').addEventListener('click', () => setFilter('received'));

    // Поиск
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1; // Сброс на первую страницу при поиске
        renderTransactions();
    });
}

function toggleTheme() {
    const current = document.body.className === 'light-theme' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    document.body.className = next + '-theme';
    document.getElementById('themeToggle').textContent = next === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', next);
    if (debtChartInstance) updateChartColors();
}

function handleFileUpload() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('Пожалуйста, сначала выберите CSV файл.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (event) {
        const text = event.target.result;
        const transactions = parseCsvLocal(text);
        if (transactions.length === 0) {
            alert('Транзакций для "Ганна Є." не обнаружено.');
            return;
        }

        // Сохраняем в базу данных Supabase
        try {
            const btn = document.getElementById('processButton');
            const originalText = btn.textContent;
            btn.textContent = 'Сохранение в облако...';
            btn.disabled = true;

            const response = await fetch('/api/add-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactions)
            });

            if (!response.ok) throw new Error('Не удалось сохранить в БД');

            alert('Данные успешно синхронизированы с Supabase!');
            btn.textContent = originalText;
            btn.disabled = false;

            // После сохранения загружаем всё из базы заново, чтобы увидеть результат
            loadFromDatabase();
        } catch (e) {
            console.error(e);
            alert('Ошибка при сохранении в базу. Но мы покажем данные локально.');
            processData(transactions, false); // false означает локальные данные (camelCase)
        }

        document.getElementById('analytics-section').style.display = 'block';
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('quick-stats').style.display = 'grid';
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCsvLocal(csvText) {
    const lines = csvText.split('\n').slice(1);
    const transactions = [];
    const targetName = "Ганна Є.";
    const debtCategory = "Долги";

    lines.forEach(line => {
        if (line.trim() === '') return;
        const columns = line.split(';');
        const cleanedColumns = columns.map(col => col.replace(/"/g, '').trim());

        if (cleanedColumns.length < 12) return;

        const payee = cleanedColumns[2];
        const incomeAccountName = cleanedColumns[7];
        const outcomeAccountName = cleanedColumns[4];

        if (payee.includes(targetName) && (incomeAccountName.includes(debtCategory) || outcomeAccountName.includes(debtCategory))) {
            const dateParts = cleanedColumns[0].split('-');
            const formattedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toISOString().split('T')[0];

            transactions.push({
                date: formattedDate,
                categoryName: cleanedColumns[1],
                payee: payee,
                comment: cleanedColumns[3],
                outcomeAccountName: outcomeAccountName,
                outcome: parseFloat(cleanedColumns[5]) || 0,
                incomeAccountName: incomeAccountName,
                income: parseFloat(cleanedColumns[8]) || 0,
                createdDate: cleanedColumns[10],
                rawLine: line
            });
        }
    });
    return transactions;
}

function processData(transactions, isFromDb = false) {
    // Сортируем по дате создания
    transactions.sort((a, b) => {
        const dateA = new Date(isFromDb ? a.created_date : a.createdDate);
        const dateB = new Date(isFromDb ? b.created_date : b.createdDate);
        return dateA - dateB;
    });

    let totalGiven = 0;
    let totalReceived = 0;
    let runningDebt = 0;
    let givenCount = 0;
    let receivedCount = 0;

    const monthlySummary = {};
    allDisplayTransactions = [];

    transactions.forEach(row => {
        // Учет разницы имен полей в БД (snake_case) и в CSV (camelCase)
        const incomeAcc = isFromDb ? row.income_account_name : row.incomeAccountName;
        const outcomeAcc = isFromDb ? row.outcome_account_name : row.outcomeAccountName;
        const incomeVal = parseFloat(isFromDb ? row.income : row.income) || 0;
        const outcomeVal = parseFloat(isFromDb ? row.outcome : row.outcome) || 0;
        const createdDateVal = isFromDb ? row.created_date : row.createdDate;
        const dateVal = isFromDb ? row.date : row.date;
        const commentVal = isFromDb ? row.comment : row.comment;

        let type = '';
        let amount = 0;

        if (incomeAcc.includes('Долги') && outcomeVal > 0) {
            runningDebt += outcomeVal;
            totalGiven += outcomeVal;
            type = 'Дано в долг';
            amount = outcomeVal;
            givenCount++;
        } else if (outcomeAcc.includes('Долги') && incomeVal > 0) {
            runningDebt -= incomeVal;
            totalReceived += incomeVal;
            type = 'Возврат долга';
            amount = incomeVal;
            receivedCount++;
        }

        if (type) {
            const createdDate = new Date(createdDateVal);
            const monthKey = createdDate.toISOString().slice(0, 7);

            if (!monthlySummary[monthKey]) {
                monthlySummary[monthKey] = { given: 0, received: 0, endOfMonthDebt: 0 };
            }
            if (type === 'Дано в долг') monthlySummary[monthKey].given += amount;
            else monthlySummary[monthKey].received += amount;

            monthlySummary[monthKey].endOfMonthDebt = runningDebt;

            allDisplayTransactions.push({
                date: new Date(row.date).toLocaleDateString('ru-RU'),
                comment: row.comment,
                type: type,
                amount: amount,
                debt: runningDebt,
                createdDate: createdDate
            });
        }
    });

    renderAll(totalGiven, totalReceived, runningDebt, givenCount, receivedCount, monthlySummary);
}

function renderAll(totalGiven, totalReceived, runningDebt, givenCount, receivedCount, monthlySummary) {
    renderQuickStats(totalGiven, totalReceived, runningDebt);
    renderForecast(runningDebt, totalReceived, receivedCount);
    renderEfficiency(totalGiven, totalReceived);
    renderChart(allDisplayTransactions);
    renderMonthlySummary(monthlySummary);
    renderAdvice(runningDebt);
    renderTransactions();
}

function renderQuickStats(given, received, debt) {
    const container = document.getElementById('quick-stats');
    container.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Текущий долг</span>
            <span class="stat-value danger">${debt.toFixed(2)} ₴</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Всего возвращено</span>
            <span class="stat-value success">${received.toFixed(2)} ₴</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Всего выдано</span>
            <span class="stat-value">${given.toFixed(2)} ₴</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Процент возврата</span>
            <span class="stat-value">${given > 0 ? ((received / given) * 100).toFixed(1) : 0}%</span>
        </div>
    `;
}

function renderForecast(debt, totalReceived, receivedCount) {
    const container = document.getElementById('forecast-content');
    if (debt <= 0) {
        container.innerHTML = '<p class="success-text">Долг полностью погашен! 🎉</p>';
        return;
    }

    const avgPayment = receivedCount > 0 ? totalReceived / receivedCount : 0;

    if (avgPayment === 0) {
        container.innerHTML = '<p>Пока не было возвратов для расчета прогноза.</p>';
        return;
    }

    const paymentsLeft = Math.ceil(debt / avgPayment);
    container.innerHTML = `
        <p>При среднем платеже <strong>${avgPayment.toFixed(2)} ₴</strong> осталось примерно:</p>
        <div class="forecast-badge">${paymentsLeft} платеж(ей)</div>
        <p style="margin-top:1rem; font-size: 0.85rem; color: var(--text-secondary)">
            Расчет основан на истории из ${receivedCount} возвратов.
        </p>
    `;
}

function renderEfficiency(given, received) {
    const container = document.getElementById('efficiency-content');
    const ratio = given > 0 ? (received / given) : 0;
    let label = "Низкая";
    let color = "danger";

    if (ratio > 0.7) { label = "Высокая"; color = "success"; }
    else if (ratio > 0.4) { label = "Средняя"; color = "accent"; }

    container.innerHTML = `
        <p>Дисциплина возвратов:</p>
        <span class="stat-value ${color}">${label}</span>
        <p style="margin-top:0.5rem">Ганна вернула ${received.toFixed(0)} из каждых ${given.toFixed(0)} взятых гривен.</p>
    `;
}

function renderTransactions() {
    const transactionsDiv = document.getElementById('transactions');

    // 1. Фильтрация и поиск
    let filtered = allDisplayTransactions.filter(t => {
        const matchesFilter =
            currentFilter === 'all' ||
            (currentFilter === 'given' && t.type === 'Дано в долг') ||
            (currentFilter === 'received' && t.type === 'Возврат долга');

        const matchesSearch = t.comment.toLowerCase().includes(searchQuery);
        return matchesFilter && matchesSearch;
    });

    // 2. Сортировка по дате (createdDate для точности)
    filtered.sort((a, b) => {
        const dateA = new Date(a.createdDate);
        const dateB = new Date(b.createdDate);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // 3. Пагинация
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const toShow = transactionsVisible ? filtered.slice(startIndex, startIndex + itemsPerPage) : [];

    // 4. Генерация таблицы
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th id="sortDate" style="cursor:pointer; user-select:none;">
                        Дата ${sortOrder === 'desc' ? '▼' : '▲'}
                    </th>
                    <th>Комментарий</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                    <th>Долг</th>
                </tr>
            </thead>
            <tbody>
    `;

    toShow.forEach(t => {
        tableHTML += `<tr>
            <td>${t.date}</td>
            <td>${t.comment}</td>
            <td><span class="badge ${t.type === 'Дано в долг' ? 'danger' : 'success'}">${t.type}</span></td>
            <td>${t.amount.toFixed(2)}</td>
            <td><strong>${t.debt.toFixed(2)}</strong></td>
        </tr>`;
    });
    tableHTML += '</tbody></table>';

    // 5. Пагинация (контролы)
    if (totalItems > itemsPerPage && transactionsVisible) {
        tableHTML += `
            <div class="pagination">
                <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>←</button>
                <span class="page-info">Страница ${currentPage} из ${totalPages}</span>
                <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>→</button>
            </div>
        `;
    }

    if (totalItems === 0) {
        transactionsDiv.innerHTML = '<p style="padding: 2rem; text-align:center">Ничего не найдено</p>';
    } else {
        transactionsDiv.innerHTML = tableHTML;
        setupTableListeners(totalPages);
    }
}

function setupTableListeners(totalPages) {
    // Слушатель сортировки
    const sortHeader = document.getElementById('sortDate');
    if (sortHeader) {
        sortHeader.addEventListener('click', () => {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
            renderTransactions();
        });
    }

    // Слушатели пагинации
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTransactions();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTransactions();
            }
        });
    }
}

function setFilter(filter) {
    currentFilter = filter;
    currentPage = 1; // Сброс на первую страницу
    document.querySelectorAll('.filter-buttons button').forEach(btn => {
        btn.classList.toggle('active', btn.id === 'filter' + filter.charAt(0).toUpperCase() + filter.slice(1));
    });
    renderTransactions();
}

function toggleTransactionsVisibility() {
    const wrapper = document.getElementById('transactions-wrapper');
    const btn = document.getElementById('toggleTransactionsButton');
    transactionsVisible = !transactionsVisible;
    wrapper.style.display = transactionsVisible ? 'block' : 'none';
    btn.textContent = transactionsVisible ? 'Свернуть список' : 'Развернуть список';
}

function renderChart(transactions) {
    const canvasId = 'debtChart';
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // Самый надежный способ очистки canvas в Chart.js
    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.destroy();
    }

    const labels = transactions.map(t => t.createdDate);
    const data = transactions.map(t => t.debt);

    const isDark = document.body.className === 'dark-theme';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    debtChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Сумма долга',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f1f5f9' : '#1e293b',
                    bodyColor: isDark ? '#f1f5f9' : '#1e293b',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }
            }
        }
    });
}

function updateChartColors() {
    const isDark = document.body.className === 'dark-theme';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    debtChartInstance.options.scales.x.grid.color = gridColor;
    debtChartInstance.options.scales.x.ticks.color = textColor;
    debtChartInstance.options.scales.y.grid.color = gridColor;
    debtChartInstance.options.scales.y.ticks.color = textColor;
    debtChartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#1e293b' : '#ffffff';
    debtChartInstance.update();
}

function renderMonthlySummary(summary) {
    const div = document.getElementById('monthly-summary');
    let html = '<h3>Сводка по месяцам</h3><table><tr><th>Месяц</th><th>Выдано</th><th>Вернула</th></tr>';

    Object.keys(summary).sort().reverse().forEach(month => {
        const d = summary[month];
        html += `<tr>
            <td>${month}</td>
            <td class="danger">+${d.given.toFixed(0)}</td>
            <td class="success">-${d.received.toFixed(0)}</td>
        </tr>`;
    });
    html += '</table>';
    div.innerHTML = html;
}

function renderAdvice(debt) {
    const div = document.getElementById('advice');
    let advice = '<h3>Рекомендации</h3>';
    if (debt <= 0) {
        advice += '<p>Все чисто! Долгов нет. Ганна молодец!</p>';
    } else if (debt > 5000) {
        advice += '<p>⚠️ Долг превысил 5000 ₴. Стоит обсудить план постепенного погашения.</p>';
    } else {
        advice += '<p>💡 Хорошая динамика. Регулярные небольшие возвраты лучше, чем ожидание одного крупного.</p>';
    }
    div.innerHTML = advice;
}
