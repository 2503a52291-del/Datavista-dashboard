/* =========================================================
   DATAVISTA — AI TOOLS USAGE ANALYTICS DASHBOARD
   Dataset: ai_tools_cleaned.csv
   Compatible with the existing index.html and style.css
   ========================================================= */

const CONFIG = {
    csvFile: "ai_tools_cleaned.csv",

    columns: {
        timestamp: "Timestamp",
        year: "year",
        tool: "ai tool",
        purpose: "mainly use AI tools for",
        frequency: "frequency",
        time: "time spent",
        helpfulness: "helpful of ai tools",
        productivity: "AI tools improve your productivity",
        improvement: "improved because of ai tools",
        recommend: "recommend to others",
        experience: "overall experience"
    },

    colors: [
        "#8b7cff",
        "#57a6ff",
        "#44d7a8",
        "#ffb86b",
        "#f18bce",
        "#a4a9ff",
        "#54d4df",
        "#ff7b92",
        "#c3d87a"
    ]
};

let rawData = [];
let filteredData = [];
let charts = {};
let activeChartFilters = {};


/* =========================================================
   CHART DEFINITIONS
   Every ID below matches a canvas in index.html.
   ========================================================= */

const chartDefinitions = [
    // PAGE 1 — OVERVIEW
    {
        id: "chart-tools",
        type: "bar",
        field: "tool",
        horizontal: true,
        title: "Most Used AI Tools"
    },
    {
        id: "chart-frequency",
        type: "bar",
        field: "frequency",
        title: "AI Usage Frequency"
    },
    {
        id: "chart-experience",
        type: "doughnut",
        field: "experience",
        title: "Overall Student Experience"
    },
    {
        id: "chart-purpose",
        type: "bar",
        field: "purpose",
        horizontal: true,
        title: "Main Purposes of AI Usage"
    },

    // PAGE 2 — AI TOOL USAGE
    {
        id: "chart-usage-frequency",
        type: "bar",
        field: "frequency",
        title: "Usage Frequency"
    },
    {
        id: "chart-time-spent",
        type: "bar",
        field: "time",
        horizontal: true,
        title: "Time Spent Using AI Tools"
    },
    {
        id: "chart-comparison-frequency",
        type: "bar",
        field: "frequency",
        groupBy: "tool",
        title: "Usage Frequency by AI Tool"
    },

    // PAGE 3 — STUDENT EXPERIENCE
    {
        id: "chart-learning-impact",
        type: "bar",
        field: "productivity",
        horizontal: true,
        title: "Productivity Improvement"
    },
    {
        id: "chart-helpfulness",
        type: "bar",
        field: "helpfulness",
        horizontal: true,
        title: "Perceived Helpfulness of AI"
    },
    {
        id: "chart-improvement",
        type: "bar",
        field: "improvement",
        horizontal: true,
        title: "Learning Improvement"
    },
    {
        id: "chart-recommend",
        type: "doughnut",
        field: "recommend",
        title: "Recommendation to Others"
    },

    // PAGE 4 — TOOL COMPARISON
    {
        id: "chart-tool-comparison",
        type: "bar",
        field: "tool",
        horizontal: true,
        title: "AI Tool Usage Comparison"
    },
    {
        id: "chart-experience-comparison",
        type: "bar",
        field: "experience",
        groupBy: "tool",
        title: "Overall Experience by Tool"
    },
    {
        id: "chart-recommend-comparison",
        type: "bar",
        field: "recommend",
        groupBy: "tool",
        title: "Student Recommendation by Tool"
    }
];


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeKey(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function isMissing(value) {
    const text = normalizeText(value).toLowerCase();

    return (
        !text ||
        text === "nan" ||
        text === "null" ||
        text === "undefined"
    );
}

function getColumnKey(field) {
    return CONFIG.columns[field] || field;
}

function getValue(row, field) {
    const wanted = normalizeKey(getColumnKey(field));

    const actualKey = Object.keys(row).find(
        key => normalizeKey(key) === wanted
    );

    if (!actualKey) return "";

    const value = normalizeText(row[actualKey]);

    if (field === "tool") {
        return normalizeToolName(value);
    }

    return value;
}

function normalizeToolName(value) {
    const original = normalizeText(value);

    if (!original) return "";

    const compact = original
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    const knownTools = {
        chatgpt: "ChatGPT",
        googlegemini: "Google Gemini",
        gemini: "Google Gemini",
        microsoftcopilot: "Microsoft Copilot",
        copilot: "Microsoft Copilot",
        githubcopilot: "GitHub Copilot",
        claude: "Claude"
    };

    return knownTools[compact] || original;
}

function uniqueValues(data, field) {
    return [
        ...new Set(
            data
                .map(row => getValue(row, field))
                .filter(value => !isMissing(value))
        )
    ].sort((a, b) => a.localeCompare(b));
}

function countBy(data, field) {
    const counts = new Map();

    data.forEach(row => {
        const value = getValue(row, field);

        if (!isMissing(value)) {
            counts.set(
                value,
                (counts.get(value) || 0) + 1
            );
        }
    });

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1]);
}

function percentage(part, total) {
    return total ? (part / total) * 100 : 0;
}

function formatPercentage(value) {
    return `${value.toFixed(1)}%`;
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function getChartColor(index) {
    return CONFIG.colors[index % CONFIG.colors.length];
}

function isChartAvailable(id) {
    return Boolean(document.getElementById(id));
}


/* =========================================================
   CSV LOADING
   ========================================================= */

async function loadCSV() {
    setText("data-status", "Loading student data...");

    try {
        if (typeof Papa === "undefined") {
            throw new Error(
                "Papa Parse failed to load. Check your internet connection."
            );
        }

        const response = await fetch(CONFIG.csvFile, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load ${CONFIG.csvFile}. HTTP ${response.status}`
            );
        }

        const csvText = await response.text();

        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: header => header.trim()
        });

        if (result.errors.length) {
            console.warn("CSV parsing warnings:", result.errors);
        }

        rawData = result.data.filter(row =>
            Object.values(row).some(value => !isMissing(value))
        );

        if (!rawData.length) {
            throw new Error("No usable responses were found in the CSV.");
        }

        console.log("CSV headers:", Object.keys(rawData[0]));
        console.log("Responses loaded:", rawData.length);

        validateColumns();

        filteredData = [...rawData];

        populateFilters();
        setupNavigation();
        setupFilterEvents();
        setupResetButtons();

        createAllCharts();
        applyFilters();

        setText(
            "data-status",
            `${rawData.length.toLocaleString()} responses loaded`
        );

    } catch (error) {
        console.error("Dashboard loading error:", error);

        setText("data-status", "Data loading failed");

        showDataError(error.message);
    }
}


/* =========================================================
   DATA VALIDATION
   ========================================================= */

function validateColumns() {
    if (!rawData.length) {
        throw new Error("The CSV file contains no records.");
    }

    const headers = Object.keys(rawData[0]);
    const normalizedHeaders = headers.map(normalizeKey);

    const requiredFields = [
        "tool",
        "year",
        "frequency"
    ];

    const missingFields = requiredFields.filter(field =>
        !normalizedHeaders.includes(
            normalizeKey(getColumnKey(field))
        )
    );

    if (missingFields.length) {
        throw new Error(
            "Required CSV columns are missing: " +
            missingFields.map(getColumnKey).join(", ")
        );
    }

    if (!uniqueValues(rawData, "tool").length) {
        throw new Error(
            'The "ai tool" column has no usable values.'
        );
    }
}


/* =========================================================
   FILTERS
   ========================================================= */

function populateSelect(selectId, field, defaultLabel) {
    const select = document.getElementById(selectId);

    if (!select) return;

    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "all";
    defaultOption.textContent = defaultLabel;

    select.appendChild(defaultOption);

    uniqueValues(rawData, field).forEach(value => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });
}

function populateFilters() {
    populateSelect("filter-year", "year", "All Years");
    populateSelect("filter-tool", "tool", "All Tools");
    populateSelect("filter-frequency", "frequency", "All Frequencies");
    populateSelect("filter-experience", "experience", "All Experiences");
}

function setupFilterEvents() {
    const mappings = {
        "filter-tool": "tool",
        "filter-year": "year",
        "filter-frequency": "frequency",
        "filter-experience": "experience"
    };

    Object.entries(mappings).forEach(([id, field]) => {
        const select = document.getElementById(id);

        if (!select) return;

        select.addEventListener("change", () => {
            if (select.value === "all") {
                delete activeChartFilters[field];
            } else {
                activeChartFilters[field] = select.value;
            }

            applyFilters();
        });
    });
}

function setupResetButtons() {
    // Matches the button in the supplied index.html.
    const resetButton = document.getElementById("reset-filters");

    if (resetButton) {
        resetButton.addEventListener("click", resetFilters);
    }

    // Also supports any other reset buttons if added later.
    document.querySelectorAll(".reset-button").forEach(button => {
        if (button === resetButton) return;

        button.addEventListener("click", resetFilters);
    });
}

function resetFilters() {
    activeChartFilters = {};

    [
        "filter-tool",
        "filter-year",
        "filter-frequency",
        "filter-experience"
    ].forEach(id => {
        const select = document.getElementById(id);

        if (select) {
            select.value = "all";
        }
    });

    applyFilters();
}

function syncFilterControls() {
    const mapping = {
        tool: "filter-tool",
        year: "filter-year",
        frequency: "filter-frequency",
        experience: "filter-experience"
    };

    Object.entries(mapping).forEach(([field, id]) => {
        const select = document.getElementById(id);

        if (!select) return;

        const value = activeChartFilters[field] || "all";

        select.value = [...select.options].some(
            option => option.value === value
        ) ? value : "all";
    });
}


/* =========================================================
   CROSS-FILTERING
   ========================================================= */

function applyFilters() {
    filteredData = rawData.filter(row =>
        Object.entries(activeChartFilters).every(
            ([field, selectedValue]) =>
                getValue(row, field) === selectedValue
        )
    );

    updateActiveFilterText();
    updateKPI();

    chartDefinitions.forEach(updateChart);
}

function updateActiveFilterText() {
    const active = Object.entries(activeChartFilters);

    if (!active.length) {
        setText(
            "active-filters",
            "Showing all available responses"
        );

        return;
    }

    const labels = {
        tool: "AI Tool",
        year: "Academic Year",
        frequency: "Usage Frequency",
        experience: "Overall Experience"
    };

    const description = active
        .map(([field, value]) =>
            `${labels[field] || field}: ${value}`
        )
        .join(" • ");

    setText("active-filters", `Active filters: ${description}`);
}


/* =========================================================
   KPI CARDS
   Uses the exact IDs in the supplied index.html.
   ========================================================= */

function updateKPI() {
    const total = filteredData.length;

    setText("kpi-total", total.toLocaleString());

    // Most-used AI tool
    const toolCounts = countBy(filteredData, "tool");
    const popularTool = toolCounts[0];

    setText(
        "kpi-top-tool",
        popularTool ? popularTool[0] : "—"
    );

    // Frequent users: Daily or Several times a week
    const frequentCount = filteredData.filter(row => {
        const frequency = getValue(row, "frequency")
            .toLowerCase();

        return (
            frequency === "daily" ||
            frequency === "several times a week"
        );
    }).length;

    setText(
        "kpi-frequent",
        total
            ? formatPercentage(percentage(frequentCount, total))
            : "—"
    );

    // Positive experience: ratings 4 or 5, plus positive text answers.
    const positiveCount = filteredData.filter(row => {
        const experience = getValue(row, "experience")
            .toLowerCase();

        return (
            experience === "4" ||
            experience === "5" ||
            experience.includes("good") ||
            experience.includes("helpful")
        );
    }).length;

    setText(
        "kpi-positive",
        total
            ? formatPercentage(percentage(positiveCount, total))
            : "—"
    );
}


/* =========================================================
   CHART CREATION
   ========================================================= */

function createAllCharts() {
    if (typeof Chart === "undefined") {
        throw new Error(
            "Chart.js failed to load. Check your internet connection."
        );
    }

    Chart.defaults.color = "#718096";
    Chart.defaults.font.family = "Inter, sans-serif";
    Chart.defaults.font.size = 11;

    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 17;

    Chart.defaults.plugins.tooltip.backgroundColor = "#202b3c";
    Chart.defaults.plugins.tooltip.borderColor = "#dce3ec";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 9;

    chartDefinitions.forEach(definition => {
        const canvas = document.getElementById(definition.id);

        if (!canvas) {
            console.warn(
                `Canvas not found in HTML: ${definition.id}`
            );

            return;
        }

        // Destroy an existing chart before recreating it.
        if (charts[definition.id]) {
            charts[definition.id].destroy();
        }

        const horizontal = definition.horizontal === true;
        const isDoughnut = definition.type === "doughnut";
        const isGrouped = Boolean(definition.groupBy);

        charts[definition.id] = new Chart(
            canvas.getContext("2d"),
            {
                type: definition.type,

                data: {
                    labels: [],
                    datasets: []
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    animation: {
                        duration: 350
                    },

                    interaction: {
                        intersect: false,
                        mode: "nearest"
                    },

                    indexAxis: horizontal ? "y" : "x",

                    plugins: {
                        legend: {
                            display: isDoughnut || isGrouped,
                            position: "bottom"
                        },

                        
                        tooltip: {
                                 callbacks: {
                             label(context) {
                             const value = context.raw;

                         return ` ${context.dataset.label || "Responses"}: ${value}`;
                         }
                     }
                }
                    },


                    scales: isDoughnut
                        ? {}
                        : {
                            x: {
                                beginAtZero: true,

                                grid: {
                                    color: "rgba(113,128,150,0.12)"
                                },

                                border: {
                                    display: false
                                },

                                ticks: {
                                    precision: 0
                                }
                            },

                            y: {
                                beginAtZero: true,

                                grid: {
                                    color: horizontal
                                        ? "rgba(113,128,150,0.12)"
                                        : "transparent"
                                },

                                border: {
                                    display: false
                                },

                                ticks: {
                                    precision: 0
                                }
                            }
                        },

                    onClick(event, elements) {
                        if (!elements.length) return;

                        handleChartClick(
                            definition,
                            elements[0]
                        );
                    }
                }
            }
        );
    });
}


/* =========================================================
   CHART DATASET CREATION
   ========================================================= */

function makeDataset(label, values, index, type) {
    const color = getChartColor(index);

    if (type === "doughnut") {
        return {
            label,
            data: values,

            backgroundColor: values.map(
                (_, i) => getChartColor(i)
            ),

            borderColor: "#ffffff",
            borderWidth: 2,
            hoverOffset: 7
        };
    }

    return {
        label,
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 38
    };
}


/* =========================================================
   UPDATE CHART DATA
   ========================================================= */
function updateChart(definition) {
    const chart = charts[definition.id];

    if (!chart) return;

    const field = definition.field;

    // Special handling for the Main Purposes chart.
    if (field === "purpose") {
        const counts = new Map();

        filteredData.forEach(row => {
            const value = getValue(row, "purpose");

            if (isMissing(value)) return;

            // Split comma-separated purposes into individual categories.
            value.split(",")
                .map(item => item.trim())
                .filter(Boolean)
                .forEach(item => {
                    counts.set(item, (counts.get(item) || 0) + 1);
                });
        });

        const sorted = [...counts.entries()]
            .sort((a, b) => b[1] - a[1]);

        chart.data.labels = sorted.map(([purpose]) => purpose);

        chart.data.datasets = [{
            label: "Responses",
            data: sorted.map(([, count]) => count),
            backgroundColor: sorted.map((_, index) =>
                getChartColor(index)
            ),
            borderRadius: 5,
            borderSkipped: false,
            maxBarThickness: 30
        }];

        chart.update("none");
        return;
    }

    // Normal handling for all other charts.
    const categories = uniqueValues(filteredData, field);

    chart.data.labels = categories;

    if (definition.groupBy) {
        const groups = uniqueValues(
            filteredData,
            definition.groupBy
        );

        chart.data.datasets = groups.map((group, index) => {
            const values = categories.map(category =>
                filteredData.filter(row =>
                    getValue(row, field) === category &&
                    getValue(row, definition.groupBy) === group
                ).length
            );

            return makeDataset(
                group,
                values,
                index,
                definition.type
            );
        });
    } else {
        const counts = new Map(countBy(filteredData, field));

        const values = categories.map(category =>
            counts.get(category) || 0
        );

        chart.data.datasets = [
            makeDataset(
                "Responses",
                values,
                0,
                definition.type
            )
        ];
    }

    chart.update("none");
}

/* =========================================================
   CHART INTERACTIONS
   Clicking a chart category applies a matching filter.
   ========================================================= */

function handleChartClick(definition, element) {
    const chart = charts[definition.id];

    if (!chart) return;

    const category = chart.data.labels[element.index];

    if (!category) return;

    const field = definition.field;

    if (activeChartFilters[field] === category) {
        delete activeChartFilters[field];
    } else {
        activeChartFilters[field] = category;
    }

    syncFilterControls();
    applyFilters();
}


/* =========================================================
   PAGE NAVIGATION
   Matches HTML IDs: overview, usage, experience, comparison.
   ========================================================= */

function setupNavigation() {
    const buttons = document.querySelectorAll(
        ".navigation .nav-item"
    );

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const pageName = button.dataset.page;

            const targetPage = document.getElementById(pageName);

            if (!targetPage) {
                console.warn(
                    `Page not found: ${pageName}`
                );

                return;
            }

            // Update active navigation button.
            buttons.forEach(item => {
                item.classList.toggle(
                    "active",
                    item === button
                );
            });

            // Show the selected page and hide the others.
            document.querySelectorAll(".page").forEach(page => {
                page.classList.toggle(
                    "active",
                    page.id === pageName
                );
            });

            setText(
                "breadcrumb-current",
                button.textContent.trim()
            );

            // Resize charts after the page becomes visible.
            requestAnimationFrame(() => {
                Object.values(charts).forEach(chart => {
                    chart.resize();
                });
            });
        });
    });
}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showDataError(message) {
    const main = document.querySelector(".main-content");

    if (!main) return;

    let panel = document.getElementById("data-error");

    if (!panel) {
        panel = document.createElement("section");
        panel.id = "data-error";

        panel.setAttribute("role", "alert");

        panel.style.cssText = [
            "margin:20px 0",
            "padding:20px",
            "border:1px solid #e3a0ad",
            "border-radius:12px",
            "background:#fff0f3",
            "color:#8c263d"
        ].join(";");

        main.prepend(panel);
    }

    const heading = document.createElement("h2");
    heading.textContent = "Dashboard data could not be loaded";
    heading.style.marginBottom = "8px";

    const description = document.createElement("p");
    description.textContent = message;

    const hint = document.createElement("p");
    hint.textContent =
        "Check that ai_tools_cleaned.csv is in the project folder and open the dashboard using a local development server.";

    hint.style.marginTop = "8px";

    panel.replaceChildren(heading, description, hint);
}


/* =========================================================
   RESPONSIVE CHART RESIZING
   ========================================================= */

let resizeTimer;

window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(() => {
        Object.values(charts).forEach(chart => {
            chart.resize();
        });
    }, 150);
});


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", loadCSV);
