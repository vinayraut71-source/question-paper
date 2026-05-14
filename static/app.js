/* ========================================================================
   AI Paper Analyzer — Application Logic
   ======================================================================== */

(() => {
    "use strict";

    // ---- DOM Elements — Analyze Tab ----
    const dropZone       = document.getElementById("analyze-drop-zone");
    const fileInput      = document.getElementById("file-input");
    const filePreview    = document.getElementById("file-preview");
    const fileName       = document.getElementById("file-name");
    const fileSize       = document.getElementById("file-size");
    const btnRemoveFile  = document.getElementById("btn-remove-file");
    const btnAnalyze     = document.getElementById("btn-analyze");
    const btnNewAnalysis = document.getElementById("btn-new-analysis");
    const btnRetry       = document.getElementById("btn-retry");
    const analyzeTextarea= document.getElementById("analyze-textarea");
    const analyzeQCount  = document.getElementById("analyze-q-count");

    const uploadSection  = document.getElementById("upload-section");
    const loadingSection = document.getElementById("loading-section");
    const resultsSection = document.getElementById("results-section");
    const errorSection   = document.getElementById("error-section");
    const errorMessage   = document.getElementById("error-message");
    const progressBar    = document.getElementById("progress-bar");

    const valTotal      = document.getElementById("val-total");
    const valBloom      = document.getElementById("val-bloom");
    const valComplexity = document.getElementById("val-complexity");
    const bloomNumber   = document.getElementById("bloom-number");
    const bloomLabel    = document.getElementById("bloom-label");
    const bloomFill     = document.getElementById("bloom-fill");
    const bloomMarker   = document.getElementById("bloom-marker");
    const questionsList = document.getElementById("questions-list");
    const questionCount = document.getElementById("question-count");
    const chartLegend   = document.getElementById("chart-legend");

    // ---- DOM Elements — Compare Tab ----
    const tabAnalyze    = document.getElementById("tab-analyze");
    const tabCompare    = document.getElementById("tab-compare");
    const tabGenerate   = document.getElementById("tab-generate");
    const compareSection = document.getElementById("compare-section");
    const compareLoading = document.getElementById("compare-loading-section");
    const compareResults = document.getElementById("compare-results-section");
    const compareProgressBar = document.getElementById("compare-progress-bar");
    const btnCompare    = document.getElementById("btn-compare");
    const btnNewCompare = document.getElementById("btn-new-compare");
    const textarea1     = document.getElementById("compare-paper1");
    const textarea2     = document.getElementById("compare-paper2");
    const p1Count       = document.getElementById("p1-count");
    const p2Count       = document.getElementById("p2-count");

    // ---- DOM Elements — Generate Tab ----
    const generateSection   = document.getElementById("generate-section");
    const generateLoading   = document.getElementById("generate-loading-section");
    const generateResults   = document.getElementById("generate-results-section");
    const generateProgressBar = document.getElementById("generate-progress-bar");
    const btnGenerate       = document.getElementById("btn-generate");
    const btnNewGenerate    = document.getElementById("btn-new-generate");
    const genQuestionsTA    = document.getElementById("gen-questions");
    const genQCount         = document.getElementById("gen-q-count");
    const genEasySlider     = document.getElementById("gen-easy");
    const genMediumSlider   = document.getElementById("gen-medium");
    const genHardSlider     = document.getElementById("gen-hard");
    const genEasyVal        = document.getElementById("gen-easy-val");
    const genMediumVal      = document.getElementById("gen-medium-val");
    const genHardVal        = document.getElementById("gen-hard-val");
    const genTotalPct       = document.getElementById("gen-total-pct");
    const genCountInput     = document.getElementById("gen-count");
    
    const genDropZone       = document.getElementById("gen-drop-zone");
    const genFileInput      = document.getElementById("gen-file");
    const genFileInfo       = document.getElementById("gen-file-info");
    const genFname          = document.getElementById("gen-fname");
    const genBtnRemoveFile  = document.getElementById("gen-remove-file");
    let genSelectedFile     = null;

    // ---- DOM Elements — Modify Tab ----
    const tabModify         = document.getElementById("tab-modify");
    const modifySection     = document.getElementById("modify-section");
    const modifyLoading     = document.getElementById("modify-loading-section");
    const modifyResults     = document.getElementById("modify-results-section");
    const modifyProgressBar = document.getElementById("modify-progress-bar");
    const btnModify         = document.getElementById("btn-modify");
    const btnNewModify      = document.getElementById("btn-new-modify");
    const modQuestionsTA    = document.getElementById("mod-questions");
    const modQCount         = document.getElementById("mod-q-count");
    const modEasySlider     = document.getElementById("mod-easy");
    const modMediumSlider   = document.getElementById("mod-medium");
    const modHardSlider     = document.getElementById("mod-hard");
    const modEasyVal        = document.getElementById("mod-easy-val");
    const modMediumVal      = document.getElementById("mod-medium-val");
    const modHardVal        = document.getElementById("mod-hard-val");
    const modTotalPct       = document.getElementById("mod-total-pct");
    const modDropZone       = document.getElementById("mod-drop-zone");
    const modFileInput      = document.getElementById("mod-file");
    const modFileInfo       = document.getElementById("mod-file-info");
    const modFname          = document.getElementById("mod-fname");
    const modBtnRemoveFile  = document.getElementById("mod-remove-file");
    let modSelectedFile     = null;

    // Compare file upload elements
    const compareDrop1  = document.getElementById("compare-drop-1");
    const compareDrop2  = document.getElementById("compare-drop-2");
    const compareFile1  = document.getElementById("compare-file-1");
    const compareFile2  = document.getElementById("compare-file-2");
    const compareInfo1  = document.getElementById("compare-file-info-1");
    const compareInfo2  = document.getElementById("compare-file-info-2");
    const compareFname1 = document.getElementById("compare-fname-1");
    const compareFname2 = document.getElementById("compare-fname-2");
    const compareRemove1 = document.getElementById("compare-remove-1");
    const compareRemove2 = document.getElementById("compare-remove-2");

    // ---- State ----
    let selectedFile = null;
    let compareSelectedFile1 = null;
    let compareSelectedFile2 = null;
    let difficultyChart = null;
    let compareChart1 = null;
    let compareChart2 = null;
    let modChartOriginal = null;
    let modChartTarget = null;
    let currentTab = "analyze";
    let lastGeneratedQuestions = [];
    let lastModifiedQuestions = [];

    const BLOOM_LABELS = {
        1: "Remember", 2: "Understand", 3: "Apply",
        4: "Analyze",  5: "Evaluate",   6: "Create",
    };

    const API_BASE = window.location.origin;
    const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png"];

    // ================================================================
    //  HELPERS
    // ================================================================
    
    async function downloadPdf(questions, filename, btn) {
        if (!questions || questions.length === 0) {
            alert("No questions available to download.");
            return;
        }
        
        try {
            const originalText = btn.innerHTML;
            btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span> <span>Generating...</span>`;
            btn.disabled = true;

            const res = await fetch(`${API_BASE}/api/export-pdf`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questions })
            });

            if (!res.ok) throw new Error("Failed to generate PDF");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            btn.innerHTML = originalText;
            btn.disabled = false;
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.querySelector("span").textContent = "Download PDF";
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function hideAll() {
        [uploadSection, loadingSection, resultsSection, errorSection,
         compareSection, compareLoading, compareResults,
         generateSection, generateLoading, generateResults,
         modifySection, modifyLoading, modifyResults].forEach(
            (s) => { if (s) s.style.display = "none"; }
        );
    }

    function showSection(section) {
        hideAll();
        section.style.display = "";
    }

    function animateValue(elem, target, duration = 800, isFloat = false) {
        const startTime = performance.now();
        function update(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;
            elem.textContent = isFloat ? current.toFixed(2) : Math.round(current);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function parseQuestions(text) {
        return text.split("\n")
            .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
            .filter((l) => l.length > 0);
    }

    function getFileExt(name) {
        return "." + name.split(".").pop().toLowerCase();
    }

    function isValidFile(file) {
        return ALLOWED_EXT.includes(getFileExt(file.name)) && file.size <= 20 * 1024 * 1024;
    }

    function formatDrift(val, metric) {
        if (typeof val !== "number") return { text: "—", className: "color-neutral" };
        if (val === 0) return { text: "0", className: "color-neutral" };
        
        const prefix = val > 0 ? "▲ +" : "▼ -";
        let colorClass = val > 0 ? "color-hard" : "color-easy";
        
        if (metric === "Easy" || metric === "Easy %") {
            colorClass = val > 0 ? "color-easy" : "color-hard";
        } else if (metric === "Medium" || metric === "Medium %" || metric === "Total Questions") {
            colorClass = "color-medium";
        }
        
        const numText = Number.isInteger(val) ? Math.abs(val).toString() : Math.abs(val).toFixed(2);
        return { text: `${prefix}${numText}`, className: colorClass };
    }

    // ================================================================
    //  TABS
    // ================================================================
    function switchTab(tab) {
        currentTab = tab;
        tabAnalyze.classList.toggle("active", tab === "analyze");
        tabCompare.classList.toggle("active", tab === "compare");
        tabGenerate.classList.toggle("active", tab === "generate");
        tabModify.classList.toggle("active", tab === "modify");
        hideAll();
        if (tab === "analyze") uploadSection.style.display = "";
        else if (tab === "compare") compareSection.style.display = "";
        else if (tab === "generate") generateSection.style.display = "";
        else if (tab === "modify") modifySection.style.display = "";
    }

    tabAnalyze.addEventListener("click", () => switchTab("analyze"));
    tabCompare.addEventListener("click", () => switchTab("compare"));
    tabGenerate.addEventListener("click", () => switchTab("generate"));
    tabModify.addEventListener("click", () => switchTab("modify"));

    // ================================================================
    //  PROGRESS BAR (reusable)
    // ================================================================
    let progressInterval = null;
    let progressValue = 0;

    function startProgress(bar) {
        progressValue = 0;
        bar.style.width = "0%";
        progressInterval = setInterval(() => {
            const remaining = 90 - progressValue;
            progressValue = Math.min(90, progressValue + Math.max(0.3, remaining * 0.04));
            bar.style.width = progressValue + "%";
        }, 200);
    }

    function completeProgress(bar) {
        clearInterval(progressInterval);
        bar.style.width = "100%";
    }

    function stopProgress() { clearInterval(progressInterval); }

    // ================================================================
    //  ANALYZE TAB — File Selection
    // ================================================================
    function handleAnalyzeFileSelect(file) {
        if (!ALLOWED_EXT.includes(getFileExt(file.name))) {
            alert("Unsupported file type. Please upload a PDF, JPG, or PNG file.");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert("File too large. Maximum size is 20 MB.");
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        if(fileSize) fileSize.textContent = formatFileSize(file.size);
        filePreview.style.display = "";
        dropZone.style.display = "none";
        
        analyzeTextarea.value = "";
        analyzeTextarea.placeholder = "Questions will be extracted from the uploaded file via OCR...";
        analyzeTextarea.disabled = true;
        
        updateAnalyzeButton();
    }

    function removeAnalyzeFile() {
        selectedFile = null;
        fileInput.value = "";
        filePreview.style.display = "none";
        dropZone.style.display = "";
        
        analyzeTextarea.disabled = false;
        analyzeTextarea.placeholder = "Enter questions, one per line...\n\n1. What is polymorphism?\n2. Explain inheritance in OOP\n3. Define encapsulation";
        
        updateAnalyzeButton();
    }

    function updateAnalyzeButton() {
        const hasFile = !!selectedFile;
        const hasText = parseQuestions(analyzeTextarea.value).length > 0;
        btnAnalyze.disabled = !(hasFile || hasText);
        analyzeQCount.textContent = hasFile ? "📄" : parseQuestions(analyzeTextarea.value).length;
    }

    analyzeTextarea.addEventListener("input", updateAnalyzeButton);

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault(); dropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) handleAnalyzeFileSelect(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", () => { if (fileInput.files.length > 0) handleAnalyzeFileSelect(fileInput.files[0]); });
    btnRemoveFile.addEventListener("click", removeAnalyzeFile);

    // ================================================================
    //  ANALYZE TAB — API Call & Results
    // ================================================================
    async function analyzeFile() {
        const hasFile = !!selectedFile;
        const hasText = parseQuestions(analyzeTextarea.value).length > 0;
        if (!hasFile && !hasText) return;
        
        showSection(loadingSection);
        startProgress(progressBar);
        
        try {
            let data;
            if (hasFile) {
                const formData = new FormData();
                formData.append("file", selectedFile);
                const res = await fetch(`${API_BASE}/api/upload-paper`, { method: "POST", body: formData });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error (${res.status})`); }
                data = await res.json();
            } else {
                const qs = parseQuestions(analyzeTextarea.value);
                const res = await fetch(`${API_BASE}/analyze-paper`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ questions: qs })
                });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error (${res.status})`); }
                const rawAnalysis = await res.json();
                data = {
                    filename: "Manual Entry",
                    total_questions: qs.length,
                    questions: qs,
                    analysis: rawAnalysis
                };
            }
            
            completeProgress(progressBar);
            setTimeout(() => renderResults(data), 400);
        } catch (err) {
            stopProgress();
            errorMessage.textContent = err.message || "Failed to analyze the paper.";
            showSection(errorSection);
        }
    }

    btnAnalyze.addEventListener("click", analyzeFile);

    function renderResults(data) {
        showSection(resultsSection);
        const questions = data.questions || [];
        const analysis = data.analysis || {};
        const dist = analysis.difficulty_distribution || {};
        const avgBloom = analysis.average_bloom_level || 0;
        const complexity = analysis.complexity_score || 0;
        animateValue(valTotal, questions.length);
        animateValue(valBloom, avgBloom, 1000, true);
        animateValue(valComplexity, complexity, 1000, true);
        renderDifficultyChart(dist);
        renderBloomLevel(avgBloom);
        renderQuestionsList(questions);
    }

    // ================================================================
    //  SHARED CHART HELPERS
    // ================================================================
    function createDoughnutChart(ctx, dist, existingChart) {
        if (existingChart) existingChart.destroy();
        const easy = dist.Easy || 0, medium = dist.Medium || 0, hard = dist.Hard || 0;
        return new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Easy", "Medium", "Hard"],
                datasets: [{
                    data: [easy, medium, hard],
                    backgroundColor: ["rgba(52,211,153,0.85)", "rgba(251,191,36,0.85)", "rgba(248,113,113,0.85)"],
                    borderColor: ["rgba(52,211,153,1)", "rgba(251,191,36,1)", "rgba(248,113,113,1)"],
                    borderWidth: 2, hoverBorderWidth: 3, spacing: 3,
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: true, cutout: "65%",
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(10,10,26,0.9)", titleColor: "#f0f0f8", bodyColor: "#f0f0f8",
                        borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, cornerRadius: 10, padding: 12,
                        bodyFont: { family: "Inter", size: 13 },
                        callbacks: { label: (c) => ` ${c.label}: ${c.parsed}%` },
                    },
                },
                animation: { animateRotate: true, duration: 1000 },
            },
        });
    }

    function buildLegendHtml(dist) {
        return [
            { label: "Easy",   value: dist.Easy || 0,   color: "#34d399" },
            { label: "Medium", value: dist.Medium || 0, color: "#fbbf24" },
            { label: "Hard",   value: dist.Hard || 0,   color: "#f87171" },
        ].map(i => `
            <div class="legend-item">
                <span class="legend-dot" style="background:${i.color}"></span>
                <span>${i.label}</span>
                <span class="legend-value">${i.value}%</span>
            </div>
        `).join("");
    }

    function renderDifficultyChart(dist) {
        const ctx = document.getElementById("difficulty-chart").getContext("2d");
        difficultyChart = createDoughnutChart(ctx, dist, difficultyChart);
        chartLegend.innerHTML = buildLegendHtml(dist);
    }

    function renderBloomLevel(avgBloom) {
        const rounded = Math.round(avgBloom);
        bloomNumber.textContent = avgBloom.toFixed(2);
        bloomLabel.textContent = `Level: ${BLOOM_LABELS[rounded] || "—"}`;
        const pct = ((avgBloom / 6) * 100).toFixed(1);
        requestAnimationFrame(() => {
            setTimeout(() => { bloomFill.style.width = pct + "%"; bloomMarker.style.left = pct + "%"; }, 200);
        });
        document.querySelectorAll("#results-section .bloom-level").forEach((el) => {
            el.classList.toggle("active", parseInt(el.dataset.level, 10) <= rounded);
        });
    }

    function renderQuestionsList(questions) {
        questionCount.textContent = questions.length + " question" + (questions.length !== 1 ? "s" : "");
        questionsList.innerHTML = questions.map((q, i) => `
            <li class="question-item" style="animation-delay: ${i * 0.05}s">
                <span class="question-num">${i + 1}</span>
                <span class="question-text">${escapeHtml(q)}</span>
            </li>
        `).join("");
    }

    function resetAnalyze() {
        removeAnalyzeFile();
        analyzeTextarea.value = "";
        updateAnalyzeButton();
        showSection(uploadSection);
        bloomFill.style.width = "0%";
        bloomMarker.style.left = "0%";
        document.querySelectorAll(".bloom-level").forEach((el) => el.classList.remove("active"));
    }

    btnNewAnalysis.addEventListener("click", resetAnalyze);
    btnRetry.addEventListener("click", resetAnalyze);

    // ================================================================
    //  COMPARE TAB — File Upload for Paper 1 & Paper 2
    // ================================================================

    function setupCompareUpload(dropZoneEl, fileInputEl, infoEl, fnameEl, removeBtn, paperNum) {
        // Click to browse
        dropZoneEl.addEventListener("click", () => fileInputEl.click());

        // Drag & Drop
        dropZoneEl.addEventListener("dragover", (e) => { e.preventDefault(); dropZoneEl.classList.add("drag-over"); });
        dropZoneEl.addEventListener("dragleave", () => dropZoneEl.classList.remove("drag-over"));
        dropZoneEl.addEventListener("drop", (e) => {
            e.preventDefault(); dropZoneEl.classList.remove("drag-over");
            if (e.dataTransfer.files.length > 0) selectCompareFile(e.dataTransfer.files[0], paperNum, dropZoneEl, infoEl, fnameEl);
        });

        // File input change
        fileInputEl.addEventListener("change", () => {
            if (fileInputEl.files.length > 0) selectCompareFile(fileInputEl.files[0], paperNum, dropZoneEl, infoEl, fnameEl);
        });

        // Remove button
        removeBtn.addEventListener("click", () => {
            removeCompareFile(paperNum, dropZoneEl, fileInputEl, infoEl);
        });
    }

    function selectCompareFile(file, paperNum, dropZoneEl, infoEl, fnameEl) {
        if (!ALLOWED_EXT.includes(getFileExt(file.name))) {
            alert("Unsupported file type. Please upload a PDF, JPG, or PNG.");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert("File too large. Maximum size is 20 MB.");
            return;
        }

        if (paperNum === 1) compareSelectedFile1 = file;
        else compareSelectedFile2 = file;

        fnameEl.textContent = file.name;
        dropZoneEl.style.display = "none";
        infoEl.style.display = "";

        // Disable textarea when file is selected (file takes priority)
        const ta = paperNum === 1 ? textarea1 : textarea2;
        ta.value = "";
        ta.placeholder = "Questions will be extracted from the uploaded file via OCR...";
        ta.disabled = true;

        updateCompareButton();
    }

    function removeCompareFile(paperNum, dropZoneEl, fileInputEl, infoEl) {
        if (paperNum === 1) compareSelectedFile1 = null;
        else compareSelectedFile2 = null;

        fileInputEl.value = "";
        infoEl.style.display = "none";
        dropZoneEl.style.display = "";

        const ta = paperNum === 1 ? textarea1 : textarea2;
        ta.disabled = false;
        ta.placeholder = paperNum === 1
            ? "Enter questions, one per line...\n\n1. What is polymorphism?\n2. Explain inheritance in OOP\n3. Define encapsulation"
            : "Enter questions, one per line...\n\n1. Design a compiler for a new language\n2. Evaluate quicksort vs mergesort\n3. Analyze time complexity of BFS";

        updateCompareButton();
    }

    // Wire up both cards
    setupCompareUpload(compareDrop1, compareFile1, compareInfo1, compareFname1, compareRemove1, 1);
    setupCompareUpload(compareDrop2, compareFile2, compareInfo2, compareFname2, compareRemove2, 2);

    // ================================================================
    //  COMPARE TAB — Question counting & button state
    // ================================================================
    function updateCompareButton() {
        const has1 = compareSelectedFile1 || parseQuestions(textarea1.value).length > 0;
        const has2 = compareSelectedFile2 || parseQuestions(textarea2.value).length > 0;
        btnCompare.disabled = !(has1 && has2);
        updateQuestionCounts();
    }

    function updateQuestionCounts() {
        p1Count.textContent = compareSelectedFile1 ? "📄" : parseQuestions(textarea1.value).length;
        p2Count.textContent = compareSelectedFile2 ? "📄" : parseQuestions(textarea2.value).length;
    }

    textarea1.addEventListener("input", updateCompareButton);
    textarea2.addEventListener("input", updateCompareButton);

    // ================================================================
    //  COMPARE TAB — API Call
    // ================================================================
    async function comparePapers() {
        const hasFile1 = !!compareSelectedFile1;
        const hasFile2 = !!compareSelectedFile2;
        const hasText1 = parseQuestions(textarea1.value).length > 0;
        const hasText2 = parseQuestions(textarea2.value).length > 0;

        if (!(hasFile1 || hasText1) || !(hasFile2 || hasText2)) return;

        showSection(compareLoading);
        startProgress(compareProgressBar);

        try {
            let data;

            if (hasFile1 && hasFile2) {
                // Both files — use upload endpoint
                const formData = new FormData();
                formData.append("paper1", compareSelectedFile1);
                formData.append("paper2", compareSelectedFile2);
                const res = await fetch(`${API_BASE}/api/compare-papers-upload`, { method: "POST", body: formData });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error (${res.status})`); }
                data = await res.json();
            } else if (!hasFile1 && !hasFile2) {
                // Both text — use JSON endpoint
                const q1 = parseQuestions(textarea1.value);
                const q2 = parseQuestions(textarea2.value);
                const res = await fetch(`${API_BASE}/api/compare-papers`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paper1: q1, paper2: q2 }),
                });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error (${res.status})`); }
                data = await res.json();
            } else {
                // Mixed: one file, one text — upload the file first via /upload-paper, then use JSON compare
                let q1, q2;

                if (hasFile1) {
                    const fd = new FormData(); fd.append("file", compareSelectedFile1);
                    const r = await fetch(`${API_BASE}/api/upload-paper`, { method: "POST", body: fd });
                    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error("Paper 1: " + (err.detail || `Server error (${r.status})`)); }
                    const d = await r.json();
                    q1 = d.questions;
                } else {
                    q1 = parseQuestions(textarea1.value);
                }

                if (hasFile2) {
                    const fd = new FormData(); fd.append("file", compareSelectedFile2);
                    const r = await fetch(`${API_BASE}/api/upload-paper`, { method: "POST", body: fd });
                    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error("Paper 2: " + (err.detail || `Server error (${r.status})`)); }
                    const d = await r.json();
                    q2 = d.questions;
                } else {
                    q2 = parseQuestions(textarea2.value);
                }

                const res = await fetch(`${API_BASE}/api/compare-papers`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paper1: q1, paper2: q2 }),
                });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error (${res.status})`); }
                data = await res.json();
            }

            completeProgress(compareProgressBar);
            setTimeout(() => renderCompareResults(data), 400);
        } catch (err) {
            stopProgress();
            errorMessage.textContent = err.message || "Failed to compare papers.";
            showSection(errorSection);
        }
    }

    btnCompare.addEventListener("click", comparePapers);

    // ================================================================
    //  COMPARE TAB — Render Results
    // ================================================================
    function renderCompareResults(data) {
        showSection(compareResults);

        const a1 = data.paper1_analysis;
        const a2 = data.paper2_analysis;
        const drift = data.drift;

        // Drift stat cards
        const driftBloomEl = document.getElementById("drift-bloom");
        const driftComplexityEl = document.getElementById("drift-complexity");
        
        const bloomFmt = formatDrift(drift.bloom_shift, "Avg Bloom Level");
        const compFmt = formatDrift(drift.complexity_change, "Complexity Score");

        driftBloomEl.textContent = bloomFmt.text;
        driftBloomEl.className = "stat-value " + bloomFmt.className;
        
        driftComplexityEl.textContent = compFmt.text;
        driftComplexityEl.className = "stat-value " + compFmt.className;

        // Side by side doughnut charts
        const ctx1 = document.getElementById("compare-chart-1").getContext("2d");
        const ctx2 = document.getElementById("compare-chart-2").getContext("2d");
        compareChart1 = createDoughnutChart(ctx1, a1.difficulty_distribution, compareChart1);
        compareChart2 = createDoughnutChart(ctx2, a2.difficulty_distribution, compareChart2);
        document.getElementById("compare-legend-1").innerHTML = buildLegendHtml(a1.difficulty_distribution);
        document.getElementById("compare-legend-2").innerHTML = buildLegendHtml(a2.difficulty_distribution);

        renderDriftBars(drift.difficulty_shift);
        renderCompareTable(a1, a2, drift);
    }

    function renderDriftBars(shift, containerId = "drift-bars") {
        const container = document.getElementById(containerId);
        const categories = [
            { label: "Easy",   value: shift.Easy,   color: "#34d399" },
            { label: "Medium", value: shift.Medium, color: "#fbbf24" },
            { label: "Hard",   value: shift.Hard,   color: "#f87171" },
        ];

        container.innerHTML = categories.map((cat) => {
            const pct = Math.abs(cat.value) / 100 * 50;
            const isPositive = cat.value >= 0;
            const left = isPositive ? "50%" : `${50 - pct}%`;
            const width = `${pct}%`;
            const fmt = formatDrift(cat.value, cat.label);
            return `
                <div class="drift-bar-row">
                    <div class="drift-bar-label" style="color:${cat.color}">${cat.label}</div>
                    <div class="drift-bar-track">
                        <div class="drift-bar-center"></div>
                        <div class="drift-bar-fill" style="left:${left}; width:${width}; background:${cat.color}; opacity:0.7;"></div>
                    </div>
                    <div class="drift-bar-value ${fmt.className}">${fmt.text}%</div>
                </div>
            `;
        }).join("");
    }

    function renderCompareTable(a1, a2, drift) {
        const d1 = a1.difficulty_distribution, d2 = a2.difficulty_distribution;
        const ds = drift.difficulty_shift;
        const rows = [
            ["Total Questions", a1.total_questions, a2.total_questions, a2.total_questions - a1.total_questions],
            ["Easy %",   d1.Easy,   d2.Easy,   ds.Easy],
            ["Medium %", d1.Medium, d2.Medium, ds.Medium],
            ["Hard %",   d1.Hard,   d2.Hard,   ds.Hard],
            ["Avg Bloom Level",  a1.average_bloom_level,  a2.average_bloom_level,  drift.bloom_shift],
            ["Complexity Score", a1.complexity_score,      a2.complexity_score,      drift.complexity_change],
        ];

        document.getElementById("compare-table-body").innerHTML = rows.map(([label, v1, v2, d]) => {
            const fmt = formatDrift(d, label);
            return `
                <tr>
                    <td>${label}</td>
                    <td>${typeof v1 === "number" ? v1 : "—"}</td>
                    <td>${typeof v2 === "number" ? v2 : "—"}</td>
                    <td class="${fmt.className}">${fmt.text}</td>
                </tr>
            `;
        }).join("");
    }

    function resetCompare() {
        // Reset files
        removeCompareFile(1, compareDrop1, compareFile1, compareInfo1);
        removeCompareFile(2, compareDrop2, compareFile2, compareInfo2);
        textarea1.value = "";
        textarea2.value = "";
        updateCompareButton();
        showSection(compareSection);
    }


    let genChartRequested = null;
    let genChartActual = null;
    let genChartPool = null;

    // ================================================================
    //  GENERATE TAB — Slider + Question counting
    // ================================================================
    function updateGenSliders() {
        const easy = parseInt(genEasySlider.value, 10);
        const medium = parseInt(genMediumSlider.value, 10);
        const hard = parseInt(genHardSlider.value, 10);

        genEasyVal.textContent = easy + "%";
        genMediumVal.textContent = medium + "%";
        genHardVal.textContent = hard + "%";

        const total = easy + medium + hard;
        genTotalPct.textContent = total + "%";

        genTotalPct.classList.remove("over", "under");
        if (total > 105) genTotalPct.classList.add("over");
        else if (total < 95) genTotalPct.classList.add("under");

        updateGenButton();
    }

    function handleGenFileSelect(file) {
        if (!ALLOWED_EXT.includes(getFileExt(file.name))) {
            alert("Unsupported file type. Please upload a PDF, JPG, or PNG file.");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert("File too large. Maximum size is 20 MB.");
            return;
        }
        genSelectedFile = file;
        genFname.textContent = file.name;
        genFileInfo.style.display = "";
        genDropZone.style.display = "none";
        
        genQuestionsTA.value = "";
        genQuestionsTA.placeholder = "Questions will be extracted from the uploaded file via OCR...";
        genQuestionsTA.disabled = true;
        
        updateGenButton();
    }
    
    function removeGenFile() {
        genSelectedFile = null;
        genFileInput.value = "";
        genFileInfo.style.display = "none";
        genDropZone.style.display = "";
        
        genQuestionsTA.disabled = false;
        genQuestionsTA.placeholder = "Enter questions, one per line...\n\n1. What is polymorphism?\n2. Explain inheritance in OOP\n3. Design a graph traversal algorithm...";
        
        updateGenButton();
    }
    
    genDropZone.addEventListener("click", () => genFileInput.click());
    genDropZone.addEventListener("dragover", (e) => { e.preventDefault(); genDropZone.classList.add("drag-over"); });
    genDropZone.addEventListener("dragleave", () => genDropZone.classList.remove("drag-over"));
    genDropZone.addEventListener("drop", (e) => {
        e.preventDefault(); genDropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) handleGenFileSelect(e.dataTransfer.files[0]);
    });
    genFileInput.addEventListener("change", () => { if (genFileInput.files.length > 0) handleGenFileSelect(genFileInput.files[0]); });
    genBtnRemoveFile.addEventListener("click", removeGenFile);

    function updateGenButton() {
        const hasFile = !!genSelectedFile;
        const questions = parseQuestions(genQuestionsTA.value);
        genQCount.textContent = hasFile ? "📄" : questions.length;

        const total = parseInt(genEasySlider.value, 10) + parseInt(genMediumSlider.value, 10) + parseInt(genHardSlider.value, 10);
        const validDist = Math.abs(total - 100) <= 5;

        btnGenerate.disabled = !((hasFile || questions.length > 0) && validDist);
    }

    genEasySlider.addEventListener("input", updateGenSliders);
    genMediumSlider.addEventListener("input", updateGenSliders);
    genHardSlider.addEventListener("input", updateGenSliders);
    genQuestionsTA.addEventListener("input", updateGenButton);

    // ================================================================
    //  GENERATE TAB — API Call
    // ================================================================
    async function generatePaper() {
        const hasFile = !!genSelectedFile;
        const manualQuestions = parseQuestions(genQuestionsTA.value);
        if (!hasFile && manualQuestions.length === 0) return;

        showSection(generateLoading);
        startProgress(generateProgressBar);
        
        let finalQuestions = [];
        
        try {
            if (hasFile) {
                const formData = new FormData();
                formData.append("file", genSelectedFile);
                const r = await fetch(`${API_BASE}/api/upload-paper`, { method: "POST", body: formData });
                if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.detail || `Server error (${r.status})`); }
                const d = await r.json();
                finalQuestions = d.questions;
            } else {
                finalQuestions = manualQuestions;
            }
            
            if (finalQuestions.length === 0) throw new Error("No questions extracted.");

            const payload = {
                questions: finalQuestions,
                distribution: {
                    easy: parseInt(genEasySlider.value, 10),
                    medium: parseInt(genMediumSlider.value, 10),
                    hard: parseInt(genHardSlider.value, 10),
                },
            };

            const countVal = genCountInput.value.trim();
            if (countVal && parseInt(countVal, 10) > 0) {
                payload.total_questions_to_select = parseInt(countVal, 10);
            }

            const res = await fetch(`${API_BASE}/api/generate-paper`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `Server error (${res.status})`);
            }
            const data = await res.json();
            completeProgress(generateProgressBar);
            setTimeout(() => renderGenResults(data), 400);
        } catch (err) {
            stopProgress();
            errorMessage.textContent = err.message || "Failed to generate paper.";
            showSection(errorSection);
        }
    }

    btnGenerate.addEventListener("click", generatePaper);

    // ================================================================
    //  GENERATE TAB — Render Results
    // ================================================================
    function renderGenResults(data) {
        showSection(generateResults);
        lastGeneratedQuestions = data.selected_questions || [];

        // Stats
        animateValue(document.getElementById("gen-val-input"), data.total_input_questions);
        animateValue(document.getElementById("gen-val-selected"), data.total_selected);
        const poolTotal = (data.metadata.available_pool.Easy || 0) + (data.metadata.available_pool.Medium || 0) + (data.metadata.available_pool.Hard || 0);
        animateValue(document.getElementById("gen-val-pool-total"), poolTotal);

        // Input Pool Chart
        const pool = data.metadata.available_pool;
        if (poolTotal > 0) {
            const poolPct = {
                Easy: Math.round((pool.Easy / poolTotal) * 100),
                Medium: Math.round((pool.Medium / poolTotal) * 100),
                Hard: Math.round((pool.Hard / poolTotal) * 100),
            };
            const ctx0 = document.getElementById("gen-chart-pool").getContext("2d");
            genChartPool = createDoughnutChart(ctx0, poolPct, genChartPool);
            document.getElementById("gen-legend-pool").innerHTML = buildLegendHtml(poolPct);
        }

        // Requested distribution chart (percentage-based)
        const reqDist = data.requested_distribution;
        const ctx1 = document.getElementById("gen-chart-requested").getContext("2d");
        genChartRequested = createDoughnutChart(ctx1, reqDist, genChartRequested);
        document.getElementById("gen-legend-requested").innerHTML = buildLegendHtml(reqDist);

        // Actual distribution chart (count-based, convert to %)
        const actual = data.actual_distribution;
        const totalSel = data.total_selected || 1;
        const actualPct = {
            Easy: Math.round((actual.Easy / totalSel) * 100),
            Medium: Math.round((actual.Medium / totalSel) * 100),
            Hard: Math.round((actual.Hard / totalSel) * 100),
        };
        const ctx2 = document.getElementById("gen-chart-actual").getContext("2d");
        genChartActual = createDoughnutChart(ctx2, actualPct, genChartActual);
        document.getElementById("gen-legend-actual").innerHTML = buildLegendHtml(actualPct);


        // Questions list
        const selectedQ = data.selected_questions || [];
        const countEl = document.getElementById("gen-question-count");
        countEl.textContent = selectedQ.length + " question" + (selectedQ.length !== 1 ? "s" : "");
        const listEl = document.getElementById("gen-questions-list");
        listEl.innerHTML = selectedQ.map((q, i) => `
            <li class="question-item" style="animation-delay: ${i * 0.05}s">
                <span class="question-num">${i + 1}</span>
                <span class="question-text">${escapeHtml(q)}</span>
            </li>
        `).join("");
    }

    function renderPoolBars(pool) {
        const container = document.getElementById("gen-pool-bars");
        const maxCount = Math.max(pool.Easy || 0, pool.Medium || 0, pool.Hard || 0, 1);
        const categories = [
            { label: "Easy",   count: pool.Easy || 0,   color: "#34d399" },
            { label: "Medium", count: pool.Medium || 0, color: "#fbbf24" },
            { label: "Hard",   count: pool.Hard || 0,   color: "#f87171" },
        ];

        container.innerHTML = categories.map((cat) => {
            const pct = (cat.count / maxCount) * 100;
            return `
                <div class="gen-pool-row">
                    <div class="gen-pool-label" style="color:${cat.color}">${cat.label}</div>
                    <div class="gen-pool-track">
                        <div class="gen-pool-fill" style="width:${pct}%; background:${cat.color};"></div>
                    </div>
                    <div class="gen-pool-count">${cat.count}</div>
                </div>
            `;
        }).join("");
    }

    function resetGenerate() {
        removeGenFile();
        genQuestionsTA.value = "";
        genEasySlider.value = 30;
        genMediumSlider.value = 50;
        genHardSlider.value = 20;
        genCountInput.value = "";
        updateGenSliders();
        showSection(generateSection);
    }

    btnNewGenerate.addEventListener("click", resetGenerate);

    btnNewCompare.addEventListener("click", resetCompare);

    // ================================================================
    //  MODIFY TAB — File Upload
    // ================================================================
    function handleModFileSelect(file) {
        if (!ALLOWED_EXT.includes(getFileExt(file.name))) {
            alert("Unsupported file type. Please upload a PDF, JPG, or PNG file.");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert("File too large. Maximum size is 20 MB.");
            return;
        }
        modSelectedFile = file;
        modFname.textContent = file.name;
        modFileInfo.style.display = "";
        modDropZone.style.display = "none";

        modQuestionsTA.value = "";
        modQuestionsTA.placeholder = "Questions will be extracted from the uploaded file via OCR...";
        modQuestionsTA.disabled = true;

        updateModButton();
    }

    function removeModFile() {
        modSelectedFile = null;
        modFileInput.value = "";
        modFileInfo.style.display = "none";
        modDropZone.style.display = "";

        modQuestionsTA.disabled = false;
        modQuestionsTA.placeholder = "Enter questions, one per line...\n\n1. What is polymorphism?\n2. Explain inheritance in OOP\n3. Design a graph traversal algorithm...";

        updateModButton();
    }

    modDropZone.addEventListener("click", () => modFileInput.click());
    modDropZone.addEventListener("dragover", (e) => { e.preventDefault(); modDropZone.classList.add("drag-over"); });
    modDropZone.addEventListener("dragleave", () => modDropZone.classList.remove("drag-over"));
    modDropZone.addEventListener("drop", (e) => {
        e.preventDefault(); modDropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) handleModFileSelect(e.dataTransfer.files[0]);
    });
    modFileInput.addEventListener("change", () => { if (modFileInput.files.length > 0) handleModFileSelect(modFileInput.files[0]); });
    modBtnRemoveFile.addEventListener("click", removeModFile);

    // ================================================================
    //  MODIFY TAB — Slider + Question counting
    // ================================================================
    function updateModSliders() {
        const easy = parseInt(modEasySlider.value, 10);
        const medium = parseInt(modMediumSlider.value, 10);
        const hard = parseInt(modHardSlider.value, 10);

        modEasyVal.textContent = easy + "%";
        modMediumVal.textContent = medium + "%";
        modHardVal.textContent = hard + "%";

        const total = easy + medium + hard;
        modTotalPct.textContent = total + "%";

        modTotalPct.classList.remove("over", "under");
        if (total > 105) modTotalPct.classList.add("over");
        else if (total < 95) modTotalPct.classList.add("under");

        updateModButton();
    }

    function updateModButton() {
        const hasFile = !!modSelectedFile;
        const questions = parseQuestions(modQuestionsTA.value);
        modQCount.textContent = hasFile ? "📄" : questions.length;

        const total = parseInt(modEasySlider.value, 10) + parseInt(modMediumSlider.value, 10) + parseInt(modHardSlider.value, 10);
        const validDist = Math.abs(total - 100) <= 5;

        btnModify.disabled = !((hasFile || questions.length > 0) && validDist);
    }

    modEasySlider.addEventListener("input", updateModSliders);
    modMediumSlider.addEventListener("input", updateModSliders);
    modHardSlider.addEventListener("input", updateModSliders);
    modQuestionsTA.addEventListener("input", updateModButton);

    // ================================================================
    //  MODIFY TAB — API Call
    // ================================================================
    async function modifyPaper() {
        const hasFile = !!modSelectedFile;
        const manualQuestions = parseQuestions(modQuestionsTA.value);
        if (!hasFile && manualQuestions.length === 0) return;

        showSection(modifyLoading);
        startProgress(modifyProgressBar);

        let finalQuestions = [];

        try {
            if (hasFile) {
                const formData = new FormData();
                formData.append("file", modSelectedFile);
                const r = await fetch(`${API_BASE}/api/upload-paper`, { method: "POST", body: formData });
                if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.detail || `Server error (${r.status})`); }
                const d = await r.json();
                finalQuestions = d.questions;
            } else {
                finalQuestions = manualQuestions;
            }

            if (finalQuestions.length === 0) throw new Error("No questions extracted.");

            const payload = {
                questions: finalQuestions,
                target_distribution: {
                    Easy: parseInt(modEasySlider.value, 10),
                    Medium: parseInt(modMediumSlider.value, 10),
                    Hard: parseInt(modHardSlider.value, 10),
                },
            };

            const res = await fetch(`${API_BASE}/api/modify-paper-distribution`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `Server error (${res.status})`);
            }
            const data = await res.json();
            completeProgress(modifyProgressBar);
            setTimeout(() => renderModResults(data), 400);
        } catch (err) {
            stopProgress();
            errorMessage.textContent = err.message || "Failed to modify paper.";
            showSection(errorSection);
        }
    }

    btnModify.addEventListener("click", modifyPaper);

    // ================================================================
    //  MODIFY TAB — Render Results
    // ================================================================
    function renderModResults(data) {
        showSection(modifyResults);

        // Stats
        animateValue(document.getElementById("mod-val-total"), data.total_questions);
        animateValue(document.getElementById("mod-val-rewritten"), data.rewritten_count);
        animateValue(document.getElementById("mod-val-unchanged"), data.total_questions - data.rewritten_count);

        // Original distribution chart
        const origDist = data.original_distribution || { Easy: 0, Medium: 0, Hard: 0 };
        const ctx1 = document.getElementById("mod-chart-original").getContext("2d");
        modChartOriginal = createDoughnutChart(ctx1, origDist, modChartOriginal);
        document.getElementById("mod-legend-original").innerHTML = buildLegendHtml(origDist);

        // Target distribution chart
        const targetDist = data.target_distribution || { Easy: 0, Medium: 0, Hard: 0 };
        const ctx2 = document.getElementById("mod-chart-target").getContext("2d");
        modChartTarget = createDoughnutChart(ctx2, targetDist, modChartTarget);
        document.getElementById("mod-legend-target").innerHTML = buildLegendHtml(targetDist);

        // Questions list
        const modifiedQs = data.modified_questions || [];
        lastModifiedQuestions = modifiedQs.map(q => q.modified || q.original);
        
        const countEl = document.getElementById("mod-question-count");
        countEl.textContent = modifiedQs.length + " question" + (modifiedQs.length !== 1 ? "s" : "");

        const listEl = document.getElementById("mod-questions-list");
        listEl.innerHTML = modifiedQs.map((q, i) => {
            const badgeClass = (level) => `mod-badge mod-badge-${level.toLowerCase()}`;
            const wasRewritten = q.was_rewritten;

            if (wasRewritten) {
                return `
                    <li class="mod-question-item" style="animation-delay: ${i * 0.05}s">
                        <div class="mod-q-header">
                            <span class="mod-q-num">${i + 1}</span>
                            <div class="mod-q-badges">
                                <span class="${badgeClass(q.original_difficulty)}">${q.original_difficulty}</span>
                                <span class="mod-badge-arrow">→</span>
                                <span class="${badgeClass(q.new_difficulty)}">${q.new_difficulty}</span>
                                <span class="mod-badge mod-badge-rewritten">✏️ Rewritten</span>
                            </div>
                        </div>
                        <div class="mod-q-body">
                            <div>
                                <div class="mod-q-label">Original</div>
                                <div class="mod-q-original">${escapeHtml(q.original)}</div>
                            </div>
                            <div>
                                <div class="mod-q-label">Modified</div>
                                <div class="mod-q-modified">${escapeHtml(q.modified)}</div>
                            </div>
                        </div>
                    </li>
                `;
            } else {
                return `
                    <li class="mod-question-item" style="animation-delay: ${i * 0.05}s">
                        <div class="mod-q-header">
                            <span class="mod-q-num">${i + 1}</span>
                            <div class="mod-q-badges">
                                <span class="${badgeClass(q.original_difficulty)}">${q.original_difficulty}</span>
                            </div>
                        </div>
                        <div class="mod-q-unchanged">${escapeHtml(q.original)}</div>
                    </li>
                `;
            }
        }).join("");
    }

    function resetModify() {
        removeModFile();
        modQuestionsTA.value = "";
        modEasySlider.value = 30;
        modMediumSlider.value = 50;
        modHardSlider.value = 20;
        updateModSliders();
        showSection(modifySection);
    }

    btnNewModify.addEventListener("click", resetModify);
    
    // PDF Download Listeners
    document.getElementById("btn-gen-download-pdf")?.addEventListener("click", function() {
        downloadPdf(lastGeneratedQuestions, "generated_question_paper.pdf", this);
    });
    
    document.getElementById("btn-mod-download-pdf")?.addEventListener("click", function() {
        downloadPdf(lastModifiedQuestions, "modified_question_paper.pdf", this);
    });
})();
