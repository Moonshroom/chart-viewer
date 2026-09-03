// --- ZMIENNE GLOBALNE ---
let chartDatabase = [];
const chartTypesList = ["ABP", "SID", "AIRPORT", "STAR", "APP", "GNSS-ARRS", "NOISE", "RMAC"];
let selectedTypes = new Set();
let selectedCell = ""; 

const groupDefinitions = {
    "APPROACH": ["AIRPORT", "APP", "ABP"],
    "SID/STAR": ["SID", "STAR", "GNSS-ARRS", "RMAC", "NOISE"]
};
const availableDatabases = ["2026"];

// Elementy DOM
const searchCountryInput = document.getElementById('search-country');
const cycleFilterSelect = document.getElementById('cycle-filter');
const chartsListContainer = document.getElementById('charts-list-container');
const statusBadge = document.getElementById('status-badge');
const btnHelp = document.getElementById('btn-help');
const helpBox = document.getElementById('help-box');

// --- INICJALIZACJA ---
window.addEventListener('DOMContentLoaded', async () => {
    initTypeFilter();
    initCellFilter();
    await initCycleSelect();
});

// --- Refresh Data Button ---

document.getElementById('btn-refresh-data').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-data');
    btn.textContent = "Loading all...";
    btn.disabled = true;

    console.log("[UI] Starting full database refresh...");

    try {
        for (const year of availableDatabases) {
            console.log(`[Network] Loading database: database${year}.json`);
            await loadChartsForYear(year);
        }
        
        console.log("[Success] All databases refreshed.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = window.location.pathname + '?reload=' + new Date().getTime();
        
    } catch (err) {
        console.error("[Error] Failed to reload databases:", err);
        alert("Error: Failed to refresh data. Check console for details.");
    } finally {
        btn.textContent = " ↻ REFRESH DATA ";
        btn.disabled = false;
    }
});

// --- LOGIKA ŁADOWANIA ---

let searchTimeout;

document.getElementById('global-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
        updateChartList();
    }, 400); 
});

async function initCycleSelect() {
    const years = ["2026"].sort((a, b) => b.localeCompare(a));
    cycleFilterSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    cycleFilterSelect.addEventListener('change', () => loadChartsForYear(cycleFilterSelect.value));
    await loadChartsForYear(years[0]);
}


async function loadChartsForYear(year) {
    const statsDisplay = document.getElementById('stats-display');
    const btn = document.getElementById('btn-refresh-data');

    const getTime = (secondsToAdd = 0) => {
        const now = new Date();
        now.setTime(now.getTime() + (secondsToAdd * 1000));
        return now.toTimeString().split(' ')[0];
    };

    if (btn) btn.textContent = "[PROCESSING...]";
    statsDisplay.innerHTML = `<span style="color: #888; font-family: 'Courier New', monospace; font-size: 10px;">[${getTime()}] [sys] querying...</span>`;

    try {
        const response = await fetch(`./database_${year}.json`);
        
        if (!response.ok) throw new Error("HTTP " + response.status);
        
        chartDatabase = await response.json();
        updateChartList();
        
        const uniqueCountries = [...new Set(chartDatabase.map(item => item.country))].length;

        // Wyznaczenie zakresu cykli (cycle range)
        const cycles = [...new Set(chartDatabase.map(item => item.cycle))].filter(Boolean).sort();
        let cycleRangeText = "NONE";
        if (cycles.length === 1) {
            cycleRangeText = cycles[0];
        } else if (cycles.length > 1) {
            cycleRangeText = `${cycles[0]} to ${cycles[cycles.length - 1]}`;
        }

        const folderCounts = chartDatabase.reduce((acc, item) => {
            const folder = item.folder || 'UNKNOWN';
            acc[folder] = (acc[folder] || 0) + 1;
            return acc;
        }, {});

        const typeCounts = chartDatabase.reduce((acc, item) => {
            const type = item['chart-type'] || 'UNKNOWN';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        let logsHtml = `
            <span style="color: #666;">[${getTime(1)}]</span> <span style="color: #21912a;">[LOAD]</span> <span style="color: #888;">database_${year}.json</span><br>
            <span style="color: #666;">[${getTime(2)}]</span> <span style="color: #888;">PDF-RECORDS: ${chartDatabase.length}</span><br>
            <span style="color: #666;">[${getTime(2.5)}]</span> <span style="color: #888;">CYCLE RANGE: ${cycleRangeText}</span><br>
            <span style="color: #444;">----------------------------------------</span><br>
        `;

        logsHtml += `
            <span style="color: #666;">[${getTime(3)}]</span> <span style="color: #888;">COUNTRIES: ${uniqueCountries}</span><br>
        `;
        for (const [type, count] of Object.entries(typeCounts)) {
            logsHtml += `<span style="color: #666;">[${getTime(4)}]</span> <span style="color: #888;">${type}: ${count} PDFs</span><br>`;
        }

        logsHtml += `
            <span style="color: #444;">----------------------------------------</span><br>
        `;

        for (const [folder, count] of Object.entries(folderCounts)) {
            logsHtml += `<span style="color: #666;">[${getTime(5)}]</span> <span style="color: #888;">${folder}: ${count} PDFs</span><br>`;
        }

        statsDisplay.innerHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; font-size: 10px; line-height: 1.4;">
                ${logsHtml}
            </div>
        `;
    } catch (err) {
        statsDisplay.innerHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; font-size: 10px; line-height: 1.4;">
                <span style="color: #666;">[${getTime(6)}]</span> <span style="color: #ff3333;">[${err.name || "ERROR"}]</span> <span style="color: #ff9999;">Failed load database_${year}</span><br>
                <span style="color: #888; font-size: 10px;">>${err.stack}</span>
            </div>
        `;
    } finally {
        if (btn) btn.textContent = "↺ REFRESH DATA";
    }
}


function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (!targetTab) return;
    targetTab.classList.add('active');

    const targetButton = Array.from(document.querySelectorAll('.nav-tab'))
        .find(button => button.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (targetButton) targetButton.classList.add('active');
    document.body.classList.toggle('theme-airac', tabId === 'AIRAC-calendar');
    document.body.classList.toggle('theme-notes', tabId === 'note-searcher');
}
// --- FILTRY ---
function initTypeFilter() {
    const mainContainer = document.querySelector('.main-filters');
    const detailedContainer = document.getElementById('detailed-filters');
    
    mainContainer.innerHTML = '';
    detailedContainer.innerHTML = '';

    // All types
    const allBtn = document.createElement('button');
    allBtn.textContent = "All types";
    allBtn.className = 'filter-btn type-btn active';
    allBtn.id = 'btn-ALL';
    allBtn.onclick = () => {
        selectedTypes.clear();
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        allBtn.classList.add('active');
        updateChartList();
    };
    mainContainer.appendChild(allBtn);

// (APPROACH, SID/STAR)
    const groups = { 
        "APPROACH": ["AIRPORT", "APP", "ABP"], 
        "SID/STAR": ["SID", "STAR", "GNSS-ARRS", "RMAC", "NOISE"] 
    };

    Object.keys(groups).forEach(groupName => {
        const btn = document.createElement('button');
        btn.textContent = groupName;
        btn.className = 'filter-btn type-btn';
        btn.onclick = () => {
            selectedTypes.clear();
            groups[groupName].forEach(t => selectedTypes.add(t));
            
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            groups[groupName].forEach(t => {
                document.getElementById(`btn-${t}`)?.classList.add('active');
            });
            updateChartList();
        };
        mainContainer.appendChild(btn);
    });

    chartTypesList.forEach(type => {
        const btn = document.createElement('button');
        btn.textContent = type;
        btn.className = 'filter-btn type-btn';
        btn.id = `btn-${type}`;
        btn.onclick = () => toggleType(type);
        detailedContainer.appendChild(btn);
    });
}

function initCellFilter() {
    const container = document.getElementById('cell-buttons');
    if (!container) return;
    container.innerHTML = '';

    ["ALL", "EH1", "EH2", "WH1", "WH2", "WH3"].forEach(cell => {
        const btn = document.createElement('button');
        const cellValue = cell === "ALL" ? "" : cell;
        
        btn.textContent = cell;
        btn.className = `filter-btn cell-btn ${selectedCell === cellValue ? "active" : ""}`;
        
        btn.onclick = () => {
            selectedCell = cellValue;
            document.querySelectorAll('.cell-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateChartList();
        };
        container.appendChild(btn);
    });
}

function toggleType(type) {
    document.getElementById('btn-ALL')?.classList.remove('active');
    
    if (selectedTypes.has(type)) {
        selectedTypes.delete(type);
        document.getElementById(`btn-${type}`)?.classList.remove('active');
    } else {
        selectedTypes.add(type);
        document.getElementById(`btn-${type}`)?.classList.add('active');
    }
    
    if (selectedTypes.size === 0) {
        document.getElementById('btn-ALL')?.classList.add('active');
    }
    
    updateChartList();
}

// --- LISTA ---

function updateChartList() {
    chartsListContainer.innerHTML = '';
    
    const noteSearchTerm = document.getElementById('global-search').value.toLowerCase();
    
    const filtered = chartDatabase.filter(chart => {
        const matchesFilters = (chart.country || "").toUpperCase().includes(searchCountryInput.value.toUpperCase()) &&
                               (selectedTypes.size === 0 || selectedTypes.has(chart["chart-type"])) &&
                               (selectedCell === "" || chart.folder === selectedCell);
        
        const matchesNote = noteSearchTerm === "" || 
                            (chart.pages && chart.pages.some(p => 
                                p.text_snippet.toLowerCase().includes(noteSearchTerm)
                            ));
        
        return matchesFilters && matchesNote;
    });

    updateTypeUI();

filtered.forEach(chart => {
    const typeClass = `type-${chart["chart-type"].toLowerCase().replace('/', '-')}`;
    const fileNameWithoutExt = chart.name.replace(/\.[^/.]+$/, "");
    const parts = fileNameWithoutExt.split('_');
    const cycle = parts.length >= 3 ? parts[2] : ""; 
    const btn = document.createElement('button');
    btn.className = 'airport-item';
    btn.innerHTML = `
        <div class="chart-details-row">
            <span class="chart-type ${typeClass}">${chart["chart-type"]}</span>
            <span class="country-title" title="${chart.country}">${chart.country}</span>
            <div class="chart-meta">
                <span class="chart-folder">📁 ${chart.folder}</span>
                ${cycle ? `<span class="chart-separator">•</span><span class="chart-cycle">${cycle}</span>` : ''}
            </div>
        </div>`;
        
btn.onclick = () => {
    document.querySelectorAll('.airport-item').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    
    const foundPageObj = chart.pages && chart.pages.find(p => 
        p.text_snippet.toLowerCase().includes(noteSearchTerm.toLowerCase())
    );
    const pageNum = foundPageObj ? foundPageObj.page_number : 1;
    
    const viewer = document.getElementById('pdf-viewer');
    
    viewer.src = `./pdfjs/web/viewer.html?file=${encodeURIComponent(`../../../${chart.path}`)}#page=${pageNum}&scrollmode=vertical`;
    
viewer.onload = () => {
    if (noteSearchTerm) {
        setTimeout(() => {
            viewer.contentWindow.postMessage({
                type: 'find',
                query: noteSearchTerm 
            }, '*');
        }, 1500); 
    }
};
    
    viewer.style.display = 'block';
};
        chartsListContainer.appendChild(btn);
    });

    const items = document.querySelectorAll('.airport-item');

    const countDisplay = document.getElementById('chart-count');
    if (countDisplay) countDisplay.textContent =`🗐 Showing ${filtered.length} PDFs.`;
}

function updateTypeUI() {
    const groups = { 
        "APPROACH": ["AIRPORT", "APP", "ABP"], 
        "SID/STAR": ["SID", "STAR", "GNSS-ARRS", "RMAC", "NOISE"] 
    };

    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));

    const isAllSelected = (selectedTypes.size === 0 || selectedTypes.size === chartTypesList.length);

    if (isAllSelected) {
        document.getElementById('btn-ALL')?.classList.add('active');
    } else {

        selectedTypes.forEach(t => {
            document.getElementById(`btn-${t}`)?.classList.add('active');
        });


        Object.keys(groups).forEach(groupName => {
            const groupTypes = groups[groupName];
            const isGroupActive = groupTypes.every(t => selectedTypes.has(t));
            
            if (isGroupActive) {
                const groupBtn = Array.from(document.querySelectorAll('.type-btn'))
                                      .find(b => b.textContent === groupName);
                groupBtn?.classList.add('active');
            }
        });
    }
}

searchCountryInput.addEventListener('input', updateChartList);
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('db-toggle-btn');
    const statsDisplay = document.getElementById('stats-display');

    if (toggleBtn && statsDisplay) {
        toggleBtn.addEventListener('click', () => {
            statsDisplay.classList.toggle('collapsed');
            toggleBtn.classList.toggle('active');
        });
    }
});
