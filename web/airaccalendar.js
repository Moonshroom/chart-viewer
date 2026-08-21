document.addEventListener("DOMContentLoaded", () => {
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);

    let allCyclesData = [];
    let currentCycleOffset = 0;
    let activeOffset = 0;
    let minOffset = -6;
    let maxOffset = 6;

    const sliderTrack = document.getElementById('airac-slider-track');

    function formatDate(date, format = 'short') {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const d = date.getDate();
        const m = months[date.getMonth()];
        const y = String(date.getFullYear()).slice(-2);

        if (format === 'full') {
            return `${String(d).padStart(2, '0')}-${m}-${y}`;
        }
        return `${d}/${m}`;
    }

    function parseDateString(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    async function loadDataAndInit() {
        try {
            const response = await fetch('AIRAC_Calendar.json');
            const rawData = await response.json();

            allCyclesData = rawData.map((item, index) => {
                let cycleNumStr = item.cycle;
                let rows = item.weeks.map(w => {
                    let dueFriDate = parseDateString(w["DUE (FRI)"]);
                    let dueMonDate = dueFriDate ? new Date(dueFriDate) : null;
                    if (dueMonDate) dueMonDate.setDate(dueMonDate.getDate() + 3);

                    let whDate = parseDateString(w["WH REV"]);
                    let ehDate = parseDateString(w["EH REV/MAIL"]);
                    let rcsDate = parseDateString(w["RCS"]);

                    return {
                        "Wk": w["wk"],
                        "WH Revision": whDate ? formatDate(whDate) : "",
                        "Due Date (Mon)": dueMonDate ? formatDate(dueMonDate) : "--",
                        "Due Date (Mon)Obj": dueMonDate,
                        "EH Revision / Mail": ehDate ? formatDate(ehDate) : "",
                        "Due Date (Fri)": dueFriDate ? formatDate(dueFriDate) : "--",
                        "Due Date (Fri)Obj": dueFriDate,
                        "RCS Cutoff": rcsDate ? formatDate(rcsDate) : "",
                        "RCS CutoffObj": rcsDate,
                        "Effective Date": w["effectiveDate"] ? formatDate(parseDateString(w["effectiveDate"]), 'full' ) : ""
                    };
                });

                let startDate = rows[0]["RCS CutoffObj"] || new Date();
                let endDate = rows[rows.length - 1]["Due Date (Fri)Obj"] || new Date();

                return {
                    index: index,
                    cycleTitle: `AIRAC ${cycleNumStr}`,
                    cycleNumber: cycleNumStr,
                    dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
                    startDate: startDate,
                    endDate: endDate,
                    rows: rows
                };
            });

            let foundIndex = allCyclesData.findIndex(c => {
                let lastRow = c.rows[c.rows.length - 1];
                let cycleEndLimit = lastRow["Due Date (Fri)Obj"] ? new Date(lastRow["Due Date (Fri)Obj"]) : c.endDate;
                cycleEndLimit.setDate(cycleEndLimit.getDate() + 3);
                return today >= c.startDate && today <= cycleEndLimit;
            });

            if (foundIndex !== -1) {
                currentCycleOffset = foundIndex;
            } else {
                currentCycleOffset = Math.floor(allCyclesData.length / 2);
            }

            minOffset = -currentCycleOffset;
            maxOffset = (allCyclesData.length - 1) - currentCycleOffset;

            renderSlider();
            renderTableView();
            initControls(); 
        } catch (error) {
            console.error("Błąd podczas ładowania pliku AIRAC_Calendar.json:", error);
            if (sliderTrack) {
                sliderTrack.innerHTML = `<div style="color: #ef4444; padding: 20px; text-align: center;">Nie udało się wczytać pliku.</div>`;
            }
        }
    }

    function generateCycleData(offsetFromBase) {
        const targetIndex = currentCycleOffset + offsetFromBase;
        if (targetIndex < 0 || targetIndex >= allCyclesData.length) {
            return null;
        }

        const cycleObj = allCyclesData[targetIndex];
        let status = 'future';
        if (targetIndex < currentCycleOffset) status = 'past';
        if (targetIndex === currentCycleOffset) status = 'current';

        return {
            index: targetIndex, // Zwracamy też realny indeks
            offset: offsetFromBase,
            cycleTitle: cycleObj.cycleTitle,
            dateRange: cycleObj.dateRange,
            status: status,
            rows: cycleObj.rows
        };
    }

    function renderSlider() {
        let html = '';

        for (let i = minOffset; i <= maxOffset; i++) {
            let cycle = generateCycleData(i);
            if (!cycle) continue;
            
            let cardClass = 'airac-slider-card';
            let badgeClass = 'badge-future';
            let badgeText = 'Upcoming';

            if (cycle.status === 'past') {
                cardClass += ' cycle-past';
                badgeClass = 'badge-past';
                badgeText = 'Completed';
            } else if (cycle.status === 'current') {
                cardClass += ' cycle-current';
                badgeClass = 'badge-current';
                badgeText = 'Current Cycle';
            }

            html += `
                <div class="${cardClass}" data-offset="${i}">
                    <div class="airac-card-header">
                        <div>
                            <h3 class="airac-card-title">${cycle.cycleTitle}</h3>
                            <span class="airac-card-dates">${cycle.dateRange}</span>
                        </div>
                        <span class="airac-badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <table class="airac-table">
                        <thead>
                            <tr>
                                <th>Wk</th>
                                <th>WH REV</th>
                                <th>DUE (Mon)</th>
                                <th>EH REV / Mail</th>
                                <th>DUE (Fri)</th>
                                <th>RCS</th>
                                <th>EFF</th>
                            </tr>
                        </thead>
                        <tbody>`;

            cycle.rows.forEach((row, rowIdx) => {
                let rcsDate = row["RCS CutoffObj"];
                let nextRcsDate = null;

                if (rowIdx + 1 < cycle.rows.length) {
                    nextRcsDate = cycle.rows[rowIdx + 1]["RCS CutoffObj"];
                } else {
                    nextRcsDate = new Date(rcsDate);
                    nextRcsDate.setDate(nextRcsDate.getDate() + 7);
                }

                let isCurrentWeekRow = rcsDate && nextRcsDate && (today >= rcsDate && today < nextRcsDate);
                let rowClass = isCurrentWeekRow ? 'airac-table-row-active' : 'airac-table-row';

                html += `
                    <tr class="${rowClass}">
                        <td class="airac-table-wk-cell">${row["Wk"]}</td>
                        <td>${row["WH Revision"]}</td>
                        <td>${row["Due Date (Mon)"]}</td>
                        <td>${row["EH Revision / Mail"]}</td>
                        <td>${row["Due Date (Fri)"]}</td>
                        <td>${row["RCS Cutoff"]}</td>
                        <td class="airac-table-eff-cell">${row["Effective Date"]}</td>
                    </tr>`;
            });

            html += `</tbody></table></div>`;
        }

        if (sliderTrack) {
            sliderTrack.innerHTML = html;
        }
        updateSliderPosition();
    }

    function updateDashboard() {
        const currentCycleData = generateCycleData(activeOffset);
        if (!currentCycleData) return;

        let activeGlobalWeek = null;
        let activeCycleTitle = currentCycleData.cycleTitle;

        for (let cIdx = 0; cIdx < allCyclesData.length; cIdx++) {
            let cycle = allCyclesData[cIdx];
            for (let wIdx = 0; wIdx < cycle.rows.length; wIdx++) {
                let row = cycle.rows[wIdx];
                let rcsDate = row["RCS CutoffObj"];
                
                let nextRcsDate = null;
                if (wIdx + 1 < cycle.rows.length) {
                    nextRcsDate = cycle.rows[wIdx + 1]["RCS CutoffObj"];
                } else if (cIdx + 1 < allCyclesData.length) {
                    nextRcsDate = allCyclesData[cIdx + 1].rows[0]["RCS CutoffObj"];
                } else {
                    nextRcsDate = new Date(rcsDate);
                    nextRcsDate.setDate(nextRcsDate.getDate() + 7);
                }

                if (rcsDate && nextRcsDate) {
                    if (today >= rcsDate && today < nextRcsDate) {
                        activeGlobalWeek = row;
                        activeCycleTitle = cycle.cycleTitle;
                        break;
                    }
                }
            }
            if (activeGlobalWeek) break;
        }

        if (!activeGlobalWeek && currentCycleData.rows.length > 0) {
            activeGlobalWeek = currentCycleData.rows[0];
        }

        const dashboardStatsEl = document.querySelector('.dashboard-stats .dashboard-title');
        if (dashboardStatsEl) {
            const formattedToday = formatDate(today, 'full');
            dashboardStatsEl.style.display = 'flex';
            dashboardStatsEl.style.justifyContent = 'space-between';
            dashboardStatsEl.style.alignItems = 'center';
            
            dashboardStatsEl.innerHTML = `
                <span>Production Flow &mdash; Active: <span style="color: #4ade80;">${activeCycleTitle} (Wk ${activeGlobalWeek ? activeGlobalWeek["Wk"] : 1})</span></span>
                <span style="color: #888; font-weight: normal; font-size: 0.8em; letter-spacing: 0.5px;">TODAY: ${formattedToday.toUpperCase()}</span>
            `;
        }

        currentCycleData.rows.forEach((row, index) => {
            if (index >= 4) return;
            const weekNum = row["Wk"];
            const weekLabelEl = document.getElementById(`week-label-${index + 1}`);
            if (weekLabelEl) weekLabelEl.innerText = `Week ${weekNum}`;

            const evaluateStatus = (targetDate) => {
                if (!targetDate) return { text: "--", className: "" };
                const diffTime = targetDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                    return { text: "Passed", className: "status-passed" };
                } else if (diffDays === 0) {
                    return { text: "Today", className: "status-warning" };
                } else if (diffDays < 3) {
                    return { text: `${diffDays}d`, className: "status-warning" };
                } else {
                    return { text: `${diffDays}d`, className: "status-safe" };
                }
            };

            const monEval = evaluateStatus(row["Due Date (Mon)Obj"]);
            const friEval = evaluateStatus(row["Due Date (Fri)Obj"]);
            const rcsEval = evaluateStatus(row["RCS CutoffObj"]);

            const applyStatusToElement = (elemId, evalObj) => {
                const el = document.getElementById(elemId);
                if (!el) return;
                el.innerText = evalObj.text;
                el.className = evalObj.className;
            };

            applyStatusToElement(`days-mon-${index + 1}`, monEval);
            applyStatusToElement(`days-fri-${index + 1}`, friEval);
            applyStatusToElement(`days-rcs-${index + 1}`, rcsEval);
        });

        const timelineContainer = document.getElementById('extended-production-timeline');
        if (timelineContainer) {
            let cycleStart = currentCycleData.rows[0]["RCS CutoffObj"];
            let cycleEnd = currentCycleData.rows[currentCycleData.rows.length - 1]["Due Date (Fri)Obj"];
            
            let totalDuration = cycleEnd - cycleStart;

            const getPercent = (dateObj) => {
                if (!dateObj || totalDuration <= 0) return 0;
                return Math.min(Math.max(((dateObj - cycleStart) / totalDuration) * 100, 0), 100);
            };

            let markers = '';
            currentCycleData.rows.forEach(row => {
                let friPct = getPercent(row["Due Date (Fri)Obj"]);
                let rcsPct = getPercent(row["RCS CutoffObj"]);
                
                markers += `<div class="timeline-marker-fri" style="left: ${friPct}%;"></div>`;
                markers += `<div class="timeline-label-fri" style="left: ${friPct}%;">${row["Due Date (Fri)"]}</div>`;

                markers += `<div class="timeline-marker-rcs" style="left: ${rcsPct}%;"></div>`;
                markers += `<div class="timeline-label-rcs" style="left: ${rcsPct}%;">${row["RCS Cutoff"]}</div>`;
            });

            let todayPct = getPercent(today);

            timelineContainer.innerHTML = `
                <div class="timeline-header">
                    <h3 class="timeline-title" style="font-family: inherit; font-size: 0.85rem; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; color: #aaa;">
    PRODUCTION TIMELINE: <span style="color: #fff;">${currentCycleData.cycleTitle}</span>
</h3>
                    <div class="timeline-legend">
                        <span style="color: #fff; font-weight: bold;">|</span> Fri Dates &nbsp; | &nbsp; <span style="color: #38bdf8; font-weight: bold;">|</span> RCS Cutoffs &nbsp; | &nbsp; <span style="color: #10b981; font-weight: bold;">&#9650;</span> Today Marker
                    </div>
                </div>
                <div class="timeline-bar-container">
                    <div class="timeline-progress-fill" style="width: ${todayPct}%;"></div>
                    ${markers}
                    <div class="timeline-today-marker" style="left: ${todayPct}%;">
                        <div class="timeline-today-badge">TODAY</div>
                    </div>
                </div>
                <div class="timeline-footer">
                    <span>START: ${formatDate(cycleStart, 'full')}</span>
                    <span style="color: #4ade80;">TODAY: ${formatDate(today, 'full')}</span>
                    <span>END: ${formatDate(cycleEnd, 'full')}</span>
                </div>
            `;
        }
    }

    function updateSliderPosition() {
        const cardWidth = 605;
        const viewport = sliderTrack.parentElement;
        if (!viewport) return;
        
        const viewportWidth = viewport.clientWidth;
        if (viewportWidth === 0) return;

        const centerOffset = (viewportWidth / 2) - (580 / 2);
        const currentCardIndex = activeOffset - minOffset;
        const translateValue = centerOffset - (currentCardIndex * cardWidth);

        sliderTrack.style.transform = `translateX(${translateValue}px)`;
        updateDashboard();
    }

    function initControls() {
        const select = document.getElementById('cycle-jump-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Jump to Cycle --</option>';
        allCyclesData.forEach((cycle, index) => {
            let opt = document.createElement('option');
            opt.value = index;
            opt.textContent = cycle.cycleTitle;
            select.appendChild(opt);
        });

        select.onchange = function() {
            const targetIndex = parseInt(this.value);
            if (!isNaN(targetIndex)) {
                activeOffset = targetIndex - currentCycleOffset;
                updateSliderPosition();
                scrollToCycleInTable(targetIndex);
            }
        };
    }

// Przewijanie tabeli do wybranego cyklu tak, aby był na samej górze
    function scrollToCycleInTable(targetIndex) {
        const targetRow = document.getElementById(`table-cycle-${targetIndex}`);
        const container = document.getElementById('table-view-container');
        
        if (targetRow && container) {
            // Metoda 1: Nowoczesna, natywna i bardzo stabilna przeglądarkowo
            targetRow.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Alternatywnie (gdyby scrollIntoView nie działał z kontenerem):
            // container.scrollTop = targetRow.offsetTop - container.offsetTop;
        }
    }

 // 2. Obsługa przełącznika widoku wraz z ukrywaniem strzałek bocznych
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    if (viewToggleBtn) {
        viewToggleBtn.addEventListener('click', function() {
            const sliderContainer = sliderTrack.parentElement;
            const tableContainer = document.getElementById('table-view-container');
            const prevArrow = document.getElementById('slider-prev');
            const nextArrow = document.getElementById('slider-next');
            
            if (tableContainer.style.display === 'none') {
                sliderContainer.style.display = 'none';
                tableContainer.style.display = 'block';
                this.textContent = "Switch to Slider View";
                
                // Ukryj strzałki boczne w widoku tabeli
                if (prevArrow) prevArrow.style.display = 'none';
                if (nextArrow) nextArrow.style.display = 'none';

                setTimeout(() => scrollToCycleInTable(currentCycleOffset), 50);
            } else {
                sliderContainer.style.display = 'block';
                tableContainer.style.display = 'none';
                this.textContent = "Switch to Table View";
                
                // Przywróć strzałki boczne w widoku slidera
                if (prevArrow) prevArrow.style.display = 'flex';
                if (nextArrow) nextArrow.style.display = 'flex';

                updateSliderPosition();
            }
        });
    }

function renderTableView() {
    const tbody = document.getElementById('table-view-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    allCyclesData.forEach((cycle, cycleIdx) => {
        let status = 'future';
        if (cycleIdx < currentCycleOffset) status = 'past';
        if (cycleIdx === currentCycleOffset) status = 'current';

        let badgeClass = 'badge-completed';
        let badgeText = 'Completed';

        if (status === 'current') {
            badgeClass = 'badge-current';
            badgeText = 'Current Cycle';
        } else if (status === 'future') {
            badgeClass = 'badge-upcoming';
            badgeText = 'Upcoming';
        }

        // Odstęp między kartami
        if (cycleIdx > 0) {
            tbody.innerHTML += `<tr><td colspan="7" class="table-spacer"></td></tr>`;
        }

        let cycleWrapperClass = status === 'current' ? 'table-cycle-current' : '';

        // Nagłówek cyklu
        tbody.innerHTML += `
            <tr id="table-cycle-${cycleIdx}" class="${cycleWrapperClass}">
                <td colspan="7" class="table-cycle-header">
                    <div class="table-cycle-header-content">
                        <div>
                            <h3 class="table-cycle-title">${cycle.cycleTitle}</h3>
                            <span class="table-cycle-dates">${cycle.dateRange}</span>
                        </div>
                        <span class="badge ${badgeClass}">${badgeText}</span>
                    </div>
                </td>
            </tr>
            <tr class="table-columns-header ${cycleWrapperClass}">
                <th>Wk</th>
                <th>WH REV</th>
                <th>DUE (Mon)</th>
                <th>EH REV / Mail</th>
                <th>DUE (Fri)</th>
                <th>RCS</th>
                <th>EFF</th>
            </tr>
        `;

        cycle.rows.forEach((row, rowIdx) => {
            let rcsDate = row["RCS CutoffObj"];
            let nextRcsDate = null;

            if (rowIdx + 1 < cycle.rows.length) {
                nextRcsDate = cycle.rows[rowIdx + 1]["RCS CutoffObj"];
            } else if (cycleIdx + 1 < allCyclesData.length) {
                nextRcsDate = allCyclesData[cycleIdx + 1].rows[0]["RCS CutoffObj"];
            } else {
                nextRcsDate = new Date(rcsDate);
                nextRcsDate.setDate(nextRcsDate.getDate() + 7);
            }

            let isCurrentWeekRow = rcsDate && nextRcsDate && (today >= rcsDate && today < nextRcsDate);
            
            let rowClass = `table-row-data ${cycleWrapperClass}`;
            let wkClass = '';

            if (isCurrentWeekRow) {
                rowClass += ' row-active-week';
                wkClass = 'cell-active-week';
            }

            let isLastRow = (rowIdx === cycle.rows.length - 1);
            if (isLastRow) {
                rowClass += ' table-row-footer';
            }

            tbody.innerHTML += `
                <tr class="${rowClass}">
                    <td class="${wkClass}">${row["Wk"]}</td>
                    <td>${row["WH Revision"]}</td>
                    <td>${row["Due Date (Mon)"]}</td>
                    <td>${row["EH Revision / Mail"]}</td>
                    <td>${row["Due Date (Fri)"]}</td>
                    <td>${row["RCS Cutoff"]}</td>
                    <td class="effective-date">${row["Effective Date"]}</td>
                </tr>
            `;
        });
    });
}

    // Naprawa nasłuchiwania zakładki AIRAC Calendar (żeby po kliknięciu od razu ładowało stan i statystyki)
    document.querySelectorAll('[data-tab="AIRAC-calendar"], [onclick*="AIRAC-calendar"], a[href*="AIRAC"], .tab-link').forEach(tab => {
        tab.addEventListener('click', () => {
            setTimeout(() => {
                activeOffset = 0;
                updateSliderPosition();
            }, 50);
        });
    });

    const nextBtn = document.getElementById('slider-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (activeOffset < maxOffset) {
                activeOffset++;
                updateSliderPosition();
            }
        });
    }

    const prevBtn = document.getElementById('slider-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (activeOffset > minOffset) {
                activeOffset--;
                updateSliderPosition();
            }
        });
    }

    const resetBtn = document.getElementById('slider-reset'); // Przycisk "Back to current cycle"
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            activeOffset = 0;
            updateSliderPosition();
            // Jeśli jesteśmy w widoku tabeli, zjedź do obecnego cyklu
            scrollToCycleInTable(currentCycleOffset);
            // Zresetuj również select
            const select = document.getElementById('cycle-jump-select');
            if (select) select.value = "";
        });
    }

    loadDataAndInit();
    // --- OBSŁUGA KÓŁKA MYSZY DLA SLIDERA ---
    const sliderContainer = sliderTrack.parentElement;
    if (sliderContainer) {
        let isWheelScrolling = false; // Flaga zapobiegająca nadmiernemu przeskakiwaniu
        
        sliderContainer.addEventListener('wheel', (evt) => {
            // Zapobiegaj domyślnemu przewijaniu strony góra-dół
            evt.preventDefault();
            
            // Ignoruj jeśli wciąż trwa "chłodzenie" po poprzednim przewinięciu
            if (isWheelScrolling) return; 
            
            isWheelScrolling = true;
            // Zablokuj kolejne przewinięcia na 250ms (możesz dopasować ten czas do gustu)
            setTimeout(() => { isWheelScrolling = false; }, 250);

            if (evt.deltaY > 0) {
                // Scroll w dół (lub w prawo) -> Następna karta
                if (activeOffset < maxOffset) {
                    activeOffset++;
                    updateSliderPosition();
                }
            } else if (evt.deltaY < 0) {
                // Scroll w górę (lub w lewo) -> Poprzednia karta
                if (activeOffset > minOffset) {
                    activeOffset--;
                    updateSliderPosition();
                }
            }
        }, { passive: false });
    }
    // ----------------------------------------

    window.addEventListener('resize', updateSliderPosition);
});