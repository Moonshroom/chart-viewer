document.addEventListener("DOMContentLoaded", () => {
    const today = new Date(); 
    today.setHours(0, 0, 0, 0);

    let allCyclesData = [];
    let holidays = [];
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

    function getDeadlineClass(dateObj, cycleIndex, rowIndex) {
        const cycle = allCyclesData[cycleIndex];
        const row = cycle?.rows[rowIndex];
        if (!dateObj || !row) return '';

        let nextRcsDate = rowIndex + 1 < cycle.rows.length
            ? cycle.rows[rowIndex + 1]["RCS CutoffObj"]
            : allCyclesData[cycleIndex + 1]?.rows[0]["RCS CutoffObj"];

        if (!nextRcsDate && row["RCS CutoffObj"]) {
            nextRcsDate = new Date(row["RCS CutoffObj"]);
            nextRcsDate.setDate(nextRcsDate.getDate() + 7);
        }

        const isCurrentWeek = row["RCS CutoffObj"] && nextRcsDate &&
            today >= row["RCS CutoffObj"] && today < nextRcsDate;
        if (!isCurrentWeek) return '';

        const diffDays = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 1) return 'deadline-critical';
        if (diffDays >= 2 && diffDays <= 5) return 'deadline-warning';
        return '';
    }

    function parseDateString(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split("-");
        if (parts.length !== 3) return null;
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    function getHolidayInfo(dateObj) {
        if (!dateObj) return null;
        const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        return holidays.find(holiday => holiday.date === dateKey) || null;
    }

    function getHolidayClass(dateObj) {
        return getHolidayInfo(dateObj) ? ' holiday-date' : '';
    }

    function getHolidayTitle(dateObj) {
        const holiday = getHolidayInfo(dateObj);
        return holiday ? ` title="${holiday.name}"` : '';
    }

    async function loadDataAndInit() {
        try {
            const [response, holidaysResponse] = await Promise.all([
                fetch('AIRAC_Calendar.json'),
                fetch('Polish_Holidays.json')
            ]);
            const rawData = await response.json();
            holidays = await holidaysResponse.json();

            allCyclesData = rawData.map((item, index) => {
                let cycleNumStr = item.cycle;
                let rows = item.weeks.map(w => {
                    let dueFriDate = parseDateString(w["DUE (FRI)"]);
                    let dueTueDate = dueFriDate ? new Date(dueFriDate) : null;
                    if (dueTueDate) dueTueDate.setDate(dueTueDate.getDate() + 4);

                    let whDate = parseDateString(w["WH REV"]);
                    let ehDate = parseDateString(w["EH REV/MAIL"]);
                    let rcsDate = parseDateString(w["RCS"]);

                    return {
                        "Wk": w["wk"],
                        "WH Revision": whDate ? formatDate(whDate) : "",
                        "WH RevisionObj": whDate,
                        "Due Date (Tue)": dueTueDate ? formatDate(dueTueDate) : "--",
                        "Due Date (Tue)Obj": dueTueDate,
                        "EH Revision / Mail": ehDate ? formatDate(ehDate) : "",
                        "EH Revision / MailObj": ehDate,
                        "Due Date (Fri)": dueFriDate ? formatDate(dueFriDate) : "--",
                        "Due Date (Fri)Obj": dueFriDate,
                        "RCS Cutoff": rcsDate ? formatDate(rcsDate) : "",
                        "RCS CutoffObj": rcsDate,
                        "Effective Date": w["effectiveDate"] ? formatDate(parseDateString(w["effectiveDate"]), 'full' ) : "",
                        "Effective DateObj": w["effectiveDate"] ? parseDateString(w["effectiveDate"]) : null
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

            let foundIndex = allCyclesData.findIndex((cycle, index) => {
                let nextCycle = allCyclesData[index + 1];
                return today >= cycle.startDate &&
                    (!nextCycle || today < nextCycle.startDate);
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

    function getCycleCopyText(cycle) {
        const headers = ['Wk', 'WH REV', 'DUE (Tuesday)', 'EH REV / Mail', 'DUE (Friday)', 'RCS', 'EFF'];
        const rows = cycle.rows.map(row => [
            row["Wk"],
            row["WH Revision"],
            row["Due Date (Tue)"],
            row["EH Revision / Mail"],
            row["Due Date (Fri)"],
            row["RCS Cutoff"],
            row["Effective Date"]
        ]);

        const columnWidths = headers.map((header, columnIndex) => Math.max(
            3,
            header.length,
            ...rows.map(row => String(row[columnIndex] ?? '').length)
        ));
        const centerCell = (value, width) => {
            const text = String(value ?? '');
            const totalPadding = width - text.length;
            const leftPadding = Math.floor(totalPadding / 2);
            return `${' '.repeat(leftPadding)}${text}${' '.repeat(totalPadding - leftPadding)}`;
        };
        const formatRow = row => row
            .map((cell, columnIndex) => centerCell(cell, columnWidths[columnIndex]))
            .join(' | ');
        const formatSeparator = width => `:${'-'.repeat(width - 2)}:`;

        return [
            `${cycle.cycleTitle} | ${cycle.dateRange}`,
            '',
            `| ${formatRow(headers)} |`,
            `| ${columnWidths.map(formatSeparator).join(' | ')} |`,
            ...rows.map(row => `| ${formatRow(row)} |`)
        ].join('\n');
    }

    async function copyCycleToClipboard(cycleIndex, button) {
        const cycle = allCyclesData[cycleIndex];
        if (!cycle) return;

        const card = button.closest('.airac-slider-card');
        const table = card?.querySelector('table');
        const text = getCycleCopyText(cycle);
        const htmlTable = table?.cloneNode(true);
        htmlTable?.querySelectorAll('th, td').forEach(cell => {
            cell.style.textAlign = 'center';
        });
        const html = htmlTable?.outerHTML || '';

        try {
            if (navigator.clipboard?.write && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': new Blob([html], { type: 'text/html' }),
                        'text/plain': new Blob([text], { type: 'text/plain' })
                    })
                ]);
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }

            button.classList.add('is-copied');
            button.title = 'Table copied';
            setTimeout(() => {
                button.classList.remove('is-copied');
                button.title = 'Copy cycle data';
            }, 1500);
        } catch (error) {
            console.error('Nie udało się skopiować danych cyklu:', error);
        }
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
                        <div class="airac-card-actions">
                            <button class="airac-copy-btn" type="button" data-cycle-index="${cycle.index}" title="Copy cycle data" aria-label="Copy cycle data">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/></svg>
                            </button>
                            <span class="airac-badge ${badgeClass}">${badgeText}</span>
                        </div>
                    </div>
                    <table class="airac-table">
                        <thead>
                            <tr>
                                <th>Wk</th>
                                <th>WH REV</th>
                                <th>DUE (Tuesday)</th>
                                <th>EH REV / Mail</th>
                                <th>DUE (Friday)</th>
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
                        <td class="${row["WH RevisionObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["WH RevisionObj"])}"${getHolidayTitle(row["WH RevisionObj"])}>${row["WH Revision"]}</td>
                        <td class="${getDeadlineClass(row["Due Date (Tue)Obj"], cycle.index, rowIdx)} ${row["Due Date (Tue)Obj"] < today ? 'date-passed' : ''}${getHolidayClass(row["Due Date (Tue)Obj"])}"${getHolidayTitle(row["Due Date (Tue)Obj"])}>${row["Due Date (Tue)"]}</td>
                        <td class="${row["EH Revision / MailObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["EH Revision / MailObj"])}"${getHolidayTitle(row["EH Revision / MailObj"])}>${row["EH Revision / Mail"]}</td>
                        <td class="${getDeadlineClass(row["Due Date (Fri)Obj"], cycle.index, rowIdx)} ${row["Due Date (Fri)Obj"] < today ? 'date-passed' : ''}${getHolidayClass(row["Due Date (Fri)Obj"])}"${getHolidayTitle(row["Due Date (Fri)Obj"])}>${row["Due Date (Fri)"]}</td>
                        <td class="${getDeadlineClass(row["RCS CutoffObj"], cycle.index, rowIdx)} ${row["RCS CutoffObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["RCS CutoffObj"])}"${getHolidayTitle(row["RCS CutoffObj"])}>${row["RCS Cutoff"]}</td>
                        <td class="airac-table-eff-cell ${row["Effective DateObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["Effective DateObj"])}"${getHolidayTitle(row["Effective DateObj"])}>${row["Effective Date"]}</td>
                    </tr>`;
            });

            html += `</tbody></table></div>`;
        }

        if (sliderTrack) {
            sliderTrack.innerHTML = html;
        }
        updateSliderPosition();
    }

    sliderTrack.addEventListener('click', event => {
        const copyButton = event.target.closest('.airac-copy-btn');
        if (!copyButton) return;

        copyCycleToClipboard(Number(copyButton.dataset.cycleIndex), copyButton);
    });

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
            dashboardStatsEl.innerText = 'Production Flow';
        }
        const dashboardCycleInfoEl = document.getElementById('dashboard-cycle-info');
        if (dashboardCycleInfoEl) {
            const displayedWeek = currentCycleData.rows[0]?.["Wk"] ?? 1;
            dashboardCycleInfoEl.innerText = `${currentCycleData.cycleTitle} - Week ${displayedWeek}`;
        }

        currentCycleData.rows.forEach((row, index) => {
            if (index >= 4) return;
            const weekNum = row["Wk"];
            const weekLabelEl = document.getElementById(`week-label-${index + 1}`);
            const weekBoxEl = weekLabelEl ? weekLabelEl.closest('.stat-week-box') : null;
            const isActiveWeek = row === activeGlobalWeek;

            if (weekBoxEl) {
                weekBoxEl.classList.toggle('stat-week-box-active', isActiveWeek);
            }

            if (weekLabelEl) {
                weekLabelEl.innerText = `Week ${weekNum}`;
                weekLabelEl.classList.toggle('stat-week-title-active', isActiveWeek);
            }

            const evaluateStatus = (targetDate) => {
                if (!targetDate) return { text: "--", className: "" };
                const diffTime = targetDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 0) {
                    return { text: "Passed", className: "status-passed" };
                } else if (diffDays <= 1) {
                    return { text: diffDays === 0 ? "Today" : `${diffDays}d left`, className: "status-critical" };
                } else if (diffDays <= 5) {
                    return { text: `${diffDays}d left`, className: "status-warning" };
                } else {
                    return { text: `${diffDays}d left`, className: "status-safe" };
                }
            };

            const tueEval = evaluateStatus(row["Due Date (Tue)Obj"]);
            const friEval = evaluateStatus(row["Due Date (Fri)Obj"]);
            const rcsEval = evaluateStatus(row["RCS CutoffObj"]);

            const applyStatusToElement = (elemId, evalObj) => {
                const el = document.getElementById(elemId);
                if (!el) return;
                el.innerText = evalObj.text;
                el.className = evalObj.className;
            };

            const applyDateToElement = (elemId, dateObj) => {
                const el = document.getElementById(elemId);
                if (!el) return;
                el.innerText = dateObj ? formatDate(dateObj, 'full') : '--';
                el.className = dateObj && dateObj < today ? 'date-passed' : '';
            };

            applyStatusToElement(`days-tue-${index + 1}`, tueEval);
            applyStatusToElement(`days-fri-${index + 1}`, friEval);
            applyStatusToElement(`days-rcs-${index + 1}`, rcsEval);
            applyDateToElement(`date-tue-${index + 1}`, row["Due Date (Tue)Obj"]);
            applyDateToElement(`date-fri-${index + 1}`, row["Due Date (Fri)Obj"]);
            applyDateToElement(`date-rcs-${index + 1}`, row["RCS CutoffObj"]);
        });

        const timelineContainer = document.getElementById('extended-production-timeline');
        if (timelineContainer) {
            let cycleStart = currentCycleData.rows[0]["RCS CutoffObj"];
            let cycleEnd = currentCycleData.rows[currentCycleData.rows.length - 1]["Due Date (Tue)Obj"];
            
            let totalDuration = cycleEnd - cycleStart;

            const getPercent = (dateObj) => {
                if (!dateObj || totalDuration <= 0) return 0;
                return Math.min(Math.max(((dateObj - cycleStart) / totalDuration) * 100, 0), 100);
            };

            const marker = (type, dateObj, label, dateText, title = '', weekColor = 'a', rangeEnd = null) => {
                if (!dateObj) return '';
                const passedClass = dateObj < today ? ' timeline-marker-passed' : '';
                const titleAttribute = title ? ` title="${title}"` : '';
                const rangeWidth = rangeEnd ? Math.max(getPercent(rangeEnd) - getPercent(dateObj), 0) : 0;
                const rangeStyle = rangeEnd ? ` width: ${rangeWidth}%; transform: translateY(-50%);` : '';
                const rangeClass = rangeEnd ? ' timeline-marker-range' : '';
                return `<div class="timeline-marker timeline-marker-${type}${rangeClass}${passedClass}"${titleAttribute} style="--week-color: var(--timeline-week-${weekColor}); left: ${getPercent(dateObj)}%;${rangeStyle}"><span>${label}</span><small>${dateText}</small></div>`;
            };

            let markers = '';
            currentCycleData.rows.forEach((row, rowIndex) => {
                const weekStart = getPercent(row["RCS CutoffObj"]);
                const weekEnd = getPercent(row["Due Date (Tue)Obj"]);
                const weekTone = rowIndex % 2 === 0 ? 'timeline-week-tone-a' : 'timeline-week-tone-b';
                const weekColor = rowIndex % 2 === 0 ? 'a' : 'b';
                markers += `<div class="timeline-week ${weekTone}" style="--week-color: var(--timeline-week-${weekColor}); left: ${weekStart}%; width: ${Math.max(weekEnd - weekStart, 0)}%;"><span>Week ${row["Wk"]}</span></div>`;
                markers += marker('rcs', row["RCS CutoffObj"], 'RCS', row["RCS Cutoff"], '', weekColor);
                markers += marker('fri', row["Due Date (Fri)Obj"], 'Due Date Friday', row["Due Date (Fri)"], '', weekColor);
                markers += marker('tue', row["Due Date (Tue)Obj"], 'Due Date Tuesday', row["Due Date (Tue)"], '', weekColor);
            });

            const cycleHolidays = holidays
                .map(holiday => ({ ...holiday, dateObj: parseDateString(holiday.date) }))
                .filter(holiday => holiday.dateObj && holiday.dateObj >= cycleStart && holiday.dateObj <= cycleEnd)
                .sort((first, second) => first.dateObj - second.dateObj);
            const holidayGroups = [];
            const oneDay = 1000 * 60 * 60 * 24;

            cycleHolidays.forEach(holiday => {
                const previousGroup = holidayGroups[holidayGroups.length - 1];
                const previousHoliday = previousGroup?.[previousGroup.length - 1];
                if (previousHoliday && holiday.dateObj - previousHoliday.dateObj <= oneDay) {
                    previousGroup.push(holiday);
                } else {
                    holidayGroups.push([holiday]);
                }
            });

            holidayGroups.forEach(holidayGroup => {
                const holiday = holidayGroup[0];
                const holidayNames = holidayGroup.map(item => item.name).join(', ');
                const lastHoliday = holidayGroup[holidayGroup.length - 1];
                const rangeEnd = holidayGroup.length > 1 ? new Date(lastHoliday.dateObj) : null;
                if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1);
                markers += marker('holiday', holiday.dateObj, 'HOLIDAY', '', holidayNames, 'a', rangeEnd);
            });

            let todayPct = getPercent(today);
            let dayMarkers = '';
            let dayCount = Math.max(1, Math.round(totalDuration / (1000 * 60 * 60 * 24)));
            if (cycleStart && cycleEnd && totalDuration > 0) {
                const day = new Date(cycleStart);
                day.setHours(0, 0, 0, 0);
                const lastDay = new Date(cycleEnd);
                lastDay.setHours(0, 0, 0, 0);

                while (day <= lastDay) {
                    dayMarkers += `<span class="timeline-day-marker" style="left: ${getPercent(day)}%;" aria-hidden="true"></span>`;
                    day.setDate(day.getDate() + 1);
                }
            }

            timelineContainer.innerHTML = `
                <div class="timeline-header">
                    <h3 class="timeline-title">Production Timeline</h3>
                    <div class="timeline-today-above">TODAY: ${formatDate(today, 'full').toUpperCase()}</div>
                </div>
                <div class="timeline-bar-container">
                    <div class="timeline-progress-fill" style="width: ${todayPct}%;"></div>
                    <div class="timeline-day-grid" style="--timeline-day-count: ${dayCount};" aria-hidden="true">${dayMarkers}</div>
                    ${markers}
                    <div class="timeline-today-marker" style="left: ${todayPct}%;">
                        <div class="timeline-today-badge">TODAY</div>
                    </div>
                </div>
                <div class="timeline-footer">
                    <span>START: ${formatDate(cycleStart, 'full')}</span>
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
            
            if (getComputedStyle(tableContainer).display === 'none') {
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
                <th>DUE (Tuesday)</th>
                <th>EH REV / Mail</th>
                <th>DUE (Friday)</th>
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
                    <td class="${row["WH RevisionObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["WH RevisionObj"])}"${getHolidayTitle(row["WH RevisionObj"])}>${row["WH Revision"]}</td>
                    <td class="${getDeadlineClass(row["Due Date (Tue)Obj"], cycleIdx, rowIdx)} ${row["Due Date (Tue)Obj"] < today ? 'date-passed' : ''}${getHolidayClass(row["Due Date (Tue)Obj"])}"${getHolidayTitle(row["Due Date (Tue)Obj"])}>${row["Due Date (Tue)"]}</td>
                    <td class="${row["EH Revision / MailObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["EH Revision / MailObj"])}"${getHolidayTitle(row["EH Revision / MailObj"])}>${row["EH Revision / Mail"]}</td>
                    <td class="${getDeadlineClass(row["Due Date (Fri)Obj"], cycleIdx, rowIdx)} ${row["Due Date (Fri)Obj"] < today ? 'date-passed' : ''}${getHolidayClass(row["Due Date (Fri)Obj"])}"${getHolidayTitle(row["Due Date (Fri)Obj"])}>${row["Due Date (Fri)"]}</td>
                    <td class="${getDeadlineClass(row["RCS CutoffObj"], cycleIdx, rowIdx)} ${row["RCS CutoffObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["RCS CutoffObj"])}"${getHolidayTitle(row["RCS CutoffObj"])}>${row["RCS Cutoff"]}</td>
                    <td class="effective-date ${row["Effective DateObj"] < today ? 'date-passed' : ''}${getHolidayClass(row["Effective DateObj"])}"${getHolidayTitle(row["Effective DateObj"])}>${row["Effective Date"]}</td>
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