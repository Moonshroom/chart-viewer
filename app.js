let dbInstance = null;
let chartDatabase = {};

const DB_NAME = 'ViewerDB';
const DB_VERSION = 3;
const STORE_NAME = 'charts';

const btnLoadFolder = document.getElementById('btn-load-folder');
const btnClearData = document.getElementById('btn-clear-data');
const searchCountryInput = document.getElementById('search-country');
const cellFilterSelect = document.getElementById('cell-filter');
const typeFilterSelect = document.getElementById('type-filter');
const cycleFilterSelect = document.getElementById('cycle-filter');
const chartsListContainer = document.getElementById('charts-list-container');
const pdfContainer = document.getElementById('pdf-container');
const statusBadge = document.getElementById('status-badge');
const btnHelp = document.getElementById('btn-help');
const helpBox = document.getElementById('help-box');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';


window.addEventListener('DOMContentLoaded', async () => {
    await initIndexedDB();
    await loadChartsFromCache();
});


btnLoadFolder.addEventListener('click', async () => {
    const dirHandle = await window.showDirectoryPicker();
    await performScan(dirHandle);
});


let searchTimer;
searchCountryInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        const val = e.target.value;
        if (val.length >= 3 || val.length === 0) {
            updateChartList();
        }
    }, 300);
});


btnHelp.addEventListener('click', () => {
    helpBox.classList.toggle('hidden');
    btnHelp.textContent = helpBox.classList.contains('hidden') ? 'ℹ️ How to use' : 'Hide Help';
});

[cellFilterSelect, typeFilterSelect, cycleFilterSelect].forEach(el => 
    el.addEventListener('change', updateChartList)
);
cycleFilterSelect.addEventListener('change', () => { buildCellFilter(); updateChartList(); });

btnClearData.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all cached charts?")) {
        const store = dbInstance.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
        store.clear().onsuccess = () => {
            chartDatabase = {};
            chartsListContainer.innerHTML = '';
            cycleFilterSelect.innerHTML = '<option value="">No data</option>';
            cellFilterSelect.innerHTML = '<option value="">All Cells</option>';
            statusBadge.textContent = "Cache cleared";
            statusBadge.classList.remove('hidden');
            [searchCountryInput, cellFilterSelect, typeFilterSelect, cycleFilterSelect]
                .forEach(el => el.disabled = true);
            updateStatsDisplay();
        };
    }
});


function initIndexedDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (db.objectStoreNames.contains(STORE_NAME)) db.deleteObjectStore(STORE_NAME);
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = (e) => { dbInstance = e.target.result; resolve(); };
    });
}

async function loadChartsFromCache() {
    const store = dbInstance.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME);
    store.getAll().onsuccess = (e) => {
        const cachedItems = e.target.result;
        if (cachedItems.length > 0) {
            chartDatabase = {};
            cachedItems.forEach(item => {
                if (!chartDatabase[item.parentCycle]) chartDatabase[item.parentCycle] = [];
                chartDatabase[item.parentCycle].push(item);
            });
            statusBadge.textContent = "Data loaded from cache";
            statusBadge.classList.remove('hidden');
            const cycles = Object.keys(chartDatabase).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
            unlockInterface();
            buildCycleFilter(cycles);
            buildCellFilter();
            updateChartList();
            updateStatsDisplay();
        }
    };
}

async function performScan(handle) {
    statusBadge.textContent = "Processing files...";
    statusBadge.classList.remove('hidden');
    const store = dbInstance.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    store.clear();
    chartDatabase = {};
    
    await scanDirectoryRecursively(handle, '', '');
    
    const cycles = Object.keys(chartDatabase).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
    unlockInterface();
    buildCycleFilter(cycles);
    buildCellFilter();
    updateChartList();
    updateStatsDisplay();
    statusBadge.textContent = "Data ready.";
}


async function scanDirectoryRecursively(dirHandle, currentCycle, parentFolderName) {
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
            let nextCycle = currentCycle || (entry.name.match(/^26\d{2}$/) ? entry.name : '');
            let nextFolderName = currentCycle ? entry.name : parentFolderName;
            await scanDirectoryRecursively(entry, nextCycle, nextFolderName);
        } else if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
            if (currentCycle) {
                const parts = entry.name.split('_');
                const nameUpper = entry.name.toUpperCase();
                let type = 'OTHER';
                if (nameUpper.includes('STAR')) type = 'STAR';
                else if (nameUpper.includes('SID')) type = 'SID';
                else if (nameUpper.includes('RMAC')) type = 'RMAC';
                else if (nameUpper.includes('NOISE')) type = 'NOISE';
                
                const record = { parentCycle: currentCycle, country: parts[0], folderName: parentFolderName || 'Root', type, fileBlob: await entry.getFile(), fullName: entry.name };
                if (!chartDatabase[currentCycle]) chartDatabase[currentCycle] = [];
                chartDatabase[currentCycle].push(record);
                dbInstance.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).add(record);
            }
        }
    }
}

function unlockInterface() {
    [searchCountryInput, cellFilterSelect, typeFilterSelect, cycleFilterSelect].forEach(el => el.disabled = false);
}

function buildCycleFilter(cycles) {
    cycleFilterSelect.innerHTML = cycles.map(c => `<option value="${c}">Cycle ${c}</option>`).join('');
}

function buildCellFilter() {
    const activeCycle = cycleFilterSelect.value;
    const folders = [...new Set(chartDatabase[activeCycle]?.map(i => i.folderName))].sort();
    cellFilterSelect.innerHTML = '<option value="">All Cells</option>' + folders.map(f => `<option value="${f}">${f}</option>`).join('');
}

function updateChartList() {
    chartsListContainer.innerHTML = '';
    

    const filtered = chartDatabase[cycleFilterSelect.value]?.filter(i => 
        i.country.toUpperCase().includes(searchCountryInput.value.toUpperCase()) &&
        (typeFilterSelect.value === "" || i.type === typeFilterSelect.value) &&
        (cellFilterSelect.value === "" || i.folderName === cellFilterSelect.value)
    ).sort((a,b) => a.country.localeCompare(b.country) || a.folderName.localeCompare(b.folderName));

    const countDisplay = document.getElementById('chart-count');
    if (countDisplay) {
        countDisplay.textContent = filtered ? `${filtered.length} found` : "0 found";
    }


    filtered?.forEach(chart => {
        const btn = document.createElement('button');
        btn.className = 'airport-item';
        // console.log(chart)
const typeClass = `type-${chart.type.toLowerCase()}`;

btn.innerHTML = `
    <div class="country-title">${chart.country}</div>
    <div class="chart-details">
        <span class="chart-type ${typeClass}">${chart.type}</span>
        <span class="chart-folder">📁 ${chart.folderName}</span>
        <span class="cycle-badge">📅 ${chart.fullName.replace('.pdf','').split('_').pop()}</span>
    </div>`;
        
        btn.onclick = () => {
            document.querySelectorAll('.airport-item').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            const viewer = document.getElementById('pdf-viewer');
            const noPdfMsg = document.getElementById('no-pdf-message');
            
            if (noPdfMsg) noPdfMsg.style.display = 'none';
            
            const url = URL.createObjectURL(chart.fileBlob);
            viewer.src = `./pdfjs/web/viewer.html?file=${encodeURIComponent(url)}`;
            viewer.style.display = 'block';
        };
        
        chartsListContainer.appendChild(btn);
    });
}

function updateStatsDisplay() {
    const totalCharts = Object.values(chartDatabase).flat().length;
    const totalCycles = Object.keys(chartDatabase).length;
    document.getElementById('stats-charts').textContent = `PDFs: ${totalCharts}`;
    document.getElementById('stats-cycles').textContent = `Cycles: ${totalCycles}`;
}