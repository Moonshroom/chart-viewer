let dbInstance = null;
let chartDatabase = {}; 

const DB_NAME = 'JeppesenViewerDB';
const DB_VERSION = 3; 
const STORE_NAME = 'charts';

const btnLoadFolder = document.getElementById('btn-load-folder');
const searchCountryInput = document.getElementById('search-country');
const cellFilterSelect = document.getElementById('cell-filter'); 
const typeFilterSelect = document.getElementById('type-filter');
const cycleFilterSelect = document.getElementById('cycle-filter');
const chartsListContainer = document.getElementById('charts-list-container');
const pdfContainer = document.getElementById('pdf-container');
const noPdfMessageBlock = document.getElementById('no-pdf-message');
const statsDisplayDiv = document.getElementById('stats-display');

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

window.addEventListener('DOMContentLoaded', async () => {
    await initIndexedDB();
    await loadChartsFromCache();
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

async function performScan(handle) {
    statsDisplayDiv.textContent = "Processing files...";
    const store = dbInstance.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    store.clear();
    chartDatabase = {};
    
    await scanDirectoryRecursively(handle, '', '');
    
    const cycles = Object.keys(chartDatabase).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
    unlockInterface();
    buildCycleFilter(cycles);
    buildCellFilter();
    updateChartList();
    statsDisplayDiv.textContent = "Data ready.";
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

    filtered?.forEach(chart => {
        const btn = document.createElement('button');
        btn.className = 'airport-item';
        btn.innerHTML = `<div style="color:#e1e1e6; font-weight:bold; font-size:1.05rem;">🌍 ${chart.country}</div>
                         <div style="font-size:0.85rem; color:#a8a8b3; margin-top:6px;">
                            <span style="color:#007acc; font-weight:600;">${chart.type}</span> • 📁 <span style="color:#fff; font-weight:500;">${chart.folderName}</span>
                         </div>`;
        
btn.onclick = () => {
    const viewer = document.getElementById('pdf-viewer');
    const noPdfMsg = document.getElementById('no-pdf-message');
    
    if (noPdfMsg) noPdfMsg.style.display = 'none';
    
    const url = URL.createObjectURL(chart.fileBlob);
    
    // Wskazujemy na lokalny viewer.html z folderu /pdfjs/web/
    // To uruchomi pełny interfejs Mozilli z paskiem narzędzi i wyszukiwaniem
    viewer.src = `./pdfjs/web/viewer.html?file=${encodeURIComponent(url)}`;
    viewer.style.display = 'block';
};
        chartsListContainer.appendChild(btn);
    });
}

btnLoadFolder.addEventListener('click', async () => {
    const dirHandle = await window.showDirectoryPicker();
    await performScan(dirHandle);
});

[searchCountryInput, cellFilterSelect, typeFilterSelect, cycleFilterSelect].forEach(el => el.addEventListener('change', updateChartList));
cycleFilterSelect.addEventListener('change', () => { buildCellFilter(); updateChartList(); });

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
            const cycles = Object.keys(chartDatabase).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
            unlockInterface();
            buildCycleFilter(cycles);
            buildCellFilter();
            updateChartList();
        }
    };
}